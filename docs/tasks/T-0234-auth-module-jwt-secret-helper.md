---
id: T-0234
title: auth.module JWT secret ?? fallback 을 resolveJwtSecret helper 로 분리해 coverage 측정 대상화
phase: P4
status: PENDING
commitMode: pr
coversReq: [TBD]
estimatedDiff: 50
estimatedFiles: 3
created: 2026-06-04
plannerNote: P4 audit backlog P3 (test-quality-coverage-audit-2026-06 §4 T-cand-3) — auth.module ?? "" 분기를 testable helper 로 분리. dependency-free pr-mode, ≤3 파일.
---

# T-0234 — auth.module JWT secret `?? ""` fallback 을 `resolveJwtSecret` helper 로 분리

## Why

T-0231 audit 보고서([test-quality-coverage-audit-2026-06.md](../progress/test-quality-coverage-audit-2026-06.md)) §2(c)·§4 P3 가 박제한 coverage measurement blind spot 해소다. `src/auth/auth.module.ts:63` 의 `process.env.AUTH_JWT_SECRET ?? ""` nullish 분기는 보안 핵심(JWT signing secret binding)인데, 이 분기가 `*.module.ts` 파일 안에 있어 `package.json` 의 `coveragePathIgnorePatterns` (`\.module\.ts$`) 로 coverage 측정에서 제외된다. 현재 `auth.module.spec.ts:102` 가 분기를 **실행**은 하지만(spec-presence + R-112 충족), coverage 측정기가 이 분기를 세지 못해 **회귀 시 자동 적발 불가**(measurement blind spot).

본 task 는 `?? ""` env-fallback 로직을 testable helper(`resolveJwtSecret(env): string`)로 분리해 coverage 측정 대상으로 만든다. module 은 helper 호출만 남긴다. 이는 audit P1(T-0232)·P2(T-0233) 에 이은 마지막 dependency-free 강화 backlog 항목이다. 새 외부 dependency 0 (Node 내장 `process.env`).

## Required Reading

- `docs/progress/test-quality-coverage-audit-2026-06.md` — §2(c)(L46~53) + §4 P3(L99~105). 본 task 의 source. helper 분리 방향·spec 검증 항목·prod 소량 변경 cap.
- `src/auth/auth.module.ts` — L60~73 의 `JwtModule.registerAsync({ useFactory: () => ({ secret: process.env.AUTH_JWT_SECRET ?? "" ... }) })`. helper 추출 대상 (L63). L25~29 의 fallback 정책 주석도 helper 로 이전·정합.
- `src/auth/auth.module.spec.ts` — L102~118 의 `AUTH_JWT_SECRET 미설정 시에도 compile 한다 (negative — env missing fallback)` test. 현재 "compile 만 확인" 한계(audit §3(i)) — helper 분리 후 이 test 는 유지하되, 반환값 검증은 신규 colocated helper spec 에서 담당.
- `package.json` — `coveragePathIgnorePatterns` (L88~). helper 파일(`src/auth/resolve-jwt-secret.ts`)이 `*.module.ts` 패턴에 걸리지 않아 측정 대상이 됨을 확인. **이 패턴 자체는 수정 금지**(Out of Scope).

## Acceptance Criteria

