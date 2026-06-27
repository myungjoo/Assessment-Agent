// realdata-e2e-result-issue-descriptor-identity-consistency.ts — 실 평가 e2e 결과 이슈
// descriptor 의 title·marker 가 run 식별자(`${dateToken}@${gitSha}`)로부터 **독립
// 재유도**한 expected title·marker 와 byte-identical 정합한지 검증하는 순수 가드
// (T-0709 박제).
//
// 동기: leaf 컴포저 `buildRealDataResultIssueDescriptor`(T-0582,
// `realdata-e2e-result-issue-descriptor.ts`)은 daily-test 결과 이슈의
// `{ title, marker, body }` descriptor 를 합성한다. 그 중 **`body`** 3 블록 구조
// 불변식은 이미 `assertRealDataResultIssueDescriptorBodyConsistent`(T-0646)가 self-wire
// 로 강제하지만, 그 body 가드는 책임 경계 주석(line 35)에서 **`title`/`marker` 합성 규칙
// 자체의 재검증을 명시적으로 제외**한다("marker 는 body 첫 라인과의 일치만 비교, marker
// 합성 규칙 자체 재검증 아님"). 즉
//   - title  = `${ISSUE_TITLE_PREFIX} ${dateToken}@${gitSha}`
//   - marker = `${ISSUE_MARKER_PREFIX} ${dateToken}@${gitSha} -->`
// 의 **합성 규칙** — ① title/marker 가 동일 run token 을 공유 / ② summary 무관, 동일 run
// 이면 title·marker 동일(멱등 search-or-update 의 핵심, REQ-032) / ③ prefix 고정 / ④ 빈/
// 공백-only gitSha·dateToken 은 비식별 박제 방지로 거부 — 는 컴포저 본문 주석과 happy-path
// 단언으로만 박제돼 있고 **런타임에서 강제되는 독립 재유도 가드가 부재**(NO-GUARD leaf 의
// 미cover 영역)하다. 본 가드가 그 빈칸을 채운다. 손상된 식별자(title 과 marker 의 run token
// 이 어긋나거나, marker 가 다른 run token 을 담아 멱등 검색이 깨지는) descriptor 가 실 gh
// issue search-or-update 분기로 새기 전 fail-fast throw 로 차단한다. T-0707 live-gating
// 가드의 "컴포저 재호출이 아니라 합성 규칙 독립 재구현" 정신을 identity layer 로 mirror.
//
// 검증하는 불변식(single source — 컴포저 재호출 0, title·marker 합성 규칙 독립 재구현):
//   ① descriptor.title  === `${ISSUE_TITLE_PREFIX} ${dateToken}@${gitSha}` (재유도 byte-identical).
//   ② descriptor.marker === `${ISSUE_MARKER_PREFIX} ${dateToken}@${gitSha} -->` (재유도 byte-identical).
//   ③ title 과 marker 가 **동일 run token** 을 담는다(멱등 불변식) — ①∧② 가 둘을 각각 동일
//      expectedToken 기반 expected 와 대조하므로 token 동치는 ①∧② 에 의해 함의(서로 다른
//      token 이면 ① 또는 ② 가 먼저 catch). 별도 교차 비교 분기는 dead branch 라 두지 않는다.
//   ④ run.gitSha / run.dateToken 이 빈/공백-only 면 비식별 박제 방지로 거부(컴포저 assertNonBlank
//      규칙 mirror) — 그런 run 은 정상 통과시키지 않는다.
//
// 에러 정책(구조 결손 = TypeError / 값 정합 위반 = RangeError):
//   - `descriptor` / `run` null/undefined·비객체·`title`/`marker`/`gitSha`/`dateToken` 비-string
//     (구조/타입 결손) → 한국어 TypeError.
//   - run.gitSha / run.dateToken 빈/공백-only(비식별 식별자)·독립 재유도 expected 와 입력
//     drift(title mismatch / marker mismatch / title·marker run token 불일치 / prefix·닫는
//     `-->` 어긋남) → 한국어 RangeError(기대 vs 실측 노출).
//   - silent 통과 0. 검사 순서: 구조(descriptor / run) → 빈/공백 거부 → 재유도 → title·marker
//     byte-identical 대조. 가장 먼저 위반한 지점에서 throw(fail-fast).
//
// 비변형 / 순수: `descriptor`(읽기·비교만) / `run`(읽기만, mutate 0). 재유도용 새 string 만
// 생성. 부수효과 0 · `@Injectable` 0 · Prisma 0 · LLM·실 네트워크 0 · 새 외부 dependency 0.
// 동일 입력 → 동일 동작(정상 descriptor 면 항상 void, 손상 descriptor 면 항상 동일 위치 throw).
//
// prefix·token 합성 규칙 single source 정합(중복 정의 회피):
//   - `RealDataResultIssueDescriptor` / `RealDataResultIssueRunRef` 타입은 컴포저에서 import
//     재사용한다(타입 재정의 0). 컴포저의 `ISSUE_TITLE_PREFIX`/`ISSUE_MARKER_PREFIX` 상수는
//     모듈 private(export 부재)이라 import 할 수 없으므로(컴포저 본문 수정은 task Out of Scope),
//     본 가드는 prefix 와 token 합성 규칙을 **독립 재구현**한다. 컴포저 출력과의 drift 위험은
//     colocated spec 이 실 `buildRealDataResultIssueDescriptor` 산출물을 happy-path fixture 로
//     재사용하는 paired 교차 검증으로 차단한다(재유도가 컴포저와 byte-identical 함을 spec 이 증명).
//
// Out of Scope (T-0709): 컴포저 본문 수정 / self-wire 배선(가드를 컴포저 return 직전 호출 —
// 후속 별도 task) · prefix 값·token 합성 규칙 변경 · body 3 블록 구조 재검증(T-0646 담당) ·
// production src 변경 · 자동 복구/descriptor 재합성/정규화 · zod·ajv 등 외부 validation 도입 — 전부 0.
import type {
  RealDataResultIssueDescriptor,
  RealDataResultIssueRunRef,
} from "./realdata-e2e-result-issue-descriptor";

