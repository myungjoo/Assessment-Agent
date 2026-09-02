---
id: T-1844
title: 평가 축 unevaluated-fill-run handler 에 RunStatus 배선 — 503 매핑 경로 포함 (ADR-0060 (a2-3))
phase: P6
status: PENDING
commitMode: pr
coversReq: [REQ-083]
estimatedDiff: 330
estimatedFiles: 2
estimatedFilesNote: assessment-evaluation.controller.ts + assessment-evaluation.controller.spec.ts — module.ts 와 ctor 는 T-1842 가 이미 닫았고 src/run-status/ 는 무변경이다
sizeExempt: true
exemptReason: "T-1843 실측(+318/-53 = spec 281 · controller 90) 을 항목별로 분해해 앵커링. controller = 신규 주석 14 + begin/try/finally/end 5 + 본문 653~691 행 39 줄 재들여쓰기(+39/-39) + prettier 재포맷 여유 20 ≈ +78/-47. spec = makeRunController runStatus mock swap +14/-17 + evaluate describe 의 negative (6) 계약 전환 +12/-13 + 신규 RunStatus describe 225(T-1843 의 228 줄 선례에서 mode 분기 2 건 -25, 503 매핑 test 1 건 +22) ≈ +251/-30. 합계 약 +329 → 330. 파일 수 2 는 cap(5) 이내. 더 작게 자르면 배선만 있고 503 경로 negative 가 없는 slice 가 되어 §3.2 R-112 위반이며, (a2-3) 은 평가 축 마지막 handler 라 더 쪼갤 자연 절단면이 없다"
created: 2026-09-02
independentStream: r78-polling
dependsOn: [T-1843]
touchesFiles: [src/assessment-evaluation/assessment-evaluation.controller.ts, src/assessment-evaluation/assessment-evaluation.controller.spec.ts]
plannerNote: P6 ADR-0060 §Follow-ups (a2-3) — 평가 축 마지막 handler. pre-check 실측으로 미배선 확인. cap-bend pre-justified T-1843 앵커 330 LOC
---

# T-1844 — 평가 축 `unevaluated-fill-run` handler 에 RunStatus 배선 (ADR-0060 (a2-3))

## Why

[ADR-0060](../decisions/ADR-0060-evaluation-run-status-endpoint.md) `§Decision 4` `135~142 행` 표가 "상태를 켜는 진입점" 으로 박제한 4 개 중 [T-1842](T-1842-run-status-period-wiring.md) 가 `@Post("period")` 를, [T-1843](T-1843-run-status-evaluate-wiring.md) 가 `@Post("evaluate")` 를 닫았다. 남은 평가 축 진입점은 `@Post("unevaluated-fill-run")` **하나**다 — 이것이 꺼져 있는 동안에는 (b) 조회 route 와 (e) web polling 이 붙어도 미평가 일괄 fill 실행 중에 배너가 "평가 중 아님" 이라고 **거짓 음성**을 낸다. 그리고 이 handler 는 셋 중 **유일하게 자체 `try/catch` 로 503 을 매핑**하는 경로라, 여기서 `end` 가 빠지면 운영자 LLM provider 미설정 상황마다 카운터가 stuck 되어 배너가 영구히 "평가 중" 으로 굳는다. 본 task 는 T-1843 이 `## Follow-ups` (a2-3) 으로 분리해 둔 이 마지막 조각을 동형으로 집행하고, 평가 축 3 handler 를 모두 닫는다.

**issue-still-relevant pre-check 실측 (origin/main `5887eb7e`)**: 다음을 직접 grep 해 미배선을 확인했다 — (a) `git grep -n "runStatus" origin/main -- src/assessment-evaluation/assessment-evaluation.controller.ts` 결과 `this.runStatus` 호출은 `238 행`·`280 행`(`evaluate`, T-1843) 과 `389 행`·`401 행`(`period`, T-1842) **딱 4 곳**이고, `650~692 행` `runUnevaluatedFill()` 본문에는 참조가 **0** 이다. (b) spec `2993~3009 행` `makeRunController` 의 `runStatus` mock 은 여전히 `begin`/`end` 가 각각 `throw new Error("runUnevaluatedFill() 는 runStatus.begin 을 호출하면 안 된다")` 인 **미배선 고정용 throw mock** 이며, 그 주석이 스스로 "runUnevaluatedFill() 은 아직 미배선((a2-3) 몫)" 이라고 적고 있다. (c) spec `1017~1029 행` 에 T-1843 이 남긴 negative (6) test 가 `begin`·`end` **0 회**를 단언하며 현 계약을 고정하고 있고, 주석이 "(a2-3) 이 배선하면 이 test 가 red 가 되어 계약 전환 지점을 명시적으로 드러낸다" 고 예고한다. (d) `docs/tasks/` 최신 id 는 T-1843 이라 (a2-3) 을 선점한 slice 가 없다. → **중복 큐잉 아님. 부분 안착도 아님** (ctor 주입과 `RunStatusModule` import 는 T-1842 가 이미 닫아 본 task 에는 handler + spec 만 남는다).

