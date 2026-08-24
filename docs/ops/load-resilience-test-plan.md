# 부하·내성 테스트 계획 (Load / Resilience Test Plan)

본 문서는 Assessment-Agent 의 **부하·내성 테스트 계획**이다. 시나리오·측정 임계·접근
방식·필요 도구를 **먼저 문서로 확정**하고, 실제 harness 구현·CI 통합·도구 도입은
follow-up 으로 남긴다(doc-first). 실제 부하 harness 는 신규 외부 dependency(k6 /
artillery / autocannon 등)를 요구할 가능성이 커, [CLAUDE.md §5](../../CLAUDE.md) 상
새 dependency 추가는 BLOCKED(사람 승인 → ADR)이다 — 따라서 **본 문서는 계획만** 담고
도구 선택 결정 자체는 본 문서 범위 밖이다(§5 follow-up 참조).

관련 문서:

- [docs/requirements.md](../requirements.md) — REQ-047 / REQ-048 (성능 NFR, 둘 다 PLANNED).
- [docs/ops/runbook.md](runbook.md) — 운영 런북(배포·복구·trouble-shoot), 본 문서와 cross-link.
- [docs/ops/daily-deploy-test.md](daily-deploy-test.md) — 일일 배포·자동 테스트 플레이북(기능 스모크, 부하 아님).

> **범위 한정**: 본 문서는 *계획 문서*다. 실제 부하 스크립트·측정 실행·도구 도입은
> 별도 task(대개 pr-mode + 신규 dependency ADR)로 넘긴다(§5).

---

## 1. 목표·범위

부하·내성 테스트는 README 성능 특성(88~92행)을 back 하는 두 NFR 을 검증한다.

- **REQ-047** (requirements.md line 66) — 100~200명 평가대상 × 50~100 repo × ~1000
  confluence page 규모의 **평가 작성 배치가 1시간 이내** 완료. 검증 위치 enum
  `manual + perf test`, 상태 PLANNED.
- **REQ-048** (requirements.md line 67) — 이미 저장된 평가 결과 **조회·시각화가 3초
  이내**(거의 실시간). 검증 위치 enum `perf test`, 상태 PLANNED.

두 REQ 모두 requirements.md line 10 의 검증 위치 enum 중 **`perf`** 에 매핑된다 — 본
계획이 그 `perf` 검증의 시나리오·임계·접근을 정의한다. 기능 정합(functional
correctness)은 unit / e2e 가 이미 cover 하므로 본 문서 범위 밖이며, 본 문서는 **부하 하
성능·내성**만 다룬다.

**범위 밖**: 기능 검증(unit/e2e), 성능 최적화(코드 변경), 실제 harness 코드·CI step 추가.

---

## 2. 부하 시나리오

최소 3 개 시나리오를 정량 임계와 함께 정의한다. 규모 수치는 REQ-047/048 의 기대치에서
파생한다.

### S1. 평가 배치 부하 (REQ-047)

- **부하**: 100~200명 평가대상 × 50~100 repo × ~1000 confluence page 규모의 평가 작성
  배치 1 회.
- **목표**: 배치 **완료 시간 ≤ 1h**. LLM 호출·수집(GitHub/Confluence)·저장 전 구간 포함.
- **관찰**: 완료 시간, 단계별(수집 / LLM / 저장) 소요 분포, 실패·재시도 건수.
- **주의**: 실 LLM·외부 수집 endpoint 의존도가 커, 부하 측정 시 stub/record-replay 또는
  격리 endpoint 필요(§4 참조) — 순수 서버 처리량과 외부 I/O 대기를 분리 측정.
- **(현행) 위 격리 설계는 닫혔다**: [ADR-0057](../decisions/ADR-0057-s1-batch-load-io-isolation.md)
  `D1` 이 env 기반 stub gateway 주입(env `LOAD_TEST_STUB` 가 정확히 `1` 일 때만 stub LLM
  gateway 바인딩, fail-safe default OFF)으로 결정했고 배선까지 완료됐다(T-1627 ~ T-1629,
  `load-k6.yml` 의 S1 step 이 해당 env 를 주입). 잔여는 baseline 실측(§5 item 5).

### S2. 조회 API 응답 지연 (REQ-048)

- **부하**: 이미 저장된 평가 결과에 대한 조회·시각화 read 요청을 반복(warm cache /
  cold 양쪽).
- **목표**: **p95 latency < 3s** (README line 92 "3초 이내"). p50 도 함께 관찰.
- **관찰**: p50 / p95 / p99 latency, throughput(req/s), error rate.
- **대상 endpoint**: 조회·시각화 read API(요약·평가 결과 조회 경로). 실제 대상 목록은
  harness 구현 시 [docs/architecture](../architecture) 의 API 뷰에서 확정.

#### S2 dataset 교체 설계 (사전 박제)

T-1661 이 S1 에서 끝낸 "합성 seed → 실 devset 조회" 전환을 S2 에도 적용하기 전에, 교체 범위와
보존 계약을 **코드 착수 이전에** 여기서 고정한다(T-1668 규칙 박제 → T-1669 기계 적용이 검증한
순서 승계). 본 소절은 설계 박제일 뿐이라 이 회차의 코드 · 워크플로 · spec · 임계 상수 변경은
**0** 이고 실 run 도 **0** 이다. 집행 대상 원문은 [`s2-read.js`](../../test/load/s2-read.js),
선례는 [`s1-batch.js`](../../test/load/s1-batch.js) 의 `setup()` / `teardown()` 이다.

**① 교체 범위 — person leg 만 조회로 전환한다.** `setup()` 의 `POST /api/persons` ×
`SEED_PERSONS` 반복 생성을 S1 과 동형인 **조회 1 회**로 바꾼다: `GET /api/persons` → email 이
`@load.devset.test`(도메인 정본은
[`realdata-devset-seed-descriptors.ts`](../../test/helpers/realdata-devset-seed-descriptors.ts),
k6 쪽은 그 사본 상수)로 끝나는 원소만 `filter` → `slice(0, SEED_PERSONS)` → `map` 으로 id 추출,
전 과정을 **단일 식**으로 잇는다(중간 변수 0 · 조건 분기 0 · `Math.min` 0 — T-1620 승계 규약).
`group` / `part` leg 는 **합성 seed 를 그대로 유지**한다 — devset seed 경로는 `Person` 과
`ServiceIdentity` 두 leg 만 적재해 `Group` · `Part` row 가 0 이므로, 이 둘까지 조회로 바꾸면
`default()` 의 `groups` / `parts` 타격이 빈 배열 위에서 돌아 p95 가 아무것도 입증하지 못한다.
인증 부트스트랩(signup → login) 2 왕복과 `me` 타격, route tag 4 종은 무변경이다.

**② 공유 dataset 보존 계약 — `teardown()` 의 person DELETE 루프를 제거한다.** 조회로 소비한
person 은 workflow 의 `133 로그인 실 dataset seed 적재` step(`114 행`)이 적재한 **공유 dataset**
이라, 지우면 같은 job 의 뒤따르는 S3 step 과 다음 run 이 빈 DB 위에서 돈다(T-1661 이 S1 에서
이미 확정한 계약). `group` / `part` DELETE 루프는 **그대로 유지**하고(그 둘은 여전히 이 스크립트가
만든 row 다), "user row 는 삭제 endpoint 자체가 없어 남긴다" 예외 주석도 유지한다. 이 제거로
`personIds` 의 유일한 소비처가 사라지므로, T-1666 이 S1 에 배선한 **표본 로그 1 줄**을 같은
형태로 둔다 — devset 필터를 통과한 **총 건수**와 실제로 취한 **표본 수**를 함께 찍어(`슬라이스
이전 건수`가 곧 seed 완전성 신호), 표본 상한이 총 건수보다 작아도 적재 실패와 구분된다. 로그에는
수치만 싣고 email 원문 · 자격증명 · 경로는 싣지 않는다(T-1666 규약 승계).

**③ `K6_SEED_PERSONS` 의미 재정의 — 숫자는 무변경(`30`).** 의미는 "생성할 person 수" 에서
"**조회 결과에서 취할 표본 상한**" 으로 바뀐다. 그럼에도 **parity 는 유지**한다 — workflow S2 step
(`195~201 행`)의 주입값 ↔ 스크립트 `__ENV` 기본값 ↔ drift-guard 단언의 3 자 대조는 불변이며,
정규화 표현(`Math.max(1, Math.trunc(Number(...)) || 30)`)도 그대로 둔다. **값 자체는 이번 교체에서
바꾸지 않는다(`30` 유지)** — 근거는 세 가지다. (a) 한 회차에 바꾸는 변수는 dataset 성격 하나로
제한한다(규모 축까지 동시에 움직이면 첫 실측의 원인 귀속이 불가능해진다). (b) 부하 지표를 만드는
것은 `default()` 의 `GET /api/persons` 응답 **행 수(devset 전량)** 이고 표본 상한은 `setup()` 이
메모리에 남기는 id 배열 길이일 뿐이라, 상한 값은 측정 의미에도 HTTP 왕복 수에도 영향이 없다.
(c) 적재 완전성 진단은 ② 의 로그가 총 건수를 함께 찍어 대신한다. 상한 상향(예: devset 정본 규모
`133`)은 **S2 첫 실측 이후 별도 판단**이며, 코드 task 안에서의 즉석 변경은 금지한다.

**④ drift-guard 단언 대체 목록.** 아래는 [`load-workflow-k6-harness-wiring-drift.smoke-spec.ts`](../../test/smoke/load-workflow-k6-harness-wiring-drift.smoke-spec.ts)
에서 교체와 **같은 commit 에** 갱신돼야 하는 단언이다(행 좌표는 설계 시점 기준 pointer).

- (a) T-1623 블록 `710 행` — `setup` 안 `http.post(` 개수 `5` 단언 → **`4`**(group · part ·
  signup · login). 대체물: `GET /api/persons` **1 회** 단언 + devset 도메인 필터 문자열 단언 +
  `filter → slice(0, SEED_PERSONS) → map` 단일 식 정규식 단언(T-1661 의 `3280 행` 동형).
- (b) 같은 블록 `708 행` — `S2_ROUTES` 3 종 route 문자열이 `setup` 에 있다는 단언은 `/api/persons`
  가 GET 로 남으므로 **표현 무변경**. 대체는 "생성" 을 전제하던 주석 1 줄뿐이다.
- (c) 같은 블록 `719~726 행` — teardown 단언 2 종이 바뀐다. `http.del(` 개수 `3` → **`2`**,
  `S2_ROUTES` 전 3 종의 `${route}/` 포함 단언 → **`groups` · `parts` 2 종으로 축소**. 대체물:
  T-1661 이 S1 에 둔 것과 동형의 **negative** 단언 신설 — teardown 본문에 `personIds` 와 person
  DELETE 반복문이 **잔존 0** 임을 못 박아 보존 계약이 되돌려지는 drift 를 막는다.
- (d) 같은 블록 `729~736 행` parity 단언과 T-1634 블록 `2005~2011 행` 의 정규화 표현 · 기본값 `30`
  parity 단언 — ③ 이 숫자를 무변경으로 확정했으므로 **표현 그대로 유지**. 다만 그 단언이 지키는
  값의 *의미*("생성 인원" → "표본 상한")가 바뀌므로 주석 문구만 갱신한다.
- (e) 리터럴 `"30"` 직접 대조 단언 3 곳(`764 행` · `771 행` · `1032 행`)과 `2088 행` 의 옛 취약
  표현(`Number(__ENV.K6_SEED_PERSONS || 30)`) 금지 단언 — 숫자 무변경이라 **전부 무변경**.
- (f) `1034 행` 의 `__ENV.` 개수 `2` 단언 — **새 `__ENV` 키를 만들지 않는다**는 계약이다. devset
  도메인은 env 가 아니라 **상수 리터럴**로 두고 정본 파일 경로를 주석으로 지목한다(T-1661 동형).
- (g) **신설 블록 1 개** — T-1661 의 s1 판 블록(`3278 행` 부근)과 동형의 s2 판: 도메인 리터럴 ↔
  정본 parity, 단일 식 유지, teardown 보존 negative, 표본이 조회 결과보다 많은 갈래 / 적은 갈래를
  같은 식 하나가 처리함(분기 0). R-112 의 happy / error / branch / negative 4 종을 이 블록이 채운다.

**⑤ 임계 취급 — 숫자 변경 0.** `§3` 표의 S2 축 p95 **3000ms** 는 **무변경**이고 p50 · throughput 의
`baseline 후 fix` 표기도 그대로다 — S2 축은 실측이 아직 **0 회** 라 확정 근거가 없다(같은 표의
"S2 · S3 의 `baseline 후 fix` 표기는 무변경" 항목 승계). 측정 의미가 합성 person **30** 에서 실
dataset **133** 으로 바뀌는 사실은 임계를 건드릴 사유가 아니라 **해석의 전제**이므로, `§3.1` 의
**S2 첫 실측 회차 기록에서** 규모 · 표본 로그와 함께 다룬다. 본 교체 자체는 스크립트의 임계 배열
(전역 + route 별 4 종)에 한 글자도 손대지 않는다.

**⑥ 집행 경로 split — 2 task, 순서 고정.** 예상 파일은 `s2-read.js` **1** + drift smoke spec **1**
= **2 개**이고, [`load-k6.yml`](../../.github/workflows/load-k6.yml) 은 **불요**다(③ 이 숫자를 무변경
으로 고정했고 (f) 가 새 env 를 금지했으며, S2 step(`195 행`)이 seed step(`114 행`)보다 뒤라 순서
전제도 이미 충족). 그럼에도 한 task 로 묶지 않는 이유는 §3.1 판정이 갈리기 때문이다.

1. **(pr) 교체 집행** — `s2-read.js` + drift smoke spec 2 파일을 **같은 commit** 으로. ④ (a)~(g)
   전부가 이 commit 안에 들어와야 spec 이 red 로 남지 않는다. LOC 추정 스크립트 `+15/-20` · spec
   `+90/-10` ≈ **135 LOC / 2 파일**로 cap(300 LOC / 5 파일) 안이다. 동작 변경이라 `commitMode: pr`.
   → **집행 완료 — T-1672 가 PR #1333 → main `27953b24` 로 머지**(실제 2 파일
   `+267/-33`; 추정 135 LOC 대비 spec 단언 신설분만큼 커졌으나 cap 안, ④ (a)~(g) 전부 동봉).
2. **(direct) 문서 반영** — 본 계획 문서(`§5` item 5 잔여 서술 갱신)와 [PLAN.md](../PLAN.md)
   `141 행` 에 교체 **사실**만 박제한다. 실측 수치는 이 단계에 없다. `docs/` 만 바꾸므로
   `commitMode: direct`(§3.1 rule 1), 1 과 섞으면 rule 3 위반이다.
   → **본 task T-1673 로 닫혔다** — `§5` item 5 문단과 `PLAN.md` `141 행` 꼬리에 집행
   사실만 박제했고 실측 수치 · 임계 · 코드 변경은 0 이다(실 dispatch 는 세 번째 task 소관).

순서는 **1 → 2** 로 고정한다(문서가 아직 없는 코드를 서술하지 않도록). S2 첫 실측 dispatch 와 그
`§3.1` 회차 기록은 위 둘과 또 다른 **세 번째 task** 이며, 실 run 1 회를 쓰므로 본 설계의 범위 밖이다.

**S3 는 본 설계의 범위 밖이다** — [`s3-concurrent.js`](../../test/load/s3-concurrent.js) 는
iteration 안에서 생성한 row 를 스스로 정리하는 read + write 혼합이라 dataset 전제가 S2 와 다르고,
공유 dataset 보존 계약도 다른 형태로 물어야 한다. 별도 slice 로 남긴다.

### S3. 동시 요청 내성 (Resilience)

- **부하**: concurrent read + write(평가 작성 진행 중 조회) 혼합 부하를 동시성 수준을
  올려가며 인가.
- **목표**: 동시성 증가 하에서 **error rate 급증·latency cliff 부재**(graceful
  degradation). 명시 임계는 harness 실측 baseline 확정 후 fix(초기 가이드: error rate
  < 1%, p95 저하가 부하 대비 linear 이내).
- **관찰**: 동시성 단계별 error rate·p95, 커넥션 풀·DB 포화 지점, 타임아웃 발생.

---

## 3. 측정 지표·임계

각 시나리오의 pass/fail 판정 지표를 표로 명시한다. 임계 중 "baseline 후 fix" 표기는
harness 최초 실측으로 기준선을 잡은 뒤 확정한다(over-fitting 방지).

| 시나리오 | 핵심 지표 | pass 임계 | 근거 |
| --- | --- | --- | --- |
| S1 평가 배치 부하 | 배치 완료 시간 | ≤ 1h | REQ-047 (README line 91) |
| S1 평가 배치 부하 | 배치 실패·재시도율 | error rate < 1% | 내성 |
| S1 평가 배치 부하 | `http_req_duration{route:batch}` p95 (관찰용) | ≤ 1100ms (stub 조건 baseline, 표본 133) | 회귀 관찰 — REQ-047 판정 임계 아님 |
| S2 조회 지연 | p95 latency | < 3s | REQ-048 (README line 92) |
| S2 조회 지연 | p50 latency / throughput | baseline 후 fix (관찰용) | 관찰 |
| S2 조회 지연 | error rate | < 1% | 내성 |
| S3 동시성 내성 | error rate (동시성 단계별) | < 1% (baseline 후 fix) | graceful degradation |
| S3 동시성 내성 | p95 저하 곡선 | latency cliff 부재 | 내성 |

- **집계**: latency 는 percentile(p50/p95/p99), throughput 는 req/s 또는 배치/h, error
  rate 는 non-2xx / 전체.
- **환경 고정**: 측정 결과는 실행 환경(CPU/메모리/DB/네트워크)에 종속되므로, 각 run 은
  환경 메타(하드웨어·동시성·데이터 규모)를 함께 기록해 비교 가능하게 한다.
- **S1 관찰용 p95 임계 도출식(현행 1100ms — T-1675 재산정)**: 아래 규칙 ② 의 산정식을 그대로
  재적용해 얻은 **산정 4 종**은 다음과 같다. **표본 목록**은 실 scale(표본 133) 회차 **전량 8 개**
  의 batch p95(3 회차 760.91 · 4 회차 730.81 · 5 회차 711.23 · 6 회차 792.27 · 8 회차 757.65 ·
  9 회차 824.71 · 10 회차 743.96 · 11 회차 967.52ms, outlier 제거 0), **평균 786.13ms**,
  **표본표준편차 81.35ms**, **올림 전 값 1030.18ms**(= 786.13 + 3 × 81.35) 이며 이를 100ms 단위로
  올림해 **1100ms** 로 굳혔다(계산 근거는 `§3.1` 11 회차).
- **위 임계의 원 도출(T-1644)은 이력이며 현행 임계가 아니다**: T-1644 는 표본 133 조건 batch p95
  3 회분(760.91 · 730.81 · 711.23ms)의 평균 **734.32ms** + 3 × 표본표준편차 **25.02ms** =
  **809.38ms** 를 100ms 단위로 올림해 **900ms** 로 굳혔었다(기술통계 근거는 `§3.1` 5 회차). 그 900ms 는
  T-1668 규칙 ①-(a) 가 11 회차 실 run 에서 처음 트리거되며 위 1100ms 로 재확정됐으므로, 본
  문서에서 900ms 가 등장하는 곳은 모두 **그 시점 이력** 서술이다.
