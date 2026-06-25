// realdata-e2e-result-issue-outcome-parse-shape.ts — 실 평가 e2e 결과 이슈 outcome
// 파서가 산출하는 `RealDataResultIssueOutcome` 의 **자기 own enumerable 키 집합**이
// 선언된 정규 parse-shape 키 집합(`REAL_DATA_RESULT_ISSUE_OUTCOME_PARSE_SHAPE_KEYS`)과
// 정확히 일치하는지 검증하는 순수 가드 (T-0661 박제).
//
// 책임:
//   - `parseRealDataResultIssueCreateEditOutput`(T-0589,
//     `realdata-e2e-result-issue-output-parse.ts`)는 `gh issue create` / `gh issue edit`
//     의 stdout 을 정규화해 outcome 을 `{issueNumber, url}` 만 산출한다(line 114~117,
//     추가 필드 drop).
//   - `RealDataResultIssueOutcome` interface(`realdata-e2e-result-issue-output-parse.ts`
//     line 57~60, `{issueNumber:number; url:string}`)는 그 산출 outcome 의 선언된 shape.
//   - 그러나 이 두 끝(파서가 **실제로 산출하는** outcome 의 키 집합 ↔ 선언된 interface
//     멤버)은 서로 독립적으로 하드코딩돼 있어, 누가 interface 에 키를 추가(예: `htmlUrl`)
//     하거나 파서가 추가 필드를 흘리면 silently 정합이 깨질 수 있다. 본 가드가 그
//     producer↔declared-shape seam 을 집합 동치 비교로 닫는다 — T-0659 search-hit ↔
//     parse-shape 가드의 post-execution mirror.
//   - search 측이 `--json`/json-fields 같은 선행 상수를 re-export 한 것과 달리,
//     post-execution 측에는 진실의 원천이 될 선행 상수가 없으므로, 본 가드가 **자체
//     single-source 정규 키 목록 상수** `REAL_DATA_RESULT_ISSUE_OUTCOME_PARSE_SHAPE_KEYS
//     = ["issueNumber", "url"]` 를 신규 정의한다.
//
// 🔥 build-time 완결 — dependency-free (cloud cron 자율 실행 가능):
//   - 실 네트워크 호출 0, env 읽기 0, DB 접근 0, live-LLM 0, credential 0, gh 실행 0.
//     새 외부 dependency 0(zod·ajv 등 도입 0). 내장 객체/배열/Set 연산만.
//
// 🔥 순수성·결정론·무공유:
//   - 입력 외 상태(시각·난수·env) 의존 0. 동일 입력 → 동일 동작(정합이면 항상 void,
//     부정합이면 항상 동일 위치 throw).
//   - 입력 `outcome`(객체) / `parseShapeKeys`(readonly string[]) 를 변형하지 않는다
//     (읽기·키 비교만). 내부 Set/Array 생성은 모두 새 객체.
//
// 책임 경계(task Out of Scope — T-0661):
//   - 파서(`realdata-e2e-result-issue-output-parse.ts`) / `RealDataResultIssueOutcome`
//     interface 본문 변경 0 — import·read 만(신규 type 정의 0).
//   - 신설 가드의 producer self-wire(`parseRealDataResultIssueCreateEditOutput` 산출
//     직전 본 가드 호출 배선) — 본 task 는 신설만, self-wire 는 Follow-up(T-0662 후보,
//     T-0660 self-wire 동형).
//   - search-side parse-shape 가드(T-0657/T-0659) 변경 0 — 본 가드는 그 post-execution
//     mirror 신설이지 기존 가드 수정 아님.
//   - outcome-report 컴포저(`realdata-e2e-result-issue-outcome-report-from-output.ts`)
//     의 추가 가드 — 본 task 는 outcome producer↔declared-shape seam 신설 1건만.
//   - live `gh issue create`/`edit` execFile wiring / 실 네트워크 호출 0 — credential
//     게이트 deferred, 본 가드는 build-time 순수 가드만.
//   - 새 외부 dependency / Prisma migration / STATE schema 변경 0.
//   - production `src/` 코드 변경 0(test helper 단독).
//
// 패턴 mirror: `realdata-e2e-result-issue-search-hit-shape.ts`(T-0659 동형) — 순수
// 가드 / 구조 결손=TypeError·값 정합 위반=RangeError 구분 / single-source 비교 /
// 한국어 JSDoc·책임 경계 주석 / 자동 복구 0 / 산출 경로 자동 배선 0. 본 가드는 그
// 에러 정책·관례·JSDoc 톤을 mirror 하되, 검증 대상이 "search hit `{number,title,body}`"
// 가 아니라 "outcome `{issueNumber,url}`" 이고, 정규 키 목록은 re-export 가 아니라
// **본 모듈에서 신규 정의**한다.
import type { RealDataResultIssueOutcome } from "./realdata-e2e-result-issue-output-parse";

