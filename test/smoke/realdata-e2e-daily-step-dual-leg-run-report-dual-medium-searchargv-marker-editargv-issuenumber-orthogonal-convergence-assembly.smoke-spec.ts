// realdata-e2e-daily-step-dual-leg-run-report-dual-medium-searchargv-marker-
// editargv-issuenumber-orthogonal-convergence-assembly.smoke-spec.ts —
// 실 평가 e2e daily-step dual-leg run report 의 한 publish chain 안에서 **두 개의
// 서로 다른 식별 매체(medium)** 가 단일 source 로부터 각각 관통하면서 서로 직교
// (orthogonal, cross-contamination 0)함을 박제하는 dual-medium single-source
// orthogonal convergence non-gated build-time smoke (T-0921 박제, PLAN.md 109행
// 🟢 실 평가 e2e step ④).
//
// 두 매체:
//   - 검색 매체(search medium) — descriptor.marker(run-token `${dateToken}@${gitSha}`
//     보유)가 commandArgs.searchQuery 로, 다시 searchArgv(=`gh search issues ...
//     <marker> ...`)의 단일 원소로 운반되어 **어느 run 의 이슈를 찾을지**를 결정한다.
//     이 축의 4-boundary single-source closure 자체는 T-0919 가 닫았다(재단언 금지).
//   - 편집 매체(edit medium) — search hit 의 최소 number N 을 resolve 가 해소해
//     (plan.action.update.issueNumber = N) plan.argv[2] = String(N)(=`gh issue edit N
//     ...`)의 argv 원소로 운반해 **어느 이슈를 실제로 갱신할지**를 결정한다. 이 축의
//     execute-side single-source closure 자체는 T-0920 이 닫았다(재단언 금지).
//
// 본 spec 의 존재 이유 — dual-medium orthogonal convergence gap 해소:
//   두 축은 각각 단일 smoke(T-0919 / T-0920)로 닫혔으나, **한 chain 안에서 두 매체가
//   동시에 공존하며 서로 직교함** — marker 는 run 을 식별하고 issueNumber 는 issue 를
//   식별하며, 한 매체의 값이 다른 매체 경로로 새거나 교차오염되지 않음 — 은 아직 한
//   chain 안에 결합돼 박제되지 않았다. 이 직교성이 step ④ 멱등성(REQ-009 — "동일 run 의
//   기존 이슈를 찾아 갱신")의 무결성 핵심이다: marker 로 run 을 찾고(search medium), 그
//   검색이 반환한 issueNumber 로 그 이슈를 편집(edit medium)하되, 두 매체가 뒤섞이면
//   (marker 가 editArgv 의 issueNumber 자리로 새거나, issueNumber 가 searchArgv 로 새어
//   검색 질의를 오염) 엉뚱한 run·엉뚱한 issue 를 건드린다.
//
//   세 직교 불변식이 한 chain 안에서 동시에 성립해야 한다:
//     (1) marker 는 searchArgv 원소이되 editArgv 의 issueNumber 자리(argv[2])에는 부재.
//     (2) issueNumber 는 editArgv[2] 원소이되 searchArgv 어느 원소에도 부재.
//     (3) 두 매체의 source 독립 — run 을 바꾸면 marker(=searchArgv 원소)는 변하나
//         issueNumber(=editArgv[2])는 불변(search-stdout 고정 시); search-stdout 의
//         number 를 바꾸면 issueNumber(=editArgv[2])는 변하나 marker(=searchArgv 원소)는
//         불변(run 고정 시).
//
//   형제 smoke 들이 각기 단일 축만 닫았다:
//     * T-0919(search-side marker-medium 4-boundary closure) 는 searchArgv 원소의 marker
//       운반·검색 매체 관통·marker 3지점 수렴은 닫았으나 plan.argv(=editArgv)를 opaque 로
//       다뤄 issueNumber-as-edit-argv-element 및 두 매체의 직교성은 미단언.
//     * T-0920(execute-side issueNumber-medium closure) 는 plan.argv[2]===String(N)
//       편집 매체·issueNumber 4지점 수렴은 닫았으나 searchArgv 를 chain 조립 입력으로만
//       포함하고 그 marker 원소가 editArgv issueNumber 축과 직교함은 미단언.
//
//   본 spec 은 T-0919·T-0920 을 한 chain 으로 결합한 capstone 으로, `report → descriptor
//   → commandArgs → searchArgv → resolve(action + plan.argv editArgv) → output-parse`
//   종단 조립에서 두 매체(marker=search / issueNumber=edit)가 단일 source 로부터 각각
//   관통하면서 서로 직교함을 public CI 그물로 박제한다. 따라서 본 spec 은:
//
//    🔥 실 LLM 호출 0 — orchestrator / scoring service / gateway 미사용. synthetic leg
//       outcome / run / stdout literal 을 조립 체인에 직접 공급(실 평가·수집·jest spawn 0).
//    🔥 실 네트워크 호출 0 — github / Ollama / gh 호출 0. fetch 0. process.env 읽기 0.
//    🔥 실 gh 실행 0 — search / issue create / issue edit 실 실행 0. execFile('gh', …) 0.
//    🔥 credential 0 / secret 0 / DB 0 / 비용 0 — public CI 에서 항상 green 발화(R-113).
//    🔥 새 외부 dependency 0 — 기존 build*/resolve*/parse* 컴포저 import 재사용만
//       (consistency-guard·helper·type 신설 0 — value-consistency sweep 종결, T-0911).
//    🔥 gating / describe.skip / env-gating 배선 0 — 순수 build-time in-memory 검증만.
//
// Out of Scope (T-0921):
//   - 형제 search-side 4-boundary smoke(T-0919)의 marker-as-search-argv-element
//     (searchArgv 원소 순서·`--match body`·`--limit` 형식·검색 매체 관통·marker 3지점
//     수렴) 자체 재단언 — 본 spec 은 marker 원소가 issueNumber 축과 직교(marker↛editArgv[2]
//     ·run 종속)함만.
//   - 형제 execute-side smoke(T-0920)의 issueNumber-as-edit-argv-element(plan.argv[2]
//     byte-identical·issueNumber 4지점 수렴) 자체 재단언 — 본 spec 은 issueNumber 원소가
//     marker 축과 직교(issueNumber↛searchArgv·search-hit 종속)함만.
//   - 형제 triple-boundary smoke(T-0918)의 descriptor→resolve→output-parse issueNumber
//     수렴 자체 단독 재단언 — 본 spec 은 그 위에 두 argv 매체의 직교 절단면.
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
import { buildRealDataDailyStepDualLegRunReportIssueSearchGhArgv } from "../helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-search-argv";
import type { RealDataResultIssueRunRef } from "../helpers/realdata-e2e-result-issue-descriptor";

