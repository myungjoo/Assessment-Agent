// realdata-e2e-evaluation-inputs-consistency.spec.ts — T-0685 colocated unit spec.
//
// R-112 cover 구조:
//   - happy-path: 정합 evaluationInputs(빈 배열 / github commit·pr·issue / confluence
//     혼합)에 대해 void 반환(throw 0).
//   - error path: evaluationInputs null/undefined/비-배열, activities null/비-배열 →
//     각 TypeError.
//   - flow/branch: 구조 결손(TypeError) 분기 vs 값 drift(RangeError) 분기 각 cover.
//     길이 불일치 RangeError + 원소-내용 drift(특정 index) RangeError 분리.
//   - negative 충분 cover: 원소 누락(길이 짧음) · 원소 추가(길이 김) · 특정 index
//     unitId/contributionKind 변조 · 순서 swap · 위임 매퍼 throw(null 원소) 전파 각 1+.
import type {
  Activity,
  ConfluenceActivity,
  GithubActivity,
} from "../../src/assessment-collection/domain/activity";
import type { EvaluationInput } from "../../src/assessment-evaluation/domain/evaluation-input";
import { mapActivityToEvaluationInput } from "../../src/assessment-evaluation/domain/evaluation-input.mapper";

import { assertRealDataEvaluationInputsConsistentWithSources } from "./realdata-e2e-evaluation-inputs-consistency";

// fixtures — github commit/pr/issue + confluence page 를 섞은 입력(컴포저 spec 과 동형).
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

const MIXED: Activity[] = [COMMIT, PR, ISSUE, PAGE];

// buildConsistent — fixtures 로부터 production 매퍼로 정합 evaluationInputs 를 합성한다
// (재유도와 동일 경로 — 본 helper 가 가드의 happy-path source). 본 spec 의 가드 입력은
// 항상 이 함수로 산출하거나, 그 산출을 의도적으로 변형해 negative 케이스를 만든다.
function buildConsistent(activities: Activity[]): EvaluationInput[] {
  return activities.map((a) => mapActivityToEvaluationInput(a));
}

