---
id: T-1463
title: components.md `## Contracts` 표 축 개시 — 표 census (data row 17 ↔ edge 23 대응) + **user-facing 2 row** (271 · 272 행) ↔ 실 `web/src` 브라우저 outbound seam 대조 — `§ 12.60` 파생 영향 (1) 집행 + audit §12.61
phase: P5
status: PENDING
commitMode: direct
coversReq: [REQ-057]
estimatedDiff: 220
estimatedFiles: 3
created: 2026-08-05
independentStream: uc-doc-audit-resync
dependsOn: [T-1462]
touchesFiles:
  - docs/architecture/components.md
  - docs/use-cases/REQ-COVERAGE-AUDIT.md
  - docs/tasks/T-1463-components-md-contracts-table-census-user-facing-rows-audit.md
plannerNote: "uc-doc-audit-resync 75 번째 slice — §12.60 파생 영향 (1) 집행. edge 축 종료 후 새 축 (Contracts 표) 개시 + user-facing 2 row. doc-only 1.6x"
---

# T-1463 — components.md `## Contracts` 표 축 개시 (census + user-facing 2 row 대조)

## Why

[T-1462](T-1462-components-md-db-persistence-boundary-edge-vs-prisma-seam-audit.md) 가 `%% DB persistence boundary` **1** edge 를 닫아 mermaid edge **23/23 · 6 그룹 전부 마감 = edge 축 종료** 를 선언하면서 ([REQ-COVERAGE-AUDIT.md](../use-cases/REQ-COVERAGE-AUDIT.md) `§ 12.60`) 파생 영향 **(1)** 에서 **다음 축 1 순위를 `## Contracts` 표 ↔ 실 계약 표면 대조** 로 명시 지목했다 (근거: 누적 **15/17 row 좌표** 확보 · **edge 축 23 개 판정이 그대로 입력으로 재사용되는 유일한 표** 라 한계 비용 최저). 본 slice 는 그 지목을 그대로 승계해 **새 축을 연다**.

새 축의 **첫 slice** 이므로 `§ 12.54` (edge 축 첫 slice) 가 한 것과 **같은 2 단 구성** 을 쓴다 — ① 축 전체의 **census** (data row 총계 · 컬럼 semantics · row 집합 ↔ edge 집합 대응) 를 먼저 세워 이후 slice 들이 진척을 수치로 말할 수 있게 하고, ② 그 위에서 **가장 작은 그룹 1 개만** 판정한다. 본 slice 가 판정할 그룹은 **user-facing 2 row (271 · 272 행)** 다 — 대응 edge 2 개를 `§ 12.59` 가 **직전에** 닫으면서 **브라우저 outbound seam** 정의 (`apiClient.ts` 단일 래퍼) 를 신설해 뒀으므로 본 slice 는 정의를 **승계** 만 하면 되고 (신설 불요 — `§ 12.60` 이 신설해야 했던 것과 대비), 재측정 비용이 남은 그룹 중 가장 낮다.

planner 사전 확인 — **아래는 전부 가설이며 전제가 아니다** (T-1440 AC 1 이후 planner 기대가 실측에 반증·정정된 선례가 **24** 회 있고, 직전 T-1462 에서도 `TCP 5432` 가 코드 사실일 것이라는 기대가 **`src/**` 0 hit · 배포 층 사실** 로 뒤집혔다). executor 는 AC 1 에서 전부 재측정하고 **기대와 다르면 그 축의 판정을 실측대로 뒤집는다**. ① **271** 행 `사용자 브라우저 | Web UI | sync | HTTPS REST JSON (또는 SPA hydration) | 사용자 entry point. REQ-038.` 의 **`또는 SPA hydration`** — planner 예비 grep 에서 `web/src/main.tsx` **2 · 7** 행이 `createRoot` 이고 `hydrateRoot` hit 은 **0** 이라 SSR hydration 이 실재하지 않을 가능성 (`§ 12.59` 가 edge 65 를 `web/dist` 정적 asset 서빙으로 뒤집은 것과 **동형**). ② **271 · 272** 행 공통의 **`HTTPS`** 표기 — `§ 12.59` 가 이미 "scheme 리터럴 · `setGlobalPrefix` · `enableCors` 전부 **0 hit**, dev 는 `vite.config.mts` **15** 행 평문 http" 로 **배포 층 사실** 임을 확정했으므로 row 의 `over TLS` 부기가 같은 판정을 받는지. ③ **272** 행 비고의 **`인증 토큰 (JWT 또는 session cookie) 동반 — 구체는 P3 Auth task`** — 예비 grep 에서 실 구현이 `src/auth/auth.controller.ts` 의 **JWT 2 종을 httpOnly cookie 에 실는 단일 방식** 으로 관측돼 `또는` 이중 표기가 **미결정 시제의 잔재** 일 가능성 + **`구체는 P3 Auth task`** 가 이미 이행된 미래 시제 stale 일 가능성 (2 축). ④ **`sync/async` 컬럼** 이 두 row 모두 `sync` 인데 실 브라우저 outbound 는 `apiClient.ts` 의 **비동기 fetch + 401 → refresh → retry** 재요청을 포함하므로 컬럼 semantics (transport 동기성인지 호출 규약인지) 자체가 표에 정의돼 있는지. ⑤ **REQ pointer 셀** (`REQ-038` · `REQ-043`) ↔ [requirements.md](../requirements.md) 상태 정합 — 예비 grep 에서 **REQ-038 = DONE** · **REQ-043 = IN_PROGRESS (미보호 21 route)** 로 관측돼 row 가 pointer 로만 걸어 둔 claim 의 현재값이 다를 가능성. ⑥ **census 축** — data row **17** 인데 mermaid edge 는 **23** 이라 **6 개 차이** 가 어디서 나는지 (어느 edge 가 row 를 갖지 않는지) 는 표 자체의 **cover 결손** 축이다. ⑦ 표 서문 (**267** 행 `다이어그램의 각 화살표를 sync/async + message format 으로 정리`) 이 **"각 화살표"** 라는 전수 claim 을 하므로 ⑥ 의 차이가 곧 서문 claim 의 참/거짓이 된다.

