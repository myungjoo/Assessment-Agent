---
id: T-1845
title: 수집 축 collect handler 에 RunStatus 배선
phase: P6
status: DONE
commitMode: pr
coversReq: [REQ-083]
estimatedDiff: 310
estimatedFiles: 3
created: 2026-09-02
independentStream: run-status-wiring
dependsOn: [T-1841]
touchesFiles:
  - src/assessment-collection/assessment-collection.module.ts
  - src/assessment-collection/assessment-collection.controller.ts
  - src/assessment-collection/assessment-collection.controller.spec.ts
sizeExempt: true
exemptReason: "R-112 backbone (module + controller + colocated spec 동시 박제) × 1.5 — cap-bend pre-justified, T-1844 실측(+330/-58 = spec 251 · controller 78) 항목별 앵커링"
completedAt: 2026-09-02T05:52:48Z
prNumber: 1450
mergeCommit: 4779737b
plannerNote: "P6 PLAN 133 행 ④ R-78 polling — ADR-0060 §Follow-ups (c) 수집 축 배선. 평가 축 3 handler 완료 후 마지막 write-side 진입점."
---

# T-1845 — 수집 축 collect handler 에 RunStatus 배선

## Why

[PLAN.md](../PLAN.md) `133 행` bullet 의 잔여 ④ **R-78 평가 진행 배너 자동 polling** 을 여는
chain 에서, [ADR-0060](../decisions/ADR-0060-evaluation-run-status-endpoint.md) `§Follow-ups (c)`
**수집 축 소비처 배선** 을 집행한다. `§Decision 4` 가 "상태를 켜는 비용 있는 실행 진입점" 으로
박제한 4 개 중 평가 축 3 개(`period` T-1842 · `evaluate` T-1843 · `unevaluated-fill-run` T-1844)는
모두 닫혔고, 남은 하나가 수집 축 `@Post("collect")` 다. 이것을 배선해야 `snapshot()` 의
`collection.active` 가 실제 실행을 반영하고, 후속 (b) 조회 route 가 열릴 때 응답이 두 축 모두
참인 값을 내보낸다 — 지금 (b) 를 먼저 열면 `collection` 축이 영구히 `false` 인 반쪽 계약이 노출된다.
`§Follow-ups` 도 (c) 를 "(a) 이후 언제든 착수 가능" 한 독립 조각으로 두었으므로 (b) 보다 먼저
집행해도 chain 순서를 깨지 않는다.

**issue-still-relevant pre-check 실측 (origin/main `2a0324f3`)** — 중복 큐잉·부분 안착 아님:

- `grep -rn "RunStatus\|runStatus" src/assessment-collection/ src/app.module.ts` → **매칭 0**.
- [assessment-collection.module.ts](../../src/assessment-collection/assessment-collection.module.ts)
  `84 행` `imports: [GithubModule, ConfluenceModule, UserModule, AuthModule]` — `RunStatusModule` 미포함.
- [assessment-collection.controller.ts](../../src/assessment-collection/assessment-collection.controller.ts)
  `49 행` ctor param 은 `triggerService` **1 개뿐**, `54~62 행` `collect()` 본문에 `begin`/`finally` 0.
- [assessment-collection.controller.spec.ts](../../src/assessment-collection/assessment-collection.controller.spec.ts)
  `19~31 행` `makeController` 는 `triggerCollection` mock 만 주입 — runStatus mock 자체가 없다.
- 즉 (c) 는 착수 이력 0 이며, ctor 주입·module import 가 이미 존재하는 평가 축과 달리 본 module 은
  **처음부터** 배선한다(부분 안착 아님).

## Required Reading

- [docs/decisions/ADR-0060-evaluation-run-status-endpoint.md](../decisions/ADR-0060-evaluation-run-status-endpoint.md)
  — `§Decision 1`(in-memory 카운터) · `§Decision 4`(전이 규칙: 비용 있는 실행만, `finally` 감소) ·
  `§Follow-ups (c)`.
- [src/run-status/run-status.service.ts](../../src/run-status/run-status.service.ts) `10 행`
  `RunAxis` · `66 행` `begin(axis)` · `80 행` `end(axis)` · `98 행` `snapshot()`.
- [src/run-status/run-status.module.ts](../../src/run-status/run-status.module.ts) 전문 (12 줄 —
  provider/export 만, 다른 module import 0 이라 circular 위험 없음).
- [src/assessment-collection/assessment-collection.module.ts](../../src/assessment-collection/assessment-collection.module.ts)
  `84 행` `imports` 배열 (여기에 `RunStatusModule` 추가).
- [src/assessment-collection/assessment-collection.controller.ts](../../src/assessment-collection/assessment-collection.controller.ts)
  전문 (63 줄 — `49 행` ctor · `54~62 행` `collect()`).
