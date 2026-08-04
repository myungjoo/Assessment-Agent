---
id: T-1446
title: components.md `## Component table` **Web UI row** (119 행) 의 검증 가능 claim ↔ 실 `web/src/**` 컴포넌트 인벤토리 · `ADR-0040` / `ADR-0041` · `PLAN.md` 122 행 · task pointer 대조 + T-1445 Follow-up 1 계승 (Component table 축 진입) + audit §12.44
phase: P5
status: PENDING
commitMode: direct
coversReq: [REQ-026, REQ-038, REQ-044]
estimatedDiff: 200
estimatedFiles: 3
created: 2026-08-04
independentStream: uc-doc-audit-resync
dependsOn: [T-1445]
touchesFiles:
  - docs/architecture/components.md
  - docs/use-cases/REQ-COVERAGE-AUDIT.md
  - docs/tasks/T-1446-components-md-web-ui-row-vs-web-src-audit.md
plannerNote: "uc-doc-audit-resync 58 번째 slice — T-1445 FU1 (Component table 1 순위) 계승, 8 row 중 claim 밀도 최고인 Web UI row 1 개만. doc-only 1.6x"
---

# T-1446 — components.md `## Component table` Web UI row ↔ 실 `web/src/**` 인벤토리 · ADR · PLAN pointer 대조 (Component table 축 진입)

## Why

[T-1445](T-1445-components-md-overview-section-vs-src-audit.md) 가 [components.md](../architecture/components.md) `## 개요` 를 닫으면서 ([REQ-COVERAGE-AUDIT.md](../use-cases/REQ-COVERAGE-AUDIT.md) `§ 12.43`) 다음 단락 **1 순위로 `## Component table`** 을 지목했다 (T-1445 Follow-up 1). 근거는 이 표가 문서 안에서 **검증 가능 claim 밀도가 가장 높은 곳** 이며 각 row 가 책임 · 입출력 contract · 관련 REQ · 관련 ADR 를 명시해 실 코드와 1:1 대조가 가능하다는 점이다. 본 slice 는 그 축의 **첫 slice** 다.

단, **8 row 를 한 slice 에 담으면 cap (300 LOC / 3 파일 · audit 절 ≤ 110 행) 이 확실히 깨진다** — planner 사전 훑기 기준 row 1 (**Web UI**) 한 줄만으로도 컴포넌트 이름 · 카운트 · pointer 를 합쳐 20 개 이상의 검증 가능 claim 을 담고 있어 선행 slice 의 표준 분량 (T-1445 = 22 row) 과 이미 맞먹는다. 그래서 본 slice 는 **row 1 (Web UI, 현 119 행) 1 개만** 을 대상으로 하고 나머지 7 row 는 후속 slice 로 넘긴다 (deployment.md `## DB / Persistence` 를 [T-1442](T-1442-deployment-md-db-persistence-head-vs-prisma-audit.md) / [T-1443](T-1443-deployment-md-db-persistence-tail-vs-prisma-audit.md) 전 · 후반으로 쪼갠 선례와 동형).

대조 축은 넷이다. ① **컴포넌트 이름 열거** (`AppShell` · `AuthGate` · `SuperAdminSetupForm` · `DashboardView` · `AdminView` · `GroupMemberList` · `DifficultyModelSelector` · `SchedulePanel` · `ReEvaluationTriggerPanel` · `PersonList` · `GroupList` · `PartList` · `UserList` · `LlmProviderConfigList` · `EvaluationGuardBanner`) ↔ 실 `web/src/**` 파일 · export 인벤토리, ② **수치 claim** ("구별 패널 **10 종**" · "mutation 러너 **26 개**") ↔ 그 근거로 문서가 지목한 [PLAN.md](../PLAN.md) 122 행 서술, ③ **pointer 축** ([ADR-0040](../decisions/ADR-0040-frontend-stack.md) · [ADR-0041](../decisions/ADR-0041-frontend-composition-wiring.md) · `T-0885` · `T-0886` · `T-1350` · `PLAN.md` 122 행 · [modules.md](../architecture/modules.md) 의 defer 서술) 의 대상 실재, ④ **잔여 표면 claim** ("남은 잔여 표면은 `EvaluationGuardBanner` 자동 polling 1 항목뿐") ↔ PLAN 121 행 · modules.md 서술.

