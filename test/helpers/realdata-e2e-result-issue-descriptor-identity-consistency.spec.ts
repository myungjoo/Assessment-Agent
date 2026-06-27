// realdata-e2e-result-issue-descriptor-identity-consistency.spec.ts — T-0709 colocated unit spec.
//
// 대상: `assertRealDataResultIssueDescriptorIdentityConsistent(descriptor, run)` — 결과 이슈
// descriptor 의 title·marker 가 run 식별자(`${dateToken}@${gitSha}`)로부터 독립 재유도한
// expected title·marker 와 byte-identical 정합한지 검증하는 순수 가드(identity-layer).
// 실 컴포저 `buildRealDataResultIssueDescriptor` 산출 descriptor 를 happy-path fixture 로
// 재사용해 컴포저↔가드 paired 교차 검증한다(가드의 독립 재유도가 컴포저 합성과 byte-identical
// 함을 spec 이 증명 — 컴포저 prefix 상수가 module private 라 import 불가한 점을 보완).
//
// R-112 cover 구조:
//   - happy-path: 컴포저 산출 descriptor + 동일 run → void(throw 0). summary 가 달라도 동일
//     run 이면 동일 title·marker(멱등 happy-path) 1+.
//   - error path: 구조 결손(descriptor null/undefined / 비객체 / title·marker 비-string /
//     run null / run 필드 타입 결손) 각 TypeError.
//   - branch/flow: title 재유도 분기 / marker 재유도 분기 / 교차 token 동치 분기 / 빈-식별자
//     거부 분기 각 1+.
//   - negative cases 충분 cover (1)~(6): title mismatch / marker mismatch / title·marker 가
//     서로 다른 run token / marker 닫는 '-->' 누락·prefix 어긋남 / 빈·공백 식별자 / 입력 비변형.
//   - 결정론.
import {
  CONTRIBUTION_LEVELS,
  type ContributionLevel,
} from "../../src/assessment-evaluation/domain/evaluation-result";
import { DIFFICULTIES, type Difficulty } from "../../src/llm/difficulty";

import {
  buildRealDataResultIssueDescriptor,
  type RealDataResultIssueDescriptor,
  type RealDataResultIssueRunRef,
} from "./realdata-e2e-result-issue-descriptor";
import { assertRealDataResultIssueDescriptorIdentityConsistent } from "./realdata-e2e-result-issue-descriptor-identity-consistency";
import type { RealDataResultSummary } from "./realdata-e2e-result-summary";

// fixture 빌더 — 슬롯별 카운트를 받아 결정론적 summary descriptor 를 생성(descriptor spec 동형).
function makeSummary(opts: {
  count: number;
  byDifficulty: Partial<Record<Difficulty, number>>;
  byContribution: Partial<Record<ContributionLevel, number>>;
  totalVolume: number;
}): RealDataResultSummary {
  const byDifficulty = {} as Record<Difficulty, number>;
  for (const d of DIFFICULTIES) {
    byDifficulty[d] = opts.byDifficulty[d] ?? 0;
  }
  const byContribution = {} as Record<ContributionLevel, number>;
  for (const c of CONTRIBUTION_LEVELS) {
    byContribution[c] = opts.byContribution[c] ?? 0;
  }
  return {
    count: opts.count,
    byDifficulty,
    byContribution,
    totalVolume: opts.totalVolume,
  };
}

const HAPPY_RUN: RealDataResultIssueRunRef = {
  gitSha: "abc1234",
  dateToken: "2026-06-23",
};

function happySummary(): RealDataResultSummary {
  return makeSummary({
    count: 3,
    byDifficulty: { easy: 2, medium: 1 },
    byContribution: { low: 1, medium: 1, high: 1 },
    totalVolume: 42,
  });
}

// 컴포저 산출 descriptor(paired fixture) — 가드의 독립 재유도가 컴포저 합성과 정합함을 검증.
function composedDescriptor(
  run: RealDataResultIssueRunRef = HAPPY_RUN,
  summary: RealDataResultSummary = happySummary(),
): RealDataResultIssueDescriptor {
  return buildRealDataResultIssueDescriptor(summary, run);
}

