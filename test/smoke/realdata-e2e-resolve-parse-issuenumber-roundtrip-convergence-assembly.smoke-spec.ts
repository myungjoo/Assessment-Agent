// realdata-e2e-resolve-parse-issuenumber-roundtrip-convergence-assembly.smoke-spec.ts
// — 실 평가 e2e step④ post-execution resolve↔parse issueNumber single-source 3자
// roundtrip 수렴 non-gated build-time smoke (T-0764 박제, PLAN.md 109행 🟢 실 평가 e2e
// step④).
//
// 본 spec 의 존재 이유 — public CI gap 해소(issueNumber 축 post-execution roundtrip):
//   - PLAN 109행 step④(결과 이슈 박제) 의 멱등 search-or-update 의 핵심 불변식은
//     pre-execution 결정과 post-execution 관측이 동일 issue 식별자에 수렴함이다 —
//     resolver `resolveRealDataResultIssueGhCommandPlan(searchStdout, commandArgs)`
//     (T-0588) 가 update 분기에서 `action: {action:'update', issueNumber: N}` 으로
//     박은 N 과, 그 plan 의 edit argv(`['issue','edit', String(N), ...]`)를 caller 가
//     `execFile('gh', argv)` 로 실행한 뒤 받는 stdout 을
//     `parseRealDataResultIssueCreateEditOutput(stdout)`(T-0589) 가 산출하는
//     `{issueNumber, url}` 의 issueNumber 가 동일 N 으로 byte-identical 수렴해야
//     한다. 또한 그 N 은 resolver 가 입력으로 받은 searchStdout 안의 후보 hit 들 중
//     최소 number(멱등 source — 가장 오래된 이슈, T-0584 L150) 와도 일치해
//     search-hit.minNumber ↔ resolve.action.update.issueNumber ↔
//     parse.output.issueNumber 3자 수렴 박제한다.
//   - 기존 sweep 은 두 leg 를 각각 따로 닫았다: resolver 측은
//     `realdata-e2e-search-resolve-roundtrip-convergence-assembly.smoke-spec.ts`
//     (T-0758, marker 축 — search marker ↔ resolve searchQuery ↔ descriptor.marker
//     pre-execution leg 단독)·`realdata-e2e-result-issue-gh-command-plan-assembly.smoke-spec.ts`
//     (T-0698, gh-command-plan 내부 위임 chain 단독), parse 측은
//     `realdata-e2e-create-edit-output-outcome-report-assembly.smoke-spec.ts`
//     (T-0701/T-0702/T-0725, parse 산출 outcome ↔ outcome-report 5필드 재유도 —
//     post-execution leg 단독, run+outcome 축, pre-execution resolve 미참조). 그러나
//     **resolver update 분기의 action.issueNumber 와 parse 의 output.issueNumber 를
//     동일 search stdout source 로 묶어 cross-stage roundtrip 수렴**(T-0758 marker 축의
//     post-execution mirror)을 박제한 smoke 는 NONE 이었다(git grep
//     resolveRealDataResultIssueGhCommandPlan AND
//     parseRealDataResultIssueCreateEditOutput 둘 다 실호출 + action.issueNumber ===
//     outcome.issueNumber 단언 smoke 0 확인).
//   - 본 spec 은 그 gap 을 메운다 — **gating 없이 항상 실행되는 일반 describe** 로
//     단일 search source 로부터 두 컴포저(resolve gh-command-plan ↔ post-execution
//     parse) 가 같은 N 으로 cross-stage 수렴함만 박제한다. live leg(실 gh issue
//     search·create·edit / `execFile('gh', argv)` / 실 github 네트워크 / 실 LLM /
//     Ollama / DB / 실 jest spawn)는 복제하지 않고, synthetic searchStdout /
//     createEditStdout literal 을 두 컴포저에 직접 공급해 live leg 를 우회한다(조립
//     surface 만 검증). 따라서 본 spec 은:
//
//      🔥 실 gh 호출 0 — gh search / create / edit / execFile('gh', argv) 미실행.
//         synthetic searchStdout / createEditStdout literal 을 두 컴포저에 직접 공급.
//      🔥 실 네트워크 호출 0 — github / Ollama / gh 호출 0. fetch 0. process.env 읽기 0.
//      🔥 실 LLM 호출 0 / 실 DB 접근 0 / 실 jest spawn 0 — resolve↔parse 수렴 조립만.
//      🔥 credential 0 / secret 0 / 비용 0 — public CI 에서 항상 green 발화(R-113).
//         산출 argv / url / 합성 fixture 어디에도 token/secret 어휘 미주입·미포함 검증.
//      🔥 새 외부 dependency 0 — 기존 resolve*/parse* 컴포저 import 재사용만(가드 신설 0).
//      🔥 gating / describe.skip 배선 0 — 순수 build-time in-memory 검증만.
//
// Out of Scope (T-0764):
//   - resolve 의 search-marker↔searchQuery↔descriptor.marker 3자 수렴(marker 축,
//     pre-execution leg) 재단언(T-0758 이미 cover — 본 task 는 issueNumber 축
//     post-execution 만).
//   - parse → outcome-report 5필드(`{issueNumber,url,gitSha,dateToken,summaryLine}`)
//     재유도 수렴 재단언(T-0701/T-0702/T-0725 이미 cover — 본 task 는 parse.issueNumber
//     ↔ resolve.action.update.issueNumber 만, outcome-report 합성 미관여).
//   - gh-command-plan 내부 위임 chain(parse → resolve → buildGhArgv) 단독 수렴
//     재단언(T-0698 이미 cover — 본 task 는 resolve↔post-execution parse cross-stage 만).
//   - search hit shape(number/title/labels 슬롯 전수)·outcome shape 키 집합 set-equality
//     가드 재단언(T-0661/T-0662 이미 cover).
//   - publish chain(buildRealDataResultIssuePublishPlan 진입) 재단언(T-0729/T-0755
//     이미 cover — 본 task 는 publish chain 미관여, post-execution roundtrip 만).
//   - 실 github 네트워크 fetch / 실 활동 수집 / 실 prisma.upsert / 실 LLM scoring /
//     실 gh CLI 실행(live leg 복제 0).
//   - gated(DB·credential·LAN) smoke leg 추가 — 본 task 는 non-gated build-time
//     pure-composer smoke 단독.
//   - 컴포저 소스 / 위임 consistency 가드 / descriptor·command-args·search-parse·
//     output-parse helper 수정 — test-only(신규 smoke spec 1 파일). 새 컴포저 / 가드 /
//     helper 신설 0 — 기존 import 재사용만.
//   - production src/ 코드 / package.json / test/jest-smoke.json 변경.
import type { RealDataResultIssueCommandArgs } from "../helpers/realdata-e2e-result-issue-command-args";
import { resolveRealDataResultIssueGhCommandPlan } from "../helpers/realdata-e2e-result-issue-gh-command-plan";
import { parseRealDataResultIssueCreateEditOutput } from "../helpers/realdata-e2e-result-issue-output-parse";

