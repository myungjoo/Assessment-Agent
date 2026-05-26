---
id: T-0058
title: p3-implementation-plan.md §2/§3/§6 sync — T-0045 ~ T-0057 row 13 추가 + 진척 progress 갱신 (doc-only direct)
phase: P3
status: PENDING
commitMode: direct
coversReq: [REQ-028, REQ-057, REQ-058]
estimatedDiff: 180
estimatedFiles: 1
created: 2026-05-26
plannerNote: T-0044 머지 후 §2 stale 13 row 누락 (T-0045~T-0057) — doc-only direct, plan §2 표 + §3 mermaid + §6 entity/module progress 갱신, T-0038/T-0040/T-0045 doc-shift 패턴 4회차 reuse.
dependsOn: [T-0057]
blocks: []
hqOrigin: null
humanApprovalGate: false
supersedes: null
plannerSource: docs/STATE.json session #14 turn 3 driver journal 다음 turn 우선순위 (b) "PLAN.md / p3-implementation-plan.md §6 closure 박제 doc-only direct" + docs/tasks/T-0057 §Follow-ups 박제 후보 (p3-plan §2 표 stale 13 row). T-0038/T-0040/T-0045 의 mid-phase doc-shift 패턴 4 회차 — 본 task 가 §2 표 정합성 회복 후 P3 closure 직전 last sync window.
---

# T-0058 — p3-implementation-plan.md §2/§3/§6 sync (T-0045 ~ T-0057 13 row 박제)

## Why

[docs/architecture/p3-implementation-plan.md](../architecture/p3-implementation-plan.md) §2 표는 **T-0044 머지 시점 (2026-05-26 오전)** 의 progress 만 박제하고 있어, 그 후 머지된 **T-0045 ~ T-0057 의 13 task 가 누락** 상태다. 같은 문서 §3 의 mermaid graph 도 T-0044 까지의 12 노드만 표시. §6 의 P3 → P4 전이 조건 progress 숫자 ("entity 5/11", "module 2/5") 도 stale — Group N:M 의 service + controller 두 layer 가 5/5 closure 박제 완료, Part service-layer 박제 완료, ADR-0004 (smoke/e2e DB mode) 신설 완료 등 실제 진척과 doc 의 mismatch 가 누적되어 있다.

본 task 는 [T-0038](T-0038-p3-implementation-plan-task-id-shift.md) / [T-0040](T-0040-data-model-group-part-membership-sync.md) / [T-0045](T-0045-p3-implementation-plan-section-2-sync.md) 가 mid-phase doc-shift 패턴 3 회차로 박제한 절차의 **4 회차 reuse** — `doc-only direct` commitMode, source-of-truth 표 정합성 회복, 후속 backbone task 진입의 reference 정확도 보장. P3 closure 직전 last sync window (P4 phase 진입 전).

본 task 가 박제할 13 신규 row (T-0045 ~ T-0057):

1. **T-0045** — p3-implementation-plan §2 stale 4 row sync (doc-only direct).
2. **T-0046** — PartService + PartController + Part DTO + module wiring (PR-42, 2a314bc).
3. **T-0047** — main.ts ValidationPipe global wire (PR-43).
4. **T-0048** — CI reviewer agent approval 게이트 step (PR-44).
5. **T-0049** — PersonGroupMembership repository (PR-45).
6. **T-0050** — GroupService CRUD service-layer (PR-46).
7. **T-0051** — ADR-0004 smoke/e2e DB mode policy 신설 (PR-47).
8. **T-0052** — CI Postgres services + truncate helper (PR-48).
9. **T-0053** — persons.smoke real PostgreSQL cutover (PR-49).
10. **T-0054** — persons.e2e real PostgreSQL cutover (PR-50).
11. **T-0055** — GroupController + CreateGroupDto CRUD-only 4 endpoint (PR-51).
12. **T-0056** — GroupService N:M membership ops 3 메서드 (PR-52).
13. **T-0057** — GroupController N:M membership 3 endpoint + AddMemberDto (PR-53).

