---
id: T-1469
title: components.md `## GitHub Adapter — 3 instance 묶음 vs 분리 결정` 절 (233 ~ 263 행) 산문 ↔ 실 `src/github` 구조 · config · env · pointer 대조 — `§ 12.66` 파생 영향 (1) 집행 (components.md 마지막 미판정 산문 축) + audit §12.67
phase: P5
status: PENDING
commitMode: direct
coversReq: [REQ-057]
estimatedDiff: 230
estimatedFiles: 3
created: 2026-08-04
independentStream: uc-doc-audit-resync
dependsOn: [T-1468]
touchesFiles:
  - docs/architecture/components.md
  - docs/use-cases/REQ-COVERAGE-AUDIT.md
  - docs/tasks/T-1469-components-md-github-adapter-section-prose-audit.md
plannerNote: "uc-doc-audit-resync 81 번째 slice — §12.66 FU(1) 집행. components.md 에 남은 유일한 미판정 산문 축. doc-only 1.6x"
---

# T-1469 — components.md `## GitHub Adapter` 절 산문 대조

## Why

[T-1468](T-1468-components-md-contracts-external-egress-rows-audit.md) 이 `## Contracts` 표의 외부 egress **3 row** 를 닫으면서 표 축 **17/17** 이 종료됐고 ([REQ-COVERAGE-AUDIT.md](../use-cases/REQ-COVERAGE-AUDIT.md) `§ 12.66`), edge 축은 `§ 12.60` 이 **23/23** 으로 이미 마감했다. `§ 12.66` 파생 영향 **(1)** 은 다음 slice 1 순위로 **`## GitHub Adapter — 3 instance 묶음 vs 분리 결정` 절 (233 ~ 263 행) 본문 ↔ 코드 대조** 를 근거 둘과 함께 지목했다 — **첫째** 그 절이 **components.md 에 남은 유일한 미판정 산문 축** 이고, **둘째** `§ 12.66` (iv) (v) 가 실측한 GitHub outbound 지점 (`github-adapter.service.ts` **370** 행) · host 분기 (`github-request.builder.ts` **29 · 103** 행) · instance 고정 표기가 그 절의 핵심 claim 과 **그대로 겹쳐 한계 비용이 최소** 이기 때문이다. planner 는 이 지목을 그대로 채택한다 (`§ 12.48` FU4 · `§ 12.65` FU (3) 로 3 회 이월된 축의 회수이기도 하다).

본 절은 지금까지의 slice 와 **판정 대상의 성격이 다르다** — 표 row 가 아니라 **결정 산문** 이다. 표는 셀 단위로 claim 이 잘리지만 산문은 claim 경계가 문장/bullet 이라 **claim 추출 단위를 먼저 정의** 해야 계수가 정직해진다 (AC 3). 또 산문은 **결정 시점 (T-0016, P1) 의 기록** 이라 "현재 코드와 다름" 이 곧 거짓이 아닐 수 있다 — **설계 의도** 와 **사실 주장** 을 갈라야 한다 (`§ 12.63` 축 ⑤ 가 `duplication 0` 을 사실/의도 2 축으로 분리한 선례를 승계한다).

