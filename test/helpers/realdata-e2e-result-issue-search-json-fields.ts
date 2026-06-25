// realdata-e2e-result-issue-search-json-fields.ts — 실 평가 e2e 결과 이슈 search 의
// `gh search issues --json <fields>` 요청 필드 집합이 search-parse 가 추출하는
// `RealDataResultIssueSearchHit` shape 키 집합과 정확히 일치하는지 검증하는 순수 가드
// (T-0657 박제).
//
// 책임:
//   - `buildRealDataResultIssueSearchGhArgv`(T-0586/T-0656,
//     `realdata-e2e-result-issue-search-argv.ts`)는 `REAL_DATA_RESULT_ISSUE_SEARCH_JSON_FIELDS
//     = "number,title,body"` 콤마 문자열을 `--json` 인자로 합성해 gh 에 요청할 필드 집합을
//     박제한다.
//   - `parseRealDataResultIssueSearchOutput`(T-0587,
//     `realdata-e2e-result-issue-search-parse.ts`)는 gh stdout JSON 을 정규화해
//     `RealDataResultIssueSearchHit = {number, title, body}` 만 추출한다.
//   - 그러나 이 두 끝(요청-측 콤마 문자열 ↔ 추출-측 shape 키 집합)은 서로 독립적으로
//     하드코딩돼 있어, 한쪽이 회귀(예: argv 가 `body` 요청을 빠뜨려 `--json number,title`
//     이 되거나, parser 가 요청한 적 없는 `labels` 같은 필드를 추출 shape 에 추가)해도
//     build-time 으로는 잡히지 않는 latent coupling 이 남아있다. 본 가드가 그 seam 을
//     집합 동치 비교로 닫는다.
//
// 🔥 build-time 완결 — dependency-free (cloud cron 자율 실행 가능):
//   - 실 네트워크 호출 0, env 읽기 0, DB 접근 0, live-LLM 0, credential 0, gh 실행 0.
//     새 외부 dependency 0(zod·ajv 등 도입 0). 내장 문자열/배열/Set 연산만.
//
// 🔥 순수성·결정론·무공유:
//   - 입력 외 상태(시각·난수·env) 의존 0. 동일 입력 → 동일 동작(정합이면 항상 void,
//     부정합이면 항상 동일 위치 throw).
//   - 입력 `requestedFields`(string) / `parseShapeKeys`(readonly string[]) 를 변형하지
//     않는다(읽기·비교만). 내부 Set/Array 생성은 모두 새 객체.
//
// 🔥 매직 배열 차단(named constant 단일 source):
//   - `REAL_DATA_RESULT_ISSUE_SEARCH_PARSE_SHAPE_KEYS = ["number", "title", "body"]
//     as const` 를 정규 키 목록의 단일 출처로 박제한다. parser 가 추출하는 `{number,
//     title, body}` 정규화 shape (`realdata-e2e-result-issue-search-parse.ts` line 131~135)
//     및 `RealDataResultIssueSearchHit` interface 멤버 (`realdata-e2e-result-issue-
//     action.ts` line 65~) 와 동일 — type-level 정합은 cross-reference 주석으로 박제
//     (런타임 의존 아님; 추출 shape 의 진실은 parser, 본 가드는 그 키 목록을 named
//     constant 로 외화).
//
// 책임 경계(task Out of Scope — T-0657):
//   - `buildRealDataResultIssueSearchGhArgv` self-wire(반환 직전 본 가드 호출 배선) —
//     본 task 는 신설·정합 봉인만, self-wire 는 Follow-up ① 의 별도 slice(T-0654/
//     T-0656 와 동형 분리, cap·단일책임).
//   - `parseRealDataResultIssueSearchOutput` / `buildRealDataResultIssueSearchGhArgv`
//     본문 변경 0 — 상수·shape 키만 import·읽기, 로직 수정 0.
//   - `RealDataResultIssueSearchHit` interface 변경 / 신규 type 정의 0 — type-import
//     cross-check 만(주석 수준).
//   - live `gh search issues` execFile wiring / 실 네트워크·JSON 파싱 실호출 0 —
//     credential 게이트 deferred, 본 가드는 build-time 순수 가드만.
//   - 다른 layer(create/edit argv, command-args, descriptor, output-parse, publish-plan)
//     정합 가드 — 본 가드는 search-argv-요청 필드 ↔ search-parse-추출 shape 키 seam 한 곳만.
//   - 새 외부 dependency / Prisma migration / STATE schema 변경 — 0.
//   - production `src/` 코드 변경 — 0(test helper 단독).
//
// 패턴 mirror: `realdata-e2e-result-issue-gh-argv-consistency.ts`(T-0653 동형) /
// `realdata-e2e-result-issue-search-argv-consistency.ts`(T-0655 동형) — 순수 가드 /
// 구조 결손=TypeError·값 정합 위반=RangeError 구분 / single-source 비교 / 한국어 JSDoc·
// 책임 경계 주석 / 자동 복구 0 / 산출 경로 자동 배선 0. 본 가드는 그 에러 정책·관례·
// JSDoc 톤을 mirror 하되, argv round-trip 이 아닌 "요청 필드 집합 ↔ 추출 shape 키 집합"
// 의 set-equality 정합을 검증한다.

