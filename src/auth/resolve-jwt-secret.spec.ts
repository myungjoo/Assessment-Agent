import { resolveJwtSecret } from "./resolve-jwt-secret";

// resolveJwtSecret helper 의 R-112 4종 (happy / error / branch / negative) cover.
// NodeJS.ProcessEnv 값은 항상 string | undefined 이므로 `?? ""` 의 두 분기
// (값 존재 non-nullish / undefined nullish) 만 존재 — 양 분기 각 1+ 실행.
describe("resolveJwtSecret", () => {
  // happy-path — AUTH_JWT_SECRET 이 비어있지 않은 문자열로 set 된 env 는
  // 그 값을 그대로 반환한다 (정확한 반환값 toBe 검증 — audit §3(i) "compile 만
  // 확인" 한계 보완).
  it("AUTH_JWT_SECRET 이 set 되어 있으면 그 값을 그대로 반환한다 (happy)", () => {
    const env: NodeJS.ProcessEnv = { AUTH_JWT_SECRET: "super-secret-value" };

    expect(resolveJwtSecret(env)).toBe("super-secret-value");
  });

  // error/negative — env 부재 (key 자체 없음) → "" fallback.
  // `?? ""` 의 nullish 분기 (right-hand) 실행.
  it('AUTH_JWT_SECRET 미정의 env (빈 객체) 면 "" 를 반환한다 (negative — env 부재)', () => {
    const env: NodeJS.ProcessEnv = {};

    expect(resolveJwtSecret(env)).toBe("");
  });

  // negative — key 는 있으나 undefined 로 명시 할당된 경우도 nullish 분기.
  it('AUTH_JWT_SECRET 이 명시적으로 undefined 면 "" 를 반환한다 (negative — 명시 undefined)', () => {
    const env: NodeJS.ProcessEnv = { AUTH_JWT_SECRET: undefined };

    expect(resolveJwtSecret(env)).toBe("");
  });

  // negative 경계값 — 빈 문자열 "" 은 nullish 아님 (falsy-but-not-nullish).
  // `?? ""` 가 빈 문자열을 통과시켜 그대로 "" 반환 — `||` 였다면 잘못 분기될
  // 경계로, `??` 의미를 박제하는 regression-sensitive 검증.
  it("AUTH_JWT_SECRET 이 빈 문자열이면 빈 문자열을 그대로 반환한다 (negative — 빈 문자 경계)", () => {
    const env: NodeJS.ProcessEnv = { AUTH_JWT_SECRET: "" };

    expect(resolveJwtSecret(env)).toBe("");
  });

  // negative 경계값 — 공백만 있는 문자열도 non-nullish 라 그대로 통과 (trim 하지
  // 않음 — helper 책임 경계: 값 존재 여부만 판단, 유효성 검증은 boot layer).
  it("AUTH_JWT_SECRET 이 공백 문자열이면 그 값을 그대로 반환한다 (negative — trim 안 함)", () => {
    const env: NodeJS.ProcessEnv = { AUTH_JWT_SECRET: "   " };

    expect(resolveJwtSecret(env)).toBe("   ");
  });
});