// 결정론 멱등 marker — 두 컴포저가 공유하는 단일 source 토큰. 비공백 안정 토큰이라
// marker 빈/공백 guard 를 자극하지 않으며, token/secret/raw narrative 어휘를 포함하지
// 않는다(credential 누출 0 단언의 fixture 전제).
const MARKER = "<!-- realdata-e2e-result-issue: 2026-06-28@abc1234 -->";

// 결정론 owner/repo — 합성 issue URL 의 path segment source(public CI 에서 항상 green
// 발화). token/secret/PAT/-auth 어휘 미포함.
const OWNER = "myungjoo";
const REPO = "assessment-agent";

// 유효 commandArgs fixture 헬퍼 — searchQuery / createArgs{title,body,labels} /
// updateArgs{title,body} 전부 non-blank. body 에 marker 라인을 보존해 멱등 검색 토큰이
// 두 경로(create/update)에 모두 남도록 한다(실 빌더 buildRealDataResultIssueCommandArgs
// 의 산출 형상 동형). 매 it 가 새 객체를 받아 입력 mutate 가 누설되지 않도록 한다.
function validCommandArgs(
  marker: string = MARKER,
): RealDataResultIssueCommandArgs {
  const body = `${marker}\n\ncount: 3 · totalVolume: 12`;
  return {
    searchQuery: marker,
    createArgs: {
      title: "실 평가 e2e 결과 2026-06-28@abc1234",
      body,
      labels: ["realdata-e2e", "result"],
    },
    updateArgs: {
      title: "실 평가 e2e 결과 2026-06-28@abc1234",
      body,
    },
  };
}

