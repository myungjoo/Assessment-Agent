// realdata-e2e-resolve-outcome-report-from-output-issuenumber-3way-cross-boundary-convergence-assembly.smoke-spec.ts
// — 실 평가 e2e step④ pre/post-execution cross-boundary resolve↔outcome-report-from-output
// 단일-진입 issueNumber 3자 수렴 non-gated build-time smoke (T-0767 박제, PLAN.md 109행
// 🟢 실 평가 e2e step④).
//
// 본 spec 의 존재 이유 — public CI gap 해소(단일-진입 두 boundary 컴포저 합류):
//   - PLAN 109행 step④(결과 이슈 박제)의 멱등 search-or-update 는 실행 사이클의 양쪽
//     boundary 에서 **live caller 가 실제로 wiring 하는 두 진입점**으로 닫힌다:
//       (1) pre-execution decision 단일-진입 컴포저 `resolveRealDataResultIssueGhCommandPlan`
//           (T-0588) — search stdout + commandArgs → `{action, argv}` 종단 plan.
//       (2) post-execution interpretation 단일-진입 컴포저
//           `buildRealDataResultIssueOutcomeReportFromOutput`(T-0596) — gh edit 실행 후
//           stdout(URL) + run → 사람-친화 실행 리포트. 내부에서 parse → outcome-report 2 단을
//           스스로 위임 합성한다(caller 는 단일 진입점만 호출).
//     이 두 단일-진입 boundary 컴포저가 동일 멱등 source 의 N(issueNumber)으로 cross-boundary
//     수렴해야 caller live wiring 의 양쪽 경계 어디에서도 issue 식별자 drift 가 0 임이
//     박제된다(REQ-009 멱등성 + REQ-037 결과 리포트 재실행 정합 종단 closure).
//   - 3 stage:
//       stage 1 — search-hit (`RealDataResultIssueSearchHit[]` hits 중 최소 number = 멱등
//         source, 가장 오래된 후보 이슈, T-0584 L150).
//       stage 2 — pre-execution decision(`resolveRealDataResultIssueGhCommandPlan(
//         searchStdout, commandArgs).action.update.issueNumber` = N picked, argv 안에도 N).
//       stage 3 — post-execution single-entry interpretation
//         (`buildRealDataResultIssueOutcomeReportFromOutput(execStdout, run).issueNumber`
//         = gh edit stdout(URL `/issues/N`) 을 단일-진입 컴포저가 parse→outcome-report 2 단
//         위임으로 합성한 결과 안 N).
//   - 기존 sweep 은 두 진입점 중 어느 한쪽씩만 호출했다:
//       T-0764/T-0765 — resolve(pre)·parse(post atomic)·outcome-report(post atomic) 를
//         각각 호출. `buildRealDataResultIssueOutcomeReportFromOutput` 단일-진입 미참조
//         (post 측을 parse+outcome-report atomic 두 단으로만 본다).
//       T-0747 — `buildRealDataResultIssueOutcomeReportFromOutput` 호출하나 resolve(pre)
//         leg 미참조(post 단독 5필드 재유도만).
//       T-0729/T-0617/T-0758 — pre-execution 측만, post 단일-진입 미참조.
//   - 본 spec 은 그 gap 을 메운다 — **두 단일-진입 boundary 컴포저(resolve + from-output)를
//     같은 smoke 안에서 single-source(searchStdout + commandArgs + execStdout + run)로
//     동시-호출** 해 search-hit.minNumber → resolve.action.update.issueNumber →
//     from-output.issueNumber 3자 cross-boundary byte-identical 수렴을 박제한다. live caller
//     가 두 진입점만 wiring 한다는 관점에서 sweep 안에서 가장 사람-친화(live wiring 관점)의
//     종단 그물이다 — caller 의 단일-진입 두 컴포저 사이 N 식별자 drift 0 보장.
//   - live leg(실 gh issue search·create·edit / `execFile('gh', argv)` / 실 github 네트워크
//     / 실 LLM / Ollama / DB / 실 jest spawn)는 복제하지 않고, synthetic searchStdout /
//     execStdout literal + run literal 을 두 컴포저에 직접 공급해 live leg 를 우회한다(조립
//     surface 만 검증). 따라서 본 spec 은:
//
//      🔥 실 gh 호출 0 — gh search / create / edit / execFile('gh', argv) 미실행.
//         synthetic searchStdout / execStdout / run literal 을 두 컴포저에 직접 공급.
//      🔥 실 네트워크 호출 0 — github / Ollama / gh 호출 0. fetch 0. process.env 읽기 0.
//      🔥 실 LLM 호출 0 / 실 DB 접근 0 / 실 jest spawn 0 — 3자 cross-boundary 수렴 조립만.
//      🔥 credential 0 / secret 0 / 비용 0 — public CI 에서 항상 green 발화(R-113).
//         산출 argv / url / summaryLine / 합성 fixture 어디에도 token/secret 어휘
//         미주입·미포함 검증.
//      🔥 새 외부 dependency 0 — 기존 resolve* / outcome-report-from-output* 컴포저 import
//         재사용만(가드/helper 신설 0).
//      🔥 gating / describe.skip 배선 0 — 순수 build-time in-memory 검증만.
//
// Out of Scope (T-0767):
//   - post-execution atomic 3-composer(resolve↔parse↔outcome-report) 4자 수렴 자체 재단언
//     (T-0765 cover). 본 task 는 atomic parse+outcome-report 두 단을 단일-진입 from-output
//     컴포저로 호출 — 5필드 재유도 / atomic parse 단의 issueNumber 재검증 / search-hit↔resolve
//     2자 수렴 자체 재단언 금지.
//   - resolve↔parse 2-composer 3자 roundtrip 재단언(T-0764 cover).
//   - from-output 단독 5필드(url/gitSha/dateToken/summaryLine 합성·url trim 정규화) 재유도
//     재단언(T-0747 cover). 본 task 는 issueNumber 축 cross-boundary 수렴만.
//   - marker 축 pre-execution roundtrip 재단언(T-0758/T-0766 cover). 본 task 는 issueNumber 축만.
//   - search hit shape·outcome shape·report shape 키 집합 set-equality 가드 재단언(helper 측
//     self-wire 가 cover).
//   - 실 github 네트워크 fetch / 실 활동 수집 / 실 prisma.upsert / 실 LLM scoring / 실 gh CLI
//     실행(live leg 복제 0).
//   - gated(DB·credential·LAN) smoke leg 추가 — 본 task 는 non-gated build-time pure-composer
//     smoke 단독.
//   - 컴포저 소스 / 위임 consistency 가드 / 기존 helper(gh-command-plan,
//     outcome-report-from-output, action, command-args, descriptor) 수정 — test-only(신규
//     smoke spec 1 파일). 새 컴포저 / 가드 / helper 신설 0 — 기존 import 재사용만.
//   - production src/ 코드 / package.json / test/jest-smoke.json 변경.
import type { RealDataResultIssueCommandArgs } from "../helpers/realdata-e2e-result-issue-command-args";
import type { RealDataResultIssueRunRef } from "../helpers/realdata-e2e-result-issue-descriptor";
import { resolveRealDataResultIssueGhCommandPlan } from "../helpers/realdata-e2e-result-issue-gh-command-plan";
import { buildRealDataResultIssueOutcomeReportFromOutput } from "../helpers/realdata-e2e-result-issue-outcome-report-from-output";

