---
id: T-1457
title: components.md `## Component diagram` mermaid **`%% Backend orchestration` edge 5 개** (69 ~ 73 행) ↔ 실 `src/**` 호출 그래프 · `Backend API` node 외연 대조 — `§ 12.54` 파생 영향 (1) 집행 2/6 + audit §12.55
phase: P5
status: PENDING
commitMode: direct
coversReq: [REQ-057]
estimatedDiff: 220
estimatedFiles: 3
created: 2026-08-04
independentStream: uc-doc-audit-resync
dependsOn: [T-1456]
touchesFiles:
  - docs/architecture/components.md
  - docs/use-cases/REQ-COVERAGE-AUDIT.md
  - docs/tasks/T-1457-components-md-backend-orchestration-edges-vs-call-graph-audit.md
plannerNote: "uc-doc-audit-resync 69 번째 slice — §12.54 가 지목한 다음 대조 1 순위 (orchestration 5 edge) 집행. doc-only 1.6x"
---

# T-1457 — components.md mermaid `%% Backend orchestration` 5 edge ↔ 실 호출 그래프 대조

## Why

[T-1456](T-1456-components-md-scheduler-trigger-edges-vs-call-graph-audit.md) 이 mermaid edge 축의 첫 그룹 (`%% Scheduler triggers` 2 개) 을 닫으면서 ([REQ-COVERAGE-AUDIT.md](../use-cases/REQ-COVERAGE-AUDIT.md) `§ 12.54`) 파생 영향 **(1)** 에서 **다음 대조 1 순위를 `%% Backend orchestration` 5 개 (69 ~ 73 행) 로 명시 지목** 했다. 지목 근거도 확정 사실이다 — `§ 12.54` 는 `scheduler --> worker` 를 **부분참** 으로 확정하면서 그 결선이 cron 발화가 아니라 **REST runner 진입 경로** (`backfill-runner.service.ts` **18 · 108** 행 → `CollectionTriggerService.triggerCollection`, `backfill.controller.ts` **50** 행) 로 성립한다고 실측했고, 그 REST 진입이 다이어그램상 어느 node 소관인지는 **`backend_api --> worker` (73 행) 를 반대편에서 재는 본 slice 소관** 으로 남겼다.

본 slice 는 그 지목을 집행한다. edge 는 문서 전체 **23** 개 (`§ 12.54` 산출식 = user-facing **2** + orchestration **5** + scheduler **2** + worker pipeline **4** + db boundary **1** + external egress **9**) 라 한 slice 로 닫으면 cap 을 넘기므로 mermaid 자신의 `%%` 주석 그룹 단위 split 을 그대로 이어받아 **2/6 그룹** 만 집행한다.

측정 기준 자체가 본 slice 의 선결 과제다 — `§ 12.53` (T-1455) 이 실측한 **확정 사실** 로, process node 8 개 중 **`Backend API` 만 단일 디렉토리 대응이 없다** (controller 군이 `auth` · `user` · `export` · `import` 등으로 분산, [modules.md](../architecture/modules.md) **200** 행이 **1:N** 으로 박제). 따라서 "`backend_api` 가 X 를 호출한다" 를 재려면 **backend_api node 의 외연 (어느 디렉토리의 controller / service 를 backend_api 로 셈할지) 을 먼저 1 구로 정의** 해야 하며, 특히 `src/scheduling/` 소속 controller (`backfill.controller.ts` 등) 는 다이어그램상 **`scheduler` node 내부** 라 backend_api 실적으로 세면 안 된다.

