// realdata-e2e-result-issue-action-consistency.ts — 실 평가 e2e 결과 이슈
// create-or-update action(`resolveRealDataResultIssueAction`, T-0584) 의 분기 결정과
// 최소 issueNumber 선택이, 동일 (searchHits, marker) 로부터 **독립 재유도**한 expected
// action 과 deep-equal 정합한지 검증하는 순수 가드(T-0703 박제).
//
// 동기: leaf resolver `resolveRealDataResultIssueAction`(T-0584,
// `realdata-e2e-result-issue-action.ts`)는 (1) body 가 marker 를 포함하는 후보 0건이면
// {action:'create'}, (2) 1+건이면 후보 중 **최소 number(가장 오래된 이슈)** 로
// {action:'update', issueNumber} 를 산출한다(멱등 회귀 보호 — 이슈 중복 방지). 이 leaf 는
// 직결 step④ 박제 경계의 분기 layer 인데, 그 후보 필터링/최소 선택/create-update 분기가
// 회귀로 drift(예: 최소 대신 최대 선택·후보 판정 기준 변경·create/update 경계 오류)하면
// build-time 에서 이를 잡는 독립 불변식 가드가 부재했다(NO-GUARD leaf). 본 가드가 그 빈칸을
// 채운다.
//
// 검증하는 불변식(single source — 컴포저 재호출 0, 후보 추출·최소 선택·분기 독립 재구현):
//   expected = (searchHits 중 body 가 marker 를 포함하는 후보) 가
//     0건 → {action:'create'}
//     1+건 → {action:'update', issueNumber: 후보 number 의 최소값}
//   를 가드 안에서 직접 재유도한 뒤 입력 `action` 과 deep-equal byte-identical.
//   `resolveRealDataResultIssueAction` 재호출 금지 — 재호출은 동일 로직 drift 를 양방향
//   상쇄해 잡지 못한다(재구현이 핵심).
//
// 에러 정책(구조 결손 = TypeError / 값 정합 위반 = RangeError):
//   - `action` null/undefined · action 필드가 'create'/'update' 가 아님 · update 인데
//     issueNumber 비-정수/부재 · searchHits 비-배열/원소 결손 · marker 비-string →
//     한국어 TypeError.
//   - 독립 재유도 expected 와 입력 `action` drift(create↔update 뒤바뀜 · issueNumber
//     mismatch · 후보 다수 시 최소 아닌 값 등) → 한국어 RangeError(기대 vs 실측 노출).
//   - marker 빈/공백 · hit number 0/음수/비정수 등 컴포저 input guard 와 동형인 위반은
//     재유도 단계에서 동일 throw 로 전파(가드 자체 try/catch 0).
//   - silent 통과(위반인데 정상 void) 0. fail-fast(가장 먼저 위반한 지점에서 throw).
//
// 비변형 / 순수: `action`(읽기·비교만) / `searchHits`(읽기만, mutate 0) / `marker`(읽기만).
// 부수효과 0 · `@Injectable` 0 · Prisma 0 · LLM 0 · 새 외부 dependency 0 · env/네트워크/
// credential 0. 동일 입력 → 동일 동작(정합 action 면 항상 void, drift action 면 항상 동일
// 지점에서 throw). raw 미저장(R-59) — action 은 issueNumber 만 보유(body/title 미접촉).
//
// 패턴 mirror: `assertRealDataResultIssueOutcomeReportSummaryLineConsistent`(T-0701) 의
// "컴포저 재호출이 아니라 로직 독립 재구현" 정신 + `assertRealDataResultIssuePublishPlan
// ConsistentWithSources`(T-0665) 의 구조 결손 TypeError / 값 정합 위반 RangeError 분리 톤.
//
// Out of Scope (T-0703): 컴포저 본문 수정 / self-wire 배선(후속 별도 task) · 상위 종단 가드
// (command-plan/gh-command-plan) 수정 · 명령-args 합성·gh argv 통합 · production src 변경 ·
// 실 gh 호출 / live wiring · 자동 복구/재유도/정규화 · zod·ajv 등 외부 validation 도입 —
// 전부 0.
import type {
  RealDataResultIssueAction,
  RealDataResultIssueSearchHit,
} from "./realdata-e2e-result-issue-action";

