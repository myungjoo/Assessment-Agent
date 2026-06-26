// realdata-e2e-evaluation-inputs.spec.ts — T-0578 colocated unit spec.
//
// R-112 cover 구조:
//   - happy-path: github(commit/pr/issue) + confluence 를 섞은 Activity[] 입력에 대해
//     각 원소가 올바른 unitId·contributionKind·sourceType·instanceKey·author·timestamp·
//     metadata 로 변환되고 순서가 보존됨을 검증.
//   - flow/branch: production 매퍼의 sourceType/kind 분기(commit→code, pr→code,
//     issue→document, confluence→document)가 본 helper 를 통해 전부 도달함을 입력
//     다양성으로 cover. 본 helper 자체는 추가 분기 0(배열 map 만).
//   - error/negative 충분 cover: 빈 입력 배열(→ []), 단일 원소 배열, 빈 metadata 객체
//     보존, metadata reference 승계(deep clone 0) 각 1+ test.
//   - 무공유/순수성: 입력 배열 길이·참조 불변 + 매 호출 새 배열 + 반환 배열 mutate 후
//     재호출 결과 불변(무공유 회귀).
import type {
  Activity,
  ConfluenceActivity,
  GithubActivity,
} from "../../src/assessment-collection/domain/activity";

import { buildRealDataEvaluationInputs } from "./realdata-e2e-evaluation-inputs";
import * as consistency from "./realdata-e2e-evaluation-inputs-consistency";

// fixtures — github commit/pr/issue + confluence page 를 섞은 입력.
const COMMIT: GithubActivity = {
  sourceType: "github",
  externalId: "abc123",
  instanceKey: "com",
  author: "myungjoo",
  timestamp: "2026-06-01T00:00:00.000Z",
  metadata: { additions: 10 },
  repoRef: "octo-org/octo-repo",
  kind: "commit",
};

const PR: GithubActivity = {
  sourceType: "github",
  externalId: "42",
  instanceKey: "com",
  author: "leemgs",
  timestamp: "2026-06-02T00:00:00.000Z",
  metadata: { titleLength: 24 },
  repoRef: "octo-org/octo-repo",
  kind: "pr",
};

const ISSUE: GithubActivity = {
  sourceType: "github",
  externalId: "7",
  instanceKey: "sec",
  author: "myungjoo",
  timestamp: "2026-06-03T00:00:00.000Z",
  metadata: {},
  repoRef: "octo-org/other-repo",
  kind: "issue",
};

const PAGE: ConfluenceActivity = {
  sourceType: "confluence",
  externalId: "page-99",
  instanceKey: "ENG",
  author: "leemgs",
  timestamp: "2026-06-04T00:00:00.000Z",
  metadata: { version: 3 },
  spaceRef: "ENG",
  version: 3,
};

