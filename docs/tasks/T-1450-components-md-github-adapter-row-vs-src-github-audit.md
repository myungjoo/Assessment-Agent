---
id: T-1450
title: components.md `## Component table` **GitHub Adapter row (124 행)** 의 검증 가능 claim ↔ 실 `src/github/**` 인벤토리 · `ADR-0003 §4` 승계 · REQ 대조 + T-1449 FU1 (2 row 묶음) 의 재-split 첫 slice + audit §12.48
phase: P5
status: DONE
commitMode: direct
coversReq: [REQ-005, REQ-006, REQ-007, REQ-008, REQ-014]
estimatedDiff: 200
estimatedFiles: 3
created: 2026-08-04
independentStream: uc-doc-audit-resync
dependsOn: [T-1449]
touchesFiles:
  - docs/architecture/components.md
  - docs/use-cases/REQ-COVERAGE-AUDIT.md
  - docs/tasks/T-1450-components-md-github-adapter-row-vs-src-github-audit.md
plannerNote: "uc-doc-audit-resync 62 번째 slice — T-1449 FU1 (GitHub+Confluence 2 row 묶음) 을 claim 밀도 근거로 재-split, 첫 slice = GitHub Adapter row. doc-only 1.6x"
---

# T-1450 — components.md `## Component table` GitHub Adapter row ↔ 실 `src/github/**` · `ADR-0003 §4` 승계 · REQ 대조

## Why

[T-1449](T-1449-components-md-llm-gateway-row-vs-src-llm-audit.md) 가 [components.md](../architecture/components.md) `## Component table` 의 `LLM Gateway` row 를 판정하며 T-1448 FU1 (`3 adapter 묶음`) 의 첫 조각을 집행했고 ([REQ-COVERAGE-AUDIT.md](../use-cases/REQ-COVERAGE-AUDIT.md) `§ 12.47`), 잔여 3 row 중 **다음 slice 1 순위로 `GitHub Adapter` + `Confluence Adapter` 2 row 묶음** 을 지목했다 — 근거는 두 row 의 pointer 셀이 본 row 와 **동일한 `ADR-0003 §4 (direct egress)`** 라 `§ 12.47` 의 **참 · drift 0 판정을 그대로 승계** (재측정 불요) 할 수 있다는 것이었다.

planner 는 그 1 순위 대상을 그대로 계승하되 **cap 근거로 다시 split** 한다. `§ 12.47` 은 1 row 로 검증 가능 claim **11** 개 · audit 절 **103** 행을 썼는데 이는 AC 상한 115 의 **90%** 다. `GitHub Adapter` row 는 instance **3 종** · sub-config **3 요소** · sub-section pointer · 계약 시그니처 · REST/GraphQL 2 프로토콜 · 4xx emit · REQ **5 개** 로 claim 밀도가 `LLM Gateway` row 보다 낮지 않고, `Confluence Adapter` row 도 baseUrl · page list / 본문 / version history **3 종** · 4xx catch · 계약 시그니처 **2 개** · REQ **3 개** 로 별도 10 claim 급이다. `§ 12.47` 이 묶음 근거로 든 **`ADR-0003 §4` 승계는 1 축 (~2 claim) 절감** 에 그쳐 합산 20+ claim 을 상한 안으로 되돌리지 못한다. 따라서 T-1449 자신이 T-1448 FU1 에 적용한 것과 **동형의 재-split** 을 집행해 **본 slice = `GitHub Adapter` row (124 행) 단독**, 차기 slice = `Confluence Adapter` row 단독으로 나눈다. 이 split 판단 자체와 근거 수치를 `§ 12.48` 에 남긴다.

대조 축은 넷이다. ① **책임 축** ("3 GitHub instance (github.com / github.sec.samsung.net / github.ecodesamsung.com) 의 통합 adapter" · "단일 service + instance sub-config (URL / PAT / org)" · "자세히는 아래 `GitHub Adapter — 3 instance 묶음 결정` sub-section") ↔ 실 `src/github/**` 인벤토리, ② **contract 축** ("in-process method call (`fetchCommits(instanceKey, repo, range)` 등)" · "외부 HTTPS REST/GraphQL API 로의 outbound" · "4xx 응답 시 PermissionDeniedEvent emit") ↔ 실 adapter 표면 · outbound 지점 · emit 분기, ③ **pointer 축** (`ADR-0003 §4 (direct egress)` — **`§ 12.47` 판정 승계 대상** · `P4 GitHub adapter task`) 의 대상 실재 + § 번호 · phase 좌표 부합, ④ **REQ ID 축** (REQ-005 / REQ-006 / REQ-007 / REQ-008 / REQ-014) 의 [requirements.md](../requirements.md) 실재 + 괄호 병기 문구 부합.

