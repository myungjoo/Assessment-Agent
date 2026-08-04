---
id: T-1455
title: components.md `## Component diagram` (28 ~ 113 행) **mermaid process subgraph node 8 개** ↔ 표 data row 8 · 실 `src/**` module · `다이어그램 표기` 카운트 claim 대조 — T-1454 파생 영향 (1) 집행 + audit §12.53
phase: P5
status: PENDING
commitMode: direct
coversReq: [REQ-057]
estimatedDiff: 200
estimatedFiles: 3
created: 2026-08-04
independentStream: uc-doc-audit-resync
dependsOn: [T-1454]
touchesFiles:
  - docs/architecture/components.md
  - docs/use-cases/REQ-COVERAGE-AUDIT.md
  - docs/tasks/T-1455-components-md-component-diagram-mermaid-node-vs-table-row-audit.md
plannerNote: "uc-doc-audit-resync 67 번째 slice — T-1454 파생 영향 (1) (mermaid node ↔ 표 8 row ↔ 실 module) 1 순위 집행. doc-only 1.6x"
---

# T-1455 — components.md `## Component diagram` mermaid node ↔ 표 8 row · 실 module 대조

## Why

[T-1454](T-1454-components-md-deployment-context-8-component-claim-vs-table-row-count.md) 가 카운트 축을 닫으면서 ([REQ-COVERAGE-AUDIT.md](../use-cases/REQ-COVERAGE-AUDIT.md) `§ 12.52`) **파생 영향 (1)** 로 **"`## Component diagram` mermaid node ↔ 실 module · 표 8 row 대조 (node 수가 8 과 일치하는지 포함) — 다음 대조 1 순위"** 를 지목했다. 본 task 는 그 지목을 집행한다.

`§ 12.44` ~ `§ 12.50` 이 **표 8 row 의 본문 (책임 · contract · REQ · pointer)** 을 row 별로 이미 닫았고, `§ 12.51` 이 **표 뒤 각주 구조** 를, `§ 12.52` 가 **카운트 claim** 을 닫았다. 남은 미대조 표면은 `## Component table` 앞의 **mermaid 다이어그램 (30 ~ 106 행) 과 그 아래 `다이어그램 표기` 4 bullet (108 ~ 113 행)** 이다. 본 slice 는 그 구간의 **node 집합 · edge 가 주장하는 결선 · bullet 의 카운트 claim** 을 표 8 row 와 실 `src/**` 인벤토리에 대조한다. **row 본문 재판정은 하지 않는다** — 이미 닫힌 절의 판정을 인용할 뿐이다.

planner 사전 확인 — **아래는 전부 가설이며 전제가 아니다** (T-1440 AC 1 이후 planner 기대가 실측에 반증·정정된 선례가 16 회 있다). executor 는 AC 1 에서 전부 재측정하고 **기대와 다르면 그 축의 판정을 실측대로 뒤집는다**. ① `process` subgraph (49 ~ 59 행) 의 node 는 **8 개** 이고 표 data row 8 과 **이름까지 1:1** 일 가능성이 크다. ② **111 행의 `in-process component 8 개`** 는 그 실측과 일치해 **참** 일 가능성이 크다. ③ 다만 **`Web UI` node 는 process subgraph 안에 있으나 실제로는 브라우저에서 도는 별도 `web/` 패키지 SPA** ([ADR-0040](../decisions/ADR-0040-frontend-stack.md)) 라, "NestJS 단일 process 안의 in-process component" 라는 subgraph 라벨과 **부분 상충** 할 가능성이 있다 (표 `Web UI` row 자체가 `별도 web/ 패키지` 를 명시한다). ④ node ↔ 실 module 매핑은 `src/` top-level 디렉토리 (`assessment-evaluation` · `scheduling` · `llm` · `github` · `confluence` · `persistence` · `web` 등) 로 대체로 이어지나 **1:1 이 아닌 지점** (`Backend API` 가 특정 디렉토리가 아니라 controller 군 전체를 가리키는 등) 이 있을 가능성이 크다. ⑤ **T-1454 가 178 행 뒤에 각주 1 블록을 새로 붙였으므로, 128 행 안내 blockquote 의 `아래 blockquote **7 블록**` 표기가 8 로 밀려 stale 이 됐을** 가능성이 크다 (T-1454 편집이 만든 **직접 파생 drift**). ⑥ 신규 각주는 **각주군 말미 (현 182 행 뒤) 에 붙이면 밀리는 자기 참조가 heading 좌표 1 지점** 뿐일 가능성이 크다 (`§ 12.51` · `§ 12.52` 가 2 회 연속 실측한 구조).

