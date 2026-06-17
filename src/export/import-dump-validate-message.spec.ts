// import-dump-validate-message 순수 helper spec — R-112 4 종(happy / error / branch / negative 충분
// cover). validateImportDumpStructure(T-0440)가 산출한 ImportDumpValidation verdict 에서
// buildDumpValidationMessage 가 {headline, detailLines[], blocking} 사람-친화 구조 검증 안내 메시지
// 모델을 정확히 합성하는지(valid=true / valid=false 2 분기 × blocking === !valid 불변 × 누적 issues
// 사람-친화 노출 순서 보존) + 입력 방어 분기(비-object validation · valid 비-boolean · issues 비-array
// · valid=false+빈 issues 모순)별 한국어 TypeError/RangeError + non-mutating(freeze 통과)을 검증한다
// (schema-version-message.spec.ts mirror).
import { ImportDumpValidation } from "./import-dump-validate";
import {
  DumpValidationMessage,
  buildDumpValidationMessage,
} from "./import-dump-validate-message";

// 정상 verdict 생성 헬퍼 — valid / issues override 를 받아 합성.
function makeValidation(
  over?: Partial<ImportDumpValidation>,
): ImportDumpValidation {
  return {
    valid: true,
    issues: [],
    ...over,
  };
}

describe("buildDumpValidationMessage — happy path", () => {
  it("valid=true verdict → 무결성 확인 headline + blocking=false + 확인 detailLine", () => {
    const validation = makeValidation({ valid: true, issues: [] });
    const msg: DumpValidationMessage = buildDumpValidationMessage(validation);

    expect(msg.blocking).toBe(false);
    expect(msg.headline).toContain("무결성 확인");
    expect(msg.detailLines.length).toBeGreaterThan(0);
    expect(msg.detailLines.some((l) => l.includes("복원을 진행"))).toBe(true);
  });

  it("valid=false verdict(issues 1+) → 거부 headline + blocking=true + 재확인 안내 라인", () => {
    const validation = makeValidation({
      valid: false,
      issues: ["records 는 배열이어야 합니다 (받음: object)"],
    });
    const msg = buildDumpValidationMessage(validation);

    expect(msg.blocking).toBe(true);
    expect(msg.headline).toContain("복원할 수 없습니다");
    expect(
      msg.detailLines.some((l) => l.includes("records 는 배열이어야 합니다")),
    ).toBe(true);
    expect(msg.detailLines.some((l) => l.includes("재업로드"))).toBe(true);
  });
});

describe("buildDumpValidationMessage — branch / flow cover", () => {
  it("valid=true 분기 → blocking=false (blocking === !valid 불변)", () => {
    const msg = buildDumpValidationMessage(makeValidation({ valid: true }));
    expect(msg.blocking).toBe(false);
    expect(msg.blocking).toBe(!true);
  });

  it("valid=false 분기 → blocking=true (blocking === !valid 불변)", () => {
    const validation = makeValidation({
      valid: false,
      issues: [
        "schemaVersion 은 비어있지 않은 string 이어야 합니다 (받음: undefined)",
      ],
    });
    const msg = buildDumpValidationMessage(validation);
    expect(msg.blocking).toBe(true);
    expect(msg.blocking).toBe(!false);
  });

  it("모든 분기 detailLines 는 비어있지 않다(headline + 최소 1 라인)", () => {
    const cases: ImportDumpValidation[] = [
      makeValidation({ valid: true, issues: [] }),
      makeValidation({ valid: false, issues: ["문제 1"] }),
    ];
    for (const validation of cases) {
      const msg = buildDumpValidationMessage(validation);
      expect(msg.headline.length).toBeGreaterThan(0);
      expect(msg.detailLines.length).toBeGreaterThan(0);
    }
  });
});

