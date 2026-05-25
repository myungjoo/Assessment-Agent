---
id: T-0038
title: p3-implementation-plan §2 시퀀스 표 갱신 (T-0035 ServiceIdentity split + T-0036 PersonService + T-0037 patch 반영 → 잔여 task ID shift)
phase: P3
status: DONE
commitMode: direct
coversReq: [TBD]
estimatedDiff: 60
estimatedFiles: 1
actualDiff: 95
actualFiles: 1
created: 2026-05-26
completedAt: 2026-05-26T03:09:00+09:00
resultSummary: docs/architecture/p3-implementation-plan.md 단일 파일 +54/-41 (net +13) 갱신. §2 표 11 row (원안 8 + T-0035/T-0036/T-0037 신규 3), §3 mermaid 11 노드 재구성 (T-0034 fan-out hub 유지 + T-0035→T-0036→T-0037→T-0038 직선 chain + T-0040 fan-out hub), §4 ADR 표 책임 task ID shift (ADR-0004→T-0039, ADR-0005→T-0043, ADR-0006 hook→T-0041, ADR-0007 ref→T-0042), §5 HQ-0005 class-validator stack footnote + T-0039 auth credential reference, §6 P3 closure 조건 (T-0033~T-0043 11 task) + expansion 단락 추가, §7 Out of scope 3 신규 bullet, §8 Refs T-0034~T-0038 추가. 후속 backbone (Group+Part) ID = T-0038 미사용 — 본 plan §2 row 30 으로 이미 박제, planner 가 다음 turn 에 별도 T-NNNN 할당.
plannerNote: P3 plan §2 원안과 실제 머지 시퀀스 mismatch — 잔여 task ID 한 자리 이상 shift 매핑 박제 후 다음 backbone task ID 충돌 회피.
dependsOn: [T-0037]
blocks: []
hqOrigin: null
humanApprovalGate: false
supersedes: null
---

# T-0038 — p3-implementation-plan §2 시퀀스 표 갱신

## Why

[docs/architecture/p3-implementation-plan.md](../architecture/p3-implementation-plan.md) §2 의 P3 task 시퀀스 표는 **원안 8 task 매핑** (T-0033 ~ T-0040) 을 박제한 planning artifact ([T-0032](T-0032-p3-entry-implementation-plan.md) 산출물). 그러나 P3 실제 진행 (T-0033 ~ T-0037 머지 완료) 결과 다음 두 가지 변화가 발생:

1. **원안 T-0034 가 두 task 로 자연 split** — 원안 T-0034 는 "Person + ServiceIdentity entity + UserModule + Person CRUD + ServiceIdentity 1:N + Person.active soft delete invariant" 를 한 task 로 박제 (~290 LOC). 실제로는 cap 보존을 위해 **T-0034 (Person repository + UserModule + 첫 migration)** + **T-0035 (ServiceIdentity entity + 1:N)** 로 분할 진행. 또한 PersonService + Controller + DTO 가 별도 **T-0036** 으로 추가 진입 (원안에는 entity 단계만 있고 service/controller layer 가 묵시), **T-0037 patch** (active+other 동시 처리 fix) 까지 더해져 P3 실제 진행은 원안 시퀀스를 한 자리 이상 shift.
2. **잔여 task ID 매핑 mismatch** — 원안 T-0035 (Group+Part) 가 실제로는 **T-0038** 로 자연 shift. 후속 시퀀스 (User+AuthModule / Assessment+Contribution+Summary / LlmProviderConfig+DifficultyMapping / PermissionDeniedRecord / Cross-cutting field) 도 한 자리씩 밀려 **T-0039 / T-0040 / T-0041 / T-0042 / T-0043** 으로 shift.

이 mismatch 가 박제되지 않으면 **다음 planner 가 backbone task ID 결정 시 plan §2 의 outdated 매핑을 그대로 reference** → task ID 충돌 (이미 머지된 T-0036 이 원안에서는 User+AuthModule 인데 실제로는 PersonService 임) → task 작성 시 dependsOn / Required Reading 의 ID reference 가 모두 outdated → reviewer 가 PR diff 의 reference 정합성 점검 시 confused.

따라서 본 task 는 plan §2 표 갱신 + §3 mermaid graph 갱신 + §4 ADR 표의 책임 task 컬럼 ID shift + §6/§7/§8 본문 reference 갱신을 박제한다. **doc-only direct commit** — 코드 / spec / 외부 dependency 변경 0.

