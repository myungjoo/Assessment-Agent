// SummaryAggregateRequestDto / SummaryAggregateUnitResultDto spec — CI
// scripts/check-spec-presence.sh 가 신규 production .ts 에 동반 spec 의무를 강제한다.
// class-validator decorator 동작을 isolated 하게 검증하며(ValidationPipe 미경유),
// controller-scope 통합 검증은 소비처 slice(배선 2/2)의 controller spec 이 별도 cover 한다.
// `evaluate-activities.dto.spec.ts`(T-0293) 패턴 1:1 mirror — plainToInstance + validate
// 직접 호출, constraint 키 단언(R-112 — happy / error / branch / negative 충분 cover).
//
// 본 spec 의 cover scope:
//   - SummaryAggregateRequestDto 6 필드: personId / period / periodStart / mode / modelId /
//     results.
//   - SummaryAggregateUnitResultDto 5 필드: unitId / narrative / difficulty / contribution /
//     volume.
//   - 분기: results 빈 배열(허용) vs 원소 결함(nested 오류가 children 으로 전파).
//   - 계약 보존: narrative 빈 문자열 허용, 허용 literal 검증 부재(@IsIn 0 개 — period/mode/
//     difficulty/contribution 의 임의 literal 이 DTO 를 통과).
//   - whitelistValidation(forbidNonWhitelisted) — top-level / nested 양쪽 잉여 필드 거부.
import "reflect-metadata";

import { plainToInstance } from "class-transformer";
import {
  validate,
  type ValidationError,
  type ValidatorOptions,
} from "class-validator";

import {
  SummaryAggregateRequestDto,
  SummaryAggregateUnitResultDto,
} from "./summary-aggregate-request.dto";

// 유효한 단위 평가 1 건 — `EvaluationResult` 5 필드의 HTTP 표현. 개별 negative 는 이 base
// 에서 한 field 만 변형한다.
const validUnitResult = {
  unitId: "github:com:abc123",
  narrative: "리팩터링 PR 을 주도해 모듈 경계를 정리했다.",
  difficulty: "medium",
  contribution: "high",
  volume: 12,
};

const validUnitResultSecond = {
  unitId: "confluence:wiki-eng:page-42",
  narrative: "설계 문서를 갱신해 배경 맥락을 남겼다.",
  difficulty: "easy",
  contribution: "medium",
  volume: 3,
};

// 유효한 종합 요청 payload — 좌표 3-tuple + mode + modelId + 중첩 results 2 건.
const validRequestPayload = {
  personId: "person-1",
  period: "week",
  periodStart: "2026-06-01T00:00:00.000Z",
  mode: "fill",
  modelId: "gpt-4o-mini",
  results: [validUnitResult, validUnitResultSecond],
};

// helper — plain 객체 → SummaryAggregateRequestDto instance 변환 후 validate. 반환은 raw
// `ValidationError[]` 로, children 구조(nested 전파)를 단언하는 분기 test 가 쓴다.
async function validateRequestRaw(
  payload: unknown,
  options?: ValidatorOptions,
): Promise<ValidationError[]> {
  const dto = plainToInstance(SummaryAggregateRequestDto, payload);
  return validate(dto, options);
}

// helper — 자기 / nested constraint 키를 평탄화한 목록. 대부분의 negative 가 쓴다.
function flattenConstraints(errors: ValidationError[]): string[] {
  const flat: string[] = [];
  const walk = (errs: ValidationError[]): void => {
    for (const e of errs) {
      if (e.constraints) flat.push(...Object.keys(e.constraints));
      if (e.children && e.children.length > 0) walk(e.children);
    }
  };
  walk(errors);
  return flat;
}

async function validateRequestPlain(
  payload: unknown,
  options?: ValidatorOptions,
): Promise<string[]> {
  return flattenConstraints(await validateRequestRaw(payload, options));
}

