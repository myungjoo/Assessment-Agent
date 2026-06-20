---
id: T-0549
title: 미평가 fill batch plan → per-좌표 평가 요청 intent 평탄화 순수 helper buildUnevaluatedFillRequests 추가
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-037, REQ-038]
dependsOn: []
independentStream: evaluation-coverage-gap
touchesFiles:
  - src/assessment-evaluation/domain/evaluation-unevaluated-fill-requests.ts
  - src/assessment-evaluation/domain/evaluation-unevaluated-fill-requests.spec.ts
estimatedDiff: 200
estimatedFiles: 2
created: 2026-06-20
plannerNote: "P5 bullet 106(R-64/REQ-037) — fill detection 사슬 완결(controller+e2e) 후 plan→execute 전이의 첫 순수 조각: BatchPlan 평탄화 helper. orchestrator 실배선·LLM 경로 deferred."
---

# T-0549 — 미평가 fill batch plan → per-좌표 평가 요청 intent 평탄화 순수 helper buildUnevaluatedFillRequests 추가

## Why

PLAN.md P5 bullet 106(R-64 / REQ-037 "평가 없는 부분 일괄 평가")의 detection 사슬은 T-0548(POST /api/assessment-evaluation/unevaluated-fill-plan e2e, merge c7f3583)로 **DTO→request mapper→planner→response mapper→controller route→e2e 전 조각이 머지 완결**됐다. 그러나 현재까지의 산출물은 *미평가 좌표를 person 별로 묶은 계획*(`UnevaluatedFillBatchPlan`) 까지일 뿐, 그 계획을 **실제 일괄 평가 실행으로 흘릴 per-좌표 요청 형태로는 아직 평탄화되지 않았다**. 본 task 는 detection→consume 사슬을 *plan* 에서 *execute* 방향으로 한 칸 전진시키는 **첫 순수-domain 조각**으로, `UnevaluatedFillBatchPlan` 을 기존 per-좌표 평가 진입점(`PeriodBridgeDto`: personId/period/scope/periodStart) 과 동형의 요청 intent 배열로 평탄화하는 dependency-free 순수 함수 `buildUnevaluatedFillRequests` 를 추가한다. 실 orchestrator/bridge 배선(LLM 네트워크 round-trip 동반)·controller 실행 route 는 후속 impure wiring slice 로 분리 유지한다 — live-LLM 검증은 standing 게이트(bullet 108)라 본 task 에서 건드리지 않는다.

## Required Reading

- `src/assessment-evaluation/domain/evaluation-unevaluated-fill-batch-plan.ts` — 입력 타입 `UnevaluatedFillBatchPlan` / `UnevaluatedFillBatch` / `EvaluationPersistContext` 좌표 4-tuple 정의·순서 정책(person 최초 등장 순서 + 묶음 내부 gap 등장 순서)
- `src/assessment-evaluation/dto/period-bridge.dto.ts` — per-좌표 평가 진입점 `PeriodBridgeDto`(personId/period/scope/periodStart ISO string + 선택 reevaluate). 본 helper 출력 intent 의 형 shape 참고(단 class-validator decorator·@Injectable 0 — 순수 타입만 신설)
- `src/assessment-evaluation/dto/unevaluated-fill-plan-response.mapper.ts` — `formatKstIso`(Date→offset-명시 ISO string) single-source 경유 패턴 + null/undefined fail-fast + 비변형 map 패턴 mirror (T-0546)
- `src/common/period-boundary.ts` — `formatKstIso` 의 정의·Invalid Date / 비-Date 시 `TypeError` 자연 전파 계약 확인(해당 export 만; 광범위 read 금지)

## Acceptance Criteria

