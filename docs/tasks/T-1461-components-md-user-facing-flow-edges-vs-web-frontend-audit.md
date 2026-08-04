---
id: T-1461
title: components.md `## Component diagram` mermaid **`%% User-facing flow` edge 2 개** (65 ~ 66 행) ↔ 실 `web/src` 브라우저 outbound seam · SPA 서빙 경계 대조 — `§ 12.58` 파생 영향 (1) 집행 + audit §12.59
phase: P5
status: PENDING
commitMode: direct
coversReq: [REQ-057]
estimatedDiff: 220
estimatedFiles: 3
created: 2026-08-05
independentStream: uc-doc-audit-resync
dependsOn: [T-1460]
touchesFiles:
  - docs/architecture/components.md
  - docs/use-cases/REQ-COVERAGE-AUDIT.md
  - docs/tasks/T-1461-components-md-user-facing-flow-edges-vs-web-frontend-audit.md
plannerNote: "uc-doc-audit-resync 73 번째 slice — §12.58 이 지목한 1 순위 user-facing 2 집행. web/ 대조 축 신설. doc-only 1.6x"
---

# T-1461 — components.md mermaid `%% User-facing flow` edge 2 개 ↔ 실 `web/src` outbound seam · SPA 서빙 경계 대조

## Why

[T-1460](T-1460-components-md-external-egress-llm-edges-vs-provider-adapter-audit.md) 가 `%% External egress` **9** edge 를 9/9 마감하면서 ([REQ-COVERAGE-AUDIT.md](../use-cases/REQ-COVERAGE-AUDIT.md) `§ 12.58`) 파생 영향 **(1)** 에서 **다음 대조 1 순위를 `%% User-facing flow` 2 개 (65 ~ 66 행) 로 명시 지목** 했다. 본 slice 는 그 지목을 그대로 승계한다 — 닫으면 edge 축 **23 중 22 판정 완료** 가 되어 잔여는 `%% DB persistence boundary` **1** (86 행) 하나뿐이 되고, 6 edge 그룹 중 **6 번째이자 마지막 그룹만** 남는다.

본 slice 는 앞선 5 그룹과 **측정 축이 근본적으로 다르다**. `§ 12.54` ~ `§ 12.58` 은 전부 `src/` NestJS in-process 호출 또는 server-side outbound 였으나, 본 그룹은 출발 node 가 `user_browser` · `web_ui` 로 **frontend 경계** 라 대조 대상이 `web/src/**` 브라우저 코드로 새로 열린다. 따라서 앞 절들이 승계해 온 **주입 `fetchFn` 단일 지점** 정의는 **그대로 쓸 수 없고**, 본 slice 는 AC 1 (iv) 에서 **브라우저 outbound seam** 정의를 1 구로 새로 세운 뒤 그 위에서만 판정한다 (정의를 세우는 것과 판정을 창작하는 것은 다르다 — 정의는 실측 hit 위치로 뒷받침한다).

planner 사전 확인 — **아래는 전부 가설이며 전제가 아니다** (T-1440 AC 1 이후 planner 기대가 실측에 반증·정정된 선례가 22 회 있고, 직전 T-1460 에서도 `adapter 는 class` 라는 기대가 **hit 0** 으로 뒤집혀 순수 함수 모듈로 정정됐다). executor 는 AC 1 에서 전부 재측정하고 **기대와 다르면 그 축의 판정을 실측대로 뒤집는다**. ① **65** 행 `user_browser -- "HTTPS REST JSON" --> web_ui` — 브라우저가 SPA 와 처음 접촉하는 것은 REST JSON 이 아니라 **정적 asset (HTML / JS / CSS) 전달** 이라 label 이 어긋날 가능성이 크다 (`## Contracts` **257** 행이 이미 `(또는 SPA hydration)` 을 병기한 것 자체가 반증 단서다). ② **66** 행 `web_ui -- "HTTPS REST JSON" --> backend_api` — planner 예비 grep 에서 `web/src/api/apiClient.ts` **61** 행 `fetch(path, { credentials: 'same-origin' })` 가 관측돼 결선 자체는 유력하나, 같은 파일이 **응답을 Content-Type 분기로 JSON / text 2 종** 파싱한다고 자기선언해 `JSON` 단일 표기가 **부분참** 일 가능성이 있다. ③ label 의 **`HTTPS`** scheme — apiClient 가 **상대 path + same-origin** 만 쓰면 코드에 scheme 리터럴이 **0** 이라 HTTPS 는 코드 사실이 아니라 배포 층 (TLS termination) 사실이 된다. ④ `web_ui` node 의 실 외연이 **2 층** (브라우저에서 실행되는 `web/src/**` 자산 + 그것을 서빙하는 `src/web/web.module.ts` ServeStatic) 이라 edge 65 의 **도착 층** 과 edge 66 의 **출발 층** 이 서로 다른 층을 가리킬 수 있다. ⑤ ④ 가 참이면 **edge 2 개가 실 network hop 1 개 (브라우저 ↔ 단일 NestJS process) 의 2 중 표기** 가 되어 `§ 12.57` 의 `1 : 2 : 3` · `§ 12.58` 의 `5 : 1 : 4` 와 **동형 사고** 다. ⑥ label 이 **인증 토큰 동반 · 401 refresh 재시도** 를 은닉한다 (`## Contracts` **258** 행은 이미 병기 — 다이어그램만 누락). ⑦ **dev (vite proxy) 대 prod (동일 origin ServeStatic) 2 모드** 가 단일 edge 로 뭉뚱그려질 가능성. ⑧ `## Contracts` 표의 대응 row **2** 개 (**257 · 258** 행) 에 같은 claim 이 중복 박제돼 있으나 그 판정은 **파생 영향 (3) 소관** 이라 본 slice 는 **좌표와 문구 인용까지만** 한다.

