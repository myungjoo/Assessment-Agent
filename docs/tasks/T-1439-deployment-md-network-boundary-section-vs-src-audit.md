---
id: T-1439
title: deployment.md `## 외부 네트워크 boundary` 전반부 (151 ~ 180 행 — 도입 문단 · `### 접근 대상 목록` · `### 지원 LLM 환경` · `### TLS / 사내 인증서 처리`) 의 검증 가능 claim ↔ 실 `src/github/` · `src/confluence/` · `src/llm/` · `deploy/` 대조 + T-1438 Follow-up 1 계승 + audit §12.37
phase: P5
status: PENDING
commitMode: direct
coversReq: [REQ-005, REQ-006, REQ-007, REQ-016]
estimatedDiff: 200
estimatedFiles: 3
created: 2026-08-04
independentStream: uc-doc-audit-resync
dependsOn: [T-1438]
touchesFiles:
  - docs/architecture/deployment.md
  - docs/use-cases/REQ-COVERAGE-AUDIT.md
  - docs/tasks/T-1439-deployment-md-network-boundary-section-vs-src-audit.md
plannerNote: "uc-doc-audit-resync 51 번째 slice — T-1438 Follow-up 1 (`## 외부 네트워크 boundary`) 1 순위 계승, 단락이 47 행이라 전반부 4 절만. doc-only 1.6x"
---

# T-1439 — deployment.md `## 외부 네트워크 boundary` 전반부 ↔ 실 adapter · deploy config 대조

## Why

[T-1438](T-1438-deployment-md-scheduler-section-vs-src-audit.md) 이 [deployment.md](../architecture/deployment.md) 의 `## Scheduler 위치` 단락을 닫으면서 ([REQ-COVERAGE-AUDIT.md](../use-cases/REQ-COVERAGE-AUDIT.md) `§ 12.36`) **잔여 미대조 4 단락 중 `## 외부 네트워크 boundary` 를 다음 slice 1 순위** 로 지정했다 (T-1438 Follow-up 1). 근거는 이 단락이 접근 대상 host 목록 · TLS / proxy 환경변수 · 권한 부족 흐름을 열거해 **실 `src/github/` · `src/confluence/` · `src/llm/` · `deploy/` 와 대조 가능한 claim 밀도가 가장 높다** 는 것이다.

다만 본 단락은 **151 ~ 197 행 (47 행) · 하위 5 절** 로 직전 slice 들보다 크다. 한 slice 에 전수 대조를 넣으면 audit 절이 cap 을 넘기므로 **전반부 4 구간 (151 ~ 180 행) 만** 본 slice 의 대조 범위로 자른다 — 도입 문단 (직접 outbound 채택) · `### 접근 대상 목록` 표 (9 row) · `### 지원 LLM 환경 = 배포 config` · `### TLS / 사내 인증서 처리`. 후반부 (`### 권한 부족 (REQ-020) 감지 흐름` 181 ~ 192 행 · `### 운영 호스트 가정` 193 ~ 197 행) 는 **다음 slice 소관** 으로 명시 이월한다.

planner 사전 확인 — **아래는 전부 가설이며 전제가 아니다** (T-1437 Follow-up 4 의 박제: planner 기대가 실측에 반증된 선례가 있다). executor 는 AC 1 에서 전부 재측정하고, **기대와 다르면 그 축의 편집을 중단** 한다. ① 표의 GitHub 3 host 는 `src/github/github-live-test-gating.ts` 등에 실재할 가능성이 높아 **참** 쪽. ② Confluence row 의 "confluence.sec.samsung.net (+ 추가 사내 Confluence)" 는 실 코드가 host 고정 대신 **base URL 주입형** 일 가능성 — 그러면 **부분참**. ③ LLM provider 5 종 row 의 `(LLM provider — REQ TBD, P2 가 requirements.md 에 추가 시 부여)` 는 [ADR-0045](../decisions/ADR-0045-llm-provider-deployment-config.md) 이후 provider 열거가 shipped 라 **REQ TBD 표기 자체가 낡았을** 가능성. ④ 도입 문단의 "별도 egress proxy / NAT gateway 없음 · 직접 outbound" 는 실 adapter 가 `globalThis.fetch` 직접 호출이라 **참** 쪽. ⑤ `### TLS / 사내 인증서 처리` 의 `NODE_EXTRA_CA_CERTS` / `HTTPS_PROXY` / `NO_PROXY` 는 `deploy/env.prod.example` · `deploy/README.md` 에 이미 등재돼 **shipped** 일 가능성 — 그렇다면 "환경변수 사용" 서술은 참이되 **미shipped 인상을 주는 시점 서술이 있으면** 그 부분만 부분참.

