---
id: ADR-0057
title: S1 배치 부하의 외부 I/O 격리 전략 — stub gateway 주입 · 진입점 · 측정 분해 · 1h 게이트 판정
status: ACCEPTED
date: 2026-08-21
relatedTask: [T-1626]
relatedReq: [REQ-047]
supersedes: null
---

# ADR-0057 — S1 배치 부하의 외부 I/O 격리 전략

## Status

**ACCEPTED**. 본 ADR 의 결정은 **신규 dependency 0 · DB schema 변경 0 · 인증/권한 모델
변경 0** 을 모두 만족하므로 [CLAUDE.md](../../CLAUDE.md) `§5` HITL 게이트가 발화하지
않는다 — 부하 발생기(k6)는 [ADR-0054](ADR-0054-load-resilience-harness-tool.md) 가 이미
ACCEPTED 로 도입을 끝냈고, 본 ADR 이 더하는 것은 **기존 DI token · 기존 route · 기존
env 주입 경로 안에서의 배선 결정**뿐이다.

본 ADR 은 **결정만 박제**하며 코드·스크립트·workflow 를 만들지 않는다(본 task 의 diff 는
본 문서 + 계획 문서 pointer 1 줄뿐 — `src/` · `test/load/` · `.github/workflows/` ·
`package.json` 변경 0). 완료 선언도 0 — REQ-047 은 PLANNED 그대로다.

## Context

[docs/ops/load-resilience-test-plan.md](../ops/load-resilience-test-plan.md) `§2` 의 3
시나리오 중 S2(조회 지연) · S3(동시 요청 내성)는 T-1623 ~ T-1625 로 실발화까지 닫혔고,
남은 것은 **S1 평가 배치 부하 = REQ-047 본체** 하나다. 그런데 계획 문서는 S1 정의 안에서
곧바로 유보를 건다 — `§2` S1 의 "주의" 는 "실 LLM·외부 수집 endpoint 의존도가 커, 부하
측정 시 stub/record-replay 또는 격리 endpoint 필요(`§4` 참조) — 순수 서버 처리량과 외부
I/O 대기를 분리 측정" 이라고 적었고, `§4.2` 의 "LLM/외부 수집 의존 격리" 항목은 그 선행
설계를 **도구 ADR 에서 함께 결정** 하라고 넘겼다. [ADR-0054](ADR-0054-load-resilience-harness-tool.md)
는 그 축을 받아 `§Consequences` 긍정 4 항 "격리 endpoint 전략과 병행" 으로만 언급한 뒤
`§범위 밖` 에서 "격리 endpoint(stub/record-replay) 구현 — S1 의 LLM·외부 수집 I/O 격리는
harness 구현 task 에서 설계" 로 다시 미뤘다. 즉 **격리 결정은 두 문서 사이에서 미결로 남은
유일한 S1 선행 조건**이다.

판정 임계는 계획 `§3` 표의 S1 두 행이 이미 고정하고 있다 — 배치 완료 시간 **≤ 1h**
(근거 REQ-047), 배치 실패·재시도율 **error rate < 1%**(baseline 후 fix). 본 ADR 은 이
값을 **재산정하지 않는다**. 정하는 것은 "그 값을 credential 0 환경에서 어떻게 재고 어떻게
pass/fail 로 만드느냐" 다.

결정을 지배하는 현 코드 사실 2 개:

1. **UC-06 batch 연산 endpoint 는 아직 미노출** — [src/user/assessment.controller.ts](../../src/user/assessment.controller.ts)
   `43 행` 주석이 "UC-06 batch 연산 endpoint (run / reeval / reset / 범위 DELETE) 미노출 —
   P5 의존" 을 명시한다. 즉 S1 이 때릴 "평가 배치" 의 정식 표면은 아직 없다.
2. **부하 job 은 credential 0 환경** — [.github/workflows/load-k6.yml](../../.github/workflows/load-k6.yml)
   의 컨테이너 기동 step 이 주입하는 env 는 `DATABASE_URL` · `AUTH_JWT_SECRET` · `PORT`
   3 개뿐이다. LLM API key 도, GitHub/Confluence token 도 없다 — 실 LLM 호출과 실 수집
   호출은 **의도적으로 불가능**하다. 격리는 선택지가 아니라 전제다.

