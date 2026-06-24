// realdata-e2e-result-issue-descriptor-body-consistency.ts — 실 평가 e2e 결과 이슈
// descriptor body 3 블록 구조 불변식 검증 순수 가드(T-0646 박제).
//
// 책임:
//   - `buildRealDataResultIssueDescriptor`(T-0582/T-0645, `realdata-e2e-result-issue-descriptor.ts`)
//     가 산출하는 `RealDataResultIssueDescriptor.body` 는
//     `[marker, "", formatRealDataResultSummaryLine(summary), "", renderRealDataResultSummaryMarkdown(summary)].join("\n")`
//     3 블록 구조(marker → 빈 줄 → 한 줄 요약 → 빈 줄 → markdown) 로 합성된다. 그러나
//     그 3 블록 구조 불변식 — ① 첫 라인 = marker / ② 한 줄 요약 라인이
//     `formatRealDataResultSummaryLine(summary)` 산출과 byte-identical 하게 정확히 1 회
//     등장 / ③ markdown 본문이 `renderRealDataResultSummaryMarkdown(summary)` 산출과
//     byte-identical / ④ 세 블록이 빈 줄 1 개로 구분 — 은 빌더 본문 주석과 T-0645 spec
//     happy-path 단언으로만 박제돼 있고 **런타임에서 강제되는 독립 불변식 가드가
//     부재** 한다. 본 가드가 그 빈칸을 채운다. 손상된 descriptor 가 gh issue 실배선·
//     rolling 이슈 surface 로 새기 전 fail-fast throw 로 차단한다.
//
// 부수효과 0 / 외부 의존 0 / `@Injectable` 0 / Prisma 0 / LLM 호출 0 / repository 0 /
// 입력 비변형(descriptor·summary·byDifficulty·byContribution 객체 읽기·비교만) /
// 동일 입력 → 동일 동작(정상 descriptor 면 항상 void 반환, 손상 descriptor 면 항상
// 동일 위치 throw). raw 미저장(R-59) — body 의 count·volume·분포·markdown 카운트만
// 비교(narrative/raw 본문 미접촉). 새 외부 dependency 0, DB write·migration 0,
// live LLM 호출 0.
//
// 책임 경계(task Out of Scope):
//   - `buildRealDataResultIssueDescriptor` / `formatRealDataResultSummaryLine` /
//     `renderRealDataResultSummaryMarkdown` 본문·출력 형태 변경 0(타입·함수만 `import`
//     소비, 재정의 0). 본 가드는 import·재유도 비교·throw 만.
//   - 자동 복구 / body 재합성 / 정규화 / 기본값 채움 0 — 손상 descriptor 를 고치거나
//     silent 수선하지 않는다(fail-fast). 복구는 호출처 책임.
//   - 산출 경로 자동 배선(`buildRealDataResultIssueDescriptor` 산출 직전 self-wire) 0 —
//     순수 가드 helper 까지. self-wire 는 별도 follow-up slice(T-0644 formatter
//     self-guard 의 descriptor-side mirror).
//   - JSON schema / 외부 validation 라이브러리(zod·ajv) 도입 0 — 순수 string split·
//     비교만.
//   - `title` / `marker` 자체 구조 검증 0 — 본 가드는 body 3 블록 구조에 한정
//     (marker 는 body 첫 라인과의 일치만 비교, marker 합성 규칙 자체 재검증 아님).
//
// 패턴 mirror: `summary-batch-outcome-consistency.ts`(T-0615, 순수 함수 / null·undefined
// fail-fast 한국어 TypeError / 구조 결손=TypeError·값 정합 위반=RangeError 구분 /
// single-source 재유도 비교 / 한국어 JSDoc·책임 경계 주석 / 자동 복구 0 / 산출 경로
// 자동 배선 0). 본 가드는 그 파일을 import 하지 않으나 에러 정책·가드 관례·JSDoc
// 톤을 mirror 한다.

import type { RealDataResultIssueDescriptor } from "./realdata-e2e-result-issue-descriptor";
import type { RealDataResultSummary } from "./realdata-e2e-result-summary";
import { formatRealDataResultSummaryLine } from "./realdata-e2e-result-summary-line";
import { renderRealDataResultSummaryMarkdown } from "./realdata-e2e-result-summary-markdown";

