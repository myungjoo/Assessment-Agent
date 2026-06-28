// realdata-e2e-result-issue-gh-command-plan-assembly.smoke-spec.ts — 실 평가 e2e
// result-issue gh-command-plan 조립 체인 non-gated build-time smoke (T-0742 박제,
// PLAN.md 109행 🟢 실 평가 e2e).
//
// 본 spec 의 존재 이유 — public CI gap 해소(T-0741 result-issue-command-plan 조립
// smoke 의 stdout-side 후속 형제):
//   - PLAN 109행 step ④(결과 이슈 박제) 경계의 **종단** 컴포저는 순수 컴포저
//     `resolveRealDataResultIssueGhCommandPlan(stdout, commandArgs)`(T-0588, self-wire
//     T-0698)가 닫는다 — gh issue search stdout(JSON 문자열) + 명령-args 묶음
//     (`RealDataResultIssueCommandArgs`)을 (1)
//     `parseRealDataResultIssueSearchOutput(stdout)`(T-0587)로
//     `RealDataResultIssueSearchHit[]` 로, (2)
//     `resolveRealDataResultIssueAction(hits, commandArgs.searchQuery)`(T-0584)로
//     create/update action 으로, (3)
//     `buildRealDataResultIssueGhArgv(action, commandArgs)`(T-0585)로 실 `gh` 인자-벡터로
//     합성해 `{ action, argv }` 한 묶음으로 반환한다. 이 컴포저는 step ④ live wiring 이
//     실제로 `execFile('gh', argv)` 에 넘기는 **마지막** plan 을 만든다 — 후보 0건
//     (stdout `"[]"` 또는 marker 미포함)이면 `gh issue create`, 후보 1+ 건이면 최소
//     issueNumber 의 `gh issue edit`(멱등 갱신)으로 분기한다. T-0741 smoke 가 닫은
//     result-issue-command-plan(results→report→commandArgs)의 산출 `commandArgs` 가
//     정확히 본 컴포저의 두 번째 인자라, 본 spec 은 step ④ 의 stdout-side 종단 절반을
//     닫아 step ④ 두 절반(commandArgs 산출 ↔ gh argv 해소)의 조립 smoke 쌍을 완성한다.
//   - 이 컴포저는 unit(`realdata-e2e-result-issue-gh-command-plan.spec.ts`) + consistency
//     (`...-gh-command-plan-consistency.spec.ts`) spec 으로 닫혀 있으나,
//     **stdout→hits→action→argv 를 묶은 조립 체인 단위의 non-gated build-time smoke** 는
//     부재였다(`git grep resolveRealDataResultIssueGhCommandPlan test/smoke/` = 0). 즉
//     create↔update action 오매핑·argv↔action drift·marker(searchQuery) 재해석 drift·§9
//     credential 값 argv 누출·비JSON/비배열 stdout throw 전파·빈 marker throw 전파·빈
//     title/body·비양수 issueNumber throw 전파 회귀는 public CI 에서 한 번도 발화되지
//     않고 credential-gated live smoke set-up 시에만 잡혔다.
//   - 본 spec 은 그 gap 을 메운다 — **gating 없이 항상 실행되는 일반 describe** 로
//     stdout→action→argv 조립 surface 를 검증한다. live leg(실 gh issue search·create·
//     edit / `execFile('gh', argv)` 실 실행 / 실 github 수집 / 실 LLM / Ollama / DB /
//     실 jest spawn)는 복제하지 않고, search stdout(JSON 문자열)과 `commandArgs` 를
//     synthetic literal 로 직접 공급해 live leg 를 우회한다(조립 surface 만 검증).
//     따라서 본 spec 은:
//
//      🔥 실 gh 호출 0 — gh search / create / edit / execFile('gh', argv) 미실행.
//         synthetic stdout 문자열 + commandArgs literal 을 컴포저에 직접 공급.
//      🔥 실 네트워크 호출 0 — github / Ollama / gh 호출 0. fetch 0. process.env 읽기 0.
//      🔥 실 LLM 호출 0 / 실 DB 접근 0 / 실 jest spawn 0 — stdout→action→argv 조립만.
//      🔥 credential 0 / secret 0 / 비용 0 — public CI 에서 항상 green 발화(R-113).
//         산출 argv 에 token/secret 어휘(--token/GITHUB_TOKEN/ghp_) 미주입·미포함 검증.
//      🔥 새 외부 dependency 0 — 기존 resolve*/build*/parse* 컴포저 import 재사용만
//         (consistency-guard 신설 금지 — sweep 종결, T-0726).
//      🔥 gating / describe.skip 배선 0 — 순수 build-time in-memory 검증만.
//
// Out of Scope (T-0742):
//   - 기존 result-issue-command-plan 조립 smoke(T-0741, `buildRealDataResultIssueCommandPlan`
//     진입, results→commandArgs side) — 본 task 는 그 뒤(commandArgs + search stdout →
//     실 gh argv)의 `resolveRealDataResultIssueGhCommandPlan` 종단 컴포저만 책임(선행
//     smoke 수정·중복 0).
//   - `commandArgs` 의 실 산출(`buildRealDataResultIssueCommandPlan` /
//     `buildRealDataResultIssueCommandArgs`) — 본 task 는 그 산출을 synthetic fixture 로
//     직접 주입만(중복·재검증 0 — 그건 T-0741 smoke 책임).
//   - 실 gh issue search·create·edit / `execFile('gh', argv)` 실 실행 / 실 jest spawn /
//     실 github 네트워크 수집 / 실 LLM round-trip / Ollama 호출 / DB 접근.
//   - 컴포저 소스(`realdata-e2e-result-issue-gh-command-plan.ts` /
//     `...-action.ts` / `...-gh-argv.ts` / `...-search-parse.ts`) / 위임 helper /
//     consistency 가드 수정 — test-only(신규 smoke spec 1 파일).
//   - 새 컴포저 / 가드 / helper / consistency-guard 신설 — 기존 import 재사용만.
//   - production src/ 코드 / package.json / test/jest-smoke.json 변경.
//   - T-0728~T-0741 의 기존 조립 smoke 파일 수정 — file-disjoint 병렬 stream(본 task 는
//     신규 파일 추가만).
import { resolveRealDataResultIssueAction } from "../helpers/realdata-e2e-result-issue-action";
import type { RealDataResultIssueCommandArgs } from "../helpers/realdata-e2e-result-issue-command-args";
import { buildRealDataResultIssueGhArgv } from "../helpers/realdata-e2e-result-issue-gh-argv";
import { resolveRealDataResultIssueGhCommandPlan } from "../helpers/realdata-e2e-result-issue-gh-command-plan";
import { parseRealDataResultIssueSearchOutput } from "../helpers/realdata-e2e-result-issue-search-parse";

