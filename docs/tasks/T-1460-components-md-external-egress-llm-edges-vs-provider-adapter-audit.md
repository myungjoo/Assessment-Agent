---
id: T-1460
title: components.md `## Component diagram` mermaid **`%% External egress` llm_gateway 계열 edge 5 개** (93 ~ 97 행) ↔ 실 `src/llm/providers` outbound 지점 · API key 헤더 대조 — `§ 12.57` 파생 영향 (1) 집행 + egress 그룹 마감 + audit §12.58
phase: P5
status: DONE
commitMode: direct
coversReq: [REQ-057]
estimatedDiff: 220
estimatedFiles: 3
created: 2026-08-05
independentStream: uc-doc-audit-resync
dependsOn: [T-1459]
touchesFiles:
  - docs/architecture/components.md
  - docs/use-cases/REQ-COVERAGE-AUDIT.md
  - docs/tasks/T-1460-components-md-external-egress-llm-edges-vs-provider-adapter-audit.md
plannerNote: "uc-doc-audit-resync 72 번째 slice — §12.57 이 지목한 1 순위 egress 후반부 llm_gateway 5 집행 + 그룹 마감. doc-only 1.6x"
---

# T-1460 — components.md mermaid `%% External egress` llm_gateway 계열 5 edge ↔ 실 provider adapter outbound 대조

## Why

[T-1459](T-1459-components-md-external-egress-adapter-edges-vs-outbound-audit.md) 가 `%% External egress` 9 edge 중 **adapter 계열 4 개 (89 ~ 92 행)** 만 닫으면서 ([REQ-COVERAGE-AUDIT.md](../use-cases/REQ-COVERAGE-AUDIT.md) `§ 12.57`) 파생 영향 **(1)** 에서 **다음 대조 1 순위를 `llm_gateway` 계열 5 개 (93 ~ 97 행) 로 명시 지목** 했다. 본 slice 는 그 지목을 그대로 승계해 egress 그룹의 **후반부이자 마지막 절반** 을 닫는다 — 닫으면 `%% External egress` **9** edge 전부가 판정되어 edge 축 6 그룹 중 **5 번째 그룹이 마감** 되고, 잔여는 `%% User-facing flow` **2** (65 ~ 66 행) · `%% DB persistence boundary` **1** (86 행) 뿐이 된다.

측정 축은 T-1459 와 같되 대상 계열이 다르다 — from-node 가 `llm_gateway` **1 종** 으로 단일이라 출발점 분해는 단순하지만, **도착 node 가 5 종** (`llm_custom` · `llm_azure` · `llm_anthropic` · `llm_google` · `llm_openai`) 이라 **provider 별 실 adapter 대응** 이 판정의 중심이 된다. outbound 지점 정의는 `§ 12.48` · `§ 12.49` 가 확정하고 `§ 12.57` (iv) 가 승계한 **주입 `fetchFn` 단일 지점** 정의를 다시 승계하되, LLM 계열은 gateway 1 개가 provider adapter 여러 개를 감싸는 구조라 **"gateway 의 outbound" 와 "provider adapter 의 outbound" 중 어느 층을 결선의 실체로 볼지** 를 AC 1 (iv) 에서 1 구로 재정의한다 (승계 + 층 명시).

planner 사전 확인 — **아래는 전부 가설이며 전제가 아니다** (T-1440 AC 1 이후 planner 기대가 실측에 반증·정정된 선례가 21 회 있고, 직전 T-1459 에서도 label 의 `GraphQL` 어구가 **hit 0** 으로 거짓 확정됐다). executor 는 AC 1 에서 전부 재측정하고 **기대와 다르면 그 축의 판정을 실측대로 뒤집는다**. ① ~ ⑤ `llm_gateway --> llm_custom` · `llm_azure` · `llm_anthropic` · `llm_google` · `llm_openai` (93 ~ 97 행) 는 5 provider 추상화가 `§ 12.47` 에서 이미 참으로 확정됐으므로 결선 자체는 유력하나, planner 의 예비 `ls` 에서 `src/llm/providers` 의 spec 제외 adapter 파일이 **`anthropic` · `azure-openai` · `google-gemini` · `openai-compatible` 4 개** 로 관측돼 **edge 5 ↔ adapter 4 의 개수 불일치** 가 유력하다 (`llm_custom` 과 `llm_openai` 가 같은 `openai-compatible.adapter.ts` 를 공유하면 T-1459 의 "3 host ↔ 1 지점 3 중 표기" 와 **동형 사고** 다 — 그 경우 두 edge 는 **부분참**). ⑥ 93 ~ 97 행이 공유하는 label `HTTPS REST<br/>(API key)` 의 **API key** 어구는 provider 별 헤더 형식이 다를 수 있어 (`Authorization: Bearer` · `x-api-key` · `api-key` · query param 등) **단일 label 이 5 종을 뭉뚱그린 부분참** 이 유력하다 — `## Contracts` **266** 행이 이미 "provider 별 header 다름" 을 적고 있어 그 자체가 반증 단서다. ⑦ 88 행 주석의 `ADR-0003 §4` pointer 는 T-1459 가 **참** 으로 이미 닫았으므로 **재판정하지 않고 인용만** 한다. ⑧ `## Contracts` 표의 대응 row (**266** 행) 에 같은 claim 이 중복 박제돼 있으나 그 판정은 **파생 영향 (3) 소관** 이라 본 slice 는 **좌표와 문구 인용까지만** 한다.

