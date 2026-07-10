# T-0884 결정론 재현 증거 — summary compared happy-path injected-clock

`test/perf/summary-measure-confirm.perf-spec.ts` 의 compared happy-path 테스트 (b) 1차·2차
`measureAndConfirmBaseline` 호출 양쪽에 `measure.now: stepClock(50)` 을 주입한 뒤,
`pnpm test:perf` 를 연속 2회 실행해 `second.comparison.regressed === false` 단언이
wall-clock 부하와 무관하게 매번 green(flake 0)임을 확인했다.

## 실행 결과 요약 (2026-07-10, 로컬)

| 게이트 | 결과 |
| --- | --- |
| `pnpm test:perf` RUN 1 | Test Suites: 34 passed / 34, Tests: 268 passed / 268 |
| `pnpm test:perf` RUN 2 | Test Suites: 34 passed / 34, Tests: 268 passed / 268 (summary spec PASS) |
| `pnpm lint` | clean (0 warning, `--max-warnings=0`) |
| `pnpm build` | clean (nest build 성공) |
| `pnpm test:cov` | Test Suites: 359 passed / 359, Tests: 9421 passed / 9421 |
| coverage (전체) | line 99.95% / branch 99.25% / function 100% — 임계(line ≥ 80% / function ≥ 80%) 무회귀 |

## 판정

- 주입 clock(`stepClock(50)`) 으로 두 실측이 동일 합성 latency 표본을 보게 되어 `regressed=false`
  가 부하 무관 결정론으로 수렴. T-0882 nit-push CI 때 1회 재현됐던 잔존 wall-clock flake vein 소진.
- 실 200 응답 기반 단언(`req` iterations 회 호출, `errorRate.regressed===false`,
  `report` 에 `regressed=false` 포함)은 전부 보존 — clock 주입만 추가, 신규 분기 없음.
- src/ 변경 0 이므로 collectCoverageFrom=src/** 커버리지 무회귀.