**행 좌표 주의** — components.md 는 T-1460 각주 +7 행으로 **287** 행이고, heading 은 `## 개요` **5** · `## Deployment 컨텍스트` **22** · `## Component diagram` **28** · `## Component table` **115** · `## GitHub Adapter …` **219** · `## Contracts` **251** · `## References` **277** 다. mermaid 블록 **30 ~ 106** (edge 그룹 주석 **64 · 68 · 75 · 79 · 85 · 88**), 표 본체 **117 ~ 126**, 각주 **14 블록** (말미 블록 **212 ~ 217**), `## Contracts` 표 data row **257 ~ 273** 이다. AC 1 (i) 에서 재실측한다.

[PLAN.md](../PLAN.md) 의 미완 bullet (106 · 108 · 109 · 140 · 151) 은 owner 게이트 · 외부 credential · 새 dependency 게이트라 planner 단독 진행 불가이므로, 본 doc stream 이 현 시점 우선순위 최상위다.

## Required Reading

- `docs/architecture/components.md` — **287 행**. 다음 구간만 읽는다.
  - **64 ~ 66 행** (`%% User-facing flow` 그룹 전 구간) — **본 slice 의 판정 대상**.
  - **46 행** (`user_browser` node) · **51 ~ 52 행** (`web_ui` · `backend_api` node) — **무편집, 대조용**. 출발 / 도착 node id 확인까지만 (`§ 12.53` 이 node 축을 닫았다).
  - **108 ~ 113 행** (`다이어그램 표기` bullet) — 인용만. 재판정 금지.
  - **119 ~ 120 행** (표 `Web UI` · `Backend API` row) — **무편집**, 이름 · contract 문구 인용까지만 (특히 `별도 web/ 패키지` 어구). **row 본문 재판정 금지** (`§ 12.44` · `§ 12.45` 가 닫았다).
  - **184 ~ 188 행** (`§ 12.53` node 각주 블록, 특히 **185** 행 `Web UI node 의 process 소속 표기는 부분참` 1 구 · **186** 행 `web_ui = web/src/ (+ src/web/)` 1 구) — **무편집**, 본 slice 의 **층 문제 (④)** 근거 인용용.
  - **212 ~ 217 행** (T-1460 각주 블록) — **무편집**. 각주군 말미 좌표 확인 + **outbound 지점 정의를 승계하지 않는 이유** (server-side seam 정의라 브라우저 축에 그대로 적용 불가) 1 구 대비용.
  - **251 ~ 273 행 중 `사용자 브라우저` · `Web UI` 를 from 으로 갖는 row 2 개 (257 · 258 행)** — **무편집**, 문구 인용까지만 (특히 `또는 SPA hydration` · `인증 토큰 (JWT 또는 session cookie) 동반` 어구). **`## Contracts` 표 재판정 금지** (파생 영향 (3)).
  - **그 밖 전 구간** — **무편집, heading 좌표 확인만**.