**행 좌표 주의** — components.md 는 T-1459 각주 +7 행으로 **280** 행이고, heading 은 `## 개요` **5** · `## Deployment 컨텍스트` **22** · `## Component diagram` **28** · `## Component table` **115** · `## GitHub Adapter …` **212** · `## Contracts` **244** · `## References` **270** 다. mermaid 블록 **30 ~ 106** (edge 그룹 주석 **64 · 68 · 75 · 79 · 85 · 88**), `다이어그램 표기` bullet **108 ~ 113**, 표 본체 **117 ~ 126**, 안내 blockquote **128 ~ 131**, 각주 **13 블록** **133 · 139 · 147 · 154 · 160 · 167 · 173 · 180 · 184 · 189 · 194 · 199 · 205** (구간 끝 **210**) 다. AC 1 (i) 에서 재실측한다.

[PLAN.md](../PLAN.md) 의 미완 bullet (106 · 108 · 109 · 140 · 151) 은 owner 게이트 · 외부 credential · 새 dependency 게이트라 planner 단독 진행 불가이므로, 본 doc stream 이 현 시점 우선순위 최상위다.

## Required Reading

- `docs/architecture/components.md` — **280 행**. 다음 구간만 읽는다.
  - **88 ~ 98 행** (`%% External egress` 그룹 전 구간) — **그룹 경계 · edge 전수 확인용**. 그중 **93 ~ 97 행** (llm_gateway 계열 edge 5) 이 **본 slice 의 판정 대상** 이고 **89 ~ 92 행 (adapter 계열 4)** 은 **T-1459 가 이미 닫은 구간** 이라 좌표 인용까지만 한다.
  - **36 ~ 46 행** (`external` subgraph node 정의, 특히 **39 ~ 43** 행 LLM 5 node) — **무편집, 대조용**. 도착 node id (`llm_custom` · `llm_azure` · `llm_anthropic` · `llm_google` · `llm_openai`) 확인까지만 (`§ 12.53` 이 node 축을 닫았다).
  - **108 ~ 113 행** (`다이어그램 표기` bullet, 특히 노란 점선 박스 = 외부 시스템 규약 1 구) — 인용만. 재판정 금지.
  - **123 행** (표 `LLM Gateway` row) — **무편집**, 이름·contract 문구 인용까지만. **row 본문 재판정 금지** (`§ 12.47` 이 닫았다).
  - **154 ~ 159 행** (`§ 12.47` LLM Gateway 각주 블록) — **무편집**. `단일 추상화 service` 참 판정 1 구 · `ADR-0003 §4` = **78** 행 참 판정 1 구 인용용 (본 slice 의 pointer 축 승계 근거).
  - **205 ~ 210 행** (T-1459 각주 블록) — **무편집**. 각주군 말미 좌표 확인 + **outbound 지점 정의 (주입 `fetchFn` 단일 지점)** 1 구 인용용 (본 slice 의 정의 승계 근거).
  - **244 ~ 269 행 중 `LLM Gateway` 를 from 으로 갖는 row 1 개 (266 행)** — **무편집**, 문구 인용까지만 (특히 `provider 별 header 다름` 어구). **`## Contracts` 표 재판정 금지** (파생 영향 (3)).
  - **그 밖 전 구간** — **무편집, heading 좌표 확인만**.