// 결정론 멱등 marker — 두 컴포저가 공유하는 단일 source 토큰. 비공백 안정 토큰이라 marker
// 빈/공백 guard 를 자극하지 않으며, token/secret/raw narrative 어휘를 포함하지 않는다
// (credential 누출 0 단언의 fixture 전제).
const MARKER = "<!-- realdata-e2e-result-issue: 2026-06-28@abc1234 -->";

// 결정론 owner/repo — 합성 issue URL 의 path segment source(public CI 에서 항상 green
// 발화). token/secret/PAT/--auth 어휘 미포함.
const OWNER = "myungjoo";
const REPO = "assessment-agent";

// 결정론 run 식별자 fixture — from-output 가 받는 run(gitSha/dateToken). 비공백 안정
// 토큰이라 from-output 의 builder assertNonBlank guard 를 자극하지 않는다.
function validRun(
  gitSha: string = "abc1234",
  dateToken: string = "2026-06-28",
): RealDataResultIssueRunRef {
  return { gitSha, dateToken };
}

// 유효 commandArgs fixture 헬퍼 — searchQuery / createArgs{title,body,labels} /
// updateArgs{title,body} 전부 non-blank. body 에 marker 라인을 보존해 멱등 검색 토큰이
// 두 경로(create/update)에 모두 남도록 한다(실 빌더 buildRealDataResultIssueCommandArgs
// 산출 형상 동형). 매 it 가 새 객체를 받아 입력 mutate 가 누설되지 않도록 한다.
function validCommandArgs(
  marker: string = MARKER,
): RealDataResultIssueCommandArgs {
  const body = `${marker}\n\ncount: 3 · totalVolume: 12`;
  return {
    searchQuery: marker,
    createArgs: {
      title: "실 평가 e2e 결과 2026-06-28@abc1234",
      body,
      labels: ["realdata-e2e", "result"],
    },
    updateArgs: {
      title: "실 평가 e2e 결과 2026-06-28@abc1234",
      body,
    },
  };
}

