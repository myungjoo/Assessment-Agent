---
id: T-1350
title: PLAN.md 120 행 Admin 패널 bullet 의 "(부분 완료)" 마커 재판정 + shipped 열거 실측 보강
phase: P6
status: PENDING
commitMode: direct
coversReq: [REQ-049, REQ-038]
estimatedDiff: 12
estimatedFiles: 2
created: 2026-07-31
independentStream: p6-plan-residual-resync
dependsOn: [T-1347]
touchesFiles:
  - docs/PLAN.md
  - docs/tasks/T-1350-plan-admin-panel-marker-rejudge.md
plannerNote: "T-1347 Follow-up ①이 이월한 축 — 120 행 마커·열거가 shipped 실측(패널 10 종·mutation 26 러너)과 어긋남"
---

# T-1350 — PLAN.md 120 행 Admin 패널 bullet 의 "(부분 완료)" 마커 재판정 + shipped 열거 실측 보강

## Why

[T-1347](T-1347-plan-p6-panel-mount-residual-resync.md) (머지 `2c3b2164`) → [T-1348](T-1348-modules-doc-defer-list-resync.md) (`7a449534`) → [T-1349](T-1349-components-doc-panel-mount-resync.md) (`ed8cd7d7`) 로 이어진 `p6-plan-residual-resync` stream 은 **defer 목록** 면을 네 문서에서 일치시켰다 (실 defer = `EvaluationGuardBanner` 자동 polling 1 항목). 그런데 T-1347 이 [자기 Follow-ups ①](T-1347-plan-p6-panel-mount-residual-resync.md) 에 명시적으로 이월한 **다른 축** 이 남아 있다 — [docs/PLAN.md](../PLAN.md) **120 행** 자체의 (a) `**(부분 완료 — shipped 계약 범위)**` 마커와 (b) 그 뒤의 **shipped 열거** 다.

두 요소 모두 실측과 어긋난다. (a) 마커의 "부분" 근거였던 defer 사유는 T-1347 이 같은 행에서 소멸을 박제했는데도 마커만 남아 있어, 같은 행이 스스로 모순된다 (앞은 "부분 완료", 뒤는 "defer 사유 소멸"). (b) 열거는 `GroupMemberList 조회 · DifficultyModelSelector · export/import · scope · RBAC gating` **5 항목뿐** 인데, 실제 `AdminView` 에는 패널 **10 종** 이 마운트돼 있고 (`PersonList` · `GroupList` · `PartList` · `UserList` · `LlmProviderConfigList` 가 열거에서 통째로 누락) mutation 러너도 **26 개** 배선돼 있다 (person/group/part/user CRUD · 멤버 add/remove · provider CRUD · 역할 변경 · 인스턴스 접근 grant/revoke).

파급은 앞선 세 slice 와 같은 실패 모드다 — 문서만 읽는 planner 가 이미 shipped 인 Admin 표면을 "미배선" 으로 오판해 **중복 task 를 큐잉** 한다. 본 slice 는 그 오도 표면을 실측으로 닫아 P6 Admin 패널 축을 종결한다.

## Required Reading

