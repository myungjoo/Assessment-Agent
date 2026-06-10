---
id: T-0334
title: vestigial PeriodBridgeDto.mode 제거 + ADR-0038 amend reconcile (slice 2a)
phase: P5
status: IN_PROGRESS
commitMode: pr
prNumber: 278
coversReq: [REQ-009, REQ-040, REQ-045]
estimatedDiff: 180
estimatedFiles: 4
created: 2026-06-11
independentStream: adr0038-overwrite-chain
dependsOn: [T-0333]
touchesFiles:
  - docs/decisions/ADR-0038-overwrite-reevaluate-persisted-assessment.md
  - src/assessment-evaluation/dto/period-bridge.dto.ts
  - src/assessment-evaluation/dto/period-bridge.dto.spec.ts
  - src/assessment-evaluation/assessment-evaluation.controller.spec.ts
plannerNote: "P5 ADR-0038 slice2 를 cap 으로 2a/2b split — 2a=ADR amend+vestigial mode 제거(4파일). live-LLM 은 6/25 전 미착수 시 격상."
---

# T-0334 — vestigial PeriodBridgeDto.mode 제거 + ADR-0038 amend reconcile (slice 2a)

## Why

[ADR-0038](../decisions/ADR-0038-overwrite-reevaluate-persisted-assessment.md) §Follow-ups slice 2 진입이다. [T-0333](T-0333-reevaluate-flag-dto.md) 이 발견·박제했듯 [PeriodBridgeDto](../../src/assessment-evaluation/dto/period-bridge.dto.ts) 에는 T-0315 가 speculatively 추가한 **vestigial `mode?: string`("fill"|"reeval" @IsIn) field 가 존재하나 period bridge 의 어느 분기도 소비하지 않는다**(Admin 분기는 항상 "fill", User ephemeral 은 persist 0 — [controller.spec.ts](../../src/assessment-evaluation/assessment-evaluation.controller.spec.ts) L978~990 "no-bake" 테스트가 ignore 를 명시 검증). ADR-0038 §Decision1 은 `reevaluate?: boolean` 을 채택하면서 이 pre-existing field 를 미언급했다 — 설계 gap 이다. slice 2 전체(orchestration 분기 + 본 reconcile)는 6 파일로 cap(≤5 파일) 초과라 **2a(본 task — architect ADR amend + mode 제거 + spec 동기) / 2b(orchestration reeval opt-out 분기, 파일-disjoint)** 로 split 한다. ADR-first(코드보다 ADR 먼저) — 계약을 먼저 단일화(`reevaluate?: boolean` 만)해야 slice 2b/3 이 dual-contract 혼동 없이 진행된다.

혼동 주의 (T-0333 박제 그대로): 별도 [EvaluateActivitiesDto](../../src/assessment-evaluation/dto/evaluate-activities.dto.ts) 의 `mode` 는 evaluate endpoint 에서 [controller.ts](../../src/assessment-evaluation/assessment-evaluation.controller.ts) L189 `persist(..., mode)` 로 **wired — 정상이며 본 task 대상이 아니다**. 본 task 는 period bridge DTO 의 vestigial `mode` 만 다룬다.

## Required Reading

- `docs/decisions/ADR-0038-overwrite-reevaluate-persisted-assessment.md` — §Decision1(reevaluate?: boolean 채택 contract) · §Alternatives B(enum mode 미채택 근거 — amendment 의 논거 source) · §Follow-ups slice 2 정의. amendment 박제 대상.
- `docs/tasks/T-0333-reevaluate-flag-dto.md` — §발견(vestigial mode 의 사실관계: T-0315 speculative, unwired, controller.spec no-bake) + §Follow-ups(slice 2 architect reconcile flag).
- `src/assessment-evaluation/dto/period-bridge.dto.ts` — 수정 대상. vestigial `mode` field(L75~84) + 관련 주석(L40·42·89·96). `reevaluate?: boolean`(T-0333) 은 무변경 보존.
- `src/assessment-evaluation/dto/period-bridge.dto.spec.ts` — colocated spec 동기 대상. mode happy/branch(L43~58) · negative(L123~139) · contract-keys 테스트(L222~229).
- `src/assessment-evaluation/assessment-evaluation.controller.spec.ts` — period bridge 의 mode 테스트 3 블록만 동기: L790~798(ephemeral mode-ignore) / L978~990(Admin no-bake) / L1068~1072(@IsIn 거부). **evaluate endpoint 의 EvaluateActivitiesDto.mode 테스트(L341~380)는 wired 정상 — 무변경 보존.**

## Acceptance Criteria

