// realdata-e2e-daily-step-dual-leg-run-report-action-verb-dispatch-single-source-
// convergence-assembly.smoke-spec.ts — 실 평가 e2e
// daily-step dual-leg run report 의 **create-or-update action 분기(어느 argv 로 보낼지)가
// search stdout 의 marker-match 술어(`hit.body.includes(marker)`의 매칭 hit 존재 여부)로부터
// 단일 source 로 결정되고, 그 action 이 argv[1] verb 로 비대칭 매핑(create action → "create",
// update action → "edit" — update→"update" 아님)되며 argv[0]==="issue" 는 두 분기 불변**임을
// 박제하는 action-verb dispatch single-source convergence non-gated build-time smoke
// (T-0934 박제, PLAN.md 109행 🟢 실 평가 e2e step ④).
//
// dispatch discriminant(분기 선택 판단 — field 와 독립된 축):
//   - dispatch 술어 — resolveRealDataDailyStepDualLegRunReportIssueAction(hits, marker)
//     (T-0898)는 `hits.filter((h) => h.body.includes(marker))` 의 매칭 후보 개수로 분기한다.
//     후보 0건 → {action:"create"}, 1+건 → {action:"update", issueNumber:최소 number}. 즉
//     discriminant 는 **search 응답의 non-emptiness 가 아니라 body-marker 포함 술어의 매칭
//     hit 존재 여부** 다 — marker 미포함 hit 만 잔뜩 와도(비매칭·non-empty) 여전히 create.
//   - action→verb 비대칭 매핑 — buildRealDataDailyStepDualLegRunReportIssueGhArgv(T-0899)는
//     create action → ["issue","create", ...], update action → ["issue","edit", ...] 를 낸다.
//     argv[0] 은 두 분기 모두 상수 "issue"(공유 base 명령 noun). argv[1] 이 유일한 discriminant
//     이며 update action 은 "update" 가 **아니라** "edit" verb 로 매핑된다(gh CLI 는 gh issue
//     edit N — 비대칭). plan.action.action("create"/"update") ↔ argv[1]("create"/"edit") 는
//     종단 컴포저 resolveRealDataDailyStepDualLegRunReportIssueGhCommandPlan(stdout, commandArgs)
//     (T-0902, 3단계 위임 parse→resolveAction→buildGhArgv)를 통해 단일 source 로 묶인다.
//
// 본 spec 의 존재 이유 — action-verb dispatch single-source seam 봉합:
//   지금까지 형제 chain 은 각 분기에 실리는 **field 내용** medium 을 하나씩 봉합했다:
//     * title/body(T-0930/T-0931) — 두 분기 모두 등장하는 대칭 field cross-branch.
//     * labels(T-0932) — create 분기에만 붙는 비대칭 field(create-only ⊥ update).
//     * issueNumber(T-0933) — update 분기에만 붙는 비대칭 field(update-only ⊥ create).
//     * marker(T-0928/T-0929) — searchArgv / body 선두 라인으로 관통하는 field.
//   그러나 이 field 들을 **어느 분기(create argv vs edit argv)로 보낼지 결정하는 dispatch
//   판단** 은 field 와 독립된 별개의 축이다. 만약 dispatch 가 어긋나면 — marker-매칭 hit 이
//   있는데도 create 로 새면 매 밤 새 이슈를 만들어 rolling-issue 멱등이 깨지고(REQ-009 —
//   동일 run 의 기존 이슈를 찾아 갱신·중복 생성 안 함), 반대로 빈/비매칭 search 인데 update 로
//   새면 존재하지 않는 이슈를 gh issue edit 대상으로 지목해 명령이 실패한다. 또 update action 이
//   argv[1]==="update" 같은 잘못된 verb 로 매핑되면 gh CLI 가 그런 subcommand 를 모르므로 실행
//   자체가 실패한다.
//
//   형제 smoke 들이 각기 다른 축만 닫았다:
//     * T-0927(gh-command-plan argv single-source)은 고정 hit stdout 하 각 분기 argv 가
//       buildGhArgv 산출과 byte-identical 함(분기 **내부** 정합)만 자산화한다 — dispatch
//       **술어 경계**(empty vs 비매칭 hit vs 매칭 hit 를 sweep 해 어느 조건이 create/update 를
//       낳는지)와 plan.action.action ↔ argv[1] verb 비대칭 매핑(update→"edit")은 미단언.
//     * T-0932/T-0933(labels/issueNumber orthogonal)은 field 가 자신의 분기에만 붙고 상대
//       분기엔 없음(field 존재/부재)만 자산화한다 — 분기 선택 판단 자체는 다루지 않는다.
//     * T-0922(republish create→update idempotency)은 두 publish cycle 에 걸친 create-output
//       M threading 상태 전이만 자산화한다 — 단일 publish 안 dispatch 술어 경계 아님.
//     * T-0920(edit-argv issueNumber closure)은 update 분기 내부 search-hit N → resolve →
//       edit-argv 관통만 자산화한다 — create/update 분기 선택 자체는 대조 대상 아님.
//
//   본 spec 은 그 **action-verb dispatch single-source seam** 을 닫는다 — 두 leg outcome +
//   run → report → descriptor → commandArgs 를 통과시켜 유효 commandArgs 를 얻고, 종단 컴포저를
//   (1) 빈 search "[]" (2) marker-미매칭 hit stdout (3) marker-매칭 hit stdout 세 입력에 각각
//   적용해, (1)·(2)는 plan.action.action==="create" + argv[0..1]===["issue","create"], (3)는
//   plan.action.action==="update" + argv[0..1]===["issue","edit"] 로 dispatch 되며 argv[0]===
//   "issue" 는 세 경우 불변, dispatch discriminant 가 body-marker 술어(응답 non-emptiness 아님)
//   임을 public CI 그물로 박제한다. 따라서 본 spec 은:
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
// Out of Scope (T-0934):
//   - production src/ 코드 / descriptor·command-args·action resolver(dispatch 술어·최소
//     number 선택)·gh-argv(create→"create"/update→"edit" 매핑)·gh-command-plan helper 본문
//     변경 — import·호출만(배선은 T-0896~T-0902 로 이미 main 박제).
//   - 형제 T-0927 의 고정 hit stdout 하 각 분기 argv byte-identical 축 재단언 — 본 spec 은
//     dispatch 술어 경계 sweep(empty vs 비매칭 hit vs 매칭 hit)과 action↔verb 비대칭 매핑.
//   - 형제 T-0932/T-0933 의 field 존재/부재 orthogonality 축 재단언 — 본 spec 은 field 를
//     어느 분기로 보낼지의 branch-selection 판단.
//   - 형제 T-0922 의 cross-publish create→update 상태 전이 축 재단언 — 본 spec 은 단일
//     publish 안의 dispatch 술어→verb 관통.
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

