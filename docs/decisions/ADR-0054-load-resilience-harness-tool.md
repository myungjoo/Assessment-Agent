---
id: ADR-0054
title: 부하·내성 harness 도구 선택 — k6 권고 (권고만, dependency 도입은 owner 승인 후 별도 task)
status: PROPOSED
date: 2026-07-08
relatedTask: [T-0827]
relatedReq: [REQ-047, REQ-048]
supersedes: null
---

# ADR-0054 — 부하·내성 harness 도구 선택

## Status

**PROPOSED**. 본 ADR 은 부하·내성 harness 의 도구를 **권고만** 한다. 실제 dependency
도입(`package.json` 변경)은 [CLAUDE.md](../../CLAUDE.md) §5 (새 외부 dependency 추가 =
BLOCKED → owner 승인 → ADR) 룰에 따라 owner 승인 후 **별도 pr-mode task** 로 진행하며, 본
task 는 dependency 를 추가하지 않는다. owner 가 아래 Decision 의 권고 도구(또는 대안 중
하나)를 승인해 실제 도입 task 가 착수되는 시점에 본 ADR 의 Status 를 **ACCEPTED** 로 flip
한다(별도 direct 1줄 status 수정).

**ACCEPTED flip 조건**: (a) owner 가 CLAUDE.md §5 HITL 게이트에서 부하 harness 도구
도입을 승인하고, (b) 승인된 도구가 본 ADR 의 권고 도구와 일치하거나(일치 시 본문 무수정
flip), 다르면 본 ADR 의 Decision/Alternatives 를 amendment 로 갱신한 뒤, (c) 실제 도입
pr-mode task 가 `package.json` 에 해당 도구를 추가하는 시점. 그 전까지 Status 는
**PROPOSED** 로 유지한다.

## Context

[docs/ops/load-resilience-test-plan.md](../ops/load-resilience-test-plan.md) (T-0826)
가 부하·내성 테스트의 시나리오·측정 임계·접근 방식을 계획으로 확정했으나, 그 §4·§5 는
실제 부하를 발생시키는 **harness 도구 선택 결정을 명시적으로 follow-up 으로 남겼다**. 본
ADR 은 그 결정을 박제해 다음 harness 구현 task 가 도구를 재추론하지 않도록 한다.

도구 선택을 지배하는 외력은 다음과 같다.

- **REQ-047** ([docs/requirements.md](../requirements.md) line 66) — 100~200명 평가대상
  × 50~100 repo × ~1000 confluence page 규모의 **평가 작성 배치가 1시간 이내** 완료. 검증
  위치 enum `perf`, 상태 PLANNED. 계획 §2 의 **S1 평가 배치 부하** 시나리오가 이를 back.
- **REQ-048** ([docs/requirements.md](../requirements.md) line 67) — 이미 저장된 평가
  결과 **조회·시각화가 3초 이내**(p95 latency < 3s). 검증 위치 enum `perf`, 상태 PLANNED.
  계획 §2 의 **S2 조회 API 응답 지연** 시나리오가 이를 back.
- **계획 §2 의 3 시나리오가 요구하는 부하 생성 능력**:
  - **S1 평가 배치 부하** — 대규모 배치 1회, 단계별(수집 / LLM / 저장) 소요 분포 관찰. LLM·
    외부 수집 I/O 지배 → stub / record-replay / 격리 endpoint 선행 설계 필요(계획 §4.2).
  - **S2 조회 지연** — p50/p95/p99 percentile 집계, throughput(req/s), error rate 수집.
    단일-클라이언트 latency 스모크 수준은 기존 `supertest` 로도 일부 가능(계획 §4.1).
  - **S3 동시 요청 내성** — concurrent read+write 혼합 부하를 **동시성 수준을 올려가며**
    인가, latency cliff·error rate 급증 부재 확인. **고동시성·고 RPS 발생기 필요**(계획
    §4.2 — `supertest` 만으로는 단일 프로세스 순차 호출 성격이라 부족).

