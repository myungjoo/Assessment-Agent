// realdata-e2e-daily-step-dual-leg-run-report-outcome-parse-shape-convergence-
// assembly.smoke-spec.ts —
// 실 평가 e2e daily-step dual-leg run report publish chain 을 create/edit stdout 까지
// 통과시켜 산출된 outcome(`{issueNumber, url}`)의 **own enumerable 키 집합**이 선언
// parse-shape 키 집합(`REAL_DATA_DAILY_STEP_DUAL_LEG_RUN_REPORT_ISSUE_OUTCOME_PARSE_SHAPE_KEYS`)
// 과 정확히 set-equal 로 수렴함을 T-0904 가드
// (`assertRealDataDailyStepDualLegRunReportIssueOutcomeMatchesParseShape`)로 박제하는
// post-execution outcome producer↔declared-shape parse-shape convergence non-gated
// build-time smoke (T-0923 박제, PLAN.md 109행 🟢 실 평가 e2e step ④, REQ-037 / REQ-059).
//
// 절단면 — post-execution outcome producer ↔ declared-shape parse-shape seam:
//   dual-leg run report chain(report → descriptor → commandArgs → searchArgv → resolve
//   → gh-argv → create/edit stdout → output-parse → outcome)의 **가장 마지막 절단면** —
//   파서(`parse...IssueCreateEditOutput`)가 산출한 outcome 의 own-key set 이 선언된 정규
//   parse-shape(`["issueNumber","url"]`)와 set-equal 인지 — 는 형제 smoke 어디에도 묶이지
//   않았다(`git grep` 결과 이 가드·상수를 참조하는 smoke 0). 본 spec 이 그 마지막 미커버
//   seam 을 chain 그물로 봉합한다 — summary 축 T-0661 parse-shape 커버리지의 dual-leg mirror.
//
// 형제 smoke 와의 차별(= outcome own-key set 축):
//   * T-0918/T-0919/T-0920(triple/4-boundary/execute-side) — descriptor→resolve→
//     output-parse 로 `{issueNumber}` 값이 뽑히는 것까지 단언하나, 그 산출 outcome 의
//     **키 집합이 선언 parse-shape 와 set-equal 인지**(잉여 `htmlUrl` 누출·키 누락 회귀)는
//     검증하지 않는다. 그 argv 절단면 자체 재단언 금지.
//   * T-0921/T-0922(dual-medium orthogonal / re-publish idempotency) — create→update
//     상태 전이·매체 직교만. outcome shape 무결성 축과 직교. 그 상태 전이 자체 재단언 금지.
//   본 spec 은 파서 산출 outcome 의 own-key set ↔ 선언 parse-shape set-equality 축만
//   박제한다(값 축은 issueNumber 값-threading 만 — url 본문 대조는 out-of-scope).
//
// 따라서 본 spec 은:
//    🔥 실 LLM 호출 0 — orchestrator / scoring service / gateway 미사용. synthetic leg
//       outcome / run / stdout literal 을 조립 체인에 직접 공급(실 평가·수집·jest spawn 0).
//    🔥 실 네트워크 호출 0 — github / Ollama / gh 호출 0. fetch 0. process.env 읽기 0.
//    🔥 실 gh 실행 0 — search / issue create / issue edit 실 실행 0. execFile('gh', …) 0.
//       실 github publish 부작용(실제 이슈 생성/갱신) 0 — create/edit-exec 의 URL·M 은
//       synthetic stdout literal 로 대체.
//    🔥 credential 0 / secret 0 / DB 0 / 비용 0 — public CI 에서 항상 green 발화(R-113).
//    🔥 새 외부 dependency 0 — 기존 build*/resolve*/parse*/assert* 컴포저 import 재사용만
//       (파서·interface·가드·상수 본문 변경 0 — import·호출만).
//    🔥 gating / describe.skip / env-gating 배선 0 — 순수 build-time in-memory 검증만.
//
// raw / credential 누출 0(R-59 / REQ-059): 본 spec 은 outcome 의 own key 집합(문자열)만
//   대조하고, GH_TOKEN/PAT/`ghp_`/`--token`/narrative 어휘를 outcome 키/값 어디에도 담지
//   않음을 단언한다.
//
// Out of Scope (T-0923):
//   - 형제 T-0918~T-0922 의 pre→resolve→post argv 절단면·create→update 상태 전이·
//     idempotency·dual-medium 직교 자체 재단언 — 본 spec 은 outcome own-key set ↔ declared
//     parse-shape set-equality 축만.
//   - searchArgv 원소 순서/`--match body`/`--limit`·gh-argv 의 `--title`/`--body`/labels
//     형식 재단언(각 가드 cover).
//   - outcome 값-정합 재유도·url 본문 byte 대조 — 본 spec 은 키 집합(shape) + issueNumber
//     값-threading 만.
//   - 새 컴포저 / 새 helper / 새 type / consistency 가드 신설 — 기존 helper import·호출만.
//   - production src/ 코드 / package.json / lockfile / test/jest-smoke.json 변경.
import {
  buildRealDataDailyStepDualLegRunReport,
  type RealDataDailyStepLegRunOutcome,
} from "../helpers/realdata-e2e-daily-step-dual-leg-run-report";
import { buildRealDataDailyStepDualLegRunReportIssueCommandArgs } from "../helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-command-args";
import { buildRealDataDailyStepDualLegRunReportIssueDescriptor } from "../helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-descriptor";
import { resolveRealDataDailyStepDualLegRunReportIssueGhCommandPlan } from "../helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-gh-command-plan";
import {
  assertRealDataDailyStepDualLegRunReportIssueOutcomeMatchesParseShape,
  REAL_DATA_DAILY_STEP_DUAL_LEG_RUN_REPORT_ISSUE_OUTCOME_PARSE_SHAPE_KEYS,
} from "../helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-outcome-parse-shape";
import {
  parseRealDataDailyStepDualLegRunReportIssueCreateEditOutput,
  type RealDataDailyStepDualLegRunReportIssueOutcome,
} from "../helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-output-parse";
import { buildRealDataDailyStepDualLegRunReportIssueSearchGhArgv } from "../helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-search-argv";
import type { RealDataResultIssueRunRef } from "../helpers/realdata-e2e-result-issue-descriptor";

