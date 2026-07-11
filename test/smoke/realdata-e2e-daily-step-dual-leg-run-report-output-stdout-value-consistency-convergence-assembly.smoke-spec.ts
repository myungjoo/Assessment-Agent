// realdata-e2e-daily-step-dual-leg-run-report-output-stdout-value-consistency-
// convergence-assembly.smoke-spec.ts —
// 실 평가 e2e daily-step dual-leg run report publish chain 을 create/edit stdout 까지
// 통과시켜 파서(`parse...IssueCreateEditOutput`)가 산출한 outcome(`{issueNumber, url}`)의
// **전체 값**이 raw `gh issue create` / `gh issue edit <n>` stdout 으로부터 컴포저 재호출
// 없이 **single-source 독립 재유도**한 expected 와 deep-equal 정합함을 T-0906 가드
// (`assertRealDataDailyStepDualLegRunReportIssueOutputConsistentWithStdout`)로 박제하는
// post-execution output↔stdout value-consistency convergence non-gated build-time smoke
// (T-0924 박제, PLAN.md 109행 🟢 실 평가 e2e step ④, REQ-032 raw 미저장 / REQ-059).
//
// 절단면 — post-execution output producer ↔ raw stdout 값-정합(single-source) seam:
//   dual-leg run report chain(report → descriptor → commandArgs → searchArgv → resolve
//   → gh-argv → create/edit stdout → output-parse → outcome)의 마지막 미봉합 절단면 —
//   파서 산출 outcome 의 issueNumber·url **전체 값**이 raw stdout 으로부터 독립 재유도한
//   expected 와 deep-equal 인지 — 는 어느 smoke 에도 묶이지 않았다(`git grep
//   OutputConsistentWithStdout -- test/smoke/*` = 0 hit). 가드 helper 자체(T-0906)와 파서
//   self-wire(T-0907, output-parse.ts line 162~)는 이미 main 에 박제됨 — 본 spec 은 그
//   self-wire 를 재배선하지 않고 chain 통과 outcome 을 가드로 검증하는 **smoke 그물만**
//   신설한다. summary 축 T-0723(`assertRealDataResultIssueOutputConsistentWithStdout`)
//   value-consistency 커버리지의 dual-leg mirror.
//
// 형제 smoke 와의 차별(= issueNumber/url 전체 값 축, 키 집합 아님):
//   * T-0923(outcome-parse-shape convergence) — 파서 산출 outcome own-key set 이 선언
//     parse-shape 키 집합(`["issueNumber","url"]`)과 set-equal 인지 **키 집합**만 검증.
//     set-equality 가드는 키 집합만 보므로 issueNumber/url **값**이 drift 하거나 잘못된
//     매칭 URL 이 선택돼도 통과한다. 그 key-set shape(set-equality) 자체 재단언 금지.
//   * T-0918~T-0922(triple/4-boundary/execute-side/dual-medium/re-publish) — argv 절단면·
//     create→update 상태 전이·idempotency·매체 직교만. 그 절단면 자체 재단언 금지.
//   본 spec 은 outcome 의 issueNumber·url **전체 값** ↔ stdout 독립 재유도 deep-equal 축만
//   박제한다(값 drift 는 RangeError·구조 결손은 TypeError 로 분리).
//
// 따라서 본 spec 은:
//    🔥 실 LLM 호출 0 — orchestrator / scoring service / gateway 미사용. synthetic leg
//       outcome / run / stdout literal 을 조립 체인에 직접 공급(실 평가·수집·jest spawn 0).
//    🔥 실 네트워크 호출 0 — github / Ollama / gh 호출 0. fetch 0. process.env 읽기 0.
//    🔥 실 gh 실행 0 — search / issue create / issue edit 실 실행 0. execFile('gh', …) 0.
//       실 github publish 부작용 0 — create/edit-exec 의 URL·M 은 synthetic stdout literal.
//    🔥 credential 0 / secret 0 / DB 0 / 비용 0 — public CI 에서 항상 green 발화(R-113).
//    🔥 새 외부 dependency 0 — 기존 build*/resolve*/parse*/assert* 컴포저 import 재사용만
//       (파서·interface·가드 본문 변경 0 — import·호출만).
//    🔥 gating / describe.skip / env-gating 배선 0 — 순수 build-time in-memory 검증만.
//
// raw / credential 누출 0(R-59 / REQ-032 / REQ-059): 본 spec 은 outcome 의 issueNumber(식별
//   자)·url string 값만 대조하고, GH_TOKEN/PAT/`ghp_`/`--token`/narrative 어휘를 키/값
//   어디에도 담지 않으며, 가드 throw 메시지가 issueNumber·url 값만 노출(raw 활동 본문·
//   credential 미노출)함을 negative case 에서 확인한다.
import {
  buildRealDataDailyStepDualLegRunReport,
  type RealDataDailyStepLegRunOutcome,
} from "../helpers/realdata-e2e-daily-step-dual-leg-run-report";
import { buildRealDataDailyStepDualLegRunReportIssueCommandArgs } from "../helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-command-args";
import { buildRealDataDailyStepDualLegRunReportIssueDescriptor } from "../helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-descriptor";
import { resolveRealDataDailyStepDualLegRunReportIssueGhCommandPlan } from "../helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-gh-command-plan";
import {
  parseRealDataDailyStepDualLegRunReportIssueCreateEditOutput,
  type RealDataDailyStepDualLegRunReportIssueOutcome,
} from "../helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-output-parse";
import { assertRealDataDailyStepDualLegRunReportIssueOutputConsistentWithStdout } from "../helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-output-parse-consistency";
import { buildRealDataDailyStepDualLegRunReportIssueSearchGhArgv } from "../helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-search-argv";
import type { RealDataResultIssueRunRef } from "../helpers/realdata-e2e-result-issue-descriptor";

