import {
  deserializeDumpBuffer,
  type DumpDeserializeResult,
} from "./import-dump-deserialize";

// 본 spec 은 R-112 4 종 (happy / error / flow·branch / negative 충분 cover) 을 4 분기
// (정상 · 비-Buffer · 빈·whitespace · 손상 JSON) 기준으로 나눠 검증한다. helper 는 순수
// 함수이므로 DB / repository / mock 없이 buffer 만 넘긴다.
describe("deserializeDumpBuffer", () => {
  // 정상 dump envelope 유사 object — buildExportDump 결과(ExportDump)의 축소판.
  const sampleDump = {
    schemaVersion: "1",
    generatedAt: "2026-07-27T00:00:00.000Z",
    scope: { entities: ["Person"] },
    entityCounts: {
      Assessment: 0,
      Person: 1,
      Group: 0,
      LlmConfig: 0,
      AuditLog: 0,
    },
    recordCount: 1,
    records: [{ entity: "Person", instant: { id: "p1" } }],
  };

  // 실패 verdict 를 좁히는 helper — ok: false 를 assert 한 뒤 reason 을 꺼내 쓴다.
  const expectFailure = (result: DumpDeserializeResult): string => {
    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error("실패 verdict 를 기대했으나 ok: true 가 반환되었습니다");
    }
    return result.reason;
  };

  describe("정상 분기 (happy path)", () => {
    it("정상 JSON buffer 를 파싱해 ok: true 와 deep-equal value 를 반환한다", () => {
      const buffer = Buffer.from(JSON.stringify(sampleDump), "utf-8");

      const result = deserializeDumpBuffer(buffer);

      expect(result.ok).toBe(true);
      if (!result.ok) {
        throw new Error("성공 verdict 를 기대했습니다");
      }
      expect(result.value).toEqual(sampleDump);
    });

    it("앞뒤 공백 / 개행이 섞인 정상 JSON 도 파싱한다", () => {
      const buffer = Buffer.from(`\n  {"a": 1}\t\n`, "utf-8");

      const result = deserializeDumpBuffer(buffer);

      expect(result).toEqual({ ok: true, value: { a: 1 } });
    });

    it("한글 등 멀티바이트 UTF-8 본문을 손실 없이 decode 한다", () => {
      const payload = { note: "평가 대상자 목록", emoji: "✅" };
      const buffer = Buffer.from(JSON.stringify(payload), "utf-8");

      const result = deserializeDumpBuffer(buffer);

      expect(result).toEqual({ ok: true, value: payload });
    });

    it("입력 buffer 를 변형하지 않는다 (순수·non-mutating)", () => {
      const source = JSON.stringify(sampleDump);
      const buffer = Buffer.from(source, "utf-8");
      const snapshot = Buffer.from(buffer);

      deserializeDumpBuffer(buffer);

      expect(buffer.equals(snapshot)).toBe(true);
      expect(buffer.toString("utf-8")).toBe(source);
    });
  });

  // 구조 검증은 본 helper 책임이 아님을 명시적으로 박제한다 — envelope 이 아닌
  // primitive / array 로 파싱돼도 통과시키고, 하류 validateImportDumpStructure 가 걸러낸다.
  describe("구조 검증 비책임 (primitive / array 도 통과)", () => {
    it.each([
      ["number", "123", 123],
      ["string", '"x"', "x"],
      ["boolean", "true", true],
      ["null", "null", null],
      ["empty array", "[]", [] as unknown],
      ["array of primitives", "[1,2]", [1, 2] as unknown],
    ])(
      "%s 로 파싱되는 valid JSON 은 ok: true 로 통과시킨다",
      (_label, raw, expected) => {
        const result = deserializeDumpBuffer(Buffer.from(raw, "utf-8"));

        expect(result).toEqual({ ok: true, value: expected });
      },
    );
  });

  describe("비-Buffer 입력 분기 (negative)", () => {
    it.each([
      ["string", "not-a-buffer"],
      ["null", null],
      ["undefined", undefined],
      ["number", 42],
      ["plain object", { buffer: "x" }],
      ["array", [1, 2, 3]],
      ["Uint8Array 아닌 typed 유사 객체", { length: 3 }],
    ])("%s 입력은 ok: false 와 reason 을 반환한다", (_label, input) => {
      // 런타임 방어 검증 — 타입 계약상 Buffer 이지만 배선 실수로 다른 값이 올 수 있다.
      const result = deserializeDumpBuffer(input as unknown as Buffer);

      const reason = expectFailure(result);
      expect(reason).toContain("Buffer");
      expect(reason.length).toBeGreaterThan(0);
    });

    it("reason 에 입력 종류 라벨을 담되 값 자체는 담지 않는다 (REQ-032)", () => {
      const secret = "s3cr3t-dump-body";

      const reason = expectFailure(
        deserializeDumpBuffer(secret as unknown as Buffer),
      );

      expect(reason).toContain("string");
      expect(reason).not.toContain(secret);
    });

    it("비-Buffer 입력에서도 throw 하지 않는다", () => {
      expect(() =>
        deserializeDumpBuffer(null as unknown as Buffer),
      ).not.toThrow();
    });
  });

  describe("빈 / whitespace-only 분기 (negative)", () => {
    it("길이 0 buffer 는 빈 dump 파일 reason 을 반환한다", () => {
      const reason = expectFailure(deserializeDumpBuffer(Buffer.alloc(0)));

      expect(reason).toContain("빈 dump 파일");
    });

    it.each([
      ["space", "   "],
      ["tab", "\t\t"],
      ["newline", "\n\n"],
      ["mixed whitespace", " \t\r\n "],
    ])("%s 만 담긴 buffer 는 ok: false 를 반환한다", (_label, raw) => {
      const reason = expectFailure(
        deserializeDumpBuffer(Buffer.from(raw, "utf-8")),
      );

      expect(reason).toContain("빈 dump 파일");
    });

    it("빈 buffer 와 whitespace-only 는 서로 다른 reason 으로 구분한다", () => {
      const emptyReason = expectFailure(deserializeDumpBuffer(Buffer.alloc(0)));
      const blankReason = expectFailure(
        deserializeDumpBuffer(Buffer.from("   ", "utf-8")),
      );

      expect(emptyReason).not.toBe(blankReason);
    });
  });

  describe("손상 JSON 분기 (error path)", () => {
    it.each([
      ["truncated object", '{"schemaVersion": "1", "records": ['],
      ["trailing comma", '{"a": 1,}'],
      ["single quote", "{'a': 1}"],
      ["unquoted key", "{a: 1}"],
      ["plain text", "이건 JSON 이 아닙니다"],
      ["binary 유사 본문", "\u0000\u0001\u0002x"],
      ["NaN literal", '{"a": NaN}'],
    ])("%s 은 throw 없이 손상 reason 을 반환한다", (_label, raw) => {
      const buffer = Buffer.from(raw, "utf-8");

      let result!: DumpDeserializeResult;
      expect(() => {
        result = deserializeDumpBuffer(buffer);
      }).not.toThrow();

      const reason = expectFailure(result);
      expect(reason).toContain("손상된 dump JSON");
    });

    it("손상 reason 에 raw 본문 / stack trace 를 담지 않는다 (REQ-032)", () => {
      const raw = '{"leak": "s3cr3t-value", ';

      const reason = expectFailure(
        deserializeDumpBuffer(Buffer.from(raw, "utf-8")),
      );

      expect(reason).not.toContain("s3cr3t-value");
      expect(reason).not.toContain("SyntaxError");
      expect(reason).not.toContain("at ");
    });
  });
});
