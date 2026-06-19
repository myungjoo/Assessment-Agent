// evaluation-abuse-adjust.ts 의 colocated unit test (CLAUDE.md §3.2 R-112 — happy /
// error / branch / negative cases 충분 cover). `applyAbuseSignalToVolume` 순수
// 함수의 결정적 volume 감점/중립화(suspected true/false 분기 + repetitionRatio
// 경계 0/0.5/1.0 + volume 0 + author 미매칭 + 빈 입력 + 입력 비변형 + 결정성)를
// 검증한다. 신규 파일 100% 지향 — 모든 분기를 cover 한다.

import {
  ABUSE_VOLUME_PENALTY_FLOOR,
  ABUSE_VOLUME_RETENTION_MIN,
  applyAbuseSignalToVolume,
  type AbuseAdjustEntry,
} from "./evaluation-abuse-adjust";
import type { AbuseSignal, AuthorAbuseSignal } from "./evaluation-abuse-signal";
import type { EvaluationResult } from "./evaluation-result";

// EvaluationResult stub 빌더. 본 helper 는 volume 만 조정하므로 나머지 필드는 고정.
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

// AuthorAbuseSignal stub 빌더. byKind 는 본 helper 가 참조하지 않으므로 최소 0 채움.
function makeAuthorSignal(
  overrides: Partial<AuthorAbuseSignal> = {},
): AuthorAbuseSignal {
  return {
    author: "spammer",
    unitCount: 4,
    lowVolumeUnitCount: 3,
    repetitionRatio: 0.75,
    suspected: true,
    byKind: {
      code: { unitCount: 0, lowVolumeUnitCount: 0, repeatedUnitCount: 0 },
      document: { unitCount: 0, lowVolumeUnitCount: 0, repeatedUnitCount: 0 },
    },
    ...overrides,
  };
}

// AbuseSignal stub 빌더.
function makeSignal(byAuthor: AuthorAbuseSignal[]): AbuseSignal {
  return {
    totalUnitCount: byAuthor.reduce((s, a) => s + a.unitCount, 0),
    byAuthor,
    suspected: byAuthor.some((a) => a.suspected),
  };
}

