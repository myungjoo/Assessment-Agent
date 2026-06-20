---
id: T-0542
title: 미평가 fill 계획 impure compose service EvaluationUnevaluatedFillPlanner 추가
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-037, REQ-038]
dependsOn: []
independentStream: evaluation-coverage-gap
touchesFiles:
  - src/assessment-evaluation/evaluation-unevaluated-fill-planner.service.ts
  - src/assessment-evaluation/evaluation-unevaluated-fill-planner.service.spec.ts
estimatedDiff: 230
estimatedFiles: 2
created: 2026-06-20
plannerNote: P5 bullet 106(R-64/REQ-037) detection 사슬 impure compose slice — reader(T-0541)+composeUnevaluatedFillPlan(T-0540) 조립, 새 query 표면/ADR 0
---

# T-0542 — 미평가 fill 계획 impure compose service EvaluationUnevaluatedFillPlanner 추가

## Why

PLAN.md P5 bullet 106(R-64 / REQ-037 "평가 없는 부분 일괄 평가")의 detection 사슬은 순수-도메인 5 조각(enumerate / project / select / batch-plan / compose `composeUnevaluatedFillPlan`, T-0540 merge f3c0a79)과 첫 impure 입력 source(영속 레코드 read-adapter `EvaluationPersistedRecordsReader`, T-0541 merge 4ad4373)까지 모두 닫혔다.

지금 빠진 것은 그 둘을 잇는 **impure compose 단계**다 — `composeUnevaluatedFillPlan`(T-0540) 의 `UnevaluatedFillPlanInput.persisted` 는 "이미 읽어온 영속 레코드 배열"을 받지만, 그 배열을 실제로 길어 오는 `EvaluationPersistedRecordsReader`(T-0541) 와 순수 compose helper 사이를 연결하는 service 는 아직 없다(T-0540 / T-0541 Out of Scope 가 명시적으로 후속 wiring slice 로 deferred).

본 task 는 그 연결 slice — `intended` enumeration 입력(`IntendedPeriodCoordinatesInput`)을 받아, 그 안의 `personIds`(+ `period`)로 `EvaluationPersistedRecordsReader` 를 호출해 영속 레코드를 읽고, 그 결과를 `UnevaluatedFillPlanInput { intended, persisted }` 로 조립한 뒤 순수 `composeUnevaluatedFillPlan` 을 호출해 `UnevaluatedFillBatchPlan` 을 반환하는 얇은 `@Injectable` service `EvaluationUnevaluatedFillPlanner` 를 신설한다. **새 repository 메서드 / 새 query 표면 / 새 ADR / schema 변경은 일절 없다** — 기존 reader 와 기존 순수 helper 를 조립할 뿐이다.

`intended` range 의 외부 source(스케줄러·요청 DTO) 결정, orchestrator/controller 실배선, module provider 등록은 본 task 범위 밖으로 그대로 deferred — REQ-038 query 표면·user module 경계는 손대지 않는다(safe·dependency-free 유지).

## Required Reading

- `src/assessment-evaluation/domain/evaluation-unevaluated-fill-plan.ts` — 호출할 순수 `composeUnevaluatedFillPlan(input: UnevaluatedFillPlanInput)` 시그니처와 `UnevaluatedFillPlanInput { intended, persisted }` 형태.
- `src/assessment-evaluation/domain/evaluation-intended-period-coordinates.ts` (L41~47) — `IntendedPeriodCoordinatesInput { personIds, period, scope, rangeStart, rangeEnd }` 타입(본 service 입력으로 그대로 재사용 — 새 입력 타입 발명 0).
- `src/assessment-evaluation/domain/evaluation-persisted-period-coordinates.ts` — `PersistedAssessmentRecord` 타입(reader 출력 = compose `persisted` 입력 element).
- `src/assessment-evaluation/evaluation-persisted-records-reader.service.ts` — 주입·호출할 `EvaluationPersistedRecordsReader` 의 공개 메서드 시그니처(personId 목록 + 선택적 period → `Promise<PersistedAssessmentRecord[]>`). 본 service 가 그대로 재사용.
- `src/assessment-evaluation/evaluation-result-persist.service.ts` (L26~41) — 같은 module 의 기존 `@Injectable` service 의 constructor DI 패턴 참고.
- `src/assessment-evaluation/assessment-evaluation.module.ts` — DI 패턴 참고용으로만 읽음(본 task 는 module 파일을 건드리지 **않는다** — Out of Scope, provider 등록은 후속 slice).

## Acceptance Criteria