[PLAN.md](../PLAN.md) 의 미완 bullet (106 · 108 · 109 · 140 · 151) 은 owner 게이트 · 외부 credential · 새 dependency 게이트라 planner 단독 진행 불가이므로, 본 doc stream 이 현 시점 우선순위 최상위다.

## Required Reading

- `docs/architecture/deployment.md` — **197 행**. 다음 구간만 읽는다.
  - **151 ~ 180 행** (`## 외부 네트워크 boundary` heading + 153 행 ADR-0003 §4 pointer + 155 행 채택 선언 + `### 접근 대상 목록` 표 + `### 지원 LLM 환경 = 배포 config (provider-중립)` + `### TLS / 사내 인증서 처리`) — 본 slice 의 **주 편집 후보 구간**.
  - **181 ~ 197 행** (`### 권한 부족 (REQ-020) 감지 흐름` · `### 운영 호스트 가정`) — **무편집, 읽기만**. 범위 경계 확인 + 다음 slice 이월 목록 작성용.
  - **1 ~ 4 행** (문서 성격 선언 blockquote — "본 문서는 P1 T-A2 의 산출물") — **무편집**, 판정의 최강 제약.
  - **50 ~ 80 행 · 107 ~ 150 행** (T-1437 · T-1438 이 삽입한 각주 blockquote) — **무편집**. 각주 화법 선례 참고 + 중복 각주 회피 판정 입력.
- `docs/use-cases/REQ-COVERAGE-AUDIT.md` — **3623 행**. **`### 12.15`** (시점 기록 append-only 처리 방침 정본) · **`### 12.36`** (**3504** 행 — T-1438 판정표 화법 template + 각주 1 블록 채택 선례 + 잔여 미대조 4 이월 선언 + Follow-up 1) · **`## 11. References` (3610 행)** — `§ 12.37` 삽입 위치 경계.
- `src/github/github-instance-config.ts` · `src/github/github-live-test-gating.ts` · `src/github/github-request.builder.ts` — **무편집, 읽기만**. GitHub 3 host 축 판정 입력.
- `src/confluence/confluence-instance-config.ts` — **무편집, 읽기만**. Confluence host / base URL 축 판정 입력.
- `deploy/env.prod.example` — **무편집, 읽기만**. TLS / proxy 환경변수 축 (`NODE_EXTRA_CA_CERTS` · `HTTPS_PROXY` · `NO_PROXY`) 판정 입력.
- `CLAUDE.md` §3 (task 크기 상한) · §3.2 (direct doc-only 면제) · §12 (언어 정책)

## Acceptance Criteria

