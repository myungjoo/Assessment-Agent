---
id: T-0097
title: UC-04 §5 sequence diagram amend — P3 구현 박제 동기 (countAll 분기 + bcrypt + UserResponseDto + forwardRef cycle)
phase: P3
status: PENDING
commitMode: direct
coversReq: [REQ-043, REQ-044]
estimatedDiff: 25
estimatedFiles: 1
dependsOn: [T-0092, T-0095, T-0096]
created: 2026-05-29
plannerNote: P3 RBAC backbone last-mile 박제 완결 후 UC-04 §5 sequence diagram 의 P3 구현 contract 동기 — doc-only inline-amend × 0.4
---

# T-0097 — UC-04 §5 sequence diagram amend — P3 구현 박제 동기

## Why

[UC-04](../use-cases/UC-04-account-auth.md) §5 sequence diagram 은 P2 use case 분해 단계 (T-0024) 의 conceptual level 산출물이다. 이후 P3 의 RBAC backbone chain (T-0083 scaffold → T-0086 service → T-0087 controller → T-0092 signup → T-0095 UserResponseDto) 4/4 closed 후 다음 핵심 contract 가 박제되었으나 §5 sequence 와의 sync 가 없다:

- **countAll === 0 → SuperAdmin 자동 분기** (T-0092 박제, REQ-044) — UC-04 §6.1 의 "User 테이블 비어 있음 감지" 가 P3 의 `UserRepository.countAll() === 0` 분기로 구체화.
- **bcrypt 10 rounds hash** (T-0092 박제, ADR-0008 §6) — UC-04 §5 의 "Password 는 hash 저장 (schema-level 강제)" 가 P3 의 `bcrypt.hash(password, 10)` application-layer 로 구체화.
- **UserResponseDto 응답 shape** (T-0095 박제) — UC-04 §5 step "JSON 응답" 이 P3 의 `UserResponseDto.fromEntity` 5 readonly 필드 (id/email/role/createdAt/updatedAt) + hashedPassword 응답 차단 + defence in depth 2 layer 로 구체화.
- **AuthService inject via forwardRef** (T-0092 박제) — UC-04 §5 의 `BackendAPI → AuthModule` step 이 P3 의 `AuthModule ↔ UserModule forwardRef` cycle 해결 path 로 구체화.

본 task 는 UC-04 §5 sequence diagram 의 mermaid block 안에 위 4 항목을 **Note over** 형식으로 inline 박제 + §8 Postconditions 에 응답 shape (UserResponseDto) cross-ref 추가 + §11 References 에 P3 머지된 T-0083/T-0086/T-0087/T-0092/T-0095/T-0096 task ID 6 개 + ADR-0008 §6 cross-ref 추가. T-0093 (api.md L70 POST /api/users row + modules.md L34 UserModule 책임 description) + T-0088 (api.md PATCH row + modules.md UserModule) + T-0096 (api.md L70/L71 응답 shape + modules.md UserResponseDto) 3 회차 누적된 P3 머지 후 contract source 정합 동기 패턴 4 회차 박제.

본 task 의 envelope ~25 LOC / 1 파일 — doc-only direct inline-amend × 0.4 sub-multiplier (T-0070 ×0.37 + T-0073 ×0.04 + T-0076 ×0.13 + T-0093 ×0.23 + T-0096 ×0.17 precedent 5 회차 누적 정합, in-place sequence note + reference section append 패턴).

## Required Reading

- `docs/use-cases/UC-04-account-auth.md` — 본 task 의 amend 대상 (§5 sequence diagram + §6.1 첫 로긴 자동 지정 + §8 Postconditions + §11 References).
- `docs/decisions/ADR-0008-auth-credential-type.md` — §6 application-layer last-mile 박제 sub-section (T-0089 박제) cross-ref source.
- `docs/architecture/api.md` — L70 POST /api/users row + L71 PATCH /api/users/:id/role row 응답 shape (T-0093, T-0096 박제) — UC-04 §5 의 BackendAPI step contract source 정합 sanity check.
- `docs/tasks/T-0092-signup-endpoint.md` — countAll → SuperAdmin/User 분기 + bcrypt 10 rounds + P2002 → ConflictException + forwardRef cycle 박제 source.
- `docs/tasks/T-0095-user-response-dto-hashed-password-removal.md` — UserResponseDto 5 readonly 필드 + fromEntity static factory + 응답 shape + defence in depth 2 layer 박제 source.

