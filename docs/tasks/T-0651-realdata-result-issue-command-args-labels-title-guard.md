---
id: T-0651
title: 실 평가 e2e 결과 이슈 command-args labels·title 정합 불변식 검증 순수 가드 신설
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-005]
estimatedDiff: 160
estimatedFiles: 2
created: 2026-06-25
plannerNote: "P5 PLAN 109행 step④ — T-0649 body marker 가드가 미커버하는 createArgs.labels(고정 상수 정합·무공유)·title(create/update/descriptor 3자 정합) 구조 가드 신설. T-0649 Follow-up ②. single-helper-test ×1.0, dependsOn []"
independentStream: realdata-e2e-result-summary-line
dependsOn: []
touchesFiles:
  - test/helpers/realdata-e2e-result-issue-command-args-labels-title.ts
  - test/helpers/realdata-e2e-result-issue-command-args-labels-title.spec.ts
---

# T-0651 — command-args labels·title 정합 불변식 검증 순수 가드 신설

## Why

[PLAN.md](../PLAN.md) P5 109행 — **실 평가 e2e step ④ 결과 박제 chain** 의 command-args 구조 무결성 보강 slice. realdata-e2e-result-summary-line stream 은 한 줄 요약 정의(T-0642)·형태검증(T-0643)·formatter self-guard(T-0644)·이슈 body caller-surface 실배선(T-0645)·descriptor body 3블록 구조 가드 신설(T-0646)·builder self-wire(T-0647)·종단 컴포저 self-wire(T-0648)·command-args body marker-first 가드 신설(T-0649)·그 가드의 builder self-wire(T-0650)까지 닿았다.

지금까지 박힌 command-args 가드(`assertRealDataResultIssueCommandArgsBodyPreservesDescriptor`, T-0649)는 **body marker-first 구조와 searchQuery 정합만** 검증한다. 그러나 `buildRealDataResultIssueCommandArgs` (T-0583) 가 합성하는 명령-args 에는 그 가드가 닿지 않는 두 구조 불변식이 더 있다:

1. **title 3자 정합** — `createArgs.title`·`updateArgs.title` 이 둘 다 `descriptor.title` 와 byte-identical 이어야 한다(create/update 어느 경로로 gh issue 를 박제하든 동일 제목으로 멱등 식별). 회귀로 둘 중 하나가 어긋나면 같은 run 의 이슈가 두 제목으로 갈라져 멱등성이 깨진다.
2. **labels 고정-상수 정합·무공유** — `createArgs.labels` 가 고정 결정론 상수 집합(`["realdata-e2e", "result"]`)과 정확히 일치(순서·원소·개수)하고, 입력/상수와 무공유(새 배열)여야 한다. 회귀로 label 이 누락·추가·순서변경되거나 상수 자체 참조를 반환(무공유 위반)하면 결과 이슈 분류·검색 필터가 깨지거나 후속 호출의 labels mutate 가 누설된다.

본 task 는 이 두 불변식을 검증하는 **순수 가드 helper 를 신설** 한다 — `assertRealDataResultIssueCommandArgsLabelsTitleConsistent(args, descriptor, expectedLabels)`. 정상이면 void, 위반이면 한국어 명세형 에러로 fail-fast throw. 이는 T-0649(body marker 가드 신설)와 **동형 패턴의 labels·title-side mirror** 이며 T-0649 Follow-up ② 가 명시한 자연 후속 slice 다. 본 task 는 **가드 신설만** — builder 산출 경로 self-wire 는 별도 후속(T-0650 이 T-0649 가드를 self-wire 한 것과 동형 패턴, 본 task 의 Follow-up 으로 박제).

## Required Reading

