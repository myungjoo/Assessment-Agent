---
id: T-1693
title: 같은 run 재독으로 S1 14 회차 · S2 4 회차 실측 회수 + §3.1 회차 기록
phase: P5
status: DONE
commitMode: direct
coversReq: [REQ-047, REQ-048]
independentStream: load-k6-baseline-record
dependsOn: [T-1692]
touchesFiles:
  - docs/ops/load-resilience-test-plan.md
  - docs/PLAN.md
estimatedDiff: 185
estimatedFiles: 2
created: 2026-08-25
createdAt: 2026-08-25T10:20:00Z
plannerNote: PLAN 141 행 R-91 chain 다음 칸 — T-1692 run 32833365988 재독만으로 S1·S2 leg 회수, 새 dispatch 0, 임계·코드 변경 0
---

# T-1693 — 같은 run 재독으로 S1 14 회차 · S2 4 회차 실측 회수 + `§3.1` 회차 기록

## Why

[PLAN.md](../PLAN.md) `141 행` (R-91 부하 검증, 오너 최우선 지시) chain 의 다음 칸이며
T-1692 Follow-up **①** 이다. T-1692 는 `load-k6.yml` 을 정확히 1 회 dispatch(run `32833365988`,
conclusion `success`) 해 **S3 leg 수치만** 회수했고, 같은 run 의 S1 · S2 leg 는 diff cap 때문에
`#### S3 3 회차` 꼬리에 "다음 slice 가 같은 로그를 재독만 해 박제한다" 로 명시 이월했다.

본 slice 는 **그 run 의 로그를 재독만** 해서 (새 `workflow_dispatch` · rerun · 재시도 **0**)
`§3.1` 에 `#### 14 회차` (S1) 와 `#### S2 4 회차` 를 신설한다. T-1680 → T-1681, T-1684 → T-1685
두 선례를 그대로 승계한다 — 이미 지불한 CI 비용에서 남은 수치를 마저 뽑는 것이라 새 부하
실행이 필요 없다. 더불어 본 run 은 T-1688 이 세 스크립트 전부에 얹은 `summaryTrendStats` 의
`p(99)` 열이 **S1 · S2 축에서 처음 적용되는 run** 이라, 회차마다 "미확보" 로 이월돼 온 두 축의
`p99` 가 본 회차에서 확보되는지가 함께 확인된다.

## Required Reading

- [docs/ops/load-resilience-test-plan.md](../ops/load-resilience-test-plan.md)
  - `377 행` — `### 3.1 baseline 실측 기록 (S1 13 회분 · S2 3 회분 · S3 3 회분)` 헤더 (개수 표기 갱신 대상)
  - `943~1023 행` — `#### 13 회차` 전문 (**S1 회차 서식 정본**: 측정 일시/run · THRESHOLDS 원문 ·
    수치 · T-1668 규칙 기계 재계수 블록 · 한계 pointer)
  - `1179~1247 행` — `#### S2 3 회차` 전문 (**S2 회차 서식 정본**)
  - `1447 행` ~ — `#### S3 3 회차` (같은 run 의 이미 기록된 leg) 와 그 **꼬리의 이월 문단**
    (S1 = step 12 · S2 = step 14 라는 step 좌표가 여기 있다 — 해소 pointer 추가 대상)
  - `248 행` ~ — `- **S1 관찰용 p95 게이트 재확정 규칙 (사전 박제, T-1668)**` 조문 ①~④ (기계 재계수 근거)
  - `192 행` ~ — `§3` 임계 표 (**문자 단위 0 변경 대상**)
  - `1566 행` ~ — `§5` item 5 (집행 문단 append 대상)
- [docs/tasks/T-1685-s1-13-s2-3-log-reread.md](T-1685-s1-13-s2-3-log-reread.md) — 재독 전용 slice 의
  직전 선례 (새 dispatch 0 · 재계수 절차 · 표기 규약 · 완료 기록 형식)
- [docs/tasks/T-1692-s3-stage-trend-first-dispatch-record.md](T-1692-s3-stage-trend-first-dispatch-record.md) —
  본 run(`32833365988`) 의 dispatch 조건과 Out of Scope 이월 문구
- [docs/PLAN.md](../PLAN.md) `141 행` 꼬리
- [CLAUDE.md](../../CLAUDE.md) `§3.1`(commit mode rule 1) · `§12`(언어 · 범위 좌표 표기 · 소급 치환 금지)

