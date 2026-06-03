// ConfluenceModule spec — T-0184 (CI scripts/check-spec-presence.sh 가 신규
// production .ts 에 동반 spec 의무를 강제). CONFLUENCE_INSTANCES provider 가 module
// 안에서 resolve 되고 export 되는지 + 권한 거부 영속화 emitter wiring(T-0212)을
// 검증한다. github.module.spec.ts / llm.module.spec.ts 패턴 mirror — module compile +
// provider resolve + exports 등록 정합성만 검증(env→config 변환 unit 은 별도
// confluence-instance-config.spec.ts 책임).
//
// T-0212 이후 ConfluenceModule 이 PermissionDeniedRecordModule 을 imports 하면서
// PermissionDeniedRecordRepository → PrismaService 의 전이 의존이 생겼다(이전엔 Prisma
// dep 0 였으나 emitter wiring 으로 변경). PrismaService 는 @Global() PersistenceModule 이
// export 하므로 본 spec 도 그 module 을 함께 imports 하고, PrismaService 의 super() 부작용
// (PrismaClient 생성/connect)은 jest.mock 으로 회피한다(github.module.spec.ts 동일 패턴).

// PrismaService 를 mock — PrismaClient extends 의 부작용(adapter 생성 / connect)을
// 회피. PermissionDeniedRecordRepository 가 permissionDeniedRecord delegate 를 쓰므로
// 그 delegate 와 lifecycle hook 을 stub 한다. 본 spec 은 instance 동작이 아닌 module
// compile + emitter wiring 만 검증.
jest.mock("../persistence/prisma.service", () => ({
  PrismaService: class MockPrismaService {
    permissionDeniedRecord = {
      create: jest.fn(),
      findMany: jest.fn(),
    };
    onModuleInit = jest.fn().mockResolvedValue(undefined);
    enableShutdownHooks = jest.fn();
  },
}));

// eslint-disable-next-line import/first
import { Test, type TestingModule } from "@nestjs/testing";

// eslint-disable-next-line import/first
import { PermissionDeniedRecordService } from "../permission-denied/permission-denied-record.service";
// eslint-disable-next-line import/first
import { PersistingConfluencePermissionDeniedEmitter } from "../permission-denied/persisting-confluence-permission-denied-emitter";
// eslint-disable-next-line import/first
import { PersistenceModule } from "../persistence/persistence.module";

// eslint-disable-next-line import/first
import {
  ConfluenceAdapter,
  CONFLUENCE_PERMISSION_DENIED_EMITTER,
  type PermissionDeniedEmitter,
} from "./confluence-adapter.service";
// eslint-disable-next-line import/first
import { ConfluenceSpaceTraversalService } from "./confluence-space-traversal.service";
// eslint-disable-next-line import/first
import { CONFLUENCE_INSTANCES, ConfluenceModule } from "./confluence.module";

