// realdata-e2e-daily-step-dual-leg-run-report-issue-search-argv.spec.ts —
// T-0900 colocated unit spec.
//
// R-112 cover 구조:
//   - happy-path: (a) 정상 searchQuery → 올바른 search argv(원소·순서·갯수 정확).
//   - error/negative 충분 cover: (a) searchQuery 빈 throw, (b) 공백-only(스페이스) throw,
//     (c) 탭/개행 only throw, (d) shell 메타문자(`; rm -rf`) → throw 0(단일 argv 원소
//     유지), (e) createArgs/updateArgs 변경해도 search argv 불변 — 각 별도 case. 단일
//     negative 만으로 부족(종류별 분기마다 cover).
//   - flow/branch: guard 분기(searchQuery 빈/공백) + 정상 분기 각 1+.
//   - 결정론: 동일 입력 2 회 호출 → byte-identical argv(deep equal).
//   - 무공유/순수성: 호출 후 입력 commandArgs 의 모든 필드 불변 + 반환 argv mutate 가
//     입력에 누설 안 됨 + 매 호출 새 배열.
//   - 인자 분리/인젝션: argv[0] === "search"(gh 실행 파일명 미포함), searchQuery 에
//     `"; rm -rf"` 가 들어가도 단일 argv 원소로 유지.
//   - --json 필드 정합: `--json` 값이 "number,title,body"(공백 0)임을 검증. 이 세 필드는
//     T-0898 `RealDataDailyStepDualLegRunReportIssueSearchHit`({number, title, body})의
//     모든 멤버와 일치(cross-reference — type import 는 cross-check 만, 실행 의존 아님).
//   - --limit 결정론: `--limit` 이 named constant("30")와 일치함을 검증.
//   - R-59: argv 가 searchQuery 만 옮길 뿐 raw 본문을 추가하지 않음.
// cross-reference(분리 책임) — --json 필드가 이 hit shape 의 모든 멤버와 일치함을 확인.
// type-only import 라 실행 의존이 아니며(컴파일 타임 cross-check), runtime 부수효과 0.
import type { RealDataDailyStepDualLegRunReportIssueSearchHit } from "./realdata-e2e-daily-step-dual-leg-run-report-issue-action";
import type { RealDataDailyStepDualLegRunReportIssueCommandArgs } from "./realdata-e2e-daily-step-dual-leg-run-report-issue-command-args";
import {
  buildRealDataDailyStepDualLegRunReportIssueSearchGhArgv,
  REAL_DATA_DAILY_STEP_DUAL_LEG_RUN_REPORT_ISSUE_SEARCH_JSON_FIELDS,
  REAL_DATA_DAILY_STEP_DUAL_LEG_RUN_REPORT_ISSUE_SEARCH_LIMIT,
} from "./realdata-e2e-daily-step-dual-leg-run-report-issue-search-argv";
import * as searchArgvConsistency from "./realdata-e2e-daily-step-dual-leg-run-report-issue-search-argv-consistency";
import * as searchJsonFields from "./realdata-e2e-daily-step-dual-leg-run-report-issue-search-json-fields";
import { REAL_DATA_DAILY_STEP_DUAL_LEG_RUN_REPORT_ISSUE_SEARCH_PARSE_SHAPE_KEYS } from "./realdata-e2e-daily-step-dual-leg-run-report-issue-search-json-fields";

