---
id: T-1694
title: 단계별 Trend 두 번째 dispatch 로 S3 4 회차 실측 회수 + §3.1 회차 기록 (단계 표본 2 회 확보)
phase: P5
status: PENDING
commitMode: direct
coversReq: [REQ-047, REQ-048]
independentStream: load-k6-s3-baseline
dependsOn: [T-1692, T-1693]
touchesFiles:
  - docs/ops/load-resilience-test-plan.md
  - docs/PLAN.md
estimatedDiff: 150
estimatedFiles: 2
created: 2026-08-25
createdAt: 2026-08-25T11:20:00Z
plannerNote: PLAN 141 행 R-91 chain 다음 칸 — T-1692/T-1693 Follow-up ②, dispatch 정확히 1 회로 단계별 Trend 2 번째 표본만 확보·기록
---

# T-1694 — 단계별 Trend 두 번째 dispatch 로 S3 4 회차 실측 회수 + `§3.1` 회차 기록

## Why

[PLAN.md](../PLAN.md) `141 행` (R-91 부하 검증, 오너 최우선 지시) chain 의 다음 칸이다.
T-1692 가 배선 후 첫 dispatch(run **32833365988**)로 단계별 custom `Trend` 3 행을 처음 회수했고
T-1693 이 같은 run 의 S1 · S2 leg 를 재독으로 회수했다. 그 두 slice 가 남긴 공통 Follow-up **②** 는
"단계별 Trend 표본이 **2 회 이상** 누적돼야 `§3` 표의 `latency cliff 부재` 판정 근거 서술과 설계
조항 **⑥** 꼬리의 표시 수단(후보 A · B) 판단이 비로소 입력을 갖는다" 였다. 현재 단계 표본은
**1 회**뿐이라 `S3 3 회차` 는 단계 간 값 차이를 관측 사실로만 적고 `latency cliff` 유무를 단정하지
못한 채 이월돼 있다.

본 slice 는 [`load-k6.yml`](../../.github/workflows/load-k6.yml) 을 **정확히 1 회** dispatch 해 그 run 의
**S3 leg 수치만** 회수하고 `§3.1` 에 `#### S3 4 회차` 를 신설한다 — 목적은 **단계 표본을 2 개로
만드는 것까지**이며, 그 2 표본을 근거로 한 `latency cliff` 판정과 표시 수단 결정은 **별도 slice**
소관이다. 같은 run 의 S1 · S2 leg 수치도 본 slice 범위 밖이며 다음 slice 가 **같은 run 로그를
재독만 해서** 회수한다 (T-1684 → T-1685, T-1692 → T-1693 선례 승계 — dispatch 를 두 번 태우지 않는다).

## Required Reading

- [docs/ops/load-resilience-test-plan.md](../ops/load-resilience-test-plan.md)
  - `§3` 의 `#### 단계별 percentile export 설계 (사전 박제, T-1687)` (`281 행` ~) 중 조항 **④**(출력 규약) ·
    **⑤**(집행 split) · **⑥**(경로 β 채택 · (라) 판정면 무변화 · (마) 문서 direct 축) — 본 slice 의 계약 정본
  - `377 행` — `### 3.1 baseline 실측 기록 (S1 14 회분 · S2 4 회분 · S3 3 회분)` 헤더 (개수 표기 갱신 대상)
  - `1612~1686 행` — `#### S3 3 회차` 전문 (**서식 정본**: 측정 일시/run · THRESHOLDS 원문 · 수치 ·
    단계별 값 · 행 수 잔여 판정 · `§3` 표 무변경 판정 · 이월 pointer)
  - `1735 행` ~ — `§5` item 5 (집행 문단 append 대상)
- [test/load/s3-concurrent.js](../../test/load/s3-concurrent.js) — `STAGE_TAG_KEY` · `STAGE_TAG_VALUES` ·
  `stageTagOf` 와 **회수 대상 지표 이름** `s3_stage_duration_1` · `_2` · `_3`, `summaryTrendStats` 의
  `p(99)` 열. **읽기만 한다 — 본 slice 는 이 파일을 수정하지 않는다.**
