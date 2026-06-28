// realdata-e2e-resolve-parse-outcome-report-issuenumber-4way-convergence-assembly.smoke-spec.ts
// — 실 평가 e2e step④ post-execution resolve↔parse↔outcome-report 3-composer
// single-source issueNumber 4자 cross-stage 수렴 non-gated build-time smoke
// (T-0765 박제, PLAN.md 109행 🟢 실 평가 e2e step④).
//
// 본 spec 의 존재 이유 — public CI gap 해소(issueNumber 축 post-execution 4자 수렴):
//   - PLAN 109행 step④(결과 이슈 박제) 의 멱등 search-or-update 의 종단 chain 은
//     post-execution 결정 → 박제 결과 → 사람-친화 확인 리포트로 이어지며, 그 chain 의
//     핵심 불변식은 issueNumber 식별자가 모든 stage 를 통과해도 손실/swap 없이 동일
//     N 으로 유지됨이다. chain 은 4 stage 로 나뉜다:
//       (1) search-hit (`RealDataResultIssueSearchHit[]` 의 hits 중 최소 number =
//           멱등 source — 가장 오래된 후보 이슈, T-0584 L150).
//       (2) resolve (`resolveRealDataResultIssueGhCommandPlan(searchStdout,
//           commandArgs).action.issueNumber` = N picked, T-0588).
//       (3) post-execution parse (`parseRealDataResultIssueCreateEditOutput(
//           execStdout).issueNumber` = gh 가 edit 후 stdout 으로 보고한 N, T-0589).
//       (4) outcome-report (`buildRealDataResultIssueOutcomeReport(parseOutcome,
//           runPlan.run).issueNumber` = 사람-친화 확인 리포트 descriptor 안 N, T-0590).
//     이 4 stage 가 동일 N 으로 byte-identical 수렴해야 caller live wiring 의 어느
//     단계에서도 issue 식별자 drift 가 0 임이 박제된다(REQ-009 멱등성 + REQ-037 결과
//     리포트 재실행 정합 양쪽 cross-stage 보호).
//   - 기존 sweep 은 leg 들을 부분적으로 닫았다:
//       T-0758 — marker 축 pre-execution roundtrip(search-argv ↔ resolve.searchQuery
//         ↔ descriptor.marker 3자). pre-execution, marker 축.
//       T-0764 — issueNumber 축 post-execution roundtrip(search-hit.minNumber ↔
//         resolve.action.issueNumber ↔ parse.output.issueNumber 3자) — resolve↔parse
//         2-composer. outcome-report leg 미포함.
//       T-0701/T-0702/T-0725 — parse → outcome-report 5필드 재유도 sibling
//         (`realdata-e2e-create-edit-output-outcome-report-assembly.smoke-spec.ts`) —
//         parse→outcome-report 단일 leg 의 deep-equal 정합. resolver leg 미참조,
//         cross-stage 4자 수렴 단언 0.
//   - 본 spec 은 그 gap 을 메운다 — T-0764 의 resolve↔parse 3자 수렴 위에
//     **outcome-report leg 1 단을 더 합류시켜 search-hit.minNumber →
//     resolve.action.issueNumber → parse.output.issueNumber → outcome-report.issueNumber
//     의 4자 byte-identical cross-stage 수렴** 을 single-source 로 묶어 박제한다. sweep
//     안에서 처음으로 3 composer(resolve gh-command-plan + post-execution parse +
//     outcome-report)를 동일 source(searchStdout + commandArgs + runPlan.run)로 동시-
//     호출해 4 stage 의 N 식별자가 cross-stage 로 손실 0 임을 박제하는 자리다.
//   - live leg(실 gh issue search·create·edit / `execFile('gh', argv)` / 실 github
//     네트워크 / 실 LLM / Ollama / DB / 실 jest spawn)는 복제하지 않고, synthetic
//     searchStdout / createEditStdout literal + runPlan.run literal 을 세 컴포저에
//     직접 공급해 live leg 를 우회한다(조립 surface 만 검증). 따라서 본 spec 은:
//
//      🔥 실 gh 호출 0 — gh search / create / edit / execFile('gh', argv) 미실행.
//         synthetic searchStdout / createEditStdout / runPlan.run literal 을 세 컴포저에
//         직접 공급.
//      🔥 실 네트워크 호출 0 — github / Ollama / gh 호출 0. fetch 0. process.env 읽기 0.
//      🔥 실 LLM 호출 0 / 실 DB 접근 0 / 실 jest spawn 0 — 4자 cross-stage 수렴 조립만.
//      🔥 credential 0 / secret 0 / 비용 0 — public CI 에서 항상 green 발화(R-113).
//         산출 argv / url / summaryLine / 합성 fixture 어디에도 token/secret 어휘
//         미주입·미포함 검증.
//      🔥 새 외부 dependency 0 — 기존 resolve*/parse*/outcome-report* 컴포저 import
//         재사용만(가드 신설 0).
//      🔥 gating / describe.skip 배선 0 — 순수 build-time in-memory 검증만.
//
// Out of Scope (T-0765):
//   - resolve↔parse 2-composer issueNumber 3자 수렴 자체 재단언(T-0764 이미 cover —
//     본 task 는 outcome-report leg 합류로 4자 확장 부분만 새로 단언, 3자 부분은 외화된
//     N 변수로 짧게 sanity).
//   - parse → outcome-report 5필드(`{issueNumber,url,gitSha,dateToken,summaryLine}`)
//     재유도 deep-equal 재단언(T-0701/T-0702/T-0725 이미 cover — 본 task 는 issueNumber
//     축 4자 수렴 + url 전파 sanity 만, 본격 5필드 재유도 미관여).
//   - marker 축 pre-execution roundtrip(search-marker ↔ resolve.searchQuery ↔
//     descriptor.marker) 재단언(T-0758 이미 cover — 본 task 는 issueNumber 축만).
//   - search hit shape·outcome shape·report shape 키 집합 set-equality 가드 재단언
//     (T-0661/T-0662 등 helper 측 self-wire 가 cover).
//   - publish chain(buildRealDataResultIssuePublishPlan 진입) 재단언(T-0729/T-0755
//     이미 cover — 본 task 는 post-execution outcome-report chain 만).
//   - 실 github 네트워크 fetch / 실 활동 수집 / 실 prisma.upsert / 실 LLM scoring /
//     실 gh CLI 실행(live leg 복제 0).
//   - gated(DB·credential·LAN) smoke leg 추가 — 본 task 는 non-gated build-time
//     pure-composer smoke 단독.
//   - 컴포저 소스 / 위임 consistency 가드 / 4 helper(gh-command-plan, output-parse,
//     outcome-report, action) 수정 — test-only(신규 smoke spec 1 파일). 새 컴포저 /
//     가드 / helper 신설 0 — 기존 import 재사용만.
//   - production src/ 코드 / package.json / test/jest-smoke.json 변경.
import type { RealDataResultIssueCommandArgs } from "../helpers/realdata-e2e-result-issue-command-args";
import type { RealDataResultIssueRunRef } from "../helpers/realdata-e2e-result-issue-descriptor";
import { resolveRealDataResultIssueGhCommandPlan } from "../helpers/realdata-e2e-result-issue-gh-command-plan";
import { buildRealDataResultIssueOutcomeReport } from "../helpers/realdata-e2e-result-issue-outcome-report";
import type { RealDataResultIssueOutcome } from "../helpers/realdata-e2e-result-issue-output-parse";
import { parseRealDataResultIssueCreateEditOutput } from "../helpers/realdata-e2e-result-issue-output-parse";

