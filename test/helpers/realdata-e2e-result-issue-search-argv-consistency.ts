// realdata-e2e-result-issue-search-argv-consistency.ts — 실 평가 e2e 결과 이슈 search
// 인자-벡터(argv)가 입력 명령-args 의 searchQuery 를 argv 위치로 정합 round-trip 했고
// 고정 인자(`--match body` / `--json` 필드 / `--limit` 값) shape 를 유지했는지 검증하는
// 순수 가드(T-0655 박제).
//
// 책임:
//   - `buildRealDataResultIssueSearchGhArgv`(T-0586,
//     `realdata-e2e-result-issue-search-argv.ts`)는 `RealDataResultIssueCommandArgs` 의
//     searchQuery 를 실 `gh search issues --json number,title,body` 호출에 그대로 넘길
//     인자-벡터(argv, `string[]`)로 합성한다. 산출 argv 는
//     `["search", "issues", "--match", "body", searchQuery, "--json",
//      REAL_DATA_RESULT_ISSUE_SEARCH_JSON_FIELDS, "--limit",
//      REAL_DATA_RESULT_ISSUE_SEARCH_LIMIT]`(길이 9) 이다. 이 빌더는 `assertSearchQuery-
//     NonBlank` inline guard 만 보유하고, **산출 argv 가 commandArgs.searchQuery 를 argv 의
//     올바른 위치(index 4)로 정합 전파했는지, 고정 인자(`--match body` 위치·`--json` 필드
//     문자열·`--limit` 값·동사 prefix)가 drift 하지 않았는지 검증하는 독립 불변식 가드는
//     부재** 하다. 즉 빌더가 회귀(예: searchQuery 값이 다른 위치로 새거나, `--match body`
//     위치가 어긋나거나, `--json` 필드가 `RealDataResultIssueSearchHit` 멤버와 어긋나거나,
//     `--limit` 상수가 drift 하거나, `["search","issues"]` 동사 prefix 가 빠지면) 손상 argv 가
//     `execFile('gh', searchArgv)` live wiring 으로 새어 잘못된 gh 검색이 실행되고 분기 결정
//     (T-0584 resolver)이 오염된다. 본 가드가 그 빈칸을 채운다.
//
// 🔥 command-args single-source(search-argv-side mirror):
//   - 본 가드는 `assertRealDataResultIssueGhArgvPreservesCommandArgs`(T-0653, create/edit
//     argv 가드)의 search-side mirror 다. 그 가드는 build-time chain 의 한 끝(create/edit
//     argv)이 명령-args 를 보존하는지 검증했고, 본 가드는 그 chain 의 다른 한 끝(search
//     argv)이 명령-args 의 searchQuery 를 보존하는지 검증한다. commandArgs 를 single-source 로
//     삼아 argv 의 searchQuery 위치 정합 + 고정 인자 shape 만 비교한다(descriptor 재유도 0 —
//     upstream 가드가 cover).
//
// 부수효과 0 / 외부 의존 0 / `@Injectable` 0 / Prisma 0 / LLM 호출 0 / repository 0 /
// 입력 비변형(argv·commandArgs 읽기·비교만) / 동일 입력 → 동일 동작(정상 argv 면 항상 void
// 반환, 부정합 argv 면 항상 동일 위치 throw). raw 미저장(R-59) — argv 의 searchQuery
// string 만 비교(narrative/raw 본문 미접촉). 새 외부 dependency 0, DB write·migration 0,
// live LLM 호출 0. 같은 디렉토리 타입·상수 import 라 runtime cycle 0.
//
// 책임 경계(task Out of Scope):
//   - `buildRealDataResultIssueSearchGhArgv` 본문·출력 타입 변경 0(타입·상수만 import
//     소비, 재정의 0). 본 가드는 import·비교·throw 만.
//   - 자동 복구 / argv 재합성 / 정규화 / 기본값 채움 0 — 부정합 argv 를 고치거나 silent
//     수선하지 않는다(fail-fast). 복구는 호출처 책임.
//   - 산출 경로 자동 배선(`buildRealDataResultIssueSearchGhArgv` 산출 직전 self-wire) 0 —
//     순수 가드 helper 까지. self-wire 는 별도 follow-up slice(T-0654 가 create/edit 가드를
//     self-wire 한 것의 search-side mirror).
//   - `--repo owner/repo` 인자 / repo slug 정합 검증 0 — 빌더가 search 핵심 인자만 산출하고
//     repo 컨텍스트는 caller 책임(본 가드는 빌더가 실제 산출하는 argv 범위만).
//   - JSON schema / 외부 validation 라이브러리(zod·ajv) 도입 0 — 순수 배열·string 비교만.
//
// 패턴 mirror: `realdata-e2e-result-issue-gh-argv-consistency.ts`(T-0653, 순수 함수 /
// 구조 결손=TypeError·값 정합 위반=RangeError 구분 / single-source 비교 / 한국어 JSDoc·
// 책임 경계 주석 / 자동 복구 0 / 산출 경로 자동 배선 0). 본 가드는 그 에러 정책·가드 관례·
// JSDoc 톤을 mirror 하되, create/edit argv 측이 아닌 search argv 측 round-trip 정합을
// 검증한다.

