---
id: T-0704
title: realdata-e2e result-issue-action 컴포저 self-wire 배선 (T-0703 가드 짝 닫기)
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-032, REQ-059]
estimatedDiff: 90
estimatedFiles: 2
created: 2026-06-27
plannerNote: P5 109행 step④ — T-0703 신설 result-issue-action 정합 가드를 컴포저 두 분기 반환 직전 self-assert 배선(T-0702 self-wire mirror). guard self-wire × 1.0.
touchesFiles:
  - test/helpers/realdata-e2e-result-issue-action.ts
  - test/helpers/realdata-e2e-result-issue-action.spec.ts
dependsOn: [T-0703]
independentStream: realdata-e2e-result-issue-action-guard
---

# T-0704 — realdata-e2e result-issue-action 컴포저 self-wire 배선

## Why

PLAN 109행(🟢 실 평가 e2e, P5)의 build-time consistency 가드 사슬에서 step④ post-evaluation interpretation(평가 산출 → 결과 이슈 create-or-update 분기 결정) 측 leaf resolver `resolveRealDataResultIssueAction(searchHits, marker)`(`realdata-e2e-result-issue-action.ts`, T-0584)는 직전 T-0703 이 독립 정합 가드 `assertRealDataResultIssueActionConsistentWithInputs(action, searchHits, marker)`(`realdata-e2e-result-issue-action-consistency.ts`)를 **신설**했지만, 컴포저 본문이 아직 이 가드를 호출하지 않는다(origin/main 컴포저 grep 0 확인 — import 부재, 두 return 사이트(`return { action: "create" };` / `return { action: "update", issueNumber: Math.min(...candidateNumbers) };`) 직전에 가드 호출 부재). 즉 가드는 존재하나 build-time 경로에 자동 발동되지 않아, 외부에서 명시 호출하지 않는 한 후보 필터링/최소 number 선택/create-update 분기의 회귀 drift(예: 최소 대신 최대 선택·후보 판정 기준 변경·create/update 경계 오류 — 멱등 회귀 보호/이슈 중복 방지 위반)를 분기-결정↔searchHits/marker 독립 재유도 축에서 잡지 못한다. 본 task 는 그 짝을 닫는다 — 컴포저가 산출 `RealDataResultIssueAction` 을 반환하기 **직전** 동일 가드로 self-assert 해, 손상된 action 이 step④ 박제/gh 호출 wiring 으로 새기 전 호출 시점에 fail-fast throw 하도록 배선한다. **T-0702 outcome-report self-wire 의 result-issue-action mirror — 가드 신설(T-0703)/self-wire 분리 패턴(T-0701→T-0702 동형)의 짝 닫기**. 단, 본 컴포저는 **return 사이트가 둘(create 분기·update 분기)** 이라는 점이 outcome-report(단일 return)와 다르다 — self-assert 를 두 분기 모두에서 발동시켜야 한다(아래 Acceptance Criteria 참조).

## Required Reading

- `test/helpers/realdata-e2e-result-issue-action.ts` — self-wire 대상 leaf 컴포저. **두 return 사이트**: (1) 후보 0건 `return { action: "create" };`, (2) 후보 1+건 `return { action: "update", issueNumber: Math.min(...candidateNumbers) };`. 본 task 는 각 분기에서 산출 action 을 const 로 받아 `assertRealDataResultIssueActionConsistentWithInputs(action, searchHits, marker)` self-assert 후 반환하도록 배선한다. import 추가 1줄(T-0703 가드 helper) + 각 return 직전 `const action: RealDataResultIssueAction = {...}; assertRealDataResultIssueActionConsistentWithInputs(action, searchHits, marker); return action;` 패턴. 기존 입력 guard(`assertMarkerNonBlank(marker)`·hit 별 `assertPositiveNumber(hit.number)`) 호출 / 후보 추출 로직 / 입력 mutate 0 / 매 호출 새 action 객체 / 결정론(최소값 선택) 계약은 불변 유지. **단일 return 으로의 리팩터는 Out of Scope** — 두 분기 각각에 self-assert 만 추가(최소 diff).
- `test/helpers/realdata-e2e-result-issue-action-consistency.ts` — 호출할 가드 `assertRealDataResultIssueActionConsistentWithInputs(action: RealDataResultIssueAction, searchHits: RealDataResultIssueSearchHit[], marker: string): void`(T-0703 신설). 시그니처(3 인자 `action, searchHits, marker`)·throw 정책(구조 결손/type 위반 TypeError / 독립 재유도 expected 와 deep-equal drift RangeError·한국어 명세형 메시지)·single-source 재유도(컴포저 재호출 0 — 후보 추출·최소 선택·create/update 분기 가드 안에서 독립 재구현 후 입력 `action` 과 deep-equal)·read-only(입력 mutate 0)·컴포저 input guard 동형 위반(빈 marker·비양수 number)을 재유도 단계 throw 로 전파 확인. **본 task 는 이 가드 파일을 수정하지 않는다**(호출만).
- `test/helpers/realdata-e2e-result-issue-action.spec.ts` — 컴포저 colocated spec(create/update 분기·멱등 최소선택·marker/number guard·결정론 describe 블록). self-wire 배선 후 정상 분기(create 경로·update 경로 둘 다)가 self-assert 를 통과해 throw 0 으로 정상 반환함을 추가 검증하고, 기존 happy/negative case 가 self-assert 통과를 깨지 않음을 확인. self-wire 발동 회귀 test(jest.spyOn(consistency 모듈) 호출 1회·인자 순서·반환 action 동일성)를 본 spec 에 추가한다.
- `docs/tasks/T-0702-realdata-e2e-outcome-report-summary-line-consistency-self-wire.md` — **self-wire mirror 선례**(머지 f4ab99df). 반환 직전 `const X = {...}; assert...(X); return X;` 호출 + 책임 주석 구조·정상 시 동일 반환·가드 read-only(mutate 0)·위임 가드 throw 선전파·spec self-wire 회귀 test(jest.spyOn 호출 1회 검증) 패턴을 본 task 와 동형 차용. **차이 2점**: (1) 본 task 의 가드는 3 인자(`action, searchHits, marker`)라서 인자 순서 검증을 3 인자 기준으로, (2) 본 컴포저는 **return 사이트가 둘(create·update)** 이라 self-assert 를 양 분기에 각각 배선(outcome-report 단일 return 과 다름) — spec 에서도 create 경로·update 경로 각각에서 호출 1회 검증.
- `docs/tasks/T-0703-realdata-e2e-result-issue-action-consistency-guard.md` — 본 task 가 호출하는 가드의 신설 task(머지 7a34aa77). 가드의 회귀 유형(최소 대신 최대 선택·후보 판정 drift·create/update 경계 오류)·throw 분기(TypeError 구조·type / RangeError 재유도 drift)·재유도 정책(컴포저 재호출 0, 후보·분기 독립 재구현) 확인(본 task 는 호출만 하므로 가드 본문 변경 0).

