// realdata-e2e-daily-step-dual-leg-run-report-search-output-stdout-value-
// consistency-convergence-assembly.smoke-spec.ts —
// 실 평가 e2e daily-step dual-leg run report publish chain 의 **입력측 search leg** 을
// search stdout 까지 통과시켜 파서(`parse...IssueSearchOutput`)가 산출한 hits
// (`RealDataDailyStepDualLegRunReportIssueSearchHit[]`)의 **전체 값**(number·title·body)이
// raw `gh search issues --json number,title,body` stdout 으로부터 컴포저 재호출 없이
// **single-source 독립 재유도**(JSON.parse → 배열 → 각 원소 {number,title,body} 추출)한
// expected 배열과 개수·순서·필드값·추가필드 drop 면에서 deep-equal 정합함을 T-0908 가드
// (`assertRealDataDailyStepDualLegRunReportIssueSearchOutputConsistentWithStdout`)로
// 박제하는 search-output↔stdout value-consistency convergence non-gated build-time smoke
// (T-0925 박제, PLAN.md 109행 🟢 실 평가 e2e step ④, REQ-032 raw 미저장 / REQ-059).
//
// 절단면 — 입력측 search-leg parser 산출 hits[] ↔ raw stdout 값-정합(single-source) seam:
//   dual-leg publish chain 은 (1) 먼저 marker 로 `gh search issues` 를 실행해 기존 이슈를
//   찾고(입력 leg), (2) 그 hits 로 create/update 를 결정해 실행한 뒤 output 을 파싱한다
//   (출력 leg). 형제 T-0924 는 (2) 출력 leg output outcome{issueNumber,url} 값-정합을 닫았
//   으나, (1) 입력 leg — 파서가 search stdout 으로부터 hits 배열을 개수·순서·number/title/
//   body 값·추가필드 drop 이 올바르게 산출했는가 — 는 어느 smoke 도 chain 그물로 검증하지
//   않았다(`git grep SearchOutputConsistentWithStdout -- test/smoke/*` = 0 hit). 가드 helper
//   자체(T-0908)와 파서 self-wire(T-0909, search-parse.ts line 161~)는 이미 main 에 박제됨 —
//   본 spec 은 그 self-wire 를 재배선하지 않고 chain 통과 hits 를 가드로 검증하는 **smoke
//   그물만** 신설한다. summary 축 T-0721(`assertRealDataResultIssueSearchOutputConsistent
//   WithStdout`) value-consistency 커버리지의 dual-leg mirror.
//
// 형제 smoke 와의 차별(= 입력 leg search hits[] number/title/body 전체 값 축):
//   * T-0924(output↔stdout value-consistency) — 출력 leg. create/edit exec stdout 까지
//     통과시켜 파서 산출 outcome{issueNumber,url} 값-정합을 T-0906 가드로 박제. 즉 출력측
//     (post-execution) leg 만. 그 output outcome 축 자체 재단언 금지.
//   * T-0923(outcome-parse-shape set-equality) — 출력 leg outcome own-key set ↔ PARSE_SHAPE
//     _KEYS 키 집합만. 그 set-equality 축 자체 재단언 금지.
//   * T-0918~T-0922 — pre→resolve→post argv 절단면·create→update 상태 전이·idempotency·
//     dual-medium 직교만. 그 절단면 자체 재단언 금지.
//   본 spec 은 입력 leg 파서 산출 hits[] 의 number·title·body **전체 값** ↔ search stdout
//   독립 재유도 deep-equal 축만 박제한다(값 drift 는 RangeError·구조 결손은 TypeError 분리).
//
// 따라서 본 spec 은:
//    🔥 실 LLM 호출 0 — orchestrator / scoring service / gateway 미사용. synthetic leg
//       outcome / run / search stdout literal 을 조립 체인에 직접 공급(실 평가·수집·jest
//       spawn 0).
//    🔥 실 네트워크 호출 0 — github / Ollama / gh 호출 0. fetch 0. process.env 읽기 0.
//    🔥 실 gh 실행 0 — search / issue create / issue edit 실 실행 0. execFile('gh', …) 0.
//       실 github search 부작용 0 — search hits 는 synthetic stdout literal.
//    🔥 credential 0 / secret 0 / DB 0 / 비용 0 — public CI 에서 항상 green 발화(R-113).
//    🔥 새 외부 dependency 0 — 기존 build*/parse*/assert* 컴포저 import 재사용만(파서·
//       interface·가드 본문 변경 0 — import·호출만).
//    🔥 gating / describe.skip / env-gating 배선 0 — 순수 build-time in-memory 검증만.
//
// raw / credential 누출 0(R-59 / REQ-032 / REQ-059): 본 spec 은 hits 의 number(식별자)·
//   title/body string 값만 대조하고, GH_TOKEN/PAT/`ghp_`/`--token`/`GITHUB_TOKEN`/narrative
//   어휘를 키/값 어디에도 담지 않으며, 가드 throw 메시지가 number/title/body 값·index·타입만
//   노출(raw 활동 본문·credential 미노출)함을 negative case 에서 확인한다.
import { buildRealDataDailyStepDualLegRunReport } from "../helpers/realdata-e2e-daily-step-dual-leg-run-report";
import type { RealDataDailyStepLegRunOutcome } from "../helpers/realdata-e2e-daily-step-dual-leg-run-report";
import type { RealDataDailyStepDualLegRunReportIssueSearchHit } from "../helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-action";
import { buildRealDataDailyStepDualLegRunReportIssueCommandArgs } from "../helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-command-args";
import { buildRealDataDailyStepDualLegRunReportIssueDescriptor } from "../helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-descriptor";
import { buildRealDataDailyStepDualLegRunReportIssueSearchGhArgv } from "../helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-search-argv";
import { parseRealDataDailyStepDualLegRunReportIssueSearchOutput } from "../helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-search-parse";
import { assertRealDataDailyStepDualLegRunReportIssueSearchOutputConsistentWithStdout } from "../helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-search-parse-consistency";
import type { RealDataResultIssueRunRef } from "../helpers/realdata-e2e-result-issue-descriptor";