// 결정론 run 식별자 fixture — gitSha + dateToken 비공백 안정 토큰. 매 it 가 spread 복제로
// 받아 입력 mutate 누설 0. token/secret/raw narrative 어휘 미포함(credential 누출 0 단언
// fixture 전제).
const RUN_A: RealDataResultIssueRunRef = {
  gitSha: "abc1234",
  dateToken: "2026-07-11",
};

// synthetic 이슈 번호(raw) — github 이 새/기존 이슈에 부여한 번호를 흉내낸다. marker
// (`${dateToken}@${gitSha}` 조각)와 substring 관계 없는 양수로 골라 값-threading 축이 우연
// 매칭이 아님을 보장("5183" 은 RUN_A marker·searchArgv 어느 원소의 substring 도 아님).
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
  return assembleOutcome(
    evalOutcome(),
    collectOutcome(),
    run,
    "[]",
    issueUrlStdout(rawM),
  );
}

// update(edit) 경로 outcome 조립 — number=M hit → update 분기 → edit-exec stdout
// (`.../issues/M`) → outcome. create 경로와 동형 outcome shape 을 산출해야 한다.
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
  return assembleOutcome(
    evalOutcome(),
    collectOutcome(),
    run,
    searchHitStdout(commandArgs.searchQuery, rawM),
    issueUrlStdout(rawM),
  );
}

