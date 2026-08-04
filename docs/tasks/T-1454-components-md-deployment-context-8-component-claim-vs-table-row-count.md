---
id: T-1454
title: components.md `## Deployment 컨텍스트` (22 ~ 26 행) **"모든 8 component 동일 process" claim** ↔ 표 data row 8 · ADR-0003 §1 대조 + `§ 12.50` "표 7 row" 표기 **확정 판정** — T-1453 파생 영향 (1) 계승 + audit §12.52
phase: P5
status: PENDING
commitMode: direct
coversReq: [REQ-057]
estimatedDiff: 200
estimatedFiles: 3
created: 2026-08-04
independentStream: uc-doc-audit-resync
dependsOn: [T-1453]
touchesFiles:
  - docs/architecture/components.md
  - docs/use-cases/REQ-COVERAGE-AUDIT.md
  - docs/tasks/T-1454-components-md-deployment-context-8-component-claim-vs-table-row-count.md
plannerNote: "uc-doc-audit-resync 66 번째 slice — T-1453 파생 영향 (1) (8 component claim ↔ row 8 vs 각주 7 확정 판정) 1 순위 집행. doc-only 1.6x"
---

# T-1454 — components.md `## Deployment 컨텍스트` "8 component 동일 process" claim ↔ 표 data row 카운트 확정 판정

## Why

[T-1453](T-1453-components-md-table-footnote-structure-rejudge.md) 이 표 뒤 각주 구조를 닫으면서 ([REQ-COVERAGE-AUDIT.md](../use-cases/REQ-COVERAGE-AUDIT.md) `§ 12.51`) **파생 영향 (1)** 로 `## Deployment 컨텍스트` 의 **"모든 8 component 는 동일 NestJS process 안에서 동작"** claim ↔ 표 row 카운트 대조를 **8 회째 이월 항목이자 다음 대조 1 순위** 로 지목했고, 동시에 그 절의 **한계 3** 이 `§ 12.50` 의 `표 **7 row**` 표기와 `§ 12.51` (i-b) 의 `data row **8**` 실측이 **상충하지만 확정 판정하지 않았다** 고 명시했다. 본 task 는 그 두 지목을 한 slice 에서 집행한다.

두 축이 한 slice 로 묶이는 이유는 하나다 — 둘 다 **"components.md 의 component 수 claim 이 몇인가"** 라는 동일한 사실을 묻는다. `## Deployment 컨텍스트` 는 `8 component` 라 적었고, `§ 12.50` 은 `표 7 row` 라 적었으며, `§ 12.51` 실측은 `grep -c '^| \*\*'` → **8** 이었다. 표 data row 수를 **한 번만** 재측정하면 두 표기의 참 / 거짓이 동시에 갈린다.

planner 사전 확인 — **아래는 전부 가설이며 전제가 아니다** (T-1440 AC 1 이후 planner 기대가 실측에 반증·정정된 선례가 15 회 있다). executor 는 AC 1 에서 전부 재측정하고 **기대와 다르면 그 축의 판정을 실측대로 뒤집는다**. ① 표 data row 는 **8** 이고 `## Deployment 컨텍스트` 의 `8 component` 는 **참** 일 가능성이 크다. ② `§ 12.50` 의 `표 7 row` 는 **각주 블록 수 (7) 와 row 수 (8) 를 혼동한 오기** 일 가능성이 크다 (`§ 12.45` 가 `Backend API` + `Worker` 2 row 를 1 블록으로 묶었기 때문). ③ **`§ 12.50` 본문은 `§ 12.15` append-only 방침상 수정 대상이 아니므로**, 확정 판정은 **`§ 12.52` 의 pointer 문장으로만** 세워야 할 가능성이 크다. ④ `## Deployment 컨텍스트` 가 인용한 [ADR-0003 §1](../decisions/ADR-0003-deployment.md) (**32 ~ 45 행**) 은 monolithic 결정을 박제하지만 **component 개수 자체는 명시하지 않을** 가능성이 크다 (그렇다면 `8` 은 ADR 승계값이 아니라 본 문서 자체 카운트라 표 row 로만 검증된다). ⑤ **신규 각주를 `## Deployment 컨텍스트` 절 안 (28 행 heading 직전) 에 삽입하면 그 뒤 전 구간이 밀려 표 좌표 (117 ~ 126) · row 좌표 (119 ~ 126) 를 참조하는 표기 10 지점 이상이 동시에 stale 이 된다** — `§ 12.51` 축 ② 가 실측으로 세운 구조다. 반면 **표 뒤 각주군 말미 (현 178 행 뒤) 에 붙이면 밀리는 자기 참조는 heading 좌표 1 지점** 뿐일 가능성이 크다. 이 파급 차이가 AC 3 의 1 순위 판정 축이다.

