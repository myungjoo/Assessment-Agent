// UserResponseDto — `User` entity 의 안전한 HTTP 응답 shape 박제 DTO. T-0095 acceptance
// §A 박제. T-0092 (POST /api/users signup MERGED f97329b PR-87) + T-0087 (PATCH
// /api/users/:id/role MERGED fabeb40 PR-82) 두 endpoint 가 그동안 Prisma User row
// 전체 (hashedPassword 컬럼 포함) 를 HTTP 응답 body 로 그대로 직렬화하던 **active
// 보안 risk** 의 application-layer fix.
//
// 책임:
//   - User entity 의 6 컬럼 (id / email / hashedPassword / role / createdAt /
//     updatedAt) 중 **hashedPassword 를 제외한 5 컬럼만** HTTP 응답에 노출. bcrypt
//     10 rounds 라 rainbow table 비용은 높지만 hashedPassword 가 응답으로 흘러나가면
//     offline brute-force / GPU cracking 의 attack surface 가 공개됨 — 본 DTO 가
//     그 attack surface 를 0 으로 만든다.
//   - `UserResponseDto.fromEntity(user: User): UserResponseDto` static factory 가
//     User row → DTO 변환의 단일 경로 박제. 매번 controller 가 손으로 5 컬럼을
//     copy 하지 않도록 일반화 + whitelist 정합.
//
// 책임 경계 (Out of Scope, task §Out of Scope 박제):
//   - 도메인 invariant 0 / ValidationPipe 0 — 본 DTO 는 **응답 전용** (request DTO 가
//     아님). class-validator decorator 부재. ChangeRoleDto / AddUserDto 와의 본질적
//     차이 — 본 DTO 는 외부 입력 검증이 아닌 내부 entity 직렬화 책임.
//   - `fromEntities(users: User[]): UserResponseDto[]` 배열 helper 부재 — GET
//     /api/users list endpoint 박제 시점에 도입 (별도 task). 본 task 는 단일 entity
//     변환만.
//   - NestJS `@SerializeOptions` / `ClassSerializerInterceptor` 도입 부재 — 전역
//     직렬화 전략은 별도 ADR. 본 task 는 단순 static factory 만 박제 (다른 entity
//     동일 패턴 출현 시 일반화 추출).
//   - lastLoginAt / passwordChangedAt 등 추가 필드 부재 — schema 변경 필요 + ADR
//     동반. 별도 task.
//   - other entity (Person / Group / Part) 의 ResponseDto 추출 부재 — Person /
//     Group / Part 는 hashedPassword 같은 민감 컬럼 0 이라 entity 그대로 반환해도
//     risk 0. 일반화 추출은 2+ entity 동일 패턴 출현 시점.
//
// ADR-0008 §6 정합:
//   - DB-level 은 hashedPassword 컬럼 (bcrypt 10 rounds) 으로 password 보호 — schema
//     차원 정공법.
//   - HTTP-layer 노출 차단 은 별도 layer 책임 — 본 DTO 가 그 layer 박제.
//   - ADR-0008 §6 의 "User entity password 컬럼" 의 application-layer 책임 완결.
//
// REQ-043 / REQ-044 정합:
//   - README L83-84: "모든 사용 기능은 보안사항으로서 ID 와 Password 로 보호" — password
//     자체의 안전한 처리는 보호 의무 의 핵심. 본 DTO 가 그 핵심 의무 박제.
//
// 정공법 — clean separation:
//   - Service layer (UserService.signup / changeRole) 는 도메인 entity (User row) 를
//     그대로 반환 — 도메인 invariant 검증과 DB persistence 만 책임.
//   - Controller layer (UserController.signup / changeRole) 가 본 DTO 의 fromEntity
//     로 응답 변환 — HTTP boundary 의 단일 책임.
//   - 이 layering 이 깨지면 (service 가 DTO 반환) test 가 어렵고 service 재사용성이
//     떨어진다 — 본 DTO 는 controller 만의 책임.
import type { User } from "@prisma/client";

export class UserResponseDto {
  // id — User row 의 primary key. cuid 형식 (Prisma @default(cuid())).
  readonly id: string;

  // email — User row 의 unique email. signup 시 ValidationPipe + @IsEmail 검증 통과.
  readonly email: string;

  // role — User role literal union ("SuperAdmin" / "Admin" / "User"). UserService
  // 의 invariant 2 + ChangeRoleDto.@IsIn 박제 정합.
  readonly role: string;

  // createdAt — User row 생성 시각. Prisma @default(now()).
  readonly createdAt: Date;

  // updatedAt — User row 마지막 갱신 시각. Prisma @updatedAt.
  readonly updatedAt: Date;

  // private constructor — 외부에서 `new UserResponseDto(...)` 직접 호출 차단. 본 DTO
  // 의 단일 진입점은 `fromEntity` static factory. 새 필드 추가 시 fromEntity 한 곳만
  // 수정하면 전체 entry point 자동 정합 — drift 차단.
  private constructor(
    id: string,
    email: string,
    role: string,
    createdAt: Date,
    updatedAt: Date,
  ) {
    this.id = id;
    this.email = email;
    this.role = role;
    this.createdAt = createdAt;
    this.updatedAt = updatedAt;
  }

  // fromEntity — User row → UserResponseDto 변환의 단일 경로. hashedPassword 는 본
  // 메서드의 destructure 에서 명시적 제외 (whitelist 정합) — 임의 추가 컬럼 (예:
  // 향후 schema migration 으로 새 필드 추가 시) 도 자동 차단. 호출자는 service 의
  // 반환값을 그대로 본 메서드에 넘기면 됨.
  //
  // partial entity 보호: user 가 일부 필드만 가지는 경우 (TypeScript type narrowing
  // 우회) DTO 의 해당 필드는 undefined 로 propagate. throw 0 — 단순 통과. 호출자
  // 책임 (controller layer 는 service 반환의 type 정합 보장).
  static fromEntity(user: User): UserResponseDto {
    return new UserResponseDto(
      user.id,
      user.email,
      user.role,
      user.createdAt,
      user.updatedAt,
    );
  }
}