// helper — nested DTO 단독 검증용.
async function validateUnitPlain(
  payload: unknown,
  options?: ValidatorOptions,
): Promise<string[]> {
  const dto = plainToInstance(SummaryAggregateUnitResultDto, payload);
  const errors = await validate(dto, options);
  return errors.flatMap((e) => Object.keys(e.constraints ?? {}));
}

describe("SummaryAggregateRequestDto", () => {
  // --------------------------------------------------------------------------
  // happy (R-112 #1)
  // --------------------------------------------------------------------------
  it("6 필드 정상 payload(중첩 results 2 건)는 errors 빈 배열을 반환한다 (happy)", async () => {
    const errors = await validateRequestRaw(validRequestPayload);
    expect(errors).toEqual([]);
  });

  it("mode='reeval' 도 errors 빈 배열을 반환한다 (happy — mode 분기)", async () => {
    const errors = await validateRequestPlain({
      ...validRequestPayload,
      mode: "reeval",
    });
    expect(errors).toEqual([]);
  });

  it("results 원소의 narrative 가 빈 문자열이어도 통과한다 (happy — 빈 평가문 흡수 계약 보존)", async () => {
    const errors = await validateRequestPlain({
      ...validRequestPayload,
      results: [{ ...validUnitResult, narrative: "" }],
    });
    expect(errors).toEqual([]);
  });

  it("volume=0 경계값도 통과한다 (boundary — @Min(0) 은 0 포함)", async () => {
    const errors = await validateRequestPlain({
      ...validRequestPayload,
      results: [{ ...validUnitResult, volume: 0 }],
    });
    expect(errors).toEqual([]);
  });

  // --------------------------------------------------------------------------
  // 분기 (R-112 #3): results 빈 배열(허용) vs 원소 결함(nested 전파).
  // --------------------------------------------------------------------------
  it("results 가 빈 배열이면 통과한다 (branch — @ArrayMinSize 미적용, 활동 없는 기간 허용)", async () => {
    const errors = await validateRequestRaw({
      ...validRequestPayload,
      results: [],
    });
    expect(errors).toEqual([]);
  });

  it("results 원소가 불량이면 results 오류의 children 에 nested 오류가 실린다 (branch — nested 전파)", async () => {
    const errors = await validateRequestRaw({
      ...validRequestPayload,
      results: [{ ...validUnitResult, unitId: "" }],
    });
    const resultsError = errors.find((e) => e.property === "results");
    expect(resultsError).toBeDefined();
    // 배열 index 노드 → 실제 필드 노드 2 단 중첩. 평탄화 결과에 nested constraint 존재.
    expect(resultsError?.children?.length).toBeGreaterThan(0);
    expect(flattenConstraints(errors)).toEqual(
      expect.arrayContaining(["isNotEmpty"]),
    );
  });

  it("results 원소 2 건 중 1 건만 불량이어도 nested 오류가 전파된다 (branch — each 개별 검증)", async () => {
    const errors = await validateRequestRaw({
      ...validRequestPayload,
      results: [validUnitResult, { ...validUnitResultSecond, volume: -1 }],
    });
    expect(errors.some((e) => e.property === "results")).toBe(true);
    expect(flattenConstraints(errors)).toEqual(expect.arrayContaining(["min"]));
  });

  // --------------------------------------------------------------------------
  // error path (R-112 #2): 필수 필드 누락 · 타입 불일치.
  // --------------------------------------------------------------------------
  it("personId 누락 시 isNotEmpty 위반 (error — required field missing)", async () => {
    const broken: Record<string, unknown> = { ...validRequestPayload };
    delete broken.personId;
    const errors = await validateRequestRaw(broken);
    const personIdError = errors.find((e) => e.property === "personId");
    expect(Object.keys(personIdError?.constraints ?? {})).toEqual(
      expect.arrayContaining(["isNotEmpty"]),
    );
  });

  it("results 가 배열이 아니면 isArray 위반 (error — wrong type)", async () => {
    const errors = await validateRequestRaw({
      ...validRequestPayload,
      results: "not-an-array",
    });
    const resultsError = errors.find((e) => e.property === "results");
    expect(Object.keys(resultsError?.constraints ?? {})).toEqual(
      expect.arrayContaining(["isArray"]),
    );
  });

  it("results 누락 시 isArray 위반 (error — required array missing)", async () => {
    const broken: Record<string, unknown> = { ...validRequestPayload };
    delete broken.results;
    const errors = await validateRequestPlain(broken);
    expect(errors).toEqual(expect.arrayContaining(["isArray"]));
  });

  // --------------------------------------------------------------------------
  // negative (R-112 #4): 예외 분기마다 1+ — 총 8 종 이상.
  // --------------------------------------------------------------------------
  it("periodStart 가 비-ISO 문자열('2026-13-99') 이면 isIso8601 위반 (negative — opaque Invalid Date 차단)", async () => {
    const errors = await validateRequestPlain({
      ...validRequestPayload,
      periodStart: "2026-13-99",
    });
    expect(errors).toEqual(expect.arrayContaining(["isIso8601"]));
  });

  it("periodStart 가 빈 문자열이면 isNotEmpty 위반 (negative — empty string)", async () => {
    const errors = await validateRequestPlain({
      ...validRequestPayload,
      periodStart: "",
    });
    expect(errors).toEqual(expect.arrayContaining(["isNotEmpty"]));
  });

  it("results 원소의 volume 이 음수면 min 위반 (negative — 음수 수치가 prompt 로 유입되는 경로 차단)", async () => {
    const errors = await validateRequestPlain({
      ...validRequestPayload,
      results: [{ ...validUnitResult, volume: -3 }],
    });
    expect(errors).toEqual(expect.arrayContaining(["min"]));
  });

  it("results 원소의 volume 이 비정수(1.5) 면 isInt 위반 (negative — 소수 거부)", async () => {
    const errors = await validateRequestPlain({
      ...validRequestPayload,
      results: [{ ...validUnitResult, volume: 1.5 }],
    });
    expect(errors).toEqual(expect.arrayContaining(["isInt"]));
  });

  it("results 원소의 unitId 가 빈 문자열이면 isNotEmpty 위반 (negative — trace 축 공백 거부)", async () => {
    const errors = await validateRequestPlain({
      ...validRequestPayload,
      results: [{ ...validUnitResult, unitId: "" }],
    });
    expect(errors).toEqual(expect.arrayContaining(["isNotEmpty"]));
  });

  it("mode 가 비-string(123) 이면 isString 위반 (negative — wrong type)", async () => {
    const errors = await validateRequestPlain({
      ...validRequestPayload,
      mode: 123,
    });
    expect(errors).toEqual(expect.arrayContaining(["isString"]));
  });

  it("modelId 누락 시 isNotEmpty 위반 (negative — required field missing)", async () => {
    const broken: Record<string, unknown> = { ...validRequestPayload };
    delete broken.modelId;
    const errors = await validateRequestPlain(broken);
    expect(errors).toEqual(expect.arrayContaining(["isNotEmpty"]));
  });

  it("정의 외 필드(rawBody) 는 forbidNonWhitelisted 로 whitelistValidation 위반 (negative — extra field)", async () => {
    const errors = await validateRequestPlain(
      { ...validRequestPayload, rawBody: "긴 raw 본문" },
      { whitelist: true, forbidNonWhitelisted: true },
    );
    expect(errors).toEqual(expect.arrayContaining(["whitelistValidation"]));
  });

  it("results 원소의 정의 외 필드도 whitelistValidation 위반 (negative — nested extra field)", async () => {
    const errors = await validateRequestPlain(
      {
        ...validRequestPayload,
        results: [{ ...validUnitResult, rawBody: "긴 raw 본문" }],
      },
      { whitelist: true, forbidNonWhitelisted: true },
    );
    expect(errors).toEqual(expect.arrayContaining(["whitelistValidation"]));
  });

  it.each(["personId", "period", "mode", "modelId"] as const)(
    "필수 문자열 필드 %s 가 number 면 isString 위반 (negative — wrong type)",
    async (field) => {
      const errors = await validateRequestPlain({
        ...validRequestPayload,
        [field]: 123,
      });
      expect(errors).toEqual(expect.arrayContaining(["isString"]));
    },
  );

  it.each(["personId", "period", "mode", "modelId"] as const)(
    "필수 문자열 필드 %s 가 빈 문자열이면 isNotEmpty 위반 (negative — empty string)",
    async (field) => {
      const errors = await validateRequestPlain({
        ...validRequestPayload,
        [field]: "",
      });
      expect(errors).toEqual(expect.arrayContaining(["isNotEmpty"]));
    },
  );

  // --------------------------------------------------------------------------
  // 계약 보존: 허용 literal 검증은 DTO 밖(@IsIn 0 개).
  // --------------------------------------------------------------------------
  it("period / mode 가 허용 외 literal 이어도 DTO 는 통과시킨다 (계약 — @IsIn 0 개, literal 정본은 service)", async () => {
    const errors = await validateRequestPlain({
      ...validRequestPayload,
      period: "fortnight",
      mode: "reevaluate",
    });
    expect(errors).toEqual([]);
  });
});