planner 사전 확인 — **아래는 전부 가설이며 전제가 아니다** (T-1440 AC 1 · T-1441 가설 ④ · T-1442 가설 ⑧ · T-1443 가설 ② · T-1444 가설 ① · T-1445 가설 ① · T-1446 의 `AuthGate` 부분참 · T-1447 의 `RBAC` 이름 상이 · T-1448 의 `ADR-0003 §1` 좌표 drift · T-1449 의 `generate` 시그니처 부분참 판정이 planner 기대를 실측으로 반증한 선례가 11 회 있다). executor 는 AC 1 에서 전부 재측정하고 **기대와 다르면 그 축의 편집을 중단** 한다. ① planner 훑기상 **`fetchCommits` 는 `src/` 전체에서 0 hit** 이라 계약 셀이 지목한 시그니처가 실재하지 않을 가능성이 크다 — 실 표면은 `github-adapter.service.ts` 의 `request` / `requestAllPages` 계열과 `github-instance-client.service.ts` 의 `requestAllPagesForInstance` 로 보인다. 다만 row 가 **"등"** 을 붙여 예시임을 시사하므로 **거짓 / 부분참 판정을 실측 시그니처 인용으로 가른다**. ② sub-section pointer 문자열이 **상이할 수 있다** — 실 heading 은 **155** 행 `## GitHub Adapter — 3 instance 묶음 vs 분리 결정` 인데 row 는 `GitHub Adapter — 3 instance 묶음 결정` 으로 인용해 `vs 분리` 가 빠져 보인다. ③ **"URL / PAT / org" 는 실 env suffix 와 이름이 다를 수 있다** — [PLAN.md](../PLAN.md) **81** 행은 `_HOST` / `_ORG` / `_TOKEN_ENC` 를 열거하고 token 은 **암호화 ciphertext** 라 평문 PAT 표기와 어긋날 여지가 있다. ④ **`GraphQL` 근거가 없을 수 있다** — `src/github` 의 outbound 가 REST 전용이면 이 구는 부분참이다. ⑤ **"4xx 응답 시 emit" 은 부분참 가능** — `§ 12.44` 계열 실측 (requirements.md REQ-008 row) 은 401/403 만 emit 하고 404 는 `not-found` 분류라 record 가 남지 않는다고 적는다. ⑥ **ADR 셀에 `ADR-0016` (transport 계약) · `ADR-0017` (config source) 가 미등재** 로 보이나 **새 pointer 추가는 금지** 라 파생 영향에만 남긴다.

**행 좌표 주의** — components.md 는 T-1449 각주 6 행 추가로 **223** 행이고, `## Component table` 은 **115** 행, `GitHub Adapter` row 는 **124** 행, T-1446 각주는 **128 ~ 132**, T-1447 각주는 **134 ~ 140**, T-1448 각주는 **142 ~ 147**, T-1449 각주는 **149 ~ 153**, `## GitHub Adapter — 3 instance 묶음 vs 분리 결정` heading 은 **155** 행이다. AC 1 (i) 에서 재실측한다.

[PLAN.md](../PLAN.md) 의 미완 bullet (106 · 108 · 109 · 140 · 151) 은 owner 게이트 · 외부 credential · 새 dependency 게이트라 planner 단독 진행 불가이므로, 본 doc stream 이 현 시점 우선순위 최상위다.

## Required Reading

- `docs/architecture/components.md` — **223 행**. 다음 구간만 읽는다.
  - **115 ~ 124 행** (`## Component table` heading + 표 header 2 행 + 앞 5 row + **`GitHub Adapter` row**) — **124 행이 본 slice 의 유일한 주 판정 대상**, 119 ~ 123 행은 경계 확인 · 판정 승계 인용만.
  - **125 ~ 126 행** (잔여 2 row — `Confluence Adapter` · `Scheduler`) — **무편집, 경계 확인만**. 판정하지 않는다.
  - **128 ~ 153 행** (T-1446 · T-1447 · T-1448 · T-1449 각주 blockquote 4 블록) — **무편집, 화법 · 배치 template 확인용**. 본 slice 각주는 T-1449 blockquote **직후** 에 붙는다.
  - **155 ~ 186 행** (`## GitHub Adapter — 3 instance 묶음 vs 분리 결정` sub-section) — **무편집**. row 의 sub-section pointer 문자열 부합 판정을 위해 **heading 1 행 + 도입 1 ~ 2 구** 만 인용한다 (**sub-section 본문 재판정 금지** — 그 자체는 별도 slice 소관).
  - **1 ~ 4 행** (문서 성격 선언 blockquote — "본 문서는 P1 T-A3 의 산출물") — **무편집**, 판정의 최강 제약. 인용만 한다.
  - **그 밖 전 구간** — **무편집, heading 좌표 확인만** (`## Contracts` **187** · `## References` **213**).