// 결정론 run 식별자 fixture — gitSha + dateToken 비공백 안정 토큰. 매 it 가 spread 복제로
// 받아 입력 mutate 누설 0. token/secret/raw narrative 어휘 미포함(credential 누출 0 단언
// fixture 전제).
const RUN_A: RealDataResultIssueRunRef = {
  gitSha: "abc1234",
  dateToken: "2026-07-12",
};

// synthetic 이슈 번호(raw) — github 이 create/edit 후 부여한 번호를 흉내낸다. marker
// (`${dateToken}@${gitSha}` 조각)·searchArgv 원소 어느 것의 substring 도 아닌 양수로 골라
// 값-정합 축이 우연 매칭이 아님을 보장("5183" 은 RUN_A marker 의 substring 아님).
const ASSIGNED_RAW_M = 5183;

// synthetic leg outcome fixture — eval / collect 각 leg 의 run outcome literal. 조립
// 체인은 leg outcome 을 report → descriptor 로 흘려보내는 surface 만 통과하므로 도메인
// 타입 정합만 만족하는 minimal literal 로 충분하다(실 jest spawn 0).
function evalOutcome(): RealDataDailyStepLegRunOutcome {
  return { leg: "eval", action: "run", passed: true };
}

function collectOutcome(): RealDataDailyStepLegRunOutcome {
  return { leg: "collect", action: "run", passed: true };
}

// marker 를 body 에 포함한 synthetic search stdout(1+ hit) — update 분기 유도. gh search
// issues --json number,title,body 응답을 흉내낸 literal. 빈 hit("[]")=create 경로.
function searchHitStdout(marker: string, ...numbers: number[]): string {
  return JSON.stringify(
    numbers.map((n) => ({
      number: n,
      title: `기존 dual-leg run report 이슈 #${n}`,
      body: `${marker}\n\n본문 일부`,
    })),
  );
}

// synthetic gh issue create/edit stdout — 지정 이슈 번호의 유효 issue URL 한 줄(trailing
// 개행 포함). 실 gh round-trip 없이 파서에 직접 주입해 outcome 을 산출한다.
function issueUrlStdout(n: number): string {
  return `https://github.com/myungjoo/assessment-agent/issues/${n}\n`;
}

