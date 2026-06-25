// realdata-e2e-result-issue-command-args-body-marker.ts — 실 평가 e2e 결과 이슈
// 멱등 명령-args 의 body marker-first 구조 불변식 검증 순수 가드(T-0649 박제).
//
// 책임:
//   - `buildRealDataResultIssueCommandArgs`(T-0583, `realdata-e2e-result-issue-command-args.ts`)
//     는 `RealDataResultIssueDescriptor` 를 gh issue 멱등 search-or-update 명령-args
//     (`{ searchQuery, createArgs, updateArgs }`)로 변환한다. 이 빌더는 descriptor.body 를
//     `createArgs.body` 와 `updateArgs.body` **양쪽 모두에 그대로 전달**하고, descriptor.marker
//     를 `searchQuery` 로 전달한다 — create 든 update 든 marker 라인이 양 경로에 보존돼야
//     search-or-update 멱등성이 성립한다. 그러나 이 멱등 정합 불변식 — ① createArgs.body 가
//     descriptor.body 와 byte-identical / ② updateArgs.body 가 descriptor.body 와
//     byte-identical / ③ 두 body 의 첫 라인이 descriptor.marker(marker-first) / ④ searchQuery
//     가 descriptor.marker 와 byte-identical — 은 빌더 본문 주석과 T-0583 spec happy-path
//     단언으로만 박제돼 있고 **런타임에서 강제되는 독립 불변식 가드가 부재** 하다. 본 가드가
//     그 빈칸을 채운다. 부정합 명령-args 가 gh issue 실배선·rolling 이슈 surface 로 새기 전
//     fail-fast throw 로 차단한다.
//
// 🔥 descriptor-only(summary 재유도 0):
//   - `assertRealDataResultIssueDescriptorBodyConsistent`(T-0646) 는 summary 로 한 줄
//     요약·markdown 을 재유도해 body 3 블록 구조를 byte-identical 검증한다(full
//     body-consistency). 그러나 명령-args 는 `summary` 를 in-scope 로 갖지 않으므로(받지도
//     못함) 본 가드는 summary 를 import 하지 않는다. descriptor.body / descriptor.marker 를
//     single-source 로 삼아 명령-args 의 body 전파·searchQuery 가 그것을 보존하는지만 비교한다
//     (`RealDataResultSummary`·`formatRealDataResultSummaryLine`·`renderRealDataResultSummaryMarkdown`
//     미import). full 재유도가 필요하면 descriptor 단계(T-0646)가 이미 cover.
//
// 부수효과 0 / 외부 의존 0 / `@Injectable` 0 / Prisma 0 / LLM 호출 0 / repository 0 /
// 입력 비변형(args·descriptor 객체 읽기·비교만) / 동일 입력 → 동일 동작(정상 명령-args 면
// 항상 void 반환, 부정합 명령-args 면 항상 동일 위치 throw). raw 미저장(R-59) — body 의
// marker/string 만 비교(narrative/raw 본문 미접촉). 새 외부 dependency 0, DB write·
// migration 0, live LLM 호출 0.
//
// 책임 경계(task Out of Scope):
//   - `buildRealDataResultIssueCommandArgs` / `buildRealDataResultIssueDescriptor` 본문·
//     출력 타입 변경 0(타입만 `import type` 소비, 재정의 0). 본 가드는 import·비교·throw 만.
//   - 자동 복구 / args 재합성 / 정규화 / 기본값 채움 0 — 부정합 명령-args 를 고치거나
//     silent 수선하지 않는다(fail-fast). 복구는 호출처 책임.
//   - 산출 경로 자동 배선(`buildRealDataResultIssueCommandArgs` 산출 직전 self-wire) 0 —
//     순수 가드 helper 까지. self-wire 는 별도 follow-up slice(T-0646→T-0647 self-wire 의
//     command-args-side mirror).
//   - JSON schema / 외부 validation 라이브러리(zod·ajv) 도입 0 — 순수 string 비교만.
//   - `createArgs.labels` / `title` 자체 구조 검증 0 — 본 가드는 body marker-first 전파·
//     searchQuery 정합에 한정.
//
// 패턴 mirror: `realdata-e2e-result-issue-descriptor-body-consistency.ts`(T-0646, 순수 함수 /
// null·undefined fail-fast 한국어 TypeError / 구조 결손=TypeError·값 정합 위반=RangeError
// 구분 / single-source 재유도 비교 / 한국어 JSDoc·책임 경계 주석 / 자동 복구 0 / 산출 경로
// 자동 배선 0). 본 가드는 그 에러 정책·가드 관례·JSDoc 톤을 mirror 하되, summary 재유도
// 대신 descriptor.body/marker single-source 만으로 명령-args body 전파를 검증한다.

