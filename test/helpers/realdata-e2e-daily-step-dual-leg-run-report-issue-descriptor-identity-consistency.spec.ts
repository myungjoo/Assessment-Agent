// realdata-e2e-daily-step-dual-leg-run-report-issue-descriptor-identity-consistency.spec.ts —
// T-1024 colocated unit spec.
//
// 대상: `assertRealDataDailyStepDualLegRunReportIssueDescriptorIdentityConsistent(descriptor, report)`
// — daily-step dual-leg run report issue descriptor 의 title·marker 가 run 식별자
// (`${dateToken}@${gitSha}`)로부터 독립 재유도한 expected title·marker 와 byte-identical
// 정합한지 검증하는 순수 가드(identity-layer, 요약축 T-0709 mirror). 실 producer
// `buildRealDataDailyStepDualLegRunReportIssueDescriptor` 산출 descriptor 를 happy-path
// fixture 로 재사용해 producer↔가드 paired 교차 검증한다(가드의 독립 재유도가 producer 합성과
// byte-identical 함을 spec 이 증명 — producer prefix 상수가 module private 라 import 불가한
// 점을 보완).
//
// R-112 cover 구조:
//   - happy-path: 실 producer 산출 descriptor + 동일 report → void(throw 0). leg status 가
//     달라도 동일 run 이면 동일 title·marker(멱등 happy-path) 1+. 다양한 run 1+.
//   - error path: 구조 결손(descriptor null/undefined / 비객체 / title·marker 비-string /
//     report null / report 필드 타입 결손) 각 TypeError.
//   - branch/flow: title 재유도 분기 / marker 재유도 분기 / 빈-식별자 거부 분기 각 1+.
//   - negative cases 충분 cover (a)~(f): marker 만 다른 run token / title 만 prefix 변조 /
//     title·marker 가 서로 다른 token / 경계 변형(공백·대소문자·닫는 '-->' 누락) / 입력 비변형 /
//     결정성.
import type {
  RealDataDailyStepDualLegRunReport,
  RealDataDailyStepDualLegOverallStatus,
  RealDataDailyStepLegStatus,
} from "./realdata-e2e-daily-step-dual-leg-run-report";
import {
  buildRealDataDailyStepDualLegRunReportIssueDescriptor,
  type RealDataDailyStepDualLegRunReportIssueDescriptor,
} from "./realdata-e2e-daily-step-dual-leg-run-report-issue-descriptor";
import { assertRealDataDailyStepDualLegRunReportIssueDescriptorIdentityConsistent } from "./realdata-e2e-daily-step-dual-leg-run-report-issue-descriptor-identity-consistency";

// fixture 빌더 — run 식별자·per-leg {action,status}·overallStatus 를 명시적으로 받아
// 결정론적 report descriptor 를 생성. summaryLine 은 컴포저(T-0894)와 동형으로 합성(combined
// 가드 spec T-0988 makeReport 동형).
function makeReport(
  opts: {
    gitSha?: string;
    dateToken?: string;
    evalAction?: "run" | "skip";
    evalStatus?: RealDataDailyStepLegStatus;
    collectAction?: "run" | "skip";
    collectStatus?: RealDataDailyStepLegStatus;
    overallStatus?: RealDataDailyStepDualLegOverallStatus;
    summaryLine?: string;
  } = {},
): RealDataDailyStepDualLegRunReport {
  const gitSha = opts.gitSha ?? "abc1234";
  const dateToken = opts.dateToken ?? "2026-07-14";
  const evalStatus = opts.evalStatus ?? "pass";
  const collectStatus = opts.collectStatus ?? "pass";
  const overallStatus = opts.overallStatus ?? "all-pass";
  return {
    gitSha,
    dateToken,
    eval: { action: opts.evalAction ?? "run", status: evalStatus },
    collect: { action: opts.collectAction ?? "run", status: collectStatus },
    overallStatus,
    summaryLine:
      opts.summaryLine ??
      `[${dateToken}@${gitSha}] eval=${evalStatus} collect=${collectStatus} → ${overallStatus}`,
  };
}

// 실 producer 산출 descriptor(paired fixture) — 가드의 독립 재유도가 producer 합성과 정합함을 검증.
function composedDescriptor(
  report: RealDataDailyStepDualLegRunReport = makeReport(),
): RealDataDailyStepDualLegRunReportIssueDescriptor {
  return buildRealDataDailyStepDualLegRunReportIssueDescriptor(report);
}

// cloneDescriptor — 변조 fixture 용 얕은 복제(필드가 string 3 개 — 변조 시 원본 비오염).
function cloneDescriptor(
  d: RealDataDailyStepDualLegRunReportIssueDescriptor,
): RealDataDailyStepDualLegRunReportIssueDescriptor {
  return { title: d.title, marker: d.marker, body: d.body };
}

