// realdata-e2e-daily-step-dual-leg-run-report-cross-publish-marker-anchor-
// stability-single-source-convergence-assembly.smoke-spec.ts — 실 평가 e2e
// daily-step dual-leg run report 를 **같은 run 으로 여러 밤 연속 publish**(1차
// create + 멱등 확인용 2·3차 update)할 때, 다음 밤 그 rolling-issue 를
// **재발견(re-find)** 하는 검색 identity anchor(`commandArgs.searchQuery` =
// `descriptor.marker`, run-token 종속)가 1차 create 와 이후 모든 update 에서
// **byte-identical 하게 안정**하고, 나아가 1차 create publish 의 body 에 심긴
// marker 라인이 2·3차 publish 의 `searchQuery` 와 정확히 같아
// **publish→re-search round-trip 이 닫혀** 재발견이 실제로 성립함을 박제하는
// cross-publish marker anchor stability single-source convergence non-gated
// build-time smoke (T-0938 박제, PLAN.md 109행 🟢 실 평가 e2e step ④, REQ-009 멱등성
// — 재발견 검색 anchor 무결성 축).
//
// 절단면 — cross-publish marker anchor stability + round-trip 닫힘(멱등의 재발견 무결성):
//   REQ-009 멱등("동일 run 의 기존 이슈를 찾아 갱신, 중복 생성 안 함")은 **세 매체**
//   위에 얹혀 있다:
//     - issueNumber 축(republish T-0922 봉합) — 1차 create-output 이 낳은 번호 M 이 2차
//       search-hit 로 threading 해 resolve 가 `update`/M 으로 좁혀짐(**번호
//       state-transition**).
//     - url permalink 축(permalink T-0937 봉합) — 사람이 여는 `outcome.url` 이 1차 create
//       와 이후 update 에서 byte-identical 하게 같은 `.../issues/M`(**사람-링크 안정성**).
//     - marker 검색 anchor 축(본 spec 봉합) — 위 두 축은 모두 **"2차 밤에 그 이슈를 다시
//       찾을 수 있다"** 를 전제로 성립한다. 그 재발견은 `commandArgs.searchQuery`(=
//       `descriptor.marker`, run-token 종속) 로 body 에 marker 를 담은 이슈를 hit 하는
//       것으로 이뤄진다. 재발견이 성립하려면 (a) 검색 anchor(searchQuery)가 1·2·3차
//       publish 에서 **byte-identical 하게 안정**(같은 run → 같은 marker)해야 하고,
//       (b) 1차 create publish 가 body 에 심은 marker 라인이 2·3차 publish 의 searchQuery
//       와 **정확히 같아야** 한다 — 그래야 2차 검색이 1차가 만든 이슈를 hit 하고
//       (`hit.body.includes(searchQuery)`), resolve 가 create 아닌 **update** 로 좁혀진다.
//   이 **marker anchor 안정성 + publish→re-search round-trip 닫힘** 이 rolling-issue 멱등의
//   재발견 무결성이고, issueNumber(T-0922)·url(T-0937) 두 축이 **암묵적으로 의존하지만
//   아무도 명시적으로 못 박지 않은** load-bearing 축이다. 그 안정성의 load-bearing 근거는
//   literal 하드코딩이 아니라 **descriptor.marker 가 run 식별(gitSha/dateToken)에서 파생돼
//   같은 run 이면 같은 marker** 라는 단일 source 성이다.
//
// 형제 smoke 와의 차별(= cross-publish round-trip):
//   * republish(T-0922) — 1차 create-output 의 M 이 2차 search-input 으로 threading 해 2차
//     resolve 가 `update`/M 으로 좁혀짐(**issueNumber state-transition**)만 자산화 — 2차
//     검색이 성립하는 **전제인 marker anchor 의 cross-publish 안정성**(1차 create body
//     marker == 2차 searchQuery)은 미단언(번호 축 ≠ 검색 anchor 축). resolve 가 update 로
//     좁혀짐은 본 spec 에서 round-trip 닫힘의 결과로만 최소 인용(그 state-transition 자체
//     재검증 아님).
//   * permalink(T-0937) — 세 publish 의 `outcome.url` 이 byte-identical(모두 `.../issues/M`)
//     함(**사람-링크 안정성**)만 자산화 — url 은 execute-side output-parse 산물이고, 본
//     spec 의 marker 는 pre-exec 검색 anchor(사람 링크 ≠ 검색 anchor).
//   * T-0928(create-branch)/T-0929(update-branch) — **한 publish chain 내부**에서
//     searchArgv marker 와 그 chain 의 create/edit body marker 라인이 단일 source 로
//     byte-identical 함만 자산화 — **여러 publish 에 걸친**(1차 body marker == 2차
//     searchQuery) cross-publish round-trip 은 대상이 아니다(intra-chain ≠ cross-publish).
//   * T-0921(dual-medium orthogonal) — **한 chain 내부**에서 marker(searchArgv 매체)와
//     issueNumber(editArgv 매체)가 서로 직교함만 자산화 — cross-publish 안정성·round-trip
//     닫힘과 무관.
//   본 spec 은 그 cross-publish marker anchor stability + round-trip 닫힘 seam 만 닫는다.
//
// 따라서 본 spec 은:
//    🔥 실 LLM 호출 0 — orchestrator / scoring service / gateway 미사용. synthetic leg
//       outcome / run / stdout literal 을 조립 체인에 직접 공급(실 평가·수집·jest spawn 0).
//    🔥 실 네트워크 호출 0 — github / Ollama / gh 호출 0. fetch 0. process.env 읽기 0.
//    🔥 실 gh 실행 0 — search / issue create / issue edit 실 실행 0. execFile('gh', …) 0.
//       실 github rolling-publish 부작용 0 — search-hit 의 M·body 는 synthetic literal(및
//       1차 create body threading)로 대체.
//    🔥 credential 0 / secret 0 / DB 0 / 비용 0 — public CI 에서 항상 green 발화(R-113).
//    🔥 새 외부 dependency 0 — 기존 build*/resolve* 컴포저 import 재사용만
//       (consistency-guard·helper·type 신설 0).
//    🔥 gating / describe.skip / env-gating 배선 0 — 순수 build-time in-memory 검증만.
//    🔥 REQ-009 멱등 근거 — 다음 밤 검색이 성립(재발견)해야 중복 이슈를 안 만든다. /
//       REQ-037 / REQ-059 — descriptor·commandArgs 는 raw 활동 본문·credential 미저장.
//
// Out of Scope (T-0938):
//   - 형제 republish(T-0922)의 issueNumber M cross-publish state-transition(2차 resolve
//     update/M) 축 재단언 — resolve 가 update 로 좁혀짐은 round-trip 닫힘의 결과로만 최소
//     인용(argv[2]===String(M) 자체 재검증 아님).
//   - 형제 permalink(T-0937)의 cross-publish url permalink stability(outcome.url 세 개
//     byte-identical) 축 재단언 — url 은 execute-side, 본 spec 은 pre-exec 검색 anchor.
//   - 형제 T-0928/T-0929 의 한 chain 내부 marker single-source, T-0921 의 dual-medium
//     orthogonal 축 재단언.
//   - descriptor / command-args / action resolver / gh-command-plan 컴포저 본문 변경 —
//     import·호출만(각 배선 이미 T-0896~T-0907 박제).
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
// 받아 입력 mutate 누설 0. token/secret/raw narrative 어휘 미포함(credential 누출 0 단언
// fixture 전제). marker 는 이 run 식별에서 파생되므로 run 이 anchor 의 단일 source 다.
const RUN_A: RealDataResultIssueRunRef = {
  gitSha: "abc1234",
  dateToken: "2026-07-11",
};