- [ ] `src/assessment-evaluation/domain/evaluation-unevaluated-fill-requests.ts` 에 순수 함수 `buildUnevaluatedFillRequests(plan: UnevaluatedFillBatchPlan): UnevaluatedFillRequest[]` 추가. `UnevaluatedFillRequest` 출력 타입 1종 신설(personId/period/scope/periodStart:string — periodStart 만 `formatKstIso` 경유 Date→ISO string 변환, 나머지 3축 passthrough). 부수효과 0 / 외부 의존 0(`@Injectable`·Prisma·LLM·repository import 0, 도메인 타입 + `formatKstIso` import 만).
- [ ] 평탄화 순서 결정성: `plan.batches` 의 person 묶음 순서(person 최초 등장 순서) → 각 묶음 내부 `periods` 의 gap 등장 순서를 **그대로 보존**해 1차원 배열로 평탄화(stable flatten). 같은 좌표가 plan 에 중복으로 들어와 있으면 출력에도 중복 그대로 보존(dedup 안 함 — 차집합 멤버십은 상류 T-0536 책임).
- [ ] **Happy-path unit test**: 정상 `UnevaluatedFillBatchPlan`(2+ person 묶음, 각 묶음 1+ 좌표)을 평탄화해 (i) 출력 길이 === `plan.totalGapCount`, (ii) person/좌표 순서가 plan 순서와 일치, (iii) periodStart 가 `formatKstIso` 산출 offset-명시 ISO string(예 `+09:00`)임을 단언하는 test 1+.
- [ ] **Error path unit test**: `plan` 이 null/undefined 일 때 한국어 메시지 `TypeError` fail-fast 1+. `plan.batches` / 묶음의 `periods` 가 비정상(null/undefined·non-array)일 때, 또는 좌표 `periodStart` 가 Invalid Date / 비-Date 일 때 `formatKstIso` 의 `TypeError` 가 자연 전파됨을 단언하는 test 각 1+.
- [ ] **Flow / branch coverage**: 분기마다 test 분리 — (a) 빈 plan(`batches: []`, totalGapCount 0) → 빈 배열 반환, (b) 단일 person 단일 좌표, (c) 다중 person 다중 좌표(순서 보존), (d) 동일 좌표 중복 등장 시 dedup 안 함.
- [ ] **Negative cases 충분 cover**: 예외 상황 각 1+ test — plan null/undefined, batches null/undefined, periods null/undefined, 좌표 원소 null/undefined, periodStart 비-Date / Invalid Date, 빈 personId(""은 유효 key 로 허용 — 정규화 안 함, 경계값). 단일 negative 만 작성 금지.
- [ ] **비변형 단언**: 입력 `plan`·`batches`·`periods` 배열·좌표 객체 모두 mutate 0 — 반환은 새 배열/새 객체. 입력 좌표를 mutate 하지 않음을 단언하는 test 1+.
- [ ] `pnpm lint && pnpm build && pnpm test` green, `pnpm test:cov` 통과(line ≥ 80% / function ≥ 80% — 신규 파일은 100% 목표).
- [ ] tester 가 `evaluation-unevaluated-fill-requests.spec.ts`(colocated, 위 경로) 에 spec 작성 — describe/it 라벨 한국어 명확화(§12).

## Out of Scope

- orchestrator/bridge 실배선(평탄화한 요청 intent → 실제 fresh-collect → LLM 평가 → 영속) — 후속 impure wiring slice. 본 task 는 순수 변환만.
- controller 실행 route(예 POST .../unevaluated-fill-run) 신설 — 후속 slice.
- LLM 네트워크 호출·live-LLM 검증(standing 게이트 bullet 108, 만료 2026-06-30 수동) — 건드리지 않음.
- reeval/overwrite 경로(ADR-0033/ADR-0038) flag 결합 — 직교. 본 intent 출력에 reevaluate 축 baking 금지(요청 평탄화만).
- 새 dependency / ADR / schema / migration / module provider 등록 — 0. 등록 없이 unit test 독립 통과.
- DTO class-validator 검증 helper / @Injectable service 화 — 본 task 는 순수 도메인 함수 + 타입 1종만.

## Suggested Sub-agents

implementer → tester

## Follow-ups

(비어 있음 — sub-agent 가 관련 작업 발견 시 추가)
