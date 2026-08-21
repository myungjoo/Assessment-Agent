---
id: T-1637
title: load-k6 워크플로 1 회 dispatch — S1 baseline 실측 회수 후 부하계획 §3·§5 · PLAN 141 행 기록
phase: P5
status: PENDING
commitMode: direct
coversReq: [REQ-047]
estimatedDiff: 80
estimatedFiles: 2
created: 2026-08-21
dependsOn: [T-1636]
touchesFiles:
  - docs/ops/load-resilience-test-plan.md
  - docs/PLAN.md
independentStream: load-harness-r91
plannerNote: "P5 R-91 chain 18/N — 오너 PLAN 144 행 ②. 부하계획 §5 item 5(baseline 실측 1 회) 잔여를 실 run 으로 닫는다."
---

# T-1637 — load-k6 워크플로 1 회 dispatch 해 S1 baseline 실측을 회수·기록

## Why

오너 지시([PLAN.md](../PLAN.md) `144 행` ②, [ADR-0054](../decisions/ADR-0054-load-resilience-harness-tool.md) ACCEPTED) 의 R-91 chain 에서 스크립트·workflow step·npm script·요약 회수 경로까지 전부 main 에 shipped 됐고([load-resilience-test-plan.md](../ops/load-resilience-test-plan.md) `§5` item 3·4, T-1636 `b21d2bdc` 가 `--summary-export` + `$GITHUB_STEP_SUMMARY` 기록 step 배선), **잔여는 `§5` item 5 "baseline 확정 + 임계 fix" 하나** 다. 지금까지 실 run 은 0 회라 `§3` 표의 "baseline 후 fix" 임계가 여전히 미확정이고 [PLAN.md](../PLAN.md) `141 행` 도 "harness shipped · 실측 미착수" 로 남아 있다. 본 slice 는 harness 를 **실제로 1 회 dispatch** 해 S1 수치와 환경 메타를 회수하고, 그 사실을 두 문서에 박제해 harness 축을 닫는다 (코드·워크플로 변경 0 — 순수 측정 + doc-sync).

## Required Reading

- [.github/workflows/load-k6.yml](../../.github/workflows/load-k6.yml) — `workflow_dispatch` trigger, step 순서(smoke → S1 → "S1 실측 요약 기록" → S2 → S3 → 정리), `concurrency: load-k6`.
- [docs/ops/load-resilience-test-plan.md](../ops/load-resilience-test-plan.md) `§3` (측정 지표·임계 표 + "환경 고정" 요구) 와 `§5` item 5 (baseline 미착수 서술 — 본 slice 가 갱신할 문단).
- [docs/PLAN.md](../PLAN.md) `140~141 행` — REQ-047 checkbox 와 R-91 harness 상태 서술.
- [docs/decisions/ADR-0057-s1-batch-load-io-isolation.md](../decisions/ADR-0057-s1-batch-load-io-isolation.md) `D4` — 축소 표본(10 명) + 외삽 임계 산식. 실측값을 REQ-047 의 100~200 명 규모로 해석할 때의 근거·한계.

## Acceptance Criteria

