// export-scope-rejection-message 순수 helper spec — R-112 4 종(happy / error / branch / negative
// 충분 cover). validateExportScope(T-0444)가 산출한 ExportScopeValidation verdict 에서
// buildExportScopeRejection 이 {headline, detailLines[], blocking} 사람-친화 검증 실패 안내 메시지
// 모델을 정확히 합성하는지(valid=true / valid=false 2 분기 × 단일 field / 다중 field 묶음 분기 ×
// blocking === !valid 불변 × field 별 묶음 순서·원본 message 보존) + 입력 방어 분기(비-object
// validation · valid 비-boolean · errors 비-array · valid=false+빈 errors 모순)별 한국어
// TypeError/RangeError + 깨진 error 원소 graceful + non-mutating(deepFreeze 통과)을 검증한다
// (import-dump-validate-message.spec.ts mirror).
import {
  ExportScopeRejectionMessage,
  buildExportScopeRejection,
} from "./export-scope-rejection-message";
import {
  ExportScopeError,
  ExportScopeValidation,
} from "./export-scope-validate";

// 정상 verdict 생성 헬퍼 — valid / errors override 를 받아 합성.
function makeValidation(
  over?: Partial<ExportScopeValidation>,
): ExportScopeValidation {
  return {
    valid: true,
    errors: [],
    ...over,
  };
}

// errors 원소 생성 헬퍼.
function err(
  field: ExportScopeError["field"],
  message: string,
): ExportScopeError {
  return { field, message };
}

// 중첩 구조까지 freeze — non-mutating regression 단언용.
function deepFreeze<T>(obj: T): T {
  if (obj && typeof obj === "object") {
    Object.values(obj as Record<string, unknown>).forEach((v) => deepFreeze(v));
    Object.freeze(obj);
  }
  return obj;
}

describe("buildExportScopeRejection — happy path", () => {
  it("valid=true verdict → 통과 headline + blocking=false + 확인 detailLine", () => {
    const validation = makeValidation({ valid: true, errors: [] });
    const msg: ExportScopeRejectionMessage =
      buildExportScopeRejection(validation);

    expect(msg.blocking).toBe(false);
    expect(msg.headline).toContain("검증 통과");
    expect(msg.detailLines.length).toBeGreaterThan(0);
    expect(msg.detailLines.some((l) => l.includes("진행할 수 있습니다"))).toBe(
      true,
    );
  });

  it("valid=false 단일 field 위반 verdict → reject headline + blocking=true + 묶음 안내 + 재입력 라인", () => {
    const validation = makeValidation({
      valid: false,
      errors: [
        err(
          "scope",
          "scope 는 full/range/partial 중 하나여야 합니다 (받음: x)",
        ),
      ],
    });
    const msg = buildExportScopeRejection(validation);

    expect(msg.blocking).toBe(true);
    expect(msg.headline).toContain("검증 실패");
    expect(msg.headline).toContain("1개 항목");
    expect(
      msg.detailLines.some(
        (l) =>
          l.includes("scope 옵션") &&
          l.includes("full/range/partial 중 하나여야 합니다"),
      ),
    ).toBe(true);
    expect(msg.detailLines.some((l) => l.includes("다시 시도하세요"))).toBe(
      true,
    );
  });

  it("valid=false 다중 field 위반 verdict → 항목 수 요약 + field 별 묶음 detailLines", () => {
    const validation = makeValidation({
      valid: false,
      errors: [
        err("scope", "scope 부적합"),
        err("dateRange", "start < end 가 아닙니다"),
        err("entitySelector", "허용 외 entity"),
      ],
    });
    const msg = buildExportScopeRejection(validation);

    expect(msg.blocking).toBe(true);
    expect(msg.headline).toContain("3개 항목");
    expect(msg.detailLines.some((l) => l.includes("scope 부적합"))).toBe(true);
    expect(msg.detailLines.some((l) => l.includes("start < end"))).toBe(true);
    expect(msg.detailLines.some((l) => l.includes("허용 외 entity"))).toBe(
      true,
    );
  });
});