// 정상 명령-args fixture — T-0897 산출물 모사(searchQuery 단일 의존이지만 createArgs/
// updateArgs 미사용을 검증하기 위해 전체 shape 을 채운다).
function makeCommandArgs(
  overrides: {
    searchQuery?: string;
    createTitle?: string;
    createBody?: string;
    labels?: string[];
    updateTitle?: string;
    updateBody?: string;
  } = {},
): RealDataDailyStepDualLegRunReportIssueCommandArgs {
  return {
    searchQuery:
      overrides.searchQuery ??
      "<!-- realdata-e2e-daily-step-dual-leg-run-report: 2026-07-11@abc1234 -->",
    createArgs: {
      title:
        overrides.createTitle ??
        "실 평가 e2e dual-leg run report 2026-07-11@abc1234",
      body:
        overrides.createBody ??
        "<!-- marker -->\n\n## dual-leg 결과\n- eval leg: pass",
      labels: overrides.labels ?? [
        "realdata-e2e",
        "daily-step-dual-leg-run-report",
      ],
    },
    updateArgs: {
      title:
        overrides.updateTitle ??
        "실 평가 e2e dual-leg run report 2026-07-11@abc1234",
      body:
        overrides.updateBody ??
        "<!-- marker -->\n\n## dual-leg 결과\n- eval leg: pass",
    },
  };
}