본 13 row 박제로 §2 표가 25 row (T-0033 ~ T-0057) 로 expand, §6 의 progress 가 **entity 5/11 (불변, User/Assessment/Contribution/Summary/LlmProviderConfig/DifficultyMapping/PermissionDeniedRecord 미박제 유지) + module 2/5 (불변, AuthModule/AssessmentModule/LlmModule 미박제) + Group N:M service+controller 5/5 stage closure 추가 박제 + ADR 신설 progress 0/3 → 1/3 (ADR-0004 smoke/e2e DB mode 신설)** 로 갱신. §3 mermaid graph 도 13 신규 노드 + edge 추가.

## Required Reading

본 task 는 doc-only direct. 코드 변경 0. Required Reading 은 § 갱신 대상 source 와 reference task file 13 종.

- [docs/architecture/p3-implementation-plan.md](../architecture/p3-implementation-plan.md) — 본 task 의 단일 갱신 대상. §2 표 (L19~36) / §3 mermaid graph (L46~80) / §4 ADR 후보 list (L94~102) / §6 P3 → P4 전이 progress (L123~150) / §8 References (L172~194) 5 단락 갱신.
- [docs/tasks/T-0045-p3-implementation-plan-section-2-sync.md](T-0045-p3-implementation-plan-section-2-sync.md) — 본 task 의 직전 mid-phase doc-shift 박제 (3 회차). 본 task 가 그 패턴 직접 reuse — 같은 commitMode (direct) / 같은 갱신 대상 단락 구조 / 같은 row append 정책.
- [docs/tasks/T-0046-part-service-controller-dto-backbone.md](T-0046-part-service-controller-dto-backbone.md) — row 1 source.
- [docs/tasks/T-0047-main-ts-global-validation-pipe-wire.md](T-0047-main-ts-global-validation-pipe-wire.md) — row 2 source. (파일 부재 시 git log 의 PR-43 commit message 참조.)
- [docs/tasks/T-0048-ci-reviewer-agent-approval-gate.md](T-0048-ci-reviewer-agent-approval-gate.md) — row 3 source.
- [docs/tasks/T-0049-person-group-membership-repository.md](T-0049-person-group-membership-repository.md) — row 4 source.
- [docs/tasks/T-0050-group-service-crud.md](T-0050-group-service-crud.md) — row 5 source.
- [docs/tasks/T-0051-adr-0004-smoke-e2e-db-mode-policy.md](T-0051-adr-0004-smoke-e2e-db-mode-policy.md) — row 6 source + ADR-0004 신설 progress 갱신 source.
- [docs/tasks/T-0052-ci-postgres-services-and-db-truncate-helper.md](T-0052-ci-postgres-services-and-db-truncate-helper.md) — row 7 source.
- [docs/tasks/T-0053-smoke-persons-real-postgres-cutover.md](T-0053-smoke-persons-real-postgres-cutover.md) — row 8 source.
- [docs/tasks/T-0054-e2e-persons-real-postgres-cutover.md](T-0054-e2e-persons-real-postgres-cutover.md) — row 9 source.
- [docs/tasks/T-0055-group-controller-dto-crud.md](T-0055-group-controller-dto-crud.md) — row 10 source.
- [docs/tasks/T-0056-group-service-nm-membership-ops.md](T-0056-group-service-nm-membership-ops.md) — row 11 source.
- [docs/tasks/T-0057-group-controller-nm-membership-endpoints.md](T-0057-group-controller-nm-membership-endpoints.md) — row 12 source.
- [docs/decisions/ADR-0004-smoke-e2e-db-mode.md](../decisions/ADR-0004-smoke-e2e-db-mode.md) — ADR-0004 ACCEPTED 박제 source (§4 ADR 후보 표 갱신).
- [docs/STATE.json](../STATE.json) — mergeCommit SHA / PR 번호 / completedAt cross-check source (reviewRounds 박제 27~57 row 의 13 신규 row source).
- [CLAUDE.md](../../CLAUDE.md) §3.1 (commitMode direct) / §11 (trail blob — direct commit 도 필수) / §12 (한국어 본문 + 영어 식별자).

## Acceptance Criteria

본 task 는 **doc-only direct** — main 브랜치에 직접 commit + push (PR/reviewer 없음). [CLAUDE.md §3.1](../../CLAUDE.md) 의 doc-only direct mode 적용. 단 [§11 trail blob](../../CLAUDE.md) 의무 (PLANNER + IMPLEMENTER + ACCEPTANCE 섹션 포함) 는 direct commit 도 동일.

