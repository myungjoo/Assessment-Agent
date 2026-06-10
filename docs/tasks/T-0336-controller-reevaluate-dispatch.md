---
id: T-0336
title: controller period 분기 reevaluate dispatch + User fail-closed reject (ADR-0038 slice 3)
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-009, REQ-040, REQ-045]
estimatedDiff: 195
estimatedFiles: 2
created: 2026-06-11
independentStream: adr0038-overwrite-chain
dependsOn: [T-0335]
touchesFiles:
  - src/assessment-evaluation/assessment-evaluation.controller.ts
  - src/assessment-evaluation/assessment-evaluation.controller.spec.ts
plannerNote: "P5 ADR-0038 slice3 — controller reevaluate dispatch + User fail-closed 403. base 130×1.5=195 LOC, cap 내."
---

# T-0336 — controller period 분기 reevaluate dispatch + User fail-closed reject (ADR-0038 slice 3)

## Why

[ADR-0038](../decisions/ADR-0038-overwrite-reevaluate-persisted-assessment.md)(ACCEPTED) §Follow-ups slice 3 다. [T-0335](T-0335-orchestration-reeval-opt-out.md)(slice 2b, 머지 ca6d074)가 [PeriodBridgeAdminPersistService.generateAndPersist](../../src/assessment-evaluation/period-bridge-admin-persist.service.ts) 에 optional 5번째 인자 `reevaluate?: boolean`(strict-true 만 `"reeval"`)을 박제했으나, [AssessmentEvaluationController](../../src/assessment-evaluation/assessment-evaluation.controller.ts) 의 period Admin 분기는 여전히 4 인자 호출이라 caller 가 재평가를 trigger 할 HTTP 경로가 없다. 본 task 가 그 마지막 wiring 을 닫는다 — (a) Admin 분기(`persistForAdmin`)가 `dto.reevaluate` 를 `generateAndPersist` 5번째 인자로 pass-through(§Decision1), (b) 비-Admin(User) 요청이 `reevaluate: true` 를 명시하면 **fail-closed reject(403 ForbiddenException, §Decision4 권장 (ii)** — "요청했으나 무시됨" silent 혼란 차단), `false`/미지정은 기존 self-only ephemeral 그대로(회귀 0), (c) controller·spec 의 stale 주석(T-0334 가 제거한 `dto.mode` 언급 + "항상 fill / overwrite DEFERRED" 서술) 동기. service/DTO 변경 0 — controller + colocated spec 2 파일.

## Required Reading

- `docs/decisions/ADR-0038-overwrite-reevaluate-persisted-assessment.md` — §Decision1(request contract: `reevaluate?: boolean` flag dispatch, 별도 endpoint 0) · §Decision3(default first-write-wins 보존 + explicit opt-out) · §Decision4(RBAC Admin only + User negative 경계 — **(ii) fail-closed reject 권장 채택**) · §Follow-ups slice 3 정의.
- `src/assessment-evaluation/assessment-evaluation.controller.ts` — 수정 대상. `period()` role dispatch(L247~261) + `ephemeralForUser`(L266~296, self-only fail-closed 검사 anchor) + `persistForAdmin`(L302~342, `generateAndPersist` 4 인자 호출 L325~330) + stale 주석 L243~246("dto.mode 는 Admin 분기에서 reeval 로 baking 하지 않는다 — 항상 'fill', overwrite DEFERRED")·L298~301(동일 서술) — 동기 대상.
- `src/assessment-evaluation/assessment-evaluation.controller.spec.ts` — colocated spec(수정 대상). describe 구조: period self-only ephemeral(L668~)·period Admin full-persist(L826~)·PeriodBridgeDto negative(L995~)·RBAC guard metadata(L1079~). L967 부근 "generateAndPersist 가 항상 'fill' 정책 — reeval opt-out 분기는 slice 2b" 가드 테스트 = 본 task 가 재정의할 anchor. fixture `makePeriodDto`(L224 부근)는 `reevaluate` override 이미 지원(T-0333).
- `src/assessment-evaluation/period-bridge-admin-persist.service.ts` — read-only 재사용(변경 0). `generateAndPersist(identities, range, options, context, reevaluate?)` 시그니처(L125~135) + strict `reevaluate === true` 만 `"reeval"` 판정(헤더 doc L35~37) — controller 는 가공 없이 pass-through 만.
- `docs/tasks/T-0335-orchestration-reeval-opt-out.md` — 직전 slice 2b 의 박제 사실(reeval 경로 Conflict 전파·created 항상 true) + Follow-ups(본 slice 3 정의).

## Acceptance Criteria

