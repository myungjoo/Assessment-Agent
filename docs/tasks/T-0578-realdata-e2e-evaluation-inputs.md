---
id: T-0578
title: 실 평가 e2e 수집 Activity[] → EvaluationInput[] 경계 순수 매퍼
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-032, REQ-037]
estimatedDiff: 120
estimatedFiles: 2
created: 2026-06-23
independentStream: realdata-e2e
dependsOn: []
touchesFiles:
  - test/helpers/realdata-e2e-evaluation-inputs.ts
  - test/helpers/realdata-e2e-evaluation-inputs.spec.ts
hqOrigin:
plannerNote: "P5 PLAN 109행 실 평가 e2e step②→③ 경계 — 수집 Activity[]→EvaluationInput[] 순수 매퍼(production mapActivityToEvaluationInput 재사용). cloud-safe·dependency-free."
---

# T-0578 — 실 평가 e2e 수집 Activity[] → EvaluationInput[] 경계 순수 매퍼

## Why

PLAN.md 109행(P5 "🟢 실 평가 e2e 테스트 데이터 = github.com `myungjoo` + `leemgs` 공개 활동", 사용자 지정 2026-06-22)의 **step ②(수집) → step ③(평가) 경계**를 순수 함수로 분해하는 chain 의 다음 slice 다. 직전 slice 들(T-0573~T-0577)은 step ①(seed)과 step ②(수집 호출-args)의 경계를 순수 빌더/매퍼로 박제했다. step ② 의 실 수집 runner 가 산출할 결과는 typed `Activity[]`(GitHub commit/pr/issue + Confluence page 정규화 단위)이고, step ③(평가 scoring)의 입력은 `EvaluationInput`(`EvaluationScoringService.scoreUnit` 의 첫 인자)이다.

production 에는 이미 그 둘을 잇는 순수 함수 `mapActivityToEvaluationInput(activity: Activity): EvaluationInput`(`src/assessment-evaluation/domain/evaluation-input.mapper.ts`)가 **단건** 변환으로 존재한다(`EvaluationScoringService` 주석 L24 가 "`Activity` → `EvaluationInput` 매핑(T-0287) — 입력 준비 단계(상위 orchestrator)"라고 이 경계를 명시한다). 본 task 는 그 production 매퍼를 **재사용**해, 실 수집이 돌려줄 `Activity[]` 배열을 step ③ 평가가 받을 `EvaluationInput[]` 배열로 변환하는 **realdata-e2e 경계 순수 helper** `buildRealDataEvaluationInputs(activities: Activity[]): EvaluationInput[]` 를 추가한다. 이렇게 step ② 산출물이 step ③ 입력 shape 로 흐르는 경계를 build-time 에 결정론적으로 고정해 검증 가능하게 만든다.

contributionKind 정규화(commit/pr→code, issue→document R-30, Confluence→document)·unitId 합성·raw 본문 미보유(REQ-032)는 전부 production 매퍼가 담당하므로 본 helper 는 그 위에 배열 매핑만 얹는다(중복 매핑 로직 0 — 단일 진실 원천 보존). 실 github.com fetch·Ollama 실 LLM·DB write·credential 은 전부 deferred(LAN/credential gate, ADR-0045) 그대로 — 본 slice 는 네트워크/DB/LLM/env 접근 0 의 순수 매퍼라 cloud cron 에서 자율 실행 가능하다.

## Required Reading

- `docs/tasks/T-0577-realdata-e2e-collect-call-args.md` — 직전 chain slice 의 패턴·범위 경계·문서 스타일.
- `test/helpers/realdata-e2e-seed-collect-call-args.ts` — 직전 helper 의 헤더 주석 구조·순수성/무공유 박제·import 재사용 컨벤션(본 helper 가 mirror 할 스타일).
- `src/assessment-evaluation/domain/evaluation-input.mapper.ts` — 본 task 가 **재사용**할 production 순수 함수 `mapActivityToEvaluationInput()`(단건 Activity→EvaluationInput). 본 helper 는 이 위에 배열 매핑만 얹는다(매핑 로직 복제 금지).
- `src/assessment-evaluation/domain/evaluation-input.ts` (L52~L75) — `EvaluationInput` interface(7 필드). 반환 타입 import 경로(중복 정의 금지).
- `src/assessment-collection/domain/activity.ts` (L45~L100) — `Activity` discriminated union(`GithubActivity` / `ConfluenceActivity`) shape. 입력 타입 import 경로 + spec fixture(github commit/pr/issue + confluence page) 작성 근거.
- `src/assessment-evaluation/evaluation-scoring.service.ts` (L24~L93) — step ③ scoreUnit 의 입력이 `EvaluationInput` 임을 확인하는 경계 근거(주석 L24 의 매핑 위치 명시).

