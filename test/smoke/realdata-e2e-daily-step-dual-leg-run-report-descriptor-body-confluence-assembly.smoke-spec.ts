// realdata-e2e-daily-step-dual-leg-run-report-descriptor-body-confluence-assembly.smoke-spec.ts —
// 실 평가 e2e daily-step dual-leg run report → descriptor body 2-블록 confluence 조립
// 체인 non-gated build-time smoke (T-0915 박제, PLAN.md 109행 🟢 실 평가 e2e step ④).
//
// 본 spec 의 존재 이유 — descriptor body 안 confluence gap 해소(요약 축 T-0750 mirror):
//   - PLAN 109행 step ④(daily-test dual-leg run 결과 rolling-issue 박제) 경계의 종단
//     descriptor 빌더 `buildRealDataDailyStepDualLegRunReportIssueDescriptor(report)`
//     (T-0896)는 이슈 본문 `body` 를 **2 블록 confluence** 로 합성한다 —
//     `[marker, "", renderRealDataDailyStepDualLegRunReportMarkdown(report)].join("\n")`.
//     즉 멱등 marker(동일 run → 동일)와 마크다운 렌더(T-0895)가 **같은 report 로부터
//     동시에** descriptor body 안으로 합류하는 confluence 지점이다. (요약 축 T-0750 은
//     marker+line+markdown 3-블록이었으나, dual-leg 축은 별도 line 렌더러가 없고
//     summaryLine 이 markdown 안에 내장돼 있어 2-블록이다.)
//   - publish forward(T-0912)·round-trip(T-0913) smoke 는 descriptor 를 import 하지만
//     마크다운 렌더러를 직접 import 하지 않고 descriptor.body 를 쪼개 markdown 블록 ↔
//     직접 렌더 결과 byte-identical 을 단언하지 않는다. 반대로 markdown-assembly(T-0914)
//     smoke 는 렌더러를 import 하지만 descriptor 를 import 하지 않아 descriptor body 안
//     합류를 보지 못한다. 본 spec 이 그 confluence gap 을 public CI 그물로 박제한다 —
//     (evalOutcome, collectOutcome, run) → buildRealDataDailyStepDualLegRunReport →
//     buildRealDataDailyStepDualLegRunReportIssueDescriptor 종단 2-컴포저 chain 으로
//     descriptor body 의 marker↔markdown 단일-source 합류를 종결한다.
//   - nightly 의 실 jest spawn(eval leg + collect leg)은 복제하지 않고, 두 leg 의 run
//     outcome 을 synthetic literal 로 직접 공급한다. 따라서 본 spec 은:
//
//      🔥 실 LLM 호출 0 — orchestrator / scoring service / gateway 미사용. synthetic
//         leg outcome literal 을 조립 체인 첫 단계에 직접 공급.
//      🔥 실 네트워크 호출 0 — github / Ollama / gh 실행 0. fetch 0. process.env 읽기 0.
//      🔥 실 gh 실행 0 — issue create / edit 실 실행 0. 순수 descriptor 문자열 조립만.
//      🔥 credential 0 / secret 0 / DB 0 / 비용 0 — public CI 에서 항상 green 발화(R-113).
//      🔥 새 외부 dependency 0 — 기존 build*/render* 컴포저 import 재사용만
//         (consistency-guard·helper 신설 금지 — sweep 종결, T-0911).
//      🔥 gating / describe.skip / env-gating 배선 0 — 순수 build-time in-memory 검증만.
//
// Out of Scope (T-0915):
//   - T-0914(markdown 고립)·T-0912/T-0913(publish 조립) 의 기존 단언 중복 복제 — 본 spec 은
//     descriptor body 안 **confluence**(marker↔markdown 합류·단일 source·블록 순서/구분
//     무결성)만 책임(별개 파일, file-disjoint).
//   - 실 LLM round-trip / 실 github 네트워크 / 실 gh issue create·edit·comment 실행
//     (step ④ live wiring — credential gate).
//   - 새 컴포저 / 가드 / helper / type 신설 — 기존 build*/render* 컴포저 import 재사용만.
//   - dual-leg 축 컴포저·렌더러·descriptor 소스
//     (test/helpers/realdata-e2e-daily-step-dual-leg-run-report*.ts) 수정 — read-only 검증 대상.
//   - title·marker identity 정합(별도 가드 영역)·command-args / search-argv / action
//     resolver 후속 leg / production src/ 코드 변경 — 본 task 범위 밖.
import {
  buildRealDataDailyStepDualLegRunReport,
  type RealDataDailyStepLegRunOutcome,
} from "../helpers/realdata-e2e-daily-step-dual-leg-run-report";
import { buildRealDataDailyStepDualLegRunReportIssueDescriptor } from "../helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-descriptor";
import { renderRealDataDailyStepDualLegRunReportMarkdown } from "../helpers/realdata-e2e-daily-step-dual-leg-run-report-markdown";
import type { RealDataResultIssueRunRef } from "../helpers/realdata-e2e-result-issue-descriptor";

