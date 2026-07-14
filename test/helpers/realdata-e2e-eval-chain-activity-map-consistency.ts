// realdata-e2e-eval-chain-activity-map-consistency.ts — 실 평가 e2e full-chain 의
// github event → 도메인 `GithubActivity` 매핑(`mapRealDataGithubEventToActivity`,
// T-0978) ↔ 독립 oracle 재유도 byte-identical 정합 순수 가드 (T-0979 박제, PLAN.md
// 109행 수집 leg 의 event→activity 매핑 규칙 drift-guard).
//
// 책임:
//   - `mapRealDataGithubEventToActivity(username, event)`(T-0978,
//     `realdata-e2e-eval-chain-activity-map.ts`)는 실 github `/users/{user}/events/
//     public` 응답 1 건을 (a) event.type→kind 사영(PullRequestEvent→pr /
//     IssuesEvent→issue / else→commit), (b) externalId/timestamp/repoRef 방어적
//     fallback, (c) 상수 필드(sourceType="github", instanceKey="github.com",
//     author=username), (d) `metadata` 는 typed scalar 만(`titleLength = type.length`,
//     raw 본문 폐기 R-59)으로 매핑하는 **결정론적 매핑 규칙의 단일 지점**이다. 이 helper 는
//     이 스트림의 sibling 관례인 독립 `-consistency` drift-guard 를 아직 갖지 못했다 —
//     매핑 규칙이 조용히 회귀(예: kind 사영 대상 event type 오타, externalId
//     "unknown"→"" 변경, metadata 에 raw 본문 키 유입 R-59 위반, repoRef fallback 형식
//     변형)해도 colocated unit spec 만으로는 spec 이 함께 수정되면 통과할 수 있다. 본
//     가드가 그 빈칸을 **독립 재유도(oracle)** 로 채운다.
//
// 검증하는 불변식(single source — helper 를 호출하지 않고 규칙을 독립 재구현):
//   - expected = kind 사영 / externalId / timestamp / repoRef / 상수 필드 / metadata
//     규칙을 helper 와 무관하게 재유도해 산출한 `GithubActivity`. 인자로 받은 `activity`
//     가 expected 와 필드별 정합(metadata 는 deep-equal byte-identical)함.
//     `mapRealDataGithubEventToActivity` 를 호출하지 **않는다**(그러면 자기 자신 대조라
//     무의미) — 매핑 규칙을 재유도해 대조하므로, 어느 한쪽 규칙이 drift 하는 순간 fail
//     한다. 이는 형제 `realdata-e2e-eval-chain-consistency.ts`(T-0976)가 producer 조립
//     규칙을 재유도해 대조하는 leg-경계 가드의 매핑-leg mirror 다.
//
// 에러 정책(구조 결손 = TypeError / 값 정합 위반 = RangeError):
//   - `username` 비-string · `event` 비-객체(null 포함) · `activity` 비-객체(null 포함)
//     → 한국어 TypeError.
//   - 재유도 expected 와 kind / externalId / timestamp / repoRef / 상수 필드(sourceType·
//     instanceKey·author) / metadata drift → 한국어 RangeError(어긋난 필드명 + 기대/실측
//     정보 포함).
//   - silent 통과(위반인데 정상 void) 0. fail-fast(가장 먼저 위반한 지점에서 throw).
//
// 비변형 / 순수: `username` / `event` / `activity` 를 읽기·비교만 한다(쓰기 0).
// 네트워크/LLM/DB/env 읽기 0 · 부수효과 0 · `@Injectable` 0 · Prisma 0 · 새 외부
// dependency 0. 동일 입력 → 동일 동작(정합 activity 면 항상 void, drift 면 항상 동일
// 지점에서 throw).
//
// 🔥 §9 / R-59 격리: event fixture 는 type/id/created_at/repo.name 만 담는 더미 구조로
//   충분하며, 본 가드는 credential 값을 참조/echo/log 하지 않는다. raw 활동 본문(payload
//   전문·commit message·diff·issue body) 미보관 — typed 참조 필드만 비교한다. metadata
//   는 typed scalar(titleLength)만 허용하므로 raw 본문 키 유입은 정합 위반으로 차단된다.
//
// Out of Scope(task T-0979):
//   - `realdata-e2e-eval-chain-activity-map.ts`(T-0978) 본문 수정 — 본 가드는 import·
//     재유도 비교·throw 만(재정의 0). 특히 매핑 반환 직전 self-wire 배선은 별도 후속
//     slice(dependsOn 본 task, T-0977 self-wire mirror).
//   - 자동 복구 / 재합성 / 기본값 채움 0 — 손상 activity 를 고치지 않고 fail-fast throw
//     (복구는 호출처 책임). JSON schema / zod / ajv 도입 0(순수 비교만).
import type { GithubActivity } from "../../src/assessment-collection/domain/activity";