// 정규 search-parse 추출 shape 키 목록 — `parseRealDataResultIssueSearchOutput`
// (T-0587) 가 정규화하는 `{number, title, body}` 의 키와 `RealDataResultIssueSearchHit`
// (T-0584) interface 멤버 (`number: number; title: string; body: string`) 와 동일.
// 매직 배열 대신 named constant 로 박제 — 본 가드의 추출-측 single-source.
//   - cross-reference: realdata-e2e-result-issue-search-parse.ts line 131~135
//     (return `{number: record.number, title: record.title, body: record.body}`)
//   - cross-reference: realdata-e2e-result-issue-action.ts line 65~70
//     (`interface RealDataResultIssueSearchHit { number; title; body; }`)
// 본 상수의 순서·중복·집합 내용이 곧 추출 shape 의 진실의 원천.
export const REAL_DATA_RESULT_ISSUE_SEARCH_PARSE_SHAPE_KEYS = [
  "number",
  "title",
  "body",
] as const;

// assertRequestedFieldsStructure — requestedFields 가 구조적으로 string 인지 fail-fast
// 검증. 구조/타입 결손은 RangeError 가 아니라 TypeError 로 구분한다(값 정합 위반과 분리).
function assertRequestedFieldsStructure(
  requestedFields: string | null | undefined,
): asserts requestedFields is string {
  if (requestedFields === null || requestedFields === undefined) {
    throw new TypeError(
      "requestedFields 가 null/undefined 일 수 없다 — `gh search issues --json <fields>` 의 콤마 구분 필드 문자열이 필요하다.",
    );
  }
  if (typeof requestedFields !== "string") {
    throw new TypeError(
      `requestedFields 가 문자열이 아니다(타입: ${typeof requestedFields}) — ` +
        `\`--json\` 인자 값은 콤마 구분 string 이어야 한다.`,
    );
  }
}

// assertParseShapeKeysStructure — parseShapeKeys 가 구조적으로 string[] 인지 fail-fast
// 검증. 빈 배열은 추출 shape 부재(의미 위반)이므로 RangeError 로 별도 거부한다.
function assertParseShapeKeysStructure(
  parseShapeKeys: readonly string[] | null | undefined,
): asserts parseShapeKeys is readonly string[] {
  if (parseShapeKeys === null || parseShapeKeys === undefined) {
    throw new TypeError(
      "parseShapeKeys 가 null/undefined 일 수 없다 — 추출 shape 의 정규 키 목록(readonly string[]) 이 필요하다.",
    );
  }
  if (!Array.isArray(parseShapeKeys)) {
    throw new TypeError(
      `parseShapeKeys 가 배열이 아니다(타입: ${typeof parseShapeKeys}) — 추출 shape 키 집합 비교를 진행할 수 없다.`,
    );
  }
  for (let i = 0; i < parseShapeKeys.length; i += 1) {
    if (typeof parseShapeKeys[i] !== "string") {
      throw new TypeError(
        `parseShapeKeys[${i}] 가 문자열이 아니다(타입: ${typeof parseShapeKeys[i]}) — 추출 shape 키는 모두 string 이어야 한다.`,
      );
    }
  }
}