// 본 smoke 공통 fixture — 결정론 run 식별자(gitSha + dateToken 비공백). 매 it 가
// validRun() 으로 spread 복제를 받아 입력 RUN_REF mutate 누설 0.
const RUN_REF: RealDataResultIssueRunRef = {
  gitSha: "abc1234",
  dateToken: "2026-07-11",
};

// 입력 RUN_REF 의 무공유 복제본을 반환 — happy/flow/결정론 case 의 공통 진입.
function validRun(): RealDataResultIssueRunRef {
  return { ...RUN_REF };
}

// synthetic leg outcome fixture — eval / collect 각 leg 의 run outcome literal. 조립
// 체인은 leg outcome 을 report → descriptor 로 흘려보내는 confluence surface 만
// 검증하므로, 도메인 타입 정합(leg 라벨·action·passed 정합)만 만족하는 minimal literal 로
// 충분하다.
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

// assembleViaChain — 본 smoke 의 종단 조립 진입. outcome+run → report → descriptor 한 호출.
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
  return { report, descriptor };
}

// body 2-블록 분해 — descriptor.body 는 `[marker, "", markdown].join("\n")` 구조다.
// marker 는 단일 라인(개행 0)이고 markdown 은 다행이므로, 줄 단위로 쪼개면 index
// 0=marker, 1="", 2+ = markdown 라인들이다. 이 구조를 single source 로 추출해 markdown
// 블록을 직접 renderer 결과와 byte-identical 대조한다.
function splitBodyBlocks(body: string): {
  markerLine: string;
  firstBlank: string;
  markdownBlock: string;
} {
  const lines = body.split("\n");
  return {
    markerLine: lines[0],
    firstBlank: lines[1],
    markdownBlock: lines.slice(2).join("\n"),
  };
}

