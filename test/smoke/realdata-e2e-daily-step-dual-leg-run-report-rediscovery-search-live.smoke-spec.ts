// realdata-e2e-daily-step-dual-leg-run-report-rediscovery-search-live.smoke-spec.ts —
// 실 평가 e2e daily-step dual-leg run report rolling-issue 의 **재발견(re-discovery)
// 검색** 을 실 `gh search issues`(read-only, mutation 0)로 1 회 round-trip 하는
// env-gated skip-by-default live smoke (T-0942, PLAN.md 109행 🟢 실 평가 e2e step ④).
//
// 목적: publish-live(T-0941)가 step④ 의 **write-side(create/edit) round-trip + 멱등
// 수렴** 을 봉했다 — 실 `gh issue create|edit` 실행-후 stdout 을 output-parse 가
// round-trip 하고 같은 run 을 두 번 publish 하면 같은 rolling-issue 로 멱등 수렴함을
// 실증했다. 그러나 그 멱등의 **전제(prerequisite)** 인 **재발견 검색** — 다음 밤 같은
// run 의 기존 이슈를 `gh search issues` 로 되찾아 create/edit 를 가르는 read-side
// round-trip — 은 T-0941 안에서 idempotency 의 부수 결과로만 실행됐을 뿐, 실
// `gh search` 의 argv 수용성·실 `--json` 출력 schema round-trip·실 github 상태로부터의
// 재발견 결정을 그 자체 축으로 assert 한 spec 이 0 개였다. 즉
// `buildRealDataDailyStepDualLegRunReportIssueSearchGhArgv`(search argv) +
// `parseRealDataDailyStepDualLegRunReportIssueSearchOutput`(search stdout 파서)는
// 지금까지 **오직 합성 stdout literal 로만** 검증됐다. 본 smoke 는 그 live read-side
// round-trip seam 을 닫는다 — 조립만 하던 search chain 을 처음으로 실 `gh search issues`
// (**순수 read, mutation 0**)에 도달시켜 (a) 실 gh 가 그 argv 를 accept 해 valid JSON 을
// 산출하고 (b) 파서가 그 실 stdout 을 round-trip 하며 (c) fresh run 식별자(오늘 KST
// dateToken@실 git short HEAD)의 marker 는 아직 github 에 없어 빈 배열(`[]`) →
// `resolve...GhCommandPlan` 이 `plan.action==="create"`(재발견 미매칭 → 신규)로
// 결정론적으로 수렴함을 실증한다. 축은 T-0941 의 write(create/edit) 가 아니라
// **read(재발견 검색) round-trip + fresh-marker create 결정** 이다.
//
// dormant env-gated skip-by-default: 본 live suite 는 realdata-e2e 전용 gating env
// (REALDATA_E2E_* 7 종)가 *모두* set 된 경우에만 활성화된다. 판정은
// test/helpers/realdata-e2e-live-gating.ts 의 순수 helper resolveRealDataE2eLiveGating
// 에 위임하고, enabled 가 false 면 describe.skip 으로 전 suite 가 skip 된다 → public CI
// 는 gating env 부재라 항상 skip → 실 gh 실행 0 / github mutation 0(애초에 read-only) /
// 실 네트워크 0 / secret 0 으로 green 유지(R-113). gating 활성(ops nightly) 시에만 실 gh
// 1 round-trip(search) + output-parse round-trip + fresh-marker create 결정이 실행된다.
//
// publish-live(T-0941)/collection-live(T-0806) 와의 관계: eval leg(T-0610)은 실 Ollama
// round-trip 을, collect leg(T-0806)는 실 github GET round-trip 을, publish leg(T-0941)
// 은 실 `gh issue create|edit` write round-trip 을 각각 dormant env-gated live smoke 로
// shipped 했다. 본 task 는 그 publish 멱등이 의존하는 **재발견 검색 leg** 을 실
// `gh search issues`(read-only) round-trip 으로 독립 봉합한다 — 구조·gating·격리 규약만
// mirror 하고 write(create/edit) 흐름·멱등 assert 는 재사용하지 않는다(read-only 라
// mutation 0). 또한 **mutation 0 순수 read** 라 write credential 불요(read-scope PAT /
// gh ambient read 로 충분) — T-0941(write path)이 요구하는 write scope 없이도 돌 수 있어
// 더 넓은 환경(read-only nightly, restricted credential)에서 재발견 health check 를
// 단독 실행할 수 있다.
//
// step_report wiring 은 ADR-0045 deferred Follow-up: 본 dormant live spec 이 결국 호출될
// `step_report` 의 `deploy/daily-test.sh` 배선(production nightly 실행 + 실 credential
// 주입)은 ADR-0045 credential gate 로 deferred 되어 **본 task 밖**이다. 본 task 는 그
// wiring 이 호출할 test-side 실 재발견 스캐폴딩을 dormant 로 박제할 뿐 — 아무 것도
// activate 하지 않는다.
//
// 안전·격리(CLAUDE.md §9 / R-59 / REQ-059): 실 credential 값(gh 토큰/PAT)을 본 파일
// 어디에도 적지 않는다 — `gh` CLI 의 ambient auth(환경 상속)만 사용한다. 실 gh search
// 응답의 비결정 본문(타 이슈 title/body·서버 부여 필드 등)은 assert 하지 않고 구조적
// invariant(hits 배열·원소 {number 양수, title/body string}·fresh-marker create 결정)만
// assert 한다. raw 외부 응답을 파일/전역 변수로 보관하지 않는다(R-59). command-plan 조립
// chain 의 내부 정합은 기존 assembly smoke 가 이미 봉했으므로 재단언하지 않고 import·호출·
// 실 gh 도달·실 stdout round-trip 에만 쓴다. 본 suite 는 어떤 분기에서도 write 명령
// (`gh issue create`/`gh issue edit`)을 실행하지 않는다 — 오직 `gh search issues` read.
// 새 외부 dependency 0(Node 내장 child_process·기존 `gh`·기존 헬퍼만).
import { execFile, execSync } from "node:child_process";
import { promisify } from "node:util";