**본 slice 가 (a2-3) 전체를 한 번에 닫는 근거**: 남은 진입점이 1 개뿐이라 handler 배선과 그 R-112 cover 사이에 자연 절단면이 없다. 배선만 떼면 503 경로 negative 가 없는 slice 가 되어 [CLAUDE.md](../../CLAUDE.md) `§3.2` R-112 위반이고, spec 만 떼면 소비처 없는 test 라 [CLAUDE.md](../../CLAUDE.md) `§3` 소비처 동반 의무 위반이다. 그래서 frontmatter `sizeExempt` 로 진행한다 (수치 근거는 `exemptReason`).

## Required Reading

- [docs/decisions/ADR-0060-evaluation-run-status-endpoint.md](../decisions/ADR-0060-evaluation-run-status-endpoint.md) `133~158 행` (§Decision 4 — 켜는 진입점 4 개 표 · 켜지 않는 `unevaluated-fill-plan` · `finally` 감소가 계약의 핵심인 이유 · 동시 N 건 · 재시작 복구)
- [src/assessment-evaluation/assessment-evaluation.controller.ts](../../src/assessment-evaluation/assessment-evaluation.controller.ts) `225~282 행` (`evaluate()` 의 **완성형 배선 shape** — `begin` 을 `try` 밖에 두는 이유 · 감싸는 범위를 본문 전체로 잡는 이유 · `await` 로 받아 `finally` 를 위임 해소 이후로 미루는 이유가 주석에 이미 박제돼 있다. 본 task 는 이 shape 을 그대로 복제한다) · `646~692 행` (`@Post("unevaluated-fill-run")` 데코레이터 4 개 + 본문 — `llmProviderConfigResolver.resolveDefaultModelId()` 를 `try/catch` 로 감싸 실패를 `ServiceUnavailableException`(503) 으로 re-throw 한 뒤 `unevaluatedFillRunOrchestrator.run(...)` 으로 위임하는 2 단 구조)
- [src/run-status/run-status.service.ts](../../src/run-status/run-status.service.ts) `61~95 행` — `begin` / `end` 의 실제 계약 (알 수 없는 axis 는 warn 후 무시, 짝 없는 `end` 는 warn 후 카운터 0 유지, 음수 불가)
- [src/assessment-evaluation/assessment-evaluation.controller.spec.ts](../../src/assessment-evaluation/assessment-evaluation.controller.spec.ts) `2920~3028 행` (`makeRunController` 빌더 — `2993~3009 행` 의 `runStatus` throw mock 과 `2930~2932 행` 의 타입 주석, `3010~3027 행` 반환 구조체가 본 task 의 수정 지점) · `3030~3101 행` (`makeRunDto` · `makeRunResult` fixture — 그대로 재사용) · `804~1030 행` (evaluate 축 RunStatus describe — 본 task 가 추가할 describe 의 서술·단언 스타일 **원본**. 특히 `1004~1015 행` dry-run 미배선 고정 test 와 `1017~1029 행` fill-run 미배선 고정 test) · `3102~3356 행` (fill-run delegation describe — 503 매핑 4 종 · orchestrator reject raw 전파 · `modelId` 지정/미지정 분기의 기존 단언 스타일. 이 describe 의 test 들이 회귀하지 않아야 한다)
- [CLAUDE.md](../../CLAUDE.md) `§3.2` — R-112 4 항목과 coverage 임계

## Acceptance Criteria

