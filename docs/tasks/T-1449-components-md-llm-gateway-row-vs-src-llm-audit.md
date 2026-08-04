---
id: T-1449
title: components.md `## Component table` **LLM Gateway row (123 행)** 의 검증 가능 claim ↔ 실 `src/llm/**` 인벤토리 · `ADR-0003 §4` · REQ 대조 + T-1448 FU1 1 순위 (3 adapter 묶음) 의 첫 slice + audit §12.47
phase: P5
status: DONE
commitMode: direct
coversReq: [REQ-049, REQ-051, REQ-052, REQ-053, REQ-054, REQ-055]
estimatedDiff: 200
estimatedFiles: 3
created: 2026-08-04
independentStream: uc-doc-audit-resync
dependsOn: [T-1448]
touchesFiles:
  - docs/architecture/components.md
  - docs/use-cases/REQ-COVERAGE-AUDIT.md
  - docs/tasks/T-1449-components-md-llm-gateway-row-vs-src-llm-audit.md
plannerNote: "uc-doc-audit-resync 61 번째 slice — T-1448 FU1 1 순위 (3 adapter 묶음) 을 claim 밀도 근거로 split, 그 첫 slice = LLM Gateway row. doc-only 1.6x"
---

# T-1449 — components.md `## Component table` LLM Gateway row ↔ 실 `src/llm/**` · `ADR-0003 §4` · REQ 대조

## Why

[T-1448](T-1448-components-md-db-persistence-row-vs-prisma-audit.md) 이 [components.md](../architecture/components.md) `## Component table` 의 `DB Persistence` row 를 판정하며 T-1447 FU1 을 닫았고 ([REQ-COVERAGE-AUDIT.md](../use-cases/REQ-COVERAGE-AUDIT.md) `§ 12.46`), 잔여 4 row 중 **다음 slice 1 순위로 "3 adapter 묶음" (`LLM Gateway` · `GitHub Adapter` · `Confluence Adapter`)** 을 지목하면서 **"claim 밀도가 높으면 2 slice 로 split"** 을 함께 예고했다. planner 는 세 row 의 claim 을 훑어 **1 slice 에 3 row 는 cap (≤ 300 LOC · 각주 ≤ 7 행 · audit 절 ≤ 115 행) 을 확실히 깬다** 고 판단했다 — `§ 12.46` 이 1 row 로 검증 가능 claim **16** 개 · audit **106** 행을 썼는데, 3 row 는 provider 5 종 · GitHub instance 3 종 · Confluence 계약까지 합쳐 30 claim 을 넘긴다. 따라서 예고된 split 을 집행해 **본 slice = `LLM Gateway` row (123 행) 단독**, 차기 slice = `GitHub Adapter` + `Confluence Adapter` 2 row 로 나눈다. 본 slice 가 세 row 공통축인 **`ADR-0003 §4` (direct egress) pointer 판정** 을 먼저 확정하면 차기 slice 가 그대로 승계할 수 있어 중복 측정도 사라진다.

대조 축은 넷이다. ① **책임 축** ("5 provider (custom / Azure OpenAI / Anthropic / Google Gemini / OpenAI) 의 단일 추상화 service" · "Admin 이 지정한 provider 별 model 식별자 라우팅" · "평가 파이프라인은 본 gateway 만 호출 — 구체 provider API 차이 은닉") ↔ 실 `src/llm/**` 인벤토리, ② **contract 축** ("Backend API / Worker 로부터의 in-process method call (`generate(prompt, modelId)`)" · "각 provider 의 외부 HTTPS REST API 로의 outbound + 응답 텍스트 반환") ↔ 실 gateway interface 시그니처 · outbound 호출 지점, ③ **pointer 축** (`ADR-0003 §4 (direct egress)` · `P4 LLM gateway task`) 의 대상 실재 + **§ 번호 · phase 좌표 부합**, ④ **REQ ID 축** (REQ-049 · REQ-051 ~ 055) 의 [requirements.md](../requirements.md) 실재 + 괄호 병기 문구 부합.

