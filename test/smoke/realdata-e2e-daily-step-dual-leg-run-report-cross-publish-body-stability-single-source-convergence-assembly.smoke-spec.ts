// realdata-e2e-daily-step-dual-leg-run-report-cross-publish-body-stability-
// single-source-convergence-assembly.smoke-spec.ts — 실 평가 e2e daily-step
// dual-leg run report 를 **같은 run 으로 여러 밤 연속 publish**(1차 create + 멱등
// 확인용 2·3차 update)할 때, 사람이 이슈 안에서 읽는 rolling-issue 의 **본문**
// (`descriptor.body` = `--body` argv 값, marker 라인 포함·run-token 종속)이 1차 create
// 와 이후 모든 update 에서 **byte-identical 하게 안정**하고, 나아가 그 본문이 search-hit
// 의 body 필드에서 **threaded 되지 않고**(issueNumber 처럼) 매 publish 마다 단일 source
// (`commandArgs.updateArgs.body` = descriptor.body)로부터 **재-정규화(re-emit)** 돼
// 사람이 GitHub 에서 이슈 본문을 손수 바꿔도(hit.body 오염, 단 marker 라인은 유지)
// 다음 밤 update 가 그 오염을 이어받지 않고 self-heal 함을 박제하는 cross-publish body
// stability single-source convergence non-gated build-time smoke (T-0940 박제,
// PLAN.md 109행 🟢 실 평가 e2e step ④, REQ-009 멱등 — 사람이 이슈 안에서 읽는 본문
// 무결성 축).
//
// 절단면 — cross-publish body stability + hit-오염 재정규화(멱등의 사람-본문 무결성):
//   REQ-009 멱등("동일 run 의 기존 이슈를 찾아 갱신, 중복 생성 안 함")은 **여러 매체**
//   위에 얹혀 있고, 그 중 사람-향 축은 지금까지 네 개가 봉합됐다:
//     - marker 검색 anchor 축(T-0938) — 다음 밤 그 이슈를 다시 찾는 검색 anchor
//       (`commandArgs.searchQuery`=`descriptor.marker`)의 cross-publish 안정 + round-trip.
//     - issueNumber 편집 대상 축(T-0922) — 1차 create-output 의 M 이 2차 hit 로 threaded.
//     - url permalink 축(T-0937) — 사람이 브라우저로 여는 `outcome.url` 이 byte-identical.
//     - title 사람-제목 축(T-0939) — 사람이 이슈 목록에서 먼저 스캔하는 `--title` 안정.
//     - body 사람-본문 축(본 spec 봉합) — 사람은 제목을 스캔하고 링크를 연 뒤 **실제로
//       이슈 안에서 읽는 것은 본문**(dual-leg run report 콘텐츠)이다. rolling-issue 멱등이
//       성립하려면 1차 밤에 create 로 박은 본문이 2·3차 밤의 update 후에도 **같은 본문**
//       (같은 run 의 canonical report content)이어야 갱신마다 조용히 흔들리거나 다른 밤의
//       내용으로 오염되지 않는다. `descriptor.body`(=marker 라인 + 결정론적 마크다운 렌더)는
//       **run 식별(runToken)에서 파생된 marker 라인을 포함** 하고 timestamp/난수 를 혼입하지
//       않아, 같은 run+같은 leg outcome 이면 밤마다 결정론적으로 같은 본문이다.
//   그리고 body 에는 title(T-0939)과 **동형** 인 load-bearing 성질이 있다: **body 는
//   search-hit 에서 threaded 되지 않는다.** issueNumber(T-0922)는 1차 create-output 의 M 이
//   2차 search-hit 로 다시 관통해 update argv[2] 로 threaded 되지만, **body 는 매 publish
//   마다 commandArgs.updateArgs.body(=descriptor.body, 단일 source)로부터 재-발행(re-emit)**
//   된다. 즉 사람이 GitHub 에서 rolling-issue 본문을 손으로 바꿔도(search-hit 의 body 필드가
//   오염돼도, 단 marker 라인만 남기면 재발견은 성립 — T-0938) 다음 밤 update 는 그 오염된
//   hit.body 를 이어받지 않고 **descriptor.body 로 다시 정규화** 한다 — 본문이 단일 source 로
//   self-heal 된다. 이 "body 는 threaded 아니라 re-emit" 성질이 cross-publish 본문 무결성의
//   핵심 근거다.
//
// title(T-0939)과의 medium 차별(= 사람-본문 vs 사람-제목):
//   title 은 한 줄 제목(prefix + runToken)이라 leg outcome/overallStatus 를 담지 않아 leg
//   조합이 달라도 **동일** 하다. body 는 multi-line 본문 — marker 라인(검색 anchor·run 파생)
//   + 마크다운(gitSha/dateToken/overallStatus/per-leg status/summaryLine)을 담는 **콘텐츠
//   매체** 라, 같은 run+같은 leg outcome 이면 cross-publish byte-identical 이되 leg outcome
//   조합이 다르면 본문이 그 report 콘텐츠를 반영해 달라진다(본문이 report 를 실어 나른다).
//   본 spec 의 cross-publish 안정 축은 "같은 run 을 여러 밤 재조립해도 결정론적으로 같은
//   본문"이며, 그 위에 "body 는 hit 에서 threaded 아니라 매 publish 재정규화(self-heal)"를
//   얹는다. marker 라인은 body 의 검색 anchor 부분집합(body ⊋ marker)이라 body.includes(
//   searchQuery) 는 참이되 body !== searchQuery.
//
// 형제 smoke 와의 차별(= cross-publish 전체 body 재정규화):
//   * T-0931(intra-chain body cross-branch) — **한 chain 내부** 에서 create argv `--body`
//     (빈 search)와 update argv `--body`(marker-hit)이 단일 descriptor.body 로부터
//     byte-identical 함만 자산화 — **여러 publish 에 걸친**(여러 밤 재조립) 안정성·hit.body
//     오염 시 재정규화는 대상이 아니다(intra-chain ≠ cross-publish). argv `--body` 추출 기법만
//     mirror.
//   * marker(T-0938) — body 중 **marker 라인** round-trip(searchQuery cross-publish 안정 +
//     body-marker 재발견)만 자산화 — marker 라인은 body 의 검색 anchor 부분집합, 본 spec 은
//     **전체 body 콘텐츠** 안정성 + 재정규화. marker 라인이 body 에 포함됨·marker 제거 시
//     create 하강은 body 재정규화의 전제 경계로만 최소 인용.
//   * title(T-0939) — 사람-제목(`--title`)의 cross-publish 안정 + 재정규화만 — title 은 한 줄
//     제목, body 는 multi-line 본문(marker 라인 포함). re-emit 성질은 title 과 동형이나 field·
//     argv flag·역할이 다름(제목 스캔 ≠ 본문 열람). threading·hit-오염 재정규화 패턴만 mirror.
//   * republish(T-0922) — issueNumber M 이 hit 로 threaded 됨만 — body 가 threaded **아님**
//     (re-emit)은 그 거울상 성질인데 body 축에서 아무도 단언하지 않았다(핵심 2 (b)에서 최소 대비).
//   본 spec 은 그 cross-publish body stability + hit-오염 재정규화 seam 만 닫는다.
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
//    🔥 REQ-009 멱등 근거 — 사람이 이슈 안에서 같은 본문으로 rolling-issue 콘텐츠를 열람한다. /
//       REQ-037 / REQ-059 — descriptor·commandArgs 는 raw 활동 본문·credential 미저장.
//
// Out of Scope (T-0940):
//   - 형제 T-0931(intra-chain body cross-branch)·marker(T-0938 body 중 marker 라인)·
//     title(T-0939)·permalink(T-0937)·republish(T-0922, issueNumber threaded M) 축 재단언 —
//     argv `--body` 추출 기법만 T-0931 에서, threading·hit-오염 재정규화 기법만 T-0939 에서
//     mirror. republish 의 threaded M 은 핵심 2 (b)에서 body 가 threaded **아님** 을 대비하는
//     최소 인용(argv[2]===String(M) 자체 state-transition 재검증 금지).
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
// 받아 입력 mutate 누설 0. token/secret/raw narrative 어휘 미포함. body 안의 marker 라인은
// 이 run 식별에서 파생되므로 run 이 사람-본문의 단일 source 다.
const RUN_A: RealDataResultIssueRunRef = {
  gitSha: "abc1234",
  dateToken: "2026-07-11",
};

