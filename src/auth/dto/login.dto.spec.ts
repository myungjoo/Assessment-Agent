// LoginDto spec — T-0082 acceptance §C 박제. R-112 4 카테고리 (happy / error /
// branch / negative) + negative cases 충분 cover (empty email / invalid email
// format / empty password / missing fields / extra fields rejection / wrong type).
//
// 검증 방식 — class-validator 의 `validate()` API + plainToInstance.
//   - plainToInstance(LoginDto, plain) 으로 plain JSON 을 DTO instance 로 변환.
//   - validate(instance, { whitelist: true, forbidNonWhitelisted: true }) 로
//     ValidationPipe 와 동일 옵션을 박제 → 정의되지 않은 필드 reject 도 cover.
//   - 실 controller-scope ValidationPipe 통합 검증은 AuthController spec 의
//     supertest integration 에서 별도 cover (R-112 합산).
import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";

import { LoginDto } from "./login.dto";

describe("LoginDto", () => {
  // helper — 동일 옵션의 ValidationPipe 와 동등한 검증을 1 라인으로 박제.
  // controller-scope ValidationPipe ({ whitelist: true, forbidNonWhitelisted: true,
  // transform: true }) 의 검증 표면과 1:1 정합.
  async function validateDto(plain: unknown): Promise<{ errorCount: number }> {
    const instance = plainToInstance(LoginDto, plain);
    const errors = await validate(instance as object, {
      whitelist: true,
      forbidNonWhitelisted: true,
    });
    return { errorCount: errors.length };
  }

  // ---- happy ----------------------------------------------------------
  it("정상 email + 정상 password 통과 (happy)", async () => {
    const { errorCount } = await validateDto({
      email: "hong@example.com",
      password: "p4ssw0rd",
    });
    expect(errorCount).toBe(0);
  });

  // ---- branch — RFC 형식 통과 분기 (다양한 normal email format) ----------
  it("subdomain email (`a@b.c.d`) 통과 (branch — multi-dot domain)", async () => {
    const { errorCount } = await validateDto({
      email: "user@mail.example.co.kr",
      password: "x",
    });
    expect(errorCount).toBe(0);
  });

  it("password 길이 1자도 통과 (branch — DTO 차원 길이 상한 미정의)", async () => {
    // 본 task 시점은 password 길이 / 복잡도 정책 미박제 — R-112 형식 backbone 만.
    // 길이 / 복잡도는 후속 task 책임 (task §C 박제).
    const { errorCount } = await validateDto({
      email: "a@b.com",
      password: "x",
    });
    expect(errorCount).toBe(0);
  });

  // ---- error / negative — empty / missing / invalid type / extra field --

  it("email 누락 시 reject (negative #1: missing required email)", async () => {
    const { errorCount } = await validateDto({ password: "x" });
    expect(errorCount).toBeGreaterThan(0);
  });

  it("password 누락 시 reject (negative #2: missing required password)", async () => {
    const { errorCount } = await validateDto({ email: "a@b.com" });
    expect(errorCount).toBeGreaterThan(0);
  });

  it("email + password 모두 누락 시 reject (negative #3: missing all)", async () => {
    const { errorCount } = await validateDto({});
    expect(errorCount).toBeGreaterThan(0);
  });

  it("email 이 빈 문자열 시 reject (negative #4: empty email)", async () => {
    const { errorCount } = await validateDto({ email: "", password: "x" });
    expect(errorCount).toBeGreaterThan(0);
  });

  it("password 가 빈 문자열 시 reject (negative #5: empty password)", async () => {
    const { errorCount } = await validateDto({
      email: "a@b.com",
      password: "",
    });
    expect(errorCount).toBeGreaterThan(0);
  });

  it("email 형식이 RFC 위반 (no @) 시 reject (negative #6: invalid email format)", async () => {
    const { errorCount } = await validateDto({
      email: "not-an-email",
      password: "x",
    });
    expect(errorCount).toBeGreaterThan(0);
  });

  it("email 형식이 RFC 위반 (domain 누락) 시 reject (negative #7: missing domain)", async () => {
    const { errorCount } = await validateDto({
      email: "user@",
      password: "x",
    });
    expect(errorCount).toBeGreaterThan(0);
  });

  it("email 이 number 시 reject (negative #8: wrong type — email)", async () => {
    const { errorCount } = await validateDto({ email: 12345, password: "x" });
    expect(errorCount).toBeGreaterThan(0);
  });

  it("password 가 number 시 reject (negative #9: wrong type — password)", async () => {
    const { errorCount } = await validateDto({
      email: "a@b.com",
      password: 12345,
    });
    expect(errorCount).toBeGreaterThan(0);
  });

  it("정의되지 않은 필드 (`foo`) 포함 시 reject (negative #10: extra unknown field, forbidNonWhitelisted)", async () => {
    const { errorCount } = await validateDto({
      email: "a@b.com",
      password: "x",
      foo: "bar",
    });
    expect(errorCount).toBeGreaterThan(0);
  });
});