// 결정론 run 식별자 fixture — gitSha + dateToken 비공백 안정 토큰. 매 it 가 spread 복제로
// 받아 입력 mutate 누설 0. token/secret/raw narrative 어휘 미포함(credential 누출 0 단언
// fixture 전제).
const RUN_A: RealDataResultIssueRunRef = {
  gitSha: "abc1234",
  dateToken: "2026-07-12",
};

// synthetic 이슈 번호(raw) — github 이 부여한 이슈 번호를 흉내낸다. marker
// (`${dateToken}@${gitSha}` 조각)의 substring 이 아닌 서로 다른 양수로 골라 값-정합 축이
// 우연 매칭이 아님을 보장(N1≠N2, 둘 다 RUN_A marker 의 substring 아님).
const N1 = 5183;
const N2 = 5225;

// synthetic leg outcome fixture — eval / collect 각 leg 의 run outcome literal. 조립
// 체인은 leg outcome 을 report → descriptor 로 흘려보내는 surface 만 통과하므로 도메인
// 타입 정합만 만족하는 minimal literal 로 충분하다(실 jest spawn 0).
function evalOutcome(): RealDataDailyStepLegRunOutcome {
  return { leg: "eval", action: "run", passed: true };
}

function collectOutcome(): RealDataDailyStepLegRunOutcome {
  return { leg: "collect", action: "run", passed: true };
}