// describe — 에러 메시지용 타입 라벨. null/array 를 typeof 가 뭉뚱그리는 'object' 대신
// 구분해 노출한다(디버깅 가독성).
function describe(value: unknown): string {
  if (value === null) {
    return "null";
  }
  if (Array.isArray(value)) {
    return "array";
  }
  return typeof value;
}

// deepEqual — JSON 직렬화 기반 byte-identical 비교. action 은 결정론적 키 순서의 작은
// discriminated union 이라 직렬화 동등 = 구조 동등. 비교만(입력 변형 0).
function deepEqual(actual: unknown, expected: unknown): boolean {
  return JSON.stringify(actual) === JSON.stringify(expected);
}

// assertMarkerNonBlank — 컴포저 input guard 동형. marker 빈/공백-only 면 모든 hit 에 매칭돼
// 잘못된 분기를 유발하므로 명시적 throw(조용한 통과 차단). 가드도 동일 재유도 단계에서 차단.
function assertMarkerNonBlank(marker: string): void {
  if (marker.trim().length === 0) {
    throw new Error(
      "marker 가 비어있습니다 — 빈/공백-only marker 는 모든 hit 에 매칭되어 잘못된 분기를 유발하므로 허용되지 않습니다.",
    );
  }
}

// assertPositiveNumber — 컴포저 input guard 동형. gh 응답이 정상이면 number 는 항상 양의
// 정수다. 0 이하/비정수면 파싱 사고로 간주하고 throw(비정상 number 가 issueNumber 로 새는
// 것을 차단).
function assertPositiveNumber(value: number): void {
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(
      `RealDataResultIssueSearchHit.number 가 양의 정수가 아닙니다(${value}) — gh 응답 파싱 사고 방지를 위해 0 이하/비정수 number 는 허용되지 않습니다.`,
    );
  }
}

// assertSearchHitsStructure — searchHits 배열·각 hit 의 구조가 온전한지 fail-fast 검증.
// 구조/타입 결손은 RangeError 가 아니라 TypeError 로 구분한다(값 정합 위반과 분리). 각 hit 은
// number(number)·title(string)·body(string) 을 가져야 한다(재유도 후보 추출 전 최소 형태
// 보장). 단 number 의 양수/정수 검증은 컴포저 input guard 동형 위반이므로 재유도 단계의
// `assertPositiveNumber` 가 맡는다(Error 로 전파).
function assertSearchHitsStructure(
  searchHits: RealDataResultIssueSearchHit[] | null | undefined,
): asserts searchHits is RealDataResultIssueSearchHit[] {
  if (!Array.isArray(searchHits)) {
    throw new TypeError(
      `searchHits 가 배열이 아니다(타입: ${describe(searchHits)}) — action 정합 재유도를 진행할 수 없다.`,
    );
  }
  for (const [index, hit] of searchHits.entries()) {
    if (hit === null || typeof hit !== "object" || Array.isArray(hit)) {
      throw new TypeError(
        `searchHits[${index}] 가 객체가 아니다(타입: ${describe(hit)}) — hit 은 {number,title,body} 형태여야 한다.`,
      );
    }
    if (typeof hit.number !== "number") {
      throw new TypeError(
        `searchHits[${index}].number 가 숫자가 아니다(타입: ${typeof hit.number}) — 후보 추출 전 최소 형태 보장 실패.`,
      );
    }
    if (typeof hit.body !== "string") {
      throw new TypeError(
        `searchHits[${index}].body 가 문자열이 아니다(타입: ${typeof hit.body}) — marker 포함 여부 판정을 진행할 수 없다.`,
      );
    }
  }
}