planner 사전 확인 — **아래는 전부 가설이며 전제가 아니다** (T-1440 AC 1 이후 planner 기대가 실측에 반증 · 정정된 선례가 18 회 있고, 직전 T-1456 에서도 `scheduler → worker` 미결선 가설과 `@Cron` 중복 **3** 지점 가설이 각각 "REST 경유 결선 실재" 와 "**6** 지점" 으로 반증됐다 — **그 두 반증은 확정 사실이므로 본 slice 에서 다시 가설로 세우지 않는다**). executor 는 AC 1 에서 전부 재측정하고 **기대와 다르면 그 축의 판정을 실측대로 뒤집는다**. ① `backend_api --> worker` (73 행) 의 실 진입점이 `src/scheduling/` 소속 controller 뿐이라면 이 edge 는 **부분참 또는 거짓** 이고 결선 실적은 `scheduler` node 쪽으로 귀속될 수 있다. ② `backend_api --> llm_gateway` (70 행) 는 `§ 12.47` 각주 (**155** 행) 가 "평가 파이프라인이 본 gateway 만 호출" 을 참으로 확정했으므로, controller 계층의 **직접** 호출이 0 이면 실선 소비자는 `worker` 뿐일 수 있다 (그렇다면 이 edge 는 거짓 또는 부분참). ③ `backend_api --> github_adapter` (71 행) · `--> confluence_adapter` (72 행) 도 adapter 주입처가 `src/assessment-collection/` (worker) 계열뿐일 가능성이 있다. ④ `backend_api --> db_persistence` (69 행) 는 Prisma 접근이 `src/persistence/` 경유인지, 일부 module 이 우회하는지에 따라 참 / 부분참이 갈린다. ⑤ label `in-process method call` 어구 자체는 **111** 행 `다이어그램 표기` bullet 및 `ADR-0003 §1` 을 승계할 가능성이 크고 이는 **결선 실재 여부와 별개 축** 이다. ⑥ `## Contracts` 표에 같은 5 결선이 **1:1 로 중복 박제** 돼 있을 가능성이 크나 그 표의 판정은 **파생 영향 (3) 소관** 이라 본 slice 는 **좌표와 문구 인용까지만** 한다.

**행 좌표 주의** — components.md 는 T-1456 각주 +5 행으로 **262** 행이고, heading 은 `## 개요` **5** · `## Deployment 컨텍스트` **22** · `## Component diagram` **28** · `## Component table` **115** · `## GitHub Adapter …` **194** · `## Contracts` **226** · `## References` **252** 다. mermaid 블록 **30 ~ 106** (edge 그룹 주석 **64 · 68 · 75 · 79 · 85 · 88**), `다이어그램 표기` bullet **108 ~ 113**, 표 본체 **117 ~ 126**, 안내 blockquote **128 ~ 131**, 각주 **10 블록** **133 · 139 · 147 · 154 · 160 · 167 · 173 · 180 · 184 · 189** (구간 끝 **192**) 다. AC 1 (i) 에서 재실측한다.

[PLAN.md](../PLAN.md) 의 미완 bullet (106 · 108 · 109 · 140 · 151) 은 owner 게이트 · 외부 credential · 새 dependency 게이트라 planner 단독 진행 불가이므로, 본 doc stream 이 현 시점 우선순위 최상위다.

## Required Reading

- `docs/architecture/components.md` — **262 행**. 다음 구간만 읽는다.
  - **64 ~ 98 행** (edge 전 구간) — **edge 전수 열거 · 그룹 경계 확인용**. 그중 **68 ~ 73 행** (`%% Backend orchestration` 주석 + edge 5) 이 **본 slice 의 판정 대상** 이다.
  - **49 ~ 59 행** (`process` subgraph) — **무편집, 대조용**. node id 확인까지만 (`§ 12.53` 이 node 축을 닫았다).
  - **108 ~ 113 행** (`다이어그램 표기` bullet, 특히 **111** 행 `in-process method call` 정의 1 구) — 인용만. 재판정 금지.
  - **119 ~ 126 행** (표 data row 8) — **무편집**, node 외연 정의에 쓰는 이름 인용까지만. **row 본문 재판정 금지** (`§ 12.44` ~ `§ 12.50` 이 닫았다).
  - **184 ~ 192 행** (T-1455 · T-1456 각주 2 블록) — **무편집**. 특히 **186** 행 (`Backend API` 만 단일 디렉토리 대응 없음) · **190** 행 (REST runner 경유 결선) 1 구 인용 + 각주군 말미 좌표 확인용. **192** 행의 `234 · 235` 좌표는 AC 1 (vii) 의 stale 판정 후보다.
  - **226 ~ 251 행 중 `Backend API` 를 from 으로 갖는 row 5 개 (234 ~ 238 행 부근)** — **무편집**, 문구 인용까지만. **`## Contracts` 표 재판정 금지** (파생 영향 (3)).
  - **그 밖 전 구간** — **무편집, heading 좌표 확인만**.