planner 사전 확인 — **아래는 전부 가설이며 전제가 아니다** (T-1440 AC 1 · T-1441 가설 ④ · T-1442 가설 ⑧ · T-1443 가설 ② · T-1444 가설 ① · T-1445 가설 ① · T-1446 의 `AuthGate` 부분참 · T-1447 의 `RBAC` 이름 상이 · T-1448 의 `ADR-0003 §1` 좌표 drift 판정이 planner 기대를 실측으로 반증한 선례가 10 회 있다). executor 는 AC 1 에서 전부 재측정하고 **기대와 다르면 그 축의 편집을 중단** 한다. ① planner 훑기상 `src/llm/providers/` 의 spec 제외 adapter 파일은 **4 개** (`anthropic` · `azure-openai` · `google-gemini` · `openai-compatible`) 라 **"5 provider" 는 adapter 파일 수와 1:1 이 아니다** — custom 과 OpenAI 가 `openai-compatible` 한 adapter 를 공유하는 구조면 row 는 **참이되 "provider 종수 ≠ adapter 파일 수" 를 병기해야** 하고, provider 식별자 enum / union 이 실제 5 종인지도 별도 실측이 필요하다. ② `src/llm/llm-gateway.interface.ts` **74** 행에 `generate(` 가 실재하나 **인자 이름 · 개수가 `(prompt, modelId)` 와 다를 수 있다** (44 · 57 행 주석이 options 객체 · 반환 shape 를 따로 언급) — 시그니처를 그대로 인용해 판정한다. ③ "평가 파이프라인은 본 gateway 만 호출" 은 `src/assessment-evaluation/**` 이 provider adapter 를 직접 import 하지 않는지 grep 로 가려야 하며 **hit 이 있으면 거짓 · 0 이면 참 (근사)** 이다. ④ `ADR-0003 §4` 는 [ADR-0003-deployment.md](../decisions/ADR-0003-deployment.md) **78** 행 `### Decision §4 — 외부 네트워크 boundary = direct outbound from app process` 로 보여 **참 가능성이 높으나**, `§ 12.46` 이 같은 문서의 `§1` 좌표 drift 를 잡아낸 직후이므로 반드시 재측정한다.

**행 좌표 주의** — components.md 는 T-1448 각주 7 행 추가로 **217** 행이고, `## Component table` 은 **115** 행, `LLM Gateway` row 는 **123** 행, T-1446 각주는 **128 ~ 132**, T-1447 각주는 **134 ~ 140**, T-1448 각주는 **142 ~ 147**, `## GitHub Adapter …` heading 은 **149** 행이다. AC 1 (i) 에서 재실측한다.

[PLAN.md](../PLAN.md) 의 미완 bullet (106 · 108 · 109 · 140 · 151) 은 owner 게이트 · 외부 credential · 새 dependency 게이트라 planner 단독 진행 불가이므로, 본 doc stream 이 현 시점 우선순위 최상위다.

## Required Reading

- `docs/architecture/components.md` — **217 행**. 다음 구간만 읽는다.
  - **115 ~ 123 행** (`## Component table` heading + 표 header 2 행 + 앞 4 row + **`LLM Gateway` row**) — **123 행이 본 slice 의 유일한 주 판정 대상**, 119 ~ 122 행은 경계 확인 · 판정 승계 인용만.
  - **124 ~ 126 행** (잔여 3 row) — **무편집, 경계 확인만**. 판정하지 않는다.
  - **128 ~ 147 행** (T-1446 · T-1447 · T-1448 각주 blockquote 3 블록) — **무편집, 화법 · 배치 template 확인용**. 본 slice 각주는 T-1448 blockquote **직후** 에 붙는다.
  - **1 ~ 4 행** (문서 성격 선언 blockquote — "본 문서는 P1 T-A3 의 산출물") — **무편집**, 판정의 최강 제약. 인용만 한다.
  - **그 밖 전 구간** — **무편집, heading 좌표 확인만** (`## GitHub Adapter …` **149** · `## Contracts` **181** · `## References` **207**).
