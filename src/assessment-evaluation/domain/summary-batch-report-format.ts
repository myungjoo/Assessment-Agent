// summary-batch-report-format — R-61 요약 평가 batch "계획 vs 결과" 합본 사람-친화
// 두 라인 블록 순수 formatter(PLAN.md P5 bullet 97 / REQ-061 "일/주/월 요약 평가"의
// presentation 수렴 조각). p5-summary-aggregate stream 은 표현(presentation) 양 반쪽이
// 모두 닫혔다 — 입력(pre-flight)측은 `formatSummaryBatchRosterPlan`(T-0628) → service
// 경계 `previewRosterPlan`(T-0629)으로, 결과(outcome)측은 `formatSummaryBatchOutcome`
// (T-0622) → pipeline 산출 `summaryLine`(SummaryBatchPipelineResult.summaryLine)으로
// 닫혔다. 그러나 그 두 반쪽을 "무엇을 평가하려 했는가(계획) vs 무엇을 평가했는가(결과)"
// 한 블록으로 묶는 합본 표현은 빈칸이었다 — caller(로그·journal·향후 notification surface)가
// pre-flight 라인과 결과 `summaryLine` 을 각각 따로 받아 손수 이어 붙여야 했고, 잇는 관례
// (라벨·순서·구분자)가 caller 마다 drift 할 여지가 남았다. 본 formatter 가 그 빈칸을 채운다 —
// roster 로부터 pre-flight 범위 라인을 `formatSummaryBatchRosterPlan(roster)` 위임
// (재구현 0)으로 산출하고, batch 결과의 `result.summaryLine`(이미 `formatSummaryBatchOutcome`
// 으로 렌더된 결과 한 줄)을 가공 0 으로 재사용해, 두 라인을 결정적 한국어 라벨(`계획:` /
// `결과:`)과 함께 한 블록(개행 1개로 구분된 정확히 2 라인) 문자열로 묶는다. 이는 입력측·
// 결과측 두 single-source 라인의 단순 합성이며 — 새 표현 규칙을 발명하지 않고 두 라인을
// 라벨·구분만 부착해 잇는다.
//
// 부수효과 0 / 외부 의존 0 / `@Injectable` 0 / Prisma 0 / LLM 호출 0 / repository 0 /
// 입력 비변형(roster·result·result.summaryLine 읽기만) / 동일 입력 → byte-identical 출력
// (referential transparency) / 잔여 상태 누수 0. pre-flight 라인 산출은
// `formatSummaryBatchRosterPlan` 위임(재구현 0)으로 그 결정성·비변형·fail-fast 계약을
// 상속하고, 결과 라인은 `result.summaryLine`(이미 산출된 string)을 그대로 읽는다. 새 외부
// dependency 0 / DB write·migration 0 / live LLM 호출 0 / raw 미저장(R-59 — pre-flight
// 좌표 식별 축·결과 카운트만, 평가 본문 미접촉).
//
// 책임 경계(task Out of Scope):
//   - `summary-batch-roster-plan-format.ts` / `summary-batch-outcome-format.ts` /
//     `summary-batch-pipeline.ts` / `summary-batch-roster-input.ts` 변경 금지 —
//     import(type · 함수)·위임만. pre-flight formatter 본문·outcome formatter·pipeline
//     계약 무변경.
//   - 결과 라인 재렌더 금지 — 결과 라인은 `result.summaryLine`(이미 렌더됨)을 그대로
//     재사용. `formatSummaryBatchOutcome` 을 import·재호출하지 않는다(중복 렌더 0 —
//     single-source 라인 재사용).
//   - formatter 를 service/로그/journal/notification 에 배선(호출)하는 것은 별도 wiring
//     follow-up(T-0623·T-0629 가 formatter 를 service 경계로 외화한 패턴 동형). 본 task
//     는 순수 함수까지.
//   - JSON 직렬화 / i18n / markdown 표 / 템플릿 엔진 / 3 라인 이상 금지 — 한국어 2 라인
//     블록 문자열 하나만(계획 라인 + 결과 라인).
//   - manual-trigger HTTP endpoint / controller / DTO / RBAC 추가 0(Q-0030 ADR-gated).
//
// 패턴 mirror: summary-batch-outcome-format.ts / summary-batch-roster-plan-format.ts
// (순수 함수 / null·undefined 입력 fail-fast 한국어 TypeError / 결정적 출력 / 입력 비변형 /
// 한국어 JSDoc / 책임 경계 주석). 본 formatter 는 그 표현 관례·문구 톤을 mirror 하되 단일
// 라인이 아니라 두 single-source 라인을 라벨·구분으로 합성한다(역할 분리).
//
// T-0637 wiring: 합본 1번째 라인 본문(`formatSummaryBatchRosterPlan(roster)` 의 bare 산출)
// 에 `assertSummaryBatchRosterPlanShape(plan)`(T-0635) 형태 가드 단언을 PLAN_LABEL prepend
// 전·합성 전에 배선해, 손상 plan 라인(개행 혼입·prefix drift·person/총 좌표 토큰 누락·버킷
// 슬롯 누락·빈 라인 위장 미래 회귀)이 합본 리포트 합성·반환 단계에 도달하기 전 fail-fast
// 차단한다. T-0634 합본 report-shape 가드(블록 외형: 2 라인·라벨 prefix·단일 개행·후행
// 개행 0)는 1번째 라인 내부 plan 6 불변식을 검증하지 않으므로(책임 경계 분리), 본 가드가
// 그 silent leak 표면을 닫는다. T-0636 service `previewRosterPlan` 배선의 합본 mirror —
// 동일 가드를 별개 산출 지점(도메인 합본 formatter)에 적용(이중 단언 아님 — 별개 caller
// surface).

