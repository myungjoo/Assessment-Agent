// realdata-e2e-result-issue-command-args-labels-title.ts — 실 평가 e2e 결과 이슈
// 멱등 명령-args 의 labels·title 정합 불변식 검증 순수 가드(T-0651 박제).
//
// 책임:
//   - `buildRealDataResultIssueCommandArgs`(T-0583, `realdata-e2e-result-issue-command-args.ts`)
//     는 `RealDataResultIssueDescriptor` 를 gh issue 멱등 search-or-update 명령-args
//     (`{ searchQuery, createArgs, updateArgs }`)로 변환한다. 이 빌더는 descriptor.title 을
//     `createArgs.title` 과 `updateArgs.title` **양쪽 모두에 그대로 전달**하고, 고정 결정론
//     상수 집합(`RESULT_ISSUE_LABELS = ["realdata-e2e", "result"]`)의 **새 배열 복제**를
//     `createArgs.labels` 로 전달한다. 그러나 이 두 정합 불변식 — ① createArgs.title /
//     updateArgs.title 이 둘 다 descriptor.title 과 byte-identical(create/update 어느 경로로
//     박제하든 동일 제목 → 멱등 식별) / ② createArgs.labels 가 고정 상수와 순서·원소·개수까지
//     정확히 일치하고 상수 자체 참조와 무공유(빌더가 복제) — 은 빌더 본문 주석과 T-0583 spec
//     happy-path 단언으로만 박제돼 있고 **런타임에서 강제되는 독립 불변식 가드가 부재** 하다.
//     본 가드가 그 빈칸을 채운다. 제목이 갈라지거나 label 이 누락·추가·순서변경·무공유 위반된
//     명령-args 가 gh issue 실배선·rolling 이슈 surface 로 새기 전 fail-fast throw 로 차단한다.
//
// 🔥 body marker 가드(T-0649)와의 분담 — 동형 mirror, 비중복:
//   - `assertRealDataResultIssueCommandArgsBodyPreservesDescriptor`(T-0649) 는 body
//     marker-first 구조와 searchQuery 정합만 검증한다(create/update body byte-identical
//     전파 + marker-first + searchQuery). 본 가드는 그 가드가 닿지 않는 **labels·title-side
//     mirror** — title 3자 정합·labels 고정-상수 정합·labels 무공유 만 검증한다. 두 가드는
//     command-args 구조 무결성의 두 축(body 축 / labels·title 축)으로 비중복 분담한다.
//
// 🔥 raw 미저장 정합 (R-59 / REQ-032, data-model.md §4):
//   - 본 가드는 title string 과 labels string 배열만 비교한다(narrative/raw 본문 미접촉).
//     descriptor.title / expectedLabels 를 single-source 로 삼는다. raw 본문이 새지 않는다.
//
// 부수효과 0 / 외부 의존 0 / `@Injectable` 0 / Prisma 0 / LLM 호출 0 / repository 0 /
// 입력 비변형(args·descriptor·expectedLabels 읽기·비교만) / 동일 입력 → 동일 동작(정상
// 명령-args 면 항상 void 반환, 부정합 명령-args 면 항상 동일 위치 throw). 새 외부 dependency 0,
// DB write·migration 0, live LLM 호출 0. 같은 디렉토리 타입 import 라 runtime cycle 0.
//
// 책임 경계(task T-0651 Out of Scope):
//   - `buildRealDataResultIssueCommandArgs` / `buildRealDataResultIssueDescriptor` 본문·
//     출력 타입 변경 0(타입만 `import type` 소비, 재정의 0). 본 가드는 import·비교·throw 만.
//   - 자동 복구 / args 재합성 / 정규화 / 기본값 채움 / label 자동 보정 / title 자동 교정 0 —
//     부정합 명령-args 를 고치거나 silent 수선하지 않는다(fail-fast). 복구는 호출처 책임.
//   - 산출 경로 자동 배선(`buildRealDataResultIssueCommandArgs` 산출 직전 self-wire) 0 —
//     순수 가드 helper 까지. self-wire 는 별도 follow-up slice(T-0650 이 body marker 가드를
//     self-wire 한 것과 동형 패턴).
//   - JSON schema / 외부 validation 라이브러리(zod·ajv) 도입 0 — 순수 string 비교만.
//   - body marker-first / searchQuery 정합 검증 0 — 그 축은 body marker 가드(T-0649)가 cover.
//
// 패턴 mirror: `realdata-e2e-result-issue-command-args-body-marker.ts`(T-0649, 순수 함수 /
// null·undefined fail-fast 한국어 TypeError / 구조 결손=TypeError·값 정합 위반=RangeError
// 구분 / single-source 비교 / 한국어 JSDoc·책임 경계 주석 / 자동 복구 0 / 산출 경로 자동
// 배선 0). 본 가드는 그 에러 정책·가드 관례·JSDoc 톤을 mirror 하되, body marker 축 대신
// descriptor.title / expectedLabels single-source 로 명령-args 의 title·labels 정합을 검증한다.

