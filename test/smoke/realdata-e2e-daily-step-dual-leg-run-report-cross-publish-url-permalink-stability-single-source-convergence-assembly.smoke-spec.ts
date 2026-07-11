// realdata-e2e-daily-step-dual-leg-run-report-cross-publish-url-permalink-
// stability-single-source-convergence-assembly.smoke-spec.ts — 실 평가 e2e
// daily-step dual-leg run report 를 **같은 run 으로 여러 밤 연속 publish**(1차
// create + 멱등 확인용 2·3차 update)할 때, 사람이 여는 rolling-issue 의
// permalink(`outcome.url`)가 1차 create 와 그 이후 모든 update 에서 **byte-identical
// 하게 안정**(모두 `.../issues/M`)함을 박제하는 cross-publish url permalink stability
// single-source convergence non-gated build-time smoke (T-0937 박제, PLAN.md 109행
// 🟢 실 평가 e2e step ④, REQ-009 멱등성 — 사람-링크 무결성 축).
//
// 절단면 — cross-publish url permalink stability(멱등의 사람-링크 무결성):
//   REQ-009 멱등("동일 run 의 기존 이슈를 찾아 갱신, 중복 생성 안 함")은 **두 얼굴**을
//   갖는다:
//     - issueNumber 축(republish T-0922 봉합) — 1차 create-output 이 낳은 번호 M 이 2차
//       search-hit 로 threading 해 resolve 가 `update`/M 으로 좁혀짐. republish 는 이
//       **번호 state-transition** 을 자산화한다(url 은 leak-check 에서만 인용).
//     - url permalink 축(본 spec 봉합) — 사람은 내부 식별자 issueNumber 가 아니라
//       **outcome.url(브라우저로 여는 링크)** 을 실제로 연다. rolling-issue 멱등이
//       성립하려면 1차 밤에 create 로 받은 permalink `.../issues/M` 이 2차·3차 밤의
//       update 후에도 **같은 M 을 가리키는 같은 URL** 이어야 한다 — 그래야 사람이
//       북마크한 링크가 rolling 갱신마다 조용히 다른 이슈로 튀지 않는다.
//   이 **url permalink 가 cross-publish 로 안정함(1차 create url == 2·3차 update url ==
//   `.../issues/M`)** 이 REQ-009 멱등의 사람-링크 무결성 마지막 그물이다. 그리고 그
//   안정성의 load-bearing 근거는 literal 하드코딩이 아니라 **1차 create-output 이 낳은
//   M 이 2차·3차 edit execStdout 의 permalink 로 다시 관통**함이다: 2차/3차 edit
//   execStdout 을 `.../issues/${outcome1.issueNumber}`(M 을 1차 outcome 에서 threading,
//   republish 가 봉합한 그 threaded M)로 구성 → output-parse → `outcome2.url ===
//   outcome1.url` AND `outcome3.url === outcome1.url`.
//
// 형제 smoke 와의 차별(= cross-publish url 상호 동일성):
//   * republish(T-0922) — 1차 create-output 의 M 이 2차 search-input 으로 threading 해
//     2차 resolve 가 `update`/M 으로 좁혀짐(**issueNumber state-transition**)만 자산화 —
//     url 은 credential-leak `not.toContain` 대조에서만 등장하고, 두 publish 의
//     outcome.url 이 서로 byte-identical(permalink 안정)함은 미단언. 그 state-transition
//     자체 재단언 금지 — 본 spec 은 그 threaded M 이 낳는 **url 축 짝**만.
//   * T-0936(output-parse url↔issueNumber cross-field) — **단일 outcome 내부**에서 url 이
//     그 outcome 의 issueNumber 를 포함(url ⊇ issueNumber)함만 자산화 — 여러 publish 에
//     걸친 url 의 동일성(cross-publish)은 대상이 아니다(intra-outcome ≠ cross-publish).
//   * T-0924(output-stdout-value-consistency) — outcome 전체 값(url 포함)이 자기 raw
//     stdout 으로부터 재유도한 expected 와 deep-equal 임만 자산화 — 각 publish 의
//     outcome 을 **자기 stdout 과 개별** 대조할 뿐, 여러 publish 의 url 상호 동일성은
//     못 박지 않는다.
//   * T-0935(create genesis)·T-0920(update convergence)은 issueNumber 의 출처/관통만,
//     T-0923(parse-shape)은 outcome key set 만 자산화 — url 의 cross-publish 안정성과 무관.
//   본 spec 은 그 cross-publish url permalink stability seam 만 닫는다.
//
// 따라서 본 spec 은:
//    🔥 실 LLM 호출 0 — orchestrator / scoring service / gateway 미사용. synthetic leg
//       outcome / run / stdout literal 을 조립 체인에 직접 공급(실 평가·수집·jest spawn 0).
//    🔥 실 네트워크 호출 0 — github / Ollama / gh 호출 0. fetch 0. process.env 읽기 0.
//    🔥 실 gh 실행 0 — search / issue create / issue edit 실 실행 0. execFile('gh', …) 0.
//       실 github rolling-publish 부작용 0 — create/edit-exec 의 URL·M 은 synthetic
//       stdout literal 로 대체.
//    🔥 credential 0 / secret 0 / DB 0 / 비용 0 — public CI 에서 항상 green 발화(R-113).
//    🔥 새 외부 dependency 0 — 기존 build*/resolve*/parse* 컴포저 import 재사용만
//       (consistency-guard·helper·type 신설 0).
//    🔥 gating / describe.skip / env-gating 배선 0 — 순수 build-time in-memory 검증만.
//    🔥 REQ-009 멱등 근거 — 사람이 북마크한 링크(outcome.url)가 rolling 갱신마다 같은
//       이슈(`.../issues/M`)를 가리킴. / REQ-037 / REQ-059 — outcome 은 {issueNumber, url}
//       만 담고 raw 활동 본문·credential 미저장.
//
// Out of Scope (T-0937):
//   - 형제 republish(T-0922)의 issueNumber M cross-publish state-transition(2차 resolve
//     update/M) 축 재단언 — M threading 기법은 mirror 하되 argv[2]===String(M) 는 url
//     안정성의 전제로만 최소 인용(그 state-transition 자체 재검증 아님).
//   - 형제 T-0936 의 단일 outcome url ⊇ issueNumber(intra-outcome) 축 재단언 — 본 spec 은
//     여러 publish 의 url 상호 동일성(cross-publish).
//   - 형제 T-0924(outcome↔자기 stdout deep-equal)·T-0935(genesis)·T-0920(convergence)·
//     T-0923(parse-shape key set) 축 재단언.
//   - descriptor / command-args / action resolver / gh-command-plan 컴포저 / output-parse
//     파서 본문 변경 — import·호출만(각 배선 이미 T-0896~T-0907 박제).
//   - 새 컴포저 / consistency 가드 / helper / type 신설 — 기존 helper import·호출만.
//   - production src/ 코드 / package.json / lockfile / test/jest-smoke.json 변경.
import {
  buildRealDataDailyStepDualLegRunReport,
  type RealDataDailyStepLegRunOutcome,
} from "../helpers/realdata-e2e-daily-step-dual-leg-run-report";
import { buildRealDataDailyStepDualLegRunReportIssueCommandArgs } from "../helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-command-args";
import { buildRealDataDailyStepDualLegRunReportIssueDescriptor } from "../helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-descriptor";
import { resolveRealDataDailyStepDualLegRunReportIssueGhCommandPlan } from "../helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-gh-command-plan";
import { parseRealDataDailyStepDualLegRunReportIssueCreateEditOutput } from "../helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-output-parse";
import type { RealDataResultIssueRunRef } from "../helpers/realdata-e2e-result-issue-descriptor";

