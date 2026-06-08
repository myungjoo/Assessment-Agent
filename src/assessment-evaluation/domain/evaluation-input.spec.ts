// evaluation-input.ts 의 colocated unit test (CLAUDE.md §3.2 R-112 — happy /
// error / branch / negative cases 충분 cover). 본 파일은 타입 정의 파일
// (evaluation-input.ts) 자체의 type-guard `isContributionKind` / const
// `CONTRIBUTION_KINDS` / `EvaluationInput` shape 단언을 담당한다 — mapper 동작은
// evaluation-input.mapper.spec.ts 가 별도로 cover.
//
// 분리 사유 (T-0287 round 2): scripts/check-spec-presence.sh 가 신규 production
// .ts 마다 동일 디렉토리에 동명 .spec.ts 의 존재를 강제한다(file-name 매칭만 수행
// — `isContributionKind` 가 mapper spec 에서 cover 되더라도 sibling spec 누락이면
// CI fail). 본 spec 으로 R-112 자동 강제 layer 와 정합.

import {
  CONTRIBUTION_KINDS,
  type ContributionKind,
  type EvaluationInput,
  isContributionKind,
} from "./evaluation-input";

// EvaluationInput 의 정확한 7 키 — raw 본문 키 부재 단언의 기준(REQ-032).
const EXPECTED_KEYS = [
  "author",
  "contributionKind",
  "instanceKey",
  "metadata",
  "sourceType",
  "timestamp",
  "unitId",
].sort();

// raw 본문 키 후보 — EvaluationInput type 에 절대 존재하면 안 되는 키 목록
// (REQ-032 raw-not-stored 불변, data-model.md §4).
const FORBIDDEN_RAW_KEYS = ["body", "diff", "html", "message", "content"];

describe("isContributionKind", () => {
  describe("truthy 분기 (R-112-1 happy)", () => {
    it.each(CONTRIBUTION_KINDS)(
      "허용 멤버 '%s' 에 대해 true 를 반환한다",
      (member) => {
        expect(isContributionKind(member)).toBe(true);
      },
    );
  });

  describe("falsy 분기 (R-112-2 negative — 예외 상황 충분 cover)", () => {
    it.each([
      "",
      "CODE",
      "Document",
      "github",
      "confluence",
      "commit",
      "pr",
      "issue",
      "unknown",
      "code ", // trailing space — 정규화 0, 엄격 매칭
      " code", // leading space — 동일 정규화 부재 단언
      "code\n", // trailing newline
      "코드", // 한국어 유사 의미 — 멤버십 외
      "0",
      "null",
      "undefined",
    ])("허용 외 값 '%s' 에 대해 false 를 반환한다", (value) => {
      expect(isContributionKind(value)).toBe(false);
    });
  });

  describe("type narrowing (R-112-3 branch)", () => {
    it("true 분기에서 ContributionKind 로 좁혀 할당 가능하다", () => {
      const raw: string = "code";
      if (isContributionKind(raw)) {
        // 좁혀진 후 ContributionKind 변수에 할당 가능해야 한다.
        const narrowed: ContributionKind = raw;
        expect(narrowed).toBe("code");
      } else {
        throw new Error("isContributionKind('code') 는 true 여야 한다");
      }
    });

    it("false 분기에서는 string 으로 유지된다 (narrowing 부재)", () => {
      const raw: string = "unknown";
      if (isContributionKind(raw)) {
        throw new Error("isContributionKind('unknown') 는 false 여야 한다");
      } else {
        // 좁혀지지 않으므로 string 그대로.
        const stillString: string = raw;
        expect(stillString).toBe("unknown");
      }
    });
  });

  describe("순수성 / 부수효과 0 (R-112-2 negative)", () => {
    it("동일 입력에 대해 항상 동일 결과 (referential transparency)", () => {
      expect(isContributionKind("code")).toBe(isContributionKind("code"));
      expect(isContributionKind("xxx")).toBe(isContributionKind("xxx"));
    });

    it("어떤 입력에서도 throw 하지 않는다 (멤버 / 비멤버 / 빈 문자열)", () => {
      expect(() => isContributionKind("code")).not.toThrow();
      expect(() => isContributionKind("document")).not.toThrow();
      expect(() => isContributionKind("")).not.toThrow();
      expect(() => isContributionKind("anything-else")).not.toThrow();
    });
  });
});