**행 좌표 주의** — components.md 는 T-1453 안내 blockquote +5 행으로 **248** 행이고, `## 개요` **5**, `## Deployment 컨텍스트` **22** (본문 **24** · **26** 행), `## Component diagram` **28**, `## Component table` **115**, 표 header **117 ~ 118** · data row **119 ~ 126**, 안내 blockquote **128 ~ 131**, 각주 7 블록 **133 · 139 · 147 · 154 · 160 · 167 · 173** (구간 끝 **178**), `## GitHub Adapter — 3 instance 묶음 vs 분리 결정` **180**, `## Contracts` **212**, `## References` **238** 이다. AC 1 (i) 에서 재실측한다.

[PLAN.md](../PLAN.md) 의 미완 bullet (106 · 108 · 109 · 140 · 151) 은 owner 게이트 · 외부 credential · 새 dependency 게이트라 planner 단독 진행 불가이므로, 본 doc stream 이 현 시점 우선순위 최상위다.

## Required Reading

- `docs/architecture/components.md` — **248 행**. 다음 구간만 읽는다.
  - **22 ~ 27 행** (`## Deployment 컨텍스트` heading + 본문 2 문단) — **본 slice 의 판정 대상**.
  - **115 ~ 126 행** (`## Component table` heading + header 2 행 + data row) — **무편집, 카운트 대조용** (row **개수와 첫 굵은 이름만** 쓴다. **row 본문 재판정 금지**).
  - **128 ~ 131 행** (T-1453 안내 blockquote) — **무편집**, `row → 블록 → 절` 매핑이 이미 `8 row → 7 블록` 을 표기하는지 확인용 인용만.
  - **16 ~ 20 행** (`## 개요` T-1445 각주) — **무편집**. **20 행의 `## Component table` 8 row 포함` 표기 1 구만** 인용 (카운트 claim 의 기존 박제 여부 확인).
  - **133 ~ 178 행** (각주 7 블록) — **블록 시작행 좌표와 개수만** 센다. **본문 통독 · 판정 내용 재검토 금지**.
  - **그 밖 전 구간** — **무편집, heading 좌표 확인만** (`## Component diagram` **28** · `## GitHub Adapter …` **180** · `## Contracts` **212** · `## References` **238**).
- `docs/decisions/ADR-0003-deployment.md` — **173 행**. **`### Decision §1 — Monolithic NestJS process` (32 ~ 45 행) 만** 읽는다 (component 개수 명시 여부 · 문구 1 ~ 2 구 인용). **§2 · §3 · §4 · Alternatives · Consequences 는 열지 않는다**. **무편집**.
- `docs/use-cases/REQ-COVERAGE-AUDIT.md` — **5143 행**. **`### 12.15`** (append-only 처리 방침 정본) · **`### 12.51`** (**5060** 행 — **파생 영향 (1)** 원문 + **한계 3** 원문 + (i-b) `data row 8` 실측 1 구) · **`### 12.50`** (**4982** 행 — **5035 행의 `표 7 row` 표기 1 구만** 인용, 그 절의 다른 판정은 열지 않는다) · **`## 11. References` (5130 행)** — `§ 12.52` 삽입 위치 경계. **그 밖의 절은 열지 않는다** (§7).
- `docs/PLAN.md` — **175 행. 무편집, 읽기만**. 미완 bullet 좌표 확인용 `grep` 만.
- `CLAUDE.md` §3 (task 크기 상한) · §3.2 (direct doc-only 면제) · §7 (context 절약) · §12 (언어 정책)

## Acceptance Criteria

