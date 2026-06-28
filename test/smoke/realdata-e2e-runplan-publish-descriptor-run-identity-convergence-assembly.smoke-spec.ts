// realdata-e2e-runplan-publish-descriptor-run-identity-convergence-assembly.smoke-spec.ts —
// 실 평가 e2e step①↔step④ run-identity convergence: seed-side 최외곽
// `buildRealDataE2eRunPlan` 의 `run` ↔ result-side `buildRealDataResultPublishStepArgs`
// 의 `report.descriptor` marker/title ↔ standalone `buildRealDataResultIssueDescriptor`
// marker/title 가 동일 run single-source 로 byte-identical 3 자 수렴함을 박제하는
// non-gated build-time smoke (T-0763, PLAN.md 109행 🟢 실 평가 e2e).
//
// 본 spec 의 존재 이유 — public CI gap 해소(T-0753 run-plan dual-leg / T-0737
// publish-step-args / T-0750/T-0751 descriptor confluence / T-0761 modelId cross-stage
// convergence / T-0759 publish↔outcome run convergence 의 run-축 cross-stage 짝):
//   - PLAN 109행 build-time chain 은 seed-side 최외곽 진입점
//     `buildRealDataE2eRunPlan(seeds, modelId, run)`(T-0597)이 `run`(`RealDataResultIssueRunRef`
//     = gitSha + dateToken)을 검증·복사 보존해 `runPlan.run` 으로 박제하고, result-side
//     step④ 연결 컴포저 `buildRealDataResultPublishStepArgs(runPlan, results)`(T-0599)가
//     `runPlan.run` 만을 단일 source 로 thread 해 `RealDataResultIssuePublishPlan`
//     ({report, commandArgs, searchArgv}) 의 `report.descriptor.marker`/`title` 을
//     합성한다.
//   - 핵심 cross-stage 불변식: **step① 에서 검증·보존된 `runPlan.run` 과 step④
//     publish plan 이 산출하는 `report.descriptor.marker`/`title` 의 run 식별 token 이,
//     동일 run 으로 standalone `buildRealDataResultIssueDescriptor(summary, runPlan.run)`
//     (T-0582)가 내는 marker/title 과 byte-identical single-source 로 수렴**해야 한다는
//     것. 두 단계에 run 을 따로 두 번 넘기거나 한쪽이 stale run 을 쓰면 잘못된
//     gitSha/dateToken 로 결과 이슈가 박제되거나 멱등 marker 가 어긋나 같은 run 의
//     search-or-update(REQ-009)/재실행 정합(REQ-037)이 깨진다.
//   - 기존 sweep 은 각 leg 를 따로 닫았다: run-plan dual-leg(T-0753, runPlan.pipeline↔
//     직접 pipeline-plan 수렴 단독), publish-step-args↔publish-plan 내부 위임 수렴
//     (T-0737), summary↔descriptor 내부 confluence(T-0750/T-0751), publish↔outcome
//     run convergence(T-0759), modelId cross-stage convergence(T-0761). 그러나
//     **seed-side 최외곽 `buildRealDataE2eRunPlan.run` ↔ result-side step④
//     `publishPlan.report.descriptor` marker/title ↔ standalone descriptor marker/title
//     가 동일 run single-source 로 byte-identical 3 자 수렴**함을 박제한 smoke 는 NONE.
//   - 본 spec 은 그 gap 을 메운다 — **gating 없이 항상 실행되는 일반 describe** 로
//     세 composer 를 동일 (seeds, modelId, run, results) single-source 로 동시 호출해
//     run 식별 token cross-stage 3 자 수렴만 검증한다. run-plan dual-leg / publish-step
//     -args↔publish-plan 내부 위임 / summary↔descriptor body 3 블록 / publish↔outcome
//     / modelId 축 수렴 자체 재단언 금지(기존 spec 이미 cover). live leg(실 prisma·실
//     collectForPerson·실 github.com fetch·실 LLM scoring·실 gh CLI·DB·LAN gate)는
//     복제하지 않고 synthetic seed/result 를 직접 공급한다. 따라서 본 spec 은:
//
//      🔥 실 prisma 호출 0 / 실 수집 호출 0 / 실 네트워크 호출 0 — github / Ollama /
//         gh 호출 0. fetch 0. process.env 읽기 0.
//      🔥 실 LLM 호출 0 — scoring service / gateway 미사용. synthetic EvaluationResult
//         literal 직접 공급(평가 leg 우회).
//      🔥 실 DB 접근 0 / 실 jest spawn 0 — 세 composer 조립만.
//      🔥 credential 0 / secret 0 / 비용 0 — public CI 에서 항상 green 발화(R-113).
//      🔥 새 외부 dependency 0 — 기존 build* 컴포저 import 재사용만(가드 신설 금지).
//      🔥 gating / describe.skip 배선 0 — 순수 build-time in-memory 검증만.
//
// Out of Scope (T-0763):
//   - 실 github.com 네트워크 fetch / 실 활동 수집(collectForPerson) / 실 prisma.upsert /
//     실 LLM scoring round-trip / 실 gh CLI 실행(create/edit) / placeholder 치환 runner
//     (live leg 복제 0) — 본 spec 은 세 composer 산출 plan/descriptor 만 관측.
//   - run-plan 내부 runPlan.pipeline↔직접 pipeline-plan 수렴 전수 재단언(T-0753 cover).
//   - publish-step-args↔`buildRealDataResultIssuePublishPlan(results, runPlan.run)`
//     내부 위임 수렴 전수 재단언(T-0737 cover).
//   - publish↔outcome step-args 가 동일 runPlan.run 으로 수렴하는 dual-leg 재단언
//     (T-0759 cover).
//   - summary↔descriptor 내부 confluence(body 3 블록·identity) 전수 재단언
//     (T-0750/T-0751 cover — 본 task 는 cross-stage run marker/title 수렴만).
//   - modelId cross-stage convergence 재단언(T-0761 cover — 본 task 는 run 축 대칭).
//   - descriptor body 의 marker→한 줄 요약→markdown 합성 구조 전수 재단언
//     (T-0750/T-0580/T-0582 cover).
//   - gated(DB·credential·LAN) smoke leg 추가 — 본 task 는 non-gated 단독.
//   - 새 dependency 도입 / 새 컴포저·가드·helper 신설 — 기존 build* 컴포저 import
//     재사용만.
//   - production `src/` 코드 / 기존 컴포저 소스 / 위임 helper / consistency 가드 수정
//     — test-only(신규 smoke spec 1 파일).
import type { EvaluationResult } from "../../src/assessment-evaluation/domain/evaluation-result";
import { buildRealDataResultIssueDescriptor } from "../helpers/realdata-e2e-result-issue-descriptor";
import type { RealDataResultIssueRunRef } from "../helpers/realdata-e2e-result-issue-descriptor";
import { buildRealDataResultPublishStepArgs } from "../helpers/realdata-e2e-result-publish-step-args";
import { buildRealDataResultSummary } from "../helpers/realdata-e2e-result-summary";
import { buildRealDataE2eRunPlan } from "../helpers/realdata-e2e-run-plan";
import type { RealDataE2eRunPlan } from "../helpers/realdata-e2e-run-plan";
import { buildRealDataE2eSeed } from "../helpers/realdata-e2e-seed-fixture";
import type { RealDataSeedDescriptor } from "../helpers/realdata-e2e-seed-fixture";

