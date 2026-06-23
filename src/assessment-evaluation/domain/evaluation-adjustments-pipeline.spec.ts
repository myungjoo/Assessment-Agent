// evaluation-adjustments-pipeline.ts 의 colocated unit test (CLAUDE.md §3.2 R-112 —
// happy / error / branch / negative cases 충분 cover). `applyEvaluationAdjustments`
// 결정적 순수 composer 의 5-step thread(abuse → update-count → quality →
// underperformer → notable → flatten) 가 orchestrator inline chain 과 byte-identical
// 한 산출을 내는지를 검증한다. service mock(LLM scoring) 없이 5 위임 helper 의 직접
// thread 만으로 검증 가능한 것이 본 composer 추출의 핵심 ROI 다.
//
// 검증 축(R-112 4 종 + 결정성/비변형):
//   - happy: 5 signal 모두 정상 → 5 step 산출이 entries 의 result 위에 결정적으로
//     반영(volume 감점 + 중립 + contribution floor + 두 narrative marker).
//   - error: entries / signals / signals 의 각 5 필드 null/undefined → `TypeError`.
//     위임 helper 가 던지는 throw 는 composer 가 잡지 않고 전파.
//   - branch: 빈 entries 경로 / 5 signal 모두 무대상 경로 / 일부 author 만 대상
//     혼합 경로.
//   - negative: 5 signal 각 필드 누락 / entries 가 배열 아님 / 위임 helper 가 던질
//     수 있는 입력 정합 — 각 위임 경계마다 1+ test.
//   - 결정성·무공유: 동일 입력 2 회 호출 deep-equal + 입력 mutate 0 + 산출 not-same-ref.

import type { AbuseSignal } from "./evaluation-abuse-signal";
import {
  applyEvaluationAdjustments,
  type EvaluationAdjustEntry,
  type EvaluationAdjustmentSignals,
} from "./evaluation-adjustments-pipeline";
import { NOTABLE_CONTRIBUTION_NARRATIVE_MARKER } from "./evaluation-notable-contribution-adjust";
import type { NotableContributionSignal } from "./evaluation-notable-contribution-signal";
import type { ContributionQualitySignal } from "./evaluation-quality-signal";
import type { EvaluationResult } from "./evaluation-result";
import { UNDERPERFORMER_NARRATIVE_MARKER } from "./evaluation-underperformer-adjust";
import type { UnderPerformerSignal } from "./evaluation-underperformer-signal";
import type { UpdateCountNeutralization } from "./evaluation-update-count-neutral";

// EvaluationResult stub 빌더. 5 step thread 검증을 위해 4 필드(narrative /
// difficulty / contribution / volume) 모두 다룰 수 있게 overrides 받는다.
function makeResult(
  overrides: Partial<EvaluationResult> = {},
): EvaluationResult {
  return {
    unitId: "github:sec:c1",
    narrative: "정상 기여",
    difficulty: "medium",
    contribution: "medium",
    volume: 100,
    ...overrides,
  };
}

// 빈 5 signal — 모두 "무대상"(byAuthor 가 빈 배열, detected/suspected flag false)
// 인 결정적 패시브 신호 묶음. 5 step 전부 무변경 passthrough 경로의 baseline.
function makeEmptySignals(): EvaluationAdjustmentSignals {
  const abuse: AbuseSignal = {
    totalUnitCount: 0,
    byAuthor: [],
    suspected: false,
  };
  const updateCount: UpdateCountNeutralization = {
    totalUnitCount: 0,
    totalNeutralizedCount: 0,
    byAuthor: [],
    neutralized: false,
  };
  const quality: ContributionQualitySignal = {
    totalUnitCount: 0,
    totalZeroContributionCount: 0,
    byAuthor: [],
    zeroContributionDetected: false,
  };
  const underPerformer: UnderPerformerSignal = {
    totalAuthorCount: 0,
    meanCodeUnitCount: 0,
    byAuthor: [],
    underPerformerDetected: false,
  };
  const notableContribution: NotableContributionSignal = {
    totalAuthorCount: 0,
    meanCodeUnitCount: 0,
    byAuthor: [],
    notableDetected: false,
  };
  return { abuse, updateCount, quality, underPerformer, notableContribution };
}

