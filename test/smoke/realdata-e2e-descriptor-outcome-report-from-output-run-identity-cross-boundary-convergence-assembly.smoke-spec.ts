// realdata-e2e-descriptor-outcome-report-from-output-run-identity-cross-boundary-convergence-assembly.smoke-spec.ts
// — 실 평가 e2e step④ pre/post-execution cross-boundary descriptor↔outcome-report-from-output
// run-identity(gitSha·dateToken) 단일-진입 single-source 수렴 non-gated build-time smoke
// (T-0768 박제, PLAN.md 109행 🟢 실 평가 e2e step④).
//
// 본 spec 의 존재 이유 — public CI gap 해소(run-identity 축 두 boundary 컴포저 합류):
//   - PLAN 109행 step④(결과 이슈 박제)의 멱등 search-or-update 는 실행 사이클의 양쪽
//     boundary 에서 **live caller 가 실제로 동일 run ref(gitSha·dateToken)로 wiring 하는
//     두 진입점**으로 닫힌다:
//       (pre)  `buildRealDataResultIssueDescriptor(summary, run)`(T-0582) — run 식별 token
//              (`${dateToken}@${gitSha}`)을 title·marker 에 박제(pre-execution 식별 layer).
//       (post) `buildRealDataResultIssueOutcomeReportFromOutput(execStdout, run)`(T-0596) —
//              내부에서 parse → outcome-report 2 단 위임으로 run.gitSha/dateToken 을 종단
//              전파(post-execution interpretation 단일-진입).
//     이 두 단일-진입 boundary 컴포저가 동일 run source 의 gitSha·dateToken 으로
//     cross-boundary 수렴해야 caller live wiring 의 양쪽 경계 어디에서도 run 식별자 drift 가
//     0 임이 박제된다(REQ-009 멱등성 "동일 run → 동일 marker·제목" + REQ-037 결과 리포트
//     재실행 정합 "리포트의 gitSha/dateToken 이 실행 run 과 일치" 종단 closure).
//   - 직전 sibling T-0767(issueNumber 축, search-hit.minNumber → resolve → from-output)의
//     **run-identity 축(gitSha·dateToken) mirror** — issueNumber 가 "어느 이슈에 박제하나"의
//     식별자라면, run-identity 는 "어느 실행을 박제하나"의 식별자다.
//   - 기존 sweep 은 두 진입점 중 어느 한쪽씩만 run ref 를 소비했다:
//       T-0767 — descriptor(pre) 미참조(issueNumber 축만, descriptor run token 미참조).
//       T-0747(create-edit-output-outcome-report) — from-output 단독 5필드 재유도(post 단독,
//         descriptor pre 측 run token 미참조).
//       T-0709/descriptor identity 가드 — descriptor.title/marker run token self-consistency
//         만(post from-output 합류 0).
//   - 본 spec 은 그 gap 을 메운다 — **descriptor(pre) + from-output(post) 두 단일-진입
//     boundary 컴포저를 같은 smoke 안에서 single-source(summary + run + execStdout)로
//     동시-호출** 해 run(gitSha·dateToken) → descriptor.{title,marker} 박제 ↔
//     from-output.{gitSha,dateToken} 전파 cross-boundary byte-identical 수렴을 박제한다.
//   - live leg(실 prisma·실 collectForPerson·실 github.com fetch·실 LLM scoring·실 gh CLI
//     실행 / `execFile('gh', argv)` / DB / LAN gate)는 복제하지 않고, synthetic
//     summary(EvaluationResult literal 집계) + run literal + execStdout literal 을 두 컴포저에
//     직접 공급해 live leg 를 우회한다(조립 surface 만 검증). 따라서 본 spec 은:
//
//      🔥 실 gh 호출 0 — gh search / create / edit / execFile('gh', argv) 미실행.
//         synthetic summary / run / execStdout literal 을 두 컴포저에 직접 공급.
//      🔥 실 네트워크 호출 0 — github / Ollama / gh 호출 0. fetch 0. process.env 읽기 0.
//      🔥 실 LLM 호출 0 / 실 DB 접근 0 / 실 jest spawn 0 — run-identity cross-boundary 조립만.
//      🔥 credential 0 / secret 0 / 비용 0 — public CI 에서 항상 green 발화(R-113).
//         산출 title / marker / body / url / summaryLine 어디에도 token/secret 어휘 미주입.
//      🔥 새 외부 dependency 0 — 기존 descriptor* / outcome-report-from-output* / summary*
//         컴포저 import 재사용만(가드/helper 신설 0).
//      🔥 gating / describe.skip 배선 0 — 순수 build-time in-memory 검증만.
//
// Out of Scope (T-0768):
//   - issueNumber 축 cross-boundary 수렴 자체 재단언(T-0767 cover). 본 task 는 issueNumber leg
//     를 격리 입력(partial-thread)으로만 쓰고, run-identity(gitSha·dateToken) 축만 단언.
//   - from-output 단독 5필드(url/issueNumber/summaryLine 합성·url trim 정규화) 재유도 재단언
//     (T-0747 cover). 본 task 는 run-identity 축 cross-boundary 수렴만.
//   - descriptor.title/marker 의 run token self-consistency 자체 재단언(T-0709 identity 가드
//     cover). 본 task 는 descriptor ↔ from-output 두 boundary 사이의 cross-boundary 합류만.
//   - descriptor.body 의 3블록 구조 무결성 재단언(body 가드 cover). 본 task 는 body 의 run
//     token 박제 여부만 부수 참조.
//   - marker 축 search-resolve roundtrip 재단언(T-0758/T-0766 cover).
//   - DB 의존(prisma·테스트 DB·migration) 0 / live-LLM·실 fetch·실 collectForPerson 의존 0.
//   - 새 helper 모듈 신설(test/helpers/ 변경 0) / production src/ 코드·package.json 변경.
import type { EvaluationResult } from "../../src/assessment-evaluation/domain/evaluation-result";
import { buildRealDataResultIssueDescriptor } from "../helpers/realdata-e2e-result-issue-descriptor";
import type { RealDataResultIssueRunRef } from "../helpers/realdata-e2e-result-issue-descriptor";
import { buildRealDataResultIssueOutcomeReportFromOutput } from "../helpers/realdata-e2e-result-issue-outcome-report-from-output";
import { buildRealDataResultSummary } from "../helpers/realdata-e2e-result-summary";

