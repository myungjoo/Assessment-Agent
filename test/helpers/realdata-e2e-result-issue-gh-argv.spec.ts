// realdata-e2e-result-issue-gh-argv.spec.ts — T-0585 colocated unit spec.
//
// R-112 cover 구조:
//   - happy-path: (a) create action + labels 2건 → 올바른 create argv, (b) update
//     action(issueNumber 42) → 올바른 edit argv 각각 검증.
//   - error/negative 충분 cover: (a) update issueNumber=0 throw, (b) update
//     issueNumber=-1 throw, (c) update issueNumber=1.5 throw, (d) create title 빈
//     throw, (e) create body 공백-only throw, (f) update title 빈 throw, (g) update
//     body 빈 throw — 각 별도 case(필드별·종류별 분기마다). 단일 negative 만으로 부족.
//   - flow/branch: create 분기 / update 분기 + 각 guard 분기(issueNumber, title, body)
//     각 1+. labels 0/1/2건 전개 분기 cover.
//   - 결정론: 동일 입력 2 회 호출 → byte-identical argv(deep equal).
//   - 무공유/순수성: 호출 후 입력 labels 배열 길이·원소 불변 + 반환 argv mutate 가 입력에
//     누설 안 됨.
//   - 인자 분리/인젝션: argv[0] === "issue"(gh 실행 파일명 미포함), body 에 `"; rm -rf"`
//     가 들어가도 단일 argv 원소로 유지.
//   - R-59: argv 가 commandArgs 의 title/body 만 옮길 뿐 raw 본문을 추가하지 않음.
import type { RealDataResultIssueAction } from "./realdata-e2e-result-issue-action";
import type { RealDataResultIssueCommandArgs } from "./realdata-e2e-result-issue-command-args";
import { buildRealDataResultIssueGhArgv } from "./realdata-e2e-result-issue-gh-argv";

