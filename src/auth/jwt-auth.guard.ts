// JwtAuthGuard — NestJS 표준 AuthGuard("jwt") 의 얇은 wrapping (T-0083 acceptance §C).
//
// 책임:
//   - JwtStrategy ("jwt" name 박제) 호출 위임 — strategy 의 jwtFromRequest extractor 가
//     cookie 의 access_token 추출, secretOrKey 로 HS256 verify, validate(payload) 가
//     req.user 박제.
//   - canActivate / handleRequest override 0 — NestJS @nestjs/passport 의 default
//     동작 그대로 사용 (verify fail / extractor null / payload mismatch 모두 401 변환).
//
// 사용 예 (후속 task):
//   @UseGuards(JwtAuthGuard)
//   @Get("api/auth/me")
//   me(@Req() req: Request) { return req.user; }
//
// 책임 경계:
//   - role 검증 0 — RolesGuard (별도 layer, T-0083 acceptance §D) 가 책임.
//   - 본 guard 는 단순 인증 (authentication), role-based 권한 (authorization) 은 별도.
import { Injectable } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";

@Injectable()
export class JwtAuthGuard extends AuthGuard("jwt") {}
