// evaluation-detection-signals-pipeline.ts 의 colocated unit test (CLAUDE.md §3.2
// R-112 — happy / error / branch / negative cases 충분 cover). detection-side 단일
// 진입 순수 composer `computeEvaluationAdjustmentSignals(deduped)` 가 5 detection
// helper(abuse → update-count → quality → underperformer → notable)를 v1 고정 순서로
// 위임 호출한 뒤 `EvaluationAdjustmentSignals` container 5 필드에 동명 매핑만 함을
// 박제한다. 위임 외 변환 0(byte-identical) · 결정성 · 무공유 · 입력 비변형 · 위임
// throw transparent 전파를 검증한다. 신규 파일 100% 지향.

import type {
  ActivityMetadata,
  ActivitySourceType,
} from "../../assessment-collection/domain/activity";

import { computeAbuseSignal } from "./evaluation-abuse-signal";
import { computeEvaluationAdjustmentSignals } from "./evaluation-detection-signals-pipeline";
import type { EvaluationInput } from "./evaluation-input";
import { computeNotableContributionSignal } from "./evaluation-notable-contribution-signal";
import { computeContributionQualitySignal } from "./evaluation-quality-signal";
import { computeUnderPerformerSignal } from "./evaluation-underperformer-signal";
import { computeUpdateCountNeutralization } from "./evaluation-update-count-neutral";

// EvaluationInput stub 빌더. volume 은 metadata.titleLength 로 산출되므로
// (evaluation-volume.ts) titleLength 로 저/고 volume 을 조절한다.
function makeInput(
  overrides: Partial<EvaluationInput> & { titleLength?: number } = {},
): EvaluationInput {
  const { titleLength, metadata, ...rest } = overrides;
  const finalMetadata: ActivityMetadata =
    metadata ??
    (titleLength === undefined ? {} : ({ titleLength } as ActivityMetadata));
  return {
    unitId: "github:sec:c1",
    contributionKind: "code",
    sourceType: "github",
    instanceKey: "sec",
    author: "gildong",
    timestamp: "2026-06-01T09:00:00Z",
    metadata: finalMetadata,
    ...rest,
  };
}

// code 단위 빌더 — author 별 codeUnitCount 조절용(고유 unitId).
function codeUnit(
  i: number,
  author: string,
  titleLength = 50,
): EvaluationInput {
  return makeInput({
    unitId: `github:sec:code-${author}-${i}`,
    author,
    contributionKind: "code",
    titleLength,
  });
}

// 저-volume 반복(같은 unitId) 단위 — abusing 시그니처(LOW_VOLUME × 반복).
function lowVolumeRepeated(author = "spammer"): EvaluationInput {
  return makeInput({
    unitId: "github:sec:dup",
    author,
    contributionKind: "code",
    titleLength: 1,
  });
}

