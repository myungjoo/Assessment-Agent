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

### S2. 조회 API 응답 지연 (REQ-048)

- **부하**: 이미 저장된 평가 결과에 대한 조회·시각화 read 요청을 반복(warm cache /
  cold 양쪽).
- **목표**: **p95 latency < 3s** (README line 92 "3초 이내"). p50 도 함께 관찰.
- **관찰**: p50 / p95 / p99 latency, throughput(req/s), error rate.
- **대상 endpoint**: 조회·시각화 read API(요약·평가 결과 조회 경로). 실제 대상 목록은
  harness 구현 시 [docs/architecture](../architecture) 의 API 뷰에서 확정.

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
| S1 평가 배치 부하 | 배치 실패·재시도율 | error rate < 1% (baseline 후 fix) | 내성 |
| S2 조회 지연 | p95 latency | < 3s | REQ-048 (README line 92) |
| S2 조회 지연 | p50 latency / throughput | baseline 후 fix (관찰용) | 관찰 |
| S2 조회 지연 | error rate | < 1% | 내성 |
| S3 동시성 내성 | error rate (동시성 단계별) | < 1% (baseline 후 fix) | graceful degradation |
| S3 동시성 내성 | p95 저하 곡선 | latency cliff 부재 | 내성 |

- **집계**: latency 는 percentile(p50/p95/p99), throughput 는 req/s 또는 배치/h, error
  rate 는 non-2xx / 전체.
- **환경 고정**: 측정 결과는 실행 환경(CPU/메모리/DB/네트워크)에 종속되므로, 각 run 은
  환경 메타(하드웨어·동시성·데이터 규모)를 함께 기록해 비교 가능하게 한다.

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
  있어, 순수 서버 처리량 측정 시 stub / record-replay / 격리 endpoint 를 선행 설계해야
  한다(도구 ADR 에서 함께 결정).

---

## 5. Follow-up 인덱스

본 문서는 계획만 담는다. 실제 실행은 아래를 후속 task 후보로 나열한다(순서는 의존성 기준).

1. **부하 도구 선택 ADR** (pr-mode + 신규 dependency, 사람 승인) — k6 / artillery /
   autocannon 중 택1, trade-off·격리 endpoint 전략 박제. [CLAUDE.md §5](../../CLAUDE.md)
   BLOCKED 해소 전제.
2. **S2 조회 latency 경량 harness** (supertest 기반, 신규 dependency 불요 가능) — 위 1
   과 독립적으로 먼저 착수 가능한 최소 measure.
3. **S1 / S3 부하 harness 구현** — 1 의 도구 결정 후. 배치 부하·동시성 내성 스크립트.
4. **CI 통합** — 부하 harness 를 `.github/workflows/` 에 별도 job(정기/수동 trigger)으로
   편입. 상시 PR CI 와 분리(부하는 무거움).
5. **baseline 확정 + 임계 fix** — 최초 실측으로 §3 의 "baseline 후 fix" 임계를 실 수치로
   확정하고 본 문서를 갱신.
