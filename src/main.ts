// 애플리케이션 진입점. NestJS 표준 부트스트랩 패턴.
// 외부 의존성(`@nestjs/config` 등)은 의도적으로 도입하지 않음 (T-0004 Out of Scope).
// PORT env parsing 의 분기 로직은 ./parse-port 로 분리 — main.ts 자체는
// CLAUDE.md §3.2 R-112 entrypoint 예외 정책에 따라 coverage / spec-presence
// 제외이지만, 분기 있는 helper 는 R-112 negative cases 충분 cover 의무.
import { NestFactory } from "@nestjs/core";

import { AppModule } from "./app.module";
import { parsePort } from "./parse-port";

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  const port = parsePort(process.env.PORT);
  await app.listen(port);
}

// 본 파일이 직접 실행될 때만 부트스트랩한다 (test 에서 import 시 side effect 방지).
if (require.main === module) {
  void bootstrap();
}
