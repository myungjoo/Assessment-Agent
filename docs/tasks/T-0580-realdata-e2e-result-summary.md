---
id: T-0580
title: 실 평가 e2e EvaluationResult[] → daily-test 결과 요약 descriptor 순수 빌더
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-032, REQ-037]
estimatedDiff: 130
estimatedFiles: 2
created: 2026-06-23
independentStream: realdata-e2e
dependsOn: []
touchesFiles:
  - test/helpers/realdata-e2e-result-summary.ts
  - test/helpers/realdata-e2e-result-summary.spec.ts
hqOrigin:
plannerNote: "P5 PLAN 109행 실 평가 e2e step④ 경계 — EvaluationResult[] → daily-test 결과 요약 descriptor 순수 빌더. cloud-safe·dependency-free."
---

# T-0580 — 실 평가 e2e EvaluationResult[] → daily-test 결과 요약 descriptor 순수 빌더

## Why

PLAN.md 109행(P5 "🟢 실 평가 e2e 테스트 데이터 = github.com `myungjoo` + `leemgs` 공개 활동", 사용자 지정 2026-06-22)의 chain 은 step ①(seed) → step ②(수집 호출-args / personId 치환 / 입력 매핑) → step ②→③ 경계(`Activity[]` → `EvaluationInput[]`) → step ③ 입력 경계(`EvaluationInput[]` + modelId → `scoreUnit(input, options)` 호출-args 묶음, T-0579)까지 build-time 결정론적으로 박제해 왔다. 본 task 는 그 다음 자연 경계 — **step ③ 의 출력 측 + step ④(결과 박제) 경계** — 를 순수 함수로 분해한다.

step ③ runner 가 `scoreUnit` 를 호출하면 평가 단위마다 `EvaluationResult`(`unitId` / `narrative` / `difficulty` / `contribution` / `volume` 5 필드, `evaluation-result.ts` 박제)가 산출된다. PLAN step ④ 는 "결과를 daily-test result/rolling 이슈에 박제 = 자율 nightly 실 평가 e2e"를 지시하므로, 그 박제 직전에 `EvaluationResult[]` 를 **사람이 읽을 수 있는 결과 요약 descriptor**(평가 단위 수 + difficulty 분포 + contribution 분포 + 총 volume 합산)로 집계하는 순수 projection 이 필요하다. raw 미저장(R-59) 불변에 정합하게, 본 요약은 `narrative` 본문을 박제하지 않고 식별자·분류 enum 카운트·정량 합산만 담는다.

본 task 는 그 순수 빌더 `buildRealDataResultSummary(results: EvaluationResult[]): RealDataResultSummary` 를 추가한다. 입력 `EvaluationResult[]` 를 순회해 difficulty 3 슬롯(easy/medium/hard, `DIFFICULTIES` 정합)·contribution 4 등급(zero/low/medium/high, `CONTRIBUTION_LEVELS` 정합)별 카운트와 총 volume 합산을 집계한 결정론적 요약을 반환한다. 실 LLM round-trip(Ollama LAN=AKIHA 192.168.0.5)·`scoreUnit` 실행·daily-test wiring·이슈 실 박제는 전부 deferred(ADR-0045 LAN gate) 그대로 — 본 slice 는 네트워크/DB/LLM/env 접근 0 의 순수 집계 함수라 cloud cron 에서 자율 실행 가능하다.

## Required Reading

- `docs/tasks/T-0579-realdata-e2e-scoring-call-args.md` — 직전 chain slice 의 패턴·범위 경계·문서 스타일·Out of Scope 표기 컨벤션.
- `test/helpers/realdata-e2e-scoring-call-args.ts` — 동형 패턴 helper(헤더 주석 구조·순수성/무공유 박제·import 재사용 컨벤션·guard 처리). 본 helper 도 동일 헤더 스타일·import 재사용을 mirror.
- `src/assessment-evaluation/domain/evaluation-result.ts` — 본 task 의 입력 타입 `EvaluationResult`(5 필드) + `ContributionLevel` union + `CONTRIBUTION_LEVELS` const(집계 슬롯 single source). 입력 타입 import 경로(중복 정의 금지).
- `src/llm/difficulty.ts` (L17~L38) — `Difficulty` union(easy/medium/hard) + `DIFFICULTIES` const(집계 슬롯 single source). difficulty 분포 카운트의 슬롯 기준.
- PLAN.md 109행(실 평가 e2e bullet) step ④ — "결과를 daily-test result/rolling 이슈에 박제", raw 미저장(R-59) 명시. 본 요약이 narrative 본문을 박제하지 않는 근거.

## Acceptance Criteria

