// realdata-e2e-result-outcome-step-args-assembly.smoke-spec.ts — 실 평가 e2e
// result-outcome step-args 조립 체인 non-gated build-time smoke (T-0738 박제,
// PLAN.md 109행 🟢 실 평가 e2e).
//
// 본 spec 의 존재 이유 — public CI gap 해소(T-0737 publish-assembly smoke 의 post-실행
// 대칭 sibling):
//   - PLAN 109행 step ④ 결과 이슈 박제의 **post-실행** run-plan 연결은 순수 컴포저
//     `buildRealDataResultOutcomeStepArgs(runPlan, stdout)`(T-0600)가 닫는다 —
//     seed-side 최외곽 진입 `buildRealDataE2eRunPlan(seeds, modelId, run)`(T-0597)이
//     산출한 검증된 `runPlan.run`(gitSha + dateToken) 만을
//     `buildRealDataResultIssueOutcomeReportFromOutput(stdout, runPlan.run)`(T-0596)
//     로 thread 해, `gh issue create` / `gh issue edit` 의 stdout(이슈 URL) 으로부터
//     실행 리포트 `RealDataResultIssueOutcomeReport`
//     (`{issueNumber, url, gitSha, dateToken, summaryLine}`) 를 합성하면서 step①↔step④
//     post-실행 run 식별자 일관을 구조적으로 보장한다(run 재전달 0).
//   - 이 컴포저는 unit(`realdata-e2e-result-outcome-step-args.spec.ts`) +
//     consistency(`...-consistency.spec.ts`) spec 으로 닫혀 있으나, **seed→run-plan
//     →step④ post-실행 outcome-step-args 를 묶은 조립 체인 단위의 non-gated build-time
//     smoke** 는 부재였다 — sibling 조립 smoke(T-0728~T-0731/T-0736/T-0737)은 다른
//     composer family 또는 pre-실행 측(T-0737 publish-step-args)만 cover 한다.
//   - 본 spec 은 그 gap 을 메운다 — **gating 없이 항상 실행되는 일반 describe** 로
//     seed→run-plan→outcome-step-args 조립 surface 를 검증한다. live leg(실 LLM /
//     EvaluationOrchestratorService / LlmHttpGateway / Ollama / 실 github 수집 / 실 gh
//     issue create·edit / 실 jest spawn)는 복제하지 않고, gh stdout 을 synthetic literal
//     로 직접 공급해 step④ 실행 leg 를 우회한다(조립 surface 만 검증). 따라서 본 spec 은:
//
//      🔥 실 LLM 호출 0 — orchestrator / scoring service / gateway 미사용. synthetic
//         gh stdout literal 을 buildRealDataResultOutcomeStepArgs 에 직접 공급.
//      🔥 실 네트워크 호출 0 — github / Ollama / gh 호출 0. fetch 0. process.env 읽기 0.
//      🔥 실 DB 접근 0 / 실 jest spawn 0 — seed→run-plan→outcome-step-args 조립만.
//      🔥 credential 0 / secret 0 / 비용 0 — public CI 에서 항상 green 발화(R-113).
//      🔥 새 외부 dependency 0 — 기존 build* 컴포저 import 재사용만(consistency-guard
//         신설 금지 — sweep 종결, T-0726).
//      🔥 gating / describe.skip 배선 0 — 순수 build-time in-memory 검증만.
//
// Out of Scope (T-0738):
//   - 실 LLM round-trip / EvaluationOrchestratorService / LlmHttpGateway / Ollama 호출
//     — 본 spec 은 실행 leg 를 synthetic gh stdout literal 로 대체(실 평가·실 gh 0).
//     live leg 검증은 기존 realdata-e2e-live.smoke-spec.ts 책임.
//   - 실 github 네트워크 수집 / gh 실행 / 실 이슈 search·create·edit·박제 / 실 jest spawn.
//   - pre-실행 측 buildRealDataResultPublishStepArgs(T-0599)의 조립 smoke — T-0737 이
//     이미 cover(본 task 는 post-실행 outcome-step-args 만 책임).
//   - 새 컴포저 / 가드 / helper 신설 — 기존 build* 컴포저 import 재사용만.
//   - production src/ 코드 / 기존 컴포저 소스 / 위임 helper / consistency 가드 수정 —
//     test-only(신규 smoke spec 1 파일).
//   - T-0728/T-0729/T-0730/T-0731/T-0736/T-0737 의 기존 조립 smoke 파일 수정 —
//     file-disjoint 병렬 stream(본 task 는 신규 파일 추가만).
import type { RealDataResultIssueRunRef } from "../helpers/realdata-e2e-result-issue-descriptor";
import { buildRealDataResultIssueOutcomeReportFromOutput } from "../helpers/realdata-e2e-result-issue-outcome-report-from-output";
import { buildRealDataResultOutcomeStepArgs } from "../helpers/realdata-e2e-result-outcome-step-args";
import { buildRealDataE2eRunPlan } from "../helpers/realdata-e2e-run-plan";
import type { RealDataE2eRunPlan } from "../helpers/realdata-e2e-run-plan";
import { buildRealDataE2eSeed } from "../helpers/realdata-e2e-seed-fixture";

