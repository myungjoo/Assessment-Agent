// realdata-e2e-search-resolve-roundtrip-convergence-assembly.smoke-spec.ts —
// 실 평가 e2e result-issue search-then-resolve 멱등 round-trip dual-leg 수렴 조립 체인
// non-gated build-time smoke (T-0758 박제, PLAN.md 109행 🟢 실 평가 e2e step ④).
//
// 본 spec 의 존재 이유 — public CI gap 해소(search leg ↔ resolve leg cross-leg 정합):
//   - PLAN 109행 step ④(결과 이슈 박제)의 멱등 search-or-update 정책은 **두 leg 가 동일
//     `commandArgs` 를 단일 source 로 공유**할 때만 성립한다 — (1) search leg
//     `buildRealDataResultIssueSearchGhArgv(commandArgs)`(T-0586) 가
//     `commandArgs.searchQuery`(= descriptor.marker) 로 gh issue search argv 를 합성하고,
//     (2) resolve leg `resolveRealDataResultIssueGhCommandPlan(stdout, commandArgs)`
//     (T-0588) 가 gh search 결과(stdout)를 받아 `{action, argv}`(create/update 분기 + gh
//     실행 argv)로 투영한다. 두 leg 가 **같은 `commandArgs.searchQuery` 단일 source** 로
//     수렴해야 — search 가 argv 에 박은 marker 와 resolve 가 후보 매칭·update argv 에 쓰는
//     marker 가 byte-identical — 멱등 search-or-update(동일 run 이면 갱신, 새 run 이면
//     생성)가 깨지지 않는다.
//   - 기존 sweep 은 두 leg 를 **각각 따로** 닫았다: search leg 는 T-0746
//     (descriptor→command-args→search-gh-argv 단일 source chain), resolve leg 는 T-0742
//     (stdout→hits→action→argv 3-위임 직접 재유도 deep-equal). 그러나 **두 leg 를 동일
//     `commandArgs` 단일 source 로 묶어 round-trip 수렴**(search argv 가 쓴 marker =
//     resolve 가 매칭에 쓰는 searchQuery = update argv 가 박는 marker)을 박제한 smoke 는
//     NONE 이었다(`git grep`: SearchGhArgv|searchArgv AND
//     resolveRealDataResultIssueGhCommandPlan|GhCommandPlan 동시 포함 = 0 파일).
//   - 본 spec 은 그 gap 을 메운다 — **gating 없이 항상 실행되는 일반 describe** 로
//     descriptor 단일 source 로부터 두 leg 가 같은 `commandArgs.searchQuery` 로 수렴하는
//     cross-leg 정합(round-trip marker 단일 source 일치·create/update 분기·partial-thread
//     격리·throw 전파)만 검증한다. live leg(실 gh issue search·create·edit /
//     `execFile('gh', argv)` 실 실행 / 실 github 네트워크 / 실 LLM / Ollama / DB / 실 jest
//     spawn)는 복제하지 않고, synthetic descriptor / stdout literal 을 컴포저에 직접 공급해
//     live leg 를 우회한다(조립 surface 만 검증). 따라서 본 spec 은:
//
//      🔥 실 gh 호출 0 — gh search / create / edit / execFile('gh', argv) 미실행.
//         synthetic descriptor·stdout literal 을 두 leg 컴포저에 직접 공급.
//      🔥 실 네트워크 호출 0 — github / Ollama / gh 호출 0. fetch 0. process.env 읽기 0.
//      🔥 실 LLM 호출 0 / 실 DB 접근 0 / 실 jest spawn 0 — 두 leg 수렴 조립만.
//      🔥 credential 0 / secret 0 / 비용 0 — public CI 에서 항상 green 발화(R-113).
//         두 leg 산출 argv 어디에도 token/secret 어휘 미주입·미포함 검증.
//      🔥 새 외부 dependency 0 — 기존 build*/resolve* 컴포저 import 재사용만(가드 신설 0).
//      🔥 gating / describe.skip 배선 0 — 순수 build-time in-memory 검증만.
//
// Out of Scope (T-0758):
//   - search leg 자체의 canonical argv shape 전수 재단언(T-0746 cover — 본 task 는
//     round-trip marker 단일 source 수렴만, search argv 의 fixed 토큰 전체 재검증 금지).
//   - resolve leg 자체의 3-위임 직접 재유도 deep-equal 재단언(T-0742 cover — 본 task 는
//     두 leg 가 동일 source 로 수렴하는 cross-leg 정합만).
//   - 상위 plan(command-plan T-0741 / publish-plan T-0755 / gh-command-plan T-0742)
//     convergence 재단언(이미 cover).
//   - 실 github 네트워크 fetch / 실 gh 호출 / `execFile('gh', argv)`(search·create·edit) /
//     실 이슈 search·create·edit wiring / 실 LLM round-trip(live leg 복제 0).
//   - gated(DB·credential·LAN) smoke leg 추가 — 본 task 는 non-gated build-time
//     pure-composer smoke 단독.
//   - 컴포저 소스 / 위임 consistency 가드 / descriptor 컴포저 수정 — test-only(신규 smoke
//     spec 1 파일). 새 컴포저 / 가드 / helper 신설 0 — 기존 import 재사용만.
//   - production src/ 코드 / package.json / test/jest-smoke.json 변경.
import { buildRealDataResultIssueCommandArgs } from "../helpers/realdata-e2e-result-issue-command-args";
import type { RealDataResultIssueDescriptor } from "../helpers/realdata-e2e-result-issue-descriptor";
import { resolveRealDataResultIssueGhCommandPlan } from "../helpers/realdata-e2e-result-issue-gh-command-plan";
import { buildRealDataResultIssueSearchGhArgv } from "../helpers/realdata-e2e-result-issue-search-argv";

