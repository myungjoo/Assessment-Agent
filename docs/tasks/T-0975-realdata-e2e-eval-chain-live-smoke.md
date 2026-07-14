---
id: T-0975
title: 실 평가 e2e full-chain leg — 실 github 수집(myungjoo/leemgs) → 실 Ollama LLM 평가 1 회 round-trip env-gated live smoke (PLAN 109행 두 leg 합류)
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-013, REQ-030, REQ-059]
estimatedDiff: 270
estimatedFiles: 3
created: 2026-07-14
independentStream: p5-realdata-e2e-eval-chain-leg
dependsOn: []
touchesFiles:
  - test/helpers/realdata-e2e-eval-chain.ts
  - test/helpers/realdata-e2e-eval-chain.spec.ts
  - test/smoke/realdata-e2e-eval-chain-live.smoke-spec.ts
plannerNote: "P5 §109 실 평가 e2e — local-llm-example 스크립트 전 봉함(T-0966~T-0974) 뒤 다음 leg. T-0610(eval leg·collection stub)+T-0806(collection leg·eval stub) 두 반쪽을 합류 = 실 수집→실 평가 chain. test-only pr-mode 3파일 dep[] file-disjoint."
---

# T-0975 — 실 평가 e2e full-chain leg: 실 github 수집 → 실 Ollama LLM 평가 1 회 round-trip env-gated live smoke

## Why

로컬 Ollama live-LLM 운영 premise 를 봉해온 chain 이 `deploy/local-llm-example/` 전 스크립트(config.env·_common.ps1·README·install·start·stop·status·test·expose-lan, T-0966~T-0974)를 모두 정적 앵커로 봉했다. 이로써 PLAN §109 의 운영 전제("PC Ollama LAN 노출" + 로컬 Ollama live-LLM 경로)가 계약 층에서 봉함됐다.

남은 §109 표면은 **실 평가 e2e 의 두 leg 합류**다. PLAN §109 는 "실 github.com 공개 활동(myungjoo/leemgs) 수집 → 로컬 Ollama 실 LLM 평가"를 하나의 end-to-end 로 요구하는데, 지금까지 이 e2e 는 **반쪽씩만** 봉해져 있다:

- **T-0610** (`realdata-e2e-live.smoke-spec.ts`): 실 LLM **평가 leg** 은 env-gated live 로 봉했으나 collection leg 를 synthetic Activity 1 건으로 **stub** 했다("실 github 수집 배선은 후속 slice" 명시 deferred).
- **T-0806** (`realdata-e2e-github-collection-live.smoke-spec.ts`): 실 github **수집 leg**(myungjoo/leemgs 실 round-trip)은 env-gated live 로 봉했으나 그 수집 결과를 평가로 **흘려보내지 않고**(eval stub) 수집이 정상 round-trip 됨만 assert 했다.

즉 **실 수집 → 그 실 활동을 실 LLM 평가로 chain 하는 full-e2e** 는 아직 어떤 spec 도 봉하지 않았다(origin/main 확인 — `period-bridge-live`(T-0339)는 collection stub 인 azure/bridge 경로, `realdata-e2e-daily-step-dual-leg-*-live`(T-0919대)는 daily-step 실행/보고 leg 로 본 chain 과 distinct surface). 본 task 는 그 합류 지점을 메운다 — 실 github 수집 plan(T-0806 helper 재사용)으로 실 활동 1+ 를 수집하고, 그 활동을 bounded single round-trip(T-0245 선례)으로 실 evaluation compose(T-0610 helper·makeLiveGateway 패턴 재사용)에 흘려보내 실 Ollama LLM 평가문·기여도가 산출됨을 검증한다.

핵심 위험은 **두 leg 의 경계 배선 drift**다. 수집한 실 활동을 평가 input 으로 넘기는 어댑팅(도메인 Activity → orchestrator input)이 잘못되면, 두 leg 각각은 green 이어도 chain 은 조용히 끊긴다(수집 0 건인데 평가가 빈 입력으로 통과, 또는 다수 활동이 무제한 LLM round-trip 을 유발해 비용/시간 폭증). 그래서 (1) 수집 활동을 **평가 input 으로 조립하는 순수 로직**(bounded single round-trip 경계·person/service-identity 귀속)을 pure helper 로 분리해 R-112 로 봉하고(항상 CI 실행), (2) 실 네트워크·실 LLM round-trip 자체는 env-gated skip-by-default 로 두어 public CI 는 secret 0 / 비용 0 / green 을 유지한다(R-113). raw 외부 활동 데이터는 파일/변수로 저장하지 않는다(R-59, REQ-059).

