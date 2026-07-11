// realdata-e2e-daily-step-dual-leg-run-report-output-parse-url-issuenumber-
// cross-field-single-source-closure-assembly.smoke-spec.ts — 실 평가 e2e daily-step
// dual-leg run report 의 execute-side output-parse 가 산출한 outcome({issueNumber, url})
// 의 **두 반환 필드가 같은 execStdout URL 매칭 한 지점에서 co-유도돼 서로 어긋날 수 없음**
// (intra-outcome cross-field single-source: url ⊇ issueNumber)을 create/edit 두 실행-후
// 분기 모두에서 박제하는 non-gated build-time smoke (T-0936 박제, PLAN.md 109행 🟢 실
// 평가 e2e step ④). T-0935(issueNumber genesis)·T-0920(issueNumber convergence)의 url 축 짝.
//
// 본 spec 의 존재 이유 — output-parse url↔issueNumber intra-outcome cross-field
// single-source closure gap 해소:
//   - step ④(daily-test dual-leg run 결과 rolling-issue 멱등 박제)의 execute-side 는
//     `gh issue create` / `gh issue edit <n>` 의 stdout(이슈 URL 을 담은 줄)을
//     output-parse 로 읽어 outcome{issueNumber, url} 을 산출한다. 파서
//     (`parseRealDataDailyStepDualLegRunReportIssueCreateEditOutput`)는 stdout 에서 issue
//     URL `https://github.com/<owner>/<repo>/issues/<n>` **한 매칭**을 뽑아 그로부터 **두
//     필드를 동시에** 산출한다: `url`(그 매칭 전체) + `issueNumber`(그 url tail 의 번호
//     `<n>`). 즉 url 이 파서의 1차 추출이고 issueNumber 는 그 url 의 `/issues/<n>` segment
//     를 투영한 값이다. 두 필드는 **하나의 source(그 URL 매칭)** 에서 나오므로 구조적으로
//     서로 어긋날 수 없다 — `outcome.url` 은 정확히 `.../issues/${outcome.issueNumber}` 로
//     끝나야 하고, url 의 번호 segment 는 `String(outcome.issueNumber)` 와 byte-identical
//     이어야 한다.
//   - 이 intra-outcome cross-field 정합이 rolling-issue 멱등(REQ-009)의 execute-side
//     무결성의 마지막 그물이다: outcome 은 다음 밤 추적의 기준(issueNumber = 다음 밤
//     검색·갱신 대상, url = 사람이 여는 링크)으로 쓰이는데, 파서가 issueNumber 를 한 URL
//     에서 뽑고 url 을 **다른 문자열**에서 뽑는 버그가 생기면 outcome.url(사람이 여는
//     링크)이 outcome.issueNumber(다음 밤 검색 대상)와 다른 이슈를 가리켜 rolling-issue
//     추적이 조용히 어긋난다. 두 필드가 **같은 URL 한 지점에서만** 유도됨을 chain 그물로
//     못 박아야 이 divergence 가 원천 차단된다.
//   - 형제 smoke 들이 각기 다른 절단면만 닫았다:
//       * T-0935(create-branch output-parse issueNumber genesis) 는 create 분기에서 갓
//         생성된 번호 M 이 오직 execStdout URL(실행 후)에서만 태어남(issueNumber 의
//         출처/provenance)만 자산화 — outcome 의 **다른 반환 필드 url 과의 상호 정합**은
//         대상이 아니다(genesis 는 M 이 어디서 오는가, 본 spec 은 url 과 issueNumber 가
//         서로 일치하는가).
//       * T-0920(edit-branch output-parse issueNumber convergence) 은 update 분기에서
//         기존 번호 N 이 search-hit→resolve→plan.argv[2]→output-parse 4지점 수렴함
//         (issueNumber 의 pre/post-exec 관통)만 자산화 — url↔issueNumber 상호 정합은
//         축이 아니다.
//       * T-0924(output-stdout-value-consistency) 은 outcome **전체 값**(issueNumber +
//         url)이 raw stdout 으로부터 독립 재유도한 expected 와 deep-equal 임만 자산화 —
//         각 필드를 stdout 과 **개별** 대조할 뿐, **두 필드 상호간의** cross-field 불변
//         (url ⊇ issueNumber)을 직접 못 박지 않는다.
//       * T-0923(outcome-parse-shape) 은 outcome 의 **own-key set** 이 선언 shape
//         `["issueNumber","url"]` 와 set-equal 임(키 집합)만 자산화 — 두 키의 **값 상호
//         관계**는 대상이 아니다.
//   - 본 spec 은 그 intra-outcome url↔issueNumber cross-field single-source seam 을 닫는다
//     — issueNumber 축(T-0935 genesis + T-0920 convergence)의 url 짝. chain: 두 leg
//     outcome + run → report → descriptor → commandArgs 를 통과시켜 유효 commandArgs 를
//     얻고, (i) 빈 search("[]") → create plan → create execStdout(`.../issues/M`) →
//     output-parse → outcome, (ii) marker-매칭 hit → update plan → edit
//     execStdout(`.../issues/N`) → output-parse → outcome 두 분기 각각에서 `outcome.url`
//     이 정확히 `.../issues/${outcome.issueNumber}` 로 끝나고 url 의 번호 segment ===
//     `String(outcome.issueNumber)` 임을 박제한다. 따라서 본 spec 은:
//
//      🔥 실 LLM 호출 0 — orchestrator / scoring service / gateway 미사용. synthetic
//         leg outcome / run / stdout literal 을 조립 체인에 직접 공급(실 평가·수집·jest
//         spawn 0).
//      🔥 실 네트워크 호출 0 — github / Ollama / gh 호출 0. fetch 0. process.env 읽기 0.
//      🔥 실 gh 실행 0 — search / issue create / issue edit 실 실행 0. execFile('gh', …) 0.
//      🔥 credential 0 / secret 0 / DB 0 / 비용 0 — public CI 에서 항상 green 발화(R-113).
//      🔥 새 외부 dependency 0 — 기존 build*/resolve*/parse* 컴포저 import 재사용만
//         (consistency-guard·helper 신설 금지).
//      🔥 gating / describe.skip / env-gating 배선 0 — 순수 build-time in-memory 검증만.
//      🔥 REQ-009 멱등 근거 — outcome.url(사람이 여는 링크)과 outcome.issueNumber(다음 밤
//         추적 대상)가 같은 이슈를 가리켜야 rolling-issue 멱등이 성립한다. 두 필드가 같은
//         URL 한 지점에서만 co-유도됨을 본 그물이 못 박는다.
//      🔥 REQ-037 / REQ-059 — outcome 은 {issueNumber, url} 만 담고 raw 활동 본문·
//         credential 을 담지 않는다(raw 미저장 정합).
//
// Out of Scope (T-0936):
//   - 형제 T-0935 의 create-branch issueNumber genesis(M 이 execStdout 에서 태어남·
//     pre-exec create chain 부재) 축 재단언 — 본 spec 은 outcome 두 반환 필드의 **상호
//     정합(url ⊇ issueNumber)**. genesis(출처)와 cross-field(상호 일치)는 다른 축.
//   - 형제 T-0920 의 update 분기 issueNumber pre-exec 관통(search-hit→resolve→
//     plan.argv[2]→output-parse 4지점 수렴) 축 재단언 — update 경로는 본 spec 에서 edit
//     execStdout → outcome 두 필드 정합 확인용 최소 인용만.
//   - 형제 T-0924(output-stdout-value-consistency)·T-0923(outcome-parse-shape)·
//     T-0918(triple-boundary)·T-0934(action-verb dispatch) 축 자체 재단언 — 본 spec 은
//     intra-outcome 두 필드 값 상호 관계(외부 stdout 대조·key set·resolve 수렴·분기 선택과
//     별개 축).
//   - descriptor / command-args / action resolver / gh-argv 빌더 / gh-command-plan
//     컴포저 / output-parse 파서 본문 변경 — import·호출만(각 배선 이미 T-0896~T-0907 박제).
//   - 새 컴포저 / consistency 가드 / helper / type 신설 — 기존 helper import·호출만.
//   - production src/ 코드 / package.json / lockfile / test/jest-smoke.json 변경.
import {
  buildRealDataDailyStepDualLegRunReport,
  type RealDataDailyStepLegRunOutcome,
} from "../helpers/realdata-e2e-daily-step-dual-leg-run-report";
import { buildRealDataDailyStepDualLegRunReportIssueCommandArgs } from "../helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-command-args";
import { buildRealDataDailyStepDualLegRunReportIssueDescriptor } from "../helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-descriptor";
import { resolveRealDataDailyStepDualLegRunReportIssueGhCommandPlan } from "../helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-gh-command-plan";
import { parseRealDataDailyStepDualLegRunReportIssueCreateEditOutput } from "../helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-output-parse";
import type { RealDataResultIssueRunRef } from "../helpers/realdata-e2e-result-issue-descriptor";

