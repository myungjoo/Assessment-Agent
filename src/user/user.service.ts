// UserService — User 도메인 의 application service. T-0086 acceptance §A/B 박제.
// RBAC 첫 production 사용 사례 chain 의 service layer 진입점 — UserRepository
// (T-0080 / T-0085 / T-0092 의 5 메서드: create / findByEmail / findById /
// updateRole / countAll) 위에 REQ-044 의 5 invariant + signup 첫 user SuperAdmin
// 자동 지정 (REQ-044 후반) 도메인 의미를 부여한다.
//
// 책임 (T-0086 + T-0092 scope):
//   - changeRole(actorUserId, targetUserId, newRole) — README L84 REQ-044 박제 :
//     "Admin→User 변경은 첫 로긴 Admin (= SuperAdmin) 만 수행할 수 있고, 본인에 대해서는
//     Admin→User 를 할 수 없다". 5 invariant 모두 service-layer 책임 — UserRepository
//     는 string forwarding 만 한다.
//   - signup(email, plainPassword) — README L84 REQ-044 후반 박제: 첫 등록 user 의
//     role 을 SuperAdmin 으로 자동 지정 (countAll === 0 분기), 두 번째 이후는 default
//     User. password 는 AuthService.hashPassword (bcrypt 10 rounds, ADR-0008 §6) 로
//     hash 후 hashedPassword 컬럼에 저장. P2002 (email @unique 위반) → ConflictException
//     변환 (PartService.update P2002 분기 1:1 mirror).
//   - Prisma 의 known error code (P2025 = record not found / P2002 = unique constraint)
//     를 NestJS HttpException (NotFoundException / ConflictException) 으로 변환.
//     GroupService / PersonService 정공법 정합.
//
// 책임 경계 (Out of Scope — task §Out of Scope 박제):
//   - 첫 user 분기의 race window 강제 — DB advisory lock / `@@check` / unique constraint
//     on role="SuperAdmin" 등의 강제는 본 task 0. 현재는 service-layer count check
//     후 create 분기 — concurrent 2 signup 동시 첫 → 둘 다 SuperAdmin 가능. 별도 ADR
//     + task. signup() 의 race window 박제 (countAll → create 간 시간 차).
//   - User response shape 정제 (hashedPassword 제거) — 현재 signup 응답은 User row
//     그대로 (hashedPassword 컬럼 포함). 보안 risk 박제, 별도 task (UserResponseDto
//     또는 Prisma select projection).
//   - password 정책 강화 (복잡도 / blacklist / breach API check) — 본 service 는
//     hash 만, 정책은 DTO + 별도 task.
//   - Admin → SuperAdmin 승급 invariant — README L84 후반 "Admin 권한 사용자는 User→
//     Admin 승급" 분기는 본 service 의 invariant 1 (only SuperAdmin) 와 충돌, 별도
//     task / ADR 로 분리.
//   - AuthService.issueAccessToken role rotation 호출 — changeRole 후 자동 token
//     refresh 박제는 별도 task (refresh endpoint 와 동기).
//
// Prisma error 정책 (T-0086 + T-0092):
//   - changeRole: P2025 (race window — invariant 3 통과 후 target user 가 동시 삭제)
//     → NotFoundException 변환. 그 외 (P9999 / code 없는 generic Error / 의존성 fail)
//     → raw propagate. GroupService.delete / PartService.delete 패턴 mirror.
//   - signup: P2002 (email @unique 위반) → ConflictException 변환. 그 외 raw propagate.
//     AuthService.hashPassword 의 throw 도 raw propagate (catch 0).
import {
  BadRequestException,
  ConflictException,
  forwardRef,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import type { User } from "@prisma/client";

import { AuthService } from "../auth/auth.service";

import { UserRepository } from "./user.repository";

// User.role 컬럼 의 literal union type — schema.prisma 의 String 컬럼과 호환
// (TypeScript-level enum, DB-level 강제 0). 향후 schema enum 전환 시 본 type
// alias 가 Prisma enum 으로 교체될 예정 (별도 ADR 후보 — task §Out of Scope).
// 본 task 는 service-layer 의 invariant 2 (newRole 값 검증) 만 책임.
export type UserRole = "SuperAdmin" | "Admin" | "User";

// 허용된 role 값 set — invariant 2 의 검증 source. UserRole literal union 과
// 1:1 정합. const assertion 으로 type narrowing 가능.
const VALID_ROLES: readonly UserRole[] = [
  "SuperAdmin",
  "Admin",
  "User",
] as const;

// Prisma 의 error 식별 — `code` field 가 known request error 의 식별자.
// GroupService / PartService / PersonService 의 동일 helper 와 동일 duck typing
// 패턴 (T-0050 §Follow-ups phase 2 외화 candidate — 본 task 는 local helper 유지,
// 4 회차 중복 누적).
function getPrismaErrorCode(error: unknown): string | undefined {
  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof (error as { code: unknown }).code === "string"
  ) {
    return (error as { code: string }).code;
  }
  return undefined;
}