describe("buildExportScopeRejection — branch / flow cover", () => {
  it("valid=true 분기 → blocking=false (blocking === !valid 불변)", () => {
    const msg = buildExportScopeRejection(makeValidation({ valid: true }));
    expect(msg.blocking).toBe(false);
    expect(msg.blocking).toBe(!true);
  });

  it("valid=false 분기 → blocking=true (blocking === !valid 불변)", () => {
    const validation = makeValidation({
      valid: false,
      errors: [err("scope", "부적합")],
    });
    const msg = buildExportScopeRejection(validation);
    expect(msg.blocking).toBe(true);
    expect(msg.blocking).toBe(!false);
  });

  it("같은 field 다중 message → 한 묶음 라인으로 합쳐 노출(message 보존)", () => {
    const validation = makeValidation({
      valid: false,
      errors: [
        err("dateRange", "dateRange.start 는 유효한 Date instance 여야 합니다"),
        err("dateRange", "dateRange.end 는 유효한 Date instance 여야 합니다"),
      ],
    });
    const msg = buildExportScopeRejection(validation);

    // 두 message 가 dateRange 한 묶음 안에 모두 보존.
    const line = msg.detailLines.find((l) => l.includes("기간(dateRange)"));
    expect(line).toBeDefined();
    expect(line).toContain("dateRange.start 는 유효한 Date instance");
    expect(line).toContain("dateRange.end 는 유효한 Date instance");
    // 단일 field 위반이므로 항목 수는 1.
    expect(msg.headline).toContain("1개 항목");
  });

  it("field 묶음 순서는 scope → dateRange → entitySelector 고정(입력 순서 무관)", () => {
    const validation = makeValidation({
      valid: false,
      errors: [
        err("entitySelector", "entity 부적합"),
        err("scope", "scope 부적합"),
        err("dateRange", "기간 부적합"),
      ],
    });
    const msg = buildExportScopeRejection(validation);

    const sIdx = msg.detailLines.findIndex((l) => l.includes("scope 옵션"));
    const dIdx = msg.detailLines.findIndex((l) =>
      l.includes("기간(dateRange)"),
    );
    const eIdx = msg.detailLines.findIndex((l) =>
      l.includes("대상 선택(entitySelector)"),
    );
    expect(sIdx).toBeGreaterThanOrEqual(0);
    expect(sIdx).toBeLessThan(dIdx);
    expect(dIdx).toBeLessThan(eIdx);
  });

  it("모든 분기 headline + detailLines 는 비어있지 않다", () => {
    const cases: ExportScopeValidation[] = [
      makeValidation({ valid: true, errors: [] }),
      makeValidation({ valid: false, errors: [err("scope", "부적합")] }),
    ];
    for (const validation of cases) {
      const msg = buildExportScopeRejection(validation);
      expect(msg.headline.length).toBeGreaterThan(0);
      expect(msg.detailLines.length).toBeGreaterThan(0);
    }
  });
});

describe("buildExportScopeRejection — error path / negative cases 충분 cover", () => {
  it("validation=null → TypeError(한국어 plain object)", () => {
    expect(() => buildExportScopeRejection(null as never)).toThrow(TypeError);
    expect(() => buildExportScopeRejection(null as never)).toThrow(
      /plain object/,
    );
  });

  it("validation=undefined → TypeError", () => {
    expect(() => buildExportScopeRejection(undefined as never)).toThrow(
      TypeError,
    );
  });

  it("validation=배열 → TypeError(plain object)", () => {
    expect(() => buildExportScopeRejection([] as never)).toThrow(
      /plain object/,
    );
  });

  it("validation=숫자(비-object) → TypeError", () => {
    expect(() => buildExportScopeRejection(42 as never)).toThrow(TypeError);
  });

  it("validation=문자열(비-object) → TypeError", () => {
    expect(() => buildExportScopeRejection("valid" as never)).toThrow(
      TypeError,
    );
  });

  it("valid 부재 → TypeError(boolean)", () => {
    const validation = makeValidation();
    delete (validation as unknown as Record<string, unknown>).valid;
    expect(() => buildExportScopeRejection(validation)).toThrow(TypeError);
    expect(() => buildExportScopeRejection(validation)).toThrow(/boolean/);
  });

  it("valid 비-boolean(문자열) → TypeError", () => {
    const validation = makeValidation({ valid: "true" as never });
    expect(() => buildExportScopeRejection(validation)).toThrow(/boolean/);
  });

  it("valid 비-boolean(숫자) → TypeError", () => {
    const validation = makeValidation({ valid: 1 as never });
    expect(() => buildExportScopeRejection(validation)).toThrow(TypeError);
  });

  it("valid 비-boolean(null) → TypeError", () => {
    const validation = makeValidation({ valid: null as never });
    expect(() => buildExportScopeRejection(validation)).toThrow(/boolean/);
  });

  it("errors 부재 → TypeError(배열)", () => {
    const validation = makeValidation({ valid: true });
    delete (validation as unknown as Record<string, unknown>).errors;
    expect(() => buildExportScopeRejection(validation)).toThrow(TypeError);
    expect(() => buildExportScopeRejection(validation)).toThrow(/배열/);
  });

  it("errors 비-array(object) → TypeError", () => {
    const validation = makeValidation({ errors: {} as never });
    expect(() => buildExportScopeRejection(validation)).toThrow(/배열/);
  });

  it("errors 비-array(문자열) → TypeError", () => {
    const validation = makeValidation({ errors: "문제" as never });
    expect(() => buildExportScopeRejection(validation)).toThrow(TypeError);
  });

  it("errors 비-array(null) → TypeError", () => {
    const validation = makeValidation({ errors: null as never });
    expect(() => buildExportScopeRejection(validation)).toThrow(/배열/);
  });

  it("valid=false 인데 errors 빈 배열(모순 verdict) → RangeError", () => {
    const validation = makeValidation({ valid: false, errors: [] });
    expect(() => buildExportScopeRejection(validation)).toThrow(RangeError);
    expect(() => buildExportScopeRejection(validation)).toThrow(
      /reject 사유가 0/,
    );
  });
});

