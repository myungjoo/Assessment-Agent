// PeriodBridgeDto spec — CI scripts/check-spec-presence.sh 가 신규 production .ts 에 동반
// spec 의무 강제. class-validator decorator 동작을 isolated 하게 검증(controller 의
// ValidationPipe 통합 검증은 slice 3 controller spec / slice 5 e2e 가 cover). ADR-0037
// slice 1 의 R-112 test posture(happy / error / branch / negative 충분 cover).
// collect-trigger.dto.spec.ts / evaluate-activities.dto 패턴 mirror.
import "reflect-metadata";

import { plainToInstance } from "class-transformer";
import { validate, type ValidatorOptions } from "class-validator";

import { PeriodBridgeDto } from "./period-bridge.dto";

// 정상 payload — 모든 happy-path 의 base. 개별 negative 는 이 base 에서 한 field 만 변형.
const validPayload = {
  personId: "person-1",
  period: "week",
  scope: "commit",
  periodStart: "2026-05-01T00:00:00.000Z",
};

// helper — validPayload 에서 한 field 를 제거한 clone(누락 negative 용).
function withoutField(
  field: keyof typeof validPayload,
): Record<string, unknown> {
  const clone: Record<string, unknown> = { ...validPayload };
  delete clone[field];
  return clone;
}

// helper — plain 객체 → DTO instance 변환 후 validate. constraint key 목록 반환(어떤
// decorator 가 실패했는지 식별). options 로 whitelist/forbidNonWhitelisted 검증도 지원.
async function validatePlain(
  payload: unknown,
  options?: ValidatorOptions,
): Promise<string[]> {
  const dto = plainToInstance(PeriodBridgeDto, payload);
  const errors = await validate(dto, options);
  return errors.flatMap((e) => Object.keys(e.constraints ?? {}));
}