**행 좌표 주의** — components.md 는 T-1454 각주 +4 행으로 **252** 행이고, `## 개요` **5**, `## Deployment 컨텍스트` **22**, `## Component diagram` **28** (mermaid 블록 **30 ~ 106**, `process` subgraph **49 ~ 59**, `external` subgraph **33 ~ 44**, `다이어그램 표기` bullet **108 ~ 113**), `## Component table` **115** (표 본체 **117 ~ 126** · data row **119 ~ 126**), 안내 blockquote **128 ~ 131**, 각주 8 블록 **133 · 139 · 147 · 154 · 160 · 167 · 173 · 180** (구간 끝 **182**), `## GitHub Adapter — 3 instance 묶음 vs 분리 결정` **184**, `## Contracts` **216**, `## References` **242** 이다. AC 1 (i) 에서 재실측한다.

[PLAN.md](../PLAN.md) 의 미완 bullet (106 · 108 · 109 · 140 · 151) 은 owner 게이트 · 외부 credential · 새 dependency 게이트라 planner 단독 진행 불가이므로, 본 doc stream 이 현 시점 우선순위 최상위다.

## Required Reading

- `docs/architecture/components.md` — **252 행**. 다음 구간만 읽는다.
  - **28 ~ 113 행** (`## Component diagram` heading + mermaid 블록 + `다이어그램 표기` 4 bullet) — **본 slice 의 판정 대상**.
  - **115 ~ 126 행** (`## Component table` heading + header 2 행 + data row 8) — **무편집, 대조용**. **row 의 첫 굵은 이름과 행 번호만** 쓴다. **row 본문 (책임 · contract · REQ · pointer) 재판정 금지**.
  - **128 ~ 131 행** (T-1453 안내 blockquote) — **`7 블록` 표기 1 구만** 인용 (AC 1 (vi) 재-drift 확인용). 그 밖 재작성 금지.
  - **180 ~ 182 행** (T-1454 신규 각주 블록) — **무편집**, 각주군 말미 좌표 확인용 인용만.
  - **그 밖 전 구간** — **무편집, heading 좌표 확인만**.
- `docs/use-cases/REQ-COVERAGE-AUDIT.md` — **5214 행**. **`### 12.15`** (append-only 처리 방침 정본) · **`### 12.52`** (**5130** 행 — **파생 영향 (1)** 원문 + (ii) 표 data row 8 실측 1 구 + (vii) 삽입 파급 ⓐ 19 · ⓑ 1 수치 1 구) · **`## 11. References` (5201 행)** — `§ 12.53` 삽입 위치 경계. **row 본문을 닫은 `§ 12.44` ~ `§ 12.50` 은 열지 않는다** — 필요한 판정은 `§ 12.52` 또는 components.md 각주 blockquote 머리 1 구 인용으로 갈음한다 (§7).
- `docs/architecture/modules.md` — **259 행. 무편집**. **module 인벤토리 목록 부분만** (node ↔ 실 module 매핑 대조용). 판정 문장 통독 금지.
- `docs/decisions/ADR-0003-deployment.md` — **173 행. 무편집**. **`### Decision §1` (32 ~ 45 행) 의 "동일 process 동작" 1 구만** 인용 (subgraph 라벨 `NestJS 단일 process (ADR-0003 §1)` 의 승계 여부 판정용). **§2 · §3 · §4 · Alternatives · Consequences 는 열지 않는다**.
- `docs/PLAN.md` — **175 행. 무편집, 읽기만**. 미완 bullet 좌표 확인용 `grep` 만.
- `CLAUDE.md` §3 (task 크기 상한) · §3.2 (direct doc-only 면제) · §7 (context 절약) · §12 (언어 정책)

