---
id: T-1628
title: ADR-0057 D1 부하용 stub LLM gateway 구현 class 박제 (binding 0)
phase: P5
status: DONE
commitMode: pr
coversReq: [REQ-047]
estimatedDiff: 250
estimatedFiles: 2
created: 2026-08-20
completedAt: 2026-08-20T19:50:00Z
independentStream: r91-load-harness
dependsOn: [T-1627]
touchesFiles:
  - src/llm/llm-stub-gateway.service.ts
  - src/llm/llm-stub-gateway.service.spec.ts
plannerNote: R-91 chain 9/N — ADR-0057 D1 의 stub gateway 구현체만 박제, DI binding·workflow 는 후속 slice (2 파일, 호출처 0)
---

# T-1628 — ADR-0057 D1 부하용 stub LLM gateway 구현 class 박제 (binding 0)

## Why

[PLAN.md](../PLAN.md) `144 행` 의 오너 지시(R-91 k6 부하검증 최우선) chain 9/N 이다. [ADR-0057](../decisions/ADR-0057-s1-batch-load-io-isolation.md) `## 범위 밖` 첫 항목이 남긴 "`src/` stub 배선 구현 — env 판정 helper + **stub gateway class** + module binding" 3 조각 중, 판정 helper 는 T-1627 이 닫았고 본 slice 는 **가운데 조각(구현 class)** 만 박제한다.

부하 job 은 LLM API key 가 없는 credential 0 환경이라(ADR-0057 `## Context` 사실 2) 실 gateway 로는 S1 배치 부하가 아예 발화하지 못한다. `LlmGateway` 계약을 만족하면서 외부 왕복이 0 인 구현체가 있어야 D2 진입점(`POST /api/assessment-evaluation/unevaluated-fill-run`) 타격이 성립한다.

본 slice 는 **class 만** 만들고 어떤 module 의 `providers` 에도 등록하지 않는다 — 호출처 0 이라 실행 경로 변화 0 이며, `LLM_GATEWAY` binding 분기(`assessment-evaluation.module.ts`)와 `test/load/s1-batch.js` · `load-k6.yml` 은 후속 slice 로 남긴다(T-1627 이 검증한 "얇은 조각 먼저" 승계).

## Required Reading

- [docs/decisions/ADR-0057-s1-batch-load-io-isolation.md](../decisions/ADR-0057-s1-batch-load-io-isolation.md) — `## Decision` D1(env 기반 stub 주입 · fail-safe default OFF), `## Consequences` 부정 1·3
- [src/llm/llm-gateway.interface.ts](../../src/llm/llm-gateway.interface.ts) — `LlmGateway` / `LlmGenerateOptions` / `LlmGenerateResult` / `LlmProvider` / `LLM_GATEWAY`
- [src/common/load-test-stub-gating.ts](../../src/common/load-test-stub-gating.ts) — T-1627 이 박제한 활성 판정(본 slice 는 **호출하지 않는다** — 판정은 binding slice 책임)
- [src/llm/llm-http-gateway.service.ts](../../src/llm/llm-http-gateway.service.ts) `74~110 행` — 실 구현체의 class 형태·`generate` 시그니처(형태만 mirror, 로직은 승계 금지)
- [docs/tasks/T-1627-load-test-stub-gating-helper.md](T-1627-load-test-stub-gating-helper.md) — 직전 slice 의 경계 설정(Out of Scope 승계 관계)

## Acceptance Criteria