- `docs/use-cases/REQ-COVERAGE-AUDIT.md` — **5352 행**. **`### 12.15`** (append-only 처리 방침 정본) · **`### 12.54`** (**5270** 행 — 파생 영향 **(1)** 원문 + edge 산출식 1 구 + 한계 1 의 `backend_api → worker` 유보 1 구) · **`## 11. References` (5339 행)** — `§ 12.55` 삽입 위치 경계. **`§ 12.47` · `§ 12.50` · `§ 12.53` 본문은 열지 않는다** — 필요한 판정은 components.md **155 · 175 · 186 · 190** 행 각주 1 구 인용으로 갈음한다 (§7 context 절약).
- `docs/architecture/modules.md` — **259 행. 무편집**. **200 행 부근 `Backend API` 1:N 매핑 1 구만** `grep` 으로 인용 (node 외연 정의 근거). 통독 금지.
- `docs/decisions/ADR-0003-deployment.md` — **173 행. 무편집**. **`### Decision §1` (32 ~ 45 행) 의 in-process method call 근거 1 구만** 인용. 그 밖 절은 열지 않는다.
- `docs/PLAN.md` — **175 행. 무편집, 읽기만**. 미완 bullet 좌표 확인용 `grep` 만.
- `CLAUDE.md` §3 (task 크기 상한) · §3.2 (direct doc-only 면제) · §7 (context 절약) · §12 (언어 정책)

## Acceptance Criteria

