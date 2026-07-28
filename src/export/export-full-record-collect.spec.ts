// export-full-record-collect.spec — collectFullExportRecords 공용 helper 단위 test (T-1280,
// REQ-030 / REQ-032). 실 DB 0 — mock client 만 쓴다(PrismaService 인스턴스 · $transaction 0).
// R-112 4 종:
//   - happy: 5 delegate row → entity 별 평탄화 순서 · 총 건수 · fields 보존.
//   - error: (a) findMany reject 인스턴스 동일성 전파, (b) 비-Date/누락 instant → TypeError,
//     (c) allow-list 외 key(apiKey) → RangeError. 모두 swallow 0.
//   - branch/flow: 빈 DB → [], 일부 entity 만 row, 전 entity row 세 분기.
//   - negative 충분: allow-list select 정확 일치 · 무인자 findMany 0 · 호출 횟수 · delegate 누락
//     전파 · client 비변형 + 매 호출 새 배열.
import { EXPORT_ENTITY_FULL_RECORD_SELECT } from "./export-entity-full-record-select";
import {
  EXPORT_ENTITY_SOURCES,
  type ExportEntityDelegate,
} from "./export-entity-sources";
import {
  collectFullExportRecords,
  type ExportFullRecordReadClient,
} from "./export-full-record-collect";
import { type ExportEntity } from "./export-scope-select";

// 5 delegate 의 findMany 를 jest.fn 으로 채운 mock read client (기본 반환은 빈 배열 = 빈 DB).
type MockClient = Record<ExportEntityDelegate, { findMany: jest.Mock }>;

function buildClient(): {
  client: ExportFullRecordReadClient;
  mock: MockClient;
} {
  const mock: MockClient = {
    assessment: { findMany: jest.fn().mockResolvedValue([]) },
    person: { findMany: jest.fn().mockResolvedValue([]) },
    group: { findMany: jest.fn().mockResolvedValue([]) },
    llmProviderConfig: { findMany: jest.fn().mockResolvedValue([]) },
    permissionDeniedRecord: { findMany: jest.fn().mockResolvedValue([]) },
  };
  return { client: mock as unknown as ExportFullRecordReadClient, mock };
}

// entity → delegate mock 조회 (매핑표 single-source 사용 — spec 사본 0).
function delegateOf(mock: MockClient, entity: ExportEntity): jest.Mock {
  return mock[EXPORT_ENTITY_SOURCES[entity].delegate].findMany;
}

const INSTANT = new Date("2026-02-01T00:00:00.000Z");
// EXPORT_ENTITY_SOURCES 삽입 순서 = 평탄화 순서(helper 는 Object.entries 순회).
const ENTITY_ORDER = Object.keys(EXPORT_ENTITY_SOURCES) as ExportEntity[];