- [ ] **AC 1 — 실측 선행 (날조 금지)**: 편집 전에 다음을 직접 측정해 `§ 12.52` 에 **명령과 출력을 함께** 인용한다. 기대값과 **다르면 그 축의 판정을 실측대로 뒤집는다** (Why 의 ① ~ ⑤ 는 가설일 뿐이다).
  - (i) **좌표 재확인**: `grep -n '^#\{1,3\} ' docs/architecture/components.md` 로 heading 좌표를 **먼저 실측** 한다 (본 AC 의 `22` · `28` · `115` · `180` · `212` · `238` 도 stale 일 수 있다 — T-1436 ~ T-1453 선례). 이어 `grep -n '^> \*\*' docs/architecture/components.md` 로 각주 블록 시작행을 확인한다.
  - (ii) **표 data row 카운트 (본 slice 의 축이 되는 단일 측정)**: `grep -c '^| \*\*' docs/architecture/components.md` 와 `grep -n '^| \*\*' docs/architecture/components.md` 를 **둘 다** 실행해 **개수 + 각 row 의 행 번호 · 굵은 이름** 을 나열한다. `grep -c '^| ' …` 로 header · separator 포함 총 행수도 함께 세어 **data row 수 산출식** (총 행 − header 1 − separator 1) 을 1 구로 보인다.
  - (iii) **claim 문장 인용**: `sed -n '22,27p' docs/architecture/components.md` 로 `## Deployment 컨텍스트` 본문을 인용하고, **`모든 8 component`** 문구의 **정확한 행 번호** 를 `grep -n '8 component' docs/architecture/components.md` 로 확정한다. 같은 명령 출력에 다른 카운트 표기가 몇 hit 인지도 함께 적는다.
  - (iv) **카운트 표기 sweep (components.md 안)**: `grep -n '[0-9] row\|[0-9] component\|[0-9] 블록' docs/architecture/components.md` **1 명령** 으로 문서 안의 카운트 claim 을 전수 열거하고, 각각 **(ii) 실측과 일치 / 불일치** 를 표시한다. **불일치 지점은 행 번호까지** 적는다.
  - (v) **ADR-0003 §1 승계 여부**: `sed -n '32,45p' docs/decisions/ADR-0003-deployment.md | grep -n 'component\|process'` **1 명령** 으로 ADR §1 이 **component 개수를 명시하는지** 를 가른다. 명시가 없으면 `8` 은 **ADR 승계값이 아니라 본 문서 자체 카운트** 라는 사실이 그대로 판정 결과다 (Why ④ 검증).
  - (vi) **audit 상충 2 표기 대조**: `sed -n '5035p' docs/use-cases/REQ-COVERAGE-AUDIT.md` (`§ 12.50` 의 `표 7 row`) 와 `§ 12.51` (i-b) 의 `data row 8` 문장을 **각각 1 구씩** 인용해 상충을 실측으로 세운다. `grep -n '표 \*\*7 row\*\*\|표 7 row' docs/use-cases/REQ-COVERAGE-AUDIT.md` 로 같은 오기가 **몇 절에 퍼져 있는지** 도 센다.
  - (vii) **삽입 파급 실측 (AC 3 입력)**: 신규 각주를 ⓐ `## Component diagram` heading 직전 (28 행) 에 넣을 때 / ⓑ 각주군 말미 (178 행 뒤) 에 넣을 때 **각각 밀리는 자기 참조 좌표가 몇 지점인지** 를 `§ 12.51` (iii) 이 확정한 자기 참조 10 지점 목록 (row 8 + heading 1 + `1 ~ 4 행` 1) 과 삽입 지점 비교로 **수치 2 개** 로 제시한다 (재-grep 1 명령 이내 허용).
  - (viii) baseline — `wc -l` components.md **248** · audit **5143** · ADR-0003 **173** · requirements.md **97** · deployment.md **232** · directory.md **203** · modules.md **259** · PLAN.md **175**, `grep -c '^## '` components.md **7** · audit **12**, audit `grep -c '^| REQ-'` **66** · `grep -c '^### 12\.'` **51**, components.md `grep -c '^> '` **50**.
- [ ] **AC 2 — 판정표**: AC 1 이 실측한 **축** 마다 `참 / 부분참 / 거짓` 을 판정한 표를 만든다. 각 row 는 **축 1 구 · 실측 근거 (행 번호 포함) · 판정 · 근거 1 구** 4 컬럼이다. 최소 축 4 개 — ① `## Deployment 컨텍스트` 의 **`모든 8 component`** ↔ 표 data row 실측, ② **`§ 12.50` 의 `표 7 row` 표기** (오기인지 · 각주 블록 수를 가리킨 것인지), ③ **ADR-0003 §1 승계 여부** (`8` 의 출처가 ADR 인지 본 문서 카운트인지), ④ **components.md 안 카운트 표기 정합** (AC 1 (iv) sweep 결과 — 20 행 `8 row` · 129 행 매핑 등).
  - **표 row 본문 (책임 · contract · REQ · pointer) 재판정 금지** — 본 slice 는 **카운트와 그 claim 문장** 만 다룬다.
