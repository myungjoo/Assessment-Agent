---
id: T-0703
title: realdata-e2e result-issue-action 분기 결정 ↔ searchHits/marker 재유도 정합 가드 신설
phase: P5
status: DONE
commitMode: pr
coversReq: [REQ-059, REQ-032]
estimatedDiff: 290
estimatedFiles: 2
created: 2026-06-27
plannerNote: "P5 build-time consistency sweep — NO-GUARD leaf resolveRealDataResultIssueAction(T-0584) 의 create-or-update 분기·최소 issueNumber 결정을 searchHits/marker 로 독립 재유도해 대조하는 정합 가드 신설"
touchesFiles:
  - test/helpers/realdata-e2e-result-issue-action-consistency.ts
  - test/helpers/realdata-e2e-result-issue-action-consistency.spec.ts
dependsOn: []
independentStream: realdata-e2e-result-issue-action-guard
---

# T-0703 — realdata-e2e result-issue-action 분기 결정 ↔ searchHits/marker 재유도 정합 가드 신설

## Why

P5 build-time consistency 사슬의 잔여 NO-GUARD leaf 를 닫는다. `resolveRealDataResultIssueAction(searchHits, marker)`(T-0584, `test/helpers/realdata-e2e-result-issue-action.ts`)는 `gh search issues` 응답(`RealDataResultIssueSearchHit[]`) + 멱등 marker 를 입력받아 create-or-update 분기를 결정하는 leaf resolver 다 — body 가 marker 를 포함하는 후보 0건이면 `{action:'create'}`, 1+건이면 후보 중 **최소 number(가장 오래된 이슈)** 로 `{action:'update', issueNumber}` 를 산출한다(멱등 회귀 보호). 이 leaf 는 직결 step④ 박제 경계의 분기 layer 인데, origin/main grep 으로 `*-result-issue-action-consistency.ts` 가드 파일·`assertRealDataResultIssueActionConsistent*` 심볼이 모두 부재함을 확인했다(NO-GUARD leaf). PLAN.md step④ 의 멱등 회귀 보호(이슈 중복 방지) 정합이 build-time 가드로 박제되어 있지 않은 잔여 gap 이다.

본 task 는 가드 내부에서 `searchHits`/`marker` 만으로 expected action 을 **독립 재유도**(컴포저 `resolveRealDataResultIssueAction` 재호출 금지 — 재호출은 동일 로직 drift 를 잡지 못함)한 뒤, 컴포저 산출 action 과 deep-equal 대조하는 순수 가드를 신설한다. 핵심은 후보 추출(`body.includes(marker)`)·최소 number 선택·create/update 분기를 가드 안에서 재구현해, 컴포저의 후보 필터링/멱등 선택 로직이 회귀로 drift(예: 최소 대신 최대 선택·후보 판정 기준 변경·create/update 경계 오류)하면 build-time 에 fail-fast 로 잡히게 한다(REQ-032 이슈 중복 방지 멱등 정합, REQ-059 raw 미저장 — action 이 body/title 을 보유하지 않음도 함께 단언). T-0701/T-0699/T-0695 leaf 가드 신설 패턴과 동형이며, 후속으로 컴포저 self-wire 짝(별도 task)을 닫는다.

새 dependency / schema / security 결정 없음 — test helper 단독 신설(타입 import 재사용만). BLOCKED 사유 후보 없음.

## Required Reading

- `test/helpers/realdata-e2e-result-issue-action.ts` — 가드 대상 leaf 컴포저. 후보 추출(`body.includes(marker)` L124~127)·최소 number 선택(`Math.min` L135)·create/update 분기(L130~135)·marker/number guard(L80~96)를 그대로 single source 로 삼아 가드 안에서 독립 재유도한다(재호출 금지). 입력 타입 `RealDataResultIssueSearchHit`·출력 타입 `RealDataResultIssueAction` import 재사용.
- `test/helpers/realdata-e2e-result-issue-publish-plan-consistency.ts` — 기존 leaf 가드의 throw 분기(구조 결손 TypeError / 값 정합 위반 RangeError 분리) + 한국어 명세형 에러 메시지 스타일 참조.
- `test/helpers/realdata-e2e-result-issue-search-argv-consistency.ts` — leaf "보존(preserves)" 가드의 colocated spec 케이스 구성 참조(happy / 필드별 drift negative / 비변형 / 결정론).
- `test/helpers/realdata-e2e-result-issue-action.spec.ts` — 컴포저의 기존 분기 테스트(create/update/최소 number/멱등) 케이스 구성을 참조해 가드 spec 의 정상 입력 fixture 를 합성.