describe("applyAbuseSignalToVolume", () => {
  describe("happy path", () => {
    it("suspected author 의 volume 을 repetitionRatio 비례로 감점한다", () => {
      const entries: AbuseAdjustEntry[] = [
        { author: "spammer", result: makeResult({ volume: 100 }) },
      ];
      const signal = makeSignal([
        makeAuthorSignal({
          author: "spammer",
          repetitionRatio: 0.75,
          suspected: true,
        }),
      ]);

      const out = applyAbuseSignalToVolume(entries, signal);

      // floor(100 * (1 - 0.75)) = floor(25) = 25.
      expect(out[0].result.volume).toBe(25);
      // author 와 나머지 필드는 전사.
      expect(out[0].author).toBe("spammer");
      expect(out[0].result.unitId).toBe("github:sec:c1");
      expect(out[0].result.narrative).toBe("정상 기여");
    });

    it("non-suspected author 의 volume 은 무변경(중립)이다", () => {
      const entries: AbuseAdjustEntry[] = [
        { author: "gildong", result: makeResult({ volume: 80 }) },
      ];
      const signal = makeSignal([
        makeAuthorSignal({
          author: "gildong",
          repetitionRatio: 0.1,
          suspected: false,
        }),
      ]);

      const out = applyAbuseSignalToVolume(entries, signal);

      expect(out[0].result.volume).toBe(80);
    });

    it("suspected/non-suspected author 가 섞인 batch 를 각각 규칙대로 처리한다", () => {
      const entries: AbuseAdjustEntry[] = [
        { author: "spammer", result: makeResult({ unitId: "u1", volume: 40 }) },
        { author: "gildong", result: makeResult({ unitId: "u2", volume: 40 }) },
      ];
      const signal = makeSignal([
        makeAuthorSignal({
          author: "spammer",
          repetitionRatio: 0.5,
          suspected: true,
        }),
        makeAuthorSignal({
          author: "gildong",
          repetitionRatio: 0.0,
          suspected: false,
        }),
      ]);

      const out = applyAbuseSignalToVolume(entries, signal);

      // floor(40 * (1 - 0.5)) = 20.
      expect(out[0].result.volume).toBe(20);
      // 무변경.
      expect(out[1].result.volume).toBe(40);
    });
  });

  describe("error path (명시적 입력 계약 위반)", () => {
    it("entries 가 null 이면 한국어 TypeError throw", () => {
      const signal = makeSignal([]);
      expect(() =>
        applyAbuseSignalToVolume(null as unknown as AbuseAdjustEntry[], signal),
      ).toThrow(TypeError);
      expect(() =>
        applyAbuseSignalToVolume(null as unknown as AbuseAdjustEntry[], signal),
      ).toThrow("entries 는 null 또는 undefined 일 수 없습니다.");
    });

    it("entries 가 undefined 이면 한국어 TypeError throw", () => {
      const signal = makeSignal([]);
      expect(() =>
        applyAbuseSignalToVolume(
          undefined as unknown as AbuseAdjustEntry[],
          signal,
        ),
      ).toThrow("entries 는 null 또는 undefined 일 수 없습니다.");
    });

    it("signal 이 null 이면 한국어 TypeError throw", () => {
      expect(() =>
        applyAbuseSignalToVolume([], null as unknown as AbuseSignal),
      ).toThrow("signal 은 null 또는 undefined 일 수 없습니다.");
    });

    it("signal 이 undefined 이면 한국어 TypeError throw", () => {
      expect(() =>
        applyAbuseSignalToVolume([], undefined as unknown as AbuseSignal),
      ).toThrow("signal 은 null 또는 undefined 일 수 없습니다.");
    });
  });

  describe("branch / repetitionRatio 경계", () => {
    it("repetitionRatio === 0 이면 suspected 라도 volume 무변경(감점 0)", () => {
      const entries: AbuseAdjustEntry[] = [
        { author: "spammer", result: makeResult({ volume: 60 }) },
      ];
      const signal = makeSignal([
        makeAuthorSignal({
          author: "spammer",
          repetitionRatio: 0,
          suspected: true,
        }),
      ]);

      const out = applyAbuseSignalToVolume(entries, signal);

      // floor(60 * (1 - 0)) = 60.
      expect(out[0].result.volume).toBe(60);
    });

    it("repetitionRatio === 0.5 이면 절반 감점", () => {
      const entries: AbuseAdjustEntry[] = [
        { author: "spammer", result: makeResult({ volume: 50 }) },
      ];
      const signal = makeSignal([
        makeAuthorSignal({
          author: "spammer",
          repetitionRatio: 0.5,
          suspected: true,
        }),
      ]);

      const out = applyAbuseSignalToVolume(entries, signal);

      expect(out[0].result.volume).toBe(25);
    });

    it("repetitionRatio === 1.0 이면 전량 감점(volume 0)", () => {
      const entries: AbuseAdjustEntry[] = [
        { author: "spammer", result: makeResult({ volume: 99 }) },
      ];
      const signal = makeSignal([
        makeAuthorSignal({
          author: "spammer",
          repetitionRatio: 1,
          suspected: true,
        }),
      ]);

      const out = applyAbuseSignalToVolume(entries, signal);

      // floor(99 * (1 - 1)) = 0, FLOOR(0) 절하.
      expect(out[0].result.volume).toBe(ABUSE_VOLUME_PENALTY_FLOOR);
      expect(out[0].result.volume).toBe(0);
    });

    it("author 미매칭(signal.byAuthor 에 없는 author) → 무변경", () => {
      const entries: AbuseAdjustEntry[] = [
        { author: "unknown", result: makeResult({ volume: 70 }) },
      ];
      const signal = makeSignal([
        makeAuthorSignal({
          author: "spammer",
          repetitionRatio: 1,
          suspected: true,
        }),
      ]);

      const out = applyAbuseSignalToVolume(entries, signal);

      expect(out[0].result.volume).toBe(70);
    });

    it("volume 0 입력 → suspected 라도 0 유지(음수 방지)", () => {
      const entries: AbuseAdjustEntry[] = [
        { author: "spammer", result: makeResult({ volume: 0 }) },
      ];
      const signal = makeSignal([
        makeAuthorSignal({
          author: "spammer",
          repetitionRatio: 0.9,
          suspected: true,
        }),
      ]);

      const out = applyAbuseSignalToVolume(entries, signal);

      expect(out[0].result.volume).toBe(0);
    });

    it("비유한 repetitionRatio(NaN) → ratio 0 절하로 무변경", () => {
      const entries: AbuseAdjustEntry[] = [
        { author: "spammer", result: makeResult({ volume: 30 }) },
      ];
      const signal = makeSignal([
        makeAuthorSignal({
          author: "spammer",
          repetitionRatio: NaN,
          suspected: true,
        }),
      ]);

      const out = applyAbuseSignalToVolume(entries, signal);

      expect(out[0].result.volume).toBe(30);
    });

    it("범위 초과 repetitionRatio(>1) → 1 로 절하해 전량 감점", () => {
      const entries: AbuseAdjustEntry[] = [
        { author: "spammer", result: makeResult({ volume: 30 }) },
      ];
      const signal = makeSignal([
        makeAuthorSignal({
          author: "spammer",
          repetitionRatio: 1.5,
          suspected: true,
        }),
      ]);

      const out = applyAbuseSignalToVolume(entries, signal);

      expect(out[0].result.volume).toBe(0);
    });

    it("비유한/음수 volume → 0 으로 방어 절하(suspected)", () => {
      const entries: AbuseAdjustEntry[] = [
        { author: "spammer", result: makeResult({ volume: -10 }) },
      ];
      const signal = makeSignal([
        makeAuthorSignal({
          author: "spammer",
          repetitionRatio: 0.3,
          suspected: true,
        }),
      ]);

      const out = applyAbuseSignalToVolume(entries, signal);

      expect(out[0].result.volume).toBe(0);
    });
  });

  describe("negative cases (예외 분기마다)", () => {
    it("빈 entries 배열 → 빈 배열 반환", () => {
      const out = applyAbuseSignalToVolume([], makeSignal([]));
      expect(out).toEqual([]);
    });

    it("빈 signal.byAuthor → 전 단위 무변경 복제", () => {
      const entries: AbuseAdjustEntry[] = [
        { author: "spammer", result: makeResult({ volume: 55 }) },
        { author: "gildong", result: makeResult({ volume: 44 }) },
      ];
      const out = applyAbuseSignalToVolume(entries, makeSignal([]));
      expect(out[0].result.volume).toBe(55);
      expect(out[1].result.volume).toBe(44);
    });

    it("동일 author 다수 단위 → 모두 동일 규칙 적용", () => {
      const entries: AbuseAdjustEntry[] = [
        { author: "spammer", result: makeResult({ unitId: "u1", volume: 40 }) },
        { author: "spammer", result: makeResult({ unitId: "u2", volume: 80 }) },
      ];
      const signal = makeSignal([
        makeAuthorSignal({
          author: "spammer",
          repetitionRatio: 0.5,
          suspected: true,
        }),
      ]);

      const out = applyAbuseSignalToVolume(entries, signal);

      expect(out[0].result.volume).toBe(20);
      expect(out[1].result.volume).toBe(40);
    });
  });

  describe("입력 비변형 + 결정성", () => {
    it("입력 entries / result / signal 을 변형하지 않는다(deep-equal 보존)", () => {
      const entries: AbuseAdjustEntry[] = [
        { author: "spammer", result: makeResult({ volume: 100 }) },
      ];
      const signal = makeSignal([
        makeAuthorSignal({
          author: "spammer",
          repetitionRatio: 0.75,
          suspected: true,
        }),
      ]);
      const entriesSnapshot = JSON.parse(JSON.stringify(entries));
      const signalSnapshot = JSON.parse(JSON.stringify(signal));

      applyAbuseSignalToVolume(entries, signal);

      expect(entries).toEqual(entriesSnapshot);
      expect(signal).toEqual(signalSnapshot);
    });

    it("Object.freeze 된 입력으로 호출해도 throw 없이 통과(비변형 증명)", () => {
      const result = Object.freeze(makeResult({ volume: 100 }));
      const entry = Object.freeze({ author: "spammer", result });
      const entries = Object.freeze([entry]) as unknown as AbuseAdjustEntry[];
      const authorSignal = Object.freeze(
        makeAuthorSignal({
          author: "spammer",
          repetitionRatio: 0.5,
          suspected: true,
        }),
      );
      const signal = Object.freeze(makeSignal([authorSignal]));

      const out = applyAbuseSignalToVolume(entries, signal);

      expect(out[0].result.volume).toBe(50);
      // 출력은 입력과 다른 새 객체.
      expect(out[0].result).not.toBe(result);
    });

    it("동일 입력 2회 호출이 동일 출력(결정성)", () => {
      const entries: AbuseAdjustEntry[] = [
        { author: "spammer", result: makeResult({ volume: 100 }) },
        { author: "gildong", result: makeResult({ volume: 50 }) },
      ];
      const signal = makeSignal([
        makeAuthorSignal({
          author: "spammer",
          repetitionRatio: 0.75,
          suspected: true,
        }),
        makeAuthorSignal({
          author: "gildong",
          repetitionRatio: 0.1,
          suspected: false,
        }),
      ]);

      const first = applyAbuseSignalToVolume(entries, signal);
      const second = applyAbuseSignalToVolume(entries, signal);

      expect(first).toEqual(second);
    });
  });

  describe("상수 export", () => {
    it("ABUSE_VOLUME_PENALTY_FLOOR / ABUSE_VOLUME_RETENTION_MIN v1 baseline", () => {
      expect(ABUSE_VOLUME_PENALTY_FLOOR).toBe(0);
      expect(ABUSE_VOLUME_RETENTION_MIN).toBe(0);
    });
  });
});
