// realdata-e2e-publish-plan-report-plan-convergence-assembly.smoke-spec.ts —
// 실 평가 e2e publish-plan↔report-plan 두 composer single-source (results, run)
// report cross-composer convergence 조립 체인 non-gated build-time smoke (T-0762 박제,
// PLAN.md 109행 🟢 실 평가 e2e, step④).
//
// 본 spec 의 존재 이유 — public CI gap 해소(T-0593/T-0699/T-0700 report-plan 내부
// 단독 / T-0755 publish-plan 내부 tri-leg 단독 spec 의 cross-composer report-convergence 짝):
//   - PLAN 109행 step④ 결과 이슈 박제는 pre-실행 build-time chain 의 단일 진입점
//     `buildRealDataResultIssuePublishPlan(results, run)`(T-0595)가
//     `{report, commandArgs, searchArgv}` 을 산출한다. 이 진입 composer 의 첫 위임
//     결과인 **`publishPlan.report`**(`{summary, descriptor}`)는 별도 standalone
//     composer **`buildRealDataResultReportPlan(results, run)`**(T-0593)가 동일 입력
//     으로 산출하는 report 와 **byte-identical 단일 source 로 수렴**해야 한다 — 한
//     평가 run 의 결과 집계·이슈 descriptor 가 "publish chain 안에서 내포 산출된
//     report" 와 "standalone 으로 산출된 report" 사이에서 절대 drift 하면 안 된다.
//   - cross-composer 핵심 불변식은 **두 경로가 동일 `(results, run)` single-source 로
//     report 수렴**한다는 것 — `publishPlan.report` 가 standalone `reportPlan` 과
//     byte-identical(deep-equal) 로 일치해야 한다. 두 경로가 다른 report 를 내면
//     (예: standalone report 는 totalVolume X 인데 publish chain 의 내포 report 는
//     totalVolume Y) step④ 가 commandArgs/searchArgv 로 박는 이슈 본문과 별도 리포트
//     산출물이 **같은 run 인데 서로 다른 결과 수치를 외화**해 결과 리포트 단일성·재실행
//     정합(REQ-037)이 깨진다.
//   - 기존 sweep 은 두 composer 를 **각각 따로** 닫았다 — report-plan 내부는
//     T-0593/T-0699/T-0700(summary↔descriptor cross + plan↔inputs 재유도 단독),
//     publish-plan 내부는 T-0755(report·commandArgs·searchArgv tri-leg 단독). 그러나
//     **publish-plan 진입 composer 의 내포 `report` 와 standalone report-plan composer
//     산출이 동일 `(results, run)` single-source 로 byte-identical 수렴**함을 박제한
//     smoke 는 NONE 이었다.
//   - 본 spec 은 그 gap 을 메운다 — **gating 없이 항상 실행되는 일반 describe** 로 두
//     composer 의 cross-composer report 수렴만 검증한다(report-plan 내부 summary↔
//     descriptor 수렴 / publish-plan 내부 commandArgs/searchArgv tri-leg 자체 재단언
//     금지 — 기존 spec 이미 cover). live leg(실 prisma·실 collectForPerson·실
//     github.com fetch·실 LLM scoring·실 gh CLI·DB·LAN gate)는 복제하지 않고, 순수
//     composer 에 synthetic EvaluationResult[] + run 을 직접 공급한다. 따라서 본 spec 은:
//
//      🔥 실 prisma 호출 0 / 실 수집 호출 0 — 두 composer 는 report/plan 트리만 관측.
//      🔥 실 LLM scoring 호출 0 — EvaluationResult 는 build-time synthetic literal 주입.
//      🔥 실 네트워크 호출 0 — github / Ollama / gh 호출 0. fetch 0. process.env 읽기 0.
//      🔥 실 DB 접근 0 / 실 gh CLI 0 — 두 composer 조립만.
//      🔥 credential 0 / secret 0 / 비용 0 — public CI 에서 항상 green 발화(R-113).
//      🔥 새 외부 dependency 0 — 기존 build* composer import 재사용만(가드 신설 금지).
//      🔥 gating / describe.skip 배선 0 — 순수 build-time in-memory 검증만.
//
// Out of Scope (T-0762):
//   - 실 github.com 네트워크 fetch / 실 활동 수집(collectForPerson) / 실 prisma.upsert /
//     실 LLM scoring round-trip / 실 gh CLI 실행(create/edit) / placeholder 치환 runner
//     (live leg 복제 0) — 본 spec 은 report/plan 트리만 관측.
//   - report-plan 내부 summary leg↔descriptor leg cross 수렴 + plan↔inputs 재유도
//     전수 재단언(T-0593/T-0699/T-0700 이미 cover — 본 task 는 cross-composer report 수렴만).
//   - publish-plan 내부 report·commandArgs·searchArgv tri-leg 수렴 전수 재단언
//     (T-0755 이미 cover — 본 task 는 publish-plan 의 report leg↔standalone report-plan 수렴만).
//   - summary 개별 집계 shape / descriptor body marker→요약→markdown 합성 구조 전수
//     재단언(T-0580/T-0582/T-0642/T-0644 이미 cover).
//   - 새 composer / 가드 / helper 신설 — 기존 build* composer import 재사용만.
//   - production src/ 코드 / 기존 composer 소스 / 위임 helper / consistency 가드 수정 —
//     test-only(신규 smoke spec 1 파일).
import type { EvaluationResult } from "../../src/assessment-evaluation/domain/evaluation-result";
import type { RealDataResultIssueRunRef } from "../helpers/realdata-e2e-result-issue-descriptor";
import { buildRealDataResultIssuePublishPlan } from "../helpers/realdata-e2e-result-issue-publish-plan";
import { buildRealDataResultReportPlan } from "../helpers/realdata-e2e-result-report-plan";