## Acceptance Criteria

- [ ] `gh run view 32833365988 --log` 를 **재독만** 한다. 새 `gh workflow run` · rerun · 재시도는
      **0** — 한 번이라도 실행했다면 위반이다.
- [ ] S1 leg step(`k6 S1 평가 배치 부하 시나리오 실행`) 로그에서 다음을 **원문 그대로** 옮겨 적는다
      (추정 · 재계산 · 다른 회차 값 전용 **금지**, 로그에 없으면 "미출력" 으로 명시):
  - step 구간 · conclusion · k6 exit code · head sha, THRESHOLDS **3 종** 원문과 `✓`/`✗`
  - `http_req_duration{route:batch}` 원문 줄(**`p(99)` 열 포함**), `http_reqs`, `http_req_failed`,
    `iteration_duration`, `iterations`
  - 표본 로그 줄 `[s1-batch] devset 표본 취득 …명 / 요청 …명`, seed step 의 적재 건수 줄,
    `level=error` 줄 수
- [ ] S2 leg step(`k6 S2 조회 API 응답 지연 시나리오 실행`) 로그에서도 같은 방식으로 회수한다 —
      step 구간 · conclusion · exit code, THRESHOLDS **6 종** 원문과 `✓`/`✗` 개수, 전역 및 route 별
      `http_req_duration` 원문 줄(**`p(99)` 열 포함**), `http_req_failed`, `http_reqs`, `iterations`,
      `level=error` 줄 수.
- [ ] `§3.1` 의 `#### 13 회차` **직후**에
      `#### 14 회차 (T-1693, run 32833365988, T-1692 dispatch 의 S1 leg 재독 회수)` 를,
      `#### S2 3 회차` **직후**에 `#### S2 4 회차 (T-1693, run 32833365988, 같은 run 재독 회수)` 를
      신설한다. 각각 **인접 선례 소절의 블록 서식을 그대로 승계**한다.
- [ ] 두 신설 소절 각각에 **`p(99)` 확보 여부 블록 1 개**를 담는다 — T-1688 의 `summaryTrendStats`
      배선이 S1 · S2 축에서 실 run 에 처음 적용되는 회차이므로 `p(99)` 열이 실제로 출력됐는지를
      명시하고, 출력됐다면 값을 적는다. **이전 회차들의 "미확보" 표기는 소급 치환하지 않는다**(`§12`).
- [ ] `#### 14 회차` 안에서 T-1668 재확정 규칙을 **기계 재계수** 한다 — 실 scale(표본 133) 수치 회수
      회차 목록 · 개수 · 평균 · 표본표준편차 · 평균+3σ 를 계산해 적고, 트리거 ①-(a)/①-(b) 발화 여부를
      명시한다. **트리거가 발화하더라도 본 slice 에서는 임계값을 바꾸지 않는다** — 발화 사실과 산출값만
      기록하고 임계 조정은 규칙 ④ 의 2 task split 으로 넘긴다(Follow-ups 에 append).
- [ ] `377 행` 헤더 개수 표기를 `(S1 14 회분 · S2 4 회분 · S3 3 회분)` 으로 갱신한다.
      **S3 회분은 올리지 않는다** — T-1692 가 이미 같은 run 으로 기록했다.
- [ ] `#### S3 3 회차` 꼬리의 **이월 문단 뒤에 해소 pointer 1 줄**을 추가한다 — 같은 run 의 S1 · S2 leg
      가 본 slice 에서 회수됐다는 사실만. 기존 문장 · 수치 **삭제 0**(이력 보존).
- [ ] `§5` item 5 꼬리에 본 slice 집행 문단 1 개를 append 한다 (재독 전용 · 새 dispatch 0 · 회분
      S1 13→14 · S2 3→4 · 재계수 결과 · `p(99)` 확보 여부).
- [ ] [PLAN.md](../PLAN.md) `141 행` 꼬리에 1 문장 append 하고 회차 개수를 재계수한다. `140 행`
      checkbox 는 LLM stub · 실 수집 왕복 0 조건 그대로라 `[ ]` 유지.