// 결정론 run 식별자 fixture — gitSha + dateToken 비공백 안정 토큰. 매 it 가 spread 복제로
// 받아 입력 mutate 누설 0. token/secret/raw narrative 어휘 미포함(credential 누출 0 단언
// fixture 전제).
const RUN_A: RealDataResultIssueRunRef = {
  gitSha: "abc1234",
  dateToken: "2026-07-11",
};

// 서로 다른 run — gitSha·dateToken 이 RUN_A 와 서로 substring 이 아닌 구별 가능 값(source
// 독립 단언용 — run 을 바꾸면 marker 는 변하나 issueNumber 는 search-stdout 종속이라 불변).
const RUN_B: RealDataResultIssueRunRef = {
  gitSha: "def5678",
  dateToken: "2026-07-12",
};

// 직교 단언용 issueNumber 상수 — marker(=`${dateToken}@${gitSha}` prefix 포함)와 substring
// 관계가 없는 양수로 골라 "issueNumber 가 searchArgv 로 새지 않음" 단언의 우연 매칭을
// 방지한다(marker 숫자 조각·`--limit 30`·`--json number,title,body` 어느 것과도 disjoint).
const N_DISJOINT = 88; // "88" 은 RUN_A/RUN_B marker·searchArgv 어느 원소의 substring 도 아님.
const N_ALT = 94; // hit-number 변화 축(동일 run, 다른 N)용 — 역시 marker disjoint.

