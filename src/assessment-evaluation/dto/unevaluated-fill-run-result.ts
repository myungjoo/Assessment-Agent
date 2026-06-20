// unevaluated-fill-run-result — P5 bullet 106(R-64 / REQ-037 "평가 없는 부분 일괄
// 평가" / REQ-038) detection→consume 사슬의 plan→execute 전이 4 번째 순수 조각으로,
// **출력-side(batch-run 요약)** shape 과 집계 규칙을 닫는다. 입력-side 3 조각
// (T-0549 batch plan → `UnevaluatedFillRequest[]` 평탄화, T-0550 요청 intent →
// `PeriodBridgeDto[]` 매핑, T-0551 좌표 중복 first-wins 제거)이 일괄 평가에 넘길
// 깨끗한 입력(중복 제거된 좌표 배열)을 닫았다. 본 helper 는 그 좌표를 **실제로 흘린
// 뒤** per-좌표 실행 outcome 배열을 받아 호출자/UI 에게 돌려줄 batch-run 요약 shape
// `UnevaluatedFillRunResult` 로 접는 dependency-free 순수 함수다. 입력-side 의 T-0546
// (`toUnevaluatedFillPlanResponse` — 계획을 응답 shape 으로 직렬화)의 출력-side 대칭 짝.
//
// 책임:
//   per-좌표 실행 outcome 배열(각 좌표 4 축 + 결정적 status)을 1 회 순회해 status 별
//   좌표 수(evaluated/skipped/failed)와 evaluated outcome 들의 생성 평가 건수 합
//   (totalEvaluatedRecords)을 결정적으로 산출한다. outcome 순서는 입력 그대로 보존
//   (재정렬/dedup/필터 0 — 같은 좌표가 두 번 실행됐으면 둘 다 보존).
//
// 경계(task Out of Scope):
//   - 본 helper 는 **outcome 을 만들지 않는다** — impure orchestrator wiring(중복 제거된
//     `PeriodBridgeDto[]` → per-좌표 fresh-collect → LLM 평가 → 영속 → outcome 산출)의
//     책임이며, 그 wiring 은 live-LLM standing 게이트(ADR-0045)에 묶여 deferred 다. 본
//     helper 는 **이미 산출된 outcome 의 순수 집계만**.
//   - controller 실행 route(POST .../unevaluated-fill-run) 신설 — 후속 slice.
//   - `EvaluationResult` 타입 직접 import / 평가문 본문·narrative 보유 — 0. 본 helper 는
//     건수(count)와 status 만 집계한다(REQ-032 raw-not-stored 정합 — 평가 본문은 영속
//     layer 책임).
//   - class-validator 런타임 validate 호출 — controller-scope ValidationPipe 책임. 본
//     helper 는 plain 객체만 다룬다(런타임 validate 호출 0).
//
// 패턴 mirror: unevaluated-fill-plan-response.mapper.ts / dedupe-period-bridge-requests.ts
// (null/undefined·non-array fail-fast 한국어 `TypeError`(인덱스 포함) + 비변형 +
// @Injectable 0 + Prisma/LLM import 0). status union 의 single-source 배열 const +
// `satisfies` compile-time 동기는 evaluation-result.ts CONTRIBUTION_LEVELS 패턴 mirror.
// 순수성: `@Injectable` 0, NestJS/Prisma/LLM/class-validator/repository import 0
// — 자기 타입 정의만(외부 import 0). 부수효과 0, 입력 비변형. 새 외부 dependency 0.

// UnevaluatedFillRunStatus — per-좌표 일괄 평가 실행 결과의 결정적 status union.
//   `"evaluated"` : 좌표를 실제로 평가해 평가문을 생성·영속했다.
//   `"skipped"`   : 평가하지 않고 건너뛰었다(예: first-write-wins 로 이미 존재).
//   `"failed"`    : 평가 시도가 실패했다(예: 수집 0 / LLM 오류).
export type UnevaluatedFillRunStatus = "evaluated" | "skipped" | "failed";