describe("buildRealDataDailyStepDualLegRunReportIssueSearchGhArgv", () => {
  describe("happy-path", () => {
    it("(a) 정상 searchQuery → 올바른 search argv(원소·순서·갯수 정확)", () => {
      const args = makeCommandArgs({ searchQuery: "<!-- marker-token -->" });

      const argv =
        buildRealDataDailyStepDualLegRunReportIssueSearchGhArgv(args);

      expect(argv).toEqual([
        "search",
        "issues",
        "--match",
        "body",
        "<!-- marker-token -->",
        "--json",
        "number,title,body",
        "--limit",
        "30",
      ]);
    });
  });

  describe("argv 인자 정합(--match/--json/--limit)", () => {
    it("--match 의 value 는 'body' 고정(marker 는 issue body 안에 박힘)", () => {
      const argv =
        buildRealDataDailyStepDualLegRunReportIssueSearchGhArgv(
          makeCommandArgs(),
        );
      const matchIdx = argv.indexOf("--match");

      expect(matchIdx).toBeGreaterThanOrEqual(0);
      expect(argv[matchIdx + 1]).toBe("body");
    });

    it("--json 값은 'number,title,body'(세 필드 콤마 구분, 공백 0)", () => {
      const argv =
        buildRealDataDailyStepDualLegRunReportIssueSearchGhArgv(
          makeCommandArgs(),
        );
      const jsonIdx = argv.indexOf("--json");

      expect(jsonIdx).toBeGreaterThanOrEqual(0);
      expect(argv[jsonIdx + 1]).toBe("number,title,body");
      // 공백 0 — 콤마 외 구분자 없음.
      expect(argv[jsonIdx + 1]).not.toMatch(/\s/);
      // named constant 와 일치(매직 스트링 0).
      expect(argv[jsonIdx + 1]).toBe(
        REAL_DATA_DAILY_STEP_DUAL_LEG_RUN_REPORT_ISSUE_SEARCH_JSON_FIELDS,
      );
    });

    it("--json 필드가 RealDataDailyStepDualLegRunReportIssueSearchHit 의 모든 멤버와 일치(cross-reference)", () => {
      // T-0898 hit shape 의 모든 키를 type-driven 으로 나열(컴파일 타임 cross-check).
      // hit 객체를 만들면 number/title/body 외 키가 없어야 type 통과 — 필드 누락/추가 시
      // 컴파일 실패로 회귀가 잡힌다.
      const sampleHit: RealDataDailyStepDualLegRunReportIssueSearchHit = {
        number: 1,
        title: "t",
        body: "b",
      };
      const hitKeys = Object.keys(sampleHit).sort();

      expect(hitKeys).toEqual(["body", "number", "title"]);
      // --json 이 요청하는 필드 집합과 동일.
      const requested =
        REAL_DATA_DAILY_STEP_DUAL_LEG_RUN_REPORT_ISSUE_SEARCH_JSON_FIELDS.split(
          ",",
        ).sort();
      expect(requested).toEqual(hitKeys);
    });

    it("--limit 은 named constant('30')와 일치(매직 넘버 0)", () => {
      const argv =
        buildRealDataDailyStepDualLegRunReportIssueSearchGhArgv(
          makeCommandArgs(),
        );
      const limitIdx = argv.indexOf("--limit");

      expect(limitIdx).toBeGreaterThanOrEqual(0);
      expect(argv[limitIdx + 1]).toBe("30");
      expect(argv[limitIdx + 1]).toBe(
        REAL_DATA_DAILY_STEP_DUAL_LEG_RUN_REPORT_ISSUE_SEARCH_LIMIT,
      );
    });
  });

  describe("error/negative path — guard 분기마다 throw", () => {
    it("(a) searchQuery 빈 throw", () => {
      expect(() =>
        buildRealDataDailyStepDualLegRunReportIssueSearchGhArgv(
          makeCommandArgs({ searchQuery: "" }),
        ),
      ).toThrow(/searchQuery 가 비어있습니다/);
    });

    it("(b) searchQuery 공백-only(스페이스) throw", () => {
      expect(() =>
        buildRealDataDailyStepDualLegRunReportIssueSearchGhArgv(
          makeCommandArgs({ searchQuery: "     " }),
        ),
      ).toThrow(/searchQuery 가 비어있습니다/);
    });

    it("(c) searchQuery 탭/개행 only throw", () => {
      expect(() =>
        buildRealDataDailyStepDualLegRunReportIssueSearchGhArgv(
          makeCommandArgs({ searchQuery: "\t\n  \r\n" }),
        ),
      ).toThrow(/searchQuery 가 비어있습니다/);
    });

    it("(d) searchQuery 에 shell 메타문자(`; rm -rf`) → throw 0(단일 argv 원소 유지)", () => {
      const malicious = 'normal"; rm -rf / #';
      const argv = buildRealDataDailyStepDualLegRunReportIssueSearchGhArgv(
        makeCommandArgs({ searchQuery: malicious }),
      );

      // searchQuery 값이 분리·escape 없이 단일 원소로 그대로 보존(shell 합성 0).
      const matchIdx = argv.indexOf("--match");
      // --match 다음은 "body", 그 다음이 searchQuery.
      expect(argv[matchIdx + 2]).toBe(malicious);
    });

    it("(e) createArgs.title 변경해도 search argv 불변(createArgs 미사용)", () => {
      const base =
        buildRealDataDailyStepDualLegRunReportIssueSearchGhArgv(
          makeCommandArgs(),
        );
      const altered = buildRealDataDailyStepDualLegRunReportIssueSearchGhArgv(
        makeCommandArgs({ createTitle: "전혀 다른 제목" }),
      );

      expect(altered).toEqual(base);
    });
  });

  describe("createArgs/updateArgs 미사용(searchQuery 단일 의존)", () => {
    it("createArgs.body/labels 및 updateArgs 변경해도 search argv 불변", () => {
      const base =
        buildRealDataDailyStepDualLegRunReportIssueSearchGhArgv(
          makeCommandArgs(),
        );
      const altered = buildRealDataDailyStepDualLegRunReportIssueSearchGhArgv(
        makeCommandArgs({
          createBody: "완전히 다른 본문",
          labels: ["x", "y", "z"],
          updateTitle: "다른 갱신 제목",
          updateBody: "다른 갱신 본문",
        }),
      );

      expect(altered).toEqual(base);
    });
  });

  describe("결정론(동일 입력 → byte-identical)", () => {
    it("동일 입력 2 회 호출 → 원소·순서까지 동일 argv", () => {
      const args = makeCommandArgs();
      const first =
        buildRealDataDailyStepDualLegRunReportIssueSearchGhArgv(args);
      const second =
        buildRealDataDailyStepDualLegRunReportIssueSearchGhArgv(args);

      expect(first).toEqual(second);
    });
  });

  describe("인자 분리 정합(shell 미경유 · 인젝션 방지)", () => {
    it("argv[0] === 'search' — gh 실행 파일명 미포함", () => {
      const argv =
        buildRealDataDailyStepDualLegRunReportIssueSearchGhArgv(
          makeCommandArgs(),
        );

      expect(argv[0]).toBe("search");
      expect(argv).not.toContain("gh");
    });

    it("argv[1] === 'issues' — search issues 서브커맨드 정합", () => {
      const argv =
        buildRealDataDailyStepDualLegRunReportIssueSearchGhArgv(
          makeCommandArgs(),
        );

      expect(argv[1]).toBe("issues");
    });
  });

  describe("무공유/순수성(입력 mutate 0)", () => {
    it("호출 후 입력 commandArgs 의 모든 필드 불변", () => {
      const args = makeCommandArgs({
        labels: ["realdata-e2e", "daily-step-dual-leg-run-report"],
      });
      const snapshot = JSON.stringify(args);

      buildRealDataDailyStepDualLegRunReportIssueSearchGhArgv(args);

      // 입력 commandArgs 전체(중첩 createArgs/updateArgs 포함)가 불변.
      expect(JSON.stringify(args)).toBe(snapshot);
    });

    it("반환 argv 가 매 호출 새 배열이며 mutate 가 입력·후속 호출에 누설 안 됨(무공유)", () => {
      const args = makeCommandArgs({ searchQuery: "<!-- token -->" });
      const before = args.searchQuery;

      const first =
        buildRealDataDailyStepDualLegRunReportIssueSearchGhArgv(args);
      const second =
        buildRealDataDailyStepDualLegRunReportIssueSearchGhArgv(args);

      // 매 호출 새 배열.
      expect(first).not.toBe(second);

      first.push("INJECTED");
      first[4] = "MUTATED"; // searchQuery 위치 변형

      // 입력 searchQuery·후속 호출 결과 모두 영향 없음.
      expect(args.searchQuery).toBe(before);
      expect(second).not.toContain("INJECTED");
      expect(second).not.toContain("MUTATED");
    });
  });

  describe("R-59 정합(raw 미추가)", () => {
    it("argv 는 searchQuery 만 옮길 뿐 raw 본문을 추가하지 않음", () => {
      const args = makeCommandArgs({ searchQuery: "<!-- 오직 토큰 -->" });

      const argv =
        buildRealDataDailyStepDualLegRunReportIssueSearchGhArgv(args);

      // argv 안의 자유-텍스트 값(searchQuery 위치)은 입력 searchQuery 와 정확히 일치
      // (추가 raw 0). 나머지 원소는 전부 결정론 상수.
      expect(argv).toEqual([
        "search",
        "issues",
        "--match",
        "body",
        "<!-- 오직 토큰 -->",
        "--json",
        "number,title,body",
        "--limit",
        "30",
      ]);
    });
  });
});

