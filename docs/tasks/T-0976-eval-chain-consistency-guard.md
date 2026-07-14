---
id: T-0976
title: 실 평가 e2e eval-chain leg 의 수집→평가 경계 조립을 독립 oracle 재유도로 대조하는 consistency drift-guard 순수 helper + colocated spec 추가
phase: P5
status: DONE
commitMode: pr
coversReq: [REQ-013, REQ-030, REQ-059]
estimatedDiff: 260
estimatedFiles: 2
created: 2026-07-14
independentStream: p5-realdata-e2e-eval-chain-leg
dependsOn: []
touchesFiles:
  - test/helpers/realdata-e2e-eval-chain-consistency.ts
  - test/helpers/realdata-e2e-eval-chain-consistency.spec.ts
plannerNote: "P5 §109 test-hardening — T-0975 로 봉한 eval-chain leg helper 에 sibling 관례인 -consistency drift-guard 부재. 경계 조립(bound/active/attribution) 을 독립 oracle 로 재유도 대조. test-only pr-mode 2파일 dep[] file-disjoint stage5b 병렬."
---

# T-0976 — eval-chain leg 수집→평가 경계 조립 consistency drift-guard

## Why

PLAN.md 109행(실 github myungjoo/leemgs 수집 → 로컬 Ollama 실 LLM 평가 e2e)의 두 leg 합류 지점을 T-0975 가 `test/helpers/realdata-e2e-eval-chain.ts` (`buildRealDataE2eEvalChainInput`)로 봉했다. 이 helper 는 실 수집 도메인 `GithubActivity[]` 를 (a) 귀속 메타(author) 있는 유효 활동만 filter → (b) 정확히 1 건으로 bound(LLM round-trip 1 회 상한, T-0245 선례) → (c) `active = gating.enabled ∧ ollama credential 존재 ∧ bounded 1 건` 판정으로 조립하는 **경계 배선의 단일 지점**이다.

문제는 이 helper 가 이 스트림의 sibling helper 대부분이 갖춘 `-consistency.ts` **독립 drift-guard 를 아직 갖지 못했다**는 점이다(예: `realdata-e2e-evaluation-inputs-consistency.ts` T-0685). T-0975 의 Why 가 명시한 핵심 위험 — "수집 0 건인데 평가가 빈 입력으로 조용히 통과 / 다수 활동이 무제한 round-trip 유발" 같은 **경계 조립 규칙의 조용한 회귀** — 를 build-time 에 fail-fast 로 잡는 독립 가드가 없다. `buildRealDataE2eEvalChainInput` 본문의 filter/bound/active 규칙이 향후 편집으로 조용히 바뀌면(예: `slice(0, 1)` → `slice(0, 2)`, attribution 조건 완화, active 3-조건 중 하나 누락), unit spec 만으로는 그 회귀가 spec 도 함께 수정되면 통과할 수 있다. 본 task 는 그 빈칸을 **독립 oracle 재유도**로 채운다.

핵심은 `isAttributedGithubActivity` predicate 가 helper 내부 비공개 함수라는 점을 활용해 **독립 재구현(oracle)** 으로 대조하는 것이다 — 가드가 filter/bound/active/username 규칙을 helper 와 무관하게 재유도한 뒤 `buildRealDataE2eEvalChainInput` 출력과 deep-equal(byte-identical) 대조하면, 어느 한쪽 규칙이 drift 하는 순간 fail 한다. 이는 `evaluation-inputs-consistency` 가 production 단건 매퍼로 배열 threading 을 재유도해 대조하는 패턴의 leg-경계 mirror 다. 순수 함수 가드라 항상 CI 실행(env-gating 무관), 새 dependency 0, `src/` 변경 0.

## Required Reading

- `test/helpers/realdata-e2e-eval-chain.ts` (T-0975) — 검증 대상. `buildRealDataE2eEvalChainInput(gating, collectedActivities)` 와 `RealDataE2eEvalChainInput` interface(`active`/`activities`/`username`) 계약. filter(author 귀속) → `slice(0, 1)` bound → `active = enabled ∧ ollama 존재 ∧ len===1` → `username = bounded[0].author | null` 규칙을 그대로 독립 재유도할 대상.
- `test/helpers/realdata-e2e-evaluation-inputs-consistency.ts` (T-0685) — 미러할 consistency-guard 패턴: 구조 결손 = TypeError / 값 정합 위반 = RangeError, fail-fast throw, silent 통과 0, 비변형(입력 mutate 0), 순수(부수효과 0). describe() 라벨 헬퍼, assert*Structure + 재유도 대조 2단 구조.
- `test/helpers/realdata-e2e-evaluation-inputs-consistency.spec.ts` — colocated spec 의 R-112 4종 배치 형태(happy/error/branch/negative + 구조 결손 케이스) 미러 참조.
- `src/assessment-collection/domain/activity.ts` — `GithubActivity` 타입 shape(특히 `author` 필드) 확인용(read-only import, 변경 0).
- `test/helpers/realdata-e2e-live-gating.ts` — `RealDataE2eLiveGating` interface(`enabled`/`ollama` 등) shape — 가드가 재유도할 active 판정 입력. read-only import.