// 서로 다른 run — gitSha·dateToken 이 RUN_A 와 서로 substring 이 아닌 구별 가능 값. dispatch 는
// search-술어(매칭 hit 존재) 파생이라 run 을 바꿔도(각 run 의 marker 로 매칭 hit 구성 시) 동일
// dispatch 임을 대조하기 위한 run 분포 변별용.
const RUN_B: RealDataResultIssueRunRef = {
  gitSha: "def5678",
  dateToken: "2026-07-12",
};

// 기존 이슈 번호 fixture — marker-매칭 hit stdout 의 number(= update 분기 dispatch trigger).
const EXISTING_ISSUE_NUMBER = 8899;

// synthetic leg outcome fixture — eval / collect 각 leg 의 run outcome literal. 조립 체인은
// leg outcome 을 report → descriptor 로 흘려보내는 surface 만 검증하므로 도메인 타입 정합만
// 만족하는 minimal literal 로 충분하다(실 jest spawn 0). dispatch 는 search stdout 파생이라
// leg outcome 무관(안정성 대조용).
function evalOutcome(): RealDataDailyStepLegRunOutcome {
  return { leg: "eval", action: "run", passed: true };
}

function collectOutcome(): RealDataDailyStepLegRunOutcome {
  return { leg: "collect", action: "run", passed: true };
}

// marker-매칭 hit stdout 합성 — body 가 marker 를 부분 문자열로 포함하는 이슈 hit 1건(number =
// issueNumber)을 반환하는 상황을 synthetic literal 로 재현한다(실 gh search 실행 0). body 에
// marker 를 담아야 dispatch 술어(`body.includes(marker)`)가 매칭돼 update 로 해소한다.
function matchingHitStdout(marker: string, issueNumber: number): string {
  return JSON.stringify([
    {
      number: issueNumber,
      title: "기존 dual-leg run report 이슈",
      // marker 를 담은 body — dispatch 술어 매칭(update trigger).
      body: `${marker}\n본문 내용`,
    },
  ]);
}

