// realdata-e2e-eval-chain-consistency.ts — 실 평가 e2e full-chain leg 의 수집→평가 경계
// 조립(bound/active/attribution) ↔ 독립 oracle 재유도 byte-identical 정합 순수 가드
// (T-0976 박제, PLAN.md 109행 두 leg 합류의 경계 배선 drift-guard).
//
// 책임:
//   - `buildRealDataE2eEvalChainInput(gating, collectedActivities)`(T-0975,
//     `realdata-e2e-eval-chain.ts`)는 실 수집 도메인 `GithubActivity[]` 를 (a) 귀속 메타
//     (author) 있는 유효 활동만 filter → (b) 정확히 1 건으로 bound(LLM round-trip 1 회
//     상한, T-0245 선례) → (c) `active = gating.enabled ∧ ollama credential 존재 ∧
//     bounded 1 건` 판정 → (d) `username = bounded[0].author | null` 로 조립하는 **경계
//     배선의 단일 지점**이다. 이 helper 는 이 스트림의 sibling 대부분이 갖춘 독립
//     `-consistency` drift-guard 를 아직 갖지 못했다 — filter/bound/active/username 규칙이
//     조용히 회귀(예: `slice(0, 1)` → `slice(0, 2)`, attribution 완화, active 3-조건 중
//     하나 누락)해도 unit spec 만으로는 spec 이 함께 수정되면 통과할 수 있다. 본 가드가
//     그 빈칸을 **독립 재유도(oracle)** 로 채운다.
//
// 검증하는 불변식(single source — helper 를 호출하지 않고 규칙을 독립 재구현):
//   - expected = filter(author 귀속) → slice(0, 1) bound → active/username 재유도.
//     인자로 받은 `descriptor` 가 expected 와 deep-equal byte-identical(active/activities
//     원소·순서·길이/username 까지) 정합함. `buildRealDataE2eEvalChainInput` 를 호출하지
//     **않는다**(그러면 자기 자신 대조라 무의미) — filter/bound/active/username 규칙을
//     helper 와 무관하게 재유도해 대조하므로, 어느 한쪽 규칙이 drift 하는 순간 fail 한다.
//     이는 `evaluation-inputs-consistency`(T-0685)가 production 단건 매퍼로 배열 threading
//     을 재유도해 대조하는 패턴의 leg-경계 mirror 다(차이점: 재유도 source 가 production
//     호출이 아니라 규칙의 독립 재구현 — helper 내부 predicate 가 비공개라 규칙 자체를
//     재유도해야 대조 의미가 성립).
//
// 에러 정책(구조 결손 = TypeError / 값 정합 위반 = RangeError):
//   - `gating` 비-객체(null 포함) · `collectedActivities` 비-배열 · `descriptor` 비-객체
//     (null 포함) · `descriptor.activities` 비-배열 → 한국어 TypeError.
//   - 재유도 expected 와 `descriptor` 가 active drift / activities 길이 불일치 / 특정 index
//     원소 drift / username drift → 한국어 RangeError(어긋난 필드/길이/index 정보 포함).
//   - silent 통과(위반인데 정상 void) 0. fail-fast(가장 먼저 위반한 지점에서 throw).
//
// 비변형 / 순수: `gating` / `collectedActivities` / `descriptor` 를 읽기·비교만 한다
// (쓰기 0). 네트워크/LLM/DB/env 읽기 0 · 부수효과 0 · `@Injectable` 0 · Prisma 0 · 새
// 외부 dependency 0. 동일 입력 → 동일 동작(정합 descriptor 면 항상 void, drift 면 항상
// 동일 지점에서 throw).
//
// 🔥 §9 / R-59 격리: gating fixture 는 enabled/ollama-존재 여부만 표현하는 더미 구조로
//   충분하며, 본 가드는 credential 값을 참조/echo/log 하지 않는다(존재만 판정). raw 활동
//   본문 미보관 — typed 참조 필드만 비교한다.
//
// Out of Scope(task T-0976):
//   - `realdata-e2e-eval-chain.ts`(T-0975) 본문 수정 — 본 가드는 import·재유도 비교·throw
//     만(재정의 0). 특히 helper 반환 직전 self-wire 배선은 별도 후속 slice(dependsOn 본
//     task).
//   - 자동 복구 / 재합성 / 기본값 채움 0 — 손상 descriptor 를 고치지 않고 fail-fast throw
//     (복구는 호출처 책임). JSON schema / zod / ajv 도입 0(순수 비교만).
import type { GithubActivity } from "../../src/assessment-collection/domain/activity";