- [ ] **architect — ADR-0038 amendment 박제**: §Decision1 에 vestigial `PeriodBridgeDto.mode` reconcile amendment 추가 — (i) 사실관계(T-0315 speculative 추가, period bridge unwired — T-0333 발견 cross-ref), (ii) **제거 채택**(권장 — `reevaluate?: boolean` 이 §Decision1 의 진짜 계약, §Alternatives B 가 period 계약의 enum mode 를 이미 미채택; deprecate 유지 안은 dual-contract drift risk 라 미채택 근거 박제), (iii) 제거의 caller 가시 효과 명시 — `mode` 제공 payload 는 이후 whitelist+forbidNonWhitelisted ValidationPipe 의 **정의 외 필드 400 거부**(silent-ignore 보다 의도 명확 — §Decision4 fail-closed 정신과 동형). architect 가 deprecate 를 택할 경우 그 근거를 amendment 에 박제하고 이하 항목을 deprecate 형태로 등가 적용.
- [ ] `src/assessment-evaluation/dto/period-bridge.dto.ts` 에서 `mode?: string` field + 그 validator(@IsOptional/@IsIn 등) + 관련 주석(L40·42·89·96 의 mode 언급) 제거·동기 — DTO contract = `personId/period/scope/periodStart/reevaluate` **5 키**. `reevaluate?: boolean`(T-0333) 은 무변경.
- [ ] `period-bridge.dto.spec.ts` 동기 — mode happy/branch/negative 테스트 제거 + contract-keys 테스트를 5 키로 갱신. happy-path 회귀 보존: 정상 payload(4 좌표 + `reevaluate` true/false/미지정 각 분기) validate 통과 테스트 유지. (R-112 항목 1·3 — 잔여 계약의 happy + branch cover 보존)
- [ ] error path / negative cases 충분 cover: `mode: "fill"` · `mode: "reeval"` · `mode: <임의 string>` 제공 payload 각 1+ test 가 whitelist+forbidNonWhitelisted ValidationPipe 에서 **정의 외 필드로 거부**됨을 검증(제거 후 신규 negative — 구 @IsIn 거부 테스트의 대체) + 기존 필드(personId 등) negative 회귀 보존. 단일 negative 금지. (R-112 항목 2·4)
- [ ] `assessment-evaluation.controller.spec.ts` 동기 — period bridge mode 테스트 3 블록(L790~798 / L978~990 / L1068~1072)을 제거 또는 "mode = 정의 외 필드 거부" negative 로 재작성. **evaluate endpoint(EvaluateActivitiesDto.mode, wired) 테스트는 무변경 보존.**
- [ ] `pnpm lint && pnpm build && pnpm test` 통과 + `pnpm test:cov` 통과(line ≥ 80% / function ≥ 80%). (R-112 항목 5)

## Out of Scope

- **orchestration reeval opt-out 분기**(`persistAndReadThrough` 의 fill/reeval mode 선택 + reeval 경로의 read-through fall-back 미적용) — **slice 2b**(다음 task, [period-bridge-admin-persist.service.ts](../../src/assessment-evaluation/period-bridge-admin-persist.service.ts) + spec, 본 task 와 파일-disjoint).
- controller wiring(`reevaluate` dispatch) + User + reevaluate fail-closed reject(§Decision4 (ii)) — slice 3.
- e2e(replace / first-write-wins 보존 / 동시 reevaluate 수렴 / User 영속 변경 0) — slice 4.
- `EvaluateActivitiesDto.mode`(evaluate endpoint, wired 정상) — 무변경.
- `period-bridge-admin-persist.service.ts` / `period-bridge-ephemeral.service.ts` / `assessment-evaluation.controller.ts` 본체 — 무변경(mode 미소비라 제거 영향 0; controller.ts 의 mode 언급 주석 L243~245·L301 은 slice 2b/3 이 해당 코드 수정 시 동기).
- 새 외부 dependency / DB schema 변경 / live LLM credential — 전부 0(§Decision6).

## Suggested Sub-agents

`architect → implementer → tester` (architect 필수 — T-0333 §Follow-ups 가 vestigial mode reconcile 의 remove vs deprecate 결정을 slice 2 architect 의 ADR-0038 amend 로 지정).

## Follow-ups

- (planner) **slice 2b — orchestration reeval opt-out 분기** 큐잉: 본 task 머지 후 [PeriodBridgeAdminPersistService](../../src/assessment-evaluation/period-bridge-admin-persist.service.ts) 의 `persistAndReadThrough` 에 default `"fill"` / `reevaluate === true` 시 `"reeval"` 분기 + mocked unit(R-112: flag 분기 / 좌표 부재 create degrade / 좌표 존재 reset-and-recreate / reeval 경로 P2002 semantics). 파일-disjoint(service + spec 2 파일).
- (planner) live-LLM bridge 검증(PLAN P5, 만료 2026-06-30) — 2026-06-25 전 미착수 시 우선순위 격상(backlogNote 트리거 유지).