- `docs/use-cases/REQ-COVERAGE-AUDIT.md` — **4717 행**. **`### 12.15`** (시점 기록 append-only 처리 방침 정본) · **`### 12.46`** (**4597** 행 — T-1448 판정표 화법 template + FU1 원문 + 잔여 4 row 목록 + split 예고) · **`## 11. References` (4704 행 부근 — AC 1 에서 재실측)** — `§ 12.47` 삽입 위치 경계. **그 밖의 절은 열지 않는다** (§7).
- `src/llm/llm-gateway.interface.ts` — **무편집, 읽기만**. `generate` 시그니처 + provider 식별자 타입 정의 구간만 `grep` / `sed` 로 인용.
- `src/llm/llm-http-gateway.service.ts` — **무편집, 읽기만**. provider dispatch 분기 + outbound 호출 지점만 `grep` 인용 (**통독 금지**).
- `src/llm/providers/` — **무편집, 읽기만**. `ls -1` 로 spec 제외 adapter 파일 목록만.
- `src/llm/llm-provider-config-resolver.service.ts` · `src/llm/llm.module.ts` — **무편집, 읽기만**. "Admin 지정 provider 별 model 라우팅" 판정에 필요한 **1 ~ 2 구** 인용까지만.
- `docs/decisions/ADR-0003-deployment.md` — **무편집, 읽기만**. **`### Decision §4` 좌표 + 그 절이 실제로 direct egress 를 결정하는지** 확인까지만 (**파일명 주의 — `ADR-0003-deployment-topology.md` 가 아니다**, `§ 12.45` FU16 이 지적한 표기 drift). 본문 재판정 · status 변경 금지.
- `docs/requirements.md` — **97 행. 무편집, 읽기만**. REQ-049 · REQ-051 ~ 055 의 **실재 + 제목 1 구** 확인용 `grep` 만. 본문 재판정 금지.
- `docs/PLAN.md` — **175 행. 무편집, 읽기만**. `## Phase P4 — External integrations` (**79** 행) + LLM provider 추상화 bullet (**85** 행) 좌표 확인용 `grep` 만.
- `CLAUDE.md` §3 (task 크기 상한) · §3.2 (direct doc-only 면제) · §12 (언어 정책)

## 결과 요약 (2026-08-04 완료)

AC 1 ~ AC 9 **전부 ok**. `LLM Gateway` row (123 행) 의 검증 가능 claim **11** 개를 실측해 **참 8 · 부분참 3 · 거짓 0** 으로 판정했고, 채택안 (B) 대로 **원문 무편집 + T-1448 각주 직후 각주 blockquote 1 개 (5 행) 신설** 했다 (components.md 217 → **223**, 단일 hunk `@@ -148,0 +149,6 @@`, 삭제 0). 부분참 3 건 = **provider 5 종 ↔ adapter 파일 4 개** (`custom` · `openai` 가 `openai-compatible` 공유) · **`generate(prompt, modelId)` 실제는 options 객체** · **outbound 가 adapter 별이 아니라 gateway 191 행 단일 지점**. `ADR-0003 §4 (direct egress)` 는 **drift 0 참** 이라 차기 slice (`GitHub Adapter` + `Confluence Adapter`) 가 승계 가능. audit `§ 12.47` **103 행** append (4717 → **4820**, `### 12.` 46 → 47, `## ` 12 불변 · `| REQ-` 66 불변). 코드 · schema · CI · ADR · PLAN · requirements **무변경**.

## Acceptance Criteria

