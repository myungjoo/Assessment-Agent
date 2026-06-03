// ConfluenceModule spec — T-0184 (CI scripts/check-spec-presence.sh 가 신규
// production .ts 에 동반 spec 의무를 강제). CONFLUENCE_INSTANCES provider 가 module
// 안에서 resolve 되고 export 되는지 검증한다. github.module.spec.ts / llm.module.spec.ts
// 패턴 mirror — module compile + provider resolve + exports 등록 정합성만 검증
// (env→config 변환 unit 은 별도 confluence-instance-config.spec.ts 책임).
//
// CONFLUENCE_INSTANCES 는 resolveConfluenceInstances(process.env) 의 useFactory 라
// 외부 provider wiring 없이 ConfluenceModule 단독으로 compile 된다(adapter leaf,
// Prisma dep 0 → PersistenceModule import 불요).
import { Test, type TestingModule } from "@nestjs/testing";

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

  // Happy path: ConfluenceModule 단독 imports 로 CONFLUENCE_INSTANCES provider 가
  // 정상 resolve 된다. CONFLUENCE_INSTANCES env 미설정 시 빈 배열(활성 0)이 주입된다.
  it("compile 시 CONFLUENCE_INSTANCES provider 가 빈 배열로 resolve 된다(env 미설정)", async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [ConfluenceModule],
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
      imports: [ConfluenceModule],
    }).compile();

    const instances = moduleRef.get(CONFLUENCE_INSTANCES);
    expect(instances).toHaveLength(1);
    expect(instances[0].key).toBe("cloud");
    expect(instances[0].baseUrl).toBe(
      "https://acme.atlassian.net/wiki/rest/api",
    );

    await moduleRef.close();
  });

  // exports 정합: CONFLUENCE_INSTANCES 를 sentinel 로 override 해도 module 이
  // compile 되고 그 sentinel 이 resolve 됨 — export 가 정상 등록되어 외부 module 이
  // inject 가능함의 간접 검증.
  it("CONFLUENCE_INSTANCES provider 가 sentinel 로 override 되어도 compile 한다", async () => {
    const sentinel = [{ __sentinel: "confluence-instances-override" }];
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [ConfluenceModule],
    })
      .overrideProvider(CONFLUENCE_INSTANCES)
      .useValue(sentinel)
      .compile();

    const resolved = moduleRef.get(CONFLUENCE_INSTANCES);
    expect(resolved).toBe(sentinel);

    await moduleRef.close();
  });
});