// marker 를 body 에 포함한 hit 1+건 stdout 합성 헬퍼 — 동일 run 이슈가 이미 존재하는
// 경우(update 분기 유발). hit 들의 number 슬롯을 임의로 받아 분포 분리 시나리오
// (search-hit 변별성 branch)에서 hits 분포 A·B 를 다르게 줄 수 있게 했다.
function multiHitStdout(marker: string, numbers: number[]): string {
  return JSON.stringify(
    numbers.map((n, i) => ({
      number: n,
      title: `결과 이슈(#${i})`,
      body: `본문 ${i}\n${marker}\n끝`,
    })),
  );
}

// synthetic gh issue edit stdout 합성 헬퍼 — `gh issue edit <N>` 의 stdout 은
// https://github.com/<owner>/<repo>/issues/<N> URL 한 줄 + 부가 메시지/개행을 포함할 수
// 있다. 본 helper 는 그 happy-path 형상을 N 별로 합성한다(from-output 내부 parse 가 첫
// 매칭 URL 결정론으로 추출하는 surface 직접 자극).
function execStdout(n: number, noisePrefix: string = ""): string {
  return `${noisePrefix}https://github.com/${OWNER}/${REPO}/issues/${n}\n`;
}

// search source(pre boundary) → resolve → from-output(post boundary) 두 단일-진입 컴포저를
// single-source 로 묶어 호출하는 chain 헬퍼. update 분기를 강제하며(후보 1+건 stdout),
// resolver 가 picked 한 N 을 execStdout 에 흘려 from-output 이 동일 N 을 산출하게 한다.
// 두 boundary 산출물을 한 번에 반환해 cross-boundary 단언을 짧게 묶는다.
function runChain(
  hitsNumbers: number[],
  run: RealDataResultIssueRunRef = validRun(),
  commandArgs: RealDataResultIssueCommandArgs = validCommandArgs(),
  noisePrefix: string = "",
): {
  expectedMinN: number;
  resolvedN: number;
  resolvePlan: ReturnType<typeof resolveRealDataResultIssueGhCommandPlan>;
  outcomeReport: ReturnType<
    typeof buildRealDataResultIssueOutcomeReportFromOutput
  >;
} {
  const expectedMinN = Math.min(...hitsNumbers);
  const searchStdout = multiHitStdout(commandArgs.searchQuery, hitsNumbers);

  // pre boundary 단일-진입.
  const resolvePlan = resolveRealDataResultIssueGhCommandPlan(
    searchStdout,
    commandArgs,
  );
  if (resolvePlan.action.action !== "update") {
    throw new Error("update action 기대 — 후보 1+건 입력");
  }
  const resolvedN = resolvePlan.action.issueNumber;

  // caller 가 그 N 으로 `gh issue edit N ...` 을 실행한 뒤 받는 stdout + run 을
  // post boundary 단일-진입 컴포저에 직접 공급(내부에서 parse→outcome-report 위임 합성).
  const outcomeReport = buildRealDataResultIssueOutcomeReportFromOutput(
    execStdout(resolvedN, noisePrefix),
    run,
  );

  return { expectedMinN, resolvedN, resolvePlan, outcomeReport };
}