// 본 smoke 공통 fixture — 유효 modelId(비공백) 결정론 상수.
const MODEL_ID =
  "cfg-realdata-e2e-runplan-publish-descriptor-run-convergence-smoke";

// 본 smoke 공통 fixture — 결정론 run 식별자 두 종(gitSha + dateToken 둘 다 비공백).
// 매 it 가 runPlan 구성 시 spread 복제로 받아 입력 RUN_REF mutate 가 누설되지 않도록 한다.
const RUN_REF: RealDataResultIssueRunRef = {
  gitSha: "abc1234",
  dateToken: "2026-06-28",
};

// 다른 run 식별자(변별성 case 용) — gitSha/dateToken 둘 다 RUN_REF 와 다름.
const OTHER_RUN_REF: RealDataResultIssueRunRef = {
  gitSha: "def5678",
  dateToken: "2026-07-01",
};

// synthetic EvaluationResult 1 건 — publish-step-args 컴포저는 results 를 요약 집계
// (count·분포·totalVolume) → descriptor → command-args → search-argv 로 흘려보내는
// surface 만 검증하므로, 도메인 타입 정합만 만족하는 minimal literal 로 충분하다.
function syntheticResult(unitId: string, volume: number): EvaluationResult {
  return {
    unitId,
    narrative:
      "synthetic evaluation narrative — runplan↔publish descriptor run-identity convergence smoke fixture",
    difficulty: "easy",
    contribution: "low",
    volume,
  };
}