- [ ] **AC 1 — 실측 선행 (날조 금지)**: 편집 전에 다음을 직접 측정해 `§ 12.37` 에 **명령과 출력을 함께** 인용한다. 기대값과 **다르면 그 축의 편집을 중단** 하고 불성립 사실을 `§ 12.37` 에 기록한다 (Why 의 ① ~ ⑤ 는 가설일 뿐이다).
  - (i) **단락 원문 + 좌표 재확인**: `grep -n '^#\{1,3\} ' docs/architecture/deployment.md` 로 heading 좌표를 **먼저 실측** 한 뒤 (본 AC 의 `151 ~ 180 행` 도 stale 일 수 있다 — T-1436 · T-1437 · T-1438 선례) 해당 범위를 `sed -n` 으로 인용한다. 이어 **실측으로 참·거짓을 가릴 수 있는 claim** (host 문자열 · provider 열거 · 환경변수 이름 · 등재 파일 실재 · shipped 여부) 만 뽑아 열거하고, 순수 설계 의도 · 운영 가정 서술은 **검증 불가 claim** 으로 분류해 판정 대상에서 제외한다. 이 이분 자체를 남긴다.
  - (ii) **GitHub host 축 (표 3 row)**: `grep -rn "github.sec.samsung.net\|github.ecodesamsung.com\|github.com" src/github --include='*.ts' | grep -v spec | head -15` 1 회로 실 코드의 host 문자열을 인용하고 표의 3 row 와 대조한다. 판정은 `참 / 부분참 / 거짓` 중 하나.
  - (iii) **Confluence 축 (표 1 row)**: `grep -n "baseUrl\|host\|samsung" src/confluence/confluence-instance-config.ts | head -15` 로 Confluence instance 식별이 **고정 host 열거형인지 base URL 주입형인지** 판정한다. 주입형이면 표의 "confluence.sec.samsung.net" 이 **예시값** 인지 **하드코딩 가정** 인지 1 구로 구분해 적는다.
  - (iv) **LLM provider 축 (표 5 row + `### 지원 LLM 환경`)**: `grep -rn "azure\|anthropic\|gemini\|openai\|custom" src/llm --include='*.ts' | grep -v spec | grep -i "provider" | head -12` 로 실 provider 열거를 인용하고 표의 5 종 · 산문의 5 종과 **개수 · 명칭 두 축** 으로 대조한다. 이어 `grep -c "REQ-0" docs/requirements.md` + `grep -n "LLM" docs/requirements.md | head -5` 로 표의 `(LLM provider — REQ TBD, P2 가 requirements.md 에 추가 시 부여)` 표기가 **여전히 유효한지** 판정한다 (LLM 관련 REQ 가 부여됐다면 `REQ TBD` 는 stale).
  - (v) **직접 outbound 축 (도입 문단)**: `grep -rn "globalThis.fetch" src --include='*.ts' | grep -v spec | head -8` + `grep -rn "axios\|undici\|HttpModule\|ProxyAgent" src --include='*.ts' | grep -v spec | head -8` 를 인용해 "app process 가 직접 outbound · 별도 proxy / bastion 없음" 서술의 참·거짓을 판정한다.
  - (vi) **TLS / proxy 축 (`### TLS / 사내 인증서 처리`)**: `grep -n "NODE_EXTRA_CA_CERTS\|HTTPS_PROXY\|HTTP_PROXY\|NO_PROXY\|NODE_TLS_REJECT_UNAUTHORIZED" deploy/env.prod.example` + `grep -rn "NODE_TLS_REJECT_UNAUTHORIZED" src scripts --include='*' | head -3` 를 인용해 — 3 환경변수의 **운영 config 등재 여부** 와 `NODE_TLS_REJECT_UNAUTHORIZED=0` 금지 서술의 **위반 실재 여부** 를 판정한다. 위반 hit 0 이면 "위반 0" 을 그대로 기록한다.
  - (vii) **pointer 유효성 축**: `ls docs/decisions/ADR-0003-deployment.md docs/decisions/ADR-0045-llm-provider-deployment-config.md docs/decisions/ADR-0048-default-model-id-source.md 2>&1` 로 단락이 인용한 근거 파일 실재를 확인한다. **ADR 본문 재판정은 하지 않는다** (파일 존재 = pointer 유효까지만).
  - (viii) baseline — `wc -l` deployment.md **197** · audit **3623** · directory.md **203** · modules.md **259**, `grep -c '^## '` deployment.md **6** · audit **12**, audit `grep -c '^| REQ-'` **66** · `grep -c '^### 12\.'` **36**.