**Schema / migration / dependency**: (해당 없음 — doc-only)

- [ ] Code 변경 0 — `src/` / `web/` / `test/` / `prisma/` / `.github/` / `package.json` 전부 unchanged.
- [ ] 새 외부 dependency 0.
- [ ] Migration 추가 0.

**§2 P3 task 시퀀스 표 갱신** (L19~36):

- [ ] **합계 단락 갱신** — "12 T-NNNN task (T-0033 ~ T-0044)" → "**25 T-NNNN task (T-0033 ~ T-0057)**". expand 사유에 (h) T-0045 doc-shift / (i) T-0046 PartService backbone / (j) T-0047 main.ts ValidationPipe wire / (k) T-0048 CI reviewer agent approval 게이트 step / (l) T-0049 PersonGroupMembership repository / (m) T-0050 GroupService CRUD / (n) T-0051 ADR-0004 smoke/e2e DB mode / (o) T-0052 CI Postgres services + truncate helper / (p) T-0053 persons.smoke real PostgreSQL cutover / (q) T-0054 persons.e2e real PostgreSQL cutover / (r) T-0055 GroupController CRUD / (s) T-0056 GroupService N:M ops / (t) T-0057 GroupController N:M endpoint 13 sub-bullet 추가.
- [ ] **신규 13 row 추가** (기존 T-0033 ~ T-0044 12 row 보존) — 각 row 의 9 컬럼 (task ID / 책임 / 대응 PLAN bullet / dependsOn / ADR 필요 여부 / 인간 승인 게이트 / est LOC / 책임 module / status mergeCommit) 박제. mergeCommit SHA 는 STATE.json + git log cross-check.
  - **T-0045** — dependsOn T-0044 / ADR 0 / 게이트 0 / est ~95 / module doc-only / DONE (b1a55e2 etc.).
  - **T-0046** — dependsOn T-0041 / ADR 0 / 게이트 0 / est ~240 / UserModule / DONE (2a314bc, PR-42).
  - **T-0047** — dependsOn T-0046 / ADR 0 / 게이트 0 / est ~80 / UserModule (main.ts) / DONE (?, PR-43).
  - **T-0048** — dependsOn T-0046 / ADR 0 / 게이트 0 / est ~100 / CI (.github/workflows) / DONE (?, PR-44).
  - **T-0049** — dependsOn T-0039 / ADR 0 / 게이트 0 / est ~180 / UserModule / DONE (?, PR-45).
  - **T-0050** — dependsOn T-0049 / ADR 0 / 게이트 0 / est ~280 / UserModule / DONE (?, PR-46).
  - **T-0051** — dependsOn T-0044 / ADR-0004 신설 / 게이트 0 / est ~90 / (doc-only) / DONE (?, PR-47).
  - **T-0052** — dependsOn T-0051 / ADR 0 / 게이트 0 / est ~200 / CI (.github/workflows + test/helpers) / DONE (?, PR-48).
  - **T-0053** — dependsOn T-0052 / ADR 0 / 게이트 0 / est ~200 / test smoke / DONE (888a960, PR-49).
  - **T-0054** — dependsOn T-0053 / ADR 0 / 게이트 0 / est ~220 / test e2e / DONE (2d52128, PR-50).
  - **T-0055** — dependsOn T-0050 / ADR 0 / 게이트 0 / est ~300 / UserModule / DONE (a037a4e, PR-51, reviewRounds=2).
  - **T-0056** — dependsOn T-0050+T-0049 / ADR 0 / 게이트 0 / est ~300 / UserModule / DONE (abb70a7, PR-52).
  - **T-0057** — dependsOn T-0056 / ADR 0 / 게이트 0 / est ~280 / UserModule / DONE (ccd1042, PR-53, reviewRounds=2).
- [ ] **Cap discipline 검산 단락 갱신** — 추가된 13 row 중 cap 위반 (>300 LOC 또는 >5 파일) 의 박제. T-0055 actual ~413 LOC / T-0056 ~545 LOC / T-0057 ~427 LOC 등 cap-bend pattern 박제 (R-112 4 카테고리 의무 + §A 헤더 주석 갱신 의 systematic underestimate 박제 — estimate model 갱신 follow-up 명시).

