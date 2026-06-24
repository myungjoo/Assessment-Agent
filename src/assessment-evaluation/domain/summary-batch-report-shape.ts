// summary-batch-report-shape — R-61 요약 평가 batch "계획 vs 결과" 합본 리포트 블록
// 형태 불변식 검증 순수 가드(PLAN.md P5 bullet 97 / REQ-061 "일/주/월 요약 평가"의
// presentation 무결성 조각). `formatSummaryBatchReport`(T-0630)는 JSDoc 으로 "정확히
// 2 라인 블록 — 1번째 라인 `계획: ` 라벨 + pre-flight 범위, 2번째 라인 `결과: ` 라벨 +
// outcome summaryLine, 개행 정확히 1개, 후행 개행 0" 이라는 출력 형태 불변식을 문서로만
// 박제했고, 그 합본 리포트는 T-0631 `reportBatch`·T-0632 `evaluateAndReportForRoster`
// 를 통해 service 경계로 외화돼 caller(로그·journal·향후 notification surface)가
// 흘려보낸다. 그러나 그 2-라인 블록 형태를 런타임에서 fail-fast 로 강제하는 가드가 없어,
// 합성 단계의 미래 회귀(라벨 drift·라인 수 변형·후행 개행 혼입·빈 라인 위장)가 발생하면
// 손상된 합본 리포트가 로그·notification surface 로 silent leak 한다. 본 가드가 그 빈칸을
// 채운다 — report 문자열이 형태 불변식을 위반하면 한국어 명세형 에러를 던져 손상 report
// 가 표현 surface 로 새는 것을 차단한다.
//
// 부수효과 0 / 외부 의존 0 / `@Injectable` 0 / Prisma 0 / LLM 호출 0 / repository 0 /
// 입력 비변형(report 문자열 읽기만 — split/match 결과로 원본 변형 0) / 동일 입력 → 동일
// 동작(정상 report 면 항상 void 반환, 손상 report 면 항상 동일 위치 throw). raw 미저장
// (R-59 — 형태 검증만, 평가 본문 미접촉). 새 외부 dependency 0, DB write·migration 0,
// live LLM 호출 0.
//
// 책임 경계(task Out of Scope):
//   - `summary-batch-report-format.ts` 의 formatter 본문·출력 변경 0 — 라벨 상수
//     (`PLAN_LABEL`/`RESULT_LABEL`)만 import 소비(single-source 정합, 라벨 drift 방지).
//     상수 export 한 줄 amend 외 format 모듈 무변경.
//   - 자동 복구 / report 정규화 / drop / 재렌더 0 — 손상 report 를 고치거나 잘라내지
//     않는다(fail-fast throw 만). 복구는 호출처 책임.
//   - 산출 경로 자동 배선(service/`reportBatch`/로그/journal/notification 안에서 본 가드
//     호출) 0 — 순수 함수까지(호출처 배선은 별도 wiring follow-up — T-0621/T-0627 패턴
//     동형).
//   - JSON schema / 외부 validation 라이브러리(zod·ajv) 도입 0 — 순수 문자열 검사만.
//
// 패턴 mirror: summary-batch-outcome-consistency.ts(T-0620)·
// summary-batch-roster-input-consistency.ts(T-0626) 가드(순수 함수 / 구조·타입 결손은
// TypeError / 값·형태 위반은 RangeError 구분 / 한국어 JSDoc·메시지 / 입력 비변형 /
// 결정성). 본 가드는 그 에러 정책·문구 톤을 mirror 하되 대상이 합본 표현(presentation)
// 형태(2 라인 블록·라벨 prefix·개행 수)다.

import { PLAN_LABEL, RESULT_LABEL } from "./summary-batch-report-format";

// 개행 구분자 — formatSummaryBatchReport 가 두 라인을 잇는 단일 개행과 정합(single
// source: summary-batch-report-format.ts L124~125). report 는 이 개행이 정확히 1개여야
// 한다(= 정확히 2 라인).
const LINE_SEP = "\n";