- [ ] `src/assessment-evaluation/evaluation-unevaluated-fill-planner.service.ts` 신설 — `@Injectable() EvaluationUnevaluatedFillPlanner` 클래스. constructor 로 `EvaluationPersistedRecordsReader`(T-0541) 1 개만 주입(새 의존성 추가 0).
- [ ] 공개 메서드 1 개: `IntendedPeriodCoordinatesInput` 을 받아 — (1) 그 입력의 `personIds`(+ `period`)로 `EvaluationPersistedRecordsReader` 를 await 호출해 `PersistedAssessmentRecord[]` 를 읽고, (2) `{ intended: <입력>, persisted: <읽은 배열> }` 로 `UnevaluatedFillPlanInput` 을 조립한 뒤, (3) 순수 `composeUnevaluatedFillPlan` 을 호출해 결과(`UnevaluatedFillBatchPlan`)를 `Promise` 로 반환. compose 결과 가공/필터 추가 0(순수 helper 의 결정성·순서 정책 그대로 전파).
- [ ] reader 에 forward 하는 인자 정합 — `intended.personIds` 와 `intended.period`(period 옵션이 reader 시그니처에 forward 가능한 형태인지 확인 후 전달). `toHaveBeenCalledWith` 로 reader 호출 인자가 입력에서 파생됨을 검증.
- [ ] happy-path unit test 1+ — reader mock 이 2+ person 영속 레코드를 반환할 때, 그 배열이 `composeUnevaluatedFillPlan` 의 `persisted` 로 그대로 흘러 최종 `UnevaluatedFillBatchPlan` 이 산출되는지(end-to-end 조립 검증).
- [ ] error path unit test 1+ — (a) `intended` 가 null/undefined 또는 필수 field 누락일 때 명시적 한국어 메시지 `TypeError` 로 조기 차단(wrapper-level fail-fast, mirror: domain helper 방어), (b) 주입된 reader 가 reject 하면(의존성 실패) 그 rejection 이 그대로 전파되는지 검증.
- [ ] branch coverage — `intended.period` 지정 분기 vs 미지정(undefined) 분기가 reader 호출에 어떻게 반영되는지 각 1+ test. 빈 `personIds` → reader 가 빈 배열 반환 → compose 가 빈 plan 산출 분기 1+ test.
- [ ] negative cases 충분 cover — (1) `intended` null/undefined, (2) `intended.personIds` 빈 배열, (3) reader reject(의존성 실패), (4) 일부 person 만 영속 레코드 보유(나머지 빈 배열 자연 흡수), (5) `intended` 필수 field(period/scope/rangeStart/rangeEnd) 누락 시 순수 조각 방어 자연 전파 — 각 1+ test. 단일 negative 만 작성 금지.
- [ ] 입력 비변형 — 전달받은 `intended` 객체를 mutate 하지 않음(테스트로 검증).
- [ ] `pnpm lint && pnpm build && pnpm test` 통과. `pnpm test:cov` 통과(신규 파일 line ≥ 80% / function ≥ 80% — mirror-family 선례대로 100% 목표).
- [ ] colocated spec 위치: `src/assessment-evaluation/evaluation-unevaluated-fill-planner.service.spec.ts`. mock 은 `EvaluationPersistedRecordsReader` 의 공개 메서드를 `jest.fn()` 으로 stub(`evaluation-persisted-records-reader.service.spec.ts` 의 mock 패턴 참고). 새 helper 추출 불요.

## Out of Scope

- **`intended` range/person 외부 source 결정** — 어떤 person·기간을 평가하려는지 정하는 source(스케줄러·요청 DTO 등) 배선은 본 task 밖. 후속 slice. 본 service 는 이미 결정된 `IntendedPeriodCoordinatesInput` 을 받기만 한다.
- **orchestrator/controller 실배선** — 본 service 가 산출한 `UnevaluatedFillBatchPlan` 을 실제 일괄 평가 실행으로 잇는 compose 는 본 task 밖.
- **module provider 등록** — `assessment-evaluation.module.ts` 에 본 planner 와 reader(T-0541) 를 provider 로 등록하는 것은 후속 wiring slice(실 소비처가 생길 때 함께). 본 task 는 class + spec 만(등록 없이도 unit test 는 독립 통과).
- **새 repository 메서드 / 새 query 표면** — `findByPerson`(reader 내부) 외 새 read 메서드 추가 금지. REQ-038 query 표면 결정은 건드리지 않는다.
- **schema / migration / 새 dependency / auth 변경** — 없음. 하나라도 필요해지면 즉시 멈추고 BLOCKED(planner 재호출).
- **순수 조각 동작 변경** — `composeUnevaluatedFillPlan` / enumerate / project / select / batch-plan 의 시그니처·정렬·분기 불변. 본 service 는 조립만.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(비어 있음 — sub-agent 가 관련 작업 발견 시 추가)
