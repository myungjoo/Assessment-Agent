// realdata-e2e-daily-step-dual-leg-run-report-publish-live.smoke-spec.ts —
// 실 평가 e2e daily-step dual-leg run report rolling-issue publish leg 의 **실 `gh`
// 실행-후(execute-side) round-trip** env-gated skip-by-default live smoke
// (T-0941, PLAN.md 109행 🟢 실 평가 e2e step ④).
//
// 목적: 지금까지 dual-leg run report 축의 command-plan(search argv → create/edit argv,
// output-parse, 멱등 재발견-재정규화)은 35 개 in-memory assembly smoke 로 남김없이
// 자산화됐으나, 그 argv 를 **실제 `gh` 에 도달시켜 실행-후 stdout 을 되받아 파싱한 적이
// 한 번도 없다**. 즉 `parseRealDataDailyStepDualLegRunReportIssueCreateEditOutput` 는
// 오직 합성 URL literal 로만 검증됐다. 본 smoke 는 그 live execute-side round-trip seam
// 을 닫는다 — 조립만 하던 command-plan 을 처음으로 실 `gh issue list/create/edit` 에
// 도달시켜 (a) 실 gh stdout 을 output-parse 가 round-trip 하고 (b) 같은 run 을 두 번
// publish 할 때 1차 create·2차 edit 로 멱등하게 같은 rolling-issue(번호/url
// byte-identical)로 수렴함을 실증한다. 축은 in-memory assembly 가 아니라 **실 gh
// 실행-후 publish round-trip + 멱등 수렴** — assembly smoke #36 이 아니다.
//
// dormant env-gated skip-by-default: 본 live suite 는 realdata-e2e 전용 gating env
// (REALDATA_E2E_* 7 종)가 *모두* set 된 경우에만 활성화된다. 판정은
// test/helpers/realdata-e2e-live-gating.ts 의 순수 helper resolveRealDataE2eLiveGating
// 에 위임하고, enabled 가 false 면 describe.skip 으로 전 suite 가 skip 된다 → public CI
// 는 gating env 부재라 항상 skip → 실 gh 실행 0 / github mutation 0 / 실 네트워크 0 /
// secret 0 으로 green 유지(R-113). gating 활성(ops nightly) 시에만 실 gh 1 round-trip
// (search→create/edit) + output-parse round-trip + 멱등 수렴이 실행된다.
//
// collection-live / eval-live 와의 관계: eval leg(T-0610 realdata-e2e-live.smoke-spec.ts)
// 는 실 Ollama round-trip 을, collect leg(T-0806 realdata-e2e-github-collection-live)는
// 실 github GET round-trip 을 각각 dormant env-gated live smoke 로 shipped 했고, 그 두
// smoke 는 각자의 daily-test.sh wiring(step_eval T-0612 / step_collect T-0888)**보다
// 먼저** dormant 로 머지됐다. publish leg 인 본 task 도 같은 순서다 — live spec 선행,
// step_report wiring 은 Follow-up. 단 collect/eval 은 read round-trip(GET/generate)이고
// 본 task 는 **write round-trip(실 `gh issue create|edit` execFile)** 이라 execution
// 수단·멱등(재발견 후 edit) 축이 다르다. 구조·gating·격리 규약만 mirror.
//
// step_report wiring 은 ADR-0045 deferred Follow-up: 본 dormant live spec 이 결국 호출될
// `step_report` 의 `deploy/daily-test.sh` 배선(production nightly 실행 + 실 credential
// 주입)은 ADR-0045 credential gate 로 deferred 되어 **본 task 밖**이다. 본 task 는 그
// wiring 이 호출할 test-side 실 publish 스캐폴딩을 dormant 로 박제할 뿐 — 아무 것도
// activate 하지 않는다.
//
// 안전·격리(CLAUDE.md §9 / R-59 / REQ-059): 실 credential 값(gh 토큰/PAT)을 본 파일
// 어디에도 적지 않는다 — `gh` CLI 의 ambient auth(환경 상속)만 사용한다. 실 gh 응답의
// 비결정 본문(생성 시각·서버 부여 필드 등)은 assert 하지 않고 구조적 invariant
// (issueNumber 양수·url↔issueNumber 정합·멱등 수렴)만 assert 한다. raw 외부 응답을
// 파일/전역 변수로 보관하지 않는다(R-59). command-plan 조립 chain 의 내부 정합은 35 개
// assembly smoke 가 이미 봉했으므로 재단언하지 않고 import·호출·실 gh 도달·실 stdout
// round-trip 에만 쓴다. 새 외부 dependency 0(Node 내장 child_process·기존 `gh`·기존
// 헬퍼만).
import { execFile, execSync } from "node:child_process";
import { promisify } from "node:util";