- [ ] `src/assessment-evaluation/assessment-evaluation.controller.ts` 의 `650~692 행` `runUnevaluatedFill()` 본문을 `this.runStatus.begin("evaluation")` 직후 `try { ... } finally { this.runStatus.end("evaluation") }` 로 감싼다. `begin` 은 `try` **밖** 에 두어 `begin` 이 던지면 `finally` 에 진입조차 하지 않게 하고 (짝 없는 `end` 원천 차단), 최종 위임은 **`return await`** 로 받아 `finally` 가 Promise 해소 **이후** 에만 돌게 한다 — 두 규칙 모두 `225~282 행` `evaluate()` 의 확립된 shape 과 동일해야 한다 (ADR-0060 `§Decision 4`).
- [ ] 감싸는 범위는 handler **최상단부터** — `llmProviderConfigResolver.resolveDefaultModelId()` 의 `try/catch` 와 `ServiceUnavailableException` re-throw 까지 전부 바깥 `try` 안에 든다. 즉 **503 fail-fast 경로에서도 `end("evaluation")` 이 정확히 1 회** 돌아 카운터가 stuck 되지 않아야 한다 (본 handler 가 평가 축 3 개 중 유일하게 자체 예외 매핑을 가진 지점이라 본 항목이 slice 의 핵심이다).
- [ ] 기존 503 매핑 의미는 **불변** — `error instanceof Error ? error.message : "LLM provider 설정을 해석할 수 없다 (default modelId source 미박제)."` 와 `{ cause: error }` 전파, orchestrator 위임 인자 3 종 (`dto.rawBridges` · `dto.modelId` · `resolvedDefaultModelId`) 은 그대로 둔다. 본 task 는 **감싸기만** 한다 (재들여쓰기 외 의미 변경 0).
- [ ] `RunStatusService` ctor 주입 · `RunStatusModule` import 는 **이미 T-1842 가 닫았으므로 재작업하지 않는다** — `assessment-evaluation.module.ts` 변경 0, ctor param 순서 변경 0.
- [ ] `src/assessment-evaluation/assessment-evaluation.controller.spec.ts` 의 `2993~3009 행` `makeRunController` 용 `runStatus` throw mock 을 **관측 mock** (`beginSpy` / `endSpy` = `jest.fn()`) 으로 교체하고 `2930~2932 행` 타입 주석의 "미배선 고정용 throw mock" 서술을 현 계약에 맞게 갱신한다. 반환 구조체 (`3023~3026 행`) 는 이미 두 spy 를 노출하므로 필드 추가 없이 회귀 0 이어야 한다 — `pnpm build` · 기존 fill-run delegation describe (`3102~3356 행`) 전부 green 확인.
- [ ] `1017~1029 행` 의 negative (6) test ("unevaluated-fill-run 경로는 아직 begin·end 를 호출하지 않는다") 를 **계약 전환에 맞춰 갱신**한다 — 본 task 가 배선하므로 그 단언은 더 이상 참이 아니다. 삭제만 하지 말고 evaluate describe 문맥에 맞는 **축 격리 단언** (예: `runUnevaluatedFill()` 은 `begin("collection")` 을 호출하지 않는다) 으로 재작성하거나, fill-run 의 실 배선 단언을 본 task 가 새로 추가하는 describe 로 옮긴다. 어느 쪽이든 **"(a2-3) 이전 현 계약 고정" 주석은 제거**한다.
- [ ] plan 빌더 (`makeFillController`) 와 `1004~1015 행` dry-run 미배선 test 의 **throw mock · 0 회 단언은 그대로 유지** 한다 — `unevaluated-fill-plan` 은 ADR-0060 `§Decision 4` `144~146 행` 이 영구 제외한 진입점이다.
- [ ] **happy-path test** — `runUnevaluatedFill()` 정상 반환 경로에서 `begin` 이 `"evaluation"` 인자로 정확히 1 회, `end` 가 `"evaluation"` 인자로 정확히 1 회 호출된다. 반환 `UnevaluatedFillRunResult` 가 orchestrator 반환과 deep-equal 이고 `runSpy` · `resolveSpy` 위임 인자가 기존 test 와 동일하게 보존됨을 함께 단언한다 (카운터 배선이 결과를 가공하지 않음).
- [ ] **error path test** — 최소 3 종에서 `end("evaluation")` 이 1 회 호출된다: ① `llmProviderConfigResolver.resolveDefaultModelId` reject → `ServiceUnavailableException`(503) 으로 매핑되면서도 감소 ② `unevaluatedFillRunOrchestrator.run` reject → raw 전파되면서도 감소 (503 아님을 함께 단언) ③ resolver 가 **non-Error 값**으로 reject → 한국어 fallback 메시지 503 경로에서도 감소.
- [ ] **분기 cover** — (가) `error instanceof Error` 두 갈래 (Error reject / non-Error reject) 각각에서 `begin`/`end` 가 1 회씩 균형을 이룬다. (나) `dto.modelId` 지정 / 미지정 두 갈래 각각에서도 동일하게 균형을 이룬다 (override 유무가 카운터 경로에 영향 0).
- [ ] **negative cases 충분 cover** — 최소 다음 각각 1+ test: ① **축 격리** — `runUnevaluatedFill()` 어느 경로에서도 `begin("collection")` · `end("collection")` 이 호출되지 않는다. ② **중복 호출 없음** — 한 번의 `runUnevaluatedFill()` 이 `begin` 을 2 회 이상 부르지 않는다 (동시 N 건 카운터 오염 차단). ③ **순서 불변식** — `end` 는 위임 (`unevaluatedFillRunOrchestrator.run`) 이 끝난 뒤에 불린다 (위임 mock 안에서 `endSpy` 미호출 확인 또는 `mock.invocationCallOrder` 비교) — `return await` 누락 회귀를 잡는 게이트. ④ **`begin` 선행** — 위임 mock 안에서 `beginSpy` 가 이미 1 회 호출된 상태다 (실행 구간이 위임을 실제로 덮는다). ⑤ **fail-fast 구간도 덮인다** — resolver reject 로 orchestrator 가 **호출조차 되지 않은** 경로에서 `beginSpy` 1 회 · `endSpy` 1 회 (즉 resolver 구간이 실행 상태 안에 포함되고 조기 return 으로 stuck 되지 않음). ⑥ **dry-run 미배선 보존** — `@Post("unevaluated-fill-plan")` 경로는 여전히 `begin`/`end` 를 호출하지 않는다.
- [ ] `pnpm lint` warning 0 · `pnpm build` 성공 · `pnpm test` 전체 green.
- [ ] `pnpm test:cov` 통과 — coverage line ≥ 80% / function ≥ 80% 임계 유지 (`package.json` 의 `coverageThreshold.global`).
- [ ] `BASE_REF=origin/main scripts/check-spec-presence.sh` 통과 (신규 production 파일 0 — 기존 colocated spec 수정뿐).
- [ ] `git diff --stat origin/main` 상 변경 파일이 `src/assessment-evaluation/` **2 개뿐** 이다 — `src/run-status/` · `assessment-evaluation.module.ts` · `prisma/schema.prisma` · `package.json` · lockfile · `.github/workflows/` 변경 **0**.

