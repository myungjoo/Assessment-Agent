---
id: T-0884
title: summary-measure-confirm perf-spec 의 compared happy-path 를 주입 clock 으로 결정론화(잔존 wall-clock flake 제거)
phase: P5
status: DONE
completedAt: 2026-07-10T13:49:52Z
mergedAs: 9f71888c
prNumber: 778
reviewRounds: 1
commitMode: pr
coversReq: [REQ-048]
estimatedDiff: 15
estimatedFiles: 1
created: 2026-07-10
dependsOn: []
touchesFiles: [test/perf/summary-measure-confirm.perf-spec.ts]
independentStream: s2-latency-harness
plannerNote: "P8 load-resilience §5 #2 — T-0880 summary compared happy-path(:259)가 주입 clock 없이 실 wall-clock 2회 실측해 regressed=true flake(T-0882 nit-push 때 1회 재현). T-0881 app-root 선례대로 stepClock 주입해 결정론화; test-hardening, src 0 LOC"
---

# T-0884 — summary-measure-confirm perf-spec compared happy-path 결정론화

## Why

P8 load-resilience 계획 §5 #2(S2 조회 latency harness / REQ-048)의 두 번째 통합 배선인 T-0880(`test/perf/summary-measure-confirm.perf-spec.ts`) 의 **compared happy-path 테스트 (b)** (현재 237~265행)가 `measureAndConfirmBaseline` 을 주입 clock 없이 실 wall-clock 로 두 번 실측한다. 그래서 259행의 `expect(second.comparison.regressed).toBe(false)` 단언이 시스템 부하 상승 시 2차 실측이 1차보다 느려지면 `regressed=true` 로 튀는 **비결정적(flake)** 이다 — T-0882 nit-push CI 때 실제로 1회 재현돼 rerun 으로만 green 이 됐다(journal 2026-07-10 T-0882 항목).

이는 직전 T-0881 이 `app-root-measure-confirm.perf-spec.ts` 의 동형 compared happy-path 에 `now: stepClock(50)` 을 주입해 이미 해소한 flake 와 **정확히 같은 class** 의 잔존분이다. 본 task 는 그 검증된 관용구를 summary spec 의 test (b) 에 그대로 적용해 CI perf 게이트의 마지막 wall-clock 비결정성을 제거한다. 신규 make-work 가 아니라 실 간헐 CI 실패를 막는 test-hardening 이다.

## Required Reading

- `test/perf/summary-measure-confirm.perf-spec.ts` — 수정 대상. **compared happy-path (b)** (현재 237~265행)가 `readRequest()` 를 `{ measure: { iterations: 3 } }` 로만 태워 `now` 미주입. `stepClock` 헬퍼는 이미 이 파일 192행에 정의돼 있고 flow/negative 테스트(391·399·412·420·494·502·533·542행)에서 사용 중 — test (b) 만 누락. `readRequest` 는 factory(168행, `readRequest()` 호출 시 `RequestFn` 반환)임에 유의(app-root 는 `readRequest` 직접형이라 호출 형태가 다름).
- `test/perf/app-root-measure-confirm.perf-spec.ts` — **미러할 T-0881 선례**(현재 198~230행 compared happy-path). 1차·2차 measure 에 동일 `now: stepClock(stepMs)`(stepMs=50) 주입 → 두 실측이 동일 합성 latency 표본을 보게 해 `regressed=false` 결정론화. 본 task 는 이 구조를 summary 의 `readRequest()` factory 형태에 맞게 이식.
- `test/perf/latency-collector.ts` — `measureAndConfirmBaseline` / `MeasureBaselineOpts.now`(주입 monotonic clock) 시그니처 확인(호출만, 수정 금지).

## Acceptance Criteria

