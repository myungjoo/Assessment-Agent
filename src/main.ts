// 애플리케이션 진입점. NestJS 표준 부트스트랩 패턴.
// 외부 의존성(`@nestjs/config` 등)은 의도적으로 도입하지 않음 (T-0004 Out of Scope).
import { NestFactory } from "@nestjs/core";

import { AppModule } from "./app.module";

// 기본 포트. env.PORT 가 있고 유효한 양수면 그것을 사용, 그 외에는 3000.
const DEFAULT_PORT = 3000;

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  // env 변수 파싱은 단순 패턴: 유효한 양수만 통과, 나머지는 fallback.
  const parsedPort = Number.parseInt(process.env.PORT ?? "", 10);
  const port =
    Number.isFinite(parsedPort) && parsedPort > 0 ? parsedPort : DEFAULT_PORT;
  await app.listen(port);
}

// 본 파일이 직접 실행될 때만 부트스트랩한다 (test 에서 import 시 side effect 방지).
if (require.main === module) {
  void bootstrap();
}
