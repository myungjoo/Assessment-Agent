---
id: T-1639
title: load-k6 2 회차 dispatch — stdout 로 환경 메타 회수 실증 후 부하계획 §3.1·§5 item 5 갱신
phase: P5
status: PENDING
commitMode: direct
coversReq: [REQ-047]
estimatedDiff: 80
estimatedFiles: 2
created: 2026-08-21
dependsOn: [T-1638]
touchesFiles:
  - docs/ops/load-resilience-test-plan.md
  - docs/PLAN.md
independentStream: load-harness-r91
plannerNote: "P5 R-91 chain 20/N — T-1638 tee 배선을 실 run 으로 실증하고 §3.1 '회수되지 않았다' 문장을 실측 메타로 교체."
---

# T-1639 — load-k6 2 회차 dispatch 로 환경 메타를 stdout 에서 회수·박제

## Why

오너 지시([PLAN.md](../PLAN.md) `144 행`, [ADR-0054](../decisions/ADR-0054-load-resilience-harness-tool.md) ACCEPTED) 의 R-91 chain 에서 T-1637 의 첫 실측은 **커널·아키텍처·vCPU·메모리 메타가 job summary 전용 적재라 API·로그로 회수되지 않는다**는 결함을 실증했고, T-1638(`55b81dea`) 이 그 기록 step 의 출력 3 곳을 `| tee -a` 로 전환해 배선을 닫았다. 그러나 **머지 이후 load-k6 run 은 0 회** 라 그 배선이 실제로 stdout 에 메타를 남기는지는 아직 미검증이고, [load-resilience-test-plan.md](../ops/load-resilience-test-plan.md) `§3.1` 은 여전히 "REST API·job 로그로는 회수되지 않았다" 로 남아 있다. 본 slice 는 harness 를 **정확히 1 회 더 dispatch** 해 그 회수를 실증하고, 부수적으로 얻는 2 번째 표본으로 run-to-run 분산의 첫 데이터를 기록한다 (코드·워크플로·임계 변경 0 — 순수 측정 + doc-sync).

## Required Reading

- [.github/workflows/load-k6.yml](../../.github/workflows/load-k6.yml) `112~149 행` — "S1 실측 요약 기록" step 의 `tee -a` 3 곳과 메타 7 항목(커널 · 아키텍처 · vCPU · 메모리 · PostgreSQL image · 부하 대상 image · `K6_S1_PERSONS`).
- [docs/ops/load-resilience-test-plan.md](../ops/load-resilience-test-plan.md) `§3.1` (baseline 실측 기록 — 본 slice 가 갱신할 "환경 메타" bullet 과 수치 bullet) 및 `§5` item 5 (잔여 ①②③ 중 ③ 이 본 slice 대상).
- [docs/PLAN.md](../PLAN.md) `140~141 행` — REQ-047 checkbox 와 R-91 harness/실측 상태 서술.
- [docs/decisions/ADR-0057-s1-batch-load-io-isolation.md](../decisions/ADR-0057-s1-batch-load-io-isolation.md) `D4` — 축소 표본(10 명) 외삽 산식과 그 한계 (2 회차 수치 해석의 근거).

## Acceptance Criteria

