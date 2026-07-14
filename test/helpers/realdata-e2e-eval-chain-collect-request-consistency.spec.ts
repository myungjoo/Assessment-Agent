// realdata-e2e-eval-chain-collect-request-consistency.spec.ts — T-0981 colocated unit spec.
//
// R-112 cover 구조:
//   - happy-path: 실제 `buildRealDataE2eEvalChainCollectRequest` 출력을 가드에 넘겨 정합 시
//     void — (i) 기본 entry/token, (ii) 다른 host/path entry, (iii) label 인자 branch.
//   - error path: producer 출력을 의도적으로 변조(host / path / per_page / token drift) 주입
//     → 규칙별 RangeError 각각.
//   - flow/branch: host drift / path drift / per_page drift / query 구조 drift / token drift
//     각 분기 분리 test.
//   - negative 충분 cover: (a) entry 비객체/null → TypeError, (b) token 비string → TypeError,
//     (c) result 비객체/null → TypeError, (d) per_page 누락(undefined) → RangeError,
//     (e) query 자체 누락 → RangeError, (f) query 에 추가 key 유입 → RangeError(byte-identical),
//     (g) token 을 host 필드로 오배선(token 필드 undefined) → RangeError, (h) 구조 결손 vs
//     값 drift 의 TypeError/RangeError 분리.
//   - §9 secret-safety: token drift throw 메시지에 token 실 값 미등장 assert.
//   - neutral 재유도: oracle 소스가 producer 를 runtime import 하지 않고 type-only 만 씀을 assert.
import { readFileSync } from "node:fs";
import { join } from "node:path";

import type { GithubRequestInput } from "../../src/github/github-request.builder";

import { buildRealDataE2eEvalChainCollectRequest } from "./realdata-e2e-eval-chain-collect-request";
import { assertRealDataE2eEvalChainCollectRequestConsistent } from "./realdata-e2e-eval-chain-collect-request-consistency";
import type { RealDataE2eGithubCollectionPlanEntry } from "./realdata-e2e-github-collection-live";

// plan entry fixtures — §9 격리: host/path 는 비시크릿 구조값. token 은 더미 평문(실 PAT
// 아님)으로, 어느 fixture 도 실 credential 을 담지 않는다.
const TOKEN = "dummy-pat-value-1234";

const ENTRY: RealDataE2eGithubCollectionPlanEntry = {
  username: "myungjoo",
  host: "github.com",
  apiBaseUrl: "https://api.github.com",
  path: "/users/myungjoo/events/public",
  hasAuthorizationHeader: true,
};

// 다른 host/path 로 귀속 재유도가 entry 값을 그대로 따라가는지 확인하는 2번째 fixture.
const ENTRY_ALT: RealDataE2eGithubCollectionPlanEntry = {
  username: "leemgs",
  host: "github.sec.samsung.net",
  apiBaseUrl: "https://github.sec.samsung.net/api/v3",
  path: "/users/leemgs/events/public",
  hasAuthorizationHeader: true,
};

