// realdata-e2e-daily-step-dual-leg-run-report-run-identity-cross-surface-convergence-assembly.smoke-spec.ts —
// 실 평가 e2e daily-step dual-leg run report 의 run 식별 토큰(${dateToken}@${gitSha})이
// 식별/검색 표면(descriptor.title·marker)과 사람 표면(report.summaryLine)에 **동일 단일
// source 로 수렴**함을 종단 조립 체인으로 박제하는 non-gated build-time smoke (T-0917 박제,
// PLAN.md 109행 🟢 실 평가 e2e step ④).
//
// 본 spec 의 존재 이유 — 두 run-token 표면 cross-surface 수렴 gap 해소(요약 축 T-0763/T-0768 mirror):
//   - PLAN 109행 step ④(daily-test dual-leg run 결과 rolling-issue 박제) 경계는 하나의
//     `run`(`RealDataResultIssueRunRef{gitSha, dateToken}`) 단일 source 로부터 run 식별
//     토큰 `${run.dateToken}@${run.gitSha}` 를 파생해 **서로 다른 두 표면** 에 동시에 박는다:
//       1. 식별/검색 표면 — `buildRealDataDailyStepDualLegRunReportIssueDescriptor(report)`
//          (T-0896)의 `descriptor.title`·`descriptor.marker`. 이 run-token 은 멱등
//          search-or-update 의 기반(동일 run → 동일 marker → 같은 이슈 갱신, REQ-009).
//       2. 사람 표면 — `buildRealDataDailyStepDualLegRunReport(...)`(T-0894) 산출
//          `report.summaryLine = [${dateToken}@${gitSha}] eval=... collect=... → ...`.
//          이슈 본문 상단·journal/log·CI stdout 에 노출되는 사람-친화 run 식별 라인이며,
//          `renderRealDataDailyStepDualLegRunReportMarkdown(report)`(T-0895)가 `- summary:`
//          로 본문에 내장한다(REQ-037 재실행 정합).
//   - 형제 smoke 들은 각 표면 **내부**만 닫았다: T-0916 은 title↔marker(식별 표면 내부),
//     T-0914 은 summaryLine→markdown(사람 표면 내부), T-0915 은 descriptor.body 2-블록.
//     그러나 **descriptor.marker 의 run-token 과 report.summaryLine 의 run-token 이 동일
//     `${run.dateToken}@${run.gitSha}` 단일 source 로 수렴하는지**·**두 표면이 run drift 에
//     함께 이동하는지(표면-분열 방지)**·**run-token 순서(dateToken@gitSha, 역전 아님)가 두
//     표면에서 일치하는지** 는 부재다. 본 spec 이 그 cross-surface 수렴 gap 을 public CI
//     그물로 박제해, 두 run-token 표면(식별 ↔ 사람)을 교차-봉합한다.
//   - nightly 의 실 jest spawn(eval leg + collect leg)은 복제하지 않고, 두 leg 의 run
//     outcome 을 synthetic literal 로 직접 공급한다. 따라서 본 spec 은:
//
//      🔥 실 LLM 호출 0 — orchestrator / scoring service / gateway 미사용. synthetic
//         leg outcome literal 을 조립 체인 첫 단계에 직접 공급.
//      🔥 실 네트워크 호출 0 — github / Ollama / gh 실행 0. fetch 0. process.env 읽기 0.
//      🔥 실 gh 실행 0 — issue create / edit 실 실행 0. 순수 report/descriptor/markdown 조립만.
//      🔥 credential 0 / secret 0 / DB 0 / 비용 0 — public CI 에서 항상 green 발화(R-113).
//      🔥 새 외부 dependency 0 — 기존 build*/render* 컴포저 import 재사용만(helper 신설 0).
//      🔥 gating / describe.skip / env-gating 배선 0 — 순수 build-time in-memory 검증만.
//      🔥 ISSUE_TITLE_PREFIX / ISSUE_MARKER_PREFIX / summaryLine prefix 는 private(export 0) —
//         literal prefix 하드코딩 대신 run-token 경계 split 로 **구조적 단언**만 한다.
//
// Out of Scope (T-0917):
//   - descriptor identity 내부(T-0916, title↔marker)·markdown 내부(T-0914, summaryLine→markdown)·
//     body 2-블록(T-0915)의 재검증 — 본 task 는 식별 표면 ↔ 사람 표면의 run-token
//     cross-surface 수렴만 책임(각 표면 내부 정합은 이미 닫힘, 중복 단언 0).
//   - 실 LLM round-trip / 실 github 네트워크 / 실 gh issue create·edit·comment 실행
//     (step ④ live wiring — credential gate).
//   - 새 컴포저 / 가드 / helper / type 신설 — 기존 build*/render* import 재사용만.
//   - dual-leg 축 컴포저·렌더러·descriptor 소스
//     (test/helpers/realdata-e2e-daily-step-dual-leg-run-report*.ts) 수정 — read-only 검증 대상.
//   - ISSUE_TITLE_PREFIX / ISSUE_MARKER_PREFIX / summaryLine prefix 를 export 로 바꾸거나
//     literal 비교 — private 유지, 구조적(run-token 경계 split) 단언만.
//   - command-args / search-argv / action resolver / output-parse 경유 marker 전파 —
//     publish-assembly(T-0912)·round-trip(T-0913) 커버, 본 task 범위 밖.
import {
  buildRealDataDailyStepDualLegRunReport,
  type RealDataDailyStepLegRunOutcome,
} from "../helpers/realdata-e2e-daily-step-dual-leg-run-report";
import { buildRealDataDailyStepDualLegRunReportIssueDescriptor } from "../helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-descriptor";
import { renderRealDataDailyStepDualLegRunReportMarkdown } from "../helpers/realdata-e2e-daily-step-dual-leg-run-report-markdown";
import type { RealDataResultIssueRunRef } from "../helpers/realdata-e2e-result-issue-descriptor";

