---
id: T-1468
title: components.md `## Contracts` 표 **외부 egress 3 row** (285 ~ 287 행) ↔ 실 `src` outbound · auth 헤더 · 4xx 처리 대조 — `§ 12.65` 파생 영향 (1) 집행 (3 row 1 slice 통합 권고 채택) + `## Contracts` 표 축 17/17 마감 + audit §12.66
phase: P5
status: PENDING
commitMode: direct
coversReq: [REQ-057]
estimatedDiff: 230
estimatedFiles: 3
created: 2026-08-04
independentStream: uc-doc-audit-resync
dependsOn: [T-1467]
touchesFiles:
  - docs/architecture/components.md
  - docs/use-cases/REQ-COVERAGE-AUDIT.md
  - docs/tasks/T-1468-components-md-contracts-external-egress-rows-audit.md
plannerNote: "uc-doc-audit-resync 80 번째 slice — §12.65 FU(1) 의 3 row 통합 권고 채택. 닫히면 Contracts 표 17/17 마감. doc-only 1.6x"
---

# T-1468 — components.md `## Contracts` 외부 egress 3 row 대조

## Why

[T-1467](T-1467-components-md-contracts-db-persistence-row-audit.md) 이 `## Contracts` 표의 **`DB Persistence → PostgreSQL` 1 row (284 행)** 를 닫으면서 ([REQ-COVERAGE-AUDIT.md](../use-cases/REQ-COVERAGE-AUDIT.md) `§ 12.65`) 파생 영향 **(1)** 로 **잔여 3 row = 외부 egress (`GitHub Adapter` 285 · `Confluence Adapter` 286 · `LLM Gateway` 287 행)** 를 다음 slice 1 순위로 지목하고, 동시에 **"3 row 1 slice 통합을 권한다"** 는 판단 근거까지 적었다 — claim 종류가 3 row 에 걸쳐 **동형** (결선 · protocol · auth · pointer · 4xx 이벤트 · 시제) 이라 **축을 claim 종류별로 묶으면 7 ~ 8 축** 으로 축 상한 안에 들고, 2+1 재분할은 같은 축을 두 번 세우는 중복 비용이 크다는 것이다. planner 는 이 권고를 **그대로 채택** 한다 (T-1467 은 반대로 분할을 채택했고 `§ 12.65` AC 3 이 사후 실증으로 그 판단이 옳았음을 확인했다 — 두 결정은 축 수 실측에 따른 것이지 관행이 아니다). 단 `§ 12.65` FU (1) 이 단 단서 — **"절이 100 행을 넘길 조짐이 보이면 실측 인용을 요약형으로 압축한다"** — 를 AC 5 에서 집행한다.

본 slice 는 동시에 **`§ 12.57` (T-1459) · `§ 12.58` (T-1460) 이 닫은 egress edge 9 개 (89 ~ 97 행) 의 row 축 회수** 다. 두 절은 adapter 계열 4 edge · llm 계열 5 edge 를 각각 판정하면서 label 의 protocol · auth 어구를 실측했으므로, 본 절의 protocol · auth 축은 **신설이 아니라 승계 + 유효성 재검증** 이다 (`§ 12.62` ~ `§ 12.65` 가 4 회 연속 이월을 회수한 것과 동형이며 **5 회 연속**). 또한 이 그룹에는 **fan-out 축약 6** (edge **9** : row **3**) 이 전량 몰려 있어, `§ 12.61` census 가 서문 전수 claim 을 부분참으로 판정한 근거가 본 slice 에서 row 쪽 시점으로 확인된다.

본 slice 종료 시 **`## Contracts` 표 17 row 전수 판정 완료 (17/17 · egress 그룹 3/3 마감)** 가 되며, `## Contracts` 절 축 자체가 종료된다 (edge 축 23/23 은 `§ 12.60` 이 이미 마감).