- `docs/use-cases/REQ-COVERAGE-AUDIT.md` — **5574 행**. **`### 12.15`** (append-only 처리 방침 정본) · **`### 12.57`** (**5485** 행 — 파생 영향 **(1)** 원문 + AC 1 (iv) outbound 정의 1 구 + 한계 2 · 3 의 측정 근사 1 구) · **`## 11. References` (5561 행)** — `§ 12.58` 삽입 위치 경계. **`§ 12.47` · `§ 12.53` · `§ 12.54` 본문은 열지 않는다** — 필요한 판정은 components.md **154 ~ 159 · 205 ~ 210** 행 각주 1 구 인용으로 갈음한다 (§7 context 절약).
- `docs/decisions/ADR-0003-deployment.md` — **173 행. 무편집**. **`### Decision §4` (78 행) 의 1 구만** 인용 (88 행 주석 pointer 는 T-1459 가 이미 참으로 닫았으므로 **승계 인용만**). 그 밖 절은 열지 않는다.
- `docs/PLAN.md` — **175 행. 무편집, 읽기만**. 미완 bullet 좌표 확인용 `grep` 만.
- `CLAUDE.md` §3 (task 크기 상한) · §3.2 (direct doc-only 면제) · §7 (context 절약) · §9 (secret 금지) · §12 (언어 정책)

## Acceptance Criteria

- [ ] **AC 1 — 실측 선행 (날조 금지)**: 편집 전에 다음을 직접 측정해 `§ 12.58` 에 **명령과 출력을 함께** 인용한다. 기대값과 **다르면 그 축의 판정을 실측대로 뒤집는다** (Why 의 ① ~ ⑧ 은 가설일 뿐이다).
  - (i) **좌표 재확인**: `grep -n '^#\{1,3\} ' docs/architecture/components.md` 로 heading 좌표를 **먼저 실측** 한다 (본 AC 의 `28` · `115` · `212` · `244` · `270` 도 stale 일 수 있다 — T-1436 ~ T-1459 선례). 이어 `grep -n '^\s*%%\|^```' docs/architecture/components.md` 로 mermaid 블록 경계와 edge 그룹 주석 좌표를 확정한다.
  - (ii) **edge 그룹 재확인 (split 계보 실증 + 그룹 마감 수치)**: `grep -nE '^\s+[a-z_]+ -- ' docs/architecture/components.md | wc -l` 로 전체 edge 수를 세고 `§ 12.54` 의 산출식 (**23** = 2 + 5 + 2 + 4 + 1 + 9) 이 **여전히 성립하는지** 1 구로 확인한다. 이어 `%% External egress` **9** 를 from-node 별로 분해해 (**github_adapter 3 · confluence_adapter 1 · llm_gateway 5**) **본 slice 대상은 뒤 5 개 (93 ~ 97 행) 뿐** 이며 본 slice 종료 시 egress 그룹 **9/9 마감** · 전체 edge **23 중 21 판정 완료 · 잔여 3 (user-facing 2 · db boundary 1)** 임을 수치로 명시한다.
  - (iii) **대상 edge 원문 인용**: `sed -n '93,97p' docs/architecture/components.md` (좌표는 (i) 실측값으로 교체) 로 edge 5 행을 그대로 인용하고, 각 edge 의 **출발 node · 도착 node · label 문자열** 을 3 컬럼으로 분해한다. 도착 node 정의는 `sed -n '39,43p'` 로 병기한다.
  - (iv) **outbound 지점 정의 (본 slice 의 선결 측정)**: `§ 12.57` (iv) 가 확정한 **주입 `fetchFn` 단일 지점** 정의를 **승계한다는 사실** 을 components.md **205** 행 각주 1 구 인용으로 명시하고, LLM 계열 특유의 **층 문제** (gateway 1 ↔ provider adapter N) 를 1 구로 가른다 — 근거 명령 `grep -rn 'globalThis.fetch\|fetchFn\|FetchLike' src/llm --include=*.ts | grep -v spec` 로 실 HTTP seam 이 **gateway 층에 있는지 provider adapter 층에 있는지** 를 hit 위치로 판별한다 (새 정의를 창작하지 않는다 — 층만 명시).
  - (v) **결선 실측 (본 slice 의 축)**: 다음을 각각 1 명령으로 실행해 hit 수와 대표 행을 인용한다 — ⓐ `ls src/llm/providers | grep -v spec` (provider adapter 파일 수 = **도착 node 5 와의 개수 대응**), ⓑ `grep -rn 'class .*Adapter\|implements' src/llm/providers --include=*.ts | grep -v spec` (adapter 클래스 ↔ provider 대응 실측), ⓒ `grep -rn 'custom\|openai' src/llm/providers/openai-compatible.adapter.ts | head -15` (`llm_custom` 과 `llm_openai` 가 **같은 1 adapter 의 2 중 표기** 인지 판별 — T-1459 의 3 host 동형 축), ⓓ `grep -rn 'Authorization\|x-api-key\|api-key\|apiKey' src/llm --include=*.ts | grep -v spec` (label 의 `API key` 축: provider 별 헤더 형식이 **몇 종** 인지 — provider 별로 **분리해** 셈한다), ⓔ `grep -rn 'baseUrl\|endpoint\|https://' src/llm/providers --include=*.ts | grep -v spec | head -15` (도착 endpoint 조립 지점 · provider 별 분기 유무). **파일 통독 금지** — 위 5 명령의 출력과 필요한 1 ~ 2 행 인용까지만 쓴다. **실 token · API key · credential 값은 옮겨 적지 않는다** (§9 — 변수명·host 문자열까지만).
  - (vi) **provider enum ↔ node 대조**: `grep -rn 'LlmProvider\|provider' src/llm/llm-gateway.interface.ts | head -15` 로 코드가 인정하는 provider 식별자 집합을 열거해 **mermaid 도착 node 5 종과 이름까지 1:1 인지** 를 가른다 (node 에만 / enum 에만 있는 것 각 몇 개인지 수치로).
  - (vii) **중복 claim · 좌표 stale 확인 (판정은 이월)**: `grep -n '^| LLM Gateway ' docs/architecture/components.md` 로 `## Contracts` 표의 대응 row 좌표를 실측해 본 slice 의 5 edge 와 **어떻게 대응하는지** (5:1 축약 여부 포함) 를 수치로 보이고, 그 row 의 `provider 별 header 다름` 어구를 **인용만** 한다. 이어 T-1459 가 **3 지점** 정정한 것과 같은 **heading 좌표 stale 이 남은 각주에도 있는지** 를 `grep -n '\*\*[0-9]\{3\}\*\* 행' docs/architecture/components.md | head -20` + (i) 실측으로 가른다. **`## Contracts` 표의 참 / 거짓 판정은 하지 않는다** — 파생 영향 (3) 소관임을 1 구로 명시한다.
  - (viii) **삽입 파급 실측 (AC 3 입력)**: 신규 각주를 ⓐ `## Component diagram` 절 안 (mermaid 블록 직후) 에 넣을 때 / ⓑ 각주군 말미 (**210** 행 뒤) 에 넣을 때 **각각 밀리는 자기 참조 좌표가 몇 지점인지** 를 **수치 2 개** 로 제시한다 (`§ 12.55` (viii) 의 계수 규칙 = components.md 자기 좌표 토큰만 세고 외부 파일 좌표는 제외, 범위 토큰 `A ~ B` 는 1 지점 — 그 규칙을 그대로 승계하고 승계 사실을 1 구로 명시).
  - (ix) **baseline** — `wc -l` components.md **280** · audit **5574** · ADR-0003 **173** · requirements.md **97** · deployment.md **232** · directory.md **203** · modules.md **259** · PLAN.md **175**, `grep -c '^## '` components.md **7** · audit **12**, audit `grep -c '^| REQ-'` **66** · `grep -c '^### 12\.'` **57**, components.md `grep -c '^> '` **76**.
