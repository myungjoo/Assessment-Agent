// summary-batch-outcome-format — R-61 요약 평가 batch outcome 리포트 사람-친화
// 한 줄 요약 순수 formatter(PLAN.md P5 bullet 97 / REQ-061 "일/주/월 요약 평가"의
// presentation 조각). `summarizeSummaryBatchOutcome`(T-0615)이 산출한 머신리더블
// `SummaryBatchOutcomeReport`(전역 카운트 + byGranularity 분포)를 로그·journal·
// 향후 notification surface 가 그대로 흘려보낼 **결정적 한국어 단일 라인 문자열**로
// 렌더링한다. 빈칸이던 표현(presentation) layer 를 채우는 조각.
//
// 부수효과 0 / 외부 의존 0 / `@Injectable` 0 / Prisma 0 / LLM 호출 0 / repository 0 /
// 입력 비변형(report·byGranularity·하위 카운트 객체 읽기만) / 동일 입력 → 동일 출력
// (referential transparency). raw 미저장(R-59) — report 는 카운트만 보유하므로
// formatter 도 summaryId/narrative 본문을 렌더링하지 않는다(카운트만). 새 외부
// dependency 0, DB write·migration 0, live LLM 호출 0.
//
// 책임 경계(task Out of Scope):
//   - `summary-batch-outcome.ts` 의 report 구조·카운트 로직은 본 task 가 건드리지
//     않는다(표현 layer 만). 단 슬롯 순서 single-source 재사용을 위해 그 파일의
//     `GRANULARITY_BUCKETS` const 에 `export` 키워드만 추가(값/순서 무변경).
//   - JSON 직렬화 / 다국어(i18n) / 템플릿 엔진 / markdown 표는 별도 후속. 본 formatter
//     는 한국어 단일 라인 문자열 하나만.
//   - formatter 를 어디서 호출(로그·notification)할지 배선은 별도 slice. 본 task 는
//     순수 함수까지.
//
// 패턴 mirror: summary-batch-outcome.ts / summary-batch-plan.ts(순수 함수 /
// null·undefined 입력 fail-fast 한국어 TypeError / 결정적 출력 / 입력 비변형 /
// 한국어 JSDoc). 분포 슬롯을 single-source `GRANULARITY_BUCKETS` 순회로 결정적
// 고정 순서 렌더링하는 관례도 동형.

import {
  GRANULARITY_BUCKETS,
  type SummaryBatchOutcomeReport,
} from "./summary-batch-outcome";

// OUTCOME_LINE_PREFIX — outcome 한 줄 요약의 라벨 prefix(라벨 + 공백 1개). single
// source 로 export 해 형태 검증 가드(summary-batch-outcome-format-shape.ts, T-0638)가
// 동일 상수를 import 소비하도록 한다(라벨 drift 방지). 값·렌더 동작 무변경 — 아래 head
// template literal 이 본 상수를 소비할 뿐(byte-identical 출력 보존). ROSTER_PLAN_PREFIX
// (summary-batch-roster-plan-format.ts)의 outcome-side mirror.
export const OUTCOME_LINE_PREFIX = "요약 평가 batch: ";