여기에 harness 규약 제약이 더해진다. [test/load/s3-concurrent.js](../../test/load/s3-concurrent.js)
가 승계해 온 규약 — `__ENV` 기본값 · route tag 분리 · setup/teardown 자기 정리 · 조건
분기 로직 0 — 안에서 S1 도 표현돼야 한다.

## Decision

### D1. 격리 방식 — env 기반 stub gateway 주입 (택 1)

**① env 기반 stub gateway 주입을 채택**한다. record-replay fixture 재생(②)과 외부 I/O 를
제외한 격리 endpoint(③)는 `## Alternatives considered` 로 내린다.

배선 지점은 이미 존재한다 — [src/llm/llm-gateway.interface.ts](../../src/llm/llm-gateway.interface.ts)
의 `LLM_GATEWAY` DI token 은 "test 에서 mock gateway 주입이 용이" 하도록 interface 의존을
박제해 둔 token 이고, 실제 구현체 바인딩은 module 의 `useExisting` 한 줄이다. 수집 축
(GitHub/Confluence adapter)도 같은 adapter 경계에 같은 방식을 적용한다. 따라서 격리는 **새
class 를 프로덕션 경로에 끼워 넣는 일이 아니라 기존 token 의 binding 을 env 로 고르는 일**
이며, 신규 dependency 0 · schema 변경 0 으로 성립한다.

**fail-safe default OFF** — stub binding 은 명시 env(예 `LOAD_TEST_STUB` 가 정확히 `1`)
일 때만 선택되고, 미설정·빈 문자열·다른 값은 전부 실 gateway 로 fall-through 한다. 후속
구현 slice 는 이 default 분기를 R-112 negative test(미설정 / 다른 값 / 대소문자 변형)로
고정해야 한다 — 오활성은 프로덕션에서 LLM 이 조용히 가짜 응답을 내는 사고가 되기 때문이다.

### D2. S1 부하 대상 진입점 — `POST /api/assessment-evaluation/unevaluated-fill-run`

**신규 route 를 노출하지 않는다.** UC-06 batch endpoint 가 미노출(Context 사실 1)이라
"부하용 route 를 새로 연다" 는 유혹이 있으나, 실재하는 배치성 route 가 이미 있다 —
[src/assessment-evaluation/assessment-evaluation.controller.ts](../../src/assessment-evaluation/assessment-evaluation.controller.ts)
`599 행` 의 `@Post("unevaluated-fill-run")`(RBAC Admin+, `JwtAuthGuard` + `RolesGuard`)
가 미평가 대상을 훑어 평가를 채우는 run-side 사슬의 HTTP 진입점이다. S1 은 이 경로를
타격 대상으로 **확정**한다. 부하 전용 route 를 새로 열면 측정 대상이 실 배치 경로와 갈라져
REQ-047 판정의 대표성이 무너진다.

인증은 [test/load/s2-read.js](../../test/load/s2-read.js) `setup()` 의 signup → login →
cookie 규약을 그대로 승계한다. 단 위 route 는 Admin+ 라 계정 tier 가 문제인데,
[src/user/user.controller.ts](../../src/user/user.controller.ts) `9~11 행` 이 박제하듯
`POST /api/users` 의 **첫 등록 user 는 role "SuperAdmin"**, 두 번째부터는 "User" 다.
따라서 workflow step 순서를 **smoke → S1 → S2 → S3** 로 두어 S1 `setup()` 의 signup 이 그
run 의 첫 user 가 되게 한다(`smoke.js` 는 `GET /api` 만 때려 user 를 만들지 않는다).
S2 를 먼저 돌리면 S1 계정이 두 번째가 되어 403 이 뜨고 그 403 이 error rate 임계를 오염시킨다.

### D3. 측정 분해 규칙 — route tag 분리

k6 는 클라이언트 측 관측자라 서버 내부의 수집 / LLM / 저장 단계 분해를 스스로 볼 수 없다.
따라서 본 ADR 은 **route tag 3 종 분리**까지를 확정한다 — `batch`(대상 route 호출),
`seed`(setup 의 준비 write), `auth`(signup · login). 임계는 `batch` 에만 걸어 준비·인증
왕복이 판정 지표에 섞이지 않게 하고(S2·S3 가 이미 쓰는 오염 차단 규약 승계), "순수 서버
처리량" 은 `http_req_duration{route:batch}` 로 읽는다. 이 값은 D1 의 stub 아래에서 측정되므로
외부 I/O 대기가 0 에 수렴한 값이며, **실 외부 I/O 를 포함한 소요는 본 harness 가 재지 않는다** —
run 리포트는 이 사실을 명시해야 한다(아래 Consequences 부정 1). 서버 내부 단계별(수집 / LLM /
저장) 소요 분포는 응답 본문의 요약 필드나 별도 서버 측 관측이 필요하며 후속 slice 로 남긴다.

