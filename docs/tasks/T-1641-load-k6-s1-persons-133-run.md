---
id: T-1641
title: load-k6 를 s1_persons=133 으로 dispatch — 실 scale 표본 실측 후 부하계획 §3.1·§5 item 5 갱신
phase: P5
status: PENDING
commitMode: direct
coversReq: [REQ-047]
estimatedDiff: 90
estimatedFiles: 2
created: 2026-08-21
dependsOn: [T-1640]
touchesFiles:
  - docs/ops/load-resilience-test-plan.md
  - docs/PLAN.md
independentStream: load-harness-r91
plannerNote: "P5 R-91 chain 22/N — T-1640 이 연 s1_persons input 을 133 으로 첫 사용해 실 scale 표본 실측·기록(잔여 ① 절반 닫기)."
---

# T-1641 — `s1_persons=133` dispatch 로 실 scale 표본 S1 실측·기록

## Why

오너 지시([PLAN.md](../PLAN.md) `144 행`, [ADR-0054](../decisions/ADR-0054-load-resilience-harness-tool.md) ACCEPTED) 의 R-91 chain 에서 지금까지의 S1 실측 2 회(T-1637 · T-1639)는 모두 `K6_S1_PERSONS=10` **축소 표본**이라 [load-resilience-test-plan.md](../ops/load-resilience-test-plan.md) `§5` item 5 의 잔여 ①(실 scale 133 명)이 그대로 남아 있고, 그 때문에 [PLAN.md](../PLAN.md) `140 행` REQ-047 checkbox 도 `[ ]` 다. T-1640(main `f6c34b2d`) 이 표본 인원을 `workflow_dispatch` input `s1_persons` 로 열었으므로 이제 **워크플로·스크립트 수정 0** 으로 133 명 표본 run 이 가능하다. 본 slice 는 그 input 을 `133` 으로 **정확히 1 회** 사용해 [realdata-scale-devset.md](../ops/realdata-scale-devset.md) 규모의 표본 인원으로 S1 을 돌리고 수치를 박제한다 (코드·워크플로·임계 변경 0 — 순수 측정 + doc-sync).

## Required Reading

- [test/load/s1-batch.js](../../test/load/s1-batch.js) `25~52 행` — `SAMPLE_PERSONS`(`__ENV.K6_S1_PERSONS`) · `EXTRAPOLATION_PERSONS = 133` · `BATCH_P95_MS = FULL_RUN_BUDGET_MS × (SAMPLE_PERSONS / EXTRAPOLATION_PERSONS)` 재 선형 외삽 산식. **표본이 133 이면 외삽 계수가 1 이 되어 임계가 1h 예산 전체로 넓어진다** — 본 slice 의 수치 해석 근거.
- [.github/workflows/load-k6.yml](../../.github/workflows/load-k6.yml) `10~20 행`(input `s1_persons` 정의·default) 과 `105~150 행`(S1 실행 step · "S1 실측 요약 기록" step 의 `tee -a` 메타 7 항목).
- [docs/ops/load-resilience-test-plan.md](../ops/load-resilience-test-plan.md) `§3.1`(1 회차 · 2 회차 소제목 구조 — 본 slice 가 3 회차를 덧붙일 자리) 과 `§5` item 5(잔여 ①②).
- [docs/PLAN.md](../PLAN.md) `140~141 행` — REQ-047 checkbox 와 R-91 실측 상태 서술.
- [docs/decisions/ADR-0057-s1-batch-load-io-isolation.md](../decisions/ADR-0057-s1-batch-load-io-isolation.md) `D1`·`D4` — LLM stub 격리와 축소 표본 외삽의 한계(133 표본이어도 남는 미검증 축을 정확히 적기 위함).

## Acceptance Criteria

