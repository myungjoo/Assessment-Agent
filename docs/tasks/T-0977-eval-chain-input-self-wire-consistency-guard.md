---
id: T-0977
title: eval-chain leg 조립 helper 반환 직전 consistency drift-guard self-wire (buildRealDataE2eEvalChainInput 산출을 즉시 자가 검증)
phase: P5
status: DONE
commitMode: pr
prNumber: 871
mergedAs: 07529f88
reviewRounds: 1
completedAt: 2026-07-14T03:16:34Z
coversReq: [REQ-013, REQ-030, REQ-059]
estimatedDiff: 75
estimatedFiles: 2
created: 2026-07-14
independentStream: p5-realdata-e2e-eval-chain-leg
dependsOn: []
touchesFiles:
  - test/helpers/realdata-e2e-eval-chain.ts
  - test/helpers/realdata-e2e-eval-chain.spec.ts
plannerNote: "P5 §109 test-hardening — T-0976 로 봉한 consistency 가드를 producer 반환 직전 self-wire 해 매 호출 자가 검증(T-0682/T-0684 self-wire mirror). T-0976 이미 main 박제라 dep[]. test-only pr-mode 2파일 file-disjoint stage5b 병렬."
---

# T-0977 — eval-chain leg 조립 helper 반환 직전 consistency drift-guard self-wire

## Why

