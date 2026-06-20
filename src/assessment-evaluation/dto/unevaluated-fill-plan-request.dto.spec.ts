// UnevaluatedFillPlanRequestDto spec — CI scripts/check-spec-presence.sh 가 신규 production
// .ts 에 동반 spec 의무 강제. class-validator decorator 동작을 isolated 하게 검증(controller
// 의 ValidationPipe 통합 검증은 후속 controller spec / e2e 가 cover). R-112 test posture
// (happy / error / branch / negative 충분 cover). period-bridge.dto.spec.ts 패턴 mirror.
import "reflect-metadata";

import { plainToInstance } from "class-transformer";
import { validate, type ValidatorOptions } from "class-validator";

import { UnevaluatedFillPlanRequestDto } from "./unevaluated-fill-plan-request.dto";

// 정상 payload — 모든 happy-path 의 base. 개별 negative 는 이 base 에서 한 field 만 변형.
const validPayload = {
  personIds: ["person-1", "person-2"],
  period: "week",
  scope: "commit",
  rangeStart: "2026-05-01T00:00:00.000Z",
  rangeEnd: "2026-06-01T00:00:00.000Z",
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
  const dto = plainToInstance(UnevaluatedFillPlanRequestDto, payload);
  const errors = await validate(dto, options);
  return errors.flatMap((e) => Object.keys(e.constraints ?? {}));
}