// 결정론 run 식별자 fixture — gitSha + dateToken 비공백 안정 토큰. 매 it 가 spread 복제로
// 받아 입력 mutate 누설 0. token/secret/raw narrative 어휘 미포함(credential 누출 0 단언
// fixture 전제).
const RUN_A: RealDataResultIssueRunRef = {
  gitSha: "abc1234",
  dateToken: "2026-07-11",
};

// 서로 다른 run — gitSha·dateToken 이 RUN_A 와 서로 substring 이 아닌 구별 가능 값(url 은
// execStdout 종속이라 run 이 달라도 cross-publish 안정 유지 단언용).
const RUN_B: RealDataResultIssueRunRef = {
  gitSha: "def5678",
  dateToken: "2026-07-12",
};

// 안정 issue URL host — 실 gh round-trip 없이 synthetic literal 로 대체한다.
const ISSUE_URL_HOST = "https://github.com/myungjoo/assessment-agent";

// 1차 create-exec 이 돌려줄 synthetic 이슈 번호 M — github 이 새 이슈에 부여한 번호를
// 흉내낸다. marker·title·body 어느 조각과도 substring 관계가 없는 양수로 골라 threading
// 축이 우연 매칭이 아님을 보장한다. 이 M 은 literal 로 edit stdout 에 직접 쓰지 않고
// **1차 create-output 파서 결과(outcome1.issueNumber)에서 뽑아** 2·3차 edit permalink 로
// threading 한다.
const M = 58231;
// M 을 다른 값으로 바꾼 재구성(threading single-source) 검증용 — M 과 다른 양수.
const M2 = 77419;
// guard-against-vacuity 용 — 2차 edit stdout 이 M 아닌 X(X≠M)로 어긋났을 때 stability
// 단언이 실제로 divergence 를 감지함을 보이는 버그-시뮬레이션 번호.
const X_WRONG = 90007;

