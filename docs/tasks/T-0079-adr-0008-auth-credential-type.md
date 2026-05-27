---
id: T-0079
title: ADR-0008 신설 — Auth credential type 결정 박제 (JWT vs session cookie)
phase: P3
status: PENDING
commitMode: pr
coversReq: [REQ-043, REQ-044, REQ-045, REQ-046]
estimatedDiff: 320
estimatedFiles: 1
created: 2026-05-28
sizeExempt: true
exemptReason: doc-only enumerated-section NEW-doc 카테고리 (multiplier × 1.6) — base ~200 LOC × 1.6 = 320 LOC envelope. ADR 4 section 정공법 (Context / Decision / Consequences / Alternatives) + REQ mapping 표 + 후속 ADR-first split chain 박제 + 후속 task 목록 박제 가 자연 필요. T-0063 / T-0076 NEW-doc precedent (각 +119/+200 LOC 박제) 와 동일 카테고리, cap 초과는 ADR scope 박제 의 자연 결과 — split 시 ADR 의 의사결정 일관성 손상.
plannerNote: cap-bend pre-justified — doc-only NEW-doc × 1.6 = 320 LOC, T-0063/T-0076 precedent 동일 카테고리. ADR-0008 신설로 P4 binding-decision 박제 entry (p3-to-p4-transition.md §4.1 권장), 신규 dep install 0 — Decision 본문은 라이브러리 선택 박제만, 실 install 은 후속 T-0080+ implementer task chain.
---

# T-0079 — ADR-0008 신설 (Auth credential type 결정 박제)

## Why

[docs/architecture/p3-to-p4-transition.md §4.1](../architecture/p3-to-p4-transition.md) — session #22 turn 1 (T-0075 머지 직후) refresh 에서 **P4 진입 binding-decision 권장 강화** 박제. entity backbone 5/11 → 8/11 (Group + Part CRUD-U 4-layer fully closed) 완성 후 잔여 P3 backbone ~5~6 task 중 **첫 task** = User entity + AuthModule + ADR-0008 신설 chain 의 진입.

[docs/architecture/api.md L23](../architecture/api.md) Auth credential 행이 "P3 AuthModule 도입 task 의 ADR 에서 택일" 명시 — **session cookie 또는 Bearer JWT** 중 택일 의무, 본 ADR 이 그 택일 박제. [docs/architecture/p3-to-p4-transition.md §2.3 ADR-0008 row](../architecture/p3-to-p4-transition.md) — "P3 진행 중 우선" 트리거 시점 도달. README L80 (REQ-043 인증) + L83–86 (REQ-044~046 RBAC) 의 backbone prerequisite.

본 task scope = **ADR 신설 1 파일만** (결정 박제 only). 실 NestJS AuthModule scaffold / User entity Prisma 박제 / `@nestjs/jwt` install 등은 본 ADR 의 Decision 본문에 후속 task chain 으로 박제 — 본 task 안에서 신규 dep 추가 0, BLOCKED risk = 0.

[CLAUDE.md §3.1](../../CLAUDE.md) pr-mode 정합 — ADR 신설은 pr-column (architecture 결정은 reviewer 점검 대상). [CLAUDE.md §5](../../CLAUDE.md) HITL 정합 — 본 task 안에서 new-dep 발화 0 (Decision 본문은 라이브러리 선택 박제만, install 은 후속).

## Required Reading

- [docs/architecture/api.md §2](../architecture/api.md) L15–25 — Auth credential row ("session cookie 또는 Bearer JWT 중 P3 AuthModule 도입 task 의 ADR 에서 택일"), 본 ADR 의 직접 source.
- [docs/architecture/api.md §3](../architecture/api.md) L26–37 — Auth tier 4 등급 (Public / User / Admin / SuperAdmin) + escalation 의미.
- [docs/architecture/api.md §4](../architecture/api.md) L39–53 — `/api/auth` + `/api/users` + `/api/me` prefix 및 책임 module 매핑.
- [docs/architecture/p3-to-p4-transition.md §2.3](../architecture/p3-to-p4-transition.md) — ADR-0008 row (트리거 시점 "P3 진행 중 우선", 신설 사유).
- [docs/architecture/p3-to-p4-transition.md §4.1](../architecture/p3-to-p4-transition.md) — session #22 binding-decision 권장 강화 박제.
- [docs/decisions/ADR-0003-deployment.md §2](../decisions/ADR-0003-deployment.md) — JWT/session secret 환경변수 박제 (배포 환경 측 박제 source).
- [docs/architecture/modules.md](../architecture/modules.md) — AuthModule row (책임 + dependency).
- [README.md](../../README.md) L80–86 — REQ-043~046 (인증 / RBAC) source of truth.
- [docs/decisions/ADR-0004-smoke-e2e-db-mode.md](../decisions/ADR-0004-smoke-e2e-db-mode.md) — ADR-first split 4-stage chain 의 NEW-doc precedent (Context / Decision / Consequences / Alternatives 4 section 정공법 형식 박제).
- [docs/decisions/ADR-0005-mcp-tools-for-pr-review-flow.md](../decisions/ADR-0005-mcp-tools-for-pr-review-flow.md) — 가장 최근 ACCEPTED ADR (format / depth / Refs trailer 패턴 박제).

