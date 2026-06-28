// realdata-e2e-command-args-search-gh-argv-assembly.smoke-spec.ts — 실 평가 e2e
// result-issue search-argv leg 조립 체인 non-gated build-time smoke (T-0746 박제,
// PLAN.md 109행 🟢 실 평가 e2e).
//
// 본 spec 의 존재 이유 — public CI gap 해소(publish triad 3-leg 직접-체인 smoke 종결):
//   - PLAN 109행 step ④(결과 이슈 박제) build-time 순수 layer 의 **search-argv leg** 는
//     두 컴포저가 직렬로 닫는다 — (1) `buildRealDataResultIssueCommandArgs(descriptor)`
//     (T-0583) 가 결과 이슈 descriptor 를 멱등 search-or-update 명령-args 묶음
//     (`RealDataResultIssueCommandArgs` {searchQuery, createArgs, updateArgs})으로
//     변환하고, (2) `buildRealDataResultIssueSearchGhArgv(commandArgs)`(T-0586) 가 그
//     `searchQuery` 를 받아 실 `gh search issues` 호출에 그대로 넘길 인자-벡터
//     (`["search","issues","--match","body",searchQuery,"--json","number,title,body",
//     "--limit","30"]`, `gh` 실행 파일명 제외)를 산출한다.
//   - publish triad(결과 이슈 박제 3-leg {report, commandArgs, searchArgv})의 다른 두
//     leg 는 이미 직접 2-컴포저 chain smoke 로 닫혀 있다 — report leg 은
//     realdata-e2e-result-report-plan-assembly.smoke-spec.ts(T-0740), commandArgs leg 은
//     realdata-e2e-result-issue-command-plan-assembly.smoke-spec.ts(T-0741) +
//     realdata-e2e-result-issue-gh-command-plan-assembly.smoke-spec.ts(T-0742). 그러나
//     **search-argv leg(descriptor→command-args→search-gh-argv)를 직접 chain 으로 묶은
//     non-gated build-time smoke 는 부재**였다(`git grep buildRealDataResultIssueSearchGhArgv
//     test/smoke/` = NONE — 직접 chain smoke 파일 부재, 컴포저 unit + consistency spec 만
//     존재 확인). 기존 realdata-e2e-result-issue-publish-assembly.smoke-spec.ts(T-0729)는
//     aggregator `buildRealDataResultIssuePublishPlan(results, run)` 진입으로만 검증할 뿐,
//     `descriptor → commandArgs → searchArgv` 중간 변환 산출(searchQuery=marker 전파·argv
//     동사 prefix·`--match body`·`--json` 필드 정합·`--limit` 값·searchQuery 단일 argv
//     원소 인젝션-안전)을 두 helper 의 직접 chain 으로 묶은 단언은 0 이었다.
//   - 본 spec 은 그 gap 을 메운다 — **gating 없이 항상 실행되는 일반 describe** 로
//     descriptor→command-args→search-gh-argv 종단 조립 surface 를 검증한다. live leg
//     (실 gh 호출 / `execFile('gh', argv)` / `gh search issues` 실 실행 / 실 이슈
//     search·create·edit / 실 네트워크 / 실 LLM / Ollama / DB / 실 jest spawn)는
//     복제하지 않고, synthetic `RealDataResultIssueDescriptor` literal 을 컴포저에 직접
//     공급해 live leg 를 우회한다(조립 surface 만 검증). 따라서 본 spec 은:
//
//      🔥 실 gh 호출 0 — gh search / create / edit / execFile('gh', argv) 미실행.
//         synthetic descriptor literal 을 컴포저에 직접 공급.
//      🔥 실 네트워크 호출 0 — github / Ollama / gh 호출 0. fetch 0. process.env 읽기 0.
//      🔥 실 LLM 호출 0 / 실 DB 접근 0 / 실 jest spawn 0 — descriptor→commandArgs→argv 조립만.
//      🔥 credential 0 / secret 0 / 비용 0 — public CI 에서 항상 green 발화(R-113).
//         산출 argv 에 token/secret/raw narrative 어휘 미주입·미포함 검증.
//      🔥 새 외부 dependency 0 — 기존 build* 컴포저 import 재사용만(consistency-guard
//         신설 금지 — sweep 종결, T-0726).
//      🔥 gating / describe.skip 배선 0 — 순수 build-time in-memory 검증만.
//
// Out of Scope (T-0746):
//   - 기존 realdata-e2e-result-issue-publish-assembly.smoke-spec.ts(T-0729, aggregator
//     `buildRealDataResultIssuePublishPlan` 진입) 재검증 — 본 task 는 그 aggregator 아래
//     command-args→search-gh-argv search-argv leg 직접 chain 만 책임(중복·재검증 0).
//   - 기존 result-issue-command-plan / gh-command-plan / report-plan 조립 smoke 수정 —
//     본 task 는 search-argv leg 만, 별개 절단면(file-disjoint 병렬 stream).
//   - 실 gh search 실행 / `execFile('gh', searchArgv)` / gh search response JSON 파싱 /
//     `RealDataResultIssueSearchHit[]` 산출 / 실 이슈 search·create·edit / 실 네트워크 /
//     DB 접근 / 실 jest spawn.
//   - create/edit argv 합성(buildRealDataResultIssueGhArgv, T-0742 cover) / action
//     resolver 분기(resolveRealDataResultIssueAction, T-0742 cover) / `--repo`·repo slug·
//     gh auth wiring — 본 task 는 search argv 합성 surface 만.
//   - 컴포저 소스 / 위임 consistency 가드 / descriptor 컴포저 수정 — test-only(신규
//     smoke spec 1 파일). 새 컴포저 / 가드 / helper 신설 0 — 기존 import 재사용만.
//   - production src/ 코드 / package.json / test/jest-smoke.json 변경.
import { buildRealDataResultIssueCommandArgs } from "../helpers/realdata-e2e-result-issue-command-args";
import type { RealDataResultIssueDescriptor } from "../helpers/realdata-e2e-result-issue-descriptor";
import {
  buildRealDataResultIssueSearchGhArgv,
  REAL_DATA_RESULT_ISSUE_SEARCH_JSON_FIELDS,
  REAL_DATA_RESULT_ISSUE_SEARCH_LIMIT,
} from "../helpers/realdata-e2e-result-issue-search-argv";