planner 사전 확인 — **아래는 전부 가설이며 전제가 아니다** (T-1440 AC 1 이후 planner 기대가 실측에 반증 · 정정된 선례가 **29** 회 있고, 직전 T-1467 에서도 `libpq protocol` 기대가 실측으로 갈렸다). executor 는 AC 1 에서 전부 재측정하고 **기대와 다르면 그 축의 판정을 실측대로 뒤집는다**. ① **결선 실재 + fan-out 축약** — `§ 12.57` 이 adapter 계열 4 edge 를 (참 2 · 부분참 2), `§ 12.58` 이 llm 계열 5 edge 를 (전수 부분참) 로 닫았으므로 결선 자체는 승계 가능성이 크나, row 3 이 edge 9 를 대표하는 축약이 **표 어디에도 표기되지 않는다** 는 점이 은닉 축이다. ② **protocol claim** — 285 행의 `HTTPS REST v3 / GraphQL v4` 중 **GraphQL 어구는 `§ 12.57` 이 `src` 전수 hit **0** 으로 거짓 확정** 했으므로 row 축에서도 거짓 승계 가능성이 크고, `v3` API 버전 표기도 코드 정본 (`Accept: application/vnd.github.v3+json` 류) 이 있는지 재검증 대상이다. 286 · 287 의 `HTTPS REST` 는 참 가능성. ③ **auth claim** — 285 · 286 의 `PAT auth (Authorization: token ...)` 는 실 헤더 문자열이 `token` 인지 `Bearer` 인지가 쟁점이고, 287 의 `API key auth (provider 별 header 다름)` 는 `§ 12.58` 이 **헤더 4 종 은닉** 을 확정했으므로 부분참 승계 가능성. **실 secret 값은 절대 인용 금지** (CLAUDE.md §9 — 헤더 **이름** · 상수 **식별자** 까지만). ④ **`async (외부 HTTPS)` 값 ↔ 289 행 정의문** — 본 3 row 는 정의문의 `async` 열거 항 ("외부 HTTPS 경계를 넘는 호출") 에 **정확히 부합하는 유일한 그룹** 이라, `§ 12.61` ~ `§ 12.65` 로 이어진 정의 결손의 **5 회째 증상** 이되 **처음으로 정의가 작동하는 사례** 일 가능성이 크다 (그렇다면 그 자체가 판정이며, 결손은 sync row 쪽에 국한된다는 결론이 된다). ⑤ **`ADR-0003 §4` pointer** — 3 row 공통. `§` 세분이 실재하는지 · 대상 문장이 direct egress 를 규정하는지 (`§ 12.62` pointer 축 판정 승계). ⑥ **4xx catch → `PermissionDeniedEvent`** — 285 (REQ-008) · 286 (REQ-016) 만 걸고 287 은 **비대칭으로 0** 인데, 실 코드에 `PermissionDeniedEvent` 심볼이 존재하는지 · REQ pointer 2 개의 requirements.md 상태값이 무엇인지가 축이다. 심볼 hit **0** 이면 거짓, 다른 이름으로 존재하면 부분참. ⑦ **수 claim · 미래 시제** — 287 의 `외부 LLM provider 5 종` 수 claim 을 `src/llm/providers` 실 adapter 수와 대조하고 (`§ 12.58` 이 **edge 5 : adapter 4 : seam 1** 불일치를 확정했으므로 반증 가능성이 크다), `구체는 P4 LLM gateway task` 미래 시제는 **P4 가 이미 complete** ([STATE.json](../STATE.json) `phase`) 이므로 거짓 가능성이 크다 (`§ 12.61` 이 row 272 의 `P3 Auth task` 를 같은 논리로 거짓 확정한 것과 동형이나, `§ 12.62` 는 row 277 의 `구체는 P5` 를 **참** 으로 갈랐으므로 phase 상태 실측이 필수다). ⑧ **message format 컬럼 판별력 + 좌표 stale** — `§ 12.65` 축 ⑧ 이 "in-process ↔ wire 층위는 가르나 발신 · 수신 쌍은 식별 못 한다" 는 제한적 반례를 남겼는데, 286 · 287 이 `HTTPS REST` 를 **공유** 하므로 wire 층 안에서는 다시 판별력이 0 인지 확인한다 (`§ 12.64` FU31 승계).

**행 좌표 주의** — components.md 는 T-1467 각주 +8 행으로 **342** 행이고, heading 은 `## 개요` **5** · `## Deployment 컨텍스트` **22** · `## Component diagram` **28** · `## Component table` **115** · `## GitHub Adapter …` **233** · `## Contracts` **265** · `## References` **332** 다. `## Contracts` 절은 서문 **267**, header **269**, 구분 **270**, data row **271 ~ 287** (**17** 개), `sync / async 의미` 문단 **289**, **T-1463 각주 291 ~ 297**, **T-1464 각주 299 ~ 305**, **T-1465 각주 307 ~ 313**, **T-1466 각주 315 ~ 322**, **T-1467 각주 324 ~ 330**, 빈 줄 **331** 이며 그 뒤 **332** heading 이다 (각주 블록 사이는 빈 줄 1 행). egress edge 는 mermaid **87 ~ 97** 행 (`%% External egress` 주석 **87** + edge **88 ~ 97**) 이다. AC 1 (i) 에서 재실측한다.