// 결정론 멱등 marker — 세 컴포저가 공유하는 단일 source 토큰. 비공백 안정 토큰이라
// marker 빈/공백 guard 를 자극하지 않으며, token/secret/raw narrative 어휘를 포함하지
// 않는다(credential 누출 0 단언의 fixture 전제).
const MARKER = "<!-- realdata-e2e-result-issue: 2026-06-28@abc1234 -->";

// 결정론 owner/repo — 합성 issue URL 의 path segment source(public CI 에서 항상 green
// 발화). token/secret/PAT/--auth 어휘 미포함.
const OWNER = "myungjoo";
const REPO = "assessment-agent";

// 결정론 run 식별자 fixture — outcome-report 가 받는 runPlan.run(gitSha/dateToken).
// 비공백 안정 토큰이라 outcome-report 의 assertNonBlank guard 를 자극하지 않는다.
function validRun(
  gitSha: string = "abc1234",
  dateToken: string = "2026-06-28",
): RealDataResultIssueRunRef {
  return { gitSha, dateToken };
}

// 유효 commandArgs fixture 헬퍼 — searchQuery / createArgs{title,body,labels} /
// updateArgs{title,body} 전부 non-blank. body 에 marker 라인을 보존해 멱등 검색 토큰이
// 두 경로(create/update)에 모두 남도록 한다(실 빌더 buildRealDataResultIssueCommandArgs
// 의 산출 형상 동형). 매 it 가 새 객체를 받아 입력 mutate 가 누설되지 않도록 한다.
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

