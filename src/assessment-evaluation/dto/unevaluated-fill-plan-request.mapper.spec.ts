// unevaluated-fill-plan-request.mapper spec — CI scripts/check-spec-presence.sh 가 신규
// production .ts 에 동반 spec 의무 강제. 순수 함수 `toIntendedPeriodCoordinatesInput` 를
// 직접 호출해 검증한다(plainToInstance 불요 — period-bridge.dto.spec 의 validator 통합
// 검증과 달리 본 mapper 는 순수 변환 함수). R-112 test posture: happy / error / branch /
// negative 충분 cover(예외 분기마다 1+).
import { parseKstPeriodInput } from "../../common/period-boundary";

import type { UnevaluatedFillPlanRequestDto } from "./unevaluated-fill-plan-request.dto";
import { toIntendedPeriodCoordinatesInput } from "./unevaluated-fill-plan-request.mapper";

// 정상 payload — 모든 happy-path 의 base. 개별 negative 는 이 base 에서 한 field 만 변형.
// rangeStart/rangeEnd 는 offset 미명시 ISO(=KST 해석 분기)로 둔다.
const validDto: UnevaluatedFillPlanRequestDto = {
  personIds: ["person-1", "person-2"],
  period: "week",
  scope: "commit",
  rangeStart: "2026-06-10T15:00",
  rangeEnd: "2026-06-17T15:00",
};

// helper — validDto 에서 한 field 만 덮어쓴 clone(negative 변형용).
function withField(
  field: keyof UnevaluatedFillPlanRequestDto,
  value: unknown,
): UnevaluatedFillPlanRequestDto {
  return { ...validDto, [field]: value } as UnevaluatedFillPlanRequestDto;
}