describe("buildRealDataEvaluationInputs", () => {
  describe("happy path (정상 변환)", () => {
    it("commit/pr/issue/confluence 혼합 입력을 정확한 EvaluationInput[] 으로 변환 + 순서 보존", () => {
      const result = buildRealDataEvaluationInputs([COMMIT, PR, ISSUE, PAGE]);
      expect(result).toEqual([
        {
          unitId: "github:com:abc123",
          contributionKind: "code",
          sourceType: "github",
          instanceKey: "com",
          author: "myungjoo",
          timestamp: "2026-06-01T00:00:00.000Z",
          metadata: { additions: 10 },
        },
        {
          unitId: "github:com:42",
          contributionKind: "code",
          sourceType: "github",
          instanceKey: "com",
          author: "leemgs",
          timestamp: "2026-06-02T00:00:00.000Z",
          metadata: { titleLength: 24 },
        },
        {
          unitId: "github:sec:7",
          contributionKind: "document",
          sourceType: "github",
          instanceKey: "sec",
          author: "myungjoo",
          timestamp: "2026-06-03T00:00:00.000Z",
          metadata: {},
        },
        {
          unitId: "confluence:ENG:page-99",
          contributionKind: "document",
          sourceType: "confluence",
          instanceKey: "ENG",
          author: "leemgs",
          timestamp: "2026-06-04T00:00:00.000Z",
          metadata: { version: 3 },
        },
      ]);
    });
  });

  describe("flow / branch cover (위임된 분기 도달)", () => {
    it("github commit → contributionKind=code", () => {
      const [out] = buildRealDataEvaluationInputs([COMMIT]);
      expect(out.contributionKind).toBe("code");
    });

    it("github pr → contributionKind=code", () => {
      const [out] = buildRealDataEvaluationInputs([PR]);
      expect(out.contributionKind).toBe("code");
    });

    it("github issue → contributionKind=document (R-30)", () => {
      const [out] = buildRealDataEvaluationInputs([ISSUE]);
      expect(out.contributionKind).toBe("document");
    });

    it("confluence page → contributionKind=document", () => {
      const [out] = buildRealDataEvaluationInputs([PAGE]);
      expect(out.contributionKind).toBe("document");
    });
  });

  describe("error / negative cover (경계·빈 입력)", () => {
    it("빈 입력 배열 → 빈 배열 반환 (throw 0)", () => {
      expect(buildRealDataEvaluationInputs([])).toEqual([]);
    });

    it("단일 원소 배열 → 1 원소 EvaluationInput[]", () => {
      const result = buildRealDataEvaluationInputs([COMMIT]);
      expect(result).toHaveLength(1);
      expect(result[0]?.unitId).toBe("github:com:abc123");
    });

    it("빈 metadata 객체인 Activity → 빈 metadata 보존", () => {
      const [out] = buildRealDataEvaluationInputs([ISSUE]);
      expect(out.metadata).toEqual({});
    });

    it("metadata 는 reference 그대로 승계 (production 매퍼 계약 — deep clone 0)", () => {
      const [out] = buildRealDataEvaluationInputs([COMMIT]);
      expect(out.metadata).toBe(COMMIT.metadata);
    });
  });

  describe("무공유 / 순수성 (입력 불변 + 새 배열)", () => {
    it("입력 배열 길이·참조를 변형하지 않는다", () => {
      const input: Activity[] = [COMMIT, PAGE];
      const before = [...input];
      buildRealDataEvaluationInputs(input);
      expect(input).toHaveLength(2);
      expect(input[0]).toBe(before[0]);
      expect(input[1]).toBe(before[1]);
    });

    it("매 호출마다 새 배열을 반환한다 (배열 차원 무공유)", () => {
      const input: Activity[] = [COMMIT];
      const a = buildRealDataEvaluationInputs(input);
      const b = buildRealDataEvaluationInputs(input);
      expect(a).not.toBe(b);
      expect(a).toEqual(b);
    });

    it("무공유 회귀 — 반환 배열 mutate 후 재호출 결과 불변", () => {
      const input: Activity[] = [COMMIT, PR];
      const first = buildRealDataEvaluationInputs(input);
      first.pop();
      first[0]!.unitId = "MUTATED";
      const second = buildRealDataEvaluationInputs(input);
      expect(second).toHaveLength(2);
      expect(second[0]?.unitId).toBe("github:com:abc123");
    });
  });

  // T-0686 self-wire 배선 검증 — 컴포저가 산출 EvaluationInput[] 반환 직전 consistency
  // 가드를 (산출 evaluationInputs, activities) 인자로 정확히 1회 self-assert 하는지, 정상
  // 합성이면 throw 0·반환 산출물 byte-identical·무공유 불변, 가드가 throw 하면 컴포저가
  // 삼키지 않고 그대로 전파하는지, 위임 매퍼 throw 입력에서는 가드 진입 전 그 throw 가
  // 전파(가드 미호출)되는지, 가드 회귀(RangeError/TypeError 모의) 전파를 검증한다. T-0684
  // evaluation-step-args self-wire spec 패턴의 leaf layer mirror.
  describe("consistency 가드 self-wire (T-0686) — 반환 직전 self-assert 배선", () => {
    afterEach(() => {
      jest.restoreAllMocks();
    });

    it("정상 합성(다수 원소) → 가드가 (산출 evaluationInputs, activities) 인자로 정확히 1회 호출됨", () => {
      const spy = jest.spyOn(
        consistency,
        "assertRealDataEvaluationInputsConsistentWithSources",
      );
      const activities: Activity[] = [COMMIT, PR, ISSUE, PAGE];

      const result = buildRealDataEvaluationInputs(activities);

      // 정확히 1회 호출.
      expect(spy).toHaveBeenCalledTimes(1);
      // 인자 순서·값이 (반환된 산출 evaluationInputs, activities) 와 일치.
      expect(spy).toHaveBeenCalledWith(result, activities);
      // 가드에 넘어간 첫 인자가 컴포저가 반환한 바로 그 배열 참조여야 한다(검증 대상 일치).
      expect(spy.mock.calls[0][0]).toBe(result);
      expect(spy.mock.calls[0][1]).toBe(activities);
    });

    it("(분기 단일 원소) 단일 Activity 분기에서도 가드가 (산출 evaluationInputs, activities) 로 정확히 1회 호출됨", () => {
      const spy = jest.spyOn(
        consistency,
        "assertRealDataEvaluationInputsConsistentWithSources",
      );
      const activities: Activity[] = [COMMIT];

      const result = buildRealDataEvaluationInputs(activities);

      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy).toHaveBeenCalledWith(result, activities);
    });

    it("(분기 빈 activities 경계) 빈 배열에서도 가드가 (산출 [], []) 로 정확히 1회 호출됨 (가드 통과·빈 산출물)", () => {
      const spy = jest.spyOn(
        consistency,
        "assertRealDataEvaluationInputsConsistentWithSources",
      );
      const empty: Activity[] = [];

      const result = buildRealDataEvaluationInputs(empty);

      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy).toHaveBeenCalledWith(result, empty);
      // 빈 배열 통과(가드가 빈 evaluationInputs 를 정합으로 인정 — throw 0).
      expect(result).toEqual([]);
    });

    it("정상 합성 → 가드 통과 후 반환 산출물이 self-wire 미배선 기대값(위임 매퍼 산출)과 byte-identical(불변)", () => {
      const activities: Activity[] = [COMMIT, PR, ISSUE, PAGE];

      const result = buildRealDataEvaluationInputs(activities);

      // self-wire 가 반환 산출물을 변형하지 않음 — 위임 매퍼 산출과 deep-equal·순서 보존.
      expect(result).toEqual([
        {
          unitId: "github:com:abc123",
          contributionKind: "code",
          sourceType: "github",
          instanceKey: "com",
          author: "myungjoo",
          timestamp: "2026-06-01T00:00:00.000Z",
          metadata: { additions: 10 },
        },
        {
          unitId: "github:com:42",
          contributionKind: "code",
          sourceType: "github",
          instanceKey: "com",
          author: "leemgs",
          timestamp: "2026-06-02T00:00:00.000Z",
          metadata: { titleLength: 24 },
        },
        {
          unitId: "github:sec:7",
          contributionKind: "document",
          sourceType: "github",
          instanceKey: "sec",
          author: "myungjoo",
          timestamp: "2026-06-03T00:00:00.000Z",
          metadata: {},
        },
        {
          unitId: "confluence:ENG:page-99",
          contributionKind: "document",
          sourceType: "confluence",
          instanceKey: "ENG",
          author: "leemgs",
          timestamp: "2026-06-04T00:00:00.000Z",
          metadata: { version: 3 },
        },
      ]);
    });

    it("(negative 1 — 위임 매퍼 throw) 변환 불가 activity → map 단계 throw 가 가드 진입 전 전파(가드 미호출)", () => {
      const spy = jest.spyOn(
        consistency,
        "assertRealDataEvaluationInputsConsistentWithSources",
      );
      // null activity 는 매퍼의 property 접근(activity.sourceType 등)에서 throw —
      // map 단계가 가드 self-assert 보다 먼저 평가되므로 가드 미도달.
      const broken = [null] as unknown as Activity[];

      expect(() => buildRealDataEvaluationInputs(broken)).toThrow(TypeError);
      expect(spy).not.toHaveBeenCalled();
    });

    it("(negative 2 — RangeError 길이 불일치 회귀 모사) 원소 drop 회귀 → 가드 RangeError throw 가 그대로 전파", () => {
      jest
        .spyOn(
          consistency,
          "assertRealDataEvaluationInputsConsistentWithSources",
        )
        .mockImplementation(() => {
          throw new RangeError(
            "정합 위반: evaluationInputs 길이가 재유도 expected 와 다르다 — 기대=4, 실측=3.",
          );
        });

      expect(() =>
        buildRealDataEvaluationInputs([COMMIT, PR, ISSUE, PAGE]),
      ).toThrow(/길이가 재유도 expected 와 다르다/);
    });

    it("(negative 3 — RangeError index 원소 drift 회귀 모사) 특정 index 변조 → 가드 RangeError throw 전파", () => {
      jest
        .spyOn(
          consistency,
          "assertRealDataEvaluationInputsConsistentWithSources",
        )
        .mockImplementation(() => {
          throw new RangeError(
            "정합 위반: evaluationInputs[1] 가 재유도 expected 와 byte-identical 하지 않다",
          );
        });

      expect(() =>
        buildRealDataEvaluationInputs([COMMIT, PR, ISSUE, PAGE]),
      ).toThrow(/byte-identical 하지 않다/);
    });

    it("(negative 4 — RangeError 순서 뒤섞임 회귀 모사) swap 회귀 → 가드 RangeError throw 전파", () => {
      jest
        .spyOn(
          consistency,
          "assertRealDataEvaluationInputsConsistentWithSources",
        )
        .mockImplementation(() => {
          throw new RangeError(
            "정합 위반: evaluationInputs[0] 가 재유도 expected 와 byte-identical 하지 않다 — 순서가 뒤섞였다.",
          );
        });

      expect(() =>
        buildRealDataEvaluationInputs([COMMIT, PR, ISSUE, PAGE]),
      ).toThrow(/순서가 뒤섞였다/);
    });

    it("(negative 5 — TypeError 구조결손 회귀 모사) 산출물 비-배열 모사 → 가드 TypeError throw 전파", () => {
      jest
        .spyOn(
          consistency,
          "assertRealDataEvaluationInputsConsistentWithSources",
        )
        .mockImplementation(() => {
          throw new TypeError(
            "evaluationInputs 가 배열이 아니다 — 구조 검증 실패.",
          );
        });

      expect(() => buildRealDataEvaluationInputs([COMMIT])).toThrow(TypeError);
    });

    it("(negative 6 — 빈 activities 경계) 빈 배열은 가드 통과 + 빈 산출물 반환(throw 0)", () => {
      expect(() => buildRealDataEvaluationInputs([])).not.toThrow();
      expect(buildRealDataEvaluationInputs([])).toEqual([]);
    });

    it("self-wire 배선 후에도 입력 비변형 + 동일 입력 두 번 deterministic + 반환 산출물 무공유", () => {
      const activities: Activity[] = [COMMIT, PR, ISSUE, PAGE];
      const activitiesSnapshot = JSON.stringify(activities);

      const a = buildRealDataEvaluationInputs(activities);
      const b = buildRealDataEvaluationInputs(activities);

      // 비변형(activities mutate 0).
      expect(JSON.stringify(activities)).toBe(activitiesSnapshot);
      expect(activities).toHaveLength(4);
      // deterministic byte-identical.
      expect(a).toEqual(b);
      // 무공유(반환 배열이 호출마다 새 객체).
      expect(a).not.toBe(b);
    });
  });
});