// synthetic leg outcome fixture — eval / collect 각 leg 의 run outcome literal. 조립
// 체인은 leg outcome 을 report → descriptor 로 흘려보내는 surface 만 검증하므로 도메인
// 타입 정합만 만족하는 minimal literal 로 충분하다(실 jest spawn 0).
function evalOutcome(): RealDataDailyStepLegRunOutcome {
  return { leg: "eval", action: "run", passed: true };
}

function collectOutcome(): RealDataDailyStepLegRunOutcome {
  return { leg: "collect", action: "run", passed: true };
}

// marker 를 body 에 포함한 synthetic search stdout(1+ hit) — update 분기 유도. gh search
// issues --json number,title,body 응답을 흉내낸 literal. number=N 이 search-hit 단일 source.
function searchHitStdout(marker: string, ...numbers: number[]): string {
  return JSON.stringify(
    numbers.map((n) => ({
      number: n,
      title: `기존 dual-leg run report 이슈 #${n}`,
      body: `${marker}\n\n본문 일부`,
    })),
  );
}

// synthetic gh issue create/edit stdout — 지정 이슈 번호의 유효 issue URL 한 줄(trailing
// 개행 포함). 실 gh round-trip 없이 파서에 직접 주입한다. exec-stdout URL 안 N 은 search
// hit 최소 number 와 동일 합성(cross-boundary 수렴 입력 조건).
function issueUrlStdout(n: number): string {
  return `https://github.com/myungjoo/assessment-agent/issues/${n}\n`;
}

// run-token 계산 — literal prefix 하드코딩이 아니라 helper 규약 `${dateToken}@${gitSha}` 를
// 재계산해 marker substring 을 구조적으로 검증한다(prefix const 는 export 0).
function runTokenOf(run: RealDataResultIssueRunRef): string {
  return `${run.dateToken}@${run.gitSha}`;
}

// dual-medium single-source 조립 진입점 — 단일 source(run + 두 leg outcome + searchStdout +
// execStdout) 로부터 종단 chain 을 관통시켜 검색 매체(searchArgv marker 원소)와 편집 매체
// (plan.argv[2] issueNumber 원소)를 한 산출물 안에 함께 노출한다. 각 stage 의 guard throw
// 는 자체 try/catch 없이 그대로 전파된다.
function assembleViaChain(
  evalLeg: RealDataDailyStepLegRunOutcome,
  collectLeg: RealDataDailyStepLegRunOutcome,
  run: RealDataResultIssueRunRef,
  n: number,
  opts?: { searchStdout?: string; execStdout?: string },
) {
  // (1) pre-execution descriptor.
  const report = buildRealDataDailyStepDualLegRunReport(
    evalLeg,
    collectLeg,
    run,
  );
  const descriptor =
    buildRealDataDailyStepDualLegRunReportIssueDescriptor(report);
  // (2) command-args — searchQuery = descriptor.marker 운반.
  const commandArgs =
    buildRealDataDailyStepDualLegRunReportIssueCommandArgs(descriptor);
  // (3) search-gh-argv — searchQuery(=marker)를 실 gh search argv 의 단일 원소로 운반
  //     (검색 매체 원소; argv 형식 재단언은 T-0919 cover).
  const searchArgv =
    buildRealDataDailyStepDualLegRunReportIssueSearchGhArgv(commandArgs);
  // (4) resolve — marker(=searchQuery) 담은 searchStdout 로 update/create 분기 해소.
  //     update 분기 → plan.argv = ["issue","edit",String(N),...] (편집 매체 issueNumber 원소).
  const searchStdout =
    opts?.searchStdout ?? searchHitStdout(commandArgs.searchQuery, n);
  const plan = resolveRealDataDailyStepDualLegRunReportIssueGhCommandPlan(
    searchStdout,
    commandArgs,
  );
  // (5) post-execution output-parse — 실행 stdout URL 의 issueNumber 추출.
  const execStdout = opts?.execStdout ?? issueUrlStdout(n);
  const outcome =
    parseRealDataDailyStepDualLegRunReportIssueCreateEditOutput(execStdout);
  return {
    report,
    descriptor,
    commandArgs,
    searchArgv,
    searchStdout,
    plan,
    execStdout,
    outcome,
  };
}

