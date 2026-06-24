// summary-batch-outcome-format-shape — R-61 요약 평가 batch outcome "한 줄 요약"
// 라인 형태 불변식 검증 순수 가드(PLAN.md P5 bullet 97 / REQ-061 "일/주/월 요약
// 평가"의 presentation 무결성 조각). `formatSummaryBatchOutcome`(T-0622)는 JSDoc
// 으로 "결정적 한국어 단일 라인 — prefix `요약 평가 batch: 총 N건` + `· 평가 N
// (생성 C / 기존 E)` + `· skip N` + 대괄호 안 day/week/month/other 4 버킷 슬롯 ·
// 개행 0" 이라는 출력 형태 불변식을 문서로만 박제했고, 그 outcome 라인은 두 caller
// surface 로 외화된다 — (a) `formatSummaryBatchReport`(T-0630)가 합본 리포트의 2번째
// "결과: " 라인 본문으로 그대로 위임 소비(재렌더 0), (b) `SummaryBatchOrchestratorService`
// 가 pipeline 산출 `summaryLine` 을 가공 없이 노출. 그러나 그 단일 라인 형태를 런타임에서
// fail-fast 로 강제하는 가드가 없어, 합성 단계의 미래 회귀(개행 혼입·prefix drift·카운트
// 토큰 누락·버킷 슬롯 누락·순서 뒤바뀜·빈 라인 위장)가 발생하면 손상된 outcome 라인이
// 로그·journal·합본 리포트 2번째 라인으로 silent leak 한다. 본 가드가 그 빈칸을 채운다 —
// outcome 라인이 형태 불변식을 위반하면 한국어 명세형 에러를 던져 손상 outcome 라인이
// 표현 surface 로 새는 것을 차단한다. T-0635 `assertSummaryBatchRosterPlanShape`
// (plan 라인 형태 가드)의 정확한 outcome-side mirror — 이번엔 합본 2번째 라인을 단독
// 산출하는 outcome 단일 라인 형태 가드.
//
// 부수효과 0 / 외부 의존 0 / `@Injectable` 0 / Prisma 0 / LLM 호출 0 / repository 0 /
// 입력 비변형(line 문자열 읽기만 — split/match/test 결과로 원본 변형 0) / 동일 입력 →
// 동일 동작(정상 line 이면 항상 void 반환, 손상 line 이면 항상 동일 위치 throw). raw
// 미저장(R-59 — 형태 검증만, 평가 본문·summaryId/narrative 미접촉). 새 외부 dependency 0,
// DB write·migration 0, live LLM 호출 0.
//
// 책임 경계(task Out of Scope):
//   - `summary-batch-outcome-format.ts` 의 formatter 본문·출력 변경 0 — prefix 상수
//     (`OUTCOME_LINE_PREFIX`)만 import 소비(single-source 정합, 라벨 drift 방지). 상수
//     export 한 줄 + head 1줄 정렬 amend 외 format 모듈 무변경(byte-identical 출력 보존).
//   - 버킷 라벨은 `summary-batch-outcome.ts` 의 `GRANULARITY_BUCKETS` import 사용
//     (자체 정의 금지 — single-source 고정 순서 정합).
//   - 자동 복구 / line 정규화 / drop / 재렌더 0 — 손상 line 을 고치거나 잘라내지
//     않는다(fail-fast throw 만). 복구는 호출처 책임.
//   - 산출 경로 자동 배선(`formatSummaryBatchReport` 2번째 라인·service 경계·로그·
//     journal 안에서 본 가드 호출) 0 — 순수 함수까지(호출처 배선은 별도 wiring
//     follow-up — T-0636/T-0637 패턴 동형).
//   - JSON schema / 외부 validation 라이브러리(zod·ajv) 도입 0 — 순수 문자열 검사만.
//
// 패턴 mirror: summary-batch-roster-plan-shape.ts(T-0635) 가드(순수 함수 / 구조·타입
// 결손은 TypeError / 값·형태 위반은 RangeError 구분 / 한국어 JSDoc·메시지 / 입력 비변형 /
// 결정성). 본 가드는 그 에러 정책·문구 톤·구조를 그대로 mirror 하되 대상이 plan 라인이
// 아니라 outcome 한 줄 요약이다.