- `docs/use-cases/REQ-COVERAGE-AUDIT.md` — **5652 행**. **`### 12.15`** (append-only 처리 방침 정본) · **`### 12.58`** (**5561** 행 — 파생 영향 **(1)** 원문 + AC 1 (iv) outbound 정의 1 구 + (viii) 계수 규칙 + 한계 2) · **`## 11. References` (5639 행)** — `§ 12.59` 삽입 위치 경계. **`§ 12.44` · `§ 12.53` · `§ 12.55` 본문은 열지 않는다** — 필요한 판정은 components.md **184 ~ 188 · 212 ~ 217** 행 각주 1 구 인용으로 갈음한다 (§7 context 절약).
- `web/src/api/apiClient.ts` — **무편집, read-only**. AC 1 (iv) · (v) 의 grep 결과가 가리키는 **1 ~ 2 행 인용까지만**. **파일 통독 금지**.
- `src/web/web.module.ts` — **무편집, read-only**. ServeStatic 등록 분기 **1 구 인용까지만**.
- `docs/PLAN.md` — **175 행. 무편집, 읽기만**. 미완 bullet 좌표 확인용 `grep` 만.
- `CLAUDE.md` §3 (task 크기 상한) · §3.2 (direct doc-only 면제) · §7 (context 절약) · §9 (secret 금지) · §12 (언어 정책)

## Acceptance Criteria