// 이슈 제목 prefix — 컴포저(`realdata-e2e-result-issue-descriptor.ts` L62)의 ISSUE_TITLE_PREFIX
// 와 동형이되 의도적으로 독립 재정의한다(컴포저 상수가 module private 라 import 불가 + 본 가드는
// 합성 규칙을 재호출이 아니라 재구현해야 drift 를 잡는다). 컴포저와의 byte-identical 정합은 spec
// 의 paired 교차 검증이 보장한다.
const EXPECTED_ISSUE_TITLE_PREFIX = "실 평가 e2e 결과";

// 멱등 marker prefix — 컴포저 L66 의 ISSUE_MARKER_PREFIX 독립 재정의(위와 동일 이유).
const EXPECTED_ISSUE_MARKER_PREFIX = "<!-- realdata-e2e-result-issue:";

// marker 의 닫는 토큰 — 컴포저 L128 `${ISSUE_MARKER_PREFIX} ${token} -->` 의 trailing ` -->`.
// expected marker 합성에 쓰인다(닫는 '-->' 누락 손상도 ② 재유도 대조가 catch).
const MARKER_CLOSE_TOKEN = " -->";

// describe — 에러 메시지용 타입 라벨. null/array 를 typeof 가 뭉뚱그리는 'object' 대신 구분해
// 노출한다(디버깅 가독성). live-gating·result-summary 가드 동형.
function describe(value: unknown): string {
  if (value === null) {
    return "null";
  }
  if (Array.isArray(value)) {
    return "array";
  }
  return typeof value;
}

// isPlainRecord — value 가 plain 객체(Record)인지 판정. null/array 는 제외한다(descriptor /
// run 구조 검증용).
function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

// isBlank — string 이 빈 문자열·공백-only 인지 판정. 컴포저 assertNonBlank(L98~104)의
// `value.trim().length === 0` 규칙을 mirror 재구현한다(비식별 식별자 거부 — ④).
function isBlank(value: string): boolean {
  return value.trim().length === 0;
}

