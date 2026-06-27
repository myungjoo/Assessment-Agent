# realdata-e2e build-time consistency-guard harness

> 본 문서는 `test/helpers/realdata-e2e-*.ts` 71 helper 가 이루는 build-time consistency-guard harness 의 architecture-level view 다. PLAN.md §109 실 평가 e2e step ④ build-time 산출 경로의 정확성을 network/credential 0 로 fail-fast 검증하는 sweep(T-0584 ~ T-0726) 의 설계 의도·인벤토리·종결 근거를 영속화한다. 미래 planner / architect 가 본 doc 만 읽고 harness 전모·잔여 NO-GUARD leaf 판정·"추가 value-consistency 가드 신설 정당화 0" 을 안다.

## §1 목적·배경

PLAN.md §109 "실 평가 e2e" bullet 의 step ④ 는 daily-test 의 결과 이슈 / rolling 이슈 박제를 다룬다. 그 박제는 두 층으로 나뉜다.

- **build-time 산출 경로** — `Person` / `Activity` / `Outcome` 입력에서 `gh issue create` / `gh issue edit` 명령 argv 와 본문 markdown 까지를 순수 함수로 합성. 네트워크 / DB / LLM / env / credential 의존 0, 동일 입력 → byte-identical 출력. 본 harness 의 책임 영역.
- **live wiring** — `deploy/daily-test.sh` step_eval 의 `gh search issues` / `gh issue create` / `gh issue edit` 실 호출. credential gate (ADR-0045 LAN gate / `LLM_LIVE_*` etc.) 뒤로 분리. 본 harness 의 책임 영역 **밖** — §6 cross-ref 만.

build-time 경로의 정확성이 어긋나면 (예: issueNumber 전파 drift / url trim 누락 / summaryLine 합성 drift / argv 인자 순서 위반) live wiring 이 그 손상 산출을 그대로 gh 에 넘겨 운영 이슈 본문이 오염된다. harness 는 그 손상을 **build-time 에 fail-fast** 로 차단해, credential 0 의 cron / CI 환경에서도 모든 분기를 unit test 로 cover 한다. REQ-032 (raw 미저장 / 표면 정합) 와 REQ-059 (입력 외 데이터 생성 0) 가 본 harness 의 invariant 근거.

본 harness 의 부재 비용은 미래 planner 의 "fresh survey" 비용 — 71 helper + T-0584 ~ T-0726 사슬의 task 정의서를 다시 읽어 composer↔guard 대응 · 2-step idiom · sweep 종결 근거를 재추론해야 한다 (CLAUDE.md §7 "같은 결정을 두 번 추론하지 않도록 doc 에 적는다" 위반). 본 doc 은 그 hard-won survey 결과를 architecture-level view 1 개로 영속 외화해, 미래 planner / architect 가 본 1 개만 읽고 harness 전모 · 잔여 NO-GUARD leaf 판정 · "추가 value-consistency 가드 신설 정당화 0" 룰을 파악하게 한다.

## §2 composer↔guard 인벤토리

`test/helpers/realdata-e2e-*.ts` (non-spec) **71 파일 = composer 35 + 정합 가드 33 + shape 가드 3** (`ls test/helpers/realdata-e2e-*.ts | grep -v '\.spec\.ts$' | wc -l` = 71). 본 §은 도메인 그룹 단위로 대표 composer · 짝 가드 · anchor task ID 만 요약한다 (71 행 전수 나열은 본문 비대화·미래 navigate 비용 증가라 의도적으로 회피 — 그룹 + anchor task ID 만으로 미래 planner 가 helper file 명을 grep 해 사슬을 재구성할 수 있다).