describe("Smoke(non-gated): 실 평가 e2e dual-leg run report → descriptor body 2-블록 confluence 조립 체인(outcome→report→descriptor) live-LLM 0·gh 실행 0 검증", () => {
  describe("happy path — 종단 조립 descriptor body 산출", () => {
    it("유효 두 leg outcome + 유효 run → descriptor.body 가 string·non-empty 이고 marker 라인을 정확히 1 회 포함(멱등 search-or-update 기반, 중복 0)", () => {
      const { descriptor } = assembleViaChain(
        evalLeg("run", true),
        collectLeg("run", true),
        validRun(),
      );

      expect(typeof descriptor.body).toBe("string");
      expect(descriptor.body.length).toBeGreaterThan(0);
      // marker 가 body 에 정확히 1 회 등장(멱등 — 중복 0).
      expect(descriptor.body).toContain(descriptor.marker);
      expect(descriptor.body.split(descriptor.marker)).toHaveLength(2);
    });
  });

  describe("confluence — markdown 블록 단일 source(descriptor body 안 markdown ↔ renderRealDataDailyStepDualLegRunReportMarkdown(report))", () => {
    it("body 의 markdown 블록이 동일 report 의 직접 renderRealDataDailyStepDualLegRunReportMarkdown(report) 결과와 byte-identical(같은 report 단일 source thread)", () => {
      const { report, descriptor } = assembleViaChain(
        evalLeg("run", true),
        collectLeg("run", false),
        validRun(),
      );
      const directMarkdown =
        renderRealDataDailyStepDualLegRunReportMarkdown(report);
      const { markdownBlock } = splitBodyBlocks(descriptor.body);

      // body 안의 markdown 블록이 직접 renderer 산출과 byte-identical(가공 0 합성).
      expect(markdownBlock).toBe(directMarkdown);
      // markdown 블록이 body 끝에 정확히 위치 — 잔여 가공 0.
      expect(descriptor.body.endsWith(directMarkdown)).toBe(true);
      // markdown 블록이 body 안에서 정확히 1 회 등장(중복 0).
      expect(descriptor.body.split(directMarkdown)).toHaveLength(2);
    });
  });

  describe("블록 순서·구분 무결성 — body 가 [marker, '', markdown].join('\\n') 구조", () => {
    it("body 가 marker → 빈 줄 → markdown 순서이며 각 블록이 빈 줄 1 개로 구분됨(순서/구분자 회귀 가드). marker 는 body 최상단에 정확히 1 회", () => {
      const { report, descriptor } = assembleViaChain(
        evalLeg("run", true),
        collectLeg("run", true),
        validRun(),
      );
      const blocks = splitBodyBlocks(descriptor.body);

      // index 0 = marker, 1 = 빈 줄, 2+ = markdown.
      expect(blocks.markerLine).toBe(descriptor.marker);
      expect(blocks.firstBlank).toBe("");
      expect(blocks.markdownBlock).toBe(
        renderRealDataDailyStepDualLegRunReportMarkdown(report),
      );

      // 종단 조립 body 가 동일 구조의 직접 재합성과 byte-identical(구조 single source).
      const expectedBody = [
        descriptor.marker,
        "",
        renderRealDataDailyStepDualLegRunReportMarkdown(report),
      ].join("\n");
      expect(descriptor.body).toBe(expectedBody);
    });

    it("marker 직후가 빈 줄, 그 뒤가 markdown 헤더 — marker 와 markdown 사이에 정확히 빈 줄 1 개(구분자 무결성, 빈 줄 2 개 연속 아님)", () => {
      const { descriptor } = assembleViaChain(
        evalLeg("skip"),
        collectLeg("run", true),
        validRun(),
      );
      const lines = descriptor.body.split("\n");

      expect(lines[0]).toBe(descriptor.marker);
      expect(lines[1]).toBe("");
      // markdown 첫 줄(헤더)은 비어있지 않음(빈 줄 2 개 연속 아님).
      expect(lines[2].length).toBeGreaterThan(0);
    });
  });

  describe("단일 source 교차 단언 — 중간 report 단일 source(직접 renderer 통과 블록 ↔ body 내 markdown 블록 일치)", () => {
    it("report 를 한 번만 만들어 직접 렌더러에 통과시킨 markdown 이 descriptor body 내 markdown 블록과 일치(중간 report 단일 source)", () => {
      const run = validRun();

      // report 를 한 번만 생성 — 직접 renderer 와 descriptor 가 같은 source.
      const report = buildRealDataDailyStepDualLegRunReport(
        evalLeg("run", true),
        collectLeg("skip"),
        run,
      );
      const directMarkdown =
        renderRealDataDailyStepDualLegRunReportMarkdown(report);
      const descriptor =
        buildRealDataDailyStepDualLegRunReportIssueDescriptor(report);

      const { markdownBlock } = splitBodyBlocks(descriptor.body);
      expect(markdownBlock).toBe(directMarkdown);
    });

    it("동일 (evalOutcome, collectOutcome, run) 두 번 조립 시 descriptor.body 결정론 동일(byte-identical)", () => {
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

      expect(a.descriptor.body).toBe(b.descriptor.body);
    });
  });

  describe("flow / branch — overallStatus 분기(all-pass·some-fail·all-skip·partial) 각각 confluence 성립", () => {
    it("(i) eval=pass·collect=pass → all-pass 분기에서 markdown 블록이 직접 렌더와 일치 + overall status 전파", () => {
      const { report, descriptor } = assembleViaChain(
        evalLeg("run", true),
        collectLeg("run", true),
        validRun(),
      );
      const { markdownBlock } = splitBodyBlocks(descriptor.body);

      expect(report.overallStatus).toBe("all-pass");
      expect(markdownBlock).toBe(
        renderRealDataDailyStepDualLegRunReportMarkdown(report),
      );
      expect(descriptor.body).toContain("- overall status: all-pass");
    });

    it("(ii) eval=pass·collect=fail → some-fail 분기에서 markdown 블록이 직접 렌더와 일치 + overall status 전파", () => {
      const { report, descriptor } = assembleViaChain(
        evalLeg("run", true),
        collectLeg("run", false),
        validRun(),
      );
      const { markdownBlock } = splitBodyBlocks(descriptor.body);

      expect(report.overallStatus).toBe("some-fail");
      expect(markdownBlock).toBe(
        renderRealDataDailyStepDualLegRunReportMarkdown(report),
      );
      expect(descriptor.body).toContain("- overall status: some-fail");
    });

    it("(iii) eval=skip·collect=skip → all-skip 분기에서 markdown 블록이 직접 렌더와 일치 + overall status 전파", () => {
      const { report, descriptor } = assembleViaChain(
        evalLeg("skip"),
        collectLeg("skip"),
        validRun(),
      );
      const { markdownBlock } = splitBodyBlocks(descriptor.body);

      expect(report.overallStatus).toBe("all-skip");
      expect(markdownBlock).toBe(
        renderRealDataDailyStepDualLegRunReportMarkdown(report),
      );
      expect(descriptor.body).toContain("- overall status: all-skip");
    });

    it("(iv) eval=skip·collect=pass → partial 분기에서 markdown 블록이 직접 렌더와 일치 + overall status 전파", () => {
      const { report, descriptor } = assembleViaChain(
        evalLeg("skip"),
        collectLeg("run", true),
        validRun(),
      );
      const { markdownBlock } = splitBodyBlocks(descriptor.body);

      expect(report.overallStatus).toBe("partial");
      expect(markdownBlock).toBe(
        renderRealDataDailyStepDualLegRunReportMarkdown(report),
      );
      expect(descriptor.body).toContain("- overall status: partial");
    });
  });

  describe("error path / negative — 예외 상황 분기마다 cover(위임 guard 전파, 자체 try/catch 0)", () => {
    it("(1) 빈 run.gitSha → 조립 첫 단계(build) guard throw 로 descriptor 조립 미도달", () => {
      expect(() =>
        assembleViaChain(evalLeg("run", true), collectLeg("run", true), {
          gitSha: "",
          dateToken: RUN_REF.dateToken,
        }),
      ).toThrow();
    });

    it("(1) 공백만의 run.gitSha → build guard throw 전파", () => {
      expect(() =>
        assembleViaChain(evalLeg("run", true), collectLeg("run", true), {
          gitSha: "   ",
          dateToken: RUN_REF.dateToken,
        }),
      ).toThrow();
    });

    it("(2) 빈 run.dateToken → 조립 첫 단계(build) guard throw 로 descriptor 조립 미도달", () => {
      expect(() =>
        assembleViaChain(evalLeg("run", true), collectLeg("run", true), {
          gitSha: RUN_REF.gitSha,
          dateToken: "",
        }),
      ).toThrow();
    });

    it("(2) 공백만의 run.dateToken → build guard throw 전파", () => {
      expect(() =>
        assembleViaChain(evalLeg("run", true), collectLeg("run", true), {
          gitSha: RUN_REF.gitSha,
          dateToken: "   ",
        }),
      ).toThrow();
    });

    it("(3) leg 라벨 mislabel(eval 자리에 collect outcome) → build leg-label guard throw 로 descriptor 미도달", () => {
      expect(() =>
        assembleViaChain(
          collectLeg("run", true),
          collectLeg("run", true),
          validRun(),
        ),
      ).toThrow();
    });

    it("(3) leg 라벨 mislabel(collect 자리에 eval outcome) → build leg-label guard throw", () => {
      expect(() =>
        assembleViaChain(
          evalLeg("run", true),
          evalLeg("run", true),
          validRun(),
        ),
      ).toThrow();
    });

    it("(4) raw narrative / credential / specPath echo 누출 0 — synthetic 입력에 sentinel specPath 를 넣어도 body 에 미등장(R-59/REQ-032, 안정 marker·enum·고정 골격만)", () => {
      const sentinel = "SENTINEL_RAW_LEAK_PROBE_T_0915";
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

      const { descriptor } = assembleViaChain(
        evalOutcome,
        collectOutcome,
        validRun(),
      );

      // specPath 는 report 로 전파 0 → body 에 sentinel·specPath·credential 어휘 미등장.
      expect(descriptor.body).not.toContain(sentinel);
      expect(descriptor.body).not.toContain("specPath");
      expect(descriptor.body).not.toContain(".spec.ts");
      expect(descriptor.body.toLowerCase()).not.toContain("secret");
    });
  });

  describe("결정론 · 무공유 · no-mutation — 동일 입력 반복 조립 + 입력 불변", () => {
    it("동일 (evalOutcome, collectOutcome, run) 반복 조립이 body byte-identical(결정론 — 입력만의 함수)", () => {
      expect(
        assembleViaChain(
          evalLeg("run", true),
          collectLeg("run", true),
          validRun(),
        ).descriptor.body,
      ).toBe(
        assembleViaChain(
          evalLeg("run", true),
          collectLeg("run", true),
          validRun(),
        ).descriptor.body,
      );
    });

    it("중간 report 객체(및 하위 eval/collect)가 매 호출 새 참조(무공유)", () => {
      const reportA = buildRealDataDailyStepDualLegRunReport(
        evalLeg("run", true),
        collectLeg("run", true),
        validRun(),
      );
      const reportB = buildRealDataDailyStepDualLegRunReport(
        evalLeg("run", true),
        collectLeg("run", true),
        validRun(),
      );
      expect(reportA).toEqual(reportB);
      expect(reportA).not.toBe(reportB);
      expect(reportA.eval).not.toBe(reportB.eval);
      expect(reportA.collect).not.toBe(reportB.collect);
    });

    it("조립이 입력 evalOutcome / collectOutcome / run 객체를 mutate 하지 않음(before/after deep-equal 스냅샷 비교)", () => {
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