- [test/helpers/realdata-e2e-result-issue-command-args.ts](../../test/helpers/realdata-e2e-result-issue-command-args.ts) (T-0583) — 가드가 검증할 빌더 출력 shape. 특히 `RealDataResultIssueCommandArgs`(L89~93)·`RealDataResultIssueCreateArgs`(L69~73, title/body/labels)·`RealDataResultIssueUpdateArgs`(L78~81, title/body)·고정 상수 `RESULT_ISSUE_LABELS = ["realdata-e2e", "result"]`(L63). **본 task 는 이 파일을 변경하지 않는다** — 출력 타입을 import 재사용만(신규 type 0). 빌더 self-wire 도 본 task 범위 밖(Follow-up).
- [test/helpers/realdata-e2e-result-issue-command-args-body-marker.ts](../../test/helpers/realdata-e2e-result-issue-command-args-body-marker.ts) (T-0649) — mirror 할 **참조**: 순수 가드 helper 의 구조(정상 void · 위반 fail-fast throw · 한국어 명세형 에러 · import 타입 재사용 · runtime cycle 0 · 부수효과 0). 본 task 가 신설할 labels·title 가드는 이 body marker 가드와 동형 형태를 따른다. **본 가드 본문 변경 0**(참조만).
- [test/helpers/realdata-e2e-result-issue-command-args-body-marker.spec.ts](../../test/helpers/realdata-e2e-result-issue-command-args-body-marker.spec.ts) (T-0649) — mirror 할 spec 구조 참조: 정상 통과(void)·각 불변식 위반별 throw·결정성·무공유·negative 분기 cover 패턴. 신설 spec 은 colocated(`...-labels-title.spec.ts`).
- [test/helpers/realdata-e2e-result-issue-descriptor.ts](../../test/helpers/realdata-e2e-result-issue-descriptor.ts) (T-0582) — `RealDataResultIssueDescriptor` 타입(title/marker/body) import 재사용. 가드의 title 정합 검증 기준(descriptor.title). 본문 변경 0.

## Acceptance Criteria

- [ ] **신규 가드 helper 파일** `test/helpers/realdata-e2e-result-issue-command-args-labels-title.ts` 신설 — `export function assertRealDataResultIssueCommandArgsLabelsTitleConsistent(args: RealDataResultIssueCommandArgs, descriptor: RealDataResultIssueDescriptor, expectedLabels: readonly string[]): void`. 정상이면 void, 불변식 위반이면 한국어 명세형 에러로 fail-fast throw. 출력 타입은 T-0583 helper 에서 import 재사용(신규 type 0).
- [ ] **title 3자 정합 검증** — `createArgs.title`·`updateArgs.title` 이 둘 다 `descriptor.title` 와 byte-identical 임을 검증. 어느 한쪽이라도 어긋나면 어느 필드가 어긋났는지 명시한 한국어 에러로 throw.
- [ ] **labels 고정-상수 정합 검증** — `createArgs.labels` 가 `expectedLabels` 와 순서·원소·개수까지 정확히 일치함을 검증(부분집합 아님 — 정확 일치). 누락·추가·순서변경 시 어긋난 내용을 명시한 한국어 에러로 throw.
- [ ] **labels 무공유 검증** — `createArgs.labels` 가 `expectedLabels`(전달된 상수 참조)와 **동일 배열 참조가 아님**(`!==`)을 검증 — 빌더가 상수를 복제하지 않고 직접 반환하는 무공유 위반을 검출. 참조 동일 시 한국어 에러로 throw.
- [ ] **순수성·부수효과 0·runtime cycle 0** — 가드는 입력(`args`/`descriptor`/`expectedLabels`)을 읽기만(mutate 0)·반환값 0(void)·매 호출 동일 판정(결정성)·`@Injectable` 0·Prisma 0·LLM 0·새 외부 dependency 0. 같은 디렉토리 타입 import 라 runtime cycle 0.
- [ ] **Happy-path test 1+**: 정상 command-args(빌더가 정상 산출한 args + 올바른 expectedLabels) → 가드 void(throw 0). 단일/다수 result·다양한 label 집합 변형 포함 1+.
- [ ] **Error path test 각 1+**: ① `createArgs.title` 가 descriptor.title 와 불일치 → throw ② `updateArgs.title` 가 descriptor.title 와 불일치 → throw ③ `createArgs.labels` 가 expectedLabels 와 원소 불일치(누락/추가) → throw ④ `createArgs.labels` 순서변경 → throw ⑤ `createArgs.labels` 가 expectedLabels 와 동일 참조(무공유 위반) → throw. 각 1+.
- [ ] **Flow/branch test**: 가드 안 각 검증 분기(title-create 분기 · title-update 분기 · labels-내용 분기 · labels-참조 분기 · 정상 void 분기)마다 1+ test 로 분기 격리. 어느 분기가 throw 했는지 에러 메시지로 식별 가능.
- [ ] **Negative cases 충분 cover (각 1+)**: ① **결정성** — 동일 입력 2회 호출 → 둘 다 동일 판정(정상→void, 위반→동일 throw) ② **입력 비변형** — 가드 호출 후 args/descriptor/expectedLabels 변경 0 assert(읽기만) ③ **빈 labels 경계** — expectedLabels 가 빈 배열이고 createArgs.labels 도 빈 배열이면 void, createArgs.labels 가 비지 않으면 throw ④ **부분 일치 거부** — createArgs.labels 가 expectedLabels 의 진부분집합이거나 초과집합이면 throw(정확 일치만 통과) ⑤ **공백·대소문자 민감** — label 문자열은 byte-identical 비교(trim·case-fold 0). 단일 negative 만 작성 금지 — 위 분기마다 cover.
- [ ] **colocated spec** — `test/helpers/realdata-e2e-result-issue-command-args-labels-title.spec.ts` 신설(신규 가드 helper 의 colocated spec). 기존 fixture·descriptor 생성 패턴(T-0649 spec 참조) 재사용. 신규 가드 helper line/branch/function 100%.
- [ ] `pnpm lint && pnpm build && pnpm test` green.
- [ ] `pnpm test:cov` 통과 (전역 line ≥ 80% / function ≥ 80%).

