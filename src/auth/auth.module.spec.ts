// AuthModule spec — T-0081 acceptance §B 박제 + T-0082 갱신 (AuthModule 이
// UserModule import 로 인해 PrismaService 의존성 추가 — PersistenceModule 도 함께
// import 의무, user.module.spec 정공 패턴). CI scripts/check-spec-presence.sh 의
// spec-presence rule 충족 + module compile + provider/exports 정합성 검증.
//
// 본 spec 은 JwtModule.registerAsync 의 useFactory 가 process.env.AUTH_JWT_SECRET
// 을 read 하는 boundary 를 spec env 로 isolation. PassportModule 의 strategy
// registration 표면은 본 task scope 밖 (T-0083 책임) — 단순 import 정합만 검증.
import { JwtService } from "@nestjs/jwt";
import { Test, type TestingModule } from "@nestjs/testing";

import { PersistenceModule } from "../persistence/persistence.module";
import { PrismaService } from "../persistence/prisma.service";

import { AuthModule } from "./auth.module";
import { AuthService } from "./auth.service";

// PrismaService mock — UserModule 의 repository 들이 PrismaService 를 inject 하지만,
// 본 spec 의 검증 표면은 AuthModule wiring (AuthService + JwtService) 정합 — DB
// 실연결 불필요. PersistenceModule 의 PrismaService 를 override 로 sentinel 대체.
function buildPrismaServiceMock(): Partial<PrismaService> {
  return {
    onModuleInit: jest.fn().mockResolvedValue(undefined),
    enableShutdownHooks: jest.fn(),
  };
}

describe("AuthModule", () => {
  // env 복원 — JwtModule.registerAsync useFactory 가 module init 시점에 한 번 read.
  let originalAccessSecret: string | undefined;

  beforeEach(() => {
    originalAccessSecret = process.env.AUTH_JWT_SECRET;
    process.env.AUTH_JWT_SECRET =
      "spec-access-secret-32bytes-min-length-abcdef";
  });

  afterEach(() => {
    if (originalAccessSecret === undefined) {
      delete process.env.AUTH_JWT_SECRET;
    } else {
      process.env.AUTH_JWT_SECRET = originalAccessSecret;
    }
  });

  it("compile 시 AuthService provider 가 resolve 된다 (happy)", async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [PersistenceModule, AuthModule],
    })
      .overrideProvider(PrismaService)
      .useValue(buildPrismaServiceMock())
      .compile();

    const service = moduleRef.get(AuthService);
    expect(service).toBeDefined();
    expect(service).toBeInstanceOf(AuthService);

    await moduleRef.close();
  });

  it("compile 시 JwtService 가 module 내부에서 inject 가능 (happy — JwtModule wiring)", async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [PersistenceModule, AuthModule],
    })
      .overrideProvider(PrismaService)
      .useValue(buildPrismaServiceMock())
      .compile();

    // AuthService 가 JwtService 를 의존성으로 받음 — module 안의 JwtService 가
    // resolve 되어야 AuthService 가 정상 생성됨. 간접 검증.
    const service = moduleRef.get(AuthService);
    expect(service).toBeDefined();
    // JwtService 자체도 module-scoped 으로 resolve.
    const jwt = moduleRef.get(JwtService);
    expect(jwt).toBeDefined();

    await moduleRef.close();
  });

  it("AuthService provider 가 sentinel 로 override 되어도 compile (branch — exports 등록 간접 검증)", async () => {
    const sentinel = { __sentinel: "auth-service-override" };
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [PersistenceModule, AuthModule],
    })
      .overrideProvider(PrismaService)
      .useValue(buildPrismaServiceMock())
      .overrideProvider(AuthService)
      .useValue(sentinel)
      .compile();

    const resolved = moduleRef.get(AuthService);
    expect(resolved).toBe(sentinel);

    await moduleRef.close();
  });

  it("AUTH_JWT_SECRET 미설정 시에도 compile 한다 (negative — env missing fallback)", async () => {
    // useFactory 의 `?? ""` fallback 박제 검증 — module init 자체는 throw 안 함.
    // 실 환경에서는 ConfigModule + Joi schema 가 boot 단계에서 reject 의무 (T-0084).
    delete process.env.AUTH_JWT_SECRET;

    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [PersistenceModule, AuthModule],
    })
      .overrideProvider(PrismaService)
      .useValue(buildPrismaServiceMock())
      .compile();

    const service = moduleRef.get(AuthService);
    expect(service).toBeDefined();

    await moduleRef.close();
  });
});