@Injectable()
export class UserService {
  constructor(
    private readonly userRepository: UserRepository,
    // AuthService inject — UserService.signup 의 password hash 위해. AuthModule ↔
    // UserModule circular dependency (T-0087 의 forwardRef 정공법 정합) — 양방향
    // @Inject(forwardRef()) 로 NestJS provider resolution lazy 처리.
    @Inject(forwardRef(() => AuthService))
    private readonly authService: AuthService,
  ) {}

  // changeRole — REQ-044 박제 (README L84). 5 invariant 책임 + UserRepository.updateRole
  // forwarding. race window (invariant 3 통과 후 target user 동시 삭제) 의 P2025 →
  // NotFoundException 변환은 invariant 5 의 try/catch 책임.
  //
  // invariant 순서 (early-return 정공법):
  //   1. actor 권한 검증 — actorUserId 의 user row 의 role === "SuperAdmin" 확인.
  //   2. newRole 값 enum 검증 — UserRole union 외 reject.
  //   3. target user lookup — targetUserId 의 user row 존재 확인.
  //   4. self-demote 차단 — actor === target && newRole !== "SuperAdmin" reject.
  //      (SuperAdmin 자기 self-noop 은 허용 — invariant 4 분기 false.)
  //   5. updateRole forwarding + P2025 → NotFoundException 변환.
  async changeRole(
    actorUserId: string,
    targetUserId: string,
    newRole: string,
  ): Promise<User> {
    // invariant 1 — actor 권한 검증. actor user 가 DB 에서 fetch 가능해야 하고,
    // role 이 SuperAdmin 이어야 한다. actor row 가 null 이면 (token 의 sub 가
    // 가리키는 user 가 race window 에서 삭제됨) UnauthorizedException — auth
    // 자체 실패로 간주. role 이 SuperAdmin 외이면 ForbiddenException — 권한 부족.
    const actor = await this.userRepository.findById(actorUserId);
    if (actor === null) {
      throw new UnauthorizedException("actor not found");
    }
    if (actor.role !== "SuperAdmin") {
      throw new ForbiddenException("only SuperAdmin can change user role");
    }

    // invariant 2 — newRole 값 enum 검증. UserRole literal union 외이면 reject.
    // "user" (소문자) / "Owner" / 빈 문자열 등 모두 reject.
    if (!VALID_ROLES.includes(newRole as UserRole)) {
      throw new BadRequestException(`invalid role: ${newRole}`);
    }

    // invariant 3 — target user lookup. target row null 시 NotFoundException
    // (HTTP 404 자동 mapping). race window 의 P2025 분기와 의미 동일 — pre-check 단계.
    const target = await this.userRepository.findById(targetUserId);
    if (target === null) {
      throw new NotFoundException(`user not found: ${targetUserId}`);
    }

    // invariant 4 — self-demote 차단. README L84 박제 — "본인에 대해서는 Admin→User
    // 를 할 수 없다". 본 system 은 강한 invariant 로 박제 — actor === target 일 때
    // newRole 이 SuperAdmin 외이면 무조건 reject (Admin / User 모두). SuperAdmin
    // self-noop (자기 role 을 SuperAdmin 으로 재지정) 은 허용 — 분기 false.
    if (actorUserId === targetUserId && newRole !== "SuperAdmin") {
      throw new ForbiddenException("self-demote is not allowed");
    }

    // invariant 5 — updateRole forwarding + P2025 race window 변환.
    // UserRepository.updateRole 가 P2025 (record not found) throw 하는 경우는
    // invariant 3 통과 후 target user 가 동시 삭제된 race window. NotFoundException
    // 으로 변환 — invariant 3 의 의미와 정합. 그 외 (generic Error / unknown code)
    // 는 raw propagate.
    try {
      return await this.userRepository.updateRole(targetUserId, newRole);
    } catch (error) {
      if (getPrismaErrorCode(error) === "P2025") {
        throw new NotFoundException(`user not found: ${targetUserId}`);
      }
      throw error;
    }
  }

  // findById — 본 task (T-0101) 추가. UserController.detail (GET /api/users/:id)
  // 의 service layer 진입점. UserRepository.findById (T-0085 박제) 의 raw forward
  // 위에 not-found 분기 (null → NotFoundException) 만 추가. UserService.changeRole
  // 의 invariant 3 `target` not-found 분기 (L136-140 `if (target === null) throw
  // new NotFoundException(...)`) 정공법 1:1 mirror.
  //
  // 책임 분리 — controller layer (UserController.detail) 가 self OR Admin+ 분기 +
  // UserResponseDto.fromEntity 변환을 책임. 본 service 는 도메인 entity (User row)
  // 그대로 반환 — clean separation 정공법 정합 (findAll / changeRole / signup 패턴
  // 1:1 mirror). DTO 변환 책임 0.
  //
  // 도메인 invariant 0 — 단순 조회 path. RBAC tier 결정 (self OR Admin+) 은 controller
  // layer 책임, 본 service 는 권한 분기 0. id 인자의 형식 (cuid / uuid / etc.)
  // 검증도 controller / DTO layer 책임, 본 service 는 string forward.
  //
  // Prisma error 정책: findUnique 의 row 부재는 throw 0 / null 반환 — repository 의
  // null-safe API 정합. service layer 는 그 null 을 NotFoundException 으로 변환 (HTTP
  // 404 NestJS 자동 mapping). 그 외 (DB connection fail / outage 등의 generic Error)
  // 는 raw propagate (catch 0). NestJS default 500 자동 mapping.
  async findById(id: string): Promise<User> {
    // repository 의 raw forward — row 부재 시 null 반환 (null-safe API). 본 service
    // 는 null 분기를 NotFoundException 으로 변환 — changeRole `target` not-found
    // 패턴 1:1 mirror.
    const user = await this.userRepository.findById(id);
    if (user === null) {
      throw new NotFoundException(`User ${id} 가 존재하지 않습니다.`);
    }
    return user;
  }

