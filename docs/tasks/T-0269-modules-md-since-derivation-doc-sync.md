---
id: T-0269
title: modules.md AssessmentCollectionModule row 를 SinceDerivationService 배선(slice vi)으로 doc-sync
phase: P4
status: PENDING
commitMode: direct
coversReq: [REQ-031, REQ-005, REQ-006, REQ-007, REQ-008, REQ-015]
estimatedDiff: 12
estimatedFiles: 1
created: 2026-06-06
plannerNote: P4 collection — T-0268 Follow-up; modules.md row40 의 "8 service / since pass-through" stale → SinceDerivationService(9th) 배선 + deriveSince 도출 merged reality 정합(direct doc-only)
---

# T-0269 — modules.md AssessmentCollectionModule row 를 SinceDerivationService 배선(slice vi)으로 doc-sync

## Why

T-0267(PR-229, squash 1a5a890)이 `SinceDerivationService.deriveSince(personId)`(직전 Assessment 최신 `periodStart` → ISO since, 빈 배열 → `undefined` = full collection)를 신설하고, T-0268(PR-230, squash 5e79ec9)이 그 service 를 `AssessmentCollectionModule` 의 providers/exports 에 배선해 ADR-0030 §5 slice vi(incremental since 도출)가 코드/DI 상 완성됐다. 그러나 `docs/architecture/modules.md` 의 AssessmentCollectionModule row(line 40)는 아직 T-0266 시점("구성(8 service)" + "incremental since 도출(slice vi — since 는 현재 주입받아 pass-through)·호출처(scheduler/manual trigger) 결선...은 후속 deferred")에 머물러 있어 merged reality 와 어긋난다(stale). main 의 module 은 이제 providers 9개(8 + `SinceDerivationService`) + exports 6개(5 + `SinceDerivationService`)이고, since 는 더 이상 "주입받아 pass-through" 가 아니라 `SinceDerivationService.deriveSince` 가 직전 Assessment 에서 도출하는 service 가 배선된 상태다.

본 task 는 그 row 1줄을 머지된 9-service 배선 + slice vi(since 도출) 완료로 정합하는 micro-slice 다 — T-0268 §Follow-ups #1 에 명시된 별도 direct doc-sync 항목이며, T-0266(enumerate chain doc-sync) 의 정확한 mirror 다. issue-still-relevant pre-check 통과: main 의 `assessment-collection.module.ts` 는 `SinceDerivationService` 를 이미 배선했으나(L65 import + providers/exports L99~ + 주석 L45~50 "slice vi 배선 완료(T-0268)") modules.md row 는 미반영 — genuine doc-drift(redundant 아님). 순수 문서 정합이라 새 dependency 0 / 새 schema 0 / 새 credential 0 — CLAUDE.md §5 게이트 미발화.

## Required Reading

- `docs/architecture/modules.md` — 특히 line 40 의 AssessmentCollectionModule row(현재 "구성(8 service)" + "since 는 현재 주입받아 pass-through" 표기) + line 3 머리말의 정합 이력 끝부분(T-0255 → T-0266 chain — 여기에 T-0269 한 줄 append) + line 60/105~108/143/167/189/196 의 collection 관련 mermaid 노드/의존성/component-mapping 행(이 행들은 module-level 위상만 다루므로 service 추가에 영향 없음 — 갱신 불요 확인용).
- `src/assessment-collection/assessment-collection.module.ts` (origin/main) — 현재 providers 9개(GithubCollectionService / ConfluenceCollectionService / CollectionOrchestratorService / CollectionPersistenceService / GithubOrgEnumerateService / GithubCollectionSpecService / CollectionSpecService / CollectionEntryService / **SinceDerivationService**) + exports 6개(앞 4 + CollectionEntryService + **SinceDerivationService**). 주석 L45~50 의 "slice vi 배선 완료(T-0268)" + `SinceDerivationService` 의 `AssessmentService` 의존이 기존 UserModule import 로 닫힘(새 import 0).
- `docs/tasks/T-0266-modules-md-collection-enumerate-chain-doc-sync.md` — 직전 modules.md doc-sync 패턴(direct doc-only, line 40 row + line 3 머리말만 변경, tester 면제). 본 task 가 mirror 할 구조.
- `docs/decisions/ADR-0030-assessment-collection-enumerate.md` (origin/main) §5 Implementation slices — slice vi(incremental since 도출) 책임 경계 + `collectForPerson(person, since?, assessmentId)` 진입 계약에서 since 가 도출 대상임을 확인.