## Acceptance Criteria

A. **§5 sequence diagram amend (mermaid block 안 Note over inline)** — 4 항목 박제:
  - [ ] `BackendAPI → UserModule: createUser / setUserRole / setUserPassword (payload)` step 의 `Note over UserModule` 본문 안에 "P3 박제: countAll === 0 → SuperAdmin 자동 분기 (T-0092 / REQ-044), 그 외 User default" 1 줄 추가.
  - [ ] `UserModule → PersistenceModule: User row CRUD (Password 는 hash 저장 — schema-level 강제)` step 의 description 안 또는 직후 `Note over` 에 "P3 박제: bcrypt.hash(password, 10) application-layer + DB-level bcrypt 정합 (T-0092 / ADR-0008 §6)" 1 줄 추가.
  - [ ] `UserModule -->> BackendAPI: result + audit metadata` step 또는 `BackendAPI -->> WebUI: JSON 응답 (성공 / 검증 실패 / 권한 부족)` step 의 `Note over` 또는 description 안에 "P3 박제: 응답 shape = UserResponseDto (id/email/role/createdAt/updatedAt — hashedPassword 차단, T-0095 / T-0096)" 1 줄 추가.
  - [ ] `BackendAPI → AuthModule: 인증 검증 (REQ-043)` step 또는 직전 `participant` 선언 직후 `Note over AuthModule` 에 "P3 박제: AuthService inject via forwardRef (AuthModule↔UserModule circular 해결, T-0092)" 1 줄 추가.

B. **§8 Postconditions amend** — 첫 번째 bullet "User row CRUD 완료" 의 부연 또는 별도 bullet 1 개 추가 (Password 는 hash 저장 → schema-level 강제) bullet 다음에 "응답 shape — `UserResponseDto.fromEntity` 5 readonly 필드 (id/email/role/createdAt/updatedAt). hashedPassword 응답 차단 (T-0095, T-0096) + defence in depth 2 layer (DB-level bcrypt 10 rounds + HTTP-layer UserResponseDto whitelist)."

C. **§11 References amend** — 본 task 가 P3 박제와의 sync source 라는 점을 박제. References 섹션 마지막 bullet (T-0024) 다음 또는 별도 bullet 로 추가:
  - [ ] "[docs/decisions/ADR-0008-auth-credential-type.md](../decisions/ADR-0008-auth-credential-type.md) §6 — application-layer last-mile (bcrypt 10 rounds + cookie attributes HttpOnly+Secure+SameSite=Strict+Path=/ + TTL access 15m / refresh 7d) 박제." cross-ref.
  - [ ] "[docs/tasks/T-0083](../tasks/T-0083-rbac-auth-guard-roles-decorator.md) / [T-0086](../tasks/T-0086-user-service-change-role-self-demote-invariant.md) / [T-0087](../tasks/T-0087-user-controller-change-role-endpoint.md) / [T-0092](../tasks/T-0092-signup-endpoint.md) / [T-0095](../tasks/T-0095-user-response-dto-hashed-password-removal.md) / [T-0096](../tasks/T-0096-api-md-user-response-shape-amend.md) — P3 RBAC backbone chain 4/4 + UserResponseDto + contract source 정합 박제." cross-ref.
  - [ ] Refs 줄 (L197) 의 task ID 리스트에 T-0083, T-0086, T-0087, T-0092, T-0095, T-0096, T-0097 7 개 + ADR-0008 1 개 추가.