// 결정론 멱등 marker — descriptor.marker 이자, 산출 search argv 의 searchQuery 위치
// 원소. 비공백 안정 토큰이라 marker 빈/공백 guard 를 자극하지 않으며, token/secret/raw
// narrative 어휘를 포함하지 않는다(credential 누출 0 단언의 fixture 전제).
const MARKER = "<!-- realdata-e2e-result-issue: 2026-06-28@abc1234 -->";

// 산출 search argv 의 canonical shape — 두 helper 직접 chain 의 deep-equal 대조 source.
// searchQuery 위치(index 4)에만 descriptor.marker 가 들어가고, 나머지는 고정 토큰.
const EXPECTED_ARGV: string[] = [
  "search",
  "issues",
  "--match",
  "body",
  MARKER,
  "--json",
  REAL_DATA_RESULT_ISSUE_SEARCH_JSON_FIELDS,
  "--limit",
  REAL_DATA_RESULT_ISSUE_SEARCH_LIMIT,
];

// 유효 descriptor fixture 헬퍼 — title / marker / body 전부 non-blank. body 의 첫
// 라인은 항상 marker 와 일치하도록 합성한다(실 빌더 buildRealDataResultIssueDescriptor
// 의 marker-first body 형상과 동형 — command-args 의 body-marker self-wire 가드 충족).
// 매 it 가 새 객체를 받아 입력 mutate 가 누설되지 않도록 한다. marker override 시
// body 도 그 marker 를 첫 라인으로 재합성해 정합을 유지한다(단, body override 가
// 명시되면 그 값을 우선).
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

