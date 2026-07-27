// export-entity-sources.spec — T-1263. R-112 4 종 (happy / error path / 분기 / negative 충분
// cover) 을 신규 공용 module 의 2 심볼 (EXPORT_ENTITY_SOURCES 매핑표 + exportEntityPrismaModel)
// 에 대해 모두 커버한다. 순수 데이터 module 이라 DB · Prisma client · fixture 0 — 상수와
// 반환값만으로 단언한다.
//
// 본 module 은 "런타임 동작 변경 0 의 추출" 이므로 spec 의 초점은 (a) 추출된 값이 원본과 정확히
// 같은가, (b) 단일 source-of-truth 로서 변형 · drift 에 견디는가 두 축이다.
import {
  EXPORT_ENTITY_SOURCES,
  exportEntityPrismaModel,
  type ExportEntitySource,
} from "./export-entity-sources";
import {
  VALID_EXPORT_ENTITIES,
  type ExportEntity,
} from "./export-scope-select";

// 타입 체크를 우회해 런타임 방어를 검증하기 위한 helper — 잘못된 입력을 그대로 전달한다.
function callWithAny(entity: unknown): string {
  return exportEntityPrismaModel(entity as ExportEntity);
}

// 5 entity 의 기대 매핑 3 축 — 추출 원본(export-job.service.ts 의 module-private 상수) 과 동일한
// 값이어야 한다. 본 표가 spec 쪽 기대값 source 이며 production 표와 독립적으로 손으로 적었다
// (production 표를 그대로 참조하면 vacuous 하게 통과한다).
const EXPECTED: ReadonlyArray<[ExportEntity, string, string, string]> = [
  ["Assessment", "assessment", "Assessment", "createdAt"],
  ["Person", "person", "Person", "createdAt"],
  ["Group", "group", "Group", "createdAt"],
  ["LlmConfig", "llmProviderConfig", "LlmProviderConfig", "createdAt"],
  ["AuditLog", "permissionDeniedRecord", "PermissionDeniedRecord", "createdAt"],
];

