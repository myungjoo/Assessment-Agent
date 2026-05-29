// UserResponseDto spec — T-0095 acceptance §B 박제 (R-112 4 카테고리: happy / branch /
// negative — error 분기는 본 DTO 의 책임 0 라 생략, fromEntity 는 throw 0 인 단순
// projection). ChangeRoleDto / AddUserDto colocated spec 1:1 mirror.
//
// 본 spec 의 책임:
//   - **happy** — fromEntity 가 User row 의 5 컬럼을 정확히 picking 하는지 (id /
//     email / role / createdAt / updatedAt).
//   - **happy** — hashedPassword 컬럼이 결과 DTO 에 부재 (whitelist 정공법) — 본
//     task 의 핵심 보안 invariant.
//   - **happy** — Date 객체가 string 변환 없이 그대로 보존 (DTO instance 의 toJSON
//     호출 시점에 ISO string 으로 변환 — Express 표준).
//   - **branch** — role 3 종 (SuperAdmin / Admin / User) 모두 통과.
//   - **negative** — User row 에 임의 추가 컬럼 (`extraField`) 박제 시 결과 DTO 에
//     해당 컬럼 부재 (whitelist 정합).
//   - **negative** — partial entity (id 만 있는 row) → fromEntity 는 throw 0,
//     단순 undefined propagate (호출자 책임 분리).
//
// User row mock 의 hashedPassword 는 의도적으로 bcrypt-shape ($2b$10$...) 으로
// 박제 — 실 production 의 hashedPassword 컬럼 직렬화 패턴과 정합 + 결과 DTO 의 본
// 컬럼 부재 검증의 명확성 보존.
import type { User } from "@prisma/client";

import { UserResponseDto } from "./user-response.dto";

// User fixture helper — user.controller.spec / user.service.spec 의 buildUserFixture
// 1:1 mirror. overrides 로 branch 분기 별 fixture 생성.
function buildUserFixture(overrides: Partial<User> = {}): User {
  return {
    id: "user-default",
    email: "user@example.com",
    hashedPassword: "$2b$10$ABCDEF1234567890ABCDEF.GH",
    role: "User",
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-02T00:00:00.000Z"),
    ...overrides,
  };
}