import type { RealDataE2eEvalChainInput } from "./realdata-e2e-eval-chain";
import type { RealDataE2eLiveGating } from "./realdata-e2e-live-gating";

// describe — 에러 메시지용 타입 라벨. null 을 typeof 가 뭉뚱그리는 'object' 대신 구분해
// 노출한다(디버깅 가독성).
function describe(value: unknown): string {
  if (value === null) {
    return "null";
  }
  return typeof value;
}

// isAttributedGithubActivityOracle — `buildRealDataE2eEvalChainInput` 내부 비공개
// predicate `isAttributedGithubActivity` 의 **독립 재구현(oracle)**. 활동 1 개가
// person/service-identity 귀속 메타(author 비어있지 않은 string)를 갖췄는지 판정한다.
// helper 를 import 해 재사용하지 않고 규칙 자체를 재유도해야(가드의 존재 이유) drift 대조
// 의미가 성립한다 — helper 의 filter 규칙이 조용히 바뀌면 본 oracle 과 어긋나 fail 한다.
// 비객체/null entry 도 방어적으로 false(malformed skip).
function isAttributedGithubActivityOracle(
  activity: unknown,
): activity is GithubActivity {
  if (activity === null || typeof activity !== "object") {
    return false;
  }
  const author = (activity as { author?: unknown }).author;
  return typeof author === "string" && author.trim().length > 0;
}

// assertGatingStructure — 재유도 입력 gating 의 최소 형태를 fail-fast 검증. 비-객체
// (null/undefined 포함)는 active 재유도 직전 TypeError 로 차단한다(값-수준 판정은 재유도
// 로직이 담당 — 본 가드는 객체 형태만 검증).
function assertGatingStructure(
  gating: RealDataE2eLiveGating | null | undefined,
): asserts gating is RealDataE2eLiveGating {
  if (gating === null || typeof gating !== "object") {
    throw new TypeError(
      `gating 이 객체가 아니다(타입: ${describe(gating)}) — active 판정을 재유도할 수 없다.`,
    );
  }
}

// assertCollectedActivitiesStructure — 재유도 source(collectedActivities 배열)의 최소
// 형태를 fail-fast 검증. 비-배열(null/undefined 포함)은 filter/bound 재유도 직전
// TypeError 로 차단한다.
function assertCollectedActivitiesStructure(
  collectedActivities: GithubActivity[] | null | undefined,
): asserts collectedActivities is GithubActivity[] {
  if (!Array.isArray(collectedActivities)) {
    throw new TypeError(
      `collectedActivities 가 배열이 아니다(타입: ${describe(collectedActivities)}) — descriptor 를 재유도할 수 없다.`,
    );
  }
}

// assertDescriptorStructure — 검증 대상 descriptor 의 최소 형태를 fail-fast 검증. 비-객체
// (null/undefined 포함) → TypeError, `activities` 비-배열 → TypeError. deep-equal 비교
// 전 최소 형태 보장(active/username 값 정합은 재유도 대조의 몫).
function assertDescriptorStructure(
  descriptor: RealDataE2eEvalChainInput | null | undefined,
): asserts descriptor is RealDataE2eEvalChainInput {
  if (descriptor === null || typeof descriptor !== "object") {
    throw new TypeError(
      `descriptor 가 객체가 아니다(타입: ${describe(descriptor)}) — 재유도 정합 비교를 진행할 수 없다.`,
    );
  }
  if (!Array.isArray(descriptor.activities)) {
    throw new TypeError(
      `descriptor.activities 가 배열이 아니다(타입: ${describe(descriptor.activities)}) — 원소 정합 비교를 진행할 수 없다.`,
    );
  }
}