- `docs/use-cases/REQ-COVERAGE-AUDIT.md` — **4820 행**. **`### 12.15`** (시점 기록 append-only 처리 방침 정본) · **`### 12.47`** (**4704** 행 — T-1449 판정표 화법 template + FU1 원문 + `ADR-0003 §4` 승계 근거 + 잔여 3 row 목록) · **`## 11. References` (4807 행)** — `§ 12.48` 삽입 위치 경계. **그 밖의 절은 열지 않는다** (§7).
- `src/github/github-adapter.service.ts` — **무편집, 읽기만**. public 메서드 시그니처 + outbound 호출 지점 + `mapNon2xx` 의 status 분기만 `grep` / `sed` 로 인용 (**통독 금지**).
- `src/github/github-instance-config.ts` — **무편집, 읽기만**. env suffix 상수 (`_HOST` / `_ORG` / `_TOKEN_ENC` 계열) 와 instance key 해석 **1 ~ 3 구** 인용까지만.
- `src/github/github-instance-client.service.ts` · `src/github/github-request.builder.ts` · `src/github/github.module.ts` — **무편집, 읽기만**. "단일 service" 판정 · emitter 바인딩 · 계약 메서드 이름 확인에 필요한 **1 ~ 2 구** 씩만.
- `docs/decisions/ADR-0003-deployment.md` — **무편집, 읽기만**. **`### Decision §4` 좌표 1 행** 재확인까지만 (`§ 12.47` 판정 승계이므로 **재측정은 1 명령으로 끝낸다**). 파일명 주의 — `ADR-0003-deployment-topology.md` 가 아니다 (`§ 12.45` FU16 표기 drift).
- `docs/requirements.md` — **97 행. 무편집, 읽기만**. REQ-005 / REQ-006 / REQ-007 / REQ-008 / REQ-014 의 **실재 + 제목 1 구** 확인용 `grep` 만 (**행이 매우 길어 통독 금지 — `cut -c1-160` 등으로 잘라 인용**). 본문 재판정 금지.
- `docs/PLAN.md` — **175 행. 무편집, 읽기만**. `## Phase P4 — External integrations` (**79** 행) + GitHub 통합 bullet (**81** 행) 좌표 확인용 `grep` 만.
- `CLAUDE.md` §3 (task 크기 상한) · §3.2 (direct doc-only 면제) · §12 (언어 정책)

## Acceptance Criteria

