// realdata-e2e-summary-descriptor-identity-confluence-assembly.smoke-spec.ts —
// 실 평가 e2e summary→descriptor title·marker identity-side(공유 run-token)
// confluence 조립 체인 non-gated build-time smoke (T-0751 박제,
// PLAN.md 109행 🟢 실 평가 e2e).
//
// 본 spec 의 존재 이유 — public CI gap 해소(descriptor 두 confluence 축의 짝 닫기):
//   - PLAN 109행 step ③(평가) → step ④(결과 이슈 박제) 경계의 종단 컴포저
//     `buildRealDataResultIssueDescriptor(summary, run)`(T-0582)는 descriptor 3 필드
//     (`{title, marker, body}`)를 두 개의 독립 confluence 축으로 합성한다:
//       1. body-side — `body = [marker, "", line, "", markdown].join("\n")`. 이 3-블록
//          합류는 **T-0750** 이 직접-체인 smoke 로 박제 완결했다.
//       2. identity-side(본 spec) — `title = ${ISSUE_TITLE_PREFIX} ${token}` 와
//          `marker = ${ISSUE_MARKER_PREFIX} ${token} -->` 가 **동일한
//          `runToken(run) = ${run.dateToken}@${run.gitSha}` 단일 source** 로부터 서로
//          다른 고정 prefix 로 합성된다. title·marker 는 summary 무관(동일 run + 다른
//          summary → 동일 title·marker, body 만 변함)이며, 멱등 search-or-update 의
//          기반(동일 run → 동일 marker → 같은 이슈 갱신, 서로 다른 run → 다른 marker →
//          다른 이슈)이다.
//   - T-0750 의 confluence smoke 는 `descriptor.body` 의 3-블록(marker 라인 포함)만
//     검증할 뿐, title·marker 가 같은 `dateToken@gitSha` 토큰을 공유한다는 단언·
//     title·marker 의 summary-독립성·run-identifier 단일 source threading(서로 다른
//     run → 서로 다른 title·marker, 동일 run → 동일)은 부재다. 본 spec 이 그
//     identity-side gap 을 public CI 그물로 박제해, descriptor 의 두 축을 모두
//     직접-체인으로 닫는다.
//   - 평가 leg(실 LLM / EvaluationScoringService.scoreUnit /
//     EvaluationOrchestratorService / LlmHttpGateway / Ollama / 실 github 수집 / 실 gh
//     issue / 실 jest spawn / 실 git sha·timestamp)는 복제하지 않고 synthetic
//     EvaluationResult literal + run literal 을 직접 공급해 우회한다(조립 surface 만
//     검증). 따라서 본 spec 은:
//
//      🔥 실 LLM 호출 0 — orchestrator / scoring service / gateway 미사용. synthetic
//         EvaluationResult literal 을 buildRealDataResultSummary 에 직접 공급.
//      🔥 실 네트워크 호출 0 — github / Ollama / gh 호출 0. fetch 0. process.env 읽기 0.
//      🔥 실 DB 접근 0 / 실 jest spawn 0 / 실 git sha·timestamp 읽기 0 — run literal 직접 주입.
//      🔥 credential 0 / secret 0 / 비용 0 — public CI 에서 항상 green 발화(R-113).
//      🔥 새 외부 dependency 0 — 기존 build*/buildRealDataResultIssueDescriptor 컴포저
//         import 재사용만(consistency-guard 신설 금지 — sweep 종결, T-0726).
//      🔥 gating / describe.skip 배선 0 — 순수 build-time in-memory 검증만.
//      🔥 ISSUE_TITLE_PREFIX / ISSUE_MARKER_PREFIX 는 private const(export 0) — literal
//         prefix 하드코딩 대신 token 경계 split 로 **구조적 단언**만 한다.
//
// Out of Scope (T-0751):
//   - descriptor.body 3-블록 confluence(T-0750, marker 라인 포함 body byte-identical) —
//     본 task 는 title·marker identity-side(run-token 공유)만 책임(중복 0).
//   - T-0748(markdown 고립) · T-0749(line 고립) · T-0740(report-plan aggregator) ·
//     command-plan / gh-command-plan / publish 계열 smoke — 별개 절단면.
//   - 실 LLM round-trip / scoreUnit / orchestrator / gateway / Ollama / DB / 실 gh /
//     실 git sha·timestamp / 실 jest spawn / 실 네트워크.
//   - 새 컴포저 / 가드 / helper / consistency-guard 신설 — 기존 import 재사용만.
//   - ISSUE_TITLE_PREFIX / ISSUE_MARKER_PREFIX 를 export 로 바꾸거나 literal 비교 —
//     private const 유지, 구조적(token 경계 split) 단언만.
//   - production src/ 코드 / 기존 컴포저 소스 / 위임 helper / consistency 가드 수정 /
//     test/jest-smoke.json 변경 — test-only(신규 smoke spec 1 파일).
import type { EvaluationResult } from "../../src/assessment-evaluation/domain/evaluation-result";
import { buildRealDataResultIssueDescriptor } from "../helpers/realdata-e2e-result-issue-descriptor";
import type { RealDataResultIssueRunRef } from "../helpers/realdata-e2e-result-issue-descriptor";
import { buildRealDataResultSummary } from "../helpers/realdata-e2e-result-summary";