planner 사전 확인 — **아래는 전부 가설이며 전제가 아니다** (T-1440 AC 1 이후 planner 기대가 실측에 반증 · 정정된 선례가 **30** 회 있다). executor 는 AC 1 에서 전부 재측정하고 **기대와 다르면 그 축의 판정을 실측대로 뒤집는다**. ① **채택 결정문 ↔ 실 클래스 구조** — `GithubAdapter` 는 `github-adapter.service.ts` 에 실재하나 `src/github/` 에 `GithubInstanceClient` · `github-instance-config.ts` · `github-request.builder.ts` · `github-token-decrypt.ts` 가 함께 있어 **"단일 component 1 service"** 표기가 실제 다층 분해를 과소 표기하는지가 축이다 (분해가 instance 축이 아니라 관심사 축이면 결정문은 여전히 참일 수 있다 — 갈라 적는다). ② **instance key `'com'` / `'sec'` / `'ecode'` 리터럴** — 실 코드에 3 값이 그대로 있는지 · 개수가 3 인지 · 하드코딩 union type 인지 config 주도인지. ③ **config schema 예시 (`github.instances.*` YAML 의 `baseUrl` / `token` / `org`)** ↔ 실 config 형태 (필드명 · 계층 · env 주입 방식) 대조 + **`실제 구현은 P4 task` 미래 시제** — [STATE.json](../STATE.json) `phase` 가 **P4-complete** 이라 `§ 12.66` 축 ⑦ (`구체는 P4 LLM gateway task` 거짓) · `§ 12.61` (row 272 `P3 Auth task` 거짓) 과 **동형으로 거짓 가능성이 크다**. ④ **근거 1 의 `REST v3 / GraphQL v4`** — `§ 12.57` · `§ 12.66` 축 ② 가 **`graphql` `src` 전수 0 hit** 으로 GraphQL 을 거짓 확정하고 `v3` 를 **Enterprise base 한정 참** 으로 갈랐으므로 **신설이 아니라 승계 + 유효성 재검증** 이다 (`§ 12.62` ~ `§ 12.66` 의 이월 회수와 동형이며 **6 회 연속**). ⑤ **근거 2 의 `instance 별 차이는 base URL / PAT / org 만`** — `github-token-decrypt.ts` 라는 **토큰 복호 축** · Enterprise `/api/v3` **path 분기** 가 4 · 5 번째 차이로 실재하면 `만` 이라는 한정어가 부분참으로 갈린다. ⑥ **근거 4 의 TLS / proxy 응집 (`NODE_EXTRA_CA_CERTS` · `HTTPS_PROXY`)** — 두 env 이름의 `src` 실 hit 수 · ADR-0003 `§ 4` pointer 정합 (`§ 12.66` 축 ⑤ 가 **78** 행 heading · **80** 행 결정문 실재를 확정했으므로 pointer 자체는 참 승계 가능성이 크고, 쟁점은 **본 절이 인용한 "TLS / proxy 처리" 가 그 §4 의 실제 규정 내용인지** 다). ⑦ **근거 5 의 `githubAdapter.fetchCommits('com', ...)` 패턴** — 메서드명 `fetchCommits` 실재 여부 + 실 시그니처의 첫 인자가 instance key 인지 + DI provider 수. 메서드명이 다르면 **예시 표기 거짓**, 패턴만 맞으면 부분참. ⑧ **Alternatives (b) 심볼 + `ADR-0004` 예고 pointer** — `GithubComAdapter` · `GithubSecAdapter` · `GithubEcodeAdapter` 는 hit **0** 예상 (미채택 박제가 참) 이나, 본문이 예고한 **"향후 (b) 전환 시 ADR-0004 신설"** 은 `docs/decisions/` 에 **`ADR-0004-smoke-e2e-db-mode.md` 가 이미 다른 주제로 번호를 점유** 하고 있어 **번호 충돌 = pointer 거짓** 가능성이 크다 (`§ 12.62` pointer 축 판정 승계). `T-0016` 출처 claim 의 실재도 함께 본다.

**행 좌표 주의** — components.md 는 T-1468 각주 +9 행으로 **351** 행이고, heading 은 `## 개요` **5** · `## Deployment 컨텍스트` **22** · `## Component diagram` **28** · `## Component table` **115** · `## GitHub Adapter …` **233** · `## Contracts` **265** · `## References` **341** 이다. 본 slice 대상 절은 **233 ~ 263** (heading 233 · 결정문 235 · 채택 237 · 구조 239 · config 예시 240 ~ 247 · 근거 249 ~ 255 · Alternatives 257 ~ 261 · ADR 불필요 263) 이고 **264 는 빈 줄** 이다. audit 파일은 **6228** 행이며 `### 12.66` **6160** · `## 11. References` **6215** 다. AC 1 (i) 에서 재실측한다.

[PLAN.md](../PLAN.md) 의 미완 bullet (106 · 108 · 109 · 140 · 151) 은 owner 게이트 · 외부 credential · 새 dependency 게이트라 planner 단독 진행 불가이므로, 본 doc stream 이 현 시점 우선순위 최상위다.

## Required Reading

