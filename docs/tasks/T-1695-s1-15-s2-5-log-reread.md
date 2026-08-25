---
id: T-1695
title: 같은 run 재독으로 S1 15 회차 · S2 5 회차 실측 회수 + T-1668 규칙 기계 재계수
phase: P5
status: PENDING
commitMode: direct
coversReq: [REQ-047, REQ-048]
independentStream: load-k6-baseline-record
dependsOn: [T-1694]
touchesFiles:
  - docs/ops/load-resilience-test-plan.md
  - docs/PLAN.md
estimatedDiff: 200
estimatedFiles: 2
created: 2026-08-25
createdAt: 2026-08-25T12:20:00Z
plannerNote: PLAN 141 행 R-91 chain 다음 칸 — T-1694 run 32843613484 재독만으로 S1 15·S2 5 회차 회수 + p95 1.15s 기계 재계수, 임계 변경은 split 이월
---

# T-1695 — 같은 run 재독으로 S1 15 회차 · S2 5 회차 실측 회수 + T-1668 규칙 기계 재계수

## Why

[PLAN.md](../PLAN.md) `141 행` (R-91 부하 검증, 오너 최우선 지시) chain 의 다음 칸이며 T-1694
Follow-up **②** 다. T-1694 는 `load-k6.yml` 을 정확히 1 회 dispatch(run `32843613484`) 해 **S3 leg
수치만** 회수했고, 같은 run 의 S1 · S2 leg 는 diff cap 때문에 `#### S3 4 회차` 꼬리에 "다음 slice 가
같은 로그를 재독만 해 박제한다" 로 명시 이월했다. 본 slice 는 **그 로그를 재독만** 해
(새 `workflow_dispatch` · rerun · 재시도 **0**) `§3.1` 에 `#### 15 회차`(S1) 와 `#### S2 5 회차` 를
신설한다 — T-1680→T-1681, T-1684→T-1685, T-1692→T-1693 세 선례를 그대로 승계한다.

T-1694 가 남긴 두 Follow-up 중 **② 재독** 을 ① (`latency cliff` 판정 · 조항 ⑥ 표시 수단 결정)
보다 **먼저** 놓는다. 이미 태운 run 의 미회수 leg 를 먼저 거두는 것이 본 chain 의 확립된 순서이고,
① 의 판정도 같은 run 의 S1 · S2 축 수치가 박제된 뒤에 하는 편이 안전하기 때문이다.

본 회차는 특히 중요하다 — 본 run 의 S1 leg 는 관찰용 게이트를 `✗ 'p(95)<1100' p(95)=1.15s` 로
**크로스**했다(T-1694 가 `#### S3 4 회차` 머리에 사실만 기록해 둠). 이는 T-1668 재확정 규칙의
트리거 **①-(a)** 가 가리키는 바로 그 조건이며, 실 scale 표본 11 개 평균 `794.75ms` · σ `72.40ms`
(T-1693 재계수) 대비 명백한 이탈이다. 본 slice 는 그 값을 규칙대로 **기계 재계수** 하고 발화 여부를
확정하되, **임계값 자체는 바꾸지 않는다** — 숫자 변경은 규칙 ④ 의 2 task split 소관이다.

## Required Reading