- [ ] **AC 3 — 처리 방식 판정**: 후보 4 개 중 **채택 1 · 기각 3** 인 판정표를 만든다. 기각마다 근거 1 구.
  - 후보 — (A) **현행 유지 + 무편집** (audit `§ 12.52` 기록만), (B) **각주군 말미 append** — 표 뒤 각주 구간 **끝 (현 178 행 뒤)** 에 blockquote **1 블록 (≤ 5 행)** 을 신설해 카운트 판정을 병기하고, AC 1 (vii) 이 stale 로 확정한 좌표만 in-place 정정 (**≤ 2 지점**), (C) **`## Deployment 컨텍스트` 절 안 각주 삽입** (28 행 heading 직전) + 밀린 좌표 전수 정정, (D) **`8 component` 문구 in-place 치환** (claim 자체를 실측값으로 고쳐 쓰기).
  - 판정 기준 **4 축** 명시 — ① `§ 12.15` **append-only 정합** (기존 본문 삭제 · 재작성이 방침과 충돌하는지 — **(D) 는 이 축에서 먼저 판정**), ② **좌표 drift 파급** (AC 1 (vii) 의 수치 2 개를 그대로 근거로 — `§ 12.51` 축 ② 가 세운 구조), ③ **cap** — 예상 diff ≤ 300 LOC · 변경 파일 **3 고정** (초과 후보는 **자동 기각 + split 제안을 파생 영향에 기록**), ④ **탐색성** (Deployment 절 독자가 카운트 근거에 닿는 경로 길이 — T-1453 안내 blockquote 매핑을 재사용할 수 있는지).
  - **AC 2 축 ① 이 `참` 으로 판정되면 (D) 는 자동 기각** (고칠 대상이 없다). 반대로 `거짓` 이면 (A) 는 자동 기각 (오도가 남는다).
  - **audit 기존 절 (`§ 12.50` 포함) 의 `표 7 row` 표기를 in-place 수정하는 선택지는 후보에 없다** — `§ 12.15` 방침상 금지이며, 확정 판정은 `§ 12.52` pointer 로만 세운다. 이 사실을 판정표 아래 1 구로 명시한다.
- [ ] **AC 4 — 채택안 반영**: AC 3 채택안대로만 편집한다.
  - **(A) 채택 시** — components.md **무편집** (`git status --porcelain docs/architecture/components.md` **빈 출력**) 이며, 유지 근거를 `§ 12.52` 에 남긴다.
  - **(B) 채택 시** — 신규 blockquote 는 **마지막 각주 블록 뒤 · `## GitHub Adapter …` heading 직전** 에 삽입하고 **≤ 5 행 + 앞 빈 줄 1 행**, in-place 좌표 정정은 **AC 1 (vii) 이 stale 로 확정한 지점만 ≤ 2 지점** (숫자 1 개씩 치환, **문장 재작성 금지**). `wc -l` 증가 **+6 이내** (248 → ≤ 254).
  - **(C) · (D) 채택 시** — 변경 파일 3 · diff ≤ 300 LOC 를 **먼저 검산** 하고, 초과하거나 정정 지점이 **3 지점 이상** 이면 채택을 철회해 (B) 로 내린 뒤 그 사실을 `§ 12.52` 에 1 구로 남긴다.
  - **삽입으로 heading 좌표가 다시 밀리면 편집 후 `grep -n '^## ' docs/architecture/components.md` 로 재측정해 반영** 한다 (`§ 12.51` 이 `175` → `180` 으로 겪은 재-drift 의 재현 여부를 1 구로 기록).
  - **문구 · 행 번호 · 절 번호 · task ID 는 AC 1 실측 출력과 1:1 일치** 해야 하며, 실측되지 않은 값을 **새로 창작하지 않는다**.
  - **표 본체 (117 ~ 126 행) · 1 ~ 4 행 blockquote · `## 개요` 각주 (16 ~ 20 행) · T-1453 안내 blockquote (128 ~ 131 행) · 각주 7 블록의 판정 문장 · mermaid 블록 · 180 행 이후 전 구간 무편집**. 허용되는 in-place 는 **stale 숫자 치환뿐** 이다.
  - **secret · token · 실 credential 을 문서에 옮겨 적지 않는다** (CLAUDE.md §9).