import type { RealDataResultIssueCommandArgs } from "./realdata-e2e-result-issue-command-args";
import type { RealDataResultIssueDescriptor } from "./realdata-e2e-result-issue-descriptor";

// assertCommandArgsStructure — 명령-args 객체와 그 안의 title/labels 필드가 구조적으로
// 온전한지 fail-fast 검증. 구조/타입 결손은 RangeError 가 아니라 TypeError 로 구분한다
// (값 정합 위반과 분리).
function assertCommandArgsStructure(
  args: RealDataResultIssueCommandArgs | null | undefined,
): asserts args is RealDataResultIssueCommandArgs {
  if (args === null || args === undefined) {
    throw new TypeError(
      "args 가 null/undefined 일 수 없다 — RealDataResultIssueCommandArgs 객체가 필요하다.",
    );
  }
  if (args.createArgs === null || args.createArgs === undefined) {
    throw new TypeError(
      "args.createArgs 가 null/undefined 일 수 없다 — title/labels 정합 검증을 진행할 수 없다.",
    );
  }
  if (typeof args.createArgs.title !== "string") {
    throw new TypeError(
      `args.createArgs.title 가 문자열이 아니다(타입: ${typeof args.createArgs.title}) — title 3자 정합 비교를 진행할 수 없다.`,
    );
  }
  if (!Array.isArray(args.createArgs.labels)) {
    throw new TypeError(
      `args.createArgs.labels 가 배열이 아니다(타입: ${typeof args.createArgs.labels}) — labels 정합 비교를 진행할 수 없다.`,
    );
  }
  if (args.updateArgs === null || args.updateArgs === undefined) {
    throw new TypeError(
      "args.updateArgs 가 null/undefined 일 수 없다 — title 3자 정합 검증을 진행할 수 없다.",
    );
  }
  if (typeof args.updateArgs.title !== "string") {
    throw new TypeError(
      `args.updateArgs.title 가 문자열이 아니다(타입: ${typeof args.updateArgs.title}) — title 3자 정합 비교를 진행할 수 없다.`,
    );
  }
}

// assertDescriptorStructure — descriptor 객체와 필수 title 필드가 구조적으로 온전한지
// fail-fast 검증(single-source 측 결손 차단). 구조/타입 결손은 TypeError 로 구분한다.
function assertDescriptorStructure(
  descriptor: RealDataResultIssueDescriptor | null | undefined,
): asserts descriptor is RealDataResultIssueDescriptor {
  if (descriptor === null || descriptor === undefined) {
    throw new TypeError(
      "descriptor 가 null/undefined 일 수 없다 — RealDataResultIssueDescriptor 객체가 필요하다.",
    );
  }
  if (typeof descriptor.title !== "string") {
    throw new TypeError(
      `descriptor.title 가 문자열이 아니다(타입: ${typeof descriptor.title}) — title 3자 정합 byte-identical 비교를 진행할 수 없다.`,
    );
  }
}

// assertExpectedLabelsStructure — expectedLabels(고정 상수 single-source)가 string 배열로
// 온전한지 fail-fast 검증. 구조/타입 결손은 TypeError 로 구분한다.
function assertExpectedLabelsStructure(
  expectedLabels: readonly string[] | null | undefined,
): asserts expectedLabels is readonly string[] {
  if (!Array.isArray(expectedLabels)) {
    throw new TypeError(
      `expectedLabels 가 배열이 아니다(타입: ${typeof expectedLabels}) — labels 고정-상수 정합 비교를 진행할 수 없다.`,
    );
  }
  for (let i = 0; i < expectedLabels.length; i += 1) {
    if (typeof expectedLabels[i] !== "string") {
      throw new TypeError(
        `expectedLabels[${i}] 가 문자열이 아니다(타입: ${typeof expectedLabels[i]}) — labels 원소는 모두 string 이어야 한다.`,
      );
    }
  }
}

