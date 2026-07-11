// realdata-e2e-daily-step-dual-leg-run-report-update-branch-issuenumber-single-
// source-create-absence-orthogonal-convergence-assembly.smoke-spec.ts — 실 평가 e2e
// daily-step dual-leg run report 의 **update 분기 argv 의 issueNumber 원소(index 2)가
// 단일 source(action.issueNumber = marker-매칭 hit 중 최소 number)로부터 `String(N)` 로
// 문자열화되어 관통**하고 **create 분기 argv 및 create action 에는 어떤 issue-number
// 원소·issueNumber 필드도 전무**(issueNumber 는 update-only medium ⊥ create)함을 박제하는
// update-branch issueNumber single-source + create-absence orthogonal convergence
// non-gated build-time smoke (T-0933 박제, PLAN.md 109행 🟢 실 평가 e2e step ④).
//
// 두 action 분기(issueNumber 절단면 — 비대칭 medium):
//   - update 분기 — marker-매칭 hit(1+건)이면 action 이 update 로 해소되어(action
//     `{action:"update", issueNumber:N}`, N = 매칭 hit 중 최소 number, action resolver
//     T-0898) 종단 컴포저 resolveRealDataDailyStepDualLegRunReportIssueGhCommandPlan(
//     stdout, commandArgs)(T-0902)가 argv `["issue","edit",String(N),"--title",title,
//     "--body",body]` 를 산출한다. issueNumber 는 `String(action.issueNumber)`(gh-argv
//     빌더 line 141–149)로 argv **index 2** 에 문자열화되어 온다. update argv 길이는
//     정확히 7.
//   - create 분기 — 빈 search stdout(`"[]"`, marker 미매칭)이면 action 이 create 로
//     해소되어(action `{action:"create"}` — **issueNumber 필드 자체가 부재**) 컴포저가
//     argv `["issue","create","--title",title,"--body",body,...labels]` 를 산출한다.
//     **어떤 issue-number 원소도, `"edit"` verb 도 없다**(create argv 는 issue-number
//     토큰을 전개하지 않는다 — gh-argv 빌더 line 115–130).
//
// 본 spec 의 존재 이유 — issueNumber update-single-source + create-absence orthogonal
// seam 봉합:
//   issueNumber 는 **update-only medium** 이다: 오늘 밤 run 이 이슈를 새로 만들 때
//   (create)는 아직 이슈 번호가 없어 참조하지 않고, 내일 밤 run 이 그 이슈를 갱신할
//   때(update)만 검색으로 찾은 기존 이슈의 번호 N 을 `gh issue edit N` 의 대상으로
//   지목한다(REQ-009 — 동일 run 의 이슈를 다음 밤 검색이 marker 로 찾아 **그 번호로**
//   재갱신). 만약 create 분기 argv 에 issue-number 가 새면(silent leak) — 아직
//   존재하지 않는 이슈 번호로 `gh issue create` 를 호출해 명령이 실패하거나 엉뚱한
//   이슈를 건드린다. 반대로 update 분기 argv 의 issueNumber 가 search-hit N 이 아닌
//   다른 값으로 어긋나면 — 갱신이 엉뚱한 이슈를 덮어써 멱등 rolling-issue 추적이 깨진다.
//
//   이것은 형제 T-0932 의 labels(create-only medium — create 에만 붙고 update 에는
//   없음)의 **정확한 거울상**이다: labels 는 create-only, issueNumber 는 update-only.
//   두 비대칭 medium 이 서로 반대 분기에만 등장하며 상대 분기에는 전무하다.
//
//   형제 smoke 들이 각기 다른 축만 닫았다:
//     * T-0932(labels create-only + update-absence)는 **labels medium** 이 create argv
//       로만 `--label` pair 전개되고 update argv 에는 전무한 orthogonality 만 자산화한다
//       — issueNumber 는 다루지 않는다. 본 spec 은 그 **정확한 거울상**(medium=
//       issueNumber, 축=update-only single-source + create-absence orthogonality)이다.
//     * T-0920(edit-argv issueNumber execute-side single-source closure)은 **update
//       분기 내부**에서 search-hit N → resolveAction → edit-argv → output-parse 가
//       single-source 로 닫힘만 자산화한다 — issueNumber 가 **create 분기 argv 및
//       create action 에 전무**하다는 두 분기 비대칭(orthogonality)은 미단언(update
//       분기 내부 closure 라 create 분기와 대조하지 않음).
//     * T-0921(marker⊥issueNumber orthogonal)은 **searchArgv marker medium 과 editArgv
//       issueNumber medium** 이 서로 직교(독립 source)함만 자산화한다 — 이는 **두 다른
//       medium** 의 직교이며, issueNumber 라는 **한 medium** 의 create/update 분기
//       비대칭(update-only)은 다른 축이다.
//     * T-0930(title cross-branch)·T-0931(body cross-branch)은 title/body 가 **두 분기
//       모두 등장**하며 byte-identical 관통함(cross-branch 대칭)만 자산화한다 —
//       issueNumber 는 update 에만 등장하는 비대칭 medium 이라 축이 다르다.
//     * T-0927(gh-command-plan argv single-source)은 plan.argv 가 single-source gh-argv
//       빌더 산출과 byte-identical 함(각 분기 **내부** 정합)만 자산화한다 — issueNumber
//       가 정확히 index 2 로 관통하는 세부, create 분기에는 issue-number 가 전무하다는
//       **비대칭(orthogonality)** 은 미단언.
//
//   본 spec 은 그 **issueNumber update-branch single-source + create-absence orthogonal
//   seam** 을 닫는다 — T-0932(labels create-only + update-absence)의 **거울상 sibling
//   (medium=issueNumber, update-only ⊥ create)** 으로, `report → descriptor →
//   commandArgs → (1) marker-매칭 hit stdout 에 종단 컴포저 → update plan.argv, (2) 빈
//   search "[]" 에 종단 컴포저 → create plan.argv` 조립에서 update plan.argv[2] ===
//   String(N) === String(plan.action.issueNumber) 로 search-hit number 로부터 단일
//   source 관통하고 create plan.argv 및 action 에는 issueNumber 원소·필드가 부재함을
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
// Out of Scope (T-0933):
//   - production src/ 코드 / descriptor·command-args·action resolver(issueNumber 최소
//     number 선택)·gh-argv(issueNumber index 2 전개·create 부재)·gh-command-plan helper
//     본문 변경 — import·호출만(배선은 T-0896~T-0902 로 이미 main 박제).
//   - 형제 T-0932 의 labels create-only medium(create argv `--label` pair 전개 + update
//     부재) 축 재단언 — 본 spec 은 그 거울상으로 medium 이 labels 가 아니라 issueNumber
//     이며 축이 create-only 가 아니라 update-only single-source + create-absence
//     orthogonality.
//   - 형제 T-0920 의 issueNumber execute-side single-source closure(update 분기 내부)
//     축 재단언 — 본 spec 은 update 분기 내부 closure 가 아니라 create 부재 orthogonality.
//   - 형제 T-0921 의 searchArgv marker ⊥ editArgv issueNumber(두 다른 medium) 직교 축
//     재단언 — 본 spec 은 issueNumber 한 medium 의 update-only ⊥ create absence.
//   - 형제 T-0930/T-0931 의 title·body cross-branch(두 분기 대칭)·T-0927 의 argv
//     single-source(분기별 내부 정합) 축 재단언 — import·호출만.
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