- [ ] **AC 5 — audit `§ 12.52` 신설**: [REQ-COVERAGE-AUDIT.md](../use-cases/REQ-COVERAGE-AUDIT.md) 의 `## 11. References` (5130 행) **직전** 에 `### 12.52 …` 절을 **순수 append** 한다 (기존 절 수정 0). 구성 — 본 절의 위치 · 계보 1 문단 (**`§ 12.51` 파생 영향 (1) · 한계 3 의 1 순위 지목**) / AC 1 실측 (명령 + 출력) / AC 2 판정표 / AC 3 처리 판정표 / AC 4 반영 결과 + 무편집 경계 / **`표 7 row` 표기 확정 판정 pointer** (`§ 12.50` 본문은 무편집 존속하며 현행 사실은 본 절이 가리킨다는 `§ 12.15` 정합 선언 **2 구 이내**) / 파생 영향 (목록만) / 불변 검산 / 한계. **절 전체 ≤ 100 행** (초과 시 실측 인용을 요약형으로 압축하고 압축 사실을 한계에 명시).
  - `###` 레벨이라 `grep -c '^## '` **12 불변** · `grep -c '^| REQ-'` **66 불변** · `grep -c '^### 12\.'` **51 → 52**.
- [ ] **AC 6 — 불변 검산**: 다음을 실행해 출력을 `§ 12.52` 에 인용한다. `wc -l` components.md (248 → ≤ 254) · audit (5143 → +100 이내) · **ADR-0003 173 불변** · requirements.md (**97 불변**) · deployment.md (**232 불변**) · directory.md (**203 불변**) · modules.md (**259 불변**) · PLAN.md (**175 불변**), `git diff -U0 -- docs/architecture/components.md | grep '^@@'` 로 **hunk 개수 · 위치** 를 보이고 AC 4 허용 구간 밖 hunk **0** 을 실증 (무편집 채택 시 **hunk 0**), `git diff --numstat` 으로 **순수 삭제 0** (삭제 행이 있으면 stale 숫자 치환의 짝임을 1 구로 설명), `git status --porcelain src/ test/ web/ prisma/ deploy/ docker-compose.yml Dockerfile .github/ package.json README.md .claude/ docs/decisions/ docs/ops/ docs/PLAN.md docs/requirements.md` **빈 출력**, `git status --porcelain` 전체가 **3 파일 이내**.
- [ ] **AC 7 — 파생 영향 기록 (목록만, 본 slice 편집 금지)**: `§ 12.52` 말미에 후속 slice 대상을 목록으로 남긴다. 최소 포함 — (1) **`## Component diagram` mermaid node ↔ 실 module · 표 8 row 대조** (본 절이 카운트 축을 닫으면 **다음 대조 1 순위 후보** — node 수가 8 과 맞는지 포함) / (2) `## GitHub Adapter — 3 instance 묶음 vs 분리 결정` sub-section 본문 ↔ 코드 대조 (`§ 12.48` FU4 미소진) / (3) `## Contracts` 표 ↔ 실 계약 표면 대조 / (4) **row pointer 셀 보강 2 건** (`Scheduler` = `ADR-0042` 미등재 `§ 12.50` FU2 · `Confluence Adapter` `§ 12.49` FU2) / (5) LLM · GitHub adapter ADR pointer 미등재 (`§ 12.47` FU5 · `§ 12.48` FU3) / (6) `@nestjs/config` 미도입 전수 sweep (`§ 12.39` FU3, ADR 게이트) / (7) reviewer 규약 미이행 (`§ 12.41` FU2) / (8) `deploy/README.md` ↔ deployment.md ↔ runbook 3 자 정합 (`§ 12.41` FU3) / (9) README 행 번호 pointer drift 전수 sweep / (10) REQ 번호 체계 잔재 sweep (`§ 12.38` FU3) / (11) `CLAUDE.md` §1 pointer 부정확 (T-1442 FU3) / (12) UC-09 `§ 5` sequence participant 병기 (**38 회째 이월**) / (13) modules.md 카운트 claim 대조 (`§ 12.34` FU1, ADR 게이트 — **본 절의 카운트 판정 화법을 그대로 재사용 가능**) / (14) **행 번호 → anchor 좌표계 이행** (**32 회째 이월** — 본 절 AC 1 (vii) 파급 실측이 재료를 더 보탰는지 1 구로 표기) / (15) **각주 heading 참조 anchor 이행 축소 scope** (`§ 12.51` FU19 split 제안 미소진) / (16) `§ 12.44` 한계 "mutation 러너 26 개" 정의 미확정 / (17) `Scheduler` cron → 평가 pipeline 미결선 (`§ 12.50` FU18 — **코드 소관, `pr` task 로만**) / (18) `ADR-0003` "단일 DB 인스턴스" 좌표 부재 (`§ 12.46` FU16) / (19) **AC 3 에서 기각된 후보의 split 제안** (기각이 cap 사유였을 때만).
- [ ] **AC 8 — R-110 / R-112 면제 근거 명시**: 본 task 는 `commitMode: direct` doc-only 로 production code **0 LOC** · 분기 **0** 이라 [CLAUDE.md](../../CLAUDE.md) §3.2 direct-mode 면제 조항에 따라 tester 호출 · happy / error / flow / negative 4 항목 · `pnpm test:cov` 가 **N/A** 임을 `§ 12.52` 에 1 구로 명시한다.
- [ ] **AC 9 — 언어 · 링크 규약**: 추가 문장은 모두 한국어 (§12), 문서 간 참조는 상대경로 markdown 링크, 수치는 실측 출력과 1:1 일치.

