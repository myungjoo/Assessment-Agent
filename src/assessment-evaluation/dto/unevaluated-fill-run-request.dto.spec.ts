// UnevaluatedFillRunRequestDto spec — T-0570 acceptance 박제 (R-112 4 종 + negative
// cases 충분 cover). class-validator `validate()` 직접 호출로 형식 검증만 단위로 확인한다
// (controller-scope ValidationPipe 통합 검증은 controller spec 의 ValidationPipe 블록).
// unevaluated-fill-plan-request.dto.spec.ts / period-bridge.dto 패턴 mirror.
//
// ADR-0048 §Decision 3: request body 의 defaultModelId 필드는 **제거**됐다 — default 의
// source 가 server-side resolver(LlmProviderConfig DB row)로 이전. DTO 는 rawBridges +
// modelId 2 축만 보유하므로 defaultModelId 누락/빈/non-string error 케이스는 소멸하고,
// 대신 defaultModelId 를 보내도 단독 validate() 가 무시(unknown 필드)함을 negative 로 cover.
//
// 4 종 cover:
//   - happy: rawBridges + modelId 유효 → error 0(defaultModelId 없이도 통과).
//   - error: rawBridges 누락 / non-array / nested PeriodBridgeDto 위반 / modelId 빈 문자열.
//   - branch: modelId 미지정 vs 지정 vs null vs "" / rawBridges 빈 배열 vs 다수 3+.
//   - negative: DTO 단독 validate() 는 whitelist 옵션이 없으므로 unknown 필드(임의 필드 +
//     제거된 defaultModelId 포함)를 무시한다(forbidNonWhitelisted 거부는 controller-scope
//     pipe 책임 — controller spec 검증) 2+.
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

// makeValidPayload — 유효 run-request plain payload(rawBridges 1 + modelId). default 의
// source 는 server-side resolver 라 request body 에 defaultModelId 가 없다(ADR-0048 §3).
function makeValidPayload(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    rawBridges: [makeValidBridge()],
    modelId: "gpt-4o-mini",
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
  it("2 축 유효(rawBridges 2 + modelId, defaultModelId 없이) 시 error 0 (happy)", async () => {
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

  it("제거된 defaultModelId 를 보내도 DTO 단독 validate() 는 무시한다(error 0) — 필드 제거 후 unknown 처리 (negative — 제거된 defaultModelId)", async () => {
    // ADR-0048 §Decision 3 으로 defaultModelId 필드가 제거됐으므로, payload 에 그 값이
    // 남아있어도 단독 validate() 는 더 이상 검증 대상이 아니라 unknown 필드로 무시한다.
    // controller-scope ValidationPipe(forbidNonWhitelisted)는 이를 거부한다(controller spec).
    const errors = await validatePayload(
      makeValidPayload({ defaultModelId: "gpt-4o" }),
    );
    expect(errors).toHaveLength(0);
  });

  it("제거된 defaultModelId 가 빈/non-string 이어도 DTO 단독 validate() 는 무시한다(error 0) (negative — 제거된 필드 형식 무관)", async () => {
    // 필드 자체가 사라졌으므로 빈 문자열/number 등 어떤 형식이어도 검증 분기가 없다(무시).
    const emptyErrors = await validatePayload(
      makeValidPayload({ defaultModelId: "" }),
    );
    const numberErrors = await validatePayload(
      makeValidPayload({ defaultModelId: 123 }),
    );
    expect(emptyErrors).toHaveLength(0);
    expect(numberErrors).toHaveLength(0);
  });
});