## Acceptance Criteria

- [ ] **AC 1 — 실측 선행 (날조 금지)**: 편집 전에 다음을 직접 측정해 `§ 12.53` 에 **명령과 출력을 함께** 인용한다. 기대값과 **다르면 그 축의 판정을 실측대로 뒤집는다** (Why 의 ① ~ ⑥ 은 가설일 뿐이다).
  - (i) **좌표 재확인**: `grep -n '^#\{1,3\} ' docs/architecture/components.md` 로 heading 좌표를 **먼저 실측** 한다 (본 AC 의 `28` · `115` · `184` · `216` · `242` 도 stale 일 수 있다 — T-1436 ~ T-1454 선례). 이어 `grep -n '^\s*subgraph\|^```' docs/architecture/components.md` 로 mermaid 블록 · subgraph 경계를 확정한다.
  - (ii) **node 전수 열거 (본 slice 의 축이 되는 측정)**: `sed -n '49,59p' docs/architecture/components.md` 로 `process` subgraph 를 인용해 **node id + 라벨** 을 전수 나열하고 **개수** 를 센다. `grep -nc '^\s*[a-z_]*\["' docs/architecture/components.md` 또는 동등한 1 명령으로 **문서 전체 node 수** 도 세어 **process 안 / 밖 (external 9 · user_browser · postgres)** 을 구분한 산출식 1 구를 보인다.
  - (iii) **node ↔ 표 row 1:1 대조**: (ii) 의 process node 라벨과 `grep -n '^| \*\*' docs/architecture/components.md` 의 data row 굵은 이름을 **양방향** 으로 맞춰, **node 에만 있는 것 / row 에만 있는 것 / 이름이 다른 것** 을 각각 열거한다 (없으면 **0** 이라 적는다).
  - (iv) **node ↔ 실 module 매핑**: `ls -d src/*/ 2>/dev/null` **1 명령** 과 `ls -d web/src 2>/dev/null` 로 실 디렉토리를 열거해 node 8 개마다 **대응 module 경로 (또는 `단일 디렉토리 대응 없음`)** 를 표로 잇는다. **디렉토리 존재 확인까지만** — 파일 내부를 열거나 심볼을 세지 않는다 (row 본문 축은 `§ 12.44` ~ `§ 12.50` 이 이미 닫았다).
  - (v) **`다이어그램 표기` bullet 카운트 · claim 대조**: `sed -n '108,113p' docs/architecture/components.md` 를 인용해 4 bullet 각각의 claim (노란 점선 박스 = external / **process subgraph = in-process component 8 개** / PostgreSQL = 외부 process / 사용자 브라우저 = 3 등급 entry point) 을 (ii) ~ (iv) 실측과 대조한다. **111 행의 `8 개`** 표기의 정확한 행 번호를 `grep -n 'in-process component' …` 로 확정한다.
  - (vi) **T-1454 파생 drift 확인 (Why ⑤)**: `sed -n '128,131p' docs/architecture/components.md` 로 안내 blockquote 를 인용하고 `grep -c '^> \*\*`## Component table`' …` 가 아니라 **각주 블록 시작행 실측** (`grep -n '^> \*\*' …` 출력 중 **133 행 이후** 항목) 으로 현재 각주 블록 수를 세어, **`7 블록` 표기가 stale 인지** 를 수치로 가른다. stale 이면 정정 대상 좌표 (행 번호) 를 명시한다.
  - (vii) **삽입 파급 실측 (AC 3 입력)**: 신규 각주를 ⓐ `## Component table` heading 직전 (115 행) 에 넣을 때 / ⓑ 각주군 말미 (182 행 뒤) 에 넣을 때 **각각 밀리는 자기 참조 좌표가 몇 지점인지** 를 `§ 12.52` (vii) 이 확정한 자기 참조 **20** 지점 목록과 삽입 지점 비교로 **수치 2 개** 로 제시한다 (재-grep 1 명령 이내 허용).
  - (viii) baseline — `wc -l` components.md **252** · audit **5214** · ADR-0003 **173** · requirements.md **97** · deployment.md **232** · directory.md **203** · modules.md **259** · PLAN.md **175**, `grep -c '^## '` components.md **7** · audit **12**, audit `grep -c '^| REQ-'` **66** · `grep -c '^### 12\.'` **52**, components.md `grep -c '^> '` **53**.
