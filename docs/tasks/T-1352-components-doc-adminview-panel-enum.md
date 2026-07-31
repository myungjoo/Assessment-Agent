---
id: T-1352
title: components.md 113 행 AdminView shipped 열거를 PLAN 122 행 실측(패널 10 종·러너 26)과 정합
phase: P6
status: PENDING
commitMode: direct
coversReq: [REQ-049, REQ-038]
estimatedDiff: 10
estimatedFiles: 2
created: 2026-07-31
independentStream: p6-plan-residual-resync
dependsOn: [T-1351]
touchesFiles:
  - docs/architecture/components.md
  - docs/tasks/T-1352-components-doc-adminview-panel-enum.md
plannerNote: "T-1351 Follow-up ① — components 113 행 AdminView 열거가 5 항목뿐, PLAN 122 행 실측(10 종·26 러너)과 어긋남"
---

# T-1352 — components.md 113 행 AdminView shipped 열거를 PLAN 122 행 실측(패널 10 종·러너 26)과 정합

## Why

`p6-plan-residual-resync` stream 은 [T-1347](T-1347-plan-p6-panel-mount-residual-resync.md)(`2c3b2164`) → [T-1348](T-1348-modules-doc-defer-list-resync.md)(`7a449534`) → [T-1349](T-1349-components-doc-panel-mount-resync.md)(`ed8cd7d7`) → [T-1350](T-1350-plan-admin-panel-marker-rejudge.md)(`aeb59675`) → [T-1351](T-1351-plan-owner-quote-editorial-note.md)(`e396f457`) 으로 **defer 목록 축**(실 defer = `EvaluationGuardBanner` 자동 polling 1 항목)과 **PLAN 마커·인용문 축**을 모두 닫았다. 남은 것은 [T-1351 Follow-up ①](T-1351-plan-owner-quote-editorial-note.md)(= [T-1350 Follow-up ②](T-1350-plan-admin-panel-marker-rejudge.md) 이월)이 지목한 **열거 축**이다 — T-1350 이 PLAN 에만 박제한 실측(패널 **10 종** 마운트 · mutation 러너 **26** 개)이 아직 `docs/architecture/components.md` 에 반영되지 않았다.

현재 [components.md](../architecture/components.md) **113 행**(`**Web UI**` 표 행)의 `AdminView` 괄호 열거는 `GroupMemberList` 조회 · `DifficultyModelSelector` · export/import · RBAC gating · `SchedulePanel` 마운트 · `ReEvaluationTriggerPanel` 마운트 **6 항목뿐**이며, 실제로 마운트된 `PersonList` · `GroupList` · `PartList` · `UserList` · `LlmProviderConfigList` 5 종과 mutation 러너 26 개 배선이 통째로 빠져 있다(실측: `web/src/views/AdminView.tsx` 4274 · 4303 · 4316 · 4484 · 4493 · 4525 · 4576 · 4743 · 4826 · 4911 · 4938 행 = **11 hit / 구별 10 종**, `PersonList` 만 2 회).

파급은 앞선 다섯 slice 와 같은 실패 모드다 — 아키텍처 문서만 읽는 planner 가 이미 shipped 인 Admin CRUD 표면(인원·그룹·파트·사용자·provider)을 "미배선" 으로 오판해 **중복 task 를 큐잉**한다. 본 slice 는 열거 축의 마지막 locus 를 닫아 stream 을 종결한다.

## Required Reading

- [docs/architecture/components.md](../architecture/components.md) **113 행** — 유일한 수정 대상. `| **Web UI** | ... |` 표 행이며 **한 줄**(편집 전 1404 자, pipe **6** 개). 수정 요소는 그 안의 `AdminView (...)` **괄호 열거 1 곳뿐**.
- [docs/PLAN.md](../PLAN.md) **122 행** — 읽기 전용 정본. [T-1350](T-1350-plan-admin-panel-marker-rejudge.md) 이 박제한 열거·수치(패널 10 종 · mutation 러너 26 · CRUD/멤버/provider 배선)의 출처. 본 slice 는 이 서술을 components.md 의 문체·분량에 맞춰 **압축 반영**한다. **PLAN.md 수정 금지.**
- `web/src/views/AdminView.tsx` — 읽기 전용 실측 대상. 실측 명령 2 종을 executor 가 직접 실행해 본문 수치를 재확인한다(불일치 시 **실측이 정본**, 편집 대신 Follow-ups 기록):
  - `grep -cE "^\s*<(PersonList|GroupList|PartList|UserList|LlmProviderConfigList|GroupMemberList|DifficultyModelSelector|DataImportExportPanel|SchedulePanel|ReEvaluationTriggerPanel)" web/src/views/AdminView.tsx` → **11**(구별 **10 종**).
  - `grep -cE "^async function run[A-Za-z]+" web/src/views/AdminView.tsx` → **26**.
- [docs/tasks/T-1350-plan-admin-panel-marker-rejudge.md](T-1350-plan-admin-panel-marker-rejudge.md) 완료 요약 — 실측 수치의 선행 검증 기록.

## Acceptance Criteria

