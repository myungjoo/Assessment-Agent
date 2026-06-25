// realdata-e2e-result-issue-search-argv.ts — 실 평가 e2e 결과 이슈 searchQuery →
// gh search issues 인자-벡터(argv) 순수 빌더 (T-0586 박제).
//
// 책임:
//   - T-0583 의 `buildRealDataResultIssueCommandArgs` 가 결과 이슈 descriptor 를
//     멱등 search-or-update 명령-args 묶음({searchQuery, createArgs, updateArgs})으로
//     산출했다. T-0584 의 `resolveRealDataResultIssueAction` 은 그 `searchHits` 를
//     입력받아 create/update 분기를 결정한다. 그러나 그 searchHits 를 만들어내는
//     **`gh search issues --json number,title,body` 호출의 argv 자체** 는 어디에도
//     합성돼 있지 않다. 본 helper 가 그 누락된 first-step build-time layer 다.
//   - T-0585 가 create/edit 의 argv 를 박제했다면, 본 helper 는 search 의 argv 를
//     박제해 build-time chain 의 양 끝(search ↔ create/edit)을 모두 닫는다.
//   - caller(live wiring)는 (1) command-args 로부터 본 빌더로 search argv 를 얻고,
//     (2) `execFile('gh', searchArgv)` → JSON parse → searchHits[] 를 얻고, (3) T-0584
//     resolver 로 action 을 결정하고, (4) T-0585 빌더로 create/edit argv 를 얻고,
//     (5) `execFile('gh', issueArgv)` 로 실 박제한다. 본 helper 는 (1) 의 search argv
//     합성만 순수 함수로 박제 — 실 gh search 실행은 여전히 deferred(본 helper 는
//     search argv 합성만; credential gate).
//
// 🔥 인자 분리 정합 (shell 미경유 · 인젝션 방지):
//   - 반환 argv 는 `gh` 실행 파일명을 **포함하지 않는다**(caller 가 `execFile('gh', argv)`
//     형태로 실행 파일과 인자를 분리 전달). searchQuery 값에 공백·특수문자(예: `"; rm
//     -rf"`)가 들어가도 **단일 argv 원소**로 유지된다 — shell 문자열 합성·따옴표 escape 가
//     불필요하고 인젝션이 불가하다.
//
// 🔥 raw 미저장 정합 (R-59 / REQ-032, data-model.md §4):
//   - 본 빌더는 commandArgs.searchQuery 를 그대로 argv 로 옮길 뿐 raw 활동 본문·
//     narrative 본문을 추가하지 않는다(애초에 입력에 부재 — searchQuery 는
//     descriptor.marker = 안정 토큰만). step ④ 박제 chain 의 first-step(search) layer.
//     실 gh search 실행은 deferred(본 helper 는 search argv 합성만).
//
// 🔥 결정론적 출력 (동일 입력 → byte-identical):
//   - 입력 외 상태(시각·난수·env) 의존 0. argv 원소·순서 전부 입력만의 함수. 동일
//     commandArgs 두 번 호출 → 원소·순서까지 동일한 argv(단, 무공유 — 새 배열).
//
// 🔥 build-time 완결 — dependency-free (cloud cron 자율 실행 가능):
//   - 실 네트워크 호출 0, env 읽기 0, DB 접근 0, live-LLM 0, credential 0, gh 실행 0.
//     외부 CLI 라이브러리(execa 등) 0 — 내장 배열 연산만. 순수 함수.
//
// 🔥 무공유 보장 (입력 mutate 0):
//   - 본 빌더는 입력 `commandArgs`(중첩 createArgs/updateArgs 포함)를 변형하지 않는다
//     (읽기만 — searchQuery 단일 의존, createArgs/updateArgs 는 읽지도 않는다). 호출마다
//     새 argv 배열을 반환 — 반환 argv mutate 가 입력에 누설되지 않는다.
//
// 🔥 --json 필드 정합 (T-0584 cross-reference):
//   - `--json` 인자는 `"number,title,body"` 고정 — 이 세 필드가 T-0584
//     `RealDataResultIssueSearchHit`({number, title, body})의 모든 멤버와 정확히 일치
//     하도록 요청한다(분리 책임 — type import 는 cross-check 만, 실행 의존 아님).
//
// 🔥 type 재사용 (중복 정의 0):
//   - `RealDataResultIssueCommandArgs` 는 `./realdata-e2e-result-issue-command-args`
//     (T-0583)에서 `import type` 재사용한다. 신규 type 정의 없음 — commandArgs 입력만
//     받아 `string[]` 만 산출.
//
// Out of Scope (task T-0586):
//   - 실 gh 호출 / `execFile('gh', argv)` / `gh search issues` 실 실행(step ④ live
//     wiring — credential gate). 본 빌더는 search argv 합성만 산출(부수효과 0).
//   - gh search response 의 실 JSON 파싱 / `JSON.parse(stdout)` /
//     `RealDataResultIssueSearchHit[]` 산출(caller 책임 — 본 빌더는 input argv 만).
//   - `--repo owner/repo` 인자 / repo slug 결정 / `--owner` 인자 / gh auth — 실 wiring 의
//     환경 책임(본 빌더는 search 의 핵심 인자만; repo 컨텍스트는 caller 의 cwd/env 또는
//     별도 wiring slice).
//   - create/edit argv 합성(T-0585 위임만 — 본 빌더는 search argv 단일 책임).
//   - 명령-args 합성 자체(T-0583 위임만 — searchQuery/createArgs/updateArgs 재합성 금지).
//   - action resolver 분기 결정(T-0584 위임만 — 본 빌더는 search 의 argv 만; searchHits
//     해석은 그 단계).
//   - shell 문자열 합성 / 따옴표 escape / `gh search issues --json` 출력 파싱 — 본 빌더는
//     분리된 argv 배열만 산출(shell 미경유, escape 불요).
//   - 외부 CLI 라이브러리(execa 등) 도입 — 새 dependency 0, 내장 배열 연산만.
//   - production `src/` 코드 변경 — test helper 단독(타입 import 재사용만).
import type { RealDataResultIssueCommandArgs } from "./realdata-e2e-result-issue-command-args";
import { assertRealDataResultIssueSearchGhArgvPreservesCommandArgs } from "./realdata-e2e-result-issue-search-argv-consistency";
import {
  assertRealDataResultIssueSearchJsonFieldsMatchParseShape,
  REAL_DATA_RESULT_ISSUE_SEARCH_PARSE_SHAPE_KEYS,
} from "./realdata-e2e-result-issue-search-json-fields";

