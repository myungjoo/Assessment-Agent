// realdata-e2e-command-args-tri-leg-descriptor-convergence-assembly.smoke-spec.ts —
// 실 평가 e2e 결과 이슈의 **최내곽 descriptor→command-args 투영** 컴포저
// `buildRealDataResultIssueCommandArgs(descriptor)` 의 **tri-leg(searchQuery·createArgs·
// updateArgs) single-source descriptor convergence** non-gated build-time smoke
// (T-0757 박제, PLAN.md 109행 🟢 실 평가 e2e step ④).
//
// 본 spec 의 존재 이유 — public CI gap 해소(상위 plan 들이 소비하는 command-args
// 자체의 절단면):
//   - step ④(결과 이슈 박제) 의 최내곽 투영 컴포저
//     `buildRealDataResultIssueCommandArgs(descriptor)`(T-0583 + body-marker/labels-title
//     self-wire) 는 단일 `RealDataResultIssueDescriptor` 입력으로부터 **세 leg 를 동시
//     수렴**시킨다:
//       (1) searchQuery leg — descriptor.marker 를 그대로 전파(동일 run 검색 토큰).
//       (2) createArgs leg — {title, body, labels}({descriptor.title, descriptor.body,
//           고정 RESULT_ISSUE_LABELS 복제}).
//       (3) updateArgs leg — {title, body}({descriptor.title, descriptor.body}).
//   - 세 leg 는 별도 sub-컴포저 위임이 아니라 **단일 descriptor 의 inline 투영**이며,
//     멱등 search-or-update 정합을 위해 cross-leg 불변식 — searchQuery === descriptor.marker,
//     createArgs.title === updateArgs.title === descriptor.title, createArgs.body ===
//     updateArgs.body === descriptor.body, createArgs.labels === 고정 RESULT_ISSUE_LABELS
//     복제 — 를 유지해야 한다.
//   - 그러나 이 tri-leg single-source descriptor convergence 를 **직접-체인으로 묶은
//     non-gated build-time smoke 는 부재**다. 기존 unit spec
//     (realdata-e2e-result-issue-command-args.spec.ts)·consistency 가드(body-marker
//     T-0649·labels-title T-0651)는 cross-leg 불변식을 unit 레벨(`pnpm test`)에서만 단언하고,
//     search-gh-argv smoke(T-0746)는 search-argv leg chain 에 초점이 있어 searchQuery 만
//     downstream 으로 thread 할 뿐 createArgs/updateArgs leg 의 descriptor 단일 source
//     정합(title/body 3 자 일치 + labels 고정상수 복제 + 무공유)을 tri-leg convergence 로
//     묶지 않는다. T-0755(publish-plan tri-leg)·T-0741(command-plan)·T-0742(gh-command-plan)
//     은 **상위 plan 컴포저**의 leg convergence 이고, 본 spec 은 그 **아래 최내곽 투영
//     layer** 의 single-source convergence 를 박제한다(상위 plan 들이 소비하는 command-args
//     자체가 단일 descriptor 로부터 세 leg 로 일관 수렴함을 public CI 그물로 외화).
//   - 본 spec 은 그 gap 을 정확히 메운다 — **gating 없이 항상 실행되는 일반 describe** 로
//     searchQuery leg single-source / createArgs leg single-source + labels 무공유 복제 /
//     updateArgs leg single-source / cross-leg 멱등 정합 / partial-thread 격리 /
//     guard-ordering / negative guard 전파 / 결정론·무공유·no-mutation 을 직접-체인으로
//     박제한다. leg-drift·title/body 불일치·labels 공유·guard-order-flip 회귀를 public CI
//     그물로 닫는다. 따라서 본 spec 은:
//
//      🔥 실 LLM 호출 0 — orchestrator / scoring service / gateway 미사용. synthetic
//         RealDataResultIssueDescriptor literal 을 컴포저에 직접 공급.
//      🔥 실 네트워크 호출 0 — github / Ollama / gh 호출 0. fetch 0. process.env 읽기 0.
//      🔥 credential 0 / secret 0 / 비용 0 — public CI 에서 항상 green 발화(R-113).
//      🔥 새 외부 dependency 0 — 기존 build* 컴포저 import 재사용만(컴포저/가드 신설 0).
//      🔥 gating / describe.skip 배선 0 — 순수 build-time in-memory 검증만.
//
// Out of Scope (T-0757):
//   - test/helpers/realdata-e2e-result-issue-command-args.ts 또는 어떤 컴포저/가드 helper
//     의 로직 변경(컴포저 재구현·guard 메시지 수정 0 — smoke 는 외부 관측만).
//   - search-argv leg(buildRealDataResultIssueSearchGhArgv) downstream chain 재단언
//     (T-0746 이미 cover — 본 spec 은 descriptor→command-args 투영 convergence 만).
//   - 상위 command-plan(T-0741)/gh-command-plan(T-0742)/publish-plan(T-0755) convergence
//     재단언(이미 cover).
//   - 실 gh 호출 / 실 LLM round-trip / DB / 실 이슈 search·create·edit wiring / 실 jest
//     spawn / 실 네트워크(live leg 복제 0).
//   - gated(DB·credential·LAN) smoke leg 추가 — 본 task 는 non-gated build-time
//     pure-composer smoke 단독.
//   - 기존 command-args unit spec·consistency 가드 spec 의 단언 수정·중복 it 이관.
//   - production src/ 코드 변경 — test-only(신규 smoke spec 1 파일).
import {
  buildRealDataResultIssueCommandArgs,
  type RealDataResultIssueCommandArgs,
} from "../helpers/realdata-e2e-result-issue-command-args";
import type { RealDataResultIssueDescriptor } from "../helpers/realdata-e2e-result-issue-descriptor";