## Acceptance Criteria

- [ ] `test/helpers/realdata-e2e-result-issue-action.ts` 의 `resolveRealDataResultIssueAction` 가 **두 return 사이트 각각에서** 산출 action 을 반환하기 직전 `assertRealDataResultIssueActionConsistentWithInputs(action, searchHits, marker)` 를 호출하도록 배선한다(`import { assertRealDataResultIssueActionConsistentWithInputs } from "./realdata-e2e-result-issue-action-consistency";` 추가 + create 분기 `const action: RealDataResultIssueAction = { action: "create" }; assertRealDataResultIssueActionConsistentWithInputs(action, searchHits, marker); return action;`, update 분기 `const action: RealDataResultIssueAction = { action: "update", issueNumber: Math.min(...candidateNumbers) }; assertRealDataResultIssueActionConsistentWithInputs(action, searchHits, marker); return action;` 형태). 정상 분기면 가드는 void → 동일 action 반환·형태 보존(관측 불가능하게 동일).
- [ ] 기존 입력 guard(`assertMarkerNonBlank(marker)`·후보 추출 전 hit 별 `assertPositiveNumber(hit.number)` 루프)는 **유지** — 본 task 는 신규 가드 호출을 각 분기 산출 직후·반환 직전에 추가하며 기존 입력 guard 호출/후보 추출(`searchHits.filter(...).map(...)`)을 제거/변경하지 않는다.
- [ ] self-wire 배선 외 컴포저 로직(후보 추출·`Math.min` 최소 선택·create/update 분기·입력 mutate 0·매 호출 새 객체·결정론 계약)은 변경 0. 새 분기/정규화/복구 추가 0(신규 가드는 read-only fail-fast 만). **단일 return 리팩터 금지** — 두 분기 각각에 self-assert(최소 diff). 기존 guard throw 선전파 정책 불변.
- [ ] production `src/` 코드 변경 0 · 새 외부 dependency 0 · schema/migration 0 · env/네트워크/credential 0. test helper 단독 변경(컴포저 본체 + colocated spec).
- [ ] happy-path unit test 1+ (양 분기) — colocated spec 에서 `resolveRealDataResultIssueAction(searchHits, marker)` 가 (1) 후보 0건(create 분기) (2) 후보 1+건(update 분기) 각각에 대해 self-assert 를 통과해 throw 0 으로 정상 반환함을 검증. 반환 action 구조(create: `{action:'create'}`, update: `{action:'update', issueNumber}`)·멱등 최소 number 선택 보존도 확인.
- [ ] error path unit test 1+ — 기존 입력 guard 가 비식별 입력(빈/공백 marker, 0/음수/비정수 hit.number)에 throw 하는 정책은 기존 spec 이 cover. self-wire 가 **정상 산출물에 대해 신규 가드를 우회/중복 throw 시키지 않음**을 검증(유효 입력의 정상 action → throw 0). 신규 가드가 손상 action 에 throw 하는 정책은 T-0703 spec 이 cover — 본 task 는 컴포저 정상 경로(양 분기)가 self-assert 를 깨지 않음에 집중.
- [ ] flow / branch cover — self-wire 삽입으로 새 분기는 없으나(가드 호출은 각 return 직전 직선 경로), 컴포저의 분기(create 경로·update 단일후보·update 다수후보 최소선택·각 입력 guard throw 경로)마다 정상/throw 를 test 1+ 로 cover. 정상 경로(양 분기 모두)는 신규 가드 self-assert 통과(throw 0) 확인.
- [ ] negative cases 충분 cover — 단일 negative 만 작성 금지. 최소: (1) 빈/공백 marker → 입력 guard throw(기존 cover, 신규 가드 미도달 — self-wire 가 기존 throw 정책을 깨지 않음), (2) 0/음수/비정수 hit.number → 입력 guard throw, (3) 후보 0건 유효 입력 → create 분기 신규 가드 self-assert 통과(throw 0)·반환 `{action:'create'}` 보존, (4) 후보 다수 유효 입력 → update 분기 최소 number self-assert 통과(throw 0)·반환 `{action:'update', issueNumber: 최소}` 보존, (5) self-wire 발동 증명 회귀 test 1+(양 분기 각각 신규 가드를 정확히 1회 호출 — self-wire 누락 시 fail).
- [ ] regression test 1+ (self-wire 발동 증명) — 본 self-wire 가 실제로 신규 가드를 호출함을 입증하는 test. jest.spyOn 으로 `assertRealDataResultIssueActionConsistentWithInputs` 호출이 create 경로·update 경로 각 정상 호출마다 정확히 1회 발생함을 검증, 인자 순서(`action, searchHits, marker` — action 은 반환 객체와 deep-equal, searchHits/marker 는 입력 동일 참조)도 확인. self-wire 가 누락되면 fail 하도록.
- [ ] `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%) — 컴포저 helper line/branch/func/stmt 보존(self-wire 후에도 100% 유지 목표), 전역 threshold ok.
- [ ] `pnpm lint && pnpm build && pnpm test` green.
- [ ] colocated spec 위치: `test/helpers/realdata-e2e-result-issue-action.spec.ts`(컴포저와 colocated, 기존 파일). 새 공용 mock helper 추출 불요 — 기존 spec 의 searchHits/marker fixture + T-0702 self-wire spec 패턴(jest.spyOn) 재사용.

## Out of Scope

- **가드 파일(`realdata-e2e-result-issue-action-consistency.ts`) 수정** — 본 task 는 호출(self-wire)만. 가드 본문/시그니처/에러 정책/재유도 로직은 T-0703 그대로 불변.
- **기존 입력 guard(`assertMarkerNonBlank`/`assertPositiveNumber`) 제거/변경** — 유지. 본 task 는 신규 가드 호출 추가만(각 분기 산출 직후·반환 직전).
- **단일 return 으로의 컴포저 리팩터** — 두 분기 각각에 self-assert 만 추가(최소 diff). create/update 분기 구조 자체는 불변.
- **상위 종단 가드(command-plan T-0696 / gh-command-plan T-0695) self-wire/수정** — 별개 가드. 본 task 범위 밖.
- **production `src/` 코드 변경** — step④ 박제 wiring·서비스 등 변경 0.
- **컴포저 정책 변경** — 후보 추출 기준(marker 부분문자열)·최소 number 선택(멱등 회귀 보호)·throw 선전파·결정론·매 호출 새 객체 계약 불변. 자동 복구/정규화/기본값 채움 0.
- **다른 leaf 가드/컴포저 신설/배선** — 본 task 는 result-issue-action self-wire 단일 짝만. 그 외 잔여 NO-GUARD leaf(live-gating/result-summary/result-issue-descriptor) 가드 신설은 후속.
- **live execFile / 실 gh spawn / 실 `gh search issues`·`gh issue create/edit` / 실 EvaluationResult 산출 / Ollama / live-LLM(ADR-0045) / credential wiring** — build-time 순수 가드 배선만.
- **schema / migration / 새 dependency / auth 변경** — 없음. 하나라도 필요해지면 즉시 멈추고 BLOCKED(planner 재호출).

## Suggested Sub-agents

implementer → tester (self-wire 선례 T-0702 거의 동형 — architect 생략. 컴포저 1줄 import + 두 return 사이트(create·update)에서 각각 const action 선언 + 반환 직전 신규 가드 self-assert 삽입(기존 입력 guard·후보 추출 유지) + spec self-wire 회귀 test 추가(양 분기 jest.spyOn 호출 1회 검증)). **return 이 둘이라는 점이 T-0702 와 유일한 구조 차이** — implementer 가 양 분기 모두 배선 주의.

## Follow-ups

- (본 task 머지 후) result-issue-action 측 build-time consistency 사슬 완결 점검 — 분기 정합 가드(T-0703) 신설 + 컴포저 self-wire(본 task) 닫힘 후, 잔여 NO-GUARD leaf(live-gating, result-summary, result-issue-descriptor) 가드 신설 여부 case-by-case survey 로 planner 가 다음 짝 큐잉.
- step③/step⑤ build-time consistency 사슬 self-wire 잔여 sweep 점검.
