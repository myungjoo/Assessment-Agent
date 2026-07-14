---
id: T-0983
title: eval-chain 수집 요청 조립 helper 반환 직전 consistency drift-guard self-wire (buildRealDataE2eEvalChainCollectRequest 산출을 즉시 자가 검증)
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-032, REQ-059]
estimatedDiff: 85
estimatedFiles: 2
created: 2026-07-14
independentStream: realdata-e2e-eval-chain
dependsOn: []
touchesFiles:
  - test/helpers/realdata-e2e-eval-chain-collect-request.ts
  - test/helpers/realdata-e2e-eval-chain-collect-request.spec.ts
plannerNote: "P5 §109 test-hardening — T-0981 로 봉한 collect-request consistency 가드를 producer 반환 직전 self-wire(T-0977/T-0982 self-wire mirror). 이 배선으로 input·activity-map·collect-request 3 leg 모두 helper→consistency→self-wire 삼단 완결. T-0981 이미 main 박제라 dep[]. test-only pr-mode 2파일 file-disjoint stage5b 병렬."
---

# T-0983 — eval-chain 수집 요청 조립 helper 반환 직전 consistency drift-guard self-wire

## Why

PLAN.md 109행(실 github myungjoo/leemgs 수집 → 로컬 Ollama 실 LLM 평가 e2e)의 수집 leg 에서, 수집 plan entry(host/path)와 인증 token 으로 실 github REST 호출용 `GithubRequestInput` 을 bounded single(per_page="1") 로 조립하는 로직을 T-0980 이 순수 helper `buildRealDataE2eEvalChainCollectRequest`(`test/helpers/realdata-e2e-eval-chain-collect-request.ts`)로 봉했고, T-0981 이 그 조립 규칙(host/path 귀속 · query.per_page="1" bounded single · token §9 field-only 통과)을 독립 oracle 로 재유도해 대조하는 drift-guard `assertRealDataE2eEvalChainCollectRequestConsistent`(`test/helpers/realdata-e2e-eval-chain-collect-request-consistency.ts`, PR #875 이미 main 박제)를 신설했다.

문제는 그 가드가 **아직 producer 에 배선되지 않았다**는 점이다 — 지금은 colocated spec 이 명시적으로 가드를 호출할 때만 drift 를 잡는다. 누군가 helper 의 조립 규칙을 편집(예: per_page="1"→"2" 변경으로 bounded single 파괴, host/path 귀속 오타, token 을 query 에 유입시켜 §9 위반, query override 통로 개방)하면서 oracle(consistency helper)을 함께 고치지 않으면, spec 이 그 특정 조합을 커버하지 않는 한 조용히 통과할 수 있다. 본 task 는 그 빈칸을 **self-wire** 로 채운다 — `buildRealDataE2eEvalChainCollectRequest` 가 `GithubRequestInput` 을 반환하기 **직전** `assertRealDataE2eEvalChainCollectRequestConsistent(entry, token, result)` 를 스스로 호출해 조립 즉시 자가 검증하도록 한다. 이렇게 하면 helper 의 규칙과 oracle 의 규칙이 어긋나는 순간 **모든 호출 경로(unit spec · live smoke 재사용)** 에서 즉시 fail 하는 live 트립와이어가 된다 — spec 커버리지에 의존하지 않는다.

이는 T-0977(eval-chain-input 조립 self-wire)·T-0982(activity-map 매핑 self-wire) 패턴의 collect-request-leg mirror 이자, T-0982 의 Follow-ups 가 명시적으로 예고한 후속 slice 다. 이 배선까지 봉하면 eval-chain 3 sub-leg(input · activity-map · collect-request) 모두 helper→consistency→self-wire 삼단 완결이 된다. self-wire 는 정합 산출에 대해서는 tautology(항상 void)라 정상 동작을 바꾸지 않고, drift 도입 시에만 throw 한다. T-0981 이 이미 main 에 머지됐으므로 `dependsOn: []`(선행 가드가 이미 박제됨).

## Required Reading

- `test/helpers/realdata-e2e-eval-chain-collect-request.ts` (T-0980) — self-wire 대상 producer. `buildRealDataE2eEvalChainCollectRequest(entry, token)` 가 host/path 귀속 + query.per_page="1" bounded single 로 `GithubRequestInput` 객체 literal 을 `return` 하는 지점(현재 마지막 return 문)이 배선 지점. return 직전 결과를 지역 변수(`result`)에 담고 self-assert 후 반환하도록 소폭 리팩터.
- `test/helpers/realdata-e2e-eval-chain-collect-request-consistency.ts` (T-0981, main 박제) — 배선할 가드. `assertRealDataE2eEvalChainCollectRequestConsistent(entry, token, result, label?): void` — 정합이면 void, 구조 결손 = TypeError / 값 정합 위반(host/path/query.per_page/query 구조/token drift) = RangeError. 이 파일은 producer(`collect-request.ts`) 로부터 함수를 import 하지 **않고** `GithubRequestInput`·`RealDataE2eGithubCollectionPlanEntry` 타입만 참조하므로, producer 가 이 파일의 함수를 value import 해도 **런타임 순환 의존 없음**(consistency → collect-request value 엣지 0 — 위 Grep 로 확인됨).
- `test/helpers/realdata-e2e-eval-chain-collect-request.spec.ts` (T-0980) — 확장할 colocated unit spec. 기존 happy/error/branch/negative 배치 형태를 따라 self-wire 검증 case 를 추가한다.
- `src/github/github-request.builder.ts` — `GithubRequestInput` shape 확인용(read-only, 변경 0).

## Acceptance Criteria

- [ ] `test/helpers/realdata-e2e-eval-chain-collect-request.ts` 수정 — `assertRealDataE2eEvalChainCollectRequestConsistent` 를 `./realdata-e2e-eval-chain-collect-request-consistency` 에서 value import 하고, `buildRealDataE2eEvalChainCollectRequest` 가 `GithubRequestInput` 을 반환하기 **직전** `assertRealDataE2eEvalChainCollectRequestConsistent(entry, token, result)` 를 호출한다. 정합 요청이면 void → 그대로 return(정상 동작 무변경), drift 면 가드가 throw(자가 검증). 조립 규칙(host/path 귀속 · per_page="1" · token field-only) 자체는 재정의 0 — 계산은 기존 그대로 두고 return 직전 self-assert 만 추가한다.
- [ ] `test/helpers/realdata-e2e-eval-chain-collect-request.spec.ts` 수정 — self-wire 를 검증하는 R-112 4종 추가(기존 case 회귀 없이):
  - **Happy-path**: self-wire 배선 후에도 `buildRealDataE2eEvalChainCollectRequest` 가 정합 `GithubRequestInput`(host/path 귀속 + query.per_page="1" + token 통과)을 throw 0 으로 정상 반환함을 assert 1+.
  - **Error path**: 기존 방어 guard 가 self-wire 도입으로 가려지지 않음 — entry 비-객체(null 포함) / entry.host 공백 / entry.path 공백 / token 공백·비-string 입력이 여전히 producer 자체(또는 self-assert)의 TypeError/Error 를 던짐을 각 1+ assert.
  - **Flow/branch cover — self-wire 호출 사실 검증**: `jest.spyOn`(또는 동등 spy)으로 consistency 모듈의 `assertRealDataE2eEvalChainCollectRequestConsistent` 를 감싼 뒤 `buildRealDataE2eEvalChainCollectRequest` 호출 시 그 spy 가 `(entry, token, 반환된 result)` 인자로 정확히 1 회 호출됐음을 assert(배선 존재 증명 — self-wire 가 제거되면 이 test 가 fail = de-facto regression guard).
  - **Negative 충분 cover — 예외 상황 분기마다 1+**: (a) 가드가 drift 를 감지하면 producer 호출이 그 예외를 그대로 전파함을 검증(spy 로 가드가 RangeError 를 throw 하도록 mock → `buildRealDataE2eEvalChainCollectRequest` 가 동일 RangeError 를 전파, silent 삼킴 0), (b) self-wire 가 정상 산출을 mutate 하지 않음(반환 `GithubRequestInput` 이 여전히 새 객체 + 새 query 객체, 입력 entry/token 미변형) assert 1+.
  - **§9 secret-safety**: fixture/result/에러 메시지 어디에도 실 secret/token 실 값 미노출(token 은 비시크릿 더미 문자열로만, 에러 메시지에 token 값 미등장) assert 유지(기존 case 재사용 가능).
- [ ] **§9 / R-59 격리**: 실 credential 값을 spec/helper 어디에도 적지 않는다(token fixture 는 비시크릿 더미 string). raw 활동 본문(payload 전문·commit message·diff·issue body)을 파일/전역에 저장하지 않는다.
- [ ] `pnpm lint && pnpm build && pnpm test:cov` 통과(line ≥ 80% / function ≥ 80%). helper·spec 모두 순수/결정론이라 완전 커버.

## Out of Scope

- `test/helpers/realdata-e2e-eval-chain-collect-request-consistency.ts`(T-0981) 본문 수정 0 — value import·호출만(가드 재정의 0). host/path/per_page/token 규칙 재구현 0.
- eval-chain-input(T-0977)·activity-map(T-0982) leg 의 self-wire 는 이미 완결 — 재수정 0.
- `test/smoke/realdata-e2e-eval-chain-live.smoke-spec.ts` 및 형제 helper 수정 0. 실 credential 주입·실 nightly 실행·`deploy/daily-test.sh` step_eval 재배선은 본 task 밖(운영/env 층 §5 게이트).
- `src/` production 코드 변경 0(`GithubRequestInput` 타입 read-only import). `package.json`/lockfile/CI workflow 변경 0. 새 외부 dependency 도입 0.
- 자동 복구/재합성/기본값 채움 0 — 가드가 throw 하면 그대로 전파(복구는 호출처 책임).

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

- eval-chain 3 sub-leg(input·activity-map·collect-request) 삼단(helper→consistency→self-wire) 완결 — 본 task 로 self-wire trip-wire 세트 봉함. 이후 §109 test-hardening 은 다른 vein(예: gating premise·collection plan) 으로 이동.
- §109 잔여(변경 없음): (1) 실 credential 주입 하 credentialed live run 1 회(운영/env 층), (2) `deploy/daily-test.sh` step_eval 이 full-chain smoke(`realdata-e2e-eval-chain-live`)를 실 트리거하도록 재배선 + 결과 daily-test 이슈 박제 — 둘 다 credential/env 게이트라 별도 큐잉.
