// UserController — `/api/users` HTTP-facing layer. T-0087 + T-0092 acceptance 박제.
//
// 책임 (T-0087 + T-0092 scope):
//   - PATCH /api/users/:id/role — user role 변경 endpoint. RBAC backbone (JwtAuthGuard +
//     RolesGuard + @Roles("SuperAdmin")) 의 **첫 production 적용 endpoint**. T-0083
//     이 박제한 4 surface (JwtAuthGuard / JwtStrategy / @Roles / RolesGuard) 의 첫
//     사용 사례. UserService.changeRole (T-0086) 의 5 invariant 를 HTTP 표면에 노출.
//   - POST /api/users — signup endpoint. T-0092 acceptance §F 박제. **Public tier
//     (인증 없는 첫 user 진입 path 필수)** — 첫 등록 user 의 role = "SuperAdmin"
//     자동 지정 (REQ-044 후반), 두 번째 이후는 default "User". UserService.signup 의
//     3 invariant (countAll 분기 / bcrypt hash / P2002 → 409 변환) 를 HTTP 표면에 노출.
//     RBAC 강화 (Admin+ tier 격상) 는 별도 ADR — 첫 user 진입 path 가 분리될 시점.
//
// 응답 정책 (T-0095 박제 — T-0092 의 active 보안 risk fix):
//   - POST /api/users / PATCH /api/users/:id/role 두 endpoint 모두 응답 body 는
//     **UserResponseDto** (id / email / role / createdAt / updatedAt 5 필드). User
//     entity 의 hashedPassword 컬럼은 응답에서 **제외** — bcrypt 10 rounds 라
//     rainbow table 공격 비용은 높지만 hashedPassword 가 HTTP 응답으로 흘러나가면
//     offline brute-force / GPU cracking 의 attack surface 가 공개됨, T-0095 가
//     그 surface 를 0 으로 만든다.
//   - service-layer 의 `UserService.signup` / `UserService.changeRole` 은 도메인
//     entity (User row) 를 그대로 반환 — 도메인 invariant 검증과 DB persistence 만
//     책임. 응답 DTO 변환은 controller 의 단일 책임 (clean separation 정공법).
//   - UserResponseDto.fromEntity(serviceResult) 가 변환의 단일 경로 — 임의 신규
//     컬럼 (schema migration) 도 whitelist 정합으로 자동 차단.
//   - 201 Created status (@HttpCode(201) for POST) — Public 첫 user 진입 path 의
//     직관 정합. PATCH 는 NestJS default 200.
//   - ADR-0008 §6 정합 — DB-level 은 hashedPassword 컬럼 (bcrypt) + HTTP-layer 는
//     본 DTO 차단. password 보호 layering 2 단계 모두 박제.
//
// 책임 경계 (Out of Scope — task §Out of Scope 박제):
//   - 첫 user 분기의 race window 강제 — 별도 ADR (DB advisory lock / unique partial
//     index on role="SuperAdmin").
//   - POST /api/users 의 RBAC 강화 (Admin+ tier 격상) — 첫 user 등록 후 본 endpoint
//     를 Admin+ 격상 또는 분리 endpoint (`POST /api/auth/setup`) 로 분리. 별도 ADR.
//   - PATCH /api/users/:id/password endpoint 부재 — api.md L72 박제, 별도 task.
//   - GET /api/users / GET /api/users/:id endpoint 부재 — read-only path, RBAC tier
//     검토 후 별도.
//   - Admin 의 User→Admin 승급 분기 부재 — README L84 후반. 별도 service / endpoint
//     또는 service 분기 확장 ADR.
//   - api.md §5 의 PATCH /api/users/:id/role row amend — T-0088 MERGED. POST
//     /api/users row amend 는 T-0093 candidate (doc-only direct).
//   - CurrentUser decorator (`@CurrentUser() actor: JwtPayload`) 부재 — 2+ controller
//     의 동일 패턴 출현 시 추출 (별도 task).
//   - immediate role rotation (changeRole 후 access token 즉시 refresh) 부재 — cookie
//     의 token 은 다음 refresh 시점 (7day TTL 내) 에 새 role propagate. 별도 task.
//   - email 검증 (verification mail) / password 정책 강화 / rate limiting / brute-force
//     차단 — 별도 task / ADR.
//
// RBAC actor user id propagate path (T-0083 JwtStrategy.validate 박제 → 본 controller):
//   1. client → HttpOnly cookie access_token (JWT, payload = { sub, role, iat, exp }).
//   2. cookie-parser middleware (src/main.ts) → req.cookies[access_token] 박제.
//   3. JwtAuthGuard → JwtStrategy.cookieExtractor → JwtService.verify → JwtStrategy.validate.
//   4. JwtStrategy.validate(payload) → req.user = payload (sub + role) 박제.
//   5. RolesGuard → request.user.role 의 escalation 매핑 (SuperAdmin 만 통과).
//   6. 본 controller → (req.user as { sub: string }).sub → UserService.changeRole 의 첫 인자.
//
// ValidationPipe wire (PersonController / GroupController / AuthController 1:1 mirror):
//   - controller-scope @UsePipes(ValidationPipe).
//   - whitelist: 정의되지 않은 필드 제거.
//   - forbidNonWhitelisted: 정의되지 않은 필드 포함 시 400.
//   - transform: plain JSON 을 DTO instance 로 변환.
//
// service throw propagation 정책 (NestJS 자동 HTTP mapping):
//   - UnauthorizedException → 401 (actor 부재 — token 의 sub 가 가리키는 user race window 삭제).
//   - ForbiddenException → 403 (actor !== SuperAdmin / self-demote 차단).
//   - BadRequestException → 400 (invariant 2 enum 외 — DTO 통과 후 race / 우회 시).
//   - NotFoundException → 404 (target 부재 또는 race window P2025 변환).
//   - 그 외 raw Error → NestJS default 500 처리.
import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from "@nestjs/common";
import type { User } from "@prisma/client";

