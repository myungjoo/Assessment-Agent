---
id: T-1355
title: requirements.md 70~74 행 REQ-051~055 LLM provider 상태 컬럼을 실측 shipped 로 재판정
phase: P4
status: PENDING
commitMode: direct
coversReq: [REQ-051, REQ-052, REQ-053, REQ-054, REQ-055]
estimatedDiff: 12
estimatedFiles: 2
created: 2026-08-01
independentStream: requirements-status-resync
dependsOn: []
touchesFiles:
  - docs/requirements.md
  - docs/tasks/T-1355-requirements-llm-provider-status-rejudge.md
plannerNote: "requirements 표 5 LLM provider row 가 PLANNED stale — adapter 4 + enum 5 + gateway 배선 실측으로 DONE 재판정"
---

# T-1355 — requirements.md 70~74 행 REQ-051~055 LLM provider 상태 컬럼을 실측 shipped 로 재판정

## Why

[T-1354](T-1354-plan-p7-perf-verification-evidence.md) 가 Out of Scope 로 남긴 유일한 지목 축이 [requirements.md](../requirements.md) **상태 컬럼의 stale** 이다. 표 66 row 중 **50 row 가 `PLANNED`** 인데, 그 중 상당수는 이미 main 에 merge 돼 있어 표만 읽는 planner 가 "미착수" 로 오독하고 이미 있는 구현을 중복 신설할 위험이 있다. 다만 T-1354 가 지적했듯 **전 row 일괄 flip 은 판정 근거가 row 마다 달라 한 slice 로 묶을 수 없다** — 그래서 본 slice 는 **판정 근거가 완전히 동형인 5 row 묶음** 하나만 처리한다.

대상은 **70~74 행 REQ-051 ~ REQ-055 (LLM provider 5 종)** 다. 이 5 row 는 `P4 | unit | PLANNED` 로 컬럼 값이 동일하고, shipped 여부가 **단일 mechanical 근거**로 판정된다: [llm-gateway.interface.ts](../../src/llm/llm-gateway.interface.ts) 20~26 행의 `LlmProvider` enum **5 멤버**(`custom` / `azure_openai` / `anthropic` / `google_gemini` / `openai`) + [src/llm/providers/](../../src/llm/providers/) 의 adapter **4 파일**(+ 각 colocated spec) + [llm-http-gateway.service.ts](../../src/llm/llm-http-gateway.service.ts) 의 adapter import **4 종** 배선 + [llm-provider-config.controller.ts](../../src/llm/llm-provider-config.controller.ts) 의 CRUD route. 즉 provider 축은 `PLANNED`(= PLAN bullet 만 있음) 가 아니라 merge 완료 상태다. 선례는 [commit d0af5761](../progress/) 의 REQ-022 `DONE` doc-sync — requirements 상태 flip 을 doc-only direct 로 처리한 동형 편집이다.

## Required Reading

- [docs/requirements.md](../requirements.md) **9 행**(상태 enum 정의 — `PLANNED` / `DONE` 의미), **61 행**(REQ-042 — 괄호 부기 marker 표기 선례), **70~74 행**(편집 대상 5 row)
- [src/llm/llm-gateway.interface.ts](../../src/llm/llm-gateway.interface.ts) 20~42 행 (`LlmProvider` enum 5 멤버 + `LLM_PROVIDERS` + `isLlmProvider`)
- [src/llm/llm-http-gateway.service.ts](../../src/llm/llm-http-gateway.service.ts) 30~55 행 (adapter 4 종 import — provider 별 transport 배선 근거)
- [src/llm/llm-provider-config.service.ts](../../src/llm/llm-provider-config.service.ts) 134~205 행 (`isLlmProvider` 로 provider 허용 집합 검증 — 5 값 계약이 런타임까지 도달했다는 근거)
- [docs/tasks/T-1354-plan-p7-perf-verification-evidence.md](T-1354-plan-p7-perf-verification-evidence.md) Out of Scope 절 (본 slice 가 이어받는 지목 근거)

## Acceptance Criteria

