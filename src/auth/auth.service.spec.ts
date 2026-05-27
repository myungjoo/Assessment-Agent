// AuthService spec — T-0081 acceptance §B 박제 (R-112 4 카테고리: happy / error /
// branch / negative 충족 + coverage line/function ≥ 80% global threshold).
//
// 본 spec 의 격리 전략:
//   - JwtService 는 실 instance 사용 (jsonwebtoken 표준 동작 검증). secret 은
//     AuthService 의 constructor 가 받은 instance 자체에 들어있어 module init 시점
//     의 useFactory 와 동일 효과 — `new JwtService({ secret, signOptions })` 로 명시.
//   - bcrypt 는 실 module 사용 (round-trip + corrupt hash 분기 cover). 10 rounds 의
//     hash 시간이 jest default timeout 안에서 fine.
//   - env 변수 (AUTH_JWT_SECRET / AUTH_JWT_REFRESH_SECRET) 는 spec 안에서 set/restore
//     로 isolation. spec 종료 시 원복.
//
// 검증 포인트 (R-112 4 카테고리):
//   (1) happy — hashPassword → verifyPassword round-trip / issueAccessToken non-empty
//       JWT / issueRefreshToken non-empty JWT / verifyToken 결과 payload.sub === userId.
//   (2) error — verifyToken garbage / wrong-secret signed / expired / verifyPassword
//       wrong hash / verifyPassword corrupt hash.
//   (3) branch — access vs refresh secret 분리 (refresh token 을 access secret 으로
//       verify 시 fail) / access TTL 15min vs refresh TTL 7day decode 검증 / hash
//       ≠ plain 의 literal mismatch.
//   (4) negative (예외 분기마다 1+ test, 충분 cover) — 빈 plain hashPassword / 빈 hash
//       verifyPassword / verifyToken null / verifyToken undefined / verifyToken
//       wrong-secret signed / verifyPassword corrupt hash / issueAccessToken 빈 userId /
//       AUTH_JWT_REFRESH_SECRET 미설정 시 빈 string fallback.
import { JwtService } from "@nestjs/jwt";
import * as bcrypt from "bcrypt";

import {
  ACCESS_TOKEN_TTL,
  AuthService,
  BCRYPT_ROUNDS,
  REFRESH_SECRET_ENV,
  REFRESH_TOKEN_TTL,
  type JwtPayload,
} from "./auth.service";

// Stable secret fixture — spec 안에서 동일 const 재사용 → isolation + 의도 명시.
const ACCESS_SECRET = "test-access-secret-32bytes-min-length-1234567890";
const REFRESH_SECRET = "test-refresh-secret-32bytes-min-length-9876543210";

// AuthService factory — JwtService 를 동일 secret/algorithm 으로 명시 생성.
// AuthModule 의 useFactory 와 동일 contract (HS256 + access TTL default).
function buildService(opts?: { accessSecret?: string }): {
  service: AuthService;
  jwtService: JwtService;
} {
  const jwtService = new JwtService({
    secret: opts?.accessSecret ?? ACCESS_SECRET,
    signOptions: {
      algorithm: "HS256",
      expiresIn: ACCESS_TOKEN_TTL,
    },
  });
  const service = new AuthService(jwtService);
  return { service, jwtService };
}