- [.github/workflows/load-k6.yml](../../.github/workflows/load-k6.yml) — `workflow_dispatch` input
  `s1_persons`, S3 step `k6 S3 동시 요청 내성 시나리오 실행` (`if: ${{ !cancelled() }}`)
- [docs/tasks/T-1692-s3-stage-trend-first-dispatch-record.md](T-1692-s3-stage-trend-first-dispatch-record.md) —
  dispatch 1 회 + 회차 1 개 기록 slice 의 직전 선례 (범위 절제 방식)
- [CLAUDE.md](../../CLAUDE.md) `§3.1`(commit mode rule 1) · `§12`(언어 · 범위 좌표 표기 · 소급 치환 금지)

## Acceptance Criteria

- [ ] `gh workflow run load-k6.yml --ref main -f s1_persons=133` 을 **정확히 1 회** 실행한다.
      rerun · 재 dispatch · 재시도는 **0** — run 이 fail 로 끝나거나 S3 step 이 skip 돼도 **그 사실 자체를
      기록하고 종료**한다 (성공할 때까지 반복 금지).
- [ ] run 종료 후 `gh run view <run-id> --log` 로 S3 step 로그를 회수하고 다음을 **원문 그대로** 옮겨
      적는다 (추정 · 재계산 · 다른 회차 값 전용 **금지**):
  - step 구간 · conclusion · k6 exit code · head sha, THRESHOLDS 4 종 원문과 `✓`/`✗` 개수
  - 전역 · `{route:read}` · `{route:write}` 의 `http_req_duration` 원문 줄(**`p(99)` 열 포함**),
    `http_req_failed`, `http_reqs`, `iterations`, `iteration_duration`, `vus` / `vus_max`
  - **단계별 custom Trend 3 행** — `s3_stage_duration_1` · `_2` · `_3` 의 원문 줄 전체. 한 행이라도
    요약에 **없으면 "미출력" 으로 명시**하고 원인 추정은 하지 않는다.
  - `[s3-concurrent] persons 행 수 시작 …행` · `… 종료 …행 / 시작 …행` **2 줄**
- [ ] `§3.1` 의 `#### S3 3 회차` 소절 **뒤에**
      `#### S3 4 회차 (T-1694, run <run-id>, 단계별 Trend 2 번째 표본)` 을 신설한다.
      `#### S3 3 회차` 의 블록 서식을 그대로 승계하고 다음 3 항목을 추가로 담는다:
  - **단계별 값 2 표본 대조** — 단계 `1` · `2` · `3` 의 p95 · p99 를 3 회차 값과 나란히 적고 회차 간 Δ 를
    **산술 차이로만** 적는다. 표본이 **2 개**로 늘었다는 사실까지만 쓰고 `latency cliff` 유무 판정 ·
    `§3` 표 문구 수정은 **하지 않는다** (별도 slice 소관 — Out of Scope 참조).
  - **`p(99)` 열 재확인** — 두 번째 run 에서도 `p(99)` 열이 출력됐는지를 명시하고 값을 적는다.
  - **행 수 잔여 판정** — 종료 행 수 − 시작 행 수 를 직접 적어 iteration 자기 정리(규약 ②) 잔여를 판정한다.
- [ ] `377 행` 헤더 개수 표기를 `(S1 14 회분 · S2 4 회분 · S3 4 회분)` 으로 갱신한다.
      **S1 · S2 회분 수는 본 slice 에서 올리지 않는다** (같은 run 의 S1 · S2 회수는 다음 slice 소관).
- [ ] `#### S3 3 회차` 꼬리에 **후속 pointer 1 줄**을 추가한다 — 그 소절이 이월한 "표본 1 회라 cliff
      미단정" 이 `S3 4 회차` 로 표본 2 개가 됐다는 사실만. 기존 문장 · 수치 **삭제 0**(이력 보존).