import { assertSummaryBatchOutcomeFormatShape } from "./summary-batch-outcome-format-shape";
import type { SummaryBatchPipelineResult } from "./summary-batch-pipeline";
import type { SummaryBatchRosterInput } from "./summary-batch-roster-input";
import { formatSummaryBatchRosterPlan } from "./summary-batch-roster-plan-format";
import { assertSummaryBatchRosterPlanShape } from "./summary-batch-roster-plan-shape";

// 합본 라벨 — single source(JSDoc 예시와 정합). 계획(pre-flight 범위) 먼저, 결과(outcome
// summaryLine) 다음의 결정적 고정 순서. 라벨·구분자는 본 formatter 가 발명하는 유일한
// 표현이며, 두 라인 본문은 각 single-source formatter 가 소유한다.
// 라벨 상수는 형태 검증 가드(summary-batch-report-shape.ts, T-0633)가 single-source
// 로 재사용하도록 export 한다 — 값·동작 무변경(상수 export 한 줄 amend). 라벨 drift
// 방지(가드가 본 모듈을 import 해 동일 라벨로 검증).
export const PLAN_LABEL = "계획: ";
export const RESULT_LABEL = "결과: ";

/**
 * R-61 요약 평가 batch 의 pre-flight 평가 범위(계획)와 outcome 결과를 **한 블록(정확히
 * 2 라인)** 사람-친화 결정적 한국어 문자열로 합성한다(PLAN.md P5 bullet 97 / REQ-061).
 * 입력측 `formatSummaryBatchRosterPlan`(T-0628) 과 결과측 `result.summaryLine`(이미
 * `formatSummaryBatchOutcome` 으로 렌더된 한 줄) 두 single-source 라인을 라벨·구분만
 * 부착해 잇는 단순 합성이다 — 새 표현 규칙 발명 0. caller(로그·journal·notification
 * surface)가 "무엇을 평가하려 했는가 vs 무엇을 평가했는가"를 한 눈에 박제할 표현 조각.
 *
 * 출력 형태(예시 — 정확한 문구는 본 함수가 single source):
 *   ```
 *   계획: 요약 평가 batch 예정: person 2명 · 총 6좌표 [day 2 · week 2 · month 2 · other 0]
 *   결과: 요약 평가 batch: 총 6건 · 평가 6 (생성 6 / 기존 0) · skip 0 [day 2(평가2) · week 2(평가2) · month 2(평가2) · other 0]
 *   ```
 *
 * 라인 ↔ source 매핑(single source — JSDoc):
 *   - 1번째 라인 = `${PLAN_LABEL}${formatSummaryBatchRosterPlan(roster)}` — pre-flight
 *     범위 라인(위임, 재구현 0). 계획 라벨(`계획: `)을 앞에 부착.
 *   - 2번째 라인 = `${RESULT_LABEL}${result.summaryLine}` — 이미 렌더된 결과 한 줄
 *     (가공 0 재사용). 결과 라벨(`결과: `)을 앞에 부착.
 *   - 두 라인은 개행 1개(`\n`)로 구분. 다중 개행·후행 개행 없음(정확히 2 라인).
 *
 * 결정성: 같은 (roster, result) → 항상 byte-identical 출력. pre-flight 라인은
 * `formatSummaryBatchRosterPlan` 의 결정성을, 결과 라인은 주어진 `summaryLine` 의
 * 불변성을 상속한다. 잔여 상태 누수 0(순수 함수, 매 호출 독립).
 *
 * 비변형: `roster`·`result`·`result.summaryLine` 을 읽기만 한다(쓰기 0). pre-flight
 * 라인 위임이 roster 를 변형하지 않고, 결과 라인은 string 을 읽기만 한다. 부수효과 0.
 *
 * @param roster pre-flight 라인 위임(`formatSummaryBatchRosterPlan`)이 소비할 roster
 *   입력. 변형하지 않는다(읽기만). null/undefined 면 위임의 한국어 `TypeError` 전파.
 * @param result batch pipeline 산출(`SummaryBatchPipelineResult`). 본 formatter 는
 *   `result.summaryLine`(이미 렌더된 string) 만 읽는다 — plan/outcomes/report 미접촉.
 *   변형하지 않는다(읽기만).
 * @returns 결정적 한국어 2 라인 블록 문자열(개행 정확히 1개, 후행 개행 0).
 * @throws {TypeError} `result` 가 null/undefined 일 때(직접 가드 — `result.summaryLine`
 *   역참조 전에), 또는 `result.summaryLine` 이 string 이 아닐 때(누락 등). `roster`
 *   null/undefined · enumerate 위임의 TypeError 는 `formatSummaryBatchRosterPlan`
 *   위임에서 전파(swallow 0). 또한 `assertSummaryBatchRosterPlanShape`(T-0637 wiring)가
 *   던지는 구조 결손 TypeError(plan 이 string 이 아닌 미래 회귀 — 형태 가드 본문
 *   single-source 참조 `summary-batch-roster-plan-shape.ts`). 또한
 *   `assertSummaryBatchOutcomeFormatShape`(T-0639 wiring)가 던지는 구조 결손 TypeError
 *   (outcome 라인이 string 이 아닌 미래 회귀 — 형태 가드 본문 single-source 참조
 *   `summary-batch-outcome-format-shape.ts`. 단 L129 string 가드가 이미 string 을 보장하므로
 *   실제 도달은 드물다).
 * @throws {RangeError} `roster.granularities` 에 알 수 없는 period 가 포함될 때
 *   `formatSummaryBatchRosterPlan` 위임 helper 의 RangeError 전파. 또한
 *   `assertSummaryBatchRosterPlanShape`(T-0637 wiring)가 던지는 형태 위반 RangeError
 *   (개행 혼입·prefix drift·person/총 좌표 토큰 누락·버킷 슬롯 누락·빈 라인 위장 미래
 *   회귀 — 형태 가드 본문 single-source 참조 `summary-batch-roster-plan-shape.ts`). 또한
 *   `assertSummaryBatchOutcomeFormatShape`(T-0639 wiring)가 던지는 outcome 라인 형태 위반
 *   RangeError(개행 혼입·prefix drift `요약 평가 batch: 총 `·카운트 토큰 누락·버킷 슬롯
 *   누락·순서 뒤바뀜·빈 라인 위장 미래 회귀 — 형태 가드 본문 single-source 참조
 *   `summary-batch-outcome-format-shape.ts`). 가드 throw 시 합본 리포트 합성·반환 단계
 *   미도달(손상 plan/outcome 라인이 합본으로 새는 것 차단).
 */
