// realdata-e2e-result-report-plan-assembly.smoke-spec.ts — 실 평가 e2e
// result-report-plan 조립 체인 non-gated build-time smoke (T-0740 박제,
// PLAN.md 109행 🟢 실 평가 e2e).
//
// 본 spec 의 존재 이유 — public CI gap 해소(T-0737 publish-step-args / T-0738
// outcome-step-args / T-0739 evaluation-step-args 조립 smoke 의 result-side 형제):
//   - PLAN 109행 step ③(평가) → step ④(결과 이슈 박제) 경계의 post-evaluation
//     interpretation 측 build-time 종단 컴포저는 순수 컴포저
//     `buildRealDataResultReportPlan(results, run)`(T-0593)가 닫는다 — 평가 산출
//     `EvaluationResult[]` 를 `buildRealDataResultSummary`(T-0580)로 집계해 `summary`
//     를, 그 summary + `run`(gitSha + dateToken) 식별자를
//     `buildRealDataResultIssueDescriptor`(T-0582)로 합성해 daily-test 결과 이슈
//     박제용 `descriptor`(title/marker/body)를 산출하고 둘을 `{ summary, descriptor }`
//     한 묶음으로 반환한다. 이 컴포저는 `run` 을 descriptor 측에 단일 source 로 thread
//     하므로 동일 run 이면 멱등 marker 가 동일해 step ④ live wiring 의 search-or-update
//     기반을 이룬다.
//   - 이 컴포저는 unit(`realdata-e2e-result-report-plan.spec.ts`) + 2 consistency
//     self-wire(`...-plan-consistency` / `...-descriptor-body-consistency`) spec 으로
//     닫혀 있으나, **results→summary→descriptor 를 묶은 조립 체인 단위의 non-gated
//     build-time smoke** 는 부재였다 — sibling 조립 smoke(T-0728~T-0731/T-0736/T-0737/
//     T-0738/T-0739)는 다른 composer family 또는 step-args(seed→run-plan threading) 측만
//     cover 한다.
//   - 본 spec 은 그 gap 을 메운다 — **gating 없이 항상 실행되는 일반 describe** 로
//     results→summary→descriptor 조립 surface 를 검증한다. 평가 leg(실 LLM /
//     EvaluationScoringService.scoreUnit / EvaluationOrchestratorService / LlmHttpGateway
//     / Ollama / 실 github 수집 / 실 gh issue / 실 jest spawn)는 복제하지 않고, 평가 산출
//     `EvaluationResult[]` 와 `run` 식별자를 synthetic literal 로 직접 공급해 평가 leg 를
//     우회한다(조립 surface 만 검증). 따라서 본 spec 은:
//
//      🔥 실 LLM 호출 0 — orchestrator / scoring service / gateway 미사용. synthetic
//         EvaluationResult literal 을 buildRealDataResultReportPlan 에 직접 공급.
//      🔥 실 네트워크 호출 0 — github / Ollama / gh 호출 0. fetch 0. process.env 읽기 0.
//      🔥 실 DB 접근 0 / 실 jest spawn 0 — results→summary→descriptor 조립만.
//      🔥 credential 0 / secret 0 / 비용 0 — public CI 에서 항상 green 발화(R-113).
//      🔥 새 외부 dependency 0 — 기존 build* 컴포저 import 재사용만(consistency-guard
//         신설 금지 — sweep 종결, T-0726).
//      🔥 gating / describe.skip 배선 0 — 순수 build-time in-memory 검증만.
//
// Out of Scope (T-0740):
//   - 실 LLM round-trip / EvaluationScoringService.scoreUnit / EvaluationOrchestratorService
//     / LlmHttpGateway / Ollama 호출 — 본 spec 은 평가 leg 를 synthetic 결과 literal 로
//     대체(실 평가 0). live leg 검증은 기존 realdata-e2e-live.smoke-spec.ts 책임.
//   - 실 github 네트워크 수집 / gh 실행 / 실 이슈 search·create·edit·박제 / 실 jest spawn.
//   - `buildRealDataResultIssuePublishPlan`(T-0595 / T-0729) 진입 — 별개 composer family.
//     본 task 는 `buildRealDataResultReportPlan`(summary+descriptor)만 책임(중복 0).
//   - step-args 측(publish/outcome/evaluation, T-0737/T-0738/T-0739)의 조립 smoke —
//     이미 cover(본 task 는 result-report-plan 만 책임).
//   - 새 컴포저 / 가드 / helper 신설 — 기존 build* 컴포저 import 재사용만.
//   - production src/ 코드 / 기존 컴포저 소스 / 위임 helper / consistency 가드 수정 —
//     test-only(신규 smoke spec 1 파일).
//   - T-0728/T-0729/T-0730/T-0731/T-0736/T-0737/T-0738/T-0739 의 기존 조립 smoke 파일
//     수정 — file-disjoint 병렬 stream(본 task 는 신규 파일 추가만).
import type { EvaluationResult } from "../../src/assessment-evaluation/domain/evaluation-result";
import { buildRealDataResultIssueDescriptor } from "../helpers/realdata-e2e-result-issue-descriptor";
import type { RealDataResultIssueRunRef } from "../helpers/realdata-e2e-result-issue-descriptor";
import { buildRealDataResultReportPlan } from "../helpers/realdata-e2e-result-report-plan";
import { buildRealDataResultSummary } from "../helpers/realdata-e2e-result-summary";