- [ ] `gh workflow run load-k6.yml --ref main` 으로 **정확히 1 회** dispatch 하고 run id 를 확보한다 (`gh run list --workflow=load-k6.yml --limit 2`). head sha 가 T-1638 머지(`55b81dea`) 이후임을 확인한다 — 그 이전 sha 면 tee 배선이 없는 run 이라 본 slice 의 목적을 충족하지 못한다.
- [ ] run conclusion 을 확인한다 (`gh run view <id>` 또는 `gh run watch <id>`). 30 분 넘게 미종료면 대기를 중단하고 그 사실을 기록한다.
- [ ] **`gh run view <id> --log` 만으로** (run 페이지 job summary 를 열지 않고) 메타 7 항목 전부를 회수한다. 회수 성공 시 커널 · 아키텍처 · vCPU · 메모리 실제 값을 확보하고, 회수 실패 시 실패 양상(어느 항목이 로그에 없는지)을 그대로 기록한다.
- [ ] [docs/ops/load-resilience-test-plan.md](../ops/load-resilience-test-plan.md) `§3.1` 의 "환경 메타" bullet 에서 "**REST API·job 로그로는 회수되지 않았다**" 문장을 실측 결과로 교체한다 — 회수 성공이면 회수된 커널·아키텍처·vCPU·메모리 값 + 회수 경로(T-1638 `tee -a`, run id) 를, 실패면 실패 사실과 남은 원인을 적는다. 1 회차(run 32459501970) 기록은 삭제하지 않고 2 회차를 구분 가능하게 덧붙인다.
- [ ] 같은 `§3.1` 에 2 회차 S1 수치(`http_req_duration{route:batch}` p95 · `http_req_failed` rate · `iteration_duration`) 를 1 회차와 **나란히** 적어 run-to-run 분산의 첫 2 표본임을 명시한다. **`§3` 표의 임계 숫자는 무변경** — 2 표본으로 임계를 확정하지 않는다.
- [ ] 같은 문서 `§5` item 5 의 잔여 목록에서 ③(환경 메타 회수 경로 보강) 을 결과에 맞게 갱신한다 — 회수 성공이면 "T-1638 배선 + T-1639 실증으로 해소" 로 닫고, 실패면 잔여로 유지하되 원인을 1 절로 좁힌다. 잔여 ①(실 scale 133 명) · ②(반복 run 기반 임계 fix) 는 그대로 남긴다.
- [ ] [docs/PLAN.md](../PLAN.md) `141 행` 의 실측 서술에 2 회차 run id 와 표본 수(2 회) 를 1 절로 반영한다. **`140 행` checkbox 는 `[ ]` 유지** — 여전히 `K6_S1_PERSONS=10` 축소 표본이라 REQ-047 의 100~200 명 실 scale 은 미검증이다.
- [ ] run 이 **실패**(임계 위반 · 컨테이너 부팅 실패 · runner 미할당 등)해도 워크플로 · 스크립트 · 임계를 **수정하지 않는다**. 실패 step · 원인 추정 · run id 를 위 두 문서에 같은 형식으로 기록하고 후속 조치는 본 파일 `Follow-ups` 에 1~3 줄로 남긴다.
- [ ] 기록한 어떤 수치 · 로그 인용에도 secret / credential 리터럴이 포함되지 않는다 (CLAUDE.md §9 — `AUTH_JWT_SECRET` · `LLM_APIKEY_ENC_KEY` 의 더미 값도 문서에 옮기지 않는다).
- [ ] `git status --short` 결과가 위 `touchesFiles` 2 개 + 본 task 파일 · STATE · journal(driver 소관) 외 변경 0 임을 확인한다. `src/` · `test/` · `.github/` 변경 0.
- [ ] 분기 없음 · 코드 변경 0 인 direct doc-only task 라 R-112 unit test 항목은 해당 없음 (CLAUDE.md §3.2 — direct-mode doc-only 면제). 대신 위 "변경 0" 확인이 검증 항목이다.

## Out of Scope

- **`.github/workflows/load-k6.yml` · `test/load/*.js` · `package.json` 수정 금지** — 본 slice 는 측정 + 기록만. 회수 결함이 또 보여도 고치지 말고 Follow-ups 로 넘긴다 (CLAUDE.md §3).
- 실 scale 133 명 dataset seed · `K6_S1_PERSONS` 상향 run — 별도 slice (오너 PLAN `147~148 행`).
- `§3` 표 임계 숫자 확정("baseline 후 fix" → 실수치 고정) — 2 표본으로 고정하지 않는다.
- S2 / S3 에 `--summary-export` + 기록 step 확장 — T-1636 이 남긴 별도 follow-up.
- [docs/requirements.md](../requirements.md) 의 REQ-047 status flip — 실 scale 미검증이라 금지.
- 3 회차 이상 반복 dispatch. runner 미할당 같은 명백한 infra 장애일 때만 **최대 1 회** 재시도하고, 그 이상은 기록 후 종료.
- 새 외부 dependency / action 도입, credential 추가 (CLAUDE.md §5 게이트).

## Suggested Sub-agents

`implementer`

## Follow-ups