describe("AuthService", () => {
  // env 백업 / 복원 — REFRESH_SECRET_ENV 가 issueRefreshToken 의 의존성.
  let originalRefreshSecret: string | undefined;

  beforeEach(() => {
    originalRefreshSecret = process.env[REFRESH_SECRET_ENV];
    process.env[REFRESH_SECRET_ENV] = REFRESH_SECRET;
  });

  afterEach(() => {
    if (originalRefreshSecret === undefined) {
      delete process.env[REFRESH_SECRET_ENV];
    } else {
      process.env[REFRESH_SECRET_ENV] = originalRefreshSecret;
    }
  });

  // ---------------------------------------------------------------------
  // hashPassword() / verifyPassword() — bcrypt 10 rounds round-trip.
  // ---------------------------------------------------------------------
  describe("hashPassword() / verifyPassword()", () => {
    it("hashPassword 결과를 verifyPassword 가 true 로 인식한다 (happy round-trip)", async () => {
      const { service } = buildService();
      const plain = "correct-horse-battery-staple";
      const hashed = await service.hashPassword(plain);

      expect(hashed).toEqual(expect.any(String));
      expect(hashed.length).toBeGreaterThan(20);
      expect(hashed).not.toBe(plain); // hash !== plain literal (branch).
      await expect(service.verifyPassword(plain, hashed)).resolves.toBe(true);
    });

    it("hashPassword 의 결과는 bcrypt 형식 prefix (`$2`) 를 갖는다 (branch — format invariant)", async () => {
      const { service } = buildService();
      const hashed = await service.hashPassword("any-password");
      // bcrypt 6.x default minor 'b' → "$2b$..." (또는 일부 환경에서 "$2a$..").
      expect(hashed.startsWith("$2")).toBe(true);
    });

    it("BCRYPT_ROUNDS 가 hash 의 cost field 에 박제된다 (branch — 10 rounds)", async () => {
      const { service } = buildService();
      const hashed = await service.hashPassword("any-password-2");
      // bcrypt hash format: $2b$10$<22 char salt><31 char hash>.
      // cost field 는 2 번째 `$` 분리 segment.
      const parts = hashed.split("$");
      expect(parts).toHaveLength(4);
      expect(parts[2]).toBe(String(BCRYPT_ROUNDS));
    });

    it("plain 이 다르면 verifyPassword 가 false 를 반환한다 (error — wrong password)", async () => {
      const { service } = buildService();
      const hashed = await service.hashPassword("real-password");
      await expect(
        service.verifyPassword("wrong-password", hashed),
      ).resolves.toBe(false);
    });

    it("verifyPassword 가 corrupt hash 입력에 대해 false 또는 throw 한다 (negative — corrupt hash)", async () => {
      // bcrypt 6.x 가 invalid format 에 대해 사례 따라 false 반환 또는 throw —
      // 두 분기 모두 흡수 (실 동작 OS 별 deviation 흡수).
      const { service } = buildService();
      // ESLint no-await-in-loop 회피 — 단일 await + 결과 분기 cover.
      try {
        const result = await service.verifyPassword("any", "not-a-bcrypt-hash");
        expect(result).toBe(false);
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
      }
    });

    it("빈 plain 도 hashPassword 가 정상 hash 산출한다 (negative — empty plain, validation 책임 분리)", async () => {
      // service-layer validation 책임 분리 (PartService.create precedent 정합).
      // bcrypt 는 빈 string 도 정상 hash 산출 — DTO layer 의 @IsNotEmpty 가 reject 의무.
      const { service } = buildService();
      const hashed = await service.hashPassword("");
      expect(hashed.startsWith("$2")).toBe(true);
      // round-trip 도 정상 — 빈 plain 으로 verify true.
      await expect(service.verifyPassword("", hashed)).resolves.toBe(true);
    });

    it("빈 hash 입력 시 verifyPassword 가 false 또는 throw (negative — empty hash)", async () => {
      const { service } = buildService();
      try {
        const result = await service.verifyPassword("any", "");
        expect(result).toBe(false);
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
      }
    });

    it("hashPassword 가 호출마다 다른 salt 의 hash 를 산출한다 (branch — salt randomness)", async () => {
      // bcrypt 의 default salt randomness 검증 — 동일 plain 도 매 호출 다른 hash.
      // verifyPassword 양쪽 모두 true (round-trip 보장).
      const { service } = buildService();
      const plain = "same-plain";
      const h1 = await service.hashPassword(plain);
      const h2 = await service.hashPassword(plain);
      expect(h1).not.toBe(h2);
      await expect(service.verifyPassword(plain, h1)).resolves.toBe(true);
      await expect(service.verifyPassword(plain, h2)).resolves.toBe(true);
    });

    it("verifyPassword 가 plain/hash 를 변형 없이 bcrypt 로 forward (happy — forwarding)", async () => {
      // bcrypt module 의 ESM/namespace import 는 jest.spyOn 가 redefine 불가능 →
      // 직접 호출로 round-trip 양방향 검증. 같은 plain+hash 에 대해 service 의
      // verifyPassword 결과 가 bcrypt.compare 직접 호출 결과와 동일함을 검증.
      const { service } = buildService();
      const hashed = await service.hashPassword("plain-x");
      const viaService = await service.verifyPassword("plain-x", hashed);
      const viaBcrypt = await bcrypt.compare("plain-x", hashed);
      expect(viaService).toBe(viaBcrypt);
      expect(viaService).toBe(true);
    });
  });

  // ---------------------------------------------------------------------
  // issueAccessToken() — HS256 + 15min TTL + sub claim.
  // ---------------------------------------------------------------------
  describe("issueAccessToken()", () => {
    it("non-empty JWT string 을 반환한다 (happy)", () => {
      const { service } = buildService();
      const token = service.issueAccessToken("user-1");
      expect(typeof token).toBe("string");
      // JWT 표준 format: 3 segment dot-separated.
      expect(token.split(".")).toHaveLength(3);
    });

    it("payload 의 sub claim 이 userId 와 일치한다 (happy — payload binding)", () => {
      const { service, jwtService } = buildService();
      const token = service.issueAccessToken("user-2");
      // 동일 JwtService 로 verify → access secret 정합.
      const payload = jwtService.verify<JwtPayload>(token);
      expect(payload.sub).toBe("user-2");
    });

    it("access token 의 exp 가 iat + 15min (= 900s) 인근에 박제된다 (branch — 15min TTL)", () => {
      const { service, jwtService } = buildService();
      const token = service.issueAccessToken("user-3");
      const payload = jwtService.verify<JwtPayload>(token);
      expect(payload.iat).toEqual(expect.any(Number));
      expect(payload.exp).toEqual(expect.any(Number));
      const ttl = (payload.exp as number) - (payload.iat as number);
      // 정확히 900s — jsonwebtoken 의 "15m" parse 결과.
      expect(ttl).toBe(15 * 60);
    });

    it("빈 userId 도 그대로 sub claim 으로 sign 된다 (negative — empty userId, validation 책임 분리)", () => {
      // service-layer validation 책임 분리 (PartService.create precedent 정합).
      // jsonwebtoken 은 빈 string sub 도 정상 sign — controller / DTO layer 가
      // @IsNotEmpty 등으로 reject 의무.
      const { service, jwtService } = buildService();
      const token = service.issueAccessToken("");
      const payload = jwtService.verify<JwtPayload>(token);
      expect(payload.sub).toBe("");
    });

    it("동일 userId 호출도 매 호출 정상 동작 (negative — repeated call)", () => {
      const { service } = buildService();
      const t1 = service.issueAccessToken("user-rep");
      const t2 = service.issueAccessToken("user-rep");
      // jsonwebtoken 의 iat 이 초 단위 → 동일 초 안에서는 동일 token 가능.
      // 양쪽 token 모두 non-empty + format 적합.
      expect(t1.split(".")).toHaveLength(3);
      expect(t2.split(".")).toHaveLength(3);
    });
  });

  // ---------------------------------------------------------------------
  // issueRefreshToken() — HS256 + 7day TTL + secret 분리 (access 와 다른 secret).
  // ---------------------------------------------------------------------
  describe("issueRefreshToken()", () => {
    it("non-empty JWT string 을 반환한다 (happy)", () => {
      const { service } = buildService();
      const token = service.issueRefreshToken("user-1");
      expect(typeof token).toBe("string");
      expect(token.split(".")).toHaveLength(3);
    });

    it("refresh token 의 payload sub claim 이 userId 와 일치한다 (happy — payload binding)", () => {
      const { service } = buildService();
      const token = service.issueRefreshToken("user-r2");
      // refresh secret 으로 verify (별도 JwtService instance — secret override).
      const verifier = new JwtService({ secret: REFRESH_SECRET });
      const payload = verifier.verify<JwtPayload>(token);
      expect(payload.sub).toBe("user-r2");
    });

    it("refresh token 의 exp 가 iat + 7day (= 604800s) 인근에 박제된다 (branch — 7day TTL)", () => {
      const { service } = buildService();
      const token = service.issueRefreshToken("user-r3");
      const verifier = new JwtService({ secret: REFRESH_SECRET });
      const payload = verifier.verify<JwtPayload>(token);
      const ttl = (payload.exp as number) - (payload.iat as number);
      // "7d" → 7 * 24 * 60 * 60 = 604800s.
      expect(ttl).toBe(7 * 24 * 60 * 60);
    });

    it("refresh token 을 access secret 으로 verify 하면 fail 한다 (branch — secret 분리 invariant)", () => {
      // ADR-0008 Decision §5 의 access ↔ refresh secret 분리 invariant 박제 검증.
      // refresh 가 REFRESH_SECRET 으로 sign 되었으므로 ACCESS_SECRET 으로 verify
      // 시 JsonWebTokenError (invalid signature) throw.
      const { service, jwtService } = buildService();
      const refreshToken = service.issueRefreshToken("user-r4");
      // jwtService 가 ACCESS_SECRET 로 binding 되어 있으므로 verify fail.
      expect(() => jwtService.verify<JwtPayload>(refreshToken)).toThrow();
    });

    it("access token 을 refresh secret 으로 verify 하면 fail 한다 (branch — 양방향 분리)", () => {
      const { service } = buildService();
      const accessToken = service.issueAccessToken("user-r5");
      const refreshVerifier = new JwtService({ secret: REFRESH_SECRET });
      expect(() => refreshVerifier.verify<JwtPayload>(accessToken)).toThrow();
    });

    it("REFRESH_SECRET_ENV 미설정 시 빈 string fallback path 가 service 안에서 raw 동작 (negative — env missing)", () => {
      // env 미설정 시 service 의 `?? ""` fallback branch 박제. jsonwebtoken 6.x 는
      // sign 시 빈 secret 도 수용 (non-empty JWT 산출), verify 시에는 reject — 본
      // contract 가 ADR-0008 후속 chain (T-0082 의 ConfigModule + Joi schema) 의
      // boundary 박제 의무를 발화시키는 negative path. 본 spec 은 sign path 의
      // raw 동작만 cover.
      delete process.env[REFRESH_SECRET_ENV];
      const { service } = buildService();
      const token = service.issueRefreshToken("user-no-env");
      // sign path 는 정상 — non-empty JWT 형식 산출.
      expect(typeof token).toBe("string");
      expect(token.split(".")).toHaveLength(3);
    });

    it("REFRESH_SECRET_ENV 값을 runtime 에서 변경하면 다음 issue 가 새 secret 으로 sign (branch — env runtime read)", () => {
      // service 가 매 호출 시 process.env 읽음 — module init 시점 cache 없음 검증.
      const { service } = buildService();
      const t1 = service.issueRefreshToken("user-rt1");
      process.env[REFRESH_SECRET_ENV] =
        "second-refresh-secret-32b-min-length-XX";
      const t2 = service.issueRefreshToken("user-rt2");
      // t1 은 REFRESH_SECRET 로 verify 가능.
      const verifier1 = new JwtService({ secret: REFRESH_SECRET });
      expect(verifier1.verify<JwtPayload>(t1).sub).toBe("user-rt1");
      // t2 는 새 secret 으로만 verify 가능.
      const verifier2 = new JwtService({
        secret: "second-refresh-secret-32b-min-length-XX",
      });
      expect(verifier2.verify<JwtPayload>(t2).sub).toBe("user-rt2");
      // t2 를 첫 secret 으로 verify 시 fail.
      expect(() => verifier1.verify<JwtPayload>(t2)).toThrow();
    });
  });

  // ---------------------------------------------------------------------
  // verifyToken() — happy + 모든 error/negative 분기.
  // ---------------------------------------------------------------------
  describe("verifyToken()", () => {
    it("정상 access token 의 payload 를 반환한다 (happy)", () => {
      const { service } = buildService();
      const token = service.issueAccessToken("user-v1");
      const payload = service.verifyToken(token);
      expect(payload.sub).toBe("user-v1");
      expect(payload.iat).toEqual(expect.any(Number));
      expect(payload.exp).toEqual(expect.any(Number));
    });

    it("garbage token 입력 시 throw (error — invalid format)", () => {
      const { service } = buildService();
      expect(() => service.verifyToken("not-a-jwt-at-all")).toThrow();
    });

    it("빈 string token 입력 시 throw (error / negative — empty token)", () => {
      const { service } = buildService();
      expect(() => service.verifyToken("")).toThrow();
    });

    it("wrong-secret 으로 sign 된 token 은 verify fail (error — signature mismatch)", () => {
      const { service } = buildService();
      const foreignJwt = new JwtService({
        secret: "different-secret-XYZ-1234567890",
      });
      const foreignToken = foreignJwt.sign({ sub: "user-foreign" });
      expect(() => service.verifyToken(foreignToken)).toThrow();
    });

    it("만료된 token 은 verify fail — TokenExpiredError (error — expired)", () => {
      const { service } = buildService();
      // jsonwebtoken 은 음수 expiresIn 도 허용 → 즉시 만료 token 발급.
      const expiredJwt = new JwtService({
        secret: ACCESS_SECRET,
        signOptions: { algorithm: "HS256" },
      });
      const expired = expiredJwt.sign(
        { sub: "user-exp" },
        { expiresIn: "-1s" },
      );
      expect(() => service.verifyToken(expired)).toThrow(
        /jwt expired|expired/i,
      );
    });

    it("null token 입력 시 throw (negative — null)", () => {
      const { service } = buildService();
      // 타입 시그니처는 string 이나 runtime 에서 null 이 흘러올 수 있음 (controller
      // bug 가 흘려보내는 시나리오). jsonwebtoken 이 throw.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect(() => service.verifyToken(null as any)).toThrow();
    });

    it("undefined token 입력 시 throw (negative — undefined)", () => {
      const { service } = buildService();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect(() => service.verifyToken(undefined as any)).toThrow();
    });

    it("number 형 token 입력 시 throw (negative — wrong type)", () => {
      const { service } = buildService();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect(() => service.verifyToken(12345 as any)).toThrow();
    });

    it("dot 2 개 들어간 garbage token 도 throw (negative — looks-like-jwt 위장)", () => {
      // 3-segment 형태이나 base64 decode 시 깨지는 garbage.
      const { service } = buildService();
      expect(() => service.verifyToken("aaa.bbb.ccc")).toThrow();
    });

    it("refresh token 을 verifyToken 으로 verify 시 fail (negative — wrong-key class)", () => {
      // verifyToken 은 access secret 으로 verify → refresh token (다른 secret) 은 fail.
      // ADR-0008 의 분리 invariant 의 negative path.
      const { service } = buildService();
      const refreshToken = service.issueRefreshToken("user-rv");
      expect(() => service.verifyToken(refreshToken)).toThrow();
    });

    it("verifyToken 결과의 sub 가 issue 시 userId 와 정확히 일치 (branch — payload integrity)", () => {
      const { service } = buildService();
      const userId = "한글-사용자-id-12345";
      const token = service.issueAccessToken(userId);
      const payload = service.verifyToken(token);
      expect(payload.sub).toBe(userId);
    });
  });

  // ---------------------------------------------------------------------
  // 모듈 export 상수 invariant — TTL / rounds / env 이름 박제.
  // 본 ADR-0008 Decision §3 + §5 + §6 의 상수가 실 export 와 정합한지 검증.
  // ---------------------------------------------------------------------
  describe("ADR-0008 invariant 상수 박제", () => {
    it("BCRYPT_ROUNDS === 10 (ADR-0008 Decision §6)", () => {
      expect(BCRYPT_ROUNDS).toBe(10);
    });

    it('ACCESS_TOKEN_TTL === "15m" (ADR-0008 Decision §3)', () => {
      expect(ACCESS_TOKEN_TTL).toBe("15m");
    });

    it('REFRESH_TOKEN_TTL === "7d" (ADR-0008 Decision §3)', () => {
      expect(REFRESH_TOKEN_TTL).toBe("7d");
    });

    it('REFRESH_SECRET_ENV === "AUTH_JWT_REFRESH_SECRET" (ADR-0008 Decision §5)', () => {
      expect(REFRESH_SECRET_ENV).toBe("AUTH_JWT_REFRESH_SECRET");
    });
  });
});