## Acceptance Criteria

- [ ] `test/helpers/realdata-e2e-eval-chain-consistency.ts` 신설 — **순수** drift-guard 함수 1개(예: `assertRealDataE2eEvalChainInputConsistent(gating, collectedActivities, descriptor)`). `buildRealDataE2eEvalChainInput` 를 호출하지 **않고**(그러면 자기 자신 대조라 무의미) filter/bound/active/username 규칙을 **독립 재구현(oracle)** 해 expected descriptor 를 산출한 뒤, 인자로 받은 `descriptor` 가 expected 와 deep-equal(active/activities 원소·순서·길이/username 까지 byte-identical)인지 대조한다. 위반 시 fail-fast throw(구조 결손 = TypeError, 값 정합 위반 = RangeError, 메시지 한국어 + 어긋난 필드/index 정보). 네트워크/LLM/DB/env 읽기 0, 입력 mutate 0.
- [ ] `test/helpers/realdata-e2e-eval-chain-consistency.spec.ts` 신설(colocated) — R-112 4종 커버(항상 CI 실행):
  - **Happy-path**: 실제 `buildRealDataE2eEvalChainInput` 출력을 가드에 넘겨 정합 시 void(throw 0) — (i) 유효 활동 1 건, (ii) 유효 활동 다수(→1 건 bound), (iii) 유효 활동 0 건(active:false/빈 activities) 각각에 대해 정합 통과 1+.
  - **Error path**: helper 출력을 의도적으로 손상시킨 descriptor(예: `activities` 를 2 건으로 늘림, `active` 를 뒤집음, `username` 을 다른 author 로 교체) 주입 → 가드가 RangeError throw 하는지 각 손상 유형 1+.
  - **Flow/branch cover — 분기마다 1+**: (i) gating.enabled true vs false 가 재유도 active 에 반영되는 분기, (ii) ollama credential 존재 vs 부재 분기, (iii) myungjoo seed vs leemgs seed author 귀속 분기(username 재유도).
  - **Negative 충분 cover — 예외 상황 분기마다 1+**: (a) `descriptor` 비객체/null → TypeError, (b) `descriptor.activities` 비배열 → TypeError, (c) `collectedActivities` 비배열 → TypeError, (d) gating 비객체/null → TypeError, (e) 재유도 length 는 같지만 원소 author drift → RangeError(index 정보 포함), (f) active 값만 drift(activities 는 정합) → RangeError.
  - **§9 secret-safety**: fixture/descriptor/에러 메시지 어디에도 실 secret/token/apiKey 미등장(비시크릿 username·활동 메타만) assert 1+.
- [ ] **§9 / R-59 격리**: 실 credential 값을 spec/helper 어디에도 적지 않는다(gating fixture 는 enabled/ollama-존재 여부만 표현하는 더미 구조). raw 활동 본문을 파일/전역에 저장하지 않는다.
- [ ] `pnpm lint && pnpm build && pnpm test:cov` 통과(line ≥ 80% / function ≥ 80%). 가드·spec 모두 순수/결정론이라 완전 커버.

## Out of Scope

- `test/helpers/realdata-e2e-eval-chain.ts`(T-0975) 본문 수정 0 — import·재유도 대조·throw 만(재정의 0). 특히 `buildRealDataE2eEvalChainInput` 반환 직전 self-assert 배선(self-wire)은 본 task 밖(별도 후속 slice, dependsOn 본 task).
- `test/smoke/realdata-e2e-eval-chain-live.smoke-spec.ts` 및 두 half-leg spec 수정 0. 실 credential 주입·실 nightly 실행·`deploy/daily-test.sh` step_eval 재배선은 본 task 밖(운영/env 층 §5 게이트).
- `src/` production 코드 변경 0(`GithubActivity`/`RealDataE2eLiveGating` 타입 read-only import). `package.json`/lockfile/CI workflow 변경 0. 새 외부 dependency·새 gating env 도입 0.
- 자동 복구/재합성/기본값 채움 0 — 손상 descriptor 를 고치지 않고 fail-fast throw(복구는 호출처 책임). JSON schema/zod/ajv 도입 0(순수 비교만).

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

- 본 가드의 self-wire(=`buildRealDataE2eEvalChainInput` 반환 직전 `assertRealDataE2eEvalChainInputConsistent` 자체 호출로 조립 즉시 자가 검증) 배선은 후속 slice 로 분리(T-0682/T-0684-style self-wire mirror, dependsOn 본 task).
- §109 잔여(변경 없음): (1) 실 credential 주입 하 credentialed live run 1 회(운영/env 층, T-0230 선례), (2) `deploy/daily-test.sh` step_eval 이 full-chain smoke(`realdata-e2e-eval-chain-live`)를 트리거하도록 재배선 — 둘 다 credential/env 게이트라 별도 큐잉.