- [ ] `test/helpers/realdata-e2e-result-summary.ts` 에 순수 함수 `buildRealDataResultSummary(results: EvaluationResult[]): RealDataResultSummary` 추가. 입력 `EvaluationResult[]` 를 순회해 (a) 평가 단위 총 개수 `count`, (b) difficulty 3 슬롯(easy/medium/hard)별 카운트, (c) contribution 4 등급(zero/low/medium/high)별 카운트, (d) 총 volume 합산 `totalVolume` 을 집계한 결정론적 요약을 반환한다.
- [ ] `RealDataResultSummary` interface 박제 — `{ count: number; byDifficulty: Record<Difficulty, number>; byContribution: Record<ContributionLevel, number>; totalVolume: number }` shape. `Difficulty` / `ContributionLevel` 은 production import 재사용(새 type 정의 0).
- [ ] **분포 슬롯 single source 정합** — `byDifficulty` 의 키는 `DIFFICULTIES`(`src/llm/difficulty.ts`)를, `byContribution` 의 키는 `CONTRIBUTION_LEVELS`(`src/assessment-evaluation/domain/evaluation-result.ts`)를 기준으로 모든 슬롯을 0 으로 초기화 후 카운트한다(미등장 슬롯도 키 존재 보장 — 0 명시). 슬롯 누락/오타 없음을 spec 으로 검증.
- [ ] **타입 재사용** — `EvaluationResult` / `ContributionLevel` / `CONTRIBUTION_LEVELS` 는 `evaluation-result.ts` 에서, `Difficulty` / `DIFFICULTIES` 는 `src/llm/difficulty.ts` 에서 import 재사용(새 type / 슬롯 배열 정의 0).
- [ ] **raw 미저장 정합(R-59)** — 본 요약 descriptor 는 `narrative` 본문·raw 활동 본문을 필드로 보유하지 않는다(식별자 카운트·enum 분포·정량 합산만). 헤더 주석에 R-59 정합·step ④ 박제 경계 명시. spec 으로 반환 객체에 narrative 류 키 부재 확인.
- [ ] **입력 mutate 0 / 무공유 보장** — 매 호출이 새 요약 객체(+ 새 `byDifficulty`/`byContribution` 객체)를 반환하고 입력 `results` 배열·원소를 변형하지 않는다. spec 으로 입력 참조 불변 + 반환 객체가 호출마다 다른 reference 임을 검증.
- [ ] **Happy-path unit test 1+** — difficulty·contribution 이 다양하게 섞인 `EvaluationResult[]` fixture 입력에 대해 count·각 분포 카운트·totalVolume 합산이 정확히 산출됨을 검증.
- [ ] **Error/negative path test** — (a) 빈 입력 배열(`[]` → count 0, 모든 슬롯 0, totalVolume 0), (b) 단일 원소 배열, (c) 동일 difficulty/contribution 만 반복된 입력(한 슬롯 집중·나머지 0 유지), (d) volume 0 원소 포함(합산 정합) 등 각 분기/경계마다 cover. 단일 negative 만으로 부족.
- [ ] **Flow / branch coverage** — `results` 비어있음 / 단일 / 다수 분기 + 모든 difficulty 슬롯·모든 contribution 슬롯이 fixture 로 1+ 등장하는 경로가 전부 cover. 본 helper 의 추가 분기는 reduce/순회 누적 외 없음을 spec 주석으로 명시.
- [ ] **무공유 회귀 test** — 반환된 `byDifficulty`/`byContribution` 객체를 mutate 한 뒤 동일 입력으로 재호출 시 결과 불변(공유 mutable 상태 노출 0) + 두 호출의 요약/하위 객체 reference 가 서로 다름 검증.
- [ ] `pnpm lint && pnpm build && pnpm test` 통과(production `src/` 변경 0 — test helper + colocated spec 만).
- [ ] `pnpm test:cov` 통과 — 신규 helper line ≥ 80% AND function ≥ 80%(jest `coverageThreshold` 강제). 순수 집계 함수만이므로 100% 지향.

## Out of Scope

- 실 `EvaluationScoringService.scoreUnit` 호출 / scoring 실행 / `EvaluationResult` 실 산출(step ③ live — Ollama LAN=AKIHA 192.168.0.5, cloud cron LAN 무경로, ADR-0045).
- daily-test result/rolling 이슈 실 박제 / `gh issue` 호출 / 마크다운 렌더링 / 이슈 본문 포맷 문자열 생성(step ④ live wiring — 본 helper 는 집계 descriptor 만 산출, 표현 layer 는 별도 후속 slice).
- `deploy/daily-test.sh` 의 `step_eval` wiring(step ④, ADR-0045 LAN gate).
- 평가 결과 영속화 / `EvaluationResult` → `Contribution` row 매핑 / Prisma write(별도 후속 slice / §5 schema 게이트).
- Person 별 / 기간 별 group-by 집계(본 helper 는 전체 result 집합 1 회 요약만). Person·기간 차원 분해는 별도 후속 slice(입력에 person/기간 식별자 동반 필요).
- 난이도별 routing(R-97) / 점수 산출 공식 / 가중 합산 — 본 helper 는 단순 카운트·volume 합산만(평가 점수 산출 아님).
- production `src/` 코드 변경 — 본 task 는 test helper 단독(타입·슬롯 배열 import 재사용만).
- 새 외부 dependency / schema migration / env·secret 접근.

## Suggested Sub-agents

implementer → tester

## Follow-ups

(비어있음 — sub-agent 가 관련 작업 발견 시 여기에 append)
