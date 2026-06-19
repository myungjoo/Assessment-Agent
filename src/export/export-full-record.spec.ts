// export-full-record 순수 helper spec — R-112 4 종(happy / error / branch / negative 충분
// cover). buildFullExportRecord 의 FullExportRecord 조립 정확성 + 입력 방어 분기(entity 타입/
// 멤버십 · instant 유효성 · fields 형태 · secret/allow-list 외 key) + non-mutating 을 검증한다
// (export-entity-full-record-select.spec.ts / export-scope-select.spec.ts mirror).
//
// 🔥 핵심 회귀(ADR-0047 §Decision2(b)): LlmConfig fields 에 apiKey 가 섞이면 RangeError +
// 반환 객체에 apiKey 부재 — 이 회귀 test 가 secret 의 dump 혼입을 영구 차단한다.
import { buildFullExportRecord, FullExportRecord } from "./export-full-record";
import { ExportEntity, VALID_EXPORT_ENTITIES } from "./export-scope-select";

// ADR-0047 §Decision1 표의 entity 별 allow-list 일부 — happy-path fields 조립의 source.
// (전체 멤버십 정확 일치는 export-entity-full-record-select.spec.ts 가 단언하므로 여기서는
// builder 동작 검증에 필요한 대표 컬럼만 쓴다.)
const SAMPLE_FIELDS: Record<ExportEntity, Record<string, unknown>> = {
  Assessment: {
    id: "a1",
    personId: "p1",
    period: "2026-Q1",
    contributionScore: 42,
    narrative: "derived 요약",
    createdAt: "2026-01-01T00:00:00.000Z",
  },
  Person: {
    id: "p1",
    fullName: "홍길동",
    email: "hong@example.com",
    active: true,
    partId: "part1",
  },
  Group: { id: "g1", name: "팀A", createdAt: "2026-01-01T00:00:00.000Z" },
  LlmConfig: {
    id: "l1",
    provider: "openai",
    endpointUrl: "https://api.example.com",
    modelId: "gpt-x",
  },
  AuditLog: {
    id: "au1",
    provider: "openai",
    instanceRef: "inst1",
    resourceRef: "res1",
    principal: "admin",
    httpStatus: 403,
    reason: "denied",
  },
};

const INSTANT = new Date("2026-03-15T12:00:00.000Z");

describe("buildFullExportRecord — happy path(5 entity 분기)", () => {
  for (const entity of VALID_EXPORT_ENTITIES) {
    it(`${entity} → entity/instant/fields 를 정확히 보존한 FullExportRecord 반환`, () => {
      const fields = SAMPLE_FIELDS[entity];
      const record = buildFullExportRecord(entity, INSTANT, fields);

      expect(record.entity).toBe(entity);
      expect(record.instant).toBe(INSTANT);
      expect(record.fields).toEqual(fields);
    });
  }

  it("빈 fields(경계 — allow-list 컬럼 전무)도 정상 반환", () => {
    const record = buildFullExportRecord("Group", INSTANT, {});
    expect(record.fields).toEqual({});
    expect(record.entity).toBe("Group");
  });

  it("allow-list 일부만 담은 fields(부분 컬럼 경계)도 정상 반환", () => {
    const record = buildFullExportRecord("Person", INSTANT, { id: "p9" });
    expect(record.fields).toEqual({ id: "p9" });
  });

  it("Object.create(null) 형태 fields(prototype-less plain object)도 정상 허용", () => {
    const nullProto = Object.create(null) as Record<string, unknown>;
    nullProto.id = "g2";
    const record = buildFullExportRecord("Group", INSTANT, nullProto);
    expect(record.fields).toEqual({ id: "g2" });
  });
});

describe("buildFullExportRecord — error path(entity 타입 → TypeError)", () => {
  it.each([
    ["null", null],
    ["undefined", undefined],
    ["number", 7],
    ["object", {}],
    ["array", []],
  ])("비-string entity(%s)면 한국어 TypeError", (_label, input) => {
    expect(() =>
      buildFullExportRecord(input as unknown as ExportEntity, INSTANT, {}),
    ).toThrow(TypeError);
    expect(() =>
      buildFullExportRecord(input as unknown as ExportEntity, INSTANT, {}),
    ).toThrow(/문자열이어야 합니다/);
  });
});

describe("buildFullExportRecord — error path(미지원 entity literal → RangeError)", () => {
  it.each([["Unknown"], [""], ["assessment"], ["LLMConfig"]])(
    "미지원 entity(%s)면 한국어 RangeError",
    (input) => {
      expect(() =>
        buildFullExportRecord(input as ExportEntity, INSTANT, {}),
      ).toThrow(RangeError);
      expect(() =>
        buildFullExportRecord(input as ExportEntity, INSTANT, {}),
      ).toThrow(/지원하지 않는 entity/);
    },
  );
});

