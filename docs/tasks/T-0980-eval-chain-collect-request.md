---
id: T-0980
title: eval-chain full-chain live smoke 의 inline github 수집 요청 조립을 bounded-single GithubRequestInput 순수 helper 로 추출 + colocated R-112 spec + smoke rewire
phase: P5
status: DONE
mergedAs: daf639fe
prNumber: 874
completedAt: 2026-07-14T04:58:00Z
commitMode: pr
coversReq: [REQ-032, REQ-059]
estimatedDiff: 230
estimatedFiles: 3
created: 2026-07-14
independentStream: realdata-e2e-eval-chain
dependsOn: []
touchesFiles:
  - test/helpers/realdata-e2e-eval-chain-collect-request.ts
  - test/helpers/realdata-e2e-eval-chain-collect-request.spec.ts
  - test/smoke/realdata-e2e-eval-chain-live.smoke-spec.ts
plannerNote: "P5 §109 test-hardening — eval-chain live smoke 의 마지막 미추출 inline 로직(GithubRequestInput bounded per_page=1 요청 조립). 순수 helper 추출 + R-112 spec + rewire. test-only pr-mode 3파일 dep[] file-disjoint stage5b 병렬."
---

# T-0980 — eval-chain full-chain live smoke 의 github 수집 요청 조립 순수 helper 추출

## Why

`test/smoke/realdata-e2e-eval-chain-live.smoke-spec.ts`(T-0975) 의 full-chain it 본문에는 아직
추출되지 않은 결정론적 조립 로직이 하나 남아있다 — 수집 plan entry(host/path) 와 gating PAT 를
`GithubRequestInput` 으로 조립하며 `query: { per_page: "1" }` 로 bounded single round-trip(T-0245
선례) 을 강제하는 부분(현재 파일 lines 111–118 inline). 이 조립은 env-gated skip-by-default 라
public CI 에서 **한 번도 실행되지 않아** per_page bound 나 host/path 귀속이 깨져도 탐지되지 않는다.
직전 T-0975~T-0979 가 eval-chain 의 다른 조립 leg(입력 descriptor·activity-map·consistency guard)을
전부 순수 helper + R-112 spec 으로 봉한 것과 동형으로, 본 마지막 inline leg 을 순수 helper 로 추출해
CI 매 실행 검증화한다(PLAN.md §109 realdata-e2e test-hardening).

## Required Reading

- `test/smoke/realdata-e2e-eval-chain-live.smoke-spec.ts` — 추출 대상 inline 로직(full-chain it 의 lines 111–118 GithubRequestInput 조립) 과 rewire 지점.
- `test/helpers/realdata-e2e-eval-chain.ts` — 동일 vein 순수 helper 모듈의 header/§9/R-59 격리 주석 관례(참고 template).
- `test/helpers/realdata-e2e-github-collection-live.ts` — `RealDataE2eGithubCollectionPlanEntry`(username/host/path) 타입 정의와 collectionPathForUsername bounded-single 정신.
- `src/github/github-request.builder.ts` (lines 35–49) — `GithubRequestInput` 타입(host/token/path/query) 계약과 token 노출 금지 주석(ADR-0016 §3, §9).

## Acceptance Criteria

- [ ] 새 순수 helper `buildRealDataE2eEvalChainCollectRequest(entry, token)` 를 `test/helpers/realdata-e2e-eval-chain-collect-request.ts` 에 추가. entry 의 host/path 를 귀속하고 `query.per_page === "1"`(bounded single, 무제한 아님) 로 고정한 `GithubRequestInput` 을 결정론적으로 반환. process.env 읽기 0 / 실 네트워크 0 (순수 함수). token 은 인자로만 받아 흘려보내고 로그/에러 메시지에 노출 0(§9, ADR-0016 §3).
- [ ] Happy-path unit test 1+: 정상 entry + 비어있지 않은 token → host/token/path/query 필드가 기대대로 조립되고 `per_page="1"` 이 박제됨을 검증.
- [ ] Error path unit test 1+ (각 분기): entry 가 null/undefined/비객체 → 한국어 메시지 TypeError; entry.host 누락/공백 → throw; entry.path 누락/공백 → throw; token 이 빈 문자열/비-string → throw(인증 없는 요청 조립 차단).
- [ ] Flow / branch coverage: helper 안 각 guard 분기(entry 형태·host·path·token) 마다 1+ test 로 분리 cover.
- [ ] Negative cases 충분 cover: 빈 token · 공백-only host · leading-slash 유무 path · query 오염(호출처가 per_page 를 덮어쓰지 못함) · non-object entry 등 예외 상황 각 1+ test. 단일 negative 로 그치지 않는다.
- [ ] §9/R-59 회귀 가드: token 값이 반환 객체 외 어디에도(에러 메시지·throw payload) 새지 않음을 검증하는 test 1+. spec 은 실 PAT 대신 fake token 리터럴("test-token-not-real" 류) 만 사용.
- [ ] colocated spec `test/helpers/realdata-e2e-eval-chain-collect-request.spec.ts` 에 위 test 배치(NestJS/저장소 colocated 관례 — helper 옆).
- [ ] `test/smoke/realdata-e2e-eval-chain-live.smoke-spec.ts` 의 inline GithubRequestInput 조립을 새 helper 호출로 rewire — 행동 동치(host/path/token/per_page 동일) 유지, live gating skip-by-default 불변.
- [ ] `pnpm lint && pnpm build && pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%). 신규 helper line/branch/func 100% 목표.
- [ ] production `src/` 0 LOC 변경 · 새 외부 dependency 0.

## Out of Scope

- 새 consistency drift-guard(독립 oracle 재유도 대조) 모듈 추가 — 본 task 는 helper 추출 + rewire 만. sibling `-consistency` 가드는 별도 follow-up task.
- live smoke 의 실 네트워크/실 LLM round-trip 로직 변경 — gating·evaluate·orchestrator compose 부분은 손대지 않는다.
- `GithubRequestInput` 타입(src/github) 이나 GithubAdapter 변경.
- collection plan(T-0806) 이나 eval-chain input(T-0975) helper 재작성.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

- (예상) 본 helper 에 sibling 관례인 `-consistency` drift-guard(요청 조립 규칙을 독립 oracle 로 재유도해 deep-equal 대조) 순수 helper + colocated spec 추가 — T-0976/T-0979 mirror.