**행 좌표 주의** — components.md 는 T-1462 각주 +7 행으로 **301** 행이고, heading 은 `## 개요` **5** · `## Deployment 컨텍스트` **22** · `## Component diagram` **28** · `## Component table` **115** · `## GitHub Adapter …` **233** · `## Contracts` **265** · `## References` **291** 다. `## Contracts` 표는 서문 **267**, header **269**, 구분 **270**, data row **271 ~ 287** (**17** 개), 각주군 말미 블록 **226 ~ 231** (T-1462 블록) 이며 그 뒤 **232** 빈 줄 · **233** heading 이다. AC 1 (i) 에서 재실측한다.

[PLAN.md](../PLAN.md) 의 미완 bullet (106 · 108 · 109 · 140 · 151) 은 owner 게이트 · 외부 credential · 새 dependency 게이트라 planner 단독 진행 불가이므로, 본 doc stream 이 현 시점 우선순위 최상위다.

## Required Reading

- `docs/architecture/components.md` — **301 행**. 다음 구간만 읽는다.
  - **265 ~ 272 행** (`## Contracts` heading · 서문 · header · 구분 · data row **271 · 272**) — **본 slice 의 판정 대상**.
  - **273 ~ 287 행** (나머지 15 data row) — **무편집**, **census (개수 · from/to 값) 집계까지만**. **row 본문 판정 금지** (후속 slice 소관).
  - **65 ~ 66 행** (`%% User-facing flow` edge 2 개) — **무편집, 대조용**. 좌표와 label 확인까지만 (`§ 12.59` 가 이미 닫았다).
  - **226 ~ 231 행** (T-1462 각주 블록) · **219 ~ 224 행** (T-1461 각주 블록) — **무편집**. 각주군 말미 좌표 확인 + **브라우저 outbound seam 정의 승계** 근거 1 구 인용용 (특히 T-1461 블록의 `apiClient.ts` **61** · **76** 행 단일 래퍼 정의).
  - **108 ~ 113 행** (`다이어그램 표기` bullet) — 인용만. 재판정 금지.
  - **121 ~ 122 행 부근 표 `Web UI` · `Backend API` row** — **무편집**, 문구 인용까지만. **row 본문 재판정 금지** (`§ 12.44` ~ `§ 12.50` 소관).
  - **그 밖 전 구간** — **무편집, heading 좌표 확인만**.