- [ ] **AC 1 — 실측 선행 (날조 금지)**: 편집 전에 다음을 직접 측정해 `§ 12.48` 에 **명령과 출력을 함께** 인용한다. 기대값과 **다르면 그 축의 편집을 중단** 하고 불성립 사실을 `§ 12.48` 에 기록한다 (Why 의 ① ~ ⑥ 은 가설일 뿐이다).
  - (i) **좌표 + 원문 재확인**: `grep -n '^#\{1,3\} ' docs/architecture/components.md` 로 heading 좌표를 **먼저 실측** 한 뒤 (본 AC 의 `115` · `124` · `155` 도 stale 일 수 있다 — T-1436 ~ T-1449 선례) `sed -n '124p'` 로 row 원문을 인용한다. 이어 **실측으로 참 · 거짓을 가릴 수 있는 claim** (책임 구 · instance 목록 · sub-config 요소 · sub-section pointer · 계약 시그니처 · 프로토콜 · emit 분기 · ADR § 번호 · phase pointer · REQ ID) 만 뽑아 열거하고, 순수 성격 서술은 **검증 불가 claim** 으로 분류해 판정 대상에서 제외한다. 이 이분 자체를 남긴다.
  - (ii) **instance + sub-config 축**: `find src/github -name '*.ts' -not -name '*.spec.ts' | sort` (파일 **7** 개 예상 — 실측값을 그대로 쓴다) · `grep -n 'github\.com\|github\.sec\.samsung\.net\|github\.ecodesamsung\.com' src/github/*.ts | grep -v spec | head -8` · `grep -n '_HOST\|_ORG\|_TOKEN_ENC\|GITHUB_INSTANCES' src/github/github-instance-config.ts | head -10` 으로 **"3 GitHub instance"** 와 **"instance sub-config (URL / PAT / org)"** 를 각각 판정한다. **env 이름이 `URL` / `PAT` 와 다르면 그 차이 자체가 판정 결과** 이며 (참 / 부분참), 실 suffix 3 종을 그대로 인용하고 token 이 **암호화 ciphertext (`_TOKEN_ENC`)** 인지 여부를 1 구로 밝힌다 (**값 인용 금지 — 변수명까지만**).
  - (iii) **단일 service + sub-section pointer 축**: `grep -n 'export class' src/github/*.ts | grep -v spec` 으로 **"통합 adapter · 단일 service"** 를 판정한다 (class 가 여러 개면 어느 것이 adapter 본체이고 나머지가 어떤 보조 역할인지 1 구). **sub-section pointer** 는 `sed -n '155p' docs/architecture/components.md` 로 실 heading 문자열을 인용해 row 의 인용구 (`GitHub Adapter — 3 instance 묶음 결정`) 와 **문자 단위로 대조** 한다 — 다르면 **부분참** 이며 실 heading 을 그대로 인용한다 (**sub-section 본문은 재판정하지 않는다**).
  - (iv) **contract 축**: `grep -rn 'fetchCommits' src --include='*.ts' | head -5` 로 **`fetchCommits(instanceKey, repo, range)` 의 실재 여부** 를 먼저 보이고 (**0 hit 이면 그 사실이 판정 결과**), `grep -n '  async \|  public \|^  request' src/github/github-adapter.service.ts | head -10` + `grep -n 'requestAllPagesForInstance\|async request' src/github/github-instance-client.service.ts | head -6` 로 **실 public 계약 표면 (메서드 이름 3 개 이내)** 을 인용해 판정한다. **프로토콜** 은 `grep -rn 'await fetch(' src/github --include='*.ts' | grep -v spec | head -5` 와 `grep -rni 'graphql' src/github --include='*.ts' | grep -v spec | head -5` 로 **REST 근거 · GraphQL 근거를 각각** 보인다 (**GraphQL 0 hit 이면 `REST/GraphQL` 구는 부분참**). **4xx emit** 은 `grep -n 'mapNon2xx\|permissionDeniedEmitter.emit\|401\|403\|404' src/github/github-adapter.service.ts | head -8` 로 **실제 emit 되는 status 집합** 을 인용해 판정한다 (401/403 만이면 `4xx` 는 부분참 — 404 · 429 · 그 외 4xx 의 처리도 1 구로 밝힌다).
  - (v) **pointer + REQ 축**: `grep -n '^### Decision §4' docs/decisions/ADR-0003-deployment.md` **1 명령** 으로 `ADR-0003 §4 (direct egress)` 좌표를 재확인하되, 판정 본문은 **`§ 12.47` 의 참 · drift 0 판정을 승계** 한다고 명시한다 (재측정 인용은 1 줄로 압축 — 승계가 본 slice split 의 근거였다). `grep -n 'Phase P4\|GitHub 통합' docs/PLAN.md | head -4` 로 **`P4 GitHub adapter task`** pointer 를 판정한다. REQ 는 `grep -n 'REQ-005\|REQ-006\|REQ-007\|REQ-008\|REQ-014' docs/requirements.md | cut -c1-160 | head -8` 로 **5 개 ID 의 실재** 와 괄호 병기 문구 (`3 GitHub instance` · `권한 부족 통지` · `Issue 평가`) 의 실 제목 부합을 판정한다 (**requirements.md 는 행이 매우 길어 반드시 잘라서 인용**). 판정이 동일한 REQ ID 는 묶어도 된다.
  - (vi) baseline — `wc -l` components.md **223** · audit **4820** · requirements.md **97** · deployment.md **232** · directory.md **203** · modules.md **259** · PLAN.md **175** · prisma/schema.prisma **666**, `grep -c '^## '` components.md **7** · audit **12**, audit `grep -c '^| REQ-'` **66** · `grep -c '^### 12\.'` **47**.