describe("buildDumpValidationMessage — error path / negative cases 충분 cover", () => {
  it("validation=null → TypeError(한국어 plain object)", () => {
    expect(() => buildDumpValidationMessage(null as never)).toThrow(TypeError);
    expect(() => buildDumpValidationMessage(null as never)).toThrow(
      /plain object/,
    );
  });

  it("validation=undefined → TypeError", () => {
    expect(() => buildDumpValidationMessage(undefined as never)).toThrow(
      TypeError,
    );
  });

  it("validation=배열 → TypeError(plain object)", () => {
    expect(() => buildDumpValidationMessage([] as never)).toThrow(
      /plain object/,
    );
  });

  it("validation=숫자(비-object) → TypeError", () => {
    expect(() => buildDumpValidationMessage(42 as never)).toThrow(TypeError);
  });

  it("validation=문자열(비-object) → TypeError", () => {
    expect(() => buildDumpValidationMessage("valid" as never)).toThrow(
      TypeError,
    );
  });

  it("valid 부재 → TypeError(boolean)", () => {
    const validation = makeValidation();
    delete (validation as unknown as Record<string, unknown>).valid;
    expect(() => buildDumpValidationMessage(validation)).toThrow(TypeError);
    expect(() => buildDumpValidationMessage(validation)).toThrow(/boolean/);
  });

  it("valid 비-boolean(문자열) → TypeError", () => {
    const validation = makeValidation({ valid: "true" as never });
    expect(() => buildDumpValidationMessage(validation)).toThrow(/boolean/);
  });

  it("valid 비-boolean(숫자) → TypeError", () => {
    const validation = makeValidation({ valid: 1 as never });
    expect(() => buildDumpValidationMessage(validation)).toThrow(TypeError);
  });

  it("valid 비-boolean(null) → TypeError", () => {
    const validation = makeValidation({ valid: null as never });
    expect(() => buildDumpValidationMessage(validation)).toThrow(/boolean/);
  });

  it("issues 부재 → TypeError(배열)", () => {
    const validation = makeValidation({ valid: true });
    delete (validation as unknown as Record<string, unknown>).issues;
    expect(() => buildDumpValidationMessage(validation)).toThrow(TypeError);
    expect(() => buildDumpValidationMessage(validation)).toThrow(/배열/);
  });

  it("issues 비-array(object) → TypeError", () => {
    const validation = makeValidation({ issues: {} as never });
    expect(() => buildDumpValidationMessage(validation)).toThrow(/배열/);
  });

  it("issues 비-array(문자열) → TypeError", () => {
    const validation = makeValidation({ issues: "문제" as never });
    expect(() => buildDumpValidationMessage(validation)).toThrow(TypeError);
  });

  it("issues 비-array(null) → TypeError", () => {
    const validation = makeValidation({ issues: null as never });
    expect(() => buildDumpValidationMessage(validation)).toThrow(/배열/);
  });

  it("valid=false 인데 issues 빈 배열(모순 verdict) → RangeError", () => {
    const validation = makeValidation({ valid: false, issues: [] });
    expect(() => buildDumpValidationMessage(validation)).toThrow(RangeError);
    expect(() => buildDumpValidationMessage(validation)).toThrow(
      /reject 사유가 0/,
    );
  });
});

describe("buildDumpValidationMessage — negative / 경계 입력 처리", () => {
  it("다중 issues 누적 → detailLines 에 원본 순서 보존 노출", () => {
    const validation = makeValidation({
      valid: false,
      issues: ["issue-A", "issue-B", "issue-C"],
    });
    const msg = buildDumpValidationMessage(validation);

    const aIdx = msg.detailLines.findIndex((l) => l.includes("issue-A"));
    const bIdx = msg.detailLines.findIndex((l) => l.includes("issue-B"));
    const cIdx = msg.detailLines.findIndex((l) => l.includes("issue-C"));
    expect(aIdx).toBeGreaterThanOrEqual(0);
    expect(aIdx).toBeLessThan(bIdx);
    expect(bIdx).toBeLessThan(cIdx);
  });

  it("valid=true 인데 issues 비어있지 않은 경계 입력 → 무결성 메시지(blocking=false, issues 무시)", () => {
    // validateImportDumpStructure 정상 흐름엔 valid=true ⇒ issues=[] 이나, helper 는 verdict 를
    // 재계산하지 않고 valid 분기만 신뢰한다 — valid=true 면 issues 가 있어도 무결성 메시지.
    const validation = makeValidation({
      valid: true,
      issues: ["잔존 진단 문자열"],
    });
    const msg = buildDumpValidationMessage(validation);
    expect(msg.blocking).toBe(false);
    expect(msg.headline).toContain("무결성 확인");
    expect(msg.detailLines.some((l) => l.includes("잔존 진단 문자열"))).toBe(
      false,
    );
  });

  it("issues 원소가 빈 문자열인 경계 → detailLine 으로 그대로 노출(throw 0)", () => {
    const validation = makeValidation({ valid: false, issues: [""] });
    const msg = buildDumpValidationMessage(validation);
    expect(msg.blocking).toBe(true);
    expect(msg.detailLines.some((l) => l.includes("확인된 문제:"))).toBe(true);
  });
});

describe("buildDumpValidationMessage — non-mutating regression", () => {
  it("freeze 된 valid=true validation 으로 호출해도 throw 0 + 입력 불변", () => {
    const validation = Object.freeze(
      makeValidation({
        valid: true,
        issues: Object.freeze([]) as unknown as string[],
      }),
    );
    const before = JSON.stringify(validation);
    expect(() => buildDumpValidationMessage(validation)).not.toThrow();
    const msg = buildDumpValidationMessage(validation);
    expect(msg.detailLines.length).toBeGreaterThan(0);
    expect(JSON.stringify(validation)).toBe(before);
  });

  it("freeze 된 validation + freeze 된 issues 배열로 호출해도 throw 0 + 입력 불변", () => {
    const validation = Object.freeze(
      makeValidation({
        valid: false,
        issues: Object.freeze(["issue-X", "issue-Y"]) as unknown as string[],
      }),
    );
    const before = JSON.stringify(validation);
    expect(() => buildDumpValidationMessage(validation)).not.toThrow();
    const msg = buildDumpValidationMessage(validation);
    expect(msg.detailLines.some((l) => l.includes("issue-X"))).toBe(true);
    expect(JSON.stringify(validation)).toBe(before);
  });
});
