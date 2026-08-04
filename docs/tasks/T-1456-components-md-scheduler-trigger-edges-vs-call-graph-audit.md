---
id: T-1456
title: components.md `## Component diagram` mermaid **`%% Scheduler triggers` edge 2 개** (76 · 77 행) ↔ 실 `src/scheduling/**` 호출 그래프 · edge label `@Cron handler` claim 대조 — T-1455 파생 영향 (1) 집행 1/N + audit §12.54
phase: P5
status: DONE
commitMode: direct
coversReq: [REQ-057]
estimatedDiff: 200
estimatedFiles: 3
created: 2026-08-04
independentStream: uc-doc-audit-resync
dependsOn: [T-1455]
touchesFiles:
  - docs/architecture/components.md
  - docs/use-cases/REQ-COVERAGE-AUDIT.md
  - docs/tasks/T-1456-components-md-scheduler-trigger-edges-vs-call-graph-audit.md
plannerNote: "uc-doc-audit-resync 68 번째 slice — §12.53 파생 영향 (1) (edge 축) 을 edge 그룹별로 split, 최우선 scheduler 2 edge 부터. doc-only 1.6x"
---

# T-1456 — components.md mermaid `%% Scheduler triggers` 2 edge ↔ 실 호출 그래프 대조

## Why

[T-1455](T-1455-components-md-component-diagram-mermaid-node-vs-table-row-audit.md) 가 다이어그램의 **node 축** 을 닫으면서 ([REQ-COVERAGE-AUDIT.md](../use-cases/REQ-COVERAGE-AUDIT.md) `§ 12.53`) **파생 영향 (1)** 로 **"mermaid edge 가 주장하는 결선 ↔ 실 호출 그래프 대조 — 다음 대조 1 순위"** 를 지목했고, 그 안에서 **`scheduler -- "in-process trigger<br/>(@Cron handler)" --> worker` (76 행) 는 `§ 12.50` 이 미결선 (거짓) 으로 판정한 축이라 edge 표기와 상충할 수 있다** 고 특정했다. 본 task 는 그 지목을 집행한다.

다만 mermaid 블록의 edge 는 **20 여 개** 라 한 slice 로 닫으면 cap (≤ 300 LOC · audit 절 ≤ 100 행) 을 넘긴다. 그래서 **mermaid 자신의 `%%` 주석 그룹 단위로 split** 하고 (`%% User-facing flow` · `%% Backend orchestration` · `%% Scheduler triggers` · `%% Worker pipeline` · `%% DB persistence boundary` · `%% External egress`), 그중 `§ 12.53` 이 상충 가능성을 명시한 **`%% Scheduler triggers` 그룹 (edge 2 개)** 을 1 순위로 집행한다. 나머지 그룹은 파생 영향으로 남긴다.

planner 사전 확인 — **아래는 전부 가설이며 전제가 아니다** (T-1440 AC 1 이후 planner 기대가 실측에 반증·정정된 선례가 17 회 있고, 직전 T-1455 에서도 가설 ⑤ 가 "stale" → "범위 모호" 로 반증됐다). executor 는 AC 1 에서 전부 재측정하고 **기대와 다르면 그 축의 판정을 실측대로 뒤집는다**. ① `@Cron(` 은 `src` 전체 **0 hit** 이라 76 행 edge label 의 `@Cron handler` 어구는 **거짓 또는 부분참** 일 가능성이 크다 (`§ 12.50` 이 각주 **175** 행에 이미 박제 — 본 slice 는 그 판정을 **인용** 하되 edge 표기 축에서 재측정한다). ② cron 발화 callback 은 주입형 `CronTickHandler` 로만 받고 실 도메인 경로가 연결돼 있지 않을 가능성이 크다 → `scheduler → worker` **결선 자체가 미성립** 일 수 있다. ③ 77 행 `scheduler -- "in-process trigger" --> backend_api` 는 실제로는 **방향이 반대** (`CronScheduleController` 가 `CronScheduleService` 를 주입 = backend_api → scheduler) 일 가능성이 있다. ④ `## Contracts` 표 (**234** 행 부근) 에 같은 `@Cron decorator handler` claim 이 **중복 박제** 돼 있을 가능성이 크나 그 표의 판정은 **파생 영향 (3) 소관** 이라 본 slice 는 **좌표와 문구 인용까지만** 한다. ⑤ T-1455 각주 삽입으로 **161** 행 자기 참조가 `**189** 행` 으로 정정됐으므로, 본 slice 가 각주를 또 붙이면 그 1 지점이 **4 회째** 밀릴 가능성이 크다.

