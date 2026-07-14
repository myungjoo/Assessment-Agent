// realdata-e2e-daily-step-dual-leg-run-report-issue-gh-argv-consistency.spec.ts —
// T-0992 colocated unit spec.
//
// 대상: `assertRealDataDailyStepDualLegRunReportIssueGhArgvPreservesCommandArgs(argv,
// action, commandArgs)` — daily-step dual-leg run report 이슈 gh argv 가 명령-args 의
// title/body/labels 를 argv 위치로 정합 round-trip 했는지 검증하는 순수 가드(argv-layer).
// 실 `buildRealDataDailyStepDualLegRunReportIssueGhArgv`(T-0899) 산출 argv 를 happy-path
// fixture 로 재사용해 빌더↔가드 paired round-trip 을 교차 검증한다(oracle ↔ producer 규칙
// 일치 증명). 요약축 선례 T-0653 spec mirror.
//
// R-112 cover 구조:
//   - happy-path: 정상 action+commandArgs → buildRealDataDailyStepDualLegRunReportIssueGhArgv
//     산출 argv → 가드 void(throw 0). create(labels 0개·1개·다수)·update 변형.
//   - error/negative 충분 cover: ① create --title 값 불일치 ② --body 값 불일치 ③ labels
//     flag-pair 순서변경/누락/추가 ④ update --title/--body 값 불일치 ⑤ update issueNumber
//     문자열 불일치 ⑥ 동사 불일치(create action 인데 issue edit). 각 RangeError.
//   - 구조 결손 TypeError: argv null/비배열/원소 비-string, action null/분기값오류/issueNumber
//     비-number, commandArgs null/하위필드 비-string/labels 비배열.
//   - flow/branch: create 정합 / update 정합 / 동사 분기(C0~C3·U0~U4) / 정상 void / 구조
//     결손 TypeError 각 분기 격리(RangeError vs TypeError 구분 assert).
//   - negative cases: 결정성(2회) / 입력 비변형 / 빈 labels 경계 / 부분·초과 labels 거부 /
//     공백·대소문자 민감(byte-identical) / §9(비시크릿 더미) / R-59(raw narrative 미접촉).
import type { RealDataDailyStepDualLegRunReportIssueAction } from "./realdata-e2e-daily-step-dual-leg-run-report-issue-action";
import type { RealDataDailyStepDualLegRunReportIssueCommandArgs } from "./realdata-e2e-daily-step-dual-leg-run-report-issue-command-args";
import { buildRealDataDailyStepDualLegRunReportIssueGhArgv } from "./realdata-e2e-daily-step-dual-leg-run-report-issue-gh-argv";
import { assertRealDataDailyStepDualLegRunReportIssueGhArgvPreservesCommandArgs } from "./realdata-e2e-daily-step-dual-leg-run-report-issue-gh-argv-consistency";

// commandArgs fixture 헬퍼 — labels 개수·title/body 변형을 모사. searchQuery 는 본 가드가
// 보지 않으므로(argv 가 searchQuery 를 담지 않음) marker 자리표시만 둔다. 모든 값은
// 비시크릿 더미 string(실 secret/PAT/credential 미노출 — §9).
function makeCommandArgs(overrides: {
  title?: string;
  body?: string;
  labels?: string[];
  updateTitle?: string;
  updateBody?: string;
}): RealDataDailyStepDualLegRunReportIssueCommandArgs {
  return {
    searchQuery: "<!-- daily-step-dual-leg-run-report:2026-07-14 -->",
    createArgs: {
      title:
        overrides.title ??
        "실 평가 e2e daily-step dual-leg 실행 리포트 2026-07-14",
      body:
        overrides.body ??
        "<!-- daily-step-dual-leg-run-report:2026-07-14 -->\n\n## 요약\n- leg 수: 2",
      labels: overrides.labels ?? [
        "realdata-e2e",
        "daily-step-dual-leg-run-report",
      ],
    },
    updateArgs: {
      title:
        overrides.updateTitle ??
        "실 평가 e2e daily-step dual-leg 실행 리포트 2026-07-14",
      body:
        overrides.updateBody ??
        "<!-- daily-step-dual-leg-run-report:2026-07-14 -->\n\n## 요약\n- leg 수: 2",
    },
  };
}