- [x] **AC 1 — 실측 선행 (날조 금지)**: 편집 전에 다음을 직접 측정해 `§ 12.47` 에 **명령과 출력을 함께** 인용한다. 기대값과 **다르면 그 축의 편집을 중단** 하고 불성립 사실을 `§ 12.47` 에 기록한다 (Why 의 ① ~ ④ 는 가설일 뿐이다).
  - (i) **좌표 + 원문 재확인**: `grep -n '^#\{1,3\} ' docs/architecture/components.md` 로 heading 좌표를 **먼저 실측** 한 뒤 (본 AC 의 `115` · `123` · `149` 도 stale 일 수 있다 — T-1436 ~ T-1448 선례) `sed -n '123p'` 로 row 원문을 인용한다. 이어 **실측으로 참 · 거짓을 가릴 수 있는 claim** (책임 구 · provider 목록 · contract 구 · ADR § 번호 · phase pointer · REQ ID) 만 뽑아 열거하고, 순수 성격 서술은 **검증 불가 claim** 으로 분류해 판정 대상에서 제외한다. 이 이분 자체를 남긴다.
  - (ii) **provider 인벤토리 축**: `ls -1 src/llm/providers/ | grep -v '\.spec\.'` · `find src/llm -name '*.ts' -not -name '*.spec.ts' | wc -l` · provider 식별자 정의 grep (예: `grep -rn 'openai-compatible\|azure_openai\|anthropic\|google_gemini' src/llm --include='*.ts' -l | grep -v spec | head -6` + 해당 union / enum 정의 1 구) 으로 **"5 provider (custom / Azure OpenAI / Anthropic / Google Gemini / OpenAI)"** 를 판정한다. **provider 종수와 adapter 파일 수가 다르면 그 차이 자체가 판정 결과** 이며 (참 / 부분참), 어느 provider 가 어느 adapter 를 공유하는지 1 구로 밝힌다. `custom` 이 별도 adapter 없이 OpenAI 호환 경로를 쓰는지도 실측 근거로 가른다.
  - (iii) **단일 추상화 + 라우팅 축**: `grep -n 'class .*Gateway' src/llm/*.ts | grep -v spec` · `grep -rn 'providers/' src/ --include='*.ts' -l | grep -v spec | head -8` 로 **"단일 추상화 service"** 와 **"평가 파이프라인은 본 gateway 만 호출"** 을 판정한다. 후자는 `src/assessment-evaluation` · `src/assessment-collection` 이 provider adapter 를 **직접 import 하는 hit 이 0 인지** 를 근거로 삼고, hit 이 있으면 그 경로를 인용해 **거짓** 판정한다 (grep 근사임을 1 구로 명시). **"Admin 이 지정한 provider 별 model 식별자 라우팅"** 은 `llm-provider-config-resolver.service.ts` · `llm-http-gateway.service.ts` 의 dispatch 분기 1 ~ 2 구로 판정한다.
  - (iv) **contract 축**: `grep -n 'generate' src/llm/llm-gateway.interface.ts | head -8` + 해당 시그니처 `sed` 인용으로 **`generate(prompt, modelId)`** 구를 판정한다 — **인자 이름 · 개수가 다르면 부분참** 이며 실 시그니처를 그대로 인용한다. **"각 provider 의 외부 HTTPS REST API 로의 outbound"** 는 `grep -rn 'await fetch(' src/llm --include='*.ts' | grep -v spec | wc -l` + 대표 파일 2 개 인용으로 판정한다 (in-process call ↔ 외부 outbound 경계가 실제로 gateway 안에서 갈리는지).
  - (v) **pointer + REQ 축**: `grep -n '^### Decision §' docs/decisions/ADR-0003-deployment.md` · `sed -n '78,82p' docs/decisions/ADR-0003-deployment.md` 로 **`ADR-0003 §4 (direct egress)` 의 § 번호 · 주제 부합** 을 판정하고 (**§ 번호나 주제가 다르면 그 사실이 판정 결과** — 옳은 좌표를 실측 출력으로 함께 인용), `grep -n 'Phase P4\|LLM provider 추상화' docs/PLAN.md | head -4` 로 **`P4 LLM gateway task`** pointer 를 판정한다. REQ 는 `grep -n 'REQ-049\|REQ-05[1-5]' docs/requirements.md | head -8` 로 **6 개 ID 의 실재** 와 괄호 병기 문구 (`Admin LLM 모델 지정` · `5 provider`) 의 실 제목 부합을 판정한다. 판정이 동일한 REQ ID 는 묶어도 된다.
  - (vi) baseline — `wc -l` components.md **217** · audit **4717** · requirements.md **97** · deployment.md **232** · directory.md **203** · modules.md **259** · PLAN.md **175** · prisma/schema.prisma **666**, `grep -c '^## '` components.md **7** · audit **12**, audit `grep -c '^| REQ-'` **66** · `grep -c '^### 12\.'` **46**.