## Required Reading

- `test/smoke/realdata-e2e-live.smoke-spec.ts` (T-0610, ~206행) — eval leg live compose 패턴: `makeLiveGateway()`(Ollama OpenAI 호환 config repository/cipher stub) → 실 `EvaluationScoringService` → 실 `EvaluationOrchestratorService`. gating skip 구조(`resolveRealDataE2eLiveGating` false → `describe.skip`). collection leg 를 synthetic Activity 1 건으로 stub 하는 지점 — 본 task 는 그 stub 을 T-0806 실 수집으로 대체한다.
- `test/smoke/realdata-e2e-github-collection-live.smoke-spec.ts` (T-0806, ~122행) — collection leg live: `buildRealDataGithubCollectionPlan` plan → `GithubAdapter.request`(default `globalThis.fetch`) 실 endpoint round-trip → 도메인 Activity 매핑. 비결정 본문 미-assert, 비어있지 않은 메타 1+ 만 assert 하는 invariant. 본 task 는 그 수집 결과 Activity 를 평가로 chain 한다.
- `test/helpers/realdata-e2e-live-gating.ts` (~198행) — `resolveRealDataE2eLiveGating` + `REALDATA_E2E_REQUIRED_ENV`(REALDATA_E2E_LIVE_TEST + Ollama 5 종 + github read PAT). **재사용**(신규 gating env 도입 0). `RealDataE2eLiveGating` interface 로 enabled/credential 소비.
- `test/helpers/realdata-e2e-github-collection-live.ts` (~171행) — `buildRealDataGithubCollectionPlan(gating, seeds?)` → `RealDataE2eGithubCollectionPlan`(myungjoo/leemgs entry). **재사용**(plan 재구현 0).
- `test/helpers/realdata-e2e-github-collection-live.spec.ts` — helper 단위 spec 패턴(R-112 4종). 본 task 의 신규 chain helper unit spec 이 mirror 할 형태.
- `src/evaluation/` 의 `EvaluationOrchestratorService`(활동 배열 → 평가) + `EvaluationScoringService` 진입 시그니처(입력 타입) — chain helper 가 조립할 orchestrator input 의 정확한 shape 확인용(호출 시그니처만 — 내부 구현 변경 0). 도메인 `Activity` 타입 정의 파일도 shape 참조.

## Acceptance Criteria

- [ ] `test/helpers/realdata-e2e-eval-chain.ts` 신설 — **순수** helper 1개(예: `buildRealDataE2eEvalChainInput(gating, collectedActivities)`). 실 수집으로 얻은 도메인 `Activity[]` 를 (a) **bounded single round-trip**(T-0245 선례 — 정확히 1 건으로 bound, LLM round-trip 1 회 상한)으로 좁히고 (b) 그 활동을 orchestrator 평가 input 으로 조립한 결정론적 descriptor 를 반환한다. 네트워크/LLM/DB 호출 0(순수 함수). `process.env` 읽기 0(gating 은 인자로 주입).
- [ ] `test/helpers/realdata-e2e-eval-chain.spec.ts` 신설(colocated helper unit spec) — 본 helper 의 R-112 4종 커버(항상 CI 실행, env-gating 무관):
  - **Happy-path**: 수집 활동 N 건(합성 fixture) 주입 → bounded single(정확히 1 건) descriptor 조립 + person/service-identity(myungjoo/leemgs username 귀속) 보존 assert 1+.
  - **Error path**: 수집 활동 0 건(빈 배열) 주입 → 명시적 guard(throw 또는 `active:false`/빈 descriptor 로 조용한-빈-입력-평가 차단) assert 1+.
  - **Flow/branch cover — 분기마다 1+**: (i) 활동 정확히 1 건 vs 다수(다수 → 1 건 bound) 분기, (ii) gating.enabled true vs false 가 descriptor active 플래그에 반영되는 분기, (iii) myungjoo seed vs leemgs seed 귀속 분기.
  - **Negative 충분 cover — 예외 상황 분기마다 1+**: (a) 활동에 person/service-identity 메타 누락(malformed) → skip/reject, (b) 비-array/undefined 입력 → 방어적 guard, (c) gating.credential 부재인데 enabled 인 비정상 조합 → active:false, (d) 다수 활동 중 유효 0 건 → 빈-입력 error path 로 수렴.
  - **§9 secret-safety**: descriptor/fixture 어디에도 실 secret/token/apiKey 미등장(username·활동 메타 식별자 같은 비시크릿만) assert 1+.