// 서로 다른 run — gitSha·dateToken 이 RUN_A 와 서로 substring 이 아닌 구별 가능 값. marker 가
// run-token 종속 단일 source 라 run 이 다르면 세 searchQuery 가 함께 새 marker 로 이동함을
// 보이는 단언용(anchor single-source).
const RUN_B: RealDataResultIssueRunRef = {
  gitSha: "def5678",
  dateToken: "2026-07-12",
};

// 2·3차 search-hit 에 주입할 synthetic 이슈 번호 M — github 이 1차 create 로 낳은 이슈에
// 부여한 번호를 흉내낸다. marker·title·body 어느 조각과도 substring 관계가 없는 양수로 골라
// 재발견 hit 이 우연 매칭이 아님을 보장한다(본 spec 의 축은 번호가 아니라 body 의 marker 가
// searchQuery 와 일치해 hit 함이다).
const M = 58231;

// 검색 anchor(searchQuery=marker) 를 담지 않은 "무관 본문" — round-trip 이 깨지는
// guard-against-vacuity 재현용(2차 search-hit body 에서 marker 를 제거하면 재발견 실패 →
// resolve 가 create 로 떨어짐).
const MARKER_FREE_BODY =
  "무관 본문 — 이 이슈 body 에는 재발견 marker 가 없습니다";