// UNEVALUATED_FILL_RUN_STATUSES — UnevaluatedFillRunStatus union 의 전 멤버를 배열로
// 노출하는 single source. 본 helper 가 outcome.status 멤버십을 런타임 검증할 때 기준이
// 된다. `satisfies` 로 union 과 배열의 동기성(멤버 누락 / 오타)을 compile-time 강제한다
// (evaluation-result.ts CONTRIBUTION_LEVELS 패턴 mirror).
export const UNEVALUATED_FILL_RUN_STATUSES = [
  "evaluated",
  "skipped",
  "failed",
] as const satisfies readonly UnevaluatedFillRunStatus[];

// isUnevaluatedFillRunStatus — 임의 값이 허용 status 집합의 멤버인지 판정하는 순수
// type-guard. outcome.status 의 유효성을 런타임에 좁힐 때 사용한다(isContributionLevel
// 패턴 mirror).
export function isUnevaluatedFillRunStatus(
  value: unknown,
): value is UnevaluatedFillRunStatus {
  return (UNEVALUATED_FILL_RUN_STATUSES as readonly unknown[]).includes(value);
}

/**
 * per-좌표 일괄 평가 실행 outcome — 좌표 4 축(coordinate echo) + 결정적 status.
 *
 * 좌표 4 축(personId / period / scope / periodStart:string)은 `PeriodBridgeDto` 와
 * 동형이라 호출자가 어느 좌표의 결과인지 식별할 수 있게 그대로 보유한다(coordinate echo).
 * class-validator decorator 는 controller-scope ValidationPipe 책임이라 본 outcome 은
 * plain 객체로 다룬다(런타임 validate 호출 0).
 */
export interface UnevaluatedFillRunOutcome {
  personId: string;
  period: string;
  scope: string;
  // PeriodBridgeDto.periodStart 와 동형의 string 축(이미 ISO string — 추가 직렬화 불요).
  periodStart: string;
  // 실행 결과 결정적 status.
  status: UnevaluatedFillRunStatus;
  // evaluated 시 생성된 평가 건수(≥ 0 정수). 미설정은 합산에서 0 으로 취급한다.
  evaluatedCount?: number;
  // skipped / failed 사유 메모(선택). 집계에는 쓰이지 않는 사람-친화 echo.
  reason?: string;
}

/**
 * 미평가 fill batch-run 요약 shape — per-좌표 outcome 리스트 + status 별 집계.
 *
 * 도메인 outcome 배열을 status 별 좌표 수와 생성 평가 건수 합으로 접은 결정적 요약이다.
 * 입력-side 의 `UnevaluatedFillPlanResponse`(totalGapCount / personCount 집계)의 출력-side
 * 대칭 짝.
 */
export interface UnevaluatedFillRunResult {
  // 입력 순서를 그대로 보존한 per-좌표 outcome 리스트(재정렬/dedup/필터 0).
  outcomes: UnevaluatedFillRunOutcome[];
  // 전체 outcome 수(== outcomes.length).
  totalCount: number;
  // status 별 좌표 수. evaluatedCount + skippedCount + failedCount === totalCount.
  evaluatedCount: number;
  skippedCount: number;
  failedCount: number;
  // evaluated outcome 들의 `evaluatedCount` 합(미설정은 0 으로 취급). evaluated 가 아닌
  // status 의 evaluatedCount 는 합산하지 않는다(status-aware sum).
  totalEvaluatedRecords: number;
}