- [docs/ops/load-resilience-test-plan.md](../ops/load-resilience-test-plan.md)
  - `377 행` — `### 3.1 baseline 실측 기록 (S1 14 회분 · S2 4 회분 · S3 4 회분)` 헤더 (개수 표기 갱신 대상)
  - `1024~1108 행` — `#### 14 회차` 전문 (**S1 회차 서식 정본**: 측정 일시/run · THRESHOLDS 원문 ·
    수치 · `p(99)` 확보 블록 · T-1668 규칙 기계 재계수 블록 · 한계 pointer)
  - `1333~1412 행` — `#### S2 4 회차` 전문 (**S2 회차 서식 정본**)
  - `1689~1765 행` — `#### S3 4 회차` (같은 run 의 이미 기록된 leg). 머리에 **S1 = step 12 ·
    S2 = step 14** 라는 step 좌표와 `✗ 'p(95)<1100' p(95)=1.15s` · exit 99 사실이 있고, 꼬리
    마지막 bullet 이 **이월 문단**이다 (해소 pointer 추가 대상)
  - `248~280 행` — `- **S1 관찰용 p95 게이트 재확정 규칙 (사전 박제, T-1668)**` 조문 ①~④ 와
    성격 구분 불변 (기계 재계수 · split 근거)
  - `192~200 행` — `§3` 임계 표 (**문자 단위 0 변경 대상**)
  - `1814 행` ~ 파일 끝 — `§5` item 5 (집행 문단 append 대상)
- [docs/tasks/T-1693-s1-14-s2-4-log-reread.md](T-1693-s1-14-s2-4-log-reread.md) — 재독 전용 slice 의
  직전 선례 (새 dispatch 0 · 재계수 절차 · 표기 규약 · 완료 기록 형식)
- [docs/tasks/T-1694-s3-stage-trend-second-dispatch-record.md](T-1694-s3-stage-trend-second-dispatch-record.md) —
  본 run(`32843613484`) 의 dispatch 조건과 Out of Scope 이월 문구
- [docs/PLAN.md](../PLAN.md) `141 행` (머리 회차 개수 표기 + 꼬리)
- [CLAUDE.md](../../CLAUDE.md) `§3.1`(commit mode rule 1) · `§12`(언어 · 범위 좌표 표기 · 소급 치환 금지)

## Acceptance Criteria

- [ ] `gh run view 32843613484 --log` 를 **재독만** 한다. 새 `gh workflow run` · rerun · 재시도는
      **0** — 한 번이라도 실행했다면 위반이다. run conclusion 이 `failure` 라는 사실은 재실행 사유가
      **아니다**(S1 leg 의 관찰용 게이트 크로스가 원인이며 그 자체가 본 slice 의 회수 대상이다).
- [ ] S1 leg step 12(`k6 S1 평가 배치 부하 시나리오 실행`) 로그에서 다음을 **원문 그대로** 옮겨 적는다
      (추정 · 재계산 · 다른 회차 값 전용 **금지**, 로그에 없으면 "미출력" 로 명시):
  - step 구간 · step conclusion · k6 exit code · head sha, THRESHOLDS **3 종** 원문과 `✓`/`✗`
  - `http_req_duration{route:batch}` 원문 줄(**`p(99)` 열 포함**), `http_reqs`, `http_req_failed`,
    `iteration_duration`, `iterations`
  - 표본 로그 줄 `[s1-batch] devset 표본 취득 …명 / 요청 …명`, seed step 의 적재 건수 줄,
    `level=error` 줄 수
- [ ] S2 leg step 14(`k6 S2 조회 API 응답 지연 시나리오 실행`) 로그에서도 같은 방식으로 회수한다 —
      step 구간 · conclusion · exit code, THRESHOLDS **6 종** 원문과 `✓`/`✗` 개수, 전역 및 route 별
      `http_req_duration` 원문 줄(**`p(99)` 열 포함**), `http_req_failed`, `http_reqs`, `iterations`,
      `level=error` 줄 수.
- [ ] `§3.1` 의 `#### 14 회차` **직후**에
      `#### 15 회차 (T-1695, run 32843613484, T-1694 dispatch 의 S1 leg 재독 회수 — 관찰용 게이트 크로스)`
      를, `#### S2 4 회차` **직후**에 `#### S2 5 회차 (T-1695, run 32843613484, 같은 run 재독 회수)`
      를 신설한다. 각각 **인접 선례 소절의 블록 서식을 그대로 승계**한다.