// synthetic 기본 leg outcome fixture — eval / collect 각 leg 의 run outcome literal. 조립
// 체인은 leg outcome 을 report → descriptor 로 흘려보내는 surface 만 검증하므로 도메인 타입
// 정합만 만족하는 minimal literal 로 충분하다(실 jest spawn 0).
function evalOutcome(): RealDataDailyStepLegRunOutcome {
  return { leg: "eval", action: "run", passed: true };
}

function collectOutcome(): RealDataDailyStepLegRunOutcome {
  return { leg: "collect", action: "run", passed: true };
}

// synthetic `gh search issues --json number,title,body` stdout(1 hit) — 지정 body 를 담은
// 단일 hit 배열 literal. round-trip 을 실측하기 위해 2·3차 hit body 는 literal 이 아니라
// **1차 create publish 의 createArgs.body 를 그대로** 담는다(caller 가 아래에서 주입).
function singleHitStdout(number: number, title: string, body: string): string {
  return JSON.stringify([{ number, title, body }]);
}

// 같은 run 을 매 밤 새로 report→descriptor→commandArgs 로 컴포즈 — 밤마다 독립 재조립
// 모델(같은 run 이면 세 밤의 commandArgs.searchQuery 가 byte-identical 이어야 함).
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

// cross-publish 3-cycle marker-anchor threading 조립 — 같은 run·같은 leg outcome 으로 세
// publish cycle 을 잇는다. 세 publish 는 **동일 commandArgs**(따라서 동일 검색 anchor
// searchQuery=descriptor.marker)에서 검색한다.
//   (1) 1차 create: 빈 검색("[]") → create 분기 → 1차 create body = commandArgs.createArgs.body
//       (marker 선두 라인 포함).
//   (2) 2차 update: **1차 create body 를 그대로 담은** search-hit → resolve
//       (`hit.body.includes(searchQuery)` 참) → update 분기.
//   (3) 3차 update(멱등 확인): 동일 반복 → update 분기.
// literal marker 하드코딩 0 — 2·3차 hit body 는 항상 1차 create body(createArgs.body) 를
// threading. opts 로 (a) hitBody2/hitBody3 를 marker 제거 텍스트로 덮어 vacuity·negative 재현,
// (b) searchStdout2/searchStdout3 를 손상 stdout 으로 덮어 상류 컴포저 throw 재현 가능.
function crossPublishMarkerThread(
  evalLeg: RealDataDailyStepLegRunOutcome,
  collectLeg: RealDataDailyStepLegRunOutcome,
  run: RealDataResultIssueRunRef,
  m: number,
  opts?: {
    hitBody2?: string;
    hitBody3?: string;
    searchStdout2?: string;
    searchStdout3?: string;
  },
) {
  const { report, descriptor, commandArgs } = composeCommandArgs(
    evalLeg,
    collectLeg,
    run,
  );

  // 세 publish 가 각 시점에 검색에 쓰는 anchor(commandArgs.searchQuery) — 같은 commandArgs
  // 이므로 세 값이 byte-identical 이어야 한다(cross-publish stability).
  const anchor1 = commandArgs.searchQuery;
  // (1) 1차 create — 빈 search → create 분기.
  const plan1 = resolveRealDataDailyStepDualLegRunReportIssueGhCommandPlan(
    "[]",
    commandArgs,
  );
  // 1차 create body — 다음 밤 검색이 hit 할 근거(marker 선두 라인 포함).
  const createBody = commandArgs.createArgs.body;

  // (2) 2차 update — 1차 create body 를 그대로 담은 search-hit → marker-매칭 → update 분기.
  const anchor2 = commandArgs.searchQuery;
  const hitBody2 = opts?.hitBody2 ?? createBody;
  const searchStdout2 =
    opts?.searchStdout2 ?? singleHitStdout(m, descriptor.title, hitBody2);
  const plan2 = resolveRealDataDailyStepDualLegRunReportIssueGhCommandPlan(
    searchStdout2,
    commandArgs,
  );

  // (3) 3차 update — 동일 반복(멱등 fixed-point).
  const anchor3 = commandArgs.searchQuery;
  const hitBody3 = opts?.hitBody3 ?? createBody;
  const searchStdout3 =
    opts?.searchStdout3 ?? singleHitStdout(m, descriptor.title, hitBody3);
  const plan3 = resolveRealDataDailyStepDualLegRunReportIssueGhCommandPlan(
    searchStdout3,
    commandArgs,
  );

  return {
    report,
    descriptor,
    commandArgs,
    createBody,
    plan1,
    plan2,
    plan3,
    anchor1,
    anchor2,
    anchor3,
    M: m,
  };
}

