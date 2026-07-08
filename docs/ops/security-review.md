# 보안 점검 감사 — secret 처리 / 인증 흐름 / RBAC

> **범위 한정**: 본 문서는 *감사(audit) 문서*다. main 에 이미 shipped 된 보안 통제를 **한 곳에서 열거·검증**하고
> gap 을 식별한다. 실 credential/토큰/키/비밀번호 **실값은 하나도 적지 않는다**([CLAUDE.md §9](../../CLAUDE.md)) —
> 통제의 *위치*(파일 경로·심볼)와 *정책*만 서술한다. PLAN.md P8 line 146 "보안 점검 (secret 처리, 인증 흐름, RBAC)"
> bullet 의 실증 근거.

관련 요구: README REQ-043(모든 기능 ID/Password 보호) · REQ-045(Admin RBAC) · REQ-008/REQ-016(접근 권한 부족 인식·통지).
관련 결정: [ADR-0008](../decisions/ADR-0008-auth-credential-type.md)(JWT+HttpOnly cookie) · [ADR-0023](../decisions/ADR-0023-permission-denied-audit-query-rbac-contract.md)(permission-denied audit RBAC 계약).

---

## 1. Secret 처리

### 1.1 JWT signing secret 해석

- **access secret 이름 contract** — [`src/auth/resolve-jwt-secret.ts`](../../src/auth/resolve-jwt-secret.ts) 의
  `resolveJwtSecret(env)` 가 `env.AUTH_JWT_SECRET ?? ""` nullish-fallback 을 순수 함수로 분리해 보유한다.
  `*.module.ts` 가 `coveragePathIgnorePatterns` 로 coverage blind spot 이던 fallback 분기를 별도 파일로 빼
  측정 대상화(T-0234). ADR-0008 Decision §5 의 `AUTH_JWT_SECRET` env 이름 contract 박제.
- **refresh secret 분리** — [`src/auth/auth.service.ts`](../../src/auth/auth.service.ts) 의 `REFRESH_SECRET_ENV`
  (`"AUTH_JWT_REFRESH_SECRET"`) 상수로 access 와 refresh signing secret 을 **분리**한다. `issueRefreshToken` 이
  `secret:` override 로 refresh secret 을 매 호출 명시 지정 → access secret 탈취 시 refresh forge 차단(ADR-0008 §5 invariant).
- **boot-시점 fallback 안전성** — [`src/auth/jwt.strategy.ts`](../../src/auth/jwt.strategy.ts) 의 `PLACEHOLDER_SECRET`
  는 env 미설정 시 passport-jwt 의 "빈 secret throw" 를 피하기 위한 non-empty placeholder 다. 실 token 은
  wrong-secret 으로 자동 401 → **실값 검증 차단 안전성 유지**. env fail-fast(ConfigModule + Joi) 는 T-0087 candidate.

### 1.2 env / 암호화 토큰 주입 정책

- **주입 방식** — 운영 `.env` 는 서버에만 두고 repo 에 commit 하지 않는다(`.gitignore` 대상, [runbook §4](runbook.md)).
  systemd `EnvironmentFile=/etc/assessment-agent.env`(권한 `0600`) / Docker `--env-file` 로 주입.
- **암호화 주입** — GitHub read-scope PAT 는 암호화 env 키 `GITHUB_<KEY>_TOKEN_ENC`(`scripts/encrypt-token.ts`)로만
  주입 — 평문 토큰을 env 에도 남기지 않는다([runbook §4](runbook.md) / §3.1).
- **secret-at-rest 부재** — audit record(`PermissionDeniedRecord`)는 schema 에 token/secret 컬럼 **자체가 부재**
  ([ADR-0023 §5](../decisions/ADR-0023-permission-denied-audit-query-rbac-contract.md)) → 조회 응답에 redaction 불요, 평문 token 누출 0.

### 1.3 git / STATE / journal 실값 금지 규율

- [CLAUDE.md §9](../../CLAUDE.md) — secret(API key·token)은 코드·journal·task 파일에 **절대 적지 않는다**.
- **grep 근거** — 본 감사 시점 auth 소스는 secret 의 **이름**(`AUTH_JWT_SECRET`·`AUTH_JWT_REFRESH_SECRET`·
  `GITHUB_<KEY>_TOKEN_ENC`)과 *주입 방식*만 참조하고, 실 key/token 값 리터럴은 존재하지 않는다.
  `jwt.strategy.ts` 의 `PLACEHOLDER_SECRET` 은 검증에 절대 통과 못 하는 의도적 non-secret placeholder 다.

---

## 2. 인증 흐름 (REQ-043 — 모든 기능 ID/Password 보호)

### 2.1 JWT 발급

- **login** — [`src/auth/auth.controller.ts`](../../src/auth/auth.controller.ts) `POST /api/auth/login`:
  `UserRepository.findByEmail` → `AuthService.verifyPassword`(bcrypt) → `issueAccessToken`/`issueRefreshToken`
  → HttpOnly Secure SameSite=Strict cookie 2종 set. email 부재 / password 불일치 모두 **동일 401 "Invalid credentials"**
  (enumeration 차단).
