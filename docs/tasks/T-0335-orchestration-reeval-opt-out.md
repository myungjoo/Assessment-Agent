---
id: T-0335
title: PeriodBridgeAdminPersistService reevaluate opt-out 분기 (ADR-0038 slice 2b)
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-009, REQ-040, REQ-045]
estimatedDiff: 240
estimatedFiles: 2
created: 2026-06-11
independentStream: adr0038-overwrite-chain
dependsOn: [T-0334]
touchesFiles:
  - src/assessment-evaluation/period-bridge-admin-persist.service.ts
  - src/assessment-evaluation/period-bridge-admin-persist.service.spec.ts
plannerNote: "P5 ADR-0038 slice2b — admin-persist reeval opt-out 분기+mocked unit. base 130×1.5×1.2(P2002)=240 LOC, cap 내."
---

# T-0335 — PeriodBridgeAdminPersistService reevaluate opt-out 분기 (ADR-0038 slice 2b)

## Why

[ADR-0038](../decisions/ADR-0038-overwrite-reevaluate-persisted-assessment.md)(ACCEPTED) §Follow-ups slice 2 의 후반부(2b)다. [T-0334](T-0334-vestigial-mode-removal-adr0038-amend.md)(slice 2a, 머지 dc92553)가 vestigial `PeriodBridgeDto.mode` 를 제거해 request 계약을 `reevaluate?: boolean` 단일 flag(5 키)로 단일화했으므로, 이제 깨끗해진 계약 위에서 orchestration 분기를 박제한다 — [PeriodBridgeAdminPersistService](../../src/assessment-evaluation/period-bridge-admin-persist.service.ts) 의 `generateAndPersist` 가 `reevaluate?: boolean` 을 받아, `true` 면 `mode: "reeval"`(reset-and-recreate, ADR-0033 primitive 재사용)로 영속화하고 read-through fall-back 을 적용하지 않으며(§Decision3), `false`/미지정이면 기존 first-write-wins(`"fill"`) read-through 를 그대로 보존한다(default 회귀 0). [EvaluationResultPersistService.persist](../../src/assessment-evaluation/evaluation-result-persist.service.ts) 시그니처/구현 변경 0(§Decision2 — `"reeval"` 분기는 이미 머지된 primitive). controller wiring(flag dispatch + User fail-closed reject)은 slice 3 — 본 task 는 **service 단위까지만**이며, optional trailing param 추가라 기존 controller 호출(4 인자)은 무변경 컴파일된다.

## Required Reading

- `docs/decisions/ADR-0038-overwrite-reevaluate-persisted-assessment.md` — §Decision2(reeval primitive 재사용, persist 시그니처 변경 0) · §Decision3(default fill 보존 + explicit opt-out + 좌표 부재 시 create degrade + reeval 경로는 read-through fall-back 미적용) · §Decision5(P2002 동시성 — 수렴 semantics 실측은 slice 4 e2e) · §Decision1 amendment(5 키 계약).
- `src/assessment-evaluation/period-bridge-admin-persist.service.ts` — 수정 대상. `generateAndPersist`(L112~139) + `persistAndReadThrough`(L153~178, mode 항상 `"fill"` 자리) + 헤더/doc 주석의 "reeval 호출 0" 서술(L29~31·L97 등 — 동기 대상).
- `src/assessment-evaluation/period-bridge-admin-persist.service.spec.ts` — colocated spec(수정 대상). describe 4 블록 구조(happy-path / branch·flow / error path / negative cases) + 5-collaborator mock 주입 패턴. L481 의 "reeval 모드 미호출" 가드 테스트는 본 task 가 재정의해야 할 anchor.
- `src/assessment-evaluation/evaluation-result-persist.service.ts` — read-only 재사용(변경 0). `PersistMode = "fill" | "reeval"` + reeval reset-and-recreate 분기(L150~183, `existing === null` 이면 create fall-through) + P2002→ConflictException(L129~134).
- `docs/tasks/T-0334-vestigial-mode-removal-adr0038-amend.md` — 직전 slice 2a 의 계약 단일화 사실 + Follow-ups(api.md doc-sync 는 chain 끝 별도 task — 본 task 범위 아님).

## Acceptance Criteria

