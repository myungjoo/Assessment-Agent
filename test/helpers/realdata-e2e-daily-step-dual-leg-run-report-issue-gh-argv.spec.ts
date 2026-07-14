// realdata-e2e-daily-step-dual-leg-run-report-issue-gh-argv.spec.ts — T-0899
// colocated unit spec (summary 축 T-0585 spec mirror).
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
//   - 무공유/순수성: 호출 후 입력 labels 배열·action 불변(deep-equal) + 반환 argv mutate
//     가 입력에 누설 안 됨 + 매 호출 새 배열.
//   - 인자 분리/인젝션: argv[0] === "issue"(gh 실행 파일명 미포함), body 에 `"; rm -rf"`
//     가 들어가도 단일 argv 원소로 유지.
//   - R-59: argv 가 commandArgs 의 title/body 만 옮길 뿐 raw 본문을 추가하지 않음.
//   - self-wire (T-0993): 빌더가 create/update 두 반환 지점 직전 consistency oracle 가드를
//     스스로 호출하는지(flow spy)·drift 를 전파하는지(negative)·정상 산출을 mutate 하지
//     않는지(무공유) 검증. consistency 모듈은 namespace 로 import 해 self-wire spy(jest.spyOn)
//     대상으로 삼는다 — ts-jest CommonJS 로 컴파일되므로, 이 namespace 의 함수를 spyOn 하면
//     빌더 내부 self-wire 호출이 가로채진다.
import type { RealDataDailyStepDualLegRunReportIssueAction } from "./realdata-e2e-daily-step-dual-leg-run-report-issue-action";
import type { RealDataDailyStepDualLegRunReportIssueCommandArgs } from "./realdata-e2e-daily-step-dual-leg-run-report-issue-command-args";
import { buildRealDataDailyStepDualLegRunReportIssueGhArgv } from "./realdata-e2e-daily-step-dual-leg-run-report-issue-gh-argv";
import * as ghArgvConsistency from "./realdata-e2e-daily-step-dual-leg-run-report-issue-gh-argv-consistency";

// 정상 명령-args fixture — create/update 양쪽 인자 묶음(T-0897 산출물 모사).
function makeCommandArgs(
  overrides: {
    createTitle?: string;
    createBody?: string;
    labels?: string[];
    updateTitle?: string;
    updateBody?: string;
  } = {},
): RealDataDailyStepDualLegRunReportIssueCommandArgs {
  return {
    searchQuery:
      "<!-- realdata-e2e-daily-step-dual-leg-run-report: 2026-06-23@abc1234 -->",
    createArgs: {
      title:
        overrides.createTitle ??
        "실 평가 e2e dual-leg run report 2026-06-23@abc1234",
      body:
        overrides.createBody ?? "<!-- marker -->\n\n## 요약\n- eval leg: pass",
      labels: overrides.labels ?? [
        "realdata-e2e",
        "daily-step-dual-leg-run-report",
      ],
    },
    updateArgs: {
      title:
        overrides.updateTitle ??
        "실 평가 e2e dual-leg run report 2026-06-23@abc1234",
      body:
        overrides.updateBody ?? "<!-- marker -->\n\n## 요약\n- eval leg: pass",
    },
  };
}

const CREATE: RealDataDailyStepDualLegRunReportIssueAction = {
  action: "create",
};
const updateOf = (
  issueNumber: number,
): RealDataDailyStepDualLegRunReportIssueAction => ({
  action: "update",
  issueNumber,
});