- [ ] **실측 재확인** — 위 2 종 grep 이 각각 **11** · **26**. 하나라도 어긋나면 편집하지 말고 실측값을 Follow-ups 에 적고 종료한다.
- [ ] **열거 보강(추가만)** — 113 행 `AdminView (...)` 괄호 안의 기존 6 항목(`GroupMemberList` 조회 · `DifficultyModelSelector` · export/import · RBAC gating · `SchedulePanel` 마운트 · `ReEvaluationTriggerPanel` 마운트)은 **링크 포함 문구 그대로 보존**하고, 누락된 `PersonList` · `GroupList` · `PartList` · `UserList` · `LlmProviderConfigList` 마운트와 mutation 러너 배선(인원/그룹/파트/사용자 CRUD · 멤버 add/remove · provider CRUD)을 **추가만** 한다. 구별 패널 **10 종** · 러너 **26** 두 수치를 명시하고, 근거로 PLAN 122 행 또는 [T-1350](T-1350-plan-admin-panel-marker-rejudge.md) 를 pointer 로 건다.
- [ ] **defer 서술 불변** — 113 행 뒤쪽의 `남은 잔여 표면은 `EvaluationGuardBanner` 자동 polling 1 항목뿐이며 backend status 계약 확정 후 배선한다 — [modules.md](modules.md) 의 defer 서술 참조.` 문장이 **문구 그대로** 남는다([T-1349](T-1349-components-doc-panel-mount-resync.md) 박제). 편집 후 `grep -c "polling" docs/architecture/components.md` = **1 불변**.
- [ ] **구조 무손상** — 편집 후 `wc -l < docs/architecture/components.md` = **190 불변**, `grep -c "^| " docs/architecture/components.md` = **29 불변**, 113 행의 pipe 개수 = **6 불변**(`sed -n '113p' … | tr -cd '|' | wc -c`), 113 행은 여전히 **한 줄**(행 분할·중간 개행 금지 — 표가 깨진다).
- [ ] **검증 grep** — (a) `grep -c "PersonList" docs/architecture/components.md` ≥ **1**(편집 전 0), (b) `grep -c "LlmProviderConfigList" docs/architecture/components.md` ≥ **1**(편집 전 0), (c) `grep -c "T-0885\|T-0886" docs/architecture/components.md` = **1 불변**, (d) `grep -c "REQ-049" docs/architecture/components.md` = **5 불변**, (e) `grep -c "AdminView" docs/architecture/components.md` ≥ **1**.
- [ ] **diff 축 한정** — `git diff --stat` 이 `docs/architecture/components.md` · 본 task 파일 **2 개만** 보이고, components.md hunk 는 **113 행 1 개뿐**(`git diff -U0 -- docs/architecture/components.md` 의 hunk 헤더가 `@@ -113 +113 @@` 형태 1 개).
- [ ] **경계 준수** — `src/` · `web/` · `test/` · `prisma/` · `docs/PLAN.md` · `docs/architecture/modules.md` · `docs/architecture/directory.md` · `docs/use-cases/*` · `docs/requirements.md` · `docs/STATE.json` · `docs/progress/*` 무수정(§3.1 rule 3 · §9 STATE single-writer — STATE/journal 은 driver 소관). `git status --porcelain` 결과가 위 2 파일뿐.
- [ ] **R-110 tester 면제 근거 명시** — production code **0 LOC** doc-only direct commit 이라 tester 를 호출하지 않는다(R-112 4 종은 신규 symbol·분기 **0** 이라 해당 없음 — 분기 없음). 위 검증 grep + 구조 self-check 로 대체하고 결과를 task 파일 완료 요약에 박제한다([T-1313](T-1313-p6-deferred-residual-list-resync.md) · [T-1347](T-1347-plan-p6-panel-mount-residual-resync.md) ~ [T-1351](T-1351-plan-owner-quote-editorial-note.md) 선례). `pnpm lint` 는 doc 변경 무영향이라 실행 불요.

## Out of Scope

- **`web/` · `src/` 코드 수정 일체** — 본 slice 는 **문서를 이미 shipped 된 현실에 맞추는 것**이다. `AdminView.tsx` 는 읽기 전용 실측 대상.
- **`docs/PLAN.md` 재편집** — [T-1350](T-1350-plan-admin-panel-marker-rejudge.md)(122 행 마커·열거) · [T-1351](T-1351-plan-owner-quote-editorial-note.md)(116 행 편집 주)이 이미 정합시켰다.
- **`docs/architecture/modules.md` 237 행의 `15 개 presentational 컴포넌트` 수치 검증** — `web/src/components/` 실측과의 대조는 별개 축(다른 근거·다른 판정 기준). 필요 판단 시 Follow-ups 에 1 줄만 남긴다.
- **`docs/architecture/directory.md` 159 행** — view 컨테이너 2 개만 서술할 뿐 패널 열거가 없어 본 축의 stale locus 가 아니다.
- **`EvaluationGuardBanner` 자동 polling 배선** — backend status 계약 미shipped 로 여전히 진짜 defer. 배선은 계약 확정 후 별도 `pr` task.
- **components.md 의 다른 행·다른 컴포넌트 서술 손질** — 113 행 `AdminView` 괄호 열거 1 locus 만 다룬다.

## Suggested Sub-agents

`implementer` (doc-only · 표 행 1 곳 인라인 수정 — architect 불요, tester 면제. [T-1349](T-1349-components-doc-panel-mount-resync.md) · [T-1350](T-1350-plan-admin-panel-marker-rejudge.md) · [T-1351](T-1351-plan-owner-quote-editorial-note.md) 선례)

## Follow-ups

(작성 시점 비어 있음 — sub-agent 가 관련 작업 발견 시 append)