// 본 smoke 공통 fixture — 결정론 run 식별자(gitSha + dateToken 비공백). 매 it 가
// validRun() 으로 spread 복제를 받아 입력 RUN_REF mutate 누설 0.
const RUN_REF: RealDataResultIssueRunRef = {
  gitSha: "abc1234",
  dateToken: "2026-06-28",
};

// 입력 RUN_REF 의 무공유 복제본 — happy/flow/결정론 case 의 공통 진입.
function validRun(): RealDataResultIssueRunRef {
  return { ...RUN_REF };
}

// 합성 run-token — 컴포저 내부 `runToken(run) = ${dateToken}@${gitSha}` 와 동일 규칙으로
// test 측에서 재유도한 expected 공유 substring. literal prefix 는 private 이라 만지지
// 않고, 이 token 만 title·marker 양쪽에 등장(공유)함을 구조적으로 단언한다.
function expectedToken(run: RealDataResultIssueRunRef): string {
  return `${run.dateToken}@${run.gitSha}`;
}

// synthetic EvaluationResult 1 건 — descriptor 컴포저는 결과 배열을 요약 집계
// (count·분포·totalVolume) → body 로만 흘려보내고 title·marker 는 run 만의 함수이므로,
// 도메인 타입 정합(difficulty / contribution 멤버십)만 만족하는 minimal literal 로
// 충분하다. 실 LLM 호출 없이 EvaluationResult shape 만 강제한다.
function syntheticResult(
  unitId: string,
  difficulty: EvaluationResult["difficulty"],
  contribution: EvaluationResult["contribution"],
  volume: number,
): EvaluationResult {
  return {
    unitId,
    narrative:
      "synthetic evaluation narrative — summary-descriptor-identity confluence smoke fixture",
    difficulty,
    contribution,
    volume,
  };
}

// assembleViaChain — 본 smoke 의 종단 조립 진입. results→summary→descriptor 한 호출.
function assembleViaChain(
  results: EvaluationResult[],
  run: RealDataResultIssueRunRef,
) {
  const summary = buildRealDataResultSummary(results);
  const descriptor = buildRealDataResultIssueDescriptor(summary, run);
  return { summary, descriptor };
}