// synthetic create/edit stdout 합성 헬퍼 — `gh issue create` / `gh issue edit <N>` 의
// stdout 은 https://github.com/<owner>/<repo>/issues/<N> URL 한 줄 + 부가 메시지/
// 개행을 포함할 수 있다. 본 helper 는 그 happy-path 형상을 N 별로 합성한다(parse 가
// 첫 매칭 URL 결정론으로 추출하는 surface 직접 자극).
function createEditStdout(n: number, noisePrefix: string = ""): string {
  return `${noisePrefix}https://github.com/${OWNER}/${REPO}/issues/${n}\n`;
}

// search source → resolve → parse → outcome-report 4 stage 를 single-source 로 묶어
// 호출하는 chain 헬퍼. update 분기를 강제하며(후보 1+건 stdout), resolver 가 picked
// 한 N 을 createEditStdout 에 흘려 parse 가 동일 N 을 산출하게 한 뒤 outcome-report
// 까지 합성한다. 4 stage 산출물을 한 번에 반환해 cross-stage 단언을 짧게 묶는다.
function runChain(
  hitsNumbers: number[],
  run: RealDataResultIssueRunRef = validRun(),
  commandArgs: RealDataResultIssueCommandArgs = validCommandArgs(),
  noisePrefix: string = "",
): {
  expectedMinN: number;
  resolvedN: number;
  resolvePlan: ReturnType<typeof resolveRealDataResultIssueGhCommandPlan>;
  parseOutcome: RealDataResultIssueOutcome;
  outcomeReport: ReturnType<typeof buildRealDataResultIssueOutcomeReport>;
} {
  const expectedMinN = Math.min(...hitsNumbers);
  const searchStdout = multiHitStdout(commandArgs.searchQuery, hitsNumbers);

  const resolvePlan = resolveRealDataResultIssueGhCommandPlan(
    searchStdout,
    commandArgs,
  );
  if (resolvePlan.action.action !== "update") {
    throw new Error("update action 기대 — 후보 1+건 입력");
  }
  const resolvedN = resolvePlan.action.issueNumber;

  // caller 가 그 N 으로 `gh issue edit N ...` 을 실행한 뒤 받는 stdout 합성.
  const parseOutcome = parseRealDataResultIssueCreateEditOutput(
    createEditStdout(resolvedN, noisePrefix),
  );

  const outcomeReport = buildRealDataResultIssueOutcomeReport(
    parseOutcome,
    run,
  );

  return { expectedMinN, resolvedN, resolvePlan, parseOutcome, outcomeReport };
}

