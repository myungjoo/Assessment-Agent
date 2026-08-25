---
id: T-1692
title: 단계별 Trend 배선 후 첫 dispatch 로 S3 3 회차 실측 회수 + §3.1 회차 기록 (조항 ⑥ (마) 문서 direct 축)
phase: P5
status: DONE
completedAt: 2026-08-25T09:50:00Z
commitMode: direct
coversReq: [REQ-047, REQ-048]
independentStream: load-k6-s3-baseline
dependsOn: [T-1691]
touchesFiles:
  - docs/ops/load-resilience-test-plan.md
  - docs/PLAN.md
estimatedDiff: 145
estimatedFiles: 2
created: 2026-08-25
createdAt: 2026-08-25T09:20:00Z
plannerNote: PLAN 141 행 R-91 chain 다음 칸 — T-1691 Follow-up ① / 조항 ⑥ (마) 문서 direct 축, dispatch 정확히 1 회로 S3 3 회차만 기록
---

# T-1692 — 단계별 Trend 배선 후 첫 dispatch 로 S3 3 회차 실측 회수 + `§3.1` 회차 기록

## Why

[PLAN.md](../PLAN.md) `141 행` (R-91 부하 검증, 오너 최우선 지시) chain 의 다음 칸이다.
[load-resilience-test-plan.md](../ops/load-resilience-test-plan.md) `§3` 조항 **⑥ (마)** 가 집행을
**코드 `pr` + 문서 `direct`** 로 split 하고 "문서는 실 run 으로 단계별 값이 회수된 **뒤에** `§3.1` 회차
기록을 갱신한다" 로 못 박아 뒀다. 코드 축 3 slice — T-1688(`summaryTrendStats` 의 `p(99)` 열) ·
T-1689(단계 tag 축) · T-1691(단계별 custom `Trend` record, PR #1339 → main `2ba4ac4b`) — 은 모두 머지됐지만
**그 배선을 실제로 통과한 run 은 아직 0 회**다. 그래서 `#### S3 2 회차` 가 이월한 "단계 분해 불가라
latency cliff 를 단정하지 않는다" 와 회차 기록 전반의 "`p99` 미확보" 공백이 그대로 남아 있다.

본 slice 는 [`load-k6.yml`](../../.github/workflows/load-k6.yml) 을 **정확히 1 회** dispatch 해 그 run 의
**S3 leg 수치만** 회수하고 `§3.1` 에 `#### S3 3 회차` 를 신설한다. 같은 run 의 S1 · S2 leg 수치는 **본
slice 범위 밖**이며 다음 slice 가 **같은 run 로그를 재독만 해서** 회수한다 (T-1684 → T-1685,
T-1680 → T-1681 선례 승계 — 새 dispatch 를 두 번 태우지 않는다).

## Required Reading

- [docs/ops/load-resilience-test-plan.md](../ops/load-resilience-test-plan.md)
  - `§3` 의 `#### 단계별 percentile export 설계` 조항 **④**(출력 규약) · **⑤**(집행 split) ·
    **⑥**(경로 β 채택 · (라) 판정면 무변화 · (마) 문서 direct 축) — 본 slice 의 계약 정본
  - `377 행` — `### 3.1 baseline 실측 기록 (S1 13 회분 · S2 3 회분 · S3 2 회분)` 헤더 (개수 표기 갱신 대상)
  - `1383~1441 행` — `#### S3 2 회차` 전문 (**서식 정본**: 측정 일시/run · THRESHOLDS 원문 · 수치 ·
    행 수 잔여 판정 · `§3` 표 무변경 판정 · 이월 pointer 6 블록)
  - `1490 행` ~ — `§5` item 5 (집행 문단 append 대상)
- [test/load/s3-concurrent.js](../../test/load/s3-concurrent.js) — `16 행`(`k6/metrics` import) ·
  `38~48 행`(`STAGE_TAG_KEY` · `STAGE_TAG_VALUES` · `stageTagOf`) · `59~66 행`(**회수 대상 지표 이름**
  `s3_stage_duration_1` · `_2` · `_3`) · `73 행`(`summaryTrendStats` 의 `p(99)` 열) ·
  `109 행` 부근(3 왕복 record). **읽기만 한다 — 본 slice 는 이 파일을 수정하지 않는다.**
- [.github/workflows/load-k6.yml](../../.github/workflows/load-k6.yml) — `workflow_dispatch` input
  `s1_persons`(`15 행`), S3 step `k6 S3 동시 요청 내성 시나리오 실행`(`207 행` 부근, `if: ${{ !cancelled() }}`)
- [docs/tasks/T-1684-s3-rowcount-dispatch-record.md](T-1684-s3-rowcount-dispatch-record.md) — dispatch 1 회 +
  회차 1 개 기록 slice 의 선례 (범위 절제 방식)
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
  - **단계별 custom Trend 3 행** — `s3_stage_duration_1` · `_2` · `_3` 의 원문 줄 전체
    (`avg` · `min` · `med` · `max` · `p(90)` · `p(95)` · `p(99)` 및 표본 수). 한 행이라도 요약에 **없으면
    "미출력" 으로 명시**하고 원인 추정은 하지 않는다.
  - `[s3-concurrent] persons 행 수 시작 …행` · `… 종료 …행 / 시작 …행` **2 줄**
- [ ] `§3.1` 의 `#### S3 2 회차` 소절 **뒤에**
      `#### S3 3 회차 (T-1692, run <run-id>, T-1688 · T-1689 · T-1691 배선 후 첫 회차)` 를 신설한다.
      `#### S3 2 회차` 의 블록 서식을 그대로 승계하고 다음 3 항목을 추가로 담는다:
  - **단계별 값 판정** — 단계 `1` · `2` · `3` 의 p95 · p99 를 나란히 적고, 단계가 오를수록 값이 어떻게
    움직이는지를 **관측 사실로만** 기술한다. 표본이 **1 회**뿐이므로 `latency cliff` 유무는 여전히
    **단정하지 않는다**.
  - **`p(99)` 열 확보 여부** — T-1688 의 `summaryTrendStats` 배선이 실 run 에서 처음 적용되는 회차이므로
    `p(99)` 가 실제로 출력됐는지를 명시하고, 출력됐다면 값을 적는다. **이전 회차의 "미확보" 표기는
    소급 치환하지 않는다**(`§12`).
  - **행 수 잔여 판정** — 종료 행 수 − 시작 행 수 를 직접 적어 iteration 자기 정리(규약 ②) 잔여를 판정한다.
- [ ] `377 행` 헤더 개수 표기를 `(S1 13 회분 · S2 3 회분 · S3 3 회분)` 으로 갱신한다.
      **S1 · S2 회분 수는 본 slice 에서 올리지 않는다** (같은 run 의 S1 · S2 회수는 다음 slice 소관).
- [ ] `#### S3 2 회차` 꼬리에 **회수 완료 pointer 1 줄**을 추가한다 — 그 소절이 이월한 "단계 분해 불가"
      공백이 `S3 3 회차` 에서 어떻게 처리됐는지 사실만. 기존 문장 · 수치 **삭제 0**(이력 보존).
- [ ] `§5` item 5 꼬리에 본 slice 집행 문단 1 개를 append 한다 (dispatch 1 회 · run id · S3 회분 2→3 ·
      S1 · S2 회수는 다음 slice 이월).
- [ ] [PLAN.md](../PLAN.md) `141 행` 꼬리에 1 문장 append(회차 수 재계수 포함). `140 행` checkbox 는 실
      수집 축 미검증이라 `[ ]` 유지.
- [ ] `§3` 임계 표는 **문자 단위 0 변경** — S3 축 표본이 3 회뿐이라 `error rate < 1% (baseline 후 fix)` ·
      `latency cliff 부재` 를 fix 하지 않는다 (규칙 사전 박제 → 기계 적용 2 단계 승계). 변경했다면 위반.
- [ ] `git diff --stat` 이 **2 파일**(`docs/ops/load-resilience-test-plan.md` · `docs/PLAN.md`) 이고
      `src/` · `test/` · `.github/workflows/` · `package.json` 변경이 **0** 임을 확인한다.
- [ ] 확인용으로 `pnpm lint` 를 1 회 돌려 무경고를 확인한다 (doc-only · production 0 LOC 라 R-110 tester
      의무 면제 — CLAUDE.md `§3.2`).

## Out of Scope

- **같은 run 의 S1 14 회차 · S2 4 회차 기록** — 다음 slice 가 같은 run 로그를 **재독만** 해 회수한다
  (T-1681 · T-1685 선례). 본 slice 에서 함께 쓰면 diff cap 을 넘긴다.
- **2 회 이상 dispatch · rerun · 재시도** — 결과가 기대와 달라도 재실행하지 않는다.
- `test/load/*.js` · `test/smoke/*` · `.github/workflows/load-k6.yml` · `package.json` **모든 코드 변경** —
  본 slice 는 문서 `direct` 축이다 (조항 ⑥ (마) · CLAUDE.md `§3.1` rule 3 split 유지).
- `§3` 임계 표 숫자 · `STUB_BASELINE_P95_MS` · thresholds 4 종 조정 (조항 ②).
- `handleSummary()` 신설(후보 B) · 요약 표시 형식 변경 — 조항 ⑥ 꼬리가 별도 판단으로 남겨 뒀다.
- 이전 회차들의 `p99` "미확보" 표기 **소급 치환** (`§12` 금지) 및 `s1-batch.js` · `s2-read.js` 로의
  단계별 Trend 확대 배선.
- `K6_SEED_PERSONS` 상향 판단(T-1686 소관), 새 ADR 신설 · [ADR-0054](../decisions/ADR-0054-load-resilience-harness-tool.md)
  status 변경, 새 외부 dependency 추가.

## Suggested Sub-agents

`implementer` 단독 (doc-only `direct` — architect 불요, R-110 tester 의무 면제. 확인용 `pnpm lint` 1 회만).

## Follow-ups

(생성 시점 비어 있음 — sub-agent 가 발견한 관련 작업을 여기에 append)

- (planner 사전 메모) ① 같은 run 의 S1 · S2 leg 수치 재독 회수 slice(`direct`) 가 바로 다음 칸이다 —
  새 dispatch 0.
- (planner 사전 메모) ② 단계별 Trend 3 행이 실제로 확보되면 `§3` 표의 `latency cliff 부재` 판정 근거
  서술과 조항 ⑥ 꼬리의 "표시 수단(후보 A · B)" 판단이 비로소 입력을 갖는다 — 표본 누적(2 회 이상) 후 별도 slice.

## 결과 (2026-08-25 완료)

- `load-k6.yml` 을 정확히 1 회 dispatch (run `32833365988`, head sha `4c6eaac6`, conclusion `success`, rerun 0).
- `§3.1` 에 `#### S3 3 회차` 신설 — 단계별 custom Trend 3 행 전부 출력 (단계1 p95 5.01ms / p99 6.55ms →
  단계2 21.33 / 26.25 → 단계3 21.4 / 26.12), 전역 `p(99)` 25.02ms 첫 확보, 행 수 133→133 차이 0 행.
- 377 행 헤더 S3 2→3 회분 갱신 · `#### S3 2 회차` 꼬리 회수 pointer · `§5` item 5 집행 문단 ·
  PLAN 141 행 꼬리 1 문장 append. `§3` 임계 표 문자 단위 0 변경, 코드 · 워크플로 변경 0.
- 2 파일 +96/-2, 확인용 `pnpm lint` 무경고. direct commit `a386fdc9`.
- k6 종료 요약이 Trend 지표에 표본 수 (count) 열을 내지 않아 단계별 표본 수는 "미출력" 로 사실만 기록했다.