// 정규 outcome parse-shape 키 목록 — `parseRealDataResultIssueCreateEditOutput`
// (T-0589) 가 정규화 반환하는 `{issueNumber, url}` 의 키와 `RealDataResultIssueOutcome`
// interface 멤버 (`issueNumber: number; url: string`) 와 동일.
// 매직 배열 대신 named constant 로 박제 — 본 모듈에서 정의·export 되는 진실의 원천이다
// (search 측이 json-fields 를 re-export 한 것과 달리 post-execution 측엔 선행 상수가
// 없으므로 신규 정의).
//   - cross-reference: realdata-e2e-result-issue-output-parse.ts line 114~117
//     (`return {issueNumber, url: match[0].trim()}`)
//   - cross-reference: realdata-e2e-result-issue-output-parse.ts line 57~60
//     (`interface RealDataResultIssueOutcome { issueNumber: number; url: string; }`)
// 본 상수의 순서·중복·집합 내용이 곧 outcome parse-shape 의 진실의 원천.
export const REAL_DATA_RESULT_ISSUE_OUTCOME_PARSE_SHAPE_KEYS = [
  "issueNumber",
  "url",
] as const;

// assertOutcomeStructure — outcome 이 구조적으로 own enumerable 키를 가진 plain object
// 인지 fail-fast 검증. null/undefined/비객체(숫자·문자열·배열 등)는 구조 결손이라
// RangeError 가 아니라 TypeError 로 구분한다(값 정합 위반과 분리). 배열도 거부 —
// outcome 은 키-값 객체여야 한다.
function assertOutcomeStructure(
  outcome: RealDataResultIssueOutcome | null | undefined,
): asserts outcome is RealDataResultIssueOutcome {
  if (outcome === null || outcome === undefined) {
    throw new TypeError(
      "outcome 이 null/undefined 일 수 없다 — 파서가 산출한 RealDataResultIssueOutcome 객체가 필요하다.",
    );
  }
  if (typeof outcome !== "object") {
    throw new TypeError(
      `outcome 이 객체가 아니다(타입: ${typeof outcome}) — 산출 outcome 키 집합을 추출할 수 없다.`,
    );
  }
  if (Array.isArray(outcome)) {
    throw new TypeError(
      "outcome 이 배열이다 — outcome 은 {issueNumber, url} 키-값 객체여야 하며 배열일 수 없다.",
    );
  }
}

// assertParseShapeKeysStructure — parseShapeKeys 가 구조적으로 string[] 인지 fail-fast
// 검증. 빈 배열은 parse-shape 부재(의미 위반)이므로 본 함수가 아니라 본체에서 RangeError
// 로 별도 거부한다(T-0659 convention 동형).
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

// collectParseShapeKeySet — parseShapeKeys 를 집합으로 정규화. 빈/공백-only 키와 중복
// 키는 의미 위반(parse-shape 키는 한 번씩만·공백 키 불가)이라 RangeError 로 거부한다.
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
        `parseShapeKeys 에 중복 키 '${key}' 가 있다 — 산출 outcome 과 1:1 매칭 의도가 흐려지므로 중복 키는 허용되지 않는다.`,
      );
    }
    seen.add(key);
  }
  return seen;
}

