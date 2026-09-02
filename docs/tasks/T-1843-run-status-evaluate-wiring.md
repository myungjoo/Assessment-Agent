---
id: T-1843
title: 평가 축 evaluate handler 에 RunStatus 배선 — begin + finally end (ADR-0060 (a2-2) 1/2)
phase: P6
status: PENDING
commitMode: pr
coversReq: [REQ-083]
estimatedDiff: 340
estimatedFiles: 2
estimatedFilesNote: assessment-evaluation.controller.ts + assessment-evaluation.controller.spec.ts — module.ts 와 ctor 는 T-1842 가 이미 닫았고, module.spec.ts 는 손댈 이유가 없다
sizeExempt: true
exemptReason: "T-1842 실측(+330/-9 = spec 290 · controller 41 · module 8) 을 앵커로 한 항목별 산정. 본 task = 앵커 330 - module 8 - ctor 4 site 수정 24 - period 전용 builder 신설분 약 60 + makeController mock swap 30 + evaluate 본문 37 줄 finally 재들여쓰기(-37/+37 = 74) = 342 → 340. 파일 수 2 는 cap(5) 이내. 이보다 작게 자르면 배선만 있고 R-112 test 가 없는 slice 가 되어 §3.2 위반이며, 반대로 unevaluated-fill-run 까지 묶으면 재들여쓰기만 +86 LOC 늘어 426 이 된다"
created: 2026-09-02
independentStream: r78-polling
dependsOn: [T-1842]
touchesFiles: [src/assessment-evaluation/assessment-evaluation.controller.ts, src/assessment-evaluation/assessment-evaluation.controller.spec.ts]
plannerNote: P6 ADR-0060 §Follow-ups (a2-2) 중 evaluate 만 — pre-check 실측으로 미배선 확인. cap-bend pre-justified T-1842 앵커 340 LOC
---

# T-1843 — 평가 축 `evaluate` handler 에 RunStatus 배선 (ADR-0060 (a2-2) 1/2)

## Why

[T-1842](T-1842-run-status-period-wiring.md) 가 `6d239280` 로 머지되며 `@Post("period")` 한 진입점에 `begin("evaluation")` + `finally { end("evaluation") }` 전이 계약을 처음 부착했다. 그러나 [ADR-0060](../decisions/ADR-0060-evaluation-run-status-endpoint.md) `§Decision 4` `135~142 행` 표가 "상태를 켜는 진입점" 으로 박제한 4 개 중 **평가 축 2 개가 아직 꺼져 있다** — 그 상태로 (b) 조회 route 와 (e) web polling 이 붙으면 `POST /evaluate` 실행 중에 배너가 "평가 중 아님" 이라고 **거짓 음성**을 낸다. 본 task 는 그중 `@Post("evaluate")` 하나를 T-1842 와 동형으로 집행한다. T-1842 `## Follow-ups` 의 (a2-2) 가 "cap 압박 시 `evaluate` 와 `unevaluated-fill-run` 을 다시 쪼갠다" 를 미리 허용했고, 아래 수치가 그 쪼갬을 발동시킨다.

**issue-still-relevant pre-check 실측 (origin/main `68b4f4aa`)**: `git grep -n "runStatus\|RunStatusService\|RunStatusModule" origin/main -- src/assessment-evaluation/` 를 직접 돌려 다음을 확인했다 — (a) `assessment-evaluation.controller.ts` 안에서 `this.runStatus` 호출은 `367 행` `begin("evaluation")` · `379 행` `end("evaluation")` **딱 2 곳뿐이고 둘 다 `period()` 안**이다. `218~261 행` `evaluate()` 본문에는 `runStatus` 참조가 **0** 이다. (b) spec `143~152 행` 의 `makeController` 용 `runStatus` mock 은 여전히 `begin`/`end` 가 각각 `throw new Error("evaluate() 는 runStatus.begin 을 호출하면 안 된다")` 인 **격리 throw mock** 이며, 그 주석이 스스로 "evaluate() 는 아직 실행 상태 카운터에 배선되지 않았다 … (a2-2) 몫" 이라고 적고 있다. (c) `2756~2768 행` `makeRunController` 의 mock 도 같은 이유로 throw 상태다 (= `unevaluated-fill-run` 미배선). (d) `docs/tasks/` 최신 id 는 T-1842 라 (a2-2) 를 선점한 slice 가 없다. → **중복 큐잉 아님. 부분 안착도 아님** (ctor 주입과 `RunStatusModule` import 만 T-1842 가 이미 닫아둔 상태라 본 task 는 handler + spec 만 남는다).