describe("Smoke(non-gated): 실 평가 e2e summary→descriptor title·marker identity-side(공유 run-token) confluence 조립 체인(results→summary→descriptor) live-LLM 0 검증", () => {
  describe("happy path — title·marker 가 공유 run-token 으로 합성", () => {
    it("다수 results + 유효 run → descriptor.title·descriptor.marker 가 string·non-empty 이고 둘 다 합성 run-token(${dateToken}@${gitSha})을 포함(공유 source)", () => {
      const results = [
        syntheticResult("github:github.com:c1", "easy", "low", 3),
        syntheticResult("github:github.com:c2", "medium", "high", 5),
        syntheticResult("github:github.com:c3", "hard", "medium", 2),
      ];
      const run = validRun();
      const token = expectedToken(run);

      const { descriptor } = assembleViaChain(results, run);

      expect(typeof descriptor.title).toBe("string");
      expect(typeof descriptor.marker).toBe("string");
      expect(descriptor.title.length).toBeGreaterThan(0);
      expect(descriptor.marker.length).toBeGreaterThan(0);
      // title·marker 가 같은 합성 run-token 을 thread(단일 source).
      expect(descriptor.title).toContain(token);
      expect(descriptor.marker).toContain(token);
    });

    it("title !== marker(서로 다른 prefix·서로 다른 문자열) 이면서 동일 token 을 공유(공유 substring 이 양쪽에 등장)", () => {
      const run = validRun();
      const token = expectedToken(run);

      const { descriptor } = assembleViaChain(
        [syntheticResult("github:github.com:hp", "medium", "medium", 4)],
        run,
      );

      // title 과 marker 는 서로 다른 고정 prefix 라 문자열 자체는 다르다.
      expect(descriptor.title).not.toBe(descriptor.marker);
      // 그러나 둘 다 동일 token 을 공유(공유 source — title·marker 합류).
      expect(descriptor.title).toContain(token);
      expect(descriptor.marker).toContain(token);
    });

    it("descriptor.marker 가 descriptor.body 첫 줄로 정확히 1 회 등장(identity↔body 정합 — marker round-token)", () => {
      const run = validRun();

      const { descriptor } = assembleViaChain(
        [syntheticResult("github:github.com:mb", "hard", "high", 7)],
        run,
      );

      // marker 가 body 첫 줄로 등장(identity 축이 body 축으로 합류하는 round-token).
      expect(descriptor.body.split("\n")[0]).toBe(descriptor.marker);
      // marker 가 body 에 정확히 1 회(멱등 — 중복 0).
      expect(descriptor.body.split(descriptor.marker)).toHaveLength(2);
    });
  });

  describe("identity-confluence 단일 source — token 경계 split 로 고정 prefix 구조 검증", () => {
    it("title.split(token) / marker.split(token) 가 token 을 사이에 둔 고정 prefix(+marker suffix) 로 분해되고, 양쪽이 동일 token substring 을 thread(literal prefix 하드코딩 0)", () => {
      const run = validRun();
      const token = expectedToken(run);

      const { descriptor } = assembleViaChain(
        [syntheticResult("github:github.com:s1", "easy", "low", 1)],
        run,
      );

      // token 경계로 쪼개면 [고정 prefix, 나머지] 2 조각 — token 이 양쪽에 정확히 1 회.
      const titleParts = descriptor.title.split(token);
      const markerParts = descriptor.marker.split(token);
      expect(titleParts).toHaveLength(2);
      expect(markerParts).toHaveLength(2);

      // title 은 prefix + token(뒤 잔여 0): split 의 두 번째 조각이 빈 문자열.
      expect(titleParts[1]).toBe("");
      // title 의 고정 prefix(token 앞부분)는 비어있지 않음(prefix 존재).
      expect(titleParts[0].length).toBeGreaterThan(0);
      // marker 는 prefix + token + suffix: 두 번째 조각(suffix)이 비어있지 않음.
      expect(markerParts[0].length).toBeGreaterThan(0);
      expect(markerParts[1].length).toBeGreaterThan(0);
      // title prefix 와 marker prefix 는 서로 다름(서로 다른 고정 머리).
      expect(titleParts[0]).not.toBe(markerParts[0]);
    });

    it("동일 run 반복 호출 시 token 을 제거한 고정 prefix(title)·prefix+suffix(marker)가 불변(결정론적 고정 prefix)", () => {
      const run = validRun();
      const token = expectedToken(run);

      const a = assembleViaChain(
        [syntheticResult("github:github.com:p1", "easy", "low", 1)],
        run,
      ).descriptor;
      const b = assembleViaChain(
        [syntheticResult("github:github.com:p2", "hard", "high", 9)],
        run,
      ).descriptor;

      // 서로 다른 summary 여도 token 경계 split 의 고정 부분(prefix/suffix)이 동일.
      expect(a.title.split(token)).toEqual(b.title.split(token));
      expect(a.marker.split(token)).toEqual(b.marker.split(token));
    });
  });

  describe("summary-독립성(핵심) — 동일 run + 서로 다른 summary → 동일 title·marker, 다른 body", () => {
    it("동일 run·서로 다른 results(다른 summary) → title·marker 동일(summary 무관·run 만의 함수)", () => {
      const run = validRun();
      const resultsA = [
        syntheticResult("github:github.com:a1", "easy", "low", 1),
      ];
      const resultsB = [
        syntheticResult("github:github.com:b1", "easy", "low", 1),
        syntheticResult("github:github.com:b2", "medium", "high", 5),
        syntheticResult("github:github.com:b3", "hard", "medium", 9),
      ];

      const da = buildRealDataResultIssueDescriptor(
        buildRealDataResultSummary(resultsA),
        run,
      );
      const db = buildRealDataResultIssueDescriptor(
        buildRealDataResultSummary(resultsB),
        run,
      );

      expect(da.title).toBe(db.title);
      expect(da.marker).toBe(db.marker);
    });

    it("동일 run·서로 다른 summary → body 는 달라야 함(summary 가 body 에는 반영 — title/marker 와 body 의 의존 분리)", () => {
      const run = validRun();
      const resultsA = [
        syntheticResult("github:github.com:ba1", "easy", "low", 1),
      ];
      const resultsB = [
        syntheticResult("github:github.com:bb1", "easy", "low", 1),
        syntheticResult("github:github.com:bb2", "hard", "high", 9),
      ];

      const da = buildRealDataResultIssueDescriptor(
        buildRealDataResultSummary(resultsA),
        run,
      );
      const db = buildRealDataResultIssueDescriptor(
        buildRealDataResultSummary(resultsB),
        run,
      );

      // title·marker 는 같지만(위 test) body 는 summary 차이로 달라짐.
      expect(da.body).not.toBe(db.body);
    });
  });

  describe("run-별 멱등·분리 — 동일 run 멱등 / 서로 다른 run 분리", () => {
    it("동일 run 두 번(summary 무관) → title·marker byte-identical(멱등 search-or-update 토큰 안정)", () => {
      const da = assembleViaChain(
        [syntheticResult("github:github.com:i1", "easy", "low", 1)],
        validRun(),
      ).descriptor;
      const db = assembleViaChain(
        [syntheticResult("github:github.com:i2", "hard", "high", 9)],
        validRun(),
      ).descriptor;

      expect(da.title).toBe(db.title);
      expect(da.marker).toBe(db.marker);
    });

    it("서로 다른 run(gitSha 만 다름) → title·marker 서로 다름(다른 run 의 이슈를 잘못 갱신하지 않음 — 분리)", () => {
      const runA: RealDataResultIssueRunRef = {
        gitSha: "aaa1111",
        dateToken: "2026-06-28",
      };
      const runB: RealDataResultIssueRunRef = {
        gitSha: "bbb2222",
        dateToken: "2026-06-28",
      };
      const results = [
        syntheticResult("github:github.com:g1", "easy", "low", 1),
      ];

      const da = assembleViaChain(results, runA).descriptor;
      const db = assembleViaChain(results, runB).descriptor;

      expect(da.title).not.toBe(db.title);
      expect(da.marker).not.toBe(db.marker);
    });

    it("서로 다른 run(dateToken 만 다름) → title·marker 서로 다름(날짜 축 분리 — gitSha 만 다른 경우와 별개 분기)", () => {
      const runA: RealDataResultIssueRunRef = {
        gitSha: "same9999",
        dateToken: "2026-06-27",
      };
      const runB: RealDataResultIssueRunRef = {
        gitSha: "same9999",
        dateToken: "2026-06-28",
      };
      const results = [
        syntheticResult("github:github.com:d1", "easy", "low", 1),
      ];

      const da = assembleViaChain(results, runA).descriptor;
      const db = assembleViaChain(results, runB).descriptor;

      expect(da.title).not.toBe(db.title);
      expect(da.marker).not.toBe(db.marker);
    });
  });

  describe("negative cases — run 결손 guard 전파(각 필드 독립 분기, 단일 negative 금지)", () => {
    // results 는 유효 단일 result 로 고정해 run 결손만 고립 검증. summary 집계는 run
    // guard 와 무관하므로 산출되지만 descriptor 단계에서 throw 가 조립 경로로 전파된다.
    const okResults = [
      syntheticResult("github:github.com:neg", "easy", "low", 1),
    ];

    it("run.gitSha 빈 문자열 → 조립 경로에서 gitSha guard throw 가 그대로 전파(자체 try/catch 0)", () => {
      expect(() =>
        assembleViaChain(okResults, {
          gitSha: "",
          dateToken: RUN_REF.dateToken,
        }),
      ).toThrow();
    });

    it("run.gitSha 공백만 → gitSha guard throw 전파(공백-only 분기)", () => {
      expect(() =>
        assembleViaChain(okResults, {
          gitSha: "   ",
          dateToken: RUN_REF.dateToken,
        }),
      ).toThrow();
    });

    it("run.dateToken 빈 문자열 → dateToken guard throw 전파(gitSha 유효해도 — 필드별 독립 분기)", () => {
      expect(() =>
        assembleViaChain(okResults, {
          gitSha: RUN_REF.gitSha,
          dateToken: "",
        }),
      ).toThrow();
    });

    it("run.dateToken 공백만 → dateToken guard throw 전파(공백-only 분기)", () => {
      expect(() =>
        assembleViaChain(okResults, {
          gitSha: RUN_REF.gitSha,
          dateToken: "   ",
        }),
      ).toThrow();
    });
  });

  describe("flow / branch — raw 누출 0 / 빈·다수 results 에서 title·marker 불변", () => {
    it("raw narrative / credential 누출 0 — synthetic narrative 에 sentinel 주입해도 title·marker 에 미등장(title·marker 는 run-token 만, narrative 무관 — R-59/REQ-059)", () => {
      const sentinel = "SENTINEL_RAW_NARRATIVE_LEAK_PROBE_T_0751";
      const r1 = syntheticResult("github:github.com:r1", "easy", "low", 1);
      const r2 = syntheticResult("github:github.com:r2", "medium", "high", 2);
      r1.narrative = `${sentinel} a`;
      r2.narrative = `${sentinel} b`;

      const { descriptor } = assembleViaChain([r1, r2], validRun());

      expect(descriptor.title).not.toContain(sentinel);
      expect(descriptor.marker).not.toContain(sentinel);
      expect(descriptor.title.toLowerCase()).not.toContain("token");
      expect(descriptor.marker.toLowerCase()).not.toContain("secret");
    });

    it("빈 results([]) → 빈-summary 여도 title·marker 정상 합성(run 만으로 도출, summary 무관)", () => {
      const run = validRun();
      const token = expectedToken(run);

      const { descriptor } = assembleViaChain([], run);

      expect(descriptor.title.length).toBeGreaterThan(0);
      expect(descriptor.marker.length).toBeGreaterThan(0);
      expect(descriptor.title).toContain(token);
      expect(descriptor.marker).toContain(token);
    });

    it("다수 results(분포 다양) → 동일 run 이면 title·marker 가 빈-results 의 것과 불변(분포 무관)", () => {
      const run = validRun();

      const empty = assembleViaChain([], run).descriptor;
      const many = assembleViaChain(
        [
          syntheticResult("github:github.com:f1", "easy", "low", 1),
          syntheticResult("github:github.com:f2", "medium", "high", 2),
          syntheticResult("github:github.com:f3", "hard", "medium", 4),
          syntheticResult("github:github.com:f4", "easy", "zero", 8),
        ],
        run,
      ).descriptor;

      expect(many.title).toBe(empty.title);
      expect(many.marker).toBe(empty.marker);
    });
  });

  describe("결정론 · 무공유 · no-mutation — 동일 입력 반복 조립 + 입력 불변", () => {
    it("동일 (results, run) 두 번 chain → title·marker byte-identical + 매 호출 새 descriptor 객체(반환 참조 비동일)", () => {
      const results = [
        syntheticResult("github:github.com:dt1", "easy", "low", 3),
        syntheticResult("github:github.com:dt2", "hard", "high", 6),
      ];

      const a = assembleViaChain(results, validRun()).descriptor;
      const b = assembleViaChain(results, validRun()).descriptor;

      // 결정론 — 입력만의 함수.
      expect(a.title).toBe(b.title);
      expect(a.marker).toBe(b.marker);
      // 무공유 — 매 호출 새 객체 참조.
      expect(a).not.toBe(b);
    });

    it("조립이 입력 results · run 객체를 mutate 하지 않음(before/after deep-equal 스냅샷 비교)", () => {
      const results = [
        syntheticResult("github:github.com:m1", "easy", "low", 1),
        syntheticResult("github:github.com:m2", "medium", "high", 2),
      ];
      const run = validRun();
      const resultsBefore = JSON.parse(JSON.stringify(results));
      const runBefore = JSON.parse(JSON.stringify(run));

      assembleViaChain(results, run);

      expect(results).toEqual(resultsBefore);
      expect(results.length).toBe(resultsBefore.length);
      expect(run).toEqual(runBefore);
    });
  });
});