- `docs/architecture/components.md` — **351 행**. 다음 구간만 읽는다.
  - **233 ~ 263 행** (`## GitHub Adapter — 3 instance 묶음 vs 분리 결정` 절 전량) — **본 slice 의 판정 대상**.
  - **265 ~ 287 행** (`## Contracts` heading · 서문 · 표) — **무편집, 대조용**. **285** 행 egress row 의 protocol · auth 어구 **1 구 인용까지만** (축 ④ 승계 근거). row 재판정 **금지** (`§ 12.61` ~ `§ 12.66` 이 17/17 전부 닫았다).
  - **약 205 · 212 · 332 ~ 339 행의 각주 blockquote** — **무편집**. `graphql` **0 hit** · `v3` Enterprise 한정 · outbound **370** 행 · host 분기 **29 · 103** 행 판정의 승계 근거 **각 1 구 인용까지만**. 정확한 좌표는 AC 1 (i) 의 `grep -n '^> '` 로 실측한다 (본 좌표는 stale 가능성이 있다).
  - **그 밖 전 구간 (mermaid · `## Component table` 포함)** — **무편집, heading 좌표 확인만**.
- `docs/use-cases/REQ-COVERAGE-AUDIT.md` — **6228 행**. **`### 12.15`** (append-only 처리 방침 정본) · **`### 12.66`** (파생 영향 **(1)** 원문 = 본 slice 의 지목 근거 + (vii) 계수 규칙 + 각주 위치 관행 + 절 ≤ 100 행 압축 단서) · **`### 12.57`** 의 판정표 행만 (protocol 승계 원문 인용용 — 절 전체 통독 금지) · **`## 11. References`** 직전 좌표 (`§ 12.67` 삽입 위치 경계). **`§ 12.44` ~ `§ 12.65` 본문은 열지 않는다** — 필요한 판정은 components.md 각주 1 구 인용으로 갈음한다 (§7 context 절약).
- `src/github/` — **무편집, read-only**. `github-adapter.service.ts` · `github-instance-config.ts` · `github-instance-client.service.ts` · `github-request.builder.ts` · `github-token-decrypt.ts` · `github.module.ts` 의 **선언 행 · 분기 행을 축별로 1 ~ 5 개 인용까지만**. **파일 통독 금지 · spec 파일 제외** (축 ① ~ ③ · ⑤ ~ ⑦ 한정).
- `docs/decisions/ADR-0003-deployment.md` — **무편집, 읽기만**. `§ 4` heading (**78** 행 부근) + 결정문 **1 구 인용까지만** (축 ⑥).
- `docs/decisions/` 디렉토리 목록 — `ls` **1 회**. `ADR-0004-*` 파일명 확인까지만 (축 ⑧ 번호 충돌).
- `docs/STATE.json` — **무편집, 읽기만**. `phase` 필드 **1 값만** (축 ③ 시제 판정 입력).
- `docs/PLAN.md` — **175 행. 무편집, 읽기만**. 미완 bullet 좌표 확인용 `grep` 만.
- `CLAUDE.md` §3 (task 크기 상한) · §3.2 (direct doc-only 면제) · §7 (context 절약) · §9 (secret 금지) · §12 (언어 정책)

## Acceptance Criteria