describe("PeriodBridgeDto", () => {
  // --------------------------------------------------------------------------
  // happy (R-112 #1): 4 좌표 필드 모두 정상(optional 미지정) → errors 빈 배열.
  // --------------------------------------------------------------------------
  it("정상 payload(optional 미지정)는 errors 빈 배열을 반환한다 (happy)", async () => {
    const errors = await validatePlain(validPayload);
    expect(errors).toEqual([]);
  });

  // --------------------------------------------------------------------------
  // error path (R-112 #2): 필수 4 필드 각 누락 시 validation error 발생.
  // --------------------------------------------------------------------------
  it.each(["personId", "period", "scope", "periodStart"] as const)(
    "필수 필드 %s 누락 시 validation error 발생 (error path)",
    async (field) => {
      const errors = await validatePlain(withoutField(field));
      expect(errors.length).toBeGreaterThan(0);
      expect(errors).toEqual(expect.arrayContaining(["isNotEmpty"]));
    },
  );

  // --------------------------------------------------------------------------
  // negative: 필수 4 필드 각 빈 문자열 → isNotEmpty (예외 분기마다 cover).
  // --------------------------------------------------------------------------
  it.each(["personId", "period", "scope", "periodStart"] as const)(
    "필수 필드 %s 가 빈 문자열 시 isNotEmpty 위반 (negative)",
    async (field) => {
      const errors = await validatePlain({ ...validPayload, [field]: "" });
      expect(errors).toEqual(expect.arrayContaining(["isNotEmpty"]));
    },
  );

  // --------------------------------------------------------------------------
  // negative (wrong-type): 필수 string 필드에 number/object → isString.
  // --------------------------------------------------------------------------
  it("personId 가 number 시 isString 위반 (negative/wrong-type)", async () => {
    const errors = await validatePlain({ ...validPayload, personId: 123 });
    expect(errors).toEqual(expect.arrayContaining(["isString"]));
  });

  it("period 가 number 시 isString 위반 (negative/wrong-type)", async () => {
    const errors = await validatePlain({ ...validPayload, period: 7 });
    expect(errors).toEqual(expect.arrayContaining(["isString"]));
  });

  it("scope 가 object 시 isString 위반 (negative/wrong-type)", async () => {
    const errors = await validatePlain({ ...validPayload, scope: {} });
    expect(errors).toEqual(expect.arrayContaining(["isString"]));
  });

  // --------------------------------------------------------------------------
  // flow/branch (R-112 #3): periodStart 비-ISO 문자열 → isISO8601.
  // --------------------------------------------------------------------------
  it("periodStart 가 잘못된 ISO 형식 시 isISO8601 위반 (negative)", async () => {
    const errors = await validatePlain({
      ...validPayload,
      periodStart: "not-a-date",
    });
    expect(errors).toEqual(expect.arrayContaining(["isIso8601"]));
  });

  it("periodStart 가 비현실 날짜(2026-13-99) 시 isISO8601 위반 (negative/branch)", async () => {
    const errors = await validatePlain({
      ...validPayload,
      periodStart: "2026-13-99",
    });
    expect(errors).toEqual(expect.arrayContaining(["isIso8601"]));
  });

  // --------------------------------------------------------------------------
  // negative (forbidNonWhitelisted): 정의 외 필드 → whitelistValidation.
  // ValidationPipe 의 whitelist+forbidNonWhitelisted 동작을 spec 레벨에서 직접 검증.
  // --------------------------------------------------------------------------
  it("정의 외 필드(foo) 는 forbidNonWhitelisted 로 whitelistValidation 위반 (negative)", async () => {
    const errors = await validatePlain(
      { ...validPayload, foo: "bar" },
      { whitelist: true, forbidNonWhitelisted: true },
    );
    expect(errors).toEqual(expect.arrayContaining(["whitelistValidation"]));
  });

  // --------------------------------------------------------------------------
  // negative (R-112 #2·#4): 구 vestigial `mode` field — ADR-0038 §Decision1
  // amendment(T-0334)로 제거됨. 제공 시 더 이상 @IsIn 통과/거부가 아니라 **정의 외
  // 필드**로 whitelist+forbidNonWhitelisted 가 거부한다(구 @IsIn 거부 테스트의 대체 —
  // silent ignore 차단, fail-closed 동형). 구 허용 literal("fill"/"reeval")·임의
  // string 각 1+ cover — 단일 negative 금지.
  // --------------------------------------------------------------------------
  it.each(["fill", "reeval", "legacy-arbitrary"])(
    "제거된 mode field 에 '%s' 제공 시 정의 외 필드로 whitelistValidation 위반 (negative — vestigial mode 거부)",
    async (modeValue) => {
      const errors = await validatePlain(
        { ...validPayload, mode: modeValue },
        { whitelist: true, forbidNonWhitelisted: true },
      );
      expect(errors).toEqual(expect.arrayContaining(["whitelistValidation"]));
    },
  );

  // --------------------------------------------------------------------------
  // reevaluate (ADR-0038 §Decision1, T-0333 slice 1) — happy/branch (R-112 #1·#3):
  // true / false / 미지정 각각 0 error. default false(first-write-wins) 적용은
  // orchestration slice 2 책임 — 본 spec 은 입력 형식 계약만 검증.
  // --------------------------------------------------------------------------
  it("reevaluate=true 명시 payload 는 errors 빈 배열을 반환한다 (happy)", async () => {
    const errors = await validatePlain({ ...validPayload, reevaluate: true });
    expect(errors).toEqual([]);
  });

  it("reevaluate=false 명시 payload 도 errors 빈 배열을 반환한다 (happy/branch)", async () => {
    const errors = await validatePlain({ ...validPayload, reevaluate: false });
    expect(errors).toEqual([]);
  });

  it("reevaluate 미지정 payload 는 errors 빈 배열 — default false 는 orchestration 책임 (branch)", async () => {
    const errors = await validatePlain({ ...validPayload });
    expect(errors).toEqual([]);
  });

  // --------------------------------------------------------------------------
  // reevaluate — error/negative (R-112 #2·#4): 제공 시 boolean 형식 강제. 비-boolean
  // (string/"yes" string/number/null) 예외 분기마다 각 1+ cover — 단일 negative 금지.
  // --------------------------------------------------------------------------
  it("reevaluate 가 string 'true' 시 isBoolean 위반 (negative/wrong-type)", async () => {
    const errors = await validatePlain({ ...validPayload, reevaluate: "true" });
    expect(errors).toEqual(expect.arrayContaining(["isBoolean"]));
  });

  it("reevaluate 가 string 'yes' 시 isBoolean 위반 (negative/wrong-type)", async () => {
    const errors = await validatePlain({ ...validPayload, reevaluate: "yes" });
    expect(errors).toEqual(expect.arrayContaining(["isBoolean"]));
  });

  it("reevaluate 가 number 1 시 isBoolean 위반 (negative/wrong-type)", async () => {
    const errors = await validatePlain({ ...validPayload, reevaluate: 1 });
    expect(errors).toEqual(expect.arrayContaining(["isBoolean"]));
  });

  // null 은 @IsOptional(class-validator CONDITIONAL_VALIDATION)이 undefined 와 동일하게
  // 흡수한다 — 미지정과 같은 취급이라 validation error 0. orchestration(slice 2)의
  // `reevaluate === true` 분기에서 null 은 false 로 degrade → default first-write-wins
  // 보존(파괴적 reeval 미발화 — 안전). 본 test 는 이 흡수 동작을 contract 로 박제한다.
  it("reevaluate 가 null 시 @IsOptional 이 미지정과 동일하게 흡수한다 (negative — 안전 degrade)", async () => {
    const errors = await validatePlain({ ...validPayload, reevaluate: null });
    expect(errors).toEqual([]);
  });

  // reevaluate 제공 시 boolean 값이 그대로 instance 에 전사되고, 영속화/동시성 semantics
  // 키는 baking 되지 않는다(ADR-0038 §Decision2~5 는 slice 2~4 책임 — 입력 형식만).
  it("reevaluate=true 제공 시 instance 에 boolean 그대로 전사된다 (semantics baking 0)", () => {
    const dto = plainToInstance(PeriodBridgeDto, {
      ...validPayload,
      reevaluate: true,
    });
    expect(dto.reevaluate).toBe(true);
    expect(Object.keys(dto)).toContain("reevaluate");
    expect(dto).not.toHaveProperty("persistMode");
    expect(dto).not.toHaveProperty("assessmentId");
  });

  // --------------------------------------------------------------------------
  // DTO contract: 5 키만 선언됨(영속화/동시성 semantics baking 0 — 입력 형식만).
  // T-0334 가 vestigial `mode` 를 제거(ADR-0038 §Decision1 amendment)해 6 키 → 5 키로
  // 갱신 — `reevaluate?: boolean` 이 §Decision1 의 단일 request 계약. 선언 field 는
  // own property 로 항상 노출되므로(useDefineForClassFields) 본 test 의 키 목록은
  // 선언 contract 와 동치.
  // --------------------------------------------------------------------------
  it("DTO 는 personId/period/scope/periodStart/reevaluate 5 키만 contract 로 가진다", () => {
    const dto = plainToInstance(PeriodBridgeDto, { ...validPayload });
    expect(Object.keys(dto).sort()).toEqual(
      ["period", "periodStart", "personId", "reevaluate", "scope"].sort(),
    );
    // 영속화/동시성 관련 키가 baking 되지 않았음(slice 2b/4 책임) + 제거된 vestigial
    // mode 키 부재(ADR-0038 §Decision1 amendment, T-0334).
    expect(dto).not.toHaveProperty("mode");
    expect(dto).not.toHaveProperty("activities");
    expect(dto).not.toHaveProperty("assessmentId");
  });
});