- [ ] **AC 1 — 실측 선행 (날조 금지)**: 편집 전에 다음을 직접 측정해 `§ 12.55` 에 **명령과 출력을 함께** 인용한다. 기대값과 **다르면 그 축의 판정을 실측대로 뒤집는다** (Why 의 ① ~ ⑥ 은 가설일 뿐이다).
  - (i) **좌표 재확인**: `grep -n '^#\{1,3\} ' docs/architecture/components.md` 로 heading 좌표를 **먼저 실측** 한다 (본 AC 의 `28` · `115` · `194` · `226` · `252` 도 stale 일 수 있다 — T-1436 ~ T-1456 선례). 이어 `grep -n '^\s*%%\|^```' docs/architecture/components.md` 로 mermaid 블록 경계와 edge 그룹 주석 좌표를 확정한다.
  - (ii) **edge 그룹 재확인 (split 계보 실증)**: `grep -nE '^\s+[a-z_]+ -- ' docs/architecture/components.md` 로 전체 edge 수를 세고 `§ 12.54` 의 산출식 (**23** = 2 + 5 + 2 + 4 + 1 + 9) 이 **여전히 성립하는지** 1 구로 확인한다. **본 slice 대상은 `%% Backend orchestration` 그룹 5 개뿐** 임을 그 위에서 명시한다.
  - (iii) **대상 edge 원문 인용**: `sed -n '68,73p' docs/architecture/components.md` (좌표는 (i) 실측값으로 교체) 로 주석 1 행 + edge 5 행을 그대로 인용하고, 각 edge 의 **출발 node · 도착 node · label 문자열** 을 3 컬럼으로 분해한다.
  - (iv) **`backend_api` node 외연 정의 (본 slice 의 선결 측정)**: `grep -rn '@Controller(' src --include=*.ts | grep -v spec` 로 controller 를 전수 열거하고 **디렉토리별 개수** 를 낸 뒤, 다이어그램 node 매핑 (`§ 12.53` / components.md **186** 행) 에 따라 **backend_api 로 셈할 디렉토리 집합 · 제외할 디렉토리 집합 (`src/scheduling/` = `scheduler` node, `src/assessment-*` = `worker` node 등) 을 1 구로 정의** 한다. 이 정의가 이후 5 축 판정의 기준임을 명시한다.
  - (v) **결선 실측 (본 slice 의 축)**: 다음을 각각 1 명령으로 실행해 hit 수와 대표 행을 인용한다 — ⓐ `grep -rn 'PrismaService' src --include=*.ts | grep -v spec` (69 행 축: DB 접근이 `src/persistence/` 경유인지 · 주입처가 어느 계층인지), ⓑ `grep -rn 'LLM_GATEWAY\|LlmHttpGateway' src --include=*.ts | grep -v spec | grep -v '^src/llm/'` (70 행 축: gateway 소비자 목록), ⓒ `grep -rn 'GithubAdapter\|GithubInstanceClient' src --include=*.ts | grep -v spec | grep -v '^src/github/'` (71 행 축), ⓓ `grep -rn 'ConfluenceAdapter\|ConfluenceSpaceTraversalService' src --include=*.ts | grep -v spec | grep -v '^src/confluence/'` (72 행 축), ⓔ `grep -rn 'CollectionTriggerService\|Orchestrat' src --include=*.ts | grep -v spec` (73 행 축: worker 진입 소비자와 그 소속 디렉토리). **파일 통독 금지** — 위 5 명령의 출력과 필요한 1 ~ 2 행 인용까지만 쓴다.
  - (vi) **label · ADR 승계 축**: `sed -n '111p' docs/architecture/components.md` 로 `in-process method call` 정의 1 구를, `grep -n 'process' docs/decisions/ADR-0003-deployment.md | head` 로 `### Decision §1` 좌표와 결정 1 구를 인용해, 4 edge 가 공유하는 label 어구가 **표기 규약 · ADR 결정을 승계하는지** 를 1 구로 가른다 (**결선 실재 여부와 별개 축** 임을 명시).
  - (vii) **중복 claim · 좌표 stale 확인 (판정은 이월)**: `grep -n '^| Backend API |' docs/architecture/components.md` 로 `## Contracts` 표의 대응 row 좌표를 열거해 **edge 5 개와 1:1 대응하는지** 를 수치로 보인다. 이어 components.md **192** 행이 인용한 `## Contracts` 좌표 (`234 · 235`) 가 T-1456 각주 삽입 이후 **stale 인지** 를 `grep -n '^| Scheduler |'` 실측으로 가른다. **`## Contracts` 표의 참 / 거짓 판정은 하지 않는다** — 파생 영향 (3) 소관임을 1 구로 명시한다.
  - (viii) **삽입 파급 실측 (AC 3 입력)**: 신규 각주를 ⓐ `## Component diagram` 절 안 (mermaid 블록 직후) 에 넣을 때 / ⓑ 각주군 말미 (**192** 행 뒤) 에 넣을 때 **각각 밀리는 자기 참조 좌표가 몇 지점인지** 를 **수치 2 개** 로 제시한다 (`§ 12.54` (viii) 의 ⓐ **33** · ⓑ **1** 을 기준선으로 삼되 T-1456 각주가 더한 좌표를 반영해 재측정 — 재-grep 1 명령 이내 허용).
  - (ix) **baseline** — `wc -l` components.md **262** · audit **5352** · ADR-0003 **173** · requirements.md **97** · deployment.md **232** · directory.md **203** · modules.md **259** · PLAN.md **175**, `grep -c '^## '` components.md **7** · audit **12**, audit `grep -c '^| REQ-'` **66** · `grep -c '^### 12\.'` **54**, components.md `grep -c '^> '` **61**.