// 본 smoke 공통 fixture — 유효 modelId(비공백) 결정론 상수.
const MODEL_ID = "cfg-realdata-e2e-result-outcome-step-args-assembly-smoke";

// 본 smoke 공통 fixture — 결정론 run 식별자(gitSha + dateToken 비공백). 매 it 가
// runPlan 구성 시 spread 복제로 받아 입력 mutate 가 누설되지 않도록 한다.
const RUN_REF: RealDataResultIssueRunRef = {
  gitSha: "abc1234",
  dateToken: "2026-06-28",
};

// synthetic gh issue create/edit stdout literal — outcome-step-args 컴포저는 이 stdout
// 을 파싱(URL 추출·issueNumber 검증) → outcome → run 결합 → 실행 리포트로 흘려보내는
// surface 만 검증하므로, 실 `gh issue create`/`gh issue edit` round-trip 없이 정상 issue
// URL 한 줄(개행 포함)을 직접 주입한다. create / edit 양측 모두 동형의 URL stdout 을
// 산출하므로(다른 이슈 번호) 두 happy-path 를 분리한다.
const CREATE_STDOUT =
  "https://github.com/myungjoo/assessment-agent/issues/42\n";
const EDIT_STDOUT = "https://github.com/myungjoo/assessment-agent/issues/7\n";

// 유효 runPlan 을 결정론 seed + modelId + run 으로 조립하는 헬퍼 — happy/flow/결정론
// case 의 공통 진입. run 은 spread 복제로 넘겨 입력 RUN_REF mutate 누설 0.
function buildValidRunPlan(): RealDataE2eRunPlan {
  return buildRealDataE2eRunPlan(buildRealDataE2eSeed(), MODEL_ID, {
    ...RUN_REF,
  });
}

