---
id: T-1669
title: S1 부하 10 회차 실측 + T-1668 재확정 규칙 첫 기계 적용
phase: P5
status: DONE
commitMode: direct
coversReq: [REQ-047]
estimatedDiff: 70
estimatedFiles: 2
independentStream: load-k6-s1-baseline
dependsOn: [T-1668]
touchesFiles:
  - docs/ops/load-resilience-test-plan.md
  - docs/PLAN.md
created: 2026-08-24
plannerNote: P5 R-91 chain 50/N — T-1668 이 사전 박제한 재확정 규칙을 10 회차 표본에 처음 기계 적용 (실측 1 회 dispatch, 임계 상수 변경 0)
---

# T-1669 — S1 부하 10 회차 실측 + T-1668 재확정 규칙 첫 기계 적용

## Why

[T-1668](T-1668-s1-stub-baseline-gate-refix-rule.md) 은 `p(95)<900` stub baseline 게이트의 재확정 트리거·산정식·표본 취급·집행 경로 4 항목을 **다음 표본을 보기 전에** 박제했고, 그 Out of Scope 는 "10 회차 실측은 본 규칙 박제 **이후** 별도 slice 에서 수행한다" 로 본 slice 를 예고했다. 실 scale 표본 6 개의 평균 + 3σ 가 **886.00ms** 로 900ms 까지 여유가 **14.01ms** 뿐이라, 7 번째 표본 하나가 트리거 ①-(b) 를 넘길지가 본 회차의 1 순위 관측 대상이다. 본 slice 는 오너 지시(PLAN `144 행` "R-91 k6 최우선·즉시 착수") chain 50/N 로, `load-k6.yml` 을 `-f s1_persons=133` 으로 **정확히 1 회** dispatch 해 수치를 회수하고, 회수한 표본을 T-1668 규칙에 **대입만** 해 상향 여부를 기계적으로 판정·박제한다 (사후 정당화 여지 0).

## Required Reading

- [docs/ops/load-resilience-test-plan.md](../ops/load-resilience-test-plan.md) `§3` 의 **"S1 관찰용 p95 게이트 재확정 규칙 (사전 박제, T-1668)"** 소절(`127 행` 부터) — 본 slice 가 대입할 ① 트리거 ② 산정식 ③ 표본 취급 ④ 집행 경로 4 항목의 정본. **이 소절 자체는 편집하지 않는다.**
- [docs/ops/load-resilience-test-plan.md](../ops/load-resilience-test-plan.md) `156 행` `### 3.1 baseline 실측 기록 (S1, 9 회분)` 헤더와 `481 행` 부터의 `#### 9 회차 (T-1667, run 32677333740, ...)` 소절 전체 — 헤더 회분 수를 올릴 자리이자, 10 회차 소절이 따라야 할 항목 구성(측정 일시/run · 표본 로그 원문 · seed step 결과 · THRESHOLDS 원문 · 수치 · 환경 메타 · 의미/한계)의 서식 본보기.
- [docs/tasks/T-1668-s1-stub-baseline-gate-refix-rule.md](T-1668-s1-stub-baseline-gate-refix-rule.md) `## Out of Scope` — 본 slice 가 승계하는 예고(10 회차 실측은 규칙 박제 이후 별도 slice).
- [docs/tasks/T-1667-load-k6-sample-log-rerun.md](T-1667-load-k6-sample-log-rerun.md) — 직전 회차의 dispatch 절차(`gh workflow run load-k6.yml --ref main -f s1_persons=133` 1 회 한정) 와 로그 회수 방식(`gh run view <id> --log`) 선례.
- [docs/PLAN.md](../PLAN.md) `140~141 행` — R-91 checkbox 와 실측 이력 꼬리(본 slice 가 1~3 문장 append 할 자리).

## Acceptance Criteria