// 서로 다른 run — gitSha·dateToken 이 RUN_A 와 서로 substring 이 아닌 구별 가능 값.
// issueNumber 는 search-hit 종속이라 run 을 바꿔도(동일 hit N 이면) 불변임을 대조하기
// 위한 run 분포 변별용(title/body 와 대비).
const RUN_B: RealDataResultIssueRunRef = {
  gitSha: "def5678",
  dateToken: "2026-07-12",
};

// 기존 이슈 번호 fixture — marker-매칭 hit stdout 의 number(= update 분기 issueNumber).
// gitSha("abc1234")·dateToken("2026-07-11")·고정 label 상수와 우연히 겹치지 않는 양의
// 정수로 선택(issueNumber 등장 유일성·부재 대조가 title/body 부분과 오염되지 않도록).
const EXISTING_ISSUE_NUMBER = 8899;

// synthetic leg outcome fixture — eval / collect 각 leg 의 run outcome literal. 조립
// 체인은 leg outcome 을 report → descriptor 로 흘려보내는 surface 만 검증하므로 도메인
// 타입 정합만 만족하는 minimal literal 로 충분하다(실 jest spawn 0).
function evalOutcome(): RealDataDailyStepLegRunOutcome {
  return { leg: "eval", action: "run", passed: true };
}