- [ ] **AC 2 — 지점 판정표**: AC 1 이 뽑은 **검증 가능 claim** 각각에 대해 `in-place 수정` / `원문 보존 + 각주 부기` / `무편집` / `상위 slice 판정 승계` 중 하나를 판정한 표를 만든다. 각 row 는 **지점 (행) · claim 1 구 · 실측 결과 · 판정 (참 / 부분참 / 거짓) · 처리 · 근거 1 구** 6 컬럼.
  - 판정 기준 **3 축** 명시 — ① **문서 성격** (1 ~ 4 행 blockquote 의 P1 T-A2 blueprint 선언에 `§ 12.15` append-only 제약이 어느 강도로 걸리는가), ② `§ 12.15` **정합** (본 단락에 시점 marker 가 있는지 실측 grep 으로 근거를 둔다), ③ **선례** (T-1430 ~ T-1435 · T-1437 · T-1438 의 "원문 보존 + 실측 각주" vs [T-1429](T-1429-api-md-module-vocab-and-uc-range-resync.md) 의 in-place 1:1 치환 vs [T-1436](T-1436-directory-md-web-frontend-section-vs-src-audit.md) 의 혼합 채택).
  - **표 안 claim 의 처리를 별도 판정** 한다 — `### 접근 대상 목록` 은 markdown 표라 한 셀 수정이 표 정합 (컬럼 폭 · 인접 row 의미) 에 미치는 영향이 산문과 다르다. [T-1435](T-1435-directory-md-mapping-table-columns-vs-src-audit.md) 가 mapping 표 컬럼을 **원문 보존 + 각주** 로 판정한 선례를 승계할지 여부를 **1 구로 논증** 한다.
  - **참 확인 축 (host · 직접 outbound) 과 stale 표기 축 (`REQ TBD`) 의 처리를 분리 판정** 한다 — 전자는 무편집이 자연스럽고 후자는 표기 갱신 여지가 있다. 처리가 갈려도 무방하나 그 이유를 반드시 1 구로 적는다.
- [ ] **AC 3 — 처리 방식 판정**: 후보 4 개 중 **채택 1 · 기각 3** 인 판정표를 만든다. 기각마다 근거 1 구.
  - 후보 — (A) **전 지점 in-place 동기**, (B) **단락 원문 무편집 + 전반부 말미 각주 blockquote 1 개 신설** (T-1437 · T-1438 화법 승계), (C) **혼합** (표는 각주, 산문 stale 표기만 in-place), (D) **전 지점 무편집 + audit 기록만**.
  - 판정 기준 **4 축** 명시 — ① `§ 12.15` 정합, ② **운영 오도 risk** (운영자가 표의 host / 환경변수를 그대로 설정했을 때 실패하는가 — 본 문서는 배포 지시 문서라 risk 가중치가 높다는 점을 1 구로 논증), ③ **cap** — 예상 diff ≤ 300 LOC · 변경 파일 **3 고정** (초과 후보는 자동 기각 + split 제안 기록), ④ 선례 일관성.
- [ ] **AC 4 — 채택안 반영**: AC 3 채택안대로만 편집한다. 각 지점은 AC 2 판정 결과를 따른다.
  - **deployment.md 편집은 각주 blockquote 1 개 (≤ 4 행) + in-place 치환 (≤ 2 지점) 이내** — `wc -l` 증가 **+5 이내** (197 → ≤ 202).
  - **문구·host·환경변수명은 AC 1 실측 출력과 1:1 일치** 해야 하며, 실측되지 않은 동작 (예: 미구현 proxy 처리, 특정 provider 의 default 지정) 을 **새로 창작하지 않는다**.
  - **1 ~ 4 행 blockquote 무편집** · **181 ~ 197 행 (`### 권한 부족 (REQ-020) 감지 흐름` · `### 운영 호스트 가정`) 무편집** · **`## 외부 네트워크 boundary` 밖 전 구간 무편집** (`## 개요` · `## DB / Persistence` · `## 배포 토폴로지` · `## Secret / 자격증명 저장` · `## Scheduler 위치`).
  - **새 pointer 추가 금지** — ADR-0003 · ADR-0045 · ADR-0048 외의 문서를 본문에 새로 등재하지 않는다 (audit 쪽에만 기록).
