// realdata-e2e-result-issue-search-parse.ts — 실 평가 e2e 결과 이슈
// `gh search issues --json number,title,body` stdout(JSON 문자열) →
// `RealDataResultIssueSearchHit[]` 순수 파서·검증기 (T-0587 박제).
//
// 책임:
//   - build-time chain 의 누락된 중간 link 를 채운다. 양 끝은 이미 박제됨:
//     (a) T-0586 `buildRealDataResultIssueSearchGhArgv` 가 `gh search issues
//         --json number,title,body` 의 argv 를 합성하고,
//     (b) T-0584 `resolveRealDataResultIssueAction` 이 `searchHits[]` 를 입력받아
//         create/update 분기를 결정한다.
//     그러나 그 사이 — `execFile('gh', argv)` 의 **stdout(JSON 문자열) 을
//     `RealDataResultIssueSearchHit[]` 로 파싱·검증하는 단계** — 가 빠져있었다.
//     T-0586 helper 의 Out of Scope 가 "`JSON.parse(stdout)` /
//     `RealDataResultIssueSearchHit[]` 산출(caller 책임)" 으로 deferred 해 둔 부분이다.
//   - caller(live wiring)는 (1) T-0586 argv 로 search 명령을 만들고, (2)
//     `execFile('gh', argv)` 로 stdout 을 얻고, (3) **본 파서로 stdout →
//     `RealDataResultIssueSearchHit[]` 를 산출**하고, (4) T-0584 resolver 로 action 을
//     결정하고, (5) T-0585 빌더 + `execFile` 로 실 박제한다. 본 helper 는 (3) 의
//     순수 파싱·검증만 박제 — 실 gh search 실행(2)·issue 실행(5)은 deferred(credential gate).
//
// 🔥 엄격 검증 (조용한 통과 금지):
//   - `JSON.parse` 결과가 배열이 아니면 throw. 각 원소가 객체가 아니거나(null/숫자/문자열),
//     `number` 가 양의 정수가 아니거나, `title`/`body` 가 문자열이 아니면 명시적 throw.
//     비정상 gh 응답이 조용히 통과해 잘못된 분기(T-0584 resolver)로 새는 것을 차단한다.
//   - number 규약은 T-0584 `assertPositiveNumber`(양의 정수)와 동형 — resolver 가 곧이어
//     검증하는 규약과 정합하도록 파싱 단계에서 선검증한다.
//
// 🔥 최소 shape 추출 (gh 미래 필드 격리):
//   - gh 응답에 `--json` 요청(number,title,body) 외 추가 필드가 섞여도 `{number, title,
//     body}` 만 추출해 새 객체로 정규화한다(resolver 가 받는 shape 최소화 — R-59 정합:
//     입력 외 데이터 생성 0, raw narrative 추가·저장 0).
//
// 🔥 결정론·무공유:
//   - 입력 외 상태(시각·난수·env) 의존 0. 동일 stdout 두 번 호출 → deep-equal 결과.
//     매 호출 새 배열·새 객체를 반환 — 출력 객체 공유 0(입력 문자열은 불변이라 mutate 불가).
//
// 🔥 build-time 완결 — dependency-free (cloud cron 자율 실행 가능):
//   - 실 네트워크 호출 0, env 읽기 0, DB 접근 0, live-LLM 0, credential 0, gh 실행 0.
//     외부 라이브러리(zod/execa 등) 0 — 내장 `JSON.parse` + 수동 검증만. 순수 함수.
//
// 🔥 type 재사용 (중복 정의 0):
//   - `RealDataResultIssueSearchHit` 는 `./realdata-e2e-result-issue-action`(T-0584)에서
//     `import type` 재사용한다. 신규 type 정의 없음 — stdout 입력만 받아
//     `RealDataResultIssueSearchHit[]` 만 산출.
//
// Out of Scope (task T-0587):
//   - 실 gh 호출 / `execFile('gh', argv)` / `gh search issues` 실 실행(step ④ live
//     wiring — credential gate). 본 파서는 stdout → SearchHit[] 만 산출(부수효과 0).
//   - search argv 합성(T-0586 위임 — 본 파서는 stdout 파싱 단일 책임).
//   - action 분기 결정(T-0584 `resolveRealDataResultIssueAction` 위임 — 본 파서는
//     SearchHit[] 산출까지만).
//   - `RealDataResultIssueSearchHit` type 신규 정의(T-0584 import 재사용 — 중복 금지).
//   - create/edit argv·issue create/edit 실행(T-0585 + deferred).
//   - 외부 라이브러리(zod 등) 도입 — 새 dependency 0, 내장 `JSON.parse` + 수동 검증만.
//   - production `src/` 코드 변경 — test helper 단독(타입 import 재사용만).
import type { RealDataResultIssueSearchHit } from "./realdata-e2e-result-issue-action";
// search-hit↔parse-shape set-equality 가드(T-0659 신설)를 producer 산출 경로에 self-wire
// 한다(T-0660). 정규화한 `{number, title, body}` hit 을 반환하기 직전에 self-assert 호출 —
// 파서가 선언 parse-shape 와 어긋난 키 집합의 hit 을 산출하면 손상 hit 을 caller 에 반환하기
// 전에 fail-fast throw(구조 결손=TypeError / set 불일치=RangeError). 가드 본문·상수는 변경 0
// (T-0657/T-0659 산출물 그대로 import 재사용). `REAL_DATA_RESULT_ISSUE_SEARCH_PARSE_SHAPE_KEYS`
// 는 가드 모듈이 single-source(json-fields)에서 re-export 한 것을 그대로 사용한다.
import {
  assertRealDataResultIssueSearchHitMatchesParseShape,
  REAL_DATA_RESULT_ISSUE_SEARCH_PARSE_SHAPE_KEYS,
} from "./realdata-e2e-result-issue-search-hit-shape";
// 산출 hits 전체가 raw stdout 으로부터 올바른 개수·순서·필드값으로 재유도됐는지 검증하는
// 값-정합 가드(T-0721 신설)를 컴포저 산출 경로에 self-wire 한다(T-0722). 단일 return 사이트
// 직전에 산출 hits + 원본 stdout 을 넘겨 self-assert — set-equality 가드(키 집합만 봄)가
// 놓치는 number/title/body 값 drift·hit 누락/중복/재정렬을 build-time fail-fast 로 닫는다.
// 가드가 `RealDataResultIssueSearchHit` 를 type-only import 로만 가져와 컴포저 value 를
// import 하지 않으므로(value import 0), 컴포저가 본 가드를 top-level value import 해도 순환
// 의존이 생기지 않는다(T-0720/T-0718 type-only top-level import mirror — lazy require 불요).
import { assertRealDataResultIssueSearchOutputConsistentWithStdout } from "./realdata-e2e-result-issue-search-parse-consistency";

