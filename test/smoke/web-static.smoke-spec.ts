// web-static.smoke-spec.ts — WebModule (T-0354, ADR-0040 §3) 의 serve-static 실
// serve / SPA fallback / `/api/*` exclude 동작을 회귀 가드하는 통합 smoke spec
// (T-0406 — T-0355 잔여 ①, T-0354 reviewer M1). CLAUDE.md §3.2 R-113 정합.
//
// 책임 (smoke vs unit 책임 경계):
//   - 본 spec 은 ServeStaticModule 이 실제 부팅 경로에서 web/dist/index.html 을
//     serve 하고, 비-/api/* 경로의 SPA fallback (index.html 반환) 과 controller
//     route 우선 (GET /api) + `/api/*` exclude (404, static fallback 비가로채기)
//     의 실 HTTP 동작을 cover 한다 (happy / flow / sanity / negative).
//   - resolveServeStaticOptions 의 분기 단위 검증 (dist 존재/부재/절반-build/빈
//     입력 등) 은 src/web/web.module.spec.ts 의 unit test 책임 — 본 spec 은 실
//     부팅 layer 의 통합 검증만.
//
// 핵심 제약 (T-0354 executor note 박제):
//   - `Test.createTestingModule().compile()` 경로는 serve-static 을 NoopLoader 로
//     등록해 실제 static serve 가 일어나지 않는다. 따라서 본 spec 은 반드시
//     `NestFactory.create(AppModule)` 실 부팅 경로를 써야 serve-static 이 실제로
//     동작한다 (다른 smoke spec 의 compile() 패턴과 의도적으로 다름).
//
// dist 존재/부재 2 분기 guard (AC):
//   - web/dist/index.html 부재 시 (로컬 미빌드 환경) 본 describe 의 실 검증
//     케이스 전체를 skip 해 green 유지. 존재 시 (CI 는 T-0405 web build step 이
//     선행하므로 항상 존재) 실 검증 케이스를 실행한다 — 양 분기 모두 spec 안에
//     명시 (branch cover).
//
// 격리: 본 파일은 `.smoke-spec.ts` suffix 로 unit jest 의 testRegex
// (`.*\.spec\.ts$`) 와 충돌하지 않으며, package.json 의 jest.testPathIgnorePatterns
// 에 `test/smoke/` 가 추가돼 있어 `pnpm test` / `pnpm test:cov` 실행 시 본 파일이
// picking 되지 않는다. test:smoke (jest-smoke.json testRegex `.*\.smoke-spec\.ts$`)
// 로 자동 pickup 된다 (R-113 — 별도 config 등록 불요).
import { existsSync } from "fs";
import { join } from "path";

import type { INestApplication } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import request from "supertest";

import { AppModule } from "../../src/app.module";
import { APP_STATUS_MESSAGE } from "../../src/app.service";
import { WEB_DIST_PATH } from "../../src/web/web.module";

// dist 존재/부재 2 분기의 판정 anchor — WebModule 의 resolveServeStaticOptions 와
// 동일한 index.html 존재 기준을 쓴다 (등록 분기와 1:1 동기). 부재 시 ServeStatic
// 등록 0 이므로 실 serve 케이스를 검증할 수 없어 skip 한다.
const distIndexExists = existsSync(join(WEB_DIST_PATH, "index.html"));

// jest 의 conditional describe — dist 존재 시 describe, 부재 시 describe.skip.
// 두 분기 모두 본 파일 안에 명시되어 branch cover (AC: dist 존재/부재 2 분기 guard).
const describeWhenDist = distIndexExists ? describe : describe.skip;