// 본 smoke 공통 fixture — 결정론 run 식별자(gitSha + dateToken 비공백). 매 it 가
// 호출 시 spread 복제로 받아 입력 mutate 가 누설되지 않도록 한다.
const RUN_REF: RealDataResultIssueRunRef = {
  gitSha: "abc1234",
  dateToken: "2026-06-28",
};

// 입력 RUN_REF 의 무공유 복제본을 반환하는 헬퍼 — happy/flow/결정론 case 의 공통
// 진입. spread 복제로 넘겨 입력 RUN_REF mutate 누설 0.
function validRun(): RealDataResultIssueRunRef {
  return { ...RUN_REF };
}

// synthetic EvaluationResult 1 건 — report-plan 컴포저는 결과 배열을 요약 집계
// (count·분포·totalVolume) → descriptor(title/marker/body) 로 흘려보내는 surface 만
// 검증하므로, 도메인 타입 정합(difficulty / contribution 멤버십)만 만족하는 minimal
// literal 로 충분하다. 실 LLM 호출 없이 EvaluationResult shape 만 강제한다.
function syntheticResult(
  unitId: string,
  difficulty: EvaluationResult["difficulty"],
  contribution: EvaluationResult["contribution"],
  volume: number,
): EvaluationResult {
  return {
    unitId,
    narrative:
      "synthetic evaluation narrative — result-report-plan assembly smoke fixture",
    difficulty,
    contribution,
    volume,
  };
}

