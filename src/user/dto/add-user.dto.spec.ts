// AddUserDto spec — T-0092 acceptance §B 박제. R-112 4 카테고리 (happy / error /
// branch / negative cases 충분 cover) + class-validator 의 validate() API +
// plainToInstance 검증 패턴 — ChangeRoleDto / CreatePersonDto / LoginDto spec
// 정공법 정합.
//
// 검증 방식:
//   - plainToInstance(AddUserDto, plain) 으로 plain JSON 을 DTO instance 로 변환.
//   - validate(instance, { whitelist: true, forbidNonWhitelisted: true }) 로
//     ValidationPipe 와 동일 옵션 박제 → 정의되지 않은 필드 reject 도 cover.
//   - 실 controller-scope ValidationPipe 통합 검증은 UserController spec 의
//     supertest integration 에서 별도 cover (R-112 합산).
import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";

import { AddUserDto, PASSWORD_MIN_LENGTH } from "./add-user.dto";

describe("AddUserDto", () => {
  // helper — ValidationPipe 와 동등한 검증을 1 라인으로 박제. controller-scope
  // ValidationPipe ({ whitelist: true, forbidNonWhitelisted: true, transform: true })
  // 의 검증 표면과 1:1 정합.
  async function validateDto(plain: unknown): Promise<{ errorCount: number }> {
    const instance = plainToInstance(AddUserDto, plain);
    const errors = await validate(instance as object, {
      whitelist: true,
      forbidNonWhitelisted: true,
    });
    return { errorCount: errors.length };
  }

  // ---- PASSWORD_MIN_LENGTH const 박제 -------------------------------------
  describe("PASSWORD_MIN_LENGTH const", () => {
    it("값이 8 (signup password 정책 첫 박제 — 정책 변경 catch)", () => {
      expect(PASSWORD_MIN_LENGTH).toBe(8);
    });
  });

  // ---- happy — valid payload (정상 통과) ----------------------------------
  describe("happy — valid payload", () => {
    it("정상 email + 8 char password → 통과 (happy)", async () => {
      const { errorCount } = await validateDto({
        email: "test@example.com",
        password: "securepass",
      });
      expect(errorCount).toBe(0);
    });

    it("정상 email + 30 char password → 통과 (happy — long password)", async () => {
      const { errorCount } = await validateDto({
        email: "test@example.com",
        password: "a".repeat(30),
      });
      expect(errorCount).toBe(0);
    });

    it("정상 email + 정확히 8 char password → 통과 (boundary — MinLength inclusive)", async () => {
      const { errorCount } = await validateDto({
        email: "test@example.com",
        password: "12345678",
      });
      expect(errorCount).toBe(0);
    });
  });

  // ---- error — missing required fields -----------------------------------
  describe("error — missing required fields", () => {
    it("email 누락 시 reject (error — missing email)", async () => {
      const { errorCount } = await validateDto({ password: "securepass" });
      expect(errorCount).toBeGreaterThan(0);
    });

    it("password 누락 시 reject (error — missing password)", async () => {
      const { errorCount } = await validateDto({ email: "test@example.com" });
      expect(errorCount).toBeGreaterThan(0);
    });

    it("email + password 모두 누락 시 reject (error — empty payload)", async () => {
      const { errorCount } = await validateDto({});
      expect(errorCount).toBeGreaterThan(0);
    });
  });

  // ---- error — invalid format -------------------------------------------
  describe("error — invalid format", () => {
    it("email='not-an-email' 시 reject (error — IsEmail 위반)", async () => {
      const { errorCount } = await validateDto({
        email: "not-an-email",
        password: "securepass",
      });
      expect(errorCount).toBeGreaterThan(0);
    });

    it("email='' (빈 string) 시 reject (error — IsEmail / IsNotEmpty 위반)", async () => {
      const { errorCount } = await validateDto({
        email: "",
        password: "securepass",
      });
      expect(errorCount).toBeGreaterThan(0);
    });

    it("password='' (빈 string) 시 reject (error — IsNotEmpty 위반)", async () => {
      const { errorCount } = await validateDto({
        email: "test@example.com",
        password: "",
      });
      expect(errorCount).toBeGreaterThan(0);
    });
  });

  // ---- boundary — MinLength -----------------------------------------------
  describe("boundary — password MinLength", () => {
    it("password='1234567' (7 char, 1 미만) 시 reject (boundary — MinLength)", async () => {
      const { errorCount } = await validateDto({
        email: "test@example.com",
        password: "1234567",
      });
      expect(errorCount).toBeGreaterThan(0);
    });

    it("password='1' (1 char) 시 reject (boundary — far below MinLength)", async () => {
      const { errorCount } = await validateDto({
        email: "test@example.com",
        password: "1",
      });
      expect(errorCount).toBeGreaterThan(0);
    });
  });

  // ---- negative — wrong type / null -------------------------------------
  describe("negative — wrong type / null", () => {
    it("email=12345 (number) 시 reject (negative — wrong type)", async () => {
      const { errorCount } = await validateDto({
        email: 12345,
        password: "securepass",
      });
      expect(errorCount).toBeGreaterThan(0);
    });

    it("password=true (boolean) 시 reject (negative — wrong type)", async () => {
      const { errorCount } = await validateDto({
        email: "test@example.com",
        password: true,
      });
      expect(errorCount).toBeGreaterThan(0);
    });

    it("email=null 시 reject (negative — null email)", async () => {
      const { errorCount } = await validateDto({
        email: null,
        password: "securepass",
      });
      expect(errorCount).toBeGreaterThan(0);
    });

    it("password=null 시 reject (negative — null password)", async () => {
      const { errorCount } = await validateDto({
        email: "test@example.com",
        password: null,
      });
      expect(errorCount).toBeGreaterThan(0);
    });

    it("정의되지 않은 필드 (`role`) 포함 시 reject (negative — forbidNonWhitelisted)", async () => {
      // role 우회 차단 — 첫 user SuperAdmin 자동 분기의 외부 지정 방어 박제.
      const { errorCount } = await validateDto({
        email: "test@example.com",
        password: "securepass",
        role: "SuperAdmin",
      });
      expect(errorCount).toBeGreaterThan(0);
    });

    it("정의되지 않은 필드 (`foo`) 포함 시 reject (negative — extra unknown field)", async () => {
      const { errorCount } = await validateDto({
        email: "test@example.com",
        password: "securepass",
        foo: "bar",
      });
      expect(errorCount).toBeGreaterThan(0);
    });
  });
});