- [ ] **AC 2 — 판정표**: AC 1 이 실측한 **축** 마다 `참 / 부분참 / 거짓` 을 판정한 표를 만든다. 각 row 는 **축 1 구 · 실측 근거 (행 번호 포함) · 판정 · 근거 1 구** 4 컬럼이다. 최소 축 7 개 — ① `llm_gateway --> llm_custom` (**93** 행, AC 1 (v) ⓐⓑⓒ), ② `--> llm_azure` (**94** 행), ③ `--> llm_anthropic` (**95** 행), ④ `--> llm_google` (**96** 행), ⑤ `--> llm_openai` (**97** 행), ⑥ label `HTTPS REST<br/>(API key)` (93 ~ 97 행 공유) — **REST 어구** 와 **API key 헤더 형식** 을 (v) ⓓⓔ 로 각각 판정, ⑦ **도착 node 5 ↔ 코드 provider 식별자 집합** 의 1:1 여부 ((vi)).
  - ① ~ ⑤ 중 둘 이상이 **같은 1 adapter 의 다중 표기** 로 드러나면 그 사실을 판정 근거에 수치로 명시한다 (edge N ↔ 실 outbound 지점 M ↔ adapter K 의 **N : M : K** 로 T-1459 의 `1 : 2 : 3` 과 같은 형식으로 적는다).
  - **판정은 (iv) 의 outbound 지점 정의 (승계 + 층 명시) 위에서만 유효** 함을 표 아래 1 구로 명시한다. **88 행 주석의 `ADR-0003 §4` pointer 축은 T-1459 가 참으로 닫았으므로 재판정하지 않고 승계 1 구만 병기** 한다.
  - **adapter 계열 edge 4 개 (89 ~ 92 행) 재판정 금지** (`§ 12.57` 소관) · **나머지 edge 그룹 재판정 금지** (`§ 12.54` ~ `§ 12.56` 및 파생 영향 (1) 소관) · **node 축 재판정 금지** (`§ 12.53`) · **표 row 본문 재판정 금지** (`§ 12.44` ~ `§ 12.50`, 특히 `LLM Gateway` row 는 `§ 12.47`).
