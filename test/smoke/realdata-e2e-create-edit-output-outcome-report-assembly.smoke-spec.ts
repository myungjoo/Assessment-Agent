// realdata-e2e-create-edit-output-outcome-report-assembly.smoke-spec.ts —
// 실 평가 e2e result-issue post-execution outcome-report leg 조립 체인 non-gated
// build-time smoke (T-0747 박제, PLAN.md 109행 🟢 실 평가 e2e).
//
// 본 spec 의 존재 이유 — public CI gap 해소(step④ 박제-후 outcome-report leg 직접-체인 smoke):
//   - PLAN 109행 step ④(결과 이슈 박제) build-time 순수 layer 의 **post-execution
//     (실행-후 해석) leg** 는 두 컴포저가 직렬로 닫는다 — (1)
//     `parseRealDataResultIssueCreateEditOutput(stdout)`(T-0589)가 `gh issue create` /
//     `gh issue edit <n>` 의 stdout(이슈 URL 한 줄) 을 `RealDataResultIssueOutcome`
//     (`{issueNumber, url}`) 으로 파싱·검증하고, (2)
//     `buildRealDataResultIssueOutcomeReport(outcome, run)`(T-0590)가 그 outcome 에 run
//     식별자(`RealDataResultIssueRunRef` = `{gitSha, dateToken}`)를 묶어 결정론적 실행
//     리포트 descriptor `RealDataResultIssueOutcomeReport`
//     (`{issueNumber, url, gitSha, dateToken, summaryLine}`) 로 합성한다.
//   - 이 outcome-report leg 는 step④ 의 **search-side pre-execution leg**(descriptor→
//     commandArgs→searchArgv, T-0746)의 정확한 round-trip 대칭이다 — search 측은 "이슈
//     박제 전 명령 합성", outcome-report 측은 "이슈 박제 후 결과 해석". 그러나 **이 두
//     컴포저(parse→buildReport)를 직접 chain 으로 묶은 non-gated build-time smoke 는
//     부재**였다(`git grep parseRealDataResultIssueCreateEditOutput test/smoke/` = NONE —
//     직접 chain smoke 파일 부재, 컴포저 unit + consistency + parse-shape spec 만 존재
//     확인). 기존 realdata-e2e-result-outcome-step-args-assembly.smoke-spec.ts(T-0596)는
//     aggregator `buildRealDataResultIssueOutcomeReportFromOutput(stdout, run)` 또는
//     step-args wrapper 진입으로만 검증할 뿐, `stdout → outcome → report` 중간 변환
//     산출(issueNumber/url 추출·양수 issueNumber 검증·URL 첫-매칭 결정론·run 식별자
//     thread·summaryLine 합성·5필드 전파)을 두 helper 의 직접 chain 으로 묶은 단언은 0
//     이었다.
//   - 본 spec 은 그 gap 을 메운다 — **gating 없이 항상 실행되는 일반 describe** 로
//     create/edit stdout→outcome→report 종단 조립 surface 를 검증한다. live leg(실 gh
//     호출 / `execFile('gh', argv)` / `gh issue create`·`gh issue edit` 실 실행 / 실 이슈
//     박제 / 실 네트워크 / 실 LLM / Ollama / DB / 실 jest spawn)는 복제하지 않고,
//     synthetic stdout/run literal 을 컴포저에 직접 공급해 live leg 를 우회한다(조립
//     surface 만 검증). 따라서 본 spec 은:
//
//      🔥 실 gh 호출 0 — gh issue create / edit / execFile('gh', argv) 미실행.
//         synthetic stdout/run literal 을 컴포저에 직접 공급.
//      🔥 실 네트워크 호출 0 — github / Ollama / gh 호출 0. fetch 0. process.env 읽기 0.
//      🔥 실 LLM 호출 0 / 실 DB 접근 0 / 실 jest spawn 0 — stdout→outcome→report 조립만.
//      🔥 credential 0 / secret 0 / 비용 0 — public CI 에서 항상 green 발화(R-113).
//         산출 report 어느 필드에도 token/secret/raw narrative 어휘 미주입·미포함 검증.
//      🔥 새 외부 dependency 0 — 기존 컴포저 import 재사용만(consistency-guard 신설 금지
//         — sweep 종결, T-0726).
//      🔥 gating / describe.skip 배선 0 — 순수 build-time in-memory 검증만.
//
// Out of Scope (T-0747):
//   - 기존 realdata-e2e-result-outcome-step-args-assembly.smoke-spec.ts(T-0596,
//     aggregator buildRealDataResultIssueOutcomeReportFromOutput / step-args wrapper 진입)
//     재검증 — 본 task 는 그 aggregator 아래 parse→buildReport 두 helper 직접 chain 만
//     책임(중복·재검증 0).
//   - 기존 realdata-e2e-command-args-search-gh-argv-assembly.smoke-spec.ts(T-0746,
//     descriptor→commandArgs→searchArgv search-side) — 본 task 는 post-execution
//     outcome-report leg 만, 별개 절단면(박제-전 ↔ 박제-후, file-disjoint 병렬 stream).
//   - 실 gh issue create·edit 실행 / `execFile('gh', argv)` / 실 이슈 박제 / 실 github
//     네트워크 / 실 LLM round-trip / Ollama / DB 접근 / 실 jest spawn.
//   - aggregator 컴포저 / step-args wrapper / publish-step-args — 본 task 는 parse→
//     buildReport 직접 chain surface 만.
//   - 컴포저 소스 / 위임 consistency·parse-shape·summary-line 가드 / descriptor·run-ref
//     정의 수정 — test-only(신규 smoke spec 1 파일). 새 컴포저 / 가드 / helper 신설 0.
//   - production src/ 코드 / package.json / test/jest-smoke.json 변경.
import type { RealDataResultIssueRunRef } from "../helpers/realdata-e2e-result-issue-descriptor";
import { buildRealDataResultIssueOutcomeReport } from "../helpers/realdata-e2e-result-issue-outcome-report";
import { parseRealDataResultIssueCreateEditOutput } from "../helpers/realdata-e2e-result-issue-output-parse";

