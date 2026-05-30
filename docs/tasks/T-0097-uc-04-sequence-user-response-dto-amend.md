---
id: T-0097
title: UC-04 §5 sequence + §8 postconditions amend — UserResponseDto 응답 매핑 박제 (T-0095/T-0096 use-case layer 정합)
phase: P3
status: DONE
commitMode: direct
coversReq: [REQ-043, REQ-044]
estimatedDiff: 25
estimatedFiles: 1
created: 2026-05-29
completedAt: 2026-05-30T09:30:00+09:00
actualDiff: 4
actualFiles: 1
dependsOn: [T-0095, T-0096]
plannerNote: "cron (KST 2026-05-29 evening) planner — T-0095 UserResponseDto + T-0096 api.md/modules.md 머지 후 UC-04 use-case layer 정합 박제. doc-only inline-amend × 1.6 × 0.4 = × 0.64, ~25 LOC / 1 파일."
driverNote: "loop session #27 turn 1/10 (KST 2026-05-30 09:30, local Windows env, 사용자 `/loop turn cap 10` 신규 진입) — driver inline 경로로 UC-04 §5 sequence + §8 postconditions 직접 amend. §5 L87 응답 step `(성공 = UserResponseDto / 검증 실패 / 권한 부족)` 갱신 + 직후 `Note over BackendAPI: 성공 응답 body = UserResponseDto (5 readonly 필드 id/email/role/createdAt/updatedAt — hashedPassword 응답 누출 차단, T-0095 박제). defence in depth 2 layer: DB bcrypt 10 rounds (T-0092) + HTTP whitelist DTO (T-0095). ADR-0008 §6 application-layer last-mile.` 1 줄 삽입 + §8 postconditions L152 `User row CRUD 완료` bullet 직후 `**응답 layer 의 hashedPassword 누출 차단**` bullet 1 개 삽입. 실 +3/-1 LOC across 1 파일 (envelope 25 의 ×0.16 sub-multiplier — T-0088 ×0.19 / T-0096 ×0.17 정공법 mirror, table row / mermaid Note 2 줄 + bullet 1 줄 inline-amend 패턴 가장 가벼운 doc 변경). C1~C8 grep/inspect self-검증 all PASS: UserResponseDto 3 (≥3) + T-0095 2 (≥2) + hashedPassword 2 (≥2) + defence in depth 2 (≥2) + ADR-0008 §6 2 (≥1) + mermaid block L54 ```mermaid + L55 sequenceDiagram + L90 ``` 정합 유지 + §8 6 bullet (orig 5 + 본 task 1 insert, 기존 4 bullet + NFR 보존) + diff 1 파일 한정. architecture spec → use-case spec 정합 동기 순서 박제 — T-0096 (api.md/modules.md, 32f8778) 직후 본 task 가 use-case layer 박제. doc-only direct inline-amend 누적 6 회차: T-0084 ×0.37 + T-0088 ×0.19 + T-0089 ×0.91 + T-0093 ×0.23 + T-0096 ×0.17 + 본 T-0097 ×0.16 (estimate-model.md milestone refinement 데이터, ×0.16~0.91 spread — 본 task 가 가장 가벼운 inline-amend 박제). cron env / local env 둘 다 친화 — doc-only direct main commit 은 reviewer/integrator/4-게이트 / CI green / gh CLI 모두 불요."
---

# T-0097 — UC-04 §5 sequence + §8 postconditions amend — UserResponseDto 응답 매핑 박제

## Why

[T-0095](T-0095-user-response-dto-hashed-password-removal.md) (UserResponseDto 신설 + `signup` / `changeRole` 응답 매핑 `Promise<UserResponseDto>` MERGED `d842d35` PR-89) + [T-0096](T-0096-api-md-user-response-shape-amend.md) (api.md L70/L71 row 응답 shape + modules.md L34 UserModule UserResponseDto cross-ref doc-only direct main commit `f582d99`) 머지 후 — **architecture spec layer 의 응답 shape 박제는 closure** (api.md + modules.md), 그러나 **use-case layer ([UC-04](../use-cases/UC-04-account-auth.md)) 의 §5 sequence diagram + §8 postconditions 는 여전히 stale**:

- **UC-04 §5 sequence (L52–L91)** — `BackendAPI-->>WebUI: JSON 응답 (성공 / 검증 실패 / 권한 부족)` 박제 (L87) 가 응답 shape (UserResponseDto 5 readonly 필드 / `hashedPassword` 응답 누출 차단 / defence in depth 2 layer) 박제 0. 실제 구현은 `UserResponseDto.fromEntity(user)` whitelist DTO 응답 — sequence diagram 의 응답 step 박제 stale.
- **UC-04 §8 postconditions (L148–L156)** — "User row CRUD 완료 — PersistenceModule 의 User 테이블에 row 가 insert 또는 update 됨. Password 는 hash 저장 (schema-level 강제)" 박제 (L152) 가 응답 layer 의 attack surface 0 박제 0. **defence in depth 2 layer** (DB-level bcrypt 10 rounds [T-0092 박제] + HTTP-layer UserResponseDto whitelist [T-0095 박제]) 의 use-case 차원 invariant 박제 의무 — `hashedPassword` 응답 누출 차단이 본 UC 의 security 후속 결과 박제.

