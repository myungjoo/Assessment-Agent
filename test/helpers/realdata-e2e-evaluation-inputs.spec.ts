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
});