- [ ] **Admin 분기 dispatch(§Decision1)**: `persistForAdmin` 이 `dto.reevaluate` 를 `generateAndPersist` 의 **5번째 인자로 가공 없이 pass-through**(`true`/`false`/`undefined` 그대로 — strict-true 판정은 service 책임, baking·정규화 0). service/DTO/응답 shape(`PeriodBridgeAdminResponse`) 변경 0 — `pnpm build` 로 비파괴 컴파일 검증.
- [ ] **User fail-closed reject(§Decision4 (ii))**: 비-Admin principal 의 요청이 `reevaluate === true` 를 명시하면 **ForbiddenException(403)** — 메시지는 한국어로 "재평가(reevaluate)는 Admin 전용" 의미 명시. 차단 위치는 `period()` 의 비-Admin dispatch 직전 또는 `ephemeralForUser` 진입 직후 중 구현 재량이되, **self-only 검사·person resolve·`generateEphemeral` 위임보다 선행**(전부 미호출). `false`/미지정은 기존 self-only ephemeral 동작 byte-for-byte 보존(회귀 0).
- [ ] **stale 주석 동기(§12 한국어)**: controller L243~246·L298~301 의 "dto.mode ... 항상 'fill'(overwrite DEFERRED)" 서술(T-0334 가 제거한 `mode` field 언급 포함)을 reevaluate dispatch + User fail-closed 사실(ADR-0038 §Decision1/4)로 갱신 + spec L967 부근 "slice 2b" 언급 동기.
- [ ] **happy-path test 1+**: (i) Admin + `reevaluate: true` → person resolve 후 `generateAndPersist` 1 회 위임 + **5번째 인자 `true`** + 영속 식별자/좌표 응답 보존. (ii) Admin + `reevaluate: false` → 5번째 인자 `false`. (R-112 항목 1)
- [ ] **error path test 1+**: (a) User + `reevaluate: true` → 403 ForbiddenException + `generateEphemeral`/`personService.findByIdWithIdentities`/`adminBridge` **전부 미호출** + 메시지에 재평가/Admin 의미 포함 검증. (b) Admin + `reevaluate: true` 분기에서 `generateAndPersist` reject(예: ConflictException — T-0335 의 reeval Conflict 전파) 시 controller 가 raw 전파(swallow 0). (R-112 항목 2)
- [ ] **flow / branch cover**: Admin `true`/`false`/미지정 3 분기 + User(비-Admin) `true`/`false`/미지정 3 분기 각 1+ test. **미지정 → 5번째 인자 `undefined` pass-through**(= first-write-wins 보존, §Decision3 default 회귀 0). (R-112 항목 3)
- [ ] **negative cases 충분 cover**: (a) spec L967 부근 가드 테스트를 "**`reevaluate` 미지정 시 Admin 분기는 reeval 로 baking 하지 않는다**(5번째 인자 `undefined`)" 로 재정의. (b) User + `reevaluate: true` + **타인 personId** 조합 → 403(재평가 거부가 self-only 위반보다 선행 — 거부 사유 결정성). (c) 기존 User self-only 테스트(L705~754)·Admin happy/error 테스트·RBAC guard metadata 테스트(`@Roles("User")` + JwtAuthGuard/RolesGuard) 전부 무변경 green(회귀 0). (d) wrong-type `reevaluate` 거부는 DTO ValidationPipe 책임(T-0333 기 커버) — controller 단 재검증 불요, 단 기존 DTO negative 테스트 green 유지. 단일 negative 금지 — 분기마다 cover. (R-112 항목 4)
- [ ] `pnpm lint && pnpm build && pnpm test` 통과 + `pnpm test:cov` 통과(line ≥ 80% / function ≥ 80%). (R-112 항목 5)

## Out of Scope

- **slice 4 e2e** — reevaluate replace 실측(row count 1 stable + content NEW) / default first-write-wins 보존 / 동시 reevaluate 수렴 semantics 실측(§Decision5 last-write-wins vs P2002 reject) / User + reevaluate 영속 변경 0 — 다음 task(ADR-0004 실 PostgreSQL).
- `docs/architecture/api.md` doc-sync(L102 — T-0334 Follow-ups 박제) — ADR-0038 chain 완료 후 별도 doc-sync task.
- `PeriodBridgeDto` / `PeriodBridgeAdminPersistService` / `PeriodBridgeEphemeralService` / `EvaluationResultPersistService` — 전부 무변경(read-only 재사용; slice 1·2a·2b 완료분).
- `PeriodBridgeAdminResponse` 응답 shape 확장(예: `replaced` flag) — 미도입(필요 시 별도 결정).
- ADR-0037 slice 4 의 RBAC 정밀화(principal 부재 deny 강화 등) — 기존 self-only fail-closed 유지(회귀 0)만, 신규 정밀화 0.
- 새 외부 dependency / DB schema 변경 / live LLM credential — 전부 0(§Decision6).

## Suggested Sub-agents

`implementer → tester` (architect 불요 — ADR-0038 §Decision1/3/4 가 dispatch 계약·fail-closed 정책을 이미 박제, 잔여 설계 결정 0).

## Follow-ups

- (planner) **slice 4 — e2e** 큐잉: 본 task 머지 후 reevaluate replace 실측 + 동시 reevaluate 수렴 semantics(§Decision5) + User 영속 0 (ADR-0004 실 PostgreSQL).
- (planner) chain 완료 후 `docs/architecture/api.md` doc-sync(period endpoint 의 `reevaluate` 계약 + 403 경계 반영).
- (planner) live-LLM bridge 검증(PLAN P5, 만료 2026-06-30) — 2026-06-25 전 미착수 시 우선순위 격상(backlogNote 트리거 유지).
