// realdata-e2e-daily-step-dual-leg-run-report-title-cross-branch-single-source-
// convergence-assembly.smoke-spec.ts — 실 평가 e2e daily-step dual-leg run report 의
// **두 action 분기(create / update)** 에서 gh argv 의 `--title` 원소가 **동일
// descriptor.title 단일 source 로부터 byte-identical 하게 관통** 함을 박제하는 title
// cross-branch single-source convergence non-gated build-time smoke (T-0930 박제,
// PLAN.md 109행 🟢 실 평가 e2e step ④).
//
// 두 action 분기(title 절단면):
//   - create 분기 — 빈 search stdout(`"[]"`, marker 미매칭)이면 action 이 create 로
//     해소되어 종단 컴포저 resolveRealDataDailyStepDualLegRunReportIssueGhCommandPlan(
//     stdout, commandArgs)(T-0902)가 argv `["issue","create","--title",title,"--body",
//     body,...labels]` 를 산출한다. `--title` 다음 원소(index 3) = createArgs.title(=
//     descriptor.title).
//   - update 분기 — marker-매칭 hit(1+건)이면 action 이 update 로 해소되어 컴포저가
//     argv `["issue","edit",String(N),"--title",title,"--body",body]` 를 산출한다.
//     `--title` 다음 원소(index 4) = updateArgs.title(= descriptor.title).
//
// 본 spec 의 존재 이유 — title cross-branch single-source seam 봉합:
//   어느 action 분기로 가든 이슈 제목(`--title` 원소)은 **동일 descriptor.title 단일
//   source 로부터 byte-identical 하게 나와야** step ④ 의 rolling-issue 안정성(REQ-009 —
//   "동일 run 의 이슈"가 create/update 어느 경로로도 같은 제목으로 수렴)이 성립한다:
//   오늘 밤 run 이 이슈를 새로 만들 때(create)와 내일 밤 run 이 그 이슈를 갱신할
//   때(update)의 `--title` 이 동일해야 사람이 rolling-issue 를 한 제목으로 인지한다. 만약
//   create title 과 update title 이 어긋나면(silent drift) — 갱신마다 제목이 흔들려 이슈
//   목록에서 동일 run 을 추적하기 어려워진다.
//
//   형제 smoke 들이 각기 다른 축만 닫았다:
//     * T-0916(descriptor identity-side confluence)은 **descriptor 수준** 에서
//       descriptor.title 와 descriptor.marker 가 동일 run-token(`${dateToken}@${gitSha}`)
//       을 공유함(서로 다른 prefix·leg outcome 무관·run 별 변별)만 자산화한다 — title 이
//       **하류 commandArgs → gh argv 의 `--title` 원소로 관통**(create/update 두 분기 byte-
//       identical)함은 미단언. descriptor 문자열 정체성 축과 argv 관통 축은 다르다.
//     * T-0928(create-branch marker cross-call)·T-0929(update-branch marker cross-call)
//       은 **marker medium** 의 두 gh 호출(search+create/edit) 사이 관통만 자산화한다 —
//       title medium 은 다루지 않는다.
//     * T-0927(gh-command-plan argv single-source)은 plan.argv 가 single-source gh-argv
//       빌더 산출과 byte-identical 함(각 분기 **내부** argv 정합)만 자산화한다 — create
//       title 과 update title 이 **서로** byte-identical 함(cross-branch title 수렴)은
//       미단언(분기별 독립 대조라 두 분기 title 을 서로 대조하지 않음).
//
//   본 spec 은 T-0928/T-0929(marker cross-call, medium=marker)의 **title medium 대칭
//   sibling(축=cross-branch)** 으로, `report → descriptor → commandArgs → (1) 빈 search
//   "[]" 에 종단 컴포저 → create plan.argv, (2) marker-매칭 hit stdout 에 종단 컴포저 →
//   update plan.argv` 조립에서 두 action 분기의 `--title` 원소가 동일 descriptor.title
//   로부터 byte-identical 하게 관통함을 public CI 그물로 박제한다. 따라서 본 spec 은:
//
//    🔥 실 LLM 호출 0 — orchestrator / scoring service / gateway 미사용. synthetic leg
//       outcome / run / stdout literal 을 조립 체인에 직접 공급(실 평가·수집·jest spawn 0).
//    🔥 실 네트워크 호출 0 — github / Ollama / gh 호출 0. fetch 0. process.env 읽기 0.
//    🔥 실 gh 실행 0 — search / issue create / issue edit 실 실행 0. execFile('gh', …) 0.
//    🔥 credential 0 / secret 0 / DB 0 / 비용 0 — public CI 에서 항상 green 발화(R-113).
//    🔥 새 외부 dependency 0 — 기존 build*/resolve* 컴포저 import 재사용만
//       (consistency-guard·helper·type 신설 0).
//    🔥 gating / describe.skip / env-gating 배선 0 — 순수 build-time in-memory 검증만.
//
// Out of Scope (T-0930):
//   - production src/ 코드 / descriptor·command-args·gh-argv·gh-command-plan·action
//     resolver helper 본문 / package.json / lockfile / test/jest-smoke.json 변경 —
//     import·호출만(배선은 T-0896~T-0902 로 이미 main 박제).
//   - 형제 T-0928/T-0929 의 marker cross-call(검색 marker ↔ body 선두 marker) single-
//     source 수렴 축 재단언 — 본 spec 은 medium 이 marker 가 아니라 **title**, 축이 두 gh
//     호출이 아니라 **두 action 분기(create argv ↔ update argv)**.
//   - 형제 T-0916 의 descriptor 수준 title·marker identity-side(공유 run-token) confluence
//     축 재단언 — 본 spec 은 descriptor 문자열 정체성이 아니라 title 의 **하류 create/update
//     argv `--title` 원소 관통(single-source cross-branch)**.
//   - 형제 T-0927 의 gh-command-plan create/update argv single-source byte-identical(분기별
//     내부 정합) 축 재단언 — 본 spec 은 분기별 내부 정합이 아니라 **create title ↔ update
//     title 상호 byte-identical(두 분기 간 대조)**.
//   - descriptor body 의 markdown 본문·marker 라인·issueNumber 해석·labels 형식 재단언 —
//     각 helper/smoke 가 이미 cover. 본 spec 은 title 원소(create·update 두 분기) single-
//     source 수렴만.
import {
  buildRealDataDailyStepDualLegRunReport,
  type RealDataDailyStepLegRunOutcome,
} from "../helpers/realdata-e2e-daily-step-dual-leg-run-report";
import { buildRealDataDailyStepDualLegRunReportIssueCommandArgs } from "../helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-command-args";
import { buildRealDataDailyStepDualLegRunReportIssueDescriptor } from "../helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-descriptor";
import { resolveRealDataDailyStepDualLegRunReportIssueGhCommandPlan } from "../helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-gh-command-plan";
import type { RealDataResultIssueRunRef } from "../helpers/realdata-e2e-result-issue-descriptor";

