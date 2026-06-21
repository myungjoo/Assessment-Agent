// UnevaluatedFillRunRequestDto spec — T-0565 acceptance 박제 (R-112 4 종 + negative
// cases 충분 cover). class-validator `validate()` 직접 호출로 형식 검증만 단위로 확인한다
// (controller-scope ValidationPipe 통합 검증은 controller spec 의 ValidationPipe 블록).
// unevaluated-fill-plan-request.dto.spec.ts / period-bridge.dto 패턴 mirror.
//
// 4 종 cover:
//   - happy: 3 필드 유효 → error 0.
//   - error: rawBridges 누락 / non-array / nested PeriodBridgeDto 위반 / modelId 빈 문자열
//     / defaultModelId 누락 / defaultModelId 빈 문자열 6+.
//   - branch: modelId 미지정 vs 지정 vs null vs "" / rawBridges 빈 배열 vs 다수 3+.
//   - negative: DTO 단독 validate() 는 whitelist 옵션이 없으므로 unknown 필드를 무시
//     (forbidNonWhitelisted 거부는 controller-scope pipe 책임 — controller spec 검증) 1+.
import "reflect-metadata";

import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";

import { UnevaluatedFillRunRequestDto } from "./unevaluated-fill-run-request.dto";

// makeValidBridge — 유효 PeriodBridgeDto plain payload(nested 검증 대상).
function makeValidBridge(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    personId: "person-1",
    period: "week",
    scope: "commit",
    periodStart: "2026-06-01T00:00:00.000Z",
    ...overrides,
  };
}

// makeValidPayload — 유효 run-request plain payload(rawBridges 1 + modelId + default).
function makeValidPayload(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    rawBridges: [makeValidBridge()],
    modelId: "gpt-4o-mini",
    defaultModelId: "gpt-4o",
    ...overrides,
  };
}

// validatePayload — plain payload → DTO 인스턴스 변환(@Type nested transform 포함) 후
// class-validator validate() 호출. validateNested 가 동작하려면 plainToInstance 의
// transform 이 선행돼야 한다(@Type decorator 가 nested plain → PeriodBridgeDto 인스턴스화).
async function validatePayload(payload: Record<string, unknown>) {
  const dto = plainToInstance(UnevaluatedFillRunRequestDto, payload);
  return validate(dto);
}

describe("UnevaluatedFillRunRequestDto (class-validator 형식 검증)", () => {
  // ----- happy -----
  it("3 필드 유효(rawBridges 2 + modelId + defaultModelId) 시 error 0 (happy)", async () => {
    const errors = await validatePayload(
      makeValidPayload({
        rawBridges: [
          makeValidBridge(),
          makeValidBridge({ personId: "person-2" }),
        ],
      }),
    );
    expect(errors).toHaveLength(0);
  });

  // ----- error -----
  it("rawBridges 누락 시 error 발생 (error — required array missing)", async () => {
    const payload = makeValidPayload();
    delete payload.rawBridges;
    const errors = await validatePayload(payload);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((e) => e.property === "rawBridges")).toBe(true);
  });

  it("rawBridges 가 배열이 아니면 error 발생 (error — wrong type, not array)", async () => {
    const errors = await validatePayload(
      makeValidPayload({ rawBridges: makeValidBridge() }),
    );
    expect(errors.some((e) => e.property === "rawBridges")).toBe(true);
  });

  it("rawBridges 원소가 PeriodBridgeDto 위반(personId 누락)이면 error 발생 (error — nested validation)", async () => {
    const badBridge = makeValidBridge();
    delete badBridge.personId;
    const errors = await validatePayload(
      makeValidPayload({ rawBridges: [badBridge] }),
    );
    expect(errors.some((e) => e.property === "rawBridges")).toBe(true);
  });

  it("rawBridges 원소의 periodStart 가 비-ISO 면 error 발생 (error — nested @IsISO8601)", async () => {
    const errors = await validatePayload(
      makeValidPayload({
        rawBridges: [makeValidBridge({ periodStart: "2026-13-99" })],
      }),
    );
    expect(errors.some((e) => e.property === "rawBridges")).toBe(true);
  });

  it("modelId 가 빈 문자열이면 error 발생 (error — @IsNotEmpty modelId)", async () => {
    const errors = await validatePayload(makeValidPayload({ modelId: "" }));
    expect(errors.some((e) => e.property === "modelId")).toBe(true);
  });

  it("defaultModelId 누락 시 error 발생 (error — required field missing)", async () => {
    const payload = makeValidPayload();
    delete payload.defaultModelId;
    const errors = await validatePayload(payload);
    expect(errors.some((e) => e.property === "defaultModelId")).toBe(true);
  });

  it("defaultModelId 가 빈 문자열이면 error 발생 (error — @IsNotEmpty defaultModelId)", async () => {
    const errors = await validatePayload(
      makeValidPayload({ defaultModelId: "" }),
    );
    expect(errors.some((e) => e.property === "defaultModelId")).toBe(true);
  });

  it("defaultModelId 가 비-string(number)이면 error 발생 (negative — type mismatch)", async () => {
    const errors = await validatePayload(
      makeValidPayload({ defaultModelId: 123 }),
    );
    expect(errors.some((e) => e.property === "defaultModelId")).toBe(true);
  });

  // ----- branch -----
  it("modelId 미지정 시 error 0 (branch — @IsOptional, 선택)", async () => {
    const payload = makeValidPayload();
    delete payload.modelId;
    const errors = await validatePayload(payload);
    expect(errors).toHaveLength(0);
  });

  it("modelId 지정 시 error 0 (branch — modelId 제공)", async () => {
    const errors = await validatePayload(
      makeValidPayload({ modelId: "custom-model" }),
    );
    expect(errors).toHaveLength(0);
  });

  it("modelId 가 null 이면 @IsOptional 이 흡수해 error 0 (branch — null 허용)", async () => {
    const errors = await validatePayload(makeValidPayload({ modelId: null }));
    expect(errors).toHaveLength(0);
  });

  it("rawBridges 빈 배열은 형식상 통과(error 0) (branch — 빈 배열 허용, 빈 outcomes 정책)", async () => {
    const errors = await validatePayload(makeValidPayload({ rawBridges: [] }));
    expect(errors).toHaveLength(0);
  });

  it("rawBridges 다수(3 원소)도 error 0 (branch — 다수 원소)", async () => {
    const errors = await validatePayload(
      makeValidPayload({
        rawBridges: [
          makeValidBridge(),
          makeValidBridge({ personId: "person-2" }),
          makeValidBridge({ personId: "person-3" }),
        ],
      }),
    );
    expect(errors).toHaveLength(0);
  });

  // ----- negative (whitelist 부재 시 unknown 필드 무시) -----
  it("DTO 단독 validate() 는 정의 외 필드를 무시한다(error 0) — forbidNonWhitelisted 거부는 controller-scope pipe 책임 (negative — unknown field)", async () => {
    const errors = await validatePayload(
      makeValidPayload({ unknownField: "긴 raw 본문" }),
    );
    // whitelist/forbidNonWhitelisted 옵션 없는 단독 validate() 는 unknown 필드를 무시한다.
    // forbid 거부 동작은 controller-scope ValidationPipe 검증(controller spec)에서 cover.
    expect(errors).toHaveLength(0);
  });
});
