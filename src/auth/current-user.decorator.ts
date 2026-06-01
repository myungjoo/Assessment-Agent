// @CurrentUser() param decorator — T-0125 acceptance 박제. NestJS createParamDecorator
// 표준 패턴 위에서, JwtStrategy.validate (T-0083) 가 req.user 에 박제한 JwtPayload
// 를 controller handler 의 parameter 로 ergonomic 하게 추출하는 syntax sugar.
//
// 책임:
//   - controller handler 의 `@Req() req: Request` + `req.user as { sub, role }` cast
//     2-step 패턴을 단일 `@CurrentUser() actor: JwtPayload` (또는 단일 claim 만의
//     `@CurrentUser("sub") sub: string`) 으로 정련.
//   - JwtAuthGuard 가 req.user 박제 후의 시점에서만 의미 있음 — 미인증 path 는
//     호출 layer (Guard) 가 차단 책임. 본 decorator 는 req.user 의 존재 여부를
//     방어적으로 (undefined 반환) 처리, throw 0.
//
// 사용 예 (T-0125 refactor 대상):
//   @UseGuards(JwtAuthGuard, RolesGuard)
//   @Roles("SuperAdmin")
//   @Patch(":id/role")
//   async changeRole(
//     @Param("id") id: string,
//     @Body() dto: ChangeRoleDto,
//     @CurrentUser("sub") actorUserId: string,
//   ): Promise<UserResponseDto> {
//     // actorUserId 가 JwtPayload.sub 의 string literal 로 직접 박제.
//   }
//
//   @UseGuards(JwtAuthGuard)
//   @Get(":id")
//   async detail(
//     @Param("id") id: string,
//     @CurrentUser() actor: JwtPayload,
//   ): Promise<UserResponseDto> {
//     // actor 가 전체 JwtPayload (sub + role) — actor.sub / actor.role 직접 사용.
//   }
//
// data 인자 분기:
//   - data === undefined (e.g. `@CurrentUser()`) → 전체 JwtPayload 반환.
//   - data === "sub" / "role" / 등 (e.g. `@CurrentUser("sub")`) → 해당 claim 만 반환.
//   - data 가 payload 에 없는 key 일 때 → undefined 반환 (throw 0).
//
// 책임 경계 (Out of Scope):
//   - 인증 자체 (JWT verify) — JwtAuthGuard / JwtStrategy 책임.
//   - 권한 검증 (RBAC role hierarchy) — RolesGuard / @Roles decorator 책임.
//   - req.user 부재 시 401 변환 — Guard layer 책임. 본 decorator 는 단순 추출 만.
//   - JwtPayload schema 변경 (추가 claim 박제) — 별도 ADR (ADR-0008 amendment).
import { createParamDecorator, type ExecutionContext } from "@nestjs/common";

import type { JwtPayload } from "./auth.service";

// currentUserFactory — `createParamDecorator` 가 wrapping 하기 전의 raw factory
// 함수. spec 이 직접 호출 가능하도록 named export 로 분리 (createParamDecorator 가
// 반환한 ParameterDecorator 는 factory 를 외부에 노출하지 않으므로 분리 박제).
//   - data 인자 typing: `keyof JwtPayload | undefined` — JwtPayload claim 이름 또는
//     undefined (전체 payload). TypeScript 가 호출 시점에 `@CurrentUser("sub")` 의
//     literal 을 keyof 로 narrow 하여 type-safe 한 추출 강제.
//   - ctx.switchToHttp().getRequest() 가 undefined 반환 시 (방어 분기 — 실 NestJS
//     HTTP context 에서는 발생 0) request 안전 처리 후 undefined 반환.
//   - request.user 가 undefined / null / non-object 일 때 모두 undefined 반환 —
//     호출 layer (Guard) 가 인증 차단 책임이라 본 decorator 는 throw 0.
export function currentUserFactory(
  data: keyof JwtPayload | undefined,
  ctx: ExecutionContext,
): JwtPayload | JwtPayload[keyof JwtPayload] | undefined {
  // ctx.switchToHttp().getRequest() 가 undefined 반환 시 (방어 분기) — 실 NestJS
  // HTTP context 에서는 발생 0 이나 unit test 의 mock context 또는 비-HTTP context
  // (e.g. GraphQL / RPC) 우회 시점의 안전성 박제.
  const request = ctx
    .switchToHttp()
    .getRequest<{ user?: unknown } | undefined>();
  if (request === undefined || request === null) {
    return undefined;
  }
  // request.user 가 undefined / null / non-object 시 undefined 반환. JwtAuthGuard
  // 가 통과시킨 정상 path 에서는 request.user 가 JwtPayload (object) 임을 보장.
  const userValue = request.user;
  if (
    userValue === undefined ||
    userValue === null ||
    typeof userValue !== "object"
  ) {
    return undefined;
  }
  const user = userValue as JwtPayload;
  // data 인자 분기 — undefined 시 전체 payload, 그 외 시 해당 claim.
  // data 가 payload 에 없는 key 일 때 user[data] 가 undefined → 그대로 반환 (throw 0).
  if (data === undefined) {
    return user;
  }
  return user[data];
}

// CurrentUser — createParamDecorator factory 가 반환한 ParameterDecorator.
// 사용 패턴은 파일 상단 doc 참조. factory 본체는 currentUserFactory (named export).
export const CurrentUser = createParamDecorator(currentUserFactory);
