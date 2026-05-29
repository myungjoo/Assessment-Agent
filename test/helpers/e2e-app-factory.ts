// e2e-app-factory.ts — e2e 부트스트랩 helper (T-0090 박제).
//
// 책임:
//   - Test.createTestingModule({ imports: [AppModule] }).compile() →
//     createNestApplication() → applyGlobalMiddleware(app) → app.init() 의 표준
//     e2e 부트스트랩 5 단계를 1 함수로 외화. 호출 측 e2e spec 은 createE2EApp()
//     1 줄로 부트스트랩 + middleware setup 양쪽 정합 자동 보장.
//   - applyGlobalMiddleware 호출 — production main.ts 와 동일 helper. middleware
//     추가 시 양 path 자동 동기 (T-0087 within-round 2 fix push lesson 영구 박제).
//
// T-0087 lesson cross-ref:
//   - users.e2e-spec.ts 의 inline app.use(cookieParser()) wire 가 7/7 green 회복의
//     1-line fix 였으나, 본 helper 가 cookie-parser 외 향후 추가될 모든 middleware
//     (Helmet / Cors / GlobalValidationPipe 등) 의 단일 source 박제.
//
// Out of Scope:
//   - JWT issue / cookie 형식 박제 / SuperAdmin/Admin/User 3 종 token 발급 0 —
//     T-0091 candidate (auth-e2e-helper) 책임. 본 helper 는 raw app + moduleRef 만.
//   - seed / truncate 0 — 호출 측 spec 의 beforeAll / afterEach 책임 (ADR-0004
//     §Cleanup truncateAll afterEach 정책).
//   - app.close + prisma.$disconnect 0 — 호출 측 spec 의 afterAll 책임. helper 가
//     close 까지 책임지면 multiple-test life cycle 의 timing 결합 발생.
import type { INestApplication } from "@nestjs/common";
import { Test, type TestingModule } from "@nestjs/testing";

import { AppModule } from "../../src/app.module";
import { applyGlobalMiddleware } from "../../src/bootstrap";

export async function createE2EApp(): Promise<{
  app: INestApplication;
  moduleRef: TestingModule;
}> {
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();
  const app = moduleRef.createNestApplication();
  applyGlobalMiddleware(app);
  await app.init();
  return { app, moduleRef };
}
