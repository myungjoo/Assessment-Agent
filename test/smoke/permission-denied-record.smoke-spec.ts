// permission-denied-record.smoke-spec.ts — PermissionDeniedRecord prisma model +
// migration 의 실 PostgreSQL round-trip smoke (T-0208 — ADR-0022 §1·§3·§4·§5).
//
// 책임 (R-112 충족 전략 — schema-only slice):
//   본 slice 는 순수 prisma schema + migration SQL 이라 unit-testable TypeScript
//   symbol 이 0 다 (repository / service / controller 는 후속 slice — Out of Scope).
//   따라서 R-112 (기능 + 예외처리 + flow 3종 cover + negative cases 충분) 를
//   integration smoke 로 cover 한다 — 본 smoke 가 migration + model 이 실
//   PostgreSQL 에서 동작함을 증명한다 (R-113 smoke = bootstrap / 실 DB 정합 책임).
//
// 실 DB 전략 (persons.smoke-spec.ts 패턴 mirror — ADR-0004 §Decision):
//   - mock override 없이 AppModule 부트스트랩 → PrismaService 가 services.postgres /
//     local postgres 의 실 connection 발화. controller 가 아직 없으므로 HTTP
//     endpoint 호출 대신 PrismaService 의 prisma.permissionDeniedRecord 모델을 직접
//     사용해 create / read round-trip 을 검증한다 (CI 가 migration 을 deploy 한
//     실 테이블 위에서 동작).
//   - 각 test 의 arrange 에서 prisma.permissionDeniedRecord.create 로 실 row seed,
//     assertion 은 실 DB query 결과 검증.
//   - afterEach(truncateAll) 가 ADR-0004 §Cleanup 정책 박제 — test 간 state leak 0
//     (db-truncate.ts 의 TRUNCATE_TABLES 에 "PermissionDeniedRecord" 추가됨).
//   - afterAll(app.close + prisma.$disconnect) 가 connection 누수 방지.
//
// R-113 cover:
//   본 spec 은 CI 의 `pnpm test:smoke` step 에서 자동 실행 (test/jest-smoke.json 의
//   testRegex `.*\.smoke-spec\.ts$` 가 본 파일 picking). migration deploy 가 본
//   테이블 + 2 index 를 생성함을 전제로, model + migration 의 실 동작을 검증한다.
//
// 격리: 본 파일은 `.smoke-spec.ts` suffix 로 unit jest 의 testRegex
// (`.*\.spec\.ts$`) 와 충돌하지 않으며, package.json 의 jest.testPathIgnorePatterns
// 에 `test/smoke/` 가 있어 `pnpm test` / `pnpm test:cov` 에서는 picking 되지 않는다.
import type { INestApplication } from "@nestjs/common";
import { Test, type TestingModule } from "@nestjs/testing";

import { AppModule } from "../../src/app.module";
import { PrismaService } from "../../src/persistence/prisma.service";
import { truncateAll } from "../helpers/db-truncate";

