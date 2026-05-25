// UpdatePersonDto spec — CI scripts/check-spec-presence.sh 동반 spec 의무 강제.
// 본 spec 은 class-validator decorator 의 PATCH semantics (모든 필드 IsOptional)
// 동작을 isolated 하게 검증.
import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";

import { UpdatePersonDto } from "./update-person.dto";

async function validatePlain(payload: unknown): Promise<string[]> {
  const dto = plainToInstance(UpdatePersonDto, payload);
  const errors = await validate(dto);
  return errors.flatMap((e) => Object.keys(e.constraints ?? {}));
}

describe("UpdatePersonDto", () => {
  // ----------------------------------------------------------------------
  // happy: 빈 payload 도 통과 (모든 필드 optional — PATCH semantics).
  // ----------------------------------------------------------------------
  it("빈 payload 는 errors 빈 배열을 반환한다 (happy — 모든 필드 optional)", async () => {
    const errors = await validatePlain({});
    expect(errors).toEqual([]);
  });

  // ----------------------------------------------------------------------
  // happy: fullName 만 patch.
  // ----------------------------------------------------------------------
  it("fullName 만 patch 도 통과 (happy)", async () => {
    const errors = await validatePlain({ fullName: "박영희" });
    expect(errors).toEqual([]);
  });

  // ----------------------------------------------------------------------
  // happy: active flag 만 patch.
  // ----------------------------------------------------------------------
  it("active flag 만 patch 도 통과 (happy)", async () => {
    const errors = await validatePlain({ active: false });
    expect(errors).toEqual([]);
  });

  // ----------------------------------------------------------------------
  // negative #1: email 형식 invalid → @IsEmail 위반.
  // ----------------------------------------------------------------------
  it("email 형식 invalid 시 isEmail 위반 (negative)", async () => {
    const errors = await validatePlain({ email: "not-an-email" });
    expect(errors).toEqual(expect.arrayContaining(["isEmail"]));
  });

  // ----------------------------------------------------------------------
  // negative #2: fullName 이 number → @IsString 위반.
  // ----------------------------------------------------------------------
  it("fullName 이 number 시 isString 위반 (negative)", async () => {
    const errors = await validatePlain({ fullName: 12345 });
    expect(errors).toEqual(expect.arrayContaining(["isString"]));
  });

  // ----------------------------------------------------------------------
  // negative #3: active 가 string → @IsBoolean 위반.
  // ----------------------------------------------------------------------
  it("active 가 string 시 isBoolean 위반 (negative)", async () => {
    const errors = await validatePlain({ active: "yes" });
    expect(errors).toEqual(expect.arrayContaining(["isBoolean"]));
  });

  // ----------------------------------------------------------------------
  // negative #4: fullName 길이 256 → @MaxLength(255) 위반.
  // ----------------------------------------------------------------------
  it("fullName 길이 256 시 maxLength 위반 (negative)", async () => {
    const errors = await validatePlain({ fullName: "가".repeat(256) });
    expect(errors).toEqual(expect.arrayContaining(["maxLength"]));
  });

  // ----------------------------------------------------------------------
  // branch: fullName 이 빈 문자열 → @IsNotEmpty 위반.
  // ----------------------------------------------------------------------
  it("fullName 이 빈 문자열 시 isNotEmpty 위반 (branch)", async () => {
    const errors = await validatePlain({ fullName: "" });
    expect(errors).toEqual(expect.arrayContaining(["isNotEmpty"]));
  });
});