- [ ] **AC 3 — 처리 방식 판정**: 후보 4 개 중 **채택 1 · 기각 3** 인 판정표를 만든다. 기각마다 근거 1 구.
  - 후보 — (A) **현행 유지 + 무편집** (audit `§ 12.58` 기록만), (B) **각주군 말미 append** — 각주 구간 **끝 (현 210 행 뒤)** 에 blockquote **1 블록 (≤ 6 행)** 을 신설해 edge 판정을 병기하고, AC 1 (vii) · (viii) 이 stale 로 확정한 좌표만 in-place 정정 (**≤ 3 지점**), (C) **`## Component diagram` 절 안 각주 삽입** (mermaid 블록 직후) + 밀린 좌표 전수 정정, (D) **mermaid edge · label in-place 수정** (edge 삭제 · 병합 · label 문구 고쳐 쓰기).
  - 판정 기준 **4 축** 명시 — ① `§ 12.15` **append-only 정합** (**(D) 는 이 축에서 먼저 판정**), ② **좌표 drift 파급** (AC 1 (viii) 의 수치 2 개를 그대로 근거로), ③ **cap** — 예상 diff ≤ 300 LOC · 변경 파일 **3 고정** (초과 후보는 **자동 기각 + split 제안을 파생 영향에 기록**), ④ **탐색성** (다이어그램 독자가 판정 근거에 닿는 경로 길이).
  - **AC 2 축 ① ~ ⑦ 중 하나라도 `거짓` 이면 (A) 는 자동 기각** (오도가 문서에 남는다). **전 축이 `참` 이어도 (A) 를 자동 채택하지 않는다** — 판정 근거의 탐색성 (축 ④) 을 함께 재고 결론을 1 구로 남긴다.
  - **mermaid edge 를 지우거나 병합하거나 label 을 고쳐 쓰는 선택지는 채택하지 않는다** — 다이어그램 구조 변경은 본 doc-audit stream 의 scope 밖이며 처리는 **각주 병기** 로 한다. 이 사실을 판정표 아래 1 구로 명시한다. **코드를 고쳐 label 을 참으로 만드는 처리도 금지** — `pr` task 소관이다.
- [ ] **AC 4 — 채택안 반영**: AC 3 채택안대로만 편집한다.
  - **(A) 채택 시** — components.md **무편집** (`git status --porcelain docs/architecture/components.md` **빈 출력**) 이며, 유지 근거를 `§ 12.58` 에 남긴다.
  - **(B) 채택 시** — 신규 blockquote 는 **마지막 각주 블록 뒤 · `## GitHub Adapter …` heading 직전** 에 삽입하고 **≤ 6 행 + 앞 빈 줄 1 행**, in-place 정정은 **AC 1 (vii) · (viii) 이 stale 로 확정한 지점만 ≤ 3 지점** (숫자 1 개씩 치환, **문장 재작성 금지**). `wc -l` 증가 **+7 이내** (280 → ≤ 287).
  - **(C) · (D) 채택 시** — 변경 파일 3 · diff ≤ 300 LOC 를 **먼저 검산** 하고, 초과하거나 정정 지점이 **4 지점 이상** 이면 채택을 철회해 (B) 로 내린 뒤 그 사실을 `§ 12.58` 에 1 구로 남긴다.
  - **삽입으로 heading 좌표가 다시 밀리면 편집 후 `grep -n '^## ' docs/architecture/components.md` 로 재측정해 반영** 한다 (`§ 12.51` `175` → `180`, `§ 12.52` `180` → `184`, `§ 12.53` `184` → `189`, `§ 12.54` `189` → `194`, `§ 12.55` `194` → `199`, `§ 12.56` `199` → `205`, `§ 12.57` `205` → `212` 로 이어진 재-drift 의 **8 회째** 재현 여부를 1 구로 기록).
  - **문구 · 행 번호 · 절 번호 · task ID 는 AC 1 실측 출력과 1:1 일치** 해야 하며, 실측되지 않은 값을 **새로 창작하지 않는다**.
  - **mermaid 블록 (30 ~ 106 행) · `다이어그램 표기` bullet (108 ~ 113 행) · 표 본체 (117 ~ 126 행) · 1 ~ 4 행 blockquote · `## 개요` 각주 (16 ~ 20 행) · 안내 blockquote (128 ~ 131 행) · 각주 13 블록의 판정 문장 · 212 행 이후 전 구간 무편집**. 허용되는 in-place 는 **stale 숫자 치환뿐** 이다.
  - **secret · token · API key · 실 credential · 실 endpoint 값을 문서에 옮겨 적지 않는다** (CLAUDE.md §9 — host 문자열과 env 변수 **이름** 까지만 허용).