describe("computeEvaluationAdjustmentSignals", () => {
  describe("happy-path — 5 detection 위임 결과와 deep-equal", () => {
    it("정상 fixture 에서 5 필드가 각 detection helper 직접 호출 결과와 deep-equal", () => {
      // 다수 author + 다수 code 단위 — 5 detection 모두 비-자명 산출이 나오는 fixture.
      const deduped: EvaluationInput[] = [
        codeUnit(1, "alice"),
        codeUnit(2, "alice"),
        codeUnit(3, "alice"),
        codeUnit(4, "alice"),
        lowVolumeRepeated("bob"),
        lowVolumeRepeated("bob"),
        lowVolumeRepeated("bob"),
      ];

      const signals = computeEvaluationAdjustmentSignals(deduped);

      // 5 필드 각각이 해당 helper 직접 호출 산출과 deep-equal(위임 외 변환 0).
      expect(signals.abuse).toEqual(computeAbuseSignal(deduped));
      expect(signals.updateCount).toEqual(
        computeUpdateCountNeutralization(deduped),
      );
      expect(signals.quality).toEqual(
        computeContributionQualitySignal(deduped),
      );
      expect(signals.underPerformer).toEqual(
        computeUnderPerformerSignal(deduped),
      );
      expect(signals.notableContribution).toEqual(
        computeNotableContributionSignal(deduped),
      );
    });

    it("container 가 정확히 5 필드(abuse/updateCount/quality/underPerformer/notableContribution)만 가진다", () => {
      const signals = computeEvaluationAdjustmentSignals([
        codeUnit(1, "alice"),
      ]);
      expect(Object.keys(signals).sort()).toEqual(
        [
          "abuse",
          "notableContribution",
          "quality",
          "underPerformer",
          "updateCount",
        ].sort(),
      );
    });
  });

  describe("byte-identical — 위임 외 변환 0 박제", () => {
    it("임의 fixture: 5 detection 직접 5 호출 결과와 composer 1 호출 결과가 각 필드 deep-equal", () => {
      const deduped: EvaluationInput[] = [
        codeUnit(1, "alice", 80),
        codeUnit(2, "bob", 10),
        lowVolumeRepeated("carol"),
        lowVolumeRepeated("carol"),
        makeInput({
          unitId: "conf:doc:1",
          author: "dave",
          contributionKind: "document",
          sourceType: "confluence" as ActivitySourceType,
          instanceKey: "wiki",
          titleLength: 40,
        }),
      ];

      const signals = computeEvaluationAdjustmentSignals(deduped);

      // 5 detection 을 직접 5 번 호출한 산출과 합성 산출의 5 필드가 각각 deep-equal.
      const direct = {
        abuse: computeAbuseSignal(deduped),
        updateCount: computeUpdateCountNeutralization(deduped),
        quality: computeContributionQualitySignal(deduped),
        underPerformer: computeUnderPerformerSignal(deduped),
        notableContribution: computeNotableContributionSignal(deduped),
      };
      expect(signals).toEqual(direct);
    });
  });

  describe("flow / branch 분기 cover", () => {
    it("(a) 빈 deduped [] → 5 필드 모두 빈 신호 채워진 container, throw 0", () => {
      const signals = computeEvaluationAdjustmentSignals([]);

      // 빈 입력에 대한 각 helper 의 빈 산출과 일치(throw 0).
      expect(signals.abuse).toEqual(computeAbuseSignal([]));
      expect(signals.updateCount).toEqual(computeUpdateCountNeutralization([]));
      expect(signals.quality).toEqual(computeContributionQualitySignal([]));
      expect(signals.underPerformer).toEqual(computeUnderPerformerSignal([]));
      expect(signals.notableContribution).toEqual(
        computeNotableContributionSignal([]),
      );
      // 빈 batch 식별 자명 — author 0.
      expect(signals.underPerformer.totalAuthorCount).toBe(0);
      expect(signals.notableContribution.totalAuthorCount).toBe(0);
    });

    it("(b) 정상 활동 다수 + 다수 author → 5 필드 모두 채워진 신호 산출(byAuthor 비-빈)", () => {
      // alice 평균 초과(notable 후보), bob 평균 미달(underperformer 후보) 가 갈리는
      // 비대칭 fixture — underperformer/notable 양쪽 detection 의 byAuthor 가 채워짐.
      const deduped: EvaluationInput[] = [
        codeUnit(1, "alice"),
        codeUnit(2, "alice"),
        codeUnit(3, "alice"),
        codeUnit(4, "alice"),
        codeUnit(5, "alice"),
        codeUnit(6, "bob"),
      ];

      const signals = computeEvaluationAdjustmentSignals(deduped);

      // 5 필드 모두 채워진 신호(2 author 가 byAuthor 에 등장).
      expect(signals.abuse.byAuthor.length).toBe(2);
      expect(signals.underPerformer.byAuthor.length).toBe(2);
      expect(signals.notableContribution.byAuthor.length).toBe(2);
      expect(signals.underPerformer.totalAuthorCount).toBe(2);
      // 합성이 직접 호출과 동일함을 재확인(분기별 정합).
      expect(signals.underPerformer).toEqual(
        computeUnderPerformerSignal(deduped),
      );
      expect(signals.notableContribution).toEqual(
        computeNotableContributionSignal(deduped),
      );
    });

    it("(c) 단일 author 단일 unit 경계 → underperformer/notable disjoint(둘 다 false), throw 0", () => {
      const deduped: EvaluationInput[] = [codeUnit(1, "solo")];

      const signals = computeEvaluationAdjustmentSignals(deduped);

      // 단독 author / 비교 대상 없음 → 보수적으로 underperformer / notable 둘 다 false.
      expect(signals.underPerformer.underPerformerDetected).toBe(false);
      expect(signals.notableContribution.byAuthor.length).toBe(1);
      // 합성이 직접 호출과 정합(경계에서도 위임 transparent).
      expect(signals).toEqual({
        abuse: computeAbuseSignal(deduped),
        updateCount: computeUpdateCountNeutralization(deduped),
        quality: computeContributionQualitySignal(deduped),
        underPerformer: computeUnderPerformerSignal(deduped),
        notableContribution: computeNotableContributionSignal(deduped),
      });
    });
  });

  describe("error path / negative cases 충분 cover (5 위임 경계 분리)", () => {
    it("(1) deduped 가 null → 한국어 TypeError(메시지에 deduped 포함)", () => {
      expect(() =>
        computeEvaluationAdjustmentSignals(
          null as unknown as EvaluationInput[],
        ),
      ).toThrow(TypeError);
      expect(() =>
        computeEvaluationAdjustmentSignals(
          null as unknown as EvaluationInput[],
        ),
      ).toThrow(/deduped/);
    });

    it("(2) deduped 가 undefined → 한국어 TypeError(메시지에 deduped 포함)", () => {
      expect(() =>
        computeEvaluationAdjustmentSignals(
          undefined as unknown as EvaluationInput[],
        ),
      ).toThrow(TypeError);
      expect(() =>
        computeEvaluationAdjustmentSignals(
          undefined as unknown as EvaluationInput[],
        ),
      ).toThrow(/deduped/);
    });

    it("(3) deduped 가 배열 아닌 객체 → 위임 helper guard 에서 throw 전파(본 composer array check 없음)", () => {
      // {} 는 .forEach 미보유 → 첫 위임 computeAbuseSignal 내부에서 TypeError.
      // 본 composer 는 별도 array check 를 두지 않으므로 그 error 가 그대로 전파된다.
      expect(() =>
        computeEvaluationAdjustmentSignals({} as unknown as EvaluationInput[]),
      ).toThrow();
    });

    it("(3') deduped 가 문자열 → 위임 helper 에서 throw 전파", () => {
      // 문자열은 forEach 미보유(Array 아님) → 위임 helper 내부 throw 전파.
      expect(() =>
        computeEvaluationAdjustmentSignals(
          "not-an-array" as unknown as EvaluationInput[],
        ),
      ).toThrow();
    });

    it("(4) 위임 helper 가 throw 하는 malformed 입력 → 그 error 가 composer 통해 전파(자체 try/catch 0)", () => {
      // 원소가 null → 첫 위임 computeAbuseSignal 의 input.author 접근에서 throw.
      const malformed = [null] as unknown as EvaluationInput[];
      expect(() => computeEvaluationAdjustmentSignals(malformed)).toThrow();
    });

    it("(5) author 1 종뿐인 경계(평균이 자기 자신) → 5 필드 정상 산출, throw 0(underperformer/notable false)", () => {
      // 같은 author 의 다수 code 단위 — 비교 대상(타 author) 없어 평균이 자기 자신.
      const deduped: EvaluationInput[] = [
        codeUnit(1, "solo"),
        codeUnit(2, "solo"),
        codeUnit(3, "solo"),
      ];

      const signals = computeEvaluationAdjustmentSignals(deduped);

      expect(signals.underPerformer.underPerformerDetected).toBe(false);
      expect(signals.notableContribution.byAuthor.length).toBe(1);
      // 5 필드 모두 정상 산출 — throw 0.
      expect(signals.abuse).toEqual(computeAbuseSignal(deduped));
      expect(signals.quality).toEqual(
        computeContributionQualitySignal(deduped),
      );
    });
  });

  describe("무변형 · 결정론 · 무공유", () => {
    it("동일 입력 2 회 호출 → deep-equal(byte-identical) 산출", () => {
      const deduped: EvaluationInput[] = [
        codeUnit(1, "alice"),
        codeUnit(2, "bob"),
        lowVolumeRepeated("carol"),
        lowVolumeRepeated("carol"),
      ];

      const first = computeEvaluationAdjustmentSignals(deduped);
      const second = computeEvaluationAdjustmentSignals(deduped);

      expect(first).toEqual(second);
    });

    it("입력 deduped mutate 0 — 배열·원소 비변형", () => {
      const deduped: EvaluationInput[] = [
        codeUnit(1, "alice"),
        codeUnit(2, "bob"),
      ];
      const snapshot = JSON.parse(JSON.stringify(deduped));
      const lengthBefore = deduped.length;

      computeEvaluationAdjustmentSignals(deduped);

      // 길이·원소 모두 변형 0(deep snapshot 일치).
      expect(deduped.length).toBe(lengthBefore);
      expect(deduped).toEqual(snapshot);
    });

    it("산출 container 가 입력 deduped 와 not-same-ref(새 객체)", () => {
      const deduped: EvaluationInput[] = [codeUnit(1, "alice")];
      const signals = computeEvaluationAdjustmentSignals(deduped);
      // container 는 새 객체 리터럴 — 입력 배열과 동일 ref 가 아님.
      expect(signals as unknown).not.toBe(deduped as unknown);
    });
  });
});