- [ ] `test/smoke/realdata-e2e-eval-chain-live.smoke-spec.ts` 신설 — env-gated skip-by-default full-chain live smoke. `resolveRealDataE2eLiveGating`(재사용) enabled=false 면 `describe.skip` 으로 전 suite skip(public CI 기본 경로 → 실 네트워크 0 / secret 0 / 비용 0 / green, R-113). enabled=true(운영 credential 주입 시)일 때만: `buildRealDataGithubCollectionPlan` → `GithubAdapter.request`(default fetch) 실 github round-trip 으로 실 활동 수집 → `buildRealDataE2eEvalChainInput` 로 bounded single 조립 → `makeLiveGateway`(T-0610 패턴) + 실 `EvaluationScoringService` + 실 `EvaluationOrchestratorService` 로 실 Ollama LLM 평가 1 회 round-trip → **비결정 본문(평가문 문장·활동 내용)은 assert 하지 않고**, 평가 결과가 정상 산출됐음(비어있지 않은 narrative 1+ 및 volume/난이도 메타 존재)만 assert. skip-branch(env-off) 자체가 CI 에서 항상 실행되는 assert 로 존재.
- [ ] **§9 / R-59 격리**: 실 credential 값을 spec/helper 어디에도 적지 않는다(env 에서만 `resolveRealDataE2eLiveGating` 로 읽음). 실 수집 raw 활동 데이터를 파일/전역 변수로 저장하지 않는다(REQ-059 raw 미저장 — round-trip 후 평가 결과 메타만 검증, raw 폐기). 새 외부 dependency 0(Node 내장 fetch + 기존 src 서비스만).
- [ ] `pnpm lint && pnpm build && pnpm test:cov` 통과(line ≥ 80% / function ≥ 80%). helper 는 순수라 unit spec 이 완전 커버, live smoke 는 env 부재 skip 이라 coverage 무회귀. smoke 파일은 CI `pnpm test:smoke` 대상으로 non-gated 항상 실행(env-off skip → green).

## Out of Scope

- `src/` production 코드 변경 0. `EvaluationOrchestratorService`/`EvaluationScoringService`/`GithubAdapter` 내부 계약 변경 금지 — 기존 시그니처 소비만(chain helper 는 test/helpers/ 순수 함수).
- `test/helpers/realdata-e2e-live-gating.ts`·`test/helpers/realdata-e2e-github-collection-live.ts` 원본 수정 금지 — import 재사용만(신규 gating env·신규 collection plan 로직 도입 0).
- 실 credential 주입·실 nightly 실행·`deploy/daily-test.sh` step_eval 배선·daily-test 이슈 박제는 본 task 밖(운영/env 층, §5 게이트 — 오너 승인됨이나 코드 task 아님). 본 task 는 chain **spec 인프라**만.
- `package.json`/lockfile/CI workflow 변경 0. 새 gating env 키 신설 0(기존 `REALDATA_E2E_REQUIRED_ENV` 그대로).

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

- 이 task 머지로 §109 실 평가 e2e 의 수집→평가 chain spec 인프라가 완성된다(T-0610 eval leg + T-0806 collection leg + 본 task 합류 leg). 잔여 §109 표면은 (1) 실 credential 주입 하 credentialed live run 1 회(운영/env 층, T-0230 선례 mirror), (2) `deploy/daily-test.sh` step_eval 이 본 chain smoke 를 실 트리거하도록 배선 + 결과를 daily-test result/rolling 이슈에 박제(자율 nightly 실 평가 e2e) — 둘 다 credential/env 게이트라 planner 가 env-gated 또는 ops-task 로 별도 큐잉.
