// GithubModule spec — T-0178 (CI scripts/check-spec-presence.sh 가 신규 production
// .ts 에 동반 spec 의무를 강제). GithubAdapter provider 가 module 안에서 resolve 되고
// export 되는지 검증한다. llm.module.spec.ts 패턴 mirror — module compile + provider
// resolve + exports 등록 정합성만 검증(adapter 의 instance 동작 unit 은 별도
// github-adapter.service.spec.ts 책임).
//
// GithubAdapter 는 fetch / emitter 둘 다 @Optional 생성자 주입(Prisma dep 0)이라
// PersistenceModule import 없이 GithubModule 단독으로 compile 된다.
import { Test, type TestingModule } from "@nestjs/testing";

import { LlmApiKeyCipher } from "../llm/llm-apikey-cipher.service";

import { GithubAdapter } from "./github-adapter.service";
import { GithubInstanceClient } from "./github-instance-client.service";
import { GithubModule } from "./github.module";

describe("GithubModule", () => {
  // Happy path: GithubModule 단독 imports 로 GithubAdapter 가 정상 resolve 된다
  // (@Optional 생성자 덕에 외부 provider wiring 없이 default 로 자기충족).
  it("compile 시 GithubAdapter provider 가 resolve 된다", async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [GithubModule],
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
      imports: [GithubModule],
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
      imports: [GithubModule],
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
});