- **password hashing** — `AuthService.hashPassword`/`verifyPassword` 가 bcrypt `BCRYPT_ROUNDS=10`(ADR-0008 §6)
  단방향 hash. token 은 cookie 로만 전송, 응답 body 에 token 박제 0(HttpOnly 원칙).

### 2.2 검증 (verify)

- **strategy** — [`src/auth/jwt.strategy.ts`](../../src/auth/jwt.strategy.ts) `JwtStrategy`(passport-jwt "jwt"):
  `cookieExtractor` 가 HttpOnly cookie 의 `access_token` 추출 → HS256 verify → `validate(payload)` 가 `sub`+`role`
  claim 존재 검증 후 `req.user` 박제. cookie 부재 → null → passport 자동 401. `ignoreExpiration: false` → TTL(15min) 만료 자동 401.
- **guard 배선** — [`src/auth/jwt-auth.guard.ts`](../../src/auth/jwt-auth.guard.ts) `JwtAuthGuard extends AuthGuard("jwt")`
  얇은 wrapping. verify fail / extractor null / payload mismatch **모두 401 변환**. `@UseGuards(JwtAuthGuard)` 로 endpoint 보호.

### 2.3 미인증 요청 차단 경로

- **cookie 부재** → `cookieExtractor` null → passport-jwt 401.
- **signature/expiry invalid** → passport-jwt verify fail → 401.
- **payload shape mismatch**(`sub`/`role` 부재) → `JwtStrategy.validate` 가 `UnauthorizedException`.
- **refresh** — `POST /api/auth/refresh` 가 refresh cookie 부재 / verify fail / `sub`·`role` 부재 모두 동일 401
  (enumeration 차단, refresh secret override). refresh token DB revocation 은 gap(§4 참조).

---

## 3. RBAC (REQ-045 Admin 권한 / REQ-008·REQ-016 권한 부족 인식)

### 3.1 role 게이트

- **decorator** — [`src/auth/roles.decorator.ts`](../../src/auth/roles.decorator.ts) `@Roles(...roles)` +
  `ROLES_METADATA_KEY="roles"` 가 required role 을 metadata 로 박제. 빈 인자(`@Roles()`)는 빈 배열 → public 처리.
- **guard** — [`src/auth/roles.guard.ts`](../../src/auth/roles.guard.ts) `RolesGuard`:
  `ROLE_HIERARCHY`(`SuperAdmin ⊇ Admin ⊇ User`) escalation 매핑으로 `req.user.role` 비교.
  - decorator 미적용 / 빈 배열 → `true`(public).
  - `req.user` 부재 → **401** `UnauthorizedException`(인증 부재).
  - escalation 매치 실패 → **403** `ForbiddenException`(권한 부족, REQ-045/REQ-046 path).
- **Admin 권한 게이트(REQ-045)** — 재작성/Reset/Import/Export/인원편집/Group편집 endpoint 는
  `@UseGuards(JwtAuthGuard, RolesGuard)` + `@Roles("Admin")` 로 Admin·SuperAdmin 만 통과(escalation OR semantic).

### 3.2 permission-denied audit (ADR-0023 계약 / REQ-008·REQ-016)

- **audit 조회 endpoint** — [`src/permission-denied/permission-denied-record.controller.ts`](../../src/permission-denied/permission-denied-record.controller.ts)
  `GET /api/permission-denied-records`: `@UseGuards(JwtAuthGuard, RolesGuard)` + `@Roles("User")`
  (authenticated 면 접근, audience 차등은 service-layer own-instance 필터, [ADR-0023 §5](../decisions/ADR-0023-permission-denied-audit-query-rbac-contract.md)).
- **audience 모델(ADR-0023 §1)** — 미인증 401 / Admin·SuperAdmin 전체 bypass / non-Admin 자기 instance 범위(REQ-016 user/admin 분리).
- **타 instance 접근** — 403 아닌 **빈-필터(200 빈 배열)** — audit enumeration 정보 누출 최소화(ADR-0023 §4).
- **gap(부분 결선)** — non-Admin own-instance 실 필터는 User↔instance binding schema(ADR-0023 §2(b), DB-schema 게이트)
  선행 요구 → 현 slice 는 non-Admin = 빈 결과 fallback. 상세는 §4.

---

## 4. 감사 결과 + 잔여 gap

### 4.1 통제 커버 표

