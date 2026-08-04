---
id: T-1451
title: components.md `## Component table` **Confluence Adapter row (125 행)** 의 검증 가능 claim ↔ 실 `src/confluence/**` 인벤토리 · `ADR-0003 §4` 재승계 · REQ 대조 + T-1450 FU1 (재-split 둘째 slice) + audit §12.49
phase: P5
status: PENDING
commitMode: direct
coversReq: [REQ-015, REQ-016, REQ-017]
estimatedDiff: 200
estimatedFiles: 3
created: 2026-08-04
independentStream: uc-doc-audit-resync
dependsOn: [T-1450]
touchesFiles:
  - docs/architecture/components.md
  - docs/use-cases/REQ-COVERAGE-AUDIT.md
  - docs/tasks/T-1451-components-md-confluence-adapter-row-vs-src-confluence-audit.md
plannerNote: "uc-doc-audit-resync 63 번째 slice — T-1450 FU1 (Confluence Adapter row 단독) 계승, ADR-0003 §4 재승계. doc-only 1.6x"
---

# T-1451 — components.md `## Component table` Confluence Adapter row ↔ 실 `src/confluence/**` · `ADR-0003 §4` 재승계 · REQ 대조

## Why

[T-1450](T-1450-components-md-github-adapter-row-vs-src-github-audit.md) 이 [components.md](../architecture/components.md) `## Component table` 의 `GitHub Adapter` row 를 판정하며 T-1449 FU1 (`GitHub + Confluence 2 row 묶음`) 을 cap 근거로 재-split 한 **첫 slice** 를 집행했고 ([REQ-COVERAGE-AUDIT.md](../use-cases/REQ-COVERAGE-AUDIT.md) `§ 12.48`), 그 FU1 이 **다음 slice 1 순위를 `Confluence Adapter` row (125 행) 단독** 으로 지목했다. 본 task 는 그 재-split 의 **둘째 slice** 다. `Scheduler` row (126 행) 는 pointer 축이 `ADR-0003 §3` 이라 후순위로 남긴다.

`§ 12.48` 은 `GitHub Adapter` row 1 개로 검증 가능 claim **11** 개 · audit 절 **92** 행을 썼다. `Confluence Adapter` row 도 baseUrl 식별 · page list / 본문 / version history **3 종 조회** · 4xx catch → emit · 계약 시그니처 **2 개** · REST outbound · REQ **3 개** · pointer **2 개** 로 claim 밀도가 비슷하므로, 본 slice 도 **1 row 단독** 으로 유지해 cap (≤ 300 LOC / ≤ 5 파일) 안에 둔다.

대조 축은 넷이다. ① **책임 축** ("Confluence (confluence.sec.samsung.net 외 사내 Confluence) 의 adapter" · "지정 SPACE 의 page list / page 본문 / version history 조회") ↔ 실 `src/confluence/**` 인벤토리, ② **contract 축** ("in-process method call (`listPages(spaceKey)`, `fetchPageVersion(pageId, version)` 등)" · "Confluence REST API 로의 outbound + 응답 데이터 반환" · "4xx 응답 catch → PermissionDeniedEvent emit") ↔ 실 adapter 표면 · outbound 지점 · status 분류 분기, ③ **pointer 축** (`ADR-0003 §4 (direct egress)` — **`§ 12.47` / `§ 12.48` 판정 재승계 대상** · `P4 Confluence adapter task`) 의 대상 실재 + § 번호 · phase 좌표 부합, ④ **REQ ID 축** (REQ-015 / REQ-016 / REQ-017) 의 [requirements.md](../requirements.md) 실재 + 괄호 병기 문구 부합.

