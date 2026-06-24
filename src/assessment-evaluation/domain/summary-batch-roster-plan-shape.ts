// summary-batch-roster-plan-shape — R-61 요약 평가 batch roster pre-flight "계획"
// 라인 형태 불변식 검증 순수 가드(PLAN.md P5 bullet 97 / REQ-061 "일/주/월 요약
// 평가"의 presentation 무결성 조각). `formatSummaryBatchRosterPlan`(T-0628)는 JSDoc
// 으로 "결정적 한국어 단일 라인 — prefix `요약 평가 batch 예정: ` + `person N명` +
// `· 총 N좌표 [...]` + 대괄호 안 day/week/month/other 4 버킷 슬롯 · 개행 0" 이라는
// 출력 형태 불변식을 문서로만 박제했고, 그 plan 라인은 두 caller surface 로 외화된다
// — (a) `SummaryBatchOrchestratorService.previewRosterPlan`(T-0629)가 service 경계로
// 그대로 노출, (b) `formatSummaryBatchReport`(T-0630)가 합본 리포트의 1번째 "계획: "
// 라인 본문으로 위임 소비. 그러나 그 단일 라인 형태를 런타임에서 fail-fast 로 강제하는
// 가드가 없어, 합성 단계의 미래 회귀(개행 혼입·prefix drift·person 토큰 누락·총 좌표
// 토큰 누락·버킷 슬롯 누락·빈 라인 위장)가 발생하면 손상된 plan 라인이 로그·journal·
// 합본 리포트 1번째 라인으로 silent leak 한다. 본 가드가 그 빈칸을 채운다 — plan 라인이
// 형태 불변식을 위반하면 한국어 명세형 에러를 던져 손상 plan 라인이 표현 surface 로
// 새는 것을 차단한다. T-0633 `assertSummaryBatchReportShape`(2-라인 블록 합본 표현
// 가드)의 입력측 mirror — 이번엔 합본 1번째 라인을 단독 산출하는 pre-flight 표현 가드.
//
// 부수효과 0 / 외부 의존 0 / `@Injectable` 0 / Prisma 0 / LLM 호출 0 / repository 0 /
// 입력 비변형(plan 문자열 읽기만 — split/match/test 결과로 원본 변형 0) / 동일 입력 →
// 동일 동작(정상 plan 이면 항상 void 반환, 손상 plan 이면 항상 동일 위치 throw). raw
// 미저장(R-59 — 형태 검증만, 평가 본문 미접촉). 새 외부 dependency 0, DB write·
// migration 0, live LLM 호출 0.
//
// 책임 경계(task Out of Scope):
//   - `summary-batch-roster-plan-format.ts` 의 formatter 본문·출력 변경 0 — prefix
//     상수(`ROSTER_PLAN_PREFIX`)만 import 소비(single-source 정합, 라벨 drift 방지).
//     상수 export 한 줄 amend 외 format 모듈 무변경.
//   - 버킷 라벨은 `summary-batch-outcome.ts` 의 `GRANULARITY_BUCKETS` import 사용
//     (자체 정의 금지 — single-source 고정 순서 정합).
//   - 자동 복구 / plan 정규화 / drop / 재렌더 0 — 손상 plan 을 고치거나 잘라내지
//     않는다(fail-fast throw 만). 복구는 호출처 책임.
//   - 산출 경로 자동 배선(`previewRosterPlan`/`formatSummaryBatchRosterPlan`/
//     `formatSummaryBatchReport`/로그/journal 안에서 본 가드 호출) 0 — 순수 함수까지
//     (호출처 배선은 별도 wiring follow-up — T-0621/T-0627/T-0634 패턴 동형).
//   - JSON schema / 외부 validation 라이브러리(zod·ajv) 도입 0 — 순수 문자열 검사만.
//
// 패턴 mirror: summary-batch-report-shape.ts(T-0633) 가드(순수 함수 / 구조·타입 결손은
// TypeError / 값·형태 위반은 RangeError 구분 / 한국어 JSDoc·메시지 / 입력 비변형 /
// 결정성). 본 가드는 그 에러 정책·문구 톤을 mirror 하되 대상이 합본 2-라인 블록이
// 아니라 그 1번째 라인을 단독 산출하는 pre-flight 단일 라인 형태다.