- [ ] **AC 1 — 실측 선행 (날조 금지)**: 편집 전에 다음을 직접 측정해 `§ 12.59` 에 **명령과 출력을 함께** 인용한다. 기대값과 **다르면 그 축의 판정을 실측대로 뒤집는다** (Why 의 ① ~ ⑧ 은 가설일 뿐이다).
  - (i) **좌표 재확인**: `grep -n '^#\{1,3\} ' docs/architecture/components.md` 로 heading 좌표를 **먼저 실측** 한다 (본 AC 의 `28` · `115` · `219` · `251` · `277` 도 stale 일 수 있다 — T-1436 ~ T-1460 선례). 이어 `grep -n '^\s*%%\|^```' docs/architecture/components.md` 로 mermaid 블록 경계와 edge 그룹 주석 좌표를 확정한다.
  - (ii) **edge 그룹 재확인 (그룹 진척 수치)**: `grep -nE '^\s+[a-z_]+ -- ' docs/architecture/components.md | wc -l` 로 전체 edge 수를 세고 `§ 12.54` 의 산출식 (**23** = 2 + 5 + 2 + 4 + 1 + 9) 이 **여전히 성립하는지** 1 구로 확인한다. 이어 본 slice 대상이 **앞 2 개 (65 ~ 66 행) 뿐** 이며 본 slice 종료 시 user-facing 그룹 **2/2 마감** · 전체 edge **23 중 22 판정 완료 · 잔여 1 (db boundary, 86 행)** 임을 수치로 명시한다.
  - (iii) **대상 edge 원문 인용**: `sed -n '64,66p' docs/architecture/components.md` (좌표는 (i) 실측값으로 교체) 로 그룹 주석 + edge 2 행을 그대로 인용하고, 각 edge 의 **출발 node · 도착 node · label 문자열** 을 3 컬럼으로 분해한다. node 정의는 `sed -n '46p;51,52p'` 로 병기한다.
  - (iv) **브라우저 outbound seam 정의 (본 slice 의 선결 측정 — 승계 불가, 신설)**: `§ 12.57` · `§ 12.58` 이 승계해 온 **주입 `fetchFn` 단일 지점** 정의는 **server-side seam 정의라 브라우저 축에 그대로 적용할 수 없음** 을 components.md **212** 행 각주 1 구 인용과 함께 1 구로 밝히고, 본 절이 쓸 정의를 **실측 hit 위치로** 세운다 — 근거 명령 `grep -rn 'fetch(' web/src --include=*.ts --include=*.tsx | grep -v '\.test\.'` 로 브라우저에서 나가는 HTTP 호출 지점이 **몇 개 파일 · 몇 행** 인지 세고, 단일 래퍼로 수렴하는지 (수렴하면 그 지점을 seam 으로) 아니면 분산인지 (분산이면 그 사실을 정의에 명시) 를 수치로 가른다. **정의를 창작하지 않는다 — hit 분포가 정의를 결정한다.**
  - (v) **결선 실측 (본 slice 의 축)**: 다음을 각각 1 명령으로 실행해 hit 수와 대표 행을 인용한다 — ⓐ `grep -n 'fetch(\|credentials\|REFRESH_PATH' web/src/api/apiClient.ts | head -15` (edge 66 의 실 seam · 인증 동반 축), ⓑ `grep -n 'Content-Type\|application/json\|\.json()\|\.text()' web/src/api/apiClient.ts | head -15` (label `JSON` 이 **응답 format 몇 종** 을 덮는지), ⓒ `grep -rn 'ServeStatic\|WEB_DIST_PATH\|resolveServeStaticOptions' src/web/web.module.ts src/app.module.ts | grep -v spec` (edge 65 의 실체 = SPA 자산을 **어느 process 가** 서빙하는지), ⓓ `grep -n 'proxy\|/api\|target' web/vite.config.mts` (dev proxy 대 prod 동일 origin **2 모드** 유무), ⓔ `grep -rn 'setGlobalPrefix\|enableCors' src --include=*.ts | grep -v spec` (브라우저 ↔ backend 의 path · origin 경계). **파일 통독 금지** — 위 5 명령의 출력과 필요한 1 ~ 2 행 인용까지만 쓴다. **실 token · cookie 값 · credential 은 옮겨 적지 않는다** (§9 — 변수명 · 옵션명 · path 문자열까지만).
  - (vi) **응답 format 종수 대조**: `grep -rn 'text/csv\|application/octet-stream\|attachment\|Content-Disposition' src --include=*.controller.ts | grep -v spec | head -10` 으로 backend 가 **JSON 아닌 응답을 내는 endpoint** 가 있는지 세어, label 의 `JSON` 단일 표기가 실 message format **몇 종** 을 뭉뚱그리는지 수치로 가른다 (hit 0 이면 그 축은 **참** 으로 뒤집는다).
  - (vii) **중복 claim · 좌표 stale 확인 (판정은 이월)**: `grep -n '^| 사용자 브라우저 \|^| Web UI ' docs/architecture/components.md` 로 `## Contracts` 표의 대응 row 좌표를 실측해 본 slice 의 2 edge 와 **어떻게 대응하는지** (1:1 인지) 를 수치로 보이고, 그 row 의 `또는 SPA hydration` · `인증 토큰 (JWT 또는 session cookie) 동반` 어구를 **인용만** 한다. 이어 `grep -n '\*\*[0-9]\{3\}\*\* 행' docs/architecture/components.md | head -20` + (i) 실측으로 **자기 좌표 stale 이 남아 있는지** 를 가른다 (T-1460 이 4 지점 정정했다). **`## Contracts` 표의 참 / 거짓 판정은 하지 않는다** — 파생 영향 (3) 소관임을 1 구로 명시한다.
  - (viii) **삽입 파급 실측 (AC 3 입력)**: 신규 각주를 ⓐ `## Component diagram` 절 안 (mermaid 블록 직후) 에 넣을 때 / ⓑ 각주군 말미 (**217** 행 뒤) 에 넣을 때 **각각 밀리는 자기 참조 좌표가 몇 지점인지** 를 **수치 2 개** 로 제시한다 (`§ 12.55` (viii) → `§ 12.58` (viii) 로 이어진 계수 규칙 = components.md 자기 좌표 토큰만 세고 외부 파일 좌표는 제외, 범위 토큰 `A ~ B` 는 1 지점 — 그 규칙을 그대로 승계하고 승계 사실을 1 구로 명시).
  - (ix) **baseline** — `wc -l` components.md **287** · audit **5652** · ADR-0003 **173** · requirements.md **97** · deployment.md **232** · directory.md **203** · modules.md **259** · PLAN.md **175**, `grep -c '^## '` components.md **7** · audit **12**, audit `grep -c '^| REQ-'` **66** · `grep -c '^### 12\.'` **58**, components.md `grep -c '^> '` **82**.
