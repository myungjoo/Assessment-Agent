---
id: T-0302
title: 평가 결과 영속화 reality 를 architecture 문서에 doc-sync (ADR-0033 slice 5)
phase: P5
status: PENDING
commitMode: direct
coversReq: [REQ-029, REQ-032, REQ-037]
estimatedDiff: 70
estimatedFiles: 3
created: 2026-06-09
plannerNote: P5 ADR-0033 §Follow-ups slice 5(doc-sync) — 머지된 영속화(T-0298~T-0301) reality 를 data-model/modules/api 에 반영. direct doc-only, dep0.
---

# T-0302 — 평가 결과 영속화 reality 를 architecture 문서에 doc-sync (ADR-0033 slice 5)

## Why

[ADR-0033](../decisions/ADR-0033-evaluation-result-persistence.md) §Follow-ups 의 마지막 dependency-free slice (5 — doc-sync, `commitMode: direct` 로 명시) 다. ADR-0033 의 영속화 chain — schema [T-0298] → 매퍼 [T-0299] → write service [T-0300] → controller persist-return wiring [T-0301] — 가 전부 main 에 머지되어 REQ-029 (non-volatile 저장) 가 평가 layer 에서 충족됐다. 그러나 기존 architecture 문서 3종은 아직 "영속화 deferred / 미저장" 의 stale 한 서술을 담고 있어 (issue-still-relevant pre-check 로 stale 확인 — 아래) merged code 와 drift 가 발생했다. 본 task 는 그 drift 를 닫아 문서를 shipped reality 와 정합시킨다.

## Required Reading

- `docs/decisions/ADR-0033-evaluation-result-persistence.md` — §1 매핑 방향 / §3 reset-and-recreate(fill/reeval) / §4 `@@unique([assessmentId, sourceRef])` / §Follow-ups slice 5 의 doc-sync 명세 (data-model.md §3 관계 5 / §5 갱신 지시).
- `docs/architecture/data-model.md` — §2 Assessment/Contribution row(L28~29), §3 관계 5 (Assessment↔Contribution, L63), §4 raw 미저장 invariant, §5 cross-cutting 필드 (Assessment/Contribution immutable 서술, L96), §6 추가 cover (REQ-031 "구체는 P3" L135), §7 Out of Scope (unique constraint "P3" L145) — 갱신 대상.
- `docs/architecture/modules.md` — L41 AssessmentEvaluationModule row 의 "결과 영속화 / Prisma migration ... 본 module 밖 (§5 schema 게이트 deferred)" stale 문구 — 영속화 shipped 로 정정 대상.
- `docs/architecture/api.md` — L101 `POST /api/assessment-evaluation/evaluate` row 의 response 서술 ("response 200 `EvaluationResult[]`") + request body `EvaluateActivitiesDto` 서술 — persist-return reality 로 갱신 대상.
- (참고, read-only — 코드 수정 금지) merged 코드의 실제 shape:
  - `src/assessment-evaluation/assessment-evaluation.controller.ts` — `EvaluateResponse { assessmentId: string; contributionCount: number; results: EvaluationResult[] }`.
  - `src/assessment-evaluation/dto/evaluate-activities.dto.ts` — context 4-tuple (`personId`/`period`/`scope`/`periodStart` 모두 `@IsString @IsNotEmpty`, `periodStart` 는 추가로 `@IsISO8601`) + `mode?` (`@IsOptional @IsIn(["fill","reeval"])`).

## Acceptance Criteria

본 task 는 doc-only `direct` commit 이므로 R-112 test 요구 (happy/error/branch/negative/coverage) 는 **적용하지 않는다** (production code 변경 0).

