// realdata-e2e-summary-descriptor-body-confluence-assembly.smoke-spec.ts —
// 실 평가 e2e summary→descriptor body 3-블록 confluence 조립 체인 non-gated
// build-time smoke (T-0750 박제, PLAN.md 109행 🟢 실 평가 e2e).
//
// 본 spec 의 존재 이유 — public CI gap 해소(결과 요약 렌더 트리오 종결,
// markdown T-0748 · line T-0749 · descriptor-body confluence T-0750):
//   - PLAN 109행 step ③(평가) → step ④(결과 이슈 박제) 경계의 종단 컴포저
//     `buildRealDataResultIssueDescriptor(summary, run)`(T-0582)는 이슈 본문 `body`
//     를 **3 블록 confluence** 로 합성한다 — `[marker, "", line, "", markdown]
//     .join("\n")`. 즉 한 줄 렌더(`formatRealDataResultSummaryLine`, T-0642/T-0749)
//     와 markdown 렌더(`renderRealDataResultSummaryMarkdown`, T-0581/T-0748)가
//     **같은 summary 로부터 동시에** descriptor body 안으로 합류하는 confluence
//     지점이다.
//   - T-0748/T-0749 는 각 renderer 를 summary 대비 **고립** 검증할 뿐 descriptor body
//     안 합류는 보지 않고, T-0740(result-report-plan) smoke 는 descriptor 를 직접
//     호출과 deep-equal + `body.length>0` + `body.toContain(marker)` 만 단언할 뿐
//     body 를 쪼개 한 줄 블록 ↔ `formatRealDataResultSummaryLine(summary)` ·
//     markdown 블록 ↔ `renderRealDataResultSummaryMarkdown(summary)` 정합 · 단일
//     source · 블록 순서/구분 빈 줄 무결성을 단언하지 않는다. 본 spec 이 그
//     confluence gap 을 public CI 그물로 박제한다.
//   - 평가 leg(실 LLM / EvaluationScoringService.scoreUnit /
//     EvaluationOrchestratorService / LlmHttpGateway / Ollama / 실 github 수집 / 실 gh
//     issue / 실 jest spawn)는 복제하지 않고 synthetic EvaluationResult literal 을
//     직접 공급해 우회한다(조립 surface 만 검증). 따라서 본 spec 은:
//
//      🔥 실 LLM 호출 0 — orchestrator / scoring service / gateway 미사용. synthetic
//         EvaluationResult literal 을 buildRealDataResultSummary 에 직접 공급.
//      🔥 실 네트워크 호출 0 — github / Ollama / gh 호출 0. fetch 0. process.env 읽기 0.
//      🔥 실 DB 접근 0 / 실 jest spawn 0 — summary→descriptor 조립만.
//      🔥 credential 0 / secret 0 / 비용 0 — public CI 에서 항상 green 발화(R-113).
//      🔥 새 외부 dependency 0 — 기존 build*/format*/render* 컴포저 import 재사용만
//         (consistency-guard 신설 금지 — sweep 종결, T-0726).
//      🔥 gating / describe.skip 배선 0 — 순수 build-time in-memory 검증만.
//
// Out of Scope (T-0750):
//   - 실 LLM round-trip / scoreUnit / orchestrator / gateway / Ollama — 본 spec 은
//     평가 leg 를 synthetic 결과 literal 로 대체(실 평가 0). live leg 검증은 기존
//     realdata-e2e-live.smoke-spec.ts 책임.
//   - 실 github 네트워크 수집 / gh 실행 / 실 이슈 search·create·edit·박제 / 실 jest spawn.
//   - 새 컴포저 / 가드 / helper / type 신설 — 기존 buildRealDataResultSummary /
//     buildRealDataResultIssueDescriptor / formatRealDataResultSummaryLine /
//     renderRealDataResultSummaryMarkdown import 재사용만.
//   - T-0748(markdown 고립) · T-0749(line 고립) · T-0740(report-plan aggregator) 의
//     기존 단언 중복 복제 — 본 task 는 descriptor body 안 **confluence**(두 renderer
//     합류 · 단일 source · 블록 순서/구분 무결성)만 책임.
//   - title·marker identity 정합(T-0709 가드 영역) · command-args / search-argv 후속
//     leg — 본 task 범위 밖.
//   - production src/ 코드 / 기존 컴포저 소스 / 위임 helper / consistency 가드 수정 —
//     test-only(신규 smoke spec 1 파일).
import type { EvaluationResult } from "../../src/assessment-evaluation/domain/evaluation-result";
import { buildRealDataResultIssueDescriptor } from "../helpers/realdata-e2e-result-issue-descriptor";
import type { RealDataResultIssueRunRef } from "../helpers/realdata-e2e-result-issue-descriptor";
import { buildRealDataResultSummary } from "../helpers/realdata-e2e-result-summary";
import { formatRealDataResultSummaryLine } from "../helpers/realdata-e2e-result-summary-line";
import { renderRealDataResultSummaryMarkdown } from "../helpers/realdata-e2e-result-summary-markdown";