- [ ] **AC 2 — 판정표**: AC 1 이 실측한 **축** 마다 `참 / 부분참 / 거짓` 을 판정한 표를 만든다. 각 row 는 **축 1 구 · 실측 근거 (행 번호 포함) · 판정 · 근거 1 구** 4 컬럼이다. 최소 축 7 개 — ① `user_browser --> web_ui` 결선 (**65** 행, AC 1 (v) ⓒ), ② `web_ui --> backend_api` 결선 (**66** 행, (iv) · (v) ⓐ), ③ label 의 **`REST JSON`** 어구 ((v) ⓑ + (vi) — 응답 format 종수), ④ label 의 **`HTTPS`** scheme 어구 ((v) ⓐⓓⓔ — 코드에 scheme 리터럴이 있는지, 없으면 어느 층의 사실인지), ⑤ **`web_ui` node 의 층 외연** (브라우저 실행 자산 ↔ ServeStatic 서빙) ↔ edge 2 개가 가리키는 층의 정합 ((v) ⓒ + components.md **185 ~ 186** 행 각주 인용), ⑥ label 이 **인증 동반 · 401 refresh 재시도** 를 은닉하는지 ((v) ⓐ), ⑦ **dev (vite proxy) 대 prod (동일 origin) 2 모드** 가 단일 edge 로 뭉뚱그려지는지 ((v) ⓓ).
  - ① · ② 가 **같은 network hop 의 2 중 표기** 로 드러나면 그 사실을 판정 근거에 수치로 명시한다 (edge N ↔ 실 network hop M ↔ seam K 의 **N : M : K** 로 `§ 12.57` 의 `1 : 2 : 3` · `§ 12.58` 의 `5 : 1 : 4` 와 같은 형식으로 적는다).
  - **판정은 (iv) 의 브라우저 outbound seam 정의 위에서만 유효** 함을 표 아래 1 구로 명시하고, **그 정의가 앞 절들의 승계가 아니라 본 절 신설** 임을 함께 밝힌다.
  - **egress edge 9 개 (89 ~ 97 행) 재판정 금지** (`§ 12.57` · `§ 12.58` 소관) · **orchestration 5 · scheduler 2 · worker 4 재판정 금지** (`§ 12.54` ~ `§ 12.56`) · **db boundary 1 (86 행) 재판정 금지** (파생 영향 (1) 후속 slice 소관) · **node 축 재판정 금지** (`§ 12.53`) · **표 row 본문 재판정 금지** (`§ 12.44` ~ `§ 12.50`).
- [ ] **AC 3 — 처리 방식 판정**: 후보 4 개 중 **채택 1 · 기각 3** 인 판정표를 만든다. 기각마다 근거 1 구.
  - 후보 — (A) **현행 유지 + 무편집** (audit `§ 12.59` 기록만), (B) **각주군 말미 append** — 각주 구간 **끝 (현 217 행 뒤)** 에 blockquote **1 블록 (≤ 6 행)** 을 신설해 edge 판정을 병기하고, AC 1 (vii) · (viii) 이 stale 로 확정한 좌표만 in-place 정정 (**≤ 5 지점**), (C) **`## Component diagram` 절 안 각주 삽입** (mermaid 블록 직후) + 밀린 좌표 전수 정정, (D) **mermaid edge · label in-place 수정** (edge 삭제 · 병합 · label 문구 고쳐 쓰기).
  - 판정 기준 **4 축** 명시 — ① `§ 12.15` **append-only 정합** (**(D) 는 이 축에서 먼저 판정**), ② **좌표 drift 파급** (AC 1 (viii) 의 수치 2 개를 그대로 근거로), ③ **cap** — 예상 diff ≤ 300 LOC · 변경 파일 **3 고정** (초과 후보는 **자동 기각 + split 제안을 파생 영향에 기록**), ④ **탐색성** (다이어그램 독자가 판정 근거에 닿는 경로 길이).
  - **AC 2 축 ① ~ ⑦ 중 하나라도 `거짓` 이면 (A) 는 자동 기각** (오도가 문서에 남는다). **전 축이 `참` 이어도 (A) 를 자동 채택하지 않는다** — 판정 근거의 탐색성 (축 ④) 을 함께 재고 결론을 1 구로 남긴다.
  - **mermaid edge 를 지우거나 병합하거나 label 을 고쳐 쓰는 선택지는 채택하지 않는다** — 다이어그램 구조 변경은 본 doc-audit stream 의 scope 밖이며 처리는 **각주 병기** 로 한다. 이 사실을 판정표 아래 1 구로 명시한다. **코드 (`web/` · `src/`) 를 고쳐 label 을 참으로 만드는 처리도 금지** — `pr` task 소관이다.