planner 사전 확인 — **아래는 전부 가설이며 전제가 아니다** (T-1437 FU4 · T-1440 AC 1 · T-1441 가설 ④ · T-1442 가설 ⑧ · T-1443 가설 ② · T-1444 가설 ① · T-1445 가설 ① 이 planner 기대를 실측으로 반증한 선례가 7 회 있다). executor 는 AC 1 에서 전부 재측정하고 **기대와 다르면 그 축의 편집을 중단** 한다. ① planner 훑기상 `web/src/components/` 에 `DifficultyModelSelector` · `EvaluationGuardBanner` · `GroupMemberList` · `GroupList` · `PartList` · `PersonList` · `LlmProviderConfigList` · `SchedulePanel` · `ReEvaluationTriggerPanel` · `SuperAdminSetupForm` 이 실재하고 `AppShell` · `AuthGate` 는 `web/src/` 직하에 있어 **대부분 참** 쪽이나, `DashboardView` · `AdminView` · `UserList` 는 위치가 확인되지 않아 **개별 판정 필요** — 15 이름을 **하나씩 분리 판정** 해야 한다. ② "10 종" · "26 개" 는 문서 자신이 근거를 PLAN 122 행에 귀속시키므로 **PLAN 서술과의 일치 여부** 와 **실 코드 재측정 가능 여부** 를 구분해 판정한다 (재측정이 §7 예산을 넘으면 "출처 일치까지만 판정" 임을 한계에 명시). ③ `ADR-0040` · `ADR-0041` 파일은 실재 (planner `ls` 확인) — status 값과 본문 재판정은 범위 밖. ④ "잔여 1 항목" 은 PLAN 121 행이 `자동 polling defer` 를 명시해 **참** 쪽일 가능성이 높다.

**행 좌표 주의** — components.md 는 T-1445 각주 6 행 추가로 **196** 행이고 `## Component table` 은 **115** 행, Web UI row 는 **119** 행이다 (T-1445 시점 표기 109 행에서 밀렸다). AC 1 (i) 에서 재실측한다.

[PLAN.md](../PLAN.md) 의 미완 bullet (106 · 108 · 109 · 140 · 151) 은 owner 게이트 · 외부 credential · 새 dependency 게이트라 planner 단독 진행 불가이므로, 본 doc stream 이 현 시점 우선순위 최상위다.

## Required Reading

- `docs/architecture/components.md` — **196 행**. 다음 구간만 읽는다.
  - **115 ~ 119 행** (`## Component table` heading + 표 header 2 행 + **Web UI row**) — 본 slice 의 **주 판정 대상**.
  - **120 ~ 126 행** (나머지 7 row) — **무편집, 경계 확인만**. 판정하지 않는다.
  - **1 ~ 4 행** (문서 성격 선언 blockquote — "본 문서는 P1 T-A3 의 산출물") — **무편집**, 판정의 최강 제약. 인용만 한다.
  - **16 ~ 21 행** (T-1445 각주 blockquote) — **무편집, 화법 · 배치 template 확인용**.
  - **그 밖 전 구간** — **무편집, heading 좌표 확인만**.
- `docs/use-cases/REQ-COVERAGE-AUDIT.md` — **4392 행**. **`### 12.15`** (**1002** 행 — 시점 기록 append-only 처리 방침 정본) · **`### 12.43`** (**4270** 행 — T-1445 판정표 화법 template + Follow-up 원문) · **`## 11. References` (4379 행)** — `§ 12.44` 삽입 위치 경계. **그 밖의 절은 열지 않는다** (§7).
- `docs/PLAN.md` — **무편집, 읽기만**. **120 ~ 124 행** (P6 Admin 패널 · R-78 bullet) 만 읽어 "10 종" · "26 개" · "자동 polling defer" 서술의 출처를 인용한다. 본문 재판정 · 체크박스 변경 금지.
- `docs/decisions/ADR-0040-frontend-stack.md` · `docs/decisions/ADR-0041-frontend-composition-wiring.md` — **무편집, 읽기만**. **파일 실재 + status 1 줄** 확인까지만. 본문 재판정 · status 변경 금지.
- `docs/architecture/modules.md` — **무편집, 읽기만**. "defer 서술" pointer 실재 판정 입력. **grep 인용 1 ~ 2 구만** (259 행 통독 금지).
- `CLAUDE.md` §3 (task 크기 상한) · §3.2 (direct doc-only 면제) · §12 (언어 정책)