// self-wire drift-guard 배선 검증 (T-0999) — 빌더가 단일 반환 지점 직전 consistency oracle
// 가드를 스스로 호출하는지(flow spy)·drift 를 전파하는지(negative)·정상 산출을 mutate 하지
// 않는지(무공유)를 검증한다. self-wire 가 제거되면 flow spy·negative 전파 case 가 fail =
// de-facto regression guard(단일 반환 지점 배선 존재 증명). consistency 모듈은 namespace 로
// import 해 self-wire spy(jest.spyOn) 대상으로 삼는다 — ts-jest CommonJS 로 컴파일되므로 이
// namespace 의 함수를 spyOn 하면 빌더 내부 self-wire 호출이 가로채진다.
const GUARD_NAME =
  "assertRealDataDailyStepDualLegRunReportIssueSearchGhArgvPreservesCommandArgs" as const;

const EXPECTED_ARGV = (searchQuery: string): string[] => [
  "search",
  "issues",
  "--match",
  "body",
  searchQuery,
  "--json",
  "number,title,body",
  "--limit",
  "30",
];

describe("buildRealDataDailyStepDualLegRunReportIssueSearchGhArgv self-wire consistency guard (T-0999)", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("happy-path (self-wire 배선 후에도 정합 argv 정상 반환 — throw 0)", () => {
    it("(i) 일반 marker searchQuery → self-wire 후에도 기대 argv(deep-equal) 반환", () => {
      const searchQuery = "<!-- marker-token -->";
      expect(() =>
        buildRealDataDailyStepDualLegRunReportIssueSearchGhArgv(
          makeCommandArgs({ searchQuery }),
        ),
      ).not.toThrow();

      const argv = buildRealDataDailyStepDualLegRunReportIssueSearchGhArgv(
        makeCommandArgs({ searchQuery }),
      );
      expect(argv).toEqual(EXPECTED_ARGV(searchQuery));
    });

    it("(ii) 인젝션 토큰(`; rm -rf`) 포함 searchQuery → self-wire 후에도 단일 원소 유지·정합 통과", () => {
      const searchQuery = 'normal"; rm -rf / #';
      const argv = buildRealDataDailyStepDualLegRunReportIssueSearchGhArgv(
        makeCommandArgs({ searchQuery }),
      );
      expect(argv).toEqual(EXPECTED_ARGV(searchQuery));
      // searchQuery 는 index 4 단일 원소로 그대로 보존(분리·escape 0).
      expect(argv[4]).toBe(searchQuery);
    });

    it("(iii) 유니코드/공백 포함 searchQuery → self-wire 후에도 정합 통과", () => {
      const searchQuery = "<!-- 유니코드 마커 ✅ 2026-07-15 -->";
      const argv = buildRealDataDailyStepDualLegRunReportIssueSearchGhArgv(
        makeCommandArgs({ searchQuery }),
      );
      expect(argv).toEqual(EXPECTED_ARGV(searchQuery));
    });
  });

  describe("error-path (기존 방어 throw 가 self-wire 로 가려지지 않음)", () => {
    it("빈 searchQuery → 여전히 assertSearchQueryNonBlank Error 전파", () => {
      expect(() =>
        buildRealDataDailyStepDualLegRunReportIssueSearchGhArgv(
          makeCommandArgs({ searchQuery: "" }),
        ),
      ).toThrow(/searchQuery 가 비어있습니다/);
    });

    it("공백-only searchQuery → 여전히 assertSearchQueryNonBlank Error 전파", () => {
      expect(() =>
        buildRealDataDailyStepDualLegRunReportIssueSearchGhArgv(
          makeCommandArgs({ searchQuery: "   \t\n" }),
        ),
      ).toThrow(/searchQuery 가 비어있습니다/);
    });
  });

  describe("flow/branch (self-wire 호출 사실 검증 — spy 로 배선 존재 증명)", () => {
    it("(i) 빌더 호출 시 가드가 (반환된 searchArgv, commandArgs) 로 정확히 1 회 호출", () => {
      const spy = jest.spyOn(searchArgvConsistency, GUARD_NAME);
      const args = makeCommandArgs({ searchQuery: "<!-- marker -->" });

      const argv =
        buildRealDataDailyStepDualLegRunReportIssueSearchGhArgv(args);

      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy).toHaveBeenCalledWith(argv, args);
    });

    it("(ii) 인젝션 토큰 searchQuery 다양성 → 가드가 정확히 그 argv·commandArgs 로 호출", () => {
      const spy = jest.spyOn(searchArgvConsistency, GUARD_NAME);
      const args = makeCommandArgs({ searchQuery: 'x"; rm -rf /' });

      const argv =
        buildRealDataDailyStepDualLegRunReportIssueSearchGhArgv(args);

      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy).toHaveBeenCalledWith(argv, args);
    });
  });

  describe("negative (예외 상황 분기마다 1+ — drift 전파 · 비변형)", () => {
    it("(a) 가드가 RangeError throw → 빌더가 동일 RangeError 전파(silent 삼킴 0)", () => {
      const drift = new RangeError("정합 위반: 강제 drift(테스트)");
      jest.spyOn(searchArgvConsistency, GUARD_NAME).mockImplementation(() => {
        throw drift;
      });

      expect(() =>
        buildRealDataDailyStepDualLegRunReportIssueSearchGhArgv(
          makeCommandArgs(),
        ),
      ).toThrow(drift);
    });

    it("(b) 가드가 TypeError throw → 빌더가 동일 TypeError 전파(silent 삼킴 0)", () => {
      const drift = new TypeError("구조 결손: 강제 drift(테스트)");
      jest.spyOn(searchArgvConsistency, GUARD_NAME).mockImplementation(() => {
        throw drift;
      });

      expect(() =>
        buildRealDataDailyStepDualLegRunReportIssueSearchGhArgv(
          makeCommandArgs(),
        ),
      ).toThrow(drift);
    });

    it("(c) self-wire 가 정상 산출을 mutate 하지 않음 — 반환 argv deep-equal, 입력 commandArgs 무공유, 매 호출 새 배열", () => {
      const args = makeCommandArgs({ searchQuery: "<!-- token -->" });
      const searchQueryBefore = args.searchQuery;
      const labelsBefore = [...args.createArgs.labels];
      const snapshot = JSON.stringify(args);

      const first =
        buildRealDataDailyStepDualLegRunReportIssueSearchGhArgv(args);
      const second =
        buildRealDataDailyStepDualLegRunReportIssueSearchGhArgv(args);

      // self-wire 는 tautology(void)라 반환 argv 는 배선 이전 산출과 동일해야 한다.
      expect(first).toEqual(EXPECTED_ARGV("<!-- token -->"));
      expect(first).toEqual(second);
      // 입력 commandArgs(중첩 createArgs.labels)·searchQuery 미변형.
      expect(args.searchQuery).toBe(searchQueryBefore);
      expect(args.createArgs.labels).toEqual(labelsBefore);
      expect(JSON.stringify(args)).toBe(snapshot);
      // 매 호출 새 argv 배열 무공유.
      expect(first).not.toBe(second);
    });
  });
});