- [ ] `summary-measure-confirm.perf-spec.ts` 의 compared happy-path 테스트 (b) 의 **1차·2차 `measureAndConfirmBaseline` 호출 모두**에 `measure.now: stepClock(stepMs)`(동일 stepMs, 예: 50) 를 주입 — 두 실측이 동일 합성 latency 표본을 보게 해 `regressed=false` 가 wall-clock 부하와 무관하게 결정론적으로 성립. app-root 선례(198~230행)의 주석 근거도 요약 반영.
- [ ] **Happy-path 유지**: test (b) 는 여전히 established(1차)→compared(2차) 양분기 도달, `second.outcome==="compared"`, `second.comparison.regressed===false`, `second.comparison.errorRate.regressed===false`, `report` 에 `regressed=false` 포함, `req` 가 `iterations` 회 호출됨을 검증(기존 단언 보존, clock 주입만 추가).
- [ ] **결정론 재현 검증(regression 방지 증거)**: `pnpm test:perf` 를 **연속 2회 이상** 실행해 summary compared 단언이 매번 green(flake 0). injected-clock 로 `regressed=false` 가 부하 무관 결정론임을 입증 — 필요 시 증거를 `docs/progress/details/T-0884-determinism-evidence.md` 로 외화하고 경로만 trail 에 기록.
- [ ] **Flow / branch coverage**: 회귀-검출(regressed=true) 분기는 기존 flow(적정 tolerance 좁힘)·negative(tolerance:0) 테스트가 `stepClock` 주입으로 이미 커버 중임을 확인 — 본 task 는 무회귀 분기의 결정론화만 추가하며 **신규 분기 없음**(이 항목은 신규 분기 부재로 추가 test 불요, 기존 커버 유지 확인만).
- [ ] **Negative cases 무회귀**: error path(측정 예외 부작용 0·파일 미생성)·personId 부재 실 400 established write·회귀 검출 negative 등 기존 테스트가 전부 green 유지(clock 주입이 이 경로들에 영향 0).
- [ ] `pnpm test:perf` 통과 — 신규 spec suite 증감 없이 전체 perf 스위트 green(count>0, empty-suite 가드 T-0879 유지).
- [ ] 전체 게이트 통과 — `pnpm lint && pnpm build && pnpm test:cov` green. src/ 변경 0 이므로 `test:cov`(line ≥ 80% / function ≥ 80%) 무회귀(perf-spec 자체는 `collectCoverageFrom=src/**` 라 미계측, pre-existing).

## Out of Scope

- `latency-collector.ts` / `latency-baseline.ts` / `latency-baseline-io.ts` 등 collector·io·baseline 모듈 `.ts` 재수정 — 호출·import 만.
- 다른 perf-spec(app-root/assessment/contribution) 의 재수정 — app-root 는 T-0881 로 이미 결정론화, assessment(T-0882)·contribution(T-0883)은 생성 시부터 stepClock 결정론. 본 task 는 summary spec 의 test (b) 1곳만.
- 새 endpoint 배선 / 조직-구조 read(person/group/part/export/user) 의 measure-confirm 배선 — T-0883 정직성 note 대로 make-work 이므로 금지.
- 실 baseline JSON repo 체크인(§5 #5 threshold fix) / S1·S3 부하 harness(§5 #3, k6 owner 승인 gated) / 실 Postgres·Prisma·LLM round-trip.

## Suggested Sub-agents

`implementer → tester` (신규 production symbol 0 — 기존 perf-spec 의 test (b) 에 이미 정의된 `stepClock` 헬퍼 주입만. architect 불요).

## Follow-ups

- 본 task 로 S2 measure-confirm perf-spec 4종(app-root·summary·assessment·contribution)의 compared happy-path 가 전부 injected-clock 결정론이 된다 → CI perf 게이트의 wall-clock flake vein 소진.
- 이후 genuine 방향은 전부 gated(T-0883 Follow-ups 참조): §5 #3 k6/artillery 부하 harness(owner 승인 gated, ADR-0054 PROPOSED) / §5 #5 baseline 실측 확정(고정 CPU/DB/네트워크 실측 환경 필요) / P6 frontend(React+Vite). 다음 planner 는 make-work 대신 `STATE.humanQuestions` 로 "다음 우선순위 결정(k6 도입 승인 / 실측 환경 확보 / P6 착수 중 택)" escalation 을 우선한다.