describe("toIntendedPeriodCoordinatesInput", () => {
  // --------------------------------------------------------------------------
  // happy (R-112 #1): 유효 dto → personIds/period/scope 정확 전사 + rangeStart/rangeEnd
  // 가 Date 이고 parseKstPeriodInput 산출 instant 와 일치(offset 미명시 → KST 해석).
  // --------------------------------------------------------------------------
  it("유효 dto 를 IntendedPeriodCoordinatesInput 으로 변환한다 (happy)", () => {
    const result = toIntendedPeriodCoordinatesInput(validDto);

    expect(result.personIds).toEqual(["person-1", "person-2"]);
    expect(result.period).toBe("week");
    expect(result.scope).toBe("commit");
    expect(result.rangeStart).toBeInstanceOf(Date);
    expect(result.rangeEnd).toBeInstanceOf(Date);
    // single-source helper 와 동일 instant — raw new Date 가 아님을 instant 동치로 검증.
    expect(result.rangeStart.getTime()).toBe(
      parseKstPeriodInput("2026-06-10T15:00").getTime(),
    );
    expect(result.rangeEnd.getTime()).toBe(
      parseKstPeriodInput("2026-06-17T15:00").getTime(),
    );
  });

  it("offset 미명시 rangeStart 는 KST 로 해석된다 (happy/KST 해석 1 assertion)", () => {
    // "2026-06-10T15:00" KST = 2026-06-10T06:00:00Z (offset -9h).
    const result = toIntendedPeriodCoordinatesInput(validDto);
    expect(result.rangeStart.toISOString()).toBe("2026-06-10T06:00:00.000Z");
  });

  // --------------------------------------------------------------------------
  // flow / branch (R-112 #3): parseKstPeriodInput 의 3 분기를 mapper 경유로 cover.
  // --------------------------------------------------------------------------
  it("offset 명시(Z) rangeStart 는 그대로 instant 로 변환된다 (branch — offset 명시)", () => {
    const result = toIntendedPeriodCoordinatesInput(
      withField("rangeStart", "2026-06-10T15:00:00Z"),
    );
    expect(result.rangeStart.toISOString()).toBe("2026-06-10T15:00:00.000Z");
  });

  it("offset 명시(+09:00) rangeStart 는 그대로 instant 로 변환된다 (branch — offset 명시)", () => {
    const result = toIntendedPeriodCoordinatesInput(
      withField("rangeStart", "2026-06-10T15:00:00+09:00"),
    );
    // +09:00 15:00 = 06:00:00Z.
    expect(result.rangeStart.toISOString()).toBe("2026-06-10T06:00:00.000Z");
  });

  it("날짜-only rangeStart 는 KST 자정으로 변환된다 (branch — date-only)", () => {
    const result = toIntendedPeriodCoordinatesInput(
      withField("rangeStart", "2026-06-10"),
    );
    // 2026-06-10 KST 자정 = 2026-06-09T15:00:00Z.
    expect(result.rangeStart.toISOString()).toBe("2026-06-09T15:00:00.000Z");
  });

  it("빈 personIds 는 빈 배열로 전사된다 (branch — passthrough)", () => {
    const result = toIntendedPeriodCoordinatesInput(withField("personIds", []));
    expect(result.personIds).toEqual([]);
  });

  // --------------------------------------------------------------------------
  // error path (R-112 #2) + negative 충분 cover (R-112 #4): 예외 분기마다 1+.
  // --------------------------------------------------------------------------
  it("dto 가 null 이면 TypeError 로 fail-fast (negative #1)", () => {
    expect(() =>
      toIntendedPeriodCoordinatesInput(
        null as unknown as UnevaluatedFillPlanRequestDto,
      ),
    ).toThrow(TypeError);
  });

  it("dto 가 undefined 이면 TypeError 로 fail-fast (negative #2)", () => {
    expect(() =>
      toIntendedPeriodCoordinatesInput(
        undefined as unknown as UnevaluatedFillPlanRequestDto,
      ),
    ).toThrow(TypeError);
  });

  it("rangeStart 형식 위반(2026-13-99)은 parseKstPeriodInput 의 RangeError 전파 (negative #3)", () => {
    expect(() =>
      toIntendedPeriodCoordinatesInput(withField("rangeStart", "2026-13-99")),
    ).toThrow(RangeError);
  });

  it("rangeEnd 형식 위반(not-a-date)은 parseKstPeriodInput 의 RangeError 전파 (negative #4)", () => {
    expect(() =>
      toIntendedPeriodCoordinatesInput(withField("rangeEnd", "not-a-date")),
    ).toThrow(RangeError);
  });

  it("rangeStart 빈 문자열은 parseKstPeriodInput 의 TypeError 전파 (negative #5)", () => {
    expect(() =>
      toIntendedPeriodCoordinatesInput(withField("rangeStart", "")),
    ).toThrow(TypeError);
  });

  it("rangeEnd 빈 문자열은 parseKstPeriodInput 의 TypeError 전파 (negative #6)", () => {
    expect(() =>
      toIntendedPeriodCoordinatesInput(withField("rangeEnd", "")),
    ).toThrow(TypeError);
  });

  // --------------------------------------------------------------------------
  // negative #7: 입력 dto.personIds 비변형 — 반환 personIds 는 입력과 다른 배열 참조이고
  // 입력 배열을 mutate 하지 않는다(도메인 helper 안전).
  // --------------------------------------------------------------------------
  it("입력 dto.personIds 를 변형하지 않고 새 배열로 복사 전사한다 (negative #7 — 비변형)", () => {
    const inputIds = ["person-1", "person-2"];
    const dto = withField("personIds", inputIds);
    const result = toIntendedPeriodCoordinatesInput(dto);

    // 다른 배열 참조(복사) + 내용 동일.
    expect(result.personIds).not.toBe(inputIds);
    expect(result.personIds).toEqual(inputIds);

    // 반환 배열 mutate 가 입력 배열에 영향 0(격리).
    result.personIds.push("person-3");
    expect(inputIds).toEqual(["person-1", "person-2"]);
  });
});
