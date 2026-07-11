// realdata-e2e-daily-step-dual-leg-run-report-create-branch-labels-single-source-
// update-absence-orthogonal-convergence-assembly.smoke-spec.ts — 실 평가 e2e
// daily-step dual-leg run report 의 **create 분기 argv `--label` flag-pair 원소들이
// 단일 source(commandArgs.createArgs.labels)로부터 순서 보존·byte-identical 하게 전개**
// 되고 **update 분기 argv 에는 `--label` 토큰 및 어떤 label 원소도 전무**(labels 는
// create-only medium ⊥ update)함을 박제하는 create-branch labels single-source +
// update-absence orthogonal convergence non-gated build-time smoke (T-0932 박제,
// PLAN.md 109행 🟢 실 평가 e2e step ④).
//
// 두 action 분기(labels 절단면 — 비대칭 medium):
//   - create 분기 — 빈 search stdout(`"[]"`, marker 미매칭)이면 action 이 create 로
//     해소되어 종단 컴포저 resolveRealDataDailyStepDualLegRunReportIssueGhCommandPlan(
//     stdout, commandArgs)(T-0902)가 argv `["issue","create","--title",title,"--body",
//     body,"--label",labels[0],"--label",labels[1],...]` 를 산출한다. 각 label 은
//     commandArgs.createArgs.labels(command-args 빌더 line 148 의 고정 결정론 상수 복제)의
//     원소를 순서 보존해 `["--label", <label>]` flag pair 로 전개(gh-argv 빌더 line 124–127).
//   - update 분기 — marker-매칭 hit(1+건)이면 action 이 update 로 해소되어 컴포저가
//     argv `["issue","edit",String(N),"--title",title,"--body",body]` 를 산출한다.
//     **`--label` 토큰도, 어떤 label 원소도 없다**(gh-argv 빌더 line 141–149 — edit argv 는
//     labels 를 전개하지 않는다). update argv 길이는 정확히 7.
//
// 본 spec 의 존재 이유 — labels create-single-source + update-absence orthogonal seam 봉합:
//   labels 는 **create-only medium** 이다: 오늘 밤 run 이 이슈를 새로 만들 때(create)만
//   label 을 붙이고, 내일 밤 run 이 그 이슈를 갱신할 때(update)는 label 을 재부여하지 않는다
//   (이미 붙어있는 label 을 건드리지 않는 멱등 갱신, REQ-009). 만약 update 분기 argv 에
//   `--label` 이 새면(silent leak) — 갱신마다 label 을 중복/재부여해 이슈 메타가 불안정해지거나
//   gh edit 이 실패한다. 또 create 분기 label 전개가 단일 source(고정 labels 상수)에서 순서
//   보존·pair 형태로 나오지 않으면 — 라벨 누락/뒤섞임/오염된 flag 로 이슈가 잘못 분류된다.
//
//   형제 smoke 들이 각기 다른 축만 닫았다:
//     * T-0930(title cross-branch)·T-0931(body cross-branch)은 **title / body medium** 이
//       create argv ↔ update argv 로 **두 분기 모두 등장**하며 byte-identical 관통함(cross-
//       branch 대칭)만 자산화한다 — labels 는 다루지 않는다. 게다가 labels 는 title/body 와
//       달리 **create 에만 등장하는 비대칭 medium** 이라 축이 cross-branch 대칭이 아니라
//       **create single-source + update absence orthogonality** 다.
//     * T-0927(gh-command-plan argv single-source)은 plan.argv 가 single-source gh-argv
//       빌더 산출과 byte-identical 함(각 분기 **내부** argv 정합)만 자산화한다 — labels 가
//       정확히 `["--label", <label>]` pair 로 순서 보존 전개되는 세부, create 분기에만 labels
//       가 붙고 update 분기에는 전무하다는 **비대칭(orthogonality)** 은 미단언(분기별 내부
//       정합이라 labels 유무의 두 분기 대조를 하지 않음).
//     * T-0921(marker⊥issueNumber orthogonal)은 **searchArgv marker medium 과 editArgv
//       issueNumber medium** 이 서로 직교(독립 source)함만 자산화한다 — labels medium 의
//       create-only 직교(update 부재)는 다른 축이다.
//     * T-0928/T-0929(marker cross-call)·T-0915(descriptor body confluence)·T-0919(search-
//       argv marker 4-boundary)·T-0920(edit-argv issueNumber)는 모두 marker / body /
//       issueNumber medium 이며 labels 를 다루지 않는다.
//
//   본 spec 은 그 **labels create-single-source + update-absence orthogonal seam** 을 닫는다
//   — T-0930/T-0931(title·body cross-branch)의 **labels medium sibling(단 축=create single-
//   source + update absence orthogonality, cross-branch 대칭 아님)** 으로, `report →
//   descriptor → commandArgs → (1) 빈 search "[]" 에 종단 컴포저 → create plan.argv, (2)
//   marker-매칭 hit stdout 에 종단 컴포저 → update plan.argv` 조립에서 create plan.argv 의
//   `--label` flag-pair 원소들이 commandArgs.createArgs.labels 로부터 순서 보존·pair 형태로
//   byte-identical 전개되고 update plan.argv 에는 `--label` 토큰 및 어떤 label 원소도 부재함을
//   public CI 그물로 박제한다. 따라서 본 spec 은:
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
// Out of Scope (T-0932):
//   - production src/ 코드 / descriptor·command-args(labels 상수·복제)·gh-argv(labels pair
//     전개·update 부재)·gh-command-plan·action resolver helper 본문 / package.json /
//     lockfile / test/jest-smoke.json 변경 — import·호출만(배선은 T-0896~T-0902 로 이미
//     main 박제).
//   - 형제 T-0930 의 title cross-branch(create argv `--title` ↔ update argv `--title`) /
//     T-0931 의 body cross-branch(create argv `--body` ↔ update argv `--body`) 축 재단언 —
//     본 spec 은 medium 이 title/body 가 아니라 **labels** 이며, labels 는 create-only 라
//     축이 cross-branch 대칭이 아니라 create single-source + update absence orthogonality.
//   - 형제 T-0927 의 gh-command-plan create/update argv single-source byte-identical(분기별
//     내부 정합) 축 재단언 — 본 spec 은 분기별 내부 정합이 아니라 create 분기 labels pair
//     전개 세부(순서·pair 형태) + update 분기 labels 부재 직교.
//   - 형제 T-0921 의 searchArgv marker ⊥ editArgv issueNumber 직교 축 재단언 — 본 spec 은
//     labels create-only ⊥ update absence 라는 별도 직교 축.
//   - descriptor body 의 markdown 본문·marker 라인·issueNumber 해석·title/body 형식 재단언 —
//     각 helper/smoke 가 이미 cover. 본 spec 은 labels 원소(create 분기 전개 + update 분기
//     부재) single-source orthogonality 만.
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