// assertActionStructure — `action` 객체가 discriminated union 형태로 온전한지 fail-fast
// 검증. 구조/타입 결손은 TypeError 로 구분한다(값 정합 위반과 분리). action 은 'create' 또는
// 'update' 여야 하며, update 면 issueNumber 가 양의 정수여야 한다(재유도 비교 전 최소 형태
// 보장 — 깊은 값 정합은 재유도 비교가 맡는다).
function assertActionStructure(
  action: RealDataResultIssueAction | null | undefined,
): asserts action is RealDataResultIssueAction {
  if (action === null || typeof action !== "object" || Array.isArray(action)) {
    throw new TypeError(
      `action 이 객체가 아니다(타입: ${describe(action)}) — RealDataResultIssueAction 이 필요하다.`,
    );
  }
  const tag = (action as { action?: unknown }).action;
  if (tag !== "create" && tag !== "update") {
    throw new TypeError(
      `action.action 이 'create'/'update' 가 아니다(값: ${describe(tag)}) — discriminated union 태그가 아니다.`,
    );
  }
  if (tag === "update") {
    const issueNumber = (action as { issueNumber?: unknown }).issueNumber;
    if (typeof issueNumber !== "number") {
      throw new TypeError(
        `action.issueNumber 가 숫자가 아니다(타입: ${describe(issueNumber)}) — update action 은 issueNumber 를 가져야 한다.`,
      );
    }
    if (!Number.isInteger(issueNumber) || issueNumber <= 0) {
      throw new TypeError(
        `action.issueNumber 가 양의 정수가 아니다(${issueNumber}) — update issueNumber 는 양의 정수여야 한다.`,
      );
    }
  }
}

// deriveExpectedAction — searchHits/marker 만으로 expected action 을 **독립 재유도**한다.
// 컴포저(`resolveRealDataResultIssueAction`, T-0584)의 후보 추출(`body.includes(marker)`)·
// 최소 number 선택(`Math.min`)·create/update 분기를 의도적으로 재구현한다(컴포저 재호출 0 —
// 재호출은 동일 로직 drift 를 양방향 상쇄해 잡지 못한다). marker/number guard 도 동형으로
// 재실행해 컴포저와 같은 위반을 같은 throw 로 전파한다.
function deriveExpectedAction(
  searchHits: RealDataResultIssueSearchHit[],
  marker: string,
): RealDataResultIssueAction {
  // input guard 재유도(컴포저 동형) — marker 빈/공백, hit number 비-양정수 차단.
  assertMarkerNonBlank(marker);
  for (const hit of searchHits) {
    assertPositiveNumber(hit.number);
  }

  // 후보 추출 — body 가 marker 를 부분 문자열로 포함하는 hit 의 number(읽기만, mutate 0).
  const candidateNumbers = searchHits
    .filter((hit) => hit.body.includes(marker))
    .map((hit) => hit.number);

  // 후보 0건 → create.
  if (candidateNumbers.length === 0) {
    return { action: "create" };
  }

  // 후보 1+건 → 최소 number update(가장 오래된 이슈, 멱등 회귀 보호 — 입력 순서 무관).
  return { action: "update", issueNumber: Math.min(...candidateNumbers) };
}