// 본 smoke 공통 fixture — 결정론 run 식별자(gitSha + dateToken 비공백). 매 it 가
// validRun() 으로 spread 복제를 받아 입력 RUN_REF mutate 누설 0.
const RUN_REF: RealDataResultIssueRunRef = {
  gitSha: "abc1234",
  dateToken: "2026-06-28",
};

// 입력 RUN_REF 의 무공유 복제본을 반환 — happy/flow/결정론 case 의 공통 진입.
function validRun(): RealDataResultIssueRunRef {
  return { ...RUN_REF };
}

// synthetic EvaluationResult 1 건 — descriptor 컴포저는 결과 배열을 요약 집계
// (count·분포·totalVolume) → body 3 블록으로 흘려보내는 confluence surface 만
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
      "synthetic evaluation narrative — summary-descriptor-body confluence smoke fixture",
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

// body 3-블록 분해 — descriptor.body 는 `[marker, "", line, "", markdown].join("\n")`
// 구조다. marker 와 line 은 단일 라인(개행 0)이고 markdown 은 다행이므로, 줄 단위로
// 쪼개면 index 0=marker, 1="", 2=line, 3="", 4+ = markdown 라인들이다. 이 구조를
// single source 로 추출해 각 블록을 직접 renderer 결과와 byte-identical 대조한다.
function splitBodyBlocks(body: string): {
  markerLine: string;
  firstBlank: string;
  lineBlock: string;
  secondBlank: string;
  markdownBlock: string;
} {
  const lines = body.split("\n");
  return {
    markerLine: lines[0],
    firstBlank: lines[1],
    lineBlock: lines[2],
    secondBlank: lines[3],
    markdownBlock: lines.slice(4).join("\n"),
  };
}