import { buildRealDataDailyStepDualLegRunReport } from "../helpers/realdata-e2e-daily-step-dual-leg-run-report";
import { buildRealDataDailyStepDualLegRunReportIssueCommandArgs } from "../helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-command-args";
import type { RealDataDailyStepDualLegRunReportIssueCommandArgs } from "../helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-command-args";
import { buildRealDataDailyStepDualLegRunReportIssueDescriptor } from "../helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-descriptor";
import type { RealDataDailyStepDualLegRunReportIssueDescriptor } from "../helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-descriptor";
import {
  resolveRealDataDailyStepDualLegRunReportIssueGhCommandPlan,
  type RealDataDailyStepDualLegRunReportIssueGhCommandPlan,
} from "../helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-gh-command-plan";
import { parseRealDataDailyStepDualLegRunReportIssueCreateEditOutput } from "../helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-output-parse";
import { buildRealDataDailyStepDualLegRunReportIssueSearchGhArgv } from "../helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-search-argv";
import { resolveRealDataE2eLiveGating } from "../helpers/realdata-e2e-live-gating";
import type { RealDataResultIssueRunRef } from "../helpers/realdata-e2e-result-issue-descriptor";

// gating 판정 — process.env 를 순수 helper 로 평가(realdata-e2e 7 종 완전성). enabled 가
// describe 분기 입력. unit 검증은 realdata-e2e-live-gating.spec.ts 소관.
const gating = resolveRealDataE2eLiveGating(process.env);
// gating env 부재(= public CI 기본 조건) 시 describe.skip → 전 it skip → 실 gh 실행 0 /
// github mutation 0 / CI green. process.env 는 이 gating 판정 외 직접 읽지 않는다.
const describeLive = gating.enabled ? describe : describe.skip;

// credential 누출 정규식 — 조립된 argv/descriptor/outcome 어디에도 gh 토큰/PAT 어휘가
// 등장하면 안 된다(§9 / R-59 / REQ-059). ghp_ prefix·--token flag·GITHUB_TOKEN·
// GITHUB_READ_PAT·Authorization 헤더 어휘를 case-insensitive 로 탐지한다.
const CREDENTIAL_LEAK_PATTERN =
  /ghp_|--token|GITHUB_TOKEN|GITHUB_READ_PAT|Authorization/i;

// buildPublishAssembly — 실 run 식별자로부터 report→descriptor→commandArgs→search argv
// 를 결정론적으로 조립한다(command-plan chain 재단언 0 — import·호출만). 대표 두 leg
// outcome 은 all-pass(eval run→pass + collect run→pass)로 고정 — 본 smoke 축은 leg
// status 파생이 아니라 publish round-trip 이므로 status 값은 임의 대표값이면 충분하다.
function buildPublishAssembly(run: RealDataResultIssueRunRef): {
  descriptor: RealDataDailyStepDualLegRunReportIssueDescriptor;
  commandArgs: RealDataDailyStepDualLegRunReportIssueCommandArgs;
  searchArgv: string[];
} {
  const report = buildRealDataDailyStepDualLegRunReport(
    { leg: "eval", action: "run", passed: true },
    { leg: "collect", action: "run", passed: true },
    run,
  );
  const descriptor =
    buildRealDataDailyStepDualLegRunReportIssueDescriptor(report);
  const commandArgs =
    buildRealDataDailyStepDualLegRunReportIssueCommandArgs(descriptor);
  const searchArgv =
    buildRealDataDailyStepDualLegRunReportIssueSearchGhArgv(commandArgs);
  return { descriptor, commandArgs, searchArgv };
}

