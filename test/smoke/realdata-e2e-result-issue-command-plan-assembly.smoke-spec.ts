// realdata-e2e-result-issue-command-plan-assembly.smoke-spec.ts — 실 평가 e2e
// result-issue-command-plan 조립 체인 non-gated build-time smoke (T-0741 박제,
// PLAN.md 109행 🟢 실 평가 e2e).
//
// 본 spec 의 존재 이유 — public CI gap 해소(T-0740 result-report-plan 조립 smoke 의
// commandArgs-side 후속 형제):
//   - PLAN 109행 step ③(평가) → step ④(결과 이슈 박제) 경계의 post-evaluation
//     interpretation 측 build-time **종단** 컴포저는 순수 컴포저
//     `buildRealDataResultIssueCommandPlan(results, run)`(T-0594)가 닫는다 — 평가 산출
//     `EvaluationResult[]` + `run`(gitSha + dateToken) 을 (1)
//     `buildRealDataResultReportPlan(results, run)`(T-0593)로 `report({summary,
//     descriptor})` 를, (2) 그 `report.descriptor` 를
//     `buildRealDataResultIssueCommandArgs(descriptor)`(T-0583)로 gh issue 멱등
//     search-or-update 명령-args(`{searchQuery, createArgs, updateArgs}`)로 합성해
//     `{report, commandArgs}` 한 묶음으로 반환한다. 이 컴포저의 `commandArgs` 는 정확히
//     step ④ 종단 박제 컴포저 `resolveRealDataResultIssueGhCommandPlan(stdout,
//     commandArgs)`(T-0588)의 두 번째 인자라, post-evaluation interpretation 체인을
//     명령-args 까지 종단으로 닫는다. `run` 은 (1) report-plan 단계에서만 thread 되므로
//     동일 run 이면 descriptor.marker 가 멱등이고 그것이 `commandArgs.searchQuery` 에
//     그대로 실린다 — step ④ live wiring 의 search-or-update 기반이다.
//   - 이 컴포저는 unit(`realdata-e2e-result-issue-command-plan.spec.ts`) + consistency
//     (`...-command-plan-consistency.spec.ts`) spec 으로 닫혀 있으나,
//     **results→report→commandArgs 를 묶은 조립 체인 단위의 non-gated build-time
//     smoke** 는 부재였다 — sibling 조립 smoke(T-0728~T-0731/T-0736~T-0740)는 다른
//     composer family 또는 result-report-plan(report 까지)만 cover 한다.
//   - 본 spec 은 그 gap 을 메운다 — **gating 없이 항상 실행되는 일반 describe** 로
//     results→report→commandArgs 조립 surface 를 검증한다. 평가 leg(실 LLM /
//     EvaluationScoringService.scoreUnit / EvaluationOrchestratorService / LlmHttpGateway
//     / Ollama / 실 github 수집 / 실 gh issue / 실 jest spawn)는 복제하지 않고, 평가 산출
//     `EvaluationResult[]` 와 `run` 식별자를 synthetic literal 로 직접 공급해 평가 leg 를
//     우회한다(조립 surface 만 검증). 따라서 본 spec 은:
//
//      🔥 실 LLM 호출 0 — orchestrator / scoring service / gateway 미사용. synthetic
//         EvaluationResult literal 을 buildRealDataResultIssueCommandPlan 에 직접 공급.
//      🔥 실 네트워크 호출 0 — github / Ollama / gh 호출 0. fetch 0. process.env 읽기 0.
//      🔥 실 DB 접근 0 / 실 jest spawn 0 — results→report→commandArgs 조립만.
//      🔥 credential 0 / secret 0 / 비용 0 — public CI 에서 항상 green 발화(R-113).
//      🔥 새 외부 dependency 0 — 기존 build* 컴포저 import 재사용만(consistency-guard
//         신설 금지 — sweep 종결, T-0726).
//      🔥 gating / describe.skip 배선 0 — 순수 build-time in-memory 검증만.
//
// Out of Scope (T-0741):
//   - 실 LLM round-trip / EvaluationScoringService.scoreUnit / EvaluationOrchestratorService
//     / LlmHttpGateway / Ollama 호출 — 본 spec 은 평가 leg 를 synthetic 결과 literal 로
//     대체(실 평가 0). live leg 검증은 기존 realdata-e2e-live.smoke-spec.ts 책임.
//   - 실 github 네트워크 수집 / gh 실행 / 실 이슈 search·create·edit·박제 / 실 jest spawn.
//   - 기존 result-report-plan 조립 smoke(T-0740, `buildRealDataResultReportPlan` 진입) —
//     본 task 는 그 위에서 commandArgs 까지 묶는 `buildRealDataResultIssueCommandPlan`
//     종단 컴포저만 책임(선행 smoke 수정·중복 0).
//   - step ④ 박제 종단 컴포저 `resolveRealDataResultIssueGhCommandPlan(stdout,
//     commandArgs)`(T-0588) — 별개 composer family(search-side). 본 task 는 그 컴포저가
//     받는 `commandArgs` 산출까지만 책임(중복·수정 0).
//   - 새 컴포저 / 가드 / helper 신설 — 기존 build* 컴포저 import 재사용만.
//   - production src/ 코드 / 기존 컴포저 소스 / 위임 helper / consistency 가드 수정 —
//     test-only(신규 smoke spec 1 파일).
//   - T-0728/T-0729/T-0730/T-0731/T-0736/T-0737/T-0738/T-0739/T-0740 의 기존 조립 smoke
//     파일 수정 — file-disjoint 병렬 stream(본 task 는 신규 파일 추가만).
import type { EvaluationResult } from "../../src/assessment-evaluation/domain/evaluation-result";
import { buildRealDataResultIssueCommandArgs } from "../helpers/realdata-e2e-result-issue-command-args";
import { buildRealDataResultIssueCommandPlan } from "../helpers/realdata-e2e-result-issue-command-plan";
import type { RealDataResultIssueRunRef } from "../helpers/realdata-e2e-result-issue-descriptor";
import { buildRealDataResultReportPlan } from "../helpers/realdata-e2e-result-report-plan";

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