## Out of Scope

- **`@Post("unevaluated-fill-plan")` 배선** — dry-run 이라 ADR-0060 `§Decision 4` `144~146 행` 이 명시적으로 영구 제외. 본 task 는 이 handler 를 **수정하지 않으며** 미호출을 test 로 계속 고정만 한다.
- **`@Post("evaluate")` · `@Post("period")` 재작업** — T-1842 / T-1843 이 이미 닫았다. 그 handler 는 손대지 않는다 (본 task 의 controller diff 에 나타나면 안 된다). spec 쪽은 `1017~1029 행` negative (6) 의 **계약 전환 갱신만** 허용된다.
- **수집 축 배선** ((c) — `assessment-collection.controller.ts` `54 행`) · **조회 route + `AppModule` 등록** ((b)) · **e2e** ((d)) · **web polling** ((e)) · **doc-sync 와 REQ-083 재판정** ((f)) — 전부 [ADR-0060](../decisions/ADR-0060-evaluation-run-status-endpoint.md) `§Follow-ups` `270~294 행` 몫.
- **`src/run-status/` 파일 수정** — service 계약은 T-1841 에서 확정됐다. 배선 중 계약 변경이 필요해 보이면 고치지 말고 `## Follow-ups` 에 적는다.
- **503 매핑 정책 자체의 변경** — status code · 메시지 · `cause` 전파 · resolver 를 위임보다 먼저 두는 fail-fast 순서는 ADR-0048 `§Decision 1·2` 결정이다. 본 task 에서 재논의하지 않는다.
- **`prisma/schema.prisma` 변경 · migration · 새 dependency** — 본 배선은 기존 DI 조립뿐이라 어느 쪽도 필요 없다. 필요하다고 판단되면 즉시 중단하고 `BLOCKED` → notifier ([CLAUDE.md](../../CLAUDE.md) `§5`).
- **[requirements.md](../requirements.md) `102 행` REQ-083 status 재판정 · [PLAN.md](../PLAN.md) `133 행` ④ 마커** — 전부 (f) 몫 ([CLAUDE.md](../../CLAUDE.md) `§3.1` 규칙 6 — 구현 머지 후 1 회).

## Suggested Sub-agents

`implementer → tester`

(architect 불요 — ADR-0060 `§Decision 4` 가 전이 시점·진입점 목록·예외 경로 계약을 확정했고 T-1842 / T-1843 이 같은 controller 안에 복제 대상 shape 을 두 번 박제했다. 본 task 는 배선 집행만 한다.)

## Follow-ups

(생성 시점 비어 있음 — sub-agent 가 관련 작업을 발견하면 여기에 append.)
