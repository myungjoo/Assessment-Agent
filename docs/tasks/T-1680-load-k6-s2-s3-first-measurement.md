---
id: T-1680
title: not-cancelled 게이트 배선 후 첫 dispatch 로 S2 · S3 실측 회수 + §3.1 회차 기록
phase: P5
status: PENDING
commitMode: direct
coversReq: [REQ-048]
estimatedDiff: 180
estimatedFiles: 2
independentStream: load-k6-s2-baseline
dependsOn: [T-1678, T-1679]
touchesFiles:
  - docs/ops/load-resilience-test-plan.md
  - docs/PLAN.md
created: 2026-08-25
plannerNote: P5 R-91 chain 60/N — T-1678 Follow-up ① (dispatch 정확히 1 회로 S2 2 회차 · S3 1 회차 신설, 임계·코드 변경 0)
---

# T-1680 — not-cancelled 게이트 배선 후 첫 dispatch 로 S2 · S3 실측 회수 + §3.1 회차 기록

## Why

오너 지시(PLAN `144 행` 🔴🔴 ADR-0054 R-91 chain, `141 행` 실측 이력)의 잔여 축은 **S2 · S3 실측이 아직 0 회**라는 사실이다. [T-1674](T-1674-load-k6-s2-first-measurement.md) 가 S2 첫 dispatch 를 소진했지만 `load-k6.yml` 의 S2 · S3 step 에 `if:` 가 없어 S1 leg 가 red 인 순간 두 leg 가 통째로 `skipped` 됐고, 수확은 0 이었다. 그 구조 결함은 [T-1678](T-1678-load-k6-s2-s3-step-not-cancelled-gate.md)(PR #1335 → main `8af5b06d`)이 `if: ${{ !cancelled() }}` 로 닫았고, 문서 축 drift 는 [T-1679](T-1679-not-cancelled-gate-doc-sync.md)(main `04a53ecd`)가 닫았다. 즉 **지금 쏘면 S1 결과와 무관하게 S2 · S3 수치가 남는다** — 본 slice 는 T-1678 Follow-up ① 로, `load-k6.yml` 을 **정확히 1 회** dispatch 해 S2 · S3 수치를 회수하고 `§3.1` 에 `S2 2 회차` · `S3 1 회차` 소절로 박제한다. 임계 숫자와 코드는 한 글자도 바꾸지 않는다(`§3` "baseline 후 fix" 표기 · S1 축 `1100ms` 모두 무변경 — 표본 1 회는 재확정 근거가 못 된다는 S1 축 2 단계 선례 승계).

## Required Reading

- [docs/ops/load-resilience-test-plan.md](../ops/load-resilience-test-plan.md) `758~828 행` `#### S2 1 회차 (T-1674, ...)` 소절 전문 — 본 slice 가 **이어서 쓰는 직전 회차**이자 항목 구성의 본보기(측정 일시/run · 표본 로그 원문 · seed step 결과 · THRESHOLDS 원문 · 수치 · 공유 dataset 보존 계약 · 환경 메타 · `§3` 무변경 판정 · 의미/한계). 특히 꼬리의 **【(d) 무효】 표기**(T-1678 배선으로 "S1 red → S2 skip" 이 더 이상 사실이 아님) — 본 dispatch 의 전제다. **이 소절은 편집하지 않는다**(단 (c)/(d) 처럼 1 줄 pointer append 는 아래 AC 가 지정한 곳만).
- [docs/ops/load-resilience-test-plan.md](../ops/load-resilience-test-plan.md) `692~757 행` `#### 11 회차 (T-1675, ...)` 소절 — 가장 최근에 실측을 박제한 서식(로그 원문 인용 방식 · 환경 메타 7 항목 · 판정 문장 톤). 서식은 이쪽을 따른다.
- [docs/ops/load-resilience-test-plan.md](../ops/load-resilience-test-plan.md) `67~158 행` `#### S2 dataset 교체 설계 (사전 박제)` — 특히 ②(teardown 의 person DELETE 제거 = 공유 dataset 보존 계약) · ③(`K6_SEED_PERSONS` 의미 = 생성 수가 아니라 **조회 결과에서 취할 표본 상한**, 상한 상향은 **첫 실측 이후 별도 판단**) · ⑤(임계 숫자 변경 0). 본 실측이 실증해야 할 명제가 여기 있다. **이 소절 자체는 편집하지 않는다.**
- [docs/ops/load-resilience-test-plan.md](../ops/load-resilience-test-plan.md) `171~213 행` `§3` 임계 표 — S2 축 3 행(`181~183 행`) · S3 축 2 행(`184~185 행`) · S1 축 `1100ms` 행 모두 본 slice 가 **무변경으로 유지**할 대상.
- [docs/ops/load-resilience-test-plan.md](../ops/load-resilience-test-plan.md) `265 행` `### 3.1 baseline 실측 기록 (S1 11 회분 · S2 1 회분)` 헤더 — 개수 표기 갱신 자리.
- [docs/ops/load-resilience-test-plan.md](../ops/load-resilience-test-plan.md) `§5` item 5(`877 행` 부터 그 항목 끝까지) — 진척 문단 append 자리(T-1679 가 append 한 문단 뒤에 이어 붙인다).
- [test/load/s2-read.js](../../test/load/s2-read.js) `34~36 행`(표본 상한 주석) · `57~73 행`(`options.thresholds` **6 종**: 전역 `http_req_duration p(95)<3000` · `http_req_failed rate<0.01` · route 별 `persons` · `groups` · `parts` · `me`) · `89~97 행`(`[s2-read] devset 표본 취득 N명 / 필터 통과 M건 / 상한 30명` 로그 배선) — 로그에서 무엇을 찾아야 하는지의 근거. **코드는 읽기만 한다.**
- [test/load/s3-concurrent.js](../../test/load/s3-concurrent.js) `21~37 행` — ramping stages 3 단(`10s→5 VU` · `10s→20 VU` · `5s→0`) 과 임계 **4 종**(전역 2 + route `read` · `write` 각 `p(95)<3000`). **코드는 읽기만 한다.**
- [.github/workflows/load-k6.yml](../../.github/workflows/load-k6.yml) `194~217 행` — S2 step(`if: ${{ !cancelled() }}`, `K6_SEED_PERSONS: "30"`) · S3 step(같은 `if:`) 의 현행 배선. **워크플로는 읽기만 한다.**
- [docs/PLAN.md](../PLAN.md) `140~141 행` — R-91 checkbox 와 실측 이력 꼬리(1~3 문장 append 자리).

## Acceptance Criteria

- [ ] **dispatch 정확히 1 회** — `gh workflow run load-k6.yml --ref main -f s1_persons=133` 을 **한 번만** 실행하고, run 종료까지 기다린 뒤 `gh run view <id> --log` 로 회수한다. **rerun · 재 dispatch · 재시도 0** 임을 commit trail 에 명시한다(7 회차 · S2 1 회차 선례 — fail 이어도 다시 쏘지 않고 원인만 박제). run 이 infra 사유(runner 미취득 등)로 0 step 취소되면 그 사실만 박제하고 실측 회수는 별도 task 로 이월한다.
- [ ] [docs/ops/load-resilience-test-plan.md](../ops/load-resilience-test-plan.md) `§3.1` 의 **`#### S2 1 회차` 소절 뒤**에 `#### S2 2 회차 (T-1680, run <id>, T-1678 not-cancelled 게이트 배선 후 첫 dispatch)` 소절을 신설하고, S2 1 회차와 **같은 항목 구성**으로 아래를 박제한다. 인용은 로그 **원문 그대로**, 추정 · 재계산 **0**, 자격증명 · cookie · email 원문 인용 금지.
  - [ ] **측정 일시 / run** — dispatch 시각(UTC) · run id · head sha · job 구간과 소요 · S2 step 구간 · k6 exit code · step 성공/failure/skip 개수. **S2 step 이 `skipped` 가 아니라 실제 실행됐다**는 사실(= T-1678 배선의 실 run 실증)을 1 문장으로 명시.
  - [ ] **S2 표본 로그 원문** — `[s2-read] devset 표본 취득 N명 / 필터 통과 M건 / 상한 30명` 줄을 원문 그대로 인용하고 `N` · `M` · 상한 `30` 세 수의 관계를 판정(상한에 잘렸는지 · 필터 통과가 devset 133 과 일치하는지). 줄이 없으면 없다고 적는다(칸 채우기 금지).
  - [ ] **seed step 결과** — `devset seed 완료 — person 133 건 / serviceIdentity 133 건 적재` 원문 + T-1664 fix 연속 성공 회차 수 갱신. 2~3 줄 + pointer 로 압축.
  - [ ] **k6 THRESHOLDS 원문** — `s2-read.js` 임계 **6 종** 각각의 `✓` / `✗` 를 로그 원문 그대로. 6 종이 모두 등장하는지(개수 판정 포함).
  - [ ] **수치** — route 별 p95(`persons` · `groups` · `parts` · `me`) · 전역 p50 / p95 / p99 · `http_req_failed` · `http_reqs` · `iteration_duration`. 미회수 항목은 **미확보**로 적고 다른 회차 값을 전용하지 않는다.
  - [ ] **공유 dataset 보존 계약 검증(설계 ②)** — S2 teardown 이 돌고 난 뒤에도 뒤따르는 S3 leg 가 빈 DB 를 만나지 않았는지를 로그 사실로 판정. 판정 불가면 불가 사유를 적는다.
  - [ ] **설계 ③ 실증 판정** — 부하를 만드는 것이 `GET /api/persons` 응답 **행 수**이고 상한 `30` 은 `setup()` 메모리 배열 길이일 뿐이라는 전제가 이번 로그로 실증됐는지. **상한 상향(30 → 133) 은 본 slice 에서 결정하지 않고** 판단 근거만 남긴다(설계 ③ 의 "별도 판단" 승계 — Follow-ups 로).
  - [ ] **환경 메타** — 커널 · 아키텍처 · vCPU · 메모리 · DB image · 부하 대상 image · `K6_S1_PERSONS` **7 항목**을 로그에서 회수하고 직전 회차들과 동일한지 판정.
  - [ ] **`§3` 표 S2 축 무변경 판정** — 표본이 **1 회**뿐이라 재확정 근거가 못 된다는 문장을 명시하고 p95 `< 3s` · p50/throughput `baseline 후 fix` · error rate `< 1%` 를 무변경 유지(S1 축의 T-1668 규칙 사전 박제 → T-1669 기계 적용 2 단계 선례 인용).
  - [ ] **의미 / 한계** — (a) LLM stub(ADR-0057 `D1`) · 실 수집 왕복 **0** 조건이 S2 축에도 걸리므로 얻은 것은 *stub 조건의* 조회 지연이라는 점. (b) S1 leg 결과와의 독립성(게이트 배선 덕에 S1 판정이 S2 수확을 좌우하지 않음). (c) 같은 run 의 S1 leg 수치(12 회차)는 **본 slice Out of Scope** 이며 재 dispatch **0** 으로 회수 가능하다는 pointer.
- [ ] 같은 `§3.1` 에 **`#### S3 1 회차 (T-1680, run <id>, S3 축 첫 실측)`** 소절을 S2 2 회차 뒤에 신설하고 아래를 박제한다(S3 는 첫 회차라 서식을 여기서 정한다 — 항목명은 S2 소절과 동일 어휘 사용).
  - [ ] **측정 일시 / run · step 구간 · k6 exit code** — 같은 run 안의 S3 step 이 실행됐다는 사실 포함.
  - [ ] **k6 THRESHOLDS 원문** — `s3-concurrent.js` 임계 **4 종**(전역 `http_req_duration p(95)<3000` · `http_req_failed rate<0.01` · route `read` · `write`) 각각의 `✓` / `✗`.
  - [ ] **수치** — 전역 p50 / p95 / p99 · route 별 p95(`read` · `write`) · `http_req_failed` · `http_reqs` · `iteration_duration` · VU 단계별 관찰 가능한 값. 미회수는 **미확보** 표기.
  - [ ] **latency cliff 판정** — ramping 3 단(5 VU → 20 VU → 0) 에서 단계별 저하 곡선에 cliff 가 보이는지 **로그가 허용하는 범위에서만** 판정하고, 단일 요약만으로 단계 분해가 불가하면 "요약 지표로는 단계 분해 불가"를 그대로 적는다(추정 금지).
  - [ ] **write leg 자기정리 확인** — S3 write 가 iteration 안에서 자기 정리한다는 워크플로 주석의 전제가 로그상 어긋나지 않는지(잔여 row · 오류 폭증 징후 부재) 1~2 문장.
  - [ ] **`§3` 표 S3 축 무변경 판정** — error rate `< 1% (baseline 후 fix)` · p95 저하 곡선 `latency cliff 부재` 는 표본 1 회로 fix 하지 않는다(무변경).
- [ ] `§3.1` 헤더를 `### 3.1 baseline 실측 기록 (S1 11 회분 · S2 2 회분 · S3 1 회분)` 로 갱신.
- [ ] `#### S2 1 회차` 소절 꼬리(【(d) 무효】 표기 문단 끝)에 **1 줄** pointer append — "게이트 배선 후 첫 dispatch 는 T-1680 이 집행했고 S2 수치는 `#### S2 2 회차` 에 있다". 그 소절의 다른 문장은 **무변경**(소급 치환 금지, `§ 12.76` AC 3).
- [ ] `§5` item 5 에 1~3 줄 append — S2 · S3 실측 첫 회수 사실 + 회차 pointer. **S1 축 표기 · 임계 숫자 표기는 무변경**.
- [ ] [docs/PLAN.md](../PLAN.md) `141 행` 꼬리에 1~3 문장 append — S2 · S3 축 실측 첫 회수 · run id · 임계 무변경. **`140 행` checkbox `[ ]` 무변경**(LLM stub · 실 수집 왕복 0 조건 불변).
- [ ] **코드 · 워크플로 · spec · 임계 상수 변경 0** — `test/load/s1-batch.js` · `test/load/s2-read.js` · `test/load/s3-concurrent.js` · `.github/workflows/load-k6.yml` · `package.json` · `test/smoke/load-workflow-k6-harness-wiring-drift.smoke-spec.ts` 모두 무변경.
- [ ] `pnpm lint` 무경고 + `pnpm test` green(453 suite 기준) — 특히 drift-guard smoke 통과로 상수 · 워크플로 무변경을 재확인. doc-only direct 라 R-110 tester 의무는 면제이나 확인용으로 실행한다.
- [ ] 변경 파일 **2 개**(`load-resilience-test-plan.md` · `PLAN.md`) 유지. 3 번째 파일이 필요하면 Follow-ups 로. PR · reviewer 미경유(§3.1 rule 1).

## Out of Scope

- **S1 12 회차 소절 회수** — 같은 run 의 S1 leg 도 수치를 남기지만, 본 slice 는 S2 · S3 축만 박제한다. S1 회차 기록은 **재 dispatch 0** 으로 같은 run id 로그에서 회수하는 별도 `direct` slice(T-1674 → T-1675 선례). run id 만 Follow-ups 에 남긴다.
- **임계 숫자 변경** — `§3` 표의 S1 `1100ms` · S2 `3s` · S3 `baseline 후 fix` 를 한 글자도 바꾸지 않는다. S2 · S3 축 재확정은 규칙 사전 박제 → 기계 적용 2 단계를 따로 밟는다.
- **`K6_SEED_PERSONS` 상한 상향(30 → 133)** — 설계 ③ 이 "첫 실측 이후 별도 판단" 으로 못 박았다. 판단 근거만 회차 소절에 남기고 변경은 별도 task.
- **워크플로 · k6 스크립트 편집** — 컨테이너 기동 실패 게이트(`steps.<id>.outcome`) 도입, S2/S3 step 조건 조정, 요약 export step 추가 전부 별도 slice.
- **재 dispatch · rerun** — run 이 fail 이어도 다시 쏘지 않는다. 원인만 박제한다.
- **`#### S2 dataset 교체 설계` 소절 · `§3` 표 · 기존 회차 소절 본문 편집** — 위 AC 가 지정한 pointer 1 줄과 헤더 개수 표기를 제외하면 무변경.

## Suggested Sub-agents

`implementer` (dispatch · 로그 회수 · 문서 박제) → 확인용 `tester`(lint/test green 확인, doc-only 라 신규 spec 0)

## Follow-ups

(작성 시점 비어 있음 — sub-agent 가 발견한 관련 작업을 여기에 append)