describe("buildFullExportRecord — error path(instant 유효성 → TypeError)", () => {
  it.each([
    ["null", null],
    ["undefined", undefined],
    ["string", "2026-03-15"],
    ["number(ms)", 1_700_000_000_000],
    ["Invalid Date", new Date("nope")],
  ])("비-Date/Invalid Date instant(%s)면 한국어 TypeError", (_label, input) => {
    expect(() =>
      buildFullExportRecord("Group", input as unknown as Date, { id: "g1" }),
    ).toThrow(TypeError);
    expect(() =>
      buildFullExportRecord("Group", input as unknown as Date, { id: "g1" }),
    ).toThrow(/유효한 Date instance/);
  });
});

describe("buildFullExportRecord — error path(fields 형태 → TypeError)", () => {
  it.each([
    ["null", null],
    ["undefined", undefined],
    ["array", []],
    ["number", 7],
    ["string", "fields"],
    ["Date", new Date("2026-01-01T00:00:00.000Z")],
  ])("비-plain-object fields(%s)면 한국어 TypeError", (_label, input) => {
    expect(() =>
      buildFullExportRecord(
        "Group",
        INSTANT,
        input as unknown as Record<string, unknown>,
      ),
    ).toThrow(TypeError);
    expect(() =>
      buildFullExportRecord(
        "Group",
        INSTANT,
        input as unknown as Record<string, unknown>,
      ),
    ).toThrow(/plain object 여야 합니다/);
  });
});

describe("buildFullExportRecord — 🔥 secret deny 회귀(ADR-0047 §Decision2(b))", () => {
  it("LlmConfig fields 에 apiKey 가 있으면 RangeError 를 throw 한다", () => {
    expect(() =>
      buildFullExportRecord("LlmConfig", INSTANT, {
        id: "l1",
        provider: "openai",
        apiKey: "sk-secret-leak",
      }),
    ).toThrow(RangeError);
    expect(() =>
      buildFullExportRecord("LlmConfig", INSTANT, {
        id: "l1",
        apiKey: "sk-secret-leak",
      }),
    ).toThrow(/allow-list 외 key/);
  });

  it("apiKey 없이 LlmConfig 를 조립하면 반환 객체에 apiKey key 가 부재한다", () => {
    const record = buildFullExportRecord("LlmConfig", INSTANT, {
      id: "l1",
      provider: "openai",
      endpointUrl: "https://api.example.com",
      modelId: "gpt-x",
    });
    expect(record.fields).not.toHaveProperty("apiKey");
  });

  // 향후 다른 secret key(token 등)가 어느 entity 에 추가돼도 allow-list 밖이면 동형으로 catch.
  it("allow-list 외 임의 key(미정의 컬럼)도 RangeError(secret 일반화 그물)", () => {
    expect(() =>
      buildFullExportRecord("Person", INSTANT, {
        id: "p1",
        secretToken: "leak",
      }),
    ).toThrow(/allow-list 외 key/);
  });

  it("다른 entity(Group)에 apiKey 가 섞여도 allow-list 밖이라 RangeError", () => {
    expect(() =>
      buildFullExportRecord("Group", INSTANT, {
        id: "g1",
        apiKey: "leak",
      }),
    ).toThrow(RangeError);
  });
});

describe("buildFullExportRecord — non-mutating(입력 fields 비변형)", () => {
  it("입력 fields 객체를 변형하지 않고 새 객체를 반환한다", () => {
    const fields: Record<string, unknown> = { id: "p1", fullName: "홍길동" };
    const record = buildFullExportRecord("Person", INSTANT, fields);

    expect(record.fields).not.toBe(fields);
    expect(record.fields).toEqual(fields);
  });

  it("Object.freeze(fields) 로 호출해도 정상 통과(원본 비변형 보장)", () => {
    const frozen = Object.freeze({ id: "g1", name: "팀A" });
    const record = buildFullExportRecord("Group", INSTANT, frozen);
    expect(record.fields).toEqual({ id: "g1", name: "팀A" });
  });

  it("반환 객체와 fields 는 frozen — 변형 시도가 무시된다", () => {
    const record: FullExportRecord = buildFullExportRecord("Group", INSTANT, {
      id: "g1",
    });
    expect(Object.isFrozen(record)).toBe(true);
    expect(Object.isFrozen(record.fields)).toBe(true);
  });

  it("반환 fields 변형 후 다시 build 해도 새 build 는 오염되지 않는다", () => {
    const fields: Record<string, unknown> = { id: "g1" };
    buildFullExportRecord("Group", INSTANT, fields);
    // 원본 입력은 변형되지 않았으므로 재사용해도 안전.
    const fresh = buildFullExportRecord("Group", INSTANT, fields);
    expect(fresh.fields).toEqual({ id: "g1" });
  });
});