- `docs/use-cases/REQ-COVERAGE-AUDIT.md` — **5826 행**. **`### 12.15`** (append-only 처리 방침 정본) · **`### 12.60`** (파생 영향 **(1)** 원문 = 본 slice 의 지목 근거 + 누적 15/17 row 좌표 + (viii) 계수 규칙) · **`### 12.59`** 의 **AC 1 (iv) seam 정의 단락만** (승계 원문 인용용 — 절 전체 통독 금지) · **`## 11. References`** (**5813** 행 부근) — `§ 12.61` 삽입 위치 경계. **`§ 12.44` ~ `§ 12.58` 본문은 열지 않는다** — 필요한 판정은 components.md 각주 1 구 인용으로 갈음한다 (§7 context 절약).
- `web/src/main.tsx` — **무편집, read-only**. `createRoot` / `hydrateRoot` grep 이 가리키는 **1 ~ 2 행 인용까지만**.
- `src/auth/auth.controller.ts` — **무편집, read-only**. cookie 발급 지점 **1 ~ 2 행 인용까지만** (상수명 · 옵션명까지만 — **secret · 토큰 값 인용 금지**, §9). **파일 통독 금지**.
- `docs/requirements.md` — **97 행. 무편집, 읽기만**. `REQ-038` · `REQ-043` **행의 상태 컬럼 값만** 확인 (REQ-043 row 는 본문이 매우 길다 — **status 토큰만 읽고 본문은 인용하지 않는다**).
- `docs/PLAN.md` — **175 행. 무편집, 읽기만**. 미완 bullet 좌표 확인용 `grep` 만.
- `CLAUDE.md` §3 (task 크기 상한) · §3.2 (direct doc-only 면제) · §7 (context 절약) · §9 (secret 금지) · §12 (언어 정책)

## Acceptance Criteria

