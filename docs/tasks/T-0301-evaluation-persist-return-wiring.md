---
id: T-0301
title: 평가 evaluate flow 에 persist hook 배선 + assessmentId 반환 (ADR-0033 slice 4)
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-029, REQ-037, REQ-041]
estimatedDiff: 255
estimatedFiles: 5
created: 2026-06-09
plannerNote: "P5 ADR-0033 §Follow-ups slice 4 — orchestrator/controller persist-return; pre-check 확인 persist 미배선; R-112 backbone ×1.5"
---

# T-0301 — 평가 evaluate flow 에 persist hook 배선 + assessmentId 반환 (ADR-0033 slice 4)

## Why

ADR-0033 §Follow-ups 의 dependency-free chain 4번째 slice 다. slice 1(schema+migration, T-0298) → slice 2(순수 매퍼, T-0299) → slice 3(write service `EvaluationResultPersistService`, T-0300) 이 전부 main 에 머지됐다. 그러나 `POST /api/assessment-evaluation/evaluate` flow 는 여전히 in-memory `EvaluationResult[]` 만 반환하고 DB write 0 이다 — orchestrator(L38–39 주석)와 controller(L28–29 주석) 둘 다 "§5 schema 게이트 deferred" 를 박제해 둔 상태. 본 slice 가 머지된 persist service 를 evaluate flow 에 배선해 평가 결과를 영속화하고 박제된 `assessmentId` 를 반환함으로써 **REQ-029(non-volatile 저장) 를 평가 layer 에서 마침내 충족**한다(ADR-0033 §Consequences 첫 항목). 영속화 진입은 context 4-tuple(`personId`/`period`/`scope`/`periodStart`)을 필요로 하므로(ADR-0033 §51) controller DTO 에 이 4 종 + persist 모드(`fill`/`reeval`, ADR-0033 §3 REQ-037/REQ-041)를 추가한다.

배선 지점은 **controller** 다(ADR-0033 §Cross-Module Impact "persist hook 위치"의 두 후보 중 선택). 근거: context 4-tuple 은 HTTP request body 에서 들어오고 controller 가 이를 소유한다. orchestrator 의 `evaluateActivities(activities, options): Promise<EvaluationResult[]>` 기존 계약(ADR-0032)을 보존(in-memory 순수 compose)하고, controller 가 orchestrator 호출 후 그 결과를 persist service 에 넘기는 thin wiring 으로 둔다 — orchestrator 를 건드리지 않아 ADR-0032 의 평가 layer 순수성과 분리가 유지된다.

## Required Reading

- `docs/decisions/ADR-0033-evaluation-result-persistence.md` — §Decision 1(매핑 방향)/§3(fill·reeval·partial-reset semantics)/§51(context 4-tuple 필수)/§Cross-Module Impact(persist hook 위치)/§Follow-ups slice 4 정의
- `src/assessment-evaluation/assessment-evaluation.controller.ts` — 배선 대상 controller (현재 in-memory 반환만, persist 호출 추가 지점)
- `src/assessment-evaluation/dto/evaluate-activities.dto.ts` — context 4-tuple + mode 필드 추가 대상 DTO
- `src/assessment-evaluation/evaluation-result-persist.service.ts` — 호출할 `persist(context, results, mode)` 시그니처 + `PersistResult { assessmentId; contributionCount }` + `PersistMode = "fill" | "reeval"`
- `src/assessment-evaluation/domain/evaluation-result.persist.mapper.ts` — `EvaluationPersistContext { personId; period; scope; periodStart: Date }` 타입 + `MappedAssessment.contributions[].contributionScore: number`(NIT 의 cast 안전성 근거)
- `src/assessment-evaluation/evaluation-orchestrator.service.ts` — `evaluateActivities` 기존 계약(변경 금지 — 보존 대상)
- `src/user/assessment.service.ts` L40–42 — `VALID_PERIODS`(day/week/month) / `VALID_SCOPES`(commit/document/aggregate) literal single source(controller/service 검증 정합 참고)
- `src/assessment-evaluation/assessment-evaluation.controller.spec.ts` — 확장 대상 colocated controller spec(orchestrator mock 패턴)
- `src/assessment-evaluation/dto/evaluate-activities.dto.spec.ts` — 확장 대상 colocated DTO spec(존재 시; 부재 시 신설)

## Acceptance Criteria