- [x] **AC 2 — 지점 판정표**: AC 1 이 뽑은 **검증 가능 claim** 각각에 대해 `in-place 수정` / `원문 보존 + 각주 부기` / `무편집` / `상위 slice 판정 승계` 중 하나를 판정한 표를 만든다. 각 row 는 **claim 1 구 · 실측 결과 · 판정 (참 / 부분참 / 거짓) · 처리 · 근거 1 구** 5 컬럼이다.
  - **REQ ID 6 개는 판정이 같으면 1 row 로 묶고 ID 를 전부 나열** 해도 무방하다 (묶을 경우 묶음 근거 1 구). **책임 구 · provider 목록 · contract 구 · pointer 는 묶음 금지**.
  - 판정 기준 **3 축** 명시 — ① **문서 성격** (1 ~ 4 행 blockquote 의 P1 T-A3 blueprint 선언 + 이 표가 이미 여러 차례 shipped 현황으로 갱신된 흔적), ② `§ 12.15` **정합** (row 에 시점 marker 가 있는지 실측 grep 근거), ③ **선례** (T-1430 ~ T-1448 의 "원문 보존 + 실측 각주" vs [T-1429](T-1429-api-md-module-vocab-and-uc-range-resync.md) 의 in-place 1:1 치환 vs [T-1436](T-1436-directory-md-web-frontend-section-vs-src-audit.md) 의 혼합 채택).
- [x] **AC 3 — 처리 방식 판정**: 후보 4 개 중 **채택 1 · 기각 3** 인 판정표를 만든다. 기각마다 근거 1 구.
  - 후보 — (A) row 셀 **in-place 동기** (틀린 § 번호 · 낡은 서술 치환), (B) **원문 무편집 + T-1448 각주 blockquote 직후에 각주 blockquote 1 개 신설** (T-1437 ~ T-1448 화법 승계), (C) **혼합** (거짓 판정 지점만 in-place, 나머지는 각주), (D) **전 지점 무편집 + audit 기록만**.
  - 판정 기준 **4 축** 명시 — ① `§ 12.15` 정합, ② **오도 risk** (독자가 이 표만 읽고 provider 종수 · adapter 구조 · gateway 계약 시그니처를 오인할 때의 비용), ③ **cap** — 예상 diff ≤ 300 LOC · 변경 파일 **3 고정** (초과 후보는 자동 기각 + split 제안 기록), ④ **각주 누적 구조 제약** — 표 뒤 blockquote 가 누적되므로 본 slice 는 **4 번째 블록** 이며 첫 구에 **"본 각주는 `LLM Gateway` row 한정"** 을 반드시 명시해야 한다는 점 (5 ~ 6 블록 시점의 배치 규약 재검토는 `§ 12.44` 한계 3 소관으로 본 slice 범위 밖 — 파생 영향에만 기록하되 **본 slice 로 4 블록째라 임계가 임박** 함을 1 구로 남긴다).