| 도메인 그룹 | 대표 composer | 짝 가드 | anchor task ID |
| --- | --- | --- | --- |
| seed | `buildRealDataSeedFixture` / `buildRealDataSeedCollectInput` / `buildRealDataSeedUpsertArgs` / `resolveRealDataSeedPersonId` / `buildRealDataSeedCollectCallArgs` | `*-consistency` 각 1 (총 5) | seed sweep |
| evaluation | `buildRealDataEvaluationInputs` / `buildRealDataEvaluationPlan` / `buildRealDataEvaluationStepArgs` / `buildRealDataStepArgs` | `*-consistency` 각 1 (총 4) | evaluation sweep |
| pipeline | `buildRealDataPipelinePlan` / `buildRealDataRunPlan` / `buildRealDataDailyStepEvalCommandPlan` | `*-consistency` 각 1 (총 3) | pipeline sweep |
| live-gating | `decideRealDataLiveGating` | `live-gating-consistency` | live-gating sweep |
| result-summary | `buildRealDataResultSummary` / `buildRealDataResultSummaryLine` / `buildRealDataResultSummaryMarkdown` / `buildRealDataResultReportPlan` | `*-consistency` (총 4) + `result-summary-line-format-shape` (shape 1) | summary-line value-guard T-0711 |
| result-issue | `resolveRealDataResultIssueAction` (T-0584) · `buildRealDataResultIssueDescriptor` / `buildRealDataResultIssueCommandArgs` (+ `-body-marker` / `-labels-title` sub) / `buildRealDataResultIssueCommandPlan` / `buildRealDataResultIssueGhArgv` / `buildRealDataResultIssueGhCommandPlan` / `buildRealDataResultIssuePublishPlan` / `buildRealDataResultIssueSearchArgv` (+ `-json-fields` sub) / `parseRealDataResultIssueSearchResponse` / `parseRealDataResultIssueOutput` / `buildRealDataResultIssueOutcomeReport` (+ `-from-output` 래퍼) | `*-consistency` (총 14) + `result-issue-search-hit-shape` / `result-issue-outcome-parse-shape` (shape 2) | action T-0584 · summary-line T-0711 · search-parse value+self-wire T-0721/T-0722 · output-parse value+self-wire T-0723/T-0724 · outcome-report value+self-wire T-0725/T-0726 |
| scoring · 기타 step-args | `buildRealDataScoringCallArgs` / `buildRealDataResultOutcomeStepArgs` / `buildRealDataResultPublishStepArgs` | `*-consistency` 각 1 (총 3) | scoring sweep |

> 분류 정의: **composer** = 입력을 산출 객체로 합성하는 순수 함수 (`build*` / `resolve*` / `parse*` / `decide*`). **정합 가드** = 컴포저 산출↔입력 또는 산출↔구성 필드 deep-equal / set-equality 정합을 fail-fast 로 검증 (`*-consistency.ts`). **shape 가드** = 산출 객체의 type / 필드 집합 / 형식 만을 검증 (`*-shape.ts`, 값 정합은 sibling value-consistency 가드가 cover). 합 35+33+3 = 71 이 실 파일 수와 일치.

## §3 composer 설계 계약 (4 불변식)

모든 composer 가 공유하는 4 불변식. `test/helpers/realdata-e2e-result-issue-action.ts` 상단 주석 (L1~60, T-0584) 이 일반화 출처. 본 4 불변식은 cron 자율 실행 (network/credential 0) 의 토대 — 깨지면 live wiring 이 그 손상을 그대로 운영에 전파한다. 가드 sweep 의 존재 이유.

1. **build-time 완결 — dependency-free** : 실 네트워크 호출 0 · env 읽기 0 · DB 접근 0 · live-LLM 0 · credential 0. 외부 템플릿 / 해시 / CLI 라이브러리 0 — 내장 string / 배열 / 객체 연산만. cloud cron 자율 실행 가능. 새 dependency 도입 금지 (CLAUDE.md §5 BLOCKED 사유). 위반 예: composer 가 `Date.now()` / `process.env` / `fetch()` 를 호출하면 본 불변식 위반.
2. **raw 미저장 정합 (R-59 / REQ-032)** : composer 산출 객체는 narrative 본문 · raw 활동 본문 · credential 을 **반환하지 않는다**. 식별자 (issueNumber / sha / dateToken) · argv · 정규화된 본문 marker 만 담는다. 가드 에러 메시지도 raw 본문을 누설하지 않는다 (test/helpers/realdata-e2e-result-issue-action.ts L23~27 의 일반화). data-model.md §4 (Contribution 본문 비저장) 와 동형 invariant.
3. **결정론적 출력** : 동일 입력 → byte-identical 출력. 입력 외 상태 (시각 · 난수 · env · `Date.now()` · `Math.random()`) 의존 0. 입력 순서가 흔들려도 결정론적 정렬 · 정규화로 산출이 동일 (예: `resolveRealDataResultIssueAction` T-0584 의 "후보 2+ → 가장 작은 number 를 update" 멱등 회귀 보호 — gh search 가 marker 매칭 이슈를 다수 반환해도 신규를 만들지 않고 최초 박제분에 누적 갱신).
4. **무공유 — 입력 mutate 0** : composer 는 입력 객체 / 배열을 **변형하지 않는다** (읽기만). 매 호출마다 새 산출 객체를 반환 — 입력 / 이전 호출 산출과 무공유 (alias 0). 두 번 호출 deep-equal · 참조 분리는 가드 test 의 표준 negative case (예: T-0726 의 "두 번 호출 산출이 deep-equal · 참조-무공유 유지" 결정성 test).

