// WebModule (T-0354, ADR-0040 §3) — 운영에서 monolithic NestJS process (ADR-0003) 가
// web/dist/ SPA build 산출물을 정적 serve 하고, 비-/api/* 경로의 SPA fallback
// (index.html) 을 처리한다 (REQ-038 전달 경로 + REQ-048 same-origin).
//
// dist 부재 분기: CI / dev 환경에는 web/dist 가 없다 (gitignore, web build 는 slice 3
// 전까지 CI 에 없음). 이때 ServeStaticModule 등록을 0 으로 두어 부팅·smoke·e2e 가
// 무변경 green 이어야 한다 — 분기를 exported helper (resolveServeStaticOptions) 로
// 분리해 unit-testable 하게 유지한다 (R-112, 같은 파일 안 — 파일 수 cap).
//
// 경로 해석은 process.cwd() 기준: 배포·테스트 모두 repo root 에서 실행되며
// (deployment.md monolith 운영), __dirname 은 ts-jest (src/web) 와 nest build
// (dist/src/web) 사이에서 depth 가 달라 불안정하다.
import { existsSync } from "fs";
import { join } from "path";

import { Module } from "@nestjs/common";
import { ServeStaticModule } from "@nestjs/serve-static";

// SPA build 산출물 위치 (ADR-0040 §4 — web/dist, gitignore 대상).
export const WEB_DIST_PATH = join(process.cwd(), "web", "dist");

// serve-static v4 (path-to-regexp 구문) 의 /api/* 제외 패턴 — backend 는 /api/*
// namespace 소유 (ADR-0040 §2). controller route 가 우선이라 GET /api 자체는
// AppController 가 처리하고, 본 exclude 는 fallback 의 /api/* 오염만 차단한다.
export const API_EXCLUDE_PATTERN = "/api/(.*)";

// dist 존재/부재 분기 helper. index.html 까지 존재할 때만 ServeStatic 옵션 1개를
// 반환하고, 그 외 (경로 부재 · index.html 부재 · 빈/비정상 경로) 는 throw 없이
// 빈 배열을 반환한다 — WebModule imports 가 그대로 0 등록이 된다.
export function resolveServeStaticOptions(
  distPath: string,
): Array<{ rootPath: string; exclude: string[] }> {
  // 빈 문자열·falsy 입력 가드 — join("", "index.html") 이 cwd 상대 경로로 오인
  // 매칭되는 것을 차단한다.
  if (!distPath) {
    return [];
  }
  // SPA fallback 의 실체는 index.html — dist 디렉토리만 있고 index.html 이 없으면
  // serve 할 대상이 없으므로 등록하지 않는다. existsSync 는 비정상 경로(NUL 문자 등)
  // 에서도 throw 없이 false 를 돌려준다.
  if (!existsSync(join(distPath, "index.html"))) {
    return [];
  }
  return [{ rootPath: distPath, exclude: [API_EXCLUDE_PATTERN] }];
}

@Module({
  // dist 존재 시 ServeStaticModule 1개 등록, 부재 시 빈 imports (등록 0).
  imports: resolveServeStaticOptions(WEB_DIST_PATH).map((options) =>
    ServeStaticModule.forRoot(options),
  ),
})
export class WebModule {}