function collectOutcome(): RealDataDailyStepLegRunOutcome {
  return { leg: "collect", action: "run", passed: true };
}

// marker-매칭 hit stdout 합성 — 기존 이슈 검색이 이 run 의 marker 를 body 에 담은 이슈
// 1건(number = issueNumber)을 반환하는 상황을 synthetic literal 로 재현한다(실 gh search
// 실행 0). body 에 descriptor.body(선두 marker 포함)를 그대로 담아야 action resolver 가
// update 로 해소한다.
function hitStdoutOf(body: string, issueNumber: number): string {
  return JSON.stringify([
    {
      number: issueNumber,
      title: "기존 dual-leg run report 이슈",
      body,
    },
  ]);
}

// issueNumber update-single-source + create-absence 조립 진입점 — 단일 source(run + 두
// leg outcome) 로부터 report → descriptor → commandArgs 를 관통시켜 유효 commandArgs 를
// 얻고, (1) marker-매칭 hit stdout(= descriptor.body 를 담은 이슈 1건)에 종단 컴포저를
// 적용해 update plan(issueNumber index 2 포함)을, (2) 빈 search "[]" 에 적용해 create
// plan(issueNumber 전무)을 각각 산출한다. 각 stage 의 guard throw 는 자체 try/catch 없이
// 그대로 전파된다. opts.updateStdout / opts.issueNumber 로 파서·복수 hit·최소 number
// negative test 도 같은 진입점을 재사용한다.
function assembleIssueNumberOrthogonal(
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
  // (2) command-args — searchQuery(=descriptor.marker), createArgs{title,body,labels},
  // updateArgs{title,body}. update action shape 에는 issueNumber 필드가 없다(source =
  // search-hit N).
  const commandArgs =
    buildRealDataDailyStepDualLegRunReportIssueCommandArgs(descriptor);
  // (3) create 분기 — 빈 search "[]"(marker 미매칭) → action create → issue create argv
  // (issue-number 전무).
  const createStdout = opts?.createStdout ?? "[]";
  const createPlan = resolveRealDataDailyStepDualLegRunReportIssueGhCommandPlan(
    createStdout,
    commandArgs,
  );
  // (4) update 분기 — marker-매칭 hit stdout(descriptor.body 를 담은 이슈) → action
  // update(issueNumber = hit number) → issue edit argv(issueNumber index 2).
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

describe("Smoke(non-gated): dual-leg run report update-branch issueNumber single-source(argv index 2 = String(N)) + create-branch issueNumber absence(orthogonality) live-gh 0 검증", () => {
  describe("happy path — update-branch issueNumber single-source 관통", () => {
    it("단일 source(run + 두 leg outcome) → update plan(action='update', issueNumber===N, argv[0..1]=['issue','edit']), update plan.argv[2] === String(N) === String(plan.action.issueNumber) AND update plan.argv 길이 정확히 7", () => {
      const { updatePlan } = assembleIssueNumberOrthogonal(
        evalOutcome(),
        collectOutcome(),
        { ...RUN_A },
      );

      expect(updatePlan.action.action).toBe("update");
      expect(updatePlan.argv[0]).toBe("issue");
      expect(updatePlan.argv[1]).toBe("edit");
      if (updatePlan.action.action === "update") {
        // action.issueNumber = search-hit number(single source).
        expect(updatePlan.action.issueNumber).toBe(EXISTING_ISSUE_NUMBER);
        // argv index 2 = String(action.issueNumber)(index 2 로 문자열화 관통).
        expect(updatePlan.argv[2]).toBe(String(updatePlan.action.issueNumber));
        expect(updatePlan.argv[2]).toBe(String(EXISTING_ISSUE_NUMBER));
      }
      // update argv = ["issue","edit",String(N),"--title",title,"--body",body] = 길이 7.
      expect(updatePlan.argv.length).toBe(7);
    });

    it("create plan(action='create', argv[0..1]=['issue','create']) 이 정상 해소되고 create plan.action 에 issueNumber 필드 부재 — 두 분기 진입 확인", () => {
      const { createPlan } = assembleIssueNumberOrthogonal(
        evalOutcome(),
        collectOutcome(),
        { ...RUN_A },
      );
      expect(createPlan.action.action).toBe("create");
      expect(createPlan.argv[0]).toBe("issue");
      expect(createPlan.argv[1]).toBe("create");
      // create action 에는 issueNumber 필드 자체가 없다(update-only source).
      expect(
        (createPlan.action as { issueNumber?: number }).issueNumber,
      ).toBeUndefined();
    });
  });

  describe("핵심 1 — update 분기 issueNumber 등장 유일성(index 2)", () => {
    it("update plan.argv 에서 String(N) 이 정확히 index 2 로만 등장 — 다른 원소(issue/edit/--title/title/--body/body)에는 String(N) 부재(N 은 title/body 와 겹치지 않는 값)", () => {
      const { updatePlan } = assembleIssueNumberOrthogonal(
        evalOutcome(),
        collectOutcome(),
        { ...RUN_A },
      );
      const target = String(EXISTING_ISSUE_NUMBER);
      const occurrences = updatePlan.argv
        .map((el, i) => (el === target ? i : -1))
        .filter((i) => i >= 0);
      // String(N) 은 정확히 index 2 한 곳에서만 등장.
      expect(occurrences).toEqual([2]);
    });

    it("update plan.argv 에서 issueNumber(index 2)가 base verb(issue/edit) 뒤·flag 인자(--title) 앞에 위치 — argv[1]==='edit' && argv[2]===String(N) && argv[3]==='--title'", () => {
      const { updatePlan } = assembleIssueNumberOrthogonal(
        evalOutcome(),
        collectOutcome(),
        { ...RUN_A },
      );
      expect(updatePlan.argv[1]).toBe("edit");
      expect(updatePlan.argv[2]).toBe(String(EXISTING_ISSUE_NUMBER));
      expect(updatePlan.argv[3]).toBe("--title");
    });
  });

  describe("핵심 2 — create 분기 issueNumber 부재(orthogonality)", () => {
    it("create plan.action 에 issueNumber 필드 부재(undefined AND 'issueNumber' in action === false)", () => {
      const { createPlan } = assembleIssueNumberOrthogonal(
        evalOutcome(),
        collectOutcome(),
        { ...RUN_A },
      );
      expect(
        (createPlan.action as { issueNumber?: number }).issueNumber,
      ).toBeUndefined();
      expect("issueNumber" in createPlan.action).toBe(false);
    });

    it("create plan.argv 의 어떤 원소도 String(N)(update 분기의 issue-number) 과 === 아님 — update issue-number 가 create 로 새지 않음", () => {
      const { createPlan } = assembleIssueNumberOrthogonal(
        evalOutcome(),
        collectOutcome(),
        { ...RUN_A },
      );
      expect(createPlan.argv).not.toContain(String(EXISTING_ISSUE_NUMBER));
    });

    it("create plan.argv 에 'edit' verb 부재(not.toContain 'edit') — create 는 edit 대상 번호를 갖지 않는다", () => {
      const { createPlan } = assembleIssueNumberOrthogonal(
        evalOutcome(),
        collectOutcome(),
        { ...RUN_A },
      );
      expect(createPlan.argv).not.toContain("edit");
    });
  });

  describe("핵심 3 — run/leg outcome 무관 issueNumber 안정(search-hit 종속)", () => {
    it("(a) 서로 다른 run(A/B) 각각 chain(동일 hit number N 주입) → 두 update plan.argv[2] 동일(String(N) — issueNumber 는 run-token 무관) AND 두 create plan.argv 모두 String(N)·'edit' 전무", () => {
      // 각 run 의 descriptor.body 를 hit body 로 세팅해야 marker 매칭이 성립하므로
      // updateStdout 은 각 chain 이 자체 descriptor.body 로 구성(기본 경로).
      const chainA = assembleIssueNumberOrthogonal(
        evalOutcome(),
        collectOutcome(),
        { ...RUN_A },
      );
      const chainB = assembleIssueNumberOrthogonal(
        evalOutcome(),
        collectOutcome(),
        { ...RUN_B },
      );
      // issueNumber 는 search-hit N 종속 — 두 run 이 같은 N 을 검색으로 찾으면 동일.
      expect(chainA.updatePlan.argv[2]).toBe(String(EXISTING_ISSUE_NUMBER));
      expect(chainB.updatePlan.argv[2]).toBe(String(EXISTING_ISSUE_NUMBER));
      expect(chainA.updatePlan.argv[2]).toBe(chainB.updatePlan.argv[2]);
      // create 분기는 두 run 모두 issue-number·edit 전무.
      expect(chainA.createPlan.argv).not.toContain(
        String(EXISTING_ISSUE_NUMBER),
      );
      expect(chainB.createPlan.argv).not.toContain(
        String(EXISTING_ISSUE_NUMBER),
      );
      expect(chainA.createPlan.argv).not.toContain("edit");
      expect(chainB.createPlan.argv).not.toContain("edit");
    });

    it("(b) 동일 run 에서 leg outcome 을 바꿔도(pass/pass vs fail/skip, overallStatus 변동) update plan.argv[2] 불변(issueNumber 는 leg 상태 무관 search-hit N) AND create plan.argv 여전히 String(N)·'edit' 전무", () => {
      const passChain = assembleIssueNumberOrthogonal(
        { leg: "eval", action: "run", passed: true },
        { leg: "collect", action: "run", passed: true },
        { ...RUN_A },
      );
      const mixedChain = assembleIssueNumberOrthogonal(
        { leg: "eval", action: "run", passed: false },
        { leg: "collect", action: "skip" },
        { ...RUN_A },
      );
      // issueNumber 는 leg 상태 무관 불변.
      expect(mixedChain.updatePlan.argv[2]).toBe(passChain.updatePlan.argv[2]);
      expect(mixedChain.updatePlan.argv[2]).toBe(String(EXISTING_ISSUE_NUMBER));
      // create 분기는 두 경우 모두 issue-number·edit 전무.
      expect(passChain.createPlan.argv).not.toContain(
        String(EXISTING_ISSUE_NUMBER),
      );
      expect(mixedChain.createPlan.argv).not.toContain(
        String(EXISTING_ISSUE_NUMBER),
      );
      expect(passChain.createPlan.argv).not.toContain("edit");
      expect(mixedChain.createPlan.argv).not.toContain("edit");
      // overallStatus 는 실제로 바뀌었음(안정성 대조 유효성 확인).
      expect(passChain.report.overallStatus).not.toBe(
        mixedChain.report.overallStatus,
      );
    });
  });

  describe("핵심 4 — single-source 독립 재유도 + 복수 hit 최소 number + 결정론", () => {
    it("컴포저 재호출 없이 plan.action.issueNumber(update plan)를 진실의 원천으로 삼아 update plan.argv[2] === String(plan.action.issueNumber) — argv issueNumber 가 하드코딩이 아니라 action.issueNumber 파생", () => {
      const { updatePlan } = assembleIssueNumberOrthogonal(
        evalOutcome(),
        collectOutcome(),
        { ...RUN_A },
      );
      if (updatePlan.action.action === "update") {
        expect(updatePlan.argv[2]).toBe(String(updatePlan.action.issueNumber));
      }
    });

    it("복수 marker-매칭 hit([{number:9},{number:4}], 둘 다 marker 매칭 body)에서 action.issueNumber 가 최소 number(4)로 결정 AND update plan.argv[2] === '4'(issueNumber source = 최소 hit number)", () => {
      const base = assembleIssueNumberOrthogonal(
        evalOutcome(),
        collectOutcome(),
        { ...RUN_A },
      );
      const multiHit = JSON.stringify([
        { number: 9, title: "기존 이슈 A", body: base.descriptor.body },
        { number: 4, title: "기존 이슈 B", body: base.descriptor.body },
      ]);
      const { updatePlan } = assembleIssueNumberOrthogonal(
        evalOutcome(),
        collectOutcome(),
        { ...RUN_A },
        { updateStdout: multiHit },
      );
      expect(updatePlan.action.action).toBe("update");
      if (updatePlan.action.action === "update") {
        expect(updatePlan.action.issueNumber).toBe(4);
      }
      expect(updatePlan.argv[2]).toBe("4");
    });

    it("결정론 — 동일 입력(+ 동일 hit stdout) 두 번 chain → 두 (update plan, create plan) 쌍 deep-equal(byte-identical)", () => {
      const first = assembleIssueNumberOrthogonal(
        evalOutcome(),
        collectOutcome(),
        { ...RUN_A },
      );
      const second = assembleIssueNumberOrthogonal(
        evalOutcome(),
        collectOutcome(),
        { ...RUN_A },
      );
      expect(first.updatePlan).toEqual(second.updatePlan);
      expect(first.createPlan).toEqual(second.createPlan);
    });
  });

  describe("error path / negative cases — 예외 분기마다 각 1+", () => {
    it("(a) update issueNumber drift 검출 — chain 산출 update plan.argv 를 복제해 index 2 원소를 변형(String(N)→String(N+1))한 synthetic argv 의 argv[2] 가 String(plan.action.issueNumber) 와 !==(single-source 위반 검출)", () => {
      const { updatePlan } = assembleIssueNumberOrthogonal(
        evalOutcome(),
        collectOutcome(),
        { ...RUN_A },
      );
      const drifted = [...updatePlan.argv];
      drifted[2] = String(EXISTING_ISSUE_NUMBER + 1);
      if (updatePlan.action.action === "update") {
        expect(drifted[2]).not.toBe(String(updatePlan.action.issueNumber));
      }
      // 원래 update plan.argv 는 여전히 정합(대조 유효성).
      expect(updatePlan.argv[2]).toBe(String(EXISTING_ISSUE_NUMBER));
    });

    it("(b) create 분기 issueNumber 누출 검출 — create plan.argv 를 복제해 index 2 에 String(N) 인위 주입(및 'create'→'edit')한 synthetic argv 가 원래 create plan.argv 와 not.toEqual 이며 그 synthetic argv 에는 String(N) 이 toContain(누출 시나리오 검출 가능성 박제 — update-only 불변 위반)", () => {
      const { createPlan } = assembleIssueNumberOrthogonal(
        evalOutcome(),
        collectOutcome(),
        { ...RUN_A },
      );
      const leaked = [...createPlan.argv];
      leaked[1] = "edit";
      leaked.splice(2, 0, String(EXISTING_ISSUE_NUMBER));
      expect(leaked).not.toEqual(createPlan.argv);
      expect(leaked).toContain(String(EXISTING_ISSUE_NUMBER));
      // 원래 create plan.argv 는 여전히 issue-number·edit 부재(대조 유효성).
      expect(createPlan.argv).not.toContain(String(EXISTING_ISSUE_NUMBER));
      expect(createPlan.argv).not.toContain("edit");
    });

    it("(c) argv 빌더 issueNumber guard 상류 차단 — marker-매칭 이지만 number 비양수(0 / 음수 -3 / 비정수 hit)면 assertPositiveNumber/assertPositiveIssueNumber throw 로 update plan(및 issueNumber 원소) 미산출", () => {
      const base = assembleIssueNumberOrthogonal(
        evalOutcome(),
        collectOutcome(),
        { ...RUN_A },
      );
      const zeroHit = JSON.stringify([
        { number: 0, title: "기존 이슈", body: base.descriptor.body },
      ]);
      expect(() =>
        assembleIssueNumberOrthogonal(
          evalOutcome(),
          collectOutcome(),
          { ...RUN_A },
          {
            updateStdout: zeroHit,
          },
        ),
      ).toThrow();
      const negativeHit = JSON.stringify([
        { number: -3, title: "기존 이슈", body: base.descriptor.body },
      ]);
      expect(() =>
        assembleIssueNumberOrthogonal(
          evalOutcome(),
          collectOutcome(),
          { ...RUN_A },
          {
            updateStdout: negativeHit,
          },
        ),
      ).toThrow();
      const fractionHit = JSON.stringify([
        { number: 1.5, title: "기존 이슈", body: base.descriptor.body },
      ]);
      expect(() =>
        assembleIssueNumberOrthogonal(
          evalOutcome(),
          collectOutcome(),
          { ...RUN_A },
          {
            updateStdout: fractionHit,
          },
        ),
      ).toThrow();
    });

    it("(d) descriptor guard 상류 차단(issueNumber 관통 이전 chain 차단) — run.gitSha 빈/공백이면 descriptor guard throw 로 descriptor(→commandArgs→action→argv) 자체 미산출(비식별 이슈 갱신 차단)", () => {
      expect(() =>
        assembleIssueNumberOrthogonal(evalOutcome(), collectOutcome(), {
          gitSha: "   ",
          dateToken: RUN_A.dateToken,
        }),
      ).toThrow();
    });

    it("(d') descriptor guard 상류 차단 대칭 — run.dateToken 빈/공백이면 descriptor guard throw(필드별 독립 분기)", () => {
      expect(() =>
        assembleIssueNumberOrthogonal(evalOutcome(), collectOutcome(), {
          gitSha: RUN_A.gitSha,
          dateToken: "",
        }),
      ).toThrow();
    });

    it("(e) 컴포저 파서 guard 상류 차단(update 분기 argv 미산출) — 비-JSON('{')/비배열 JSON('{}') stdout → 파서 throw 전파로 update plan(및 그 issueNumber argv) 미산출", () => {
      expect(() =>
        assembleIssueNumberOrthogonal(
          evalOutcome(),
          collectOutcome(),
          { ...RUN_A },
          { updateStdout: "{" },
        ),
      ).toThrow();
      expect(() =>
        assembleIssueNumberOrthogonal(
          evalOutcome(),
          collectOutcome(),
          { ...RUN_A },
          { updateStdout: "{}" },
        ),
      ).toThrow();
    });
  });

  describe("결정론 · 무공유 · no-mutation", () => {
    it("동일 (run, leg outcomes, hit stdout) 입력 chain 두 번 → update plan.argv·create plan.argv 가 두 번 deep-equal(byte-identical) 이며 서로 다른 배열 인스턴스(무공유)", () => {
      const first = assembleIssueNumberOrthogonal(
        evalOutcome(),
        collectOutcome(),
        { ...RUN_A },
      );
      const second = assembleIssueNumberOrthogonal(
        evalOutcome(),
        collectOutcome(),
        { ...RUN_A },
      );
      expect(first.updatePlan.argv).toEqual(second.updatePlan.argv);
      expect(first.createPlan.argv).toEqual(second.createPlan.argv);
      // 무공유 — referential identity 분리.
      expect(first.updatePlan.argv).not.toBe(second.updatePlan.argv);
      expect(first.createPlan.argv).not.toBe(second.createPlan.argv);
      // 같은 chain 안의 update/create plan 도 서로 다른 인스턴스.
      expect(first.updatePlan.argv).not.toBe(first.createPlan.argv);
    });

    it("무공유 — update plan.argv 를 mutate(push/splice/index 2 변경)해도 다음 chain 호출 결과·plan.action.issueNumber 에 누설 0", () => {
      const first = assembleIssueNumberOrthogonal(
        evalOutcome(),
        collectOutcome(),
        { ...RUN_A },
      );
      const issueNumberBefore =
        first.updatePlan.action.action === "update"
          ? first.updatePlan.action.issueNumber
          : -1;
      // update plan.argv 를 mutate — 파생 배열이라 원본·다음 호출과 무공유여야.
      first.updatePlan.argv[2] = "999999";
      first.updatePlan.argv.push("mutant");
      const second = assembleIssueNumberOrthogonal(
        evalOutcome(),
        collectOutcome(),
        { ...RUN_A },
      );
      // 다음 호출 결과 불변(mutant·999999 누출 0).
      expect(second.updatePlan.argv[2]).toBe(String(EXISTING_ISSUE_NUMBER));
      expect(second.updatePlan.argv).not.toContain("mutant");
      expect(second.updatePlan.argv.length).toBe(7);
      // action.issueNumber 는 argv mutate 무관 불변.
      expect(issueNumberBefore).toBe(EXISTING_ISSUE_NUMBER);
      if (first.updatePlan.action.action === "update") {
        expect(first.updatePlan.action.issueNumber).toBe(EXISTING_ISSUE_NUMBER);
      }
    });

    it("no-mutation — chain 호출이 commandArgs(중첩 createArgs/updateArgs 포함)·run·hit stdout(문자열 불변)을 mutate 0(호출 전후 JSON snapshot deep-equal)", () => {
      const run: RealDataResultIssueRunRef = { ...RUN_A };
      const evalLeg = evalOutcome();
      const collectLeg = collectOutcome();
      const runBefore = JSON.parse(JSON.stringify(run));
      const evalBefore = JSON.parse(JSON.stringify(evalLeg));
      const collectBefore = JSON.parse(JSON.stringify(collectLeg));

      const { commandArgs, descriptor, updateStdout } =
        assembleIssueNumberOrthogonal(evalLeg, collectLeg, run);
      const commandArgsSnapshot = JSON.parse(JSON.stringify(commandArgs));
      const updateStdoutSnapshot = updateStdout;

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
      // stdout 문자열은 불변(재사용 시 동일).
      expect(updateStdout).toBe(updateStdoutSnapshot);
    });
  });

  describe("raw / credential 누출 0(R-59 / REQ-059)", () => {
    it("update·create plan.argv 의 어느 원소도 GH_TOKEN/PAT/ghp_/--token/GITHUB_TOKEN 어휘 미포함", () => {
      const { createPlan, updatePlan } = assembleIssueNumberOrthogonal(
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

    it("issueNumber 원소(update argv index 2)가 순수 숫자 문자열(/^\\d+$/)만 담고 credential·raw github API 토큰·실 활동 본문 미포함", () => {
      const { updatePlan } = assembleIssueNumberOrthogonal(
        evalOutcome(),
        collectOutcome(),
        { ...RUN_A },
      );
      expect(updatePlan.argv[2]).toMatch(/^\d+$/);
      expect(updatePlan.argv[2]).not.toContain("ghp_");
      expect(updatePlan.argv[2]).not.toContain("narrative");
    });

    it("leg outcome.specPath 에 sentinel 을 넣어도 update argv index 2(issueNumber)에 sentinel 미누출(issueNumber 는 search-hit N 파생이라 leg outcome 무관)", () => {
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
      const { updatePlan } = assembleIssueNumberOrthogonal(
        evalLeg,
        collectLeg,
        {
          ...RUN_A,
        },
      );
      expect(updatePlan.argv[2]).toBe(String(EXISTING_ISSUE_NUMBER));
      expect(updatePlan.argv[2]).not.toContain(sentinel);
    });

    it("argv 빌더 issueNumber guard throw 메시지가 raw 활동 본문·credential 미노출(필드명·유효성만)", () => {
      const base = assembleIssueNumberOrthogonal(
        evalOutcome(),
        collectOutcome(),
        { ...RUN_A },
      );
      const sentinel = "ghp_SENTINELsecret1234";
      // body 에 sentinel 을 섞은 비양수 number hit — guard throw 메시지에 sentinel 미노출 확인.
      const badHit = JSON.stringify([
        {
          number: 0,
          title: "기존 이슈",
          body: `${base.descriptor.body}\n${sentinel}`,
        },
      ]);
      let message = "";
      try {
        assembleIssueNumberOrthogonal(
          evalOutcome(),
          collectOutcome(),
          { ...RUN_A },
          {
            updateStdout: badHit,
          },
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
