// realdata-e2e-result-issue-search-hit-shape.ts — 실 평가 e2e 결과 이슈 search 가
// 파싱 산출하는 `RealDataResultIssueSearchHit` 의 **자기 own enumerable 키 집합**이
// 선언된 정규 parse-shape 키 집합(`REAL_DATA_RESULT_ISSUE_SEARCH_PARSE_SHAPE_KEYS`)과
// 정확히 일치하는지 검증하는 순수 가드 (T-0659 박제).
//
// 책임:
//   - `parseRealDataResultIssueSearchOutput`(T-0587,
//     `realdata-e2e-result-issue-search-parse.ts`)는 gh stdout JSON 을 정규화해
//     산출 hit 를 `{number, title, body}` 만 추출한다(line 130~135, 추가 필드 drop).
//   - `REAL_DATA_RESULT_ISSUE_SEARCH_PARSE_SHAPE_KEYS = ["number","title","body"]`
//     (T-0657, `realdata-e2e-result-issue-search-json-fields.ts` line 70~)는 그 추출
//     shape 의 정규 키 목록을 named constant 로 박제한다.
//   - 그러나 이 두 끝(파서가 **실제로 산출하는** hit 의 키 집합 ↔ 선언된 parse-shape
//     상수)은 서로 독립적으로 하드코딩돼 있어, 상수가 회귀(예: 누가 `author` 를
//     parse-shape 키에 추가)해도 파서는 옛 3키만 계속 추출해 정합이 silently 깨진다.
//     json-fields 가드(T-0657)는 상수를 `--json` 요청 필드와만 묶지, 파서가 실제
//     산출하는 hit 와 묶지 않는다. 본 가드가 그 constant↔produced-hit seam 을 집합
//     동치 비교로 닫는다 — T-0657 request-side 가드의 parse-output consumer-side mirror.
//
// 🔥 build-time 완결 — dependency-free (cloud cron 자율 실행 가능):
//   - 실 네트워크 호출 0, env 읽기 0, DB 접근 0, live-LLM 0, credential 0, gh 실행 0.
//     새 외부 dependency 0(zod·ajv 등 도입 0). 내장 객체/배열/Set 연산만.
//
// 🔥 순수성·결정론·무공유:
//   - 입력 외 상태(시각·난수·env) 의존 0. 동일 입력 → 동일 동작(정합이면 항상 void,
//     부정합이면 항상 동일 위치 throw).
//   - 입력 `hit`(객체) / `parseShapeKeys`(readonly string[]) 를 변형하지 않는다
//     (읽기·키 비교만). 내부 Set/Array 생성은 모두 새 객체.
//
// 책임 경계(task Out of Scope — T-0659):
//   - 파서(`realdata-e2e-result-issue-search-parse.ts`) / `RealDataResultIssueSearchHit`
//     interface(`realdata-e2e-result-issue-action.ts`) / 상수
//     (`realdata-e2e-result-issue-search-json-fields.ts`) 본문 변경 0 — import·read 만.
//   - 신설 가드의 builder/파서 self-wire(파서 산출 직전 본 가드 호출 배선) — 본 task 는
//     신설만, self-wire 는 Follow-up(T-0658 self-wire 동형).
//   - json-fields request-side 가드(T-0657) 변경 0 — 본 가드는 그 consumer-side sibling
//     신설이지 기존 가드 수정 아님.
//   - live `gh search issues` execFile wiring / 실 네트워크 호출 0 — credential 게이트
//     deferred, 본 가드는 build-time 순수 가드만.
//   - 새 외부 dependency / Prisma migration / STATE schema 변경 0.
//   - production `src/` 코드 변경 0(test helper 단독).
//
// 패턴 mirror: `realdata-e2e-result-issue-search-json-fields.ts`(T-0657 동형) — 순수
// 가드 / 구조 결손=TypeError·값 정합 위반=RangeError 구분 / single-source 비교 /
// 한국어 JSDoc·책임 경계 주석 / 자동 복구 0 / 산출 경로 자동 배선 0. 본 가드는 그
// 에러 정책·관례·JSDoc 톤을 mirror 하되, "요청 필드 ↔ shape" 가 아닌 "파싱 산출 hit 의
// 키 집합 ↔ 선언된 parse-shape 키 집합" 의 set-equality 정합을 검증한다.
import type { RealDataResultIssueSearchHit } from "./realdata-e2e-result-issue-action";
import { REAL_DATA_RESULT_ISSUE_SEARCH_PARSE_SHAPE_KEYS } from "./realdata-e2e-result-issue-search-json-fields";

