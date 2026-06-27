// realdata-e2e-result-issue-gh-command-plan.spec.ts — T-0588 colocated unit spec.
//
// R-112 cover 구조:
//   - happy-path: (a) 후보 0건 stdout("[]") → create plan(argv 에 --title/--body/--label),
//     (b) marker 포함 후보 1건 → update plan(issueNumber=N, argv 에 issue edit String(N)),
//     (c) 후보 2+ 건 → 최소 number update 로 합성(T-0584 멱등 회귀 보호가 컴포저 경유 보존).
//   - error path: (a) 비JSON stdout → 파서 throw 전파, (b) 빈/공백 searchQuery → resolver
//     throw 전파, (c) create 분기 createArgs.title 빈/공백 → argv 빌더 throw 전파 — 각 별도
//     case(어느 layer 의 throw 인지 분리 검증).
//   - flow/branch: create 분기(후보 0건) + update 분기(후보 1+건) 각 1+, 각 위임 throw 분기.
//   - negative 충분 cover(단일 negative 금지 — 분기마다): (a) 비배열 JSON object stdout,
//     (b) hit number 0/음수/비정수, (c) searchQuery 공백-only, (d) update 분기
//     updateArgs.body 빈/공백 빌더 guard — 각 1+ throw 검증.
//   - 결정론·무공유: 동일 입력 2회 호출 → deep equal, 입력 commandArgs(중첩 labels) mutate 0.
//   - R-59: argv 가 commandArgs 의 title/body(=marker 라인 포함) 만 옮길 뿐 추가 본문 0.
import type { RealDataResultIssueCommandArgs } from "./realdata-e2e-result-issue-command-args";
import { resolveRealDataResultIssueGhCommandPlan } from "./realdata-e2e-result-issue-gh-command-plan";
import * as consistency from "./realdata-e2e-result-issue-gh-command-plan-consistency";

const MARKER = "<!-- realdata-e2e-result-issue: 2026-06-23@abc1234 -->";

// 정상 명령-args fixture — T-0583 산출물 모사(searchQuery=marker, create/update 인자 묶음).
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
    searchQuery: overrides.searchQuery ?? MARKER,
    createArgs: {
      title: overrides.createTitle ?? "실 평가 e2e 결과 2026-06-23@abc1234",
      body: overrides.createBody ?? `${MARKER}\n\n## 요약\n- 평가 단위 수: 3`,
      labels: overrides.labels ?? ["realdata-e2e", "result"],
    },
    updateArgs: {
      title: overrides.updateTitle ?? "실 평가 e2e 결과 2026-06-23@abc1234",
      body: overrides.updateBody ?? `${MARKER}\n\n## 요약\n- 평가 단위 수: 3`,
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
      title: h.title ?? "기존 결과 이슈",
      body: h.body ?? `${MARKER}\n\n이전 run 본문`,
    })),
  );
}

