// e2e = 응답 contract (status + header + body shape) + flow 검증.
// 빠른 healthcheck 는 smoke (T-0009). 본 spec 은 동일 endpoint 라도 smoke 보다
// assertion 을 더 풍성하게 두어 "응답 형태가 spec 대로다" 의 회귀 anchor 역할.
//
// 격리: 본 파일은 `.e2e-spec.ts` suffix 로 unit jest 의 testRegex (`.*\.spec\.ts$`)
// 와 smoke 의 testRegex (`.*\.smoke-spec\.ts$`) 양쪽 모두에 잡히지 않으며,
// package.json 의 jest.testPathIgnorePatterns 에 `test/e2e/` 가 추가돼 있어
// `pnpm test` / `pnpm test:cov` 실행 시에도 본 파일이 picking 되지 않는다.
// 본 spec 은 README 113 / CLAUDE.md §3.2 R-113 의 e2e 부분을 충족하는 첫 sample.
import type { INestApplication } from "@nestjs/common";
import request from "supertest";

import { APP_STATUS_MESSAGE } from "../../src/app.service";
import { createE2EApp } from "../helpers/e2e-app-factory";

describe("E2E: AppModule HTTP contract", () => {
  let app: INestApplication;

  beforeAll(async () => {
    // 부트스트랩 + applyGlobalMiddleware wire 는 createE2EApp 책임 (T-0090 박제).
    const created = await createE2EApp();
    app = created.app;
  });

  afterAll(async () => {
    await app.close();
  });

  // Happy-path: GET / 가 status 200 + content-type text/html (Nest default) +
  // body 가 정확히 APP_STATUS_MESSAGE 임을 모두 검증. smoke 보다 한 단계 더 깊이
  // 응답 contract 를 묶어 둔다 (3 가지 assertion).
  it("GET / returns 200 with text/html and exact body", async () => {
    const response = await request(app.getHttpServer()).get("/");
    expect(response.status).toBe(200);
    expect(response.headers["content-type"]).toMatch(/text\/html/);
    expect(response.text).toBe(APP_STATUS_MESSAGE);
  });

  // Error path: 존재하지 않는 endpoint 는 Nest 기본 404 핸들러가 JSON 응답을 돌려준다.
  // status + body 의 `statusCode: 404` 필드 둘 다 검증해 contract 회귀를 잡는다.
  it("GET /__not_exists_e2e__ returns 404 with json error body", async () => {
    const response = await request(app.getHttpServer()).get(
      "/__not_exists_e2e__",
    );
    expect(response.status).toBe(404);
    expect(response.body).toMatchObject({ statusCode: 404 });
  });
});