// 본 모듈은 정규 키 목록 상수를 신규 정의하지 않고 T-0657 single-source 를 그대로
// re-export 만 한다(소비자가 한 곳에서 가드+상수를 함께 import 할 수 있게). 정의·진실의
// 원천은 여전히 `realdata-e2e-result-issue-search-json-fields.ts`.
export { REAL_DATA_RESULT_ISSUE_SEARCH_PARSE_SHAPE_KEYS };

// assertHitStructure — hit 가 구조적으로 own enumerable 키를 가진 plain object 인지
// fail-fast 검증. null/undefined/비객체(숫자·문자열·배열 등)는 구조 결손이라 RangeError 가
// 아니라 TypeError 로 구분한다(값 정합 위반과 분리). 배열도 거부 — hit 은 키-값 객체여야 한다.
function assertHitStructure(
  hit: RealDataResultIssueSearchHit | null | undefined,
): asserts hit is RealDataResultIssueSearchHit {
  if (hit === null || hit === undefined) {
    throw new TypeError(
      "hit 가 null/undefined 일 수 없다 — 파서가 산출한 RealDataResultIssueSearchHit 객체가 필요하다.",
    );
  }
  if (typeof hit !== "object") {
    throw new TypeError(
      `hit 가 객체가 아니다(타입: ${typeof hit}) — 산출 hit 키 집합을 추출할 수 없다.`,
    );
  }
  if (Array.isArray(hit)) {
    throw new TypeError(
      "hit 가 배열이다 — hit 은 {number, title, body} 키-값 객체여야 하며 배열일 수 없다.",
    );
  }
}

// assertParseShapeKeysStructure — parseShapeKeys 가 구조적으로 string[] 인지 fail-fast
// 검증. 빈 배열은 추출 shape 부재(의미 위반)이므로 본 함수가 아니라 본체에서 RangeError 로
// 별도 거부한다(T-0657 convention 동형).
function assertParseShapeKeysStructure(
  parseShapeKeys: readonly string[] | null | undefined,
): asserts parseShapeKeys is readonly string[] {
  if (parseShapeKeys === null || parseShapeKeys === undefined) {
    throw new TypeError(
      "parseShapeKeys 가 null/undefined 일 수 없다 — 선언된 parse-shape 정규 키 목록(readonly string[]) 이 필요하다.",
    );
  }
  if (!Array.isArray(parseShapeKeys)) {
    throw new TypeError(
      `parseShapeKeys 가 배열이 아니다(타입: ${typeof parseShapeKeys}) — parse-shape 키 집합 비교를 진행할 수 없다.`,
    );
  }
  for (let i = 0; i < parseShapeKeys.length; i += 1) {
    if (typeof parseShapeKeys[i] !== "string") {
      throw new TypeError(
        `parseShapeKeys[${i}] 가 문자열이 아니다(타입: ${typeof parseShapeKeys[i]}) — parse-shape 키는 모두 string 이어야 한다.`,
      );
    }
  }
}

// collectParseShapeKeySet — parseShapeKeys 를 집합으로 정규화. 빈/공백-only 키와 중복 키는
// 의미 위반(parse-shape 키는 한 번씩만·공백 키 불가)이라 RangeError 로 거부한다.
function collectParseShapeKeySet(
  parseShapeKeys: readonly string[],
): Set<string> {
  const seen = new Set<string>();
  for (let i = 0; i < parseShapeKeys.length; i += 1) {
    const key = parseShapeKeys[i];
    if (key.trim().length === 0) {
      throw new RangeError(
        `parseShapeKeys 에 빈/공백-only 키가 있다(index=${i}) — parse-shape 키는 비어있을 수 없다.`,
      );
    }
    if (seen.has(key)) {
      throw new RangeError(
        `parseShapeKeys 에 중복 키 '${key}' 가 있다 — 산출 hit 와 1:1 매칭 의도가 흐려지므로 중복 키는 허용되지 않는다.`,
      );
    }
    seen.add(key);
  }
  return seen;
}