// ── non-gated: 순수 파서 negative + gating skip 판정 + credential 누출 0 ────────────
// gating 부재 시에도 실행 가능한 것은 순수 파서 negative(손상 stdout literal)·gating
// skip 판정·조립 argv 의 credential 누출 확인뿐이다. 이 describe 는 실 gh 호출/네트워크/
// mutation 을 일절 하지 않는다(Out of Scope 정합).
describe("Smoke: dual-leg run report publish output-parse / gating negative (non-gated)", () => {
  it("negative(b): 예상 URL 형태가 아닌 손상 stdout → output-parse 가 throw(url 미발견 상류 차단)", () => {
    // 빈 문자열·무관 텍스트·비-issue 경로(/pull/)·비-github 호스트는 모두 issue URL
    // 패턴에 매칭되지 않아 파서가 조용한 성공-위장 없이 throw 해야 한다.
    expect(() =>
      parseRealDataDailyStepDualLegRunReportIssueCreateEditOutput(""),
    ).toThrow();
    expect(() =>
      parseRealDataDailyStepDualLegRunReportIssueCreateEditOutput(
        "이슈 URL 이 아닌 임의 텍스트",
      ),
    ).toThrow();
    expect(() =>
      parseRealDataDailyStepDualLegRunReportIssueCreateEditOutput(
        "https://github.com/owner/repo/pull/5",
      ),
    ).toThrow();
  });

  it("negative(c): gating env 불완전(7 종 중 일부 결여) → enabled=false → describeLive=describe.skip", () => {
    // enable flag 만 있고 나머지 6 종이 결여된 부분-set env → gating 이 조용히
    // enabled=false 로 판정(활성 안 됨). describe 분기가 describe.skip 으로 좁혀짐을
    // gating 판정 수준에서 최소 확인(gating helper 자체 unit 은 별도 spec 소관).
    const partialEnv = {
      REALDATA_E2E_LIVE_TEST: "1",
    } as unknown as NodeJS.ProcessEnv;
    const partialGating = resolveRealDataE2eLiveGating(partialEnv);
    expect(partialGating.enabled).toBe(false);
    const branch = partialGating.enabled ? describe : describe.skip;
    expect(branch).toBe(describe.skip);
  });

  it("credential 누출 0: 조립된 search argv·create/edit plan argv·descriptor/commandArgs 에 토큰 어휘 미등장", () => {
    // 합성 run 식별자(실 git 미접근 — non-gated 순수 조립)로 chain 을 조립한 뒤,
    // search argv·양 분기 plan argv·descriptor/commandArgs 문자열 어디에도 gh 토큰
    // 어휘가 없음을 확인한다(§9 / R-59 / REQ-059). create/edit 양 분기 plan argv 는
    // 합성 search stdout("[]" → create, marker 매칭 hit → edit)으로 순수 산출한다.
    const run: RealDataResultIssueRunRef = {
      gitSha: "abc1234",
      dateToken: "2026-07-13",
    };
    const { descriptor, commandArgs, searchArgv } = buildPublishAssembly(run);

    // 미매칭 → create 분기 plan(argv[1]="create").
    const createPlan =
      resolveRealDataDailyStepDualLegRunReportIssueGhCommandPlan(
        "[]",
        commandArgs,
      );
    // marker 매칭 hit → edit 분기 plan(argv[1]="edit").
    const editPlan = resolveRealDataDailyStepDualLegRunReportIssueGhCommandPlan(
      JSON.stringify([
        { number: 7, title: descriptor.title, body: descriptor.body },
      ]),
      commandArgs,
    );

    expect(createPlan.action.action).toBe("create");
    expect(createPlan.argv[1]).toBe("create");
    expect(editPlan.action.action).toBe("update");
    expect(editPlan.argv[1]).toBe("edit");

    // 조립 산출물 전체를 한 haystack 으로 묶어 토큰 어휘 미등장을 정규식으로 확인.
    const haystack = [
      ...searchArgv,
      ...createPlan.argv,
      ...editPlan.argv,
      descriptor.title,
      descriptor.marker,
      descriptor.body,
      commandArgs.searchQuery,
    ].join("\n");
    expect(CREDENTIAL_LEAK_PATTERN.test(haystack)).toBe(false);
  });
});