**행 좌표 주의** — components.md 는 T-1455 각주 +5 행으로 **257** 행이고, `## 개요` **5**, `## Deployment 컨텍스트` **22**, `## Component diagram` **28** (mermaid 블록 **30 ~ 106** · `external` subgraph **33 ~ 44** · `process` subgraph **49 ~ 59** · edge 그룹 주석 **64 · 68 · 75 · 79 · 85 · 88** · `다이어그램 표기` bullet **108 ~ 113**), `## Component table` **115** (표 본체 **117 ~ 126** · data row **119 ~ 126**), 안내 blockquote **128 ~ 131**, 각주 9 블록 **133 · 139 · 147 · 154 · 160 · 167 · 173 · 180 · 184** (구간 끝 **187**), `## GitHub Adapter …` **189**, `## Contracts` **221**, `## References` **247** 이다. AC 1 (i) 에서 재실측한다.

[PLAN.md](../PLAN.md) 의 미완 bullet (106 · 108 · 109 · 140 · 151) 은 owner 게이트 · 외부 credential · 새 dependency 게이트라 planner 단독 진행 불가이므로, 본 doc stream 이 현 시점 우선순위 최상위다.

## Required Reading

- `docs/architecture/components.md` — **257 행**. 다음 구간만 읽는다.
  - **60 ~ 106 행** (mermaid edge 구간 + classDef) — **edge 전수 열거용**. 그중 **75 ~ 77 행** (`%% Scheduler triggers` 주석 + edge 2) 이 **본 slice 의 판정 대상** 이다.
  - **49 ~ 59 행** (`process` subgraph) — **무편집, 대조용**. node id 확인까지만 (`§ 12.53` 이 node 축을 닫았다).
  - **108 ~ 113 행** (`다이어그램 표기` bullet) — **`in-process method call` 어구 1 구만** 인용 (edge label 해석 근거). 재판정 금지.
  - **126 행** (`Scheduler` row) — **무편집**, 굵은 이름과 trigger 축 1 구 인용까지만. **row 본문 재판정 금지** (`§ 12.50` 이 닫았다).
  - **173 ~ 178 행** (`§ 12.50` 이 남긴 `Scheduler` row 각주, 특히 **175** 행 `@Cron` 판정 1 구) — **무편집**, 인용만.
  - **184 ~ 187 행** (T-1455 신규 각주) — **무편집**, 각주군 말미 좌표 확인용.
  - **161 행** (자기 참조 `**189** 행`) — AC 1 (viii) · AC 4 의 in-place 정정 후보 좌표.
  - **221 ~ 246 행 중 `Scheduler | Worker` row 1 개 (234 행 부근)** — **무편집**, 문구 인용까지만. **`## Contracts` 표 재판정 금지** (파생 영향 (3)).
  - **그 밖 전 구간** — **무편집, heading 좌표 확인만**.
- `docs/use-cases/REQ-COVERAGE-AUDIT.md` — **5283 행**. **`### 12.15`** (append-only 처리 방침 정본) · **`### 12.53`** (**5201** 행 — **파생 영향 (1)** 원문 + (viii) 삽입 파급 ⓐ **22** · ⓑ **1** 수치 1 구 + 한계 1 의 edge 유보 1 구) · **`## 11. References` (5270 행)** — `§ 12.54` 삽입 위치 경계. **`§ 12.50` 본문은 열지 않는다** — 필요한 판정은 components.md **175** 행 각주 1 구 인용으로 갈음한다 (§7 context 절약).
- `src/scheduling/cron-schedule.service.ts` — **`CronTickHandler` type 선언부와 `registerOrReplace` 시그니처 부근만** (callback 이 주입형인지 실 도메인 호출인지 판정). 파일 통독 금지.
- `src/app.module.ts` — **`CRON_TICK_HANDLER` provider 정의 행 부근만** `grep` 으로. 통독 금지.
- `docs/decisions/ADR-0003-deployment.md` — **173 행. 무편집**. **`### Decision §3` (in-process scheduler) 의 결정 1 구만** 인용. 그 밖 절은 열지 않는다.
- `docs/PLAN.md` — **175 행. 무편집, 읽기만**. 미완 bullet 좌표 확인용 `grep` 만.
- `CLAUDE.md` §3 (task 크기 상한) · §3.2 (direct doc-only 면제) · §7 (context 절약) · §12 (언어 정책)