[PLAN.md](../PLAN.md) 의 미완 bullet (106 · 108 · 109 · 140 · 151) 은 owner 게이트 · 외부 credential · 새 dependency 게이트라 planner 단독 진행 불가이므로, 본 doc stream 이 현 시점 우선순위 최상위다.

## Required Reading

- `docs/architecture/components.md` — **342 행**. 다음 구간만 읽는다.
  - **265 ~ 270 행** (`## Contracts` heading · 서문 · header · 구분) + **285 ~ 287 행** (data row **3** 개) — **본 slice 의 판정 대상**.
  - **271 ~ 284 행** (user-facing 2 + orchestration 5 + scheduler 2 + worker 4 + db 1 row) — **무편집**, **census 재확인 (개수) 까지만**. **row 본문 판정 금지** (`§ 12.61` ~ `§ 12.65` 가 전부 닫았다).
  - **289 행** (`sync / async 의미` 문단) — **무편집, 인용만**. 정의문 보강은 `§ 12.61` 파생 영향 (27) 소관이다.
  - **87 ~ 97 행** (mermaid `%% External egress` 주석 + edge 9) — **무편집, 대조용**. 좌표와 label 확인까지만 (`§ 12.57` · `§ 12.58` 이 이미 닫았다).
  - **약 216 ~ 225 행 부근의 T-1459 · T-1460 각주 blockquote** — **무편집**. protocol (`GraphQL` **0 hit`) · auth 헤더 **4 종 은닉** · edge **5** : adapter **4** : seam **1** 판정 결과 승계 근거 **각 1 구 인용까지만**. 정확한 좌표는 AC 1 (i) 의 `grep -n '^> '` 로 실측한다 (본 좌표는 stale 가능성이 있다).
  - **324 ~ 330 행** (T-1467 각주 blockquote) — **무편집**. 삽입점 좌표 확인 + census 수치 (**17 중 14 판정 · 잔여 3**) · 축 ⑦ · ⑧ 승계 근거 1 구 인용용.
  - **108 ~ 113 행** (`다이어그램 표기` bullet) — 인용만. 재판정 금지.
  - **그 밖 전 구간** — **무편집, heading 좌표 확인만**.
- `docs/use-cases/REQ-COVERAGE-AUDIT.md` — **6173 행**. **`### 12.15`** (append-only 처리 방침 정본) · **`### 12.65`** (파생 영향 **(1)** 원문 = 본 slice 의 지목 근거 + 3 row 통합 권고 + 압축 단서 + 진척 수치 + (ix) 계수 규칙 + 각주 위치 관행) · **`### 12.57`** 과 **`### 12.58`** 의 **판정표 행과 다중 표기 문단만** (승계 원문 인용용 — 두 절 전체 통독 금지) · **`## 11. References`** 직전 좌표 — `§ 12.66` 삽입 위치 경계. **`§ 12.44` ~ `§ 12.56` · `§ 12.59` ~ `§ 12.64` 본문은 열지 않는다** — 필요한 판정은 components.md 각주 1 구 인용으로 갈음한다 (§7 context 절약).
- `src/github/` · `src/confluence/` · `src/llm/providers/` — **무편집, read-only**. outbound 호출 지점 · 헤더 상수 선언 **행을 축별로 1 ~ 5 개 인용까지만**. **파일 통독 금지** (축 ① ~ ③ · ⑦ 한정). 정확한 디렉토리명은 AC 1 (iv) 의 실측으로 확정한다.
- `docs/decisions/ADR-0003-*.md` — **무편집, 읽기만**. `§ 4` 실재 여부 + 결정 문장 **1 구 인용까지만** (축 ⑤ pointer 정합).
- `docs/requirements.md` — **무편집, 읽기만**. `REQ-008` · `REQ-016` 행 **status 값만** `grep` (축 ⑥).
- `docs/STATE.json` — **무편집, 읽기만**. `phase` 필드 **1 값만** (축 ⑦ 의 P4 시제 판정 입력).
- `docs/PLAN.md` — **175 행. 무편집, 읽기만**. 미완 bullet 좌표 확인용 `grep` 만.
- `CLAUDE.md` §3 (task 크기 상한) · §3.2 (direct doc-only 면제) · §7 (context 절약) · §9 (secret 금지) · §12 (언어 정책)

## Acceptance Criteria

- [ ] **AC 1 — 실측 선행 (날조 금지)**: 편집 전에 다음을 직접 측정해 `§ 12.66` 에 **명령과 출력을 함께** 인용한다. 기대값과 **다르면 그 축의 판정을 실측대로 뒤집는다** (Why 의 ① ~ ⑧ 은 가설일 뿐이다).
  - (i) **좌표 재확인**: `grep -n '^#\{1,3\} ' docs/architecture/components.md` 로 heading 좌표를 **먼저 실측** 한다 (본 task 의 `265` · `332` 도 stale 일 수 있다 — T-1436 ~ T-1467 선례). 이어 `grep -n '^| ' docs/architecture/components.md` 로 표 행 좌표를 확정해 `## Component table` 표와 `## Contracts` 표를 **좌표로 분리** 하고, **`| GitHub Adapter |` · `| Confluence Adapter |` · `| LLM Gateway |` 로 시작하는 data row 의 실 행 번호** 를 확정한다. `grep -n '^> ' docs/architecture/components.md | tail -8` 로 **T-1467 각주 blockquote 의 마지막 행** (삽입점) 과 **T-1459 · T-1460 각주 블록 좌표** 를 확정한다.
  - (ii) **census 승계 재확인 (신설 아님)**: `§ 12.61` 의 census 표 (그룹별 edge : row = user-facing 2:2 · orchestration 5:5 · scheduler 2:2 · worker 4:4 · db 1:1 · **egress 9:3**) 를 **1 구 인용으로 승계** 한다 (**재산출 금지**). 다만 **egress 9:3** 만은 본 slice 판정 대상이므로 `awk`/`grep` 으로 edge 9 · row 3 을 **직접 재계수** 한다. 종료 시 **표 17 중 17 판정 완료 · 잔여 0** 임을 수치로 명시한다 (`§ 12.65` 가 세운 **14/17** 에 **+3**).
  - (iii) **대상 row 원문 인용**: `sed -n '269,270p;285,287p' docs/architecture/components.md` (좌표는 (i) 실측값으로 교체) 로 header · 구분 · data row **3** 개를 그대로 인용하고 **row 별 5 컬럼 분해** 를 적는다.
  - (iv) **outbound 지점 실측**: adapter 3 계열의 실 outbound 호출 지점을 `grep -rn` 으로 확정한다 (`fetch(` · `axios` · `Octokit` · `https://` 등 후보를 **실측으로** 좁힌다 — 특정 라이브러리를 전제하지 않는다). 각 계열의 **파일 : 호출 지점 : row** 수를 계수해 fan-out 축약 수치를 산출한다.
  - (v) **protocol · auth 어휘 실측**: `GraphQL` · `graphql` · `v3` · `Authorization` · `Bearer` · `token ` · `api-key` · `x-api-key` 를 `src` 전수 (spec 제외) 로 `grep -c` 하고 hit 좌표를 인용한다. **secret 값 · 환경변수 실값은 절대 인용 금지** — 헤더 **이름** 과 상수 **식별자** 까지만 (CLAUDE.md §9).
  - (vi) **4xx 이벤트 실측**: `PermissionDeniedEvent` 를 `src` 전수 `grep` 하고 hit 0 이면 유사 심볼 (`PermissionDenied` · `403` · `401` catch 분기) 을 후보로 재검색해 **실재 형태를 확정** 한다. `REQ-008` · `REQ-016` 의 [requirements.md](../requirements.md) status 값을 함께 인용한다.
  - (vii) **좌표 stale · 삽입 파급 계수**: `§ 12.55` ~ `§ 12.65` 의 계수 규칙 (자기 좌표만 · 범위 · 나열 토큰은 1 지점 · 외부 파일 좌표 제외) 을 **그대로 승계** 해 본 slice 가 인용 · 의존한 좌표의 stale 지점 수와 삽입 파급 지점 수를 각각 보고한다 (T-1462 ~ T-1467 이 **8 회 연속 stale 0**).
- [ ] **AC 2 — 축별 판정 (참 / 부분참 / 거짓)**: Why 의 ① ~ ⑧ **8 축** 을 판정표 (축 · 실측 근거 · 판정 · 근거 1 ~ 2 구) 로 정리한다. **3 row 를 축별로 묶어** 한 축 안에서 row 간 차이가 있으면 그 갈림을 명시한다 (`§ 12.62` 가 row 277 을 row 272 와 갈라 판정한 선례). **거짓 · 부분참 판정에는 반드시 실측 좌표 인용** 을 붙인다. 판정 대상 밖 (edge 축 · node 축 · `## Component table` row · 271 ~ 284 row) 은 **재판정 금지**.
- [ ] **AC 3 — 3 row 통합 판단의 사후 실증**: `§ 12.65` FU (1) 이 권고한 **3 row 1 slice 통합** 이 옳았는지를 **실측 수치로** 평가한다 — 실제 축 수 · 절 행 수 · 고정비 (좌표 실측 · census 재확인 · 각주 삽입) 대 판정 본문 비율을 적고, `§ 12.65` 가 "분할은 축 상한 때문에 옳았을 뿐 고정비 측면에서는 손해였다" 고 남긴 한계와 **대조** 한다. 통합이 손해였다면 그 사실도 정직하게 적는다.
- [ ] **AC 4 — components.md 각주 반영**: `## Contracts` 절 안, **T-1467 각주 블록 뒤** 에 빈 줄 1 행 + blockquote 를 **추가만** 한다 (`§ 12.62` 가 실측으로 확정하고 `§ 12.63` ~ `§ 12.65` 가 승계한 각주 위치 관행). **표 본체 셀 · 서문 · 289 행 정의문 · 기존 각주 본문 · mermaid · `## Component table` 은 무편집** (`§ 12.15` append-only). 각주는 **≤ 8 행**. AC 1 (vii) 이 stale 좌표를 찾아낸 경우에 한해 **in-place 정정 ≤ 3 지점** 을 허용하고, 초과 시 정정하지 말고 `§ 12.66` 한계에 남긴다.
- [ ] **AC 5 — audit 절 신설**: [REQ-COVERAGE-AUDIT.md](../use-cases/REQ-COVERAGE-AUDIT.md) 에 **`### 12.66`** 을 `## 11. References` **직전** 에 신설한다. 구성: 위치 · 계보 (승계 / 회수 관계 명시) → AC 1 실측 → AC 2 판정표 → AC 3 사후 실증 → 다중 표기 수치 (`row N : 실 결선 N : 실 호출 지점 N` 형식 — `§ 12.61` ~ `§ 12.65` 형식 승계) → 진척 (**17/17 마감**) → 한계 → 파생 영향 (목록만). **절 ≤ 100 행** — `§ 12.65` FU (1) 의 압축 단서대로, 초과 조짐이 보이면 실측 인용을 요약형 (명령 + 수치만, 출력 전문 생략) 으로 압축한다.
- [ ] **AC 6 — 다음 slice 지목**: 파생 영향 **(1)** 에 **`## Contracts` 표 축 종료 후의 다음 축** 을 근거와 함께 지목한다. `§ 12.65` FU 목록 (2) ~ (32) 중 **본 doc stream 이 편집 가능한 것** (표 편집 batch · ADR 게이트 · `pr` task 소관은 제외) 을 우선순위로 정렬하고 1 순위 후보와 그 이유를 1 ~ 2 구로 적는다. **본 slice 에서 그 작업을 착수하지 않는다** (목록만).
- [ ] **AC 7 — 검증 명령**: `wc -l docs/architecture/components.md docs/use-cases/REQ-COVERAGE-AUDIT.md` 로 증분을 보고하고, `git diff --stat` 이 **≤ 3 파일 · ≤ 300 LOC** 임을 확인한다. doc-only 변경이므로 `pnpm test` 는 불요 (CLAUDE.md §3.2 direct doc-only 면제) — 단 **markdown 표 · blockquote 문법이 깨지지 않았는지** `grep -c '^| '` 로 표 행 수 불변 (**data row 17 유지**) 을 확인한다.

## Out of Scope

- **표 본체 셀 수정 금지** — 축 ② · ⑦ 이 거짓을 확정하더라도 in-place 수정은 하지 않는다 (`§ 12.15` append-only + `§ 12.65` FU (2) · (32) 의 **표 편집 batch** 소관).
- **289 행 `sync/async` 정의문 보강 금지** (`§ 12.61` FU27 소관).
- **edge 축 · node 축 · `## Component table` row · `## Contracts` 271 ~ 284 row 재판정 금지**.
- **코드 수정 금지** — 축 ⑥ 이 `PermissionDeniedEvent` 미구현을 확정하더라도 구현은 `pr` task 소관이며 본 doc stream 이 수행하지 않는다.
- **새 dependency 도입 · ADR 신설 금지** (CLAUDE.md §5 BLOCKED 게이트).
- **secret · token · API key 실값 인용 금지** (CLAUDE.md §9) — 헤더 이름 · 상수 식별자까지만.
- `docs/STATE.json` · journal write 금지 (driver 소관).

## Suggested Sub-agents

`implementer` 단독 (doc-only). 코드 변경 0 이므로 `tester` 불요 (CLAUDE.md §3.2 direct doc-only 면제).

## Follow-ups

(생성 시 비어 있음 — sub-agent 가 발견한 관련 작업을 여기 append)
