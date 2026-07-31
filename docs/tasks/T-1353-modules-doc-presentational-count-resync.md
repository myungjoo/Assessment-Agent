---
id: T-1353
title: modules.md 237 행 `15 개 presentational 컴포넌트` 수치를 현행 실측(21 종)과 정합
phase: P6
status: DONE
commitMode: direct
coversReq: [REQ-049, REQ-038]
estimatedDiff: 12
estimatedFiles: 2
created: 2026-08-01
independentStream: p6-plan-residual-resync
dependsOn: [T-1352]
touchesFiles:
  - docs/architecture/modules.md
  - docs/tasks/T-1353-modules-doc-presentational-count-resync.md
plannerNote: "T-1352 Follow-up — modules 237 행이 presentational 을 15 개로 서술, 실측 21 종(후속 6 종 누락)"
---

# T-1353 — modules.md 237 행 `15 개 presentational 컴포넌트` 수치를 현행 실측(21 종)과 정합

## Why

`p6-plan-residual-resync` stream 은 [T-1347](T-1347-plan-p6-panel-mount-residual-resync.md)(`2c3b2164`) → [T-1348](T-1348-modules-doc-defer-list-resync.md)(`7a449534`) → [T-1349](T-1349-components-doc-panel-mount-resync.md)(`ed8cd7d7`) → [T-1350](T-1350-plan-admin-panel-marker-rejudge.md)(`aeb59675`) → [T-1351](T-1351-plan-owner-quote-editorial-note.md)(`e396f457`) → [T-1352](T-1352-components-doc-adminview-panel-enum.md)(`c07310b3`) 로 **defer 목록 축** · **PLAN 마커/인용문 축** · **components.md 열거 축**을 차례로 닫았다. 남은 locus 는 [T-1352 Follow-up](T-1352-components-doc-adminview-panel-enum.md) 이 지목한 **수치 축**이다.

[modules.md](../architecture/modules.md) **237 행**은 composition-wiring 스트림(T-0353~T-0394)을 서술하며 `15 개 presentational 컴포넌트` 라고 적는다. 그 수치는 [ADR-0041](../decisions/ADR-0041-frontend-composition-wiring.md) 14 행이 열거한 **결정 시점(T-0361~T-0375)의 15 종**으로는 정확하지만, 현재 `web/src/components/` 에는 **21 종**이 있다 — 이후 [T-1133](T-1133-llm-provider-list.md)(`LlmProviderConfigList`) · T-1139(`PermissionDeniedRecordList`) · T-1141(`PersonList`) · T-1147(`GroupList`) · T-1151(`PartList`) · T-1158(`UserList`) 6 종이 추가돼 [T-1350](T-1350-plan-admin-panel-marker-rejudge.md) 이 박제한 AdminView 패널 10 종 마운트의 재료가 됐다.

파급은 앞선 여섯 slice 와 같은 실패 모드다 — 아키텍처 문서만 읽는 planner 가 이미 shipped 인 목록형 컴포넌트(인원·그룹·파트·사용자·provider·permission-denied)를 "미작성" 으로 오판해 **중복 task 를 큐잉**한다. 본 slice 는 수치 축의 마지막 locus 를 닫아 stream 을 종결한다. 역사 서술(스트림이 조립한 15 종)은 [T-1351](T-1351-plan-owner-quote-editorial-note.md) 의 **편집 주 방식**과 동형으로 **보존**하고 현행 실측만 덧붙인다.

## Required Reading

- [docs/architecture/modules.md](../architecture/modules.md) **237 행** — 유일한 수정 대상. `composition-wiring 스트림 (T-0353~T-0394, ...)` 로 시작하는 **한 줄** 문단이며, 수정 요소는 그 안의 `15 개 presentational 컴포넌트` 서술 **1 곳뿐**. 앞뒤 234~235 행(소스 분리 · serve-static)과 239 행(의도적 defer 문단)은 **무수정**.
- [docs/decisions/ADR-0041-frontend-composition-wiring.md](../decisions/ADR-0041-frontend-composition-wiring.md) **14 행** — 읽기 전용. 결정 시점 15 종의 정본 열거(`EvaluationGuardBanner` · `LoginForm` · `EvaluationResultTable` · `DifficultyModelSelector` · `SuperAdminSetupForm` · `GroupMemberList` · `ReEvaluationTriggerPanel` · `DataImportExportPanel` · `SchedulePanel` · `DashboardFilterBar` · `TrendTimeSeriesPanel` · `DashboardPaginationControl` · `MetricSummaryCards` · `ScoreDistributionChart` · `EvaluationDetailPanel`). **ADR 수정 금지**(결정 시점 박제 + `pr` 대상).
- `web/src/components/` — 읽기 전용 실측 대상. executor 가 직접 실행해 본문 수치를 재확인한다(불일치 시 **실측이 정본**, 편집 대신 Follow-ups 기록):
  - `ls web/src/components/*.tsx | grep -v '\.test\.tsx' | wc -l` → **21**
  - `ls web/src/components/*.test.tsx | wc -l` → **21** (컴포넌트마다 spec 1:1)
  - 후속 6 종의 최초 추가 commit 은 `git log --oneline -1 --diff-filter=A -- web/src/components/<Name>.tsx` 로 확인 가능(planner 확인값: `LlmProviderConfigList`=T-1133 · `PermissionDeniedRecordList`=T-1139 · `PersonList`=T-1141 · `GroupList`=T-1147 · `PartList`=T-1151 · `UserList`=T-1158).