import { GRANULARITY_BUCKETS } from "./summary-batch-outcome";
import { OUTCOME_LINE_PREFIX } from "./summary-batch-outcome-format";

// 개행 문자 — outcome 라인은 단일 라인이므로 `\n` 이 0개여야 한다
// (formatSummaryBatchOutcome 산출 형태 정합 — 개행 0).
const LINE_SEP = "\n";

// OUTCOME_PREFIX — line 이 시작해야 하는 전체 prefix(`요약 평가 batch: 총 `). formatter
// head 의 `${OUTCOME_LINE_PREFIX}총 ${total}건` 렌더 식과 정합. 라벨 부분(OUTCOME_LINE_PREFIX)
// 은 single-source import — `총 ` 만 본 가드가 합성(prefix drift 를 ③ 으로 정확히 진단).
const OUTCOME_PREFIX = `${OUTCOME_LINE_PREFIX}총 `;

// COUNT_TOKENS — 전역 카운트 토큰들(`평가 N (생성 C / 기존 E) · skip N`). formatter head
// 의 `· 평가 ${evaluated} (생성 ${created} / 기존 ${existing}) · skip ${skipped}` 렌더
// 식과 정합. 각 토큰이 모두 등장해야 한다(하나라도 누락 시 ④ RangeError).
const COUNT_TOKENS = ["평가 ", "(생성 ", " / 기존 ", "· skip "] as const;

/**
 * R-61 요약 평가 batch outcome "한 줄 요약" 라인의 문서화된 형태 불변식을 런타임에서
 * 검증하는 순수 가드(PLAN.md P5 bullet 97 / REQ-061). `assertSummaryBatchRosterPlanShape`
 * (T-0635, plan 라인 형태 가드)의 정확한 outcome-side mirror.
 *
 * 검증하는 불변식(single source — summary-batch-outcome-format.ts JSDoc·본문의 코드
 * 강제. prefix 상수 `OUTCOME_LINE_PREFIX`·버킷 라벨 `GRANULARITY_BUCKETS` 는 각
 * 모듈에서 import — drift 방지):
 *   ① `line` 은 string 이어야 한다(null/undefined/비-string 금지).
 *   ② 개행(`\n`)이 0개여야 한다(= 정확히 단일 라인). 1개 이상이면 위반.
 *   ③ prefix `요약 평가 batch: 총 `(`OUTCOME_LINE_PREFIX` + `총 `)로 시작해야 한다.
 *   ④ 전역 카운트 토큰 `평가 `·`(생성 `·` / 기존 `·`· skip ` 이 모두 등장해야 한다.
 *   ⑤ 대괄호 안에 `[day N · week N · month N · other N]` 4 버킷 슬롯이
 *     `GRANULARITY_BUCKETS` single-source 고정 순서로 모두 등장해야 한다(각 N 은 0 이상
 *     정수). 슬롯 누락·순서 drift 시 위반.
 *   ⑥ 빈 라인 위장 차단 — 빈 문자열(`""`)·공백만(`"   "`)은 prefix 불일치로 ③ 에서
 *     RangeError(silent 빈 라인 위장 차단).
 *
 * 에러 정책(구조/타입 결손 = TypeError / 형태 정합 위반 = RangeError):
 *   - `line` 이 string 이 아님(①) → 한국어 TypeError.
 *   - 개행 혼입(②)·prefix 위반(③)·카운트 토큰 위반(④)·버킷 슬롯 위반(⑤) → 한국어
 *     RangeError. 메시지에 어느 불변식이 깨졌는지 포함.
 *   - silent 통과(위반인데 정상 반환) 0.
 *
 * 검사 순서: ① string → ② 개행 0 → ③ prefix → ④ 카운트 토큰 → ⑤ 버킷 슬롯. 가장 먼저
 * 위반한 지점에서 throw(fail-fast). prefix 를 토큰 검사보다 먼저 검사해 prefix drift 가
 * ④⑤ 가 아니라 ③ 으로 정확히 진단되게 한다.
 *
 * 비변형 / 순수: `line` 문자열을 읽기만 한다(split/match/test/includes 는 새 값 생성 —
 * 원본 변형 0). 부수효과 0 · `@Injectable` 0 · Prisma 0 · LLM 0 · 새 외부 dependency 0.
 * 동일 line → 동일 동작(정상 line 이면 항상 void 반환, 손상 line 이면 항상 동일 위치 throw).
 *
 * @param line 검증 대상 outcome 한 줄 요약 문자열(`formatSummaryBatchOutcome` 산출).
 *   변형하지 않는다(읽기만).
 * @returns 형태 불변식 ①~⑤ 를 모두 만족하면 아무 일도 하지 않고 정상 반환(void).
 * @throws {TypeError} `line` 이 string 이 아님(null/undefined/비-string — 구조/타입 결손).
 * @throws {RangeError} 개행 혼입(②)·prefix 위반(③)·카운트 토큰 위반(④)·버킷 슬롯 위반
 *   (⑤). 메시지에 어느 불변식이 깨졌는지 포함.
 */
