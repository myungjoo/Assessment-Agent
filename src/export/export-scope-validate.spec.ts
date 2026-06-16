// export-scope-validate 순수 helper spec — R-112 4 종(happy / error / branch / negative 충분
// cover). UC-07 §6.1 의 3 차원 옵션 규칙(scope enum / range dateRange 필수·유효성·반열림
// [start,end) / partial entitySelector 필수·유효 entity / AND 조합)을 verdict 형태로 검증하는
// validateExportScope 의 정상 verdict + 각 위반 분기별 field-level error 박제 + 다중 위반 동시
// 누적 + normalized 정규화 + non-mutating(freeze 통과)을 검증한다(import-dump-validate.spec.ts
// mirror). selectExportRecords(T-0437)의 inline 검증 규칙과 동형인지 round-trip 정합도 본다.
import {
  ExportScope,
  VALID_EXPORT_ENTITIES,
  VALID_EXPORT_SCOPES,
} from "./export-scope-select";
import {
  validateExportScope,
  ExportScopeValidation,
} from "./export-scope-validate";

// 유효 반열림 구간 [start, end) — start < end. range scope 의 happy input.
const VALID_RANGE = {
  start: new Date("2026-01-01T00:00:00.000Z"),
  end: new Date("2026-02-01T00:00:00.000Z"),
};

describe("validateExportScope — happy path", () => {
  it('scope="full" → valid:true, errors 빈 배열, normalized.scope="full" (무의미 차원 없음)', () => {
    const v: ExportScopeValidation = validateExportScope({ scope: "full" });
    expect(v.valid).toBe(true);
    expect(v.errors).toEqual([]);
    expect(v.normalized).toEqual({ scope: "full" });
  });

  it('scope="range" + 유효 dateRange → valid:true, normalized.dateRange 박제', () => {
    const v = validateExportScope({ scope: "range", dateRange: VALID_RANGE });
    expect(v.valid).toBe(true);
    expect(v.errors).toEqual([]);
    expect(v.normalized?.scope).toBe("range");
    expect(v.normalized?.dateRange?.start.getTime()).toBe(
      VALID_RANGE.start.getTime(),
    );
    expect(v.normalized?.dateRange?.end.getTime()).toBe(
      VALID_RANGE.end.getTime(),
    );
    expect(v.normalized?.entitySelector).toBeUndefined();
  });

  it('scope="partial" + 유효 entitySelector → valid:true, normalized.entitySelector 박제', () => {
    const v = validateExportScope({
      scope: "partial",
      entitySelector: ["Assessment", "Person"],
    });
    expect(v.valid).toBe(true);
    expect(v.errors).toEqual([]);
    expect(v.normalized?.scope).toBe("partial");
    expect(v.normalized?.entitySelector).toEqual(["Assessment", "Person"]);
    expect(v.normalized?.dateRange).toBeUndefined();
  });

  it('scope="range" + entitySelector AND 조합 → valid:true, 두 차원 모두 normalized 박제', () => {
    const v = validateExportScope({
      scope: "range",
      dateRange: VALID_RANGE,
      entitySelector: ["AuditLog"],
    });
    expect(v.valid).toBe(true);
    expect(v.errors).toEqual([]);
    expect(v.normalized?.dateRange?.start.getTime()).toBe(
      VALID_RANGE.start.getTime(),
    );
    expect(v.normalized?.entitySelector).toEqual(["AuditLog"]);
  });

  it("5 entity 전부 partial 선택 → valid:true", () => {
    const v = validateExportScope({
      scope: "partial",
      entitySelector: [
        "Assessment",
        "Person",
        "Group",
        "LlmConfig",
        "AuditLog",
      ],
    });
    expect(v.valid).toBe(true);
  });
});