// 결정론 run 식별자 fixture — gitSha + dateToken 비공백 안정 토큰. 매 it 가 spread 복제로
// 받아 입력 mutate 누설 0. token/secret/raw narrative 어휘 미포함(credential 누출 0 단언
// fixture 전제).
const RUN_A: RealDataResultIssueRunRef = {
  gitSha: "abc1234",
  dateToken: "2026-07-11",
};

// 서로 다른 run — gitSha·dateToken 이 RUN_A 와 서로 substring 이 아닌 구별 가능 값(run 분포
// 무관 cross-field 정합 안정 단언용 — 두 필드는 execStdout URL 종속이라 run 이 달라도 불변).
const RUN_B: RealDataResultIssueRunRef = {
  gitSha: "def5678",
  dateToken: "2026-08-24",
};

// 안정 issue URL host — 실 gh round-trip 없이 synthetic literal 로 대체한다.
const ISSUE_URL_HOST = "https://github.com/myungjoo/assessment-agent";

// synthetic 이슈 URL(정규화 후 기대값) — output-parse 산출 url 대조용.
function issueUrl(n: number): string {
  return `${ISSUE_URL_HOST}/issues/${n}`;
}

// synthetic `gh issue create`/`gh issue edit` stdout — 지정 이슈 번호의 유효 issue URL 한
// 줄(trailing 개행 포함). 실 gh 실행 없이 output-parse 에 직접 주입한다. url·issueNumber 두
// 필드가 태어나는 유일한 source URL.
function issueUrlStdout(n: number): string {
  return `${issueUrl(n)}\n`;
}