// 결정론 멱등 marker — descriptor.marker. 두 leg 가 공유하는 단일 source 토큰. 비공백
// 안정 토큰이라 marker 빈/공백 guard 를 자극하지 않으며, token/secret/raw narrative
// 어휘를 포함하지 않는다(credential 누출 0 단언의 fixture 전제).
const MARKER = "<!-- realdata-e2e-result-issue: 2026-06-28@abc1234 -->";

// search argv 의 searchQuery 위치 — 빌더가 산출하는 canonical shape
// (["search","issues","--match","body",<marker>,"--json",...,"--limit","30"])에서
// marker 는 `--match body` 직후(index 4)다. 위치 매직 넘버 대신 `--match` 기준 상대
// 추출로 round-trip drift 에 강건하게 marker 를 뽑는다(아래 헬퍼).
function extractSearchMarker(searchArgv: string[]): string {
  const matchIdx = searchArgv.indexOf("--match");
  if (matchIdx < 0) {
    throw new Error(
      "search argv 에 --match 가 없습니다 — round-trip marker 추출 불가",
    );
  }
  // `--match` <field=body> <marker> 순서 — marker 는 field 다음(matchIdx + 2).
  return searchArgv[matchIdx + 2];
}

// 유효 descriptor fixture 헬퍼 — title / marker / body 전부 non-blank. body 첫 라인은
// 항상 marker 와 일치하도록 합성한다(실 빌더 buildRealDataResultIssueDescriptor 의
// marker-first body 형상과 동형 — command-args body-marker self-wire 가드 충족). 매 it 가
// 새 객체를 받아 입력 mutate 가 누설되지 않도록 한다.
function validDescriptor(
  overrides: Partial<RealDataResultIssueDescriptor> = {},
): RealDataResultIssueDescriptor {
  const marker = overrides.marker ?? MARKER;
  return {
    title: "실 평가 e2e 결과 2026-06-28@abc1234",
    marker,
    // body 첫 라인 = marker(marker-first) — command-args body-marker 가드 정합.
    body: `${marker}\n\ncount: 3 · totalVolume: 12`,
    ...overrides,
  };
}

// 후보 0건 stdout — gh search 가 매칭 이슈를 못 찾은 경우(빈 배열). create 분기 유발.
const EMPTY_STDOUT = "[]";

// marker 를 body 에 포함한 hit 1+건 stdout 합성 헬퍼 — 동일 run 이슈가 이미 존재하는
// 경우(update 분기 유발). number 가 의도적으로 비정렬(33, 7, 19)이라 최소 number(7)
// 멱등 선택을 자극한다. body 에 marker 를 박아 resolve 가 후보로 매칭하도록 한다.
function multiHitStdout(marker: string): string {
  return JSON.stringify([
    { number: 33, title: "결과 이슈(최신)", body: `누적 본문\n${marker}\n끝` },
    { number: 7, title: "결과 이슈(최초)", body: `최초 본문\n${marker}\n끝` },
    { number: 19, title: "결과 이슈(중간)", body: `중간 본문\n${marker}\n끝` },
  ]);
}