- [ ] **AC 2 — 판정표**: AC 1 이 실측한 **축** 마다 `참 / 부분참 / 거짓` 을 판정한 표를 만든다. 각 row 는 **축 1 구 · 실측 근거 (행 번호 포함) · 판정 · 근거 1 구** 4 컬럼이다. 최소 축 6 개 — ① `backend_api --> db_persistence` (**69** 행, AC 1 (v) ⓐ), ② `backend_api --> llm_gateway` (**70** 행, (v) ⓑ), ③ `backend_api --> github_adapter` (**71** 행, (v) ⓒ), ④ `backend_api --> confluence_adapter` (**72** 행, (v) ⓓ), ⑤ `backend_api --> worker` (**73** 행, (v) ⓔ — **`§ 12.54` 가 확정한 REST runner 경유 결선이 `src/scheduling/` 소속이라는 사실을 (iv) 외연 정의 위에서 어느 node 실적으로 귀속시킬지** 를 판정 근거에 1 구로 포함), ⑥ label `in-process method call` 의 **111** 행 표기 규약 · `ADR-0003 §1` 승계 여부 ((vi) — 결선 축과 분리해 판정).
  - **판정은 (iv) 의 backend_api 외연 정의 위에서만 유효** 함을 표 아래 1 구로 명시한다.
  - **나머지 edge 그룹 (user-facing · scheduler · worker pipeline · db boundary · external egress) 재판정 금지** · **node 축 재판정 금지** (`§ 12.53`) · **표 row 본문 재판정 금지** (`§ 12.44` ~ `§ 12.50`) · **scheduler edge 2 개 재판정 금지** (`§ 12.54` 가 닫았다 — 인용만).
- [ ] **AC 3 — 처리 방식 판정**: 후보 4 개 중 **채택 1 · 기각 3** 인 판정표를 만든다. 기각마다 근거 1 구.
  - 후보 — (A) **현행 유지 + 무편집** (audit `§ 12.55` 기록만), (B) **각주군 말미 append** — 각주 구간 **끝 (현 192 행 뒤)** 에 blockquote **1 블록 (≤ 6 행)** 을 신설해 edge 판정을 병기하고, AC 1 (vii) · (viii) 이 stale 로 확정한 좌표만 in-place 정정 (**≤ 2 지점**), (C) **`## Component diagram` 절 안 각주 삽입** (mermaid 블록 직후) + 밀린 좌표 전수 정정, (D) **mermaid edge · label in-place 수정** (edge 삭제 · 방향 반전 · label 문구 고쳐 쓰기).
  - 판정 기준 **4 축** 명시 — ① `§ 12.15` **append-only 정합** (**(D) 는 이 축에서 먼저 판정**), ② **좌표 drift 파급** (AC 1 (viii) 의 수치 2 개를 그대로 근거로), ③ **cap** — 예상 diff ≤ 300 LOC · 변경 파일 **3 고정** (초과 후보는 **자동 기각 + split 제안을 파생 영향에 기록**), ④ **탐색성** (다이어그램 독자가 판정 근거에 닿는 경로 길이).
  - **AC 2 축 ① ~ ⑤ 중 하나라도 `거짓` 이면 (A) 는 자동 기각** (오도가 문서에 남는다).
  - **mermaid edge 를 지우거나 방향을 뒤집거나 label 을 고쳐 쓰는 선택지는 채택하지 않는다** — 다이어그램 구조 변경은 본 doc-audit stream 의 scope 밖이며 (축 ① ~ ⑤ 가 `거짓` 으로 판정돼도) 처리는 **각주 병기** 로 한다. 이 사실을 판정표 아래 1 구로 명시한다. **코드를 고쳐 결선을 만드는 처리도 금지** — `pr` task 소관 (파생 영향 (17)) 이다.