import type { RealDataResultIssueCommandArgs } from "./realdata-e2e-result-issue-command-args";
import {
  REAL_DATA_RESULT_ISSUE_SEARCH_JSON_FIELDS,
  REAL_DATA_RESULT_ISSUE_SEARCH_LIMIT,
} from "./realdata-e2e-result-issue-search-argv";

// search argv 의 결정론적 길이 — `["search","issues","--match","body",searchQuery,
// "--json",FIELDS,"--limit",LIMIT]` 정확히 9 원소. 잉여/누락 원소 거부 기준.
const EXPECTED_SEARCH_ARGV_LENGTH = 9;

// assertArgvStructure — argv 가 구조적으로 온전한지(배열 + 모든 원소 string) fail-fast
// 검증. 구조/타입 결손은 RangeError 가 아니라 TypeError 로 구분한다(값 정합 위반과 분리).
function assertArgvStructure(
  argv: string[] | null | undefined,
): asserts argv is string[] {
  if (argv === null || argv === undefined) {
    throw new TypeError(
      "argv 가 null/undefined 일 수 없다 — string[] search argv 가 필요하다.",
    );
  }
  if (!Array.isArray(argv)) {
    throw new TypeError(
      `argv 가 배열이 아니다(타입: ${typeof argv}) — gh search argv 정합 비교를 진행할 수 없다.`,
    );
  }
  for (let i = 0; i < argv.length; i += 1) {
    if (typeof argv[i] !== "string") {
      throw new TypeError(
        `argv[${i}] 가 문자열이 아니다(타입: ${typeof argv[i]}) — argv 원소는 모두 string 이어야 한다.`,
      );
    }
  }
}

// assertCommandArgsStructure — commandArgs 객체와 searchQuery 필드가 구조적으로 온전한지
// fail-fast 검증. 구조/타입 결손은 TypeError 로 구분한다(값 정합 위반과 분리).
function assertCommandArgsStructure(
  commandArgs: RealDataResultIssueCommandArgs | null | undefined,
): asserts commandArgs is RealDataResultIssueCommandArgs {
  if (commandArgs === null || commandArgs === undefined) {
    throw new TypeError(
      "commandArgs 가 null/undefined 일 수 없다 — RealDataResultIssueCommandArgs 객체가 필요하다.",
    );
  }
  if (typeof commandArgs.searchQuery !== "string") {
    throw new TypeError(
      `commandArgs.searchQuery 가 문자열이 아니다(타입: ${typeof commandArgs.searchQuery}) — searchQuery round-trip 정합 비교를 진행할 수 없다.`,
    );
  }
}

// assertSearchQueryNonBlank — 입력 searchQuery 가 빈/공백-only 면 거부(T-0586 빌더의
// `assertSearchQueryNonBlank` 동형). 빈/공백 searchQuery 는 전체 매칭 사고를 유발하므로
// 가드도 입력 단계에서 거부한다. 입력 의미 위반이라 RangeError 로 구분한다(구조는 온전).
function assertSearchQueryNonBlank(searchQuery: string): void {
  if (searchQuery.trim().length === 0) {
    throw new RangeError(
      "commandArgs.searchQuery 가 비어있다 — 빈/공백-only searchQuery 는 전체 매칭 사고를 유발하므로 허용되지 않는다(T-0586 동형 거부).",
    );
  }
}

