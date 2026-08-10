---
id: T-1559
title: ADR — perf 체크인 baseline 정책 (저장 위치 · 갱신 주체 · 회귀 시 CI fail 여부 · CI 편입 방식)
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-048, REQ-047]
estimatedDiff: 210
estimatedFiles: 1
created: 2026-08-10
createdAt: 2026-08-10T21:38:00Z
independentStream: perf-baseline-checkin-adr
dependsOn: [T-1558]
touchesFiles:
  - docs/decisions/ADR-0056-perf-baseline-checkin-ci.md
plannerNote: "P5 성능 검증 bullet — slice 29 까지 3 연속 follow-up 이 planner 로 이월한 '체크인 baseline + CI 편입' 축의 ADR-우선 첫 step (doc-only ADR × 1.6)"
---

# T-1559 — ADR: perf 체크인 baseline 정책 (저장 위치 · 갱신 주체 · 회귀 판정 · CI 편입)

## Why

[PLAN.md](../PLAN.md) `140 행` 의 성능 검증 bullet(REQ-048) 은 아직 `[ ]` 이고, 그 잔여 4 축 중
**baseline 확정 축** 은 slice 25 ~ 29 로 route 5 개(`GET /api/summaries` · `/api/assessments` ·
`/api/contributions` · `/api` · `/api/persons`)를 태웠다. 그러나 **다섯 baseline 이 전부 임시 디렉토리
1 회성** 이라 축은 소진되지 않았다 — [test/perf/README.md](../../test/perf/README.md) `1132~1150 행` 이
적시하듯 **체크인 기준 baseline([부하계획](../ops/load-resilience-test-plan.md) `§ 5` #5) · CI job
편입(`§ 5` #4) · 임계 fix** 는 전부 미착수다.

그 축에 route 를 한 개 더 얹는 대신 **결정을 먼저 박제** 하는 것이 본 task 다. 근거는 세 가지다.

- **3 연속 follow-up 이 planner 로 이월** — T-1555 → T-1557 → T-1558 의 Follow-ups 가 동일하게
  "체크인 baseline + CI job 편입 축은 workflow 편집 + 체크인 JSON + 임계 fix + flaky 정책이 한 덩어리라
  cap(300 LOC / 5 파일) 을 넘는다. 진입 전 **ADR 1 개** 로 결정을 먼저 박제할 것" 으로 판정했고,
  T-1558 은 명시적으로 "본 task 는 결론 0 — planner 몫" 이라고 적었다. 본 task 가 그 판정의 집행이다.
- **[CLAUDE.md §1](../../CLAUDE.md) "코드보다 ADR 이 먼저"** — 체크인 baseline 은 저장 위치 · 갱신
  주체 · 회귀 시 CI 색(red/green) 이 서로 얽힌 결정이고, 잘못 고르면 main CI 를 wall-clock 노이즈로
  상시 red 로 만들거나(과잉) 회귀를 영원히 못 잡는다(과소). 구현 slice 가 이 판단을 매번 재추론하지
  않도록 [ADR-0054](../decisions/ADR-0054-load-resilience-harness-tool.md) 와 동형으로 1 회 박제한다.
- **slice 반복의 한계 수익** — 재분류 0 인 slice 가 **7 연속** 이라(T-1546 → T-1558 이월 note) 새 route
  를 얹어도 계수 2 종만 늘고 인벤토리 (A)30/(B)0/(C)0 는 불변이다. 축을 여는 결정이 더 큰 진전이다.

본 task 는 **결정 전용(코드 0 LOC)** 이다. 실제 baseline JSON 체크인 · `ci.yml` 편집 · 임계 수치
확정은 전부 본 ADR 의 §Follow-ups 로 이월한다.

## Required Reading

- [docs/ops/load-resilience-test-plan.md](../ops/load-resilience-test-plan.md) — `§ 3` 측정 지표·임계
  표(특히 "baseline 후 fix" 표기가 붙은 행: S1 error rate · S2 p50/throughput · S3 error rate) 와
  `§ 5` follow-up #4(CI 통합 — "상시 PR CI 와 분리(부하는 무거움)") · #5(baseline 확정 + 임계 fix).
  본 ADR 이 결정할 대상의 정본. **수정 금지**(doc-sync 는 별도 direct task).
- [test/perf/latency-baseline.ts](../../test/perf/latency-baseline.ts) — `BaselineEnvMeta`
  (`label` · `concurrency` 필수, `cpu`/`memoryMb`/`dataScale` optional) · `BaselineReport`
  (p50/p95/p99/throughput/errorRate/count/pass) 형태와 `resolveBaselinePath` 경로 규약.
  **저장 위치 결정은 이 기존 규약에 위임** 하고 재정의하지 않는다. **수정 금지**.
- [test/perf/latency-baseline-io.ts](../../test/perf/latency-baseline-io.ts) — `writeBaselineFile` ·
  `readBaselineFile` · `readCompareBaselineFile` · `compareBaselineFiles` · `baselineFileExists` ·
  `ConfirmOrCompareResult` 판별 union · `confirmOrCompareBaseline`. 회귀 판정이 이미 어떤 primitive
  로 계산되는지(= 본 ADR 은 판정 **로직** 이 아니라 판정 **결과의 CI 취급** 을 결정) 확인용. **수정 금지**.
- [.github/workflows/ci.yml](../../.github/workflows/ci.yml) `234 행` 부근 `perf test` step
  (`pnpm test:perf`, 기본 검사 job 안, `services.postgres` 위) — 현행 편입 상태. 별도 job 신설이냐
  기존 step 재사용이냐의 출발점. **수정 금지**.
- [docs/decisions/ADR-0054-load-resilience-harness-tool.md](../decisions/ADR-0054-load-resilience-harness-tool.md)
  — 절 구성 mirror 대상(frontmatter / Status / Context / Decision / Consequences / Alternatives
  considered / Out of scope / References / Follow-ups) + 같은 계획 문서(`§ 5`) 를 상류로 삼는 선례.
- [test/perf/README.md](../../test/perf/README.md) `1132~1150 행` (잔여 절) — 4 잔여 축의 현 서술과
  "다섯 baseline 모두 임시 디렉토리 1 회성" 문구. 인용 근거. **수정 금지**.

## Acceptance Criteria

- [ ] `docs/decisions/ADR-0056-perf-baseline-checkin-ci.md` 신설. frontmatter 는 ADR-0054 와 동형
      (`id: ADR-0056`, `title`, `status`, `date: 2026-08-10`, `relatedTask: [T-1559]`,
      `relatedReq: [REQ-048, REQ-047]`, `supersedes: null`) + 절 구성 동형(Status / Context /
      Decision / Consequences / Alternatives considered / Out of scope / References / Follow-ups).
- [ ] **§Decision 1 — 체크인 baseline 저장 위치**: repo 안 확정 경로를 1 개로 못 박는다. 파일명·경로
      규칙은 **기존 `resolveBaselinePath(env, baseDir)` 규약에 전적으로 위임**(재구현·재정의 0)하고
      본 ADR 은 `baseDir` 값 하나만 결정함을 명시. `env.label` 이 파일명 slug 축이므로 **환경별로 파일이
      갈린다**(예: CI runner label vs 로컬 label)는 귀결을 함께 박제.
- [ ] **§Decision 2 — 갱신 주체**: 체크인 baseline 파일을 **누가 언제** 갱신하는지 박제. CI 가 main 에
      자동 commit 하는 방식은 [CLAUDE.md §9](../../CLAUDE.md)(단일 writer · force push 금지) 정신과
      충돌함을 근거로 **비채택 권고** 하고, 명시적 pr-mode task 로만 갱신하는 안을 default 로 결정.
      "언제 갱신이 정당한가"(의도적 성능 변화 · 환경 교체 등) 조건도 1 구절로 명시.
- [ ] **§Decision 3 — 회귀 판정 시 CI fail 여부**: 두 판정을 **분리** 해 결정한다 — (a) **절대 임계**
      (REQ-048 p95 < 3000ms · error rate < 1%) 위반은 CI fail(red), (b) **baseline 대비 상대 회귀**
      (`compareBaselineFiles` 의 회귀 판정) 는 초기에 fail 로 승격할지 관찰(비-fail) 로 둘지. 공유 runner
      wall-clock 비결정성으로 인한 **flaky red 위험** 을 근거로 채택안을 정하고, 관찰 → fail 승격의
      **정량 조건**(예: 연속 N run 안정 관측)을 함께 박제.
- [ ] **§Decision 4 — CI 편입 방식**: 부하계획 `§ 5` #4 의 "상시 PR CI 와 분리" 권고를 받아, 기존
      `perf test` step 재사용 · 별도 job 신설 · schedule/manual trigger 분리 중 채택안을 1 개로 결정하고
      나머지는 §Alternatives 로 내린다. 채택안이 **매 PR 의 CI 소요시간에 미치는 영향** 을 1 구절로 명시.
- [ ] **§Decision 5 — 임계 fix 절차**: 부하계획 `§ 3` 의 "baseline 후 fix" 표기 행(S1 error rate ·
      S2 p50/throughput · S3 error rate)을 **관찰 지표 → 확정 pass 임계** 로 승격하는 절차와 그때
      부하계획 `§ 3` 표를 갱신하는 주체를 박제. over-fitting 방지 장치(단일 run 으로 임계를 고정하지
      않는다)를 명시.
- [ ] **§Consequences** 에 부정적 귀결 2+ 를 명시 — 최소 (a) 환경별 baseline 파일 분기로 인한 관리
      대상 증가, (b) 상대 회귀를 비-fail 로 두면 회귀 탐지가 사람 판독에 의존하게 되는 잔여 위험.
- [ ] **§Alternatives considered** 에 미채택 2+ 안을 근거와 함께 박제(예: CI 자동 commit 으로 baseline
      갱신 / 절대·상대 판정을 하나로 합쳐 무조건 CI fail / baseline 을 repo 밖 아티팩트 저장소에 보관).
- [ ] **§Follow-ups** 에 후속 slice 를 dependency-free 로 나열: (a) 체크인 baseline JSON 최초 생성·
      commit, (b) `ci.yml` 편입(채택 방식대로), (c) 부하계획 `§ 3` 임계 fix 갱신, (d) PLAN `142 행` ·
      REQ-048 doc-sync. 각 항목에 ≤300 LOC / ≤5 파일 + R-112 준수 의무를 1 구절로 병기.
- [ ] **완료 선언 0** — 본 ADR 은 PLAN `140 행` 을 `[x]` 로 바꾸지 않고 REQ-048 을 `IN_PROGRESS` 밖으로
      옮기지 않는다. ADR 본문에 "본 ADR 은 결정만 박제하며 잔여 4 축은 그대로 존속" 1 구절 포함.
- [ ] **§12 범위 표기 규약 준수** — 행 범위 인용은 물결 `~` 하나(`1132~1150 행`), 단일 행은 `140 행`,
      `L` prefix 금지. ADR 은 규약 적용 5 문서군에 속한다.
- [ ] `src/` · `test/` · `.github/workflows/` · `package.json` 변경 **0** (결정 전용). 신규 public
      symbol 신설 0 · 분기 0 이므로 **R-112 의 happy-path / error path / 분기 / negative test 4 항목은
      본 doc-only ADR 에 미적용** — 그 사실을 task Result 에 명시한다.
- [ ] `tester` 가 **R-110 검증** 수행: `pnpm lint && pnpm build && pnpm test` 를 실행해 회귀 0 확인
      (코드 변경 0 이어도 pr-mode 는 tester 호출 의무). 기존 coverage 게이트(line ≥ 80% /
      function ≥ 80%) 가 본 변경으로 흔들리지 않음을 함께 확인.

## Out of Scope

- **체크인 baseline JSON 파일의 실제 생성·commit** — 저장 위치 결정만 하고 파일은 만들지 않는다.
- **`.github/workflows/ci.yml` 편집** — 편입 *방식* 만 결정하고 workflow 는 건드리지 않는다
  (CI 변경은 `pr` mode 별도 task).
- **`test/perf/latency-*.ts` 및 기존 perf-spec 수정** — 판정 primitive 는 이미 존재하므로 재구현 0.
  새 perf-spec(slice 30) 도 만들지 않는다.
- **부하계획 `§ 3` 임계 수치의 실제 확정 · `§ 5` item 4/5 본문 갱신 · PLAN `142 행` · REQ-048 재판정** —
  전부 별도 `direct` doc-sync task 로 이월([CLAUDE.md §3.1](../../CLAUDE.md) rule 3, direct·pr mixed 금지).
- **신규 dependency 추가**(k6 등) — ADR-0054 소관이며 [CLAUDE.md §5](../../CLAUDE.md) HITL 게이트 대상.
- **REQ-047 실 scale 부하 · web 렌더 측정 축** — 본 ADR 은 S2 조회 baseline 축만 다룬다(REQ-047 은
  임계 fix 절차 서술에서만 참조).
- **mock perf-spec 30 개의 retire 판단** — T-1536 유보 축 그대로.

## Suggested Sub-agents

`architect → tester`

## Follow-ups

(생성 시점 비어 있음 — sub-agent 가 관련 작업을 발견하면 여기에 추가한다.)