// 결정론 멱등 marker — fixture commandArgs.searchQuery 이자, update 분기 stdout 의 hit
// body 에 박는 검색 토큰. 비공백 상수라 빈/공백 marker guard 를 자극하지 않는다.
const MARKER = "realdata-e2e-result-issue::abc1234::2026-06-28";

// 유효 commandArgs fixture 헬퍼 — searchQuery / createArgs{title,body,labels} /
// updateArgs{title,body} 전부 non-blank. body 에 MARKER 라인을 보존해 멱등 검색 토큰이
// 두 경로(create/update)에 모두 남도록 한다(실 빌더 buildRealDataResultIssueCommandArgs
// 의 산출 형상과 동형). 매 it 가 새 객체를 받아 입력 mutate 가 누설되지 않도록 한다.
function validCommandArgs(): RealDataResultIssueCommandArgs {
  const body = `# 실 평가 e2e 결과\n\n${MARKER}\n\ncount: 3`;
  return {
    searchQuery: MARKER,
    createArgs: {
      title: "실 평가 e2e 결과 — abc1234 / 2026-06-28",
      body,
      labels: ["realdata-e2e", "result"],
    },
    updateArgs: {
      title: "실 평가 e2e 결과 — abc1234 / 2026-06-28",
      body,
    },
  };
}

// 후보 0건 stdout — gh search 가 매칭 이슈를 못 찾은 경우(빈 배열). create 분기 유발.
const EMPTY_STDOUT = "[]";

// marker 미포함 hit 들로만 구성된 stdout — 후보 0건(create) 분기의 두 번째 형태(빈
// 배열이 아니라 hit 은 있으나 body 가 marker 를 포함 안 함). JSON.stringify 로 합성해
// 파서가 정상 통과하는 유효 JSON 임을 보장한다.
const NO_MARKER_STDOUT = JSON.stringify([
  { number: 11, title: "무관 이슈 A", body: "다른 marker 미포함 본문" },
  { number: 22, title: "무관 이슈 B", body: "또 다른 무관 본문" },
]);