describe("Smoke(non-gated): 실 평가 e2e step④ post-execution resolve↔parse↔outcome-report 3-composer single-source issueNumber 4자 cross-stage 수렴(byte-identical N) live-gh 0 검증", () => {
  describe("happy path — 세 컴포저 모두 정상 산출(resolve plan + parse outcome + outcome-report)", () => {
    it("(a) 유효 searchStdout + commandArgs + runPlan.run → resolvePlan(update) / parseOutcome({issueNumber,url}) / outcomeReport(5필드) 세 산출물 모두 정상", () => {
      const { resolvePlan, parseOutcome, outcomeReport } = runChain([7, 13]);

      // stage 2 — resolve plan(update {action, issueNumber} + argv).
      expect(resolvePlan.action.action).toBe("update");
      if (resolvePlan.action.action !== "update") {
        throw new Error("update action 기대");
      }
      expect(typeof resolvePlan.action.issueNumber).toBe("number");
      expect(Array.isArray(resolvePlan.argv)).toBe(true);
      expect(resolvePlan.argv[0]).toBe("issue");
      expect(resolvePlan.argv[1]).toBe("edit");

      // stage 3 — parse outcome({issueNumber, url}).
      expect(typeof parseOutcome.issueNumber).toBe("number");
      expect(parseOutcome.issueNumber).toBeGreaterThan(0);
      expect(parseOutcome.url).toMatch(
        /^https:\/\/github\.com\/[^/]+\/[^/]+\/issues\/\d+$/,
      );

      // stage 4 — outcome-report({issueNumber, url, gitSha, dateToken, summaryLine}).
      expect(typeof outcomeReport.issueNumber).toBe("number");
      expect(outcomeReport.issueNumber).toBeGreaterThan(0);
      expect(typeof outcomeReport.url).toBe("string");
      expect(outcomeReport.gitSha).toBe("abc1234");
      expect(outcomeReport.dateToken).toBe("2026-06-28");
      expect(typeof outcomeReport.summaryLine).toBe("string");
      expect(outcomeReport.summaryLine.length).toBeGreaterThan(0);
    });
  });

  describe("cross-stage issueNumber single-source 4자 수렴(branch — 핵심 불변식)", () => {
    it("(b) search-hit.minNumber → resolve.action.issueNumber → parse.output.issueNumber → outcome-report.issueNumber 동일 N 4자 byte-identical 수렴(종단 closure)", () => {
      const { expectedMinN, resolvedN, parseOutcome, outcomeReport } = runChain(
        [33, 7, 19],
      );

      // stage 1→2 — search-hit.minNumber → resolve(T-0764 cover, 짧게 sanity).
      expect(resolvedN).toBe(expectedMinN);
      // stage 2→3 — resolve → parse(T-0764 cover, 짧게 sanity).
      expect(parseOutcome.issueNumber).toBe(resolvedN);
      // stage 3→4 — parse → outcome-report(본 task 의 새 leg).
      expect(outcomeReport.issueNumber).toBe(parseOutcome.issueNumber);
      // stage 4 ↔ stage 1 — 종단 closure(4자 단일 source 박제, 본 task 의 핵심 새 단언).
      expect(outcomeReport.issueNumber).toBe(expectedMinN);
    });
  });

  describe("argv → URL → outcome-report 종단 N 일치(branch — argv/url-mediated 수렴)", () => {
    it("(c) 동일 N 이 resolvePlan.argv / parseOutcome.url / outcomeReport.url 3 매체에 byte-identical 박제(url 전파 sanity, 5필드 재유도는 T-0701/T-0702/T-0725 cover)", () => {
      const { resolvedN, resolvePlan, parseOutcome, outcomeReport } = runChain([
        7, 13,
      ]);
      const n = resolvedN;

      // argv 안 N(`['issue','edit', String(N), ...]`).
      expect(resolvePlan.argv).toContain(String(n));
      // parse 가 URL 에서 N 추출.
      expect(parseOutcome.url).toContain(`/issues/${n}`);
      // outcome-report 가 url 전파(parse.url 그대로 — trim 정규화 sanity).
      expect(outcomeReport.url).toBe(parseOutcome.url);
    });
  });

  describe("search-hit 분포 변별성(branch — 멱등 source 박제, 다른 N→다른 4자 수렴 chain)", () => {
    it("(d) hits 분포 A=[11,23] vs B=[37,59] → 각각 11/11/11/11 · 37/37/37/37 로 분리 수렴(각 chain 안 4자 일치 + 두 chain 간 N 분리)", () => {
      const chainA = runChain([11, 23]);
      const chainB = runChain([37, 59]);

      // chain A — 4 stage 모두 11.
      expect(chainA.expectedMinN).toBe(11);
      expect(chainA.resolvedN).toBe(11);
      expect(chainA.parseOutcome.issueNumber).toBe(11);
      expect(chainA.outcomeReport.issueNumber).toBe(11);

      // chain B — 4 stage 모두 37.
      expect(chainB.expectedMinN).toBe(37);
      expect(chainB.resolvedN).toBe(37);
      expect(chainB.parseOutcome.issueNumber).toBe(37);
      expect(chainB.outcomeReport.issueNumber).toBe(37);

      // 두 chain 의 종단 N 분리(다른 search source → 다른 N).
      expect(chainA.outcomeReport.issueNumber).not.toBe(
        chainB.outcomeReport.issueNumber,
      );
    });
  });

  describe("multi-hit minNumber 정합 분기에서도 4자 수렴 보존(branch)", () => {
    it("(e) hits 3+ 원소 unsorted [91,13,47] → 4 stage 모두 13(최소, 순서 무관 결정론)으로 종단 수렴", () => {
      const { expectedMinN, resolvedN, parseOutcome, outcomeReport } = runChain(
        [91, 13, 47],
      );

      expect(expectedMinN).toBe(13);
      expect(resolvedN).toBe(13);
      expect(parseOutcome.issueNumber).toBe(13);
      expect(outcomeReport.issueNumber).toBe(13);
    });
  });

  describe("runPlan.run 무관 — issueNumber 4자 수렴 격리(branch — partial-thread 격리)", () => {
    it("(f) 동일 search source + 동일 createEditStdout(= 동일 N), runPlan.run 만 다르게 두 chain → issueNumber 축 두 경우 동일 N, run 축(gitSha/dateToken/summaryLine)은 달라야 함", () => {
      const chain1 = runChain([7, 13], validRun("aaa1111", "2026-06-01"));
      const chain2 = runChain([7, 13], validRun("bbb2222", "2026-12-31"));

      // issueNumber 축 — run 식별자 변경이 누설 0(두 경우 동일 N=7).
      expect(chain1.resolvePlan.action).toEqual(chain2.resolvePlan.action);
      expect(chain1.parseOutcome.issueNumber).toBe(
        chain2.parseOutcome.issueNumber,
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

  describe("stdout 무관·resolve 독립(branch — partial-thread 격리, 두 번째 축)", () => {
    it("(g) 동일 resolvePlan(= 동일 N), createEditStdout 의 URL 외 텍스트만 다르게 두 chain → parse/outcome-report.issueNumber 두 경우 byte-identical N + resolve.action.issueNumber 와 수렴 유지", () => {
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

      const stdout1 = createEditStdout(n);
      const stdout2 = `Creating issue in ${OWNER}/${REPO}\n${createEditStdout(
        n,
      )}Issue created successfully.\n`;

      const outcome1 = parseRealDataResultIssueCreateEditOutput(stdout1);
      const outcome2 = parseRealDataResultIssueCreateEditOutput(stdout2);
      const report1 = buildRealDataResultIssueOutcomeReport(outcome1, run);
      const report2 = buildRealDataResultIssueOutcomeReport(outcome2, run);

      // 부가 본문 변동에도 첫 매칭 URL 결정론 — issueNumber 동일.
      expect(outcome1.issueNumber).toBe(outcome2.issueNumber);
      expect(report1.issueNumber).toBe(report2.issueNumber);
      // 두 경우 모두 resolve.action.issueNumber 와 수렴 유지.
      expect(report1.issueNumber).toBe(n);
      expect(report2.issueNumber).toBe(n);
    });
  });

  describe("flow / branch — create 분기 분리(create 분기는 본 task 4자 수렴 적용 대상 아님)", () => {
    it("(h) 빈 search stdout('[]') → resolve.action.action === 'create' AND action 에 issueNumber 필드 부재(N source 없음 — outcome-report 도 stage 4 미진입)", () => {
      const commandArgs = validCommandArgs();
      const resolvePlan = resolveRealDataResultIssueGhCommandPlan(
        "[]",
        commandArgs,
      );

      expect(resolvePlan.action.action).toBe("create");
      // create action 에 issueNumber 필드가 없음(discriminated union — N source 자체
      // 부재). 본 task 의 4자 수렴 불변식은 update 분기에서만 의미.
      expect("issueNumber" in resolvePlan.action).toBe(false);
    });
  });

  describe("error path / negative cases — 4 stage 각 leg N 식별자 거부 대칭 박제", () => {
    it("(i) resolve leg: 빈 searchStdout('') → parse-search 위임 throw 전파(stage 2 미진입)", () => {
      const commandArgs = validCommandArgs();
      expect(() =>
        resolveRealDataResultIssueGhCommandPlan("", commandArgs),
      ).toThrow();
    });

    it("(i') resolve leg: 비JSON searchStdout('not-json') → parse-search 위임 throw 전파", () => {
      const commandArgs = validCommandArgs();
      expect(() =>
        resolveRealDataResultIssueGhCommandPlan("not-json", commandArgs),
      ).toThrow();
    });

    it("(j) resolve leg: hit number 비양수(0) → assertPositiveNumber 위임 throw(stage 1→2 차단)", () => {
      const commandArgs = validCommandArgs();
      const stdout = JSON.stringify([
        { number: 0, title: "t", body: `b\n${commandArgs.searchQuery}\n` },
      ]);
      expect(() =>
        resolveRealDataResultIssueGhCommandPlan(stdout, commandArgs),
      ).toThrow();
    });

    it("(j') resolve leg: hit number 음수(-3) → assertPositiveNumber 위임 throw(stage 1→2 차단)", () => {
      const commandArgs = validCommandArgs();
      const stdout = JSON.stringify([
        { number: -3, title: "t", body: `b\n${commandArgs.searchQuery}\n` },
      ]);
      expect(() =>
        resolveRealDataResultIssueGhCommandPlan(stdout, commandArgs),
      ).toThrow();
    });

    it("(k) parse leg: URL 미발견 createEditStdout('') → parse throw(stage 3 미산출, outcome-report 미진입)", () => {
      expect(() => parseRealDataResultIssueCreateEditOutput("")).toThrow();
    });

    it("(k') parse leg: 무관 텍스트 createEditStdout('no url here') → parse throw(stage 3 미산출)", () => {
      expect(() =>
        parseRealDataResultIssueCreateEditOutput("no url here"),
      ).toThrow();
    });

    it("(l) parse leg: /issues/0 → assertPositiveIssueNumber throw(stage 3 비식별, stage 4 미진입)", () => {
      expect(() =>
        parseRealDataResultIssueCreateEditOutput(
          `https://github.com/${OWNER}/${REPO}/issues/0\n`,
        ),
      ).toThrow();
    });

    it("(l') parse leg: /issues/007(선행 0) → assertPositiveIssueNumber throw(stage 3 비식별)", () => {
      expect(() =>
        parseRealDataResultIssueCreateEditOutput(
          `https://github.com/${OWNER}/${REPO}/issues/007\n`,
        ),
      ).toThrow();
    });

    it("(l'') parse leg: /issues/abc(비숫자) → URL 미발견 throw(패턴 미매칭, stage 3 비식별)", () => {
      expect(() =>
        parseRealDataResultIssueCreateEditOutput(
          `https://github.com/${OWNER}/${REPO}/issues/abc\n`,
        ),
      ).toThrow();
    });

    it("(m) outcome-report leg: run.gitSha 빈('') → assertNonBlank throw(stage 4 비식별 — N 은 stage 3 까지 정상이어도 종단 실패)", () => {
      const parseOutcome = parseRealDataResultIssueCreateEditOutput(
        createEditStdout(7),
      );
      expect(() =>
        buildRealDataResultIssueOutcomeReport(parseOutcome, {
          gitSha: "",
          dateToken: "2026-06-28",
        }),
      ).toThrow();
    });

    it("(m') outcome-report leg: run.gitSha 공백-only('   ') → assertNonBlank throw 대칭(stage 4 비식별)", () => {
      const parseOutcome = parseRealDataResultIssueCreateEditOutput(
        createEditStdout(7),
      );
      expect(() =>
        buildRealDataResultIssueOutcomeReport(parseOutcome, {
          gitSha: "   ",
          dateToken: "2026-06-28",
        }),
      ).toThrow();
    });

    it("(n) outcome-report leg: run.dateToken 빈('') → assertNonBlank throw 대칭(stage 4 비식별)", () => {
      const parseOutcome = parseRealDataResultIssueCreateEditOutput(
        createEditStdout(7),
      );
      expect(() =>
        buildRealDataResultIssueOutcomeReport(parseOutcome, {
          gitSha: "abc1234",
          dateToken: "",
        }),
      ).toThrow();
    });

    it("(n') outcome-report leg: run.dateToken 공백-only(' ') → assertNonBlank throw 대칭(stage 4 비식별)", () => {
      const parseOutcome = parseRealDataResultIssueCreateEditOutput(
        createEditStdout(7),
      );
      expect(() =>
        buildRealDataResultIssueOutcomeReport(parseOutcome, {
          gitSha: "abc1234",
          dateToken: " ",
        }),
      ).toThrow();
    });

    it("(o) outcome-report leg: parseOutcome.issueNumber 0 직접 주입 → assertPositiveIssueNumber throw(stage 4 가 stage 3 산출 재검증 — defense-in-depth)", () => {
      const forged: RealDataResultIssueOutcome = {
        issueNumber: 0,
        url: `https://github.com/${OWNER}/${REPO}/issues/7`,
      };
      expect(() =>
        buildRealDataResultIssueOutcomeReport(forged, validRun()),
      ).toThrow();
    });

    it("(o') outcome-report leg: parseOutcome.issueNumber 음수(-1) 직접 주입 → assertPositiveIssueNumber throw(stage 4 재검증)", () => {
      const forged: RealDataResultIssueOutcome = {
        issueNumber: -1,
        url: `https://github.com/${OWNER}/${REPO}/issues/7`,
      };
      expect(() =>
        buildRealDataResultIssueOutcomeReport(forged, validRun()),
      ).toThrow();
    });

    it("(o'') outcome-report leg: parseOutcome.issueNumber 비정수(1.5) 직접 주입 → assertPositiveIssueNumber throw(stage 4 재검증)", () => {
      const forged: RealDataResultIssueOutcome = {
        issueNumber: 1.5,
        url: `https://github.com/${OWNER}/${REPO}/issues/7`,
      };
      expect(() =>
        buildRealDataResultIssueOutcomeReport(forged, validRun()),
      ).toThrow();
    });
  });

  describe("credential 누출 0(branch — §9 / R-59 / REQ-059 정합)", () => {
    it("(p) resolvePlan.argv · parseOutcome.url · outcomeReport.summaryLine 어디에도 token/secret/PAT/--auth 어휘 미등장 + raw narrative 미포함", () => {
      const { resolvePlan, parseOutcome, outcomeReport } = runChain([7, 13]);

      const surfaces = [
        resolvePlan.argv.join(" "),
        parseOutcome.url,
        outcomeReport.summaryLine,
        outcomeReport.url,
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
      expect(parseOutcome.url).not.toMatch(/commit|pull request/i);
    });
  });

  describe("결정론·무공유·no-mutation — chain 두 번 호출 + 입력 불변 + 무공유", () => {
    it("(q) 동일 입력 chain 두 번 → resolvePlan/parseOutcome/outcomeReport 세 산출물 모두 deep-equal(결정론)", () => {
      const run = validRun();
      const commandArgs = validCommandArgs();
      const chain1 = runChain([7, 13], run, commandArgs);
      const chain2 = runChain([7, 13], run, commandArgs);

      expect(chain1.resolvePlan).toEqual(chain2.resolvePlan);
      expect(chain1.parseOutcome).toEqual(chain2.parseOutcome);
      expect(chain1.outcomeReport).toEqual(chain2.outcomeReport);
    });

    it("(r) no-mutation — 입력 commandArgs(중첩 createArgs.labels/updateArgs)·run·hitsNumbers 배열 chain 호출 전후 deep-equal", () => {
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

    it("(s) 무공유 — outcomeReport 가 입력 parseOutcome / run 과 referential identity 분리(not.toBe)", () => {
      const run = validRun();
      const parseOutcome = parseRealDataResultIssueCreateEditOutput(
        createEditStdout(7),
      );
      const outcomeReport = buildRealDataResultIssueOutcomeReport(
        parseOutcome,
        run,
      );

      expect(outcomeReport).not.toBe(parseOutcome);
      expect(outcomeReport).not.toBe(run);
      // 산출 report 가 입력 run 의 필드를 전파하되 객체 자체는 새로 생성.
      expect(outcomeReport.gitSha).toBe(run.gitSha);
      expect(outcomeReport.dateToken).toBe(run.dateToken);
    });
  });
});