// 결정론 owner/repo — 합성 issue URL 의 path segment source(public CI 에서 항상 green
// 발화). token/secret/PAT/--auth 어휘 미포함.
const OWNER = "myungjoo";
const REPO = "assessment-agent";

// 결정론 run 식별자 fixture 헬퍼 — descriptor·from-output 두 컴포저가 공유하는 단일 run
// source. 비공백 안정 토큰이라 양쪽 컴포저의 assertNonBlank guard 를 자극하지 않는다.
// 매 it 가 새 객체를 받아 입력 run mutate 누설이 0 이 되도록 한다.
function validRun(
  gitSha: string = "abc1234",
  dateToken: string = "2026-06-28",
): RealDataResultIssueRunRef {
  return { gitSha, dateToken };
}

// 합성 run-token — descriptor 컴포저 내부 `runToken(run) = ${dateToken}@${gitSha}` 및
// outcome-report 의 summaryLine `[${dateToken}@${gitSha}] ...` 와 동일 규칙으로 test 측에서
// 재유도한 expected 공유 substring. literal prefix 는 private 이라 만지지 않고, 이 token 이
// pre(title·marker) / post(summaryLine) 두 boundary 양쪽에 등장(cross-boundary 수렴)함을
// 구조적으로 단언한다.
function expectedToken(run: RealDataResultIssueRunRef): string {
  return `${run.dateToken}@${run.gitSha}`;
}

// synthetic EvaluationResult 1 건 — descriptor 컴포저는 결과 배열을 요약 집계
// (count·분포·totalVolume) → body 로만 흘려보내고 title·marker 는 run 만의 함수이므로,
// 도메인 타입 정합(difficulty / contribution 멤버십)만 만족하는 minimal literal 로 충분하다.
// 실 LLM 호출 없이 EvaluationResult shape 만 강제한다.
function syntheticResult(
  unitId: string,
  difficulty: EvaluationResult["difficulty"],
  contribution: EvaluationResult["contribution"],
  volume: number,
): EvaluationResult {
  return {
    unitId,
    narrative:
      "synthetic evaluation narrative — descriptor↔outcome-report-from-output run-identity cross-boundary smoke fixture",
    difficulty,
    contribution,
    volume,
  };
}