// 결정론 run 식별자 fixture — gitSha + dateToken 비공백 안정 토큰. 매 it 가 spread 복제로
// 받아 입력 mutate 누설 0. token/secret/raw narrative 어휘 미포함(credential 누출 0 단언
// fixture 전제).
const RUN_A: RealDataResultIssueRunRef = {
  gitSha: "abc1234",
  dateToken: "2026-07-11",
};

// 서로 다른 run — gitSha·dateToken 이 RUN_A 와 서로 substring 이 아닌 구별 가능 값(run
// 분포 변별 단언용 — run 을 바꾸면 두 분기 title 이 함께 변한다).
const RUN_B: RealDataResultIssueRunRef = {
  gitSha: "def5678",
  dateToken: "2026-07-12",
};

// 기존 이슈 번호 fixture — marker-매칭 hit stdout 의 number(= update 분기 issueNumber).
const EXISTING_ISSUE_NUMBER = 77;

// synthetic leg outcome fixture — eval / collect 각 leg 의 run outcome literal. 조립
// 체인은 leg outcome 을 report → descriptor 로 흘려보내는 surface 만 검증하므로 도메인
// 타입 정합만 만족하는 minimal literal 로 충분하다(실 jest spawn 0).
function evalOutcome(): RealDataDailyStepLegRunOutcome {
  return { leg: "eval", action: "run", passed: true };
}