describe("collectFullExportRecords", () => {
  // happy — 5 entity 전부 row 를 돌려줄 때 entity/instant/fields 가 채워진 FullExportRecord[] 를
  // entity 별 평탄화 순서대로 반환하고 총 건수가 입력 row 합과 같다.
  it("happy — 5 delegate row 를 평탄화 순서대로 FullExportRecord[] 로 조립", async () => {
    const { client, mock } = buildClient();
    delegateOf(mock, "Assessment").mockResolvedValue([
      { id: "a1", personId: "p1", createdAt: INSTANT },
      { id: "a2", personId: "p1", createdAt: INSTANT },
    ]);
    delegateOf(mock, "Person").mockResolvedValue([
      {
        id: "p1",
        fullName: "홍길동",
        email: "h@example.test",
        createdAt: INSTANT,
      },
    ]);
    delegateOf(mock, "Group").mockResolvedValue([
      { id: "g1", name: "팀A", createdAt: INSTANT },
    ]);
    delegateOf(mock, "LlmConfig").mockResolvedValue([
      { id: "l1", provider: "openai", modelId: "gpt", createdAt: INSTANT },
    ]);
    delegateOf(mock, "AuditLog").mockResolvedValue([
      { id: "d1", principal: "u1", reason: "denied", createdAt: INSTANT },
    ]);

    const records = await collectFullExportRecords(client);

    // 총 건수 = 입력 row 합(2+1+1+1+1).
    expect(records).toHaveLength(6);
    // 평탄화 순서 = 매핑표 순서(Assessment 2 건이 먼저, AuditLog 가 마지막).
    expect(records.map((r) => r.entity)).toEqual([
      "Assessment",
      "Assessment",
      "Person",
      "Group",
      "LlmConfig",
      "AuditLog",
    ]);
    // entity / instant / fields 3 축이 모두 채워짐.
    const person = records.find((r) => r.entity === "Person")!;
    expect(person.instant).toBe(INSTANT);
    expect(person.fields.fullName).toBe("홍길동");
    expect(Object.keys(person.fields).sort()).toEqual(
      ["createdAt", "email", "fullName", "id"].sort(),
    );
    // secret deny 회귀 — LlmConfig fields 에 apiKey 부재.
    const llm = records.find((r) => r.entity === "LlmConfig")!;
    expect(llm.fields).not.toHaveProperty("apiKey");
  });

  // error (a) — 한 delegate 가 reject 하면 그 error 가 인스턴스 동일성 유지로 전파(swallow 0).
  it("error — delegate findMany reject 가 인스턴스 그대로 전파", async () => {
    const { client, mock } = buildClient();
    const boom = new Error("DB 연결 실패");
    delegateOf(mock, "Group").mockRejectedValue(boom);

    await expect(collectFullExportRecords(client)).rejects.toBe(boom);
  });

  // error (b) — instant 컬럼이 비-Date 면 buildFullExportRecord 의 TypeError 가 그대로 전파.
  it("error — instant 가 비-Date 면 TypeError 전파", async () => {
    const { client, mock } = buildClient();
    delegateOf(mock, "Person").mockResolvedValue([
      { id: "p1", createdAt: "2026-02-01" },
    ]);

    await expect(collectFullExportRecords(client)).rejects.toThrow(TypeError);
  });

  // error (b') — instant 컬럼 자체가 누락(undefined)인 경계도 같은 TypeError 분기.
  it("error — instant 컬럼 누락이면 TypeError 전파", async () => {
    const { client, mock } = buildClient();
    delegateOf(mock, "Group").mockResolvedValue([{ id: "g1", name: "팀A" }]);

    await expect(collectFullExportRecords(client)).rejects.toThrow(TypeError);
  });

  // error (c) — allow-list 외 key(secret apiKey)가 섞이면 RangeError 가 그대로 전파(2 차 그물).
  it("error — allow-list 외 key(apiKey) 혼입이면 RangeError 전파", async () => {
    const { client, mock } = buildClient();
    delegateOf(mock, "LlmConfig").mockResolvedValue([
      { id: "l1", provider: "openai", apiKey: "sk-secret", createdAt: INSTANT },
    ]);

    await expect(collectFullExportRecords(client)).rejects.toThrow(RangeError);
  });

  // branch (a) — 전 entity 빈 배열(빈 DB) → 빈 배열 반환 · throw 0.
  it("branch — 빈 DB(전 entity 빈 배열)면 빈 배열 반환", async () => {
    const { client } = buildClient();

    await expect(collectFullExportRecords(client)).resolves.toEqual([]);
  });

  // branch (b) — 일부 entity 만 row 존재 → 존재 분만 평탄 반환.
  it("branch — 일부 entity 만 row 가 있으면 그 분만 반환", async () => {
    const { client, mock } = buildClient();
    delegateOf(mock, "Group").mockResolvedValue([
      { id: "g1", name: "팀A", createdAt: INSTANT },
    ]);

    const records = await collectFullExportRecords(client);

    expect(records).toHaveLength(1);
    expect(records[0].entity).toBe("Group");
  });

  // branch (c) — 전 entity row 존재 → 5 entity 전부 결과에 포함.
  it("branch — 전 entity row 가 있으면 5 entity 전부 포함", async () => {
    const { client, mock } = buildClient();
    for (const entity of ENTITY_ORDER) {
      delegateOf(mock, entity).mockResolvedValue([
        { id: `${entity}-1`, createdAt: INSTANT },
      ]);
    }

    const records = await collectFullExportRecords(client);

    expect(new Set(records.map((r) => r.entity))).toEqual(
      new Set(ENTITY_ORDER),
    );
  });

  // negative (a)(b)(c) — REQ-032 projection-only: select 가 allow-list 와 정확히 일치하고
  // apiKey 가 어디에도 없으며, 무인자/select 생략 호출 0 · entity 당 정확히 1 회 · 총 5 회.
  it("negative — findMany 가 allow-list select 로 entity 당 정확히 1 회만 호출", async () => {
    const { client, mock } = buildClient();

    await collectFullExportRecords(client);

    let totalCalls = 0;
    for (const entity of ENTITY_ORDER) {
      const fn = delegateOf(mock, entity);
      expect(fn).toHaveBeenCalledTimes(1);
      totalCalls += fn.mock.calls.length;
      const arg = fn.mock.calls[0][0] as { select?: Record<string, true> };
      // 전체 row read 금지 — 무인자 / select 생략 호출 0.
      expect(arg).toBeDefined();
      expect(arg).toHaveProperty("select");
      // allow-list 상수와 정확 일치(방어 복제라 값 동등) + apiKey 부재.
      expect(arg.select).toEqual(EXPORT_ENTITY_FULL_RECORD_SELECT[entity]);
      expect(arg.select).not.toHaveProperty("apiKey");
    }
    expect(totalCalls).toBe(5);
  });

  // negative (d) — client 에 delegate 가 누락되면 조용히 빈 배열을 돌려주지 않고 error 전파.
  it("negative — delegate 누락 client 는 빈 배열이 아니라 error 전파", async () => {
    const { mock } = buildClient();
    const broken = { ...mock } as Partial<MockClient>;
    delete broken.group;

    await expect(
      collectFullExportRecords(broken as unknown as ExportFullRecordReadClient),
    ).rejects.toThrow(TypeError);
  });

  // negative (e) — 입력 client 를 변형하지 않으며(key 추가 · 함수 교체 0) 같은 client 로 두 번
  // 호출하면 매번 새 배열 인스턴스를 반환한다.
  it("negative — client 비변형 + 매 호출 새 배열 인스턴스 반환", async () => {
    const { client, mock } = buildClient();
    const keysBefore = Object.keys(mock).sort();
    const fnsBefore = ENTITY_ORDER.map((entity) => delegateOf(mock, entity));

    const first = await collectFullExportRecords(client);
    const second = await collectFullExportRecords(client);

    // client shape 불변 — key 추가 0, 함수 교체 0.
    expect(Object.keys(mock).sort()).toEqual(keysBefore);
    expect(ENTITY_ORDER.map((entity) => delegateOf(mock, entity))).toEqual(
      fnsBefore,
    );
    // 매 호출 새 배열(공유 캐시 0).
    expect(first).toEqual(second);
    expect(first).not.toBe(second);
  });
});
