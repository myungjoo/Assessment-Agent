// SetDefaultLlmProviderDto spec — T-1865 acceptance 박제. assign-difficulty-mapping
// .dto.spec.ts (T-0139) 1:1 mirror — 두 DTO 가 같은 단일 필수 필드 rule 을 공유하므로
// 검증 축도 같다. class-validator 의 validate() 를 직접 호출해 decorator (@IsString /
// @IsNotEmpty / @MaxLength) 분기를 검증한다 (controller-scope ValidationPipe 와의 통합
// wire 는 llm-provider-config.controller.spec.ts 의 "PUT default" negative block 소관).
//
// R-112: 유효 입력 1+ (error 0) + negative 를 예외 분기마다 1+ (누락 / 빈 문자열 /
// null / wrong type / 길이 초과). plainToInstance 로 plain object 를 DTO instance 로
// 변환한 뒤 validate() (transform: true 인 ValidationPipe 동작 mirror).
import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";

import { SetDefaultLlmProviderDto } from "./set-default-llm-provider.dto";

async function validateDto(plain: Record<string, unknown>) {
  return validate(plainToInstance(SetDefaultLlmProviderDto, plain));
}

describe("SetDefaultLlmProviderDto", () => {
  // happy — 유효한 llmProviderConfigId 는 error 0.
  it("유효한 llmProviderConfigId 는 validation pass (error 0)", async () => {
    const errors = await validateDto({ llmProviderConfigId: "config-cuid-1" });
    expect(errors).toHaveLength(0);
  });

  // negative — 분기별 1+. 누락 / 빈 문자열 / null / number / 255 초과 길이.
  it.each([
    ["누락 (missing)", {}, undefined],
    ["빈 문자열 (empty)", { llmProviderConfigId: "" }, "isNotEmpty"],
    ["null (type mismatch)", { llmProviderConfigId: null }, "isString"],
    ["number (wrong type)", { llmProviderConfigId: 12345 }, "isString"],
    ["255 초과 길이", { llmProviderConfigId: "x".repeat(256) }, "maxLength"],
  ])(
    "llmProviderConfigId 가 %s 이면 validation error (negative)",
    async (_label, plain, constraint) => {
      const errors = await validateDto(plain as Record<string, unknown>);

      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0]?.property).toBe("llmProviderConfigId");
      if (constraint !== undefined) {
        expect(errors[0]?.constraints).toHaveProperty(constraint);
      }
    },
  );
});