planner 사전 확인 — **아래는 전부 가설이며 전제가 아니다** (T-1440 AC 1 · T-1441 가설 ④ · T-1442 가설 ⑧ · T-1443 가설 ② · T-1444 가설 ① · T-1445 가설 ① · T-1446 의 `AuthGate` 부분참 · T-1447 의 `RBAC` 이름 상이 · T-1448 의 `ADR-0003 §1` 좌표 drift · T-1449 의 `generate` 시그니처 부분참 · T-1450 의 `fetchCommits` 0 hit 판정이 planner 기대를 실측으로 반증하거나 정정한 선례가 12 회 있다). executor 는 AC 1 에서 전부 재측정하고 **기대와 다르면 그 축의 편집을 중단** 한다. ① planner 훑기상 **`listPages` · `fetchPageVersion` 은 `src/` 전체에서 0 hit** 이라 계약 셀의 시그니처 **2 개 모두** 실재하지 않을 가능성이 크다 — 실 표면은 `confluence-adapter.service.ts` 의 `request` / `requestAllPages` 와 `confluence-space-traversal.service.ts` 로 보인다. row 가 **"등"** 을 붙여 예시임을 시사하므로 **거짓 / 부분참 판정을 실측 시그니처 인용으로 가른다**. ② **"단일 adapter" 로 읽히는 서술이 부분참일 수 있다** — `export class` 가 `ConfluenceAdapter` 외에 `ConfluenceSpaceTraversalService` 도 있어 보인다 (보조 역할 여부를 1 구로 가른다). ③ **호스트 리터럴 근거가 없을 수 있다** — `confluence.sec.samsung.net` 이 코드에 0 hit 이고 baseUrl 이 env (`CONFLUENCE_<KEY>_BASE_URL`) 주입이면 "외 사내 Confluence" 구는 env 기반 다중 instance 로 재서술돼야 한다. ④ **"4xx 응답 catch → emit" 은 부분참 가능** — `§ 12.48` 의 GitHub 축 실측과 동형으로 **401/403 만 permission-denied 이고 404 는 not-found 분류** 로 보인다. ⑤ **"version history 조회" 근거가 약할 수 있다** — 실 코드에 version 축 호출 경로가 없으면 부분참이다. ⑥ **pointer 셀에 Confluence 계열 ADR (예: `ADR-0018` · `ADR-0021`) 이 미등재** 로 보이나 **새 pointer 추가는 금지** 라 파생 영향에만 남긴다.

**행 좌표 주의** — components.md 는 T-1450 각주 6 행 추가로 **230** 행이고, `## Component table` 은 **115** 행, `Confluence Adapter` row 는 **125** 행, `Scheduler` row 는 **126** 행, 각주 blockquote 5 블록은 **128 ~ 132 / 134 ~ 140 / 142 ~ 147 / 149 ~ 153 / 155 ~ 160**, `## GitHub Adapter — 3 instance 묶음 vs 분리 결정` heading 은 **162** 행, `## Contracts` **194**, `## References` **220** 이다. AC 1 (i) 에서 재실측한다.

[PLAN.md](../PLAN.md) 의 미완 bullet (106 · 108 · 109 · 140 · 151) 은 owner 게이트 · 외부 credential · 새 dependency 게이트라 planner 단독 진행 불가이므로, 본 doc stream 이 현 시점 우선순위 최상위다.

## Required Reading

- `docs/architecture/components.md` — **230 행**. 다음 구간만 읽는다.
  - **115 ~ 125 행** (`## Component table` heading + 표 header 2 행 + 앞 6 row + **`Confluence Adapter` row**) — **125 행이 본 slice 의 유일한 주 판정 대상**, 119 ~ 124 행은 경계 확인 · 판정 승계 인용만.
  - **126 행** (잔여 1 row — `Scheduler`) — **무편집, 경계 확인만**. 판정하지 않는다.
  - **128 ~ 160 행** (T-1446 · T-1447 · T-1448 · T-1449 · T-1450 각주 blockquote 5 블록) — **무편집, 화법 · 배치 template 확인용**. 본 slice 각주는 T-1450 blockquote **직후** 에 붙는다.
  - **1 ~ 4 행** (문서 성격 선언 blockquote — "본 문서는 P1 T-A3 의 산출물") — **무편집**, 판정의 최강 제약. 인용만 한다.
  - **그 밖 전 구간** — **무편집, heading 좌표 확인만** (`## GitHub Adapter …` **162** · `## Contracts` **194** · `## References` **220**).