export function assertSummaryBatchOutcomeFormatShape(line: string): void {
  // ① string 타입 결손 — null/undefined/숫자/객체 등은 TypeError(구조 결손).
  if (typeof line !== "string") {
    throw new TypeError(
      `line 이 string 이 아니다(형태 검증 불가 — 값: ${String(line)}).`,
    );
  }

  // ② 개행 0 = 정확히 단일 라인. 개행이 하나라도 있으면 위반(후행/중간 무관).
  // split 으로 라인 수 산출(원본 비변형 — 새 배열 생성).
  const lineCount = line.split(LINE_SEP).length;
  if (lineCount !== 1) {
    throw new RangeError(
      `단일 라인 위반: line 은 개행(\`\\n\`) 0개(정확히 1 라인)여야 한다(실제 ${lineCount} 라인).`,
    );
  }

  // ③ prefix `요약 평가 batch: 총 ` 로 시작해야 한다(라벨 + `총 `). 빈 문자열·공백만은
  // 여기서 차단(빈 라인 위장 차단).
  if (!line.startsWith(OUTCOME_PREFIX)) {
    throw new RangeError(
      `prefix 위반: '${OUTCOME_PREFIX}' 라벨로 시작해야 한다(실제 시작: '${line.slice(0, OUTCOME_PREFIX.length)}').`,
    );
  }

  // ④ 전역 카운트 토큰 — `평가 `·`(생성 `·` / 기존 `·`· skip ` 이 모두 등장해야 한다.
  // 하나라도 누락 시 RangeError(카운트 토큰 누락).
  for (const token of COUNT_TOKENS) {
    if (!line.includes(token)) {
      throw new RangeError(
        `카운트 토큰 위반: '${token}' 토큰이 등장해야 한다(전역 카운트 토큰 누락).`,
      );
    }
  }

  // ⑤ 대괄호 안 4 버킷 슬롯 — GRANULARITY_BUCKETS single-source 고정 순서로 모두
  // 등장해야 한다(`[day N · week N · month N · other N]`, 각 N 은 0 이상 정수). 슬롯
  // 누락·순서 drift 를 한 정규식으로 검증(고정 순서 강제). 라벨/구분자는 상수에서
  // 합성(자체 정의 0 — single source 정합). 각 버킷은 `<bucket> <N>` 뒤에 formatter 의
  // `formatBucketDetail` 산출 detail 괄호(`(평가E·skipS)` 등)가 옵션으로 붙을 수 있어
  // `(?:\([^)]*\))?` 로 0/1 회 허용한다(total 0 버킷은 괄호 생략 — `other 0`).
  const bucketSlots = GRANULARITY_BUCKETS.map(
    (bucket) => `${bucket} \\d+(?:\\([^)]*\\))?`,
  ).join(" · ");
  const bucketBlock = new RegExp(`\\[${bucketSlots}\\]`);
  if (!bucketBlock.test(line)) {
    throw new RangeError(
      `버킷 슬롯 위반: 대괄호 안에 '${GRANULARITY_BUCKETS.join(" · ")}' 4 버킷이 고정 순서로 각 'N'(0 이상 정수)와 함께 등장해야 한다.`,
    );
  }
}
