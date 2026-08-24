---
id: T-1675
title: 같은 run 로그에서 S1 11 회차 회수 + T-1668 재확정 규칙 ①-(a) 첫 트리거 기계 산정
phase: P5
status: PENDING
commitMode: direct
coversReq: [REQ-047]
estimatedDiff: 110
estimatedFiles: 2
independentStream: load-k6-s1-baseline
dependsOn: [T-1674]
touchesFiles:
  - docs/ops/load-resilience-test-plan.md
  - docs/PLAN.md
created: 2026-08-25
plannerNote: P5 R-91 chain 56/N — T-1674 Follow-up 1+2 (재 dispatch 0 으로 S1 11 회차 회수 + 규칙 ② 산정, 임계·코드 변경 0)
---

# T-1675 — 같은 run 로그에서 S1 11 회차 회수 + T-1668 재확정 규칙 ①-(a) 첫 트리거 기계 산정

## Why

[T-1674](T-1674-load-k6-s2-first-measurement.md) 가 소진한 dispatch 1 회(run `32746598803`)는 S2 축에서는 수확이 0 이었지만, **같은 job 의 S1 leg 는 정상 실행돼 수치를 남겼다** — batch p95 **967.52ms** 로 stub 조건 관찰용 게이트 `p(95)<900` 이 실 run 에서 **처음 `✗`** 가 됐다. 이는 [T-1668](T-1668-s1-stub-baseline-gate-refix-rule.md) 이 표본을 보기 **전에** 박제해 둔 재확정 규칙의 **트리거 ①-(a) 가 처음 충족**된 사건이고, 동시에 `§3.1` 에 아직 박제되지 않은 **11 번째 실측 회차**다. 본 slice 는 T-1674 Follow-up ① · ② 를 한 묶음으로 닫는다 — **새 dispatch 0** 으로 같은 run id 로그만 다시 읽어 11 회차 소절을 신설하고, 규칙 ②(평균 + 3σ · 100ms 올림)를 표본에 **대입만** 한다. 임계 숫자와 코드는 본 task 에서 한 글자도 바꾸지 않는다 — 실제 숫자 변경은 규칙 ④ 가 못 박은 **2 task split**(코드 `pr` → 문서 `direct`) 소관이다(PLAN `141 행` R-91 chain).

## Required Reading

- [docs/ops/load-resilience-test-plan.md](../ops/load-resilience-test-plan.md) `222~249 행` — `**S1 관찰용 p95 게이트 재확정 규칙 (사전 박제, T-1668)**` 소절 전문. 특히 ① 트리거 · ② 산정식(평균 + 3 × 표본표준편차 → 100ms 올림, **새 식 발명 금지**) · ③ 표본 취급(**outlier 제거 금지** · 표본 10 회차 혼합 금지 · 하향 금지) · ④ 집행 경로(2 task split). **이 규칙 소절 자체는 본 task 에서 편집하지 않는다** — 규칙 ② 말미의 "본 규칙 소절에도 함께 박제" 는 숫자를 **실제로 갱신할 때**(④ 의 doc `direct` task) 발효한다.
- [docs/ops/load-resilience-test-plan.md](../ops/load-resilience-test-plan.md) `623~677 행` `#### 10 회차 (T-1669, run 32690756666, ...)` 소절 전체 — 본 slice 가 그대로 따라야 할 서식 본보기(측정 일시/run · 표본 로그 원문 · seed step 결과 · THRESHOLDS 원문 · 수치 · **규칙 기계 적용 블록** · 환경 메타 · 의미/한계). 특히 규칙 적용 블록이 "표본 목록 · 평균 · 표본표준편차 · 올림 전 값" 4 가지를 어떻게 적었는지.
- [docs/ops/load-resilience-test-plan.md](../ops/load-resilience-test-plan.md) `678~738 행` `#### S2 1 회차 (T-1674, run 32746598803, ...)` 소절 — 같은 run 의 이미 회수된 사실(seed step 연속 4 회 성공 · 환경 메타 7 항목 · `[s1-batch]` 표본 로그 원문 · exit 99 경위). **중복 전재 대신 pointer 로 처리**하고, (c) 항목 끝에 11 회차 회수 완료 pointer 1 줄만 append 한다.
- [docs/ops/load-resilience-test-plan.md](../ops/load-resilience-test-plan.md) `171~221 행` `§3` 임계 표 + `213~221 행` 각주 — 본 slice 가 **무변경으로 유지**할 대상(S1 `900ms` 포함).
- [docs/ops/load-resilience-test-plan.md](../ops/load-resilience-test-plan.md) `§5` item 5 의 S1 · S2 문단(`865~882 행` 부근) — 트리거 충족 사실을 1~3 줄 append 할 자리(잔여 개수 표기는 무변경).
- [docs/PLAN.md](../PLAN.md) `140~141 행` — R-91 checkbox 와 실측 이력 꼬리(1~3 문장 append 자리).

