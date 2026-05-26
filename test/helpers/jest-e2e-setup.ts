// jest-e2e-setup.ts — jest `globalSetup` hook 의 source (T-0054).
//
// 책임: ./jest-smoke-setup.ts 의 default export 를 그대로 re-export. e2e config
// (test/jest-e2e.json) 가 본 파일을 globalSetup key 로 가리킨다.
//
// 재사용 사유 (ADR-0004 §Cleanup 정책 + T-0053 박제 패턴): PrismaClient connect +
// truncateAll + disconnect + DATABASE_URL fail-fast — smoke / e2e 의 globalSetup
// 책임이 동일 (test 간 격리 + dirty data 안전망).
//
// symmetry: test/jest-smoke.json → jest-smoke-setup.ts / test/jest-e2e.json →
// jest-e2e-setup.ts 의 1:1 대응 — 본 thin wrapper 가 향후 e2e 전용 분기 (예:
// e2e seed / 별도 schema 옵션) 도입 시 갈아끼울 hook point.
//
// 파일 경로 정책: jest 의 어떤 testRegex (`.*\.spec\.ts$` / `.*\.smoke-spec\.ts$` /
// `.*\.e2e-spec\.ts$`) 도 매칭하지 않는다. package.json 의
// collectCoverageFrom: [src/**/*] scope 밖이라 coverage 통계 영향 0.
export { default } from "./jest-smoke-setup";
