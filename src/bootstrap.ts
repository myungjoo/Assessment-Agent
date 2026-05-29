// bootstrap.ts — production boot path + e2e Test.createTestingModule path 의
// 단일 middleware setup source.
//
// 책임 (T-0090 박제 — T-0087 within-round 2 fix push lesson 영구 외화):
//   - applyGlobalMiddleware(app) 가 production main.ts 와 test/helpers/e2e-app-factory.ts
//     양쪽에서 호출되어 middleware setup 의 1:1 정합 박제. middleware 추가 시 본
//     함수 1 곳만 갱신하면 production + e2e 양쪽 자동 동기.
//   - 현재 wire: cookie-parser (req.cookies parsing — ADR-0008 §2 의 HttpOnly +
//     Secure + SameSite=Strict cookie 흐름의 read-side backbone).
//
// T-0087 lesson 박제 cross-ref:
//   - T-0087 (fabeb40 MERGED) 의 within-round 2 fix push 에서 users.e2e-spec.ts 가
//     401 fail — Test.createTestingModule path 가 main.ts cookie-parser wire 를
//     bypass 하여 JwtStrategy.cookieExtractor (req.cookies?.[ACCESS_TOKEN_COOKIE])
//     가 null 반환 → passport-jwt 자동 401. inline app.use(cookieParser()) 1 라인
//     fix 로 7/7 green 복구했으나 본질적 결함은 양 path 의 분리 — 본 helper 가
//     영구 외화.
//
// Out of Scope (main.ts 책임 유지):
//   - NestFactory.create / app.listen / port parsing 0 — main.ts entrypoint 책임.
//   - 본 helper 는 middleware setup 만, 부트스트랩 lifecycle 자체는 caller 책임.
//
// 향후 추가 hook point:
//   - GlobalValidationPipe / Helmet / Cors / RequestId middleware 등 — 본 함수
//     내부에 1:1 박제. controller-scope ValidationPipe 의 global 전환은 별도 ADR.
import type { INestApplication } from "@nestjs/common";
import cookieParser from "cookie-parser";

export function applyGlobalMiddleware(app: INestApplication): void {
  // cookie-parser middleware — req.cookies 자동 parsing. ADR-0008 §2 의 HttpOnly +
  // Secure + SameSite=Strict cookie 흐름의 read-side backbone (JwtStrategy.cookieExtractor
  // 가 req.cookies?.[ACCESS_TOKEN_COOKIE] 로 token 추출 — 본 middleware 부재 시 모든
  // authenticated request 가 401).
  app.use(cookieParser());
  // 향후 추가 middleware (Helmet / Cors / GlobalValidationPipe 등) 는 본 함수 내부에 1:1 박제 — production + e2e 양쪽 자동 동기.
}