// collectOutcomeKeySet — outcome 의 own enumerable 키 집합을 정규화. 빈/공백-only 키는
// 비정상 산출(키 이름이 비어있는 outcome)이라 RangeError 로 거부한다. `Object.keys` 는
// own enumerable 만 반환하므로 prototype 오염 키는 자연히 제외된다.
function collectOutcomeKeySet(
  outcome: RealDataResultIssueOutcome,
): Set<string> {
  const keys = Object.keys(outcome);
  const seen = new Set<string>();
  for (let i = 0; i < keys.length; i += 1) {
    const key = keys[i];
    if (key.trim().length === 0) {
      throw new RangeError(
        `outcome 에 빈/공백-only own 키가 있다 — 산출 outcome 의 키 이름은 비어있을 수 없다.`,
      );
    }
    // Object.keys 는 중복 키를 반환하지 않으므로(JS 객체 키는 유일) 중복 검사는 불요 —
    // seen 누적만으로 충분(방어적으로 set 화).
    seen.add(key);
  }
  return seen;
}

/**
 * 실 평가 e2e 결과 이슈 outcome 파서 `parseRealDataResultIssueCreateEditOutput` 가
 * 산출한 `RealDataResultIssueOutcome` 의 **자기 own enumerable 키 집합**이 선언된 정규
 * parse-shape 키 집합(`parseShapeKeys`)과 정확히 일치하는지 런타임에서 검증하는 순수
 * 가드(PLAN.md P5 109행 step ④ 결과 박제 chain 의 outcome producer ↔ declared-shape
 * seam 무결성 조각). T-0659 search-hit ↔ parse-shape 가드의 post-execution mirror.
 *
 * 검증하는 불변식(set-equality, 순서 무관·정확 일치):
 *   (O0) outcome 과 parseShapeKeys 모두 구조적으로 온전(plain object / string[]).
 *   (O1) parseShapeKeys 가 비어있지 않다(parse-shape 부재 거부).
 *   (O2) parseShapeKeys 에 빈·중복 키가 없다.
 *   (O3) outcome 의 own enumerable 키에 빈·공백 키가 없다.
 *   (O4) outcome 키 집합 ⊇ parseShapeKeys 집합(parse-shape 키 누락 0).
 *   (O5) outcome 키 집합 ⊆ parseShapeKeys 집합(잉여 키 0).
 *   - (O4) AND (O5) ⇔ 두 집합이 set-equal. 순서는 집합 비교라 무관, 대소문자는 민감.
 *
 * 에러 정책(구조 결손 = TypeError / 값·의미 정합 위반 = RangeError):
 *   - `outcome`(null/undefined·비객체·배열) / `parseShapeKeys`(null/undefined·비배열·
 *     원소 비-string) → 한국어 TypeError.
 *   - 빈 parseShapeKeys / 빈·중복 parseShapeKeys 키 / 빈 outcome 키 / 누락 키 / 잉여
 *     키 → 한국어 RangeError. 메시지에 어느 키가 누락/잉여인지 정확히 명시(기대 집합
 *     vs 실측 집합 노출).
 *   - silent 통과(부정합인데 정상 반환) 0.
 *
 * 검사 순서: 구조(outcome / parseShapeKeys) → parseShapeKeys 빈 거부 → parseShapeKeys
 * 빈·중복 키 거부 → outcome 빈 키 거부 → 누락 검출 → 잉여 검출. 가장 먼저 위반한
 * 지점에서 throw(fail-fast). 누락·잉여가 동시일 때는 누락(O4)이 먼저 보고된다.
 *
 * 비변형 / 순수: `outcome` / `parseShapeKeys` 를 읽기·비교만 한다(쓰기 0). 부수효과 0
 * · `@Injectable` 0 · Prisma 0 · LLM 0 · 새 외부 dependency 0. 동일 입력 → 동일 동작
 * (정합이면 항상 void 반환, 부정합이면 항상 동일 위치 throw). 대소문자 민감
 * (byte-identical 키 비교 — case-fold 0). raw 미저장(R-59) — 키 이름 문자열만 비교,
 * outcome 의 값(issueNumber/url 본문)은 읽지 않는다.
 *
 * @param outcome 파서가 산출한 `RealDataResultIssueOutcome`(예: `{issueNumber:42,
 *   url:"https://github.com/o/r/issues/42"}`). 변형하지 않는다(own 키만 읽어 비교).
 *   본 가드는 키 집합만 보며 값은 읽지 않는다.
 * @param parseShapeKeys 선언된 parse-shape 의 정규 키 목록(readonly string[], 예:
 *   `["issueNumber","url"]`). 변형하지 않는다(읽기·비교만). 비어있을 수 없다.
 * @returns 두 집합이 set-equal 이면 아무 일도 하지 않고 정상 반환(void).
 * @throws {TypeError} `outcome` / `parseShapeKeys` 구조/타입 결손.
 * @throws {RangeError} 빈 parseShapeKeys / 빈·중복 parseShapeKeys 키 / 빈 outcome 키 /
 *   누락 키 / 잉여 키. 메시지에 위반 키 이름·기대 집합·실측 집합을 포함.
 */
