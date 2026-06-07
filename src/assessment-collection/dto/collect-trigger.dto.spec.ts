// CollectTriggerDto spec — CI scripts/check-spec-presence.sh 가 신규 production .ts 에
// 동반 spec 의무 강제. class-validator decorator 동작을 isolated 하게 검증(controller 의
// ValidationPipe 통합 검증은 Follow-up #3 controller spec / #4 e2e 가 cover). ADR-0031 §5
// test posture(R-112 — happy / error / branch / negative 충분 cover). create-assessment.
// dto.spec.ts 패턴 1:1 mirror.
import "reflect-metadata";

import { plainToInstance } from "class-transformer";
import { validate, type ValidatorOptions } from "class-validator";

import { CollectTriggerDto } from "./collect-trigger.dto";

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
  const dto = plainToInstance(CollectTriggerDto, payload);
  const errors = await validate(dto, options);
  return errors.flatMap((e) => Object.keys(e.constraints ?? {}));
}

describe("CollectTriggerDto", () => {
  // --------------------------------------------------------------------------
  // happy (R-112 #1): 4 필드 + periodStart 모두 정상 → errors 빈 배열.
  // --------------------------------------------------------------------------
  it("정상 payload(periodStart 포함)는 errors 빈 배열을 반환한다 (happy)", async () => {
    const errors = await validatePlain(validPayload);
    expect(errors).toEqual([]);
  });

  // --------------------------------------------------------------------------
  // happy/branch (R-112 #3): periodStart 미제공도 통과 — @IsOptional 분기.
  // --------------------------------------------------------------------------
  it("periodStart 미제공 payload 도 errors 빈 배열을 반환한다 (@IsOptional 분기)", async () => {
    const errors = await validatePlain(withoutField("periodStart"));
    expect(errors).toEqual([]);
  });

  // --------------------------------------------------------------------------
  // negative (R-112 #2): 빈 personId → isNotEmpty.
  // --------------------------------------------------------------------------
  it("personId 가 빈 문자열 시 isNotEmpty 위반 (negative)", async () => {
    const errors = await validatePlain({ ...validPayload, personId: "" });
    expect(errors).toEqual(expect.arrayContaining(["isNotEmpty"]));
  });

  // --------------------------------------------------------------------------
  // negative: personId 누락 → isNotEmpty / isString.
  // --------------------------------------------------------------------------
  it("personId 누락 시 isNotEmpty 위반 (negative)", async () => {
    const errors = await validatePlain(withoutField("personId"));
    expect(errors.length).toBeGreaterThan(0);
    expect(errors).toEqual(expect.arrayContaining(["isNotEmpty"]));
  });

  // --------------------------------------------------------------------------
  // negative: 잘못된 periodStart 형식 → isISO8601(제공됐으므로 @IsOptional 통과 후 검증).
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
  // negative: period/scope 타입 mismatch → isString (각 1+).
  // --------------------------------------------------------------------------
  it("period 가 number 시 isString 위반 (negative)", async () => {
    const errors = await validatePlain({ ...validPayload, period: 123 });
    expect(errors).toEqual(expect.arrayContaining(["isString"]));
  });

  it("scope 가 object 시 isString 위반 (negative)", async () => {
    const errors = await validatePlain({ ...validPayload, scope: {} });
    expect(errors).toEqual(expect.arrayContaining(["isString"]));
  });

  it("period 가 빈 문자열 시 isNotEmpty 위반 (negative/branch)", async () => {
    const errors = await validatePlain({ ...validPayload, period: "" });
    expect(errors).toEqual(expect.arrayContaining(["isNotEmpty"]));
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
  // DTO contract: 정의된 4 키만 선언됨(정의 외 키는 contract 일부 아님).
  // --------------------------------------------------------------------------
  it("DTO 는 personId/period/scope/periodStart 4 키만 contract 로 가진다", () => {
    const dto = plainToInstance(CollectTriggerDto, validPayload);
    expect(Object.keys(dto).sort()).toEqual(
      ["period", "periodStart", "personId", "scope"].sort(),
    );
    expect(dto).not.toHaveProperty("assessmentId");
    expect(dto).not.toHaveProperty("difficulty");
  });
});
