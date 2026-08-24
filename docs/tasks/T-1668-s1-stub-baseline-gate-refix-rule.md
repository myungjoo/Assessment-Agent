---
id: T-1668
title: p(95)<900 stub baseline 게이트의 재확정 트리거·상향 폭 산정 규칙을 사전 박제
phase: P5
status: PENDING
commitMode: direct
coversReq: [REQ-047]
estimatedDiff: 95
estimatedFiles: 2
created: 2026-08-24
createdAt: 2026-08-24T01:20:00Z
dependsOn: [T-1667]
touchesFiles:
  - docs/ops/load-resilience-test-plan.md
  - docs/PLAN.md
independentStream: load-harness-r91
plannerNote: "P5 R-91 chain 50/N — T-1667 Follow-up 1 을 닫는 규칙 사전 박제(측정 전 확정으로 over-fitting 차단)."
---

# T-1668 — stub baseline 게이트 재확정 규칙 사전 박제

## Why

[T-1667](T-1667-load-k6-sample-log-rerun.md) 9 회차 실측에서 실 scale 표본이 6 개가 되며 batch p95 평균 **762.93ms** · 표본표준편차 **41.02ms** · 평균+3σ **886.00ms** 가 됐다 — `p(95)<900` 게이트까지 여유가 8 회차의 56.55ms 에서 **14.01ms** 로 좁아졌고, 그 소절은 "재확정 판단은 다음 표본에서 다시 본다" 로 판단을 미뤘다(T-1667 Follow-up 1).

문제는 **다음 표본을 본 뒤에 규칙을 정하면 그 표본에 맞춘 사후 정당화(over-fitting)** 가 된다는 점이다 — `§3` 각주가 T-1644 에서 `max` 대신 평균+3σ 를 고른 이유와 같은 위험이다. 본 slice 는 다음 dispatch **이전에** ① 재확정 트리거 조건 ② 상향 폭 산정식 ③ 하향·outlier 취급 ④ 집행 경로(doc/코드 split) 를 문서에 먼저 굳혀, 10 회차 이후의 판정을 기계적으로 만든다. 실측도 코드 변경도 하지 않는 순수 규칙 박제라 doc-only `direct` 다(PLAN `144 행` 오너 지시 R-91 chain 50/N).

## Required Reading

- [docs/ops/load-resilience-test-plan.md](../ops/load-resilience-test-plan.md) — `78 행` 부터의 `## 3. 측정 지표·임계` 절: `87 행` 임계 표의 S1 관찰용 p95 행, `99~101 행` 도출식, `102~111 행` "REQ-047 판정 임계가 아니다" 성격 구분, `120 행` 부터의 **각주 — 임계 fix 시점**(본 slice 가 규칙을 덧붙일 자리). 그리고 `478~486 행` 9 회차 소절의 기술통계 문단(현 표본 6 개 수치의 출처)과 `533 행` 부터의 `§5` item 5.
- [docs/tasks/T-1667-load-k6-sample-log-rerun.md](T-1667-load-k6-sample-log-rerun.md) `## Follow-ups` 1 번 — 본 slice 가 닫는 항목의 원문(여유 14.01ms 축소 경위).
- [test/load/s1-batch.js](../../test/load/s1-batch.js) `43 행` `const STUB_BASELINE_P95_MS = 900;` 와 그 상수를 쓰는 `THRESHOLDS` 배열 — 숫자 변경이 실제로 어느 코드 좌표를 건드리는지 확인용. **읽기만 하고 편집하지 않는다.**
- [test/smoke/load-workflow-k6-harness-wiring-drift.smoke-spec.ts](../../test/smoke/load-workflow-k6-harness-wiring-drift.smoke-spec.ts) `1293~1295 행`(`S1_STUB_BASELINE_P95_MS = 900` 상수)·`1443 행` describe·`1648~1651 행` mutation 대조군 — 상수를 바꾸면 이 drift guard 도 같은 commit 에서 동기돼야 함을 확인용. **읽기만 하고 편집하지 않는다.**
- [docs/PLAN.md](../PLAN.md) `140~141 행` — R-91 checkbox 와 실측 이력 꼬리(본 slice 가 1~2 문장 append 할 자리).
- [CLAUDE.md](../../CLAUDE.md) `§3.1` — doc(direct) / 코드(pr) 분리 판정 규칙(본 slice 가 박제할 "집행 경로" 항목의 근거).

## Acceptance Criteria

