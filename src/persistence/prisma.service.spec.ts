// PrismaService spec — T-0033 acceptance C (R-112: happy / error / branch / negative 충족).
//
// 본 spec 은 PrismaService 가 PrismaClient 를 직접 instantiate (DB 연결 시도) 하지 않도록
// `@prisma/adapter-pg` 와 `@prisma/client` 의 PrismaClient 를 jest.mock 으로 대체한다.
// 의도: spec 이 PostgreSQL container 없이도 isolated 하게 실행되어야 함.

import type { INestApplication } from "@nestjs/common";

// PrismaPg mock — adapter constructor 가 호출 인자를 capture 만 하고 더미를 반환.
const prismaPgCtorSpy = jest.fn();
jest.mock("@prisma/adapter-pg", () => ({
  PrismaPg: jest.fn().mockImplementation((opts: unknown) => {
    prismaPgCtorSpy(opts);
    return { _kind: "PrismaPgMock", opts };
  }),
}));

// PrismaClient mock — extends 의 super() 호출이 실제 DB 연결을 시도하지 않도록.
// $connect / $on 의 호출 여부를 spec 에서 검증할 수 있도록 jest.fn 으로 만든다.
const connectSpy = jest.fn().mockResolvedValue(undefined);
const onSpy = jest.fn();
const ctorSpy = jest.fn();
jest.mock("@prisma/client", () => {
  return {
    PrismaClient: class MockPrismaClient {
      constructor(opts?: unknown) {
        ctorSpy(opts);
      }
      $connect = connectSpy;
      $on = onSpy;
    },
  };
});

// 본 import 는 위 mock 이 적용된 후 evaluate.
// eslint-disable-next-line import/first
import { PrismaService, buildPrismaAdapter } from "./prisma.service";

describe("buildPrismaAdapter()", () => {
  beforeEach(() => {
    prismaPgCtorSpy.mockClear();
    delete process.env.DATABASE_URL;
  });

  // Happy path: DATABASE_URL 이 set 되면 PrismaPg constructor 가 그 값으로 호출.
  it("DATABASE_URL 환경변수를 PrismaPg connectionString 으로 전달한다", () => {
    process.env.DATABASE_URL = "postgresql://u:p@h:5432/d?schema=public";
    const adapter = buildPrismaAdapter();
    expect(prismaPgCtorSpy).toHaveBeenCalledWith({
      connectionString: "postgresql://u:p@h:5432/d?schema=public",
    });
    expect(adapter).toBeDefined();
  });

  // Negative: DATABASE_URL 미설정 시 빈 문자열로 fallback (fail-fast 는 query 시점).
  it("DATABASE_URL 미설정 시 빈 문자열로 fallback 한다", () => {
    buildPrismaAdapter();
    expect(prismaPgCtorSpy).toHaveBeenCalledWith({ connectionString: "" });
  });

  // Negative: DATABASE_URL 이 빈 문자열일 때도 동일하게 빈 문자열 전달.
  it("DATABASE_URL 이 빈 문자열이면 빈 문자열을 그대로 전달한다", () => {
    process.env.DATABASE_URL = "";
    buildPrismaAdapter();
    expect(prismaPgCtorSpy).toHaveBeenCalledWith({ connectionString: "" });
  });
});

describe("PrismaService", () => {
  beforeEach(() => {
    connectSpy.mockClear();
    onSpy.mockClear();
    ctorSpy.mockClear();
    prismaPgCtorSpy.mockClear();
    process.env.DATABASE_URL = "postgresql://test:test@localhost:5432/test";
  });

  // Happy path: instance 생성 시 PrismaClient 가 adapter option 으로 호출됨.
  it("constructor 에서 PrismaClient 를 PrismaPg adapter 와 함께 instantiate 한다", () => {
    new PrismaService();
    expect(ctorSpy).toHaveBeenCalledTimes(1);
    const passed = ctorSpy.mock.calls[0]?.[0] as { adapter: unknown };
    expect(passed).toBeDefined();
    expect(passed.adapter).toBeDefined();
  });

  // Happy path: onModuleInit 이 $connect 를 호출.
  it("onModuleInit() 은 $connect 를 호출한다", async () => {
    const svc = new PrismaService();
    await svc.onModuleInit();
    expect(connectSpy).toHaveBeenCalledTimes(1);
  });

  // Error path: $connect 가 reject 하면 error 가 그대로 propagate.
  it("onModuleInit() 의 $connect 가 reject 하면 error 가 propagate 된다", async () => {
    connectSpy.mockRejectedValueOnce(new Error("db-unreachable"));
    const svc = new PrismaService();
    await expect(svc.onModuleInit()).rejects.toThrow("db-unreachable");
  });

  // Branch coverage: idempotent 호출 — onModuleInit 두 번 호출해도 정상 (Prisma 측 보장).
  // 분기 1: 첫 호출 (connect 성공) vs 분기 2: 재호출 (connect 재호출되어도 throw 없음).
  it("onModuleInit() 이 두 번 호출되어도 idempotent 하다 ($connect 가 두 번 호출됨)", async () => {
    const svc = new PrismaService();
    await svc.onModuleInit();
    await svc.onModuleInit();
    expect(connectSpy).toHaveBeenCalledTimes(2);
  });

  // Happy path + branch: enableShutdownHooks 가 $on('beforeExit', ...) 을 등록.
  it("enableShutdownHooks() 는 beforeExit listener 를 등록한다", () => {
    const svc = new PrismaService();
    const closeMock = jest.fn().mockResolvedValue(undefined);
    const app = { close: closeMock } as unknown as INestApplication;
    svc.enableShutdownHooks(app);
    expect(onSpy).toHaveBeenCalledTimes(1);
    expect(onSpy.mock.calls[0]?.[0]).toBe("beforeExit");
  });

  // Branch coverage: listener callback 자체를 invoke 하여 app.close() 가 호출되는지 검증.
  it("등록된 beforeExit listener 가 invoke 되면 app.close() 가 호출된다", async () => {
    const svc = new PrismaService();
    const closeMock = jest.fn().mockResolvedValue(undefined);
    const app = { close: closeMock } as unknown as INestApplication;
    svc.enableShutdownHooks(app);
    const cb = onSpy.mock.calls[0]?.[1] as () => Promise<void>;
    await cb();
    expect(closeMock).toHaveBeenCalledTimes(1);
  });

  // Negative: enableShutdownHooks 가 호출 안되면 $on 도 안불려야 함 (분기 2 — hook 미등록).
  it("enableShutdownHooks 미호출 시 $on 도 호출되지 않는다", () => {
    new PrismaService();
    expect(onSpy).not.toHaveBeenCalled();
  });
});