/**
 * 실 평가 e2e 결과 이슈 create-or-update action(`resolveRealDataResultIssueAction`, T-0584)
 * 의 분기 결정과 최소 issueNumber 선택이, 동일 (searchHits, marker) 로부터 가드 안에서 독립
 * 재유도한 expected action 과 deep-equal byte-identical 정합함을 런타임에서 검증하는 순수
 * 가드(PLAN.md P5 step ④ 결과 박제 chain 의 멱등 분기-layer 무결성 조각).
 * `assertRealDataResultIssueOutcomeReportSummaryLineConsistent`(T-0701) 의 "컴포저 재호출이
 * 아니라 로직 독립 재구현" 정신을 action 분기 layer 로 mirror 한다.
 *
 * 검증하는 불변식(single source — 컴포저 재호출 0, 후보 추출·최소 선택·분기 독립 재구현):
 *   expected = (searchHits 중 body 가 marker 를 포함하는 후보)가 0건 → {action:'create'},
 *     1+건 → {action:'update', issueNumber: 후보 number 의 최소값}
 *   를 재유도한 뒤 입력 `action` 과 deep-equal byte-identical.
 *
 * 에러 정책(구조 결손 = TypeError / 값 정합 위반 = RangeError):
 *   - `action` null/undefined·action 태그가 'create'/'update' 아님·update 인데 issueNumber
 *     비-정수/부재·`searchHits` 비-배열/원소 결손·`marker` 비-string → 한국어 TypeError.
 *   - 독립 재유도 expected 와 입력 `action` drift(create↔update 뒤바뀜·issueNumber
 *     mismatch·후보 다수 시 최소 아닌 값) → 한국어 RangeError(기대 vs 실측 노출).
 *   - marker 빈/공백·hit number 0/음수/비정수 등 컴포저 input guard 동형 위반은 재유도
 *     단계에서 동일 Error 로 전파(가드 자체 try/catch 0).
 *   - silent 통과 0. 검사 순서: 구조(action·searchHits·marker) → 재유도(input guard 포함) →
 *     deep-equal 비교. 가장 먼저 위반한 지점에서 throw(fail-fast).
 *
 * 비변형 / 순수: `action`/`searchHits`/`marker` 를 읽기·비교만 한다(쓰기 0). 부수효과 0 ·
 * 새 외부 dependency 0. 동일 입력 → 동일 동작(정합 action 면 항상 void, drift action 면 항상
 * 동일 지점에서 throw). raw 미저장(R-59) — action 은 issueNumber 만 보유(body/title 미접촉).
 *
 * @param action 검증 대상 컴포저 산출 action. 변형하지 않는다(읽기·비교만). discriminated
 *   union('create' | 'update'+issueNumber) 형태여야 하며 재유도 expected 와 정합해야 한다.
 * @param searchHits 재유도 입력 gh search 응답 hit 배열. 변형하지 않는다(읽기만). 후보 추출에
 *   재사용한다. 비-배열/원소 결손이면 TypeError, hit number 비-양정수면 Error 전파.
 * @param marker 멱등 marker 문자열. 변형하지 않는다(읽기만). 비-string 이면 TypeError,
 *   빈/공백-only 면 컴포저 동형 Error 전파.
 * @returns 재유도 expected 와 정합하면 정상 반환(void).
 * @throws {TypeError} `action`/`searchHits`/`marker` 구조·타입 결손.
 * @throws {RangeError} 독립 재유도 expected 와 입력 `action` drift(값 정합 위반).
 * @throws {Error} marker 빈/공백·hit number 비-양정수(컴포저 input guard 동형 전파).
 */
export function assertRealDataResultIssueActionConsistentWithInputs(
  action: RealDataResultIssueAction,
  searchHits: RealDataResultIssueSearchHit[],
  marker: string,
): void {
  // 구조 검증(TypeError 분기) — action discriminated union 형태 + searchHits 배열/원소
  // 형태 + marker string.
  assertActionStructure(action);
  assertSearchHitsStructure(searchHits);
  if (typeof marker !== "string") {
    throw new TypeError(
      `marker 가 문자열이 아니다(타입: ${describe(marker)}) — 후보 추출을 진행할 수 없다.`,
    );
  }

  // 기대값 독립 재유도 — 후보 추출·최소 선택·create/update 분기를 컴포저 재호출 없이 직접
  // 재구현해 single-source expected 를 산출한다(drift 0). input guard 동형 위반(marker
  // 빈/공백·hit number 비-양정수)은 여기서 Error 로 전파된다.
  const expected = deriveExpectedAction(searchHits, marker);

  // 값 정합 비교(RangeError 분기) — deep-equal byte-identical.
  if (!deepEqual(action, expected)) {
    throw new RangeError(
      `정합 위반: action 이 (searchHits, marker) 로부터 독립 재유도한 expected 와 byte-identical 하지 않다 — 기대=${JSON.stringify(expected)}, 실측=${JSON.stringify(action)}. create/update 분기 또는 최소 issueNumber 선택이 drift 했다.`,
    );
  }
}