- `docs/use-cases/REQ-COVERAGE-AUDIT.md` — **4913 행**. **`### 12.15`** (시점 기록 append-only 처리 방침 정본) · **`### 12.48`** (**4807** 행 — T-1450 판정표 화법 template + FU1 원문 + `ADR-0003 §4` 승계 근거 + 각주 5 블록 임계 기록) · **`## 11. References` (4900 행)** — `§ 12.49` 삽입 위치 경계. **그 밖의 절은 열지 않는다** (§7).
- `src/confluence/confluence-adapter.service.ts` — **무편집, 읽기만**. public 메서드 시그니처 + outbound 호출 지점 + status 분류 분기 (`permission-denied` / `not-found`) 만 `grep` / `sed` 로 인용 (**통독 금지**).
- `src/confluence/confluence-instance-config.ts` — **무편집, 읽기만**. env key list 상수 (`CONFLUENCE_INSTANCES`) 와 접두 변수 suffix (`_BASE_URL` / `_AUTH_USER` / `_TOKEN_ENC` / `_SPACE_ALLOWLIST` 계열) **1 ~ 3 구** 인용까지만.
- `src/confluence/confluence-space-traversal.service.ts` · `src/confluence/confluence-request.builder.ts` · `src/confluence/confluence.module.ts` — **무편집, 읽기만**. "단일 adapter" 판정 · page list / 본문 / version 축 경로 · emitter 바인딩 확인에 필요한 **1 ~ 2 구** 씩만.
- `docs/decisions/ADR-0003-deployment.md` — **무편집, 읽기만**. **`### Decision §4` 좌표 1 행** 재확인까지만 (`§ 12.47` · `§ 12.48` 판정 재승계이므로 **재측정은 1 명령으로 끝낸다**). 파일명 주의 — `ADR-0003-deployment-topology.md` 가 아니다 (`§ 12.45` FU16 표기 drift).
- `docs/requirements.md` — **97 행. 무편집, 읽기만**. REQ-015 / REQ-016 / REQ-017 의 **실재 + 제목 1 구** 확인용 `grep` 만 (**행이 매우 길어 통독 금지 — `cut -c1-160` 등으로 잘라 인용**). 본문 재판정 금지.
- `docs/PLAN.md` — **175 행. 무편집, 읽기만**. `## Phase P4 — External integrations` (**79** 행 부근) + Confluence 통합 bullet 좌표 확인용 `grep` 만.
- `CLAUDE.md` §3 (task 크기 상한) · §3.2 (direct doc-only 면제) · §12 (언어 정책)

## Acceptance Criteria