- [ ] **AC 4 — 채택안 반영**: AC 3 채택안대로만 편집한다.
  - **(A) 채택 시** — components.md **무편집** (`git status --porcelain docs/architecture/components.md` **빈 출력**) 이며, 유지 근거를 `§ 12.55` 에 남긴다.
  - **(B) 채택 시** — 신규 blockquote 는 **마지막 각주 블록 뒤 · `## GitHub Adapter …` heading 직전** 에 삽입하고 **≤ 6 행 + 앞 빈 줄 1 행**, in-place 정정은 **AC 1 (vii) · (viii) 이 stale 로 확정한 지점만 ≤ 2 지점** (숫자 1 개씩 치환, **문장 재작성 금지**). `wc -l` 증가 **+7 이내** (262 → ≤ 269).
  - **(C) · (D) 채택 시** — 변경 파일 3 · diff ≤ 300 LOC 를 **먼저 검산** 하고, 초과하거나 정정 지점이 **3 지점 이상** 이면 채택을 철회해 (B) 로 내린 뒤 그 사실을 `§ 12.55` 에 1 구로 남긴다.
  - **삽입으로 heading 좌표가 다시 밀리면 편집 후 `grep -n '^## ' docs/architecture/components.md` 로 재측정해 반영** 한다 (`§ 12.51` `175` → `180`, `§ 12.52` `180` → `184`, `§ 12.53` `184` → `189`, `§ 12.54` `189` → `194` 로 이어진 재-drift 의 **5 회째** 재현 여부를 1 구로 기록).
  - **문구 · 행 번호 · 절 번호 · task ID 는 AC 1 실측 출력과 1:1 일치** 해야 하며, 실측되지 않은 값을 **새로 창작하지 않는다**.
  - **mermaid 블록 (30 ~ 106 행) · `다이어그램 표기` bullet (108 ~ 113 행) · 표 본체 (117 ~ 126 행) · 1 ~ 4 행 blockquote · `## 개요` 각주 (16 ~ 20 행) · 안내 blockquote (128 ~ 131 행) · 각주 10 블록의 판정 문장 · 194 행 이후 전 구간 무편집**. 허용되는 in-place 는 **stale 숫자 치환뿐** 이다.
  - **secret · token · 실 credential 을 문서에 옮겨 적지 않는다** (CLAUDE.md §9).
- [ ] **AC 5 — audit `§ 12.55` 신설**: [REQ-COVERAGE-AUDIT.md](../use-cases/REQ-COVERAGE-AUDIT.md) 의 `## 11. References` (5339 행) **직전** 에 `### 12.55 …` 절을 **순수 append** 한다 (기존 절 수정 0). 구성 — 본 절의 위치 · 계보 1 문단 (**`§ 12.54` 파생 영향 (1) 이 지목한 다음 대조 1 순위 = edge 그룹 split 2/6**) / AC 1 실측 (명령 + 출력) / AC 2 판정표 / AC 3 처리 판정표 / AC 4 반영 결과 + 무편집 경계 / 파생 영향 (목록만) / 불변 검산 / 한계. **절 전체 ≤ 100 행** (초과 시 실측 인용을 요약형으로 압축하고 압축 사실을 한계에 명시).
  - `###` 레벨이라 `grep -c '^## '` **12 불변** · `grep -c '^| REQ-'` **66 불변** · `grep -c '^### 12\.'` **54 → 55**.
