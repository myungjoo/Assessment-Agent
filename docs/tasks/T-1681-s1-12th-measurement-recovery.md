---
id: T-1681
title: 같은 run 로그로 S1 12 회차 회수 (재 dispatch 0) + §3.1 · PLAN 개수 표기 동기
phase: P5
status: DONE
commitMode: direct
coversReq: [REQ-048]
estimatedDiff: 110
estimatedFiles: 2
independentStream: load-k6-s1-baseline
dependsOn: [T-1680]
touchesFiles:
  - docs/ops/load-resilience-test-plan.md
  - docs/PLAN.md
created: 2026-08-25
completedAt: 2026-08-24T22:52:00Z
resultCommit: 6c3a9db3
plannerNote: P5 R-91 chain 61/N — T-1680 Follow-up ① (run 32780975839 로그 재독으로 S1 12 회차 박제, 새 dispatch 0)
---

# T-1681 — 같은 run 로그로 S1 12 회차 회수 (재 dispatch 0) + §3.1 · PLAN 개수 표기 동기

## Why

[T-1680](T-1680-load-k6-s2-s3-first-measurement.md)(main `0a28d728`)이 `load-k6.yml` 을 **정확히 1 회** dispatch(run **32780975839**, head `013f3f10`, conclusion `success`, 21 step 전부 success · skipped 0)해 S2 · S3 축 수치를 처음 회수했지만, **같은 run 의 S1 leg 수치는 그 slice 의 Out of Scope 로 남겨졌다** — `docs/ops/load-resilience-test-plan.md` `899~902 행` (c) 가 "S1 leg 수치(12 회차)는 run **32780975839** 로그에서 **재 dispatch 0** 으로 회수 가능하다" 로 명시적으로 이월했다. 본 slice 는 T-1680 Follow-up ① 로, **새 dispatch · rerun · 재시도를 전부 0 으로 유지한 채** 이미 존재하는 run 로그만 재독해 S1 12 회차를 `§3.1` 에 박제하고, 그로 인해 갈리는 개수 표기(`§3.1` 헤더 · `PLAN.md` `141 행`)를 함께 맞춘다. 선례는 T-1674 의 run 을 T-1675 가 재독해 11 회차를 박제한 그대로다. **임계 숫자 · 코드 · 워크플로 · spec 은 한 글자도 바꾸지 않는다**(표본 1 개는 재확정 근거가 못 된다는 규칙 ③ · S1 축 2 단계 선례 승계).

## Required Reading

- [docs/ops/load-resilience-test-plan.md](../ops/load-resilience-test-plan.md) `692~757 행` `#### 11 회차 (T-1675, run 32746598803, ...)` 소절 전문 — 본 slice 가 **이어서 쓰는 직전 S1 회차**이자 항목 구성·서식의 본보기(측정 일시/run · 표본 로그 원문 · seed step 결과 · k6 THRESHOLDS 원문 인용 · 수치 · 환경 메타 · `§3` 무변경 판정 · 의미/한계 (a)~(c)). 특히 "같은 로그를 재독했을 뿐 새 dispatch · rerun · 재시도가 전부 0" 이라는 **재독 slice 의 문장 톤**을 따른다. **이 소절은 편집하지 않는다.**
- [docs/ops/load-resilience-test-plan.md](../ops/load-resilience-test-plan.md) `829~902 행` `#### S2 2 회차 (T-1680, run 32780975839, ...)` 소절 — 본 slice 와 **같은 run** 을 다룬 직전 기록. run 메타(dispatch 시각 · head sha · conclusion · step 구성)는 여기 박제된 사실과 **문자 단위로 일치**해야 한다. 편집 대상은 이 소절 꼬리 `899~902 행` 의 (c) **한 군데뿐**이다.
- [docs/ops/load-resilience-test-plan.md](../ops/load-resilience-test-plan.md) `265 행` `### 3.1 baseline 실측 기록 (S1 11 회분 · S2 2 회분 · S3 1 회분)` 헤더 — 개수 표기 갱신 자리.
- [docs/ops/load-resilience-test-plan.md](../ops/load-resilience-test-plan.md) `171~213 행` `§3` 임계 표 — S1 축 `1100ms` 행 포함 **전부 무변경으로 유지**할 대상(본 slice 는 표본을 1 개 더할 뿐 임계를 재확정하지 않는다).
- [docs/ops/load-resilience-test-plan.md](../ops/load-resilience-test-plan.md) `§5` item 5 안의 **T-1680 문단**(`1115 행` 부터 그 문단 끝, `② **반복 run 기반 임계 fix**` 로 시작하는 줄 **직전**까지) — 진척 문단 append 자리.
- [docs/PLAN.md](../PLAN.md) `140~141 행` — R-91 checkbox 와 실측 이력 꼬리. `141 행` 의 `baseline 실측 11 회 완료(그중 실 scale 표본 133 은 9 회 dispatch · 수치 회수는 8 회 — 7 회차만 seed step fail 로 k6 미실행)` 개수 표기가 갱신 대상이다.
- [test/load/s1-batch.js](../../test/load/s1-batch.js) `34~36 행`(표본 상한) · `options.thresholds`(전역 `http_req_failed` + `{route:batch}` 2 종 — `p(95)<3600000` 과 관찰용 `p(95)<STUB_BASELINE_P95_MS`) · 표본 취득 로그 배선 — 로그에서 무엇을 찾아야 하는지의 근거. **코드는 읽기만 한다.**