- [ ] **AC 1 — 실측 선행 (날조 금지)**: 편집 전에 다음을 직접 측정해 `§ 12.49` 에 **명령과 출력을 함께** 인용한다. 기대값과 **다르면 그 축의 편집을 중단** 하고 불성립 사실을 `§ 12.49` 에 기록한다 (Why 의 ① ~ ⑥ 은 가설일 뿐이다).
  - (i) **좌표 + 원문 재확인**: `grep -n '^#\{1,3\} ' docs/architecture/components.md` 로 heading 좌표를 **먼저 실측** 한 뒤 (본 AC 의 `115` · `125` · `162` 도 stale 일 수 있다 — T-1436 ~ T-1450 선례) `sed -n '125p'` 로 row 원문을 인용한다. 이어 **실측으로 참 · 거짓을 가릴 수 있는 claim** (책임 구 · 호스트 표기 · 조회 3 종 · 4xx catch · emit 대상 · 계약 시그니처 2 개 · outbound 프로토콜 · ADR § 번호 · phase pointer · REQ ID) 만 뽑아 열거하고, 순수 성격 서술은 **검증 불가 claim** 으로 분류해 판정 대상에서 제외한다. 이 이분 자체를 남긴다.
  - (ii) **책임 + instance 축**: `find src -ipath '*confluence*' -name '*.ts' -not -name '*.spec.ts' | sort` (파일 **10** 개 예상 — 실측값을 그대로 쓴다) · `grep -rn 'confluence\.sec\.samsung\.net' src --include='*.ts' | grep -v spec | head -5` · `grep -n 'CONFLUENCE_INSTANCES\|_BASE_URL\|_AUTH_USER\|_TOKEN_ENC\|_SPACE_ALLOWLIST' src/confluence/confluence-instance-config.ts | head -10` 으로 **"confluence.sec.samsung.net 외 사내 Confluence"** 를 판정한다. **호스트 리터럴이 0 hit 이면 그 사실이 판정 결과** 이며 (부분참), baseUrl 이 env 주입임을 실 상수 이름으로 보인다 (**값 인용 금지 — 변수명까지만**).
  - (iii) **단일 adapter + 조회 3 종 축**: `grep -rn 'export class' src/confluence/*.ts | grep -v spec` 으로 **"Confluence 의 adapter"** 가 단일 dispatch 본체인지 판정한다 (class 가 여러 개면 어느 것이 adapter 본체이고 나머지가 어떤 보조 역할인지 1 구). **조회 3 종** (page list / page 본문 / version history) 은 `grep -rn 'space\|content\|version' src/confluence/confluence-request.builder.ts | head -8` + `grep -n 'export class\|async \|traverse' src/confluence/confluence-space-traversal.service.ts | head -8` 로 **각 축의 근거 유무를 개별로** 보인다 — **version history 축 근거가 0 이면 부분참** 이며 그 사실을 그대로 인용한다.
  - (iv) **contract 축**: `grep -rn 'listPages\|fetchPageVersion' src --include='*.ts' | head -5` 로 **계약 시그니처 2 개의 실재 여부** 를 먼저 보이고 (**0 hit 이면 그 사실이 판정 결과**), `grep -n '  async request\|  async requestAllPages\|^  [a-z][A-Za-z]*(' src/confluence/confluence-adapter.service.ts | head -10` 으로 **실 public 계약 표면 (메서드 이름 3 개 이내)** 을 인용해 판정한다. **프로토콜** 은 `grep -rn 'await fetch(' src/confluence --include='*.ts' | grep -v spec | head -5` 로 REST outbound 근거를 보인다. **4xx catch → emit** 은 `grep -n 'permission-denied\|not-found\|401\|403\|404\|PermissionDeniedEvent' src/confluence/confluence-adapter.service.ts | head -10` 으로 **실제 emit 되는 status 집합** 을 인용해 판정한다 (401/403 만이면 `4xx` 는 부분참 — 404 · 429 · 그 외 4xx 의 처리도 1 구로 밝힌다).
  - (v) **pointer + REQ 축**: `grep -n '^### Decision §4' docs/decisions/ADR-0003-deployment.md` **1 명령** 으로 `ADR-0003 §4 (direct egress)` 좌표를 재확인하되, 판정 본문은 **`§ 12.47` · `§ 12.48` 의 참 · drift 0 판정을 재승계** 한다고 명시한다 (재측정 인용은 1 줄로 압축 — 승계가 본 slice split 의 근거였다). `grep -n 'Phase P4\|Confluence' docs/PLAN.md | head -5` 로 **`P4 Confluence adapter task`** pointer 를 판정한다. REQ 는 `grep -n 'REQ-015\|REQ-016\|REQ-017' docs/requirements.md | cut -c1-160` 로 **3 개 ID 의 실재** 와 괄호 병기 문구 (`Confluence 지정 SPACE 평가` · `권한 부족 통지` · `crawling vs hierarchy 정책`) 의 실 제목 부합을 판정한다 (**requirements.md 는 행이 매우 길어 반드시 잘라서 인용**). 판정이 동일한 REQ ID 는 묶어도 된다.
  - (vi) baseline — `wc -l` components.md **230** · audit **4913** · requirements.md **97** · deployment.md **232** · directory.md **203** · modules.md **259** · PLAN.md **175** · prisma/schema.prisma **666**, `grep -c '^## '` components.md **8** · audit **12**, audit `grep -c '^| REQ-'` **66** · `grep -c '^### 12\.'` **48**.