import type { JwtPayload } from "../auth/auth.service";
import { CurrentUser } from "../auth/current-user.decorator";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { Roles } from "../auth/roles.decorator";
import { RolesGuard } from "../auth/roles.guard";

import { AddUserDto } from "./dto/add-user.dto";
import { ChangeRoleDto } from "./dto/change-role.dto";
import { UserResponseDto } from "./dto/user-response.dto";
import { UserService } from "./user.service";

@Controller("api/users")
@UsePipes(
  new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  }),
)
export class UserController {
  constructor(private readonly userService: UserService) {}

  // PATCH /api/users/:id/role — user role 변경. RBAC 첫 production 적용 endpoint.
  //   - @UseGuards(JwtAuthGuard, RolesGuard) — stacked 순서: JwtAuthGuard 가 인증 먼저
  //     (cookie → JWT verify → req.user 박제), RolesGuard 가 권한 검증 (req.user.role
  //     이 SuperAdmin escalation 매핑 안에 있는지).
  //   - @Roles("SuperAdmin") — REQ-044 의 Admin→User 변경 권한 박제. escalation 매핑상
  //     SuperAdmin 만 통과 (RolesGuard 의 ROLE_HIERARCHY["SuperAdmin"] = ["SuperAdmin"]).
  //   - body 의 dto.role 검증은 ValidationPipe + ChangeRoleDto 의 @IsString + @IsNotEmpty
  //     + @IsIn(VALID_ROLE_VALUES) 4 decorator 가 controller 진입 전 reject (400 자동).
  //   - actor user id 는 req.user.sub 에서 추출 — JwtStrategy.validate 가 payload 의
  //     sub claim 을 req.user 에 박제 (T-0083). type narrowing 으로 string 확정.
  //   - service.changeRole(actorUserId, targetUserId, newRole) 호출 — service layer 의
  //     5 invariant (actor 권한 / newRole enum / target lookup / self-demote / race window)
  //     가 도메인 검증. service throw 는 NestJS 가 status 자동 mapping.
  @Patch(":id/role")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("SuperAdmin")
  async changeRole(
    @Param("id") id: string,
    @Body() dto: ChangeRoleDto,
    @CurrentUser("sub") actorUserId: string,
  ): Promise<UserResponseDto> {
    // actorUserId 는 @CurrentUser("sub") param decorator 가 직접 JwtPayload.sub 으로
    // 박제 — T-0125 refactor 박제 (이전: `(req.user as { sub: string }).sub` cast).
    // service-layer 는 도메인 entity (User row) 반환 — DTO 변환은 controller layer
    // 단일 책임. T-0095 박제 — hashedPassword 컬럼은 본 변환에서 자동 제외.
    const updated: User = await this.userService.changeRole(
      actorUserId,
      id,
      dto.role,
    );
    return UserResponseDto.fromEntity(updated);
  }

