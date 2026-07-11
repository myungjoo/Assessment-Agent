// realdata-e2e-daily-step-dual-leg-run-report-create-branch-output-parse-
// issuenumber-genesis-execute-side-single-source-closure-assembly.smoke-spec.ts —
// 실 평가 e2e daily-step dual-leg run report 의 create 분기(빈 search) execute-side
// 축을 issueNumber genesis 축으로 묶은 single-source closure non-gated build-time
// smoke (T-0935 박제, PLAN.md 109행 🟢 실 평가 e2e step ④). T-0920 edit-side 의 거울상.
//
// 본 spec 의 존재 이유 — create 분기 execute-side output-parse issueNumber genesis
// single-source closure gap 해소:
//   - step ④(daily-test dual-leg run 결과 rolling-issue 멱등 박제)의 rolling-issue 는
//     marker 로 검색해 기존 이슈를 못 찾으면(빈 search) `gh issue create` 로 새 이슈를
//     만들고, 그 명령의 stdout(갓 생성된 이슈 URL)을 파싱해 **새로 태어난 이슈 번호 M**
//     을 확인한다. 실 live runner 는 resolve 가 산출한 create `plan.argv` 를
//     `execFile('gh', plan.argv)` 로 그대로 실행하고, 그 stdout 을 output-parse 로 읽어
//     비로소 M 을 처음으로 얻는다.
//   - 이 create-branch execute-side 는 update-branch(T-0920)와 **issueNumber 의 출처가
//     정반대**다:
//       * update 분기(T-0920 이 봉합) — 기존 이슈 번호 N 은 **실행 이전**에 이미 있다:
//         search-hit → resolve action.update.issueNumber=N → plan.argv[2]=String(N) →
//         output-parse. N 은 pre-exec 3+지점 + post-exec 1지점을 관통한다.
//       * create 분기(본 spec 이 봉합) — 갓 생성될 이슈 번호 M 은 **실행 이전 어디에도
//         없다**: 빈 search("[]") → resolve action {action:"create"}(issueNumber 필드 자체
//         부재) → plan.argv = ["issue","create","--title",...,"--body",...,...labels]
//         (M 원소 전무) → **실행 후에야** create execStdout 의 URL
//         https://github.com/owner/repo/issues/M 에서 output-parse 가 M 을 처음으로 산출
//         한다. M 은 pre-exec 0지점 + post-exec 1지점 — output-parse 에서 **태어난다
//         (genesis)**.
//   - 형제 smoke 들이 각기 다른 절단면만 닫았다:
//       * T-0920(edit-argv issueNumber execute-side closure) 은 update 분기에서 N 이
//         pre-exec 3+지점을 관통함만 자산화 — 본 spec 은 그 **정확한 거울상**(create 분기,
//         번호가 pre-exec 어디에도 없다가 output-parse 에서 태어남).
//       * T-0933(update-branch issueNumber single-source + create-absence orthogonal) 은
//         create 분기 plan.argv/action 에 issueNumber 원소·필드가 **전무**함(pre-exec
//         부재)만 자산화 — 본 spec 은 그 다음 실행-후 output-parse 가 create stdout URL
//         에서 M 을 **새로 산출(genesis)** 함을 닫는다(pre-exec 부재는 genesis 전제로만
//         최소 확인).
//       * T-0918(descriptor→resolve→output-parse triple-boundary) 은 update 분기
//         resolve↔output-parse 수렴만 — create 분기의 output-parse 는 대조 대상 아님.
//       * T-0934(action-verb dispatch) 은 create/update 분기 선택 판단만 — 실행 후
//         output-parse 는 dispatch 이후 별개 축.
//   - 본 spec 은 그 create-branch output-parse genesis seam 을 닫는다. chain: 두 leg
//     outcome + run → report → descriptor → commandArgs 를 통과시켜 유효 commandArgs 를
//     얻고, 빈 search("[]")에 종단 컴포저를 적용해 create plan(plan.action.action==="create",
//     issueNumber 필드 부재, plan.argv 에 M 원소 전무)을 산출한 뒤, create execStdout
//     (`gh issue create` 가 낸 갓 생성 이슈 URL `.../issues/M` 한 줄)을 output-parse 로
//     파싱해 outcome.issueNumber === M 이 오직 그 execStdout URL 에서만 유도되고 실행 이전
//     create chain 어디에도 M 이 없음을 박제한다. 따라서 본 spec 은:
//
//      🔥 실 LLM 호출 0 — orchestrator / scoring service / gateway 미사용. synthetic
//         leg outcome / run / stdout literal 을 조립 체인에 직접 공급(실 평가·수집·jest
//         spawn 0).
//      🔥 실 네트워크 호출 0 — github / Ollama / gh 호출 0. fetch 0. process.env 읽기 0.
//      🔥 실 gh 실행 0 — search / issue create / issue edit 실 실행 0. execFile('gh', …) 0.
//      🔥 credential 0 / secret 0 / DB 0 / 비용 0 — public CI 에서 항상 green 발화(R-113).
//      🔥 새 외부 dependency 0 — 기존 build*/resolve*/parse* 컴포저 import 재사용만
//         (consistency-guard·helper 신설 금지).
//      🔥 gating / describe.skip / env-gating 배선 0 — 순수 build-time in-memory 검증만.
//      🔥 REQ-009 멱등 근거 — 첫 밤(create)은 이슈를 새로 만들며 그 번호가 output-parse
//         에서 태어나고(genesis), 다음 밤(update)은 그 이슈를 marker 로 검색해 찾은
//         번호로 갱신한다. output-parse 가 손상 stdout 에서 조용히 잘못된 M 을 산출하면
//         rolling-issue 멱등이 첫 밤부터 어긋난다 — 본 그물이 그 누출을 막는다.
//      🔥 REQ-037 / REQ-059 — outcome 은 {issueNumber, url} 만 담고 raw 활동 본문·
//         credential 을 담지 않는다(raw 미저장 정합).
//
// Out of Scope (T-0935):
//   - 형제 T-0920 의 update 분기 issueNumber pre-exec 관통(search-hit→resolve→
//     plan.argv[2]→output-parse 4지점 수렴) 축 재단언 — 본 spec 은 그 거울상으로 create
//     분기의 post-exec genesis(pre-exec 0지점, output-parse 에서 M 태어남). 비대칭 대조
//     test 에서 update 경로는 대조용 최소 인용만.
//   - 형제 T-0933 의 create 분기 issueNumber pre-exec 부재(create argv/action 에
//     issueNumber 원소·필드 전무) 축 자체 재단언 — 본 spec 에서 pre-exec 부재는 genesis
//     전제 조건으로만 최소 확인.
//   - 형제 T-0918(triple-boundary)·T-0934(action-verb dispatch)·T-0919(search-argv
//     marker 4-boundary)·T-0913(round-trip) 축 자체 재단언.
//   - descriptor / command-args / action resolver / gh-argv 빌더 / gh-command-plan
//     컴포저 / output-parse 파서 본문 변경 — import·호출만(각 배선 이미 T-0896~T-0907 박제).
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