- [ ] `#### 15 회차` 안에서 T-1668 재확정 규칙을 **기계 재계수** 한다 — 실 scale(표본 133) 수치 회수
      회차 목록 · 개수 · 평균 · 표본표준편차 · 평균+3σ 를 규칙 ②·③ 대로 계산해 적고(outlier 제거
      **금지** — `p95 1.15s` 표본을 반드시 포함), 트리거 **①-(a)**(THRESHOLDS 에 `p(95)<1100` 이
      `✗`) 와 **①-(b)**(평균+3σ 가 현 임계 `1100ms` 초과) 각각의 발화 여부를 **명시**한다.
- [ ] 게이트 크로스 값의 **정밀도 한계**를 사실로 적는다 — k6 THRESHOLDS 줄이 `1.15s` 처럼 요약
      단위로 출력되면 ms 단위 원값이 로그 어디에서 확보되는지(예: `http_req_duration{route:batch}`
      행의 `p(95)` 열)를 밝히고, 재계수에 쓴 값이 어느 줄에서 온 것인지 pointer 를 남긴다.
      **없는 정밀도를 추정으로 만들어 내지 않는다.**
- [ ] **트리거가 발화하더라도 본 slice 에서는 임계값을 바꾸지 않는다** — 발화 사실과 산출값(표본 목록 ·
      평균 · 표본표준편차 · 올림 전 값 · 100ms 올림 후 값)만 기록하고, 실제 숫자 변경은 규칙 ④ 의
      **2 task split**(코드 `pr` → 문서 `direct`)으로 넘긴다. 그 split 예고를 `#### 15 회차` 꼬리
      1 줄과 `Follow-ups` 에 함께 남긴다.
- [ ] 두 신설 소절 각각에 **`p(99)` 확보 여부 블록 1 개**를 담는다(출력됐다면 값). **이전 회차들의
      "미확보" 표기는 소급 치환하지 않는다**(`§12`).
- [ ] `377 행` 헤더 개수 표기를 `(S1 15 회분 · S2 5 회분 · S3 4 회분)` 으로 갱신한다. **S3 회분은
      올리지 않는다** — T-1694 가 이미 같은 run 으로 기록했다.
- [ ] `#### S3 4 회차` 꼬리의 **이월 문단 뒤에 해소 pointer 1 줄**을 추가한다 — 같은 run 의 S1 · S2
      leg 가 본 slice 에서 회수됐다는 사실만. 기존 문장 · 수치 **삭제 0**(이력 보존).
- [ ] `§5` item 5 꼬리에 본 slice 집행 문단 1 개를 append 한다 (재독 전용 · 새 dispatch 0 · 회분
      S1 14→15 · S2 4→5 · 재계수 결과와 트리거 발화 여부 · 임계 변경 0 · split 이월).
- [ ] [PLAN.md](../PLAN.md) `141 행` 꼬리에 1 문장 append 하고, **머리의 회차 개수 표기를 문서
      기준으로 재계수**한다 — 현재 머리는 `S1 14 회 · S2 4 회 · S3 3 회` 로 남아 있어 T-1694 가
      올린 S3 4 회분과 갈려 있다. 본 slice 에서 `S1 15 회 · S2 5 회 · S3 4 회` 로 맞추고, 괄호 안의
      실 scale dispatch · 수치 회수 회수도 `§3.1` 원문에서 다시 세어 적는다. `140 행` checkbox 는
      LLM stub · 실 수집 왕복 0 조건 그대로라 `[ ]` 유지.
- [ ] `§3` 임계 표 · `STUB_BASELINE_P95_MS` · drift-guard spec 은 **문자 단위 0 변경**. 변경했다면 위반이다.
- [ ] `git diff --stat` 이 **2 파일**(`docs/ops/load-resilience-test-plan.md` · `docs/PLAN.md`) 이고
      `src/` · `test/` · `.github/workflows/` · `package.json` 변경이 **0** 임을 확인한다.
- [ ] 확인용으로 `pnpm lint` 를 1 회 돌려 무경고를 확인한다 (doc-only · production 0 LOC 라 R-110 tester
      의무 면제 — CLAUDE.md `§3.2`).