describe("assertRealDataDailyStepDualLegRunReportIssueDescriptorIdentityConsistent", () => {
  // ── happy-path (producer↔가드 paired) ────────────────────────────────────
  it("producer 산출 descriptor + 동일 report → void(throw 0)", () => {
    const report = makeReport();
    expect(() =>
      assertRealDataDailyStepDualLegRunReportIssueDescriptorIdentityConsistent(
        composedDescriptor(report),
        report,
      ),
    ).not.toThrow();
  });

  it("정합 쌍이면 void(undefined) 를 반환한다", () => {
    const report = makeReport();
    expect(
      assertRealDataDailyStepDualLegRunReportIssueDescriptorIdentityConsistent(
        composedDescriptor(report),
        report,
      ),
    ).toBeUndefined();
  });

  it("멱등 happy-path: leg status 가 달라도 동일 run 이면 동일 title·marker → void", () => {
    const runId = { gitSha: "abc1234", dateToken: "2026-07-14" };
    const a = composedDescriptor(
      makeReport({
        ...runId,
        evalStatus: "pass",
        collectStatus: "pass",
        overallStatus: "all-pass",
      }),
    );
    const b = composedDescriptor(
      makeReport({
        ...runId,
        evalStatus: "fail",
        collectStatus: "skip",
        collectAction: "skip",
        overallStatus: "some-fail",
      }),
    );
    // 동일 run → title·marker 동일(멱등 search-or-update 핵심)이고 둘 다 가드 통과.
    expect(a.title).toBe(b.title);
    expect(a.marker).toBe(b.marker);
    const report = makeReport(runId);
    expect(() =>
      assertRealDataDailyStepDualLegRunReportIssueDescriptorIdentityConsistent(
        a,
        report,
      ),
    ).not.toThrow();
    expect(() =>
      assertRealDataDailyStepDualLegRunReportIssueDescriptorIdentityConsistent(
        b,
        report,
      ),
    ).not.toThrow();
  });

  it.each([
    ["짧은 sha + ISO date", { gitSha: "0a1b2c3", dateToken: "2026-01-01" }],
    ["긴 sha + 다른 date", { gitSha: "deadbeefcafe", dateToken: "2025-12-31" }],
  ])(
    "다양한 run(%s) 에 대해 producer 산출 descriptor 가 가드를 통과한다",
    (_label, runId) => {
      const report = makeReport(
        runId as Partial<RealDataDailyStepDualLegRunReport>,
      );
      expect(() =>
        assertRealDataDailyStepDualLegRunReportIssueDescriptorIdentityConsistent(
          composedDescriptor(report),
          report,
        ),
      ).not.toThrow();
    },
  );

  // ── error path (구조 결손 = TypeError) ───────────────────────────────────
  it("descriptor null → TypeError", () => {
    expect(() =>
      assertRealDataDailyStepDualLegRunReportIssueDescriptorIdentityConsistent(
        null as unknown as RealDataDailyStepDualLegRunReportIssueDescriptor,
        makeReport(),
      ),
    ).toThrow(TypeError);
  });

  it("descriptor undefined → TypeError", () => {
    expect(() =>
      assertRealDataDailyStepDualLegRunReportIssueDescriptorIdentityConsistent(
        undefined as unknown as RealDataDailyStepDualLegRunReportIssueDescriptor,
        makeReport(),
      ),
    ).toThrow(TypeError);
  });

  it("descriptor 가 배열 → TypeError(array 라벨 노출)", () => {
    expect(() =>
      assertRealDataDailyStepDualLegRunReportIssueDescriptorIdentityConsistent(
        [] as unknown as RealDataDailyStepDualLegRunReportIssueDescriptor,
        makeReport(),
      ),
    ).toThrow(/array/);
  });

  it("descriptor.title 이 string 아님 → TypeError", () => {
    const d = cloneDescriptor(composedDescriptor());
    (d as { title?: unknown }).title = 42;
    expect(() =>
      assertRealDataDailyStepDualLegRunReportIssueDescriptorIdentityConsistent(
        d as RealDataDailyStepDualLegRunReportIssueDescriptor,
        makeReport(),
      ),
    ).toThrow(TypeError);
  });

  it("descriptor.marker 가 string 아님(null) → TypeError(null 라벨 노출)", () => {
    const d = cloneDescriptor(composedDescriptor());
    (d as { marker?: unknown }).marker = null;
    expect(() =>
      assertRealDataDailyStepDualLegRunReportIssueDescriptorIdentityConsistent(
        d as RealDataDailyStepDualLegRunReportIssueDescriptor,
        makeReport(),
      ),
    ).toThrow(/null/);
  });

  it("report null → TypeError", () => {
    expect(() =>
      assertRealDataDailyStepDualLegRunReportIssueDescriptorIdentityConsistent(
        composedDescriptor(),
        null as unknown as RealDataDailyStepDualLegRunReport,
      ),
    ).toThrow(TypeError);
  });

  it("report 가 배열 → TypeError", () => {
    expect(() =>
      assertRealDataDailyStepDualLegRunReportIssueDescriptorIdentityConsistent(
        composedDescriptor(),
        [] as unknown as RealDataDailyStepDualLegRunReport,
      ),
    ).toThrow(TypeError);
  });

  it("report.gitSha 가 string 아님 → TypeError", () => {
    expect(() =>
      assertRealDataDailyStepDualLegRunReportIssueDescriptorIdentityConsistent(
        composedDescriptor(),
        {
          ...makeReport(),
          gitSha: 7,
        } as unknown as RealDataDailyStepDualLegRunReport,
      ),
    ).toThrow(TypeError);
  });

  it("report.dateToken 이 string 아님 → TypeError", () => {
    expect(() =>
      assertRealDataDailyStepDualLegRunReportIssueDescriptorIdentityConsistent(
        composedDescriptor(),
        {
          ...makeReport(),
          dateToken: null,
        } as unknown as RealDataDailyStepDualLegRunReport,
      ),
    ).toThrow(TypeError);
  });

  // ── branch/flow: 빈/공백 식별자 거부 (비식별 = producer 동형 Error, ④) ──────
  it("④-a: report.gitSha 빈 문자열 → 비식별 거부 Error", () => {
    expect(() =>
      assertRealDataDailyStepDualLegRunReportIssueDescriptorIdentityConsistent(
        composedDescriptor(),
        { ...makeReport(), gitSha: "" },
      ),
    ).toThrow(/비어있습니다/);
  });

  it("④-b: report.gitSha 공백-only → 비식별 거부 Error", () => {
    expect(() =>
      assertRealDataDailyStepDualLegRunReportIssueDescriptorIdentityConsistent(
        composedDescriptor(),
        { ...makeReport(), gitSha: "   " },
      ),
    ).toThrow(Error);
  });

  it("④-c: report.dateToken 빈 문자열 → 비식별 거부 Error", () => {
    expect(() =>
      assertRealDataDailyStepDualLegRunReportIssueDescriptorIdentityConsistent(
        composedDescriptor(),
        { ...makeReport(), dateToken: "" },
      ),
    ).toThrow(/비어있습니다/);
  });

  it("④-d: report.dateToken 공백-only(탭·개행) → 비식별 거부 Error", () => {
    expect(() =>
      assertRealDataDailyStepDualLegRunReportIssueDescriptorIdentityConsistent(
        composedDescriptor(),
        { ...makeReport(), dateToken: "\t \n" },
      ),
    ).toThrow(Error);
  });

  // ── negative (b): title 재유도 mismatch (값 정합 = RangeError, 불변식 ①) ─────
  it("negative (b)-1: descriptor.title 의 prefix 변형 → RangeError", () => {
    const report = makeReport();
    const d = cloneDescriptor(composedDescriptor(report));
    d.title = `다른 prefix 2026-07-14@abc1234`;
    expect(() =>
      assertRealDataDailyStepDualLegRunReportIssueDescriptorIdentityConsistent(
        d,
        report,
      ),
    ).toThrow(RangeError);
  });

  it("negative (b)-2: descriptor.title 의 run token 변형 → RangeError", () => {
    const report = makeReport();
    const d = cloneDescriptor(composedDescriptor(report));
    d.title = `실 평가 e2e daily-step dual-leg run report 9999-99-99@tampered`;
    expect(() =>
      assertRealDataDailyStepDualLegRunReportIssueDescriptorIdentityConsistent(
        d,
        report,
      ),
    ).toThrow(RangeError);
  });

  it("RangeError 메시지에 기대 vs 실측 노출(title mismatch)", () => {
    const report = makeReport();
    const d = cloneDescriptor(composedDescriptor(report));
    d.title = `실 평가 e2e daily-step dual-leg run report wrong@token`;
    expect(() =>
      assertRealDataDailyStepDualLegRunReportIssueDescriptorIdentityConsistent(
        d,
        report,
      ),
    ).toThrow(/기대=.*실측=/);
  });

  // ── negative (a): marker 재유도 mismatch (값 정합 = RangeError, 불변식 ②) ────
  it("negative (a)-1: marker 만 다른 run token → RangeError(멱등 깨짐)", () => {
    // title 은 report 와 정합하지만 marker 만 다른 run token 으로 손상 → ① 통과 후 ② catch.
    const report = makeReport();
    const d = cloneDescriptor(composedDescriptor(report));
    d.marker = `<!-- realdata-e2e-daily-step-dual-leg-run-report-issue: 2099-12-31@abc1234 -->`;
    expect(() =>
      assertRealDataDailyStepDualLegRunReportIssueDescriptorIdentityConsistent(
        d,
        report,
      ),
    ).toThrow(RangeError);
  });

  it("negative (d)-1: marker 닫는 '-->' 누락 → RangeError", () => {
    const report = makeReport();
    const d = cloneDescriptor(composedDescriptor(report));
    d.marker = `<!-- realdata-e2e-daily-step-dual-leg-run-report-issue: 2026-07-14@abc1234`;
    expect(() =>
      assertRealDataDailyStepDualLegRunReportIssueDescriptorIdentityConsistent(
        d,
        report,
      ),
    ).toThrow(RangeError);
  });

  it("negative (d)-2: marker prefix 어긋남 → RangeError", () => {
    const report = makeReport();
    const d = cloneDescriptor(composedDescriptor(report));
    d.marker = `<!-- wrong-marker: 2026-07-14@abc1234 -->`;
    expect(() =>
      assertRealDataDailyStepDualLegRunReportIssueDescriptorIdentityConsistent(
        d,
        report,
      ),
    ).toThrow(RangeError);
  });

  // ── negative (c): title·marker 가 서로 다른 run token (멱등 깨짐) ───────────
  it("negative (c): title·marker 가 서로 다른 token 이면 ②(marker 재유도)가 catch", () => {
    // 멱등 불변식(동일 run → 동일 title·marker token)은 ①∧② 가 직접 보장한다 — title 은
    // report token 으로 정합(① 통과)하지만 marker 만 다른 run token 으로 손상시키면 ②
    // marker 재유도 대조가 RangeError 로 차단한다(token 불일치는 항상 RangeError).
    const report = makeReport();
    const d = cloneDescriptor(composedDescriptor(report));
    d.marker = `<!-- realdata-e2e-daily-step-dual-leg-run-report-issue: 2000-01-01@deadbee -->`;
    let caught: unknown;
    try {
      assertRealDataDailyStepDualLegRunReportIssueDescriptorIdentityConsistent(
        d,
        report,
      );
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(RangeError);
  });

  // ── negative (d): 경계 변형 — 앞뒤 공백·대소문자 민감 ──────────────────────
  it("negative (d)-3: descriptor.title 앞 공백 추가 → RangeError(공백 민감)", () => {
    const report = makeReport();
    const d = cloneDescriptor(composedDescriptor(report));
    d.title = ` ${d.title}`;
    expect(() =>
      assertRealDataDailyStepDualLegRunReportIssueDescriptorIdentityConsistent(
        d,
        report,
      ),
    ).toThrow(RangeError);
  });

  it("negative (d)-4: descriptor.marker 대소문자 변형 → RangeError(대소문자 민감)", () => {
    const report = makeReport();
    const d = cloneDescriptor(composedDescriptor(report));
    d.marker = d.marker.toUpperCase();
    expect(() =>
      assertRealDataDailyStepDualLegRunReportIssueDescriptorIdentityConsistent(
        d,
        report,
      ),
    ).toThrow(RangeError);
  });

  // ── negative (e): 입력 비변형 / (f) 결정론 ────────────────────────────────
  it("negative (e): 가드가 입력 descriptor·report 를 변형하지 않는다(비변형)", () => {
    const report = makeReport();
    const descriptor = composedDescriptor(report);
    const descriptorSnapshot = JSON.stringify(descriptor);
    const reportSnapshot = JSON.stringify(report);
    const reportRef = report;
    assertRealDataDailyStepDualLegRunReportIssueDescriptorIdentityConsistent(
      descriptor,
      report,
    );
    expect(JSON.stringify(descriptor)).toBe(descriptorSnapshot);
    expect(JSON.stringify(report)).toBe(reportSnapshot);
    expect(report).toBe(reportRef);
  });

  it("negative (f): 동일 입력 반복 호출 → 동일 동작(결정론)", () => {
    const report = makeReport();
    const descriptor = composedDescriptor(report);
    expect(() =>
      assertRealDataDailyStepDualLegRunReportIssueDescriptorIdentityConsistent(
        descriptor,
        report,
      ),
    ).not.toThrow();
    expect(() =>
      assertRealDataDailyStepDualLegRunReportIssueDescriptorIdentityConsistent(
        descriptor,
        report,
      ),
    ).not.toThrow();
  });
});