// synthetic 이슈 URL(정규화 후 기대값) — output-parse 산출 url 대조용.
function issueUrl(n: number): string {
  return `${ISSUE_URL_HOST}/issues/${n}`;
}

// synthetic `gh issue create`/`gh issue edit` stdout — 지정 이슈 번호의 유효 issue URL 한
// 줄(trailing 개행 포함). 실 gh 실행 없이 output-parse 에 직접 주입한다. url·issueNumber 두
// 필드가 태어나는 유일한 source URL.
function issueUrlStdout(n: number): string {
  return `${issueUrl(n)}\n`;
}

// marker 를 body 에 포함한 synthetic search stdout(1+ hit) — 2차 이후 update 분기 유도.
// gh search issues --json number,title,body 응답을 흉내낸 literal. number=n 이 search-hit
// 단일 source(2차 이후엔 1차 create-output 의 M 을 threading 해 넣는다).
function markerHitStdout(marker: string, ...numbers: number[]): string {
  return JSON.stringify(
    numbers.map((n) => ({
      number: n,
      title: `기존 dual-leg run report 이슈 #${n}`,
      body: `${marker}\n\n본문 일부`,
    })),
  );
}

// synthetic 기본 leg outcome fixture — eval / collect 각 leg 의 run outcome literal. 조립
// 체인은 leg outcome 을 report → descriptor 로 흘려보내는 surface 만 검증하므로 도메인
// 타입 정합만 만족하는 minimal literal 로 충분하다(실 jest spawn 0).
function evalOutcome(): RealDataDailyStepLegRunOutcome {
  return { leg: "eval", action: "run", passed: true };
}

function collectOutcome(): RealDataDailyStepLegRunOutcome {
  return { leg: "collect", action: "run", passed: true };
}

// url 의 마지막 path segment(번호)를 정규식으로 추출 — helper 규약을 재계산하지 않고 url
// 문자열 자체에서 뽑아 세 permalink 의 번호 segment 가 같은 M 인지 구조적으로 대조한다.
function issueSegmentOf(url: string): string {
  const match = /\/issues\/(\d+)$/.exec(url);
  if (match === null) {
    throw new Error(`url 에서 /issues/<n> segment 를 찾지 못했습니다: ${url}`);
  }
  return match[1];
}

// 순수 issue URL 정규 형태 — credential·query string·raw 토큰 0.
const PURE_ISSUE_URL = /^https:\/\/github\.com\/[^/\s]+\/[^/\s]+\/issues\/\d+$/;