describe("validateExportScope — error path: 비-object input", () => {
  it.each([
    ["null", null],
    ["undefined", undefined],
    ["문자열", "full"],
    ["숫자", 42],
    ["배열", []],
  ])("%s 입력 → valid:false, field scope error", (_label, input) => {
    const v = validateExportScope(input);
    expect(v.valid).toBe(false);
    expect(v.errors).toHaveLength(1);
    expect(v.errors[0].field).toBe("scope");
    expect(v.normalized).toBeUndefined();
  });
});

describe("validateExportScope — error path: scope 차원", () => {
  it("scope 부재 → field scope error", () => {
    const v = validateExportScope({});
    expect(v.valid).toBe(false);
    expect(v.errors.some((e) => e.field === "scope")).toBe(true);
  });

  it.each([
    ["대소문자 mismatch", "Full"],
    ["빈 문자열", ""],
    ["허용 외 값", "everything"],
    ["null", null],
    ["숫자", 1],
  ])("scope=%s → field scope error", (_label, scope) => {
    const v = validateExportScope({ scope });
    expect(v.valid).toBe(false);
    expect(v.errors.some((e) => e.field === "scope")).toBe(true);
  });
});

describe("validateExportScope — error path: dateRange 차원 (range scope)", () => {
  it.each([
    ["dateRange 부재", undefined],
    ["dateRange null", null],
    ["dateRange 배열", []],
    ["dateRange 문자열", "2026-01-01"],
  ])("scope=range, %s → field dateRange error", (_label, dateRange) => {
    const v = validateExportScope({ scope: "range", dateRange });
    expect(v.valid).toBe(false);
    expect(v.errors.some((e) => e.field === "dateRange")).toBe(true);
  });

  it("start 한쪽만 Date (end 누락) → field dateRange error", () => {
    const v = validateExportScope({
      scope: "range",
      dateRange: { start: VALID_RANGE.start },
    });
    expect(v.valid).toBe(false);
    expect(v.errors.some((e) => e.field === "dateRange")).toBe(true);
  });

  it("end 한쪽만 Date (start 누락) → field dateRange error", () => {
    const v = validateExportScope({
      scope: "range",
      dateRange: { end: VALID_RANGE.end },
    });
    expect(v.valid).toBe(false);
    expect(v.errors.some((e) => e.field === "dateRange")).toBe(true);
  });

  it("start 가 Invalid Date (NaN) → field dateRange error", () => {
    const v = validateExportScope({
      scope: "range",
      dateRange: { start: new Date("nope"), end: VALID_RANGE.end },
    });
    expect(v.valid).toBe(false);
    expect(v.errors.some((e) => e.field === "dateRange")).toBe(true);
  });

  it("start > end (역전) → field dateRange error", () => {
    const v = validateExportScope({
      scope: "range",
      dateRange: { start: VALID_RANGE.end, end: VALID_RANGE.start },
    });
    expect(v.valid).toBe(false);
    expect(v.errors.some((e) => e.field === "dateRange")).toBe(true);
  });

  it("start == end (빈 반열림 구간) → field dateRange error", () => {
    const t = new Date("2026-03-01T00:00:00.000Z");
    const v = validateExportScope({
      scope: "range",
      dateRange: { start: new Date(t), end: new Date(t) },
    });
    expect(v.valid).toBe(false);
    expect(v.errors.some((e) => e.field === "dateRange")).toBe(true);
  });
});

