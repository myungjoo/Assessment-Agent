// summary-batch-outcome-consistency — R-61 요약 평가 batch outcome 리포트 불변식
// 검증 순수 가드(PLAN.md P5 bullet 97 / REQ-061 "일/주/월 요약 평가"의 post-outcome
// 무결성 조각). `summarizeSummaryBatchOutcome`(T-0615)이 산출하는
// `SummaryBatchOutcomeReport` 는 JSDoc(summary-batch-outcome.ts L46~83)으로 3종의
// 불변식을 명시하지만, 그 불변식은 주석으로만 박제돼 있어 런타임에서 강제되지
// 않는다. 본 가드가 그 빈칸을 채운다 — report 가 불변식을 위반하면(집계 버그·수동
// 조립 오류·향후 merge/diff 헬퍼의 산출 손상) fail-fast 로 한국어 명세형 에러를
// 던져 손상된 리포트가 로그·notification·관측 surface 로 새는 것을 차단한다.
//
// 부수효과 0 / 외부 의존 0 / `@Injectable` 0 / Prisma 0 / LLM 호출 0 / repository 0 /
// 입력 비변형(report·byGranularity·하위 카운트 객체 읽기·비교만) / 동일 입력 →
// 동일 동작(정상 report 면 항상 정상 반환, 손상 report 면 항상 동일 위치 throw).
// raw 미저장(R-59) — 카운트 필드만 읽고 비교(summaryId/narrative 본문 미접촉). 새
// 외부 dependency 0, DB write·migration 0, live LLM 호출 0.
//
// 책임 경계(task Out of Scope):
//   - `summary-batch-outcome.ts` 의 report 구조·카운트 로직 변경 0(타입·const 만
//     `import` 소비, 재정의 0). 본 가드는 검증·throw 만.
//   - 자동 복구 / report 정규화 0 — 손상 report 를 고치거나 0 으로 clamp 하지 않는다
//     (fail-fast). 복구는 호출처 책임.
//   - 산출 경로 자동 배선(pipeline/orchestrator/formatter 안에서 본 가드 호출) 0 —
//     순수 함수까지(호출처 배선은 별도 follow-up slice).
//   - JSON schema / 외부 validation 라이브러리(zod·ajv) 도입 0 — 순수 산술 비교만.
//
// 패턴 mirror: summary-batch-outcome-format.ts(순수 함수 / null·undefined fail-fast
// 한국어 TypeError / `GRANULARITY_BUCKETS` single-source 순회 / 한국어 JSDoc). 본
// 가드는 그 파일을 import 하지 않으나 에러 메시지·가드 관례를 mirror 한다. 구조/타입
// 결손은 TypeError, 값 정합 위반은 RangeError 로 구분한다.

import {
  GRANULARITY_BUCKETS,
  type SummaryBatchOutcomeCounts,
  type SummaryBatchOutcomeReport,
} from "./summary-batch-outcome";

// COUNT_FIELDS — 분포 보존 invariant(불변식 3) 비교 대상 카운트 필드의 결정적 고정
// 순서 슬롯. 버킷합 === 전역 비교를 5 필드 각각에 대해 single-source 순회로 수행
// (`Object.keys` 순서 의존 0). total 은 evaluated+skipped 의 합이지만 독립적으로도
// 분포가 보존돼야 하므로 5 필드 모두 비교 대상에 포함한다.
const COUNT_FIELDS = [
  "total",
  "evaluated",
  "skipped",
  "created",
  "existing",
] as const;
type CountField = (typeof COUNT_FIELDS)[number];

// assertCountsStructure — 카운트 묶음이 구조적으로 온전한지(객체 존재 + 5 카운트
// 필드가 모두 유한 정수) fail-fast 검증. 구조/타입 결손은 RangeError 가 아니라
// TypeError 로 구분한다(값 정합 위반과 분리). `scope` 는 진단용 스코프 라벨
// (`전역` 또는 버킷명).
function assertCountsStructure(
  counts: SummaryBatchOutcomeCounts | null | undefined,
  scope: string,
): void {
  if (counts === null || counts === undefined) {
    throw new TypeError(
      `${scope} 카운트 묶음이 누락된 불완전 리포트일 수 없다.`,
    );
  }
  for (const field of COUNT_FIELDS) {
    const value = counts[field];
    if (typeof value !== "number" || !Number.isInteger(value)) {
      throw new TypeError(
        `${scope} 카운트 필드 '${field}' 가 정수가 아니다(값: ${String(value)}).`,
      );
    }
  }
}

// assertLocalInvariants — 한 스코프(전역 또는 한 버킷)의 카운트 묶음이 불변식(1)·(2)
// 를 만족하는지 검증. 위반 시 어느 불변식·어느 스코프가 깨졌는지 명시한 한국어
// RangeError 를 던진다.
//   (1) evaluated + skipped === total
//   (2) created + existing === evaluated
function assertLocalInvariants(
  counts: SummaryBatchOutcomeCounts,
  scope: string,
): void {
  if (counts.evaluated + counts.skipped !== counts.total) {
    throw new RangeError(
      `불변식(1) 위반 [${scope}]: evaluated(${counts.evaluated}) + skipped(${counts.skipped}) !== total(${counts.total}).`,
    );
  }
  if (counts.created + counts.existing !== counts.evaluated) {
    throw new RangeError(
      `불변식(2) 위반 [${scope}]: created(${counts.created}) + existing(${counts.existing}) !== evaluated(${counts.evaluated}).`,
    );
  }
}