**§3 의존성 graph (mermaid) 갱신** (L46~80):

- [ ] mermaid graph 의 노드 13 개 추가 — T0045 / T0046 / T0047 / T0048 / T0049 / T0050 / T0051 / T0052 / T0053 / T0054 / T0055 / T0056 / T0057.
- [ ] edge 추가 — T0044 → T0045 / T0041 → T0046 / T0046 → T0047 / T0046 → T0048 / T0039 → T0049 / T0049 → T0050 / T0044 → T0051 / T0051 → T0052 / T0052 → T0053 / T0053 → T0054 / T0050 → T0055 / T0050 → T0056 / T0049 → T0056 / T0056 → T0057.
- [ ] classDef 정책 유지 — root (T0033) / gate (T0033, T0036) classDef 그대로. 신규 노드는 회색 (default) classDef.
- [ ] **graph 해석 단락 갱신** — fan-out hub 재구성 박제 (T-0036 + T-0046 + T-0050 의 3 service-layer hub 박제). cycle 0 검산 단락의 Topological order 13 신규 노드 반영.

**§4 ADR 후보 list 갱신** (L94~102):

- [ ] **ADR-0004 (smoke/e2e DB mode) ACCEPTED 박제** — T-0051 머지로 신설 완료. 후보 list 의 5 row 중 "ADR-0004 — Auth credential type" 행이 ADR-0004 ID 점유 (이미 신설된 smoke/e2e DB mode 와 ID 충돌). 두 가지 옵션:
  - **(a) Auth credential 후보 ADR ID 재할당** → ADR-0008 (또는 다음 available number). 본 갱신은 §4 표의 후보 row 만, 실 ADR 신설은 후속 task 책임.
  - **(b) ADR-0004 ACCEPTED 박제 → 후보 row 그대로 두되 "신설 완료 (ADR-0004 smoke/e2e DB mode)" 추가 + Auth credential 후보는 별도 후보 row 신설 (ADR-0008 hook).
- [ ] **신설 progress 0/3 → 1/5** 박제 — ADR-0004 신설 완료 + 후보 ADR-0008 (auth credential) / ADR-0005 (cross-cutting) / ADR-0006 (LLM key) / ADR-0007 (audit log) 4 후보 유지.

**§6 P3 → P4 전이 progress 갱신** (L123~150):

- [ ] **entity Prisma model progress 갱신** — "5/11 (T-0044 시점)" → "**5/11 (T-0057 시점, 불변)**". 박제 완료 5 entity (Person / ServiceIdentity / Group / Part / PersonGroupMembership) 유지, 미박제 6 entity (User / Assessment / Contribution / Summary / LlmProviderConfig / DifficultyMapping / PermissionDeniedRecord) 유지. **단** "Group N:M service+controller 5/5 stage closure 박제 완료" 라는 sub-progress 단락 신설 — T-0049 (repository) + T-0050 (service CRUD) + T-0055 (controller CRUD) + T-0056 (service N:M ops) + T-0057 (controller N:M endpoint) 5 stage 완료 박제. Part service+controller 박제 완료 (T-0046) 박제. backbone progress **9/11 entity 박제** (Group N:M 의 service+controller 양 layer + Part service+controller 양 layer 합쳐 5 entity 의 backbone 완성).
- [ ] **module skeleton progress 갱신** — "2/5 (T-0044 시점)" → "**2/5 (T-0057 시점, 불변)**". 박제 완료 2 module (PersistenceModule / UserModule) 유지, 미박제 3 module (AuthModule / AssessmentModule / LlmModule) 유지.
- [ ] **ADR 신설 progress 갱신** — "0/3" → "**1/4 (ADR-0004 신설, ADR-0008 auth credential / ADR-0005 cross-cutting / ADR-0006 LLM key / ADR-0007 audit log 4 후보)**".
- [ ] **L63-65 P3 test-quality 3 bullet — 4/4 (확장 closure)** — T-0042 (unit branch) + T-0043 (smoke mock) + T-0044 (e2e mock) 3 bullet 의 closure 위에 **T-0053 (smoke real PostgreSQL cutover) + T-0054 (e2e real PostgreSQL cutover) 의 ADR-first split 4-stage closure 박제 추가** — R-113 의무의 mock-DB → real PostgreSQL 격상 박제.
- [ ] **expansion 박제 단락 갱신** — 원안 8 → 12 (T-0044 시점) → **25 (T-0057 시점)** task expand 박제 + 13 신규 task 의 expansion 사유 박제 (위 §2 (h) ~ (t) 13 sub-bullet 동일).