describe("UnevaluatedFillPlanRequestDto", () => {
  // --------------------------------------------------------------------------
  // happy (R-112 #1): 5 축 모두 정상(personIds 2 원소 + 유효 ISO date) → errors 빈 배열.
  // --------------------------------------------------------------------------
  it("정상 payload(personIds 2 원소 + 유효 ISO date)는 errors 빈 배열을 반환한다 (happy)", async () => {
    const errors = await validatePlain(validPayload);
    expect(errors).toEqual([]);
  });

  // --------------------------------------------------------------------------
  // error path (R-112 #2): 필수 필드 각 누락 시 validation error 발생.
  // personIds 는 누락 시 @IsArray 위반(isArray), 나머지 string 필드는 isNotEmpty.
  // --------------------------------------------------------------------------
  it("필수 필드 personIds 누락 시 isArray 위반 (error path)", async () => {
    const errors = await validatePlain(withoutField("personIds"));
    expect(errors.length).toBeGreaterThan(0);
    expect(errors).toEqual(expect.arrayContaining(["isArray"]));
  });

  it.each(["period", "scope", "rangeStart", "rangeEnd"] as const)(
    "필수 필드 %s 누락 시 validation error 발생 (error path)",
    async (field) => {
      const errors = await validatePlain(withoutField(field));
      expect(errors.length).toBeGreaterThan(0);
      expect(errors).toEqual(expect.arrayContaining(["isNotEmpty"]));
    },
  );

  // --------------------------------------------------------------------------
  // negative (wrong-type): personIds 가 non-array(string) → isArray.
  // --------------------------------------------------------------------------
  it("personIds 가 non-array(string) 시 isArray 위반 (negative/wrong-type)", async () => {
    const errors = await validatePlain({
      ...validPayload,
      personIds: "person-1",
    });
    expect(errors).toEqual(expect.arrayContaining(["isArray"]));
  });

  it("personIds 가 non-array(number) 시 isArray 위반 (negative/wrong-type)", async () => {
    const errors = await validatePlain({ ...validPayload, personIds: 123 });
    expect(errors).toEqual(expect.arrayContaining(["isArray"]));
  });

  // --------------------------------------------------------------------------
  // flow/branch (R-112 #3): personIds 원소-수준 검증 분기.
  //   (a) 모든 원소 유효 string → 통과(happy 가 cover).
  //   (b) 한 원소 non-string(number) → isString({ each: true }) 위반.
  //   (c) 한 원소 빈 문자열 → isNotEmpty({ each: true }) 위반.
  // --------------------------------------------------------------------------
  it("personIds 원소가 모두 유효 string 이면 통과 (branch — each 통과)", async () => {
    const errors = await validatePlain({
      ...validPayload,
      personIds: ["a", "b", "c"],
    });
    expect(errors).toEqual([]);
  });

  it("personIds 원소 중 non-string(number) 시 isString each 위반 (negative/branch)", async () => {
    const errors = await validatePlain({
      ...validPayload,
      personIds: ["person-1", 42],
    });
    expect(errors).toEqual(expect.arrayContaining(["isString"]));
  });

  it("personIds 원소 중 빈 문자열 시 isNotEmpty each 위반 (negative/branch)", async () => {
    const errors = await validatePlain({
      ...validPayload,
      personIds: ["person-1", ""],
    });
    expect(errors).toEqual(expect.arrayContaining(["isNotEmpty"]));
  });

  // --------------------------------------------------------------------------
  // negative: 빈 배열은 형식상 허용(@ArrayNotEmpty 미적용 — 빈 배열 → 빈 plan 의 자연
  // 흐름을 도메인 결정성에 위임). errors 빈 배열을 반환해야 한다.
  // --------------------------------------------------------------------------
  it("personIds 빈 배열은 형식상 허용된다 — errors 빈 배열 (branch — 빈 plan 위임)", async () => {
    const errors = await validatePlain({ ...validPayload, personIds: [] });
    expect(errors).toEqual([]);
  });

  // --------------------------------------------------------------------------
  // negative (필수 string 필드 빈 문자열): period / scope 각 빈 문자열 → isNotEmpty.
  // --------------------------------------------------------------------------
  it.each(["period", "scope"] as const)(
    "필수 필드 %s 가 빈 문자열 시 isNotEmpty 위반 (negative)",
    async (field) => {
      const errors = await validatePlain({ ...validPayload, [field]: "" });
      expect(errors).toEqual(expect.arrayContaining(["isNotEmpty"]));
    },
  );

  // --------------------------------------------------------------------------
  // negative (wrong-type): 필수 string 필드(period/scope)에 number/object → isString.
  // --------------------------------------------------------------------------
  it("period 가 number 시 isString 위반 (negative/wrong-type)", async () => {
    const errors = await validatePlain({ ...validPayload, period: 7 });
    expect(errors).toEqual(expect.arrayContaining(["isString"]));
  });

  it("scope 가 object 시 isString 위반 (negative/wrong-type)", async () => {
    const errors = await validatePlain({ ...validPayload, scope: {} });
    expect(errors).toEqual(expect.arrayContaining(["isString"]));
  });

  // --------------------------------------------------------------------------
  // flow/branch (R-112 #3): rangeStart / rangeEnd 비-ISO 문자열 → isISO8601.
  // 각 축 독립으로 cover(단일 negative 금지).
  // --------------------------------------------------------------------------
  it("rangeStart 가 잘못된 ISO 형식(not-a-date) 시 isISO8601 위반 (negative)", async () => {
    const errors = await validatePlain({
      ...validPayload,
      rangeStart: "not-a-date",
    });
    expect(errors).toEqual(expect.arrayContaining(["isIso8601"]));
  });

  it("rangeStart 가 비현실 날짜(2026-13-99) 시 isISO8601 위반 (negative/branch)", async () => {
    const errors = await validatePlain({
      ...validPayload,
      rangeStart: "2026-13-99",
    });
    expect(errors).toEqual(expect.arrayContaining(["isIso8601"]));
  });

  it("rangeEnd 가 잘못된 ISO 형식(not-a-date) 시 isISO8601 위반 (negative)", async () => {
    const errors = await validatePlain({
      ...validPayload,
      rangeEnd: "not-a-date",
    });
    expect(errors).toEqual(expect.arrayContaining(["isIso8601"]));
  });

  it("rangeEnd 가 비현실 날짜(2026-13-99) 시 isISO8601 위반 (negative/branch)", async () => {
    const errors = await validatePlain({
      ...validPayload,
      rangeEnd: "2026-13-99",
    });
    expect(errors).toEqual(expect.arrayContaining(["isIso8601"]));
  });

  // --------------------------------------------------------------------------
  // negative (forbidNonWhitelisted): 정의 외 필드 → whitelistValidation.
  // ValidationPipe 의 whitelist+forbidNonWhitelisted 동작을 spec 레벨에서 직접 검증
  // (controller-scope 검증을 spec 에서 1 assertion 으로 대체).
  // --------------------------------------------------------------------------
  it("정의 외 필드(foo) 는 forbidNonWhitelisted 로 whitelistValidation 위반 (negative)", async () => {
    const errors = await validatePlain(
      { ...validPayload, foo: "bar" },
      { whitelist: true, forbidNonWhitelisted: true },
    );
    expect(errors).toEqual(expect.arrayContaining(["whitelistValidation"]));
  });

  // --------------------------------------------------------------------------
  // DTO contract: 5 키만 선언됨(허용 literal/Date 변환 semantics baking 0 — 입력 형식만).
  // 선언 field 는 own property 로 항상 노출되므로(useDefineForClassFields) 키 목록은
  // 선언 contract 와 동치.
  // --------------------------------------------------------------------------
  it("DTO 는 personIds/period/scope/rangeStart/rangeEnd 5 키만 contract 로 가진다", () => {
    const dto = plainToInstance(UnevaluatedFillPlanRequestDto, {
      ...validPayload,
    });
    expect(Object.keys(dto).sort()).toEqual(
      ["period", "personIds", "rangeEnd", "rangeStart", "scope"].sort(),
    );
    // Date 변환·literal 검증 관련 키가 baking 되지 않았음(controller/service 책임).
    expect(dto).not.toHaveProperty("intended");
    expect(dto).not.toHaveProperty("periodStart");
  });
});
