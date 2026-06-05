// GrantInstanceAccessDto spec — T-0237 acceptance 박제 (ADR-0027 §2). class-validator
// 의 validate() 를 직접 호출해 DTO decorator (@IsString / @IsNotEmpty / @MaxLength)
// 의 happy / negative 분기를 검증한다 (controller-scope ValidationPipe 통합 wire 는
// 후속 controller slice 의 controller.spec 책임 — 본 slice 는 DTO 단위 검증만).
// AssignDifficultyMappingDto.spec (src/llm/dto/assign-difficulty-mapping.dto.spec.ts)
// 의 validate() 패턴 1:1 mirror.
//
// R-112: 유효 입력 1+ (error 0) + negative 충분 cover (누락 / 빈 문자열 / null /
// wrong type / 길이 초과 각 1+). 공백-only 는 @IsNotEmpty 가 trim 하지 않아 DTO
// 단계는 통과 — 정규화 후 빈 문자열 거부는 service/repository 의 normalizeInstanceRef
// 책임이므로 service spec 에서 cover (정규화 단일 source, ADR-0027 §2).
import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";

import { GrantInstanceAccessDto } from "./grant-instance-access.dto";

// helper — plain object → DTO instance 변환 후 validate() 결과 반환.
async function validateDto(plain: Record<string, unknown>) {
  const dto = plainToInstance(GrantInstanceAccessDto, plain);
  return validate(dto);
}

describe("GrantInstanceAccessDto", () => {
  // happy #1 — 유효한 GitHub configured host (scheme 없는 host-only).
  it("유효한 GitHub host instanceRef 는 validation pass (happy)", async () => {
    const errors = await validateDto({
      instanceRef: "github.sec.samsung.net",
    });
    expect(errors).toHaveLength(0);
  });

  // happy #2 — 유효한 Confluence 풀 REST base URL (scheme://authority/path).
  it("유효한 Confluence base URL instanceRef 는 validation pass (happy)", async () => {
    const errors = await validateDto({
      instanceRef: "https://acme.atlassian.net/wiki/rest/api",
    });
    expect(errors).toHaveLength(0);
  });

  // negative #1 — 필드 누락 (undefined) → @IsString/@IsNotEmpty 위반.
  it("instanceRef 누락 시 validation error (negative #1: missing)", async () => {
    const errors = await validateDto({});
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]?.property).toBe("instanceRef");
  });

  // negative #2 — 빈 문자열 → @IsNotEmpty 위반.
  it("instanceRef 가 빈 문자열 시 validation error (negative #2: empty)", async () => {
    const errors = await validateDto({ instanceRef: "" });
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]?.constraints).toHaveProperty("isNotEmpty");
  });

  // negative #3 — null → @IsString 위반 (type mismatch).
  it("instanceRef 가 null 시 validation error (negative #3: null)", async () => {
    const errors = await validateDto({ instanceRef: null });
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]?.constraints).toHaveProperty("isString");
  });

  // negative #4 — number type → @IsString 위반.
  it("instanceRef 가 number 시 validation error (negative #4: wrong type)", async () => {
    const errors = await validateDto({ instanceRef: 12345 });
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]?.constraints).toHaveProperty("isString");
  });

  // negative #5 — 2048 초과 길이 → @MaxLength 위반.
  it("instanceRef 가 2048 초과 길이 시 validation error (negative #5: too long)", async () => {
    const errors = await validateDto({ instanceRef: "x".repeat(2049) });
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]?.constraints).toHaveProperty("maxLength");
  });

  // boundary — 정확히 2048 길이는 통과 (경계값 inclusive).
  it("instanceRef 가 정확히 2048 길이면 validation pass (boundary)", async () => {
    const errors = await validateDto({ instanceRef: "x".repeat(2048) });
    expect(errors).toHaveLength(0);
  });
});
