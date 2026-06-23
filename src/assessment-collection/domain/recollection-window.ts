// recollection-window — incremental "since" 경계를 최근 1주만큼 뒤로 물리는(backoff)
// 순수 도메인 함수(PLAN P5 재수집 정책 / R-58 / REQ-031). 부수효과 0 / DB·네트워크·
// env·LLM·Prisma·@Injectable 0 / 외부 dependency 0 / 입력 mutate 0.
//
// 배경: SinceDerivationService.deriveSince 는 직전 Assessment 의 periodStart(마지막
// 수집 경계)를 그대로 ISO 문자열로 반환한다(신규 인원은 undefined = full collection).
// R-58 은 "최근 1주는 항상 재수집(겹쳐 fetch → dedup 이 중복 제거) OK" backoff 를 요구
// 한다. 본 함수는 도출된 since 를 windowDays 일만큼 뒤로 물려, 다음 수집이 직전 경계의
// 최근 windowDays 일을 다시 fetch 하게 만든다. 이 겹침은 이미 main 에 박제된 dedup
// (commit-dedup.ts earliest-wins / page-dedup.ts latest-wins)이 흡수하므로 "저장 부분
// 중복 방지 + 최근 1주 재수집 OK" 가 동시에 성립한다.
//
// 책임 경계(Out of Scope): SinceDerivationService 배선(deriveSince 가 본 함수를 소비)은
// service-layer 경계라 별도 follow-up slice. timezone(KST/UTC) 경계 보정은 ADR-first
// 별도. 본 함수는 UTC epoch millis 산술만(.toISOString()).

// RECOLLECTION_WINDOW_DAYS — R-58 의 "최근 1주" 기본 backoff 폭(일). magic number 금지로
// 상수 명명. windowDays 인자 미지정 시 본 값이 적용된다.
export const RECOLLECTION_WINDOW_DAYS = 7;

// MILLIS_PER_DAY — 하루의 epoch millis(24h × 60m × 60s × 1000ms). 시각 산술을 Date 의
// getTime() epoch 기반으로 결정적으로 수행하기 위한 상수.
const MILLIS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * applyRecollectionWindow — incremental since 경계를 windowDays 일만큼 뒤로 물린(backoff)
 * 새 ISO-8601 문자열(UTC, `.toISOString()` 형식)을 반환한다. 다음 수집이 직전 경계의
 * 최근 windowDays 일을 다시 fetch 하도록 겹침을 *만드는* 역할이다.
 *
 * 결정적 동작 계약:
 *  - `since === undefined`(신규 인원 = full collection): backoff 없이 `undefined` 그대로
 *    반환한다(full collection 의미 보존).
 *  - 유효 ISO `since`: `Date.parse` epoch millis 에서 `windowDays * MILLIS_PER_DAY` 를 뺀
 *    timestamp 의 `.toISOString()` 을 반환한다.
 *  - 파싱 불가 `since`(빈 문자열 · 공백 · `"not-a-date"` 등 `Date.parse` → NaN): commit-
 *    dedup.ts `isEarlier` 동형 방어 정책 — NaN ISO 를 **출력하지 않고 원본 문자열을 그대로
 *    반환**한다(결정적 · 비파괴 fallback). backoff 산술의 입력이 신뢰 불가하면 경계를 바꾸지
 *    않는 것이 안전하다(겹침을 못 만들 뿐, 잘못된 since 를 만들지 않는다).
 *  - `windowDays <= 0` 또는 비정수(`Number.isInteger` 거짓, `NaN` 포함): backoff 0 으로 처리
 *    해 원본 `since` 를 그대로 반환한다(음수/0 backoff = 경계 이동 없음). 비정상 window 가
 *    since 를 미래로 밀거나 비결정적으로 만들지 않게 막는다.
 *
 * 입력은 primitive(문자열 · 숫자)라 mutate 표면이 없다 — 반환은 항상 새 문자열 또는
 * `undefined` 이고, 원본 인자를 변형하지 않는다.
 *
 * @param since 직전 수집 경계 ISO-8601 문자열, 또는 신규 인원의 `undefined`.
 * @param windowDays 뒤로 물릴 일 수(기본 `RECOLLECTION_WINDOW_DAYS` = 7). `<=0`/비정수는 no-op.
 * @returns backoff 된 ISO-8601 문자열, 또는 `undefined`(패스스루) / 원본(방어 fallback).
 */
export function applyRecollectionWindow(
  since: string | undefined,
  windowDays: number = RECOLLECTION_WINDOW_DAYS,
): string | undefined {
  // undefined 패스스루 — full collection 의미 보존(backoff 없음).
  if (since === undefined) {
    return undefined;
  }

  // 비정상 windowDays(음수 · 0 · 비정수 · NaN)는 backoff 0 = 원본 그대로(no-op).
  if (!Number.isInteger(windowDays) || windowDays <= 0) {
    return since;
  }

  // 파싱 불가 since 는 NaN ISO 출력 대신 원본을 그대로 반환한다(commit-dedup 동형 방어).
  const epoch = Date.parse(since);
  if (Number.isNaN(epoch)) {
    return since;
  }

  // 유효 경계 — epoch millis 에서 windowDays 일을 빼 결정적으로 backoff 한 ISO 를 반환.
  return new Date(epoch - windowDays * MILLIS_PER_DAY).toISOString();
}
