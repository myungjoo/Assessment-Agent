---
id: T-0643
title: 실 평가 e2e 결과 요약 한 줄 라인 형태 불변식 검증 순수 가드 assertRealDataResultSummaryLineFormatShape
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-005]
estimatedDiff: 175
estimatedFiles: 3
created: 2026-06-24
plannerNote: "P5 PLAN 109행 실 평가 e2e step④ 표현 가드 mirror — T-0642 한 줄 formatter 의 산출 라인 형태 불변식을 T-0638 summary-batch outcome-shape 가드 패턴으로 mirror. realdata-e2e-result-summary-line stream 두 번째 slice, dependsOn []"
independentStream: realdata-e2e-result-summary-line
dependsOn: []
touchesFiles:
  - test/helpers/realdata-e2e-result-summary-line-format-shape.ts
  - test/helpers/realdata-e2e-result-summary-line-format-shape.spec.ts
  - test/helpers/realdata-e2e-result-summary-line.ts
---

# T-0643 — 실 평가 e2e 결과 요약 한 줄 라인 형태 불변식 검증 순수 가드 assertRealDataResultSummaryLineFormatShape

## Why

[PLAN.md](../PLAN.md) P5 109행 — **실 평가 e2e 테스트 데이터 = github.com `myungjoo` + `leemgs` 공개 활동** (사용자 지정 2026-06-22). step ④ 결과 박제 chain 의 현재 상태:

- T-0580: `buildRealDataResultSummary(results)` → `RealDataResultSummary{count, byDifficulty, byContribution, totalVolume}` descriptor.
- T-0581: `renderRealDataResultSummaryMarkdown(summary)` → 이슈 본문 다행 markdown 렌더러.
- T-0642: `formatRealDataResultSummaryLine(summary)` → 사람-친화 결정적 한국어 단일 라인 formatter (PR #556 squash a581a50). 신규 helper `test/helpers/realdata-e2e-result-summary-line.ts` 가 라벨 상수 `RESULT_LINE_PREFIX = "실 평가 e2e 결과: "` 를 export 하고, 한 줄 출력은 `${RESULT_LINE_PREFIX}count=N · volume=V · 난이도(easy/medium/hard)=a/b/c · 기여도(zero/low/medium/high)=p/q/r/s` 형태로 결정적·byte-identical 렌더.

그러나 **그 단일 라인의 형태 불변식을 런타임에서 fail-fast 로 강제하는 가드가 부재**하다. T-0642 helper 가 JSDoc 으로만 박제한 출력 형태(개행 0·prefix `실 평가 e2e 결과: `·`count=N` 토큰·`volume=V` 토큰·`난이도(easy/medium/hard)=a/b/c` 슬롯·`기여도(zero/low/medium/high)=p/q/r/s` 슬롯·`DIFFICULTIES`·`CONTRIBUTION_LEVELS` single-source 고정 순서)는 자연 후속 caller surface (이슈 title·rolling 이슈 한 줄·journal/log·CI step_eval stdout) 로 외화될 예정이라, 그 산출 라인이 미래 회귀(개행 혼입·prefix drift·count/volume 토큰 누락·슬롯 누락·슬롯 순서 뒤바뀜·빈 라인 위장) 시 silent leak 한다.

summary-batch 측은 동일 자리에 가드 chain (T-0635 `assertSummaryBatchRosterPlanShape` plan 라인 · T-0638 `assertSummaryBatchOutcomeFormatShape` outcome 라인 · T-0633 `assertSummaryBatchReportShape` 합본 2-라인 블록) 이 박제돼 표현 surface 가 가드 대칭 완결됐다. realdata-e2e 측에는 그 mirror 가 비어 있다.

본 task 는 realdata-e2e 표현 가드 mirror 의 첫 slice 를 채운다 — `formatRealDataResultSummaryLine` 산출 라인이 문서화된 형태 불변식 ①~⑥ 을 위반하면 한국어 명세형 에러를 던지는 순수 가드 `assertRealDataResultSummaryLineFormatShape(line: string): void`. T-0638 `assertSummaryBatchOutcomeFormatShape` 의 정확한 realdata-e2e-side mirror — 에러 정책(구조/타입 결손 = TypeError / 형태 위반 = RangeError) · 한국어 JSDoc / 메시지 · 입력 비변형 · 결정성 패턴을 그대로 mirror 하되 대상이 summary-batch outcome 한 줄이 아니라 realdata-e2e 결과 한 줄이다. 본 layer 가 닫히면 자연 follow-up (이슈 title·body·journal·CI stdout 한 줄 진입점에 가드 배선 — T-0636/T-0637 mirror) 이 mirror chain 으로 이어진다.

## Required Reading

- [test/helpers/realdata-e2e-result-summary-line.ts](../../test/helpers/realdata-e2e-result-summary-line.ts) — T-0642 한 줄 formatter `formatRealDataResultSummaryLine(summary)` 와 라벨 상수 `RESULT_LINE_PREFIX` export. 본 가드는 동일 상수를 `import` 로 single-source 소비(라벨 drift 방지). 본문 변경 0 — 단, head import 정렬 1~2줄 amend 만 허용 시 byte-identical 출력 보존(이미 export 돼 있으므로 amend 불요 가능).
- [src/assessment-evaluation/domain/summary-batch-outcome-format-shape.ts](../../src/assessment-evaluation/domain/summary-batch-outcome-format-shape.ts) — T-0638 가드 (본 task 의 mirror 원형). 검증 단계 ①~⑤, 에러 정책 (TypeError 구조·RangeError 형태), 검사 순서 (string → 개행 0 → prefix → 토큰 → 슬롯 블록), regex 로 슬롯 순서 강제 패턴. 본문 변경 0.
- [src/assessment-evaluation/domain/summary-batch-roster-plan-shape.ts](../../src/assessment-evaluation/domain/summary-batch-roster-plan-shape.ts) — T-0635 가드 (T-0638 의 plan-side pair). 동일 패턴 second sample. 본문 변경 0.
- [src/llm/difficulty.ts](../../src/llm/difficulty.ts) — `DIFFICULTIES` 배열 (easy → medium → hard) single source. 본 가드가 import 해 슬롯 순서 regex 합성.
- [src/assessment-evaluation/domain/evaluation-result.ts](../../src/assessment-evaluation/domain/evaluation-result.ts) — `CONTRIBUTION_LEVELS` 배열 (zero → low → medium → high) single source. 본 가드가 import 해 슬롯 순서 regex 합성.

## Acceptance Criteria

- [ ] `test/helpers/realdata-e2e-result-summary-line-format-shape.ts` 신규 생성 — `assertRealDataResultSummaryLineFormatShape(line: string): void` 순수 함수 1 종 export. 입력 `line` 이 T-0642 `formatRealDataResultSummaryLine` 의 문서화된 형태 불변식을 위반하면 fail-fast throw, 만족하면 void 반환.
- [ ] **검증 단계 ①~⑥ 박제** (JSDoc 으로 본문에 박제, 본 task 가 single source):
  - ① `line` 은 string 이어야 한다 (null/undefined/비-string 금지).
  - ② 개행(`\n`)이 0개 (= 정확히 단일 라인). 1개 이상이면 위반.
  - ③ prefix `실 평가 e2e 결과: ` (`RESULT_LINE_PREFIX`) 로 시작해야 한다. 빈 문자열·공백만은 여기서 차단(빈 라인 위장 차단).
  - ④ 전역 카운트 토큰 `count=`·`· volume=` 가 모두 등장해야 한다. 누락 시 위반.
  - ⑤ 난이도 슬롯 블록 — `난이도(easy/medium/hard)=<N>/<N>/<N>` 가 `DIFFICULTIES` single-source 고정 순서로 등장해야 한다 (각 N 은 정수). 슬롯 누락·순서 drift 시 위반.
  - ⑥ 기여도 슬롯 블록 — `기여도(zero/low/medium/high)=<N>/<N>/<N>/<N>` 가 `CONTRIBUTION_LEVELS` single-source 고정 순서로 등장해야 한다. 슬롯 누락·순서 drift 시 위반.
- [ ] **에러 정책 (구조/타입 결손 = TypeError / 형태 정합 위반 = RangeError)** — T-0638/T-0635 패턴 mirror:
  - `line` 이 string 이 아님 (①) → 한국어 `TypeError`. 메시지에 실제 값 포함.
  - 개행 혼입 (②) · prefix 위반 (③) · 카운트 토큰 위반 (④) · 난이도 슬롯 위반 (⑤) · 기여도 슬롯 위반 (⑥) → 한국어 `RangeError`. 메시지에 어느 불변식이 깨졌는지 포함.
  - silent 통과 (위반인데 정상 반환) 0.
- [ ] **검사 순서 fail-fast** — ① string → ② 개행 0 → ③ prefix → ④ 카운트 토큰 → ⑤ 난이도 슬롯 → ⑥ 기여도 슬롯. 가장 먼저 위반한 지점에서 throw. prefix 를 토큰·슬롯 검사보다 먼저 검사해 prefix drift 가 ④/⑤/⑥ 가 아니라 ③ 으로 정확히 진단되게 한다.
- [ ] **single source 정합** — 라벨 prefix 는 `RESULT_LINE_PREFIX` import 소비 (라벨 drift 방지·자체 정의 0). 난이도 슬롯 키는 `DIFFICULTIES` 배열 import 후 join 으로 regex 합성, 기여도 슬롯 키는 `CONTRIBUTION_LEVELS` 배열 import 후 join 으로 regex 합성 (슬롯 키 hard-code 0).
- [ ] **입력 비변형·순수성** — `line` 문자열을 읽기만 한다 (split / match / test / includes 는 새 값 생성, 원본 변형 0). 부수효과 0 · `@Injectable` 0 · Prisma 0 · LLM 0 · 새 외부 dependency 0 · DB write 0 · migration 0 · raw 미저장(R-59 — 형태 검증만, narrative·평가 본문 미접촉). 외부 validation 라이브러리(zod·ajv) 도입 0.
- [ ] **결정성·동일 동작 보장** — 정상 line 이면 항상 void 반환, 손상 line 이면 항상 동일 위치 throw (동일 입력 → 동일 동작).
- [ ] **Out of Scope 보존** — `realdata-e2e-result-summary-line.ts` formatter 본문·출력 변경 0 (이미 export 된 상수 import 만). 자동 복구·정규화·drop·재렌더 0 (fail-fast throw 만). 산출 경로 자동 배선 (이슈 title·body·journal·CI stdout 안에서 본 가드 호출) 0 — 본 task 는 순수 함수까지 (호출처 배선은 별도 wiring follow-up — T-0636/T-0637 mirror).
- [ ] **Happy-path test 1+**: T-0642 `formatRealDataResultSummaryLine` 의 정상 출력 라인을 입력 → void 반환 (throw 0). 1+.
- [ ] **Error path test 각 1+**: ① `assertRealDataResultSummaryLineFormatShape(null)` / `undefined` / 숫자 / 객체 → 한국어 `TypeError` ② 개행 혼입 line → 한국어 `RangeError` ③ prefix drift line (다른 라벨로 시작) → 한국어 `RangeError` ④ `count=` 또는 `volume=` 토큰 누락 line → 한국어 `RangeError` ⑤ 난이도 슬롯 누락·순서 뒤바뀜 line → 한국어 `RangeError` ⑥ 기여도 슬롯 누락·순서 뒤바뀜 line → 한국어 `RangeError`. 각 1+.
- [ ] **Flow/branch test**: ① 정상 분기 1 ② 빈 문자열 입력 → prefix 위반 (③) RangeError 분기 1 ③ 공백만 입력 → prefix 위반 (③) 분기 1 ④ 개행이 line 끝에만 있는 경우 (`\n` 1개) → 개행 0 위반 (②) 분기 1 ⑤ 모든 슬롯 값 0 line (count=0, volume=0, 슬롯 모두 0) → 정상 (RangeError 0, void) 분기 1 ⑥ T-0642 formatter 가 실제로 생성한 라인을 그대로 입력 → 정상 분기 1 — 각 1+ test 로 분기 격리.
- [ ] **Negative cases 충분 cover (각 1+)**: ① 입력 비변형 (line 문자열을 split/match 등으로 읽기만 — TypeScript `string` 은 primitive 라 변형 불가지만, side effect 가 없음을 assert) ② 결정성 (정상 line 2회 호출 → 둘 다 void) ③ 손상 line 2회 호출 → 둘 다 동일 위치 throw ④ `RESULT_LINE_PREFIX` 와 가드 import single-source 정합 (mock 으로 prefix 변경 시 가드가 변경된 prefix 따라가는지 — 어려우면 import 식 자체 assert 로 대체) ⑤ `DIFFICULTIES` / `CONTRIBUTION_LEVELS` 단일 순서 정합 (가드 regex 가 single-source 배열 순서로 합성됐는지 — 어려우면 슬롯 순서 hard-code 없음 assert 로 대체) ⑥ T-0642 formatter happy 출력 + 분기 출력 (count=0 / 모든 슬롯 0 / 큰 수) 모두 가드 통과 ⑦ 다양한 손상 패턴 (개행 위치 다양·prefix 부분 일치·토큰 일부만 등장·슬롯 일부만 등장) 모두 RangeError. 단일 negative 만 작성 금지 — 위 분기마다 cover.
- [ ] `pnpm lint && pnpm build && pnpm test` green. 신규 파일 line/branch/function/statement 100% 커버.
- [ ] `pnpm test:cov` 통과 (전역 line ≥ 80% / function ≥ 80%).

## Out of Scope

- 가드를 산출처 (이슈 title·body·rolling 이슈 본문 상단·journal·CI step_eval stdout·notification surface) 에 실배선 — 본 task 는 순수 가드 정의·검증만. wiring 은 별도 follow-up (T-0636 service-경계 mirror · T-0637 합본 formatter mirror).
- `formatRealDataResultSummaryLine` 본문·출력 형태·`RESULT_LINE_PREFIX` 값 변경 — 본 task 는 import 만 (본문 변경 0). 단, 이미 export 된 상수 `RESULT_LINE_PREFIX` (T-0642 박제) 를 그대로 import 한다.
- 자동 복구·정규화·기본값 채움·silent 수선·재렌더·drop — 손상 line 을 고치거나 잘라내지 않는다 (fail-fast throw 만). 복구는 호출처 책임.
- JSON schema / 외부 validation 라이브러리 (zod·ajv·yup 등) 도입 — 순수 문자열 검사 (split/includes/startsWith/RegExp) 만 사용.
- `DIFFICULTIES`·`CONTRIBUTION_LEVELS` single-source 배열 변경·순서 amend — 본 task 는 import 만.
- 실 gh issue 호출·daily-test step_eval 배선·실 Ollama LLM round-trip — LAN/credential gate deferred (PLAN 108~109행).
- 새 dependency·migration·schema 변경·raw 저장 (R-59) — 전부 금지.
- summary-batch surface (plan / outcome / report / 합성 진입점) 본문·가드 변경 — 본 task 는 realdata-e2e 측 표현 가드 mirror 만 보강.

## Suggested Sub-agents

implementer → tester

## Follow-ups

(비어 있음 — sub-agent 가 관련 작업 발견 시 여기에 추가. 본 task 닫히면 realdata-e2e 결과 표현 가드 의 한 줄 layer 가 채워지므로, 자연 후속은 ① 가드를 산출처 (이슈 title·body 한 줄 진입점·journal·CI stdout) 에 wiring 배선 — T-0636 service-경계 mirror / T-0637 합본 formatter mirror 패턴 ② daily-test rolling 이슈 surface 에 실배선 (step ④ 박제 chain 합류) — 모두 realdata-e2e-result-summary-line stream 의 연속 slice 로 mirror chain 으로 이어진다.)