## Acceptance Criteria

- [ ] **AC 1 — 실측 선행 (날조 금지)**: 편집 전에 다음을 직접 측정해 `§ 12.54` 에 **명령과 출력을 함께** 인용한다. 기대값과 **다르면 그 축의 판정을 실측대로 뒤집는다** (Why 의 ① ~ ⑤ 는 가설일 뿐이다).
  - (i) **좌표 재확인**: `grep -n '^#\{1,3\} ' docs/architecture/components.md` 로 heading 좌표를 **먼저 실측** 한다 (본 AC 의 `28` · `115` · `189` · `221` · `247` 도 stale 일 수 있다 — T-1436 ~ T-1455 선례). 이어 `grep -n '^\s*%%\|^```' docs/architecture/components.md` 로 mermaid 블록 경계와 **edge 그룹 주석 좌표** 를 확정한다.
  - (ii) **edge 전수 열거 + 그룹 분해 (split 근거 실증)**: `grep -nE '^\s+[a-z_]+ -- ' docs/architecture/components.md` 로 **문서 전체 edge 수** 를 세고, (i) 의 주석 좌표로 **그룹별 개수 산출식** 1 구를 보인다 (예: user-facing N + orchestration N + scheduler N + worker N + db N + egress N = 총 N). **본 slice 대상은 `%% Scheduler triggers` 그룹뿐** 임을 그 산출식 위에서 명시한다.
  - (iii) **대상 edge 원문 인용**: `sed -n '75,77p' docs/architecture/components.md` (좌표는 (i) 실측값으로 교체) 로 주석 1 행 + edge 2 행을 그대로 인용하고, 각 edge 의 **출발 node · 도착 node · label 문자열** 을 3 컬럼으로 분해한다.
  - (iv) **실 호출 그래프 측정 (본 slice 의 축)**: 다음을 각각 1 명령으로 실행해 hit 수와 대표 행을 인용한다 — ⓐ `grep -rn '@Cron(' src --include=*.ts | grep -v spec` (정적 decorator handler 존재 여부), ⓑ `grep -rn 'CRON_TICK_HANDLER' src --include=*.ts | grep -v spec` (cron 발화 callback 의 주입 지점과 그 구현), ⓒ `grep -rn 'assessment-evaluation\|assessment-collection' src/scheduling --include=*.ts | grep -v spec` (scheduler → worker 실 호출 존재 여부), ⓓ `grep -rn 'CronScheduleService' src --include=*.ts | grep -v spec | grep -v 'src/scheduling/cron-schedule.service.ts'` (호출 **방향** 판정용 — 누가 누구를 주입하는지). **파일 통독 금지** — 위 4 명령의 출력과 `cron-schedule.service.ts` 의 `CronTickHandler` 선언 1 ~ 2 행 인용까지만 쓴다.
  - (v) **방향 축 실측 (Why ③)**: `grep -n 'private readonly\|@Controller\|@Put\|@Post' src/scheduling/cron-schedule.controller.ts | head` 로 controller → service 주입 방향을 실증하고, 77 행 edge 가 주장하는 `scheduler → backend_api` 와 **같은 방향인지 반대인지** 를 1 구로 가른다.
  - (vi) **ADR 승계 축**: `grep -n 'scheduler\|Scheduler' docs/decisions/ADR-0003-deployment.md | head` 로 `### Decision §3` 좌표를 잡고 in-process scheduler 결정 1 구를 인용해, edge label 의 `in-process trigger` 표기가 ADR 결정을 **승계하는지** 를 가른다 (결선 존재 여부와 **별개 축** 임을 명시).
  - (vii) **중복 claim 좌표 확인 (판정은 이월)**: `grep -n '@Cron' docs/architecture/components.md` 로 문서 안 `@Cron` 표기 좌표를 전수 열거해 **다이어그램 label (76 행) · `§ 12.50` 각주 (175 행) · `## Contracts` 표 (234 행 부근)** 3 지점이 같은 claim 을 되풀이하는지 수치로 보인다. **`## Contracts` 표의 참 / 거짓 판정은 하지 않는다** — 파생 영향 (3) 소관임을 1 구로 명시한다.
  - (viii) **삽입 파급 실측 (AC 3 입력)**: 신규 각주를 ⓐ `## Component diagram` 절 안 (mermaid 블록 직후, `다이어그램 표기` 앞) 에 넣을 때 / ⓑ 각주군 말미 (**187** 행 뒤) 에 넣을 때 **각각 밀리는 자기 참조 좌표가 몇 지점인지** 를 `§ 12.53` (viii) 이 확정한 **28** 지점 목록 + T-1455 신규 각주 (184 ~ 187 행) 의 좌표를 기준으로 **수치 2 개** 로 제시한다 (재-grep 1 명령 이내 허용).
  - (ix) **baseline** — `wc -l` components.md **257** · audit **5283** · ADR-0003 **173** · requirements.md **97** · deployment.md **232** · directory.md **203** · modules.md **259** · PLAN.md **175**, `grep -c '^## '` components.md **7** · audit **12**, audit `grep -c '^| REQ-'` **66** · `grep -c '^### 12\.'` **53**, components.md `grep -c '^> '` **57**.