## Out of Scope

- **코드 · schema · frontend · 배포 자산 · CI · agent 정의 변경 절대 금지** — `src/` · `web/` · `test/` · `prisma/` · `scripts/` · `deploy/` · `docker-compose.yml` · `Dockerfile` · `.github/workflows/` · `package.json` · `.claude/agents/` 는 diff 에 등장하면 안 된다.
- **`docs/decisions/ADR-0003-deployment.md` 편집 · status 변경 금지** — §1 문구 인용까지만.
- **audit 기존 절 (`§ 12.1` ~ `§ 12.51`) 수정 금지** — `§ 12.50` 의 `표 7 row` 표기도 **무편집 존속** 이며 확정 판정은 `§ 12.52` 순수 append 로만 세운다 (`§ 12.15`).
- **`## Component table` 8 row 의 본문 (책임 · contract · REQ · pointer) 재판정 · 편집 금지** — `§ 12.44` ~ `§ 12.50` 이 이미 닫았고, 본 slice 는 **카운트** 만 다룬다.
- **각주 7 블록의 판정 내용 재검토 · 재작성 · 삭제 · 이관 금지** — 블록 시작행 좌표와 개수 세기까지만.
- **T-1453 안내 blockquote (128 ~ 131 행) 재작성 금지** — 매핑 표기가 실측과 어긋나면 그 사실을 `§ 12.52` 에 기록하고 파생 영향으로 넘긴다.
- **`## Component diagram` mermaid node 대조 · 편집 금지** — 파생 영향 (1) 소관이다.
- **components.md 전면 anchor 좌표계 이행 실행 금지** — 파생 영향 (14) · (15) 소관이다.
- **`## Contracts` · `## References` · `## GitHub Adapter …` sub-section 판정 · 편집 금지**.
- **`docs/PLAN.md` · `docs/requirements.md` 편집 금지** — 좌표 확인용 grep 인용까지만.
- **[modules.md](../architecture/modules.md) · [INDEX.md](../architecture/INDEX.md) · [deployment.md](../architecture/deployment.md) · [directory.md](../architecture/directory.md) · [api.md](../architecture/api.md) 편집 금지** — 필요 사실은 파생 영향 목록에만.
- **다른 문서로의 cascade 금지** — [use-cases/INDEX.md](../use-cases/INDEX.md) · `UC-01` ~ `UC-09` · ADR · [README.md](../../README.md) 는 무편집.
- **빌드 · 테스트 · 설치 실행 금지** — `pnpm install` · `pnpm build` · `pnpm test` 어느 것도 실행하지 않는다 (측정은 전부 read-only `grep` · `sed` · `wc` · `git`).
- **CI drift-guard spec 작성 금지** — `pr` mode 소관이라 본 direct task 에서 진행하면 §3.1 위반.

## Suggested Sub-agents

`implementer` 단독 (doc-only, 코드 0 LOC — architect · tester 불요. §3.2 direct-mode 면제).

## Follow-ups