/**
 * 실 평가 e2e 결과 이슈 멱등 명령-args 의 labels·title 정합 불변식을 런타임에서 검증하는
 * 순수 가드(PLAN.md P5 109행 step ④ 결과 박제 chain 의 consumer-side 무결성 조각).
 * `assertRealDataResultIssueCommandArgsBodyPreservesDescriptor`(T-0649) 의 labels·title-side
 * mirror — 그 가드가 닿지 않는 title 3자 정합·labels 고정-상수 정합·labels 무공유 만 검증한다
 * (body marker-first / searchQuery 축은 그 가드가 이미 cover, 본 가드는 비중복).
 *
 * 검증하는 불변식(single source — descriptor.title / expectedLabels, 빌더 L128~133 의
 * title·labels 전파 규칙 강제):
 *   (1) `args.createArgs.title === descriptor.title` (create title byte-identical 전파).
 *   (2) `args.updateArgs.title === descriptor.title` (update title byte-identical 전파).
 *       (1)·(2) 가 함께 통과하면 create/update 두 경로의 제목이 descriptor.title 로
 *       byte-identical 수렴 — 같은 run 의 이슈가 두 제목으로 갈라지지 않는다(멱등 식별).
 *   (3) `args.createArgs.labels` 가 `expectedLabels` 와 순서·원소·개수까지 정확히 일치
 *       (부분집합/초과집합 거부 — exact match). 누락·추가·순서변경·공백/대소문자 drift 검출
 *       (byte-identical 비교 — trim·case-fold 0).
 *   (4) `args.createArgs.labels !== expectedLabels` (무공유 — 빌더가 상수를 복제하지 않고
 *       직접 반환하면 후속 호출의 labels mutate 가 상수·다음 호출로 누설된다).
 *
 * 에러 정책(구조 결손 = TypeError / 값 정합 위반 = RangeError):
 *   - `args` / `descriptor` / `expectedLabels` 가 null/undefined → 한국어 TypeError.
 *   - `args.createArgs`/`args.updateArgs` 부재, `createArgs.title`/`updateArgs.title` 가
 *     string 아님, `createArgs.labels` 가 배열 아님, `descriptor.title` 가 string 아님,
 *     `expectedLabels` 가 배열 아님 또는 원소가 string 아님 → 한국어 TypeError.
 *   - 불변식 (1)~(4) 위반 → 한국어 RangeError. 메시지에 어느 불변식·어느 위치가 drift
 *     했는지 포함(기대값 vs 실측값 노출).
 *   - silent 통과(위반인데 정상 반환) 0.
 *
 * 검사 순서: 구조(args / descriptor / expectedLabels 존재 · title string · labels 배열)
 *   → (1) create title → (2) update title → (3) labels 내용 exact match → (4) labels 무공유.
 *   가장 먼저 위반한 지점에서 throw(fail-fast).
 *
 * 비변형 / 순수: `args` / `descriptor` / `expectedLabels` 를 읽기·비교만 한다(쓰기 0).
 * 부수효과 0 · `@Injectable` 0 · Prisma 0 · LLM 0 · 새 외부 dependency 0. 동일 입력 →
 * 동일 동작(정상 명령-args 면 항상 void 반환, 부정합 명령-args 면 항상 동일 위치 throw).
 *
 * @param args 검증 대상 결과 이슈 멱등 명령-args. 변형하지 않는다(읽기·비교만).
 *   `createArgs.title` / `updateArgs.title` 이 문자열, `createArgs.labels` 가 배열이어야 한다.
 * @param descriptor 본 가드가 title 기대값을 삼을 single-source descriptor. 변형하지 않는다
 *   (읽기·비교만). `title` 이 문자열이어야 한다.
 * @param expectedLabels 본 가드가 labels 기대값을 삼을 고정 결정론 상수 집합(빌더의
 *   `RESULT_ISSUE_LABELS`). 변형하지 않는다(읽기·비교만). 무공유 검증의 비교 대상이기도
 *   하므로 createArgs.labels 와 동일 참조면 (4) 위반.
 * @returns labels·title 정합 불변식을 모두 만족하면 아무 일도 하지 않고 정상 반환(void).
 * @throws {TypeError} `args` / `descriptor` / `expectedLabels` null/undefined 또는 title 이
 *   string 아님 / labels 가 배열 아님(또는 createArgs/updateArgs 부재) — 구조/타입 결손.
 * @throws {RangeError} 불변식 (1)~(4) 중 하나라도 위반(값 정합 위반). 메시지에 위반
 *   불변식·기대값 vs 실측값을 포함.
 */
