---
id: T-0642
title: 실 평가 e2e 결과 요약 descriptor → 사람-친화 한 줄 요약 순수 formatter formatRealDataResultSummaryLine
phase: P5
status: DONE
commitMode: pr
coversReq: [REQ-005]
estimatedDiff: 175
estimatedFiles: 2
created: 2026-06-25
plannerNote: "P5 PLAN 109행 실 평가 e2e step④ 표현 surface 보강 — markdown 본문(T-0581) 옆에 한 줄 요약 layer 부재. formatSummaryBatchOutcome(T-0619) 동형, daily-test 이슈 title/journal/log 한 줄에 흘려보낼 결정적 라인. realdata-e2e-result-summary-line stream 첫 slice, dependsOn []"
independentStream: realdata-e2e-result-summary-line
dependsOn: []
touchesFiles:
  - test/helpers/realdata-e2e-result-summary-line.ts
  - test/helpers/realdata-e2e-result-summary-line.spec.ts
---

# T-0642 — 실 평가 e2e 결과 요약 descriptor → 사람-친화 한 줄 요약 순수 formatter formatRealDataResultSummaryLine

## Why

[PLAN.md](../PLAN.md) P5 109행 — **실 평가 e2e 테스트 데이터 = github.com `myungjoo` + `leemgs` 공개 활동** (사용자 지정 2026-06-22). step ④ 결과 박제 chain 의 현재 상태:

- T-0580: `buildRealDataResultSummary(results)` — `EvaluationResult[]` → `RealDataResultSummary{count, byDifficulty, byContribution, totalVolume}` 결정적 집계 descriptor.
- T-0581: `renderRealDataResultSummaryMarkdown(summary)` — descriptor → daily-test 이슈 **본문**(다행 markdown 표).
- T-0582~T-0589: descriptor → 이슈 식별자 / 명령 argv / search-parse / create-edit-parse 등 step ④ 박제 chain 의 build-time 외화 완결.

그러나 **descriptor → 사람-친화 한 줄 요약 표현** layer 가 부재하다. 이슈 본문은 다행 markdown 이지만, 이슈 **title**·daily-test rolling 이슈 본문 상단의 한 줄 요약·journal/log/notification surface 한 줄·CI step_eval stdout 한 줄 등 "한 줄짜리 요약" 이 자연스럽게 필요한 caller surface 가 여럿이다(현재는 caller 가 매번 ad-hoc 문자열 조립). summary-batch 측은 동일 자리에 `formatSummaryBatchOutcome`(T-0619) 한 줄 formatter 가 이미 박제돼 있어 표현 surface 가 대칭 완결됐다(plan 라인 / outcome 라인 / 합본 report / 합성 진입점 result.summaryLine — T-0640/T-0641 closure). realdata-e2e 측에는 그 mirror 가 비어 있다.

본 task 는 realdata-e2e 표현 surface 의 한 줄 요약 slice 를 채운다 — `RealDataResultSummary` 를 **사람-친화 한국어 결정적 단일 라인** 으로 렌더하는 순수 함수 `formatRealDataResultSummaryLine(summary): string`. summary-batch 의 `formatSummaryBatchOutcome` 와 동형 패턴(slot single-source 고정 순서 순회 / 미등장 slot 도 0 으로 등장 / 결정성 / 입력 비변형). 본 layer 가 닫히면 step ④ 박제 chain 의 caller 가 daily-test rolling 이슈 title 또는 journal 한 줄에 흘려보낼 표현 layer 가 확정되고, 다음 자연 follow-up(shape 가드·이슈 title 진입점 배선 등)이 mirror 패턴 chain 으로 이어진다.

## Required Reading