describe("Smoke: PermissionDeniedRecord 실 PostgreSQL round-trip", () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();

    // 실 PrismaService 를 DI container 에서 획득 — seed / truncate / disconnect 용.
    prisma = moduleRef.get<PrismaService>(PrismaService);
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  // ADR-0004 §Cleanup — 각 test 후 도메인 테이블 TRUNCATE (PermissionDeniedRecord
  // 포함). append-only 라 test 간 row 누적을 막아 count 단언의 격리를 보장한다.
  afterEach(async () => {
    await truncateAll(prisma);
  });

  // ---------------------------------------------------------------------------
  // Happy path — create + read round-trip (ADR-0022 §1 필드 왕복 일치).
  // ---------------------------------------------------------------------------

  // GitHub variant — provider="github", instanceRef=configured host. principal /
  // reason 미지정 시 null 박제 (§1 nullable). createdAt 자동 박제 (§1 @default(now())).
  it("github 권한 거부 1 row 를 create 후 컬럼 값이 왕복 일치하고 nullable 은 null 박제된다", async () => {
    const created = await prisma.permissionDeniedRecord.create({
      data: {
        provider: "github",
        instanceRef: "github.sec.samsung.net",
        resourceRef: "/repos/o/r/commits",
        httpStatus: 403,
      },
    });

    // findUnique 로 재조회해 실 DB 왕복 일치 검증.
    const found = await prisma.permissionDeniedRecord.findUnique({
      where: { id: created.id },
    });

    expect(found).not.toBeNull();
    expect(found?.provider).toBe("github");
    expect(found?.instanceRef).toBe("github.sec.samsung.net");
    expect(found?.resourceRef).toBe("/repos/o/r/commits");
    expect(found?.httpStatus).toBe(403);
    // §1 nullable — principal / reason 미지정 시 null.
    expect(found?.principal).toBeNull();
    expect(found?.reason).toBeNull();
    // §1 createdAt — @default(now()) 로 자동 박제 (Date 인스턴스).
    expect(found?.createdAt).toBeInstanceOf(Date);
    // updatedAt 미정의 (§1 immutable) — model type 에 해당 key 부재.
    expect(found).not.toHaveProperty("updatedAt");
  });

  // Confluence variant — provider="confluence", instanceRef=풀 REST API base URL
  // (§1 instanceRef 정규화 — host 대신 baseUrl 비대칭을 단일 컬럼에 수용).
  it("confluence 권한 거부 1 row 를 풀 base URL instanceRef 로 round-trip 검증한다", async () => {
    const created = await prisma.permissionDeniedRecord.create({
      data: {
        provider: "confluence",
        instanceRef: "https://acme.atlassian.net/wiki/rest/api",
        resourceRef: "/content",
        httpStatus: 401,
      },
    });

    const found = await prisma.permissionDeniedRecord.findUnique({
      where: { id: created.id },
    });

    expect(found?.provider).toBe("confluence");
    expect(found?.instanceRef).toBe("https://acme.atlassian.net/wiki/rest/api");
    expect(found?.resourceRef).toBe("/content");
    expect(found?.httpStatus).toBe(401);
  });

  // nullable 컬럼에 명시값 전달 시 그대로 박제 (§1 — nullable 이지만 값 수용).
  // null 박제 (위 happy) ↔ 값 박제 (본 test) 가 데이터-차원 분기를 cover.
  it("principal / reason 에 명시값 전달 시 그대로 박제된다", async () => {
    const created = await prisma.permissionDeniedRecord.create({
      data: {
        provider: "github",
        instanceRef: "github.com",
        resourceRef: "/repos/o/r/pulls",
        principal: "svc-bot",
        httpStatus: 404,
        reason: "not-found-or-hidden",
      },
    });

    const found = await prisma.permissionDeniedRecord.findUnique({
      where: { id: created.id },
    });

    expect(found?.principal).toBe("svc-bot");
    expect(found?.reason).toBe("not-found-or-hidden");
    expect(found?.httpStatus).toBe(404);
  });

  // ---------------------------------------------------------------------------
  // Error path / negative cases (R-112 #4 — 예외 분기마다 1+).
  // ---------------------------------------------------------------------------

  // (a) required 컬럼 누락 → 실 DB NOT NULL 위반으로 reject. provider /
  // instanceRef / resourceRef / httpStatus 각각 누락 변종을 cover.
  // Prisma 의 type 차원에서도 누락 거부되나, 실 DB level NOT NULL 강제를
  // raw create 로 우회 검증 (migration 의 NOT NULL 컬럼 박제가 효력함을 증명).
  it("required 컬럼 (provider/instanceRef/resourceRef/httpStatus) 누락 시 실 DB 가 reject 한다", async () => {
    // provider 누락 — Prisma type 우회를 위해 partial data 를 unknown 캐스팅.
    await expect(
      prisma.permissionDeniedRecord.create({
        data: {
          instanceRef: "github.com",
          resourceRef: "/x",
          httpStatus: 403,
        } as unknown as {
          provider: string;
          instanceRef: string;
          resourceRef: string;
          httpStatus: number;
        },
      }),
    ).rejects.toThrow();

    // instanceRef 누락.
    await expect(
      prisma.permissionDeniedRecord.create({
        data: {
          provider: "github",
          resourceRef: "/x",
          httpStatus: 403,
        } as unknown as {
          provider: string;
          instanceRef: string;
          resourceRef: string;
          httpStatus: number;
        },
      }),
    ).rejects.toThrow();

    // resourceRef 누락.
    await expect(
      prisma.permissionDeniedRecord.create({
        data: {
          provider: "github",
          instanceRef: "github.com",
          httpStatus: 403,
        } as unknown as {
          provider: string;
          instanceRef: string;
          resourceRef: string;
          httpStatus: number;
        },
      }),
    ).rejects.toThrow();

    // httpStatus 누락.
    await expect(
      prisma.permissionDeniedRecord.create({
        data: {
          provider: "github",
          instanceRef: "github.com",
          resourceRef: "/x",
        } as unknown as {
          provider: string;
          instanceRef: string;
          resourceRef: string;
          httpStatus: number;
        },
      }),
    ).rejects.toThrow();

    // 위 4 reject 후 테이블에 row 0 — 누락 create 가 모두 박제 실패.
    const count = await prisma.permissionDeniedRecord.count();
    expect(count).toBe(0);
  });

  // (b) append-only 검증 (§3) — 동일 (provider, instanceRef, resourceRef,
  // httpStatus) 로 2회 create 하면 둘 다 성공해 2 row 가 된다. @@unique 부재 →
  // P2002 미발화 → 중복 허용. 두 row 의 id 가 서로 다름 검증.
  it("동일 키 값으로 2회 create 시 둘 다 성공해 2 row 가 되고 id 가 서로 다르다 (append-only §3)", async () => {
    const data = {
      provider: "github",
      instanceRef: "github.sec.samsung.net",
      resourceRef: "/repos/o/r/commits",
      httpStatus: 403,
    };

    const first = await prisma.permissionDeniedRecord.create({ data });
    const second = await prisma.permissionDeniedRecord.create({ data });

    // @@unique 부재 → 중복 거부 0 → 2 row.
    const count = await prisma.permissionDeniedRecord.count();
    expect(count).toBe(2);
    // 두 row 의 id 가 서로 다름 — append-only 가 매 emit 새 row 박제.
    expect(first.id).not.toBe(second.id);

    // findMany 로 2 row 모두 동일 키 값 보유 확인.
    const rows = await prisma.permissionDeniedRecord.findMany({
      where: { instanceRef: "github.sec.samsung.net" },
    });
    expect(rows).toHaveLength(2);
  });

  // ---------------------------------------------------------------------------
  // Flow / branch 분기 cover.
  //
  // 본 slice 는 schema + migration 이라 application 분기 코드가 0 다 — "분기
  // 없음 (schema-only slice)" 다. 이 항목은 §3 append-only round-trip (중복 2 row,
  // 위 test) + nullable 박제 (null vs 값, happy 의 null + principal/reason 값 test)
  // 로 데이터-차원 분기를 cover 한다. 아래 test 는 그 데이터-차원 분기의 명시
  // anchor — findMany 필터 (provider × httpStatus) 가 §4 composite index 조회
  // 패턴을 실 DB 에서 round-trip 으로 cover.
  // ---------------------------------------------------------------------------
  it("provider × httpStatus 필터 findMany 가 §4 audit 조회 패턴을 실 DB 에서 cover 한다", async () => {
    await prisma.permissionDeniedRecord.create({
      data: {
        provider: "github",
        instanceRef: "github.com",
        resourceRef: "/a",
        httpStatus: 403,
      },
    });
    await prisma.permissionDeniedRecord.create({
      data: {
        provider: "github",
        instanceRef: "github.com",
        resourceRef: "/b",
        httpStatus: 401,
      },
    });
    await prisma.permissionDeniedRecord.create({
      data: {
        provider: "confluence",
        instanceRef: "https://acme.atlassian.net/wiki/rest/api",
        resourceRef: "/c",
        httpStatus: 403,
      },
    });

    // §4 provider × status 조회 — github 의 403 만 1 row.
    const githubForbidden = await prisma.permissionDeniedRecord.findMany({
      where: { provider: "github", httpStatus: 403 },
    });
    expect(githubForbidden).toHaveLength(1);
    expect(githubForbidden[0].resourceRef).toBe("/a");

    // 전역 count — 3 provider/status 변종 모두 박제됨.
    const total = await prisma.permissionDeniedRecord.count();
    expect(total).toBe(3);
  });
});