- [ ] `generateAndPersist` 가 **optional 5번째 인자 `reevaluate?: boolean`**(미지정 default = first-write-wins)를 받는다. `persistAndReadThrough` 가 flag 에 따라 mode 를 선택 — `true` → `"reeval"`, `false`/미지정 → `"fill"`. `EvaluationResultPersistService.persist` 시그니처/구현 변경 0, controller/ephemeral service 무변경(기존 4 인자 호출 비파괴 컴파일 — `pnpm build` 로 검증).
- [ ] **reeval 경로 semantics 박제(§Decision3)**: `persist(context, results, "reeval")` 후 `readBackById` 로 영속본 read-back. read-through fall-back(P2002 catch→`readBackByCoordinate`)은 **fill 전용 — reeval 경로에서는 ConflictException 을 catch 하지 않고 전파**(silent 유실 방지; 동시 reevaluate 수렴 실측은 slice 4 e2e). 반환 `created` 는 reeval 경로에서 contributionCount heuristic 을 쓰지 않고 **항상 `true`**(replace 든 첫 create 든 fresh row 가 항상 생성됨 — 빈 결과 create 의 contributionCount 0 오판 차단) — 이 semantics 를 doc 주석에 박제.
- [ ] **default 경로 회귀 0**: flag `false`/미지정 시 기존 first-write-wins read-through(fill + P2002 catch→read fall-through + created=contributionCount heuristic) 가 byte-for-byte 동작 보존 — 기존 spec 전 테스트 green 유지(필요한 곳만 최소 수정).
- [ ] **happy-path test 1+**: (i) `reevaluate: true` + 좌표 존재 시나리오 — persist 가 `"reeval"` 로 정확히 1 회 호출되고 read-back 영속본 + `created: true` 반환. (ii) `reevaluate: false`/미지정 — persist 가 `"fill"` 로 호출(기존 happy 보존). (R-112 항목 1)
- [ ] **flow / branch cover**: `true` / `false` / 미지정 3 분기 각 1+ test + **좌표 부재 + `reevaluate: true` → create degrade**(persist mock 이 부재-create 결과를 반환해도 service 는 `"reeval"` 로 호출 + read-back 수렴 + `created: true`) + 빈 EvaluationResult[] + reeval 경로 throw 0. (R-112 항목 3)
- [ ] **error path test 1+**: (a) reeval 경로 persist 가 ConflictException reject → caller 로 **전파** + `readBackByCoordinate` 미호출(fill fall-back 미적용 검증). (b) reeval 경로 일반 error 전파(swallow 0). (c) reeval 경로 `readBackById` null → 명시적 throw. (R-112 항목 2)
- [ ] **negative cases 충분 cover**: (a) 기존 L481 "reeval 모드 미호출" 가드 테스트를 "**default(false/미지정) 경로는 여전히 `"reeval"` 을 호출하지 않는다**" 로 재정의. (b) reeval 경로에서 `"fill"` 미호출 검증(mode 혼선 0). (c) ephemeral sibling write-0 구조 보존 회귀 유지(L567 테스트 무변경 green). (d) fill 경로의 P2002 catch→read fall-through 회귀 보존(기존 테스트 green). 단일 negative 금지 — 분기마다 cover. (R-112 항목 4)
- [ ] 헤더/doc 주석 동기 — "본 service 는 reeval 을 호출하지 않는다 / mode 항상 fill"(L29~31·L91~97·L141~151 등) 서술을 opt-out 분기 사실(default fill + explicit reeval, ADR-0038 §Decision3)로 갱신. 한국어(§12).
- [ ] `pnpm lint && pnpm build && pnpm test` 통과 + `pnpm test:cov` 통과(line ≥ 80% / function ≥ 80%). (R-112 항목 5)

## Out of Scope

- **controller wiring** — period 분기의 `reevaluate` flag dispatch + User + reevaluate fail-closed reject(§Decision4 (ii)) + [assessment-evaluation.controller.ts](../../src/assessment-evaluation/assessment-evaluation.controller.ts)/controller.spec 의 stale 주석(L246·spec L967 "slice 2b" 언급) 동기 — **slice 3**(다음 task, 본 task 와 파일-disjoint).
- e2e(reevaluate replace 실측 / 동시 reevaluate 수렴 semantics last-write-wins vs P2002 reject / User 영속 변경 0) — slice 4(ADR-0004 실 PostgreSQL).
- `EvaluationResultPersistService` / `PeriodBridgeEphemeralService` / `PeriodBridgeDto` — 무변경(read-only 재사용; DTO 는 T-0333/T-0334 완료).
- `PeriodBridgeAdminPersistResult` 반환 shape 확장(예: `replaced` flag) — 미도입. 응답 표현이 필요해지면 slice 3 이 결정.
- `docs/architecture/api.md` doc-sync(T-0334 Follow-ups 박제) — ADR-0038 chain 완료 후 별도 doc-sync task.
- 새 외부 dependency / DB schema 변경 / live LLM credential — 전부 0(§Decision6).

## Suggested Sub-agents

`implementer → tester` (architect 불요 — ADR-0038 §Decision2/3/5 가 분기 설계·semantics 를 이미 박제, 잔여 설계 결정 0).

## Follow-ups

- (planner) **slice 3 — controller wiring** 큐잉: 본 task 머지 후 controller period 분기가 `reevaluate` 를 `generateAndPersist` 5번째 인자로 dispatch + User + `reevaluate: true` fail-closed reject(403, §Decision4 (ii)) + colocated controller unit(orchestrator mock) + controller 주석 동기.
- (planner) live-LLM bridge 검증(PLAN P5, 만료 2026-06-30) — 2026-06-25 전 미착수 시 우선순위 격상(backlogNote 트리거 유지).