## Acceptance Criteria

- [ ] **AC 1 — 실측 선행 (날조 금지)**: 편집 전에 다음을 직접 측정해 `§ 12.44` 에 **명령과 출력을 함께** 인용한다. 기대값과 **다르면 그 축의 편집을 중단** 하고 불성립 사실을 `§ 12.44` 에 기록한다 (Why 의 ① ~ ④ 는 가설일 뿐이다).
  - (i) **좌표 + 원문 재확인**: `grep -n '^#\{1,3\} ' docs/architecture/components.md` 로 heading 좌표를 **먼저 실측** 한 뒤 (본 AC 의 `115` · `119` 도 stale 일 수 있다 — T-1436 ~ T-1445 선례) Web UI row 를 `sed -n` 으로 인용한다. 이어 **실측으로 참·거짓을 가릴 수 있는 claim** (컴포넌트 이름 · 카운트 · 문서 / task pointer · REQ ID · ADR ID) 만 뽑아 열거하고, 순수 성격 서술 (`사용자 브라우저에서 동작하는 frontend SPA` 등) 은 **검증 불가 claim** 으로 분류해 판정 대상에서 제외한다. 이 이분 자체를 남긴다.
  - (ii) **컴포넌트 이름 축**: `ls -1 web/src/*.tsx web/src/views/*.tsx web/src/components/*.tsx 2>/dev/null | grep -v '\.test\.' | wc -l` 로 실 컴포넌트 파일 수를, `grep -rhn '^export \(default \)\?function [A-Z]' web/src --include=*.tsx | sed 's/.*function //;s/(.*//' | sort -u` (또는 동등 명령) 로 **실 export 이름** 을 인용한 뒤, 문서가 열거한 **15 이름 각각** 을 `실재 / 이름 상이 / 부재` 로 판정한다. **파일 경로가 아니라 export 이름 기준** 이며, 문서에 없는 실 컴포넌트 (초과분) 도 **개수만** 인용한다 (이름 전수 열거는 §7 예산상 생략 가능 — 생략 시 그 사실을 적는다).
  - (iii) **수치 claim 축**: `sed -n '120,124p' docs/PLAN.md | grep -o '10 종\|26 개' | sort | uniq -c` 등으로 문서가 귀속시킨 출처 (PLAN 122 행) 에 같은 수치가 실재하는지 인용해 **"출처 일치" 를 판정** 한다. 실 코드 재측정 (패널 10 종 · mutation 러너 26 개의 현행 카운트) 은 `grep` 1 회로 근사 가능하면 시도하되, **근사치임을 명시** 하거나 §7 예산 초과 시 미측정 사실을 한계에 남긴다 — **추정값을 실측인 양 적지 않는다**.
  - (iv) **pointer 축**: `ls -1 docs/decisions/ADR-0040-*.md docs/decisions/ADR-0041-*.md docs/tasks/T-0885-*.md docs/tasks/T-0886-*.md docs/tasks/T-1350-*.md 2>/dev/null || echo "none"` · `grep -n '^status:\|^## Status' docs/decisions/ADR-0040-frontend-stack.md docs/decisions/ADR-0041-frontend-composition-wiring.md | head -4` · `grep -n "defer\|polling" docs/architecture/modules.md | head -5` 로 각 pointer 대상의 실재를 인용해 `참 / 부분참 / 거짓` 판정한다. 문서 본문이 ADR status 를 `(ACCEPTED)` 로 병기한 부분은 **실 status 와 일치하는지** 까지 본다.
  - (v) **잔여 표면 축**: `sed -n '121,124p' docs/PLAN.md` 로 "EvaluationGuardBanner 자동 polling defer" 서술을 인용해, 문서의 "남은 잔여 표면은 1 항목뿐" 이 **참 / 부분참 / 거짓** 중 무엇인지 판정한다. `§ 12.15` 시점 marker 취급 방침을 근거로 인용한다.
  - (vi) baseline — `wc -l` components.md **196** · audit **4392** · deployment.md **232** · directory.md **203** · modules.md **259**, `grep -c '^## '` components.md **7** · audit **12**, audit `grep -c '^| REQ-'` **66** · `grep -c '^### 12\.'` **43**.
