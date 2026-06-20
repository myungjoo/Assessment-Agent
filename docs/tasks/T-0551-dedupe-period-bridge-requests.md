---
id: T-0551
title: per-좌표 미평가 fill bridge 요청 배열 결정적 중복 제거 순수 helper dedupePeriodBridgeRequests 추가
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-037, REQ-038]
dependsOn: []
independentStream: evaluation-coverage-gap
touchesFiles:
  - src/assessment-evaluation/dto/dedupe-period-bridge-requests.ts
  - src/assessment-evaluation/dto/dedupe-period-bridge-requests.spec.ts
estimatedDiff: 200
estimatedFiles: 2
created: 2026-06-20
plannerNote: "P5 bullet 106(R-64/REQ-037) — plan→execute 전이 3번째 순수 조각: PeriodBridgeDto[] 좌표 중복 결정적 제거(first-wins). orchestrator 실배선·LLM deferred."
---

# T-0551 — per-좌표 미평가 fill bridge 요청 배열 결정적 중복 제거 순수 helper dedupePeriodBridgeRequests 추가

## Why

PLAN.md P5 bullet 106(R-64 / REQ-037 "평가 없는 부분 일괄 평가" / REQ-038)의 plan→execute 전이는 T-0549(merge 522805f, batch plan → `UnevaluatedFillRequest[]` 평탄화)와 T-0550(merge 3f2221b, PR #464, 요청 intent → `PeriodBridgeDto[]` 매핑) 두 순수 조각으로 진행됐다. T-0549/T-0550 은 의도적으로 **dedup 을 하지 않는다**(주석/Out of Scope 명시 — "중복 입력은 중복 출력 그대로, 차집합 멤버십은 상류 책임"). 그러나 일괄 평가를 실제로 흘리기 직전, **같은 좌표(personId/period/scope/periodStart)가 한 batch run 안에 두 번 들어오면 같은 평가를 두 번 실행·영속하게 된다** — fill = first-write-wins(ADR-0037 §Decision3 / ADR-0038 §Decision1)라 두 번째 실행은 낭비(중복 LLM 호출 + 멱등성 부담)다. 본 task 는 plan→execute 사슬을 한 칸 더 전진시키는 **3 번째 순수-domain 조각**으로, `PeriodBridgeDto[]` 를 받아 동일 좌표 중복을 결정적으로 제거하는 dependency-free 순수 함수 `dedupePeriodBridgeRequests` 를 추가한다 — **첫 등장(first-wins) 보존**으로 fill 의 first-write-wins 의미와 정합하며, 입력 순서를 보존한다. 이로써 orchestration-input 조립(평탄화 → 매핑 → dedup) 의 순수 단계가 닫혀, 다음 impure wiring slice(bridge orchestrator 실호출 + fresh-collect + LLM 평가 + 영속)가 곧장 소비할 깨끗한 입력 형태를 마련한다. 실 orchestrator/bridge 배선·controller 실행 route·LLM 네트워크 round-trip(live-LLM standing 게이트 bullet 108, 만료 2026-06-30)은 후속 impure slice 로 분리 유지한다.

## Required Reading

- `src/assessment-evaluation/dto/period-bridge.dto.ts` — 입력/출력 원소 타입 `PeriodBridgeDto`(personId/period/scope/periodStart:string + 선택 reevaluate?:boolean) 의 좌표 4 축 정의. 좌표 동일성(중복) 판정 key = (personId, period, scope, periodStart) 4-tuple. `reevaluate` 축은 dedup key 에 **포함하지 않는다**(fill 은 reevaluate 미설정 — T-0550 mapper 가 set 안 함). class-validator decorator 는 controller-scope ValidationPipe 책임이라 본 helper 는 plain 객체만 다룬다(런타임 validate 호출 0)
- `src/assessment-evaluation/dto/fill-requests-to-bridge.mapper.ts` — 본 helper 의 직전 단계(`toPeriodBridgeRequests`) 의 출력 형태·순서 보존/dedup-안함/비변형 정책(T-0550 merge 3f2221b). 본 helper 는 그 출력을 입력으로 받아 dedup 만 추가
- `src/assessment-evaluation/dto/unevaluated-fill-plan-response.mapper.ts` — 동일 module 의 순수 mapper 패턴 mirror(null/undefined fail-fast 한국어 TypeError + 비변형 + @Injectable 0 + Prisma/LLM import 0)
- (광범위 read 금지 — 위 3 파일 + colocated spec 외 추가 read 불요)

## Acceptance Criteria

- [ ] `src/assessment-evaluation/dto/dedupe-period-bridge-requests.ts` 에 순수 함수 `dedupePeriodBridgeRequests(requests: PeriodBridgeDto[]): PeriodBridgeDto[]` 추가. 동일 좌표 4-tuple(personId/period/scope/periodStart) 중복을 제거하고 **첫 등장(first-wins) 원소만 보존**한다. dedup key 산출은 4 축을 안전하게 결합(예: 구분자 escaping 또는 JSON 키 직렬화로 `"a|b"` vs `"a","b"` 충돌 방지). `reevaluate` 축은 key 에 포함하지 않는다. 부수효과 0 / 외부 의존 0(`@Injectable`·Prisma·LLM·class-validator 런타임 호출·repository import 0, `PeriodBridgeDto` 타입 import 만).
- [ ] 순서 결정성: 입력 `requests` 의 등장 순서를 보존한 채 첫 등장 원소만 남긴다(stable dedup). 재정렬 0 — 출력 원소 순서는 각 좌표가 입력에서 **처음 나타난 위치** 순서와 같다.
- [ ] **Happy-path unit test**: 중복 없는 `PeriodBridgeDto[]`(2+ 원소)는 길이·순서·각 원소 참조가 그대로 통과함을 단언하는 test 1+. 중복이 있는 입력은 중복이 제거되고 첫 등장만 남아 길이가 줄어듦을 단언하는 test 1+.
- [ ] **Error path unit test**: `requests` 가 null/undefined 일 때 한국어 메시지 `TypeError` fail-fast 1+. 배열 원소가 null/undefined 일 때 한국어 메시지 `TypeError`(인덱스 포함) 1+.
- [ ] **Flow / branch coverage**: 분기마다 test 분리 — (a) 빈 배열 `[]` → 빈 배열 반환, (b) 중복 없는 단일/다중 원소 → 전부 보존, (c) 동일 좌표 인접 중복 → 첫 것만 보존, (d) 동일 좌표 비인접(사이에 다른 좌표) 중복 → 첫 것만 보존(전역 dedup, 인접만 아님).
- [ ] **Negative cases 충분 cover**: 예외 상황 각 1+ test — requests null/undefined, requests non-array(예: 객체·string), 배열 원소 null/undefined, key 구분자 충돌 회피 검증(예: `personId="a|b", period=""` vs `personId="a", period="b"` 같은 좌표가 **서로 다른** 것으로 취급되어 dedup 되지 않음 — false-merge 방지), 한 축만 다른 좌표(예 periodStart 만 다름)는 별개로 취급되어 둘 다 보존. 단일 negative 만 작성 금지.
- [ ] **비변형 단언**: 입력 `requests` 배열·각 요청 객체 모두 mutate 0 — 반환은 새 배열(필터링된 부분집합). 보존된 원소는 **입력의 동일 객체 참조를 그대로 재사용**함(새 인스턴스 복제 안 함 — first-wins 원소 passthrough)을 단언하는 test 1+. 입력 배열 길이가 호출 후에도 그대로임을 단언하는 test 1+.
- [ ] `pnpm lint && pnpm build && pnpm test` green, `pnpm test:cov` 통과(line ≥ 80% / function ≥ 80% — 신규 파일은 100% 목표).
- [ ] tester 가 `dedupe-period-bridge-requests.spec.ts`(colocated, 위 경로) 에 spec 작성 — describe/it 라벨 한국어 명확화(§12).

## Out of Scope

- bridge orchestrator/service 실배선(dedup 한 `PeriodBridgeDto[]` → 실제 per-좌표 fresh-collect → LLM 평가 → 영속) — 후속 impure wiring slice. 본 task 는 순수 dedup 만.
- controller 실행 route(예 POST .../unevaluated-fill-run) 신설 — 후속 slice.
- LLM 네트워크 호출·live-LLM 검증(standing 게이트 bullet 108, 만료 2026-06-30 수동) — 건드리지 않음.
- 상류 mapper(T-0549/T-0550) 에 dedup 역삽입 금지 — 그 두 단계의 "dedup 안 함" 계약은 의도된 것(차집합 멤버십 책임 분리). dedup 은 본 orchestration-input 조립 단계의 별도 helper 로만.
- `reevaluate` 축을 dedup key 에 포함 / overwrite 결합(ADR-0033/ADR-0038) — fill 은 first-write-wins 라 reevaluate 미설정. overwrite 경로는 본 helper 밖(orchestration 책임).
- class-validator 런타임 validate 호출(`validateOrReject` 등) — controller-scope ValidationPipe 책임. 본 helper 는 plain 객체만 다룬다.
- 새 dependency / ADR / schema / migration / module provider 등록 — 0. 등록 없이 unit test 독립 통과.

## Suggested Sub-agents

implementer → tester

## Follow-ups

(비어 있음 — sub-agent 가 관련 작업 발견 시 추가)
