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
// namespace import 신설 — 선행성 order-lock 블록(T-1087)에서 delegate
// `mapActivityToEvaluationInput` 를 spyOn 하기 위한 spy target. 가드가 named import 로
// 호출해도 동일 모듈 객체를 가리키므로 spy 에 잡힌다(clean-leg — 기존 named value import 은
// fixture 합성 전용으로 유지).
import * as evaluationInputMapperModule from "../../src/assessment-evaluation/domain/evaluation-input.mapper";

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

  // T-1087 — 구조-검사 선행성 order-lock(defense-in-depth, sweep leg 22). 가드 본문은 상위
  // 배열-구조 assert 2개(assertEvaluationInputsStructure L156 — evaluationInputs 비-배열 →
  // TypeError / assertActivitiesStructure L157 — activities 비-배열 → TypeError) **둘 다를**
  // 요소별 재유도 위임(activities.map((a) => mapActivityToEvaluationInput(a)) L163~164)보다
  // **먼저** 수행한다. 재유도-앞 배열-구조 error(5 분기: evaluationInputs null/undefined/비-배열,
  // activities null/비-배열)를 주면 delegate 가 toHaveBeenCalledTimes(0) 이어야 한다는 선행성을
  // spy 로 못박아 "배열-구조 검사 → 요소별 재유도" 순서를 silent 재정렬로부터 방어한다. 값 정합
  // 위반 RangeError(길이 불일치 L170 / 원소 drift L177)는 재유도 **뒤**에 오므로 delegate 는
  // per-element map 이라 activities.length 회 호출 — 값-boundary 대조에 사용한다(0-call 범위 밖).
  // 신규 namespace import + spyOn 인프라 신설 clean-leg. per-element map 특이점: 정상/값-drift
  // 경로 call 횟수는 1 아니라 activities.length.
  describe("구조-검사 선행성 — 재유도-앞 배열-구조 error → delegate 0-call (T-1087)", () => {
    // 본 블록 전용 spy 격리 — 신규 spyOn 이 기존 블록(실 delegate 를 fixture 합성·byte-identical
    // 대조·비변형 검증에 사용)으로 leak 되지 않도록 매 test 후 복원한다.
    afterEach(() => {
      jest.restoreAllMocks();
    });

    it("happy-path(선행성 정상 흐름) — 구조 통과 후 delegate 가 정확히 activities.length 회 호출", () => {
      // fixture 합성(내부에서 delegate 를 호출)을 spyOn **이전**에 수행해 합성 call 이 spy count 에
      // 포함되지 않게 한 뒤 spy 를 걸고 가드를 호출 → delegate 정확히 activities.length 회 확인.
      const inputs = buildConsistent(MIXED);
      const spy = jest.spyOn(
        evaluationInputMapperModule,
        "mapActivityToEvaluationInput",
      );
      const result = assertRealDataEvaluationInputsConsistentWithSources(
        inputs,
        MIXED,
      );
      expect(result).toBeUndefined();
      // spy 는 실 구현 call-through(mockImplementation 미지정) — byte-identical 대조가 통과한다.
      // per-element map 특이점: 1 아니라 source activities 전량(길이 4).
      expect(spy).toHaveBeenCalledTimes(MIXED.length);
      // 인자-충실도(per-element 순번별) — 재유도 delegate 가 각 source activity 원소를
      // **정확히 그 순번에** 1-arg 로 받았음을 순번별로 lock(횟수+순번+인자 payload 모두).
      // 본 seam 은 per-element map 이라 activities.length 회 호출 — toHaveBeenNthCalledWith 로
      // 순번-원소 대응을 못박는다(command-plan 1-delegate leg 의 인자-충실도 패턴 확장).
      MIXED.forEach((activity, i) => {
        expect(spy).toHaveBeenNthCalledWith(i + 1, activity);
      });
      // canonical 전체 충실도 — 임의 원소가 인자로 관측됨을 명시(순번 무관 완전 충실도).
      expect(spy).toHaveBeenCalledWith(MIXED[0]);
      expect(spy).toHaveBeenCalledWith(MIXED[MIXED.length - 1]);
      // negative(인자 payload drift 축) — deep-equality 매칭이 payload drift 를 실제로
      // 잡음을 노출. 빈 activity({})로는 호출된 적 없고(값 drift 미매칭), 1번째 호출이 다른
      // 원소(MIXED[1])로 오지 않았음을 대조. 기존 값-drift RangeError it 과 별개의 인자-축 negative.
      expect(spy).not.toHaveBeenCalledWith({});
      expect(spy).not.toHaveBeenNthCalledWith(1, MIXED[1]);
      // negative(인자 개수/arity 봉함) — 각 delegate 호출이 정확히 1 인자로만 호출됨(여분 인자 0).
      // per-element map 의 1-arity 봉함 — 재유도가 activity 외 추가 컨텍스트를 넘기지 않음.
      spy.mock.calls.forEach((call) => {
        expect(call.length).toBe(1);
      });
      // flow/분기: 본 leg 은 happy-path 선행성 재유도 order-lock it 단일 경로 tighten —
      // 새 분기 도입 0(요소별 동일 호출로 per-element 재유도 조립에 분기 없음, 항목 생략).
    });

    it("happy-path(단일 원소) — delegate 가 정확히 1회(activities.length=1) 호출", () => {
      const inputs = buildConsistent([COMMIT]);
      const spy = jest.spyOn(
        evaluationInputMapperModule,
        "mapActivityToEvaluationInput",
      );
      assertRealDataEvaluationInputsConsistentWithSources(inputs, [COMMIT]);
      expect(spy).toHaveBeenCalledTimes(1);
    });

    describe("evaluationInputs 구조 결손(TypeError) → delegate 0-call", () => {
      it("evaluationInputs=null → throw(TypeError) + delegate 0-call", () => {
        const spy = jest.spyOn(
          evaluationInputMapperModule,
          "mapActivityToEvaluationInput",
        );
        expect(() =>
          assertRealDataEvaluationInputsConsistentWithSources(
            null as unknown as EvaluationInput[],
            MIXED,
          ),
        ).toThrow(TypeError);
        expect(spy).toHaveBeenCalledTimes(0);
      });

      it("evaluationInputs=undefined → throw(TypeError) + delegate 0-call", () => {
        const spy = jest.spyOn(
          evaluationInputMapperModule,
          "mapActivityToEvaluationInput",
        );
        expect(() =>
          assertRealDataEvaluationInputsConsistentWithSources(
            undefined as unknown as EvaluationInput[],
            MIXED,
          ),
        ).toThrow(TypeError);
        expect(spy).toHaveBeenCalledTimes(0);
      });

      it("evaluationInputs 비-배열(object) → throw(TypeError) + delegate 0-call", () => {
        const spy = jest.spyOn(
          evaluationInputMapperModule,
          "mapActivityToEvaluationInput",
        );
        expect(() =>
          assertRealDataEvaluationInputsConsistentWithSources(
            {} as unknown as EvaluationInput[],
            MIXED,
          ),
        ).toThrow(/evaluationInputs 가 배열이 아니다/);
        expect(spy).toHaveBeenCalledTimes(0);
      });
    });

    describe("activities 구조 결손(TypeError) → delegate 0-call", () => {
      it("activities=null → throw(TypeError) + delegate 0-call", () => {
        // evaluationInputs 는 구조상 온전한 배열로 두어 activities 구조 검사(L157)가 재유도-앞
        // 차단 지점임을 격리 확인한다.
        const inputs = buildConsistent(MIXED);
        const spy = jest.spyOn(
          evaluationInputMapperModule,
          "mapActivityToEvaluationInput",
        );
        expect(() =>
          assertRealDataEvaluationInputsConsistentWithSources(
            inputs,
            null as unknown as Activity[],
          ),
        ).toThrow(TypeError);
        expect(spy).toHaveBeenCalledTimes(0);
      });

      it("activities 비-배열(string) → throw(TypeError) + delegate 0-call", () => {
        const inputs = buildConsistent(MIXED);
        const spy = jest.spyOn(
          evaluationInputMapperModule,
          "mapActivityToEvaluationInput",
        );
        expect(() =>
          assertRealDataEvaluationInputsConsistentWithSources(
            inputs,
            "nope" as unknown as Activity[],
          ),
        ).toThrow(/activities 가 배열이 아니다/);
        expect(spy).toHaveBeenCalledTimes(0);
      });
    });

    describe("경계 대조 — 재유도-후 값 위반(RangeError)은 delegate activities.length 회(0-call 범위 밖)", () => {
      it("길이 불일치(원소 누락) → RangeError + delegate 정확히 activities.length 회", () => {
        // 배열-구조 검사(evaluationInputs 배열 · activities 배열)를 통과하므로 delegate 가
        // source activities 전량에 대해 호출된 뒤 길이 비교에서 RangeError — 재유도-앞 0-call 과
        // 대비되는 값-boundary(per-element map 이라 activities.length 회, 1 아님).
        const inputs = buildConsistent(MIXED).slice(0, 3);
        const spy = jest.spyOn(
          evaluationInputMapperModule,
          "mapActivityToEvaluationInput",
        );
        expect(() =>
          assertRealDataEvaluationInputsConsistentWithSources(inputs, MIXED),
        ).toThrow(RangeError);
        expect(spy).toHaveBeenCalledTimes(MIXED.length);
      });

      it("원소-내용 drift(특정 index unitId 변조) → RangeError + delegate 정확히 activities.length 회", () => {
        const inputs = buildConsistent(MIXED);
        inputs[1] = {
          ...inputs[1],
          unitId: "github:com:WRONG",
        } as EvaluationInput;
        const spy = jest.spyOn(
          evaluationInputMapperModule,
          "mapActivityToEvaluationInput",
        );
        expect(() =>
          assertRealDataEvaluationInputsConsistentWithSources(inputs, MIXED),
        ).toThrow(RangeError);
        expect(spy).toHaveBeenCalledTimes(MIXED.length);
      });
    });
  });
});
