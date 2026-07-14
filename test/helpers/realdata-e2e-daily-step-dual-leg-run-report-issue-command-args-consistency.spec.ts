// realdata-e2e-daily-step-dual-leg-run-report-issue-command-args-consistency.spec.ts —
// T-0990 colocated unit spec for
// `assertRealDataDailyStepDualLegRunReportIssueCommandArgsConsistent`.
//
// R-112 cover 구조:
//   - happy-path: 실 producer `buildRealDataDailyStepDualLegRunReportIssueCommandArgs` 산출을
//     가드에 넣으면 throw 0(void) — 서로 다른 descriptor fixture(title/marker/body 조합).
//     producer 를 실제 호출해 얻은 command-args round-trip(oracle↔producer 규칙 일치 증명).
//   - error path: commandArgs 구조 결손(null·비-객체·searchQuery 부재·createArgs 부재·비-객체·
//     updateArgs 부재·비-객체·labels 비-배열·요소 비-string, create·update 의 title/body 비-string)
//     → TypeError. descriptor.title/marker 빈-공백 → Error.
//   - flow/branch: 재유도 분기(searchQuery·createArgs 3필드·updateArgs 2필드·labels 배열)마다
//     정합 통과 + drift throw 를 각 분리 검증.
//   - negative 충분 cover: searchQuery 왜곡·create·update body 불일치(멱등성 파괴)·title 왜곡·
//     labels 요소 추가/삭제/변경/순서 뒤집기·labels 개수 불일치 각 mutant 를 개별 RangeError 로
//     감지 + 가드 비변형(입력 mutate 0) + §9 비시크릿 더미 fixture assert.
import {
  buildRealDataDailyStepDualLegRunReportIssueCommandArgs,
  type RealDataDailyStepDualLegRunReportIssueCommandArgs,
} from "./realdata-e2e-daily-step-dual-leg-run-report-issue-command-args";
import { assertRealDataDailyStepDualLegRunReportIssueCommandArgsConsistent } from "./realdata-e2e-daily-step-dual-leg-run-report-issue-command-args-consistency";
import type { RealDataDailyStepDualLegRunReportIssueDescriptor } from "./realdata-e2e-daily-step-dual-leg-run-report-issue-descriptor";

const FIXED_LABELS = ["realdata-e2e", "daily-step-dual-leg-run-report"];

// makeDescriptor — 결정론적 issue descriptor fixture. run 식별자 조합을 명시적으로 받아
// title/marker/body(marker-first) 를 합성. spec 안 인라인 구성(공용 mock helper 추출 불요).
function makeDescriptor(
  opts: { dateToken?: string; gitSha?: string; extraBody?: string[] } = {},
): RealDataDailyStepDualLegRunReportIssueDescriptor {
  const dateToken = opts.dateToken ?? "2026-07-14";
  const gitSha = opts.gitSha ?? "abc1234";
  const token = `${dateToken}@${gitSha}`;
  const marker = `<!-- realdata-e2e-daily-step-dual-leg-run-report-issue: ${token} -->`;
  return {
    title: `실 평가 e2e daily-step dual-leg run report ${token}`,
    marker,
    body: [
      marker,
      "",
      "## 실 평가 e2e daily-step dual-leg run report",
      ...(opts.extraBody ?? [
        "- eval leg: pass",
        "- collect leg: pass",
        "- overall: all-pass",
      ]),
    ].join("\n"),
  };
}

// makeArgs — 실 producer 산출 command-args 를 재사용해 정상 정합 쌍을 만든다(drift 분기
// test 가 한 필드만 변조해 손상 fixture 를 만든다).
function makeArgs(
  descriptor: RealDataDailyStepDualLegRunReportIssueDescriptor,
): RealDataDailyStepDualLegRunReportIssueCommandArgs {
  return buildRealDataDailyStepDualLegRunReportIssueCommandArgs(descriptor);
}