## Acceptance Criteria

- [ ] `test/helpers/realdata-e2e-evaluation-inputs.ts` 에 순수 함수 `buildRealDataEvaluationInputs(activities: Activity[]): EvaluationInput[]` 추가. 입력 `Activity[]` 의 각 원소를 production `mapActivityToEvaluationInput()` 로 변환해 `EvaluationInput[]` 를 산출하고 순서를 보존한다. 매핑 로직(contributionKind 분기·unitId 합성 등)은 본 helper 안에서 재구현하지 않고 production 매퍼 호출에 위임한다.
- [ ] **타입·매퍼 재사용** — `Activity` 는 `src/assessment-collection/domain/activity.ts` 에서, `EvaluationInput` 은 `src/assessment-evaluation/domain/evaluation-input.ts` 에서, `mapActivityToEvaluationInput` 은 `src/assessment-evaluation/domain/evaluation-input.mapper.ts` 에서 import 재사용한다(새 type 정의·매핑 복제 0).
- [ ] **입력 mutate 0 / 무공유 보장** — 매 호출이 새 배열을 반환하고 입력 `activities` 배열·원소를 변형하지 않는다(`map` 으로 새 배열 생성). spec 으로 입력 배열 길이·참조 불변 검증. production 매퍼가 metadata 를 reference 그대로 전달함을 본 helper 도 그대로 승계(deep clone 0)함을 spec 주석/test 로 명시.
- [ ] **Happy-path unit test 1+** — github commit·pr·issue + confluence page 를 섞은 `Activity[]` fixture 입력에 대해 각 원소가 올바른 `unitId`(`<sourceType>:<instanceKey>:<externalId>`)·`contributionKind`(commit/pr→`code`, issue→`document`, confluence→`document`)·`sourceType`·`author`·`timestamp`·`metadata` 로 변환되고 순서가 보존됨을 검증.
- [ ] **Error/negative path test 1+** — 빈 입력 배열(`[]` → `[]` 반환), `metadata` 가 빈 객체인 Activity(→ 빈 metadata 보존), 단일 원소 배열 등 각 1+ test. 단일 negative 만으로 부족 — 분기/경계마다 cover.
- [ ] **Flow / branch coverage** — production 매퍼의 sourceType/kind 분기가 본 helper 를 통해 전부 도달함을 보장하도록 github(commit·pr·issue 3종)·confluence 입력을 모두 포함해 각 분기 1+ test. 본 helper 자체에 추가 분기를 두지 않음(배열 매핑만)을 명시하고, 그렇더라도 위임된 분기를 입력 다양성으로 cover.
- [ ] **무공유 회귀 test** — 반환 배열(또는 원소)을 mutate 한 뒤 동일 입력으로 재호출 시 결과 불변(공유 mutable 상태 노출 0) 검증.
- [ ] `pnpm lint && pnpm build && pnpm test` 통과(production `src/` 변경 0 — test helper + colocated spec 만).
- [ ] `pnpm test:cov` 통과 — 신규 helper line ≥ 80% AND function ≥ 80%(jest `coverageThreshold` 강제). 순수 매퍼이므로 100% 지향.

## Out of Scope

- 실 github.com 네트워크 fetch / `assessment-collection` 의 실 활동 수집 호출(step ② 의 live 부분 — LAN/credential gate, ADR-0045).
- `EvaluationScoringService.scoreUnit` 의 실 호출 / scoring 옵션(modelId) 결정 / LLM gateway 주입(step ③ 의 live LLM — Ollama LAN=AKIHA 192.168.0.5, cloud cron 무경로).
- `Contribution`(Prisma 영속 row) → `EvaluationInput` 매핑(본 helper 는 수집 산출물 `Activity[]` → `EvaluationInput[]` 경계만 — 영속 row 경유 경로는 별도/불요).
- 평가-side dedup / self-follow-up 제외 / abuse·notable 보정 적용(상위 orchestrator 책임 — 본 helper 는 정규화 매핑만).
- `Ollama` 실 LLM round-trip(step ③) / `deploy/daily-test.sh` 의 `step_eval` wiring(step ④).
- production `src/` 코드 변경(`evaluation-input.mapper.ts` 등) — 본 task 는 test helper 단독(타입·매퍼 import 재사용만).
- 새 외부 dependency / schema migration / env·secret 접근.

## Suggested Sub-agents

implementer → tester

## Follow-ups

(비어있음 — sub-agent 가 관련 작업 발견 시 여기에 append)
