// RelativeComparisonQueryDto spec — CI scripts/check-spec-presence.sh 가 신규 production
// .ts 에 동반 spec 의무 강제. class-validator decorator 동작을 isolated 하게 검증(controller
// 의 ValidationPipe 통합 검증은 controller spec / 후속 e2e 가 cover). R-112 test posture
// (happy / error / branch / negative 충분 cover). unevaluated-fill-plan-request.dto.spec.ts
// 패턴 mirror.
import "reflect-metadata";

import { plainToInstance } from "class-transformer";
import { validate, type ValidatorOptions } from "class-validator";

import { RelativeComparisonQueryDto } from "./relative-comparison-query.dto";

// 정상 payload — 모든 happy-path 의 base. 개별 negative 는 이 base 에서 한 축만 변형.
const validPayload = {
  period: "week",
  periodStart: "2026-05-01T00:00:00.000Z",
};

// helper — validPayload 에서 한 축을 제거한 clone(누락 negative 용).
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
  const dto = plainToInstance(RelativeComparisonQueryDto, payload);
  const errors = await validate(dto, options);
  return errors.flatMap((e) => Object.keys(e.constraints ?? {}));
}

describe("RelativeComparisonQueryDto", () => {
  // --------------------------------------------------------------------------
  // happy (R-112 #1): 2 축 모두 정상(period literal + 유효 ISO instant) → errors 빈 배열.
  // --------------------------------------------------------------------------
  it("정상 payload(period + 유효 ISO periodStart)는 errors 빈 배열을 반환한다 (happy)", async () => {
    await expect(validatePlain(validPayload)).resolves.toEqual([]);
  });

  it("day / month period 도 형식 검증을 통과한다 — 허용 literal 판정은 DTO 밖이다 (happy)", async () => {
    await expect(
      validatePlain({ ...validPayload, period: "day" }),
    ).resolves.toEqual([]);
    await expect(
      validatePlain({ ...validPayload, period: "month" }),
    ).resolves.toEqual([]);
  });

  it("허용 외 period literal('quarter')도 DTO 단계에서는 통과한다 — @IsIn 미적용(단일 검증 출처 = SummaryService) (branch)", async () => {
    await expect(
      validatePlain({ ...validPayload, period: "quarter" }),
    ).resolves.toEqual([]);
  });

  // --------------------------------------------------------------------------
  // negative ①: period 누락 → isNotEmpty / isString constraint.
  // --------------------------------------------------------------------------
  it("period 누락은 isNotEmpty constraint 로 거부된다 (negative ①)", async () => {
    const keys = await validatePlain(withoutField("period"));
    expect(keys).toContain("isNotEmpty");
  });

  it("period 빈 문자열은 isNotEmpty constraint 로 거부되고 isString 은 통과한다 (branch — @IsNotEmpty 분기)", async () => {
    const keys = await validatePlain({ ...validPayload, period: "" });
    expect(keys).toEqual(["isNotEmpty"]);
  });

  // --------------------------------------------------------------------------
  // negative ②: periodStart 비-ISO → isISO8601 constraint.
  // --------------------------------------------------------------------------
  it("비-ISO periodStart('2026-13-99')는 isISO8601 constraint 로 거부된다 (negative ②)", async () => {
    const keys = await validatePlain({
      ...validPayload,
      periodStart: "2026-13-99",
    });
    expect(keys).toEqual(["isIso8601"]);
  });

  it("periodStart 누락은 isNotEmpty + isISO8601 constraint 로 거부된다 (negative ②-b)", async () => {
    const keys = await validatePlain(withoutField("periodStart"));
    expect(keys).toContain("isNotEmpty");
    expect(keys).toContain("isIso8601");
  });

  it("유효 ISO 는 isISO8601 을 통과한다 — date-only 형식도 ISO-8601 이다 (branch — @IsISO8601 통과 분기)", async () => {
    await expect(
      validatePlain({ ...validPayload, periodStart: "2026-05-01" }),
    ).resolves.toEqual([]);
  });

  // --------------------------------------------------------------------------
  // negative ③: 정의 외 필드 → forbidNonWhitelisted(controller-scope ValidationPipe 와
  // 같은 옵션으로 검증).
  // --------------------------------------------------------------------------
  it("정의 외 query 필드는 forbidNonWhitelisted 로 거부된다 (negative ③)", async () => {
    const keys = await validatePlain(
      { ...validPayload, personId: "person-1" },
      { whitelist: true, forbidNonWhitelisted: true },
    );
    expect(keys).toContain("whitelistValidation");
  });

  it("정의 외 필드가 없으면 whitelist 옵션에서도 errors 가 없다 (branch — whitelist 통과 분기)", async () => {
    await expect(
      validatePlain(validPayload, {
        whitelist: true,
        forbidNonWhitelisted: true,
      }),
    ).resolves.toEqual([]);
  });

  // --------------------------------------------------------------------------
  // negative ④: 비-string 타입 주입 → isString constraint.
  // --------------------------------------------------------------------------
  it("비-string period(number)는 isString constraint 로 거부된다 (negative ④)", async () => {
    const keys = await validatePlain({ ...validPayload, period: 7 });
    expect(keys).toContain("isString");
  });

  it("비-string periodStart(number)는 isString + isISO8601 constraint 로 거부된다 (negative ④-b)", async () => {
    const keys = await validatePlain({
      ...validPayload,
      periodStart: 20260501,
    });
    expect(keys).toContain("isString");
    expect(keys).toContain("isIso8601");
  });

  // --------------------------------------------------------------------------
  // 변환 계약: `@Type` 미적용 — periodStart 는 Date 로 변환되지 않고 문자열로 남는다
  // (string → Date 변환은 controller 책임).
  // --------------------------------------------------------------------------
  it("plainToInstance 후에도 periodStart 는 string 그대로다 — DTO 변환 0 (계약)", () => {
    const dto = plainToInstance(RelativeComparisonQueryDto, validPayload);
    expect(dto).toBeInstanceOf(RelativeComparisonQueryDto);
    expect(typeof dto.periodStart).toBe("string");
    expect(dto.periodStart).toBe("2026-05-01T00:00:00.000Z");
    expect(dto.period).toBe("week");
  });
});
