// realdata-e2e-daily-step-dual-leg-run-report-issue-search-argv-consistency.spec.ts —
// T-0998 colocated unit spec.
//
// 대상: `assertRealDataDailyStepDualLegRunReportIssueSearchGhArgvPreservesCommandArgs(argv,
// commandArgs)` — daily-step dual-leg run report 이슈 search argv 가 명령-args 의 searchQuery 를
// argv 위치(index 4)로 정합 round-trip 했고 고정 인자(`--match body` / `--json` 필드 / `--limit`
// 값 / 동사 prefix) shape 를 유지했는지 검증하는 순수 가드(search-argv-layer). 실
// `buildRealDataDailyStepDualLegRunReportIssueSearchGhArgv`(T-0900) 산출 argv 를 happy-path
// fixture 로 재사용해 빌더↔가드 paired round-trip 을 교차 검증한다.
//
// R-112 cover 구조:
//   - happy-path: 정상 commandArgs → buildRealDataDailyStepDualLegRunReportIssueSearchGhArgv
//     산출 argv → 가드 void(throw 0). searchQuery 변형(marker 토큰·공백/특수문자 포함
//     인젝션-유사 토큰·유니코드) 각 1+.
//   - error/negative 충분 cover: (a) 동사 prefix drift (b) --match/body 위치 drift
//     (c) searchQuery 위치 값 drift (d) --json flag/필드 drift (e) --limit flag/값 drift
//     (f) argv 길이 잉여/누락. 각 RangeError.
//   - 구조 결손 TypeError: argv null/undefined/비배열/원소 비-string, commandArgs
//     null/searchQuery 비-string.
//   - flow/branch: 각 검증 분기(구조 · 빈/공백 거부 · 길이 · 동사 prefix · match/body ·
//     searchQuery round-trip · json 필드 · limit)마다 정상 통과 1 + 위반 throw 1 격리.
//   - negative cases: 결정성(2회) / 입력 비변형 / 인젝션 토큰 / 빈·공백 searchQuery /
//     고정 인자 single-source / 무관 commandArgs 멤버 무시 / 공백·대소문자 민감 / R-59 raw 미접촉.
import type { RealDataDailyStepDualLegRunReportIssueCommandArgs } from "./realdata-e2e-daily-step-dual-leg-run-report-issue-command-args";
import {
  buildRealDataDailyStepDualLegRunReportIssueSearchGhArgv,
  REAL_DATA_DAILY_STEP_DUAL_LEG_RUN_REPORT_ISSUE_SEARCH_JSON_FIELDS,
  REAL_DATA_DAILY_STEP_DUAL_LEG_RUN_REPORT_ISSUE_SEARCH_LIMIT,
} from "./realdata-e2e-daily-step-dual-leg-run-report-issue-search-argv";
import { assertRealDataDailyStepDualLegRunReportIssueSearchGhArgvPreservesCommandArgs } from "./realdata-e2e-daily-step-dual-leg-run-report-issue-search-argv-consistency";

// commandArgs fixture 헬퍼 — searchQuery 변형을 모사. createArgs/updateArgs 는 본 가드가
// 보지 않으므로(가드는 searchQuery 만 본다) 결정론 자리표시만 둔다. 모든 값은 비시크릿
// 더미 string — 실 secret/PAT/credential 미노출(§9).
function makeCommandArgs(overrides: {
  searchQuery?: string;
}): RealDataDailyStepDualLegRunReportIssueCommandArgs {
  return {
    searchQuery: overrides.searchQuery ?? "<!-- daily-step-marker -->",
    createArgs: {
      title: "실 평가 e2e daily-step dual-leg run report 2026-07-15@abc1234",
      body: "<!-- daily-step-marker -->\n\n## 요약\n- 평가 단위 수: 3",
      labels: ["realdata-e2e", "daily-step", "run-report"],
    },
    updateArgs: {
      title: "실 평가 e2e daily-step dual-leg run report 2026-07-15@abc1234",
      body: "<!-- daily-step-marker -->\n\n## 요약\n- 평가 단위 수: 3",
    },
  };
}