export function formatSummaryBatchReport(
  roster: SummaryBatchRosterInput,
  result: SummaryBatchPipelineResult,
): string {
  // result 자체의 null/undefined 만 본 formatter 가 직접 가드한다(`result.summaryLine`
  // 역참조 전 fail-fast — 한국어 메시지 진단성). roster 의 null/undefined·필드 무결성은
  // pre-flight 라인 위임(formatSummaryBatchRosterPlan → enumerate 가드)에 위임한다
  // (이중 검증 발명 0 — sibling formatter 의 직접 가드 mirror).
  if (result === null || result === undefined) {
    throw new TypeError("result 가 null/undefined 일 수 없다.");
  }
  // summaryLine 이 string 이 아니면(누락 등) silent 빈 라인 위장을 차단한다(fail-fast).
  if (typeof result.summaryLine !== "string") {
    throw new TypeError(
      "result.summaryLine 이 누락된 불완전 결과(string 아님)일 수 없다.",
    );
  }

  // pre-flight 범위 라인 — formatSummaryBatchRosterPlan 위임(재구현 0). roster
  // null/undefined TypeError, enumerate 위임의 TypeError/RangeError 가 여기서 전파된다
  // (fail-fast, swallow 0). roster 비변형 계약도 위임으로 상속.
  //
  // 산출 흐름(T-0637 wiring):
  //   1. `const plan = formatSummaryBatchRosterPlan(roster)` — bare pre-flight 라인 산출
  //      (PLAN_LABEL prepend 전 — 가드의 prefix 불변식 ③ 은 bare plan 라인이 `요약 평가
  //      batch 예정: ` 로 시작함을 요구하므로 라벨 부착 전 단언이 필수. 라벨 부착 후
  //      단언하면 prefix 가 `계획: 요약 평가 batch 예정: ...` 가 되어 false-positive throw).
  //   2. `assertSummaryBatchRosterPlanShape(plan)` — 1 의 bare 산출이 형태 불변식
  //      (① string · ② 개행 0 · ③ prefix `요약 평가 batch 예정: ` · ④ `person N명` 토큰 ·
  //      ⑤ `· 총 N좌표 [` 토큰 · ⑥ `[day N · week N · month N · other N]` 4 버킷 슬롯 고정
  //      순서)을 만족하는지 단언(single-source `summary-batch-roster-plan-shape.ts`).
  //      정합이면 void 반환(무회귀), 위반이면 TypeError(구조 결손)/RangeError(형태 위반)
  //      전파해 손상 plan 라인이 합본 리포트 합성·반환 단계에 도달하기 전 차단.
  //   3. `${PLAN_LABEL}${plan}` — 가드 통과한 정상 plan 라인 앞에 결정적 라벨 부착(합성).
  //
  // T-0636 service `previewRosterPlan` 배선과 동형이되, 이번엔 도메인 합본 formatter 내부의
  // 별개 산출 지점(합본 1번째 라인) 이 대상. 가드 단언은 두 산출 지점(service preview ·
  // 합본 report formatter)에서 각각 배선되어 — 이중 단언이 아니라 별개 caller surface 에서의
  // 동일 형태 가드 적용(p5-summary-aggregate stream presentation 가드 완결).
  const plan = formatSummaryBatchRosterPlan(roster);
  assertSummaryBatchRosterPlanShape(plan);
  const planLine = `${PLAN_LABEL}${plan}`;

  // 결과 라인 — 이미 렌더된 result.summaryLine 을 가공 0 으로 재사용(중복 렌더 0 —
  // formatSummaryBatchOutcome 재호출 없음). 결과 라벨만 앞에 부착.
  //
  // T-0639 wiring(T-0637 plan-line mirror): RESULT_LABEL prepend·resultLine 합성 **전**에
  // bare `result.summaryLine`(이미 formatSummaryBatchOutcome 으로 렌더된 outcome 한 줄)을
  // assertSummaryBatchOutcomeFormatShape 로 단언한다. 가드의 prefix 불변식 ③ 은 bare
  // outcome 라인이 `요약 평가 batch: 총 ` 으로 시작함을 요구하므로 라벨 부착 전 단언이 필수
  // (라벨 부착 후 `결과: 요약 평가 batch: ...` 에 단언하면 prefix 불일치 false-positive
  // throw). 정합이면 void 반환(무회귀), 위반이면 RangeError(형태 위반: 개행 혼입·prefix
  // drift·카운트 토큰 누락·버킷 슬롯 누락·순서 뒤바뀜·빈 라인 위장)/TypeError(구조 결손)를
  // 전파해 손상 outcome 라인이 합본 리포트 합성·반환 단계에 도달하기 전 fail-fast 차단한다.
  // L129 string 가드(book-keeping)는 그대로 두고(기존 한국어 메시지 보존), 본 가드는 그
  // 통과 후 형태 불변식(②~⑤)을 추가 검증한다(single-source `summary-batch-outcome-format-
  // shape.ts`). T-0634 report-shape 가드(블록 외형)는 2번째 라인 내부 outcome 6 불변식을
  // 검증하지 않으므로(책임 경계 분리) 본 가드가 그 silent leak 표면을 닫는다.
  assertSummaryBatchOutcomeFormatShape(result.summaryLine);
  const resultLine = `${RESULT_LABEL}${result.summaryLine}`;

  // 두 라인을 개행 1개로 합성 — 정확히 2 라인(계획 먼저 · 결과 다음). 후행 개행 0.
  return `${planLine}\n${resultLine}`;
}
