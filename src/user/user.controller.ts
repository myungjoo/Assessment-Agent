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
  Req,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from "@nestjs/common";
import type { User } from "@prisma/client";
import type { Request } from "express";

import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { Roles } from "../auth/roles.decorator";
import { RolesGuard } from "../auth/roles.guard";

import { AddUserDto } from "./dto/add-user.dto";
import { ChangeRoleDto } from "./dto/change-role.dto";
import { UserResponseDto } from "./dto/user-response.dto";
import { UserService, type UserRole } from "./user.service";

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
    @Req() req: Request,
  ): Promise<UserResponseDto> {
    // req.user 는 JwtStrategy.validate 가 박제한 payload — type narrowing 으로 sub 추출.
    // AuthController.refresh 의 cookies type narrowing 정공법 정합.
    const actorUserId = (req.user as { sub: string }).sub;
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

  // GET /api/users/:id — 단일 user detail 조회. T-0101 acceptance §C 박제. RBAC backbone
  // 의 **세 번째 production 적용 endpoint** + **첫 conditional branch** (self OR Admin+).
  //
  // RBAC 박제 — self OR Admin+ tier (task §Why L27-35 박제):
  //   - REQ-046 (User read-only) 박제 — User tier 가 본인 데이터 조회 가능해야 자연
  //     (login 후 자기 프로필 확인 등 일반적 use case). Admin+ tier 만 강제 시 User
  //     본인 조회 0 → REQ-046 형해화.
  //   - REQ-043 (User CRUD 의 read-detail) 박제 — 다른 user 조회는 administrative concern.
  //     T-0099 list 패턴 정합.
  //   - **첫 conditional branch 박제** — T-0087 (SuperAdmin literal match) + T-0099
  //     (Admin+ escalation descent) 이후 self OR role 의 OR 분기 첫 production 사용.
  //     RolesGuard 의 @Roles literal match 만으로는 OR 분기 불가 — controller 내부
  //     분기 필요.
  //
  // RolesGuard 적용 정책 — Guard 는 인증만 강제, role 분기는 controller 내부 (정공법):
  //   - decorator stack: @UseGuards(JwtAuthGuard) 만 — RolesGuard 미적용. JwtAuthGuard
  //     단독 의의: 인증 (cookie → JWT verify → req.user 박제) 만 강제, role 검증은
  //     application logic 책임.
  //   - 대안 — RolesGuard + @Roles("User") + controller 분기 강화 (User tier 이상 통과,
  //     controller 가 self check). User+ 가 사실상 모든 인증된 사용자 → RolesGuard 의의
  //     약화. 본 task 는 첫 안 (Guard 인증만, controller 분기) 정공법 박제.
  //
  // req.user shape 박제 (JwtStrategy.validate 박제):
  //   - JwtStrategy.validate (T-0083) 가 payload 의 `{ sub: string, role: UserRole }` 를
  //     req.user 에 박제. type narrowing 으로 sub + role 추출 — changeRole L129
  //     `(req.user as { sub: string }).sub` cast 정공법 mirror.
  //
  // 분기 우선순위:
  //   1. isSelf check 먼저 — actor.sub === :id 일 경우 self detail (User actor 도 통과).
  //      role 검증 skip (or 분기의 short-circuit 정공법 — 본인 조회는 role 무관).
  //   2. isAdminPlus check 다음 — actor.role ∈ {Admin, SuperAdmin} 일 경우 administrative
  //      detail (다른 user 의 데이터 조회 권한).
  //   3. 둘 다 false → ForbiddenException — User actor 가 다른 user 조회 시점의
  //     기본 거부 (REQ-043 의 administrative concern 보호).
  //
  // ForbiddenException vs NotFoundException 분리:
  //   - 403 (Forbidden) — 권한 부족 (다른 user 의 데이터 접근 시도). controller layer
  //     책임 — service 호출 전 사전 차단.
  //   - 404 (NotFoundException) — 대상 부재 (DB row 0). service layer 책임 — repository
  //     의 null 반환을 NotFoundException 으로 변환 (T-0101 §A 박제).
  //   - 보안 정책 측면 — 403 vs 404 분리가 enumeration attack 의 단서 (ID 존재성 누출)
  //     를 만들 수 있으나 본 task 는 administrative concern 의 명시성 우선 (Admin+
  //     actor 가 not-found 와 forbidden 구분 가능). 추가 강화는 별도 ADR.
  //
  // UserResponseDto.fromEntity 매핑 박제 (T-0095):
  //   - hashedPassword 차단 invariant 자동 propagate — fromEntity 의 whitelist 정합이
  //     detail 응답에서도 동일 보호. signup / changeRole / list 의 1:1 mirror.
  //   - service-layer (UserService.findById) 는 도메인 entity (User row) 반환. DTO
  //     변환은 controller layer 단일 책임 (clean separation 정공법 정합).
  //
  // endpoint 순서 (NestJS routing 우선순위):
  //   - @Get(":id") 는 @Get() 보다 **뒤** 또는 NestJS 가 specificity 로 자동 분리.
  //     list 가 @Get() — 충돌 0. signup 의 @Post(), changeRole 의 @Patch(":id/role") 와
  //     route segment 도 충돌 0.
  @Get(":id")
  @UseGuards(JwtAuthGuard)
  async detail(
    @Param("id") id: string,
    @Req() req: Request,
  ): Promise<UserResponseDto> {
    // req.user 의 type narrowing — JwtStrategy.validate 가 박제한 payload shape.
    // changeRole L129 `(req.user as { sub: string }).sub` cast 정공법 mirror,
    // role 도 함께 추출 — self OR Admin+ 분기 source.
    const actor = req.user as { sub: string; role: UserRole };

    // 분기 1 — self check. actor.sub === :id 일 경우 본인 조회 (role 무관, User actor
    // 도 통과). REQ-046 박제 — User tier 의 self read-only path.
    const isSelf = actor.sub === id;

    // 분기 2 — Admin+ tier check. actor.role ∈ {Admin, SuperAdmin} 일 경우 administrative
    // detail. REQ-043 박제 — Admin tier 의 user CRUD read 책임. T-0099 list pattern
    // 의 RolesGuard escalation hierarchy descent 와 등가 (Admin literal + SuperAdmin
    // 자동 통과).
    const isAdminPlus = actor.role === "Admin" || actor.role === "SuperAdmin";

    // 분기 3 — 둘 다 false → 403. User actor 가 다른 user 조회 시점의 기본 거부.
    // service.findById 호출 0 — controller layer 가 사전 차단 (T-0101 §D negative case).
    if (!isSelf && !isAdminPlus) {
      throw new ForbiddenException(
        "다른 user 의 상세 조회는 Admin+ 권한이 필요합니다.",
      );
    }

    // service-layer 의 raw forward + not-found 분기 — repository.findById null →
    // NotFoundException 변환 (T-0101 §A 박제). controller 의 단일 책임은 DTO 변환만.
    const user: User = await this.userService.findById(id);
    return UserResponseDto.fromEntity(user);
  }
}