// 매핑 상수 — helper(`mapRealDataGithubEventToActivity`)의 상수 필드/폴백 규칙을 독립
// 재유도하기 위한 single source. helper 가 이 상수를 바꾸면 본 oracle 과 어긋나 fail 한다.
const EXPECTED_SOURCE_TYPE = "github";
const EXPECTED_INSTANCE_KEY = "github.com";
const EPOCH_TIMESTAMP = "1970-01-01T00:00:00Z";

// describe — 에러 메시지용 타입 라벨. null 을 typeof 가 뭉뚱그리는 'object' 대신 구분해
// 노출한다(디버깅 가독성).
function describe(value: unknown): string {
  if (value === null) {
    return "null";
  }
  return typeof value;
}

// assertUsernameStructure — 재유도 입력 username(author 귀속 + repoRef fallback 재유도에
// 사용)의 최소 형태를 fail-fast 검증. 비-string 은 재유도 직전 TypeError 로 차단한다.
function assertUsernameStructure(
  username: string,
  label: string,
): asserts username is string {
  if (typeof username !== "string") {
    throw new TypeError(
      `${label}: username 이 string 이 아니다(타입: ${describe(username)}) — 매핑 규칙을 재유도할 수 없다.`,
    );
  }
}

// assertEventStructure — 재유도 source(event map)의 최소 형태를 fail-fast 검증. 비-객체
// (null/undefined 포함)는 kind/externalId/timestamp/repoRef 재유도 직전 TypeError 로
// 차단한다(개별 필드 결손은 helper 와 동형으로 방어적 fallback 이 흡수 — 여기서는 map
// 자체의 존재만 검증).
function assertEventStructure(
  event: Record<string, unknown> | null | undefined,
  label: string,
): asserts event is Record<string, unknown> {
  if (event === null || typeof event !== "object") {
    throw new TypeError(
      `${label}: event 가 객체가 아니다(타입: ${describe(event)}) — 매핑 규칙을 재유도할 수 없다.`,
    );
  }
}

// assertActivityStructure — 검증 대상 activity 의 최소 형태를 fail-fast 검증. 비-객체
// (null/undefined 포함) → TypeError. 필드별 정합 비교 전 최소 형태 보장(개별 필드 값
// 정합은 재유도 대조의 몫).
function assertActivityStructure(
  activity: GithubActivity | null | undefined,
  label: string,
): asserts activity is GithubActivity {
  if (activity === null || typeof activity !== "object") {
    throw new TypeError(
      `${label}: activity 가 객체가 아니다(타입: ${describe(activity)}) — 매핑 정합 비교를 진행할 수 없다.`,
    );
  }
}

// deepEqual — JSON 직렬화 기반 byte-identical 비교. metadata 는 typed scalar 만 담는
// 얕은 map 이라 직렬화 동등 = 구조 동등. 비교만(입력 변형 0).
function deepEqual(actual: unknown, expected: unknown): boolean {
  return JSON.stringify(actual) === JSON.stringify(expected);
}

// deriveKindOracle — helper 의 event.type→kind 사영 규칙의 독립 재구현(oracle).
// PullRequestEvent→pr / IssuesEvent→issue / 그 외(비string 포함)→commit. helper 를
// import 해 재사용하지 않고 규칙 자체를 재유도해야(가드의 존재 이유) drift 대조 의미가
// 성립한다 — helper 의 사영 대상 문자열이 조용히 바뀌면 본 oracle 과 어긋나 fail 한다.
function deriveKindOracle(type: string): GithubActivity["kind"] {
  if (type === "PullRequestEvent") {
    return "pr";
  }
  if (type === "IssuesEvent") {
    return "issue";
  }
  return "commit";
}

