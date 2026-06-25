// realdata-e2e-result-issue-search-argv-consistency.spec.ts — T-0655 colocated unit spec.
//
// 대상: `assertRealDataResultIssueSearchGhArgvPreservesCommandArgs(argv, commandArgs)` —
// 결과 이슈 search argv 가 명령-args 의 searchQuery 를 argv 위치(index 4)로 정합 round-trip
// 했고 고정 인자(`--match body` / `--json` 필드 / `--limit` 값 / 동사 prefix) shape 를
// 유지했는지 검증하는 순수 가드(search-argv-layer). 실 `buildRealDataResultIssueSearchGhArgv`
// (T-0586) 산출 argv 를 happy-path fixture 로 재사용해 빌더↔가드 paired round-trip 을 교차
// 검증한다.
//
// R-112 cover 구조:
//   - happy-path: 정상 commandArgs → buildRealDataResultIssueSearchGhArgv 산출 argv →
//     가드 void(throw 0). searchQuery 변형(marker 토큰·공백/특수문자 포함 토큰) 각 1+.
//   - error/negative 충분 cover: ① searchQuery 위치 값 불일치 ② 동사 prefix 불일치
//     ③ --match/body 위치 어긋남 ④ --json 필드 불일치 ⑤ --limit 값 불일치. 각 RangeError.
//   - 구조 결손 TypeError: argv null/비배열/원소 비-string, 길이 어긋남, commandArgs
//     null/searchQuery 비-string.
//   - flow/branch: 각 검증 분기(구조 · 빈/공백 거부 · 길이 · 동사 prefix · match/body ·
//     searchQuery round-trip · json 필드 · limit)마다 정상 통과 1 + 위반 throw 1 격리.
//   - negative cases: 결정성(2회) / 입력 비변형 / 인젝션 토큰 / 빈·공백 searchQuery /
//     고정 인자 single-source / 무관 commandArgs 멤버 무시 / 공백·대소문자 민감.
import type { RealDataResultIssueCommandArgs } from "./realdata-e2e-result-issue-command-args";
import {
  buildRealDataResultIssueSearchGhArgv,
  REAL_DATA_RESULT_ISSUE_SEARCH_JSON_FIELDS,
  REAL_DATA_RESULT_ISSUE_SEARCH_LIMIT,
} from "./realdata-e2e-result-issue-search-argv";
import { assertRealDataResultIssueSearchGhArgvPreservesCommandArgs } from "./realdata-e2e-result-issue-search-argv-consistency";

// commandArgs fixture 헬퍼 — searchQuery 변형을 모사. createArgs/updateArgs 는 본 가드가
// 보지 않으므로(가드는 searchQuery 만 본다) 결정론 자리표시만 둔다.
function makeCommandArgs(overrides: {
  searchQuery?: string;
}): RealDataResultIssueCommandArgs {
  return {
    searchQuery: overrides.searchQuery ?? "<!-- marker -->",
    createArgs: {
      title: "실 평가 e2e 결과 2026-06-25@abc1234",
      body: "<!-- marker -->\n\n## 요약\n- 평가 단위 수: 3",
      labels: ["realdata-e2e", "result"],
    },
    updateArgs: {
      title: "실 평가 e2e 결과 2026-06-25@abc1234",
      body: "<!-- marker -->\n\n## 요약\n- 평가 단위 수: 3",
    },
  };
}