- [ ] **AC 1 — 실측 선행 (날조 금지)**: 편집 전에 다음을 직접 측정해 `§ 12.67` 에 **명령과 출력을 함께** 인용한다. 기대값과 **다르면 그 축의 판정을 실측대로 뒤집는다** (Why 의 ① ~ ⑧ 은 가설일 뿐이다).
  - (i) **좌표 재확인**: `grep -n '^#\{1,3\} ' docs/architecture/components.md` 로 heading 좌표를 **먼저 실측** 한다 (본 task 의 `233` · `265` · `341` 도 stale 일 수 있다 — T-1436 ~ T-1468 선례). 이어 `grep -n '^> ' docs/architecture/components.md | tail -10` 으로 T-1459 · T-1460 · T-1468 각주 좌표와 **본 slice 각주 삽입점** (= `## GitHub Adapter` 절 말미) 을 확정한다.
  - (ii) **claim 추출**: 대상 절 (233 ~ 263) 을 `sed -n` 으로 인용하고 **claim 단위** (문장 또는 bullet) 로 번호를 붙여 **총 claim 수** 를 계수한다. 축 ① ~ ⑧ 이 그 claim 집합을 **몇 % 덮는지** 를 함께 적는다 (미판정 claim 이 남으면 그 사실을 한계에 명시).
  - (iii) **구조 실측**: `ls src/github/` (spec 제외 계수) + `grep -rn '^export class\|^export interface\|^export type' src/github/*.ts` 로 실 심볼 목록과 `GithubAdapter` 선언 행을 확정하고, `github.module.ts` 의 `providers` 배열을 인용해 **DI provider 수** 를 계수한다 (축 ① · ⑦).
  - (iv) **instance key · config 실측**: `grep -rn "'com'\|'sec'\|'ecode'" src/github/*.ts` (spec 제외) 와 `github-instance-config.ts` 의 타입 · 필드명 선언을 인용해 **key 3 실재 여부 · 하드코딩 vs config 주도 · 필드명 (`baseUrl` / `token` / `org`) 일치 여부** 를 확정한다 (축 ② · ③).
  - (v) **protocol · 차이 축 실측**: `grep -rn 'graphql\|GraphQL\|/api/v3\|api.github.com' src/github/*.ts` (spec 제외) 로 축 ④ 승계 유효성을 재검증하고, `github-token-decrypt.ts` · `github-request.builder.ts` 의 분기 행을 인용해 **base URL / PAT / org 외의 instance 차이 축이 실재하는지** 를 계수한다 (축 ⑤).
  - (vi) **env · 메서드 · 심볼 실측**: `grep -rn 'NODE_EXTRA_CA_CERTS\|HTTPS_PROXY' src/ deploy/ 2>/dev/null | wc -l` 로 축 ⑥ 을, `grep -rn 'fetchCommits\|async fetch' src/github/github-adapter.service.ts` 로 축 ⑦ 을, `grep -rn 'GithubComAdapter\|GithubSecAdapter\|GithubEcodeAdapter' src/ | wc -l` + `ls docs/decisions/ | grep ADR-0004` + `grep -rn 'T-0016' docs/tasks/ | head -2` 로 축 ⑧ 을 확정한다. **secret 값 · 환경변수 실값은 절대 인용 금지** — 이름 · 상수 **식별자** 까지만 (CLAUDE.md §9).
  - (vii) **좌표 stale · 삽입 파급 계수**: `§ 12.55` ~ `§ 12.66` 의 계수 규칙 (자기 좌표만 · 범위 · 나열 토큰은 1 지점 · 외부 파일 좌표 제외) 을 **그대로 승계** 해 본 slice 가 인용 · 의존한 좌표의 stale 지점 수와 삽입 파급 지점 수를 각각 보고한다 (T-1462 ~ T-1468 이 **9 회 연속 stale 0**).