// 결정론 멱등 marker — descriptor.marker 이자, 산출 command-args 의 searchQuery 위치
// 단일 source. 비공백 안정 토큰이라 marker 빈/공백 guard 를 자극하지 않으며,
// token/secret/raw narrative 어휘를 포함하지 않는다.
const MARKER = "<!-- realdata-e2e-result-issue: 2026-06-28@abc1234 -->";

// 결정론 고정 labels — 빌더 내부 RESULT_ISSUE_LABELS 와 동일 값(빌더가 export 하지
// 않으므로 본 spec 이 기대값으로 복제 보유). createArgs.labels 의 toEqual 대조 source.
const EXPECTED_LABELS: string[] = ["realdata-e2e", "result"];

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

describe("Smoke(non-gated): 실 평가 e2e result-issue command-args 컴포저 tri-leg(searchQuery·createArgs·updateArgs) single-source descriptor convergence", () => {
  describe("happy path — 세 leg 동시 합류", () => {
    it("buildRealDataResultIssueCommandArgs(descriptor) — 반환 { searchQuery, createArgs, updateArgs } 의 세 leg 가 모두 정의·shape 보유", () => {
      const args: RealDataResultIssueCommandArgs =
        buildRealDataResultIssueCommandArgs(validDescriptor());

      // searchQuery leg — 비공백 string.
      expect(typeof args.searchQuery).toBe("string");
      expect(args.searchQuery.length).toBeGreaterThan(0);

      // createArgs leg — {title, body, labels:string[]} shape.
      expect(args.createArgs).toBeDefined();
      expect(typeof args.createArgs.title).toBe("string");
      expect(typeof args.createArgs.body).toBe("string");
      expect(Array.isArray(args.createArgs.labels)).toBe(true);
      for (const label of args.createArgs.labels) {
        expect(typeof label).toBe("string");
      }

      // updateArgs leg — {title, body} shape.
      expect(args.updateArgs).toBeDefined();
      expect(typeof args.updateArgs.title).toBe("string");
      expect(typeof args.updateArgs.body).toBe("string");
    });
  });

  describe("searchQuery leg single-source byte-identical (핵심) — descriptor.marker 단일 source", () => {
    it("args.searchQuery 가 descriptor.marker 와 byte-identical(toBe) — searchQuery leg 이 descriptor.marker 단일 source", () => {
      const descriptor = validDescriptor();
      const args = buildRealDataResultIssueCommandArgs(descriptor);

      // searchQuery leg 은 marker 를 가공 0 으로 전파한다(동일 run 검색 토큰).
      expect(args.searchQuery).toBe(descriptor.marker);
    });
  });

  describe("createArgs leg single-source byte-identical (핵심) — descriptor.title/body 단일 source + labels 고정상수 무공유 복제", () => {
    it("args.createArgs.title === descriptor.title AND args.createArgs.body === descriptor.body(각 toBe) + labels 가 고정 RESULT_ISSUE_LABELS 와 toEqual(deep) 이되 새 배열(not.toBe, 무공유)", () => {
      const descriptor = validDescriptor();
      const args = buildRealDataResultIssueCommandArgs(descriptor);

      // title/body 단일 source — descriptor 값 그대로.
      expect(args.createArgs.title).toBe(descriptor.title);
      expect(args.createArgs.body).toBe(descriptor.body);

      // labels — 고정상수와 deep-equal 이되, 무공유 새 배열(반환 labels mutate 가
      // 상수·다음 호출에 누설되지 않음).
      expect(args.createArgs.labels).toEqual(EXPECTED_LABELS);
      expect(args.createArgs.labels).not.toBe(EXPECTED_LABELS);
    });

    it("두 번 호출의 createArgs.labels 가 서로 다른 배열 참조(not.toBe) — 호출마다 새 복제", () => {
      const descriptor = validDescriptor();
      const a = buildRealDataResultIssueCommandArgs(descriptor);
      const b = buildRealDataResultIssueCommandArgs(descriptor);

      // 두 호출의 labels 는 deep-equal 이되 참조 비공유(고정상수 공유 0).
      expect(a.createArgs.labels).toEqual(b.createArgs.labels);
      expect(a.createArgs.labels).not.toBe(b.createArgs.labels);
    });
  });

  describe("updateArgs leg single-source byte-identical (핵심) — descriptor.title/body 단일 source", () => {
    it("args.updateArgs.title === descriptor.title AND args.updateArgs.body === descriptor.body(각 toBe)", () => {
      const descriptor = validDescriptor();
      const args = buildRealDataResultIssueCommandArgs(descriptor);

      expect(args.updateArgs.title).toBe(descriptor.title);
      expect(args.updateArgs.body).toBe(descriptor.body);
    });
  });

  describe("cross-leg 멱등 정합 (branch) — 세 leg 가 단일 descriptor 로부터 일관 수렴", () => {
    it("args.createArgs.title === args.updateArgs.title(3 자 일치 title) AND args.createArgs.body === args.updateArgs.body === descriptor.body(create/update 양쪽 body 동일 — marker 라인 두 경로 보존)", () => {
      const descriptor = validDescriptor();
      const args = buildRealDataResultIssueCommandArgs(descriptor);

      // title 3 자 일치 — descriptor.title === createArgs.title === updateArgs.title.
      expect(args.createArgs.title).toBe(args.updateArgs.title);
      expect(args.createArgs.title).toBe(descriptor.title);

      // body 양쪽 일치 — create/update body 가 모두 descriptor.body(멱등 검색 토큰 보존).
      expect(args.createArgs.body).toBe(args.updateArgs.body);
      expect(args.createArgs.body).toBe(descriptor.body);
      expect(args.updateArgs.body).toBe(descriptor.body);

      // searchQuery 도 같은 descriptor 의 marker 단일 source(세 leg 동시 수렴).
      expect(args.searchQuery).toBe(descriptor.marker);
    });
  });

  describe("partial-thread 격리 (branch) — 각 leg 가 자기 descriptor 필드 단일 source 로부터 합류", () => {
    it("다른 descriptor.marker(같은 title) → searchQuery 만 변하고 createArgs/updateArgs title 불변(body 는 marker-first 정합상 marker 와 동반 변화)", () => {
      const a = buildRealDataResultIssueCommandArgs(validDescriptor());
      const otherMarker =
        "<!-- realdata-e2e-result-issue: 2026-06-28@def5678 -->";
      // 본 빌더의 body-marker self-wire 가드는 body 첫 라인 === marker 를 강제하므로,
      // 다른 marker 의 유효 descriptor 는 body 도 그 marker 를 첫 라인으로 가져야 한다
      // (body 가 marker 와 동반 변화 — 분리 불가). 따라서 marker leg 격리는 title 불변으로
      // 관찰한다: searchQuery 는 marker 단일 source 로 변하고, title leg 은 자기 source
      // (descriptor.title) 가 동일하므로 불변.
      const b = buildRealDataResultIssueCommandArgs(
        validDescriptor({ marker: otherMarker }),
      );

      // searchQuery leg 만 marker 변화를 단일 source 로 반영.
      expect(b.searchQuery).not.toBe(a.searchQuery);
      expect(b.searchQuery).toBe(otherMarker);

      // title leg(create/update) 은 불변(자기 source descriptor.title 정합 — marker 무관).
      expect(b.createArgs.title).toBe(a.createArgs.title);
      expect(b.updateArgs.title).toBe(a.updateArgs.title);
    });

    it("다른 descriptor.body(같은 title/marker) → createArgs.body·updateArgs.body 만 변하고 searchQuery·title 불변", () => {
      const descriptorA = validDescriptor();
      const a = buildRealDataResultIssueCommandArgs(descriptorA);
      // 같은 marker 를 첫 라인으로 유지하되 본문 꼬리만 다른 body(body leg 격리만 관찰).
      const otherBody = `${MARKER}\n\ncount: 9 · totalVolume: 99`;
      const b = buildRealDataResultIssueCommandArgs({
        title: descriptorA.title,
        marker: MARKER,
        body: otherBody,
      });

      // body leg(create/update) 만 변화.
      expect(b.createArgs.body).not.toBe(a.createArgs.body);
      expect(b.createArgs.body).toBe(otherBody);
      expect(b.updateArgs.body).not.toBe(a.updateArgs.body);
      expect(b.updateArgs.body).toBe(otherBody);

      // searchQuery·title 은 불변(자기 source marker/title 정합).
      expect(b.searchQuery).toBe(a.searchQuery);
      expect(b.createArgs.title).toBe(a.createArgs.title);
      expect(b.updateArgs.title).toBe(a.updateArgs.title);
    });
  });

  describe("error / negative — 식별자 guard 전파(각 예외 분기)", () => {
    it("descriptor.title 빈 문자열 → assertNonBlank('title') throw 전파", () => {
      expect(() =>
        buildRealDataResultIssueCommandArgs(validDescriptor({ title: "" })),
      ).toThrow(/title/);
    });

    it("descriptor.title 공백만 → throw 전파", () => {
      expect(() =>
        buildRealDataResultIssueCommandArgs(validDescriptor({ title: "   " })),
      ).toThrow(/title/);
    });

    it("descriptor.marker 빈 문자열 → assertNonBlank('marker') throw 전파", () => {
      // marker 가 빈 문자열이면 body 첫 라인 marker-first 정합도 깨지지만, guard 가
      // body-marker self-wire 보다 먼저 평가되므로 marker guard 메시지로 throw.
      expect(() =>
        buildRealDataResultIssueCommandArgs({
          title: "실 평가 e2e 결과 2026-06-28@abc1234",
          marker: "",
          body: "\n\ncount: 3 · totalVolume: 12",
        }),
      ).toThrow(/marker/);
    });

    it("descriptor.marker 공백만 → throw 전파", () => {
      expect(() =>
        buildRealDataResultIssueCommandArgs({
          title: "실 평가 e2e 결과 2026-06-28@abc1234",
          marker: "   ",
          body: "   \n\ncount: 3 · totalVolume: 12",
        }),
      ).toThrow(/marker/);
    });

    it("title·marker 동시 빈/공백 → 첫 guard(title) 가 차단(조용한 통과 0)", () => {
      // title·marker 모두 빈/공백이어도 throw 가 일어남(조용한 통과 0). guard-ordering
      // 상 title 이 먼저 평가되므로 title 메시지로 throw.
      let caught: Error | undefined;
      try {
        buildRealDataResultIssueCommandArgs({
          title: "  ",
          marker: "  ",
          body: "  \n\ncount: 0",
        });
      } catch (err) {
        caught = err as Error;
      }
      expect(caught).toBeDefined();
      expect(caught?.message).toContain("title");
    });
  });

  describe("flow / guard-ordering (branch) — title guard 가 marker guard 보다 먼저 평가됨", () => {
    it("title 빈 + marker 유효 → title guard 메시지로 throw(marker 미도달)", () => {
      let caught: Error | undefined;
      try {
        buildRealDataResultIssueCommandArgs(validDescriptor({ title: "" }));
      } catch (err) {
        caught = err as Error;
      }
      expect(caught).toBeDefined();
      // title guard 가 먼저 평가됨 — title 메시지, marker 메시지 미등장.
      expect(caught?.message).toContain("title");
      expect(caught?.message).not.toContain("marker");
    });

    it("title 유효 + marker 빈 → marker guard 메시지로 throw(title guard 통과 후)", () => {
      let caught: Error | undefined;
      try {
        buildRealDataResultIssueCommandArgs({
          title: "실 평가 e2e 결과 2026-06-28@abc1234",
          marker: "",
          body: "\n\ncount: 3 · totalVolume: 12",
        });
      } catch (err) {
        caught = err as Error;
      }
      expect(caught).toBeDefined();
      // title guard 통과(유효) 후 marker guard 가 throw — marker 메시지만.
      expect(caught?.message).toContain("marker");
      expect(caught?.message).not.toContain("title");
    });
  });

  describe("결정론·무공유·no-mutation", () => {
    it("동일 descriptor 두 번 호출 → deep-equal 산출(toEqual) + 새 args 객체(not.toBe) + createArgs/updateArgs/labels 참조 각각 비공유(not.toBe)", () => {
      const descriptor = validDescriptor();
      const a = buildRealDataResultIssueCommandArgs(descriptor);
      const b = buildRealDataResultIssueCommandArgs(descriptor);

      // 값은 deep-equal(결정론 — 입력만의 함수).
      expect(a).toEqual(b);
      // 참조는 무공유 — 최상위 args + 세 leg 객체 전부 새 트리.
      expect(a).not.toBe(b);
      expect(a.createArgs).not.toBe(b.createArgs);
      expect(a.updateArgs).not.toBe(b.updateArgs);
      expect(a.createArgs.labels).not.toBe(b.createArgs.labels);
    });

    it("입력 descriptor 객체 mutate 0 — 호출 전후 deep-equal snapshot", () => {
      const descriptor = validDescriptor();
      const before = JSON.parse(JSON.stringify(descriptor));

      buildRealDataResultIssueCommandArgs(descriptor);

      // 빌더는 입력을 읽기만 한다(mutate 0) — 호출 전후 deep-equal.
      expect(descriptor).toEqual(before);
    });
  });

  describe("R-59 raw 본문 누출 0 — command-args 는 descriptor 의 title/marker/body 만 thread", () => {
    it("sentinel — descriptor 에 부재한 raw 활동 본문(commit/PR raw narrative)이 command-args 직렬화에 구조적으로 미등장", () => {
      // 컴포저는 descriptor.title/marker/body 만 세 leg 로 투영한다. descriptor 에 부재한
      // raw 본문 sentinel 은 산출 command-args 에 등장할 수 없다(구조적 미포함 — R-59).
      const sentinel = "SENTINEL-RAW-COMMIT-BODY-DO-NOT-LEAK-0757";
      const args = buildRealDataResultIssueCommandArgs(validDescriptor());

      const serialized = JSON.stringify(args);
      expect(serialized).not.toContain(sentinel);
      // command-args 는 searchQuery/createArgs/updateArgs(title/body/labels) 만 — raw
      // 활동 본문 키 부재.
      expect(serialized).not.toContain("rawCommitBody");
      expect(serialized).not.toContain("rawDiff");
    });
  });
});
