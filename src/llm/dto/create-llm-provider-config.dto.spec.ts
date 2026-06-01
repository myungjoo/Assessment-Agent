// CreateLlmProviderConfigDto spec — T-0149 acceptance 박제. class-validator 의
// validate() 를 직접 호출해 DTO decorator (@IsString / @IsNotEmpty / @MaxLength) 의
// happy / negative 분기를 4 필드 (provider / endpointUrl / apiKey / modelId) 에 대해
// 검증한다. controller-scope ValidationPipe 의 forbidNonWhitelisted (extra-key 400)
// 통합 wire 는 llm-provider-config.controller.spec.ts 의 ValidationPipe integration
// block 이 별도 cover (본 spec 은 DTO decorator 단위 검증).
//
// R-112: 유효 입력 1+ (error 0) + negative 충분 cover (필드별 누락 / 빈 문자열 /
// wrong type / 길이 초과 각 1+). plainToInstance 로 plain object 를 DTO instance 로
// 변환한 뒤 validate() (transform 의 ValidationPipe 동작 mirror).
import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";

import { CreateLlmProviderConfigDto } from "./create-llm-provider-config.dto";

// helper — plain object → DTO instance 변환 후 validate() 결과 반환.
async function validateDto(plain: Record<string, unknown>) {
  const dto = plainToInstance(CreateLlmProviderConfigDto, plain);
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

describe("CreateLlmProviderConfigDto", () => {
  // happy — 유효한 4 필드는 error 0.
  it("유효한 4 필드는 validation pass (error 0)", async () => {
    const errors = await validateDto(validPayload());
    expect(errors).toHaveLength(0);
  });

  // happy — provider 형식만 검증 (허용 집합 검증은 service 책임). DTO 단계에서는
  // 미지원 provider literal 도 비어있지 않은 string 이면 형식 통과.
  it("미지원 provider literal 이라도 비어있지 않은 string 이면 형식 통과 (provider 멤버십은 service 책임)", async () => {
    const errors = await validateDto({
      ...validPayload(),
      provider: "not-a-real-provider",
    });
    expect(errors).toHaveLength(0);
  });

  // ---------------------------------------------------------------------------
  // negative — 필드별 누락 (undefined)
  // ---------------------------------------------------------------------------
  it.each(["provider", "endpointUrl", "apiKey", "modelId"])(
    "%s 누락 시 validation error (negative: missing)",
    async (field) => {
      const payload = validPayload();
      delete payload[field];
      const errors = await validateDto(payload);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some((e) => e.property === field)).toBe(true);
    },
  );

  // ---------------------------------------------------------------------------
  // negative — 필드별 빈 문자열 (@IsNotEmpty 위반)
  // ---------------------------------------------------------------------------
  it.each(["provider", "endpointUrl", "apiKey", "modelId"])(
    "%s 가 빈 문자열 시 validation error (negative: empty → isNotEmpty)",
    async (field) => {
      const errors = await validateDto({ ...validPayload(), [field]: "" });
      const target = errors.find((e) => e.property === field);
      expect(target?.constraints).toHaveProperty("isNotEmpty");
    },
  );

  // ---------------------------------------------------------------------------
  // negative — 필드별 wrong type (number → @IsString 위반)
  // ---------------------------------------------------------------------------
  it.each(["provider", "endpointUrl", "apiKey", "modelId"])(
    "%s 가 number 시 validation error (negative: wrong type → isString)",
    async (field) => {
      const errors = await validateDto({ ...validPayload(), [field]: 12345 });
      const target = errors.find((e) => e.property === field);
      expect(target?.constraints).toHaveProperty("isString");
    },
  );

  // ---------------------------------------------------------------------------
  // negative — 필드별 null (@IsString 위반 — null type mismatch)
  // ---------------------------------------------------------------------------
  it("provider 가 null 시 validation error (negative: null → isString)", async () => {
    const errors = await validateDto({ ...validPayload(), provider: null });
    const target = errors.find((e) => e.property === "provider");
    expect(target?.constraints).toHaveProperty("isString");
  });

  // ---------------------------------------------------------------------------
  // negative — 필드별 길이 초과 (@MaxLength 위반). 각 필드 cap 경계 + 1.
  // ---------------------------------------------------------------------------
  it("provider 가 64 초과 길이 시 validation error (negative: too long → maxLength)", async () => {
    const errors = await validateDto({
      ...validPayload(),
      provider: "x".repeat(65),
    });
    const target = errors.find((e) => e.property === "provider");
    expect(target?.constraints).toHaveProperty("maxLength");
  });

  it("endpointUrl 이 2048 초과 길이 시 validation error (negative: too long → maxLength)", async () => {
    const errors = await validateDto({
      ...validPayload(),
      endpointUrl: "x".repeat(2049),
    });
    const target = errors.find((e) => e.property === "endpointUrl");
    expect(target?.constraints).toHaveProperty("maxLength");
  });

  it("apiKey 가 4096 초과 길이 시 validation error (negative: too long → maxLength)", async () => {
    const errors = await validateDto({
      ...validPayload(),
      apiKey: "x".repeat(4097),
    });
    const target = errors.find((e) => e.property === "apiKey");
    expect(target?.constraints).toHaveProperty("maxLength");
  });

  it("modelId 가 255 초과 길이 시 validation error (negative: too long → maxLength)", async () => {
    const errors = await validateDto({
      ...validPayload(),
      modelId: "x".repeat(256),
    });
    const target = errors.find((e) => e.property === "modelId");
    expect(target?.constraints).toHaveProperty("maxLength");
  });
});