- [ ] **AC 2 — 지점 판정표**: AC 1 이 뽑은 **검증 가능 claim** 각각에 대해 `in-place 수정` / `원문 보존 + 각주 부기` / `무편집` / `상위 slice 판정 승계` 중 하나를 판정한 표를 만든다. 각 row 는 **claim 1 구 · 실측 결과 · 판정 (참 / 부분참 / 거짓) · 처리 · 근거 1 구** 5 컬럼.
  - **컴포넌트 15 이름은 개별 row 로 분리** 하되, 판정이 동일한 이름들은 **1 row 에 묶고 이름을 전부 나열** 해도 무방하다 (cap 보호 — 묶을 경우 묶음 근거 1 구). 카운트 · pointer · 잔여 표면 claim 은 **묶음 금지**.
  - 판정 기준 **3 축** 명시 — ① **문서 성격** (1 ~ 4 행 blockquote 의 P1 T-A3 blueprint 선언 + 이 표가 이미 여러 차례 shipped 현황으로 갱신된 흔적이 있다는 점), ② `§ 12.15` **정합** (본 row 에 시점 marker 가 있는지 실측 grep 근거), ③ **선례** (T-1430 ~ T-1445 의 "원문 보존 + 실측 각주" vs [T-1429](T-1429-api-md-module-vocab-and-uc-range-resync.md) 의 in-place 1:1 치환 vs [T-1436](T-1436-directory-md-web-frontend-section-vs-src-audit.md) 의 혼합 채택).
- [ ] **AC 3 — 처리 방식 판정**: 후보 4 개 중 **채택 1 · 기각 3** 인 판정표를 만든다. 기각마다 근거 1 구.
  - 후보 — (A) **Web UI row 셀 in-place 동기** (거짓 이름 · 낡은 카운트 치환), (B) **원문 무편집 + `## Component table` 표 직후 각주 blockquote 1 개 신설** (T-1437 ~ T-1445 화법 승계), (C) **혼합** (거짓 판정 이름만 in-place, 카운트 · 잔여 서술은 각주), (D) **전 지점 무편집 + audit 기록만**.
  - 판정 기준 **4 축** 명시 — ① `§ 12.15` 정합, ② **오도 risk** (독자가 이 표만 읽고 존재하지 않는 컴포넌트를 실재로 오인하거나 낡은 카운트를 현행으로 오인할 때의 비용), ③ **cap** — 예상 diff ≤ 300 LOC · 변경 파일 **3 고정** (초과 후보는 자동 기각 + split 제안 기록), ④ **표 안 각주 배치의 구조 제약** — markdown 표 중간에 blockquote 를 넣을 수 없으므로 각주는 **표 전체 뒤** 로 갈 수밖에 없고, 그 위치는 나머지 7 row 와 시각적으로 인접해 **"이 각주는 Web UI row 한정" 임을 첫 구에 반드시 명시** 해야 한다는 점 (후속 slice 가 같은 자리에 각주를 덧붙일 것이므로 template 이 된다).
- [ ] **AC 4 — 채택안 반영**: AC 3 채택안대로만 편집한다. 각 지점은 AC 2 판정 결과를 따른다.
  - **각주 blockquote 는 `## Component table` 표 마지막 row (현 126 행) 와 `## GitHub Adapter — 3 instance 묶음 vs 분리 결정` heading (현 128 행) 사이에 삽입** 한다. **각주 blockquote 1 개 (≤ 6 행) + in-place 치환 (≤ 2 지점) 이내**, `wc -l` 증가 **+7 이내** (196 → ≤ 203).
  - **각주 첫 구에 "본 각주는 `Web UI` row 한정" 을 명시** 한다 — 나머지 7 row 는 미판정임을 독자가 즉시 알 수 있어야 한다.
  - **문구 · 컴포넌트 이름 · 수치 · ADR ID · task ID 는 AC 1 실측 출력과 1:1 일치** 해야 하며, 실측되지 않은 값 (존재하지 않는 컴포넌트, 임의 카운트, 없는 task ID) 을 **새로 창작하지 않는다**.
  - **1 ~ 4 행 blockquote · 16 ~ 21 행 T-1445 각주 · 나머지 7 row · 128 행 이후 전 구간 무편집**.
  - **새 pointer 추가 금지** — 본문 · PLAN · 두 ADR · modules.md 외의 문서를 새로 등재하지 않는다 (audit 쪽에만 기록).
  - **secret · connection string · 실 호스트명을 문서에 옮겨 적지 않는다** (CLAUDE.md §9).
