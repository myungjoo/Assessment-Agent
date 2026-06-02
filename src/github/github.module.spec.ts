// GithubModule spec — T-0178 (CI scripts/check-spec-presence.sh 가 신규 production
// .ts 에 동반 spec 의무를 강제). GithubAdapter provider 가 module 안에서 resolve 되고
// export 되는지 검증한다. llm.module.spec.ts 패턴 mirror — module compile + provider
// resolve + exports 등록 정합성만 검증(adapter 의 instance 동작 unit 은 별도
// github-adapter.service.spec.ts 책임).
//
// GithubAdapter 는 fetch / emitter 둘 다 @Optional 생성자 주입(Prisma dep 0)이라
// PersistenceModule import 없이 GithubModule 단독으로 compile 된다.
import { Test, type TestingModule } from "@nestjs/testing";

import { GithubAdapter } from "./github-adapter.service";
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
});