### D4. 1h 게이트 판정 방식 — 축소 표본 + 선형 외삽

외삽의 기준 인원 **133명** 은 새 숫자가 아니라 [docs/ops/realdata-scale-devset.md](../ops/realdata-scale-devset.md)
`6 행` 이 이미 확정한 실 devset 규모(REQ-047 의 100~200명 대역 안)를 그대로 쓴 것이다.

**133명 full run 을 그대로 재지 않는다.** 수동 job 1 회에 1 시간짜리 배치를 태우면 runner
시간·비용이 과하고, credential 0 stub 아래의 1h 는 실 부하도 아니다. 대신 `__ENV` 로 받는
축소 표본(예 `K6_S1_PERSONS` 기본 10)으로 배치를 1 회 돌리고 **선형 외삽**으로 133명 환산치를
판정한다. 임계 환산은 계획 `§3` 의 값에서 파생만 하며 **재산정 0** 이다:

- 환산 임계 = `3,600,000ms × (표본 인원 / 133)` — 즉 표본 10 이면 약 `270,676ms`.
  상수는 ADR 에 못 박지 않고 스크립트가 `__ENV` 표본 인원에서 계산한다(표본 수를 바꿔도
  임계가 자동으로 따라와 drift 가 생기지 않는다).
- pass/fail 은 k6 `thresholds` 의 `http_req_duration{route:batch}` 항목에 그 환산치를
  `p(95)` 상한으로 선언해 위반 시 k6 가 non-zero exit → 수동 job step 이 red 가 된다
  ([ADR-0054](ADR-0054-load-resilience-harness-tool.md) `§Decision` 의 "threshold 게이트
  도구 내재화" 승계 — 별도 집계 로직 0).
- error rate 는 계획 `§3` 표 그대로 전역 `http_req_failed` 에 `rate<0.01` 을 건다.

## Consequences

### 긍정

- **S1 harness 의 ambiguity 0** — 후속 slice 는 격리 방식·진입점·tag·게이트 산식을 재추론하지
  않고 그대로 집행한다. 계획 `§4.2` 와 ADR-0054 `§범위 밖` 사이에 떠 있던 유일한 미결이 닫힌다.
- **credential 0 유지** — stub 주입이라 부하 job 에 LLM key·수집 token 을 새로 넣을 이유가
  없다. secret 표면이 늘지 않는다(CLAUDE.md `§9`).
- **기존 배선 재사용** — `LLM_GATEWAY` token · 기존 Admin+ route · 기존 env 주입 step 만
  쓰므로 신규 dependency 0 · schema 변경 0 · 새 프로덕션 route 0.
- **비용 상한** — 축소 표본 + 외삽이라 수동 job 이 1 시간을 점유하지 않는다. S2·S3 step 과
  같은 job 안에서 수십 초 규모로 끝난다.

### 부정 / trade-off

- **실 LLM latency 는 여전히 미검증** — stub 은 외부 왕복을 0 으로 만들므로 본 harness 가
  증거화하는 것은 "서버 자체의 배치 오케스트레이션·DB 저장 처리량" 뿐이다. REQ-047 의
  "LLM 호출·수집(GitHub/Confluence)·저장 **전 구간** 포함 ≤ 1h"(계획 `§2` S1) 중 **외부 I/O
  구간은 미검증으로 남는다** — 그 구간은 provider latency·rate limit·재시도 정책에 지배되며
  별도 실측(운영 환경 관측 또는 credential 있는 별도 job)이 필요하다.
- **선형 외삽 가정** — 표본 10 → 133 환산은 배치 처리량이 인원에 선형이라고 가정한다. DB
  커넥션 풀 포화·N+1·GC 압력 같은 비선형 구간은 축소 표본에서 드러나지 않는다. 이 가정의
  타당성은 후속 baseline slice 가 표본 2 종(예 10 vs 40) 비교로 점검해야 한다.
- **stub 오활성 risk** — env 하나로 실 gateway 를 갈아끼우는 구조라 오설정 시 프로덕션이
  가짜 narrative 를 낸다. D1 의 default OFF + negative test 의무가 그 방어선이며, 후속 구현
  slice 가 이를 빠뜨리면 reviewer 가 BLOCKER 로 잡아야 한다.
- **진입점이 UC-06 본체가 아니다** — `unevaluated-fill-run` 은 미평가 채움 경로라 UC-06 의
  run / reeval / reset 전량과 동일하지 않다. UC-06 batch 표면이 노출되면 S1 대상 route 를
  그쪽으로 옮길지 재검토가 필요하다(본 ADR 의 amendment 대상).

## Alternatives considered

| 대안 | 내용 | 채택 안 한 이유 |
| --- | --- | --- |
| ② record-replay fixture 재생 | 실 LLM·수집 응답을 1 회 녹화해 fixture 로 저장하고 부하 시 재생 | **녹화 자체가 실 credential 을 요구**한다 — 부하 job 은 credential 0 이고(Context 사실 2) 저장소에 실 응답을 넣으면 raw 보존·secret 규율과 충돌한다. fixture 수명 관리(프롬프트가 바뀌면 전량 재녹화)도 stub 대비 유지비가 크다 |
| ③ 외부 I/O 제외 격리 endpoint | 저장·조립 경로만 도는 부하 전용 route 를 새로 노출 | **측정 대상이 실 배치 경로와 갈라진다** — 부하 전용 route 는 실제 orchestration 분기·guard·트랜잭션 경계를 우회하기 쉬워 REQ-047 판정의 대표성이 떨어지고, 프로덕션 표면에 부하 전용 route 가 영구히 남는 유지·보안 부담이 생긴다. D2 가 기존 route 를 쓰기로 한 이유와 동일 |

## 범위 밖 (deferred)

본 ADR 은 결정만 박제한다. 아래는 전부 **후속 slice**다.

- **`src/` stub 배선 구현** — env 판정 helper + stub gateway/adapter class + module binding.
  R-112 4 종(특히 default OFF negative)이 그 slice 의 의무다.
- **`test/load/s1-batch.js` 신설** — D2 route 타격 + D3 tag + D4 threshold 산식의 실제 스크립트.
- **`load-k6.yml` step 추가** — D2 가 요구하는 **smoke → S1 → S2 → S3** 순서 재배치 + stub
  env 주입. `package.json` 의 `test:load:s1` script 와 drift-guard smoke 의 parity 대조 포함.
- **133명 실 seed 투입** — 축소 표본이 아닌 full scale seed 는 별도 판단 대상.
- **baseline 실측 · 임계 fix** — 계획 `§3` 의 "baseline 후 fix" 항목 갱신은 최초 실측 후.
- **서버 측 단계별(수집 / LLM / 저장) 소요 분해 지표** — D3 이 tag 분리까지만 확정했다.
- **실 외부 I/O 구간의 latency 실측** — 부정 1 이 남긴 미검증 구간.

## References

- [docs/ops/load-resilience-test-plan.md](../ops/load-resilience-test-plan.md) — `§2` S1 정의와
  "주의", `§3` 표 S1 두 행(≤ 1h · error rate < 1%), `§4.2` 격리 문단, `§5` follow-up item 3
- [ADR-0054](ADR-0054-load-resilience-harness-tool.md) — k6 + supertest 2-계층 결정. 본 ADR 이
  그 `§범위 밖` 의 격리 축을 이어받는다(ADR-0054 본문 수정 0, status flip 0)
- [ADR-0056](ADR-0056-perf-baseline-checkin-ci.md) — perf baseline 정책(임계 승격 절차)
- [docs/requirements.md](../requirements.md) `66 행` — REQ-047(평가 배치 1h, PLANNED)
- [docs/ops/realdata-scale-devset.md](../ops/realdata-scale-devset.md) `6 행` — 실 devset 133명(외삽 기준 인원)
- [docs/PLAN.md](../PLAN.md) `144 행` — 오너 지시(R-91 k6 최우선·즉시 착수)
- [CLAUDE.md](../../CLAUDE.md) `§5` — 신규 dependency / schema / 인증 변경 BLOCKED 경계

Refs: T-1626, REQ-047