- [ ] `gh workflow run load-k6.yml --ref main -f s1_persons=133` 을 **정확히 1 회** 실행하고, 그 run 의 conclusion 이 나올 때까지 기다려 결과를 확인한다. **재 dispatch·재시도 0** — fail 이어도 다시 쏘지 않고 실패 원인만 박제한다(7 회차 선례).
- [ ] [docs/ops/load-resilience-test-plan.md](../ops/load-resilience-test-plan.md) `§3.1` 에 `#### 10 회차 (T-1669, run <id>, ...)` 소절을 신설하고 9 회차 소절과 **같은 항목 구성**으로 다음을 모두 박제한다. 인용은 `gh run view --log` 원문 그대로이며 추정치·재계산 0, 자격증명·cookie·email 원문은 인용 금지.
  - [ ] **측정 일시 / run** — dispatch 시각(UTC) · run id · head sha · job 소요 · conclusion · step 성공/skip 수.
  - [ ] **표본 로그 원문** — `[s1-batch] devset 표본 취득 N명 / 요청 M명` 줄을 그대로 인용하고 `N == M == 133` 여부를 판정한다(T-1666 배선의 **연속 2 회** 회수 여부).
  - [ ] **seed step 결과** — `devset seed 완료 — person N 건 / serviceIdentity M 건 적재` 원문 인용 + T-1664 fix 의 **연속 3 회 성공** 여부 판정.
  - [ ] **k6 THRESHOLDS 원문** — `http_req_duration{route:batch}` 임계가 **2 개**(`p(95)<3600000` · `p(95)<900`)로 등장하는지, 각각 `✓` 인지 `✗` 인지 원문 그대로.
  - [ ] **수치** — batch p95 · `http_req_failed` · `http_reqs` · `iteration_duration`. `http_reqs` 가 7(합성 생성 왕복 0) 을 유지하는지 함께 판정.
  - [ ] **환경 메타 7 항목**이 3~9 회차와 동일한지(조건 일치 여부) 1 문장.
- [ ] 같은 소절에 **T-1668 규칙 기계 적용** 결과를 박제한다 — 규칙 ②·③ 을 그대로 따르며 새 산정식을 발명하지 않는다.
  - [ ] 실 scale(표본 133) 회차 **전량**의 batch p95 목록을 나열하고(본 회차 포함 7 개, 표본 10 회차인 1·2 회차는 **혼합 금지**), 평균 · 표본표준편차 · **평균 + 3σ** · 100ms 올림 전/후 값을 함께 적는다. outlier 제거 0.
  - [ ] 트리거 판정을 한 줄로 명시한다 — ①-(a) 실 run 에서 `p(95)<900` 이 `✗` 인가, ①-(b) 평균 + 3σ 가 900ms 를 초과하는가. **둘 다 아니면 "임계 무변경"** 으로 결론하고 여유(ms)만 갱신한다.
  - [ ] 트리거가 **충족된 경우**에도 본 slice 는 숫자를 **산출·박제만** 하고 `§3` 표의 `900ms` · 코드 상수는 손대지 않는다 — 규칙 ④ 에 따라 (i) 코드 `pr` (ii) doc `direct` **2 task split** 을 `## Follow-ups` 에 구체적으로 적어 넘긴다. 하향은 어떤 경우에도 하지 않는다(규칙 ③).
- [ ] `§3.1` 헤더 `(S1, 9 회분)` 를 `(S1, 10 회분)` 으로 갱신한다.
- [ ] [docs/PLAN.md](../PLAN.md) `141 행` 꼬리에 1~3 문장 append — 10 회차 run id · conclusion · batch p95 · 규칙 첫 적용 결과(트리거 충족 여부와 임계 처리)를 적는다. **`140 행` checkbox `[ ]` 는 무변경**(LLM stub · 실 수집 왕복 0 · 단일 iteration 조건 그대로).
- [ ] **코드 · 워크플로 · spec · 임계 상수 변경 0** — `test/load/s1-batch.js` 의 `STUB_BASELINE_P95_MS` · `load-workflow-k6-harness-wiring-drift.smoke-spec.ts` 의 `S1_STUB_BASELINE_P95_MS` · `.github/workflows/load-k6.yml` 모두 무변경.
- [ ] `pnpm test` green — 특히 `load-workflow-k6-harness-wiring-drift.smoke-spec.ts` 와 `realdata-devset-logins-doc-consistency.spec.ts` 통과(코드·상수 무변경 확인).
- [ ] 변경 파일 **2 개**(`load-resilience-test-plan.md` · `PLAN.md`) 유지. 3 번째 파일이 필요하다고 판단되면 Follow-ups 로 넘긴다. doc-only direct 라 PR · reviewer 미경유(§3.1).

## Out of Scope