/**
 * R-61 요약 평가 batch outcome 리포트의 문서화된 불변식 3종을 런타임에서 검증하는
 * 순수 가드(PLAN.md P5 bullet 97 / REQ-061).
 *
 * 검증하는 불변식(single source — summary-batch-outcome.ts L46~83 JSDoc 의 코드 강제):
 *   (1) `evaluated + skipped === total` — 전역 1회 + `GRANULARITY_BUCKETS` 4 버킷
 *       각 1회(총 5 스코프). 평가/skip 의 합이 분류된 총 개수와 일치해야 한다.
 *   (2) `created + existing === evaluated` — 전역 1회 + 4 버킷 각 1회(총 5 스코프).
 *       skip 은 result 부재라 created/existing 어느 쪽에도 미집계.
 *   (3) 분포 보존: 4 버킷의 각 카운트 필드(total/evaluated/skipped/created/existing)
 *       합 === 전역 동일 필드(5 필드 × 합 비교). 모든 entry 가 정확히 한 버킷에
 *       분류됨을 보증. 버킷 순회는 `GRANULARITY_BUCKETS` single source 고정 순서만
 *       사용(`Object.keys` 순서 의존 0).
 *
 * 에러 정책(구조 결손 = TypeError / 값 정합 위반 = RangeError):
 *   - `report` 또는 `report.byGranularity` 가 null/undefined → 한국어 TypeError.
 *   - 버킷 슬롯 누락 / 카운트 필드가 정수 아님 → 한국어 TypeError.
 *   - 불변식 (1)·(2)·(3) 위반 → 한국어 RangeError. 메시지에 어느 불변식(번호·식)·
 *     어느 스코프(`전역` 또는 버킷명 `day`/`week`/`month`/`other`)가 깨졌는지 포함.
 *   - silent 통과(위반인데 정상 반환) 0.
 *
 * 검사 순서: 구조(전역+버킷 존재·정수) → 전역 (1)·(2) → 각 버킷 (1)·(2) →
 * 분포 보존 (3). 가장 먼저 위반한 지점에서 throw(fail-fast).
 *
 * 비변형 / 순수: `report`·`byGranularity`·하위 카운트 객체를 읽기·비교만 한다(쓰기 0).
 * 부수효과 0 · `@Injectable` 0 · Prisma 0 · LLM 0 · 새 외부 dependency 0. 동일 report
 * → 동일 동작(정상 report 면 항상 void 반환, 손상 report 면 항상 동일 위치 throw).
 *
 * @param report 검증 대상 batch outcome 리포트. 변형하지 않는다(읽기·비교만).
 * @returns 불변식 3종을 모두 만족하면 아무 일도 하지 않고 정상 반환(void).
 * @throws {TypeError} `report`·`byGranularity`·버킷 슬롯 누락 또는 카운트 필드가
 *   정수 아님(구조/타입 결손).
 * @throws {RangeError} 불변식 (1)·(2)·(3) 중 하나라도 위반(값 정합 위반). 메시지에
 *   불변식 번호 + 스코프(전역/버킷명)를 포함.
 */
export function assertSummaryBatchOutcomeConsistent(
  report: SummaryBatchOutcomeReport,
): void {
  if (report === null || report === undefined) {
    throw new TypeError("report 가 null/undefined 일 수 없다.");
  }
  if (report.byGranularity === null || report.byGranularity === undefined) {
    throw new TypeError(
      "report.byGranularity 가 누락된 불완전 리포트일 수 없다.",
    );
  }

  // 구조 검증 — 전역 + 4 버킷 카운트 묶음이 존재하고 5 필드가 모두 정수인지.
  // GRANULARITY_BUCKETS single source 고정 순서 순회(슬롯 누락/오타 0).
  assertCountsStructure(report, "전역");
  for (const bucket of GRANULARITY_BUCKETS) {
    assertCountsStructure(report.byGranularity[bucket], bucket);
  }

  // 불변식 (1)·(2) — 전역 1회 + 각 버킷 1회(총 5 스코프). 전역을 먼저 검사한 뒤
  // 버킷을 건너뛰지 않고 모두 순회한다(버킷 단위 위반 catch).
  assertLocalInvariants(report, "전역");
  for (const bucket of GRANULARITY_BUCKETS) {
    assertLocalInvariants(report.byGranularity[bucket], bucket);
  }

  // 불변식 (3) 분포 보존 — 5 카운트 필드 각각에 대해 4 버킷 합 === 전역 동일 필드.
  // 버킷 순회는 GRANULARITY_BUCKETS single source 고정 순서만 사용.
  for (const field of COUNT_FIELDS) {
    let bucketSum = 0;
    for (const bucket of GRANULARITY_BUCKETS) {
      bucketSum += report.byGranularity[bucket][field];
    }
    if (bucketSum !== report[field]) {
      throw new RangeError(
        `불변식(3) 위반 [전역]: byGranularity 버킷합 '${field}'(${bucketSum}) !== 전역 '${field}'(${report[field]}) — 분포 보존 위반.`,
      );
    }
  }
}

// CountField 는 (3) 분포 보존 순회 타입 안전성을 위해 export 하지 않고 모듈 내부에서만
// 사용한다(공개 API 표면은 assertSummaryBatchOutcomeConsistent 1 개).
export type { CountField };
