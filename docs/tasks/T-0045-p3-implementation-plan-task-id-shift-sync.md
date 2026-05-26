---
id: T-0045
title: p3-implementation-plan.md §2 task ID shift 정정 — 원안 8 row → 실제 머지 12 task (T-0033 ~ T-0044) 재매핑 + §3 mermaid + §4 ADR 표 + §6 closure 조건 동기
phase: P3
status: DONE
completedAt: 2026-05-26T12:14:00+09:00
commitMode: direct
coversReq: [REQ-058]
estimatedDiff: 180
estimatedFiles: 1
created: 2026-05-26
plannerNote: T-0040 §Follow-ups L104 박제 — p3-implementation-plan.md §2 의 outdated row (T-0038~T-0043) 가 실제 머지 (T-0038 doc-shift / T-0039 backbone / T-0040 doc-sync / T-0041 repository / T-0042 unit / T-0043 smoke / T-0044 e2e) 와 mismatch. 다음 backbone task entry 의 reference 정합성 회복.
dependsOn: [T-0040, T-0044]
blocks: []
hqOrigin: null
humanApprovalGate: false
supersedes: null
plannerSource: docs/tasks/T-0040-data-model-group-part-membership-sync.md §Follow-ups L104 ("p3-implementation-plan.md §2 표 task ID shift 정정 — T-0038 → T-0039 / 후속 row 의 1 자리 shift / mermaid graph 의 노드 라벨 + 의존성 화살표 + §3 본문 / §4 ADR 표 / §6 P3 closure 단락 등 단일 파일 다단락 갱신. doc-only direct ~70 LOC 추정"). 본 task 가 그 follow-up 의 후행 실행. T-0038 (cron #7) 의 갱신 패턴 (+54/-41 LOC, §2 표 11 row 재구성 + §3 mermaid 재구성 + §4 ADR shift + §5 footnote + §6 closure + §7 Out of scope + §8 Refs) 재실행 — 본 task 는 실제 머지 task 12 개 (T-0033 ~ T-0044) 로 표 재구성.
---

# T-0045 — p3-implementation-plan.md §2 task ID shift 정정 (doc-only direct)

## Why

[docs/architecture/p3-implementation-plan.md](../architecture/p3-implementation-plan.md) §2 P3 task 시퀀스 표 가 **outdated** 다. 원안 (cron #7 의 T-0038 갱신 시점) 의 11 row 매핑 (T-0033 ~ T-0043) 이 실제 P3 진행 결과와 크게 어긋났다:

| 표의 행 | 표 본문의 책임 | 실제 머지 task (mergeCommit) | gap 종류 |
| --- | --- | --- | --- |
| T-0033 row | Prisma + pg 의존성 + PersistenceModule | T-0033 (정상 매핑) | 일치 |
| T-0034 row | Person entity + UserModule skeleton | T-0034 (정상 매핑) | 일치 |
| T-0035 row | ServiceIdentity entity + 1:N | T-0035 (정상 매핑) | 일치 |
| T-0036 row | PersonService + Controller + DTO + class-validator | T-0036 (정상 매핑) | 일치 |
| T-0037 row | PATCH active+other 동시 처리 patch | T-0037 (정상 매핑) | 일치 |
| **T-0038 row** | **Group + Part entity backbone + GroupService/PartService** | **T-0038 = plan §2 표 shift 정정 (doc-only direct, cron #7)** + **T-0039 = Group + Part entity 만 (Service/Controller/DTO 는 후속)** | **분리 — doc-shift task 1 + 실 backbone task 1 로 2 task 로 자연 split** |
| T-0039 row | User + AuthModule + SuperAdmin 자동 지정 | **미진행** (T-0040 ~ T-0044 가 다른 책임으로 진행) | **미진행** |
| T-0040 row | Assessment + Contribution + Summary | **미진행** | **미진행** |
| T-0041 row | LlmProviderConfig + DifficultyMapping | **미진행** — 실제 T-0041 = PersonRepository.findByPartId/findByGroupId extension (PR-38, 4cd302f) | **다른 책임으로 사용** |
| T-0042 row | PermissionDeniedRecord entity | **미진행** — 실제 T-0042 = PersonService.update P2002 + patch.email undefined branch unit (PR-39, 20ef2c5) | **다른 책임으로 사용** |
| T-0043 row | Cross-cutting field + ADR-0005 | **미진행** — 실제 T-0043 = smoke domain /api/persons 5 endpoint (PR-40, e7bb95a) | **다른 책임으로 사용** |
| (표 row 부재) | — | T-0040 = data-model.md sync (doc-only direct, a41c036), T-0044 = e2e /api/persons (PR-41, 2b9131d) | **표에 row 없음 — 추가 필요** |

**구체 gap 4 종**:

1. **§2 표 row 6 (T-0038)** 가 표 본문에서 "Group + Part entity backbone + GroupService/PartService" 의 1 task 로 매핑되어 있으나 **실제로는 T-0038 (doc-shift) + T-0039 (entity backbone) 2 task 로 자연 split**. cron #7 의 §2 표 갱신은 doc-shift task 자체를 row 화 안 함 — 본 task 가 row 추가.
2. **§2 표 row 7 ~ 11 (T-0039 ~ T-0043)** 가 표 본문에서 "User+AuthModule / Assessment+Contribution+Summary / LlmProviderConfig / PermissionDeniedRecord / Cross-cutting" 의 5 backbone 책임으로 매핑되어 있으나 **실제 머지된 T-0039 ~ T-0044 6 task 는 다른 책임** — Group+Part entity (T-0039) / data-model sync (T-0040) / PersonRepository ext (T-0041) / unit branch (T-0042) / smoke (T-0043) / e2e (T-0044). 즉 **계획 row 5 개 미진행** + **실제 머지 row 5 개 표에 미박제** = 표 본문이 misleading 한 stale 상태.
3. **§3 mermaid graph** 의 노드 (T0038 ~ T0043 6 개) + 의존성 화살표 (T0034 → T0039 / T0034 → T0040 / T0040 → T0041 / T0040 → T0042 / T0040 → T0043) 가 §2 표와 동기 outdated. T-0034 fan-out hub 표기는 유지하되, 실제 fan-out 은 T-0034 → T-0039 (entity) / T-0036 → T-0041 (repository ext) 등으로 재구성 필요.
4. **§4 ADR 표** 의 책임 task 컬럼 (ADR-0004 → T-0039 / ADR-0005 → T-0043 / ADR-0006 hook → T-0041 / ADR-0007 ref → T-0042) 가 §2 표 row 의 책임 task ID 와 함께 outdated. 본 task 가 ADR 신설 row 의 책임 task 를 실제 후속 task (User+AuthModule / Assessment / LlmProviderConfig / PermissionDeniedRecord 등) 의 **새 task ID** (예: T-0046+) 로 shift.

본 task 머지 후 효과:

- **다음 backbone task entry 의 reference 정합성 회복**: planner / architect / reviewer 가 p3-implementation-plan §2 를 read 할 때 outdated row 로 confuse 되지 않음 (e.g., 다음 task 가 "GroupService + GroupController + DTO" 일 때 reviewer 가 plan §2 의 T-0038 row 와 실 T-0039 머지 사이 mismatch 를 발견하지 않음).
- **P3 closure 조건 정밀화**: §6 P3 → P4 전이 조건 단락이 "11 entity Prisma model 박제" 라 표기 — 실 머지 entity 수 (Person / ServiceIdentity / Group / Part / PersonGroupMembership = 5 entity, 1/2 완료) 와 plan 의 closure 목표 (11 entity) 의 progress 명시.
- **PLAN.md L63-65 P3 test-quality 3 bullet 의 전 closure 박제**: cron #7 의 §2 표 갱신은 test-quality bullet 의 입력 전. 본 task 가 §6 closure 조건에 "test-quality 3 bullet 모두 closed (T-0042 unit / T-0043 smoke / T-0044 e2e)" 박제.

본 task 는 [REQ-058](../requirements.md) (raw data 저장 금지 / 평가된 결과만 보유) 의 직접 cover 가 아니라 **plan 정합성 회복의 cross-cutting 책임**. coversReq=[REQ-058] 은 P3 phase 의 대표 REQ 로 frontmatter inventory 정합 (P3 의 모든 task 가 REQ-058 의 schema 정책 위에서 진행되므로 의미적 cover).

## Required Reading

- [docs/architecture/p3-implementation-plan.md](../architecture/p3-implementation-plan.md) — 본 task 가 갱신할 단일 파일. §2 표 (행 12 row 재구성) / §3 mermaid graph (노드 13 + 의존성 재구성) / §4 ADR 표 (책임 task ID shift) / §5 인간 승인 게이트 (T-0036 HQ-0005 footnote 갱신, T-0033 footnote 유지) / §6 P3 → P4 closure 조건 단락 (entity progress 명시 + test-quality 3 bullet closed 추가) / §7 Out of scope (cross-cutting field policy 박제 deferred 명시 — ADR-0005 책임 task 가 미진행이므로 P3 closure 조건에서 deferred 또는 후속 task 책임) / §8 References 단락 (T-0040, T-0041, T-0042, T-0043, T-0044 reference 추가) / Refs 마지막 줄 (T-0040 ~ T-0044 ID 추가) 모두 영향 대상.
- [docs/PLAN.md](../PLAN.md) Phase P3 단락 (L47-65) — 본 task 의 §2 표 row 책임 매핑의 source. L63-65 P3 test-quality 3 bullet (L63 unit branch / L64 smoke domain / L65 e2e domain) 모두 [x] closed 박제 — 본 task 가 §6 closure 조건에 반영.
- [docs/tasks/T-0038-p3-implementation-plan-task-sequence-sync.md](T-0038-p3-implementation-plan-task-sequence-sync.md) — 직전 §2 shift 정정 task. 본 task 의 갱신 패턴 (Acceptance Criteria 항목 / 단락 별 개입 범위) reference. 본 task 는 T-0038 패턴 재실행으로 row 갯수 만 11 → 12 row 로 확장.
- [docs/tasks/T-0039-group-part-entity-and-repository.md](T-0039-group-part-entity-and-repository.md) §Follow-ups — 본 task 의 source. L106 박제 "p3-implementation-plan.md §2 task ID shift 정정 — T-0038 (cron #7 박제 'Group+Part backbone') → T-0039 (실제 entity-only 머지) + 후속 row 의 T-0040 → T-0041 / T-0041 → T-0042 / T-0042 → T-0043 / T-0043 → T-0044 1 자리 shift".
- [docs/tasks/T-0040-data-model-group-part-membership-sync.md](T-0040-data-model-group-part-membership-sync.md) §Follow-ups L104 — 본 task 의 직접 박제. data-model.md sync 의 후속 doc-only direct 후보로 명시.
- [docs/STATE.json](../STATE.json) `mostRecentTasks` + `counters.tasksCompleted=43` + `reviewRounds` — 본 task 의 §2 표 row 의 mergeCommit / round 박제 source.
- 직전 5 task 의 commit subject (`git log --oneline -20`) — 본 task §2 표의 row 추가 시 실 머지 SHA / PR 번호 / 책임 1-line summary 검산 source. T-0044 (2b9131d, PR-41) / T-0043 (e7bb95a, PR-40) / T-0042 (20ef2c5, PR-39) / T-0041 (4cd302f, PR-38) / T-0040 (a41c036, direct) / T-0039 (c25a5de, PR-37) / T-0038 (e8e6e7e, direct).

## Acceptance Criteria

본 task 는 **단일 파일 (`docs/architecture/p3-implementation-plan.md`) doc-only direct** — 코드 / 테스트 / CI 변경 0. Acceptance Criteria 는 R-110 ~ R-114 면제 (doc-only direct commit), 대신 다음 갱신 항목 모두 만족.

**§2 P3 task 시퀀스 표 재구성** (가장 큰 변경):

- [ ] §2 표 row 갯수를 **11 → 12 row** 로 확장. 새 row 매핑:
  - **row 1 (T-0033)** 유지 — Prisma + pg + PersistenceModule. dependsOn=T-0032. 인간 승인 게이트 = 있음 (HQ-0004). status: DONE (mergeCommit 명시).
  - **row 2 (T-0034)** 유지 — Person entity + UserModule skeleton. dependsOn=T-0033. status: DONE.
  - **row 3 (T-0035)** 유지 — ServiceIdentity entity + 1:N. dependsOn=T-0034. status: DONE.
  - **row 4 (T-0036)** 유지 — PersonService + Controller + DTO + class-validator. 인간 승인 게이트 = 있음 (HQ-0005, class-validator stack). status: DONE.
  - **row 5 (T-0037)** 유지 — PATCH active+other 동시 처리 fix. status: DONE.
  - **row 6 (T-0038)** 갱신 — 책임 컬럼: **"p3-implementation-plan.md §2 task ID shift 정정 (doc-only direct, cron #7)"**. dependsOn=T-0037. status: DONE. 책임 module: (doc-only — module 영향 0). 본 row 가 plan §2 의 doc-shift task 자체를 row 화.
  - **row 7 (T-0039)** 갱신 — 책임 컬럼: **"Group + Part entity Prisma model + GroupRepository + PartRepository + PersonGroupMembership join entity + UserModule wiring (Service/Controller/DTO 는 후속 task)"**. dependsOn=T-0038. status: DONE. mergeCommit=c25a5de. 책임 module: UserModule. (원안 row 6 의 책임이 row 7 로 shift.)
  - **row 8 (T-0040)** 갱신 — 책임 컬럼: **"data-model.md 갱신 — Group / Part / PersonGroupMembership entity 박제 (T-0039 reviewer MINOR follow-up, doc-only direct)"**. dependsOn=T-0039. status: DONE. mergeCommit=a41c036.
  - **row 9 (T-0041)** 갱신 — 책임 컬럼: **"PersonRepository 확장 — findByPartId(partId) + findByGroupId(groupId) (GroupService/PartService backbone 의 repository-layer prerequisite)"**. dependsOn=T-0039. status: DONE. mergeCommit=4cd302f. 책임 module: UserModule.
  - **row 10 (T-0042)** 갱신 — 책임 컬럼: **"[테스트 품질] PersonService.update P2002 + patch.email undefined branch unit test (R-112 negative case 충분 cover 의무 이행, 96.66% → 100% branch coverage)"**. dependsOn=T-0036. status: DONE. mergeCommit=20ef2c5. PLAN.md L63 bullet cover.
  - **row 11 (T-0043)** 갱신 — 책임 컬럼: **"[테스트 품질] smoke /api/persons CRUD 5 endpoint bootstrap smoke 확장 (R-113 smoke 의무 이행, mock-DB Test.overrideProvider 패턴)"**. dependsOn=T-0036. status: DONE. mergeCommit=e7bb95a. PLAN.md L64 bullet cover.
  - **row 12 (T-0044)** 신설 — 책임 컬럼: **"[테스트 품질] e2e /api/persons HTTP contract depth (status + DTO body shape + 4xx envelope) e2e-spec 확장 (R-113 e2e 의무 이행)"**. dependsOn=T-0043. status: DONE. mergeCommit=2b9131d. PLAN.md L65 bullet cover.
- [ ] §2 표 직후의 **"합계" 단락** 갱신: 원안 "11 task / 5 module / 10 PLAN bullet cover" → "**12 task (T-0033 ~ T-0044) / 1 module (UserModule, PersistenceModule wiring 포함) / 5 PLAN bullet cover (L51 인원 관리 / L52 서비스 ID / L53 primary ID / L54 Group 정책 / L63-65 test-quality 3 bullet) + 5 PLAN bullet 미진행 (L55-60: 평가 결과 저장 / raw 미저장 / 상대 비교 / Persistence layer 의 후속 entity / Auth/RBAC / User read-only)**". 본 단락은 P3 가 모듈 1 개 (UserModule) 안에 집중되어 있으며 Assessment / Auth / Llm module 은 미진행 임을 명시.
- [ ] §2 표 footer 의 **"Cap discipline 검산"** 단락 갱신 — 원안의 "T-0034 → T-0035 (ServiceIdentity split) → T-0036 (PersonService) → T-0037 (patch) → T-0038 (Group+Part)" topological order 표기를 **실제 머지 order** 로 정정: "T-0033 → T-0034 → T-0035 → T-0036 → T-0037 → T-0038 (doc-shift) → T-0039 (entity backbone) → T-0040 (doc-sync) → T-0041 (repository ext) → T-0042 (unit branch) → T-0043 (smoke) → T-0044 (e2e)". 본 단락은 backbone 의 자연 split 과 test-quality 3 bullet 의 P3 mid-진입을 박제.

**§3 mermaid graph 재구성**:

- [ ] §3 mermaid graph 의 노드 12 개 재정의 — T0033 / T0034 / T0035 / T0036 / T0037 / T0038 (doc-shift) / T0039 (entity backbone) / T0040 (doc-sync) / T0041 (repository ext) / T0042 (unit branch) / T0043 (smoke) / T0044 (e2e). 노드 라벨에 한 줄 책임 + status 박제 (예: `T0044["T-0044<br/>e2e /api/persons<br/>HTTP contract depth"]`).
- [ ] §3 mermaid graph 의 의존성 화살표 재구성 — 원안의 단일 chain (T-0033 → T-0034 → ... fan-out) 위에 실제 의존성 박제. 핵심 chain: T-0033 → T-0034 → T-0035 → T-0036 → T-0037 → T-0038 → T-0039 (entity backbone 자연 split) → T-0040 (doc-sync). T-0036 → T-0041 (repository ext) / T-0036 → T-0042 (unit branch). T-0036 → T-0043 (smoke). T-0043 → T-0044 (e2e). cycle 0 검산.
- [ ] §3 mermaid graph 의 classDef 갱신 — 노란/빨강 (root/gate) 박스는 T-0033 (인간 승인 게이트) + T-0036 (HQ-0005 class-validator stack 게이트). 빨강 (ADR 신설) 박스는 미진행 (실제 진행된 12 task 중 ADR 신설 task 0 — ADR-0004/0005/0006/0007 모두 미진행 P3 후속 또는 P4 hook). 회색은 그 외 정상 진행 task.
- [ ] §3 mermaid graph 직후 **graph 해석 단락** 갱신 — 원안의 "T-0040 fan-out hub" 표기를 실 fan-out hub (T-0036 — service-layer 위에서 T-0041 repository ext / T-0042 unit / T-0043 smoke / T-0044 e2e 가 모두 PersonService 위 cover) 로 정정.

**§4 ADR 신설 후보 list 갱신**:

- [ ] §4 ADR 표의 **책임 task** 컬럼을 실 미진행 P3 후속 task 후보 (예: T-0046+) 로 shift — 원안의 T-0039 / T-0043 책임 task ID 가 실 머지 task 와 다른 책임 (entity backbone / smoke) 로 소비되었으므로. ADR 후보 5 개 책임 재매핑:
  - **ADR-0002 의존성 도입 보강**: T-0033 (이미 완료) — status: NEEDS_RETROACTIVE_REVIEW (T-0033 머지 시점에 ADR-0002 status 재확인 작업이 ad-hoc 처리되었으므로 retroactive 박제 follow-up 또는 본 row 의 status 단순 update).
  - **ADR-0004 — Auth credential type (JWT vs session cookie)**: 책임 task = **미진행 후속 task (T-0046+ 후보 — User+AuthModule backbone 진입 task)**.
  - **ADR-0005 — Cross-cutting field policy**: 책임 task = **미진행 후속 task (T-0046+ 또는 P3 종료 직전 별도 task)**.
  - **ADR-0006 (hook) — LLM API key encryption-at-rest**: P4 (T-0041 책임은 PersonRepository ext 로 소비되었으므로 LlmProviderConfig 후속 task 가 별도). P3 외 표기 유지.
  - **ADR-0007 (hook) — Audit log entity schema**: P3 끝 또는 P4 (별도 task). 표기 유지.
- [ ] §4 표 합계 단락 갱신 — 원안 "3 개는 P3 안에서 신설, 2 개는 P4+ hook" → "**0 개 P3 진행 중 신설 (실 진행 12 task 중 ADR 신설 0), 3 개 P3 후속 신설 후보 (ADR-0002 보강 retroactive + ADR-0004 auth credential + ADR-0005 cross-cutting), 2 개 P4+ hook (ADR-0006 LLM key encryption / ADR-0007 audit log)**". ADR 박제 progress 가 0/3 (P3 안 ADR 신설 부재) 인 사실 명시 — 후속 task 책임 강조.

**§5 인간 승인 게이트 단락 갱신**:

- [ ] §5 본문에서 **T-0033 게이트 (Prisma + pg + class-validator 도입 게이트, HQ-0004)** + **T-0036 게이트 (HQ-0005 class-validator stack)** 두 게이트 박제 유지. 본 단락은 cron #7 갱신 시점에 이미 박제됨 — 본 task 는 변경 0 (게이트 발화 추가 0).
- [ ] §5 단락 끝에 **"T-0038 ~ T-0044 7 task 모두 새 외부 dependency 0 — HQ 발화 0"** 한 줄 추가. 게이트 inventory 의 completeness 명시.

**§6 P3 → P4 전이 조건 갱신**:

- [ ] §6 본문의 entity inventory 목록 정정 — 원안 "11 entity Prisma model 박제" 의 진행 상황 명시. 실 박제 entity (Person / ServiceIdentity / Group / Part / PersonGroupMembership = 5 정식 entity, T-0039 까지 완료) vs 목표 11 entity 의 progress (5/11) 박제. 잔여 6 entity (User / Assessment / Contribution / Summary / LlmProviderConfig / DifficultyMapping / PermissionDeniedRecord, conceptual AuditLog 별도) 의 후속 task 책임 명시.
- [ ] §6 본문의 **module skeleton 목록** 정정 — 원안 "5 module skeleton 박제 — PersistenceModule / UserModule / AuthModule / AssessmentModule / LlmModule" 의 progress 명시. 실 박제 module 2 개 (PersistenceModule, UserModule) vs 목표 5 module 의 progress (2/5).
- [ ] §6 본문에 **PLAN.md L63-65 P3 test-quality 3 bullet** 의 closure 명시 — "PLAN.md L63 unit branch coverage 100% closure (T-0042) / L64 smoke domain endpoint 확장 closure (T-0043) / L65 e2e domain endpoint 확장 closure (T-0044) — R-112 negative case 충분 cover + R-113 smoke/e2e 의무 모두 이행". 본 closure 가 P3 의 test-quality 차원 완성 박제.
- [ ] §6 본문에 **"P3 진행 중 expansion 박제"** 단락 갱신 — 원안 "11 task (T-0033 ~ T-0043)" → "**12 task (T-0033 ~ T-0044)**, 본 task 머지 시 13 task". expansion 사유 박제 — backbone task 의 자연 split (T-0034 → entity split, T-0036 → service-layer 추가, T-0037 → patch 추가, T-0040 → doc-sync 추가) + test-quality bullet 의 P3 mid-진입 (T-0042 ~ T-0044, PLAN.md L63-65 bullet 의 사용자 명시 추가 후 진입).

**§7 Out of scope 갱신**:

- [ ] §7 본문에 **"본 task 머지 후 다음 backbone task entry 책임"** 한 줄 추가 — "P3 의 잔여 backbone (User+AuthModule entity / Assessment+Contribution+Summary entity / LlmProviderConfig+DifficultyMapping entity / PermissionDeniedRecord entity / Cross-cutting field policy ADR-0005) 은 본 task 머지 후 별도 task (T-0046+) 책임. 본 task 는 plan §2 정합성 회복 doc-only direct, backbone 진입 자체 0."
- [ ] §7 본문의 다른 항목 (실제 Prisma schema 작성 / pnpm add / 새 ADR / NestJS module / Docker compose / Migration SQL / API endpoint / P4+ task 매핑 / data-model.md 재편집 / gap REQ-004 / 시퀀스 cycle 자동화 / PLAN.md P3 bullet level 갱신) 은 unchanged — 본 task 는 plan §2 갱신만.

**§8 References 갱신**:

- [ ] §8 References 단락에 다음 5 reference 추가 (mergeCommit + 책임):
  - `[docs/tasks/T-0040-data-model-group-part-membership-sync.md](../tasks/T-0040-data-model-group-part-membership-sync.md)` — data-model.md sync (T-0039 reviewer MINOR follow-up).
  - `[docs/tasks/T-0041-person-repository-find-by-part-and-group.md](../tasks/T-0041-person-repository-find-by-part-and-group.md)` — PersonRepository.findByPartId/findByGroupId.
  - `[docs/tasks/T-0042-person-service-update-p2002-undefined-email-branch.md](../tasks/T-0042-person-service-update-p2002-undefined-email-branch.md)` — PersonService.update P2002 + patch.email undefined branch unit.
  - `[docs/tasks/T-0043-smoke-test-persons-domain-endpoint-expansion.md](../tasks/T-0043-smoke-test-persons-domain-endpoint-expansion.md)` — smoke /api/persons 5 endpoint.
  - `[docs/tasks/T-0044-e2e-test-persons-domain-endpoint-expansion.md](../tasks/T-0044-e2e-test-persons-domain-endpoint-expansion.md)` — e2e /api/persons HTTP contract depth.
- [ ] Refs 마지막 라인에 T-0040 / T-0041 / T-0042 / T-0043 / T-0044 / T-0045 6 ID prepend (기존 Refs 의 task / ADR / REQ inventory 유지).

**기타**:

- [ ] §1 본문 (개요) 의 task 시퀀스 expansion 표기 갱신 — 원안 "실제 시퀀스는 11 task (T-0033 ~ T-0043) 로 expand" → "**실제 시퀀스는 12 task (T-0033 ~ T-0044) 로 expand, 본 §2 표 정합성 회복은 T-0045 책임**". 본 task 자체의 self-reference 박제.
- [ ] 파일 끝 라인 endings (CRLF/LF) 는 기존 파일과 동일 유지 — formatter 자동 변환 차단.
- [ ] 본 task 의 변경은 **단일 파일 (p3-implementation-plan.md) 만** — 다른 docs/architecture/*.md / docs/use-cases/*.md / prisma/* / src/* 변경 0. 다른 doc artifact 의 갱신은 별도 follow-up task 의 책임.
- [ ] task 의 estimatedDiff ≤ 300 LOC / estimatedFiles ≤ 5 cap 검산 — 본 task 의 변경은 단일 파일 약 +120/-60 LOC (net +60) 추정, cap 의 60% 이내.

**분기 없는 doc-only task 의 R-112 4 항목 적용**: 본 task 는 production code 변경 0 / public symbol 추가 0 / branch 추가 0 — R-112 happy / error / branch / negative 4 항목 적용 불가 (코드가 없으므로 test 대상 0). 분기 없는 doc-only task — 본 항목 생략. coverage threshold 검사도 코드 변경 0 으로 면제 (jest 실행 자체 변경 0).

## Out of Scope

본 task 는 **하지 않는다** — 후속 task 책임:

- **잔여 P3 backbone entity 박제** — User + AuthModule (ADR-0004 동반) / Assessment + Contribution + Summary / LlmProviderConfig + DifficultyMapping / PermissionDeniedRecord 의 entity 박제는 본 task scope 외, 별도 후속 task (T-0046+) 책임.
- **GroupService + GroupController + GroupDTO 도입** — T-0039 의 entity-only 머지 후 service-layer 책임은 후속 task. 본 task 는 plan §2 정합성 회복 만, code 변경 0.
- **PartService + PartController + PartDTO 도입** — 위와 동일, 후속 task 책임.
- **PersonGroupMembership service-layer 강제** — REQ-028 multi-soskok / mandatory Part invariant 의 service-layer enforcement 는 GroupService / PartService 책임.
- **ADR-0004 / ADR-0005 신설** — 각각 auth credential 결정 / cross-cutting field policy 박제는 별도 후속 task 책임. 본 task 는 §4 ADR 표의 책임 task ID 만 shift, ADR 신설 0.
- **PLAN.md 본문 P3 단락 (L47-65) 의 bullet level 갱신** — 본 갱신은 p3-implementation-plan.md §2 / §3 / §4 / §5 / §6 / §7 / §8 만. PLAN.md 본문의 P3 bullet 은 phase-level 추상화 (예: "평가 대상 인원 관리 (CRUD, group, deactivate/activate)") 로 task ID shift 의 영향 없음 — bullet 자체는 변경 없이 유지.
- **other docs/architecture/*.md 의 task ID reference 정정** — data-model.md / api.md / components.md / modules.md / directory.md 의 task ID reference 가 outdated 한지 점검 + 정정은 본 task scope 외, 별도 doc-sync follow-up.
- **docs/STATE.json / docs/PLAN.md 의 progress 표기 갱신** — STATE.json 의 mostRecentTasks / counters 는 driver 의 wrap commit 책임, PLAN.md 본문은 위에서 명시.
- **data-model.md §2 entity inventory 의 5/11 progress 박제** — 본 task 는 p3-implementation-plan §6 closure 조건에서만 progress 박제 (data-model.md 본문은 conceptual model 만 — entity 박제 자체는 미진행 후속 task 의 머지로 row 추가).
- **mermaid graph 의 시각적 검증 자동화 / lint** — 본 task 는 graph 본문 갱신만, automated mermaid linter 신설 안 함 (별도 ops task 또는 향후 ADR).
- **§4 ADR 표의 책임 task ID 의 정확한 후속 ID (T-0046 / T-0047 등) 박제** — 본 task 는 "**미진행 후속 task (T-0046+ 후보)**" 의 conceptual reference 만, 실 task ID 는 후속 planner 가 결정.
- **REQ-058 직접 schema-level 강제 검산** — 본 task 의 coversReq=[REQ-058] 은 P3 phase 의 대표 REQ 로 frontmatter inventory 정합. REQ-058 (raw data 저장 금지) 의 schema-level 검산은 T-0040+ (data-model.md sync) + 후속 Assessment entity backbone task 책임.
- **본 task 머지 commit 의 trail blob 정합 검증** — driver 가 wrap commit 시 trail blob 자체 점검. 본 task 정의서는 acceptance 만 박제.

## Suggested Sub-agents

`implementer → (R-110 면제 doc-only direct — tester 호출 불요)`.

본 task 는 doc-only direct commit — coverage / lint / build / test 면제 (CLAUDE.md §3.2 R-110 적용 제외 단서 "direct-mode doc-only commit 만 본 규칙 면제"). architect 호출 불요 (신규 ADR / 결정 0 — 실 머지 task 의 §2 표 박제 + §3 mermaid 동기 + §4 ADR 표 책임 shift + §6 closure 조건 progress 명시). implementer 가 p3-implementation-plan.md 단일 파일 edit 후 driver 가 STATE / journal / task frontmatter 만 wrap.

implementer 의 edit 순서 권장:

1. §1 본문 task 시퀀스 expansion 한 줄 갱신 (12 task 박제).
2. §2 표 12 row 재구성 — row 6 (T-0038) 책임 컬럼 갱신 + row 7-11 (T-0039 ~ T-0043) 책임 shift + row 12 (T-0044) 신설.
3. §2 표 합계 단락 + Cap discipline 검산 단락 갱신.
4. §3 mermaid graph 노드 12 개 + 의존성 화살표 재구성.
5. §3 graph 해석 단락 갱신.
6. §4 ADR 표의 책임 task 컬럼 shift + 합계 단락 갱신.
7. §5 본문 "T-0038 ~ T-0044 7 task 게이트 0" 한 줄 추가.
8. §6 본문 progress 박제 (entity 5/11 + module 2/5 + test-quality 3/3 closure).
9. §7 본문 한 줄 추가 (다음 backbone task entry 책임 명시).
10. §8 References 5 reference 추가 + Refs prepend 6 ID.

implementer 가 edit 도중 §2 표 row 의 mergeCommit SHA / PR 번호 정합성 검산은 `git log --oneline -20` 또는 STATE.json reviewRounds 의 inventory 와 cross-check — 본 task 의 정확성 의 핵심 (잘못된 SHA / PR 번호 박제는 다음 reviewer 가 점검 시 ANOTHER_ROUND 발화).

## Follow-ups

(작성 시점 비어 있음 — sub-agent 가 작업 중 발견한 항목을 본 섹션에 append.)

선행 후보 (planner pre-fill, sub-agent 가 검토 후 유지 / 제거):

- [ ] **GroupService + GroupController + GroupDTO 도입** — T-0039 의 entity-only 머지 후 service-layer 첫 backbone. REQ-028 의 Group 멤버 list / Person 의 Group 소속 endpoint 첫 노출. T-0036 의 PersonService 패턴 reuse. pr-mode 추정 ~250-280 LOC / 4-5 파일. cap discipline tight — 본 task 의 다음 cron / session 진입 시 planner 가 cap 재검토.
- [ ] **PartService + PartController + PartDTO 도입** — GroupService 와 별도 task (1 task 1 module 책임 분리). pr-mode 추정 ~200-240 LOC / 4-5 파일. Person.partId mandatory invariant 의 service-layer enforcement 의 source.
- [ ] **User + AuthModule entity 박제 (ADR-0004 신설 동반)** — JWT vs session cookie 결정 + SuperAdmin 자동 지정 + role guard. pr-mode 추정 ~300 LOC (cap 한도) / 5+ 파일 (split 가능성 검토).
- [ ] **Assessment + Contribution + Summary entity 박제 (raw 미저장 invariant 강제)** — REQ-058 의 schema-level enforce. AssessmentModule skeleton + 첫 migration.
- [ ] **LlmProviderConfig + DifficultyMapping entity 박제 + LlmModule skeleton** — ADR-0006 hook 동반 (P4 LLM HTTP client 진입 전 prerequisite).
- [ ] **PermissionDeniedRecord entity 박제 (audience field)** — P4 GithubAdapter / ConfluenceAdapter event listener skeleton.
- [ ] **Cross-cutting field policy ADR-0005 박제** — timezone (UTC vs KST) + soft delete entity 표 + @default(now()) / @updatedAt 일괄 적용. P3 closure 의 마지막 잔여 항목.
- [ ] **data-model.md §2 entity inventory progress 박제 (5/11)** — 본 task 가 p3-implementation-plan §6 만 progress 박제 — data-model.md 본문에도 same progress mirror 가 의도되면 별도 doc-sync.
- [ ] **api.md 의 Group / Part endpoint detail spec** — REQ-028 의 Person ↔ Group 다대다 mutation API + Part 소속 인원 list. GroupService / PartService 진입 시 api.md 동시 갱신.
- [ ] **shared test helper 모듈 추출** — T-0043 / T-0044 / T-0036 / T-0042 의 buildMockPrismaService / buildPersonFixture / buildPrismaError 3 helper 가 4+ spec 에서 동일 시그니처 inline 중복. 3 회 이상 중복 — 추출 후보 (test/support/persistence-mock.ts 등).
- [ ] **reviewer-gate CI step race fix** — T-0036 / T-0039 / T-0041 / T-0042 첫 CI 가 reviewer comment post 전 fail → rerun 으로 green 의 ad-hoc 패턴 누적 4 회. 해결 후보: reviewer agent 가 CI step 의 reviewer-gate trigger 시점을 push 직후가 아니라 comment post 직후로 조정 + workflow definition `workflow_dispatch:` trigger 추가.