**`unevaluated-fill-run` 을 같은 slice 에 넣지 않는 근거 (수치)**: `624~670 행` `runUnevaluatedFill()` 본문은 43 줄이라 `finally` 로 감싸면 재들여쓰기만 `-43/+43 = 86 LOC` 이 추가로 계상되고, 그 handler 의 `try/catch` → `ServiceUnavailableException` 매핑 경로까지 R-112 4 종으로 덮으면 spec 도 별도로 자란다. 합치면 340 + 86 + 약 80 = **약 506 LOC** 으로 cap 의 1.7 배가 된다. 그래서 (a2-3) 으로 분리한다.

## Required Reading

- [docs/decisions/ADR-0060-evaluation-run-status-endpoint.md](../decisions/ADR-0060-evaluation-run-status-endpoint.md) `133~158 행` (§Decision 4 — 켜는 진입점 4 개 표 · 켜지 않는 `unevaluated-fill-plan` · `finally` 감소가 계약의 핵심인 이유 · 동시 N 건 · 재시작 복구)
- [docs/tasks/T-1842-run-status-period-wiring.md](T-1842-run-status-period-wiring.md) `## Follow-ups` (a2-2) — 본 task 가 집행하는 배선 지점의 선행 박제
- [src/assessment-evaluation/assessment-evaluation.controller.ts](../../src/assessment-evaluation/assessment-evaluation.controller.ts) `353~381 행` (`period()` 의 **완성형 배선 shape** — `begin` 을 `try` 밖에 두는 이유 · `return await` 로 받는 이유가 주석에 이미 박제돼 있다. 본 task 는 이 shape 을 그대로 복제한다) · `218~261 행` (`@Post("evaluate")` 데코레이터 4 개 + 본문 — `activities` cast → `orchestrator.evaluateActivities` → context 4-tuple 조립 → `parseKstPeriodInput` → `mode` 정규화 → `persistService.persist` → 응답 조립)
- [src/run-status/run-status.service.ts](../../src/run-status/run-status.service.ts) `66~96 행` — `begin` / `end` 의 실제 계약 (짝 없는 `end` 는 warn 후 무시, 카운터 음수 불가)
- [src/assessment-evaluation/assessment-evaluation.controller.spec.ts](../../src/assessment-evaluation/assessment-evaluation.controller.spec.ts) `77~168 행` (`makeController` 빌더 — `143~152 행` 의 `runStatus` throw mock 과 `153~168 행` 의 반환 구조체가 본 task 의 수정 지점) · `186~200 행` (`makePeriodController` 의 `beginSpy` / `endSpy` **관측 mock 선례** — 반환 타입에 spy 를 얹는 방식을 그대로 따른다) · `588~797 행` (evaluate delegation describe — 기존 `makeController` 소비 test 들이 회귀하지 않아야 한다) · `1949~2100 행` (period 축 RunStatus describe — 본 task 가 추가할 describe 의 서술·단언 스타일 원본)
- [CLAUDE.md](../../CLAUDE.md) `§3.2` — R-112 4 항목과 coverage 임계

## Acceptance Criteria

