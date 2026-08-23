---
id: T-1663
title: seed 배선 후 첫 실 dataset run — load-k6 를 s1_persons=133 으로 1 회 dispatch 해 seed step·소비 경로 실측
phase: P5
status: PENDING
commitMode: direct
coversReq: [REQ-047]
estimatedDiff: 120
estimatedFiles: 2
created: 2026-08-23
createdAt: 2026-08-23T15:40:00Z
dependsOn: [T-1660, T-1661, T-1662]
touchesFiles:
  - docs/ops/load-resilience-test-plan.md
  - docs/PLAN.md
independentStream: load-harness-r91
plannerNote: "P5 R-91 chain 45/N — T-1651~T-1661 이 닫은 seed 실행 경로를 실 run 0 회 상태에서 1 회 dispatch 로 첫 실측."
---

# T-1663 — seed 배선 후 첫 실 dataset run (`s1_persons=133`, 7 회차)

## Why

[docs/PLAN.md](../PLAN.md) `141 행` 이 박제한 대로 133 로그인 seed 실행 경로의 **배선 4 축은 T-1651 ~ T-1661 로 전부 닫혔다** (helper chain · `pnpm seed:devset-logins` entrypoint · workflow 툴체인/seed step · `s1-batch.js` `setup()` 소비 경로). 그런데 **그 경로를 태운 실 run 은 아직 0 회** 라 `§5` item 5 의 잔여 ① 이 "배선 완료 · 실행 0 회" 로 미해소 상태다 — 11 slice 분의 배선이 런타임에서 실제로 동작하는지 증거가 없다. 본 slice 는 오너 지시 (PLAN `144 행` "R-91 k6 최우선·즉시 착수") chain 45/N 으로, 스크립트·워크플로 변경 0 인 **순수 측정 + doc-sync** 다 — `load-k6.yml` 을 `s1_persons=133` 으로 정확히 1 회 dispatch 해 ① seed step 이 133 로그인을 실제로 적재하는지 ② `setup()` 이 합성 생성 대신 적재분을 조회해 쓰는지 ③ 7 회차 batch p95 가 900ms 관찰 baseline 안인지를 실측 기록한다. 결함이 나와도 **본 slice 에서 고치지 않고** 기록만 한다 (T-1647 선례).

## Required Reading

- [.github/workflows/load-k6.yml](../../.github/workflows/load-k6.yml) `10~20 행` (input `s1_persons` 정의 · default `"10"`) + `53~73 행` (T-1659 툴체인 3 step) + `114~122 행` (T-1660 `133 로그인 실 dataset seed 적재` step, `env.DATABASE_URL` + `run: pnpm seed:devset-logins`) + `138~152 행` (S1 실행 step) + `153~` "S1 실측 요약 기록" step (`if: always()`, `tee -a` 환경 메타 7 항목).
- [test/load/s1-batch.js](../../test/load/s1-batch.js) `setup()` — T-1661 이 바꾼 (c) 단계 (`GET /api/persons` + `@load.devset.test` 접미사 필터 · 표본 수만큼 취하기) 와 `teardown()` (person 삭제 없음). 표본 부족 시 어떤 동작을 하는지 확인해 실측 해석의 근거로 삼는다.
- [docs/ops/load-resilience-test-plan.md](../ops/load-resilience-test-plan.md) `128 행` `§3.1` 헤더 ("6 회분" 표기 — 본 slice 가 "7 회분" 으로 갱신) + `292~348 행` 6 회차 서술 (본 slice 가 같은 형식으로 7 회차를 덧붙일 자리) + `§5` item 5 의 잔여 ① 문단 (실행 0 회 → 1 회 실측 결과로 갱신할 대상).
- [docs/PLAN.md](../PLAN.md) `140~141 행` — REQ-047 checkbox 와 R-91 실측 상태 서술 (본 slice 가 꼬리에 7 회차 문장을 덧붙일 자리), `144 행` 오너 지시.
- [docs/ops/realdata-scale-devset.md](../ops/realdata-scale-devset.md) `## seed 실행 경로` 절 — T-1662 가 박은 배선 좌표 (본 slice 는 **읽기만** 하고 편집하지 않는다).

## Acceptance Criteria