- [x] **AC 4 — 채택안 반영**: AC 3 채택안대로만 편집한다. 각 지점은 AC 2 판정 결과를 따른다.
  - **각주 blockquote 는 T-1448 각주 blockquote 마지막 행 (현 147 행) 과 `## GitHub Adapter — 3 instance 묶음 vs 분리 결정` heading (현 149 행) 사이에 삽입** 한다. **각주 blockquote 1 개 (≤ 6 행) + in-place 치환 (≤ 2 지점) 이내**, `wc -l` 증가 **+7 이내** (217 → ≤ 224).
  - **각주 첫 구에 "본 각주는 `LLM Gateway` row 한정" 을 명시** 한다 — 잔여 3 row (`GitHub Adapter` · `Confluence Adapter` · `Scheduler`) 는 미판정임을 독자가 즉시 알 수 있어야 한다.
  - **문구 · 파일 이름 · 시그니처 · 수치 · ADR § 번호 · REQ ID · task ID 는 AC 1 실측 출력과 1:1 일치** 해야 하며, 실측되지 않은 값 (존재하지 않는 adapter, 임의 카운트, 없는 절 번호) 을 **새로 창작하지 않는다**.
  - **1 ~ 4 행 blockquote · 119 ~ 122 행 4 row · 124 ~ 126 행 잔여 3 row · 128 ~ 147 행 기존 각주 3 블록 · 149 행 이후 전 구간 무편집**.
  - **새 pointer 추가 금지** — 본문 · `src/llm/**` · `ADR-0003` · `PLAN.md` · `requirements.md` 외의 문서를 새로 등재하지 않는다 ([ADR-0014](../decisions/ADR-0014-llm-api-key-encryption-at-rest.md) · [ADR-0015](../decisions/ADR-0015-llm-live-integration-test-contract.md) · [ADR-0045](../decisions/ADR-0045-llm-provider-deployment-config.md) 는 **audit 쪽 파생 영향에만** 기록).
  - **secret · API key · endpoint 실 URL · 실 토큰을 문서에 옮겨 적지 않는다** (CLAUDE.md §9) — `LLM_LIVE_*` · `LLM_APIKEY_ENC_KEY` 등은 **변수명 언급까지만**, 값 인용 금지.
- [x] **AC 5 — audit `§ 12.47` 신설**: [REQ-COVERAGE-AUDIT.md](../use-cases/REQ-COVERAGE-AUDIT.md) 의 `## 11. References` **직전** 에 `### 12.47 …` 절을 **순수 append** 한다 (기존 절 수정 0). 구성 — 본 절의 위치 · 계보 1 문단 (**T-1448 FU1 1 순위 "3 adapter 묶음" 의 split 첫 slice** 임과 split 근거) / AC 1 실측 (명령 + 출력) / AC 2 지점 판정표 / AC 3 처리 판정표 / AC 4 반영 결과 + 무편집 경계 / **Component table 잔여 미판정 row 목록** (`GitHub Adapter` · `Confluence Adapter` · `Scheduler` **3 row** — 다음 slice 1 순위 = **`GitHub Adapter` + `Confluence Adapter` 2 row 묶음** + 본 절의 `ADR-0003 §4` 판정 승계 가능 여부 1 구) / 파생 영향 (목록만) / 불변 검산 / 한계. **절 전체 ≤ 115 행** (초과 시 실측 인용을 요약형으로 압축하고 압축 사실을 한계에 명시).
  - `###` 레벨이라 `grep -c '^## '` **12 불변** · `grep -c '^| REQ-'` **66 불변** · `grep -c '^### 12\.'` **46 → 47**.