// 결정론 run 식별자 fixture — gitSha + dateToken 비공백 안정 토큰. 매 it 가 spread
// 복제로 받아 입력 mutate 누설 0. token/secret/raw narrative 어휘 미포함(credential
// 누출 0 단언의 fixture 전제).
const RUN_REF: RealDataResultIssueRunRef = {
  gitSha: "abc1234",
  dateToken: "2026-06-28",
};

// synthetic create/edit stdout literal — 유효 issue URL 한 줄(trailing 개행 포함).
// 컴포저는 이 stdout 을 파싱(URL 추출·issueNumber 검증) → outcome 으로 흘려보내는
// surface 만 검증하므로, 실 `gh issue create`/`gh issue edit` round-trip 없이 직접
// 주입한다. create / edit 양측 모두 동형의 URL stdout 을 산출하므로(다른 이슈 번호)
// 두 happy-path fixture 를 분리한다.
const CREATE_STDOUT =
  "https://github.com/myungjoo/assessment-agent/issues/42\n";
const EDIT_STDOUT = "https://github.com/myungjoo/assessment-agent/issues/7\n";

// 위 stdout 의 trim 정규화된 issue URL(deep-equal 대조 source).
const CREATE_URL = "https://github.com/myungjoo/assessment-agent/issues/42";

// 유효 run 을 spread 복제로 산출 — 매 it 가 새 객체를 받아 입력 RUN_REF mutate 누설 0.
function validRun(
  overrides: Partial<RealDataResultIssueRunRef> = {},
): RealDataResultIssueRunRef {
  return { ...RUN_REF, ...overrides };
}

// 두 helper 직접 chain — stdout → outcome → report. 본 spec 의 검증 대상 종단 조립
// 경로(자체 try/catch 0 — guard throw 는 그대로 전파).
function chain(
  stdout: string,
  run: RealDataResultIssueRunRef,
): ReturnType<typeof buildRealDataResultIssueOutcomeReport> {
  return buildRealDataResultIssueOutcomeReport(
    parseRealDataResultIssueCreateEditOutput(stdout),
    run,
  );
}