## Acceptance Criteria

### A. ADR-0008 파일 신설 (`docs/decisions/ADR-0008-auth-credential-type.md`)

- [ ] frontmatter 박제 — `id: ADR-0008` / `title` (Auth credential type 결정 — JWT vs session cookie 택일) / `status: ACCEPTED` / `date: 2026-05-28` / `relatedTask: T-0079` / `supersedes: null` / `amendments: []`.
- [ ] `# ADR-0008 — Auth credential type 결정 박제` heading.

### B. Context 단락

- [ ] P3 AuthModule 진입 prerequisite 박제 — api.md §2 의 "택일" 의무 source 명시.
- [ ] REQ-043 (인증) + REQ-044~046 (RBAC 3 등급 + SuperAdmin) 박제 — 본 결정이 cover 하는 README 행 명시.
- [ ] P3 진척 status quo 박제 — entity backbone 8/11 (T-0075 closure 시점) + AuthModule 미박제 사실 + ADR-0008 트리거 시점 ("P3 진행 중 우선") 박제.
- [ ] 시스템 deployment 환경 박제 — ADR-0003 §2 의 JWT/session secret 환경변수 박제 + monolithic process 1 개 + HTTPS-only.

### C. Decision 단락 (택일 박제)

- [ ] **택일 결정 박제** — JWT (Bearer) vs session cookie 중 1 개 명시 선택. 본 ADR 작성 시점 (architect dispatch) 의 의사결정.
- [ ] 결정 근거 박제 — 다음 4 차원 평가 박제: (i) NestJS 생태계 정합 (`@nestjs/jwt` / `@nestjs/passport` 표준), (ii) horizontal scaling 친화 (stateless vs server-side session store), (iii) frontend 정합 (P6 web UI 의 storage 패턴), (iv) revocation / logout invariant (REQ-044 self-demote 차단 invariant 와의 정합).
- [ ] 라이브러리 채택 박제 (실 install 은 후속 task) — 채택 결정 박제만 (예: `@nestjs/jwt` + `passport-jwt` + `@nestjs/passport`). 실 `package.json` 변경 0, `pnpm add` 0 — 본 task scope 외 명시.
- [ ] Token / cookie 파라미터 박제 — access token TTL (예: 15min) + refresh token TTL (예: 7day) + signing algorithm (예: RS256 또는 HS256) + cookie attributes (HttpOnly / Secure / SameSite) 중 결정 사항.
- [ ] Secret 관리 박제 — 환경변수 이름 (`AUTH_JWT_SECRET` 또는 `AUTH_SESSION_SECRET`) + key rotation 정책 + dev/prod 분리.

### D. Consequences 단락

- [ ] 본 결정의 후속 영향 박제 — 3+ bullet (예: AuthModule 구조 / 미들웨어 / RBAC guard 구현 패턴 / token storage / logout invariant).
- [ ] **후속 task chain 박제** — ADR-first split 4-stage pattern (T-0051 → T-0054 precedent) 재사용: (i) T-0080 candidate — User entity + Prisma model + repository, (ii) T-0081 candidate — `@nestjs/jwt` + `passport-jwt` 실 install + AuthModule scaffold (BLOCKED risk: 새 dep 발화 — 본 ADR 박제 후 install 만 trigger), (iii) T-0082 candidate — login / logout / refresh endpoint + RBAC guard, (iv) T-0083 candidate — RBAC self-demote invariant + 401/403 error shape (api.md §7 error shape 정합).
- [ ] STATE.phase 변경 0 박제 — 본 ADR 머지 후에도 P3-in-progress 유지 (옵션 (c) hybrid-parallel 정의 정합).
- [ ] api.md amend 후속 후보 박제 — §2 Auth credential 행 "택일" → 본 ADR 의 결정값으로 박제 (별도 doc-only direct follow-up task).

### E. Alternatives 단락