// marker 를 body 에 포함한 synthetic search stdout(1+ hit) — update 분기 유도. gh search
// issues --json number,title,body 응답을 흉내낸 literal. number=N 이 search-hit 단일 source.
function markerHitStdout(marker: string, ...numbers: number[]): string {
  return JSON.stringify(
    numbers.map((n) => ({
      number: n,
      title: `기존 dual-leg run report 이슈 #${n}`,
      body: `${marker}\n\n본문 일부`,
    })),
  );
}

// synthetic 기본 leg outcome fixture — eval / collect 각 leg 의 run outcome literal. 조립
// 체인은 leg outcome 을 report → descriptor 로 흘려보내는 surface 만 검증하므로 도메인
// 타입 정합만 만족하는 minimal literal 로 충분하다(실 jest spawn 0).
function evalOutcome(): RealDataDailyStepLegRunOutcome {
  return { leg: "eval", action: "run", passed: true };
}

function collectOutcome(): RealDataDailyStepLegRunOutcome {
  return { leg: "collect", action: "run", passed: true };
}

// output-parse url↔issueNumber cross-field 조립 진입점 — 단일 source(run + 두 leg outcome +
// searchStdout + execStdout) 로부터 종단 chain(report / descriptor / commandArgs /
// resolve(plan) / output-parse)을 관통시킨다. searchStdout 이 빈 hit("[]")면 create 분기,
// marker-매칭 hit 면 update 분기로 갈린다. execStdout 은 output-parse 가 outcome 의 두 필드
// (url·issueNumber)를 co-유도하는 유일한 source URL 이다. 각 stage 의 guard throw 는 자체
// try/catch 없이 그대로 전파된다.
function assembleViaChain(
  evalLeg: RealDataDailyStepLegRunOutcome,
  collectLeg: RealDataDailyStepLegRunOutcome,
  run: RealDataResultIssueRunRef,
  n: number,
  opts?: { searchStdout?: string; execStdout?: string },
) {
  // (1) pre-execution report → descriptor.
  const report = buildRealDataDailyStepDualLegRunReport(
    evalLeg,
    collectLeg,
    run,
  );
  const descriptor =
    buildRealDataDailyStepDualLegRunReportIssueDescriptor(report);
  // (2) command-args — searchQuery = descriptor.marker 운반.
  const commandArgs =
    buildRealDataDailyStepDualLegRunReportIssueCommandArgs(descriptor);
  // (3) resolve — 기본 빈 search("[]") → create 분기. marker-매칭 hit → update 분기.
  const searchStdout = opts?.searchStdout ?? "[]";
  const plan = resolveRealDataDailyStepDualLegRunReportIssueGhCommandPlan(
    searchStdout,
    commandArgs,
  );
  // (4) post-execution output-parse — execStdout URL 한 지점에서 outcome 의 두 필드
  //     (url·issueNumber)가 함께 태어난다(cross-field single-source).
  const execStdout = opts?.execStdout ?? issueUrlStdout(n);
  const outcome =
    parseRealDataDailyStepDualLegRunReportIssueCreateEditOutput(execStdout);
  return {
    report,
    descriptor,
    commandArgs,
    searchStdout,
    plan,
    execStdout,
    outcome,
  };
}