describe("CONTRIBUTION_KINDS const", () => {
  describe("멤버 동기성 (R-112-1 happy)", () => {
    it("정확히 'code' / 'document' 2 종을 포함한다", () => {
      expect(CONTRIBUTION_KINDS).toEqual(["code", "document"]);
    });

    it("순서가 [code, document] 로 박제된다 (외부 contract)", () => {
      expect(CONTRIBUTION_KINDS[0]).toBe("code");
      expect(CONTRIBUTION_KINDS[1]).toBe("document");
    });

    it("length 가 정확히 2 다 (멤버 누락 / 추가 회귀 차단)", () => {
      expect(CONTRIBUTION_KINDS.length).toBe(2);
    });
  });

  describe("readonly 보장 (R-112-3 branch / R-112-2 negative)", () => {
    it("모든 멤버가 isContributionKind 를 통과한다 (self-consistency)", () => {
      for (const member of CONTRIBUTION_KINDS) {
        expect(isContributionKind(member)).toBe(true);
      }
    });

    it("readonly tuple 이라 compile-time 에 mutation 차단 (런타임 length 비교)", () => {
      // mutation 차단은 type-level — 런타임 단언은 length 보존만.
      const before = CONTRIBUTION_KINDS.length;
      expect(CONTRIBUTION_KINDS.length).toBe(before);
    });
  });
});

describe("EvaluationInput type-level shape", () => {
  // 본 그룹은 type-level 검증이 주 — 런타임에서는 type 만족 객체를 생성해
  // shape 단언을 박는다. mapper 동작 cover 는 mapper spec 의 책임.
  function makeMinimalInput(): EvaluationInput {
    return {
      unitId: "github:sec:abc",
      contributionKind: "code",
      sourceType: "github",
      instanceKey: "sec",
      author: "gildong",
      timestamp: "2026-06-01T09:00:00Z",
      metadata: {},
    };
  }

  describe("필드 7 키 한정 (R-112-3 branch)", () => {
    it("EvaluationInput 객체의 key 집합이 정확히 7 키다 (raw 본문 키 부재)", () => {
      const input = makeMinimalInput();
      expect(Object.keys(input).sort()).toEqual(EXPECTED_KEYS);
    });

    it("raw 본문 키(body/diff/html/message/content)가 부재한다 (REQ-032)", () => {
      const input = makeMinimalInput();
      for (const forbidden of FORBIDDEN_RAW_KEYS) {
        expect(Object.keys(input)).not.toContain(forbidden);
      }
    });
  });

  describe("type-level FORBIDDEN_RAW_KEYS 단언 (R-112-2 negative — compile-time)", () => {
    it("body / diff / html / message / content 5 키가 EvaluationInput 에 존재하지 않는다", () => {
      const input: EvaluationInput = makeMinimalInput();
      // @ts-expect-error — body 는 EvaluationInput 에 존재하지 않는 키
      const _bodyMustNotExist: string = input.body;
      // @ts-expect-error — diff 는 EvaluationInput 에 존재하지 않는 키
      const _diffMustNotExist: string = input.diff;
      // @ts-expect-error — html 은 EvaluationInput 에 존재하지 않는 키
      const _htmlMustNotExist: string = input.html;
      // @ts-expect-error — message 는 EvaluationInput 에 존재하지 않는 키
      const _messageMustNotExist: string = input.message;
      // @ts-expect-error — content 는 EvaluationInput 에 존재하지 않는 키
      const _contentMustNotExist: string = input.content;
      void _bodyMustNotExist;
      void _diffMustNotExist;
      void _htmlMustNotExist;
      void _messageMustNotExist;
      void _contentMustNotExist;
      expect(true).toBe(true);
    });
  });

  describe("contributionKind 필드 type-level 제약 (R-112-3 branch)", () => {
    it("contributionKind 는 code / document 만 허용 (다른 값 compile-time 거부)", () => {
      const codeInput: EvaluationInput = {
        ...makeMinimalInput(),
        contributionKind: "code",
      };
      const docInput: EvaluationInput = {
        ...makeMinimalInput(),
        contributionKind: "document",
      };
      expect(codeInput.contributionKind).toBe("code");
      expect(docInput.contributionKind).toBe("document");
    });

    it("contributionKind 에 임의 string 할당 시 compile-time 거부", () => {
      const _badInput: EvaluationInput = {
        ...makeMinimalInput(),
        // @ts-expect-error — "unknown" 은 ContributionKind 멤버 아님
        contributionKind: "unknown",
      };
      void _badInput;
      expect(true).toBe(true);
    });
  });
});
