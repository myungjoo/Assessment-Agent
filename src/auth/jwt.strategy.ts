// JwtStrategy — passport-jwt strategy 의 NestJS 표준 wrapping (T-0083 acceptance §B 박제).
//
// 책임:
//   - HttpOnly cookie 의 access_token 을 extractor 로 추출 (jwtFromRequest).
//   - AUTH_JWT_SECRET 으로 HS256 verify (AuthService.issueAccessToken 의 module
//     default secret 정합).
//   - payload 의 sub + role claim 검증 + 반환 → NestJS passport 표준 `req.user` 박제.
//
// extractor 정책 (ADR-0008 Decision §2 cookie attributes 정합):
//   - cookie-parser middleware (src/main.ts) 가 채운 req.cookies 에서 access_token read.
//   - cookie 부재 시 null 반환 → passport-jwt 가 자동 401 (no auth token).
//   - Authorization Bearer header 등 다른 source 는 본 시점 cover 0 — cookie 단일 source
//     of truth (ADR-0008 §2 HttpOnly 박제 정합, JS read 차단).
//
// secret 정책:
//   - process.env.AUTH_JWT_SECRET ?? "" — AuthService 와 동일 fallback. 실 환경에서는
//     boot 단계 env 검증 (T-0087 candidate, ConfigModule + Joi schema) 책임.
//   - ignoreExpiration: false — TTL 만료 시 passport-jwt 가 401 자동 변환.
//
// 책임 경계 (Out of Scope):
//   - refresh token verify path — AuthController.refresh 의 manual verify 책임.
//     본 strategy 는 access token 단일 책임 (defaultStrategy "jwt" 명).
//   - RBAC role 검증 — RolesGuard (별도 layer, T-0083 acceptance §D).
//   - blacklist / revocation 검증 — T-0088 candidate (RefreshToken DB table).
import { Injectable, UnauthorizedException } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import type { Request } from "express";
import { Strategy } from "passport-jwt";

import { ACCESS_TOKEN_COOKIE } from "./auth.controller";
import type { JwtPayload } from "./auth.service";

// cookieExtractor — Request 의 cookies 에서 access_token 추출. cookie-parser 미장착
// 또는 cookie 부재 시 null 반환 → passport-jwt 가 자동 401.
// export 박제 — spec 이 직접 호출하여 R-112 4 카테고리 cover.
export function cookieExtractor(req: Request): string | null {
  const cookies = req?.cookies as
    | Record<string, string | undefined>
    | undefined;
  const token = cookies?.[ACCESS_TOKEN_COOKIE];
  if (token === undefined || token === "") {
    return null;
  }
  return token;
}

// PLACEHOLDER_SECRET — passport-jwt 가 instantiation 시점에 secret 의 존재 (non-empty)
// 를 강제 — 빈 string 시 `JwtStrategy requires a secret or key` throw. T-0087 candidate
// 의 ConfigModule + Joi schema 가 boot 단계 fail-fast 박제 전까지의 placeholder. 본
// placeholder 는 verify 단계에서 signature mismatch → 401 변환 — 실 token 검증 차단
// 안전성은 유지. AuthService 의 `?? ""` 패턴 과 의도 동일 (boot-fail-fast deferral).
const PLACEHOLDER_SECRET =
  "PLACEHOLDER_AUTH_JWT_SECRET_BOOT_FALLBACK_NEVER_VERIFY";

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, "jwt") {
  constructor() {
    super({
      // cookie extractor — HttpOnly cookie 의 access_token 단일 source.
      jwtFromRequest: cookieExtractor,
      // secret 미설정 시 placeholder fallback — passport-jwt 가 빈 string 을 throw 하므로
      // non-empty placeholder 로 boot 단계 통과. 실 token 의 verify 는 wrong-secret 으로
      // 자동 401 — 보안적 안전성 유지. T-0087 candidate 의 boot-fail-fast 박제 의무.
      secretOrKey: process.env.AUTH_JWT_SECRET ?? PLACEHOLDER_SECRET,
      // TTL 만료 시 passport-jwt 가 자동 401 — ADR-0008 §3 의 15min TTL 강제.
      ignoreExpiration: false,
    });
  }

  // validate — passport-jwt 가 signature + expiry verify 후 호출. payload 의 sub +
  // role claim 추가 검증 + 반환. 반환값이 NestJS 의 `req.user` 에 박제.
  //
  // sub / role 부재 → UnauthorizedException — JwtStrategy 의 validate 책임 (forged
  // token 또는 legacy token 의 payload shape mismatch). RolesGuard 는 role 의 *값*
  // 까지 검증, 본 strategy 는 *존재* 만 검증.
  validate(payload: JwtPayload): JwtPayload {
    if (
      payload === null ||
      payload === undefined ||
      typeof payload !== "object"
    ) {
      throw new UnauthorizedException("Invalid token payload");
    }
    if (payload.sub === undefined || payload.sub === "") {
      throw new UnauthorizedException("Invalid token payload");
    }
    if (payload.role === undefined || payload.role === "") {
      throw new UnauthorizedException("Invalid token payload");
    }
    return payload;
  }
}