- `docs/PLAN.md` **120 행** — 유일한 수정 대상. `## Phase P6 — Web UI` (114 행) 아래 **네 번째 체크박스 bullet** 이며 **한 줄** 이다 (편집 전 623 자). 수정 요소는 2 개뿐: (a) `**(부분 완료 — shipped 계약 범위)**` 마커, (b) 그 뒤 `AdminView(④a~④h, T-0385~T-0392)로 … 조립 완료(REQ-049)` 의 열거 부분. **`단 **재평가(ReEvaluationTriggerPanel)·스케줄(SchedulePanel) 도 AdminView 에 마운트 완료** — …` 이후 문장 (T-1347 이 박제한 T-0885 · T-0886 근거 절) 은 불변 유지.**
- `docs/PLAN.md` **123 행** — 읽기 전용 정본 대조 (`남은 1 항목(EvaluationGuardBanner 자동 polling)만이 실제 defer 다`). 본 slice 가 마커를 승격해도 이 서술과 **모순되지 않아야** 한다 — polling defer 는 120 행 bullet 이 아니라 **121 행 R-78 bullet** 소관이기 때문이다. **123 행 수정 금지.**
- `docs/PLAN.md` **121 행** — 읽기 전용. `평가 진행 중 시각화 보호 (R-78) … **(완료 — 배선)** … 단 자동 polling 은 … defer` — polling 잔여의 **소유 행** 이 120 행이 아님을 확인하는 근거.
- 실측 명령 4 종 (executor 가 직접 실행해 본문 수치를 재확인한다 — 불일치 시 **실측이 정본**, Follow-ups 에 기록):
  - `grep -cE "^\s*<(PersonList|GroupList|PartList|UserList|LlmProviderConfigList|GroupMemberList|DifficultyModelSelector|DataImportExportPanel|SchedulePanel|ReEvaluationTriggerPanel)" web/src/views/AdminView.tsx` → **11** (구별 컴포넌트 **10 종**, `PersonList` 만 4743 · 4938 두 번 — 인원 목록과 파트 소속 인원 목록).
  - `grep -cE "^async function run[A-Za-z]+" web/src/views/AdminView.tsx` → **26** (mutation/작업 러너 총수).
  - `git grep -n "runCreatePerson\|runUpdatePerson\|runDeletePerson\|runCreateGroup\|runCreatePart\|runCreateUser\|runChangeRole" -- web/src/views/AdminView.tsx` → 인원 · 그룹 · 파트 · 사용자 CRUD 배선 실재 확인 (7 hit 이상).
  - `grep -n "부분 완료" docs/PLAN.md` → 편집 전 **2 hit** (106 · 120 행). 106 행 (R-64) 은 **다른 축이라 불변**.

## Acceptance Criteria

- [ ] **(a) 마커 승격** — 120 행의 `**(부분 완료 — shipped 계약 범위)**` 를 `**(완료)**` 로 교체하고, 승격 근거를 같은 행 안에 **한 구절** 로 박제한다 (패널 10 종 마운트 + mutation 러너 26 개 배선 + defer 잔여 0 — polling 은 121 행 R-78 bullet 소관). 위 실측 4 종 중 하나라도 본문 수치와 어긋나면 **승격하지 말고** 마커를 유지한 채 잔여를 정확히 서술하고 Follow-ups 에 불일치를 기록한다.
- [ ] **(b) shipped 열거 보강** — 기존 열거 (`GroupMemberList 조회 · DifficultyModelSelector · export/import · scope · RBAC gating`) 는 **문구 그대로 보존** 하고, 누락된 마운트 패널 `PersonList` · `GroupList` · `PartList` · `UserList` · `LlmProviderConfigList` 와 mutation 배선 (인원/그룹/파트/사용자 CRUD · 멤버 add/remove · provider CRUD) 을 **추가만** 한다. 근거 task 링크는 [T-1130](T-1130-adminview-member-remove.md) · [T-1131](T-1131-adminview-member-add.md) · [T-1133](T-1133-llm-provider-list.md) 중 **실재하는 파일만** 상대경로 `tasks/T-NNNN-<slug>.md` 형태로 건다 (`ls docs/tasks/T-1130*` 등으로 파일명 확인 후 링크 — 깨진 링크 금지).
- [ ] **T-1347 박제 절 불변** — 편집 후 `grep -c "T-0885\|T-0886" docs/PLAN.md` = **편집 전과 동일**, 120 행의 `defer 사유였던 backend 계약 미shipped 상태가 소멸했다(P7 133~135 행 shipped 서술이 반증).` 문장이 **문구 그대로** 남아 있다.
- [ ] **구조 무손상** — 편집 후 `wc -l docs/PLAN.md` = **173 불변**, `grep -c "^- \[x\]" docs/PLAN.md` = **60 불변**, `grep -c "^- \[ \]" docs/PLAN.md` = **6 불변**, 120 행은 여전히 **한 줄** (행 분할 · 중간 개행 금지).
- [ ] **검증 grep** — (a) `grep -c "부분 완료" docs/PLAN.md` = **1** (106 행만 잔존 — 승격 시), (b) `grep -c "PersonList" docs/PLAN.md` ≥ **1**, (c) `grep -c "LlmProviderConfigList" docs/PLAN.md` ≥ **1**, (d) `grep -n "polling" docs/PLAN.md` 결과에 **120 행이 등장하지 않는다** (polling 잔여는 121 · 123 행 소관 — 120 행으로 옮기지 않는다), (e) `grep -c "REQ-049" docs/PLAN.md` = **편집 전과 동일** (REQ 참조 보존).
- [ ] **diff 축 한정** — `git diff --stat` 이 `docs/PLAN.md` · 본 task 파일 **2 개만** 보이고, PLAN.md hunk 는 **120 행 1 개뿐** (106 · 121 · 123 행은 diff 에 등장하지 않는다).
- [ ] `src/` · `web/` · `test/` · `prisma/` · `docs/architecture/*` · `docs/use-cases/*` · `docs/requirements.md` · `docs/STATE.json` · `docs/progress/*` 는 수정하지 않는다 (§3.1 rule 3 · §9 STATE single-writer — STATE/journal 은 driver 소관). `git status --porcelain` 결과가 위 2 파일뿐.
- [ ] doc-only 라 R-110 tester 면제 (production code 0 LOC · 신규 symbol/분기 0 → R-112 신규 test 대상 없음, [T-1313](T-1313-p6-deferred-residual-list-resync.md) · [T-1347](T-1347-plan-p6-panel-mount-residual-resync.md) · [T-1348](T-1348-modules-doc-defer-list-resync.md) · [T-1349](T-1349-components-doc-panel-mount-resync.md) 선례) — 위 검증 grep + 구조 self-check 로 대체한다. `pnpm lint` 는 doc 변경 무영향이라 실행 불요.