- [ ] **AC 1 — 실측 선행 (날조 금지)**: 편집 전에 다음을 직접 측정해 `§ 12.61` 에 **명령과 출력을 함께** 인용한다. 기대값과 **다르면 그 축의 판정을 실측대로 뒤집는다** (Why 의 ① ~ ⑦ 은 가설일 뿐이다).
  - (i) **좌표 재확인**: `grep -n '^#\{1,3\} ' docs/architecture/components.md` 로 heading 좌표를 **먼저 실측** 한다 (본 AC 의 `265` · `291` 도 stale 일 수 있다 — T-1436 ~ T-1462 선례). 이어 `grep -n '^| ' docs/architecture/components.md` 로 표 행 좌표를 확정하고 `## Component table` 표와 `## Contracts` 표를 **좌표로 분리** 한다.
  - (ii) **census — 표 구조 (본 slice 가 새로 세우는 진척 분모)**: ⓐ `awk 'NR>=265' docs/architecture/components.md | grep -c '^| '` 로 `## Contracts` 표의 전체 pipe 행을 세고 header · 구분 행 **2** 를 뺀 **data row 총계** 를 확정한다 (기대 **17**). ⓑ header 행 (**269** 행 기대) 을 인용해 **컬럼 5 종** (`from` · `to` · `sync/async` · `message format` · `비고`) 을 나열하고, 각 컬럼이 무엇을 주장하는지 표 서문 (**267** 행) 문구와 함께 1 구로 정리한다. ⓒ `grep -nE '^\s+[a-z_]+ -- ' docs/architecture/components.md | wc -l` 로 mermaid edge 총계 (**23** 기대) 를 재확인하고 **row 17 : edge 23** 의 차 **6** 이 **어느 edge 인지** 를 from/to 쌍 대조로 열거한다 (`§ 12.54` 의 산출식 `23 = 2 + 5 + 2 + 4 + 1 + 9` 를 그대로 분해 기준으로 쓴다). ⓓ 본 slice 종료 시 **Contracts 표 17 중 2 판정 완료 · 잔여 15** 임을 수치로 명시한다 (`§ 12.60` 이 확보한 **누적 15/17 좌표** 는 *좌표* 이지 *판정* 이 아님을 1 구로 구분한다 — 혼동 금지).
  - (iii) **대상 row 원문 인용**: `sed -n '267,272p' docs/architecture/components.md` (좌표는 (i) 실측값으로 교체) 로 서문 · header · 구분 · data row **2** 개를 그대로 인용하고, 두 row 를 **5 컬럼으로 분해** 한 표를 만든다.
  - (iv) **seam 정의 승계 (신설 아님)**: `§ 12.59` 가 신설한 **브라우저 outbound seam** 정의 (`web/src` 의 `fetch(` hit **20** 중 실행 코드 **2** 행 = `api/apiClient.ts` **61** · **76**, 나머지 **18** 은 주석 → seam = **`apiClient.ts` 단일 래퍼**) 를 components.md 각주 (**219 ~ 224** 행 블록) 1 구 인용으로 **그대로 승계** 하고, `§ 12.60` 이 **신설** 해야 했던 것과 달리 본 절은 **승계로 족한 이유** (판정 대상 row 2 개가 전부 브라우저 outbound 축) 를 1 구로 밝힌다. 승계가 여전히 유효한지 `grep -rn 'fetch(' web/src/api/apiClient.ts | grep -v '^\s*//' | head -5` 로 **재검증** 한다 (T-1461 이후 변경이 없었음을 확인하는 것이지 재정의가 아니다).
  - (v) **row 271 실측**: ⓐ `grep -rn 'createRoot\|hydrateRoot' web/src --include=*.tsx --include=*.ts | grep -v test` (SSR hydration 실재 여부 — `hydrateRoot` hit **0** 이면 `또는 SPA hydration` 어구가 거짓 축이 된다), ⓑ `grep -rn 'ServeStaticModule\|WEB_DIST_PATH' src/web --include=*.ts | grep -v spec | head -5` (브라우저가 처음 받는 것이 정적 asset 임을 `§ 12.59` 판정과 대조 — **edge 재판정 아님**, row 셀 문구 대조용), ⓒ `grep -rn 'renderToString\|renderToPipeableStream\|ssr' web --include=*.ts --include=*.mts --include=*.tsx 2>/dev/null | grep -v node_modules | head -5` (SSR 정본이 어디에도 없는지 전수).
  - (vi) **row 272 실측**: ⓐ `grep -rn 'ACCESS_TOKEN_COOKIE\|REFRESH_TOKEN_COOKIE\|httpOnly' src/auth/auth.controller.ts | head -6` (실 인증 토큰 전달 방식 — **상수명 · 옵션명까지만**, 값 인용 금지 §9), ⓑ `grep -rn 'session\|express-session\|connect.sid' src --include=*.ts | grep -v spec | head -5` (**session cookie 방식이 실재하는지** — hit 0 이면 `또는 session cookie` 가 미결정 시제의 잔재로 확정된다), ⓒ `grep -rn 'credentials:' web/src/api/apiClient.ts | head -3` (브라우저 측 동반 방식), ⓓ `grep -rn 'https://\|enableCors\|setGlobalPrefix' src/main.ts | head -5` (`over TLS` 의 코드 정본 유무 — `§ 12.59` 실측 재확인).
  - (vii) **`sync/async` 컬럼 · REQ pointer 실측**: ⓐ `grep -n 'REFRESH_PATH\|async ' web/src/api/apiClient.ts | head -6` 로 실 호출이 비동기이며 **401 → refresh → retry** 재요청을 포함하는지 확인하고, 표 서문 (**267** 행) 이 `sync/async` 를 무엇으로 정의하는지 (정의가 **없으면 없다고**) 1 구로 가른다. ⓑ `grep -n '^| REQ-038 \|^| REQ-043 ' docs/requirements.md | cut -c1-120` 로 두 REQ 의 **상태 토큰만** 인용해 row pointer 가 가리키는 claim 의 현재값을 대조한다 (**REQ-043 row 본문은 매우 길다 — status 토큰 밖 인용 금지**).
  - (viii) **좌표 stale · 삽입 파급 실측 (AC 3 · AC 4 입력)**: `grep -n '\*\*[0-9]\{2,3\}\*\* 행' docs/architecture/components.md | head -30` + (i) 실측 대조로 **자기 좌표 stale 이 몇 지점인지** 를 가르고 (T-1460 **4** · T-1461 **6** · T-1462 **0** 지점 선례 — 3 회 추세를 1 구로), 신규 각주를 ⓐ `## Contracts` 절 안 (표 직후) 에 넣을 때 / ⓑ 각주군 말미 (**231** 행 뒤) 에 넣을 때 **각각 밀리는 자기 참조 좌표가 몇 지점인지** 를 **수치 2 개** 로 제시한다 (`§ 12.55` → `§ 12.60` 으로 이어진 계수 규칙 = components.md 자기 좌표 토큰만 세고 외부 파일 좌표는 제외, 범위 토큰 `A ~ B` 는 1 지점 — 그 규칙을 그대로 승계하고 승계 사실을 1 구로 명시).
  - (ix) **baseline** — `wc -l` components.md **301** · audit **5826** · ADR-0003 **173** · requirements.md **97** · deployment.md **232** · directory.md **203** · modules.md **259** · PLAN.md **175**, `grep -c '^## '` components.md **7** · audit **12**, audit `grep -c '^| REQ-'` **66** · `grep -c '^### 12\.'` **60**, components.md `grep -c '^> '` **94**.