// collectHitKeySet — hit 의 own enumerable 키 집합을 정규화. 빈/공백-only 키는 비정상
// 산출(키 이름이 비어있는 hit)이라 RangeError 로 거부한다. `Object.keys` 는 own enumerable
// 만 반환하므로 prototype 오염 키는 자연히 제외된다.
function collectHitKeySet(hit: RealDataResultIssueSearchHit): Set<string> {
  const keys = Object.keys(hit);
  const seen = new Set<string>();
  for (let i = 0; i < keys.length; i += 1) {
    const key = keys[i];
    if (key.trim().length === 0) {
      throw new RangeError(
        `hit 에 빈/공백-only own 키가 있다 — 산출 hit 의 키 이름은 비어있을 수 없다.`,
      );
    }
    // Object.keys 는 중복 키를 반환하지 않으므로(JS 객체 키는 유일) 중복 검사는 불요 —
    // seen 누적만으로 충분(방어적으로 set 화).
    seen.add(key);
  }
  return seen;
}

/**
 * 실 평가 e2e 결과 이슈 search 의 파서 `parseRealDataResultIssueSearchOutput` 가 산출한
 * `RealDataResultIssueSearchHit` 의 **자기 own enumerable 키 집합**이 선언된 정규
 * parse-shape 키 집합(`parseShapeKeys`)과 정확히 일치하는지 런타임에서 검증하는 순수
 * 가드(PLAN.md P5 109행 step ④ 결과 박제 chain 의 parse-shape ↔ produced-hit seam
 * 무결성 조각). T-0657 json-fields 가드(request-side)의 parse-output consumer-side mirror.
 *
 * 검증하는 불변식(set-equality, 순서 무관·정확 일치):
 *   (H0) hit 와 parseShapeKeys 모두 구조적으로 온전(plain object / string[]).
 *   (H1) parseShapeKeys 가 비어있지 않다(parse-shape 부재 거부).
 *   (H2) parseShapeKeys 에 빈·중복 키가 없다.
 *   (H3) hit 의 own enumerable 키에 빈·공백 키가 없다.
 *   (H4) hit 키 집합 ⊇ parseShapeKeys 집합(parse-shape 키 누락 0).
 *   (H5) hit 키 집합 ⊆ parseShapeKeys 집합(잉여 키 0).
 *   - (H4) AND (H5) ⇔ 두 집합이 set-equal. 순서는 집합 비교라 무관, 대소문자는 민감.
 *
 * 에러 정책(구조 결손 = TypeError / 값·의미 정합 위반 = RangeError):
 *   - `hit`(null/undefined·비객체·배열) / `parseShapeKeys`(null/undefined·비배열·원소
 *     비-string) → 한국어 TypeError.
 *   - 빈 parseShapeKeys / 빈·중복 parseShapeKeys 키 / 빈 hit 키 / 누락 키 / 잉여 키 →
 *     한국어 RangeError. 메시지에 어느 키가 누락/잉여인지 정확히 명시(기대 집합 vs
 *     실측 집합 노출).
 *   - silent 통과(부정합인데 정상 반환) 0.
 *
 * 검사 순서: 구조(hit / parseShapeKeys) → parseShapeKeys 빈 거부 → parseShapeKeys
 * 빈·중복 키 거부 → hit 빈 키 거부 → 누락 검출 → 잉여 검출. 가장 먼저 위반한 지점에서
 * throw(fail-fast). 누락·잉여가 동시일 때는 누락(H4)이 먼저 보고된다.
 *
 * 비변형 / 순수: `hit` / `parseShapeKeys` 를 읽기·비교만 한다(쓰기 0). 부수효과 0 ·
 * `@Injectable` 0 · Prisma 0 · LLM 0 · 새 외부 dependency 0. 동일 입력 → 동일 동작
 * (정합이면 항상 void 반환, 부정합이면 항상 동일 위치 throw). 대소문자 민감
 * (byte-identical 키 비교 — case-fold 0). raw 미저장(R-59) — 키 이름 문자열만 비교,
 * hit 의 값(title/body 본문)은 읽지 않는다.
 *
 * @param hit 파서가 산출한 `RealDataResultIssueSearchHit`(예: `{number:42, title:"t",
 *   body:"b"}`). 변형하지 않는다(own 키만 읽어 비교). 본 가드는 키 집합만 보며 값은
 *   읽지 않는다.
 * @param parseShapeKeys 선언된 parse-shape 의 정규 키 목록(readonly string[], 예:
 *   `["number","title","body"]`). 변형하지 않는다(읽기·비교만). 비어있을 수 없다.
 * @returns 두 집합이 set-equal 이면 아무 일도 하지 않고 정상 반환(void).
 * @throws {TypeError} `hit` / `parseShapeKeys` 구조/타입 결손.
 * @throws {RangeError} 빈 parseShapeKeys / 빈·중복 parseShapeKeys 키 / 빈 hit 키 /
 *   누락 키 / 잉여 키. 메시지에 위반 키 이름·기대 집합·실측 집합을 포함.
 */
