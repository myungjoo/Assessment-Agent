---
id: T-0695
title: realdata-e2e result-issue gh-command-plan 종단 컴포저 산출 ↔ (stdout, commandArgs) single-source 재유도 정합 순수 가드 신설
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-030, REQ-059]
estimatedDiff: 255
estimatedFiles: 2
created: 2026-06-27
plannerNote: P5 109행 step④ — result-issue gh-command-plan 종단 컴포저(T-0588) 정합 가드 신설(plan↔(stdout,commandArgs) 재유도 대조). guard category × 1.5 × 1.0.
touchesFiles:
  - test/helpers/realdata-e2e-result-issue-gh-command-plan-consistency.ts
  - test/helpers/realdata-e2e-result-issue-gh-command-plan-consistency.spec.ts
dependsOn: []
independentStream: realdata-e2e-consistency-guard
---

# T-0695 — realdata-e2e result-issue gh-command-plan 종단 컴포저 산출 ↔ (stdout, commandArgs) single-source 재유도 정합 순수 가드 신설

## Why

PLAN 109행(🟢 실 평가 e2e, P5)의 build-time consistency 가드 사슬에서 seed-side / evaluate-side / step④ daily-step-eval 진입측 leaf 컴포저들은 "가드 신설 → self-wire" 짝이 모두 닫혔다(T-0687→T-0688, T-0691→T-0692, T-0693→T-0694 등). step④ 결과 박제(daily-test 결과를 result/rolling 이슈에 박제)의 **종단 합성 컴포저** `resolveRealDataResultIssueGhCommandPlan(stdout, commandArgs)`(`realdata-e2e-result-issue-gh-command-plan.ts`, T-0588)는 (1) `parseRealDataResultIssueSearchOutput(stdout)` → (2) `resolveRealDataResultIssueAction(hits, searchQuery)` → (3) `buildRealDataResultIssueGhArgv(action, commandArgs)` 3-단계를 합성해 `{action, argv}` plan 을 산출하는데, 이 종단 컴포저에는 **독립 정합 가드가 없다**(origin/main grep 0 확인 — `assertRealDataResultIssueGhCommandPlan*` 심볼·`*-gh-command-plan-consistency.ts` 파일 부재, 컴포저 본문 self-wire 부재). argv-leaf 가드(`assertRealDataResultIssueGhArgvPreservesCommandArgs`, T-0653)는 argv 가 `action + commandArgs` 를 보존하는지(한 단계 downstream)만 검증할 뿐, **종단 컴포저의 산출 plan 전체가 입력 `(stdout, commandArgs)` 로부터 single-source 재유도한 plan 과 정합하는지**(parse→resolve→build 3-단계 합성 순서·분기 매핑이 어긋나지 않았는지)를 강제하는 장치는 없다. 따라서 합성 회귀(action 분기 오매핑 — create/update 뒤바뀜, argv↔action 어긋남, hits 재해석 drift, marker(=searchQuery) 재합성, §9 credential 값 argv 누출)를 build-time 에 잡지 못한다. 본 task 는 그 짝의 **앞 절반(가드 신설)** 을 박제한다 — 산출 plan 을 입력 `(stdout, commandArgs)` 로 동일 3 위임 helper 를 재호출해 single-source 재유도한 expected plan 과 대조하는 read-only fail-fast 순수 가드를 신설한다. self-wire(컴포저 반환 직전 배선)는 후속 task 로 짝을 닫는다. **T-0693 daily-step-eval-command-plan 가드 신설의 result-issue-side mirror**.

## Required Reading