  // findAll — 본 task (T-0099) 추가. UserController.list 의 raw forward 책임.
  // GET /api/users list endpoint (Admin+ tier) 의 service layer 진입점. GroupService.findAll
  // (L101-106) 1:1 mirror — UserRepository.findAll forwarding 만.
  //
  // 도메인 invariant 0 — 단순 조회 path. RBAC tier 결정 (Admin+) 은 controller layer
  // 의 @Roles decorator 책임, 본 service 는 권한 분기 0.
  //
  // DTO 변환 책임 0 — controller layer (UserController.list) 가 UserResponseDto.fromEntities
  // 변환을 단일 책임. clean separation 정공법 정합 (changeRole / signup 의 controller
  // 측 DTO wrap 패턴 1:1 mirror).
  //
  // Prisma error 정책: findMany 는 known error code 0 — DB connection fail / outage
  // 등의 generic Error 만 raw propagate (catch 0). NestJS default 500 자동 mapping.
  //
  // pagination / sorting / filtering 미지원 — repository 의 raw findMany 정공법 정합.
  // query parameter 정합은 별도 task / ADR.
  async findAll(): Promise<User[]> {
    return this.userRepository.findAll();
  }

  // signup — REQ-044 후반 박제 (README L84 "SuperAdmin (첫 로긴), Admin, User 3 등급").
  // 첫 등록 user 의 role 을 SuperAdmin 자동 지정 + email @unique (P2002) → 409 변환 +
  // bcrypt 10 rounds password hash (ADR-0008 §6 정합). UserController.signup 의
  // POST /api/users endpoint 진입점 — Public tier (인증 없는 첫 user 진입 path 필수).
  //
  // invariant 순서 (early-return 정공법, changeRole 패턴 1:1 mirror):
  //   1. 첫 user 분기 검증 — UserRepository.countAll() 호출. count === 0 → role
  //      "SuperAdmin", count > 0 → role "User". race window 박제 (Out of Scope):
  //      countAll → create 사이에 다른 signup 동시 진행 시 둘 다 첫 user 분기 진입
  //      가능 → 둘 다 SuperAdmin 가능 (schema-level 강제 0). 별도 ADR 후속 — DB
  //      advisory lock / unique partial index on role="SuperAdmin" 등.
  //   2. password hash — AuthService.hashPassword(plainPassword) 호출. bcrypt 10
  //      rounds (ADR-0008 §6). DB 의 hashedPassword 컬럼 source. hashPassword throw
  //      는 raw propagate (catch 0, AuthService 의 책임 분리).
  //   3. UserRepository.create forwarding — { email, hashedPassword, role } 인자.
  //      P2002 (User.email @unique 위반) → ConflictException 변환. 그 외 raw
  //      propagate (P9999 / generic Error / DB outage 등). PartService.update 의
  //      P2002 분기 1:1 mirror (T-0071 precedent).
  //
  // 호출자 책임 (Out of Scope, controller layer):
  //   - email / password 의 형식 검증 (RFC 5322 / MinLength 8) → AddUserDto + DTO
  //     ValidationPipe 가 controller 진입 전 reject (400 자동). 본 service 는 빈
  //     email / 빈 password 도 raw forward (DTO 우회 시 DB 의 unique constraint /
  //     hashedPassword not-null 이 fallback).
  //   - role 외부 지정 우회 차단 → AddUserDto 의 forbidNonWhitelisted 가 controller
  //     진입 전 reject. 본 service 는 role 인자 0 — 자동 분기.
  async signup(email: string, plainPassword: string): Promise<User> {
    // invariant 1 — 첫 user 분기 검증. count === 0 일 때 SuperAdmin, 외 User.
    // race window 박제: countAll → create 사이 시간 차 — 별도 ADR 후속.
    const existingCount = await this.userRepository.countAll();
    const role = existingCount === 0 ? "SuperAdmin" : "User";

    // invariant 2 — password hash (bcrypt 10 rounds). throw 는 raw propagate.
    const hashedPassword = await this.authService.hashPassword(plainPassword);

    // invariant 3 — create forwarding + P2002 → ConflictException 변환.
    try {
      return await this.userRepository.create({
        email,
        hashedPassword,
        role,
      });
    } catch (error) {
      if (getPrismaErrorCode(error) === "P2002") {
        throw new ConflictException(`email already exists: ${email}`);
      }
      throw error;
    }
  }
}
