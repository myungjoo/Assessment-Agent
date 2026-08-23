---
id: T-1667
title: 표본 로그 배선 후 재 dispatch 실측 — load-k6 를 s1_persons=133 으로 1 회 실행해 9 회차 박제
phase: P5
status: PENDING
commitMode: direct
coversReq: [REQ-047]
estimatedDiff: 130
estimatedFiles: 2
created: 2026-08-24
createdAt: 2026-08-24T00:05:00Z
dependsOn: [T-1666]
touchesFiles:
  - docs/ops/load-resilience-test-plan.md
  - docs/PLAN.md
independentStream: load-harness-r91
plannerNote: "P5 R-91 chain 49/N — T-1666 표본 로그 배선을 실 run 으로 회수해 9 회차 박제, 간접 증거 3 종 폐기."
---

# T-1667 — 표본 로그 배선 후 재 dispatch 실측 (`s1_persons=133`, 9 회차)

## Why

[T-1665](T-1665-load-k6-devset-seeded-rerun.md) 의 8 회차 실측(run `32665014391`)은 실 devset seed 가 처음 성공한 run 이었지만, k6 가 실제로 몇 명을 표본으로 취했는지는 **간접 증거 3 종**(seed step 적재 133 건 · 무-페이지네이션 `findMany` · batch p95 대역)으로만 추론해야 했다. [T-1666](T-1666-s1-batch-sample-count-log.md)(PR #1331 → main `08767749`)이 `s1-batch.js` `setup()` 에 고정 prefix `[s1-batch] devset 표본` 로그 1 줄을 배선해 그 값을 직접 찍게 만들었지만, **그 로그를 태운 실 run 은 아직 0 회**다.

본 slice 는 오너 지시(PLAN `144 행` "R-91 k6 최우선·즉시 착수") chain 49/N 로, `load-k6.yml` 을 `-f s1_persons=133` 으로 **정확히 1 회** dispatch 해 ① 새 표본 로그 줄의 실제 출력 ② seed step 재현성(2 회 연속 성공 여부) ③ 실 scale 표본 6 개째의 S1 THRESHOLDS 수치를 회수하고 `§3.1` **9 회차** 로 박제한다.

## Required Reading

- [docs/ops/load-resilience-test-plan.md](../ops/load-resilience-test-plan.md) — `128 행` `### 3.1 baseline 실측 기록 (S1, 8 회분)` 헤더, `401 행` 부터의 **8 회차 소절**(본 회차가 따를 형식과 "간접 증거 3 종" 서술의 위치), `486 행` 부터의 `§5` item 5 **잔여 ①**.
- [docs/tasks/T-1666-s1-batch-sample-count-log.md](T-1666-s1-batch-sample-count-log.md) — 배선된 로그의 계약(고정 prefix `[s1-batch] devset 표본`, 취한 표본 수 `personIds.length` + 요청 표본 수 `SAMPLE_PERSONS`, 민감값 출력 0). 본 slice 가 실 run 으로 검증하는 대상.
- [test/load/s1-batch.js](../../test/load/s1-batch.js) `setup()` — 로그 줄의 정확한 문자열 형태(로그 회수 시 grep 기준). **읽기만 하고 편집하지 않는다.**
- [docs/PLAN.md](../PLAN.md) `140~141 행` — checkbox 와 R-91 실측 이력 꼬리(본 slice 가 append 할 자리).
- [docs/ops/realdata-scale-devset.md](../ops/realdata-scale-devset.md) `## seed 실행 경로` 절 — 배선 좌표 참조용. **읽기만 하고 편집하지 않는다**(`§A`/`§B` 표는 drift guard 파싱 대상).

## Acceptance Criteria

- [ ] `gh workflow run load-k6.yml --ref main -f s1_persons=133` 으로 **정확히 1 회** dispatch 하고 run id 를 확보한다(`gh run list --workflow=load-k6.yml --limit 3`). 재 dispatch · 재시도 금지 — 실패해도 그 사실 자체가 9 회차 실측 결과다. dispatch 시각 · head sha 를 함께 기록한다.
- [ ] run conclusion 을 확인한다(`gh run view <id>` 또는 `gh run watch <id>`). **45 분** 초과 미종료면 대기를 중단하고 그 시점의 진행 중 step 이름과 함께 기록한다.
- [ ] `gh run view <id> --log` 에서 **`[s1-batch] devset 표본` 로그 줄 원문을 그대로 인용**한다 — 본 회차의 1 순위 관측 대상이다. 취한 표본 수와 요청 표본 수를 각각 적고, 8 회차가 간접 증거 3 종으로 추론했던 `133` 과 **일치하는지 명시 판정**한다. 로그 줄이 아예 없으면 그 사실(그리고 어느 step 에서 끊겼는지)을 배선 결함으로 기록한다.
- [ ] `133 로그인 실 dataset seed 적재` step 의 conclusion 과 적재 건수(`person` / `serviceIdentity`)를 회수해 8 회차와 대조한다 — T-1664 fix 의 **재현성 2 회차** 확인. fail 이면 에러 메시지 원문(secret · `DATABASE_URL` 값 제외)을 그대로 기록한다.
- [ ] k6 `THRESHOLDS` 블록에서 `http_req_duration{route:batch}` 임계가 **2 개**(`p(95)<3600000` · `p(95)<900`) 로 나타나는지와 각 `✓`/`✗` 를 그대로 인용한다. `http_req_failed` · `iteration_duration` · `http_reqs` 수치도 함께 회수하고, `http_reqs` 가 8 회차의 **7** 과 같은지(= 합성 `POST /api/persons` 왕복 0 유지) 대조한다.
- [ ] batch p95 를 회수했다면 **실 scale 표본 6 개**(3~8 회차 760.91 · 730.81 · 711.23 · 792.27 · 757.65 + 본 회차)의 평균 · 범위 · 표본표준편차 · 변동계수 · 평균 + 3σ 를 재계산하고 `900ms` 임계 **재확정 필요 여부**를 명시 판정한다(평균 + 3σ ≤ 900ms 면 재확정 불요). 회수 실패면 "표본 5 개 그대로 · 재확정 불요" 를 사유와 함께 적는다.
- [ ] "S1 실측 요약 기록" step 의 환경 메타 7 항목을 회수해 3~8 회차와 동일 조건인지 대조 기록한다(다르면 어느 항목이 어떻게 다른지).
- [ ] [docs/ops/load-resilience-test-plan.md](../ops/load-resilience-test-plan.md) `§3.1` 에 **9 회차 소절**을 8 회차와 같은 형식(run id · head sha · conclusion · 표본 로그 원문 · seed step 결과 · THRESHOLDS 인용 · 기술통계 · 환경 메타 · 의미/한계)으로 추가하고, `128 행` 헤더의 `8 회분` 을 `9 회분` 으로 갱신한다. 8 회차 소절의 "간접 증거 3 종" 문단은 **삭제하지 말고** 9 회차 소절에서 "직접 회수로 대체됨(또는 불일치)" 을 한 문장으로 연결한다.
- [ ] 같은 문서 `§5` item 5 의 **잔여 ①** 을 본 실측 결과로 갱신한다 — 표본 수 직접 회수 여부를 반영하되, 남은 미검증 축(LLM stub · 실 수집 왕복 0 · 단일 iteration)은 그대로 유지한다. 잔여 ② · ③ 표기는 무변경.
- [ ] [docs/PLAN.md](../PLAN.md) `141 행` 꼬리에 9 회차 결과 1~3 문장을 덧붙인다 — run id · 표본 로그 회수 결과 · 수치(또는 회수 실패 사유) · checkbox 유지 근거. **`140 행` checkbox `[ ]` 는 무변경**(LLM stub · 수집 왕복 0 · 단일 iteration 조건이 그대로면 REQ-047 완료 조건 미달).
- [ ] 문서에 적는 run id · sha · 수치는 전부 `gh run view` 실 출력에서 인용한 값이어야 한다 — 추정치 · 허구 SHA 0.
- [ ] `pnpm test` green(drift guard `realdata-devset-logins-doc-consistency.spec.ts` 가 `RangeError` 없이 통과 = `§A`/`§B` 표 무변경 확인). doc-only direct 라 PR · reviewer 미경유(§3.1).
- [ ] 변경 파일 **2 개**(`load-resilience-test-plan.md` · `PLAN.md`) 유지. 3 번째 파일 수정이 필요하다고 판단되면 Follow-ups 로 넘긴다.

## Out of Scope

- **코드 · 워크플로 변경 0** — `test/load/*.js` · `.github/workflows/load-k6.yml` · `scripts/seed-devset-logins.ts` · `test/helpers/realdata-*` · smoke spec 수정 금지. 본 slice 는 순수 측정 + doc-sync 다(`commitMode` 가 갈리므로 §3.1).
- **실측에서 발견한 결함의 수정 금지** — 기록만 하고 Follow-ups 로 넘긴다(T-1647 · T-1663 선례). 로그 문자열 개선 욕구가 생겨도 본 slice 에서 손대지 않는다.
- **2 회 이상 dispatch 금지** — 표본 오염 방지. 1 회 결과가 곧 9 회차다.
- [docs/ops/realdata-scale-devset.md](../ops/realdata-scale-devset.md) 편집 — `§A`/`§B` 표는 drift guard 파싱 대상이라 편집 금지.
- `§3` 임계 표의 숫자 변경 — 재확정 판정만 문서에 적고, 실제 숫자 변경이 필요하다는 결론이 나오면 별도 slice.
- `s2-read.js` / `s3-concurrent.js` 의 devset dataset 교체 · S2/S3 실측.
- `realdata-devset-seed-identity-upsert-runner.ts` 의 `flattenPlan` placeholder 결손 가드 추가(T-1664 Out of Scope 승계).
- `deploy/daily-test.sh` leg 추가 — drift-guard smoke 3 종 동반으로 cap 초과(T-1122 / Q-0054 선례).

## Follow-ups

(작업 중 발견한 후속 항목을 여기에 append)