// chain 조립 — report → descriptor → commandArgs → searchArgv 를 통과시켜 그 run 의 멱등
// marker(= commandArgs.searchQuery = descriptor.marker)와 search argv 를 얻는다. search
// stdout 의 body 에 담을 marker 원천이자, searchArgv 규약(`--json number,title,body`)과
// stdout 필드 집합이 정합함을 보이는 조립 입력이다. 각 stage 의 guard throw 는 그대로 전파.
function buildChain(run: RealDataResultIssueRunRef) {
  const report = buildRealDataDailyStepDualLegRunReport(
    evalOutcome(),
    collectOutcome(),
    run,
  );
  const descriptor =
    buildRealDataDailyStepDualLegRunReportIssueDescriptor(report);
  const commandArgs =
    buildRealDataDailyStepDualLegRunReportIssueCommandArgs(descriptor);
  const searchArgv =
    buildRealDataDailyStepDualLegRunReportIssueSearchGhArgv(commandArgs);
  return {
    report,
    descriptor,
    commandArgs,
    searchArgv,
    marker: commandArgs.searchQuery,
  };
}

// marker 를 body 에 포함한 synthetic search stdout — `gh search issues --json
// number,title,body` 응답(JSON 배열)을 흉내낸 literal. `--json number,title,body` 요청과
// 필드 집합 정합. numbers 순서가 stdout 원소 순서를 결정한다(순서 보존 검증용).
function searchStdout(marker: string, ...numbers: number[]): string {
  return JSON.stringify(
    numbers.map((n) => ({
      number: n,
      title: `기존 dual-leg run report 이슈 #${n}`,
      body: `${marker}\n\n본문 일부 #${n}`,
    })),
  );
}

// 추가 필드가 섞인 synthetic search stdout — `--json` 요청 3필드 외 url/state/labels 및
// credential-형 sentinel 잉여 필드를 각 원소에 심어 파서·재유도의 추가필드 drop(3키만)을
// 검증한다. 정상 파서·재유도는 잉여 필드를 drop 하므로 값-정합이 성립해야 한다.
function searchStdoutWithExtra(
  marker: string,
  sentinel: string,
  ...numbers: number[]
): string {
  return JSON.stringify(
    numbers.map((n) => ({
      number: n,
      title: `기존 dual-leg run report 이슈 #${n}`,
      body: `${marker}\n\n본문 일부 #${n}`,
      url: `https://github.com/myungjoo/assessment-agent/issues/${n}`,
      state: "open",
      labels: ["realdata-e2e"],
      token: sentinel,
    })),
  );
}

// chain 통과 hits 산출 — buildChain 의 marker 를 담은 search stdout 을 파서로 통과시켜
// hits 를 얻는다(파서 self-wire(T-0909)가 산출 직전 가드로 stdout 정합을 자체 검증하므로
// 정상 경로는 throw 0). 값 drift negative 는 이 산출 hits 를 복제·변형해 주입한다.
function assembleHits(run: RealDataResultIssueRunRef, ...numbers: number[]) {
  const chain = buildChain(run);
  const stdout = searchStdout(chain.marker, ...numbers);
  const hits = parseRealDataDailyStepDualLegRunReportIssueSearchOutput(stdout);
  return { ...chain, stdout, hits };
}

// hits 깊은 복제 — 값 drift negative 주입 시 원본 hits 를 변형하지 않도록 각 원소 새 객체
// 로 복제한다(무공유).
function cloneHits(
  hits: RealDataDailyStepDualLegRunReportIssueSearchHit[],
): RealDataDailyStepDualLegRunReportIssueSearchHit[] {
  return hits.map((hit) => ({ ...hit }));
}

// spec 로컬 독립 재유도(컴포저 재호출 0) — stdout 만으로 각 원소 {number,title,body} 를
// 추출해 expected 를 재구성한다. 가드가 stdout 을 진실의 원천으로 삼음을 반영해 하드코딩
// 대신 stdout 파생으로 expected 를 만든다(single-source).
function reDeriveHits(
  stdout: string,
): RealDataDailyStepDualLegRunReportIssueSearchHit[] {
  const parsed = JSON.parse(stdout) as Array<{
    number: number;
    title: string;
    body: string;
  }>;
  return parsed.map((element) => ({
    number: element.number,
    title: element.title,
    body: element.body,
  }));
}

