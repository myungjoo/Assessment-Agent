---
id: T-0333
title: period bridge DTO 에 reevaluate flag 추가 (ADR-0038 slice 1)
phase: P5
status: DONE
completedAt: 2026-06-11T00:21:11+09:00
mergedAs: f1e47e5
reviewRounds: 1
commitMode: pr
prNumber: 276
coversReq: [REQ-009, REQ-040, REQ-045]
estimatedDiff: 80
estimatedFiles: 2
created: 2026-06-10
plannerNote: "P5 ADR-0038 overwrite/재평가 impl chain 첫 slice — request contract DTO field. ADR-0038 §Decision1(reevaluate?: boolean, default false) FIRM 만 cover, §Decision2~5(orchestration/RBAC/idempotency)는 slice 2~4. **발견 박제**: PeriodBridgeDto 에 T-0315 가 speculatively 추가한 vestigial mode?: 'fill'|'reeval' 가 이미 존재(period bridge 분기는 ignore — controller.spec L980~990 'no-bake' 테스트). ADR-0038 §Decision1 이 이를 미언급 = gap → 본 slice 는 reevaluate?: boolean 만 추가(faithful), vestigial mode 정리는 slice 2 architect 가 ADR-0038 amend 로 reconcile(Follow-up flag). R-112 backbone ×1.5."
---

# T-0333 — period bridge DTO 에 reevaluate flag 추가 (ADR-0038 slice 1)

## Why

[ADR-0038](../decisions/ADR-0038-overwrite-reevaluate-persisted-assessment.md) §Follow-ups 의 dependency chain 첫 slice 다. Q-0034(옵션 1, 사용자 /loop 현장 승인 = Q-0033 의 ADR PR 검토 완료)로 ADR-0038 이 ACCEPTED 됐다. 본 slice 는 overwrite/재평가의 **request 계약** 만 추가한다 — Admin 이 "이미 영속화된 평가문을 새 평가로 교체하라" 를 명시하는 입력 flag `reevaluate?: boolean`(default `false`). §Decision1 의 FIRM 결정(boolean flag, default 가 first-write-wins 보존)만 cover 하며, **persist 분기(reeval opt-out)·RBAC·idempotency 는 본 DTO 밖**(slice 2~4) — 본 DTO 는 입력 형식만 박제한다.

### 발견 — vestigial `PeriodBridgeDto.mode` (slice 2 reconcile 대상, 본 slice 는 건드리지 않음)

조사 결과 [PeriodBridgeDto](../../src/assessment-evaluation/dto/period-bridge.dto.ts) 에 T-0315 가 "필요 시" 로 speculatively 추가한 **`mode?: "fill" | "reeval"`(@IsOptional @IsIn) field 가 이미 존재** 하나, period bridge 의 어느 분기도 이를 소비하지 않는다(Admin 분기는 항상 `"fill"`, User ephemeral 은 persist 0 — [controller.spec.ts](../../src/assessment-evaluation/assessment-evaluation.controller.spec.ts) L980~990 가 "context 에 mode 를 baking 하지 않는다, always fill" 을 명시 테스트). 즉 period bridge 의 `mode` 는 **vestigial(unwired)** 이다. (혼동 주의: 별도 `EvaluateActivitiesDto.mode` 는 evaluate endpoint 에서 [controller.ts](../../src/assessment-evaluation/assessment-evaluation.controller.ts) L189 `persist(..., mode)` 로 wired — 그쪽은 정상.)

ADR-0038 §Decision1 은 `reevaluate?: boolean` 을 채택하면서 이 **pre-existing vestigial `mode` 를 언급하지 않았다** — 설계 gap 이다. 본 slice 는 ADR-0038 §Follow-ups slice 1 정의("DTO 에 `reevaluate?: boolean` 추가")에 **faithful** 하게 boolean field 만 추가하고, vestigial `mode` 의 정리(period bridge 에서 제거 vs deprecate)는 **slice 2 architect 가 ADR-0038 amendment 로 reconcile** 하도록 §Follow-ups 에 flag 한다(slice 1 에서 `mode` 제거 = controller.spec 의 mode 테스트까지 건드려 cap 초과 + 계약 변경이라 architect 점검 대상 — slice 1 범위 밖).

## Required Reading