- [docs/tasks/T-1352-components-doc-adminview-panel-enum.md](T-1352-components-doc-adminview-panel-enum.md) 완료 요약 — 본 slice 를 지목한 Follow-up 과 AdminView 패널 10 종 실측의 선행 기록.

## Acceptance Criteria

- [ ] **실측 재확인** — 위 2 종 count 가 각각 **21** · **21**. 하나라도 어긋나면 편집하지 말고 실측값을 Follow-ups 에 적고 종료한다.
- [ ] **수치 정합(추가만)** — 237 행의 기존 문장(스트림 범위 · `AppShell` 괄호 설명 · 2 view 컨테이너 · controlled lift-up · thin fetch hook 서술)은 **문구 그대로 보존**하고, (a) `15 개` 가 **스트림 조립 시점(T-0361~T-0375, [ADR-0041](../decisions/ADR-0041-frontend-composition-wiring.md) 14 행) 수치**임을 명시 + (b) **현행 `web/src/components/` 실측 21 종** + (c) 이후 추가된 6 종과 그 task pointer(T-1133 · T-1139 · T-1141 · T-1147 · T-1151 · T-1158)를 **추가만** 한다. 기존 수치 `15` 를 `21` 로 단순 치환하는 편집은 금지(역사 서술 왜곡 — [T-1351](T-1351-plan-owner-quote-editorial-note.md) 편집 주 선례를 따른다).
- [ ] **defer 서술 불변** — 239 행의 `의도적 defer ... EvaluationGuardBanner 자동 polling` 문단이 **문구 그대로** 남는다([T-1348](T-1348-modules-doc-defer-list-resync.md) 박제). 편집 후 `grep -c "polling" docs/architecture/modules.md` = **1 불변**.
- [ ] **구조 무손상** — 편집 후 `wc -l < docs/architecture/modules.md` = **256 불변**, `grep -c "^| " docs/architecture/modules.md` = **38 불변**, `grep -c "ADR-0041" docs/architecture/modules.md` = **3 이상**(편집 전 3 — 링크 추가 시 증가 허용), 237 행은 여전히 **한 줄**(행 분할·중간 개행 금지 — 앞뒤 빈 줄 구조가 깨진다).
- [ ] **검증 grep** — (a) `grep -c "T-1141" docs/architecture/modules.md` ≥ **1**(편집 전 0), (b) `grep -c "UserList" docs/architecture/modules.md` ≥ **1**(편집 전 0), (c) `grep -c "15 개 presentational" docs/architecture/modules.md` = **1 불변**(역사 서술 보존 확인), (d) `grep -nc "21" docs/architecture/modules.md` ≥ **1**(현행 실측 반영 확인).
- [ ] **diff 축 한정** — `git diff --stat` 이 `docs/architecture/modules.md` · 본 task 파일 **2 개만** 보이고, modules.md hunk 는 **237 행 1 개뿐**(`git diff -U0 -- docs/architecture/modules.md` 의 hunk 헤더가 `@@ -237 +237 @@` 형태 1 개).
- [ ] **경계 준수** — `src/` · `web/` · `test/` · `prisma/` · `docs/PLAN.md` · `docs/architecture/components.md` · `docs/architecture/directory.md` · `docs/decisions/*` · `docs/use-cases/*` · `docs/requirements.md` · `docs/STATE.json` · `docs/progress/*` 무수정(§3.1 rule 3 · §9 STATE single-writer — STATE/journal 은 driver 소관). `git status --porcelain` 결과가 위 2 파일뿐.
- [ ] **R-110 tester 면제 근거 명시** — production code **0 LOC** doc-only direct commit 이라 tester 를 호출하지 않는다(R-112 4 종은 신규 symbol · 분기 **0** 이라 해당 없음 — 분기 없음). 위 검증 grep + 구조 self-check 로 대체하고 결과를 task 파일 완료 요약에 박제한다([T-1313](T-1313-p6-deferred-residual-list-resync.md) · [T-1347](T-1347-plan-p6-panel-mount-residual-resync.md) ~ [T-1352](T-1352-components-doc-adminview-panel-enum.md) 선례). `pnpm lint` 는 doc 변경 무영향이라 실행 불요.

## Out of Scope

