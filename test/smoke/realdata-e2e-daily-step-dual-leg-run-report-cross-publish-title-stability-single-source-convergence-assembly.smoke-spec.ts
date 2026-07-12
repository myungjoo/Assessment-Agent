// realdata-e2e-daily-step-dual-leg-run-report-cross-publish-title-stability-
// single-source-convergence-assembly.smoke-spec.ts — 실 평가 e2e daily-step
// dual-leg run report 를 **같은 run 으로 여러 밤 연속 publish**(1차 create + 멱등
// 확인용 2·3차 update)할 때, 사람이 이슈 목록에서 읽는 rolling-issue 의 **제목**
// (`descriptor.title` = `--title` argv 값, run-token 종속)이 1차 create 와 이후 모든
// update 에서 **byte-identical 하게 안정**하고, 나아가 그 제목이 search-hit 의 title
// 필드에서 **threaded 되지 않고**(issueNumber 처럼) 매 publish 마다 단일 source
// (`commandArgs.updateArgs.title` = descriptor.title)로부터 **재-정규화(re-emit)** 돼
// 사람이 GitHub 에서 제목을 손수 바꿔(hit.title 오염) 놔도 다음 밤 update 가 그 오염을
// 이어받지 않고 self-heal 함을 박제하는 cross-publish title stability single-source
// convergence non-gated build-time smoke (T-0939 박제, PLAN.md 109행 🟢 실 평가 e2e
// step ④, REQ-009 멱등 — 사람이 목록에서 읽는 제목 무결성 축).
//
// 절단면 — cross-publish title stability + hit-오염 재정규화(멱등의 사람-제목 무결성):
//   REQ-009 멱등("동일 run 의 기존 이슈를 찾아 갱신, 중복 생성 안 함")은 **여러 매체**
//   위에 얹혀 있고, 그 중 사람-향 축은 지금까지 두 개가 봉합됐다:
//     - url permalink 축(T-0937 봉합) — 사람이 브라우저로 여는 `outcome.url` 이 1차 create
//       와 이후 update 에서 byte-identical 하게 같은 `.../issues/M`(**사람-링크 안정성**).
//     - marker 검색 anchor 축(T-0938 봉합) — 다음 밤 그 이슈를 다시 찾는 검색 anchor
//       (`commandArgs.searchQuery`=`descriptor.marker`)의 cross-publish 안정 + round-trip.
//     - title 사람-제목 축(본 spec 봉합) — 사람은 링크를 열기 전에 **이슈 목록에서 제목을
//       먼저 스캔**한다. rolling-issue 멱등이 성립하려면 1차 밤에 create 로 박은 제목이
//       2·3차 밤의 update 후에도 **같은 제목** 이어야 사람이 같은 run 의 rolling-issue 를
//       제목으로 식별한다. `descriptor.title`(=`ISSUE_TITLE_PREFIX + " " + dateToken@gitSha`)은
//       **run 식별(runToken)에서 파생** 돼 같은 run 이면 leg outcome/timestamp 와 무관하게
//       같은 제목이다(marker 와 동형 단일 source, 단 다른 field·다른 prefix).
//   그리고 title 에는 marker·url 에 없는 **추가 load-bearing 성질** 이 있다: **title 은
//   search-hit 에서 threaded 되지 않는다.** issueNumber(T-0922)는 1차 create-output 의 M 이
//   2차 search-hit 로 다시 관통해 update argv[2] 로 threaded 되지만, **title 은 매 publish
//   마다 commandArgs.updateArgs.title(=descriptor.title, 단일 source)로부터 재-발행(re-emit)**
//   된다. 즉 사람이 GitHub 에서 rolling-issue 제목을 손으로 다른 값으로 바꿔도(search-hit 의
//   title 필드가 오염돼도) 다음 밤 update 는 그 오염된 hit.title 을 이어받지 않고
//   **descriptor.title 로 다시 정규화** 한다 — 제목이 단일 source 로 self-heal 된다. 이
//   "title 은 threaded 아니라 re-emit" 성질이 cross-publish 제목 무결성의 핵심 근거다.
//
// 형제 smoke 와의 차별(= cross-publish 사람-제목 재정규화):
//   * T-0930(title cross-branch) — **한 chain 내부** 에서 create argv `--title`(빈 search)와
//     update argv `--title`(marker-hit)이 단일 descriptor.title 로부터 byte-identical 함만
//     자산화 — **여러 publish 에 걸친**(여러 밤 재조립) 안정성·hit.title 오염 시 재정규화는
//     대상이 아니다(intra-chain ≠ cross-publish).
//   * marker(T-0938) — `searchQuery`(=marker, 검색 anchor)의 cross-publish 안정 + round-trip
//     만 자산화 — marker 와 title 은 **같은 runToken 을 공유** 하지만 서로 다른 field
//     (ISSUE_MARKER_PREFIX vs ISSUE_TITLE_PREFIX)라 co-sourced 이지만 orthogonal.
//   * permalink(T-0937) — `outcome.url`(사람-링크)의 cross-publish 안정만 — url 은 execute-side
//     output-parse 산물, 본 spec 의 title 은 pre-exec 명령-args 의 사람-제목(다른 축).
//   * republish(T-0922) — issueNumber M 이 hit 로 threaded 됨만 — title 이 threaded **아님**
//     (re-emit)은 그 거울상 성질인데 아무도 단언하지 않았다(핵심 2 (b)에서 최소 대비).
//   본 spec 은 그 cross-publish title stability + hit-오염 재정규화 seam 만 닫는다.
//
// 따라서 본 spec 은:
//    🔥 실 LLM 호출 0 — orchestrator / scoring service / gateway 미사용. synthetic leg
//       outcome / run / stdout literal 을 조립 체인에 직접 공급(실 평가·수집·jest spawn 0).
//    🔥 실 네트워크 호출 0 — github / Ollama / gh 호출 0. fetch 0. process.env 읽기 0.
//    🔥 실 gh 실행 0 — search / issue create / issue edit 실 실행 0. execFile('gh', …) 0.
//       실 github rolling-publish 부작용 0 — search-hit 의 M·title·body 는 synthetic
//       literal(및 1차 create body threading)로 대체.
//    🔥 credential 0 / secret 0 / DB 0 / 비용 0 — public CI 에서 항상 green 발화(R-113).
//    🔥 새 외부 dependency 0 — 기존 build*/resolve* 컴포저 import 재사용만
//       (consistency-guard·helper·type 신설 0).
//    🔥 gating / describe.skip / env-gating 배선 0 — 순수 build-time in-memory 검증만.
//    🔥 REQ-009 멱등 근거 — 사람이 이슈 목록에서 같은 제목으로 rolling-issue 를 식별한다. /
//       REQ-037 / REQ-059 — descriptor·commandArgs 는 raw 활동 본문·credential 미저장.
//
// Out of Scope (T-0939):
//   - 형제 T-0930(intra-chain title cross-branch)·marker(T-0938)·permalink(T-0937)·
//     republish(T-0922, issueNumber threaded M) 축 재단언 — argv `--title` 추출 기법만
//     T-0930 에서, threading 기법만 T-0938 에서 mirror. republish 의 threaded M 은 핵심 2
//     (b)에서 title 이 threaded **아님** 을 대비하는 최소 인용(argv[2]===String(M) 자체
//     state-transition 재검증 금지).
//   - descriptor / command-args / action resolver / gh-argv 빌더 / gh-command-plan 컴포저
//     본문 변경 — import·호출만(각 배선 이미 T-0896~T-0907 박제).
//   - 새 컴포저 / consistency 가드 / helper / type 신설 — 기존 helper import·호출만.
//   - production src/ 코드 / package.json / lockfile / test/jest-smoke.json 변경.
import {
  buildRealDataDailyStepDualLegRunReport,
  type RealDataDailyStepLegRunOutcome,
} from "../helpers/realdata-e2e-daily-step-dual-leg-run-report";
import { buildRealDataDailyStepDualLegRunReportIssueCommandArgs } from "../helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-command-args";
import { buildRealDataDailyStepDualLegRunReportIssueDescriptor } from "../helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-descriptor";
import { resolveRealDataDailyStepDualLegRunReportIssueGhCommandPlan } from "../helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-gh-command-plan";
import type { RealDataResultIssueRunRef } from "../helpers/realdata-e2e-result-issue-descriptor";