// 본 smoke 공통 fixture — 결정론 run 식별자(gitSha + dateToken 비공백). gitSha 와
// dateToken 은 서로 substring 이 아닌 구별 가능한 값(run-token 순서 오검출 회피). 매 it 가
// validRun() 으로 spread 복제를 받아 입력 RUN_REF mutate 누설 0.
const RUN_REF: RealDataResultIssueRunRef = {
  gitSha: "abc1234",
  dateToken: "2026-07-11",
};

// 입력 RUN_REF 의 무공유 복제본 — happy/flow/결정론 case 의 공통 진입.
function validRun(): RealDataResultIssueRunRef {
  return { ...RUN_REF };
}

// 합성 run-token — 컴포저/descriptor 내부 규칙(`${dateToken}@${gitSha}`)과 동일하게 test
// 측에서 재유도한 expected 공유 substring. literal prefix 는 private 이라 만지지 않고, 이
// token 만 title·marker·summaryLine 세 표면에 등장(수렴)함을 구조적으로 단언한다.
function expectedToken(run: RealDataResultIssueRunRef): string {
  return `${run.dateToken}@${run.gitSha}`;
}

// 역전 run-token — `${gitSha}@${dateToken}`. 세 표면 어디에도 등장하면 순서 회귀.
function reversedToken(run: RealDataResultIssueRunRef): string {
  return `${run.gitSha}@${run.dateToken}`;
}

// synthetic leg outcome fixture — eval / collect 각 leg 의 run outcome literal. 조립
// 체인은 leg outcome 을 report → {descriptor, markdown} 로 흘려보내는 cross-surface
// 만 검증하므로, 도메인 타입 정합(leg 라벨·action·passed 정합)만 만족하는 minimal
// literal 로 충분하다.
function evalLeg(
  action: "run" | "skip",
  passed?: boolean,
): RealDataDailyStepLegRunOutcome {
  return passed === undefined
    ? { leg: "eval", action }
    : { leg: "eval", action, passed };
}

function collectLeg(
  action: "run" | "skip",
  passed?: boolean,
): RealDataDailyStepLegRunOutcome {
  return passed === undefined
    ? { leg: "collect", action }
    : { leg: "collect", action, passed };
}