## Out of Scope

- **새 dispatch · rerun · 재시도** — 본 slice 는 이미 끝난 run `32843613484` 의 로그 재독만 한다.
  로그에서 원하는 줄을 못 찾아도 재실행하지 않고 "미출력" 로 사실만 적는다. run conclusion 이
  `failure` 인 것도 재실행 사유가 아니다.
- **임계값 조정** — 재계수 결과가 T-1668 트리거를 발화시켜도 `§3` 표 · `STUB_BASELINE_P95_MS` ·
  drift-guard spec 은 건드리지 않는다 (규칙 ④ 의 2 task split — 별도 `pr` + `direct` slice).
- **`p95 1.15s` 원인 분석 · runner 성능 가설** — 로그에 없는 원인은 추정하지 않는다. 사실(값 ·
  게이트 결과 · exit code)만 박제한다.
- **`latency cliff` 유무 판정 · 설계 조항 ⑥ 꼬리 "표시 수단(후보 A · B)" 결정** — 단계 표본 2 개가
  모여 입력은 갖췄으나 본 slice 는 S1 · S2 축 회수 전용이다(T-1694 Follow-up ① — 다음 칸).
- **이전 회차들의 `p99` "미확보" 표기 소급 치환** (`§12` 금지) — 본 회차분만 새로 적는다.
- **단계별 custom Trend 를 `s1-batch.js` · `s2-read.js` 로 확대 배선** — 코드 변경이라 별도 `pr` slice.
- `handleSummary()` 신설(후보 B) · 요약 표시 형식 변경 · `K6_SEED_PERSONS` 상한 상향(T-1686 이 유지로 닫음).
- `test/load/*.js` · `.github/workflows/load-k6.yml` · `package.json` **모든 코드 · 워크플로 변경**,
  새 ADR 신설 · [ADR-0054](../decisions/ADR-0054-load-resilience-harness-tool.md) status 변경,
  새 외부 dependency 추가.

## Suggested Sub-agents

`implementer` 단독 (로그 재독 + 기계 재계수 + 문서 기록. doc-only `direct` 라 architect 불요,
R-110 tester 의무 면제 — 확인용 `pnpm lint` 1 회만).

## Follow-ups

(생성 시점 비어 있음 — sub-agent 가 발견한 관련 작업을 여기에 append)

- (planner 사전 메모) ① T-1668 트리거가 발화하면 규칙 ④ split 대로 **코드 `pr`**
  (`s1-batch.js` 의 `STUB_BASELINE_P95_MS` + drift-guard spec 의 `S1_STUB_BASELINE_P95_MS` ·
  mutation 대조군을 **같은 commit** 에서 동기) → **문서 `direct`**(`§3` 임계 표 · 각주 · 규칙
  소절 · `§5` item 5) 2 slice 가 다음 칸이다. 두 가지를 한 task 로 합치지 않는다.
- (planner 사전 메모) ② 단계별 Trend 표본이 **2 개** 모였으므로(T-1692 3 회차 · T-1694 4 회차)
  `§3` 표의 `latency cliff 부재` 판정 근거 서술과 설계 조항 ⑥ 꼬리 "표시 수단(후보 A · B)" 결정이
  입력을 갖는다 — 위 ① 이 트리거로 선점되면 그 뒤 칸이다.
- (T-1695 실행 결과 추가) ③ **T-1668 트리거 ①-(a) · ①-(b) 가 둘 다 발화했다** — 실 scale 표본
  **12 개** 평균 **824.73ms** · 표본표준편차 **124.70ms** · 평균+3σ **1198.83ms** → 100ms 올림
  **1200ms**. 따라서 위 ① 의 2 slice split 이 **다음 칸으로 확정**됐다: **(i) 코드 `pr`** 이
  [`s1-batch.js`](../../test/load/s1-batch.js) `STUB_BASELINE_P95_MS` 와 drift-guard spec 의
  `S1_STUB_BASELINE_P95_MS` · mutation 대조군을 **같은 commit** 에서 `1100 → 1200` 으로 동기하고,
  **(ii) 문서 `direct`** 가 `§3` 임계 표 · 도출식 각주 · 규칙 소절 · `§5` item 5 를 맞춘다. 본
  slice 는 발화 사실과 산출값만 박제했고 임계는 **문자 단위 0 변경**이다.