- [ ] **AC 2 — 지점 판정표**: AC 1 이 뽑은 **검증 가능 claim** 각각에 대해 `in-place 수정` / `원문 보존 + 각주 부기` / `무편집` / `상위 slice 판정 승계` 중 하나를 판정한 표를 만든다. 각 row 는 **claim 1 구 · 실측 결과 · 판정 (참 / 부분참 / 거짓) · 처리 · 근거 1 구** 5 컬럼이다.
  - **REQ ID 5 개는 판정이 같으면 1 row 로 묶고 ID 를 전부 나열** 해도 무방하다 (묶을 경우 묶음 근거 1 구). **책임 구 · instance 목록 · sub-config · 계약 시그니처 · pointer 는 묶음 금지**.
  - **`ADR-0003 §4` row 의 처리는 `상위 slice 판정 승계` (`§ 12.47`)** 로 적고 승계 사실을 근거 컬럼에 1 구로 남긴다.
  - 판정 기준 **3 축** 명시 — ① **문서 성격** (1 ~ 4 행 blockquote 의 P1 T-A3 blueprint 선언 + 이 표가 이미 여러 차례 shipped 현황으로 갱신된 흔적), ② `§ 12.15` **정합** (row 에 시점 marker 가 있는지 실측 grep 근거), ③ **선례** (T-1430 ~ T-1449 의 "원문 보존 + 실측 각주" vs [T-1429](T-1429-api-md-module-vocab-and-uc-range-resync.md) 의 in-place 1:1 치환 vs [T-1436](T-1436-directory-md-web-frontend-section-vs-src-audit.md) 의 혼합 채택).
- [ ] **AC 3 — 처리 방식 판정**: 후보 4 개 중 **채택 1 · 기각 3** 인 판정표를 만든다. 기각마다 근거 1 구.
  - 후보 — (A) row 셀 **in-place 동기** (틀린 시그니처 · sub-section 제목 · 프로토콜 표기 치환), (B) **원문 무편집 + T-1449 각주 blockquote 직후에 각주 blockquote 1 개 신설** (T-1437 ~ T-1449 화법 승계), (C) **혼합** (거짓 판정 지점만 in-place, 나머지는 각주), (D) **전 지점 무편집 + audit 기록만**.
  - 판정 기준 **4 축** 명시 — ① `§ 12.15` 정합, ② **오도 risk** (독자가 이 표만 읽고 계약 메서드 이름 · 프로토콜 · 4xx 처리 범위 · config 이름을 오인할 때의 비용), ③ **cap** — 예상 diff ≤ 300 LOC · 변경 파일 **3 고정** (초과 후보는 자동 기각 + split 제안 기록), ④ **각주 누적 구조 제약** — 본 slice 는 **5 번째 블록** 이라 `§ 12.44` 한계 3 이 예고한 **5 ~ 6 블록 임계에 실제로 도달** 했다. 임계 도달 사실을 판정표에 1 구로 명시하고 첫 구에 **"본 각주는 `GitHub Adapter` row 한정"** 을 반드시 명시한다 (**배치 규약 재설계 자체는 본 slice 범위 밖 — 파생 영향에 "차기 slice 진입 전 결정 권고" 로 남긴다**).
- [ ] **AC 4 — 채택안 반영**: AC 3 채택안대로만 편집한다. 각 지점은 AC 2 판정 결과를 따른다.
  - **각주 blockquote 는 T-1449 각주 blockquote 마지막 행 (현 153 행) 과 `## GitHub Adapter — 3 instance 묶음 vs 분리 결정` heading (현 155 행) 사이에 삽입** 한다. **각주 blockquote 1 개 (≤ 6 행) + in-place 치환 (≤ 2 지점) 이내**, `wc -l` 증가 **+7 이내** (223 → ≤ 230).
  - **각주 첫 구에 "본 각주는 `GitHub Adapter` row 한정" 을 명시** 한다 — 잔여 2 row (`Confluence Adapter` · `Scheduler`) 는 미판정임을 독자가 즉시 알 수 있어야 한다.
  - **문구 · 파일 이름 · 메서드 이름 · 시그니처 · 수치 · env 변수명 · ADR § 번호 · REQ ID · task ID 는 AC 1 실측 출력과 1:1 일치** 해야 하며, 실측되지 않은 값 (존재하지 않는 메서드, 임의 카운트, 없는 절 번호) 을 **새로 창작하지 않는다**.
  - **1 ~ 4 행 blockquote · 119 ~ 123 행 5 row · 124 행 `GitHub Adapter` row 원문 · 125 ~ 126 행 잔여 2 row · 128 ~ 153 행 기존 각주 4 블록 · 155 행 이후 전 구간 무편집**.
  - **새 pointer 추가 금지** — 본문 · `src/github/**` · `ADR-0003` · `PLAN.md` · `requirements.md` 외의 문서를 새로 등재하지 않는다 ([ADR-0016](../decisions/ADR-0016-github-adapter-http-transport-contract.md) · [ADR-0017](../decisions/ADR-0017-github-instance-config-source.md) · [ADR-0021](../decisions/ADR-0021-github-confluence-live-integration-test-contract.md) 은 **audit 쪽 파생 영향에만** 기록).
  - **secret · PAT · 실 token · 실 호스트 credential 을 문서에 옮겨 적지 않는다** (CLAUDE.md §9) — `GITHUB_<KEY>_TOKEN_ENC` · `LLM_APIKEY_ENC_KEY` 등은 **변수명 언급까지만**, 값 인용 금지.