  // POST /api/users — signup endpoint. REQ-044 후반 박제 (첫 등록 user SuperAdmin
  // 자동 지정). T-0092 acceptance §F.
  //   - guard 없음 — Public tier (인증 없는 첫 user 진입 path 필수). 향후 첫 user
  //     등록 후 본 endpoint 를 Admin+ 격상 또는 분리 endpoint 으로 분리 검토는 별도
  //     ADR (Out of Scope).
  //   - @HttpCode(201) — Created. POST 의 default 인 201 명시 박제 (NestJS 의 POST
  //     default 가 201 이지만 명시 박제로 status contract 외화).
  //   - body 의 dto.email + dto.password 검증은 ValidationPipe + AddUserDto 의 @IsEmail
  //     + @IsString + @IsNotEmpty + @MinLength(8) decorator + forbidNonWhitelisted
  //     (role 우회 차단) 가 controller 진입 전 reject (400 자동).
  //   - service.signup(dto.email, dto.password) 호출 — service layer 의 3 invariant
  //     (countAll 분기 / bcrypt hash / P2002 → 409 변환) 가 도메인 검증. service throw
  //     는 NestJS 가 status 자동 mapping (ConflictException → 409, 그 외 500).
  //   - 응답은 UserResponseDto (T-0095 박제) — id / email / role / createdAt /
  //     updatedAt 5 필드만 노출, hashedPassword 컬럼은 fromEntity 가 자동 제외.
  //     T-0092 의 active 보안 risk fix 완결.
  @Post()
  @HttpCode(201)
  async signup(@Body() dto: AddUserDto): Promise<UserResponseDto> {
    // service-layer 는 도메인 entity (User row) 반환 — DTO 변환은 controller layer
    // 단일 책임. T-0095 박제 — hashedPassword 컬럼은 본 변환에서 자동 제외.
    const created: User = await this.userService.signup(
      dto.email,
      dto.password,
    );
    return UserResponseDto.fromEntity(created);
  }

  // GET /api/users — 전체 user 목록 조회. T-0099 acceptance §G 박제. RBAC backbone 의
  // **두 번째 production 적용 endpoint** — T-0087 (PATCH /api/users/:id/role, SuperAdmin
  // 단일) 이후 첫 **Admin+ tier** 적용.
  //
  // RBAC 박제 — Admin+ tier (Admin / SuperAdmin 만 통과):
  //   - @UseGuards(JwtAuthGuard, RolesGuard) — stacked 순서: JwtAuthGuard 가 인증 먼저
  //     (cookie → JWT verify → req.user 박제), RolesGuard 가 권한 검증.
  //   - @Roles("Admin") — Admin tier 박제. RolesGuard 의 ROLE_HIERARCHY 의
  //     `Admin: ["Admin", "SuperAdmin"]` 매핑 → Admin literal 통과 + SuperAdmin
  //     escalation 자동 통과. User actor 는 403 (어느 escalation 목록에도 미포함).
  //   - RBAC backbone 의 escalation hierarchy descent (Admin 명시 시 SuperAdmin actor
  //     자동 통과) 의 첫 production 활용. T-0087 은 SuperAdmin literal match 만, 본
  //     endpoint 는 escalation 분기까지 검증 박제 (e2e 의 happy SuperAdmin actor).
  //
  // Admin+ tier 박제 근거 (task §Why 박제):
  //   - User list 는 privileged data — email / role / 등록 시각 5 컬럼 모두 administrative
  //     view. 일반 User actor 가 다른 user 목록 조회의 정상 use case 0.
  //   - api.md L33-35 RBAC tier table — Admin = "관리자: 평가 master data / 사용자·
  //     시스템 설정" — User 관리 = Admin 의 정공법.
  //
  // 응답 매핑 — UserResponseDto.fromEntities (T-0099 §A 박제):
  //   - service-layer 는 도메인 entity (User row 배열) 반환 — DTO 변환은 controller
  //     layer 단일 책임. T-0095 의 fromEntity whitelist 가 array map 에서도 정합
  //     propagate — hashedPassword 컬럼 모든 element 에서 자동 제외 (보안 invariant
  //     auto-propagate).
  //   - 빈 list 분기 (seed 0 — production 발생 0 이지만 invariant 보호): service 가
  //     [] 반환 → fromEntities([]) → [] 응답. throw 0 / 분기 0.
  //
  // Out of Scope (task §Out of Scope 박제):
  //   - pagination (page/pageSize) / sorting (orderBy) / filtering (role/email) query
  //     param — REST 표준 query parameter, 별도 task / ADR.
  //   - 응답 envelope (`{ data: [...], meta }`) 표준화 — pagination 도입 시점 동기.
  //   - GET /api/users/:id (single user detail) — read-detail 표면 0, 별도 task.
  //   - actor self-info 분기 (User actor 가 본인 데이터만 조회) — fine-grained access
  //     control, 별도 ADR.
  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("Admin")
  async list(): Promise<UserResponseDto[]> {
    // service-layer 의 raw forward — repository.findAll 결과 그대로 통과. controller
    // 의 단일 책임은 DTO 변환 (fromEntities) + HTTP 직렬화.
    const users: User[] = await this.userService.findAll();
    return UserResponseDto.fromEntities(users);
  }

