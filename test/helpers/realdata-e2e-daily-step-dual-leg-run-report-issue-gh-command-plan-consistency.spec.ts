// realdata-e2e-daily-step-dual-leg-run-report-issue-gh-command-plan-consistency.spec.ts
// — T-0994 colocated unit spec (요약축 선례 T-0695 spec mirror).
//
// R-112 cover 구조:
//   - happy-path: (a) 후보 0건 stdout("[]") → create plan 정합 → void,
//     (b) marker 포함 후보 1건 stdout → update plan 정합 → void,
//     (c) 후보 2+ 건 stdout → 최소 number update 멱등 합성 정합 → void. 정상 입력의 양
//     분기(create/update) 모두 통과 확인.
//   - error path(TypeError): plan null/undefined/배열/원시, plan.argv 비-배열,
//     plan.action 분기값 결손, stdout 비-문자열, commandArgs 비-객체 각 1+.
//   - flow/branch: 구조(TypeError) vs 값 정합(RangeError) 분리 + fail-fast 순서(구조 →
//     재유도 helper throw → action 매핑 → issueNumber → argv 길이 → argv 원소).
//   - negative 충분 cover(Acceptance (a)~(f)):
//       (a) action 분기 오매핑(create↔update 뒤바뀜) — 양 방향 각 1+,
//       (b) update issueNumber drift(재유도 최소 number 와 불일치),
//       (c) argv 동사 drift(`issue create`↔`issue edit` 어긋남),
//       (d) argv title/body 위치 drift(재유도 argv 와 byte 불일치),
//       (e) argv label flag-pair 길이/순서 어긋남,
//       (f) argv 잉여/누락 원소(재유도 argv 와 길이 불일치) 각 1+ test.
//   - 위임 helper throw 전파: parse layer(비JSON stdout) / resolveAction layer(빈
//     marker) / buildGhArgv layer(빈 title/body) 각 1+ — 가드가 자체 try/catch 0 으로
//     그대로 전파함을 검증.
//   - 결정론·무공유: 정합 호출이 plan / commandArgs 객체를 mutate 하지 않는다. 동일
//     입력 두 번 호출 → 항상 void / 동일 손상 두 번 호출 → 항상 동일 메시지.
//   - §9 / §12 안전성: 모든 fixture 는 비시크릿 더미 string(실 secret/PAT/credential 미노출).
//   - R-59: argv 가 commandArgs 의 title/body(marker 라인 포함) 만 옮길 뿐 narrative 본문
//     미접촉 — 정합 검증이 본문을 보지 않음을 간접 확인(가드 결과는 void 만).
import type { RealDataDailyStepDualLegRunReportIssueCommandArgs } from "./realdata-e2e-daily-step-dual-leg-run-report-issue-command-args";
import {
  resolveRealDataDailyStepDualLegRunReportIssueGhCommandPlan,
  type RealDataDailyStepDualLegRunReportIssueGhCommandPlan,
} from "./realdata-e2e-daily-step-dual-leg-run-report-issue-gh-command-plan";
import { assertRealDataDailyStepDualLegRunReportIssueGhCommandPlanConsistentWithInputs } from "./realdata-e2e-daily-step-dual-leg-run-report-issue-gh-command-plan-consistency";

// 비시크릿 더미 marker — 실 secret/PAT/credential 아님(§9). daily-step dual-leg run
// report 이슈 본문 상단 marker 라인 모사.
const MARKER =
  "<!-- realdata-e2e-daily-step-dual-leg-run-report: 2026-07-14@def5678 -->";

