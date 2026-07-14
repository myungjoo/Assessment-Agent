// realdata-e2e-eval-chain-collect-request.spec.ts — T-0980 colocated unit spec.
//
// R-112 cover 구조:
//   - happy-path: 정상 entry(host/path) + 비어있지 않은 token → host/token/path/query 필드가
//     기대대로 조립되고 per_page="1"(bounded single) 박제.
//   - error path(각 guard 분기): entry null/undefined/비객체 → TypeError; entry.host 누락/공백
//     → throw; entry.path 누락/공백 → throw; token 빈 문자열/공백/비-string → throw.
//   - flow/branch: 각 guard 분기(entry 형태·host·path·token) 마다 1+ test 로 분리 cover.
//   - negative 충분 cover: 빈 token · 공백-only host · leading-slash 유무 path · query 오염
//     (호출처가 per_page 를 덮어쓰지 못함) · non-object entry 등 예외 상황 각 1+ test.
//   - §9/R-59: token 값이 반환 객체 외 어디에도(에러 메시지·throw payload) 새지 않음을 검증.
//     실 PAT 대신 fake token 리터럴("test-token-not-real")만 사용.
//   - self-wire (T-0983): producer 가 반환 직전 consistency oracle 가드를 스스로 호출하는지
//     R-112 4종(happy/error/flow/negative)으로 봉한다.
import type { GithubRequestInput } from "../../src/github/github-request.builder";

import { buildRealDataE2eEvalChainCollectRequest } from "./realdata-e2e-eval-chain-collect-request";
// consistency 모듈은 namespace 로 import 해 self-wire spy(jest.spyOn) 대상으로 삼는다.
// ts-jest CommonJS 트랜스파일에서 producer 의 named import 는 이 모듈 객체 프로퍼티 접근으로
// 컴파일되므로, 이 namespace 의 함수를 spyOn 하면 producer 내부 self-wire 호출이 가로채진다.
import * as collectRequestConsistency from "./realdata-e2e-eval-chain-collect-request-consistency";
import type { RealDataE2eGithubCollectionPlanEntry } from "./realdata-e2e-github-collection-live";

// fake token 리터럴 — 실 PAT 미사용(§9). §9 회귀 가드 test 가 이 값이 에러 메시지/throw
// payload 로 새지 않음을 검증한다.
const FAKE_TOKEN = "test-token-not-real";

// 정상 수집 plan entry fixture 빌더 — host/path 귀속만 담고 raw credential/활동 미포함(R-59).
// apiBaseUrl/hasAuthorizationHeader 는 본 helper 가 참조하지 않으나 타입 완전성 위해 채운다.
function entryFor(
  username: string,
  path: string,
): RealDataE2eGithubCollectionPlanEntry {
  return {
    username,
    host: "github.com",
    apiBaseUrl: "https://api.github.com",
    path,
    hasAuthorizationHeader: true,
  };
}