- [x] `src/llm/llm-stub-gateway.service.ts` 신설 — `@Injectable()` 이 붙은 `LlmStubGateway` 가 `LlmGateway` 를 `implements` 한다. 생성자 의존 0(repository · cipher · fetch · env 접근 전부 없음), 외부 HTTP 호출 0, timer/random 0 으로 **동일 입력 → 동일 출력** 이 보장된다.
- [x] `generate(prompt, options)` 계약: 정상 입력이면 `LlmGenerateResult` 를 resolve 하고 `provider` 는 `LlmProvider.Custom`, `modelId` 는 `options.modelId` 를 그대로 echo 하며, `narrative` 는 stub 산출임이 식별되는 고정 prefix(예 `[load-test-stub]`) 로 시작한다.
- [x] 분기 2 개를 명시적으로 둔다 — (a) `options.difficulty` 가 주어지면 narrative 에 그 난이도 표기가 포함되고, (b) 미제공이면 포함되지 않는다. 그 외 조건 분기는 추가하지 않는다.
- [x] 잘못된 입력은 `BadRequestException`(`@nestjs/common`) 으로 reject 한다 — 빈/공백-only `prompt`, 빈/공백-only `options.modelId`. 어떤 경우에도 실 gateway 로 fall-through 하거나 조용히 기본값을 만들어내지 않는다.
- [x] **happy-path unit test 1+** — `generate` 가 `narrative` / `provider` / `modelId` 3 필드를 계약대로 반환하는지, 그리고 동일 입력 2 회 호출이 동일 결과인지(결정성) 검증.
- [x] **error path unit test 1+** — 빈 `prompt`, 공백-only `prompt`, 빈 `modelId` 각각이 `BadRequestException` 으로 reject 되는지 검증(`rejects.toThrow`).
- [x] **분기 cover** — 위 (a) difficulty 제공 / (b) 미제공 두 분기 각각 1+ test.
- [x] **negative cases 충분 cover** — 공백-only `modelId`, `difficulty` 가 빈 문자열인 경우, 매우 긴 prompt(경계값), 특수문자/한국어 prompt, `undefined` 를 명시 전달한 `difficulty` 등 예외·경계 상황 각 1+ test. 추가로 **외부 I/O 0 negative** — `globalThis.fetch` 를 throw 하는 spy 로 갈아끼운 상태에서도 `generate` 가 정상 resolve 되는지(즉 fetch 를 부르지 않는지) 검증.
- [x] colocated spec 경로는 정확히 `src/llm/llm-stub-gateway.service.spec.ts` 다(NestJS convention + `scripts/check-spec-presence.sh` 정합).
- [x] `pnpm lint && pnpm build && pnpm test` 전량 green, `pnpm test:cov` 통과(line ≥ 80% / function ≥ 80%) — 신규 파일은 line · branch · function 100% 목표.
- [x] 신규 dependency 0 — `package.json` / lockfile 무변경. 기존 파일 수정 0(신규 2 파일만).

## Out of Scope

- `LLM_GATEWAY` token 의 binding 분기 — `assessment-evaluation.module.ts` / `llm.module.ts` 의 `providers` · `exports` 수정과 `isLoadTestStubEnabled()` 호출은 **다음 slice**. 본 task 는 class 를 어디에도 등록하지 않는다.
- `test/load/s1-batch.js` 신설, `load-k6.yml` step 추가/순서 재배치, `package.json` 의 `test:load:s1`, drift-guard smoke 갱신.
- 수집 축(GitHub/Confluence adapter) 의 stub 구현 — 별도 slice.
- 인위적 지연(latency 시뮬레이션) · 토큰 usage 메타 · provider 별 응답 형태 흉내 — ADR-0057 이 요구하지 않는다.
- `LlmGateway` interface 자체 수정, `LlmGenerateResult` 필드 추가.
- REQ-047 상태 flip(PLANNED 유지), `docs/ops/load-resilience-test-plan.md` 갱신.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(비어 있음 — sub-agent 가 발견 시 append)

## 결과 요약 (2026-08-20 완료)

**DONE** — `pr` 모드, PR [#1306](https://github.com/myungjoo/AA_S1/pull/1306) 라운드 1 APPROVE → 스쿼시 머지 `b6d4d6d9`.

- `src/llm/llm-stub-gateway.service.ts` 신설 — `@Injectable` 인 `LlmStubGateway` 가 `LlmGateway` 계약을 구현하고 `LLM_STUB_NARRATIVE_PREFIX` 상수를 함께 export 한다. 외부 왕복 0 · 의존 0 · 결정적 응답이라 credential 0 인 부하 job 에서도 D2 진입점 타격이 성립한다.
- `generate` 계약은 ADR-0057 `D1` 그대로 — provider 는 `Custom`, `modelId` 는 입력 echo, narrative 는 stub prefix 로 시작. `difficulty` 유/무 2 분기만 두고, 빈 · 공백-only `prompt` / `modelId` 는 `BadRequestException` 으로 거절한다.
- colocated spec 18 test 로 R-112 4 종(happy / error path / 분기 / negative 충분 cover — 공백 modelId · 빈 difficulty · 20k 자 prompt · 특수문자 · type mismatch · fetch 미호출) 고정. 신규 파일 line · branch · function 100%, 전체 443 suite / 12727 test green.
- **호출처 0** — 어떤 module 의 `providers` 에도 등록하지 않았다. `LLM_GATEWAY` binding 분기 · `test/load/s1-batch.js` · `load-k6.yml` 은 Out of Scope 그대로 후속 slice 라 본 commit 만으로 바뀌는 실행 경로 없음. 신규 dependency 0 · 기존 파일 수정 0(신규 2 파일만, +290/-0).