describe("Smoke(non-gated): 실 평가 e2e result-issue outcome-report leg 조립 체인(create/edit stdout→outcome→report) live-gh 0 검증", () => {
  describe("happy path — 조립된 outcome-report descriptor 산출", () => {
    it("(a) 산출 report 가 {issueNumber, url, gitSha, dateToken, summaryLine} 5 필드를 정확히 보유", () => {
      const report = chain(CREATE_STDOUT, validRun());

      expect(Object.keys(report).sort()).toEqual(
        ["dateToken", "gitSha", "issueNumber", "summaryLine", "url"].sort(),
      );
      expect(typeof report.issueNumber).toBe("number");
      expect(typeof report.url).toBe("string");
      expect(typeof report.gitSha).toBe("string");
      expect(typeof report.dateToken).toBe("string");
      expect(typeof report.summaryLine).toBe("string");
    });

    it("(b) report 가 expected literal(issueNumber=URL 번호·url=trim·gitSha/dateToken=run 전파·summaryLine=합성식)과 deep-equal", () => {
      const run = validRun();
      const report = chain(CREATE_STDOUT, run);

      expect(report).toEqual({
        issueNumber: 42,
        url: CREATE_URL,
        gitSha: run.gitSha,
        dateToken: run.dateToken,
        summaryLine: `[${run.dateToken}@${run.gitSha}] 결과 이슈 #42 박제 → ${CREATE_URL}`,
      });
    });

    it("(c) report.issueNumber·report.url 이 중간 outcome(parse 산출) 값과 동일하게 전파(재합성 0 — 위임 산출만 thread)", () => {
      const run = validRun();
      // 중간 outcome 을 직접 산출해 전파 정합을 대조.
      const outcome = parseRealDataResultIssueCreateEditOutput(CREATE_STDOUT);
      const report = buildRealDataResultIssueOutcomeReport(outcome, run);

      expect(report.issueNumber).toBe(outcome.issueNumber);
      expect(report.url).toBe(outcome.url);
    });

    it("edit stdout(다른 이슈 번호) 과 함께 호출 → 동일 조립 경로로 issueNumber/url 반영된 report 산출", () => {
      const run = validRun();
      const report = chain(EDIT_STDOUT, run);

      expect(report.issueNumber).toBe(7);
      expect(report.url).toBe(
        "https://github.com/myungjoo/assessment-agent/issues/7",
      );
      expect(report.gitSha).toBe(run.gitSha);
      expect(report.dateToken).toBe(run.dateToken);
    });
  });

  describe("단일 source 조립 단언 — 중간 outcome 단일 source 전파(재합성 0)", () => {
    it("직접 chain 산출 report 가 buildRealDataResultIssueOutcomeReport(parse(stdout), run) 와 deep-equal", () => {
      const run = validRun();
      const viaChain = chain(CREATE_STDOUT, run);
      const viaExplicit = buildRealDataResultIssueOutcomeReport(
        parseRealDataResultIssueCreateEditOutput(CREATE_STDOUT),
        run,
      );

      expect(viaChain).toEqual(viaExplicit);
    });

    it("report.summaryLine 이 `[dateToken@gitSha] 결과 이슈 #issueNumber 박제 → url` 합성식과 일치(구성 4필드↔summaryLine 정합)", () => {
      const run = validRun();
      const outcome = parseRealDataResultIssueCreateEditOutput(CREATE_STDOUT);
      const report = buildRealDataResultIssueOutcomeReport(outcome, run);

      expect(report.summaryLine).toBe(
        `[${run.dateToken}@${run.gitSha}] 결과 이슈 #${outcome.issueNumber} 박제 → ${outcome.url}`,
      );
    });
  });

  describe("error / negative cases — parse / report guard throw 가 조립 경로로 그대로 전파(자체 try/catch 0)", () => {
    it("(a-i) stdout 에 issue URL 미발견(무관 텍스트) → parse throw 전파", () => {
      expect(() => chain("no url here at all\n", validRun())).toThrow();
    });

    it("(a-ii) 빈 stdout → parse throw 전파", () => {
      expect(() => chain("", validRun())).toThrow();
    });

    it("(a-iii) 공백만 stdout → parse throw 전파", () => {
      expect(() => chain("   \n  ", validRun())).toThrow();
    });

    it("(a-iv) 비-github 호스트 URL stdout → parse throw 전파", () => {
      expect(() =>
        chain(
          "https://gitlab.com/myungjoo/assessment-agent/issues/42\n",
          validRun(),
        ),
      ).toThrow();
    });

    it("(a-v) /pull/ PR URL stdout → parse throw 전파(issue 경로 아님)", () => {
      expect(() =>
        chain(
          "https://github.com/myungjoo/assessment-agent/pull/42\n",
          validRun(),
        ),
      ).toThrow();
    });

    it("(b-i) issueNumber 0(/issues/0) stdout → parse throw 전파(양의 정수 아님)", () => {
      expect(() =>
        chain(
          "https://github.com/myungjoo/assessment-agent/issues/0\n",
          validRun(),
        ),
      ).toThrow();
    });

    it("(b-ii) issueNumber 선행0(007) stdout → parse throw 전파", () => {
      expect(() =>
        chain(
          "https://github.com/myungjoo/assessment-agent/issues/007\n",
          validRun(),
        ),
      ).toThrow();
    });

    it("(b-iii) issueNumber 비정수(abc) stdout → parse throw 전파", () => {
      expect(() =>
        chain(
          "https://github.com/myungjoo/assessment-agent/issues/abc\n",
          validRun(),
        ),
      ).toThrow();
    });

    it("(c-i) run.gitSha 빈 문자열 → report 단계 guard throw 전파(stdout 유효해도)", () => {
      expect(() => chain(CREATE_STDOUT, validRun({ gitSha: "" }))).toThrow();
    });

    it("(c-ii) run.gitSha 공백만 → report guard throw 전파", () => {
      expect(() => chain(CREATE_STDOUT, validRun({ gitSha: "   " }))).toThrow();
    });

    it("(d-i) run.dateToken 빈 문자열 → report guard throw 전파", () => {
      expect(() => chain(CREATE_STDOUT, validRun({ dateToken: "" }))).toThrow();
    });

    it("(d-ii) run.dateToken 공백만 → report guard throw 전파", () => {
      expect(() =>
        chain(CREATE_STDOUT, validRun({ dateToken: "   " })),
      ).toThrow();
    });
  });

  describe("flow / branch — raw 누출 0 · 다중 줄 결정론 · trim 정규화(분기마다 분리)", () => {
    it("(a) raw 본문/narrative 누출 0 — report 어느 필드에도 token/secret/raw narrative 패턴 미포함(R-59/REQ-059)", () => {
      const report = chain(CREATE_STDOUT, validRun());
      const joined = [
        String(report.issueNumber),
        report.url,
        report.gitSha,
        report.dateToken,
        report.summaryLine,
      ].join(" ");

      expect(joined).not.toContain("--token");
      expect(joined).not.toContain("GITHUB_TOKEN");
      expect(joined).not.toMatch(/ghp_[A-Za-z0-9]/);
      expect(joined).not.toContain("narrative");
    });

    it("(b) 다중 줄 stdout 결정론 — gh 부가 메시지 줄이 섞여도 issue URL 첫 매칭만 사용해 동일 outcome→report 산출", () => {
      const noisy =
        "Creating issue in myungjoo/assessment-agent\n" +
        `${CREATE_URL}\n` +
        "https://github.com/myungjoo/assessment-agent/issues/99\n";
      const run = validRun();

      const fromNoisy = chain(noisy, run);
      const fromClean = chain(CREATE_STDOUT, run);

      // 첫 매칭(42)만 사용 — 뒤따르는 99 는 무시(결정론).
      expect(fromNoisy.issueNumber).toBe(42);
      expect(fromNoisy.url).toBe(CREATE_URL);
      expect(fromNoisy).toEqual(fromClean);
    });

    it("(c) URL trailing 개행/공백 trim 정규화 — stdout URL 에 trailing 공백/개행이 있어도 report.url 이 trim 됨", () => {
      const trailing = `${CREATE_URL}   \n\n`;
      const report = chain(trailing, validRun());

      expect(report.url).toBe(CREATE_URL);
      // summaryLine 에도 trim 된 url 이 반영됨(미정규화 url 누출 0).
      expect(report.summaryLine).toContain(CREATE_URL);
      expect(report.summaryLine).not.toContain(`${CREATE_URL} `);
    });
  });

  describe("결정론 · 무공유 · no-mutation — 동일 (stdout, run) 두 번 chain + 입력 불변", () => {
    it("(e) 두 chain 호출 deep-equal report + 매 호출 새 report 객체(반환 참조 비동일)", () => {
      const run = validRun();
      const a = chain(CREATE_STDOUT, run);
      const b = chain(CREATE_STDOUT, run);

      expect(a).toEqual(b);
      expect(a).not.toBe(b);
    });

    it("(f) no-mutation — 입력 run 객체(및 중첩 필드)가 chain 호출 전후 deep-equal(mutate 0)", () => {
      const run = validRun();
      const before = JSON.parse(JSON.stringify(run));

      chain(CREATE_STDOUT, run);

      expect(run).toEqual(before);
    });
  });
});
