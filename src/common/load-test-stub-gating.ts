// load-test-stub-gating — 부하 harness 용 stub gateway 활성 여부 판정 순수 함수 모듈
// (T-1627, [ADR-0057](../../docs/decisions/ADR-0057-s1-batch-load-io-isolation.md)
// `## Decision` D1). D1 이 택한 "env 기반 stub gateway 주입 + fail-safe default OFF"
// 중 **판정 한 조각만** 떼어 unit-testable 하게 박제한다.
//
// 책임 경계:
//   - 본 helper 는 "stub 을 켜야 하는가" 만 판정한다(부수효과 0 순수 함수).
//     stub gateway 구현 class 도, `LLM_GATEWAY` DI token 의 binding 분기(module
//     factory)도 본 모듈의 책임이 아니며 **후속 slice** 가 이 함수를 호출해 배선한다.
//     따라서 본 모듈만으로는 호출처가 0 이고 어떤 실행 경로도 바뀌지 않는다.
//   - 판정을 module factory 안에 묻지 않고 먼저 분리하는 이유는 CLAUDE.md `§3.2` 의
//     entrypoint-helper 분리 원칙과 같다 — 분기를 factory 안에 두면 negative case 를
//     unit-test 하기 어렵고, 검증되지 않은 분기가 곧 D1 이 경고한 오활성 risk 다.
//   - 선례 형태는 [llm-live-test-gating](../llm/llm-live-test-gating.ts)(env 이름
//     상수 + 순수 판정 함수)를 그대로 승계한다 — 새 패턴을 만들지 않는다.
//   - 외부 의존 0(Node 내장 타입만), 새 dependency 0.

// stub 활성 판정에 쓰는 env 변수 **이름** 상수. 실값 0 — 이름만 박제한다.
// 후속 slice 의 workflow env 주입이 이 상수와 같은 이름을 쓰도록 고정하는 single
// source (spec 이 값 자체를 assert 해 drift 를 막는다).
export const LOAD_TEST_STUB_ENV = "LOAD_TEST_STUB";

// stub 을 활성으로 인정하는 **유일한** env 값. ADR-0057 D1 의 "정확히 `1`" 조건.
const ENABLED_VALUE = "1";

// isLoadTestStubEnabled — env map 을 읽어 부하용 stub 을 활성해야 하는지 판정한다.
//
// 규칙(ADR-0057 D1 그대로): `env[LOAD_TEST_STUB_ENV]` 가 **정확히 문자열 `"1"`** 일
// 때만 `true`. 그 외(부재 / undefined / 빈 문자열 / 공백-only / `" 1"` 같은 주변 공백
// 포함 / `"0"` / `"true"` / `"TRUE"` / `"yes"` / `"on"` / `"01"` 등)는 **전부 `false`**
// 이며 호출처는 실 gateway 로 fall-through 해야 한다(fail-safe default OFF).
//
// **trim 도 대소문자 folding 도 의도적으로 하지 않는다** — 관대한 해석은 그대로
// 오활성 표면이 되고, 오활성은 프로덕션에서 LLM 이 조용히 가짜 응답을 내는 사고이기
// 때문이다(ADR-0057 `## Consequences` 부정 3). 판정이 엄격해서 생기는 최악은 "부하
// job 에서 stub 이 안 켜져 실패한다" 뿐이라 비대칭적으로 안전하다.
//
// @param env 판정에 사용할 env map. 생략 시 `process.env` 를 읽는다(읽기만 하며
//            어떤 env 도 쓰지 않는다 — 부수효과 0).
export function isLoadTestStubEnabled(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  return env[LOAD_TEST_STUB_ENV] === ENABLED_VALUE;
}