// 서로 다른 run — gitSha·dateToken 이 RUN_A 와 서로 substring 이 아닌 구별 가능 값(run 분포
// 무관 M 단언용 — M 은 create execStdout 종속이라 run 이 달라도 불변).
const RUN_B: RealDataResultIssueRunRef = {
  gitSha: "def5678",
  dateToken: "2026-08-24",
};

// 안정 issue URL host — 실 gh round-trip 없이 synthetic literal 로 대체한다.
const ISSUE_URL_HOST = "https://github.com/myungjoo/assessment-agent";

// synthetic create execStdout 의 정규화(trim) 기대 URL — output-parse 산출 url 대조용.
function issueUrl(n: number): string {
  return `${ISSUE_URL_HOST}/issues/${n}`;
}

// synthetic `gh issue create` stdout — 갓 생성된 이슈 번호의 유효 issue URL 한 줄(trailing
// 개행 포함). 실 gh 실행 없이 output-parse 에 직접 주입한다. M 은 오직 이 execStdout URL
// 에서만 태어나는(genesis) 단일 source.
function issueUrlStdout(n: number): string {
  return `${issueUrl(n)}\n`;
}

// marker 를 body 에 포함한 synthetic search stdout(1+ hit) — update 분기 유도(비대칭 대조용).
// gh search issues --json number,title,body 응답을 흉내낸 literal. number=N 이 search-hit
// 단일 source.
function markerHitStdout(marker: string, ...numbers: number[]): string {
  return JSON.stringify(
    numbers.map((n) => ({
      number: n,
      title: `기존 dual-leg run report 이슈 #${n}`,
      body: `${marker}\n\n본문 일부`,
    })),
  );
}