- [ ] **AC 5 — audit `§ 12.48` 신설**: [REQ-COVERAGE-AUDIT.md](../use-cases/REQ-COVERAGE-AUDIT.md) 의 `## 11. References` (4807 행) **직전** 에 `### 12.48 …` 절을 **순수 append** 한다 (기존 절 수정 0). 구성 — 본 절의 위치 · 계보 1 문단 (**T-1449 FU1 의 2 row 묶음을 cap 근거로 재-split 한 첫 slice** 임과 split 근거 수치 — `§ 12.47` 103 행 / 상한 115 대비) / AC 1 실측 (명령 + 출력) / AC 2 지점 판정표 / AC 3 처리 판정표 / AC 4 반영 결과 + 무편집 경계 / **Component table 잔여 미판정 row 목록** (`Confluence Adapter` · `Scheduler` **2 row** — 다음 slice 1 순위 = **`Confluence Adapter` row 단독** + 본 절의 `ADR-0003 §4` 승계 재승계 가능 여부 1 구) / 파생 영향 (목록만) / 불변 검산 / 한계. **절 전체 ≤ 115 행** (초과 시 실측 인용을 요약형으로 압축하고 압축 사실을 한계에 명시).
  - `###` 레벨이라 `grep -c '^## '` **12 불변** · `grep -c '^| REQ-'` **66 불변** · `grep -c '^### 12\.'` **47 → 48**.