// 원소 number guard — gh 응답이 정상이면 number 는 항상 양의 정수다. 0 이하/비정수면
// 파싱 사고로 간주하고 명시적 throw(비정상 number 가 SearchHit 으로 새는 것을 차단).
// T-0584 `assertPositiveNumber` 규약과 동형.
function assertHitNumber(
  value: unknown,
  index: number,
): asserts value is number {
  if (typeof value !== "number" || !Number.isInteger(value) || value <= 0) {
    throw new Error(
      `gh search 응답 원소[${index}].number 가 양의 정수가 아닙니다(${String(value)}) — gh 응답 파싱 사고 방지를 위해 0 이하/비정수/비숫자 number 는 허용되지 않습니다.`,
    );
  }
}

// 문자열 필드 guard — title/body 는 항상 문자열이어야 한다. 누락(undefined)·null·숫자 등
// 비문자열이면 명시적 throw(조용한 통과 차단).
function assertHitString(
  value: unknown,
  field: "title" | "body",
  index: number,
): asserts value is string {
  if (typeof value !== "string") {
    throw new Error(
      `gh search 응답 원소[${index}].${field} 가 문자열이 아닙니다(${String(value)}) — gh 응답 파싱 사고 방지를 위해 비문자열 ${field} 는 허용되지 않습니다.`,
    );
  }
}