본 task 는 **use-case layer 정합 박제 doc-only inline-amend** — UC-04 1 파일의 §5 sequence diagram 응답 step + Note + §8 postconditions section 박제. [T-0093](T-0093-api-md-users-signup-row-and-modules-md-amend.md) (× 0.23, api.md L70 POST /api/users row + modules.md L34 UserModule row) + [T-0096](T-0096-api-md-user-response-shape-amend.md) (× 0.64, api.md L70/L71 응답 shape + modules.md L34 UserModule UserResponseDto cross-ref) 정공법 1:1 mirror — architecture spec → use-case spec 정합 동기 순서 박제. doc-only inline-amend 6 회차 누적 (T-0084 × 0.37 + T-0088 × 0.19 + T-0089 × 0.91 + T-0093 × 0.23 + T-0096 × 0.17 + 본 task × 0.64 envelope estimate). cron env (gh CLI 가용성 unknown) BUT doc-only direct main commit 은 reviewer/integrator/4-게이트 / CI green / gh CLI 모두 불요 — graceful 진행.

## Required Reading

- [docs/use-cases/UC-04-account-auth.md](../use-cases/UC-04-account-auth.md) — 본 task 의 amend target 1 (유일 파일). §5 sequence diagram (L52–L91) + §8 postconditions (L148–L156) 2 section.
- [docs/tasks/T-0095-user-response-dto-hashed-password-removal.md](T-0095-user-response-dto-hashed-password-removal.md) — UserResponseDto 박제 source. private constructor + `fromEntity` static factory + 5 readonly 필드 (`id` / `email` / `role` / `createdAt` / `updatedAt`) + `hashedPassword` 응답 누출 차단 박제.
- [docs/tasks/T-0096-api-md-user-response-shape-amend.md](T-0096-api-md-user-response-shape-amend.md) — 직전 architecture spec 정합 박제. api.md L70/L71 + modules.md L34 정합 박제 완결. 본 task 는 use-case spec 정합 박제 (architecture spec → use-case spec 동기 순서).
- [docs/tasks/T-0093-api-md-users-signup-row-and-modules-md-amend.md](T-0093-api-md-users-signup-row-and-modules-md-amend.md) — 정공법 precedent. doc-only inline-amend × 0.23 sub-multiplier MERGED `29eb63b`. 본 task 와 동일 패턴 (architecture / use-case spec layer 정합 동기 후속 박제).
- [src/user/dto/user-response.dto.ts](../../src/user/dto/user-response.dto.ts) — 실 구현 source. UserResponseDto class + `fromEntity` static factory + 5 readonly 필드.
- [docs/architecture/api.md](../architecture/api.md) — T-0096 박제 후 contract source 정합 박제 완결 cross-ref. UC-04 sequence 의 응답 step 박제가 api.md L70/L71 와 1:1 정합 의무.
- [docs/decisions/ADR-0008-auth-credential-type.md §6](../decisions/ADR-0008-auth-credential-type.md) — 후속 chain 박제. T-0095 머지 시점이 §6 application-layer last-mile 완결 박제 — 본 task 가 use-case layer 의 동 박제 반영.
- [CLAUDE.md §3.1](../../CLAUDE.md) — commitMode 정책. docs/use-cases/*.md 단일 파일 inline-amend 는 direct.
- [CLAUDE.md §12](../../CLAUDE.md) — 언어 정책. sequence diagram 본문 한국어 / actor / participant 이름 / METHOD/path enum 영어.
- [docs/architecture/estimate-model.md §4](../architecture/estimate-model.md) — doc-only inline-amend × 1.6 × 0.4 = × 0.64 multiplier. T-0070 / T-0073 / T-0076 / T-0084 / T-0088 / T-0089 / T-0093 / T-0096 박제 8 회차 누적 데이터.

## Acceptance Criteria

분기 없음 — 본 task 는 doc-only inline-amend. R-112 happy/error/branch/negative test 항목 적용 불가. 검증은 grep / 파일 inspect 로.

### A. UC-04 §5 sequence diagram 응답 step + Note 박제

- [ ] [docs/use-cases/UC-04-account-auth.md](../use-cases/UC-04-account-auth.md) §5 sequence diagram (L52–L91) 안 `BackendAPI-->>WebUI: JSON 응답 (성공 / 검증 실패 / 권한 부족)` 박제 (L87 근처) → **`BackendAPI-->>WebUI: JSON 응답 (성공 = UserResponseDto / 검증 실패 / 권한 부족)`** 로 갱신.
- [ ] 같은 sequence diagram 안에 `Note over BackendAPI` step 1 개 추가 — 응답 step 직후 (`BackendAPI-->>WebUI` 와 `WebUI->>Actor` 사이) — 본문: **"성공 응답 body = UserResponseDto (5 readonly 필드 id/email/role/createdAt/updatedAt — hashedPassword 응답 누출 차단, T-0095 박제). defence in depth 2 layer: DB bcrypt 10 rounds (T-0092) + HTTP whitelist DTO (T-0095). ADR-0008 §6 application-layer last-mile."**.

### B. UC-04 §8 postconditions 박제

- [ ] [docs/use-cases/UC-04-account-auth.md](../use-cases/UC-04-account-auth.md) §8 (L148–L156) 의 첫 bullet "User row CRUD 완료 — PersistenceModule 의 User 테이블에 row 가 insert (사용자 추가) 또는 update (등급 변경 / Password 변경) 됨. Password 는 hash 저장 (schema-level 강제, hash 알고리즘은 P3 의 별도 ADR 책임)." 직후 새 bullet 1 개 삽입 — 본문: **"응답 layer 의 hashedPassword 누출 차단 — UserResponseDto (T-0095 박제 — private constructor + fromEntity static factory + 5 readonly 필드 id/email/role/createdAt/updatedAt) 가 HTTP 응답 body 의 whitelist 강제, Prisma User entity 의 hashedPassword 컬럼 응답 누출 0. defence in depth 2 layer 박제 — DB-level bcrypt 10 rounds (T-0092 박제) + HTTP-layer UserResponseDto whitelist (T-0095 박제), ADR-0008 §6 application-layer last-mile 완결 cross-ref."**.

### C. 검증 (grep + 파일 inspect)

- [ ] C1: `grep -c "UserResponseDto" docs/use-cases/UC-04-account-auth.md` ≥ 3 — §5 sequence 응답 step + §5 Note + §8 postconditions 3 곳 박제 검증.
- [ ] C2: `grep -c "T-0095" docs/use-cases/UC-04-account-auth.md` ≥ 2 — §5 Note + §8 postconditions cross-ref 박제 검증.
- [ ] C3: `grep -c "hashedPassword" docs/use-cases/UC-04-account-auth.md` ≥ 2 — 응답 누출 차단 박제 검증 (§5 Note + §8 postconditions 각 1+).
- [ ] C4: `grep -c "defence in depth" docs/use-cases/UC-04-account-auth.md` ≥ 2 — 2 layer security primary intent 박제 검증 (§5 Note + §8 postconditions 각 1+).
- [ ] C5: `grep -c "ADR-0008 §6" docs/use-cases/UC-04-account-auth.md` ≥ 1 — application-layer last-mile cross-ref 박제 검증.
- [ ] C6: mermaid sequence diagram syntax 깨짐 없음 — `grep -n "sequenceDiagram" docs/use-cases/UC-04-account-auth.md` 으로 시작 정합 + ` ``` ` (3 backtick) close fence 정합 + L87 응답 step 박제 후에도 mermaid block 의 정합 유지 (mermaid render 시 syntax error 0 의무).
- [ ] C7: §8 postconditions 의 기존 4 bullet (User row CRUD / 등급 변경 즉시 발효 / 첫 로긴 SuperAdmin / Audit log) + NFR 1 줄 박제는 모두 유지, 본 task 가 1 bullet 만 삽입 (User row CRUD bullet 직후) — 기존 bullet 삭제 / 순서 변경 0.
- [ ] C8: 본 commit 의 diff 가 `docs/use-cases/UC-04-account-auth.md` 1 파일에만 한정. 그 외 파일 (`src/*` / `test/*` / `docs/architecture/*` / `docs/decisions/*` 등) 변경 0 — direct main commit scope 박제.

### D. STATE / journal / commit

- [ ] [docs/STATE.json](../STATE.json): `currentTask` → null, `mostRecentTasks` prepend `"T-0097"` (cap 5), `counters.tasksCompleted` +1 (read-modify-write — `git fetch origin main` 직후 base 값 +1, 현 base 95 → 96), `lastCommit` → 본 commit sha, `lastActivity` → 본 ISO. `lock` 해제 (`holder: ""`, `since: ""`).
- [ ] 본 task 파일 frontmatter `status: DONE` + `completedAt` + `actualDiff` + `actualFiles` + `driverNote` 박제.
- [ ] [docs/progress/journal-2026-05-29.md](../progress/journal-2026-05-29.md) 에 1~5 줄 append — 본 task 의 amend 결과 + multiplier variance + cross-ref.
- [ ] Direct main commit — feature branch 0, PR 0, reviewer/integrator 4-게이트 0 (doc-only direct, [CLAUDE.md §3.1](../../CLAUDE.md) 분기 정합).
- [ ] Commit message subject (한국어 본문 + 영어 prefix): `docs(use-cases): T-0097 UC-04 §5 sequence + §8 postconditions UserResponseDto 응답 매핑 amend — T-0095/T-0096 use-case layer 정합 (T-0097)`.
- [ ] Commit message body 에 trail blob 박제 ([CLAUDE.md §11](../../CLAUDE.md) 표준 포맷) — PLANNER / IMPLEMENTER / ACCEPTANCE section. trail 헤더/키 영어 / 값 한국어.

## Out of Scope

- **다른 UC 파일 정합 박제** — UC-01 ~ UC-08 의 다른 use case 파일은 본 task scope 아님. 별도 task (필요 시 — 본 보안 risk fix 가 UC-04 외 use case 에 영향 없음).
- **api.md / modules.md 2 차 amend** — T-0096 이 이미 박제, 본 task 는 use-case spec 만.
- **GET /api/users list endpoint + fromEntities 배열 helper** — 별도 task chain.
- **ClassSerializerInterceptor ADR 박제** — 별도 ADR + task.
- **다른 entity ResponseDto 일반화** — Person / Group / Part 도메인 별 ResponseDto chain. 별도 task chain.
- **Prisma select projection — DB query 시점 hashedPassword 컬럼 자체 제외** — defence in depth 추가 layer (3 번째 layer) — 별도 task / ADR.
- **POST /api/users RBAC 강화 ADR** — Public → Admin+ 또는 분리 endpoint `/api/auth/setup` 박제. 별도 ADR + task.
- **RefreshToken DB table + revocation path** — ADR-0008 §6 후속 chain. 별도 task (architect=1 — schema 결정 layer).
- **signup → login round-trip e2e** — POST /api/users + POST /api/auth/login + GET /api/auth/me 의 e2e. 별도 task.
- **UC-04 §6 ~ §7 alternative / error flow 의 UserResponseDto 박제** — 본 task 는 §5 sequence + §8 postconditions 만. §6 ~ §7 박제는 현 시점 변경 0 (alt / error flow 는 응답 shape 변경 영향 없음 — 실패 응답은 별도 NestJS HttpException JSON 박제).
- **estimate-model.md milestone refinement** — 본 task 의 doc-only inline-amend × 0.64 multiplier variance 데이터 누적 박제 (T-0070 / T-0073 / T-0076 / T-0084 / T-0088 / T-0089 / T-0093 / T-0096 / 본 task 9 회차) 는 별도 task 책임.

## Suggested Sub-agents

`implementer → tester` 만 (doc-only direct). tester 는 변경 0 — direct doc commit 은 R-110 ~ R-114 면제 (production code 0). 단 driver 가 C1~C8 grep / inspect 자체 검증.

architect=0, reviewer=0, integrator=0 (direct main commit).

driver inline 경로 (executor sub-agent dispatch 없이 driver 가 직접 doc edit + grep C1~C8 검증) 도 정합 — T-0093 / T-0096 driver inline 패턴 1:1 mirror. cron env (gh CLI 가용성 unknown) 친화 — doc-only direct main commit 은 gh CLI 불요.

## Follow-ups

- **GET /api/users list endpoint 박제** — UserResponseDto.fromEntities 배열 helper + UserController.list + pagination. 별도 task.
- **ClassSerializerInterceptor 도입 ADR** — class-transformer 기반 nest-wide response serialization trade-off. 별도 ADR + task.
- **다른 entity ResponseDto 일반화** — Person / Group / Part 도메인 별 ResponseDto chain. 별도 task chain.
- **Prisma select projection 박제** — DB query 시점 hashedPassword 컬럼 자체 제외 (defence in depth 추가 layer). 별도 task / ADR.
- **POST /api/users RBAC 강화 ADR** — 첫 user 후 endpoint 를 Admin+ 격상 또는 분리 endpoint `/api/auth/setup` 박제. 별도 ADR + task.
- **RefreshToken DB table + revocation** — ADR-0008 §6 박제 후속 chain. 별도 task (architect=1).
- **signup → login round-trip e2e** — POST /api/users + POST /api/auth/login + GET /api/auth/me 의 e2e. 별도 task.
- **UC-04 §6 / §7 의 UserResponseDto cross-ref** — alternative / error flow 의 응답 shape 박제 — 현 시점 영향 없음 (실패 응답 별도 HttpException JSON). 향후 검토 시 별도 doc-only direct task.
- **estimate-model.md milestone refinement** — 본 task 의 doc-only inline-amend × 0.64 multiplier variance 누적 데이터 박제 (9 회차 누적). 별도 task.