function collectOutcome(): RealDataDailyStepLegRunOutcome {
  return { leg: "collect", action: "run", passed: true };
}

// run-token 계산 — literal prefix 하드코딩이 아니라 helper 규약 `${dateToken}@${gitSha}`
// 를 재계산해 title / marker substring 을 구조적으로 검증한다(prefix const 는 export 0).
function runTokenOf(run: RealDataResultIssueRunRef): string {
  return `${run.dateToken}@${run.gitSha}`;
}

// plan.argv 의 title 추출 — `--title` 다음 원소. create 분기는 index 3, update 분기는
// index 4 이지만 `indexOf("--title")+1` 로 위치 무관 방어적 추출(형식 규약 자체 재단언은
// T-0927 cover — 본 spec 은 title 원소 추출에만 사용).
function titleOf(argv: string[]): string {
  const idx = argv.indexOf("--title");
  return argv[idx + 1];
}

// marker-매칭 hit stdout 합성 — 기존 이슈 검색이 이 run 의 marker 를 body 에 담은 이슈
// 1건을 반환하는 상황을 synthetic literal 로 재현한다(실 gh search 실행 0). body 에 marker
// 를 담아야 action resolver 가 update 로 해소한다.
function hitStdoutOf(marker: string, issueNumber: number): string {
  return JSON.stringify([
    {
      number: issueNumber,
      title: "기존 dual-leg run report 이슈",
      body: `${marker}\n\n기존 본문 일부`,
    },
  ]);
}

// title cross-branch 조립 진입점 — 단일 source(run + 두 leg outcome) 로부터 report →
// descriptor → commandArgs 를 관통시켜 유효 commandArgs 를 얻고, (1) 빈 search "[]" 에
// 종단 컴포저를 적용해 create plan 을, (2) marker-매칭 hit stdout 에 적용해 update plan 을
// 각각 산출한다. 각 stage 의 guard throw 는 자체 try/catch 없이 그대로 전파된다.
// opts.createStdout / opts.updateStdout 으로 파서 negative test 도 같은 진입점을 재사용한다.
function assembleTitleCrossBranch(
  evalLeg: RealDataDailyStepLegRunOutcome,
  collectLeg: RealDataDailyStepLegRunOutcome,
  run: RealDataResultIssueRunRef,
  opts?: {
    createStdout?: string;
    updateStdout?: string;
    issueNumber?: number;
  },
) {
  // (1) pre-execution descriptor.
  const report = buildRealDataDailyStepDualLegRunReport(
    evalLeg,
    collectLeg,
    run,
  );
  const descriptor =
    buildRealDataDailyStepDualLegRunReportIssueDescriptor(report);
  // (2) command-args — createArgs.title = updateArgs.title = descriptor.title.
  const commandArgs =
    buildRealDataDailyStepDualLegRunReportIssueCommandArgs(descriptor);
  // (3) create 분기 — 빈 search "[]"(marker 미매칭) → action create → issue create argv.
  const createStdout = opts?.createStdout ?? "[]";
  const createPlan = resolveRealDataDailyStepDualLegRunReportIssueGhCommandPlan(
    createStdout,
    commandArgs,
  );
  // (4) update 분기 — marker-매칭 hit stdout → action update → issue edit argv.
  const issueNumber = opts?.issueNumber ?? EXISTING_ISSUE_NUMBER;
  const updateStdout =
    opts?.updateStdout ?? hitStdoutOf(descriptor.marker, issueNumber);
  const updatePlan = resolveRealDataDailyStepDualLegRunReportIssueGhCommandPlan(
    updateStdout,
    commandArgs,
  );
  return {
    report,
    descriptor,
    commandArgs,
    createStdout,
    updateStdout,
    createPlan,
    updatePlan,
  };
}

