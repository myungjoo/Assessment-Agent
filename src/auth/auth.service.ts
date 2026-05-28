// AuthService — ADR-0008 의 JWT (HS256) + HttpOnly cookie hybrid 패턴의
// service-layer backbone (T-0081 acceptance §B 박제).
//
// 책임:
//   - Password hashing/verify (bcrypt 10 rounds, ADR-0008 Decision §6 의 bcrypt 채택).
//   - Access token issue (HS256, 15min TTL, secret = AUTH_JWT_SECRET).
//   - Refresh token issue (HS256, 7day TTL, secret = AUTH_JWT_REFRESH_SECRET — 별도
//     secret 분리, ADR-0008 Decision §5 의 access ↔ refresh secret 분리 invariant).
//   - JWT verify — payload type narrowed to JwtPayload (sub claim 필수).
//
// 책임 경계 (Out of Scope, task §Out of Scope 박제):
//   - Login / logout / refresh endpoint — T-0082 후속.
//   - RBAC AuthGuard + @Role() decorator — T-0083 후속.
//   - Refresh token rotation DB persistence (RefreshToken table) — 후속 task.
//   - JwtStrategy (passport-jwt cookie extractor) — T-0082 후속.
//
// secret 환경변수 invariant:
//   - AUTH_JWT_SECRET — access token signing secret (HS256). JwtModule.registerAsync
//     의 useFactory 가 module init 시점에 한 번 읽어 JwtService 의 default secret 으로
//     binding. 본 service 는 default secret 으로 access sign/verify.
//   - AUTH_JWT_REFRESH_SECRET — refresh token signing secret. 본 service 가 sign /
//     verify 옵션의 `secret:` override 로 매 호출 시 명시 지정. JwtModule
//     default 와 분리 → access secret 탈취 시 refresh forge 차단.
//
// TTL invariant (ADR-0008 Decision §3):
//   - access: 15 분 (`15m`).
//   - refresh: 7 일 (`7d`).
import { Injectable } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import * as bcrypt from "bcrypt";

// JwtPayload — JWT payload 의 최소 contract. ADR-0008 Decision §1 의 sub (userId) +
// role + iat + exp claim 박제 (T-0083 acceptance §A — role claim 추가, RBAC
// RolesGuard 가 본 claim 위에서 작동). iat / exp 는 jsonwebtoken 표준 claim 으로
// verify 시 자동 binding.
export interface JwtPayload {
  // userId — ADR-0008 의 sub claim (RFC 7519 표준 "subject").
  sub: string;
  // role — User entity 의 role 컬럼 (String literal "SuperAdmin" / "Admin" / "User").
  // T-0083 의 RolesGuard 가 본 claim 위에서 escalation 매핑 적용. issue 시점에
  // user.role 을 controller 가 인자로 전달, refresh rotation 시 payload.role 보존.
  role: string;
  // jsonwebtoken 표준 claim — verify 시점에 library 가 자동 채움. optional 로 박제.
  iat?: number;
  exp?: number;
}

// REFRESH_SECRET_ENV — env 이름의 단일 source of truth. test 가 spec 안에서
// 동일 const 를 import 하여 mock 시 stable.
export const REFRESH_SECRET_ENV = "AUTH_JWT_REFRESH_SECRET";

// BCRYPT_ROUNDS — ADR-0008 Decision §6 의 bcrypt 10 rounds 박제. spec 도 동일 const
// import 하여 round-trip 검증 시 사용.
export const BCRYPT_ROUNDS = 10;

// Access / refresh TTL 박제 — ADR-0008 Decision §3 정합. jsonwebtoken 의
// expiresIn 표현 ("15m" / "7d") 로 spec 의 expect 와 정합.
export const ACCESS_TOKEN_TTL = "15m";
export const REFRESH_TOKEN_TTL = "7d";

@Injectable()
export class AuthService {
  constructor(
    // JwtService — JwtModule.registerAsync (auth.module.ts) 가 AUTH_JWT_SECRET 을
    // default secret 으로 bind 한 instance. access token sign/verify 의 backend.
    // refresh 는 동 service 의 sign/verify 옵션에 `secret:` override 로 분리 secret 적용.
    private readonly jwtService: JwtService,
  ) {}

  // hashPassword — bcrypt 10 rounds 단방향 hash. ADR-0008 Decision §6 의
  // bcrypt 채택 + ADR-0008 후속 chain 의 User entity password 컬럼 의 hash 산출 source.
  // 빈 문자열도 그대로 forward — service-layer 의 validation 책임 분리 (PartService /
  // PersonService 의 동일 패턴 precedent). DTO layer 의 class-validator @IsNotEmpty
  // 가 controller 단계에서 reject 의무.
  async hashPassword(plain: string): Promise<string> {
    return bcrypt.hash(plain, BCRYPT_ROUNDS);
  }

  // verifyPassword — bcrypt compare. hash 가 정상 bcrypt 형식이 아닐 시 bcrypt 가
  // false 반환 (또는 throw — bcrypt 6.x 의 deviation 흡수). 의도된 contract:
  //   - 일치 → true
  //   - 불일치 → false
  //   - hash 가 corrupt (예: salt 누락) → bcrypt 의 raw 동작 propagate (대부분 false).
  async verifyPassword(plain: string, hash: string): Promise<boolean> {
    return bcrypt.compare(plain, hash);
  }

  // issueAccessToken — access token (HS256, 15min TTL) 발급. payload `{ sub, role }`.
  // JwtService 는 module init 시점에 AUTH_JWT_SECRET 으로 binding 된 default secret 사용.
  // userId / role 이 빈 string 이어도 jsonwebtoken 은 정상 sign — DTO layer validation
  // 책임 분리. controller 가 user.role 을 두 번째 인자로 전달 (T-0083 acceptance §A).
  issueAccessToken(userId: string, role: string): string {
    return this.jwtService.sign(
      { sub: userId, role },
      { expiresIn: ACCESS_TOKEN_TTL },
    );
  }

  // issueRefreshToken — refresh token (HS256, 7day TTL) 발급. AUTH_JWT_REFRESH_SECRET
  // override (access secret 과 분리 — ADR-0008 Decision §5 invariant).
  // env 미설정 시 빈 문자열 fallback — jsonwebtoken 이 빈 secret 로 sign 가능 (실 환경
  // 에서는 module init / process boot 단계에서 env 검증 의무, T-0087 candidate 의
  // ConfigModule + Joi schema 도입 시점에 boundary 박제).
  // role 은 rotation 시 보존을 위해 second arg — refresh endpoint 가 payload.role 을
  // 직접 다음 token 으로 전달 (DB lookup 없이 rotation 의 role 보존).
  issueRefreshToken(userId: string, role: string): string {
    return this.jwtService.sign(
      { sub: userId, role },
      {
        expiresIn: REFRESH_TOKEN_TTL,
        secret: process.env[REFRESH_SECRET_ENV] ?? "",
      },
    );
  }

  // verifyToken — access token 의 signature + expiry verify. JwtService.verify 는
  // jsonwebtoken 표준 에러 (TokenExpiredError / JsonWebTokenError / NotBeforeError)
  // 를 raw throw — controller / guard layer 가 HTTP 401/403 으로 변환 책임.
  // 본 시점에는 access token 만 verify (refresh 는 T-0082 endpoint 가 secret override).
  verifyToken(token: string): JwtPayload {
    return this.jwtService.verify<JwtPayload>(token);
  }
}