// marker-미매칭 hit stdout 합성 — non-empty 이지만 body 에 marker 를 담지 **않는** 이슈 hit.
// dispatch discriminant 이 응답 non-emptiness 가 아니라 body-marker 술어임을 박제하기 위한
// negative-of-discriminant fixture(비매칭 → 여전히 create).
function nonMatchingHitStdout(issueNumber: number): string {
  return JSON.stringify([
    {
      number: issueNumber,
      title: "무관한 이슈",
      // marker 를 담지 않는 본문 — dispatch 술어 미매칭(응답은 non-empty).
      body: "marker 를 담지 않는 무관한 본문",
    },
  ]);
}

// action-verb dispatch 조립 진입점 — 단일 source(run + 두 leg outcome)로부터 report →
// descriptor → commandArgs 를 관통시켜 유효 commandArgs 를 얻고, 종단 컴포저를 세 stdout 에
// 적용한다: (1) 빈 "[]" → create dispatch, (2) marker-미매칭 hit → 여전히 create dispatch,
// (3) marker-매칭 hit → update dispatch. planFor 로 임의 stdout 에 대해서도 같은 commandArgs
// 로 컴포저를 재적용해 negative(파서/guard) test 가 같은 진입점을 재사용한다. 각 stage 의
// guard throw 는 자체 try/catch 없이 그대로 전파된다.
function assembleDispatch(
  evalLeg: RealDataDailyStepLegRunOutcome,
  collectLeg: RealDataDailyStepLegRunOutcome,
  run: RealDataResultIssueRunRef,
  opts?: {
    matchIssueNumber?: number;
    nonMatchIssueNumber?: number;
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
  // updateArgs{title,body}.
  const commandArgs =
    buildRealDataDailyStepDualLegRunReportIssueCommandArgs(descriptor);

  // planFor — 같은 commandArgs 하 임의 stdout → gh 실행 plan({action, argv}).
  const planFor = (stdout: string) =>
    resolveRealDataDailyStepDualLegRunReportIssueGhCommandPlan(
      stdout,
      commandArgs,
    );

  const matchIssueNumber = opts?.matchIssueNumber ?? EXISTING_ISSUE_NUMBER;
  const nonMatchIssueNumber = opts?.nonMatchIssueNumber ?? 7;

  // 세 dispatch 입력.
  const emptyStdout = "[]";
  const nonMatchStdout = nonMatchingHitStdout(nonMatchIssueNumber);
  const matchStdout = matchingHitStdout(descriptor.marker, matchIssueNumber);

  return {
    report,
    descriptor,
    commandArgs,
    planFor,
    emptyStdout,
    nonMatchStdout,
    matchStdout,
    // (a) 빈 search → create, (b) 비매칭 hit → 여전히 create, (c) 매칭 hit → update.
    emptyPlan: planFor(emptyStdout),
    nonMatchPlan: planFor(nonMatchStdout),
    matchPlan: planFor(matchStdout),
  };
}

// action.action → 예상 verb 매핑(single-source 재유도용) — create action 은 동명 "create",
// update action 은 이명 "edit"(gh CLI 비대칭). 컴포저 산출 argv[1] 이 이 매핑의 함수임을 대조.
function expectedVerbFor(action: "create" | "update"): string {
  return action === "create" ? "create" : "edit";
}

describe("Smoke(non-gated): dual-leg run report action-verb dispatch single-source — marker-match 술어가 create/update 를 가르고 action↔argv[1] 비대칭 매핑(create→create / update→edit), argv[0]='issue' 불변 live-gh 0 검증", () => {
  describe("happy path — dispatch 술어 → verb 관통", () => {
    it("빈 search '[]' → plan.action.action==='create' && argv[0]==='issue' && argv[1]==='create'", () => {
      const { emptyPlan } = assembleDispatch(evalOutcome(), collectOutcome(), {
        ...RUN_A,
      });
      expect(emptyPlan.action.action).toBe("create");
      expect(emptyPlan.argv[0]).toBe("issue");
      expect(emptyPlan.argv[1]).toBe("create");
    });

    it("marker-매칭 hit stdout → plan.action.action==='update' && argv[0]==='issue' && argv[1]==='edit'", () => {
      const { matchPlan } = assembleDispatch(evalOutcome(), collectOutcome(), {
        ...RUN_A,
      });
      expect(matchPlan.action.action).toBe("update");
      expect(matchPlan.argv[0]).toBe("issue");
      expect(matchPlan.argv[1]).toBe("edit");
    });

    it("세 stdout(빈/비매칭/매칭) 모두 argv[0]==='issue'(base noun 두 분기 불변)", () => {
      const { emptyPlan, nonMatchPlan, matchPlan } = assembleDispatch(
        evalOutcome(),
        collectOutcome(),
        { ...RUN_A },
      );
      expect(emptyPlan.argv[0]).toBe("issue");
      expect(nonMatchPlan.argv[0]).toBe("issue");
      expect(matchPlan.argv[0]).toBe("issue");
    });
  });

  describe("핵심 1 — 비매칭 hit → 여전히 create(discriminant = body-marker 술어, 응답 non-emptiness 아님)", () => {
    it("marker-미포함 body 를 가진 non-empty hit stdout → 그래도 plan.action.action==='create' && argv[1]==='create'", () => {
      const { nonMatchPlan, nonMatchStdout } = assembleDispatch(
        evalOutcome(),
        collectOutcome(),
        { ...RUN_A },
      );
      // 응답은 non-empty(hit 1건) 이지만 body 에 marker 미포함 → create.
      expect(nonMatchStdout).not.toBe("[]");
      expect(JSON.parse(nonMatchStdout)).toHaveLength(1);
      expect(nonMatchPlan.action.action).toBe("create");
      expect(nonMatchPlan.argv[1]).toBe("create");
    });

    it("비매칭 hit + 매칭 hit 혼재 stdout → 매칭 hit 하나로 update 전환(argv[1]==='edit') — 술어는 매칭 hit 존재 여부", () => {
      const { descriptor, planFor } = assembleDispatch(
        evalOutcome(),
        collectOutcome(),
        { ...RUN_A },
      );
      const mixed = JSON.stringify([
        { number: 7, title: "무관", body: "marker 없는 본문" },
        {
          number: 42,
          title: "기존 이슈",
          body: `${descriptor.marker}\n본문`,
        },
      ]);
      const plan = planFor(mixed);
      expect(plan.action.action).toBe("update");
      expect(plan.argv[1]).toBe("edit");
    });
  });

  describe("핵심 2 — action→verb 비대칭 매핑(create→create / update→edit)", () => {
    it("update dispatch 시 argv[1]==='edit' && argv[1]!=='update'(update action 이 'update' verb 로 매핑되지 않음 — gh CLI 비대칭)", () => {
      const { matchPlan } = assembleDispatch(evalOutcome(), collectOutcome(), {
        ...RUN_A,
      });
      expect(matchPlan.argv[1]).toBe("edit");
      expect(matchPlan.argv[1]).not.toBe("update");
    });

    it("plan.action.action('update') 와 argv[1]('edit') 을 나란히 대조 — create action → 'create'(동명), update action → 'edit'(이명)", () => {
      const { emptyPlan, matchPlan } = assembleDispatch(
        evalOutcome(),
        collectOutcome(),
        { ...RUN_A },
      );
      // create action → 동명 verb.
      expect(emptyPlan.action.action).toBe("create");
      expect(emptyPlan.argv[1]).toBe("create");
      // update action → 이명 verb(edit ≠ update).
      expect(matchPlan.action.action).toBe("update");
      expect(matchPlan.argv[1]).toBe("edit");
      expect(matchPlan.argv[1]).not.toBe(matchPlan.action.action);
    });

    it("두 verb 상호 배타 — create dispatch argv 에 'edit' 부재, update dispatch argv 에 'create' 부재", () => {
      const { emptyPlan, matchPlan } = assembleDispatch(
        evalOutcome(),
        collectOutcome(),
        { ...RUN_A },
      );
      expect(emptyPlan.argv).not.toContain("edit");
      expect(matchPlan.argv).not.toContain("create");
    });
  });

  describe("핵심 3 — run/leg outcome 무관 dispatch 안정(search-술어 파생)", () => {
    it("(a) 서로 다른 run(A/B) 각각 각 run 의 marker 로 매칭 hit 구성 → 둘 다 update dispatch(argv[1]==='edit') — dispatch 는 run-token 무관", () => {
      const chainA = assembleDispatch(evalOutcome(), collectOutcome(), {
        ...RUN_A,
      });
      const chainB = assembleDispatch(evalOutcome(), collectOutcome(), {
        ...RUN_B,
      });
      expect(chainA.matchPlan.action.action).toBe("update");
      expect(chainB.matchPlan.action.action).toBe("update");
      expect(chainA.matchPlan.argv[1]).toBe("edit");
      expect(chainB.matchPlan.argv[1]).toBe("edit");
    });

    it("(b) 동일 run 에서 leg outcome 을 바꿔도(pass/pass vs fail/skip, overallStatus 변동) 빈 search → create 불변(dispatch 는 leg 상태 무관)", () => {
      const passChain = assembleDispatch(
        { leg: "eval", action: "run", passed: true },
        { leg: "collect", action: "run", passed: true },
        { ...RUN_A },
      );
      const mixedChain = assembleDispatch(
        { leg: "eval", action: "run", passed: false },
        { leg: "collect", action: "skip" },
        { ...RUN_A },
      );
      expect(passChain.emptyPlan.action.action).toBe("create");
      expect(mixedChain.emptyPlan.action.action).toBe("create");
      expect(passChain.emptyPlan.argv[1]).toBe("create");
      expect(mixedChain.emptyPlan.argv[1]).toBe("create");
      // overallStatus 는 실제로 바뀌었음(안정성 대조 유효성 확인).
      expect(passChain.report.overallStatus).not.toBe(
        mixedChain.report.overallStatus,
      );
    });

    it("(c) 복수 marker-매칭 hit([{number:9},{number:4}] 둘 다 매칭 body)에서도 여전히 단일 update dispatch(argv[1]==='edit', 복수여도 create 로 분기 안 함)", () => {
      const { descriptor, planFor } = assembleDispatch(
        evalOutcome(),
        collectOutcome(),
        { ...RUN_A },
      );
      const multiMatch = JSON.stringify([
        { number: 9, title: "기존 A", body: `${descriptor.marker}\nA` },
        { number: 4, title: "기존 B", body: `${descriptor.marker}\nB` },
      ]);
      const plan = planFor(multiMatch);
      expect(plan.action.action).toBe("update");
      expect(plan.argv[1]).toBe("edit");
    });
  });

  describe("핵심 4 — single-source 독립 재유도 + 결정론", () => {
    it("컴포저 재호출 없이 plan.action.action(진실의 원천)을 삼아 expectedVerbFor 로 예상 verb 유도 → argv[1] 과 일치(argv verb 가 하드코딩 아니라 action.action 파생)", () => {
      const { emptyPlan, matchPlan } = assembleDispatch(
        evalOutcome(),
        collectOutcome(),
        { ...RUN_A },
      );
      expect(emptyPlan.argv[1]).toBe(expectedVerbFor(emptyPlan.action.action));
      expect(matchPlan.argv[1]).toBe(expectedVerbFor(matchPlan.action.action));
    });

    it("결정론 — 동일 입력(+ 동일 stdout) 두 번 chain → 두 (create plan, update plan) deep-equal(byte-identical)", () => {
      const first = assembleDispatch(evalOutcome(), collectOutcome(), {
        ...RUN_A,
      });
      const second = assembleDispatch(evalOutcome(), collectOutcome(), {
        ...RUN_A,
      });
      expect(first.emptyPlan).toEqual(second.emptyPlan);
      expect(first.matchPlan).toEqual(second.matchPlan);
    });
  });

  describe("error path / negative cases — 예외 분기마다 각 1+", () => {
    it("(a) dispatch drift 검출 — update plan.argv 를 복제해 argv[1] 을 'create' 로 변형한 synthetic argv 가 원래 update plan.argv 와 not.toEqual 이며 action('update')↔변형 verb('create') 불일치 검출", () => {
      const { matchPlan } = assembleDispatch(evalOutcome(), collectOutcome(), {
        ...RUN_A,
      });
      const drifted = [...matchPlan.argv];
      drifted[1] = "create";
      expect(drifted).not.toEqual(matchPlan.argv);
      // action 은 여전히 update 인데 변형 verb 는 create — single-source 위반 검출.
      expect(matchPlan.action.action).toBe("update");
      expect(drifted[1]).not.toBe(expectedVerbFor(matchPlan.action.action));
      // 원래 update plan.argv 는 여전히 정합(대조 유효성).
      expect(matchPlan.argv[1]).toBe("edit");
    });

    it("(b) verb-name 혼동(update→'update' 오매핑) 검출 — argv[1] 을 'update' 인위 주입한 synthetic argv 가 실제 update plan.argv(argv[1]==='edit')와 not.toEqual 이며 그 synthetic 의 argv[1]==='update'(gh CLI 미지원 subcommand)", () => {
      const { matchPlan } = assembleDispatch(evalOutcome(), collectOutcome(), {
        ...RUN_A,
      });
      const misMapped = [...matchPlan.argv];
      misMapped[1] = "update";
      expect(misMapped).not.toEqual(matchPlan.argv);
      expect(misMapped[1]).toBe("update");
      // 실제 chain 산출은 여전히 edit(오매핑 아님).
      expect(matchPlan.argv[1]).toBe("edit");
      expect(matchPlan.argv[1]).not.toBe("update");
    });

    it("(c) marker guard(전체 매칭 사고) 상류 차단 — blank marker(공백-only descriptor.marker) 로 resolveAction throw 전파 → plan(및 dispatch) 미산출", () => {
      const { commandArgs } = assembleDispatch(
        evalOutcome(),
        collectOutcome(),
        { ...RUN_A },
      );
      // blank searchQuery(marker) 로 컴포저 호출 — resolver assertMarkerNonBlank throw 전파.
      const blankMarkerArgs = { ...commandArgs, searchQuery: "   " };
      expect(() =>
        resolveRealDataDailyStepDualLegRunReportIssueGhCommandPlan(
          "[]",
          blankMarkerArgs,
        ),
      ).toThrow();
    });

    it("(d) 파서 guard 상류 차단 — 비-JSON('{')/비배열 JSON('{}') stdout → 파서 throw 전파로 plan(및 verb) 미산출(손상 stdout 이 dispatch 로 새지 않음)", () => {
      const { planFor } = assembleDispatch(evalOutcome(), collectOutcome(), {
        ...RUN_A,
      });
      expect(() => planFor("{")).toThrow();
      expect(() => planFor("{}")).toThrow();
    });

    it("(e) number guard 상류 차단 — 비양수 number hit([{number:0}]/[{number:-3}], marker 매칭이어도) → resolver assertPositiveNumber throw 전파로 update dispatch(및 argv) 미산출", () => {
      const { descriptor, planFor } = assembleDispatch(
        evalOutcome(),
        collectOutcome(),
        { ...RUN_A },
      );
      const zeroHit = JSON.stringify([
        { number: 0, title: "기존 이슈", body: `${descriptor.marker}\nx` },
      ]);
      expect(() => planFor(zeroHit)).toThrow();
      const negativeHit = JSON.stringify([
        { number: -3, title: "기존 이슈", body: `${descriptor.marker}\nx` },
      ]);
      expect(() => planFor(negativeHit)).toThrow();
    });

    it("(f) descriptor guard 상류 차단(dispatch 이전 chain 차단) — run.gitSha/dateToken 빈-공백이면 descriptor guard throw 로 chain(→plan) 자체 미산출", () => {
      expect(() =>
        assembleDispatch(evalOutcome(), collectOutcome(), {
          gitSha: "   ",
          dateToken: RUN_A.dateToken,
        }),
      ).toThrow();
      expect(() =>
        assembleDispatch(evalOutcome(), collectOutcome(), {
          gitSha: RUN_A.gitSha,
          dateToken: "",
        }),
      ).toThrow();
    });
  });

  describe("결정론 · 무공유 · no-mutation", () => {
    it("동일 (run, leg outcomes, stdout) chain 두 번 → create/update plan.argv 두 번 deep-equal 이며 서로 다른 배열 인스턴스(무공유)", () => {
      const first = assembleDispatch(evalOutcome(), collectOutcome(), {
        ...RUN_A,
      });
      const second = assembleDispatch(evalOutcome(), collectOutcome(), {
        ...RUN_A,
      });
      expect(first.emptyPlan.argv).toEqual(second.emptyPlan.argv);
      expect(first.matchPlan.argv).toEqual(second.matchPlan.argv);
      // 무공유 — referential identity 분리.
      expect(first.emptyPlan.argv).not.toBe(second.emptyPlan.argv);
      expect(first.matchPlan.argv).not.toBe(second.matchPlan.argv);
      expect(first.emptyPlan.argv).not.toBe(first.matchPlan.argv);
    });

    it("무공유 — plan.argv 를 mutate(push/splice/argv[1] 변경)해도 다음 chain 호출 결과·plan.action 에 누설 0", () => {
      const first = assembleDispatch(evalOutcome(), collectOutcome(), {
        ...RUN_A,
      });
      first.matchPlan.argv[1] = "mutant";
      first.matchPlan.argv.push("mutant2");
      const second = assembleDispatch(evalOutcome(), collectOutcome(), {
        ...RUN_A,
      });
      // 다음 호출 결과 불변.
      expect(second.matchPlan.argv[1]).toBe("edit");
      expect(second.matchPlan.argv).not.toContain("mutant");
      expect(second.matchPlan.argv).not.toContain("mutant2");
      // action 은 argv mutate 무관 불변.
      expect(second.matchPlan.action.action).toBe("update");
    });

    it("no-mutation — chain 호출이 commandArgs(중첩 createArgs/updateArgs 포함)·run 을 mutate 0(호출 전후 JSON snapshot deep-equal)", () => {
      const run: RealDataResultIssueRunRef = { ...RUN_A };
      const evalLeg = evalOutcome();
      const collectLeg = collectOutcome();
      const runBefore = JSON.parse(JSON.stringify(run));
      const evalBefore = JSON.parse(JSON.stringify(evalLeg));
      const collectBefore = JSON.parse(JSON.stringify(collectLeg));

      const { commandArgs, planFor, matchStdout, emptyStdout } =
        assembleDispatch(evalLeg, collectLeg, run);
      const commandArgsSnapshot = JSON.parse(JSON.stringify(commandArgs));

      // 산출 후 두 분기 재조립(같은 commandArgs 재사용) — 입력 mutate 유발 여부 확인.
      planFor(emptyStdout);
      planFor(matchStdout);

      expect(run).toEqual(runBefore);
      expect(evalLeg).toEqual(evalBefore);
      expect(collectLeg).toEqual(collectBefore);
      expect(commandArgs).toEqual(commandArgsSnapshot);
    });
  });

  describe("raw / credential 누출 0(R-59 / REQ-059)", () => {
    it("create·update plan.argv 의 어느 원소도 GH_TOKEN/PAT/ghp_/--token/GITHUB_TOKEN 어휘 미포함", () => {
      const { emptyPlan, matchPlan } = assembleDispatch(
        evalOutcome(),
        collectOutcome(),
        { ...RUN_A },
      );
      const joined = [...emptyPlan.argv, ...matchPlan.argv].join(" ");
      expect(joined).not.toContain("--token");
      expect(joined).not.toContain("GITHUB_TOKEN");
      expect(joined).not.toContain("GH_TOKEN");
      expect(joined).not.toContain("ghp_");
      expect(joined).not.toMatch(/ghp_[A-Za-z0-9]/);
    });

    it("verb 원소(argv[0..1]: issue/create/edit)가 순수 명령 토큰만 담고 credential·raw github API 토큰·실 활동 본문 미포함", () => {
      const { emptyPlan, matchPlan } = assembleDispatch(
        evalOutcome(),
        collectOutcome(),
        { ...RUN_A },
      );
      const verbs = [
        emptyPlan.argv[0],
        emptyPlan.argv[1],
        matchPlan.argv[0],
        matchPlan.argv[1],
      ];
      for (const v of verbs) {
        expect(["issue", "create", "edit"]).toContain(v);
        expect(v).not.toContain("ghp_");
        expect(v).not.toContain("narrative");
      }
    });

    it("resolver/파서 guard throw 메시지가 raw 활동 본문·credential 미노출(필드명·유효성만)", () => {
      const { descriptor, planFor } = assembleDispatch(
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
          body: `${descriptor.marker}\n${sentinel}`,
        },
      ]);
      let message = "";
      try {
        planFor(badHit);
      } catch (err) {
        message = err instanceof Error ? err.message : String(err);
      }
      expect(message.length).toBeGreaterThan(0);
      expect(message).not.toContain(sentinel);
      expect(message).not.toContain("ghp_");
    });
  });
});