// assertDescriptorStructure — descriptor 객체와 필수 string 필드(body / marker)가
// 구조적으로 온전한지 fail-fast 검증. 구조/타입 결손은 RangeError 가 아니라
// TypeError 로 구분한다(값 정합 위반과 분리).
function assertDescriptorStructure(
  descriptor: RealDataResultIssueDescriptor | null | undefined,
): asserts descriptor is RealDataResultIssueDescriptor {
  if (descriptor === null || descriptor === undefined) {
    throw new TypeError(
      "descriptor 가 null/undefined 일 수 없다 — RealDataResultIssueDescriptor 객체가 필요하다.",
    );
  }
  if (typeof descriptor.body !== "string") {
    throw new TypeError(
      `descriptor.body 가 문자열이 아니다(타입: ${typeof descriptor.body}) — body 3 블록 구조 검증을 진행할 수 없다.`,
    );
  }
  if (typeof descriptor.marker !== "string") {
    throw new TypeError(
      `descriptor.marker 가 문자열이 아니다(타입: ${typeof descriptor.marker}) — body 첫 라인과의 일치 비교를 진행할 수 없다.`,
    );
  }
}

// assertSummaryStructure — summary 객체가 구조적으로 온전한지 fail-fast 검증.
// `formatRealDataResultSummaryLine` / `renderRealDataResultSummaryMarkdown` 가 내부적으로
// 더 깊은 필드(byDifficulty·byContribution)를 다시 검증하므로 본 가드는 최상위 null/
// undefined 만 차단한다(중복 검증 0).
function assertSummaryStructure(
  summary: RealDataResultSummary | null | undefined,
): asserts summary is RealDataResultSummary {
  if (summary === null || summary === undefined) {
    throw new TypeError(
      "summary 가 null/undefined 일 수 없다 — RealDataResultSummary descriptor 객체가 필요하다.",
    );
  }
}

/**
 * 실 평가 e2e 결과 이슈 descriptor body 의 3 블록 구조 불변식을 런타임에서 검증하는
 * 순수 가드(PLAN.md P5 109행 step ④ 결과 박제 chain 의 post-composition 무결성 조각).
 * `assertSummaryBatchOutcomeConsistent`(T-0615) 의 realdata-e2e-side mirror.
 *
 * 검증하는 불변식(single source — `buildRealDataResultIssueDescriptor` L132~138 의 코드
 * 강제):
 *   (1) `descriptor.body` 가 `split("\n")` 결과 ≥ 5 라인을 가진다(marker / "" / line /
 *       "" / markdown 본문 최소 1 라인).
 *   (2) 첫 라인 = `descriptor.marker` (body 가 marker 라인으로 시작).
 *   (3) 2 번째 라인 = "" (marker 직후 구분 빈 줄).
 *   (4) 3 번째 라인 = `formatRealDataResultSummaryLine(summary)` 산출과 byte-identical
 *       (한 줄 요약 블록 — 가공 0 합성). 한 줄 요약은 정확히 1 회 등장(중복 0).
 *   (5) 4 번째 라인 = "" (한 줄 요약 직후 구분 빈 줄).
 *   (6) 5 번째 라인부터 끝까지 = `renderRealDataResultSummaryMarkdown(summary)` 산출과
 *       byte-identical (markdown 본문 — 가공 0 합성).
 *
 * 에러 정책(구조 결손 = TypeError / 값 정합 위반 = RangeError):
 *   - `descriptor` / `summary` 가 null/undefined → 한국어 TypeError.
 *   - `descriptor.body` / `descriptor.marker` 가 string 아님 → 한국어 TypeError.
 *   - 불변식 (1)~(6) 위반 → 한국어 RangeError. 메시지에 어느 블록·어느 위치가
 *     drift 했는지 포함(기대값 vs 실측값 노출).
 *   - silent 통과(위반인데 정상 반환) 0.
 *
 * 검사 순서: 구조(descriptor / summary 존재 · body / marker string) → 라인 분해(최소
 * 길이) → (2)~(6) 순회. 가장 먼저 위반한 지점에서 throw(fail-fast).
 *
 * 비변형 / 순수: `descriptor` / `summary` / 하위 분포 객체를 읽기·비교만 한다(쓰기 0).
 * 부수효과 0 · `@Injectable` 0 · Prisma 0 · LLM 0 · 새 외부 dependency 0. 동일 입력
 * → 동일 동작(정상 descriptor 면 항상 void 반환, 손상 descriptor 면 항상 동일 위치
 * throw).
 *
 * @param descriptor 검증 대상 결과 이슈 descriptor. 변형하지 않는다(읽기·비교만).
 *   `body` / `marker` 가 문자열이어야 하며 body 가 3 블록 구조여야 한다.
 * @param summary 본 가드가 한 줄 요약·markdown 기대값을 재유도할 single-source
 *   descriptor. 변형하지 않는다(읽기·`formatRealDataResultSummaryLine` /
 *   `renderRealDataResultSummaryMarkdown` 위임만).
 * @returns 3 블록 구조 불변식을 모두 만족하면 아무 일도 하지 않고 정상 반환(void).
 * @throws {TypeError} `descriptor` / `summary` null/undefined 또는 `descriptor.body` /
 *   `descriptor.marker` 가 string 아님(구조/타입 결손).
 * @throws {RangeError} body 3 블록 구조 불변식 (1)~(6) 중 하나라도 위반(값 정합 위반).
 *   메시지에 위반 블록·기대값 vs 실측값을 포함.
 */
