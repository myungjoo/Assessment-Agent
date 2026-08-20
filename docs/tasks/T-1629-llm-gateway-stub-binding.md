---
id: T-1629
title: ADR-0057 D1 LLM_GATEWAY binding 을 env 기반 stub 분기로 배선
phase: P5
status: DONE
completedAt: 2026-08-20T21:52:16Z
commitMode: pr
coversReq: [REQ-047]
estimatedDiff: 210
estimatedFiles: 4
created: 2026-08-20
independentStream: r91-load-harness
dependsOn: [T-1628]
touchesFiles:
  - src/llm/llm.module.ts
  - src/llm/llm.module.spec.ts
  - src/assessment-evaluation/assessment-evaluation.module.ts
  - src/assessment-evaluation/assessment-evaluation.module.spec.ts
plannerNote: R-91 chain 10/N — ADR-0057 D1 의 마지막 조각(module binding) 배선, fail-safe default OFF 를 R-112 negative 로 고정 (4 파일)
---

# T-1629 — ADR-0057 D1 LLM_GATEWAY binding 을 env 기반 stub 분기로 배선

## Why

[PLAN.md](../PLAN.md) `141 행` 의 R-91(배치 1h, REQ-047) 축은 오너 지시(`144 행`)로 최우선
착수 중이며, [ADR-0057](../decisions/ADR-0057-s1-batch-load-io-isolation.md) `## 범위 밖`
첫 항목이 남긴 `src/` stub 배선 3 조각 — env 판정 helper(T-1627 완료) · stub gateway
구현 class(T-1628 완료) · **module binding** — 중 마지막 조각이 본 slice 다.

ADR-0057 `D1` 이 확정한 대로 격리는 "새 class 를 프로덕션 경로에 끼워 넣는 일이 아니라
기존 `LLM_GATEWAY` token 의 binding 을 env 로 고르는 일" 이다. 현재 binding 은
[assessment-evaluation.module.ts](../../src/assessment-evaluation/assessment-evaluation.module.ts)
`149 행` 의 `useExisting: LlmHttpGateway` 단일 고정이라, T-1627/T-1628 이 박제한 두 부품은
아직 호출처 0 이다. 본 slice 가 그 둘을 이어 붙이면 부하 job 이 credential 0 상태에서 D2
진입점(`POST /api/assessment-evaluation/unevaluated-fill-run`)을 때릴 수 있게 된다.

핵심 안전 요건은 ADR-0057 `## Consequences` 부정 3(stub 오활성 risk)이 지목한 **fail-safe
default OFF** 다 — env 미설정·다른 값이면 반드시 실 `LlmHttpGateway` 로 fall-through 해야
하며, 본 slice 는 그 분기를 R-112 negative test 로 고정한다.

## Required Reading

- [docs/decisions/ADR-0057-s1-batch-load-io-isolation.md](../decisions/ADR-0057-s1-batch-load-io-isolation.md) — `D1`(env 기반 stub gateway 주입 · fail-safe default OFF) + `## 범위 밖` 첫 항목
- [src/common/load-test-stub-gating.ts](../../src/common/load-test-stub-gating.ts) — `LOAD_TEST_STUB_ENV` 상수 + `isLoadTestStubEnabled(env = process.env)` 시그니처 (T-1627)
- [src/llm/llm-stub-gateway.service.ts](../../src/llm/llm-stub-gateway.service.ts) — `@Injectable() LlmStubGateway`(의존 0, `LlmGateway` 구현) (T-1628)
- [src/llm/llm.module.ts](../../src/llm/llm.module.ts) — `providers` / `exports` 배열 (등록 대상)
- [src/llm/llm.module.spec.ts](../../src/llm/llm.module.spec.ts) — module compile spec 패턴 (PrismaService jest.mock 선례)
- [src/assessment-evaluation/assessment-evaluation.module.ts](../../src/assessment-evaluation/assessment-evaluation.module.ts) — `145~152 행` 의 `LLM_GATEWAY` → `LlmHttpGateway` `useExisting` 바인딩
- [src/assessment-evaluation/assessment-evaluation.module.spec.ts](../../src/assessment-evaluation/assessment-evaluation.module.spec.ts) — 기존 module spec 구조 (본 slice 가 확장)

## Acceptance Criteria