- [ ] `src/auth/resolve-jwt-secret.ts` 신규 helper 작성: `export function resolveJwtSecret(env: NodeJS.ProcessEnv): string`. 본문은 `env.AUTH_JWT_SECRET ?? ""` 로 ADR-0008 Decision §5 의 secret 이름 contract + 빈 fallback 정책을 박제(auth.module L25~29 주석 의도 이전). 분기 의미(env 존재 → 그 값 / env 부재·undefined → `""`)를 helper 안에 가둔다.
- [ ] `src/auth/auth.module.ts` 수정: `secret: process.env.AUTH_JWT_SECRET ?? ""` 를 `secret: resolveJwtSecret(process.env)` 로 교체. module 은 helper 호출만 남기고 inline nullish 분기 제거. import 추가. 그 외 module 동작(signOptions·algorithm·expiresIn·provider/export 배열) 변경 0.
- [ ] `src/auth/resolve-jwt-secret.spec.ts` colocated spec 신규 작성 (R-112 4종 + negative cases 충분 cover):
  - **happy-path**: `AUTH_JWT_SECRET` 이 비어있지 않은 문자열로 set 된 env → 그 값을 그대로 반환함을 assertion (단순 toBeDefined 아닌 정확한 반환값 toBe 검증 — audit §3(i) "compile 만 확인" 한계 보완).
  - **error/negative path — env 부재**: `AUTH_JWT_SECRET` 미정의(`{}` 또는 key delete) env → `""` 반환 검증 (nullish `?? ""` 분기 negative).
  - **branch cover**: 위 두 케이스가 `?? ""` 의 양 분기(left-hand 값 존재 / nullish)를 각각 1+ 실행 — 분기마다 test 분리.
  - **추가 negative cases 충분 cover**: 빈 문자열 `""` 명시 set (nullish 아님 — `?? ""` 가 빈 문자열을 통과시켜 `""` 반환, falsy-but-not-nullish 경계값) + `undefined` 명시 할당 케이스 등 경계 분기 각 1+. 단일 negative 만으로 부족하지 않게.
  - reference: NodeJS.ProcessEnv 의 값은 항상 `string | undefined` 이므로 type mismatch 분기는 타입상 제한적 — 그 경우 "분기 없음 — 해당 항목 생략" 명시 가능하나, undefined/빈문자/존재값 경계는 반드시 cover.
- [ ] `auth.module.spec.ts:102` 의 기존 `AUTH_JWT_SECRET 미설정 시에도 compile 한다` test 는 **유지**(module DI 레벨 negative 회귀 가드). helper 분리로 깨지지 않음을 확인.
- [ ] `pnpm lint && pnpm build` 통과.
- [ ] `pnpm test:cov` 통과하며 **line ≥ 80% AND function ≥ 80%** (jest `coverageThreshold.global` 강제). 신규 helper 가 coverage 측정 대상이 되어 `resolve-jwt-secret.ts` 가 텍스트 summary 에 line/branch 100% 로 등장함을 확인 (blind spot 해소 — audit §2(c) 목표).
- [ ] tester 가 `pnpm lint && pnpm build && pnpm test:cov` 실행 결과를 TESTER trail 에 박제 (R-110).

## Out of Scope

- `package.json` 의 `coveragePathIgnorePatterns` 패턴 자체 수정 — 정책 변경(audit P4)이라 본 task 아님. helper **분리만**으로 측정 대상화한다.
- `coverageThreshold.global` 의 branch/statement floor 상향 — audit P4 권고, 별도 task/ADR(CI 정책 변경).
- ConfigModule + Joi schema 등 boot 단계 env 검증 layer 도입 (auth.module L28 의 T-0087 candidate) — 본 task 는 `?? ""` fallback 의 helper 추출 + coverage 측정화만. 검증 정책 변경 없음.
- AuthModule 의 다른 provider/export/import(PassportModule·UserModule·forwardRef·JwtStrategy 등) 변경 — 무관.
- mutation testing(audit P5) 도입 — 새 dependency, §5 게이트.

## Suggested Sub-agents

`implementer → tester`

- implementer: helper 추출(`resolve-jwt-secret.ts`) + auth.module.ts 호출부 교체. ADR 신규 결정 없음(기존 ADR-0008 §5 contract 그대로 helper 로 이전)이라 architect 불요.
- tester: colocated `resolve-jwt-secret.spec.ts` 작성(R-112 4종 + negative cases 충분 cover) + `pnpm lint && pnpm build && pnpm test:cov` 실행 + helper coverage 측정 대상 등장 확인.
- spec 위치 ordering: **colocated 우선** — `src/auth/resolve-jwt-secret.spec.ts` (NestJS convention + module boundary 명확). 공유 mock 불요(순수 함수)라 helper fallback 불요.

## Follow-ups

(없음 — 본 task 로 audit backlog P1~P3 dependency-free 강화 backlog 가 소진. 잔여 P4 branch floor 상향·P5 mutation testing 은 §5/ADR 게이트로 별도.)