## Out of Scope

- **`web/` · `src/` 코드 수정 일체** — 본 slice 는 **문서를 이미 shipped 된 현실에 맞추는 것** 이다. `AdminView.tsx` 는 한 글자도 건드리지 않는다 (읽기 전용 실측 대상).
- **`docs/PLAN.md` 106 행 (R-64 `(부분 완료)`) 재판정** — 평가 재실행·부분 reset 축이라 근거·판정 기준이 전혀 다르다. 같은 어휘가 겹칠 뿐 별도 slice.
- **`docs/PLAN.md` 116 행 (오너 승인 인용문 안의 stale 패널 열거)** — 인용문 원문 보존 vs 편집 주 부기 판단이 걸린 별도 축 ([T-1347](T-1347-plan-p6-panel-mount-residual-resync.md) · [T-1348](T-1348-modules-doc-defer-list-resync.md) Out of Scope 가 이미 분리).
- **`docs/architecture/components.md` · `modules.md` · `directory.md` 재수정** — [T-1348](T-1348-modules-doc-defer-list-resync.md) · [T-1349](T-1349-components-doc-panel-mount-resync.md) 가 이미 정합시켰다. 세 문서를 PLAN 열거와 **다시** 맞추는 작업이 필요해 보이면 Follow-ups 에 1 줄만 남긴다.
- **`EvaluationGuardBanner` 자동 polling 배선** — backend status 계약 미shipped 로 여전히 진짜 defer. 배선은 계약 확정 후 별도 `pr` task.
- **P6 나머지 bullet · 게이트된 backlog 3 종 (web vitest CI · web coverageThreshold · polling) 재서술** — 각각 credential/새-dep 게이트가 걸린 별개 축이라 본 slice 에서 판정하지 않는다.

## Suggested Sub-agents

`implementer` (doc-only · PLAN bullet 1 행 인라인 수정 — architect · tester 불요, [T-1313](T-1313-p6-deferred-residual-list-resync.md) · [T-1347](T-1347-plan-p6-panel-mount-residual-resync.md) · [T-1348](T-1348-modules-doc-defer-list-resync.md) · [T-1349](T-1349-components-doc-panel-mount-resync.md) 선례)

## Follow-ups

(작성 시점 비어 있음 — sub-agent 가 관련 작업 발견 시 append)
