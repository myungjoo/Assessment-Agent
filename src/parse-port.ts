// PORT env 변수 parsing helper.
// CLAUDE.md §3.2 R-112 entrypoint 예외 정책에 따라 src/main.ts 자체는
// coverage 제외이지만, 분기 있는 helper (본 파일) 는 unit-testable 하게
// 분리 + spec 의무. negative cases (undefined / 빈 문자열 / non-numeric /
// 0 / 음수) 각각 cover 필요.

// 기본 포트. env.PORT 가 미지정 / 잘못된 값일 때 fallback.
export const DEFAULT_PORT = 3000;

// PORT env value 를 parse 해서 유효한 양의 정수면 그 값, 아니면 DEFAULT_PORT 반환.
// 유효성 조건: Number.isFinite 통과 + 양수 (> 0).
// undefined / 빈 문자열 / non-numeric / 0 / 음수 모두 fallback.
export function parsePort(envValue: string | undefined): number {
  const parsed = Number.parseInt(envValue ?? "", 10);
  if (Number.isFinite(parsed) && parsed > 0) {
    return parsed;
  }
  return DEFAULT_PORT;
}