describe("buildRealDataE2eEvalChainCollectRequest", () => {
  describe("happy path (entry + token → bounded single GithubRequestInput)", () => {
    it("정상 entry + 비어있지 않은 token → host/token/path/query 조립 + per_page='1' 박제", () => {
      const entry = entryFor("myungjoo", "/users/myungjoo/events/public");
      const input: GithubRequestInput = buildRealDataE2eEvalChainCollectRequest(
        entry,
        FAKE_TOKEN,
      );

      expect(input.host).toBe("github.com");
      expect(input.token).toBe(FAKE_TOKEN);
      expect(input.path).toBe("/users/myungjoo/events/public");
      // bounded single(정확히 1 건, 무제한 아님) — T-0245 round-trip 1 회 상한.
      expect(input.query).toEqual({ per_page: "1" });
    });

    it("entry.host/path 를 그대로 귀속한다(다른 username/path 로도 동치)", () => {
      const entry = entryFor("leemgs", "/users/leemgs/events/public");
      const input = buildRealDataE2eEvalChainCollectRequest(entry, FAKE_TOKEN);

      expect(input.host).toBe("github.com");
      expect(input.path).toBe("/users/leemgs/events/public");
      expect(input.query).toEqual({ per_page: "1" });
    });
  });

  describe("error path (각 guard 분기 → 명시적 throw)", () => {
    it("entry 가 null → 한국어 메시지 TypeError", () => {
      expect(() =>
        buildRealDataE2eEvalChainCollectRequest(
          null as unknown as RealDataE2eGithubCollectionPlanEntry,
          FAKE_TOKEN,
        ),
      ).toThrow(/entry 가 null/);
    });

    it("entry 가 undefined → TypeError", () => {
      expect(() =>
        buildRealDataE2eEvalChainCollectRequest(
          undefined as unknown as RealDataE2eGithubCollectionPlanEntry,
          FAKE_TOKEN,
        ),
      ).toThrow(TypeError);
    });

    it("entry 가 비객체(문자열) → TypeError", () => {
      expect(() =>
        buildRealDataE2eEvalChainCollectRequest(
          "not-an-entry" as unknown as RealDataE2eGithubCollectionPlanEntry,
          FAKE_TOKEN,
        ),
      ).toThrow(/entry 가 null/);
    });

    it("entry.host 누락 → 한국어 메시지 throw", () => {
      const entry = {
        ...entryFor("myungjoo", "/users/myungjoo/events/public"),
        host: undefined,
      } as unknown as RealDataE2eGithubCollectionPlanEntry;
      expect(() =>
        buildRealDataE2eEvalChainCollectRequest(entry, FAKE_TOKEN),
      ).toThrow(/entry\.host 가 비어있거나/);
    });

    it("entry.path 누락 → 한국어 메시지 throw", () => {
      const entry = {
        ...entryFor("myungjoo", "/users/myungjoo/events/public"),
        path: undefined,
      } as unknown as RealDataE2eGithubCollectionPlanEntry;
      expect(() =>
        buildRealDataE2eEvalChainCollectRequest(entry, FAKE_TOKEN),
      ).toThrow(/entry\.path 가 비어있거나/);
    });

    it("token 이 빈 문자열 → 한국어 메시지 throw(인증 없는 요청 조립 차단)", () => {
      const entry = entryFor("myungjoo", "/users/myungjoo/events/public");
      expect(() => buildRealDataE2eEvalChainCollectRequest(entry, "")).toThrow(
        /token 가 비어있거나/,
      );
    });

    it("token 이 비-string(undefined) → throw", () => {
      const entry = entryFor("myungjoo", "/users/myungjoo/events/public");
      expect(() =>
        buildRealDataE2eEvalChainCollectRequest(
          entry,
          undefined as unknown as string,
        ),
      ).toThrow(/token 가 비어있거나/);
    });
  });

  describe("negative cases (충분 cover — 각 1+)", () => {
    it("(a) entry.host 가 공백-only → throw(빈 host 로 요청 조립 차단)", () => {
      const entry = entryFor("myungjoo", "/users/myungjoo/events/public");
      entry.host = "   ";
      expect(() =>
        buildRealDataE2eEvalChainCollectRequest(entry, FAKE_TOKEN),
      ).toThrow(/entry\.host 가 비어있거나/);
    });

    it("(b) entry.path 가 공백-only → throw", () => {
      const entry = entryFor("myungjoo", "   ");
      expect(() =>
        buildRealDataE2eEvalChainCollectRequest(entry, FAKE_TOKEN),
      ).toThrow(/entry\.path 가 비어있거나/);
    });

    it("(c) token 이 공백-only → throw", () => {
      const entry = entryFor("myungjoo", "/users/myungjoo/events/public");
      expect(() =>
        buildRealDataE2eEvalChainCollectRequest(entry, "   "),
      ).toThrow(/token 가 비어있거나/);
    });

    it("(d) entry.host 가 비-string(number) → throw", () => {
      const entry = {
        ...entryFor("myungjoo", "/users/myungjoo/events/public"),
        host: 123,
      } as unknown as RealDataE2eGithubCollectionPlanEntry;
      expect(() =>
        buildRealDataE2eEvalChainCollectRequest(entry, FAKE_TOKEN),
      ).toThrow(/entry\.host 가 비어있거나/);
    });

    it("(e) leading-slash 없는 path 도 그대로 귀속한다(정규화는 builder 책임)", () => {
      const entry = entryFor("myungjoo", "users/myungjoo/events/public");
      const input = buildRealDataE2eEvalChainCollectRequest(entry, FAKE_TOKEN);
      // 본 helper 는 path 를 정규화하지 않고 귀속만 — path 정규화는 buildGithubRequest 책임.
      expect(input.path).toBe("users/myungjoo/events/public");
      expect(input.query).toEqual({ per_page: "1" });
    });

    it("(f) query 오염 차단 — 호출처가 per_page 를 덮어쓸 통로가 없다(항상 '1')", () => {
      // entry 에 per_page/query 유사 필드를 심어도 helper 는 무시하고 항상 per_page='1'.
      const polluted = {
        ...entryFor("myungjoo", "/users/myungjoo/events/public"),
        query: { per_page: "9999" },
        per_page: "9999",
      } as unknown as RealDataE2eGithubCollectionPlanEntry;
      const input = buildRealDataE2eEvalChainCollectRequest(
        polluted,
        FAKE_TOKEN,
      );
      expect(input.query).toEqual({ per_page: "1" });
    });
  });

  describe("순수성 / 입력 비변형 (부수효과 0)", () => {
    it("호출 후 입력 entry 가 mutate 되지 않는다", () => {
      const entry = entryFor("myungjoo", "/users/myungjoo/events/public");
      const snapshot = JSON.stringify(entry);
      buildRealDataE2eEvalChainCollectRequest(entry, FAKE_TOKEN);
      expect(JSON.stringify(entry)).toBe(snapshot);
    });

    it("호출마다 새 query 객체를 반환한다(공유 mutable 노출 0)", () => {
      const entry = entryFor("myungjoo", "/users/myungjoo/events/public");
      const a = buildRealDataE2eEvalChainCollectRequest(entry, FAKE_TOKEN);
      const b = buildRealDataE2eEvalChainCollectRequest(entry, FAKE_TOKEN);
      expect(a).toEqual(b);
      expect(a.query).not.toBe(b.query);
      // 반환 query 를 mutate 해도 다음 호출에 영향 0.
      (a.query as Record<string, string>).per_page = "42";
      const c = buildRealDataE2eEvalChainCollectRequest(entry, FAKE_TOKEN);
      expect(c.query).toEqual({ per_page: "1" });
    });
  });

  describe("(§9 / R-59) token 이 반환 객체 외 어디에도 새지 않음", () => {
    it("token guard 실패(빈 token) 메시지에 token 값이 노출되지 않는다", () => {
      // 빈 token 이라 값 자체는 없지만, 메시지에 'token' field 이름만 담기고 payload 노출 0.
      try {
        buildRealDataE2eEvalChainCollectRequest(
          entryFor("myungjoo", "/users/myungjoo/events/public"),
          "",
        );
        throw new Error("throw 되어야 함");
      } catch (err) {
        expect((err as Error).message).not.toContain(FAKE_TOKEN);
        expect((err as Error).message).toContain("token 가 비어있거나");
      }
    });

    it("성공 경로: token 은 반환 객체 token 필드로만 통과(다른 필드/메시지 노출 0)", () => {
      const entry = entryFor("myungjoo", "/users/myungjoo/events/public");
      const input = buildRealDataE2eEvalChainCollectRequest(entry, FAKE_TOKEN);

      // 반환 token 필드에만 존재.
      expect(input.token).toBe(FAKE_TOKEN);
      // host/path/query 직렬화에는 token 미등장(반환 전체 직렬화에는 token 필드로 1 회만).
      const withoutToken = {
        host: input.host,
        path: input.path,
        query: input.query,
      };
      expect(JSON.stringify(withoutToken)).not.toContain(FAKE_TOKEN);
    });
  });

  // self-wire drift-guard 배선 검증 (T-0983) — producer 가 반환 직전 consistency oracle 가드를
  // 스스로 호출해 조립 즉시 자가 검증하는지를 R-112 4종(happy/error/flow/negative)으로 봉한다.
  describe("self-wire consistency guard (T-0983)", () => {
    afterEach(() => {
      jest.restoreAllMocks();
    });

    describe("happy-path (self-wire 배선 후에도 정합 요청 정상 반환 — throw 0)", () => {
      it("(i) 정상 entry + token → throw 없이 정합 GithubRequestInput 반환", () => {
        const entry = entryFor("myungjoo", "/users/myungjoo/events/public");
        expect(() =>
          buildRealDataE2eEvalChainCollectRequest(entry, FAKE_TOKEN),
        ).not.toThrow();
        const input = buildRealDataE2eEvalChainCollectRequest(
          entry,
          FAKE_TOKEN,
        );
        expect(input.host).toBe("github.com");
        expect(input.path).toBe("/users/myungjoo/events/public");
        expect(input.token).toBe(FAKE_TOKEN);
        expect(input.query).toEqual({ per_page: "1" });
      });

      it("(ii) 다른 username/path 로도 self-wire 후 정합 반환", () => {
        const entry = entryFor("leemgs", "/users/leemgs/events/public");
        const input = buildRealDataE2eEvalChainCollectRequest(
          entry,
          FAKE_TOKEN,
        );
        expect(input.path).toBe("/users/leemgs/events/public");
        expect(input.query).toEqual({ per_page: "1" });
      });
    });

    describe("error-path (기존 방어 guard 가 self-wire 로 가려지지 않음)", () => {
      it("entry null → producer 자체 TypeError(가드 미도달)", () => {
        expect(() =>
          buildRealDataE2eEvalChainCollectRequest(
            null as unknown as RealDataE2eGithubCollectionPlanEntry,
            FAKE_TOKEN,
          ),
        ).toThrow(TypeError);
      });

      it("entry.host 공백 → producer guard 의 throw(가드 미도달)", () => {
        const entry = entryFor("myungjoo", "/users/myungjoo/events/public");
        entry.host = "   ";
        expect(() =>
          buildRealDataE2eEvalChainCollectRequest(entry, FAKE_TOKEN),
        ).toThrow(/entry\.host 가 비어있거나/);
      });

      it("entry.path 공백 → producer guard 의 throw(가드 미도달)", () => {
        const entry = entryFor("myungjoo", "   ");
        expect(() =>
          buildRealDataE2eEvalChainCollectRequest(entry, FAKE_TOKEN),
        ).toThrow(/entry\.path 가 비어있거나/);
      });

      it("token 공백/비-string → producer guard 의 throw(가드 미도달)", () => {
        const entry = entryFor("myungjoo", "/users/myungjoo/events/public");
        expect(() =>
          buildRealDataE2eEvalChainCollectRequest(entry, "   "),
        ).toThrow(/token 가 비어있거나/);
        expect(() =>
          buildRealDataE2eEvalChainCollectRequest(
            entry,
            undefined as unknown as string,
          ),
        ).toThrow(/token 가 비어있거나/);
      });
    });

    describe("flow/branch (self-wire 호출 사실 검증 — spy 로 배선 존재 증명)", () => {
      it("정상 경로 → 가드가 (entry, token, 반환 result) 로 정확히 1 회 호출", () => {
        const spy = jest.spyOn(
          collectRequestConsistency,
          "assertRealDataE2eEvalChainCollectRequestConsistent",
        );
        const entry = entryFor("myungjoo", "/users/myungjoo/events/public");
        const input = buildRealDataE2eEvalChainCollectRequest(
          entry,
          FAKE_TOKEN,
        );

        expect(spy).toHaveBeenCalledTimes(1);
        expect(spy).toHaveBeenCalledWith(entry, FAKE_TOKEN, input);
      });

      it("다른 entry 경로 → 가드가 반환 result 인자로 정확히 1 회 호출", () => {
        const spy = jest.spyOn(
          collectRequestConsistency,
          "assertRealDataE2eEvalChainCollectRequestConsistent",
        );
        const entry = entryFor("leemgs", "/users/leemgs/events/public");
        const input = buildRealDataE2eEvalChainCollectRequest(
          entry,
          FAKE_TOKEN,
        );

        expect(spy).toHaveBeenCalledTimes(1);
        expect(spy).toHaveBeenCalledWith(entry, FAKE_TOKEN, input);
        expect(input.path).toBe("/users/leemgs/events/public");
      });
    });

    describe("negative (예외 상황 분기마다 1+ — drift 전파 · 비변형)", () => {
      it("(a) 가드가 drift 감지해 RangeError throw → producer 가 동일 RangeError 전파(silent 삼킴 0)", () => {
        const drift = new RangeError("정합 위반: 강제 drift(테스트)");
        jest
          .spyOn(
            collectRequestConsistency,
            "assertRealDataE2eEvalChainCollectRequestConsistent",
          )
          .mockImplementation(() => {
            throw drift;
          });

        const entry = entryFor("myungjoo", "/users/myungjoo/events/public");
        expect(() =>
          buildRealDataE2eEvalChainCollectRequest(entry, FAKE_TOKEN),
        ).toThrow(drift);
      });

      it("(b) self-wire 가 정상 산출을 mutate 하지 않음 — 반환은 새 객체 + 새 query, 입력 entry/token 미변형", () => {
        const entry = entryFor("myungjoo", "/users/myungjoo/events/public");
        const snapshot = JSON.stringify(entry);

        const a = buildRealDataE2eEvalChainCollectRequest(entry, FAKE_TOKEN);
        const b = buildRealDataE2eEvalChainCollectRequest(entry, FAKE_TOKEN);

        // 입력 entry 미변형.
        expect(JSON.stringify(entry)).toBe(snapshot);
        // 반환은 매 호출 새 객체 + 새 query(공유 mutable 노출 0).
        expect(a).toEqual(b);
        expect(a).not.toBe(b);
        expect(a.query).not.toBe(b.query);
      });
    });
  });
});