- [ ] **AC 6 — 불변 검산**: 다음을 실행해 출력을 `§ 12.55` 에 인용한다. `wc -l` components.md (262 → ≤ 269) · audit (5352 → +100 이내) · **ADR-0003 173 불변** · requirements.md (**97 불변**) · deployment.md (**232 불변**) · directory.md (**203 불변**) · modules.md (**259 불변**) · PLAN.md (**175 불변**), `git diff -U0 -- docs/architecture/components.md | grep '^@@'` 로 **hunk 개수 · 위치** 를 보이고 AC 4 허용 구간 밖 hunk **0** 을 실증 (무편집 채택 시 **hunk 0**), `git diff --numstat` 으로 **순수 삭제 0** (삭제 행이 있으면 stale 숫자 치환의 짝임을 1 구로 설명), `git status --porcelain src/ test/ web/ prisma/ deploy/ docker-compose.yml Dockerfile .github/ package.json README.md .claude/ docs/decisions/ docs/ops/ docs/PLAN.md docs/requirements.md docs/architecture/modules.md` **빈 출력**, `git status --porcelain` 전체가 **3 파일 이내**.
- [ ] **AC 7 — 파생 영향 기록 (목록만, 본 slice 편집 금지)**: `§ 12.55` 말미에 후속 slice 대상을 목록으로 남긴다. 최소 포함 — (1) **나머지 edge 그룹 대조 4 건** (`%% User-facing flow` **2** · `%% Worker pipeline` **4** · `%% DB persistence boundary` **1** · `%% External egress` **9** — AC 1 (ii) 가 재확인한 개수를 병기하고 **다음 대조 1 순위** 를 1 구로 지목) / (2) `## GitHub Adapter — 3 instance 묶음 vs 분리 결정` sub-section 본문 ↔ 코드 대조 (`§ 12.48` FU4 미소진) / (3) **`## Contracts` 표 ↔ 실 계약 표면 대조** (본 절 (vii) 이 `Backend API` from row **5 개** 의 1:1 대응 좌표를 재료로 남겼다) / (4) row pointer 셀 보강 2 건 (`Scheduler` = `ADR-0042` 미등재 `§ 12.50` FU2 · `Confluence Adapter` `§ 12.49` FU2) / (5) LLM · GitHub adapter ADR pointer 미등재 (`§ 12.47` FU5 · `§ 12.48` FU3) / (6) `@nestjs/config` 미도입 전수 sweep (`§ 12.39` FU3, ADR 게이트) / (7) reviewer 규약 미이행 (`§ 12.41` FU2) / (8) `deploy/README.md` ↔ deployment.md ↔ runbook 3 자 정합 (`§ 12.41` FU3) / (9) README 행 번호 pointer drift 전수 sweep / (10) REQ 번호 체계 잔재 sweep (`§ 12.38` FU3) / (11) `CLAUDE.md` §1 pointer 부정확 (T-1442 FU3) / (12) UC-09 `§ 5` sequence participant 병기 (**42 회째 이월**) / (13) modules.md 카운트 claim 대조 (`§ 12.34` FU1, ADR 게이트) / (14) **행 번호 → anchor 좌표계 이행** (**36 회째 이월** — 본 절 AC 4 의 재-drift 5 회째 재현 여부와 (vii) 의 **192** 행 stale 좌표 실측을 근거로 보탠다) / (15) 각주 heading 참조 anchor 이행 축소 scope (`§ 12.51` FU19 미소진) / (16) `§ 12.44` 한계 "mutation 러너 26 개" 정의 미확정 / (17) **`Scheduler` cron → 평가 pipeline 미결선** (`§ 12.50` FU18 · `§ 12.54` 재확인 — **코드 소관, `pr` task 로만**) / (18) `ADR-0003` "단일 DB 인스턴스" 좌표 부재 (`§ 12.46` FU16) / (19) `Web UI` node 의 process subgraph 소속 표기 (`§ 12.53` FU19 미소진) / (20) **`Backend API` node 외연 정의의 문서 미박제** (본 절 (iv) 가 판정 기준으로 세운 정의가 components.md 본문에는 없다 — 박제 여부는 후속 slice 소관) / (21) **AC 3 에서 기각된 후보의 split 제안** (기각이 cap 사유였을 때만).
- [ ] **AC 8 — R-110 / R-112 면제 근거 명시**: 본 task 는 `commitMode: direct` doc-only 로 production code **0 LOC** · 분기 **0** 이라 [CLAUDE.md](../../CLAUDE.md) §3.2 direct-mode 면제 조항에 따라 tester 호출 · happy / error / flow / negative 4 항목 · `pnpm test:cov` 가 **N/A** 임을 `§ 12.55` 에 1 구로 명시한다.
- [ ] **AC 9 — 언어 · 링크 규약**: 추가 문장은 모두 한국어 (§12), 문서 간 참조는 상대경로 markdown 링크, 수치는 실측 출력과 1:1 일치.