- [ ] `EvaluateActivitiesDto` 에 context 4-tuple 필드 추가: `personId`(`@IsString @IsNotEmpty`), `period`(string), `scope`(string), `periodStart`(ISO-8601 string — controller 가 `Date` 로 파싱). 허용 literal 값 검증(`@IsIn`)은 기존 DTO 관행대로 service-layer 책임(미적용)이되, 형식 검증 decorator 는 박제. `mode` 필드(`"fill" | "reeval"`, `@IsOptional` 기본 `"fill"`) 추가 — ADR-0033 §3 fill/reeval 모드 구분.
- [ ] `AssessmentEvaluationController.evaluate` 가 orchestrator 호출 후 `EvaluationResultPersistService.persist(context, results, mode)` 를 호출하도록 배선. `context` 는 DTO 의 4-tuple 에서 조립(`periodStart` 는 `new Date(dto.periodStart)`). 반환 shape 은 `{ assessmentId, contributionCount, results }`(영속 식별자 + in-memory 결과 동시 반환 — ADR-0033 §Follow-ups slice 4 "persists the result and returns the assessmentId / persisted identifiers").
- [ ] `EvaluationResultPersistService` 를 controller 생성자에 추가 주입(같은 module 의 기존 provider, module 배선 변경 0 — 이미 등록·export 됨).
- [ ] **Happy-path unit test**: controller 가 (a) orchestrator 의 결과로 persist 를 호출하고 (b) `{ assessmentId, contributionCount, results }` 를 반환하는 정상 경로 1+ (persist mock + orchestrator mock).
- [ ] **Error path unit test**: persist 가 reject(예: `ConflictException`) 시 controller 가 raw 전파(swallow 0)하는 test 1+. orchestrator 가 reject 시(scoreUnit 전파) persist 미호출 + error 전파 test 1+.
- [ ] **Flow / branch coverage**: `mode` 가 `"fill"` 일 때와 `"reeval"` 일 때 각각 persist 에 올바른 mode 가 전달되는 분기 test 각 1+. `mode` 미지정 시 기본값 `"fill"` 적용 test 1+.
- [ ] **Negative cases 충분 cover**: DTO 검증 — `personId`/`period`/`scope`/`periodStart` 누락 각각 400(ValidationPipe), wrong type 각 1+, `mode` 가 허용 외 값일 때 처리(@IsIn 적용 시 400 / 미적용 시 service 책임 — 택1 명시) — 예외 분기마다 test.
- [ ] **NIT fold-in (T-0300 reviewer)**: persist service 의 `contributionScore as number` cast 는 매퍼가 항상 `number` 를 emit 하기에 안전하다. 매퍼 return-type fixity 를 lock 하는 **type-level 단언 test 1+** 추가 — `MappedAssessment["contributions"][number]["contributionScore"]` 가 `number` 임을 compile-time(`expectTypeOf`/`satisfies`/명시 타입 할당) 또는 runtime(`typeof … === "number"`) 으로 박제해, 매퍼 반환 타입이 향후 `Decimal`/`string` 으로 바뀌면 그 test 가 깨지도록 한다(silent NaN 방지). `evaluation-result.persist.mapper.spec.ts`(colocated) 또는 controller/service spec 에 배치.
- [ ] `pnpm lint && pnpm build` 통과.
- [ ] `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%).

## Out of Scope

- **orchestrator 변경 금지** — `evaluateActivities(activities, options): Promise<EvaluationResult[]>` 기존 계약(ADR-0032)을 보존. persist 배선은 controller 에서만.
- **`AssessmentRepository` / write service 로직 변경 금지** — T-0300 의 `persist`/`resetByPeriod` 시그니처를 그대로 호출만. reset-and-recreate/P2002 정책 재구현 0.
- **매퍼 변경 금지** — NIT fold-in 은 매퍼의 return-type 을 lock 하는 **test 추가**일 뿐, 매핑 로직/반환 타입 변경 0(순수 함수 보존).
- **`resetByPeriod`(partial-reset) endpoint 신설 금지** — ADR-0033 §3 partial-reset 의 HTTP 노출(REQ-041 Admin manual delete endpoint)은 별도 후속 slice. 본 slice 는 evaluate flow 의 persist hook 만.
- **Summary write 금지** — ADR-0033 §Follow-ups (deferred) Summary slice 범위.
- **data-model.md / api.md doc-sync 금지** — slice 5(doc-sync, `commitMode: direct`)에서. 본 task 는 코드만.
- **e2e HTTP 통합 spec(supertest 실 부팅 + 실 DB persist round-trip) 신설은 선택** — colocated controller unit(persist+orchestrator mock)까지가 본 task 필수. 실 DB e2e 가 cap 을 넘기면 Follow-up 으로.
- **module 배선 변경 금지** — persist service 는 이미 `assessment-evaluation.module.ts` 의 provider/export 에 등록됨. controller 가 같은 module 내 DI 로 주입받으므로 추가 등록 0.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(작성 시 비어있음 — sub-agent 가 관련 작업 발견 시 append)
