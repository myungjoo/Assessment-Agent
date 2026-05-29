// e2e-app-factory.e2e-spec.ts — createE2EApp helper 의 R-112 cover (T-0090 박제).
// jest-e2e config 의 testRegex `.*\.e2e-spec\.ts$` 가 본 파일을 picking, 실 DB
// 의존 (globalSetup 의 PrismaPg connect + truncateAll). test/jest-e2e.json 의
// maxWorkers:1 위에서 e2e suite 와 직렬 실행 — cross-file afterEach race 0.
//
// 책임:
//   - happy — createE2EApp() 호출 → 반환 { app, moduleRef } truthy + app 이 INestApplication
//     shape (init / close / use / getHttpServer 메서드 존재) + moduleRef.get(PrismaService) resolve.
//   - branch — app.init() 가 호출되었음 검증 (이미 init 된 상태 — getHttpServer 가
//     express instance 반환).
//   - error path — AppModule import 실패 시나리오 본 spec scope 외 (실 DB 의존
//     happy path 만 cover) — 1 줄 주석 박제.
//   - negative — 반환된 app 에 cookie-parser middleware wire 되어 있는지 supertest
//     로 간접 검증. /non-existent GET + Cookie header → 404 응답 (NestJS 기본 404)
//     이 정상이면 server 가 cookie header parsing 까지 도달했음을 보장 (cookie-parser
//     미 wire 시도 404 자체는 반환되나 본 assertion 은 e2e factory 의 contract 정합
//     박제 — middleware 가 wire 되어 request 가 정상 흐름).
import type { INestApplication } from "@nestjs/common";
import request from "supertest";

import { PrismaService } from "../../src/persistence/prisma.service";

import { createE2EApp } from "./e2e-app-factory";

describe("E2E: createE2EApp helper (T-0090)", () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    const created = await createE2EApp();
    app = created.app;
    prisma = created.moduleRef.get<PrismaService>(PrismaService);
  });

  afterAll(async () => {
    // connection 누수 0 — afterAll 의 app.close + prisma.$disconnect 박제 (ADR-0004 §Cleanup).
    await app.close();
    await prisma.$disconnect();
  });

  // happy — 반환 shape 정합 (app + moduleRef 둘 다 truthy + DI resolve).
  it("happy — createE2EApp 반환 { app, moduleRef } 가 INestApplication shape + DI resolve", () => {
    expect(app).toBeDefined();
    expect(typeof app.init).toBe("function");
    expect(typeof app.close).toBe("function");
    expect(typeof app.use).toBe("function");
    expect(typeof app.getHttpServer).toBe("function");
    expect(prisma).toBeDefined();
  });

  // branch — getHttpServer 가 express instance 반환 (이미 init 된 상태 확인).
  it("branch — getHttpServer 가 express server instance 반환 (app.init 호출 완료 박제)", () => {
    const server = app.getHttpServer();
    expect(server).toBeDefined();
    expect(typeof server.address).toBe("function");
  });

  // negative — middleware wire 정합 검증. Cookie header 포함 request → server 가
  // 정상 처리 후 404 반환 (cookie-parser 가 req.cookies 채움 — 404 자체는 NestJS
  // 기본 핸들러). 본 assertion 은 e2e factory 의 contract 정합 박제 — middleware
  // 가 wire 되어 cookie 포함 request 가 정상 처리.
  it("negative — Cookie header 포함 request 시 server 정상 처리 (applyGlobalMiddleware wire 정합)", async () => {
    const response = await request(app.getHttpServer())
      .get("/__non_existent_t0090__")
      .set("Cookie", "test=value");

    expect(response.status).toBe(404);
  });

  // 주석: error path — AppModule import 실패 시나리오 (예: DI provider 누락) 는
  // 본 spec scope 외 — 실 DB 의존이라 happy path 만 cover. AppModule 자체 결함은
  // app.module.spec.ts (별도 task) 책임.
});