- [ ] `docs/architecture/data-model.md` §3 (Entity 간 관계) 의 관계 5 (Assessment↔Contribution) 또는 §4/§5 인접 위치에 영속화 reality 를 박제: (a) `Contribution` 에 `@@unique([assessmentId, sourceRef])` 가 schema-level idempotency key 로 박제됨 (T-0298), (b) 재평가는 Assessment 단위 reset-and-recreate(`$transaction` delete-if-exists → create) 이며 fill/reeval 두 모드가 있음 (ADR-0033 §3), (c) idempotency key = `(personId, period, scope, periodStart)` (기존 `Assessment.@@unique` 재사용). ADR-0033 으로 링크.
- [ ] `docs/architecture/data-model.md` §6 추가 cover 의 REQ-031 항목 ("Contribution / Assessment 의 unique constraint (구체는 P3)" L135) 과 §7 Out of Scope 의 unique-constraint "P3" 항목 (L145) 을 정정 — `(assessmentId, sourceRef)` unique 가 ADR-0033/T-0298 로 shipped 됨을 반영 (Out of Scope 에서 "shipped — ADR-0033 참조" 로 이동하거나 해당 줄을 정정). raw 미저장 invariant (§4) 는 영속화 path 가 새 위반 표면을 만들지 않음을 1줄로 재확인 (ADR-0033 §2).
- [ ] `docs/architecture/modules.md` L41 AssessmentEvaluationModule row 의 "결과 영속화 / Prisma migration / period·personId→수집 bridge 는 본 module 밖 (§5 schema 게이트 deferred)" 문구를 정정 — 결과 영속화는 shipped (ADR-0033, T-0298~T-0301: schema unique + 매퍼 + write service + controller persist hook), period·personId→수집 bridge 만 여전히 deferred. controller 가 in-memory orchestrate 후 `EvaluationResultPersistService.persist` 로 영속화하고 `{assessmentId, contributionCount, results}` 반환함을 1~2줄로 박제.
- [ ] `docs/architecture/api.md` L101 `POST /api/assessment-evaluation/evaluate` row 갱신: (a) response 를 `200 EvaluationResult[]` → `200 EvaluateResponse { assessmentId, contributionCount, results: EvaluationResult[] }` 로 정정, (b) request body `EvaluateActivitiesDto` 에 context 4-tuple (`personId`/`period`/`scope`/`periodStart`(ISO-8601, `@IsISO8601`)) + `mode?`(`@IsIn(["fill","reeval"])`, 미지정 시 fill) 추가됨을 반영, (c) 처리 흐름에 "orchestrate 후 persist hook (ADR-0033)" 1줄 추가, (d) T-0298~T-0301 / ADR-0033 박제 링크 추가.
- [ ] 변경 후 `docs/architecture/*.md` 의 내부 링크 (ADR-0033 등) 가 실제 파일 경로와 맞는지 육안 확인 — 깨진 상대경로 0.
- [ ] §12 언어 정책 준수 — 본문 한국어, 식별자/경로/enum (`fill`/`reeval`/`@@unique`/`assessmentId` 등) 영어 유지.

## Out of Scope

- **production code 변경 금지** — `src/`, `test/`, `prisma/`, `package.json` 어떤 파일도 건드리지 않는다 (그러면 commitMode 가 pr 로 바뀐다).
- **ADR-0033 PROPOSED→ACCEPTED status flip 금지** — 본 task 는 `docs/architecture/*` 만 건드린다. `docs/decisions/ADR-0033-*.md` 의 status 한 줄 수정은 별도 처리 (planner recommendation: 별도 작은 pr task — docs/decisions/* CI 게이트로 reviewer PR 필요). 본 task 에서 ADR 파일 자체를 수정하지 않는다.
- **deferred Summary 영속화 slice (ADR-0033 §Follow-ups 마지막 항목) 문서화 금지** — 별도 milestone.
- **새 entity / 새 관계 발굴 금지** — 본 task 는 shipped 영속화 reality 반영만, 새 설계 결정 0.
- **period·personId→수집 bridge 문서화 확장 금지** — 여전히 deferred 임만 명시, 새 설계 박제 안 함.

## Suggested Sub-agents

`implementer` (doc-only 편집 — architect 불요, 새 결정 0).

## Follow-ups

(생성 시 비어 있음 — sub-agent 가 관련 작업 발견 시 여기에 append)