// synthetic EvaluationResult 1 건 — command-plan 컴포저는 결과 배열을 report-plan
// (요약 집계 → descriptor) → command-args(searchQuery/createArgs/updateArgs) 로
// 흘려보내는 조립 surface 만 검증하므로, 도메인 타입 정합(difficulty / contribution
// 멤버십)만 만족하는 minimal literal 로 충분하다. 실 LLM 호출 없이 EvaluationResult
// shape 만 강제한다.
function syntheticResult(
  unitId: string,
  difficulty: EvaluationResult["difficulty"],
  contribution: EvaluationResult["contribution"],
  volume: number,
): EvaluationResult {
  return {
    unitId,
    narrative:
      "synthetic evaluation narrative — result-issue-command-plan assembly smoke fixture",
    difficulty,
    contribution,
    volume,
  };
}

describe("Smoke(non-gated): 실 평가 e2e result-issue-command-plan 조립 체인(results→report→commandArgs) live-LLM 0 검증", () => {
  describe("happy path — 조립된 결과 이슈 명령 plan 산출", () => {
    it("다수 results(난이도/기여도/volume 다양) + 유효 run → { report, commandArgs } shape + report 가 { summary, descriptor }(count === results.length, descriptor 3 필드 non-empty) + commandArgs 가 { searchQuery, createArgs:{title,body,labels}, updateArgs:{title,body} }(searchQuery non-empty, labels 비어있지 않은 string[])", () => {
      const results = [
        syntheticResult("github:github.com:c1", "easy", "low", 3),
        syntheticResult("github:github.com:c2", "medium", "high", 5),
        syntheticResult("github:github.com:c3", "hard", "medium", 2),
      ];

      // 조립 체인 단일 진입 — results→report→commandArgs 를 run 단일 source 로 thread.
      const plan = buildRealDataResultIssueCommandPlan(results, validRun());

      // plan 이 { report, commandArgs } shape 충족.
      expect(plan.report).toBeDefined();
      expect(plan.commandArgs).toBeDefined();

      // report 가 { summary, descriptor } 충족 + summary.count = 입력 길이.
      expect(plan.report.summary).toBeDefined();
      expect(plan.report.summary.count).toBe(results.length);
      expect(plan.report.descriptor).toBeDefined();

      // descriptor 가 { title, marker, body } 충족 + 셋 다 non-empty string.
      expect(typeof plan.report.descriptor.title).toBe("string");
      expect(plan.report.descriptor.title.length).toBeGreaterThan(0);
      expect(typeof plan.report.descriptor.marker).toBe("string");
      expect(plan.report.descriptor.marker.length).toBeGreaterThan(0);
      expect(typeof plan.report.descriptor.body).toBe("string");
      expect(plan.report.descriptor.body.length).toBeGreaterThan(0);

      // commandArgs 가 { searchQuery, createArgs, updateArgs } 충족.
      expect(typeof plan.commandArgs.searchQuery).toBe("string");
      expect(plan.commandArgs.searchQuery.length).toBeGreaterThan(0);

      // createArgs 가 { title, body, labels } 충족 + labels 비어있지 않은 string[].
      expect(typeof plan.commandArgs.createArgs.title).toBe("string");
      expect(plan.commandArgs.createArgs.title.length).toBeGreaterThan(0);
      expect(typeof plan.commandArgs.createArgs.body).toBe("string");
      expect(plan.commandArgs.createArgs.body.length).toBeGreaterThan(0);
      expect(Array.isArray(plan.commandArgs.createArgs.labels)).toBe(true);
      expect(plan.commandArgs.createArgs.labels.length).toBeGreaterThan(0);
      for (const label of plan.commandArgs.createArgs.labels) {
        expect(typeof label).toBe("string");
        expect(label.length).toBeGreaterThan(0);
      }

      // updateArgs 가 { title, body } 충족 + 둘 다 non-empty.
      expect(typeof plan.commandArgs.updateArgs.title).toBe("string");
      expect(plan.commandArgs.updateArgs.title.length).toBeGreaterThan(0);
      expect(typeof plan.commandArgs.updateArgs.body).toBe("string");
      expect(plan.commandArgs.updateArgs.body.length).toBeGreaterThan(0);
    });
  });

  describe("단일 source 조립 단언 — report→commandArgs 를 descriptor 단일 source 로 thread", () => {
    it("plan.report 가 동일 (results, run) 을 buildRealDataResultReportPlan(results, run) 로 직접 호출한 결과와 deep-equal", () => {
      const results = [
        syntheticResult("github:github.com:s1", "easy", "zero", 2),
        syntheticResult("github:github.com:s2", "hard", "high", 4),
      ];
      const run = validRun();

      const plan = buildRealDataResultIssueCommandPlan(results, run);
      const directReport = buildRealDataResultReportPlan(results, run);

      // 조립 체인의 report 가 위임 직접 호출과 byte-identical(report-plan 재유도).
      expect(plan.report).toEqual(directReport);
    });

    it("plan.commandArgs 가 동일 plan.report.descriptor 를 buildRealDataResultIssueCommandArgs(plan.report.descriptor) 로 직접 호출한 결과와 deep-equal(descriptor 단일 source thread)", () => {
      const results = [
        syntheticResult("github:github.com:s3", "medium", "low", 1),
        syntheticResult("github:github.com:s4", "medium", "medium", 6),
      ];

      const plan = buildRealDataResultIssueCommandPlan(results, validRun());
      // 위임 대상을 plan.report.descriptor 로 직접 호출(single-source 재유도).
      const directCommandArgs = buildRealDataResultIssueCommandArgs(
        plan.report.descriptor,
      );

      // 조립 체인이 report→commandArgs 를 descriptor 단일 source 로 thread 하므로
      // byte-identical.
      expect(plan.commandArgs).toEqual(directCommandArgs);
    });

    it("plan.commandArgs.searchQuery === plan.report.descriptor.marker(run 단일 source 멱등 marker 가 searchQuery 로 실림)", () => {
      const results = [
        syntheticResult("github:github.com:sq1", "easy", "low", 1),
        syntheticResult("github:github.com:sq2", "hard", "high", 7),
      ];

      const plan = buildRealDataResultIssueCommandPlan(results, validRun());

      // searchQuery 가 descriptor.marker 그대로(멱등 search-or-update 검색 토큰).
      expect(plan.commandArgs.searchQuery).toBe(plan.report.descriptor.marker);
    });

    it("create/update body 가 모두 descriptor.body 와 일치(marker 라인 두 경로 보존)", () => {
      const results = [
        syntheticResult("github:github.com:bd1", "medium", "high", 3),
      ];

      const plan = buildRealDataResultIssueCommandPlan(results, validRun());

      // create/update 양쪽 body 가 descriptor.body 그대로(멱등성 보존).
      expect(plan.commandArgs.createArgs.body).toBe(
        plan.report.descriptor.body,
      );
      expect(plan.commandArgs.updateArgs.body).toBe(
        plan.report.descriptor.body,
      );
    });

    it("동일 run 두 번(다른 results) → commandArgs.searchQuery 동일(멱등 검색 토큰, summary 무관)", () => {
      const run = validRun();
      const planA = buildRealDataResultIssueCommandPlan(
        [syntheticResult("github:github.com:m1", "easy", "low", 1)],
        run,
      );
      const planB = buildRealDataResultIssueCommandPlan(
        [
          syntheticResult("github:github.com:m2", "hard", "high", 9),
          syntheticResult("github:github.com:m3", "medium", "zero", 0),
        ],
        run,
      );

      // 동일 run → searchQuery 동일(summary 가 달라도 멱등 검색 토큰 유지).
      expect(planA.commandArgs.searchQuery).toBe(planB.commandArgs.searchQuery);
    });
  });

  describe("flow / branch — 빈 / 단일 / 다수 results 경로(분기별 분리)", () => {
    it("빈 results 배열([]) + 유효 run — throw 0 + report.summary.count 0·전 분포 슬롯 0·totalVolume 0 + descriptor / commandArgs 정상 합성(non-empty searchQuery/createArgs/updateArgs)", () => {
      const plan = buildRealDataResultIssueCommandPlan([], validRun());

      // 빈-배열 분기 — report.summary count·totalVolume 0, 분포 전 슬롯 0.
      expect(plan.report.summary.count).toBe(0);
      expect(plan.report.summary.totalVolume).toBe(0);
      for (const v of Object.values(plan.report.summary.byDifficulty)) {
        expect(v).toBe(0);
      }
      for (const v of Object.values(plan.report.summary.byContribution)) {
        expect(v).toBe(0);
      }

      // descriptor 는 빈 results 에서도 정상 합성(run 만으로 title/marker 도출).
      expect(plan.report.descriptor.title.length).toBeGreaterThan(0);
      expect(plan.report.descriptor.marker.length).toBeGreaterThan(0);
      expect(plan.report.descriptor.body.length).toBeGreaterThan(0);

      // commandArgs 도 정상 합성(searchQuery / create / update non-empty).
      expect(plan.commandArgs.searchQuery.length).toBeGreaterThan(0);
      expect(plan.commandArgs.createArgs.title.length).toBeGreaterThan(0);
      expect(plan.commandArgs.createArgs.body.length).toBeGreaterThan(0);
      expect(plan.commandArgs.createArgs.labels.length).toBeGreaterThan(0);
      expect(plan.commandArgs.updateArgs.title.length).toBeGreaterThan(0);
      expect(plan.commandArgs.updateArgs.body.length).toBeGreaterThan(0);
    });

    it("단일 result — throw 0 으로 조립 산출, report.summary.count 1 + commandArgs 정상", () => {
      const results = [
        syntheticResult("github:github.com:single", "medium", "medium", 2),
      ];
      const plan = buildRealDataResultIssueCommandPlan(results, validRun());
      expect(plan.report.summary.count).toBe(1);
      expect(plan.report.summary.totalVolume).toBe(2);
      expect(plan.commandArgs.searchQuery.length).toBeGreaterThan(0);
      expect(plan.commandArgs.createArgs.body.length).toBeGreaterThan(0);
    });

    it("다수 result — throw 0 으로 조립 산출, report.summary.count 가 입력 수와 정합 + commandArgs 정상", () => {
      const results = [
        syntheticResult("github:github.com:b1", "easy", "low", 1),
        syntheticResult("github:github.com:b2", "easy", "high", 2),
        syntheticResult("github:github.com:b3", "hard", "low", 4),
      ];
      const plan = buildRealDataResultIssueCommandPlan(results, validRun());
      expect(plan.report.summary.count).toBe(3);
      expect(plan.report.summary.totalVolume).toBe(7);
      // 동일 difficulty 누적(easy 2).
      expect(plan.report.summary.byDifficulty.easy).toBe(2);
      expect(plan.report.summary.byContribution.low).toBe(2);
      expect(plan.commandArgs.searchQuery.length).toBeGreaterThan(0);
      expect(plan.commandArgs.updateArgs.body.length).toBeGreaterThan(0);
    });
  });

  describe("negative cases — run 결손의 위임 report-plan guard 전파(자체 try/catch 0, commandArgs 단계 도달 0)", () => {
    // results 는 유효 단일 result 로 고정해 run 결손만 고립 검증한다. throw 는 (1)
    // report-plan 단계(하위 descriptor assertNonBlank)에서 평가되므로 commandArgs
    // 단계에 도달하지 못한다.
    const okResults = [
      syntheticResult("github:github.com:neg", "easy", "low", 1),
    ];

    it("run.gitSha 빈 문자열 — 위임 report-plan 하위 assertNonBlank throw 가 그대로 전파", () => {
      expect(() =>
        buildRealDataResultIssueCommandPlan(okResults, {
          gitSha: "",
          dateToken: RUN_REF.dateToken,
        }),
      ).toThrow();
    });

    it("run.gitSha 공백만 — 위임 guard throw 가 그대로 전파", () => {
      expect(() =>
        buildRealDataResultIssueCommandPlan(okResults, {
          gitSha: "   ",
          dateToken: RUN_REF.dateToken,
        }),
      ).toThrow();
    });

    it("run.dateToken 빈 문자열 — 위임 guard throw 가 그대로 전파", () => {
      expect(() =>
        buildRealDataResultIssueCommandPlan(okResults, {
          gitSha: RUN_REF.gitSha,
          dateToken: "",
        }),
      ).toThrow();
    });

    it("run.dateToken 공백만 — 위임 guard throw 가 그대로 전파", () => {
      expect(() =>
        buildRealDataResultIssueCommandPlan(okResults, {
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
      const a = buildRealDataResultIssueCommandPlan(results, validRun());
      const b = buildRealDataResultIssueCommandPlan(results, validRun());

      // 값은 deep-equal(결정론 — 입력만의 함수).
      expect(a).toEqual(b);

      // 참조는 무공유 — 최상위 plan + 중첩 report/commandArgs 트리 + createArgs.labels
      // 배열 전부 새 객체.
      expect(a).not.toBe(b);
      expect(a.report).not.toBe(b.report);
      expect(a.commandArgs).not.toBe(b.commandArgs);
      expect(a.commandArgs.createArgs).not.toBe(b.commandArgs.createArgs);
      expect(a.commandArgs.createArgs.labels).not.toBe(
        b.commandArgs.createArgs.labels,
      );
    });

    it("입력 results · run 객체가 호출 전후로 mutate 되지 않음(deep-equal 보존)", () => {
      const results = [
        syntheticResult("github:github.com:n1", "easy", "low", 1),
        syntheticResult("github:github.com:n2", "medium", "high", 2),
      ];
      const run = validRun();
      const resultsBefore = JSON.parse(JSON.stringify(results));
      const runBefore = JSON.parse(JSON.stringify(run));

      buildRealDataResultIssueCommandPlan(results, run);

      // 호출 후 입력 results · run 이 동형(무공유 보존 — 출력 변형이 입력에 누설 0).
      expect(results).toEqual(resultsBefore);
      expect(results.length).toBe(resultsBefore.length);
      expect(run).toEqual(runBefore);
    });
  });
});