// 서로 다른 run — gitSha·dateToken 이 RUN_A 와 서로 substring 이 아닌 구별 가능 값. body 안의
// marker 라인·run 식별 슬롯이 run-token 종속 단일 source 라 run 이 다르면 세 --body 가 함께 새
// 본문으로 이동함을 보이는 단언용(사람-본문 single-source).
const RUN_B: RealDataResultIssueRunRef = {
  gitSha: "def5678",
  dateToken: "2026-07-12",
};

// 2·3차 search-hit 에 주입할 synthetic 이슈 번호 M — github 이 1차 create 로 낳은 번호를
// 흉내낸다. body 어느 조각과도 substring 관계가 없는 양수로 골라 hit 이 우연 매칭이 아님을
// 보장한다(재발견은 body 의 marker 로 성립하지 number/body 전체 동일성으로가 아님).
const M = 58231;

// 사람이 GitHub 에서 rolling-issue 본문을 손수 덧붙인 상황을 흉내내는 **오염 콘텐츠 접미** —
// marker 라인은 유지하되(재발견 성립) 나머지 본문을 다른 값으로 오염시킨다. body 가 hit 에서
// threaded 되지 않고 매 publish 재정규화됨(self-heal)을 실측하기 위해 2차 search-hit 의 body
// 필드에 `descriptor.marker + POLLUTED_BODY_SUFFIX` 를 주입한다.
const POLLUTED_BODY_SUFFIX = "\n사람이 손수 덧붙인 본문 XYZ 오염 콘텐츠";

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
// body 를 담은 단일 hit 배열 literal. round-trip 을 실측하기 위해 2·3차 hit body 는 literal 이
// 아니라 **1차 create publish 의 createArgs.body(또는 그 marker 유지 오염본)** 를 담는다.
function singleHitStdout(number: number, title: string, body: string): string {
  return JSON.stringify([{ number, title, body }]);
}