export function assertRealDataResultIssueDescriptorBodyConsistent(
  descriptor: RealDataResultIssueDescriptor,
  summary: RealDataResultSummary,
): void {
  // 구조 검증(TypeError 분기) — descriptor / summary 존재 + body / marker string.
  assertDescriptorStructure(descriptor);
  assertSummaryStructure(summary);

  // 기대값 재유도 — body 합성 single source 와 동일한 함수를 호출해 기대값을 산출
  // (drift 0). 호출 자체가 summary 구조 검증을 추가로 수행(byDifficulty·byContribution
  // 누락 시 TypeError 전파 — 한 줄 요약/markdown formatter 의 self-guard 가 catch).
  const expectedLine = formatRealDataResultSummaryLine(summary);
  const expectedMarkdown = renderRealDataResultSummaryMarkdown(summary);

  // 라인 분해 — body 를 "\n" 으로 split. markdown 본문이 다행이므로 최소 5 라인
  // (marker / "" / line / "" / markdown 첫 라인) 이상이어야 한다.
  const bodyLines = descriptor.body.split("\n");
  if (bodyLines.length < 5) {
    throw new RangeError(
      `불변식(1) 위반: body 라인 수가 ${bodyLines.length} 으로 최소 5 라인(marker / "" / 한 줄 요약 / "" / markdown) 에 미달한다 — 3 블록 구조가 깨졌다.`,
    );
  }

  // 불변식 (2) — 첫 라인이 marker 와 일치.
  if (bodyLines[0] !== descriptor.marker) {
    throw new RangeError(
      `불변식(2) 위반: body 첫 라인이 marker 와 불일치한다 — 기대='${descriptor.marker}', 실측='${bodyLines[0]}'.`,
    );
  }

  // 불변식 (3) — marker 직후 구분 빈 줄.
  if (bodyLines[1] !== "") {
    throw new RangeError(
      `불변식(3) 위반: marker 직후 구분 빈 줄(2 번째 라인)이 빈 문자열이 아니다 — 실측='${bodyLines[1]}'.`,
    );
  }

  // 불변식 (4) — 3 번째 라인이 formatRealDataResultSummaryLine(summary) 산출과
  // byte-identical(가공 0 합성 증명).
  if (bodyLines[2] !== expectedLine) {
    throw new RangeError(
      `불변식(4) 위반: body 3 번째 라인이 한 줄 요약 기대값과 불일치한다 — 기대='${expectedLine}', 실측='${bodyLines[2]}'.`,
    );
  }

  // 불변식 (5) — 한 줄 요약 직후 구분 빈 줄.
  if (bodyLines[3] !== "") {
    throw new RangeError(
      `불변식(5) 위반: 한 줄 요약 직후 구분 빈 줄(4 번째 라인)이 빈 문자열이 아니다 — 실측='${bodyLines[3]}'.`,
    );
  }

  // 불변식 (6) — 5 번째 라인부터 끝까지가 renderRealDataResultSummaryMarkdown(summary)
  // 산출과 byte-identical(가공 0 합성 증명). markdown 본문이 다행이므로 라인 배열
  // 일부 join 으로 재구성해 비교한다.
  const actualMarkdown = bodyLines.slice(4).join("\n");
  if (actualMarkdown !== expectedMarkdown) {
    throw new RangeError(
      "불변식(6) 위반: body 의 markdown 블록(5 번째 라인 이후)이 renderRealDataResultSummaryMarkdown(summary) 산출과 byte-identical 하지 않다 — markdown 블록이 가공/drift 됐다.",
    );
  }

  // 한 줄 요약 블록 단일 등장 보강 검증 — 위 (4)~(5) 까지 단언으로 3 번째 라인이
  // 한 줄 요약과 일치함을 보장했지만, markdown 블록 안에 동일 라인이 끼어들었을
  // 경우(예: 손상된 합성으로 한 줄 요약이 markdown 본문에도 중복 출현)를 catch
  // 한다. expectedLine 으로 body 를 split 한 결과의 segment 수가 2(앞·뒤)여야 정확히
  // 1 회 등장.
  const occurrences = descriptor.body.split(expectedLine).length - 1;
  if (occurrences !== 1) {
    throw new RangeError(
      `불변식(4) 보강 위반: body 안에 한 줄 요약이 ${occurrences} 회 등장한다 — 정확히 1 회 등장해야 한다(중복·누락 0).`,
    );
  }
}