// cloneDescriptor — 변조 fixture 용 얕은 복제(필드가 string 3 개 — 변조 시 원본 비오염).
function cloneDescriptor(
  d: RealDataResultIssueDescriptor,
): RealDataResultIssueDescriptor {
  return { title: d.title, marker: d.marker, body: d.body };
}

describe("assertRealDataResultIssueDescriptorIdentityConsistent", () => {
  // ── happy-path (컴포저↔가드 paired) ──────────────────────────────────────
  it("컴포저 산출 descriptor + 동일 run → void(throw 0)", () => {
    const descriptor = composedDescriptor();
    expect(() =>
      assertRealDataResultIssueDescriptorIdentityConsistent(
        descriptor,
        HAPPY_RUN,
      ),
    ).not.toThrow();
  });

  it("멱등 happy-path: summary 가 달라도 동일 run 이면 동일 title·marker → void", () => {
    const a = composedDescriptor(
      HAPPY_RUN,
      makeSummary({
        count: 1,
        byDifficulty: { easy: 1 },
        byContribution: { low: 1 },
        totalVolume: 7,
      }),
    );
    const b = composedDescriptor(
      HAPPY_RUN,
      makeSummary({
        count: 99,
        byDifficulty: { hard: 99 },
        byContribution: { high: 99 },
        totalVolume: 9999,
      }),
    );
    // 동일 run → title·marker 동일(멱등 search-or-update 핵심)이고 둘 다 가드 통과.
    expect(a.title).toBe(b.title);
    expect(a.marker).toBe(b.marker);
    expect(() =>
      assertRealDataResultIssueDescriptorIdentityConsistent(a, HAPPY_RUN),
    ).not.toThrow();
    expect(() =>
      assertRealDataResultIssueDescriptorIdentityConsistent(b, HAPPY_RUN),
    ).not.toThrow();
  });

  it.each([
    ["짧은 sha + ISO date", { gitSha: "0a1b2c3", dateToken: "2026-01-01" }],
    ["긴 sha + 다른 date", { gitSha: "deadbeefcafe", dateToken: "2025-12-31" }],
  ])(
    "다양한 run(%s) 에 대해 컴포저 산출 descriptor 가 가드를 통과한다",
    (_label, run) => {
      const descriptor = composedDescriptor(run as RealDataResultIssueRunRef);
      expect(() =>
        assertRealDataResultIssueDescriptorIdentityConsistent(
          descriptor,
          run as RealDataResultIssueRunRef,
        ),
      ).not.toThrow();
    },
  );

  // ── error path (구조 결손 = TypeError) ───────────────────────────────────
  it("descriptor null → TypeError", () => {
    expect(() =>
      assertRealDataResultIssueDescriptorIdentityConsistent(
        null as unknown as RealDataResultIssueDescriptor,
        HAPPY_RUN,
      ),
    ).toThrow(TypeError);
  });

  it("descriptor undefined → TypeError", () => {
    expect(() =>
      assertRealDataResultIssueDescriptorIdentityConsistent(
        undefined as unknown as RealDataResultIssueDescriptor,
        HAPPY_RUN,
      ),
    ).toThrow(TypeError);
  });

  it("descriptor 가 배열 → TypeError", () => {
    expect(() =>
      assertRealDataResultIssueDescriptorIdentityConsistent(
        [] as unknown as RealDataResultIssueDescriptor,
        HAPPY_RUN,
      ),
    ).toThrow(TypeError);
  });

  it("descriptor.title 이 string 아님 → TypeError", () => {
    const d = cloneDescriptor(composedDescriptor());
    (d as { title?: unknown }).title = 42;
    expect(() =>
      assertRealDataResultIssueDescriptorIdentityConsistent(
        d as RealDataResultIssueDescriptor,
        HAPPY_RUN,
      ),
    ).toThrow(TypeError);
  });

  it("descriptor.marker 가 string 아님 → TypeError", () => {
    const d = cloneDescriptor(composedDescriptor());
    (d as { marker?: unknown }).marker = null;
    expect(() =>
      assertRealDataResultIssueDescriptorIdentityConsistent(
        d as RealDataResultIssueDescriptor,
        HAPPY_RUN,
      ),
    ).toThrow(TypeError);
  });

  it("run null → TypeError", () => {
    expect(() =>
      assertRealDataResultIssueDescriptorIdentityConsistent(
        composedDescriptor(),
        null as unknown as RealDataResultIssueRunRef,
      ),
    ).toThrow(TypeError);
  });

  it("run 이 배열 → TypeError", () => {
    expect(() =>
      assertRealDataResultIssueDescriptorIdentityConsistent(
        composedDescriptor(),
        [] as unknown as RealDataResultIssueRunRef,
      ),
    ).toThrow(TypeError);
  });

  it("run.gitSha 가 string 아님 → TypeError", () => {
    expect(() =>
      assertRealDataResultIssueDescriptorIdentityConsistent(
        composedDescriptor(),
        {
          gitSha: 7,
          dateToken: "2026-06-23",
        } as unknown as RealDataResultIssueRunRef,
      ),
    ).toThrow(TypeError);
  });

  it("run.dateToken 이 string 아님 → TypeError", () => {
    expect(() =>
      assertRealDataResultIssueDescriptorIdentityConsistent(
        composedDescriptor(),
        {
          gitSha: "abc1234",
          dateToken: null,
        } as unknown as RealDataResultIssueRunRef,
      ),
    ).toThrow(TypeError);
  });

  // ── branch/flow: 빈/공백 식별자 거부 (값 정합 = RangeError) ────────────────
  it("negative (5)-a: run.gitSha 빈 문자열 → RangeError", () => {
    expect(() =>
      assertRealDataResultIssueDescriptorIdentityConsistent(
        composedDescriptor(),
        {
          gitSha: "",
          dateToken: "2026-06-23",
        },
      ),
    ).toThrow(RangeError);
  });

  it("negative (5)-b: run.gitSha 공백-only → RangeError", () => {
    expect(() =>
      assertRealDataResultIssueDescriptorIdentityConsistent(
        composedDescriptor(),
        {
          gitSha: "   ",
          dateToken: "2026-06-23",
        },
      ),
    ).toThrow(RangeError);
  });

  it("negative (5)-c: run.dateToken 빈 문자열 → RangeError", () => {
    expect(() =>
      assertRealDataResultIssueDescriptorIdentityConsistent(
        composedDescriptor(),
        {
          gitSha: "abc1234",
          dateToken: "",
        },
      ),
    ).toThrow(RangeError);
  });

  it("negative (5)-d: run.dateToken 공백-only → RangeError", () => {
    expect(() =>
      assertRealDataResultIssueDescriptorIdentityConsistent(
        composedDescriptor(),
        {
          gitSha: "abc1234",
          dateToken: "\t \n",
        },
      ),
    ).toThrow(RangeError);
  });

  // ── negative: title 재유도 mismatch (값 정합 = RangeError) ─────────────────
  it("negative (1)-a: descriptor.title 의 prefix 변형 → RangeError", () => {
    const d = cloneDescriptor(composedDescriptor());
    d.title = `다른 prefix 2026-06-23@abc1234`;
    expect(() =>
      assertRealDataResultIssueDescriptorIdentityConsistent(d, HAPPY_RUN),
    ).toThrow(RangeError);
  });

  it("negative (1)-b: descriptor.title 의 run token 변형 → RangeError", () => {
    const d = cloneDescriptor(composedDescriptor());
    d.title = `실 평가 e2e 결과 9999-99-99@tampered`;
    expect(() =>
      assertRealDataResultIssueDescriptorIdentityConsistent(d, HAPPY_RUN),
    ).toThrow(RangeError);
  });

  it("RangeError 메시지에 기대 vs 실측 노출(title mismatch)", () => {
    const d = cloneDescriptor(composedDescriptor());
    d.title = `실 평가 e2e 결과 wrong@token`;
    expect(() =>
      assertRealDataResultIssueDescriptorIdentityConsistent(d, HAPPY_RUN),
    ).toThrow(/기대=.*실측=/);
  });

  // ── negative: marker 재유도 mismatch (값 정합 = RangeError) ────────────────
  it("negative (2)-a: descriptor.marker 의 run token 변형 → RangeError", () => {
    const d = cloneDescriptor(composedDescriptor());
    d.marker = `<!-- realdata-e2e-result-issue: 1999-01-01@xxxxxxx -->`;
    expect(() =>
      assertRealDataResultIssueDescriptorIdentityConsistent(d, HAPPY_RUN),
    ).toThrow(RangeError);
  });

  it("negative (4)-a: marker 닫는 '-->' 누락 → RangeError", () => {
    const d = cloneDescriptor(composedDescriptor());
    d.marker = `<!-- realdata-e2e-result-issue: 2026-06-23@abc1234`;
    expect(() =>
      assertRealDataResultIssueDescriptorIdentityConsistent(d, HAPPY_RUN),
    ).toThrow(RangeError);
  });

  it("negative (4)-b: marker prefix 어긋남 → RangeError", () => {
    const d = cloneDescriptor(composedDescriptor());
    d.marker = `<!-- wrong-marker: 2026-06-23@abc1234 -->`;
    expect(() =>
      assertRealDataResultIssueDescriptorIdentityConsistent(d, HAPPY_RUN),
    ).toThrow(RangeError);
  });

  // ── negative (3): title·marker 가 서로 다른 run token (멱등 깨짐) ──────────
  it("negative (3): title 과 marker 가 서로 다른 run token → RangeError", () => {
    // run 자체는 title 과 정합하지만 marker 만 다른 run token 으로 손상시킨다. ① title 통과
    // 후 ② marker 재유도 대조에서 잡힌다(marker 가 run 으로부터 재유도한 expected 와 불일치).
    const d = cloneDescriptor(composedDescriptor());
    d.marker = `<!-- realdata-e2e-result-issue: 2099-12-31@abc1234 -->`;
    expect(() =>
      assertRealDataResultIssueDescriptorIdentityConsistent(d, HAPPY_RUN),
    ).toThrow(RangeError);
  });

  it("negative (3)-교차: title·marker 가 서로 다른 token 이면 ②(marker 재유도)가 catch", () => {
    // 멱등 불변식(동일 run → 동일 title·marker token)은 ①∧② 가 직접 보장한다 — title 은
    // HAPPY_RUN token 으로 정합(① 통과)하지만 marker 만 다른 run token 으로 손상시키면 ②
    // marker 재유도 대조가 RangeError 로 차단한다(token 불일치는 항상 RangeError).
    const d = cloneDescriptor(composedDescriptor());
    d.marker = `<!-- realdata-e2e-result-issue: 2000-01-01@deadbee -->`;
    let caught: unknown;
    try {
      assertRealDataResultIssueDescriptorIdentityConsistent(d, HAPPY_RUN);
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(RangeError);
  });

  // ── negative (6): 입력 비변형 / 결정론 ────────────────────────────────────
  it("negative (6): 가드가 입력 descriptor·run 을 변형하지 않는다(비변형)", () => {
    const descriptor = composedDescriptor();
    const run = { ...HAPPY_RUN };
    const descriptorSnapshot = JSON.stringify(descriptor);
    const runSnapshot = JSON.stringify(run);
    const runRef = run;
    assertRealDataResultIssueDescriptorIdentityConsistent(descriptor, run);
    expect(JSON.stringify(descriptor)).toBe(descriptorSnapshot);
    expect(JSON.stringify(run)).toBe(runSnapshot);
    expect(run).toBe(runRef);
  });

  it("동일 입력 반복 호출 → 동일 동작(결정론)", () => {
    const descriptor = composedDescriptor();
    expect(() =>
      assertRealDataResultIssueDescriptorIdentityConsistent(
        descriptor,
        HAPPY_RUN,
      ),
    ).not.toThrow();
    expect(() =>
      assertRealDataResultIssueDescriptorIdentityConsistent(
        descriptor,
        HAPPY_RUN,
      ),
    ).not.toThrow();
  });
});