// 정상 명령-args fixture — 컴포저 spec(T-0902) makeCommandArgs 패턴 차용. labels 는
// dual-leg 축 고정 상수(`["realdata-e2e","daily-step-dual-leg-run-report"]`)와 정합해야
// 재유도 argv 와 byte-identical 하므로 그대로 사용한다.
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
        "실 평가 e2e daily-step dual-leg 2026-07-14@def5678",
      body:
        overrides.createBody ??
        `${MARKER}\n\n## 요약\n- eval leg: pass\n- collect leg: pass`,
      labels: overrides.labels ?? [
        "realdata-e2e",
        "daily-step-dual-leg-run-report",
      ],
    },
    updateArgs: {
      title:
        overrides.updateTitle ??
        "실 평가 e2e daily-step dual-leg 2026-07-14@def5678",
      body:
        overrides.updateBody ??
        `${MARKER}\n\n## 요약\n- eval leg: pass\n- collect leg: pass`,
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

// 정합 plan 합성(happy-path source) — 컴포저 호출. negative 는 그 산출을 의도적으로
// 변형한다.
function buildConsistent(
  stdout: string,
  commandArgs: RealDataDailyStepDualLegRunReportIssueCommandArgs,
): RealDataDailyStepDualLegRunReportIssueGhCommandPlan {
  return resolveRealDataDailyStepDualLegRunReportIssueGhCommandPlan(
    stdout,
    commandArgs,
  );
}

describe("assertRealDataDailyStepDualLegRunReportIssueGhCommandPlanConsistentWithInputs", () => {
  describe("happy path (정합 → void)", () => {
    it("후보 0건 stdout('[]') → create plan 정합 → void(labels 0개 아님 — 고정 2개)", () => {
      const stdout = "[]";
      const commandArgs = makeCommandArgs();
      const plan = buildConsistent(stdout, commandArgs);
      expect(plan.action).toEqual({ action: "create" });
      expect(() =>
        assertRealDataDailyStepDualLegRunReportIssueGhCommandPlanConsistentWithInputs(
          plan,
          stdout,
          commandArgs,
        ),
      ).not.toThrow();
    });

    it("create 분기 labels 1개 → 정합 → void", () => {
      const stdout = "[]";
      const commandArgs = makeCommandArgs({ labels: ["only-one-label"] });
      const plan = buildConsistent(stdout, commandArgs);
      expect(plan.action).toEqual({ action: "create" });
      expect(() =>
        assertRealDataDailyStepDualLegRunReportIssueGhCommandPlanConsistentWithInputs(
          plan,
          stdout,
          commandArgs,
        ),
      ).not.toThrow();
    });

    it("create 분기 labels 다수(3개) → 정합 → void", () => {
      const stdout = "[]";
      const commandArgs = makeCommandArgs({ labels: ["a", "b", "c"] });
      const plan = buildConsistent(stdout, commandArgs);
      expect(() =>
        assertRealDataDailyStepDualLegRunReportIssueGhCommandPlanConsistentWithInputs(
          plan,
          stdout,
          commandArgs,
        ),
      ).not.toThrow();
    });

    it("marker 포함 후보 1건 → update plan 정합 → void(반환값 undefined)", () => {
      const stdout = stdoutOf([{ number: 42 }]);
      const commandArgs = makeCommandArgs();
      const plan = buildConsistent(stdout, commandArgs);
      expect(plan.action).toEqual({ action: "update", issueNumber: 42 });
      expect(
        assertRealDataDailyStepDualLegRunReportIssueGhCommandPlanConsistentWithInputs(
          plan,
          stdout,
          commandArgs,
        ),
      ).toBeUndefined();
    });

    it("후보 2+ 건 → 최소 number update 멱등 합성 정합 → void", () => {
      const stdout = stdoutOf([{ number: 91 }, { number: 7 }, { number: 33 }]);
      const commandArgs = makeCommandArgs();
      const plan = buildConsistent(stdout, commandArgs);
      expect(plan.action).toEqual({ action: "update", issueNumber: 7 });
      expect(() =>
        assertRealDataDailyStepDualLegRunReportIssueGhCommandPlanConsistentWithInputs(
          plan,
          stdout,
          commandArgs,
        ),
      ).not.toThrow();
    });

    it("marker 미포함 hit → create 분기 정합 → void", () => {
      const stdout = stdoutOf([
        { number: 5, body: "marker 없는 무관 이슈 본문" },
      ]);
      const commandArgs = makeCommandArgs();
      const plan = buildConsistent(stdout, commandArgs);
      expect(plan.action).toEqual({ action: "create" });
      expect(() =>
        assertRealDataDailyStepDualLegRunReportIssueGhCommandPlanConsistentWithInputs(
          plan,
          stdout,
          commandArgs,
        ),
      ).not.toThrow();
    });

    it("happy-path round-trip: 컴포저 산출 plan 을 가드가 throw 0 으로 통과(oracle↔producer 배선 일치)", () => {
      const stdout = stdoutOf([{ number: 8 }, { number: 3 }]);
      const commandArgs = makeCommandArgs();
      const plan = buildConsistent(stdout, commandArgs);
      // producer 가 실제로 산출한 plan(action + argv) 을 oracle 이 독립 재유도로 통과시킴.
      expect(() =>
        assertRealDataDailyStepDualLegRunReportIssueGhCommandPlanConsistentWithInputs(
          plan,
          stdout,
          commandArgs,
        ),
      ).not.toThrow();
    });
  });

  describe("error path — 구조 결손(TypeError)", () => {
    it("plan=null → TypeError('null' 라벨)", () => {
      expect(() =>
        assertRealDataDailyStepDualLegRunReportIssueGhCommandPlanConsistentWithInputs(
          null as unknown as RealDataDailyStepDualLegRunReportIssueGhCommandPlan,
          "[]",
          makeCommandArgs(),
        ),
      ).toThrow(/plan 이 객체가 아니다.*null/);
    });

    it("plan=undefined → TypeError('undefined' 라벨)", () => {
      expect(() =>
        assertRealDataDailyStepDualLegRunReportIssueGhCommandPlanConsistentWithInputs(
          undefined as unknown as RealDataDailyStepDualLegRunReportIssueGhCommandPlan,
          "[]",
          makeCommandArgs(),
        ),
      ).toThrow(/plan 이 객체가 아니다.*undefined/);
    });

    it("plan=배열 → TypeError('array' 라벨)", () => {
      expect(() =>
        assertRealDataDailyStepDualLegRunReportIssueGhCommandPlanConsistentWithInputs(
          [] as unknown as RealDataDailyStepDualLegRunReportIssueGhCommandPlan,
          "[]",
          makeCommandArgs(),
        ),
      ).toThrow(/plan 이 객체가 아니다.*array/);
    });

    it("plan=string → TypeError('string' 라벨)", () => {
      expect(() =>
        assertRealDataDailyStepDualLegRunReportIssueGhCommandPlanConsistentWithInputs(
          "not-a-plan" as unknown as RealDataDailyStepDualLegRunReportIssueGhCommandPlan,
          "[]",
          makeCommandArgs(),
        ),
      ).toThrow(/plan 이 객체가 아니다.*string/);
    });

    it("plan.argv=비-배열(객체) → TypeError(plan.argv 라벨)", () => {
      const plan: RealDataDailyStepDualLegRunReportIssueGhCommandPlan = {
        action: { action: "create" },
        argv: {} as unknown as string[],
      };
      expect(() =>
        assertRealDataDailyStepDualLegRunReportIssueGhCommandPlanConsistentWithInputs(
          plan,
          "[]",
          makeCommandArgs(),
        ),
      ).toThrow(/plan\.argv 가 배열이 아니다.*object/);
    });

    it("plan.argv=null → TypeError(plan.argv 라벨)", () => {
      const plan: RealDataDailyStepDualLegRunReportIssueGhCommandPlan = {
        action: { action: "create" },
        argv: null as unknown as string[],
      };
      expect(() =>
        assertRealDataDailyStepDualLegRunReportIssueGhCommandPlanConsistentWithInputs(
          plan,
          "[]",
          makeCommandArgs(),
        ),
      ).toThrow(/plan\.argv 가 배열이 아니다.*null/);
    });

    it("plan.argv 원소 비-string 은 재유도 argv 와 byte 불일치로 RangeError(argv 원소)", () => {
      // plan.argv 자체는 배열이므로 구조 통과, 원소가 number 라 재유도 string 과 불일치.
      const stdout = "[]";
      const commandArgs = makeCommandArgs();
      const correct = buildConsistent(stdout, commandArgs);
      const plan: RealDataDailyStepDualLegRunReportIssueGhCommandPlan = {
        action: correct.action,
        argv: [...correct.argv],
      };
      (plan.argv as unknown[])[3] = 12345; // --title 값 자리를 number 로 변조
      expect(() =>
        assertRealDataDailyStepDualLegRunReportIssueGhCommandPlanConsistentWithInputs(
          plan,
          stdout,
          commandArgs,
        ),
      ).toThrow(/plan\.argv\[3\] 가 재유도 argv 와 byte-identical 하지 않다/);
    });

    it("plan.action.action 분기값 결손('delete') → TypeError(enum)", () => {
      const plan = {
        action: { action: "delete" } as unknown as { action: "create" },
        argv: ["issue", "create"],
      } as RealDataDailyStepDualLegRunReportIssueGhCommandPlan;
      expect(() =>
        assertRealDataDailyStepDualLegRunReportIssueGhCommandPlanConsistentWithInputs(
          plan,
          "[]",
          makeCommandArgs(),
        ),
      ).toThrow(/plan\.action\.action 이 'create'\|'update' 외 값이다.*delete/);
    });

    it("plan.action=null → TypeError(plan.action 라벨)", () => {
      const plan = {
        action: null as unknown as { action: "create" },
        argv: ["issue", "create"],
      } as RealDataDailyStepDualLegRunReportIssueGhCommandPlan;
      expect(() =>
        assertRealDataDailyStepDualLegRunReportIssueGhCommandPlanConsistentWithInputs(
          plan,
          "[]",
          makeCommandArgs(),
        ),
      ).toThrow(/plan\.action 이 객체가 아니다.*null/);
    });

    it("stdout=null → TypeError(stdout 라벨)", () => {
      const plan = buildConsistent("[]", makeCommandArgs());
      expect(() =>
        assertRealDataDailyStepDualLegRunReportIssueGhCommandPlanConsistentWithInputs(
          plan,
          null as unknown as string,
          makeCommandArgs(),
        ),
      ).toThrow(/stdout 이 문자열이 아니다.*null/);
    });

    it("stdout=number → TypeError(stdout 라벨)", () => {
      const plan = buildConsistent("[]", makeCommandArgs());
      expect(() =>
        assertRealDataDailyStepDualLegRunReportIssueGhCommandPlanConsistentWithInputs(
          plan,
          42 as unknown as string,
          makeCommandArgs(),
        ),
      ).toThrow(/stdout 이 문자열이 아니다.*number/);
    });

    it("commandArgs=null → TypeError(commandArgs 라벨)", () => {
      const plan = buildConsistent("[]", makeCommandArgs());
      expect(() =>
        assertRealDataDailyStepDualLegRunReportIssueGhCommandPlanConsistentWithInputs(
          plan,
          "[]",
          null as unknown as RealDataDailyStepDualLegRunReportIssueCommandArgs,
        ),
      ).toThrow(/commandArgs 가 객체가 아니다.*null/);
    });

    it("commandArgs=배열 → TypeError(commandArgs 라벨)", () => {
      const plan = buildConsistent("[]", makeCommandArgs());
      expect(() =>
        assertRealDataDailyStepDualLegRunReportIssueGhCommandPlanConsistentWithInputs(
          plan,
          "[]",
          [] as unknown as RealDataDailyStepDualLegRunReportIssueCommandArgs,
        ),
      ).toThrow(/commandArgs 가 객체가 아니다.*array/);
    });
  });

  describe("flow / branch — fail-fast 순서(구조 → 재유도 → 매핑 → argv)", () => {
    it("값 정합 위반(action 매핑)은 RangeError 이고 TypeError 가 아니다", () => {
      // stdout 후보 0건(재유도=create)인데 plan 이 update 라 매핑 위반.
      const commandArgs = makeCommandArgs();
      const plan: RealDataDailyStepDualLegRunReportIssueGhCommandPlan = {
        action: { action: "update", issueNumber: 7 },
        argv: ["issue", "edit", "7", "--title", "x", "--body", "y"],
      };
      expect(() =>
        assertRealDataDailyStepDualLegRunReportIssueGhCommandPlanConsistentWithInputs(
          plan,
          "[]",
          commandArgs,
        ),
      ).toThrow(RangeError);
    });

    it("create 분기 정합 통과 + create 분기 drift throw(분기별 분리)", () => {
      const stdout = "[]"; // 재유도 create
      const commandArgs = makeCommandArgs();
      const ok = buildConsistent(stdout, commandArgs);
      expect(() =>
        assertRealDataDailyStepDualLegRunReportIssueGhCommandPlanConsistentWithInputs(
          ok,
          stdout,
          commandArgs,
        ),
      ).not.toThrow();
      // 같은 create 분기에서 argv drift → RangeError.
      const bad: RealDataDailyStepDualLegRunReportIssueGhCommandPlan = {
        action: ok.action,
        argv: [...ok.argv],
      };
      bad.argv[1] = "edit";
      expect(() =>
        assertRealDataDailyStepDualLegRunReportIssueGhCommandPlanConsistentWithInputs(
          bad,
          stdout,
          commandArgs,
        ),
      ).toThrow(RangeError);
    });

    it("update 분기 정합 통과 + update 분기 drift throw(분기별 분리)", () => {
      const stdout = stdoutOf([{ number: 42 }]); // 재유도 update
      const commandArgs = makeCommandArgs();
      const ok = buildConsistent(stdout, commandArgs);
      expect(() =>
        assertRealDataDailyStepDualLegRunReportIssueGhCommandPlanConsistentWithInputs(
          ok,
          stdout,
          commandArgs,
        ),
      ).not.toThrow();
      const bad: RealDataDailyStepDualLegRunReportIssueGhCommandPlan = {
        action: ok.action,
        argv: [...ok.argv],
      };
      bad.argv[2] = "999"; // issueNumber 문자열 drift
      expect(() =>
        assertRealDataDailyStepDualLegRunReportIssueGhCommandPlanConsistentWithInputs(
          bad,
          stdout,
          commandArgs,
        ),
      ).toThrow(RangeError);
    });

    it("재유도 throw(parse layer) 가 매핑 검증보다 먼저(가드 자체 try/catch 0)", () => {
      // 비JSON stdout → parse 가 throw 하므로 매핑 검증까지 안 간다.
      const plan: RealDataDailyStepDualLegRunReportIssueGhCommandPlan = {
        action: { action: "create" },
        argv: ["issue", "create"],
      };
      expect(() =>
        assertRealDataDailyStepDualLegRunReportIssueGhCommandPlanConsistentWithInputs(
          plan,
          "not json",
          makeCommandArgs(),
        ),
      ).toThrow();
    });
  });

  describe("negative 충분 cover — 분기마다(Acceptance (a)~(f))", () => {
    // (a-1) action 분기 오매핑: 재유도=create 인데 plan 이 update
    it('(a-1) 재유도=create 인데 plan.action="update" → RangeError(분기)', () => {
      const stdout = "[]";
      const commandArgs = makeCommandArgs();
      const plan: RealDataDailyStepDualLegRunReportIssueGhCommandPlan = {
        action: { action: "update", issueNumber: 1 },
        argv: ["issue", "edit", "1", "--title", "x", "--body", "y"],
      };
      expect(() =>
        assertRealDataDailyStepDualLegRunReportIssueGhCommandPlanConsistentWithInputs(
          plan,
          stdout,
          commandArgs,
        ),
      ).toThrow(/plan\.action\.action 이 재유도 action 과 분기가 어긋난다/);
      expect(() =>
        assertRealDataDailyStepDualLegRunReportIssueGhCommandPlanConsistentWithInputs(
          plan,
          stdout,
          commandArgs,
        ),
      ).toThrow(/기대=.*create.*실측=.*update/);
    });

    // (a-2) action 분기 오매핑: 재유도=update 인데 plan 이 create
    it('(a-2) 재유도=update 인데 plan.action="create" → RangeError(분기)', () => {
      const stdout = stdoutOf([{ number: 42 }]);
      const commandArgs = makeCommandArgs();
      const plan: RealDataDailyStepDualLegRunReportIssueGhCommandPlan = {
        action: { action: "create" },
        argv: [
          "issue",
          "create",
          "--title",
          commandArgs.createArgs.title,
          "--body",
          commandArgs.createArgs.body,
          "--label",
          "realdata-e2e",
          "--label",
          "daily-step-dual-leg-run-report",
        ],
      };
      expect(() =>
        assertRealDataDailyStepDualLegRunReportIssueGhCommandPlanConsistentWithInputs(
          plan,
          stdout,
          commandArgs,
        ),
      ).toThrow(/기대=.*update.*실측=.*create/);
    });

    // (b) update issueNumber drift: 재유도 최소 number(7) 와 plan 의 issueNumber(91) 불일치
    it("(b) update issueNumber drift(재유도 최소=7, plan=91) → RangeError(번호)", () => {
      const stdout = stdoutOf([{ number: 91 }, { number: 7 }, { number: 33 }]);
      const commandArgs = makeCommandArgs();
      // issueNumber 만 91 로 변조하고 argv 도 일치시켜 매핑/길이는 통과, issueNumber drift 만 catch.
      const plan: RealDataDailyStepDualLegRunReportIssueGhCommandPlan = {
        action: { action: "update", issueNumber: 91 },
        argv: [
          "issue",
          "edit",
          "91",
          "--title",
          commandArgs.updateArgs.title,
          "--body",
          commandArgs.updateArgs.body,
        ],
      };
      expect(() =>
        assertRealDataDailyStepDualLegRunReportIssueGhCommandPlanConsistentWithInputs(
          plan,
          stdout,
          commandArgs,
        ),
      ).toThrow(
        /plan\.action\.issueNumber 가 재유도 최소 number 와 다르다.*기대=7.*실측=91/,
      );
    });

    // (c) argv 동사 drift: create 인데 argv[1]="edit"
    it("(c) argv 동사 drift(create 인데 argv[1]='edit') → RangeError(argv[1])", () => {
      const stdout = "[]";
      const commandArgs = makeCommandArgs();
      const correct = buildConsistent(stdout, commandArgs);
      const plan: RealDataDailyStepDualLegRunReportIssueGhCommandPlan = {
        action: correct.action,
        argv: [...correct.argv],
      };
      plan.argv[1] = "edit";
      expect(() =>
        assertRealDataDailyStepDualLegRunReportIssueGhCommandPlanConsistentWithInputs(
          plan,
          stdout,
          commandArgs,
        ),
      ).toThrow(/plan\.argv\[1\] 가 재유도 argv 와 byte-identical 하지 않다/);
      expect(() =>
        assertRealDataDailyStepDualLegRunReportIssueGhCommandPlanConsistentWithInputs(
          plan,
          stdout,
          commandArgs,
        ),
      ).toThrow(/기대=.*create.*실측=.*edit/);
    });

    // (d) argv title/body 위치 drift: --title 값과 --body 값 swap
    it("(d) argv title/body 위치 drift(title↔body swap) → RangeError(원소 어긋남)", () => {
      const stdout = "[]";
      const commandArgs = makeCommandArgs();
      const correct = buildConsistent(stdout, commandArgs);
      const plan: RealDataDailyStepDualLegRunReportIssueGhCommandPlan = {
        action: correct.action,
        argv: [...correct.argv],
      };
      const titleValue = plan.argv[3];
      const bodyValue = plan.argv[5];
      plan.argv[3] = bodyValue;
      plan.argv[5] = titleValue;
      expect(() =>
        assertRealDataDailyStepDualLegRunReportIssueGhCommandPlanConsistentWithInputs(
          plan,
          stdout,
          commandArgs,
        ),
      ).toThrow(/plan\.argv\[3\] 가 재유도 argv 와 byte-identical 하지 않다/);
    });

    // (e-1) argv label flag-pair 순서 어긋남 (labels 값 swap)
    it("(e-1) argv label flag-pair 순서 어긋남(swap) → RangeError(원소 어긋남)", () => {
      const stdout = "[]";
      const commandArgs = makeCommandArgs(); // labels 2개
      const correct = buildConsistent(stdout, commandArgs);
      const plan: RealDataDailyStepDualLegRunReportIssueGhCommandPlan = {
        action: correct.action,
        argv: [...correct.argv],
      };
      const i0 = plan.argv.length - 3; // labels[0] 값 위치
      const i1 = plan.argv.length - 1; // labels[1] 값 위치
      const tmp = plan.argv[i0];
      plan.argv[i0] = plan.argv[i1];
      plan.argv[i1] = tmp;
      expect(() =>
        assertRealDataDailyStepDualLegRunReportIssueGhCommandPlanConsistentWithInputs(
          plan,
          stdout,
          commandArgs,
        ),
      ).toThrow(/plan\.argv\[\d+\] 가 재유도 argv 와 byte-identical 하지 않다/);
    });

    // (e-2) argv label flag-pair 길이 어긋남(--label 하나 누락 — 마지막 2 원소 제거)
    it("(e-2) argv label flag-pair 길이 어긋남(pair 누락) → RangeError(길이 불일치)", () => {
      const stdout = "[]";
      const commandArgs = makeCommandArgs();
      const correct = buildConsistent(stdout, commandArgs);
      const plan: RealDataDailyStepDualLegRunReportIssueGhCommandPlan = {
        action: correct.action,
        argv: correct.argv.slice(0, correct.argv.length - 2), // 마지막 pair 누락
      };
      expect(() =>
        assertRealDataDailyStepDualLegRunReportIssueGhCommandPlanConsistentWithInputs(
          plan,
          stdout,
          commandArgs,
        ),
      ).toThrow(
        new RegExp(
          `plan\\.argv 길이가 재유도 argv 와 다르다.*기대=${correct.argv.length}.*실측=${correct.argv.length - 2}`,
        ),
      );
    });

    // (f-1) argv 잉여 원소 (재유도 argv 보다 길이 +1)
    it("(f-1) argv 잉여 원소(길이 +1) → RangeError(길이 불일치)", () => {
      const stdout = "[]";
      const commandArgs = makeCommandArgs();
      const correct = buildConsistent(stdout, commandArgs);
      const plan: RealDataDailyStepDualLegRunReportIssueGhCommandPlan = {
        action: correct.action,
        argv: [...correct.argv, "--extra"],
      };
      expect(() =>
        assertRealDataDailyStepDualLegRunReportIssueGhCommandPlanConsistentWithInputs(
          plan,
          stdout,
          commandArgs,
        ),
      ).toThrow(
        new RegExp(
          `plan\\.argv 길이가 재유도 argv 와 다르다.*기대=${correct.argv.length}.*실측=${correct.argv.length + 1}`,
        ),
      );
    });

    // (f-2) argv 누락 원소 (update 분기에서 --body 값 제거 → 길이 -1)
    it("(f-2) argv 누락 원소(update --body 값 잘림) → RangeError(길이 불일치)", () => {
      const stdout = stdoutOf([{ number: 42 }]);
      const commandArgs = makeCommandArgs();
      const correct = buildConsistent(stdout, commandArgs); // 길이 7
      const plan: RealDataDailyStepDualLegRunReportIssueGhCommandPlan = {
        action: correct.action,
        argv: correct.argv.slice(0, correct.argv.length - 1), // 길이 6
      };
      expect(() =>
        assertRealDataDailyStepDualLegRunReportIssueGhCommandPlanConsistentWithInputs(
          plan,
          stdout,
          commandArgs,
        ),
      ).toThrow(/plan\.argv 길이가 재유도 argv 와 다르다.*기대=7.*실측=6/);
    });
  });

  describe("위임 helper throw 전파(가드 자체 try/catch 0)", () => {
    it("(parse layer) 비JSON stdout → 파서 throw 그대로 전파", () => {
      const plan: RealDataDailyStepDualLegRunReportIssueGhCommandPlan = {
        action: { action: "create" },
        argv: ["issue", "create"],
      };
      expect(() =>
        assertRealDataDailyStepDualLegRunReportIssueGhCommandPlanConsistentWithInputs(
          plan,
          "not json",
          makeCommandArgs(),
        ),
      ).toThrow();
    });

    it("(parse layer) 비배열 JSON object stdout → 파서 throw 전파", () => {
      const plan: RealDataDailyStepDualLegRunReportIssueGhCommandPlan = {
        action: { action: "create" },
        argv: ["issue", "create"],
      };
      expect(() =>
        assertRealDataDailyStepDualLegRunReportIssueGhCommandPlanConsistentWithInputs(
          plan,
          '{"number":1}',
          makeCommandArgs(),
        ),
      ).toThrow();
    });

    it("(resolveAction layer) 빈 searchQuery → resolver throw 전파", () => {
      const plan: RealDataDailyStepDualLegRunReportIssueGhCommandPlan = {
        action: { action: "create" },
        argv: ["issue", "create"],
      };
      expect(() =>
        assertRealDataDailyStepDualLegRunReportIssueGhCommandPlanConsistentWithInputs(
          plan,
          "[]",
          makeCommandArgs({ searchQuery: "" }),
        ),
      ).toThrow(/marker 가 비어있습니다/);
    });

    it("(resolveAction layer) 공백-only searchQuery → resolver throw 전파", () => {
      const plan: RealDataDailyStepDualLegRunReportIssueGhCommandPlan = {
        action: { action: "create" },
        argv: ["issue", "create"],
      };
      expect(() =>
        assertRealDataDailyStepDualLegRunReportIssueGhCommandPlanConsistentWithInputs(
          plan,
          "[]",
          makeCommandArgs({ searchQuery: "   " }),
        ),
      ).toThrow(/marker 가 비어있습니다/);
    });

    it("(buildGhArgv layer) create 분기 createArgs.title 빈 → 빌더 throw 전파", () => {
      const plan: RealDataDailyStepDualLegRunReportIssueGhCommandPlan = {
        action: { action: "create" },
        argv: ["issue", "create"],
      };
      expect(() =>
        assertRealDataDailyStepDualLegRunReportIssueGhCommandPlanConsistentWithInputs(
          plan,
          "[]",
          makeCommandArgs({ createTitle: "" }),
        ),
      ).toThrow(/createArgs\.title 가 비어있습니다/);
    });
  });

  describe("비변형 / 순수성 (입력 mutate 0)", () => {
    it("정합 호출이 plan / commandArgs / stdout 을 변형하지 않는다(create 분기)", () => {
      const stdout = "[]";
      const commandArgs = makeCommandArgs();
      const argsSnapshot = JSON.parse(JSON.stringify(commandArgs));
      const plan = buildConsistent(stdout, commandArgs);
      const planSnapshot = JSON.parse(JSON.stringify(plan));
      const argvRefBefore = plan.argv;
      assertRealDataDailyStepDualLegRunReportIssueGhCommandPlanConsistentWithInputs(
        plan,
        stdout,
        commandArgs,
      );
      expect(plan).toEqual(planSnapshot);
      expect(plan.argv).toBe(argvRefBefore);
      expect(commandArgs).toEqual(argsSnapshot);
      expect(stdout).toBe("[]");
    });

    it("정합 호출이 plan / commandArgs / stdout 을 변형하지 않는다(update 분기)", () => {
      const stdout = stdoutOf([{ number: 42 }]);
      const commandArgs = makeCommandArgs();
      const argsSnapshot = JSON.parse(JSON.stringify(commandArgs));
      const plan = buildConsistent(stdout, commandArgs);
      const planSnapshot = JSON.parse(JSON.stringify(plan));
      assertRealDataDailyStepDualLegRunReportIssueGhCommandPlanConsistentWithInputs(
        plan,
        stdout,
        commandArgs,
      );
      expect(plan).toEqual(planSnapshot);
      expect(commandArgs).toEqual(argsSnapshot);
    });
  });

  describe("결정론(동일 입력 → 동일 동작)", () => {
    it("정합 plan 을 두 번 검증해도 항상 void", () => {
      const stdout = stdoutOf([{ number: 12 }]);
      const commandArgs = makeCommandArgs();
      const plan = buildConsistent(stdout, commandArgs);
      expect(() => {
        assertRealDataDailyStepDualLegRunReportIssueGhCommandPlanConsistentWithInputs(
          plan,
          stdout,
          commandArgs,
        );
        assertRealDataDailyStepDualLegRunReportIssueGhCommandPlanConsistentWithInputs(
          plan,
          stdout,
          commandArgs,
        );
      }).not.toThrow();
    });

    it("동일 손상 plan 을 두 번 검증해도 항상 동일 메시지로 throw", () => {
      const stdout = "[]";
      const commandArgs = makeCommandArgs();
      const plan: RealDataDailyStepDualLegRunReportIssueGhCommandPlan = {
        action: { action: "update", issueNumber: 1 },
        argv: ["issue", "edit", "1", "--title", "x", "--body", "y"],
      };
      const collect = (): string => {
        try {
          assertRealDataDailyStepDualLegRunReportIssueGhCommandPlanConsistentWithInputs(
            plan,
            stdout,
            commandArgs,
          );
          return "VOID";
        } catch (e) {
          return (e as Error).message;
        }
      };
      expect(collect()).toBe(collect());
    });
  });
});