describe("UserResponseDto.fromEntity", () => {
  // -----------------------------------------------------------------------
  // happy — 5 필드 정확 picking
  // -----------------------------------------------------------------------
  it("happy — User row 의 5 필드 (id/email/role/createdAt/updatedAt) 정확히 매핑", () => {
    const user = buildUserFixture({
      id: "uid-1",
      email: "alice@example.com",
      role: "Admin",
      createdAt: new Date("2026-05-01T00:00:00.000Z"),
      updatedAt: new Date("2026-05-02T00:00:00.000Z"),
    });

    const dto = UserResponseDto.fromEntity(user);

    expect(dto.id).toBe("uid-1");
    expect(dto.email).toBe("alice@example.com");
    expect(dto.role).toBe("Admin");
    expect(dto.createdAt).toEqual(new Date("2026-05-01T00:00:00.000Z"));
    expect(dto.updatedAt).toEqual(new Date("2026-05-02T00:00:00.000Z"));
  });

  // -----------------------------------------------------------------------
  // happy — hashedPassword 제외 검증 (본 task 의 핵심 보안 invariant)
  // -----------------------------------------------------------------------
  it("happy — hashedPassword 컬럼이 결과 DTO 에 부재 (whitelist 정공법, T-0095 핵심)", () => {
    const user = buildUserFixture({
      hashedPassword: "$2b$10$SECRETPASSWORDHASH1234567890",
    });

    const dto = UserResponseDto.fromEntity(user);

    // 본 task 의 핵심 검증 — DTO 에 hashedPassword 키 부재.
    expect(dto).not.toHaveProperty("hashedPassword");

    // Object.keys 로도 직접 확인 — 직렬화 path 의 정합.
    expect(Object.keys(dto)).not.toContain("hashedPassword");

    // 정확히 5 필드 (id/email/role/createdAt/updatedAt) 만 노출 박제.
    expect(Object.keys(dto).sort()).toEqual(
      ["createdAt", "email", "id", "role", "updatedAt"].sort(),
    );
  });

  // -----------------------------------------------------------------------
  // happy — Date 객체 보존 (string 변환 0)
  // -----------------------------------------------------------------------
  it("happy — createdAt/updatedAt 이 Date instance 그대로 (string 변환 0)", () => {
    const created = new Date("2026-03-01T12:34:56.789Z");
    const updated = new Date("2026-03-02T12:34:56.789Z");
    const user = buildUserFixture({ createdAt: created, updatedAt: updated });

    const dto = UserResponseDto.fromEntity(user);

    // Date instance 보존 — Express 의 toJSON 호출 시점에 ISO string 변환 (HTTP
    // 직렬화 표준). DTO 자체는 Date 객체 유지.
    expect(dto.createdAt).toBeInstanceOf(Date);
    expect(dto.updatedAt).toBeInstanceOf(Date);
    expect(dto.createdAt.toISOString()).toBe("2026-03-01T12:34:56.789Z");
    expect(dto.updatedAt.toISOString()).toBe("2026-03-02T12:34:56.789Z");
  });

  // -----------------------------------------------------------------------
  // branch — role 3 종 분기 (SuperAdmin / Admin / User)
  // -----------------------------------------------------------------------
  it("branch — role='SuperAdmin' 박제 시 DTO.role === 'SuperAdmin'", () => {
    const dto = UserResponseDto.fromEntity(
      buildUserFixture({ role: "SuperAdmin" }),
    );
    expect(dto.role).toBe("SuperAdmin");
  });

  it("branch — role='Admin' 박제 시 DTO.role === 'Admin'", () => {
    const dto = UserResponseDto.fromEntity(buildUserFixture({ role: "Admin" }));
    expect(dto.role).toBe("Admin");
  });

  it("branch — role='User' 박제 시 DTO.role === 'User'", () => {
    const dto = UserResponseDto.fromEntity(buildUserFixture({ role: "User" }));
    expect(dto.role).toBe("User");
  });

  // -----------------------------------------------------------------------
  // negative — extra 필드 추가 컬럼 미반영 (whitelist 정합)
  // -----------------------------------------------------------------------
  it("negative — User row 에 임의 추가 컬럼 박제 시 결과 DTO 에 해당 컬럼 부재", () => {
    // User type 우회를 위해 cast — production code 에서는 발생 0 이지만 future
    // schema migration 으로 새 컬럼 추가 시 자동 차단 invariant 검증.
    const userWithExtra = {
      ...buildUserFixture(),
      extraField: "should-not-leak",
      anotherSecret: "also-should-not-leak",
    } as unknown as User;

    const dto = UserResponseDto.fromEntity(userWithExtra);

    expect(dto).not.toHaveProperty("extraField");
    expect(dto).not.toHaveProperty("anotherSecret");
    // 여전히 정확히 5 필드만.
    expect(Object.keys(dto).sort()).toEqual(
      ["createdAt", "email", "id", "role", "updatedAt"].sort(),
    );
  });

  // -----------------------------------------------------------------------
  // negative — partial entity 보호 (id 만 있는 row → throw 0, undefined propagate)
  // -----------------------------------------------------------------------
  it("negative — partial entity (id 만 있음) → throw 0 + 누락 필드 undefined propagate", () => {
    // TypeScript type narrowing 우회 — 실 production 에서 발생 0 이지만 fromEntity
    // 가 단순 projection (validation 0) 라는 책임 경계 검증.
    const partial = { id: "only-id" } as unknown as User;

    expect(() => UserResponseDto.fromEntity(partial)).not.toThrow();

    const dto = UserResponseDto.fromEntity(partial);
    expect(dto.id).toBe("only-id");
    expect(dto.email).toBeUndefined();
    expect(dto.role).toBeUndefined();
    expect(dto.createdAt).toBeUndefined();
    expect(dto.updatedAt).toBeUndefined();
  });

  // -----------------------------------------------------------------------
  // negative — fromEntity 호출 후 원본 user 객체 mutation 0 (immutability 정합)
  // -----------------------------------------------------------------------
  it("negative — fromEntity 호출 후 원본 user 객체 mutation 0", () => {
    const original = buildUserFixture({
      id: "orig-id",
      hashedPassword: "$2b$10$ORIGINAL.HASH.PRESERVED",
    });
    const snapshot = { ...original };

    UserResponseDto.fromEntity(original);

    // 원본 객체의 모든 키 / 값 보존 — fromEntity 가 source-mutating 0.
    expect(original).toEqual(snapshot);
    expect(original.hashedPassword).toBe("$2b$10$ORIGINAL.HASH.PRESERVED");
  });
});