// assertDescriptorStructure — descriptor 객체와 필수 string 필드(title / marker)가 구조적으로
// 온전한지 fail-fast 검증. 구조/타입 결손은 RangeError 가 아니라 TypeError 로 구분한다.
function assertDescriptorStructure(
  descriptor: RealDataResultIssueDescriptor | null | undefined,
): asserts descriptor is RealDataResultIssueDescriptor {
  if (!isPlainRecord(descriptor)) {
    throw new TypeError(
      `descriptor 가 객체가 아니다(타입: ${describe(descriptor)}) — RealDataResultIssueDescriptor 가 필요하다.`,
    );
  }
  const title = (descriptor as { title?: unknown }).title;
  if (typeof title !== "string") {
    throw new TypeError(
      `descriptor.title 이 문자열이 아니다(타입: ${describe(title)}) — title 재유도 대조를 진행할 수 없다.`,
    );
  }
  const marker = (descriptor as { marker?: unknown }).marker;
  if (typeof marker !== "string") {
    throw new TypeError(
      `descriptor.marker 가 문자열이 아니다(타입: ${describe(marker)}) — marker 재유도 대조를 진행할 수 없다.`,
    );
  }
}

// assertRunStructure — run 객체와 필수 string 필드(gitSha / dateToken)가 구조적으로 온전한지
// fail-fast 검증. 구조/타입 결손은 TypeError(빈/공백 거부 RangeError 와 분리 — 타입은 맞지만
// 값이 비식별인 경우는 값 정합 위반이므로 RangeError).
function assertRunStructure(
  run: RealDataResultIssueRunRef | null | undefined,
): asserts run is RealDataResultIssueRunRef {
  if (!isPlainRecord(run)) {
    throw new TypeError(
      `run 이 객체가 아니다(타입: ${describe(run)}) — RealDataResultIssueRunRef 가 필요하다.`,
    );
  }
  const gitSha = (run as { gitSha?: unknown }).gitSha;
  if (typeof gitSha !== "string") {
    throw new TypeError(
      `run.gitSha 가 문자열이 아니다(타입: ${describe(gitSha)}) — run token 재유도를 진행할 수 없다.`,
    );
  }
  const dateToken = (run as { dateToken?: unknown }).dateToken;
  if (typeof dateToken !== "string") {
    throw new TypeError(
      `run.dateToken 이 문자열이 아니다(타입: ${describe(dateToken)}) — run token 재유도를 진행할 수 없다.`,
    );
  }
}

/**
 * 실 평가 e2e 결과 이슈 descriptor 의 title·marker 가 run 식별자로부터 독립 재유도한
 * expected title·marker 와 byte-identical 정합함을 런타임에서 검증하는 순수 가드
 * (PLAN.md P5 L109 실 평가 e2e 결과 박제 chain 의 identity-layer 무결성 조각).
 * `assertRealDataResultIssueDescriptorBodyConsistent`(T-0646)가 명시 제외한 title·marker
 * 합성 규칙 재검증 영역을 채운다.
 *
 * 검증하는 불변식(single source — 컴포저 재호출 0, title·marker 합성 규칙 독립 재구현):
 *   ① descriptor.title  === `${ISSUE_TITLE_PREFIX} ${dateToken}@${gitSha}`.
 *   ② descriptor.marker === `${ISSUE_MARKER_PREFIX} ${dateToken}@${gitSha} -->`.
 *   ③ title 과 marker 가 동일 run token 을 담는다(멱등 불변식 — ①∧② 에 의해 함의).
 *   ④ run.gitSha / run.dateToken 빈/공백-only 거부(비식별 박제 방지, 컴포저 assertNonBlank mirror).
 *
 * 에러 정책(구조 결손 = TypeError / 값 정합 위반 = RangeError):
 *   - `descriptor` / `run` null/undefined·비객체·title/marker/gitSha/dateToken 비-string → 한국어 TypeError.
 *   - run.gitSha / run.dateToken 빈/공백-only·재유도 drift(title/marker mismatch·prefix·닫는
 *     `-->` 어긋남) → 한국어 RangeError(기대 vs 실측 노출).
 *   - silent 통과 0. 검사 순서: 구조 → 빈/공백 거부 → 재유도 → byte-identical 대조. fail-fast.
 *
 * 비변형 / 순수: `descriptor`/`run` 을 읽기·비교만 한다(쓰기 0). 재유도용 새 string 만 생성.
 * 부수효과 0 · 새 외부 dependency 0. 동일 입력 → 동일 동작.
 *
 * @param descriptor 검증 대상 컴포저 산출 descriptor. 변형하지 않는다(읽기·비교만). title /
 *   marker 가 문자열이어야 하며 재유도 expected 와 byte-identical 해야 한다.
 * @param run 본 가드가 expected title·marker 를 재유도할 single-source run 식별자. 변형하지
 *   않는다(읽기만). gitSha / dateToken 이 non-blank string 이어야 한다.
 * @returns 불변식 ①~④ 를 모두 만족하면 정상 반환(void).
 * @throws {TypeError} `descriptor` / `run` 구조·타입 결손.
 * @throws {RangeError} 빈/공백 식별자 또는 독립 재유도 expected 와 입력 drift(값 정합 위반).
 */
