// ChangeRoleDto spec — CI scripts/check-spec-presence.sh 가 신규 production .ts 에
// 동반 spec 의무 강제 (T-0087 round 1 누락으로 reviewer BLOCKER → round 2 amendment).
// T-0057 add-member.dto.spec.ts 의 round 2 amendment 패턴을 verbatim mirror —
// class-validator decorator 의 동작을 isolated 하게 검증한다.
// 본 spec 은 DTO isolated 책임만 (decorator metadata sanity). controller-scope
// ValidationPipe (whitelist + forbidNonWhitelisted + transform) 통합 검증은
// user.controller.spec.ts 의 integration 섹션이 cover — 책임 경계 명확.
import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";

import { ChangeRoleDto } from "./change-role.dto";

// helper — plain 객체 → DTO instance 로 변환 후 validate 실행.
// 반환값은 위반된 constraint 의 key 모음 (예: "isString", "isNotEmpty", "isIn") —
// 어떤 decorator 가 실패했는지 expect 단정에 활용.
async function validatePlain(payload: unknown): Promise<string[]> {
  const dto = plainToInstance(ChangeRoleDto, payload);
  const errors = await validate(dto);
  return errors.flatMap((e) => Object.keys(e.constraints ?? {}));
}

describe("ChangeRoleDto", () => {
  // ----------------------------------------------------------------------
  // happy: VALID_ROLE_VALUES 의 세 enum 값 각각이 errors 빈 배열을 반환.
  // UserRole literal union 의 세 분기 (SuperAdmin / Admin / User) 모두 cover.
  // ----------------------------------------------------------------------
  it("role=SuperAdmin 은 errors 빈 배열을 반환한다 (happy)", async () => {
    const errors = await validatePlain({ role: "SuperAdmin" });
    expect(errors).toEqual([]);
  });

  it("role=Admin 은 errors 빈 배열을 반환한다 (happy)", async () => {
    const errors = await validatePlain({ role: "Admin" });
    expect(errors).toEqual([]);
  });

  it("role=User 는 errors 빈 배열을 반환한다 (happy)", async () => {
    const errors = await validatePlain({ role: "User" });
    expect(errors).toEqual([]);
  });

  // ----------------------------------------------------------------------
  // negative #1: role 누락 → @IsNotEmpty 위반 (missing field).
  // ----------------------------------------------------------------------
  it("role 누락 시 isNotEmpty 위반 (negative)", async () => {
    const errors = await validatePlain({});
    expect(errors.length).toBeGreaterThan(0);
    expect(errors).toEqual(expect.arrayContaining(["isNotEmpty"]));
  });

  // ----------------------------------------------------------------------
  // negative #2: role 이 number → @IsString 위반 (wrong type).
  // ----------------------------------------------------------------------
  it("role 이 number 시 isString 위반 (negative)", async () => {
    const errors = await validatePlain({ role: 123 });
    expect(errors.length).toBeGreaterThan(0);
    expect(errors).toEqual(expect.arrayContaining(["isString"]));
  });

  // ----------------------------------------------------------------------
  // negative #3: role 이 빈 문자열 → @IsNotEmpty 위반 (branch — 키는 있으나 값이 empty).
  // ----------------------------------------------------------------------
  it("role 이 빈 문자열 시 isNotEmpty 위반 (branch)", async () => {
    const errors = await validatePlain({ role: "" });
    expect(errors.length).toBeGreaterThan(0);
    expect(errors).toEqual(expect.arrayContaining(["isNotEmpty"]));
  });

  // ----------------------------------------------------------------------
  // negative #4: role 이 enum 외 값 ("Owner") → @IsIn 위반 (invariant 2 박제).
  // UserService.VALID_ROLES 의 HTTP boundary 동기 확인.
  // ----------------------------------------------------------------------
  it("role=Owner (enum 외) 시 isIn 위반 (negative)", async () => {
    const errors = await validatePlain({ role: "Owner" });
    expect(errors.length).toBeGreaterThan(0);
    expect(errors).toEqual(expect.arrayContaining(["isIn"]));
  });

  // ----------------------------------------------------------------------
  // negative #5: role 이 소문자 ("user") → @IsIn 위반 (case-sensitive).
  // VALID_ROLE_VALUES literal 의 case-sensitive 동기 확인.
  // ----------------------------------------------------------------------
  it("role=user (소문자) 시 isIn 위반 (negative)", async () => {
    const errors = await validatePlain({ role: "user" });
    expect(errors.length).toBeGreaterThan(0);
    expect(errors).toEqual(expect.arrayContaining(["isIn"]));
  });

  // ----------------------------------------------------------------------
  // negative #6: role 이 null → @IsString 위반.
  // ----------------------------------------------------------------------
  it("role 이 null 시 isString 위반 (negative)", async () => {
    const errors = await validatePlain({ role: null });
    expect(errors.length).toBeGreaterThan(0);
    expect(errors).toEqual(expect.arrayContaining(["isString"]));
  });
});