// assembleViaChain — 본 smoke 의 종단 조립 진입. outcome+run → report → {descriptor,
// markdown} 한 호출. 세 run-token 표면(descriptor.title·marker / report.summaryLine)을
// 한 번에 뽑아 cross-surface 수렴을 대조한다.
function assembleViaChain(
  evalOutcome: RealDataDailyStepLegRunOutcome,
  collectOutcome: RealDataDailyStepLegRunOutcome,
  run: RealDataResultIssueRunRef,
) {
  const report = buildRealDataDailyStepDualLegRunReport(
    evalOutcome,
    collectOutcome,
    run,
  );
  const descriptor =
    buildRealDataDailyStepDualLegRunReportIssueDescriptor(report);
  const markdown = renderRealDataDailyStepDualLegRunReportMarkdown(report);
  return { report, descriptor, markdown };
}

// splitOnce — 대상 문자열을 token 경계로 쪼갠 조각. token 이 정확히 1 회 등장하면 length 2.
function splitOnce(surface: string, token: string): string[] {
  return surface.split(token);
}

describe("Smoke(non-gated): 실 평가 e2e dual-leg run report → run-token(${dateToken}@${gitSha}) 단일 source cross-surface(descriptor.title·marker ↔ report.summaryLine) 수렴 조립 체인(outcome→report→{descriptor,markdown}) live-LLM 0·gh 실행 0 검증", () => {
  describe("happy path — 세 표면(title·marker·summaryLine)이 동일 run-token 을 thread", () => {
    it("유효 두 leg outcome + 유효 run → descriptor.title·descriptor.marker·report.summaryLine 이 모두 합성 run-token(${dateToken}@${gitSha})을 toContain(단일 source 수렴)", () => {
      const run = validRun();
      const token = expectedToken(run);

      const { report, descriptor } = assembleViaChain(
        evalLeg("run", true),
        collectLeg("run", true),
        run,
      );

      expect(typeof descriptor.title).toBe("string");
      expect(typeof descriptor.marker).toBe("string");
      expect(typeof report.summaryLine).toBe("string");
      // 세 표면이 같은 합성 run-token 을 담는다(단일 source).
      expect(descriptor.title).toContain(token);
      expect(descriptor.marker).toContain(token);
      expect(report.summaryLine).toContain(token);
    });

    it("세 표면 각각에서 run-token 이 정확히 1 회 등장(.split(token) 결과 length 2 — 표면 내 중복/누락 0)", () => {
      const run = validRun();
      const token = expectedToken(run);

      const { report, descriptor } = assembleViaChain(
        evalLeg("run", true),
        collectLeg("skip"),
        run,
      );

      expect(splitOnce(descriptor.title, token)).toHaveLength(2);
      expect(splitOnce(descriptor.marker, token)).toHaveLength(2);
      expect(splitOnce(report.summaryLine, token)).toHaveLength(2);
    });
  });

  describe("cross-surface 단일 source 수렴(핵심) — 식별 표면(marker) ↔ 사람 표면(summaryLine) run-token 합류", () => {
    it("동일 run 으로 descriptor.marker 와 report.summaryLine 에서 추출한 run-token 이 byte-identical(===) + 둘 다 ${dateToken}@${gitSha} 와 일치(2-표면 수렴)", () => {
      const run = validRun();
      const token = expectedToken(run);

      const { report, descriptor } = assembleViaChain(
        evalLeg("run", true),
        collectLeg("run", false),
        run,
      );

      // 각 표면이 token 을 정확히 1 회 담는다.
      const markerParts = splitOnce(descriptor.marker, token);
      const summaryParts = splitOnce(report.summaryLine, token);
      expect(markerParts).toHaveLength(2);
      expect(summaryParts).toHaveLength(2);

      // 두 표면에서 추출한 token(= 원문에서 각 조각을 제거하고 남은 공유 substring)이 동일.
      const markerToken = descriptor.marker.slice(
        markerParts[0].length,
        markerParts[0].length + token.length,
      );
      const summaryToken = report.summaryLine.slice(
        summaryParts[0].length,
        summaryParts[0].length + token.length,
      );
      expect(markerToken).toBe(summaryToken);
      // 둘 다 단일 source ${dateToken}@${gitSha} 와 일치.
      expect(markerToken).toBe(token);
      expect(summaryToken).toBe(token);
    });

    it("descriptor.title 도 동일 run-token 을 담아 3-표면(title·marker·summaryLine)이 같은 단일 source 로 수렴", () => {
      const run = validRun();
      const token = expectedToken(run);

      const { report, descriptor } = assembleViaChain(
        evalLeg("run", true),
        collectLeg("run", true),
        run,
      );

      // 세 표면 모두 token 을 정확히 1 회 담고, 제거 후 공유 substring 이 동일 token.
      for (const surface of [
        descriptor.title,
        descriptor.marker,
        report.summaryLine,
      ]) {
        const parts = splitOnce(surface, token);
        expect(parts).toHaveLength(2);
        const extracted = surface.slice(
          parts[0].length,
          parts[0].length + token.length,
        );
        expect(extracted).toBe(token);
      }
    });
  });

  describe("run-token 순서 정합 — 세 표면 모두 dateToken@gitSha(역전 아님)", () => {
    it("token 내부에서 dateToken 이 gitSha 보다 앞(indexOf) + 세 표면이 ${dateToken}@${gitSha} 를 담고 역전 ${gitSha}@${dateToken} 은 담지 않음", () => {
      // gitSha·dateToken 이 서로 substring 이 아닌 구별 가능한 fixture(순서 오검출 회피).
      const run: RealDataResultIssueRunRef = {
        gitSha: "deadbee",
        dateToken: "2026-07-11",
      };
      const token = expectedToken(run);
      const reversed = reversedToken(run);

      const { report, descriptor } = assembleViaChain(
        evalLeg("run", true),
        collectLeg("run", true),
        run,
      );

      // token 자체가 dateToken@gitSha 순서.
      expect(token.indexOf(run.dateToken)).toBeLessThan(
        token.indexOf(run.gitSha),
      );

      for (const surface of [
        descriptor.title,
        descriptor.marker,
        report.summaryLine,
      ]) {
        expect(surface).toContain(token);
        expect(surface).not.toContain(reversed);
      }
    });
  });

  describe("run drift 함께-이동(표면-분열 방지) — 두 표면이 새 run 으로 함께 이동", () => {
    it("(a) 다른 gitSha(dateToken 동일) → marker·summaryLine 이 함께 새 ${dateToken}@${newGitSha} 로 이동(어느 표면도 stale token 미보유)", () => {
      const oldRun: RealDataResultIssueRunRef = {
        gitSha: "old0001",
        dateToken: "2026-07-11",
      };
      const newRun: RealDataResultIssueRunRef = {
        gitSha: "new0002",
        dateToken: "2026-07-11",
      };
      const oldToken = expectedToken(oldRun);
      const newToken = expectedToken(newRun);

      const { report, descriptor } = assembleViaChain(
        evalLeg("run", true),
        collectLeg("run", true),
        newRun,
      );

      // 두 표면 모두 새 token 을 담고, stale(old) token 은 담지 않음(함께 이동).
      expect(descriptor.marker).toContain(newToken);
      expect(report.summaryLine).toContain(newToken);
      expect(descriptor.marker).not.toContain(oldToken);
      expect(report.summaryLine).not.toContain(oldToken);
    });

    it("(b) 다른 dateToken(gitSha 동일) → marker·summaryLine 이 함께 새 ${newDateToken}@${gitSha} 로 이동(날짜 축 drift 도 함께 이동)", () => {
      const oldRun: RealDataResultIssueRunRef = {
        gitSha: "same9999",
        dateToken: "2026-07-10",
      };
      const newRun: RealDataResultIssueRunRef = {
        gitSha: "same9999",
        dateToken: "2026-07-11",
      };
      const oldToken = expectedToken(oldRun);
      const newToken = expectedToken(newRun);

      const { report, descriptor } = assembleViaChain(
        evalLeg("run", true),
        collectLeg("run", true),
        newRun,
      );

      expect(descriptor.marker).toContain(newToken);
      expect(report.summaryLine).toContain(newToken);
      expect(descriptor.marker).not.toContain(oldToken);
      expect(report.summaryLine).not.toContain(oldToken);
    });

    it("(c) 서로 다른 run 두 개 → run A 의 descriptor.marker run-token ≠ run B 의 report.summaryLine run-token(다른 run 의 표면 미혼입 — 분리 보장)", () => {
      const runA: RealDataResultIssueRunRef = {
        gitSha: "aaa1111",
        dateToken: "2026-07-11",
      };
      const runB: RealDataResultIssueRunRef = {
        gitSha: "bbb2222",
        dateToken: "2026-07-11",
      };
      const tokenA = expectedToken(runA);
      const tokenB = expectedToken(runB);

      const a = assembleViaChain(
        evalLeg("run", true),
        collectLeg("run", true),
        runA,
      );
      const b = assembleViaChain(
        evalLeg("run", true),
        collectLeg("run", true),
        runB,
      );

      // run A 의 marker 는 tokenA 만, run B 의 summaryLine 은 tokenB 만(교차 미혼입).
      expect(a.descriptor.marker).toContain(tokenA);
      expect(a.descriptor.marker).not.toContain(tokenB);
      expect(b.report.summaryLine).toContain(tokenB);
      expect(b.report.summaryLine).not.toContain(tokenA);
    });
  });

  describe("leg outcome-독립성 vs 의존성 분리 — 식별 표면(run 만) ↔ 사람 표면(run+leg)", () => {
    it("(a) 동일 run·서로 다른 leg outcome(eval=pass/collect=pass vs eval=fail/collect=skip) → descriptor.title·descriptor.marker 동일(식별 표면은 run 만의 함수)", () => {
      const run = validRun();

      const da = assembleViaChain(
        evalLeg("run", true),
        collectLeg("run", true),
        run,
      ).descriptor;
      const db = assembleViaChain(
        evalLeg("run", false),
        collectLeg("skip"),
        run,
      ).descriptor;

      expect(da.title).toBe(db.title);
      expect(da.marker).toBe(db.marker);
    });

    it("(b) 동일 run·서로 다른 leg outcome → report.summaryLine 의 run-token substring 은 동일하나 전체 문자열은 다름(사람 표면 = run-token + leg outcome 합성)", () => {
      const run = validRun();
      const token = expectedToken(run);

      const sa = assembleViaChain(
        evalLeg("run", true),
        collectLeg("run", true),
        run,
      ).report.summaryLine;
      const sb = assembleViaChain(
        evalLeg("run", false),
        collectLeg("skip"),
        run,
      ).report.summaryLine;

      // run-token substring 은 두 조합에서 동일.
      expect(sa).toContain(token);
      expect(sb).toContain(token);
      // 그러나 eval=/collect=/overallStatus 부분이 달라 전체 문자열은 다름.
      expect(sa).not.toBe(sb);
    });
  });

  describe("negative — run 결손 guard 전파(각 필드 독립 분기, 단일 negative 금지)", () => {
    it("(a-i) run.gitSha 빈 문자열 → 조립 첫 단계(build) gitSha guard throw 전파(자체 try/catch 0)", () => {
      expect(() =>
        assembleViaChain(evalLeg("run", true), collectLeg("run", true), {
          gitSha: "",
          dateToken: RUN_REF.dateToken,
        }),
      ).toThrow();
    });

    it("(a-ii) run.gitSha 공백만 → gitSha guard throw 전파(공백-only 분기)", () => {
      expect(() =>
        assembleViaChain(evalLeg("run", true), collectLeg("run", true), {
          gitSha: "   ",
          dateToken: RUN_REF.dateToken,
        }),
      ).toThrow();
    });

    it("(b-i) run.dateToken 빈 문자열 → dateToken guard throw 전파(gitSha 유효해도 — 필드별 독립 분기)", () => {
      expect(() =>
        assembleViaChain(evalLeg("run", true), collectLeg("run", true), {
          gitSha: RUN_REF.gitSha,
          dateToken: "",
        }),
      ).toThrow();
    });

    it("(b-ii) run.dateToken 공백만 → dateToken guard throw 전파(공백-only 분기)", () => {
      expect(() =>
        assembleViaChain(evalLeg("run", true), collectLeg("run", true), {
          gitSha: RUN_REF.gitSha,
          dateToken: "   ",
        }),
      ).toThrow();
    });
  });

  describe("flow / branch — raw specPath 누출 0 / overallStatus 각 분기에서 세 표면 run-token 불변", () => {
    it("(a) raw specPath / credential 누출 0 — synthetic leg outcome specPath 에 sentinel 주입해도 title·marker·summaryLine 어디에도 미등장(run-token 표면은 run 식별자+status 파생만 — R-59/REQ-059)", () => {
      const sentinel = "SENTINEL_RAW_LEAK_PROBE_T_0917";
      const evalOutcome: RealDataDailyStepLegRunOutcome = {
        leg: "eval",
        action: "run",
        passed: true,
        specPath: `${sentinel}/eval.spec.ts`,
      };
      const collectOutcome: RealDataDailyStepLegRunOutcome = {
        leg: "collect",
        action: "run",
        passed: true,
        specPath: `${sentinel}/collect.spec.ts`,
      };

      const { report, descriptor } = assembleViaChain(
        evalOutcome,
        collectOutcome,
        validRun(),
      );

      for (const surface of [
        descriptor.title,
        descriptor.marker,
        report.summaryLine,
      ]) {
        expect(surface).not.toContain(sentinel);
        expect(surface).not.toContain(".spec.ts");
        expect(surface.toLowerCase()).not.toContain("secret");
      }
    });

    // overallStatus 각 분기 → 동일 run 이면 세 표면의 run-token 불변(overallStatus 변화가
    // run-token 을 흔들지 않음). 분기마다 test 분리.
    const overallBranches: Array<{
      label: string;
      evalOutcome: RealDataDailyStepLegRunOutcome;
      collectOutcome: RealDataDailyStepLegRunOutcome;
      expected: string;
    }> = [
      {
        label: "all-pass(eval=pass·collect=pass)",
        evalOutcome: evalLeg("run", true),
        collectOutcome: collectLeg("run", true),
        expected: "all-pass",
      },
      {
        label: "some-fail(eval=pass·collect=fail)",
        evalOutcome: evalLeg("run", true),
        collectOutcome: collectLeg("run", false),
        expected: "some-fail",
      },
      {
        label: "all-skip(eval=skip·collect=skip)",
        evalOutcome: evalLeg("skip"),
        collectOutcome: collectLeg("skip"),
        expected: "all-skip",
      },
      {
        label: "partial(eval=skip·collect=pass)",
        evalOutcome: evalLeg("skip"),
        collectOutcome: collectLeg("run", true),
        expected: "partial",
      },
    ];

    for (const branch of overallBranches) {
      it(`(b) overallStatus ${branch.label} 분기 → 동일 run 이면 title·marker·summaryLine 이 모두 run-token 을 담아 불변(overallStatus 변화 무관)`, () => {
        const run = validRun();
        const token = expectedToken(run);

        const { report, descriptor } = assembleViaChain(
          branch.evalOutcome,
          branch.collectOutcome,
          run,
        );

        expect(report.overallStatus).toBe(branch.expected);
        expect(descriptor.title).toContain(token);
        expect(descriptor.marker).toContain(token);
        expect(report.summaryLine).toContain(token);
      });
    }
  });

  describe("결정론 · 무공유 · no-mutation — 동일 입력 반복 조립 + 입력 불변", () => {
    it("(f) 동일 (evalOutcome, collectOutcome, run) 두 번 chain → title·marker·summaryLine byte-identical + 매 호출 새 report/descriptor 객체(반환 참조 비동일)", () => {
      const a = assembleViaChain(
        evalLeg("run", true),
        collectLeg("run", false),
        validRun(),
      );
      const b = assembleViaChain(
        evalLeg("run", true),
        collectLeg("run", false),
        validRun(),
      );

      // 결정론 — 입력만의 함수.
      expect(a.descriptor.title).toBe(b.descriptor.title);
      expect(a.descriptor.marker).toBe(b.descriptor.marker);
      expect(a.report.summaryLine).toBe(b.report.summaryLine);
      // 무공유 — 매 호출 새 객체 참조.
      expect(a.report).not.toBe(b.report);
      expect(a.descriptor).not.toBe(b.descriptor);
    });

    it("(g) 조립이 입력 evalOutcome / collectOutcome / run 객체를 mutate 하지 않음(before/after deep-equal 스냅샷 비교)", () => {
      const evalOutcome = evalLeg("run", true);
      const collectOutcome = collectLeg("run", false);
      const run = validRun();
      const evalBefore = JSON.parse(JSON.stringify(evalOutcome));
      const collectBefore = JSON.parse(JSON.stringify(collectOutcome));
      const runBefore = JSON.parse(JSON.stringify(run));

      assembleViaChain(evalOutcome, collectOutcome, run);

      expect(evalOutcome).toEqual(evalBefore);
      expect(collectOutcome).toEqual(collectBefore);
      expect(run).toEqual(runBefore);
    });
  });
});