## Out of Scope

- `buildRealDataResultIssueCommandArgs` (T-0583) 산출 경로에 본 신규 가드 self-wire — 본 task 는 **가드 신설만**(T-0649 가 body marker 가드를 신설만 하고 T-0650 이 self-wire 한 것과 동형 분리). self-wire 는 본 task 의 Follow-up.
- `test/helpers/realdata-e2e-result-issue-command-args.ts` 본문 변경(빌더·식별자 guard·labels 상수·body 전파 규칙) — 본 task 는 신규 가드 helper + spec 단독, 출력 타입 import 재사용만.
- `assertRealDataResultIssueCommandArgsBodyPreservesDescriptor` (T-0649) body marker 가드 본문·spec 변경 — 본 task 는 labels·title 가드 신설 단독(body/searchQuery 검증은 그 가드가 이미 cover).
- `RealDataResultIssueCommandArgs`/`RealDataResultIssueCreateArgs`/`RealDataResultIssueUpdateArgs`/`RealDataResultIssueDescriptor` 타입 정의 변경 — 본 task 는 가드 신설만(타입 재사용).
- gh issue 실 호출 · `gh issue create`/`edit`/`list`/`search` 실 실행 · `deploy/daily-test.sh` step_eval 배선 · 실 Ollama LLM round-trip — LAN/credential gate deferred (PLAN 108~109행).
- 자동 복구·정규화·기본값 채움·label 자동 보정·title 자동 교정 — 가드는 위반 검출 시 fail-fast throw 만(수선 0).
- 새 dependency·migration·schema 변경·raw 저장 (R-59) — 전부 금지.
- production `src/` 코드 변경 — test helper 단독.
- summary-batch surface (plan / outcome / report / consistency 가드 / 합성 진입점) 본문 변경 — 본 task 는 realdata-e2e 측 command-args labels·title 가드 신설 단독.

## Suggested Sub-agents

implementer → tester

## Follow-ups

(비어 있음 — sub-agent 가 관련 작업 발견 시 여기에 추가. 본 task 닫히면 command-args 의 labels·title 정합 불변식이 순수 가드로 박힌다 — body marker 가드(T-0649)와 함께 command-args 구조 무결성의 두 축 완결. 자연 후속 후보: ① **labels·title 가드 builder self-wire** — `buildRealDataResultIssueCommandArgs` 가 반환 직전 본 신규 가드를 `RESULT_ISSUE_LABELS` 를 expectedLabels 로 self-assert(T-0650 이 body marker 가드를 self-wire 한 것과 동형 패턴, T-0649 body 가드의 self-wire 옆에 나란히 배선). ② gh issue 실배선 — `gh issue create`/`edit`/`search` + daily-test step_eval + 실 Ollama LLM round-trip, LAN/credential gate deferred (PLAN 108~109행) — realdata-e2e-result-summary-line stream 의 live wiring slice.)