// ── T-1013: search --json 필드↔parse-shape 정합 가드 self-wire 검증 ──
// 빌더가 argv 반환 직전 assertRealDataDailyStepDualLegRunReportIssueSearchJsonFieldsMatchParseShape 를
// (REAL_DATA_DAILY_STEP_DUAL_LEG_RUN_REPORT_ISSUE_SEARCH_JSON_FIELDS,
//  REAL_DATA_DAILY_STEP_DUAL_LEG_RUN_REPORT_ISSUE_SEARCH_PARSE_SHAPE_KEYS) 인자로 self-assert
// 함을 검증한다. T-1012 신설 가드의 builder self-wire, 요약축 T-0658 mirror(T-1010 Follow-up ②).
// search 빌더는 단일 반환 지점(create/update 분기 없음)이라 호출 지점도 1지점. consistency 모듈
// spy(위 T-0999 describe)와 별도로 json-fields 모듈을 namespace 로 import 해 spyOn 대상으로 삼는다.
describe("buildRealDataDailyStepDualLegRunReportIssueSearchGhArgv self-wire json-fields↔parse-shape 정합 가드 (T-1013)", () => {
  const jsonFieldsGuardName =
    "assertRealDataDailyStepDualLegRunReportIssueSearchJsonFieldsMatchParseShape" as const;

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("happy-path — 가드 통과 후 byte-identical argv 반환", () => {
    it("(a) 정상 commandArgs → json-fields self-wire 후에도 기존과 byte-identical argv 반환", () => {
      const args = makeCommandArgs({ searchQuery: "<!-- marker-token -->" });

      const argv =
        buildRealDataDailyStepDualLegRunReportIssueSearchGhArgv(args);

      expect(argv).toEqual(EXPECTED_ARGV("<!-- marker-token -->"));
    });

    it("(b) 두 production 상수가 현재 정합이라 self-assert 가 throw 없이 통과(가드 실제 호출, 미mock)", () => {
      // 가드를 mock 하지 않고 실제 호출 — 현재 정합 상수에서 throw 0 이어야 한다.
      const args = makeCommandArgs();

      expect(() =>
        buildRealDataDailyStepDualLegRunReportIssueSearchGhArgv(args),
      ).not.toThrow();
    });

    it("(c) 인젝션 토큰(`; rm -rf`) 포함 searchQuery → self-wire 후에도 정합 통과·단일 원소 유지", () => {
      const searchQuery = 'normal"; rm -rf / #';
      const argv = buildRealDataDailyStepDualLegRunReportIssueSearchGhArgv(
        makeCommandArgs({ searchQuery }),
      );

      expect(argv).toEqual(EXPECTED_ARGV(searchQuery));
      expect(argv[4]).toBe(searchQuery);
    });
  });

  describe("self-wire 호출 인자 정합 — spyOn 으로 (jsonFields, parseShapeKeys) 검증", () => {
    it("(a) 가드가 (REAL_DATA_..._SEARCH_JSON_FIELDS, REAL_DATA_..._SEARCH_PARSE_SHAPE_KEYS) 로 정확히 1회 호출", () => {
      const spy = jest
        .spyOn(searchJsonFields, jsonFieldsGuardName)
        .mockImplementation(() => undefined);

      const args = makeCommandArgs({ searchQuery: "<!-- 토큰 -->" });
      buildRealDataDailyStepDualLegRunReportIssueSearchGhArgv(args);

      expect(spy).toHaveBeenCalledTimes(1);
      // 인자가 (`--json` 요청 필드 문자열, parse-shape 키 목록) 임을 검증.
      expect(spy).toHaveBeenCalledWith(
        REAL_DATA_DAILY_STEP_DUAL_LEG_RUN_REPORT_ISSUE_SEARCH_JSON_FIELDS,
        REAL_DATA_DAILY_STEP_DUAL_LEG_RUN_REPORT_ISSUE_SEARCH_PARSE_SHAPE_KEYS,
      );
    });
  });

  describe("error path — searchQuery guard 우선(self-wire 추가가 guard 순서·회귀 무영향)", () => {
    it("(a) searchQuery 빈 → searchQuery guard 가 먼저 throw, json-fields 가드 미호출", () => {
      const spy = jest
        .spyOn(searchJsonFields, jsonFieldsGuardName)
        .mockImplementation(() => undefined);

      expect(() =>
        buildRealDataDailyStepDualLegRunReportIssueSearchGhArgv(
          makeCommandArgs({ searchQuery: "" }),
        ),
      ).toThrow(/searchQuery 가 비어있습니다/);
      expect(spy).not.toHaveBeenCalled();
    });

    it("(b) searchQuery 공백-only → searchQuery guard 가 먼저 throw, json-fields 가드 미호출", () => {
      const spy = jest
        .spyOn(searchJsonFields, jsonFieldsGuardName)
        .mockImplementation(() => undefined);

      expect(() =>
        buildRealDataDailyStepDualLegRunReportIssueSearchGhArgv(
          makeCommandArgs({ searchQuery: "   \t\n" }),
        ),
      ).toThrow(/searchQuery 가 비어있습니다/);
      expect(spy).not.toHaveBeenCalled();
    });

    it("(c) json-fields 가드 강제 throw → 빌더가 손상 argv 미반환·에러 propagate", () => {
      jest
        .spyOn(searchJsonFields, jsonFieldsGuardName)
        .mockImplementation(() => {
          throw new RangeError("모의 회귀: --json 필드↔parse-shape 부정합");
        });

      let returned: string[] | undefined;
      expect(() => {
        returned =
          buildRealDataDailyStepDualLegRunReportIssueSearchGhArgv(
            makeCommandArgs(),
          );
      }).toThrow(/모의 회귀: --json 필드↔parse-shape 부정합/);
      expect(returned).toBeUndefined();
    });
  });

  describe("negative cases 충분 cover", () => {
    it("(a) 결정성 — 동일 commandArgs 2회 빌드 → 둘 다 byte-identical 정상 반환", () => {
      const args = makeCommandArgs();

      const first =
        buildRealDataDailyStepDualLegRunReportIssueSearchGhArgv(args);
      const second =
        buildRealDataDailyStepDualLegRunReportIssueSearchGhArgv(args);

      expect(first).toEqual(second);
    });

    it("(b) 입력 비변형 — self-wire 추가 후에도 빌더 호출 후 입력 commandArgs unchanged", () => {
      const args = makeCommandArgs({
        labels: ["realdata-e2e", "daily-step-dual-leg-run-report"],
      });
      const snapshot = JSON.stringify(args);

      buildRealDataDailyStepDualLegRunReportIssueSearchGhArgv(args);

      expect(JSON.stringify(args)).toBe(snapshot);
    });

    it("(c) 반환 argv 가 매 호출 새 배열(반환값 mutate 가 후속 호출에 누설 안 됨)", () => {
      const args = makeCommandArgs();

      const first =
        buildRealDataDailyStepDualLegRunReportIssueSearchGhArgv(args);
      const second =
        buildRealDataDailyStepDualLegRunReportIssueSearchGhArgv(args);

      expect(first).not.toBe(second);
      first.push("INJECTED");
      first[6] = "MUTATED"; // --json 값 위치 변형
      expect(second).not.toContain("INJECTED");
      expect(second).not.toContain("MUTATED");
    });

    it("(d) 가드 순서 보존 — SearchGhArgvPreservesCommandArgs 가드 → JsonFieldsMatchParseShape 가드 순서 유지(둘 다 1회 호출)", () => {
      const roundTripSpy = jest
        .spyOn(
          searchArgvConsistency,
          "assertRealDataDailyStepDualLegRunReportIssueSearchGhArgvPreservesCommandArgs",
        )
        .mockImplementation(() => undefined);
      const jsonFieldsSpy = jest
        .spyOn(searchJsonFields, jsonFieldsGuardName)
        .mockImplementation(() => undefined);

      buildRealDataDailyStepDualLegRunReportIssueSearchGhArgv(
        makeCommandArgs(),
      );

      // 두 가드 모두 1회 호출 — argv↔command-args 보존 가드가 json-fields 가드보다 먼저.
      expect(roundTripSpy).toHaveBeenCalledTimes(1);
      expect(jsonFieldsSpy).toHaveBeenCalledTimes(1);
      expect(roundTripSpy.mock.invocationCallOrder[0]).toBeLessThan(
        jsonFieldsSpy.mock.invocationCallOrder[0],
      );
    });

    it("(e) 두 production 상수 현재 정합 — 가드 미mock 실제 호출 시 정상 commandArgs 에서 throw 0", () => {
      expect(() =>
        buildRealDataDailyStepDualLegRunReportIssueSearchGhArgv(
          makeCommandArgs({ searchQuery: "<!-- 실제 가드 -->" }),
        ),
      ).not.toThrow();
    });

    it("(f) R-59 — self-wire 후에도 argv 는 searchQuery 만 옮길 뿐 raw 본문 미접촉", () => {
      const args = makeCommandArgs({ searchQuery: "<!-- 오직 토큰 -->" });

      const argv =
        buildRealDataDailyStepDualLegRunReportIssueSearchGhArgv(args);

      expect(argv).toEqual(EXPECTED_ARGV("<!-- 오직 토큰 -->"));
    });
  });
});