describe("SummaryAggregateUnitResultDto", () => {
  // --------------------------------------------------------------------------
  // happy + 계약
  // --------------------------------------------------------------------------
  it("정상 unit payload 는 errors 빈 배열을 반환한다 (happy)", async () => {
    const errors = await validateUnitPlain(validUnitResult);
    expect(errors).toEqual([]);
  });

  it("difficulty / contribution 이 허용 외 literal 이어도 통과한다 (계약 — 등급 정본은 domain type-guard)", async () => {
    const errors = await validateUnitPlain({
      ...validUnitResult,
      difficulty: "impossible",
      contribution: "stellar",
    });
    expect(errors).toEqual([]);
  });

  // --------------------------------------------------------------------------
  // negative: 5 필드 각각의 결함.
  // --------------------------------------------------------------------------
  it.each(["unitId", "difficulty", "contribution"] as const)(
    "필수 문자열 필드 %s 누락 시 isNotEmpty 위반 (negative — required field missing)",
    async (field) => {
      const broken: Record<string, unknown> = { ...validUnitResult };
      delete broken[field];
      const errors = await validateUnitPlain(broken);
      expect(errors).toEqual(expect.arrayContaining(["isNotEmpty"]));
    },
  );

  it("narrative 누락 시 isString 위반 (negative — 빈 문자열은 허용이되 부재는 거부)", async () => {
    const broken: Record<string, unknown> = { ...validUnitResult };
    delete broken.narrative;
    const errors = await validateUnitPlain(broken);
    expect(errors).toEqual(expect.arrayContaining(["isString"]));
  });

  it("narrative 가 number 면 isString 위반 (negative — wrong type)", async () => {
    const errors = await validateUnitPlain({
      ...validUnitResult,
      narrative: 42,
    });
    expect(errors).toEqual(expect.arrayContaining(["isString"]));
  });

  it("volume 이 string 이면 isInt 위반 (negative — wrong type, 암시적 변환 없음)", async () => {
    const errors = await validateUnitPlain({
      ...validUnitResult,
      volume: "12",
    });
    expect(errors).toEqual(expect.arrayContaining(["isInt"]));
  });

  it("volume 누락 시 isInt 위반 (negative — required number missing)", async () => {
    const broken: Record<string, unknown> = { ...validUnitResult };
    delete broken.volume;
    const errors = await validateUnitPlain(broken);
    expect(errors).toEqual(expect.arrayContaining(["isInt"]));
  });

  it("정의 외 필드(rawBody) 는 forbidNonWhitelisted 로 whitelistValidation 위반 (negative — extra field)", async () => {
    const errors = await validateUnitPlain(
      { ...validUnitResult, rawBody: "긴 raw 본문" },
      { whitelist: true, forbidNonWhitelisted: true },
    );
    expect(errors).toEqual(expect.arrayContaining(["whitelistValidation"]));
  });
});