- `test/helpers/realdata-e2e-result-issue-gh-command-plan.ts` — 가드 대상 종단 컴포저. 산출 타입 `RealDataResultIssueGhCommandPlan`({action, argv}) + 3-단계 합성 순서(parse→resolveAction→buildGhArgv) + 위임 helper throw 전파 정책 확인. 가드는 이 컴포저가 import 하는 동일 3 helper(`parseRealDataResultIssueSearchOutput`, `resolveRealDataResultIssueAction`, `buildRealDataResultIssueGhArgv`)와 출력 type 을 import 재사용해 expected plan 을 single-source 재유도한다(합성 규칙 재구현 0 — 위임 재호출만, 중복 정의 0). **본 task 는 이 컴포저 파일을 수정하지 않는다**(self-wire 는 후속).
- `test/helpers/realdata-e2e-result-issue-gh-argv-consistency.ts` (origin/main, T-0653 신설) — **argv-leaf 가드 선례**. single-source 재유도(여기선 argv↔action+commandArgs) 대조 구조·throw 정책(구조 결손 = TypeError / 값 정합 위반 = RangeError·한국어 명세형 메시지에 기대값 vs 실측값 노출)·read-only(입력 mutate 0)·결정론·자동 복구 0·byte-identical 비교 패턴을 본 task 와 동형 차용. **본 가드는 그 한 단계 upstream(종단 plan 전체) 정합을 검증한다** — argv-leaf 가드가 cover 하는 argv↔commandArgs 는 재검증하지 않고(중복 회피), action 분기 매핑과 3-단계 합성 정합에 집중한다.
- `test/helpers/realdata-e2e-result-issue-gh-command-plan.spec.ts` (origin/main, T-0588) — 컴포저 colocated spec 의 R-112 cover 구조 + `makeCommandArgs()` fixture(searchQuery=marker, create/update 인자 묶음) + create/update 분기 stdout fixture("[]" / marker 포함 hit 배열) 재사용 참고. 가드 spec 의 정상/회귀 plan fixture 구성에 차용.
- `test/helpers/realdata-e2e-daily-step-eval-command-plan-consistency.ts` (origin/main, T-0693) — **종단 컴포저 정합 가드 mirror 선례**. plan 산출물을 입력으로 helper 재호출해 single-source 재유도 후 대조하는 구조·throw 분기·colocated spec 패턴을 본 task 와 동형 차용(여기선 (stdout, commandArgs) 입력 + create/update 분기).

## Acceptance Criteria

