---
id: T-0543
title: 미평가 fill detection 사슬 service 2종 AssessmentEvaluationModule provider 등록
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-037, REQ-038]
dependsOn: []
independentStream: evaluation-coverage-gap
touchesFiles:
  - src/assessment-evaluation/assessment-evaluation.module.ts
  - src/assessment-evaluation/assessment-evaluation.module.spec.ts
estimatedDiff: 90
estimatedFiles: 2
created: 2026-06-20
plannerNote: P5 bullet 106(R-64/REQ-037) detection 사슬 wiring slice — reader(T-0541)+planner(T-0542) DI 등록, 새 import/query 표면/ADR 0
---

# T-0543 — 미평가 fill detection 사슬 service 2종 AssessmentEvaluationModule provider 등록

## Why

PLAN.md P5 bullet 106(R-64 / [REQ-037](../requirements.md) "평가 없는 부분 일괄 평가")의 detection 사슬은 순수-도메인 5 조각 + 첫 impure 입력 source `EvaluationPersistedRecordsReader`(T-0541 merge 4ad4373) + impure compose service `EvaluationUnevaluatedFillPlanner`(T-0542 merge 2ff683a)까지 **class 단위로 전부 닫혔다**. 그러나 그 두 `@Injectable` service 는 아직 `AssessmentEvaluationModule` 에 provider 로 **등록되지 않았다** — T-0541 / T-0542 의 Out of Scope 가 module provider 등록을 "실 소비처가 생길 때 함께" 진행하는 후속 wiring slice 로 명시적으로 deferred 했다.

본 task 는 그 등록 slice — `EvaluationPersistedRecordsReader`(T-0541)와 `EvaluationUnevaluatedFillPlanner`(T-0542)를 `assessment-evaluation.module.ts` 의 `providers` 에 등록하고(향후 orchestrator/controller 소비처가 inject 받도록 `exports` 에도 추가), 둘 다 NestJS DI 그래프에서 정상 resolve 되는지 module spec 으로 검증한다. **새 import / 새 dependency / 새 query 표면 / 새 ADR / schema 변경은 일절 없다** — reader 의 유일한 생성자 의존 `AssessmentService` 는 module 이 이미 import 중인 `UserModule` 이 export(`user.module.ts` L174)하고, planner 의 유일한 의존 `EvaluationPersistedRecordsReader` 는 본 task 에서 같은 module 의 provider 가 되므로 같은 module 내 DI 로 resolve 된다(추가 module import 0).

orchestrator/controller 실배선(plan → 실 일괄 평가 실행), `intended` range 외부 source 결정은 본 task 범위 밖으로 그대로 deferred — REQ-038 query 표면·module 경계는 손대지 않는다(safe·dependency-free 유지).

## Required Reading

- `src/assessment-evaluation/assessment-evaluation.module.ts` — provider/export 등록 위치(L66 `imports` 에 `UserModule` 이미 존재 / L70~124 `providers` / L126~142 `exports`). 본 task 가 편집할 파일.
- `src/assessment-evaluation/assessment-evaluation.module.spec.ts` — 기존 module spec(212 lines, PrismaService + 전이 delegate mock 패턴, `Test.createTestingModule` 으로 compile + provider resolve 검증). 본 task 가 resolve assertion 2 개를 추가할 파일.
- `src/assessment-evaluation/evaluation-persisted-records-reader.service.ts` (L49) — 등록할 reader 의 생성자 의존 `AssessmentService`(UserModule export) 1 개. 새 token 0.
- `src/assessment-evaluation/evaluation-unevaluated-fill-planner.service.ts` (L37~39) — 등록할 planner 의 생성자 의존 `EvaluationPersistedRecordsReader` 1 개(본 task 에서 같은 module provider 가 됨).
- `src/user/user.module.ts` (L172~176) — `AssessmentService` 가 `UserModule` 의 export 에 포함됨을 확인(reader DI resolve 의 근거 — 추가 import 불요).

## Acceptance Criteria