describe("applyEvaluationAdjustments", () => {
  describe("happy path", () => {
    it("5 signal 모두 정상 동작 시 5-step thread 산출을 결정적으로 산출한다", () => {
      // 시나리오: spammer 는 abuse suspected(volume 감점), neutral-doc-author 는
      // update-count 중립(volume base 보존), zero-author 는 quality floor 강등
      // (contribution → "zero"), under-author 는 저성과(narrative `[저성과자] `
      // 접두), notable-author 는 중요기여(narrative `[중요기여] ` 접두).
      const entries: EvaluationAdjustEntry[] = [
        {
          author: "spammer",
          result: makeResult({ unitId: "u1", volume: 100 }),
        },
        {
          author: "neutral-doc-author",
          result: makeResult({ unitId: "u2", volume: 50 }),
        },
        {
          author: "zero-author",
          result: makeResult({ unitId: "u3", contribution: "medium" }),
        },
        {
          author: "under-author",
          result: makeResult({ unitId: "u4", narrative: "기여 정성 평가문" }),
        },
        {
          author: "notable-author",
          result: makeResult({ unitId: "u5", narrative: "기여 정성 평가문" }),
        },
      ];

      const signals: EvaluationAdjustmentSignals = {
        abuse: {
          totalUnitCount: 1,
          byAuthor: [
            {
              author: "spammer",
              unitCount: 4,
              lowVolumeUnitCount: 3,
              repetitionRatio: 0.75,
              suspected: true,
              byKind: {
                code: {
                  unitCount: 0,
                  lowVolumeUnitCount: 0,
                  repeatedUnitCount: 0,
                },
                document: {
                  unitCount: 0,
                  lowVolumeUnitCount: 0,
                  repeatedUnitCount: 0,
                },
              },
            },
          ],
          suspected: true,
        },
        updateCount: {
          totalUnitCount: 1,
          totalNeutralizedCount: 1,
          byAuthor: [
            {
              author: "neutral-doc-author",
              neutralizedCount: 1,
              neutralizedUnitIds: ["u2"],
              neutralized: true,
            },
          ],
          neutralized: true,
        },
        quality: {
          totalUnitCount: 1,
          totalZeroContributionCount: 1,
          byAuthor: [
            {
              author: "zero-author",
              zeroContributionCount: 1,
              zeroContributionUnitIds: ["u3"],
              zeroContribution: true,
            },
          ],
          zeroContributionDetected: true,
        },
        underPerformer: {
          totalAuthorCount: 1,
          meanCodeUnitCount: 5,
          byAuthor: [
            { author: "under-author", codeUnitCount: 1, underPerformer: true },
          ],
          underPerformerDetected: true,
        },
        notableContribution: {
          totalAuthorCount: 1,
          meanCodeUnitCount: 5,
          byAuthor: [
            { author: "notable-author", codeUnitCount: 10, notable: true },
          ],
          notableDetected: true,
        },
      };

      const out = applyEvaluationAdjustments(entries, signals);

      // 길이 / 순서 보존.
      expect(out).toHaveLength(5);
      expect(out.map((r) => r.unitId)).toEqual(["u1", "u2", "u3", "u4", "u5"]);

      // (1) spammer: volume 감점 — floor(100 * (1 - 0.75)) = 25.
      expect(out[0].volume).toBe(25);
      // (2) neutral-doc-author: 중립 보존 — base volume 50 그대로(floor 적용).
      expect(out[1].volume).toBe(50);
      // (3) zero-author: contribution "medium" → "zero" floor 강등.
      expect(out[2].contribution).toBe("zero");
      // (4) under-author: narrative 앞에 `[저성과자] ` marker 접두.
      expect(out[3].narrative).toBe(
        `${UNDERPERFORMER_NARRATIVE_MARKER}기여 정성 평가문`,
      );
      // (5) notable-author: narrative 앞에 `[중요기여] ` marker 접두.
      expect(out[4].narrative).toBe(
        `${NOTABLE_CONTRIBUTION_NARRATIVE_MARKER}기여 정성 평가문`,
      );
    });

    it("동일 author 가 underperformer + notable 둘 다 표적이면 두 marker 가 순차 접두된다", () => {
      // 임계 분리(평균 × 0.5↓ vs × 1.5↑ — disjoint)로 실 detection 에서는 발생하지
      // 않지만 spec 박제: underperformer 먼저 접두된 narrative 위에 notable marker
      // 가 다시 접두되어 `[중요기여] [저성과자] 본문` 순서.
      const entries: EvaluationAdjustEntry[] = [
        {
          author: "edge",
          result: makeResult({ unitId: "u1", narrative: "본문" }),
        },
      ];
      const signals = makeEmptySignals();
      signals.underPerformer = {
        ...signals.underPerformer,
        byAuthor: [{ author: "edge", codeUnitCount: 1, underPerformer: true }],
        underPerformerDetected: true,
      };
      signals.notableContribution = {
        ...signals.notableContribution,
        byAuthor: [{ author: "edge", codeUnitCount: 1, notable: true }],
        notableDetected: true,
      };

      const out = applyEvaluationAdjustments(entries, signals);

      expect(out[0].narrative).toBe(
        `${NOTABLE_CONTRIBUTION_NARRATIVE_MARKER}${UNDERPERFORMER_NARRATIVE_MARKER}본문`,
      );
    });
  });

  describe("branch coverage", () => {
    it("빈 entries → 빈 배열 반환(5 위임 무변경 통과)", () => {
      const out = applyEvaluationAdjustments([], makeEmptySignals());
      expect(out).toEqual([]);
    });

    it("모든 signal 이 무대상이면 entries 의 result 가 무변경 복제된다", () => {
      const entries: EvaluationAdjustEntry[] = [
        {
          author: "a1",
          result: makeResult({ unitId: "u1", narrative: "본문1", volume: 7 }),
        },
        {
          author: "a2",
          result: makeResult({
            unitId: "u2",
            narrative: "본문2",
            contribution: "high",
          }),
        },
      ];
      const out = applyEvaluationAdjustments(entries, makeEmptySignals());

      expect(out).toHaveLength(2);
      // 필드 무변경 — 5 step 모두 passthrough.
      expect(out[0].volume).toBe(7);
      expect(out[0].narrative).toBe("본문1");
      expect(out[0].contribution).toBe("medium");
      expect(out[1].contribution).toBe("high");
      expect(out[1].narrative).toBe("본문2");
      // 입력 객체와 not-same-ref(복제 보장).
      expect(out[0]).not.toBe(entries[0].result);
      expect(out[1]).not.toBe(entries[1].result);
    });

    it("일부 author 만 대상인 혼합 입력에서 비대상 author 는 그대로 통과한다", () => {
      // spammer 만 abuse 표적, normal 은 어떤 signal 도 표적 아님 — normal 의 result
      // 는 그대로 통과해야 한다.
      const entries: EvaluationAdjustEntry[] = [
        { author: "spammer", result: makeResult({ unitId: "u1", volume: 80 }) },
        { author: "normal", result: makeResult({ unitId: "u2", volume: 80 }) },
      ];
      const signals = makeEmptySignals();
      signals.abuse = {
        totalUnitCount: 1,
        byAuthor: [
          {
            author: "spammer",
            unitCount: 4,
            lowVolumeUnitCount: 3,
            repetitionRatio: 0.5,
            suspected: true,
            byKind: {
              code: {
                unitCount: 0,
                lowVolumeUnitCount: 0,
                repeatedUnitCount: 0,
              },
              document: {
                unitCount: 0,
                lowVolumeUnitCount: 0,
                repeatedUnitCount: 0,
              },
            },
          },
        ],
        suspected: true,
      };

      const out = applyEvaluationAdjustments(entries, signals);
      // spammer: floor(80 * (1 - 0.5)) = 40.
      expect(out[0].volume).toBe(40);
      // normal: 무대상이므로 그대로.
      expect(out[1].volume).toBe(80);
    });
  });

  describe("error path", () => {
    it("entries 가 null 이면 한국어 TypeError 를 던진다", () => {
      expect(() =>
        applyEvaluationAdjustments(
          null as unknown as EvaluationAdjustEntry[],
          makeEmptySignals(),
        ),
      ).toThrow(TypeError);
      expect(() =>
        applyEvaluationAdjustments(
          null as unknown as EvaluationAdjustEntry[],
          makeEmptySignals(),
        ),
      ).toThrow("entries 는 null 또는 undefined 일 수 없습니다.");
    });

    it("entries 가 undefined 이면 한국어 TypeError 를 던진다", () => {
      expect(() =>
        applyEvaluationAdjustments(
          undefined as unknown as EvaluationAdjustEntry[],
          makeEmptySignals(),
        ),
      ).toThrow(TypeError);
    });

    it("signals 가 null 이면 한국어 TypeError 를 던진다", () => {
      expect(() =>
        applyEvaluationAdjustments(
          [],
          null as unknown as EvaluationAdjustmentSignals,
        ),
      ).toThrow("signals 는 null 또는 undefined 일 수 없습니다.");
    });

    it("signals 가 undefined 이면 한국어 TypeError 를 던진다", () => {
      expect(() =>
        applyEvaluationAdjustments(
          [],
          undefined as unknown as EvaluationAdjustmentSignals,
        ),
      ).toThrow(TypeError);
    });

    it("위임 helper 가 throw 하는 입력(signal.byAuthor undefined)에서 composer 는 잡지 않고 전파한다", () => {
      // applyAbuseSignalToVolume 의 `signal.byAuthor.map(...)` 는 byAuthor 가
      // undefined 이면 TypeError 를 던진다. composer 는 try/catch 0 이므로 그대로 전파.
      const signals = makeEmptySignals();
      signals.abuse = {
        ...signals.abuse,
        byAuthor: undefined as unknown as AbuseSignal["byAuthor"],
      };
      const entries: EvaluationAdjustEntry[] = [
        { author: "a", result: makeResult() },
      ];
      expect(() => applyEvaluationAdjustments(entries, signals)).toThrow(
        TypeError,
      );
    });
  });

  describe("negative cases — 5 signal 필드 누락 (각 step 경계 cover)", () => {
    it("signals.abuse 가 null 이면 한국어 TypeError 를 던진다(step 1 guard)", () => {
      const signals = makeEmptySignals();
      signals.abuse = null as unknown as AbuseSignal;
      expect(() => applyEvaluationAdjustments([], signals)).toThrow(
        "signals.abuse 는 null 또는 undefined 일 수 없습니다.",
      );
    });

    it("signals.abuse 가 undefined 이면 한국어 TypeError 를 던진다(step 1 guard)", () => {
      const signals = makeEmptySignals();
      signals.abuse = undefined as unknown as AbuseSignal;
      expect(() => applyEvaluationAdjustments([], signals)).toThrow(TypeError);
    });

    it("signals.updateCount 가 null 이면 한국어 TypeError 를 던진다(step 2 guard)", () => {
      const signals = makeEmptySignals();
      signals.updateCount = null as unknown as UpdateCountNeutralization;
      expect(() => applyEvaluationAdjustments([], signals)).toThrow(
        "signals.updateCount 는 null 또는 undefined 일 수 없습니다.",
      );
    });

    it("signals.updateCount 가 undefined 이면 한국어 TypeError 를 던진다(step 2 guard)", () => {
      const signals = makeEmptySignals();
      signals.updateCount = undefined as unknown as UpdateCountNeutralization;
      expect(() => applyEvaluationAdjustments([], signals)).toThrow(TypeError);
    });

    it("signals.quality 가 null 이면 한국어 TypeError 를 던진다(step 3 guard)", () => {
      const signals = makeEmptySignals();
      signals.quality = null as unknown as ContributionQualitySignal;
      expect(() => applyEvaluationAdjustments([], signals)).toThrow(
        "signals.quality 는 null 또는 undefined 일 수 없습니다.",
      );
    });

    it("signals.quality 가 undefined 이면 한국어 TypeError 를 던진다(step 3 guard)", () => {
      const signals = makeEmptySignals();
      signals.quality = undefined as unknown as ContributionQualitySignal;
      expect(() => applyEvaluationAdjustments([], signals)).toThrow(TypeError);
    });

    it("signals.underPerformer 가 null 이면 한국어 TypeError 를 던진다(step 4 guard)", () => {
      const signals = makeEmptySignals();
      signals.underPerformer = null as unknown as UnderPerformerSignal;
      expect(() => applyEvaluationAdjustments([], signals)).toThrow(
        "signals.underPerformer 는 null 또는 undefined 일 수 없습니다.",
      );
    });

    it("signals.underPerformer 가 undefined 이면 한국어 TypeError 를 던진다(step 4 guard)", () => {
      const signals = makeEmptySignals();
      signals.underPerformer = undefined as unknown as UnderPerformerSignal;
      expect(() => applyEvaluationAdjustments([], signals)).toThrow(TypeError);
    });

    it("signals.notableContribution 이 null 이면 한국어 TypeError 를 던진다(step 5 guard)", () => {
      const signals = makeEmptySignals();
      signals.notableContribution =
        null as unknown as NotableContributionSignal;
      expect(() => applyEvaluationAdjustments([], signals)).toThrow(
        "signals.notableContribution 은 null 또는 undefined 일 수 없습니다.",
      );
    });

    it("signals.notableContribution 이 undefined 이면 한국어 TypeError 를 던진다(step 5 guard)", () => {
      const signals = makeEmptySignals();
      signals.notableContribution =
        undefined as unknown as NotableContributionSignal;
      expect(() => applyEvaluationAdjustments([], signals)).toThrow(TypeError);
    });
  });

  describe("결정성·무변형·무공유", () => {
    it("동일 입력 2 회 호출 시 deep-equal(byte-identical) 산출", () => {
      const entries: EvaluationAdjustEntry[] = [
        { author: "a1", result: makeResult({ unitId: "u1" }) },
        { author: "a2", result: makeResult({ unitId: "u2" }) },
      ];
      const signals = makeEmptySignals();

      const first = applyEvaluationAdjustments(entries, signals);
      const second = applyEvaluationAdjustments(entries, signals);

      expect(first).toEqual(second);
      // not-same-ref — 결정성과 별개로 호출마다 새 배열을 산출한다.
      expect(first).not.toBe(second);
    });

    it("입력 entries 와 signals 를 변형하지 않는다", () => {
      const entries: EvaluationAdjustEntry[] = [
        {
          author: "spammer",
          result: makeResult({ unitId: "u1", volume: 100 }),
        },
      ];
      const signals: EvaluationAdjustmentSignals = {
        ...makeEmptySignals(),
        abuse: {
          totalUnitCount: 1,
          byAuthor: [
            {
              author: "spammer",
              unitCount: 4,
              lowVolumeUnitCount: 3,
              repetitionRatio: 0.5,
              suspected: true,
              byKind: {
                code: {
                  unitCount: 0,
                  lowVolumeUnitCount: 0,
                  repeatedUnitCount: 0,
                },
                document: {
                  unitCount: 0,
                  lowVolumeUnitCount: 0,
                  repeatedUnitCount: 0,
                },
              },
            },
          ],
          suspected: true,
        },
      };
      const entriesSnap = JSON.parse(JSON.stringify(entries));
      const signalsSnap = JSON.parse(JSON.stringify(signals));

      applyEvaluationAdjustments(entries, signals);

      // 입력 deep-equal 보존 — 변형 0.
      expect(entries).toEqual(entriesSnap);
      expect(signals).toEqual(signalsSnap);
    });

    it("산출 배열은 입력 entries 배열과 not-same-ref(새 배열)", () => {
      const entries: EvaluationAdjustEntry[] = [
        { author: "a", result: makeResult() },
      ];
      const out = applyEvaluationAdjustments(entries, makeEmptySignals());
      expect(out).not.toBe(entries as unknown as EvaluationResult[]);
      // 산출 result 객체도 새 객체(위임 helper 가 모두 새 객체로 복제).
      expect(out[0]).not.toBe(entries[0].result);
    });
  });
});