describe("Smoke(non-gated): 실 평가 e2e step④ pre/post-execution cross-boundary resolve↔outcome-report-from-output 단일-진입 issueNumber 3자 수렴(byte-identical N) live-gh 0 검증", () => {
  describe("happy path — 두 단일-진입 컴포저 모두 정상 산출(resolve plan + outcome-report-from-output)", () => {
    it("(a) 유효 searchStdout + commandArgs + execStdout + run → resolvePlan(update {action, issueNumber} + argv) / outcomeReport(5필드) 두 산출물 모두 정상", () => {
      const { resolvePlan, outcomeReport } = runChain([7, 13]);

      // stage 2 — resolve plan(update {action, issueNumber} + argv).
      expect(resolvePlan.action.action).toBe("update");
      if (resolvePlan.action.action !== "update") {
        throw new Error("update action 기대");
      }
      expect(typeof resolvePlan.action.issueNumber).toBe("number");
      expect(Array.isArray(resolvePlan.argv)).toBe(true);
      expect(resolvePlan.argv[0]).toBe("issue");
      expect(resolvePlan.argv[1]).toBe("edit");

      // stage 3 — outcome-report-from-output({issueNumber, url, gitSha, dateToken, summaryLine}).
      expect(typeof outcomeReport.issueNumber).toBe("number");
      expect(outcomeReport.issueNumber).toBeGreaterThan(0);
      expect(typeof outcomeReport.url).toBe("string");
      expect(outcomeReport.url.length).toBeGreaterThan(0);
      expect(outcomeReport.gitSha).toBe("abc1234");
      expect(outcomeReport.dateToken).toBe("2026-06-28");
      expect(typeof outcomeReport.summaryLine).toBe("string");
      expect(outcomeReport.summaryLine.length).toBeGreaterThan(0);
    });
  });

  describe("cross-boundary issueNumber single-source 3자 수렴(branch — 핵심 불변식)", () => {
    it("(b) search-hit.minNumber → resolve.action.update.issueNumber → from-output.issueNumber 동일 N 3자 byte-identical cross-boundary 수렴(종단 closure)", () => {
      const { expectedMinN, resolvePlan, outcomeReport } = runChain([
        33, 7, 19,
      ]);
      if (resolvePlan.action.action !== "update") {
        throw new Error("update action 기대");
      }

      // stage 1→2 — search-hit.minNumber → resolve(pre boundary).
      expect(resolvePlan.action.issueNumber).toBe(expectedMinN);
      // stage 2→3 — resolve(pre) → from-output(post), cross-boundary 합류(본 task 의 새 단언).
      expect(outcomeReport.issueNumber).toBe(resolvePlan.action.issueNumber);
      // stage 3 ↔ stage 1 — 종단 closure(3자 단일 source 박제, 본 task 의 핵심 새 단언).
      expect(outcomeReport.issueNumber).toBe(expectedMinN);
    });
  });

  describe("argv → execStdout URL → outcome-report URL 종단 N 일치(branch — argv/url-mediated 수렴)", () => {
    it("(c) 동일 N 이 resolvePlan.argv / outcomeReport.url / outcomeReport.summaryLine 매체에 박제(4 매체 N 일치)", () => {
      const { resolvedN, resolvePlan, outcomeReport } = runChain([7, 13]);
      const n = resolvedN;

      // argv 안 N(`['issue','edit', String(N), ...]`) — pre boundary 매체.
      expect(resolvePlan.argv).toContain(String(n));
      // from-output 가 execStdout URL 에서 N 추출 — post boundary 매체.
      expect(outcomeReport.url).toContain(`/issues/${n}`);
      // 사람-친화 summaryLine 안 #N — outcome-report 합성 산출.
      expect(outcomeReport.summaryLine).toContain(`#${n}`);
    });
  });

  describe("search-hit 분포 변별성(branch — 멱등 source 박제, 다른 N→다른 3자 수렴 chain)", () => {
    it("(d) hits 분포 A=[11,23] vs B=[37,59] → 각각 11/11/11 · 37/37/37 로 분리 수렴(각 chain 안 3자 일치 + 두 chain 간 N 분리)", () => {
      const chainA = runChain([11, 23]);
      const chainB = runChain([37, 59]);
      if (
        chainA.resolvePlan.action.action !== "update" ||
        chainB.resolvePlan.action.action !== "update"
      ) {
        throw new Error("update action 기대");
      }

      // chain A — 3 stage 모두 11.
      expect(chainA.expectedMinN).toBe(11);
      expect(chainA.resolvePlan.action.issueNumber).toBe(11);
      expect(chainA.outcomeReport.issueNumber).toBe(11);

      // chain B — 3 stage 모두 37.
      expect(chainB.expectedMinN).toBe(37);
      expect(chainB.resolvePlan.action.issueNumber).toBe(37);
      expect(chainB.outcomeReport.issueNumber).toBe(37);

      // 두 chain 의 종단 N 분리(다른 search source → 다른 N).
      expect(chainA.outcomeReport.issueNumber).not.toBe(
        chainB.outcomeReport.issueNumber,
      );
    });
  });

  describe("multi-hit minNumber 정합 분기에서도 3자 수렴 보존(branch)", () => {
    it("(e) hits 3+ 원소 unsorted [91,13,47] → 3 stage 모두 13(최소, 순서 무관 결정론)으로 종단 cross-boundary 수렴", () => {
      const { expectedMinN, resolvePlan, outcomeReport } = runChain([
        91, 13, 47,
      ]);
      if (resolvePlan.action.action !== "update") {
        throw new Error("update action 기대");
      }

      expect(expectedMinN).toBe(13);
      expect(resolvePlan.action.issueNumber).toBe(13);
      expect(outcomeReport.issueNumber).toBe(13);
    });
  });

  describe("run 무관 — issueNumber 3자 수렴 격리(branch — partial-thread 격리)", () => {
    it("(f) 동일 search source + 동일 execStdout(= 동일 N), run 만 다르게 두 chain → issueNumber 축 두 경우 동일 N, run 축(gitSha/dateToken/summaryLine)은 달라야 함", () => {
      const chain1 = runChain([7, 13], validRun("aaa1111", "2026-06-01"));
      const chain2 = runChain([7, 13], validRun("bbb2222", "2026-12-31"));
      if (
        chain1.resolvePlan.action.action !== "update" ||
        chain2.resolvePlan.action.action !== "update"
      ) {
        throw new Error("update action 기대");
      }

      // issueNumber 축 — run 식별자 변경이 누설 0(두 경우 동일 N=7).
      expect(chain1.resolvePlan.action.issueNumber).toBe(
        chain2.resolvePlan.action.issueNumber,
      );
      expect(chain1.outcomeReport.issueNumber).toBe(
        chain2.outcomeReport.issueNumber,
      );
      expect(chain1.outcomeReport.issueNumber).toBe(7);

      // run 축 — 자기 영역에서는 정상 전파(두 경우 달라야 함).
      expect(chain1.outcomeReport.gitSha).not.toBe(chain2.outcomeReport.gitSha);
      expect(chain1.outcomeReport.dateToken).not.toBe(
        chain2.outcomeReport.dateToken,
      );
      expect(chain1.outcomeReport.summaryLine).not.toBe(
        chain2.outcomeReport.summaryLine,
      );
    });
  });

  describe("execStdout 부가 noise 무관 — from-output 단일-진입 분리(branch — partial-thread 격리, 두 번째 축)", () => {
    it("(g) 동일 resolvePlan(= 동일 N), execStdout 의 URL 외 텍스트만 다르게 두 chain → from-output.issueNumber 두 경우 byte-identical N + resolve.action.issueNumber 와 수렴 유지", () => {
      const commandArgs = validCommandArgs();
      const searchStdout = multiHitStdout(commandArgs.searchQuery, [7, 13]);
      const resolvePlan = resolveRealDataResultIssueGhCommandPlan(
        searchStdout,
        commandArgs,
      );
      if (resolvePlan.action.action !== "update") {
        throw new Error("update action 기대");
      }
      const n = resolvePlan.action.issueNumber;
      const run = validRun();

      const stdout1 = execStdout(n);
      const stdout2 = `Editing issue in ${OWNER}/${REPO}\n${execStdout(
        n,
      )}Issue updated successfully.\n`;

      const report1 = buildRealDataResultIssueOutcomeReportFromOutput(
        stdout1,
        run,
      );
      const report2 = buildRealDataResultIssueOutcomeReportFromOutput(
        stdout2,
        run,
      );

      // 부가 본문 변동에도 첫 매칭 URL 결정론 — issueNumber 동일.
      expect(report1.issueNumber).toBe(report2.issueNumber);
      // 두 경우 모두 resolve.action.issueNumber 와 수렴 유지.
      expect(report1.issueNumber).toBe(n);
      expect(report2.issueNumber).toBe(n);
    });
  });

  describe("flow / branch — create 분기 분리(create 분기는 본 task 3자 수렴 적용 대상 아님)", () => {
    it("(h) 빈 search stdout('[]') → resolve.action.action === 'create' AND action 에 issueNumber 필드 부재(N source 없음 — cross-boundary 수렴 표면 없음)", () => {
      const commandArgs = validCommandArgs();
      const resolvePlan = resolveRealDataResultIssueGhCommandPlan(
        "[]",
        commandArgs,
      );

      expect(resolvePlan.action.action).toBe("create");
      // create action 에 issueNumber 필드가 없음(discriminated union — N source 자체
      // 부재). 본 task 의 3자 수렴 불변식은 update 분기에서만 의미.
      expect("issueNumber" in resolvePlan.action).toBe(false);
    });
  });

  describe("error path / negative cases — pre/post boundary 양쪽 N 식별자 거부 대칭 박제", () => {
    it("(i) resolve leg(pre): 빈 searchStdout('') → parse-search 위임 throw 전파(stage 2 미진입, pre boundary 차단)", () => {
      const commandArgs = validCommandArgs();
      expect(() =>
        resolveRealDataResultIssueGhCommandPlan("", commandArgs),
      ).toThrow();
    });

    it("(i') resolve leg(pre): 비JSON searchStdout('not-json') → parse-search 위임 throw 전파", () => {
      const commandArgs = validCommandArgs();
      expect(() =>
        resolveRealDataResultIssueGhCommandPlan("not-json", commandArgs),
      ).toThrow();
    });

    it("(j) resolve leg(pre): hit number 비양수(0) → assertPositiveNumber 위임 throw(stage 1→2 차단, N 비식별)", () => {
      const commandArgs = validCommandArgs();
      const stdout = JSON.stringify([
        { number: 0, title: "t", body: `b\n${commandArgs.searchQuery}\n` },
      ]);
      expect(() =>
        resolveRealDataResultIssueGhCommandPlan(stdout, commandArgs),
      ).toThrow();
    });

    it("(j') resolve leg(pre): hit number 음수(-3) → assertPositiveNumber 위임 throw(stage 1→2 차단)", () => {
      const commandArgs = validCommandArgs();
      const stdout = JSON.stringify([
        { number: -3, title: "t", body: `b\n${commandArgs.searchQuery}\n` },
      ]);
      expect(() =>
        resolveRealDataResultIssueGhCommandPlan(stdout, commandArgs),
      ).toThrow();
    });

    it("(k) from-output leg(post): URL 미발견 execStdout('') → 내부 parse 위임 throw(stage 3 미산출, post boundary 단일-진입이 자체 try/catch 0 으로 전파)", () => {
      expect(() =>
        buildRealDataResultIssueOutcomeReportFromOutput("", validRun()),
      ).toThrow();
    });

    it("(k') from-output leg(post): 무관 텍스트 execStdout('no url here') → 내부 parse 위임 throw(stage 3 미산출)", () => {
      expect(() =>
        buildRealDataResultIssueOutcomeReportFromOutput(
          "no url here",
          validRun(),
        ),
      ).toThrow();
    });

    it("(l) from-output leg(post): /issues/0 → 내부 parse assertPositiveIssueNumber throw(stage 3 비식별)", () => {
      expect(() =>
        buildRealDataResultIssueOutcomeReportFromOutput(
          `https://github.com/${OWNER}/${REPO}/issues/0\n`,
          validRun(),
        ),
      ).toThrow();
    });

    it("(l') from-output leg(post): /issues/007(선행 0) → 내부 parse assertPositiveIssueNumber throw(stage 3 비식별)", () => {
      expect(() =>
        buildRealDataResultIssueOutcomeReportFromOutput(
          `https://github.com/${OWNER}/${REPO}/issues/007\n`,
          validRun(),
        ),
      ).toThrow();
    });

    it("(l'') from-output leg(post): /issues/abc(비숫자) → URL 미발견 throw(패턴 미매칭, stage 3 비식별)", () => {
      expect(() =>
        buildRealDataResultIssueOutcomeReportFromOutput(
          `https://github.com/${OWNER}/${REPO}/issues/abc\n`,
          validRun(),
        ),
      ).toThrow();
    });

    it("(m) from-output leg(post): run.gitSha 빈('') → 내부 builder assertNonBlank throw(stage 3 builder 단계 비식별 — N 은 parse 까지 정상이어도 post boundary 종단 실패)", () => {
      expect(() =>
        buildRealDataResultIssueOutcomeReportFromOutput(execStdout(7), {
          gitSha: "",
          dateToken: "2026-06-29",
        }),
      ).toThrow();
    });

    it("(m') from-output leg(post): run.gitSha 공백-only('   ') → 내부 builder assertNonBlank throw 대칭(stage 3 builder 비식별)", () => {
      expect(() =>
        buildRealDataResultIssueOutcomeReportFromOutput(execStdout(7), {
          gitSha: "   ",
          dateToken: "2026-06-29",
        }),
      ).toThrow();
    });

    it("(n) from-output leg(post): run.dateToken 빈('') → 내부 builder assertNonBlank throw 대칭(stage 3 builder 비식별)", () => {
      expect(() =>
        buildRealDataResultIssueOutcomeReportFromOutput(execStdout(7), {
          gitSha: "abc1234",
          dateToken: "",
        }),
      ).toThrow();
    });

    it("(n') from-output leg(post): run.dateToken 공백-only(' ') → 내부 builder assertNonBlank throw 대칭(stage 3 builder 비식별)", () => {
      expect(() =>
        buildRealDataResultIssueOutcomeReportFromOutput(execStdout(7), {
          gitSha: "abc1234",
          dateToken: " ",
        }),
      ).toThrow();
    });
  });

  describe("credential 누출 0(branch — §9 / R-59 / REQ-059 정합)", () => {
    it("(o) resolvePlan.argv · outcomeReport.url · outcomeReport.summaryLine 어디에도 token/secret/PAT/--auth 어휘 미등장 + raw narrative 미포함", () => {
      const { resolvePlan, outcomeReport } = runChain([7, 13]);

      const surfaces = [
        resolvePlan.argv.join(" "),
        outcomeReport.url,
        outcomeReport.summaryLine,
      ];
      for (const surface of surfaces) {
        expect(surface).not.toContain("--token");
        expect(surface).not.toContain("--auth");
        expect(surface).not.toContain("GITHUB_TOKEN");
        expect(surface).not.toContain("Authorization");
        expect(surface).not.toContain("Bearer");
        expect(surface).not.toContain("x-access-token");
        expect(surface).not.toContain("x-github-token");
        expect(surface).not.toMatch(/ghp_[A-Za-z0-9]/);
        expect(surface).not.toMatch(/PAT/);
      }
      // outcome url 은 issue 경로만 — commit/PR narrative 어휘 미포함.
      expect(outcomeReport.url).not.toMatch(/commit|pull request/i);
    });
  });

  describe("결정론·무공유·no-mutation — chain 두 번 호출 + 입력 불변 + 무공유", () => {
    it("(p) 동일 입력 chain 두 번 → resolvePlan/outcomeReport 두 산출물 모두 deep-equal(결정론)", () => {
      const run = validRun();
      const commandArgs = validCommandArgs();
      const chain1 = runChain([7, 13], run, commandArgs);
      const chain2 = runChain([7, 13], run, commandArgs);

      expect(chain1.resolvePlan).toEqual(chain2.resolvePlan);
      expect(chain1.outcomeReport).toEqual(chain2.outcomeReport);
    });

    it("(q) no-mutation — 입력 commandArgs(중첩 createArgs.labels/updateArgs)·run·hitsNumbers 배열 chain 호출 전후 deep-equal", () => {
      const commandArgs = validCommandArgs();
      const commandArgsBefore = JSON.parse(JSON.stringify(commandArgs));
      const run = validRun();
      const runBefore = { ...run };
      const hitsNumbers = [7, 13];
      const hitsNumbersBefore = [...hitsNumbers];

      runChain(hitsNumbers, run, commandArgs);

      expect(commandArgs).toEqual(commandArgsBefore);
      expect(commandArgs.createArgs.labels).toEqual(
        commandArgsBefore.createArgs.labels,
      );
      expect(commandArgs.updateArgs).toEqual(commandArgsBefore.updateArgs);
      expect(run).toEqual(runBefore);
      expect(hitsNumbers).toEqual(hitsNumbersBefore);
    });

    it("(r) 무공유 — outcomeReport 가 입력 run 과 referential identity 분리(not.toBe), 필드는 전파", () => {
      const run = validRun();
      const outcomeReport = buildRealDataResultIssueOutcomeReportFromOutput(
        execStdout(7),
        run,
      );

      expect(outcomeReport).not.toBe(run);
      // 산출 report 가 입력 run 의 필드를 전파하되 객체 자체는 새로 생성.
      expect(outcomeReport.gitSha).toBe(run.gitSha);
      expect(outcomeReport.dateToken).toBe(run.dateToken);
    });
  });
});