// 결정론 run 식별자 fixture — gitSha + dateToken 비공백 안정 토큰. 매 it 가 spread 복제로
// 받아 입력 mutate 누설 0. token/secret/raw narrative 어휘 미포함. title 은 이 run 식별에서
// 파생되므로 run 이 사람-제목의 단일 source 다.
const RUN_A: RealDataResultIssueRunRef = {
  gitSha: "abc1234",
  dateToken: "2026-07-11",
};

// 서로 다른 run — gitSha·dateToken 이 RUN_A 와 서로 substring 이 아닌 구별 가능 값. title 이
// run-token 종속 단일 source 라 run 이 다르면 세 --title 이 함께 새 title 로 이동함을 보이는
// 단언용(사람-제목 single-source).
const RUN_B: RealDataResultIssueRunRef = {
  gitSha: "def5678",
  dateToken: "2026-07-12",
};

// 2·3차 search-hit 에 주입할 synthetic 이슈 번호 M — github 이 1차 create 로 낳은 번호를
// 흉내낸다. title·body 어느 조각과도 substring 관계가 없는 양수로 골라 hit 이 우연 매칭이
// 아님을 보장한다(재발견은 body 의 marker 로 성립하지 title/number 로가 아님).
const M = 58231;

// 사람이 GitHub 에서 rolling-issue 제목을 손수 바꾼 상황을 흉내내는 **오염된 hit.title** —
// descriptor.title 과 전혀 다른 문자열. title 이 hit 에서 threaded 되지 않고 매 publish
// 재정규화됨을 실측하기 위해 2·3차 search-hit 의 title 필드에 주입한다.
const POLLUTED_HIT_TITLE = "사람이 손수 바꾼 제목 XYZ";