// splitRequestedFieldsIntoSet — 콤마 구분 `--json` 문자열을 split·trim 해 필드 집합을
// 얻는다. 중복은 입력 의미 위반(요청 필드는 한 번씩만)이라 별도 거부한다.
//   - 콤마 주변 공백 허용(`"number, title , body"` 도 정상 trim 후 ["number","title","body"]).
//   - 빈/공백 토큰(`","` / `"number,,title"` / `"number, ,title"`)은 의미 위반(빈 필드)
//     이라 거부.
//   - 중복 토큰(`"number,number,title,body"`)은 추출 shape 와 1:1 매칭 의도를 흐려
//     latent coupling 회귀 차단 의미가 약해지므로 거부.
function splitRequestedFieldsIntoSet(requestedFields: string): Set<string> {
  const tokens = requestedFields.split(",").map((token) => token.trim());
  const seen = new Set<string>();
  for (let i = 0; i < tokens.length; i += 1) {
    const token = tokens[i];
    if (token.length === 0) {
      throw new RangeError(
        `requestedFields 에 빈/공백-only 필드 토큰이 있다(index=${i}) — 콤마로 구분된 각 토큰은 비어있을 수 없다(요청='${requestedFields}').`,
      );
    }
    if (seen.has(token)) {
      throw new RangeError(
        `requestedFields 에 중복 필드 '${token}' 가 있다 — 추출 shape 와 1:1 매칭 의도가 흐려지므로 중복 토큰은 허용되지 않는다(요청='${requestedFields}').`,
      );
    }
    seen.add(token);
  }
  return seen;
}

/**
 * 실 평가 e2e 결과 이슈 search 의 `gh search issues --json <fields>` 요청 필드 집합이
 * `parseRealDataResultIssueSearchOutput` 가 추출하는 `RealDataResultIssueSearchHit`
 * shape 키 집합과 정확히 일치하는지 런타임에서 검증하는 순수 가드(PLAN.md P5 109행
 * step ④ 결과 박제 chain 의 search-json-fields ↔ search-parse-shape seam 무결성 조각).
 *
 * 검증하는 불변식(set-equality, 순서 무관·정확 일치):
 *   (J0) requestedFields 와 parseShapeKeys 모두 구조적으로 온전(string / string[]).
 *   (J1) parseShapeKeys 가 비어있지 않다(추출 shape 부재 거부).
 *   (J2) requestedFields 가 빈 문자열/공백-only 가 아니다(전체 필드 누락 거부).
 *   (J3) requestedFields 의 콤마 토큰에 빈/중복 토큰이 없다.
 *   (J4) requestedFields 의 필드 집합 ⊇ parseShapeKeys 의 집합(누락 0).
 *   (J5) requestedFields 의 필드 집합 ⊆ parseShapeKeys 의 집합(잉여 0).
 *   - (J4) AND (J5) ⇔ 두 집합이 set-equal. 순서·중복은 (J3) 단계에서 이미 정규화·거부.
 *
 * 에러 정책(구조 결손 = TypeError / 값·의미 정합 위반 = RangeError):
 *   - `requestedFields`(null/undefined·비-string) / `parseShapeKeys`(null/undefined·
 *     비배열·원소 비-string) → 한국어 TypeError.
 *   - 빈 parseShapeKeys / 빈·공백 requestedFields / 빈·중복 토큰 / 누락 필드 / 잉여
 *     필드 → 한국어 RangeError. 메시지에 어느 필드가 누락/잉여인지 정확히 명시
 *     (기대 집합 vs 실측 집합 노출).
 *   - silent 통과(부정합인데 정상 반환) 0.
 *
 * 검사 순서: 구조(requestedFields / parseShapeKeys) → parseShapeKeys 빈 거부 →
 * requestedFields 빈/공백 거부 → 콤마 토큰 split·trim·중복 거부 → 누락 검출 →
 * 잉여 검출. 가장 먼저 위반한 지점에서 throw(fail-fast).
 *
 * 비변형 / 순수: `requestedFields` / `parseShapeKeys` 를 읽기·비교만 한다(쓰기 0).
 * 부수효과 0 · `@Injectable` 0 · Prisma 0 · LLM 0 · 새 외부 dependency 0. 동일 입력
 * → 동일 동작(정합이면 항상 void 반환, 부정합이면 항상 동일 위치 throw). 공백·
 * 대소문자 민감(byte-identical 비교 — case-fold 0; 콤마 주변 trim 만). raw 미저장
 * (R-59) — 필드 이름 문자열만 비교.
 *
 * @param requestedFields argv 빌더가 `--json` 인자로 합성한 콤마 구분 필드 문자열
 *   (예: `"number,title,body"`). 변형하지 않는다(읽기·비교만). 콤마 주변 공백은 trim
 *   되어 정규화된다.
 * @param parseShapeKeys parser 가 추출하는 정규화 shape 의 키 목록(readonly string[],
 *   예: `["number","title","body"]`). 변형하지 않는다(읽기·비교만). 비어있을 수 없다.
 * @returns 두 집합이 set-equal 이면 아무 일도 하지 않고 정상 반환(void).
 * @throws {TypeError} `requestedFields` / `parseShapeKeys` 구조/타입 결손.
 * @throws {RangeError} 빈 parseShapeKeys / 빈·공백 requestedFields / 빈·중복 토큰 /
 *   누락 필드 / 잉여 필드. 메시지에 위반 필드 이름·기대 집합·실측 집합을 포함.
 */