- [ ] `§3` 임계 표 · `STUB_BASELINE_P95_MS` · drift-guard spec 은 **문자 단위 0 변경**. 변경했다면 위반이다.
- [ ] `git diff --stat` 이 **2 파일**(`docs/ops/load-resilience-test-plan.md` · `docs/PLAN.md`) 이고
      `src/` · `test/` · `.github/workflows/` · `package.json` 변경이 **0** 임을 확인한다.
- [ ] 확인용으로 `pnpm lint` 를 1 회 돌려 무경고를 확인한다 (doc-only · production 0 LOC 라 R-110 tester
      의무 면제 — CLAUDE.md `§3.2`).

## Out of Scope

- **새 dispatch · rerun · 재시도** — 본 slice 는 이미 끝난 run `32833365988` 의 로그 재독만 한다.
  로그에서 원하는 줄을 못 찾아도 재실행하지 않고 "미출력" 로 사실만 적는다.
- **임계값 조정** — 재계수 결과가 T-1668 트리거를 발화시켜도 `§3` 표 · `STUB_BASELINE_P95_MS` ·
  drift-guard spec 은 건드리지 않는다 (규칙 ④ 의 2 task split — 별도 `pr` + `direct` slice).
- **이전 회차들의 `p99` "미확보" 표기 소급 치환** (`§12` 금지) — 본 회차분만 새로 적는다.
- **단계별 custom Trend 를 `s1-batch.js` · `s2-read.js` 로 확대 배선** — 코드 변경이라 별도 `pr` slice.
- `§3` 표의 S3 `latency cliff 부재` · `error rate < 1% (baseline 후 fix)` fix — 단계 표본 1 회뿐이라
  아직 근거 미달(T-1692 판정 승계).
- `handleSummary()` 신설(후보 B) · 요약 표시 형식 변경 · `K6_SEED_PERSONS` 상한 상향(T-1686 이 유지로 닫음).
- `test/load/*.js` · `.github/workflows/load-k6.yml` · `package.json` **모든 코드 · 워크플로 변경**,
  새 ADR 신설 · [ADR-0054](../decisions/ADR-0054-load-resilience-harness-tool.md) status 변경,
  새 외부 dependency 추가.

## Suggested Sub-agents

`implementer` 단독 (로그 재독 + 기계 재계수 + 문서 기록. doc-only `direct` 라 architect 불요,
R-110 tester 의무 면제 — 확인용 `pnpm lint` 1 회만).

## Follow-ups

(생성 시점 비어 있음 — sub-agent 가 발견한 관련 작업을 여기에 append)

- (planner 사전 메모) ① T-1668 트리거가 발화하면 규칙 ④ split 대로 코드 `pr`(상수 + drift-guard 동기)
  → 문서 `direct`(임계 표 · 각주 · 규칙 소절 · `§5`) 2 slice 가 다음 칸이다.
- (planner 사전 메모) ② 단계별 Trend 표본이 2 회 이상 누적되면 `§3` 표의 `latency cliff 부재` 판정
  근거 서술과 설계 조항 ⑥ 꼬리의 "표시 수단(후보 A · B)" 판단이 비로소 입력을 갖는다.

## 완료 기록

- 완료: 2026-08-25T10:52Z (cron fire `cron@aa-local-5b1851f0-15422`)
- 내용 commit: `d6bfe1a1` (direct → main), 2 파일 `+189/-2`
- 결과 요약: 기존 run `32833365988` 의 로그를 **재독만** 해(새 `workflow_dispatch` ·
  rerun · 재시도 **0**) S1 leg · S2 leg 수치를 회수하고 부하계획 `§3.1` 에
  `#### 14 회차` · `#### S2 4 회차` 를 신설했다. S1 batch `p95 770.66ms` (임계 3 종 통과) ·
  S2 전역 `p95 6.94ms` (임계 6 종 통과) 를 원문 인용으로 박제했고, T-1688 이 넣은
  `p(99)` 열이 S1 · S2 두 축에서 처음 확보됐다. T-1668 재확정 규칙을 기계 재계수
  (표본 11 · 평균 `794.75ms` · σ `72.40ms` · 평균+3σ `1011.94ms`) 한 결과 트리거
  **미발화** — 임계값 변경 **0**. `377 행` 헤더는 `(S1 14 회분 · S2 4 회분 · S3 3 회분)`
  로 갱신, `§3` 임계 표 · `STUB_BASELINE_P95_MS` · drift-guard spec 은 문자 단위
  **0 변경**, 코드 · 워크플로 · `package.json` 변경 **0**.