// synthetic 기본 leg outcome fixture — eval / collect 각 leg 의 run outcome literal. 조립
// 체인은 leg outcome 을 report → descriptor 로 흘려보내는 surface 만 검증하므로 도메인 타입
// 정합만 만족하는 minimal literal 로 충분하다(실 jest spawn 0).
function evalOutcome(): RealDataDailyStepLegRunOutcome {
  return { leg: "eval", action: "run", passed: true };
}

function collectOutcome(): RealDataDailyStepLegRunOutcome {
  return { leg: "collect", action: "run", passed: true };
}

// synthetic `gh search issues --json number,title,body` stdout(1 hit) — 지정 number/title/
// body 를 담은 단일 hit 배열 literal. round-trip 을 실측하기 위해 2·3차 hit body 는 literal
// 이 아니라 **1차 create publish 의 createArgs.body 를 그대로** 담는다(caller 가 주입).
function singleHitStdout(number: number, title: string, body: string): string {
  return JSON.stringify([{ number, title, body }]);
}

// plan.argv 에서 `--title` 바로 다음 원소(사람이 이슈 목록에서 읽는 제목)를 추출한다 —
// create argv `["issue","create","--title",T,...]` / update argv `["issue","edit",N,"--title",
// T,...]` 두 분기 공통. `--title` 이 없거나 값이 없으면 명시적 throw(vacuous 추출 차단).
function titleArgOf(argv: string[]): string {
  const i = argv.indexOf("--title");
  if (i === -1 || i + 1 >= argv.length) {
    throw new Error("argv 에 --title 원소(또는 그 값)가 없습니다");
  }
  return argv[i + 1];
}

// 같은 run 을 매 밤 새로 report→descriptor→commandArgs 로 컴포즈 — 밤마다 독립 재조립
// 모델(같은 run 이면 세 밤의 descriptor.title 이 byte-identical 이어야 함).
function composeCommandArgs(
  evalLeg: RealDataDailyStepLegRunOutcome,
  collectLeg: RealDataDailyStepLegRunOutcome,
  run: RealDataResultIssueRunRef,
) {
  const report = buildRealDataDailyStepDualLegRunReport(
    evalLeg,
    collectLeg,
    run,
  );
  const descriptor =
    buildRealDataDailyStepDualLegRunReportIssueDescriptor(report);
  const commandArgs =
    buildRealDataDailyStepDualLegRunReportIssueCommandArgs(descriptor);
  return { report, descriptor, commandArgs };
}

// cross-publish 3-cycle title-stability threading 조립 — 같은 run·같은 leg outcome 으로 세
// publish cycle 을 잇는다. 세 publish 는 **동일 commandArgs**(따라서 동일 사람-제목
// descriptor.title)에서 argv 를 산출한다.
//   (1) 1차 create: 빈 검색("[]") → create 분기 → titleArg1 = create argv 의 --title 값.
//   (2) 2차 update: **1차 create body 를 그대로 담은** search-hit → resolve
//       (`hit.body.includes(searchQuery)` 참) → update 분기 → titleArg2.
//   (3) 3차 update(멱등 확인): 동일 반복 → titleArg3.
// literal title 하드코딩 0 — 2·3차 hit body 는 항상 1차 create body(createArgs.body) 를
// threading. opts 로 (a) hitTitle2 를 오염 문자열로 덮어 hit.title 재정규화(threaded 아님)
// 재현, (b) searchStdout2 를 손상 stdout 으로 덮어 상류 컴포저 throw 재현 가능.
function crossPublishTitleThread(
  evalLeg: RealDataDailyStepLegRunOutcome,
  collectLeg: RealDataDailyStepLegRunOutcome,
  run: RealDataResultIssueRunRef,
  m: number,
  opts?: {
    hitTitle2?: string;
    searchStdout2?: string;
  },
) {
  const { report, descriptor, commandArgs } = composeCommandArgs(
    evalLeg,
    collectLeg,
    run,
  );

  // (1) 1차 create — 빈 search → create 분기.
  const plan1 = resolveRealDataDailyStepDualLegRunReportIssueGhCommandPlan(
    "[]",
    commandArgs,
  );
  // 1차 create body — 다음 밤 검색이 hit 할 근거(marker 선두 라인 포함).
  const createBody = commandArgs.createArgs.body;

  // (2) 2차 update — 1차 create body 를 담은 search-hit(title 은 오염 주입 가능) → update.
  const hitTitle2 = opts?.hitTitle2 ?? descriptor.title;
  const searchStdout2 =
    opts?.searchStdout2 ?? singleHitStdout(m, hitTitle2, createBody);
  const plan2 = resolveRealDataDailyStepDualLegRunReportIssueGhCommandPlan(
    searchStdout2,
    commandArgs,
  );

  // (3) 3차 update — 동일 반복(멱등 fixed-point, 1차 body·정상 title 담은 hit).
  const plan3 = resolveRealDataDailyStepDualLegRunReportIssueGhCommandPlan(
    singleHitStdout(m, descriptor.title, createBody),
    commandArgs,
  );

  // 세 publish 의 사람-제목(--title argv 값) 추출.
  const titleArg1 = titleArgOf(plan1.argv);
  const titleArg2 = titleArgOf(plan2.argv);
  const titleArg3 = titleArgOf(plan3.argv);

  return {
    report,
    descriptor,
    commandArgs,
    createBody,
    plan1,
    plan2,
    plan3,
    titleArg1,
    titleArg2,
    titleArg3,
    M: m,
  };
}

