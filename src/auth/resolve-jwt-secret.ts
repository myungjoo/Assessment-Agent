// JWT signing secret 해석 helper.
// AuthModule 의 JwtModule.registerAsync useFactory 에서 inline 으로 쓰이던
// `process.env.AUTH_JWT_SECRET ?? ""` nullish-fallback 분기를 testable 한
// 순수 함수로 분리한다 (T-0234, audit §2(c)·§4 P3). `*.module.ts` 가
// coveragePathIgnorePatterns 로 측정 제외라 보안 핵심 fallback 분기가
// blind spot 이었으므로, 별도 파일로 빼 coverage 측정 대상화한다.
//
// 정책 (auth.module L25~29 주석 의도 이전):
//   - ADR-0008 Decision §5 — access token signing secret 의 환경변수 이름
//     contract 는 AUTH_JWT_SECRET.
//   - env 미설정(undefined) 시 빈 문자열 fallback. 실 환경에서는 boot 단계
//     env 검증 layer (ConfigModule + Joi schema 등) 가 reject 의무 — T-0087
//     candidate. 본 helper 는 이름 contract + 빈 fallback 정책만 박제한다.

// AUTH_JWT_SECRET env 값을 해석한다.
// 분기: env.AUTH_JWT_SECRET 이 존재(non-nullish)하면 그 값을 그대로,
//       undefined(nullish)면 빈 문자열 "" 을 반환한다.
// NodeJS.ProcessEnv 값은 항상 string | undefined 이므로 `?? ""` 의 두 분기
// (값 존재 / nullish) 만 존재한다. 빈 문자열 "" 은 non-nullish 라 그대로 통과.
export function resolveJwtSecret(env: NodeJS.ProcessEnv): string {
  return env.AUTH_JWT_SECRET ?? "";
}
