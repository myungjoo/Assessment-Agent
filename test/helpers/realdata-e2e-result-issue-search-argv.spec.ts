// realdata-e2e-result-issue-search-argv.spec.ts — T-0586 colocated unit spec.
//
// R-112 cover 구조:
//   - happy-path: (a) 정상 searchQuery → 올바른 search argv(원소·순서·갯수 정확).
//   - error/negative 충분 cover: (a) searchQuery 빈 throw, (b) 공백-only(스페이스) throw,
//     (c) 탭/개행 only throw, (d) shell 메타문자(`; rm -rf`) → throw 0(단일 argv 원소
//     유지), (e) createArgs.title 변경해도 search argv 불변 — 각 별도 case. 단일 negative
//     만으로 부족(종류별 분기마다 cover).
//   - flow/branch: guard 분기(searchQuery 빈) + 정상 분기 + 무공유/결정론 각 1+.
//   - 결정론: 동일 입력 2 회 호출 → byte-identical argv(deep equal).
//   - 무공유/순수성: 호출 후 입력 commandArgs 의 모든 필드 불변 + 반환 argv mutate 가
//     입력에 누설 안 됨.
//   - 인자 분리/인젝션: argv[0] === "search"(gh 실행 파일명 미포함), searchQuery 에
//     `"; rm -rf"` 가 들어가도 단일 argv 원소로 유지.
//   - --json 필드 정합: `--json` 값이 "number,title,body"(공백 0)임을 검증. 이 세 필드는
//     T-0584 `RealDataResultIssueSearchHit`({number, title, body})의 모든 멤버와 일치
//     (cross-reference — type import 는 cross-check 만, 실행 의존 아님).
//   - --limit 결정론: `--limit` 이 named constant("30")와 일치함을 검증.
//   - createArgs/updateArgs 미사용: createArgs.body/labels 변경해도 search argv 불변.
//   - R-59: argv 가 searchQuery 만 옮길 뿐 raw 본문을 추가하지 않음.
// cross-reference(분리 책임) — --json 필드가 이 hit shape 의 모든 멤버와 일치함을 확인.
// type-only import 라 실행 의존이 아니며(컴파일 타임 cross-check), runtime 부수효과 0.
import type { RealDataResultIssueSearchHit } from "./realdata-e2e-result-issue-action";
import type { RealDataResultIssueCommandArgs } from "./realdata-e2e-result-issue-command-args";
import {
  buildRealDataResultIssueSearchGhArgv,
  REAL_DATA_RESULT_ISSUE_SEARCH_JSON_FIELDS,
  REAL_DATA_RESULT_ISSUE_SEARCH_LIMIT,
} from "./realdata-e2e-result-issue-search-argv";

// 정상 명령-args fixture — T-0583 산출물 모사(searchQuery 단일 의존이지만 createArgs/
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
): RealDataResultIssueCommandArgs {
  return {
    searchQuery:
      overrides.searchQuery ??
      "<!-- realdata-e2e-result-issue: 2026-06-23@abc1234 -->",
    createArgs: {
      title: overrides.createTitle ?? "실 평가 e2e 결과 2026-06-23@abc1234",
      body:
        overrides.createBody ?? "<!-- marker -->\n\n## 요약\n- 평가 단위 수: 3",
      labels: overrides.labels ?? ["realdata-e2e", "result"],
    },
    updateArgs: {
      title: overrides.updateTitle ?? "실 평가 e2e 결과 2026-06-23@abc1234",
      body:
        overrides.updateBody ?? "<!-- marker -->\n\n## 요약\n- 평가 단위 수: 3",
    },
  };
}