- [ ] [docs/ops/load-resilience-test-plan.md](../ops/load-resilience-test-plan.md) `§3` 각주 아래에 **"S1 관찰용 p95 게이트 재확정 규칙 (사전 박제)"** 소절을 추가하고 다음 **4 항목을 모두** 명시한다. 각 항목은 판정자가 표본 수치만 대입하면 결론이 하나로 나오도록 서술한다(해석 여지 최소화).
  - [ ] **① 재확정 트리거** — 다음 둘 중 하나면 착수: (a) 실 run 에서 `p(95)<900` 이 `✗` 로 나온 경우(즉시), (b) 실 scale 표본(표본 133 조건) 전량의 **평균 + 3σ 가 현 임계를 초과**한 경우. 둘 다 아니면 임계 무변경이며, 여유가 좁아졌다는 사실만으로는 상향하지 않는다.
  - [ ] **② 상향 폭 산정식** — T-1644 도출식을 **그대로 재적용**한다: 실 scale 표본 전량의 `평균 + 3 × 표본표준편차` 를 **100ms 단위 올림**. 새 식(예: max 기반 · p99 기반 · 임의 배수)을 발명하지 않는다. 산정에 쓴 표본 목록·평균·표본표준편차·올림 전 값을 함께 박제한다.
  - [ ] **③ 표본 취급** — outlier 제거 금지(임계를 넘긴 표본을 빼고 재계산하지 않는다), 표본은 실 scale(133) 회차만 사용하고 표본 10 회차는 섞지 않는다. **하향은 하지 않는다** — 여유가 다시 넓어져도 flapping 방지를 위해 임계를 낮추지 않는다(낮출 사유가 생기면 별도 판정).
  - [ ] **④ 집행 경로** — 숫자를 실제로 바꿀 때는 `§3.1` 에 따라 **task 2 개로 split**: (i) 코드 `pr` — [test/load/s1-batch.js](../../test/load/s1-batch.js) 의 `STUB_BASELINE_P95_MS` + [load-workflow-k6-harness-wiring-drift.smoke-spec.ts](../../test/smoke/load-workflow-k6-harness-wiring-drift.smoke-spec.ts) 의 `S1_STUB_BASELINE_P95_MS`·mutation 대조군을 **같은 commit 에서** 동기(둘이 갈리면 drift guard 가 red), (ii) doc `direct` — `§3` 표 · 각주 · `§5` item 5 수치 갱신. 한 task 로 합치지 않는다.
- [ ] 같은 소절에 **성격 구분 불변**을 한 문장으로 재확인한다 — 상향해도 관찰용 게이트일 뿐이며 REQ-047 pass/fail 판정 임계는 `FULL_RUN_BUDGET_MS`(1h 예산) 그대로다(`102~111 행` 서술과 모순 0).
- [ ] `§5` item 5 꼬리에 본 규칙 소절로의 pointer 1 문장을 덧붙인다(잔여 ①·②·③ 표기 자체는 무변경).
- [ ] [docs/PLAN.md](../PLAN.md) `141 행` 꼬리에 1~2 문장 append — 규칙 사전 박제 사실과 "다음 실측 회차부터 기계적 적용" 을 적는다. **`140 행` checkbox `[ ]` 는 무변경**(실 수집 왕복 0 조건 그대로).
- [ ] **임계 숫자 변경 0** — `§3` 표의 `900ms` · `s1-batch.js` 상수 · smoke spec 상수 모두 본 slice 에서 손대지 않는다(현 표본 6 개의 평균+3σ 886.00ms 는 트리거 ①-(b) 미충족). 규칙만 박제한다.
- [ ] 문서에 인용하는 수치(762.93 · 41.02 · 886.00 · 14.01ms 등)는 `§3.1` 9 회차 소절에 이미 박제된 값을 그대로 쓴다 — 재계산·추정치 0.
- [ ] `pnpm test` green — 특히 `load-workflow-k6-harness-wiring-drift.smoke-spec.ts` 가 통과(코드·상수 무변경 확인)하고 `realdata-devset-logins-doc-consistency.spec.ts` 가 `RangeError` 없이 통과.
- [ ] 변경 파일 **2 개**(`load-resilience-test-plan.md` · `PLAN.md`) 유지. 3 번째 파일이 필요하다고 판단되면 Follow-ups 로 넘긴다. doc-only direct 라 PR · reviewer 미경유(§3.1).

## Out of Scope

- **`load-k6.yml` dispatch 금지** — 본 slice 는 실측이 아니다. 10 회차 실측은 본 규칙 박제 **이후** 별도 slice 에서 수행한다(그래야 사전 박제의 의미가 산다).
- **코드 · 워크플로 · spec 변경 0** — `test/load/*.js` · `test/smoke/*.ts` · `.github/workflows/load-k6.yml` · `package.json` 수정 금지(수정이 필요해지는 순간 `commitMode` 가 갈린다, §3.1).
- **임계 숫자의 실제 상향** — 트리거 미충족이므로 본 slice 에서 하지 않는다.
- `§3` 표의 S2 · S3 축 `baseline 후 fix` 표기 손대기 — 해당 축 실측 0 회라 범위 밖.
- [docs/ops/realdata-scale-devset.md](../ops/realdata-scale-devset.md) 편집 — `§A`/`§B` 표는 drift guard 파싱 대상.
- `deploy/daily-test.sh` leg 추가 — drift-guard smoke 3 종 동반으로 5 파일 cap 초과(T-1122 / Q-0054 선례).
- 실 수집 왕복 축(`§5` item 5 잔여 ①) 의 자격증명 결정 — 오너 결정 선행 사안(T-1667 Follow-up 2 승계).

## Follow-ups

(작성 시점 비어 있음 — sub-agent 가 관련 작업을 발견하면 여기에 append)