// 유효 summary fixture — descriptor 의 첫 인자(`RealDataResultSummary`). EvaluationResult
// literal 집계로 합성(buildRealDataResultSummary 위임). 분포 값만 다르게 줄 수 있도록 results
// 배열을 인자로 받는다(summary 무관 격리 시나리오에서 분포 A·B 분리 입력).
function validSummary(
  results: EvaluationResult[] = [
    syntheticResult("github:github.com:c1", "easy", "low", 3),
    syntheticResult("github:github.com:c2", "medium", "high", 5),
    syntheticResult("github:github.com:c3", "hard", "medium", 2),
  ],
) {
  return buildRealDataResultSummary(results);
}

// synthetic gh issue edit stdout 합성 헬퍼 — `gh issue edit <N>` 의 stdout 은
// https://github.com/<owner>/<repo>/issues/<N> URL 한 줄 + 부가 메시지/개행을 포함할 수 있다.
// 본 helper 는 그 happy-path 형상을 N 별로 합성한다(from-output 내부 parse 가 첫 매칭 URL
// 결정론으로 추출하는 surface 직접 자극).
function execStdout(n: number, noisePrefix: string = ""): string {
  return `${noisePrefix}https://github.com/${OWNER}/${REPO}/issues/${n}\n`;
}

// descriptor(pre boundary) + from-output(post boundary) 두 단일-진입 컴포저를 single-source
// (summary + run + execStdout)로 묶어 호출하는 chain 헬퍼. 두 boundary 산출물을 한 번에
// 반환해 cross-boundary 단언을 짧게 묶는다.
function runChain(
  run: RealDataResultIssueRunRef = validRun(),
  issueN: number = 7,
  summaryResults?: EvaluationResult[],
  noisePrefix: string = "",
): {
  descriptor: ReturnType<typeof buildRealDataResultIssueDescriptor>;
  outcomeReport: ReturnType<
    typeof buildRealDataResultIssueOutcomeReportFromOutput
  >;
} {
  const summary = summaryResults
    ? validSummary(summaryResults)
    : validSummary();

  // pre boundary 단일-진입 — run token 을 title·marker 에 박제.
  const descriptor = buildRealDataResultIssueDescriptor(summary, run);

  // caller 가 `gh issue edit N ...` 을 실행한 뒤 받는 stdout + 동일 run 을 post boundary
  // 단일-진입 컴포저에 직접 공급(내부에서 parse → outcome-report 위임으로 run 전파).
  const outcomeReport = buildRealDataResultIssueOutcomeReportFromOutput(
    execStdout(issueN, noisePrefix),
    run,
  );

  return { descriptor, outcomeReport };
}