const CREATE_ACTION: RealDataDailyStepDualLegRunReportIssueAction = {
  action: "create",
};
const UPDATE_ACTION: RealDataDailyStepDualLegRunReportIssueAction = {
  action: "update",
  issueNumber: 42,
};

describe("assertRealDataDailyStepDualLegRunReportIssueGhArgvPreservesCommandArgs", () => {
  // ── happy-path (빌더↔가드 paired round-trip) ─────────────────────────────
  it.each([
    ["labels 다수", ["realdata-e2e", "daily-step-dual-leg-run-report"]],
    ["labels 1개", ["only-one"]],
    ["labels 0개", [] as string[]],
  ])(
    "정상 create argv(%s) → 빌더 산출 argv 에 대해 void 반환(throw 0)",
    (_label, labels) => {
      const commandArgs = makeCommandArgs({ labels });
      const argv = buildRealDataDailyStepDualLegRunReportIssueGhArgv(
        CREATE_ACTION,
        commandArgs,
      );
      expect(() =>
        assertRealDataDailyStepDualLegRunReportIssueGhArgvPreservesCommandArgs(
          argv,
          CREATE_ACTION,
          commandArgs,
        ),
      ).not.toThrow();
    },
  );

  it("정상 update argv → 빌더 산출 argv 에 대해 void 반환(throw 0)", () => {
    const commandArgs = makeCommandArgs({});
    const argv = buildRealDataDailyStepDualLegRunReportIssueGhArgv(
      UPDATE_ACTION,
      commandArgs,
    );
    expect(() =>
      assertRealDataDailyStepDualLegRunReportIssueGhArgvPreservesCommandArgs(
        argv,
        UPDATE_ACTION,
        commandArgs,
      ),
    ).not.toThrow();
  });

  it("정상 update argv(다른 issueNumber·title/body 변형) → void", () => {
    const commandArgs = makeCommandArgs({
      updateTitle: "다른 제목",
      updateBody:
        "<!-- daily-step-dual-leg-run-report:2026-07-14 -->\n다른 본문",
    });
    const action: RealDataDailyStepDualLegRunReportIssueAction = {
      action: "update",
      issueNumber: 9999,
    };
    const argv = buildRealDataDailyStepDualLegRunReportIssueGhArgv(
      action,
      commandArgs,
    );
    expect(() =>
      assertRealDataDailyStepDualLegRunReportIssueGhArgvPreservesCommandArgs(
        argv,
        action,
        commandArgs,
      ),
    ).not.toThrow();
  });

  // ── 구조/타입 결손(TypeError) ───────────────────────────────────────────
  it("argv 가 null 이면 TypeError", () => {
    expect(() =>
      assertRealDataDailyStepDualLegRunReportIssueGhArgvPreservesCommandArgs(
        null as unknown as string[],
        CREATE_ACTION,
        makeCommandArgs({}),
      ),
    ).toThrow(TypeError);
  });

  it("argv 가 undefined 이면 TypeError", () => {
    expect(() =>
      assertRealDataDailyStepDualLegRunReportIssueGhArgvPreservesCommandArgs(
        undefined as unknown as string[],
        CREATE_ACTION,
        makeCommandArgs({}),
      ),
    ).toThrow(TypeError);
  });

  it("argv 가 배열이 아니면 TypeError", () => {
    expect(() =>
      assertRealDataDailyStepDualLegRunReportIssueGhArgvPreservesCommandArgs(
        "issue create" as unknown as string[],
        CREATE_ACTION,
        makeCommandArgs({}),
      ),
    ).toThrow(TypeError);
  });

  it("argv 원소가 string 이 아니면 TypeError", () => {
    const commandArgs = makeCommandArgs({});
    const argv = buildRealDataDailyStepDualLegRunReportIssueGhArgv(
      CREATE_ACTION,
      commandArgs,
    );
    const broken = [...argv];
    broken[3] = 42 as unknown as string;
    expect(() =>
      assertRealDataDailyStepDualLegRunReportIssueGhArgvPreservesCommandArgs(
        broken,
        CREATE_ACTION,
        commandArgs,
      ),
    ).toThrow(TypeError);
  });

  it("action 이 null 이면 TypeError", () => {
    expect(() =>
      assertRealDataDailyStepDualLegRunReportIssueGhArgvPreservesCommandArgs(
        ["issue", "create"],
        null as unknown as RealDataDailyStepDualLegRunReportIssueAction,
        makeCommandArgs({}),
      ),
    ).toThrow(TypeError);
  });

  it("action.action 이 알 수 없는 값이면 TypeError", () => {
    expect(() =>
      assertRealDataDailyStepDualLegRunReportIssueGhArgvPreservesCommandArgs(
        ["issue", "create"],
        {
          action: "delete",
        } as unknown as RealDataDailyStepDualLegRunReportIssueAction,
        makeCommandArgs({}),
      ),
    ).toThrow(TypeError);
  });

  it("update action 의 issueNumber 가 number 가 아니면 TypeError", () => {
    expect(() =>
      assertRealDataDailyStepDualLegRunReportIssueGhArgvPreservesCommandArgs(
        ["issue", "edit", "x", "--title", "t", "--body", "b"],
        {
          action: "update",
          issueNumber: "42" as unknown as number,
        } as RealDataDailyStepDualLegRunReportIssueAction,
        makeCommandArgs({}),
      ),
    ).toThrow(TypeError);
  });

  it("commandArgs 가 null 이면 TypeError", () => {
    const argv = buildRealDataDailyStepDualLegRunReportIssueGhArgv(
      CREATE_ACTION,
      makeCommandArgs({}),
    );
    expect(() =>
      assertRealDataDailyStepDualLegRunReportIssueGhArgvPreservesCommandArgs(
        argv,
        CREATE_ACTION,
        null as unknown as RealDataDailyStepDualLegRunReportIssueCommandArgs,
      ),
    ).toThrow(TypeError);
  });

  it("commandArgs.createArgs 가 부재하면(create 분기) TypeError", () => {
    const commandArgs = makeCommandArgs({});
    const argv = buildRealDataDailyStepDualLegRunReportIssueGhArgv(
      CREATE_ACTION,
      commandArgs,
    );
    const broken = {
      ...commandArgs,
      createArgs: undefined as unknown as typeof commandArgs.createArgs,
    };
    expect(() =>
      assertRealDataDailyStepDualLegRunReportIssueGhArgvPreservesCommandArgs(
        argv,
        CREATE_ACTION,
        broken,
      ),
    ).toThrow(TypeError);
  });

  it("commandArgs.createArgs.title 이 string 이 아니면 TypeError", () => {
    const commandArgs = makeCommandArgs({});
    const argv = buildRealDataDailyStepDualLegRunReportIssueGhArgv(
      CREATE_ACTION,
      commandArgs,
    );
    const broken = {
      ...commandArgs,
      createArgs: {
        ...commandArgs.createArgs,
        title: 0 as unknown as string,
      },
    };
    expect(() =>
      assertRealDataDailyStepDualLegRunReportIssueGhArgvPreservesCommandArgs(
        argv,
        CREATE_ACTION,
        broken,
      ),
    ).toThrow(TypeError);
  });

  it("commandArgs.createArgs.body 가 string 이 아니면 TypeError", () => {
    const commandArgs = makeCommandArgs({});
    const argv = buildRealDataDailyStepDualLegRunReportIssueGhArgv(
      CREATE_ACTION,
      commandArgs,
    );
    const broken = {
      ...commandArgs,
      createArgs: {
        ...commandArgs.createArgs,
        body: {} as unknown as string,
      },
    };
    expect(() =>
      assertRealDataDailyStepDualLegRunReportIssueGhArgvPreservesCommandArgs(
        argv,
        CREATE_ACTION,
        broken,
      ),
    ).toThrow(TypeError);
  });

  it("commandArgs.createArgs.labels 가 배열이 아니면 TypeError", () => {
    const commandArgs = makeCommandArgs({});
    const argv = buildRealDataDailyStepDualLegRunReportIssueGhArgv(
      CREATE_ACTION,
      commandArgs,
    );
    const broken = {
      ...commandArgs,
      createArgs: {
        ...commandArgs.createArgs,
        labels: "not-array" as unknown as string[],
      },
    };
    expect(() =>
      assertRealDataDailyStepDualLegRunReportIssueGhArgvPreservesCommandArgs(
        argv,
        CREATE_ACTION,
        broken,
      ),
    ).toThrow(TypeError);
  });

  it("commandArgs.createArgs.labels 원소가 string 이 아니면 TypeError", () => {
    const commandArgs = makeCommandArgs({});
    const argv = buildRealDataDailyStepDualLegRunReportIssueGhArgv(
      CREATE_ACTION,
      commandArgs,
    );
    const broken = {
      ...commandArgs,
      createArgs: {
        ...commandArgs.createArgs,
        labels: [1 as unknown as string],
      },
    };
    expect(() =>
      assertRealDataDailyStepDualLegRunReportIssueGhArgvPreservesCommandArgs(
        argv,
        CREATE_ACTION,
        broken,
      ),
    ).toThrow(TypeError);
  });

  it("commandArgs.updateArgs 가 부재하면(update 분기) TypeError", () => {
    const commandArgs = makeCommandArgs({});
    const argv = buildRealDataDailyStepDualLegRunReportIssueGhArgv(
      UPDATE_ACTION,
      commandArgs,
    );
    const broken = {
      ...commandArgs,
      updateArgs: null as unknown as typeof commandArgs.updateArgs,
    };
    expect(() =>
      assertRealDataDailyStepDualLegRunReportIssueGhArgvPreservesCommandArgs(
        argv,
        UPDATE_ACTION,
        broken,
      ),
    ).toThrow(TypeError);
  });

  it("commandArgs.updateArgs.title 이 string 이 아니면 TypeError", () => {
    const commandArgs = makeCommandArgs({});
    const argv = buildRealDataDailyStepDualLegRunReportIssueGhArgv(
      UPDATE_ACTION,
      commandArgs,
    );
    const broken = {
      ...commandArgs,
      updateArgs: {
        ...commandArgs.updateArgs,
        title: null as unknown as string,
      },
    };
    expect(() =>
      assertRealDataDailyStepDualLegRunReportIssueGhArgvPreservesCommandArgs(
        argv,
        UPDATE_ACTION,
        broken,
      ),
    ).toThrow(TypeError);
  });

  it("commandArgs.updateArgs.body 가 string 이 아니면 TypeError", () => {
    const commandArgs = makeCommandArgs({});
    const argv = buildRealDataDailyStepDualLegRunReportIssueGhArgv(
      UPDATE_ACTION,
      commandArgs,
    );
    const broken = {
      ...commandArgs,
      updateArgs: {
        ...commandArgs.updateArgs,
        body: 99 as unknown as string,
      },
    };
    expect(() =>
      assertRealDataDailyStepDualLegRunReportIssueGhArgvPreservesCommandArgs(
        argv,
        UPDATE_ACTION,
        broken,
      ),
    ).toThrow(TypeError);
  });

  // ── 값 정합 위반(RangeError) — 재유도 분기별 drift mutant ─────────────────
  it("① create --title 값이 createArgs.title 과 불일치하면 RangeError(C1)", () => {
    const commandArgs = makeCommandArgs({});
    const argv = buildRealDataDailyStepDualLegRunReportIssueGhArgv(
      CREATE_ACTION,
      commandArgs,
    );
    const broken = [...argv];
    broken[3] = "drift 제목";
    expect(() =>
      assertRealDataDailyStepDualLegRunReportIssueGhArgvPreservesCommandArgs(
        broken,
        CREATE_ACTION,
        commandArgs,
      ),
    ).toThrow(RangeError);
    expect(() =>
      assertRealDataDailyStepDualLegRunReportIssueGhArgvPreservesCommandArgs(
        broken,
        CREATE_ACTION,
        commandArgs,
      ),
    ).toThrow(/불변식\(C1\)/);
  });

  it("② create --body 값이 createArgs.body 와 불일치하면 RangeError(C2)", () => {
    const commandArgs = makeCommandArgs({});
    const argv = buildRealDataDailyStepDualLegRunReportIssueGhArgv(
      CREATE_ACTION,
      commandArgs,
    );
    const broken = [...argv];
    broken[5] = "drift 본문";
    expect(() =>
      assertRealDataDailyStepDualLegRunReportIssueGhArgvPreservesCommandArgs(
        broken,
        CREATE_ACTION,
        commandArgs,
      ),
    ).toThrow(/불변식\(C2\)/);
  });

  it("② create argv 의 title↔body 가 뒤바뀌면 RangeError(C1)", () => {
    // --title flag 자리에 body flag 가 오는 손상(title↔body 뒤바뀜).
    const commandArgs = makeCommandArgs({});
    const broken = [
      "issue",
      "create",
      "--body", // title flag 자리에 body flag
      commandArgs.createArgs.title,
      "--title",
      commandArgs.createArgs.body,
    ];
    expect(() =>
      assertRealDataDailyStepDualLegRunReportIssueGhArgvPreservesCommandArgs(
        broken,
        CREATE_ACTION,
        commandArgs,
      ),
    ).toThrow(/불변식\(C1\)/);
  });

  it("③ labels flag-pair 순서가 바뀌면 RangeError(C3)", () => {
    const commandArgs = makeCommandArgs({ labels: ["a", "b"] });
    const argv = buildRealDataDailyStepDualLegRunReportIssueGhArgv(
      CREATE_ACTION,
      commandArgs,
    );
    // argv: ..., --label, a, --label, b → 값 a 와 b 를 뒤바꿈.
    const broken = [...argv];
    broken[7] = "b";
    broken[9] = "a";
    expect(() =>
      assertRealDataDailyStepDualLegRunReportIssueGhArgvPreservesCommandArgs(
        broken,
        CREATE_ACTION,
        commandArgs,
      ),
    ).toThrow(/불변식\(C3\)/);
  });

  it("③ labels flag-pair 가 누락되면(부분집합) RangeError(C3)", () => {
    const commandArgs = makeCommandArgs({ labels: ["a", "b"] });
    const argv = buildRealDataDailyStepDualLegRunReportIssueGhArgv(
      CREATE_ACTION,
      commandArgs,
    );
    const broken = argv.slice(0, argv.length - 2); // 마지막 label-pair 제거.
    expect(() =>
      assertRealDataDailyStepDualLegRunReportIssueGhArgvPreservesCommandArgs(
        broken,
        CREATE_ACTION,
        commandArgs,
      ),
    ).toThrow(/불변식\(C3\)/);
  });

  it("③ labels flag-pair 가 추가되면(초과집합) RangeError(C3)", () => {
    const commandArgs = makeCommandArgs({ labels: ["a"] });
    const argv = buildRealDataDailyStepDualLegRunReportIssueGhArgv(
      CREATE_ACTION,
      commandArgs,
    );
    const broken = [...argv, "--label", "extra"];
    expect(() =>
      assertRealDataDailyStepDualLegRunReportIssueGhArgvPreservesCommandArgs(
        broken,
        CREATE_ACTION,
        commandArgs,
      ),
    ).toThrow(/불변식\(C3\)/);
  });

  it("③ label flag 가 '--label' 이 아니면 RangeError(C3)", () => {
    const commandArgs = makeCommandArgs({ labels: ["a"] });
    const argv = buildRealDataDailyStepDualLegRunReportIssueGhArgv(
      CREATE_ACTION,
      commandArgs,
    );
    const broken = [...argv];
    broken[6] = "--labels"; // 잘못된 flag.
    expect(() =>
      assertRealDataDailyStepDualLegRunReportIssueGhArgvPreservesCommandArgs(
        broken,
        CREATE_ACTION,
        commandArgs,
      ),
    ).toThrow(/불변식\(C3\)/);
  });

  it("④ update --title 값이 updateArgs.title 과 불일치하면 RangeError(U2)", () => {
    const commandArgs = makeCommandArgs({});
    const argv = buildRealDataDailyStepDualLegRunReportIssueGhArgv(
      UPDATE_ACTION,
      commandArgs,
    );
    const broken = [...argv];
    broken[4] = "drift 제목";
    expect(() =>
      assertRealDataDailyStepDualLegRunReportIssueGhArgvPreservesCommandArgs(
        broken,
        UPDATE_ACTION,
        commandArgs,
      ),
    ).toThrow(/불변식\(U2\)/);
  });

  it("④ update --body 값이 updateArgs.body 와 불일치하면 RangeError(U3)", () => {
    const commandArgs = makeCommandArgs({});
    const argv = buildRealDataDailyStepDualLegRunReportIssueGhArgv(
      UPDATE_ACTION,
      commandArgs,
    );
    const broken = [...argv];
    broken[6] = "drift 본문";
    expect(() =>
      assertRealDataDailyStepDualLegRunReportIssueGhArgvPreservesCommandArgs(
        broken,
        UPDATE_ACTION,
        commandArgs,
      ),
    ).toThrow(/불변식\(U3\)/);
  });

  it("⑤ update issueNumber 문자열이 action.issueNumber 와 불일치하면 RangeError(U1)", () => {
    const commandArgs = makeCommandArgs({});
    const argv = buildRealDataDailyStepDualLegRunReportIssueGhArgv(
      UPDATE_ACTION,
      commandArgs,
    );
    const broken = [...argv];
    broken[2] = "43"; // action.issueNumber 는 42.
    expect(() =>
      assertRealDataDailyStepDualLegRunReportIssueGhArgvPreservesCommandArgs(
        broken,
        UPDATE_ACTION,
        commandArgs,
      ),
    ).toThrow(/불변식\(U1\)/);
  });

  it("⑥ create action 인데 argv 가 'issue edit' 면(동사 불일치) RangeError(C0)", () => {
    const commandArgs = makeCommandArgs({});
    const broken = [
      "issue",
      "edit",
      "--title",
      commandArgs.createArgs.title,
      "--body",
      commandArgs.createArgs.body,
    ];
    expect(() =>
      assertRealDataDailyStepDualLegRunReportIssueGhArgvPreservesCommandArgs(
        broken,
        CREATE_ACTION,
        commandArgs,
      ),
    ).toThrow(/불변식\(C0\)/);
  });

  it("⑥ update action 인데 argv 가 'issue create' 면(동사 불일치) RangeError(U0)", () => {
    const commandArgs = makeCommandArgs({});
    const broken = [
      "issue",
      "create",
      "42",
      "--title",
      commandArgs.updateArgs.title,
      "--body",
      commandArgs.updateArgs.body,
    ];
    expect(() =>
      assertRealDataDailyStepDualLegRunReportIssueGhArgvPreservesCommandArgs(
        broken,
        UPDATE_ACTION,
        commandArgs,
      ),
    ).toThrow(/불변식\(U0\)/);
  });

  it("update argv 에 잉여 원소가 끼면 RangeError(U4)", () => {
    const commandArgs = makeCommandArgs({});
    const argv = buildRealDataDailyStepDualLegRunReportIssueGhArgv(
      UPDATE_ACTION,
      commandArgs,
    );
    const broken = [...argv, "--label", "잉여"];
    expect(() =>
      assertRealDataDailyStepDualLegRunReportIssueGhArgvPreservesCommandArgs(
        broken,
        UPDATE_ACTION,
        commandArgs,
      ),
    ).toThrow(/불변식\(U4\)/);
  });

  it("create argv 의 --title flag 위치 자체가 어긋나면 RangeError(C1 flag)", () => {
    const commandArgs = makeCommandArgs({});
    const broken = ["issue", "create", "--wrong", "t", "--body", "b"];
    expect(() =>
      assertRealDataDailyStepDualLegRunReportIssueGhArgvPreservesCommandArgs(
        broken,
        CREATE_ACTION,
        commandArgs,
      ),
    ).toThrow(/불변식\(C1\)/);
  });

  it("create argv 의 --body flag 위치 자체가 어긋나면 RangeError(C2 flag)", () => {
    const commandArgs = makeCommandArgs({});
    const broken = [
      "issue",
      "create",
      "--title",
      commandArgs.createArgs.title,
      "--wrong",
      "b",
    ];
    expect(() =>
      assertRealDataDailyStepDualLegRunReportIssueGhArgvPreservesCommandArgs(
        broken,
        CREATE_ACTION,
        commandArgs,
      ),
    ).toThrow(/불변식\(C2\)/);
  });

  it("update argv 의 --title flag 위치 자체가 어긋나면 RangeError(U2 flag)", () => {
    const commandArgs = makeCommandArgs({});
    const broken = ["issue", "edit", "42", "--wrong", "t", "--body", "b"];
    expect(() =>
      assertRealDataDailyStepDualLegRunReportIssueGhArgvPreservesCommandArgs(
        broken,
        UPDATE_ACTION,
        commandArgs,
      ),
    ).toThrow(/불변식\(U2\)/);
  });

  it("update argv 의 --body flag 위치 자체가 어긋나면 RangeError(U3 flag)", () => {
    const commandArgs = makeCommandArgs({});
    const broken = [
      "issue",
      "edit",
      "42",
      "--title",
      commandArgs.updateArgs.title,
      "--wrong",
      "b",
    ];
    expect(() =>
      assertRealDataDailyStepDualLegRunReportIssueGhArgvPreservesCommandArgs(
        broken,
        UPDATE_ACTION,
        commandArgs,
      ),
    ).toThrow(/불변식\(U3\)/);
  });

  // ── negative cases 충분 cover ───────────────────────────────────────────
  it("결정성 — 동일 정상 입력 2 회 호출 둘 다 void", () => {
    const commandArgs = makeCommandArgs({});
    const argv = buildRealDataDailyStepDualLegRunReportIssueGhArgv(
      CREATE_ACTION,
      commandArgs,
    );
    expect(() =>
      assertRealDataDailyStepDualLegRunReportIssueGhArgvPreservesCommandArgs(
        argv,
        CREATE_ACTION,
        commandArgs,
      ),
    ).not.toThrow();
    expect(() =>
      assertRealDataDailyStepDualLegRunReportIssueGhArgvPreservesCommandArgs(
        argv,
        CREATE_ACTION,
        commandArgs,
      ),
    ).not.toThrow();
  });

  it("결정성 — 동일 위반 입력 2 회 호출 둘 다 동일 RangeError", () => {
    const commandArgs = makeCommandArgs({});
    const argv = buildRealDataDailyStepDualLegRunReportIssueGhArgv(
      CREATE_ACTION,
      commandArgs,
    );
    const broken = [...argv];
    broken[3] = "drift";
    expect(() =>
      assertRealDataDailyStepDualLegRunReportIssueGhArgvPreservesCommandArgs(
        broken,
        CREATE_ACTION,
        commandArgs,
      ),
    ).toThrow(/불변식\(C1\)/);
    expect(() =>
      assertRealDataDailyStepDualLegRunReportIssueGhArgvPreservesCommandArgs(
        broken,
        CREATE_ACTION,
        commandArgs,
      ),
    ).toThrow(/불변식\(C1\)/);
  });

  it("입력 비변형 — 호출 후 argv/action/commandArgs 객체 불변", () => {
    const commandArgs = makeCommandArgs({});
    const argv = buildRealDataDailyStepDualLegRunReportIssueGhArgv(
      CREATE_ACTION,
      commandArgs,
    );
    const argvBefore = JSON.stringify(argv);
    const actionBefore = JSON.stringify(CREATE_ACTION);
    const commandArgsBefore = JSON.stringify(commandArgs);

    assertRealDataDailyStepDualLegRunReportIssueGhArgvPreservesCommandArgs(
      argv,
      CREATE_ACTION,
      commandArgs,
    );

    expect(JSON.stringify(argv)).toBe(argvBefore);
    expect(JSON.stringify(CREATE_ACTION)).toBe(actionBefore);
    expect(JSON.stringify(commandArgs)).toBe(commandArgsBefore);
  });

  it("빈 labels 경계 — labels 0개면 argv 잔여 0원소에 대해 void", () => {
    const commandArgs = makeCommandArgs({ labels: [] });
    const argv = buildRealDataDailyStepDualLegRunReportIssueGhArgv(
      CREATE_ACTION,
      commandArgs,
    );
    expect(argv.slice(6)).toHaveLength(0);
    expect(() =>
      assertRealDataDailyStepDualLegRunReportIssueGhArgvPreservesCommandArgs(
        argv,
        CREATE_ACTION,
        commandArgs,
      ),
    ).not.toThrow();
  });

  it("빈 labels 경계 — labels 0개인데 argv 에 잉여 --label 이 있으면 RangeError(C3)", () => {
    const commandArgs = makeCommandArgs({ labels: [] });
    const argv = buildRealDataDailyStepDualLegRunReportIssueGhArgv(
      CREATE_ACTION,
      commandArgs,
    );
    const broken = [...argv, "--label", "잉여"];
    expect(() =>
      assertRealDataDailyStepDualLegRunReportIssueGhArgvPreservesCommandArgs(
        broken,
        CREATE_ACTION,
        commandArgs,
      ),
    ).toThrow(/불변식\(C3\)/);
  });

  it("공백 민감 — title 에 후행 공백이 끼면 byte-identical 불일치로 RangeError(C1)", () => {
    const commandArgs = makeCommandArgs({});
    const argv = buildRealDataDailyStepDualLegRunReportIssueGhArgv(
      CREATE_ACTION,
      commandArgs,
    );
    const broken = [...argv];
    broken[3] = `${commandArgs.createArgs.title} `; // 후행 공백.
    expect(() =>
      assertRealDataDailyStepDualLegRunReportIssueGhArgvPreservesCommandArgs(
        broken,
        CREATE_ACTION,
        commandArgs,
      ),
    ).toThrow(/불변식\(C1\)/);
  });

  it("대소문자 민감 — label 대소문자만 달라도 byte-identical 불일치로 RangeError(C3)", () => {
    const commandArgs = makeCommandArgs({ labels: ["Result"] });
    const argv = buildRealDataDailyStepDualLegRunReportIssueGhArgv(
      CREATE_ACTION,
      commandArgs,
    );
    const broken = [...argv];
    broken[7] = "result"; // 소문자.
    expect(() =>
      assertRealDataDailyStepDualLegRunReportIssueGhArgvPreservesCommandArgs(
        broken,
        CREATE_ACTION,
        commandArgs,
      ),
    ).toThrow(/불변식\(C3\)/);
  });

  it("§9 / R-59 — 가드는 argv 의 title/body/label string 만 비교, 비시크릿 더미·raw narrative 미접촉", () => {
    const commandArgs = makeCommandArgs({});
    const argv = buildRealDataDailyStepDualLegRunReportIssueGhArgv(
      CREATE_ACTION,
      commandArgs,
    );
    expect(() =>
      assertRealDataDailyStepDualLegRunReportIssueGhArgvPreservesCommandArgs(
        argv,
        CREATE_ACTION,
        commandArgs,
      ),
    ).not.toThrow();
    // argv 에 raw narrative/credential 류 토큰이 끼어들지 않음(가드가 그런 키를 합성하지 않음).
    expect(argv).not.toContain("narrative");
    expect(argv).not.toContain("rawActivity");
    expect(argv.join(" ")).not.toMatch(/ghp_|github_pat_/);
  });
});