// --json 요청 필드 — T-0584 `RealDataResultIssueSearchHit`({number, title, body})의
// 모든 멤버와 정확히 일치(콤마 구분, 공백 0). 매직 스트링 대신 named constant 로 박제.
export const REAL_DATA_RESULT_ISSUE_SEARCH_JSON_FIELDS = "number,title,body";

// --limit 결정론 상수 — 결과 이슈는 동일 marker 당 1건만 박제될 예정이나, 우연적 다중
// 매칭(gh search 의 느슨한 매칭) 대비 충분한 상한을 둔다. T-0584 resolver 가 후보 2+ 건도
// 최소 번호로 멱등 수렴하므로 상한은 안전 여유분. 매직 넘버 대신 named constant 로 박제.
export const REAL_DATA_RESULT_ISSUE_SEARCH_LIMIT = "30";

// 빈/공백-only searchQuery guard — searchQuery 가 빈 문자열·공백-only 면 `--match body`
// 검색이 전체(또는 무의미) 매칭으로 번져 잘못된 분기를 유발하므로 명시적 throw 한다
// (조용한 통과 차단 — T-0584 marker guard 와 동형 정합).
function assertSearchQueryNonBlank(searchQuery: string): void {
  if (searchQuery.trim().length === 0) {
    throw new Error(
      "commandArgs.searchQuery 가 비어있습니다 — 빈/공백-only searchQuery 는 전체 매칭 사고를 유발하므로 허용되지 않습니다.",
    );
  }
}