| 통제 | 실증 파일 / 심볼 | REQ | 상태 |
| --- | --- | --- | --- |
| JWT access secret 이름 contract | `resolve-jwt-secret.ts` `resolveJwtSecret` | REQ-043 | ✅ shipped |
| access ↔ refresh secret 분리 | `auth.service.ts` `REFRESH_SECRET_ENV` / `issueRefreshToken(secret override)` | REQ-043 | ✅ shipped |
| secret env/암호화 주입 정책 | [runbook §4](runbook.md) / [CLAUDE.md §9](../../CLAUDE.md) | REQ-043 | ✅ 문서화 |
| password bcrypt hashing | `auth.service.ts` `hashPassword`/`verifyPassword` (`BCRYPT_ROUNDS=10`) | REQ-043 | ✅ shipped |
| JWT 발급 + HttpOnly cookie | `auth.controller.ts` login / `COOKIE_OPTIONS`(HttpOnly·Secure·SameSite=strict) | REQ-043 | ✅ shipped |
| JWT 검증 + guard 배선 | `jwt.strategy.ts` `JwtStrategy`·`cookieExtractor` / `jwt-auth.guard.ts` `JwtAuthGuard` | REQ-043 | ✅ shipped |
| 미인증 요청 차단(401) | `jwt.strategy.ts` `validate` / `roles.guard.ts` `req.user` 부재 401 | REQ-043 | ✅ shipped |
| RBAC role escalation 게이트 | `roles.decorator.ts` `@Roles`/`roles.guard.ts` `ROLE_HIERARCHY`(403) | REQ-045 | ✅ shipped |
| permission-denied audit 조회 RBAC | `permission-denied-record.controller.ts` `@Roles("User")` + service own-instance 필터 | REQ-008/016 | ✅ shipped (부분) |
| audit enumeration 노출 최소화 | ADR-0023 §4 빈-필터(403 아님) | REQ-016 | ✅ 결정+구현 |

### 4.2 잔여 gap (심각도 판정)

아래 gap 은 모두 **이미 소스/ADR/task 에 인지·박제된 known-deferral** 이다 — 미인지 심각 미비 통제(예: 인증 우회 가능,
평문 secret 노출, RBAC bypass)는 감사에서 **발견되지 않았다**. 따라서 PLAN.md line 146 flip 은 정당(false-positive flip 아님).

- **(G1, 낮음) env fail-fast 부재** — `AUTH_JWT_SECRET`/`AUTH_JWT_REFRESH_SECRET` 미설정 시 빈 fallback(`resolve-jwt-secret.ts`
  `?? ""`, `auth.service.ts` `?? ""`). 실 token 은 wrong-secret 으로 자동 401 이라 **인증 우회 불가** — 보안적 안전성은
  유지되나 운영 오설정을 boot 단계에서 fail-fast 하지 못한다. mitigation: ConfigModule + Joi schema(T-0087 candidate).
- **(G2, 낮음) refresh token DB revocation 부재** — `auth.controller.ts` refresh 는 cookie 단순 재발급 rotation 이며
  기존 refresh 의 DB revocation(blacklist) 미결선(T-0086/T-0088 candidate 인지). 탈취된 refresh 가 만료(7d) 전까지 유효.
  mitigation: RefreshToken DB table + revocation path 후속 task.
- **(G3, 낮음) audit non-Admin own-instance 필터 부분 결선** — User↔instance binding schema(ADR-0023 §2(b), DB-schema
  게이트) 미도입으로 non-Admin 은 현재 빈 결과 fallback. Admin bypass 는 정상 동작. mitigation: binding schema 선행 task.
- **(G4, 낮음) cookie Secure=true dev/prod 미분기** — `COOKIE_OPTIONS.secure=true` 고정으로 local non-HTTPS dev
  에서 cookie 미전송(auth.controller.ts 주석 인지). 운영(HTTPS) 안전성 우선 — env-based `COOKIE_SECURE` flag 후속.

**판정**: G1~G4 모두 낮음(known-deferral, 인증 우회·secret 노출·RBAC bypass 미해당) → **심각 미비 통제 0**.
각 gap 은 본 문서 §4.2 + 대응 task 로 tracking 되며, 별도 pr-mode 코드 task 로 처리한다(본 감사는 doc-only, 코드 수정 0).

---

## References

- [`src/auth/jwt-auth.guard.ts`](../../src/auth/jwt-auth.guard.ts) / [`jwt.strategy.ts`](../../src/auth/jwt.strategy.ts) / [`roles.decorator.ts`](../../src/auth/roles.decorator.ts) / [`roles.guard.ts`](../../src/auth/roles.guard.ts) / [`resolve-jwt-secret.ts`](../../src/auth/resolve-jwt-secret.ts) / [`auth.service.ts`](../../src/auth/auth.service.ts) / [`auth.controller.ts`](../../src/auth/auth.controller.ts) — 인증·RBAC·secret 통제 실체
- [`src/permission-denied/permission-denied-record.controller.ts`](../../src/permission-denied/permission-denied-record.controller.ts) — audit 조회 RBAC endpoint
- [ADR-0008](../decisions/ADR-0008-auth-credential-type.md) — JWT + HttpOnly cookie / secret 분리
- [ADR-0023](../decisions/ADR-0023-permission-denied-audit-query-rbac-contract.md) — permission-denied audit RBAC/audience 계약
- [runbook §4](runbook.md) — secret 주입 방식 / env 키 이름
- [CLAUDE.md §9](../../CLAUDE.md) — secret 실값 git/journal 금지 안전장치
- [docs/requirements.md](../requirements.md) — REQ-043 / REQ-045 / REQ-008 / REQ-016

Refs: T-0824, REQ-043, REQ-045, REQ-008, REQ-016, ADR-0008, ADR-0023