## Required Reading

- [docs/architecture/p3-implementation-plan.md](../architecture/p3-implementation-plan.md) — 본 task 가 수정. 특히 §2 표 (L23–32) + §3 mermaid graph (L44–68) + §4 ADR 표 (L82–87) + §6 P3→P4 전이 조건 (L106–119) + §8 References (L138–155).
- [docs/tasks/T-0033-prisma-postgres-scaffold-and-persistence-module.md](T-0033-prisma-postgres-scaffold-and-persistence-module.md) — 원안 T-0033 으로 정상 머지 (frontmatter status DONE 확인).
- [docs/tasks/T-0034-person-repository-and-user-module-skeleton.md](T-0034-person-repository-and-user-module-skeleton.md) — 원안 T-0034 의 Person 부분만 박제 (ServiceIdentity 가 T-0035 로 split out).
- [docs/tasks/T-0035-service-identity-entity-and-repository.md](T-0035-service-identity-entity-and-repository.md) — 원안 T-0034 의 ServiceIdentity 부분이 split out 한 task. plan §2 에는 별도 row 없음 — 본 갱신으로 row 추가.
- [docs/tasks/T-0036-person-service-controller-dto.md](T-0036-person-service-controller-dto.md) — PersonService + Controller + DTO + class-validator stack. 원안에 없는 task — 본 갱신으로 row 추가.
- [docs/tasks/T-0037-patch-active-and-other-fields-fix.md](T-0037-patch-active-and-other-fields-fix.md) — T-0036 MAJOR-2 confirmed gap patch. 원안에 없는 task — 본 갱신으로 row 추가 (또는 footnote 박제).
- [docs/STATE.json](../STATE.json) — `mostRecentTasks` ([T-0037, T-0036, T-0035, T-0034, T-0033]) + `counters.tasksCompleted=36` — 본 갱신의 실제 시퀀스 source.
- [docs/PLAN.md](../PLAN.md) Phase P3 단락 (L47–63) — bullet level 매핑 확인 (PLAN 본문 자체는 본 task scope 외 — plan §2 표만 갱신).
- [CLAUDE.md](../../CLAUDE.md) §3.1 (doc-only = direct commit).

## Acceptance Criteria

본 task 의 모든 항목은 file inspection 으로 검증 가능. doc-only direct commit 이므로 R-110~R-114 의 test 의무는 본 task 에 적용되지 않음 (production code 변경 0). 단 §3.1 의 commitMode=direct 조건 (변경 대상이 doc 만) 은 reviewer 의 자체 점검 시 게이트.

### A. §2 표에 신규 row 3 개 추가 (T-0035 ServiceIdentity / T-0036 PersonService / T-0037 patch)

- [ ] 기존 T-0034 row 의 "책임" 컬럼을 **"Person entity Prisma model + Person repository + UserModule skeleton + 첫 migration. ServiceIdentity 는 T-0035 로 split out, PersonService/Controller/DTO 는 T-0036."** 으로 갱신. ServiceIdentity 박제 문구 제거.
- [ ] T-0034 row 와 T-0035 row 사이 (또는 T-0034 직후) 에 **신규 row "T-0035 — ServiceIdentity entity Prisma model + ServiceIdentityRepository + Person↔ServiceIdentity 1:N + 두 번째 migration"** 추가. 책임 / 대응 PLAN bullet (L52 + L53 서비스 ID 매핑 + Primary key 역할 ID) / dependsOn (T-0034) / ADR 필요 여부 (없음) / 인간 승인 게이트 (없음) / est LOC (~180 실측) / 책임 module (UserModule) 컬럼 채움.
- [ ] T-0035 (신규) row 다음에 **신규 row "T-0036 — PersonService + PersonController + Person DTO + class-validator + class-transformer 도입 + REQ-026/REQ-027 active soft delete invariant service layer 강제"** 추가. 책임 / PLAN bullet (L51 인원 관리 + L60 User read-only 권한 일부) / dependsOn (T-0034) / ADR 필요 여부 (없음 — HQ-0005 사용자 결정으로 class-validator stack 도입, ADR 박제 후보지만 본 task scope 외) / 인간 승인 게이트 (있음 — HQ-0005 처리 완료) / est LOC (~280 실측) / 책임 module (UserModule) 컬럼 채움.
- [ ] T-0036 (신규) row 다음에 **신규 row "T-0037 — PATCH /api/persons/:id 의 active+other 동시 처리 semantics fix (T-0036 MAJOR-2 confirmed gap patch)"** 추가. 책임 / PLAN bullet (L51 인원 관리 — REQ-026/REQ-027 active semantic 보강) / dependsOn (T-0036) / ADR 필요 여부 (없음) / 인간 승인 게이트 (없음) / est LOC (~140 실측) / 책임 module (UserModule) 컬럼 채움.