describe("Smoke(non-gated): dual-leg run report search-output↔stdout value-consistency 수렴(chain 을 search stdout 까지 통과시켜 파서 산출 hits[] 의 number·title·body 전체 값을 stdout 독립 재유도 expected 와 deep-equal 로 T-0908 가드 박제) live-gh 0 검증", () => {
  describe("happy path — multi-hit value-consistency(chain 산출 hits ↔ stdout 독립 재유도 deep-equal)", () => {
    it("multi-hit chain(report→descriptor→commandArgs→searchArgv→search stdout→search-parse) 산출 hits 에 guard(hits, searchStdout) 적용 → 값-정합이라 throw 없이 void AND hits 개수·각 원소 {number,title,body} 값이 stdout 원소와 index 별 정확 일치", () => {
      const { hits, stdout } = assembleHits(RUN_A, N1, N2);
      // 값-정합 → guard 는 throw 없이 void.
      expect(() =>
        assertRealDataDailyStepDualLegRunReportIssueSearchOutputConsistentWithStdout(
          hits,
          stdout,
        ),
      ).not.toThrow();
      // 개수·index 별 값 직접 대조.
      const parsed = JSON.parse(stdout) as Array<{
        number: number;
        title: string;
        body: string;
      }>;
      expect(hits).toHaveLength(2);
      expect(hits[0].number).toBe(N1);
      expect(hits[1].number).toBe(N2);
      expect(hits[0].title).toBe(parsed[0].title);
      expect(hits[0].body).toBe(parsed[0].body);
      expect(hits[1].title).toBe(parsed[1].title);
      expect(hits[1].body).toBe(parsed[1].body);
    });
  });

  describe('happy path — 빈 hit("[]") value-consistency(create 경로 후보 0건)', () => {
    it('동일 chain marker 로 얻은 search stdout 이 "[]"(빈 배열) → 파서 산출 hits === [](길이 0) AND guard([], "[]") void — create 경로 진입 전 search leg 값-정합도 빈 hit 에서 성립', () => {
      const chain = buildChain(RUN_A);
      const emptyStdout = searchStdout(chain.marker); // numbers 0개 → "[]"
      expect(emptyStdout).toBe("[]");
      const hits =
        parseRealDataDailyStepDualLegRunReportIssueSearchOutput(emptyStdout);
      expect(hits).toEqual([]);
      expect(hits).toHaveLength(0);
      expect(() =>
        assertRealDataDailyStepDualLegRunReportIssueSearchOutputConsistentWithStdout(
          [],
          "[]",
        ),
      ).not.toThrow();
    });
  });

  describe("필드값·순서·개수-threading — hits 가 stdout 원소와 index 수렴", () => {
    it("multi-hit stdout 에서 hits 개수 === stdout JSON 배열 length, hits[i].number/title/body === stdout[i].*(순서 보존·값 threading), 각 hit own key 집합이 정확히 {number,title,body} 3키(추가필드 drop — stdout 원소에 url/state/labels/token 잉여 필드를 넣어도 hits 에는 미누출)", () => {
      const chain = buildChain(RUN_A);
      const stdout = searchStdoutWithExtra(
        chain.marker,
        "ghp_extraSentinel1234",
        N1,
        N2,
      );
      const hits =
        parseRealDataDailyStepDualLegRunReportIssueSearchOutput(stdout);
      const parsed = JSON.parse(stdout) as Array<Record<string, unknown>>;
      // 개수 = stdout 배열 length.
      expect(hits).toHaveLength(parsed.length);
      hits.forEach((hit, index) => {
        // index 별 값 threading(순서 보존).
        expect(hit.number).toBe(parsed[index].number);
        expect(hit.title).toBe(parsed[index].title);
        expect(hit.body).toBe(parsed[index].body);
        // own key 집합 = 정확히 3키(추가필드 drop).
        expect(Object.keys(hit).sort()).toEqual(["body", "number", "title"]);
      });
      // 잉여 필드(url/state/labels/token)를 넣었어도 값-정합 성립(재유도도 drop).
      expect(() =>
        assertRealDataDailyStepDualLegRunReportIssueSearchOutputConsistentWithStdout(
          hits,
          stdout,
        ),
      ).not.toThrow();
    });
  });

  describe("single-source 독립 재유도 — 컴포저 재호출 0, stdout 을 진실의 원천으로", () => {
    it("동일 search stdout 에서 파서 재호출 없이 각 원소 {number,title,body} 추출로 산출한 expected 배열이 chain 산출 hits 와 deep-equal(가드가 stdout 을 진실의 원천으로 삼음 반영)", () => {
      const { hits, stdout } = assembleHits(RUN_A, N1, N2);
      expect(hits).toEqual(reDeriveHits(stdout));
    });

    it("순서 보존 결정론 — stdout 원소 순서(N1 다음 N2, N2≠N1)를 hits·재유도 expected 모두 그대로 보존", () => {
      expect(N2).not.toBe(N1);
      const { hits, stdout } = assembleHits(RUN_A, N1, N2);
      const expected = reDeriveHits(stdout);
      expect(hits.map((h) => h.number)).toEqual([N1, N2]);
      expect(expected.map((h) => h.number)).toEqual([N1, N2]);
    });
  });

  describe("error path / negative cases — 예외 분기마다 각 1+(단일 negative 금지)", () => {
    it("(a) number 값 drift(RangeError) — chain 산출 hits 복제 후 한 원소 number 를 N1+1 로 변형 → guard 가 stdout 재유도 값과 어긋나 RangeError(값 정합 위반)", () => {
      const { hits, stdout } = assembleHits(RUN_A, N1, N2);
      const mutated = cloneHits(hits);
      mutated[0].number = N1 + 1;
      expect(() =>
        assertRealDataDailyStepDualLegRunReportIssueSearchOutputConsistentWithStdout(
          mutated,
          stdout,
        ),
      ).toThrow(RangeError);
    });

    it("(b) title/body 값 drift(RangeError) — hits 복제 후 한 원소 title(공백 추가) 또는 body(대소문자 변경)를 변형 → 각각 guard RangeError(trim·case-fold 0)", () => {
      const { hits, stdout } = assembleHits(RUN_A, N1, N2);
      // title 에 trailing 공백 추가(trim 0 확인).
      const titleDrift = cloneHits(hits);
      titleDrift[0].title = `${titleDrift[0].title} `;
      expect(() =>
        assertRealDataDailyStepDualLegRunReportIssueSearchOutputConsistentWithStdout(
          titleDrift,
          stdout,
        ),
      ).toThrow(RangeError);
      // body 대소문자 변경(case-fold 0 확인).
      const bodyDrift = cloneHits(hits);
      bodyDrift[1].body = bodyDrift[1].body.toUpperCase();
      expect(() =>
        assertRealDataDailyStepDualLegRunReportIssueSearchOutputConsistentWithStdout(
          bodyDrift,
          stdout,
        ),
      ).toThrow(RangeError);
    });

    it("(c) hit 누락/중복/재정렬(RangeError) — hits 복제 후 원소 제거(개수)·순서 swap(순서)·원소 복제(중복) 각각 → guard RangeError", () => {
      const { hits, stdout } = assembleHits(RUN_A, N1, N2);
      // 누락 — 원소 1개 제거(개수 불일치).
      const removed = cloneHits(hits).slice(0, 1);
      expect(() =>
        assertRealDataDailyStepDualLegRunReportIssueSearchOutputConsistentWithStdout(
          removed,
          stdout,
        ),
      ).toThrow(RangeError);
      // 재정렬 — 순서 swap(순서 불일치).
      const swapped = [cloneHits(hits)[1], cloneHits(hits)[0]];
      expect(() =>
        assertRealDataDailyStepDualLegRunReportIssueSearchOutputConsistentWithStdout(
          swapped,
          stdout,
        ),
      ).toThrow(RangeError);
      // 중복 — 원소 1개 복제(개수 불일치).
      const duplicated = [...cloneHits(hits), { ...hits[0] }];
      expect(() =>
        assertRealDataDailyStepDualLegRunReportIssueSearchOutputConsistentWithStdout(
          duplicated,
          stdout,
        ),
      ).toThrow(RangeError);
    });

    it("(d) 잉여 필드 drift(RangeError) — hits 복제 후 한 원소에 url(또는 credential-형 token) 키 1개 추가(키 4개) → guard 가 키 개수(≠3)로 RangeError(추가필드 drop 위반)", () => {
      const { hits, stdout } = assembleHits(RUN_A, N1, N2);
      const withUrl = cloneHits(hits);
      (withUrl[0] as unknown as Record<string, unknown>).url =
        "https://github.com/o/r/issues/1";
      expect(() =>
        assertRealDataDailyStepDualLegRunReportIssueSearchOutputConsistentWithStdout(
          withUrl,
          stdout,
        ),
      ).toThrow(RangeError);
      const withToken = cloneHits(hits);
      (withToken[1] as unknown as Record<string, unknown>).token = "ghp_leaked";
      expect(() =>
        assertRealDataDailyStepDualLegRunReportIssueSearchOutputConsistentWithStdout(
          withToken,
          stdout,
        ),
      ).toThrow(RangeError);
    });

    it("(e-i) 구조 결손(TypeError) — hits=null/undefined/숫자/문자열(비배열)/배열 원소 비객체(null·숫자) 각각 → guard TypeError(값 정합 RangeError 와 분리)", () => {
      const { stdout } = assembleHits(RUN_A, N1, N2);
      const badHits: unknown[] = [
        null,
        undefined,
        42,
        "not-an-array",
        [null],
        [7],
      ];
      for (const bad of badHits) {
        expect(() =>
          assertRealDataDailyStepDualLegRunReportIssueSearchOutputConsistentWithStdout(
            bad as unknown as RealDataDailyStepDualLegRunReportIssueSearchHit[],
            stdout,
          ),
        ).toThrow(TypeError);
      }
    });

    it('(e-ii) 구조 결손(TypeError) — 정상 hits + stdout=비-string(number/null)/비-JSON("{")/비배열 JSON("{}")/원소 number 비양정수(0·음수)/title·body 비문자열 각각 → guard TypeError', () => {
      const { hits } = assembleHits(RUN_A, N1, N2);
      const badStdouts: unknown[] = [
        42, // 비-string
        null, // 비-string
        "{", // 비-JSON
        "{}", // 비배열 JSON
        '[{"number":0,"title":"t","body":"b"}]', // number 0(비양정수)
        '[{"number":-3,"title":"t","body":"b"}]', // number 음수
        '[{"number":1,"title":5,"body":"b"}]', // title 비문자열
        '[{"number":1,"title":"t","body":null}]', // body 비문자열
      ];
      for (const bad of badStdouts) {
        expect(() =>
          assertRealDataDailyStepDualLegRunReportIssueSearchOutputConsistentWithStdout(
            hits,
            bad as unknown as string,
          ),
        ).toThrow(TypeError);
      }
    });

    it("(f-i) chain 상류 차단 — run.gitSha 빈/공백 → descriptor(stage 1) guard throw 로 chain 조립 자체 차단(잘못된 marker 로 search stdout 산출 불가)", () => {
      expect(() =>
        assembleHits({ gitSha: "   ", dateToken: RUN_A.dateToken }, N1),
      ).toThrow();
    });

    it("(f-ii) chain 상류 차단 — search stdout 이 비-JSON 또는 원소 number 비양정수 → parseRealDataDailyStepDualLegRunReportIssueSearchOutput(self-wire 포함) throw 로 hits 미산출(잘못된 hits 가 value-consistency 가드/resolve 로 새는 것 차단)", () => {
      // 비-JSON.
      expect(() =>
        parseRealDataDailyStepDualLegRunReportIssueSearchOutput("not-json"),
      ).toThrow();
      // 원소 number 비양정수.
      expect(() =>
        parseRealDataDailyStepDualLegRunReportIssueSearchOutput(
          '[{"number":0,"title":"t","body":"b"}]',
        ),
      ).toThrow();
    });
  });

  describe("결정론 · 무공유 · no-mutation", () => {
    it("동일 (run, numbers, searchStdout) 로 chain→hits→guard 두 번 실행 → 두 hits 배열 deep-equal(byte-identical)이며 서로 다른 배열 인스턴스(무공유)", () => {
      const a = assembleHits(RUN_A, N1, N2);
      const b = assembleHits(RUN_A, N1, N2);
      expect(a.hits).toEqual(b.hits);
      expect(a.hits).not.toBe(b.hits);
      expect(a.hits[0]).not.toBe(b.hits[0]);
      expect(() =>
        assertRealDataDailyStepDualLegRunReportIssueSearchOutputConsistentWithStdout(
          a.hits,
          a.stdout,
        ),
      ).not.toThrow();
      expect(() =>
        assertRealDataDailyStepDualLegRunReportIssueSearchOutputConsistentWithStdout(
          b.hits,
          b.stdout,
        ),
      ).not.toThrow();
    });

    it("no-mutation — guard 호출이 hits·stdout 을 mutate 0(호출 전후 JSON snapshot deep-equal, stdout 문자열 불변)", () => {
      const { hits, stdout } = assembleHits(RUN_A, N1, N2);
      const hitsBefore = JSON.parse(JSON.stringify(hits));
      const stdoutBefore = stdout;
      assertRealDataDailyStepDualLegRunReportIssueSearchOutputConsistentWithStdout(
        hits,
        stdout,
      );
      expect(hits).toEqual(hitsBefore);
      expect(stdout).toBe(stdoutBefore);
    });
  });

  describe("raw / credential 누출 0(R-59 / REQ-032 / REQ-059)", () => {
    it("chain 산출 hits 각 원소의 own key 집합이 정확히 {number,title,body} 뿐이며 GH_TOKEN/PAT/ghp_/--token/GITHUB_TOKEN 어휘를 키/값 어디에도 담지 않음", () => {
      const { hits } = assembleHits(RUN_A, N1, N2);
      for (const hit of hits) {
        expect(Object.keys(hit).sort()).toEqual(["body", "number", "title"]);
        const joined = [
          ...Object.keys(hit),
          String(hit.number),
          hit.title,
          hit.body,
        ].join(" ");
        expect(joined).not.toContain("--token");
        expect(joined).not.toContain("GITHUB_TOKEN");
        expect(joined).not.toContain("GH_TOKEN");
        expect(joined).not.toContain("ghp_");
        expect(joined).not.toMatch(/ghp_[A-Za-z0-9]/);
      }
    });

    it("stdout 원소에 credential-형 sentinel 잉여 필드(token)를 넣어도 hits 및 값-정합 재유도에 sentinel 미누출(hits 는 {number,title,body} 파생만)", () => {
      const sentinel = "ghp_SENTINELsecret1234";
      const chain = buildChain(RUN_A);
      const stdout = searchStdoutWithExtra(chain.marker, sentinel, N1, N2);
      const hits =
        parseRealDataDailyStepDualLegRunReportIssueSearchOutput(stdout);
      expect(JSON.stringify(hits)).not.toContain(sentinel);
      expect(JSON.stringify(reDeriveHits(stdout))).not.toContain(sentinel);
    });

    it("가드 throw 메시지가 raw 활동 본문·credential 을 노출하지 않음(number/title/body 값·index·타입만) — number drift RangeError 메시지에 --token/ghp_/GITHUB_TOKEN 미포함", () => {
      const { hits, stdout } = assembleHits(RUN_A, N1, N2);
      const mutated = cloneHits(hits);
      mutated[0].number = N1 + 1;
      let message = "";
      try {
        assertRealDataDailyStepDualLegRunReportIssueSearchOutputConsistentWithStdout(
          mutated,
          stdout,
        );
      } catch (err) {
        message = (err as Error).message;
      }
      expect(message).toContain(String(N1)); // stdout 값(재유도 기대)
      expect(message).not.toContain("--token");
      expect(message).not.toContain("GITHUB_TOKEN");
      expect(message).not.toContain("ghp_");
    });
  });
});