describe("buildRealDataResultIssueSearchGhArgv", () => {
  describe("happy-path", () => {
    it("(a) 정상 searchQuery → 올바른 search argv(원소·순서·갯수 정확)", () => {
      const args = makeCommandArgs({ searchQuery: "<!-- marker-token -->" });

      const argv = buildRealDataResultIssueSearchGhArgv(args);

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
      const argv = buildRealDataResultIssueSearchGhArgv(makeCommandArgs());
      const matchIdx = argv.indexOf("--match");

      expect(matchIdx).toBeGreaterThanOrEqual(0);
      expect(argv[matchIdx + 1]).toBe("body");
    });

    it("--json 값은 'number,title,body'(세 필드 콤마 구분, 공백 0)", () => {
      const argv = buildRealDataResultIssueSearchGhArgv(makeCommandArgs());
      const jsonIdx = argv.indexOf("--json");

      expect(jsonIdx).toBeGreaterThanOrEqual(0);
      expect(argv[jsonIdx + 1]).toBe("number,title,body");
      // 공백 0 — 콤마 외 구분자 없음.
      expect(argv[jsonIdx + 1]).not.toMatch(/\s/);
      // named constant 와 일치.
      expect(argv[jsonIdx + 1]).toBe(REAL_DATA_RESULT_ISSUE_SEARCH_JSON_FIELDS);
    });

    it("--json 필드가 RealDataResultIssueSearchHit 의 모든 멤버와 일치(cross-reference)", () => {
      // T-0584 hit shape 의 모든 키를 type-driven 으로 나열(컴파일 타임 cross-check).
      // hit 객체를 만들면 number/title/body 외 키가 없어야 type 통과 — 필드 누락/추가 시
      // 컴파일 실패로 회귀가 잡힌다.
      const sampleHit: RealDataResultIssueSearchHit = {
        number: 1,
        title: "t",
        body: "b",
      };
      const hitKeys = Object.keys(sampleHit).sort();

      expect(hitKeys).toEqual(["body", "number", "title"]);
      // --json 이 요청하는 필드 집합과 동일.
      const requested =
        REAL_DATA_RESULT_ISSUE_SEARCH_JSON_FIELDS.split(",").sort();
      expect(requested).toEqual(hitKeys);
    });

    it("--limit 은 named constant('30')와 일치(매직 넘버 0)", () => {
      const argv = buildRealDataResultIssueSearchGhArgv(makeCommandArgs());
      const limitIdx = argv.indexOf("--limit");

      expect(limitIdx).toBeGreaterThanOrEqual(0);
      expect(argv[limitIdx + 1]).toBe("30");
      expect(argv[limitIdx + 1]).toBe(REAL_DATA_RESULT_ISSUE_SEARCH_LIMIT);
    });
  });

  describe("error/negative path — guard 분기마다 throw", () => {
    it("(a) searchQuery 빈 throw", () => {
      expect(() =>
        buildRealDataResultIssueSearchGhArgv(
          makeCommandArgs({ searchQuery: "" }),
        ),
      ).toThrow(/searchQuery 가 비어있습니다/);
    });

    it("(b) searchQuery 공백-only(스페이스) throw", () => {
      expect(() =>
        buildRealDataResultIssueSearchGhArgv(
          makeCommandArgs({ searchQuery: "     " }),
        ),
      ).toThrow(/searchQuery 가 비어있습니다/);
    });

    it("(c) searchQuery 탭/개행 only throw", () => {
      expect(() =>
        buildRealDataResultIssueSearchGhArgv(
          makeCommandArgs({ searchQuery: "\t\n  \r\n" }),
        ),
      ).toThrow(/searchQuery 가 비어있습니다/);
    });

    it("(d) searchQuery 에 shell 메타문자(`; rm -rf`) → throw 0(단일 argv 원소 유지)", () => {
      const malicious = 'normal"; rm -rf / #';
      const argv = buildRealDataResultIssueSearchGhArgv(
        makeCommandArgs({ searchQuery: malicious }),
      );

      // searchQuery 값이 분리·escape 없이 단일 원소로 그대로 보존(shell 합성 0).
      const matchIdx = argv.indexOf("--match");
      // --match 다음은 "body", 그 다음이 searchQuery.
      expect(argv[matchIdx + 2]).toBe(malicious);
    });

    it("(e) createArgs.title 변경해도 search argv 불변(createArgs 미사용)", () => {
      const base = buildRealDataResultIssueSearchGhArgv(makeCommandArgs());
      const altered = buildRealDataResultIssueSearchGhArgv(
        makeCommandArgs({ createTitle: "전혀 다른 제목" }),
      );

      expect(altered).toEqual(base);
    });
  });

  describe("createArgs/updateArgs 미사용(searchQuery 단일 의존)", () => {
    it("createArgs.body/labels 변경해도 search argv 불변", () => {
      const base = buildRealDataResultIssueSearchGhArgv(makeCommandArgs());
      const altered = buildRealDataResultIssueSearchGhArgv(
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
      const first = buildRealDataResultIssueSearchGhArgv(args);
      const second = buildRealDataResultIssueSearchGhArgv(args);

      expect(first).toEqual(second);
    });
  });

  describe("인자 분리 정합(shell 미경유 · 인젝션 방지)", () => {
    it("argv[0] === 'search' — gh 실행 파일명 미포함", () => {
      const argv = buildRealDataResultIssueSearchGhArgv(makeCommandArgs());

      expect(argv[0]).toBe("search");
      expect(argv).not.toContain("gh");
    });

    it("argv[1] === 'issues' — search issues 서브커맨드 정합", () => {
      const argv = buildRealDataResultIssueSearchGhArgv(makeCommandArgs());

      expect(argv[1]).toBe("issues");
    });
  });

  describe("무공유/순수성(입력 mutate 0)", () => {
    it("호출 후 입력 commandArgs 의 모든 필드 불변", () => {
      const args = makeCommandArgs({ labels: ["realdata-e2e", "result"] });
      const snapshot = JSON.stringify(args);

      buildRealDataResultIssueSearchGhArgv(args);

      // 입력 commandArgs 전체(중첩 createArgs/updateArgs 포함)가 불변.
      expect(JSON.stringify(args)).toBe(snapshot);
    });

    it("반환 argv mutate 가 입력에 누설되지 않음(무공유)", () => {
      const args = makeCommandArgs({ searchQuery: "<!-- token -->" });
      const before = args.searchQuery;

      const argv = buildRealDataResultIssueSearchGhArgv(args);
      argv.push("INJECTED");
      argv[4] = "MUTATED"; // searchQuery 위치 변형

      // 입력 searchQuery 는 영향 없음.
      expect(args.searchQuery).toBe(before);
    });
  });

  describe("R-59 정합(raw 미추가)", () => {
    it("argv 는 searchQuery 만 옮길 뿐 raw 본문을 추가하지 않음", () => {
      const args = makeCommandArgs({ searchQuery: "<!-- 오직 토큰 -->" });

      const argv = buildRealDataResultIssueSearchGhArgv(args);

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