// synthetic EvaluationResult 합성 헬퍼 — 두 composer 의 results source. raw 본문
// (narrative 등)은 LLM 산출 placeholder 문자열로만 채워 R-59 정합(원본 활동 본문 0).
// difficulty/contribution/volume 로 집계 분포 다양성을 만들어 multi-result 분기를 cover.
function evalResult(
  unitId: string,
  difficulty: EvaluationResult["difficulty"],
  contribution: EvaluationResult["contribution"],
  volume: number,
): EvaluationResult {
  return {
    unitId,
    narrative: `평가 요약 ${unitId}`,
    difficulty,
    contribution,
    volume,
  };
}

// 유효 run 식별자 — gitSha + dateToken 비-blank. 두 composer 가 동일 source 로 받는다.
const VALID_RUN: RealDataResultIssueRunRef = {
  gitSha: "abc1234",
  dateToken: "2026-06-28",
};

// 단일-result source — happy/수렴/결정론 기본 입력.
function singleResult(): EvaluationResult[] {
  return [evalResult("github:com:sha-1", "easy", "low", 3)];
}

// 다양 difficulty/contribution 분포의 multi-result source — 집계 분기 cover.
function multiResult(): EvaluationResult[] {
  return [
    evalResult("github:com:sha-1", "easy", "zero", 1),
    evalResult("github:com:pr-2", "medium", "medium", 5),
    evalResult("github:com:issue-3", "hard", "high", 11),
  ];
}