export function assertRealDataResultIssueOutcomeMatchesParseShape(
  outcome: RealDataResultIssueOutcome,
  parseShapeKeys: readonly string[],
): void {
  // (O0) 구조 검증 — TypeError 분기.
  assertOutcomeStructure(outcome);
  assertParseShapeKeysStructure(parseShapeKeys);

  // (O1) parseShapeKeys 빈 배열 거부 — 비교할 정규 키 목록이 없으면 set-equality 가
  // 무의미하다. 의미 위반이라 RangeError.
  if (parseShapeKeys.length === 0) {
    throw new RangeError(
      "parseShapeKeys 가 빈 배열이다 — parse-shape 키 목록이 비어있으면 set-equality 비교가 무의미하다.",
    );
  }

  // (O2) parseShapeKeys 빈·중복 키 거부 → 기대 키 집합.
  const shapeSet = collectParseShapeKeySet(parseShapeKeys);

  // (O3) outcome 빈 키 거부 → 실측 키 집합.
  const outcomeSet = collectOutcomeKeySet(outcome);

  // (O4) 누락 검출 — parseShapeKeys 중 outcome 에 없는 키(선언은 했는데 파서가 산출
  // 안 한 것). 메시지에 전체 누락 리스트 포함.
  const missing: string[] = [];
  for (const shapeKey of shapeSet) {
    if (!outcomeSet.has(shapeKey)) {
      missing.push(shapeKey);
    }
  }
  if (missing.length > 0) {
    throw new RangeError(
      `불변식(O4) 위반: 산출 outcome 에 parse-shape 키가 누락됐다 — 누락=[${missing
        .map((m) => `'${m}'`)
        .join(",")}], 산출 outcome 키=[${[...outcomeSet]
        .map((k) => `'${k}'`)
        .join(",")}], 기대 shape=[${parseShapeKeys
        .map((k) => `'${k}'`)
        .join(",")}].`,
    );
  }

  // (O5) 잉여 검출 — outcome 키 중 parseShapeKeys 에 없는 키(파서가 산출했는데 선언
  // shape 에 없는 것). 메시지에 전체 잉여 리스트 포함.
  const extra: string[] = [];
  for (const outcomeKey of outcomeSet) {
    if (!shapeSet.has(outcomeKey)) {
      extra.push(outcomeKey);
    }
  }
  if (extra.length > 0) {
    throw new RangeError(
      `불변식(O5) 위반: 산출 outcome 에 parse-shape 에 없는 잉여 키가 있다 — 잉여=[${extra
        .map((e) => `'${e}'`)
        .join(",")}], 산출 outcome 키=[${[...outcomeSet]
        .map((k) => `'${k}'`)
        .join(",")}], 기대 shape=[${parseShapeKeys
        .map((k) => `'${k}'`)
        .join(",")}].`,
    );
  }
}