- [ ] **AC 2 — 판정표**: AC 1 이 실측한 **축** 마다 `참 / 부분참 / 거짓` 을 판정한 표를 만든다. 각 row 는 **축 1 구 · 실측 근거 (행 번호 포함) · 판정 · 근거 1 구** 4 컬럼이다. 최소 축 **7** 개 — ① **census 축**: 표 서문 (**267** 행) 의 **"다이어그램의 각 화살표를"** 전수 claim ↔ 실 row **17** : edge **23** ((ii) ⓒ — 결손 edge 를 열거하고 그 수만큼 claim 이 어긋남을 수치로), ② **row 271 `message format` 의 `또는 SPA hydration`** ((v) ⓐⓒ), ③ **row 271 `from`/`to` 셀이 가리키는 층** ↔ 실 서빙 주체 ((v) ⓑ — `§ 12.59` 판정 **승계 인용** 이며 edge 재판정 아님을 1 구로 명시), ④ **row 271 · 272 공통의 `HTTPS` · `over TLS`** ((vi) ⓓ — 코드 층인지 배포 층인지), ⑤ **row 272 비고의 `JWT 또는 session cookie` 이중 표기** ((vi) ⓐⓑⓒ — 실 구현이 단일 방식이면 부분참 이상), ⑥ **row 272 비고의 `구체는 P3 Auth task` 미래 시제** ↔ 실 이행 상태 ((vi) ⓐ + (vii) ⓑ), ⑦ **`sync/async` 컬럼 값 `sync`** ↔ 실 비동기 호출 · 401 refresh retry 은닉 ((vii) ⓐ) + **REQ pointer 셀의 현재값 정합** ((vii) ⓑ).
  - row **2** 개가 실 계약 표면 대비 **몇 중 표기** 인지를 `§ 12.57` 의 `1 : 2 : 3` · `§ 12.58` 의 `5 : 1 : 4` · `§ 12.59` 의 `2 : 1 : 1` · `§ 12.60` 의 `1 : 1 : 29` 와 **같은 형식** (row N : 실 network hop M : 브라우저 outbound seam K) 으로 수치화한다.
  - **판정은 (iv) 의 브라우저 outbound seam 정의 위에서만 유효** 함을 표 아래 1 구로 명시하고, **그 정의가 본 절 신설이 아니라 `§ 12.59` 승계** 임을 함께 밝힌다.
  - **mermaid edge 재판정 금지** (`§ 12.54` ~ `§ 12.60` 이 23/23 을 닫았다 — 좌표 · 판정 결과 인용까지만) · **node 축 재판정 금지** (`§ 12.53`) · **`## Component table` row 본문 재판정 금지** (`§ 12.44` ~ `§ 12.50`) · **`## Contracts` 잔여 15 row 판정 금지** (후속 slice 소관 — census 집계까지만).
- [ ] **AC 3 — 처리 방식 판정**: 후보 4 개 중 **채택 1 · 기각 3** 인 판정표를 만든다. 기각마다 근거 1 구.
  - 후보 — (A) **현행 유지 + 무편집** (audit `§ 12.61` 기록만), (B) **각주군 말미 append** — 각주 구간 **끝 (현 231 행 뒤)** 에 blockquote **1 블록 (≤ 7 행)** 을 신설해 census + row 판정을 병기하고, AC 1 (viii) 이 stale 로 확정한 좌표만 in-place 정정 (**≤ 8 지점**), (C) **`## Contracts` 절 안 각주 삽입** (표 직후) + 밀린 좌표 전수 정정, (D) **표 셀 · 서문 텍스트 in-place 수정**.
  - 판정 기준 **4 축** 명시 — ① `§ 12.15` **append-only 정합** (**(D) 는 이 축에서 먼저 판정**), ② **좌표 drift 파급** (AC 1 (viii) 의 수치 2 개를 그대로 근거로), ③ **cap** — 예상 diff ≤ 300 LOC · 변경 파일 **3 고정** (초과 후보는 **자동 기각 + split 제안을 파생 영향에 기록**), ④ **탐색성** (표 독자가 판정 근거에 닿는 경로 길이 — 본 축은 각주군이 표에서 **34 행 이상 떨어져** 있어 앞 slice 들보다 (C) 의 탐색성 이점이 크다는 점을 명시적으로 재고한다).
  - **AC 2 축 ① ~ ⑦ 중 하나라도 `거짓` 이면 (A) 는 자동 기각**. **전 축이 `참` 이어도 (A) 를 자동 채택하지 않는다** — 탐색성 (축 ④) 을 함께 재고 결론을 1 구로 남긴다.
  - **표의 셀 값 · 서문 문구를 고쳐 쓰는 선택지는 채택하지 않는다** — 처리는 **각주 병기** 로 한다. **코드 (`src/` · `web/`) 를 고쳐 row 를 참으로 만드는 처리도 금지** — `pr` task 소관이다.
