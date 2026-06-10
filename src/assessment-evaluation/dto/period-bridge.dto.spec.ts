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
  // happy (R-112 #1): 4 좌표 필드 모두 정상(mode 미지정) → errors 빈 배열.
  // --------------------------------------------------------------------------
  it("정상 payload(mode 미지정)는 errors 빈 배열을 반환한다 (happy)", async () => {
    const errors = await validatePlain(validPayload);
    expect(errors).toEqual([]);
  });

  // happy/branch (R-112 #3): mode="fill" 명시도 통과.
  it("mode='fill' 명시 payload 도 errors 빈 배열을 반환한다 (@IsIn 통과)", async () => {
    const errors = await validatePlain({ ...validPayload, mode: "fill" });
    expect(errors).toEqual([]);
  });

  // happy/branch (R-112 #3): mode="reeval" 명시도 통과.
  it("mode='reeval' 명시 payload 도 errors 빈 배열을 반환한다 (@IsIn 통과)", async () => {
    const errors = await validatePlain({ ...validPayload, mode: "reeval" });
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
  // flow/branch (R-112 #3): mode 분기 — 정의 외 literal → isIn / 미지정 → 통과.
  // --------------------------------------------------------------------------
  it("mode 가 정의 외 literal('reevaluate') 시 isIn 위반 (negative/branch)", async () => {
    const errors = await validatePlain({
      ...validPayload,
      mode: "reevaluate",
    });
    expect(errors).toEqual(expect.arrayContaining(["isIn"]));
  });

  it("mode 가 빈 문자열 시 isNotEmpty 위반 (negative/branch)", async () => {
    const errors = await validatePlain({ ...validPayload, mode: "" });
    expect(errors).toEqual(expect.arrayContaining(["isNotEmpty"]));
  });

  it("mode 가 number 시 isString 위반 (negative/wrong-type)", async () => {
    const errors = await validatePlain({ ...validPayload, mode: 1 });
    expect(errors).toEqual(expect.arrayContaining(["isString"]));
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
  // DTO contract: mode 제공 시 5 키만 선언됨(영속화/동시성 semantics baking 0 — 입력 형식
  // 만). §Decision2/§Decision3 PROPOSE 미의존 확인.
  // --------------------------------------------------------------------------
  it("DTO 는 personId/period/scope/periodStart/mode 5 키만 contract 로 가진다", () => {
    const dto = plainToInstance(PeriodBridgeDto, {
      ...validPayload,
      mode: "fill",
    });
    expect(Object.keys(dto).sort()).toEqual(
      ["mode", "period", "periodStart", "personId", "scope"].sort(),
    );
    // 영속화/동시성 관련 키가 baking 되지 않았음(slice 2/5 책임).
    expect(dto).not.toHaveProperty("activities");
    expect(dto).not.toHaveProperty("assessmentId");
  });
});
