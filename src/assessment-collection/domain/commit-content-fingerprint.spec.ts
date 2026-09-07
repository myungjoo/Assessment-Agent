// commit-content-fingerprint 의 unit test(CLAUDE.md §3.2 R-112 — happy / error /
// branch / negative). ADR-0063 § Decision 2(정규화 5 규칙) · § Decision 4(하한 20 자)
// 를 그대로 단언한다 — 외부 I/O 0, 순수 함수 fixture 입력만.

import {
  CONTENT_FINGERPRINT_MIN_LENGTH,
  computeCommitContentFingerprint,
} from "./commit-content-fingerprint";

const HEX64 = /^[0-9a-f]{64}$/;
// 하한을 넉넉히 넘는 baseline 메시지.
const BASE = "feat: 내용 지문 helper 를 신설한다\n\n두 번째 문단 본문.";

describe("computeCommitContentFingerprint", () => {
  describe("happy path (R-112-1)", () => {
    it("정규화 후 sha256 hex 64 자를 돌려주고 재호출 시 같은 digest 다(결정성·절단 0)", () => {
      const first = computeCommitContentFingerprint(BASE);
      expect(first).toMatch(HEX64);
      expect((first as string).length).toBe(64);
      expect(computeCommitContentFingerprint(BASE)).toBe(first);
    });
  });

  describe("error path (R-112-2)", () => {
    it.each([
      ["undefined", undefined],
      ["null", null],
      ["number", 42],
      ["객체", { message: "hello" }],
      ["배열", ["hello"]],
      ["boolean", true],
    ])("비-string 입력(%s)은 throw 없이 undefined", (_label, input) => {
      expect(() => computeCommitContentFingerprint(input)).not.toThrow();
      expect(computeCommitContentFingerprint(input)).toBeUndefined();
    });

    it("정규화 결과가 비면 undefined — 빈 문자열 · 공백뿐 · trailer 뿐", () => {
      expect(computeCommitContentFingerprint("")).toBeUndefined();
      expect(computeCommitContentFingerprint("   \n\t\n  ")).toBeUndefined();
      expect(
        computeCommitContentFingerprint(
          "Signed-off-by: 홍 <h@e.com>\nChange-Id: Iabc0123456789\n",
        ),
      ).toBeUndefined();
    });
  });

  describe("정규화 분기별 (R-112-3)", () => {
    it("규칙 1 — CRLF · CR 은 LF 와 같은 digest", () => {
      const lf = "첫 행 본문입니다 그리고 계속\n둘째 행 본문입니다";
      const digest = computeCommitContentFingerprint(lf);
      expect(computeCommitContentFingerprint(lf.replace(/\n/g, "\r\n"))).toBe(
        digest,
      );
      expect(computeCommitContentFingerprint(lf.replace(/\n/g, "\r"))).toBe(
        digest,
      );
    });

    it.each([
      ["Signed-off-by", "Signed-off-by: 홍길동 <gildong@example.com>"],
      ["소문자 signed-off-by", "signed-off-by: 홍길동 <g@example.com>"],
      ["Change-Id", "Change-Id: I0123456789abcdef0123456789abcdef0123"],
      ["Reviewed-on", "Reviewed-on: https://gerrit.example.com/c/1234"],
      ["cherry-pick", "(cherry picked from commit 0a1b2c3d4e5f6071)"],
      ["대소문자 섞인 cherry-pick", "(Cherry Picked From Commit 0A1B2C3D)"],
    ])(
      "규칙 2 — %s trailer 는 제거돼 baseline 과 digest 가 같다",
      (_l, trailer) => {
        expect(computeCommitContentFingerprint(`${BASE}\n\n${trailer}\n`)).toBe(
          computeCommitContentFingerprint(BASE),
        );
      },
    );

    it("규칙 2 — Co-authored-by 는 보존된다(제거했을 때와 digest 가 다르다)", () => {
      const co = `${BASE}\n\nCo-authored-by: 김철수 <chulsoo@example.com>`;
      // 기여자 구성은 내용의 일부 → baseline 과 달라야 한다.
      expect(computeCommitContentFingerprint(co)).not.toBe(
        computeCommitContentFingerprint(BASE),
      );
      // 반면 Signed-off-by 만 더 붙은 사본과는 같다(그 행만 제거되므로).
      expect(
        computeCommitContentFingerprint(`${co}\nSigned-off-by: 홍 <h@e.com>`),
      ).toBe(computeCommitContentFingerprint(co));
      // 행이 trailer prefix 로 시작하지 않으면 본문이므로 제거되지 않는다.
      expect(
        computeCommitContentFingerprint(
          `${BASE}\n본문 안의 Signed-off-by: 설명`,
        ),
      ).not.toBe(computeCommitContentFingerprint(BASE));
    });

    it("규칙 3·4 — 연속 공백 · 들여쓰기 · 연속 빈 행 · 행끝 공백 차이는 같은 digest", () => {
      expect(
        computeCommitContentFingerprint(
          "  제목    행\t본문입니다   \n\n\n   본문  행 하나\t\t\n본문 행 둘   \n\n",
        ),
      ).toBe(
        computeCommitContentFingerprint(
          "제목 행 본문입니다\n본문 행 하나\n본문 행 둘",
        ),
      );
    });

    it("하한 경계 — 정규화 결과 정확히 20 자면 산출, 19 자면 undefined", () => {
      const exactly = "abcdefghij klmnopqrs";
      const under = "Merge branch 'main'";
      expect(CONTENT_FINGERPRINT_MIN_LENGTH).toBe(20);
      expect(exactly.length).toBe(CONTENT_FINGERPRINT_MIN_LENGTH);
      expect(under.length).toBe(CONTENT_FINGERPRINT_MIN_LENGTH - 1);
      expect(computeCommitContentFingerprint(exactly)).toMatch(HEX64);
      expect(computeCommitContentFingerprint(under)).toBeUndefined();
      // 판정은 정규화 **후** 길이 기준 — 원본이 20 자 초과여도 정규화하면 "fix typo"(8).
      const padded = "   fix     typo   \n\n\n   ";
      expect(padded.length).toBeGreaterThan(CONTENT_FINGERPRINT_MIN_LENGTH);
      expect(computeCommitContentFingerprint(padded)).toBeUndefined();
    });
  });

  describe("negative case (R-112-4)", () => {
    it("대소문자만 다른 두 메시지는 서로 다른 digest(lowercase 정규화 미채택)", () => {
      expect(
        computeCommitContentFingerprint("fix the collection dedup boundary"),
      ).not.toBe(
        computeCommitContentFingerprint("Fix The Collection Dedup Boundary"),
      );
    });
  });
});