describe("ConfluenceModule", () => {
  // 본 spec 은 process.env 를 직접 read 하는 useFactory 를 다루므로, 각 test 전후로
  // CONFLUENCE_* 키를 정리해 다른 test/순서 의존을 막는다.
  const savedEnv = process.env;
  beforeEach(() => {
    process.env = { ...savedEnv };
    for (const k of Object.keys(process.env)) {
      if (k.startsWith("CONFLUENCE_")) delete process.env[k];
    }
  });
  afterEach(() => {
    process.env = savedEnv;
  });

  // Happy path: PersistenceModule(@Global, mocked PrismaService) 와 함께 imports 하면
  // CONFLUENCE_INSTANCES provider 가 정상 resolve 된다. CONFLUENCE_INSTANCES env
  // 미설정 시 빈 배열(활성 0)이 주입된다.
  it("compile 시 CONFLUENCE_INSTANCES provider 가 빈 배열로 resolve 된다(env 미설정)", async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [PersistenceModule, ConfluenceModule],
    }).compile();

    const instances = moduleRef.get(CONFLUENCE_INSTANCES);
    expect(instances).toEqual([]);

    await moduleRef.close();
  });

  // Branch: env 에 활성 instance 가 설정되면 useFactory 가 그 config 를 resolve 해
  // provider 로 노출한다(env→provider 경로 정합 검증).
  it("env 에 활성 instance 가 있으면 useFactory 가 그 config 를 resolve 한다", async () => {
    process.env["CONFLUENCE_INSTANCES"] = "cloud";
    process.env["CONFLUENCE_CLOUD_BASE_URL"] =
      "https://acme.atlassian.net/wiki/rest/api";
    process.env["CONFLUENCE_CLOUD_TOKEN_ENC"] = "enc-fixture";

    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [PersistenceModule, ConfluenceModule],
    }).compile();

    const instances = moduleRef.get(CONFLUENCE_INSTANCES);
    expect(instances).toHaveLength(1);
    expect(instances[0].key).toBe("cloud");
    expect(instances[0].baseUrl).toBe(
      "https://acme.atlassian.net/wiki/rest/api",
    );

    await moduleRef.close();
  });

  // T-0187 wiring: ConfluenceAdapter provider 가 등록 + export 되어 module 안에서
  // resolve 된다. fetch 가 @Optional 주입(default 채움)이고 emitter 는 token 으로
  // 실 emitter 가 주입되어도 정상 인스턴스화된다 — 후속 row4/row5 가 inject 가능함의 검증.
  it("compile 시 ConfluenceAdapter provider 가 resolve 된다(@Optional default + token emitter 주입)", async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [PersistenceModule, ConfluenceModule],
    }).compile();

    const adapter = moduleRef.get(ConfluenceAdapter);
    expect(adapter).toBeInstanceOf(ConfluenceAdapter);

    await moduleRef.close();
  });

  // T-0189 wiring: ConfluenceSpaceTraversalService provider 가 등록 + export 되어
  // module 안에서 resolve 된다. ConfluenceAdapter + LlmApiKeyCipher 가 self-contained
  // provider 로 함께 등록되고 traversal 자신의 PermissionDeniedEmitter 는 @Optional
  // (no-op default — token 없는 positional param)이라 추가 provider 없이 인스턴스화된다
  // (본 task 의 token 도입은 adapter 만 — traversal 은 Out of Scope, regression 0).
  it("compile 시 ConfluenceSpaceTraversalService provider 가 resolve 된다(DI wiring)", async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [PersistenceModule, ConfluenceModule],
    }).compile();

    const traversal = moduleRef.get(ConfluenceSpaceTraversalService);
    expect(traversal).toBeInstanceOf(ConfluenceSpaceTraversalService);

    await moduleRef.close();
  });

  // exports 정합: CONFLUENCE_INSTANCES 를 sentinel 로 override 해도 module 이
  // compile 되고 그 sentinel 이 resolve 됨 — export 가 정상 등록되어 외부 module 이
  // inject 가능함의 간접 검증.
  it("CONFLUENCE_INSTANCES provider 가 sentinel 로 override 되어도 compile 한다", async () => {
    const sentinel = [{ __sentinel: "confluence-instances-override" }];
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [PersistenceModule, ConfluenceModule],
    })
      .overrideProvider(CONFLUENCE_INSTANCES)
      .useValue(sentinel)
      .compile();

    const resolved = moduleRef.get(CONFLUENCE_INSTANCES);
    expect(resolved).toBe(sentinel);

    await moduleRef.close();
  });

  // 권한 거부 영속화 emitter wiring (T-0212, ADR-0022 chain row 3, Confluence 측).
  // CONFLUENCE_PERMISSION_DENIED_EMITTER token 이 실 영속화 emitter
  // (PersistingConfluencePermissionDeniedEmitter)로 resolve 되고, 그 emitter 가
  // PermissionDeniedRecordService(PermissionDeniedRecordModule import)를 inject 받아
  // record 로 흘려보내는지를 검증한다. 회귀 가드: 누군가 module import / token provide 를
  // 빠뜨리면 본 test 가 fail 한다.
  it("CONFLUENCE_PERMISSION_DENIED_EMITTER token 이 실 영속화 emitter 로 resolve 되어 record 로 forward 한다 (happy — emitter DI wiring)", async () => {
    // 실 PermissionDeniedRecordService 를 record spy 로 override — emitter→service
    // 결선만 검증한다(record 호출 여부 + baseUrl→instanceRef 정규화 매핑).
    const recordSpy = jest.fn().mockResolvedValue({ id: "pdr-c-di" });
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [PersistenceModule, ConfluenceModule],
    })
      .overrideProvider(PermissionDeniedRecordService)
      .useValue({ record: recordSpy, list: jest.fn() })
      .compile();

    // token 이 실 영속화 emitter 로 resolve 되어야 한다(no-op 아님).
    const emitter = moduleRef.get<PermissionDeniedEmitter>(
      CONFLUENCE_PERMISSION_DENIED_EMITTER,
    );
    expect(emitter).toBeInstanceOf(PersistingConfluencePermissionDeniedEmitter);

    // emit → record 로 정규화 forward(baseUrl→instanceRef, path→resourceRef, provider confluence).
    emitter.emit({
      baseUrl: "https://acme.atlassian.net/wiki/rest/api",
      path: "/content",
      status: 403,
    });
    await Promise.resolve();

    expect(recordSpy).toHaveBeenCalledTimes(1);
    expect(recordSpy).toHaveBeenCalledWith({
      provider: "confluence",
      instanceRef: "https://acme.atlassian.net/wiki/rest/api",
      resourceRef: "/content",
      httpStatus: 403,
    });

    await moduleRef.close();
  });

  // ConfluenceAdapter 가 token 으로 실 emitter 를 주입받는지 — adapter 의 permission-
  // denied 401/403 경로가 그 emitter 를 통해 record 로 영속화됨의 DI-level 증명. adapter
  // 의 fetchFn 은 token 이 없어 module 로 주입 불가하므로, module 이 resolve 한 token-
  // emitter 가 no-op 가 아닌 실 emitter 임을 확인한다(no-op default 분기가 아님).
  it("ConfluenceModule 이 resolve 한 ConfluenceAdapter 는 no-op 가 아닌 실 영속화 emitter 를 주입받는다 (branch — token 주입 vs no-op default)", async () => {
    const recordSpy = jest.fn().mockResolvedValue({ id: "pdr-c-adapter" });
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [PersistenceModule, ConfluenceModule],
    })
      .overrideProvider(PermissionDeniedRecordService)
      .useValue({ record: recordSpy, list: jest.fn() })
      .compile();

    // adapter 가 정상 resolve(실 emitter 주입에도 crash 0).
    const adapter = moduleRef.get(ConfluenceAdapter);
    expect(adapter).toBeInstanceOf(ConfluenceAdapter);

    // token 으로 resolve 한 emitter 가 실 영속화 emitter 임을 재확인(adapter 가 동일
    // token 으로 같은 provider 를 주입받는다 — no-op default 분기가 아님).
    const injected = moduleRef.get<PermissionDeniedEmitter>(
      CONFLUENCE_PERMISSION_DENIED_EMITTER,
    );
    expect(injected).toBeInstanceOf(
      PersistingConfluencePermissionDeniedEmitter,
    );

    await moduleRef.close();
  });
});