export function assertRealDataResultIssueCommandArgsLabelsTitleConsistent(
  args: RealDataResultIssueCommandArgs,
  descriptor: RealDataResultIssueDescriptor,
  expectedLabels: readonly string[],
): void {
  // 구조 검증(TypeError 분기) — args / descriptor / expectedLabels 존재 + title string +
  // labels 배열.
  assertCommandArgsStructure(args);
  assertDescriptorStructure(descriptor);
  assertExpectedLabelsStructure(expectedLabels);

  // 불변식 (1) — createArgs.title 이 descriptor.title 과 byte-identical 전파.
  if (args.createArgs.title !== descriptor.title) {
    throw new RangeError(
      `불변식(1) 위반: createArgs.title 이 descriptor.title 과 byte-identical 하지 않다 — 기대='${descriptor.title}', 실측='${args.createArgs.title}'. create 경로의 제목이 drift 돼 같은 run 의 이슈가 두 제목으로 갈라질 위험.`,
    );
  }

  // 불변식 (2) — updateArgs.title 이 descriptor.title 과 byte-identical 전파.
  if (args.updateArgs.title !== descriptor.title) {
    throw new RangeError(
      `불변식(2) 위반: updateArgs.title 이 descriptor.title 과 byte-identical 하지 않다 — 기대='${descriptor.title}', 실측='${args.updateArgs.title}'. update 경로의 제목이 drift 돼 같은 run 의 이슈가 두 제목으로 갈라질 위험.`,
    );
  }

  // 불변식 (3) — createArgs.labels 가 expectedLabels 와 순서·원소·개수까지 정확히 일치
  // (exact match, byte-identical 원소 비교 — 부분집합/초과집합·순서변경·공백/대소문자
  // drift 거부). 개수 먼저 검사한 뒤 원소별 위치 비교.
  const actualLabels = args.createArgs.labels;
  if (actualLabels.length !== expectedLabels.length) {
    throw new RangeError(
      `불변식(3) 위반: createArgs.labels 의 개수가 expectedLabels 와 다르다 — 기대 ${expectedLabels.length}개([${expectedLabels.join(", ")}]), 실측 ${actualLabels.length}개([${actualLabels.join(", ")}]). label 이 누락·추가됐다(결과 이슈 분류·검색 필터 손상 위험).`,
    );
  }
  for (let i = 0; i < expectedLabels.length; i += 1) {
    if (actualLabels[i] !== expectedLabels[i]) {
      throw new RangeError(
        `불변식(3) 위반: createArgs.labels[${i}] 가 expectedLabels[${i}] 와 byte-identical 하지 않다 — 기대='${expectedLabels[i]}', 실측='${actualLabels[i]}'. label 원소·순서가 drift 됐다(trim·case-fold 0, 공백·대소문자 민감).`,
      );
    }
  }

  // 불변식 (4) — createArgs.labels 가 expectedLabels(상수 참조)와 동일 배열 참조가 아님
  // (무공유). 빌더가 상수를 복제하지 않고 직접 반환하면 후속 호출의 labels mutate 가
  // 상수·다음 호출 결과로 누설된다. (3) 가 내용 일치를 이미 강제하므로, 여기서 참조까지
  // 같으면(===) 빌더가 복제하지 않은 무공유 위반이다.
  if (actualLabels === expectedLabels) {
    throw new RangeError(
      "불변식(4) 위반: createArgs.labels 가 expectedLabels(고정 상수)와 동일 배열 참조다(무공유 위반) — 빌더가 상수를 복제하지 않고 직접 반환했다. 후속 호출의 labels mutate 가 상수·다음 호출로 누설될 위험.",
    );
  }
}