export function assertRealDataResultIssueSearchJsonFieldsMatchParseShape(
  requestedFields: string,
  parseShapeKeys: readonly string[],
): void {
  // (J0) 구조 검증 — TypeError 분기.
  assertRequestedFieldsStructure(requestedFields);
  assertParseShapeKeysStructure(parseShapeKeys);

  // (J1) parseShapeKeys 빈 배열 거부 — 추출 shape 가 비어있으면 본 가드가 비교할
  // 정규 키 목록이 없다. 의미 위반이라 RangeError.
  if (parseShapeKeys.length === 0) {
    throw new RangeError(
      "parseShapeKeys 가 빈 배열이다 — 추출 shape 키 목록이 비어있으면 set-equality 비교가 무의미하다.",
    );
  }

  // (J2) requestedFields 빈/공백-only 거부 — split 결과가 단일 빈 토큰이라 전체 필드
  // 누락을 의미한다. 의미 위반이라 RangeError.
  if (requestedFields.trim().length === 0) {
    throw new RangeError(
      `requestedFields 가 빈 문자열/공백-only 이다 — \`--json\` 필드 요청이 전체 누락된 상태이므로 추출 shape 와 set-equal 일 수 없다.`,
    );
  }

  // (J3) 콤마 split + trim + 빈/중복 토큰 거부 → 요청 필드 집합.
  const requestedSet = splitRequestedFieldsIntoSet(requestedFields);

  // parseShapeKeys 를 집합으로(읽기만, 비교용 새 객체).
  const parseShapeSet = new Set<string>(parseShapeKeys);

  // (J4) 누락 검출 — parseShapeKeys 중 requestedSet 에 없는 필드(추출은 하는데 요청
  // 안 한 것). 가장 먼저 검출되는 누락 필드 1개로 fail-fast(메시지에 전체 누락 리스트
  // 포함).
  const missing: string[] = [];
  for (const shapeKey of parseShapeSet) {
    if (!requestedSet.has(shapeKey)) {
      missing.push(shapeKey);
    }
  }
  if (missing.length > 0) {
    throw new RangeError(
      `불변식(J4) 위반: requestedFields 에 추출 shape 의 필드가 누락됐다 — 누락=[${missing
        .map((m) => `'${m}'`)
        .join(",")}], 요청='${requestedFields}', 기대 shape=[${parseShapeKeys
        .map((k) => `'${k}'`)
        .join(",")}].`,
    );
  }

  // (J5) 잉여 검출 — requestedSet 중 parseShapeSet 에 없는 필드(요청은 했는데 추출
  // shape 에 없는 것). 메시지에 전체 잉여 리스트 포함.
  const extra: string[] = [];
  for (const requested of requestedSet) {
    if (!parseShapeSet.has(requested)) {
      extra.push(requested);
    }
  }
  if (extra.length > 0) {
    throw new RangeError(
      `불변식(J5) 위반: requestedFields 에 추출 shape 에 없는 잉여 필드가 있다 — 잉여=[${extra
        .map((e) => `'${e}'`)
        .join(",")}], 요청='${requestedFields}', 기대 shape=[${parseShapeKeys
        .map((k) => `'${k}'`)
        .join(",")}].`,
    );
  }
}