- [ ] **AC 2 — 판정표**: AC 1 이 실측한 **축** 마다 `참 / 부분참 / 거짓` 을 판정한 표를 만든다. 각 row 는 **축 1 구 · 실측 근거 (행 번호 포함) · 판정 · 근거 1 구** 4 컬럼이다. 최소 축 5 개 — ① **`scheduler --> worker` 결선의 실재 여부** (AC 1 (iv) ⓑ · ⓒ), ② **그 edge label 의 `@Cron handler` 어구 정확성** (AC 1 (iv) ⓐ), ③ **`scheduler --> backend_api` 결선의 실재 · 방향** (AC 1 (iv) ⓓ · (v)), ④ **edge label `in-process trigger` 의 ADR-0003 §3 승계 여부** (AC 1 (vi) — 결선 축과 분리해 판정), ⑤ **같은 claim 의 3 지점 중복 표기 여부** (AC 1 (vii) — 중복 **사실** 만 판정하고 `## Contracts` 표 자체는 재판정하지 않는다).
  - **나머지 edge 그룹 (user-facing · orchestration · worker pipeline · db boundary · external egress) 재판정 금지** · **node 축 재판정 금지** (`§ 12.53`) · **표 row 본문 재판정 금지** (`§ 12.44` ~ `§ 12.50`).
- [ ] **AC 3 — 처리 방식 판정**: 후보 4 개 중 **채택 1 · 기각 3** 인 판정표를 만든다. 기각마다 근거 1 구.
  - 후보 — (A) **현행 유지 + 무편집** (audit `§ 12.54` 기록만), (B) **각주군 말미 append** — 각주 구간 **끝 (현 187 행 뒤)** 에 blockquote **1 블록 (≤ 5 행)** 을 신설해 edge 판정을 병기하고, AC 1 (viii) 이 stale 로 확정한 좌표만 in-place 정정 (**≤ 2 지점**), (C) **`## Component diagram` 절 안 각주 삽입** (mermaid 블록 직후) + 밀린 좌표 전수 정정, (D) **mermaid edge · label in-place 수정** (edge 삭제 · 방향 반전 · label 문구 고쳐 쓰기).
  - 판정 기준 **4 축** 명시 — ① `§ 12.15` **append-only 정합** (기존 본문 삭제 · 재작성이 방침과 충돌하는지 — **(D) 는 이 축에서 먼저 판정**), ② **좌표 drift 파급** (AC 1 (viii) 의 수치 2 개를 그대로 근거로), ③ **cap** — 예상 diff ≤ 300 LOC · 변경 파일 **3 고정** (초과 후보는 **자동 기각 + split 제안을 파생 영향에 기록**), ④ **탐색성** (다이어그램 독자가 판정 근거에 닿는 경로 길이 — T-1453 안내 blockquote 매핑 재사용 가능성).
  - **AC 2 축 ① ~ ③ 중 하나라도 `거짓` 이면 (A) 는 자동 기각** (오도가 문서에 남는다).
  - **mermaid edge 를 지우거나 방향을 뒤집거나 label 을 고쳐 쓰는 선택지는 채택하지 않는다** — 다이어그램 구조 변경은 본 doc-audit stream 의 scope 밖이며 (축 ① · ② 가 `거짓` 으로 판정돼도) 처리는 **각주 병기** 로 한다. 이 사실을 판정표 아래 1 구로 명시한다. **코드를 고쳐 결선을 만드는 처리도 금지** — 그것은 `pr` task 소관 (파생 영향 (17)) 이다.