- [ ] **AC 2 — 지점 판정표**: AC 1 이 뽑은 **검증 가능 claim** 각각에 대해 `in-place 수정` / `원문 보존 + 각주 부기` / `무편집` / `상위 slice 판정 승계` 중 하나를 판정한 표를 만든다. 각 row 는 **claim 1 구 · 실측 결과 · 판정 (참 / 부분참 / 거짓) · 처리 · 근거 1 구** 5 컬럼이다.
  - **REQ ID 3 개는 판정이 같으면 1 row 로 묶고 ID 를 전부 나열** 해도 무방하다 (묶을 경우 묶음 근거 1 구). **책임 구 · 호스트 표기 · 조회 3 종 · 계약 시그니처 · pointer 는 묶음 금지**.
  - **`ADR-0003 §4` row 의 처리는 `상위 slice 판정 승계` (`§ 12.47` → `§ 12.48` → 본 절)** 로 적고 재승계 사실을 근거 컬럼에 1 구로 남긴다.
  - 판정 기준 **3 축** 명시 — ① **문서 성격** (1 ~ 4 행 blockquote 의 P1 T-A3 blueprint 선언 + 이 표가 이미 여러 차례 shipped 현황으로 갱신된 흔적), ② `§ 12.15` **정합** (row 에 시점 marker 가 있는지 실측 grep 근거), ③ **선례** (T-1430 ~ T-1450 의 "원문 보존 + 실측 각주" vs [T-1429](T-1429-api-md-module-vocab-and-uc-range-resync.md) 의 in-place 1:1 치환 vs [T-1436](T-1436-directory-md-web-frontend-section-vs-src-audit.md) 의 혼합 채택).
- [ ] **AC 3 — 처리 방식 판정**: 후보 4 개 중 **채택 1 · 기각 3** 인 판정표를 만든다. 기각마다 근거 1 구.
  - 후보 — (A) row 셀 **in-place 동기** (틀린 시그니처 · 호스트 표기 · 4xx 범위 치환), (B) **원문 무편집 + T-1450 각주 blockquote 직후에 각주 blockquote 1 개 신설** (T-1437 ~ T-1450 화법 승계), (C) **혼합** (거짓 판정 지점만 in-place, 나머지는 각주), (D) **전 지점 무편집 + audit 기록만**.
  - 판정 기준 **4 축** 명시 — ① `§ 12.15` 정합, ② **오도 risk** (독자가 이 표만 읽고 계약 메서드 이름 · 4xx 처리 범위 · 호스트 · 조회 3 종 지원 여부를 오인할 때의 비용), ③ **cap** — 예상 diff ≤ 300 LOC · 변경 파일 **3 고정** (초과 후보는 자동 기각 + split 제안 기록), ④ **각주 누적 구조 제약** — 본 slice 는 **6 번째 블록** 으로 `§ 12.44` 한계 3 · `§ 12.48` 이 예고한 **5 ~ 6 블록 임계를 초과** 한다.
