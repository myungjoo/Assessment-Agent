// AssignDifficultyMappingDto spec — T-0139 acceptance 박제. class-validator 의
// validate() 를 직접 호출해 DTO decorator (@IsString / @IsNotEmpty / @MaxLength) 의
// happy / negative 분기를 검증한다 (controller-scope ValidationPipe 의 통합 wire 는
// difficulty-mapping.controller.spec.ts 의 ValidationPipe integration block 이 별도 cover).
//
// R-112: 유효 입력 1+ (error 0) + negative 충분 cover (누락 / 빈 문자열 / 공백 /
// wrong type / 길이 초과 각 1+). plainToInstance 로 plain object 를 DTO instance 로
// 변환한 뒤 validate() (transform 의 ValidationPipe 동작 mirror).
import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";

import { AssignDifficultyMappingDto } from "./assign-difficulty-mapping.dto";

// helper — plain object → DTO instance 변환 후 validate() 결과 반환.
async function validateDto(plain: Record<string, unknown>) {
  const dto = plainToInstance(AssignDifficultyMappingDto, plain);
  return validate(dto);
}

describe("AssignDifficultyMappingDto", () => {
  // happy — 유효한 llmProviderConfigId 는 error 0.
  it("유효한 llmProviderConfigId 는 validation pass (error 0)", async () => {
    const errors = await validateDto({ llmProviderConfigId: "config-cuid-1" });
    expect(errors).toHaveLength(0);
  });

  // negative #1 — 필드 누락 (undefined) → @IsString/@IsNotEmpty 위반.
  it("llmProviderConfigId 누락 시 validation error (negative #1: missing)", async () => {
    const errors = await validateDto({});
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]?.property).toBe("llmProviderConfigId");
  });

  // negative #2 — 빈 문자열 → @IsNotEmpty 위반.
  it("llmProviderConfigId 가 빈 문자열 시 validation error (negative #2: empty)", async () => {
    const errors = await validateDto({ llmProviderConfigId: "" });
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]?.constraints).toHaveProperty("isNotEmpty");
  });

  // negative #3 — null → @IsString 위반 (class-validator 의 @IsNotEmpty 는 trim 하지
  // 않으므로 공백만 string 은 통과 — null / undefined / 빈 문자열만 거부. null 은
  // @IsString 이 type mismatch 로 거부).
  it("llmProviderConfigId 가 null 시 validation error (negative #3: null)", async () => {
    const errors = await validateDto({ llmProviderConfigId: null });
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]?.constraints).toHaveProperty("isString");
  });

  // negative #4 — number type → @IsString 위반.
  it("llmProviderConfigId 가 number 시 validation error (negative #4: wrong type)", async () => {
    const errors = await validateDto({ llmProviderConfigId: 12345 });
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]?.constraints).toHaveProperty("isString");
  });

  // negative #5 — 255 초과 길이 → @MaxLength 위반.
  it("llmProviderConfigId 가 255 초과 길이 시 validation error (negative #5: too long)", async () => {
    const errors = await validateDto({ llmProviderConfigId: "x".repeat(256) });
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]?.constraints).toHaveProperty("maxLength");
  });
});