// run-token 계산 — literal prefix 하드코딩이 아니라 helper 규약 `${dateToken}@${gitSha}` 를
// 재계산해 marker substring 을 구조적으로 검증한다(prefix const 는 export 0).
function runTokenOf(run: RealDataResultIssueRunRef): string {
  return `${run.dateToken}@${run.gitSha}`;
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

// create-branch execute-side single-source 조립 진입점 — 단일 source(run + 두 leg outcome +
// searchStdout + execStdout) 로부터 종단 chain(report / descriptor / commandArgs /
// resolve(create plan) / output-parse)을 관통시킨다. 기본 searchStdout 은 빈 hit("[]")로
// **create 분기**를 유도하고, 기본 execStdout 은 갓 생성 이슈 URL(`.../issues/M`)로 M genesis
// 를 공급한다. 각 stage 의 guard throw 는 자체 try/catch 없이 그대로 전파된다.
function assembleViaChain(
  evalLeg: RealDataDailyStepLegRunOutcome,
  collectLeg: RealDataDailyStepLegRunOutcome,
  run: RealDataResultIssueRunRef,
  m: number,
  opts?: { searchStdout?: string; execStdout?: string },
) {
  // (1) pre-execution report → descriptor.
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
  // (3) resolve — 기본 빈 search("[]") → create 분기 → plan.action {action:"create"} +
  //     plan.argv = ["issue","create",...](M 원소 전무 — 아직 이슈가 없어 번호를 모른다).
  const searchStdout = opts?.searchStdout ?? "[]";
  const plan = resolveRealDataDailyStepDualLegRunReportIssueGhCommandPlan(
    searchStdout,
    commandArgs,
  );
  // (4) post-execution output-parse — 실행 stdout URL 에서 비로소 M 이 태어난다(genesis).
  const execStdout = opts?.execStdout ?? issueUrlStdout(m);
  const outcome =
    parseRealDataDailyStepDualLegRunReportIssueCreateEditOutput(execStdout);
  return {
    report,
    descriptor,
    commandArgs,
    searchStdout,
    plan,
    execStdout,
    outcome,
  };
}

describe("Smoke(non-gated): dual-leg run report create-branch output-parse issueNumber genesis(M) execute-side single-source closure live-gh 0 검증", () => {
  describe("happy path — create-branch execute-side chain 산출", () => {
    it("단일 source(run + 두 leg outcome + 빈 search + M) → 산출물이 모두 정상(descriptor {title,marker,body} 비어있지 않음, plan.action create 분기, plan.argv 비어있지 않은 string[], outcome {issueNumber,url} 2필드 정확히 보유)", () => {
      const M = 987654;
      const { descriptor, plan, outcome } = assembleViaChain(
        evalOutcome(),
        collectOutcome(),
        { ...RUN_A },
        M,
      );

      // descriptor 세 필드 비어있지 않음.
      expect(descriptor.title.length).toBeGreaterThan(0);
      expect(descriptor.marker.length).toBeGreaterThan(0);
      expect(descriptor.body.length).toBeGreaterThan(0);

      // 빈 search → create 분기.
      expect(plan.action.action).toBe("create");

      // plan.argv 는 비어있지 않은 string[](실 gh issue create exec argv).
      expect(Array.isArray(plan.argv)).toBe(true);
      expect(plan.argv.length).toBeGreaterThan(0);
      expect(plan.argv.every((el) => typeof el === "string")).toBe(true);

      // output-parse 는 {issueNumber, url} 2필드만 정확히 보유(raw 미저장).
      expect(Object.keys(outcome).sort()).toEqual(["issueNumber", "url"]);
      expect(typeof outcome.issueNumber).toBe("number");
      expect(typeof outcome.url).toBe("string");
    });
  });

  describe("핵심 1 — issueNumber genesis single-source(M 은 output-parse 에서 태어남)", () => {
    it("(a) outcome.issueNumber === M AND outcome.url === issueUrl(M)(M 은 오직 create execStdout URL 에서만 유도)", () => {
      const M = 424242;
      const { outcome } = assembleViaChain(
        evalOutcome(),
        collectOutcome(),
        { ...RUN_A },
        M,
      );
      expect(outcome.issueNumber).toBe(M);
      expect(outcome.url).toBe(issueUrl(M));
    });

    it("(b) execStdout 의 M 을 다른 값(M2)으로 바꾼 두 번째 chain(동일 report/commandArgs/plan) → outcome.issueNumber === M2 — outcome.issueNumber 는 execStdout(실행 후) 종속이며 pre-exec create chain 과 무관하게 execStdout 이 M 을 결정", () => {
      const M = 111222;
      const M2 = 333444;
      const first = assembleViaChain(
        evalOutcome(),
        collectOutcome(),
        { ...RUN_A },
        M,
      );
      const second = assembleViaChain(
        evalOutcome(),
        collectOutcome(),
        { ...RUN_A },
        M2,
        { execStdout: issueUrlStdout(M2) },
      );
      // pre-exec create chain(commandArgs / plan)은 동일(execStdout 무관).
      expect(first.commandArgs).toEqual(second.commandArgs);
      expect(first.plan).toEqual(second.plan);
      // 그러나 outcome.issueNumber 는 execStdout 이 결정 — 서로 다른 M.
      expect(first.outcome.issueNumber).toBe(M);
      expect(second.outcome.issueNumber).toBe(M2);
      expect(first.outcome.issueNumber).not.toBe(second.outcome.issueNumber);
    });

    it("(c) outcome.url 에 `/issues/${M}` 포함(toContain)", () => {
      const M = 909090;
      const { outcome } = assembleViaChain(
        evalOutcome(),
        collectOutcome(),
        { ...RUN_A },
        M,
      );
      expect(outcome.url).toContain(`/issues/${M}`);
    });
  });

  describe("핵심 2 — pre-exec create chain 에 M 전무(genesis 전제, edit-side 비대칭)", () => {
    it("(a) plan.action.action==='create' narrowing 후 plan.action 에 issueNumber 필드 부재(toBeUndefined + 'issueNumber' in false)", () => {
      const M = 987654;
      const { plan } = assembleViaChain(
        evalOutcome(),
        collectOutcome(),
        { ...RUN_A },
        M,
      );
      expect(plan.action.action).toBe("create");
      expect(
        (plan.action as { issueNumber?: number }).issueNumber,
      ).toBeUndefined();
      expect("issueNumber" in plan.action).toBe(false);
    });

    it("(b) create plan.argv 의 어떤 원소도 String(M) 과 === 아님 AND plan.argv[0..1]===['issue','create'] AND 'edit' verb 부재", () => {
      const M = 987654;
      const { plan } = assembleViaChain(
        evalOutcome(),
        collectOutcome(),
        { ...RUN_A },
        M,
      );
      // 아직 존재하지 않는 번호가 create argv 로 새지 않음.
      expect(plan.argv.every((el) => el !== String(M))).toBe(true);
      expect(plan.argv[0]).toBe("issue");
      expect(plan.argv[1]).toBe("create");
      expect(plan.argv).not.toContain("edit");
    });

    it("(c) M 은 descriptor/commandArgs/plan.argv 어느 pre-exec 산출에도 없다가 output-parse(post-exec)에서 처음 등장 — [descriptor.title, descriptor.marker, descriptor.body, ...plan.argv] 어느 문자열에도 String(M) 미포함", () => {
      // M 은 title/body(run-token: 2026-07-11@abc1234, labels)와 겹치지 않는 distinctive 값.
      const M = 987654;
      const { descriptor, plan, outcome } = assembleViaChain(
        evalOutcome(),
        collectOutcome(),
        { ...RUN_A },
        M,
      );
      const preExecSurfaces = [
        descriptor.title,
        descriptor.marker,
        descriptor.body,
        ...plan.argv,
      ];
      for (const surface of preExecSurfaces) {
        expect(surface).not.toContain(String(M));
      }
      // post-exec output-parse 에서 비로소 M 등장(genesis).
      expect(outcome.issueNumber).toBe(M);
      expect(outcome.url).toContain(String(M));
    });
  });

  describe("create/update execute-side 비대칭 대조(거울상 T-0920)", () => {
    it("update 는 N 이 pre-exec plan.argv[2] 에 존재(운반), create 는 M 이 pre-exec plan.argv 에 부재(post-exec genesis) — 동일 report/commandArgs 로 두 분기 대조", () => {
      const M = 987654;
      const N = 424242;
      // (i) create 분기 — 빈 search → M genesis(post-exec).
      const createChain = assembleViaChain(
        evalOutcome(),
        collectOutcome(),
        { ...RUN_A },
        M,
        { searchStdout: "[]" },
      );
      // (ii) update 분기 — marker-매칭 hit → N pre-exec 운반.
      const marker = createChain.descriptor.marker;
      const updateChain = assembleViaChain(
        evalOutcome(),
        collectOutcome(),
        { ...RUN_A },
        N,
        {
          searchStdout: markerHitStdout(marker, N),
          execStdout: issueUrlStdout(N),
        },
      );

      // update: N 이 pre-exec plan.argv[2] 에 존재.
      expect(updateChain.plan.action.action).toBe("update");
      expect(updateChain.plan.argv[2]).toBe(String(N));
      expect(updateChain.plan.argv.includes(String(N))).toBe(true);
      expect(updateChain.outcome.issueNumber).toBe(N);

      // create: M 이 pre-exec plan.argv 에 부재(post-exec output-parse genesis).
      expect(createChain.plan.action.action).toBe("create");
      expect(createChain.plan.argv.includes(String(M))).toBe(false);
      expect(createChain.outcome.issueNumber).toBe(M);

      // 비대칭 요약: update issueNumber = pre-exec search-hit 운반, create issueNumber =
      // post-exec output-parse genesis.
      expect(updateChain.plan.argv.includes(String(N))).toBe(true);
      expect(createChain.plan.argv.includes(String(M))).toBe(false);
    });
  });

  describe("branch — run/leg outcome 무관 M 안정(다른 run/leg → 같은 create M)", () => {
    it("(a) 서로 다른 run(RUN_A / RUN_B) 각각 create chain 호출하되 동일 create execStdout(/issues/M) → 두 outcome.issueNumber 동일 M(M 은 stdout 종속, run 무관), 단 두 chain 의 descriptor.marker(=searchQuery)는 서로 다름", () => {
      const M = 987654;
      const chainA = assembleViaChain(
        evalOutcome(),
        collectOutcome(),
        { ...RUN_A },
        M,
      );
      const chainB = assembleViaChain(
        evalOutcome(),
        collectOutcome(),
        { ...RUN_B },
        M,
      );
      // M 은 run 무관하게 동일.
      expect(chainA.outcome.issueNumber).toBe(M);
      expect(chainB.outcome.issueNumber).toBe(M);
      expect(chainA.outcome.issueNumber).toBe(chainB.outcome.issueNumber);

      // 그러나 marker(=searchQuery)는 run-token 으로 서로 다름(run 은 marker 로 변별).
      expect(chainA.descriptor.marker).not.toBe(chainB.descriptor.marker);
      expect(chainA.commandArgs.searchQuery).not.toBe(
        chainB.commandArgs.searchQuery,
      );
      expect(chainA.descriptor.marker).toContain(runTokenOf(RUN_A));
      expect(chainB.descriptor.marker).toContain(runTokenOf(RUN_B));
    });

    it("(b) 동일 run·동일 execStdout(같은 M) 고정, leg outcome 조합만 다르게(pass/pass vs fail/skip) 두 create chain → 두 outcome.issueNumber 동일 M(leg status/overallStatus 무관)", () => {
      const M = 987654;
      const passChain = assembleViaChain(
        { leg: "eval", action: "run", passed: true },
        { leg: "collect", action: "run", passed: true },
        { ...RUN_A },
        M,
      );
      const mixedChain = assembleViaChain(
        { leg: "eval", action: "run", passed: false },
        { leg: "collect", action: "skip" },
        { ...RUN_A },
        M,
      );
      // overallStatus 는 서로 다름(축 분리 구조 확인).
      expect(passChain.report.overallStatus).not.toBe(
        mixedChain.report.overallStatus,
      );
      // 그러나 M 은 동일(leg status 무관 — create execStdout 종속).
      expect(passChain.outcome.issueNumber).toBe(M);
      expect(mixedChain.outcome.issueNumber).toBe(M);
      expect(passChain.outcome.issueNumber).toBe(
        mixedChain.outcome.issueNumber,
      );
    });
  });

  describe("검색 분기 ⊥ output-parse 경로 독립", () => {
    it("빈 search(create 분기)와 무관하게 output-parse 는 execStdout URL 에서만 M 산출 — create 분기 선택이 output-parse 산출 경로를 바꾸지 않음(동일 execStdout → 동일 M, 검색 결과와 독립)", () => {
      const M = 987654;
      const { plan, outcome } = assembleViaChain(
        evalOutcome(),
        collectOutcome(),
        { ...RUN_A },
        M,
        { searchStdout: "[]" },
      );
      expect(plan.action.action).toBe("create");
      expect(outcome.issueNumber).toBe(M);
      expect(outcome.url).toContain(`/issues/${M}`);
    });

    it("marker-미매칭 hit stdout(non-empty 이나 body 에 marker 미포함)에서도 여전히 create 분기 진입 후 create execStdout → 동일 genesis(M)", () => {
      const M = 987654;
      const nonMatchingHit = JSON.stringify([
        { number: 7, title: "x", body: "marker 미포함 본문" },
      ]);
      const { plan, outcome } = assembleViaChain(
        evalOutcome(),
        collectOutcome(),
        { ...RUN_A },
        M,
        { searchStdout: nonMatchingHit },
      );
      expect(plan.action.action).toBe("create");
      expect(outcome.issueNumber).toBe(M);
      expect(outcome.url).toContain(`/issues/${M}`);
    });
  });

  describe("error path / negative cases — 예외 분기마다 각 1+ (단일 negative 금지)", () => {
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

    it("(c) create execStdout 에 issue URL 미발견(빈/무관 텍스트/비-github/`/pull/`) → output-parse throw(URL-미발견 분기, 손상 create stdout 이 조용히 outcome 으로 새는 것 차단)", () => {
      expect(() =>
        assembleViaChain(evalOutcome(), collectOutcome(), { ...RUN_A }, 1, {
          execStdout: "",
        }),
      ).toThrow();
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

    it("(d) create execStdout issueNumber 비양수(/issues/0·/issues/007·/issues/abc) → output-parse assertPositiveIssueNumber throw(비정상 M 이 genesis 로 새는 것 차단)", () => {
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

    it("(e) 컴포저에 넣는 search stdout 이 비-JSON('{')/비배열 JSON('{}') → 종단 컴포저 파서 throw 로 create plan(및 이후 output-parse 단계 진입) 미산출(손상 search stdout 이 create 분기 판정으로 새는 것 상류 차단)", () => {
      expect(() =>
        assembleViaChain(evalOutcome(), collectOutcome(), { ...RUN_A }, 1, {
          searchStdout: "{",
        }),
      ).toThrow();
      expect(() =>
        assembleViaChain(evalOutcome(), collectOutcome(), { ...RUN_A }, 1, {
          searchStdout: "{}",
        }),
      ).toThrow();
    });
  });

  describe("결정론 · 무공유 · no-mutation", () => {
    it("동일 (run, leg outcomes, 빈 search, execStdout) 입력 create chain 두 번 → descriptor/commandArgs/plan/outcome 가 두 번 deep-equal(plan.argv 배열 포함)", () => {
      const M = 987654;
      const first = assembleViaChain(
        evalOutcome(),
        collectOutcome(),
        { ...RUN_A },
        M,
      );
      const second = assembleViaChain(
        evalOutcome(),
        collectOutcome(),
        { ...RUN_A },
        M,
      );
      expect(first.descriptor).toEqual(second.descriptor);
      expect(first.commandArgs).toEqual(second.commandArgs);
      expect(first.plan).toEqual(second.plan);
      expect(first.plan.argv).toEqual(second.plan.argv);
      expect(first.outcome).toEqual(second.outcome);
    });

    it("no-mutation — 입력 run/leg outcome literal·commandArgs 가 chain 호출 후 mutate 0(원본 deep-equal 유지, snapshot 대조)", () => {
      const run: RealDataResultIssueRunRef = { ...RUN_A };
      const evalLeg = evalOutcome();
      const collectLeg = collectOutcome();
      const runBefore = JSON.parse(JSON.stringify(run));
      const evalBefore = JSON.parse(JSON.stringify(evalLeg));
      const collectBefore = JSON.parse(JSON.stringify(collectLeg));

      const { commandArgs } = assembleViaChain(
        evalLeg,
        collectLeg,
        run,
        987654,
      );
      const commandArgsSnapshot = JSON.parse(JSON.stringify(commandArgs));
      // commandArgs 를 이후 재사용해도 원본 보존(스냅샷과 deep-equal).
      resolveRealDataDailyStepDualLegRunReportIssueGhCommandPlan(
        "[]",
        commandArgs,
      );

      expect(run).toEqual(runBefore);
      expect(evalLeg).toEqual(evalBefore);
      expect(collectLeg).toEqual(collectBefore);
      expect(commandArgs).toEqual(commandArgsSnapshot);
    });

    it("무공유 — plan.argv/outcome/descriptor 가 입력/다음 호출 결과와 referential identity 분리(not.toBe)", () => {
      const M = 987654;
      const first = assembleViaChain(
        evalOutcome(),
        collectOutcome(),
        { ...RUN_A },
        M,
      );
      const second = assembleViaChain(
        evalOutcome(),
        collectOutcome(),
        { ...RUN_A },
        M,
      );
      expect(first.plan).not.toBe(second.plan);
      expect(first.plan.argv).not.toBe(second.plan.argv);
      expect(first.outcome).not.toBe(second.outcome);
      expect(first.descriptor).not.toBe(second.descriptor);
    });
  });

  describe("raw / credential 누출 0(R-59 / REQ-059)", () => {
    it("chain 표면(descriptor.{title,marker,body} / searchQuery / create plan.argv 전체 / outcome.url)에 token/secret/raw narrative 어휘 미등장", () => {
      const { descriptor, commandArgs, plan, outcome } = assembleViaChain(
        evalOutcome(),
        collectOutcome(),
        { ...RUN_A },
        987654,
      );
      const joined = [
        descriptor.title,
        descriptor.marker,
        descriptor.body,
        commandArgs.searchQuery,
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

    it("outcome.url 이 순수 issue URL(정규 형태)만 담고 credential·raw github API 토큰·실 활동 본문 미포함", () => {
      const { outcome } = assembleViaChain(
        evalOutcome(),
        collectOutcome(),
        { ...RUN_A },
        987654,
      );
      expect(outcome.url).toMatch(
        /^https:\/\/github\.com\/[^/\s]+\/[^/\s]+\/issues\/\d+$/,
      );
    });

    it("leg outcome.specPath 에 sentinel 을 넣어도 outcome/plan.argv 표면에 sentinel 미누출", () => {
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
      const { plan, outcome } = assembleViaChain(
        evalLeg,
        collectLeg,
        { ...RUN_A },
        987654,
      );
      expect(plan.argv.join(" ")).not.toContain(sentinel);
      expect(String(outcome.issueNumber)).not.toContain(sentinel);
      expect(outcome.url).not.toContain(sentinel);
    });

    it("output-parse guard throw 메시지가 raw 활동 본문·credential 을 노출하지 않음(필드명·유효성만) — 비양수 M negative case 에서 확인", () => {
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