- [ ] 편집은 [docs/requirements.md](../requirements.md) **70 · 71 · 72 · 73 · 74 행 5 줄뿐**이며, 각 줄에서 바뀌는 것은 **마지막 `상태` 컬럼 1 개**다. `REQ` / `README 행` / `요약` / `kind` / `구현 위치` / `검증 위치` 6 컬럼은 **글자 무수정**.
- [ ] 5 row 의 상태를 `PLANNED` → `DONE (adapter·gateway 배선, live 는 env-gated)` 로 재판정. 괄호 부기는 61 행 REQ-042 의 표기 선례를 따르고, "mocked unit 은 통과했으나 실 credential live run 은 gating 뒤" 라는 사실을 한 구절로 읽히게 한다.
- [ ] **실측 선행**(편집 전 executor 가 직접 수행, 결과를 commit trail 에 박제):
  - `ls src/llm/providers/*.adapter.ts | wc -l` = **4**
  - `ls src/llm/providers/*.adapter.spec.ts | wc -l` = **4**
  - `grep -c 'from "./providers/' src/llm/llm-http-gateway.service.ts` = **4**
  - `grep -cE '^  (Custom|AzureOpenai|Anthropic|GoogleGemini|Openai) = "' src/llm/llm-gateway.interface.ts` = **5**
  - 수치가 위와 다르면 **문서를 실측에 맞추고**(예: 근거 부족 row 는 `DONE` 대신 `IN_PROGRESS` 로 두고 사유 한 구절) 그 사실을 trail 에 남긴다. 실측 없이 flip 금지.
- [ ] 구조 무손상: `grep -c "" docs/requirements.md` = **97**(줄 수 불변 — 같은 줄 안 편집), `grep -c '^| REQ-' docs/requirements.md` = **66**(row 수 불변), 편집 대상 5 행 각각의 `|` 개수 = **8**(컬럼 수 불변) 모두 편집 전후 동일.
- [ ] 잔여 stale 이 남았다는 사실을 **날조하지 않고** 확인만: 편집 후 `grep -c 'PLANNED' docs/requirements.md` 가 **50 → 45** 로 줄었음을 trail 에 기록(9 행의 enum 정의 1 hit 포함 수치). 다른 row 는 본 slice 에서 손대지 않는다.
- [ ] `git diff --name-only` 결과가 [docs/requirements.md](../requirements.md) 와 본 task 파일 **2 개뿐** — `src/` · `web/` · `test/` · `.github/` · `docs/PLAN.md` · `docs/architecture/` · `docs/STATE.json` 무수정.
- [ ] doc-only `commitMode: direct` 라 R-110 tester 면제 — 위 grep 검증으로 대체하고 그 사실을 commit trail 에 명시.

## Out of Scope

- **나머지 45 개 `PLANNED` row 의 상태 재판정** — row 마다 판정 근거가 달라 한 slice 로 묶으면 cap 초과 + 근거 없는 일괄 flip 위험. 동형 묶음 단위로 별도 slice.
- **REQ-047 / REQ-048(66~67 행, 성능)** 상태 flip — [T-1354](T-1354-plan-p7-perf-verification-evidence.md) 가 "실 DB round-trip baseline 미실측이라 미승격" 으로 이미 판정했다. 본 slice 는 건드리지 않는다.
- **`검증 위치` 컬럼 갱신**(`unit` → `unit + smoke` 등) — 상태 판정과 판정 기준이 다르고 live smoke 의 gating 조건 확인이 별도로 필요하다. 별도 slice 책임.
- [docs/PLAN.md](../PLAN.md) 의 P4 LLM bullet · [docs/architecture/](../architecture/) 문서 동기화 — 본 slice 는 requirements 표 1 파일만.
- `src/llm/` 코드 · adapter · spec 변경, 새 provider 추가, live credential 실행.
- 표에 각주 행 · 새 컬럼 · 편집 주 블록을 **추가**하는 것(줄 수 불변 조건과 충돌).

## Suggested Sub-agents

`implementer` (doc-only 단일 표 편집 — architect · tester 불요)

## Follow-ups

(작성 시점 비어 있음 — sub-agent 가 관련 작업을 발견하면 여기에 추가)