- [ ] **AC 4 — 채택안 반영**: AC 3 채택안대로만 편집한다.
  - **(A) 채택 시** — components.md **무편집** (`git status --porcelain docs/architecture/components.md` **빈 출력**) 이며, 유지 근거를 `§ 12.59` 에 남긴다.
  - **(B) 채택 시** — 신규 blockquote 는 **마지막 각주 블록 뒤 · `## GitHub Adapter …` heading 직전** 에 삽입하고 **≤ 6 행 + 앞 빈 줄 1 행**, in-place 정정은 **AC 1 (vii) · (viii) 이 stale 로 확정한 지점만 ≤ 5 지점** (숫자 1 개씩 치환, **문장 재작성 금지**). `wc -l` 증가 **+7 이내** (287 → ≤ 294).
  - **(C) · (D) 채택 시** — 변경 파일 3 · diff ≤ 300 LOC 를 **먼저 검산** 하고, 초과하거나 정정 지점이 **6 지점 이상** 이면 채택을 철회해 (B) 로 내린 뒤 그 사실을 `§ 12.59` 에 1 구로 남긴다.
  - **삽입으로 heading 좌표가 다시 밀리면 편집 후 `grep -n '^## ' docs/architecture/components.md` 로 재측정해 반영** 한다 (`§ 12.51` `175` → `§ 12.58` `212` → `219` 로 이어진 재-drift 의 **9 회째** 재현 여부를 1 구로 기록).
  - **문구 · 행 번호 · 절 번호 · task ID 는 AC 1 실측 출력과 1:1 일치** 해야 하며, 실측되지 않은 값을 **새로 창작하지 않는다**.
  - **mermaid 블록 (30 ~ 106 행) · `다이어그램 표기` bullet (108 ~ 113 행) · 표 본체 (117 ~ 126 행) · 1 ~ 4 행 blockquote · `## 개요` 각주 (16 ~ 20 행) · 안내 blockquote (128 ~ 131 행) · 각주 14 블록의 판정 문장 · 219 행 이후 전 구간 무편집**. 허용되는 in-place 는 **stale 숫자 치환뿐** 이다.
  - **secret · token · cookie 값 · 실 credential 을 문서에 옮겨 적지 않는다** (CLAUDE.md §9 — 옵션명 (`credentials: 'same-origin'`) · path 문자열 · 변수 **이름** 까지만 허용).
- [ ] **AC 5 — audit `§ 12.59` 신설**: [REQ-COVERAGE-AUDIT.md](../use-cases/REQ-COVERAGE-AUDIT.md) 의 `## 11. References` (5639 행) **직전** 에 `### 12.59 …` 절을 **순수 append** 한다 (기존 절 수정 0). 구성 — 본 절의 위치 · 계보 1 문단 (**`§ 12.58` 파생 영향 (1) 이 지목한 1 순위 = user-facing 2, 본 절로 6 그룹 중 5.5 → 잔여 db boundary 1** 명시 + **seam 정의가 승계가 아니라 신설** 임을 명시) / AC 1 실측 (명령 + 출력) / AC 2 판정표 / AC 3 처리 판정표 / AC 4 반영 결과 + 무편집 경계 / 파생 영향 (목록만) / 불변 검산 / 한계. **절 전체 ≤ 100 행** (초과 시 실측 인용을 요약형으로 압축하고 압축 사실을 한계에 명시).
  - `###` 레벨이라 `grep -c '^## '` **12 불변** · `grep -c '^| REQ-'` **66 불변** · `grep -c '^### 12\.'` **58 → 59**.
