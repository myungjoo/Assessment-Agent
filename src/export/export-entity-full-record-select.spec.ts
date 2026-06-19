// export-entity-full-record-select 순수 helper spec — R-112 4 종(happy / error / branch /
// negative 충분 cover). entity 별 allow-list select 상수의 정확한 key 집합 + secret(apiKey)
// deny 회귀 + non-mutating + 예외 분기를 검증한다(export-scope-select.spec.ts mirror).
//
// 🔥 핵심 invariant(ADR-0047 §Decision2(b)): LlmConfig 의 select 결과에 apiKey 가 부재해야
// 한다 — 이 회귀 test 가 secret 유출을 영구 차단한다.
import {
  EXPORT_ENTITY_FULL_RECORD_SELECT,
  getExportEntityFullRecordSelect,
} from "./export-entity-full-record-select";
import { ExportEntity, VALID_EXPORT_ENTITIES } from "./export-scope-select";

// ADR-0047 §Decision1 표의 entity 별 allow-list — 정확한 key 집합 단언의 source(spec 자체가
// 표의 mirror 라 코드와 spec 양쪽이 어긋나면 fail).
const EXPECTED_ALLOW_LIST: Record<ExportEntity, string[]> = {
  Assessment: [
    "id",
    "personId",
    "period",
    "scope",
    "periodStart",
    "difficulty",
    "contributionScore",
    "volume",
    "narrative",
    "createdAt",
  ],
  Person: [
    "id",
    "fullName",
    "email",
    "active",
    "partId",
    "createdAt",
    "updatedAt",
  ],
  Group: ["id", "name", "createdAt", "updatedAt"],
  LlmConfig: [
    "id",
    "provider",
    "endpointUrl",
    "modelId",
    "createdAt",
    "updatedAt",
  ],
  AuditLog: [
    "id",
    "provider",
    "instanceRef",
    "resourceRef",
    "principal",
    "httpStatus",
    "reason",
    "createdAt",
  ],
};

describe("EXPORT_ENTITY_FULL_RECORD_SELECT 상수 (ADR-0047 §Decision1 single-source)", () => {
  it("정확히 5 entity key 를 가진다(ExportEntity union 정합)", () => {
    expect(Object.keys(EXPORT_ENTITY_FULL_RECORD_SELECT).sort()).toEqual(
      [...VALID_EXPORT_ENTITIES].sort(),
    );
  });

  it("모든 select 값은 { <col>: true } 형태(Prisma select 객체)", () => {
    for (const entity of VALID_EXPORT_ENTITIES) {
      const select = EXPORT_ENTITY_FULL_RECORD_SELECT[entity];
      for (const value of Object.values(select)) {
        expect(value).toBe(true);
      }
    }
  });

  it("상수 원본은 frozen — 직접 mutation 이 무시된다(non-mutating)", () => {
    expect(Object.isFrozen(EXPORT_ENTITY_FULL_RECORD_SELECT.LlmConfig)).toBe(
      true,
    );
  });
});

describe("getExportEntityFullRecordSelect — happy path(5 entity 분기)", () => {
  // entity 별 1+ happy-path: allow-list 컬럼 key 를 정확히 포함(멤버십 정확 일치).
  for (const entity of VALID_EXPORT_ENTITIES) {
    it(`${entity} → ADR-0047 표 allow-list 컬럼 key 를 정확히 포함`, () => {
      const select = getExportEntityFullRecordSelect(entity);
      expect(Object.keys(select).sort()).toEqual(
        [...EXPECTED_ALLOW_LIST[entity]].sort(),
      );
      // allow-list 의 모든 컬럼은 true 로 select 됨.
      for (const col of EXPECTED_ALLOW_LIST[entity]) {
        expect(select[col]).toBe(true);
      }
    });
  }
});

describe("getExportEntityFullRecordSelect — 🔥 secret deny 회귀(ADR-0047 §Decision2(b))", () => {
  it("LlmConfig select 결과에 apiKey key 가 부재한다(projection-only deny)", () => {
    const select = getExportEntityFullRecordSelect("LlmConfig");
    expect(select).not.toHaveProperty("apiKey");
  });

  it("상수 원본 LlmConfig 에도 apiKey 가 애초에 없다(single-source 보장)", () => {
    expect(EXPORT_ENTITY_FULL_RECORD_SELECT.LlmConfig).not.toHaveProperty(
      "apiKey",
    );
  });

  it("어떤 entity 의 select 에도 deny/미정의 컬럼이 섞이지 않는다(멤버십 정확 일치)", () => {
    for (const entity of VALID_EXPORT_ENTITIES) {
      const select = getExportEntityFullRecordSelect(entity);
      const allowed = new Set(EXPECTED_ALLOW_LIST[entity]);
      for (const key of Object.keys(select)) {
        expect(allowed.has(key)).toBe(true);
      }
    }
  });
});

describe("getExportEntityFullRecordSelect — error path(비-string → TypeError)", () => {
  it.each([
    ["null", null],
    ["undefined", undefined],
    ["number", 7],
    ["object", {}],
    ["array", []],
  ])("비-string 입력(%s)이면 한국어 TypeError", (_label, input) => {
    expect(() =>
      getExportEntityFullRecordSelect(input as unknown as ExportEntity),
    ).toThrow(TypeError);
    expect(() =>
      getExportEntityFullRecordSelect(input as unknown as ExportEntity),
    ).toThrow(/문자열이어야 합니다/);
  });
});

describe("getExportEntityFullRecordSelect — error path(미지원 entity → RangeError)", () => {
  it.each([["Unknown"], [""], ["assessment"], ["LLMConfig"]])(
    "미지원 entity 문자열(%s)이면 한국어 RangeError",
    (input) => {
      expect(() =>
        getExportEntityFullRecordSelect(input as ExportEntity),
      ).toThrow(RangeError);
      expect(() =>
        getExportEntityFullRecordSelect(input as ExportEntity),
      ).toThrow(/지원하지 않는 entity/);
    },
  );
});

describe("getExportEntityFullRecordSelect — non-mutating(반환 변형이 원본 불변)", () => {
  it("반환 객체에 key 를 추가/삭제해도 상수 원본은 영향 없다", () => {
    const select = getExportEntityFullRecordSelect("Group");
    (select as Record<string, unknown>).apiKey = true;
    delete (select as Record<string, unknown>).id;

    // 다시 derive 하면 오염되지 않은 원본 복제를 받는다.
    const fresh = getExportEntityFullRecordSelect("Group");
    expect(fresh).not.toHaveProperty("apiKey");
    expect(fresh).toHaveProperty("id", true);
    // 상수 원본도 불변.
    expect(EXPORT_ENTITY_FULL_RECORD_SELECT.Group).not.toHaveProperty("apiKey");
    expect(EXPORT_ENTITY_FULL_RECORD_SELECT.Group).toHaveProperty("id", true);
  });

  it("두 번 derive 한 결과는 서로 다른 객체 참조(매번 새 복제)", () => {
    const a = getExportEntityFullRecordSelect("Assessment");
    const b = getExportEntityFullRecordSelect("Assessment");
    expect(a).not.toBe(b);
    expect(a).toEqual(b);
  });
});