- **`web/` · `src/` 코드 수정 일체** — 본 slice 는 **문서를 이미 shipped 된 현실에 맞추는 것**이다. `web/src/components/` 는 읽기 전용 실측 대상.
- **[ADR-0041](../decisions/ADR-0041-frontend-composition-wiring.md) 본문 수정(14 · 16 · 29 행의 `15 개` 서술 포함)** — ADR 은 결정 시점 박제라 사후 수치로 덮어쓰지 않으며, 변경 시 `commitMode: pr` 대상이라 본 direct task 와 섞을 수 없다(§3.1 rule 3).
- **[docs/PLAN.md](../PLAN.md) 124 행 `presentational 분해 완료(15 컴포넌트, T-0361~T-0375)`** — 귀속 chain 이 문장 안에 명시돼 있어 오독 여지가 낮다. 본 slice 편집 후에도 오해 소지가 남는다고 판단되면 Follow-ups 에 1 줄만 남긴다(PLAN 축은 [T-1350](T-1350-plan-admin-panel-marker-rejudge.md) · [T-1351](T-1351-plan-owner-quote-editorial-note.md) 이 이미 닫았다).
- **[docs/architecture/components.md](../architecture/components.md) · [directory.md](../architecture/directory.md) 재편집** — [T-1349](T-1349-components-doc-panel-mount-resync.md) · [T-1352](T-1352-components-doc-adminview-panel-enum.md) · [T-1348](T-1348-modules-doc-defer-list-resync.md) 이 이미 정합시켰다.
- **`EvaluationGuardBanner` 자동 polling 배선** — backend status 계약 미shipped 로 여전히 진짜 defer. 배선은 계약 확정 후 별도 `pr` task.
- **modules.md 의 다른 행·다른 모듈 서술 손질** — 237 행 수치 1 locus 만 다룬다.

## Suggested Sub-agents

`implementer` (doc-only · 문단 1 곳 인라인 수정 — architect 불요, tester 면제. [T-1349](T-1349-components-doc-panel-mount-resync.md) · [T-1350](T-1350-plan-admin-panel-marker-rejudge.md) · [T-1351](T-1351-plan-owner-quote-editorial-note.md) · [T-1352](T-1352-components-doc-adminview-panel-enum.md) 선례)

## 완료 요약 (2026-08-01)

`p6-plan-residual-resync` stream 의 마지막 locus 인 **수치 축**을 닫았다. [modules.md](../architecture/modules.md) 237 행의 기존 문장은 **문구 그대로 보존**하고 두 곳을 **추가만** 했다 — (a) `15 개 presentational 컴포넌트` 뒤에 `(스트림 조립 시점 T-0361~T-0375 의 수치 — ADR-0041 14 행 열거가 정본)` 인라인 주기, (b) 문단 끝에 **편집 주 (T-1353)** 로 현행 실측 21 종 + 후속 6 종(T-1133 `LlmProviderConfigList` · T-1139 `PermissionDeniedRecordList` · T-1141 `PersonList` · T-1147 `GroupList` · T-1151 `PartList` · T-1158 `UserList`) 과 T-1350 AdminView 패널 10 종 마운트 귀속. `15` → `21` 단순 치환은 하지 않았다([T-1351](T-1351-plan-owner-quote-editorial-note.md) 편집 주 선례 동형).

**실측 재확인**: `ls web/src/components/*.tsx | grep -v '\.test\.tsx' | wc -l` = **21**, `ls web/src/components/*.test.tsx | wc -l` = **21** — 둘 다 task 기대값과 일치해 편집을 진행했다.

**R-110 면제 근거 + self-check 결과** (production code 0 LOC doc-only direct commit — 신규 symbol · 분기 0 이라 R-112 4 종 해당 없음, `pnpm lint` 는 doc 변경 무영향이라 미실행):

- 구조 무손상 — `wc -l` = **256 불변**, `grep -c "^| "` = **38 불변**, `grep -c "ADR-0041"` = **3**(≥3 충족 — 인라인 링크를 같은 237 행에 추가해 행 기준 count 불변), 237 행은 여전히 **한 줄**.
- defer 서술 불변 — `grep -c "polling"` = **1 불변**([T-1348](T-1348-modules-doc-defer-list-resync.md) 박제 239 행 무수정).
- 검증 grep — `T-1141` = **1**(전 0), `UserList` = **1**(전 0), `15 개 presentational` = **1 불변**, `21` 매칭 행 = **5**(≥1).
- diff 축 한정 — `git diff -U0 -- docs/architecture/modules.md` hunk 헤더가 `@@ -237 +237 @@` **1 개뿐**, `git status --porcelain` 은 modules.md · 본 task 파일 **2 개만**. `src/` · `web/` · `test/` · `prisma/` · PLAN · components.md · directory.md · `docs/decisions/*` · STATE · journal 무수정.

## Follow-ups

- (없음) [docs/PLAN.md](../PLAN.md) 124 행 `presentational 분해 완료(15 컴포넌트, T-0361~T-0375)` 는 귀속 chain 이 문장 안에 명시돼 오독 여지가 낮아 Out of Scope 판단 그대로 유지한다. 본 slice 로 `p6-plan-residual-resync` stream(T-1347~T-1353) 은 종결.