- [test/helpers/realdata-e2e-result-summary.ts](../../test/helpers/realdata-e2e-result-summary.ts) — `RealDataResultSummary` interface(`{count, byDifficulty, byContribution, totalVolume}`) 와 `buildRealDataResultSummary(results)` 함수. 본 task 의 입력 type 을 `import type` 로 재사용(중복 정의 0). 본문 변경 0.
- [test/helpers/realdata-e2e-result-summary-markdown.ts](../../test/helpers/realdata-e2e-result-summary-markdown.ts) — T-0581 `renderRealDataResultSummaryMarkdown(summary)` 다행 markdown 렌더러. 본 task 의 한 줄 formatter 는 동일 descriptor 입력 / 동일 slot single-source(`DIFFICULTIES` / `CONTRIBUTION_LEVELS`) / 동일 결정성 / 동일 무공유 / 동일 dependency-free 정책을 mirror 한다. 본문 변경 0.
- [src/assessment-evaluation/domain/summary-batch-outcome-format.ts](../../src/assessment-evaluation/domain/summary-batch-outcome-format.ts) — T-0619 `formatSummaryBatchOutcome(report)` 한 줄 formatter — 본 task 가 따라야 할 mirror 패턴(GRANULARITY_BUCKETS single-source 순회 / 미등장 버킷 0 등장 / 결정적 한국어 라인 / null/undefined fail-fast 한국어 TypeError). 본문 변경 0.
- [src/llm/difficulty.ts](../../src/llm/difficulty.ts) — `DIFFICULTIES`(easy → medium → hard) 고정 순서 single-source(본 formatter 가 import 해 순회).
- [src/assessment-evaluation/domain/evaluation-result.ts](../../src/assessment-evaluation/domain/evaluation-result.ts) — `CONTRIBUTION_LEVELS`(zero → low → medium → high) 고정 순서 single-source(본 formatter 가 import 해 순회).

## Acceptance Criteria

- [ ] `test/helpers/realdata-e2e-result-summary-line.ts` 신규 생성 — `formatRealDataResultSummaryLine(summary: RealDataResultSummary): string` 순수 함수 1 종 export. 입력 `summary` 가 가진 `count`·`totalVolume`·`byDifficulty`(easy/medium/hard 분포)·`byContribution`(zero/low/medium/high 분포) 를 **결정적 한국어 단일 라인** 으로 렌더(예: `count=N · volume=V · 난이도(easy/medium/hard)=a/b/c · 기여도(zero/low/medium/high)=p/q/r/s`). 정확한 라인 포맷은 implementer 가 결정 — 단 결정성·slot single-source 순회·미등장 slot 0 등장·줄바꿈 0(개행 문자 미포함)·한국어 prefix/separator·byte-identical 재현성을 만족해야 한다.
- [ ] **slot single-source 순회**: difficulty slot 은 `DIFFICULTIES` 배열(`src/llm/difficulty.ts`) 순서대로(easy → medium → hard), contribution slot 은 `CONTRIBUTION_LEVELS` 배열(`src/assessment-evaluation/domain/evaluation-result.ts`) 순서대로(zero → low → medium → high) 순회. slot 이름·순서 hard-code 금지 — 반드시 import 한 single-source 배열을 순회. T-0580 descriptor 가 미등장 slot 도 키 존재(값 0)를 보장하므로 누락 0 으로 등장.
- [ ] **결정성·재현성**: 동일 입력 두 번 호출 → byte-identical 출력. 시각·난수·env·외부 상태 의존 0. 슬롯 순서·공백·구분자 고정.
- [ ] **무공유·입력 비변형**: `summary`·`summary.byDifficulty`·`summary.byContribution` 객체를 변형하지 않는다(읽기만). 반환은 새 문자열 — 공유 mutable 노출 0.
- [ ] **type 재사용·중복 정의 0**: `RealDataResultSummary` 는 `test/helpers/realdata-e2e-result-summary.ts` 에서 `import type` 로 재사용. `DIFFICULTIES`·`CONTRIBUTION_LEVELS` 는 src 단일-source 에서 import. 신규 type/enum 정의 0.
- [ ] **fail-fast guard**: `summary` 가 `null`/`undefined` 면 한국어 `TypeError` throw(예: "summary 가 null 또는 undefined 입니다 — descriptor 객체가 필요합니다"). `summary.byDifficulty`·`summary.byContribution` 누락이면 동일 한국어 `TypeError`. fail-fast — 손상 라인 산출 차단(silent 수선·기본값 채움 금지).
- [ ] **순수성·안전 보존**: 직접 부수효과 0·새 dependency 0·NestJS `@Injectable` 0·Prisma 0·LLM 호출 0·네트워크 호출 0·env 읽기 0·DB write 0·migration 0·raw 미저장(R-59 — count/sum/enum 분포만, narrative·raw 본문 미접촉).
- [ ] **build-time 완결 (cloud cron 자율 실행 가능)**: 외부 템플릿 엔진·내장 외 라이브러리 0 — template literal 만. realdata-e2e/p5-summary-aggregate/recollection-window stream 과 파일 disjoint.
- [ ] **Happy-path test 1+**: 정상 `RealDataResultSummary`(count > 0, 모든 slot 양수) 입력 → 한국어 결정적 한 줄 문자열 반환, 개행 0, slot 값 모두 등장 확인. 1+.
- [ ] **Error path test 1+**: ① `formatRealDataResultSummaryLine(null)` → 한국어 `TypeError` ② `formatRealDataResultSummaryLine(undefined)` → 한국어 `TypeError` ③ `byDifficulty` 누락 → 한국어 `TypeError` ④ `byContribution` 누락 → 한국어 `TypeError` 각 1+.
- [ ] **Flow/branch test**: ① 정상 분기 1 ② count=0(빈 batch) 분기 1 ③ 일부 slot 0(미등장 slot 도 0 으로 등장 확인) 분기 1 ④ 일부 slot 큰 수(자릿수 보존) 분기 1 — 각 1+ test 로 분기 격리.
- [ ] **Negative cases 충분 cover (각 1+)**: ① 입력 비변형(`summary`·`byDifficulty`·`byContribution` 객체 변형 0, before/after deep-equal) ② 결정성(동일 입력 2회 호출 byte-identical) ③ 모든 slot 0 입력 → 한 줄 자체는 생성(slot 값 모두 0 으로 등장) ④ 큰 수(예: `count=1_000_000_000`) 입력 → 자릿수 보존·줄바꿈 0 ⑤ slot single-source 순서 보존(`DIFFICULTIES` 순서 mock 으로 뒤집어도 본 formatter 출력 순서는 import 한 single-source 순서 따라감 — 단 mock 검증은 어려우면 hard-code 슬롯 명 순서 assert 로 대체) ⑥ slot 값 음수(혹시 들어오면) 자릿수 보존(silent drop 금지). 단일 negative 만 작성 금지 — 위 분기마다 cover.
- [ ] `pnpm lint && pnpm build && pnpm test` green. 신규 파일 line/branch/function/statement 100% 커버.
- [ ] `pnpm test:cov` 통과 (전역 line ≥ 80% / function ≥ 80%).