- **재 dispatch·복수 회차 측정** — 1 회 한정. run 이 fail 이면 원인 박제로 끝내고 fix 는 별도 pr-mode slice(7 회차 → T-1664 선례).
- **임계 숫자의 실제 상향 집행** — 트리거가 충족되더라도 규칙 ④ 의 2 task split 로 넘긴다(코드 `pr` + doc `direct`). 본 slice 에서 합치지 않는다.
- **코드 · spec · workflow 편집 0** — `test/load/*.js` · `test/smoke/*.ts` · `.github/workflows/load-k6.yml` · `package.json` 수정 금지(수정 순간 `commitMode` 가 갈린다, §3.1).
- `§3` 재확정 규칙 소절 자체의 개정 — 첫 적용에서 규칙 미비가 보이면 고치지 말고 Follow-ups 로.
- S2 · S3 축 실측 및 `baseline 후 fix` 표기 손대기 — 해당 축 실측 0 회.
- [docs/ops/realdata-scale-devset.md](../ops/realdata-scale-devset.md) 편집 — `§A`/`§B` 표는 drift guard 파싱 대상.
- **실 수집 왕복 축**(GitHub/Confluence 자격증명 주입) — CLAUDE.md §5 BLOCKED 사유(외부 자격증명)라 오너 결정 선행. T-1667 Follow-up 2 승계.
- `deploy/daily-test.sh` leg 추가 — drift-guard smoke 3 종 동반으로 5 파일 cap 초과(T-1122 / Q-0054 선례).

## Suggested Sub-agents

`implementer` (dispatch + 로그 회수 + 문서 반영) → `tester` (`pnpm test` green · 상수 무변경 확인)

## Follow-ups

(작성 시점 비어 있음 — sub-agent 가 관련 작업을 발견하면 여기에 append)

## 결과 (2026-08-24T05:50Z DONE)

- main direct commit `0a6f0a08` — 2 파일 `+57/-2`(`docs/ops/load-resilience-test-plan.md` · `docs/PLAN.md`).
- **dispatch 는 정확히 1 회** — run **32690756666**(`workflow_dispatch`, ref `main`, head sha `cd411817`, 04:38:21Z, job 약 2분 22초, conclusion **success**, step 21 개 전부 success · skipped 0). 직전 fire(`cron@AKIHA-cd4118171082`)가 이 dispatch 를 수행한 뒤 로그 회수·박제 전에 죽어 claim 이 60분 TTL 초과 orphan 으로 남았고, 본 fire 가 회수·재 claim 해 **재 dispatch 0 으로 로그만 회수**해 마무리했다(AC "재 dispatch·재시도 0" 준수).
- `§3.1` 에 `#### 10 회차` 소절 신설 — 측정 일시/run · 표본 로그 원문(`devset 표본 취득 133명 / 요청 133명` → `N == M == 133` 일치, T-1666 배선 **연속 2 회** 회수) · seed step 결과(T-1664 fix **연속 3 회** 성공) · THRESHOLDS 원문(`p(95)<3600000` · `p(95)<900` 2 개 모두 `✓`) · 수치(batch p95 **743.96ms** · `http_req_failed` 0% · `http_reqs` **7** 유지 · `iteration_duration` 745.12ms) · 환경 메타 7 항목 3~9 회차와 전부 동일. `§3.1` 헤더 `(S1, 9 회분)` → `(S1, 10 회분)`.
- **T-1668 재확정 규칙 첫 기계 적용 — 임계 무변경**: 실 scale(133) 회차 전량 7 개(760.91 · 730.81 · 711.23 · 792.27 · 757.65 · 824.71 · 743.96) 를 outlier 제거 0 · 표본 10 회차 혼합 0 으로 대입 → 평균 **760.22ms** · 표본표준편차 **38.13ms** · **평균+3σ = 874.60ms** · 100ms 올림 후 **900ms**(현 임계와 동일). 트리거 ①-(a) 미충족(실 run `p(95)<900` 이 `✓`) · ①-(b) 미충족(874.60 < 900) → 규칙 ④ 의 2 task split **불요**, 하향도 하지 않음(규칙 ③). 평균+3σ 여유는 9 회차 14.01ms → **25.40ms** 로 넓어졌다(σ 41.02 → 38.13).
- **코드 · 워크플로 · spec · 임계 상수 변경 0** — `s1-batch.js` `STUB_BASELINE_P95_MS` · smoke spec `S1_STUB_BASELINE_P95_MS` · `load-k6.yml` 모두 무변경. `docs/PLAN.md` `141 행` 꼬리만 append 하고 `140 행` checkbox 는 `[ ]` 유지(LLM stub · 실 수집 왕복 0 · 단일 iteration 조건 그대로).
- 검증: `pnpm test` 452/453 suite pass(12949 test, fail 0 — `summary-batch` 1 건은 worker SIGTERM 환경 이슈로 단독 재실행 45 pass), 대상 2 spec(`load-workflow-k6-harness-wiring-drift` · `realdata-devset-logins-doc-consistency`) 통과, `pnpm lint` · `pnpm build` exit 0. 정식 검증은 main CI run `32695026265`.