describe("Smoke(non-gated): 실 평가 e2e step④ pre/post-execution cross-boundary descriptor↔outcome-report-from-output 단일-진입 run-identity(gitSha·dateToken) 수렴(byte-identical run token) live-gh 0 검증", () => {
  describe("happy path — 두 단일-진입 컴포저 모두 정상 산출(descriptor + outcome-report-from-output)", () => {
    it("(a) 유효 summary + run + execStdout → descriptor({title,marker,body} 비어있지 않음) / outcomeReport({issueNumber,url,gitSha,dateToken,summaryLine}) 두 산출물 모두 정상", () => {
      const { descriptor, outcomeReport } = runChain();

      // pre boundary — descriptor 3 필드 정상.
      expect(typeof descriptor.title).toBe("string");
      expect(descriptor.title.length).toBeGreaterThan(0);
      expect(typeof descriptor.marker).toBe("string");
      expect(descriptor.marker.length).toBeGreaterThan(0);
      expect(typeof descriptor.body).toBe("string");
      expect(descriptor.body.length).toBeGreaterThan(0);

      // post boundary — outcome-report 5 필드 정상.
      expect(typeof outcomeReport.issueNumber).toBe("number");
      expect(outcomeReport.issueNumber).toBeGreaterThan(0);
      expect(typeof outcomeReport.url).toBe("string");
      expect(outcomeReport.url.length).toBeGreaterThan(0);
      expect(typeof outcomeReport.gitSha).toBe("string");
      expect(typeof outcomeReport.dateToken).toBe("string");
      expect(typeof outcomeReport.summaryLine).toBe("string");
      expect(outcomeReport.summaryLine.length).toBeGreaterThan(0);
    });
  });

  describe("cross-boundary run-identity single-source 수렴(branch — 핵심 불변식)", () => {
    it("(b) run(gitSha·dateToken) → descriptor.{title,marker} 박제 ↔ from-output.{gitSha,dateToken} 전파 byte-identical cross-boundary 수렴(pre/post 경계 drift 0)", () => {
      const run = validRun();
      const token = expectedToken(run);
      const { descriptor, outcomeReport } = runChain(run);

      // post boundary — run 그대로 전파.
      expect(outcomeReport.gitSha).toBe(run.gitSha);
      expect(outcomeReport.dateToken).toBe(run.dateToken);

      // pre boundary — descriptor.title·marker 안 run token 박제.
      expect(descriptor.title).toContain(token);
      expect(descriptor.marker).toContain(token);

      // 종단 cross-boundary closure — pre descriptor.marker ↔ post from-output run-identity
      // (post 가 run 그대로 전파하므로 outcomeReport 의 gitSha/dateToken 으로 재유도한
      // token 이 pre descriptor.marker 안에 등장 — 두 boundary 가 동일 run 식별 token 으로
      // 수렴).
      expect(descriptor.marker).toContain(
        `${outcomeReport.dateToken}@${outcomeReport.gitSha}`,
      );
    });
  });

  describe("summaryLine 매체 run-identity 일치(branch — summaryLine-mediated 수렴)", () => {
    it("(c) 동일 run token 이 outcome-report 의 사람-친화 summaryLine 에도 박제(descriptor.title/marker / report.gitSha·dateToken / report.summaryLine 매체 일치)", () => {
      const run = validRun();
      const token = expectedToken(run);
      const { descriptor, outcomeReport } = runChain(run);

      // summaryLine 안 run 식별자(gitSha·dateToken) 둘 다 박제.
      expect(outcomeReport.summaryLine).toContain(run.gitSha);
      expect(outcomeReport.summaryLine).toContain(run.dateToken);
      // 합성 run token(`${dateToken}@${gitSha}`)이 summaryLine 에도 통째로 등장.
      expect(outcomeReport.summaryLine).toContain(token);
      // 동일 token 이 pre descriptor 두 매체에도 박제(3 매체 일치).
      expect(descriptor.title).toContain(token);
      expect(descriptor.marker).toContain(token);
    });
  });

  describe("run 분포 변별성(branch — 다른 run→다른 token, 같은 run→cross-boundary 수렴)", () => {
    it("(d) run_A vs run_B 각각 chain → 두 chain 의 descriptor token / from-output.{gitSha,dateToken} 가 각각 run_A·run_B 로 분리 수렴(각 chain 안 pre↔post 일치)", () => {
      const runA = validRun("abc1234", "2026-06-21");
      const runB = validRun("def5678", "2026-06-29");
      const tokenA = expectedToken(runA);
      const tokenB = expectedToken(runB);

      const chainA = runChain(runA);
      const chainB = runChain(runB);

      // chain A — pre↔post 모두 run_A token.
      expect(chainA.descriptor.title).toContain(tokenA);
      expect(chainA.descriptor.marker).toContain(tokenA);
      expect(chainA.outcomeReport.gitSha).toBe(runA.gitSha);
      expect(chainA.outcomeReport.dateToken).toBe(runA.dateToken);
      expect(chainA.outcomeReport.summaryLine).toContain(tokenA);

      // chain B — pre↔post 모두 run_B token.
      expect(chainB.descriptor.title).toContain(tokenB);
      expect(chainB.descriptor.marker).toContain(tokenB);
      expect(chainB.outcomeReport.gitSha).toBe(runB.gitSha);
      expect(chainB.outcomeReport.dateToken).toBe(runB.dateToken);
      expect(chainB.outcomeReport.summaryLine).toContain(tokenB);

      // 두 chain 의 run token 분리(다른 run → 다른 token).
      expect(tokenA).not.toBe(tokenB);
      expect(chainA.descriptor.marker).not.toBe(chainB.descriptor.marker);
      expect(chainA.outcomeReport.gitSha).not.toBe(chainB.outcomeReport.gitSha);
      expect(chainA.outcomeReport.dateToken).not.toBe(
        chainB.outcomeReport.dateToken,
      );
    });
  });

  describe("issueNumber 무관 — run-identity 수렴 격리(branch — partial-thread 격리)", () => {
    it("(e) 동일 run 고정 + execStdout URL 번호 N 만 다르게(11 vs 47) → run-identity(gitSha/dateToken/descriptor token) 두 경우 동일, issueNumber 만 달라야 함", () => {
      const run = validRun();
      const token = expectedToken(run);
      const chain11 = runChain(run, 11);
      const chain47 = runChain(run, 47);

      // run-identity 축 — issueNumber 변경이 누설 0(두 경우 동일).
      expect(chain11.outcomeReport.gitSha).toBe(chain47.outcomeReport.gitSha);
      expect(chain11.outcomeReport.dateToken).toBe(
        chain47.outcomeReport.dateToken,
      );
      expect(chain11.descriptor.marker).toBe(chain47.descriptor.marker);
      expect(chain11.descriptor.title).toBe(chain47.descriptor.title);
      expect(chain11.descriptor.title).toContain(token);

      // issueNumber leg — 자기 영역에서는 정상 전파(두 경우 달라야 함).
      expect(chain11.outcomeReport.issueNumber).toBe(11);
      expect(chain47.outcomeReport.issueNumber).toBe(47);
      expect(chain11.outcomeReport.issueNumber).not.toBe(
        chain47.outcomeReport.issueNumber,
      );
    });
  });

  describe("summary 무관 — run-identity 수렴 격리(branch — partial-thread 격리, 두 번째 축)", () => {
    it("(f) 동일 run 고정 + summary 분포 값만 다르게 → descriptor.title/marker 두 경우 동일 run token(summary 누설 0, REQ-009 정합), body 는 달라야 함", () => {
      const run = validRun();
      const token = expectedToken(run);
      const chainA = runChain(run, 7, [
        syntheticResult("github:github.com:a1", "easy", "low", 1),
      ]);
      const chainB = runChain(run, 7, [
        syntheticResult("github:github.com:b1", "hard", "high", 9),
        syntheticResult("github:github.com:b2", "medium", "medium", 4),
      ]);

      // run-identity 축 — summary 변경이 title·marker run token 에 누설 0(두 경우 동일).
      expect(chainA.descriptor.title).toBe(chainB.descriptor.title);
      expect(chainA.descriptor.marker).toBe(chainB.descriptor.marker);
      expect(chainA.descriptor.title).toContain(token);
      expect(chainA.descriptor.marker).toContain(token);

      // body 는 summary 본문 반영 — run leg 와 무관히 두 경우 달라야 함.
      expect(chainA.descriptor.body).not.toBe(chainB.descriptor.body);
    });
  });

  describe("error path / negative cases — pre/post boundary 양쪽 run-identity 거부 대칭 박제", () => {
    it("(g) descriptor leg(pre): run.gitSha 빈('') → assertNonBlank('gitSha') throw(stage 1 비식별, pre boundary 차단)", () => {
      expect(() =>
        buildRealDataResultIssueDescriptor(validSummary(), {
          gitSha: "",
          dateToken: "2026-06-29",
        }),
      ).toThrow();
    });

    it("(g') descriptor leg(pre): run.gitSha 공백-only('   ') → assertNonBlank('gitSha') throw 대칭", () => {
      expect(() =>
        buildRealDataResultIssueDescriptor(validSummary(), {
          gitSha: "   ",
          dateToken: "2026-06-29",
        }),
      ).toThrow();
    });

    it("(h) descriptor leg(pre): run.dateToken 빈('') → assertNonBlank('dateToken') throw 대칭(stage 1 비식별)", () => {
      expect(() =>
        buildRealDataResultIssueDescriptor(validSummary(), {
          gitSha: "abc1234",
          dateToken: "",
        }),
      ).toThrow();
    });

    it("(h') descriptor leg(pre): run.dateToken 공백-only(' ') → assertNonBlank('dateToken') throw 대칭", () => {
      expect(() =>
        buildRealDataResultIssueDescriptor(validSummary(), {
          gitSha: "abc1234",
          dateToken: " ",
        }),
      ).toThrow();
    });

    it("(i) from-output leg(post): run.gitSha 빈('') → (2) builder 위임 assertNonBlank throw(stage 2 builder 비식별 — execStdout URL 정상이어도 post boundary 종단 실패, pre/post 대칭 거부)", () => {
      expect(() =>
        buildRealDataResultIssueOutcomeReportFromOutput(execStdout(7), {
          gitSha: "",
          dateToken: "2026-06-29",
        }),
      ).toThrow();
    });

    it("(i') from-output leg(post): run.dateToken 빈('') → (2) builder 위임 assertNonBlank throw 대칭(stage 2 builder 비식별)", () => {
      expect(() =>
        buildRealDataResultIssueOutcomeReportFromOutput(execStdout(7), {
          gitSha: "abc1234",
          dateToken: "",
        }),
      ).toThrow();
    });

    it("(j) from-output leg(post): execStdout 에 URL 미발견(빈 문자열) → (1) parse 위임 throw(stage 2 미산출 — run 정상이어도 outcome 추출 실패로 from-output 차단)", () => {
      expect(() =>
        buildRealDataResultIssueOutcomeReportFromOutput("", validRun()),
      ).toThrow();
    });

    it("(j') from-output leg(post): execStdout 무관 텍스트('no url here') → (1) parse 위임 throw(stage 2 미산출)", () => {
      expect(() =>
        buildRealDataResultIssueOutcomeReportFromOutput(
          "no url here",
          validRun(),
        ),
      ).toThrow();
    });

    it("(k) from-output leg(post): URL issueNumber 비양수(/issues/0) → (1) parse assertPositiveIssueNumber throw(stage 2 비식별)", () => {
      expect(() =>
        buildRealDataResultIssueOutcomeReportFromOutput(
          `https://github.com/${OWNER}/${REPO}/issues/0\n`,
          validRun(),
        ),
      ).toThrow();
    });

    it("(k') from-output leg(post): URL issueNumber 비숫자(/issues/abc) → (1) parse 위임 throw(stage 2 비식별)", () => {
      expect(() =>
        buildRealDataResultIssueOutcomeReportFromOutput(
          `https://github.com/${OWNER}/${REPO}/issues/abc\n`,
          validRun(),
        ),
      ).toThrow();
    });
  });

  describe("결정론·무공유·no-mutation — chain 두 번 호출 + 입력 불변 + 무공유", () => {
    it("(l) 동일 (summary, run, execStdout) 입력 chain 두 번 → descriptor/outcomeReport 두 산출물 모두 deep-equal(결정론)", () => {
      const run = validRun();
      const results = [
        syntheticResult("github:github.com:d1", "easy", "low", 3),
        syntheticResult("github:github.com:d2", "medium", "high", 5),
      ];
      const chain1 = runChain(run, 7, results);
      const chain2 = runChain(run, 7, results);

      expect(chain1.descriptor).toEqual(chain2.descriptor);
      expect(chain1.outcomeReport).toEqual(chain2.outcomeReport);
    });

    it("(m) no-mutation — 입력 summary·run 객체 chain 호출 전후 deep-equal(원본 보존)", () => {
      const results = [
        syntheticResult("github:github.com:m1", "hard", "medium", 2),
      ];
      const summary = validSummary(results);
      const summaryBefore = JSON.parse(JSON.stringify(summary));
      const run = validRun();
      const runBefore = { ...run };

      buildRealDataResultIssueDescriptor(summary, run);
      buildRealDataResultIssueOutcomeReportFromOutput(execStdout(7), run);

      expect(summary).toEqual(summaryBefore);
      expect(run).toEqual(runBefore);
    });

    it("(n) 무공유 — 두 산출물이 입력 run 과 referential identity 분리(not.toBe), run 필드는 전파", () => {
      const run = validRun();
      const descriptor = buildRealDataResultIssueDescriptor(
        validSummary(),
        run,
      );
      const outcomeReport = buildRealDataResultIssueOutcomeReportFromOutput(
        execStdout(7),
        run,
      );

      // 매 호출 새 객체 — 입력 run 과 객체 동일성 분리.
      expect(descriptor as unknown).not.toBe(run);
      expect(outcomeReport as unknown).not.toBe(run);
      // 단 run 필드는 정상 전파(post boundary).
      expect(outcomeReport.gitSha).toBe(run.gitSha);
      expect(outcomeReport.dateToken).toBe(run.dateToken);
    });
  });

  describe("credential 누출 0(branch — §9 / R-59 / REQ-059 정합)", () => {
    it("(o) descriptor.title/marker/body · outcomeReport.url/summaryLine 어디에도 token/secret/PAT/--auth 어휘 미등장", () => {
      const { descriptor, outcomeReport } = runChain();

      const surfaces = [
        descriptor.title,
        descriptor.marker,
        descriptor.body,
        outcomeReport.url,
        outcomeReport.summaryLine,
      ];
      for (const surface of surfaces) {
        expect(surface).not.toContain("--token");
        expect(surface).not.toContain("--auth");
        expect(surface).not.toContain("GITHUB_TOKEN");
        expect(surface).not.toContain("GH_TOKEN");
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
});