describe("assertRealDataResultIssueSearchGhArgvPreservesCommandArgs", () => {
  // ── happy-path (빌더↔가드 paired round-trip) ─────────────────────────────
  it.each([
    ["marker 주석 토큰", "<!-- marker -->"],
    ["run 식별자 토큰", "realdata-e2e-result-2026-06-25-abc1234"],
    ["공백 포함 토큰", "결과 이슈 marker 2026"],
    ["특수문자 포함 토큰", 'marker "; rm -rf" 인젝션-유사'],
  ])(
    "정상 search argv(%s) → 빌더 산출 argv 에 대해 void 반환(throw 0)",
    (_label, searchQuery) => {
      const commandArgs = makeCommandArgs({ searchQuery });
      const argv = buildRealDataResultIssueSearchGhArgv(commandArgs);
      expect(() =>
        assertRealDataResultIssueSearchGhArgvPreservesCommandArgs(
          argv,
          commandArgs,
        ),
      ).not.toThrow();
    },
  );

  it("정상 argv 는 정확히 9 원소이고 searchQuery 가 index 4 에 단일 원소로 보존된다", () => {
    const commandArgs = makeCommandArgs({ searchQuery: 'marker; 특수 "인용"' });
    const argv = buildRealDataResultIssueSearchGhArgv(commandArgs);
    expect(argv).toHaveLength(9);
    expect(argv[4]).toBe(commandArgs.searchQuery);
    expect(() =>
      assertRealDataResultIssueSearchGhArgvPreservesCommandArgs(
        argv,
        commandArgs,
      ),
    ).not.toThrow();
  });

  // ── 구조/타입 결손(TypeError) ───────────────────────────────────────────
  it("argv 가 null 이면 TypeError", () => {
    expect(() =>
      assertRealDataResultIssueSearchGhArgvPreservesCommandArgs(
        null as unknown as string[],
        makeCommandArgs({}),
      ),
    ).toThrow(TypeError);
  });

  it("argv 가 undefined 이면 TypeError", () => {
    expect(() =>
      assertRealDataResultIssueSearchGhArgvPreservesCommandArgs(
        undefined as unknown as string[],
        makeCommandArgs({}),
      ),
    ).toThrow(TypeError);
  });

  it("argv 가 배열이 아니면 TypeError", () => {
    expect(() =>
      assertRealDataResultIssueSearchGhArgvPreservesCommandArgs(
        "search issues" as unknown as string[],
        makeCommandArgs({}),
      ),
    ).toThrow(TypeError);
  });

  it("argv 원소가 string 이 아니면 TypeError", () => {
    const commandArgs = makeCommandArgs({});
    const argv = buildRealDataResultIssueSearchGhArgv(commandArgs);
    const broken = [...argv];
    broken[4] = 42 as unknown as string;
    expect(() =>
      assertRealDataResultIssueSearchGhArgvPreservesCommandArgs(
        broken,
        commandArgs,
      ),
    ).toThrow(TypeError);
  });

  it("commandArgs 가 null 이면 TypeError", () => {
    const argv = buildRealDataResultIssueSearchGhArgv(makeCommandArgs({}));
    expect(() =>
      assertRealDataResultIssueSearchGhArgvPreservesCommandArgs(
        argv,
        null as unknown as RealDataResultIssueCommandArgs,
      ),
    ).toThrow(TypeError);
  });

  it("commandArgs.searchQuery 가 string 이 아니면 TypeError", () => {
    const commandArgs = makeCommandArgs({});
    const argv = buildRealDataResultIssueSearchGhArgv(commandArgs);
    const broken = {
      ...commandArgs,
      searchQuery: 99 as unknown as string,
    };
    expect(() =>
      assertRealDataResultIssueSearchGhArgvPreservesCommandArgs(argv, broken),
    ).toThrow(TypeError);
  });

  // ── 길이 정합(S5, RangeError) ────────────────────────────────────────────
  it("argv 길이가 9 미만이면(원소 누락) RangeError(S5)", () => {
    const commandArgs = makeCommandArgs({});
    const argv = buildRealDataResultIssueSearchGhArgv(commandArgs);
    const broken = argv.slice(0, argv.length - 1); // 마지막 원소 제거.
    expect(() =>
      assertRealDataResultIssueSearchGhArgvPreservesCommandArgs(
        broken,
        commandArgs,
      ),
    ).toThrow(/불변식\(S5\)/);
  });

  it("argv 길이가 9 초과면(잉여 원소) RangeError(S5)", () => {
    const commandArgs = makeCommandArgs({});
    const argv = buildRealDataResultIssueSearchGhArgv(commandArgs);
    const broken = [...argv, "--state", "open"];
    expect(() =>
      assertRealDataResultIssueSearchGhArgvPreservesCommandArgs(
        broken,
        commandArgs,
      ),
    ).toThrow(/불변식\(S5\)/);
  });

  // ── 값 정합 위반(RangeError) ────────────────────────────────────────────
  it("① searchQuery 위치 값이 commandArgs.searchQuery 와 불일치하면 RangeError(S2)", () => {
    const commandArgs = makeCommandArgs({});
    const argv = buildRealDataResultIssueSearchGhArgv(commandArgs);
    const broken = [...argv];
    broken[4] = "drift 토큰";
    expect(() =>
      assertRealDataResultIssueSearchGhArgvPreservesCommandArgs(
        broken,
        commandArgs,
      ),
    ).toThrow(RangeError);
    expect(() =>
      assertRealDataResultIssueSearchGhArgvPreservesCommandArgs(
        broken,
        commandArgs,
      ),
    ).toThrow(/불변식\(S2\)/);
  });

  it("② 동사 prefix 가 'search issues' 가 아니면 RangeError(S0)", () => {
    const commandArgs = makeCommandArgs({});
    const argv = buildRealDataResultIssueSearchGhArgv(commandArgs);
    const broken = [...argv];
    broken[0] = "issue";
    broken[1] = "list";
    expect(() =>
      assertRealDataResultIssueSearchGhArgvPreservesCommandArgs(
        broken,
        commandArgs,
      ),
    ).toThrow(/불변식\(S0\)/);
  });

  it("② 동사 prefix 의 두 번째 토큰만 어긋나도 RangeError(S0)", () => {
    const commandArgs = makeCommandArgs({});
    const argv = buildRealDataResultIssueSearchGhArgv(commandArgs);
    const broken = [...argv];
    broken[1] = "prs"; // 'issues' 가 아님.
    expect(() =>
      assertRealDataResultIssueSearchGhArgvPreservesCommandArgs(
        broken,
        commandArgs,
      ),
    ).toThrow(/불변식\(S0\)/);
  });

  it("③ --match flag 위치가 어긋나면 RangeError(S1)", () => {
    const commandArgs = makeCommandArgs({});
    const argv = buildRealDataResultIssueSearchGhArgv(commandArgs);
    const broken = [...argv];
    broken[2] = "--matches"; // 잘못된 flag.
    expect(() =>
      assertRealDataResultIssueSearchGhArgvPreservesCommandArgs(
        broken,
        commandArgs,
      ),
    ).toThrow(/불변식\(S1\)/);
  });

  it("③ --match 값이 'body' 가 아니면 RangeError(S1)", () => {
    const commandArgs = makeCommandArgs({});
    const argv = buildRealDataResultIssueSearchGhArgv(commandArgs);
    const broken = [...argv];
    broken[3] = "title"; // body 가 아님.
    expect(() =>
      assertRealDataResultIssueSearchGhArgvPreservesCommandArgs(
        broken,
        commandArgs,
      ),
    ).toThrow(/불변식\(S1\)/);
  });

  it("④ --json flag 위치가 어긋나면 RangeError(S3)", () => {
    const commandArgs = makeCommandArgs({});
    const argv = buildRealDataResultIssueSearchGhArgv(commandArgs);
    const broken = [...argv];
    broken[5] = "--jq"; // 잘못된 flag.
    expect(() =>
      assertRealDataResultIssueSearchGhArgvPreservesCommandArgs(
        broken,
        commandArgs,
      ),
    ).toThrow(/불변식\(S3\)/);
  });

  it("④ --json 필드 문자열이 SEARCH_JSON_FIELDS 와 불일치하면 RangeError(S3)", () => {
    const commandArgs = makeCommandArgs({});
    const argv = buildRealDataResultIssueSearchGhArgv(commandArgs);
    const broken = [...argv];
    broken[6] = "number,title"; // body 멤버 누락.
    expect(() =>
      assertRealDataResultIssueSearchGhArgvPreservesCommandArgs(
        broken,
        commandArgs,
      ),
    ).toThrow(/불변식\(S3\)/);
  });

  it("⑤ --limit flag 위치가 어긋나면 RangeError(S4)", () => {
    const commandArgs = makeCommandArgs({});
    const argv = buildRealDataResultIssueSearchGhArgv(commandArgs);
    const broken = [...argv];
    broken[7] = "--max"; // 잘못된 flag.
    expect(() =>
      assertRealDataResultIssueSearchGhArgvPreservesCommandArgs(
        broken,
        commandArgs,
      ),
    ).toThrow(/불변식\(S4\)/);
  });

  it("⑤ --limit 값이 SEARCH_LIMIT 와 불일치하면 RangeError(S4)", () => {
    const commandArgs = makeCommandArgs({});
    const argv = buildRealDataResultIssueSearchGhArgv(commandArgs);
    const broken = [...argv];
    broken[8] = "10"; // 30 이 아님.
    expect(() =>
      assertRealDataResultIssueSearchGhArgvPreservesCommandArgs(
        broken,
        commandArgs,
      ),
    ).toThrow(/불변식\(S4\)/);
  });

  // ── 빈/공백 searchQuery 거부(RangeError) ────────────────────────────────
  it("commandArgs.searchQuery 가 빈 문자열이면 RangeError(T-0586 동형 거부)", () => {
    const commandArgs = makeCommandArgs({ searchQuery: "ignored" });
    const argv = buildRealDataResultIssueSearchGhArgv(commandArgs);
    const blank = { ...commandArgs, searchQuery: "" };
    expect(() =>
      assertRealDataResultIssueSearchGhArgvPreservesCommandArgs(argv, blank),
    ).toThrow(RangeError);
    expect(() =>
      assertRealDataResultIssueSearchGhArgvPreservesCommandArgs(argv, blank),
    ).toThrow(/searchQuery 가 비어있다/);
  });

  it("commandArgs.searchQuery 가 공백-only 이면 RangeError(T-0586 동형 거부)", () => {
    const commandArgs = makeCommandArgs({ searchQuery: "ignored" });
    const argv = buildRealDataResultIssueSearchGhArgv(commandArgs);
    const blank = { ...commandArgs, searchQuery: "   \t  " };
    expect(() =>
      assertRealDataResultIssueSearchGhArgvPreservesCommandArgs(argv, blank),
    ).toThrow(RangeError);
  });

  // ── negative cases 충분 cover ───────────────────────────────────────────
  it("결정성 — 동일 정상 입력 2 회 호출 둘 다 void", () => {
    const commandArgs = makeCommandArgs({});
    const argv = buildRealDataResultIssueSearchGhArgv(commandArgs);
    expect(() =>
      assertRealDataResultIssueSearchGhArgvPreservesCommandArgs(
        argv,
        commandArgs,
      ),
    ).not.toThrow();
    expect(() =>
      assertRealDataResultIssueSearchGhArgvPreservesCommandArgs(
        argv,
        commandArgs,
      ),
    ).not.toThrow();
  });

  it("결정성 — 동일 위반 입력 2 회 호출 둘 다 동일 RangeError", () => {
    const commandArgs = makeCommandArgs({});
    const argv = buildRealDataResultIssueSearchGhArgv(commandArgs);
    const broken = [...argv];
    broken[4] = "drift";
    expect(() =>
      assertRealDataResultIssueSearchGhArgvPreservesCommandArgs(
        broken,
        commandArgs,
      ),
    ).toThrow(/불변식\(S2\)/);
    expect(() =>
      assertRealDataResultIssueSearchGhArgvPreservesCommandArgs(
        broken,
        commandArgs,
      ),
    ).toThrow(/불변식\(S2\)/);
  });

  it("입력 비변형 — 호출 후 argv/commandArgs 객체 불변", () => {
    const commandArgs = makeCommandArgs({});
    const argv = buildRealDataResultIssueSearchGhArgv(commandArgs);
    const argvBefore = JSON.stringify(argv);
    const commandArgsBefore = JSON.stringify(commandArgs);

    assertRealDataResultIssueSearchGhArgvPreservesCommandArgs(
      argv,
      commandArgs,
    );

    expect(JSON.stringify(argv)).toBe(argvBefore);
    expect(JSON.stringify(commandArgs)).toBe(commandArgsBefore);
  });

  it("인젝션 토큰 — searchQuery 가 특수문자 포함 시에도 단일 argv 원소로 round-trip", () => {
    const searchQuery = '"; rm -rf / && echo pwn"';
    const commandArgs = makeCommandArgs({ searchQuery });
    const argv = buildRealDataResultIssueSearchGhArgv(commandArgs);
    // 가드가 escape/분리 없이 단일 원소로 그대로 비교.
    expect(argv[4]).toBe(searchQuery);
    expect(() =>
      assertRealDataResultIssueSearchGhArgvPreservesCommandArgs(
        argv,
        commandArgs,
      ),
    ).not.toThrow();
  });

  it("고정 인자 single-source — 가드가 비교에 쓰는 --json/--limit 값이 T-0586 named constant 와 동일", () => {
    const commandArgs = makeCommandArgs({});
    const argv = buildRealDataResultIssueSearchGhArgv(commandArgs);
    // 빌더가 산출한 argv 의 고정 인자가 named constant 와 동일 참조(상수 변경 시 가드도 따라감).
    expect(argv[6]).toBe(REAL_DATA_RESULT_ISSUE_SEARCH_JSON_FIELDS);
    expect(argv[8]).toBe(REAL_DATA_RESULT_ISSUE_SEARCH_LIMIT);
    expect(() =>
      assertRealDataResultIssueSearchGhArgvPreservesCommandArgs(
        argv,
        commandArgs,
      ),
    ).not.toThrow();
  });

  it("무관 commandArgs 멤버 무시 — createArgs/updateArgs 변형은 search argv 정합에 영향 0", () => {
    const commandArgs = makeCommandArgs({});
    const argv = buildRealDataResultIssueSearchGhArgv(commandArgs);
    const mutated = {
      ...commandArgs,
      createArgs: { title: "전혀 다른 제목", body: "다른 본문", labels: ["x"] },
      updateArgs: { title: "또 다른 제목", body: "또 다른 본문" },
    };
    // searchQuery 는 동일하므로 가드는 여전히 void(가드는 searchQuery 만 본다).
    expect(() =>
      assertRealDataResultIssueSearchGhArgvPreservesCommandArgs(argv, mutated),
    ).not.toThrow();
  });

  it("공백 민감 — searchQuery 에 후행 공백이 끼면 byte-identical 불일치로 RangeError(S2)", () => {
    const commandArgs = makeCommandArgs({});
    const argv = buildRealDataResultIssueSearchGhArgv(commandArgs);
    const broken = [...argv];
    broken[4] = `${commandArgs.searchQuery} `; // 후행 공백.
    expect(() =>
      assertRealDataResultIssueSearchGhArgvPreservesCommandArgs(
        broken,
        commandArgs,
      ),
    ).toThrow(/불변식\(S2\)/);
  });

  it("대소문자 민감 — searchQuery 대소문자만 달라도 byte-identical 불일치로 RangeError(S2)", () => {
    const commandArgs = makeCommandArgs({ searchQuery: "Marker-2026" });
    const argv = buildRealDataResultIssueSearchGhArgv(commandArgs);
    const broken = [...argv];
    broken[4] = "marker-2026"; // 소문자.
    expect(() =>
      assertRealDataResultIssueSearchGhArgvPreservesCommandArgs(
        broken,
        commandArgs,
      ),
    ).toThrow(/불변식\(S2\)/);
  });

  it("R-59 — 가드는 argv 의 searchQuery string 만 비교, raw narrative 미접촉", () => {
    const commandArgs = makeCommandArgs({});
    const argv = buildRealDataResultIssueSearchGhArgv(commandArgs);
    expect(() =>
      assertRealDataResultIssueSearchGhArgvPreservesCommandArgs(
        argv,
        commandArgs,
      ),
    ).not.toThrow();
    // argv 에 raw narrative 류 토큰이 끼어들지 않음(가드가 그런 키를 합성하지 않음).
    expect(argv).not.toContain("narrative");
    expect(argv).not.toContain("rawActivity");
  });
});