- [ ] **AC 3.5 — T-1450 FU2 (각주 배치 규약) 판정 1 회 결착**: [T-1450](T-1450-components-md-github-adapter-row-vs-src-github-audit.md) FU2 가 "차기 slice 진입 전 결정" 을 권고한 **"표 뒤 blockquote 나열 유지 vs row 별 anchor 이행"** 을 `§ 12.49` 에 **판정 1 문단 (≤ 6 행)** 으로 결착한다. 판정 요소 — (1) 잔여 미판정 row 가 **`Scheduler` 1 개뿐** 이라 규약 이행의 잔여 이득이 작다는 점, (2) anchor 이행은 기존 **6 블록 전부의 재배치** 라 본 stream 의 cap 을 즉시 초과한다는 점, (3) 각 각주 첫 구의 **row 한정 선언** 이 오도 risk 를 이미 낮추고 있다는 점. **결정은 `표 완결까지 현 규약 유지` 를 기본선으로 하되 executor 가 실측 근거로 뒤집어도 된다** — 어느 쪽이든 근거를 남긴다. **본 slice 에서 규약 재설계 · 기존 각주 재배치는 금지** (판정 기록만).
- [ ] **AC 4 — 채택안 반영**: AC 3 채택안대로만 편집한다. 각 지점은 AC 2 판정 결과를 따른다.
  - **각주 blockquote 는 T-1450 각주 blockquote 마지막 행 (현 160 행) 과 `## GitHub Adapter — 3 instance 묶음 vs 분리 결정` heading (현 162 행) 사이에 삽입** 한다. **각주 blockquote 1 개 (≤ 6 행) + in-place 치환 (≤ 2 지점) 이내**, `wc -l` 증가 **+7 이내** (230 → ≤ 237).
  - **각주 첫 구에 "본 각주는 `Confluence Adapter` row 한정" 을 명시** 한다 — 잔여 1 row (`Scheduler`) 는 미판정임을 독자가 즉시 알 수 있어야 한다.
  - **문구 · 파일 이름 · 메서드 이름 · 시그니처 · 수치 · env 변수명 · ADR § 번호 · REQ ID · task ID 는 AC 1 실측 출력과 1:1 일치** 해야 하며, 실측되지 않은 값 (존재하지 않는 메서드, 임의 카운트, 없는 절 번호) 을 **새로 창작하지 않는다**.
  - **1 ~ 4 행 blockquote · 119 ~ 124 행 6 row · 125 행 `Confluence Adapter` row 원문 · 126 행 `Scheduler` row · 128 ~ 160 행 기존 각주 5 블록 · 162 행 이후 전 구간 무편집**.
  - **새 pointer 추가 금지** — 본문 · `src/confluence/**` · `ADR-0003` · `PLAN.md` · `requirements.md` 외의 문서를 새로 등재하지 않는다 (Confluence 계열 ADR 은 **audit 쪽 파생 영향에만** 기록).
  - **secret · token · 실 호스트 credential 을 문서에 옮겨 적지 않는다** (CLAUDE.md §9) — `CONFLUENCE_<KEY>_TOKEN_ENC` 등은 **변수명 언급까지만**, 값 인용 금지.
- [ ] **AC 5 — audit `§ 12.49` 신설**: [REQ-COVERAGE-AUDIT.md](../use-cases/REQ-COVERAGE-AUDIT.md) 의 `## 11. References` (4900 행) **직전** 에 `### 12.49 …` 절을 **순수 append** 한다 (기존 절 수정 0). 구성 — 본 절의 위치 · 계보 1 문단 (**T-1450 FU1 이 지목한 재-split 둘째 slice** 임과 `ADR-0003 §4` 재승계 사실) / AC 1 실측 (명령 + 출력) / AC 2 지점 판정표 / AC 3 처리 판정표 / **AC 3.5 각주 배치 규약 판정 1 문단** / AC 4 반영 결과 + 무편집 경계 / **Component table 잔여 미판정 row 목록** (`Scheduler` **1 row** — 다음 slice 1 순위이며 pointer 축이 `ADR-0003 §3` 이라 승계 불가임을 1 구) / 파생 영향 (목록만) / 불변 검산 / 한계. **절 전체 ≤ 115 행** (초과 시 실측 인용을 요약형으로 압축하고 압축 사실을 한계에 명시).
  - `###` 레벨이라 `grep -c '^## '` **12 불변** · `grep -c '^| REQ-'` **66 불변** · `grep -c '^### 12\.'` **48 → 49**.