// deepEqual — JSON 직렬화 기반 byte-identical 비교. bounded 활동은 순수 filter/slice 로
// 원본 참조를 그대로 담으므로 직렬화 동등 = 구조 동등. 비교만(입력 변형 0).
function deepEqual(actual: unknown, expected: unknown): boolean {
  return JSON.stringify(actual) === JSON.stringify(expected);
}

/**
 * 실 평가 e2e full-chain leg 의 수집→평가 경계 조립(`buildRealDataE2eEvalChainInput`
 * 산출 descriptor)이, 동일 `gating` / `collectedActivities` 로부터
 * filter/bound/active/username 규칙을 **독립 재유도(oracle)** 한 결과와 byte-identical
 * 정합함을 런타임에서 검증하는 순수 가드(PLAN.md P5 109행 두 leg 합류의 경계 배선
 * build-time drift-guard).
 *
 * `assertRealDataEvaluationInputsConsistentWithSources`(T-0685) 의 leg-경계 mirror —
 * 차이점: 재유도 source 가 production 매퍼 호출이 아니라 helper 내부 비공개 predicate·
 * bound·active 규칙의 독립 재구현이다(helper 를 호출하면 자기 자신 대조라 무의미).
 *
 * 검증하는 불변식(single source — 규칙 독립 재유도):
 *   - boundedExpected = collectedActivities.filter(귀속 present).slice(0, 1)
 *   - activeExpected = gating.enabled === true ∧ ollama 존재 ∧ boundedExpected 1 건
 *   - usernameExpected = boundedExpected 1 건이면 그 author, 아니면 null
 *   가 `descriptor` 의 active/activities/username 과 deep-equal byte-identical(원소·순서·
 *   길이까지).
 *
 * 에러 정책(구조 결손 = TypeError / 값 정합 위반 = RangeError):
 *   - `gating` 비-객체 · `collectedActivities` 비-배열 · `descriptor` 비-객체 ·
 *     `descriptor.activities` 비-배열 → 한국어 TypeError.
 *   - active drift / activities 길이 불일치 / 특정 index 원소 drift / username drift →
 *     한국어 RangeError(어긋난 필드/길이/index 정보 포함).
 *   - silent 통과(위반인데 정상 void) 0.
 *
 * 검사 순서: 구조(gating · collectedActivities · descriptor · descriptor.activities) →
 * 재유도(filter/bound/active/username) → active 비교 → activities 길이 비교 → 원소별
 * deep-equal 비교(index 오름차순) → username 비교. 가장 먼저 위반한 지점에서
 * throw(fail-fast). 길이 검사가 원소 검사보다 먼저 평가되므로 길이 불일치 시 원소 변조
 * 무관하게 길이 RangeError 가 먼저 throw 된다.
 *
 * 비변형 / 순수: 세 인자를 읽기·비교만 한다(쓰기 0). 부수효과 0 · 네트워크/LLM/DB/env
 * 읽기 0 · 새 외부 dependency 0. 동일 입력 → 동일 동작(정합 descriptor 면 항상 void,
 * drift 면 항상 동일 지점에서 throw).
 *
 * @param gating build 시 사용한 gating(active 재유도에만 사용 — credential 값 미참조,
 *   존재만 판정, §9). 비-객체면 TypeError. 변형하지 않는다.
 * @param collectedActivities build 시 넘긴 수집 활동 배열(filter/bound 재유도 source).
 *   비-배열이면 TypeError. 변형하지 않는다(읽기만).
 * @param descriptor 검증 대상 `buildRealDataE2eEvalChainInput` 산출 descriptor. 재유도
 *   expected 와 active/activities/username 이 정합해야 한다. 변형하지 않는다.
 * @returns 세 필드 모두 재유도 expected 와 정합하면 아무 일도 하지 않고 정상 반환(void).
 * @throws {TypeError} `gating` 비-객체 · `collectedActivities` 비-배열 · `descriptor`
 *   비-객체 · `descriptor.activities` 비-배열(구조/타입 결손).
 * @throws {RangeError} active drift / activities 길이 불일치 / 특정 index 원소 drift /
 *   username drift(값 정합 위반). 메시지에 어긋난 필드/길이/index 정보 포함.
 */