## Acceptance Criteria

- [ ] **새 dispatch 0** — `gh workflow run` · `gh run rerun` · `gh api` 를 통한 워크플로 재실행을 **한 번도 하지 않는다**. 회수 수단은 이미 끝난 run 의 로그 재독뿐이다: `gh run view 32780975839 --log` (Git Bash 에서 실행). 로그 회수 명령과 그 결과 요약을 task 결과 요약에 남긴다.
- [ ] `docs/ops/load-resilience-test-plan.md` 의 `#### 11 회차` 소절 **직후 · `#### S2 1 회차` 소절 직전**(현행 `757 행`과 `758 행` 사이)에 `#### 12 회차 (T-1681, run 32780975839, ...)` 소절을 **신설**한다. 항목 구성은 11 회차 서식을 따라 최소 다음 7 종을 포함한다 — ① 측정 일시 / run · step 구간 · k6 exit code(+ "본 run 은 T-1680 이 이미 소진했고 본 slice 는 로그를 재독했을 뿐 새 dispatch · rerun 0" 명시) ② 표본 로그 원문 인용(`[s1-batch] devset 표본 취득 N명 / 요청 M명`) 과 `N == M` 일치 판정 ③ seed step 결과(건수 · 재현성 회차) ④ k6 THRESHOLDS 원문 인용(`{route:batch}` 2 종 + `http_req_failed`) 과 `✓`/`✗` 판정 ⑤ 핵심 수치(p95 · iteration · `http_reqs` 등 로그에 실제로 있는 값만) ⑥ 환경 메타 ⑦ `§3` 무변경 판정 + 의미 / 한계.
- [ ] **로그에 없는 값은 쓰지 않는다** — 추정 · 보간 · 다른 회차 수치 전용은 0. 로그가 출력하지 않는 지표(예: `p99`)는 T-1680 선례대로 **미확보** 로 표기한다.
- [ ] `§3.1` 헤더(`265 행`)의 개수 표기를 `(S1 12 회분 · S2 2 회분 · S3 1 회분)` 로 갱신한다. S2 · S3 개수는 무변경.
- [ ] `#### S2 2 회차` 소절 꼬리 `899~902 행` 의 (c) "같은 run 의 S1 leg 수치(12 회차)는 **본 slice Out of Scope**" 서술에 **회수 완료 pointer 1 줄**을 부여한다(이력 보존 + 현행 사실 pointer — T-1679 가 (d) 무효화 표기에 쓴 방식 승계). 그 소절의 나머지 줄은 문자 단위 무변경.
- [ ] `§5` item 5 의 T-1680 문단 **뒤**에 본 slice 의 집행 사실 1~3 문장을 append 한다. 잔여 ① 표기 · 잔여 개수 · ② · ③ 표기는 **무변경**(본 slice 는 실 수집 왕복 축을 건드리지 않는다).
- [ ] `docs/PLAN.md` `141 행` 꼬리의 개수 표기를 `§3.1` 실 기록으로부터 **재계수**해 갱신한다(총 실측 회차 · 실 scale 표본 133 의 dispatch 회수 · 수치 회수 회수). 재계수 근거(어느 회차가 어디에 해당하는지)를 task 결과 요약에 남긴다. `140 행` checkbox 는 LLM stub · 실 수집 왕복 0 · 단일 iteration 조건이 불변이므로 **`[ ]` 유지**.
- [ ] **무변경 검증** — `git diff --stat` 결과가 위 2 파일뿐이고, `docs/ops/load-resilience-test-plan.md` 의 `§3` 임계 표(`171~213 행`) · `#### S2 dataset 교체 설계` 소절 · `#### 11 회차` 소절 · `#### S3 1 회차` 소절 · `§4` 는 diff hunk 에 등장하지 않음을 확인한다.
- [ ] 코드 · 워크플로 · spec 변경 0 이므로 **R-110 면제**(production 0 LOC). 확인용으로 `pnpm lint` 를 1 회 실행해 무경고를 확인한다. R-112 4 항목(happy / error path / 분기 / negative)은 **doc-only 라 적용 대상 없음** — 본 slice 에 추가/수정되는 public symbol 이 0 이라 항목 생략.