// 독립 재유도 helper(spec 로컬, 컴포저 재호출 0) — stdout 만으로 첫 매칭 issue URL 을 뽑아
// expected `{issueNumber, url}` 을 재구성한다. 가드가 stdout 을 진실의 원천으로 삼음을
// 반영해 하드코딩 대신 stdout 파생으로 expected 를 만든다(single-source).
function reDeriveFromStdout(stdout: string): {
  issueNumber: number;
  url: string;
} {
  const match =
    /https:\/\/github\.com\/[^/\s]+\/[^/\s]+\/issues\/(\d+)(?![\w])/.exec(
      stdout,
    );
  if (match === null) {
    throw new Error(
      "독립 재유도 실패 — stdout 에 issue URL 이 없다(테스트 fixture 오류).",
    );
  }
  return { issueNumber: Number(match[1]), url: match[0].trim() };
}

// chain 조립 — report → descriptor → commandArgs → searchArgv → resolve 를 주어진
// searchStdout 로 한 번 관통시킨 뒤 create/edit-exec stdout 에 output-parse 를 적용해
// outcome 을 산출한다. searchStdout="[]" 면 create 분기, marker hit 이면 update 분기.
// execStdout 은 create/edit-exec 이 돌려줄 synthetic issue URL literal. 각 stage 의 guard
// throw 는 자체 try/catch 없이 그대로 전파된다.
function assembleOutcome(
  evalLeg: RealDataDailyStepLegRunOutcome,
  collectLeg: RealDataDailyStepLegRunOutcome,
  run: RealDataResultIssueRunRef,
  searchStdout: string,
  execStdout: string,
) {
  const report = buildRealDataDailyStepDualLegRunReport(
    evalLeg,
    collectLeg,
    run,
  );
  const descriptor =
    buildRealDataDailyStepDualLegRunReportIssueDescriptor(report);
  const commandArgs =
    buildRealDataDailyStepDualLegRunReportIssueCommandArgs(descriptor);
  const searchArgv =
    buildRealDataDailyStepDualLegRunReportIssueSearchGhArgv(commandArgs);
  const plan = resolveRealDataDailyStepDualLegRunReportIssueGhCommandPlan(
    searchStdout,
    commandArgs,
  );
  const outcome =
    parseRealDataDailyStepDualLegRunReportIssueCreateEditOutput(execStdout);
  return { report, descriptor, commandArgs, searchArgv, plan, outcome };
}

// create 경로 outcome 조립 — 빈 검색("[]") → create 분기 → create-exec stdout(URL 안 M)
// → outcome.
function assembleCreateOutcome(
  run: RealDataResultIssueRunRef = { ...RUN_A },
  rawM: number = ASSIGNED_RAW_M,
) {
  const execStdout = issueUrlStdout(rawM);
  const assembled = assembleOutcome(
    evalOutcome(),
    collectOutcome(),
    run,
    "[]",
    execStdout,
  );
  return { ...assembled, execStdout };
}

// update(edit) 경로 outcome 조립 — number=M hit → update 분기 → edit-exec stdout
// (`.../issues/M`) → outcome. create 경로와 동형 outcome 값을 산출해야 한다.
function assembleEditOutcome(
  run: RealDataResultIssueRunRef = { ...RUN_A },
  rawM: number = ASSIGNED_RAW_M,
) {
  const report = buildRealDataDailyStepDualLegRunReport(
    evalOutcome(),
    collectOutcome(),
    run,
  );
  const descriptor =
    buildRealDataDailyStepDualLegRunReportIssueDescriptor(report);
  const commandArgs =
    buildRealDataDailyStepDualLegRunReportIssueCommandArgs(descriptor);
  const execStdout = issueUrlStdout(rawM);
  const assembled = assembleOutcome(
    evalOutcome(),
    collectOutcome(),
    run,
    searchHitStdout(commandArgs.searchQuery, rawM),
    execStdout,
  );
  return { ...assembled, execStdout };
}