describe("EXPORT_ENTITY_SOURCES (entity → delegate·model·instant 매핑표)", () => {
  it.each(EXPECTED)(
    "%s 의 delegate·model·instantColumn 3 축이 기대값과 일치한다",
    (entity, delegate, model, instantColumn) => {
      const source = EXPORT_ENTITY_SOURCES[entity as ExportEntity];
      expect(source.delegate).toBe(delegate);
      expect(source.model).toBe(model);
      expect(source.instantColumn).toBe(instantColumn);
    },
  );

  it("key 집합이 VALID_EXPORT_ENTITIES 와 정확히 일치한다 (누락도 여분도 0)", () => {
    expect(Object.keys(EXPORT_ENTITY_SOURCES).sort()).toEqual(
      [...VALID_EXPORT_ENTITIES].sort(),
    );
  });

  it("5 entity 를 담는다 (entity 추가/삭제 회귀 catch)", () => {
    expect(Object.keys(EXPORT_ENTITY_SOURCES)).toHaveLength(5);
  });

  it("5 delegate 값이 서로 중복되지 않는다 (한 delegate 를 두 entity 가 공유 0)", () => {
    const delegates = VALID_EXPORT_ENTITIES.map(
      (entity) => EXPORT_ENTITY_SOURCES[entity].delegate,
    );
    expect(new Set(delegates).size).toBe(5);
  });

  it("5 model 값이 서로 중복되지 않는다 (한 model 을 두 entity 가 공유 0)", () => {
    const models = VALID_EXPORT_ENTITIES.map(
      (entity) => EXPORT_ENTITY_SOURCES[entity].model,
    );
    expect(new Set(models).size).toBe(5);
  });

  it("model 이 entity 이름과 다른 2 종을 정확히 흡수한다 (명시 값 박제 증명)", () => {
    // LlmConfig / AuditLog 는 entity literal 과 Prisma model 이름이 다르다 — entity 문자열
    // 에서 파생시킬 수 없고 명시 값이어야만 맞는 지점이다.
    expect(EXPORT_ENTITY_SOURCES.LlmConfig.model).toBe("LlmProviderConfig");
    expect(EXPORT_ENTITY_SOURCES.AuditLog.model).toBe("PermissionDeniedRecord");
    const renamed = VALID_EXPORT_ENTITIES.filter(
      (entity) => EXPORT_ENTITY_SOURCES[entity].model !== entity,
    );
    expect([...renamed].sort()).toEqual(["AuditLog", "LlmConfig"]);
    // 나머지 3 종은 entity 이름과 model 이름이 동명이다.
    for (const entity of ["Assessment", "Person", "Group"] as ExportEntity[]) {
      expect(EXPORT_ENTITY_SOURCES[entity].model).toBe(entity);
    }
  });

  it("5 entity 모두 instantColumn 이 createdAt 이다 (range scope 판정 기준 고정)", () => {
    for (const entity of VALID_EXPORT_ENTITIES) {
      expect(EXPORT_ENTITY_SOURCES[entity].instantColumn).toBe("createdAt");
    }
  });

  it("union 밖 key 로 조회하면 undefined 다 (부재 분기)", () => {
    const table = EXPORT_ENTITY_SOURCES as Record<
      string,
      ExportEntitySource | undefined
    >;
    expect(table.Unknown).toBeUndefined();
    expect(table.assessment).toBeUndefined();
  });

  it("표 자체가 frozen — 새 entity 추가 시도가 반영되지 않는다", () => {
    expect(Object.isFrozen(EXPORT_ENTITY_SOURCES)).toBe(true);
    const table = EXPORT_ENTITY_SOURCES as Record<
      string,
      ExportEntitySource | undefined
    >;
    try {
      table.Injected = {
        delegate: "person",
        model: "Hacked",
        instantColumn: "createdAt",
      };
    } catch {
      // strict mode 에서는 TypeError — 어느 쪽이든 표는 그대로여야 한다.
    }
    expect(table.Injected).toBeUndefined();
    expect(Object.keys(EXPORT_ENTITY_SOURCES)).toHaveLength(5);
  });

  it("각 value 가 frozen — 필드 write 시도가 반영되지 않는다", () => {
    for (const entity of VALID_EXPORT_ENTITIES) {
      expect(Object.isFrozen(EXPORT_ENTITY_SOURCES[entity])).toBe(true);
    }
    const victim = EXPORT_ENTITY_SOURCES.LlmConfig as {
      model: string;
      delegate: string;
    };
    try {
      victim.model = "Tampered";
      victim.delegate = "person";
    } catch {
      // strict mode 에서는 TypeError — 어느 쪽이든 값은 그대로여야 한다.
    }
    expect(EXPORT_ENTITY_SOURCES.LlmConfig.model).toBe("LlmProviderConfig");
    expect(EXPORT_ENTITY_SOURCES.LlmConfig.delegate).toBe("llmProviderConfig");
    expect(exportEntityPrismaModel("LlmConfig")).toBe("LlmProviderConfig");
  });

  it("entity 삭제 시도도 반영되지 않는다 (frozen — 표 축소 0)", () => {
    const table = EXPORT_ENTITY_SOURCES as Record<
      string,
      ExportEntitySource | undefined
    >;
    try {
      delete table.AuditLog;
    } catch {
      // strict mode 에서는 TypeError — 어느 쪽이든 key 는 남아 있어야 한다.
    }
    expect(EXPORT_ENTITY_SOURCES.AuditLog.model).toBe("PermissionDeniedRecord");
  });
});