- [ ] **AC 6 — 불변 검산**: 다음을 실행해 출력을 `§ 12.49` 에 인용한다. `wc -l` components.md (230 → ≤ 237) · audit (4913 → +115 이내) · **`prisma/schema.prisma` 666 불변** · deployment.md (**232 불변**) · directory.md (**203 불변**) · modules.md (**259 불변**) · PLAN.md (**175 불변**) · requirements.md (**97 불변**), `git diff -U0 -- docs/architecture/components.md | grep '^@@'` 로 **hunk 개수 · 위치** 를 보이고 AC 4 허용 구간 밖 hunk **0** 을 실증, `git diff --numstat` 으로 **순수 삭제 0** (삭제 행이 있으면 in-place 치환의 짝임을 1 구로 설명), `git status --porcelain src/ test/ web/ prisma/ deploy/ docker-compose.yml Dockerfile .github/ package.json README.md .claude/ docs/decisions/ docs/ops/ docs/PLAN.md docs/requirements.md` **빈 출력** (코드 · schema · frontend · 배포자산 · CI · 의존성 · ADR · PLAN · requirements 무변경), `git status --porcelain` 이 **3 파일 이내** 임을 확인.
- [ ] **AC 7 — 파생 영향 기록 (목록만, 본 slice 편집 금지)**: `§ 12.49` 말미에 후속 slice 대상을 목록으로 남긴다. 최소 포함 — (1) **Component table 잔여 1 row** (`Scheduler` row 126 행 — 다음 slice 1 순위, `ADR-0003 §3` 축이라 본 절 승계 불가 + 이 row 로 표 전 row 대조가 완결됨을 1 구), (2) **`Confluence Adapter` row pointer 셀 보강** (본 절이 실측한 Confluence 계열 ADR 미등재 — 새 pointer 추가는 본 slice 금지라 별도 slice 소관), (3) `## Deployment 컨텍스트` (22 ~ 26 행 — "모든 8 component 는 동일 process" claim, T-1445 FU1 차순위로 **6 회째 이월**), (4) `## Component diagram` mermaid node ↔ 실 module 대조, (5) `## GitHub Adapter — 3 instance 묶음 vs 분리 결정` sub-section (162 ~ 193 행) 본문 ↔ 실 코드 대조 (`§ 12.48` FU4 미소진), (6) `@nestjs/config` 미도입 전수 sweep (`§ 12.39` FU3 미소진, ADR 게이트), (7) reviewer 규약 미이행 (`.claude/agents/reviewer.md` REQ-032 0 hit — `§ 12.41` FU2 미소진), (8) `deploy/README.md` ↔ deployment.md ↔ runbook 3 자 정합 (`§ 12.41` FU3 미소진), (9) README 행 번호 pointer drift 전수 sweep, (10) REQ 번호 체계 잔재 전수 sweep (`§ 12.38` FU3 미소진), (11) `CLAUDE.md` §1 pointer 부정확 (T-1442 FU3 미소진), (12) UC-09 `§ 5` sequence participant 병기 (**34 회째 이월**), (13) 정본 [modules.md](../architecture/modules.md) 카운트 claim 대조 (`§ 12.34` FU1 미소진, ADR 게이트), (14) 행 번호 → anchor 좌표계 이행 (**28 회째 이월**), (15) `§ 12.44` 미해결 한계 — "mutation 러너 26 개" 정의 미확정 (`pr` mode drift-guard spec 소관), (16) `Scheduler` cron → 평가 pipeline 미결선 (`§ 12.45` FU15 — **코드 소관, `pr` task 로만 처리 가능**), (17) `ADR-0003` 의 "단일 DB 인스턴스" 좌표 부재 (`§ 12.46` FU16 — ADR 소관 별도 task), (18) **LLM provider 배포 config ADR 3 종 pointer 미등재** (`§ 12.47` FU5 미소진), (19) **GitHub adapter ADR 3 종 (`ADR-0016` · `ADR-0017` · `ADR-0021`) pointer 미등재** (`§ 12.48` FU3 미소진).
- [ ] **AC 8 — R-110 / R-112 면제 근거 명시**: 본 task 는 `commitMode: direct` doc-only 로 production code **0 LOC** · 분기 **0** 이라 [CLAUDE.md](../../CLAUDE.md) §3.2 direct-mode 면제 조항에 따라 tester 호출 · happy / error / flow / negative 4 항목 · `pnpm test:cov` 가 **N/A** 임을 `§ 12.49` 에 1 구로 명시한다.
- [ ] **AC 9 — 언어 · 링크 규약**: 추가 문장은 모두 한국어 (§12), 문서 간 참조는 상대경로 markdown 링크, 수치는 실측 출력과 1:1 일치. **ADR-0003 파일 경로는 `docs/decisions/ADR-0003-deployment.md`** 로만 적는다 (`§ 12.45` FU16 이 지적한 `-deployment-topology.md` 표기 drift 재발 금지).

