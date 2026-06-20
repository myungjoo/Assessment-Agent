---
id: T-0550
title: per-좌표 미평가 fill 요청 intent → 기존 bridge 진입점 PeriodBridgeDto 배열 순수 mapper toPeriodBridgeRequests 추가
phase: P5
status: DONE
commitMode: pr
coversReq: [REQ-037, REQ-038]
dependsOn: []
independentStream: evaluation-coverage-gap
touchesFiles:
  - src/assessment-evaluation/dto/fill-requests-to-bridge.mapper.ts
  - src/assessment-evaluation/dto/fill-requests-to-bridge.mapper.spec.ts
estimatedDiff: 200
estimatedFiles: 2
created: 2026-06-20
plannerNote: "P5 bullet 106(R-64/REQ-037) — plan→execute 전이 2번째 순수 조각: T-0549 fill 요청 intent[] 를 기존 per-좌표 bridge 진입점 PeriodBridgeDto[] 로 매핑. orchestrator 실배선·LLM deferred."
---

# T-0550 — per-좌표 미평가 fill 요청 intent → 기존 bridge 진입점 PeriodBridgeDto 배열 순수 mapper toPeriodBridgeRequests 추가

## Why

PLAN.md P5 bullet 106(R-64 / REQ-037 "평가 없는 부분 일괄 평가")의 plan→execute 전이는 T-0549(merge 522805f, PR #463)로 **미평가 fill batch plan 을 per-좌표 평가 요청 intent 의 1 차원 배열 `UnevaluatedFillRequest[]`(personId/period/scope/periodStart:string)로 평탄화**하는 첫 순수 조각이 박제됐다. 이 요청 intent 의 shape 은 이미 존재하는 per-좌표 평가 실행 진입점 `PeriodBridgeDto`(personId/period/scope/periodStart + 선택 reevaluate, ADR-0037 slice 1)와 동형이다. 본 task 는 plan→execute 사슬을 한 칸 더 전진시키는 **2 번째 순수-domain 조각**으로, `UnevaluatedFillRequest[]` 를 기존 bridge 진입점이 소비하는 `PeriodBridgeDto[]` 로 변환하는 dependency-free 순수 함수 `toPeriodBridgeRequests` 를 추가한다. REQ-064 의 "fill"(미평가 빈칸 채우기)은 **first-write-wins**(ADR-0037 §Decision3 / ADR-0038 §Decision1)라 `reevaluate` 축은 set 하지 않는다(overwrite 아님). 이렇게 두 사슬(미평가 detection 사슬 ↔ 기존 per-좌표 bridge 실행 경로)의 형 경계를 순수 mapper 로 닫아, 다음 impure wiring slice(bridge orchestrator 실호출 + fresh-collect + LLM 평가 + 영속)에서 곧장 소비 가능한 입력 형태를 마련한다. 실 orchestrator/bridge 배선·controller 실행 route·LLM 네트워크 round-trip(live-LLM standing 게이트 bullet 108, 만료 2026-06-30)은 후속 impure slice 로 분리 유지한다.

## Required Reading

- `src/assessment-evaluation/domain/evaluation-unevaluated-fill-requests.ts` — 입력 타입 `UnevaluatedFillRequest`(personId/period/scope/periodStart:string) 정의·평탄화 순서/dedup-안함/비변형 정책(T-0549 merge 522805f)
- `src/assessment-evaluation/dto/period-bridge.dto.ts` — 출력 매핑 대상 `PeriodBridgeDto`(personId/period/scope/periodStart:string + 선택 reevaluate?:boolean) 의 4 필수축 + reevaluate 의미(ADR-0037/0038 — fill 은 set 안 함). class-validator decorator 는 controller-scope ValidationPipe 가 강제하므로 본 mapper 는 plain 객체 조립만(런타임 validate 호출 0)
- `src/assessment-evaluation/dto/unevaluated-fill-plan-response.mapper.ts` — 동일 module 의 순수 mapper 패턴 mirror(null/undefined fail-fast 한국어 TypeError + 비변형 map + @Injectable 0)
- (광범위 read 금지 — 위 3 파일 + colocated spec 외 추가 read 불요)

## Acceptance Criteria

- [ ] `src/assessment-evaluation/dto/fill-requests-to-bridge.mapper.ts` 에 순수 함수 `toPeriodBridgeRequests(requests: UnevaluatedFillRequest[]): PeriodBridgeDto[]` 추가. 4 축(personId/period/scope/periodStart) 전부 passthrough 로 새 `PeriodBridgeDto` plain 객체에 전사. `reevaluate` 축은 **set 하지 않는다**(undefined 유지 — fill = first-write-wins, overwrite 아님). 부수효과 0 / 외부 의존 0(`@Injectable`·Prisma·LLM·class-validator 런타임 호출·repository import 0, 두 타입 import 만).
- [ ] 순서 결정성: 입력 `requests` 의 순서(T-0549 평탄화 순서 — person 묶음 순서 + 묶음 내부 좌표 순서)를 **그대로 보존**한 1:1 매핑. dedup / 재정렬 / 필터 0(중복 입력은 중복 출력 그대로).
- [ ] **Happy-path unit test**: 정상 `UnevaluatedFillRequest[]`(2+ 원소)을 매핑해 (i) 출력 길이 === 입력 길이, (ii) 각 원소의 personId/period/scope/periodStart 가 입력과 일치, (iii) 각 출력 원소의 `reevaluate` 가 undefined(미설정)임을 단언하는 test 1+.
- [ ] **Error path unit test**: `requests` 가 null/undefined 일 때 한국어 메시지 `TypeError` fail-fast 1+. 배열 원소가 null/undefined 일 때 한국어 메시지 `TypeError`(인덱스 포함) 1+.
- [ ] **Flow / branch coverage**: 분기마다 test 분리 — (a) 빈 배열 `[]` → 빈 배열 반환, (b) 단일 원소, (c) 다중 원소(순서 보존), (d) 동일 좌표 중복 원소 → dedup 안 함(중복 그대로).
- [ ] **Negative cases 충분 cover**: 예외 상황 각 1+ test — requests null/undefined, requests non-array(예: 객체·string), 배열 원소 null/undefined, 빈 personId(""은 그대로 passthrough — 정규화 안 함, 경계값). 단일 negative 만 작성 금지.
- [ ] **비변형 단언**: 입력 `requests` 배열·각 요청 객체 모두 mutate 0 — 반환은 새 배열/새 `PeriodBridgeDto` 인스턴스. 입력 원소와 출력 원소가 서로 다른 객체 참조임을 단언하는 test 1+.
- [ ] `pnpm lint && pnpm build && pnpm test` green, `pnpm test:cov` 통과(line ≥ 80% / function ≥ 80% — 신규 파일은 100% 목표).
- [ ] tester 가 `fill-requests-to-bridge.mapper.spec.ts`(colocated, 위 경로) 에 spec 작성 — describe/it 라벨 한국어 명확화(§12).

## Out of Scope

- bridge orchestrator/service 실배선(매핑한 `PeriodBridgeDto[]` → 실제 per-좌표 fresh-collect → LLM 평가 → 영속) — 후속 impure wiring slice. 본 task 는 순수 형 변환만.
- controller 실행 route(예 POST .../unevaluated-fill-run) 신설 — 후속 slice.
- LLM 네트워크 호출·live-LLM 검증(standing 게이트 bullet 108, 만료 2026-06-30 수동) — 건드리지 않음.
- reeval/overwrite 경로(ADR-0033/ADR-0038) — fill 은 first-write-wins 라 `reevaluate` 축 set 금지. overwrite 결합은 본 mapper 밖(orchestration 책임).
- class-validator 런타임 validate 호출(`validateOrReject` 등) — controller-scope ValidationPipe 책임. 본 mapper 는 plain 객체 조립만.
- 새 dependency / ADR / schema / migration / module provider 등록 — 0. 등록 없이 unit test 독립 통과.

## Suggested Sub-agents

implementer → tester

## Follow-ups

(비어 있음 — sub-agent 가 관련 작업 발견 시 추가)