- [ ] **AC 4 — 채택안 반영**: AC 3 채택안대로만 편집한다.
  - **(A) 채택 시** — components.md **무편집** (`git status --porcelain docs/architecture/components.md` **빈 출력**) 이며, 유지 근거를 `§ 12.61` 에 남긴다.
  - **(B) 채택 시** — 신규 blockquote 는 **마지막 각주 블록 뒤 · `## GitHub Adapter …` heading 직전** 에 삽입하고 **≤ 7 행 + 앞 빈 줄 1 행**, in-place 정정은 **AC 1 (viii) 이 stale 로 확정한 지점만 ≤ 8 지점** (숫자 1 개씩 치환, **문장 재작성 금지**). `wc -l` 증가 **+8 이내** (301 → ≤ 309). 실측이 상한을 넘으면 **넘긴 수치와 원인을 `§ 12.61` 에 1 구로 남기고 실측대로 전부 정정** 한다 (일부만 고치고 stale 을 남기지 않는다 — `§ 12.59` 선례).
  - **(C) · (D) 채택 시** — 변경 파일 3 · diff ≤ 300 LOC 를 **먼저 검산** 하고, 초과하거나 정정 지점이 **9 지점 이상** 이면 채택을 철회해 (B) 로 내린 뒤 그 사실을 `§ 12.61` 에 1 구로 남긴다.
  - **삽입으로 heading 좌표가 다시 밀리면 편집 후 `grep -n '^## ' docs/architecture/components.md` 로 재측정해 반영** 한다 (`§ 12.51` `175` → `§ 12.58` `219` → `§ 12.59` `226` → `§ 12.60` `233` 으로 이어진 재-drift 의 **11 회째** 재현 여부를 1 구로 기록).
  - **문구 · 행 번호 · 절 번호 · task ID 는 AC 1 실측 출력과 1:1 일치** 해야 하며, 실측되지 않은 값을 **새로 창작하지 않는다**.
  - **`## Contracts` 표 본체 (269 ~ 287 행) · 서문 (267 행) · mermaid 블록 (30 ~ 106 행) · `다이어그램 표기` bullet (108 ~ 113 행) · `## Component table` 표 본체 (117 ~ 126 행) · 1 ~ 4 행 blockquote · `## 개요` 각주 (16 ~ 20 행) · 안내 blockquote (128 ~ 131 행) · 각주 16 블록의 판정 문장 · 233 행 이후 전 구간 무편집**. 허용되는 in-place 는 **stale 숫자 치환뿐** 이다.
  - **secret · 토큰 값 · 실 접속 문자열을 문서에 옮겨 적지 않는다** (CLAUDE.md §9 — 상수 **이름** (`ACCESS_TOKEN_COOKIE`) · 옵션명 (`httpOnly`) · path 문자열까지만 허용).
- [ ] **AC 5 — audit `§ 12.61` 신설**: [REQ-COVERAGE-AUDIT.md](../use-cases/REQ-COVERAGE-AUDIT.md) 의 `## 11. References` **직전** 에 `### 12.61 …` 절을 **순수 append** 한다 (기존 절 수정 0). 구성 — 본 절의 위치 · 계보 1 문단 (**`§ 12.60` 파생 영향 (1) 이 지목한 새 축 개시 · edge 축 종료 후 첫 slice · census + user-facing 2 row** 명시 + **seam 정의가 신설이 아니라 `§ 12.59` 승계** 임을 명시) / AC 1 실측 (명령 + 출력) / **census 결과 (표 17 : edge 23 대응 · 결손 6 열거 · 본 축 진척 2/17)** / AC 2 판정표 / AC 3 처리 판정표 / AC 4 반영 결과 + 무편집 경계 / 파생 영향 (목록만) / 불변 검산 / 한계. **절 전체 ≤ 100 행** (초과 시 실측 인용을 요약형으로 압축하고 압축 사실을 한계에 명시).
  - `###` 레벨이라 `grep -c '^## '` **12 불변** · `grep -c '^| REQ-'` **66 불변** · `grep -c '^### 12\.'` **60 → 61**.