- [ ] **AC 5 — audit `§ 12.37` 신설**: [REQ-COVERAGE-AUDIT.md](../use-cases/REQ-COVERAGE-AUDIT.md) 의 `## 11. References` (3610 행) **직전** 에 `### 12.37 …` 절을 **순수 append** 한다 (기존 절 수정 0). 구성 — 본 절의 위치 · 계보 1 문단 / AC 1 실측 (명령 + 출력) / AC 2 지점 판정표 / AC 3 처리 판정표 / AC 4 반영 결과 + 무편집 경계 / **T-1438 Follow-up 1 (`## 외부 네트워크 boundary` 진입) 부분 closure 선언** (전반부만 닫고 후반부 2 절 이월임을 명시) / **deployment.md 잔여 미대조 갱신** (단락 4 → 3 + 본 단락 후반부 1 로 표기) / 파생 영향 (목록만) / 불변 검산 / 한계. **절 전체 ≤ 115 행** (cap 준수 — 초과 시 실측 인용을 요약형으로 압축).
  - `###` 레벨이라 `grep -c '^## '` **12 불변** · `grep -c '^| REQ-'` **66 불변** · `grep -c '^### 12\.'` **36 → 37**.
- [ ] **AC 6 — 불변 검산**: 다음을 실행해 출력을 `§ 12.37` 에 인용한다. `wc -l` deployment.md (197 → ≤ 202) · audit (3623 → +115 이내) · directory.md (**203 불변**) · modules.md (**259 불변**), `git diff -U0 -- docs/architecture/deployment.md | grep '^@@'` 로 **hunk 개수 · 위치** 를 보이고 AC 4 허용 구간 밖 hunk **0** 을 실증, `git diff --numstat` 으로 **순수 삭제 0** (삭제 행이 있으면 in-place 치환의 짝임을 1 구로 설명), `git status --porcelain src/ test/ prisma/ web/ deploy/ package.json` **빈 출력** (코드·배포 config 무변경), `git status --porcelain` 이 **3 파일** 임을 확인.
- [ ] **AC 7 — 파생 영향 기록 (목록만, 본 slice 편집 금지)**: `§ 12.37` 말미에 후속 slice 대상을 목록으로 남긴다. 최소 포함 — (1) **본 단락 후반부** (`### 권한 부족 (REQ-020) 감지 흐름` 의 code-block 이 인용하는 `PermissionDeniedEvent` · `NotificationService` · `axios / undici / HttpModule` 표기와 "P4 phase 도입 task 책임" 시점 서술이 실 `src/github/` · `src/confluence/` · `PermissionDeniedRecord` model 과 어긋나는지) 를 **다음 slice 1 순위** 로 지정 + 근거 1 구, (2) deployment.md 잔여 미대조 단락 **3** (`## Secret / 자격증명 저장` · `## DB / Persistence` · `## 개요`) 와 우선순위 1 구, (3) UC-08 `§ 5` 권한 부족 흐름 ↔ 실 emitter 정합 (미대조), (4) UC-09 `§ 5` sequence participant 병기 (21 회째 이월), (5) 정본 [modules.md](../architecture/modules.md) "WebModule 의 frontend 분리" 단락 카운트 claim 대조 (`§ 12.34` Follow-up 1 미소진 — ADR 게이트), (6) 행 번호 → anchor 좌표계 이행 (15 회째), (7) 산문 tally ↔ 실측 CI drift-guard spec (`pr` mode 소관).
- [ ] **AC 8 — R-110 / R-112 면제 근거 명시**: 본 task 는 `commitMode: direct` doc-only 로 production code **0 LOC** · 분기 **0** 이라 [CLAUDE.md](../../CLAUDE.md) §3.2 direct-mode 면제 조항에 따라 tester 호출 · happy / error / flow / negative 4 항목 · `pnpm test:cov` 가 **N/A** 임을 `§ 12.37` 에 1 구로 명시한다.
- [ ] **AC 9 — 언어 · 링크 규약**: 추가 문장은 모두 한국어 (§12), 문서 간 참조는 상대경로 markdown 링크, 수치는 실측 출력과 1:1 일치.

## Out of Scope