// create 분기 chain(빈 search "[]") — M genesis.
function assembleCreate(
  run: RealDataResultIssueRunRef,
  m: number,
  opts?: { execStdout?: string },
) {
  return assembleViaChain(evalOutcome(), collectOutcome(), run, m, {
    searchStdout: "[]",
    execStdout: opts?.execStdout,
  });
}

// update 분기 chain(marker-매칭 hit) — 기존 N. descriptor.marker 를 search hit body 에 심어
// update 분기를 유도한다. marker 는 descriptor 산출값이라 report → descriptor 를 먼저 돌려
// 얻는다.
function assembleUpdate(
  run: RealDataResultIssueRunRef,
  n: number,
  opts?: { execStdout?: string },
) {
  const report = buildRealDataDailyStepDualLegRunReport(
    evalOutcome(),
    collectOutcome(),
    run,
  );
  const descriptor =
    buildRealDataDailyStepDualLegRunReportIssueDescriptor(report);
  return assembleViaChain(evalOutcome(), collectOutcome(), run, n, {
    searchStdout: markerHitStdout(descriptor.marker, n),
    execStdout: opts?.execStdout,
  });
}

// url 의 마지막 path segment(번호)를 정규식으로 추출 — helper 규약을 재계산하지 않고 url
// 문자열 자체에서 뽑아 두 필드가 같은 URL 한 지점에서 co-유도됐는지 구조적으로 대조한다.
function issueSegmentOf(url: string): string {
  const match = /\/issues\/(\d+)$/.exec(url);
  if (match === null) {
    throw new Error(`url 에서 /issues/<n> segment 를 찾지 못했습니다: ${url}`);
  }
  return match[1];
}

// 순수 issue URL 정규 형태 — credential·query string·raw 토큰 0.
const PURE_ISSUE_URL = /^https:\/\/github\.com\/[^/\s]+\/[^/\s]+\/issues\/\d+$/;