### B. §2 표의 원안 T-0035 ~ T-0040 row 의 task ID 컬럼 shift

- [ ] 원안 **T-0035 (Group+Part) → T-0038** 갱신.
- [ ] 원안 **T-0036 (User+AuthModule+ADR-0004) → T-0039** 갱신.
- [ ] 원안 **T-0037 (Assessment+Contribution+Summary) → T-0040** 갱신.
- [ ] 원안 **T-0038 (LlmProviderConfig+DifficultyMapping) → T-0041** 갱신.
- [ ] 원안 **T-0039 (PermissionDeniedRecord) → T-0042** 갱신.
- [ ] 원안 **T-0040 (Cross-cutting field+ADR-0005) → T-0043** 갱신.
- [ ] 각 row 의 dependsOn 컬럼도 shift 정합. 예: 원안 T-0037 fan-out (T-0038/T-0039/T-0040) → 신규 T-0040 fan-out (T-0041/T-0042/T-0043).
- [ ] 새 dependsOn 그래프 cycle 0 검산 (mental check).

### C. §2 합계 단락 갱신

- [ ] **"8 task" → "11 task"** (T-0033 / T-0034 / T-0035 / T-0036 / T-0037 / T-0038 / T-0039 / T-0040 / T-0041 / T-0042 / T-0043). PLAN bullet cover 합계는 변경 없음 (10 bullet 그대로).
- [ ] **dependency 검산 단락** 갱신: "T-0033 root → T-0034 → T-0035 (ServiceIdentity split) → T-0036 (PersonService) → T-0037 (patch) → T-0038 (Group+Part) fan-out → T-0040 (Assessment+Contribution+Summary) fan-out (T-0041/T-0042/T-0043)" 형태로 실측 + 원안 통합.

### D. §3 mermaid 의존성 graph 갱신

- [ ] mermaid block (L44–68) 의 노드 ID 재명명: T0035 → T0038 / T0036 → T0039 / T0037 → T0040 / T0038 → T0041 / T0039 → T0042 / T0040 → T0043.
- [ ] 신규 노드 추가: **T0035 ("ServiceIdentity entity + 1:N")** / **T0036 ("PersonService + Controller + DTO + class-validator")** / **T0037 ("Patch active+other 동시 처리 fix")**.
- [ ] 엣지 재구성:
  - T0033 → T0034
  - T0034 → T0035 (신규 ServiceIdentity)
  - T0035 → T0036 (신규 PersonService 가 ServiceIdentity 보다 뒤 — 실제 머지 순서 정합. 또는 T0034 → T0036 직접 — 둘 중 architect 판단. dependsOn frontmatter 가 T-0034 로 박제됨.)
  - T0036 → T0037 (신규 patch)
  - T0037 → T0038 (Group+Part, 다음 backbone)
  - T0034 → T0039 (User+AuthModule, T0034 fan-out 으로 원안 유지)
  - T0034 → T0040 (Assessment+Contribution+Summary, T0034 fan-out)
  - T0040 → T0041, T0040 → T0042, T0040 → T0043 (원안 T0037 fan-out 의 shift)
- [ ] classDef + class 호출의 빨강 게이트 표시 갱신: T0033 root/gate 유지 / **T0039** (auth credential ADR-0004 동반) / **T0043** (cross-cutting ADR-0005 동반).

### E. §4 ADR 후보 표의 책임 task 컬럼 shift

- [ ] "ADR-0004 — Auth credential type" row 의 책임 task: T-0036 → **T-0039**.
- [ ] "ADR-0005 — Cross-cutting field policy" row 의 책임 task: T-0040 → **T-0043**.
- [ ] "ADR-0006 (hook) — LLM API key encryption-at-rest" row 의 책임 task reference: T-0038 → **T-0041** (또는 "P4 의 후속 task" 추상 표기 유지 가능 — architect 판단).
- [ ] "ADR-0007 (hook) — Audit log entity schema" row 의 책임 task reference 는 "P3 끝 또는 P4 (별도 task)" 추상 표기 유지.