- [ ] **AC 5 — audit `§ 12.44` 신설**: [REQ-COVERAGE-AUDIT.md](../use-cases/REQ-COVERAGE-AUDIT.md) 의 `## 11. References` (4379 행) **직전** 에 `### 12.44 …` 절을 **순수 append** 한다 (기존 절 수정 0). 구성 — 본 절의 위치 · 계보 1 문단 (**T-1445 Follow-up 1 closure + Component table 축 진입 + 8 row 를 slice 로 쪼갠 근거**) / AC 1 실측 (명령 + 출력) / AC 2 지점 판정표 / AC 3 처리 판정표 / AC 4 반영 결과 + 무편집 경계 / **Component table 잔여 미판정 row 목록** (`Backend API` · `Worker` · `DB Persistence` · `LLM Gateway` · `GitHub Adapter` · `Confluence Adapter` · `Scheduler` **7 row** — 다음 slice 1 순위 + 선정 근거 1 구) / 파생 영향 (목록만) / 불변 검산 / 한계. **절 전체 ≤ 110 행** (cap 준수 — 초과 시 실측 인용을 요약형으로 압축).
  - `###` 레벨이라 `grep -c '^## '` **12 불변** · `grep -c '^| REQ-'` **66 불변** · `grep -c '^### 12\.'` **43 → 44**.
- [ ] **AC 6 — 불변 검산**: 다음을 실행해 출력을 `§ 12.44` 에 인용한다. `wc -l` components.md (196 → ≤ 203) · audit (4392 → +110 이내) · deployment.md (**232 불변**) · directory.md (**203 불변**) · modules.md (**259 불변**) · PLAN.md (**불변**), `git diff -U0 -- docs/architecture/components.md | grep '^@@'` 로 **hunk 개수 · 위치** 를 보이고 AC 4 허용 구간 밖 hunk **0** 을 실증, `git diff --numstat` 으로 **순수 삭제 0** (삭제 행이 있으면 in-place 치환의 짝임을 1 구로 설명), `git status --porcelain src/ test/ web/ prisma/ deploy/ docker-compose.yml Dockerfile .github/ package.json README.md .claude/ docs/decisions/ docs/ops/ docs/PLAN.md` **빈 출력** (코드 · frontend · 배포자산 · CI · 의존성 · ADR · PLAN 무변경), `git status --porcelain` 이 **3 파일** 임을 확인.
- [ ] **AC 7 — 파생 영향 기록 (목록만, 본 slice 편집 금지)**: `§ 12.44` 말미에 후속 slice 대상을 목록으로 남긴다. 최소 포함 — (1) **Component table 잔여 7 row** + 다음 slice 1 순위 (claim 밀도 · 실 코드 대조 난이도 근거 1 구), (2) `## Deployment 컨텍스트` (22 ~ 26 행 — "모든 8 component 는 동일 process" claim + ADR pointer 3 종, T-1445 FU1 차순위로 이월), (3) `## Component diagram` mermaid node ↔ 실 module 대조, (4) `@nestjs/config` 미도입 전수 sweep (`§ 12.39` FU3 미소진, ADR 게이트), (5) reviewer 규약 미이행 (`.claude/agents/reviewer.md` REQ-032 0 hit — `§ 12.41` FU2 미소진), (6) `deploy/README.md` ↔ deployment.md ↔ runbook 3 자 정합 (`§ 12.41` FU3 미소진), (7) README 행 번호 pointer drift 전수 sweep, (8) REQ 번호 체계 잔재 전수 sweep (`§ 12.38` FU3 미소진), (9) `CLAUDE.md` §1 pointer 부정확 (T-1442 FU3 미소진), (10) UC-09 `§ 5` sequence participant 병기 (28 회째 이월), (11) 정본 [modules.md](../architecture/modules.md) 카운트 claim 대조 (`§ 12.34` FU1 미소진, ADR 게이트), (12) 행 번호 → anchor 좌표계 이행 (22 회째), (13) 산문 tally ↔ 실측 CI drift-guard spec (`pr` mode 소관 — 패널 · mutation 러너 카운트는 컴포넌트 1 개 추가로 즉시 낡는다).
- [ ] **AC 8 — R-110 / R-112 면제 근거 명시**: 본 task 는 `commitMode: direct` doc-only 로 production code **0 LOC** · 분기 **0** 이라 [CLAUDE.md](../../CLAUDE.md) §3.2 direct-mode 면제 조항에 따라 tester 호출 · happy / error / flow / negative 4 항목 · `pnpm test:cov` 가 **N/A** 임을 `§ 12.44` 에 1 구로 명시한다.
- [ ] **AC 9 — 언어 · 링크 규약**: 추가 문장은 모두 한국어 (§12), 문서 간 참조는 상대경로 markdown 링크, 수치는 실측 출력과 1:1 일치.