**§8 References 갱신** (L172~194):

- [ ] 새 task file reference 13 추가 — T-0045 ~ T-0057.
- [ ] Refs 줄 마지막의 task ID 목록 갱신 — T-0058, T-0057 ~ T-0033 + ADR-0001~0004 + REQ-NNN 유지.

**한국어 / commitMode direct 정책**:

- [ ] 모든 신규 / 갱신 단락 본문 한국어 ([CLAUDE.md §12](../../CLAUDE.md)). 식별자 / 경로 / commit SHA / enum / status 토큰은 영어 그대로.
- [ ] commitMode direct 적용 — feature branch / PR 없이 main 에 직접 push. T-0038 / T-0040 / T-0045 패턴 reuse.
- [ ] commit message subject 한국어 ([CLAUDE.md §12](../../CLAUDE.md)) — `docs(architecture): p3-implementation-plan.md §2/§3/§6 T-0045~T-0057 13 row sync (T-0058)`.
- [ ] commit body 의 trail blob (§11) — PLANNER + IMPLEMENTER (files: docs/architecture/p3-implementation-plan.md / loc: +~120/-~30 / notes 한국어) + ACCEPTANCE 섹션 포함. ARCHITECT / TESTER / INTEGRATOR 섹션 0 (doc-only direct, 결정 추가 없음 / test 무관 / PR 없음).

**Test / lint / CI**:

- [ ] Code 변경 0 → `pnpm lint` / `pnpm build` / `pnpm test` / `pnpm test:smoke` / `pnpm test:e2e` 실행 의무 0 (R-110 면제 — doc-only direct).
- [ ] CI workflow 는 main push 자동 trigger 되어 unit + smoke + e2e + reviewer-gate 4 step 모두 자동 실행 → green 확인 (LOOP.md §1 [5]). doc-only direct 이므로 CI 가 code 무관 step 만 실행하여 green 유지 expected.

**STATE / journal 갱신**:

- [ ] driver 의 [6] bookkeeping step 에서 STATE.json + task file frontmatter status PENDING → DONE + journal append 처리. 본 task 본문은 갱신 책임 없음 — Acceptance Criteria 의 정의로 끝.

## Out of Scope

본 task 는 **하지 않는다** — 후속 task 책임:

- **PLAN.md 본문 P3 단락 (L47~63) 의 bullet level 갱신** — PLAN.md 본문의 P3 bullet 은 phase-level 추상화 ("평가 대상 인원 관리" 등) 로 task ID shift 영향 0. 본 task 는 p3-implementation-plan.md 만 갱신.
- **data-model.md / api.md / components.md / modules.md / directory.md 갱신** — P2 artifact 재편집 회피 원칙. 본 task 는 p3-implementation-plan.md 단일 파일 갱신만.
- **새 ADR 신설** — ADR-0008 (auth credential) 의 실 신설은 후속 backbone task (User+AuthModule 진입) 책임. 본 task 는 §4 후보 표 갱신만.
- **ADR-0005 / ADR-0006 / ADR-0007 신설** — 후속 P3/P4 task 책임. 본 task 는 후보 list 박제만.
- **Phase P3 → P4 전이 marker 박제** — P3 complete 선언은 별도 doc-only direct task (T-0059+ 후보) 책임. 본 task 는 progress 갱신만, P3 complete 선언 0.
- **Group N:M service+controller 5/5 closure 의 별도 closure 문서 신설** — §6 의 sub-progress 단락에만 박제. 별도 closure markdown 신설 안 함.
- **ADR-first split 4-stage closure 의 별도 ADR/문서 신설** — T-0051~T-0054 의 4-stage 박제는 ADR-0004 본문에 이미 명시. 본 task 는 §6 progress 단락에 sub-bullet 만 추가, 별도 문서 신설 안 함.
- **PartController smoke + e2e 확장 task 신설** — T-0053/T-0054 의 persons real PostgreSQL cutover 패턴을 parts 도메인으로 mirror. 별도 후속 task (T-0059+ 후보, ~200-250 LOC 각각) 책임.
- **GroupController smoke + e2e 확장 task 신설** — T-0053/T-0054 의 persons real PostgreSQL cutover 패턴을 groups 도메인으로 mirror. 별도 후속 task 책임.
- **phase 2 src/user spec migration (test/helpers/prisma-mock.ts pattern)** — 기존 5 spec (group.service / part.service / person.service / part.controller / person.controller) 의 박제 mock 시대 spec 을 test/helpers/prisma-mock.ts pattern 으로 mechanical migration. 별도 follow-up task (~200-250 LOC).
- **estimate model 갱신 doc** — T-0055/T-0056/T-0057 의 systematic underestimate (cap-bend 3 회 연속) 학습을 planner estimate 정책에 반영. agent prompt enhancement doc-only direct task. 본 task §2 cap 검산 단락에서 박제만, 정책 자체 갱신은 별도 task.
- **R-112 colocated-spec hint 강화** — T-0055 round 2 + T-0057 round 2 의 add-xxx.dto.spec.ts 누락 패턴 catch 학습을 agent prompt 에 명시. 별도 follow-up task.
- **PATCH endpoint backbone 박제** — Person 의 PATCH (T-0036, T-0037) 외 Group/Part 의 PATCH 미박제. 본 task 는 progress 박제만, 신규 endpoint 신설 0.
- **AuthGuard backbone 박제** — ADR-0008 신설 + User entity backbone 진입 후속 task. 본 task scope 외.
- **응답 envelope 표준화 박제** — `{ data: ..., meta: ... }` 응답 표준은 후속 cross-cutting task 책임.
- **pagination / sorting / filtering 박제** — 후속 query primitive task 책임.

## Suggested Sub-agents

`implementer` 1 단계만 (doc-only direct, architect 호출 0, tester 호출 0 — code 변경 0 / R-110 면제).

- **implementer**: docs/architecture/p3-implementation-plan.md 단일 파일 edit. §2 표 13 row append + §3 mermaid 13 node + 14 edge append + §4 ADR-0004 status 갱신 + §6 progress 갱신 + §8 References 13 link append. T-0045 의 직전 패턴 (§2 doc-shift) 직접 reuse. cap ≤300 / 1 파일 보존 (실 +120/-30 LOC 추정 — driver T-0055~T-0057 systematic underestimate 학습 적용해 보수 추정).

## Follow-ups

(작성 시점 비어 있음 — implementer 가 작업 중 발견한 항목을 본 섹션에 append.)

선행 후보 (planner pre-fill, sub-agent 가 검토 후 유지 / 제거):

- [ ] **PartController smoke + e2e real PostgreSQL cutover task 신설** — T-0053/T-0054 의 persons 패턴 parts 도메인 mirror (~200-250 LOC 각각).
- [ ] **GroupController smoke + e2e real PostgreSQL cutover task 신설** — T-0053/T-0054 패턴 groups 도메인 mirror.
- [ ] **phase 2 src/user spec migration task 신설** — 5 spec 의 박제 mock 시대 spec 을 test/helpers/prisma-mock.ts pattern 으로 mechanical migration (~200-250 LOC).
- [ ] **estimate model 갱신 doc-only direct task 신설** — agent prompt enhancement, T-0055/T-0056/T-0057 systematic underestimate 학습 반영.
- [ ] **R-112 colocated-spec hint 강화 doc-only direct task 신설** — agent prompt 에 'AddXxxDto.ts 신설 시 colocated AddXxxDto.spec.ts 의무' 명시.
- [ ] **Phase P3 complete 선언 task 신설** — 본 task 머지 후 §6 progress 가 backbone 9/11 entity + 2/5 module 박제 완료 단계까지 진척하면 P3 complete + P4 entry marker doc-only direct task 진입 후보.
- [ ] **ADR-0008 (auth credential type) 신설 task** — User+AuthModule backbone 진입 후속 task 가 ADR + entity + service-layer 박제 동반.
- [ ] **PATCH endpoint 일괄 박제 task** — Group/Part 의 PATCH endpoint + Update DTO + service.update 박제. cap ≤300 / Group/Part 2 도메인 split 가능.