export function assertRealDataResultIssueDescriptorIdentityConsistent(
  descriptor: RealDataResultIssueDescriptor,
  run: RealDataResultIssueRunRef,
): void {
  // 구조 검증(TypeError 분기) — descriptor / run 객체 + title/marker/gitSha/dateToken string.
  assertDescriptorStructure(descriptor);
  assertRunStructure(run);

  // 빈/공백 식별자 거부(RangeError 분기, 불변식 ④) — 컴포저 assertNonBlank mirror. 비식별
  // 식별자는 정상 통과시키지 않는다(필드별 분기).
  if (isBlank(run.gitSha)) {
    throw new RangeError(
      "정합 위반: run.gitSha 가 빈/공백-only 이다 — 비식별 이슈 박제 방지를 위해 빈 식별자는 허용되지 않는다(컴포저 assertNonBlank mirror).",
    );
  }
  if (isBlank(run.dateToken)) {
    throw new RangeError(
      "정합 위반: run.dateToken 이 빈/공백-only 이다 — 비식별 이슈 박제 방지를 위해 빈 식별자는 허용되지 않는다(컴포저 assertNonBlank mirror).",
    );
  }

  // run token 독립 재유도 — 컴포저 runToken(L92~94) `${dateToken}@${gitSha}` 재구현(재호출 0).
  const expectedToken = `${run.dateToken}@${run.gitSha}`;
  const expectedTitle = `${EXPECTED_ISSUE_TITLE_PREFIX} ${expectedToken}`;
  const expectedMarker = `${EXPECTED_ISSUE_MARKER_PREFIX} ${expectedToken}${MARKER_CLOSE_TOKEN}`;

  // 불변식 ① — title 재유도 대조(byte-identical). prefix·token 어느 쪽이 drift 해도 catch.
  if (descriptor.title !== expectedTitle) {
    throw new RangeError(
      `정합 위반: descriptor.title 이 run 으로부터 재유도한 expected title 과 다르다 — 기대='${expectedTitle}', 실측='${descriptor.title}'. prefix 또는 run token 합성이 drift 했다.`,
    );
  }

  // 불변식 ② — marker 재유도 대조(byte-identical). prefix·token·닫는 `-->` 어느 쪽이 drift 해도 catch.
  if (descriptor.marker !== expectedMarker) {
    throw new RangeError(
      `정합 위반: descriptor.marker 가 run 으로부터 재유도한 expected marker 와 다르다 — 기대='${expectedMarker}', 실측='${descriptor.marker}'. prefix·run token·닫는 '-->' 중 하나가 drift 했다.`,
    );
  }

  // 불변식 ③(멱등 token 동치)은 ①∧② 에 의해 함의된다 — title 과 marker 가 각각 동일
  // `expectedToken`(= `${dateToken}@${gitSha}`)으로부터 재유도한 expected 와 byte-identical
  // 하므로, 둘이 담은 run token 도 필연적으로 동일하다(서로 다른 token 이면 ① 또는 ② 가 먼저
  // catch). 별도 교차 추출·비교 분기는 ①∧② 통과 시 항상 참인 dead branch 라 두지 않는다
  // (T-0646 body 가드의 dead-branch 제거 정신 mirror). 멱등 search-or-update 불변식은 ①∧②
  // 가 직접 보장한다(동일 run → 동일 title·marker, summary 무관).
}