import { buildRealDataDailyStepDualLegRunReport } from "../helpers/realdata-e2e-daily-step-dual-leg-run-report";
import { buildRealDataDailyStepDualLegRunReportIssueCommandArgs } from "../helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-command-args";
import type { RealDataDailyStepDualLegRunReportIssueCommandArgs } from "../helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-command-args";
import { buildRealDataDailyStepDualLegRunReportIssueDescriptor } from "../helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-descriptor";
import type { RealDataDailyStepDualLegRunReportIssueDescriptor } from "../helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-descriptor";
import { resolveRealDataDailyStepDualLegRunReportIssueGhCommandPlan } from "../helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-gh-command-plan";
import { buildRealDataDailyStepDualLegRunReportIssueSearchGhArgv } from "../helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-search-argv";
import { parseRealDataDailyStepDualLegRunReportIssueSearchOutput } from "../helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-search-parse";
import { resolveRealDataE2eLiveGating } from "../helpers/realdata-e2e-live-gating";
import type { RealDataResultIssueRunRef } from "../helpers/realdata-e2e-result-issue-descriptor";

// gating 판정 — process.env 를 순수 helper 로 평가(realdata-e2e 7 종 완전성). enabled 가
// describe 분기 입력. unit 검증은 realdata-e2e-live-gating.spec.ts 소관.
const gating = resolveRealDataE2eLiveGating(process.env);
// gating env 부재(= public CI 기본 조건) 시 describe.skip → 전 it skip → 실 gh 실행 0 /
// github mutation 0(애초에 read-only) / CI green. process.env 는 이 gating 판정 외
// 직접 읽지 않는다.
const describeLive = gating.enabled ? describe : describe.skip;

// credential 누출 정규식 — 조립된 search argv/searchQuery/hits 어디에도 gh 토큰/PAT 어휘가
// 등장하면 안 된다(§9 / R-59 / REQ-059). ghp_ prefix·--token flag·GITHUB_TOKEN·
// GITHUB_READ_PAT·Authorization 헤더 어휘를 case-insensitive 로 탐지한다.
const CREDENTIAL_LEAK_PATTERN =
  /ghp_|--token|GITHUB_TOKEN|GITHUB_READ_PAT|Authorization/i;