// marker 를 body 에 포함한 hit 1+건 stdout 합성 헬퍼 — 동일 run 이슈가 이미 존재하는
// 경우(update 분기 유발). hit 들의 number 슬롯을 임의로 받아 분포 분리 시나리오
// (search-hit 변별성 branch)에서 hits 분포 A·B 를 다르게 줄 수 있게 했다.
function multiHitStdout(marker: string, numbers: number[]): string {
  return JSON.stringify(
    numbers.map((n, i) => ({
      number: n,
      title: `결과 이슈(#${i})`,
      body: `본문 ${i}\n${marker}\n끝`,
    })),
  );
}

// synthetic create/edit stdout 합성 헬퍼 — `gh issue create` / `gh issue edit <N>` 의
// stdout 은 https://github.com/<owner>/<repo>/issues/<N> URL 한 줄 + 부가 메시지/
// 개행을 포함할 수 있다. 본 helper 는 그 happy-path 형상을 N 별로 합성한다(parse 가
// 첫 매칭 URL 결정론으로 추출하는 surface 직접 자극).
function createEditStdout(n: number, noisePrefix: string = ""): string {
  return `${noisePrefix}https://github.com/${OWNER}/${REPO}/issues/${n}\n`;
}

// 후보 0건 stdout — gh search 가 매칭 이슈를 못 찾은 경우(빈 배열). create 분기 유발.
const EMPTY_SEARCH_STDOUT = "[]";

