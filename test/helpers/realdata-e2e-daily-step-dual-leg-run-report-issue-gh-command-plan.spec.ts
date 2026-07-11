// realdata-e2e-daily-step-dual-leg-run-report-issue-gh-command-plan.spec.ts —
// T-0902 colocated unit spec (summary 축 T-0588 spec mirror).
//
// R-112 cover 구조:
//   - happy-path: (a) 후보 0건 stdout("[]") → create plan(argv 에 --title/--body/--label),
//     (b) marker 포함 후보 1건 → update plan(issueNumber=N, argv 에 issue edit String(N)),
//     (c) 후보 2+ 건 → 최소 number update 로 합성(T-0898 멱등 회귀 보호가 컴포저 경유 보존).
//   - error path: (a) 비JSON stdout → 파서 throw 전파, (b) 빈/공백 searchQuery → resolver
//     throw 전파, (c) create 분기 createArgs.title 빈/공백 → argv 빌더 throw 전파 — 각 별도
//     case(어느 layer 의 throw 인지 분리 검증).
//   - flow/branch: create 분기(후보 0건) + update 분기(후보 1+건) 각 1+, 각 위임 throw 분기.
//   - negative 충분 cover(단일 negative 금지 — 분기마다): (a) 비배열 JSON object stdout,
//     (b) hit number 0/음수/비정수/비숫자, (c) searchQuery 공백-only, (d) update 분기
//     updateArgs.body/title 빈/공백 빌더 guard — 각 1+ throw 검증.
//   - 결정론·무공유: 동일 입력 2회 호출 → deep equal, 입력 commandArgs(중첩 labels) mutate 0.
//   - R-59: argv 가 commandArgs 의 title/body(=marker 라인 포함) 만 옮길 뿐 추가 본문 0.
import type { RealDataDailyStepDualLegRunReportIssueCommandArgs } from "./realdata-e2e-daily-step-dual-leg-run-report-issue-command-args";
import { resolveRealDataDailyStepDualLegRunReportIssueGhCommandPlan } from "./realdata-e2e-daily-step-dual-leg-run-report-issue-gh-command-plan";

const MARKER =
  "<!-- realdata-e2e-daily-step-dual-leg-run-report-issue: 2026-07-11@abc1234 -->";

// 정상 명령-args fixture — T-0897 산출물 모사(searchQuery=marker, create/update 인자 묶음).
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
    searchQuery: overrides.searchQuery ?? MARKER,
    createArgs: {
      title:
        overrides.createTitle ??
        "실 평가 e2e dual-leg run report 2026-07-11@abc1234",
      body:
        overrides.createBody ??
        `${MARKER}\n\n## dual-leg 요약\n- eval leg: pass\n- collect leg: pass`,
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
        `${MARKER}\n\n## dual-leg 요약\n- eval leg: pass\n- collect leg: pass`,
    },
  };
}

// search stdout JSON fixture — gh search issues --json number,title,body 응답 모사.
function stdoutOf(
  hits: Array<{ number: unknown; title?: unknown; body?: unknown }>,
): string {
  return JSON.stringify(
    hits.map((h) => ({
      number: h.number,
      title: h.title ?? "기존 dual-leg run report 이슈",
      body: h.body ?? `${MARKER}\n\n이전 run 본문`,
    })),
  );
}