describe("Smoke(non-gated): dual-leg run report cross-publish marker anchor stability single-source(세 searchQuery byte-identical=descriptor.marker AND 1차 create body marker == 2·3차 searchQuery round-trip 닫힘) live-gh 0 검증", () => {
  describe("happy path — 3-cycle threading chain 산출 정상", () => {
    it("commandArgs.searchQuery 가 비어있지 않은 문자열이고 plan1.action.action === 'create'(빈 search), plan2/plan3.action.action === 'update'(1차 body 담은 hit) — 세 publish 산출 정상", () => {
      const { commandArgs, plan1, plan2, plan3 } = crossPublishMarkerThread(
        evalOutcome(),
        collectOutcome(),
        { ...RUN_A },
        M,
      );
      expect(typeof commandArgs.searchQuery).toBe("string");
      expect(commandArgs.searchQuery.length).toBeGreaterThan(0);
      expect(plan1.action.action).toBe("create");
      expect(plan2.action.action).toBe("update");
      expect(plan3.action.action).toBe("update");
    });
  });

  describe("핵심 1 — cross-publish marker anchor stability(세 검색 anchor byte-identical)", () => {
    it("(a) 세 publish 의 검색 anchor searchQuery 가 모두 서로 === commandArgs.searchQuery(strict, byte-identical) AND commandArgs.searchQuery === descriptor.marker(anchor 단일 source)", () => {
      const { commandArgs, descriptor, anchor1, anchor2, anchor3 } =
        crossPublishMarkerThread(
          evalOutcome(),
          collectOutcome(),
          { ...RUN_A },
          M,
        );
      // 세 publish anchor 상호 byte-identical.
      expect(anchor1).toBe(commandArgs.searchQuery);
      expect(anchor2).toBe(commandArgs.searchQuery);
      expect(anchor3).toBe(commandArgs.searchQuery);
      expect(anchor2).toBe(anchor1);
      expect(anchor3).toBe(anchor1);
      // 검색 anchor 가 descriptor.marker 단일 source.
      expect(commandArgs.searchQuery).toBe(descriptor.marker);
    });

    it("(b) 각 밤을 별도 report→descriptor→commandArgs 재조립(같은 run 을 매 밤 새로 컴포즈)해도 세 밤의 commandArgs.searchQuery 가 여전히 서로 byte-identical(같은 run → 같은 marker, timestamp 등 비-run 요소 미혼입)", () => {
      const night1 = composeCommandArgs(evalOutcome(), collectOutcome(), {
        ...RUN_A,
      });
      const night2 = composeCommandArgs(evalOutcome(), collectOutcome(), {
        ...RUN_A,
      });
      const night3 = composeCommandArgs(evalOutcome(), collectOutcome(), {
        ...RUN_A,
      });
      expect(night2.commandArgs.searchQuery).toBe(
        night1.commandArgs.searchQuery,
      );
      expect(night3.commandArgs.searchQuery).toBe(
        night1.commandArgs.searchQuery,
      );
      // 세 밤의 searchQuery 는 각자의 descriptor.marker 와도 동일.
      expect(night1.commandArgs.searchQuery).toBe(night1.descriptor.marker);
    });
  });

  describe("핵심 2 — publish→re-search round-trip 닫힘(1차 create body marker == 2·3차 searchQuery, 재발견 vacuous 아님)", () => {
    it("(a) 1차 create body(createArgs.body)가 검색 anchor searchQuery 를 substring 으로 포함(createBody.includes(searchQuery) === true) — 다음 밤 검색이 이 이슈를 hit 할 근거가 body 에 실제로 심겨 있음", () => {
      const { commandArgs, createBody } = crossPublishMarkerThread(
        evalOutcome(),
        collectOutcome(),
        { ...RUN_A },
        M,
      );
      expect(createBody.includes(commandArgs.searchQuery)).toBe(true);
    });

    it("(b) 1차 create body 를 그대로 담은 2·3차 search-hit 로 resolve 하면 hit.body.includes(searchQuery) 가 참이라 plan2/plan3.action.action === 'update' 로 좁혀짐(round-trip 이 실제로 닫혀 재발견 성립)", () => {
      const { plan2, plan3 } = crossPublishMarkerThread(
        evalOutcome(),
        collectOutcome(),
        { ...RUN_A },
        M,
      );
      for (const plan of [plan2, plan3]) {
        expect(plan.action.action).toBe("update");
        if (plan.action.action === "update") {
          expect(plan.action.issueNumber).toBe(M);
        }
      }
    });

    it("(c) guard-against-vacuity — 2차 search-hit body 를 marker 제거 텍스트로 바꾸면 hit.body.includes(searchQuery) 가 거짓이라 resolve 가 'create' 로 떨어짐(round-trip 이 깨지면 재발견 실패해 신규 이슈를 만들려 함을 test 가 실제 감지 — 즉 (b)의 update 단언이 vacuous 아님)", () => {
      const { plan2 } = crossPublishMarkerThread(
        evalOutcome(),
        collectOutcome(),
        { ...RUN_A },
        M,
        { hitBody2: MARKER_FREE_BODY },
      );
      expect(plan2.action.action).toBe("create");
    });
  });

  describe("핵심 3 — marker anchor single-source(anchor 가 run-token 종속, literal 아님)", () => {
    it("(a) run 을 RUN_B(gitSha/dateToken 모두 다름)로 바꾼 재조립에서 세 publish 의 searchQuery 가 함께 새 marker 로 이동(RUN_A 의 searchQuery 와 다름) AND 여전히 세 publish 상호 byte-identical AND 새 marker 담은 2·3차 hit 로도 round-trip 이 닫힘(update 로 좁혀짐)", () => {
      const threadA = crossPublishMarkerThread(
        evalOutcome(),
        collectOutcome(),
        { ...RUN_A },
        M,
      );
      const threadB = crossPublishMarkerThread(
        evalOutcome(),
        collectOutcome(),
        { ...RUN_B },
        M,
      );
      // 세 publish anchor 가 함께 새 marker 로 이동(원래 run 과 다름).
      expect(threadB.anchor1).not.toBe(threadA.anchor1);
      expect(threadB.commandArgs.searchQuery).not.toBe(
        threadA.commandArgs.searchQuery,
      );
      // 여전히 RUN_B 세 publish 상호 byte-identical.
      expect(threadB.anchor2).toBe(threadB.anchor1);
      expect(threadB.anchor3).toBe(threadB.anchor1);
      // 새 run 에서도 round-trip 이 닫힘(update 로 좁혀짐).
      expect(threadB.plan2.action.action).toBe("update");
      expect(threadB.plan3.action.action).toBe("update");
    });

    it("(b) searchQuery 는 반드시 commandArgs 빌더가 descriptor.marker 로부터만 산출(임의 문자열을 직접 주입하는 우회 경로 없음) — commandArgs.searchQuery === descriptor.marker 로 확인", () => {
      const { commandArgs, descriptor } = crossPublishMarkerThread(
        evalOutcome(),
        collectOutcome(),
        { ...RUN_A },
        M,
      );
      // 유일 산출 경로: commandArgs.searchQuery 는 descriptor.marker 를 그대로 담는다.
      expect(commandArgs.searchQuery).toBe(descriptor.marker);
      // descriptor.marker 는 run-token(gitSha/dateToken) 파생이라 두 토큰을 모두 포함.
      expect(descriptor.marker).toContain(RUN_A.gitSha);
      expect(descriptor.marker).toContain(RUN_A.dateToken);
    });
  });

  describe("branch — create/update 두 분기 대칭 + anchor 불변", () => {
    it("(a) 1차 plan1: 'create'(빈 search), 2·3차 plan2/plan3: 'update'(1차 body 담은 hit)이더라도 세 publish 가 검색에 쓰는 anchor(commandArgs.searchQuery)는 분기 선택과 독립하게 동일", () => {
      const { commandArgs, plan1, plan2, plan3, anchor1, anchor2, anchor3 } =
        crossPublishMarkerThread(
          evalOutcome(),
          collectOutcome(),
          { ...RUN_A },
          M,
        );
      // 검색 분기는 서로 다름(create vs update).
      expect(plan1.action.action).toBe("create");
      expect(plan2.action.action).toBe("update");
      expect(plan3.action.action).toBe("update");
      // 그럼에도 세 publish anchor 는 분기 무관하게 동일.
      expect(anchor1).toBe(commandArgs.searchQuery);
      expect(anchor2).toBe(commandArgs.searchQuery);
      expect(anchor3).toBe(commandArgs.searchQuery);
    });

    it("(b) resolve 의 create/update 분기 판정 discriminant 가 hit.body.includes(searchQuery)(anchor 매체) 임을 빈 search(create)·marker 담은 hit(update)·marker 제거 hit(create) 세 stdout 으로 각각 확인 — anchor 안정성이 재발견 성패를 가르는 유일 매체", () => {
      const { commandArgs, descriptor, createBody } = crossPublishMarkerThread(
        evalOutcome(),
        collectOutcome(),
        { ...RUN_A },
        M,
      );
      // 빈 search → create.
      const empty = resolveRealDataDailyStepDualLegRunReportIssueGhCommandPlan(
        "[]",
        commandArgs,
      );
      expect(empty.action.action).toBe("create");
      // marker 담은 hit(=1차 create body) → update.
      const matched =
        resolveRealDataDailyStepDualLegRunReportIssueGhCommandPlan(
          singleHitStdout(M, descriptor.title, createBody),
          commandArgs,
        );
      expect(matched.action.action).toBe("update");
      // marker 제거 hit → create(round-trip 깨짐).
      const removed =
        resolveRealDataDailyStepDualLegRunReportIssueGhCommandPlan(
          singleHitStdout(M, descriptor.title, MARKER_FREE_BODY),
          commandArgs,
        );
      expect(removed.action.action).toBe("create");
    });
  });

  describe("branch — run/leg outcome status 무관 anchor 안정", () => {
    it("(a) 동일 run 고정, leg outcome 조합만 다르게(eval pass/collect pass vs eval fail/collect skip) → 세 publish 의 searchQuery 동일 + round-trip 닫힘 유지(marker 는 run 종속, leg status/overallStatus 무관)", () => {
      const passThread = crossPublishMarkerThread(
        { leg: "eval", action: "run", passed: true },
        { leg: "collect", action: "run", passed: true },
        { ...RUN_A },
        M,
      );
      const mixedThread = crossPublishMarkerThread(
        { leg: "eval", action: "run", passed: false },
        { leg: "collect", action: "skip" },
        { ...RUN_A },
        M,
      );
      // overallStatus 는 서로 다름(축 분리 구조 확인).
      expect(passThread.report.overallStatus).not.toBe(
        mixedThread.report.overallStatus,
      );
      // 그러나 두 thread 의 searchQuery 동일 + round-trip 닫힘 유지.
      expect(mixedThread.commandArgs.searchQuery).toBe(
        passThread.commandArgs.searchQuery,
      );
      for (const t of [passThread, mixedThread]) {
        expect(t.anchor2).toBe(t.anchor1);
        expect(t.anchor3).toBe(t.anchor1);
        expect(t.plan2.action.action).toBe("update");
        expect(t.plan3.action.action).toBe("update");
      }
    });

    it("(b) 서로 다른 run 두 개(run_A/run_B, 서로 substring 아님) → 각 run 의 세 publish searchQuery 는 run 내부에서 상호 byte-identical 이되 run_A 의 searchQuery !== run_B 의 searchQuery(anchor 가 run 을 구분)", () => {
      const threadA = crossPublishMarkerThread(
        evalOutcome(),
        collectOutcome(),
        { ...RUN_A },
        M,
      );
      const threadB = crossPublishMarkerThread(
        evalOutcome(),
        collectOutcome(),
        { ...RUN_B },
        M,
      );
      // run 내부 세 publish 상호 byte-identical.
      for (const t of [threadA, threadB]) {
        expect(t.anchor2).toBe(t.anchor1);
        expect(t.anchor3).toBe(t.anchor1);
      }
      // run 간에는 서로 다름(anchor 가 run 을 구분).
      expect(threadA.commandArgs.searchQuery).not.toBe(
        threadB.commandArgs.searchQuery,
      );
    });
  });

  describe("error path / negative cases — 예외 분기마다 각 1+ (단일 negative 금지)", () => {
    it("(a) run.gitSha 빈/공백 → descriptor(stage 1, report 합성) guard throw 로 chain 시작 차단", () => {
      expect(() =>
        crossPublishMarkerThread(
          evalOutcome(),
          collectOutcome(),
          { gitSha: "   ", dateToken: RUN_A.dateToken },
          M,
        ),
      ).toThrow();
    });

    it("(b) run.dateToken 빈/공백 → descriptor(stage 1) guard throw 대칭(gitSha 유효해도 필드별 독립 분기)", () => {
      expect(() =>
        crossPublishMarkerThread(
          evalOutcome(),
          collectOutcome(),
          { gitSha: RUN_A.gitSha, dateToken: "" },
          M,
        ),
      ).toThrow();
    });

    it("(c) descriptor.marker 빈/공백 상황(descriptor 를 손상시켜 commandArgs 빌더에 주입) → command-args 빌더 guard throw(빈 검색 anchor 로 인한 재발견 붕괴 상류 차단)", () => {
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
          marker: "   ",
        }),
      ).toThrow();
    });

    it("(c') descriptor.title 빈/공백 상황 → command-args 빌더 guard throw(marker 와 별개 필드 분기)", () => {
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
          title: "",
        }),
      ).toThrow();
    });

    it("(d) 2·3차 조립 시 컴포저에 넣는 search stdout 이 비-JSON('{') → 종단 컴포저 파서 throw 로 update plan 미산출(손상 search stdout 이 재발견 판정으로 새는 것 상류 차단)", () => {
      expect(() =>
        crossPublishMarkerThread(
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
        crossPublishMarkerThread(
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

    it("(e) 2차 search-hit body 에서 marker 를 제거(무관 본문) → round-trip 미성립으로 resolve 가 'create' 분기(신규 이슈 생성 시도) — 재발견 실패가 조용히 update 로 위장되지 않고 실제 create 로 관찰됨(핵심 2 (c)와 별개로 negative 축에서도 명시)", () => {
      const { plan2, plan3 } = crossPublishMarkerThread(
        evalOutcome(),
        collectOutcome(),
        { ...RUN_A },
        M,
        { hitBody2: MARKER_FREE_BODY },
      );
      // 2차는 marker 제거로 create 로 떨어짐.
      expect(plan2.action.action).toBe("create");
      // 3차는 정상 1차 body 담은 hit 이라 여전히 update(2차 손상이 3차로 전파되지 않음).
      expect(plan3.action.action).toBe("update");
    });
  });

  describe("결정론 · 무공유 · no-mutation", () => {
    it("동일 (run, leg outcomes, M) 입력으로 3-cycle chain 두 번 → descriptor/commandArgs/plan1/plan2/plan3 이 두 번 deep-equal(plan.argv 배열·commandArgs.searchQuery 포함)", () => {
      const a = crossPublishMarkerThread(
        evalOutcome(),
        collectOutcome(),
        { ...RUN_A },
        M,
      );
      const b = crossPublishMarkerThread(
        evalOutcome(),
        collectOutcome(),
        { ...RUN_A },
        M,
      );
      expect(a.descriptor).toEqual(b.descriptor);
      expect(a.commandArgs).toEqual(b.commandArgs);
      expect(a.commandArgs.searchQuery).toBe(b.commandArgs.searchQuery);
      expect(a.plan1).toEqual(b.plan1);
      expect(a.plan2).toEqual(b.plan2);
      expect(a.plan2.argv).toEqual(b.plan2.argv);
      expect(a.plan3).toEqual(b.plan3);
    });

    it("no-mutation — 입력 run/leg outcome literal 이 chain 호출 후 mutate 0(원본 deep-equal 유지, snapshot 대조)", () => {
      const run: RealDataResultIssueRunRef = { ...RUN_A };
      const evalLeg = evalOutcome();
      const collectLeg = collectOutcome();
      const runBefore = JSON.parse(JSON.stringify(run));
      const evalBefore = JSON.parse(JSON.stringify(evalLeg));
      const collectBefore = JSON.parse(JSON.stringify(collectLeg));

      crossPublishMarkerThread(evalLeg, collectLeg, run, M);

      expect(run).toEqual(runBefore);
      expect(evalLeg).toEqual(evalBefore);
      expect(collectLeg).toEqual(collectBefore);
    });

    it("무공유 — plan1·plan2·plan3 객체가 서로/다음 호출 결과와 referential identity 분리(not.toBe) — searchQuery 문자열 값은 같아도 plan 객체는 무공유", () => {
      const a = crossPublishMarkerThread(
        evalOutcome(),
        collectOutcome(),
        { ...RUN_A },
        M,
      );
      const b = crossPublishMarkerThread(
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
    it("chain 안 어디에서도(descriptor.{title,marker,body} / commandArgs.searchQuery / commandArgs.createArgs.body / plan.argv(1·2·3차 전체)) token/secret/raw narrative 어휘 미등장", () => {
      const { descriptor, commandArgs, plan1, plan2, plan3 } =
        crossPublishMarkerThread(
          evalOutcome(),
          collectOutcome(),
          { ...RUN_A },
          M,
        );

      const joined = [
        descriptor.title,
        descriptor.marker,
        descriptor.body,
        commandArgs.searchQuery,
        commandArgs.createArgs.body,
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

    it("commandArgs.searchQuery 가 순수 marker 문자열(run 식별 파생)만 담고 credential·raw github API 토큰·query string 조작자 미포함", () => {
      const { commandArgs } = crossPublishMarkerThread(
        evalOutcome(),
        collectOutcome(),
        { ...RUN_A },
        M,
      );
      expect(commandArgs.searchQuery).not.toContain("ghp_");
      expect(commandArgs.searchQuery).not.toContain("--token");
      expect(commandArgs.searchQuery).not.toContain("&");
      // run 식별 파생 marker — run 두 토큰을 포함(순수 marker source).
      expect(commandArgs.searchQuery).toContain(RUN_A.gitSha);
      expect(commandArgs.searchQuery).toContain(RUN_A.dateToken);
    });

    it("leg outcome.specPath 에 sentinel 을 넣어도 세 publish searchQuery 표면에 sentinel 미누출(marker 는 run-token 파생, leg outcome 무관)", () => {
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
      const { commandArgs, anchor1, anchor2, anchor3 } =
        crossPublishMarkerThread(evalLeg, collectLeg, { ...RUN_A }, M);
      for (const anchor of [
        anchor1,
        anchor2,
        anchor3,
        commandArgs.searchQuery,
      ]) {
        expect(anchor).not.toContain(sentinel);
      }
    });

    it("descriptor/command-args guard throw 메시지가 raw 활동 본문·credential 을 노출하지 않음(필드명·유효성만) — marker 빈/공백 negative case 에서 확인", () => {
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
          marker: "   ",
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