describe("exportEntityPrismaModel (정상 조회 분기)", () => {
  it.each(EXPECTED)(
    "%s → 기대 model 이름을 돌려준다",
    (entity, _delegate, model) => {
      expect(exportEntityPrismaModel(entity as ExportEntity)).toBe(model);
    },
  );

  it("5 entity 모두 매핑표의 model 과 동일한 값을 돌려준다", () => {
    for (const entity of VALID_EXPORT_ENTITIES) {
      expect(exportEntityPrismaModel(entity)).toBe(
        EXPORT_ENTITY_SOURCES[entity].model,
      );
    }
  });

  it("같은 entity 를 반복 조회해도 같은 값 (non-mutating · 부작용 0)", () => {
    const first = exportEntityPrismaModel("Person");
    const second = exportEntityPrismaModel("Person");
    expect(first).toBe(second);
    expect(Object.keys(EXPORT_ENTITY_SOURCES)).toHaveLength(5);
  });

  it("반환 문자열을 호출자가 변형해도 다음 호출 결과가 불변이다", () => {
    let model = exportEntityPrismaModel("LlmConfig");
    // string 은 primitive 라 재대입은 지역 변수만 바꾼다 — 표는 영향 0.
    model = `${model}Tampered`;
    expect(model).toBe("LlmProviderConfigTampered");
    expect(exportEntityPrismaModel("LlmConfig")).toBe("LlmProviderConfig");
    expect(EXPORT_ENTITY_SOURCES.LlmConfig.model).toBe("LlmProviderConfig");
  });
});

describe("exportEntityPrismaModel (error path — string 이지만 union 밖)", () => {
  it.each([
    ["오타", "Assessmnet"],
    ["소문자", "person"],
    ["빈 문자열", ""],
    ["공백", " "],
    ["앞뒤 공백 포함", " Person "],
    ["Prisma model 이름 자체", "LlmProviderConfig"],
  ])("%s (%p) 는 RangeError", (_label, entity) => {
    expect(() => callWithAny(entity)).toThrow(RangeError);
    expect(() => callWithAny(entity)).toThrow(/지원하지 않는 entity/);
  });

  it("RangeError 메시지에 함수 이름과 받은 값이 담긴다", () => {
    expect(() => callWithAny("Assessmnet")).toThrow(
      "exportEntityPrismaModel: 지원하지 않는 entity 입니다 (받음: Assessmnet)",
    );
  });

  it.each(["__proto__", "constructor", "toString", "hasOwnProperty"])(
    "prototype 오염 유도 key %p 도 RangeError (상속 속성 오탐 0)",
    (key) => {
      expect(() => callWithAny(key)).toThrow(RangeError);
    },
  );
});

describe("exportEntityPrismaModel (error path — 비-string)", () => {
  it.each([
    ["null", null, "object"],
    ["undefined", undefined, "undefined"],
    ["숫자", 42, "number"],
    ["객체", { entity: "Person" }, "object"],
    ["배열", ["Person"], "object"],
    ["boolean", true, "boolean"],
    ["함수", () => "Person", "function"],
  ])("%s 는 TypeError 이며 타입 이름만 노출한다", (_label, value, typeName) => {
    expect(() => callWithAny(value)).toThrow(TypeError);
    expect(() => callWithAny(value)).toThrow(
      `exportEntityPrismaModel: entity 는 문자열이어야 합니다 (받음: ${typeName})`,
    );
  });

  it("객체 입력의 내용물이 메시지로 새지 않는다 (REQ-032 — 강제 변환 금지)", () => {
    const secretish = { apiKey: "sk-super-secret", entity: "LlmConfig" };
    expect(() => callWithAny(secretish)).toThrow(TypeError);
    try {
      callWithAny(secretish);
      throw new Error("unreachable — TypeError 가 던져졌어야 한다");
    } catch (error) {
      expect(error).toBeInstanceOf(TypeError);
      expect((error as TypeError).message).not.toContain("sk-super-secret");
      expect((error as TypeError).message).not.toContain("apiKey");
      expect((error as TypeError).message).toContain("object");
    }
  });

  it("String 객체 wrapper 도 비-string 으로 거부한다 (typeof object)", () => {
    // Object("Person") 은 String wrapper 객체 — typeof 가 "object" 라 primitive 검사에 걸린다.
    expect(() => callWithAny(Object("Person"))).toThrow(TypeError);
  });

  it("비-string 은 RangeError 가 아니라 TypeError 로 분기한다 (분기 우선순위)", () => {
    expect(() => callWithAny(null)).not.toThrow(RangeError);
  });
});