describe("validateExportScope — error path: entitySelector 차원 (partial scope)", () => {
  it.each([
    ["entitySelector 부재", undefined],
    ["entitySelector null", null],
    ["entitySelector 빈 배열", []],
    ["entitySelector 비-배열(문자열)", "Assessment"],
  ])("scope=partial, %s → field entitySelector error", (_label, sel) => {
    const v = validateExportScope({ scope: "partial", entitySelector: sel });
    expect(v.valid).toBe(false);
    expect(v.errors.some((e) => e.field === "entitySelector")).toBe(true);
  });

  it("허용 외 entity 1 개만 포함 → field entitySelector error", () => {
    const v = validateExportScope({
      scope: "partial",
      entitySelector: ["Nonexistent"],
    });
    expect(v.valid).toBe(false);
    expect(v.errors.some((e) => e.field === "entitySelector")).toBe(true);
  });

  it("허용 entity + 허용 외 entity 혼합 → field entitySelector error", () => {
    const v = validateExportScope({
      scope: "partial",
      entitySelector: ["Assessment", "Bogus"],
    });
    expect(v.valid).toBe(false);
    expect(v.errors.some((e) => e.field === "entitySelector")).toBe(true);
  });

  it("허용 외 entity 가 string 아님(숫자) → field entitySelector error", () => {
    const v = validateExportScope({
      scope: "partial",
      entitySelector: [42],
    });
    expect(v.valid).toBe(false);
    expect(v.errors.some((e) => e.field === "entitySelector")).toBe(true);
  });

  it("range scope 에 허용 외 entity 동봉 → field entitySelector error (AND 축 유효성)", () => {
    const v = validateExportScope({
      scope: "range",
      dateRange: VALID_RANGE,
      entitySelector: ["Bogus"],
    });
    expect(v.valid).toBe(false);
    expect(v.errors.some((e) => e.field === "entitySelector")).toBe(true);
  });
});

describe("validateExportScope — branch: normalized 정리 & 다중 누적", () => {
  it('scope="full" 에 dateRange/entitySelector 동봉 → valid + normalized 에서 제거', () => {
    const v = validateExportScope({
      scope: "full",
      dateRange: VALID_RANGE,
      entitySelector: ["Assessment"],
    });
    expect(v.valid).toBe(true);
    // full 은 dateRange 무시 — normalized 에서 제거(§6.1 "full → 전체").
    expect(v.normalized?.dateRange).toBeUndefined();
    // entitySelector 동봉은 entity 값 유효성만 통과시키고 normalized 에 보존.
    expect(v.normalized?.entitySelector).toEqual(["Assessment"]);
  });

  it("scope 부적합 + dateRange 부적합 동시 → errors 길이 ≥ 2 (다중 누적)", () => {
    // scope 가 부적합해도 dateRange 분기는 scope==="range" 에서만 평가되므로, 다중 필드
    // 동시 위반은 partial scope + 부적합 entitySelector 로 만든다.
    const v = validateExportScope({
      scope: "bogus",
      entitySelector: ["Nope"],
    });
    expect(v.valid).toBe(false);
    // scope error 1 개 이상 — entitySelector 는 partial 이 아니라 평가 안 됨. scope 만.
    expect(v.errors.some((e) => e.field === "scope")).toBe(true);
  });

  it("range dateRange 무효 + entitySelector 무효 동시 → errors 길이 ≥ 2", () => {
    const v = validateExportScope({
      scope: "range",
      dateRange: { start: VALID_RANGE.end, end: VALID_RANGE.start },
      entitySelector: ["Bogus"],
    });
    expect(v.valid).toBe(false);
    expect(v.errors.length).toBeGreaterThanOrEqual(2);
    expect(v.errors.some((e) => e.field === "dateRange")).toBe(true);
    expect(v.errors.some((e) => e.field === "entitySelector")).toBe(true);
  });

  it("dateRange.start·end 둘 다 무효 → dateRange error 2 개 누적", () => {
    const v = validateExportScope({
      scope: "range",
      dateRange: { start: "x", end: "y" },
    });
    expect(v.valid).toBe(false);
    expect(v.errors.filter((e) => e.field === "dateRange")).toHaveLength(2);
  });
});