// plan.argv 에서 `--body` 바로 다음 원소(사람이 이슈 안에서 읽는 본문)를 추출한다 —
// create argv `["issue","create","--title",T,"--body",B,...]` / update argv `["issue",
// "edit",N,"--title",T,"--body",B]` 두 분기 공통. `--body` 가 없거나 값이 없으면 명시적
// throw(vacuous 추출 차단).
function bodyArgOf(argv: string[]): string {
  const i = argv.indexOf("--body");
  if (i === -1 || i + 1 >= argv.length) {
    throw new Error("argv 에 --body 원소(또는 그 값)가 없습니다");
  }
  return argv[i + 1];
}

// 같은 run 을 매 밤 새로 report→descriptor→commandArgs 로 컴포즈 — 밤마다 독립 재조립
// 모델(같은 run+같은 leg outcome 이면 세 밤의 descriptor.body 가 byte-identical 이어야 함).
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

// cross-publish 3-cycle body-stability threading 조립 — 같은 run·같은 leg outcome 으로 세
// publish cycle 을 잇는다. 세 publish 는 **동일 commandArgs**(따라서 동일 사람-본문
// descriptor.body)에서 argv 를 산출한다.
//   (1) 1차 create: 빈 검색("[]") → create 분기 → bodyArg1 = create argv 의 --body 값.
//   (2) 2차 update: **1차 create body 를 그대로(또는 marker 유지 오염본을) 담은** search-hit →
//       resolve(`hit.body.includes(searchQuery)` 참) → update 분기 → bodyArg2.
//   (3) 3차 update(멱등 확인): 1차 정상 body 담은 hit → bodyArg3.
// literal body 하드코딩 0 — 2·3차 hit body 는 항상 1차 create body(createArgs.body) 파생.
// opts 로 (a) polluteHitBody2 로 2차 hit.body 를 marker 유지 오염본으로 덮어 body 재정규화
// (threaded 아님) 재현, (b) searchStdout2 를 손상 stdout 으로 덮어 상류 컴포저 throw 재현 가능.
function crossPublishBodyThread(
  evalLeg: RealDataDailyStepLegRunOutcome,
  collectLeg: RealDataDailyStepLegRunOutcome,
  run: RealDataResultIssueRunRef,
  m: number,
  opts?: {
    polluteHitBody2?: boolean;
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

  // 2차 hit.body — 기본은 1차 create body 그대로. polluteHitBody2 시 marker 라인은 유지한 채
  // 나머지 콘텐츠를 오염(사람이 손수 본문을 바꾼 상황). marker 유지라 재발견은 여전히 성립.
  const pollutedBody2 = `${descriptor.marker}${POLLUTED_BODY_SUFFIX}`;
  const hitBody2 = opts?.polluteHitBody2 ? pollutedBody2 : createBody;

  // (2) 2차 update — 1차 create body(또는 marker 유지 오염본)를 담은 search-hit → update.
  const searchStdout2 =
    opts?.searchStdout2 ?? singleHitStdout(m, descriptor.title, hitBody2);
  const plan2 = resolveRealDataDailyStepDualLegRunReportIssueGhCommandPlan(
    searchStdout2,
    commandArgs,
  );

  // (3) 3차 update — 동일 반복(멱등 fixed-point, 1차 정상 body 담은 hit).
  const plan3 = resolveRealDataDailyStepDualLegRunReportIssueGhCommandPlan(
    singleHitStdout(m, descriptor.title, createBody),
    commandArgs,
  );

  // 세 publish 의 사람-본문(--body argv 값) 추출.
  const bodyArg1 = bodyArgOf(plan1.argv);
  const bodyArg2 = bodyArgOf(plan2.argv);
  const bodyArg3 = bodyArgOf(plan3.argv);

  return {
    report,
    descriptor,
    commandArgs,
    createBody,
    pollutedBody2,
    plan1,
    plan2,
    plan3,
    bodyArg1,
    bodyArg2,
    bodyArg3,
    M: m,
  };
}

describe("Smoke(non-gated): dual-leg run report cross-publish body stability single-source(세 --body byte-identical=descriptor.body=createArgs.body=updateArgs.body AND body 는 threaded 아니라 hit.body 오염(marker 유지) 시 descriptor.body 로 re-emit) live-gh 0 검증", () => {
  describe("happy path — 3-cycle threading chain 산출 정상", () => {
    it("plan1.action.action === 'create'(빈 search), plan2/plan3.action.action === 'update'(1차 body 담은 hit)이고 bodyArg1/2/3 이 각각 비어있지 않은 문자열 — 세 publish 산출 정상", () => {
      const { plan1, plan2, plan3, bodyArg1, bodyArg2, bodyArg3 } =
        crossPublishBodyThread(
          evalOutcome(),
          collectOutcome(),
          { ...RUN_A },
          M,
        );
      expect(plan1.action.action).toBe("create");
      expect(plan2.action.action).toBe("update");
      expect(plan3.action.action).toBe("update");
      for (const b of [bodyArg1, bodyArg2, bodyArg3]) {
        expect(typeof b).toBe("string");
        expect(b.length).toBeGreaterThan(0);
      }
    });
  });

  describe("핵심 1 — cross-publish body stability(세 --body byte-identical)", () => {
    it("(a) 세 publish 의 --body 값(bodyArg1/2/3)이 모두 서로 === commandArgs.createArgs.body(strict, byte-identical) AND createArgs.body === updateArgs.body === descriptor.body(create/update 두 분기 본문이 단일 source)", () => {
      const { descriptor, commandArgs, bodyArg1, bodyArg2, bodyArg3 } =
        crossPublishBodyThread(
          evalOutcome(),
          collectOutcome(),
          { ...RUN_A },
          M,
        );
      // 세 publish --body 상호 byte-identical + createArgs.body 단일 source.
      expect(bodyArg1).toBe(commandArgs.createArgs.body);
      expect(bodyArg2).toBe(commandArgs.createArgs.body);
      expect(bodyArg3).toBe(commandArgs.createArgs.body);
      expect(bodyArg2).toBe(bodyArg1);
      expect(bodyArg3).toBe(bodyArg1);
      // create/update 두 분기 본문이 단일 source descriptor.body.
      expect(commandArgs.createArgs.body).toBe(commandArgs.updateArgs.body);
      expect(commandArgs.createArgs.body).toBe(descriptor.body);
    });

    it("(b) 각 밤을 별도 report→descriptor→commandArgs 재조립(같은 run+같은 leg outcome 을 매 밤 새로 컴포즈)해도 세 밤의 descriptor.body / --body 값이 여전히 서로 byte-identical(같은 run → 결정론적으로 같은 본문, timestamp/난수 등 비-run 요소 미혼입)", () => {
      const night1 = composeCommandArgs(evalOutcome(), collectOutcome(), {
        ...RUN_A,
      });
      const night2 = composeCommandArgs(evalOutcome(), collectOutcome(), {
        ...RUN_A,
      });
      const night3 = composeCommandArgs(evalOutcome(), collectOutcome(), {
        ...RUN_A,
      });
      expect(night2.descriptor.body).toBe(night1.descriptor.body);
      expect(night3.descriptor.body).toBe(night1.descriptor.body);
      // 세 밤의 descriptor.body 는 각자의 createArgs.body 와도 동일(단일 source).
      expect(night1.commandArgs.createArgs.body).toBe(night1.descriptor.body);
    });
  });

  describe("핵심 2 — body single-source re-emit(body 는 threaded 아니라 재-정규화, hit.body 오염(marker 유지) 무관)", () => {
    it("(a) 2차 search-hit 의 body 를 marker 라인 유지 오염본으로 바꾸면 resolve 는 body-marker 매칭으로 여전히 'update' 로 좁혀지고(discriminant 는 body-marker 존재, body 전체 동일성 아님) 그럼에도 update argv 의 --body 값이 오염 hit.body 가 아니라 commandArgs.updateArgs.body(=descriptor.body, 단일 source)와 ===(body 가 hit 에서 threaded 되지 않고 매 publish 재정규화·오염 콘텐츠 self-heal)", () => {
      const { commandArgs, descriptor, plan2, bodyArg2, pollutedBody2 } =
        crossPublishBodyThread(
          evalOutcome(),
          collectOutcome(),
          { ...RUN_A },
          M,
          { polluteHitBody2: true },
        );
      // discriminant 는 body-marker 라 marker 유지 오염 body 에도 여전히 update.
      expect(plan2.action.action).toBe("update");
      // --body 는 오염 hit.body 미전파 — descriptor.body(단일 source)로 재정규화.
      expect(bodyArg2).not.toBe(pollutedBody2);
      expect(bodyArg2).toBe(commandArgs.updateArgs.body);
      expect(bodyArg2).toBe(descriptor.body);
    });

    it("(b) 거울상 대비 — 같은 오염 hit 에서 update argv[2](issueNumber)는 String(M)(hit.number 종속=threaded)인데 --body 는 hit.body 무관(descriptor.body)임을 한 test 안에서 나란히 확인 — issueNumber 는 threaded, body 는 re-emit(title T-0939 와 동형)", () => {
      const { descriptor, plan2, bodyArg2, pollutedBody2 } =
        crossPublishBodyThread(
          evalOutcome(),
          collectOutcome(),
          { ...RUN_A },
          M,
          { polluteHitBody2: true },
        );
      expect(plan2.action.action).toBe("update");
      // issueNumber 는 hit.number 종속(threaded) — update argv[2] === String(M).
      expect(plan2.argv[2]).toBe(String(M));
      // body 는 hit.body 무관(threaded 아님) — descriptor.body 로 re-emit.
      expect(bodyArg2).toBe(descriptor.body);
      expect(bodyArg2).not.toBe(pollutedBody2);
    });
  });

  describe("핵심 3 — body run-token single-source(body 가 run 종속, literal 아님·marker 라인을 진부분집합으로 포함)", () => {
    it("(a) run 을 RUN_B(gitSha/dateToken 모두 다름)로 바꾼 재조립에서 세 publish 의 --body 가 함께 새 본문으로 이동(RUN_A 와 다름) AND 여전히 세 publish 상호 byte-identical — 사람-본문이 고정 literal 이 아니라 run 식별(runToken) 단일 source 종속", () => {
      const threadA = crossPublishBodyThread(
        evalOutcome(),
        collectOutcome(),
        { ...RUN_A },
        M,
      );
      const threadB = crossPublishBodyThread(
        evalOutcome(),
        collectOutcome(),
        { ...RUN_B },
        M,
      );
      // 세 publish --body 가 함께 새 본문으로 이동(원래 run 과 다름).
      expect(threadB.bodyArg1).not.toBe(threadA.bodyArg1);
      expect(threadB.descriptor.body).not.toBe(threadA.descriptor.body);
      // 여전히 RUN_B 세 publish 상호 byte-identical.
      expect(threadB.bodyArg2).toBe(threadB.bodyArg1);
      expect(threadB.bodyArg3).toBe(threadB.bodyArg1);
    });

    it("(b) body 가 marker 라인을 **포함** 해 descriptor.body.includes(searchQuery)(body ⊇ marker, round-trip 근거)이고 body 는 marker 라인만이 아닌 추가 콘텐츠(제목/leg 요약 등)를 담아 descriptor.body !== searchQuery(body ⊋ marker) — run 변경 시 body 와 searchQuery 가 동반 이동(같은 runToken 공유)", () => {
      const { descriptor, commandArgs } = crossPublishBodyThread(
        evalOutcome(),
        collectOutcome(),
        { ...RUN_A },
        M,
      );
      // body 가 검색 anchor(marker=searchQuery)를 진부분집합으로 포함.
      expect(descriptor.body.includes(commandArgs.searchQuery)).toBe(true);
      expect(descriptor.body).not.toBe(commandArgs.searchQuery);
      // body 는 run 두 토큰을 포함(run 식별 파생 단일 source).
      expect(descriptor.body).toContain(RUN_A.gitSha);
      expect(descriptor.body).toContain(RUN_A.dateToken);
      // run 변경 시 body 와 searchQuery 가 동반 이동(둘 다 runToken 종속).
      const threadB = crossPublishBodyThread(
        evalOutcome(),
        collectOutcome(),
        { ...RUN_B },
        M,
      );
      expect(threadB.descriptor.body).not.toBe(descriptor.body);
      expect(threadB.commandArgs.searchQuery).not.toBe(commandArgs.searchQuery);
      expect(
        threadB.descriptor.body.includes(threadB.commandArgs.searchQuery),
      ).toBe(true);
    });
  });

  describe("branch — create/update 두 분기 대칭 + body 불변", () => {
    it("(a) 1차 plan1: 'create'(빈 search), 2·3차 plan2/plan3: 'update'(1차 body 담은 hit)이더라도 세 publish 가 발행하는 --body 값은 분기 선택과 독립하게 동일(createArgs.body === updateArgs.body)", () => {
      const { commandArgs, plan1, plan2, plan3, bodyArg1, bodyArg2, bodyArg3 } =
        crossPublishBodyThread(
          evalOutcome(),
          collectOutcome(),
          { ...RUN_A },
          M,
        );
      // 검색 분기는 서로 다름(create vs update).
      expect(plan1.action.action).toBe("create");
      expect(plan2.action.action).toBe("update");
      expect(plan3.action.action).toBe("update");
      // 그럼에도 세 publish --body 는 분기 무관하게 동일.
      expect(bodyArg1).toBe(commandArgs.createArgs.body);
      expect(bodyArg2).toBe(commandArgs.updateArgs.body);
      expect(bodyArg3).toBe(commandArgs.updateArgs.body);
      expect(commandArgs.createArgs.body).toBe(commandArgs.updateArgs.body);
    });

    it("(b) resolve 의 create/update 분기 판정 discriminant 가 hit.body.includes(searchQuery)(body-marker)임을 빈 search(create)·marker 담은 hit(update)·marker 제거 hit(create) 세 stdout 으로 각각 확인하되 세 경우 모두 argv 의 --body 값이 descriptor.body 로 동일(본문은 분기·재발견 성패와 독립인 단일 source)", () => {
      const { commandArgs, descriptor, createBody } = crossPublishBodyThread(
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
      expect(bodyArgOf(empty.argv)).toBe(descriptor.body);
      // marker 담은 hit(=1차 create body) → update.
      const matched =
        resolveRealDataDailyStepDualLegRunReportIssueGhCommandPlan(
          singleHitStdout(M, descriptor.title, createBody),
          commandArgs,
        );
      expect(matched.action.action).toBe("update");
      expect(bodyArgOf(matched.argv)).toBe(descriptor.body);
      // marker 제거 hit → create.
      const removed =
        resolveRealDataDailyStepDualLegRunReportIssueGhCommandPlan(
          singleHitStdout(M, descriptor.title, markerFreeBody),
          commandArgs,
        );
      expect(removed.action.action).toBe("create");
      expect(bodyArgOf(removed.argv)).toBe(descriptor.body);
    });
  });

  describe("branch — run/leg outcome status 무관 cross-publish body 안정(content-medium 차별)", () => {
    it("(a) 동일 run 고정, leg outcome 조합(eval pass/collect pass vs eval fail/collect skip)만 다르게 3-cycle 조립 → **각 조합 안에서** 세 publish 의 --body 값 동일 유지(cross-publish 안정은 leg outcome 값과 독립). body 는 콘텐츠 매체라 두 조합의 overallStatus·본문은 서로 다름(title 과 달리 body 는 report 콘텐츠를 실어 나름)", () => {
      const passThread = crossPublishBodyThread(
        { leg: "eval", action: "run", passed: true },
        { leg: "collect", action: "run", passed: true },
        { ...RUN_A },
        M,
      );
      const mixedThread = crossPublishBodyThread(
        { leg: "eval", action: "run", passed: false },
        { leg: "collect", action: "skip" },
        { ...RUN_A },
        M,
      );
      // overallStatus 는 서로 다름(축 분리 구조 확인).
      expect(passThread.report.overallStatus).not.toBe(
        mixedThread.report.overallStatus,
      );
      // cross-publish 안정성은 leg outcome 값과 독립 — 각 조합 안에서 세 publish 동일.
      for (const t of [passThread, mixedThread]) {
        expect(t.bodyArg2).toBe(t.bodyArg1);
        expect(t.bodyArg3).toBe(t.bodyArg1);
        expect(t.bodyArg1).toBe(t.descriptor.body);
      }
      // content-medium 차별(vs title T-0939): body 는 report 콘텐츠(overallStatus/leg status)를
      // 담으므로 leg outcome 조합이 다르면 본문이 다름(title 은 leg 무관 동일).
      expect(mixedThread.descriptor.body).not.toBe(passThread.descriptor.body);
    });

    it("(b) 서로 다른 run 두 개(run_A/run_B, 서로 substring 아님) → 각 run 의 세 publish --body 는 run 내부에서 상호 byte-identical 이되 run_A 의 body !== run_B 의 body(본문이 run 을 구분)", () => {
      const threadA = crossPublishBodyThread(
        evalOutcome(),
        collectOutcome(),
        { ...RUN_A },
        M,
      );
      const threadB = crossPublishBodyThread(
        evalOutcome(),
        collectOutcome(),
        { ...RUN_B },
        M,
      );
      // run 내부 세 publish 상호 byte-identical.
      for (const t of [threadA, threadB]) {
        expect(t.bodyArg2).toBe(t.bodyArg1);
        expect(t.bodyArg3).toBe(t.bodyArg1);
      }
      // run 간에는 서로 다름(본문이 run 을 구분).
      expect(threadA.descriptor.body).not.toBe(threadB.descriptor.body);
    });
  });

  describe("error path / negative cases — 예외 분기마다 각 1+ (단일 negative 금지)", () => {
    it("(a) run.gitSha 빈/공백 → descriptor(stage 1, report 합성) guard throw 로 chain 시작 차단", () => {
      expect(() =>
        crossPublishBodyThread(
          evalOutcome(),
          collectOutcome(),
          { gitSha: "   ", dateToken: RUN_A.dateToken },
          M,
        ),
      ).toThrow();
    });

    it("(b) run.dateToken 빈/공백 → descriptor(stage 1) guard throw 대칭(gitSha 유효해도 필드별 독립 분기)", () => {
      expect(() =>
        crossPublishBodyThread(
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
        crossPublishBodyThread(
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
        crossPublishBodyThread(
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

    it("(e) 2차 search-hit 의 body 를 오염(marker 라인 유지 + 다른 콘텐츠 추가)시켜도 → resolve 는 여전히 'update' 로 좁혀지고 update argv 의 --body 은 descriptor.body 로 재정규화(오염 hit.body 미전파, self-heal) — 오염된 본문이 조용히 다음 publish 로 새지 않음", () => {
      const { descriptor, plan2, bodyArg2, pollutedBody2 } =
        crossPublishBodyThread(
          evalOutcome(),
          collectOutcome(),
          { ...RUN_A },
          M,
          { polluteHitBody2: true },
        );
      expect(plan2.action.action).toBe("update");
      expect(bodyArg2).toBe(descriptor.body);
      expect(bodyArg2).not.toBe(pollutedBody2);
    });

    it("(f) 2차 search-hit 의 body 에서 marker 라인을 제거(사람이 marker 를 통째로 지운 극단) → hit.body.includes(searchQuery) false → resolve 가 'create' 로 하강(재발견 실패 = guard-against-vacuity, 재정규화 loop 이 vacuous 아님) — argv --body 는 여전히 descriptor.body(create 분기)", () => {
      const { commandArgs, descriptor } = composeCommandArgs(
        evalOutcome(),
        collectOutcome(),
        { ...RUN_A },
      );
      const markerFreeBody = "marker 를 통째로 지운 본문 — 재발견 anchor 없음";
      const plan = resolveRealDataDailyStepDualLegRunReportIssueGhCommandPlan(
        singleHitStdout(M, descriptor.title, markerFreeBody),
        commandArgs,
      );
      expect(plan.action.action).toBe("create");
      expect(bodyArgOf(plan.argv)).toBe(descriptor.body);
    });
  });

  describe("결정론 · 무공유 · no-mutation", () => {
    it("동일 (run, leg outcomes, M) 입력으로 3-cycle chain 두 번 → descriptor/commandArgs/plan1/plan2/plan3 이 두 번 deep-equal(plan.argv 배열·--body 값 포함)", () => {
      const a = crossPublishBodyThread(
        evalOutcome(),
        collectOutcome(),
        { ...RUN_A },
        M,
      );
      const b = crossPublishBodyThread(
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
      expect(a.bodyArg2).toBe(b.bodyArg2);
    });

    it("no-mutation — 입력 run/leg outcome literal 이 chain 호출 후 mutate 0(원본 deep-equal 유지, snapshot 대조)", () => {
      const run: RealDataResultIssueRunRef = { ...RUN_A };
      const evalLeg = evalOutcome();
      const collectLeg = collectOutcome();
      const runBefore = JSON.parse(JSON.stringify(run));
      const evalBefore = JSON.parse(JSON.stringify(evalLeg));
      const collectBefore = JSON.parse(JSON.stringify(collectLeg));

      crossPublishBodyThread(evalLeg, collectLeg, run, M);

      expect(run).toEqual(runBefore);
      expect(evalLeg).toEqual(evalBefore);
      expect(collectLeg).toEqual(collectBefore);
    });

    it("무공유 — plan1·plan2·plan3 객체가 서로/다음 호출 결과와 referential identity 분리(not.toBe) — --body 문자열 값은 같아도 plan 객체·argv 배열은 무공유", () => {
      const a = crossPublishBodyThread(
        evalOutcome(),
        collectOutcome(),
        { ...RUN_A },
        M,
      );
      const b = crossPublishBodyThread(
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
    it("chain 안 어디에서도(descriptor.{title,marker,body} / commandArgs.{createArgs.body,updateArgs.body,searchQuery} / 세 publish --body 값 / plan.argv(1·2·3차 전체)) token/secret/raw narrative 어휘 미등장", () => {
      const {
        descriptor,
        commandArgs,
        plan1,
        plan2,
        plan3,
        bodyArg1,
        bodyArg2,
        bodyArg3,
      } = crossPublishBodyThread(
        evalOutcome(),
        collectOutcome(),
        { ...RUN_A },
        M,
      );

      const joined = [
        descriptor.title,
        descriptor.marker,
        descriptor.body,
        commandArgs.createArgs.body,
        commandArgs.updateArgs.body,
        commandArgs.searchQuery,
        bodyArg1,
        bodyArg2,
        bodyArg3,
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

    it("세 --body 값이 순수 사람-본문 문자열(marker 라인 + run 요약 콘텐츠)만 담고 credential·raw github API 토큰 미포함 — run 두 토큰은 포함(순수 사람-본문 source)", () => {
      const { bodyArg1, bodyArg2, bodyArg3 } = crossPublishBodyThread(
        evalOutcome(),
        collectOutcome(),
        { ...RUN_A },
        M,
      );
      for (const b of [bodyArg1, bodyArg2, bodyArg3]) {
        expect(b).not.toContain("ghp_");
        expect(b).not.toContain("--token");
        expect(b).not.toContain("narrative");
        // run 식별 파생 — run 두 토큰을 포함(순수 사람-본문 source).
        expect(b).toContain(RUN_A.gitSha);
        expect(b).toContain(RUN_A.dateToken);
      }
    });

    it("leg outcome.specPath 에 sentinel 을 넣어도 세 publish --body 표면에 sentinel 이 raw 원문 그대로 미누출(body 는 marker 라인 + 결정론적 report 렌더 — leg outcome 의 raw specPath 미실림)", () => {
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
      const { bodyArg1, bodyArg2, bodyArg3 } = crossPublishBodyThread(
        evalLeg,
        collectLeg,
        { ...RUN_A },
        M,
      );
      for (const b of [bodyArg1, bodyArg2, bodyArg3]) {
        expect(b).not.toContain(sentinel);
      }
    });

    it("descriptor/command-args guard throw 메시지가 raw 활동 본문·credential 을 노출하지 않음(필드명·유효성만) — body 에 sentinel 을 심어도 guard 메시지 미노출", () => {
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
