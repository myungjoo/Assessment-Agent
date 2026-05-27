// AuthModule — ADR-0008 의 AuthModule scaffold (T-0081 acceptance §B 박제).
//
// 책임:
//   - JwtModule.registerAsync 로 AUTH_JWT_SECRET env 를 process boot 시점에 한 번 읽어
//     JwtService 의 default secret 으로 binding (HS256). signOptions.algorithm =
//     "HS256" 명시 — ADR-0008 Decision §4 의 HS256 채택 invariant.
//   - PassportModule import — 후속 T-0082 의 JwtStrategy (cookie / Bearer extractor)
//     base 구성을 위해 본 task 에서 미리 import. defaultStrategy 명시 안 함 (strategy
//     class 미신설 — T-0082 책임). PassportModule 의 strategies 등록 표면은 후속.
//   - AuthService provide + export — User module 등 다른 module 이 AuthService 를
//     inject 할 수 있도록 (T-0082 의 AuthController 가 첫 consumer).
//
// 책임 경계 (Out of Scope):
//   - AuthController 신설 안 함 (login / logout / refresh endpoint = T-0082).
//   - JwtStrategy / JwtAuthGuard 신설 안 함 (T-0082 책임).
//   - RolesGuard / @Role() decorator 신설 안 함 (T-0083 책임).
//   - app.module.ts 의 AuthModule import 만 추가 — global controller 등록 / cookie
//     parser middleware 등은 후속.
//
// secret 미설정 시 fallback 정책:
//   - useFactory 가 `process.env.AUTH_JWT_SECRET ?? ""` 로 빈 secret fallback.
//     실 환경에서는 boot 단계에서 env 검증 layer (ConfigModule + Joi schema 등) 가
//     reject 의무 — 본 ADR-0008 후속 chain 의 T-0082 가 ConfigModule 도입 시점에 박제.
//     본 module 은 ADR-0008 Decision §5 의 환경변수 이름 contract 만 박제.
import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { PassportModule } from "@nestjs/passport";

import { ACCESS_TOKEN_TTL, AuthService } from "./auth.service";

@Module({
  imports: [
    // PassportModule — defaultStrategy 미지정 (T-0082 의 JwtStrategy 신설 시 명시).
    // 본 task 의 import 는 후속 strategy registration 의 base wiring.
    PassportModule,
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
  providers: [AuthService],
  exports: [AuthService],
})
export class AuthModule {}
