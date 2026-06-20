---
id: T-0541
title: 미평가 fill 입력용 영속 레코드 read-adapter EvaluationPersistedRecordsReader 추가
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-037, REQ-038]
dependsOn: []
independentStream: evaluation-coverage-gap
touchesFiles:
  - src/assessment-evaluation/evaluation-persisted-records-reader.service.ts
  - src/assessment-evaluation/evaluation-persisted-records-reader.service.spec.ts
estimatedDiff: 230
estimatedFiles: 2
created: 2026-06-20
plannerNote: P5 bullet 106(R-64/REQ-037) detection 사슬 첫 impure slice — findByPerson(REQ-038) 재사용 read-adapter, 새 query 표면/ADR 0
---

# T-0541 — 미평가 fill 입력용 영속 레코드 read-adapter EvaluationPersistedRecordsReader 추가

## Why

PLAN.md P5 bullet 106(R-64 / REQ-037 "평가 없는 부분 일괄 평가")의 detection 사슬은 순수-도메인 4 조각(enumerate / project / select / batch-plan)과 compose helper `composeUnevaluatedFillPlan`(T-0540 merge f3c0a79)까지 **순수-도메인 측이 전부 닫혔다**. compose helper 의 `UnevaluatedFillPlanInput.persisted` 는 "이미 읽어온 영속 Assessment 레코드 배열"을 받지만, 그 배열을 실제 DB 에서 길어 오는 **impure 입력 source 배선**은 아직 없다(T-0539 / T-0540 Out of Scope 가 명시적으로 후속 slice 로 deferred).

본 task 는 그 detection 사슬의 **첫 impure slice** — 여러 person 의 영속 Assessment 레코드를 기존 `AssessmentService.findByPerson`(REQ-038 시계열 조회, ADR-0033 query 표면) 으로 읽어 `composeUnevaluatedFillPlan` 의 `persisted` 입력 형태(`PersistedAssessmentRecord[]`)로 평탄화(flatten)하는 얇은 read-adapter `@Injectable` service 를 신설한다. **새 repository 메서드 / 새 query 표면 / 새 ADR / schema 변경은 일절 없다** — 이미 존재하는 `findByPerson` 를 person 별로 호출해 그 결과를 한 배열로 모으는 어댑터일 뿐이다. `Assessment` row 는 `PersistedAssessmentRecord`(좌표 4-field + index signature) 와 구조적 호환이라 추가 매핑도 불필요하다.

`intended` 좌표 range/person 결정과 orchestrator/controller 실배선은 본 task 범위 밖으로 그대로 deferred — REQ-038 query 표면 결정·user module 경계는 본 slice 에서 손대지 않는다(safe·dependency-free 유지).

## Required Reading

- `src/assessment-evaluation/domain/evaluation-unevaluated-fill-plan.ts` — compose helper 의 `UnevaluatedFillPlanInput.persisted` 입력 형태.
- `src/assessment-evaluation/domain/evaluation-persisted-period-coordinates.ts` — `PersistedAssessmentRecord` 타입(좌표 4-field + index signature, 본 reader 의 출력 element 타입).
- `src/user/assessment.service.ts` — 재사용할 `findByPerson(personId, options?)` 시그니처(L99~107). 새 메서드 추가 금지.
- `src/user/assessment.repository.ts` (L77~148) — `findByPerson` 가 `Assessment[]`(빈 매칭 시 `[]`)를 반환하고 `AssessmentFindByPersonOptions { period? }` 분기를 갖는다는 사실 확인.
- `src/assessment-evaluation/evaluation-result-persist.service.ts` (L26~41, L88~90) — 같은 module 의 기존 `@Injectable` service 가 의존성을 어떻게 주입받는지(constructor DI 패턴) 참고.
- `src/assessment-evaluation/assessment-evaluation.module.ts` — provider 등록 위치(본 task 는 module 파일을 건드리지 **않는다** — Out of Scope, 등록은 후속 wiring slice. 단 DI 패턴 참고용으로만 읽음).

## Acceptance Criteria