- [x] **AC 6 — 불변 검산**: 다음을 실행해 출력을 `§ 12.47` 에 인용한다. `wc -l` components.md (217 → ≤ 224) · audit (4717 → +115 이내) · **`prisma/schema.prisma` 666 불변** · deployment.md (**232 불변**) · directory.md (**203 불변**) · modules.md (**259 불변**) · PLAN.md (**175 불변**) · requirements.md (**97 불변**), `git diff -U0 -- docs/architecture/components.md | grep '^@@'` 로 **hunk 개수 · 위치** 를 보이고 AC 4 허용 구간 밖 hunk **0** 을 실증, `git diff --numstat` 으로 **순수 삭제 0** (삭제 행이 있으면 in-place 치환의 짝임을 1 구로 설명), `git status --porcelain src/ test/ web/ prisma/ deploy/ docker-compose.yml Dockerfile .github/ package.json README.md .claude/ docs/decisions/ docs/ops/ docs/PLAN.md docs/requirements.md` **빈 출력** (코드 · schema · frontend · 배포자산 · CI · 의존성 · ADR · PLAN · requirements 무변경), `git status --porcelain` 이 **3 파일 이내** 임을 확인.
- [x] **AC 7 — 파생 영향 기록 (목록만, 본 slice 편집 금지)**: `§ 12.47` 말미에 후속 slice 대상을 목록으로 남긴다. 최소 포함 — (1) **Component table 잔여 3 row** + 다음 slice 1 순위 (`GitHub Adapter` + `Confluence Adapter` 2 row 묶음 — egress 축 승계 근거 1 구, `Scheduler` 는 후순위), (2) **표 뒤 각주 blockquote 누적 배치 규약 재검토** (`§ 12.44` 한계 3 — 본 slice 로 **4 블록째**, 예고된 5 ~ 6 블록 임계 임박), (3) `## Deployment 컨텍스트` (22 ~ 26 행 — "모든 8 component 는 동일 process" claim, T-1445 FU1 차순위로 **4 회째 이월**), (4) `## Component diagram` mermaid node ↔ 실 module 대조, (5) **LLM provider 배포 config ADR 3 종 (`ADR-0014` · `ADR-0015` · `ADR-0045`) 이 row 의 pointer 셀에 미등재** — 본 절이 실측한 사실이며 pointer 보강은 별도 slice 소관, (6) `@nestjs/config` 미도입 전수 sweep (`§ 12.39` FU3 미소진, ADR 게이트), (7) reviewer 규약 미이행 (`.claude/agents/reviewer.md` REQ-032 0 hit — `§ 12.41` FU2 미소진), (8) `deploy/README.md` ↔ deployment.md ↔ runbook 3 자 정합 (`§ 12.41` FU3 미소진), (9) README 행 번호 pointer drift 전수 sweep, (10) REQ 번호 체계 잔재 전수 sweep (`§ 12.38` FU3 미소진), (11) `CLAUDE.md` §1 pointer 부정확 (T-1442 FU3 미소진), (12) UC-09 `§ 5` sequence participant 병기 (32 회째 이월), (13) 정본 [modules.md](../architecture/modules.md) 카운트 claim 대조 (`§ 12.34` FU1 미소진, ADR 게이트), (14) 행 번호 → anchor 좌표계 이행 (26 회째), (15) `§ 12.44` 미해결 한계 — "mutation 러너 26 개" 정의 미확정 (`pr` mode drift-guard spec 소관), (16) `Scheduler` cron → 평가 pipeline 미결선 (`§ 12.45` FU15 — **코드 소관, `pr` task 로만 처리 가능**), (17) `ADR-0003` 의 "단일 DB 인스턴스" 좌표 부재 (`§ 12.46` FU16 — ADR 소관 별도 task).
- [x] **AC 8 — R-110 / R-112 면제 근거 명시**: 본 task 는 `commitMode: direct` doc-only 로 production code **0 LOC** · 분기 **0** 이라 [CLAUDE.md](../../CLAUDE.md) §3.2 direct-mode 면제 조항에 따라 tester 호출 · happy / error / flow / negative 4 항목 · `pnpm test:cov` 가 **N/A** 임을 `§ 12.47` 에 1 구로 명시한다.
- [x] **AC 9 — 언어 · 링크 규약**: 추가 문장은 모두 한국어 (§12), 문서 간 참조는 상대경로 markdown 링크, 수치는 실측 출력과 1:1 일치. **ADR-0003 파일 경로는 `docs/decisions/ADR-0003-deployment.md`** 로만 적는다 (`§ 12.45` FU16 이 지적한 `-deployment-topology.md` 표기 drift 재발 금지).

