// jest-smoke-setup.ts — jest `globalSetup` hook 의 source (T-0053).
//
// 책임 (ADR-0004 §Migration 의무 #5 박제):
//   1. PrismaClient 인스턴스 1 회 생성 + `$connect()` 호출 — services.postgres
//      container 가 ready 상태인지 1 회 확인 (CI 의 health-cmd 와 별개로 client
//      차원의 connection 가능 검증).
//   2. `truncateAll(prisma)` 1 회 호출 — 직전 CI run / local dev iteration 의 dirty
//      data 잔류 가능성 0 보장. CI 의 services: postgres 는 job 마다 새 container
//      이라 깨끗하나 local dev 의 long-lived postgres container 안정성 박제.
//   3. `await prisma.$disconnect()` — globalSetup 의 connection 누수 방지. 각
//      smoke spec 의 `beforeAll` 에서 별도 PrismaService 가 fresh connect.
//
// 참조: test/jest-smoke.json 의 `globalSetup` key 가 본 파일의 default export 를
// 발화한다 (jest 의 globalSetup 계약 — 모든 spec 실행 직전 1 회).
//
// ADR-0004 §Cleanup 정책 박제: 각 test 후 `afterEach(truncateAll)` 가 individual
// test isolation 의 main layer. 본 globalSetup 은 run 시작 시점의 1 회 cleanup
// (pre-existing dirty data 의 안전망) 으로 책임 분리.
//
// e2e 와의 책임 분리: 본 setup 은 smoke spec (`test/smoke/*.smoke-spec.ts`) 전용.
// e2e 는 후속 T-0054 에서 동일 패턴의 별도 setup 파일 (`jest-e2e-setup.ts`) 또는
// 본 setup 의 share 결정 — T-0054 책임.
//
// DATABASE_URL env requirement: 본 setup 은 `process.env.DATABASE_URL` 미설정 시
// 명시 Error throw — fail-fast 패턴. PrismaClient 의 자체 connection 실패 보다
// 먼저 명확한 error 메시지로 환경 misconfiguration 박제.
//
// 파일 경로 정책: `test/helpers/jest-smoke-setup.ts` 는 jest 의 어떤 testRegex
// (`.*\.spec\.ts$` / `.*\.smoke-spec\.ts$` / `.*\.e2e-spec\.ts$`) 도 매칭하지
// 않으므로 jest 의 어떤 config 도 본 파일을 test 로 pickup 하지 않는다.
// package.json 의 `collectCoverageFrom: ["src/**/*"]` scope 밖이라 coverage 통계
// 영향 0.
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

import { truncateAll } from "./db-truncate";

// jest globalSetup 계약: default export 의 async 함수. spec 실행 직전 1 회 호출.
// 본 함수가 throw 하면 jest 전체 run 이 즉시 abort — services.postgres misconfig
// 의 fail-fast 의도 (mock-override 잔존 시 smoke 가 silently green 으로 가는
// 박제 누락 패턴 차단).
export default async function globalSetup(): Promise<void> {
  // DATABASE_URL fail-fast — PrismaPg adapter 의 자체 error 보다 명확한 message.
  const databaseUrl = process.env.DATABASE_URL;
  if (databaseUrl === undefined || databaseUrl === "") {
    throw new Error(
      "[jest-smoke-setup] DATABASE_URL 미설정 — services.postgres 또는 local " +
        "postgres container 가 띄워져 있고 DATABASE_URL 이 주입되었는지 확인. " +
        "CI 는 .github/workflows/ci.yml 의 env.DATABASE_URL 박제. " +
        "local 은 export DATABASE_URL=postgresql://postgres:postgres@localhost:5432/assessment_test 권장.",
    );
  }

  // PrismaService 가 아닌 PrismaClient 직접 사용 — NestJS DI 부트스트랩 cost 회피.
  // adapter 는 PrismaService.buildPrismaAdapter() 와 동일 패턴 (DATABASE_URL → PrismaPg).
  const adapter = new PrismaPg({ connectionString: databaseUrl });
  const prisma = new PrismaClient({ adapter });

  try {
    await prisma.$connect();
    // 직전 run 의 dirty data 안전망 cleanup — CI 의 services: 는 매 job 새
    // container 라 무의미하나 local dev 의 long-lived container 안정성 박제.
    await truncateAll(prisma);
  } finally {
    // connection 누수 방지 — finally block 으로 connect 실패 시에도 disconnect 시도.
    await prisma.$disconnect();
  }
}