// ── gated live: 실 gh 실행-후 publish round-trip + 멱등 수렴 ─────────────────────────
describeLive(
  "Smoke(live): 실 평가 e2e dual-leg run report rolling-issue publish 실 gh round-trip + 멱등 수렴",
  () => {
    // live gh 실행 hang 위험 대비 — jest 기본보다 넉넉한 상한(collection-live 동형).
    // gating skip 시 미발화.
    jest.setTimeout(120000);

    const execFileAsync = promisify(execFile);

    // 실 gh execFile — `gh` 실행 파일명과 argv 를 분리 전달(shell 미경유, 인젝션 불가).
    // credential 값은 코드에 기재 0 — gh 의 ambient auth(환경 상속)만 사용한다(§9). 실
    // stdout 을 그대로 반환하되 파일/전역 변수로 보관하지 않는다(R-59).
    async function runGh(argv: string[]): Promise<string> {
      const { stdout } = await execFileAsync("gh", argv, {
        encoding: "utf8",
        maxBuffer: 16 * 1024 * 1024,
      });
      return stdout;
    }

    // 실 run 식별자 — gitSha 는 실 git short HEAD, dateToken 은 오늘 KST date. 같은
    // suite 안의 모든 test 가 동일 값을 산출하므로(결정론) 같은 rolling-issue 를 대상으로
    // 한다(멱등 재발견). credential 값은 담지 않는다.
    function liveRun(): RealDataResultIssueRunRef {
      const gitSha = execSync("git rev-parse --short HEAD", {
        encoding: "utf8",
      }).trim();
      const dateToken = new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Seoul",
      }).format(new Date());
      return { gitSha, dateToken };
    }

    // publishOnce — 실 gh 를 통해 search→(create|edit) 1 round-trip 을 실행하고 실 stdout
    // 을 output-parse 로 해석한다. 반환은 파싱된 outcome + 실행된 plan(분기 확인용).
    async function publishOnce(run: RealDataResultIssueRunRef): Promise<{
      outcome: ReturnType<
        typeof parseRealDataDailyStepDualLegRunReportIssueCreateEditOutput
      >;
      plan: RealDataDailyStepDualLegRunReportIssueGhCommandPlan;
    }> {
      const { searchArgv, commandArgs } = buildPublishAssembly(run);
      // (1) 실 gh 로 기존 이슈 search — 실 searchStdout.
      const searchStdout = await runGh(searchArgv);
      // (2) search stdout + commandArgs → create/edit plan(순수 chain, 재단언 0).
      const plan = resolveRealDataDailyStepDualLegRunReportIssueGhCommandPlan(
        searchStdout,
        commandArgs,
      );
      // (3) 실 gh 로 create 또는 edit 실 실행 — 실 execStdout.
      const execStdout = await runGh(plan.argv);
      // (4) 실 gh stdout → output-parse round-trip.
      const outcome =
        parseRealDataDailyStepDualLegRunReportIssueCreateEditOutput(execStdout);
      return { outcome, plan };
    }

    it("happy: 실 gh search→create/edit round-trip 후 실 stdout 을 output-parse 가 outcome 으로 해석한다", async () => {
      const run = liveRun();
      const { outcome, plan } = await publishOnce(run);

      // 구조적 invariant 만 assert(비결정 본문 미-assert, R-59) — issueNumber 양수·url 이
      // /issues/${issueNumber} 로 끝남(실 gh stdout round-trip 성립).
      expect(Number.isInteger(outcome.issueNumber)).toBe(true);
      expect(outcome.issueNumber).toBeGreaterThan(0);
      expect(outcome.url.endsWith(`/issues/${outcome.issueNumber}`)).toBe(true);
      // 1차는 create(신규) 또는 기존 rolling-issue 존재 시 edit — 둘 중 실제 도달한 분기.
      expect(["create", "update"]).toContain(plan.action.action);
      // outcome.url 에 credential 어휘 미등장(§9 / REQ-059).
      expect(CREDENTIAL_LEAK_PATTERN.test(outcome.url)).toBe(false);
    });

    it("멱등: 같은 run 을 연속 2 회 publish → 같은 issueNumber/url 로 수렴하고 2 차는 edit(중복 이슈 0)", async () => {
      const run = liveRun();
      // 1 차 publish — create(최초) 또는 기존 rolling-issue edit.
      const first = await publishOnce(run);
      // 2 차 publish — 1 차가 만든/갱신한 이슈를 search 로 재발견해 edit 로 수렴.
      const second = await publishOnce(run);

      // 멱등 수렴 — 중복 이슈 생성 0(같은 issueNumber), url byte-identical.
      expect(second.outcome.issueNumber).toBe(first.outcome.issueNumber);
      expect(second.outcome.url).toBe(first.outcome.url);
      // 2 차는 반드시 재발견 후 edit(update) 분기로 좁혀진다(argv[1]="edit").
      expect(second.plan.action.action).toBe("update");
      expect(second.plan.argv[1]).toBe("edit");
    });

    it("branch: search 미매칭→create(argv[1]=create), 매칭→edit(argv[1]=edit) 로 dispatch 됨을 실 gh 흐름에서 확인", async () => {
      const run = liveRun();
      // 1 차 실행 전 상태에 따라 create 또는 edit 중 하나에 도달(둘 다 강제 불가).
      const first = await publishOnce(run);
      expect(first.plan.argv[1]).toBe(
        first.plan.action.action === "create" ? "create" : "edit",
      );
      // 2 차는 반드시 edit 분기 — 두 분기 중 최소 edit 수렴은 필수 도달.
      const second = await publishOnce(run);
      expect(second.plan.action.action).toBe("update");
      expect(second.plan.argv[1]).toBe("edit");
    });

    it("negative(a): 손상 argv(비존재 서브커맨드)로 실 gh 실행 시 non-zero exit → reject(조용한 성공-위장 0)", async () => {
      // 실 mutation 전 안전 경로 — 존재하지 않는 gh 서브커맨드 argv 를 주입하면 gh 가
      // non-zero exit 하고 execFile 이 reject 되어 조용히 성공으로 위장되지 않는다.
      await expect(
        runGh(["issue", "this-subcommand-does-not-exist-xyz"]),
      ).rejects.toBeDefined();
    });
  },
);