즉 **S2 의 경량 latency 측정은 기존 dependency(`supertest` 7.0.0, `@types/supertest`
6.0.2)로 착수 가능하지만, S1 배치·S3 동시성의 고동시성·고 RPS 부하는 전용 부하 발생기가
필요**하며 그것은 모두 신규 외부 dependency 다. 본 ADR 은 그 전용 발생기의 권고안을
정한다.

추가 외력:

- **기존 스택 경계** ([CLAUDE.md](../../CLAUDE.md) §1) — Backend Node.js + NestJS + TS,
  Test 는 Jest(unit) + supertest(e2e), package manager pnpm, CI GitHub Actions. 부하 도구는
  이 스택과 CI 통합이 매끄러워야 하고, percentile 집계·시나리오 스크립트를 표준 지원해야
  한다.
- **Single-operator long-horizon 운영** — 도구 유지비(스크립트 언어 학습·버전 관리·CI
  cache)가 낮을수록 자율 agent 가 harness 를 유지하기 쉽다.
- **부하 CI 분리** — 부하는 무거워 상시 PR CI 와 분리한 별도 job(정기/수동 trigger)으로
  편입(계획 §5-4). 도구는 headless·비대화형 실행 + machine-readable(JSON) 결과 출력이
  가능해야 CI 게이트에 붙는다.

## Decision