## Out of Scope

- **코드 · schema · frontend · 배포 자산 · CI · agent 정의 변경 절대 금지** — `src/` · `web/` · `test/` · `prisma/` · `scripts/` · `deploy/` · `docker-compose.yml` · `Dockerfile` · `.github/workflows/` · `package.json` · `.claude/agents/` 는 diff 에 등장하면 안 된다 (`grep` 열람은 read-only 라 허용). **미결선을 코드로 해소하려는 시도 금지** — 파생 영향 (17) 의 `pr` task 소관이다.
- **mermaid 블록 (30 ~ 106 행) 편집 금지** — edge 삭제 · 추가 · 방향 반전 · label 수정 · node 이동 어느 것도 하지 않는다. 판정은 각주 병기로만 남긴다.
- **`%% Backend orchestration` 외 edge 그룹 (user-facing · scheduler · worker pipeline · db boundary · external egress) 재판정 금지** — scheduler 2 개는 `§ 12.54` 가 이미 닫았고 (인용만), 나머지 4 그룹은 파생 영향 (1) 의 후속 slice 소관이다.
- **node 집합 · 이름 · 카운트 · 소속 재판정 금지** — `§ 12.53` 이 이미 닫았다. 본 slice 의 (iv) 는 **판정 기준으로서의 외연 정의** 일 뿐 node 축 재판정이 아니다.
- **`## Component table` 8 row 의 본문 (책임 · contract · REQ · pointer) 재판정 · 편집 금지** — `§ 12.44` ~ `§ 12.50` 이 이미 닫았다.
- **`## Contracts` 표 (226 ~ 251 행) 판정 · 편집 금지** — 대응 row **좌표와 문구 인용** 까지만이며, 참 / 거짓 판정은 파생 영향 (3) 소관이다.
- **각주 10 블록의 판정 내용 재검토 · 재작성 · 삭제 · 이관 금지** — 좌표 확인 · 1 구 인용 · AC 4 가 허용한 stale 숫자 치환 (≤ 2 지점) 까지만.
- **audit 기존 절 (`§ 12.1` ~ `§ 12.54`) 수정 금지** — 판정은 `§ 12.55` 순수 append 로만 세운다 (`§ 12.15`).
- **`docs/decisions/ADR-0003-deployment.md` · [ADR-0042](../decisions/ADR-0042-nestjs-schedule-adoption.md) 편집 · status 변경 금지** — 문구 인용까지만.
- **[modules.md](../architecture/modules.md) 편집 금지** — **200** 행 1:N 매핑 인용까지만이며, 카운트 claim 대조는 파생 영향 (13) 소관이다.
- **`docs/PLAN.md` · `docs/requirements.md` 편집 금지** — 좌표 확인용 grep 인용까지만.
- **components.md 전면 anchor 좌표계 이행 실행 금지** — 파생 영향 (14) · (15) 소관이다.
- **다른 문서로의 cascade 금지** — [use-cases/INDEX.md](../use-cases/INDEX.md) · `UC-01` ~ `UC-09` · [INDEX.md](../architecture/INDEX.md) · [deployment.md](../architecture/deployment.md) · [directory.md](../architecture/directory.md) · [api.md](../architecture/api.md) · [README.md](../../README.md) 는 무편집.
- **빌드 · 테스트 · 설치 실행 금지** — `pnpm install` · `pnpm build` · `pnpm test` 어느 것도 실행하지 않는다 (측정은 전부 read-only `grep` · `sed` · `ls` · `wc` · `git`).
- **CI drift-guard spec 작성 금지** — `pr` mode 소관이라 본 direct task 에서 진행하면 §3.1 위반.

## Suggested Sub-agents

`implementer` 단독 (doc-only, 코드 0 LOC — architect · tester 불요. §3.2 direct-mode 면제).

## Follow-ups
