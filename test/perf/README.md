# test/perf — S2 조회 latency 경량 harness

부하·내성 계획([load-resilience-test-plan.md](../../docs/ops/load-resilience-test-plan.md) §5 follow-up #2)의
**S2 조회 latency measure**(REQ-048, p95 < 3s)를 위한 자리다. 신규 dependency 없이 기존
`supertest` 로 진행한다(k6/artillery 등 발생기는 ADR-0054, owner 승인 후 별도 task).

## 측정 primitive (`latency-metrics.ts`)

DB·네트워크·앱 부트스트랩에 의존하지 않는 **순수 함수**(입력 배열 → 출력 수치).

- `percentile(samplesMs, p)` — p-분위수(0~100, 선형 보간).
- `summarizeLatency(samplesMs)` — `{ p50, p95, p99, count, maxMs }`(§3 임계 표 대응).
- `errorRate(total, failures)` — non-2xx/전체 비율(0~1), total=0 방어.

```ts
import { summarizeLatency, errorRate } from "./latency-metrics";
const s = summarizeLatency(samplesMs); // p95 < 3000(ms) 검증
const er = errorRate(reqs.length, fails); // er < 0.01 검증
```

`latency-metrics.spec.ts` 는 순수 unit 이라 기본 `pnpm test` 에서도 수집·검증된다.

## 후속 harness (DB-backed `*.perf-spec.ts`)

실 조회 endpoint round-trip latency 수집은 별도 follow-up 이며 이 primitive 를 import 한다.
`jest-perf.json` 은 `*.perf-spec.ts` 만 매칭하고 현재 매칭 0 이라 `passWithNoTests: true`
scaffold 다(실행: `pnpm test:perf`). perf job 은 상시 PR CI 와 분리한다(follow-up #4).