- [ ] **AC 2 — 판정표**: AC 1 이 실측한 **축** 마다 `참 / 부분참 / 거짓` 을 판정한 표를 만든다. 각 row 는 **축 1 구 · 실측 근거 (행 번호 포함) · 판정 · 근거 1 구** 4 컬럼이다. 최소 축 5 개 — ① **process subgraph node 수 ↔ 표 data row 8** (AC 1 (ii) · (iii)), ② **node 이름 ↔ row 이름 1:1 정합** (불일치 지점 열거), ③ **node ↔ 실 module 매핑 존재 여부** (AC 1 (iv) — 단일 디렉토리 대응이 없는 node 는 그 사실이 판정 결과다), ④ **`다이어그램 표기` 4 bullet 의 claim** (특히 **111 행 `in-process component 8 개`** 와 `Web UI` 의 process 소속 표기 — Why ③), ⑤ **subgraph 라벨 `NestJS 단일 process (ADR-0003 §1)` 의 ADR 승계 여부** (`§ 12.52` 축 ③ 이 "개수는 미승계" 를 확정했으므로 본 축은 **process 동작 결정** 의 승계만 묻는다).
  - **표 row 본문 (책임 · contract · REQ · pointer) 재판정 금지** · **edge 가 주장하는 계약 시그니처 재판정 금지** — 본 slice 는 **node 집합 · 이름 · 카운트 · 소속** 만 다룬다.
- [ ] **AC 3 — 처리 방식 판정**: 후보 4 개 중 **채택 1 · 기각 3** 인 판정표를 만든다. 기각마다 근거 1 구.
  - 후보 — (A) **현행 유지 + 무편집** (audit `§ 12.53` 기록만), (B) **각주군 말미 append** — 각주 구간 **끝 (현 182 행 뒤)** 에 blockquote **1 블록 (≤ 5 행)** 을 신설해 다이어그램 판정을 병기하고, AC 1 (vi) · (vii) 이 stale 로 확정한 좌표 · 수치만 in-place 정정 (**≤ 2 지점**), (C) **`## Component diagram` 절 안 각주 삽입** (115 행 heading 직전) + 밀린 좌표 전수 정정, (D) **mermaid 블록 · bullet 본문 in-place 수정** (node 이동 · 라벨 · 카운트 문구 고쳐 쓰기).
  - 판정 기준 **4 축** 명시 — ① `§ 12.15` **append-only 정합** (기존 본문 삭제 · 재작성이 방침과 충돌하는지 — **(D) 는 이 축에서 먼저 판정**), ② **좌표 drift 파급** (AC 1 (vii) 의 수치 2 개를 그대로 근거로), ③ **cap** — 예상 diff ≤ 300 LOC · 변경 파일 **3 고정** (초과 후보는 **자동 기각 + split 제안을 파생 영향에 기록**), ④ **탐색성** (다이어그램 독자가 판정 근거에 닿는 경로 길이 — T-1453 안내 blockquote 매핑을 재사용할 수 있는지).
  - **AC 2 축 ① · ④ 가 모두 `참` 이면 (D) 는 자동 기각** (고칠 대상이 없다). 반대로 하나라도 `거짓` 이면 (A) 는 자동 기각 (오도가 남는다).
  - **mermaid 블록 안 node 를 subgraph 밖으로 옮기거나 라벨을 고쳐 쓰는 선택지는 채택하지 않는다** — 다이어그램 구조 변경은 본 doc-audit stream 의 scope 밖이며 (Why ③ 이 부분 상충으로 판정되어도) 처리는 **각주 병기** 로 한다. 이 사실을 판정표 아래 1 구로 명시한다.