// MARKER 를 body 에 포함하는 다수-hit stdout — update 분기 유발. number 가 의도적으로
// 정렬되지 않은 순서(33, 7, 19)라 최소 number(7) 선택 멱등 분기를 자극한다.
const MULTI_HIT_STDOUT = JSON.stringify([
  { number: 33, title: "결과 이슈(최신)", body: `누적 본문\n${MARKER}\n끝` },
  { number: 7, title: "결과 이슈(최초)", body: `최초 본문\n${MARKER}\n끝` },
  { number: 19, title: "결과 이슈(중간)", body: `중간 본문\n${MARKER}\n끝` },
]);

describe("Smoke(non-gated): 실 평가 e2e result-issue gh-command-plan 조립 체인(stdout→hits→action→argv) live-gh 0 검증", () => {
  describe("happy path — 조립된 gh 실행 plan({action, argv}) 산출", () => {
    it("후보 0건 stdout('[]') + 유효 commandArgs → plan.action.action === 'create' + plan.argv 가 ['issue','create',...] shape(첫 두 토큰 'issue'/'create')", () => {
      const plan = resolveRealDataResultIssueGhCommandPlan(
        EMPTY_STDOUT,
        validCommandArgs(),
      );

      expect(plan.action.action).toBe("create");
      expect(Array.isArray(plan.argv)).toBe(true);
      expect(plan.argv[0]).toBe("issue");
      expect(plan.argv[1]).toBe("create");
      // create argv 는 --title/--body 페어를 포함한다(인자 분리 정합).
      expect(plan.argv).toContain("--title");
      expect(plan.argv).toContain("--body");
    });

    it("marker 포함 다수-hit stdout + 유효 commandArgs → plan.action.action === 'update' + plan.action.issueNumber === 최소 number(7) + plan.argv 가 ['issue','edit',String(issueNumber),...] shape", () => {
      const plan = resolveRealDataResultIssueGhCommandPlan(
        MULTI_HIT_STDOUT,
        validCommandArgs(),
      );

      expect(plan.action.action).toBe("update");
      // discriminated union narrow — update 분기에서만 issueNumber 접근.
      if (plan.action.action !== "update") {
        throw new Error("update action 기대");
      }
      expect(plan.action.issueNumber).toBe(7);

      expect(plan.argv[0]).toBe("issue");
      expect(plan.argv[1]).toBe("edit");
      // edit argv 의 세 번째 토큰은 String(issueNumber).
      expect(plan.argv[2]).toBe("7");
      expect(plan.argv).toContain("--title");
      expect(plan.argv).toContain("--body");
    });
  });

  describe("단일 source 조립 단언 — parse→resolveAction→buildGhArgv 를 commandArgs 단일 source 로 thread", () => {
    it("plan.argv 가 동일 (stdout, commandArgs) 을 buildGhArgv(resolveAction(parse(stdout), searchQuery), commandArgs) 3-위임 직접 재유도한 결과와 deep-equal(create 분기)", () => {
      const commandArgs = validCommandArgs();
      const plan = resolveRealDataResultIssueGhCommandPlan(
        EMPTY_STDOUT,
        commandArgs,
      );

      // 3-위임 직접 재유도(single-source) — 컴포저가 thread 한 결과와 byte-identical.
      const directAction = resolveRealDataResultIssueAction(
        parseRealDataResultIssueSearchOutput(EMPTY_STDOUT),
        commandArgs.searchQuery,
      );
      const directArgv = buildRealDataResultIssueGhArgv(
        directAction,
        commandArgs,
      );

      expect(plan.action).toEqual(directAction);
      expect(plan.argv).toEqual(directArgv);
    });

    it("plan.action / plan.argv 가 3-위임 직접 재유도 결과와 deep-equal(update 분기)", () => {
      const commandArgs = validCommandArgs();
      const plan = resolveRealDataResultIssueGhCommandPlan(
        MULTI_HIT_STDOUT,
        commandArgs,
      );

      const directAction = resolveRealDataResultIssueAction(
        parseRealDataResultIssueSearchOutput(MULTI_HIT_STDOUT),
        commandArgs.searchQuery,
      );
      const directArgv = buildRealDataResultIssueGhArgv(
        directAction,
        commandArgs,
      );

      expect(plan.action).toEqual(directAction);
      expect(plan.argv).toEqual(directArgv);
    });

    it("update 분기에서 plan.action.issueNumber 가 hits 의 최소 number(멱등 — 가장 오래된 이슈 갱신)", () => {
      const plan = resolveRealDataResultIssueGhCommandPlan(
        MULTI_HIT_STDOUT,
        validCommandArgs(),
      );

      // 직접 파싱한 hits 의 최소 number 와 일치(33/7/19 중 7).
      const hits = parseRealDataResultIssueSearchOutput(MULTI_HIT_STDOUT);
      const minNumber = Math.min(...hits.map((h) => h.number));
      if (plan.action.action !== "update") {
        throw new Error("update action 기대");
      }
      expect(plan.action.issueNumber).toBe(minNumber);
      expect(plan.action.issueNumber).toBe(7);
    });
  });

  describe("flow / branch — create / update 분기(분기별 분리)", () => {
    it("create 분기 (a) 빈 배열 stdout('[]') → action.create + edit argv 아님(['issue','create',...])", () => {
      const plan = resolveRealDataResultIssueGhCommandPlan(
        EMPTY_STDOUT,
        validCommandArgs(),
      );
      expect(plan.action.action).toBe("create");
      expect(plan.argv[1]).toBe("create");
      expect(plan.argv).not.toContain("edit");
    });

    it("create 분기 (b) marker 미포함 다수-hit stdout → action.create(후보 0건 — body 가 marker 미포함)", () => {
      const plan = resolveRealDataResultIssueGhCommandPlan(
        NO_MARKER_STDOUT,
        validCommandArgs(),
      );
      expect(plan.action.action).toBe("create");
      expect(plan.argv[1]).toBe("create");
    });

    it("update 분기 — marker 포함 다수-hit stdout → action.update + edit argv", () => {
      const plan = resolveRealDataResultIssueGhCommandPlan(
        MULTI_HIT_STDOUT,
        validCommandArgs(),
      );
      expect(plan.action.action).toBe("update");
      expect(plan.argv[1]).toBe("edit");
    });

    it("update 분기 최소 number 선택 — 정렬되지 않은 다수 hit(33,7,19) 중 7 선택", () => {
      const plan = resolveRealDataResultIssueGhCommandPlan(
        MULTI_HIT_STDOUT,
        validCommandArgs(),
      );
      expect(plan.argv[2]).toBe("7");
    });
  });

  describe("negative cases — 위임 helper throw 전파(컴포저 자체 try/catch 0)", () => {
    it("(a) 비JSON stdout('not-json') → 파서 SyntaxError/throw 가 그대로 전파", () => {
      expect(() =>
        resolveRealDataResultIssueGhCommandPlan("not-json", validCommandArgs()),
      ).toThrow();
    });

    it("(b) 비배열 JSON stdout('{\"number\":1}') → 파서 throw 전파", () => {
      expect(() =>
        resolveRealDataResultIssueGhCommandPlan(
          '{"number":1}',
          validCommandArgs(),
        ),
      ).toThrow();
    });

    it("(c) 원소 number 가 비양수 → 파서 throw 전파", () => {
      const stdout = JSON.stringify([{ number: 0, title: "t", body: "b" }]);
      expect(() =>
        resolveRealDataResultIssueGhCommandPlan(stdout, validCommandArgs()),
      ).toThrow();
    });

    it("(c') 원소 title 이 비문자열 → 파서 throw 전파", () => {
      const stdout = JSON.stringify([{ number: 1, title: 123, body: "b" }]);
      expect(() =>
        resolveRealDataResultIssueGhCommandPlan(stdout, validCommandArgs()),
      ).toThrow();
    });

    it("(c'') 원소 body 가 비문자열 → 파서 throw 전파", () => {
      const stdout = JSON.stringify([{ number: 1, title: "t", body: null }]);
      expect(() =>
        resolveRealDataResultIssueGhCommandPlan(stdout, validCommandArgs()),
      ).toThrow();
    });

    it("(d) commandArgs.searchQuery 빈 문자열 → action resolver throw 전파", () => {
      const commandArgs = validCommandArgs();
      commandArgs.searchQuery = "";
      expect(() =>
        resolveRealDataResultIssueGhCommandPlan(EMPTY_STDOUT, commandArgs),
      ).toThrow();
    });

    it("(e) commandArgs.searchQuery 공백만 → resolver throw 전파", () => {
      const commandArgs = validCommandArgs();
      commandArgs.searchQuery = "   ";
      expect(() =>
        resolveRealDataResultIssueGhCommandPlan(EMPTY_STDOUT, commandArgs),
      ).toThrow();
    });

    it("(f) create 분기에서 createArgs.title 빈 문자열 → gh-argv 빌더 throw 전파", () => {
      const commandArgs = validCommandArgs();
      commandArgs.createArgs.title = "";
      expect(() =>
        resolveRealDataResultIssueGhCommandPlan(EMPTY_STDOUT, commandArgs),
      ).toThrow();
    });

    it("(f') create 분기에서 createArgs.body 공백만 → 빌더 throw 전파", () => {
      const commandArgs = validCommandArgs();
      commandArgs.createArgs.body = "   ";
      expect(() =>
        resolveRealDataResultIssueGhCommandPlan(EMPTY_STDOUT, commandArgs),
      ).toThrow();
    });

    it("(g) update 분기에서 updateArgs.title 빈 문자열 → 빌더 throw 전파", () => {
      const commandArgs = validCommandArgs();
      commandArgs.updateArgs.title = "";
      expect(() =>
        resolveRealDataResultIssueGhCommandPlan(MULTI_HIT_STDOUT, commandArgs),
      ).toThrow();
    });

    it("(g') update 분기에서 updateArgs.body 공백만 → 빌더 throw 전파", () => {
      const commandArgs = validCommandArgs();
      commandArgs.updateArgs.body = "   ";
      expect(() =>
        resolveRealDataResultIssueGhCommandPlan(MULTI_HIT_STDOUT, commandArgs),
      ).toThrow();
    });
  });

  describe("credential 누출 0 — 산출 argv 에 token/secret 어휘 미포함", () => {
    it("(h-create) create 분기 argv 어디에도 token/secret 어휘(--token/GITHUB_TOKEN/ghp_) 미등장(fixture 미주입)", () => {
      const plan = resolveRealDataResultIssueGhCommandPlan(
        EMPTY_STDOUT,
        validCommandArgs(),
      );
      const joined = plan.argv.join(" ");
      expect(joined).not.toContain("--token");
      expect(joined).not.toContain("GITHUB_TOKEN");
      expect(joined).not.toMatch(/ghp_[A-Za-z0-9]/);
    });

    it("(h-update) update 분기 argv 어디에도 token/secret 어휘 미등장", () => {
      const plan = resolveRealDataResultIssueGhCommandPlan(
        MULTI_HIT_STDOUT,
        validCommandArgs(),
      );
      const joined = plan.argv.join(" ");
      expect(joined).not.toContain("--token");
      expect(joined).not.toContain("GITHUB_TOKEN");
      expect(joined).not.toMatch(/ghp_[A-Za-z0-9]/);
    });
  });

  describe("결정론 · 무공유 — 동일 (stdout, commandArgs) 두 번 호출 + 입력 불변", () => {
    it("(i-create) create 분기 두 호출 deep-equal + 매 호출 새 plan/argv 객체(참조 비동일)", () => {
      const commandArgs = validCommandArgs();
      const a = resolveRealDataResultIssueGhCommandPlan(
        EMPTY_STDOUT,
        commandArgs,
      );
      const b = resolveRealDataResultIssueGhCommandPlan(
        EMPTY_STDOUT,
        commandArgs,
      );

      expect(a).toEqual(b);
      expect(a).not.toBe(b);
      expect(a.argv).not.toBe(b.argv);
    });

    it("(i-update) update 분기 두 호출 deep-equal + 참조 비동일", () => {
      const commandArgs = validCommandArgs();
      const a = resolveRealDataResultIssueGhCommandPlan(
        MULTI_HIT_STDOUT,
        commandArgs,
      );
      const b = resolveRealDataResultIssueGhCommandPlan(
        MULTI_HIT_STDOUT,
        commandArgs,
      );

      expect(a).toEqual(b);
      expect(a).not.toBe(b);
      expect(a.argv).not.toBe(b.argv);
    });

    it("(j) 입력 stdout(문자열 불변) · commandArgs 객체 · 중첩 createArgs.labels mutate 0(호출 전후 deep-equal)", () => {
      const commandArgs = validCommandArgs();
      const commandArgsBefore = JSON.parse(JSON.stringify(commandArgs));

      resolveRealDataResultIssueGhCommandPlan(MULTI_HIT_STDOUT, commandArgs);

      // 호출 후 입력 commandArgs(중첩 createArgs.labels 포함)가 동형(무공유 보존).
      expect(commandArgs).toEqual(commandArgsBefore);
      expect(commandArgs.createArgs.labels).toEqual(
        commandArgsBefore.createArgs.labels,
      );
    });
  });
});
