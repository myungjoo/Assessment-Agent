// GithubModule spec — T-0178 (CI scripts/check-spec-presence.sh 가 신규 production
// .ts 에 동반 spec 의무를 강제). GithubAdapter provider 가 module 안에서 resolve 되고
// export 되는지 + 권한 거부 영속화 emitter wiring(T-0211)을 검증한다. llm.module.spec.ts
// 패턴 mirror — module compile + provider resolve + exports 등록 정합성만 검증
// (adapter 의 instance 동작 unit 은 별도 github-adapter.service.spec.ts 책임).
//
// T-0211 이후 GithubModule 이 PermissionDeniedRecordModule 을 imports 하면서
// PermissionDeniedRecordRepository → PrismaService 의 전이 의존이 생겼다. PrismaService
// 는 @Global() PersistenceModule 이 export 하므로 본 spec 도 그 module 을 함께 imports
// 하고, PrismaService 의 super() 부작용(PrismaClient 생성/connect)은 jest.mock 으로
// 회피한다(llm.module.spec.ts 와 동일 패턴).

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
import { LlmApiKeyCipher } from "../llm/llm-apikey-cipher.service";
// eslint-disable-next-line import/first
import { PermissionDeniedRecordService } from "../permission-denied/permission-denied-record.service";
// eslint-disable-next-line import/first
import { PersistingPermissionDeniedEmitter } from "../permission-denied/persisting-permission-denied-emitter";
// eslint-disable-next-line import/first
import { PersistenceModule } from "../persistence/persistence.module";

// eslint-disable-next-line import/first
import {
  GithubAdapter,
  PERMISSION_DENIED_EMITTER,
  type PermissionDeniedEmitter,
} from "./github-adapter.service";
// eslint-disable-next-line import/first
import { GithubInstanceClient } from "./github-instance-client.service";
// eslint-disable-next-line import/first
import { GithubModule } from "./github.module";