describe("validateExportScope — non-mutating", () => {
  it("Object.freeze 한 input + 중첩 dateRange/entitySelector 통과, 원본 불변", () => {
    const selector = Object.freeze(["Assessment", "Person"]);
    const dateRange = Object.freeze({
      start: new Date(VALID_RANGE.start),
      end: new Date(VALID_RANGE.end),
    });
    const input = Object.freeze({
      scope: "range",
      dateRange,
      entitySelector: selector,
    });

    const v = validateExportScope(input);

    expect(v.valid).toBe(true);
    // 원본 배열 length/원소 불변 — normalized 는 새 배열.
    expect(selector).toHaveLength(2);
    expect(v.normalized?.entitySelector).not.toBe(selector);
    expect(v.normalized?.entitySelector).toEqual(["Assessment", "Person"]);
    // normalized.dateRange 는 새 Date — 원본 참조 아님.
    expect(v.normalized?.dateRange?.start).not.toBe(dateRange.start);
    expect(v.normalized?.dateRange?.start.getTime()).toBe(
      dateRange.start.getTime(),
    );
  });

  it("valid verdict 의 normalized 변형이 원본에 영향 없음", () => {
    const v = validateExportScope({
      scope: "partial",
      entitySelector: ["Group"],
    });
    expect(v.valid).toBe(true);
    // normalized 배열을 변형해도 helper 내부 상수에 영향 없는 새 배열인지(독립성) 확인.
    v.normalized?.entitySelector?.push("LlmConfig");
    const again = validateExportScope({
      scope: "partial",
      entitySelector: ["Group"],
    });
    expect(again.normalized?.entitySelector).toEqual(["Group"]);
  });
});

// selectExportRecords(T-0437)의 inline 검증 규칙과 동형인지 — validateExportScope 가 valid 로
// 판정한 normalized scope 는 selectExportRecords 가 throw 없이 소비 가능해야 한다(round-trip).
describe("validateExportScope — selectExportRecords round-trip (규칙 동형)", () => {
  it("valid normalized scope 는 ExportScope 타입에 부합한다", () => {
    const v = validateExportScope({ scope: "range", dateRange: VALID_RANGE });
    const scope: ExportScope | undefined = v.normalized;
    expect(scope?.scope).toBe("range");
  });
});

// T-0445 단일 source-of-truth 통합의 regression — validateExportScope 가 사용하는 허용 scope/
// entity 멤버십이 export-scope-select.ts 의 export 상수와 정확히 동일함을 직접 단언한다. 향후
// 한쪽(select 의 export 상수 또는 validate 의 검증 동작)만 바뀌면 본 test 가 fail 한다.
describe("validateExportScope — export 상수와 동일 멤버십 (T-0445 regression)", () => {
  it("export 상수의 모든 scope 는 validate 가 valid 로 받아들인다", () => {
    for (const scope of VALID_EXPORT_SCOPES) {
      if (scope === "full") {
        expect(validateExportScope({ scope }).valid).toBe(true);
      } else if (scope === "range") {
        expect(
          validateExportScope({ scope, dateRange: VALID_RANGE }).valid,
        ).toBe(true);
      } else {
        expect(
          validateExportScope({ scope, entitySelector: ["Assessment"] }).valid,
        ).toBe(true);
      }
    }
  });

  it("export 상수에 없는 scope 는 validate 가 reject (멤버십 동형)", () => {
    const v = validateExportScope({ scope: "everything" });
    expect(v.valid).toBe(false);
    expect(v.errors.some((e) => e.field === "scope")).toBe(true);
  });

  it("export 상수의 모든 entity 는 partial entitySelector 로 valid", () => {
    const v = validateExportScope({
      scope: "partial",
      entitySelector: [...VALID_EXPORT_ENTITIES],
    });
    expect(v.valid).toBe(true);
    expect(v.normalized?.entitySelector).toEqual([...VALID_EXPORT_ENTITIES]);
  });

  it("export 상수에 없는 entity 는 validate 가 reject (멤버십 동형)", () => {
    // VALID_EXPORT_ENTITIES 에 없는 값은 entitySelector error 로 거부돼야 한다.
    const v = validateExportScope({
      scope: "partial",
      entitySelector: ["NotAnEntity"],
    });
    expect(v.valid).toBe(false);
    expect(v.errors.some((e) => e.field === "entitySelector")).toBe(true);
  });
});