describe("resolveRealDataDailyStepDualLegRunReportIssueGhCommandPlan — 종단 gh 실행 plan 컴포저", () => {
  describe("happy-path — create/update 분기 합성", () => {
    it("후보 0건 stdout('[]') → create plan(argv 에 --title/--body/--label 포함)", () => {
      const plan = resolveRealDataDailyStepDualLegRunReportIssueGhCommandPlan(
        "[]",
        makeCommandArgs(),
      );

      expect(plan.action).toEqual({ action: "create" });
      expect(plan.argv.slice(0, 2)).toEqual(["issue", "create"]);
      expect(plan.argv).toContain("--title");
      expect(plan.argv).toContain("--body");
      expect(plan.argv).toContain("--label");
      // labels 2건이 각각 --label flag pair 로 전개됨.
      expect(plan.argv.filter((a) => a === "--label")).toHaveLength(2);
    });

    it("marker 포함 후보 1건 stdout → update plan(issue edit String(N))", () => {
      const stdout = stdoutOf([{ number: 42 }]);

      const plan = resolveRealDataDailyStepDualLegRunReportIssueGhCommandPlan(
        stdout,
        makeCommandArgs(),
      );

      expect(plan.action).toEqual({ action: "update", issueNumber: 42 });
      expect(plan.argv.slice(0, 3)).toEqual(["issue", "edit", "42"]);
      expect(plan.argv).toContain("--title");
      expect(plan.argv).toContain("--body");
    });

    it("후보 2+ 건 → 최소 number update 로 합성(멱등 회귀 보호 보존)", () => {
      // 입력 순서 무관하게 최소 number(7) 가 issueNumber 로 선택됨.
      const stdout = stdoutOf([{ number: 91 }, { number: 7 }, { number: 33 }]);

      const plan = resolveRealDataDailyStepDualLegRunReportIssueGhCommandPlan(
        stdout,
        makeCommandArgs(),
      );

      expect(plan.action).toEqual({ action: "update", issueNumber: 7 });
      expect(plan.argv.slice(0, 3)).toEqual(["issue", "edit", "7"]);
    });

    it("후보가 marker 미포함이면 create 분기(body 에 marker 없는 hit 은 후보 아님)", () => {
      const stdout = stdoutOf([
        { number: 5, body: "marker 없는 무관 이슈 본문" },
      ]);

      const plan = resolveRealDataDailyStepDualLegRunReportIssueGhCommandPlan(
        stdout,
        makeCommandArgs(),
      );

      expect(plan.action).toEqual({ action: "create" });
      expect(plan.argv.slice(0, 2)).toEqual(["issue", "create"]);
    });
  });

  describe("error path — 위임 helper throw 전파(layer 분리 검증)", () => {
    it("(parse layer) 비JSON stdout('not json') → 파서 throw 전파", () => {
      expect(() =>
        resolveRealDataDailyStepDualLegRunReportIssueGhCommandPlan(
          "not json",
          makeCommandArgs(),
        ),
      ).toThrow();
    });

    it("(resolve layer) 빈 searchQuery → resolver throw 전파", () => {
      expect(() =>
        resolveRealDataDailyStepDualLegRunReportIssueGhCommandPlan(
          "[]",
          makeCommandArgs({ searchQuery: "" }),
        ),
      ).toThrow(/marker 가 비어있습니다/);
    });

    it("(resolve layer) 공백-only searchQuery → resolver throw 전파", () => {
      expect(() =>
        resolveRealDataDailyStepDualLegRunReportIssueGhCommandPlan(
          "[]",
          makeCommandArgs({ searchQuery: "   " }),
        ),
      ).toThrow(/marker 가 비어있습니다/);
    });

    it("(argv builder layer) create 분기 createArgs.title 빈 → 빌더 throw 전파", () => {
      expect(() =>
        resolveRealDataDailyStepDualLegRunReportIssueGhCommandPlan(
          "[]",
          makeCommandArgs({ createTitle: "" }),
        ),
      ).toThrow(/createArgs\.title 가 비어있습니다/);
    });

    it("(argv builder layer) create 분기 createArgs.body 공백-only → 빌더 throw 전파", () => {
      expect(() =>
        resolveRealDataDailyStepDualLegRunReportIssueGhCommandPlan(
          "[]",
          makeCommandArgs({ createBody: "   " }),
        ),
      ).toThrow(/createArgs\.body 가 비어있습니다/);
    });
  });

  describe("negative cases 충분 cover — 분기마다 throw 검증", () => {
    it("(parse) 비배열 JSON object stdout → 파서 throw 전파", () => {
      expect(() =>
        resolveRealDataDailyStepDualLegRunReportIssueGhCommandPlan(
          '{"number":1}',
          makeCommandArgs(),
        ),
      ).toThrow(/배열이 아닙니다/);
    });

    it("(parse) hit number 0 → 파서 number guard throw 전파", () => {
      // parse 단계 자체가 number 양수성을 검증하므로 number 0 은 parse layer 에서 throw.
      expect(() =>
        resolveRealDataDailyStepDualLegRunReportIssueGhCommandPlan(
          stdoutOf([{ number: 0 }]),
          makeCommandArgs(),
        ),
      ).toThrow();
    });

    it("(parse) hit number 음수 → 파서 number guard throw 전파", () => {
      expect(() =>
        resolveRealDataDailyStepDualLegRunReportIssueGhCommandPlan(
          stdoutOf([{ number: -3 }]),
          makeCommandArgs(),
        ),
      ).toThrow();
    });

    it("(parse) hit number 비정수(1.5) → 파서 number guard throw 전파", () => {
      expect(() =>
        resolveRealDataDailyStepDualLegRunReportIssueGhCommandPlan(
          stdoutOf([{ number: 1.5 }]),
          makeCommandArgs(),
        ),
      ).toThrow();
    });

    it("(parse) hit number 비숫자(string) → 파서 type guard throw 전파", () => {
      expect(() =>
        resolveRealDataDailyStepDualLegRunReportIssueGhCommandPlan(
          stdoutOf([{ number: "12" }]),
          makeCommandArgs(),
        ),
      ).toThrow();
    });

    it("(argv builder, update 분기) updateArgs.body 빈 → 빌더 guard throw 전파", () => {
      // 후보 1건 → update 분기 진입 → updateArgs.body 빈이면 빌더가 throw.
      expect(() =>
        resolveRealDataDailyStepDualLegRunReportIssueGhCommandPlan(
          stdoutOf([{ number: 9 }]),
          makeCommandArgs({ updateBody: "" }),
        ),
      ).toThrow(/updateArgs\.body 가 비어있습니다/);
    });

    it("(argv builder, update 분기) updateArgs.title 공백-only → 빌더 guard throw 전파", () => {
      expect(() =>
        resolveRealDataDailyStepDualLegRunReportIssueGhCommandPlan(
          stdoutOf([{ number: 9 }]),
          makeCommandArgs({ updateTitle: "  " }),
        ),
      ).toThrow(/updateArgs\.title 가 비어있습니다/);
    });
  });

  describe("결정론·무공유·R-59 정합", () => {
    it("동일 (stdout, commandArgs) 두 번 호출 → deep equal(byte-identical)", () => {
      const stdout = stdoutOf([{ number: 12 }]);
      const args = makeCommandArgs();

      const first = resolveRealDataDailyStepDualLegRunReportIssueGhCommandPlan(
        stdout,
        args,
      );
      const second = resolveRealDataDailyStepDualLegRunReportIssueGhCommandPlan(
        stdout,
        args,
      );

      expect(first).toEqual(second);
    });

    it("매 호출 새 plan 객체·새 argv 배열 반환(참조 무공유)", () => {
      const stdout = "[]";
      const args = makeCommandArgs();

      const first = resolveRealDataDailyStepDualLegRunReportIssueGhCommandPlan(
        stdout,
        args,
      );
      const second = resolveRealDataDailyStepDualLegRunReportIssueGhCommandPlan(
        stdout,
        args,
      );

      expect(first).not.toBe(second);
      expect(first.argv).not.toBe(second.argv);
    });

    it("입력 commandArgs(중첩 createArgs.labels) mutate 0", () => {
      const args = makeCommandArgs();
      const labelsBefore = [...args.createArgs.labels];

      const plan = resolveRealDataDailyStepDualLegRunReportIssueGhCommandPlan(
        "[]",
        args,
      );
      // 반환 argv mutate 가 입력 labels 에 누설되지 않음.
      plan.argv.push("--오염");

      expect(args.createArgs.labels).toEqual(labelsBefore);
      expect(args.searchQuery).toBe(MARKER);
    });

    it("R-59: create argv 가 commandArgs 의 body(marker 라인 포함) 만 옮길 뿐 추가 본문 0", () => {
      const body = `${MARKER}\n\n## dual-leg 요약\n- eval leg: pass`;
      const plan = resolveRealDataDailyStepDualLegRunReportIssueGhCommandPlan(
        "[]",
        makeCommandArgs({ createBody: body }),
      );

      const bodyIdx = plan.argv.indexOf("--body");
      expect(bodyIdx).toBeGreaterThanOrEqual(0);
      // --body 다음 원소가 입력 body 와 정확히 일치(추가 narrative 합성 0).
      expect(plan.argv[bodyIdx + 1]).toBe(body);
    });

    it("R-59: update argv 가 updateArgs.body(marker 라인 포함) 만 옮길 뿐 추가 본문 0", () => {
      const body = `${MARKER}\n\n갱신된 dual-leg 본문`;
      const plan = resolveRealDataDailyStepDualLegRunReportIssueGhCommandPlan(
        stdoutOf([{ number: 3 }]),
        makeCommandArgs({ updateBody: body }),
      );

      const bodyIdx = plan.argv.indexOf("--body");
      expect(bodyIdx).toBeGreaterThanOrEqual(0);
      expect(plan.argv[bodyIdx + 1]).toBe(body);
    });
  });
});