- [ ] 신설 가드 파일 `test/helpers/realdata-e2e-result-issue-gh-command-plan-consistency.ts` 에 `assertRealDataResultIssueGhCommandPlanConsistentWithInputs(plan, stdout, commandArgs)`(또는 동형 시그니처 — 산출 plan + 입력 `(stdout, commandArgs)` 를 받아 입력으로 expected plan 재유도) 를 export 한다. 가드는 입력 `(stdout, commandArgs)` 로 동일 3 위임 helper(`parseRealDataResultIssueSearchOutput` → `resolveRealDataResultIssueAction` → `buildRealDataResultIssueGhArgv`)를 재호출해 expected `{action, argv}` 를 single-source 재유도한 뒤, 산출 plan 과 정합하는지 대조한다: (a) `plan.action` 이 재유도 action 과 deep equal(분기 종류 create/update + update 시 issueNumber 일치), (b) `plan.argv` 가 재유도 argv 와 배열 길이·원소까지 byte-identical 정합. 불일치 시 한국어 명세형 에러로 fail-fast throw(구조 결손 = TypeError / 값 정합 위반 = RangeError, 기대값 vs 실측값 노출). 합성 규칙(parse/resolve/build 로직)은 위임 재호출로만 재유도(중복 정의 0).
- [ ] 가드는 **read-only fail-fast** 만 — 입력 `plan`/`stdout`/`commandArgs` 를 mutate 0, 자동 복구/정규화/기본값 채움/재합성 0. 정상 정합이면 void 반환(부수효과 0). 가드는 결정론(입력만의 함수, 시각/난수/전역 env 의존 0). raw 미저장(R-59) — argv 의 title/body/label string 만 비교(narrative 본문 미접촉).
- [ ] production `src/` 코드 변경 0 · 새 외부 dependency 0 · schema/migration 0 · env/네트워크/credential 0 · 컴포저 파일(`realdata-e2e-result-issue-gh-command-plan.ts`) 수정 0(self-wire 는 후속). test helper 단독 신설.
- [ ] happy-path unit test 1+ — colocated spec 에서 정상 plan(후보 0건 stdout="[]" → create plan / marker 포함 hit 배열 stdout → update plan)에 대해 가드가 void(throw 0) 임을 검증. 정상 입력의 양 분기(create/update) 모두 통과 확인. 후보 2+ 건 → 최소 number update 멱등 합성도 통과 확인.
- [ ] error path unit test 1+ — 손상 plan(예: create 인데 plan.action 이 update / argv 가 재유도 argv 와 다름 / plan.action.issueNumber 가 재유도와 불일치)에 대해 가드가 throw 함을 각 1+ test 로 검증. 추가로 구조 결손(plan null/undefined·plan.argv 비배열·plan.action 분기값 오류) → TypeError 분기 검증.
- [ ] flow / branch cover — 가드의 모든 대조 분기(create 경로의 action 대조 + argv 대조 / update 경로의 action+issueNumber 대조 + argv 대조 / 구조 검증 분기)마다 통과 case 와 실패 case 각 1+ test.
- [ ] negative cases 충분 cover — 단일 negative 만 작성 금지, 각 회귀 유형마다 분리: (1) action 분기 오매핑(create 인데 plan 이 update 또는 그 반대 — stdout 후보 유무와 어긋남), (2) update issueNumber drift(재유도 최소 number 와 plan.action.issueNumber 불일치), (3) argv 동사 drift(`issue create` ↔ `issue edit` 어긋남), (4) argv title/body 위치 drift(재유도 argv 와 byte 불일치), (5) argv label flag-pair 길이/순서 어긋남, (6) argv 잉여/누락 원소(재유도 argv 와 길이 불일치) — 각 1+ test.
- [ ] `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%) — 신설 가드 helper 의 line/branch/func/stmt 높은 cover(가능하면 100%), 전역 threshold ok.
- [ ] `pnpm lint && pnpm build && pnpm test` green.
- [ ] colocated spec 위치: `test/helpers/realdata-e2e-result-issue-gh-command-plan-consistency.spec.ts`(가드와 colocated, 신설). 새 공용 mock helper 추출 불요 — 컴포저 기존 spec 의 `makeCommandArgs()` fixture + create/update stdout fixture + T-0693/T-0653 가드 spec 패턴 재사용.

## Out of Scope

- **컴포저 self-wire(반환 직전 가드 호출 배선)** — 본 task 는 가드 신설만. 컴포저 `resolveRealDataResultIssueGhCommandPlan` 본문 반환 직전에 가드 호출을 삽입하는 self-wire 는 후속 task(짝 닫기, T-0694 패턴).
- **위임 helper(parse/resolveAction/buildGhArgv) 수정** — 본 task 는 호출(재유도)만. 각 helper 의 합성 규칙·시그니처 불변.
- **argv-leaf 가드(`gh-argv-consistency.ts`, T-0653)가 이미 cover 하는 argv↔commandArgs round-trip 재검증** — 본 가드는 종단 plan 전체(action 분기 + argv) 의 (stdout,commandArgs) single-source 재유도 정합에 집중. argv 내부 위치 정합 세부는 leaf 가드 책임(중복 회피 — 단 재유도 argv 와 plan.argv 의 byte-identical 대조는 본 가드가 수행).
- **production `src/` 코드 변경** — 타입·위임 helper import 재사용만.
- **gh repo slug / `--repo owner/repo` 인자 정합** — 컴포저가 산출하는 argv 범위만(repo 컨텍스트는 caller 책임).
- **다른 leaf 가드 신설/배선** — 본 task 는 gh-command-plan 종단 컴포저 가드 단일 신설만. 그 외 step④ 확장은 후속.
- **live execFile / 실 gh spawn / 실 issue create/edit / Ollama / live-LLM(ADR-0045) / credential wiring** — build-time 순수 가드 신설만.
- **schema / migration / 새 dependency / auth 변경** — 없음. 하나라도 필요해지면 즉시 멈추고 BLOCKED(planner 재호출).

## Suggested Sub-agents

implementer → tester (가드 신설 선례 T-0693/T-0653 명확 — architect 생략. 신설 가드 파일 1개 + colocated spec 1개. single-source 재유도(3 위임 helper 재호출) 대조 + 분기별 throw + R-112 4종 + negative 충분 cover).

## Follow-ups

- (본 task 머지 후) gh-command-plan 종단 컴포저 **self-wire** 짝 닫기 task — 컴포저 반환 직전 `assertRealDataResultIssueGhCommandPlanConsistentWithInputs(plan, stdout, commandArgs)` 호출 배선(T-0694 self-wire 패턴). 가드가 build-time 경로에 자동 발동되도록.
- step④ result-issue 측 build-time consistency 사슬의 잔여 leaf(publish-plan / outcome-report-from-output 등 이미 가드 존재 여부 재survey) 완결 점검 후 planner 가 다음 짝 큐잉.