- [ ] **AC 6 — 불변 검산**: 다음을 실행해 출력을 `§ 12.59` 에 인용한다. `wc -l` components.md (287 → ≤ 294) · audit (5652 → +100 이내) · **ADR-0003 173 불변** · requirements.md (**97 불변**) · deployment.md (**232 불변**) · directory.md (**203 불변**) · modules.md (**259 불변**) · PLAN.md (**175 불변**), `git diff -U0 -- docs/architecture/components.md | grep '^@@'` 로 **hunk 개수 · 위치** 를 보이고 AC 4 허용 구간 밖 hunk **0** 을 실증 (무편집 채택 시 **hunk 0**), `git diff --numstat` 으로 **순수 삭제 0** (삭제 행이 있으면 stale 숫자 치환의 짝임을 1 구로 설명), `git status --porcelain src/ test/ web/ prisma/ deploy/ docker-compose.yml Dockerfile .github/ package.json README.md .claude/ docs/decisions/ docs/ops/ docs/PLAN.md docs/requirements.md docs/architecture/modules.md` **빈 출력** (특히 **`web/` 무편집** 을 1 구로 명시), `git status --porcelain` 전체가 **3 파일 이내**.
- [ ] **AC 7 — 파생 영향 기록 (목록만, 본 slice 편집 금지)**: `§ 12.59` 말미에 후속 slice 대상을 목록으로 남긴다. 최소 포함 — (1) **잔여 edge 대조 1 건** (`%% DB persistence boundary` **1** (86 행) — AC 1 (ii) 가 재확인한 개수를 병기하고 **user-facing 그룹 2/2 마감 사실** · **전체 23 중 22 판정 완료** · **다음 대조가 edge 축의 마지막 그룹** 임을 1 구로 지목) / (2) `## GitHub Adapter — 3 instance 묶음 vs 분리 결정` 본문 ↔ 코드 대조 (`§ 12.48` FU4 미소진) / (3) **`## Contracts` 표 ↔ 실 계약 표면 대조** (본 절 (vii) 이 `사용자 브라우저` · `Web UI` row **2** 개 좌표를 보태 `§ 12.55` **5** · `§ 12.56` **4** · `§ 12.57` **2** · `§ 12.58` **1** 과 합쳐 누적 좌표 확보) / (4) row pointer 셀 보강 2 건 (`Scheduler` = `ADR-0042` 미등재 `§ 12.50` FU2 · `Confluence Adapter` `§ 12.49` FU2) / (5) LLM · GitHub adapter ADR pointer 미등재 (`§ 12.47` FU5 · `§ 12.48` FU3) / (6) `@nestjs/config` 미도입 전수 sweep (`§ 12.39` FU3, ADR 게이트) / (7) reviewer 규약 미이행 (`§ 12.41` FU2) / (8) `deploy/README.md` ↔ deployment.md ↔ runbook 3 자 정합 (`§ 12.41` FU3) / (9) README 행 번호 pointer drift 전수 sweep / (10) REQ 번호 체계 잔재 sweep (`§ 12.38` FU3) / (11) `CLAUDE.md` §1 pointer 부정확 (T-1442 FU3) / (12) UC-09 `§ 5` sequence participant 병기 (**49 회째 이월**) / (13) modules.md 카운트 claim 대조 (`§ 12.34` FU1, ADR 게이트) / (14) **행 번호 → anchor 좌표계 이행** (**43 회째 이월** — 본 절 AC 4 의 재-drift 9 회째 재현 여부와 (viii) 의 파급 대비를 근거로 보탠다) / (15) 각주 heading 참조 anchor 이행 축소 scope (`§ 12.51` FU19 미소진) / (16) `§ 12.44` 한계 "mutation 러너 26 개" 정의 미확정 / (17) **`Scheduler` cron → 평가 pipeline 미결선** (`§ 12.50` FU18 — **코드 소관, `pr` task 로만**) / (18) `ADR-0003` "단일 DB 인스턴스" 좌표 부재 (`§ 12.46` FU16) / (19) **`Web UI` node 의 process subgraph 소속 표기** (`§ 12.53` FU19 미소진 — 본 절 AC 2 축 ⑤ 가 층 외연 실측을 보탰다면 그 사실을 1 구로 병기) / (20) **node 외연 정의의 문서 미박제** (`§ 12.55` FU20 · `§ 12.56` FU20 — 본 절이 `web_ui` 2 층 외연을 관측했다면 보탠다) / (21) modules.md **200** 행 1:N 매핑 ↔ 디렉토리 외연 상충 해소 (`§ 12.56` FU21 미소진) / (22) 가변 instance 수 ↔ 문서의 고정 표기 정합 (`§ 12.57` FU22 · `§ 12.58` FU22 미소진) / (23) `worker --> backend_api` 미표기 결선 (`§ 12.56` FU23 미소진) / (24) **dev / prod 2 모드의 다이어그램 미분리** (본 절 AC 2 축 ⑦ 이 참으로 나온 경우에만 — vite proxy 경로가 prod 결선과 다르다는 사실의 문서 박제) / (25) **(C) 후보 split 제안** (기각이 cap 사유였을 때만).
- [ ] **AC 8 — R-110 / R-112 면제 근거 명시**: 본 task 는 `commitMode: direct` doc-only 로 production code **0 LOC** · 분기 **0** 이라 [CLAUDE.md](../../CLAUDE.md) §3.2 direct-mode 면제 조항에 따라 tester 호출 · happy / error / flow / negative 4 항목 · `pnpm test:cov` 가 **N/A** 임을 `§ 12.59` 에 1 구로 명시한다.
- [ ] **AC 9 — 언어 · 링크 규약**: 추가 문장은 모두 한국어 (§12), 문서 간 참조는 상대경로 markdown 링크, 수치는 실측 출력과 1:1 일치.

## Out of Scope