- [ ] **AC 4 — 채택안 반영**: AC 3 채택안대로만 편집한다.
  - **(A) 채택 시** — components.md **무편집** (`git status --porcelain docs/architecture/components.md` **빈 출력**) 이며, 유지 근거를 `§ 12.53` 에 남긴다.
  - **(B) 채택 시** — 신규 blockquote 는 **마지막 각주 블록 뒤 · `## GitHub Adapter …` heading 직전** 에 삽입하고 **≤ 5 행 + 앞 빈 줄 1 행**, in-place 정정은 **AC 1 (vi) · (vii) 이 stale 로 확정한 지점만 ≤ 2 지점** (숫자 1 개씩 치환, **문장 재작성 금지**). `wc -l` 증가 **+6 이내** (252 → ≤ 258).
  - **(C) · (D) 채택 시** — 변경 파일 3 · diff ≤ 300 LOC 를 **먼저 검산** 하고, 초과하거나 정정 지점이 **3 지점 이상** 이면 채택을 철회해 (B) 로 내린 뒤 그 사실을 `§ 12.53` 에 1 구로 남긴다.
  - **삽입으로 heading 좌표가 다시 밀리면 편집 후 `grep -n '^## ' docs/architecture/components.md` 로 재측정해 반영** 한다 (`§ 12.51` 이 `175` → `180`, `§ 12.52` 가 `180` → `184` 로 겪은 재-drift 의 3 회째 재현 여부를 1 구로 기록).
  - **문구 · 행 번호 · 절 번호 · task ID 는 AC 1 실측 출력과 1:1 일치** 해야 하며, 실측되지 않은 값을 **새로 창작하지 않는다**.
  - **mermaid 블록 (30 ~ 106 행) · 표 본체 (117 ~ 126 행) · 1 ~ 4 행 blockquote · `## 개요` 각주 (16 ~ 20 행) · 각주 8 블록의 판정 문장 · 184 행 이후 전 구간 무편집**. 허용되는 in-place 는 **stale 숫자 치환뿐** 이다.
  - **secret · token · 실 credential 을 문서에 옮겨 적지 않는다** (CLAUDE.md §9).
- [ ] **AC 5 — audit `§ 12.53` 신설**: [REQ-COVERAGE-AUDIT.md](../use-cases/REQ-COVERAGE-AUDIT.md) 의 `## 11. References` (5201 행) **직전** 에 `### 12.53 …` 절을 **순수 append** 한다 (기존 절 수정 0). 구성 — 본 절의 위치 · 계보 1 문단 (**`§ 12.52` 파생 영향 (1) 의 1 순위 지목**) / AC 1 실측 (명령 + 출력) / AC 2 판정표 / AC 3 처리 판정표 / AC 4 반영 결과 + 무편집 경계 / 파생 영향 (목록만) / 불변 검산 / 한계. **절 전체 ≤ 100 행** (초과 시 실측 인용을 요약형으로 압축하고 압축 사실을 한계에 명시).
  - `###` 레벨이라 `grep -c '^## '` **12 불변** · `grep -c '^| REQ-'` **66 불변** · `grep -c '^### 12\.'` **52 → 53**.
