---
id: T-1674
title: S2 조회 부하 첫 실측 dispatch + §3.1 회차 기록
phase: P5
status: DONE
completedAt: 2026-08-24T15:56:00Z
commitMode: direct
coversReq: [REQ-048]
estimatedDiff: 100
estimatedFiles: 2
independentStream: load-k6-s2-baseline
dependsOn: [T-1672, T-1673]
touchesFiles:
  - docs/ops/load-resilience-test-plan.md
  - docs/PLAN.md
created: 2026-08-24
plannerNote: P5 R-91 chain 55/N — T-1671 설계 ⑥ 이 예고한 세 번째 task (S2 첫 실측 1 회 dispatch + 회차 기록, 임계·코드 변경 0)
---

# T-1674 — S2 조회 부하 첫 실측 dispatch + §3.1 회차 기록

## Why

[T-1671](T-1671-s2-devset-dataset-swap-design.md) 이 박제한 `#### S2 dataset 교체 설계 (사전 박제)` ⑥ 은 집행 경로를 3 개로 나눴고, 그 중 1 번(`pr` 교체 집행)은 [T-1672](T-1672-s2-devset-dataset-swap-exec.md)(PR #1333 → main `27953b24`), 2 번(`direct` 문서 반영)은 [T-1673](T-1673-s2-devset-dataset-swap-doc-sync.md) 로 닫혔다. 남은 것이 설계 ⑥ 말미가 예고한 **세 번째 task — "S2 첫 실측 dispatch 와 그 `§3.1` 회차 기록"** 이다. S2 축은 임계 표(`p95 < 3000ms`)만 있고 **실측이 아직 0 회** 라, dataset 교체 후 person leg 가 조회로 실제 도는지 · 공유 dataset 보존 계약이 실 run 에서 지켜지는지 · `K6_SEED_PERSONS` 재정의(생성 수 → 표본 상한)가 실증되는지가 전부 미확인이다. 본 slice 는 오너 지시(PLAN `141 행` R-91 chain) 55/N 로, `load-k6.yml` 을 **정확히 1 회** dispatch 해 S2 수치를 회수하고 `§3.1` 에 회차 소절로 박제한다 — 임계 숫자와 코드는 한 글자도 건드리지 않는다(설계 ⑤ 승계).

## Required Reading

- [docs/ops/load-resilience-test-plan.md](../ops/load-resilience-test-plan.md) `67~158 행` `#### S2 dataset 교체 설계 (사전 박제)` — 특히 ③(표본 상한 재정의, 상한 상향은 **첫 실측 이후 별도 판단**) · ⑤(임계 숫자 변경 0) · ⑥ 말미(본 slice 가 그 세 번째 task 임). **이 소절 자체는 편집하지 않는다.**
- [docs/ops/load-resilience-test-plan.md](../ops/load-resilience-test-plan.md) `249 행` `### 3.1 baseline 실측 기록 (S1, 10 회분)` 헤더 + `621 행` 부터의 `#### 10 회차 (T-1669, ...)` 소절 전체 — 회차 소절이 따라야 할 항목 구성(측정 일시/run · 표본 로그 원문 · seed step 결과 · THRESHOLDS 원문 · 수치 · 환경 메타 · 의미/한계)의 서식 본보기.
- [docs/ops/load-resilience-test-plan.md](../ops/load-resilience-test-plan.md) `§3` 임계 표의 S2 축 3 행(`181~183 행`) 과 그 아래 `209 행` "S2 · S3 의 `baseline 후 fix` 표기는 무변경" 항목 — 본 slice 가 **무변경으로 유지**할 대상.
- [docs/ops/load-resilience-test-plan.md](../ops/load-resilience-test-plan.md) `§5` item 5 의 S2 문단(`795 행` 부터, "함께 좁혀진 것은 S2 축이다") — 실측 0 회 서술을 1 회로 전진시킬 자리.
- [test/load/s2-read.js](../../test/load/s2-read.js) `62~72 행`(임계 배열 6 종) · `76~100 행`(setup 조회 · 표본 로그 `[s2-read] devset 표본 취득 N명 / 필터 통과 M건 / 상한 30명`) — 회수해야 할 로그 줄과 THRESHOLDS 원문의 기대 형태. **편집 금지.**
- [docs/tasks/T-1669-load-k6-10th-run-gate-rule-apply.md](T-1669-load-k6-10th-run-gate-rule-apply.md) — 직전 dispatch slice 의 절차(`gh workflow run load-k6.yml --ref main -f s1_persons=133` **1 회 한정**, `gh run view <id> --log` 로 로그 회수) 선례.
- [docs/PLAN.md](../PLAN.md) `140~141 행` — R-91 checkbox 와 실측 이력 꼬리(본 slice 가 1~3 문장 append 할 자리).

## Acceptance Criteria

- [ ] `gh workflow run load-k6.yml --ref main -f s1_persons=133` 을 **정확히 1 회** 실행하고, run 의 conclusion 이 나올 때까지 기다려 결과를 확인한다. **재 dispatch · 재시도 0** — fail 이어도 다시 쏘지 않고 실패 원인만 박제한다(7 회차 선례). 인자를 `s1_persons=133` 으로 두는 이유는 3~10 회차와 **동일 조건**을 유지하기 위함이며, 이 값은 S1 leg 전용이라 S2 표본 상한(`K6_SEED_PERSONS=30`)과 무관하다.
- [ ] [docs/ops/load-resilience-test-plan.md](../ops/load-resilience-test-plan.md) `§3.1` 끝(10 회차 소절 뒤)에 `#### S2 1 회차 (T-1674, run <id>, S2 축 첫 실측 — devset 조회 전환 후 첫 run)` 소절을 신설하고 10 회차 소절과 **같은 항목 구성**으로 아래를 모두 박제한다. 인용은 `gh run view --log` **원문 그대로**이며 추정치 · 재계산 0, 자격증명 · cookie · email 원문은 인용 금지.
  - [ ] **측정 일시 / run** — dispatch 시각(UTC) · run id · head sha · job 소요 · conclusion · step 성공/skip 수 · `k6 S2 조회 부하 시나리오 실행` step 자체의 성공 여부.
  - [ ] **S2 표본 로그 원문** — `[s2-read] devset 표본 취득 N명 / 필터 통과 M건 / 상한 30명` 줄을 그대로 인용하고 `N`(취한 표본) · `M`(devset 필터 통과 총 건수) · 상한 `30` 의 관계를 판정한다. `M == 133` 이면 seed 적재 완전성이 S2 leg 에서도 확인된 것이고, `N == min(M, 30)` 이면 설계 ③(상한 의미 재정의)이 실 run 에서 실증된 것이다.
  - [ ] **seed step 결과** — `devset seed 완료 — person N 건 / serviceIdentity M 건 적재` 원문 인용 + T-1664 fix 의 **연속 4 회 성공** 여부 판정.
  - [ ] **k6 THRESHOLDS 원문** — S2 스크립트의 임계가 **6 종**(전역 `http_req_duration p(95)<3000` · `http_req_failed rate<0.01` · route 별 `persons` · `groups` · `parts` · `me` 각 `p(95)<3000`)으로 등장하는지, 각각 `✓` 인지 `✗` 인지 원문 그대로. 개수가 6 이 아니면 그 사실을 그대로 적는다.
  - [ ] **수치** — route 별 p95(`persons` · `groups` · `parts` · `me`) · 전역 p50 / p95 / p99 · `http_req_failed` · `http_reqs` · `iteration_duration`. p50 · throughput 은 `§3` 표에서 `baseline 후 fix`(관찰용)이므로 **관찰치로만** 적는다.
  - [ ] **공유 dataset 보존 계약의 실 run 검증** — 같은 job 의 뒤따르는 `k6 S3 동시 요청 내성 시나리오 실행` step conclusion 을 함께 적어, teardown 의 person DELETE 제거(설계 ②)가 후속 step 을 빈 DB 위에 놓지 않았음을 1~2 문장으로 판정한다.
  - [ ] **환경 메타**가 S1 3~10 회차와 동일 조건인지(같은 job · 같은 인스턴스 · 같은 DB) 1 문장.
  - [ ] **의미 / 한계** — 표본 상한 `30` 과 조회 대상 devset 규모의 차이, 조회 응답 행 수가 부하를 만든다는 설계 ③ (b) 전제, LLM stub · 실 수집 왕복 0 조건이 S2 축에도 그대로 걸린다는 점.
- [ ] `§3.1` 헤더 `### 3.1 baseline 실측 기록 (S1, 10 회분)` 을 `### 3.1 baseline 실측 기록 (S1 10 회분 · S2 1 회분)` 로 갱신한다.
- [ ] **`§3` 임계 표의 S2 축 3 행은 무변경** — p95 `< 3s` · p50/throughput `baseline 후 fix` · error rate `< 1%` 모두 한 글자도 고치지 않고, "표본 1 회로는 재확정 근거가 되지 않는다"(S1 은 T-1668 규칙 박제 → T-1669 기계 적용 순서를 거쳤다)는 판단만 회차 소절에 1 문장으로 남긴다. `209 행` 항목도 실측 회수 사실에 맞게 최소 수정하되 `baseline 후 fix` 표기 자체는 유지한다.
- [ ] `§5` item 5 의 S2 문단(`795 행` 부터)에 실측 1 회 확보 사실을 2~5 줄로 append 한다 — 실 수집 왕복 축(GitHub/Confluence 자격증명)은 S2 에서도 여전히 0 이므로 **잔여 개수 표기 변경 여부는 그 근거에 따라 판정**하고, 잔여 ② · ③ 표기는 무변경으로 둔다.
- [ ] [docs/PLAN.md](../PLAN.md) `141 행` 꼬리에 1~3 문장 append — S2 첫 실측 run id · conclusion · 대표 p95 · 임계 무변경 결론. **`140 행` checkbox `[ ]` 는 무변경**(LLM stub · 실 수집 왕복 0 조건 그대로).
- [ ] **코드 · 워크플로 · spec · 임계 상수 변경 0** — `test/load/s2-read.js` · `test/smoke/load-workflow-k6-harness-wiring-drift.smoke-spec.ts` · `.github/workflows/load-k6.yml` · `package.json` 모두 무변경.
- [ ] `pnpm test` green — 특히 `load-workflow-k6-harness-wiring-drift.smoke-spec.ts` 와 `realdata-devset-logins-doc-consistency.spec.ts` 통과(코드 · 상수 무변경 확인).
- [ ] 변경 파일 **2 개**(`load-resilience-test-plan.md` · `PLAN.md`) 유지. 3 번째 파일이 필요하다고 판단되면 Follow-ups 로 넘긴다. doc-only direct 라 PR · reviewer 미경유(§3.1 rule 1).

## Out of Scope

- **같은 run 의 S1 leg 기록(11 회차 소절)과 T-1668 재확정 규칙 적용** — 본 slice 는 S2 축 전용이다. S1 수치는 **같은 run id 의 로그에 남아 있으므로 재 dispatch 0 으로** 별도 direct slice 에서 회수 · 박제한다(Follow-ups 에 run id 를 남길 것).
- **재 dispatch · 복수 회차 측정** — 1 회 한정. run 이 fail 이면 원인 박제로 끝내고 fix 는 별도 pr-mode slice(7 회차 → T-1664 선례).
- **`K6_SEED_PERSONS` 상한 상향(30 → 133 등)** — 설계 ③ 이 "첫 실측 이후 별도 판단" 으로 못 박았다. 본 slice 에서 값을 바꾸지 않으며, 필요하다는 근거가 보이면 Follow-ups 로.
- **S2 임계(3000ms)의 상향 · 하향 · 관찰용 게이트 신설** — 표본 1 개로는 산포를 알 수 없다. S1 처럼 "규칙 사전 박제 → 기계 적용" 2 단계를 거칠 것을 Follow-ups 로 제안만 한다.
- **코드 · spec · workflow 편집 0** — `test/load/*.js` · `test/smoke/*.ts` · `.github/workflows/load-k6.yml` · `package.json` 수정 금지(수정 순간 `commitMode` 가 갈린다, §3.1 rule 3).
- **S3 축 dataset 교체 · 실측** — 설계가 명시적으로 범위 밖으로 남긴 별도 slice.
- [docs/ops/realdata-scale-devset.md](../ops/realdata-scale-devset.md) 편집 — `§A`/`§B` 표는 drift guard 파싱 대상.
- **실 수집 왕복 축**(GitHub/Confluence 자격증명 주입) — CLAUDE.md §5 BLOCKED 사유(외부 자격증명)라 오너 결정 선행.
- `deploy/daily-test.sh` leg 추가 — drift-guard smoke 3 종 동반으로 5 파일 cap 초과(T-1122 / Q-0054 선례).

## Suggested Sub-agents

`implementer` (dispatch + 로그 회수 + 문서 반영) → `tester` (`pnpm test` green · 코드/상수 무변경 확인)

## Follow-ups

- **S1 11 회차 소절 회수 (재 dispatch 0)** — 본 slice 가 쏜 run `32746598803` 로그에 S1 leg 수치가
  그대로 남아 있다(batch p95 `967.52ms` · `http_reqs` 7 · iteration `969.32ms`). 같은 run id 를
  읽어 `§3.1` 에 11 회차 소절만 박제하는 별도 `direct` slice — **새 dispatch 0**.
- **T-1668 재확정 규칙 ①-(a) 첫 트리거 처리** — 관찰용 게이트 `p(95)<900` 이 실 run 에서 처음
  `✗`(p95 `967.52ms`) 로 crossed 됐다. T-1668 이 사전 박제한 재확정 규칙의 트리거 조건이 처음
  충족된 것이므로, 그 규칙을 기계적으로 적용하는 slice 가 필요하다(T-1669 선례 = 규칙 박제 →
  기계 적용 2 단계).
- **다음 S2 dispatch 는 위 항목 이후로 배치** — `.github/workflows/load-k6.yml` `195 행` 의 S2
  step 에 `if: always()` 가 없어 S1 게이트가 red 인 동안 S2 · S3 step 은 계속 skip 된다. 즉 S1
  게이트를 먼저 정리하지 않으면 S2 실측을 몇 번 더 쏴도 수치는 0 이다. (workflow 의 `if` 조건
  자체를 바꿀지 여부는 임계 판단과 얽히므로 별도 판단 대상 — 본 slice 는 사실만 남긴다.)