describe("assertRealDataE2eEvalChainCollectRequestConsistent", () => {
  describe("happy path — 실제 producer 출력 정합 → void(throw 0)", () => {
    it("(i) 기본 entry/token → 정합 통과", () => {
      const result = buildRealDataE2eEvalChainCollectRequest(ENTRY, TOKEN);
      expect(() =>
        assertRealDataE2eEvalChainCollectRequestConsistent(
          ENTRY,
          TOKEN,
          result,
        ),
      ).not.toThrow();
    });

    it("(ii) 다른 host/path entry → 귀속 재유도 정합 통과", () => {
      const result = buildRealDataE2eEvalChainCollectRequest(ENTRY_ALT, TOKEN);
      expect(result.host).toBe("github.sec.samsung.net");
      expect(result.path).toBe("/users/leemgs/events/public");
      expect(() =>
        assertRealDataE2eEvalChainCollectRequestConsistent(
          ENTRY_ALT,
          TOKEN,
          result,
        ),
      ).not.toThrow();
    });

    it("(iii) label 인자를 넘겨도 정합 시 void(라벨 branch)", () => {
      const result = buildRealDataE2eEvalChainCollectRequest(ENTRY, TOKEN);
      expect(() =>
        assertRealDataE2eEvalChainCollectRequestConsistent(
          ENTRY,
          TOKEN,
          result,
          "collectRequest#0",
        ),
      ).not.toThrow();
    });

    it("정합 호출 반환값이 undefined(void) 다", () => {
      const result = buildRealDataE2eEvalChainCollectRequest(ENTRY, TOKEN);
      expect(
        assertRealDataE2eEvalChainCollectRequestConsistent(
          ENTRY,
          TOKEN,
          result,
        ),
      ).toBeUndefined();
    });

    it("per_page 가 bounded single '1' 임을 확인 후 정합 통과", () => {
      const result = buildRealDataE2eEvalChainCollectRequest(ENTRY, TOKEN);
      expect(result.query?.per_page).toBe("1");
      expect(() =>
        assertRealDataE2eEvalChainCollectRequestConsistent(
          ENTRY,
          TOKEN,
          result,
        ),
      ).not.toThrow();
    });
  });

  describe("error path / flow-branch — 규칙별 drift 변조 주입 → RangeError", () => {
    it("host drift — result.host 를 다른 값으로 변조 → RangeError(host)", () => {
      const result = buildRealDataE2eEvalChainCollectRequest(ENTRY, TOKEN);
      const tampered: GithubRequestInput = { ...result, host: "evil.example" };
      expect(() =>
        assertRealDataE2eEvalChainCollectRequestConsistent(
          ENTRY,
          TOKEN,
          tampered,
        ),
      ).toThrow(
        /result.host 가 재유도 expected\(entry.host 귀속\)와 다르다.*기대="github.com".*실측="evil.example"/,
      );
    });

    it("path drift — result.path 를 다른 값으로 변조 → RangeError(path)", () => {
      const result = buildRealDataE2eEvalChainCollectRequest(ENTRY, TOKEN);
      const tampered: GithubRequestInput = {
        ...result,
        path: "/users/evil/events/public",
      };
      expect(() =>
        assertRealDataE2eEvalChainCollectRequestConsistent(
          ENTRY,
          TOKEN,
          tampered,
        ),
      ).toThrow(/result.path 가 재유도 expected\(entry.path 귀속\)와 다르다/);
    });

    it("per_page drift — '2' 로 변조(무제한 확장 시도) → RangeError(per_page)", () => {
      const result = buildRealDataE2eEvalChainCollectRequest(ENTRY, TOKEN);
      const tampered: GithubRequestInput = {
        ...result,
        query: { per_page: "2" },
      };
      expect(() =>
        assertRealDataE2eEvalChainCollectRequestConsistent(
          ENTRY,
          TOKEN,
          tampered,
        ),
      ).toThrow(
        /result.query.per_page 가 재유도 expected\(bounded single "1"\)와 다르다.*기대="1".*실측="2"/,
      );
    });

    it("token drift — result.token 을 다른 값으로 변조 → RangeError(token)", () => {
      const result = buildRealDataE2eEvalChainCollectRequest(ENTRY, TOKEN);
      const tampered: GithubRequestInput = {
        ...result,
        token: "different-token",
      };
      expect(() =>
        assertRealDataE2eEvalChainCollectRequestConsistent(
          ENTRY,
          TOKEN,
          tampered,
        ),
      ).toThrow(
        /result.token 이 재유도 expected\(인자 token 과 field-only 동일 통과\)와 다르다/,
      );
    });
  });

  describe("negative cases 충분 cover — 예외 상황 분기마다", () => {
    it("(a) entry=null → TypeError", () => {
      const result = buildRealDataE2eEvalChainCollectRequest(ENTRY, TOKEN);
      expect(() =>
        assertRealDataE2eEvalChainCollectRequestConsistent(
          null as unknown as RealDataE2eGithubCollectionPlanEntry,
          TOKEN,
          result,
        ),
      ).toThrow(/entry 가 객체가 아니다.*null/);
    });

    it("(a-b) entry=비객체(number) → TypeError", () => {
      const result = buildRealDataE2eEvalChainCollectRequest(ENTRY, TOKEN);
      expect(() =>
        assertRealDataE2eEvalChainCollectRequestConsistent(
          7 as unknown as RealDataE2eGithubCollectionPlanEntry,
          TOKEN,
          result,
        ),
      ).toThrow(TypeError);
    });

    it("(b) token=비string(number) → TypeError", () => {
      const result = buildRealDataE2eEvalChainCollectRequest(ENTRY, TOKEN);
      expect(() =>
        assertRealDataE2eEvalChainCollectRequestConsistent(
          ENTRY,
          7 as unknown as string,
          result,
        ),
      ).toThrow(/token 이 string 이 아니다.*number/);
    });

    it("(c) result=null → TypeError", () => {
      expect(() =>
        assertRealDataE2eEvalChainCollectRequestConsistent(
          ENTRY,
          TOKEN,
          null as unknown as GithubRequestInput,
        ),
      ).toThrow(/result 가 객체가 아니다.*null/);
    });

    it("(c-b) result=비객체(string) → TypeError", () => {
      expect(() =>
        assertRealDataE2eEvalChainCollectRequestConsistent(
          ENTRY,
          TOKEN,
          "nope" as unknown as GithubRequestInput,
        ),
      ).toThrow(/result 가 객체가 아니다.*string/);
    });

    it("(d) per_page 누락(undefined) → RangeError(per_page)", () => {
      const result = buildRealDataE2eEvalChainCollectRequest(ENTRY, TOKEN);
      const tampered = {
        ...result,
        query: {},
      } as unknown as GithubRequestInput;
      expect(() =>
        assertRealDataE2eEvalChainCollectRequestConsistent(
          ENTRY,
          TOKEN,
          tampered,
        ),
      ).toThrow(/result.query.per_page 가 재유도 expected.*실측=undefined/);
    });

    it("(e) query 자체 누락 → RangeError(per_page)", () => {
      const result = buildRealDataE2eEvalChainCollectRequest(ENTRY, TOKEN);
      const tampered = {
        host: result.host,
        token: result.token,
        path: result.path,
      } as unknown as GithubRequestInput;
      expect(() =>
        assertRealDataE2eEvalChainCollectRequestConsistent(
          ENTRY,
          TOKEN,
          tampered,
        ),
      ).toThrow(/result.query.per_page 가 재유도 expected/);
    });

    it("(f) query 에 추가 key 유입(무제한 확장 통로) → RangeError(byte-identical)", () => {
      const result = buildRealDataE2eEvalChainCollectRequest(ENTRY, TOKEN);
      const tampered = {
        ...result,
        query: { per_page: "1", page: "5" },
      } as unknown as GithubRequestInput;
      expect(() =>
        assertRealDataE2eEvalChainCollectRequestConsistent(
          ENTRY,
          TOKEN,
          tampered,
        ),
      ).toThrow(/result.query 가 재유도 expected 와 byte-identical 하지 않다/);
    });

    it("(g) token 을 host 필드로 오배선(token 필드 undefined) → RangeError(token)", () => {
      // token 이 반환 `.token` 필드로만 통과해야 하는데 다른 필드로 새면 token 필드가
      // undefined 가 되어 정합 위반 — field-only 통과 규칙 drift 를 catch.
      const result = buildRealDataE2eEvalChainCollectRequest(ENTRY, TOKEN);
      const tampered = {
        host: result.host,
        path: result.path,
        query: result.query,
      } as unknown as GithubRequestInput;
      expect(() =>
        assertRealDataE2eEvalChainCollectRequestConsistent(
          ENTRY,
          TOKEN,
          tampered,
        ),
      ).toThrow(/result.token 이 재유도 expected.*와 다르다/);
    });

    it("(h) 구조 결손은 TypeError 이고 RangeError 가 아니다(분리)", () => {
      const result = buildRealDataE2eEvalChainCollectRequest(ENTRY, TOKEN);
      expect(() =>
        assertRealDataE2eEvalChainCollectRequestConsistent(
          null as unknown as RealDataE2eGithubCollectionPlanEntry,
          TOKEN,
          result,
        ),
      ).not.toThrow(RangeError);
    });

    it("(h-b) 값 drift 는 RangeError 이고 TypeError 가 아니다(분리)", () => {
      const result = buildRealDataE2eEvalChainCollectRequest(ENTRY, TOKEN);
      const tampered: GithubRequestInput = { ...result, host: "evil.example" };
      expect(() =>
        assertRealDataE2eEvalChainCollectRequestConsistent(
          ENTRY,
          TOKEN,
          tampered,
        ),
      ).not.toThrow(TypeError);
    });
  });

  describe("§9 secret-safety — token 실 값 미노출", () => {
    it("token drift throw 메시지에 token 실 값이 포함되지 않는다(형태/field 이름만)", () => {
      const secretToken = "ghp_SUPERSECRETPATVALUE0987654321";
      const result = buildRealDataE2eEvalChainCollectRequest(
        ENTRY,
        secretToken,
      );
      const tampered: GithubRequestInput = {
        ...result,
        token: "another-secret-XYZ",
      };
      let message = "";
      try {
        assertRealDataE2eEvalChainCollectRequestConsistent(
          ENTRY,
          secretToken,
          tampered,
        );
      } catch (error) {
        message = (error as Error).message;
      }
      // 정합 위반 메시지는 뜨되, 인자 token / 변조 token 어느 실 값도 등장하지 않는다.
      expect(message).toMatch(/result.token 이 재유도 expected/);
      expect(message).not.toContain(secretToken);
      expect(message).not.toContain("another-secret-XYZ");
      expect(message).not.toMatch(/ghp_|SUPERSECRET/i);
    });

    it("정상 fixture 직렬화·happy-path 에 실 credential-looking 값 미보관", () => {
      const result = buildRealDataE2eEvalChainCollectRequest(ENTRY, TOKEN);
      const serialized = JSON.stringify({ entry: ENTRY });
      // entry 는 비시크릿 구조값(host/path/username)만 담는다 — token 필드 자체가 없다.
      // (regex 는 "path" 키의 "pat" 부분매칭을 피해 word-boundary/credential marker 로 한정.)
      expect(serialized).not.toMatch(/\btoken\b|\bsecret\b|password|ghp_/i);
      expect(serialized).not.toContain(TOKEN);
      expect(result.host).toBe("github.com");
    });
  });

  describe("neutral 재유도 — oracle 이 producer 를 runtime import 하지 않음", () => {
    it("oracle 소스가 producer 를 type-only 로만 import(runtime import 0)", () => {
      const source = readFileSync(
        join(
          __dirname,
          "realdata-e2e-eval-chain-collect-request-consistency.ts",
        ),
        "utf8",
      );
      // import 문만 추린다(doc 주석은 producer 명을 언급할 수 있으므로 import 라인에 한정).
      const importLines = source
        .split("\n")
        .filter((line) => line.trimStart().startsWith("import"));
      // oracle 은 producer 모듈(realdata-e2e-eval-chain-collect-request)을 아예 import 하지
      // 않는다 — 값/구현/상수를 재사용하지 않고 규칙을 독립 재유도(자기 자신 대조 방지).
      const producerImport = importLines.find((line) =>
        /["']\.\/realdata-e2e-eval-chain-collect-request["']/.test(line),
      );
      expect(producerImport).toBeUndefined();
      // producer 상수(BOUNDED_SINGLE_PER_PAGE)를 import 재사용하지 않고 독립 재유도한다.
      expect(source).not.toContain("import { BOUNDED_SINGLE_PER_PAGE }");
      // 독립 재유도 상수를 자체 정의한다.
      expect(source).toContain("EXPECTED_BOUNDED_SINGLE_PER_PAGE");
    });
  });

  describe("비변형 / 순수성 (입력 mutate 0)", () => {
    it("정합 호출이 entry 객체를 변형하지 않는다", () => {
      const result = buildRealDataE2eEvalChainCollectRequest(ENTRY, TOKEN);
      const before = JSON.stringify(ENTRY);
      assertRealDataE2eEvalChainCollectRequestConsistent(ENTRY, TOKEN, result);
      expect(JSON.stringify(ENTRY)).toBe(before);
    });

    it("정합 호출이 result 객체·query 를 변형하지 않는다", () => {
      const result = buildRealDataE2eEvalChainCollectRequest(ENTRY, TOKEN);
      const queryRef = result.query;
      const before = JSON.stringify(result);
      assertRealDataE2eEvalChainCollectRequestConsistent(ENTRY, TOKEN, result);
      expect(JSON.stringify(result)).toBe(before);
      expect(result.query).toBe(queryRef);
    });
  });
});