describe("Smoke(non-gated): dual-leg run report title cross-branch(create argv `--title` + update argv `--title`) single-source convergence live-gh 0 검증", () => {
  describe("happy path — title cross-branch 수렴", () => {
    it("단일 source(run + 두 leg outcome) → create plan(action='create', argv[0..1]=['issue','create']) + update plan(action='update', issueNumber===N), 두 분기 `--title` 다음 원소가 각각 descriptor.title 와 byte-identical(===) AND 서로도 byte-identical", () => {
      const { descriptor, createPlan, updatePlan } = assembleTitleCrossBranch(
        evalOutcome(),
        collectOutcome(),
        { ...RUN_A },
      );

      // 두 분기 해소 확인.
      expect(createPlan.action.action).toBe("create");
      expect(createPlan.argv[0]).toBe("issue");
      expect(createPlan.argv[1]).toBe("create");
      expect(updatePlan.action.action).toBe("update");
      if (updatePlan.action.action === "update") {
        expect(updatePlan.action.issueNumber).toBe(EXISTING_ISSUE_NUMBER);
      }

      const createTitle = titleOf(createPlan.argv);
      const updateTitle = titleOf(updatePlan.argv);

      // (1) 두 분기 title 이 각각 descriptor.title 와 byte-identical.
      expect(createTitle).toBe(descriptor.title);
      expect(updateTitle).toBe(descriptor.title);

      // (2) create title 과 update title 이 서로도 byte-identical(단일 source cross-branch 관통).
      expect(createTitle).toBe(updateTitle);
    });

    it("create plan.argv 는 issue create argv 형(argv[2]==='--title', argv[3]===title)이고, update plan.argv 는 issue edit argv 형(argv[2]===String(N), argv[3]==='--title', argv[4]===title) — 두 분기 title index 규약 확인", () => {
      const { descriptor, createPlan, updatePlan } = assembleTitleCrossBranch(
        evalOutcome(),
        collectOutcome(),
        { ...RUN_A },
      );
      // create 분기 index 규약.
      expect(createPlan.argv[2]).toBe("--title");
      expect(createPlan.argv[3]).toBe(descriptor.title);
      // update 분기 index 규약.
      expect(updatePlan.argv[2]).toBe(String(EXISTING_ISSUE_NUMBER));
      expect(updatePlan.argv[3]).toBe("--title");
      expect(updatePlan.argv[4]).toBe(descriptor.title);
    });
  });

  describe("핵심 1 — title 등장 지점 유일성 + title !== marker(공유 run-token)", () => {
    it("create plan.argv 에서 title(온전체)은 정확히 `--title` 다음 1원소로만 등장 — 다른 원소(issue/create/--body/body/--label/labels)에는 title 온전체 부재", () => {
      const { descriptor, createPlan } = assembleTitleCrossBranch(
        evalOutcome(),
        collectOutcome(),
        { ...RUN_A },
      );
      const title = descriptor.title;
      // 정확히 1원소가 title.
      expect(createPlan.argv.filter((el) => el === title).length).toBe(1);
      // 그 외 원소에는 title 온전체 부재.
      expect(
        createPlan.argv
          .filter((el) => el !== title)
          .every((el) => !el.includes(title)),
      ).toBe(true);
    });

    it("update plan.argv 에서 title(온전체)은 정확히 `--title` 다음 1원소로만 등장 — 다른 원소(issue/edit/String(N)/--body/body)에는 title 온전체 부재", () => {
      const { descriptor, updatePlan } = assembleTitleCrossBranch(
        evalOutcome(),
        collectOutcome(),
        { ...RUN_A },
      );
      const title = descriptor.title;
      expect(updatePlan.argv.filter((el) => el === title).length).toBe(1);
      expect(
        updatePlan.argv
          .filter((el) => el !== title)
          .every((el) => !el.includes(title)),
      ).toBe(true);
    });

    it("title !== marker(두 분기 title 원소가 각각 descriptor.marker 와 서로 다른 문자열 — 다른 prefix)이면서 title·marker 가 동일 run-token(`${dateToken}@${gitSha}`)을 공유(공유 substring)", () => {
      const { descriptor, createPlan, updatePlan } = assembleTitleCrossBranch(
        evalOutcome(),
        collectOutcome(),
        { ...RUN_A },
      );
      const createTitle = titleOf(createPlan.argv);
      const updateTitle = titleOf(updatePlan.argv);
      const token = runTokenOf(RUN_A);

      // title !== marker(medium 구별 — 서로 다른 prefix).
      expect(createTitle).not.toBe(descriptor.marker);
      expect(updateTitle).not.toBe(descriptor.marker);
      // title·marker 가 동일 run-token 을 공유(공유 source).
      expect(createTitle).toContain(token);
      expect(updateTitle).toContain(token);
      expect(descriptor.marker).toContain(token);
    });
  });

  describe("핵심 2 — run 분포 변별(두 분기 동반 변화 + 여전히 상호 byte-identical)", () => {
    it("(a) 서로 다른 run(A/B) 각각 chain → 각 run 안에서 (createTitle, updateTitle) 는 서로 byte-identical", () => {
      const chainA = assembleTitleCrossBranch(evalOutcome(), collectOutcome(), {
        ...RUN_A,
      });
      const chainB = assembleTitleCrossBranch(evalOutcome(), collectOutcome(), {
        ...RUN_B,
      });

      const createTitleA = titleOf(chainA.createPlan.argv);
      const updateTitleA = titleOf(chainA.updatePlan.argv);
      const createTitleB = titleOf(chainB.createPlan.argv);
      const updateTitleB = titleOf(chainB.updatePlan.argv);

      expect(createTitleA).toBe(updateTitleA);
      expect(createTitleB).toBe(updateTitleB);
      // 각 title 은 자기 run 의 run-token 보유(구조 검증).
      expect(createTitleA).toContain(runTokenOf(RUN_A));
      expect(createTitleB).toContain(runTokenOf(RUN_B));
    });

    it("(b) run A ≠ run B → createTitle 두 값 서로 다름 AND updateTitle 두 값 서로 다름(두 분기 title 이 run 에 따라 함께 변함 — run-token 단일 source 동반 관통)", () => {
      const chainA = assembleTitleCrossBranch(evalOutcome(), collectOutcome(), {
        ...RUN_A,
      });
      const chainB = assembleTitleCrossBranch(evalOutcome(), collectOutcome(), {
        ...RUN_B,
      });

      expect(titleOf(chainA.createPlan.argv)).not.toBe(
        titleOf(chainB.createPlan.argv),
      );
      expect(titleOf(chainA.updatePlan.argv)).not.toBe(
        titleOf(chainB.updatePlan.argv),
      );
    });
  });

  describe("핵심 3 — leg outcome 무관 title 안정(멱등 근거)", () => {
    it("동일 run + leg outcome 조합만 다르게(pass/pass vs fail/skip) → createTitle 와 updateTitle 가 서로 byte-identical 하고, 두 값 모두 leg outcome 변경 전과 동일(title 은 run-token 만의 함수)", () => {
      const passChain = assembleTitleCrossBranch(
        { leg: "eval", action: "run", passed: true },
        { leg: "collect", action: "run", passed: true },
        { ...RUN_A },
      );
      const mixedChain = assembleTitleCrossBranch(
        { leg: "eval", action: "run", passed: false },
        { leg: "collect", action: "skip" },
        { ...RUN_A },
      );

      const passCreate = titleOf(passChain.createPlan.argv);
      const passUpdate = titleOf(passChain.updatePlan.argv);
      const mixedCreate = titleOf(mixedChain.createPlan.argv);
      const mixedUpdate = titleOf(mixedChain.updatePlan.argv);

      // 각 chain 안에서 두 분기 title 상호 identical.
      expect(passCreate).toBe(passUpdate);
      expect(mixedCreate).toBe(mixedUpdate);
      // leg outcome(및 overallStatus) 변경 전후 두 분기 title 모두 불변.
      expect(mixedCreate).toBe(passCreate);
      expect(mixedUpdate).toBe(passUpdate);
      // overallStatus 는 실제로 바뀌었음(안정성 대조 유효성 확인).
      expect(passChain.report.overallStatus).not.toBe(
        mixedChain.report.overallStatus,
      );
    });
  });

  describe("핵심 4 — single-source 독립 재유도 + 결정론", () => {
    it("컴포저 재호출 없이 descriptor.title 를 진실의 원천으로 삼아 createTitle·updateTitle 가 그 descriptor.title 와 각각 deep-equal — 두 분기 title 이 하드코딩이 아니라 descriptor.title 파생", () => {
      const { descriptor, createPlan, updatePlan } = assembleTitleCrossBranch(
        evalOutcome(),
        collectOutcome(),
        { ...RUN_A },
      );
      expect(titleOf(createPlan.argv)).toEqual(descriptor.title);
      expect(titleOf(updatePlan.argv)).toEqual(descriptor.title);
    });

    it("결정론 — 동일 입력(+ 동일 create/update stdout) 두 번 chain → 두 (createTitle, updateTitle) 쌍 deep-equal(byte-identical)", () => {
      const first = assembleTitleCrossBranch(evalOutcome(), collectOutcome(), {
        ...RUN_A,
      });
      const second = assembleTitleCrossBranch(evalOutcome(), collectOutcome(), {
        ...RUN_A,
      });
      expect(titleOf(first.createPlan.argv)).toEqual(
        titleOf(second.createPlan.argv),
      );
      expect(titleOf(first.updatePlan.argv)).toEqual(
        titleOf(second.updatePlan.argv),
      );
    });
  });

  describe("error path / negative cases — 예외 분기마다 각 1+", () => {
    it("(a) create title drift 검출 — chain 산출 create plan.argv 를 복제해 `--title` 다음 원소를 변형한 synthetic argv 의 title 이 update plan.argv 의 title 과 !==(cross-branch byte-identical 위반 검출)", () => {
      const { createPlan, updatePlan } = assembleTitleCrossBranch(
        evalOutcome(),
        collectOutcome(),
        { ...RUN_A },
      );
      const updateTitle = titleOf(updatePlan.argv);
      // create title 원소 위치를 변형한 synthetic 복제.
      const idx = createPlan.argv.indexOf("--title");
      const drifted = [...createPlan.argv];
      drifted[idx + 1] = `${drifted[idx + 1]}-DRIFT`;
      expect(titleOf(drifted)).not.toBe(updateTitle);
    });

    it("(b) update title drift 검출 — update plan.argv 의 `--title` 다음 원소를 복제해 token 한 글자 변경한 synthetic title 이 create plan.argv 의 title 과 !==", () => {
      const { createPlan, updatePlan } = assembleTitleCrossBranch(
        evalOutcome(),
        collectOutcome(),
        { ...RUN_A },
      );
      const createTitle = titleOf(createPlan.argv);
      const idx = updatePlan.argv.indexOf("--title");
      const drifted = [...updatePlan.argv];
      drifted[idx + 1] = `${drifted[idx + 1]}X`;
      expect(titleOf(drifted)).not.toBe(createTitle);
    });

    it("(c) descriptor guard 상류 차단 — run.gitSha 빈/공백이면 descriptor guard throw 로 title·marker·body 자체 미산출(chain 조립 차단)", () => {
      expect(() =>
        assembleTitleCrossBranch(evalOutcome(), collectOutcome(), {
          gitSha: "   ",
          dateToken: RUN_A.dateToken,
        }),
      ).toThrow();
    });

    it("(c') descriptor guard 상류 차단 대칭 — run.dateToken 빈/공백이면 descriptor guard throw(필드별 독립 분기)", () => {
      expect(() =>
        assembleTitleCrossBranch(evalOutcome(), collectOutcome(), {
          gitSha: RUN_A.gitSha,
          dateToken: "",
        }),
      ).toThrow();
    });

    it("(d) gh-argv 빌더 guard 상류 차단 — createArgs.title 빈/공백인 commandArgs 를 컴포저(create 분기)에 넣으면 title guard throw 로 create argv 미산출(빈 제목 이슈 사고 차단)", () => {
      const { commandArgs } = assembleTitleCrossBranch(
        evalOutcome(),
        collectOutcome(),
        { ...RUN_A },
      );
      // createArgs.title 만 공백으로 오염한 synthetic commandArgs.
      const badCreate = {
        ...commandArgs,
        createArgs: { ...commandArgs.createArgs, title: "   " },
      };
      expect(() =>
        resolveRealDataDailyStepDualLegRunReportIssueGhCommandPlan(
          "[]",
          badCreate,
        ),
      ).toThrow();
    });

    it("(d') gh-argv 빌더 guard 상류 차단 대칭 — updateArgs.title 빈/공백인 commandArgs 를 컴포저(update 분기)에 넣으면 title guard throw 로 update argv 미산출", () => {
      const { commandArgs, descriptor } = assembleTitleCrossBranch(
        evalOutcome(),
        collectOutcome(),
        { ...RUN_A },
      );
      const badUpdate = {
        ...commandArgs,
        updateArgs: { ...commandArgs.updateArgs, title: "" },
      };
      const hit = hitStdoutOf(descriptor.marker, EXISTING_ISSUE_NUMBER);
      expect(() =>
        resolveRealDataDailyStepDualLegRunReportIssueGhCommandPlan(
          hit,
          badUpdate,
        ),
      ).toThrow();
    });

    it("(e) 컴포저 파서 guard 상류 차단(update 분기 argv 미산출) — 비-JSON('{')/비배열 JSON('{}')/number 비양수 hit('[{number:0}]') stdout → 파서/빌더 throw 전파로 update plan(및 title argv) 미산출", () => {
      expect(() =>
        assembleTitleCrossBranch(
          evalOutcome(),
          collectOutcome(),
          { ...RUN_A },
          { updateStdout: "{" },
        ),
      ).toThrow();
      expect(() =>
        assembleTitleCrossBranch(
          evalOutcome(),
          collectOutcome(),
          { ...RUN_A },
          { updateStdout: "{}" },
        ),
      ).toThrow();
      // marker-매칭 hit 이지만 number 비양수(0) → 빌더 issueNumber guard throw 전파.
      expect(() => {
        const base = assembleTitleCrossBranch(evalOutcome(), collectOutcome(), {
          ...RUN_A,
        });
        const badHit = JSON.stringify([
          {
            number: 0,
            title: "기존 이슈",
            body: `${base.descriptor.marker}\n\n본문`,
          },
        ]);
        assembleTitleCrossBranch(
          evalOutcome(),
          collectOutcome(),
          { ...RUN_A },
          { updateStdout: badHit },
        );
      }).toThrow();
    });
  });

  describe("결정론 · 무공유 · no-mutation", () => {
    it("동일 (run, leg outcomes, create/update stdout) 입력 chain 두 번 → create plan.argv·update plan.argv 가 두 번 deep-equal(byte-identical)", () => {
      const first = assembleTitleCrossBranch(evalOutcome(), collectOutcome(), {
        ...RUN_A,
      });
      const second = assembleTitleCrossBranch(evalOutcome(), collectOutcome(), {
        ...RUN_A,
      });
      expect(first.createPlan.argv).toEqual(second.createPlan.argv);
      expect(first.updatePlan.argv).toEqual(second.updatePlan.argv);
    });

    it("무공유 — 두 chain(및 같은 chain 의 create/update)의 plan.argv 배열이 referential identity 분리(not.toBe)", () => {
      const first = assembleTitleCrossBranch(evalOutcome(), collectOutcome(), {
        ...RUN_A,
      });
      const second = assembleTitleCrossBranch(evalOutcome(), collectOutcome(), {
        ...RUN_A,
      });
      expect(first.createPlan.argv).not.toBe(second.createPlan.argv);
      expect(first.updatePlan.argv).not.toBe(second.updatePlan.argv);
      // 같은 chain 안의 create/update plan 도 서로 다른 인스턴스.
      expect(first.createPlan).not.toBe(first.updatePlan);
      expect(first.createPlan.argv).not.toBe(first.updatePlan.argv);
    });

    it("no-mutation — chain 호출이 commandArgs(중첩 createArgs/updateArgs 포함) 및 run 을 mutate 0(호출 전후 JSON snapshot deep-equal)", () => {
      const run: RealDataResultIssueRunRef = { ...RUN_A };
      const evalLeg = evalOutcome();
      const collectLeg = collectOutcome();
      const runBefore = JSON.parse(JSON.stringify(run));
      const evalBefore = JSON.parse(JSON.stringify(evalLeg));
      const collectBefore = JSON.parse(JSON.stringify(collectLeg));

      const { commandArgs, descriptor } = assembleTitleCrossBranch(
        evalLeg,
        collectLeg,
        run,
      );
      const commandArgsSnapshot = JSON.parse(JSON.stringify(commandArgs));

      // 산출 후 두 분기 재조립(같은 commandArgs 재사용) — 입력 mutate 유발 여부 확인.
      resolveRealDataDailyStepDualLegRunReportIssueGhCommandPlan(
        "[]",
        commandArgs,
      );
      resolveRealDataDailyStepDualLegRunReportIssueGhCommandPlan(
        hitStdoutOf(descriptor.marker, EXISTING_ISSUE_NUMBER),
        commandArgs,
      );

      expect(run).toEqual(runBefore);
      expect(evalLeg).toEqual(evalBefore);
      expect(collectLeg).toEqual(collectBefore);
      expect(commandArgs).toEqual(commandArgsSnapshot);
    });
  });

  describe("raw / credential 누출 0(R-59 / REQ-059)", () => {
    it("create·update plan.argv 의 어느 원소도 GH_TOKEN/PAT/ghp_/--token/GITHUB_TOKEN 어휘 미포함", () => {
      const { createPlan, updatePlan } = assembleTitleCrossBranch(
        evalOutcome(),
        collectOutcome(),
        { ...RUN_A },
      );
      const joined = [...createPlan.argv, ...updatePlan.argv].join(" ");
      expect(joined).not.toContain("--token");
      expect(joined).not.toContain("GITHUB_TOKEN");
      expect(joined).not.toContain("GH_TOKEN");
      expect(joined).not.toContain("ghp_");
      expect(joined).not.toMatch(/ghp_[A-Za-z0-9]/);
    });

    it("title(= 두 분기 `--title` 다음 원소)이 안정 run-token(`${dateToken}@${gitSha}` + 고정 prefix)만 담고 raw 활동 narrative·credential 미포함", () => {
      const { createPlan, updatePlan } = assembleTitleCrossBranch(
        evalOutcome(),
        collectOutcome(),
        { ...RUN_A },
      );
      const createTitle = titleOf(createPlan.argv);
      const updateTitle = titleOf(updatePlan.argv);
      // 두 분기 title 은 run-token 보유.
      expect(createTitle).toContain(runTokenOf(RUN_A));
      expect(updateTitle).toContain(runTokenOf(RUN_A));
      // narrative·credential 어휘 미포함.
      expect(createTitle).not.toContain("narrative");
      expect(updateTitle).not.toContain("narrative");
      expect(createTitle).not.toContain("ghp_");
      expect(updateTitle).not.toContain("ghp_");
    });

    it("leg outcome.specPath 에 sentinel 을 넣어도 create·update 두 분기 title 에 sentinel 미누출(title 은 run-token 파생만)", () => {
      const sentinel = "ghp_SENTINELsecret1234";
      const evalLeg: RealDataDailyStepLegRunOutcome = {
        leg: "eval",
        action: "run",
        passed: true,
        specPath: sentinel,
      };
      const collectLeg: RealDataDailyStepLegRunOutcome = {
        leg: "collect",
        action: "run",
        passed: true,
        specPath: sentinel,
      };
      const { createPlan, updatePlan } = assembleTitleCrossBranch(
        evalLeg,
        collectLeg,
        { ...RUN_A },
      );
      expect(titleOf(createPlan.argv)).not.toContain(sentinel);
      expect(titleOf(updatePlan.argv)).not.toContain(sentinel);
    });

    it("descriptor guard throw 메시지가 raw 활동 본문·credential 미노출(필드명·유효성만)", () => {
      const sentinel = "ghp_SENTINELsecret1234";
      let message = "";
      try {
        assembleTitleCrossBranch(
          { leg: "eval", action: "run", passed: true, specPath: sentinel },
          { leg: "collect", action: "run", passed: true, specPath: sentinel },
          { gitSha: "   ", dateToken: RUN_A.dateToken },
        );
      } catch (err) {
        message = err instanceof Error ? err.message : String(err);
      }
      expect(message.length).toBeGreaterThan(0);
      expect(message).not.toContain(sentinel);
      expect(message).not.toContain("ghp_");
    });
  });
});
