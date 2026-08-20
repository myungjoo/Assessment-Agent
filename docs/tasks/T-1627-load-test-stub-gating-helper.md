---
id: T-1627
title: ADR-0057 D1 stub 활성 판정 helper 박제 (기본 OFF fail-safe + negative 충분 cover)
phase: P5
status: DONE
commitMode: pr
coversReq: [REQ-047]
estimatedDiff: 230
estimatedFiles: 2
created: 2026-08-20
createdAt: 2026-08-20T16:40:00Z
completedAt: 2026-08-20T17:48:17Z
prNumber: 1304
independentStream: load-harness-k6
dependsOn: [T-1626]
touchesFiles:
  - src/common/load-test-stub-gating.ts
  - src/common/load-test-stub-gating.spec.ts
plannerNote: P5 R-91 chain 8/N — ADR-0057 D1 의 fail-safe OFF 판정만 순수 함수로 박제. stub class·module binding 은 후속 slice.
---

# T-1627 — ADR-0057 D1 stub 활성 판정 helper 박제

## Why

[docs/PLAN.md](../PLAN.md) `144 행` 오너 지시(R-91 k6 최우선·즉시 착수) chain 의 8/N 이다.
S2·S3 는 T-1620~T-1625 로 닫혔고, 남은 S1(REQ-047 배치 1h)의 선행 결정은
[ADR-0057](../decisions/ADR-0057-s1-batch-load-io-isolation.md) 이 확정했다 — `D1` 이
"env 기반 stub gateway 주입 + **fail-safe default OFF**" 를 택하면서, 그 default 분기를
R-112 negative test 로 고정하는 것을 후속 구현 slice 의 **의무**로 못 박았다(오활성 시
프로덕션 LLM 이 조용히 가짜 응답을 내는 사고이므로).

본 slice 는 그 D1 배선 중 **판정 로직 한 조각만** 떼어 순수 함수로 박제한다. stub 구현
class 도, module binding 도 건드리지 않으므로 이 commit 만으로는 어떤 실행 경로도 바뀌지
않는다(호출처 0 — 후속 slice 가 주입). 판정을 먼저 분리하는 이유는 CLAUDE.md `§3.2` 의
entrypoint-helper 분리 원칙과 같다 — module factory 안에 분기를 묻으면 negative case 를
unit-test 하기 어렵고, 그 결과가 곧 D1 이 경고한 오활성 risk 다.

선례 형태는 [src/llm/llm-live-test-gating.ts](../../src/llm/llm-live-test-gating.ts)
(env gating 을 부수효과 0 순수 함수로 분리하고 spec 이 env 변형을 전수 cover) 를 그대로
승계한다 — 새 패턴을 만들지 않는다.

## Required Reading

- [docs/decisions/ADR-0057-s1-batch-load-io-isolation.md](../decisions/ADR-0057-s1-batch-load-io-isolation.md) — `## Decision` `D1`(fail-safe default OFF, "정확히 `1`" 조건) + `## Consequences` 부정 3(stub 오활성 risk) + `## 범위 밖` 첫 항목
- [src/llm/llm-live-test-gating.ts](../../src/llm/llm-live-test-gating.ts) — env 이름 상수 + 순수 판정 함수의 선례 형태(주석 책임 경계 서술 포함)
- [src/llm/llm-live-test-gating.spec.ts](../../src/llm/llm-live-test-gating.spec.ts) — env 변형(부재 / 빈 문자열 / 공백-only / 다른 값)을 negative 로 전수 cover 하는 spec 선례
- [src/common/period-boundary.ts](../../src/common/period-boundary.ts) — `src/common/` 의 의존 0 순수 helper 배치 관례(module 등록 없이 export 만)
- [CLAUDE.md](../../CLAUDE.md) `§3.2` — R-112 4 항목 + coverage line/function ≥ 80%

## Acceptance Criteria

- [x] `src/common/load-test-stub-gating.ts` 신설. export 는 다음 2 개만:
  - [x] `LOAD_TEST_STUB_ENV` — env 변수 **이름** 문자열 상수(`"LOAD_TEST_STUB"`). 실값 0.
  - [x] `isLoadTestStubEnabled(env?: NodeJS.ProcessEnv): boolean` — 부수효과 0 순수 함수. 인자 미제공 시 `process.env` 를 default 로 읽는다.
