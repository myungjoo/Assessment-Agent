// UpdateLlmProviderConfigDto spec — T-0151 acceptance 박제. create-llm-provider-config
// .dto.spec.ts 위치/패턴 mirror — class-validator 의 validate() 를 직접 호출해 DTO
// decorator (@IsOptional / @IsString / @IsNotEmpty / @MaxLength) 의 분기를 검증한다.
// PATCH 의 핵심 차이 (모든 필드 optional — 부재 허용, 명시 시 형식 강제) 를 집중 cover:
//   - 빈 body (모든 필드 부재) 도 valid (error 0) — 부분 갱신 no-op 허용.
//   - 일부 필드만 명시 (endpointUrl-only / apiKey-only) 도 valid.
//   - 명시한 필드의 빈 문자열 / wrong type / null / 길이 초과는 거부 (negative).
// controller-scope ValidationPipe 의 forbidNonWhitelisted (extra-key 400) 통합 wire 는
// llm-provider-config.controller.spec.ts 의 PATCH ValidationPipe block 이 별도 cover.
import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";

import { UpdateLlmProviderConfigDto } from "./update-llm-provider-config.dto";

// helper — plain object → DTO instance 변환 후 validate() 결과 반환.
async function validateDto(plain: Record<string, unknown>) {
  const dto = plainToInstance(UpdateLlmProviderConfigDto, plain);
  return validate(dto);
}

// 유효한 4 필드 fixture — negative case 는 이 base 에서 1 필드만 변형해 격리 검증.
function validPayload(): Record<string, unknown> {
  return {
    provider: "openai",
    endpointUrl: "https://api.example.test",
    apiKey: "sk-test-plaintext",
    modelId: "gpt-test",
  };
}

describe("UpdateLlmProviderConfigDto", () => {
  // happy — 4 필드 모두 명시 (유효) 는 error 0.
  it("유효한 4 필드 명시는 validation pass (error 0)", async () => {
    const errors = await validateDto(validPayload());
    expect(errors).toHaveLength(0);
  });

  // happy / branch (핵심) — 빈 body (모든 필드 부재) 도 valid (부분 갱신 no-op 허용).
  it("빈 body (모든 필드 부재) 도 형식상 valid (branch 핵심 — 모든 필드 optional)", async () => {
    const errors = await validateDto({});
    expect(errors).toHaveLength(0);
  });

  // happy / branch — 일부 필드만 명시 (endpointUrl-only) 도 valid (부분 갱신).
  it("endpointUrl 만 명시해도 valid (branch — 단일 필드 부분 갱신)", async () => {
    const errors = await validateDto({
      endpointUrl: "https://new.example.test",
    });
    expect(errors).toHaveLength(0);
  });

  // happy / branch — apiKey-only 명시도 valid (재암호화 단독 경로).
  it("apiKey 만 명시해도 valid (branch — apiKey 단독 재암호화 경로)", async () => {
    const errors = await validateDto({ apiKey: "sk-rotated" });
    expect(errors).toHaveLength(0);
  });

  // happy — provider 형식만 검증 (허용 집합 검증은 service 책임). 명시한 미지원
  // provider literal 도 비어있지 않은 string 이면 형식 통과.
  it("미지원 provider literal 명시라도 비어있지 않은 string 이면 형식 통과 (멤버십은 service 책임)", async () => {
    const errors = await validateDto({ provider: "not-a-real-provider" });
    expect(errors).toHaveLength(0);
  });

  // ---------------------------------------------------------------------------
  // negative — 명시한 필드의 빈 문자열 (@IsNotEmpty 위반). 부재는 허용하지만 명시
  // 했다면 의미 있는 값이어야 함 (빈 string 거부).
  // ---------------------------------------------------------------------------
  it.each(["provider", "endpointUrl", "apiKey", "modelId"])(
    "%s 를 빈 문자열로 명시 시 validation error (negative: empty → isNotEmpty)",
    async (field) => {
      const errors = await validateDto({ [field]: "" });
      const target = errors.find((e) => e.property === field);
      expect(target?.constraints).toHaveProperty("isNotEmpty");
    },
  );

  // ---------------------------------------------------------------------------
  // negative — 명시한 필드의 wrong type (number → @IsString 위반).
  // ---------------------------------------------------------------------------
  it.each(["provider", "endpointUrl", "apiKey", "modelId"])(
    "%s 를 number 로 명시 시 validation error (negative: wrong type → isString)",
    async (field) => {
      const errors = await validateDto({ [field]: 12345 });
      const target = errors.find((e) => e.property === field);
      expect(target?.constraints).toHaveProperty("isString");
    },
  );

  // ---------------------------------------------------------------------------
  // branch — 명시한 필드의 null. @IsOptional 은 null 과 undefined 둘 다 부재로
  // 취급해 나머지 validator 를 skip 하므로 DTO 단계에서는 error 0 (부재 = 미변경).
  // null provider 가 흘러가도 service 의 isLlmProvider(null) 검증이 BadRequestException
  // 으로 거부 (llm-provider-config.service.spec.ts 의 provider 무효 case 가 cover).
  // ---------------------------------------------------------------------------
  it("provider 가 null 이면 @IsOptional 이 부재로 취급해 DTO 단계 error 0 (branch — null skip, service 가 거부)", async () => {
    const errors = await validateDto({ provider: null });
    expect(errors.find((e) => e.property === "provider")).toBeUndefined();
  });

  // ---------------------------------------------------------------------------
  // negative — 명시한 필드의 길이 초과 (@MaxLength 위반). 각 필드 cap 경계 + 1.
  // ---------------------------------------------------------------------------
  it("provider 가 64 초과 길이 명시 시 validation error (negative: too long → maxLength)", async () => {
    const errors = await validateDto({ provider: "x".repeat(65) });
    const target = errors.find((e) => e.property === "provider");
    expect(target?.constraints).toHaveProperty("maxLength");
  });

  it("endpointUrl 이 2048 초과 길이 명시 시 validation error (negative: too long → maxLength)", async () => {
    const errors = await validateDto({ endpointUrl: "x".repeat(2049) });
    const target = errors.find((e) => e.property === "endpointUrl");
    expect(target?.constraints).toHaveProperty("maxLength");
  });

  it("apiKey 가 4096 초과 길이 명시 시 validation error (negative: too long → maxLength)", async () => {
    const errors = await validateDto({ apiKey: "x".repeat(4097) });
    const target = errors.find((e) => e.property === "apiKey");
    expect(target?.constraints).toHaveProperty("maxLength");
  });

  it("modelId 가 255 초과 길이 명시 시 validation error (negative: too long → maxLength)", async () => {
    const errors = await validateDto({ modelId: "x".repeat(256) });
    const target = errors.find((e) => e.property === "modelId");
    expect(target?.constraints).toHaveProperty("maxLength");
  });
});