- [ ] `gh workflow run load-k6.yml --ref main -f s1_persons=133` 으로 **정확히 1 회** dispatch 하고 run id 를 확보한다 (`gh run list --workflow=load-k6.yml --limit 2`). head sha 가 T-1640 머지(`f6c34b2d`) 이후임을 확인한다 — 그 이전 sha 면 input 배선이 없어 본 slice 의 목적을 충족하지 못한다.
- [ ] run conclusion 을 확인한다 (`gh run view <id>` 또는 `gh run watch <id>`). 표본이 13 배라 job 시간이 길어질 수 있으므로 **45 분** 넘게 미종료면 대기를 중단하고 그 사실(진행 중이던 step 포함)을 기록한다.
- [ ] `gh run view <id> --log` 로 "S1 실측 요약 기록" step 의 **표본 인원 행이 `133` 임** 을 확인한다 — `10` 이면 input 주입이 실패한 것이므로 그 사실을 결함으로 기록하고 워크플로는 고치지 않는다(Follow-ups 로 넘긴다).
- [ ] 같은 로그에서 3 회차 S1 수치(`http_req_duration{route:batch}` p95 · `http_req_failed` rate 와 분모/분자 · `iteration_duration`)와 환경 메타 7 항목을 회수한다. 임계 위반으로 k6 가 exit 1 이어도 `if: always()` 기록 step 이 남긴 수치를 그대로 회수해 적는다.
- [ ] [docs/ops/load-resilience-test-plan.md](../ops/load-resilience-test-plan.md) `§3.1` 에 기존 1 회차 · 2 회차 소제목을 **삭제·수정 없이** 두고 `#### 3 회차 (T-1641, run <id>, 표본 133)` 소제목을 덧붙여 수치·메타·conclusion 을 적는다. 표본이 10 → 133 으로 달라 **1·2 회차와 직접 비교 불가**임을 1 절로 명시한다.
- [ ] 같은 문서 `§5` item 5 의 잔여 ① 을 결과에 맞게 **부분 해소**로 갱신한다 — `K6_S1_PERSONS` 상향 축은 본 run 으로 닫히고, **실 dataset seed(133 명 `Person` + github `ServiceIdentity` 실 수집) 축은 잔여로 존치**함을 명확히 구분해 적는다. 잔여 ②(반복 run 기반 임계 fix)는 그대로 남긴다.
- [ ] `§3` 표의 임계 숫자는 **무변경** — 표본 133 의 단일 run 으로도 임계를 확정하지 않는다(§3 각주의 over-fitting 방지 취지 유지).
- [ ] [docs/PLAN.md](../PLAN.md) `141 행` 에 3 회차 run id·표본 인원 133·핵심 수치를 1~2 절로 반영한다. **`140 행` checkbox 는 `[ ]` 유지** — LLM stub(ADR-0057 `D1`) · 외부 수집 왕복 0 · repo/page 축 미검증이라 REQ-047 완료 조건에 미달한다. 그 미달 사유를 그 절에 1 문장으로 남긴다.
- [ ] run 이 **실패**(임계 위반 · 컨테이너 부팅 실패 · runner 미할당 · timeout 등)해도 워크플로 · 스크립트 · 임계 · input default 를 **수정하지 않는다**. 실패 step · 원인 추정 · run id 를 위 두 문서에 같은 형식으로 기록하고 후속 조치는 본 파일 `Follow-ups` 에 1~3 줄로 남긴다.
- [ ] 기록한 어떤 수치 · 로그 인용에도 secret / credential 리터럴이 포함되지 않는다 (CLAUDE.md §9 — 더미 `AUTH_JWT_SECRET` · `LLM_APIKEY_ENC_KEY` 값도 문서로 옮기지 않는다).
- [ ] `git status --short` 결과가 위 `touchesFiles` 2 개 + 본 task 파일 · STATE · journal(driver 소관) 외 변경 0 임을 확인한다. `src/` · `test/` · `.github/` · `package.json` 변경 0.
- [ ] 분기 없음 · 코드 변경 0 인 direct doc-only task 라 R-112 unit test 4 항목(happy / error / 분기 / negative)은 해당 없음 (CLAUDE.md §3.2 — direct-mode doc-only 면제). 대신 위 "변경 0" 확인이 검증 항목이다.

## Out of Scope

- **`.github/workflows/load-k6.yml` · `test/load/*.js` · `package.json` 수정 금지** — 본 slice 는 측정 + 기록만. input default 를 133 으로 바꾸는 것도 금지(별도 slice 판단 사항).
- 133 명 실 dataset seed(`Person` + github `ServiceIdentity` 실 수집) — 별도 slice (오너 PLAN `147~148 행`).
- `§3` 표 임계 숫자 확정("baseline 후 fix" → 실수치 고정) — 단일 133 표본으로 고정하지 않는다.
- [docs/requirements.md](../requirements.md) 의 REQ-047 status flip · PLAN `140 행` checkbox flip — 실 수집 축 미검증이라 금지.
- S2 / S3 표본·시나리오 확장, `--summary-export` 의 S2/S3 적용 — T-1636 이 남긴 별도 follow-up.
- 2 회차 이상 반복 dispatch. runner 미할당 같은 명백한 infra 장애일 때만 **최대 1 회** 재시도하고, 그 이상은 기록 후 종료.
- R-92 per-route perf-spec 신규 slice(오너 지시로 큐잉 금지), 새 외부 dependency / action 도입, credential 추가.

## Suggested Sub-agents

`implementer`

## Follow-ups