describe("Smoke(non-gated): dual-leg run report output-parse url↔issueNumber intra-outcome cross-field single-source closure(url ⊇ issueNumber, create/edit 두 분기) live-gh 0 검증", () => {
  describe("happy path — 두 분기 chain 산출 정상", () => {
    it("create/update 두 분기 각각 outcome 이 {issueNumber, url} 2필드를 정확히 보유하고 url 은 비어있지 않은 문자열, issueNumber 는 양의 정수", () => {
      const M = 987654;
      const N = 424242;
      const createOutcome = assembleCreate({ ...RUN_A }, M).outcome;
      const updateOutcome = assembleUpdate({ ...RUN_A }, N).outcome;

      for (const outcome of [createOutcome, updateOutcome]) {
        expect(Object.keys(outcome).sort()).toEqual(["issueNumber", "url"]);
        expect(typeof outcome.url).toBe("string");
        expect(outcome.url.length).toBeGreaterThan(0);
        expect(typeof outcome.issueNumber).toBe("number");
        expect(Number.isInteger(outcome.issueNumber)).toBe(true);
        expect(outcome.issueNumber).toBeGreaterThan(0);
      }
    });

    it("update 분기 진입 확인 — marker-매칭 hit → plan.action.action==='update'(대조용 최소 인용, 그 관통 자체 재단언 아님)", () => {
      const N = 424242;
      const { plan } = assembleUpdate({ ...RUN_A }, N);
      expect(plan.action.action).toBe("update");
    });
  });

  describe("핵심 1 — cross-field single-source(url ⊇ issueNumber, 두 분기 모두)", () => {
    it("(a) create outcome: url 이 정확히 `/issues/${issueNumber}` 로 끝남 AND url tail 번호 segment === String(issueNumber)(byte-identical)", () => {
      const M = 987654;
      const { outcome } = assembleCreate({ ...RUN_A }, M);
      expect(outcome.url.endsWith(`/issues/${outcome.issueNumber}`)).toBe(true);
      expect(issueSegmentOf(outcome.url)).toBe(String(outcome.issueNumber));
    });

    it("(b) update outcome: url 이 정확히 `/issues/${issueNumber}` 로 끝남 AND url tail 번호 segment === String(issueNumber)(byte-identical)", () => {
      const N = 424242;
      const { outcome } = assembleUpdate({ ...RUN_A }, N);
      expect(outcome.url.endsWith(`/issues/${outcome.issueNumber}`)).toBe(true);
      expect(issueSegmentOf(outcome.url)).toBe(String(outcome.issueNumber));
    });

    it("(c) 두 분기 모두 outcome.url 이 순수 issue URL 형식 전체 매칭 AND URL 마지막 path segment 정수 파싱값 === outcome.issueNumber", () => {
      const M = 987654;
      const N = 424242;
      const createOutcome = assembleCreate({ ...RUN_A }, M).outcome;
      const updateOutcome = assembleUpdate({ ...RUN_A }, N).outcome;

      for (const outcome of [createOutcome, updateOutcome]) {
        expect(outcome.url).toMatch(PURE_ISSUE_URL);
        const segment = outcome.url.split("/").pop() as string;
        expect(parseInt(segment, 10)).toBe(outcome.issueNumber);
      }
    });
  });

  describe("핵심 2 — co-유도 divergence-불가(같은 source 한 지점)", () => {
    it("(create) execStdout 번호를 M→M2 로 바꾼 두 번째 파싱에서 url·issueNumber 가 함께 이동(둘 다 새 값 반영 AND url tail == issueNumber 여전히 성립) — 두 필드가 독립적으로 움직이지 않고 동일 URL 매칭 한 지점에 종속", () => {
      const M = 111222;
      const M2 = 333444;
      const first = assembleCreate({ ...RUN_A }, M).outcome;
      const second = assembleCreate({ ...RUN_A }, M2, {
        execStdout: issueUrlStdout(M2),
      }).outcome;

      // 둘 다 새 값 반영(함께 이동).
      expect(first.issueNumber).toBe(M);
      expect(first.url).toBe(issueUrl(M));
      expect(second.issueNumber).toBe(M2);
      expect(second.url).toBe(issueUrl(M2));
      // 각 outcome 내부에서 url ⊇ issueNumber 불변 유지(divergence 불가).
      expect(issueSegmentOf(first.url)).toBe(String(first.issueNumber));
      expect(issueSegmentOf(second.url)).toBe(String(second.issueNumber));
    });

    it("(update) execStdout 번호를 N→N2 로 바꾼 두 번째 파싱에서 url·issueNumber 가 함께 이동 AND 각 outcome 내부 url tail == issueNumber 유지", () => {
      const N = 111222;
      const N2 = 555666;
      const first = assembleUpdate({ ...RUN_A }, N).outcome;
      const second = assembleUpdate({ ...RUN_A }, N2, {
        execStdout: issueUrlStdout(N2),
      }).outcome;

      expect(first.issueNumber).toBe(N);
      expect(first.url).toBe(issueUrl(N));
      expect(second.issueNumber).toBe(N2);
      expect(second.url).toBe(issueUrl(N2));
      expect(issueSegmentOf(first.url)).toBe(String(first.issueNumber));
      expect(issueSegmentOf(second.url)).toBe(String(second.issueNumber));
    });

    it("같은 execStdout 을 두 번 파싱 시 두 outcome 이 deep-equal(두 필드 함께 결정론) — create/update 각각", () => {
      const M = 987654;
      const N = 424242;
      expect(assembleCreate({ ...RUN_A }, M).outcome).toEqual(
        assembleCreate({ ...RUN_A }, M).outcome,
      );
      expect(assembleUpdate({ ...RUN_A }, N).outcome).toEqual(
        assembleUpdate({ ...RUN_A }, N).outcome,
      );
    });
  });

  describe("branch — create/update 두 분기 cross-field 대칭(분기 무관 동일 불변)", () => {
    it("동일 report/commandArgs 로 (i) 빈 search → create → /issues/M, (ii) marker-매칭 hit(N !== M) → update → /issues/N 각각 파싱 후 두 분기 모두 url ⊇ issueNumber(create: tail==M==issueNumber; update: tail==N==issueNumber) — cross-field 정합이 검색 분기 선택과 독립", () => {
      const M = 987654;
      const N = 424242;
      expect(N).not.toBe(M);
      const createChain = assembleCreate({ ...RUN_A }, M);
      const updateChain = assembleUpdate({ ...RUN_A }, N);

      // 분기 선택은 서로 다름.
      expect(createChain.plan.action.action).toBe("create");
      expect(updateChain.plan.action.action).toBe("update");

      // create: url tail == M == issueNumber.
      expect(createChain.outcome.issueNumber).toBe(M);
      expect(issueSegmentOf(createChain.outcome.url)).toBe(String(M));
      expect(
        createChain.outcome.url.endsWith(
          `/issues/${createChain.outcome.issueNumber}`,
        ),
      ).toBe(true);

      // update: url tail == N == issueNumber.
      expect(updateChain.outcome.issueNumber).toBe(N);
      expect(issueSegmentOf(updateChain.outcome.url)).toBe(String(N));
      expect(
        updateChain.outcome.url.endsWith(
          `/issues/${updateChain.outcome.issueNumber}`,
        ),
      ).toBe(true);
    });

    it("update 의 plan.argv[2] === String(N)(pre-exec 존재, 대조용 최소 인용)이더라도 outcome.url ⊇ outcome.issueNumber 는 여전히 edit execStdout 한 지점에서만 유도됨(그 argv 관통 자체 재단언 아님)", () => {
      const N = 424242;
      const { plan, outcome } = assembleUpdate({ ...RUN_A }, N);
      // pre-exec argv 에 N 존재(대조용 최소 인용).
      expect(plan.argv[2]).toBe(String(N));
      // 그러나 outcome 두 필드는 execStdout URL 한 지점 co-유도.
      expect(outcome.url).toBe(issueUrl(N));
      expect(issueSegmentOf(outcome.url)).toBe(String(outcome.issueNumber));
      expect(outcome.url.endsWith(`/issues/${outcome.issueNumber}`)).toBe(true);
    });
  });

  describe("branch — run/leg outcome 무관 cross-field 정합 안정", () => {
    it("(a) 서로 다른 run(RUN_A/RUN_B) 각각 create chain 호출하되 동일 create execStdout(/issues/M) → 두 outcome 모두 url ⊇ issueNumber(== M)·두 outcome deep-equal(url·issueNumber run 무관), 단 두 chain 의 descriptor.marker(=searchQuery)는 서로 다름", () => {
      const M = 987654;
      const chainA = assembleCreate({ ...RUN_A }, M);
      const chainB = assembleCreate({ ...RUN_B }, M);

      // 두 outcome 은 execStdout 종속이라 run 무관하게 deep-equal.
      expect(chainA.outcome).toEqual(chainB.outcome);
      for (const outcome of [chainA.outcome, chainB.outcome]) {
        expect(outcome.issueNumber).toBe(M);
        expect(issueSegmentOf(outcome.url)).toBe(String(outcome.issueNumber));
        expect(outcome.url.endsWith(`/issues/${outcome.issueNumber}`)).toBe(
          true,
        );
      }
      // 그러나 marker(=searchQuery)는 run-token 으로 서로 다름.
      expect(chainA.descriptor.marker).not.toBe(chainB.descriptor.marker);
      expect(chainA.commandArgs.searchQuery).not.toBe(
        chainB.commandArgs.searchQuery,
      );
    });

    it("(b) 동일 run·동일 execStdout 고정, leg outcome 조합만 다르게(eval pass/collect pass vs eval fail/collect skip) → 두 outcome 의 url·issueNumber 동일 + cross-field 정합 유지(leg status/overallStatus 무관)", () => {
      const M = 987654;
      const passChain = assembleViaChain(
        { leg: "eval", action: "run", passed: true },
        { leg: "collect", action: "run", passed: true },
        { ...RUN_A },
        M,
        { searchStdout: "[]" },
      );
      const mixedChain = assembleViaChain(
        { leg: "eval", action: "run", passed: false },
        { leg: "collect", action: "skip" },
        { ...RUN_A },
        M,
        { searchStdout: "[]" },
      );

      // overallStatus 는 서로 다름(축 분리 구조 확인).
      expect(passChain.report.overallStatus).not.toBe(
        mixedChain.report.overallStatus,
      );
      // 그러나 두 outcome 은 동일(execStdout 종속, leg status 무관).
      expect(passChain.outcome).toEqual(mixedChain.outcome);
      for (const outcome of [passChain.outcome, mixedChain.outcome]) {
        expect(outcome.issueNumber).toBe(M);
        expect(issueSegmentOf(outcome.url)).toBe(String(outcome.issueNumber));
      }
    });
  });

  describe("error path / negative cases — 예외 분기마다 각 1+ (단일 negative 금지)", () => {
    it("(a) run.gitSha 빈/공백 → descriptor(stage 1, report 합성) guard throw 로 chain 시작 차단", () => {
      expect(() =>
        assembleViaChain(
          evalOutcome(),
          collectOutcome(),
          { gitSha: "   ", dateToken: RUN_A.dateToken },
          1,
        ),
      ).toThrow();
    });

    it("(b) run.dateToken 빈/공백 → descriptor(stage 1) guard throw 대칭(gitSha 유효해도 필드별 독립 분기)", () => {
      expect(() =>
        assembleViaChain(
          evalOutcome(),
          collectOutcome(),
          { gitSha: RUN_A.gitSha, dateToken: "" },
          1,
        ),
      ).toThrow();
    });

    it("(c) execStdout 에 issue URL 미발견(빈/무관 텍스트/비-github 호스트/`/pull/`) → output-parse throw(URL-미발견 분기, 손상 stdout 이 조용히 outcome 으로 새어 url/issueNumber divergence 를 만드는 것 차단)", () => {
      const bads = [
        "",
        "no url at all\n",
        "https://gitlab.com/myungjoo/assessment-agent/issues/9\n",
        "https://github.com/myungjoo/assessment-agent/pull/9\n",
      ];
      for (const execStdout of bads) {
        // create 분기 대표.
        expect(() => assembleCreate({ ...RUN_A }, 1, { execStdout })).toThrow();
      }
      // edit 분기 대표(비-github) — 양쪽 분기 모두 동일 파서라 대칭 차단.
      expect(() =>
        assembleUpdate({ ...RUN_A }, 1, {
          execStdout: "https://gitlab.com/o/r/issues/5\n",
        }),
      ).toThrow();
    });

    it("(d) execStdout issueNumber 비양수(/issues/0·/issues/007·/issues/abc) → output-parse assertPositiveIssueNumber throw(비양수/선행0/비정수 분기 — 비정상 번호가 outcome 으로 새어 cross-field 정합을 깨는 것 차단)", () => {
      const bads = [
        issueUrlStdout(0),
        "https://github.com/myungjoo/assessment-agent/issues/007\n",
        "https://github.com/myungjoo/assessment-agent/issues/abc\n",
      ];
      for (const execStdout of bads) {
        expect(() => assembleCreate({ ...RUN_A }, 1, { execStdout })).toThrow();
      }
    });

    it("(e) update 분기 조립 시 컴포저에 넣는 search stdout 이 비-JSON('{')/비배열 JSON('{}') → 종단 컴포저 파서 throw 로 update plan(및 이후 output-parse 단계 진입) 미산출(손상 search stdout 이 분기 판정으로 새는 것 상류 차단)", () => {
      expect(() =>
        assembleViaChain(evalOutcome(), collectOutcome(), { ...RUN_A }, 1, {
          searchStdout: "{",
        }),
      ).toThrow();
      expect(() =>
        assembleViaChain(evalOutcome(), collectOutcome(), { ...RUN_A }, 1, {
          searchStdout: "{}",
        }),
      ).toThrow();
    });
  });

  describe("결정론 · 무공유 · no-mutation", () => {
    it("동일 (run, leg outcomes, execStdout) 입력 chain(두 분기 각각) 두 번 → descriptor/commandArgs/plan/outcome 가 두 번 deep-equal(plan.argv 배열 포함)", () => {
      const M = 987654;
      const N = 424242;
      const c1 = assembleCreate({ ...RUN_A }, M);
      const c2 = assembleCreate({ ...RUN_A }, M);
      expect(c1.descriptor).toEqual(c2.descriptor);
      expect(c1.commandArgs).toEqual(c2.commandArgs);
      expect(c1.plan).toEqual(c2.plan);
      expect(c1.plan.argv).toEqual(c2.plan.argv);
      expect(c1.outcome).toEqual(c2.outcome);

      const u1 = assembleUpdate({ ...RUN_A }, N);
      const u2 = assembleUpdate({ ...RUN_A }, N);
      expect(u1.plan).toEqual(u2.plan);
      expect(u1.plan.argv).toEqual(u2.plan.argv);
      expect(u1.outcome).toEqual(u2.outcome);
    });

    it("no-mutation — 입력 run/leg outcome literal·commandArgs 가 chain 호출 후 mutate 0(원본 deep-equal 유지, snapshot 대조)", () => {
      const run: RealDataResultIssueRunRef = { ...RUN_A };
      const evalLeg = evalOutcome();
      const collectLeg = collectOutcome();
      const runBefore = JSON.parse(JSON.stringify(run));
      const evalBefore = JSON.parse(JSON.stringify(evalLeg));
      const collectBefore = JSON.parse(JSON.stringify(collectLeg));

      const { commandArgs } = assembleViaChain(
        evalLeg,
        collectLeg,
        run,
        987654,
      );
      const commandArgsSnapshot = JSON.parse(JSON.stringify(commandArgs));
      resolveRealDataDailyStepDualLegRunReportIssueGhCommandPlan(
        "[]",
        commandArgs,
      );

      expect(run).toEqual(runBefore);
      expect(evalLeg).toEqual(evalBefore);
      expect(collectLeg).toEqual(collectBefore);
      expect(commandArgs).toEqual(commandArgsSnapshot);
    });

    it("무공유 — outcomeCreate·outcomeUpdate 객체가 서로/다음 호출 결과와 referential identity 분리(not.toBe)", () => {
      const M = 987654;
      const N = 424242;
      const createFirst = assembleCreate({ ...RUN_A }, M).outcome;
      const createSecond = assembleCreate({ ...RUN_A }, M).outcome;
      const updateOutcome = assembleUpdate({ ...RUN_A }, N).outcome;
      expect(createFirst).not.toBe(createSecond);
      expect(createFirst).not.toBe(updateOutcome);
      expect(createSecond).not.toBe(updateOutcome);
    });
  });

  describe("raw / credential 누출 0(R-59 / REQ-059)", () => {
    it("chain 표면(descriptor.{title,marker,body} / searchQuery / plan.argv 전체 / outcome.url 두 분기 모두)에 token/secret/raw narrative 어휘 미등장", () => {
      const M = 987654;
      const N = 424242;
      const createChain = assembleCreate({ ...RUN_A }, M);
      const updateChain = assembleUpdate({ ...RUN_A }, N);

      const joined = [
        createChain.descriptor.title,
        createChain.descriptor.marker,
        createChain.descriptor.body,
        createChain.commandArgs.searchQuery,
        ...createChain.plan.argv,
        createChain.outcome.url,
        ...updateChain.plan.argv,
        updateChain.outcome.url,
      ].join(" ");

      expect(joined).not.toContain("--token");
      expect(joined).not.toContain("GITHUB_TOKEN");
      expect(joined).not.toContain("GH_TOKEN");
      expect(joined).not.toContain("ghp_");
      expect(joined).not.toContain("narrative");
      expect(joined).not.toMatch(/ghp_[A-Za-z0-9]/);
    });

    it("outcome.url(create·update 둘 다)이 순수 issue URL 형식만 담고 credential·raw github API 토큰·query string 미포함", () => {
      const M = 987654;
      const N = 424242;
      const createUrl = assembleCreate({ ...RUN_A }, M).outcome.url;
      const updateUrl = assembleUpdate({ ...RUN_A }, N).outcome.url;
      for (const url of [createUrl, updateUrl]) {
        expect(url).toMatch(PURE_ISSUE_URL);
        expect(url).not.toContain("?");
      }
    });

    it("leg outcome.specPath 에 sentinel 을 넣어도 outcome.url/issueNumber 표면에 sentinel 미누출(create·update)", () => {
      const sentinel = "ghp_SENTINELsecret1234";
      const evalLeg: RealDataDailyStepLegRunOutcome = {
        leg: "eval",
        action: "run",
        passed: true,
        specPath: sentinel,
      };
      const collectLeg: RealDataDailyStepLegRunOutcome = {
        leg: "collect",
        action: "run",
        passed: true,
        specPath: sentinel,
      };
      const createOutcome = assembleViaChain(
        evalLeg,
        collectLeg,
        { ...RUN_A },
        987654,
        {
          searchStdout: "[]",
        },
      ).outcome;
      expect(createOutcome.url).not.toContain(sentinel);
      expect(String(createOutcome.issueNumber)).not.toContain(sentinel);
    });

    it("output-parse guard throw 메시지가 raw 활동 본문·credential 을 노출하지 않음(필드명·유효성만) — 비양수 번호 negative case 에서 확인", () => {
      const sentinel = "ghp_SENTINELsecret1234";
      let thrown: Error | undefined;
      try {
        parseRealDataDailyStepDualLegRunReportIssueCreateEditOutput(
          `${sentinel} https://github.com/myungjoo/assessment-agent/issues/0\n`,
        );
      } catch (err) {
        thrown = err as Error;
      }
      expect(thrown).toBeDefined();
      expect(thrown?.message).not.toContain(sentinel);
      expect(thrown?.message).not.toContain("ghp_");
    });
  });
});
