---
id: T-0981
title: eval-chain 수집 요청 조립을 독립 oracle 재유도로 대조하는 consistency drift-guard 순수 helper + colocated R-112 spec 추가
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-032, REQ-059]
estimatedDiff: 240
estimatedFiles: 2
created: 2026-07-14
independentStream: realdata-e2e-eval-chain
dependsOn: []
touchesFiles:
  - test/helpers/realdata-e2e-eval-chain-collect-request-consistency.ts
  - test/helpers/realdata-e2e-eval-chain-collect-request-consistency.spec.ts
plannerNote: "P5 §109 test-hardening — T-0980 collect-request helper 에 sibling 관례인 -consistency drift-guard 부재. 요청 조립 규칙(host/path 귀속·per_page=1 bounded·token §9 field-only)을 독립 oracle 재유도 대조. test-only pr-mode 2파일 dep[] file-disjoint stage5b 병렬."
---

# T-0981 — eval-chain 수집 요청 조립 consistency drift-guard

## Why

PLAN.md §109 (realdata-e2e eval-chain test-hardening) 의 다음 leg 이다. T-0980 이 eval-chain live smoke 의 마지막 inline 조립 로직을 순수 helper `buildRealDataE2eEvalChainCollectRequest` 로 추출·봉했지만, 그 형제 격인 **consistency drift-guard** 가 아직 없다. 직전 vein 의 관례상 추출된 조립 helper 마다 독립 oracle 재유도 대조 가드가 짝을 이룬다 — eval-chain-input 은 T-0976/T-0977, activity-map 은 T-0979 가 그 짝을 봉했다. collect-request helper 만 그 짝이 비어 있으므로 본 task 가 그 마지막 sibling 을 채운다. 요청 조립 규칙(host/path 귀속 · `per_page="1"` bounded single · token §9 field-only 통과)이 미래에 drift 하면 fail-fast 로 트립하는 순수 oracle 을 추가해 규칙 정합을 CI 매 실행 검증화한다.

## Required Reading

- `test/helpers/realdata-e2e-eval-chain-collect-request.ts` — 본 task 가 대조 대상으로 삼는 producer helper (`buildRealDataE2eEvalChainCollectRequest`). 규칙: host/path 귀속, `query.per_page === "1"`, token 은 반환 `.token` 필드로만 통과(§9 로그/메시지 노출 0), 입력 mutate 0.
- `test/helpers/realdata-e2e-eval-chain-activity-map-consistency.ts` — 직전 sibling(T-0979) 의 consistency drift-guard 패턴. 독립 oracle 재유도 + deep-equal(byte-identical) 대조 + fail-fast throw 구조를 mirror 한다.
- `test/helpers/realdata-e2e-github-collection-live.ts` — `RealDataE2eGithubCollectionPlanEntry` 타입(entry.host / entry.path) 정의처(read-only import).
- `src/github/github-request.builder.ts` — `GithubRequestInput` 타입(host/token/path/query) 정의처(read-only import).

## Acceptance Criteria

- [ ] `test/helpers/realdata-e2e-eval-chain-collect-request-consistency.ts` 신설 — 순수 함수 `assertRealDataE2eEvalChainCollectRequestConsistent(entry, token, result)` 를 export. producer 규칙을 **독립적으로 재유도**(producer 의 상수/코드를 import 하지 않고 oracle 안에서 규칙을 다시 표현)한 뒤 `buildRealDataE2eEvalChainCollectRequest` 출력과 deep-equal(byte-identical) 대조. 정합이면 `void`, drift 시에만 한국어 메시지로 fail-fast throw.
- [ ] oracle 이 재유도하는 규칙: (1) `host === entry.host`, (2) `path === entry.path`, (3) `query.per_page === "1"` bounded single, (4) `token` 은 인자 token 과 동일 값이 `.token` 필드로만 통과. §9: drift throw 메시지에 token 실 값 미노출(field 이름/형태만).
- [ ] colocated R-112 spec `test/helpers/realdata-e2e-eval-chain-collect-request-consistency.spec.ts` 신설.
- [ ] happy-path test 1+ — 정상 entry/token 에서 producer 출력이 oracle 과 정합 → `assert...` 가 throw 하지 않음(void).
- [ ] error path test 1+ — producer 출력을 인위적으로 변조(예: per_page 를 "2" 로, host 를 다른 값으로)해 넘겼을 때 oracle 이 fail-fast throw 하는지 각 규칙별로 검증.
- [ ] 분기(각 규칙별 drift) 마다 test branch 분리 — host drift / path drift / per_page drift / token drift 각 1+ negative test. 예외 상황(변조 · 누락 · type mismatch) 각 1+ cover — 단일 negative 금지.
- [ ] §9 검증 test 1+ — token drift throw 메시지에 token 실 값이 포함되지 않음(형태/field 이름만) 을 assert.
- [ ] neutral 재유도 검증 test 1+ — oracle 이 producer 의 상수/구현을 import 하지 않고 독립적으로 규칙을 표현함(순환 방지: type-only import 만 producer 로부터 허용).
- [ ] `pnpm lint && pnpm build && pnpm test:cov` 통과(line ≥ 80% / function ≥ 80%; 신규 helper line/branch/func 100% 목표).
- [ ] production `src/` 변경 0 LOC · 새 외부 dependency 0 (type-only import 재사용만).

## Out of Scope

- producer helper `realdata-e2e-eval-chain-collect-request.ts` 의 return-직전 self-wire(가드 자가 호출) — T-0977 가 eval-chain-input 에 했던 self-wire 는 본 task 밖. 필요 시 별도 후속 task(아래 Follow-ups)로 분리해 cap 유지.
- `realdata-e2e-eval-chain-live.smoke-spec.ts` 변경 — 본 task 는 순수 helper + spec 2파일만. smoke rewire 없음.
- collect-request helper 의 규칙/시그니처 변경 — 대조만 하고 producer 는 손대지 않는다.

## Suggested Sub-agents

implementer → tester

## Follow-ups

(빈 상태 — sub-agent 가 관련 작업 발견 시 여기 append. 예: consistency 가드의 producer self-wire(T-0977 mirror) 후속 task 검토.)