// 기본 results fixture — happy/branch case 의 공통 입력(2 원소).
function defaultResults(): EvaluationResult[] {
  return [
    syntheticResult("github:github.com:c1", 3),
    syntheticResult("github:github.com:c2", 5),
  ];
}

// 유효 runPlan 을 결정론 seed + modelId + run 으로 조립하는 헬퍼. run 은 spread 복제로
// 넘겨 입력 run-ref mutate 누설 0. run 인자 기본값은 RUN_REF.
function buildValidRunPlan(
  run: RealDataResultIssueRunRef = RUN_REF,
): RealDataE2eRunPlan {
  return buildRealDataE2eRunPlan(buildRealDataE2eSeed(), MODEL_ID, { ...run });
}

// synthetic 단일-identity seed descriptor 합성 헬퍼 — multi-seed 분기 case 용
// (fixture shape 정합, R-59 정합: raw 활동 0, 식별자만).
function singleIdentitySeed(
  username: string,
  externalId: string = username,
): RealDataSeedDescriptor {
  return {
    person: {
      fullName: username,
      email: `${username}@e2e.realdata.test`,
      active: true,
    },
    serviceIdentities: [{ service: "github.com", externalId, isPrimary: true }],
  };
}

describe("Smoke(non-gated): 실 평가 e2e step①↔step④ run-identity convergence — buildRealDataE2eRunPlan.run ↔ buildRealDataResultPublishStepArgs.report.descriptor marker/title ↔ standalone buildRealDataResultIssueDescriptor single-source 3 자 수렴 live 0 검증", () => {
  describe("happy path — 동일 single-source 로 세 composer 동시 호출 정상 산출", () => {
    it("seeds + 유효 modelId + 유효 run + results 단일 source → runPlan({pipeline, run}) + publishPlan({report, commandArgs, searchArgv}) + summary + standalone descriptor 모두 정상 산출", () => {
      const seeds = buildRealDataE2eSeed();
      const results = defaultResults();

      const runPlan = buildRealDataE2eRunPlan(seeds, MODEL_ID, { ...RUN_REF });
      const publishPlan = buildRealDataResultPublishStepArgs(runPlan, results);
      const summary = buildRealDataResultSummary(results);
      const descriptor = buildRealDataResultIssueDescriptor(
        summary,
        runPlan.run,
      );

      // runPlan: {pipeline, run} 정상 — pipeline 위임 산출 + 검증된 run 보존.
      expect(runPlan.pipeline).toBeDefined();
      expect(runPlan.pipeline.modelId).toBe(MODEL_ID);
      expect(runPlan.run.gitSha).toBe(RUN_REF.gitSha);
      expect(runPlan.run.dateToken).toBe(RUN_REF.dateToken);

      // publishPlan: {report, commandArgs, searchArgv} 3 필드 정상.
      expect(publishPlan.report).toBeDefined();
      expect(publishPlan.report.descriptor).toBeDefined();
      expect(publishPlan.report.summary).toBeDefined();
      expect(publishPlan.commandArgs).toBeDefined();
      expect(publishPlan.searchArgv).toBeDefined();
      expect(Array.isArray(publishPlan.searchArgv)).toBe(true);

      // standalone descriptor: {title, marker, body} 정상.
      expect(typeof descriptor.title).toBe("string");
      expect(typeof descriptor.marker).toBe("string");
      expect(typeof descriptor.body).toBe("string");
      expect(descriptor.title.length).toBeGreaterThan(0);
      expect(descriptor.marker.length).toBeGreaterThan(0);
    });
  });

  describe("cross-stage run single-source 3 자 수렴 — 핵심 불변식(branch)", () => {
    it("publishPlan.report.descriptor.marker === standalone descriptor.marker (byte-identical) AND title 도 byte-identical — 입력 run → runPlan.run → step④ descriptor marker/title → standalone descriptor marker/title 가 동일 run 식별 token single-source 로 수렴", () => {
      const seeds = buildRealDataE2eSeed();
      const results = defaultResults();
      const inputRun: RealDataResultIssueRunRef = { ...RUN_REF };

      const runPlan = buildRealDataE2eRunPlan(seeds, MODEL_ID, inputRun);
      const publishPlan = buildRealDataResultPublishStepArgs(runPlan, results);
      const summary = buildRealDataResultSummary(results);
      const descriptor = buildRealDataResultIssueDescriptor(
        summary,
        runPlan.run,
      );

      // 핵심 — step④ descriptor marker/title 가 standalone descriptor 와 byte-identical.
      expect(publishPlan.report.descriptor.marker).toBe(descriptor.marker);
      expect(publishPlan.report.descriptor.title).toBe(descriptor.title);

      // marker/title 안에 run.gitSha 와 run.dateToken 이 모두 포함(stale/drift 0).
      expect(publishPlan.report.descriptor.marker).toContain(
        runPlan.run.gitSha,
      );
      expect(publishPlan.report.descriptor.marker).toContain(
        runPlan.run.dateToken,
      );
      expect(publishPlan.report.descriptor.title).toContain(runPlan.run.gitSha);
      expect(publishPlan.report.descriptor.title).toContain(
        runPlan.run.dateToken,
      );
    });

    it("runPlan.run 이 입력 run 과 deep-equal(toEqual) 하되 새 객체로 복사 보존(not.toBe) — 입력 run 과 무공유, 출력 mutate 가 입력에 누설 0", () => {
      const seeds = buildRealDataE2eSeed();
      const inputRun: RealDataResultIssueRunRef = { ...RUN_REF };

      const runPlan = buildRealDataE2eRunPlan(seeds, MODEL_ID, inputRun);

      // 값 동일성(deep-equal).
      expect(runPlan.run).toEqual(inputRun);
      // 참조 무공유 — buildRealDataE2eRunPlan 이 검증 후 새 객체로 복사해 plan 보존.
      expect(runPlan.run).not.toBe(inputRun);
    });
  });

  describe("run 변별성 — 멱등 marker source(branch)", () => {
    it("서로 다른 run(gitSha 또는 dateToken 변) → 두 publishPlan.report.descriptor.marker 가 서로 다름 AND 각각 동일 run 의 standalone descriptor.marker 와는 일치(동일 run→동일 marker, 다른 run→다른 marker — cross-stage 결정론적 변별)", () => {
      const seeds = buildRealDataE2eSeed();
      const results = defaultResults();

      // run X (RUN_REF).
      const runPlanX = buildRealDataE2eRunPlan(seeds, MODEL_ID, { ...RUN_REF });
      const publishX = buildRealDataResultPublishStepArgs(runPlanX, results);
      const summaryX = buildRealDataResultSummary(results);
      const descriptorX = buildRealDataResultIssueDescriptor(
        summaryX,
        runPlanX.run,
      );

      // run Y (OTHER_RUN_REF — gitSha/dateToken 둘 다 다름).
      const runPlanY = buildRealDataE2eRunPlan(seeds, MODEL_ID, {
        ...OTHER_RUN_REF,
      });
      const publishY = buildRealDataResultPublishStepArgs(runPlanY, results);
      const summaryY = buildRealDataResultSummary(results);
      const descriptorY = buildRealDataResultIssueDescriptor(
        summaryY,
        runPlanY.run,
      );

      // 다른 run → 다른 marker(변별).
      expect(publishX.report.descriptor.marker).not.toBe(
        publishY.report.descriptor.marker,
      );
      expect(publishX.report.descriptor.title).not.toBe(
        publishY.report.descriptor.title,
      );

      // 같은 run → publish descriptor marker/title 가 standalone descriptor 와 일치.
      expect(publishX.report.descriptor.marker).toBe(descriptorX.marker);
      expect(publishX.report.descriptor.title).toBe(descriptorX.title);
      expect(publishY.report.descriptor.marker).toBe(descriptorY.marker);
      expect(publishY.report.descriptor.title).toBe(descriptorY.title);
    });

    it("gitSha 만 다른 두 run → marker 가 서로 다름(dateToken 동일이어도 gitSha 가 marker 식별에 기여)", () => {
      const seeds = buildRealDataE2eSeed();
      const results = defaultResults();

      const runPlanA = buildRealDataE2eRunPlan(seeds, MODEL_ID, {
        gitSha: "aaa0001",
        dateToken: RUN_REF.dateToken,
      });
      const runPlanB = buildRealDataE2eRunPlan(seeds, MODEL_ID, {
        gitSha: "bbb0002",
        dateToken: RUN_REF.dateToken,
      });

      const publishA = buildRealDataResultPublishStepArgs(runPlanA, results);
      const publishB = buildRealDataResultPublishStepArgs(runPlanB, results);

      expect(publishA.report.descriptor.marker).not.toBe(
        publishB.report.descriptor.marker,
      );
    });

    it("dateToken 만 다른 두 run → marker 가 서로 다름(gitSha 동일이어도 dateToken 이 marker 식별에 기여)", () => {
      const seeds = buildRealDataE2eSeed();
      const results = defaultResults();

      const runPlanA = buildRealDataE2eRunPlan(seeds, MODEL_ID, {
        gitSha: RUN_REF.gitSha,
        dateToken: "2026-01-01",
      });
      const runPlanB = buildRealDataE2eRunPlan(seeds, MODEL_ID, {
        gitSha: RUN_REF.gitSha,
        dateToken: "2026-12-31",
      });

      const publishA = buildRealDataResultPublishStepArgs(runPlanA, results);
      const publishB = buildRealDataResultPublishStepArgs(runPlanB, results);

      expect(publishA.report.descriptor.marker).not.toBe(
        publishB.report.descriptor.marker,
      );
    });
  });

  describe("results 무관·run 독립 — partial-thread 격리(branch)", () => {
    it("동일 run 고정 + results 다르게(빈 [] vs 다수) → publishPlan.report.descriptor.marker/title 는 byte-identical 이되 publishPlan.report.summary 는 results 따라 변화(count/totalVolume drift) — marker/title 은 run 식별 token 만의 함수(results/summary 무관)", () => {
      const seeds = buildRealDataE2eSeed();
      const runPlan = buildValidRunPlan();

      // 빈 results.
      const publishEmpty = buildRealDataResultPublishStepArgs(runPlan, []);
      // 다수 results.
      const publishMany = buildRealDataResultPublishStepArgs(runPlan, [
        syntheticResult("github:github.com:c1", 7),
        syntheticResult("github:github.com:c2", 11),
        syntheticResult("github:github.com:c3", 13),
      ]);

      // marker/title 은 동일 run → byte-identical(results 무관).
      expect(publishEmpty.report.descriptor.marker).toBe(
        publishMany.report.descriptor.marker,
      );
      expect(publishEmpty.report.descriptor.title).toBe(
        publishMany.report.descriptor.title,
      );

      // summary 는 results 따라 변화 — count·totalVolume drift.
      expect(publishEmpty.report.summary.count).toBe(0);
      expect(publishMany.report.summary.count).toBe(3);
      expect(publishEmpty.report.summary.totalVolume).toBe(0);
      expect(publishMany.report.summary.totalVolume).toBe(7 + 11 + 13);
      expect(publishEmpty.report.summary.count).not.toBe(
        publishMany.report.summary.count,
      );

      // seeds 사용 보존(unused-var 방지) — runPlan 의 pipeline 이 seeds 로부터 산출됨.
      expect(runPlan.pipeline.collectCallArgs).toHaveLength(seeds.length);
    });

    it("빈 results([]) + 유효 run → chain 전체 throw 0 AND marker/title 가 standalone descriptor 와 수렴 보존(경계값 — summary count 0·전 슬롯 0·descriptor 정상 합성)", () => {
      const runPlan = buildValidRunPlan();

      // 빈 results 로 chain 호출 — throw 0.
      let publishPlan!: ReturnType<typeof buildRealDataResultPublishStepArgs>;
      expect(() => {
        publishPlan = buildRealDataResultPublishStepArgs(runPlan, []);
      }).not.toThrow();

      // summary count 0·totalVolume 0·전 difficulty/contribution 슬롯 0 보장.
      expect(publishPlan.report.summary.count).toBe(0);
      expect(publishPlan.report.summary.totalVolume).toBe(0);
      for (const slot of Object.values(
        publishPlan.report.summary.byDifficulty,
      )) {
        expect(slot).toBe(0);
      }
      for (const slot of Object.values(
        publishPlan.report.summary.byContribution,
      )) {
        expect(slot).toBe(0);
      }

      // marker/title 가 standalone descriptor 와 수렴 보존(빈 results 경계여도 동일).
      const summary = buildRealDataResultSummary([]);
      const descriptor = buildRealDataResultIssueDescriptor(
        summary,
        runPlan.run,
      );
      expect(publishPlan.report.descriptor.marker).toBe(descriptor.marker);
      expect(publishPlan.report.descriptor.title).toBe(descriptor.title);
    });
  });

  describe("multi-seed 집계 분기에서도 run 수렴 보존(branch)", () => {
    it("seeds 2+ 원소(다양 externalId) → runPlan.pipeline.collectCallArgs 는 seed 따라 변하되 publishPlan.report.descriptor.marker/title 는 run source 만 따라 standalone descriptor 와 일치(seed 분포가 run 식별 token 에 누설 0)", () => {
      const results = defaultResults();

      // seeds A — 2 원소.
      const seedsA = [
        singleIdentitySeed("alpha-user"),
        singleIdentitySeed("beta-user"),
      ];
      const runPlanA = buildRealDataE2eRunPlan(seedsA, MODEL_ID, {
        ...RUN_REF,
      });
      const publishA = buildRealDataResultPublishStepArgs(runPlanA, results);

      // seeds B — 3 원소(분포 다름).
      const seedsB = [
        singleIdentitySeed("gamma-user"),
        singleIdentitySeed("delta-user"),
        singleIdentitySeed("epsilon-user"),
      ];
      const runPlanB = buildRealDataE2eRunPlan(seedsB, MODEL_ID, {
        ...RUN_REF,
      });
      const publishB = buildRealDataResultPublishStepArgs(runPlanB, results);

      // collectCallArgs 는 seed 따라 다름.
      expect(runPlanA.pipeline.collectCallArgs).toHaveLength(2);
      expect(runPlanB.pipeline.collectCallArgs).toHaveLength(3);

      // 하지만 marker/title 은 동일 run 이므로 byte-identical(seed 분포 누설 0).
      expect(publishA.report.descriptor.marker).toBe(
        publishB.report.descriptor.marker,
      );
      expect(publishA.report.descriptor.title).toBe(
        publishB.report.descriptor.title,
      );

      // 그리고 두 marker/title 모두 standalone descriptor 와 일치(seed 와 무관).
      const summary = buildRealDataResultSummary(results);
      const descriptor = buildRealDataResultIssueDescriptor(
        summary,
        runPlanA.run,
      );
      expect(publishA.report.descriptor.marker).toBe(descriptor.marker);
      expect(publishB.report.descriptor.marker).toBe(descriptor.marker);
    });
  });

  describe("error path / negative cases — seed-side run guard / result-side 위임 guard / standalone descriptor guard 의 cross-stage 대칭 박제", () => {
    it("빈 문자열 run.gitSha → buildRealDataE2eRunPlan(seed-side run guard) throw — pipeline 위임 통과 후 run guard 단계 차단", () => {
      const seeds = buildRealDataE2eSeed();
      expect(() =>
        buildRealDataE2eRunPlan(seeds, MODEL_ID, {
          gitSha: "",
          dateToken: RUN_REF.dateToken,
        }),
      ).toThrow();
    });

    it("빈 문자열 run.gitSha → buildRealDataResultIssueDescriptor(standalone descriptor guard) throw — descriptor 단계 차단(seed-side run guard 와 대칭)", () => {
      const summary = buildRealDataResultSummary([]);
      expect(() =>
        buildRealDataResultIssueDescriptor(summary, {
          gitSha: "",
          dateToken: RUN_REF.dateToken,
        }),
      ).toThrow();
    });

    it("공백-only run.dateToken → buildRealDataE2eRunPlan(seed-side run guard) throw — dateToken 축 negative 경로(gitSha 와 분리)", () => {
      const seeds = buildRealDataE2eSeed();
      expect(() =>
        buildRealDataE2eRunPlan(seeds, MODEL_ID, {
          gitSha: RUN_REF.gitSha,
          dateToken: "   ",
        }),
      ).toThrow();
    });

    it("공백-only run.dateToken → buildRealDataResultIssueDescriptor(standalone descriptor guard) throw — dateToken 축 standalone 대칭", () => {
      const summary = buildRealDataResultSummary([]);
      expect(() =>
        buildRealDataResultIssueDescriptor(summary, {
          gitSha: RUN_REF.gitSha,
          dateToken: "   ",
        }),
      ).toThrow();
    });

    it("빈 run.gitSha 의 runPlan-유사 객체 → buildRealDataResultPublishStepArgs(result-side step④) 위임 guard throw 전파 — step④ 가 stale/비식별 run 으로 descriptor 를 박지 못함", () => {
      // 정상 경로(buildRealDataE2eRunPlan)는 빈 run 을 만들 수 없으므로 broken
      // runPlan literal 을 직접 구성한다(pipeline 은 유효 modelId 로 채워 run 결손
      // 만 고립 검증).
      const validPipeline = buildValidRunPlan().pipeline;
      const broken: RealDataE2eRunPlan = {
        pipeline: validPipeline,
        run: { gitSha: "", dateToken: RUN_REF.dateToken },
      };
      expect(() =>
        buildRealDataResultPublishStepArgs(broken, defaultResults()),
      ).toThrow();
    });

    it("공백-only run.dateToken 의 runPlan-유사 객체 → buildRealDataResultPublishStepArgs(result-side step④) 위임 guard throw 전파(dateToken 축 cross-stage 대칭)", () => {
      const validPipeline = buildValidRunPlan().pipeline;
      const broken: RealDataE2eRunPlan = {
        pipeline: validPipeline,
        run: { gitSha: RUN_REF.gitSha, dateToken: "   " },
      };
      expect(() =>
        buildRealDataResultPublishStepArgs(broken, defaultResults()),
      ).toThrow();
    });
  });

  describe("flow / branch — guard 우선순위 cross-stage 정합(branch)", () => {
    it("빈 modelId + 유효 run → buildRealDataE2eRunPlan 의 pipeline 위임 modelId guard 가 run guard 보다 먼저 throw(run 유효해도 modelId 미결정 우선 차단 — run guard 미도달)", () => {
      const seeds = buildRealDataE2eSeed();
      // 유효 run + 빈 modelId 경계 — pipeline 위임 modelId guard 가 먼저 발동.
      expect(() =>
        buildRealDataE2eRunPlan(seeds, "", { ...RUN_REF }),
      ).toThrow();
    });

    it("공백-only modelId + 유효 run → 동일 — pipeline 위임 modelId guard 가 run guard 보다 먼저 throw(seed-side guard ordering 이 result-side run 수렴 진입 전에 modelId/seed 미결정 차단)", () => {
      const seeds = buildRealDataE2eSeed();
      expect(() =>
        buildRealDataE2eRunPlan(seeds, "   ", { ...RUN_REF }),
      ).toThrow();
    });

    it("유효 modelId + 유효 run + 빈 seeds([]) → throw 0(빈 seeds 는 pipeline 위임이 정상 합성 — collectCallArgs=[], modelId 보존, run 보존). 그 publishPlan.report.descriptor 도 standalone descriptor 와 수렴(빈 seeds 경계여도 run identity 보존)", () => {
      let runPlan!: RealDataE2eRunPlan;
      expect(() => {
        runPlan = buildRealDataE2eRunPlan([], MODEL_ID, { ...RUN_REF });
      }).not.toThrow();
      expect(runPlan.pipeline.collectCallArgs).toEqual([]);
      expect(runPlan.run.gitSha).toBe(RUN_REF.gitSha);

      // 빈 seeds 경계에서도 marker/title cross-stage 수렴 보존(run 식별 token 만의 함수).
      const results = defaultResults();
      const publishPlan = buildRealDataResultPublishStepArgs(runPlan, results);
      const summary = buildRealDataResultSummary(results);
      const descriptor = buildRealDataResultIssueDescriptor(
        summary,
        runPlan.run,
      );
      expect(publishPlan.report.descriptor.marker).toBe(descriptor.marker);
      expect(publishPlan.report.descriptor.title).toBe(descriptor.title);
    });
  });

  describe("credential 누출 0 — 세 composer 어느 산출에도 secret/raw 활동 미포함(§9·R-59)", () => {
    it("runPlan·publishPlan·descriptor 직렬화 어디에도 token/secret/ghp_/--auth 어휘 미포함 + raw 외부 활동 본문(commit/PR/issue 본문) 미포함", () => {
      const seeds = buildRealDataE2eSeed();
      const results = defaultResults();
      const runPlan = buildRealDataE2eRunPlan(seeds, MODEL_ID, { ...RUN_REF });
      const publishPlan = buildRealDataResultPublishStepArgs(runPlan, results);
      const summary = buildRealDataResultSummary(results);
      const descriptor = buildRealDataResultIssueDescriptor(
        summary,
        runPlan.run,
      );

      const serializedLower = [
        JSON.stringify(runPlan),
        JSON.stringify(publishPlan),
        JSON.stringify(descriptor),
      ]
        .join(" ")
        .toLowerCase();

      // 실 credential leak shape 어휘만 검사한다 — `token` 같은 일반 단어는 정상
      // 필드명(`dateToken`)·run 식별 marker 안에 합법적으로 등장하므로 false-positive.
      // PAT/secret 이 실제로 leak 될 때만 등장하는 shape 만 부재 단언.
      for (const secretToken of [
        "ghp_",
        "gho_",
        "--auth",
        "authorization",
        "bearer",
        "password",
      ]) {
        expect(serializedLower).not.toContain(secretToken);
      }

      // raw 외부 활동 데이터(commit/PR/issue 본문) 미포함 — 식별자·요약·marker/title
      // 렌더 본문만(R-59 정합). descriptor body 의 합법 narrative/markdown 본문은
      // synthetic literal 안의 통제된 텍스트이므로 키 부재 단언에 영향 없음.
      const rawSerialized = [
        JSON.stringify(runPlan),
        JSON.stringify(publishPlan.commandArgs),
        JSON.stringify(publishPlan.searchArgv),
      ].join(" ");
      expect(rawSerialized).not.toContain('"diff"');
      expect(rawSerialized).not.toContain('"commitMessage"');
      expect(rawSerialized).not.toContain('"prBody"');
      expect(rawSerialized).not.toContain('"issueBody"');
    });
  });

  describe("결정론 · 무공유 · no-mutation — 동일 (seeds, modelId, run, results) 두 번 호출 + 입력 불변", () => {
    it("세 composer 각각 두 번 호출 → deep-equal 산출(toEqual) + 새 객체(not.toBe)", () => {
      const seeds = buildRealDataE2eSeed();
      const results = defaultResults();

      const runPlanA = buildRealDataE2eRunPlan(seeds, MODEL_ID, { ...RUN_REF });
      const runPlanB = buildRealDataE2eRunPlan(seeds, MODEL_ID, { ...RUN_REF });
      const publishA = buildRealDataResultPublishStepArgs(runPlanA, results);
      const publishB = buildRealDataResultPublishStepArgs(runPlanA, results);
      const summary = buildRealDataResultSummary(results);
      const descriptorA = buildRealDataResultIssueDescriptor(
        summary,
        runPlanA.run,
      );
      const descriptorB = buildRealDataResultIssueDescriptor(
        summary,
        runPlanA.run,
      );

      // 값 deep-equal(결정론 — 입력만의 함수).
      expect(runPlanA).toEqual(runPlanB);
      expect(publishA).toEqual(publishB);
      expect(descriptorA).toEqual(descriptorB);

      // 참조 무공유 — 매 호출 새 객체.
      expect(runPlanA).not.toBe(runPlanB);
      expect(publishA).not.toBe(publishB);
      expect(descriptorA).not.toBe(descriptorB);
    });

    it("입력 seeds(중첩 person/serviceIdentities) · run(gitSha/dateToken string 원시) · results(중첩 원소) 가 chain 호출 전후로 mutate 0(deep-equal snapshot 보존)", () => {
      const seeds = buildRealDataE2eSeed();
      const results = defaultResults();
      const inputRun: RealDataResultIssueRunRef = { ...RUN_REF };

      const seedsBefore = JSON.parse(JSON.stringify(seeds));
      const resultsBefore = JSON.parse(JSON.stringify(results));
      const inputRunBefore = JSON.parse(JSON.stringify(inputRun));
      const modelIdBefore = MODEL_ID;

      const runPlan = buildRealDataE2eRunPlan(seeds, MODEL_ID, inputRun);
      buildRealDataResultPublishStepArgs(runPlan, results);
      const summary = buildRealDataResultSummary(results);
      buildRealDataResultIssueDescriptor(summary, runPlan.run);

      // chain 호출 후 입력 동형(무공유 보존 — 출력 변형이 입력에 누설 0).
      expect(seeds).toEqual(seedsBefore);
      expect(results).toEqual(resultsBefore);
      expect(inputRun).toEqual(inputRunBefore);
      // modelId 는 string 원시값이라 변형 불가 — 동일성 명시 확인.
      expect(MODEL_ID).toBe(modelIdBefore);
    });
  });
});