describe("assertRealDataEvaluationInputsConsistentWithSources", () => {
  describe("happy path (정합 → void)", () => {
    it("빈 배열 입력(activities=[]) → void(throw 0)", () => {
      expect(() =>
        assertRealDataEvaluationInputsConsistentWithSources([], []),
      ).not.toThrow();
    });

    it("github commit/pr/issue + confluence 혼합 정합 입력 → void(throw 0)", () => {
      const inputs = buildConsistent(MIXED);
      expect(() =>
        assertRealDataEvaluationInputsConsistentWithSources(inputs, MIXED),
      ).not.toThrow();
    });

    it("단일 원소 정합 입력 → void(throw 0)", () => {
      const inputs = buildConsistent([COMMIT]);
      expect(() =>
        assertRealDataEvaluationInputsConsistentWithSources(inputs, [COMMIT]),
      ).not.toThrow();
    });

    it("정합 입력에 대해 반환값이 undefined(void) 다", () => {
      const inputs = buildConsistent([PAGE]);
      expect(
        assertRealDataEvaluationInputsConsistentWithSources(inputs, [PAGE]),
      ).toBeUndefined();
    });
  });

  describe("error path — 구조 결손(TypeError)", () => {
    it("evaluationInputs=null → TypeError(타입 라벨 'null' 포함)", () => {
      // null 은 typeof 가 'object' 로 뭉뚱그리지만 describe 가 'null' 라벨로 구분 노출.
      expect(() =>
        assertRealDataEvaluationInputsConsistentWithSources(
          null as unknown as EvaluationInput[],
          MIXED,
        ),
      ).toThrow(/evaluationInputs 가 배열이 아니다.*null/);
    });

    it("evaluationInputs=undefined → TypeError", () => {
      expect(() =>
        assertRealDataEvaluationInputsConsistentWithSources(
          undefined as unknown as EvaluationInput[],
          MIXED,
        ),
      ).toThrow(TypeError);
    });

    it("evaluationInputs 가 비-배열(object) → TypeError(타입 라벨 포함)", () => {
      expect(() =>
        assertRealDataEvaluationInputsConsistentWithSources(
          {} as unknown as EvaluationInput[],
          MIXED,
        ),
      ).toThrow(/evaluationInputs 가 배열이 아니다.*object/);
    });

    it("activities=null → TypeError", () => {
      const inputs = buildConsistent(MIXED);
      expect(() =>
        assertRealDataEvaluationInputsConsistentWithSources(
          inputs,
          null as unknown as Activity[],
        ),
      ).toThrow(TypeError);
    });

    it("activities 가 비-배열(string) → TypeError(타입 라벨 포함)", () => {
      const inputs = buildConsistent(MIXED);
      expect(() =>
        assertRealDataEvaluationInputsConsistentWithSources(
          inputs,
          "nope" as unknown as Activity[],
        ),
      ).toThrow(/activities 가 배열이 아니다.*string/);
    });
  });

  describe("flow / branch — 구조(TypeError) vs 값 drift(RangeError) 분리", () => {
    it("구조 결손은 TypeError 이고 RangeError 가 아니다", () => {
      const inputs = buildConsistent(MIXED);
      expect(() =>
        assertRealDataEvaluationInputsConsistentWithSources(
          inputs,
          null as unknown as Activity[],
        ),
      ).not.toThrow(RangeError);
    });

    it("값 drift 는 RangeError 이고 TypeError 가 아니다", () => {
      const inputs = buildConsistent(MIXED);
      const tampered = [...inputs];
      tampered[0] = { ...inputs[0], unitId: "TAMPERED" } as EvaluationInput;
      expect(() =>
        assertRealDataEvaluationInputsConsistentWithSources(tampered, MIXED),
      ).not.toThrow(TypeError);
    });

    it("길이 불일치 RangeError 가 원소 검사보다 먼저 throw(fail-fast)", () => {
      // 길이 짧음 + 남은 원소도 변조 — 길이 메시지가 먼저 나와야 한다(fail-fast 순서).
      const inputs = buildConsistent(MIXED).slice(0, 3);
      inputs[0] = { ...inputs[0], unitId: "TAMPERED" } as EvaluationInput;
      expect(() =>
        assertRealDataEvaluationInputsConsistentWithSources(inputs, MIXED),
      ).toThrow(/길이가 재유도 expected 와 다르다.*기대=4.*실측=3/);
    });
  });

  describe("negative cases 충분 cover — 예외 상황 분기마다", () => {
    it("(a) 원소 1개 누락(길이 짧음) → RangeError(길이 정보)", () => {
      const inputs = buildConsistent(MIXED).slice(0, 3);
      expect(() =>
        assertRealDataEvaluationInputsConsistentWithSources(inputs, MIXED),
      ).toThrow(/길이.*기대=4.*실측=3/);
    });

    it("(b) 원소 1개 추가(길이 김) → RangeError(길이 정보)", () => {
      const inputs = buildConsistent(MIXED);
      const extra = [...inputs, mapActivityToEvaluationInput(COMMIT)];
      expect(() =>
        assertRealDataEvaluationInputsConsistentWithSources(extra, MIXED),
      ).toThrow(/길이.*기대=4.*실측=5/);
    });

    it("(c1) 특정 index unitId 변조 → RangeError(어긋난 index)", () => {
      const inputs = buildConsistent(MIXED);
      inputs[1] = {
        ...inputs[1],
        unitId: "github:com:WRONG",
      } as EvaluationInput;
      expect(() =>
        assertRealDataEvaluationInputsConsistentWithSources(inputs, MIXED),
      ).toThrow(
        /evaluationInputs\[1\] 가 재유도 expected 와 byte-identical 하지 않다/,
      );
    });

    it("(c2) 특정 index contributionKind 변조 → RangeError(어긋난 index)", () => {
      const inputs = buildConsistent(MIXED);
      inputs[0] = {
        ...inputs[0],
        contributionKind: "document",
      } as EvaluationInput;
      expect(() =>
        assertRealDataEvaluationInputsConsistentWithSources(inputs, MIXED),
      ).toThrow(/evaluationInputs\[0\] 가 재유도 expected/);
    });

    it("(d) 순서 뒤섞임(swap) → RangeError(가장 먼저 어긋난 index)", () => {
      const inputs = buildConsistent(MIXED);
      const swapped = [inputs[1], inputs[0], inputs[2], inputs[3]];
      expect(() =>
        assertRealDataEvaluationInputsConsistentWithSources(swapped, MIXED),
      ).toThrow(/evaluationInputs\[0\] 가 재유도 expected/);
    });

    it("(e) 위임 매퍼 throw(null 원소 — 변환 불가 activity)가 가드를 통해 그대로 전파", () => {
      // activities 에 null 원소가 섞이면 production 매퍼가 .sourceType 접근에서 throw.
      // 가드는 자체 try/catch 0 — 그대로 전파한다(삼키지 않음).
      const badActivities = [COMMIT, null] as unknown as Activity[];
      const inputs = buildConsistent([COMMIT]);
      expect(() =>
        assertRealDataEvaluationInputsConsistentWithSources(
          inputs,
          badActivities,
        ),
      ).toThrow();
    });
  });

  describe("비변형 / 순수성 (입력 mutate 0)", () => {
    it("정합 호출이 evaluationInputs 배열·원소를 변형하지 않는다", () => {
      const inputs = buildConsistent(MIXED);
      const lenBefore = inputs.length;
      const firstRef = inputs[0];
      assertRealDataEvaluationInputsConsistentWithSources(inputs, MIXED);
      expect(inputs).toHaveLength(lenBefore);
      expect(inputs[0]).toBe(firstRef);
    });

    it("정합 호출이 activities 배열을 변형하지 않는다", () => {
      const inputs = buildConsistent(MIXED);
      const activities: Activity[] = [...MIXED];
      const before = [...activities];
      assertRealDataEvaluationInputsConsistentWithSources(inputs, activities);
      expect(activities).toEqual(before);
      expect(activities[0]).toBe(before[0]);
    });
  });
});