- [ ] `src/assessment-evaluation/assessment-evaluation.controller.ts` 의 `218~261 행` `@Post("evaluate")` handler 본문을 `this.runStatus.begin("evaluation")` 직후 `try { ... } finally { this.runStatus.end("evaluation") }` 로 감싼다. `begin` 은 `try` **밖** 에 두어 `begin` 이 던지면 `finally` 에 진입조차 하지 않게 하고 (짝 없는 `end` 원천 차단), 위임은 **`return await`** 로 받아 `finally` 가 Promise 해소 **이후** 에만 돌게 한다 — 두 규칙 모두 `353~381 행` `period()` 의 확립된 shape 과 동일해야 한다 (ADR-0060 `§Decision 4`).
- [ ] 감싸는 범위는 handler **최상단부터** — `activities` cast · context 4-tuple 조립 · `parseKstPeriodInput` 파싱 · `mode` 정규화까지 전부 `try` 안에 든다. 즉 `parseKstPeriodInput` 이 `RangeError` 로 **동기 throw** 하는 경로에서도 카운터가 stuck 되지 않아야 한다.
- [ ] `RunStatusService` ctor 주입 · `RunStatusModule` import 는 **이미 T-1842 가 닫았으므로 재작업하지 않는다** — `assessment-evaluation.module.ts` 변경 0, ctor param 순서 변경 0.
- [ ] `src/assessment-evaluation/assessment-evaluation.controller.spec.ts` 의 `143~152 행` `makeController` 용 `runStatus` throw mock 을 **관측 mock** (`beginSpy` / `endSpy` = `jest.fn()`) 으로 교체하고, 빌더 반환 구조체에 `beginSpy` · `endSpy` 를 추가한다 (`186~200 행` `makePeriodController` 선례와 동일한 방식). 기존 20+ 호출부는 구조 분해라 필드 추가만으로 회귀 0 이어야 한다 — `pnpm build` · 기존 evaluate describe 전부 green 확인.
- [ ] `2756~2768 행` `makeRunController` 와 `379~392 행` plan 빌더의 **throw mock 은 그대로 유지** 한다 — `unevaluated-fill-run` 미배선 ((a2-3) 몫) 과 dry-run `unevaluated-fill-plan` 영구 미배선 (`§Decision 4`) 을 test 로 계속 고정하기 위함이다.
- [ ] **happy-path test** — `evaluate()` 정상 반환 경로에서 `begin` 이 `"evaluation"` 인자로 정확히 1 회, `end` 가 `"evaluation"` 인자로 정확히 1 회 호출된다. 반환 shape (`assessmentId` · `contributionCount` · `results`) 과 `evaluateSpy` · `persistSpy` 위임 인자가 기존 test 와 동일하게 보존됨을 함께 단언한다 (카운터 배선이 결과를 가공하지 않음).
- [ ] **error path test** — 최소 3 종에서 예외가 **그대로 전파**되면서도 `end("evaluation")` 이 1 회 호출된다: ① `orchestrator.evaluateActivities` reject ② `persistService.persist` reject ③ `parseKstPeriodInput` 이 `RangeError` 를 던지는 malformed `periodStart` (**동기 throw** 경로 — `finally` 가 async 이전 단계에서도 도는지 고정).
- [ ] **분기 cover** — handler 안의 `dto.mode === "reeval" ? "reeval" : "fill"` 두 갈래 각각에서 `begin`/`end` 가 1 회씩 균형을 이룬다 (mode 정규화가 카운터 경로에 영향 0 임을 고정).
- [ ] **negative cases 충분 cover** — 최소 다음 각각 1+ test: ① **축 격리** — `evaluate()` 어느 경로에서도 `begin("collection")` · `end("collection")` 이 호출되지 않는다. ② **중복 호출 없음** — 한 번의 `evaluate()` 가 `begin` 을 2 회 이상 부르지 않는다 (동시 N 건 카운터 오염 차단). ③ **순서 불변식** — `end` 는 위임 (`persistService.persist`) 이 끝난 뒤에 불린다 (위임 mock 안에서 `endSpy` 미호출 확인 또는 `mock.invocationCallOrder` 비교) — `return await` 누락 회귀를 잡는 게이트. ④ **`begin` 선행** — 위임 mock 안에서 `beginSpy` 가 이미 1 회 호출된 상태다 (실행 구간이 위임을 실제로 덮는다). ⑤ **dry-run 미배선 보존** — `563 행` `@Post("unevaluated-fill-plan")` 경로는 `begin`/`end` 를 호출하지 않는다. ⑥ **fill-run 미배선 보존** — `624 행` `@Post("unevaluated-fill-run")` 경로도 아직 호출하지 않는다 ((a2-3) 이 뒤집기 전까지의 현 계약 고정).
- [ ] `pnpm lint` warning 0 · `pnpm build` 성공 · `pnpm test` 전체 green.
- [ ] `pnpm test:cov` 통과 — coverage line ≥ 80% / function ≥ 80% 임계 유지 (`package.json` 의 `coverageThreshold.global`).
- [ ] `BASE_REF=origin/main scripts/check-spec-presence.sh` 통과 (신규 production 파일 0 — 기존 colocated spec 수정뿐).
- [ ] `git diff --stat origin/main` 상 변경 파일이 `src/assessment-evaluation/` **2 개뿐** 이다 — `src/run-status/` · `assessment-evaluation.module.ts` · `prisma/schema.prisma` · `package.json` · lockfile · `.github/workflows/` 변경 **0**.