describe("assertRealDataDailyStepDualLegRunReportIssueCommandArgsConsistent", () => {
  describe("happy-path (정합 descriptor↔command-args → void)", () => {
    it("producer 산출 command-args 를 그대로 넘기면 throw 0(void)", () => {
      const descriptor = makeDescriptor();
      expect(() =>
        assertRealDataDailyStepDualLegRunReportIssueCommandArgsConsistent(
          descriptor,
          makeArgs(descriptor),
        ),
      ).not.toThrow();
    });

    it("정합 쌍이면 void(undefined) 를 반환한다", () => {
      const descriptor = makeDescriptor();
      expect(
        assertRealDataDailyStepDualLegRunReportIssueCommandArgsConsistent(
          descriptor,
          makeArgs(descriptor),
        ),
      ).toBeUndefined();
    });

    it("round-trip — producer↔oracle 규칙 일치 증명(다른 run fixture)", () => {
      const descriptor = makeDescriptor({
        dateToken: "2026-07-12",
        gitSha: "deadbee",
      });
      const args = makeArgs(descriptor);
      // producer 산출 그대로 정합(oracle 이 producer 규칙과 byte-identical 재유도).
      expect(() =>
        assertRealDataDailyStepDualLegRunReportIssueCommandArgsConsistent(
          descriptor,
          args,
        ),
      ).not.toThrow();
    });

    it("marker-only body descriptor 도 정합(void)", () => {
      const marker =
        "<!-- realdata-e2e-daily-step-dual-leg-run-report-issue: 2026-07-13@cafe123 -->";
      const descriptor: RealDataDailyStepDualLegRunReportIssueDescriptor = {
        title: "실 평가 e2e daily-step dual-leg run report 2026-07-13@cafe123",
        marker,
        body: marker,
      };
      expect(() =>
        assertRealDataDailyStepDualLegRunReportIssueCommandArgsConsistent(
          descriptor,
          makeArgs(descriptor),
        ),
      ).not.toThrow();
    });

    it("label 을 넘겨도 정합 쌍이면 void", () => {
      const descriptor = makeDescriptor();
      expect(() =>
        assertRealDataDailyStepDualLegRunReportIssueCommandArgsConsistent(
          descriptor,
          makeArgs(descriptor),
          "daily-issue#1",
        ),
      ).not.toThrow();
    });

    it("빈 문자열 label 도 정합 쌍이면 void (contextPrefix 빈-label 분기)", () => {
      const descriptor = makeDescriptor();
      expect(() =>
        assertRealDataDailyStepDualLegRunReportIssueCommandArgsConsistent(
          descriptor,
          makeArgs(descriptor),
          "",
        ),
      ).not.toThrow();
    });
  });

  describe("error path — commandArgs 구조 결손 → TypeError", () => {
    it("commandArgs null → TypeError", () => {
      expect(() =>
        assertRealDataDailyStepDualLegRunReportIssueCommandArgsConsistent(
          makeDescriptor(),
          null as unknown as RealDataDailyStepDualLegRunReportIssueCommandArgs,
        ),
      ).toThrow(/commandArgs 가 null\/undefined/);
    });

    it("commandArgs 비-객체(문자열) → TypeError", () => {
      expect(() =>
        assertRealDataDailyStepDualLegRunReportIssueCommandArgsConsistent(
          makeDescriptor(),
          "not-an-object" as unknown as RealDataDailyStepDualLegRunReportIssueCommandArgs,
        ),
      ).toThrow(/commandArgs 가 객체가 아니다/);
    });

    it("searchQuery 부재/비-string → TypeError", () => {
      const descriptor = makeDescriptor();
      const args = {
        ...makeArgs(descriptor),
        searchQuery: undefined as unknown as string,
      };
      expect(() =>
        assertRealDataDailyStepDualLegRunReportIssueCommandArgsConsistent(
          descriptor,
          args,
        ),
      ).toThrow(/commandArgs\.searchQuery 가 string 이 아니다/);
    });

    it("createArgs 부재(null) → TypeError", () => {
      const descriptor = makeDescriptor();
      const args = {
        ...makeArgs(descriptor),
        createArgs:
          null as unknown as RealDataDailyStepDualLegRunReportIssueCommandArgs["createArgs"],
      };
      expect(() =>
        assertRealDataDailyStepDualLegRunReportIssueCommandArgsConsistent(
          descriptor,
          args,
        ),
      ).toThrow(/commandArgs\.createArgs 가 null\/undefined/);
    });

    it("createArgs 비-객체(문자열) → TypeError", () => {
      const descriptor = makeDescriptor();
      const args = {
        ...makeArgs(descriptor),
        createArgs:
          "x" as unknown as RealDataDailyStepDualLegRunReportIssueCommandArgs["createArgs"],
      };
      expect(() =>
        assertRealDataDailyStepDualLegRunReportIssueCommandArgsConsistent(
          descriptor,
          args,
        ),
      ).toThrow(/commandArgs\.createArgs 가 객체가 아니다/);
    });

    it("updateArgs 부재(undefined) → TypeError", () => {
      const descriptor = makeDescriptor();
      const args = {
        ...makeArgs(descriptor),
        updateArgs:
          undefined as unknown as RealDataDailyStepDualLegRunReportIssueCommandArgs["updateArgs"],
      };
      expect(() =>
        assertRealDataDailyStepDualLegRunReportIssueCommandArgsConsistent(
          descriptor,
          args,
        ),
      ).toThrow(/commandArgs\.updateArgs 가 null\/undefined/);
    });

    it("createArgs.labels 비-배열 → TypeError", () => {
      const descriptor = makeDescriptor();
      const base = makeArgs(descriptor);
      const args = {
        ...base,
        createArgs: {
          ...base.createArgs,
          labels: "realdata-e2e" as unknown as string[],
        },
      };
      expect(() =>
        assertRealDataDailyStepDualLegRunReportIssueCommandArgsConsistent(
          descriptor,
          args,
        ),
      ).toThrow(/commandArgs\.createArgs\.labels 가 배열이 아니다/);
    });

    it("createArgs.labels 요소 비-string → TypeError", () => {
      const descriptor = makeDescriptor();
      const base = makeArgs(descriptor);
      const args = {
        ...base,
        createArgs: {
          ...base.createArgs,
          labels: ["realdata-e2e", 42 as unknown as string],
        },
      };
      expect(() =>
        assertRealDataDailyStepDualLegRunReportIssueCommandArgsConsistent(
          descriptor,
          args,
        ),
      ).toThrow(/commandArgs\.createArgs\.labels\[1\] 가 string 이 아니다/);
    });

    it("createArgs.title 비-string → TypeError", () => {
      const descriptor = makeDescriptor();
      const base = makeArgs(descriptor);
      const args = {
        ...base,
        createArgs: { ...base.createArgs, title: 1 as unknown as string },
      };
      expect(() =>
        assertRealDataDailyStepDualLegRunReportIssueCommandArgsConsistent(
          descriptor,
          args,
        ),
      ).toThrow(/commandArgs\.createArgs\.title 가 string 이 아니다/);
    });

    it("updateArgs.body 비-string → TypeError", () => {
      const descriptor = makeDescriptor();
      const base = makeArgs(descriptor);
      const args = {
        ...base,
        updateArgs: { ...base.updateArgs, body: null as unknown as string },
      };
      expect(() =>
        assertRealDataDailyStepDualLegRunReportIssueCommandArgsConsistent(
          descriptor,
          args,
        ),
      ).toThrow(/commandArgs\.updateArgs\.body 가 string 이 아니다/);
    });

    it("createArgs.body 비-string → TypeError", () => {
      const descriptor = makeDescriptor();
      const base = makeArgs(descriptor);
      const args = {
        ...base,
        createArgs: { ...base.createArgs, body: 7 as unknown as string },
      };
      expect(() =>
        assertRealDataDailyStepDualLegRunReportIssueCommandArgsConsistent(
          descriptor,
          args,
        ),
      ).toThrow(/commandArgs\.createArgs\.body 가 string 이 아니다/);
    });

    it("updateArgs.title 비-string → TypeError", () => {
      const descriptor = makeDescriptor();
      const base = makeArgs(descriptor);
      const args = {
        ...base,
        updateArgs: {
          ...base.updateArgs,
          title: undefined as unknown as string,
        },
      };
      expect(() =>
        assertRealDataDailyStepDualLegRunReportIssueCommandArgsConsistent(
          descriptor,
          args,
        ),
      ).toThrow(/commandArgs\.updateArgs\.title 가 string 이 아니다/);
    });

    it("updateArgs 비-객체(문자열) → TypeError", () => {
      const descriptor = makeDescriptor();
      const base = makeArgs(descriptor);
      const args = {
        ...base,
        updateArgs:
          "updateArgs" as unknown as RealDataDailyStepDualLegRunReportIssueCommandArgs["updateArgs"],
      };
      expect(() =>
        assertRealDataDailyStepDualLegRunReportIssueCommandArgsConsistent(
          descriptor,
          args,
        ),
      ).toThrow(/commandArgs\.updateArgs 가 객체가 아니다/);
    });
  });

  describe("error path — descriptor 식별자 빈-공백 → producer 동형 Error", () => {
    it("descriptor.title 빈 문자열 → producer 동형 Error(/title/)", () => {
      const descriptor = { ...makeDescriptor(), title: "" };
      // command-args 는 구조상 온전한 더미(재유도 이전 descriptor guard 가 먼저 throw).
      expect(() =>
        assertRealDataDailyStepDualLegRunReportIssueCommandArgsConsistent(
          descriptor,
          {
            searchQuery: "y",
            createArgs: { title: "x", body: "z", labels: [...FIXED_LABELS] },
            updateArgs: { title: "x", body: "z" },
          },
        ),
      ).toThrow(/title/);
    });

    it("descriptor.title 공백-only → producer 동형 Error", () => {
      const descriptor = { ...makeDescriptor(), title: "  \t " };
      expect(() =>
        assertRealDataDailyStepDualLegRunReportIssueCommandArgsConsistent(
          descriptor,
          makeArgs(makeDescriptor()),
        ),
      ).toThrow(/title/);
    });

    it("descriptor.marker 빈 문자열 → producer 동형 Error(/marker/)", () => {
      const descriptor = { ...makeDescriptor(), marker: "" };
      expect(() =>
        assertRealDataDailyStepDualLegRunReportIssueCommandArgsConsistent(
          descriptor,
          {
            searchQuery: "y",
            createArgs: { title: "x", body: "z", labels: [...FIXED_LABELS] },
            updateArgs: { title: "x", body: "z" },
          },
        ),
      ).toThrow(/marker/);
    });

    it("descriptor.marker 공백-only → producer 동형 Error", () => {
      const descriptor = { ...makeDescriptor(), marker: "\n \t" };
      expect(() =>
        assertRealDataDailyStepDualLegRunReportIssueCommandArgsConsistent(
          descriptor,
          {
            searchQuery: "y",
            createArgs: { title: "x", body: "z", labels: [...FIXED_LABELS] },
            updateArgs: { title: "x", body: "z" },
          },
        ),
      ).toThrow(/marker/);
    });
  });

  describe("negative 충분 cover — command-args 필드별 drift → RangeError", () => {
    it("(a) searchQuery 를 marker 아닌 title 로 대체 → RangeError(searchQuery)", () => {
      const descriptor = makeDescriptor();
      const base = makeArgs(descriptor);
      const args = { ...base, searchQuery: descriptor.title };
      const run = () =>
        assertRealDataDailyStepDualLegRunReportIssueCommandArgsConsistent(
          descriptor,
          args,
        );
      expect(run).toThrow(RangeError);
      expect(run).toThrow(/정합 위반\(searchQuery\)/);
      expect(run).toThrow(/기대=.*실측=/s);
    });

    it("(b) create·update body 불일치(멱등성 파괴) → RangeError(updateArgs.body)", () => {
      const descriptor = makeDescriptor();
      const base = makeArgs(descriptor);
      const args = {
        ...base,
        updateArgs: {
          ...base.updateArgs,
          body: `${base.updateArgs.body} DRIFT`,
        },
      };
      const run = () =>
        assertRealDataDailyStepDualLegRunReportIssueCommandArgsConsistent(
          descriptor,
          args,
        );
      expect(run).toThrow(RangeError);
      expect(run).toThrow(/정합 위반\(updateArgs\.body\)/);
    });

    it("(b') createArgs.body 왜곡 → RangeError(createArgs.body)", () => {
      const descriptor = makeDescriptor();
      const base = makeArgs(descriptor);
      const args = {
        ...base,
        createArgs: { ...base.createArgs, body: `${base.createArgs.body} X` },
      };
      expect(() =>
        assertRealDataDailyStepDualLegRunReportIssueCommandArgsConsistent(
          descriptor,
          args,
        ),
      ).toThrow(/정합 위반\(createArgs\.body\)/);
    });

    it("(c) createArgs.title 왜곡 → RangeError(createArgs.title)", () => {
      const descriptor = makeDescriptor();
      const base = makeArgs(descriptor);
      const args = {
        ...base,
        createArgs: { ...base.createArgs, title: `${base.createArgs.title}!` },
      };
      expect(() =>
        assertRealDataDailyStepDualLegRunReportIssueCommandArgsConsistent(
          descriptor,
          args,
        ),
      ).toThrow(/정합 위반\(createArgs\.title\)/);
    });

    it("(c') updateArgs.title 왜곡 → RangeError(updateArgs.title)", () => {
      const descriptor = makeDescriptor();
      const base = makeArgs(descriptor);
      const args = {
        ...base,
        updateArgs: { ...base.updateArgs, title: "다른 제목" },
      };
      expect(() =>
        assertRealDataDailyStepDualLegRunReportIssueCommandArgsConsistent(
          descriptor,
          args,
        ),
      ).toThrow(/정합 위반\(updateArgs\.title\)/);
    });

    it("(d-add) labels 요소 추가 → RangeError(labels 개수)", () => {
      const descriptor = makeDescriptor();
      const base = makeArgs(descriptor);
      const args = {
        ...base,
        createArgs: {
          ...base.createArgs,
          labels: [...base.createArgs.labels, "extra"],
        },
      };
      expect(() =>
        assertRealDataDailyStepDualLegRunReportIssueCommandArgsConsistent(
          descriptor,
          args,
        ),
      ).toThrow(/정합 위반\(createArgs\.labels 개수\)/);
    });

    it("(d-del) labels 요소 삭제 → RangeError(labels 개수)", () => {
      const descriptor = makeDescriptor();
      const base = makeArgs(descriptor);
      const args = {
        ...base,
        createArgs: { ...base.createArgs, labels: [base.createArgs.labels[0]] },
      };
      expect(() =>
        assertRealDataDailyStepDualLegRunReportIssueCommandArgsConsistent(
          descriptor,
          args,
        ),
      ).toThrow(/정합 위반\(createArgs\.labels 개수\)/);
    });

    it("(d-mut) labels 문자열 변경 → RangeError(labels[i])", () => {
      const descriptor = makeDescriptor();
      const base = makeArgs(descriptor);
      const args = {
        ...base,
        createArgs: {
          ...base.createArgs,
          labels: ["realdata-e2e", "daily-step-dual-leg-run-report-CHANGED"],
        },
      };
      expect(() =>
        assertRealDataDailyStepDualLegRunReportIssueCommandArgsConsistent(
          descriptor,
          args,
        ),
      ).toThrow(/정합 위반\(createArgs\.labels\[1\]\)/);
    });

    it("(d-order) labels 순서 뒤집기 → RangeError(labels[0])", () => {
      const descriptor = makeDescriptor();
      const base = makeArgs(descriptor);
      const args = {
        ...base,
        createArgs: {
          ...base.createArgs,
          labels: [...base.createArgs.labels].reverse(),
        },
      };
      expect(() =>
        assertRealDataDailyStepDualLegRunReportIssueCommandArgsConsistent(
          descriptor,
          args,
        ),
      ).toThrow(/정합 위반\(createArgs\.labels\[0\]\)/);
    });

    it("(e) labels 개수 불일치(빈 배열) → RangeError(labels 개수)", () => {
      const descriptor = makeDescriptor();
      const base = makeArgs(descriptor);
      const args = {
        ...base,
        createArgs: { ...base.createArgs, labels: [] },
      };
      expect(() =>
        assertRealDataDailyStepDualLegRunReportIssueCommandArgsConsistent(
          descriptor,
          args,
        ),
      ).toThrow(/정합 위반\(createArgs\.labels 개수\)/);
    });

    it("descriptor 측 슬롯이 command-args 와 어긋나도 RangeError(양방향 어느 쪽이든 노출)", () => {
      // command-args 는 abc1234 run 산출인데 descriptor 만 marker 를 바꾸면 재유도가 어긋남.
      const args = makeArgs(makeDescriptor());
      const mismatched = {
        ...makeDescriptor(),
        marker:
          "<!-- realdata-e2e-daily-step-dual-leg-run-report-issue: 2026-07-14@0000000 -->",
      };
      expect(() =>
        assertRealDataDailyStepDualLegRunReportIssueCommandArgsConsistent(
          mismatched,
          args,
        ),
      ).toThrow(RangeError);
    });
  });

  describe("결정성 / 비변형 / §9·§12 안전성", () => {
    it("동일 정합 쌍 2 회 호출 → 둘 다 void", () => {
      const descriptor = makeDescriptor();
      const args = makeArgs(descriptor);
      expect(() =>
        assertRealDataDailyStepDualLegRunReportIssueCommandArgsConsistent(
          descriptor,
          args,
        ),
      ).not.toThrow();
      expect(() =>
        assertRealDataDailyStepDualLegRunReportIssueCommandArgsConsistent(
          descriptor,
          args,
        ),
      ).not.toThrow();
    });

    it("동일 drift 쌍 2 회 호출 → 둘 다 RangeError", () => {
      const descriptor = makeDescriptor();
      const base = makeArgs(descriptor);
      const args = { ...base, searchQuery: `${base.searchQuery} DRIFT` };
      const run = () =>
        assertRealDataDailyStepDualLegRunReportIssueCommandArgsConsistent(
          descriptor,
          args,
        );
      expect(run).toThrow(RangeError);
      expect(run).toThrow(RangeError);
    });

    it("가드 호출 전후 descriptor 객체 mutate 0(deep-equal 불변)", () => {
      const descriptor = makeDescriptor();
      const args = makeArgs(descriptor);
      const snapshot = JSON.stringify(descriptor);
      assertRealDataDailyStepDualLegRunReportIssueCommandArgsConsistent(
        descriptor,
        args,
      );
      expect(JSON.stringify(descriptor)).toBe(snapshot);
    });

    it("가드 호출 전후 command-args 객체·하위 슬롯 mutate 0(deep-equal 불변)", () => {
      const descriptor = makeDescriptor();
      const args = makeArgs(descriptor);
      const snapshot = JSON.stringify(args);
      assertRealDataDailyStepDualLegRunReportIssueCommandArgsConsistent(
        descriptor,
        args,
      );
      expect(JSON.stringify(args)).toBe(snapshot);
      // labels 배열도 mutate 0(원소·순서 보존).
      expect(args.createArgs.labels).toEqual(FIXED_LABELS);
    });

    it("§9 — fixture 식별자는 비시크릿 더미이며 재유도/대조 산출에 secret 패턴/raw payload 미노출", () => {
      // 식별자에 token-like 더미를 심어도 그 슬롯 외 secret 어휘가 대조 대상에 없다.
      const descriptor = makeDescriptor({ gitSha: "ghpFAKEDUMMY" });
      const args = makeArgs(descriptor);
      expect(() =>
        assertRealDataDailyStepDualLegRunReportIssueCommandArgsConsistent(
          descriptor,
          args,
        ),
      ).not.toThrow();
      // 가드는 descriptor·command-args 구조만 다룬다 — Bearer/authorization/password 등
      // secret 어휘나 commit/PR/issue payload 전문은 대조 대상에 부재.
      expect(args.createArgs.body).not.toMatch(/Bearer\s/i);
      expect(args.createArgs.body).not.toMatch(/authorization/i);
      expect(args.updateArgs.body).not.toMatch(/password/i);
    });
  });
});