// 서로 다른 run — gitSha·dateToken 이 RUN_A 와 서로 substring 이 아닌 구별 가능 값. labels 는
// 고정 상수라 run 을 바꿔도 불변임을 대조하기 위한 run 분포 변별용(title/body 와 대비).
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

// create plan.argv 의 label 값 추출 — 모든 `--label` 원소 바로 뒤 원소(index+1)를 순서대로
// 모은다. create 분기는 `--body` 뒤에 `["--label", <label>]` pair 가 순서대로 오지만 위치
// 무관 방어적 추출(형식 규약 자체 재단언은 T-0927 cover — 본 spec 은 label 값 집합·순서
// 추출에만 사용).
function labelValuesOf(argv: string[]): string[] {
  const values: string[] = [];
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === "--label") {
      values.push(argv[i + 1]);
    }
  }
  return values;
}

// `--label` 토큰 등장 횟수.
function labelFlagCountOf(argv: string[]): number {
  return argv.filter((el) => el === "--label").length;
}

// marker-매칭 hit stdout 합성 — 기존 이슈 검색이 이 run 의 marker 를 body 에 담은 이슈
// 1건을 반환하는 상황을 synthetic literal 로 재현한다(실 gh search 실행 0). body 에
// descriptor.body(선두 marker 포함)를 그대로 담아야 action resolver 가 update 로 해소한다.
function hitStdoutOf(body: string, issueNumber: number): string {
  return JSON.stringify([
    {
      number: issueNumber,
      title: "기존 dual-leg run report 이슈",
      body,
    },
  ]);
}