## Acceptance Criteria

- [ ] **새 dispatch 0** — `gh workflow run` 을 **한 번도 실행하지 않는다**. 회수는 오직 `gh run view 32746598803 --log` (또는 `--log --job <id>`) 로 기존 로그를 다시 읽어서만 한다. 재실행 · rerun · 재시도 모두 0 임을 commit trail 에 남긴다.
- [ ] [docs/ops/load-resilience-test-plan.md](../ops/load-resilience-test-plan.md) `§3.1` 의 **10 회차 소절 뒤 · `S2 1 회차` 소절 앞**에 `#### 11 회차 (T-1675, run 32746598803, 관찰용 게이트 `p(95)<900` 이 실 run 에서 처음 `✗`)` 소절을 신설하고, 10 회차와 **같은 항목 구성**으로 아래를 박제한다. 인용은 로그 **원문 그대로**이며 추정 · 재계산 0, 자격증명 · cookie · email 원문 인용 금지.
  - [ ] **측정 일시 / run** — dispatch 시각(UTC) · run id · head sha · S1 step 구간과 소요 · k6 exit code · step 성공/failure/skip 수. 본 회차의 run 은 T-1674 가 이미 소진한 것이며 **본 slice 는 로그만 재독**했다는 사실 1 문장.
  - [ ] **표본 로그 원문** — `[s1-batch] devset 표본 취득 133명 / 요청 133명` 줄을 그대로 인용하고 `N == M` 일치 판정 + T-1666 배선의 **연속 3 회 성공** 판정.
  - [ ] **seed step 결과** — `devset seed 완료 — person 133 건 / serviceIdentity 133 건 적재` 원문 + T-1664 fix **연속 4 회 성공**. 이미 `S2 1 회차` 소절에 있는 사실이므로 **2~3 줄 + pointer** 로 압축한다.
  - [ ] **k6 THRESHOLDS 원문** — `http_req_duration{route:batch}` 임계 **2 개**가 각각 `✓` / `✗` 중 무엇인지 원문 그대로(`p(95)<3600000` 과 `p(95)<900` 의 판정이 갈린 첫 회차). `http_req_failed` 의 `rate<0.01` 판정도 함께.
  - [ ] **수치** — batch p95 · `http_reqs` · `iteration_duration` · `http_req_failed`. `http_reqs` 가 8~10 회차와 같은 **7** 인지, `iteration_duration` 이 p95 와 정합인지 판정 1 문장.
  - [ ] **의미 / 한계** — (a) 게이트가 `✗` 라는 것이 REQ-047 판정 실패가 **아니라는** 점(`p(95)<3600000` 은 통과, 판정 임계는 `FULL_RUN_BUDGET_MS` — 규칙의 "성격 구분 불변" 승계). (b) 표본 1 개가 튄 것인지 조건이 바뀐 것인지 구분할 근거(환경 메타 동일 · 표본 133 동일 · `http_reqs` 동일)를 적되 **outlier 로 취급해 빼지 않는다**(규칙 ③). (c) LLM stub · 실 수집 왕복 0 조건은 그대로.
- [ ] 같은 소절 안에 **T-1668 재확정 규칙 기계 적용(2 회차 적용 · ①-(a) 첫 트리거)** 블록을 두고, 규칙 ② 를 **대입만** 한다 — 새 산정식 발명 0.
  - [ ] **트리거 판정** — ①-(a) 가 실 run 의 `✗` 로 **충족**됐음을 명시(①-(b) 는 함께 계산해 결과를 적되, (a) 만으로 이미 착수 조건 충족).
  - [ ] **표본 목록** — 실 scale(표본 133) 회차 **전량**(3 · 4 · 5 · 6 · 8 · 9 · 10 · 11 회차) 의 batch p95 를 회차별로 나열. 7 회차는 seed fail 로 수치 없음 · 1 · 2 회차는 표본 10 이라 **혼합 금지**(규칙 ③)를 각각 1 구절로 명시. **outlier 제거 0** — 최댓값도 그대로 포함.
  - [ ] **산정 결과 4 종** — 평균 · 표본표준편차 · **평균 + 3σ** · **100ms 올림 전/후 값**을 모두 적는다. 계산은 executor 가 직접 수행하고(반올림은 소수 둘째 자리), 규칙 ② 가 요구한 4 가지가 빠짐없이 박제돼야 한다.
  - [ ] **본 task 에서는 숫자를 바꾸지 않는다** — 산정 결과가 현 임계와 다르더라도 `§3` 표 · 각주 · `s1-batch.js` 의 `STUB_BASELINE_P95_MS` · smoke spec 의 `S1_STUB_BASELINE_P95_MS` 는 **전부 무변경**이고, 규칙 ④ 의 **2 task split**((i) 코드 `pr` 동기 → (ii) doc `direct` 수치 갱신)로 이월한다는 결론을 1~2 문장으로 명시 + Follow-ups 에 두 갈래를 남긴다. 하향 검토는 하지 않는다(규칙 ③).