// 두 helper 직접 chain — descriptor → commandArgs → search argv. 본 spec 의 검증
// 대상 종단 조립 경로(자체 try/catch 0 — guard throw 는 그대로 전파).
function chain(descriptor: RealDataResultIssueDescriptor): string[] {
  return buildRealDataResultIssueSearchGhArgv(
    buildRealDataResultIssueCommandArgs(descriptor),
  );
}

describe("Smoke(non-gated): 실 평가 e2e result-issue search-argv leg 조립 체인(descriptor→command-args→search-gh-argv) live-gh 0 검증", () => {
  describe("happy path — 조립된 search argv 산출", () => {
    it("(a) 산출 argv 가 배열·정확히 9 원소·동사 prefix ['search','issues'] 로 시작", () => {
      const argv = chain(validDescriptor());

      expect(Array.isArray(argv)).toBe(true);
      expect(argv).toHaveLength(9);
      expect(argv[0]).toBe("search");
      expect(argv[1]).toBe("issues");
    });

    it("(b) argv 가 canonical shape(['search','issues','--match','body',marker,'--json','number,title,body','--limit','30'])와 deep-equal", () => {
      const argv = chain(validDescriptor());
      expect(argv).toEqual(EXPECTED_ARGV);
    });

    it("(c) argv 의 searchQuery 위치 원소(index 4)가 commandArgs.searchQuery(=descriptor.marker)와 동일하고 단일 argv 원소로 유지", () => {
      const descriptor = validDescriptor();
      const commandArgs = buildRealDataResultIssueCommandArgs(descriptor);
      const argv = buildRealDataResultIssueSearchGhArgv(commandArgs);

      expect(argv[4]).toBe(commandArgs.searchQuery);
      expect(argv[4]).toBe(descriptor.marker);
      // 단일 원소 — marker 가 split 되지 않고 정확히 1 슬롯만 차지(공백 포함에도).
      expect(argv.filter((token) => token === descriptor.marker)).toHaveLength(
        1,
      );
    });
  });

  describe("단일 source 조립 단언 — searchQuery 단일 source 전파(재합성 0)", () => {
    it("buildRealDataResultIssueSearchGhArgv(buildRealDataResultIssueCommandArgs(descriptor))[4] 가 commandArgs.searchQuery(=descriptor.marker)와 동일", () => {
      const descriptor = validDescriptor();
      const commandArgs = buildRealDataResultIssueCommandArgs(descriptor);

      const argv4 = buildRealDataResultIssueSearchGhArgv(commandArgs)[4];

      expect(argv4).toBe(commandArgs.searchQuery);
      expect(argv4).toBe(descriptor.marker);
    });

    it("argv 가 commandArgs.createArgs / updateArgs 의 값(title/body/labels)을 일절 포함하지 않음(search-argv 는 searchQuery 단일 의존)", () => {
      const descriptor = validDescriptor();
      const commandArgs = buildRealDataResultIssueCommandArgs(descriptor);
      const argv = buildRealDataResultIssueSearchGhArgv(commandArgs);

      // title / body / labels 어느 값도 argv 에 누출되지 않는다(searchQuery 만 의존).
      expect(argv).not.toContain(commandArgs.createArgs.title);
      expect(argv).not.toContain(commandArgs.createArgs.body);
      expect(argv).not.toContain(commandArgs.updateArgs.title);
      expect(argv).not.toContain(commandArgs.updateArgs.body);
      for (const label of commandArgs.createArgs.labels) {
        expect(argv).not.toContain(label);
      }
    });
  });

  describe("negative cases — command-args 단계 guard throw 가 조립 경로로 그대로 전파(자체 try/catch 0)", () => {
    it("(a) descriptor.marker 빈 문자열 → command-args marker guard throw 전파", () => {
      expect(() => chain(validDescriptor({ marker: "" }))).toThrow();
    });

    it("(b) descriptor.marker 공백만 → throw 전파", () => {
      expect(() => chain(validDescriptor({ marker: "   " }))).toThrow();
    });

    it("(c) descriptor.title 빈 문자열 → command-args 단계 title guard 선평가 throw 전파(marker 유효해도)", () => {
      // marker 는 유효한데 title 만 빈 경우 — title guard 가 선평가되어 throw.
      expect(() => chain(validDescriptor({ title: "" }))).toThrow();
    });

    it("(c') descriptor.title 공백만 → title guard 선평가 throw 전파", () => {
      expect(() => chain(validDescriptor({ title: "   " }))).toThrow();
    });
  });

  describe("flow / branch — credential 누출 0 · 인젝션-안전 · 고정 토큰(분기마다 분리)", () => {
    it("(a) credential / raw 본문 누출 0 — argv 어느 원소에도 token/secret/raw narrative 패턴 미포함", () => {
      const argv = chain(validDescriptor());
      const joined = argv.join(" ");

      expect(joined).not.toContain("--token");
      expect(joined).not.toContain("GITHUB_TOKEN");
      expect(joined).not.toMatch(/ghp_[A-Za-z0-9]/);
      // raw narrative 누출 0 — argv 는 searchQuery=marker 안정 토큰만(§9 정합).
      expect(joined).not.toContain("narrative");
    });

    it("(b) 인젝션-안전 — marker 에 공백·특수문자('x; rm -rf /')가 들어가도 argv 단일 원소로 보존(argv 길이 9 불변)", () => {
      const dangerousMarker = "x; rm -rf /";
      const descriptor = validDescriptor({ marker: dangerousMarker });
      const argv = chain(descriptor);

      // shell 미경유 — 특수문자 marker 도 split 없이 단일 argv 원소(index 4)로 보존.
      expect(argv).toHaveLength(9);
      expect(argv[4]).toBe(dangerousMarker);
      expect(argv.filter((token) => token === dangerousMarker)).toHaveLength(1);
    });

    it("(c) --json 필드가 'number,title,body' 고정 · --limit 가 '30' 고정", () => {
      const argv = chain(validDescriptor());

      const jsonIdx = argv.indexOf("--json");
      const limitIdx = argv.indexOf("--limit");
      expect(jsonIdx).toBeGreaterThan(-1);
      expect(limitIdx).toBeGreaterThan(-1);
      expect(argv[jsonIdx + 1]).toBe("number,title,body");
      expect(argv[limitIdx + 1]).toBe("30");
      // named 상수와도 정합(매직 스트링 drift 차단).
      expect(argv[jsonIdx + 1]).toBe(REAL_DATA_RESULT_ISSUE_SEARCH_JSON_FIELDS);
      expect(argv[limitIdx + 1]).toBe(REAL_DATA_RESULT_ISSUE_SEARCH_LIMIT);
    });

    // 본문 메모: search-gh-argv 는 create/update 분기 없는 단일 반환 — 분기 cover 는
    // command-args 단계 guard(marker/title) 와 위 인젝션·고정-토큰 surface 로 닫힌다.
  });

  describe("결정론 · 무공유 — 동일 descriptor 두 번 chain + 입력 불변", () => {
    it("(d) 두 chain 호출 deep-equal argv + 매 호출 새 배열 객체(반환 argv 참조 비동일)", () => {
      const descriptor = validDescriptor();
      const a = chain(descriptor);
      const b = chain(descriptor);

      expect(a).toEqual(b);
      expect(a).not.toBe(b);
    });

    it("(e) no-mutation — 입력 descriptor 객체가 chain 호출 전후 deep-equal(mutate 0)", () => {
      const descriptor = validDescriptor();
      const before = JSON.parse(JSON.stringify(descriptor));

      chain(descriptor);

      expect(descriptor).toEqual(before);
    });
  });
});
