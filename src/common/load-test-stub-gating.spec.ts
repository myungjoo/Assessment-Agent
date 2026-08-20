// load-test-stub-gating.spec — isLoadTestStubEnabled 순수 helper 의 R-112 unit test
// (T-1627, ADR-0057 `## Decision` D1). happy(정확히 "1" → true) + error/미설정
// (키 부재 / undefined → false) + 분기(두 분기 각각 + 인자 생략 default 경로) +
// negative 충분 cover(값 변형마다 false) 를 모두 cover 한다.
//
// 본 spec 이 지키는 것은 D1 의 fail-safe default OFF 다 — 오활성은 프로덕션에서
// LLM 이 조용히 가짜 응답을 내는 사고이므로, "true 가 되는 경우" 보다 "false 로
// 남아야 하는 경우" 를 훨씬 촘촘히 고정한다.
import {
  LOAD_TEST_STUB_ENV,
  isLoadTestStubEnabled,
} from "./load-test-stub-gating";

describe("LOAD_TEST_STUB_ENV — env 이름 상수 drift 방지", () => {
  it('상수 값이 정확히 "LOAD_TEST_STUB" 로 고정된다(후속 workflow env 주입과의 drift 방지)', () => {
    expect(LOAD_TEST_STUB_ENV).toBe("LOAD_TEST_STUB");
  });
});

describe("isLoadTestStubEnabled — 부하용 stub 활성 판정(ADR-0057 D1)", () => {
  describe('happy: 정확히 "1" 일 때만 활성', () => {
    it('{ LOAD_TEST_STUB: "1" } 주입 시 true 를 반환한다', () => {
      expect(isLoadTestStubEnabled({ [LOAD_TEST_STUB_ENV]: "1" })).toBe(true);
    });

    it("다른 env 가 함께 있어도 판정은 LOAD_TEST_STUB 값만 본다", () => {
      const env: NodeJS.ProcessEnv = {
        NODE_ENV: "production",
        [LOAD_TEST_STUB_ENV]: "1",
        OTHER_FLAG: "0",
      };

      expect(isLoadTestStubEnabled(env)).toBe(true);
    });
  });

  describe("error / 미설정 path: 키 부재·undefined → 비활성(fail-safe OFF)", () => {
    it("env 객체에 키 자체가 없으면({}) false 를 반환한다", () => {
      expect(isLoadTestStubEnabled({})).toBe(false);
    });

    it("값이 명시적으로 undefined 여도 false 를 반환한다", () => {
      expect(isLoadTestStubEnabled({ [LOAD_TEST_STUB_ENV]: undefined })).toBe(
        false,
      );
    });

    it("다른 env 만 잔뜩 있고 LOAD_TEST_STUB 이 부재하면 false 다", () => {
      const env: NodeJS.ProcessEnv = {
        NODE_ENV: "test",
        LOAD_TEST_STUBB: "1",
        LOAD_TEST: "1",
      };

      expect(isLoadTestStubEnabled(env)).toBe(false);
    });
  });

  describe("negative 충분 cover: 값 변형은 전부 비활성이어야 한다", () => {
    // trim 도 대소문자 folding 도 하지 않는다 — 관대한 해석이 곧 오활성 표면이므로
    // 아래 변형은 하나도 빠짐없이 false 로 고정한다(D1 의 negative test 의무).
    it.each([
      ["빈 문자열", ""],
      ["공백-only", " "],
      ["탭-only", "\t"],
      ["앞 공백", " 1"],
      ["뒤 공백", "1 "],
      ["앞뒤 공백", " 1 "],
      ["개행 포함", "1\n"],
      ["0", "0"],
      ["true", "true"],
      ["TRUE", "TRUE"],
      ["True", "True"],
      ["yes", "yes"],
      ["on", "on"],
      ["01", "01"],
      ["11", "11"],
      ["1.0", "1.0"],
      ["-1", "-1"],
      ["stub", "stub"],
    ])("값이 %s(%j) 이면 false 를 반환한다", (_label, value) => {
      expect(isLoadTestStubEnabled({ [LOAD_TEST_STUB_ENV]: value })).toBe(
        false,
      );
    });
  });

  describe("분기 cover: 두 분기 + 인자 생략 default 경로", () => {
    // process.env 를 만지는 case 는 전역 오염 0 을 위해 저장·복원한다.
    const originalValue = process.env[LOAD_TEST_STUB_ENV];

    afterEach(() => {
      if (originalValue === undefined) {
        delete process.env[LOAD_TEST_STUB_ENV];
      } else {
        process.env[LOAD_TEST_STUB_ENV] = originalValue;
      }
    });

    it('true 분기: 인자 생략 시 process.env 를 읽어 "1" 이면 true 다', () => {
      process.env[LOAD_TEST_STUB_ENV] = "1";

      expect(isLoadTestStubEnabled()).toBe(true);
    });

    it("false 분기: 인자 생략 시 process.env 에 값이 없으면 false 다", () => {
      delete process.env[LOAD_TEST_STUB_ENV];

      expect(isLoadTestStubEnabled()).toBe(false);
    });

    it("false 분기: 인자 생략 시 process.env 값이 다른 값이면 false 다", () => {
      process.env[LOAD_TEST_STUB_ENV] = "true";

      expect(isLoadTestStubEnabled()).toBe(false);
    });

    it("명시 인자가 process.env 보다 우선한다(주입 인자만 본다)", () => {
      process.env[LOAD_TEST_STUB_ENV] = "1";

      expect(isLoadTestStubEnabled({})).toBe(false);
    });
  });

  describe("부수효과 0: 판정이 입력 env 를 변형하지 않는다", () => {
    it("호출 후에도 전달한 env 객체가 그대로 유지된다", () => {
      const env: NodeJS.ProcessEnv = { [LOAD_TEST_STUB_ENV]: " 1" };
      const before = { ...env };

      isLoadTestStubEnabled(env);

      expect(env).toEqual(before);
    });
  });
});