describe("Smoke(non-gated): 실 평가 e2e step④ post-execution resolve↔parse issueNumber single-source 3자 roundtrip 수렴(byte-identical N) live-gh 0 검증", () => {
  describe("happy path — 두 컴포저 모두 정상 산출(resolve plan + parse outcome)", () => {
    it("(a) 유효 searchStdout + commandArgs → resolvePlan(update {action,issueNumber,argv}) 산출 정상", () => {
      const commandArgs = validCommandArgs();
      const searchStdout = multiHitStdout(commandArgs.searchQuery, [7, 13]);

      const resolvePlan = resolveRealDataResultIssueGhCommandPlan(
        searchStdout,
        commandArgs,
      );

      expect(resolvePlan.action.action).toBe("update");
      if (resolvePlan.action.action !== "update") {
        throw new Error("update action 기대");
      }
      expect(typeof resolvePlan.action.issueNumber).toBe("number");
      expect(Array.isArray(resolvePlan.argv)).toBe(true);
      expect(resolvePlan.argv[0]).toBe("issue");
      expect(resolvePlan.argv[1]).toBe("edit");
    });

    it("(b) 유효 createEditStdout → parseOutcome({issueNumber, url}) 산출 정상", () => {
      const parseOutcome = parseRealDataResultIssueCreateEditOutput(
        createEditStdout(7),
      );

      expect(typeof parseOutcome.issueNumber).toBe("number");
      expect(parseOutcome.issueNumber).toBeGreaterThan(0);
      expect(typeof parseOutcome.url).toBe("string");
      expect(parseOutcome.url).toMatch(
        /^https:\/\/github\.com\/[^/]+\/[^/]+\/issues\/\d+$/,
      );
    });
  });

  describe("cross-stage issueNumber single-source 3자 수렴(branch — 핵심 불변식)", () => {
    it("(c) search-hit.minNumber → resolve.action.update.issueNumber → parse.output.issueNumber 동일 N 3자 byte-identical 수렴", () => {
      const commandArgs = validCommandArgs();
      const hitsNumbers = [33, 7, 19];
      const expectedMinN = Math.min(...hitsNumbers);
      const searchStdout = multiHitStdout(commandArgs.searchQuery, hitsNumbers);

      const resolvePlan = resolveRealDataResultIssueGhCommandPlan(
        searchStdout,
        commandArgs,
      );
      if (resolvePlan.action.action !== "update") {
        throw new Error("update action 기대 — multi-hit 입력");
      }
      const resolvedN = resolvePlan.action.issueNumber;

      // caller 가 그 N 으로 `gh issue edit N ...` 을 실행한 뒤 받는 stdout 합성.
      const parseOutcome = parseRealDataResultIssueCreateEditOutput(
        createEditStdout(resolvedN),
      );

      // 3자 단일 source 수렴 — search-hit.minNumber = resolve.action.issueNumber =
      // parse.output.issueNumber, 어느 경로도 stale/swap drift 0.
      expect(resolvedN).toBe(expectedMinN);
      expect(parseOutcome.issueNumber).toBe(resolvedN);
      expect(parseOutcome.issueNumber).toBe(expectedMinN);
    });

    it("(d) resolvePlan.argv 안 N 박제(`['issue','edit', String(N), ...]`)도 동일 N — argv 3번째 슬롯이 parse.output.issueNumber 와 byte-identical", () => {
      const commandArgs = validCommandArgs();
      const searchStdout = multiHitStdout(commandArgs.searchQuery, [7, 13]);
      const resolvePlan = resolveRealDataResultIssueGhCommandPlan(
        searchStdout,
        commandArgs,
      );
      if (resolvePlan.action.action !== "update") {
        throw new Error("update action 기대");
      }
      const parseOutcome = parseRealDataResultIssueCreateEditOutput(
        createEditStdout(resolvePlan.action.issueNumber),
      );

      // argv 안 issueNumber 위치(L74-79 — `['issue','edit', String(N), ...]`)도 동일 N.
      expect(resolvePlan.argv[2]).toBe(String(resolvePlan.action.issueNumber));
      expect(resolvePlan.argv[2]).toBe(String(parseOutcome.issueNumber));
    });
  });

  describe("resolve→edit argv→parse roundtrip argv-mediated 수렴(branch)", () => {
    it("(e) resolvePlan.argv 가 String(parseOutcome.issueNumber) 를 포함 — caller 가 argv 를 그대로 execFile 에 보낸 뒤 stdout parse 시 N drift 0", () => {
      const commandArgs = validCommandArgs();
      const searchStdout = multiHitStdout(commandArgs.searchQuery, [7, 13]);
      const resolvePlan = resolveRealDataResultIssueGhCommandPlan(
        searchStdout,
        commandArgs,
      );
      if (resolvePlan.action.action !== "update") {
        throw new Error("update action 기대");
      }
      const parseOutcome = parseRealDataResultIssueCreateEditOutput(
        createEditStdout(resolvePlan.action.issueNumber),
      );

      // argv 안에 String(N) 이 포함 — argv 중간 단계가 swap 변형되지 않음.
      expect(resolvePlan.argv).toContain(String(parseOutcome.issueNumber));
    });
  });

  describe("search-hit 분포 변별성(branch — 멱등 source 박제, N drift 시 detection)", () => {
    it("(f) hits 분포 A=[7,13] vs B=[21,42] → 각각 N=7 / N=21 분리 수렴(각 chain 안 cross-stage 일치 + 두 chain 간 N 분리)", () => {
      const commandArgs = validCommandArgs();

      // chain A — 분포 [7,13] → minN=7.
      const planA = resolveRealDataResultIssueGhCommandPlan(
        multiHitStdout(commandArgs.searchQuery, [7, 13]),
        commandArgs,
      );
      if (planA.action.action !== "update") {
        throw new Error("update A 기대");
      }
      const outcomeA = parseRealDataResultIssueCreateEditOutput(
        createEditStdout(planA.action.issueNumber),
      );

      // chain B — 분포 [21,42] → minN=21.
      const planB = resolveRealDataResultIssueGhCommandPlan(
        multiHitStdout(commandArgs.searchQuery, [21, 42]),
        commandArgs,
      );
      if (planB.action.action !== "update") {
        throw new Error("update B 기대");
      }
      const outcomeB = parseRealDataResultIssueCreateEditOutput(
        createEditStdout(planB.action.issueNumber),
      );

      // 각 chain 안 cross-stage 일치 — A/A, B/B.
      expect(outcomeA.issueNumber).toBe(planA.action.issueNumber);
      expect(outcomeB.issueNumber).toBe(planB.action.issueNumber);
      // 두 chain 의 N 분리 — A=7, B=21(다른 source → 다른 N).
      expect(planA.action.issueNumber).toBe(7);
      expect(planB.action.issueNumber).toBe(21);
      expect(outcomeA.issueNumber).not.toBe(outcomeB.issueNumber);
    });
  });

  describe("stdout 무관·resolve 독립(branch — partial-thread 격리, 결정론)", () => {
    it("(g) 동일 N 의 createEditStdout 의 URL 외 텍스트(앞 noise / trailing 본문 / 다중 줄)만 다르게 → parse.issueNumber/url 두 경우 byte-identical + resolve.action.issueNumber 와 수렴 유지", () => {
      const commandArgs = validCommandArgs();
      const searchStdout = multiHitStdout(commandArgs.searchQuery, [7, 13]);
      const resolvePlan = resolveRealDataResultIssueGhCommandPlan(
        searchStdout,
        commandArgs,
      );
      if (resolvePlan.action.action !== "update") {
        throw new Error("update action 기대");
      }
      const n = resolvePlan.action.issueNumber;

      const stdout1 = createEditStdout(n);
      const stdout2 = `Creating issue in ${OWNER}/${REPO}\n${createEditStdout(
        n,
      )}Issue created successfully.\n`;

      const outcome1 = parseRealDataResultIssueCreateEditOutput(stdout1);
      const outcome2 = parseRealDataResultIssueCreateEditOutput(stdout2);

      // 부가 본문 변동에도 첫 매칭 URL 결정론 — issueNumber/url 동일.
      expect(outcome1.issueNumber).toBe(outcome2.issueNumber);
      expect(outcome1.url).toBe(outcome2.url);
      // 두 경우 모두 resolve.action.issueNumber 와 수렴 유지.
      expect(outcome1.issueNumber).toBe(n);
      expect(outcome2.issueNumber).toBe(n);
    });

    it("(h) 동일 (searchStdout, commandArgs) → resolve 두 호출 모두 동일 N(결정론)", () => {
      const commandArgs = validCommandArgs();
      const searchStdout = multiHitStdout(commandArgs.searchQuery, [7, 13]);
      const planA = resolveRealDataResultIssueGhCommandPlan(
        searchStdout,
        commandArgs,
      );
      const planB = resolveRealDataResultIssueGhCommandPlan(
        searchStdout,
        commandArgs,
      );
      if (
        planA.action.action !== "update" ||
        planB.action.action !== "update"
      ) {
        throw new Error("update action 기대");
      }
      expect(planA.action.issueNumber).toBe(planB.action.issueNumber);
    });
  });

  describe("multi-hit minNumber 정합 분기 — N 수렴 보존(branch)", () => {
    it("(i) hits 3+ 원소 unsorted [99,7,55] → resolve.action.issueNumber = 7(최소, 순서 무관 결정론) AND parse(createEditStdout(7)).issueNumber = 7", () => {
      const commandArgs = validCommandArgs();
      const searchStdout = multiHitStdout(commandArgs.searchQuery, [99, 7, 55]);

      const resolvePlan = resolveRealDataResultIssueGhCommandPlan(
        searchStdout,
        commandArgs,
      );
      if (resolvePlan.action.action !== "update") {
        throw new Error("update action 기대");
      }
      expect(resolvePlan.action.issueNumber).toBe(7);

      const parseOutcome = parseRealDataResultIssueCreateEditOutput(
        createEditStdout(resolvePlan.action.issueNumber),
      );
      expect(parseOutcome.issueNumber).toBe(7);
      // 3자 수렴 다시 박제(unsorted 분포에서도 보존).
      expect(parseOutcome.issueNumber).toBe(resolvePlan.action.issueNumber);
    });
  });

  describe("flow / branch — create 분기 분리(create 분기는 본 task 수렴 단언 적용 대상 아님)", () => {
    it("(j) 빈 search stdout('[]') → resolve.action.action === 'create' AND action 에 issueNumber 필드 부재(N source 없음 — cross-stage 수렴 의미 무)", () => {
      const commandArgs = validCommandArgs();
      const resolvePlan = resolveRealDataResultIssueGhCommandPlan(
        EMPTY_SEARCH_STDOUT,
        commandArgs,
      );

      expect(resolvePlan.action.action).toBe("create");
      // create action 에 issueNumber 필드가 없음(discriminated union — N source 자체
      // 부재). 본 task 의 수렴 불변식은 update 분기에서만 의미 — create 분기는 T-0758
      // search→create round-trip 이 별도 cover.
      expect("issueNumber" in resolvePlan.action).toBe(false);
    });
  });

  describe("error path / negative cases — resolve-side / parse-side 양 leg N 식별자 거부 대칭 박제", () => {
    it("(k) resolve leg: 빈 searchStdout('') → parse 단계 throw 전파(N 미결정 — argv 미산출)", () => {
      const commandArgs = validCommandArgs();
      expect(() =>
        resolveRealDataResultIssueGhCommandPlan("", commandArgs),
      ).toThrow();
    });

    it("(l) resolve leg: 비JSON searchStdout('not-json') → parse 단계 throw 전파", () => {
      const commandArgs = validCommandArgs();
      expect(() =>
        resolveRealDataResultIssueGhCommandPlan("not-json", commandArgs),
      ).toThrow();
    });

    it("(m) resolve leg: hit number 비양수(0) → assertPositiveNumber throw 전파(N 비식별)", () => {
      const commandArgs = validCommandArgs();
      const stdout = JSON.stringify([
        { number: 0, title: "t", body: `b\n${commandArgs.searchQuery}\n` },
      ]);
      expect(() =>
        resolveRealDataResultIssueGhCommandPlan(stdout, commandArgs),
      ).toThrow();
    });

    it("(m') resolve leg: hit number 음수(-1) → assertPositiveNumber throw 전파(N 비식별)", () => {
      const commandArgs = validCommandArgs();
      const stdout = JSON.stringify([
        { number: -1, title: "t", body: `b\n${commandArgs.searchQuery}\n` },
      ]);
      expect(() =>
        resolveRealDataResultIssueGhCommandPlan(stdout, commandArgs),
      ).toThrow();
    });

    it("(n) parse leg: URL 미발견 createEditStdout('') → parse throw(issueNumber 미결정)", () => {
      expect(() => parseRealDataResultIssueCreateEditOutput("")).toThrow();
    });

    it("(n') parse leg: 무관 텍스트 createEditStdout('no url here') → parse throw(issueNumber 미결정)", () => {
      expect(() =>
        parseRealDataResultIssueCreateEditOutput("no url here"),
      ).toThrow();
    });

    it("(o) parse leg: /issues/0 → assertPositiveIssueNumber throw(post-execution issueNumber 비식별)", () => {
      expect(() =>
        parseRealDataResultIssueCreateEditOutput(
          `https://github.com/${OWNER}/${REPO}/issues/0\n`,
        ),
      ).toThrow();
    });

    it("(o') parse leg: /issues/007(선행 0) → assertPositiveIssueNumber throw", () => {
      expect(() =>
        parseRealDataResultIssueCreateEditOutput(
          `https://github.com/${OWNER}/${REPO}/issues/007\n`,
        ),
      ).toThrow();
    });

    it("(o'') parse leg: /issues/abc(비숫자) → URL 미발견 throw(패턴 미매칭)", () => {
      expect(() =>
        parseRealDataResultIssueCreateEditOutput(
          `https://github.com/${OWNER}/${REPO}/issues/abc\n`,
        ),
      ).toThrow();
    });

    it("(p) parse leg: /pull/N URL(비-issue 경로) → parse throw(잘못된 경로 차단)", () => {
      expect(() =>
        parseRealDataResultIssueCreateEditOutput(
          `https://github.com/${OWNER}/${REPO}/pull/7\n`,
        ),
      ).toThrow();
    });

    it("(q) parse leg: 비-github 호스트(gitlab.com/.../issues/7) → parse throw(호스트 mismatch 차단)", () => {
      expect(() =>
        parseRealDataResultIssueCreateEditOutput(
          `https://gitlab.com/o/r/issues/7\n`,
        ),
      ).toThrow();
    });
  });

  describe("credential 누출 0(branch — §9 / R-59 / REQ-059 정합)", () => {
    it("(r) resolvePlan.argv · parseOutcome.url · createEditStdout fixture 어디에도 token/secret/PAT/--auth 어휘 미등장 + raw narrative 미포함", () => {
      const commandArgs = validCommandArgs();
      const searchStdout = multiHitStdout(commandArgs.searchQuery, [7, 13]);
      const resolvePlan = resolveRealDataResultIssueGhCommandPlan(
        searchStdout,
        commandArgs,
      );
      if (resolvePlan.action.action !== "update") {
        throw new Error("update action 기대");
      }
      const stdoutFixture = createEditStdout(resolvePlan.action.issueNumber);
      const parseOutcome =
        parseRealDataResultIssueCreateEditOutput(stdoutFixture);

      const surfaces = [
        resolvePlan.argv.join(" "),
        parseOutcome.url,
        stdoutFixture,
      ];
      for (const surface of surfaces) {
        expect(surface).not.toContain("--token");
        expect(surface).not.toContain("--auth");
        expect(surface).not.toContain("GITHUB_TOKEN");
        expect(surface).not.toMatch(/ghp_[A-Za-z0-9]/);
        // raw 외부 narrative(commit/PR/issue 본문 어휘) 미주입 — outcome 은 N/url 만.
        expect(parseOutcome.url).not.toMatch(/commit|pull request/i);
      }
    });
  });

  describe("결정론·무공유·no-mutation — 두 컴포저 각각 두 번 호출 + 입력 불변", () => {
    it("(s) resolve 두 호출 deep-equal + 새 plan/argv 객체(참조 비동일)", () => {
      const commandArgs = validCommandArgs();
      const searchStdout = multiHitStdout(commandArgs.searchQuery, [7, 13]);
      const a = resolveRealDataResultIssueGhCommandPlan(
        searchStdout,
        commandArgs,
      );
      const b = resolveRealDataResultIssueGhCommandPlan(
        searchStdout,
        commandArgs,
      );
      expect(a).toEqual(b);
      expect(a).not.toBe(b);
      expect(a.argv).not.toBe(b.argv);
    });

    it("(t) parse 두 호출 deep-equal + 새 outcome 객체(참조 비동일)", () => {
      const stdout = createEditStdout(7);
      const a = parseRealDataResultIssueCreateEditOutput(stdout);
      const b = parseRealDataResultIssueCreateEditOutput(stdout);
      expect(a).toEqual(b);
      expect(a).not.toBe(b);
    });

    it("(u) no-mutation — 입력 searchStdout(string)·commandArgs(중첩 createArgs.labels / updateArgs 포함)·createEditStdout(string) 두 컴포저 호출 전후 deep-equal", () => {
      const commandArgs = validCommandArgs();
      const commandArgsBefore = JSON.parse(JSON.stringify(commandArgs));
      const searchStdout = multiHitStdout(commandArgs.searchQuery, [7, 13]);
      const searchStdoutBefore = searchStdout;
      const stdout = createEditStdout(7);
      const stdoutBefore = stdout;

      resolveRealDataResultIssueGhCommandPlan(searchStdout, commandArgs);
      parseRealDataResultIssueCreateEditOutput(stdout);

      // 중첩 createArgs.labels / updateArgs 도 deep-equal 보존.
      expect(commandArgs).toEqual(commandArgsBefore);
      expect(commandArgs.createArgs.labels).toEqual(
        commandArgsBefore.createArgs.labels,
      );
      expect(commandArgs.updateArgs).toEqual(commandArgsBefore.updateArgs);
      // string 원시 — 참조 동일성으로 미교체 확인(불변).
      expect(searchStdout).toBe(searchStdoutBefore);
      expect(stdout).toBe(stdoutBefore);
    });
  });
});