**전용 부하 발생기로 [k6](https://k6.io) 를 권고**한다(S1 배치·S3 동시성용). S2 의 경량
단일-클라이언트 latency 스모크는 기존 `supertest` 로 별도 선행 착수하고, 고동시성·고 RPS
가 필요한 S1/S3 harness 는 k6 로 구현하는 **2-계층 접근**을 권고한다.

**본 ADR 은 도구를 권고만 하며 실제 dependency 도입은 CLAUDE.md §5 에 따라 owner 승인 후
별도 pr-mode task(package.json 변경)로 진행 — 본 task 는 dependency 를 추가하지 않는다.**
(`git diff` 로 `package.json` / `pnpm-lock.yaml` 무변경 확인.)

k6 권고 근거:

1. **percentile·threshold 1급 지원** — k6 는 p50/p95/p99 percentile, throughput, error
   rate 를 내장 metric 으로 집계하고, `thresholds`(예: `http_req_duration: ['p(95)<3000']`)
   를 스크립트에 선언하면 임계 위반 시 non-zero exit 로 종료한다. 계획 §3 의 pass/fail
   임계 표(S2 p95<3s, error rate<1%)를 도구 레벨에서 직접 게이트할 수 있어 CI 통합이
   자연스럽다.
2. **CI 통합 용이** — headless CLI(`k6 run script.js`) + JSON/summary export 로 GitHub
   Actions 의 별도 job(정기/수동 trigger)에 매끄럽게 편입. 상시 PR CI 와 분리한 무거운
   부하 job(계획 §5-4)에 적합.
3. **시나리오 fit** — S3 의 동시성 단계별 부하(ramping VUs / stages), S1 의 배치성 부하
   패턴을 스크립트 DSL 로 표현 가능. 시나리오 스크립트는 JavaScript(ES 모듈)라 본 스택의
   TS/JS 친화성과 정합(단 k6 런타임은 Go 기반 goja 라 Node API 전체는 아님 — 아래 trade-off).
4. **유지비** — 스크립트가 JS 라 자율 agent 가 작성·유지하기 쉽고, 단일 정적 바이너리라
   CI runner 에 설치가 단순(전이 npm 의존성 트리를 부풀리지 않음).

## Consequences

### 긍정

- **임계 게이트의 도구 내재화** — 계획 §3 의 percentile/error-rate 임계를 k6 `thresholds`
  로 선언하면 harness 실행 자체가 pass/fail 를 판정. driver/CI 가 별도 집계 로직을 짤
  필요가 줄어든다.
- **PR CI 무영향** — k6 는 별도 정기/수동 job 으로 분리되므로 상시 PR CI(unit/smoke/e2e)의
  실행 시간·비용에 영향을 주지 않는다(계획 §5-4 의 분리 원칙 충족).
- **S2 선행 착수 가능** — 경량 latency 스모크는 기존 `supertest` 로 k6 도입 전에도 시작할
  수 있어(계획 §5-2), owner 승인 대기와 무관하게 진행 가능한 작업이 분리된다.
- **격리 endpoint 전략과 병행** — S1 의 LLM·외부 수집 I/O 격리(stub/record-replay)는 도구
  선택과 독립적으로 harness 구현 task 에서 함께 설계(계획 §4.2).

### 부정 / trade-off

- **신규 외부 dependency** — k6 는 기존 스택에 없는 도구다. CLAUDE.md §5 BLOCKED 룰 대상이라
  owner 승인 없이는 도입 불가. **본 ADR 은 결정(권고)만 박제**하고 실제 설치는 별도 task.
- **런타임 이질성** — k6 스크립트는 JS 지만 런타임은 Go 기반(goja) 이라 Node.js API·npm
  모듈을 그대로 쓸 수 없다. 기존 e2e 의 supertest 코드를 재사용하지 못하고 부하 스크립트를
  별도 언어 관례로 작성해야 한다(학습·유지 비용 존재).
- **설치 형태** — k6 는 npm 패키지가 아니라 정적 바이너리(또는 Docker image) 로 배포되는
  것이 표준이라, `package.json` dependency 가 아니라 CI runner 의 별도 설치 step(예:
  `grafana/setup-k6-action` 또는 apt/brew) 으로 편입해야 한다. `pnpm-lock.yaml` 관리
  대상 밖이라는 점을 harness 도입 task 가 명확히 해야 한다.
- **결과 baseline 의존성** — 계획 §3 의 "baseline 후 fix" 임계는 k6 최초 실측으로 확정.
  도구 선택만으로 임계가 정해지지 않는다(over-fitting 방지, 계획 §3).

### 후속 task 전망

- **도구 도입 task**(owner 승인 후 pr-mode) — k6 CI 설치 step 추가 + 부하 job 스켈레톤.
  CLAUDE.md §5 BLOCKED 해소 전제.
- **S2 경량 harness**(supertest 기반, 신규 dependency 불요 가능) — 위와 독립적으로 선행
  착수 가능(계획 §5-2).
- **S1 / S3 harness 구현** — k6 스크립트 + 격리 endpoint(stub/record-replay) 설계.
- **CI 통합** — 부하 job 을 `.github/workflows/` 에 별도(정기/수동 trigger)로 편입.
- **baseline 확정** — 최초 실측으로 계획 §3 의 "baseline 후 fix" 임계를 실 수치로 확정.

## Alternatives considered

| 대안 | 신규 dep | 시나리오 fit | CI 통합 난이도 | 유지비 | 채택 여부 |
| --- | --- | --- | --- | --- | --- |
| **k6** (권고) | 있음(정적 바이너리/Docker, npm 아님) | S1/S3 고동시성·ramping VUs 1급, S2 percentile 집계 1급 | 낮음 — headless CLI + `thresholds` non-zero exit + JSON export 로 별도 job 편입 용이 | 낮음 — JS 스크립트 + 단일 바이너리, npm 의존성 트리 무영향(단 goja 런타임 이질성) | **✓ 권고** (S1/S3 전용 발생기) |
| supertest 자체 harness | **없음**(기존 devDependency 7.0.0 재사용) | S2 단일-클라이언트 latency 스모크만 적합. S1 배치·S3 고동시성은 단일 프로세스 순차 호출 성격이라 부족(계획 §4.1) | 낮음 — 기존 Jest/supertest 파이프라인 재사용 | 낮음 — 기존 스택 그대로 | **부분 채택** — S2 경량 measure 에 한해 선행 사용. S1/S3 부하 발생기로는 불충분 |
| autocannon | 있음(npm devDependency 로 도입 가능) | S2/HTTP throughput·latency 측정 적합. 그러나 시나리오 스크립팅(단계별 ramping·write 혼합 S3)이 k6 대비 빈약 — 주로 단순 flooding 벤치 지향 | 낮음 — npm 설치라 `pnpm-lock.yaml` 관리 자연스럽고 headless 실행 | 낮음~중 — Node API 그대로라 학습 쉬움. 단 복잡 시나리오는 코드로 직접 조립해야 함 | 미채택 — S3 동시성 시나리오·threshold 게이트 표현력이 k6 대비 약함. 단 **npm-native 라 lockfile 관리가 매끄러운 이점**은 owner 검토 시 재고려 가치 있음 |
| artillery | 있음(npm devDependency) | YAML 시나리오로 ramping·혼합 부하(S1/S3) 표현 가능, percentile 집계 지원 — k6 와 유사 범주 | 중 — npm 설치는 쉬우나 플러그인·리포터 생태계 설정이 k6 대비 파편적 | 중 — YAML DSL 학습 + 플러그인 버전 관리. 대규모 부하 시 리소스 효율이 k6(Go) 대비 낮다는 평 | 미채택 — 시나리오 표현력은 충분하나 threshold 게이트·리소스 효율·CI 통합 매끄러움에서 k6 우위. **npm-native 이점**은 autocannon 과 공유 |

**정리**: 신규 dependency 0 이 최우선이면 supertest 자체 harness 가 유일하나 S1/S3 를
cover 못 한다. 전용 발생기 중에서는 threshold 게이트 내재화·CI 통합·리소스 효율·시나리오
표현력의 종합에서 **k6** 를 권고한다. 단 **`pnpm-lock.yaml` 관리 매끄러움을 최우선**으로
두면 npm-native 인 autocannon/artillery 가 owner 검토 시 재고려 가치가 있으므로, 본 ADR 의
ACCEPTED flip 시점(owner 승인)에 최종 확정한다.

## 범위 밖 (deferred)

- **실제 harness 스크립트 작성** — 부하 생성 코드·측정 실행은 owner 승인 + dependency
  도입 후 별도 task.
- **`package.json` / `pnpm-lock.yaml` 변경** — 어떤 새 dependency 도 본 task 에서 추가하지
  않는다.
- **CI workflow(`.github/workflows/`) 변경** — 부하 job 편입은 harness 구현 task 범위.
- **격리 endpoint(stub/record-replay) 구현** — S1 의 LLM·외부 수집 I/O 격리는 harness
  구현 task 에서 설계(계획 §4.2).
- **baseline 임계 확정** — 계획 §3 의 "baseline 후 fix" 임계는 최초 실측 후 별도 갱신.
- **REQ-047/048 상태(PLANNED) 변경** — ADR 신설만으로 NFR 검증 완료가 아니다.

## References

- [CLAUDE.md](../../CLAUDE.md) §1 — 기술 스택(Node.js/NestJS/TS/Jest/supertest/pnpm/CI)
- [CLAUDE.md](../../CLAUDE.md) §5 — 새 외부 dependency 추가 BLOCKED 룰(owner 승인 → ADR)
- [CLAUDE.md](../../CLAUDE.md) §12 — 언어 정책
- [docs/ops/load-resilience-test-plan.md](../ops/load-resilience-test-plan.md) — 본 ADR 이 back 하는 계획(§2 시나리오 / §3 임계 / §4 도구 후보 / §5 follow-up)
- [docs/requirements.md](../requirements.md) line 66 / 67 — REQ-047 / REQ-048
- [ADR-0002](ADR-0002-db.md) — ADR 포맷 참조 + "결정만 박제, dependency 는 별도 task" 선례
- k6 docs: <https://k6.io/docs/>

Refs: T-0827, REQ-047, REQ-048