- `docs/decisions/ADR-0038-overwrite-reevaluate-persisted-assessment.md` — §Decision1(request contract: `reevaluate?: boolean` default false, validation, semantics) · §Decision3(default first-write-wins 보존) · §Follow-ups slice 1 정의. (§Decision2/4/5 는 본 slice 가 구현하지 않음 — 읽되 baking 금지.)
- `src/assessment-evaluation/dto/period-bridge.dto.ts` — 수정 대상. 기존 personId/period/scope/periodStart + vestigial `mode` field. `reevaluate?: boolean` 을 추가한다.
- `src/assessment-evaluation/dto/period-bridge.dto.spec.ts` — colocated spec 확장 대상(기존 R-112 패턴).
- `src/assessment-evaluation/dto/evaluate-activities.dto.ts` — `@IsOptional` 형식 검증 패턴 mirror(단 boolean 은 `@IsBoolean`).

## Acceptance Criteria

- [ ] `src/assessment-evaluation/dto/period-bridge.dto.ts` 에 **`reevaluate?: boolean`** field 추가 — `@IsOptional()` + `@IsBoolean()`. JSON body 의 `reevaluate: true/false` 만 통과, 미지정 시 `undefined`(orchestration 이 default `false`=first-write-wins 로 처리 — slice 2 책임). 주석에 "default false = first-write-wins 보존, reeval opt-out 의 request 계약, persist 분기는 slice 2" 박제(§Decision1/§Decision3).
- [ ] DTO 는 **형식 검증만** — reeval 영속화 분기 · Admin RBAC · User reevaluate fail-closed reject · idempotency 는 본 DTO 밖(주석으로 책임 경계 명시: orchestration slice 2 / controller+RBAC slice 3 / e2e slice 4).
- [ ] vestigial `mode` field 는 **본 slice 에서 건드리지 않는다**(제거/수정 0) — slice 2 architect reconcile 대상. DTO 주석에 "vestigial mode(period bridge unwired) reconcile = slice 2 (ADR-0038 amend)" 1 줄 cross-ref.
- [ ] colocated spec `period-bridge.dto.spec.ts` 확장 — happy-path: `reevaluate: true` / `reevaluate: false` / `reevaluate` 미지정 각각 `validate()` 0 error 통과. (R-112 항목 1·3 — branch cover)
- [ ] error path test: `reevaluate` 가 비-boolean(예: string `"yes"`, number `1`) → `@IsBoolean` validation error. (R-112 항목 2)
- [ ] negative cases 충분 cover: `reevaluate: "true"`(string) · `reevaluate: 1`(number) · `reevaluate: null` 각 1+ test(제공 시 형식 강제) + 기존 필드(personId 등) negative 회귀 보존. 단일 negative 금지 — 예외 분기마다 cover. (R-112 항목 4)
- [ ] `pnpm lint && pnpm build && pnpm test` 통과 + `pnpm test:cov` 통과(line ≥ 80% / function ≥ 80%). (R-112 항목 5)

## Out of Scope

- orchestration reeval opt-out 분기(`reevaluate === true` → `mode: "reeval"` reset-and-recreate, default first-write-wins) — slice 2.
- controller wiring(`reevaluate` field dispatch) + User + reevaluate fail-closed reject(§Decision4 (ii)) — slice 3.
- e2e(reevaluate 가 기존 평가문 replace / default 는 first-write-wins / 동시 reevaluate 수렴 / User reevaluate 영속 변경 0) — slice 4.
- **vestigial `PeriodBridgeDto.mode` 정리** — slice 2 architect 가 ADR-0038 amendment 로 reconcile(제거 vs deprecate + controller.spec mode 테스트 동기). 본 slice 는 `mode` 무변경.
- 새 외부 dependency / DB schema 변경 / live LLM credential — 전부 본 slice 밖(§Decision6).

## Suggested Sub-agents

`implementer → tester` (architect 불요 — ADR-0038 §Decision1 이 입력 계약 FIRM, 새 design 결정 0. vestigial mode reconcile 의 architect 는 slice 2).

## Follow-ups

- **(slice 2 architect)** vestigial `PeriodBridgeDto.mode`(period bridge unwired, controller.spec L980~990 가 ignore 를 테스트) reconcile — ADR-0038 §Decision1 이 미언급한 gap. period bridge 에서 `mode` 제거(권장 — `reevaluate?: boolean` 이 진짜 계약, §AlternativesB 가 period 계약의 mode enum 미채택) vs deprecate 결정 + ADR-0038 amendment + controller.spec mode 테스트 동기. slice 2 에서 함께 처리.