describe("Smoke(non-gated): 실 평가 e2e result-outcome step-args 조립 체인(seed→run-plan→outcome-step-args) live-LLM 0 검증", () => {
  describe("happy path — 조립된 outcome 실행 리포트 산출", () => {
    it("seed + 유효 modelId + 유효 run 으로 runPlan 구성 후 create stdout 과 함께 호출 → 5 필드 report 조립 + issueNumber 양의 정수 + url trim 정규화 + summaryLine 비공백", () => {
      // (1) seed→run-plan 으로 검증된 runPlan 구성(run 단일 source 진입).
      const runPlan = buildValidRunPlan();
      expect(runPlan.run.gitSha).toBe(RUN_REF.gitSha);
      expect(runPlan.run.dateToken).toBe(RUN_REF.dateToken);

      // (2) outcome-step-args 단일 진입 — runPlan.run 을 outcome report 로 thread.
      const report = buildRealDataResultOutcomeStepArgs(runPlan, CREATE_STDOUT);

      // 5 필드 모두 산출됨({ issueNumber, url, gitSha, dateToken, summaryLine } shape).
      expect(report.issueNumber).toBe(42);
      expect(Number.isInteger(report.issueNumber)).toBe(true);
      expect(report.issueNumber).toBeGreaterThan(0);

      // url 은 stdout URL 의 trim 정규화 반영(trailing 개행 제거).
      expect(report.url).toBe(
        "https://github.com/myungjoo/assessment-agent/issues/42",
      );

      // run 식별자 전파(runPlan.run 단일 source).
      expect(report.gitSha).toBe(RUN_REF.gitSha);
      expect(report.dateToken).toBe(RUN_REF.dateToken);

      // summaryLine 은 비어있지 않은 string(사람-친화 한 줄 요약).
      expect(typeof report.summaryLine).toBe("string");
      expect(report.summaryLine.length).toBeGreaterThan(0);
    });

    it("edit stdout(다른 이슈 번호) 과 함께 호출 → 동일 조립 경로로 issueNumber/url 반영된 report 산출", () => {
      const runPlan = buildValidRunPlan();
      const report = buildRealDataResultOutcomeStepArgs(runPlan, EDIT_STDOUT);

      expect(report.issueNumber).toBe(7);
      expect(report.url).toBe(
        "https://github.com/myungjoo/assessment-agent/issues/7",
      );
      expect(report.gitSha).toBe(RUN_REF.gitSha);
      expect(report.dateToken).toBe(RUN_REF.dateToken);
      expect(report.summaryLine.length).toBeGreaterThan(0);
    });
  });

  describe("run 단일 source 조립 단언 — runPlan.run 만 thread(재전달 0)", () => {
    it("조립 산출이 동일 stdout 을 buildRealDataResultIssueOutcomeReportFromOutput(stdout, runPlan.run) 로 직접 호출한 결과와 deep-equal(run 을 runPlan 에서만 thread)", () => {
      const runPlan = buildValidRunPlan();

      // 조립 체인 진입(runPlan.run 단일 source thread).
      const viaStepArgs = buildRealDataResultOutcomeStepArgs(
        runPlan,
        CREATE_STDOUT,
      );
      // 위임 대상을 runPlan.run 으로 직접 호출(single-source 재유도).
      const viaDelegate = buildRealDataResultIssueOutcomeReportFromOutput(
        CREATE_STDOUT,
        runPlan.run,
      );

      // 조립 체인이 run 을 재전달 없이 runPlan 에서만 thread 하므로 byte-identical.
      expect(viaStepArgs).toEqual(viaDelegate);

      // 산출 report 가 runPlan.run.gitSha / dateToken 을 반영함을 명시 확인 —
      // 두 산출이 같은 run 식별자에서 도출됨.
      expect(viaStepArgs.gitSha).toBe(runPlan.run.gitSha);
      expect(viaStepArgs.dateToken).toBe(runPlan.run.dateToken);
    });
  });

  describe("negative cases — runPlan.run 결손의 위임 guard 전파(자체 try/catch 0)", () => {
    // 직접 구성한 불완전 runPlan literal — buildRealDataE2eRunPlan 의 run guard 를
    // 우회해(정상 경로로는 빈 run 을 만들 수 없으므로) 불완전 run 을 step-args 컴포저에
    // 직접 주입한다. pipeline 은 유효 modelId 로 채워 run 결손만 고립 검증한다.
    const validPipeline = buildValidRunPlan().pipeline;

    it("runPlan.run.gitSha 빈 문자열 — 위임 빌더 guard throw 가 그대로 전파", () => {
      const broken: RealDataE2eRunPlan = {
        pipeline: validPipeline,
        run: { gitSha: "", dateToken: RUN_REF.dateToken },
      };
      expect(() =>
        buildRealDataResultOutcomeStepArgs(broken, CREATE_STDOUT),
      ).toThrow();
    });

    it("runPlan.run.gitSha 공백만 — 위임 guard throw 가 그대로 전파", () => {
      const broken: RealDataE2eRunPlan = {
        pipeline: validPipeline,
        run: { gitSha: "   ", dateToken: RUN_REF.dateToken },
      };
      expect(() =>
        buildRealDataResultOutcomeStepArgs(broken, CREATE_STDOUT),
      ).toThrow();
    });

    it("runPlan.run.dateToken 빈 문자열 — 위임 guard throw 가 그대로 전파", () => {
      const broken: RealDataE2eRunPlan = {
        pipeline: validPipeline,
        run: { gitSha: RUN_REF.gitSha, dateToken: "" },
      };
      expect(() =>
        buildRealDataResultOutcomeStepArgs(broken, CREATE_STDOUT),
      ).toThrow();
    });

    it("runPlan.run.dateToken 공백만 — 위임 guard throw 가 그대로 전파", () => {
      const broken: RealDataE2eRunPlan = {
        pipeline: validPipeline,
        run: { gitSha: RUN_REF.gitSha, dateToken: "   " },
      };
      expect(() =>
        buildRealDataResultOutcomeStepArgs(broken, CREATE_STDOUT),
      ).toThrow();
    });
  });

  describe("flow / branch — 잘못된 stdout 의 위임 파서 throw 전파(분기별 분리)", () => {
    it("(i) URL 미발견 stdout(무관 텍스트) — 위임 파서 throw 가 그대로 전파", () => {
      const runPlan = buildValidRunPlan();
      expect(() =>
        buildRealDataResultOutcomeStepArgs(runPlan, "no url here at all\n"),
      ).toThrow();
    });

    it("(i) 빈 stdout — 위임 파서 throw 가 그대로 전파", () => {
      const runPlan = buildValidRunPlan();
      expect(() => buildRealDataResultOutcomeStepArgs(runPlan, "")).toThrow();
    });

    it("(ii) 비-github 호스트 URL stdout — 위임 파서 throw 가 그대로 전파", () => {
      const runPlan = buildValidRunPlan();
      expect(() =>
        buildRealDataResultOutcomeStepArgs(
          runPlan,
          "https://gitlab.com/myungjoo/assessment-agent/issues/42\n",
        ),
      ).toThrow();
    });

    it("(ii) /pull/ PR URL stdout — 위임 파서 throw 가 그대로 전파(issue 경로 아님)", () => {
      const runPlan = buildValidRunPlan();
      expect(() =>
        buildRealDataResultOutcomeStepArgs(
          runPlan,
          "https://github.com/myungjoo/assessment-agent/pull/42\n",
        ),
      ).toThrow();
    });

    it("(iii) issueNumber 0 stdout — 위임 파서 throw 가 그대로 전파(양의 정수 아님)", () => {
      const runPlan = buildValidRunPlan();
      expect(() =>
        buildRealDataResultOutcomeStepArgs(
          runPlan,
          "https://github.com/myungjoo/assessment-agent/issues/0\n",
        ),
      ).toThrow();
    });

    it("(iii) issueNumber 선행0(007) stdout — 위임 파서 throw 가 그대로 전파", () => {
      const runPlan = buildValidRunPlan();
      expect(() =>
        buildRealDataResultOutcomeStepArgs(
          runPlan,
          "https://github.com/myungjoo/assessment-agent/issues/007\n",
        ),
      ).toThrow();
    });

    it("(iii) issueNumber 비정수(abc) stdout — 위임 파서 throw 가 그대로 전파", () => {
      const runPlan = buildValidRunPlan();
      expect(() =>
        buildRealDataResultOutcomeStepArgs(
          runPlan,
          "https://github.com/myungjoo/assessment-agent/issues/abc\n",
        ),
      ).toThrow();
    });
  });

  describe("결정론 · 무공유 — 동일 (runPlan, stdout) 두 번 호출 + 입력 불변", () => {
    it("두 report 가 deep-equal 이면서 최상위 객체 참조가 공유되지 않는다(not.toBe)", () => {
      const runPlan = buildValidRunPlan();
      const a = buildRealDataResultOutcomeStepArgs(runPlan, CREATE_STDOUT);
      const b = buildRealDataResultOutcomeStepArgs(runPlan, CREATE_STDOUT);

      // 값은 deep-equal(결정론 — 입력만의 함수).
      expect(a).toEqual(b);

      // 참조는 무공유 — 매 호출 새 report 객체.
      expect(a).not.toBe(b);
    });

    it("입력 runPlan 객체가 호출 전후로 mutate 되지 않음(deep-equal 보존)", () => {
      const runPlan = buildValidRunPlan();
      const runPlanBefore = JSON.parse(JSON.stringify(runPlan));

      buildRealDataResultOutcomeStepArgs(runPlan, CREATE_STDOUT);

      // 호출 후 입력 runPlan 이 동형(무공유 보존 — 출력 변형이 입력에 누설 0).
      expect(runPlan).toEqual(runPlanBefore);
    });
  });
});