describe("assertRealDataDailyStepDualLegRunReportIssueSearchGhArgvPreservesCommandArgs", () => {
  // ── happy-path (빌더↔가드 paired round-trip) ─────────────────────────────
  it.each([
    ["marker 주석 토큰", "<!-- daily-step-marker -->"],
    ["run 식별자 토큰", "realdata-e2e-daily-step-2026-07-15-abc1234"],
    ["공백 포함 토큰", "daily-step run report marker 2026"],
    ["특수문자 포함 인젝션-유사 토큰", 'marker "; rm -rf" 인젝션-유사'],
    ["유니코드 포함 토큰", "일별-보고 marker ✦ 2026"],
  ])(
    "정상 search argv(%s) → 빌더 산출 argv 에 대해 void 반환(throw 0)",
    (_label, searchQuery) => {
      const commandArgs = makeCommandArgs({ searchQuery });
      const argv =
        buildRealDataDailyStepDualLegRunReportIssueSearchGhArgv(commandArgs);
      expect(() =>
        assertRealDataDailyStepDualLegRunReportIssueSearchGhArgvPreservesCommandArgs(
          argv,
          commandArgs,
        ),
      ).not.toThrow();
    },
  );

  it("정상 argv 는 정확히 9 원소이고 searchQuery 가 index 4 에 단일 원소로 보존된다", () => {
    const commandArgs = makeCommandArgs({ searchQuery: 'marker; 특수 "인용"' });
    const argv =
      buildRealDataDailyStepDualLegRunReportIssueSearchGhArgv(commandArgs);
    expect(argv).toHaveLength(9);
    expect(argv[4]).toBe(commandArgs.searchQuery);
    expect(() =>
      assertRealDataDailyStepDualLegRunReportIssueSearchGhArgvPreservesCommandArgs(
        argv,
        commandArgs,
      ),
    ).not.toThrow();
  });

  // ── 구조/타입 결손(TypeError) ───────────────────────────────────────────
  it("argv 가 null 이면 TypeError", () => {
    expect(() =>
      assertRealDataDailyStepDualLegRunReportIssueSearchGhArgvPreservesCommandArgs(
        null as unknown as string[],
        makeCommandArgs({}),
      ),
    ).toThrow(TypeError);
  });

  it("argv 가 undefined 이면 TypeError", () => {
    expect(() =>
      assertRealDataDailyStepDualLegRunReportIssueSearchGhArgvPreservesCommandArgs(
        undefined as unknown as string[],
        makeCommandArgs({}),
      ),
    ).toThrow(TypeError);
  });

  it("argv 가 배열이 아니면 TypeError", () => {
    expect(() =>
      assertRealDataDailyStepDualLegRunReportIssueSearchGhArgvPreservesCommandArgs(
        "search issues" as unknown as string[],
        makeCommandArgs({}),
      ),
    ).toThrow(TypeError);
  });

  it("argv 원소가 string 이 아니면 TypeError", () => {
    const commandArgs = makeCommandArgs({});
    const argv =
      buildRealDataDailyStepDualLegRunReportIssueSearchGhArgv(commandArgs);
    const broken = [...argv];
    broken[4] = 42 as unknown as string;
    expect(() =>
      assertRealDataDailyStepDualLegRunReportIssueSearchGhArgvPreservesCommandArgs(
        broken,
        commandArgs,
      ),
    ).toThrow(TypeError);
  });

  it("commandArgs 가 null 이면 TypeError", () => {
    const argv = buildRealDataDailyStepDualLegRunReportIssueSearchGhArgv(
      makeCommandArgs({}),
    );
    expect(() =>
      assertRealDataDailyStepDualLegRunReportIssueSearchGhArgvPreservesCommandArgs(
        argv,
        null as unknown as RealDataDailyStepDualLegRunReportIssueCommandArgs,
      ),
    ).toThrow(TypeError);
  });

  it("commandArgs.searchQuery 가 string 이 아니면 TypeError", () => {
    const commandArgs = makeCommandArgs({});
    const argv =
      buildRealDataDailyStepDualLegRunReportIssueSearchGhArgv(commandArgs);
    const broken = {
      ...commandArgs,
      searchQuery: 99 as unknown as string,
    };
    expect(() =>
      assertRealDataDailyStepDualLegRunReportIssueSearchGhArgvPreservesCommandArgs(
        argv,
        broken,
      ),
    ).toThrow(TypeError);
  });

  // ── 길이 정합(S5, RangeError) ────────────────────────────────────────────
  it("(f) argv 길이가 9 미만이면(원소 누락) RangeError(S5)", () => {
    const commandArgs = makeCommandArgs({});
    const argv =
      buildRealDataDailyStepDualLegRunReportIssueSearchGhArgv(commandArgs);
    const broken = argv.slice(0, argv.length - 1); // 마지막 원소 제거.
    expect(() =>
      assertRealDataDailyStepDualLegRunReportIssueSearchGhArgvPreservesCommandArgs(
        broken,
        commandArgs,
      ),
    ).toThrow(/불변식\(S5\)/);
  });

  it("(f) argv 길이가 9 초과면(잉여 원소) RangeError(S5)", () => {
    const commandArgs = makeCommandArgs({});
    const argv =
      buildRealDataDailyStepDualLegRunReportIssueSearchGhArgv(commandArgs);
    const broken = [...argv, "--state", "open"];
    expect(() =>
      assertRealDataDailyStepDualLegRunReportIssueSearchGhArgvPreservesCommandArgs(
        broken,
        commandArgs,
      ),
    ).toThrow(/불변식\(S5\)/);
  });

  // ── 값 정합 위반(RangeError) ────────────────────────────────────────────
  it("(c) searchQuery 위치 값이 commandArgs.searchQuery 와 불일치하면 RangeError(S2)", () => {
    const commandArgs = makeCommandArgs({});
    const argv =
      buildRealDataDailyStepDualLegRunReportIssueSearchGhArgv(commandArgs);
    const broken = [...argv];
    broken[4] = "drift 토큰";
    expect(() =>
      assertRealDataDailyStepDualLegRunReportIssueSearchGhArgvPreservesCommandArgs(
        broken,
        commandArgs,
      ),
    ).toThrow(RangeError);
    expect(() =>
      assertRealDataDailyStepDualLegRunReportIssueSearchGhArgvPreservesCommandArgs(
        broken,
        commandArgs,
      ),
    ).toThrow(/불변식\(S2\)/);
  });

  it("(a) 동사 prefix 가 'search issues' 가 아니면 RangeError(S0)", () => {
    const commandArgs = makeCommandArgs({});
    const argv =
      buildRealDataDailyStepDualLegRunReportIssueSearchGhArgv(commandArgs);
    const broken = [...argv];
    broken[0] = "issue";
    broken[1] = "list";
    expect(() =>
      assertRealDataDailyStepDualLegRunReportIssueSearchGhArgvPreservesCommandArgs(
        broken,
        commandArgs,
      ),
    ).toThrow(/불변식\(S0\)/);
  });

  it("(a) 동사 prefix 의 두 번째 토큰만 어긋나도 RangeError(S0)", () => {
    const commandArgs = makeCommandArgs({});
    const argv =
      buildRealDataDailyStepDualLegRunReportIssueSearchGhArgv(commandArgs);
    const broken = [...argv];
    broken[1] = "prs"; // 'issues' 가 아님.
    expect(() =>
      assertRealDataDailyStepDualLegRunReportIssueSearchGhArgvPreservesCommandArgs(
        broken,
        commandArgs,
      ),
    ).toThrow(/불변식\(S0\)/);
  });

  it("(b) --match flag 위치가 어긋나면 RangeError(S1)", () => {
    const commandArgs = makeCommandArgs({});
    const argv =
      buildRealDataDailyStepDualLegRunReportIssueSearchGhArgv(commandArgs);
    const broken = [...argv];
    broken[2] = "--matches"; // 잘못된 flag.
    expect(() =>
      assertRealDataDailyStepDualLegRunReportIssueSearchGhArgvPreservesCommandArgs(
        broken,
        commandArgs,
      ),
    ).toThrow(/불변식\(S1\)/);
  });

  it("(b) --match 값이 'body' 가 아니면 RangeError(S1)", () => {
    const commandArgs = makeCommandArgs({});
    const argv =
      buildRealDataDailyStepDualLegRunReportIssueSearchGhArgv(commandArgs);
    const broken = [...argv];
    broken[3] = "title"; // body 가 아님.
    expect(() =>
      assertRealDataDailyStepDualLegRunReportIssueSearchGhArgvPreservesCommandArgs(
        broken,
        commandArgs,
      ),
    ).toThrow(/불변식\(S1\)/);
  });

  it("(d) --json flag 위치가 어긋나면 RangeError(S3)", () => {
    const commandArgs = makeCommandArgs({});
    const argv =
      buildRealDataDailyStepDualLegRunReportIssueSearchGhArgv(commandArgs);
    const broken = [...argv];
    broken[5] = "--jq"; // 잘못된 flag.
    expect(() =>
      assertRealDataDailyStepDualLegRunReportIssueSearchGhArgvPreservesCommandArgs(
        broken,
        commandArgs,
      ),
    ).toThrow(/불변식\(S3\)/);
  });

  it("(d) --json 필드 문자열이 SEARCH_JSON_FIELDS 와 불일치하면 RangeError(S3)", () => {
    const commandArgs = makeCommandArgs({});
    const argv =
      buildRealDataDailyStepDualLegRunReportIssueSearchGhArgv(commandArgs);
    const broken = [...argv];
    broken[6] = "number,title"; // body 멤버 누락.
    expect(() =>
      assertRealDataDailyStepDualLegRunReportIssueSearchGhArgvPreservesCommandArgs(
        broken,
        commandArgs,
      ),
    ).toThrow(/불변식\(S3\)/);
  });

  it("(e) --limit flag 위치가 어긋나면 RangeError(S4)", () => {
    const commandArgs = makeCommandArgs({});
    const argv =
      buildRealDataDailyStepDualLegRunReportIssueSearchGhArgv(commandArgs);
    const broken = [...argv];
    broken[7] = "--max"; // 잘못된 flag.
    expect(() =>
      assertRealDataDailyStepDualLegRunReportIssueSearchGhArgvPreservesCommandArgs(
        broken,
        commandArgs,
      ),
    ).toThrow(/불변식\(S4\)/);
  });

  it("(e) --limit 값이 SEARCH_LIMIT 와 불일치하면 RangeError(S4)", () => {
    const commandArgs = makeCommandArgs({});
    const argv =
      buildRealDataDailyStepDualLegRunReportIssueSearchGhArgv(commandArgs);
    const broken = [...argv];
    broken[8] = "10"; // 30 이 아님.
    expect(() =>
      assertRealDataDailyStepDualLegRunReportIssueSearchGhArgvPreservesCommandArgs(
        broken,
        commandArgs,
      ),
    ).toThrow(/불변식\(S4\)/);
  });

  // ── 빈/공백 searchQuery 거부(RangeError) ────────────────────────────────
  it("commandArgs.searchQuery 가 빈 문자열이면 RangeError(T-0900 동형 거부)", () => {
    const commandArgs = makeCommandArgs({ searchQuery: "ignored" });
    const argv =
      buildRealDataDailyStepDualLegRunReportIssueSearchGhArgv(commandArgs);
    const blank = { ...commandArgs, searchQuery: "" };
    expect(() =>
      assertRealDataDailyStepDualLegRunReportIssueSearchGhArgvPreservesCommandArgs(
        argv,
        blank,
      ),
    ).toThrow(RangeError);
    expect(() =>
      assertRealDataDailyStepDualLegRunReportIssueSearchGhArgvPreservesCommandArgs(
        argv,
        blank,
      ),
    ).toThrow(/searchQuery 가 비어있다/);
  });

  it("commandArgs.searchQuery 가 공백-only 이면 RangeError(T-0900 동형 거부)", () => {
    const commandArgs = makeCommandArgs({ searchQuery: "ignored" });
    const argv =
      buildRealDataDailyStepDualLegRunReportIssueSearchGhArgv(commandArgs);
    const blank = { ...commandArgs, searchQuery: "   \t  " };
    expect(() =>
      assertRealDataDailyStepDualLegRunReportIssueSearchGhArgvPreservesCommandArgs(
        argv,
        blank,
      ),
    ).toThrow(RangeError);
  });

  // ── negative cases 충분 cover ───────────────────────────────────────────
  it("결정성 — 동일 정상 입력 2 회 호출 둘 다 void", () => {
    const commandArgs = makeCommandArgs({});
    const argv =
      buildRealDataDailyStepDualLegRunReportIssueSearchGhArgv(commandArgs);
    expect(() =>
      assertRealDataDailyStepDualLegRunReportIssueSearchGhArgvPreservesCommandArgs(
        argv,
        commandArgs,
      ),
    ).not.toThrow();
    expect(() =>
      assertRealDataDailyStepDualLegRunReportIssueSearchGhArgvPreservesCommandArgs(
        argv,
        commandArgs,
      ),
    ).not.toThrow();
  });

  it("결정성 — 동일 위반 입력 2 회 호출 둘 다 동일 RangeError", () => {
    const commandArgs = makeCommandArgs({});
    const argv =
      buildRealDataDailyStepDualLegRunReportIssueSearchGhArgv(commandArgs);
    const broken = [...argv];
    broken[4] = "drift";
    expect(() =>
      assertRealDataDailyStepDualLegRunReportIssueSearchGhArgvPreservesCommandArgs(
        broken,
        commandArgs,
      ),
    ).toThrow(/불변식\(S2\)/);
    expect(() =>
      assertRealDataDailyStepDualLegRunReportIssueSearchGhArgvPreservesCommandArgs(
        broken,
        commandArgs,
      ),
    ).toThrow(/불변식\(S2\)/);
  });

  it("입력 비변형 — 호출 후 argv/commandArgs 객체 불변", () => {
    const commandArgs = makeCommandArgs({});
    const argv =
      buildRealDataDailyStepDualLegRunReportIssueSearchGhArgv(commandArgs);
    const argvBefore = JSON.stringify(argv);
    const commandArgsBefore = JSON.stringify(commandArgs);

    assertRealDataDailyStepDualLegRunReportIssueSearchGhArgvPreservesCommandArgs(
      argv,
      commandArgs,
    );

    expect(JSON.stringify(argv)).toBe(argvBefore);
    expect(JSON.stringify(commandArgs)).toBe(commandArgsBefore);
  });

  it("인젝션 토큰 — searchQuery 가 특수문자 포함 시에도 단일 argv 원소로 round-trip", () => {
    const searchQuery = '"; rm -rf / && echo pwn"';
    const commandArgs = makeCommandArgs({ searchQuery });
    const argv =
      buildRealDataDailyStepDualLegRunReportIssueSearchGhArgv(commandArgs);
    // 가드가 escape/분리 없이 단일 원소로 그대로 비교.
    expect(argv[4]).toBe(searchQuery);
    expect(() =>
      assertRealDataDailyStepDualLegRunReportIssueSearchGhArgvPreservesCommandArgs(
        argv,
        commandArgs,
      ),
    ).not.toThrow();
  });

  it("고정 인자 single-source — 가드가 비교에 쓰는 --json/--limit 값이 T-0900 named constant 와 동일", () => {
    const commandArgs = makeCommandArgs({});
    const argv =
      buildRealDataDailyStepDualLegRunReportIssueSearchGhArgv(commandArgs);
    // 빌더가 산출한 argv 의 고정 인자가 named constant 와 동일 참조(상수 변경 시 가드도 따라감).
    expect(argv[6]).toBe(
      REAL_DATA_DAILY_STEP_DUAL_LEG_RUN_REPORT_ISSUE_SEARCH_JSON_FIELDS,
    );
    expect(argv[8]).toBe(
      REAL_DATA_DAILY_STEP_DUAL_LEG_RUN_REPORT_ISSUE_SEARCH_LIMIT,
    );
    expect(() =>
      assertRealDataDailyStepDualLegRunReportIssueSearchGhArgvPreservesCommandArgs(
        argv,
        commandArgs,
      ),
    ).not.toThrow();
  });

  it("무관 commandArgs 멤버 무시 — createArgs/updateArgs 변형은 search argv 정합에 영향 0", () => {
    const commandArgs = makeCommandArgs({});
    const argv =
      buildRealDataDailyStepDualLegRunReportIssueSearchGhArgv(commandArgs);
    const mutated = {
      ...commandArgs,
      createArgs: { title: "전혀 다른 제목", body: "다른 본문", labels: ["x"] },
      updateArgs: { title: "또 다른 제목", body: "또 다른 본문" },
    };
    // searchQuery 는 동일하므로 가드는 여전히 void(가드는 searchQuery 만 본다).
    expect(() =>
      assertRealDataDailyStepDualLegRunReportIssueSearchGhArgvPreservesCommandArgs(
        argv,
        mutated,
      ),
    ).not.toThrow();
  });

  it("공백 민감 — searchQuery 에 후행 공백이 끼면 byte-identical 불일치로 RangeError(S2)", () => {
    const commandArgs = makeCommandArgs({});
    const argv =
      buildRealDataDailyStepDualLegRunReportIssueSearchGhArgv(commandArgs);
    const broken = [...argv];
    broken[4] = `${commandArgs.searchQuery} `; // 후행 공백.
    expect(() =>
      assertRealDataDailyStepDualLegRunReportIssueSearchGhArgvPreservesCommandArgs(
        broken,
        commandArgs,
      ),
    ).toThrow(/불변식\(S2\)/);
  });

  it("대소문자 민감 — searchQuery 대소문자만 달라도 byte-identical 불일치로 RangeError(S2)", () => {
    const commandArgs = makeCommandArgs({ searchQuery: "Marker-2026" });
    const argv =
      buildRealDataDailyStepDualLegRunReportIssueSearchGhArgv(commandArgs);
    const broken = [...argv];
    broken[4] = "marker-2026"; // 소문자.
    expect(() =>
      assertRealDataDailyStepDualLegRunReportIssueSearchGhArgvPreservesCommandArgs(
        broken,
        commandArgs,
      ),
    ).toThrow(/불변식\(S2\)/);
  });

  it("R-59 — 가드는 argv 의 searchQuery string 만 비교, raw narrative 미접촉", () => {
    const commandArgs = makeCommandArgs({});
    const argv =
      buildRealDataDailyStepDualLegRunReportIssueSearchGhArgv(commandArgs);
    expect(() =>
      assertRealDataDailyStepDualLegRunReportIssueSearchGhArgvPreservesCommandArgs(
        argv,
        commandArgs,
      ),
    ).not.toThrow();
    // argv 에 raw narrative 류 토큰이 끼어들지 않음(가드가 그런 키를 합성하지 않음).
    expect(argv).not.toContain("narrative");
    expect(argv).not.toContain("rawActivity");
  });
});