- [ ] **AC 4 — 채택안 반영**: AC 3 채택안대로만 편집한다.
  - **(A) 채택 시** — components.md **무편집** (`git status --porcelain docs/architecture/components.md` **빈 출력**) 이며, 유지 근거를 `§ 12.54` 에 남긴다.
  - **(B) 채택 시** — 신규 blockquote 는 **마지막 각주 블록 뒤 · `## GitHub Adapter …` heading 직전** 에 삽입하고 **≤ 5 행 + 앞 빈 줄 1 행**, in-place 정정은 **AC 1 (viii) 이 stale 로 확정한 지점만 ≤ 2 지점** (숫자 1 개씩 치환, **문장 재작성 금지**). `wc -l` 증가 **+6 이내** (257 → ≤ 263).
  - **(C) · (D) 채택 시** — 변경 파일 3 · diff ≤ 300 LOC 를 **먼저 검산** 하고, 초과하거나 정정 지점이 **3 지점 이상** 이면 채택을 철회해 (B) 로 내린 뒤 그 사실을 `§ 12.54` 에 1 구로 남긴다.
  - **삽입으로 heading 좌표가 다시 밀리면 편집 후 `grep -n '^## ' docs/architecture/components.md` 로 재측정해 반영** 한다 (`§ 12.51` `175` → `180`, `§ 12.52` `180` → `184`, `§ 12.53` `184` → `189` 로 이어진 재-drift 의 **4 회째** 재현 여부를 1 구로 기록).
  - **문구 · 행 번호 · 절 번호 · task ID 는 AC 1 실측 출력과 1:1 일치** 해야 하며, 실측되지 않은 값을 **새로 창작하지 않는다**.
  - **mermaid 블록 (30 ~ 106 행) · `다이어그램 표기` bullet (108 ~ 113 행) · 표 본체 (117 ~ 126 행) · 1 ~ 4 행 blockquote · `## 개요` 각주 (16 ~ 20 행) · 안내 blockquote (128 ~ 131 행) · 각주 9 블록의 판정 문장 · 189 행 이후 전 구간 무편집**. 허용되는 in-place 는 **stale 숫자 치환뿐** 이다.
  - **secret · token · 실 credential 을 문서에 옮겨 적지 않는다** (CLAUDE.md §9).
- [ ] **AC 5 — audit `§ 12.54` 신설**: [REQ-COVERAGE-AUDIT.md](../use-cases/REQ-COVERAGE-AUDIT.md) 의 `## 11. References` (5270 행) **직전** 에 `### 12.54 …` 절을 **순수 append** 한다 (기존 절 수정 0). 구성 — 본 절의 위치 · 계보 1 문단 (**`§ 12.53` 파생 영향 (1) 의 edge 그룹 split 1/N**) / AC 1 실측 (명령 + 출력) / AC 2 판정표 / AC 3 처리 판정표 / AC 4 반영 결과 + 무편집 경계 / 파생 영향 (목록만) / 불변 검산 / 한계. **절 전체 ≤ 100 행** (초과 시 실측 인용을 요약형으로 압축하고 압축 사실을 한계에 명시).
  - `###` 레벨이라 `grep -c '^## '` **12 불변** · `grep -c '^| REQ-'` **66 불변** · `grep -c '^### 12\.'` **53 → 54**.