export function assertRealDataResultIssueSearchHitMatchesParseShape(
  hit: RealDataResultIssueSearchHit,
  parseShapeKeys: readonly string[],
): void {
  // (H0) 구조 검증 — TypeError 분기.
  assertHitStructure(hit);
  assertParseShapeKeysStructure(parseShapeKeys);

  // (H1) parseShapeKeys 빈 배열 거부 — 비교할 정규 키 목록이 없으면 set-equality 가
  // 무의미하다. 의미 위반이라 RangeError.
  if (parseShapeKeys.length === 0) {
    throw new RangeError(
      "parseShapeKeys 가 빈 배열이다 — parse-shape 키 목록이 비어있으면 set-equality 비교가 무의미하다.",
    );
  }

  // (H2) parseShapeKeys 빈·중복 키 거부 → 기대 키 집합.
  const shapeSet = collectParseShapeKeySet(parseShapeKeys);

  // (H3) hit 빈 키 거부 → 실측 키 집합.
  const hitSet = collectHitKeySet(hit);

  // (H4) 누락 검출 — parseShapeKeys 중 hit 에 없는 키(선언은 했는데 파서가 산출 안 한
  // 것). 메시지에 전체 누락 리스트 포함.
  const missing: string[] = [];
  for (const shapeKey of shapeSet) {
    if (!hitSet.has(shapeKey)) {
      missing.push(shapeKey);
    }
  }
  if (missing.length > 0) {
    throw new RangeError(
      `불변식(H4) 위반: 산출 hit 에 parse-shape 키가 누락됐다 — 누락=[${missing
        .map((m) => `'${m}'`)
        .join(",")}], 산출 hit 키=[${[...hitSet]
        .map((k) => `'${k}'`)
        .join(",")}], 기대 shape=[${parseShapeKeys
        .map((k) => `'${k}'`)
        .join(",")}].`,
    );
  }

  // (H5) 잉여 검출 — hit 키 중 parseShapeKeys 에 없는 키(파서가 산출했는데 선언 shape 에
  // 없는 것). 메시지에 전체 잉여 리스트 포함.
  const extra: string[] = [];
  for (const hitKey of hitSet) {
    if (!shapeSet.has(hitKey)) {
      extra.push(hitKey);
    }
  }
  if (extra.length > 0) {
    throw new RangeError(
      `불변식(H5) 위반: 산출 hit 에 parse-shape 에 없는 잉여 키가 있다 — 잉여=[${extra
        .map((e) => `'${e}'`)
        .join(",")}], 산출 hit 키=[${[...hitSet]
        .map((k) => `'${k}'`)
        .join(",")}], 기대 shape=[${parseShapeKeys
        .map((k) => `'${k}'`)
        .join(",")}].`,
    );
  }
}