- [x] 판정 규칙은 ADR-0057 `D1` 그대로: `env[LOAD_TEST_STUB_ENV]` 가 **정확히 문자열 `"1"`** 일 때만 `true`. trim 도 대소문자 folding 도 하지 않는다(관대한 해석이 곧 오활성 표면이므로). 그 외 전부 `false`.
- [x] 파일 상단에 책임 경계 주석(한국어) — 본 helper 는 판정만 하고 binding 은 후속 slice 책임이라는 점, ADR-0057 `D1` pointer 를 명시.
- [x] `src/common/load-test-stub-gating.spec.ts` (colocated) 신설. 아래 R-112 4 종을 모두 cover:
  - [x] **happy path** — `{ LOAD_TEST_STUB: "1" }` 주입 시 `true` 반환 1+ test.
  - [x] **error / 미설정 path** — env 객체에 키 자체가 없을 때(`{}`) 와 값이 `undefined` 일 때 각각 `false` 1+ test.
  - [x] **분기 cover** — 함수의 두 분기(정확히 `"1"` → true / 그 외 → false)를 각각 최소 1 test 로 통과. 인자 생략 경로(`process.env` default) 도 1 test — spec 안에서 `process.env` 를 저장·복원해 오염 0.
  - [x] **negative 충분 cover** — 값 변형마다 각각 `false` 임을 assert: 빈 문자열 `""`, 공백-only `" "`, 앞뒤 공백 `" 1"` / `"1 "`, `"0"`, `"true"` / `"TRUE"` / `"True"`, `"yes"`, `"on"`, `"01"`, `"11"`. (각 케이스 1+ test 또는 `it.each` 테이블 1 개.)
  - [x] `LOAD_TEST_STUB_ENV` 상수 값이 `"LOAD_TEST_STUB"` 임을 고정하는 test 1(후속 workflow env 주입과의 drift 방지).
- [x] `pnpm lint && pnpm build && pnpm test` 통과.
- [x] `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%).
- [x] 신규 dependency 0 · `package.json` 변경 0 · schema 변경 0 · 기존 파일 수정 0(신규 2 파일만).

## Out of Scope

- **stub gateway 구현 class**(`LlmGateway` 를 구현하는 가짜 응답 class) — 후속 slice.
- **module binding 변경** — `assessment-evaluation.module.ts` 의 `LLM_GATEWAY` `useExisting` 분기, `llm.module.ts` provider 추가 등 일체 금지. 본 slice 는 호출처 0.
- **수집 adapter(GitHub / Confluence) 축 stub** — 같은 helper 를 쓰겠지만 배선은 별도 slice.
- **`test/load/s1-batch.js` 신설**, `load-k6.yml` step 재배치·env 주입, `package.json` 의 `test:load:s1` script — 각각 후속 slice(ADR-0057 `## 범위 밖`).
- **daily-test.sh leg 추가 금지** — leg 를 건드리면 drift-guard smoke spec 3 종까지 같은 commit 에 끌려와 5 파일 cap 이 깨진다.
- **문서 doc-sync**(PLAN / 계획 문서 / REQ-047 상태 전이) — direct-mode 별도 task.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(비어 있음 — sub-agent 가 발견 시 append)

## 결과 요약 (2026-08-20 완료)

**DONE** — `pr` 모드, PR [#1304](https://github.com/myungjoo/AA_S1/pull/1304) 라운드 1 APPROVE → 스쿼시 머지 `f6052cf3`.

- `src/common/load-test-stub-gating.ts` 신설 — `LOAD_TEST_STUB_ENV` 상수 + `isLoadTestStubEnabled()` 판정 함수 2 export 만. 부수효과 0 순수 함수로, [src/llm/llm-live-test-gating.ts](../../src/llm/llm-live-test-gating.ts) 선례를 그대로 승계했다.
- 판정 규칙은 ADR-0057 `D1` 그대로 — env 값이 **정확히 `"1"`** 일 때만 `true`. 미설정 · 빈 문자열 · 공백 · `"true"` · `"0"` 등 그 외 전부 `false`(trim · case folding 없음). fail-safe default OFF 가 곧 stub 오활성(프로덕션 LLM 이 조용히 가짜 응답) 차단선이다.
- colocated spec 29 test 로 R-112 4 종(happy / error·미설정 / 분기 / negative 충분 cover) 전수 고정. 신규 파일 line · branch · function 100%, 전체 442 suite / 12709 test green.
- **호출처 0** — stub 구현 class · module binding · `test/load/s1-batch.js` · `load-k6.yml` 은 Out of Scope 그대로 후속 slice. 본 commit 만으로 바뀌는 실행 경로 없음. 신규 dependency 0 · `package.json` 무변경 · 기존 파일 수정 0.