import type { RealDataResultIssueCommandArgs } from "./realdata-e2e-result-issue-command-args";
import type { RealDataResultIssueDescriptor } from "./realdata-e2e-result-issue-descriptor";

// assertCommandArgsStructure — 명령-args 객체와 그 안의 두 body string 필드(createArgs.body /
// updateArgs.body / searchQuery)가 구조적으로 온전한지 fail-fast 검증. 구조/타입 결손은
// RangeError 가 아니라 TypeError 로 구분한다(값 정합 위반과 분리).
function assertCommandArgsStructure(
  args: RealDataResultIssueCommandArgs | null | undefined,
): asserts args is RealDataResultIssueCommandArgs {
  if (args === null || args === undefined) {
    throw new TypeError(
      "args 가 null/undefined 일 수 없다 — RealDataResultIssueCommandArgs 객체가 필요하다.",
    );
  }
  if (typeof args.searchQuery !== "string") {
    throw new TypeError(
      `args.searchQuery 가 문자열이 아니다(타입: ${typeof args.searchQuery}) — marker 정합 비교를 진행할 수 없다.`,
    );
  }
  if (args.createArgs === null || args.createArgs === undefined) {
    throw new TypeError(
      "args.createArgs 가 null/undefined 일 수 없다 — create body 전파 검증을 진행할 수 없다.",
    );
  }
  if (typeof args.createArgs.body !== "string") {
    throw new TypeError(
      `args.createArgs.body 가 문자열이 아니다(타입: ${typeof args.createArgs.body}) — create body 전파 검증을 진행할 수 없다.`,
    );
  }
  if (args.updateArgs === null || args.updateArgs === undefined) {
    throw new TypeError(
      "args.updateArgs 가 null/undefined 일 수 없다 — update body 전파 검증을 진행할 수 없다.",
    );
  }
  if (typeof args.updateArgs.body !== "string") {
    throw new TypeError(
      `args.updateArgs.body 가 문자열이 아니다(타입: ${typeof args.updateArgs.body}) — update body 전파 검증을 진행할 수 없다.`,
    );
  }
}

// assertDescriptorStructure — descriptor 객체와 필수 string 필드(body / marker)가
// 구조적으로 온전한지 fail-fast 검증(single-source 측 결손 차단). 구조/타입 결손은
// TypeError 로 구분한다.
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
      `descriptor.body 가 문자열이 아니다(타입: ${typeof descriptor.body}) — body 전파 byte-identical 비교를 진행할 수 없다.`,
    );
  }
  if (typeof descriptor.marker !== "string") {
    throw new TypeError(
      `descriptor.marker 가 문자열이 아니다(타입: ${typeof descriptor.marker}) — marker-first / searchQuery 정합 비교를 진행할 수 없다.`,
    );
  }
}

/**
 * 실 평가 e2e 결과 이슈 멱등 명령-args 의 body marker-first 구조 불변식을 런타임에서
 * 검증하는 순수 가드(PLAN.md P5 109행 step ④ 결과 박제 chain 의 consumer-side 무결성
 * 조각). `assertRealDataResultIssueDescriptorBodyConsistent`(T-0646) 의 command-args-side
 * mirror — 단, command-args 는 summary 를 미보유하므로 descriptor.body/marker single-source
 * 만으로 검증한다(summary 재유도 0).
 *
 * 검증하는 불변식(single source — descriptor.body / descriptor.marker, 빌더 L124~137 의
 * body 전파 규칙 강제):
 *   (1) `args.createArgs.body === descriptor.body` (create body byte-identical 전파).
 *   (2) `args.updateArgs.body === descriptor.body` (update body byte-identical 전파).
 *   (3) body 의 첫 라인(`.split("\n")[0]`)이 `descriptor.marker` 와 일치(marker-first).
 *       (1)·(2) 가 통과한 뒤이므로 두 body 는 descriptor.body 와 byte-identical(첫 라인
 *       동일) — 한 body 의 첫 라인만 검사해도 두 경로 marker-first 가 함께 보장된다
 *       (descriptor.body 가 marker 로 시작하지 않는 손상이면 (1)·(2) 통과 후에도 (3) 가
 *       catch).
 *   (4) `args.searchQuery === descriptor.marker` (양 body 안 marker 와 검색 토큰 일치).
 *
 * 에러 정책(구조 결손 = TypeError / 값 정합 위반 = RangeError):
 *   - `args` / `descriptor` 가 null/undefined → 한국어 TypeError.
 *   - `args.searchQuery` / `args.createArgs.body` / `args.updateArgs.body` /
 *     `descriptor.body` / `descriptor.marker` 가 string 아님(또는 createArgs/updateArgs
 *     부재) → 한국어 TypeError.
 *   - 불변식 (1)~(4) 위반 → 한국어 RangeError. 메시지에 어느 불변식·어느 위치가 drift
 *     했는지 포함(기대값 vs 실측값 노출).
 *   - silent 통과(위반인데 정상 반환) 0.
 *
 * 검사 순서: 구조(args / descriptor 존재 · 두 body / searchQuery / marker string) → (1)
 * create body 전파 → (2) update body 전파 → (3) marker-first → (4) searchQuery 정합. 가장
 * 먼저 위반한 지점에서 throw(fail-fast).
 *
 * 비변형 / 순수: `args` / `descriptor` 를 읽기·비교만 한다(쓰기 0). 부수효과 0 ·
 * `@Injectable` 0 · Prisma 0 · LLM 0 · 새 외부 dependency 0. 동일 입력 → 동일 동작(정상
 * 명령-args 면 항상 void 반환, 부정합 명령-args 면 항상 동일 위치 throw).
 *
 * @param args 검증 대상 결과 이슈 멱등 명령-args. 변형하지 않는다(읽기·비교만).
 *   `searchQuery` / `createArgs.body` / `updateArgs.body` 가 문자열이어야 한다.
 * @param descriptor 본 가드가 body / marker 기대값을 삼을 single-source descriptor.
 *   변형하지 않는다(읽기·비교만). `body` / `marker` 가 문자열이어야 한다.
 * @returns marker-first 구조 불변식을 모두 만족하면 아무 일도 하지 않고 정상 반환(void).
 * @throws {TypeError} `args` / `descriptor` null/undefined 또는 두 body / searchQuery /
 *   marker 가 string 아님(또는 createArgs/updateArgs 부재) — 구조/타입 결손.
 * @throws {RangeError} 불변식 (1)~(4) 중 하나라도 위반(값 정합 위반). 메시지에 위반
 *   불변식·기대값 vs 실측값을 포함.
 */