- [ ] **AC 6 — 불변 검산**: 다음을 실행해 출력을 `§ 12.53` 에 인용한다. `wc -l` components.md (252 → ≤ 258) · audit (5214 → +100 이내) · **ADR-0003 173 불변** · requirements.md (**97 불변**) · deployment.md (**232 불변**) · directory.md (**203 불변**) · modules.md (**259 불변**) · PLAN.md (**175 불변**), `git diff -U0 -- docs/architecture/components.md | grep '^@@'` 로 **hunk 개수 · 위치** 를 보이고 AC 4 허용 구간 밖 hunk **0** 을 실증 (무편집 채택 시 **hunk 0**), `git diff --numstat` 으로 **순수 삭제 0** (삭제 행이 있으면 stale 숫자 치환의 짝임을 1 구로 설명), `git status --porcelain src/ test/ web/ prisma/ deploy/ docker-compose.yml Dockerfile .github/ package.json README.md .claude/ docs/decisions/ docs/ops/ docs/PLAN.md docs/requirements.md` **빈 출력**, `git status --porcelain` 전체가 **3 파일 이내**.
- [ ] **AC 7 — 파생 영향 기록 (목록만, 본 slice 편집 금지)**: `§ 12.53` 말미에 후속 slice 대상을 목록으로 남긴다. 최소 포함 — (1) **mermaid edge 가 주장하는 결선 ↔ 실 호출 그래프 대조** (본 절이 node 축만 닫으므로 **다음 대조 1 순위 후보** — 특히 `scheduler → worker` 는 `§ 12.50` 이 **미결선 (거짓)** 으로 판정한 축이라 edge 표기와 상충할 수 있다) / (2) `## GitHub Adapter — 3 instance 묶음 vs 분리 결정` sub-section 본문 ↔ 코드 대조 (`§ 12.48` FU4 미소진) / (3) `## Contracts` 표 ↔ 실 계약 표면 대조 / (4) row pointer 셀 보강 2 건 (`Scheduler` = `ADR-0042` 미등재 `§ 12.50` FU2 · `Confluence Adapter` `§ 12.49` FU2) / (5) LLM · GitHub adapter ADR pointer 미등재 (`§ 12.47` FU5 · `§ 12.48` FU3) / (6) `@nestjs/config` 미도입 전수 sweep (`§ 12.39` FU3, ADR 게이트) / (7) reviewer 규약 미이행 (`§ 12.41` FU2) / (8) `deploy/README.md` ↔ deployment.md ↔ runbook 3 자 정합 (`§ 12.41` FU3) / (9) README 행 번호 pointer drift 전수 sweep / (10) REQ 번호 체계 잔재 sweep (`§ 12.38` FU3) / (11) `CLAUDE.md` §1 pointer 부정확 (T-1442 FU3) / (12) UC-09 `§ 5` sequence participant 병기 (**40 회째 이월**) / (13) modules.md 카운트 claim 대조 (`§ 12.34` FU1, ADR 게이트) / (14) **행 번호 → anchor 좌표계 이행** (**34 회째 이월** — 본 절 AC 1 (vi) 의 T-1454 파생 drift 실측이 재료를 더 보탰는지 1 구로 표기) / (15) 각주 heading 참조 anchor 이행 축소 scope (`§ 12.51` FU19 split 제안 미소진) / (16) `§ 12.44` 한계 "mutation 러너 26 개" 정의 미확정 / (17) `Scheduler` cron → 평가 pipeline 미결선 (`§ 12.50` FU18 — **코드 소관, `pr` task 로만**) / (18) `ADR-0003` "단일 DB 인스턴스" 좌표 부재 (`§ 12.46` FU16) / (19) **`Web UI` node 의 process subgraph 소속 표기** (AC 2 축 ④ 가 `부분참` 이상으로 판정한 경우에만 — 다이어그램 구조 변경은 별도 slice) / (20) **AC 3 에서 기각된 후보의 split 제안** (기각이 cap 사유였을 때만).
- [ ] **AC 8 — R-110 / R-112 면제 근거 명시**: 본 task 는 `commitMode: direct` doc-only 로 production code **0 LOC** · 분기 **0** 이라 [CLAUDE.md](../../CLAUDE.md) §3.2 direct-mode 면제 조항에 따라 tester 호출 · happy / error / flow / negative 4 항목 · `pnpm test:cov` 가 **N/A** 임을 `§ 12.53` 에 1 구로 명시한다.
- [ ] **AC 9 — 언어 · 링크 규약**: 추가 문장은 모두 한국어 (§12), 문서 간 참조는 상대경로 markdown 링크, 수치는 실측 출력과 1:1 일치.

