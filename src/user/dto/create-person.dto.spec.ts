// CreatePersonDto spec — CI scripts/check-spec-presence.sh 가 신규 production .ts 에
// 동반 spec 의무 강제. 본 spec 은 class-validator decorator 의 동작을 isolated 하게
// 검증 — controller 의 ValidationPipe 통합 검증은 person.controller.spec.ts 의
// integration 섹션이 cover (5 negative supertest case).
//
// 본 spec 의 책임:
//   - decorator 위반 시 validate() 결과의 errors 가 비어있지 않음 확인 (R-112 negative).
//   - 정상 payload 의 errors 가 빈 배열인지 확인 (happy).
//   - plainToInstance + validate 의 flow 검증 (decorator metadata 가 정상 등록됨의 sanity).
import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";

import { CreatePersonDto } from "./create-person.dto";

// helper — plain 객체 → DTO instance 로 변환 후 validate 실행.
async function validatePlain(payload: unknown): Promise<string[]> {
  const dto = plainToInstance(CreatePersonDto, payload);
  const errors = await validate(dto);
  // constraint 메시지를 모아 반환 — 어떤 decorator 가 실패했는지 식별 용.
  return errors.flatMap((e) => Object.keys(e.constraints ?? {}));
}

describe("CreatePersonDto", () => {
  // ----------------------------------------------------------------------
  // happy: 정상 payload 는 validate 통과 (errors 빈 배열).
  // ----------------------------------------------------------------------
  it("정상 payload 는 errors 빈 배열을 반환한다 (happy)", async () => {
    const errors = await validatePlain({
      fullName: "홍길동",
      email: "hong@example.com",
    });
    expect(errors).toEqual([]);
  });

  // ----------------------------------------------------------------------
  // negative #1: fullName 누락 → @IsString + @IsNotEmpty 위반.
  // ----------------------------------------------------------------------
  it("fullName 누락 시 isNotEmpty / isString 위반 (negative)", async () => {
    const errors = await validatePlain({ email: "hong@example.com" });
    expect(errors.length).toBeGreaterThan(0);
    expect(errors).toEqual(expect.arrayContaining(["isNotEmpty"]));
  });

  // ----------------------------------------------------------------------
  // negative #2: email 형식 invalid → @IsEmail 위반.
  // ----------------------------------------------------------------------
  it("email 형식 invalid 시 isEmail 위반 (negative)", async () => {
    const errors = await validatePlain({
      fullName: "홍길동",
      email: "not-an-email",
    });
    expect(errors).toEqual(expect.arrayContaining(["isEmail"]));
  });

  // ----------------------------------------------------------------------
  // negative #3: fullName 길이 256 → @MaxLength(255) 위반.
  // ----------------------------------------------------------------------
  it("fullName 길이 256 시 maxLength 위반 (negative)", async () => {
    const errors = await validatePlain({
      fullName: "가".repeat(256),
      email: "hong@example.com",
    });
    expect(errors).toEqual(expect.arrayContaining(["maxLength"]));
  });

  // ----------------------------------------------------------------------
  // negative #4: fullName 이 number → @IsString 위반.
  // ----------------------------------------------------------------------
  it("fullName 이 number 시 isString 위반 (negative)", async () => {
    const errors = await validatePlain({
      fullName: 12345,
      email: "hong@example.com",
    });
    expect(errors).toEqual(expect.arrayContaining(["isString"]));
  });

  // ----------------------------------------------------------------------
  // branch: 빈 string fullName → isNotEmpty 가 cover.
  // ----------------------------------------------------------------------
  it("fullName 이 빈 문자열 시 isNotEmpty 위반 (branch)", async () => {
    const errors = await validatePlain({
      fullName: "",
      email: "hong@example.com",
    });
    expect(errors).toEqual(expect.arrayContaining(["isNotEmpty"]));
  });
});
