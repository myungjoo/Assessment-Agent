# T-0879 — perf-spec empty-suite silent-pass 가드 검증 증거

`test/perf/jest-perf.json` 에서 `passWithNoTests: true` 제거 후 두 실행으로 gating 을 입증한다.

## Negative gate (empty-suite → fail)

```
$ pnpm test:perf --testPathPattern '__no_such_perf_spec__'
No tests found, exiting with code 1
Run with `--passWithNoTests` to exit with code 0
  testRegex: test\perf\.*\.perf-spec\.ts$ - 31 matches
  Pattern: __no_such_perf_spec__ - 0 matches
NEGATIVE_GATE_EXIT=1
```

매칭 perf-spec 0개 → jest exit code 1 → CI fail. 더 이상 silent-pass 하지 않음.

## Positive gate (31 spec 존재 → green)

```
$ pnpm test:perf
Test Suites: 31 passed, 31 total
Tests:       209 passed, 209 total
POSITIVE_GATE_EXIT=0
```

31 perf-spec / 209 test 모두 통과 (test count > 0). 로그의 `mocked service 장애` ERROR 라인은 perf-spec 내부 의도된 negative test case 로 suite 는 정상 PASS.

## lint / build

```
$ pnpm lint   # exit 0
$ pnpm build  # exit 0
```

JSON 유효성 포함 green. src/ production code 변경 0이라 `test:cov` coverageThreshold 무영향.