- [ ] **AC 2 — 축별 판정 (참 / 부분참 / 거짓)**: Why 의 ① ~ ⑧ **8 축** 을 판정표 (축 · 실측 근거 · 판정 · 근거 1 ~ 2 구) 로 정리한다. **사실 주장과 설계 의도를 갈라** 판정한다 (`§ 12.63` 축 ⑤ 승계) — 결정 시점 의도로서는 참이나 현재 코드와 어긋나는 claim 은 **부분참 + 어긋난 지점 좌표** 로 적는다. **거짓 · 부분참 판정에는 반드시 실측 좌표 인용** 을 붙인다. 판정 대상 밖 (edge 축 · node 축 · `## Component table` · `## Contracts` 표 row) 은 **재판정 금지**.
- [ ] **AC 3 — 산문 축 vs 표 축의 판정 방법론 차이 기록**: 본 slice 가 components.md 의 **첫 산문 축 판정** 이므로, (a) claim 추출 단위 정의 (문장 / bullet / 코드블록 예시를 각각 어떻게 셌는지) · (b) AC 1 (ii) 의 claim 커버율 · (c) 표 row 판정 (`§ 12.61` ~ `§ 12.66`) 대비 고정비 · 밀도 차이를 **수치로** 적는다. 산문 축에 표 축의 `row N : 실 결선 N : 실 호출 지점 N` 형식이 적용 가능한지도 판단해, 불가하면 **대체 다중 표기 형식** 을 정의하고 그 근거를 남긴다.
- [ ] **AC 4 — components.md 각주 반영**: **`## GitHub Adapter` 절 말미 (263 행 뒤 · `## Contracts` heading 앞)** 에 빈 줄 1 행 + blockquote 를 **추가만** 한다 (`§ 12.62` 가 확정하고 `§ 12.63` ~ `§ 12.66` 이 승계한 "판정 대상과 같은 절 안" 관행). **절 본문 (235 ~ 263) · config 코드블록 · `## Contracts` 표 · 289 행 정의문 · 기존 각주 본문 · mermaid · `## Component table` 은 무편집** (`§ 12.15` append-only). 각주는 **≤ 8 행**. AC 1 (vii) 이 stale 좌표를 찾아낸 경우에 한해 **in-place 정정 ≤ 3 지점** 을 허용하고, 초과 시 정정하지 말고 `§ 12.67` 한계에 남긴다.
- [ ] **AC 5 — audit 절 신설**: [REQ-COVERAGE-AUDIT.md](../use-cases/REQ-COVERAGE-AUDIT.md) 에 **`### 12.67`** 을 `## 11. References` **직전** 에 신설한다. 구성: 위치 · 계보 (승계 / 회수 관계 명시) → AC 1 실측 → AC 2 판정표 → AC 3 방법론 차이 → 다중 표기 수치 (AC 3 이 정한 형식) → 진척 (**components.md 축 = diagram 23/23 + 표 17/17 + 산문 1/1 → 문서 전체 판정 완료 여부** 를 명시) → 한계 → 파생 영향 (목록만). **절 ≤ 100 행** — 초과 조짐이 보이면 실측 인용을 요약형 (명령 + 수치만, 출력 전문 생략) 으로 압축한다 (`§ 12.66` 이 **55** 행으로 성공시킨 방식 승계).
- [ ] **AC 6 — 다음 slice 지목**: 파생 영향 **(1)** 에 **components.md 축 종료 후의 다음 대상 문서 / 축** 을 근거와 함께 지목한다. `§ 12.66` FU 목록 (2) ~ (10) 중 **본 doc stream 이 편집 가능한 것** (표 편집 batch · ADR 게이트 · `pr` task 소관 제외) 을 우선순위로 정렬하고 1 순위 후보와 그 이유를 1 ~ 2 구로 적는다. components.md 가 전량 판정 완료면 그 사실을 **명시적으로 선언** 한다. **본 slice 에서 그 작업을 착수하지 않는다** (목록만).
- [ ] **AC 7 — 검증 명령**: `wc -l docs/architecture/components.md docs/use-cases/REQ-COVERAGE-AUDIT.md` 로 증분을 보고하고, `git diff --stat` 이 **≤ 3 파일 · ≤ 300 LOC** 임을 확인한다. doc-only 변경이므로 `pnpm test` 는 불요 (CLAUDE.md §3.2 direct doc-only 면제) — 단 **markdown 표 · blockquote · 코드블록 문법이 깨지지 않았는지** `grep -c '^| '` (**29 불변**) · `grep -c '^## '` (**7 불변**) · ` ``` ` fence 짝수 개로 확인한다.

## Out of Scope

- **절 본문 in-place 수정 금지** — 축 ③ · ⑧ 이 거짓을 확정하더라도 산문 수정은 하지 않는다 (`§ 12.15` append-only + 표 편집 batch 와 동형으로 **산문 편집 batch** 후보로만 남긴다).
- **`## Contracts` 표 row · edge 축 · node 축 · `## Component table` 재판정 금지** (`§ 12.60` · `§ 12.66` 이 마감).
- **289 행 `sync/async` 정의문 보강 금지** (`§ 12.61` FU27 소관).
- **코드 수정 금지** — 축 ⑤ · ⑦ 이 표기 불일치를 확정하더라도 구현 변경은 `pr` task 소관이며 본 doc stream 이 수행하지 않는다.
- **ADR 신설 · ADR-0004 번호 재배정 금지** (CLAUDE.md §5 게이트) — 축 ⑧ 은 pointer 충돌 **기록까지만**.
- **새 dependency 도입 금지**.
- **secret · token · API key 실값 인용 금지** (CLAUDE.md §9) — 이름 · 상수 식별자까지만.
- `docs/STATE.json` · journal write 금지 (driver 소관).

## Suggested Sub-agents

`implementer` 단독 (doc-only). 코드 변경 0 이므로 `tester` 불요 (CLAUDE.md §3.2 direct doc-only 면제).

## Follow-ups

(생성 시점 비어 있음 — sub-agent 가 관련 작업을 발견하면 여기에 append)