- [ ] **AC 6 — 불변 검산**: 다음을 실행해 출력을 `§ 12.61` 에 인용한다. `wc -l` components.md (301 → ≤ 309) · audit (5826 → +100 이내) · **ADR-0003 173 불변** · requirements.md (**97 불변**) · deployment.md (**232 불변**) · directory.md (**203 불변**) · modules.md (**259 불변**) · PLAN.md (**175 불변**), `git diff -U0 -- docs/architecture/components.md | grep '^@@'` 로 **hunk 개수 · 위치** 를 보이고 AC 4 허용 구간 밖 hunk **0** 을 실증 (무편집 채택 시 **hunk 0**), `git diff --numstat` 으로 **순수 삭제 0** (삭제 행이 있으면 stale 숫자 치환의 짝임을 1 구로 설명), `git status --porcelain src/ web/ test/ prisma/ deploy/ docker-compose.yml Dockerfile .github/ package.json README.md .claude/ docs/decisions/ docs/ops/ docs/PLAN.md docs/requirements.md docs/architecture/modules.md` **빈 출력** (특히 **`web/` · `src/auth/` 무편집** 을 1 구로 명시), `git status --porcelain` 전체가 **3 파일 이내**.
- [ ] **AC 7 — 파생 영향 기록 (목록만, 본 slice 편집 금지)**: `§ 12.61` 말미에 후속 slice 대상을 목록으로 남긴다. 최소 포함 — (1) **다음 slice 1 순위 = `## Contracts` 잔여 15 row 중 `Backend API` 발신 5 row (273 ~ 277 행)** — `§ 12.55` 가 orchestration edge 5 를 이미 닫아 판정 입력이 그대로 재사용되므로 한계 비용 최저임을 1 구로 (좌표는 AC 1 (ii) 실측값으로 기재하고, 남은 그룹 분해 = Backend API **5** · Scheduler **2** · Worker **4** · DB→PostgreSQL **1** · 외부 egress **3** 을 수치로 병기) / (2) **census 가 드러낸 결손 edge (row 없는 edge) 의 표 등재 여부** — AC 2 축 ① 결과에 따른 후속 (등재 자체는 `## Contracts` 표 편집이라 본 stream 밖) / (3) `## GitHub Adapter — 3 instance 묶음 vs 분리 결정` 본문 ↔ 코드 대조 (`§ 12.48` FU4 미소진) / (4) row pointer 셀 보강 2 건 (`Scheduler` = `ADR-0042` 미등재 `§ 12.50` FU2 · `Confluence Adapter` `§ 12.49` FU2) / (5) LLM · GitHub adapter ADR pointer 미등재 (`§ 12.47` FU5 · `§ 12.48` FU3) / (6) `@nestjs/config` 미도입 전수 sweep (`§ 12.39` FU3, ADR 게이트) / (7) reviewer 규약 미이행 (`§ 12.41` FU2) / (8) `deploy/README.md` ↔ deployment.md ↔ runbook 3 자 정합 (`§ 12.41` FU3) / (9) README 행 번호 pointer drift 전수 sweep / (10) REQ 번호 체계 잔재 sweep (`§ 12.38` FU3) / (11) `CLAUDE.md` §1 pointer 부정확 (T-1442 FU3) / (12) UC-09 `§ 5` sequence participant 병기 (**51 회째 이월**) / (13) modules.md 카운트 claim 대조 (`§ 12.34` FU1, ADR 게이트) / (14) **행 번호 → anchor 좌표계 이행** (**45 회째 이월** — 본 절 AC 4 의 재-drift 11 회째 재현 여부와 (viii) 파급 수치 대비를 근거로 보탠다) / (15) 각주 heading 참조 anchor 이행 축소 scope (`§ 12.51` FU19 미소진) / (16) `§ 12.44` 한계 "mutation 러너 26 개" 정의 미확정 / (17) `Scheduler` cron → 평가 pipeline 미결선 (`§ 12.50` FU18 — 코드 소관, `pr` task 로만) / (18) `ADR-0003` "단일 DB 인스턴스" 좌표 부재 (`§ 12.46` FU16 · `§ 12.60` FU17 미소진) / (19) `Web UI` node 의 process subgraph 소속 표기 (`§ 12.53` FU19 · `§ 12.59` 층 외연 거짓 확정 — 본 절 축 ③ 이 row 층 표기 근거를 보탰다면 병기) / (20) node · row 외연 정의의 문서 미박제 (`§ 12.55` FU20 · `§ 12.59` FU20 · `§ 12.60` FU19) / (21) modules.md **200** 행 1:N 매핑 ↔ 디렉토리 외연 상충 해소 (`§ 12.56` FU21 미소진) / (22) 가변 instance 수 ↔ 문서의 고정 표기 정합 (`§ 12.57` FU22 · `§ 12.58` FU22 미소진) / (23) `worker --> backend_api` 미표기 결선 (`§ 12.56` FU23 미소진) / (24) dev / prod 2 모드의 다이어그램 · 표 미분리 (`§ 12.59` FU24 · 본 절 축 ④ 가 row 축 근거를 보탠다면 병기) / (25) `prisma migrate deploy` 채널 미표기 + `PostgreSQL 16+` version claim 정정 (`§ 12.60` FU25 미소진) / (26) **(C) 후보 split 제안** (기각이 cap 사유였을 때만) / (27) **인증 규약의 문서 단일 정본 부재** (본 절 축 ⑤ ⑥ 이 `JWT 또는 session cookie` 이중 표기 · 미래 시제 stale 을 확정한 경우에만 — 정정은 표 편집이라 본 stream 밖).
- [ ] **AC 8 — R-110 / R-112 면제 근거 명시**: 본 task 는 `commitMode: direct` doc-only 로 production code **0 LOC** · 분기 **0** 이라 [CLAUDE.md](../../CLAUDE.md) §3.2 direct-mode 면제 조항에 따라 tester 호출 · happy / error / flow / negative 4 항목 · `pnpm test:cov` 가 **N/A** 임을 `§ 12.61` 에 1 구로 명시한다.
- [ ] **AC 9 — 언어 · 링크 규약**: 추가 문장은 모두 한국어 (§12), 문서 간 참조는 상대경로 markdown 링크, 수치는 실측 출력과 1:1 일치.