// cross-publish 3-cycle threading 조립 — 같은 run·같은 leg outcome 으로 세 publish cycle 을
// 잇되, **1차 create-output 의 issueNumber M 을 2·3차 edit permalink 로 threading** 한다.
//   (1) 1차: 빈 검색("[]") → create 분기 → create execStdout(`.../issues/m`) →
//       output-parse → outcome1. threading source = outcome1.issueNumber.
//   (2) 2차: outcome1.issueNumber(=M) 를 담은 marker-매칭 hit → update 분기 → edit
//       execStdout(`.../issues/${outcome1.issueNumber}` — literal 하드코딩 아님) →
//       output-parse → outcome2.
//   (3) 3차(멱등 확인): 동일 반복 → outcome3(같은 M fixed-point).
// literal M 하드코딩 0 — 2·3차 edit permalink 는 항상 outcome1.issueNumber threading.
// opts 로 (a) editStdout2 를 다른 값/손상 stdout 으로 덮어 vacuity·negative 재현,
// (b) createStdout 을 손상 stdout 으로 덮어 create-측 파서 throw 재현,
// (c) searchStdout2 를 손상 search 로 덮어 상류 컴포저 throw 재현 가능.
function crossPublishThread(
  evalLeg: RealDataDailyStepLegRunOutcome,
  collectLeg: RealDataDailyStepLegRunOutcome,
  run: RealDataResultIssueRunRef,
  m: number,
  opts?: {
    createStdout?: string;
    editStdout2?: string;
    searchStdout2?: string;
  },
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

  // (1) 1차 create — 빈 search → create 분기 → create execStdout → outcome1.
  const plan1 = resolveRealDataDailyStepDualLegRunReportIssueGhCommandPlan(
    "[]",
    commandArgs,
  );
  const createStdout = opts?.createStdout ?? issueUrlStdout(m);
  const outcome1 =
    parseRealDataDailyStepDualLegRunReportIssueCreateEditOutput(createStdout);
  // threading source — 1차 create-output 이 낳은 M(literal 아님).
  const threadedM = outcome1.issueNumber;

  // (2) 2차 update — outcome1.issueNumber(=M) 를 marker hit 으로 threading → update 분기.
  const searchStdout2 =
    opts?.searchStdout2 ?? markerHitStdout(descriptor.marker, threadedM);
  const plan2 = resolveRealDataDailyStepDualLegRunReportIssueGhCommandPlan(
    searchStdout2,
    commandArgs,
  );
  // edit execStdout — M 을 1차 outcome 에서 threading(`.../issues/${outcome1.issueNumber}`).
  const editStdout2 = opts?.editStdout2 ?? issueUrlStdout(threadedM);
  const outcome2 =
    parseRealDataDailyStepDualLegRunReportIssueCreateEditOutput(editStdout2);

  // (3) 3차 update — 같은 M 재관통(멱등 fixed-point).
  const searchStdout3 = markerHitStdout(descriptor.marker, threadedM);
  const plan3 = resolveRealDataDailyStepDualLegRunReportIssueGhCommandPlan(
    searchStdout3,
    commandArgs,
  );
  const editStdout3 = issueUrlStdout(threadedM);
  const outcome3 =
    parseRealDataDailyStepDualLegRunReportIssueCreateEditOutput(editStdout3);

  return {
    report,
    descriptor,
    commandArgs,
    plan1,
    plan2,
    plan3,
    outcome1,
    outcome2,
    outcome3,
    M: threadedM,
  };
}