export function assertRealDataE2eEvalChainInputConsistent(
  gating: RealDataE2eLiveGating,
  collectedActivities: GithubActivity[],
  descriptor: RealDataE2eEvalChainInput,
): void {
  // 구조 검증(TypeError 분기) — gating 객체 + 재유도 source(collectedActivities) 배열 +
  // descriptor 객체 + descriptor.activities 배열 최소 형태.
  assertGatingStructure(gating);
  assertCollectedActivitiesStructure(collectedActivities);
  assertDescriptorStructure(descriptor);

  // 기대값 독립 재유도 — helper 를 호출하지 않고 filter(author 귀속) → slice(0, 1) bound
  // 규칙을 재구현한다(drift 대조의 핵심). helper 의 filter/bound 가 조용히 바뀌면 본
  // oracle 산출과 어긋나 아래 비교에서 fail 한다.
  const boundedExpected = collectedActivities
    .filter(isAttributedGithubActivityOracle)
    .slice(0, 1);

  // active 재유도 — gating.enabled === true ∧ Ollama credential 존재(값 미참조, 존재만
  // 판정, §9) ∧ bounded 정확히 1 건. helper 의 3-조건 중 하나가 누락되면 여기서 어긋난다.
  const hasEvalCredentialExpected =
    gating.enabled === true &&
    gating.ollama !== null &&
    typeof gating.ollama === "object";
  const activeExpected =
    hasEvalCredentialExpected && boundedExpected.length === 1;

  // username 재유도 — bounded 1 건이면 그 author, 아니면 null.
  const usernameExpected =
    boundedExpected.length === 1 ? boundedExpected[0].author : null;

  // active 정합 비교(값 drift → RangeError). 재유도 3-조건 중 하나가 helper 에서 누락/변형
  // 되면 여기서 가장 먼저 차단된다(activities 는 정합인데 active 만 drift 하는 회귀 포함).
  if (descriptor.active !== activeExpected) {
    throw new RangeError(
      `정합 위반: descriptor.active 가 재유도 expected 와 다르다 — 기대=${activeExpected}, 실측=${descriptor.active}.`,
    );
  }

  // activities 길이 정합 비교 — 원소 검사보다 먼저 평가된다(길이 불일치 시 원소 변조
  // 무관하게 길이 RangeError 가 먼저 throw). bound 규칙 완화(예: slice(0, 2)) 회귀를 가장
  // 먼저 차단한다.
  if (descriptor.activities.length !== boundedExpected.length) {
    throw new RangeError(
      `정합 위반: descriptor.activities 길이가 재유도 expected 와 다르다 — 기대=${boundedExpected.length}, 실측=${descriptor.activities.length}.`,
    );
  }

  // activities 원소별 정합 비교 — deep-equal byte-identical(index 오름차순). 가장 먼저
  // 어긋난 index 에서 RangeError(메시지에 어긋난 index 포함 — fail-fast).
  for (let i = 0; i < boundedExpected.length; i += 1) {
    if (!deepEqual(descriptor.activities[i], boundedExpected[i])) {
      throw new RangeError(
        `정합 위반: descriptor.activities[${i}] 가 재유도 expected 와 byte-identical 하지 않다 — 기대=${JSON.stringify(boundedExpected[i])}, 실측=${JSON.stringify(descriptor.activities[i])}.`,
      );
    }
  }

  // username 정합 비교(값 drift → RangeError). attribution 재유도(bounded[0].author)가
  // helper 와 어긋나면(다른 author 로 교체 등) 여기서 차단된다.
  if (descriptor.username !== usernameExpected) {
    throw new RangeError(
      `정합 위반: descriptor.username 이 재유도 expected 와 다르다 — 기대=${JSON.stringify(usernameExpected)}, 실측=${JSON.stringify(descriptor.username)}.`,
    );
  }
}