describe("buildExportScopeRejection — negative / 경계 입력 처리", () => {
  it("valid=true 인데 errors 비어있지 않은 경계 입력 → 통과 메시지(blocking=false, errors 무시)", () => {
    // validateExportScope 정상 흐름엔 valid=true ⇒ errors=[] 이나, helper 는 verdict 를
    // 재계산하지 않고 valid 분기만 신뢰한다 — valid=true 면 errors 가 있어도 통과 메시지.
    const validation = makeValidation({
      valid: true,
      errors: [err("scope", "잔존 진단")],
    });
    const msg = buildExportScopeRejection(validation);
    expect(msg.blocking).toBe(false);
    expect(msg.headline).toContain("검증 통과");
    expect(msg.detailLines.some((l) => l.includes("잔존 진단"))).toBe(false);
  });

  it("error 원소가 비-object(string) → throw 0 + fallback 라인으로 graceful 노출", () => {
    const validation = makeValidation({
      valid: false,
      errors: ["깨진 원소" as never],
    });
    const msg = buildExportScopeRejection(validation);
    expect(msg.blocking).toBe(true);
    expect(msg.detailLines.some((l) => l.includes("알 수 없는 항목"))).toBe(
      true,
    );
  });

  it("error 원소의 field 가 union 외 값 → fallback 라인(graceful, throw 0)", () => {
    const validation = makeValidation({
      valid: false,
      errors: [{ field: "unknownField", message: "메시지" } as never],
    });
    const msg = buildExportScopeRejection(validation);
    expect(msg.blocking).toBe(true);
    expect(msg.detailLines.some((l) => l.includes("알 수 없는 항목"))).toBe(
      true,
    );
  });

  it("error 원소의 message 가 비-string → fallback 라인(graceful, throw 0)", () => {
    const validation = makeValidation({
      valid: false,
      errors: [{ field: "scope", message: 42 } as never],
    });
    const msg = buildExportScopeRejection(validation);
    expect(msg.blocking).toBe(true);
    expect(msg.detailLines.some((l) => l.includes("알 수 없는 항목"))).toBe(
      true,
    );
  });

  it("정상 error + 깨진 error 혼재 → 정상은 field 묶음, 깨진 건 fallback (둘 다 노출)", () => {
    const validation = makeValidation({
      valid: false,
      errors: [err("scope", "scope 부적합"), null as never],
    });
    const msg = buildExportScopeRejection(validation);
    expect(msg.detailLines.some((l) => l.includes("scope 부적합"))).toBe(true);
    expect(msg.detailLines.some((l) => l.includes("알 수 없는 항목"))).toBe(
      true,
    );
    // 정상 field 1 + 깨진 묶음 1 = 2 항목.
    expect(msg.headline).toContain("2개 항목");
  });

  it("error 원소의 message 가 빈 문자열인 경계 → 묶음 라인으로 그대로 노출(throw 0)", () => {
    const validation = makeValidation({
      valid: false,
      errors: [err("scope", "")],
    });
    const msg = buildExportScopeRejection(validation);
    expect(msg.blocking).toBe(true);
    expect(msg.detailLines.some((l) => l.includes("scope 옵션"))).toBe(true);
  });
});

describe("buildExportScopeRejection — non-mutating regression", () => {
  it("deepFreeze 된 valid=true validation 으로 호출해도 throw 0 + 입력 불변", () => {
    const validation = deepFreeze(makeValidation({ valid: true, errors: [] }));
    const before = JSON.stringify(validation);
    expect(() => buildExportScopeRejection(validation)).not.toThrow();
    const msg = buildExportScopeRejection(validation);
    expect(msg.detailLines.length).toBeGreaterThan(0);
    expect(JSON.stringify(validation)).toBe(before);
  });

  it("deepFreeze 된 valid=false validation + errors 배열로 호출해도 throw 0 + 입력 불변", () => {
    const validation = deepFreeze(
      makeValidation({
        valid: false,
        errors: [err("scope", "scope 부적합"), err("dateRange", "기간 부적합")],
      }),
    );
    const before = JSON.stringify(validation);
    expect(() => buildExportScopeRejection(validation)).not.toThrow();
    const msg = buildExportScopeRejection(validation);
    expect(msg.detailLines.some((l) => l.includes("scope 부적합"))).toBe(true);
    expect(JSON.stringify(validation)).toBe(before);
  });

  it("detailLines 는 입력 message 를 변형 없이 보존한다", () => {
    const original =
      "dateRange 는 start < end 인 반열림 구간이어야 합니다 (start=X, end=Y)";
    const validation = makeValidation({
      valid: false,
      errors: [err("dateRange", original)],
    });
    const msg = buildExportScopeRejection(validation);
    const line = msg.detailLines.find((l) => l.includes("기간(dateRange)"));
    expect(line).toContain(original);
  });
});