- [ ] 검토 대상 1 — JWT (Bearer header) 의 trade-off 박제 (장: stateless / scaling 친화 / mobile 정합 / 단: revocation 비용 / size).
- [ ] 검토 대상 2 — session cookie 의 trade-off 박제 (장: server-side revocation 자유 / 표준 패턴 / 단: scaling 시 session store 필요 / CSRF 보호 추가).
- [ ] 검토 대상 3 — OAuth/OIDC 외부 위임 의 박제 + reject 사유 (예: 내부 자격증명 backbone 요구 — REQ-043 self-contained 인증 + 사내 환경 외부 IdP 의존 거부).
- [ ] 검토 대상 4 (선택) — hybrid (JWT in HttpOnly cookie) 박제 + 채택 / 거부 사유.

### F. Refs trailer

- [ ] Refs trailer 박제 — `Refs: T-0079, ADR-0003, ADR-0004` (관련 ADR + 본 task).

### G. R-110~R-113 의무 (pr-mode 정합)

- [ ] **R-110 tester 의무** — production code 변경 0 LOC 이어도 (ADR doc 신설만), tester 가 `pnpm lint && pnpm build && pnpm test:cov` 통과 확인. (CI 자동 실행 결과 검증 — Acceptance Criteria 의 ci-green 게이트 충족 path.)
- [ ] **R-111 CI 검증** — push 후 GitHub Actions all green (lint / build / unit / smoke / e2e / coverage / reviewer-approval check 7 step 모두 success).
- [ ] **R-112 unit test** — doc-only 변경 (production code 0 LOC, public symbol 신설 0) 이라 happy / error / branch / negative case test 추가 의무 0. 본 항목 명시적으로 생략 표기 ("ADR doc-only 신설 — public symbol 신설 0, R-112 4 카테고리 cover 의무 본 task scope 외 — 후속 T-0080~T-0083 task 가 cover").
- [ ] **R-113 smoke/e2e** — 변경 없음 (기존 smoke/e2e 7 step CI 그대로 통과). spec presence check 통과 (ADR 신설은 source code 신설 0).
- [ ] **Coverage 임계 유지** — `pnpm test:cov` 의 line ≥ 80% / function ≥ 80% 유지 (production code 변경 0 이라 자연 통과).

### H. 트레이서빌리티

- [ ] T-0079 task 파일 frontmatter status=DONE + actualDiff/actualFiles/completedAt/mergedAs<SHA> 박제 (driver 가 머지 후).
- [ ] PR-NN 머지 후 STATE.json bookkeeping (counters.tasksCompleted 77→78 / mostRecentTasks prepend T-0079 / lastCommit / lastActivity).
- [ ] journal entry 박제 (driver 책임, 본 task 머지 후).

## Out of Scope

- **User entity Prisma model 신설** — 후속 T-0080 candidate.
- **`@nestjs/jwt` / `passport-jwt` install** — 후속 T-0081 candidate (new-dep 발화 → BLOCKED → 사용자 승인 → ADR 박제 의 install 만 trigger).
- **AuthModule NestJS scaffold (`AuthService`, `AuthController`, `JwtStrategy`, `RolesGuard`)** — 후속 T-0081/T-0082 candidate.
- **login / logout / refresh endpoint 구현** — 후속 T-0082 candidate.
- **RBAC self-demote invariant 구현** — 후속 T-0083 candidate.
- **api.md §2 amend (택일 → 결정값 박제)** — 본 task 머지 후 별도 doc-only direct follow-up task (envelope ~30 LOC).
- **STATE.phase P3-in-progress → P4-in-progress 전환** — 본 ADR 머지 후에도 STATE.phase 변경 0 (옵션 (c) hybrid-parallel 정의 정합, p3-to-p4-transition.md §4.1 박제).
- **반대 옵션의 detailed implementation note** — Alternatives 단락은 reject 사유 박제만 / 채택 옵션의 implementation note 는 Decision 단락만.

## Suggested Sub-agents

`architect → reviewer` (executor 가 chain).

- **architect** — ADR-0008 신설 본문 작성 (Context / Decision / Consequences / Alternatives 4 단락 + REQ mapping + 후속 task chain 박제). 단 본 task 안에서 새 dep install 0 — Decision 본문의 라이브러리 채택은 박제만 (실 install 은 후속 T-0081).
- **reviewer** — PR diff 검토 (README 117–128 의 8 check). 본 ADR 신설의 정합 (api.md / modules.md / ADR-0003 / 후속 task chain 박제 일관성) 검증.
- **tester** — `pnpm lint && pnpm build && pnpm test:cov` 통과 확인 (production code 0 LOC 이어도 R-110 의무). public symbol 신설 0 — R-112 4 카테고리 cover 본 task scope 외 ("후속 T-0080~T-0083 cover" 명시).

## Follow-ups

(빈 상태로 시작 — 후속 task chain 은 ADR Decision 본문 §D "후속 task chain 박제" 단락 에 박제되며, 본 task 의 머지 후 planner 가 T-0080+ chain 으로 dispatch.)