## Out of Scope

- **워크플로 재실행 일체** — 새 `workflow_dispatch` · rerun · 재시도. 본 slice 의 수확은 run **32780975839** 로그가 전부다.
- `§3` 임계 표의 어떤 숫자든 변경(S1 `1100ms` 관찰용 게이트 포함). 표본 1 개 추가는 재확정 근거가 아니다.
- `test/load/*.js` · `.github/workflows/load-k6.yml` · drift-guard smoke spec 변경(읽기만).
- `K6_SEED_PERSONS` 30 → 133 상향 판단(T-1680 Follow-up ②), S3 leg 표본 로그 배선(③), 단계별 percentile export step(④) — 각각 별도 slice.
- `#### 11 회차` · `#### S2 1 회차` · `#### S2 2 회차`(꼬리 (c) 1 줄 제외) · `#### S3 1 회차` 소절 본문 편집.
- `docs/PLAN.md` `140 행` checkbox 상태 변경.

## Suggested Sub-agents

`implementer` → (doc-only 라 tester 는 lint 확인만)

## Result

**DONE** — main direct commit `6c3a9db3` (`docs/ops/load-resilience-test-plan.md` · `docs/PLAN.md` 2 파일 `+85/-2`). `gh run view 32780975839 --log` **1 회 재독**만으로 집행 — 새 `workflow_dispatch` · rerun · 재시도 **0**. `§3.1` 에 `#### 12 회차` 소절을 `11 회차` 직후에 신설: step 12 `k6 S1 평가 배치 부하 시나리오 실행` 21:44:55Z~21:44:56Z success, k6 exit 0, THRESHOLDS 3 종 전부 `✓`(`p(95)<3600000` · `p(95)<1100` · `rate<0.01`), batch p95 **824.08ms**, `http_reqs` 7, `http_req_failed` **0.00%**, `iteration_duration` 825.71ms, `level=error` 0 줄. `p99` 는 k6 기본 요약 미출력이라 **미확보** 표기(추정 0). T-1668 재확정 규칙 기계 재계수 — 실 scale 표본 133 수치 회수 회차 **9 개**(3·4·5·6·8·9·10·11·12), 평균 **790.35ms** · 표본표준편차 **77.14ms** · 평균+3σ **1021.77ms** ≤ 현행 `1100ms` → 트리거 ①-(a)·①-(b) 모두 **미발화** → `§3` 임계 표 · `STUB_BASELINE_P95_MS` · drift-guard spec 문자 단위 **0 변경**. `§3.1` 헤더 `(S1 12 회분 · S2 2 회분 · S3 1 회분)`, `S2 2 회차` 꼬리 (c) 에 회수 완료 pointer, `§5` item 5 · `PLAN.md` `141 행` 재계수(총 12 회 / 실 scale dispatch 10 회 / 수치 회수 9 회, `140 행` checkbox `[ ]` 유지). doc-only 라 R-110 면제, 확인용 `pnpm lint` 무경고. 큐잉 run `32785829495` **success**, content run `32786356112` 는 종료 전 conclusion 확인(R-114).

## Follow-ups

- ① `K6_SEED_PERSONS` 30 → 133 상향 판단 (T-1680 Follow-up ② 승계) — seed step 이 실 scale 표본을 133 으로 맞출지, 30 유지가 의도인지 결정 후 문서/워크플로 동기.
- ② S3 leg 표본 / 행 수 로그 배선 (T-1680 Follow-up ③ 승계) — 현 S3 leg 는 전역 p95 와 THRESHOLDS 판정만 남기고 표본 수를 로그에 안 남긴다.
- ③ 단계별 percentile export step (T-1680 Follow-up ④ 승계) — 현 k6 기본 요약으로는 latency cliff 의 단계 분해도 `p99` 회수도 불가.