describe("Smoke(non-gated): dual-leg run report cross-publish url permalink stability single-source(1차 create url == 2·3차 update url == .../issues/M) live-gh 0 검증", () => {
  describe("happy path — 3-cycle threading chain 산출 정상", () => {
    it("세 outcome(1차 create / 2·3차 update)이 모두 {issueNumber, url} 2필드를 정확히 보유하고 url 은 비어있지 않은 문자열, issueNumber 는 양의 정수(2·3차 edit permalink 는 outcome1.issueNumber threading — literal 하드코딩 아님)", () => {
      const { outcome1, outcome2, outcome3 } = crossPublishThread(
        evalOutcome(),
        collectOutcome(),
        { ...RUN_A },
        M,
      );
      for (const outcome of [outcome1, outcome2, outcome3]) {
        expect(Object.keys(outcome).sort()).toEqual(["issueNumber", "url"]);
        expect(typeof outcome.url).toBe("string");
        expect(outcome.url.length).toBeGreaterThan(0);
        expect(typeof outcome.issueNumber).toBe("number");
        expect(Number.isInteger(outcome.issueNumber)).toBe(true);
        expect(outcome.issueNumber).toBeGreaterThan(0);
      }
    });
  });

  describe("핵심 1 — cross-publish url permalink stability(세 url byte-identical)", () => {
    it("(a) outcome2.url === outcome1.url AND outcome3.url === outcome1.url(strict ===, byte-identical) — rolling 갱신마다 사람이 여는 permalink 가 어긋나지 않음", () => {
      const { outcome1, outcome2, outcome3 } = crossPublishThread(
        evalOutcome(),
        collectOutcome(),
        { ...RUN_A },
        M,
      );
      expect(outcome2.url).toBe(outcome1.url);
      expect(outcome3.url).toBe(outcome1.url);
      // 대칭 확인 — 세 url 전부 동일 인스턴스 값.
      expect(outcome2.url).toBe(outcome3.url);
    });

    it("(b) 세 outcome.url 이 모두 `.../issues/${M}` 로 끝남 AND 세 url 의 /issues/<seg> 번호 segment 가 모두 String(M)", () => {
      const { outcome1, outcome2, outcome3 } = crossPublishThread(
        evalOutcome(),
        collectOutcome(),
        { ...RUN_A },
        M,
      );
      for (const outcome of [outcome1, outcome2, outcome3]) {
        expect(outcome.url.endsWith(`/issues/${M}`)).toBe(true);
        expect(issueSegmentOf(outcome.url)).toBe(String(M));
      }
    });

    it("(c) 세 outcome.issueNumber 도 모두 === M — url 안정성이 issueNumber 안정성과 동행(사람-링크와 내부 식별자가 같은 이슈 M)", () => {
      const { outcome1, outcome2, outcome3 } = crossPublishThread(
        evalOutcome(),
        collectOutcome(),
        { ...RUN_A },
        M,
      );
      expect(outcome1.issueNumber).toBe(M);
      expect(outcome2.issueNumber).toBe(M);
      expect(outcome3.issueNumber).toBe(M);
    });
  });

  describe("핵심 2 — threading single-source(url 이 threaded M 종속, literal 아님)", () => {
    it("(a) 1차 create execStdout 의 M 을 M2(M≠M2)로 바꾼 재구성 3-cycle 에서 세 outcome.url 이 함께 `.../issues/M2` 로 이동(2·3차 edit stdout 이 outcome1.issueNumber threading 이므로 자동 반영) AND 여전히 세 url 상호 byte-identical — 세 url 은 독립 고정 literal 이 아니라 1차 create-output M 단일 source 종속", () => {
      const {
        outcome1,
        outcome2,
        outcome3,
        M: threaded,
      } = crossPublishThread(evalOutcome(), collectOutcome(), { ...RUN_A }, M2);
      // threading source 가 M2 로 이동.
      expect(threaded).toBe(M2);
      // 세 url 이 함께 M2 로 이동.
      for (const outcome of [outcome1, outcome2, outcome3]) {
        expect(outcome.url).toBe(issueUrl(M2));
        expect(outcome.issueNumber).toBe(M2);
      }
      // 여전히 세 url 상호 byte-identical.
      expect(outcome2.url).toBe(outcome1.url);
      expect(outcome3.url).toBe(outcome1.url);
    });

    it("(b) guard-against-vacuity — 2차 edit execStdout 을 outcome1.issueNumber 대신 다른 번호 X(X≠M)로 (버그 시뮬레이션) 구성하면 outcome2.url !== outcome1.url(permalink 어긋남을 test 가 실제로 감지 — 즉 (a)의 stability 단언이 vacuous 가 아님)", () => {
      const { outcome1, outcome2 } = crossPublishThread(
        evalOutcome(),
        collectOutcome(),
        { ...RUN_A },
        M,
        { editStdout2: issueUrlStdout(X_WRONG) },
      );
      expect(X_WRONG).not.toBe(M);
      // 어긋난 edit stdout → outcome2.url 이 outcome1.url 과 달라짐(감지됨).
      expect(outcome2.url).not.toBe(outcome1.url);
      expect(outcome2.url).toBe(issueUrl(X_WRONG));
      expect(outcome1.url).toBe(issueUrl(M));
    });
  });

  describe("branch — create/update 두 분기 대칭 + argv 관통(전제 최소 인용)", () => {
    it("(a) 1차 plan1.action.action === 'create'(빈 search 분기), 2·3차 plan2/plan3.action.action === 'update' AND plan.argv[2] === String(outcome1.issueNumber)(=gh issue edit M, pre-exec 존재) — republish 봉합 M threading 을 url 안정성 전제로만 최소 인용", () => {
      const { plan1, plan2, plan3, outcome1 } = crossPublishThread(
        evalOutcome(),
        collectOutcome(),
        { ...RUN_A },
        M,
      );
      // 1차 create 분기.
      expect(plan1.action.action).toBe("create");
      // 2·3차 update 분기 + editArgv[2] === String(M).
      for (const plan of [plan2, plan3]) {
        expect(plan.action.action).toBe("update");
        if (plan.action.action === "update") {
          expect(plan.action.issueNumber).toBe(outcome1.issueNumber);
        }
        expect(plan.argv[0]).toBe("issue");
        expect(plan.argv[1]).toBe("edit");
        expect(plan.argv[2]).toBe(String(outcome1.issueNumber));
      }
    });

    it("(b) outcome.url 은 edit execStdout 한 지점에서만 유도되며 세 url 동일성이 검색 분기(1차 create / 2·3차 update) 선택과 독립 — 1차는 create 분기, 2·3차는 update 분기임에도 세 url 이 같은 `.../issues/M`", () => {
      const { plan1, plan2, plan3, outcome1, outcome2, outcome3 } =
        crossPublishThread(evalOutcome(), collectOutcome(), { ...RUN_A }, M);
      // 검색 분기는 서로 다름(create vs update).
      expect(plan1.action.action).toBe("create");
      expect(plan2.action.action).toBe("update");
      expect(plan3.action.action).toBe("update");
      // 그럼에도 세 url 은 동일(edit/create execStdout URL 한 지점 co-유도, 분기 무관).
      expect(outcome1.url).toBe(issueUrl(M));
      expect(outcome2.url).toBe(issueUrl(M));
      expect(outcome3.url).toBe(issueUrl(M));
    });
  });

  describe("branch — run/leg outcome 무관 url 안정", () => {
    it("(a) 서로 다른 run(RUN_A/RUN_B) 각각 3-cycle chain 호출하되 동일 M → 두 run 모두 세 outcome.url 이 상호 byte-identical(url 은 execStdout 종속, run 무관), 단 두 chain 의 descriptor.marker(=searchQuery)는 서로 다름", () => {
      const threadA = crossPublishThread(
        evalOutcome(),
        collectOutcome(),
        { ...RUN_A },
        M,
      );
      const threadB = crossPublishThread(
        evalOutcome(),
        collectOutcome(),
        { ...RUN_B },
        M,
      );
      for (const t of [threadA, threadB]) {
        expect(t.outcome2.url).toBe(t.outcome1.url);
        expect(t.outcome3.url).toBe(t.outcome1.url);
        expect(t.outcome1.url).toBe(issueUrl(M));
      }
      // 두 run 의 url 은 서로도 동일(execStdout 종속).
      expect(threadA.outcome1.url).toBe(threadB.outcome1.url);
      // 그러나 marker(=searchQuery)는 run-token 으로 서로 다름.
      expect(threadA.descriptor.marker).not.toBe(threadB.descriptor.marker);
      expect(threadA.commandArgs.searchQuery).not.toBe(
        threadB.commandArgs.searchQuery,
      );
    });

    it("(b) 동일 run·동일 M 고정, leg outcome 조합만 다르게(eval pass/collect pass vs eval fail/collect skip) → 세 outcome.url 동일 + cross-publish 안정 유지(leg status/overallStatus 무관)", () => {
      const passThread = crossPublishThread(
        { leg: "eval", action: "run", passed: true },
        { leg: "collect", action: "run", passed: true },
        { ...RUN_A },
        M,
      );
      const mixedThread = crossPublishThread(
        { leg: "eval", action: "run", passed: false },
        { leg: "collect", action: "skip" },
        { ...RUN_A },
        M,
      );
      // overallStatus 는 서로 다름(축 분리 구조 확인).
      expect(passThread.report.overallStatus).not.toBe(
        mixedThread.report.overallStatus,
      );
      // 그러나 두 thread 모두 세 url 동일 + cross-publish 안정.
      for (const t of [passThread, mixedThread]) {
        expect(t.outcome2.url).toBe(t.outcome1.url);
        expect(t.outcome3.url).toBe(t.outcome1.url);
        expect(t.outcome1.url).toBe(issueUrl(M));
      }
      // 두 thread 의 url 도 서로 동일(leg status 무관).
      expect(passThread.outcome1.url).toBe(mixedThread.outcome1.url);
    });
  });

  describe("error path / negative cases — 예외 분기마다 각 1+ (단일 negative 금지)", () => {
    it("(a) run.gitSha 빈/공백 → descriptor(stage 1, report 합성) guard throw 로 chain 시작 차단", () => {
      expect(() =>
        crossPublishThread(
          evalOutcome(),
          collectOutcome(),
          { gitSha: "   ", dateToken: RUN_A.dateToken },
          M,
        ),
      ).toThrow();
    });

    it("(b) run.dateToken 빈/공백 → descriptor(stage 1) guard throw 대칭(gitSha 유효해도 필드별 독립 분기)", () => {
      expect(() =>
        crossPublishThread(
          evalOutcome(),
          collectOutcome(),
          { gitSha: RUN_A.gitSha, dateToken: "" },
          M,
        ),
      ).toThrow();
    });

    it("(c) execStdout 에 issue URL 미발견(빈/무관 텍스트/비-github 호스트/`/pull/`) → output-parse throw(URL-미발견 분기 — 손상 stdout 이 조용히 outcome.url 로 새어 permalink 가 어긋나는 것 차단), create·edit 양쪽 대표", () => {
      const bads = [
        "",
        "no url at all\n",
        "https://gitlab.com/myungjoo/assessment-agent/issues/9\n",
        "https://github.com/myungjoo/assessment-agent/pull/9\n",
      ];
      // create-측 대표 — 손상 createStdout 이면 outcome1 산출 전 throw.
      for (const createStdout of bads) {
        expect(() =>
          crossPublishThread(evalOutcome(), collectOutcome(), { ...RUN_A }, M, {
            createStdout,
          }),
        ).toThrow();
      }
      // edit-측 대표(비-github) — 2차 edit stdout 손상 시 outcome2 산출 throw(동일 파서 대칭).
      expect(() =>
        crossPublishThread(evalOutcome(), collectOutcome(), { ...RUN_A }, M, {
          editStdout2: "https://gitlab.com/o/r/issues/5\n",
        }),
      ).toThrow();
    });

    it("(d) edit execStdout issueNumber 비양수(/issues/0·/issues/007·/issues/abc) → output-parse assertPositiveIssueNumber throw(비양수/선행0/비정수 분기 — 비정상 번호 url 이 outcome 으로 새어 stability 를 깨는 것 차단)", () => {
      const bads = [
        issueUrlStdout(0),
        "https://github.com/myungjoo/assessment-agent/issues/007\n",
        "https://github.com/myungjoo/assessment-agent/issues/abc\n",
      ];
      for (const editStdout2 of bads) {
        expect(() =>
          crossPublishThread(evalOutcome(), collectOutcome(), { ...RUN_A }, M, {
            editStdout2,
          }),
        ).toThrow();
      }
    });

    it("(e) 2차 조립 시 컴포저에 넣는 search hit stdout 이 비-JSON('{')/비배열 JSON('{}') → 종단 컴포저 파서 throw 로 update plan(및 이후 output-parse 진입) 미산출(손상 search stdout 이 분기 판정으로 새는 것 상류 차단)", () => {
      expect(() =>
        crossPublishThread(evalOutcome(), collectOutcome(), { ...RUN_A }, M, {
          searchStdout2: "{",
        }),
      ).toThrow();
      expect(() =>
        crossPublishThread(evalOutcome(), collectOutcome(), { ...RUN_A }, M, {
          searchStdout2: "{}",
        }),
      ).toThrow();
    });
  });

  describe("결정론 · 무공유 · no-mutation", () => {
    it("동일 (run, leg outcomes, M) 입력으로 3-cycle chain 두 번 → descriptor/commandArgs/plan/세 outcome 이 두 번 deep-equal(plan.argv 배열 포함)", () => {
      const a = crossPublishThread(
        evalOutcome(),
        collectOutcome(),
        { ...RUN_A },
        M,
      );
      const b = crossPublishThread(
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
      expect(a.outcome1).toEqual(b.outcome1);
      expect(a.outcome2).toEqual(b.outcome2);
      expect(a.outcome3).toEqual(b.outcome3);
    });

    it("no-mutation — 입력 run/leg outcome literal·commandArgs 가 chain 호출 후 mutate 0(원본 deep-equal 유지, snapshot 대조)", () => {
      const run: RealDataResultIssueRunRef = { ...RUN_A };
      const evalLeg = evalOutcome();
      const collectLeg = collectOutcome();
      const runBefore = JSON.parse(JSON.stringify(run));
      const evalBefore = JSON.parse(JSON.stringify(evalLeg));
      const collectBefore = JSON.parse(JSON.stringify(collectLeg));

      const { commandArgs } = crossPublishThread(evalLeg, collectLeg, run, M);
      const commandArgsSnapshot = JSON.parse(JSON.stringify(commandArgs));
      resolveRealDataDailyStepDualLegRunReportIssueGhCommandPlan(
        "[]",
        commandArgs,
      );

      expect(run).toEqual(runBefore);
      expect(evalLeg).toEqual(evalBefore);
      expect(collectLeg).toEqual(collectBefore);
      expect(commandArgs).toEqual(commandArgsSnapshot);
    });

    it("무공유 — outcome1·outcome2·outcome3 객체가 서로/다음 호출 결과와 referential identity 분리(not.toBe) — url 문자열 값은 같아도 outcome 객체는 무공유", () => {
      const a = crossPublishThread(
        evalOutcome(),
        collectOutcome(),
        { ...RUN_A },
        M,
      );
      const b = crossPublishThread(
        evalOutcome(),
        collectOutcome(),
        { ...RUN_A },
        M,
      );
      // 같은 thread 안 세 outcome 객체 분리(url 값 같아도 다른 인스턴스).
      expect(a.outcome1).not.toBe(a.outcome2);
      expect(a.outcome1).not.toBe(a.outcome3);
      expect(a.outcome2).not.toBe(a.outcome3);
      // 재호출 결과와도 분리.
      expect(a.outcome2).not.toBe(b.outcome2);
      expect(a.plan2.argv).not.toBe(b.plan2.argv);
    });
  });

  describe("raw / credential 누출 0(R-59 / REQ-059)", () => {
    it("chain 안 어디에서도(descriptor.{title,marker,body} / searchQuery / plan.argv(1·2·3차 전체) / outcome1·outcome2·outcome3.url) token/secret/raw narrative 어휘 미등장", () => {
      const {
        descriptor,
        commandArgs,
        plan1,
        plan2,
        plan3,
        outcome1,
        outcome2,
        outcome3,
      } = crossPublishThread(evalOutcome(), collectOutcome(), { ...RUN_A }, M);

      const joined = [
        descriptor.title,
        descriptor.marker,
        descriptor.body,
        commandArgs.searchQuery,
        ...plan1.argv,
        ...plan2.argv,
        ...plan3.argv,
        outcome1.url,
        outcome2.url,
        outcome3.url,
      ].join(" ");

      expect(joined).not.toContain("--token");
      expect(joined).not.toContain("GITHUB_TOKEN");
      expect(joined).not.toContain("GH_TOKEN");
      expect(joined).not.toContain("ghp_");
      expect(joined).not.toContain("narrative");
      expect(joined).not.toMatch(/ghp_[A-Za-z0-9]/);
    });

    it("세 outcome.url 이 모두 순수 issue URL 형식만 담고 credential·raw github API 토큰·query string 미포함", () => {
      const { outcome1, outcome2, outcome3 } = crossPublishThread(
        evalOutcome(),
        collectOutcome(),
        { ...RUN_A },
        M,
      );
      for (const outcome of [outcome1, outcome2, outcome3]) {
        expect(outcome.url).toMatch(PURE_ISSUE_URL);
        expect(outcome.url).not.toContain("?");
      }
    });

    it("leg outcome.specPath 에 sentinel 을 넣어도 세 outcome.url 표면에 sentinel 미누출(url 은 execStdout URL 파생, leg outcome 무관)", () => {
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
      const { outcome1, outcome2, outcome3 } = crossPublishThread(
        evalLeg,
        collectLeg,
        { ...RUN_A },
        M,
      );
      for (const outcome of [outcome1, outcome2, outcome3]) {
        expect(outcome.url).not.toContain(sentinel);
        expect(String(outcome.issueNumber)).not.toContain(sentinel);
      }
    });

    it("output-parse guard throw 메시지가 raw 활동 본문·credential 을 노출하지 않음(필드명·유효성만) — edit 비양수 번호 negative case 에서 확인", () => {
      const sentinel = "ghp_SENTINELsecret1234";
      let thrown: Error | undefined;
      try {
        parseRealDataDailyStepDualLegRunReportIssueCreateEditOutput(
          `${sentinel} https://github.com/myungjoo/assessment-agent/issues/0\n`,
        );
      } catch (err) {
        thrown = err as Error;
      }
      expect(thrown).toBeDefined();
      expect(thrown?.message).not.toContain(sentinel);
      expect(thrown?.message).not.toContain("ghp_");
    });
  });
});