## Out of Scope

- **코드 · frontend · 스키마 · 배포 자산 · CI · agent 정의 변경 절대 금지** — `src/` · `web/` · `test/` · `prisma/` · `scripts/` · `deploy/` · `docker-compose.yml` · `Dockerfile` · `.github/workflows/` · `package.json` · `.claude/agents/` 는 diff 에 등장하면 안 된다. **컴포넌트 rename · 파일 추가로 문서를 맞추는 행위 금지** (문서를 실제에 맞출 뿐, 실제를 문서에 맞추지 않는다).
- **Component table 나머지 7 row 판정 · 편집 금지** — `Backend API` · `Worker` · `DB Persistence` · `LLM Gateway` · `GitHub Adapter` · `Confluence Adapter` · `Scheduler` 는 후속 slice 소관이며 본 slice 에서 손대면 cap 이 즉시 깨진다.
- **components.md 128 행 이후 전 구간 편집 금지** — `## GitHub Adapter …` · `## Contracts` 표 · `## References` · mermaid diagram 무편집.
- **1 ~ 4 행 blockquote · 16 ~ 21 행 T-1445 각주 편집 금지** — 인용 · 화법 참조까지만.
- **`docs/PLAN.md` 편집 금지** — 122 행 서술 인용까지만. 체크박스 · 마커 변경은 별도 소관.
- **ADR-0040 · ADR-0041 본문 재판정 · status 변경 금지** — 파일 실재 + status 1 줄 확인까지만.
- **[modules.md](../architecture/modules.md) · [INDEX.md](../architecture/INDEX.md) · [deployment.md](../architecture/deployment.md) · [directory.md](../architecture/directory.md) 편집 금지** — 정합 판정 필요 사실은 파생 영향 목록에만 남긴다 (**modules.md 259 행 · deployment.md 232 행 · directory.md 203 행 불변**).
- **빌드 · 테스트 · 설치 실행 금지** — `pnpm install` · `pnpm build` · `pnpm test` · `pnpm --dir web test` 어느 것도 실행하지 않는다 (측정은 전부 read-only grep / ls / sed / wc).
- **다른 문서로의 cascade 금지** — [use-cases/INDEX.md](../use-cases/INDEX.md) · `UC-01` ~ `UC-09` · ADR · [requirements.md](../requirements.md) · [README.md](../../README.md) 는 무편집.
- **행 번호 → anchor 좌표계 이행 금지** — 파생 영향 목록에만 남긴다 (22 회째 이월).
- **CI drift-guard spec 작성 금지** — `pr` mode 소관이라 본 direct task 에서 진행하면 §3.1 위반.
- **audit 기존 절 (`§ 12.1` ~ `§ 12.43`) 수정 금지** — `§ 12.44` 순수 append 만.

## Suggested Sub-agents

`implementer` 단독 (doc-only, 코드 0 LOC — architect · tester 불요. §3.2 direct-mode 면제).

## Follow-ups

(생성 시점 비어 있음 — sub-agent 가 관련 작업을 발견하면 여기에 append 한다.)