describe("GithubModule", () => {
  // Happy path: PersistenceModule(@Global, mocked PrismaService) 와 함께 imports 하면
  // GithubAdapter 가 정상 resolve 된다(@Optional 생성자 + 실 emitter token 주입).
  it("compile 시 GithubAdapter provider 가 resolve 된다", async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [PersistenceModule, GithubModule],
    }).compile();

    const adapter = moduleRef.get(GithubAdapter);
    expect(adapter).toBeDefined();
    expect(adapter).toBeInstanceOf(GithubAdapter);

    await moduleRef.close();
  });

  // Branch: GithubAdapter 를 외부 sentinel 로 override 해도 module 이 compile.
  // exports 가 정상 등록되어 외부 module 이 inject 가능함의 간접 검증.
  it("GithubAdapter provider 가 sentinel 로 override 되어도 compile 한다", async () => {
    const sentinel = { __sentinel: "github-adapter-override" };
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [PersistenceModule, GithubModule],
    })
      .overrideProvider(GithubAdapter)
      .useValue(sentinel)
      .compile();

    const resolved = moduleRef.get(GithubAdapter);
    expect(resolved).toBe(sentinel);

    await moduleRef.close();
  });

  // DI resolve regression guard (T-0180 round-2 [M1]). GithubInstanceClient 생성자는
  // GithubAdapter + LlmApiKeyCipher + @Optional() NodeJS.ProcessEnv 를 inject 받는다.
  // env 는 reflection 상 Object token 으로 흘러 NestJS 가 provider 를 못 찾는데,
  // @Optional() 덕에 undefined 로 resolve 된다(서비스가 default process.env 로 fallback).
  // 회귀 가드: 누군가 @Optional() 을 떼면(env DI resolve 실패) 또는
  // GithubInstanceClient / LlmApiKeyCipher provider 등록을 빠뜨리면 본 test 가 fail 한다.
  it("compile 시 GithubInstanceClient / LlmApiKeyCipher provider 가 DI 로 resolve 된다", async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [PersistenceModule, GithubModule],
    }).compile();

    // GithubInstanceClient 가 @Optional() env 와 함께 정상 resolve 되어야 한다.
    const client = moduleRef.get(GithubInstanceClient);
    expect(client).toBeDefined();
    expect(client).toBeInstanceOf(GithubInstanceClient);

    // LlmApiKeyCipher provider 도 module 안에서 resolve 되어야 client 주입이 성립한다.
    const cipher = moduleRef.get(LlmApiKeyCipher);
    expect(cipher).toBeDefined();
    expect(cipher).toBeInstanceOf(LlmApiKeyCipher);

    await moduleRef.close();
  });

  // 권한 거부 영속화 emitter wiring (T-0211, ADR-0022 chain row 3). PERMISSION_DENIED_
  // EMITTER token 이 실 영속화 emitter(PersistingPermissionDeniedEmitter)로 resolve 되고,
  // 그 emitter 가 PermissionDeniedRecordService(PermissionDeniedRecordModule import)를
  // inject 받아 record 로 흘려보내는지를 검증한다. 회귀 가드: 누군가 module import /
  // token provide 를 빠뜨리면 본 test 가 fail 한다.
  it("PERMISSION_DENIED_EMITTER token 이 실 영속화 emitter 로 resolve 되어 record 로 forward 한다 (happy — emitter DI wiring)", async () => {
    // 실 PermissionDeniedRecordService 를 record spy 로 override — emitter→service
    // 결선만 검증한다(record 호출 여부 + 정규화 매핑).
    const recordSpy = jest.fn().mockResolvedValue({ id: "pdr-di" });
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [PersistenceModule, GithubModule],
    })
      .overrideProvider(PermissionDeniedRecordService)
      .useValue({ record: recordSpy, list: jest.fn() })
      .compile();

    // token 이 실 영속화 emitter 로 resolve 되어야 한다(no-op 아님).
    const emitter = moduleRef.get<PermissionDeniedEmitter>(
      PERMISSION_DENIED_EMITTER,
    );
    expect(emitter).toBeInstanceOf(PersistingPermissionDeniedEmitter);

    // emit → record 로 정규화 forward(host→instanceRef, path→resourceRef, provider github).
    emitter.emit({
      host: "github.sec.samsung.net",
      path: "/repos/acme/widget/commits",
      status: 403,
    });
    await Promise.resolve();

    expect(recordSpy).toHaveBeenCalledTimes(1);
    expect(recordSpy).toHaveBeenCalledWith({
      provider: "github",
      instanceRef: "github.sec.samsung.net",
      resourceRef: "/repos/acme/widget/commits",
      httpStatus: 403,
    });

    await moduleRef.close();
  });

  // GithubAdapter 가 token 으로 실 emitter 를 주입받는지 — adapter 의 permission-denied
  // 401/403 경로가 그 emitter 를 통해 record 로 영속화됨의 DI-level 증명. adapter 의
  // fetchFn 은 token 이 없어 module 로 주입 불가하므로, module 이 resolve 한 token-emitter
  // 가 no-op 가 아닌 실 emitter 임을 확인한다(no-op default 분기가 아님).
  it("GithubModule 이 resolve 한 GithubAdapter 는 no-op 가 아닌 실 영속화 emitter 를 주입받는다 (branch — token 주입 vs no-op default)", async () => {
    const recordSpy = jest.fn().mockResolvedValue({ id: "pdr-adapter" });
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [PersistenceModule, GithubModule],
    })
      .overrideProvider(PermissionDeniedRecordService)
      .useValue({ record: recordSpy, list: jest.fn() })
      .compile();

    // adapter 가 정상 resolve(실 emitter 주입에도 crash 0).
    const adapter = moduleRef.get(GithubAdapter);
    expect(adapter).toBeInstanceOf(GithubAdapter);

    // token 으로 resolve 한 emitter 가 실 영속화 emitter 임을 재확인(adapter 가 동일
    // token 으로 같은 provider 를 주입받는다 — no-op default 분기가 아님).
    const injected = moduleRef.get<PermissionDeniedEmitter>(
      PERMISSION_DENIED_EMITTER,
    );
    expect(injected).toBeInstanceOf(PersistingPermissionDeniedEmitter);

    await moduleRef.close();
  });
});