/**
 * R-61 요약 평가 batch "계획 vs 결과" 합본 리포트 블록의 문서화된 형태 불변식을
 * 런타임에서 검증하는 순수 가드(PLAN.md P5 bullet 97 / REQ-061).
 *
 * 검증하는 불변식(single source — summary-batch-report-format.ts L56~96 JSDoc 의 코드
 * 강제. 라벨 상수 `PLAN_LABEL`/`RESULT_LABEL` 은 그 모듈에서 import — drift 방지):
 *   ① `report` 는 string 이어야 한다(null/undefined/비-string 금지).
 *   ② 개행(`\n`)이 정확히 1개 = 정확히 2 라인. 0개(1 라인) 또는 2개 이상(3 라인+) 금지.
 *   ③ 후행 개행 금지 — `report` 가 `\n` 으로 끝나면 위반.
 *   ④ 1번째 라인이 `계획: `(`PLAN_LABEL`) 라벨로 시작하고 라벨 뒤 본문이 non-empty.
 *   ⑤ 2번째 라인이 `결과: `(`RESULT_LABEL`) 라벨로 시작하고 라벨 뒤 본문이 non-empty.
 *
 * 에러 정책(구조/타입 결손 = TypeError / 형태 정합 위반 = RangeError):
 *   - `report` 가 string 이 아님(①) → 한국어 TypeError.
 *   - 개행 수 위반(②)·후행 개행(③)·라벨/본문 위반(④⑤) → 한국어 RangeError. 메시지에
 *     어느 불변식·실제 라인 수 / 라벨이 깨졌는지 포함.
 *   - silent 통과(위반인데 정상 반환) 0.
 *
 * 검사 순서: ① string → ③ 후행 개행 → ② 개행 수(정확히 2 라인) → ④ 1번째 라인 →
 * ⑤ 2번째 라인. 가장 먼저 위반한 지점에서 throw(fail-fast). 후행 개행을 라인 수보다
 * 먼저 검사해 "2 라인 + 후행 개행"(개행 2개)이 ② 가 아니라 ③ 으로 진단되게 한다.
 *
 * 비변형 / 순수: `report` 문자열을 읽기만 한다(split/match 는 새 값 생성 — 원본 변형 0).
 * 부수효과 0 · `@Injectable` 0 · Prisma 0 · LLM 0 · 새 외부 dependency 0. 동일 report
 * → 동일 동작(정상 report 면 항상 void 반환, 손상 report 면 항상 동일 위치 throw).
 *
 * @param report 검증 대상 합본 리포트 문자열(`formatSummaryBatchReport` 산출). 변형하지
 *   않는다(읽기만).
 * @returns 형태 불변식 ①~⑤ 를 모두 만족하면 아무 일도 하지 않고 정상 반환(void).
 * @throws {TypeError} `report` 가 string 이 아님(null/undefined/비-string — 구조/타입
 *   결손).
 * @throws {RangeError} 개행 수 ≠ 1(②)·후행 개행(③)·1번째 라인 라벨/본문 위반(④)·
 *   2번째 라인 라벨/본문 위반(⑤). 메시지에 어느 불변식이 깨졌는지 포함.
 */
export function assertSummaryBatchReportShape(report: string): void {
  // ① string 타입 결손 — null/undefined/숫자/객체 등은 TypeError(구조 결손).
  if (typeof report !== "string") {
    throw new TypeError(
      `report 가 string 이 아니다(형태 검증 불가 — 값: ${String(report)}).`,
    );
  }

  // ③ 후행 개행 금지 — 라인 수 검사보다 먼저 검사해 "정상 2 라인 + 후행 개행"(개행
  // 2개)이 ② 가 아니라 ③ 으로 정확히 진단되게 한다(fail-fast 순서 의도).
  if (report.endsWith(LINE_SEP)) {
    throw new RangeError(
      "후행 개행 금지: report 는 후행 개행(`\\n`)으로 끝날 수 없다(정확히 2 라인).",
    );
  }

  // ② 개행 정확히 1개 = 정확히 2 라인. split 으로 라인 분해(원본 비변형 — 새 배열 생성).
  const lines = report.split(LINE_SEP);
  if (lines.length !== 2) {
    throw new RangeError(
      `라인 수 위반: report 는 정확히 2 라인(개행 1개)이어야 한다(실제 ${lines.length} 라인).`,
    );
  }
  const [planLine, resultLine] = lines;

  // ④ 1번째 라인 — `계획: ` 라벨 prefix + 라벨 뒤 본문 non-empty.
  if (!planLine.startsWith(PLAN_LABEL)) {
    throw new RangeError(
      `1번째 라인 라벨 위반: '${PLAN_LABEL}' 라벨로 시작해야 한다(실제 시작: '${planLine.slice(0, PLAN_LABEL.length)}').`,
    );
  }
  if (planLine.length <= PLAN_LABEL.length) {
    throw new RangeError(
      `1번째 라인 본문 위반: '${PLAN_LABEL}' 라벨 뒤 본문이 비어 있을 수 없다.`,
    );
  }

  // ⑤ 2번째 라인 — `결과: ` 라벨 prefix + 라벨 뒤 본문 non-empty.
  if (!resultLine.startsWith(RESULT_LABEL)) {
    throw new RangeError(
      `2번째 라인 라벨 위반: '${RESULT_LABEL}' 라벨로 시작해야 한다(실제 시작: '${resultLine.slice(0, RESULT_LABEL.length)}').`,
    );
  }
  if (resultLine.length <= RESULT_LABEL.length) {
    throw new RangeError(
      `2번째 라인 본문 위반: '${RESULT_LABEL}' 라벨 뒤 본문이 비어 있을 수 없다.`,
    );
  }
}