## Out of Scope

- **코드 · schema · 배포 자산 · CI · agent 정의 변경 절대 금지** — `src/` · `web/` · `test/` · `prisma/` · `scripts/` · `deploy/` · `docker-compose.yml` · `Dockerfile` · `.github/workflows/` · `package.json` · `.claude/agents/` 는 diff 에 등장하면 안 된다 (`grep` 열람은 read-only 라 허용). **row 를 참으로 만들려고 `web/src` 또는 `src/auth` 를 고치는 시도 금지**.
- **`## Contracts` 표 잔여 15 row (273 ~ 287 행) 판정 금지** — census 집계 (개수 · from/to 쌍) 까지만이며 셀 본문의 참 / 거짓 확정은 후속 slice 소관이다.
- **`## Contracts` 표 셀 · 서문 편집 금지** — row 추가 · 삭제 · 셀 문구 수정 어느 것도 하지 않는다. 판정은 각주 병기로만 남긴다.
- **mermaid edge 재판정 · 편집 금지** — `§ 12.54` ~ `§ 12.60` 이 23/23 을 닫았다 (좌표 · 판정 결과 인용까지만). 본 slice 의 축 ③ 은 **row 셀이 가리키는 층** 축일 뿐 edge 재판정이 아니다.
- **node 집합 · 이름 · 카운트 · 소속 재판정 금지** — `§ 12.53` 이 이미 닫았다.
- **`## Component table` 8 row 의 본문 (책임 · contract · REQ · pointer) 재판정 · 편집 금지** — `§ 12.44` ~ `§ 12.50` 이 이미 닫았다.
- **인증 · 인가 정책 자체 판정 금지** — row 비고의 **표기** 가 실 구현과 어긋나는지만 보고 (축 ⑤ ⑥), 미보호 route 처리 · 토큰 TTL · secret 관리 · RBAC 모델 적정성은 열지 않는다 (§9 및 `pr` task 소관). **secret · 토큰 값 인용 금지**.
- **`docs/requirements.md` 의 REQ row 본문 재판정 · 편집 금지** — `REQ-038` · `REQ-043` 의 **status 토큰 인용까지만** 이며 (REQ-043 본문은 매우 길다) 상태 자체의 재평가는 별도 축이다.
- **`## GitHub Adapter — 3 instance 묶음 vs 분리 결정` sub-section (233 행 이후) 본문 대조 금지** — 파생 영향 (3) 소관이다.
- **각주 16 블록의 판정 내용 재검토 · 재작성 · 삭제 · 이관 금지** — 좌표 확인 · 1 구 인용 · AC 4 가 허용한 stale 숫자 치환 (≤ 8 지점) 까지만.
- **audit 기존 절 (`§ 12.1` ~ `§ 12.60`) 수정 금지** — 판정은 `§ 12.61` 순수 append 로만 세운다 (`§ 12.15`).
- **[modules.md](../architecture/modules.md) · `docs/PLAN.md` · `docs/requirements.md` · `docs/decisions/**` 편집 금지** — 좌표 확인용 grep 인용까지만 (특히 ADR-0002 · ADR-0003 무편집).
- **components.md 전면 anchor 좌표계 이행 실행 금지** — 파생 영향 (14) · (15) 소관이다.
- **다른 문서로의 cascade 금지** — [use-cases/INDEX.md](../use-cases/INDEX.md) · `UC-01` ~ `UC-09` · [INDEX.md](../architecture/INDEX.md) · [deployment.md](../architecture/deployment.md) · [directory.md](../architecture/directory.md) · [api.md](../architecture/api.md) · [README.md](../../README.md) 는 무편집.
- **빌드 · 테스트 · 설치 · 브라우저 기동 실행 금지** — `pnpm install` · `pnpm build` · `pnpm test` · `pnpm dev` 어느 것도 실행하지 않는다. 측정은 전부 read-only `grep` · `sed` · `awk` · `wc` · `git` 이다.
- **CI drift-guard spec 작성 금지** — `pr` mode 소관이라 본 direct task 에서 진행하면 §3.1 위반.

## Suggested Sub-agents

`implementer` 단독 (doc-only, 코드 0 LOC — architect · tester 불요. §3.2 direct-mode 면제).

## Follow-ups

(생성 시점 비어 있음 — sub-agent 가 관련 작업을 발견하면 여기에 append 한다.)