- [ ] `src/assessment-evaluation/evaluation-persisted-records-reader.service.ts` 신설 — `@Injectable() EvaluationPersistedRecordsReader` 클래스. constructor 로 `AssessmentService`(또는 `AssessmentRepository`, 둘 중 기존 의존성 주입 정책에 맞는 한쪽 — 새 의존성 추가 0) 주입.
- [ ] 공개 메서드 1 개: 여러 `personId` 목록(+ 선택적 `period` 옵션)을 받아, 각 person 에 대해 기존 `findByPerson` 를 호출하고 그 결과를 **person 입력 순서를 보존**한 단일 `PersistedAssessmentRecord[]` 로 평탄화(flatten)해 반환(`Promise<PersistedAssessmentRecord[]>`). 매핑/가공 없이 `Assessment` row 를 그대로 element 로 사용(구조적 호환 — 추가 컬럼은 `PersistedAssessmentRecord` index signature 가 흡수).
- [ ] 빈 `personId` 목록 → 빈 배열(`[]`) 반환(`findByPerson` 호출 0). 매칭 row 0 인 person → 그 person 기여분 0(빈 배열 자연 흡수).
- [ ] happy-path unit test 1+ — 2+ person 의 `findByPerson` mock 결과가 입력 순서대로 평탄화돼 반환되는지(순서·총 길이 검증).
- [ ] error path unit test 1+ — `personIds` 가 null/undefined 또는 non-array, 또는 원소가 non-string 일 때 명시적 한국어 메시지 `TypeError` 로 조기 차단(mirror: domain helper 들의 fail-fast 방어). 또한 주입된 `findByPerson` 이 reject 하면(의존성 실패) 그 rejection 이 그대로 전파되는지 검증.
- [ ] branch coverage — `period` 옵션 지정 분기 vs 미지정 분기 각 1+ test(옵션이 `findByPerson` 로 forward 되는지 `toHaveBeenCalledWith` 로 검증). 빈 목록 분기 1+ test.
- [ ] negative cases 충분 cover — (1) 빈 `personId` 목록, (2) 일부 person 만 매칭 row 보유(나머지 `[]`), (3) null/undefined personIds, (4) non-array personIds, (5) personIds 원소 non-string, (6) `findByPerson` reject(의존성 실패) — 각 1+ test. 단일 negative 만 작성 금지.
- [ ] 입력 비변형 — 전달받은 `personIds` 배열을 mutate 하지 않음(테스트로 검증).
- [ ] `pnpm lint && pnpm build && pnpm test` 통과. `pnpm test:cov` 통과(신규 파일 line ≥ 80% / function ≥ 80% — mirror-family 선례대로 100% 목표).
- [ ] colocated spec 위치: `src/assessment-evaluation/evaluation-persisted-records-reader.service.spec.ts`. mock 은 기존 `AssessmentService`/`AssessmentRepository` 의 jest mock 패턴(`assessment.service.spec.ts` 의 `findByPerson: jest.fn()` 참고) 재사용 — 새 helper 추출 불요.

## Out of Scope

- **`intended` 좌표 range/person 결정** — 어떤 person·기간을 평가하려는지 결정하는 source(스케줄러·요청 DTO 등) 배선은 본 task 밖. 후속 slice.
- **orchestrator/controller 실배선** — `composeUnevaluatedFillPlan` 호출 → 실제 일괄 평가 실행 compose 는 본 task 밖.
- **module provider 등록** — `assessment-evaluation.module.ts` 에 본 reader 를 provider 로 등록하는 것은 후속 wiring slice(실 소비처가 생길 때 함께). 본 task 는 class + spec 만(등록 없이도 unit test 는 독립 통과).
- **새 repository 메서드 / 새 query 표면** — `findByPerson` 외 새 read 메서드 추가 금지. REQ-038 query 표면 결정은 건드리지 않는다.
- **schema / migration / 새 dependency / auth 변경** — 없음. 하나라도 필요해지면 즉시 멈추고 BLOCKED(planner 재호출).
- **`AssessmentService.findByPerson` 의 기존 동작 변경** — 읽기만, 시그니처·정렬·분기 불변.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(비어 있음 — sub-agent 가 관련 작업 발견 시 추가)