describe("buildRealDataDailyStepDualLegRunReportIssueGhArgv", () => {
  describe("happy-path", () => {
    it("(a) create action + labels 2건 → 올바른 create argv", () => {
      const args = makeCommandArgs({
        createTitle: "제목",
        createBody: "본문",
        labels: ["a", "b"],
      });

      const argv = buildRealDataDailyStepDualLegRunReportIssueGhArgv(
        CREATE,
        args,
      );

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

      const argv = buildRealDataDailyStepDualLegRunReportIssueGhArgv(
        updateOf(42),
        args,
      );

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
      const argv = buildRealDataDailyStepDualLegRunReportIssueGhArgv(
        CREATE,
        makeCommandArgs({ createTitle: "t", createBody: "b", labels: [] }),
      );

      expect(argv).toEqual(["issue", "create", "--title", "t", "--body", "b"]);
      expect(argv).not.toContain("--label");
    });

    it("labels 1건 → --label flag pair 1개", () => {
      const argv = buildRealDataDailyStepDualLegRunReportIssueGhArgv(
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
      const argv = buildRealDataDailyStepDualLegRunReportIssueGhArgv(
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
        buildRealDataDailyStepDualLegRunReportIssueGhArgv(
          updateOf(0),
          makeCommandArgs(),
        ),
      ).toThrow(/양의 정수가 아닙니다/);
    });

    it("(b) update issueNumber=-1 throw", () => {
      expect(() =>
        buildRealDataDailyStepDualLegRunReportIssueGhArgv(
          updateOf(-1),
          makeCommandArgs(),
        ),
      ).toThrow(/양의 정수가 아닙니다/);
    });

    it("(c) update issueNumber=1.5(비정수) throw", () => {
      expect(() =>
        buildRealDataDailyStepDualLegRunReportIssueGhArgv(
          updateOf(1.5),
          makeCommandArgs(),
        ),
      ).toThrow(/양의 정수가 아닙니다/);
    });

    it("(d) create title 빈 throw", () => {
      expect(() =>
        buildRealDataDailyStepDualLegRunReportIssueGhArgv(
          CREATE,
          makeCommandArgs({ createTitle: "", createBody: "b" }),
        ),
      ).toThrow(/createArgs\.title/);
    });

    it("(e) create body 공백-only throw", () => {
      expect(() =>
        buildRealDataDailyStepDualLegRunReportIssueGhArgv(
          CREATE,
          makeCommandArgs({ createTitle: "t", createBody: "   \t  " }),
        ),
      ).toThrow(/createArgs\.body/);
    });

    it("(f) update title 빈 throw", () => {
      expect(() =>
        buildRealDataDailyStepDualLegRunReportIssueGhArgv(
          updateOf(7),
          makeCommandArgs({ updateTitle: "", updateBody: "b" }),
        ),
      ).toThrow(/updateArgs\.title/);
    });

    it("(g) update body 공백-only throw", () => {
      expect(() =>
        buildRealDataDailyStepDualLegRunReportIssueGhArgv(
          updateOf(7),
          makeCommandArgs({ updateTitle: "t", updateBody: "  " }),
        ),
      ).toThrow(/updateArgs\.body/);
    });
  });

  describe("결정론(동일 입력 → byte-identical)", () => {
    it("create — 동일 입력 2 회 호출 → 원소·순서까지 동일 argv", () => {
      const args = makeCommandArgs({ labels: ["x", "y"] });
      const first = buildRealDataDailyStepDualLegRunReportIssueGhArgv(
        CREATE,
        args,
      );
      const second = buildRealDataDailyStepDualLegRunReportIssueGhArgv(
        CREATE,
        args,
      );

      expect(first).toEqual(second);
    });

    it("update — 동일 입력 2 회 호출 → 원소·순서까지 동일 argv", () => {
      const args = makeCommandArgs();
      const first = buildRealDataDailyStepDualLegRunReportIssueGhArgv(
        updateOf(99),
        args,
      );
      const second = buildRealDataDailyStepDualLegRunReportIssueGhArgv(
        updateOf(99),
        args,
      );

      expect(first).toEqual(second);
    });
  });

  describe("인자 분리 정합(shell 미경유 · 인젝션 방지)", () => {
    it("argv[0] === 'issue' — gh 실행 파일명 미포함", () => {
      const argv = buildRealDataDailyStepDualLegRunReportIssueGhArgv(
        CREATE,
        makeCommandArgs(),
      );

      expect(argv[0]).toBe("issue");
      expect(argv).not.toContain("gh");
    });

    it("body 에 shell 메타문자(`; rm -rf`)가 들어가도 단일 argv 원소로 유지", () => {
      const malicious = 'normal"; rm -rf / #';
      const argv = buildRealDataDailyStepDualLegRunReportIssueGhArgv(
        CREATE,
        makeCommandArgs({ createTitle: "t", createBody: malicious }),
      );

      // body 값이 분리·escape 없이 단일 원소로 그대로 보존(shell 합성 0).
      const bodyIdx = argv.indexOf("--body");
      expect(argv[bodyIdx + 1]).toBe(malicious);
    });
  });

  describe("무공유/순수성(입력 mutate 0)", () => {
    it("호출 후 입력 action/commandArgs(중첩 labels 포함) deep-equal 불변", () => {
      const labels = ["realdata-e2e", "daily-step-dual-leg-run-report"];
      const args = makeCommandArgs({ labels });
      const action = updateOf(5);

      buildRealDataDailyStepDualLegRunReportIssueGhArgv(CREATE, args);
      buildRealDataDailyStepDualLegRunReportIssueGhArgv(action, args);

      expect(labels).toEqual([
        "realdata-e2e",
        "daily-step-dual-leg-run-report",
      ]);
      expect(args.createArgs.labels).toBe(labels);
      expect(action).toEqual({ action: "update", issueNumber: 5 });
    });

    it("반환 argv mutate 가 입력에 누설되지 않음(무공유)", () => {
      const labels = ["a", "b"];
      const args = makeCommandArgs({
        createTitle: "t",
        createBody: "b",
        labels,
      });

      const argv = buildRealDataDailyStepDualLegRunReportIssueGhArgv(
        CREATE,
        args,
      );
      argv.push("INJECTED");
      argv[7] = "MUTATED"; // 첫 label 위치 변형

      // 입력 labels 는 영향 없음.
      expect(labels).toEqual(["a", "b"]);
      expect(args.createArgs.labels).toEqual(["a", "b"]);
    });

    it("매 호출 새 argv 배열 반환(무공유)", () => {
      const args = makeCommandArgs({ labels: ["a"] });

      const first = buildRealDataDailyStepDualLegRunReportIssueGhArgv(
        CREATE,
        args,
      );
      const second = buildRealDataDailyStepDualLegRunReportIssueGhArgv(
        CREATE,
        args,
      );

      expect(first).not.toBe(second);
      first.push("INJECTED");
      expect(second).not.toContain("INJECTED");
    });
  });

  describe("R-59 정합(raw 미추가)", () => {
    it("argv 는 commandArgs 의 title/body 만 옮길 뿐 raw 본문을 추가하지 않음", () => {
      const args = makeCommandArgs({
        createTitle: "오직 제목",
        createBody: "오직 본문",
        labels: [],
      });

      const argv = buildRealDataDailyStepDualLegRunReportIssueGhArgv(
        CREATE,
        args,
      );

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

// self-wire drift-guard 배선 검증 (T-0993) — 빌더가 create/update 두 반환 지점 직전
// consistency oracle 가드를 스스로 호출하는지(flow spy)·drift 를 전파하는지(negative)·정상
// 산출을 mutate 하지 않는지(무공유)를 검증한다. self-wire 가 어느 분기에서든 제거되면 flow
// spy·negative 전파 case 가 fail = de-facto regression guard(양 분기 배선 존재 증명).
const GUARD_NAME =
  "assertRealDataDailyStepDualLegRunReportIssueGhArgvPreservesCommandArgs" as const;

describe("buildRealDataDailyStepDualLegRunReportIssueGhArgv self-wire consistency guard (T-0993)", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("happy-path (self-wire 배선 후에도 정합 argv 정상 반환 — throw 0)", () => {
    it("(i) create 분기 labels 0개 → self-wire 후에도 기대 벡터 byte-identical 반환", () => {
      const args = makeCommandArgs({
        createTitle: "제목",
        createBody: "본문",
        labels: [],
      });
      expect(() =>
        buildRealDataDailyStepDualLegRunReportIssueGhArgv(CREATE, args),
      ).not.toThrow();
      expect(
        buildRealDataDailyStepDualLegRunReportIssueGhArgv(CREATE, args),
      ).toEqual(["issue", "create", "--title", "제목", "--body", "본문"]);
    });

    it("(ii) create 분기 labels 1개 → self-wire 후에도 기대 벡터 byte-identical 반환", () => {
      const args = makeCommandArgs({
        createTitle: "t",
        createBody: "b",
        labels: ["solo"],
      });
      expect(
        buildRealDataDailyStepDualLegRunReportIssueGhArgv(CREATE, args),
      ).toEqual([
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

    it("(iii) create 분기 labels 다수 → self-wire 후에도 기대 벡터 byte-identical 반환", () => {
      const args = makeCommandArgs({
        createTitle: "t",
        createBody: "b",
        labels: ["a", "b", "c"],
      });
      expect(
        buildRealDataDailyStepDualLegRunReportIssueGhArgv(CREATE, args),
      ).toEqual([
        "issue",
        "create",
        "--title",
        "t",
        "--body",
        "b",
        "--label",
        "a",
        "--label",
        "b",
        "--label",
        "c",
      ]);
    });

    it("(iv) update 분기 → self-wire 후에도 기대 edit 벡터 byte-identical 반환", () => {
      const args = makeCommandArgs({
        updateTitle: "갱신 제목",
        updateBody: "갱신 본문",
      });
      expect(() =>
        buildRealDataDailyStepDualLegRunReportIssueGhArgv(updateOf(42), args),
      ).not.toThrow();
      expect(
        buildRealDataDailyStepDualLegRunReportIssueGhArgv(updateOf(42), args),
      ).toEqual([
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

  describe("error-path (기존 방어 guard 가 self-wire 로 가려지지 않음)", () => {
    it("create title 빈-공백 → 빌더 자체 assertNonBlank Error 를 던진다", () => {
      expect(() =>
        buildRealDataDailyStepDualLegRunReportIssueGhArgv(
          CREATE,
          makeCommandArgs({ createTitle: "  ", createBody: "b" }),
        ),
      ).toThrow(/createArgs\.title/);
    });

    it("create body 빈-공백 → 빌더 자체 assertNonBlank Error 를 던진다", () => {
      expect(() =>
        buildRealDataDailyStepDualLegRunReportIssueGhArgv(
          CREATE,
          makeCommandArgs({ createTitle: "t", createBody: "   " }),
        ),
      ).toThrow(/createArgs\.body/);
    });

    it("update issueNumber 비-양의정수 → assertPositiveIssueNumber Error 를 던진다", () => {
      expect(() =>
        buildRealDataDailyStepDualLegRunReportIssueGhArgv(
          updateOf(0),
          makeCommandArgs(),
        ),
      ).toThrow(/양의 정수가 아닙니다/);
    });

    it("update title 빈-공백 → 빌더 자체 assertNonBlank Error 를 던진다", () => {
      expect(() =>
        buildRealDataDailyStepDualLegRunReportIssueGhArgv(
          updateOf(7),
          makeCommandArgs({ updateTitle: " ", updateBody: "b" }),
        ),
      ).toThrow(/updateArgs\.title/);
    });
  });

  describe("flow/branch (self-wire 호출 사실 검증 — 두 분기 각각 spy 로 배선 존재 증명)", () => {
    it("create action → 가드가 (반환된 argv, action, commandArgs) 로 정확히 1 회 호출", () => {
      const spy = jest.spyOn(ghArgvConsistency, GUARD_NAME);
      const args = makeCommandArgs({ labels: ["a", "b"] });
      const argv = buildRealDataDailyStepDualLegRunReportIssueGhArgv(
        CREATE,
        args,
      );

      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy).toHaveBeenCalledWith(argv, CREATE, args);
    });

    it("update action → 가드가 (반환된 argv, action, commandArgs) 로 정확히 1 회 호출", () => {
      const spy = jest.spyOn(ghArgvConsistency, GUARD_NAME);
      const args = makeCommandArgs();
      const action = updateOf(99);
      const argv = buildRealDataDailyStepDualLegRunReportIssueGhArgv(
        action,
        args,
      );

      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy).toHaveBeenCalledWith(argv, action, args);
    });
  });

  describe("negative (예외 상황 분기마다 1+ — drift 전파 · 비변형)", () => {
    it("(a) create 분기 — 가드가 RangeError throw → 빌더가 동일 RangeError 전파(silent 삼킴 0)", () => {
      const drift = new RangeError("정합 위반: 강제 drift(테스트)");
      jest.spyOn(ghArgvConsistency, GUARD_NAME).mockImplementation(() => {
        throw drift;
      });

      expect(() =>
        buildRealDataDailyStepDualLegRunReportIssueGhArgv(
          CREATE,
          makeCommandArgs(),
        ),
      ).toThrow(drift);
    });

    it("(a) update 분기 — 가드가 RangeError throw → 빌더가 동일 RangeError 전파(silent 삼킴 0)", () => {
      const drift = new RangeError("정합 위반: update 강제 drift(테스트)");
      jest.spyOn(ghArgvConsistency, GUARD_NAME).mockImplementation(() => {
        throw drift;
      });

      expect(() =>
        buildRealDataDailyStepDualLegRunReportIssueGhArgv(
          updateOf(7),
          makeCommandArgs(),
        ),
      ).toThrow(drift);
    });

    it("(b) self-wire 가 정상 산출을 mutate 하지 않음 — 반환 argv byte-identical, 입력·labels 무공유, 매 호출 새 배열", () => {
      const labels = ["a", "b"];
      const args = makeCommandArgs({
        createTitle: "t",
        createBody: "b",
        labels,
      });
      const action = updateOf(5);

      const createArgv = buildRealDataDailyStepDualLegRunReportIssueGhArgv(
        CREATE,
        args,
      );
      const updateArgv = buildRealDataDailyStepDualLegRunReportIssueGhArgv(
        action,
        args,
      );

      // self-wire 는 tautology(void)라 반환 argv 는 배선 이전 합성 결과와 동일해야 한다.
      expect(createArgv).toEqual([
        "issue",
        "create",
        "--title",
        "t",
        "--body",
        "b",
        "--label",
        "a",
        "--label",
        "b",
      ]);
      expect(updateArgv).toEqual([
        "issue",
        "edit",
        "5",
        "--title",
        args.updateArgs.title,
        "--body",
        args.updateArgs.body,
      ]);
      // 입력 action·commandArgs·중첩 labels 미변형.
      expect(labels).toEqual(["a", "b"]);
      expect(args.createArgs.labels).toBe(labels);
      expect(action).toEqual({ action: "update", issueNumber: 5 });
      // 매 호출 새 배열 무공유 — mutate 가 다음 호출에 누설되지 않음.
      const second = buildRealDataDailyStepDualLegRunReportIssueGhArgv(
        CREATE,
        args,
      );
      expect(second).not.toBe(createArgv);
      createArgv.push("INJECTED");
      expect(second).not.toContain("INJECTED");
    });
  });
});