### F. §5 인간 승인 게이트 단락 갱신

- [ ] 본문 "T-0033 단일 task" 박제는 그대로 유지 (T-0033 은 실제로 새 dependency 3 종 도입 시 HQ-0004 발화 → 사용자 (a) accept-latest-stable 결정 → 정상 머지).
- [ ] **신규 footnote 추가** — T-0036 (PersonService+Controller+DTO) 도입 시 HQ-0005 발화 (class-validator + class-transformer 2 패키지 추가) → 사용자 (a) standard-class-validator-stack 결정 → 정상 머지. plan §2 원안에는 미박제 — 본 갱신으로 박제.
- [ ] T-0039 (User+AuthModule, 원안 T-0036) 의 ADR-0004 신설 footnote 박제 유지.

### G. §6 P3 → P4 전이 조건 갱신

- [ ] "11 entity Prisma model 박제" 단락에서 entity inventory 그대로 (변경 없음).
- [ ] "5 module skeleton 박제" 단락에서 module inventory 그대로 (변경 없음).
- [ ] "3 ADR 신설" 단락에서 책임 task ID reference 갱신: ADR-0004 = T-0039 (원안 T-0036) / ADR-0005 = T-0043 (원안 T-0040).
- [ ] **신규 단락 추가**: "P3 진행 중 task 시퀀스 expansion — 원안 8 task 가 실제 진행 중 entity split + service layer 추가 + patch 추가로 11 task 로 expand. 실제 P3 closure 시점에서 다시 한 자리 추가 shift 가능 (architect 의 cap 재평가 + planner split 결정)." 1–2 문장.

### H. §7 Out of scope 갱신

- [ ] "data-model.md 합계 단락 정정" 항목 그대로 (변경 없음).
- [ ] "task 시퀀스의 의존성 cycle 검증 자동화" 항목 그대로 (변경 없음).
- [ ] **신규 항목 추가**: "본 갱신은 §2 표 + §3 graph + §4/§5/§6 footnote 만 — PLAN.md 본문 P3 단락 (L47–63) 의 bullet level 갱신 안 함. PLAN 본문은 PLAN bullet 자체가 phase-level 추상화이므로 task ID shift 의 영향 없음."

### I. §8 References 갱신

- [ ] References 단락의 task ID reference 가 신규 시퀀스와 정합. 특히 "Refs:" 마지막 줄의 T-NNNN 목록은 본 갱신과 직접 관련 없으나 (실제 머지된 task ID 가 reference 면 충분), 새로 추가된 T-0035 / T-0036 / T-0037 도 Refs 에 추가하여 grep 가능성 확보.

### J. 파일 inspection 검증

- [ ] `docs/architecture/p3-implementation-plan.md` 의 §2 표가 11 row (3 신규 + 8 기존, ID shift 반영) 로 존재.
- [ ] §3 mermaid block 이 11 노드 + 정합 엣지로 구성.
- [ ] §4 ADR 표의 책임 task ID 가 shift 후 ID 와 정합.
- [ ] 본문 내 모든 T-NNNN reference (§5, §6, §7, §8) 가 shift 후 ID 와 정합. 본 task 자체 (T-0038) 도 §8 Refs 에 추가.
- [ ] `grep -nE "T-003[5-9]|T-004[0-3]" docs/architecture/p3-implementation-plan.md` 결과가 신규 시퀀스만 표시 (원안 outdated reference 0).

### K. Direct commit + journal + STATE 갱신 (driver 책임 — 본 task 의 Acceptance Criteria 가 아닌 driver loop 의 책임)

- [ ] driver 가 본 task 의 doc-only 변경 (p3-implementation-plan.md 1 파일) + STATE.json (currentTask=null 갱신 / lastCommit / mostRecentTasks shift / counters.tasksCompleted +1) + journal-2026-MM-DD.md (4–5 줄 append) 을 하나의 direct commit 으로 main 에 push.
- [ ] commit message 의 trail blob 에 PLANNER section 포함 (본 task 의 plannerNote 한 줄).

## Out of Scope

본 task 는 **다음을 하지 않는다** — 후속 task 책임 ([CLAUDE.md §3](../../CLAUDE.md) cap discipline + doc-only direct 원칙):