describe("Smoke(non-gated): 실 평가 e2e publish-plan↔report-plan 두 composer single-source (results, run) report cross-composer convergence 조립 체인 live 0 검증", () => {
  describe("happy path — 동일 (results, run) 로 두 composer 동시 호출 정상 산출", () => {
    it("단일 (results, run) source 로 buildRealDataResultIssuePublishPlan + buildRealDataResultReportPlan 동시 호출 → 두 산출물 모두 정상({report, commandArgs, searchArgv} / {summary, descriptor})", () => {
      const results = singleResult();

      // publish 진입 composer + standalone report composer 동시 호출(단일 source).
      const publishPlan = buildRealDataResultIssuePublishPlan(
        results,
        VALID_RUN,
      );
      const reportPlan = buildRealDataResultReportPlan(results, VALID_RUN);

      // publishPlan: {report, commandArgs, searchArgv} 정상 산출.
      expect(typeof publishPlan.report).toBe("object");
      expect(typeof publishPlan.commandArgs).toBe("object");
      expect(Array.isArray(publishPlan.searchArgv)).toBe(true);

      // reportPlan: {summary, descriptor} 정상 산출.
      expect(typeof reportPlan.summary).toBe("object");
      expect(typeof reportPlan.descriptor).toBe("object");
      expect(typeof reportPlan.descriptor.body).toBe("string");
    });
  });

  describe("cross-composer report single-source 수렴 — 핵심 불변식(branch)", () => {
    it("publishPlan.report 가 standalone reportPlan 과 byte-identical(toEqual) + 무공유(not.toBe) — 두 경로가 같은 값이되 객체 공유 0", () => {
      const results = singleResult();

      const publishPlan = buildRealDataResultIssuePublishPlan(
        results,
        VALID_RUN,
      );
      const reportPlan = buildRealDataResultReportPlan(results, VALID_RUN);

      // 내포 report 와 standalone report 가 byte-identical(deep-equal).
      expect(publishPlan.report).toEqual(reportPlan);
      // 그러나 객체는 무공유 복제 — 두 경로가 같은 mutable 객체를 공유하지 않음.
      expect(publishPlan.report).not.toBe(reportPlan);
    });

    it("summary·descriptor 두 sub-필드 각각 동일 source(publishPlan.report.summary↔reportPlan.summary, publishPlan.report.descriptor↔reportPlan.descriptor 모두 toEqual) — composer 간 report drift 0", () => {
      const results = singleResult();

      const publishPlan = buildRealDataResultIssuePublishPlan(
        results,
        VALID_RUN,
      );
      const reportPlan = buildRealDataResultReportPlan(results, VALID_RUN);

      // summary 축 동일 source.
      expect(publishPlan.report.summary).toEqual(reportPlan.summary);
      // descriptor 축 동일 source.
      expect(publishPlan.report.descriptor).toEqual(reportPlan.descriptor);
    });
  });

  describe("multi-result 집계 분기에서도 report 동형 수렴(branch)", () => {
    it("results 가 다양 difficulty/contribution 등급 분포 2+ 원소 → publishPlan.report.summary 의 count/byDifficulty/byContribution/totalVolume 가 reportPlan.summary 와 전부 일치 + descriptor.body byte-identical(일부 슬롯만 drift 0)", () => {
      const results = multiResult();

      const publishPlan = buildRealDataResultIssuePublishPlan(
        results,
        VALID_RUN,
      );
      const reportPlan = buildRealDataResultReportPlan(results, VALID_RUN);

      const pubSummary = publishPlan.report.summary;
      const repSummary = reportPlan.summary;

      // 집계 4 필드 전부 일치(다수 result 에서도 두 경로 동일 분포로 수렴).
      expect(pubSummary.count).toBe(repSummary.count);
      expect(pubSummary.count).toBe(3);
      expect(pubSummary.byDifficulty).toEqual(repSummary.byDifficulty);
      expect(pubSummary.byContribution).toEqual(repSummary.byContribution);
      expect(pubSummary.totalVolume).toBe(repSummary.totalVolume);
      expect(pubSummary.totalVolume).toBe(17);

      // descriptor body byte-identical — 두 경로 동일 본문으로 수렴.
      expect(publishPlan.report.descriptor.body).toBe(
        reportPlan.descriptor.body,
      );
    });
  });

  describe("partial-thread 격리 — 두 경로가 같은 source 따라 동시 이동(branch)", () => {
    it("서로 다른 results 로 두 composer 함께 호출 → publishPlan.report 와 reportPlan 이 함께 동형 변화(한 경로만 stale source 면 publish 본문≠standalone 리포트 회귀를 그물로 박제)", () => {
      // source A.
      const resultsA = singleResult();
      const publishA = buildRealDataResultIssuePublishPlan(resultsA, VALID_RUN);
      const reportA = buildRealDataResultReportPlan(resultsA, VALID_RUN);

      // source B(다른 results — multi).
      const resultsB = multiResult();
      const publishB = buildRealDataResultIssuePublishPlan(resultsB, VALID_RUN);
      const reportB = buildRealDataResultReportPlan(resultsB, VALID_RUN);

      // 두 경로의 report 가 source A→B 로 **함께** 이동(drift 0).
      expect(publishA.report).not.toEqual(publishB.report);
      expect(reportA).not.toEqual(reportB);

      // source A: 두 경로 report 가 함께 reportA 로 수렴.
      expect(publishA.report).toEqual(reportA);
      // source B: 두 경로 report 가 함께 reportB 로 수렴.
      expect(publishB.report).toEqual(reportB);
    });

    it("빈 results([]) + 유효 run → 두 경로 모두 report.summary.count 0 AND 전 difficulty/contribution 슬롯 0 AND totalVolume 0 이되 descriptor 정상 합성(throw 0) + publishPlan.report toEqual reportPlan 보존(경계값)", () => {
      const results: EvaluationResult[] = [];

      const publishPlan = buildRealDataResultIssuePublishPlan(
        results,
        VALID_RUN,
      );
      const reportPlan = buildRealDataResultReportPlan(results, VALID_RUN);

      const summary = publishPlan.report.summary;
      // 빈 입력 → count 0.
      expect(summary.count).toBe(0);
      // 전 difficulty 슬롯 0.
      for (const slot of Object.values(summary.byDifficulty)) {
        expect(slot).toBe(0);
      }
      // 전 contribution 슬롯 0.
      for (const slot of Object.values(summary.byContribution)) {
        expect(slot).toBe(0);
      }
      expect(summary.totalVolume).toBe(0);

      // descriptor 는 정상 합성(throw 0) — body 비-빈.
      expect(typeof publishPlan.report.descriptor.body).toBe("string");
      expect(publishPlan.report.descriptor.body.length).toBeGreaterThan(0);

      // 빈 입력에서도 두 경로 report 수렴 보존.
      expect(publishPlan.report).toEqual(reportPlan);
    });
  });

  describe("error path / negative cases — 두 composer 의 빈/공백 run 식별자 guard 대칭 박제", () => {
    it("빈 문자열 run.gitSha '' → publish-plan composer(buildRealDataResultIssuePublishPlan) throw 전파(descriptor 단계, searchArgv 미도달)", () => {
      const results = singleResult();
      const run: RealDataResultIssueRunRef = {
        gitSha: "",
        dateToken: "2026-06-28",
      };
      expect(() => buildRealDataResultIssuePublishPlan(results, run)).toThrow();
    });

    it("빈 문자열 run.gitSha '' → report-plan composer(buildRealDataResultReportPlan) throw 전파(descriptor 단계)", () => {
      const results = singleResult();
      const run: RealDataResultIssueRunRef = {
        gitSha: "",
        dateToken: "2026-06-28",
      };
      expect(() => buildRealDataResultReportPlan(results, run)).toThrow();
    });

    it("공백-only run.dateToken '   ' → publish-plan composer throw 전파(guard 대칭 — publish 경로 거부)", () => {
      const results = singleResult();
      const run: RealDataResultIssueRunRef = {
        gitSha: "abc1234",
        dateToken: "   ",
      };
      expect(() => buildRealDataResultIssuePublishPlan(results, run)).toThrow();
    });

    it("공백-only run.dateToken '   ' → report-plan composer throw 전파(guard 대칭 — standalone 경로 거부)", () => {
      const results = singleResult();
      const run: RealDataResultIssueRunRef = {
        gitSha: "abc1234",
        dateToken: "   ",
      };
      expect(() => buildRealDataResultReportPlan(results, run)).toThrow();
    });

    it("공백-only run.gitSha '  ' → 두 composer 모두 throw 전파(gitSha·dateToken 두 식별자 축 각각 negative 경로 분리 박제)", () => {
      const results = singleResult();
      const run: RealDataResultIssueRunRef = {
        gitSha: "  ",
        dateToken: "2026-06-28",
      };
      expect(() => buildRealDataResultIssuePublishPlan(results, run)).toThrow();
      expect(() => buildRealDataResultReportPlan(results, run)).toThrow();
    });
  });

  describe("flow / branch — guard 우선순위 cross-composer 정합(branch)", () => {
    it("빈 results([]) + 빈/공백 run.gitSha 경계 → 두 composer 모두 summary 집계(빈 results 도 정상)와 무관하게 descriptor 단계 run guard 가 throw(빈 results 라도 run guard 우선)", () => {
      const empty: EvaluationResult[] = [];

      // 빈 results 면 summary 집계는 throw 0 인데도, run guard 가 descriptor 단계에서 throw.
      expect(() =>
        buildRealDataResultIssuePublishPlan(empty, {
          gitSha: "",
          dateToken: "2026-06-28",
        }),
      ).toThrow();
      expect(() =>
        buildRealDataResultReportPlan(empty, {
          gitSha: "",
          dateToken: "2026-06-28",
        }),
      ).toThrow();
      expect(() =>
        buildRealDataResultIssuePublishPlan(empty, {
          gitSha: "abc1234",
          dateToken: "   ",
        }),
      ).toThrow();
      expect(() =>
        buildRealDataResultReportPlan(empty, {
          gitSha: "abc1234",
          dateToken: "   ",
        }),
      ).toThrow();

      // 유효 run 이면 빈 results 는 throw 0 — guard 가 run 미결정만 막음을 대조 확인(두 경로).
      expect(() =>
        buildRealDataResultIssuePublishPlan(empty, VALID_RUN),
      ).not.toThrow();
      expect(() =>
        buildRealDataResultReportPlan(empty, VALID_RUN),
      ).not.toThrow();
    });
  });

  describe("credential 누출 0 — 두 산출물 어느 출력에도 secret/raw 활동 미포함(§9·R-59)", () => {
    it("publishPlan·reportPlan 직렬화 어디에도 token/secret/ghp_/--auth 어휘 + raw 외부 활동 본문(commit/PR/issue 본문) 미포함", () => {
      const results = multiResult();

      const publishPlan = buildRealDataResultIssuePublishPlan(
        results,
        VALID_RUN,
      );
      const reportPlan = buildRealDataResultReportPlan(results, VALID_RUN);

      const serialized = [
        JSON.stringify(publishPlan),
        JSON.stringify(reportPlan),
      ]
        .join(" ")
        .toLowerCase();

      // 실 credential leak shape 어휘만 검사.
      for (const secretToken of [
        "ghp_",
        "gho_",
        "--auth",
        "authorization",
        "bearer",
        "password",
        "secret",
      ]) {
        expect(serialized).not.toContain(secretToken);
      }

      // raw 외부 활동 데이터(commit/PR/issue 본문) 미포함 — 식별자·집계 카운트·분포 enum·
      // 요약 렌더 본문만(R-59 정합).
      const rawSerialized = [
        JSON.stringify(publishPlan),
        JSON.stringify(reportPlan),
      ].join(" ");
      expect(rawSerialized).not.toContain('"diff"');
      expect(rawSerialized).not.toContain('"message"');
    });
  });

  describe("결정론 · 무공유 · no-mutation — 동일 (results, run) 두 번 호출 + 입력 불변", () => {
    it("두 composer 각각 두 번 호출 → deep-equal 산출(toEqual) + 새 객체(not.toBe)", () => {
      const results = singleResult();

      const publishA = buildRealDataResultIssuePublishPlan(results, VALID_RUN);
      const publishB = buildRealDataResultIssuePublishPlan(results, VALID_RUN);
      const reportA = buildRealDataResultReportPlan(results, VALID_RUN);
      const reportB = buildRealDataResultReportPlan(results, VALID_RUN);

      // 값은 deep-equal(결정론 — 입력만의 함수).
      expect(publishA).toEqual(publishB);
      expect(reportA).toEqual(reportB);

      // 참조는 무공유 — 매 호출 새 plan 객체.
      expect(publishA).not.toBe(publishB);
      expect(reportA).not.toBe(reportB);
    });

    it("입력 results(중첩 result 원소)·run(gitSha/dateToken string 원시)가 두 composer 호출 전후로 mutate 0(deep-equal snapshot 보존)", () => {
      const results = multiResult();
      const run: RealDataResultIssueRunRef = {
        gitSha: "abc1234",
        dateToken: "2026-06-28",
      };
      const resultsBefore = JSON.parse(JSON.stringify(results));
      const runBefore = JSON.parse(JSON.stringify(run));

      buildRealDataResultIssuePublishPlan(results, run);
      buildRealDataResultReportPlan(results, run);

      // 호출 후 입력 동형(무공유 보존 — 출력 변형이 입력에 누설 0).
      expect(results).toEqual(resultsBefore);
      expect(run).toEqual(runBefore);
    });
  });
});