// buildRealDataResultIssueSearchGhArgv — 명령-args 의 searchQuery 를 입력받아 실
// `gh search issues` 명령에 그대로 넘길 인자-벡터(argv, `gh` 실행 파일명 제외)를 산출하는
// **순수 함수**.
//
// 산출 argv:
//   ["search", "issues", "--match", "body", searchQuery, "--json",
//    "number,title,body", "--limit", "30"]
//   - `--match body` 고정 — marker 는 issue body 안에 박혀있으므로 body 매칭(T-0583
//     본문 line 124~126 정합).
//   - searchQuery 는 단일 argv 원소(shell 미경유로 인젝션 불가).
//   - guard: searchQuery 빈/공백 → throw.
//
// 순수성·무공유:
//   - 입력 `commandArgs`(중첩 createArgs/updateArgs 포함)를 읽기만 한다(mutate 0 —
//     searchQuery 단일 의존, createArgs/updateArgs 는 읽지 않는다). 매 호출이 새 argv
//     배열을 반환 — 반환 argv mutate 가 입력에 누설되지 않는다.
export function buildRealDataResultIssueSearchGhArgv(
  commandArgs: RealDataResultIssueCommandArgs,
): string[] {
  const { searchQuery } = commandArgs;
  // searchQuery guard — 빈/공백 전체 매칭 사고 차단.
  assertSearchQueryNonBlank(searchQuery);

  // search argv 합성 — searchQuery 는 단일 원소로 유지(escape 불요, 인젝션 불가).
  const searchArgv = [
    "search",
    "issues",
    "--match",
    "body",
    searchQuery,
    "--json",
    REAL_DATA_RESULT_ISSUE_SEARCH_JSON_FIELDS,
    "--limit",
    REAL_DATA_RESULT_ISSUE_SEARCH_LIMIT,
  ];

  // self-wire — 합성한 search argv 가 명령-args 의 searchQuery 를 동사 prefix·`--match body`·
  // searchQuery 위치·`--json` 필드·`--limit` 값으로 정합 round-trip 했는지 반환 직전
  // self-assert(T-0655 신설 가드의 builder self-wire, T-0654 create/edit argv self-wire 의
  // search-side mirror). search 빌더는 단일 반환 지점(create/update 분기 없음)이라 self-assert
  // 호출도 1지점. 정상 합성이면 가드는 void 반환하므로 동작·반환값 byte-identical 보존. 미래
  // 회귀(searchQuery↔다른 위치 drift·`--match body` 변형·`--json` 필드 누락·`--limit` 값 drift)가
  // 생기면 손상 argv 를 caller(live wiring, execFile('gh', searchArgv))로 반환하기 전에 한국어
  // 명세형 에러로 즉시 throw 한다(fail-fast). 같은 디렉토리 함수 호출이라 runtime cycle 0.
  assertRealDataResultIssueSearchGhArgvPreservesCommandArgs(
    searchArgv,
    commandArgs,
  );

  // self-wire — 합성한 search argv 의 `--json` 요청 필드 집합
  // (REAL_DATA_RESULT_ISSUE_SEARCH_JSON_FIELDS = "number,title,body")이 search-parse 의
  // 추출 shape 키 집합(REAL_DATA_RESULT_ISSUE_SEARCH_PARSE_SHAPE_KEYS = ["number","title",
  // "body"])과 set-equal 정합하는지 반환 직전 self-assert(T-0657 신설 가드의 builder
  // self-wire, T-0656 round-trip 가드 self-wire 의 json-fields-side sibling). 두 production
  // 상수가 현재 정합이라 정상 합성이면 가드는 void 반환 — 동작·반환값 byte-identical 보존.
  // 미래 회귀(`--json` 필드 누락·요청 적 없는 잉여 필드 추가 등 latent coupling drift)가
  // 생기면 손상 argv 를 caller(live wiring, execFile('gh', searchArgv))로 반환하기 전에
  // 한국어 명세형 에러로 즉시 throw 한다(fail-fast). 같은 디렉토리 함수 호출이라 runtime
  // cycle 0. search 빌더는 단일 반환 지점(create/update 분기 없음)이라 self-assert 도 1지점.
  assertRealDataResultIssueSearchJsonFieldsMatchParseShape(
    REAL_DATA_RESULT_ISSUE_SEARCH_JSON_FIELDS,
    REAL_DATA_RESULT_ISSUE_SEARCH_PARSE_SHAPE_KEYS,
  );

  return searchArgv;
}
