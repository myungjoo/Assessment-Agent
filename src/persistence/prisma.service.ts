// PrismaService — PrismaClient 를 NestJS lifecycle 에 결합한 thin extension.
// T-0033 acceptance C 의 §83 / §85 / §88 항목 충족: onModuleInit 의 $connect /
// enableShutdownHooks 의 beforeExit listener 등록.
//
// Prisma 7.x 모델 (HQ-0004 `accept-latest-stable`):
//   - PrismaClient 가 직접 connection string 을 모르는 driver-only 구조.
//   - `@prisma/adapter-pg` 의 PrismaPg 가 DATABASE_URL 을 받아 pg Pool 을 생성.
//   - adapter instance 를 PrismaClient 생성자 옵션으로 주입.
//
// 본 service 는 도메인 별 query 메서드를 일절 노출하지 않는다 — Person 의 CRUD 는
// T-0034 의 책임 (Out of Scope).
import {
  Injectable,
  Logger,
  OnModuleInit,
  type INestApplication,
} from "@nestjs/common";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

// PrismaPg adapter 를 DATABASE_URL 환경변수로 구성하는 factory.
// 빈 문자열일 경우 PrismaPg 의 connection 시점 (실제 query 시) 에 실패 — fail-fast.
// 분리: factory 를 export 하여 spec 에서 mock injection 가능.
export function buildPrismaAdapter(): PrismaPg {
  return new PrismaPg({ connectionString: process.env.DATABASE_URL ?? "" });
}

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    // adapter 를 PrismaClient 에 inject — Prisma 7.x 의 driver-only 모델 요건.
    super({ adapter: buildPrismaAdapter() });
  }

  // NestJS module lifecycle 의 init 단계에서 DB connection 을 establish.
  // 실패 (예: DATABASE_URL 미설정 / 네트워크 unreachable) 시 error 가 그대로
  // propagate 되어 app 부팅이 중단됨 — fail-fast 정책.
  async onModuleInit(): Promise<void> {
    await this.$connect();
    this.logger.log("Prisma client connected");
  }

  // NestJS app 의 정상 종료를 PrismaClient 의 beforeExit event 에 결합.
  // 의도: process 가 SIGTERM / SIGINT 등으로 종료 시점에 in-flight query 가
  // graceful 하게 종료되고 connection 이 close 되도록 한다.
  // Prisma 7.x 의 PrismaClient typing 이 `beforeExit` literal 만 허용하지 않을 수
  // 있어 (this as any) 우회 — 분기 1 (hook 등록 성공) vs 분기 2 (등록 실패) 모두 cover.
  enableShutdownHooks(app: INestApplication): void {
    // $on('beforeExit', ...) 는 Prisma 의 extension API.
    // listener 안에서 app.close() 를 호출 → NestJS lifecycle 정상 종료.
    (
      this as unknown as {
        $on: (event: "beforeExit", cb: () => Promise<void>) => void;
      }
    ).$on("beforeExit", async () => {
      this.logger.log("Prisma beforeExit received — closing Nest application");
      await app.close();
    });
  }
}