## §4 정합 가드 2-step idiom

NO-GUARD-value leaf composer 의 값 drift 를 sweep 으로 닫는 표준 idiom. T-0725 (가드 신설) → T-0726 (self-wire) 가 canonical 예. search-parse T-0721/T-0722 · output-parse T-0723/T-0724 도 동형.

### Step 1 — 독립 재유도 deep-equal 가드 신설 (`*-consistency.ts` 추가)

- 가드는 composer 산출 + composer 의 입력을 받아, **composer 재호출 없이** 입력으로부터 expected 5 필드 (또는 N 필드) 를 독립 재유도해 deep-equal 대조한다. composer 재호출 deep-equal 은 양방향 drift 상쇄라 무의미 — 독립 재유도가 핵심.
- 가드 입력 type 은 전부 `import type` only — composer 의 value 를 import 하지 않는다 (Step 2 의 top-level import 순환 0 근거). 가드는 expected 합성 규약을 composer 와 **byte-identical 동형 재구현** 한다 (T-0725 `reDeriveExpectedReport` — composer 의 빈/공백 guard → 양정수 guard → url trim 정규화 → summaryLine 템플릿 합성 → 5 키 정규화를 그대로 재구현).
- 추가필드 drop 정합 — `Object.keys(actual).length !== expectedKeyCount` 체크로 산출이 추가 키를 누설하면 deep-equal false. 키 집합도 무결성 대상.
- 에러 분리:
  - **TypeError** = 구조 결손 (입력 자체가 비-non-null 객체 / 필드 type 위반 / 양정수 위반 / 빈/공백 문자열 등 — 재유도 / 비교를 진행할 수 없는 경우).
  - **RangeError** = 값 정합 위반 (재유도 expected 와 산출이 5 필드 값 · 추가필드 drop · 키 집합 면에서 drift — 기대 vs 실측 메시지에 노출).
  - 한국어 명세형 메시지. silent 통과 0, fail-fast. raw 본문 / credential 메시지 누설 0.
- spec 책임: happy-path 1+ · error path 1+ · 분기마다 branch 분리 · negative cases 충분 cover (구조 결손 분기별 + 값 정합 분기별) · 결정성 (동일 입력 두 번 호출 deep-equal) · 비변형 (입력 mutate 0) · §9 정합 (raw 본문 / credential 미노출).

### Step 2 — composer 단일 return 직전 self-wire 배선

- composer 의 단일 return 사이트 (예: `return report;`) 직전, 기존 self-wire 가드 호출 다음에 신설 가드 호출 1 줄을 추가. T-0726 의 경우 `assertRealDataResultIssueOutcomeReportOutputConsistentWithInput(report, outcome, run);`.
- 가드 import 는 **top-level value import** — 가드가 composer 를 type-only 로만 import 하므로 CommonJS 순환 의존 0 (lazy require 불요). T-0724 / T-0722 / T-0720 mirror. value-import 가드 패턴에만 lazy require 가 필요한 것이며, 본 harness 의 모든 가드는 type-only import 라 lazy require 부적합.
- composer 산출은 **byte-identical 무변경** — self-wire 는 검증 호출만 추가하고 산출 값 / shape / 결정성을 바꾸지 않는다. 기존 self-wire (예: summary-line 내부 정합 가드) 는 **유지** — 대체 / 삭제 금지. 내부 정합 + 5 필드 전체 값 가드 공존 (각각 다른 drift 종을 cover).
- spec 검증: `jest.spyOn(가드모듈)` 으로 (1) 호출 횟수 1 (2) 인자 순서 (3) 인자 참조 동일성 (반환될 report 와 동일 참조 / 입력 outcome · run 과 동일) 검증. 가드 throw 선전파 — 가드 모듈을 spy 로 mock 해 RangeError / TypeError 강제 throw → composer 호출이 그 에러를 **그대로 선전파** (self-assert 가 삼키지 않음). 결정성 (두 번 호출 deep-equal · 참조 무공유 · spy 가 매 호출 1 회씩) negative case. 기존 composer 자체 throw 경로 (input guard fail-fast) 가 self-wire 도달 전에 throw 돼 가드를 거치지 않음 (spy 0 회) 확인 — self-wire 가 기존 fail-fast 를 가리지 않음 보호.