## Out of Scope

- **코드 · schema · frontend · 배포 자산 · CI · agent 정의 변경 절대 금지** — `src/` · `web/` · `test/` · `prisma/` · `scripts/` · `deploy/` · `docker-compose.yml` · `Dockerfile` · `.github/workflows/` · `package.json` · `.claude/agents/` 는 diff 에 등장하면 안 된다 (`ls -d` 존재 확인은 read-only 라 허용).
- **mermaid 블록 (30 ~ 106 행) 편집 금지** — node 이동 · 라벨 변경 · edge 추가 · classDef 수정 어느 것도 하지 않는다. 판정은 각주 병기로만 남긴다.
- **mermaid edge 가 주장하는 결선 · 계약 시그니처 재판정 금지** — 파생 영향 (1) 소관이다. 본 slice 는 **node 집합 · 이름 · 카운트 · 소속** 만 다룬다.
- **`## Component table` 8 row 의 본문 (책임 · contract · REQ · pointer) 재판정 · 편집 금지** — `§ 12.44` ~ `§ 12.50` 이 이미 닫았고, 본 slice 는 **row 의 굵은 이름과 개수** 만 쓴다.
- **각주 8 블록의 판정 내용 재검토 · 재작성 · 삭제 · 이관 금지** — 블록 시작행 좌표와 개수 세기까지만.
- **audit 기존 절 (`§ 12.1` ~ `§ 12.52`) 수정 금지** — 판정은 `§ 12.53` 순수 append 로만 세운다 (`§ 12.15`).
- **`docs/decisions/ADR-0003-deployment.md` · [ADR-0040](../decisions/ADR-0040-frontend-stack.md) 편집 · status 변경 금지** — 문구 인용까지만.
- **[modules.md](../architecture/modules.md) 편집 금지** — 인벤토리 대조 인용까지만이며, modules.md 자체의 카운트 claim 대조는 파생 영향 (13) 소관이다.
- **`docs/PLAN.md` · `docs/requirements.md` 편집 금지** — 좌표 확인용 grep 인용까지만.
- **components.md 전면 anchor 좌표계 이행 실행 금지** — 파생 영향 (14) · (15) 소관이다.
- **`## Contracts` · `## References` · `## GitHub Adapter …` sub-section 판정 · 편집 금지**.
- **다른 문서로의 cascade 금지** — [use-cases/INDEX.md](../use-cases/INDEX.md) · `UC-01` ~ `UC-09` · [INDEX.md](../architecture/INDEX.md) · [deployment.md](../architecture/deployment.md) · [directory.md](../architecture/directory.md) · [api.md](../architecture/api.md) · [README.md](../../README.md) 는 무편집.
- **빌드 · 테스트 · 설치 실행 금지** — `pnpm install` · `pnpm build` · `pnpm test` 어느 것도 실행하지 않는다 (측정은 전부 read-only `grep` · `sed` · `ls` · `wc` · `git`).
- **CI drift-guard spec 작성 금지** — `pr` mode 소관이라 본 direct task 에서 진행하면 §3.1 위반.

## Suggested Sub-agents

`implementer` 단독 (doc-only, 코드 0 LOC — architect · tester 불요. §3.2 direct-mode 면제).

## Follow-ups