- [ ] **AC 5 — audit `§ 12.58` 신설**: [REQ-COVERAGE-AUDIT.md](../use-cases/REQ-COVERAGE-AUDIT.md) 의 `## 11. References` (5561 행) **직전** 에 `### 12.58 …` 절을 **순수 append** 한다 (기존 절 수정 0). 구성 — 본 절의 위치 · 계보 1 문단 (**`§ 12.57` 파생 영향 (1) 이 지목한 1 순위 = egress 9 중 llm_gateway 계열 5, 본 절로 egress 그룹 9/9 마감** 명시) / AC 1 실측 (명령 + 출력) / AC 2 판정표 / AC 3 처리 판정표 / AC 4 반영 결과 + 무편집 경계 / 파생 영향 (목록만) / 불변 검산 / 한계. **절 전체 ≤ 100 행** (초과 시 실측 인용을 요약형으로 압축하고 압축 사실을 한계에 명시).
  - `###` 레벨이라 `grep -c '^## '` **12 불변** · `grep -c '^| REQ-'` **66 불변** · `grep -c '^### 12\.'` **57 → 58**.
- [ ] **AC 6 — 불변 검산**: 다음을 실행해 출력을 `§ 12.58` 에 인용한다. `wc -l` components.md (280 → ≤ 287) · audit (5574 → +100 이내) · **ADR-0003 173 불변** · requirements.md (**97 불변**) · deployment.md (**232 불변**) · directory.md (**203 불변**) · modules.md (**259 불변**) · PLAN.md (**175 불변**), `git diff -U0 -- docs/architecture/components.md | grep '^@@'` 로 **hunk 개수 · 위치** 를 보이고 AC 4 허용 구간 밖 hunk **0** 을 실증 (무편집 채택 시 **hunk 0**), `git diff --numstat` 으로 **순수 삭제 0** (삭제 행이 있으면 stale 숫자 치환의 짝임을 1 구로 설명), `git status --porcelain src/ test/ web/ prisma/ deploy/ docker-compose.yml Dockerfile .github/ package.json README.md .claude/ docs/decisions/ docs/ops/ docs/PLAN.md docs/requirements.md docs/architecture/modules.md` **빈 출력**, `git status --porcelain` 전체가 **3 파일 이내**.
- [ ] **AC 7 — 파생 영향 기록 (목록만, 본 slice 편집 금지)**: `§ 12.58` 말미에 후속 slice 대상을 목록으로 남긴다. 최소 포함 — (1) **잔여 edge 대조 2 건** (`%% User-facing flow` **2** (65 ~ 66 행) · `%% DB persistence boundary` **1** (86 행) — AC 1 (ii) 가 재확인한 개수를 병기하고 **egress 그룹 9/9 마감 사실** 과 **다음 대조 1 순위** 를 1 구로 지목) / (2) `## GitHub Adapter — 3 instance 묶음 vs 분리 결정` 본문 ↔ 코드 대조 (`§ 12.48` FU4 미소진) / (3) **`## Contracts` 표 ↔ 실 계약 표면 대조** (본 절 (vii) 이 `LLM Gateway` row 좌표를 보태 `§ 12.55` **5** · `§ 12.56` **4** · `§ 12.57` **2** 와 합쳐 누적 좌표 확보) / (4) row pointer 셀 보강 2 건 (`Scheduler` = `ADR-0042` 미등재 `§ 12.50` FU2 · `Confluence Adapter` `§ 12.49` FU2) / (5) LLM · GitHub adapter ADR pointer 미등재 (`§ 12.47` FU5 · `§ 12.48` FU3) / (6) `@nestjs/config` 미도입 전수 sweep (`§ 12.39` FU3, ADR 게이트) / (7) reviewer 규약 미이행 (`§ 12.41` FU2) / (8) `deploy/README.md` ↔ deployment.md ↔ runbook 3 자 정합 (`§ 12.41` FU3) / (9) README 행 번호 pointer drift 전수 sweep / (10) REQ 번호 체계 잔재 sweep (`§ 12.38` FU3) / (11) `CLAUDE.md` §1 pointer 부정확 (T-1442 FU3) / (12) UC-09 `§ 5` sequence participant 병기 (**47 회째 이월**) / (13) modules.md 카운트 claim 대조 (`§ 12.34` FU1, ADR 게이트) / (14) **행 번호 → anchor 좌표계 이행** (**41 회째 이월** — 본 절 AC 4 의 재-drift 8 회째 재현 여부와 (vii) 의 stale 실측을 근거로 보탠다) / (15) 각주 heading 참조 anchor 이행 축소 scope (`§ 12.51` FU19 미소진) / (16) `§ 12.44` 한계 "mutation 러너 26 개" 정의 미확정 / (17) **`Scheduler` cron → 평가 pipeline 미결선** (`§ 12.50` FU18 — **코드 소관, `pr` task 로만**) / (18) `ADR-0003` "단일 DB 인스턴스" 좌표 부재 (`§ 12.46` FU16) / (19) `Web UI` node 의 process subgraph 소속 표기 (`§ 12.53` FU19 미소진) / (20) **node 외연 정의의 문서 미박제** (`§ 12.55` FU20 · `§ 12.56` FU20) / (21) modules.md **200** 행 1:N 매핑 ↔ 디렉토리 외연 상충 해소 (`§ 12.56` FU21 미소진) / (22) **`GITHUB_INSTANCES` 가변 instance 수 ↔ 문서 전반의 "3 GitHub instance" 고정 표기 정합** (`§ 12.57` FU22 미소진 — 본 절이 **LLM 5 provider 고정 표기** 에서 같은 사고를 관측했다면 그 사실을 1 구로 보탠다) / (23) `worker --> backend_api` 미표기 결선 (`§ 12.56` FU23 미소진) / (24) **(C) 후보 split 제안** (기각이 cap 사유였을 때만).
- [ ] **AC 8 — R-110 / R-112 면제 근거 명시**: 본 task 는 `commitMode: direct` doc-only 로 production code **0 LOC** · 분기 **0** 이라 [CLAUDE.md](../../CLAUDE.md) §3.2 direct-mode 면제 조항에 따라 tester 호출 · happy / error / flow / negative 4 항목 · `pnpm test:cov` 가 **N/A** 임을 `§ 12.58` 에 1 구로 명시한다.
- [ ] **AC 9 — 언어 · 링크 규약**: 추가 문장은 모두 한국어 (§12), 문서 간 참조는 상대경로 markdown 링크, 수치는 실측 출력과 1:1 일치.