describe("Smoke(non-gated): 실 평가 e2e result-report-plan 조립 체인(results→summary→descriptor) live-LLM 0 검증", () => {
  describe("happy path — 조립된 결과 리포트 plan 산출", () => {
    it("다수 results(난이도/기여도/volume 다양) + 유효 run → { summary, descriptor } shape + summary 4 필드 + descriptor 3 필드 non-empty + count === results.length", () => {
      const results = [
        syntheticResult("github:github.com:c1", "easy", "low", 3),
        syntheticResult("github:github.com:c2", "medium", "high", 5),
        syntheticResult("github:github.com:c3", "hard", "medium", 2),
      ];

      // 조립 체인 단일 진입 — results→summary→descriptor 를 run 단일 source 로 thread.
      const plan = buildRealDataResultReportPlan(results, validRun());

      // plan 이 { summary, descriptor } shape 충족.
      expect(plan.summary).toBeDefined();
      expect(plan.descriptor).toBeDefined();

      // summary 가 { count, byDifficulty, byContribution, totalVolume } 충족 +
      // count = 입력 길이 + totalVolume = volume 합산.
      expect(plan.summary.count).toBe(results.length);
      expect(plan.summary.totalVolume).toBe(10);
      expect(plan.summary.byDifficulty).toBeDefined();
      expect(plan.summary.byContribution).toBeDefined();
      // 입력 분포 반영(난이도/기여도 각 슬롯 카운트).
      expect(plan.summary.byDifficulty.easy).toBe(1);
      expect(plan.summary.byDifficulty.medium).toBe(1);
      expect(plan.summary.byDifficulty.hard).toBe(1);
      expect(plan.summary.byContribution.low).toBe(1);
      expect(plan.summary.byContribution.medium).toBe(1);
      expect(plan.summary.byContribution.high).toBe(1);

      // descriptor 가 { title, marker, body } 충족 + 셋 다 non-empty string.
      expect(typeof plan.descriptor.title).toBe("string");
      expect(plan.descriptor.title.length).toBeGreaterThan(0);
      expect(typeof plan.descriptor.marker).toBe("string");
      expect(plan.descriptor.marker.length).toBeGreaterThan(0);
      expect(typeof plan.descriptor.body).toBe("string");
      expect(plan.descriptor.body.length).toBeGreaterThan(0);

      // descriptor.body 는 marker 라인을 포함(멱등 search-or-update 기반).
      expect(plan.descriptor.body).toContain(plan.descriptor.marker);
    });
  });

  describe("단일 source 조립 단언 — summary→descriptor 를 같은 run 단일 source 로 thread", () => {
    it("plan.summary 가 동일 results 를 buildRealDataResultSummary(results) 로 직접 호출한 결과와 deep-equal", () => {
      const results = [
        syntheticResult("github:github.com:s1", "easy", "zero", 2),
        syntheticResult("github:github.com:s2", "hard", "high", 4),
      ];

      const plan = buildRealDataResultReportPlan(results, validRun());
      const directSummary = buildRealDataResultSummary(results);

      // 조립 체인의 summary 가 위임 직접 호출과 byte-identical(집계 재유도).
      expect(plan.summary).toEqual(directSummary);
    });

    it("plan.descriptor 가 동일 (plan.summary, run) 을 buildRealDataResultIssueDescriptor(plan.summary, run) 로 직접 호출한 결과와 deep-equal(run 단일 source thread)", () => {
      const results = [
        syntheticResult("github:github.com:s3", "medium", "low", 1),
        syntheticResult("github:github.com:s4", "medium", "medium", 6),
      ];
      const run = validRun();

      const plan = buildRealDataResultReportPlan(results, run);
      // 위임 대상을 plan.summary + 같은 run 으로 직접 호출(single-source 재유도).
      const directDescriptor = buildRealDataResultIssueDescriptor(
        plan.summary,
        run,
      );

      // 조립 체인이 summary→descriptor 를 같은 run 단일 source 로 thread 하므로
      // byte-identical.
      expect(plan.descriptor).toEqual(directDescriptor);
    });

    it("동일 run 두 번(다른 results) → descriptor.marker 동일(멱등 marker, summary 무관)", () => {
      const run = validRun();
      const planA = buildRealDataResultReportPlan(
        [syntheticResult("github:github.com:m1", "easy", "low", 1)],
        run,
      );
      const planB = buildRealDataResultReportPlan(
        [
          syntheticResult("github:github.com:m2", "hard", "high", 9),
          syntheticResult("github:github.com:m3", "medium", "zero", 0),
        ],
        run,
      );

      // 동일 run → marker 동일(summary 가 달라도 멱등 search-or-update 기반 유지).
      expect(planA.descriptor.marker).toBe(planB.descriptor.marker);
      // title 도 run 식별 token 기반이므로 동일 run → 동일.
      expect(planA.descriptor.title).toBe(planB.descriptor.title);
    });
  });

  describe("flow / branch — 빈 / 단일 / 다수 results 경로(분기별 분리)", () => {
    it("빈 results 배열([]) + 유효 run — throw 0 + summary.count 0·전 분포 슬롯 0·totalVolume 0 + descriptor 정상 합성(non-empty)", () => {
      const plan = buildRealDataResultReportPlan([], validRun());

      // 빈-배열 분기 — count·totalVolume 0, 분포 전 슬롯 0.
      expect(plan.summary.count).toBe(0);
      expect(plan.summary.totalVolume).toBe(0);
      for (const v of Object.values(plan.summary.byDifficulty)) {
        expect(v).toBe(0);
      }
      for (const v of Object.values(plan.summary.byContribution)) {
        expect(v).toBe(0);
      }

      // descriptor 는 빈 results 에서도 정상 합성(run 만으로 title/marker 도출).
      expect(plan.descriptor.title.length).toBeGreaterThan(0);
      expect(plan.descriptor.marker.length).toBeGreaterThan(0);
      expect(plan.descriptor.body.length).toBeGreaterThan(0);
    });

    it("단일 result — throw 0 으로 조립 산출, summary.count 1", () => {
      const results = [
        syntheticResult("github:github.com:single", "medium", "medium", 2),
      ];
      const plan = buildRealDataResultReportPlan(results, validRun());
      expect(plan.summary.count).toBe(1);
      expect(plan.summary.totalVolume).toBe(2);
      expect(plan.descriptor.body.length).toBeGreaterThan(0);
    });

    it("다수 result — throw 0 으로 조립 산출, summary.count 가 입력 수와 정합", () => {
      const results = [
        syntheticResult("github:github.com:b1", "easy", "low", 1),
        syntheticResult("github:github.com:b2", "easy", "high", 2),
        syntheticResult("github:github.com:b3", "hard", "low", 4),
      ];
      const plan = buildRealDataResultReportPlan(results, validRun());
      expect(plan.summary.count).toBe(3);
      expect(plan.summary.totalVolume).toBe(7);
      // 동일 difficulty 누적(easy 2).
      expect(plan.summary.byDifficulty.easy).toBe(2);
      expect(plan.summary.byContribution.low).toBe(2);
      expect(plan.descriptor.body.length).toBeGreaterThan(0);
    });
  });

  describe("negative cases — run 결손의 위임 descriptor guard 전파(자체 try/catch 0)", () => {
    // results 는 유효 단일 result 로 고정해 run 결손만 고립 검증한다. summary 집계는
    // run guard 와 무관하므로 산출되지만 descriptor 단계에서 throw 가 전파된다.
    const okResults = [
      syntheticResult("github:github.com:neg", "easy", "low", 1),
    ];

    it("run.gitSha 빈 문자열 — 위임 descriptor assertNonBlank throw 가 그대로 전파", () => {
      expect(() =>
        buildRealDataResultReportPlan(okResults, {
          gitSha: "",
          dateToken: RUN_REF.dateToken,
        }),
      ).toThrow();
    });

    it("run.gitSha 공백만 — 위임 guard throw 가 그대로 전파", () => {
      expect(() =>
        buildRealDataResultReportPlan(okResults, {
          gitSha: "   ",
          dateToken: RUN_REF.dateToken,
        }),
      ).toThrow();
    });

    it("run.dateToken 빈 문자열 — 위임 guard throw 가 그대로 전파", () => {
      expect(() =>
        buildRealDataResultReportPlan(okResults, {
          gitSha: RUN_REF.gitSha,
          dateToken: "",
        }),
      ).toThrow();
    });

    it("run.dateToken 공백만 — 위임 guard throw 가 그대로 전파", () => {
      expect(() =>
        buildRealDataResultReportPlan(okResults, {
          gitSha: RUN_REF.gitSha,
          dateToken: "   ",
        }),
      ).toThrow();
    });
  });

  describe("결정론 · 무공유 — 동일 (results, run) 두 번 호출 + 입력 불변", () => {
    it("두 plan 이 deep-equal 이면서 최상위·중첩 객체 참조가 공유되지 않는다(not.toBe)", () => {
      const results = [
        syntheticResult("github:github.com:d1", "easy", "low", 3),
        syntheticResult("github:github.com:d2", "hard", "high", 6),
      ];
      const a = buildRealDataResultReportPlan(results, validRun());
      const b = buildRealDataResultReportPlan(results, validRun());

      // 값은 deep-equal(결정론 — 입력만의 함수).
      expect(a).toEqual(b);

      // 참조는 무공유 — 최상위 plan + 중첩 summary/descriptor 트리 전부 새 객체.
      expect(a).not.toBe(b);
      expect(a.summary).not.toBe(b.summary);
      expect(a.descriptor).not.toBe(b.descriptor);
    });

    it("입력 results · run 객체가 호출 전후로 mutate 되지 않음(deep-equal 보존)", () => {
      const results = [
        syntheticResult("github:github.com:n1", "easy", "low", 1),
        syntheticResult("github:github.com:n2", "medium", "high", 2),
      ];
      const run = validRun();
      const resultsBefore = JSON.parse(JSON.stringify(results));
      const runBefore = JSON.parse(JSON.stringify(run));

      buildRealDataResultReportPlan(results, run);

      // 호출 후 입력 results · run 이 동형(무공유 보존 — 출력 변형이 입력에 누설 0).
      expect(results).toEqual(resultsBefore);
      expect(results.length).toBe(resultsBefore.length);
      expect(run).toEqual(runBefore);
    });
  });
});