## Out of Scope

- **`@Post("unevaluated-fill-run")` 배선** — `624~670 행` 본문 43 줄의 `finally` 재들여쓰기만 86 LOC 이고 `ServiceUnavailableException` 매핑 경로의 R-112 cover 가 별도로 붙어 합산 약 506 LOC 이 된다. 아래 `## Follow-ups` (a2-3) 으로 분리.
- **`563 행` `@Post("unevaluated-fill-plan")`** — dry-run 이라 ADR-0060 `§Decision 4` `144~146 행` 이 명시적으로 제외. 본 task 는 이 handler 를 **수정하지 않으며** 미호출을 test 로 고정만 한다.
- **`@Post("period")` 재작업** — T-1842 가 이미 닫았다. 그 handler·그 describe 는 손대지 않는다 (본 task 의 diff 에 나타나면 안 된다).
- **수집 축 배선** ((c) — `assessment-collection.controller.ts` `54 행`) · **조회 route + `AppModule` 등록** ((b)) · **e2e** ((d)) · **web polling** ((e)) · **doc-sync 와 REQ-083 재판정** ((f)) — 전부 [ADR-0060](../decisions/ADR-0060-evaluation-run-status-endpoint.md) `§Follow-ups` `270~294 행` 몫.
- **`src/run-status/` 파일 수정** — service 계약은 T-1841 에서 확정됐다. 배선 중 계약 변경이 필요해 보이면 고치지 말고 `## Follow-ups` 에 적는다.
- **`evaluate()` 본문 로직 자체의 변경** — cast · context 조립 · `mode` 정규화 · 위임 순서는 그대로 둔다. 본 task 는 **감싸기만** 한다 (재들여쓰기 외의 의미 변경 0).
- **`prisma/schema.prisma` 변경 · migration · 새 dependency** — 본 배선은 기존 DI 조립뿐이라 어느 쪽도 필요 없다. 필요하다고 판단되면 즉시 중단하고 `BLOCKED` → notifier ([CLAUDE.md](../../CLAUDE.md) `§5`).
- **[requirements.md](../requirements.md) `102 행` REQ-083 status 재판정 · [PLAN.md](../PLAN.md) `133 행` ④ 마커** — 전부 (f) 몫 ([CLAUDE.md](../../CLAUDE.md) `§3.1` 규칙 6 — 구현 머지 후 1 회).

## Suggested Sub-agents

`implementer → tester`

(architect 불요 — ADR-0060 `§Decision 4` 가 전이 시점·진입점 목록·예외 경로 계약을 확정했고 T-1842 가 같은 controller 안에 복제 대상 shape 을 이미 박제했다. 본 task 는 배선 집행만 한다.)

## Follow-ups

(생성 시점 비어 있음 — sub-agent 가 관련 작업을 발견하면 여기에 append.)

- **(a2-3) 잔여 평가 축 handler 배선** — [assessment-evaluation.controller.ts](../../src/assessment-evaluation/assessment-evaluation.controller.ts) `624 행` `@Post("unevaluated-fill-run")` 을 본 task 와 동형으로 `begin("evaluation")` + `finally { end("evaluation") }` 로 감싸고, [assessment-evaluation.controller.spec.ts](../../src/assessment-evaluation/assessment-evaluation.controller.spec.ts) `2756~2768 행` `makeRunController` 의 `runStatus` throw mock 을 관측 mock 으로 바꿔 R-112 4 종을 덮는다. 그 handler 는 `llmProviderConfigResolver` 실패를 `ServiceUnavailableException`(503) 으로 re-throw 하는 `try/catch` 를 이미 갖고 있으므로 **503 매핑 경로에서도 `end` 가 1 회** 임을 negative 로 반드시 고정한다. 예상 약 170 LOC / 2 파일.
- **(b) ~ (f)** — [ADR-0060](../decisions/ADR-0060-evaluation-run-status-endpoint.md) `§Follow-ups` `270~294 행` 그대로. 평가 축 3 handler 가 모두 닫히는 (a2-3) 이후에 (c) 수집 축 → (b) 조회 route 순으로 진행하는 것이 배너 false-negative 구간을 최소화한다.