## Out of Scope

- **코드 · schema · frontend · 배포 자산 · CI · agent 정의 변경 절대 금지** — `src/` · `web/` · `test/` · `prisma/` · `scripts/` · `deploy/` · `docker-compose.yml` · `Dockerfile` · `.github/workflows/` · `package.json` · `.claude/agents/` 는 diff 에 등장하면 안 된다. **메서드 추가 · rename 으로 문서를 맞추는 행위 금지** (문서를 실제에 맞출 뿐, 실제를 문서에 맞추지 않는다).
- **`Scheduler` row (126 행) 판정 · 편집 금지** — 다음 slice 소관이며 본 slice 에서 손대면 cap 이 즉시 깨진다.
- **`Web UI` · `Backend API` · `Worker` · `DB Persistence` · `LLM Gateway` · `GitHub Adapter` row (119 ~ 124 행) 재판정 금지** — `§ 12.44` ~ `§ 12.48` 이 이미 닫았다. 필요 시 판정 승계 인용까지만.
- **`## GitHub Adapter — 3 instance 묶음 vs 분리 결정` sub-section (162 ~ 193 행) 본문 판정 · 편집 금지** — `§ 12.48` FU4 소관이다.
- **components.md 162 행 이후 전 구간 편집 금지** — `## Contracts` 표 · `## References` · mermaid diagram 무편집.
- **1 ~ 4 행 blockquote · 128 ~ 160 행 T-1446 ~ T-1450 각주 5 블록 편집 · 재배치 금지** — 인용 · 화법 참조까지만 (AC 3.5 는 **판정 기록만**, 재배치 실행이 아니다).
- **`docs/PLAN.md` · `docs/requirements.md` 편집 금지** — pointer / REQ 실재 확인용 grep 인용까지만 (**requirements.md 는 행이 길어 통독 금지**).
- **ADR 본문 재판정 · status 변경 금지** — 파일 실재 + § 좌표 실측까지만. **§ 번호 drift 를 발견해도 ADR 을 고치지 않는다** (components.md 쪽 판정 · 각주로만 처리).
- **[modules.md](../architecture/modules.md) · [INDEX.md](../architecture/INDEX.md) · [deployment.md](../architecture/deployment.md) · [directory.md](../architecture/directory.md) · [api.md](../architecture/api.md) 편집 금지** — 정합 판정 필요 사실은 파생 영향 목록에만 남긴다 (**modules.md 259 행 · deployment.md 232 행 · directory.md 203 행 불변**).
- **Confluence 실호출 · live spec 실행 금지** — 외부 네트워크 호출 · 사내 Confluence 어느 것도 부르지 않는다 (측정은 전부 read-only grep / ls / find / sed / wc / git).
- **빌드 · 테스트 · 설치 실행 금지** — `pnpm install` · `pnpm build` · `pnpm test` 어느 것도 실행하지 않는다.
- **다른 문서로의 cascade 금지** — [use-cases/INDEX.md](../use-cases/INDEX.md) · `UC-01` ~ `UC-09` · ADR · [README.md](../../README.md) 는 무편집.
- **행 번호 → anchor 좌표계 이행 금지** — 파생 영향 목록에만 남긴다 (28 회째 이월).
- **CI drift-guard spec 작성 금지** — `pr` mode 소관이라 본 direct task 에서 진행하면 §3.1 위반.
- **audit 기존 절 (`§ 12.1` ~ `§ 12.48`) 수정 금지** — `§ 12.49` 순수 append 만.

## Suggested Sub-agents

`implementer` 단독 (doc-only, 코드 0 LOC — architect · tester 불요. §3.2 direct-mode 면제).

## Follow-ups