## Acceptance Criteria

(본 task 는 direct doc-only — R-112 4종 test 무관. doc 정합 검증만.)

- [ ] `docs/architecture/modules.md` line 40 의 AssessmentCollectionModule row "구성" 문장이 merged 9-service 배선을 반영한다 — 기존 8 service enumerate 에 더해 `SinceDerivationService`(직전 Assessment 최신 `periodStart` → ISO since 도출, 빈 배열 → `undefined`)와 그 출처 task(T-0267 신설 / T-0268 배선, ADR-0029 §5 / ADR-0030 slice vi)를 명시. provider/export 배선 출처 표기도 T-0265 → "T-0265/T-0268" 로 정합(또는 since service 만 별도 1줄 추가).
- [ ] 같은 row 의 stale 문구 "incremental since 도출(slice vi — since 는 현재 주입받아 pass-through)" 를 "incremental since 도출(slice vi) 완료(T-0267/T-0268) — `SinceDerivationService.deriveSince(personId)` 가 직전 Assessment 에서 since 산출(빈 배열 → full collection)" 식으로 정정 — slice vi 가 done 임을 반영. 단 "호출처(scheduler/manual trigger) 결선·live/credentialed 수집(Q-0025)은 후속 deferred" 는 여전히 후속이므로 유지.
- [ ] line 3 머리말의 정합 이력에 본 task(T-0269, slice vi since 도출 배선 reconcile) 한 줄 append — T-0266 가 enumerate chain wiring 을 정합한 뒤 본 task 가 slice vi(SinceDerivationService 배선) 를 정합했다는 추적. 링크 형식은 기존 `[T-0266](../tasks/T-0266-...)` mirror.
- [ ] mermaid 노드(line 60) / 의존성 행(line 105~108/143/167) / component↔module N:N mapping(line 189/196 "8 component → 10 module") 변경 불요 확인 — slice vi 는 기존 AssessmentCollectionModule 내부 service 추가일 뿐 새 module/component 0, module-level 위상 불변. 이 행들은 건드리지 않는다.
- [ ] 변경 후 markdown 표 구조가 깨지지 않음(파이프 컬럼 정합) — 육안 또는 렌더 확인.

## Out of Scope

- `src/` 코드 변경 일절 금지 — 본 task 는 순수 문서 정합(direct doc-only). module.ts / since-derivation.service.ts 는 이미 머지됨(T-0267 1a5a890 / T-0268 5e79ec9).
- 새 ADR 작성 / ADR 본문 수정 금지 — ADR-0029 §5 / ADR-0030 이미 ACCEPTED, slice vi 는 그 안에 박제됨. 신설 불요.
- modules.md 의 다른 module row(AssessmentModule / UserModule 등) 변경 금지 — AssessmentCollectionModule row(line 40) + line 3 머리말만.
- mermaid 노드 / 의존성 acyclic 표(line 167) / component↔module mapping 표(line 189/196) 변경 금지 — slice vi 는 module 내부 service 추가라 module-level 위상 불변.
- **호출처 결선(P5/P7 경계, ADR-worthy)** 관련 신규 task 생성 금지 — scheduler/manual trigger 가 `deriveSince` → `collectForPerson` 으로 since 를 잇는 진입점 + Assessment row 생성 주체 결정은 별개 phase 경계 + ADR 선행 필요. 본 task 는 doc-sync 1건만. 후속은 Follow-ups 에 기록.
- **1 주 재수집 window / timezone 보정(P5/P7, REQ-058)** 신규 task 생성 금지 — 후속.
- `docs/PLAN.md` / `docs/STATE.json` / journal 변경 금지(STATE/journal 은 driver bookkeeping 책임).

## Suggested Sub-agents

`implementer`만 (direct doc-only — tester 불요: R-110 은 direct-mode doc-only commit 을 면제). driver 가 직접 Edit 해도 무방.

## Follow-ups

(작성 시 비어 있음 — sub-agent 가 관련 작업 발견 시 추가)

- 호출처 결선(P5/P7 경계, ADR-worthy): scheduler/manual trigger 가 `deriveSince(personId)` → `collectForPerson(person, since, assessmentId)` 으로 since 를 잇는 진입점 + `assessmentId`(Assessment row) 생성 주체 결정. ADR 선행 + phase 경계 결정 필요 — dependency-free 아님(escalate 후보).
- 1 주 재수집 window / timezone 보정(P5/P7, REQ-058): incremental window 정책 — 직전 `periodStart` 에서 1 주를 빼는 등 재수집 보호 보정.
