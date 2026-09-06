// ResetByPeriodRequestDto spec — CI scripts/check-spec-presence.sh 가 신규 production .ts 에
// 동반 spec 의무를 강제. class-validator decorator 동작을 isolated 하게 검증한다(controller
// 의 ValidationPipe 통합 검증은 Follow-up (a) 의 controller spec / e2e 가 cover).
// R-112 test posture — happy / error path / 분기별 / negative(예외 분기마다) 충분 cover.
// unevaluated-fill-plan-request.dto.spec.ts 패턴 mirror.
import "reflect-metadata";

import { plainToInstance } from "class-transformer";
import { validate, type ValidatorOptions } from "class-validator";

import { ResetByPeriodRequestDto } from "./reset-by-period-request.dto";

// 정상 payload — 모든 happy-path 의 base. 개별 negative 는 이 base 에서 한 field 만 변형.
const validPayload = {
  personId: "person-1",
  period: "week",
};

// helper — validPayload 에서 한 field 를 제거한 clone(누락 negative 용).
function withoutField(
  field: keyof typeof validPayload,
): Record<string, unknown> {
  const clone: Record<string, unknown> = { ...validPayload };
  delete clone[field];
  return clone;
}

// helper — plain 객체 → DTO instance 변환 후 validate. 실패한 constraint key 목록을 반환
// (어떤 decorator 가 위반됐는지 분기 단위로 식별). options 로 whitelist /
// forbidNonWhitelisted 동작도 같은 helper 로 검증한다.
async function validatePlain(
  payload: unknown,
  options?: ValidatorOptions,
): Promise<string[]> {
  const dto = plainToInstance(ResetByPeriodRequestDto, payload);
  const errors = await validate(dto, options);
  return errors.flatMap((e) => Object.keys(e.constraints ?? {}));
}