// 정상 명령-args fixture — create/update 양쪽 인자 묶음(T-0583 산출물 모사).
function makeCommandArgs(
  overrides: {
    createTitle?: string;
    createBody?: string;
    labels?: string[];
    updateTitle?: string;
    updateBody?: string;
  } = {},
): RealDataResultIssueCommandArgs {
  return {
    searchQuery: "<!-- realdata-e2e-result-issue: 2026-06-23@abc1234 -->",
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

const CREATE: RealDataResultIssueAction = { action: "create" };
const updateOf = (issueNumber: number): RealDataResultIssueAction => ({
  action: "update",
  issueNumber,
});

describe("buildRealDataResultIssueGhArgv", () => {
  describe("happy-path", () => {
    it("(a) create action + labels 2건 → 올바른 create argv", () => {
      const args = makeCommandArgs({
        createTitle: "제목",
        createBody: "본문",
        labels: ["a", "b"],
      });

      const argv = buildRealDataResultIssueGhArgv(CREATE, args);

      expect(argv).toEqual([
        "issue",
        "create",
        "--title",
        "제목",
        "--body",
        "본문",
        "--label",
        "a",
        "--label",
        "b",
      ]);
    });

    it("(b) update action(issueNumber 42) → 올바른 edit argv", () => {
      const args = makeCommandArgs({
        updateTitle: "갱신 제목",
        updateBody: "갱신 본문",
      });

      const argv = buildRealDataResultIssueGhArgv(updateOf(42), args);

      expect(argv).toEqual([
        "issue",
        "edit",
        "42",
        "--title",
        "갱신 제목",
        "--body",
        "갱신 본문",
      ]);
    });
  });

  describe("labels 전개 분기(0/1/2건)", () => {
    it("labels 빈 배열 → --label flag 0개", () => {
      const argv = buildRealDataResultIssueGhArgv(
        CREATE,
        makeCommandArgs({ createTitle: "t", createBody: "b", labels: [] }),
      );

      expect(argv).toEqual(["issue", "create", "--title", "t", "--body", "b"]);
      expect(argv).not.toContain("--label");
    });

    it("labels 1건 → --label flag pair 1개", () => {
      const argv = buildRealDataResultIssueGhArgv(
        CREATE,
        makeCommandArgs({
          createTitle: "t",
          createBody: "b",
          labels: ["solo"],
        }),
      );

      expect(argv).toEqual([
        "issue",
        "create",
        "--title",
        "t",
        "--body",
        "b",
        "--label",
        "solo",
      ]);
    });

    it("labels 2건 → 순서 보존 flag pair 전개", () => {
      const argv = buildRealDataResultIssueGhArgv(
        CREATE,
        makeCommandArgs({
          createTitle: "t",
          createBody: "b",
          labels: ["first", "second"],
        }),
      );

      // 순서 보존: first 가 second 보다 먼저 전개됨.
      expect(argv.slice(-4)).toEqual(["--label", "first", "--label", "second"]);
    });
  });

  describe("error/negative path — guard 분기마다 throw", () => {
    it("(a) update issueNumber=0 throw", () => {
      expect(() =>
        buildRealDataResultIssueGhArgv(updateOf(0), makeCommandArgs()),
      ).toThrow(/양의 정수가 아닙니다/);
    });

    it("(b) update issueNumber=-1 throw", () => {
      expect(() =>
        buildRealDataResultIssueGhArgv(updateOf(-1), makeCommandArgs()),
      ).toThrow(/양의 정수가 아닙니다/);
    });

    it("(c) update issueNumber=1.5(비정수) throw", () => {
      expect(() =>
        buildRealDataResultIssueGhArgv(updateOf(1.5), makeCommandArgs()),
      ).toThrow(/양의 정수가 아닙니다/);
    });

    it("(d) create title 빈 throw", () => {
      expect(() =>
        buildRealDataResultIssueGhArgv(
          CREATE,
          makeCommandArgs({ createTitle: "", createBody: "b" }),
        ),
      ).toThrow(/createArgs\.title/);
    });

    it("(e) create body 공백-only throw", () => {
      expect(() =>
        buildRealDataResultIssueGhArgv(
          CREATE,
          makeCommandArgs({ createTitle: "t", createBody: "   \t  " }),
        ),
      ).toThrow(/createArgs\.body/);
    });

    it("(f) update title 빈 throw", () => {
      expect(() =>
        buildRealDataResultIssueGhArgv(
          updateOf(7),
          makeCommandArgs({ updateTitle: "", updateBody: "b" }),
        ),
      ).toThrow(/updateArgs\.title/);
    });

    it("(g) update body 공백-only throw", () => {
      expect(() =>
        buildRealDataResultIssueGhArgv(
          updateOf(7),
          makeCommandArgs({ updateTitle: "t", updateBody: "  " }),
        ),
      ).toThrow(/updateArgs\.body/);
    });
  });

  describe("결정론(동일 입력 → byte-identical)", () => {
    it("create — 동일 입력 2 회 호출 → 원소·순서까지 동일 argv", () => {
      const args = makeCommandArgs({ labels: ["x", "y"] });
      const first = buildRealDataResultIssueGhArgv(CREATE, args);
      const second = buildRealDataResultIssueGhArgv(CREATE, args);

      expect(first).toEqual(second);
    });

    it("update — 동일 입력 2 회 호출 → 원소·순서까지 동일 argv", () => {
      const args = makeCommandArgs();
      const first = buildRealDataResultIssueGhArgv(updateOf(99), args);
      const second = buildRealDataResultIssueGhArgv(updateOf(99), args);

      expect(first).toEqual(second);
    });
  });

  describe("인자 분리 정합(shell 미경유 · 인젝션 방지)", () => {
    it("argv[0] === 'issue' — gh 실행 파일명 미포함", () => {
      const argv = buildRealDataResultIssueGhArgv(CREATE, makeCommandArgs());

      expect(argv[0]).toBe("issue");
      expect(argv).not.toContain("gh");
    });

    it("body 에 shell 메타문자(`; rm -rf`)가 들어가도 단일 argv 원소로 유지", () => {
      const malicious = 'normal"; rm -rf / #';
      const argv = buildRealDataResultIssueGhArgv(
        CREATE,
        makeCommandArgs({ createTitle: "t", createBody: malicious }),
      );

      // body 값이 분리·escape 없이 단일 원소로 그대로 보존(shell 합성 0).
      const bodyIdx = argv.indexOf("--body");
      expect(argv[bodyIdx + 1]).toBe(malicious);
    });
  });

  describe("무공유/순수성(입력 mutate 0)", () => {
    it("호출 후 입력 labels 배열 길이·원소 불변", () => {
      const labels = ["realdata-e2e", "result"];
      const args = makeCommandArgs({ labels });

      buildRealDataResultIssueGhArgv(CREATE, args);

      expect(labels).toEqual(["realdata-e2e", "result"]);
      expect(args.createArgs.labels).toBe(labels);
    });

    it("반환 argv mutate 가 입력에 누설되지 않음(무공유)", () => {
      const labels = ["a", "b"];
      const args = makeCommandArgs({
        createTitle: "t",
        createBody: "b",
        labels,
      });

      const argv = buildRealDataResultIssueGhArgv(CREATE, args);
      argv.push("INJECTED");
      argv[7] = "MUTATED"; // 첫 label 위치 변형

      // 입력 labels 는 영향 없음.
      expect(labels).toEqual(["a", "b"]);
      expect(args.createArgs.labels).toEqual(["a", "b"]);
    });
  });

  describe("R-59 정합(raw 미추가)", () => {
    it("argv 는 commandArgs 의 title/body 만 옮길 뿐 raw 본문을 추가하지 않음", () => {
      const args = makeCommandArgs({
        createTitle: "오직 제목",
        createBody: "오직 본문",
        labels: [],
      });

      const argv = buildRealDataResultIssueGhArgv(CREATE, args);

      // argv 안의 자유-텍스트 값은 입력 title/body 와 정확히 일치(추가 raw 0).
      expect(argv).toEqual([
        "issue",
        "create",
        "--title",
        "오직 제목",
        "--body",
        "오직 본문",
      ]);
    });
  });
});