/**
 * per-좌표 미평가 fill 실행 outcome 배열을 batch-run 요약 shape 으로 결정적으로 집계하는
 * 순수 함수(P5 bullet 106 / R-64 / REQ-037 detection→consume 사슬의 출력-side 조각).
 *
 * 집계 규칙:
 *   - outcomes : 새 배열로 복사(입력 비변형). 입력 순서·각 원소 객체 참조를 그대로 보존
 *                (재정렬/dedup/필터 0 — 같은 좌표가 두 번 실행됐으면 둘 다 보존).
 *   - totalCount : outcomes.length.
 *   - evaluatedCount / skippedCount / failedCount : status 별 좌표 수.
 *     불변식 evaluatedCount + skippedCount + failedCount === totalCount.
 *   - totalEvaluatedRecords : **evaluated status outcome 들의** `evaluatedCount` 합
 *     (status-aware sum). 미설정(undefined)은 0 으로 취급한다. evaluated 가 아닌 status 의
 *     evaluatedCount 는 합산하지 않는다(skipped/failed 에 잔존 카운트가 있어도 무시).
 *
 * 방어(fail-fast 한국어 TypeError):
 *   - outcomes 가 null/undefined·non-array → `TypeError`.
 *   - 배열 원소가 null/undefined → `TypeError`(인덱스 포함).
 *   - 원소의 status 가 허용 union 멤버가 아님 → `TypeError`(인덱스 포함).
 *   - evaluated 원소의 evaluatedCount 가 음수 / 비정수 → `TypeError`(인덱스 포함).
 *     (evaluatedCount 가 설정된 경우에만 검사 — undefined 는 0 으로 정상 취급.)
 *
 * @param outcomes per-좌표 실행 outcome 배열. 변형하지 않는다. null/undefined·non-array·
 *   원소 null/undefined·비-union status·잘못된 evaluatedCount 시 한국어 `TypeError`.
 * @returns `UnevaluatedFillRunResult` — 새 객체. outcomes 는 입력 순서를 보존한 새 배열
 *   (원소는 입력 객체 참조 재사용).
 * @throws {TypeError} 위 방어 조건 위반 시(메시지에 인덱스 포함).
 */
export function aggregateUnevaluatedFillRunResult(
  outcomes: UnevaluatedFillRunOutcome[],
): UnevaluatedFillRunResult {
  // outcomes 자체 방어 — null/undefined·non-array 면 한국어 메시지 TypeError 로 fail-fast
  // (silent 진행 시 아래 순회가 opaque TypeError 를 던지므로, 명시적 메시지로 조기 노출).
  if (!Array.isArray(outcomes)) {
    throw new TypeError(
      `aggregateUnevaluatedFillRunResult: outcomes 는 배열이어야 한다: ${String(outcomes)}`,
    );
  }

  let evaluatedCount = 0;
  let skippedCount = 0;
  let failedCount = 0;
  let totalEvaluatedRecords = 0;

  outcomes.forEach((outcome, index) => {
    // 원소 방어 — null/undefined 면 한국어 메시지 TypeError(인덱스 포함)로 조기 노출
    // (silent skip 시 그 좌표의 실행 결과가 집계에서 누락되어 카운트 불변식이 깨진다).
    if (outcome === null || outcome === undefined) {
      throw new TypeError(
        `aggregateUnevaluatedFillRunResult: outcomes[${index}] outcome 원소가 null/undefined 일 수 없다.`,
      );
    }

    // status 방어 — 허용 union 멤버가 아니면(예 "done" / undefined) 한국어 메시지
    // TypeError(인덱스 포함). 비-union status 가 silent 통과하면 어느 카운트에도 잡히지
    // 않아 합 불변식이 깨진다(evaluatedCount + skippedCount + failedCount !== totalCount).
    if (!isUnevaluatedFillRunStatus(outcome.status)) {
      throw new TypeError(
        `aggregateUnevaluatedFillRunResult: outcomes[${index}].status 가 허용 status(evaluated/skipped/failed)가 아니다: ${String(outcome.status)}`,
      );
    }

    // status 별 좌표 수 누적 + evaluated 의 생성 평가 건수 합산(status-aware sum).
    switch (outcome.status) {
      case "evaluated": {
        evaluatedCount += 1;
        // evaluatedCount 미설정(undefined)은 0 으로 취급. 설정된 경우만 음수/비정수 방어.
        const records = outcome.evaluatedCount;
        if (records !== undefined) {
          if (!Number.isInteger(records) || records < 0) {
            throw new TypeError(
              `aggregateUnevaluatedFillRunResult: outcomes[${index}].evaluatedCount 는 0 이상의 정수여야 한다: ${String(records)}`,
            );
          }
          totalEvaluatedRecords += records;
        }
        break;
      }
      case "skipped":
        skippedCount += 1;
        break;
      case "failed":
        failedCount += 1;
        break;
    }
  });

  return {
    // 새 배열로 복사 — 입력 outcomes 비변형. 입력 순서·각 원소 객체 참조 그대로 보존.
    outcomes: outcomes.slice(),
    totalCount: outcomes.length,
    evaluatedCount,
    skippedCount,
    failedCount,
    totalEvaluatedRecords,
  };
}
