// smoke = 빠른 healthcheck. "app 이 부트스트랩되고 핵심 endpoint 가 200 을 돌려준다" 만 확인.
// flow 검증·응답 형태 deep-check·다단계 시나리오는 e2e (T-0010) 의 책임.
// 본 spec 은 README 113 / CLAUDE.md §3.2 R-113 의 smoke 부분을 충족하기 위한 첫 sample.
//
// 격리: 본 파일은 `.smoke-spec.ts` suffix 로 unit jest 의 testRegex (`.*\.spec\.ts$`) 와
// 충돌하지 않으며, package.json 의 jest.testPathIgnorePatterns 에 `test/smoke/` 가
// 추가돼 있어 `pnpm test` / `pnpm test:cov` 실행 시에는 본 파일이 picking 되지 않는다.
import type { INestApplication } from "@nestjs/common";
import { Test, type TestingModule } from "@nestjs/testing";
import request from "supertest";

import { AppModule } from "../../src/app.module";
import { APP_STATUS_MESSAGE } from "../../src/app.service";

describe("Smoke: AppModule bootstrap", () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  // Happy-path: sanity endpoint 가 200 + AppService.getStatus() 결과 (APP_STATUS_MESSAGE) 반환.
  // T-0354: ADR-0040 §2 경계에 따라 GET / → GET /api 로 이전 (path 동기).
  // anchor 로 src 의 export 상수를 직접 import — 향후 message 변경 시 본 spec 이 자동 동기화.
  it("GET /api returns 200 with expected body", async () => {
    const response = await request(app.getHttpServer()).get("/api");
    expect(response.status).toBe(200);
    expect(response.text).toBe(APP_STATUS_MESSAGE);
  });

  // Error path: 존재하지 않는 endpoint 는 404 — Nest 의 기본 not-found 핸들러 동작 확인.
  // smoke 인프라가 "fail 도 정상적으로 잡는다" 의 sanity 가 됨.
  // (CI/dev 는 web/dist 부재 → WebModule 등록 0 — SPA fallback 없이 404 유지, T-0354)
  it("GET /__not_exists__ returns 404", async () => {
    const response = await request(app.getHttpServer()).get("/__not_exists__");
    expect(response.status).toBe(404);
  });
});