describe("Smoke(non-gated): dual-leg run report cross-publish title stability single-source(세 --title byte-identical=descriptor.title=createArgs.title=updateArgs.title AND title 은 threaded 아니라 hit.title 오염 시 descriptor.title 로 re-emit) live-gh 0 검증", () => {
  describe("happy path — 3-cycle threading chain 산출 정상", () => {
    it("plan1.action.action === 'create'(빈 search), plan2/plan3.action.action === 'update'(1차 body 담은 hit)이고 titleArg1/2/3 이 각각 비어있지 않은 문자열 — 세 publish 산출 정상", () => {
      const { plan1, plan2, plan3, titleArg1, titleArg2, titleArg3 } =
        crossPublishTitleThread(
          evalOutcome(),
          collectOutcome(),
          { ...RUN_A },
          M,
        );
      expect(plan1.action.action).toBe("create");
      expect(plan2.action.action).toBe("update");
      expect(plan3.action.action).toBe("update");
      for (const t of [titleArg1, titleArg2, titleArg3]) {
        expect(typeof t).toBe("string");
        expect(t.length).toBeGreaterThan(0);
      }
    });
  });

  describe("핵심 1 — cross-publish title stability(세 --title byte-identical)", () => {
    it("(a) 세 publish 의 --title 값(titleArg1/2/3)이 모두 서로 === commandArgs.createArgs.title(strict, byte-identical) AND createArgs.title === updateArgs.title === descriptor.title(create/update 두 분기 제목이 단일 source)", () => {
      const { descriptor, commandArgs, titleArg1, titleArg2, titleArg3 } =
        crossPublishTitleThread(
          evalOutcome(),
          collectOutcome(),
          { ...RUN_A },
          M,
        );
      // 세 publish --title 상호 byte-identical + createArgs.title 단일 source.
      expect(titleArg1).toBe(commandArgs.createArgs.title);
      expect(titleArg2).toBe(commandArgs.createArgs.title);
      expect(titleArg3).toBe(commandArgs.createArgs.title);
      expect(titleArg2).toBe(titleArg1);
      expect(titleArg3).toBe(titleArg1);
      // create/update 두 분기 제목이 단일 source descriptor.title.
      expect(commandArgs.createArgs.title).toBe(commandArgs.updateArgs.title);
      expect(commandArgs.createArgs.title).toBe(descriptor.title);
    });

    it("(b) 각 밤을 별도 report→descriptor→commandArgs 재조립(같은 run 을 매 밤 새로 컴포즈)해도 세 밤의 descriptor.title / --title 값이 여전히 서로 byte-identical(같은 run → 같은 title, timestamp/leg 등 비-run 요소 미혼입)", () => {
      const night1 = composeCommandArgs(evalOutcome(), collectOutcome(), {
        ...RUN_A,
      });
      const night2 = composeCommandArgs(evalOutcome(), collectOutcome(), {
        ...RUN_A,
      });
      const night3 = composeCommandArgs(evalOutcome(), collectOutcome(), {
        ...RUN_A,
      });
      expect(night2.descriptor.title).toBe(night1.descriptor.title);
      expect(night3.descriptor.title).toBe(night1.descriptor.title);
      // 세 밤의 descriptor.title 은 각자의 createArgs.title 과도 동일(단일 source).
      expect(night1.commandArgs.createArgs.title).toBe(night1.descriptor.title);
    });
  });

  describe("핵심 2 — title single-source re-emit(title 은 threaded 아니라 재-정규화, hit.title 오염 무관)", () => {
    it("(a) 2차 search-hit 의 title 을 오염 문자열로 바꾸되 body 는 여전히 1차 create body(marker 포함)면 resolve 는 body-marker 매칭으로 여전히 'update' 로 좁혀지고 그럼에도 update argv 의 --title 이 오염 hit.title 이 아니라 commandArgs.updateArgs.title(=descriptor.title, 단일 source)와 === (title 이 hit 에서 threaded 되지 않고 매 publish 재정규화)", () => {
      const { commandArgs, descriptor, plan2, titleArg2 } =
        crossPublishTitleThread(
          evalOutcome(),
          collectOutcome(),
          { ...RUN_A },
          M,
          {
            hitTitle2: POLLUTED_HIT_TITLE,
          },
        );
      // discriminant 는 body-marker 라 오염 title 에도 여전히 update.
      expect(plan2.action.action).toBe("update");
      // --title 은 오염 hit.title 미전파 — descriptor.title(단일 source)로 재정규화.
      expect(titleArg2).not.toBe(POLLUTED_HIT_TITLE);
      expect(titleArg2).toBe(commandArgs.updateArgs.title);
      expect(titleArg2).toBe(descriptor.title);
    });

    it("(b) 거울상 대비 — 같은 오염 hit 에서 update argv[2](issueNumber)는 String(M)(hit.number 종속=threaded)인데 --title 은 hit.title 무관(descriptor.title)임을 한 test 안에서 나란히 확인 — issueNumber 는 threaded, title 은 re-emit", () => {
      const { descriptor, plan2, titleArg2 } = crossPublishTitleThread(
        evalOutcome(),
        collectOutcome(),
        { ...RUN_A },
        M,
        { hitTitle2: POLLUTED_HIT_TITLE },
      );
      expect(plan2.action.action).toBe("update");
      // issueNumber 는 hit.number 종속(threaded) — update argv[2] === String(M).
      expect(plan2.argv[2]).toBe(String(M));
      // title 은 hit.title 무관(threaded 아님) — descriptor.title 로 re-emit.
      expect(titleArg2).toBe(descriptor.title);
      expect(titleArg2).not.toBe(POLLUTED_HIT_TITLE);
    });
  });

  describe("핵심 3 — title run-token single-source(title 이 run 종속, literal 아님)", () => {
    it("(a) run 을 RUN_B(gitSha/dateToken 모두 다름)로 바꾼 재조립에서 세 publish 의 --title 이 함께 새 title 로 이동(RUN_A 와 다름) AND 여전히 세 publish 상호 byte-identical — 사람-제목이 고정 literal 이 아니라 run 식별(runToken) 단일 source 종속", () => {
      const threadA = crossPublishTitleThread(
        evalOutcome(),
        collectOutcome(),
        { ...RUN_A },
        M,
      );
      const threadB = crossPublishTitleThread(
        evalOutcome(),
        collectOutcome(),
        { ...RUN_B },
        M,
      );
      // 세 publish --title 이 함께 새 title 로 이동(원래 run 과 다름).
      expect(threadB.titleArg1).not.toBe(threadA.titleArg1);
      expect(threadB.descriptor.title).not.toBe(threadA.descriptor.title);
      // 여전히 RUN_B 세 publish 상호 byte-identical.
      expect(threadB.titleArg2).toBe(threadB.titleArg1);
      expect(threadB.titleArg3).toBe(threadB.titleArg1);
    });

    it("(b) title 과 searchQuery(marker)가 같은 runToken 을 공유해 동반 이동하되 서로 다른 field: titleArg !== searchQuery(값이 다름) AND 상호 미포함(title 은 <!-- 미포함, searchQuery 는 <!-- 포함) — co-sourced 이지만 orthogonal", () => {
      const { commandArgs, titleArg1 } = crossPublishTitleThread(
        evalOutcome(),
        collectOutcome(),
        { ...RUN_A },
        M,
      );
      // 값이 다름.
      expect(titleArg1).not.toBe(commandArgs.searchQuery);
      // 상호 미포함(다른 prefix — orthogonal).
      expect(titleArg1.includes(commandArgs.searchQuery)).toBe(false);
      expect(commandArgs.searchQuery.includes(titleArg1)).toBe(false);
      expect(titleArg1.includes("<!--")).toBe(false);
      expect(commandArgs.searchQuery.includes("<!--")).toBe(true);
      // 그러나 같은 runToken 공유 — 둘 다 run 두 토큰을 포함.
      expect(titleArg1).toContain(RUN_A.gitSha);
      expect(titleArg1).toContain(RUN_A.dateToken);
      expect(commandArgs.searchQuery).toContain(RUN_A.gitSha);
      expect(commandArgs.searchQuery).toContain(RUN_A.dateToken);
    });
  });

  describe("branch — create/update 두 분기 대칭 + title 불변", () => {
    it("(a) 1차 plan1: 'create'(빈 search), 2·3차 plan2/plan3: 'update'(1차 body 담은 hit)이더라도 세 publish 가 발행하는 --title 값은 분기 선택과 독립하게 동일(createArgs.title === updateArgs.title)", () => {
      const {
        commandArgs,
        plan1,
        plan2,
        plan3,
        titleArg1,
        titleArg2,
        titleArg3,
      } = crossPublishTitleThread(
        evalOutcome(),
        collectOutcome(),
        { ...RUN_A },
        M,
      );
      // 검색 분기는 서로 다름(create vs update).
      expect(plan1.action.action).toBe("create");
      expect(plan2.action.action).toBe("update");
      expect(plan3.action.action).toBe("update");
      // 그럼에도 세 publish --title 은 분기 무관하게 동일.
      expect(titleArg1).toBe(commandArgs.createArgs.title);
      expect(titleArg2).toBe(commandArgs.updateArgs.title);
      expect(titleArg3).toBe(commandArgs.updateArgs.title);
      expect(commandArgs.createArgs.title).toBe(commandArgs.updateArgs.title);
    });

    it("(b) resolve 의 create/update 분기 판정 discriminant 가 hit.body.includes(searchQuery)(body-marker)임을 빈 search(create)·marker 담은 hit(update)·marker 제거 hit(create) 세 stdout 으로 각각 확인하되 세 경우 모두 argv 의 --title 이 descriptor.title 로 동일(제목은 분기·재발견 성패와 독립인 단일 source)", () => {
      const { commandArgs, descriptor, createBody } = crossPublishTitleThread(
        evalOutcome(),
        collectOutcome(),
        { ...RUN_A },
        M,
      );
      const markerFreeBody =
        "무관 본문 — 이 이슈 body 에는 재발견 marker 가 없습니다";
      // 빈 search → create.
      const empty = resolveRealDataDailyStepDualLegRunReportIssueGhCommandPlan(
        "[]",
        commandArgs,
      );
      expect(empty.action.action).toBe("create");
      expect(titleArgOf(empty.argv)).toBe(descriptor.title);
      // marker 담은 hit(=1차 create body) → update.
      const matched =
        resolveRealDataDailyStepDualLegRunReportIssueGhCommandPlan(
          singleHitStdout(M, descriptor.title, createBody),
          commandArgs,
        );
      expect(matched.action.action).toBe("update");
      expect(titleArgOf(matched.argv)).toBe(descriptor.title);
      // marker 제거 hit → create.
      const removed =
        resolveRealDataDailyStepDualLegRunReportIssueGhCommandPlan(
          singleHitStdout(M, descriptor.title, markerFreeBody),
          commandArgs,
        );
      expect(removed.action.action).toBe("create");
      expect(titleArgOf(removed.argv)).toBe(descriptor.title);
    });
  });

  describe("branch — run/leg outcome status 무관 title 안정", () => {
    it("(a) 동일 run 고정, leg outcome 조합만 다르게(eval pass/collect pass vs eval fail/collect skip) → 세 publish 의 --title 동일 유지(title 은 run 종속, leg status/overallStatus 무관)", () => {
      const passThread = crossPublishTitleThread(
        { leg: "eval", action: "run", passed: true },
        { leg: "collect", action: "run", passed: true },
        { ...RUN_A },
        M,
      );
      const mixedThread = crossPublishTitleThread(
        { leg: "eval", action: "run", passed: false },
        { leg: "collect", action: "skip" },
        { ...RUN_A },
        M,
      );
      // overallStatus 는 서로 다름(축 분리 구조 확인).
      expect(passThread.report.overallStatus).not.toBe(
        mixedThread.report.overallStatus,
      );
      // 그러나 두 thread 의 --title 동일(run 종속, leg 무관).
      expect(mixedThread.descriptor.title).toBe(passThread.descriptor.title);
      for (const t of [passThread, mixedThread]) {
        expect(t.titleArg2).toBe(t.titleArg1);
        expect(t.titleArg3).toBe(t.titleArg1);
      }
    });

    it("(b) 서로 다른 run 두 개(run_A/run_B, 서로 substring 아님) → 각 run 의 세 publish --title 은 run 내부에서 상호 byte-identical 이되 run_A 의 title !== run_B 의 title(제목이 run 을 구분)", () => {
      const threadA = crossPublishTitleThread(
        evalOutcome(),
        collectOutcome(),
        { ...RUN_A },
        M,
      );
      const threadB = crossPublishTitleThread(
        evalOutcome(),
        collectOutcome(),
        { ...RUN_B },
        M,
      );
      // run 내부 세 publish 상호 byte-identical.
      for (const t of [threadA, threadB]) {
        expect(t.titleArg2).toBe(t.titleArg1);
        expect(t.titleArg3).toBe(t.titleArg1);
      }
      // run 간에는 서로 다름(title 이 run 을 구분).
      expect(threadA.descriptor.title).not.toBe(threadB.descriptor.title);
    });
  });

  describe("error path / negative cases — 예외 분기마다 각 1+ (단일 negative 금지)", () => {
    it("(a) run.gitSha 빈/공백 → descriptor(stage 1, report 합성) guard throw 로 chain 시작 차단", () => {
      expect(() =>
        crossPublishTitleThread(
          evalOutcome(),
          collectOutcome(),
          { gitSha: "   ", dateToken: RUN_A.dateToken },
          M,
        ),
      ).toThrow();
    });

    it("(b) run.dateToken 빈/공백 → descriptor(stage 1) guard throw 대칭(gitSha 유효해도 필드별 독립 분기)", () => {
      expect(() =>
        crossPublishTitleThread(
          evalOutcome(),
          collectOutcome(),
          { gitSha: RUN_A.gitSha, dateToken: "" },
          M,
        ),
      ).toThrow();
    });

    it("(c) descriptor.title 빈/공백 상황(descriptor 를 손상시켜 commandArgs 빌더에 주입) → command-args 빌더 guard throw(빈 제목으로 인한 비식별 이슈 명령 상류 차단)", () => {
      const { descriptor } = composeCommandArgs(
        evalOutcome(),
        collectOutcome(),
        {
          ...RUN_A,
        },
      );
      expect(() =>
        buildRealDataDailyStepDualLegRunReportIssueCommandArgs({
          ...descriptor,
          title: "   ",
        }),
      ).toThrow();
    });

    it("(c') descriptor.marker 빈/공백 상황 → command-args 빌더 guard throw(title 과 별개 필드 분기)", () => {
      const { descriptor } = composeCommandArgs(
        evalOutcome(),
        collectOutcome(),
        {
          ...RUN_A,
        },
      );
      expect(() =>
        buildRealDataDailyStepDualLegRunReportIssueCommandArgs({
          ...descriptor,
          marker: "",
        }),
      ).toThrow();
    });

    it("(d) 2·3차 조립 시 컴포저에 넣는 search stdout 이 비-JSON('{') → 종단 컴포저 파서 throw 로 update plan 미산출(손상 search stdout 이 분기 판정으로 새는 것 상류 차단)", () => {
      expect(() =>
        crossPublishTitleThread(
          evalOutcome(),
          collectOutcome(),
          { ...RUN_A },
          M,
          {
            searchStdout2: "{",
          },
        ),
      ).toThrow();
    });

    it("(d') 2·3차 조립 시 search stdout 이 비배열 JSON('{}') → 종단 컴포저 파서 throw(비-JSON 과 별개 분기)", () => {
      expect(() =>
        crossPublishTitleThread(
          evalOutcome(),
          collectOutcome(),
          { ...RUN_A },
          M,
          {
            searchStdout2: "{}",
          },
        ),
      ).toThrow();
    });

    it("(e) 2차 search-hit 의 title 을 오염(다른 문자열)시키되 body 에 marker 유지 → resolve 는 여전히 'update' 로 좁혀지고 update argv 의 --title 은 descriptor.title 로 재정규화(오염 hit.title 미전파) — 오염된 제목이 조용히 다음 publish 로 새지 않음", () => {
      const { descriptor, plan2, titleArg2 } = crossPublishTitleThread(
        evalOutcome(),
        collectOutcome(),
        { ...RUN_A },
        M,
        { hitTitle2: POLLUTED_HIT_TITLE },
      );
      expect(plan2.action.action).toBe("update");
      expect(titleArg2).toBe(descriptor.title);
      expect(titleArg2).not.toBe(POLLUTED_HIT_TITLE);
    });
  });

  describe("결정론 · 무공유 · no-mutation", () => {
    it("동일 (run, leg outcomes, M) 입력으로 3-cycle chain 두 번 → descriptor/commandArgs/plan1/plan2/plan3 이 두 번 deep-equal(plan.argv 배열·--title 값 포함)", () => {
      const a = crossPublishTitleThread(
        evalOutcome(),
        collectOutcome(),
        { ...RUN_A },
        M,
      );
      const b = crossPublishTitleThread(
        evalOutcome(),
        collectOutcome(),
        { ...RUN_A },
        M,
      );
      expect(a.descriptor).toEqual(b.descriptor);
      expect(a.commandArgs).toEqual(b.commandArgs);
      expect(a.plan1).toEqual(b.plan1);
      expect(a.plan2).toEqual(b.plan2);
      expect(a.plan2.argv).toEqual(b.plan2.argv);
      expect(a.plan3).toEqual(b.plan3);
      expect(a.titleArg2).toBe(b.titleArg2);
    });

    it("no-mutation — 입력 run/leg outcome literal 이 chain 호출 후 mutate 0(원본 deep-equal 유지, snapshot 대조)", () => {
      const run: RealDataResultIssueRunRef = { ...RUN_A };
      const evalLeg = evalOutcome();
      const collectLeg = collectOutcome();
      const runBefore = JSON.parse(JSON.stringify(run));
      const evalBefore = JSON.parse(JSON.stringify(evalLeg));
      const collectBefore = JSON.parse(JSON.stringify(collectLeg));

      crossPublishTitleThread(evalLeg, collectLeg, run, M);

      expect(run).toEqual(runBefore);
      expect(evalLeg).toEqual(evalBefore);
      expect(collectLeg).toEqual(collectBefore);
    });

    it("무공유 — plan1·plan2·plan3 객체가 서로/다음 호출 결과와 referential identity 분리(not.toBe) — --title 문자열 값은 같아도 plan 객체·argv 배열은 무공유", () => {
      const a = crossPublishTitleThread(
        evalOutcome(),
        collectOutcome(),
        { ...RUN_A },
        M,
      );
      const b = crossPublishTitleThread(
        evalOutcome(),
        collectOutcome(),
        { ...RUN_A },
        M,
      );
      // 같은 thread 안 세 plan 객체 분리.
      expect(a.plan1).not.toBe(a.plan2);
      expect(a.plan1).not.toBe(a.plan3);
      expect(a.plan2).not.toBe(a.plan3);
      // 재호출 결과와도 분리(argv 배열까지 무공유).
      expect(a.plan2).not.toBe(b.plan2);
      expect(a.plan2.argv).not.toBe(b.plan2.argv);
    });
  });

  describe("raw / credential 누출 0(R-59 / REQ-059)", () => {
    it("chain 안 어디에서도(descriptor.{title,marker,body} / commandArgs.{createArgs.title,updateArgs.title,searchQuery} / 세 publish --title 값 / plan.argv(1·2·3차 전체)) token/secret/raw narrative 어휘 미등장", () => {
      const {
        descriptor,
        commandArgs,
        plan1,
        plan2,
        plan3,
        titleArg1,
        titleArg2,
        titleArg3,
      } = crossPublishTitleThread(
        evalOutcome(),
        collectOutcome(),
        { ...RUN_A },
        M,
      );

      const joined = [
        descriptor.title,
        descriptor.marker,
        descriptor.body,
        commandArgs.createArgs.title,
        commandArgs.updateArgs.title,
        commandArgs.searchQuery,
        titleArg1,
        titleArg2,
        titleArg3,
        ...plan1.argv,
        ...plan2.argv,
        ...plan3.argv,
      ].join(" ");

      expect(joined).not.toContain("--token");
      expect(joined).not.toContain("GITHUB_TOKEN");
      expect(joined).not.toContain("GH_TOKEN");
      expect(joined).not.toContain("ghp_");
      expect(joined).not.toContain("narrative");
      expect(joined).not.toMatch(/ghp_[A-Za-z0-9]/);
    });

    it("세 --title 값이 순수 사람-제목 문자열(고정 prefix + runToken)만 담고 credential·raw github API 토큰·실 활동 본문·narrative 미포함", () => {
      const { titleArg1, titleArg2, titleArg3 } = crossPublishTitleThread(
        evalOutcome(),
        collectOutcome(),
        { ...RUN_A },
        M,
      );
      for (const t of [titleArg1, titleArg2, titleArg3]) {
        expect(t).not.toContain("ghp_");
        expect(t).not.toContain("--token");
        expect(t).not.toContain("narrative");
        // run 식별 파생 — run 두 토큰을 포함(순수 사람-제목 source).
        expect(t).toContain(RUN_A.gitSha);
        expect(t).toContain(RUN_A.dateToken);
      }
    });

    it("leg outcome.specPath 에 sentinel 을 넣어도 세 publish --title 표면에 sentinel 미누출(title 은 run-token 파생, leg outcome 무관)", () => {
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
      const { titleArg1, titleArg2, titleArg3 } = crossPublishTitleThread(
        evalLeg,
        collectLeg,
        { ...RUN_A },
        M,
      );
      for (const t of [titleArg1, titleArg2, titleArg3]) {
        expect(t).not.toContain(sentinel);
      }
    });

    it("descriptor/command-args guard throw 메시지가 raw 활동 본문·credential 을 노출하지 않음(필드명·유효성만) — title 빈/공백 negative case 에서 확인", () => {
      const sentinel = "ghp_SENTINELsecret1234";
      const { descriptor } = composeCommandArgs(
        evalOutcome(),
        collectOutcome(),
        {
          ...RUN_A,
        },
      );
      let thrown: Error | undefined;
      try {
        buildRealDataDailyStepDualLegRunReportIssueCommandArgs({
          ...descriptor,
          title: "   ",
          // body 에 sentinel 을 심어도 guard 메시지에 새면 안 됨.
          body: `${sentinel} ${descriptor.body}`,
        });
      } catch (err) {
        thrown = err as Error;
      }
      expect(thrown).toBeDefined();
      expect(thrown?.message).not.toContain(sentinel);
      expect(thrown?.message).not.toContain("ghp_");
    });
  });
});