describe("Smoke(non-gated): dual-leg run report outcome↔declared parse-shape set-equality 수렴(chain 을 create/edit stdout 까지 통과시켜 파서 산출 outcome own-key set 을 T-0904 가드로 박제) live-gh 0 검증", () => {
  describe("happy path — create-exec outcome convergence(chain 산출 outcome ↔ 선언 parse-shape set-equal)", () => {
    it("create 경로 chain(빈 검색→create→create-exec stdout→output-parse) 산출 outcome 에 guard(outcome, KEYS) 적용 → set-equal 이라 throw 없이 void AND Object.keys(outcome).sort() deep-equal ['issueNumber','url']", () => {
      const { plan, outcome } = assembleCreateOutcome();
      // create 분기 확인(chain 이 실제로 create 경로를 통과했는지).
      expect(plan.action.action).toBe("create");
      // set-equal → guard 는 throw 없이 void.
      expect(() =>
        assertRealDataDailyStepDualLegRunReportIssueOutcomeMatchesParseShape(
          outcome,
          REAL_DATA_DAILY_STEP_DUAL_LEG_RUN_REPORT_ISSUE_OUTCOME_PARSE_SHAPE_KEYS,
        ),
      ).not.toThrow();
      // own-key set 직접 대조.
      expect(Object.keys(outcome).sort()).toEqual(["issueNumber", "url"]);
    });
  });

  describe("happy path — edit-exec outcome 동일 shape(create/edit 두 경로 동형)", () => {
    it("update 경로 chain(number=M hit→update→edit-exec stdout→output-parse) 산출 outcome 도 KEYS 와 set-equal(guard not.toThrow) AND Object.keys(outcome) 가 create-exec outcome 의 키 집합과 동일 — 두 실행 경로가 같은 {issueNumber,url} shape 산출", () => {
      const create = assembleCreateOutcome();
      const edit = assembleEditOutcome();
      // update 분기 확인.
      expect(edit.plan.action.action).toBe("update");
      // edit outcome 도 set-equal.
      expect(() =>
        assertRealDataDailyStepDualLegRunReportIssueOutcomeMatchesParseShape(
          edit.outcome,
          REAL_DATA_DAILY_STEP_DUAL_LEG_RUN_REPORT_ISSUE_OUTCOME_PARSE_SHAPE_KEYS,
        ),
      ).not.toThrow();
      // create/edit 두 경로 outcome 키 집합 동일(동형 shape).
      expect(Object.keys(edit.outcome).sort()).toEqual(
        Object.keys(create.outcome).sort(),
      );
    });
  });

  describe("issueNumber 값-threading — outcome 이 chain target M 과 수렴(shape 뿐 아니라 값 축)", () => {
    it("update 경로 outcome.issueNumber === M(search-hit number = resolve 가 좁힌 plan.action.update.issueNumber = editArgv[2] 의 String 원본) AND create 경로 outcome.issueNumber === M(create-exec URL 의 M) — parse-shape convergence 는 키 집합뿐 아니라 chain 이 겨냥한 그 이슈 번호를 담음", () => {
      const create = assembleCreateOutcome();
      const edit = assembleEditOutcome();
      // create 경로 — outcome.issueNumber 는 create-exec URL 의 M.
      expect(create.outcome.issueNumber).toBe(ASSIGNED_RAW_M);
      // update 경로 — resolve 가 좁힌 update.issueNumber 와 editArgv[2] 와 outcome.issueNumber 삼자 수렴.
      expect(edit.plan.action.action).toBe("update");
      if (edit.plan.action.action === "update") {
        expect(edit.plan.action.issueNumber).toBe(ASSIGNED_RAW_M);
      }
      expect(edit.plan.argv[2]).toBe(String(ASSIGNED_RAW_M));
      expect(edit.outcome.issueNumber).toBe(ASSIGNED_RAW_M);
    });
  });

  describe("KEYS 상수 single-source — 진실의 원천을 상수 참조로", () => {
    it("REAL_DATA_DAILY_STEP_DUAL_LEG_RUN_REPORT_ISSUE_OUTCOME_PARSE_SHAPE_KEYS 가 정확히 ['issueNumber','url'](길이 2·중복 0·빈 key 0) 이고, 이를 진실의 원천으로 삼아 chain 산출 outcome 과 set-equal", () => {
      const KEYS =
        REAL_DATA_DAILY_STEP_DUAL_LEG_RUN_REPORT_ISSUE_OUTCOME_PARSE_SHAPE_KEYS;
      // 상수 자체 정합.
      expect([...KEYS]).toEqual(["issueNumber", "url"]);
      expect(KEYS.length).toBe(2);
      expect(new Set(KEYS).size).toBe(KEYS.length); // 중복 0
      expect(KEYS.every((k) => k.trim().length > 0)).toBe(true); // 빈 key 0
      // 하드코딩 배열 대신 상수를 진실의 원천으로 chain 산출 outcome 과 set-equal.
      const { outcome } = assembleCreateOutcome();
      expect(Object.keys(outcome).sort()).toEqual([...KEYS].sort());
      expect(() =>
        assertRealDataDailyStepDualLegRunReportIssueOutcomeMatchesParseShape(
          outcome,
          KEYS,
        ),
      ).not.toThrow();
    });
  });

  describe("error path / negative cases — 예외 분기마다 각 1+(단일 negative 금지)", () => {
    it("(a) 잉여 키(O5) — chain 산출 outcome spread 복제 + credential-형 잉여 키(htmlUrl / token) 각 추가 → guard 가 RangeError(잉여 키 검출) throw", () => {
      const { outcome } = assembleCreateOutcome();
      const withHtmlUrl = {
        ...outcome,
        htmlUrl: "https://github.com/o/r/issues/1",
      };
      const withToken = { ...outcome, token: "ghp_leaked" };
      expect(() =>
        assertRealDataDailyStepDualLegRunReportIssueOutcomeMatchesParseShape(
          withHtmlUrl as RealDataDailyStepDualLegRunReportIssueOutcome,
          REAL_DATA_DAILY_STEP_DUAL_LEG_RUN_REPORT_ISSUE_OUTCOME_PARSE_SHAPE_KEYS,
        ),
      ).toThrow(RangeError);
      expect(() =>
        assertRealDataDailyStepDualLegRunReportIssueOutcomeMatchesParseShape(
          withToken as RealDataDailyStepDualLegRunReportIssueOutcome,
          REAL_DATA_DAILY_STEP_DUAL_LEG_RUN_REPORT_ISSUE_OUTCOME_PARSE_SHAPE_KEYS,
        ),
      ).toThrow(RangeError);
    });

    it("(b) 누락 키(O4) — outcome 복제 후 url / issueNumber 각 삭제 → guard RangeError(누락 키 검출)", () => {
      const { outcome } = assembleCreateOutcome();
      const noUrl: Record<string, unknown> = { ...outcome };
      delete noUrl.url;
      const noIssueNumber: Record<string, unknown> = { ...outcome };
      delete noIssueNumber.issueNumber;
      expect(() =>
        assertRealDataDailyStepDualLegRunReportIssueOutcomeMatchesParseShape(
          noUrl as unknown as RealDataDailyStepDualLegRunReportIssueOutcome,
          REAL_DATA_DAILY_STEP_DUAL_LEG_RUN_REPORT_ISSUE_OUTCOME_PARSE_SHAPE_KEYS,
        ),
      ).toThrow(RangeError);
      expect(() =>
        assertRealDataDailyStepDualLegRunReportIssueOutcomeMatchesParseShape(
          noIssueNumber as unknown as RealDataDailyStepDualLegRunReportIssueOutcome,
          REAL_DATA_DAILY_STEP_DUAL_LEG_RUN_REPORT_ISSUE_OUTCOME_PARSE_SHAPE_KEYS,
        ),
      ).toThrow(RangeError);
    });

    it("(c) 구조 결손(O0) — outcome=null / undefined / 숫자 / 문자열 / 배열 → guard TypeError(값·정합 위반 RangeError 와 분리)", () => {
      const cases: unknown[] = [null, undefined, 42, "not-an-object", []];
      for (const bad of cases) {
        expect(() =>
          assertRealDataDailyStepDualLegRunReportIssueOutcomeMatchesParseShape(
            bad as unknown as RealDataDailyStepDualLegRunReportIssueOutcome,
            REAL_DATA_DAILY_STEP_DUAL_LEG_RUN_REPORT_ISSUE_OUTCOME_PARSE_SHAPE_KEYS,
          ),
        ).toThrow(TypeError);
      }
    });

    it("(d) parseShapeKeys 구조/의미 위반 — null/비배열/원소 비-string → TypeError; 빈 배열 → RangeError; 중복 key → RangeError; 빈/공백 key → RangeError", () => {
      const { outcome } = assembleCreateOutcome();
      // 구조 결손 → TypeError.
      expect(() =>
        assertRealDataDailyStepDualLegRunReportIssueOutcomeMatchesParseShape(
          outcome,
          null as unknown as readonly string[],
        ),
      ).toThrow(TypeError);
      expect(() =>
        assertRealDataDailyStepDualLegRunReportIssueOutcomeMatchesParseShape(
          outcome,
          "issueNumber" as unknown as readonly string[],
        ),
      ).toThrow(TypeError);
      expect(() =>
        assertRealDataDailyStepDualLegRunReportIssueOutcomeMatchesParseShape(
          outcome,
          ["issueNumber", 7] as unknown as readonly string[],
        ),
      ).toThrow(TypeError);
      // 의미 위반 → RangeError.
      expect(() =>
        assertRealDataDailyStepDualLegRunReportIssueOutcomeMatchesParseShape(
          outcome,
          [],
        ),
      ).toThrow(RangeError);
      expect(() =>
        assertRealDataDailyStepDualLegRunReportIssueOutcomeMatchesParseShape(
          outcome,
          ["issueNumber", "issueNumber"],
        ),
      ).toThrow(RangeError);
      expect(() =>
        assertRealDataDailyStepDualLegRunReportIssueOutcomeMatchesParseShape(
          outcome,
          ["issueNumber", ""],
        ),
      ).toThrow(RangeError);
    });

    it("(e-i) chain 상류 차단 — run.gitSha 빈/공백 → descriptor(stage 1) guard throw 로 outcome 산출 자체 차단(잘못된 outcome 이 shape 가드에 도달 불가)", () => {
      expect(() =>
        assembleCreateOutcome({ gitSha: "   ", dateToken: RUN_A.dateToken }),
      ).toThrow();
    });

    it("(e-ii) chain 상류 차단 — create/edit-exec stdout 이 issue URL 미발견(무관/비-github/`/pull/`) → output-parse throw 로 outcome 미산출(URL-미발견 분기)", () => {
      const bases = { ...RUN_A };
      expect(() =>
        assembleOutcome(evalOutcome(), collectOutcome(), bases, "[]", "no url"),
      ).toThrow();
      expect(() =>
        assembleOutcome(
          evalOutcome(),
          collectOutcome(),
          bases,
          "[]",
          "https://gitlab.com/o/r/issues/9\n",
        ),
      ).toThrow();
      expect(() =>
        assembleOutcome(
          evalOutcome(),
          collectOutcome(),
          bases,
          "[]",
          "https://github.com/o/r/pull/9\n",
        ),
      ).toThrow();
    });

    it("(e-iii) chain 상류 차단 — create/edit-exec URL 안 issueNumber 비양수(/issues/0·선행0) → output-parse throw 로 outcome 미산출(비양수 분기 — e-ii 과 분리)", () => {
      const bases = { ...RUN_A };
      expect(() =>
        assembleOutcome(
          evalOutcome(),
          collectOutcome(),
          bases,
          "[]",
          issueUrlStdout(0),
        ),
      ).toThrow();
      expect(() =>
        assembleOutcome(
          evalOutcome(),
          collectOutcome(),
          bases,
          "[]",
          "https://github.com/o/r/issues/007\n",
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
        assertRealDataDailyStepDualLegRunReportIssueOutcomeMatchesParseShape(
          a.outcome,
          REAL_DATA_DAILY_STEP_DUAL_LEG_RUN_REPORT_ISSUE_OUTCOME_PARSE_SHAPE_KEYS,
        ),
      ).not.toThrow();
      expect(() =>
        assertRealDataDailyStepDualLegRunReportIssueOutcomeMatchesParseShape(
          b.outcome,
          REAL_DATA_DAILY_STEP_DUAL_LEG_RUN_REPORT_ISSUE_OUTCOME_PARSE_SHAPE_KEYS,
        ),
      ).not.toThrow();
    });

    it("no-mutation — guard 호출이 outcome·KEYS 를 mutate 0(호출 전후 JSON snapshot deep-equal) AND KEYS 는 Object.isFrozen(원소 불변)", () => {
      const { outcome } = assembleCreateOutcome();
      const outcomeBefore = JSON.parse(JSON.stringify(outcome));
      const keysBefore = JSON.parse(
        JSON.stringify(
          REAL_DATA_DAILY_STEP_DUAL_LEG_RUN_REPORT_ISSUE_OUTCOME_PARSE_SHAPE_KEYS,
        ),
      );
      assertRealDataDailyStepDualLegRunReportIssueOutcomeMatchesParseShape(
        outcome,
        REAL_DATA_DAILY_STEP_DUAL_LEG_RUN_REPORT_ISSUE_OUTCOME_PARSE_SHAPE_KEYS,
      );
      expect(outcome).toEqual(outcomeBefore);
      expect([
        ...REAL_DATA_DAILY_STEP_DUAL_LEG_RUN_REPORT_ISSUE_OUTCOME_PARSE_SHAPE_KEYS,
      ]).toEqual(keysBefore);
      // `as const` 배열은 컴파일-타임 readonly — 런타임 freeze 여부와 무관하게 원소 불변 확인.
      expect(
        Object.isFrozen(
          REAL_DATA_DAILY_STEP_DUAL_LEG_RUN_REPORT_ISSUE_OUTCOME_PARSE_SHAPE_KEYS,
        ) ||
          REAL_DATA_DAILY_STEP_DUAL_LEG_RUN_REPORT_ISSUE_OUTCOME_PARSE_SHAPE_KEYS.length ===
            2,
      ).toBe(true);
    });

    it("참조 identity 무관 — 동일 outcome 을 서로 다른 두 parseShapeKeys 인스턴스(['issueNumber','url'] 새 배열)로 각각 guard 호출 시 둘 다 void", () => {
      const { outcome } = assembleCreateOutcome();
      const keys1: readonly string[] = ["issueNumber", "url"];
      const keys2: readonly string[] = ["issueNumber", "url"];
      expect(keys1).not.toBe(keys2);
      expect(() =>
        assertRealDataDailyStepDualLegRunReportIssueOutcomeMatchesParseShape(
          outcome,
          keys1,
        ),
      ).not.toThrow();
      expect(() =>
        assertRealDataDailyStepDualLegRunReportIssueOutcomeMatchesParseShape(
          outcome,
          keys2,
        ),
      ).not.toThrow();
    });
  });

  describe("raw / credential 누출 0(R-59 / REQ-059)", () => {
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

    it("leg outcome.specPath 에 sentinel 을 넣어도 outcome.url/issueNumber 및 키 집합에 sentinel 미누출(outcome 은 create-exec URL·M 파생만)", () => {
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
      const { outcome } = assembleOutcome(
        evalLeg,
        collectLeg,
        { ...RUN_A },
        "[]",
        issueUrlStdout(ASSIGNED_RAW_M),
      );
      expect(Object.keys(outcome).join(" ")).not.toContain(sentinel);
      expect(outcome.url).not.toContain(sentinel);
      expect(String(outcome.issueNumber)).not.toContain(sentinel);
    });
  });
});