- **PLAN.md 본문 P3 단락 (L47–63) 의 bullet 갱신** — PLAN bullet 은 phase-level 추상화 (예: "평가 대상 인원 관리 (CRUD, group, deactivate/activate)") 로, task ID shift 의 영향 없음. 본 task scope 외.
- **신규 ADR 신설** — ADR-0004 (auth credential) / ADR-0005 (cross-cutting field) 의 실제 신설은 각각 책임 task (신규 T-0039 / T-0043) 의 권한. 본 task 는 plan §4 표의 책임 task 컬럼 ID shift 만.
- **다음 backbone task (Group+Part = 신규 T-0039) 의 정의서 작성** — 다음 planner 호출에서 별도 task 신설 (T-0039). 본 task 는 단지 plan §2 표 shift 박제만.
- **data-model.md / api.md / modules.md / directory.md / components.md 갱신** — 본 task 는 p3-implementation-plan.md 1 파일만. 다른 P1/P2 artifact 갱신 책임 없음.
- **Group + Part entity Prisma model 작성 / 구현** — 신규 T-0039 의 책임. 본 task 는 plan 박제만.
- **T-0035 (ServiceIdentity) / T-0036 (PersonService) / T-0037 (patch) 의 실제 머지 commit hash / PR 번호 박제** — 본 task 의 §2 표는 task ID + 책임 + dependsOn 만 박제. 실제 commit hash / PR 번호는 git log / STATE.json 으로 충분.
- **자동 dependency linter 도입** — task ID reference 정합성 자동 검증 도구 신설 안 함 (별도 ops task 후보).
- **.gitattributes CRLF 정책 ADR / partial unique index ADR / cap LOC ADR** — T-0037 Follow-ups 의 별도 후보. 본 task scope 외.
- **`src/main.ts` global ValidationPipe wire + validation e2e** — T-0036 Follow-ups 의 T-0036.6 후보. 별도 task. 본 task scope 외.

## Suggested Sub-agents

본 task 는 **doc-only direct commit** — 별도 sub-agent dispatch 없이 **driver 가 직접 수행 가능**. driver 가 (a) p3-implementation-plan.md read (b) §2 표 11 row 재구성 + §3 graph 11 노드 재구성 + §4/§5/§6/§7/§8 본문 ID shift (c) STATE.json + journal 갱신 (d) 하나의 direct commit 으로 main push. architect / implementer / tester / reviewer / integrator 호출 불필요. 대신 driver 가 본 task 의 Acceptance Criteria 11 항목 (A~K) 을 한 번에 inspect 하며 실수 없이 진행.

선택적으로 (driver 가 cap-시간 여유 시) `architect` 1 회 호출하여 §3 mermaid graph 의 엣지 구성을 재검토 가능 — 특히 신규 T0034 → T0036 직접 vs T0034 → T0035 → T0036 의 의존성 chain 결정 (실제 frontmatter 의 dependsOn 은 T-0034 이나, 자연 진행 순서로는 T-0035 후 T-0036 가 더 정합). architect 미호출 시 driver 의 mental check 으로 진행.

## Follow-ups

(driver 가 본 task 진행 중 관찰한 후속 작업을 본 절에 append. 본 task 머지 후 planner 가 본 절을 읽고 후속 task 큐잉 판단.)

- **신규 T-0039 (Group + Part entity + Person↔Group N:M + Person↔Part N:1 mandatory invariant)** — 본 task 머지 직후 자연스러운 다음 backbone task. P3 phase progress 의 핵심 진척. pr-mode + ADR 없음 + 인간 승인 게이트 없음 (entity 추가만, 새 외부 dependency 0).
- **HQ-0005 의 class-validator stack 도입 박제 ADR 신설 검토** — class-validator + class-transformer 2 패키지 도입이 HQ-0005 처리만으로 끝났고 ADR 박제 없음. ADR-0001 의 NestJS stack 보강 차원에서 별도 doc-only direct task 후보 (1 ADR 추가 = pr-mode 또는 ADR status update 만이면 direct).
- **T-0036.6 후보 — `src/main.ts` global ValidationPipe wire + validation e2e** — T-0036 / T-0037 Follow-ups 에서 박제. pr-mode + ~60 LOC. P3 validation 안전망 완성.
- **dedicated `POST /:id/deactivate` / `/reactivate` endpoint ADR 신설 검토** — T-0037 Follow-ups. Admin UI 직관성 측면.
- **.gitattributes CRLF 정책 ADR** — T-0037 Follow-ups. local lint friction 해소.