- [x] `src/llm/llm.module.ts` 의 `providers` 와 `exports` 에 `LlmStubGateway` 를 등록한다 — 의존 0 인 class 라 추가 module import 0. 등록 이유(ADR-0057 `D1` 의 binding 조각) 를 한국어 주석 1~3 줄로 남긴다.
- [x] `src/assessment-evaluation/assessment-evaluation.module.ts` 의 `LLM_GATEWAY` 바인딩을 `useExisting: LlmHttpGateway` 에서 **`useFactory` + `inject: [LlmHttpGateway, LlmStubGateway]`** 형태로 바꾼다. factory 는 `isLoadTestStubEnabled()` 가 `true` 일 때만 stub 을, 그 외에는 실 `LlmHttpGateway` 를 반환한다 (조건 분기 1 개, 다른 로직 0).
- [x] **happy path** — `LlmModule` compile 시 `LlmStubGateway` provider 가 resolve 되고 export 로 외부 module 이 inject 가능함을 검증하는 test 1+ (`src/llm/llm.module.spec.ts`).
- [x] **happy path** — `LOAD_TEST_STUB=1` 인 상태로 `AssessmentEvaluationModule` 을 compile 하면 `LLM_GATEWAY` 로 resolve 되는 인스턴스가 `LlmStubGateway` 임을 검증하는 test 1+ (`src/assessment-evaluation/assessment-evaluation.module.spec.ts`).
- [x] **branch cover** — 위 factory 의 두 분기 각각 1+ test: (a) env 가 정확히 `"1"` → stub, (b) env 미설정 → `LlmHttpGateway`.
- [x] **negative cases 충분 cover** — 오활성 방어선을 값별로 전수 고정: env 가 `""`(빈 문자열) / `" 1"`(공백 포함) / `"0"` / `"true"` / `"TRUE"` / `"yes"` 각각에 대해 `LLM_GATEWAY` 가 **실 `LlmHttpGateway` 로 fall-through** 함을 검증하는 test 를 값마다 1+ 작성한다 (단일 negative 만으로 부족).
- [x] **error path** — `LlmStubGateway` 를 module 에서 제거하거나 factory 의존을 만족시키지 못한 구성이 DI resolve 에 실패함을 확인하는 test 1+ (또는 env 를 켠 상태에서 resolve 된 gateway 가 실 HTTP 왕복 없이 `generate` 를 수행함을 검증하는 test 1+ 로 대체 가능).
- [x] 각 spec 은 `process.env[LOAD_TEST_STUB_ENV]` 를 `afterEach` 에서 **원래 값으로 복원**한다 (env 누수로 다른 spec 이 오염되지 않게).
- [x] `pnpm lint && pnpm build && pnpm test` 전량 green.
- [x] `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%).
- [x] 변경 파일 4 개 이내 · diff ≤ 300 LOC · 신규 dependency 0 · DB schema 변경 0.

## Out of Scope

- `test/load/s1-batch.js` 신설 (D2 route 타격 + D3 tag + D4 threshold 산식) — 후속 slice.
- `.github/workflows/load-k6.yml` 의 step 순서 재배치(smoke → S1 → S2 → S3) · `LOAD_TEST_STUB` env 주입 · `package.json` 의 `test:load:s1` · drift-guard smoke 갱신 — 후속 slice (workflow/script parity 는 한 slice 로 묶어야 파일 cap 안에 든다, T-1122 전례).
- 수집 adapter(GitHub / Confluence) 축의 stub 배선 — 본 slice 는 LLM 축만.
- `LlmHttpGateway` · `LlmStubGateway` · `isLoadTestStubEnabled` 본문 수정 (이미 머지된 계약 그대로 사용).
- 133명 실 seed · baseline 실측 · 임계 fix · REQ-047 완료 선언 · `docs/PLAN.md` checkbox flip.
- 다른 module 의 `LLM_GATEWAY` 재바인딩 (현재 binding 지점은 `assessment-evaluation.module.ts` 1 곳뿐).

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(생성 시 비어 있음)

## 완료 요약 (2026-08-20T21:52:16Z)

- PR [#1307](https://github.com/myungjoo/Assessment-Agent/pull/1307) 라운드 1 APPROVE → squash merge `8338572e`.
- `llm.module.ts` 에 `LlmStubGateway` 등록·export(의존 0 이라 추가 import 0), `assessment-evaluation.module.ts` `149 행` 의 `useExisting: LlmHttpGateway` 를 `useFactory` + `inject: [LlmHttpGateway, LlmStubGateway]` env 분기로 전환 — 두 후보 모두 `LlmModule` singleton 재사용이라 새 인스턴스 생성 0.
- fail-safe default OFF 를 R-112 negative 6 종(`""` · `" 1"` · `"0"` · `"true"` · `"TRUE"` · `"yes"`)으로 고정, env 는 각 spec `afterEach` 에서 원복. 443 suite / 12738 test green, line 99.95% · function 100%.
- ADR-0057 `D1` 의 stub 배선 3 조각(T-1627 판정 helper · T-1628 stub class · 본 slice module binding) 완결 — 부하 job 이 credential 0 으로 D2 진입점 타격 가능.
