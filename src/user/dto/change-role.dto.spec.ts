// ChangeRoleDto spec — T-0087 acceptance §A 박제. R-112 4 카테고리 (happy / branch /
// negative cases 충분 cover) + class-validator 의 validate() API + plainToInstance
// 검증 패턴 — LoginDto / AddMemberDto spec 정공법 정합.
//
// 검증 방식 — class-validator 의 `validate()` API + plainToInstance.
//   - plainToInstance(ChangeRoleDto, plain) 으로 plain JSON 을 DTO instance 로 변환.
//   - validate(instance, { whitelist: true, forbidNonWhitelisted: true }) 로
//     ValidationPipe 와 동일 옵션 박제 → 정의되지 않은 필드 reject 도 cover.
//   - 실 controller-scope ValidationPipe 통합 검증은 UserController spec 의
//     supertest integration 에서 별도 cover (R-112 합산).
import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";

import { ChangeRoleDto, VALID_ROLE_VALUES } from "./change-role.dto";

describe("ChangeRoleDto", () => {
  // helper — ValidationPipe 와 동등한 검증을 1 라인으로 박제. controller-scope
  // ValidationPipe ({ whitelist: true, forbidNonWhitelisted: true, transform: true })
  // 의 검증 표면과 1:1 정합.
  async function validateDto(plain: unknown): Promise<{ errorCount: number }> {
    const instance = plainToInstance(ChangeRoleDto, plain);
    const errors = await validate(instance as object, {
      whitelist: true,
      forbidNonWhitelisted: true,
    });
    return { errorCount: errors.length };
  }

  // ---- VALID_ROLE_VALUES invariant (UserService.VALID_ROLES 정합) -----------
  describe("VALID_ROLE_VALUES const", () => {
    it("SuperAdmin / Admin / User 3 종 박제 (UserService.VALID_ROLES 정합)", () => {
      expect(VALID_ROLE_VALUES).toEqual(["SuperAdmin", "Admin", "User"]);
    });

    it("배열 길이 정확히 3 (값 추가/제거 catch)", () => {
      expect(VALID_ROLE_VALUES).toHaveLength(3);
    });
  });

  // ---- happy — 3 종 role 값 모두 통과 ---------------------------------------
  describe("happy — VALID_ROLE_VALUES 의 3 종 모두 통과", () => {
    it("role = 'SuperAdmin' 통과", async () => {
      const { errorCount } = await validateDto({ role: "SuperAdmin" });
      expect(errorCount).toBe(0);
    });

    it("role = 'Admin' 통과", async () => {
      const { errorCount } = await validateDto({ role: "Admin" });
      expect(errorCount).toBe(0);
    });

    it("role = 'User' 통과", async () => {
      const { errorCount } = await validateDto({ role: "User" });
      expect(errorCount).toBe(0);
    });
  });

  // ---- negative — missing / empty / wrong type / enum 외 / extra field ------
  describe("negative — missing / empty / wrong type / enum 외 / extra field", () => {
    it("role 누락 시 reject (negative #1: missing required role)", async () => {
      const { errorCount } = await validateDto({});
      expect(errorCount).toBeGreaterThan(0);
    });

    it("role 이 빈 문자열 시 reject (negative #2: empty string, @IsNotEmpty)", async () => {
      const { errorCount } = await validateDto({ role: "" });
      expect(errorCount).toBeGreaterThan(0);
    });

    it("role 이 number 시 reject (negative #3: wrong type — number)", async () => {
      const { errorCount } = await validateDto({ role: 123 });
      expect(errorCount).toBeGreaterThan(0);
    });

    it("role 이 boolean 시 reject (negative #4: wrong type — boolean)", async () => {
      const { errorCount } = await validateDto({ role: true });
      expect(errorCount).toBeGreaterThan(0);
    });

    it("role 이 null 시 reject (negative #5: null)", async () => {
      const { errorCount } = await validateDto({ role: null });
      expect(errorCount).toBeGreaterThan(0);
    });

    it("role 이 'Owner' (enum 외) 시 reject (negative #6: invalid enum)", async () => {
      const { errorCount } = await validateDto({ role: "Owner" });
      expect(errorCount).toBeGreaterThan(0);
    });

    it("role 이 'admin' (소문자, enum 외) 시 reject (negative #7: case-sensitive)", async () => {
      const { errorCount } = await validateDto({ role: "admin" });
      expect(errorCount).toBeGreaterThan(0);
    });

    it("role 이 'user' (소문자, enum 외) 시 reject (negative #8: case-sensitive)", async () => {
      const { errorCount } = await validateDto({ role: "user" });
      expect(errorCount).toBeGreaterThan(0);
    });

    it("role 이 'SUPERADMIN' (대문자, enum 외) 시 reject (negative #9: case-sensitive upper)", async () => {
      const { errorCount } = await validateDto({ role: "SUPERADMIN" });
      expect(errorCount).toBeGreaterThan(0);
    });

    it("정의되지 않은 필드 (`foo`) 포함 시 reject (negative #10: extra unknown field, forbidNonWhitelisted)", async () => {
      const { errorCount } = await validateDto({ role: "Admin", foo: "bar" });
      expect(errorCount).toBeGreaterThan(0);
    });
  });
});