## Out of Scope

- **코드 · schema · frontend · 배포 자산 · CI · agent 정의 변경 절대 금지** — `src/` · `web/` · `test/` · `prisma/` · `scripts/` · `deploy/` · `docker-compose.yml` · `Dockerfile` · `.github/workflows/` · `package.json` · `.claude/agents/` 는 diff 에 등장하면 안 된다 (`grep` 열람은 read-only 라 허용). **label 을 참으로 만들려고 코드를 고치는 시도 금지**.
- **실 네트워크 호출 금지** — `curl` · live smoke · gated live spec 실행 어느 것도 하지 않는다. 측정은 전부 read-only `grep` · `sed` · `ls` · `wc` · `git` 이며, 실 credential · token · API key 는 문서에 옮겨 적지 않는다 (§9).
- **mermaid 블록 (30 ~ 106 행) 편집 금지** — edge 삭제 · 추가 · 병합 · label 수정 · node 이동 어느 것도 하지 않는다. 판정은 각주 병기로만 남긴다.
- **adapter 계열 egress edge 4 개 (89 ~ 92 행) 재판정 금지** — `§ 12.57` 이 이미 닫았다 (좌표 · 개수 · 정의 승계 인용까지만).
- **llm_gateway 계열 외 edge 그룹 (user-facing · orchestration · scheduler · worker pipeline · db boundary) 재판정 금지** — orchestration 5 는 `§ 12.55`, worker 4 는 `§ 12.56`, scheduler 2 는 `§ 12.54` 가 이미 닫았고 (인용만), 나머지 3 은 파생 영향 (1) 의 후속 slice 소관이다.
- **node 집합 · 이름 · 카운트 · 소속 재판정 금지** — `§ 12.53` 이 이미 닫았다. 본 slice 의 (vi) 은 **도착 node ↔ 코드 provider 식별자 대응** 축일 뿐 node 집합 재판정이 아니다.
- **`## Component table` 8 row 의 본문 (책임 · contract · REQ · pointer) 재판정 · 편집 금지** — `§ 12.44` ~ `§ 12.50` 이 이미 닫았고 `LLM Gateway` row 는 `§ 12.47` 소관이다.
- **`## Contracts` 표 (244 ~ 269 행) 판정 · 편집 금지** — 대응 row **좌표와 문구 인용** 까지만이며, 참 / 거짓 판정은 파생 영향 (3) 소관이다.
- **provider 별 API key 암호화 · 저장 방식 (`llm-apikey-cipher.service.ts` 등) 대조 금지** — 본 slice 는 **outbound 결선과 헤더 형식** 축 한정이며 secret 취급 축은 열지 않는다 (§9).
- **`## GitHub Adapter — 3 instance 묶음 vs 분리 결정` sub-section (212 행 이후) 본문 대조 금지** — 파생 영향 (2) 소관이다.
- **각주 13 블록의 판정 내용 재검토 · 재작성 · 삭제 · 이관 금지** — 좌표 확인 · 1 구 인용 · AC 4 가 허용한 stale 숫자 치환 (≤ 3 지점) 까지만.
- **audit 기존 절 (`§ 12.1` ~ `§ 12.57`) 수정 금지** — 판정은 `§ 12.58` 순수 append 로만 세운다 (`§ 12.15`).
- **`docs/decisions/ADR-0003-deployment.md` 편집 · status 변경 금지** — 문구 인용까지만.
- **[modules.md](../architecture/modules.md) · `docs/PLAN.md` · `docs/requirements.md` 편집 금지** — 좌표 확인용 grep 인용까지만.
- **components.md 전면 anchor 좌표계 이행 실행 금지** — 파생 영향 (14) · (15) 소관이다.
- **다른 문서로의 cascade 금지** — [use-cases/INDEX.md](../use-cases/INDEX.md) · `UC-01` ~ `UC-09` · [INDEX.md](../architecture/INDEX.md) · [deployment.md](../architecture/deployment.md) · [directory.md](../architecture/directory.md) · [api.md](../architecture/api.md) · [README.md](../../README.md) 는 무편집.
- **빌드 · 테스트 · 설치 실행 금지** — `pnpm install` · `pnpm build` · `pnpm test` 어느 것도 실행하지 않는다.
- **CI drift-guard spec 작성 금지** — `pr` mode 소관이라 본 direct task 에서 진행하면 §3.1 위반.