PLAN.md 109행(실 github myungjoo/leemgs 수집 → 로컬 Ollama 실 LLM 평가 e2e)의 두 leg 합류 지점을 T-0975 가 순수 helper `buildRealDataE2eEvalChainInput`(`test/helpers/realdata-e2e-eval-chain.ts`)로 봉했고, T-0976 이 그 helper 의 filter/bound/active/username 규칙을 독립 oracle 로 재유도해 대조하는 drift-guard `assertRealDataE2eEvalChainInputConsistent`(`test/helpers/realdata-e2e-eval-chain-consistency.ts`, PR #870 이미 main 박제)를 신설했다.

문제는 그 가드가 **아직 producer 에 배선되지 않았다**는 점이다. 지금은 spec 이 명시적으로 가드를 호출할 때만 drift 를 잡는다 — 누군가 helper 의 규칙을 편집(예: `slice(0, 1)` → `slice(0, 2)`, active 3-조건 중 하나 누락, attribution predicate 완화)하면서 oracle(consistency helper)을 함께 고치지 않으면, spec 이 그 특정 조합을 커버하지 않는 한 조용히 통과할 수 있다. 본 task 는 그 빈칸을 **self-wire** 로 채운다 — `buildRealDataE2eEvalChainInput` 가 descriptor 를 반환하기 **직전** `assertRealDataE2eEvalChainInputConsistent(gating, collectedActivities, result)` 를 스스로 호출해 조립 즉시 자가 검증하도록 한다. 이렇게 하면 helper 의 규칙과 oracle 의 규칙이 어긋나는 순간 **모든 호출 경로(unit spec · live smoke 재사용)** 에서 즉시 fail 하는 live 트립와이어가 된다 — spec 커버리지에 의존하지 않는다.

이는 T-0682/T-0684 가 production 조립 helper 반환 직전 대응 consistency 가드를 self-wire 한 패턴의 leg-경계 mirror 다. self-wire 는 정합 산출에 대해서는 tautology(항상 void)라 정상 동작을 바꾸지 않고, drift 도입 시에만 throw 한다. T-0976 이 이미 main 에 머지됐으므로 `dependsOn: []`(선행 가드가 이미 박제됨).

## Required Reading

- `test/helpers/realdata-e2e-eval-chain.ts` (T-0975) — self-wire 대상 producer. `buildRealDataE2eEvalChainInput(gating, collectedActivities)` 가 `bounded`/`active`/`username` 을 계산해 descriptor 를 반환하는 마지막 return 문(현재 121~125행)이 배선 지점. gating 비객체 → TypeError, collectedActivities 비배열 → TypeError 방어 guard 는 이미 return 도달 전에 통과하므로, self-wire 는 유효 입력에서만 도달한다.
- `test/helpers/realdata-e2e-eval-chain-consistency.ts` (T-0976, main 박제) — 배선할 가드. `assertRealDataE2eEvalChainInputConsistent(gating, collectedActivities, descriptor): void` — 정합이면 void, drift 면 TypeError(구조)/RangeError(값). 이 파일은 producer 로부터 **type-only** import(`import type { RealDataE2eEvalChainInput }`)만 하므로, producer 가 이 파일의 함수를 value import 해도 **런타임 순환 의존 없음**(consistency → eval-chain 는 타입 소거, eval-chain → consistency 만 런타임 엣지).
- `test/helpers/realdata-e2e-eval-chain.spec.ts` (T-0975) — 확장할 colocated unit spec. 기존 happy/error/branch/negative 배치 형태를 따라 self-wire 검증 case 를 추가한다.
- `src/assessment-collection/domain/activity.ts` — `GithubActivity`(특히 `author` 필드) shape 확인용(read-only, 변경 0).
- `test/helpers/realdata-e2e-live-gating.ts` — `RealDataE2eLiveGating`(`enabled`/`ollama`) shape — fixture 구성용 read-only 참조.

## Acceptance Criteria

- [ ] `test/helpers/realdata-e2e-eval-chain.ts` 수정 — `assertRealDataE2eEvalChainInputConsistent` 를 `./realdata-e2e-eval-chain-consistency` 에서 value import 하고, `buildRealDataE2eEvalChainInput` 가 descriptor 를 반환하기 **직전** `assertRealDataE2eEvalChainInputConsistent(gating, collectedActivities, result)` 를 호출한다. 정합 descriptor 면 void → 그대로 return(정상 동작 무변경), drift 면 가드가 throw(자가 검증). 규칙(filter/bound/active/username) 자체는 재정의 0 — 계산은 기존 그대로 두고 return 직전 self-assert 만 추가한다.
- [ ] `test/helpers/realdata-e2e-eval-chain.spec.ts` 수정 — self-wire 를 검증하는 R-112 4종 추가(기존 case 회귀 없이):
  - **Happy-path**: self-wire 배선 후에도 `buildRealDataE2eEvalChainInput` 가 정합 descriptor 를 정상 반환(throw 0)함을 (i) 유효 활동 1 건, (ii) 유효 활동 다수(→1 건 bound), (iii) 유효 활동 0 건(active:false/빈 activities) 각각에 대해 assert 1+.
  - **Error path**: 기존 방어 guard 가 self-wire 도입으로 가려지지 않음 — gating 비객체/null 및 collectedActivities 비배열 입력이 여전히 producer 자체의 TypeError 를 던짐을 assert 1+(가드 도달 전 차단이므로 메시지가 `buildRealDataE2eEvalChainInput:` 프리픽스 그대로).
  - **Flow/branch cover — self-wire 호출 사실 검증**: `jest.spyOn`(또는 동등 spy)으로 consistency 모듈의 `assertRealDataE2eEvalChainInputConsistent` 를 감싼 뒤 `buildRealDataE2eEvalChainInput` 호출 시 그 spy 가 `(gating, collectedActivities, 반환된 descriptor)` 인자로 정확히 1 회 호출됐음을 assert(배선 존재 증명 — self-wire 가 제거되면 이 test 가 fail = de-facto regression guard). active:true 경로와 active:false 경로 각각 1+.
  - **Negative 충분 cover — 예외 상황 분기마다 1+**: (a) 가드가 drift 를 감지하면 producer 호출이 그 예외를 그대로 전파함을 검증(spy 로 가드가 RangeError 를 throw 하도록 mock → `buildRealDataE2eEvalChainInput` 가 동일 RangeError 를 전파, silent 삼킴 0), (b) self-wire 가 정상 산출을 mutate 하지 않음(반환 descriptor 의 activities 가 여전히 새 배열, 입력 collectedActivities/gating 미변형) assert 1+.
  - **§9 secret-safety**: fixture/descriptor/에러 메시지 어디에도 실 secret/token/apiKey 미등장(비시크릿 username·활동 메타만) assert 유지(기존 case 재사용 가능).
- [ ] **§9 / R-59 격리**: 실 credential 값을 spec/helper 어디에도 적지 않는다(gating fixture 는 enabled/ollama-존재 여부만 표현하는 더미 구조). raw 활동 본문을 파일/전역에 저장하지 않는다.
- [ ] `pnpm lint && pnpm build && pnpm test:cov` 통과(line ≥ 80% / function ≥ 80%). helper·spec 모두 순수/결정론이라 완전 커버.

## Out of Scope

- `test/helpers/realdata-e2e-eval-chain-consistency.ts`(T-0976) 본문 수정 0 — value import·호출만(가드 재정의 0). filter/bound/active/username 규칙 재구현 0.
- `test/smoke/realdata-e2e-eval-chain-live.smoke-spec.ts` 및 두 half-leg spec(T-0610/T-0806) 수정 0. 실 credential 주입·실 nightly 실행·`deploy/daily-test.sh` step_eval 재배선은 본 task 밖(운영/env 층 §5 게이트).
- `src/` production 코드 변경 0(`GithubActivity`/`RealDataE2eLiveGating` 타입 read-only import). `package.json`/lockfile/CI workflow 변경 0. 새 외부 dependency·새 gating env 도입 0.
- producer 의 규칙 자체 변경 0 — self-wire 는 return 직전 자가 검증만 추가하고 filter/bound/active/username 계산은 기존 그대로. 자동 복구/재합성/기본값 채움 0(가드가 throw 하면 그대로 전파).

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

- 본 self-wire 로 producer↔oracle 규칙 정합이 모든 호출 경로에서 build-time 트립와이어가 된다. §109 잔여(변경 없음): (1) 실 credential 주입 하 credentialed live run 1 회(운영/env 층, T-0230 선례), (2) `deploy/daily-test.sh` step_eval 이 full-chain smoke(`realdata-e2e-eval-chain-live`)를 실 트리거하도록 배선 + 결과 daily-test 이슈 박제 — 둘 다 credential/env 게이트라 별도 큐잉.