- [ ] **AC 6 — 불변 검산**: 다음을 실행해 출력을 `§ 12.48` 에 인용한다. `wc -l` components.md (223 → ≤ 230) · audit (4820 → +115 이내) · **`prisma/schema.prisma` 666 불변** · deployment.md (**232 불변**) · directory.md (**203 불변**) · modules.md (**259 불변**) · PLAN.md (**175 불변**) · requirements.md (**97 불변**), `git diff -U0 -- docs/architecture/components.md | grep '^@@'` 로 **hunk 개수 · 위치** 를 보이고 AC 4 허용 구간 밖 hunk **0** 을 실증, `git diff --numstat` 으로 **순수 삭제 0** (삭제 행이 있으면 in-place 치환의 짝임을 1 구로 설명), `git status --porcelain src/ test/ web/ prisma/ deploy/ docker-compose.yml Dockerfile .github/ package.json README.md .claude/ docs/decisions/ docs/ops/ docs/PLAN.md docs/requirements.md` **빈 출력** (코드 · schema · frontend · 배포자산 · CI · 의존성 · ADR · PLAN · requirements 무변경), `git status --porcelain` 이 **3 파일 이내** 임을 확인.
- [ ] **AC 7 — 파생 영향 기록 (목록만, 본 slice 편집 금지)**: `§ 12.48` 말미에 후속 slice 대상을 목록으로 남긴다. 최소 포함 — (1) **Component table 잔여 2 row** + 다음 slice 1 순위 (`Confluence Adapter` row 단독 — `ADR-0003 §4` 재승계 근거 1 구, `Scheduler` 는 `ADR-0003 §3` 축이라 후순위), (2) **표 뒤 각주 blockquote 누적 배치 규약 재검토** (`§ 12.44` 한계 3 — 본 slice 로 **5 블록째, 예고 임계 도달**. **차기 slice 진입 전 row 별 anchor 이행 여부를 결정할 것을 권고** 한다고 명시), (3) **GitHub adapter ADR 3 종 (`ADR-0016` · `ADR-0017` · `ADR-0021`) 이 row 의 pointer 셀에 미등재** — 본 절이 실측한 사실이며 pointer 보강은 별도 slice 소관, (4) `## Deployment 컨텍스트` (22 ~ 26 행 — "모든 8 component 는 동일 process" claim, T-1445 FU1 차순위로 **5 회째 이월**), (5) `## Component diagram` mermaid node ↔ 실 module 대조, (6) `## GitHub Adapter — 3 instance 묶음 vs 분리 결정` sub-section (155 ~ 186 행) 본문 ↔ 실 코드 대조 — **본 slice 는 heading 문자열만 대조** 했으므로 본문은 미판정, (7) `@nestjs/config` 미도입 전수 sweep (`§ 12.39` FU3 미소진, ADR 게이트), (8) reviewer 규약 미이행 (`.claude/agents/reviewer.md` REQ-032 0 hit — `§ 12.41` FU2 미소진), (9) `deploy/README.md` ↔ deployment.md ↔ runbook 3 자 정합 (`§ 12.41` FU3 미소진), (10) README 행 번호 pointer drift 전수 sweep, (11) REQ 번호 체계 잔재 전수 sweep (`§ 12.38` FU3 미소진), (12) `CLAUDE.md` §1 pointer 부정확 (T-1442 FU3 미소진), (13) UC-09 `§ 5` sequence participant 병기 (**33 회째 이월**), (14) 정본 [modules.md](../architecture/modules.md) 카운트 claim 대조 (`§ 12.34` FU1 미소진, ADR 게이트), (15) 행 번호 → anchor 좌표계 이행 (**27 회째 이월**), (16) `§ 12.44` 미해결 한계 — "mutation 러너 26 개" 정의 미확정 (`pr` mode drift-guard spec 소관), (17) `Scheduler` cron → 평가 pipeline 미결선 (`§ 12.45` FU15 — **코드 소관, `pr` task 로만 처리 가능**), (18) `ADR-0003` 의 "단일 DB 인스턴스" 좌표 부재 (`§ 12.46` FU16 — ADR 소관 별도 task), (19) **LLM provider 배포 config ADR 3 종 pointer 미등재** (`§ 12.47` FU5 미소진).
- [ ] **AC 8 — R-110 / R-112 면제 근거 명시**: 본 task 는 `commitMode: direct` doc-only 로 production code **0 LOC** · 분기 **0** 이라 [CLAUDE.md](../../CLAUDE.md) §3.2 direct-mode 면제 조항에 따라 tester 호출 · happy / error / flow / negative 4 항목 · `pnpm test:cov` 가 **N/A** 임을 `§ 12.48` 에 1 구로 명시한다.
- [ ] **AC 9 — 언어 · 링크 규약**: 추가 문장은 모두 한국어 (§12), 문서 간 참조는 상대경로 markdown 링크, 수치는 실측 출력과 1:1 일치. **ADR-0003 파일 경로는 `docs/decisions/ADR-0003-deployment.md`** 로만 적는다 (`§ 12.45` FU16 이 지적한 `-deployment-topology.md` 표기 drift 재발 금지).

## Out of Scope