describe("ResetByPeriodRequestDto", () => {
  // --------------------------------------------------------------------------
  // happy (R-112 #1): 2 축 모두 유효 문자열 → errors 빈 배열.
  // --------------------------------------------------------------------------
  it("정상 payload(personId + period 유효 문자열)는 errors 빈 배열을 반환한다 (happy)", async () => {
    const errors = await validatePlain(validPayload);
    expect(errors).toEqual([]);
  });

  it("period 가 day/month 등 다른 허용 literal 이어도 형식 검증은 통과한다 (happy — @IsIn 미적용)", async () => {
    await expect(
      validatePlain({ ...validPayload, period: "day" }),
    ).resolves.toEqual([]);
    await expect(
      validatePlain({ ...validPayload, period: "month" }),
    ).resolves.toEqual([]);
    // 허용 literal 이 아닌 값도 DTO 는 통과시킨다 — 판정은 service assertValidPeriod 책임.
    await expect(
      validatePlain({ ...validPayload, period: "decade" }),
    ).resolves.toEqual([]);
  });

  // --------------------------------------------------------------------------
  // error path (R-112 #2): 필수 필드 각 누락(undefined) → 해당 필드 이름의 오류 발생.
  // --------------------------------------------------------------------------
  it.each(["personId", "period"] as const)(
    "필수 필드 %s 누락 시 해당 필드의 validation error 가 발생한다 (error path)",
    async (field) => {
      const dto = plainToInstance(ResetByPeriodRequestDto, withoutField(field));
      const errors = await validate(dto);
      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe(field);
      expect(Object.keys(errors[0].constraints ?? {})).toEqual(
        expect.arrayContaining(["isNotEmpty"]),
      );
    },
  );

  // --------------------------------------------------------------------------
  // 분기별 cover (R-112 #3) — @IsNotEmpty 위반 분기만 단독으로 타는 케이스.
  // 빈 문자열은 string 이므로 @IsString 은 통과하고 @IsNotEmpty 만 실패해야 한다
  // (두 분기를 한 케이스가 동시에 덮지 않게 하는 것이 AC 요구).
  // --------------------------------------------------------------------------
  it.each(["personId", "period"] as const)(
    "%s 가 빈 문자열이면 isNotEmpty 분기만 위반한다 (branch — @IsNotEmpty 단독)",
    async (field) => {
      const dto = plainToInstance(ResetByPeriodRequestDto, {
        ...validPayload,
        [field]: "",
      });
      const errors = await validate(dto);
      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe(field);
      const keys = Object.keys(errors[0].constraints ?? {});
      expect(keys).toContain("isNotEmpty");
      expect(keys).not.toContain("isString");
    },
  );

  // --------------------------------------------------------------------------
  // 분기별 cover (R-112 #3) — @IsString 위반 분기만 단독으로 타는 케이스.
  // number / object 는 비어있지 않은 값이라 @IsNotEmpty 는 통과하고 @IsString 만 실패한다.
  // --------------------------------------------------------------------------
  it.each([
    ["personId", 42],
    ["period", { nested: true }],
  ] as const)(
    "%s 가 비-string(%p)이면 isString 분기만 위반한다 (branch — @IsString 단독)",
    async (field, wrongValue) => {
      const dto = plainToInstance(ResetByPeriodRequestDto, {
        ...validPayload,
        [field]: wrongValue,
      });
      const errors = await validate(dto);
      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe(field);
      const keys = Object.keys(errors[0].constraints ?? {});
      expect(keys).toContain("isString");
      expect(keys).not.toContain("isNotEmpty");
    },
  );

  // --------------------------------------------------------------------------
  // negative #1 (예외 분기): 정의 외 필드 + forbidNonWhitelisted → whitelistValidation.
  // reset 은 파괴적 연산이라 오타 필드가 조용히 무시되면 안 된다는 정책의 spec 화.
  // --------------------------------------------------------------------------
  it("정의 외 필드(scope) 는 forbidNonWhitelisted 로 whitelistValidation 위반 (negative)", async () => {
    const errors = await validatePlain(
      { ...validPayload, scope: "commit" },
      { whitelist: true, forbidNonWhitelisted: true },
    );
    expect(errors).toEqual(expect.arrayContaining(["whitelistValidation"]));
  });

  // --------------------------------------------------------------------------
  // negative #2 (예외 분기): whitelist 만 적용 시 정의 외 필드는 오류 없이 strip 된다.
  // --------------------------------------------------------------------------
  it("whitelist 만 적용하면 정의 외 필드는 오류 없이 strip 된다 (negative)", async () => {
    const dto = plainToInstance(ResetByPeriodRequestDto, {
      ...validPayload,
      scope: "commit",
    });
    const errors = await validate(dto, { whitelist: true });
    expect(errors).toEqual([]);
    expect(dto).not.toHaveProperty("scope");
    expect(dto.personId).toBe("person-1");
  });

  // --------------------------------------------------------------------------
  // negative #3 (예외 분기): 공백-only 문자열은 형식상 통과한다 — @IsNotEmpty 는 trim 하지
  // 않으며, DTO 가 trim 정책을 발명하지 않는다는 결정(dto 주석)을 spec 으로 박제.
  // --------------------------------------------------------------------------
  it("공백-only 문자열은 형식 검증을 통과한다 — trim 정책을 DTO 가 소유하지 않는다 (negative)", async () => {
    const errors = await validatePlain({ personId: "  ", period: "\t" });
    expect(errors).toEqual([]);
  });

  // --------------------------------------------------------------------------
  // negative #4 (예외 분기): null 입력 — undefined 와 달리 두 decorator 가 함께 실패한다
  // (isString: null 은 string 아님 / isNotEmpty: null 은 empty).
  // --------------------------------------------------------------------------
  it.each(["personId", "period"] as const)(
    "%s 가 null 이면 isString·isNotEmpty 둘 다 위반한다 (negative — null 입력)",
    async (field) => {
      const dto = plainToInstance(ResetByPeriodRequestDto, {
        ...validPayload,
        [field]: null,
      });
      const errors = await validate(dto);
      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe(field);
      expect(Object.keys(errors[0].constraints ?? {}).sort()).toEqual([
        "isNotEmpty",
        "isString",
      ]);
    },
  );

  // --------------------------------------------------------------------------
  // negative #5 (예외 분기): 두 필드가 모두 무효면 오류가 필드별로 2 건 수집된다
  // (첫 오류에서 조기 종료하지 않는다).
  // --------------------------------------------------------------------------
  it("두 필드 모두 무효면 property 별 오류 2 건이 수집된다 (negative)", async () => {
    const dto = plainToInstance(ResetByPeriodRequestDto, {
      personId: "",
      period: 7,
    });
    const errors = await validate(dto);
    expect(errors).toHaveLength(2);
    expect(errors.map((e) => e.property).sort()).toEqual([
      "period",
      "personId",
    ]);
  });

  it("빈 객체({}) 는 두 필드 누락으로 오류 2 건을 반환한다 (negative)", async () => {
    const dto = plainToInstance(ResetByPeriodRequestDto, {});
    const errors = await validate(dto);
    expect(errors).toHaveLength(2);
  });

  // --------------------------------------------------------------------------
  // DTO contract: personId / period 2 키만 선언(허용 literal · 삭제 semantics baking 0).
  // 선언 field 는 own property 로 항상 노출되므로 키 목록 == 선언 contract.
  // --------------------------------------------------------------------------
  it("DTO 는 personId/period 2 키만 contract 로 가진다", () => {
    const dto = plainToInstance(ResetByPeriodRequestDto, { ...validPayload });
    expect(Object.keys(dto).sort()).toEqual(["period", "personId"].sort());
    // service 책임인 축(scope / periodStart / 삭제 건수)이 baking 되지 않았음.
    expect(dto).not.toHaveProperty("scope");
    expect(dto).not.toHaveProperty("periodStart");
    expect(dto).not.toHaveProperty("deletedCount");
  });
});