  // GET /api/users/:id — single user detail 조회. T-0101 acceptance §C 박제. RBAC
  // backbone 의 **첫 conditional branch 박제** — T-0087 (PATCH role, SuperAdmin
  // literal) 과 T-0099 (GET list, Admin+ escalation hierarchy descent) 이후 본
  // endpoint 가 **self OR Admin+** 의 OR 분기를 처음 production 에 박제.
  //
  // RBAC tier 결정 — self OR Admin+ (task §Why 박제):
  //   - REQ-046 User read-only 박제 — User tier 가 본인 데이터 조회 가능해야 자연
  //     (login 후 자기 프로필 확인 등 일반적 use case). Admin+ tier 만 강제 시 User
  //     본인 조회 0 → REQ-046 형해화.
  //   - Admin+ tier other-read — 다른 user 조회는 administrative concern (REQ-043
  //     User CRUD 의 read-detail 책임). T-0099 의 list 패턴 정합.
  //
  // RolesGuard 미적용 정책 — Guard 는 인증만 강제, role 분기는 controller 내부:
  //   - decorator stack 은 @UseGuards(JwtAuthGuard) 만 — RolesGuard 미적용. @Roles
  //     decorator 의 literal match 는 OR 분기 (self OR role) 표현 불가 — controller
  //     layer 가 application logic 으로 분기 책임.
  //   - 대안 — RolesGuard + @Roles("User") + controller 분기 강화 (User+ 가 사실상
  //     모든 인증된 사용자 → RolesGuard 의의 약화). 본 task 는 첫 안 (Guard 인증만,
  //     controller 분기) 정공법 박제.
  //
  // 분기 우선순위 — isSelf check 먼저, isAdminPlus 다음, 둘 다 false 시 403:
  //   - isSelf=true 인 경우 role 검증 skip (User actor 본인 조회 path).
  //   - isSelf=false + isAdminPlus=true 인 경우 다른 user 조회 통과 (Admin / SuperAdmin
  //     actor 의 other-read path).
  //   - 둘 다 false 시 ForbiddenException — User actor 가 다른 user 조회 시도 reject.
  //   - 분기 후 service.findById 가 not-found (404 — service layer NotFoundException
  //     변환) 또는 entity 반환. ForbiddenException (403) vs NotFoundException (404) 의
  //     의미 분리 박제 — 권한 부족 vs 존재 부재.
  //
  // req.user shape — JwtStrategy.validate (T-0083) 가 박제한 payload (`{ sub: string,
  // role: UserRole }`) 정합. changeRole L129 (`(req.user as { sub: string }).sub`)
  // cast 정공법 1:1 mirror — type narrowing 으로 sub + role 추출.
  //
  // UserResponseDto.fromEntity (T-0095 박제) — hashedPassword 컬럼 차단 invariant
  // 자동 propagate. service-layer 의 User row 반환을 controller layer 가 단일 진입점
  // (fromEntity) 으로 변환 — clean separation 정공법 정합.
  //
  // endpoint 순서 박제 — `@Get(":id")` 는 list 의 `@Get()` 보다 **뒤**. NestJS routing
  // 우선순위에서 static path (없음) > param path 순. list 와 detail 모두 `@Get()`
  // 와 `@Get(":id")` 로 path-level 충돌 0 — NestJS 가 path 매칭으로 자동 분기.
  @Get(":id")
  @UseGuards(JwtAuthGuard)
  async detail(
    @Param("id") id: string,
    @CurrentUser() actor: JwtPayload,
  ): Promise<UserResponseDto> {
    // actor 는 @CurrentUser() param decorator 가 직접 JwtPayload 로 박제 — T-0125
    // refactor 박제 (이전: `(req.user as { sub: string; role: UserRole })` cast).
    // 분기 1: self check — :id 가 actor 본인 ID 와 일치하면 통과 (User tier 의 본인
    // 조회 path, REQ-046).
    const isSelf = actor.sub === id;
    // 분기 2: Admin+ check — actor role 이 Admin 또는 SuperAdmin 이면 통과 (다른
    // user 조회 administrative concern, REQ-043).
    const isAdminPlus = actor.role === "Admin" || actor.role === "SuperAdmin";
    // 둘 다 false 시 ForbiddenException — User actor 가 다른 user 조회 시도 reject.
    // service.findById 호출 0 — controller layer 분기 차단 (불필요 DB 조회 회피).
    if (!isSelf && !isAdminPlus) {
      throw new ForbiddenException(
        "다른 user 의 상세 조회는 Admin+ 권한이 필요합니다.",
      );
    }
    // service-layer 가 not-found 분기 → NotFoundException (404) 자동 mapping.
    // controller 는 도메인 entity (User row) → UserResponseDto 변환만 책임 (T-0095
    // 박제 — hashedPassword 컬럼 차단 invariant 자동 propagate).
    const user: User = await this.userService.findById(id);
    return UserResponseDto.fromEntity(user);
  }
}