/**
 * 실 평가 e2e full-chain 수집 leg 의 event→activity 매핑(`mapRealDataGithubEventToActivity`
 * 산출 `activity`)이, 동일 `username` / `event` 로부터 kind 사영 / externalId / timestamp
 * / repoRef / 상수 필드 / metadata 규칙을 **독립 재유도(oracle)** 한 결과와 필드별 정합
 * (metadata 는 byte-identical)함을 런타임에서 검증하는 순수 가드(PLAN.md P5 109행 수집
 * leg 매핑 규칙 build-time drift-guard).
 *
 * 형제 `assertRealDataE2eEvalChainInputConsistent`(T-0976)의 매핑-leg mirror —
 * 차이점: 재유도 source 가 producer 조립 규칙이 아니라 event→activity 매핑 규칙의 독립
 * 재구현이다(helper 를 호출하면 자기 자신 대조라 무의미).
 *
 * 검증하는 불변식(single source — 규칙 독립 재유도):
 *   - type = typeof event.type === "string" ? event.type : ""
 *   - kindExpected = deriveKindOracle(type)
 *   - externalIdExpected = typeof event.id === "string" ? event.id : String(event.id ?? "unknown")
 *   - timestampExpected = typeof event.created_at === "string" ? event.created_at : epoch
 *   - repoRefExpected = repo.name string ? repo.name : `${username}/unknown-repo`
 *   - sourceType="github" · instanceKey="github.com" · author=username ·
 *     metadata={ titleLength: type.length }
 *   가 `activity` 의 대응 필드와 정합(metadata 는 deep-equal byte-identical).
 *
 * 에러 정책(구조 결손 = TypeError / 값 정합 위반 = RangeError):
 *   - `username` 비-string · `event` 비-객체 · `activity` 비-객체 → 한국어 TypeError.
 *   - kind / externalId / timestamp / repoRef / 상수 필드 / metadata drift → 한국어
 *     RangeError(어긋난 필드명 + 기대/실측 정보 포함).
 *   - silent 통과(위반인데 정상 void) 0.
 *
 * 검사 순서: 구조(username · event · activity) → 재유도(type/kind/externalId/timestamp/
 * repoRef) → sourceType → instanceKey → author → kind → externalId → timestamp →
 * repoRef → metadata deep-equal. 가장 먼저 위반한 지점에서 throw(fail-fast).
 *
 * 비변형 / 순수: 세 인자를 읽기·비교만 한다(쓰기 0). 부수효과 0 · 네트워크/LLM/DB/env
 * 읽기 0 · 새 외부 dependency 0. 동일 입력 → 동일 동작(정합 activity 면 항상 void, drift
 * 면 항상 동일 지점에서 throw).
 *
 * @param username 매핑 시 사용한 수집 대상 username(author 귀속 + repoRef fallback 재유도
 *   key — 비시크릿, §9). 비-string 이면 TypeError. 변형하지 않는다.
 * @param event 매핑 source 인 실 github events API 응답 1 건(raw map). 비-객체면
 *   TypeError. 변형하지 않는다(읽기만).
 * @param activity 검증 대상 `mapRealDataGithubEventToActivity` 산출 `GithubActivity`.
 *   재유도 expected 와 모든 매핑 필드가 정합해야 한다. 변형하지 않는다.
 * @param label 에러 메시지 접두 라벨(디버깅 문맥 — 다중 activity 검증 시 어느 건인지 구분).
 *   기본값 "activity".
 * @returns 모든 매핑 필드가 재유도 expected 와 정합하면 아무 일도 하지 않고 정상 반환(void).
 * @throws {TypeError} `username` 비-string · `event` 비-객체 · `activity` 비-객체(구조/타입 결손).
 * @throws {RangeError} kind / externalId / timestamp / repoRef / sourceType / instanceKey
 *   / author / metadata drift(값 정합 위반). 메시지에 어긋난 필드명 + 기대/실측 포함.
 */
