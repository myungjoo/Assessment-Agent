// UpdateGroupDto spec — CI scripts/check-spec-presence.sh 동반 spec 의무 강제.
// R-112 4 카테고리 (happy / error / branch / negative) cover.
//
// 본 spec 은 class-validator decorator 의 PATCH semantics (name field optional)
// 동작을 isolated 하게 검증 — NestJS app context 불필요, plainToInstance +
// validate 만으로 충분. UpdatePersonDto.spec (T-0036) 의 동일 패턴 mirror.
import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";

import { UpdateGroupDto } from "./update-group.dto";

async function validatePlain(payload: unknown): Promise<string[]> {
  const dto = plainToInstance(UpdateGroupDto, payload);
  const errors = await validate(dto);
  return errors.flatMap((e) => Object.keys(e.constraints ?? {}));
}

describe("UpdateGroupDto", () => {
  // ----------------------------------------------------------------------
  // happy #1: 빈 payload 도 통과 (name optional — PATCH no-op semantics).
  // ----------------------------------------------------------------------
  it("빈 payload 는 errors 빈 배열을 반환한다 (happy — name 미포함 시 PATCH no-op)", async () => {
    const errors = await validatePlain({});
    expect(errors).toEqual([]);
  });

  // ----------------------------------------------------------------------
  // happy #2: name 만 patch — 정상 한국어 string.
  // ----------------------------------------------------------------------
  it("정상 name patch 는 errors 빈 배열을 반환한다 (happy)", async () => {
    const errors = await validatePlain({ name: "백엔드팀" });
    expect(errors).toEqual([]);
  });

  // ----------------------------------------------------------------------
  // branch: name 미포함 (empty object) → @IsOptional 분기 → validation pass.
  // happy #1 과 동일 의미이나 UpdatePersonDto.spec 의 명시적 branch 패턴 mirror.
  // ----------------------------------------------------------------------
  it("name 키 자체가 없을 때 @IsOptional 분기로 통과한다 (branch)", async () => {
    const errors = await validatePlain({ other: 1 });
    // name 검사 자체는 통과 (extra-property "other" 의 whitelist 거부는 controller
    // ValidationPipe 책임이므로 본 spec 의 validate() 결과에는 포함 안 됨).
    expect(errors).not.toEqual(expect.arrayContaining(["isString"]));
    expect(errors).not.toEqual(expect.arrayContaining(["isNotEmpty"]));
    expect(errors).not.toEqual(expect.arrayContaining(["maxLength"]));
  });

  // ----------------------------------------------------------------------
  // error path #1: name 이 빈 문자열 → @IsNotEmpty 위반.
  // ----------------------------------------------------------------------
  it("name 이 빈 문자열 시 isNotEmpty 위반 (error path)", async () => {
    const errors = await validatePlain({ name: "" });
    expect(errors).toEqual(expect.arrayContaining(["isNotEmpty"]));
  });

  // ----------------------------------------------------------------------
  // error path #2: name 길이 256 byte → @MaxLength(255) 위반.
  // ----------------------------------------------------------------------
  it("name 길이 256 시 maxLength 위반 (error path)", async () => {
    const errors = await validatePlain({ name: "가".repeat(256) });
    expect(errors).toEqual(expect.arrayContaining(["maxLength"]));
  });

  // ----------------------------------------------------------------------
  // negative #1: name 이 number → @IsString 위반.
  // ----------------------------------------------------------------------
  it("name 이 number 시 isString 위반 (negative)", async () => {
    const errors = await validatePlain({ name: 12345 });
    expect(errors).toEqual(expect.arrayContaining(["isString"]));
  });

  // ----------------------------------------------------------------------
  // negative #2: name 이 boolean → @IsString 위반.
  // ----------------------------------------------------------------------
  it("name 이 boolean 시 isString 위반 (negative)", async () => {
    const errors = await validatePlain({ name: true });
    expect(errors).toEqual(expect.arrayContaining(["isString"]));
  });

  // ----------------------------------------------------------------------
  // negative #3: name 이 null → @IsOptional 분기로 통과 (class-validator 의
  // IsOptional 은 `null` 과 `undefined` 모두 skip — `nullable` 강제 의도가 없을
  // 때 표준 동작). 본 테스트는 null 통과를 명시적으로 박제하여 향후 IsOptional
  // 동작 변경 (예: 라이브러리 upgrade) 의 regression 을 catch 한다.
  // ----------------------------------------------------------------------
  it("name 이 null 이어도 IsOptional 분기로 통과한다 (negative — null/undefined 모두 skip)", async () => {
    const errors = await validatePlain({ name: null });
    expect(errors).toEqual([]);
  });

  // ----------------------------------------------------------------------
  // negative #4: name 이 명시적 undefined → IsOptional 분기 → validation pass.
  // null 과 동일 동작 (대조 박제).
  // ----------------------------------------------------------------------
  it("name 이 명시적 undefined 시 IsOptional 분기로 통과한다 (negative)", async () => {
    const errors = await validatePlain({ name: undefined });
    expect(errors).toEqual([]);
  });

  // ----------------------------------------------------------------------
  // negative #5: name 이 array → @IsString 위반 (string 이 아닌 collection
  // 거부 박제).
  // ----------------------------------------------------------------------
  it("name 이 array 시 isString 위반 (negative)", async () => {
    const errors = await validatePlain({ name: ["a", "b"] });
    expect(errors).toEqual(expect.arrayContaining(["isString"]));
  });
});