- [ ] `gh workflow run load-k6.yml --ref main -f s1_persons=133` 으로 **정확히 1 회** dispatch 하고 run id 를 확보한다 (`gh run list --workflow=load-k6.yml --limit 3`). 재 dispatch · 재시도 금지 — 실패해도 그 사실 자체를 실측 결과로 기록한다.
- [ ] run conclusion 을 확인한다 (`gh run view <id>` 또는 `gh run watch <id>`). **45 분** 초과 미종료면 대기를 중단하고 그 시점의 진행 중 step 이름과 함께 기록한다.
- [ ] `gh run view <id> --log` 에서 **`133 로그인 실 dataset seed 적재` step 의 conclusion 과 출력**을 회수한다. 적재 인원 수 · 실패 로그 유무를 인용하고, step 이 fail 이면 그 에러 메시지 원문 (secret · `DATABASE_URL` 값 제외) 을 기록한다.
- [ ] S1 실행 로그에서 **`setup()` 이 적재분을 조회해 썼는지** 확인한다 — `GET /api/persons` 경로로 얻은 표본 인원 수가 `133` 인지, 부족하면 몇 명이었는지. `POST /api/persons` 로 합성 인원이 생성된 흔적이 있으면 T-1661 배선 결함으로 기록한다.
- [ ] k6 `THRESHOLDS` 블록에서 `http_req_duration{route:batch}` 임계가 **2 개** (`p(95)<3600000` 판정 임계 + `p(95)<900` stub baseline 게이트) 로 나타나는지와 각 `✓`/`✗` 를 그대로 인용한다. `http_req_failed` · `iteration_duration` 수치도 함께 회수한다.
- [ ] [docs/ops/load-resilience-test-plan.md](../ops/load-resilience-test-plan.md) `§3.1` 에 **`#### 7 회차 (T-1663, run <id>, 실 dataset seed 첫 run)`** 소절을 6 회차와 같은 형식 (수치 · 환경 메타 · 의미/한계) 으로 추가하고, `§3.1` 헤더의 "6 회분" 을 "7 회분" 으로 갱신한다. 실 scale 표본이 5 개가 되면 평균 · 범위 · 표본표준편차를 **직접 계산해** 적고, 900ms 재확정 필요 여부를 한 문장으로 판정한다 (초과 시에도 본 slice 에서 임계 숫자를 바꾸지 않고 Follow-ups 로 넘긴다).
- [ ] `§5` item 5 의 잔여 ① 문단을 실측 결과로 갱신한다 — seed step 이 성공했으면 "배선 · 실행 모두 확인, 잔여는 수집 왕복 (`ServiceIdentity` · 외부 API) 축" 으로 좁히고, 실패했으면 결함 내용과 함께 **미해소 유지** 로 적는다. 어느 쪽이든 근거 run id 를 명시한다.
- [ ] [docs/PLAN.md](../PLAN.md) `141 행` 꼬리에 7 회차 결과 1 ~ 3 문장을 덧붙인다. **`140 행` checkbox 는 `[ ]` 유지** — LLM stub (ADR-0057 `D1`) · 수집 왕복 0 · 단일 iteration 조건이 그대로이므로 그 근거를 함께 적는다.
- [ ] 인용한 run id · SHA · 수치는 전부 `gh run view` 실 출력과 1:1 대조한다 (허구 수치 0). 회수 불가한 항목은 추정치를 쓰지 말고 "회수 실패" 로 명시한다.
- [ ] `pnpm test` green (doc-only 변경이지만 `realdata-devset-logins-doc-consistency` drift guard 가 정본 문서를 파싱하므로 회귀 0 확인).
- [ ] 본 task 는 `commitMode: direct` doc-only 이라 R-112 4 항목 (happy / error / 분기 / negative unit test) 은 적용 대상이 아니다 — production code 변경 0, 신규 public symbol 0.

## Out of Scope

- `test/load/*.js` · `.github/workflows/load-k6.yml` · `scripts/seed-devset-logins.ts` · `test/helpers/realdata-devset-seed-*.ts` 의 **코드 변경 일절 금지**. 결함이 보여도 Follow-ups 에만 적는다 (수정은 별도 pr-mode slice).
- **재 dispatch 금지** — run 이 fail 해도 1 회로 끝낸다. 재현 · 원인 규명은 후속 slice.
- `§3` 표의 임계 숫자 (900ms · 1h 예산 · S2/S3 `baseline 후 fix`) 재확정 · 변경 금지.
- [docs/ops/realdata-scale-devset.md](../ops/realdata-scale-devset.md) 의 `## A.` / `## B.` 표와 `## seed 실행 경로` 절 편집 금지 (fixture drift guard 파싱 대상).
- `s2-read.js` / `s3-concurrent.js` 의 devset dataset 교체 — 별도 후속 slice.
- `daily-test.sh` leg 추가 — drift-guard smoke 3 종 동반으로 5 파일 cap 초과 (T-1122 / Q-0054 선례).
- `140 행` checkbox 를 `[x]` 로 바꾸는 것 — REQ-047 완료 조건 (실 수집 왕복) 미충족.

## Suggested Sub-agents

`implementer` → (doc-only 라 tester 는 `pnpm test` 회귀 확인만)

## Follow-ups

(비어 있음 — sub-agent 가 관련 작업을 발견하면 여기에 추가)