describe("Smoke(non-gated): 실 평가 e2e summary→descriptor body 3-블록 confluence 조립 체인(results→summary→descriptor) live-LLM 0 검증", () => {
  describe("happy path — 종단 조립 descriptor body 산출", () => {
    it("다수 results(난이도/기여도/volume 다양) + 유효 run → descriptor.body 가 string·non-empty 이고 marker 라인을 정확히 1 회 포함(멱등 search-or-update 기반)", () => {
      const results = [
        syntheticResult("github:github.com:c1", "easy", "low", 3),
        syntheticResult("github:github.com:c2", "medium", "high", 5),
        syntheticResult("github:github.com:c3", "hard", "medium", 2),
      ];

      const { descriptor } = assembleViaChain(results, validRun());

      expect(typeof descriptor.body).toBe("string");
      expect(descriptor.body.length).toBeGreaterThan(0);
      // marker 가 body 에 정확히 1 회 등장(멱등 — 중복 0).
      expect(descriptor.body).toContain(descriptor.marker);
      expect(descriptor.body.split(descriptor.marker)).toHaveLength(2);
    });
  });

  describe("confluence — 한 줄 블록 단일 source(descriptor body 안 line ↔ formatRealDataResultSummaryLine(summary))", () => {
    it("body 의 한 줄 요약 블록이 동일 summary 의 직접 formatRealDataResultSummaryLine(summary) 결과와 byte-identical(같은 summary 단일 source thread)", () => {
      const results = [
        syntheticResult("github:github.com:l1", "easy", "low", 3),
        syntheticResult("github:github.com:l2", "medium", "high", 5),
        syntheticResult("github:github.com:l3", "hard", "medium", 2),
      ];

      const { summary, descriptor } = assembleViaChain(results, validRun());
      const directLine = formatRealDataResultSummaryLine(summary);
      const { lineBlock } = splitBodyBlocks(descriptor.body);

      // body 안의 한 줄 블록이 직접 renderer 산출과 byte-identical(가공 0 합성).
      expect(lineBlock).toBe(directLine);
      // 한 줄 블록이 정확히 1 회 등장(중복 0 — body 안에서 단일 라인).
      expect(descriptor.body.split(directLine)).toHaveLength(2);
    });
  });

  describe("confluence — markdown 블록 단일 source(descriptor body 안 markdown ↔ renderRealDataResultSummaryMarkdown(summary))", () => {
    it("body 의 markdown 블록이 동일 summary 의 직접 renderRealDataResultSummaryMarkdown(summary) 결과와 byte-identical(가공 0 합성)", () => {
      const results = [
        syntheticResult("github:github.com:m1", "easy", "zero", 2),
        syntheticResult("github:github.com:m2", "hard", "high", 4),
      ];

      const { summary, descriptor } = assembleViaChain(results, validRun());
      const directMarkdown = renderRealDataResultSummaryMarkdown(summary);
      const { markdownBlock } = splitBodyBlocks(descriptor.body);

      expect(markdownBlock).toBe(directMarkdown);
      // markdown 블록이 body 끝(slice(4))에 정확히 위치 — 잔여 가공 0.
      expect(descriptor.body.endsWith(directMarkdown)).toBe(true);
    });
  });

  describe("블록 순서·구분 무결성 — body 가 [marker, '', line, '', markdown].join('\\n') 구조", () => {
    it("body 가 marker → 빈 줄 → 한 줄 요약 → 빈 줄 → markdown 순서이며 각 블록이 빈 줄 1 개로 구분됨(순서/구분자 회귀 가드)", () => {
      const results = [
        syntheticResult("github:github.com:o1", "easy", "low", 1),
        syntheticResult("github:github.com:o2", "medium", "high", 2),
      ];

      const { summary, descriptor } = assembleViaChain(results, validRun());
      const blocks = splitBodyBlocks(descriptor.body);

      // index 0 = marker, 1 = 빈 줄, 2 = line, 3 = 빈 줄, 4+ = markdown.
      expect(blocks.markerLine).toBe(descriptor.marker);
      expect(blocks.firstBlank).toBe("");
      expect(blocks.lineBlock).toBe(formatRealDataResultSummaryLine(summary));
      expect(blocks.secondBlank).toBe("");
      expect(blocks.markdownBlock).toBe(
        renderRealDataResultSummaryMarkdown(summary),
      );

      // 종단 조립 body 가 동일 구조의 직접 재합성과 byte-identical(구조 single source).
      const expectedBody = [
        descriptor.marker,
        "",
        formatRealDataResultSummaryLine(summary),
        "",
        renderRealDataResultSummaryMarkdown(summary),
      ].join("\n");
      expect(descriptor.body).toBe(expectedBody);
    });

    it("marker 직후가 빈 줄, 그 뒤가 한 줄 요약 — marker 와 한 줄 요약 사이에 정확히 빈 줄 1 개(구분자 무결성)", () => {
      const results = [
        syntheticResult("github:github.com:sep1", "hard", "high", 9),
      ];

      const { descriptor } = assembleViaChain(results, validRun());
      const lines = descriptor.body.split("\n");

      expect(lines[0]).toBe(descriptor.marker);
      expect(lines[1]).toBe("");
      // 한 줄 요약은 비어있지 않음(빈 줄 2 개 연속 아님).
      expect(lines[2].length).toBeGreaterThan(0);
    });
  });

  describe("단일 source 교차 단언 — 중간 summary 단일 source(직접 renderer 2 개 통과 블록 ↔ body 내 블록 일치)", () => {
    it("buildRealDataResultSummary(results) 를 한 번만 만들어 직접 renderer 2 개에 통과시킨 블록이 descriptor body 내 line/markdown 블록과 각각 일치(중간 summary 단일 source)", () => {
      const results = [
        syntheticResult("github:github.com:x1", "easy", "low", 1),
        syntheticResult("github:github.com:x2", "easy", "high", 2),
        syntheticResult("github:github.com:x3", "hard", "medium", 4),
      ];
      const run = validRun();

      // summary 를 한 번만 생성 — 직접 renderer 2 개와 descriptor 가 같은 source.
      const summary = buildRealDataResultSummary(results);
      const directLine = formatRealDataResultSummaryLine(summary);
      const directMarkdown = renderRealDataResultSummaryMarkdown(summary);
      const descriptor = buildRealDataResultIssueDescriptor(summary, run);

      const { lineBlock, markdownBlock } = splitBodyBlocks(descriptor.body);
      expect(lineBlock).toBe(directLine);
      expect(markdownBlock).toBe(directMarkdown);
    });

    it("동일 (results, run) 두 번 조립 시 descriptor.body 결정론 동일(byte-identical)", () => {
      const results = [
        syntheticResult("github:github.com:d1", "medium", "low", 1),
        syntheticResult("github:github.com:d2", "medium", "medium", 6),
      ];

      const a = assembleViaChain(results, validRun());
      const b = assembleViaChain(results, validRun());

      expect(a.descriptor.body).toBe(b.descriptor.body);
    });
  });

  describe("flow / branch — 빈 / 단일 / 다수 results 분포 각각 confluence 성립", () => {
    it("빈 results([]) — body 가 3-블록 구조·marker 포함 + line/markdown 블록이 빈-summary 직접 renderer 와 여전히 일치", () => {
      const { summary, descriptor } = assembleViaChain([], validRun());

      // 빈 summary 분기에서도 3-블록 confluence 성립.
      const blocks = splitBodyBlocks(descriptor.body);
      expect(blocks.markerLine).toBe(descriptor.marker);
      expect(blocks.lineBlock).toBe(formatRealDataResultSummaryLine(summary));
      expect(blocks.markdownBlock).toBe(
        renderRealDataResultSummaryMarkdown(summary),
      );
      expect(descriptor.body).toContain(descriptor.marker);
    });

    it("단일 result — line/markdown 블록이 단일-원소 summary 직접 renderer 와 일치", () => {
      const results = [
        syntheticResult("github:github.com:single", "medium", "medium", 7),
      ];

      const { summary, descriptor } = assembleViaChain(results, validRun());
      const blocks = splitBodyBlocks(descriptor.body);

      expect(blocks.lineBlock).toBe(formatRealDataResultSummaryLine(summary));
      expect(blocks.markdownBlock).toBe(
        renderRealDataResultSummaryMarkdown(summary),
      );
    });

    it("다수 result(슬롯 누적) — line/markdown 블록이 누적 summary 직접 renderer 와 일치", () => {
      const results = [
        syntheticResult("github:github.com:b1", "easy", "low", 1),
        syntheticResult("github:github.com:b2", "easy", "high", 2),
        syntheticResult("github:github.com:b3", "hard", "low", 4),
      ];

      const { summary, descriptor } = assembleViaChain(results, validRun());
      const blocks = splitBodyBlocks(descriptor.body);

      // 누적 분포(easy 2 · low 2) 가 양 renderer 산출에 동일하게 반영.
      expect(blocks.lineBlock).toBe(formatRealDataResultSummaryLine(summary));
      expect(blocks.markdownBlock).toBe(
        renderRealDataResultSummaryMarkdown(summary),
      );
    });
  });

  describe("negative cases — run 결손 guard 전파 / raw 누출 0(예외 분기마다 1+)", () => {
    // results 는 유효 단일 result 로 고정해 run 결손만 고립 검증한다. summary 집계는
    // run guard 와 무관하므로 산출되지만 descriptor 단계에서 throw 가 전파된다.
    const okResults = [
      syntheticResult("github:github.com:neg", "easy", "low", 1),
    ];

    it("run.gitSha 빈 문자열 — 위임 descriptor assertNonBlank throw 가 그대로 전파(자체 try/catch 0)", () => {
      const summary = buildRealDataResultSummary(okResults);
      expect(() =>
        buildRealDataResultIssueDescriptor(summary, {
          gitSha: "",
          dateToken: RUN_REF.dateToken,
        }),
      ).toThrow();
    });

    it("run.gitSha 공백만 — 위임 guard throw 가 그대로 전파", () => {
      const summary = buildRealDataResultSummary(okResults);
      expect(() =>
        buildRealDataResultIssueDescriptor(summary, {
          gitSha: "   ",
          dateToken: RUN_REF.dateToken,
        }),
      ).toThrow();
    });

    it("run.dateToken 빈 문자열 — 위임 guard throw 가 그대로 전파", () => {
      const summary = buildRealDataResultSummary(okResults);
      expect(() =>
        buildRealDataResultIssueDescriptor(summary, {
          gitSha: RUN_REF.gitSha,
          dateToken: "",
        }),
      ).toThrow();
    });

    it("run.dateToken 공백만 — 위임 guard throw 가 그대로 전파", () => {
      const summary = buildRealDataResultSummary(okResults);
      expect(() =>
        buildRealDataResultIssueDescriptor(summary, {
          gitSha: RUN_REF.gitSha,
          dateToken: "   ",
        }),
      ).toThrow();
    });

    it("raw narrative / credential 누출 0 — synthetic narrative 에 sentinel 주입해도 body 에 미등장(R-59/REQ-032, count/volume·슬롯·marker 만)", () => {
      const sentinel = "SENTINEL_RAW_NARRATIVE_LEAK_PROBE_T_0750";
      const r1 = syntheticResult("github:github.com:r1", "easy", "low", 1);
      const r2 = syntheticResult("github:github.com:r2", "medium", "high", 2);
      r1.narrative = `${sentinel} a`;
      r2.narrative = `${sentinel} b`;

      const { descriptor } = assembleViaChain([r1, r2], validRun());

      // raw narrative 본문·unitId·credential 류 어휘가 body 로 새지 않음.
      expect(descriptor.body).not.toContain(sentinel);
      expect(descriptor.body).not.toContain("narrative");
      expect(descriptor.body).not.toContain("github:github.com:r1");
      expect(descriptor.body.toLowerCase()).not.toContain("token");
      expect(descriptor.body.toLowerCase()).not.toContain("secret");
    });
  });

  describe("결정론 · 무공유 · no-mutation — 동일 입력 반복 조립 + 입력 불변", () => {
    it("동일 (results, run) 반복 조립이 body byte-identical(결정론 — 입력만의 함수)", () => {
      const results = [
        syntheticResult("github:github.com:r1", "easy", "low", 3),
        syntheticResult("github:github.com:r2", "hard", "high", 6),
      ];
      expect(assembleViaChain(results, validRun()).descriptor.body).toBe(
        assembleViaChain(results, validRun()).descriptor.body,
      );
    });

    it("조립이 입력 results · run 객체를 mutate 하지 않음(before/after deep-equal 스냅샷 비교)", () => {
      const results = [
        syntheticResult("github:github.com:n1", "easy", "low", 1),
        syntheticResult("github:github.com:n2", "medium", "high", 2),
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