// parseRealDataResultIssueSearchOutput — `gh search issues --json number,title,body`
// 의 stdout(JSON 문자열)을 입력받아 `RealDataResultIssueSearchHit[]` 로 파싱·검증하는
// **순수 함수**.
//
// 동작:
//   - `JSON.parse(stdout)` 결과가 배열이 아니면 throw(비배열 object/string/null 등).
//   - 각 원소가 객체(non-null)가 아니면 throw(null / 숫자 / 문자열 등).
//   - 각 원소의 number 양의 정수 검증, title/body 문자열 검증(누락/비타입 throw).
//   - 검증 통과 원소를 `{number, title, body}` 만 담은 **새 객체**로 정규화(추가 필드 drop).
//   - `"[]"` → `[]`(정상 — 후보 0건).
//
// 순수성·무공유:
//   - 입력 stdout(문자열)은 불변이라 mutate 불가. 매 호출이 새 배열·새 객체를 반환 —
//     출력이 입력 / 다음 호출 결과와 무공유. 입력 외 상태 의존 0(결정론).
export function parseRealDataResultIssueSearchOutput(
  stdout: string,
): RealDataResultIssueSearchHit[] {
  // JSON.parse — 잘못된 JSON 이면 SyntaxError 가 그대로 전파된다(명시적 throw 경로).
  const parsed: unknown = JSON.parse(stdout);

  // 배열 guard — gh `--json` 출력은 배열이어야 한다. object / string / number / null 차단.
  if (!Array.isArray(parsed)) {
    throw new Error(
      `gh search 응답이 배열이 아닙니다(${typeof parsed}) — \`gh search issues --json\` 은 배열을 산출해야 하므로 비배열 응답은 허용되지 않습니다.`,
    );
  }

  // 각 원소 검증·정규화 — 매 원소마다 새 객체를 만들어 새 배열에 push(무공유).
  const hits = parsed.map((element: unknown, index: number) => {
    // 원소 객체 guard — null / 숫자 / 문자열 등 비객체 차단(typeof null === "object" 라
    // null 을 별도 배제).
    if (typeof element !== "object" || element === null) {
      throw new Error(
        `gh search 응답 원소[${index}] 가 객체가 아닙니다(${String(element)}) — 각 hit 은 {number, title, body} 객체여야 합니다.`,
      );
    }

    const record = element as Record<string, unknown>;

    // number / title / body 검증(누락·타입 불일치 시 throw).
    assertHitNumber(record.number, index);
    assertHitString(record.title, "title", index);
    assertHitString(record.body, "body", index);

    // 정규화 — `{number, title, body}` 만 추출(추가 필드 drop). 새 객체(무공유).
    const hit: RealDataResultIssueSearchHit = {
      number: record.number,
      title: record.title,
      body: record.body,
    };

    // self-wire(T-0660) — 정규화한 hit 의 키 집합이 선언 parse-shape 와 set-equal 인지
    // 반환 직전 검증한다. 정상 파서 경로는 항상 `{number, title, body}` 만 산출하므로
    // throw 0(검증만, 출력 비변형). 회귀로 키 집합이 어긋나면 손상 hit 반환 전 fail-fast.
    assertRealDataResultIssueSearchHitMatchesParseShape(
      hit,
      REAL_DATA_RESULT_ISSUE_SEARCH_PARSE_SHAPE_KEYS,
    );

    return hit;
  });

  // self-wire(T-0722) — 산출 hits 배열 전체가 raw stdout 으로부터 올바른 개수·순서·필드값
  // 으로 재유도됐는지 반환 직전 검증한다. stdout 은 파라미터로, hits 는 위 map 산출로 둘 다
  // 가용하므로 한 호출 안에서 배선된다(per-hit set-equality 가드와 공존 — 그 가드는 각 hit
  // 의 키 집합만, 본 가드는 전체 값·순서·개수를 본다). 정상 파서 경로는 stdout 과 정합하는
  // hits 를 산출하므로 throw 0(검증만, 산출 byte-identical 무변형). 값 drift·hit 누락/중복/
  // 재정렬 회귀 시 손상 산출이 caller resolver(T-0584)로 새기 전 fail-fast(값 정합 위반
  // RangeError / 구조 결손 TypeError).
  assertRealDataResultIssueSearchOutputConsistentWithStdout(hits, stdout);

  return hits;
}