- [src/assessment-collection/assessment-collection.controller.spec.ts](../../src/assessment-collection/assessment-collection.controller.spec.ts)
  전문 (72 줄 — `19~31 행` `makeController`).
- **선행 slice 의 shape 참고(동형 유지용)**:
  [src/assessment-evaluation/assessment-evaluation.module.ts](../../src/assessment-evaluation/assessment-evaluation.module.ts)
  `42 행` import · `74~79 행` 주석 + `imports` 배열,
  [src/assessment-evaluation/assessment-evaluation.controller.ts](../../src/assessment-evaluation/assessment-evaluation.controller.ts)
  `197~205 행` ctor 주입 주석 · `379~402 행` `period()` 의 `begin` → `try` → `return await` →
  `finally { end }` 배치.

## Acceptance Criteria

- [ ] `assessment-collection.module.ts` `84 행` `imports` 에 `RunStatusModule` 을 추가하고 그 근거를
      한국어 주석 2~4 줄로 남긴다. **`providers` · `exports` · `controllers` 배열은 불변** (새 dependency 0,
      `package.json` · `prisma/schema.prisma` 변경 0).
- [ ] `assessment-collection.controller.ts` 의 ctor 에 `private readonly runStatus: RunStatusService`
      를 **마지막 param 으로** 추가한다 (기존 `triggerService` 의 위치·순서 불변 → 다른 호출부 회귀 0).
- [ ] `collect()` handler 를 `this.runStatus.begin("collection")` → `try { return await
      this.triggerService.triggerCollection(dto); } finally { this.runStatus.end("collection"); }` 로
      감싼다. `begin` 은 `try` **밖**(짝 없는 `end` 원천 차단), 위임은 **`return await`**(Promise 해소
      전 조기 감소 차단) — T-1842/T-1843/T-1844 와 동형. 위임 인자·반환 shape·RBAC·ValidationPipe 는
      변경 0.
- [ ] **happy-path test** — `collect()` 성공 경로에서 `begin("collection")` 1 회 · `end("collection")`
      1 회가 호출되고, `triggerSpy` 인자(dto 그대로)와 반환 summary 참조가 보존된다 (2+ test).
- [ ] **error path test** — 위임이 reject 하는 세 경우(`NotFoundException` · `ConflictException` ·
      일반 `Error`) 모두 예외가 raw 전파되면서도 `finally` 로 `end("collection")` 가 정확히 1 회
      호출된다 (3+ test).
- [ ] **분기 cover** — 본 handler 는 조건 분기가 없다(위임 1 줄). 따라서 분기 test 대신 **성공/실패
      두 종료 경로** 각각에서 `begin`/`end` 짝이 성립함을 고정하고, 그 사실을 spec 주석에 명시한다.
- [ ] **negative cases 충분 cover (6+ test)** — ① 축 격리(수집 실행 중 `evaluation` 축 `begin`/`end`
      호출 0) ② 중복 `begin` 0(호출당 정확히 1 회) ③ 순서 불변식(`begin` 이 `triggerCollection` 보다
      먼저, `end` 가 그보다 나중) ④ `begin` 선행(위임 mock 안에서 관측 시 이미 begin 됨) ⑤ 위임이
      동기 throw 하는 경우에도 `end` 1 회 ⑥ 반환 promise 가 해소되기 전에는 `end` 미호출(조기 감소
      회귀 방지).
- [ ] `assessment-collection.module.spec.ts` 는 **수정하지 않는다** — `Test.createTestingModule({
      imports: [PersistenceModule, AssessmentCollectionModule] })` 구성(`123~124 행` 등)이
      `RunStatusModule` import 누락 시 곧바로 red 가 되므로 무수정 회귀 게이트로 둔다. 결과적으로 변경
      파일은 3 개.
- [ ] `pnpm lint && pnpm build && pnpm test` 전량 통과.
- [ ] `pnpm test:cov` 통과 (전역 임계 line ≥ 80% / function ≥ 80% 유지).

## Out of Scope

- **(b) 조회 route + AppModule 등록** — `src/run-status/run-status.controller.ts` 신설과
  `src/app.module.ts` 의 `RunStatusModule` 등록은 다음 slice. 본 task 는 `src/app.module.ts` 를
  건드리지 않는다.
- **`src/run-status/` 무변경** — service/module 의 구현·시그니처를 바꾸지 않는다(소비처 배선만).
- **평가 축 재손질 금지** — `assessment-evaluation/` 파일은 읽기 전용 참고 대상.
- **e2e (d) · web polling (e) · doc-sync/REQ-083 재판정 (f)** — 각각 별도 slice.
- `collection-trigger.service.ts` 등 orchestration 내부 로직 변경 0 (controller 경계에서만 계측).
- dry-run 성격 route 나 조회 route 에 카운터를 붙이지 않는다 (`§Decision 4` — 비용 있는 실행만).

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(작성 시점 비어 있음 — sub-agent 가 발견한 관련 작업을 여기에 append)