## Acceptance Criteria

신규 파일 2개(colocated spec 우선):
- 가드: `test/helpers/realdata-e2e-result-issue-action-consistency.ts`
- spec: `test/helpers/realdata-e2e-result-issue-action-consistency.spec.ts` (colocated)

- [ ] 순수 가드 함수 1개 export (예: `assertRealDataResultIssueActionConsistentWithInputs(action: RealDataResultIssueAction, searchHits: RealDataResultIssueSearchHit[], marker: string): void`). 인자 외 상태(시각·난수·env) 의존 0, 입력 mutate 0, 정상이면 void 반환(동작·반환값 보존).
- [ ] 가드 내부에서 `searchHits`/`marker` 만으로 expected action 을 **독립 재유도**(컴포저 `resolveRealDataResultIssueAction` 재호출 금지 — 본 가드는 후보 추출·최소 number 선택·create/update 분기의 독립 재구현이 핵심)한 뒤 입력 `action` 과 deep-equal 대조. 불일치 시 한국어 명세형 에러 throw.
- [ ] 구조 결손(action 이 discriminated union 형태가 아님·필드 타입 불일치·update 인데 issueNumber 부재 등)과 값 정합 위반(expected create 인데 update / issueNumber mismatch / 후보 다수 시 최소 아닌 값)을 분리된 에러 종류/분기로 throw(기존 leaf 가드의 TypeError/RangeError 분리 스타일 정합).
- [ ] **Happy-path test**: 정상 입력(후보 0건→create / 후보 1건→update / 후보 2+건→최소 number update)에서 컴포저로 산출한 action 에 대해 가드가 void 반환(throw 0) 각 분기 1+.
- [ ] **Error path test**: action 을 변조한(예: create↔update 뒤바뀜 / update issueNumber 를 후보 최소 아닌 값으로 / 후보 0건인데 update 로) action 에 대해 가드가 throw 1+ 각 변조 종류별.
- [ ] **Branch / flow coverage**: 가드 내 모든 분기(구조 결손 throw vs 값 정합 위반 throw vs create 분기 정상 vs update 분기 정상)별 test 1+.
- [ ] **Negative cases 충분 cover** — 다음 예외 상황 각 1+ test: (a) marker 빈/공백(컴포저 marker guard 와 동형 — 가드도 동일 throw), (b) searchHits 중 number 0/음수/비정수(number guard 동형 throw), (c) 후보 다수인데 입력 action.issueNumber 가 최소값이 아님(멱등 회귀 보호 위반), (d) 후보 0건인데 action 이 update / 후보 1+건인데 action 이 create(분기 경계 오류), (e) action 객체 형태 결손(action 필드 누락·update 인데 issueNumber undefined), (f) 입력 순서가 다른 동일 후보 집합에서 동일 issueNumber 재유도(결정론), (g) 정상 입력 비변형(가드 호출 전후 action/searchHits deep-equal 불변). 단일 negative 만 작성 금지 — 변조 분기마다 cover.
- [ ] **결정론/무공유 test**: 동일 입력 두 번 가드 호출 → 동일 결과(void), 가드가 action·searchHits 배열·각 hit 객체를 mutate 하지 않음 검증.
- [ ] `pnpm lint && pnpm build` green.
- [ ] `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%) — 신규 가드 파일 line/branch/func/stmt 100% 목표.

## Out of Scope

- `test/helpers/realdata-e2e-result-issue-action.ts` 컴포저 본문 수정 / self-wire 배선 — 본 task 는 **가드 신설만**(self-wire 짝 닫기는 후속 별도 task, T-0701→T-0702 패턴 동형).
- command-plan / gh-command-plan 등 상위 종단 가드(T-0696/T-0695) 수정 — 본 가드와 책임 분리(그쪽은 plan 전체 재유도, 본 가드는 action 분기 단일 책임).
- 명령-args 합성(T-0583 `buildRealDataResultIssueCommandArgs`)·gh argv 와의 통합 — 본 가드는 create-or-update 분기 + 최소 issueNumber 결정 단일 책임.
- production `src/` 코드 변경 — test helper 단독(타입 import 재사용만).
- 실 gh 호출 / `gh search issues` / execFile / 이슈 실 박제 / live wiring (step④ live, credential gate, deferred).

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(생성 시 비어있음 — sub-agent가 관련 작업 발견 시 추가)