- [ ] `§5` item 5 꼬리에 본 slice 집행 문단 1 개를 append 한다 (dispatch 1 회 · run id · S3 회분 3→4 ·
      단계 표본 1→2 · S1 · S2 회수는 다음 slice 이월).
- [ ] [PLAN.md](../PLAN.md) `141 행` 꼬리에 1 문장 append(회차 수 재계수 포함). `140 행` checkbox 는 실
      수집 축(LLM stub · 수집 왕복 0) 미검증이라 `[ ]` 유지.
- [ ] `§3` 임계 표는 **문자 단위 0 변경** — `error rate < 1% (baseline 후 fix)` · `latency cliff 부재` 를
      본 slice 에서 fix 하지 않는다. 변경했다면 위반.
- [ ] `git diff --stat` 이 **2 파일**(`docs/ops/load-resilience-test-plan.md` · `docs/PLAN.md`) 이고
      `src/` · `test/` · `.github/workflows/` · `package.json` 변경이 **0** 임을 확인한다.
- [ ] 확인용으로 `pnpm lint` 를 1 회 돌려 무경고를 확인한다 (doc-only · production 0 LOC 라 R-110 tester
      의무 면제 — CLAUDE.md `§3.2`).

## Out of Scope

- **`latency cliff` 판정 확정 및 `§3` 표 문구 fix** — 표본 2 개가 확보된 *뒤* 별도 slice 가 규칙 적용으로
  판단한다. 본 slice 는 표본 공급까지만.
- **조항 ⑥ 꼬리의 표시 수단(후보 A · B) 결정** · `handleSummary()` 신설 — 별도 판단 slice 소관.
- **같은 run 의 S1 15 회차 · S2 5 회차 기록** — 다음 slice 가 같은 run 로그를 **재독만** 해 회수한다
  (T-1685 · T-1693 선례). 본 slice 에서 함께 쓰면 diff cap 을 넘긴다.
- **2 회 이상 dispatch · rerun · 재시도** — 결과가 기대와 달라도 재실행하지 않는다.
- `test/load/*.js` · `test/smoke/*` · `.github/workflows/load-k6.yml` · `package.json` **모든 코드 변경** —
  본 slice 는 문서 `direct` 축이다 (조항 ⑥ (마) · CLAUDE.md `§3.1` rule 3 split 유지).
- `§3` 임계 숫자 · `STUB_BASELINE_P95_MS` · thresholds 4 종 조정 (조항 ②), T-1668 재확정 규칙의 S1 축 재계수
  (본 slice 는 S1 leg 를 읽지 않는다).
- 이전 회차들의 표기 **소급 치환** (`§12` 금지), `s1-batch.js` · `s2-read.js` 로의 단계별 Trend 확대 배선.
- `K6_SEED_PERSONS` 상향 판단(T-1686 소관), 새 ADR 신설 · [ADR-0054](../decisions/ADR-0054-load-resilience-harness-tool.md)
  status 변경, 새 외부 dependency 추가.

## Suggested Sub-agents

`implementer` (dispatch · 로그 회수 · 문서 append) → 별도 tester 없음 (doc-only · R-110 면제, 확인용 `pnpm lint` 1 회).

## Follow-ups

(생성 시점 비어 있음 — sub-agent 가 발견한 관련 작업을 여기에 append)

- (planner 사전 메모) ① 같은 run 의 S1 · S2 leg 수치 재독 회수 slice(`direct`) 가 바로 다음 칸이다 —
  새 dispatch 0.
- (planner 사전 메모) ② 단계 표본이 2 개가 되면 `latency cliff` 판정 slice 와 조항 ⑥ 꼬리의 표시 수단
  판단 slice 가 입력을 갖는다 — 각각 별도 `direct` 문서 slice.