describe("Smoke(non-gated): dual-leg run report dual-medium(searchArgv marker + editArgv issueNumber) single-source orthogonal convergence live-gh 0 검증", () => {
  describe("happy path — dual-medium chain 산출", () => {
    it("단일 source(run + 두 leg outcome + N) → 산출물이 모두 정상(descriptor {title,marker,body} 비어있지 않음, searchArgv 비어있지 않은 string[], plan.action update 분기 issueNumber 보유, plan.argv 비어있지 않은 string[], outcome {issueNumber,url} 2필드 보유)", () => {
      const { descriptor, searchArgv, plan, outcome } = assembleViaChain(
        evalOutcome(),
        collectOutcome(),
        { ...RUN_A },
        N_DISJOINT,
      );

      // descriptor 세 필드 비어있지 않음.
      expect(descriptor.title.length).toBeGreaterThan(0);
      expect(descriptor.marker.length).toBeGreaterThan(0);
      expect(descriptor.body.length).toBeGreaterThan(0);

      // searchArgv(검색 매체) 는 비어있지 않은 string[].
      expect(Array.isArray(searchArgv)).toBe(true);
      expect(searchArgv.length).toBeGreaterThan(0);
      expect(searchArgv.every((el) => typeof el === "string")).toBe(true);

      // resolve 는 marker hit → update 분기, issueNumber 보유.
      expect(plan.action.action).toBe("update");

      // plan.argv(편집 매체) 는 비어있지 않은 string[](실 gh issue edit exec argv).
      expect(Array.isArray(plan.argv)).toBe(true);
      expect(plan.argv.length).toBeGreaterThan(0);
      expect(plan.argv.every((el) => typeof el === "string")).toBe(true);

      // output-parse 는 {issueNumber, url} 2필드만 정확히 보유(raw 미저장).
      expect(Object.keys(outcome).sort()).toEqual(["issueNumber", "url"]);
    });
  });

  describe("핵심 1 — 두 매체 동시 관통(coexistence)", () => {
    it("같은 chain 산출에서 (a) searchArgv.includes(descriptor.marker)(검색 매체 원소) AND (b) plan.action update narrowing 후 plan.argv[2]===String(N)(편집 매체 원소)를 한 test 안에서 동시에 단언 — 한 publish chain 안에 두 매체가 각각 자기 argv 원소로 공존", () => {
      const N = N_DISJOINT;
      const { descriptor, searchArgv, plan } = assembleViaChain(
        evalOutcome(),
        collectOutcome(),
        { ...RUN_A },
        N,
      );

      // (a) 검색 매체 — marker 가 searchArgv 의 단일 원소.
      expect(searchArgv.includes(descriptor.marker)).toBe(true);

      // (b) 편집 매체 — issueNumber 가 editArgv[2] 원소.
      expect(plan.action.action).toBe("update");
      if (plan.action.action === "update") {
        expect(plan.action.issueNumber).toBe(N);
      }
      expect(plan.argv[2]).toBe(String(N));
    });
  });

  describe("핵심 2 — 직교 1: marker 는 editArgv issueNumber 자리(argv[2])에 부재", () => {
    it("descriptor.marker !== plan.argv[2] AND plan.argv[2] 가 run-token 조각(dateToken/gitSha)을 포함하지 않음 — 검색 매체(run-token)가 편집 argv 원소 값(issueNumber 자리)으로 새지 않음. (marker 가 editArgv 의 --body 값에 정상 등장하는 것은 별개 — 본 단언은 argv[2] 한정.)", () => {
      const N = N_DISJOINT;
      const { descriptor, plan } = assembleViaChain(
        evalOutcome(),
        collectOutcome(),
        { ...RUN_A },
        N,
      );
      expect(plan.action.action).toBe("update");
      // argv[2] 는 issueNumber 자리 — marker 전체와도, run-token 조각과도 다름.
      expect(descriptor.marker).not.toBe(plan.argv[2]);
      expect(plan.argv[2]).not.toContain(RUN_A.dateToken);
      expect(plan.argv[2]).not.toContain(RUN_A.gitSha);
      expect(plan.argv[2]).not.toContain(runTokenOf(RUN_A));
      // 반증 대칭 — marker 는 편집 argv 의 --body 값에는 정상 등장(축 분리 확인용).
      expect(plan.argv.join("\n")).toContain(descriptor.marker);
    });
  });

  describe("핵심 3 — 직교 2: issueNumber 는 searchArgv 어느 원소에도 부재", () => {
    it("searchArgv.every(el => el !== String(N)) AND searchArgv 전체 join 이 String(N) 을 포함하지 않음 — 편집 매체(issueNumber)가 검색 argv 로 새지 않음(검색 시점엔 issueNumber 미해소, searchArgv 는 marker 로만 검색). N 은 marker/`--limit`/`--json` 어느 것과도 substring-disjoint 로 합성", () => {
      const N = N_DISJOINT;
      const { searchArgv, plan } = assembleViaChain(
        evalOutcome(),
        collectOutcome(),
        { ...RUN_A },
        N,
      );
      // 편집 매체가 update 분기로 실제 argv[2] 를 점유하는 상황임을 전제.
      expect(plan.argv[2]).toBe(String(N));
      // 그럼에도 issueNumber 는 searchArgv 어느 원소도 아님.
      expect(searchArgv.every((el) => el !== String(N))).toBe(true);
      // join 표면에도 issueNumber 로서 미등장(N 을 marker disjoint 로 골라 우연 매칭 회피).
      expect(searchArgv.join(" ")).not.toContain(String(N));
    });
  });

  describe("핵심 4 — 직교 3: source 독립(run 변화 → marker 변·issueNumber 불변)", () => {
    it("(a) 서로 다른 run(RUN_A/RUN_B) 각각 동일 N chain → 두 searchArgv 안 marker 원소는 서로 다름(run-token 종속)", () => {
      const N = N_DISJOINT;
      const chainA = assembleViaChain(
        evalOutcome(),
        collectOutcome(),
        { ...RUN_A },
        N,
      );
      const chainB = assembleViaChain(
        evalOutcome(),
        collectOutcome(),
        { ...RUN_B },
        N,
      );
      expect(chainA.descriptor.marker).not.toBe(chainB.descriptor.marker);
      expect(chainA.searchArgv.includes(chainA.descriptor.marker)).toBe(true);
      expect(chainB.searchArgv.includes(chainB.descriptor.marker)).toBe(true);
      // 각 marker 는 자기 run 의 run-token 을 보유(축 분리 구조 검증).
      expect(chainA.descriptor.marker).toContain(runTokenOf(RUN_A));
      expect(chainB.descriptor.marker).toContain(runTokenOf(RUN_B));
      // searchArgv marker 원소 자체가 서로 다름.
      expect(
        chainA.searchArgv.find((el) => el === chainA.descriptor.marker),
      ).not.toBe(
        chainB.searchArgv.find((el) => el === chainB.descriptor.marker),
      );
    });

    it("(b) 그러나 두 chain 의 plan.argv[2] 는 동일 String(N) — issueNumber 는 search-stdout(hit number) 종속, run 무관(run 은 marker 검색 매체로만 변별)", () => {
      const N = N_DISJOINT;
      const chainA = assembleViaChain(
        evalOutcome(),
        collectOutcome(),
        { ...RUN_A },
        N,
      );
      const chainB = assembleViaChain(
        evalOutcome(),
        collectOutcome(),
        { ...RUN_B },
        N,
      );
      expect(chainA.plan.argv[2]).toBe(String(N));
      expect(chainB.plan.argv[2]).toBe(String(N));
      expect(chainA.plan.argv[2]).toBe(chainB.plan.argv[2]);
    });
  });

  describe("핵심 5 — 직교 4: source 독립(search-hit number 변화 → issueNumber 변·marker 불변)", () => {
    it("(a) 동일 run + 서로 다른 searchStdout(number N_A vs N_B, 둘 다 body 에 같은 marker 포함) → 두 chain 의 plan.argv[2] 는 서로 다름(String(N_A) vs String(N_B), search-hit 종속)", () => {
      const chainA = assembleViaChain(
        evalOutcome(),
        collectOutcome(),
        { ...RUN_A },
        N_DISJOINT,
      );
      const chainB = assembleViaChain(
        evalOutcome(),
        collectOutcome(),
        { ...RUN_A },
        N_ALT,
      );
      expect(chainA.plan.argv[2]).toBe(String(N_DISJOINT));
      expect(chainB.plan.argv[2]).toBe(String(N_ALT));
      expect(chainA.plan.argv[2]).not.toBe(chainB.plan.argv[2]);
    });

    it("(b) 그러나 두 chain 의 searchArgv 안 marker 원소는 동일 — run 고정 시 marker 불변(search-stdout 무관). 앞 축과 대칭으로 issueNumber 는 hit number 로만, marker 는 run 으로만 변별", () => {
      const chainA = assembleViaChain(
        evalOutcome(),
        collectOutcome(),
        { ...RUN_A },
        N_DISJOINT,
      );
      const chainB = assembleViaChain(
        evalOutcome(),
        collectOutcome(),
        { ...RUN_A },
        N_ALT,
      );
      expect(chainA.descriptor.marker).toBe(chainB.descriptor.marker);
      expect(chainA.searchArgv).toEqual(chainB.searchArgv);
      expect(chainA.searchArgv.includes(chainA.descriptor.marker)).toBe(true);
    });
  });

  describe("branch — 검색 미스 → create 분기 격리(두 매체 모두 무관)", () => {
    it("(a) 동일 run·leg outcome 이되 searchStdout 을 빈 hit('[]')로 합성 → plan.action create 분기이고 plan.argv[0]==='issue' AND plan.argv[1]==='create' AND issueNumber 원소 부재(plan.argv[2] !== String(N))", () => {
      const N = N_DISJOINT;
      const { plan } = assembleViaChain(
        evalOutcome(),
        collectOutcome(),
        { ...RUN_A },
        N,
        { searchStdout: "[]" },
      );
      expect(plan.action).toEqual({ action: "create" });
      expect(plan.argv[0]).toBe("issue");
      expect(plan.argv[1]).toBe("create");
      // create argv 3번째 원소는 flag(`--title`)이지 issueNumber 문자열이 아님.
      expect(plan.argv[2]).not.toBe(String(N));
      expect(plan.argv.includes(String(N))).toBe(false);
    });

    it("(b) 그러나 searchArgv(검색 매체)는 여전히 marker 원소 보유 — 검색 결과(hit/miss)가 검색 매체 argv 를 바꾸지 않고 편집 매체(editArgv issueNumber)만 우회", () => {
      const N = N_DISJOINT;
      const { descriptor, searchArgv, plan } = assembleViaChain(
        evalOutcome(),
        collectOutcome(),
        { ...RUN_A },
        N,
        { searchStdout: "[]" },
      );
      expect(plan.action.action).toBe("create");
      expect(searchArgv.includes(descriptor.marker)).toBe(true);
      expect(descriptor.marker).toContain(runTokenOf(RUN_A));
    });
  });

  describe("branch — leg outcome 무관 두 매체 격리(partial-thread 격리)", () => {
    it("동일 run·동일 N 고정 + leg outcome 조합만 다르게(pass/pass vs fail/skip) → 두 chain 의 searchArgv marker 원소 동일 AND plan.argv[2] 동일 String(N)(두 매체 모두 leg status 무관)", () => {
      const N = N_DISJOINT;
      const passChain = assembleViaChain(
        { leg: "eval", action: "run", passed: true },
        { leg: "collect", action: "run", passed: true },
        { ...RUN_A },
        N,
      );
      const mixedChain = assembleViaChain(
        { leg: "eval", action: "run", passed: false },
        { leg: "collect", action: "skip" },
        { ...RUN_A },
        N,
      );
      // 검색 매체 — marker 원소 불변.
      expect(passChain.descriptor.marker).toBe(mixedChain.descriptor.marker);
      expect(passChain.searchArgv).toEqual(mixedChain.searchArgv);
      // 편집 매체 — issueNumber 원소 불변.
      expect(passChain.plan.argv[2]).toBe(String(N));
      expect(mixedChain.plan.argv[2]).toBe(String(N));
      expect(passChain.plan.argv[2]).toBe(mixedChain.plan.argv[2]);
    });
  });

  describe("error path / negative cases — 예외 분기마다 각 1+", () => {
    it("(a) run.gitSha 빈/공백 → descriptor(stage 1, report 합성) guard throw 로 chain 시작 차단", () => {
      expect(() =>
        assembleViaChain(
          evalOutcome(),
          collectOutcome(),
          { gitSha: "   ", dateToken: RUN_A.dateToken },
          1,
        ),
      ).toThrow();
    });

    it("(b) run.dateToken 빈/공백 → descriptor(stage 1) guard throw 대칭(gitSha 유효해도 필드별 독립 분기)", () => {
      expect(() =>
        assembleViaChain(
          evalOutcome(),
          collectOutcome(),
          { gitSha: RUN_A.gitSha, dateToken: "" },
          1,
        ),
      ).toThrow();
    });

    it("(c) update 분기 issueNumber 비양수(number:0 search hit)를 담은 searchStdout → resolve 위임 guard throw(비양수 N 이 editArgv 원소로 새는 것 차단)", () => {
      const marker = assembleViaChain(
        evalOutcome(),
        collectOutcome(),
        { ...RUN_A },
        1,
      ).descriptor.marker;
      expect(() =>
        assembleViaChain(evalOutcome(), collectOutcome(), { ...RUN_A }, 1, {
          searchStdout: searchHitStdout(marker, 0),
        }),
      ).toThrow();
    });

    it("(d) searchStdout 비JSON/비배열('not json') → resolve(stage 4) 파서 위임 throw(marker/argv 정상이어도 hits 추출 실패로 resolve+argv 차단)", () => {
      expect(() =>
        assembleViaChain(evalOutcome(), collectOutcome(), { ...RUN_A }, 1, {
          searchStdout: "not json",
        }),
      ).toThrow();
    });

    it("(e-i) execStdout 에 issue URL 미발견(무관 텍스트) 또는 비-github/`/pull/` → output-parse(post) throw(URL-미발견 분기)", () => {
      expect(() =>
        assembleViaChain(evalOutcome(), collectOutcome(), { ...RUN_A }, 1, {
          execStdout: "no url at all\n",
        }),
      ).toThrow();
      expect(() =>
        assembleViaChain(evalOutcome(), collectOutcome(), { ...RUN_A }, 1, {
          execStdout: "https://gitlab.com/myungjoo/assessment-agent/issues/9\n",
        }),
      ).toThrow();
      expect(() =>
        assembleViaChain(evalOutcome(), collectOutcome(), { ...RUN_A }, 1, {
          execStdout: "https://github.com/myungjoo/assessment-agent/pull/9\n",
        }),
      ).toThrow();
    });

    it("(e-ii) execStdout URL 안 issueNumber 비양수(/issues/0·선행0·비정수) → output-parse(post) throw(비양수 분기 — e-i 과 분리)", () => {
      expect(() =>
        assembleViaChain(evalOutcome(), collectOutcome(), { ...RUN_A }, 1, {
          execStdout: issueUrlStdout(0),
        }),
      ).toThrow();
      expect(() =>
        assembleViaChain(evalOutcome(), collectOutcome(), { ...RUN_A }, 1, {
          execStdout:
            "https://github.com/myungjoo/assessment-agent/issues/007\n",
        }),
      ).toThrow();
      expect(() =>
        assembleViaChain(evalOutcome(), collectOutcome(), { ...RUN_A }, 1, {
          execStdout:
            "https://github.com/myungjoo/assessment-agent/issues/abc\n",
        }),
      ).toThrow();
    });
  });

  describe("결정론 · 무공유 · no-mutation", () => {
    it("동일 (run, leg outcomes, searchStdout, execStdout) 입력 chain 두 번 → descriptor/commandArgs/searchArgv/plan/outcome 가 두 번 deep-equal(searchArgv·plan.argv 배열 포함)", () => {
      const N = N_DISJOINT;
      const first = assembleViaChain(
        evalOutcome(),
        collectOutcome(),
        { ...RUN_A },
        N,
      );
      const second = assembleViaChain(
        evalOutcome(),
        collectOutcome(),
        { ...RUN_A },
        N,
      );
      expect(first.descriptor).toEqual(second.descriptor);
      expect(first.commandArgs).toEqual(second.commandArgs);
      expect(first.searchArgv).toEqual(second.searchArgv);
      expect(first.plan).toEqual(second.plan);
      expect(first.plan.argv).toEqual(second.plan.argv);
      expect(first.outcome).toEqual(second.outcome);
    });

    it("no-mutation — 입력 run/leg outcome literal 이 chain 호출 후 mutate 0(원본 deep-equal 유지, snapshot 대조)", () => {
      const run: RealDataResultIssueRunRef = { ...RUN_A };
      const evalLeg = evalOutcome();
      const collectLeg = collectOutcome();
      const runBefore = JSON.parse(JSON.stringify(run));
      const evalBefore = JSON.parse(JSON.stringify(evalLeg));
      const collectBefore = JSON.parse(JSON.stringify(collectLeg));

      assembleViaChain(evalLeg, collectLeg, run, N_DISJOINT);

      expect(run).toEqual(runBefore);
      expect(evalLeg).toEqual(evalBefore);
      expect(collectLeg).toEqual(collectBefore);
    });

    it("무공유 — searchArgv·plan.argv 배열이 입력/다음 호출 결과와 referential identity 분리(not.toBe)", () => {
      const N = N_DISJOINT;
      const first = assembleViaChain(
        evalOutcome(),
        collectOutcome(),
        { ...RUN_A },
        N,
      );
      const second = assembleViaChain(
        evalOutcome(),
        collectOutcome(),
        { ...RUN_A },
        N,
      );
      expect(first.searchArgv).not.toBe(second.searchArgv);
      expect(first.plan).not.toBe(second.plan);
      expect(first.plan.argv).not.toBe(second.plan.argv);
      expect(first.outcome).not.toBe(second.outcome);
      expect(first.descriptor).not.toBe(second.descriptor);
    });
  });

  describe("raw / credential 누출 0(R-59 / REQ-059)", () => {
    it("chain 표면(descriptor.{title,marker,body} / searchQuery / searchArgv 전체 / plan.argv 전체 / outcome.url)에 token/secret/raw narrative 어휘 미등장", () => {
      const { descriptor, commandArgs, searchArgv, plan, outcome } =
        assembleViaChain(
          evalOutcome(),
          collectOutcome(),
          { ...RUN_A },
          N_DISJOINT,
        );
      const joined = [
        descriptor.title,
        descriptor.marker,
        descriptor.body,
        commandArgs.searchQuery,
        ...searchArgv,
        ...plan.argv,
        outcome.url,
      ].join(" ");

      expect(joined).not.toContain("--token");
      expect(joined).not.toContain("GITHUB_TOKEN");
      expect(joined).not.toContain("GH_TOKEN");
      expect(joined).not.toContain("ghp_");
      expect(joined).not.toContain("narrative");
      expect(joined).not.toMatch(/ghp_[A-Za-z0-9]/);
    });

    it("leg outcome.specPath 에 sentinel 을 넣어도 searchArgv/plan.argv 표면에 sentinel 미누출(run-token·issueNumber 표면은 run 식별자·hit number 파생만)", () => {
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
      const { searchArgv, plan, outcome } = assembleViaChain(
        evalLeg,
        collectLeg,
        { ...RUN_A },
        N_DISJOINT,
      );
      expect(searchArgv.join(" ")).not.toContain(sentinel);
      expect(plan.argv.join(" ")).not.toContain(sentinel);
      expect(String(outcome.issueNumber)).not.toContain(sentinel);
      expect(outcome.url).not.toContain(sentinel);
    });
  });
});