- **코드 · schema · frontend · 배포 자산 · CI · agent 정의 변경 절대 금지** — `src/` · `web/` · `test/` · `prisma/` · `scripts/` · `deploy/` · `docker-compose.yml` · `Dockerfile` · `.github/workflows/` · `package.json` · `.claude/agents/` 는 diff 에 등장하면 안 된다. **메서드 추가 · rename 으로 문서를 맞추는 행위 금지** (문서를 실제에 맞출 뿐, 실제를 문서에 맞추지 않는다).
- **Component table 잔여 2 row 판정 · 편집 금지** — `Confluence Adapter` · `Scheduler` 는 후속 slice 소관이며 본 slice 에서 손대면 cap 이 즉시 깨진다 (본 task 의 재-split 근거 자체).
- **`Web UI` · `Backend API` · `Worker` · `DB Persistence` · `LLM Gateway` row (119 ~ 123 행) 재판정 금지** — `§ 12.44` ~ `§ 12.47` 이 이미 닫았다. 필요 시 판정 승계 인용까지만.
- **`## GitHub Adapter — 3 instance 묶음 vs 분리 결정` sub-section (155 ~ 186 행) 본문 판정 · 편집 금지** — row 의 pointer 문자열 부합 확인을 위한 **heading 1 행 + 도입 1 ~ 2 구 인용** 까지만. 본문 ↔ 코드 대조는 파생 영향 목록에만 남긴다.
- **components.md 155 행 이후 전 구간 편집 금지** — `## Contracts` 표 · `## References` · mermaid diagram 무편집.
- **1 ~ 4 행 blockquote · 128 ~ 153 행 T-1446 / T-1447 / T-1448 / T-1449 각주 편집 금지** — 인용 · 화법 참조까지만.
- **`docs/PLAN.md` · `docs/requirements.md` 편집 금지** — pointer / REQ 실재 확인용 grep 인용까지만 (**requirements.md 는 행이 길어 통독 금지**).
- **ADR-0003 · ADR-0016 · ADR-0017 · ADR-0021 본문 재판정 · status 변경 금지** — 파일 실재 + § 좌표 실측까지만. **§ 번호 drift 를 발견해도 ADR 을 고치지 않는다** (components.md 쪽 판정 · 각주로만 처리).
- **[modules.md](../architecture/modules.md) · [INDEX.md](../architecture/INDEX.md) · [deployment.md](../architecture/deployment.md) · [directory.md](../architecture/directory.md) · [api.md](../architecture/api.md) 편집 금지** — 정합 판정 필요 사실은 파생 영향 목록에만 남긴다 (**modules.md 259 행 · deployment.md 232 행 · directory.md 203 행 불변**).
- **GitHub 실호출 · live spec 실행 금지** — 외부 네트워크 호출 · `github.com` · 사내 instance 어느 것도 부르지 않는다 (측정은 전부 read-only grep / ls / find / sed / wc / git).
- **빌드 · 테스트 · 설치 실행 금지** — `pnpm install` · `pnpm build` · `pnpm test` 어느 것도 실행하지 않는다.
- **다른 문서로의 cascade 금지** — [use-cases/INDEX.md](../use-cases/INDEX.md) · `UC-01` ~ `UC-09` · ADR · [README.md](../../README.md) 는 무편집.
- **각주 배치 규약 자체의 재설계 금지** — `§ 12.44` 한계 3 이 제기한 "표 뒤 나열 vs row 별 anchor" 재검토는 **5 블록 임계 도달 사실 + 차기 slice 전 결정 권고** 만 파생 영향에 남기고, 본 slice 에서 규약을 바꾸지 않는다.
- **행 번호 → anchor 좌표계 이행 금지** — 파생 영향 목록에만 남긴다 (27 회째 이월).
- **CI drift-guard spec 작성 금지** — `pr` mode 소관이라 본 direct task 에서 진행하면 §3.1 위반.
- **audit 기존 절 (`§ 12.1` ~ `§ 12.47`) 수정 금지** — `§ 12.48` 순수 append 만.

## Suggested Sub-agents

`implementer` 단독 (doc-only, 코드 0 LOC — architect · tester 불요. §3.2 direct-mode 면제).

## Follow-ups

1. **Component table 잔여 2 row 판정** — 다음 slice 1 순위는 **`Confluence Adapter` row (125 행) 단독** 이다. pointer 셀이 본 row 와 같은 `ADR-0003 §4 (direct egress)` 라 `§ 12.48` 의 승계 판정을 재승계할 수 있어 재측정 1 명령으로 충분하다. `Scheduler` row (126 행) 는 `ADR-0003 §3` 축이라 후순위.
2. **표 뒤 각주 blockquote 배치 규약 결정 (권고)** — 본 slice 로 blockquote 가 **5 블록** 이 되어 `§ 12.44` 한계 3 이 예고한 임계에 도달했다. **차기 slice 진입 전** "표 뒤 나열 유지 vs row 별 anchor 이행" 을 결정할 것.
3. **`GitHub Adapter` row pointer 셀 보강** — `ADR-0016` (transport 계약) · `ADR-0017` (config source) · `ADR-0021` (live integration test 계약) 3 종이 미등재임을 `§ 12.48` 이 실측했다. 새 pointer 추가는 본 slice 금지 사항이라 별도 slice 소관.
4. **`## GitHub Adapter — 3 instance 묶음 vs 분리 결정` sub-section (155 ~ 186 행) 본문 ↔ 코드 대조** — 본 slice 는 heading 문자열만 대조했다.

## 완료 기록

- 완료 시각: 2026-08-04
- 결과 요약: `GitHub Adapter` row (124 행) 의 검증 가능 claim **11 개** 를 실측 판정 (참 3 · 참 근사 2 · 부분참 5 · 거짓 1 · 승계 1) → 후보 4 개 중 **(B) 원문 보존 + 각주 blockquote 1 개 신설** 채택. components.md 223 → **230** (+7, in-place 치환 0), audit `§ 12.48` 신설 4820 → **4913** (절 92 행). 핵심 실측 — `fetchCommits` **0 hit (거짓)** · `graphql` **0 hit (부분참)** · `mapNon2xx` 는 **401/403 만 emit** · env suffix 는 `_HOST` / `_ORG` / `_TOKEN_ENC`.