## Out of Scope

- 한 줄 라인 정확한 포맷·구분자·prefix 결정 — implementer 자율(결정성·slot single-source·줄바꿈 0·한국어 만족하면 OK). 후속 task 에서 shape 가드/이슈 title 진입점 배선 시 재조정 가능.
- 본 한 줄 라인을 daily-test rolling 이슈 title·body·CI step_eval stdout·journal 등에 실배선 — 본 task 는 표현 helper 만. 배선은 후속 slice.
- shape 가드(예: `assertRealDataResultSummaryLineFormatShape`) — 본 task 는 formatter 만. 가드는 후속 mirror slice(summary-batch 의 T-0638/T-0639/T-0640/T-0641 chain 패턴 mirror).
- `RealDataResultSummary` 타입 amend·필드 추가·`buildRealDataResultSummary`·`renderRealDataResultSummaryMarkdown` 본문 변경 — 본 task 는 신규 한 줄 formatter helper 만 추가. import 만(본문 변경 0).
- `DIFFICULTIES`·`CONTRIBUTION_LEVELS` single-source 배열 변경·순서 amend — 본 task 는 import 만.
- 자동 복구·기본값 채움·silent 수선·정규화 — null/undefined·필드 누락은 fail-fast throw 만(silent fallback 금지).
- 실 gh issue 호출·daily-test step_eval 배선·실 Ollama LLM round-trip — LAN/credential gate deferred(PLAN 108~109행).
- 새 dependency·migration·schema 변경·raw 저장(R-59) — 전부 금지.
- summary-batch surface(plan / outcome / report / 합성 진입점) 본문 변경 — 본 task 는 realdata-e2e 측 표현 surface 만 보강.

## Suggested Sub-agents

implementer → tester

## Follow-ups

(비어 있음 — sub-agent 가 관련 작업 발견 시 여기에 추가. 본 task 닫히면 realdata-e2e 결과 표현 surface 의 한 줄 layer 가 채워지므로, 자연 후속은 ① shape 가드 `assertRealDataResultSummaryLineFormatShape` 신설(summary-batch T-0638 mirror) ② 이슈 title / body 한 줄 진입점에 가드 배선(T-0639/T-0640 mirror) ③ daily-test rolling 이슈 surface 에 실배선(step ④ 박제 chain 합류) — 모두 realdata-e2e-result-summary-line stream 의 연속 slice 로 mirror chain 으로 이어진다.)