- **코드 · 배포 config 변경 절대 금지** — `src/` · `test/` · `prisma/` · `web/` · `scripts/` · `deploy/` · `package.json` 은 diff 에 등장하면 안 된다. 특히 host 목록 확장, provider enum 추가, `NODE_EXTRA_CA_CERTS` 주석 해제, proxy agent 도입은 **어떤 경우에도 하지 않는다** (문서를 코드에 맞출 뿐, 코드를 문서에 맞추지 않는다).
- **테스트 · 빌드 실행 금지** — `pnpm build` · `pnpm test` 어느 것도 실행하지 않는다 (측정만).
- **단락 후반부 (181 ~ 197 행) 편집 금지** — `### 권한 부족 (REQ-020) 감지 흐름` · `### 운영 호스트 가정` 은 다음 slice 소관이며 본 slice 는 파생 영향 목록에만 남긴다.
- **deployment.md 의 `## 외부 네트워크 boundary` 밖 단락 편집 금지** — 잔여 3 단락은 파생 영향 목록에만 남긴다.
- **정본 [modules.md](../architecture/modules.md) · [directory.md](../architecture/directory.md) · [api.md](../architecture/api.md) 편집 금지** — 본 slice 는 deployment.md 전반부 축만 닫는다.
- **ADR-0003 · ADR-0045 · ADR-0048 본문 재판정 · status 변경 금지** — 파일 존재 확인까지만.
- **[requirements.md](../requirements.md) 편집 금지** — LLM provider 의 `REQ TBD` 표기가 stale 로 판정돼도 새 REQ ID 를 부여하거나 requirements.md 를 고치지 않는다 (REQ 신설은 별도 게이트). deployment.md 쪽 표기 처리와 audit 기록까지만.
- **다른 문서로의 cascade 금지** — [components.md](../architecture/components.md) · [data-model.md](../architecture/data-model.md) · `docs/architecture/INDEX.md` · [INDEX.md](../use-cases/INDEX.md) · `UC-01` ~ `UC-09` · ADR · [PLAN.md](../PLAN.md) 는 무편집.
- **행 번호 → anchor 좌표계 이행 금지** — 파생 영향 목록에만 남긴다 (15 회째 이월).
- **CI drift-guard spec 작성 금지** — `pr` mode 소관이라 본 direct task 에서 진행하면 §3.1 위반.
- **audit 기존 절 (`§ 12.1` ~ `§ 12.36`) 수정 금지** — `§ 12.37` 순수 append 만.

## Suggested Sub-agents

`implementer` 단독 (doc-only, 코드 0 LOC — architect · tester 불요. §3.2 direct-mode 면제).

## Follow-ups

1. **`## 외부 네트워크 boundary` 후반부 ↔ 실 `src/` 대조 (다음 slice 1 순위)** — 본 slice 실측 (v) 가 `axios` · `undici` · `HttpModule` **0 hit** 를 확인했으므로 `### 권한 부족 (REQ-020) 감지 흐름` code-block 의 그 표기는 어긋날 가능성이 크다. `PermissionDeniedEvent` · `NotificationService` 심볼 실재 · `PermissionDeniedRecord` model 대조 · "P4 phase 도입 task 책임" 시점 서술 유효성까지 한 slice 로 묶인다 (각주 삽입으로 좌표는 186 ~ 202 행으로 이동).
2. **deployment.md 잔여 미대조 단락 3** — `## Secret / 자격증명 저장` (env 주입 방식이 `deploy/env.prod.example` 과 대조 가능해 2 순위) → `## DB / Persistence` → `## 개요`.
3. **`REQ TBD` 표기의 REQ 부여 판단** — LLM provider 5 종은 shipped 인데 [requirements.md](../requirements.md) 66 REQ 중 전용 REQ 가 **0** 이라 표의 `P2 가 추가 시 부여` 조건절이 영구 미충족 상태다. REQ 신설은 owner 게이트라 본 stream 밖이며, 부여 여부가 정해져야 표기를 고칠 수 있다.
4. **proxy 환경변수의 런타임 존중 여부 검증** — `HTTPS_PROXY` / `NO_PROXY` 가 Node `fetch` (undici) 에서 실제로 적용되는지는 실행 검증이 필요해 본 doc slice 에서 미판정으로 남겼다. smoke 성격이라 `pr` mode 소관.
5. **UC-08 `§ 5` 권한 부족 흐름 ↔ 실 emitter 정합** — 미대조. Follow-up 1 과 같은 심볼 축이라 판정 승계 여지가 있다.
6. **행 번호 → anchor 좌표계 이행** (15 회째 이월) — 본 slice 의 각주 5 행 삽입으로 후반부 2 절이 181 → **186** 행으로 밀려 다음 slice 좌표가 다시 낡는다.