// buildSearchAssembly — 실 run 식별자로부터 report→descriptor→commandArgs→search argv
// 를 결정론적으로 조립한다(command-plan chain 재단언 0 — import·호출만). 대표 두 leg
// outcome 은 all-pass(eval run→pass + collect run→pass)로 고정 — 본 smoke 축은 leg
// status 파생이 아니라 재발견 검색 round-trip 이므로 status 값은 임의 대표값이면 충분하다.
function buildSearchAssembly(run: RealDataResultIssueRunRef): {
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
// mutation 을 일절 하지 않는다(Out of Scope 정합 — 순수 파서·조립만).
describe("Smoke: dual-leg run report re-discovery search parse / gating negative (non-gated)", () => {
  it("negative(b): 배열이 아닌 손상 stdout(object/비-JSON) → search-parse 가 throw(비배열 상류 차단)", () => {
    // gh `--json` 출력은 배열이어야 한다 — object literal·비-JSON 문자열은 파서가
    // 조용한 성공-위장 없이 throw 해야 한다(비배열 응답이 create/edit 분기로 새는 것 차단).
    expect(() =>
      parseRealDataDailyStepDualLegRunReportIssueSearchOutput("{}"),
    ).toThrow();
    expect(() =>
      parseRealDataDailyStepDualLegRunReportIssueSearchOutput(
        "이것은 JSON 이 아닌 임의 텍스트",
      ),
    ).toThrow();
  });

  it("negative(b'): 배열이지만 원소가 {number,title,body} 형태가 아님 → search-parse 가 throw", () => {
    // 원소가 객체가 아니거나(숫자·null), number 가 양의 정수가 아니거나, title/body 가
    // 문자열이 아니면 각각 명시적 throw — 손상 원소가 hit 으로 새는 것을 차단.
    expect(() =>
      parseRealDataDailyStepDualLegRunReportIssueSearchOutput("[123]"),
    ).toThrow();
    expect(() =>
      parseRealDataDailyStepDualLegRunReportIssueSearchOutput(
        JSON.stringify([{ number: 0, title: "t", body: "b" }]),
      ),
    ).toThrow();
    expect(() =>
      parseRealDataDailyStepDualLegRunReportIssueSearchOutput(
        JSON.stringify([{ number: 5, title: 42, body: "b" }]),
      ),
    ).toThrow();
  });

  it("negative(b''): 정상 빈 배열 '[]' → 빈 hits 로 round-trip(파서 정상 경로 대조군)", () => {
    // 재발견 미매칭의 결정론 근거 — 실 gh 가 빈 결과를 뱉을 때의 canonical stdout("[]")이
    // 빈 hits 로 정상 round-trip 됨을 확인(gated live 의 create 결정과 정합).
    const hits = parseRealDataDailyStepDualLegRunReportIssueSearchOutput("[]");
    expect(Array.isArray(hits)).toBe(true);
    expect(hits).toHaveLength(0);
  });

  it("빈 '[]' → resolve...GhCommandPlan.action==='create'(재발견 미매칭 → 신규, argv[1]='create')", () => {
    // 합성 run 식별자(실 git 미접근 — non-gated 순수 조립)로 chain 을 조립한 뒤, 빈
    // search stdout("[]")을 넣으면 재발견 미매칭 → create 분기로 좁혀짐을 순수 경로로
    // 확인(gated live 의 fresh-marker create 결정과 동형 — live 는 실 gh 로 같은 결과 유도).
    const run: RealDataResultIssueRunRef = {
      gitSha: "abc1234",
      dateToken: "2026-07-13",
    };
    const { commandArgs } = buildSearchAssembly(run);
    const plan = resolveRealDataDailyStepDualLegRunReportIssueGhCommandPlan(
      "[]",
      commandArgs,
    );
    expect(plan.action.action).toBe("create");
    expect(plan.argv[1]).toBe("create");
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

  it("credential 누출 0: 조립된 search argv·searchQuery·descriptor 문자열에 토큰 어휘 미등장", () => {
    // 합성 run 식별자(실 git 미접근 — non-gated 순수 조립)로 search chain 을 조립한 뒤,
    // search argv·searchQuery·descriptor 문자열 어디에도 gh 토큰 어휘가 없음을 확인한다
    // (§9 / R-59 / REQ-059). 실 credential 값은 코드/변수에 기재 0 — gh ambient auth 만.
    const run: RealDataResultIssueRunRef = {
      gitSha: "abc1234",
      dateToken: "2026-07-13",
    };
    const { descriptor, commandArgs, searchArgv } = buildSearchAssembly(run);
    const haystack = [
      ...searchArgv,
      descriptor.title,
      descriptor.marker,
      descriptor.body,
      commandArgs.searchQuery,
    ].join("\n");
    expect(CREDENTIAL_LEAK_PATTERN.test(haystack)).toBe(false);
  });
});

// ── gated live: 실 gh search 실행-후 재발견 read round-trip + fresh-marker create 결정 ──
describeLive(
  "Smoke(live): 실 평가 e2e dual-leg run report rolling-issue 재발견 검색 실 gh search read round-trip",
  () => {
    // live gh 실행 hang 위험 대비 — jest 기본보다 넉넉한 상한(publish-live 동형).
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

    // 실 run 식별자 — gitSha 는 실 git short HEAD, dateToken 은 오늘 KST date. fresh 식별자
    // 이므로 이 marker 는 아직 github 에 rolling-issue 로 존재하지 않는다(본 suite 는 write
    // 하지 않음) → 재발견 미매칭 → create 결정이 결정론적으로 성립. credential 값은 담지
    // 않는다.
    function liveRun(): RealDataResultIssueRunRef {
      const gitSha = execSync("git rev-parse --short HEAD", {
        encoding: "utf8",
      }).trim();
      const dateToken = new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Seoul",
      }).format(new Date());
      return { gitSha, dateToken };
    }

    // rediscoverOnce — 실 gh 로 search 1 round-trip(read-only, mutation 0)을 실행하고 실
    // stdout 을 search-parse 로 해석한다. 반환은 파싱된 hits + 결정된 plan(분기 확인용) +
    // 조립물(marker/argv). write 명령은 실행하지 않는다.
    async function rediscoverOnce(run: RealDataResultIssueRunRef): Promise<{
      hits: ReturnType<
        typeof parseRealDataDailyStepDualLegRunReportIssueSearchOutput
      >;
      plan: ReturnType<
        typeof resolveRealDataDailyStepDualLegRunReportIssueGhCommandPlan
      >;
      descriptor: RealDataDailyStepDualLegRunReportIssueDescriptor;
      searchArgv: string[];
      searchStdout: string;
    }> {
      const { descriptor, commandArgs, searchArgv } = buildSearchAssembly(run);
      // (1) 실 gh 로 기존 이슈 search — 실 searchStdout(read-only, mutation 0).
      const searchStdout = await runGh(searchArgv);
      // (2) 실 stdout → hits(search-parse round-trip).
      const hits =
        parseRealDataDailyStepDualLegRunReportIssueSearchOutput(searchStdout);
      // (3) 실 stdout + commandArgs → create/edit plan(순수 chain, 재단언 0). fresh marker
      //     미매칭이면 create 로 좁혀진다.
      const plan = resolveRealDataDailyStepDualLegRunReportIssueGhCommandPlan(
        searchStdout,
        commandArgs,
      );
      return { hits, plan, descriptor, searchArgv, searchStdout };
    }

    it("happy: 실 gh search round-trip 후 실 stdout 을 search-parse 가 hits 배열로 해석한다", async () => {
      const run = liveRun();
      const { hits } = await rediscoverOnce(run);

      // 구조적 invariant 만 assert(비결정 본문 미-assert, R-59) — hits 는 배열이고 각
      // 원소가 {number 양의 정수, title/body string} 정규 형태(실 gh valid JSON round-trip).
      expect(Array.isArray(hits)).toBe(true);
      for (const hit of hits) {
        expect(Number.isInteger(hit.number)).toBe(true);
        expect(hit.number).toBeGreaterThan(0);
        expect(typeof hit.title).toBe("string");
        expect(typeof hit.body).toBe("string");
      }
    });

    it("fresh-marker 미매칭 → create 결정(결정론): 실 gh search 결과에 fresh marker body-정확매칭 hit 0건 → action='create'(argv[1]='create')", async () => {
      const run = liveRun();
      const { hits, plan, descriptor } = await rediscoverOnce(run);

      // 본 run 의 fresh marker 는 아직 github 에 rolling-issue 로 존재하지 않으므로(write
      // 안 함), 실 gh 가 느슨한 매칭으로 다른 hit 을 반환하더라도 그 marker 를 body 에
      // 정확히 포함한 hit 은 0건이어야 한다 → resolver 가 create 로 수렴.
      const exactMarkerHits = hits.filter((hit) =>
        hit.body.includes(descriptor.marker),
      );
      expect(exactMarkerHits).toHaveLength(0);
      expect(plan.action.action).toBe("create");
      expect(plan.argv[1]).toBe("create");
    });

    it("argv 수용성: 산출 search argv 를 실 gh 가 accept(exit 0)하고 파싱 가능한 JSON 을 산출한다", async () => {
      const run = liveRun();
      const { searchArgv, searchStdout } = await rediscoverOnce(run);

      // 산출 argv 형태 확인(assembly 대조가 아니라 실 gh 도달용 최소 shape) — `search
      // issues --match body <marker> --json number,title,body --limit 30`.
      expect(searchArgv[0]).toBe("search");
      expect(searchArgv[1]).toBe("issues");
      expect(searchArgv).toContain("--match");
      expect(searchArgv).toContain("body");
      expect(searchArgv).toContain("--json");
      expect(searchArgv).toContain("number,title,body");
      // 실 gh 가 non-zero exit / unknown flag 없이 산출한 stdout 이 파싱 가능한 JSON 배열임
      // (flag 조합 --match body/--json/--limit 이 실 gh 에서 유효함을 실증).
      const parsed: unknown = JSON.parse(searchStdout);
      expect(Array.isArray(parsed)).toBe(true);
    });

    it("mutation 0(read-only): 재발견 흐름은 search argv 만 산출 — create/edit write argv 를 실행하지 않는다", async () => {
      const run = liveRun();
      const { searchArgv } = await rediscoverOnce(run);

      // 본 suite 가 실 gh 에 넘기는 argv 는 search 뿐 — write 서브커맨드(create/edit)가
      // 섞이지 않음을 조립물 수준에서 확인(코드에 create/edit execFile 호출 0).
      expect(searchArgv[0]).toBe("search");
      expect(searchArgv).not.toContain("create");
      expect(searchArgv).not.toContain("edit");
    });

    it("credential 누출 0: 실 gh search argv·searchStdout round-trip 어디에도 토큰 어휘 미등장", async () => {
      const run = liveRun();
      const { searchArgv, searchStdout, descriptor } =
        await rediscoverOnce(run);

      // 조립 argv·실 gh stdout·descriptor 문자열 어디에도 gh 토큰 어휘가 없음을 확인
      // (§9 / R-59 / REQ-059). 실 credential 값은 gh ambient auth 로만 소비 — 코드/로그
      // 미기재.
      const haystack = [
        ...searchArgv,
        searchStdout,
        descriptor.marker,
        descriptor.title,
      ].join("\n");
      expect(CREDENTIAL_LEAK_PATTERN.test(haystack)).toBe(false);
    });

    it("negative(a): 손상 argv(비존재 서브커맨드)로 실 gh 실행 시 non-zero exit → reject(조용한 성공-위장 0)", async () => {
      // 존재하지 않는 gh 서브커맨드 argv 를 주입하면 gh 가 non-zero exit 하고 execFile 이
      // reject 되어 조용히 성공으로 위장되지 않는다(read-only — write 없음).
      await expect(
        runGh(["search", "this-subcommand-does-not-exist-xyz"]),
      ).rejects.toBeDefined();
    });
  },
);
