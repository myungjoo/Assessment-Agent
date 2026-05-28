// 애플리케이션 진입점. NestJS 표준 부트스트랩 패턴.
// 외부 의존성(`@nestjs/config` 등)은 의도적으로 도입하지 않음 (T-0004 Out of Scope).
// PORT env parsing 의 분기 로직은 ./parse-port 로 분리 — main.ts 자체는
// CLAUDE.md §3.2 R-112 entrypoint 예외 정책에 따라 coverage / spec-presence
// 제외이지만, 분기 있는 helper 는 R-112 negative cases 충분 cover 의무.
//
// T-0082 추가 — cookie-parser middleware wire (ADR-0008 Decision §2 박제 정합).
// AuthController 의 login / refresh endpoint 가 req.cookies.refresh_token 를 read,
// logout endpoint 가 res.clearCookie 호출 — cookie-parser 가 req.cookies 파싱.
// res.cookie / res.clearCookie 자체는 express 4.x native API (middleware 불요)
// 이나, req.cookies 의 자동 parsing 만 cookie-parser 책임. middleware wire 만
// 추가, 분기 helper 0 — R-112 entrypoint 예외 정책 정합 유지.
import { NestFactory } from "@nestjs/core";
import cookieParser from "cookie-parser";

import { AppModule } from "./app.module";
import { parsePort } from "./parse-port";

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  // cookie-parser middleware — req.cookies 자동 parsing. ADR-0008 Decision §2 의
  // HttpOnly + Secure + SameSite=Strict cookie 흐름의 read-side backbone.
  app.use(cookieParser());
  const port = parsePort(process.env.PORT);
  await app.listen(port);
}

// 본 파일이 직접 실행될 때만 부트스트랩한다 (test 에서 import 시 side effect 방지).
if (require.main === module) {
  void bootstrap();
}