/**
 * 실 평가 e2e 결과 이슈 search 인자-벡터(argv)가 입력 명령-args 의 searchQuery 를 argv 위치로
 * 정합 round-trip 했고 고정 인자 shape 를 유지했는지 런타임에서 검증하는 순수 가드(PLAN.md P5
 * 109행 step ④ 결과 박제 chain 의 search-argv-layer 무결성 조각).
 * `assertRealDataResultIssueGhArgvPreservesCommandArgs`(T-0653, create/edit argv 가드)의
 * search-side mirror — build-time chain 의 다른 한 끝(search argv)이 commandArgs.searchQuery 를
 * 보존하는지 검증한다.
 *
 * 검증하는 불변식(single source — commandArgs + T-0586 named constant, 빌더의 search argv
 * 합성 규칙 강제):
 *   (S0) argv 동사 prefix 가 `["search", "issues", ...]` — drift 하면 위반.
 *   (S1) argv[2]==='--match' 이고 argv[3]==='body' — body 매칭 flag-pair 정합.
 *   (S2) argv[4]===commandArgs.searchQuery (byte-identical round-trip; 단일 argv 원소 보존).
 *   (S3) argv[5]==='--json' 이고 argv[6]===REAL_DATA_RESULT_ISSUE_SEARCH_JSON_FIELDS
 *        (단일-source 상수 정합; `RealDataResultIssueSearchHit` 멤버와의 cross-check 는 빌더가
 *        보유, 가드는 그 상수와의 일치만 비교).
 *   (S4) argv[7]==='--limit' 이고 argv[8]===REAL_DATA_RESULT_ISSUE_SEARCH_LIMIT
 *        (단일-source 상수 정합).
 *   (S5) argv 길이가 정확히 9 — search argv 에 잉여/누락 원소가 없음.
 *
 * 에러 정책(구조 결손 = TypeError / 값·의미 정합 위반 = RangeError):
 *   - `argv`(null/undefined·비배열·원소 비-string) / `commandArgs`(null/undefined·searchQuery
 *     비-string) → 한국어 TypeError.
 *   - 빈/공백 searchQuery(입력 의미 위반) 및 모든 불변식(S0~S5) 위반 → 한국어 RangeError.
 *     메시지에 어느 위치·어느 값이 drift 했는지 포함(기대값 vs 실측값 노출).
 *   - silent 통과(위반인데 정상 반환) 0.
 *
 * 검사 순서: 구조(argv / commandArgs) → searchQuery 빈/공백 거부 → 길이 → 동사 prefix →
 * `--match body` → searchQuery round-trip → `--json` 필드 → `--limit` 값. 가장 먼저 위반한
 * 지점에서 throw(fail-fast).
 *
 * 비변형 / 순수: `argv` / `commandArgs` 를 읽기·비교만 한다(쓰기 0). 부수효과 0 ·
 * `@Injectable` 0 · Prisma 0 · LLM 0 · 새 외부 dependency 0. 동일 입력 → 동일 동작(정상
 * argv 면 항상 void 반환, 부정합 argv 면 항상 동일 위치 throw). 공백·대소문자 민감
 * (byte-identical 비교 — trim·case-fold 0). searchQuery 인젝션 토큰(`"; rm -rf"` 등)도 단일
 * argv 원소로 그대로 비교(escape/분리 0). raw 미저장(R-59) — searchQuery string 만 비교.
 *
 * @param argv 검증 대상 gh search 인자-벡터. 변형하지 않는다(읽기·비교만). 모든 원소가
 *   string 인 길이-9 배열이어야 한다.
 * @param commandArgs argv 가 보존해야 할 searchQuery 의 single-source 명령-args. 변형하지
 *   않는다(읽기·비교만). searchQuery 만 본다 — createArgs/updateArgs 등 무관 멤버는 무시.
 * @returns search argv round-trip 정합 불변식을 모두 만족하면 아무 일도 하지 않고 정상
 *   반환(void).
 * @throws {TypeError} `argv` / `commandArgs` 구조/타입 결손.
 * @throws {RangeError} 빈/공백 searchQuery 또는 동사 prefix·`--match body`·searchQuery 위치·
 *   `--json` 필드·`--limit` 값·길이 정합 위반. 메시지에 위반 위치·기대값 vs 실측값을 포함.
 */
