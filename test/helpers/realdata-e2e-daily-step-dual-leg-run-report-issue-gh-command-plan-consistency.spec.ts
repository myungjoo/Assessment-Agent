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
// T-1060 순서-lock 용 namespace import(actionModule/ghArgvModule/searchParseModule) — guard
// 재유도가 호출하는 3 delegate 를 namespace 로 잡아 jest.spyOn 배선(정합-경로 상대 호출
// 순서·데이터-의존 reference 계측). import/order 규칙에 맞춰 경로 알파벳 순 배치.
import * as actionModule from "./realdata-e2e-daily-step-dual-leg-run-report-issue-action";
import type { RealDataDailyStepDualLegRunReportIssueCommandArgs } from "./realdata-e2e-daily-step-dual-leg-run-report-issue-command-args";
import * as ghArgvModule from "./realdata-e2e-daily-step-dual-leg-run-report-issue-gh-argv";
import {
  resolveRealDataDailyStepDualLegRunReportIssueGhCommandPlan,
  type RealDataDailyStepDualLegRunReportIssueGhCommandPlan,
} from "./realdata-e2e-daily-step-dual-leg-run-report-issue-gh-command-plan";
import { assertRealDataDailyStepDualLegRunReportIssueGhCommandPlanConsistentWithInputs } from "./realdata-e2e-daily-step-dual-leg-run-report-issue-gh-command-plan-consistency";
import * as searchParseModule from "./realdata-e2e-daily-step-dual-leg-run-report-issue-search-parse";

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
  // T-1060 spy 격리 — 순서-lock describe 의 jest.spyOn 이 후속 test 로 새지 않도록
  // 매 test 후 원 구현 복원(없으면 pass-through/throw spy 가 다른 test 를 오염).
  afterEach(() => {
    jest.restoreAllMocks();
  });

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

  // T-1060 — consistency-guard 재유도 위임 순서-lock leg 7(daily-step-dual-leg gh-command-plan
  // 3-stage 변형). guard(`assert…GhCommandPlanConsistentWithInputs`)는 3 distinct builder 를
  // 데이터-의존 chain(2 order-edge)으로 재유도한다: parse(builder ①, stdout → hits) →
  // resolveAction(builder ②, hits + searchQuery → action) → buildGhArgv(builder ③, action +
  // commandArgs → argv). builder ②가 builder ① 산출 hits 를, builder ③이 builder ② 산출
  // action 을 각 첫 인자로 소비하므로 반드시 parse → resolveAction → buildGhArgv 순으로 완료돼야
  // 한다. 현행 spec 은 세 재유도를 실 입력 throw 로만 검증(spec invocationCallOrder=0)해, guard
  // 본문에서 세 재유도를 재정렬하거나 어느 builder 인자를 앞 산출이 아닌 값으로 바꿔도(deep-equal
  // 은 순서-무관) 검출 못 한다. T-1054~T-1059 의 2-builder 순서-lock 선례를 3-builder chain(edge
  // 2개·reference-페어링 2개)으로 확장해 그 gap 을 봉한다.
  //
  // R-112 cover 구조(순서-lock):
  //   - happy-path/flow: 정합 plan 을 spy 설치 前 미리 만든 뒤(buildConsistent 자체가 컴포저
  //     chain 을 돌려 세 delegate 를 호출하므로 spy 설치 후 만들면 호출 횟수 오염 — guard 재유도만
  //     격리 계측) 세 위임을 실 구현 pass-through spy 로 감싸고 guard 재유도 1회 트리거 →
  //     parse < resolveAction < buildGhArgv 두 invocationCallOrder 부등식(edge 2개·toBeLessThan)
  //     + 각 정확히 1회 + resolveAction 첫 인자 === parse 반환값 + buildGhArgv 첫 인자 ===
  //     resolveAction 반환값(데이터-의존 reference 페어링 2개).
  //   - branch/무공유 재확인: pass-through spy 하에서도 guard 가 정상 void 반환 + 입력
  //     plan/stdout/commandArgs mutate 0(read-only guard).
  //   - error/negative(a fail-fast edge 1): parse 위임 강제 throw → resolveAction·buildGhArgv
  //     미도달(각 0회) — 첫 stage throw 가 뒤 두 stage 도달 전에 선전파.
  //   - error/negative(b fail-fast edge 2): resolveAction 위임 강제 throw → parse 는 이미 1회·
  //     buildGhArgv 미도달(0회) — 둘째 stage throw 가 셋째 stage 도달 전에 선전파.
  //   - error/negative(c 종단 throw 순서 재확인): buildGhArgv 위임 강제 throw → parse·
  //     resolveAction 은 이미 각 1회(순서 상 두 앞 stage 가 buildGhArgv 보다 먼저 평가됨을
  //     negative 경로에서도 재확인).
  describe("T-1060 — 재유도 위임 순서-lock(parse → resolveAction → buildGhArgv)", () => {
    it("정합 재유도 시 parse < resolveAction < buildGhArgv 순으로 호출된다(invocationCallOrder 부등식 2개·데이터-의존 reference 2개·각 1회)", () => {
      // plan 은 spy 설치 前 합성 — buildConsistent 도 세 delegate 를 호출하므로 spy 설치 후 만들면
      // 호출 횟수가 오염된다. guard 재유도 호출만 격리 계측한다.
      const stdout = "[]";
      const commandArgs = makeCommandArgs();
      const plan = buildConsistent(stdout, commandArgs);
      const parseSpy = jest.spyOn(
        searchParseModule,
        "parseRealDataDailyStepDualLegRunReportIssueSearchOutput",
      );
      const actionSpy = jest.spyOn(
        actionModule,
        "resolveRealDataDailyStepDualLegRunReportIssueAction",
      );
      const ghArgvSpy = jest.spyOn(
        ghArgvModule,
        "buildRealDataDailyStepDualLegRunReportIssueGhArgv",
      );

      assertRealDataDailyStepDualLegRunReportIssueGhCommandPlanConsistentWithInputs(
        plan,
        stdout,
        commandArgs,
      );

      // guard 재유도 지점 각 1개 → 각 위임 정확히 1회.
      expect(parseSpy).toHaveBeenCalledTimes(1);
      expect(actionSpy).toHaveBeenCalledTimes(1);
      expect(ghArgvSpy).toHaveBeenCalledTimes(1);
      // 순서 edge 2개: parse(첫 호출) < resolveAction(첫 호출) < buildGhArgv(첫 호출).
      expect(parseSpy.mock.invocationCallOrder[0]).toBeLessThan(
        actionSpy.mock.invocationCallOrder[0],
      );
      expect(actionSpy.mock.invocationCallOrder[0]).toBeLessThan(
        ghArgvSpy.mock.invocationCallOrder[0],
      );
      // 데이터-의존 reference 페어링 2개:
      // (i) resolveAction 첫 인자 === parse 반환값(hits 배열) — builder ②가 builder ① 산출 소비.
      const producedHits = parseSpy.mock.results[0].value;
      expect(actionSpy.mock.calls[0][0]).toBe(producedHits);
      // (ii) buildGhArgv 첫 인자 === resolveAction 반환값(action 객체) — builder ③이 builder ②
      // 산출 소비.
      const producedAction = actionSpy.mock.results[0].value;
      expect(ghArgvSpy.mock.calls[0][0]).toBe(producedAction);
    });

    it("(branch/무공유 재확인) pass-through spy 하에서도 guard 가 void 반환 + plan/stdout/commandArgs mutate 0", () => {
      const stdout = stdoutOf([{ number: 42 }]);
      const commandArgs = makeCommandArgs();
      const plan = buildConsistent(stdout, commandArgs);
      const planSnapshot = JSON.stringify(plan);
      const argsSnapshot = JSON.stringify(commandArgs);
      jest.spyOn(
        searchParseModule,
        "parseRealDataDailyStepDualLegRunReportIssueSearchOutput",
      );
      jest.spyOn(
        actionModule,
        "resolveRealDataDailyStepDualLegRunReportIssueAction",
      );
      jest.spyOn(
        ghArgvModule,
        "buildRealDataDailyStepDualLegRunReportIssueGhArgv",
      );

      // 정합 경로 → 정상 void(throw 0).
      expect(
        assertRealDataDailyStepDualLegRunReportIssueGhCommandPlanConsistentWithInputs(
          plan,
          stdout,
          commandArgs,
        ),
      ).toBeUndefined();
      // read-only guard — 입력 mutate 0.
      expect(JSON.stringify(plan)).toBe(planSnapshot);
      expect(JSON.stringify(commandArgs)).toBe(argsSnapshot);
      expect(stdout).toBe(stdoutOf([{ number: 42 }]));
    });

    it("(a fail-fast edge 1) parse 위임이 throw 하면 resolveAction·buildGhArgv 에 도달하지 못한다(각 0회)", () => {
      const stdout = "[]";
      const commandArgs = makeCommandArgs();
      const plan = buildConsistent(stdout, commandArgs);
      jest
        .spyOn(
          searchParseModule,
          "parseRealDataDailyStepDualLegRunReportIssueSearchOutput",
        )
        .mockImplementation(() => {
          throw new Error("parse-boom");
        });
      const actionSpy = jest.spyOn(
        actionModule,
        "resolveRealDataDailyStepDualLegRunReportIssueAction",
      );
      const ghArgvSpy = jest.spyOn(
        ghArgvModule,
        "buildRealDataDailyStepDualLegRunReportIssueGhArgv",
      );

      expect(() =>
        assertRealDataDailyStepDualLegRunReportIssueGhCommandPlanConsistentWithInputs(
          plan,
          stdout,
          commandArgs,
        ),
      ).toThrow(/parse-boom/);

      // 첫 stage throw 가 뒤 두 stage 도달 전 선전파 → 둘 다 미호출.
      expect(actionSpy).toHaveBeenCalledTimes(0);
      expect(ghArgvSpy).toHaveBeenCalledTimes(0);
    });

    it("(b fail-fast edge 2) resolveAction 위임이 throw 하면 parse 는 이미 1회·buildGhArgv 미도달(0회)", () => {
      const stdout = "[]";
      const commandArgs = makeCommandArgs();
      const plan = buildConsistent(stdout, commandArgs);
      const parseSpy = jest.spyOn(
        searchParseModule,
        "parseRealDataDailyStepDualLegRunReportIssueSearchOutput",
      );
      jest
        .spyOn(
          actionModule,
          "resolveRealDataDailyStepDualLegRunReportIssueAction",
        )
        .mockImplementation(() => {
          throw new Error("action-boom");
        });
      const ghArgvSpy = jest.spyOn(
        ghArgvModule,
        "buildRealDataDailyStepDualLegRunReportIssueGhArgv",
      );

      expect(() =>
        assertRealDataDailyStepDualLegRunReportIssueGhCommandPlanConsistentWithInputs(
          plan,
          stdout,
          commandArgs,
        ),
      ).toThrow(/action-boom/);

      // parse 는 resolveAction 앞 stage 라 이미 1회 호출됨. buildGhArgv 는 둘째 stage throw 로
      // 도달 전 선전파 → 0회.
      expect(parseSpy).toHaveBeenCalledTimes(1);
      expect(ghArgvSpy).toHaveBeenCalledTimes(0);
    });

    it("(c 종단 throw 순서 재확인) buildGhArgv 위임이 throw 하면 parse·resolveAction 은 이미 각 1회 호출됨", () => {
      const stdout = "[]";
      const commandArgs = makeCommandArgs();
      const plan = buildConsistent(stdout, commandArgs);
      const parseSpy = jest.spyOn(
        searchParseModule,
        "parseRealDataDailyStepDualLegRunReportIssueSearchOutput",
      );
      const actionSpy = jest.spyOn(
        actionModule,
        "resolveRealDataDailyStepDualLegRunReportIssueAction",
      );
      const ghArgvSpy = jest
        .spyOn(
          ghArgvModule,
          "buildRealDataDailyStepDualLegRunReportIssueGhArgv",
        )
        .mockImplementation(() => {
          throw new Error("ghargv-boom");
        });

      // 정합 입력으로 앞 두 재유도는 통과하고 셋째 재유도가 throw.
      expect(() =>
        assertRealDataDailyStepDualLegRunReportIssueGhCommandPlanConsistentWithInputs(
          plan,
          stdout,
          commandArgs,
        ),
      ).toThrow(/ghargv-boom/);

      // 순서 상 parse·resolveAction 이 buildGhArgv 보다 먼저 평가됨 — buildGhArgv 재유도 throw
      // 시점에 두 앞 stage 는 이미 각 1회 호출됐고 buildGhArgv 도 1회 진입(그 안의 강제 throw).
      expect(parseSpy).toHaveBeenCalledTimes(1);
      expect(actionSpy).toHaveBeenCalledTimes(1);
      expect(ghArgvSpy).toHaveBeenCalledTimes(1);
      expect(parseSpy.mock.invocationCallOrder[0]).toBeLessThan(
        actionSpy.mock.invocationCallOrder[0],
      );
      expect(actionSpy.mock.invocationCallOrder[0]).toBeLessThan(
        ghArgvSpy.mock.invocationCallOrder[0],
      );
    });
  });

  describe("T-1076 — 구조-검사 선행성 order-lock(구조 결손 → parse·resolveAction·buildGhArgv 각 0-call)", () => {
    // 3 재유도 위임(parse → resolveAction → buildGhArgv) spy 를 pass-through 로 설치한다.
    // 구조 결손 케이스에서는 가드가 5 구조 assert(L219~223) 중 하나에서 재유도(L229~) 前
    // fail-fast throw 하므로 세 delegate 는 모두 0-call 이어야 한다 — 이 0-call 이 "구조 검사
    // → 값 재유도" 선행성의 증거다(리팩터가 재유도를 구조 검사 위로 끌어올리면 spy 가 1+ 로
    // 잡혀 fail). 최상위 afterEach(jest.restoreAllMocks) 가 매 test 후 원 구현 복원으로 격리.
    function installDelegateSpies() {
      const parseSpy = jest.spyOn(
        searchParseModule,
        "parseRealDataDailyStepDualLegRunReportIssueSearchOutput",
      );
      const actionSpy = jest.spyOn(
        actionModule,
        "resolveRealDataDailyStepDualLegRunReportIssueAction",
      );
      const ghArgvSpy = jest.spyOn(
        ghArgvModule,
        "buildRealDataDailyStepDualLegRunReportIssueGhArgv",
      );
      return { parseSpy, actionSpy, ghArgvSpy };
    }

    // 구조 결손 대표 분기 테이블 — 각 케이스는 (plan, stdout, commandArgs) 중 하나를
    // 구조적으로 손상시켜 assertPlanStructure / assertPlanArgvStructure /
    // assertPlanActionEnum / assertStdoutStructure / assertCommandArgsStructure 중 하나가
    // 재유도 前 TypeError throw 하게 만든다. plan null 과 undefined 는 별 case 로 분리
    // (flow/branch 분기 분리 — 단일 negative 로 묶지 않음).
    const structureCases: Array<{
      name: string;
      errRe: RegExp;
      make: () => {
        plan: RealDataDailyStepDualLegRunReportIssueGhCommandPlan;
        stdout: string;
        commandArgs: RealDataDailyStepDualLegRunReportIssueCommandArgs;
      };
    }> = [
      {
        name: "plan=null(assertPlanStructure)",
        errRe: /plan 이 객체가 아니다.*null/,
        make: () => ({
          plan: null as unknown as RealDataDailyStepDualLegRunReportIssueGhCommandPlan,
          stdout: "[]",
          commandArgs: makeCommandArgs(),
        }),
      },
      {
        name: "plan=undefined(assertPlanStructure)",
        errRe: /plan 이 객체가 아니다.*undefined/,
        make: () => ({
          plan: undefined as unknown as RealDataDailyStepDualLegRunReportIssueGhCommandPlan,
          stdout: "[]",
          commandArgs: makeCommandArgs(),
        }),
      },
      {
        name: "plan=배열(assertPlanStructure)",
        errRe: /plan 이 객체가 아니다.*array/,
        make: () => ({
          plan: [] as unknown as RealDataDailyStepDualLegRunReportIssueGhCommandPlan,
          stdout: "[]",
          commandArgs: makeCommandArgs(),
        }),
      },
      {
        name: "plan=원시(string)(assertPlanStructure)",
        errRe: /plan 이 객체가 아니다.*string/,
        make: () => ({
          plan: "not-a-plan" as unknown as RealDataDailyStepDualLegRunReportIssueGhCommandPlan,
          stdout: "[]",
          commandArgs: makeCommandArgs(),
        }),
      },
      {
        name: "plan.argv=비-배열(객체)(assertPlanArgvStructure)",
        errRe: /plan\.argv 가 배열이 아니다.*object/,
        make: () => ({
          plan: {
            action: { action: "create" },
            argv: {} as unknown as string[],
          },
          stdout: "[]",
          commandArgs: makeCommandArgs(),
        }),
      },
      {
        name: "plan.action.action=enum 결손('delete')(assertPlanActionEnum)",
        errRe: /plan\.action\.action 이 'create'\|'update' 외 값이다.*delete/,
        make: () => ({
          plan: {
            action: { action: "delete" } as unknown as { action: "create" },
            argv: ["issue", "create"],
          } as RealDataDailyStepDualLegRunReportIssueGhCommandPlan,
          stdout: "[]",
          commandArgs: makeCommandArgs(),
        }),
      },
      {
        name: "stdout=비-string(number)(assertStdoutStructure)",
        errRe: /stdout 이 문자열이 아니다.*number/,
        make: () => ({
          plan: buildConsistent("[]", makeCommandArgs()),
          stdout: 42 as unknown as string,
          commandArgs: makeCommandArgs(),
        }),
      },
      {
        name: "commandArgs=비-object(number)(assertCommandArgsStructure)",
        errRe: /commandArgs 가 객체가 아니다.*number/,
        make: () => ({
          plan: buildConsistent("[]", makeCommandArgs()),
          stdout: "[]",
          commandArgs:
            7 as unknown as RealDataDailyStepDualLegRunReportIssueCommandArgs,
        }),
      },
    ];

    it.each(structureCases)(
      "구조 결손 [$name] → TypeError + parse·resolveAction·buildGhArgv 각 0-call(선행 차단)",
      ({ errRe, make }) => {
        const { plan, stdout, commandArgs } = make();
        const { parseSpy, actionSpy, ghArgvSpy } = installDelegateSpies();
        // 구조 assert 에서 TypeError → 재유도 3층 도달 前 선전파.
        expect(() =>
          assertRealDataDailyStepDualLegRunReportIssueGhCommandPlanConsistentWithInputs(
            plan,
            stdout,
            commandArgs,
          ),
        ).toThrow(TypeError);
        expect(() =>
          assertRealDataDailyStepDualLegRunReportIssueGhCommandPlanConsistentWithInputs(
            plan,
            stdout,
            commandArgs,
          ),
        ).toThrow(errRe);
        // 세 재유도 위임 각 0-call — 구조 검사가 값 재유도보다 먼저 수행(선행성)됨을 못박음.
        expect(parseSpy).toHaveBeenCalledTimes(0);
        expect(actionSpy).toHaveBeenCalledTimes(0);
        expect(ghArgvSpy).toHaveBeenCalledTimes(0);
      },
    );

    it("(선행성 정상 흐름) 정합 입력 → 구조 통과 후 parse < resolveAction < buildGhArgv 각 1회(재유도 도달)", () => {
      const stdout = "[]";
      const commandArgs = makeCommandArgs();
      const plan = buildConsistent(stdout, commandArgs);
      const { parseSpy, actionSpy, ghArgvSpy } = installDelegateSpies();

      assertRealDataDailyStepDualLegRunReportIssueGhCommandPlanConsistentWithInputs(
        plan,
        stdout,
        commandArgs,
      );

      // 구조 통과 → 재유도 3층 각 1회 도달.
      expect(parseSpy).toHaveBeenCalledTimes(1);
      expect(actionSpy).toHaveBeenCalledTimes(1);
      expect(ghArgvSpy).toHaveBeenCalledTimes(1);
      // 선행성 정상 흐름의 호출 순서 부등식(구조 결손 케이스의 0-call 과 대비되는 정상 경로).
      expect(parseSpy.mock.invocationCallOrder[0]).toBeLessThan(
        actionSpy.mock.invocationCallOrder[0],
      );
      expect(actionSpy.mock.invocationCallOrder[0]).toBeLessThan(
        ghArgvSpy.mock.invocationCallOrder[0],
      );
    });

    it("(구조 vs 값 경계) 값 정합 위반(RangeError)은 구조 통과 후 재유도가 호출된 뒤 발생 → 세 delegate 1+ call", () => {
      // stdout 후보 0건 → 재유도 create. plan 은 구조상 정상(객체·argv 배열·action enum·
      // stdout string·commandArgs object)이나 argv[1] 동사만 drift → 구조 검사 통과 후
      // 재유도 뒤 argv 원소 대조에서 RangeError.
      const stdout = "[]";
      const commandArgs = makeCommandArgs();
      const ok = buildConsistent(stdout, commandArgs);
      const bad: RealDataDailyStepDualLegRunReportIssueGhCommandPlan = {
        action: ok.action,
        argv: [...ok.argv],
      };
      bad.argv[1] = "edit"; // create → edit 동사 drift(구조는 정상, 값만 위반)
      const { parseSpy, actionSpy, ghArgvSpy } = installDelegateSpies();

      expect(() =>
        assertRealDataDailyStepDualLegRunReportIssueGhCommandPlanConsistentWithInputs(
          bad,
          stdout,
          commandArgs,
        ),
      ).toThrow(RangeError);

      // 구조 결손(TypeError, 세 delegate 0-call)과 대비: 값 위반은 구조 통과 → 재유도 도달 →
      // 세 delegate 각 1회 호출된 뒤 RangeError. 선행성 경계를 값 관점에서 명확화.
      expect(parseSpy).toHaveBeenCalledTimes(1);
      expect(actionSpy).toHaveBeenCalledTimes(1);
      expect(ghArgvSpy).toHaveBeenCalledTimes(1);
    });
  });
});