- [ ] **AC 6 — 불변 검산**: 다음을 실행해 출력을 `§ 12.54` 에 인용한다. `wc -l` components.md (257 → ≤ 263) · audit (5283 → +100 이내) · **ADR-0003 173 불변** · requirements.md (**97 불변**) · deployment.md (**232 불변**) · directory.md (**203 불변**) · modules.md (**259 불변**) · PLAN.md (**175 불변**), `git diff -U0 -- docs/architecture/components.md | grep '^@@'` 로 **hunk 개수 · 위치** 를 보이고 AC 4 허용 구간 밖 hunk **0** 을 실증 (무편집 채택 시 **hunk 0**), `git diff --numstat` 으로 **순수 삭제 0** (삭제 행이 있으면 stale 숫자 치환의 짝임을 1 구로 설명), `git status --porcelain src/ test/ web/ prisma/ deploy/ docker-compose.yml Dockerfile .github/ package.json README.md .claude/ docs/decisions/ docs/ops/ docs/PLAN.md docs/requirements.md` **빈 출력**, `git status --porcelain` 전체가 **3 파일 이내**.
- [ ] **AC 7 — 파생 영향 기록 (목록만, 본 slice 편집 금지)**: `§ 12.54` 말미에 후속 slice 대상을 목록으로 남긴다. 최소 포함 — (1) **나머지 edge 그룹 대조 5 건** (`%% User-facing flow` · `%% Backend orchestration` · `%% Worker pipeline` · `%% DB persistence boundary` · `%% External egress` — AC 1 (ii) 가 센 그룹별 개수를 그대로 병기하고 **다음 대조 1 순위** 를 1 구로 지목) / (2) `## GitHub Adapter — 3 instance 묶음 vs 분리 결정` sub-section 본문 ↔ 코드 대조 (`§ 12.48` FU4 미소진) / (3) `## Contracts` 표 ↔ 실 계약 표면 대조 (**본 절 (vii) 이 `Scheduler | Worker` row 의 중복 claim 좌표를 재료로 남겼다**) / (4) row pointer 셀 보강 2 건 (`Scheduler` = `ADR-0042` 미등재 `§ 12.50` FU2 · `Confluence Adapter` `§ 12.49` FU2) / (5) LLM · GitHub adapter ADR pointer 미등재 (`§ 12.47` FU5 · `§ 12.48` FU3) / (6) `@nestjs/config` 미도입 전수 sweep (`§ 12.39` FU3, ADR 게이트) / (7) reviewer 규약 미이행 (`§ 12.41` FU2) / (8) `deploy/README.md` ↔ deployment.md ↔ runbook 3 자 정합 (`§ 12.41` FU3) / (9) README 행 번호 pointer drift 전수 sweep / (10) REQ 번호 체계 잔재 sweep (`§ 12.38` FU3) / (11) `CLAUDE.md` §1 pointer 부정확 (T-1442 FU3) / (12) UC-09 `§ 5` sequence participant 병기 (**41 회째 이월**) / (13) modules.md 카운트 claim 대조 (`§ 12.34` FU1, ADR 게이트) / (14) **행 번호 → anchor 좌표계 이행** (**35 회째 이월** — 본 절 AC 4 의 재-drift 4 회째 재현 여부를 1 구로 표기) / (15) 각주 heading 참조 anchor 이행 축소 scope (`§ 12.51` FU19 split 제안 미소진) / (16) `§ 12.44` 한계 "mutation 러너 26 개" 정의 미확정 / (17) **`Scheduler` cron → 평가 pipeline 미결선** (`§ 12.50` FU18 — **코드 소관, `pr` task 로만**. 본 절 축 ① 이 `거짓` 이면 그 근거가 1 건 더 쌓였음을 1 구로 표기) / (18) `ADR-0003` "단일 DB 인스턴스" 좌표 부재 (`§ 12.46` FU16) / (19) `Web UI` node 의 process subgraph 소속 표기 (`§ 12.53` FU19 미소진) / (20) **AC 3 에서 기각된 후보의 split 제안** (기각이 cap 사유였을 때만).
- [ ] **AC 8 — R-110 / R-112 면제 근거 명시**: 본 task 는 `commitMode: direct` doc-only 로 production code **0 LOC** · 분기 **0** 이라 [CLAUDE.md](../../CLAUDE.md) §3.2 direct-mode 면제 조항에 따라 tester 호출 · happy / error / flow / negative 4 항목 · `pnpm test:cov` 가 **N/A** 임을 `§ 12.54` 에 1 구로 명시한다.
- [ ] **AC 9 — 언어 · 링크 규약**: 추가 문장은 모두 한국어 (§12), 문서 간 참조는 상대경로 markdown 링크, 수치는 실측 출력과 1:1 일치.

