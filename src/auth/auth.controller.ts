// AuthController — `/api/auth` 의 login / logout / refresh 3 endpoint.
// T-0082 acceptance §D 박제 (ADR-0008 Decision §1–§3 정공 박제).
//
// 책임 (api.md §3 의 후속 row, doc-only direct follow-up 에서 별도 박제):
//   - POST /api/auth/login    → 200 + access_token + refresh_token cookie set (성공) /
//                               401 Invalid credentials (실패 — enumeration 차단).
//   - POST /api/auth/logout   → 204 + access_token + refresh_token cookie clear.
//   - POST /api/auth/refresh  → 200 + 신규 access_token + refresh_token cookie set
//                               (rotation, ADR-0008 §3) / 401 (cookie 부재 / 만료 /
//                               signature invalid — 동일 응답).
//
// Cookie attributes (ADR-0008 Decision §2 박제):
//   - HttpOnly: true     — JS read 차단 (XSS 안전).
//   - Secure: true       — HTTPS 전용 (ADR-0003 §4 정합). 본 시점 dev 환경에서도
//                          true 유지 — local HTTPS 가 아닐 시 cookie 가 전송 안 됨,
//                          dev/prod 분기는 후속 task (env-based COOKIE_SECURE flag).
//   - SameSite: "strict" — CSRF 차단 (cross-site request 자동 미전송).
//   - Path: "/"          — 모든 API endpoint 적용.
//   - Domain: 미명시      — 운영 호스트 default domain.
//
// Cookie name 박제:
//   - access_token  — access JWT (15min TTL, ADR-0008 §3).
//   - refresh_token — refresh JWT (7day TTL, ADR-0008 §3).
//
// Refresh secret 분리 (ADR-0008 Decision §5):
//   - access secret  → AUTH_JWT_SECRET (AuthModule.registerAsync default secret).
//   - refresh secret → AUTH_JWT_REFRESH_SECRET (본 controller 가 JwtService.verify
//     의 secret option 으로 매 호출 override). access secret 탈취 시 refresh forge 차단.
//
// ValidationPipe wire (PersonController / GroupController 1:1 mirror, T-0036 precedent):
//   - controller-scope @UsePipes(ValidationPipe).
//   - whitelist: 정의되지 않은 필드 제거.
//   - forbidNonWhitelisted: 정의되지 않은 필드 포함 시 400.
//   - transform: plain JSON 을 DTO instance 로 변환.
//
// 책임 경계 (Out of Scope, task §Out of Scope 박제):
//   - ConfigModule fail-fast (Joi schema for AUTH_JWT_SECRET / AUTH_JWT_REFRESH_SECRET)
//     — T-0084 candidate. 본 controller 의 refresh endpoint 는 process.env 직접 read +
//     JwtService.verify secret override path.
//   - JwtStrategy + JwtAuthGuard (passport-jwt cookie extractor) — T-0083 RBAC chain.
//     본 task 의 refresh 는 JwtService.verify 직접 호출 (controller layer manual verify).
//   - RBAC @Role() decorator + RolesGuard — T-0083.
//   - RefreshToken DB rotation (revocation path) — ADR-0008 양의 Consequences §6 의
//     박제만, 실 DB layer 는 후속 task. 본 시점 rotation 은 cookie 단순 재발급.
//   - SignupController / AddUserDto — T-0083 SuperAdmin RBAC scope.
//
// T-0106 추가 (GET /api/auth/me endpoint — User+ tier self-detail):
//   - 본 controller 에 `me()` 메서드 박제 — @Get("me") + @UseGuards(JwtAuthGuard) +
//     req.user.sub 추출 → UserRepository.findById(sub) → null → NotFoundException
//     변환 → UserResponseDto.fromEntity 변환.
//   - UserController.detail (T-0101) 의 self 분기 1:1 mirror — 단 path param 없음
//     (self-detail 전용). RolesGuard 미적용 — User+ 면 누구나 자기 조회 가능.
//   - ADR-0008 §6 application-layer chain 의 마지막 미박제 endpoint — User CRUD-R
//     표면 4/4 closure (T-0099 GET list + T-0101 GET detail + T-0106 GET me + 후속).
//   - UserRepository 직접 inject (이미 login endpoint 가 inject) — UserService inject
//     추가는 AuthModule ↔ UserModule forwardRef circular chain 의 deep resolution
//     path 가 user.module.spec test fixture 와 충돌 (NestJS injector parallel
//     Promise.all race window → unhandledPromiseRejection 으로 Jest worker 종료)
//     박제, controller-layer inline null→NotFoundException 변환 채택. service-layer
//     변환 logic (T-0101 UserService.findById) 과 동일 의미 — minor duplication 은
//     CurrentUser decorator + base-controller 일반화 follow-up candidate.
import {
  Body,
  Controller,
  Get,
  HttpCode,
  NotFoundException,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import type { Request, Response } from "express";

import { UserResponseDto } from "../user/dto/user-response.dto";
import { UserRepository } from "../user/user.repository";

import { AuthService, REFRESH_SECRET_ENV } from "./auth.service";
import { LoginDto } from "./dto/login.dto";
import { JwtAuthGuard } from "./jwt-auth.guard";

// Cookie name 단일 source of truth — spec 도 동일 const 를 import 하여 round-trip
// 검증. controller 외부에 export — refresh endpoint 검증 / e2e 후속 task 가 reuse.
export const ACCESS_TOKEN_COOKIE = "access_token";
export const REFRESH_TOKEN_COOKIE = "refresh_token";

// Cookie attributes 단일 source of truth — ADR-0008 Decision §2 박제. spec / e2e
// 가 동일 const 를 import 하여 attribute 정합 검증. Note: `sameSite: "strict"`
// 의 lowercase 형태는 express @types 의 cookie option signature 정합 (TS strict).
export const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: true,
  sameSite: "strict" as const,
  path: "/",
};

