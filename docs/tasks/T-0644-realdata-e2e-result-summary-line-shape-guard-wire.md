---
id: T-0644
title: 실 평가 e2e 결과 한 줄 formatter formatRealDataResultSummaryLine 반환 직전에 assertRealDataResultSummaryLineFormatShape 형태 가드 배선
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-005]
estimatedDiff: 130
estimatedFiles: 2
created: 2026-06-24
plannerNote: "P5 PLAN 109행 realdata-e2e step④ 표현 mirror — T-0643 가드를 T-0642 formatter 반환 직전에 배선(self-guard). T-0639 outcome wire mirror, single-helper-test ×1.0, dependsOn T-0643(머지됨)"
independentStream: realdata-e2e-result-summary-line
dependsOn: []
touchesFiles:
  - test/helpers/realdata-e2e-result-summary-line.ts
  - test/helpers/realdata-e2e-result-summary-line.spec.ts
---

# T-0644 — 실 평가 e2e 결과 한 줄 formatter 의 반환 직전에 형태 가드 배선

## Why

[PLAN.md](../PLAN.md) P5 109행 — **실 평가 e2e step ④ 결과 박제 chain** 의 표현 surface 보강. realdata-e2e-result-summary-line stream 의 현재 상태:

- T-0642 (PR #556 squash a581a50): `formatRealDataResultSummaryLine(summary)` → 결정적 한국어 단일 라인 formatter. 산출 형태는 `${RESULT_LINE_PREFIX}count=N · volume=V · 난이도(easy/medium/hard)=a/b/c · 기여도(zero/low/medium/high)=p/q/r/s`.
- T-0643 (PR #557 squash a479f9a): `assertRealDataResultSummaryLineFormatShape(line: string): void` → 그 라인의 형태 불변식 ①~⑥ 을 fail-fast 로 강제하는 순수 가드 정의·검증. 단 **Out of Scope 에서 산출 경로 배선을 명시적으로 deferred** 했다 — 가드는 main 에 존재하되 production site (formatter 산출 경로) 에서 호출되지 않는다 (`git grep assertRealDataResultSummaryLineFormatShape` → 자체 정의·spec 파일 외 0 hit).

즉 가드는 정의·검증만 됐고 **아무 산출 지점에서도 호출되지 않아**, formatter 의 미래 회귀 (template literal drift·슬롯 순서 뒤바뀜·prefix 변경·토큰 누락·개행 혼입) 가 가드를 우회해 caller surface (이슈 title·rolling 이슈 한 줄·journal/log·CI step_eval stdout) 로 silent leak 할 수 있다.

본 task 는 그 잔여를 닫는다 — `formatRealDataResultSummaryLine` 가 결정적 한 줄을 합성한 **직후·반환 전**에 `assertRealDataResultSummaryLineFormatShape(line)` 단언을 배선해, 산출 라인 형태가 깨졌으면 formatter 가 손상 라인을 반환하기 전에 fail-fast 차단한다 (self-guard). 이는 summary-batch 측 T-0639 (`formatSummaryBatchReport` 의 outcome 라인 합성 직전에 `assertSummaryBatchOutcomeFormatShape` 배선) 의 **정확한 realdata-e2e-side mirror** — 같은 패턴 (formatter 가 자기 산출 라인을 반환 전에 형태 가드로 self-assert) 이고 대상만 summary-batch outcome 라인이 아니라 realdata-e2e 결과 한 줄이다. 본 layer 가 닫히면 realdata-e2e 결과 표현 한 줄이 **정의·검증 + 산출 지점 self-guard 배선**까지 완결되고, 자연 follow-up (이슈 title·body·journal·CI stdout 한 줄 진입점 실배선 — T-0636/T-0637 service/합본 mirror) 으로 이어진다.

## Required Reading

- [test/helpers/realdata-e2e-result-summary-line.ts](../../test/helpers/realdata-e2e-result-summary-line.ts) — `formatRealDataResultSummaryLine(summary)` (L96~131). 본 task 는 L125~130 의 `return (...)` 합성 결과를 **지역 변수 `line` 으로 받은 뒤 `assertRealDataResultSummaryLineFormatShape(line)` 를 호출하고 그 `line` 을 반환**하도록 배선한다 (return 직전 self-assert). import 블록 (L67~) 에 가드 import 1줄 추가. 함수 JSDoc (L92~95) 의 `@throws` 에 형태 가드의 RangeError (산출 라인 형태 불변식 위반) 한 줄 보강. **기존 L99~113 의 null/undefined·byDifficulty/byContribution TypeError 가드 본문 변경 0** — 그 입력 가드는 형태 가드 호출 전 단계라 동작·한국어 메시지 보존. 슬롯 합성 (L115~123)·return template literal (L125~130) 의 **출력 byte 변경 0** (가드 호출만 삽입, 라인 내용은 동일).
- [test/helpers/realdata-e2e-result-summary-line-format-shape.ts](../../test/helpers/realdata-e2e-result-summary-line-format-shape.ts) — T-0643 `assertRealDataResultSummaryLineFormatShape(line: string): void` 의 throw 계약 (구조/타입 결손 = 한국어 TypeError / 형태 위반 = 한국어 RangeError 구분, 정상 형태 = void·비변형). 본 배선이 호출할 가드 (본문 변경 0, import 만).
- [src/assessment-evaluation/domain/summary-batch-report-format.ts](../../src/assessment-evaluation/domain/summary-batch-report-format.ts) — **참조만**: T-0639 이 outcome 라인 형태 가드를 산출 직전에 배선한 동형 wiring 패턴 (산출 라인을 합성 후 가드 호출 → 반환). 본 task 는 그 패턴을 realdata-e2e formatter 로 mirror.
- [test/helpers/realdata-e2e-result-summary-line.spec.ts](../../test/helpers/realdata-e2e-result-summary-line.spec.ts) — 기존 happy/error/branch/negative describe 블록. 본 task 가 "산출 라인이 가드를 통과한다 / formatter 가 정상 입력에 정상 라인을 반환한다 / 가드 위반 시 throw 전파" 검증을 append 할 colocated spec.

## Acceptance Criteria

- [ ] `formatRealDataResultSummaryLine` 가 결정적 한 줄을 합성한 **직후·반환 전**에 `assertRealDataResultSummaryLineFormatShape(line)` 를 호출하도록 배선. 합성 결과를 지역 변수 (`line`) 로 받아 가드 호출 후 그 변수를 반환 (호출 순서: 슬롯 합성 → line 합성 → assert → return line).
- [ ] **import 1줄 추가** — `assertRealDataResultSummaryLineFormatShape` 를 `./realdata-e2e-result-summary-line-format-shape` 에서 import. 다른 import·상수·슬롯 합성 로직 변경 0.
- [ ] **출력 byte-identical 보존** — 정상 입력 descriptor 에 대해 본 task 전/후 `formatRealDataResultSummaryLine` 의 반환 문자열이 **완전히 동일** (가드는 통과 후 void 반환·라인 비변형이므로 출력 무영향). 기존 spec 의 happy-path 기대 문자열 회귀 0.
- [ ] **JSDoc `@throws` 보강** — 함수 JSDoc 에 형태 가드의 RangeError (산출 라인 형태 불변식 위반 — 이론상 formatter 회귀 시) 한 줄 추가. 기존 TypeError (입력 null/undefined·불완전 descriptor) 기술 보존.
- [ ] **기존 입력 가드 보존** — L99~113 의 null/undefined·byDifficulty/byContribution TypeError 가드 본문·한국어 메시지·동작 변경 0 (그 가드는 형태 가드 호출 전 단계).
- [ ] **순수성·무공유 보존** — 부수효과 0 · `@Injectable` 0 · Prisma 0 · LLM 0 · 새 외부 dependency 0 · DB write 0 · migration 0 · raw 미저장 (R-59 — 형태 검증·렌더만). 가드는 `line` 을 읽기만 (split/match/test/includes — 원본 변형 0). 외부 validation 라이브러리 (zod·ajv) 도입 0.
- [ ] **Happy-path test 1+**: T-0580 `buildRealDataResultSummary` 산출 (또는 동등 descriptor) 을 `formatRealDataResultSummaryLine` 에 입력 → 가드를 통과한 정상 한 줄 반환 (throw 0). count=0 빈 batch descriptor 도 정상 반환. 1+.
- [ ] **Error path test 각 1+**: ① null/undefined descriptor 입력 → 기존 한국어 TypeError (입력 가드 — 형태 가드 도달 전) ② byDifficulty/byContribution 누락 descriptor → 기존 한국어 TypeError. 각 1+. (형태 가드 자체의 RangeError 는 정상 formatter 가 자연 발생시키지 못하므로 — 가드 호출이 실제로 배선됐는지는 아래 spy 검증으로 cover.)
- [ ] **Flow/branch test**: ① 정상 descriptor → assert 통과·정상 반환 분기 1 ② 모든 슬롯 값 0 (count=0, volume=0, 슬롯 모두 0) descriptor → 정상 반환 분기 1 ③ 큰 수·다양한 분포 descriptor → 정상 반환 분기 1 ④ 입력 가드 throw 분기 (null) 1 — 각 1+ test 로 분기 격리.
- [ ] **Negative cases 충분 cover (각 1+)**: ① **가드 호출 배선 검증** — `jest.spyOn` 으로 `assertRealDataResultSummaryLineFormatShape` 가 정상 호출 시 정확히 1회·합성된 라인 인자로 호출됨을 assert (가드가 실제로 산출 경로에 배선됐음을 증명 — 미배선 회귀 catch). ② 결정성 — 동일 descriptor 2회 호출 → 둘 다 동일 라인 반환. ③ 입력 비변형 — 호출 후 descriptor·byDifficulty·byContribution 객체가 변경되지 않음 assert. ④ 가드 throw 전파 — 가드를 mock 으로 throw 시키면 formatter 가 그 에러를 삼키지 않고 전파함 assert (silent 통과 0). ⑤ byte-identical — 본 배선 후에도 happy 출력 문자열이 명세 형태 (`실 평가 e2e 결과: count=… · volume=… · 난이도(…)=… · 기여도(…)=…`) 와 정확 일치. 단일 negative 만 작성 금지 — 위 분기마다 cover.
- [ ] `pnpm lint && pnpm build && pnpm test` green. 변경 파일 line/branch/function/statement 커버 100% 유지.
- [ ] `pnpm test:cov` 통과 (전역 line ≥ 80% / function ≥ 80%).

## Out of Scope

- 가드를 산출처 (이슈 title·body·rolling 이슈 본문 상단 한 줄·journal·CI step_eval stdout·notification surface) 에 실배선 — 본 task 는 formatter 의 self-guard (반환 직전 자기 산출 라인 assert) 까지. 외부 caller surface 배선은 별도 follow-up (T-0636 service-경계 mirror · T-0637 합본 formatter mirror).
- `formatRealDataResultSummaryLine` 의 출력 형태·`RESULT_LINE_PREFIX` 값·슬롯 순서·구분자 변경 — 본 task 는 가드 호출 1줄 삽입만 (출력 byte-identical).
- `assertRealDataResultSummaryLineFormatShape` (T-0643) 가드 본문·검증 단계·에러 정책 변경 — 본 task 는 import·호출만 (가드 본문 변경 0).
- 자동 복구·정규화·기본값 채움·silent 수선·재렌더·drop — 가드 위반 시 fail-fast throw 전파만 (formatter 가 손상 라인을 고치거나 잘라내지 않음).
- JSON schema / 외부 validation 라이브러리 (zod·ajv·yup 등) 도입 — 순수 문자열 검사만.
- `RealDataResultSummary` 타입·`buildRealDataResultSummary`·markdown 렌더러 본문 변경 — 본 task 는 한 줄 formatter 의 가드 배선만.
- 실 gh issue 호출·daily-test step_eval 배선·실 Ollama LLM round-trip — LAN/credential gate deferred (PLAN 108~109행).
- 새 dependency·migration·schema 변경·raw 저장 (R-59) — 전부 금지.
- summary-batch surface (plan / outcome / report / 합성 진입점) 본문·가드 변경 — 본 task 는 realdata-e2e 측 표현 가드 배선만 보강.

## Suggested Sub-agents

implementer → tester

## Follow-ups

(비어 있음 — sub-agent 가 관련 작업 발견 시 여기에 추가. 본 task 닫히면 realdata-e2e 결과 한 줄 표현이 정의·검증 + formatter self-guard 배선까지 완결되므로, 자연 후속은 ① 가드/formatter 를 외부 산출처 (이슈 title·body 한 줄 진입점·journal·CI stdout) 에 wiring 배선 — T-0636 service-경계 mirror / T-0637 합본 formatter mirror 패턴 ② daily-test rolling 이슈 surface 에 실배선 (step ④ 박제 chain 합류) — 모두 realdata-e2e-result-summary-line stream 의 연속 slice 로 mirror chain 으로 이어진다.)