## Out of Scope

- **코드 · schema · frontend · 배포 자산 · CI · agent 정의 변경 절대 금지** — `src/` · `web/` · `test/` · `prisma/` · `scripts/` · `deploy/` · `docker-compose.yml` · `Dockerfile` · `.github/workflows/` · `package.json` · `.claude/agents/` 는 diff 에 등장하면 안 된다 (`grep` 열람은 read-only 라 허용). **미결선을 코드로 해소하려는 시도 금지** — 파생 영향 (17) 의 `pr` task 소관이다.
- **mermaid 블록 (30 ~ 106 행) 편집 금지** — edge 삭제 · 추가 · 방향 반전 · label 수정 · node 이동 어느 것도 하지 않는다. 판정은 각주 병기로만 남긴다.
- **`%% Scheduler triggers` 외 edge 그룹 (user-facing · orchestration · worker pipeline · db boundary · external egress) 재판정 금지** — 파생 영향 (1) 의 후속 slice 소관이며, 본 slice 는 **개수 산출식** 에서만 언급한다.
- **node 집합 · 이름 · 카운트 · 소속 재판정 금지** — `§ 12.53` 이 이미 닫았다.
- **`## Component table` 8 row 의 본문 (책임 · contract · REQ · pointer) 재판정 · 편집 금지** — `§ 12.44` ~ `§ 12.50` 이 이미 닫았고, 본 slice 는 `Scheduler` row 의 trigger 축 1 구 인용까지만 한다.
- **`## Contracts` 표 (221 ~ 246 행) 판정 · 편집 금지** — 중복 claim **좌표와 문구 인용** 까지만이며, 참 / 거짓 판정은 파생 영향 (3) 소관이다.
- **각주 9 블록의 판정 내용 재검토 · 재작성 · 삭제 · 이관 금지** — 좌표 확인과 1 구 인용까지만.
- **audit 기존 절 (`§ 12.1` ~ `§ 12.53`) 수정 금지** — 판정은 `§ 12.54` 순수 append 로만 세운다 (`§ 12.15`).
- **`docs/decisions/ADR-0003-deployment.md` · [ADR-0042](../decisions/ADR-0042-nestjs-schedule-adoption.md) 편집 · status 변경 금지** — 문구 인용까지만.
- **[modules.md](../architecture/modules.md) 편집 금지** — 카운트 claim 대조는 파생 영향 (13) 소관이다.
- **`docs/PLAN.md` · `docs/requirements.md` 편집 금지** — 좌표 확인용 grep 인용까지만.
- **components.md 전면 anchor 좌표계 이행 실행 금지** — 파생 영향 (14) · (15) 소관이다.
- **다른 문서로의 cascade 금지** — [use-cases/INDEX.md](../use-cases/INDEX.md) · `UC-01` ~ `UC-09` · [INDEX.md](../architecture/INDEX.md) · [deployment.md](../architecture/deployment.md) · [directory.md](../architecture/directory.md) · [api.md](../architecture/api.md) · [README.md](../../README.md) 는 무편집.
- **빌드 · 테스트 · 설치 실행 금지** — `pnpm install` · `pnpm build` · `pnpm test` 어느 것도 실행하지 않는다 (측정은 전부 read-only `grep` · `sed` · `ls` · `wc` · `git`).
- **CI drift-guard spec 작성 금지** — `pr` mode 소관이라 본 direct task 에서 진행하면 §3.1 위반.

## Suggested Sub-agents

`implementer` 단독 (doc-only, 코드 0 LOC — architect · tester 불요. §3.2 direct-mode 면제).

## Follow-ups