describe("Smoke(non-gated): dual-leg run report output↔stdout value-consistency 수렴(chain 을 create/edit stdout 까지 통과시켜 파서 산출 outcome 의 issueNumber·url 전체 값을 stdout 독립 재유도 expected 와 deep-equal 로 T-0906 가드 박제) live-gh 0 검증", () => {
  describe("happy path — create-exec value-consistency(chain 산출 outcome ↔ stdout 독립 재유도 deep-equal)", () => {
    it("create 경로 chain(빈 검색→create→create-exec stdout→output-parse) 산출 outcome 에 guard(outcome, createExecStdout) 적용 → 값-정합이라 throw 없이 void AND outcome.issueNumber === M 및 outcome.url === create-exec stdout 이 담은 issue URL 전체(trim)", () => {
      const { plan, outcome, execStdout } = assembleCreateOutcome();
      // create 분기 확인(chain 이 실제로 create 경로를 통과했는지).
      expect(plan.action.action).toBe("create");
      // 값-정합 → guard 는 throw 없이 void.
      expect(() =>
        assertRealDataDailyStepDualLegRunReportIssueOutputConsistentWithStdout(
          outcome,
          execStdout,
        ),
      ).not.toThrow();
      // issueNumber·url 값 직접 대조.
      expect(outcome.issueNumber).toBe(ASSIGNED_RAW_M);
      expect(outcome.url).toBe(
        `https://github.com/myungjoo/assessment-agent/issues/${ASSIGNED_RAW_M}`,
      );
    });
  });

  describe("happy path — edit-exec value-consistency 동형(create/edit 두 경로 동형)", () => {
    it("update 경로 chain(number=M hit→update→edit-exec stdout→output-parse) 산출 outcome 도 guard(outcome, editExecStdout) 가 void(값-정합) AND edit-exec outcome 의 {issueNumber,url} 값이 create-exec outcome 과 동일 — 두 실행 경로가 같은 이슈 M 을 겨눠 같은 값 산출", () => {
      const create = assembleCreateOutcome();
      const edit = assembleEditOutcome();
      // update 분기 확인.
      expect(edit.plan.action.action).toBe("update");
      // edit outcome 도 값-정합.
      expect(() =>
        assertRealDataDailyStepDualLegRunReportIssueOutputConsistentWithStdout(
          edit.outcome,
          edit.execStdout,
        ),
      ).not.toThrow();
      // create/edit 두 경로 outcome 값 동일(동형 — 같은 이슈 M).
      expect(edit.outcome).toEqual(create.outcome);
      expect(edit.outcome.issueNumber).toBe(create.outcome.issueNumber);
      expect(edit.outcome.url).toBe(create.outcome.url);
    });
  });

  describe("issueNumber/url 값-threading — outcome 이 chain target M 과 수렴(값 축)", () => {
    it("update 경로 outcome.issueNumber === M(search-hit number = resolve 가 좁힌 plan.action.update.issueNumber = editArgv[2] 의 String 원본) AND create/update 두 경로 모두 outcome.url 이 해당 exec stdout 의 첫 매칭 issue URL 전체(trim)와 byte-identical", () => {
      const create = assembleCreateOutcome();
      const edit = assembleEditOutcome();
      // update 경로 — resolve 가 좁힌 update.issueNumber·editArgv[2]·outcome.issueNumber 수렴.
      expect(edit.plan.action.action).toBe("update");
      if (edit.plan.action.action === "update") {
        expect(edit.plan.action.issueNumber).toBe(ASSIGNED_RAW_M);
      }
      expect(edit.plan.argv[2]).toBe(String(ASSIGNED_RAW_M));
      expect(edit.outcome.issueNumber).toBe(ASSIGNED_RAW_M);
      // create/update 두 경로 outcome.url = 해당 exec stdout 첫 매칭 URL 전체(trim) byte-identical.
      expect(create.outcome.url).toBe(create.execStdout.trim());
      expect(edit.outcome.url).toBe(edit.execStdout.trim());
    });
  });

  describe("single-source 독립 재유도 — 컴포저 재호출 0, stdout 을 진실의 원천으로", () => {
    it("동일 create/edit stdout 에서 컴포저 재호출 없이 첫 매칭 issue URL 을 뽑아 산출한 expected {issueNumber,url} 이 chain 산출 outcome 과 deep-equal(가드가 stdout 을 진실의 원천으로 삼음 반영)", () => {
      const create = assembleCreateOutcome();
      const edit = assembleEditOutcome();
      expect(create.outcome).toEqual(reDeriveFromStdout(create.execStdout));
      expect(edit.outcome).toEqual(reDeriveFromStdout(edit.execStdout));
    });

    it("첫 매칭 우선 결정론 — stdout 에 issue URL 이 둘(.../issues/M 다음 .../issues/K, K≠M) 담겨도 outcome·재유도 expected 모두 첫 매칭 M 을 취함 AND guard void", () => {
      const K = ASSIGNED_RAW_M + 42; // K ≠ M
      const twoUrlStdout =
        `https://github.com/myungjoo/assessment-agent/issues/${ASSIGNED_RAW_M}\n` +
        `https://github.com/myungjoo/assessment-agent/issues/${K}\n`;
      const outcome =
        parseRealDataDailyStepDualLegRunReportIssueCreateEditOutput(
          twoUrlStdout,
        );
      // 첫 매칭 M 을 취함.
      expect(outcome.issueNumber).toBe(ASSIGNED_RAW_M);
      expect(outcome).toEqual(reDeriveFromStdout(twoUrlStdout));
      // 가드도 첫 매칭 기준이라 void.
      expect(() =>
        assertRealDataDailyStepDualLegRunReportIssueOutputConsistentWithStdout(
          outcome,
          twoUrlStdout,
        ),
      ).not.toThrow();
    });
  });

  describe("error path / negative cases — 예외 분기마다 각 1+(단일 negative 금지)", () => {
    it("(a) issueNumber 값 drift(RangeError) — chain 산출 outcome spread 복제 후 issueNumber 를 M+1 로 변형 → guard 가 stdout 재유도 M 과 어긋나 RangeError(값 정합 위반)", () => {
      const { outcome, execStdout } = assembleCreateOutcome();
      const drifted: RealDataDailyStepDualLegRunReportIssueOutcome = {
        ...outcome,
        issueNumber: outcome.issueNumber + 1,
      };
      expect(() =>
        assertRealDataDailyStepDualLegRunReportIssueOutputConsistentWithStdout(
          drifted,
          execStdout,
        ),
      ).toThrow(RangeError);
    });

    it("(b) url 값 drift(RangeError) — outcome 복제 후 url 을 다른 issue 번호/호스트/미trim 공백으로 변형 → 각각 guard RangeError", () => {
      const { outcome, execStdout } = assembleCreateOutcome();
      const cases: string[] = [
        `https://github.com/myungjoo/assessment-agent/issues/${ASSIGNED_RAW_M + 1}`, // 다른 번호
        `https://gitlab.com/myungjoo/assessment-agent/issues/${ASSIGNED_RAW_M}`, // 다른 호스트
        `https://github.com/myungjoo/assessment-agent/issues/${ASSIGNED_RAW_M} `, // 미trim 공백
      ];
      for (const badUrl of cases) {
        const drifted: RealDataDailyStepDualLegRunReportIssueOutcome = {
          ...outcome,
          url: badUrl,
        };
        expect(() =>
          assertRealDataDailyStepDualLegRunReportIssueOutputConsistentWithStdout(
            drifted,
            execStdout,
          ),
        ).toThrow(RangeError);
      }
    });

    it("(c) 잉여 필드 drift(RangeError) — outcome 복제 후 htmlUrl / token 각 1개 추가 → guard 가 키 개수(≠2)로 RangeError(추가필드 drift)", () => {
      const { outcome, execStdout } = assembleCreateOutcome();
      const withHtmlUrl = {
        ...outcome,
        htmlUrl: "https://github.com/o/r/issues/1",
      };
      const withToken = { ...outcome, token: "ghp_leaked" };
      expect(() =>
        assertRealDataDailyStepDualLegRunReportIssueOutputConsistentWithStdout(
          withHtmlUrl as RealDataDailyStepDualLegRunReportIssueOutcome,
          execStdout,
        ),
      ).toThrow(RangeError);
      expect(() =>
        assertRealDataDailyStepDualLegRunReportIssueOutputConsistentWithStdout(
          withToken as RealDataDailyStepDualLegRunReportIssueOutcome,
          execStdout,
        ),
      ).toThrow(RangeError);
    });

    it("(d) 구조 결손(TypeError) — outcome=null/undefined/숫자/문자열/배열(비객체) 각각 → guard TypeError(값 정합 RangeError 와 분리)", () => {
      const { execStdout } = assembleCreateOutcome();
      const badOutcomes: unknown[] = [null, undefined, 42, "not-an-object", []];
      for (const bad of badOutcomes) {
        expect(() =>
          assertRealDataDailyStepDualLegRunReportIssueOutputConsistentWithStdout(
            bad as unknown as RealDataDailyStepDualLegRunReportIssueOutcome,
            execStdout,
          ),
        ).toThrow(TypeError);
      }
    });

    it("(d') 구조 결손(TypeError) — 정상 outcome + stdout=비-string(number/null) → guard TypeError", () => {
      const { outcome } = assembleCreateOutcome();
      const badStdouts: unknown[] = [42, null];
      for (const bad of badStdouts) {
        expect(() =>
          assertRealDataDailyStepDualLegRunReportIssueOutputConsistentWithStdout(
            outcome,
            bad as unknown as string,
          ),
        ).toThrow(TypeError);
      }
    });

    it("(e-i) stdout 재유도 구조 결손 — URL 미발견(빈/공백/무관 텍스트/비-github/`/pull/`) → guard TypeError(재유도 자체 불가)", () => {
      const { outcome } = assembleCreateOutcome();
      const noUrlStdouts: string[] = [
        "",
        "   ",
        "관련 없는 텍스트",
        "https://gitlab.com/o/r/issues/9\n",
        "https://github.com/o/r/pull/9\n",
      ];
      for (const bad of noUrlStdouts) {
        expect(() =>
          assertRealDataDailyStepDualLegRunReportIssueOutputConsistentWithStdout(
            outcome,
            bad,
          ),
        ).toThrow(TypeError);
      }
    });

    it("(e-ii) stdout 재유도 구조 결손 — URL 안 <number> 비양정수(/issues/0·선행0) → guard TypeError(URL-미발견 분기와 분리)", () => {
      const { outcome } = assembleCreateOutcome();
      const nonPositiveStdouts: string[] = [
        "https://github.com/o/r/issues/0\n",
        "https://github.com/o/r/issues/007\n",
      ];
      for (const bad of nonPositiveStdouts) {
        expect(() =>
          assertRealDataDailyStepDualLegRunReportIssueOutputConsistentWithStdout(
            outcome,
            bad,
          ),
        ).toThrow(TypeError);
      }
    });

    it("(f-i) chain 상류 차단 — run.gitSha 빈/공백 → descriptor(stage 1) guard throw 로 outcome 산출 자체 차단(잘못된 outcome 이 value-consistency 가드에 도달 불가)", () => {
      expect(() =>
        assembleCreateOutcome({ gitSha: "   ", dateToken: RUN_A.dateToken }),
      ).toThrow();
    });

    it("(f-ii) chain 상류 차단 — create/edit-exec stdout 이 issue URL 미발견 또는 issueNumber 비양수 → parse...IssueCreateEditOutput throw 로 outcome 미산출", () => {
      const bases = { ...RUN_A };
      // URL 미발견.
      expect(() =>
        assembleOutcome(evalOutcome(), collectOutcome(), bases, "[]", "no url"),
      ).toThrow();
      // issueNumber 비양수.
      expect(() =>
        assembleOutcome(
          evalOutcome(),
          collectOutcome(),
          bases,
          "[]",
          issueUrlStdout(0),
        ),
      ).toThrow();
    });
  });

  describe("결정론 · 무공유 · no-mutation", () => {
    it("동일 (run, leg outcomes, execStdout) 로 chain→outcome→guard 두 번 실행 → 두 outcome deep-equal(byte-identical) AND 둘 다 guard not.toThrow", () => {
      const a = assembleCreateOutcome();
      const b = assembleCreateOutcome();
      expect(a.outcome).toEqual(b.outcome);
      expect(() =>
        assertRealDataDailyStepDualLegRunReportIssueOutputConsistentWithStdout(
          a.outcome,
          a.execStdout,
        ),
      ).not.toThrow();
      expect(() =>
        assertRealDataDailyStepDualLegRunReportIssueOutputConsistentWithStdout(
          b.outcome,
          b.execStdout,
        ),
      ).not.toThrow();
    });

    it("no-mutation — guard 호출이 outcome·stdout 을 mutate 0(호출 전후 JSON snapshot deep-equal, stdout 문자열 불변)", () => {
      const { outcome, execStdout } = assembleCreateOutcome();
      const outcomeBefore = JSON.parse(JSON.stringify(outcome));
      const stdoutBefore = execStdout;
      assertRealDataDailyStepDualLegRunReportIssueOutputConsistentWithStdout(
        outcome,
        execStdout,
      );
      expect(outcome).toEqual(outcomeBefore);
      expect(execStdout).toBe(stdoutBefore);
    });
  });

  describe("raw / credential 누출 0(R-59 / REQ-032 / REQ-059)", () => {
    it("chain 산출 outcome 의 own key 집합이 정확히 {issueNumber, url} 뿐이며 GH_TOKEN/PAT/ghp_/--token/GITHUB_TOKEN/narrative 어휘를 키/값 어디에도 담지 않음", () => {
      const { outcome } = assembleCreateOutcome();
      expect(Object.keys(outcome).sort()).toEqual(["issueNumber", "url"]);
      const joined = [
        ...Object.keys(outcome),
        String(outcome.issueNumber),
        outcome.url,
      ].join(" ");
      expect(joined).not.toContain("--token");
      expect(joined).not.toContain("GITHUB_TOKEN");
      expect(joined).not.toContain("GH_TOKEN");
      expect(joined).not.toContain("ghp_");
      expect(joined).not.toContain("narrative");
      expect(joined).not.toMatch(/ghp_[A-Za-z0-9]/);
    });

    it("leg outcome.specPath 에 sentinel 을 넣어도 outcome.url/issueNumber 및 값-정합 재유도에 sentinel 미누출(outcome 은 exec URL·M 파생만)", () => {
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
      const execStdout = issueUrlStdout(ASSIGNED_RAW_M);
      const { outcome } = assembleOutcome(
        evalLeg,
        collectLeg,
        { ...RUN_A },
        "[]",
        execStdout,
      );
      expect(Object.keys(outcome).join(" ")).not.toContain(sentinel);
      expect(outcome.url).not.toContain(sentinel);
      expect(String(outcome.issueNumber)).not.toContain(sentinel);
      // 값-정합 재유도 expected 에도 sentinel 미누출.
      expect(JSON.stringify(reDeriveFromStdout(execStdout))).not.toContain(
        sentinel,
      );
    });

    it("가드 throw 메시지가 raw 활동 본문·credential 을 노출하지 않음(issueNumber·url 값만) — issueNumber drift RangeError 메시지에 --token/ghp_/GITHUB_TOKEN/narrative 미포함", () => {
      const { outcome, execStdout } = assembleCreateOutcome();
      const drifted: RealDataDailyStepDualLegRunReportIssueOutcome = {
        ...outcome,
        issueNumber: outcome.issueNumber + 1,
      };
      let message = "";
      try {
        assertRealDataDailyStepDualLegRunReportIssueOutputConsistentWithStdout(
          drifted,
          execStdout,
        );
      } catch (err) {
        message = (err as Error).message;
      }
      expect(message).toContain(String(outcome.issueNumber)); // stdout 값(재유도 기대)
      expect(message).not.toContain("--token");
      expect(message).not.toContain("GITHUB_TOKEN");
      expect(message).not.toContain("ghp_");
      expect(message).not.toContain("narrative");
    });
  });
});