export function assertRealDataResultIssueCommandArgsBodyPreservesDescriptor(
  args: RealDataResultIssueCommandArgs,
  descriptor: RealDataResultIssueDescriptor,
): void {
  // 구조 검증(TypeError 분기) — args / descriptor 존재 + 두 body / searchQuery / marker string.
  assertCommandArgsStructure(args);
  assertDescriptorStructure(descriptor);

  // 불변식 (1) — createArgs.body 가 descriptor.body 와 byte-identical 전파.
  if (args.createArgs.body !== descriptor.body) {
    throw new RangeError(
      "불변식(1) 위반: createArgs.body 가 descriptor.body 와 byte-identical 하지 않다 — create 경로의 body 전파가 drift 됐다(멱등 marker 라인 손실 위험).",
    );
  }

  // 불변식 (2) — updateArgs.body 가 descriptor.body 와 byte-identical 전파.
  if (args.updateArgs.body !== descriptor.body) {
    throw new RangeError(
      "불변식(2) 위반: updateArgs.body 가 descriptor.body 와 byte-identical 하지 않다 — update 경로의 body 전파가 drift 됐다(멱등 marker 라인 손실 위험).",
    );
  }

  // 불변식 (3) — body 의 첫 라인이 descriptor.marker 와 일치(marker-first). (1)·(2)
  // 통과 후이므로 createArgs.body 와 updateArgs.body 는 모두 descriptor.body 와
  // byte-identical 하다 — 즉 두 body 의 첫 라인은 동일하다. 따라서 한 body(createArgs.body)
  // 의 첫 라인만 검사하면 두 경로의 marker-first 가 함께 보장된다(descriptor.body 가 marker
  // 로 시작하지 않는 손상이면 (1)·(2) 통과 후에도 여기서 catch). update 측 별도 첫-라인
  // 검사는 (1)·(2) 가 두 body 의 동치를 이미 강제하므로 dead branch 라 두지 않는다.
  const bodyFirstLine = args.createArgs.body.split("\n")[0];
  if (bodyFirstLine !== descriptor.marker) {
    throw new RangeError(
      `불변식(3) 위반: body 의 첫 라인이 marker 와 불일치한다(marker-first 위반) — 기대='${descriptor.marker}', 실측='${bodyFirstLine}'.`,
    );
  }

  // 불변식 (4) — searchQuery 가 descriptor.marker 와 byte-identical(양 body 안 marker 와
  // 검색 토큰 일치). search-or-update 멱등성이 이 일치에 달려있다.
  if (args.searchQuery !== descriptor.marker) {
    throw new RangeError(
      `불변식(4) 위반: searchQuery 가 descriptor.marker 와 byte-identical 하지 않다 — 기대='${descriptor.marker}', 실측='${args.searchQuery}'. search-or-update 검색 토큰이 body 안 marker 와 어긋나 멱등성이 깨진다.`,
    );
  }
}