describe("Smoke(non-gated): 실 평가 e2e search-then-resolve 멱등 round-trip dual-leg(searchArgv·resolve) 동일 commandArgs 단일 source 수렴 검증", () => {
  describe("happy path — 두 leg 모두 정상 산출", () => {
    it("유효 descriptor → commandArgs → search leg(searchArgv: string[]) 와 resolve leg(plan:{action,argv}) 모두 정상 산출", () => {
      const commandArgs =
        buildRealDataResultIssueCommandArgs(validDescriptor());

      const searchArgv = buildRealDataResultIssueSearchGhArgv(commandArgs);
      const plan = resolveRealDataResultIssueGhCommandPlan(
        EMPTY_STDOUT,
        commandArgs,
      );

      // search leg — string[] argv.
      expect(Array.isArray(searchArgv)).toBe(true);
      expect(searchArgv.length).toBeGreaterThan(0);
      // resolve leg — {action, argv}.
      expect(typeof plan.action.action).toBe("string");
      expect(Array.isArray(plan.argv)).toBe(true);
    });
  });

  describe("round-trip 단일 source 수렴(branch — 핵심 불변식)", () => {
    it("search leg 가 argv 에 박은 marker = resolve leg 가 쓰는 commandArgs.searchQuery = descriptor.marker 3자 byte-identical", () => {
      const descriptor = validDescriptor();
      const commandArgs = buildRealDataResultIssueCommandArgs(descriptor);

      const searchArgv = buildRealDataResultIssueSearchGhArgv(commandArgs);
      const searchMarker = extractSearchMarker(searchArgv);

      // 3자 일치 — search 가 쓴 marker = 두 leg 공유 source(searchQuery) = descriptor.marker.
      expect(searchMarker).toBe(commandArgs.searchQuery);
      expect(searchMarker).toBe(descriptor.marker);
      expect(commandArgs.searchQuery).toBe(descriptor.marker);
    });

    it("update 분기에서도 search marker 와 resolve 가 후보 매칭에 쓰는 searchQuery 가 동일 source(둘 다 commandArgs.searchQuery 따름)", () => {
      const descriptor = validDescriptor();
      const commandArgs = buildRealDataResultIssueCommandArgs(descriptor);

      const searchArgv = buildRealDataResultIssueSearchGhArgv(commandArgs);
      // resolve 가 같은 commandArgs(같은 searchQuery)로 multi-hit stdout 을 매칭.
      const plan = resolveRealDataResultIssueGhCommandPlan(
        multiHitStdout(commandArgs.searchQuery),
        commandArgs,
      );

      // 매칭이 성립(update 분기) → search marker = resolve 가 매칭에 쓴 searchQuery 동일 source.
      expect(plan.action.action).toBe("update");
      expect(extractSearchMarker(searchArgv)).toBe(commandArgs.searchQuery);
    });
  });

  describe("search→create round-trip(branch)", () => {
    it("빈 search stdout('[]') → resolve plan.action.action === 'create' AND argv 가 gh issue create argv(createArgs.title/body 포함) + search marker 와 searchQuery 일치", () => {
      const descriptor = validDescriptor();
      const commandArgs = buildRealDataResultIssueCommandArgs(descriptor);

      const searchArgv = buildRealDataResultIssueSearchGhArgv(commandArgs);
      const plan = resolveRealDataResultIssueGhCommandPlan(
        EMPTY_STDOUT,
        commandArgs,
      );

      // 새 run(미존재) → create.
      expect(plan.action.action).toBe("create");
      expect(plan.argv[0]).toBe("issue");
      expect(plan.argv[1]).toBe("create");
      // create argv 에 createArgs.title / body 가 그대로 박힘(인자 분리).
      expect(plan.argv).toContain(commandArgs.createArgs.title);
      expect(plan.argv).toContain(commandArgs.createArgs.body);
      // create 분기에서도 search 가 쓴 marker = resolve 가 받은 searchQuery 동일 source.
      expect(extractSearchMarker(searchArgv)).toBe(commandArgs.searchQuery);
    });
  });

  describe("search→update round-trip(branch — 멱등)", () => {
    it("marker 포함 hit 1+건 stdout → resolve plan.action.action === 'update' AND issueNumber === 최소 hit number(7) AND argv 가 gh issue edit argv(updateArgs.title/body 포함)", () => {
      const descriptor = validDescriptor();
      const commandArgs = buildRealDataResultIssueCommandArgs(descriptor);

      const plan = resolveRealDataResultIssueGhCommandPlan(
        multiHitStdout(commandArgs.searchQuery),
        commandArgs,
      );

      // 동일 run 이미 존재 → update, 최소 number(7) 멱등 선택.
      expect(plan.action.action).toBe("update");
      if (plan.action.action !== "update") {
        throw new Error("update action 기대");
      }
      expect(plan.action.issueNumber).toBe(7);

      expect(plan.argv[0]).toBe("issue");
      expect(plan.argv[1]).toBe("edit");
      expect(plan.argv[2]).toBe("7");
      // edit argv 에 updateArgs.title / body 가 그대로 박힘.
      expect(plan.argv).toContain(commandArgs.updateArgs.title);
      expect(plan.argv).toContain(commandArgs.updateArgs.body);
    });

    it("update argv 가 박는 marker(updateArgs.body 안 marker) = search 가 찾은 marker 동일 source — 멱등 갱신 정합", () => {
      const descriptor = validDescriptor();
      const commandArgs = buildRealDataResultIssueCommandArgs(descriptor);

      const searchArgv = buildRealDataResultIssueSearchGhArgv(commandArgs);
      const plan = resolveRealDataResultIssueGhCommandPlan(
        multiHitStdout(commandArgs.searchQuery),
        commandArgs,
      );

      // updateArgs.body 는 descriptor.body(marker-first) → marker 포함.
      const searchMarker = extractSearchMarker(searchArgv);
      expect(commandArgs.updateArgs.body).toContain(searchMarker);
      // 갱신 후에도 그 marker 로 다시 검색 가능(멱등) — search 가 찾은 marker 가 update
      // argv body 에 보존되어 다음 run 의 search 가 동일 이슈를 재발견.
      expect(plan.argv).toContain(commandArgs.updateArgs.body);
    });
  });

  describe("partial-thread 격리(branch) — 두 leg 가 같은 source 따라 동시 이동(drift 0)", () => {
    it("다른 descriptor.marker → search marker 와 resolve searchQuery 가 함께 동형 변화(한 leg 만 stale marker 쓰면 멱등 깨짐을 회귀 박제)", () => {
      const otherMarker =
        "<!-- realdata-e2e-result-issue: 2026-06-29@def5678 -->";
      const descriptor = validDescriptor({
        marker: otherMarker,
        body: `${otherMarker}\n\ncount: 3 · totalVolume: 12`,
      });
      const commandArgs = buildRealDataResultIssueCommandArgs(descriptor);

      const searchArgv = buildRealDataResultIssueSearchGhArgv(commandArgs);
      // resolve 가 같은(이동한) marker 로 매칭 → update 성립(drift 0).
      const plan = resolveRealDataResultIssueGhCommandPlan(
        multiHitStdout(commandArgs.searchQuery),
        commandArgs,
      );

      // 두 leg 가 함께 새 marker 로 이동 — search marker = searchQuery = 새 marker.
      expect(extractSearchMarker(searchArgv)).toBe(otherMarker);
      expect(commandArgs.searchQuery).toBe(otherMarker);
      // 이동한 marker 로도 매칭 성립(두 leg 동기 이동 → 멱등 보존).
      expect(plan.action.action).toBe("update");
    });

    it("stale marker stdout(다른 marker hit) → 두 leg 가 같은 새 searchQuery 따르므로 후보 0건 → create(한 leg drift 시 잘못 update 되는 회귀 차단)", () => {
      const descriptor = validDescriptor();
      const commandArgs = buildRealDataResultIssueCommandArgs(descriptor);

      // stdout 의 hit body 는 *다른* (stale) marker 만 포함 — 현재 searchQuery 미포함.
      const staleStdout = multiHitStdout("<!-- stale-other-marker -->");
      const plan = resolveRealDataResultIssueGhCommandPlan(
        staleStdout,
        commandArgs,
      );

      // resolve 가 commandArgs.searchQuery 단일 source 로 매칭 → stale hit 은 후보 아님 → create.
      expect(plan.action.action).toBe("create");
      // search leg 도 동일 source 사용(drift 0 확인).
      const searchArgv = buildRealDataResultIssueSearchGhArgv(commandArgs);
      expect(extractSearchMarker(searchArgv)).toBe(commandArgs.searchQuery);
    });
  });

  describe("flow / branch — create vs update 분기 분리(분기마다 별 it)", () => {
    it("후보 0건(빈 stdout) → create 분기 (edit argv 아님)", () => {
      const commandArgs =
        buildRealDataResultIssueCommandArgs(validDescriptor());
      const plan = resolveRealDataResultIssueGhCommandPlan(
        EMPTY_STDOUT,
        commandArgs,
      );
      expect(plan.action.action).toBe("create");
      expect(plan.argv[1]).toBe("create");
      expect(plan.argv).not.toContain("edit");
    });

    it("후보 1+건(marker 포함 stdout) → update 분기 (create argv 아님)", () => {
      const commandArgs =
        buildRealDataResultIssueCommandArgs(validDescriptor());
      const plan = resolveRealDataResultIssueGhCommandPlan(
        multiHitStdout(commandArgs.searchQuery),
        commandArgs,
      );
      expect(plan.action.action).toBe("update");
      expect(plan.argv[1]).toBe("edit");
      expect(plan.argv).not.toContain("create");
    });
  });

  describe("negative cases — 두 leg 모두 guard throw 전파(자체 try/catch 0)", () => {
    it("(a) commandArgs.searchQuery 빈 문자열 → search leg throw 전파", () => {
      const commandArgs =
        buildRealDataResultIssueCommandArgs(validDescriptor());
      commandArgs.searchQuery = "";
      expect(() => buildRealDataResultIssueSearchGhArgv(commandArgs)).toThrow();
    });

    it("(a') commandArgs.searchQuery 빈 문자열 → resolve leg(action resolver 경유) throw 전파", () => {
      const commandArgs =
        buildRealDataResultIssueCommandArgs(validDescriptor());
      commandArgs.searchQuery = "";
      expect(() =>
        resolveRealDataResultIssueGhCommandPlan(EMPTY_STDOUT, commandArgs),
      ).toThrow();
    });

    it("(b) commandArgs.searchQuery 공백-only → search leg throw 전파", () => {
      const commandArgs =
        buildRealDataResultIssueCommandArgs(validDescriptor());
      commandArgs.searchQuery = "   ";
      expect(() => buildRealDataResultIssueSearchGhArgv(commandArgs)).toThrow();
    });

    it("(b') commandArgs.searchQuery 공백-only → resolve leg throw 전파", () => {
      const commandArgs =
        buildRealDataResultIssueCommandArgs(validDescriptor());
      commandArgs.searchQuery = "   ";
      expect(() =>
        resolveRealDataResultIssueGhCommandPlan(EMPTY_STDOUT, commandArgs),
      ).toThrow();
    });

    it("(c) resolve leg 비JSON stdout('not-json') → parse 단계 throw 전파", () => {
      const commandArgs =
        buildRealDataResultIssueCommandArgs(validDescriptor());
      expect(() =>
        resolveRealDataResultIssueGhCommandPlan("not-json", commandArgs),
      ).toThrow();
    });

    it("(d) resolve leg 비배열 JSON('{}') → parse throw 전파", () => {
      const commandArgs =
        buildRealDataResultIssueCommandArgs(validDescriptor());
      expect(() =>
        resolveRealDataResultIssueGhCommandPlan("{}", commandArgs),
      ).toThrow();
    });

    it("(e) resolve leg hit number 비양수(0) → parse throw 전파", () => {
      const commandArgs =
        buildRealDataResultIssueCommandArgs(validDescriptor());
      const stdout = JSON.stringify([{ number: 0, title: "t", body: "b" }]);
      expect(() =>
        resolveRealDataResultIssueGhCommandPlan(stdout, commandArgs),
      ).toThrow();
    });

    it("(e') resolve leg hit number 음수(-1) → parse throw 전파", () => {
      const commandArgs =
        buildRealDataResultIssueCommandArgs(validDescriptor());
      const stdout = JSON.stringify([{ number: -1, title: "t", body: "b" }]);
      expect(() =>
        resolveRealDataResultIssueGhCommandPlan(stdout, commandArgs),
      ).toThrow();
    });

    it("(f) update 분기 updateArgs.title 빈 문자열 → buildGhArgv throw 전파", () => {
      const commandArgs =
        buildRealDataResultIssueCommandArgs(validDescriptor());
      commandArgs.updateArgs.title = "";
      expect(() =>
        resolveRealDataResultIssueGhCommandPlan(
          multiHitStdout(commandArgs.searchQuery),
          commandArgs,
        ),
      ).toThrow();
    });

    it("(f') update 분기 updateArgs.body 공백-only → buildGhArgv throw 전파", () => {
      const commandArgs =
        buildRealDataResultIssueCommandArgs(validDescriptor());
      commandArgs.updateArgs.body = "   ";
      expect(() =>
        resolveRealDataResultIssueGhCommandPlan(
          multiHitStdout(commandArgs.searchQuery),
          commandArgs,
        ),
      ).toThrow();
    });
  });

  describe("credential 누출 0(branch) — 두 leg argv 어디에도 token/secret 어휘 미포함", () => {
    it("search argv · resolve argv(create/update) 어느 쪽에도 token/secret/PAT 어휘(--token/GITHUB_TOKEN/ghp_/--auth) 미등장(§9 정합)", () => {
      const commandArgs =
        buildRealDataResultIssueCommandArgs(validDescriptor());

      const searchArgv = buildRealDataResultIssueSearchGhArgv(commandArgs);
      const createPlan = resolveRealDataResultIssueGhCommandPlan(
        EMPTY_STDOUT,
        commandArgs,
      );
      const updatePlan = resolveRealDataResultIssueGhCommandPlan(
        multiHitStdout(commandArgs.searchQuery),
        commandArgs,
      );

      for (const joined of [
        searchArgv.join(" "),
        createPlan.argv.join(" "),
        updatePlan.argv.join(" "),
      ]) {
        expect(joined).not.toContain("--token");
        expect(joined).not.toContain("GITHUB_TOKEN");
        expect(joined).not.toContain("--auth");
        expect(joined).not.toMatch(/ghp_[A-Za-z0-9]/);
      }
    });
  });

  describe("결정론 · 무공유 · no-mutation — 두 leg 각각 두 번 호출 + 입력 불변", () => {
    it("(g) search leg 두 호출 deep-equal + 새 배열 객체(참조 비동일)", () => {
      const commandArgs =
        buildRealDataResultIssueCommandArgs(validDescriptor());
      const a = buildRealDataResultIssueSearchGhArgv(commandArgs);
      const b = buildRealDataResultIssueSearchGhArgv(commandArgs);
      expect(a).toEqual(b);
      expect(a).not.toBe(b);
    });

    it("(h) resolve leg 두 호출 deep-equal + 새 plan/argv 객체(참조 비동일)", () => {
      const commandArgs =
        buildRealDataResultIssueCommandArgs(validDescriptor());
      const stdout = multiHitStdout(commandArgs.searchQuery);
      const a = resolveRealDataResultIssueGhCommandPlan(stdout, commandArgs);
      const b = resolveRealDataResultIssueGhCommandPlan(stdout, commandArgs);
      expect(a).toEqual(b);
      expect(a).not.toBe(b);
      expect(a.argv).not.toBe(b.argv);
    });

    it("(i) no-mutation — 입력 descriptor / commandArgs(중첩 createArgs.labels 포함) / stdout(문자열 불변)이 두 leg 호출 전후 deep-equal", () => {
      const descriptor = validDescriptor();
      const descriptorBefore = JSON.parse(JSON.stringify(descriptor));
      const commandArgs = buildRealDataResultIssueCommandArgs(descriptor);
      const commandArgsBefore = JSON.parse(JSON.stringify(commandArgs));
      const stdout = multiHitStdout(commandArgs.searchQuery);
      const stdoutBefore = stdout;

      buildRealDataResultIssueSearchGhArgv(commandArgs);
      resolveRealDataResultIssueGhCommandPlan(stdout, commandArgs);

      expect(descriptor).toEqual(descriptorBefore);
      expect(commandArgs).toEqual(commandArgsBefore);
      expect(commandArgs.createArgs.labels).toEqual(
        commandArgsBefore.createArgs.labels,
      );
      // stdout 문자열 불변(string 은 immutable 이나 참조 동일성으로 미교체 확인).
      expect(stdout).toBe(stdoutBefore);
    });
  });
});