export function assertRealDataResultIssueSearchGhArgvPreservesCommandArgs(
  argv: string[],
  commandArgs: RealDataResultIssueCommandArgs,
): void {
  // 구조 검증(TypeError 분기) — argv 배열·원소 string / commandArgs.searchQuery string.
  assertArgvStructure(argv);
  assertCommandArgsStructure(commandArgs);

  const { searchQuery } = commandArgs;

  // 입력 의미 검증 — 빈/공백 searchQuery 거부(T-0586 동형). 구조는 온전하나 의미 위반이라
  // RangeError 로 구분한다.
  assertSearchQueryNonBlank(searchQuery);

  // (S5) 길이 정합 — 위치별 비교 전에 길이를 먼저 강제해 인덱스 접근이 안전하도록 한다.
  if (argv.length !== EXPECTED_SEARCH_ARGV_LENGTH) {
    throw new RangeError(
      `불변식(S5) 위반: search argv 길이가 ${EXPECTED_SEARCH_ARGV_LENGTH} 가 아니다 — 기대=${EXPECTED_SEARCH_ARGV_LENGTH}, 실측=${argv.length}. search argv 에 잉여/누락 원소가 끼었다.`,
    );
  }

  // (S0) 동사 prefix 정합 — search argv 는 `["search", "issues", ...]` 로 시작해야 한다.
  if (argv[0] !== "search" || argv[1] !== "issues") {
    throw new RangeError(
      `불변식(S0) 위반: search argv 동사 prefix 가 'search issues' 가 아니다 — 기대=['search','issues'], 실측=['${String(
        argv[0],
      )}','${String(argv[1])}']. 동사 prefix 가 drift 됐다.`,
    );
  }

  // (S1) --match flag + body 값 정합 — marker 는 issue body 안에 박혀있으므로 body 매칭.
  if (argv[2] !== "--match") {
    throw new RangeError(
      `불변식(S1) 위반: argv[2] 가 '--match' 가 아니다 — 기대='--match', 실측='${String(
        argv[2],
      )}'. search argv 의 match flag 위치가 drift 됐다.`,
    );
  }
  if (argv[3] !== "body") {
    throw new RangeError(
      `불변식(S1) 위반: argv[3](--match 값)이 'body' 가 아니다 — 기대='body', 실측='${String(
        argv[3],
      )}'. body 매칭 대상이 drift 됐다.`,
    );
  }

  // (S2) searchQuery round-trip — argv[4] 가 commandArgs.searchQuery 와 byte-identical.
  // 단일 argv 원소 보존(인젝션 토큰 포함 escape/분리 0).
  if (argv[4] !== searchQuery) {
    throw new RangeError(
      `불변식(S2) 위반: argv[4](searchQuery 값)가 commandArgs.searchQuery 와 byte-identical 하지 않다 — 기대='${searchQuery}', 실측='${String(
        argv[4],
      )}'. searchQuery 가 다른 위치로 새거나 변형됐다.`,
    );
  }

  // (S3) --json flag + 필드 문자열 정합 — single-source 상수와 byte-identical.
  if (argv[5] !== "--json") {
    throw new RangeError(
      `불변식(S3) 위반: argv[5] 가 '--json' 이 아니다 — 기대='--json', 실측='${String(
        argv[5],
      )}'. search argv 의 json flag 위치가 drift 됐다.`,
    );
  }
  if (argv[6] !== REAL_DATA_RESULT_ISSUE_SEARCH_JSON_FIELDS) {
    throw new RangeError(
      `불변식(S3) 위반: argv[6](--json 필드)가 REAL_DATA_RESULT_ISSUE_SEARCH_JSON_FIELDS 와 byte-identical 하지 않다 — 기대='${REAL_DATA_RESULT_ISSUE_SEARCH_JSON_FIELDS}', 실측='${String(
        argv[6],
      )}'. --json 필드가 SearchHit 멤버 집합과 어긋났을 수 있다.`,
    );
  }

  // (S4) --limit flag + 값 정합 — single-source 상수와 byte-identical.
  if (argv[7] !== "--limit") {
    throw new RangeError(
      `불변식(S4) 위반: argv[7] 이 '--limit' 이 아니다 — 기대='--limit', 실측='${String(
        argv[7],
      )}'. search argv 의 limit flag 위치가 drift 됐다.`,
    );
  }
  if (argv[8] !== REAL_DATA_RESULT_ISSUE_SEARCH_LIMIT) {
    throw new RangeError(
      `불변식(S4) 위반: argv[8](--limit 값)이 REAL_DATA_RESULT_ISSUE_SEARCH_LIMIT 와 byte-identical 하지 않다 — 기대='${REAL_DATA_RESULT_ISSUE_SEARCH_LIMIT}', 실측='${String(
        argv[8],
      )}'. --limit 상수가 drift 됐다.`,
    );
  }
}