- **위 1100ms 는 REQ-047 판정 임계가 아니다**: LLM stub(ADR-0057 `D1`) · 외부 수집 왕복 0 ·
  단일 iteration 조건에서만 성립하는 **회귀 관찰용 기준선**이다. REQ-047 pass/fail 판정은
  1h 예산(`3,600,000ms` — [`s1-batch.js`](../../test/load/s1-batch.js) 의
  `FULL_RUN_BUDGET_MS`) 그대로 유지한다. **스크립트 배선은 T-1645(PR #1316 → main
  `874297ca`)로 완료**됐고 **숫자 동기는 T-1676(PR #1334 → main `ebe6d8f8`)이 집행**했다 —
  [`s1-batch.js`](../../test/load/s1-batch.js) 가
  `STUB_BASELINE_PERSONS = 133` · `STUB_BASELINE_P95_MS = 1100` 두 상수를 두고
  `http_req_duration{route:batch}` 임계 배열에 `p(95)<1100` 을 **표본이 정확히 133 일 때만**
  덧붙이는 **조건부 활성**이라, 기본 표본 10 run 에는 영향이 0 이다. 같은 배열의 첫 원소인
  환산 외삽 임계(`BATCH_P95_MS` = 1h 예산 × 표본/133)는 그대로라 **REQ-047 판정 임계는
  여전히 1h 예산**이고, 1100ms 는 표본 133 조건에서만 얹히는 회귀 관찰용 게이트라는 성격
  구분이 배선 후에도 유지된다.
- **S1 error rate `< 1%` 확정 근거**: baseline 5 회 run 의 `http_req_failed` 이 모두
  **0.00%**(0/26 · 0/26 · 0/272 · 0/272 · 0/272) 로 임계를 여유 있게 만족해
  `(baseline 후 fix)` 태그를 해제했다.
- **S2 · S3 의 `baseline 후 fix` 표기는 무변경**: 두 축은 baseline 실측이 아직 **0 회** 라
  확정 근거가 없어 본 slice 범위 밖이다(S1 축만 확정). S2 축은 T-1674 가 dispatch 를 **1 회**
  소진했으나 같은 job 의 S1 step 이 먼저 fail 해 S2 step 이 `skipped` 됐으므로 **회수된 수치는
  여전히 0 개**이며(경위는 아래 `§3.1` 의 `S2 1 회차`), 표기는 그대로 둔다.
- **각주 — 임계 fix 시점**: 위 표의 "baseline 후 fix" 표기 중 **S1 축은 본 회차(T-1644)로
  fix 완료**다 — 근거는 **실측 5 회분**(run `32459501970` · `32503914467` · `32524618230` ·
  `32533779832` · `32540981922`) 중 표본 133 인 뒤 3 회이며, 그 batch p95 기술통계는 평균
  **734.32ms** · 표본표준편차 **25.02ms**(변동계수 약 **3.41%**) 다(`§3.1` 5 회차).
  `max`(760.91ms) 가 아니라 **평균 + 3σ 마진**(734.32 + 3 × 25.02 = 809.38 → 100ms 올림
  **900ms**)을 택한 이유는 3 표본이 760.91 → 730.81 → 711.23 으로 **단조 감소**라 추세 성분을
  배제할 수 없고(`§3.1` 5 회차 해석), max 를 그대로 쓰면 추세가 반전되는 순간 곧바로 red 가
  되기 때문이다. S2 · S3 의 "baseline 후 fix" 는 해당 축 실측이 0 회라 그대로 남는다
  (`§5` item 5). **단 위 900ms 는 T-1644 시점 이력이며 현행 임계가 아니다** — 현행은 T-1675 가
  실 scale 8 표본으로 재산정한 **1100ms**(평균 786.13 + 3 × 81.35 = 1030.18 → 올림)이고, 집행은
  코드 T-1676(PR #1334 → main `ebe6d8f8`) · 문서 T-1677(본 갱신) 이다.
- **S1 관찰용 p95 게이트 재확정 규칙 (사전 박제, T-1668)**: 위 각주가 fix 한 관찰용 임계(현행
  **`1100ms`**)를 **언제 · 얼마나** 바꿀지를 다음 표본을 보기 **전에** 굳힌다 — 표본을 본 뒤 규칙을 정하면 그
  표본에 맞춘 사후 정당화(over-fitting)가 되기 때문이다. 판정자는 표본 수치만 대입하면 결론이
  하나로 나온다.
  - **① 재확정 트리거** — 다음 둘 중 **하나라도** 참이면 재확정에 착수한다. **(a)** 실 run 의 k6
    `THRESHOLDS` 출력에서 `p(95)<1100` 이 `✗` 로 나온 경우(즉시). **(b)** 실 scale 표본(표본 133
    조건) **전량**의 **평균 + 3σ 가 현 임계를 초과**한 경우. 둘 다 거짓이면 **임계 무변경**이며,
    **여유가 좁아졌다는 사실만으로는 상향하지 않는다** — 예로 `§3.1` 9 회차 시점의 실 scale 표본
    6 개는 평균 **762.93ms** · 표본표준편차 **41.02ms** · 평균+3σ **886.00ms**(여유 **14.01ms**)
    라 (b) 미충족이므로 무변경이다.
  - **② 상향 폭 산정식** — 위 각주의 T-1644 도출식을 **그대로 재적용**한다: 실 scale 표본 전량의
    `평균 + 3 × 표본표준편차` 를 **100ms 단위 올림**. `max` 기반 · p99 기반 · 임의 배수 같은
    **새 식을 발명하지 않는다**. 갱신 시에는 산정에 쓴 **표본 목록 · 평균 · 표본표준편차 · 올림 전
    값** 네 가지를 해당 `§3.1` 회차 소절과 본 규칙 소절에 함께 박제한다.
  - **③ 표본 취급** — **outlier 제거 금지**(임계를 넘긴 표본을 빼고 재계산하지 않는다). 표본은
    **실 scale(133) 회차만** 쓰고 **표본 10 회차는 섞지 않는다**. **하향은 하지 않는다** — 여유가
    다시 넓어져도 flapping 방지를 위해 임계를 낮추지 않으며, 낮출 사유가 생기면 본 규칙과 별도의
    판정을 거친다.
  - **④ 집행 경로** — 숫자를 실제로 바꿀 때는 [CLAUDE.md](../../CLAUDE.md) `§3.1` 판정에 따라
    **task 2 개로 split** 한다. **(i) 코드 `pr`** — [`s1-batch.js`](../../test/load/s1-batch.js) 의
    `STUB_BASELINE_P95_MS` 와
    [`load-workflow-k6-harness-wiring-drift.smoke-spec.ts`](../../test/smoke/load-workflow-k6-harness-wiring-drift.smoke-spec.ts)
    의 `S1_STUB_BASELINE_P95_MS` · mutation 대조군을 **같은 commit 에서** 동기한다(둘이 갈리면
    drift guard 가 red). **(ii) doc `direct`** — `§3` 임계 표 · 위 각주 · `§5` item 5 의 수치를
    갱신한다. 두 가지를 **한 task 로 합치지 않는다**.
    **본 경로의 첫 집행(900ms → 1100ms) 은 완료됐다** — **(i) 코드** 는 T-1676(PR #1334 → main
    `ebe6d8f8`) 이 `s1-batch.js` 상수와 drift-guard spec 의 `S1_STUB_BASELINE_P95_MS` ·
    mutation 대조군을 같은 commit 에서 동기했고, **(ii) 문서** 는 T-1677(본 갱신) 이 `§3` 표 ·
    위 각주 · 본 규칙 소절 · `§5` item 5 를 맞췄다. 규칙 ①~④ 의 판정 논리는 무변경이다.
  - **성격 구분 불변** — 상향하더라도 그것은 stub 조건의 **회귀 관찰용 게이트**일 뿐이며, REQ-047
    pass/fail 판정 임계는 `FULL_RUN_BUDGET_MS`(1h 예산) 그대로다(위 "REQ-047 판정 임계가 아니다"
    서술과 모순 0).

### 3.1 baseline 실측 기록 (S1 11 회분 · S2 1 회분)

#### 1 회차 (T-1637, run 32459501970)

- **측정 일시 / run**: 2026-08-21T07:38:12Z dispatch(`workflow_dispatch`, ref `main`),
  [`load-k6.yml`](../../.github/workflows/load-k6.yml) run id **32459501970**, job
  07:38:16Z~07:40:26Z(약 2분 10초). **conclusion `success`** — smoke → S1 → 요약 기록 → S2 →
  S3 → 정리 12 step 전부 success. S1 step 자체는 07:39:36Z~07:39:37Z.
- **환경 메타**: GitHub-hosted runner label `ubuntu-latest`(runner image `ubuntu-24.04`
  버전 20260816.277.1, OS Ubuntu 24.04.4 LTS, runner 2.336.0), DB 는 service container
  `postgres:16-alpine`, 부하 대상은 저장소 `Dockerfile` 을 run 안에서 빌드한 `assessment-agent:load`
  컨테이너(`--network host`), LLM 은 `LOAD_TEST_STUB=1` 의 stub gateway(ADR-0057 `D1`),
  표본 인원 `K6_S1_PERSONS=10`. **커널(`uname -sr`)·아키텍처·vCPU·메모리 수치는 당시 워크플로의
  "S1 실측 요약 기록" step 이 `$GITHUB_STEP_SUMMARY` 에만 적재해 run 페이지 job summary 에서만
  열람 가능**했고 REST API·job 로그로는 회수되지 않았다. 이 회수 결함은 T-1638(main `55b81dea`)
  이 그 step 의 출력 3 곳을 `| tee -a` 로 전환해 배선을 닫았고, 아래 2 회차가 그 배선의 실제
  회수를 실증했다(§5 item 5 잔여 ③ 해소).
- **S1 수치**: `http_req_duration{route:batch}` **p95 = 99.29ms** — 임계 `p(95)<270677ms`
  (= 3,600,000ms × 10/133, ADR-0057 `D4` 산식을 스크립트가 계산) 통과. `http_req_failed`
  **0.00%(0/26)** — 임계 `rate<0.01` 통과. `iteration_duration` **99.72ms**(iterations 1),
  전체 `http_reqs` 26(66.19 req/s), data_received 9.9 kB / data_sent 12 kB, k6 wall-clock
  00m00.4s. 배치 왕복은 `POST /api/assessment-evaluation/unevaluated-fill-run` 1 회(10 person
  rawBridges)이고 seed·auth 왕복은 `route:seed` / `route:auth` 로 분리돼 위 batch 지표에 섞이지 않는다.

#### 2 회차 (T-1639, run 32503914467)

- **측정 일시 / run**: 2026-08-21T16:37:55Z dispatch(`workflow_dispatch`, ref `main`, head sha
  `0de78eaa` — T-1638 머지 `55b81dea` **이후**라 `tee -a` 배선이 들어간 첫 run), run id
  **32503914467**, job 16:37:59Z~16:40:08Z(약 2분 09초). **conclusion `success`** — 12 step
  전부 success(비-success step 0). S1 step 자체는 16:39:19Z~16:39:20Z.
- **환경 메타(로그로 회수됨)**: `gh run view 32503914467 --log` **만으로** job summary 를 열지
  않고 메타 7 항목 전부를 회수했다 — 커널 `Linux 6.17.0-1022-azure`, 아키텍처 `x86_64`,
  vCPU **4**, 메모리 **15Gi**, DB image `postgres:16-alpine`, 부하 대상 image
  `assessment-agent:load`, 표본 인원 `K6_S1_PERSONS=10`. 회수 경로는 T-1638 이 넣은
  `| tee -a "$GITHUB_STEP_SUMMARY"` 로, 같은 문자열이 job 로그와 step summary 양쪽에 한 번씩만
  남아 복제 0 이다. 즉 1 회차가 실증한 "메타가 API·로그로 회수되지 않는다" 결함은 **해소**됐다.
- **S1 수치**: `http_req_duration{route:batch}` **p95 = 96.98ms** — 같은 임계
  `p(95)<270677ms` 통과. `http_req_failed` **0.00%(0/26)** — 임계 `rate<0.01` 통과.
  `iteration_duration` **97.93ms**(iterations 1), 전체 `http_reqs` 26(61.78 req/s),
  data_received 9.9 kB / data_sent 11.9 kB, k6 wall-clock 00m00.4s. 요청 구성·route 분리는
  1 회차와 동일하다.
- **run-to-run 분산(표본 2 개)**: batch p95 **99.29ms → 96.98ms**(Δ −2.31ms, 약 −2.3%),
  `iteration_duration` **99.72ms → 97.93ms**(Δ −1.79ms, 약 −1.8%), `http_req_failed` 은 두 회
  모두 **0.00%(0/26)**, `http_reqs` count 는 두 회 모두 26(rate 66.19 → 61.78 req/s). 이는
  **분산의 첫 2 표본일 뿐**이라 표준편차·신뢰구간을 말할 수 없다 — 따라서 `§3` 표의
  "baseline 후 fix" 임계 숫자는 **이번에도 무변경**이며 임계 fix 는 반복 run 확보 후로 미룬다
  (§5 item 5 잔여 ②).
- **한계 / 해석(두 회차 공통)**: 표본은 **10 명 축소 표본**이라 REQ-047 의 100~200 명(실 devset 133 명,
  [realdata-scale-devset.md](realdata-scale-devset.md)) 규모를 **직접 검증하지 않는다**. 해석은
  [ADR-0057](../decisions/ADR-0057-s1-batch-load-io-isolation.md) `D4` 의 선형 외삽 산식을 따르되
  같은 `D4` 가 명시한 한계도 그대로다 — 선형 외삽은 상한 보증이 아니고, ① LLM 이 stub 이며
  ② 현 표본 person 은 `ServiceIdentity` 가 없어 수집(GitHub/Confluence) 왕복이 0 이고
  ③ 단일 iteration 이라 p95 가 곧 단일 표본값이다. 따라서 위 수치는 **서버 내부 처리 경로의
  baseline 후보**일 뿐 1h 예산 충족의 증거가 아니다(PLAN `140 행` checkbox `[ ]` 유지 근거).

#### 3 회차 (T-1641, run 32524618230, 표본 133)

- **측정 일시 / run**: 2026-08-21T20:38:50Z dispatch(`workflow_dispatch`, ref `main`, head sha
  `8b9a9bfe` — T-1640 머지 `f6c34b2d` **이후**라 `s1_persons` input 배선이 들어간 첫 run),
  run id **32524618230**, job 20:38:55Z~20:41:09Z(약 2분 14초). **conclusion `success`** —
  12 step 전부 success(비-success step 0). S1 step 자체는 20:40:19Z~20:40:20Z.
- **표본 인원 주입 확인**: "S1 실측 요약 기록" step 로그의 표본 인원 행이
  `| 표본 인원 (K6_S1_PERSONS) | 133 |` 로 찍혀 dispatch input 이 S1 실행 step 과 기록 step
  양쪽 env 에 그대로 주입됐음을 실증했다 — T-1640 이 연 input 배선의 **첫 실사용이 성공**이다
  (`10` 으로 떨어지는 주입 실패 없음).
- **환경 메타(로그로 회수됨)**: `gh run view 32524618230 --log` 만으로 메타 7 항목 전부 회수 —
  커널 `Linux 6.17.0-1022-azure`, 아키텍처 `x86_64`, vCPU **4**, 메모리 **15Gi**, DB image
  `postgres:16-alpine`, 부하 대상 image `assessment-agent:load`, 표본 인원
  `K6_S1_PERSONS=133`. runner 사양은 2 회차와 동일해 표본 인원만 달라진 조건이다.
- **S1 수치**: `http_req_duration{route:batch}` **p95 = 760.91ms** — 임계 `p(95)<3600000ms`
  통과. 표본이 외삽 기준(`EXTRAPOLATION_PERSONS = 133`)과 **같아 외삽 계수가 1** 이 되어 임계가
  1h 예산 전체로 넓어진 것이다(ADR-0057 `D4` 산식을 스크립트가 계산). `http_req_failed`
  **0.00%(0/272)** — 임계 `rate<0.01` 통과. `iteration_duration` **761.86ms**(iterations 1),
  전체 `http_reqs` 272(182.73 req/s), data_received 102 kB / data_sent 123 kB, k6 wall-clock
  00m01.5s. 요청 구성은 고정 왕복 6(배치 1 + signup·login 2 + `D5` provider seed 3) +
  person 당 2(seed write · 정리 DELETE) × 133 = **272** 로, 1·2 회차의 6 + 2×10 = 26 과 같은 산식이다.
- **1·2 회차와의 비교 가능성**: 표본이 **10 → 133 으로 달라 같은 조건의 run-to-run 분산 표본이
  아니다 — 1·2 회차와 직접 비교할 수 없다**. 참고로 batch p95 는 96.98ms(10 명) → 760.91ms(133 명)
  으로 인원 13.3 배에 약 7.85 배 증가했지만, 각 표본 축이 1~2 run 뿐이라 이 비율로 scaling 곡선이나
  선형성 여부를 주장하지 않는다(§3 표 임계 무변경 근거와 동일한 취지).
- **의미 / 한계**: 본 회차는 표본 인원 축이 외삽 기준과 같아 **`D4` 선형 외삽 없이 1h 예산과 직접
  대조된 첫 실측**이다(760.91ms = 3,600,000ms 예산의 약 0.02%). 그럼에도 REQ-047 충족의 증거는
  **아니다** — ① LLM 이 여전히 `LOAD_TEST_STUB=1` stub(ADR-0057 `D1`)이고 ② 표본 person 은
  `ServiceIdentity` 가 없어 GitHub/Confluence **수집 왕복이 0**(50~100 repo · ~1000 page 축 미검증)이며
  ③ 단일 iteration 이라 p95 가 곧 단일 표본값이다. 즉 인원 축만 실 scale 이고 데이터·외부 I/O 축은
  그대로 미검증이라 PLAN `140 행` checkbox 는 `[ ]` 유지다.

#### 4 회차 (T-1642, run 32533779832, 표본 133 반복)

- **측정 일시 / run**: 2026-08-21T22:38:18Z dispatch(`workflow_dispatch`, ref `main`, head sha
  `1236a880`), run id **32533779832**, job 22:38:22Z~22:40:36Z(약 2분 14초). **conclusion
  `success`** — 12 step 전부 success(비-success step 0). S1 step 자체는 22:39:44Z~22:39:46Z.
  dispatch 는 `-f s1_persons=133` 으로 **정확히 1 회**만 했고 재시도·재 dispatch 는 없다.
- **표본 인원 주입 확인**: "S1 실측 요약 기록" step 로그의 표본 인원 행이
  `| 표본 인원 (K6_S1_PERSONS) | 133 |` 로 찍혔고 S1 실행 step 의 env 행도 `K6_S1_PERSONS: 133`
  이라, T-1640 이 연 input 배선이 3 회차에 이어 **두 번째로도 성공**했다(default `10` 으로
  떨어지는 주입 실패 없음).
- **환경 메타(로그로 회수됨)**: `gh run view 32533779832 --log` 만으로 메타 7 항목 전부 회수 —
  커널 `Linux 6.17.0-1022-azure`, 아키텍처 `x86_64`, vCPU **4**, 메모리 **15Gi**, DB image
  `postgres:16-alpine`, 부하 대상 image `assessment-agent:load`, 표본 인원
  `K6_S1_PERSONS=133`. **7 항목이 3 회차와 전부 동일**해 runner 사양도 표본 인원도 갈리지 않은,
  조건이 일치하는 반복 run 이다.
- **S1 수치**: `http_req_duration{route:batch}` **p95 = 730.81ms** — 임계 `p(95)<3600000ms`
  통과(표본 133 = `EXTRAPOLATION_PERSONS` 라 외삽 계수 1, ADR-0057 `D4`). `http_req_failed`
  **0.00%(0/272)** — 임계 `rate<0.01` 통과. `iteration_duration` **731.89ms**(iterations 1),
  전체 `http_reqs` 272(191.57 req/s), data_received 102 kB / data_sent 123 kB, k6 wall-clock
  00m01.4s. 요청 수 272 는 3 회차와 같은 산식(고정 왕복 6 + person 당 2 × 133)이라 요청 구성도
  동일하다.
- **실 scale 축의 첫 run-to-run 쌍(표본 2 개)**: 3 회차와 **표본 조건이 같아** 두 run 은 직접
  비교 가능하다 — batch p95 **760.91ms(3 회차) → 730.81ms(4 회차)**, 차이는 **절대 Δ −30.10ms ·
  상대 약 −3.96%**(두 값 평균 745.86ms, 범위 30.10ms). `iteration_duration` 은 **761.86ms →
  731.89ms**(Δ −29.97ms, 약 −3.93%), `http_req_failed` 은 두 회 모두 **0.00%(0/272)**,
  `http_reqs` count 는 두 회 모두 **272**(rate 182.73 → 191.57 req/s). 즉 이것이 외삽 계수 1 인
  **실 scale 축의 첫 run-to-run 쌍**이다 — 1·2 회차가 만든 쌍은 표본 10 축이었다.
- **의미 / 한계**: 실 scale 축에 같은 조건 표본이 2 개가 됐지만 **표본 2 개로는 표준편차·신뢰구간
  같은 분산 추정을 말할 수 없다** — 따라서 `§3` 표의 "baseline 후 fix" 임계 숫자는 **이번에도
  무변경**이다(§3 각주 취지 그대로). 미검증 축도 3 회차와 똑같이 남는다 — ① LLM 이 여전히
  `LOAD_TEST_STUB=1` stub(ADR-0057 `D1`), ② 표본 person 에 `ServiceIdentity` 가 없어 GitHub/
  Confluence **수집 왕복이 0**(50~100 repo · ~1000 page 축 미검증), ③ 단일 iteration
  (`vus: 1, iterations: 1`)이라 p95 가 곧 단일 표본값. 그래서 PLAN `140 행` checkbox 는
  `[ ]` 유지다.

#### 5 회차 (T-1643, run 32540981922, 표본 133 3 회째)

- **측정 일시 / run**: 2026-08-22T00:38:23Z dispatch(`workflow_dispatch`, ref `main`, head sha
  `a9a08e43`), run id **32540981922**, job 00:38:26Z~00:40:45Z(약 2분 19초). **conclusion
  `success`** — 전 step success(비-success step 0). S1 실행 step 은 00:39:54Z~00:39:55Z,
  "S1 실측 요약 기록" step 은 00:39:55Z. dispatch 는 `-f s1_persons=133` 으로 **정확히 1 회**만
  했고 재시도·재 dispatch 는 없다.
- **표본 인원 주입 확인**: "S1 실측 요약 기록" step 로그의 표본 인원 행이
  `| 표본 인원 (K6_S1_PERSONS) | 133 |` 로 찍혔고 S1 실행 step 의 env 행도 `K6_S1_PERSONS: 133`
  이라, `s1_persons` input 배선이 3·4 회차에 이어 **세 번째로도 성공**했다(default `10` 으로
  떨어지는 주입 실패 없음).
- **환경 메타(로그로 회수됨)**: `gh run view 32540981922 --log` 만으로 메타 7 항목 전부 회수 —
  커널 `Linux 6.17.0-1022-azure`, 아키텍처 `x86_64`, vCPU **4**, 메모리 **15Gi**, DB image
  `postgres:16-alpine`, 부하 대상 image `assessment-agent:load`, 표본 인원
  `K6_S1_PERSONS=133`. **7 항목이 3·4 회차와 전부 동일**해 세 회차는 조건이 일치하는 반복
  run 이며 **다른 항목은 없다**(비교 가능성 전제 충족).
- **S1 수치**: `http_req_duration{route:batch}` **p95 = 711.23ms** — 임계 `p(95)<3600000ms`
  통과(표본 133 = `EXTRAPOLATION_PERSONS` 라 외삽 계수 1, ADR-0057 `D4`). `http_req_failed`
  **0.00%(0/272)** — 임계 `rate<0.01` 통과. `iteration_duration` **712.30ms**(iterations 1),
  전체 `http_reqs` 272(194.61 req/s), data_received 102 kB / data_sent 123 kB, k6 wall-clock
  00m01.4s. 요청 수 272 는 3·4 회차와 같은 산식(고정 왕복 6 + person 당 2 × 133)이다.
- **실 scale 표본 3 개(3·4·5 회차) 기술통계 — batch p95 기준**: 세 값은 **760.91ms ·
  730.81ms · 711.23ms**(합 2202.95ms). **평균 734.32ms**(2202.95 / 3), **범위 49.68ms**
  (760.91 − 711.23), **표본표준편차 25.02ms** — 편차 +26.59 / −3.51 / −23.09 의 제곱합
  1252.49 를 자유도 2 로 나눈 626.25 의 제곱근(n−1 분모). 평균 대비 상대 변동폭은 **범위 6.77%**
  (49.68 / 734.32), **변동계수 3.41%**(25.02 / 734.32). `iteration_duration` 도 세 값
  **761.86ms · 731.89ms · 712.30ms**(평균 735.35ms, 범위 49.56ms, 표본표준편차 24.96ms) 로
  batch p95 와 거의 같은 폭이고, `http_req_failed` 은 세 회 모두 **0.00%(0/272)**,
  `http_reqs` count 도 세 회 모두 **272**(rate 182.73 → 191.57 → 194.61 req/s) 다.
- **해석 — 분산이냐 추세냐**: 세 값이 760.91 → 730.81 → 711.23 으로 **단조 감소**라 순수 잡음이
  아니라 체계적 성분(runner 캐시 온도·이미지 레이어 캐시 등)이 섞였을 가능성을 배제할 수 없고,
  n=3 에서는 추세와 잡음을 분리할 수 없다. 다만 감소 폭(Δ −30.10ms → −19.58ms)이 표준편차
  25.02ms 와 같은 크기라 **어느 쪽으로 보든 전체 산포는 평균의 3~7% 안**이고, 세 값 모두 1h
  예산(3,600,000ms)의 **약 0.02%** 다.
- **의미 / 한계**: 실 scale 축 표본이 3 개가 되어 **표준편차·범위 같은 분산 추정을 처음으로 말할 수
  있게 됐다** — 임계 fix 착수 가능 판정의 근거이며 그 판정은 `§5` item 5 잔여 ② 에 적었다. 그러나
  `§3` 표의 임계 **숫자 자체는 본 회차에서도 무변경**이다(숫자 확정은 마진 설계를 포함한 별도
  slice). 미검증 축도 3·4 회차와 똑같이 남는다 — ① LLM 이 여전히 `LOAD_TEST_STUB=1`
  stub(ADR-0057 `D1`), ② 표본 person 에 `ServiceIdentity` 가 없어 GitHub/Confluence **수집
  왕복이 0**(50~100 repo · ~1000 page 축 미검증), ③ 단일 iteration 이라 p95 가 곧 단일 표본값.
  그래서 PLAN `140 행` checkbox 는 `[ ]` 유지다.

#### 6 회차 (T-1647, run 32562811133, 표본 133 4 회째 — 900ms 게이트 첫 실 run)

- **측정 일시 / run**: 2026-08-22T08:38:24Z dispatch(`workflow_dispatch`, ref `main`, head sha
  `07deff81`), run id **32562811133**, job 08:38:28Z~08:40:53Z(약 2분 25초). **conclusion
  `success`** — 전 step success(비-success step 0). S1 실행 step 은 08:40:03Z~08:40:04Z,
  "S1 실측 요약 기록" step 은 08:40:04Z. dispatch 는 `-f s1_persons=133` 으로 **정확히 1 회**만
  했고 재시도·재 dispatch 는 없다.
- **표본 인원 주입 확인**: "S1 실측 요약 기록" step 로그의 표본 인원 행이
  `| 표본 인원 (K6_S1_PERSONS) | 133 |` 로 찍혔고 S1 실행 step 의 env 행도 `K6_S1_PERSONS: 133`
  이라 `s1_persons` input 배선이 3·4·5 회차에 이어 **네 번째로도 성공**했다(default `10` 으로
  떨어지는 주입 실패 없음).
- **게이트 활성·판정(본 회차 핵심)** — (a) **등장했다**: k6 `█ THRESHOLDS` 블록의
  `http_req_duration{route:batch}` 아래에 임계가 **2 개**로 찍혔다 —
  `✓ 'p(95)<3600000' p(95)=792.27ms` 와 `✓ 'p(95)<900' p(95)=792.27ms`. 같은 step 의 summary
  JSON 에도 그 metric 의 `thresholds` 객체가 `"p(95)<3600000": false` · `"p(95)<900": false`
  두 key 를 함께 담았다(k6 규약상 `false` = **미위반**). (b) **통과(green)**: 두 임계 모두 `✓`
  이고 job conclusion 도 `success` 라 게이트가 red 를 만들지 않았다. (c) **여유**: 900 −
  792.27 = **107.73ms**(900ms 기준 약 **11.97%**, 측정값 기준 약 13.60%). 즉 T-1645 의 조건부
  concat 배선은 **런타임에서 실제로 활성화**되며 표본 133 에서 의도대로 얹힌다 — 임계가 1 개만
  보이는 결함은 **없다**.
- **환경 메타(로그로 회수됨)**: `gh run view 32562811133 --log` 만으로 메타 7 항목 전부 회수 —
  커널 `Linux 6.17.0-1022-azure`, 아키텍처 `x86_64`, vCPU **4**, 메모리 **15Gi**, DB image
  `postgres:16-alpine`, 부하 대상 image `assessment-agent:load`, 표본 인원
  `K6_S1_PERSONS=133`. **7 항목이 3·4·5 회차와 전부 동일**해 네 회차는 조건이 일치하는 반복
  run 이며 **다른 항목은 없다**.
- **S1 수치**: `http_req_duration{route:batch}` **p95 = 792.27ms**(원값 792.274282ms, 단일
  iteration 이라 avg=min=med=max 동일) — 외삽 판정 임계 `p(95)<3600000ms` 와 baseline 게이트
  `p(95)<900` 을 **둘 다 통과**. `http_req_failed` **0.00%(0/272)** — 임계 `rate<0.01` 통과.
  `iteration_duration` **794.05ms**(iterations 1), 전체 `http_reqs` **272**(168.29 req/s),
  data_received 102 kB / data_sent 123 kB, k6 wall-clock 00m01.0s. 요청 수 272 는 3~5 회차와
  같은 산식(고정 왕복 6 + person 당 2 × 133)이다.
- **실 scale 표본 4 개(3~6 회차) 기술통계 — batch p95 기준**: 네 값은 **760.91ms · 730.81ms ·
  711.23ms · 792.27ms**(합 2995.22ms). **평균 748.81ms**(2995.22 / 4), **범위 81.04ms**
  (792.27 − 711.23), **표본표준편차 35.46ms** — 편차 +12.11 / −18.00 / −37.58 / +43.47 의
  제곱합 3771.44 를 자유도 3 으로 나눈 1257.15 의 제곱근(n−1 분모). 평균 대비 상대 변동폭은
  **범위 10.82%**(81.04 / 748.81), **변동계수 4.74%**(35.46 / 748.81). **평균 + 3σ 재계산값은
  748.81 + 3 × 35.46 = 855.19ms 로 900ms 를 넘지 않는다**(여유 44.81ms · 900 대비 약 4.98%) —
  따라서 `§3` 표 임계 재확정 사유가 생기지 않았고 숫자는 무변경이다.
  `iteration_duration` 네 값은 **761.86ms · 731.89ms · 712.30ms · 794.05ms**(평균 750.03ms,
  범위 81.75ms, 표본표준편차 35.73ms) 로 batch p95 와 거의 같은 폭이고, `http_req_failed` 은
  네 회 모두 **0.00%(0/272 · 0/272 · 0/272 · 0/272)**, `http_reqs` count 도 네 회 모두
  **272**(rate 182.73 → 191.57 → 194.61 → 168.29 req/s) 다.
- **해석 — 단조 감소의 반전**: 3~5 회차의 760.91 → 730.81 → 711.23 **단조 감소가 6 회차
  792.27 에서 반전**했다(Δ **+81.04ms** · 약 +11.4%, 4 회차 통틀어 새 max). 5 회차가 배제하지
  못했던 "체계적 하락 추세" 가설은 이 반전으로 약해지고, 네 값은 평균 주변 산포로 읽는 쪽이
  자연스럽다. 실무 함의는 **T-1644 의 마진 설계가 본 회차로 검증됐다**는 것 — 그때 max
  (760.91ms) 를 그대로 임계로 굳혔다면 792.27ms 는 곧바로 red 였고, 평균 + 3σ 올림(900ms) 을
  택한 덕에 정상 산포가 false red 를 만들지 않았다. 네 값 모두 1h 예산(3,600,000ms)의 **약
  0.02%** 다.
- **의미 / 한계**: 본 회차로 **"배선된 게이트가 실 run 에서 활성·판정되는가" 축이 해소**됐다
  (임계 2 개 등장 + 둘 다 ✓ + 여유 107.73ms). 그러나 미검증 축은 3~5 회차와 똑같이 남는다 —
  ① LLM 이 여전히 `LOAD_TEST_STUB=1` stub(ADR-0057 `D1`), ② 표본 person 에 `ServiceIdentity`
  가 없어 GitHub/Confluence **수집 왕복이 0**(50~100 repo · ~1000 page 축 미검증), ③ 단일
  iteration 이라 p95 가 곧 단일 표본값. 그래서 PLAN `140 행` checkbox 는 `[ ]` 유지다.

#### 7 회차 (T-1663, run 32652307813, 실 dataset seed 배선 후 첫 run — seed step **fail**)

- **측정 일시 / run**: 2026-08-23T16:38:45Z dispatch(`workflow_dispatch`, ref `main`, head sha
  `0046e366`), run id **32652307813**, job 16:38:49Z~16:40:23Z(약 1분 34초). **conclusion
  `failure`** — `133 로그인 실 dataset seed 적재` step(16:40:18Z~16:40:21Z)이 fail 하고 그 뒤
  `k6 설치` · `k6 부하 스크립트 실행`(smoke) · `k6 S1 평가 배치 부하 시나리오 실행` · S2 · S3
  **5 step 이 전부 skipped** 로 떨어졌다. `if: always()` 인 "S1 실측 요약 기록" 과 "부하 대상
  정리" 만 그 뒤에서 success. dispatch 는 `-f s1_persons=133` 으로 **정확히 1 회**만 했고
  재시도·재 dispatch 는 없다(Out of Scope 준수).
- **seed step 결함(본 회차 핵심)** — 실패 지점은 **ServiceIdentity leg 의 첫 upsert**다. 로그
  원문(자격증명 제외): `devset seed 실패:` / ``Invalid `checked.serviceIdentity.upsert()`
  invocation in .../test/helpers/realdata-devset-seed-identity-upsert-runner.ts:121:50`` /
  ``Argument `person` is missing.`` / ` ELIFECYCLE  Command failed with exit code 1.`.
  Prisma 가 되돌려준 진단 블록은 `create: { service: "github.com", externalId: "...",
  isPrimary: true }` 에 `person: { create | connectOrCreate | connect }` 가 **없다**고 짚는다.
  즉 [`realdata-e2e-seed-upsert.ts`](../../test/helpers/realdata-e2e-seed-upsert.ts) 의
  `ServiceIdentityUpsertArgs.create` shape(T-0574/T-0716 유래, T-1652 가 devset chain 으로
  승계)이 `where.personId_service.personId` 만 런타임 치환하고 **`create` 쪽 Person 관계를
  비워둔 것**이 원인이다 — checked client 는 관계 필수 인자를 요구하므로 거부한다. 앞선 helper
  7 종의 colocated spec 은 mock client 에 대한 **shape 단언**이라 이 런타임 계약을 재현하지
  못했고, 그래서 배선 11 slice 를 통과하고도 첫 실 run 에서 드러났다. **본 slice 는 고치지
  않는다**(Out of Scope) — 수정은 Follow-ups 의 별도 pr-mode slice.
- **적재 인원 수**: Person leg 는 identity leg 보다 **먼저 완주**했다
  ([`realdata-devset-seed-run.ts`](../../test/helpers/realdata-devset-seed-run.ts) 가 ② Person
  → ④ identity 순차 실행, 두 leg 모두 `$transaction` 없이 개별 upsert). 실패 메시지의
  `where.personId_service.personId` 가 placeholder 가 아닌 실 cuid(`cmt619key0000...`)로
  치환돼 있는 것이 Person leg 결과가 회수됐다는 증거다. 다만 CLI 는 **성공 요약만 마지막에
  출력**하므로 `133` 이라는 **적재 인원 수 자체는 로그로 회수 실패** — "몇 명이 적재됐다" 는
  수치는 본 run 에서 확정할 수 없다(추정치를 적지 않는다).
- **`setup()` 소비 경로(T-1661) 검증**: **회수 실패 — 미검증**. S1 step 이 skipped 라
  `GET /api/persons` 조회도 `POST /api/persons` 합성 생성도 로그에 **흔적이 0** 이다. 따라서
  본 run 은 T-1661 배선의 결함 여부를 **긍정도 부정도 하지 못한다**(합성 생성 흔적이 없다는
  사실은 스크립트가 아예 실행되지 않은 데서 오는 것이지 정상 동작의 증거가 아니다).
- **k6 수치**: **전부 회수 실패**. `http_req_duration{route:batch}` 의 임계 2 개
  (`p(95)<3600000` · `p(95)<900`)를 담은 `█ THRESHOLDS` 블록은 **출력 자체가 없고**(S1 step
  미실행), `http_req_failed` · `iteration_duration` · `http_reqs` 도 마찬가지다.
  `--summary-export` 산출물도 없어 "S1 실측 요약 기록" step 이 `요약 파일 없음 — k6 가 요약을
  남기기 전에 종료했다 (설치/부팅 실패 등).` 를 찍었다. 따라서 **실 scale 표본 수는 4 개
  (3~6 회차) 그대로**이며 5 개가 되지 않았다 — 평균 **748.81ms** · 범위 **81.04ms** ·
  표본표준편차 **35.46ms** · 평균+3σ **855.19ms** 는 6 회차 값이 무변경으로 유지된다. **900ms
  재확정 필요 여부: 불요** — 본 회차가 새 표본을 보태지 못해 판정 근거가 6 회차와 동일하고,
  `§3` 표 임계 숫자도 무변경이다.
- **환경 메타(로그로 회수됨)**: `if: always()` 덕에 seed 실패에도 메타 7 항목이 전부 회수됐다 —
  커널 `Linux 6.17.0-1022-azure`, 아키텍처 `x86_64`, vCPU **4**, 메모리 **15Gi**, DB image
  `postgres:16-alpine`, 부하 대상 image `assessment-agent:load`, 표본 인원
  `K6_S1_PERSONS=133`. **7 항목이 3~6 회차와 전부 동일**하므로 조건은 일치하며, `s1_persons`
  input 주입도 **다섯 번째로 성공**(default `10` 낙하 없음)이다.
- **의미 / 한계**: 본 회차의 소득은 성능 수치가 아니라 **배선의 런타임 반증**이다 — "helper
  chain · entrypoint · workflow step · k6 소비 경로 4 축이 닫혔다" 는 배선 완료가 **실행
  성공을 뜻하지 않는다**는 것을 첫 실 run 이 즉시 보였다(T-1647 이 게이트 활성 축에서 결함 0
  을 확인한 것과 대비되는 결과). 미검증 축은 3~6 회차 그대로 남고(① LLM stub, ② 수집 왕복 0,
  ③ 단일 iteration) 여기에 ④ **seed 실행 자체가 아직 성공 0 회** 가 더해진다. 그래서 PLAN
  `140 행` checkbox 는 `[ ]` 유지다.

#### 8 회차 (T-1665, run 32665014391, 실 dataset seed 첫 **성공** run — T-1664 fix 후)

- **측정 일시 / run**: 2026-08-23T20:38:13Z dispatch(`workflow_dispatch`, ref `main`, head sha
  `3319ac41`), run id **32665014391**, job 20:38:16Z~20:40:44Z(약 2분 28초). **conclusion
  `success`** — 시나리오 step 16 개가 전부 success 이고 skipped 는 0 이다(7 회차의 skipped 5
  와 대비). dispatch 는 `-f s1_persons=133` 으로 **정확히 1 회**만 했고 재시도·재 dispatch 는
  0 이다(Out of Scope 준수).
- **seed step 결과(본 회차 1 순위 관측 대상)** — `133 로그인 실 dataset seed 적재`
  step(20:39:52Z~20:39:55Z, 약 3 초) **success**. 로그 원문(자격증명 제외):
  `devset seed 완료 — person 133 건 / serviceIdentity 133 건 적재`. **적재 인원 수 133 명 ·
  `ServiceIdentity` 133 건**이 처음으로 로그에서 직접 회수됐다(7 회차는 CLI 가 성공 요약만
  마지막에 찍는 구조라 이 수치가 회수 실패였다). 7 회차를 죽인 ``Argument `person` is
  missing.`` 은 재현되지 않았다 — T-1664(PR #1330 → main `61f616a1`)가
  `resolveRealDataPersonId` 로 `create.personId` 를 배선한 fix 가 실 run 에서 확인된 것이다.
- **`setup()` 소비 경로(T-1661) 검증**: **적재분 조회 경로로 확인 — 합성 생성 흔적 0**.
  `http_reqs` 가 **7**(6.754967/s) 뿐이고(3~6 회차는 272) 그 7 회는 setup 의
  `POST /api/users` · `POST /api/auth/login` · `GET /api/llm/providers` ·
  `POST /api/llm/providers` · `GET /api/persons` 5 왕복 + iteration 의 batch `POST` 1 +
  teardown 의 provider `DELETE` 1 로 정확히 맞아떨어진다. 즉 **`POST /api/persons` 합성 생성
  왕복이 사라졌다** — T-1661 배선이 의도대로 조회 경로로 돈다는 뜻이고 배선 결함은 발견되지
  않았다. 다만 **표본 인원 수 자체를 찍는 로그는 스크립트에 없다**([`s1-batch.js`](../../test/load/s1-batch.js)
  `setup()` 은 `console.log` 0). `133` 이라는 값은 **간접 증거 3 종**으로만 뒷받침된다 — (a)
  seed step 이 133 건 적재를 로그로 확정, (b) [`person.service.ts`](../../src/user/person.service.ts)
  의 `findMany` 가 페이지네이션 없이 전량을 돌려주므로 `@load.devset.test` 필터 뒤
  `slice(0, 133)` 이 133 을 그대로 취함, (c) batch p95 **757.65ms** 가 표본 133 인 3~6 회차
  대역(711~792ms) 안이라 표본이 0~소수였다면 나올 수 없는 크기다. 표본 수를 로그로 **직접**
  확정하려면 스크립트 변경이 필요해 본 slice Out of Scope 다(Follow-ups).
- **k6 THRESHOLDS(로그 원문 인용)**: `http_req_duration{route:batch}` 임계가 요구대로
  **2 개** 등장하고 둘 다 통과했다 — `✓ 'p(95)<3600000' p(95)=757.65ms` ·
  `✓ 'p(95)<900' p(95)=757.65ms`. `http_req_failed` 은 `✓ 'rate<0.01' rate=0.00%`
  (`0 out of 7`). `iteration_duration` 은 avg=min=med=max=p(95) **758.79ms**(단일 iteration).
  900ms 게이트까지 여유는 **142.35ms(약 15.82%)** 로 6 회차(107.73ms · 11.97%)보다 넓다.
- **기술통계(실 scale 표본 5 개)**: 3~6 회차 760.91 · 730.81 · 711.23 · 792.27 에 본 회차
  **757.65** 를 더해 표본이 **5 개**가 됐다 — 평균 **750.57ms** · 범위 **81.04ms**
  (711.23~792.27) · 표본표준편차 **30.96ms** · 변동계수 **4.12%** · 평균+3σ **843.45ms**.
  **900ms 재확정 필요 여부: 불요** — 평균+3σ 가 843.45ms 로 임계 안이고(여유 56.55ms), 표본이
  4 → 5 로 늘며 표준편차가 35.46 → 30.96ms 로 오히려 줄어 산포가 좁아졌다. `§3` 표의 임계
  숫자는 무변경이다.
- **환경 메타(로그로 회수됨)**: 커널 `Linux 6.17.0-1022-azure`, 아키텍처 `x86_64`, vCPU **4**,
  메모리 **15Gi**, DB image `postgres:16-alpine`, 부하 대상 image `assessment-agent:load`,
  표본 인원 `K6_S1_PERSONS=133`. **7 항목이 3~7 회차와 전부 동일**하므로 조건은 일치하며,
  `s1_persons` input 주입도 **여섯 번째로 성공**(default `10` 낙하 없음)이다.
  `--summary-export` 산출물도 정상이라 "S1 summary JSON 전문" 이 step summary 에 실렸다.
- **의미 / 한계**: 본 회차로 `§5` item 5 잔여 ① 안의 **"seed 실행 성공 0 회" 축이 해소**됐다 —
  실 devset 133 로그인이 `Person` + `ServiceIdentity` 로 실제 적재되고, k6 가 그 적재분을 조회해
  소비하는 경로까지 한 run 안에서 성립했다(배선 4 축이 **실행으로도** 닫힌 첫 run). 그러나
  ① 자체는 **미해소 유지**다: `ServiceIdentity` 가 붙었어도 job 에 GitHub/Confluence 자격증명이
  없고 iteration 이 758.79ms 만에 끝난 데서 보듯 **50~100 repo · ~1000 page 실 수집 왕복은
  여전히 0** 이며, ① LLM 은 `LOAD_TEST_STUB=1` stub(ADR-0057 `D1`), ③ 단일 iteration 이라 p95
  가 곧 단일 표본값이라는 조건도 3~7 회차 그대로다. 그래서 PLAN `140 행` checkbox 는 `[ ]`
  유지다.

#### 9 회차 (T-1667, run 32677333740, 표본 수를 로그로 **직접 회수**한 첫 run — T-1666 배선 후)

- **측정 일시 / run**: 2026-08-24T00:39:02Z dispatch(`workflow_dispatch`, ref `main`, head sha
  `7063584f`), run id **32677333740**, job 00:39:06Z~00:41:44Z(약 2분 38초). **conclusion
  `success`** — step 21 개가 전부 success 이고 skipped 는 0 이다(8 회차와 동일). dispatch 는
  `-f s1_persons=133` 으로 **정확히 1 회**만 했고 재시도·재 dispatch 는 0 이다(Out of Scope 준수).
- **표본 로그 원문(본 회차 1 순위 관측 대상)** — S1 step 00:40:53Z 의 k6 console 줄을 그대로
  인용한다: `time="2026-08-24T00:40:53Z" level=info msg="[s1-batch] devset 표본 취득 133명 /
  요청 133명" source=console`. **취한 표본 수 133 명 · 요청 표본 수 133 명**으로 둘이 같아
  표본 부족(seed 미적재 · 도메인 불일치)은 0 이다. 8 회차가 **간접 증거 3 종**((a) seed step 의
  133 건 적재 로그, (b) 페이지네이션 없는 `findMany`, (c) 표본 133 대역의 batch p95)으로만
  추론했던 `133` 과 **일치한다 — 판정: 일치**. 8 회차 소절의 그 문단은 이력으로 남겨두되, 해당
  추론은 본 회차의 **직접 회수로 대체됐다**. 로그 줄에 자격증명 · cookie · email 원문은 없어
  T-1666 이 명시한 계약(고정 prefix + 수치 2 개 · 민감값 0)이 실 run 에서 그대로 지켜졌다.
- **seed step 결과(T-1664 fix 재현성 2 회차)**: `133 로그인 실 dataset seed 적재`
  step(00:40:48Z~00:40:51Z, 약 3 초) **success**. 로그 원문(자격증명 제외):
  `devset seed 완료 — person 133 건 / serviceIdentity 133 건 적재`. 건수 · 문구가 8 회차와
  **완전히 동일**하므로 T-1664(PR #1330 → main `61f616a1`) fix 는 **연속 2 회 성공**이고,
  7 회차를 죽인 ``Argument `person` is missing.`` 은 재현되지 않았다.
- **k6 THRESHOLDS(로그 원문 인용)**: `http_req_duration{route:batch}` 임계가 요구대로 **2 개**
  등장하고 둘 다 통과했다 — `✓ 'p(95)<3600000' p(95)=824.71ms` ·
  `✓ 'p(95)<900' p(95)=824.71ms`. `http_req_failed` 은 `✓ 'rate<0.01' rate=0.00%`
  (`0 out of 7`). `http_reqs` 는 **7**(6.551655/s) 로 8 회차의 **7 과 같아** 합성
  `POST /api/persons` 왕복 0 유지가 재확인됐다. `iteration_duration` 은
  avg=min=med=max=p(95) **825.88ms**(단일 iteration). 900ms 게이트까지 여유는
  **75.29ms(약 8.37%)** 로 8 회차(142.35ms · 15.82%)보다 좁다.
- **기술통계(실 scale 표본 6 개)**: 3~8 회차 760.91 · 730.81 · 711.23 · 792.27 · 757.65 에 본
  회차 **824.71** 을 더해 표본이 **6 개**가 됐다 — 평균 **762.93ms** · 범위 **113.48ms**
  (711.23~824.71) · 표본표준편차 **41.02ms** · 변동계수 **5.38%** · 평균+3σ **886.00ms**.
  **900ms 재확정 필요 여부: 불요** — 평균+3σ 가 886.00ms 로 임계 안이다. 다만 본 회차 값이
  6 표본 중 최댓값이라 표준편차가 30.96 → 41.02ms 로 커졌고 평균+3σ 여유는 56.55 →
  **14.01ms** 로 크게 좁아졌다. 다음 회차가 830ms 대를 한 번 더 찍으면 평균+3σ 가 900ms 를
  넘을 수 있으므로 **재확정 판단은 다음 표본에서 다시 본다**. 본 회차에서 `§3` 표의 임계 숫자는
  무변경이다.
- **환경 메타(로그로 회수됨)**: 커널 `Linux 6.17.0-1022-azure`, 아키텍처 `x86_64`, vCPU **4**,
  메모리 **15Gi**, DB image `postgres:16-alpine`, 부하 대상 image `assessment-agent:load`,
  표본 인원 `K6_S1_PERSONS=133`. **7 항목이 3~8 회차와 전부 동일**하므로 조건은 일치하며,
  `s1_persons` input 주입도 **일곱 번째로 성공**(default `10` 낙하 없음)이다.
  `--summary-export` 산출물도 정상이라 "S1 summary JSON 전문" 이 step summary 에 실렸다.
- **의미 / 한계**: 본 회차로 표본 수 축의 **간접 추론이 직접 회수로 대체**됐다 — k6 가 실제로
  devset 133 명을 표본으로 취했음이 run log 에서 확정됐고, seed 적재도 같은 건수로 2 회 연속
  성공해 재현성이 붙었다. 그러나 `§5` item 5 의 **잔여 ① 은 미해소 유지**다: 확정된 것은
  표본 수와 seed 재현성이지 **수집 왕복이 아니며**, job 에 GitHub/Confluence 자격증명이 없고
  iteration 이 825.88ms 만에 끝난 데서 보듯 **50~100 repo · ~1000 page 실 수집 왕복은 여전히
  0** 이다. ① LLM 은 `LOAD_TEST_STUB=1` stub(ADR-0057 `D1`), ③ 단일 iteration 이라 p95 가 곧
  단일 표본값이라는 조건도 3~8 회차 그대로다. 그래서 PLAN `140 행` checkbox 는 `[ ]` 유지다.

#### 10 회차 (T-1669, run 32690756666, T-1668 재확정 규칙의 **첫 기계 적용** run)

- **측정 일시 / run**: 2026-08-24T04:38:21Z dispatch(`workflow_dispatch`, ref `main`, head sha
  `cd411817`), run id **32690756666**, job 04:38:25Z~04:40:47Z(약 2분 22초). **conclusion
  `success`** — step 21 개가 전부 success 이고 skipped 는 0 이다(8~9 회차와 동일). dispatch 는
  `-f s1_persons=133` 으로 **정확히 1 회**만 했고 재시도·재 dispatch 는 0 이다(Out of Scope 준수).
- **표본 로그 원문**: S1 step 04:39:58Z 의 k6 console 줄을 그대로 인용한다 —
  `time="2026-08-24T04:39:58Z" level=info msg="[s1-batch] devset 표본 취득 133명 / 요청 133명"
  source=console`. **취한 표본 133 명 · 요청 표본 133 명**으로 `N == M == 133` 이라 표본
  부족(seed 미적재 · 도메인 불일치)은 0 이며 **판정: 일치**다. T-1666 배선의 로그 회수는
  9 회차에 이어 **연속 2 회 성공**이다. 줄에 자격증명 · cookie · email 원문은 없어 계약(고정
  prefix + 수치 2 개 · 민감값 0)이 실 run 에서 그대로 지켜졌다.
- **seed step 결과(T-1664 fix 재현성 3 회차)**: `133 로그인 실 dataset seed 적재`
  step(04:39:54Z~04:39:57Z, 약 3 초) **success**. 로그 원문(자격증명 제외):
  `devset seed 완료 — person 133 건 / serviceIdentity 133 건 적재`. 건수 · 문구가 8~9 회차와
  **완전히 동일**하므로 T-1664(PR #1330 → main `61f616a1`) fix 는 **연속 3 회 성공**이고,
  7 회차를 죽인 ``Argument `person` is missing.`` 은 재현되지 않았다.
- **k6 THRESHOLDS(로그 원문 인용)**: `http_req_duration{route:batch}` 임계가 요구대로 **2 개**
  등장하고 둘 다 `✓` 다 — `✓ 'p(95)<3600000' p(95)=743.96ms` ·
  `✓ 'p(95)<900' p(95)=743.96ms`.
- **수치**: batch p95 **743.96ms**. `http_req_failed` 은 `✓ 'rate<0.01' rate=0.00%`
  (`0 out of 7`). `http_reqs` 는 **7**(7.077175/s) 로 8~9 회차의 **7 과 같아** 합성
  `POST /api/persons` 왕복 0 유지가 재확인됐다. `iteration_duration` 은
  avg=min=med=max=p(95) **745.12ms**(단일 iteration). 900ms 게이트까지 여유는
  **156.04ms(약 17.34%)** 로 9 회차(75.29ms · 8.37%)보다 다시 넓어졌다.
- **T-1668 재확정 규칙 기계 적용(첫 적용)** — 규칙 ②·③ 을 그대로 대입하고 새 산정식은
  발명하지 않았다.
  - 실 scale(표본 133) 회차 **전량 7 개**의 batch p95: 3 회차 **760.91** · 4 회차 **730.81** ·
    5 회차 **711.23** · 6 회차 **792.27** · 8 회차 **757.65** · 9 회차 **824.71** · 10 회차
    **743.96**(ms). 7 회차는 seed step fail 로 k6 미실행이라 수치가 없고, 표본 10 회차인
    1 · 2 회차는 규칙 ③ 대로 **혼합하지 않았다**. **outlier 제거 0** — 최댓값 824.71 도 그대로
    포함해 계산했다.
  - 평균 **760.22ms** · 범위 **113.48ms**(711.23~824.71) · 표본표준편차 **38.13ms** ·
    변동계수 **5.02%** · **평균 + 3σ = 874.60ms** · 100ms 단위 **올림 전 874.60ms → 올림 후
    900ms**(현 임계와 동일).
  - **트리거 판정: ①-(a) 미충족 · ①-(b) 미충족 → 임계 무변경** — (a) 실 run 의 `p(95)<900` 이
    `✓`(`✗` 아님), (b) 평균+3σ **874.60ms < 900ms**. 따라서 `§3` 표의 `900ms` ·
    [`s1-batch.js`](../../test/load/s1-batch.js) 의 `STUB_BASELINE_P95_MS` ·
    smoke spec 의 `S1_STUB_BASELINE_P95_MS` 는 **무변경**이고, 규칙 ④ 의 2 task split 도
    불요다. 갱신되는 것은 여유뿐 — 평균+3σ 여유가 9 회차 **14.01ms → 25.40ms** 로 넓어졌다
    (본 회차 743.96 이 평균 아래라 표본표준편차가 41.02 → 38.13ms 로 줄었다). 올림 후 값이
    900ms 로 현 임계와 같아 **하향 여지도 애초에 없으며**, 넓어진 여유를 이유로 낮추지도
    않는다(규칙 ③).
- **환경 메타(로그로 회수됨)**: 커널 `Linux 6.17.0-1022-azure`, 아키텍처 `x86_64`, vCPU **4**,
  메모리 **15Gi**, DB image `postgres:16-alpine`, 부하 대상 image `assessment-agent:load`,
  표본 인원 `K6_S1_PERSONS=133`. **7 항목이 3~9 회차와 전부 동일**하므로 조건은 일치하며,
  `s1_persons` input 주입도 **여덟 번째로 성공**(default `10` 낙하 없음)이다.
- **의미 / 한계**: 규칙을 표본보다 **먼저** 굳혀 둔 효과가 첫 적용에서 확인됐다 — 수치를
  대입하자 "임계 무변경" 결론이 하나로 나왔고 사후 정당화(over-fitting) 여지가 없었다. 9 회차
  824.71 은 추세가 아니라 산포 안의 상단 값이었다는 것도 본 회차로 드러났다(σ 감소). 다만
  `§5` item 5 의 **잔여 ① 은 미해소 유지**다: job 에 GitHub/Confluence 자격증명이 없고
  iteration 이 745.12ms 만에 끝난 데서 보듯 **50~100 repo · ~1000 page 실 수집 왕복은 여전히
  0** 이며, ① LLM 은 `LOAD_TEST_STUB=1` stub(ADR-0057 `D1`), ③ 단일 iteration 이라 p95 가 곧
  단일 표본값이라는 조건도 3~9 회차 그대로다. 그래서 PLAN `140 행` checkbox 는 `[ ]` 유지다.

#### 11 회차 (T-1675, run 32746598803, 관찰용 게이트 `p(95)<900` 이 실 run 에서 처음 `✗`)

- **측정 일시 / run**: 2026-08-24T15:43:34Z dispatch(`workflow_dispatch`, ref `main`, head sha
  `7788552a`), run id **32746598803**, job 15:43:40Z~15:45:22Z(약 1분 42초). **conclusion
  `failure`** — step **21 개 중 success 17 · failure 1 · skipped 3** 이고, S1 step 12
  `k6 S1 평가 배치 부하 시나리오 실행` 은 15:45:18Z~15:45:19Z(약 1 초) 구간에서 k6 **exit code
  99** 로 fail 했다. **본 run 은 T-1674 가 이미 소진한 것이며, 본 slice 는 `gh run view
  32746598803 --log` 로 같은 로그를 재독했을 뿐 새 dispatch · rerun · 재시도가 전부 0 이다.**
- **표본 로그 원문**: S1 step 15:45:18Z 의 k6 console 줄을 그대로 인용한다 —
  `time="2026-08-24T15:45:18Z" level=info msg="[s1-batch] devset 표본 취득 133명 / 요청 133명"
  source=console`. **취한 표본 133 명 · 요청 표본 133 명**으로 `N == M == 133` 이라 표본
  부족(seed 미적재 · 도메인 불일치)은 0 이며 **판정: 일치**다. T-1666 배선의 로그 회수는
  9 · 10 회차에 이어 **연속 3 회 성공**이다. 줄에 자격증명 · cookie · email 원문은 없다.
- **seed step 결과(T-1664 fix 재현성 4 회차 — 압축)**: `133 로그인 실 dataset seed 적재`
  step(15:45:14Z~15:45:17Z, 약 3 초) **success**, 로그 원문은 `devset seed 완료 — person 133 건 /
  serviceIdentity 133 건 적재` 로 8~10 회차와 건수 · 문구가 동일해 T-1664 fix 는 **연속 4 회
  성공**이다. 같은 job 의 사실이라 상세는 아래 `#### S2 1 회차` 소절의 seed 항목을 pointer 로
  대신한다(중복 전재 0).
- **k6 THRESHOLDS(로그 원문 인용)**: `http_req_duration{route:batch}` 임계는 요구대로 **2 개**
  등장하지만 본 회차에 처음으로 **판정이 갈렸다** — `✓ 'p(95)<3600000' p(95)=967.52ms` ·
  `✗ 'p(95)<900' p(95)=967.52ms`. `http_req_failed` 은 `✓ 'rate<0.01' rate=0.00%` 로 통과다.
  k6 는 `thresholds on metrics 'http_req_duration{route:batch}' have been crossed` 를 error 로
  남기고 exit **99** 로 끝났다.
- **수치**: batch p95 **967.52ms**. `http_req_failed` 은 **0.00%**(`0 out of 7`) 이고
  `http_reqs` 는 **7**(5.648565/s) 로 8~10 회차의 **7 과 같다** — 요청 구성은 그대로인데 소요만
  늘었다는 뜻이라 합성 `POST /api/persons` 왕복 0 유지도 재확인된다. `iteration_duration` 은
  avg=min=med=max=p(95) **969.32ms**(단일 iteration)로 batch p95 와 **1.80ms** 차이라 **정합**
  이다(iteration 이 곧 batch 왕복 1 회 + 잔여 overhead). 900ms 게이트 대비 여유는
  **-67.52ms(약 -7.50%)** 로, 10 회차(+156.04ms · +17.34%)에서 처음 음수로 돌아섰다.
- **T-1668 재확정 규칙 기계 적용(2 회차 적용 · ①-(a) 첫 트리거)** — 규칙 ② · ③ 을 그대로
  대입했고 새 산정식은 발명하지 않았다.
  - **트리거 판정: ①-(a) 충족(첫 사례) · ①-(b) 도 충족 → 재확정 착수 조건 성립.** (a) 는 실
    run 의 `p(95)<900` 이 `✗` 로 나온 것 자체이며, 규칙이 "즉시" 로 규정한 트리거가 사전 박제
    후 처음 발화했다. (a) 만으로 이미 착수 조건이 서지만 (b) 도 함께 계산했고, 아래 평균+3σ 가
    **1030.18ms > 900ms** 라 (b) 역시 충족이다.
  - 실 scale(표본 133) 회차 **전량 8 개**의 batch p95: 3 회차 **760.91** · 4 회차 **730.81** ·
    5 회차 **711.23** · 6 회차 **792.27** · 8 회차 **757.65** · 9 회차 **824.71** · 10 회차
    **743.96** · 11 회차 **967.52**(ms). 7 회차는 seed step fail 로 k6 미실행이라 수치가 없고,
    표본 10 회차인 1 · 2 회차는 규칙 ③ 대로 **혼합하지 않았다**. **outlier 제거 0** — 임계를
    넘긴 최댓값 **967.52 도 그대로 포함**해 계산했다(규칙 ③ 이 명시 금지).
  - **산정 결과 4 종**: 표본 목록은 바로 위 8 개, 평균 **786.13ms**, 표본표준편차 **81.35ms**,
    **평균 + 3σ = 1030.18ms**, 100ms 단위 **올림 전 1030.18ms → 올림 후 1100ms**. 부가로 범위는
    **256.29ms**(711.23~967.52) · 변동계수 **10.35%** 로, 10 회차(38.13ms · 5.02%) 대비 산포가
    두 배 이상 커졌다.
  - **본 task 에서는 숫자를 바꾸지 않는다** — 산정 결과 **1100ms** 가 현 임계 **900ms** 와
    다르지만 `§3` 표 · 각주 · [`s1-batch.js`](../../test/load/s1-batch.js) 의
    `STUB_BASELINE_P95_MS` · smoke spec 의 `S1_STUB_BASELINE_P95_MS` 는 본 회차에서 **전부
    무변경**이다. 실제 갱신은 규칙 ④ 가 못 박은 **2 task split** — **(i) 코드 `pr`** 로
    `s1-batch.js` 상수와 drift-guard spec 의 `S1_STUB_BASELINE_P95_MS` · mutation 대조군을 같은
    commit 에서 동기하고, **(ii) doc `direct`** 로 `§3` 표 · 각주 · 위 규칙 소절 · `§5` item 5 의
    수치를 갱신한다 — 로 이월한다(한 task 로 합치면 `commitMode` 가 갈린다 —
    [CLAUDE.md](../../CLAUDE.md) `§3.1` rule 3). **하향 검토는 하지 않았다**(규칙 ③).
- **환경 메타(로그로 회수됨)**: 커널 `Linux 6.17.0-1022-azure`, 아키텍처 `x86_64`, vCPU **4**,
  메모리 **15Gi**, DB image `postgres:16-alpine`, 부하 대상 image `assessment-agent:load`,
  표본 인원 `K6_S1_PERSONS=133`. **7 항목이 3~10 회차와 전부 동일**하므로 조건은 일치하며,
  `s1_persons` input 주입도 **아홉 번째로 성공**(default `10` 낙하 없음)이다.
- **의미 / 한계**: (a) 게이트가 `✗` 인 것은 **REQ-047 판정 실패가 아니다** — 같은 metric 의
  `p(95)<3600000` 은 `✓` 였고 REQ-047 pass/fail 임계는 1h 예산(`FULL_RUN_BUDGET_MS`) 그대로다
  (T-1668 규칙의 "성격 구분 불변" 승계). 깨진 것은 stub 조건의 **회귀 관찰용 게이트**뿐이다.
  (b) 표본 1 개가 튄 것인지 조건이 바뀐 것인지는 본 회차만으로 **단정할 수 없다** — 환경 메타
  7 항목 · 표본 **133** · `http_reqs` **7** 이 8~10 회차와 전부 같아 조건이 바뀌었다는 증거는
  0 이지만, 같은 조건에서도 산포 상단이 나올 수 있기 때문이다. 그렇다고 **outlier 로 취급해
  빼지 않는다**(규칙 ③) — 위 산정에는 967.52 가 그대로 들어갔고, 튄 값인지는 다음 표본이
  가른다. (c) LLM stub(ADR-0057 `D1`) · **50~100 repo · ~1000 page 실 수집 왕복 0** · 단일
  iteration 조건은 3~10 회차 그대로라, PLAN `140 행` checkbox 는 `[ ]` 유지다.

#### S2 1 회차 (T-1674, run 32746598803, S2 축 첫 dispatch — S1 leg 게이트 crossed 로 S2 step **skipped**)

- **측정 일시 / run**: 2026-08-24T15:43:34Z dispatch(`workflow_dispatch`, ref `main`, head sha
  `7788552a`), run id **32746598803**, job 15:43:40Z~15:45:22Z(약 1분 42초). **conclusion
  `failure`** — step **21 개 중 success 17 · failure 1 · skipped 3** 이다. fail 한 것은 step 12
  `k6 S1 평가 배치 부하 시나리오 실행`(15:45:18Z~15:45:19Z, k6 exit code **99**)이고, 그 여파로
  step 14 **`k6 S2 조회 부하 시나리오 실행` 자체가 `skipped`** 됐다 —
  [`load-k6.yml`](../../.github/workflows/load-k6.yml) `195 행` 의 S2 step 에는 `if: always()` 가
  없어 앞 step 의 실패가 곧 skip 이다(`always()` 는 `153 행` S1 요약 step 과 `211 행` 정리
  step 에만 있다). dispatch 는 `-f s1_persons=133` 으로 **정확히 1 회**만 했고 재 dispatch ·
  재시도는 **0** 이다(7 회차 선례 — fail 이어도 다시 쏘지 않고 원인만 박제).
- **S2 표본 로그 원문**: **미확보**. `[s2-read] devset 표본 취득 N명 / 필터 통과 M건 / 상한 30명`
  줄은 run log 전체에서 **0 회** 등장한다 — S2 step 이 실행되지 않았기 때문이지 T-1672 가
  [`s2-read.js`](../../test/load/s2-read.js) `89~97 행` 에 심은 로그 배선의 결함 때문이 아니다.
  따라서 `N` · `M` · 상한 `30` 의 관계 판정과 설계 ③(상한 의미 재정의)의 실 run 실증은 **본
  회차로는 불가**하고 다음 dispatch 로 이월된다. 다만 같은 job 의 S1 leg 가 같은 devset 을 조회해
  `time="2026-08-24T15:45:18Z" level=info msg="[s1-batch] devset 표본 취득 133명 / 요청 133명"
  source=console` 을 남겼으므로, **DB 에 devset 133 명이 조회 가능한 상태로 있었다**는 사실까지는
  확인된다(S2 가 돌았다면 `M` 이 133 이었을 개연성의 간접 근거일 뿐, 실측을 대체하지 않는다).
- **seed step 결과(T-1664 fix 재현성 4 회차)**: `133 로그인 실 dataset seed 적재`
  step(15:45:14Z~15:45:17Z, 약 3 초) **success**. 로그 원문(자격증명 제외):
  `devset seed 완료 — person 133 건 / serviceIdentity 133 건 적재`. 건수 · 문구가 8~10 회차와
  **완전히 동일**하므로 T-1664(PR #1330 → main `61f616a1`) fix 는 **연속 4 회 성공**이고,
  7 회차를 죽인 ``Argument `person` is missing.`` 은 재현되지 않았다. 즉 본 회차의 실패는 seed
  축이 아니라 **S1 임계 축**에서 났다.
- **k6 THRESHOLDS 원문**: S2 임계는 로그에 **0 종** 등장한다(요구된 6 종 중 하나도 없다) — step
  이 skip 이라 k6 가 기동조차 하지 않았다. 6 종(전역 `http_req_duration p(95)<3000` ·
  `http_req_failed rate<0.01` · route 별 `persons` · `groups` · `parts` · `me` 각 `p(95)<3000`)이
  [`s2-read.js`](../../test/load/s2-read.js) `62~72 행` 에 그대로 있다는 것은 코드로 확인되나,
  각각의 `✓` / `✗` 판정은 실 run 이 없어 **전부 미확보**다. 개수가 6 이 아니라 0 인 이유가
  스크립트 결함이 아니라 step skip 이라는 사실을 그대로 적는다.
- **수치**: route 별 p95(`persons` · `groups` · `parts` · `me`) · 전역 p50 / p95 / p99 ·
  `http_req_failed` · `http_reqs` · `iteration_duration` 이 **전부 미확보**다. 추정 · 재계산 ·
  다른 회차 값 전용으로 칸을 채우지 않는다(추정치 0 규약).
- **공유 dataset 보존 계약의 실 run 검증**: 뒤따르는 `k6 S3 동시 요청 내성 시나리오 실행`
  step(step 15) 도 같은 이유로 **`skipped`** 라, 설계 ②(teardown 의 person DELETE 제거)가 후속
  step 을 빈 DB 위에 놓지 않는지는 **검증되지 않았다**. 다만 S2 teardown 이 아예 돌지 않아
  dataset 을 **깎을 기회도 없었으므로**, 보존 계약이 깨진 **증거도 0** 이다 — 무증거이지 반증이
  아니며, 이 검증도 다음 dispatch 로 이월된다.
- **환경 메타(로그로 회수됨)**: 커널 `Linux 6.17.0-1022-azure`, 아키텍처 `x86_64`, vCPU **4**,
  메모리 **15Gi**, DB image `postgres:16-alpine`, 부하 대상 image `assessment-agent:load`,
  표본 인원 `K6_S1_PERSONS=133`. **7 항목이 3~10 회차와 전부 동일**하므로 같은 job · 같은
  인스턴스 · 같은 DB 조건이 유지됐고, `s1_persons` input 주입도 **아홉 번째로 성공**(default
  `10` 낙하 없음)이다.
- **`§3` 표 S2 축 무변경 판정**: 회수된 표본이 **0 개**라 재확정 근거 자체가 없다. p95 `< 3s` ·
  p50 / throughput `baseline 후 fix` · error rate `< 1%` 는 한 글자도 고치지 않았다. 설령 본
  회차가 성공했더라도 **표본 1 회로는 재확정 근거가 되지 않는다** — S1 축이 T-1668 의 규칙 사전
  박제 → T-1669 의 기계 적용이라는 2 단계를 거친 선례를 S2 도 그대로 따를 일이다.
- **의미 / 한계**: (a) 본 회차가 실증하려던 설계 ③ (b) 전제 — 부하를 만드는 것은
  `GET /api/persons` 응답 **행 수(devset 전량)** 이고 표본 상한 `30` 은 `setup()` 이 메모리에
  남기는 id 배열 길이일 뿐이라는 것 — 는 **여전히 미실증**이라, 상한 상향(30 → 133) 판단의
  근거도 아직 없다(설계 ③ 의 "첫 실측 이후 별도 판단" 조건 미충족). (b) LLM stub(ADR-0057 `D1`)
  · 실 수집 왕복 **0** 조건은 S2 축에도 그대로 걸리므로, 다음 dispatch 가 성공해도 얻는 것은
  *stub 조건의* 조회 지연이다. (c) **본 회차의 최대 소득은 S1 축 쪽에 있다** — S1 leg 의
  `p(95)<900` 이 실 run 에서 처음 `✗`(p95 **967.52ms**)로 crossed 돼, 10 회차가 적용한 T-1668
  재확정 규칙 **①-(a) 트리거가 처음 충족**됐다. 다만 S1 leg 수치 회수 · 11 회차 소절 · 규칙
  재적용은 본 slice 의 **Out of Scope** 라 여기서는 run id **32746598803** 만 남긴다(재 dispatch
  **0** 으로 같은 로그에서 회수 가능). **S1 leg 수치 회수 · 11 회차 소절 · 규칙 적용은 T-1675 가
  재 dispatch 0 으로 완료했다**(위 `#### 11 회차`). (d) 두 축은 엮여 있다 — **S1 step 이 fail
  하는 한 S2 step 은 계속 skip** 되므로, 다음 S2 dispatch 는 S1 게이트 처리(재확정 또는 fix)
  뒤여야 의미가 있다.
  **【(d) 무효 — 위 문장은 T-1674 시점(2026-08-24)의 워크플로 사실에 근거한 이력이며 현행 dispatch
  판단 근거로 쓰지 않는다】** T-1678(PR **#1335** → main **`8af5b06d`**)이
  [`load-k6.yml`](../../.github/workflows/load-k6.yml) `200 행` S2 step · `213 행` S3 step 에
  `if: ${{ !cancelled() }}` 를 얹어, 이제는 **S1 leg 가 red 여도 S2 · S3 leg 가 실행된다**(job 이
  취소된 경우에만 skip — `always()` 를 쓰지 않아 "취소 시 부하 발생기 미실행" 불변식과 "정리
  step 만 `always()`" 관행을 보존). 따라서 다음 S2 dispatch 는 **S1 게이트 처리를 기다릴 필요가
  없다**. 원 문장은 소급 치환 금지 관행(`§ 12.76` AC 3)에 따라 삭제하지 않고 이력으로 남긴다.

---

## 4. 접근 방식·도구 후보

부하 측정 접근을 **기존 dependency 로 가능한 범위**와 **신규 도구 필요 범위**로 구분한다.

### 4.1 기존 dependency 로 가능한 범위

- **supertest 기반 반복 호출 measure** — `supertest`(package.json 기존 devDependency)로
  조회 endpoint 를 반복 호출하고 wall-clock latency 를 수집하는 경량 측정. S2 의
  단일-클라이언트 latency 스모크 수준(부하 발생기 아님)에 적합.
- 한계: 진짜 동시성 부하(S3)·고 RPS 발생은 supertest 만으로 부족(단일 프로세스 순차
  호출 성격). concurrent 시나리오는 아래 신규 도구가 필요.

### 4.2 신규 도구 필요 범위 (도구 결정은 본 문서 범위 밖)

- **k6 / artillery / autocannon 등** 전용 부하 발생기 — S1 대규모 배치·S3 동시성 내성의
  고동시성·고 RPS 부하를 발생시키려면 전용 harness 가 필요.
- **BLOCKED 규율**: 위 도구는 모두 **신규 외부 dependency** 다.
  [CLAUDE.md §5](../../CLAUDE.md) 상 새 dependency 추가는 **BLOCKED**(사람 승인 → ADR
  작성 후 도입)이다. 따라서 **도구 선택·도입 결정 자체는 본 계획 문서 범위 밖**이며, §5
  의 follow-up 으로 넘긴다.
- **LLM/외부 수집 의존 격리**: S1 은 실 LLM·GitHub/Confluence I/O 대기가 지배적일 수
  있어, 순수 서버 처리량 측정 시 stub / record-replay / 격리 endpoint 가 필요하다. **LLM 축은
  결정 완료 + 구현 완료** — [ADR-0057](../decisions/ADR-0057-s1-batch-load-io-isolation.md)
  `D1` 이 env 기반 stub gateway 주입(`LOAD_TEST_STUB` 가 정확히 `1` 일 때만, fail-safe
  default OFF)으로 결정했고 helper·stub class·module binding 이 모두 배선됐다(T-1627 ~ T-1629).
  **수집(GitHub/Confluence) 축은 아직 stub 미배선** 이다 — 현 S1 표본 person 은
  `ServiceIdentity` 가 없어 외부 수집 왕복이 0 이라 현 측정에는 영향이 없고, 실 scale 표본으로
  확대할 때 같은 adapter 경계에 같은 방식의 배선이 필요하다.

---

## 5. Follow-up 인덱스

본 문서는 계획만 담는다. 실제 실행은 아래를 후속 task 후보로 나열한다(순서는 의존성 기준).

1. **부하 도구 선택 ADR** (pr-mode + 신규 dependency, 사람 승인) — k6 / artillery /
   autocannon 중 택1, trade-off·격리 endpoint 전략 박제. [CLAUDE.md §5](../../CLAUDE.md)
   BLOCKED 해소 전제. → [ADR-0054](../decisions/ADR-0054-load-resilience-harness-tool.md) (**ACCEPTED** — frontmatter date 2026-07-08, 2026-07-30 owner 가 k6 dependency 를 승인해 flip. k6 는 `package.json` 의 `test:load:*` script 로 도입 완료).
2. **S2 조회 latency 경량 harness** (supertest 기반, 신규 dependency 불요 가능) — 위 1
   과 독립적으로 먼저 착수 가능한 최소 measure.
3. **S1 / S3 부하 harness 구현** — 1 의 도구 결정 후. 배치 부하·동시성 내성 스크립트. → [ADR-0057](../decisions/ADR-0057-s1-batch-load-io-isolation.md) (ACCEPTED, S1 외부 I/O 격리 4 축 확정). **스크립트 · workflow step · npm script 배선 완료** — S1 은 [`test/load/s1-batch.js`](../../test/load/s1-batch.js)(T-1631 main `fa0aad91`, D5 seed T-1632 `9099d99f`, 표본 env 방어 T-1634 `971c716c`) + `load-k6.yml` S1 step(T-1633 `63555e09`) + `package.json` `test:load:s1`, S3 는 `s3-concurrent.js`(T-1625 `efd2f5bb`).
   S1 스크립트 착수 전 **전제조건**은 같은 ADR 의 `D5`(T-1630 개정) 가 확정했다 — 타격 route 가
   `LlmProviderConfigResolver` 를 먼저 await 해 provider row 0 이면 503 이므로, S1 `setup()` 이
   `POST /api/llm/providers` 로 **정확히 1 row** 를 멱등 seed 하고 `teardown()` 이 회수한다
   (test-only 더미 값 + 더미 `LLM_APIKEY_ENC_KEY` — credential 0 유지). `§3` 임계는 무변경.
4. **CI 통합** — **편입 완료**: 부하 harness 는 [`load-k6.yml`](../../.github/workflows/load-k6.yml)
   별도 수동 job(`workflow_dispatch`)으로 편입돼 smoke → S1 → S2 → S3 step 을 실행하며, 상시
   PR CI(`ci.yml`)와 분리돼 있다(부하는 무거움).
5. **baseline 확정 + 임계 fix** — **S1 baseline 실측 6 회 완료**(T-1637 run **32459501970** ·
   T-1639 run **32503914467** · T-1641 run **32524618230** · T-1642 run **32533779832** ·
   T-1643 run **32540981922** · T-1647 run **32562811133**, 앞 넷은 2026-08-21 · 뒤 둘은
   2026-08-22,
   [`load-k6.yml`](../../.github/workflows/load-k6.yml), conclusion `success`, 전 step success).
   결론: `http_req_duration{route:batch}` p95 **99.29ms → 96.98ms**(표본 10) ·
   **760.91ms → 730.81ms → 711.23ms → 792.27ms**(표본 133) 이고 `http_req_failed` 은 여섯 회 모두
   **0.00%**(0/26 · 0/26 · 0/272 · 0/272 · 0/272 · 0/272) 로
   임계를 모두 통과했으며 수치·환경 메타는 위 `§3.1` 에 회차별로 박제했다.
   **§3 표의 S1 축 임계 숫자는 T-1644 확정 → T-1675 재산정 → T-1676/T-1677 집행**으로 현행값이
   섰다 — 관찰용 `http_req_duration{route:batch}`
   p95 **≤ 1100ms(stub 조건 baseline, 표본 133)** + error rate **< 1%**(도출식·근거는 §3 각주).
   S2 · S3 의 "baseline 후 fix" 는 해당 축 실측 0 회라 무변경이다.
   **잔여**: ① 실 scale 실측(133 명, [realdata-scale-devset.md](realdata-scale-devset.md)) 은
   **부분 해소** — `K6_S1_PERSONS` **상향 축은 닫혔다**(T-1640 이 연 `s1_persons` input 을 T-1641 이
   `133` 으로 dispatch 해 run `32524618230` 에서 외삽 계수 1 조건의 실측 확보). **잔여로 남는 축은
   실 dataset seed** — 133 명 `Person` 을 실 devset 규모로 채우고 각자 github `ServiceIdentity` 를
   붙여 **실 수집 왕복(50~100 repo · ~1000 page)** 을 태우는 것. 현 표본은 스크립트가 만든 합성
   person 이라 수집 왕복이 0 이고 LLM 도 stub(ADR-0057 `D1`)이다. 그 seed 축도 **입력 데이터와
   이중 정본 안전장치까지는 확보**됐다 — T-1648(main `c95b7dec`, PR #1317)이 정본 문서
   `§A` 33 명 + `§B` 100 명 = **133 로그인**을 기계 판독 fixture
   [`realdata-devset-logins.json`](../../test/load/realdata-devset-logins.json) + 검증 로더
   [`realdata-devset-logins.ts`](../../test/helpers/realdata-devset-logins.ts) 로 박제했고,
   T-1649(main `87cdb828`, PR #1318)가 정본 markdown 표 ↔ fixture **drift guard**
   ([`realdata-devset-logins-doc-consistency.ts`](../../test/helpers/realdata-devset-logins-doc-consistency.ts),
   colocated spec 이 `pnpm test` 에서 CI 게이트)를 신설해 한쪽만 갱신되는 drift 를 차단했다.
   따라서 **잔여는 seed 실행 경로** 로 좁혀졌었고, 그 **배선 축은 T-1651~T-1661 로 닫혔다** —
   (a) **helper chain 7 종**(`test/helpers/realdata-devset-seed-*.ts` + colocated spec):
   T-1651 `4e0697c6`(descriptor 순수 빌더) · T-1652 `bcce5516`(upsert-args 조립) ·
   T-1653 `26a9e8f9`(`Person` leg runner) · T-1654 `53ebe0aa`(`ServiceIdentity` leg runner) ·
   T-1655 `7bc054a7`(두 leg top-level 진입점) · T-1656 `1a7ace68`(CLI 본체) ·
   T-1657 `1e44f562`(실 `PrismaClient` 팩토리). (b) **실행 진입점**: T-1658 `609c937b` 가
   [`scripts/seed-devset-logins.ts`](../../scripts/seed-devset-logins.ts) 와
   [package.json](../../package.json) `27 행` `"seed:devset-logins": "ts-node scripts/seed-devset-logins.ts"`
   를 신설. (c) **workflow 배선**: T-1659 `f9da3e7f`(pnpm `9.12.0` · Node `20` ·
   `--frozen-lockfile` 툴체인 3 step) + T-1660 `73100c77`
   ([load-k6.yml](../../.github/workflows/load-k6.yml) `114 행` `133 로그인 실 dataset seed 적재`
   step). (d) **k6 소비 경로**: T-1661 `499df531` 이
   [`s1-batch.js`](../../test/load/s1-batch.js) `setup()` 을 `POST /api/persons` 합성 생성 대신
   `GET /api/persons` + `@load.devset.test` 접미사 필터로 바꾸고, `teardown()` 이 공유 dataset 을
   보존하게 했다. 그럼에도 **① 자체는 미해소 유지**다 — 다만 그 내용은 T-1665 로 한 칸 더
   좁혀졌다. 그 배선을 태운 **첫 실 run 인 T-1663 의 run `32652307813`**(head sha
   `0046e366`, `-f s1_persons=133`)은 `133 로그인 실 dataset seed 적재` step 의
   **ServiceIdentity leg 첫 upsert** 가 ``Argument `person` is missing.`` 로 죽어 conclusion
   `failure` 였고(원인:
   [`realdata-e2e-seed-upsert.ts`](../../test/helpers/realdata-e2e-seed-upsert.ts) 의
   `ServiceIdentityUpsertArgs.create` 가 `where.personId_service.personId` 만 런타임 치환하고
   `create` 쪽 Person 관계를 비워둔 것 — devset chain 은 T-1652 가 그 shape 을 승계), k6
   5 step 이 전부 skipped 라 `setup()` 소비 경로 검증도 회수 실패였다(`§3.1` 7 회차).
   그 결함은 **T-1664**(PR #1330 → main `61f616a1`)가 `resolveRealDataPersonId` 로
   `create.personId` 를 배선해 닫았고, **T-1665 의 재 dispatch run
   `32665014391`**(2026-08-23T20:38:13Z, head sha `3319ac41`, `-f s1_persons=133`, 1 회 한정)이
   **conclusion `success`** 로 그 fix 를 실 run 에서 확인했다 — seed step 이
   `devset seed 완료 — person 133 건 / serviceIdentity 133 건 적재` 를 찍었고, `http_reqs` 가
   272 → **7** 로 떨어져 `setup()` 이 `POST /api/persons` 합성 생성 없이 **적재분을 조회해
   소비**했음이 함께 드러났다(수치·인용은 위 `§3.1` 8 회차). 따라서 잔여 내용은 *배선* →
   *실행·실측* 을 거쳐 **"seed 실행 성공 1 회 확보(run `32665014391`) — 남은 축은 실 수집
   왕복 0"** 으로 좁혀졌다: 133 명 `Person` + 133 건 github `ServiceIdentity` 는 적재됐지만
   부하 job 에 GitHub/Confluence 자격증명이 없고 iteration 이 758.79ms 만에 끝나
   **50~100 repo · ~1000 page 실 수집 왕복은 여전히 0** 이며 LLM 도 stub(ADR-0057 `D1`)이다
   (잔여 개수는 **1 개** 그대로이며 ② · ③ 표기도 무변경). 그 수집 왕복 축은 본 계획 문서가
   아니라 별도 slice 의 몫이다(T-1665 는 측정·기록 전용이라 코드 변경 0).
   그 뒤 **T-1667 의 run `32677333740`**(2026-08-24T00:39:02Z dispatch, head sha `7063584f`,
   `-f s1_persons=133`, 1 회 한정, conclusion `success`)이 T-1666 이 배선한 표본 로그를 처음
   태워 `[s1-batch] devset 표본 취득 133명 / 요청 133명` 을 회수했다 — **표본 수 133 이 간접
   증거 3 종이 아니라 run log 로 직접 확정**됐고 seed step 도 같은 건수(`person` 133 ·
   `serviceIdentity` 133)로 **연속 2 회 성공**했다(수치·인용은 위 `§3.1` 9 회차). 그럼에도
   **잔여 ① 은 미해소 유지**다 — 확정된 것은 표본 수와 seed 재현성일 뿐이고 `http_reqs` **7** ·
   iteration **825.88ms** 가 보이듯 **실 수집 왕복은 여전히 0**, LLM 도 stub 이다(잔여 개수는
   **1 개** 그대로이며 ② · ③ 표기도 무변경).
   **함께 좁혀진 것은 S2 축이다 — *설계* 에서 *집행 완료* 로.** T-1671 이 위
   `#### S2 dataset 교체 설계 (사전 박제)` 소절에 S2 의 dataset 교체(person leg 조회 전환 ·
   공유 dataset 보존 계약 · `K6_SEED_PERSONS` 의미 재정의 · drift-guard 단언 대체 목록 · 임계
   무변경 · 2 task split) 를 코드 착수 이전에 박제했고, 그 split 의 **1 번(pr 교체 집행)을
   T-1672 가 PR #1333 → main `27953b24`(2 파일 `+267/-33`) 로 끝냈다**: ① `setup()` 의
   person leg 가 `POST /api/persons` 반복 생성에서 `GET /api/persons` **1 회** + email 이
   `@load.devset.test` 로 끝나는 원소 `filter` → `slice(0, SEED_PERSONS)` → `map` 의
   **단일 식**으로 전환됐고(group / part leg 는 합성 seed 유지), ② `teardown()` 의 person
   DELETE 루프가 제거돼 seed step 이 적재한 **공유 dataset 이 보존**되며(group / part DELETE
   루프는 유지), ③ `K6_SEED_PERSONS` 는 숫자 `30` · 정규화 표현 · workflow ↔ 스크립트
   ↔ drift-guard 3 자 parity 가 **모두 무변경**이고 의미만 "표본 상한" 으로 바뀌었으며,
   ④ drift-guard 단언 (a)~(g) 가 **같은 commit 에서** 갱신돼 spec 이 red 로 남는 구간이 없다.
   그럼에도 **본 잔여 항목의 해소 표기는 하지 않는다** — **S2 축 실측은 여전히 0 회**(설계
   ⑥ 의 세 번째 task 소관)라 이 교체는 잔여 ①(실 수집 왕복) 의 해소 근거가 아니다(잔여
   개수 **1 개** 그대로이며 ② · ③ 표기도 무변경). 이 문단 갱신과 아래 설계 ⑥ 의
   집행 pointer append 가 곧 split 의 **2 번(direct 문서 반영, T-1673)** 이다.
   **그 세 번째 task(T-1674)가 dispatch 1 회를 소진했으나 S2 수치는 여전히 0 개다.**
   run **32746598803**(2026-08-24T15:43:34Z dispatch, head sha `7788552a`, `-f s1_persons=133`,
   **1 회 한정** · 재 dispatch 0)은 conclusion **`failure`** 로 끝났다 — S1 leg 의 stub 조건
   관찰용 게이트 `p(95)<900` 이 실 run 에서 처음 `✗`(p95 **967.52ms**)로 crossed 돼 k6 가 exit
   **99** 를 냈고, S2 step 에 `if: always()` 가 없어 `k6 S2 조회 부하 시나리오 실행` 과 S3 step 이
   **`skipped`** 됐다(경위 · 원문 인용은 위 `§3.1` 의 `S2 1 회차`). 따라서 **잔여 ① 은 미해소
   유지**이고 잔여 개수도 **1 개** 그대로이며 ② · ③ 표기도 무변경이다 — 확인된 것은 seed step 의
   **연속 4 회 성공**과 devset 133 명이 조회 가능한 상태였다는 사실뿐이고, 실 수집 왕복은 S2
   축에서도 **0** 이다.
   **그 run 의 S1 leg 수치는 T-1675 가 재 dispatch 0 으로 회수했다**(위 `§3.1` 11 회차) — 실 scale
   표본 **8 개**의 평균 **786.13ms** · 표본표준편차 **81.35ms** · 평균+3σ **1030.18ms**(100ms 올림
   **1100ms**)로 T-1668 규칙 트리거 ①-(a) 가 처음 충족(①-(b) 도 충족)됐다. 다만 숫자 실제 변경은
   규칙 ④ 의 **2 task split**(코드 `pr` → 문서 `direct`)로 이월돼 `§3` 표 · 각주 · 상수는 여기서도
   **무변경**이고, 잔여 개수 **1 개** · ② · ③ 표기도 그대로다(실 수집 왕복은 여전히 0).
   **그 이월분과 S2 · S3 skip 구조는 T-1676 · T-1677 · T-1678 세 slice 가 닫았다.** (a) **코드
   축** — T-1676(PR **#1334** → main **`ebe6d8f8`**)이
   [`s1-batch.js`](../../test/load/s1-batch.js) 의 관찰용 게이트 상수 `STUB_BASELINE_P95_MS` 를
   `900` → **`1100`** 으로 동기하고 drift-guard smoke 의 대조 리터럴을 같은 commit 에서 갱신했다
   (규칙 ④ split 앞단). (b) **문서 축** — T-1677(main **`24b2d3f5`**)이 `§3` 임계 표 row ·
   도출식 각주 · 성격 구분 각주 · 규칙 소절 pointer 를 `1100ms` 로 맞춰 split 뒷단을 끝냈다.
   (c) **워크플로 축** — T-1678(PR **#1335** → main **`8af5b06d`**)이
   [`load-k6.yml`](../../.github/workflows/load-k6.yml) 의 S2 · S3 step 에
   `if: ${{ !cancelled() }}` 를 얹어(`always()` 미사용 — 취소 시 부하 발생기 미실행 불변식 보존)
   **S1 leg red 가 두 leg 를 통째로 skip 시키던 구조 결함**을 닫고 drift-guard smoke 에 `T-1678`
   describe **12 test**(negative 5 종)를 더했다. 그럼에도 **잔여 ① 은 미해소 유지**이고 잔여
   개수도 **1 개** 그대로이며 ② · ③ 표기도 무변경이다 — 셋은 임계 표현과 실행 게이트만 고쳤을
   뿐, **실 수집 왕복은 여전히 0**(50~100 repo · ~1000 page) · LLM 은 stub(ADR-0057 `D1`) ·
   **S2 축 실측도 여전히 0 회**다(게이트 배선 뒤의 실 dispatch 는 T-1678 승계 Follow-up ① 로
   별도 slice 소관).
   ② **반복 run 기반 임계 fix** 는
   **해소 — 임계 확정 완료(T-1644)**. 실 scale 축(표본 133)의 같은 조건 표본이 T-1643 run
   `32540981922` 로 **3 개**가 됐고(3·4·5 회차 760.91ms → 730.81ms → 711.23ms), 그 batch p95
   기술통계는 평균 **734.32ms** · 범위 **49.68ms** · 표본표준편차 **25.02ms** · 변동계수
   **3.41%** 다(계산 근거는 위 `§3.1` 5 회차). T-1643 이 그 산포를 근거로 내린 판정
   **(a) 임계 확정을 별도 slice 로 착수한다** 를 T-1644 가 문서 축에서 집행해, `§3` 표에 S1
   관찰용 p95 임계 **≤ 900ms(stub 조건 baseline, 표본 133)** 와 error rate **< 1%** 를 확정했다.
   평균 기반의 빡빡한 숫자 대신 **평균 + 3σ 마진**(734.32 + 3 × 25.02 = 809.38 → 100ms 올림
   900ms)을 택한 것은 세 값이 단조 감소라 추세 성분을 배제할 수 없기 때문이고, 그 임계가
   **REQ-047 판정 임계가 아니라 stub 조건**(LLM stub · 수집 왕복 0 · 단일 iteration)의 회귀
   관찰용임은 `§3` 표 아래 각주에 함께 박제했다 — REQ-047 판정은 1h 예산(`3,600,000ms`,
   스크립트 `FULL_RUN_BUDGET_MS`) 그대로다. 임계 확정과 다른 축이던 **배선 축도 해소** —
   T-1645(PR #1316 → main `874297ca`)가 [`s1-batch.js`](../../test/load/s1-batch.js) 에
   `STUB_BASELINE_PERSONS = 133` · `STUB_BASELINE_P95_MS = 900` 두 상수를 두고
   `http_req_duration{route:batch}` 임계 배열에 `p(95)<900` 을 **표본 133 일 때만** 얹는
   조건부 활성으로 배선했다(기본 표본 10 run 영향 0, REQ-047 판정 임계는 여전히 1h 예산
   외삽 `BATCH_P95_MS`). **그 배선의 "런타임 활성 여부" 축도 T-1647 run `32562811133`(표본 133,
   6 회차)로 해소 — 결함 0**: k6 `THRESHOLDS` 출력에 `http_req_duration{route:batch}` 임계가
   `✓ 'p(95)<3600000'` · `✓ 'p(95)<900'` **2 개**로 실제 등장했고 둘 다 통과했으며(측정 p95
   792.27ms, 900ms 까지 여유 107.73ms · 약 11.97%), 실 scale 표본 4 개의 평균 + 3σ
   (748.81 + 3 × 35.46 = 855.19ms) 도 900ms 안이라 `§3` 표 임계 재확정 사유는 생기지 않았다
   (계산 근거는 `§3.1` 6 회차). 그 결과 **본 item 의 잔여는 위 ① 의 실 dataset seed 축
   (133 명 `Person` + 각자 github `ServiceIdentity` 로 실 수집 왕복) 1 개뿐**이고 — 그 1 개도
   입력 데이터(133 로그인 fixture, T-1648)와 이중 정본 drift guard(T-1649)까지 확보돼 **내용이
   seed 실행 경로로 좁혀진 상태**다(위 ① 참조, 잔여 개수는 1 개 그대로) —
   ② 임계 fix · ③ 환경 메타 회수는 각 항 표기대로 이미 해소다.
   ③ 환경 메타 회수 경로
   보강은 **해소** — T-1638(main `55b81dea`) 의 `tee -a` 배선을 T-1639 가 run `32503914467` 에서
   실증해 커널·아키텍처·vCPU·메모리 등 메타 7 항목을 `gh run view --log` 만으로 회수했고,
   T-1641 run `32524618230` · T-1642 run `32533779832` 두 run 이 같은 경로로 표본 인원 `133`
   주입까지 재확인했다. **실 DB round-trip 실측이 slice 29 까지 도달**: slice 1(T-1500, main
   `0395c51e`) 의 [`person-read-realdb.perf-spec.ts`](../../test/perf/person-read-realdb.perf-spec.ts)
   가 mock override 0 부트스트랩 + 실 Prisma seed 로 `GET /api/persons` 의 p95 < 3000ms 를 실측했고,
   slice 2(T-1502, main `97198504`) 의
   [`group-read-realdb.perf-spec.ts`](../../test/perf/group-read-realdb.perf-spec.ts) 가 같은 구조로
   `GET /api/groups` 목록 · `:id` · `:id/persons` 를 측정해 **N+1 indirect navigation**
   (`findPersonsByGroupId` 의 membership 비례 query) 경로에서도 같은 임계 충족을 증거화했다. 이어
   slice 3(T-1504, main `a8bc1e28`) 의
   [`group-persons-scale-realdb.perf-spec.ts`](../../test/perf/group-persons-scale-realdb.perf-spec.ts)
   가 slice 2 와 **같은 route** (`GET /api/groups/:id/persons`) 를 membership **5 건 vs 60 건** 두
   표본으로 측정해 규모가 커져도 p95 < 3000ms 가 유지됨을 실측했다 — 즉 slice 3 이 늘린 것은
   route 폭이 아니라 **규모 축** 이었다. 그다음 slice 4(T-1506, main `861add36`) 의
   [`assessment-read-realdb.perf-spec.ts`](../../test/perf/assessment-read-realdb.perf-spec.ts)
   (9 test) 가 세 번째 endpoint 도메인인 `AssessmentController` 의 조회 2 route
   (`GET /api/assessments?personId=&period=` · `GET /api/assessments/:id`) 를 **실 JWT 로
   `JwtAuthGuard` + `RolesGuard` 를 통과하며** 측정해 인증 layer + DB round-trip 을 모두 포함한
   경로에서도 p95 < 3000ms 임을 실측했다(401 분기로 guard 생존 확인, `@@index([personId, period,
   periodStart])` 를 타는 필터 + 다중 row 경로라 앞 slice 의 flat 목록 · N+1 loop 와 구조가 다르다).
   그다음 slice 5(T-1508, main `b15ffb0e`) 의
   [`contribution-read-realdb.perf-spec.ts`](../../test/perf/contribution-read-realdb.perf-spec.ts)
   (10 test) 가 네 번째 endpoint 도메인인 `ContributionController` 의 조회 2 route
   (`GET /api/contributions?assessmentId=` · `GET /api/contributions/:id`) 를 slice 4 에 이어
   **실 JWT 로 guard 를 통과하며** 측정해 **부모→자식 FK fan-out** 경로에서도 p95 < 3000ms 임을
   실측했다(필터가 명시 `@@index` 가 아니라 `@@unique([assessmentId, sourceRef])` composite unique
   index 의 **prefix** 를 타고, seed 는 `Person → Assessment → Contribution` **3-level FK chain** 의
   상대 비교용 소규모 표본 `PRIMARY_CHILDREN = 5` · `OTHER_CHILDREN = 3` 이라 REQ-047 의 실 scale
   부하 검증이 아니다). 그다음 slice 6(T-1510, main `403a1240`) 의
   [`summary-read-realdb.perf-spec.ts`](../../test/perf/summary-read-realdb.perf-spec.ts)
   (10 test) 가 다섯 번째 endpoint 도메인인 `SummaryController` 의 조회 2 route
   (`GET /api/summaries?personId=&period=` · `GET /api/summaries/:id`) 를 slice 4·5 에 이어
   **실 JWT 로 guard 를 통과하며** 측정해 **시계열 정렬 조회** 경로에서도 p95 < 3000ms 임을
   실측했다(구조 축 2 개 추가 — ① `@@unique([personId, period, periodStart])` 와 `@@index` 가
   **동일 tuple 로 중복 정의된 유일 entity** 라 optimizer 가 어느 index 를 타든 임계가 성립하는지의
   첫 증거이고, ② `narrative` 가 서술형 long text 라 응답 본문이 앞 slice 보다 큰 **payload 크기 축**
   이다. seed 는 `WEEK_ROWS = 4` · `MONTH_ROWS = 2` 의 상대 비교용 소규모 표본이라 REQ-047 의 실
   scale 부하 검증이 아니고, 401 은 **cookie 부재 · 변조 토큰 2 조건** 으로 살아 있다).
   그다음 slice 7(T-1512, main `561f3fdf`) 의
   [`part-read-realdb.perf-spec.ts`](../../test/perf/part-read-realdb.perf-spec.ts)
   (10 test) 가 여섯 번째 endpoint 도메인인 `PartController` 의 조회 2 route
   (`GET /api/parts` · `GET /api/parts/:id/persons`) 를 측정해 **명시 index 가 없는 FK 역방향
   필터** 경로에서도 p95 < 3000ms 임을 실측했다(구조 축 3 개 추가 — ① 필터 컬럼 `Person.partId`
   는 `@unique` 도 `@@index` 도 선언되지 않은 **유일한 실측 필터 컬럼** 이라 index 미보장 경로의
   첫 증거이고, ② `findPersonsByPartId` 가 부모 존재 검증 후 자식 조회를 하는 **요청당 상수
   2 query** 라 slice 2 의 membership 비례 N+1 과도 앞 slice 들의 단일 SELECT 와도 다르며,
   ③ 자식 조회가 `activeOnly` 기본값으로 `active: true`(REQ-026) 를 타는 **soft-delete 필터**
   라 비활성 row 를 섞은 seed 에서 걸러짐과 latency 를 함께 관측한다. `PartController` 는
   guard 미부착이라 slice 4·5·6 과 달리 401 분기가 없는 **인증 노이즈 0 측정** 이고, seed 는
   `ACTIVE_PERSONS = 5` · `INACTIVE_PERSONS = 2` · `OTHER_PERSONS = 3` 의 상대 비교용 소규모
   표본이라 REQ-047 의 실 scale 부하 검증이 아니다).
   그다음 slice 8(T-1514, main `7bcb2c81`) 의
   [`user-read-realdb.perf-spec.ts`](../../test/perf/user-read-realdb.perf-spec.ts)
   (10 test) 가 일곱 번째 endpoint 도메인인 `UserController` 의 조회 2 route
   (`GET /api/users` · `GET /api/users/:id`) 를 **실 JWT 로** 측정해 **self-OR-Admin OR 분기와
   403 인가 거절을 포함한** 경로에서도 p95 < 3000ms 임을 실측했다(구조 축 3 개 추가 —
   ① 상세 route 가 `isSelf || isAdminPlus` OR 분기를 controller 에서 판정해 권한 부족 **403** 과
   존재 부재 **404** 가 의미상 분리되고, 403 은 `service.findById` 호출이 0 이라 **DB 를 타지 않는
   거절 경로의 latency** 를 처음 관측하는 **403 인가 분기의 첫 실측** 이고, ② 목록은
   `JwtAuthGuard + RolesGuard`(`@Roles("Admin")`) · 상세는 `JwtAuthGuard` 만 + controller 분기라
   같은 controller 안에서 **guard stack 깊이가 다른 두 route** 를 나란히 재는 **route 별 상이
   guard tier** 이며(slice 7 의 guard 미부착 측정 뒤 **guard 통과 축이 복귀** 하고 거절 상태가
   401 뿐 아니라 403 까지 넓어졌다), ③ 결과 집합이 곧 actor 가 속한 **인증 principal 테이블**
   `User` 이고 필터 축도 **단일 컬럼 `@unique`(`User.email`)** + 목록의 **무필터 전량 SELECT**
   다 — slice 4 = composite `@@index`, 5 = composite unique prefix, 6 = unique·index 중복 tuple,
   7 = 무-index. seed 는 `TARGET_USERS = 3` · `ITERATIONS = 8` · `SHORT_ITERATIONS = 4` 의 상대
   비교용 소규모 표본이라 REQ-047 의 실 scale 부하 검증이 아니다).
   그다음 slice 9(T-1516, main `87a1bcb8`) 의
   [`permission-denied-read-realdb.perf-spec.ts`](../../test/perf/permission-denied-read-realdb.perf-spec.ts)
   (12 test) 가 여덟 번째 endpoint 도메인이자 첫 `src/user/` 외부 module 인
   `PermissionDeniedRecordController` 의 조회 1 route (`GET /api/permission-denied-records`) 를
   **실 JWT 로** 측정해 **거부가 아니라 결과 집합이 축소되는 audience 차등** 경로에서도
   p95 < 3000ms 임을 실측했다(구조 축 3 개 추가 — ① 응답은 모두 **200** 인데 actor 에 따라 발화
   query 수가 **1(Admin bypass) / 2(allowlist 조회 + `findMany`) / 1(공집합 early return)** 로
   갈리는 첫 경로라 slice 8 의 **403 거부** 와도 slice 7 의 요청당 상수 2 query 와도 다르고,
   ② 대상 테이블이 `@@index([instanceRef, createdAt])` 와
   `@@index([provider, httpStatus, createdAt])` **둘** 을 갖고 `@unique` 는 **0** 인 유일 실측
   대상이라 optimizer 가 필터 조합에 따라 후보를 고르고 `orderBy: { createdAt: "desc" }` 가 두
   index 의 후행 컬럼과 **정렬 축을 공유** 하며(두 표본의 대소 관계는 slice 3 선례대로 단언하지
   않는다 — slice 4 = composite `@@index`, 5 = composite unique prefix, 6 = unique·index 중복
   tuple, 7 = 무-index, 8 = 단일 컬럼 `@unique`), ③ 필터가 query **3 축**
   (`instanceRef` · `provider` · `httpStatus`) 조합이고 non-Admin 경로는 접근 허용 instance 를
   `instanceRef in [...]` 로 주입하는 **다축 query param + allowlist `IN` 절** 이다. 측정 대상은
   **append-only audit 테이블** 이고, seed 는 `ITERATIONS = 8` · `SHORT_ITERATIONS = 4` ·
   `SEED_ROWS`(5 row) 의 상대 비교용 소규모 표본이라 REQ-047 의 실 scale 부하 검증이 아니다).
   그다음 slice 10(T-1518, main `c1630d40`) 의
   [`export-read-realdb.perf-spec.ts`](../../test/perf/export-read-realdb.perf-spec.ts)
   (10 test) 가 아홉 번째 endpoint 도메인인 `ExportController` 의 조회 2 route
   (`GET /api/admin/export/running` · `GET /api/admin/export/:id`) 를 **실 JWT 로** 측정해
   **운영 job polling** 경로에서도 p95 < 3000ms 임을 실측했다(구조 축 3 개 추가 —
   ① `findRunning` 이 `where: { status: "RUNNING" }` 로 `@@index([status, createdAt])` 의
   **leading-edge 1 컬럼만** 타고 그 필터 타입이 String/Int 가 아니라
   **Prisma enum(`JobStatus`)** 인 **enum 필터 + index 선두 컬럼** 의 첫 실측이고
   (slice 4 = composite `@@index`, 5 = composite unique prefix, 6 = unique·index 중복 tuple,
   7 = 무-index, 8 = 단일 컬럼 `@unique`, 9 = index 후보 2 개), ② `dateRange` ·
   `entitySelector` 가 nullable `Json?` 이라 **구조화 payload 의 JSONB 역직렬화 +
   NULL/비-NULL 혼재 표본** 을 처음 재며(slice 6 의 `narrative` long text 는 평문 축이라
   다르고, 두 표본의 대소 관계는 slice 3 선례대로 단언하지 않는다), ③ 두 route 모두
   `@Roles("Admin")` 이라 User tier actor 는 **RolesGuard 단계에서 DB 미도달 403** 인
   **guard 레벨 403** 이다 — slice 8 의 403 은 controller 가 self-OR-Admin 을 판정한
   **controller 레벨** 거절이었으므로 같은 403 이어도 **발생 layer 가 다르다**. 부수 축으로
   도메인 데이터가 아닌 **운영 job 생명주기 테이블** 을 처음 재고, 단건 조회가
   **`findUniqueOrThrow` 의 P2025 → 404 변환** 경로이며 FK 가 **`onDelete: Restrict`** 다.
   seed 는 `ITERATIONS = 8` · `SHORT_ITERATIONS = 4` · 4 status 혼재 job 소수 row 의 상대
   비교용 소규모 표본이라 REQ-047 의 실 scale 부하 검증이 아니다).
   그다음 slice 11(T-1520, main `a3703964`) 의
   [`llm-provider-config-read-realdb.perf-spec.ts`](../../test/perf/llm-provider-config-read-realdb.perf-spec.ts)
   (9 test) 가 열 번째 endpoint 도메인인 `LlmProviderConfigController` 의 조회 2 route
   (`GET /api/llm/providers` · `GET /api/llm/providers/:id`) 를 **실 JWT 로** 측정해
   **운영 secret config 조회** 경로에서도 p95 < 3000ms 임을 실측했다(구조 축 3 개 추가 —
   ① `LlmProviderConfig` 는 `@id` 외에 `@unique` · `@@unique` · `@@index` 가 **하나도 없는
   첫 실측 대상** 이라 목록은 무필터 전량 `findMany()` · 단건은 **PK 직행 `findUnique`** 인
   **secondary index 0 테이블** 이고(slice 7 은 필터 컬럼만 무-index 이고 테이블에는 다른
   index 가 있었으며, 8 = 단일 컬럼 `@unique`, 9 = index 후보 2 개, 10 = `@@index` 선두 컬럼),
   ② service 가 row 마다 명시 field pick 으로 `apiKey`(AES-256-GCM envelope ciphertext) 를
   버린 **새 view 객체** 를 만들어 **DB payload > 응답 payload** 이므로 **row 수 비례 변환
   CPU** 가 latency 에 처음 섞이며(앞 10 slice 는 repository row 를 그대로 직렬화 forward),
   ③ 단건 404 가 repository 의 null 을 service 가 분기해 `NotFoundException` 을 던지는
   **null 분기 기반** 이라 slice 10 의 `findUniqueOrThrow` **P2025 예외 기반** 404 와 같은
   상태코드여도 **발생 메커니즘이 다르다**. 부수 축으로 대상 테이블이 `truncateAll` 명단에
   없어 **spec-local `deleteMany` 정리가 필요한 첫 대상** 이고, 역방향
   relation(`DifficultyMapping[]`, `onDelete: Restrict`) 이 있는데도 `include` 0 인
   **미조인 SELECT** 이며, 도메인 데이터가 아닌 **운영 secret 보관 config 테이블** 이다.
   403 layer 는 두 route 모두 `@Roles("Admin")` 이라 slice 10 과 동일해 새 축이 아니다.
   seed 는 config **0 건(빈 배열) · 3 건 전량** 표본과 `ITERATIONS = 8` ·
   `SHORT_ITERATIONS = 4` 반복의 상대 비교용 소규모 표본이라 REQ-047 의 실 scale 부하
   검증이 아니다).
   그다음 slice 12(T-1522, main `cc8b9f36`) 의
   [`import-read-realdb.perf-spec.ts`](../../test/perf/import-read-realdb.perf-spec.ts)
   (8 test) 가 열한 번째 endpoint 도메인인 `ImportController` 의 조회 2 route
   (`GET /api/admin/import/modes` · `GET /api/admin/import/running`) 를 **실 JWT 로** 측정해
   **DB 미도달 route 와 DB round-trip route 모두** p95 < 3000ms 임을 실측했다(구조 축 3 개
   추가 — ① **0-query 동기 handler 의 배선-only latency floor 첫 분리 관측**: `modes` 는
   handler 가 `async` 도 아닌 **동기 반환** 이고 service 미경유 · Prisma delegate 호출 **0**
   이라 **guard stack + 라우팅 + 직렬화만의 latency floor** 를 처음 분리해 잰다(앞 11 slice
   의 측정 route 는 예외 없이 최소 1 query 를 발화했다), ② **같은 controller · 같은 fixture
   안에서 0-query route 와 DB round-trip route 를 나란히 측정**: `running` 은 실 `ImportJob`
   을 `status: "RUNNING"` 으로 거르는 실 query 경로라 동일 프로세스 · 동일 표본 조건에서
   **DB 성분과 배선 성분의 상대 관측 기록** 이 처음 남는다(두 표본의 대소 관계는 slice 3
   선례대로 단언하지 않고 관찰만 한다), ③ **한 요청에 Prisma enum 2 종(필터 축 `JobStatus`
   + payload 축 `ImportMode`) + `Int?` / `String?` nullable scalar 혼재**: `ImportJob` 은
   slice 10 `ExportJob` 의 정합 쌍이라 `@@index([status, createdAt])` leading-edge ·
   `JobStatus` enum 필터 · `Restrict` FK 는 같지만 payload 축이 `mode`(`ImportMode`) 라는
   **두 번째 enum 컬럼** + `restoredRowCount`(`Int?`) + `error` / `artifactRef`(`String?`)
   의 nullable scalar 혼재라 slice 10 의 `Json?` 2 컬럼 JSONB 축과 상이하다. 부수 축으로
   `modes` 응답은 **DB 상태와 무관한 고정 2 원소**(REPLACE=destructive / MERGE) 라 seed
   유무에 latency 가 반응하지 않고, 403 layer 는 두 route 모두 `@Roles("Admin")` 이라
   slice 10·11 과 동일해 새 축이 아니다. seed 는 `ITERATIONS = 8` ·
   `SHORT_ITERATIONS = 4` · status 혼재 import job 소수 row 의 상대 비교용 소규모 표본이라
   REQ-047 의 실 scale 부하 검증이 아니다).
   그다음 slice 13(T-1524, main `51c02093`) 의
   [`difficulty-mapping-read-realdb.perf-spec.ts`](../../test/perf/difficulty-mapping-read-realdb.perf-spec.ts)
   (8 test) 가 열두 번째 endpoint 도메인인 `DifficultyMappingController` 의 조회 1 route
   (`GET /api/llm/difficulty-mappings`) 를 **실 JWT 로** 측정해 p95 < 3000ms 임을 실측했다
   (구조 축 3 개 추가 — ① **nullable 관계형 FK 의 NULL / 비-NULL 혼재 + `include` 0 미조인
   조회**: `llmProviderConfigId` 가 `String?` 이라 슬롯마다 지정 / 미지정이 갈리는데 앞 12
   slice 의 payload 축에는 **관계형 FK 자체가 nullable 인 경로가 없었다**(slice 10 의 `Json?`
   2 컬럼은 구조화 scalar, slice 12 의 `Int?` / `String?` 은 비-관계 scalar). 부모 row 가
   실재해도 `findMany()` 가 `include` 를 주지 않아 **join 0 · FK 는 문자열 컬럼으로만
   직렬화** 된다, ② **부모–자식 두 테이블이 각각 별도 slice 로 실측되는 첫 페어이자
   `onDelete: Restrict` 로 정리 순서가 강제되는 첫 실 DB slice**: 부모 `LlmProviderConfig`
   는 slice 11(T-1520, main `a3703964`) 에서 이미 쟀고 본 slice 는 그 **자식** 을 잰다. 두
   테이블 모두 `truncateAll` 명단 밖이라 spec-local `deleteMany` 가 필요하고 **자식 먼저**
   순서를 지켜야 한다, ③ **schema 로 카디널리티가 상한된 고정 슬롯 테이블**:
   `@@unique([difficulty])` + easy/medium/hard 3 슬롯 고정
   ([ADR-0011](../decisions/ADR-0011-difficulty-model-assignment.md) §1) 이라 결과 집합이
   구조적으로 3 을 넘을 수 없어 **규모 민감도가 schema 로 bounded 인 첫 실측 경로** 다 — 앞
   slice 의 대상은 모두 원리상 무한 증가 가능한 테이블이었다. `@Roles("Admin")` guard 레벨
   403 은 slice 10·11·12 와 동일하고 무필터 전량 `findMany()` 도 slice 11 과 같아 둘 다 새
   축이 아니다. seed 는 슬롯 **0 건(빈 배열) · 3 슬롯 전량** 표본과 반복 소수 회의 상대
   비교용 소규모 표본이라 REQ-047 의 실 scale 부하 검증이 아니다).
   그다음 slice 14(T-1526, main `d5a5a1b8`) 의
   [`auth-me-read-realdb.perf-spec.ts`](../../test/perf/auth-me-read-realdb.perf-spec.ts)
   (9 test) 가 열세 번째 endpoint 도메인인 `AuthController` 의 조회 1 route
   (`GET /api/auth/me`) 를 **실 JWT cookie 로** 측정해 p95 < 3000ms 임을 실측했다
   (구조 축 3 개 추가 — ① **조회 키가 요청 표면이 아니라 인증 토큰 payload(`req.user.sub`)
   에서 나오는 첫 경로**: path param 0 · query 0 이라 요청 표면이 **cookie 뿐** 이고 결과
   집합이 **actor 자신 1 row** 로 고정된다(앞 13 slice 의 필터 입력은 예외 없이 URL path
   param 또는 query 였고 slice 8 의 `User` 상세도 path param `:id` 기반이었다),
   ② **`JwtAuthGuard` 단독 — `RolesGuard` 미부착으로 403 분기가 구조적으로 부재**:
   slice 10~13 은 `@Roles("Admin")` guard 레벨 403, slice 8 은 같은 controller 안 route 별
   guard tier 차이, slice 7 은 guard 0 이었고 **인증만 있고 인가 0** 인 guard stack 은 본
   slice 가 처음이라 401 만 존재한다, ③ **stale token 404 — 인증 통과 + DB 도달 +
   principal row 부재 조합의 첫 실측**: 서명이 유효한 토큰인데 해당 `User` row 가 삭제되면
   `findById(sub)` 가 `NotFoundException` → 404 로 갈린다(slice 10 의 404 는 **임의 path
   param id** 의 부재였고 본 경로는 **actor 자신의 row 부재** 라 401 이 아니라 404 로
   갈리는 지점이 다르다). 부수 축으로 응답이 `UserResponseDto.fromEntity` 를 거쳐
   `hashedPassword` 를 차단하는 **단건 sanitize** 이고(slice 11 의 per-row sanitize 는
   목록 · row 수 비례 변환이라 성격이 다르다), PK 직행 `findUnique` 자체는 slice 11 과
   같아 **새 축이 아니다**. seed 는 actor **2 명(User tier · Admin tier)** 과 반복 소수 회의
   상대 비교용 소규모 표본이라 REQ-047 의 실 scale 부하 검증이 아니다).
   그다음 slice 15(T-1528, main `8d63f40c`) 의
   [`export-status-view-read-realdb.perf-spec.ts`](../../test/perf/export-status-view-read-realdb.perf-spec.ts)
   (12 test) 가 이미 실측된 `ExportController` 의 **파생 view 1 route**
   (`GET /api/admin/export/:id/status-view`) 를 **실 JWT cookie 로** 측정해 p95 < 3000ms 임을
   실측했다(**endpoint 도메인을 늘리지 않고 조회 route 만 23 → 24 로 늘리는 첫 slice** —
   구조 축 3 개 추가: ① **파생 view 반환** 으로 DB row 와 응답 shape 가 완전히 다른 첫 실 DB
   경로(`phaseLabel` · `stepIndex` · `totalSteps` · `nextStatus` · `terminal` · `downloadable` ·
   한국어 `message` 를 신설해 반환하므로 `ExportJob` 의 어떤 컬럼도 그대로 나오지 않는다),
   ② **DB enum 1 컬럼이 응답 전체를 결정**(`JobStatus` 4 값이 `JOB_STATUS_TO_VIEW` 를 거쳐
   4 종의 서로 다른 view 로 갈린다 — slice 10 이 같은 enum 을 **필터 축** 으로 썼던 것과 달리
   본 slice 는 **payload 결정 축** 으로 쓴다), ③ **같은 row 를 읽는 두 route 가 각각 별도
   slice 로 실측되는 첫 페어**(slice 10 의 `GET :id` raw record 와 본 slice 의
   `:id/status-view` 파생 view — slice 13 의 부모–자식 페어는 두 테이블이었지만 본 건은
   **동일 테이블 · 동일 row** 이고 두 p95 의 대소 관계는 slice 3 선례대로 단언하지 않는다).
   `@Roles("Admin")` guard 레벨 403 과 `findUniqueOrThrow` 의 P2025 → 404 는 slice 10 과
   동일해 새 축이 아니다. seed 는 `JobStatus` 4 값 혼재 job 소수 row 와 반복 소수 회의 상대
   비교용 소규모 표본이라 REQ-047 의 실 scale 부하 검증이 아니다).
   그다음 slice 16(T-1530, main `a276beb4`) 의
   [`cron-schedule-read-realdb.perf-spec.ts`](../../test/perf/cron-schedule-read-realdb.perf-spec.ts)
   (13 test) 가 **열네 번째 endpoint 도메인이자 첫 `src/scheduling/` 모듈 실측** 인
   `CronScheduleController` 의 조회 1 route (`GET /api/schedules`) 를 **실 JWT cookie 로**
   측정해 p95 < 3000ms 임을 실측했다(slice 15 와 반대로 **도메인과 route 를 각각 1 개씩** 더해
   endpoint 13 → 14 · 조회 route 24 → 25 로 늘린다 — 구조 축 3 개 추가: ① **결과 집합이 DB
   row 가 아니라 in-process `SchedulerRegistry` 상태인 첫 경로**(`getCronJobs()` Map 의 key
   배열이라 어떤 테이블도 읽지 않는다 — slice 12 의 0-query `modes` 는 **DB·상태와 무관한
   고정 2 원소 상수** 였으나 본 응답은 **선행 write 로 변하는 가변 상태** 다), ② **같은 spec
   안의 HTTP write(`PUT` / `DELETE`)가 read 표본을 만드는 첫 페어**(앞 15 slice 는 Prisma 로
   seed 를 직접 심고 read 만 쟀다 — write route 자체의 p95 는 단언하지 않고 상태 준비 수단으로만
   쓴다), ③ **규모 축이 DB row 수가 아니라 registry 등록 수인 첫 slice**(등록 0 건 vs 4 건 두
   표본이며 대소 관계는 slice 3 선례대로 미단언). `@Roles("Admin")` guard 레벨 403 과 cookie
   미부착·서명 변조 401 은 slice 10~13 과 동일해 **새 축이 아니다**. 표본은 등록 0 건 · 4 건과
   반복 소수 회의 상대 비교용 소규모 표본이라 REQ-047 의 실 scale 부하 검증이 아니다).
   그다음 slice 17(T-1532, main `2b632266`) 의
   [`export-download-read-realdb.perf-spec.ts`](../../test/perf/export-download-read-realdb.perf-spec.ts)
   (13 test) 가 **이미 실측 도메인인 `ExportController` 의 다운로드 1 route**
   (`GET /api/admin/export/:id/download`) 를 **실 JWT cookie 로** 측정해 p95 < 3000ms 임을
   실측했다(slice 16 과 반대로 **slice 15 와 같은 셈법** 이라 endpoint 도메인은 **14 불변** 이고
   조회 route 만 **25 → 26** 으로 늘며, `ExportController` 는 slice 10 · slice 15 에 이어 **세
   번째로 재는 controller** 다 — 구조 축 3 개 추가: ① **한 요청이 서로 무관한 5 테이블을
   `Promise.all` 로 병렬로 읽는 첫 fan-out**(`materializeFullExportDownload` →
   `collectFullExportRecords` 가 `EXPORT_ENTITY_SOURCES` 5 entity(Assessment · Person · Group ·
   LlmConfig · AuditLog)에 각각 `findMany` 를 던진다 — 앞 16 slice 의 최대 fan-out 은 slice 2·3
   의 membership indirect navigation 이라 **같은 chain 안 loop** 였다), ② **응답이 JSON body 가
   아니라 `StreamableFile` stream artifact 인 첫 slice**(`serializeExportDownloadHeaders` 가
   `Content-Type` / `Content-Disposition` / `Content-Length` 를 세팅하므로 latency 에 직렬화 +
   Buffer 수집 + header 산출 비용이 포함되고, `Content-Length` 가 **실 body byte 길이와 일치**
   함을 단언하는 첫 경로이자 **응답 크기가 byte 로 관측 가능한 첫 경로** 다), ③ **DB 읽기량과
   응답 크기가 분리되는 첫 경로**(scope 선별 `selectExportRecords` 가 DB 가 아니라 **in-process**
   라 RANGE / PARTIAL job 은 응답이 작아져도 **읽는 row 수는 FULL 과 동일** — 규모 축이 응답
   크기가 아니라 **총 DB row 수** 이며 소규모 seed(entity 당 1~2 row)와 상대적 대규모
   seed(Person 20 + Assessment 20 누적) 두 표본의 대소 관계와 byte 증가량은 slice 3 선례대로
   미단언). `@Roles("Admin")` guard 레벨 403 · cookie 미부착·서명 변조 401 · 부재 id 404 는
   slice 10~16 과 동일해 **새 축이 아니다**. 표본은 위 두 seed 와 반복 소수 회의 상대 비교용
   소규모 표본이라 REQ-047 의 실 scale 부하 검증이 아니다).
   그다음 slice 18(T-1534, main `b1da3564`) 의
   [`group-members-read-realdb.perf-spec.ts`](../../test/perf/group-members-read-realdb.perf-spec.ts)
   (12 test) 가 **이미 실측 도메인인 `GroupController` 의 membership 조회 1 route**
   (`GET /api/groups/:id/members`) 를 실 부트스트랩으로 측정해 p95 < 3000ms 임을 실측했다
   (**slice 15·17 과 같은 셈법** 이라 endpoint 도메인은 **14 불변** 이고 조회 route 만
   **26 → 27** 로 늘며 `GroupController` 는 slice 2 · slice 3 에 이어 **세 번째로 재는
   controller** 다 — 구조 축 3 개 추가: ① **N:M 중간 테이블 row 자체가 응답 payload 인 첫 실 DB
   경로**(`GroupService.findMembershipsByGroupId` 가 `PersonGroupMembership` row 를 가공 0 으로
   반환해 `id` / `personId` / `groupId` / `createdAt` 4 컬럼의 가장 좁은 shape 이다 — 앞 17
   slice 의 응답은 도메인 entity row · sanitize view · 파생 view · in-process registry 상태 ·
   stream artifact 였을 뿐 관계 자체를 1 급 payload 로 내린 경로가 없었다), ② **같은 부모 row 를
   조인 경로와 비조인 경로로 나란히 재는 첫 페어**(`:id/persons` 는 membership 추출 후
   `PersonRepository.findById` loop 라 query 가 membership 수에 비례하고 `:id/members` 는 상수
   2 query 인데 같은 group id · 같은 seed 에서 두 route 를 한 spec 으로 잰다 — 대소 관계와
   규모별 증가율은 slice 3 선례대로 미단언이고 "상수 2 query" 자체는 slice 7 과 같아 새 축이
   아니다), ③ **복합 unique tuple 의 후행(non-prefix) 컬럼 단독 필터**(필터 컬럼 `groupId` 가
   `@@unique([personId, groupId])` 의 두 번째 컬럼이라 prefix 를 못 탄다 — slice 5 는 prefix 를
   탔고 slice 7 은 unique 선언 자체가 0 이었으므로 **선언된 unique index 가 있는데도 그 prefix 를
   못 타는 첫 경로** 다). 401 / 403 은 `GroupController` guard 미부착이라 구조적으로 부재하며
   slice 2·3 과 동일해 **새 축이 아니다**. 본 slice 는 mock 짝
   perf-spec(`group-members-read.perf-spec.ts`)이 존재하지 않는 첫 실 DB read slice 라 mock spec
   총수 변화가 **0** 이다. 표본은 membership 5 건 / 50 건 두 seed 와 반복 소수 회의 상대 비교용
   소규모 표본이라 REQ-047 의 실 scale 부하 검증이 아니다).
   그다음 slice 19(T-1537, main `9466d76d`) 의
   [`person-detail-read-realdb.perf-spec.ts`](../../test/perf/person-detail-read-realdb.perf-spec.ts)
   (11 test) 가 **이미 실측 도메인인 `PersonController` 의 단건 상세 조회 1 route**
   (`GET /api/persons/:id`) 를 실 부트스트랩으로 측정해 p95 < 3000ms 임을 실측했다
   (**slice 15·17·18 과 같은 셈법** 이라 endpoint 도메인은 **14 불변** 이고 조회 route 만
   **27 → 28** 로 늘며 `PersonController` 는 slice 1(T-1500) 에 이어 **두 번째로 재는
   controller** 다 — 구조 축 3 개 추가: ① **soft-delete 가시성 비대칭의 첫 실측**(같은 테이블을
   읽는데 목록 `findActive` 는 `active: true` 를 강제(REQ-026)해 비활성 row 를 감추는 반면 단건
   `findById` 는 그 필터가 없어 **200 + `active: false`** 로 노출된다 — 한 테이블의 목록 route 와
   단건 route 가 서로 다른 가시성 규칙을 갖는 첫 경로이며 본 문서는 그 현재 동작을 **판단 없이
   인용만** 한다), ② **목록 ↔ 단건 페어 측정**(같은 seed 상태에서 `GET /api/persons` 와
   `GET /api/persons/:id` 를 한 spec 으로 나란히 재는 첫 페어 — 두 p95 의 대소 관계는 slice 3
   선례대로 미단언), ③ **규모 축의 의미가 route 마다 갈린다는 관찰**(목록은 결과 집합이 규모에
   비례하지만 단건은 응답이 **1 row 고정** 이라 person 5 건 / 100 건 두 표본 모두 3000ms 미만만
   단언하고 증가율은 미단언). PK 직행 `findUnique` 는 slice 11·14 와, repository null → 404
   분기는 slice 11 과, guard 미부착(401 / 403 구조적 부재)은 slice 1·2·7 과 동일해 셋 다 **새 축이
   아니다**. 본 slice 는 mock 짝 perf-spec(`person-detail-read.perf-spec.ts`, T-0847)이 **실존**
   해 그 route 가 아래 인벤토리에서 **(B) 미측정 → (A) 실측완료 로 옮겨가는 첫 재분류 사례** 이고
   mock spec 총수 변화는 **0** 이다(slice 18 의 "mock 짝 부재" 와는 반대 상황이라 그 서술을 본
   slice 에 옮겨 적지 않는다). 표본은 person 5 건 / 100 건 두 seed 와 반복 소수 회의 상대 비교용
   소규모 표본이라 REQ-047 의 실 scale 부하 검증이 아니다).
   그다음 slice 20(T-1539, main `915f7859`) 의
   [`part-detail-read-realdb.perf-spec.ts`](../../test/perf/part-detail-read-realdb.perf-spec.ts)
   (12 test) 가 **이미 실측 도메인인 `PartController` 의 단건 상세 조회 1 route**
   (`GET /api/parts/:id`) 를 실 부트스트랩으로 측정해 p95 < 3000ms 임을 실측했다
   (**slice 15·17·18·19 와 같은 셈법** 이라 endpoint 도메인은 **14 불변** 이고 조회 route 만
   **28 → 29** 로 늘며 `PartController` 는 slice 7(T-1512) 에 이어 **두 번째로 재는
   controller** 다 — 구조 축 3 개 추가: ① **합성 route 의 구성 성분 query 를 분리해 재는 첫
   페어**(slice 7 이 잰 `:id/persons` 는 `PartService.findPersonsByPartId` 가 내부에서
   `this.findById(partId)` 를 먼저 호출한 뒤 자식 조회를 태우는 요청당 상수 2 query 경로인데,
   본 route 는 **그 첫 query 만 단독으로 노출된 route** 다 — slice 19 의 페어가 같은 테이블의
   집합 ↔ 단일 row 였던 것과 달리 본 페어는 **합성 경로 ↔ 그 부분 경로** 다), ② **404 를
   공유하는 두 route 의 거절 경로 관측**(두 route 의 404 가 같은 `findById` 의 null 분기
   **한 곳** 에서 나오고 자식 목록 route 의 404 도 자식 조회가 아니라 **부모 검증 query** 가
   낸다), ③ **규모 축이 자식 row 수인데 단건 응답은 무반응**(규모 축이 같은 테이블 총 row 수가
   아니라 자식 `Person` 수인데 `include` 0 이라 자식 0 건 Part 와 자식 40 건 Part 의 응답이
   **동일한 4 scalar 컬럼 형태** 로 고정돼 대소·증가율을 **미단언** 한다). PK 직행
   `findUnique` 는 slice 11·14·19 와, null → 404 분기는 slice 11·19 와, `include` 0 의 미조인
   SELECT 는 slice 11·19 와, guard 미부착(401 / 403 구조적 부재)은 slice 1·2·7·19 와 동일해
   넷 다 **새 축이 아니다**. 본 slice 도 mock 짝 perf-spec(`part-detail-read.perf-spec.ts`,
   T-0848)이 **실존** 해 그 route 가 아래 인벤토리에서 **(B) → (A) 로 옮겨가는 두 번째 재분류**
   이나, slice 19 와 달리 본 route 는 애초에 보수 분류 유보가 아니라 "slice 7 은 목록과
   `:id/persons` 만 쟀다" 는 확정 근거로 (B) 였다(mock spec 총수 변화는 **0**). 표본은 자식
   0 건 / 40 건 두 seed 와 반복 소수 회의 상대 비교용 소규모 표본이라 REQ-047 의 실 scale 부하
   검증이 아니다).
   그다음 slice 21(T-1541, main `212b82b9`) 의
   [`import-detail-read-realdb.perf-spec.ts`](../../test/perf/import-detail-read-realdb.perf-spec.ts)
   (11 test) 가 **이미 실측 도메인인 `ImportController` 의 job 단건 상세 조회 1 route**
   (`GET /api/admin/import/:id`) 를 실 부트스트랩으로 측정해 p95 < 3000ms 임을 실측했다
   (**slice 15·17·18·19·20 과 같은 셈법** 이라 endpoint 도메인은 **14 불변** 이고 조회 route 만
   **29 → 30** 으로 늘며 `ImportController` 는 slice 12(T-1522) 에 이어 **두 번째로 재는
   controller** 다 — 구조 축은 **1 개** 다: **같은 depth 의 정적 세그먼트 2 종(`modes` ·
   `running`)과 동적 `:id` 의 라우팅 우선순위 실측**(`@Get("running")` · `@Get("modes")` 가
   `@Get(":id")` **앞에** 선언돼 문자열 `"modes"` / `"running"` 을 id 자리에 넣어도 404 가
   아니라 **정적 route 가 이겨 200** 이 되므로 **`:id` 로는 도달 불가능한 id 공간이 존재** 한다
   — slice 10 의 `ExportController` 는 같은 depth 정적이 `running` 1 종이라 **2 종** 대상은 본
   slice 가 처음이고, 본 문서는 그 선언 순서를 **판단 없이 인용만** 한다). `findUniqueOrThrow`
   의 P2025 → 404 변환은 slice 10 과, `JobStatus` enum 4 상태 표본도 slice 10 과,
   `@Roles("Admin")` guard 레벨 401 / 403 layer 는 slice 10·11·12 와, PK 직행 단건 조회는
   slice 11·14·19·20 과, 한 controller 의 조회 route 전량 실측 도달은 slice 18·19·20 과 동일해
   다섯 다 **새 축이 아니다**. 본 slice 도 mock 짝 perf-spec(`import-detail-read.perf-spec.ts`)
   이 **실존** 해 그 route 가 아래 인벤토리에서 **(B) → (A) 로 옮겨가는 세 번째 재분류** 이고
   (mock spec 총수 변화는 **0**), slice 12 가 `no-such-job-id` **404 negative 로만** 두드려
   아래 **보수 분류** 로 유보돼 있던 자리를 happy-path 로 해소한 것이라 **보수 분류 유보 해소로는
   slice 19 에 이은 두 번째** 다. 표본은 `JobStatus` 4 값 혼재 job **4 row** 수준과 반복 소수
   회의 상대 비교용 소규모 표본이라 REQ-047 의 실 scale 부하 검증이 아니다).
   그다음 slice 22(T-1543, main `56771076`) 의
   [`app-root-read-realdb.perf-spec.ts`](../../test/perf/app-root-read-realdb.perf-spec.ts)
   (11 test) 가 **`AppController` 의 root health read 1 route**(`GET /api`) 를 mock override 0 인
   실 부트스트랩으로 측정해 p95 < 3000ms 임을 실측했다(**slice 16 과 같은 셈법** 이라 endpoint
   도메인이 **14 → 15**, 조회 route 가 **30 → 31** 로 **둘 다 +1** 이다 — slice 15·17·18·19·20·21 의
   "도메인 불변 · route 만 +1" 셈법이 아니다. 구조 축은 **2 개** 다: ① **DB 미접촉 route 의
   latency floor**(`getRoot()` 이 상수 `APP_STATUS_MESSAGE` 를 동기 반환할 뿐이라 실 Prisma 연결이
   살아 있어도 요청 경로가 DB 를 **전혀 건드리지 않으므로** 같은 harness 조건에서의 **framework +
   HTTP 왕복만의 하한** 이자 slice 1~21 p95 의 대조 기준선 — DB 미접촉은 전량 truncate 전 / 후
   응답 불변으로 실증), ② **guard layer 가 아예 없는 첫 실 DB slice**(`JwtAuthGuard` ·
   `RolesGuard` 미적용이라 쿠키 없이도 200 · 변조 쿠키도 200 · User tier 도 200 — 본 문서는 현재
   동작을 **판단 없이 인용만** 하며 결함 · 보안 재판정이 아니다). collector / assert 배선 ·
   `p95MaxMs: 0` 주입 fail 분기 · 인위 non-2xx errorRate 분기 · `buildBaselineReport` 관찰 전용은
   slice 1~21 과 동일해 넷 다 **새 축이 아니다**. 본 slice 도 mock 짝 perf-spec
   (`app-root-read.perf-spec.ts`, T-0859) 이 **실존** 해 그 route 가 아래 인벤토리에서 **(B) → (A)
   로 옮겨가는 네 번째 재분류** 이나(mock spec 총수 변화는 **0**), slice 19·21 과 달리 **보수 분류
   유보의 해소는 아니다** — `app-root-read` 는 애초에 유보가 아니라 "mock spec 실존 + 실측 도메인
   14 개에 `AppController` 부재" 라는 **확정 근거** 로 (B) 였다. 표본은 반복 소수 회의 상대 비교용
   소규모이고 **본 route 는 DB 를 접촉조차 하지 않아** REQ-047 의 실 scale 부하 축과 무관하다).
   이어 slice 23(T-1545, main `68d319e8`) 의
   [`person-list-scale-realdb.perf-spec.ts`](../../test/perf/person-list-scale-realdb.perf-spec.ts)
   (8 test) 가 slice 1 과 **같은 route**(`GET /api/persons`) 를 **20 row(소규모) vs 200 row(대규모)**
   두 표본과 `active` 120 / `inactive` 80 혼합 표본으로 재어 **p95 < 3000ms** 를 유지함을 실측했다 —
   구조 축은 ① **같은 route 의 테이블 총 row 수 규모**(slice 3 의 규모 축은 요청당 query 수가 늘어나는
   N+1 축이었으나 `findActive` 는 단일 SELECT 라 query 수가 1 로 고정이고 **결과 집합 크기(직렬화 ·
   전송 비용)** 만 커진다 — 목록 route 자체의 총 row 수를 키운 첫 사례) 와 ② **필터 선택도**(응답
   row 수 120 과 스캔 대상 200 이 분리되는 축의 첫 실 DB 증거) **2 개** 이고, collector / assert 배선 ·
   `p95MaxMs: 0` 주입 fail 분기 · 인위 non-2xx errorRate 분기 · `buildBaselineReport` 관찰 전용은
   slice 1~22 와 동일해 넷 다 **새 축이 아니다**. 두 표본의 **대소 관계는 wall-clock 비결정성 때문에
   단언하지 않는 관찰 기록** 이며(slice 3 과 동일), 그 “대규모” 200 row 도 **상대 비교용 소규모 표본**
   이라 REQ-047 의 실 scale 부하 검증이 아니다(person row 수만 키웠을 뿐 repo · confluence page ·
   1h 배치 시간 축은 부재다). slice 23 은 slice 1 이 이미 실측한 route 라 **실측 범위 15 endpoint
   (조회 31 route) 가 불변** 이고 아래 인벤토리의 (A) 30 / (B) 0 / (C) 0 도 전부 불변이다.
   이어 slice 24(T-1547, main `723441cd`) 의
   [`assessment-list-scale-realdb.perf-spec.ts`](../../test/perf/assessment-list-scale-realdb.perf-spec.ts)
   (8 test) 가 slice 4 와 **같은 route**(`GET /api/assessments`) 를 **10 row(소규모) vs 200 row(대규모)**
   두 표본으로, 타 person **150 row** 를 섞은 상태에서 `?personId=` 단독과 `?personId=&period=week`
   두 갈래로 재어 **p95 < 3000ms** 를 유지함을 실측했다 — 질적 차이는 ① 앞선 규모 축 slice 3 · 23 의
   controller 가 **둘 다 guard 미부착** 이었던 것과 달리 `JwtAuthGuard` + `RolesGuard` +
   `@Roles("User")` 를 실 JWT 로 통과하는 **인증 · 인가 layer 경유 첫 규모 축** 이라는 점과, ② 필터가
   `@@index([personId, period, periodStart])` 의 **prefix 2 단**(타 person 150 row 배제 → `period=week`
   로 재차 축소) 이라 "테이블 총 row 350 은 크고 응답은 작다" 를 index 경유로 만든 첫 표본이라는 점
   **2 개** 이고, collector / assert 배선 · `p95MaxMs: 0` 주입 fail 분기 · 인위 non-2xx errorRate 분기 ·
   `buildBaselineReport` 관찰 전용 · 401 guard 생존 확인은 slice 1~23 과 동일해 **새 축이 아니다**.
   두 표본의 **대소 관계도 wall-clock 비결정성 때문에 단언하지 않는 관찰 기록** 이며(slice 3 · 23 과
   동일), 그 “대규모” 200 row(+ 타 person 150 row) 도 **상대 비교용 소규모 표본** 이라 REQ-047 의
   실 scale 부하 검증이 아니다(assessment row 수만 키웠을 뿐 repo · confluence page · 1h 배치 시간
   축은 부재다). slice 24 도 slice 4 가 이미 실측한 route 라 **실측 범위 15 endpoint (조회 31 route)
   가 불변** 이고 인벤토리 (A) 30 / (B) 0 / (C) 0 도 전부 불변이라 **재분류 0 이 slice 23 에 이어
   2 연속** 이다.
   이어 slice 25(T-1549, main `cb8cc456`) 의
   [`summary-measure-confirm-realdb.perf-spec.ts`](../../test/perf/summary-measure-confirm-realdb.perf-spec.ts)
   (11 test) 가 slice 6 과 **같은 route**(`GET /api/summaries?personId=`) 를 **다른 harness** 로 재어
   `measureAndConfirmBaseline` 의 measure → confirm-or-compare top loop 를 **실 JWT cookie 호출의 실
   Postgres round-trip 위에서 처음** 성립시켰다 — 기준 baseline 부재의 **established(최초 확정 write)**
   와 존재 시의 **compared(로드 · 비교)** 두 국면을 모두 도달시키고 **p95 < 3000ms** 를 유지함을
   실측했으며, mock 짝 `summary-measure-confirm.perf-spec.ts`(T-0880) 와 **같은 harness · 다른
   backend**, slice 6 과 **같은 route · 다른 harness** 라 mock ↔ 실 DB 1:1 대조 쌍이 성립한다.
   이것이 잔여 축 (c) **baseline 확정에 대한 첫 진입** 이지만 **축의 해소가 아니다** — 그 baseline 은
   **임시 디렉토리 1 회성** 이라 저장소 체크인 기준 baseline 파일 확정(아래 #5) · CI job 편입(#4) ·
   임계 fix 는 **전부 미착수 그대로** 다. 두 run 의 대소 관계도 `comparison.regressed` 값도
   **단언하지 않는 관찰 기록** 이고, collector / assert 배선 · `p95MaxMs: 0` 주입 fail 분기 · 인위
   non-2xx errorRate 분기 · 401 guard 생존 확인은 slice 1~24 와 동일해 **새 축이 아니다**. slice 25 도
   slice 6 이 이미 실측한 route 라 **실측 범위 15 endpoint (조회 31 route) 가 불변** 이고 인벤토리
   (A) 30 / (B) 0 / (C) 0 도 전부 불변이라 **재분류 0 이 slice 23 · 24 에 이어 3 연속** 이며, 애초에
   **규모 축 slice 가 아니라**(표본 규모 비교가 아니라 baseline loop 배선) 소규모 seed 위의 측정이라
   REQ-047 의 실 scale 부하 검증이 아니다.
   이어 slice 26(T-1551, main `91a11dc3`) 의
   [`assessment-measure-confirm-realdb.perf-spec.ts`](../../test/perf/assessment-measure-confirm-realdb.perf-spec.ts)
   (11 test) 가 slice 25 가 연 **baseline 확정 축의 두 번째 route** 로서 같은
   `measureAndConfirmBaseline` harness 를 `GET /api/assessments?personId=&period=`(slice 4 · 24 와
   **같은 route · 다른 harness**) 로 넓혀, measure → confirm-or-compare top loop 의
   **established(최초 확정 write)** 와 **compared(로드 · 비교)** 양 국면을 실 JWT cookie 호출의 실
   Postgres round-trip 위에서 성립시키고 **p95 < 3000ms** 를 유지함을 실측했다 — 고유 축은
   **`period` optional query 분기의 첫 실 DB baseline 배선** 이다(slice 25 의 route 는 `personId`
   단일 필수 param 뿐이었으나 본 route 는 `period` 지정 / 미지정 두 요청이 서로 다른 service 위임
   경로를 타고, seed 를 **미지정 5 건 · `period=week` 3 건** 으로 달리 잡아 그 분기를 **양 국면
   모두** 에서 대조했으며, **관찰 전용** 이던 slice 4 · 24 및 mock 짝
   `assessment-measure-confirm.perf-spec.ts`(T-0882) 와 대조 쌍이 성립한다). 이는 잔여 축 (c) 의
   **첫 진입이 아니라 두 번째 route** 이고 **축의 해소도 아니다** — 그 baseline 도 **임시 디렉토리
   1 회성** 이라 저장소 체크인 기준 baseline 파일 확정(아래 #5) · CI job 편입(#4) · 임계 fix 는
   **전부 미착수 그대로** 다. 두 run 의 대소 관계도 `comparison.regressed` 값도 **단언하지 않는
   관찰 기록** 이고, collector / assert 배선 · `p95MaxMs: 0` 주입 fail 분기 · 인위 non-2xx errorRate
   분기 · 401 guard 생존 확인은 slice 1~25 와 동일해 **새 축이 아니다**. slice 26 도 slice 4 가 이미
   실측한 route 라 **실측 범위 15 endpoint (조회 31 route) 가 불변** 이고 인벤토리 (A) 30 / (B) 0 /
   (C) 0 도 전부 불변이라 **재분류 0 이 slice 23 · 24 · 25 에 이어 4 연속** 이며, 애초에 **규모 축
   slice 가 아니라**(표본 규모 비교가 아니라 baseline loop 배선) 소규모 seed 위의 측정이라 REQ-047 의
   실 scale 부하 검증이 아니다.
   이어 slice 27(T-1553, main `856687bf`) 의
   [`contribution-measure-confirm-realdb.perf-spec.ts`](../../test/perf/contribution-measure-confirm-realdb.perf-spec.ts)
   (11 test) 가 slice 25 가 열고 slice 26 이 이어받은 **baseline 확정 축의 세 번째 route** 로서 같은
   `measureAndConfirmBaseline` harness 를 `GET /api/contributions?assessmentId=`(slice 5 와 **같은
   route · 다른 harness**) 로 넓혀, measure → confirm-or-compare top loop 의 **established(최초 확정
   write)** 와 **compared(로드 · 비교)** 양 국면을 실 JWT cookie 호출의 실 Postgres round-trip 위에서
   성립시키고 **p95 < 3000ms** 를 유지함을 실측했다 — 고유 축은 **`Person → Assessment →
   Contribution` 3-level FK chain 의 첫 실 DB baseline 배선** 이다(앞 두 slice 의 대상은 person 기준
   1~2 단계 조회였으나 본 route 는 **부모 `Assessment` 의 id 로 자식 컬렉션을 긁는** 구조이고, 부모
   A **5 건** · 부모 B **3 건** 두 표본으로 부모 필터의 분해력을 **양 국면 모두** 에서 대조했으며,
   **관찰 전용** 이던 slice 5 및 mock 짝 `contribution-measure-confirm.perf-spec.ts`(T-0883) 와 대조
   쌍이 성립한다). 이는 잔여 축 (c) 의 **첫 진입도 두 번째도 아닌 세 번째 route** 이고 **축의 해소도
   아니다** — 그 baseline 도 **임시 디렉토리 1 회성** 이라 저장소 체크인 기준 baseline 파일
   확정(아래 #5) · CI job 편입(#4) · 임계 fix 는 **전부 미착수 그대로** 다. 두 run 의 대소 관계도
   `comparison.regressed` 값도 **단언하지 않는 관찰 기록** 이고, collector / assert 배선 ·
   `p95MaxMs: 0` 주입 fail 분기 · 인위 non-2xx errorRate 분기 · 401 guard 생존 확인은 slice 1~26 과
   동일해 **새 축이 아니다**. slice 27 도 slice 5 가 이미 실측한 route 라 **실측 범위 15 endpoint
   (조회 31 route) 가 불변** 이고 인벤토리 (A) 30 / (B) 0 / (C) 0 도 전부 불변이라 **재분류 0 이
   slice 23 · 24 · 25 · 26 에 이어 5 연속** 이며, 애초에 **규모 축 slice 가 아니라**(부모 A 5 건 vs
   부모 B 3 건은 규모 비교가 아니라 **부모 필터 분해력** 관측이다) 소규모 seed 위의 측정이라
   REQ-047 의 실 scale 부하 검증이 아니다.
   이어 slice 28(T-1555, main `4f444198`) 의
   [`app-root-measure-confirm-realdb.perf-spec.ts`](../../test/perf/app-root-measure-confirm-realdb.perf-spec.ts)
   (11 test) 가 slice 25 가 열고 slice 26 · 27 이 이어받은 **baseline 확정 축의 네 번째 route** 로서
   같은 `measureAndConfirmBaseline` harness 를 `AppController` 의 root health read `GET /api`(slice 22
   와 **같은 route · 다른 harness**) 로 넓혀, measure → confirm-or-compare top loop 의
   **established(최초 확정 write)** 와 **compared(로드 · 비교)** 양 국면을 실 `AppModule` 부트스트랩
   위에서 성립시키고 **p95 < 3000ms** 를 유지함을 실측했다 — 고유 축은 두 가지다. ① **DB 미접촉
   route 위의 첫 baseline 확정** — `getRoot()` 는 `AppService.getStatus()` 의 고정 상수를 동기 반환할
   뿐이라 실 Prisma 연결이 살아 있어도 요청 경로가 DB 를 **전혀 건드리지 않아**, 본 baseline 은
   **framework + HTTP 왕복만의 하한** 이고 앞 세 route 의 baseline 에서 "얼마가 DB 몫인가" 를 가늠할
   **대조 기준선** 이 된다(전량 truncate **전 / 후** 양쪽에서 established · compared 두 국면 도달 +
   200 · 상수 문자열 불변으로 실증했고, 같은 route 를 **collector 개별 배선** 으로만 쟀던 slice 22
   위에 top loop + 실 fs baseline round-trip 을 처음 태웠다). ② **guard layer 가 없는 첫
   measure→confirm 실 DB slice** — cookie 미부착도 변조 토큰 쿠키도 401 · 403 이 아니라 **200** 이라
   앞 세 slice 와 **정반대의 negative** 이고, 인접 미매칭 경로는 404(500 아님) · `POST /api` 도
   405 가 아닌 404 로 수렴한다. 이로써 measure→confirm mock spec **4 개(summary · assessment ·
   contribution · app-root) 전부** 가 실 DB 짝을 갖지만 이는 잔여 축 (c) 의 **네 번째 route** 일 뿐
   **축의 해소가 아니다** — 그 baseline 도 **임시 디렉토리 1 회성** 이라 저장소 체크인 기준 baseline
   파일 확정(아래 #5) · CI job 편입(#4) · 임계 fix 는 **전부 미착수 그대로** 다. 두 run 의 대소
   관계도 `comparison.regressed` 값도 **단언하지 않는 관찰 기록** 이고, collector / assert 배선 ·
   `p95MaxMs: 0` 주입 fail 분기 · 인위 non-2xx errorRate 분기는 slice 1~27 과 동일해 **새 축이
   아니다**. slice 28 도 slice 22 가 이미 실측한 route 라 **실측 범위 15 endpoint (조회 31 route) 가
   불변** 이고 인벤토리 (A) 30 / (B) 0 / (C) 0 도 전부 불변이라 **재분류 0 이 slice 23 · 24 · 25 ·
   26 · 27 에 이어 6 연속** 이며, 애초에 **규모 축 slice 가 아니라**(seed 자체가 불요한 DB 미접촉
   route 다) 소규모 표본 위의 측정이라 REQ-047 의 실 scale 부하 검증이 아니다.
   이어 slice 29(T-1557, main `b77e944e`) 의
   [`person-measure-confirm-realdb.perf-spec.ts`](../../test/perf/person-measure-confirm-realdb.perf-spec.ts)
   (11 test) 가 slice 25 가 열고 slice 26 · 27 · 28 이 이어받은 **baseline 확정 축의 다섯 번째
   route** 로서 같은 `measureAndConfirmBaseline` harness 를 `PersonController` 의 목록 조회
   `GET /api/persons`(slice 1 과 **같은 route · 다른 harness**) 로 넓혀, measure →
   confirm-or-compare top loop 의 **established(최초 확정 write)** 와 **compared(로드 · 비교)** 양
   국면을 `overrideGuard` **0** · mock **0** 의 `createE2EApp` 부트스트랩 위에서 성립시키고
   **p95 < 3000ms** 를 유지함을 실측했다 — 고유 축은 두 가지다. ① **guard 미부착 + DB 접촉
   조합 위의 첫 baseline 확정** — slice 25~27 은 guard 통과 + 실 Prisma 왕복이었고 slice 28 은
   guard 미부착 + **DB 미접촉** 의 framework + HTTP 왕복 하한이었던 데 반해, `PersonController` 는
   guard 가 없으면서 `findActive()` 가 실 SELECT 를 발화하므로 본 baseline 은 **인증 layer 노이즈 0
   인 순수 DB 왕복 몫** 을 담아 slice 28 의 floor 와 **같은 harness 위에서 대조** 된다(같은 route 를
   **collector 개별 배선** 으로만 쟀던 slice 1 위에 top loop + 실 fs baseline round-trip 을 처음
   태웠다). ② **soft-delete 필터의 두 국면(삭제 전 / 삭제 후) 을 established · compared 양쪽에서
   대조** — active 와 inactive 를 **서로 다른 개수** 로 섞어 seed 해 두 국면 모두 응답 길이가
   **active 수와 정확히 일치** 함으로 실 query 발화와 필터 분해력을 함께 보였다. 이는 잔여 축 (c) 의
   **다섯 번째 route** 일 뿐 **축의 해소가 아니다** — 그 baseline 도 **임시 디렉토리 1 회성** 이라
   저장소 체크인 기준 baseline 파일 확정(아래 #5) · CI job 편입(#4) · 임계 fix 는 **전부 미착수
   그대로** 다. 두 run 의 대소 관계도 `comparison.regressed` 값도 **단언하지 않는 관찰 기록** 이고,
   collector / assert 배선 · `p95MaxMs: 0` 주입 fail 분기 · 인위 non-2xx errorRate 분기는 slice 1~28
   과 동일해 **새 축이 아니다**. slice 29 도 slice 1 이 이미 실측한 route 라 **실측 범위 15 endpoint
   (조회 31 route) 가 불변** 이고 인벤토리 (A) 30 / (B) 0 / (C) 0 도 전부 불변이라 **재분류 0 이
   slice 23 · 24 · 25 · 26 · 27 · 28 에 이어 7 연속** 이며, 애초에 **규모 축 slice 가 아니라**
   (soft-delete 전 / 후 두 국면 대조는 규모 비교가 아니라 **필터 분해력** 관측이다) 소규모 seed 위의
   측정이라 REQ-047 의 실 scale 부하 검증이 아니다.
   slice 4·5·6·7·8·9·10·11·12·13·14 가 route 폭을 늘렸고 slice 16 과 slice 22 가 도메인과 route 를
   함께 늘렸으므로 실측 범위는
   **15 endpoint (조회 31 route)** 다(slice 9·13·14 는 route 를 1 개만, slice 10·11·12 는 각각
   2 개를 더하고, slice 15 는 도메인을 늘리지 않고 route 만 1 개, slice 16 은 도메인과 route 를
   각각 1 개씩 더하며, slice 17 은 다시 slice 15 와 같은 셈법으로 **도메인을 늘리지 않고 route
   만 1 개** 를 더하고, slice 18 도 **slice 15·17 과 같은 셈법으로 도메인을 늘리지 않고 route
   만 1 개** 를 더하며, slice 19 도 **slice 15·17·18 과 같은 셈법으로 도메인을 늘리지 않고
   route 만 1 개**(이미 실측 도메인 `PersonController` 를 두 번째로 재는 slice) 를 더하고,
   slice 20 도 **slice 15·17·18·19 와 같은 셈법으로 도메인을 늘리지 않고 route 만 1 개**(이미
   실측 도메인 `PartController` 를 두 번째로 재는 slice) 를 더하고, slice 21 도 **slice
   15·17·18·19·20 과 같은 셈법으로 도메인을 늘리지 않고 route 만 1 개**(이미 실측 도메인
   `ImportController` 를 두 번째로 재는 slice) 를 더하고, slice 22 는 다시 **slice 16 과 같은
   셈법으로 도메인과 route 를 각각 1 개씩**(도메인 14 에 없던 `AppController`) 를 더하지만, slice 23 은
   **도메인도 조회 route 도 늘리지 않는다** — 이 열거 안에서는 처음이고 slice 3 이래 두 번째 사례로,
   이미 실측한 route(`GET /api/persons`, slice 1) 를 **다른 축(규모 · 필터 선택도)** 으로 다시 잰
   slice 이기 때문이다. slice 24 도 같은 셈법으로 **도메인도 조회 route 도 늘리지 않아**(이미 실측한
   `GET /api/assessments`, slice 4 를 **규모 · index prefix 2 단 선택도** 축으로 다시 잰 slice)
   **재분류 0 이 2 연속** 이다. slice 25 도 같은 셈법으로 **도메인도 조회 route 도 늘리지 않아**(이미
   실측한 `GET /api/summaries`, slice 6 을 **measure→confirm baseline loop** 라는 다른 harness 로 다시
   잰 slice) **재분류 0 이 3 연속** 이다. slice 26 도 같은 셈법으로 **도메인도 조회 route 도 늘리지
   않아**(이미 실측한 `GET /api/assessments`, slice 4 를 **measure→confirm baseline loop** 라는 다른
   harness 로 다시 잰 slice) **재분류 0 이 4 연속** 이다. slice 27 도 같은 셈법으로 **도메인도 조회
   route 도 늘리지 않아**(이미 실측한 `GET /api/contributions?assessmentId=`, slice 5 를
   **measure→confirm baseline loop** 라는 다른 harness 로 다시 잰 slice) **재분류 0 이 5 연속** 이다.
   slice 28 도 같은 셈법으로 **도메인도 조회 route 도 늘리지 않아**(이미 실측한 `GET /api`, slice 22
   를 **measure→confirm baseline loop** 라는 다른 harness 로 다시 잰 slice) **재분류 0 이 6 연속** 이다.
   slice 29 도 같은 셈법으로 **도메인도 조회 route 도 늘리지 않아**(이미 실측한 `GET /api/persons`,
   slice 1 을 **measure→confirm baseline loop** 라는 다른 harness 로 다시 잰 slice) **재분류 0 이
   7 연속** 이다.
   정본
   서술 = [`test/perf/README.md`](../../test/perf/README.md) 의
   `## 실 DB round-trip baseline (slice 목록)`).
   단 **본 item 은 미완** — `buildBaselineReport` + `formatBaselineLine` 은 **관찰 전용**
   이고 `writeBaselineFile` / `confirmOrCompareBaseline` 는 **slice 25(T-1549) 와 slice 26(T-1551) 과
   slice 27(T-1553) 과 slice 28(T-1555) 과 slice 29(T-1557) 다섯 route 만 예외적으로
   `measureAndConfirmBaseline` 로 호출해 baseline 을 확정했을 뿐 그것도 다섯 다 임시 디렉토리
   1 회성** 이었다. 다만 저장소 체크인 기준 baseline 파일은 그 뒤 별도 slice 로 확정됐다 — `test/perf/baselines/` 아래 `measure→confirm` **5 route 전부**(`baseline-ci-realdb-person-read.json` · `-assessment-read` · `-contribution-read` · `-summary-read` · `-app-root-read`) 가
   T-1592/T-1594 · T-1601 · T-1603 · T-1605 · T-1607 순으로 체크인됐고, `.github/workflows/ci.yml` `perf test` step 의 `PERF_CHECKIN_BASELINE: "1"` 토글(T-1584) 로 CI 체크인 경로도 `absent`(skip) 이 아니라 `compared` 로 돈다.
   그럼에도 ADR-0056 `§Decision 3 (b)` 대로 상대 회귀는 **관찰만** 이고 exit code 는 불변이라 **본 item 은 여전히 미완** 이며, §3 의 "baseline 후 fix" 임계 fix(ADR-0056 `§Follow-ups (c)`) 도 미착수다.
   **잔여**: 임계 fix · 측정 endpoint 확대(나머지 read perf-spec 30 개는 service mock 잔존 —
   계산식은 read 51 개 − 실 DB read 21 개이며, slice 22 도 파일명에 `read` 가 있어 피감수(50→51)와
   감수(20→21)가 함께 1 씩 늘어 차이 30 은 불변이다 — `group-persons-scale-realdb` 는 파일명에
   `read` 가 없어 양쪽 모두에서 빠진다; slice 23 의 `person-list-scale-realdb` 도 같은 이유로 양쪽에서
   빠져 이번에는 **피감수도 감수도 늘지 않아** 51 − 21 = 30 이 식도 결과도 그대로다 — slice 3 에 이은
   두 번째 사례다; slice 24 의 `assessment-list-scale-realdb` 도 파일명에 `read` 가 없어 양쪽에서
   빠지므로 이번에도 51 − 21 = 30 이 **식도 결과도 그대로** 이며 slice 3 · 23 에 이은 **세 번째 사례**
   다; slice 25 의 `summary-measure-confirm-realdb` 도 파일명에 `read` 가 없어 양쪽에서 빠지므로
   51 − 21 = 30 이 또 **식도 결과도 그대로** 이며 slice 3 · 23 · 24 에 이은 **네 번째 사례** 다;
   slice 26 의 `assessment-measure-confirm-realdb` 도 파일명에 `read` 가 **없어** 양쪽에서 빠지므로
   이번에도 51 − 21 = 30 이 **식도 결과도 그대로** 이며 slice 3 · 23 · 24 · 25 에 이은 **다섯 번째
   사례** 다; slice 27 의 `contribution-measure-confirm-realdb` 도 파일명에 `read` 가 **없어** 양쪽에서
   빠지므로 이번에도 51 − 21 = 30 이 **식도 결과도 그대로** 이며 slice 3 · 23 · 24 · 25 · 26 에 이은
   **여섯 번째 사례** 다; slice 28 의 `app-root-measure-confirm-realdb` 도 파일명에 `read` 가 **없어**
   양쪽에서 빠지므로 이번에도 51 − 21 = 30 이 **식도 결과도 그대로** 이며 slice 3 · 23 · 24 · 25 ·
   26 · 27 에 이은 **일곱 번째 사례** 다 — 늘어난 것은 `*.perf-spec.ts` 61 → 62 와 `*realdb*`
   27 → 28 뿐이다; slice 29 의 `person-measure-confirm-realdb` 도 파일명에 `read` 가 **없어** 양쪽에서
   빠지므로 이번에도 51 − 21 = 30 이 **식도 결과도 그대로** 이며 slice 3 · 23 · 24 · 25 · 26 ·
   27 · 28 에 이은 **여덟 번째 사례** 다 — 늘어난 것은 `*.perf-spec.ts` 62 → 63 과 `*realdb*`
   28 → 29 뿐이다)
   · **다른 endpoint(slice 5 의 contribution
   fan-out · slice 6 의 summary 시계열 조회 · slice 7 의 part 소속 조회 · slice 8 의 user 목록
   무필터 전량 SELECT · slice 9 의 permission-denied audit 목록 · slice 10 의 export job
   polling · slice 11 의 LLM provider config 조회 · slice 12 의 import job polling 과 modes
   조회 · slice 13 의 difficulty mapping 고정 슬롯 조회 · slice 14 의 auth me self 조회 ·
   slice 15 의 export status-view 파생 조회 · slice 16 의 cron schedule 레지스트리 조회 ·
   slice 17 의 export dump download 조회 · slice 18 의 group membership 조회 ·
   slice 19 의 person 단건 상세 조회 · slice 20 의 part 단건 상세 조회 ·
   slice 21 의 import job 단건 상세 조회 · slice 22 의 `GET /api` root read
   포함 — 다만 slice 13 의 대상은
   `@@unique([difficulty])` 3 슬롯 상한이라 규모가 schema 로 bounded 여서 **규모 축의 의미가
   다르고**, slice 14 의 대상은 결과 집합이 **actor 자신 1 row 로 고정** 이라 **규모 축 자체가
   성립하지 않으며**, slice 15 의 대상도 결과 집합이 **단건 1 row 고정** 이라 규모 축이 row
   수가 아니라 **`JobStatus` 값의 종류(4 값)** 로만 갈리고, slice 16 의 대상은 규모 축이
   **DB row 수가 아니라 registry 등록 수** 라 slice 16 이 **등록 0 건 / 4 건 두 표본으로 이미
   관측**(대소 관계는 미단언)했으므로 DB 규모 민감도 축 자체가 성립하지 않고, slice 17 의
   대상은 규모 축이 **응답 크기가 아니라 총 DB row 수** 라 slice 17 이 **소규모 seed / 상대적
   대규모 seed 두 표본으로 이미 관측**(대소 관계와 byte 증가량은 미단언)했으나 그 두 표본도
   **REQ-047 실 scale 부하와는 무관한 소규모 표본** 이라 규모 축이 해소된 것은 아니고, slice 18 의
   대상도 membership **5 건 / 50 건 두 표본을 관측 기록으로만** 남겼을 뿐(대소 관계·증가율
   미단언) 그 두 표본 역시 **REQ-047 실 scale 부하와는 무관한 소규모 표본** 이라 규모 축이
   해소되지 않았으며, slice 19 의 대상은 응답이 **1 row 고정** 이라 규모 축의 의미 자체가 목록
   route 와 달라 person **5 건 / 100 건 두 표본을 관측 기록으로만** 남겼을 뿐(대소 관계·증가율
   미단언) 그 두 표본 또한 **REQ-047 실 scale 부하와는 무관한 소규모 표본** 이며, slice 20 의
   대상은 규모 축이 **같은 테이블 총 row 수가 아니라 자식 `Person` 수** 인데 `include` 0 이라
   응답이 자식 fan-out 에 **반응하지 않아** 자식 **0 건 / 40 건 두 표본을 관측 기록으로만**
   남겼을 뿐(대소·증가율 미단언) 그 두 표본 역시 **REQ-047 실 scale 부하와는 무관한 소규모
   표본** 이고, slice 21 의 대상도 응답이 **단건 1 row 고정** 이라 규모 축을 별도 표본으로 재지
   않았으며 그 표본(job **4 row** 수준 · 반복 소수 회)도 **REQ-047 실 scale 부하와는 무관한
   소규모** 라 규모 축이 해소된 것이 아니고, slice 22 의 대상은 응답이 **DB 를 접촉하지 않는 상수
   문자열** 이라 **규모 축 자체가 성립하지 않으므로** 규모 축이 해소된 것으로 읽어서는 안 되며,
   slice 23 의 대상은 slice 1 과 **같은 route** 라 본 목록의 “다른 endpoint” 가 아니고 총 row 수
   **20 vs 200** 과 **필터 선택도**(active 120 / inactive 80) 두 축으로 규모 축을 실측했으나 그 표본
   역시 **REQ-047 실 scale 부하와는 무관한 소규모** 라 규모 축이 해소된 것은 아니며, slice 24 의
   대상도 slice 4 와 **같은 route** 라 본 목록의 “다른 endpoint” 가 아니고 **10 vs 200 row** 와
   **index prefix 2 단 선택도**(타 person 150 row 배제 → `period=week`) 두 갈래로 규모 축을 실측했으나
   그 표본 역시 **REQ-047 실 scale 부하와는 무관한 소규모** 라 규모 축이 해소된 것은 아니고,
   slice 25 의 대상도 slice 6 과 **같은 route** 라 본 목록의 "다른 endpoint" 가 아닐뿐더러 애초에
   **규모 축 slice 가 아니어서**(표본 규모 비교가 아니라 baseline loop 배선) 규모 축을 넓히지
   않으며, slice 26 의 대상도 slice 4 · 24 와 **같은 route** 라 본 목록의 "다른 endpoint" 가 아니고
   같은 이유로 **규모 축 slice 가 아니어서** 규모 축을 넓히지 않는다(대상이 slice 24 의 규모 축
   route 와 같다는 사실을 "규모 축이 넓어졌다" 로 읽지 않는다), slice 27 의 대상도 slice 5 와
   **같은 route** 라 본 목록의 "다른 endpoint" 가 아니고 마찬가지로 **규모 축 slice 가 아니어서**
   규모 축을 넓히지 않는다(부모 A **5 건** vs 부모 B **3 건** 은 규모 표본이 아니라 **부모 필터
   분해력** 관측이므로 "규모 민감도 표본" 으로 읽지 않는다), slice 28 의 대상도 slice 22 와
   **같은 route** 라 본 목록의 "다른 endpoint" 가 아니고 마찬가지로 **규모 축 slice 가 아니어서**
   규모 축을 넓히지 않는다(seed 자체가 불요한 **DB 미접촉 route** 라 규모 축이 애초에 성립하지
   않는다) —
   미측정
   목록에 통째로 넣어 오독하지도, 해소된 것처럼 읽지도 않는다) 의
   규모 민감도**(규모 축 실측은 `:id/persons` · `GET /api/persons` · `GET /api/assessments`
   **세 route 에 도달** — slice 23 이 목록 route 자체의 **테이블 총 row 수 20 vs 200** 과 **필터
   선택도**(active 120 / inactive 80) 축을 더해 1 → 2 route 로, slice 24 가 **인증 · 인가
   layer(`JwtAuthGuard` + `RolesGuard` + `@Roles("User")`) 를 통과하는 첫 규모 축** 과 **composite
   index prefix 2 단 선택도**(타 person 150 row 배제 → `period=week` 로 재차 축소, 총 row 350 대비
   응답은 소규모) 축을 더해 2 → 3 route 로 넓혔다. **slice 25 도 slice 26 도 slice 27 도 slice 28 도
   규모 축 slice 가 아니라 baseline loop 배선이므로 이 세 route 를 늘리지 않는다**(slice 26 의 대상이
   slice 24 의 규모 축 route 와 같더라도 잰 축이 달라 규모 축은 **3 route 그대로** 이고, slice 27 의
   부모 A 5 건 vs 부모 B 3 건도 규모 표본이 아니라 부모 필터 분해력 관측이라 역시 **3 route
   그대로** 이며, slice 28 은 **seed 자체가 불요한 DB 미접촉 route** 라 규모 축이 애초에 성립하지
   않아 이번에도 **3 route 그대로** 다; slice 29 도 규모 축 slice 가 아니라 soft-delete 전 / 후 두
   국면을 대조한 **필터 분해력** 관측이라 그 두 국면을 "규모 민감도 표본" 으로 읽지 않으며
   역시 **3 route 그대로** 다 — "규모 축이 4 route 로 늘었다" 로 읽지 않는다). 다만 **규모 축이 해소된 것은
   아니다** — 나머지
   endpoint 는 여전히 미측정이고, 세 route 의 표본 모두 상대 비교용 **소규모** 이며, 두 표본의 대소
   관계는 **wall-clock 비결정성 때문에 미단언** 이다).

   **잔여 read route 인벤토리 (slice 29 시점 확인분, T-1536 작성 → T-1558 갱신)** — 바로 위 `**잔여**` 의 "mock 잔존
   read perf-spec 30 개" 를 **route 단위** 로 펼친 backlog 다. slice 목록의 **정본은
   [`test/perf/README.md`](../../test/perf/README.md) 의 `## 실 DB round-trip baseline (slice 목록)`**
   이고 본 절은 **plan 측 backlog (정본의 파생)** 이라 둘이 어긋나면 **정본이 이긴다** (본 인벤토리
   작성은 정본 파일을 수정하지 않았다 — 인용만 했다). 아래 개수는 모두 편집 전 실측값이다 —
   `test/perf/*.perf-spec.ts` **63** · `*read*` **51** · `*realdb*` **29** · `*read*realdb*` **21**.
   범위는 **read (조회) route 한정** 이며 write / trigger route 의 부하 측정은 §5 의 다른 item
   소관이라 여기서 목록화하지 않는다.

   **(A) route 는 실 DB 실측 완료 · mock spec 만 잔존 — 30 개 (잔여 slice 후보 아님)**
   (spec 이름은 `.perf-spec.ts` 접미 생략)

   | mock spec | route | 실측 slice (realdb spec) |
   | --- | --- | --- |
   | `person-read` | `GET /api/persons` | slice 1 (`person-read-realdb`) |
   | `group-read` | `GET /api/groups` | slice 2 (`group-read-realdb`) |
   | `group-detail-read` | `GET /api/groups/:id` | slice 2 (`group-read-realdb`) |
   | `group-persons-read` | `GET /api/groups/:id/persons` | slice 2·3 (`group-read-realdb` · `group-persons-scale-realdb`) |
   | `assessment-read` | `GET /api/assessments?personId=&period=` | slice 4 (`assessment-read-realdb`) |
   | `assessment-detail-read` | `GET /api/assessments/:id` | slice 4 (`assessment-read-realdb`) |
   | `contribution-read` | `GET /api/contributions?assessmentId=` | slice 5 (`contribution-read-realdb`) |
   | `contribution-detail-read` | `GET /api/contributions/:id` | slice 5 (`contribution-read-realdb`) |
   | `summary-read` | `GET /api/summaries?personId=` | slice 6 (`summary-read-realdb`) |
   | `summary-detail-read` | `GET /api/summaries/:id` | slice 6 (`summary-read-realdb`) |
   | `part-read` | `GET /api/parts` | slice 7 (`part-read-realdb`) |
   | `part-persons-read` | `GET /api/parts/:id/persons` | slice 7 (`part-read-realdb`) |
   | `user-read` | `GET /api/users` | slice 8 (`user-read-realdb`) |
   | `user-detail-read` | `GET /api/users/:id` | slice 8 (`user-read-realdb`) |
   | `permission-denied-read` | `GET /api/permission-denied-records` | slice 9 (`permission-denied-read-realdb`) |
   | `export-running-read` | `GET /api/admin/export/running` | slice 10 (`export-read-realdb`) |
   | `export-detail-read` | `GET /api/admin/export/:id` | slice 10 (`export-read-realdb`) |
   | `llm-provider-config-read` | `GET /api/llm/providers` | slice 11 (`llm-provider-config-read-realdb`) |
   | `llm-provider-config-detail-read` | `GET /api/llm/providers/:id` | slice 11 (`llm-provider-config-read-realdb`) |
   | `import-modes-read` | `GET /api/admin/import/modes` | slice 12 (`import-read-realdb`) |
   | `import-running-read` | `GET /api/admin/import/running` | slice 12 (`import-read-realdb`) |
   | `difficulty-mapping-read` | `GET /api/llm/difficulty-mappings` | slice 13 (`difficulty-mapping-read-realdb`) |
   | `auth-me-read` | `GET /api/auth/me` | slice 14 (`auth-me-read-realdb`) |
   | `export-status-view-read` | `GET /api/admin/export/:id/status-view` | slice 15 (`export-status-view-read-realdb`) |
   | `cron-schedule-read` | `GET /api/schedules` | slice 16 (`cron-schedule-read-realdb`) |
   | `export-download-read` | `GET /api/admin/export/:id/download` | slice 17 (`export-download-read-realdb`) |
   | `person-detail-read` | `GET /api/persons/:id` | slice 19 (`person-detail-read-realdb`) |
   | `part-detail-read` | `GET /api/parts/:id` | slice 20 (`part-detail-read-realdb`) |
   | `import-detail-read` | `GET /api/admin/import/:id` | slice 21 (`import-detail-read-realdb`) |
   | `app-root-read` | `GET /api` | slice 22 (`app-root-read-realdb`) |

   (A) 부류 mock spec 을 **retire · 삭제 · 통합할지는 별도 판단** 이며 본 절은 그 판단을 하지 않는다
   (`test/` 변경이라 `pr` 이고, "배선 latency 만 재는" mock 고유 책임이 남아 있는지부터 따져야 한다).

   **(B) route 미측정 · mock spec 존재 — 0 개**

   slice 22(T-1543) 가 마지막 1 건이던 `app-root-read` → `GET /api` 를 실측해 (A) 로 옮기면서
   **현 시점 이 목록에 남은 (B) 후보는 0 건** 이다. 이는 **본 인벤토리가 열거한 범위 안에서** 그렇다는
   뜻일 뿐 잔여가 소진됐다는 뜻이 아니다 — 본 절은 완전 열거를 주장하지 않고((C) 절 참조),
   (A) 부류 mock spec 30 개의 retire 판단은 미착수이며, write / trigger route 는 애초에 이 목록
   밖이다. 다음 slice 후보를 어디서 고를지는 별도 판단 몫이다.

   **보수 분류 표기** — **현재 보수 분류 잔여는 0 건** 이다. `import-detail-read` 는 realdb spec 이 그
   path 를 두드리기는 하지만(slice 12 의 `no-such-job-id` 404) **errorRate fail 분기용 negative** 라
   happy-path 실측 근거를 못 찾아 T-1536 이 **추측 대신 (B) 로 보수 분류** 해 뒀었는데,
   **slice 21(T-1541) 이 `GET /api/admin/import/:id` 를 happy-path 로 실측하면서 그 유보가 해소** 돼
   (A) 로 옮겼다 — `person-detail-read` 에 이은 **두 번째 해소 사례** 다.
   `person-detail-read` 도 같은 이유(slice 1 의 부재 id 404 만 존재)로 T-1536 이 (B) 에 보수 분류해
   뒀으나, **slice 19(T-1537) 가 `GET /api/persons/:id` 를 happy-path 로 실측하면서 그 유보가 해소** 돼
   (A) 로 옮겼다 — 보수 분류는 근거가 생기면 이렇게 풀린다는 첫 선례다.

   **(C) perf-spec 자체가 없는데 미측정인 read route — 현 시점 확인분 0 건**

   `grep -rn "@Get(" src/**/*.controller.ts` sweep 기준 controller 20 개의 조회 route 는 **31 개**
   (`@Get` 이 0 인 write / trigger 전용 controller 5 개 제외) 이고, 이는 **실측 31 + (B) 0 = 31** 과
   맞물린다 — 즉 **현 시점 (C) 는 0 건** 이다. slice 18 의 `GET /api/groups/:id/members` 가 **(C) 였다가
   해소된 선례** 다(mock 짝이 없어 "mock 잔존 30" 셈에는 애초에 안 잡히는데 미측정이던 route —
   T-1534 의 "계수 함정 ②"). `AppController` 의 root read 는 (C) 후보로 보였으나
   `app-root-read.perf-spec.ts` 가 실존해 **(B) 로 분류** 했었고, **slice 22(T-1543) 의 실측으로 (A) 로
   옮겨갔다**. 본 절은 **완전 열거를 주장하지 않는다** —
   controller · route 가 늘면 다시 조사해야 하는 **현 시점 확인분** 일 뿐이다.

   **자체 검산** — `A + B = 30 + 0 = 30` 이고 위 `**잔여**` 의 계산식 `read 51 − 실 DB read 21 = 30`
   도 같은 **30** 이다. 앞은 **route 분류의 합**, 뒤는 **파일 glob 의 차** 라 **서로 다른 셈이 같은 수를
   가리키는** 교차 검증이 된다. 두 셈이 어긋나면 문서가 아니라 분류를 고친다.

   **오독 차단 — "mock 잔존 30 개" ≠ "잔여 slice 30 개"**. 30 은 **파일 계수** 일 뿐이고 실제 잔여
   cutover 후보는 **(B) + (C) = 0 + 0 = 0 route** 다((A) 로 1 건이 더 옮겨가 0 이 됐다고 해서 잔여가
   소진된 것은 아니다 — (A) 부류 mock spec 의 retire 판단은 여전히 미착수이고 write / trigger
   route 는 애초에 본 목록 밖이며, REQ-047 실 scale 부하 · baseline 확정 · 임계 fix · 시각화(web)
   렌더 측정 4 잔여 축은 그대로다). **규모 축이 slice 24 로 `:id/persons` · `GET /api/persons` ·
   `GET /api/assessments` 3 route 로 넓어진 것 역시 잔여 소진이 아니다** — 나머지 endpoint 의 규모
   민감도는 미측정이고 세 route 의 표본도 상대 비교용 소규모다(slice 25 도 slice 26 도 slice 27 도
   slice 28 도 규모 축 slice 가 아니라 3 route 그대로다 — slice 28 은 seed 자체가 불요한 **DB 미접촉
   route** 라 규모 축이 성립조차 하지 않는다). **slice 25 가 baseline 확정 축에 첫 진입 한 것 역시 잔여 소진이
   아니다** — 그 baseline 은 **임시 디렉토리 1 회성** 이라 저장소 체크인 기준 baseline · CI job 편입 ·
   임계 fix 는 전부 미착수다. **slice 26 이 그 축에 route 를 하나 더 더해 두 번째 route 가 된 것
   역시 잔여 소진이 아니다** — 그 baseline 도 임시 디렉토리 1 회성이라 위 세 미착수가 그대로다.
   **slice 27 이 다시 route 를 하나 더 더해 세 번째 route 가 된 것 또한 잔여 소진이 아니다** — 그
   baseline 역시 임시 디렉토리 1 회성이라 위 세 미착수가 그대로이고, route 가 3 개로 늘어난 사실을
   "잔여 축 (c) 해소" 로 읽지 않는다. **slice 28 이 네 번째 route 를 더해 measure→confirm mock spec
   4 개(summary · assessment · contribution · app-root) 전부가 실 DB 짝을 갖게 된 것 또한 잔여 소진이
   아니다** — 그 baseline 도 임시 디렉토리 1 회성이라 위 세 미착수가 그대로이고, "mock 짝이 다
   갖춰졌다" 를 "(c) 축 해소" 로 읽지 않는다. slice 28 은 애초에 **규모 축 slice 가 아니어서**(seed
   자체가 불요한 DB 미접촉 route) 규모 축은 여전히 **3 route** 이며 4 로 늘지 않는다.
   **slice 29 가 다섯 번째 route 를 더해 guard 미부착 + DB 접촉 조합에까지 baseline 이 놓인 것 또한
   잔여 소진이 아니다** — 그 baseline 도 임시 디렉토리 1 회성이라 위 세 미착수가 그대로이고,
   "guard × DB 조합의 빈 칸이 채워졌다" 를 "(c) 축 해소" 로 읽지 않는다. slice 29 도 애초에
   **규모 축 slice 가 아니어서**(soft-delete 전 / 후 두 국면 대조는 규모 비교가 아니라 필터 분해력
   관측이다) 규모 축은 여전히 **3 route** 이며 4 로 늘지 않는다. **(B) 0 은 이 인벤토리가 열거한 범위가 소진됐다는 뜻일 뿐 조회
   성능 검증이 완료됐다는 뜻이 아니다** — 근거는 넷이다: 본 절이 완전 열거를 주장하지 않고,
   (A) 30 개의 retire 판단이 미착수이며, write / trigger route 가 목록 밖이고, 위 4 잔여 축이 그대로
   존속한다. (A) 30 개는 route 가 이미 실측돼 잔여가 아니며,
   반대로 (C) 부류는 mock 짝이 없어 30 에 **애초에 안 잡히므로** 30 은 잔여의 상한도 하한도 아니다.

   본 인벤토리는 **측정 0 · 새 spec 0 · production code 0** 의 목록화라 REQ-048 재판정도
   REQ-047(100~200명 / 50~100 repo / ~1000 confluence page / 1h) 진전도 **아니다** — 위 item 5 의
   **미완** 서술(§3 "baseline 후 fix" 임계 fix 미착수 — 체크인 baseline 파일 자체는 T-1592/T-1594 ·
   T-1601 · T-1603 · T-1605 · T-1607 로 5 route 전부 확정됐다)과 규모 민감도 ·
   실 scale 부하 · 시각화(web) 렌더 측정 축 잔여는 **그대로 유효** 하다. 다음 slice 로 어느 route 를
   고를지의 **우선순위 부여도 본 절의 몫이 아니다**.

   **임계 재확정 규칙 pointer (T-1668)**: 본 item 의 S1 관찰용 p95 `1100ms` 를 언제 · 얼마나
   바꿀지는 위 `§3` 의 **"S1 관찰용 p95 게이트 재확정 규칙 (사전 박제, T-1668)"** 소절이
   정본이다(트리거 · 산정식 · 표본 취급 · doc/코드 split 집행 경로 4 항목) — 본 item 의 잔여
   ① · ② · ③ 표기는 그것과 무관하게 위 서술 그대로다.
