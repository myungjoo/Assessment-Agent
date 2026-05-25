// parsePort 의 R-112 4 종 + negative cases 충분 cover.
// CLAUDE.md §3.2 R-112 entrypoint 예외 정책의 첫 dogfood — main.ts 의
// 분기 로직을 helper 로 분리한 후 본 spec 으로 cover.
import { parsePort, DEFAULT_PORT } from "./parse-port";

describe("parsePort", () => {
  // happy-path: 유효한 양의 정수 문자열
  it("유효한 양의 정수 문자열 입력 시 해당 숫자를 반환한다", () => {
    expect(parsePort("3000")).toBe(3000);
    expect(parsePort("8080")).toBe(8080);
    expect(parsePort("1")).toBe(1);
  });

  // negative: undefined (env 미지정)
  it("undefined 입력 시 DEFAULT_PORT 반환", () => {
    expect(parsePort(undefined)).toBe(DEFAULT_PORT);
  });

  // negative: 빈 문자열 (env="")
  it("빈 문자열 입력 시 DEFAULT_PORT 반환", () => {
    expect(parsePort("")).toBe(DEFAULT_PORT);
  });

  // negative: non-numeric 문자열
  it("non-numeric 문자열 입력 시 DEFAULT_PORT 반환", () => {
    expect(parsePort("abc")).toBe(DEFAULT_PORT);
    expect(parsePort("port-3000")).toBe(DEFAULT_PORT);
  });

  // negative: 0 (양수 조건 위반)
  it("0 입력 시 DEFAULT_PORT 반환 (양수 조건 위반)", () => {
    expect(parsePort("0")).toBe(DEFAULT_PORT);
  });

  // negative: 음수
  it("음수 문자열 입력 시 DEFAULT_PORT 반환", () => {
    expect(parsePort("-1")).toBe(DEFAULT_PORT);
    expect(parsePort("-3000")).toBe(DEFAULT_PORT);
  });

  // branch: parseInt 의 leading-numeric 동작 — "3000abc" → 3000 (양수면 사용)
  it("leading-numeric 입력 (예: '3000abc') 은 parseInt 가 leading 숫자만 추출하여 양수면 사용", () => {
    expect(parsePort("3000abc")).toBe(3000);
  });

  // branch: 소수점 — parseInt 가 정수부만 추출 ("3000.5" → 3000)
  it("소수점 입력 시 parseInt 가 정수부만 추출 — 양수면 사용", () => {
    expect(parsePort("3000.5")).toBe(3000);
  });

  // 회귀 anchor: DEFAULT_PORT 상수 값
  it("DEFAULT_PORT 는 3000 이다", () => {
    expect(DEFAULT_PORT).toBe(3000);
  });
});