describe("resolveRealDataResultIssueGhCommandPlan — 종단 gh 실행 plan 컴포저", () => {
  describe("happy-path — create/update 분기 합성", () => {
    it("후보 0건 stdout('[]') → create plan(argv 에 --title/--body/--label 포함)", () => {
      const plan = resolveRealDataResultIssueGhCommandPlan(
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

      const plan = resolveRealDataResultIssueGhCommandPlan(
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

      const plan = resolveRealDataResultIssueGhCommandPlan(
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

      const plan = resolveRealDataResultIssueGhCommandPlan(
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
        resolveRealDataResultIssueGhCommandPlan("not json", makeCommandArgs()),
      ).toThrow();
    });

    it("(resolve layer) 빈 searchQuery → resolver throw 전파", () => {
      expect(() =>
        resolveRealDataResultIssueGhCommandPlan(
          "[]",
          makeCommandArgs({ searchQuery: "" }),
        ),
      ).toThrow(/marker 가 비어있습니다/);
    });

    it("(resolve layer) 공백-only searchQuery → resolver throw 전파", () => {
      expect(() =>
        resolveRealDataResultIssueGhCommandPlan(
          "[]",
          makeCommandArgs({ searchQuery: "   " }),
        ),
      ).toThrow(/marker 가 비어있습니다/);
    });

    it("(argv builder layer) create 분기 createArgs.title 빈 → 빌더 throw 전파", () => {
      expect(() =>
        resolveRealDataResultIssueGhCommandPlan(
          "[]",
          makeCommandArgs({ createTitle: "" }),
        ),
      ).toThrow(/createArgs\.title 가 비어있습니다/);
    });

    it("(argv builder layer) create 분기 createArgs.body 공백-only → 빌더 throw 전파", () => {
      expect(() =>
        resolveRealDataResultIssueGhCommandPlan(
          "[]",
          makeCommandArgs({ createBody: "   " }),
        ),
      ).toThrow(/createArgs\.body 가 비어있습니다/);
    });
  });

  describe("negative cases 충분 cover — 분기마다 throw 검증", () => {
    it("(parse) 비배열 JSON object stdout → 파서 throw 전파", () => {
      expect(() =>
        resolveRealDataResultIssueGhCommandPlan(
          '{"number":1}',
          makeCommandArgs(),
        ),
      ).toThrow(/배열이 아닙니다/);
    });

    it("(parse) hit number 0 → 파서 number guard throw 전파", () => {
      // parse 단계 자체가 number 양수성을 검증하므로 number 0 은 parse layer 에서 throw.
      expect(() =>
        resolveRealDataResultIssueGhCommandPlan(
          stdoutOf([{ number: 0 }]),
          makeCommandArgs(),
        ),
      ).toThrow();
    });

    it("(parse) hit number 음수 → 파서 number guard throw 전파", () => {
      expect(() =>
        resolveRealDataResultIssueGhCommandPlan(
          stdoutOf([{ number: -3 }]),
          makeCommandArgs(),
        ),
      ).toThrow();
    });

    it("(parse) hit number 비정수(1.5) → 파서 number guard throw 전파", () => {
      expect(() =>
        resolveRealDataResultIssueGhCommandPlan(
          stdoutOf([{ number: 1.5 }]),
          makeCommandArgs(),
        ),
      ).toThrow();
    });

    it("(parse) hit number 비숫자(string) → 파서 type guard throw 전파", () => {
      expect(() =>
        resolveRealDataResultIssueGhCommandPlan(
          stdoutOf([{ number: "12" }]),
          makeCommandArgs(),
        ),
      ).toThrow();
    });

    it("(argv builder, update 분기) updateArgs.body 빈 → 빌더 guard throw 전파", () => {
      // 후보 1건 → update 분기 진입 → updateArgs.body 빈이면 빌더가 throw.
      expect(() =>
        resolveRealDataResultIssueGhCommandPlan(
          stdoutOf([{ number: 9 }]),
          makeCommandArgs({ updateBody: "" }),
        ),
      ).toThrow(/updateArgs\.body 가 비어있습니다/);
    });

    it("(argv builder, update 분기) updateArgs.title 공백-only → 빌더 guard throw 전파", () => {
      expect(() =>
        resolveRealDataResultIssueGhCommandPlan(
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

      const first = resolveRealDataResultIssueGhCommandPlan(stdout, args);
      const second = resolveRealDataResultIssueGhCommandPlan(stdout, args);

      expect(first).toEqual(second);
    });

    it("매 호출 새 plan 객체·새 argv 배열 반환(참조 무공유)", () => {
      const stdout = "[]";
      const args = makeCommandArgs();

      const first = resolveRealDataResultIssueGhCommandPlan(stdout, args);
      const second = resolveRealDataResultIssueGhCommandPlan(stdout, args);

      expect(first).not.toBe(second);
      expect(first.argv).not.toBe(second.argv);
    });

    it("입력 commandArgs(중첩 createArgs.labels) mutate 0", () => {
      const args = makeCommandArgs();
      const labelsBefore = [...args.createArgs.labels];

      const plan = resolveRealDataResultIssueGhCommandPlan("[]", args);
      // 반환 argv mutate 가 입력 labels 에 누설되지 않음.
      plan.argv.push("--오염");

      expect(args.createArgs.labels).toEqual(labelsBefore);
      expect(args.searchQuery).toBe(MARKER);
    });

    it("R-59: create argv 가 commandArgs 의 body(marker 라인 포함) 만 옮길 뿐 추가 본문 0", () => {
      const body = `${MARKER}\n\n## 요약\n- 평가 단위 수: 3`;
      const plan = resolveRealDataResultIssueGhCommandPlan(
        "[]",
        makeCommandArgs({ createBody: body }),
      );

      const bodyIdx = plan.argv.indexOf("--body");
      expect(bodyIdx).toBeGreaterThanOrEqual(0);
      // --body 다음 원소가 입력 body 와 정확히 일치(추가 narrative 합성 0).
      expect(plan.argv[bodyIdx + 1]).toBe(body);
    });
  });

  // T-0698 self-wire 배선 검증 — 컴포저가 산출 RealDataResultIssueGhCommandPlan 을 반환
  // 직전 T-0695 신설 가드 `assertRealDataResultIssueGhCommandPlanConsistentWithInputs`
  // 를 (산출 plan, stdout, commandArgs) 인자로 정확히 1회 self-assert 하는지, 정상 합성이면
  // throw 0·반환 plan 형태 보존(관측 불가능하게 동일), 가드가 throw 하면 컴포저가 삼키지
  // 않고 그대로 선전파하는지(RangeError/TypeError 모의) 검증한다. T-0697
  // result-issue command-plan self-wire spec 패턴의 stdout-side(gh-command-plan) mirror.
  describe("consistency 가드 self-wire (T-0698) — 반환 직전 self-assert 배선", () => {
    afterEach(() => {
      jest.restoreAllMocks();
    });

    it("(create 분기, stdout='[]') 가드가 (산출 plan, stdout, commandArgs) 인자로 정확히 1회 호출됨", () => {
      const spy = jest.spyOn(
        consistency,
        "assertRealDataResultIssueGhCommandPlanConsistentWithInputs",
      );
      const stdout = "[]";
      const args = makeCommandArgs();

      const plan = resolveRealDataResultIssueGhCommandPlan(stdout, args);

      // 정확히 1회 호출.
      expect(spy).toHaveBeenCalledTimes(1);
      // 인자 순서·값이 (반환된 산출 plan, stdout, commandArgs) 와 일치.
      expect(spy).toHaveBeenCalledWith(plan, stdout, args);
      // 가드에 넘어간 인자가 컴포저가 반환한 바로 그 참조여야 한다(검증 대상 일치).
      expect(spy.mock.calls[0][0]).toBe(plan);
      expect(spy.mock.calls[0][1]).toBe(stdout);
      expect(spy.mock.calls[0][2]).toBe(args);
    });

    it("(update 단일 hit 분기) 가드가 (산출 plan, stdout, commandArgs) 인자로 정확히 1회 호출됨", () => {
      const spy = jest.spyOn(
        consistency,
        "assertRealDataResultIssueGhCommandPlanConsistentWithInputs",
      );
      const stdout = stdoutOf([{ number: 42 }]);
      const args = makeCommandArgs();

      const plan = resolveRealDataResultIssueGhCommandPlan(stdout, args);

      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy).toHaveBeenCalledWith(plan, stdout, args);
      expect(spy.mock.calls[0][0]).toBe(plan);
      expect(spy.mock.calls[0][1]).toBe(stdout);
      expect(spy.mock.calls[0][2]).toBe(args);
    });

    it("(update 다수 hit 최소 number 분기) 가드가 (산출 plan, stdout, commandArgs) 인자로 정확히 1회 호출됨", () => {
      const spy = jest.spyOn(
        consistency,
        "assertRealDataResultIssueGhCommandPlanConsistentWithInputs",
      );
      const stdout = stdoutOf([{ number: 91 }, { number: 7 }, { number: 33 }]);
      const args = makeCommandArgs();

      const plan = resolveRealDataResultIssueGhCommandPlan(stdout, args);

      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy).toHaveBeenCalledWith(plan, stdout, args);
      // 최소 number(7) update 가 self-assert 를 통과해 그대로 반환됨.
      expect(plan.action).toEqual({ action: "update", issueNumber: 7 });
    });

    it("정상 합성 → 가드 통과 후 반환 plan 이 self-wire 미배선 기대값과 동일(create 불변)", () => {
      const args = makeCommandArgs();

      const plan = resolveRealDataResultIssueGhCommandPlan("[]", args);

      // self-wire 가 반환 plan 을 변형하지 않음 — action/argv 보존.
      expect(plan.action).toEqual({ action: "create" });
      expect(plan.argv.slice(0, 2)).toEqual(["issue", "create"]);
      expect(plan.argv).toContain("--title");
      expect(plan.argv).toContain("--body");
      expect(plan.argv.filter((a) => a === "--label")).toHaveLength(2);
    });

    it("정상 합성 → 가드 통과 후 반환 plan 이 self-wire 미배선 기대값과 동일(update 보존)", () => {
      const stdout = stdoutOf([{ number: 42 }]);
      const args = makeCommandArgs();

      const plan = resolveRealDataResultIssueGhCommandPlan(stdout, args);

      expect(plan.action).toEqual({ action: "update", issueNumber: 42 });
      expect(plan.argv.slice(0, 3)).toEqual(["issue", "edit", "42"]);
      expect(plan.argv).toContain("--title");
      expect(plan.argv).toContain("--body");
    });

    it("정상 합성(create/단일 update/다수 update) → self-assert 통과로 throw 0", () => {
      expect(() =>
        resolveRealDataResultIssueGhCommandPlan("[]", makeCommandArgs()),
      ).not.toThrow();
      expect(() =>
        resolveRealDataResultIssueGhCommandPlan(
          stdoutOf([{ number: 9 }]),
          makeCommandArgs(),
        ),
      ).not.toThrow();
      expect(() =>
        resolveRealDataResultIssueGhCommandPlan(
          stdoutOf([{ number: 91 }, { number: 7 }, { number: 33 }]),
          makeCommandArgs(),
        ),
      ).not.toThrow();
    });

    it("(negative 1 — RangeError action 분기 오매핑 회귀 모사) 가드 throw 가 그대로 전파", () => {
      jest
        .spyOn(
          consistency,
          "assertRealDataResultIssueGhCommandPlanConsistentWithInputs",
        )
        .mockImplementation(() => {
          throw new RangeError(
            '정합 위반: plan.action.action 이 재유도 action 과 분기가 어긋난다 — 기대="create", 실측="update".',
          );
        });

      expect(() =>
        resolveRealDataResultIssueGhCommandPlan("[]", makeCommandArgs()),
      ).toThrow(/분기가 어긋난다/);
    });

    it("(negative 2 — RangeError argv 동사 drift 회귀 모사) 가드 throw 가 그대로 전파", () => {
      jest
        .spyOn(
          consistency,
          "assertRealDataResultIssueGhCommandPlanConsistentWithInputs",
        )
        .mockImplementation(() => {
          throw new RangeError(
            "정합 위반: plan.argv 원소가 재유도 argv 와 byte 단위로 어긋난다.",
          );
        });

      expect(() =>
        resolveRealDataResultIssueGhCommandPlan(
          stdoutOf([{ number: 9 }]),
          makeCommandArgs(),
        ),
      ).toThrow(/byte 단위로 어긋난다/);
    });

    it("(negative 3 — TypeError 구조결손 회귀 모사) 가드 TypeError throw 가 그대로 전파", () => {
      jest
        .spyOn(
          consistency,
          "assertRealDataResultIssueGhCommandPlanConsistentWithInputs",
        )
        .mockImplementation(() => {
          throw new TypeError(
            "plan 이 객체가 아니다 — 정합 비교를 진행할 수 없다.",
          );
        });

      expect(() =>
        resolveRealDataResultIssueGhCommandPlan("[]", makeCommandArgs()),
      ).toThrow(TypeError);
    });

    it("self-wire 배선 후에도 입력 commandArgs/stdout 비변형 + 동일 입력 두 번 deterministic", () => {
      const stdout = stdoutOf([{ number: 12 }]);
      const args = makeCommandArgs();
      const stdoutSnapshot = stdout;
      const argsSnapshot = JSON.parse(JSON.stringify(args));

      const a = resolveRealDataResultIssueGhCommandPlan(stdout, args);
      const b = resolveRealDataResultIssueGhCommandPlan(stdout, args);

      // 비변형(commandArgs mutate 0, stdout 문자열 불변).
      expect(stdout).toBe(stdoutSnapshot);
      expect(args).toEqual(argsSnapshot);
      // deterministic deep-equal.
      expect(a).toEqual(b);
      // 무공유(매 호출 새 plan/argv).
      expect(a).not.toBe(b);
      expect(a.argv).not.toBe(b.argv);
    });
  });
});