export function assertRealDataGithubEventActivityMappingConsistent(
  username: string,
  event: Record<string, unknown>,
  activity: GithubActivity,
  label = "activity",
): void {
  // 구조 검증(TypeError 분기) — username string + event 객체 + activity 객체 최소 형태.
  assertUsernameStructure(username, label);
  assertEventStructure(event, label);
  assertActivityStructure(activity, label);

  // 기대값 독립 재유도 — helper 를 호출하지 않고 매핑 규칙을 재구현한다(drift 대조의 핵심).
  // helper 의 사영/fallback/상수 규칙이 조용히 바뀌면 본 oracle 산출과 어긋나 아래 비교에서
  // fail 한다.
  const type = typeof event.type === "string" ? event.type : "";
  const kindExpected = deriveKindOracle(type);
  const externalIdExpected =
    typeof event.id === "string" ? event.id : String(event.id ?? "unknown");
  const timestampExpected =
    typeof event.created_at === "string" ? event.created_at : EPOCH_TIMESTAMP;
  const repo = event.repo as { name?: unknown } | undefined;
  const repoRefExpected =
    repo && typeof repo.name === "string"
      ? repo.name
      : `${username}/unknown-repo`;
  const metadataExpected = { titleLength: type.length };

  // sourceType 상수 정합(값 drift → RangeError). helper 의 discriminator 상수 변형 차단.
  if (activity.sourceType !== EXPECTED_SOURCE_TYPE) {
    throw new RangeError(
      `${label}: 정합 위반: activity.sourceType 이 재유도 expected 와 다르다 — 기대=${JSON.stringify(EXPECTED_SOURCE_TYPE)}, 실측=${JSON.stringify(activity.sourceType)}.`,
    );
  }

  // instanceKey 상수 정합(값 drift → RangeError). helper 의 instance 상수 변형 차단.
  if (activity.instanceKey !== EXPECTED_INSTANCE_KEY) {
    throw new RangeError(
      `${label}: 정합 위반: activity.instanceKey 가 재유도 expected 와 다르다 — 기대=${JSON.stringify(EXPECTED_INSTANCE_KEY)}, 실측=${JSON.stringify(activity.instanceKey)}.`,
    );
  }

  // author 정합(값 drift → RangeError). author = username 귀속 규칙이 다른 값으로 교체되면
  // 차단된다.
  if (activity.author !== username) {
    throw new RangeError(
      `${label}: 정합 위반: activity.author 가 재유도 expected(username 귀속)와 다르다 — 기대=${JSON.stringify(username)}, 실측=${JSON.stringify(activity.author)}.`,
    );
  }

  // kind 정합(사영 drift → RangeError). event.type→kind 3 분기 사영이 오타/변형되면 차단.
  if (activity.kind !== kindExpected) {
    throw new RangeError(
      `${label}: 정합 위반: activity.kind 가 재유도 expected 와 다르다 — 기대=${JSON.stringify(kindExpected)}, 실측=${JSON.stringify(activity.kind)}.`,
    );
  }

  // externalId 정합(fallback drift → RangeError). string 통과 / 비string String(...) /
  // "unknown" fallback 규칙 변형이 차단된다.
  if (activity.externalId !== externalIdExpected) {
    throw new RangeError(
      `${label}: 정합 위반: activity.externalId 가 재유도 expected 와 다르다 — 기대=${JSON.stringify(externalIdExpected)}, 실측=${JSON.stringify(activity.externalId)}.`,
    );
  }

  // timestamp 정합(fallback drift → RangeError). string 통과 / epoch fallback 규칙 변형 차단.
  if (activity.timestamp !== timestampExpected) {
    throw new RangeError(
      `${label}: 정합 위반: activity.timestamp 가 재유도 expected 와 다르다 — 기대=${JSON.stringify(timestampExpected)}, 실측=${JSON.stringify(activity.timestamp)}.`,
    );
  }

  // repoRef 정합(fallback drift → RangeError). repo.name 통과 / `${username}/unknown-repo`
  // fallback 형식 변형이 차단된다.
  if (activity.repoRef !== repoRefExpected) {
    throw new RangeError(
      `${label}: 정합 위반: activity.repoRef 가 재유도 expected 와 다르다 — 기대=${JSON.stringify(repoRefExpected)}, 실측=${JSON.stringify(activity.repoRef)}.`,
    );
  }

  // metadata 정합(byte-identical → RangeError). typed scalar(titleLength)만 허용 —
  // raw 본문 키(payload 전문·body 등) 유입 시 expected 와 어긋나 차단된다(R-59 격리 강제).
  if (!deepEqual(activity.metadata, metadataExpected)) {
    throw new RangeError(
      `${label}: 정합 위반: activity.metadata 가 재유도 expected 와 byte-identical 하지 않다(typed scalar titleLength 만 허용, R-59) — 기대=${JSON.stringify(metadataExpected)}, 실측=${JSON.stringify(activity.metadata)}.`,
    );
  }
}