/**
 * R-61 요약 평가 batch outcome 리포트를 **사람-친화 결정적 한국어 단일 라인**으로
 * 렌더링한다(PLAN.md P5 bullet 97 / REQ-061).
 *
 * 출력 형태(예시 — 정확한 문구는 본 함수가 single source):
 *   `요약 평가 batch: 총 3건 · 평가 2 (생성 1 / 기존 1) · skip 1 [day 1(평가1) · week 1(평가1) · month 1(skip1) · other 0]`
 *
 * 필드 ↔ 문구 매핑(single source — JSDoc):
 *   - `report.total`     → `총 N건`.
 *   - `report.evaluated` → `평가 N`(평가·영속화 완료, result 존재).
 *   - `report.created`   → `평가 N (생성 C / 기존 E)` 의 `생성 C`(새 summary row).
 *   - `report.existing`  → 위 괄호의 `기존 E`(기존 read-through, first-write-wins,
 *     ADR-0037).
 *   - `report.skipped`   → `skip N`(시점 미도래 skip, write 0).
 *   - `report.byGranularity` → 대괄호 `[...]` 안의 버킷별 분포. `GRANULARITY_BUCKETS`
 *     (day → week → month → other) single source 순회로 **결정적 고정 순서** 렌더.
 *     값 0 버킷도 슬롯 누락 없이 등장(`other 0`). 각 버킷은 `<bucket> <total>` 이며
 *     평가/skip 이 섞이면 `(평가E·skipS)`, 한 쪽만이면 `(평가E)` / `(skipS)`, total 0
 *     이면 카운트 괄호 생략(`other 0`).
 *
 * 결정성: 같은 report → 항상 byte-identical 출력(개행 0, 단일 라인). `Object.keys`
 * 순서 의존 0 — 버킷 순회는 `GRANULARITY_BUCKETS` 고정 순서만 사용. 잔여 상태 누수 0
 * (순수 함수, 매 호출 독립).
 *
 * 비변형: `report`·`byGranularity`·하위 카운트 객체를 읽기만 한다(쓰기 0). 부수효과 0.
 *
 * @param report T-0615 `summarizeSummaryBatchOutcome` 산출의 batch outcome 리포트.
 *   변형하지 않는다(읽기만). 전역 5 카운트(total/evaluated/skipped/created/existing)
 *   + `byGranularity` 4 버킷이 모두 문자열에 등장한다.
 * @returns 결정적 한국어 단일 라인 요약 문자열(개행 0). 빈 batch(total 0)도 빈 문자열이
 *   아니라 `총 0건` 을 명시한다.
 * @throws {TypeError} `report` 가 null/undefined 이거나 `report.byGranularity` 가
 *   누락(undefined)된 불완전 객체일 때(silent 빈 문자열 위장 차단).
 */
export function formatSummaryBatchOutcome(
  report: SummaryBatchOutcomeReport,
): string {
  if (report === null || report === undefined) {
    throw new TypeError("report 가 null/undefined 일 수 없다.");
  }
  if (report.byGranularity === null || report.byGranularity === undefined) {
    throw new TypeError(
      "report.byGranularity 가 누락된 불완전 리포트일 수 없다.",
    );
  }

  // 전역 요약 — 5 카운트(total/evaluated/created/existing/skipped)를 모두 노출.
  const head =
    `${OUTCOME_LINE_PREFIX}총 ${report.total}건` +
    ` · 평가 ${report.evaluated} (생성 ${report.created} / 기존 ${report.existing})` +
    ` · skip ${report.skipped}`;

  // 버킷 분포 — GRANULARITY_BUCKETS single source 고정 순서 순회(결정적). 값 0 버킷도
  // 슬롯 누락 없이 등장. report 의 "전 버킷 키 존재" invariant 를 상속(키 부재 시 가드).
  const buckets = GRANULARITY_BUCKETS.map((bucket) => {
    const counts = report.byGranularity[bucket];
    if (counts === null || counts === undefined) {
      throw new TypeError(
        `report.byGranularity['${bucket}'] 버킷이 누락된 불완전 리포트일 수 없다.`,
      );
    }
    return `${bucket} ${counts.total}${formatBucketDetail(counts.evaluated, counts.skipped)}`;
  }).join(" · ");

  return `${head} [${buckets}]`;
}

// formatBucketDetail — 버킷의 evaluated/skipped 세부를 괄호 문구로. 둘 다 0(빈 버킷)
// 이면 빈 문자열(괄호 생략 → `other 0`). 한 쪽만 있으면 그 한 쪽만(`(평가2)` /
// `(skip1)`). 둘 다 있으면 `(평가E·skipS)`. 결정적(순서 고정: 평가 → skip).
function formatBucketDetail(evaluated: number, skipped: number): string {
  const parts: string[] = [];
  if (evaluated > 0) {
    parts.push(`평가${evaluated}`);
  }
  if (skipped > 0) {
    parts.push(`skip${skipped}`);
  }
  if (parts.length === 0) {
    return "";
  }
  return `(${parts.join("·")})`;
}