본 2-step 분리 (가드 신설 task → self-wire 배선 task) 는 PR 단위 cap (≤ 300 LOC / 5 파일) 안에 들이는 동시에, 가드 본체와 배선의 review 책임을 분리한다. 가드 신설은 test-only 단독 (sizeExempt 가능), self-wire 는 컴포저 1 줄 변경 + colocated spec describe 추가.

## §5 sweep 종결 판정·근거

- **범위** : T-0584 (`resolveRealDataResultIssueAction`) ~ T-0726 (`buildRealDataResultIssueOutcomeReport` self-wire).
- **종결 선언** : STATE.json `backlogNote` (T-0726 DONE 시점) — "build-time consistency-guard sweep 종결". 다음 task 는 본 sweep 의 연장선이 아닌 별도 stream.
- **종결 근거 (추가 value-consistency 가드 신설 정당화 0)** :
  - 잔여 shape-only 가드 (`result-issue-outcome-parse-shape` / `result-issue-search-hit-shape` / `result-summary-line-format-shape` 등) 의 값 drift 는 **sibling value-consistency 가드** (예: summary-line T-0711 / search-parse T-0721 / output-parse T-0723 / outcome-report T-0725) 가 transitive cover 한다. shape 가드는 type/형식만 보지만, 동일 산출 경로의 값 가드가 self-wire 돼 있어 값 drift 는 그 값 가드에서 fail-fast 로 잡힌다.
  - composer 35 중 가드 부재 alone composer 6 (`result-issue-descriptor` / `-command-args` / `-command-args-body-marker` / `-command-args-labels-title` / `-search-json-fields` / `-outcome-report`) 은 다중-가드 매칭 (예: `descriptor` ↔ `-body-consistency` + `-identity-consistency`) 또는 sub-shape utility (composer 본체가 아닌 sub-helper) 로 cover. 추가 1:1 매칭 가드 신설은 redundant.
- **미래 planner 가 본 § 만 읽고 판정 가능한 룰** : *"realdata-e2e harness 에 추가 value-consistency 가드를 신설하는 task 는 sweep 종결 (backlogNote) 위반이며 redundant 다. 새 NO-GUARD leaf composer 가 등장한 경우에 한해 §4 2-step idiom 으로 처리하라. 기존 leaf 의 추가 가드는 금지."*
- **미래 방향 후보 (sweep 외)** :
  - rolling-issue helper 신설 가능성 — 현 harness 는 update = snapshot replace semantics (T-0584 action resolver 최소 number update). 누적 helper 부재가 gap 인지 design 인지 case-by-case 재판정 — 현재로선 replace semantics 가 의도된 설계로 보임 (신설 불요 가능성 높음).
  - §109 step ③ live-LLM 검증 (credential gate — 사용자 승인 2026-06-11, 만료 2026-06-30 임박) 별도 BLOCKED-gated task.
  - §110 timezone ADR-first (dependency-free) forward 방향.

## §6 cross-ref

- **PLAN.md** §109 (실 평가 e2e step ④ — daily-test 결과/rolling 이슈 박제) / §110 (timezone — 미래 방향 후보).
- **requirements.md** REQ-032 (이슈 표면 정합 / raw 미저장) · REQ-059 (입력 외 데이터 생성 0). 본 harness 의 invariant 근거.
- **STATE.json** `backlogNote` (T-0726 DONE 항목 — sweep 종결 선언 / 추가 신설 정당화 0 근거).
- **[race-patterns.md](race-patterns.md)** — 본 harness 의 가드는 순수 함수라 race 와 무관. test helper 단독 (production race 영향 0).
- **[concurrency.md](concurrency.md)** — 본 harness 는 test-only helper 라 driver claim / lock 무관. fine-grained concurrency 평면 (`claims.json`) 영향 0.
- **[data-model.md](data-model.md)** §4 — raw 미저장 정합 (Contribution 본문 비저장) 근거.
- **live wiring 경계** : `deploy/daily-test.sh` step_eval / `LLM_LIVE_*` env / ADR-0045 LAN gate — 본 harness 의 책임 영역 **밖** (credential gate 뒤 별개 stream).