- **코드 · schema · frontend · 배포 자산 · CI · agent 정의 변경 절대 금지** — `src/` · `web/` · `test/` · `prisma/` · `scripts/` · `deploy/` · `docker-compose.yml` · `Dockerfile` · `.github/workflows/` · `package.json` · `.claude/agents/` 는 diff 에 등장하면 안 된다 (`grep` 열람은 read-only 라 허용). **label 을 참으로 만들려고 `web/` 또는 `src/web/` 을 고치는 시도 금지**.
- **실 네트워크 호출 · 브라우저 실행 금지** — `curl` · `pnpm dev` · vite dev server 기동 · live smoke 어느 것도 하지 않는다. 측정은 전부 read-only `grep` · `sed` · `ls` · `wc` · `git` 이며, 실 credential · token · cookie 값은 문서에 옮겨 적지 않는다 (§9).
- **mermaid 블록 (30 ~ 106 행) 편집 금지** — edge 삭제 · 추가 · 병합 · label 수정 · node 이동 어느 것도 하지 않는다. 판정은 각주 병기로만 남긴다.
- **egress edge 9 개 (89 ~ 97 행) 재판정 금지** — `§ 12.57` · `§ 12.58` 이 이미 닫았다 (좌표 · 정의 · 다중 표기 형식 인용까지만).
- **user-facing 외 edge 그룹 (orchestration · scheduler · worker pipeline · db boundary) 재판정 금지** — orchestration 5 는 `§ 12.55`, worker 4 는 `§ 12.56`, scheduler 2 는 `§ 12.54` 가 이미 닫았고 (인용만), db boundary 1 은 파생 영향 (1) 의 후속 slice 소관이다.
- **node 집합 · 이름 · 카운트 · 소속 재판정 금지** — `§ 12.53` 이 이미 닫았다. 본 slice 의 축 ⑤ 는 **`web_ui` node 의 층 외연 ↔ edge 2 개가 가리키는 층** 의 정합 축일 뿐 node 집합 재판정이 아니다.
- **`## Component table` 8 row 의 본문 (책임 · contract · REQ · pointer) 재판정 · 편집 금지** — `§ 12.44` ~ `§ 12.50` 이 이미 닫았고 `Web UI` row 는 `§ 12.44`, `Backend API` row 는 `§ 12.45` 소관이다.
- **`## Contracts` 표 (251 ~ 276 행) 판정 · 편집 금지** — 대응 row **좌표와 문구 인용** 까지만이며, 참 / 거짓 판정은 파생 영향 (3) 소관이다.
- **frontend 컴포넌트 인벤토리 · view 구조 · 라우팅 대조 금지** — 본 slice 는 **브라우저 ↔ server 결선과 message format** 축 한정이며, `web/src/**` 컴포넌트 축은 `§ 12.44` 소관이다.
- **인증 / 세션 / 쿠키 정책 자체 판정 금지** — label 이 인증 동반을 **은닉하는지** 만 보고 (축 ⑥), JWT 수명 · refresh 정책 · RBAC 은 열지 않는다 (§9 및 별도 auth 문서 소관).
- **`## GitHub Adapter — 3 instance 묶음 vs 분리 결정` sub-section (219 행 이후) 본문 대조 금지** — 파생 영향 (2) 소관이다.
- **각주 14 블록의 판정 내용 재검토 · 재작성 · 삭제 · 이관 금지** — 좌표 확인 · 1 구 인용 · AC 4 가 허용한 stale 숫자 치환 (≤ 5 지점) 까지만.
- **audit 기존 절 (`§ 12.1` ~ `§ 12.58`) 수정 금지** — 판정은 `§ 12.59` 순수 append 로만 세운다 (`§ 12.15`).
- **[modules.md](../architecture/modules.md) · `docs/PLAN.md` · `docs/requirements.md` · `docs/decisions/**` 편집 금지** — 좌표 확인용 grep 인용까지만.
- **components.md 전면 anchor 좌표계 이행 실행 금지** — 파생 영향 (14) · (15) 소관이다.
- **다른 문서로의 cascade 금지** — [use-cases/INDEX.md](../use-cases/INDEX.md) · `UC-01` ~ `UC-09` · [INDEX.md](../architecture/INDEX.md) · [deployment.md](../architecture/deployment.md) · [directory.md](../architecture/directory.md) · [api.md](../architecture/api.md) · [README.md](../../README.md) 는 무편집.
- **빌드 · 테스트 · 설치 실행 금지** — `pnpm install` · `pnpm build` · `pnpm test` 어느 것도 실행하지 않는다.
- **CI drift-guard spec 작성 금지** — `pr` mode 소관이라 본 direct task 에서 진행하면 §3.1 위반.

## Suggested Sub-agents

`implementer` 단독 (doc-only, 코드 0 LOC — architect · tester 불요. §3.2 direct-mode 면제).

## Follow-ups

(생성 시점 비어 있음 — sub-agent 가 관련 작업을 발견하면 여기에 append 한다.)