D. **D1~D6 grep / inspect 자체 검증** — driver 가 commit 전 다음 모두 PASS 검증:
  - [ ] D1: `grep -c "countAll" docs/use-cases/UC-04-account-auth.md` ≥ 1 (P3 박제 §5 amend).
  - [ ] D2: `grep -c "bcrypt" docs/use-cases/UC-04-account-auth.md` ≥ 1 (P3 박제 §5 amend).
  - [ ] D3: `grep -c "UserResponseDto" docs/use-cases/UC-04-account-auth.md` ≥ 2 (§5 sequence + §8 Postcondition).
  - [ ] D4: `grep -c "forwardRef" docs/use-cases/UC-04-account-auth.md` ≥ 1 (P3 박제 §5 amend).
  - [ ] D5: `grep -c "T-0092\|T-0095\|T-0096" docs/use-cases/UC-04-account-auth.md` ≥ 4 (§5 inline + §8 + §11 References + Refs).
  - [ ] D6: `git diff --stat docs/` 의 변경 파일 = `docs/use-cases/UC-04-account-auth.md` 단일 — src/ test/ 변경 0.

E. **STATE / journal / commit 박제** — direct main commit 후 STATE.lastCommit 갱신 + counters.tasksCompleted 95→96 + mostRecentTasks prepend T-0097 (cap 5 = [T-0097, T-0096, T-0095, T-0094, T-0093]) + journal 한 줄 append.

## Out of Scope

- **UC-04 §6.1 첫 로긴 alt flow 의 race condition 분기 상세화** (두 사용자 동시 첫 로긴 → 둘 다 SuperAdmin 지정 race) — UC-04 §6.1 본문이 이미 "service layer 책임 (Out of Scope)" 박제, 본 task 에서 별도 상세화 안 함. follow-up task.
- **UC-04 §7.1 인증 실패 — JWT refresh flow 박제** — UC-04 §7.1 본문이 "session / JWT 검증 실패" 단일 표현, refresh flow 의 cookie attributes + TTL 박제는 ADR-0008 §3 의 책임. 본 task 에서 별도 박제 안 함.
- **UC-04 §6.4 본인 Password 변경 endpoint 의 실제 P3 구현** — P3 박제 0 (PATCH /api/users/:id/password 미구현). 본 task 에서 별도 sequence amend 안 함. follow-up task (별도 endpoint task + UC-04 amend chain).
- **UC-04 §7.3 payload 검증 실패 — Password 강도 정책 상세화** — UC-04 본문이 "강도 부족" conceptual level 만 명시, T-0092 의 AddUserDto.@MinLength(8) 단일 박제. 별도 정책 상세화는 후속 ADR (password 정책 ADR) 의 책임.
- **api.md / modules.md amend** — T-0096 (UserResponseDto cross-ref 박제) 이미 완료. 본 task 는 UC-04 단일 파일 amend only.
- **data-model.md / directory.md amend** — Out of Scope. 본 task 가 use case level 박제 한정.
- **mermaid sequence 의 step 개수 증가** — 본 task 는 `Note over` inline 추가만, sequence step 자체는 변동 0 (기존 11 step 유지).
- **§9 Component / Module mapping table amend** — module 책임 description 은 modules.md L34 의 source 가 이미 박제 (T-0088 + T-0096 cross-ref). UC-04 §9 table 은 conceptual level 유지.
- **ClassSerializerInterceptor ADR 신설** — follow-up task (별도 ADR pr-mode).
- **fromEntities 배열 helper + GET /api/users list endpoint** — follow-up task (T-0099 후보, pr-mode partial-backbone × 1.3).
- **RefreshToken DB table + revocation 박제** — follow-up task (T-0098 후보, pr-mode R-112 backbone × 1.5 × P2002 × 1.2 = × 1.8).
- **POST /api/users RBAC 강화 ADR** — follow-up task (direct ADR amend 또는 신설 pr ADR).
- **signup → login round-trip e2e** — follow-up task (pr-mode test-only 1 파일).

## Suggested Sub-agents

`driver inline` — task envelope 25 LOC / 1 파일 / direct main commit. T-0093 (× 0.23) + T-0096 (× 0.17) 패턴 1:1 mirror. driver 가 직접 `UC-04-account-auth.md` 의 §5 mermaid block 안 Note over 추가 + §8 Postcondition bullet 추가 + §11 References + Refs 갱신 + grep D1~D6 self-검증 후 single direct commit. executor sub-agent dispatch 불요 (doc-only direct + envelope 안 + cron env 친화).

## Follow-ups

(빈 상태 — sub-agent / driver 가 작업 중 발견한 follow-up 을 본 섹션에 append)