- [ ] `gh workflow run load-k6.yml --ref main` 으로 **정확히 1 회** dispatch 하고 run id 를 확보한다 (`gh run list --workflow=load-k6.yml --limit 1`). 같은 workflow 의 중복 dispatch 금지.
- [ ] 그 run 의 conclusion 을 확인한다 (`gh run watch <id>` 또는 `gh run view <id>`). 종료까지 대기하되, 30 분 넘게 미종료면 대기를 중단하고 그 사실을 기록한다.
- [ ] 실측 수치를 회수한다 (`gh run view <id> --log` 의 k6 S1 step 출력 + "S1 실측 요약 기록" step 출력). 최소 다음을 확보: S1 의 `http_req_duration{route:batch}` p95, `http_req_failed` rate, iteration/배치 소요시간, 그리고 환경 메타(runner 커널·아키텍처·vCPU·메모리·PostgreSQL / 부하 대상 image 태그·`K6_S1_PERSONS` 값). S1 이 임계 위반으로 exit 1 이어도 기록 step 은 `if: always()` 라 메타·요약은 남는다.
- [ ] [docs/ops/load-resilience-test-plan.md](../ops/load-resilience-test-plan.md) `§3` 에 **baseline 실측 기록 문단 1 개** 를 표 아래에 추가한다: 측정 일시(UTC) · run id · 환경 메타 · S1 수치 · 축소 표본(10 명) 이라는 한계와 ADR-0057 `D4` 외삽 pointer. 표의 임계 숫자 자체는 이번에 바꾸지 않는다 (1 회 실측으로 over-fitting 하지 않는다 — 표 각주에 "실측 1 회분, 임계 fix 는 반복 run 후" 를 명시).
- [ ] 같은 문서 `§5` item 5 의 "**미착수 유지**(S1 은 harness 만 shipped, 실측 run 0)" 서술을 실측 1 회 완료 사실(run id · 날짜 · 결론)로 갱신하고, 잔여를 "실 scale(133 명, [realdata-scale-devset.md](../ops/realdata-scale-devset.md)) 실측 + 반복 run 기반 임계 fix" 로 좁혀 적는다.
- [ ] [docs/PLAN.md](../PLAN.md) `141 행` 의 "harness shipped · 실측 미착수" 를 "baseline 실측 1 회 완료(run id · 수치 요약) · 실 scale 미검증" 으로 정정한다. **`140 행` checkbox 는 `[ ]` 유지** — 표본 10 명 외삽이라 REQ-047 의 100~200 명 실 scale 은 여전히 미검증이며, 그 근거 1 절을 같은 행에 남긴다.
- [ ] run 이 **실패**(임계 위반 · 컨테이너 부팅 실패 · runner 미할당 등)해도 워크플로·스크립트·임계를 **수정하지 않는다**. 실패 사실 · 실패 step · 원인 추정 · run id 를 위 두 문서에 같은 형식으로 기록하고, 후속 조치를 본 파일 `Follow-ups` 에 1~3 줄로 남긴다.
- [ ] 기록한 어떤 수치·로그 인용에도 secret / credential 리터럴이 포함되지 않는다 (CLAUDE.md §9 — `AUTH_JWT_SECRET` · `LLM_APIKEY_ENC_KEY` 값 인용 금지. 워크플로의 더미 값도 문서에 옮기지 않는다).
- [ ] `git status --short` 결과가 위 `touchesFiles` 2 개 + 본 task 파일 · STATE · journal(driver 소관) 외 변경 0 임을 확인한다. `src/` · `test/` · `.github/` 변경 0.
- [ ] 분기 없음 · 코드 변경 0 인 direct doc-only task 라 R-112 unit test 항목은 해당 없음 (CLAUDE.md §3.2 — direct-mode doc-only 면제). 대신 위 "변경 0" 확인이 검증 항목이다.

## Out of Scope

- **`.github/workflows/load-k6.yml` · `test/load/*.js` · `package.json` 수정 금지** — 본 slice 는 측정 + 기록만. 실패 원인 발견 시에도 고치지 말고 Follow-ups 로 넘긴다 (CLAUDE.md §3).
- S2 / S3 에 `--summary-export` + 기록 step 확장 (T-1636 Out of Scope 가 이미 follow-up 으로 남긴 항목) — 별도 slice.
- 실 scale 133 명 dataset seed · `K6_S1_PERSONS` 상향 run — 별도 slice (오너 PLAN `147 행`).
- `§3` 표의 임계 숫자 확정("baseline 후 fix" → 실수치 고정) — 1 회 실측으로 고정하지 않는다.
- [docs/requirements.md](../requirements.md) 의 REQ-047 status flip (`PLANNED` → 검증됨) — 실 scale 미검증이라 금지.
- 실패 run 의 재-dispatch 반복. runner 미할당 같은 명백한 infra 장애일 때만 **최대 1 회** 재시도하고, 그 이상은 기록 후 종료.
- 새 외부 dependency / action 도입, credential 추가 (§5 게이트).

## Suggested Sub-agents

`implementer`

## Follow-ups

(비어 있음 — sub-agent 가 관련 작업 발견 시 여기에 append)
