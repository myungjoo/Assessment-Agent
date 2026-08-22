---
id: T-1647
title: 배선된 900ms 게이트로 load-k6 를 s1_persons=133 재 dispatch — 게이트 런타임 활성·통과 여부 실측 기록
phase: P5
status: DONE
commitMode: direct
coversReq: [REQ-047]
estimatedDiff: 100
estimatedFiles: 2
created: 2026-08-22
createdAt: 2026-08-22T07:05:00Z
completedAt: 2026-08-22T08:52:00Z
dependsOn: [T-1645, T-1646]
touchesFiles:
  - docs/ops/load-resilience-test-plan.md
  - docs/PLAN.md
independentStream: load-harness-r91
plannerNote: "P5 R-91 chain 28/N — T-1645 가 배선한 900ms 조건부 게이트가 실제 run 에서 활성·판정되는지 1 회 dispatch 로 실측."
---

# T-1647 — 배선된 900ms 게이트의 첫 실 run 검증 (`s1_persons=133`, 6 회차)

## Why

T-1645(PR #1316 → main `874297ca`) 가 stub 조건 baseline `p(95)<900` 을 [`test/load/s1-batch.js`](../../test/load/s1-batch.js) `thresholds` 에 **표본 133 일 때만** 얹는 조건부 게이트로 배선했고, T-1646 이 그 사실을 문서에 동기했다. 그러나 그 게이트가 **실제 CI run 에서 활성화되어 k6 가 임계로 평가하는지**는 아직 smoke(스크립트 본문 실평가)로만 확인됐고 실 run 증거가 0 이다. 본 slice 는 같은 조건(`s1_persons=133`)으로 load-k6 를 **정확히 1 회** dispatch 해 ① k6 threshold 출력에 `p(95)<900` 행이 실제로 나타나는지, ② 그 게이트가 통과(green)인지 차단(red)인지, ③ 6 회차(실 scale 4 번째) 수치가 900ms 마진 안에 드는지를 실측·기록한다. 오너 지시(PLAN `144 행` "R-91 k6 최우선·즉시 착수") chain 28/N 이며 스크립트·워크플로·임계 숫자 변경 0 인 순수 측정 + doc-sync 다.

## Required Reading

- [docs/ops/load-resilience-test-plan.md](../ops/load-resilience-test-plan.md) `§3` 표의 S1 관찰용 p95 행 + `98~127 행` 도출식·각주(900ms 가 관찰용 baseline 이고 REQ-047 판정 임계는 1h 예산이라는 성격 구분, T-1646 이 박은 배선 좌표) + `§3.1` 헤더 "N 회분" 표기와 `250~292 행` 5 회차 서술 형식(본 slice 가 6 회차를 덧붙일 자리) + `§5` item 5 (잔여 ① 실 dataset seed 만 남은 상태).
- [test/load/s1-batch.js](../../test/load/s1-batch.js) `25~60 행` — `SAMPLE_PERSONS`(`__ENV.K6_S1_PERSONS`) · `EXTRAPOLATION_PERSONS = 133` · `BATCH_P95_MS` 외삽 산식 · `STUB_BASELINE_PERSONS = 133` · `STUB_BASELINE_P95_MS = 900` 과 `http_req_duration{route:batch}` 임계 배열의 조건부 concat. **표본 133 일 때 임계 2 개, 표본 10 일 때 1 개**가 본 slice 검증 대상이다.
- [.github/workflows/load-k6.yml](../../.github/workflows/load-k6.yml) `10~20 행`(input `s1_persons` 정의·default `"10"`) + S1 실행 step + `if: always()` "S1 실측 요약 기록" step(`tee -a` 메타 7 항목).
- [docs/PLAN.md](../PLAN.md) `140~141 행` — REQ-047 checkbox 와 R-91 실측 상태 서술(본 slice 가 갱신할 문장), `144 행` 오너 지시.
- [docs/decisions/ADR-0057-s1-batch-load-io-isolation.md](../decisions/ADR-0057-s1-batch-load-io-isolation.md) `D1`·`D4` — LLM stub 격리와 축소 표본 외삽의 한계(잔여 미검증 축을 정확히 적기 위함).

## Acceptance Criteria

- [ ] `gh workflow run load-k6.yml --ref main -f s1_persons=133` 으로 **정확히 1 회** dispatch 하고 run id 를 확보한다 (`gh run list --workflow=load-k6.yml --limit 3`). 재 dispatch·재시도 금지 — 실패해도 그 사실을 기록한다.
- [ ] run conclusion 을 확인한다 (`gh run view <id>` 또는 `gh run watch <id>`). **45 분** 넘게 미종료면 대기를 중단하고 그 사실(진행 중이던 step 포함)을 기록한다.
- [ ] `gh run view <id> --log` 에서 k6 의 **threshold 출력 블록**을 회수해, `http_req_duration{route:batch}` 에 대해 임계가 **2 개**(`p(95)<3600000` 외삽 판정 임계 + `p(95)<900` stub baseline 게이트) 로 나타나는지 확인한다. 각 임계의 통과/실패 표기(`✓`/`✗`)를 그대로 인용한다. **임계가 1 개만 보이면 배선이 런타임에 활성화되지 않은 결함**이므로 그 사실을 결함으로 기록하고 스크립트는 고치지 않는다(Follow-ups 로 넘긴다).
- [ ] "S1 실측 요약 기록" step 로그의 **표본 인원 행이 `133`** 임을 확인한다 — `10` 이면 input 주입 실패이므로 결함으로 기록한다.
- [ ] 같은 로그에서 6 회차 수치(`http_req_duration{route:batch}` p95 · `http_req_failed` rate 와 분자/분모 · `iteration_duration` · `http_reqs`)와 환경 메타 7 항목(커널·아키텍처·vCPU·메모리·DB image·대상 image·표본 인원)을 회수한다. 900ms 게이트 위반으로 k6 가 exit 1 이어도 `if: always()` 기록 step 이 남긴 수치를 그대로 회수해 적는다. 메타 7 항목이 3~5 회차와 **다른 항목이 있으면 그 차이를 명시**한다.
- [ ] [docs/ops/load-resilience-test-plan.md](../ops/load-resilience-test-plan.md) `§3.1` 에 기존 1~5 회차 소제목을 **삭제·수정 없이** 두고 `#### 6 회차 (T-1647, run <id>, 표본 133 4 회째 — 900ms 게이트 첫 실 run)` 소제목을 덧붙인다. 소제목 회차 수와 `§3.1` 헤더의 "N 회분" 표기를 함께 맞춘다.
- [ ] 같은 6 회차 항목에 **게이트 검증 결과**를 별도 bullet 으로 명시한다 — (a) `p(95)<900` 임계가 threshold 출력에 등장했는가(예/아니오, 인용), (b) 통과/차단 어느 쪽인가, (c) 측정 p95 와 900ms 사이 여유(ms 와 %) 를 적는다.
- [ ] 같은 항목에 **실 scale 표본 4 개(3~6 회차)의 기술통계**를 batch p95 기준으로 갱신한다 — 네 값 나열 · 평균 · 범위(max−min) · 표본표준편차(계산 근거 1 줄) · 변동계수(%) · **평균 + 3σ 재계산값이 900ms 를 넘는지 여부**. `iteration_duration` 과 `http_req_failed` 도 네 회차 값을 나열한다.
- [ ] `§3` 표의 임계 **숫자(≤ 900ms · error rate < 1% · S2 · S3 행)는 문자 그대로 무변경** 으로 둔다. 4 표본 평균 + 3σ 가 900ms 를 넘더라도 본 slice 는 그 사실 기록까지이고 재확정은 별도 slice 로 넘긴다(그 경우 `§5` item 5 에 후속 후보로 한 줄 추가).
- [ ] 같은 문서 `§5` item 5 를 결과에 맞게 갱신하되 잔여 ①(실 dataset seed + `ServiceIdentity` 실 수집)은 그대로 존치하고, **"배선된 게이트의 런타임 활성 여부" 축이 본 slice 로 해소됐음**(또는 결함이 남았음)을 한 문장으로 명시한다.
- [ ] [docs/PLAN.md](../PLAN.md) `141 행` R-91 실측 서술을 "baseline 실측 6 회(그중 실 scale 표본 133 이 4 회)" 형태로 갱신하고 본 run id · 게이트 활성/통과 결과 · 4 표본 요약(평균·범위)을 한 구절로 반영한다. `140 행` REQ-047 checkbox 는 `[ ]` **유지** — LLM stub · 수집 왕복 0 · 단일 iteration 한계 무변경이므로 승격 금지.
- [ ] 변경 파일 2 개(`docs/ops/load-resilience-test-plan.md`, `docs/PLAN.md`) 를 넘지 않고 diff ≤ 300 LOC. 코드·워크플로·스크립트 변경 0 이라 CLAUDE.md `§3.2` R-112 unit test 4 항목은 **비적용**(doc-only direct commit) — 대신 위 로그·threshold 출력 회수 항목이 검증 수단이다.

## Out of Scope

- `.github/workflows/load-k6.yml` · `test/load/s1-batch.js` · `package.json` 수정 (본 slice 는 측정·기록만). 게이트가 활성화되지 않는 결함이 확인돼도 본 slice 에서 고치지 않는다.
- `§3` 표 임계 숫자 재확정 (4 표본 기준 재도출은 별도 slice 후보로만 기록).
- 표본 10 조건 대조 run 추가 dispatch — 조건부 비활성은 T-1645 smoke 가 이미 cover.
- `s1-batch.js` 의 `iterations`·VU 프로파일 파라미터화.
- 실 dataset seed(133 명 `Person` + github `ServiceIdentity` 실 수집) · LLM stub 해제 — 잔여 ① 은 손대지 않는다.
- PLAN `140 행` checkbox 승격, REQ-047 완료 선언.
- R-92 per-route perf-spec 신규 slice (오너 지시로 큐잉 금지 유지).
- 2 회 이상 dispatch 또는 실패 run 재시도.

## Suggested Sub-agents

`implementer` (dispatch + threshold/로그 회수 + 4 표본 기술통계 산출 + doc 갱신) → 코드 변경 0 이라 `tester` 불요 (direct doc-only, R-110 면제 경로).

## Follow-ups

- 게이트 결함 0 (임계 2 개 모두 등장·통과) 이라 스크립트 수정 후속 없음.
- `§3` 표 임계 재확정 불요 — 4 표본 평균+3σ = 855.19ms 로 900ms 미초과. 표본이 더 쌓여 3σ 가 900ms 를 넘으면 그때 별도 slice.
- 잔여 축은 `§5` item 5 ① 실 dataset seed(133 명 `Person` + github `ServiceIdentity` 실 수집) 1 개.
