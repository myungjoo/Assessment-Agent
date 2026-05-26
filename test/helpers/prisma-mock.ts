// prisma-mock.ts — `/api/persons` smoke + e2e (그리고 후속 spec) 의 공용
// PrismaService mock + Person fixture + Prisma error 생성 helper 의 단일 source.
//
// 위상 (T-0053 박제 — ADR-0004 §Decision):
//   - unit-only 보조 — smoke/e2e 는 T-0053 이후 real PrismaService 사용 (ADR-0004 §Decision 박제).
//   - 본 mock 의 위상: deprecated 가 아닌 unit-only 보조 — Prisma error code 변환 분기 (P2002 / P2025 / P2003 / unknown) 의 explicit 박제로 R-112 negative case cover 에 유리 (ADR-0004 §Decision 의 mock 위상 결정).
//   - smoke/e2e 의 import 제거 시점: T-0053 (smoke) / T-0054 (e2e) 머지 시점.
//
// 책임 (T-0047 phase 1 추출):
//   - smoke (test/smoke/persons.smoke-spec.ts) + e2e (test/e2e/persons.e2e-spec.ts)
//     2 spec 의 inline 중복을 본 모듈로 통합. T-0044 / T-0046 §Follow-ups 의 박제
//     누적 임계 (3+ spec) 도달에 따른 phase 1 추출.
//   - 모든 helper 는 기존 inline 시그니처와 동일 — migration 은 import 만 추가하고
//     inline block 을 삭제하는 mechanical 변환. 동작 변경 0.
//
// 사용 가이드:
//   import {
//     buildMockPrismaService,
//     buildPersonFixture,
//     buildPrismaError,
//     type MockPrismaService,
//   } from "../helpers/prisma-mock";
//
// phase 2 follow-up (별도 task — fixture variant decision 동반):
//   - src/user/*.spec.ts 5 spec (person.service / person.controller / person.repository
//     / part.service / part.controller) 의 inline helper migration. part.service.spec.ts
//     L37 의 partId default `"part-default"` 가 본 모듈의 `null` 과 다름 — architect
//     decision (unified default + 호출자 override 강제 vs `buildPersonFixtureForRepository`
//     변종 신설) 동반.
//   - buildPartFixture / GroupFixture 추출 — Part / Group 도메인 backbone 진입 후
//     누적 임계 도달 시 본 모듈에 동반 추가.
//
// 파일 경로 정책: `test/helpers/prisma-mock.ts` 는 `.spec.ts` / `.smoke-spec.ts` /
// `.e2e-spec.ts` 의 어떤 testRegex 도 매칭하지 않으므로 jest 의 어떤 config 도 본
// 파일을 test 로 pickup 하지 않는다. package.json 의 `collectCoverageFrom: ["src/**/*"]`
// scope 밖이라 coverage 통계에도 포함 0 — production threshold 회귀 위험 0.
import type { Person } from "@prisma/client";

// PrismaService 의 mock shape — PersonController / Service / Repository 가 사용하는
// `person` delegate 의 5 메서드만 mock 으로 보유. PrismaService 가 PersistenceModule
// 의 @Global() provider 이므로 본 mock 1 곳 override 로 모든 PrismaService 의존이 치환.
export type MockPrismaService = {
  person: {
    findMany: jest.Mock;
    findUnique: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
    delete: jest.Mock;
  };
};

// 신규 mock PrismaService 객체 생성 — 5 jest.fn() 보유한 `person` delegate.
// `Test.createTestingModule().overrideProvider(PrismaService).useValue(...)` 의
// useValue 인자로 그대로 전달. PrismaClient 의 나머지 메서드는 본 mock 으로
// 호출되지 않으므로 부분 mock 으로 충분.
export function buildMockPrismaService(): MockPrismaService {
  return {
    person: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  };
}

// Person fixture — schema.prisma 의 7 컬럼 (id / fullName / email / active /
// partId / createdAt / updatedAt) 모두 채운 default Person row 반환. partId 는
// T-0039 가 추가한 nullable 컬럼 — fixture default null (smoke / e2e 기존 동일).
// default id `"cuid-default"` 는 호출 spec 이 overrides 인자로 자유롭게 교체
// 가능 (기존 smoke `"cuid-smoke-default"` / e2e `"cuid-e2e-default"` 모두 spec
// 별 override 로 그대로 재현 가능).
export function buildPersonFixture(overrides: Partial<Person> = {}): Person {
  return {
    id: "cuid-default",
    fullName: "홍길동",
    email: "hong@example.test",
    active: true,
    partId: null,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    ...overrides,
  };
}

// Prisma known error helper — `code` field 가 known request error 의 식별자.
// PersonService.getPrismaErrorCode() 가 duck typing 으로 인식. Prisma 의 실
// `PrismaClientKnownRequestError` 클래스 인스턴스 생성 cost 를 회피하고
// 동등한 shape 의 plain Error 로 충분 (smoke / e2e 가 이 패턴을 이미 채택 중).
export function buildPrismaError(
  code: string,
  message = "prisma-error",
): Error {
  return Object.assign(new Error(message), { code });
}