- [ ] `§3.1` 헤더 `### 3.1 baseline 실측 기록 (S1 10 회분 · S2 1 회분)` → `### 3.1 baseline 실측 기록 (S1 11 회분 · S2 1 회분)`.
- [ ] `#### S2 1 회차` 소절 (c) 항목 끝에 **1 줄** pointer append — "S1 leg 수치 회수 · 11 회차 소절 · 규칙 적용은 T-1675 가 재 dispatch 0 으로 완료". 그 소절의 다른 문장은 무변경.
- [ ] `§5` item 5 에 1~3 줄 append — 트리거 ①-(a) 첫 충족 · 산정 결과 · 숫자 변경은 ④ split 이월. **잔여 개수 표기(1 개) 와 ② · ③ 표기는 무변경**(실 수집 왕복은 여전히 0).
- [ ] [docs/PLAN.md](../PLAN.md) `141 행` 꼬리에 1~3 문장 append — S1 실측 **11 회** · 게이트 첫 crossed · 산정 결과 · 임계 무변경(이월). **`140 행` checkbox `[ ]` 무변경**.
- [ ] **코드 · 워크플로 · spec · 임계 상수 변경 0** — `test/load/s1-batch.js` · `test/load/s2-read.js` · `test/smoke/load-workflow-k6-harness-wiring-drift.smoke-spec.ts` · `.github/workflows/load-k6.yml` · `package.json` 모두 무변경.
- [ ] `pnpm test` green (453 suite 기준) — 특히 `load-workflow-k6-harness-wiring-drift.smoke-spec.ts` 통과로 상수 무변경을 재확인.
- [ ] 변경 파일 **2 개**(`load-resilience-test-plan.md` · `PLAN.md`) 유지. 3 번째 파일이 필요하면 Follow-ups 로. doc-only direct 라 PR · reviewer 미경유(§3.1 rule 1).

## Out of Scope

- **새 dispatch · rerun** — 본 slice 의 정의 자체가 "재 dispatch 0 으로 같은 로그 회수" 다. 로그가 만료돼 회수 불가면 그 사실을 박제하고 재 dispatch 는 별도 task 로 넘긴다.
- **임계 숫자 실제 변경** — `§3` 표 `900ms` · 각주 · `STUB_BASELINE_P95_MS` · `S1_STUB_BASELINE_P95_MS` 수정 금지. 규칙 ④ 가 **코드 `pr` / 문서 `direct` 2 task split** 를 못 박았고, 한 task 로 합치는 순간 `commitMode` 가 갈린다(CLAUDE.md §3.1 rule 3).
- **T-1668 규칙 소절(`222~249 행`) 편집** — 규칙 문장 자체는 불변. 규칙 ② 가 요구한 "본 규칙 소절 박제" 는 숫자를 실제로 갱신하는 ④-(ii) task 소관.
- **`.github/workflows/load-k6.yml` 의 `if: always()` 추가** — S2 step skip 을 푸는 변경은 임계 판단과 얽혀 있어 별도 판단 대상(T-1674 Follow-up ③).
- **S2 재 dispatch · S2 수치 회수** — S1 게이트 처리 전에는 계속 skip 된다(T-1674 Follow-up ③). 본 slice 는 S1 축 전용.
- **`K6_SEED_PERSONS` 상한 상향 · S3 축 dataset 교체** — 각각 별도 판단 · 별도 slice.
- **outlier 제거 · 임계 하향 · 새 산정식(`max` 기반 · p99 기반 등)** — 규칙 ② · ③ 이 명시 금지.
- [docs/ops/realdata-scale-devset.md](../ops/realdata-scale-devset.md) 편집 — `§A`/`§B` 표는 drift guard 파싱 대상.
- **실 수집 왕복 축**(GitHub/Confluence 자격증명 주입) — CLAUDE.md §5 BLOCKED 사유(외부 자격증명)라 오너 결정 선행.
- `deploy/daily-test.sh` leg 추가 — drift-guard smoke 3 종 동반으로 5 파일 cap 초과(T-1122 / Q-0054 선례).

## Suggested Sub-agents

`implementer` (로그 재독 + 산정 대입 + 문서 반영) → `tester` (`pnpm test` green · 코드/상수/워크플로 무변경 확인)

## Follow-ups

(생성 시 비어 있음 — sub-agent 가 관련 작업을 발견하면 여기에 append)