- (T-1695 실행 결과 추가) ④ 위 ② (`latency cliff` 판정 · 조항 ⑥ 표시 수단 결정) 는 ③ 뒤 칸으로
  밀린다 — 규칙 ④ 집행이 임계 정합성 축이라 우선한다.

## 결과 요약 (완료: 2026-08-25T13:10:00Z)

- `gh run view 32843613484 --log` **재독만** 수행 — 새 `gh workflow run` · rerun · 재시도 **0**.
  run conclusion 이 `failure` 인 것도 재실행 사유로 삼지 않았다.
- [load-resilience-test-plan.md](../ops/load-resilience-test-plan.md) `§3.1` 에
  `#### 15 회차`(S1 leg step 12, 11:43:06Z~11:43:07Z, step conclusion `failure`, k6 exit **99**) 와
  `#### S2 5 회차`(S2 leg step 14, 11:43:07Z~11:43:27Z, `success`, exit **0**) 신설.
- S1: THRESHOLDS 3 종 중 `✓ 'p(95)<3600000' p(95)=1.15s` · **`✗ 'p(95)<1100' p(95)=1.15s`** ·
  `✓ 'rate<0.01' rate=0.00%`(`0 out of 7`), `http_reqs` **7**, `level=error` **1 줄**(crossed).
  **정밀도 한계** — 콘솔은 `1.15s` 요약 단위뿐이라 ms 원값은 step 13 summary JSON 의
  `"http_req_duration{route:batch}"` `"p(95)": 1154.508883` 에서만 확보(추정 **0**).
- S2: THRESHOLDS **6/6 `✓`**(전역 p95 **6ms** · route 별 5.42~6.28ms · `http_req_failed`
  **0.00%** `0 out of 24963`), `http_reqs` **24963** · `iterations` **6239**. S1 이 red 인데도
  step 14 가 돌아 **"S1 red 여도 S2 가 돈다" 실 run 첫 실증** 확보.
- `p(99)` 두 축 모두 **연속 2 회** 출력(S1 전역 **1.09s** / JSON `1092.3536449599994`, S2 전역
  **7.45ms**). 이전 회차 "미확보" 표기 **소급 치환 0**(`§12`).
- T-1668 기계 재계수: 표본 **12 개**(outlier 제거 **0** — `1154.51` 포함) 평균 **824.73ms** ·
  표본표준편차 **124.70ms** · 평균+3σ **1198.83ms** → 올림 **1200ms**. 트리거 **①-(a) · ①-(b)
  둘 다 발화** — 그럼에도 `§3` 표 · `STUB_BASELINE_P95_MS` · drift-guard spec 은 **문자 단위
  0 변경**이고 숫자 집행은 규칙 ④ 2 task split 으로 이월했다.
- `377 행` 헤더 `S1 15 회분 · S2 5 회분 · S3 4 회분`, `#### S3 4 회차` 꼬리에 해소 pointer 1 줄
  append(기존 문장 · 수치 삭제 **0**), `§5` item 5 꼬리 집행 문단 1 개 append,
  [PLAN.md](../PLAN.md) `141 행` 머리 회분 재계수(실 scale **13 회 dispatch · 12 회 회수**) +
  꼬리 1 문장 append(`140 행` checkbox `[ ]` 유지).
- `src/` · `test/` · `.github/workflows/` · `package.json` 변경 **0**, `pnpm lint` 1 회 무경고
  (doc-only · production 0 LOC — R-110 tester 면제).