// labels create-single-source + update-absence 조립 진입점 — 단일 source(run + 두 leg
// outcome) 로부터 report → descriptor → commandArgs 를 관통시켜 유효 commandArgs 를 얻고,
// (1) 빈 search "[]" 에 종단 컴포저를 적용해 create plan(labels pair 포함)을, (2) marker-
// 매칭 hit stdout(= descriptor.body 를 담은 이슈 1건)에 적용해 update plan(labels 전무)을
// 각각 산출한다. 각 stage 의 guard throw 는 자체 try/catch 없이 그대로 전파된다.
// opts.createStdout / opts.updateStdout 으로 파서 negative test 도 같은 진입점을 재사용한다.
function assembleLabelsOrthogonal(
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
  // (2) command-args — createArgs.labels = 고정 결정론 상수 복제(무공유), updateArgs 는
  // labels 필드 자체 부재(create-only source).
  const commandArgs =
    buildRealDataDailyStepDualLegRunReportIssueCommandArgs(descriptor);
  // (3) create 분기 — 빈 search "[]"(marker 미매칭) → action create → issue create argv
  // (labels pair 포함).
  const createStdout = opts?.createStdout ?? "[]";
  const createPlan = resolveRealDataDailyStepDualLegRunReportIssueGhCommandPlan(
    createStdout,
    commandArgs,
  );
  // (4) update 분기 — marker-매칭 hit stdout(descriptor.body 를 담은 이슈) → action
  // update → issue edit argv(labels 전무).
  const issueNumber = opts?.issueNumber ?? EXISTING_ISSUE_NUMBER;
  const updateStdout =
    opts?.updateStdout ?? hitStdoutOf(descriptor.body, issueNumber);
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

describe("Smoke(non-gated): dual-leg run report create-branch labels single-source(`--label` pair 순서 보존 전개) + update-branch labels absence(orthogonality) live-gh 0 검증", () => {
  describe("happy path — create-branch labels single-source 전개", () => {
    it("단일 source(run + 두 leg outcome) → create plan(action='create', argv[0..1]=['issue','create']), create plan.argv 의 labelValues 가 commandArgs.createArgs.labels 와 순서 포함 deep-equal AND `--label` 등장 횟수 === labels.length", () => {
      const { commandArgs, createPlan } = assembleLabelsOrthogonal(
        evalOutcome(),
        collectOutcome(),
        { ...RUN_A },
      );

      // create 분기 해소 확인.
      expect(createPlan.action.action).toBe("create");
      expect(createPlan.argv[0]).toBe("issue");
      expect(createPlan.argv[1]).toBe("create");

      const labelValues = labelValuesOf(createPlan.argv);
      // (1) labelValues 가 createArgs.labels 와 순서 포함 deep-equal(단일 source).
      expect(labelValues).toEqual(commandArgs.createArgs.labels);
      // (2) `--label` 토큰 등장 횟수 === labels.length(각 label 이 정확히 1 pair).
      expect(labelFlagCountOf(createPlan.argv)).toBe(
        commandArgs.createArgs.labels.length,
      );
    });

    it("update plan(action='update', issueNumber===N) 이 정상 해소되고 update plan.argv 는 issue edit argv 형(길이 7, `--label` 전무) — 두 분기 진입 확인", () => {
      const { updatePlan } = assembleLabelsOrthogonal(
        evalOutcome(),
        collectOutcome(),
        { ...RUN_A },
      );
      expect(updatePlan.action.action).toBe("update");
      if (updatePlan.action.action === "update") {
        expect(updatePlan.action.issueNumber).toBe(EXISTING_ISSUE_NUMBER);
      }
      expect(updatePlan.argv.length).toBe(7);
      expect(updatePlan.argv).not.toContain("--label");
    });
  });

  describe("핵심 1 — create 분기 labels pair 형태·순서 보존", () => {
    it("create plan.argv 에서 각 label 이 정확히 `['--label', <label>]` 인접 pair 로 등장 — 모든 `--label` 원소 바로 뒤 원소가 label 값이고 그 값 자체는 flag(`--label`/`--title`/`--body`)가 아님", () => {
      const { createPlan } = assembleLabelsOrthogonal(
        evalOutcome(),
        collectOutcome(),
        { ...RUN_A },
      );
      const argv = createPlan.argv;
      const flags = new Set(["--label", "--title", "--body"]);
      for (let i = 0; i < argv.length; i += 1) {
        if (argv[i] === "--label") {
          const next = argv[i + 1];
          // 바로 뒤 원소가 존재하고 flag 가 아님(온전한 label 값).
          expect(next).toBeDefined();
          expect(flags.has(next)).toBe(false);
        }
      }
    });

    it("create plan.argv 에서 labels 는 base 인자(title/body) 뒤에 전개 — 첫 `--label` index > `--body` index", () => {
      const { createPlan } = assembleLabelsOrthogonal(
        evalOutcome(),
        collectOutcome(),
        { ...RUN_A },
      );
      const argv = createPlan.argv;
      const firstLabelIdx = argv.indexOf("--label");
      const bodyIdx = argv.indexOf("--body");
      expect(firstLabelIdx).toBeGreaterThan(-1);
      expect(firstLabelIdx).toBeGreaterThan(bodyIdx);
    });

    it("label 값 순서가 commandArgs.createArgs.labels 순서와 정확히 일치(labelValues[i] === createArgs.labels[i], 위치별 대조)", () => {
      const { commandArgs, createPlan } = assembleLabelsOrthogonal(
        evalOutcome(),
        collectOutcome(),
        { ...RUN_A },
      );
      const labelValues = labelValuesOf(createPlan.argv);
      const source = commandArgs.createArgs.labels;
      expect(labelValues.length).toBe(source.length);
      for (let i = 0; i < source.length; i += 1) {
        expect(labelValues[i]).toBe(source[i]);
      }
    });
  });

  describe("핵심 2 — update 분기 labels 부재(orthogonality)", () => {
    it("update plan.argv 에 `--label` 토큰 전무(not.toContain) AND 길이 정확히 7(['issue','edit',String(N),'--title',title,'--body',body])", () => {
      const { updatePlan } = assembleLabelsOrthogonal(
        evalOutcome(),
        collectOutcome(),
        { ...RUN_A },
      );
      expect(updatePlan.argv).not.toContain("--label");
      expect(updatePlan.argv.length).toBe(7);
    });

    it("update plan.argv 의 어떤 원소도 commandArgs.createArgs.labels 의 어느 label 값과도 === 아님(create-only label 이 update 로 새지 않음 — 고정 상수 label 이 title/body 부분과 우연히 겹치지 않음)", () => {
      const { commandArgs, updatePlan } = assembleLabelsOrthogonal(
        evalOutcome(),
        collectOutcome(),
        { ...RUN_A },
      );
      for (const label of commandArgs.createArgs.labels) {
        expect(updatePlan.argv).not.toContain(label);
      }
    });

    it("update plan.argv 의 element 집합이 create plan.argv 대비 labels pair(2*labels.length 원소) 만큼 짧음 — create.length - update.length === 2*labels.length(create-only 전개 폭 대조)", () => {
      const { commandArgs, createPlan, updatePlan } = assembleLabelsOrthogonal(
        evalOutcome(),
        collectOutcome(),
        { ...RUN_A },
      );
      const labelsLen = commandArgs.createArgs.labels.length;
      // create argv = ["issue","create","--title",t,"--body",b, ...2*labelsLen] = 6 + 2*labelsLen.
      // update argv = ["issue","edit",N,"--title",t,"--body",b] = 7.
      // create.length - update.length = (6 + 2*labelsLen) - 7 = 2*labelsLen - 1.
      expect(createPlan.argv.length - updatePlan.argv.length).toBe(
        2 * labelsLen - 1,
      );
    });
  });

  describe("핵심 3 — run/leg outcome 무관 labels 안정(고정 상수)", () => {
    it("(a) 서로 다른 run(A/B) 각각 chain → create plan.argv 의 labelValues 동일(labels 는 run-token 무관 고정 상수) AND 두 update plan.argv 모두 `--label` 전무", () => {
      const chainA = assembleLabelsOrthogonal(evalOutcome(), collectOutcome(), {
        ...RUN_A,
      });
      const chainB = assembleLabelsOrthogonal(evalOutcome(), collectOutcome(), {
        ...RUN_B,
      });
      expect(labelValuesOf(chainA.createPlan.argv)).toEqual(
        labelValuesOf(chainB.createPlan.argv),
      );
      expect(chainA.updatePlan.argv).not.toContain("--label");
      expect(chainB.updatePlan.argv).not.toContain("--label");
    });

    it("(b) 동일 run 에서 leg outcome 을 바꿔도(pass/pass vs fail/skip, overallStatus 변동) create plan.argv 의 labelValues 불변 AND update plan.argv 여전히 `--label` 전무", () => {
      const passChain = assembleLabelsOrthogonal(
        { leg: "eval", action: "run", passed: true },
        { leg: "collect", action: "run", passed: true },
        { ...RUN_A },
      );
      const mixedChain = assembleLabelsOrthogonal(
        { leg: "eval", action: "run", passed: false },
        { leg: "collect", action: "skip" },
        { ...RUN_A },
      );
      // labels 는 leg 상태 무관 불변.
      expect(labelValuesOf(mixedChain.createPlan.argv)).toEqual(
        labelValuesOf(passChain.createPlan.argv),
      );
      // update 분기는 두 경우 모두 labels 전무.
      expect(passChain.updatePlan.argv).not.toContain("--label");
      expect(mixedChain.updatePlan.argv).not.toContain("--label");
      // overallStatus 는 실제로 바뀌었음(안정성 대조 유효성 확인).
      expect(passChain.report.overallStatus).not.toBe(
        mixedChain.report.overallStatus,
      );
    });
  });

  describe("핵심 4 — single-source 독립 재유도 + 결정론", () => {
    it("컴포저 재호출 없이 commandArgs.createArgs.labels 를 진실의 원천으로 삼아 create plan.argv 의 labelValues 가 그 createArgs.labels 와 deep-equal — labels 가 하드코딩이 아니라 createArgs.labels 파생", () => {
      const { commandArgs, createPlan } = assembleLabelsOrthogonal(
        evalOutcome(),
        collectOutcome(),
        { ...RUN_A },
      );
      expect(labelValuesOf(createPlan.argv)).toEqual(
        commandArgs.createArgs.labels,
      );
    });

    it("결정론 — 동일 입력(+ 동일 create/update stdout) 두 번 chain → 두 (create plan.argv, update plan.argv) 쌍 deep-equal(byte-identical)", () => {
      const first = assembleLabelsOrthogonal(evalOutcome(), collectOutcome(), {
        ...RUN_A,
      });
      const second = assembleLabelsOrthogonal(evalOutcome(), collectOutcome(), {
        ...RUN_A,
      });
      expect(first.createPlan.argv).toEqual(second.createPlan.argv);
      expect(first.updatePlan.argv).toEqual(second.updatePlan.argv);
    });
  });

  describe("error path / negative cases — 예외 분기마다 각 1+", () => {
    it("(a) create label pair drift 검출 — chain 산출 create plan.argv 를 복제해 한 label 값 원소를 변형한 synthetic argv 의 labelValues 가 createArgs.labels 와 not.toEqual(single-source 위반 검출)", () => {
      const { commandArgs, createPlan } = assembleLabelsOrthogonal(
        evalOutcome(),
        collectOutcome(),
        { ...RUN_A },
      );
      // 첫 `--label` 다음 원소(첫 label 값)를 변형한 synthetic 복제.
      const idx = createPlan.argv.indexOf("--label");
      const drifted = [...createPlan.argv];
      drifted[idx + 1] = `${drifted[idx + 1]}-x`;
      expect(labelValuesOf(drifted)).not.toEqual(commandArgs.createArgs.labels);
    });

    it("(b) create label 순서 뒤섞임 검출 — labelValues 를 reverse 한 순서의 synthetic argv 의 labelValues 가 createArgs.labels 와 not.toEqual(순서 보존 위반 검출)", () => {
      const { commandArgs, createPlan } = assembleLabelsOrthogonal(
        evalOutcome(),
        collectOutcome(),
        { ...RUN_A },
      );
      // create argv 의 label pair 순서를 뒤집은 synthetic argv 재구성.
      const source = commandArgs.createArgs.labels;
      // labels 가 2개 이상이어야 순서 뒤섞임이 유의미(fixture 상수는 2개).
      expect(source.length).toBeGreaterThanOrEqual(2);
      const base = createPlan.argv.slice(0, createPlan.argv.indexOf("--label"));
      const reversedValues = [...labelValuesOf(createPlan.argv)].reverse();
      const shuffled = [...base];
      for (const label of reversedValues) {
        shuffled.push("--label", label);
      }
      expect(labelValuesOf(shuffled)).not.toEqual(source);
    });

    it("(c) update 분기 label 누출 검출 — update plan.argv 에 `--label` pair 를 인위 주입한 synthetic argv 가 원래 update plan.argv 와 not.toEqual 이며 그 synthetic argv 에는 `--label` 이 toContain(누출 시나리오가 검출 가능함을 박제)", () => {
      const { updatePlan } = assembleLabelsOrthogonal(
        evalOutcome(),
        collectOutcome(),
        { ...RUN_A },
      );
      const leaked = [...updatePlan.argv, "--label", "realdata-e2e"];
      expect(leaked).not.toEqual(updatePlan.argv);
      expect(leaked).toContain("--label");
      // 원래 update plan.argv 는 여전히 label 부재(대조 유효성).
      expect(updatePlan.argv).not.toContain("--label");
    });

    it("(d) descriptor guard 상류 차단(labels 미산출) — run.gitSha 빈/공백이면 descriptor guard throw 로 descriptor(→commandArgs→labels) 자체 미산출(비식별 이슈에 label 누출 차단)", () => {
      expect(() =>
        assembleLabelsOrthogonal(evalOutcome(), collectOutcome(), {
          gitSha: "   ",
          dateToken: RUN_A.dateToken,
        }),
      ).toThrow();
    });

    it("(d') descriptor guard 상류 차단 대칭 — run.dateToken 빈/공백이면 descriptor guard throw(필드별 독립 분기)", () => {
      expect(() =>
        assembleLabelsOrthogonal(evalOutcome(), collectOutcome(), {
          gitSha: RUN_A.gitSha,
          dateToken: "",
        }),
      ).toThrow();
    });

    it("(d'') gh-argv 빌더 guard 상류 차단 — createArgs.title(또는 body) 빈/공백인 commandArgs 를 컴포저(create 분기)에 넣으면 create 분기 guard throw 로 argv(및 labels) 미산출", () => {
      const { commandArgs } = assembleLabelsOrthogonal(
        evalOutcome(),
        collectOutcome(),
        { ...RUN_A },
      );
      // createArgs.title 만 공백으로 오염(labels 는 그대로여도 title guard 가 먼저 throw).
      const badTitle = {
        ...commandArgs,
        createArgs: { ...commandArgs.createArgs, title: "   " },
      };
      expect(() =>
        resolveRealDataDailyStepDualLegRunReportIssueGhCommandPlan(
          "[]",
          badTitle,
        ),
      ).toThrow();
      // createArgs.body 만 공백으로 오염(대칭 분기).
      const badBody = {
        ...commandArgs,
        createArgs: { ...commandArgs.createArgs, body: "" },
      };
      expect(() =>
        resolveRealDataDailyStepDualLegRunReportIssueGhCommandPlan(
          "[]",
          badBody,
        ),
      ).toThrow();
    });

    it("(e) 컴포저 파서 guard 상류 차단(update 분기 argv 미산출) — 비-JSON('{')/비배열 JSON('{}')/number 비양수 hit('[{number:0}]') stdout → 파서/빌더 throw 전파로 update plan(및 그 labels 부재 argv) 미산출", () => {
      expect(() =>
        assembleLabelsOrthogonal(
          evalOutcome(),
          collectOutcome(),
          { ...RUN_A },
          { updateStdout: "{" },
        ),
      ).toThrow();
      expect(() =>
        assembleLabelsOrthogonal(
          evalOutcome(),
          collectOutcome(),
          { ...RUN_A },
          { updateStdout: "{}" },
        ),
      ).toThrow();
      // marker-매칭 hit 이지만 number 비양수(0) → 빌더 issueNumber guard throw 전파.
      expect(() => {
        const base = assembleLabelsOrthogonal(evalOutcome(), collectOutcome(), {
          ...RUN_A,
        });
        const badHit = JSON.stringify([
          {
            number: 0,
            title: "기존 이슈",
            body: base.descriptor.body,
          },
        ]);
        assembleLabelsOrthogonal(
          evalOutcome(),
          collectOutcome(),
          { ...RUN_A },
          { updateStdout: badHit },
        );
      }).toThrow();
    });
  });

  describe("결정론 · 무공유 · no-mutation", () => {
    it("동일 (run, leg outcomes, create/update stdout) 입력 chain 두 번 → create plan.argv·update plan.argv 가 두 번 deep-equal(byte-identical) 이며 서로 다른 배열 인스턴스(무공유)", () => {
      const first = assembleLabelsOrthogonal(evalOutcome(), collectOutcome(), {
        ...RUN_A,
      });
      const second = assembleLabelsOrthogonal(evalOutcome(), collectOutcome(), {
        ...RUN_A,
      });
      expect(first.createPlan.argv).toEqual(second.createPlan.argv);
      expect(first.updatePlan.argv).toEqual(second.updatePlan.argv);
      // 무공유 — referential identity 분리.
      expect(first.createPlan.argv).not.toBe(second.createPlan.argv);
      expect(first.updatePlan.argv).not.toBe(second.updatePlan.argv);
      // 같은 chain 안의 create/update plan 도 서로 다른 인스턴스.
      expect(first.createPlan.argv).not.toBe(first.updatePlan.argv);
    });

    it("무공유 — create plan.argv 의 labelValues 배열을 mutate(push/splice)해도 commandArgs.createArgs.labels 상수·다음 chain 호출 결과에 누설 0(고정 labels 상수 무공유 보존)", () => {
      const first = assembleLabelsOrthogonal(evalOutcome(), collectOutcome(), {
        ...RUN_A,
      });
      const beforeLabels = [...first.commandArgs.createArgs.labels];
      // 추출한 labelValues 배열을 mutate — 이는 argv 파생 복제라 원본과 무공유여야.
      const extracted = labelValuesOf(first.createPlan.argv);
      extracted.push("mutant-label");
      extracted.splice(0, 1);
      // 다음 chain 호출.
      const second = assembleLabelsOrthogonal(evalOutcome(), collectOutcome(), {
        ...RUN_A,
      });
      // commandArgs.createArgs.labels 상수 불변.
      expect(first.commandArgs.createArgs.labels).toEqual(beforeLabels);
      // 다음 호출 결과 불변(mutant-label 누출 0).
      expect(labelValuesOf(second.createPlan.argv)).toEqual(beforeLabels);
      expect(second.createPlan.argv).not.toContain("mutant-label");
    });

    it("no-mutation — chain 호출이 commandArgs(중첩 createArgs.labels 포함) 및 run 을 mutate 0(호출 전후 JSON snapshot deep-equal)", () => {
      const run: RealDataResultIssueRunRef = { ...RUN_A };
      const evalLeg = evalOutcome();
      const collectLeg = collectOutcome();
      const runBefore = JSON.parse(JSON.stringify(run));
      const evalBefore = JSON.parse(JSON.stringify(evalLeg));
      const collectBefore = JSON.parse(JSON.stringify(collectLeg));

      const { commandArgs, descriptor } = assembleLabelsOrthogonal(
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
        hitStdoutOf(descriptor.body, EXISTING_ISSUE_NUMBER),
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
      const { createPlan, updatePlan } = assembleLabelsOrthogonal(
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

    it("label 값들이 고정 결정론 분류 토큰(realdata-e2e 등)만 담고 credential·raw github API 토큰·실 활동 본문 미포함", () => {
      const { createPlan } = assembleLabelsOrthogonal(
        evalOutcome(),
        collectOutcome(),
        { ...RUN_A },
      );
      const labelValues = labelValuesOf(createPlan.argv);
      expect(labelValues).toContain("realdata-e2e");
      for (const label of labelValues) {
        expect(label).not.toContain("ghp_");
        expect(label).not.toContain("GITHUB_TOKEN");
        expect(label).not.toContain("narrative");
      }
    });

    it("leg outcome.specPath 에 sentinel 을 넣어도 create labelValues 에 sentinel 미누출(labels 는 고정 상수라 leg outcome 파생 0)", () => {
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
      const { createPlan } = assembleLabelsOrthogonal(evalLeg, collectLeg, {
        ...RUN_A,
      });
      for (const label of labelValuesOf(createPlan.argv)) {
        expect(label).not.toContain(sentinel);
      }
    });

    it("descriptor guard throw 메시지가 raw 활동 본문·credential 미노출(필드명·유효성만)", () => {
      const sentinel = "ghp_SENTINELsecret1234";
      let message = "";
      try {
        assembleLabelsOrthogonal(
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