describeWhenDist(
  "Smoke: web-static serve-static (NestFactory 실 부팅, dist 존재)",
  () => {
    let app: INestApplication;

    beforeAll(async () => {
      // 반드시 NestFactory.create — compile() 의 NoopLoader 를 회피해 serve-static
      // 이 실제로 web/dist 를 mount 하도록 한다 (T-0354 executor note).
      app = await NestFactory.create(AppModule, { logger: false });
      await app.init();
    });

    afterAll(async () => {
      await app.close();
    });

    // Happy path: GET / 가 200 + web/dist/index.html 본문을 serve. SPA index 임을
    // 식별할 수 있는 안정 마커 (`<div id="root">`) 로 검증 — bundle 해시가 바뀌어도
    // 본 마커는 불변이라 flakiness 가 없다.
    it("GET / 는 200 + SPA index.html 을 serve 한다 (happy)", async () => {
      const response = await request(app.getHttpServer()).get("/");

      expect(response.status).toBe(200);
      expect(response.text).toContain('<div id="root">');
    });

    // Flow: 미지의 비-/api 경로 (GET /dashboard) 가 SPA fallback 으로 index.html
    // (200) 을 반환 — serve-static 의 client-side routing fallback 동작 검증.
    // 동일 index 마커를 확인해 fallback 이 root index 를 돌려줬음을 박제한다.
    it("GET /dashboard 는 SPA fallback 으로 index.html (200) 을 반환한다 (flow)", async () => {
      const response = await request(app.getHttpServer()).get("/dashboard");

      expect(response.status).toBe(200);
      expect(response.text).toContain('<div id="root">');
    });

    // Sanity: GET /api 는 여전히 AppController 의 APP_STATUS_MESSAGE (200) 를
    // 반환 — controller route 가 static fallback 보다 우선임을 검증. anchor 는
    // src 의 export 상수 직접 import (향후 message 변경 시 자동 동기).
    it("GET /api 는 controller route 우선으로 APP_STATUS_MESSAGE (200) 를 반환한다 (sanity)", async () => {
      const response = await request(app.getHttpServer()).get("/api");

      expect(response.status).toBe(200);
      expect(response.text).toBe(APP_STATUS_MESSAGE);
    });

    // Negative: GET /api/<없는 경로> 는 404 — API_EXCLUDE_PATTERN (`/api/(.*)`) 으로
    // 인해 static fallback 이 /api/* 를 가로채지 않음을 검증 (exclude 동작의
    // negative 가드). exclude 가 깨지면 본 요청이 SPA index (200) 로 흡수되어 본
    // 케이스가 fail 한다 — 회귀 가드의 핵심.
    it("GET /api/__none__ 는 static fallback 이 가로채지 않고 404 를 반환한다 (negative — exclude 가드)", async () => {
      const response = await request(app.getHttpServer()).get("/api/__none__");

      expect(response.status).toBe(404);
      // SPA index 마커가 응답에 없어야 함 — fallback 이 /api/* 를 삼키지 않았음을
      // 이중 박제 (status 404 + body 가 index 가 아님).
      expect(response.text).not.toContain('<div id="root">');
    });
  },
);

// dist 부재 분기의 명시 — 로컬 미빌드 환경에서 위 describe 가 skip 되었음을
// 기록으로 남긴다 (branch cover 의 두번째 분기). dist 존재 시에는 본 describe 가
// skip 되므로 어느 환경에서든 정확히 한 분기만 실행된다.
const describeWhenNoDist = distIndexExists ? describe.skip : describe;

describeWhenNoDist("Smoke: web-static (dist 부재 — 실 serve 검증 skip)", () => {
  // 로컬 미빌드 환경 가드: web/dist/index.html 부재 시 ServeStatic 등록 0 이므로
  // 실 serve 케이스를 검증할 수 없다. 본 케이스는 분기 자체를 명시적으로 박제해
  // "부재 환경에서도 spec 이 green" 임을 보장한다 (AC: dist 부재 시 skip).
  it("dist 부재 환경에서는 실 serve 검증을 skip 하고 green 을 유지한다 (branch — dist 부재)", () => {
    expect(distIndexExists).toBe(false);
  });
});