import { GRANULARITY_BUCKETS } from "./summary-batch-outcome";
import { ROSTER_PLAN_PREFIX } from "./summary-batch-roster-plan-format";

// 개행 문자 — plan 라인은 단일 라인이므로 `\n` 이 0개여야 한다(formatSummaryBatchRosterPlan
// 산출 형태 정합 — 개행 0).
const LINE_SEP = "\n";

// PERSON_TOKEN — `person N명` 토큰(N 은 0 이상 정수). formatSummaryBatchRosterPlan 의
// `person ${personCount}명` 렌더 식과 정합. \d+ 로 0 이상 정수만 허용.
const PERSON_TOKEN = /person \d+명/;

// TOTAL_TOKEN — `· 총 N좌표 [` 토큰(N 은 0 이상 정수, 대괄호 시작 포함).
// formatSummaryBatchRosterPlan 의 `· 총 ${coordinates.length}좌표 [` 렌더 식과 정합.
const TOTAL_TOKEN = /· 총 \d+좌표 \[/;

/**
 * R-61 요약 평가 batch roster pre-flight "계획" 라인의 문서화된 형태 불변식을
 * 런타임에서 검증하는 순수 가드(PLAN.md P5 bullet 97 / REQ-061).
 *
 * 검증하는 불변식(single source — summary-batch-roster-plan-format.ts JSDoc·본문의
 * 코드 강제. prefix 상수 `ROSTER_PLAN_PREFIX`·버킷 라벨 `GRANULARITY_BUCKETS` 는 각
 * 모듈에서 import — drift 방지):
 *   ① `plan` 은 string 이어야 한다(null/undefined/비-string 금지).
 *   ② 개행(`\n`)이 0개여야 한다(= 정확히 단일 라인). 1개 이상이면 위반.
 *   ③ prefix `요약 평가 batch 예정: `(`ROSTER_PLAN_PREFIX`)로 시작해야 한다.
 *   ④ `person N명` 토큰이 등장해야 한다(N 은 0 이상 정수).
 *   ⑤ `· 총 N좌표 [` 토큰이 등장해야 한다(N 은 0 이상 정수, 대괄호 시작 포함).
 *   ⑥ 대괄호 안에 `day N · week N · month N · other N` 4 버킷 슬롯이
 *     `GRANULARITY_BUCKETS` single-source 고정 순서로 모두 등장해야 한다(각 N 은 0 이상
 *     정수). 슬롯 누락·순서 drift 시 위반.
 *
 * 에러 정책(구조/타입 결손 = TypeError / 형태 정합 위반 = RangeError):
 *   - `plan` 이 string 이 아님(①) → 한국어 TypeError.
 *   - 개행 혼입(②)·prefix 위반(③)·person 토큰 위반(④)·총 좌표 토큰 위반(⑤)·버킷
 *     슬롯 위반(⑥) → 한국어 RangeError. 메시지에 어느 불변식이 깨졌는지 포함.
 *   - silent 통과(위반인데 정상 반환) 0.
 *
 * 검사 순서: ① string → ② 개행 0 → ③ prefix → ④ person 토큰 → ⑤ 총 좌표 토큰 →
 * ⑥ 버킷 슬롯. 가장 먼저 위반한 지점에서 throw(fail-fast). prefix 를 토큰 검사보다
 * 먼저 검사해 prefix drift 가 ④⑤ 가 아니라 ③ 으로 정확히 진단되게 한다.
 *
 * 비변형 / 순수: `plan` 문자열을 읽기만 한다(split/match/test 는 새 값 생성 — 원본
 * 변형 0). 부수효과 0 · `@Injectable` 0 · Prisma 0 · LLM 0 · 새 외부 dependency 0.
 * 동일 plan → 동일 동작(정상 plan 이면 항상 void 반환, 손상 plan 이면 항상 동일 위치
 * throw).
 *
 * @param plan 검증 대상 pre-flight 계획 라인 문자열(`formatSummaryBatchRosterPlan`
 *   산출). 변형하지 않는다(읽기만).
 * @returns 형태 불변식 ①~⑥ 를 모두 만족하면 아무 일도 하지 않고 정상 반환(void).
 * @throws {TypeError} `plan` 이 string 이 아님(null/undefined/비-string — 구조/타입
 *   결손).
 * @throws {RangeError} 개행 혼입(②)·prefix 위반(③)·person 토큰 위반(④)·총 좌표 토큰
 *   위반(⑤)·버킷 슬롯 위반(⑥). 메시지에 어느 불변식이 깨졌는지 포함.
 */
export function assertSummaryBatchRosterPlanShape(plan: string): void {
  // ① string 타입 결손 — null/undefined/숫자/객체 등은 TypeError(구조 결손).
  if (typeof plan !== "string") {
    throw new TypeError(
      `plan 이 string 이 아니다(형태 검증 불가 — 값: ${String(plan)}).`,
    );
  }

  // ② 개행 0 = 정확히 단일 라인. 개행이 하나라도 있으면 위반(후행/중간 무관).
  // split 으로 라인 수 산출(원본 비변형 — 새 배열 생성).
  const lineCount = plan.split(LINE_SEP).length;
  if (lineCount !== 1) {
    throw new RangeError(
      `단일 라인 위반: plan 은 개행(\`\\n\`) 0개(정확히 1 라인)여야 한다(실제 ${lineCount} 라인).`,
    );
  }

  // ③ prefix `요약 평가 batch 예정: ` 로 시작해야 한다(라벨 + 공백 1개).
  if (!plan.startsWith(ROSTER_PLAN_PREFIX)) {
    throw new RangeError(
      `prefix 위반: '${ROSTER_PLAN_PREFIX}' 라벨로 시작해야 한다(실제 시작: '${plan.slice(0, ROSTER_PLAN_PREFIX.length)}').`,
    );
  }

  // ④ `person N명` 토큰 등장(N 은 0 이상 정수). 누락·형식 drift 시 RangeError.
  if (!PERSON_TOKEN.test(plan)) {
    throw new RangeError(
      "person 토큰 위반: 'person N명'(N 은 0 이상 정수) 토큰이 등장해야 한다.",
    );
  }

  // ⑤ `· 총 N좌표 [` 토큰 등장(N 은 0 이상 정수, 대괄호 시작 포함). 누락·대괄호 시작
  // drift 시 RangeError.
  if (!TOTAL_TOKEN.test(plan)) {
    throw new RangeError(
      "총 좌표 토큰 위반: '· 총 N좌표 ['(N 은 0 이상 정수, 대괄호 시작 포함) 토큰이 등장해야 한다.",
    );
  }

  // ⑥ 대괄호 안 4 버킷 슬롯 — GRANULARITY_BUCKETS single-source 고정 순서로 모두
  // 등장해야 한다(`day N · week N · month N · other N`, 각 N 은 0 이상 정수). 슬롯
  // 누락·순서 drift 를 한 정규식으로 검증(고정 순서 강제). 라벨/구분자는 상수에서
  // 합성(자체 정의 0 — single source 정합).
  const bucketSlots = GRANULARITY_BUCKETS.map(
    (bucket) => `${bucket} \\d+`,
  ).join(" · ");
  const bucketBlock = new RegExp(`\\[${bucketSlots}\\]`);
  if (!bucketBlock.test(plan)) {
    throw new RangeError(
      `버킷 슬롯 위반: 대괄호 안에 '${GRANULARITY_BUCKETS.join(" · ")}' 4 버킷이 고정 순서로 각 'N'(0 이상 정수)와 함께 등장해야 한다.`,
    );
  }
}