## Suggested Sub-agents

`implementer` 단독 (doc-only, 코드 0 LOC — architect · tester 불요. §3.2 direct-mode 면제).

## 결과 (2026-08-05 완료)

- **AC 2 판정** — `%% External egress` 의 `llm_gateway` 계열 edge **5** 개 (93 ~ 97 행) 가 **전수 부분참**. 실 outbound 는 `src/llm/providers` 의 provider adapter **4** 종이고, mermaid 가 그리는 `llm_gateway` 는 그 앞단 seam **1** 지점으로 수렴한다 (edge **5** : adapter **4** : seam **1** 불일치). API key 헤더는 provider 별 **4 종** 이 label 에 은닉돼 있다.
- **AC 3 채택 = (B)** (각주군 말미 append + stale 좌표 숫자 치환). 나머지 3 안은 기각.
- **AC 4 반영** — components.md **280 → 287** (각주 blockquote 6 행 신설 + 빈 줄 1 행), in-place 정정 **4 지점**. task 파일 예상치 `≤ 3 지점` 을 1 초과했고 (T-1459 각주가 자기참조 좌표 1 개를 새로 보탬) 그 편차 사유를 `§ 12.58` AC 4 반영 결과 · 한계 6 에 박제했다.
- **AC 5 ~ 9** — audit `§ 12.58` 순수 append (**5574 → 5652**, 본문 77 행), 불변 검산 통과, 파생 영향 **24** 항목 박제. mermaid 본체 · 표 본체 · Contracts 표는 무편집. 변경 파일 **2** · **+89/-4** · direct push `15ea89cf` · main CI **success**.
- **그룹 마감** — 본 slice 로 `%% External egress` **9/9** 판정 완료 (edge 축 6 그룹 중 **5 번째 그룹 마감**). 잔여는 `%% User-facing flow` **2** (65 ~ 66 행) · `%% DB persistence boundary` **1** (86 행) 뿐.

## Follow-ups

- `§ 12.58` 파생 영향 (1) ~ (24) 목록 참조 — 다음 대조 1 순위는 `%% User-facing flow` **2** 개 (65 ~ 66 행) 로 [T-1461](T-1461-components-md-user-facing-flow-edges-vs-web-frontend-audit.md) 이 승계한다.