## Out of Scope

- **코드 · schema · frontend · 배포 자산 · CI · agent 정의 변경 절대 금지** — `src/` · `web/` · `test/` · `prisma/` · `scripts/` · `deploy/` · `docker-compose.yml` · `Dockerfile` · `.github/workflows/` · `package.json` · `.claude/agents/` 는 diff 에 등장하면 안 된다. **adapter 추가 · rename 으로 문서를 맞추는 행위 금지** (문서를 실제에 맞출 뿐, 실제를 문서에 맞추지 않는다).
- **Component table 잔여 3 row 판정 · 편집 금지** — `GitHub Adapter` · `Confluence Adapter` · `Scheduler` 는 후속 slice 소관이며 본 slice 에서 손대면 cap 이 즉시 깨진다 (본 task 의 split 근거 자체).
- **`Web UI` · `Backend API` · `Worker` · `DB Persistence` row (119 ~ 122 행) 재판정 금지** — `§ 12.44` ~ `§ 12.46` 이 이미 닫았다. 필요 시 판정 승계 인용까지만.
- **components.md 149 행 이후 전 구간 편집 금지** — `## GitHub Adapter …` · `## Contracts` 표 · `## References` · mermaid diagram 무편집.
- **1 ~ 4 행 blockquote · 128 ~ 147 행 T-1446 / T-1447 / T-1448 각주 편집 금지** — 인용 · 화법 참조까지만.
- **`docs/PLAN.md` · `docs/requirements.md` 편집 금지** — pointer / REQ 실재 확인용 grep 인용까지만.
- **ADR-0003 · ADR-0014 · ADR-0015 · ADR-0045 본문 재판정 · status 변경 금지** — 파일 실재 + § 좌표 실측까지만. **§ 번호 drift 를 발견해도 ADR 을 고치지 않는다** (components.md 쪽 판정 · 각주로만 처리).
- **[modules.md](../architecture/modules.md) · [INDEX.md](../architecture/INDEX.md) · [deployment.md](../architecture/deployment.md) · [directory.md](../architecture/directory.md) · [api.md](../architecture/api.md) 편집 금지** — 정합 판정 필요 사실은 파생 영향 목록에만 남긴다 (**modules.md 259 행 · deployment.md 232 행 · directory.md 203 행 불변**).
- **LLM provider 실호출 · live spec 실행 금지** — 외부 네트워크 호출 · Ollama · Azure 등 어느 provider 도 부르지 않는다 (측정은 전부 read-only grep / ls / find / sed / wc / git).
- **빌드 · 테스트 · 설치 실행 금지** — `pnpm install` · `pnpm build` · `pnpm test` 어느 것도 실행하지 않는다.
- **다른 문서로의 cascade 금지** — [use-cases/INDEX.md](../use-cases/INDEX.md) · `UC-01` ~ `UC-09` · ADR · [README.md](../../README.md) 는 무편집.
- **각주 배치 규약 자체의 재설계 금지** — `§ 12.44` 한계 3 이 제기한 "표 뒤 나열 vs row 별 anchor" 재검토는 파생 영향 목록에만 남긴다 (4 블록째 임계 임박 사실만 기록).
- **행 번호 → anchor 좌표계 이행 금지** — 파생 영향 목록에만 남긴다 (26 회째 이월).
- **CI drift-guard spec 작성 금지** — `pr` mode 소관이라 본 direct task 에서 진행하면 §3.1 위반.
- **audit 기존 절 (`§ 12.1` ~ `§ 12.46`) 수정 금지** — `§ 12.47` 순수 append 만.

## Suggested Sub-agents

`implementer` 단독 (doc-only, 코드 0 LOC — architect · tester 불요. §3.2 direct-mode 면제).

## Follow-ups

(생성 시점 비어 있음 — sub-agent 가 관련 작업을 발견하면 여기에 append 한다.)
