// AuthModule — ADR-0008 의 AuthModule scaffold (T-0081 acceptance §B 박제) +
// T-0082 acceptance §D 확장 (AuthController 등록 + UserModule import) +
// T-0083 acceptance §E 확장 (JwtStrategy + JwtAuthGuard + RolesGuard 등록 + export).
//
// 책임:
//   - JwtModule.registerAsync 로 AUTH_JWT_SECRET env 를 process boot 시점에 한 번 읽어
//     JwtService 의 default secret 으로 binding (HS256). signOptions.algorithm =
//     "HS256" 명시 — ADR-0008 Decision §4 의 HS256 채택 invariant.
//   - PassportModule.register({ defaultStrategy: "jwt" }) — JwtStrategy 등록 정합
//     (T-0083 의 strategy name).
//   - AuthService / JwtStrategy / RolesGuard provide. AuthService / JwtAuthGuard /
//     RolesGuard export — 다른 module 의 controller 가 @UseGuards(JwtAuthGuard) /
//     @UseGuards(RolesGuard) 적용 가능.
//   - AuthController 등록 (T-0082) — `/api/auth/login` + `/logout` + `/refresh` 3 endpoint.
//   - UserModule import (T-0082) — AuthController 가 UserRepository inject 의무.
//     UserRepository 는 UserModule 의 exports 에 포함됨.
//
// 책임 경계 (Out of Scope):
//   - cookie-parser middleware 직접 등록 안 함 — main.ts 의 bootstrap() 단계에서
//     `app.use(cookieParser())` 호출 (T-0082 §B 박제).
//   - endpoint 별 @Roles() 박제 — T-0084 / T-0085 candidate (본 task 는 guard /
//     decorator scaffold 만).
//   - RefreshToken DB rotation — T-0088 candidate.
//
// secret 미설정 시 fallback 정책:
//   - useFactory 가 `process.env.AUTH_JWT_SECRET ?? ""` 로 빈 secret fallback.
//     실 환경에서는 boot 단계에서 env 검증 layer (ConfigModule + Joi schema 등) 가
//     reject 의무 — T-0087 candidate. 본 module 은 ADR-0008 Decision §5 의 환경변수
//     이름 contract 만 박제.
import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { PassportModule } from "@nestjs/passport";

import { UserModule } from "../user/user.module";

import { AuthController } from "./auth.controller";
import { ACCESS_TOKEN_TTL, AuthService } from "./auth.service";
import { JwtAuthGuard } from "./jwt-auth.guard";
import { JwtStrategy } from "./jwt.strategy";
import { RolesGuard } from "./roles.guard";

@Module({
  imports: [
    // PassportModule — defaultStrategy "jwt" 명시 (T-0083). JwtStrategy class 의
    // PassportStrategy(Strategy, "jwt") 의 strategy name 정합.
    PassportModule.register({ defaultStrategy: "jwt" }),
    // UserModule import — AuthController 의 UserRepository inject 의존성 (T-0082).
    // UserRepository 는 UserModule 의 exports 에 포함되므로 본 import 만으로
    // AuthController 의 constructor injection 정상 resolve.
    UserModule,
    // JwtModule.registerAsync — async factory 로 env 를 module init 시점에 read.
    // global: false (default) — AuthModule import 한 module 에서만 JwtService inject
    // 가능. AuthService 가 본 module 의 provider 이므로 self-resolve.
    JwtModule.registerAsync({
      useFactory: () => ({
        // ADR-0008 Decision §5 — access token signing secret.
        secret: process.env.AUTH_JWT_SECRET ?? "",
        signOptions: {
          // ADR-0008 Decision §4 — HS256 (HMAC SHA-256) 명시.
          algorithm: "HS256",
          // ADR-0008 Decision §3 — access TTL 15min 의 module-level default.
          // AuthService.issueAccessToken 이 명시 override 하지만, module default 로도
          // 박제하여 다른 consumer 가 동일 service 호출 시 fallback 보장.
          expiresIn: ACCESS_TOKEN_TTL,
        },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, JwtAuthGuard, RolesGuard],
  exports: [AuthService, JwtAuthGuard, RolesGuard],
})
export class AuthModule {}