- [ ] `src/assessment-evaluation/assessment-evaluation.module.ts` 의 `providers` 배열에 `EvaluationPersistedRecordsReader`(T-0541)와 `EvaluationUnevaluatedFillPlanner`(T-0542)를 등록. 각 등록 위에 한국어 주석으로 책임 + DI resolve 근거(reader → `AssessmentService` via UserModule export, planner → 같은 module reader provider)를 1~2 줄 명시(기존 provider 주석 스타일 mirror).
- [ ] 두 service 를 `exports` 배열에도 추가 — 향후 orchestrator/controller 소비처가 다른 module 또는 같은 module DI 로 inject 받도록(기존 `exports` 의 "후속 ... slice 가 inject 받도록 export" 주석 스타일 mirror).
- [ ] 새 `import` 구문은 두 service class import 2 줄만 추가(상단 import 그룹 정합). **새 module import / 새 dependency / 새 token / `provide`+`useExisting`/`useClass` 바인딩 추가 0** — 둘 다 평범한 class provider.
- [ ] happy-path test 1+ — `assessment-evaluation.module.spec.ts` 에서 compile 된 testing module 로부터 `EvaluationPersistedRecordsReader` 와 `EvaluationUnevaluatedFillPlanner` 를 각각 `module.get(...)` 으로 꺼냈을 때 `defined` + 올바른 클래스 instance 인지 검증(2 assertion). 기존 `EvaluationScoringService` resolve 검증 패턴 mirror.
- [ ] error path / negative test 1+ — DI 그래프 정합 검증: (a) planner instance 의 주입된 reader 의존이 같은 module 의 reader provider 와 **동일 singleton**인지(또는 reader 가 resolve 가능하므로 planner compile 이 unresolved-dependency 로 실패하지 않는지) 검증. (b) 본 module 이 `UserModule` 을 import 하지 않으면 reader 의 `AssessmentService` 의존이 unresolved 가 되는 관계를 1 assertion 으로 박제(예: reader 가 정상 resolve 되어 `AssessmentService` 의존이 끊기지 않음을 확인 — 이미 import 중이므로 positive 검증으로 충분). 단일 negative 만 작성 금지 — 위 2 측면 각 1+.
- [ ] flow / branch coverage — 본 task 는 module metadata 등록(분기 로직 없음)이라 신규 분기 0. **"분기 없음 — 이 항목은 module compile + provider resolve 검증으로 대체"** 를 spec 주석 또는 task 진행 시 명시. 기존 spec 의 mock delegate 추가가 필요하면(reader 의 `AssessmentService` 전이 의존이 새 Prisma delegate 를 요구할 경우) 그 delegate stub 만 최소 추가.
- [ ] negative cases 충분 cover — (1) reader resolve `defined`, (2) planner resolve `defined`, (3) planner 의 주입 reader 가 같은 module singleton, (4) 두 service 가 `exports` 에 포함돼 외부 inject 가능(testing module 의 `exports` 또는 `module.get` 으로 간접 확인) — 각 1+ assertion. 기존 module spec 의 다른 provider 검증이 본 추가로 회귀하지 않는지(전체 spec green) 확인.
- [ ] `pnpm lint && pnpm build && pnpm test` 통과. `pnpm test:cov` 통과(line ≥ 80% / function ≥ 80% — module 파일은 metadata-only 라 함수 본문 0, 기존 coverage 유지). 전체 jest suite green(회귀 0).
- [ ] colocated spec 위치: 기존 `src/assessment-evaluation/assessment-evaluation.module.spec.ts` 에 assertion 추가(새 spec 파일 신설 0 — module spec 은 module 당 1 개 colocated). 새 mock helper 추출 불요(기존 PrismaService mock 패턴 재사용, reader 가 요구하는 delegate 가 새로 필요하면 그 delegate stub 만 추가).

## Out of Scope

- **orchestrator/controller 실배선** — `EvaluationUnevaluatedFillPlanner.planUnevaluatedFill` 을 실제 일괄 평가 실행으로 잇는 compose(예: `EvaluationOrchestratorService` 호출 또는 새 controller endpoint)는 본 task 밖. 후속 slice. 본 task 는 DI 등록 + resolve 검증만.
- **`intended` range/person 외부 source 결정** — 어떤 person·기간을 평가하려는지 정하는 source(스케줄러·요청 DTO) 배선은 본 task 밖.
- **service 동작 변경** — `EvaluationPersistedRecordsReader` / `EvaluationUnevaluatedFillPlanner` / 순수 조각의 로직·시그니처·정렬·분기 불변. 본 task 는 module metadata 등록만(class 본문 0 LOC 변경).
- **새 module import / 새 dependency / 새 token 바인딩** — `UserModule`(이미 import) 외 추가 import 0. multer / object-storage 등 §5 게이트 dependency 0.
- **새 query 표면 / 새 repository 메서드 / schema / migration / auth 변경** — 없음. 하나라도 필요해지면 즉시 멈추고 BLOCKED(planner 재호출).
- **standing 게이트** — live-LLM(ADR-0045), export download chain(Q-0042/Q-0043), import upload infra(게이트3), P6 frontend, timezone Q-0026, ADR-0036 stage5c 는 본 task 와 직교 — 건드리지 않는다.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(비어 있음 — sub-agent 가 관련 작업 발견 시 추가)