// JwtPayload (refresh-side) — refresh JWT 의 최소 contract. AuthService 의 JwtPayload
// 와 동일 surface (sub + role claim, T-0083). type narrowing 을 위해 본 module 안에서
// local 박제 — refresh rotation 시 payload.role 을 다음 token 으로 보존 (DB lookup 없음).
interface RefreshJwtPayload {
  sub?: string;
  role?: string;
  iat?: number;
  exp?: number;
}

@Controller("api/auth")
@UsePipes(
  new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  }),
)
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly userRepository: UserRepository,
    // JwtService — refresh endpoint 가 verify(token, { secret: refreshSecret }) 직접
    // 호출 위해 inject. AuthService 의 verifyToken 은 access secret 사용 (module
    // default) 이라 refresh secret override path 가 부재 — controller layer 에서
    // manual verify 박제. JwtStrategy 도입 (T-0083) 후에는 본 직접 호출이 strategy
    // 의 secretOrKeyProvider 로 위임.
    private readonly jwtService: JwtService,
  ) {}

  // POST /api/auth/login — body LoginDto → User lookup → password verify →
  // cookie set 2 종 → 200 + { userId }. enumeration 차단 목적으로 email 부재 /
  // password 불일치 의 응답 메시지 + status 동일 (둘 다 401 "Invalid credentials").
  //
  // 흐름:
  //   1. UserRepository.findByEmail(dto.email) — null 시 401.
  //   2. AuthService.verifyPassword(dto.password, user.password) — false 시 401.
  //   3. issueAccessToken / issueRefreshToken 으로 JWT 2 종 발급.
  //   4. res.cookie 로 HttpOnly Secure SameSite=Strict cookie 2 종 set.
  //   5. 200 + { userId: user.id } 응답.
  //
  // 응답 body 의 `userId` 박제 의도:
  //   - 후속 GET /api/me endpoint (T-0083 candidate) 가 본 token 으로 user 정보를
  //     반환하므로, login 응답에 userId 만 박제 — email / role 등 추가 정보는 후속
  //     endpoint 책임. token 자체는 cookie 로만 전송 — body 에 token 박제 0 (HttpOnly
  //     원칙 위배 방지).
  @Post("login")
  @HttpCode(200)
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ userId: string }> {
    const user = await this.userRepository.findByEmail(dto.email);
    if (user === null) {
      // email 부재 → 401. enumeration 차단 — 동일 응답 message.
      throw new UnauthorizedException("Invalid credentials");
    }
    const ok = await this.authService.verifyPassword(
      dto.password,
      user.hashedPassword,
    );
    if (!ok) {
      // password 불일치 → 401. enumeration 차단 — 동일 응답 message.
      throw new UnauthorizedException("Invalid credentials");
    }
    // JWT 2 종 발급 — AuthService 가 ADR-0008 §3 TTL (access 15m / refresh 7d) 박제.
    // T-0083 acceptance §A — user.role 을 두 번째 인자로 전달, payload.role claim
    // 박제 (RolesGuard 가 본 claim 위에서 escalation 검증).
    const accessToken = this.authService.issueAccessToken(user.id, user.role);
    const refreshToken = this.authService.issueRefreshToken(user.id, user.role);
    // cookie set — ADR-0008 §2 의 HttpOnly + Secure + SameSite=Strict + Path=/.
    res.cookie(ACCESS_TOKEN_COOKIE, accessToken, COOKIE_OPTIONS);
    res.cookie(REFRESH_TOKEN_COOKIE, refreshToken, COOKIE_OPTIONS);
    return { userId: user.id };
  }

  // POST /api/auth/logout — cookie clear 2 종 (access + refresh) → 204.
  //
  // 흐름:
  //   1. res.clearCookie(ACCESS_TOKEN_COOKIE, COOKIE_OPTIONS).
  //   2. res.clearCookie(REFRESH_TOKEN_COOKIE, COOKIE_OPTIONS).
  //   3. 204 No Content 응답 (body 없음).
  //
  // Idempotent — cookie 가 이미 없는 상태에서 호출해도 정상 (express clearCookie 는
  // Set-Cookie header 만 박제, 기존 cookie 존재 여부와 무관). Logout 의 "보안적 안전"
  // semantic 박제 — 인증 상태와 무관하게 호출 가능. RBAC guard 적용 안 함
  // (T-0083 후속) — 본 시점 logout 은 public endpoint.
  //
  // path/sameSite 명시 박제 — clearCookie 가 set 시점 attributes 와 동일해야
  // 브라우저가 정확히 매칭하여 제거 (특히 SameSite=Strict cookie 는 attributes 분리 시
  // 별도 cookie 로 인식되어 제거 실패 가능). 동일 COOKIE_OPTIONS 사용으로 round-trip
  // 정합 보장.
  @Post("logout")
  @HttpCode(204)
  logout(@Res({ passthrough: true }) res: Response): void {
    res.clearCookie(ACCESS_TOKEN_COOKIE, COOKIE_OPTIONS);
    res.clearCookie(REFRESH_TOKEN_COOKIE, COOKIE_OPTIONS);
  }

  // POST /api/auth/refresh — refresh cookie 읽기 → verify (refresh secret override) →
  // 신규 access + refresh token rotation → cookie set 2 종 → 200 + { userId }.
  //
  // 흐름:
  //   1. req.cookies[REFRESH_TOKEN_COOKIE] — 부재 / 빈 문자열 시 401.
  //   2. JwtService.verify(token, { secret: refreshSecret }) — refresh secret override.
  //      jsonwebtoken 표준 에러 (TokenExpiredError / JsonWebTokenError / NotBeforeError)
  //      는 try/catch 로 401 변환 (enumeration 차단 — 동일 응답).
  //   3. payload.sub (userId) 추출 → issueAccessToken / issueRefreshToken 신규 발급
  //      (rotation, ADR-0008 §3). 기존 refresh token 의 DB revocation 은 후속 task —
  //      본 시점 rotation 은 cookie 단순 재발급 (revocation gap risk 인지, follow-up T-0086).
  //   4. cookie set 2 종 → 200 + { userId } 응답.
  //
  // refresh secret 이 module init 시점에 binding 되지 않음 (AuthModule 의 JwtModule
  // default 는 access secret) — 따라서 매 호출 시 process.env 직접 read + override.
  // AuthService 의 verifyToken 은 access secret 사용이라 본 endpoint 가 직접 호출
  // (manual verify) — service layer 에 refresh-verify 추가는 후속 task 책임.
  @Post("refresh")
  @HttpCode(200)
  refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): { userId: string } {
    // cookie-parser middleware (src/main.ts 박제) 가 req.cookies 자동 parsing.
    // cookie 부재 / 빈 문자열 → 401.
    const cookies = req.cookies as
      | Record<string, string | undefined>
      | undefined;
    const refreshToken = cookies?.[REFRESH_TOKEN_COOKIE];
    if (refreshToken === undefined || refreshToken === "") {
      throw new UnauthorizedException("Invalid refresh token");
    }
    // refresh secret env read — 미설정 시 빈 문자열 fallback. 빈 secret 으로의
    // verify 는 jsonwebtoken 이 자동 fail (signature mismatch) → catch 분기에서 401.
    const refreshSecret = process.env[REFRESH_SECRET_ENV] ?? "";
    // manual verify — jwt expired / signature invalid / NotBefore / 잘못된 payload
    // 모두 동일 401. JwtService.verify 의 secret option 으로 refresh secret override.
    // T-0083 acceptance §A — payload.role 도 추출하여 rotation 시 보존.
    let userId: string;
    let role: string;
    try {
      const payload = this.jwtService.verify<RefreshJwtPayload>(refreshToken, {
        secret: refreshSecret,
      });
      if (payload.sub === undefined || payload.sub === "") {
        throw new UnauthorizedException("Invalid refresh token");
      }
      if (payload.role === undefined || payload.role === "") {
        // role claim 부재 → 401. T-0083 acceptance §A 의 RBAC backbone — payload
        // 의 role 부재는 access secret/payload 변조 가능성 (legacy token 또는
        // forged token). enumeration 차단 — 동일 응답 message.
        throw new UnauthorizedException("Invalid refresh token");
      }
      userId = payload.sub;
      role = payload.role;
    } catch (err) {
      // UnauthorizedException 은 그대로 re-throw — controller 가 raw error 401 변환
      // 분기 박제. 그 외 (TokenExpiredError / JsonWebTokenError / NotBeforeError) 모두
      // 401 변환 (enumeration 차단 — 동일 응답 message).
      if (err instanceof UnauthorizedException) {
        throw err;
      }
      throw new UnauthorizedException("Invalid refresh token");
    }
    // rotation — 신규 access + refresh 2 종 발급 + cookie set. 기존 refresh 의 DB
    // revocation 은 후속 task T-0088 candidate. role 은 payload 에서 보존 (DB lookup
    // 없음 — 본 task 의 rotation 은 cookie 단순 재발급, role 변경 reflect 는 T-0088).
    const newAccessToken = this.authService.issueAccessToken(userId, role);
    const newRefreshToken = this.authService.issueRefreshToken(userId, role);
    res.cookie(ACCESS_TOKEN_COOKIE, newAccessToken, COOKIE_OPTIONS);
    res.cookie(REFRESH_TOKEN_COOKIE, newRefreshToken, COOKIE_OPTIONS);
    return { userId };
  }

  // GET /api/auth/me — 인증된 user 의 self-detail 조회 endpoint. T-0106 acceptance §A
  // 박제. ADR-0008 §6 application-layer chain 의 마지막 미박제 endpoint — User CRUD-R
  // 표면 closure (T-0099 GET list + T-0101 GET detail + 본 endpoint 가 self-detail 박제).
  //
  // 책임 (UserController.detail T-0101 의 self 분기 1:1 mirror, 단 path param 없음):
  //   1. JwtAuthGuard 통과 → req.user 박제 (JwtStrategy.validate 가 payload 의 sub +
  //      role claim 을 req.user 에 설정, T-0083).
  //   2. req.user.sub 추출 — actor 본인의 user id. type narrowing 으로 string 확정.
  //   3. UserRepository.findById(sub) 호출 — null 반환 시 controller-layer NotFoundException
  //      (404) 변환. T-0101 의 UserService.findById null→NotFoundException 패턴을 본
  //      controller 안에 inline 박제 — UserService inject 추가가 AuthModule ↔ UserModule
  //      forwardRef circular chain 의 deep resolution path (AuthController →
  //      UserService → UserRepository → PrismaService) 에서 NestJS injector 의
  //      parallel Promise.all 의 race window 와 충돌 (user.module.spec test fixture
  //      의 unhandledPromiseRejection). 대안 — UserRepository 직접 inject + null
  //      체크 controller 안 박제. T-0086 acceptance §A 의 null-safe API 정공법은
  //      UserRepository 도 동일 (findById 가 null 반환), service-layer null→404 변환
  //      logic 1 줄만 controller 안에 inline. 같은 변환 분기를 두 곳 (UserService
  //      + AuthController) 에 박제하는 minor duplication 은 follow-up T-NNNN 에서
  //      CurrentUser decorator + base-controller 일반화 박제 시 일괄 정리 candidate.
  //   4. UserResponseDto.fromEntity(user) 변환 → 200 응답. T-0095 박제 — hashedPassword
  //      컬럼 차단 invariant 자동 propagate (controller layer 의 단일 변환 진입점).
  //
  // RBAC tier 결정 — User+ (인증만 강제, role 분기 0):
  //   - decorator stack 은 @UseGuards(JwtAuthGuard) 만 — RolesGuard 미적용. 본 endpoint
  //     는 "본인 self-detail" 의미 — User / Admin / SuperAdmin 모두 자기 자신은 조회
  //     가능해야 함 (REQ-046 정합). path param 없음 → 다른 user 조회 분기 0 → role 검증
  //     불요. UserController.detail (T-0101) 의 self OR Admin+ 분기 의 self 만 박제.
  //
  // req.user shape — JwtStrategy.validate (T-0083) 가 박제한 payload (`{ sub: string,
  // role: UserRole }`) 정합. UserController.detail (L263 `(req.user as { sub: string;
  // role: UserRole }).sub`) cast 정공법 1:1 mirror — type narrowing 으로 sub 추출.
  //
  // defence in depth — req.user / req.user.sub 부재 분기:
  //   - JwtAuthGuard 가 정상 작동 시 req.user 는 항상 set (JwtStrategy.validate 통과
  //     보장). 본 분기는 guard 우회 / strategy 변경 시 fallback — UnauthorizedException
  //     변환 (의미: 인증 자체의 실패). 일반 분기에서 발생 0 — defence in depth.
  //
  // ValidationPipe @UsePipes (controller-scope, L92) 는 본 endpoint 에서 noop —
  // @Get 은 body 없음 (DTO 검증 path 0). 응답 변환만 책임.
  @Get("me")
  @UseGuards(JwtAuthGuard)
  async me(@Req() req: Request): Promise<UserResponseDto> {
    // defence in depth — req.user / req.user.sub 부재 fallback. JwtAuthGuard 정상
    // 작동 시 발생 0, guard 우회 / strategy 변경 / 미래 ref. 차단 위한 explicit guard.
    const user = req.user as { sub?: string; role?: string } | undefined;
    if (user === undefined || user.sub === undefined || user.sub === "") {
      throw new UnauthorizedException("Invalid token payload");
    }
    // UserRepository.findById null-safe API — row 부재 시 null 반환. controller-layer
    // 가 null → NotFoundException (404) 변환. T-0101 UserService.findById 패턴 1:1
    // mirror — race window (stale token 의 sub 가 가리키는 user row 동시 삭제됨)
    // 도 404 변환. controller 는 도메인 entity → UserResponseDto 변환만 책임 (T-0095
    // 박제 — hashedPassword 컬럼 차단 invariant 자동 propagate).
    const found = await this.userRepository.findById(user.sub);
    if (found === null) {
      throw new NotFoundException(`User ${user.sub} 가 존재하지 않습니다.`);
    }
    return UserResponseDto.fromEntity(found);
  }
}
