import * as validateModule from "../export/import-dump-validate";

import {
  parseImportDumpBuffer,
  type ImportDumpParseResult,
} from "./import-dump-parse";

// 본 spec 은 R-112 4 종 (happy / error / flow·branch / negative 충분 cover) 을 3 분기
// (deserialize 실패 · structure 실패 · 전부 통과) 기준으로 검증한다. 하류 helper
// (deserializeDumpBuffer / validateImportDumpStructure) 의 세부 규칙은 각자의 colocated spec 이
// 이미 cover 하므로, 여기서는 **합성 계약** (stage 분류 · 단락 평가 · verdict 전달) 에 집중한다.
describe("parseImportDumpBuffer", () => {
  // UTF-8 BOM (U+FEFF) — 소스에 보이지 않는 문자를 직접 넣지 않도록 code point 로 만든다.
  const BOM = String.fromCharCode(0xfeff);

  // 정상 dump envelope — buildExportDump(ExportDump) 의 축소판 (5 entity key 정합).
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

  const toBuffer = (value: unknown): Buffer =>
    Buffer.from(JSON.stringify(value), "utf-8");

  // 실패 verdict 를 좁히는 helper — ok: false 를 assert 한 뒤 stage / issues 를 꺼내 쓴다.
  const expectFailure = (
    result: ImportDumpParseResult,
  ): { stage: string; issues: string[] } => {
    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error("실패 verdict 를 기대했으나 ok: true 가 반환되었습니다");
    }
    return { stage: result.stage, issues: result.issues };
  };

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("전부 통과 분기 (happy path)", () => {
    it("정상 dump buffer 는 ok: true 와 파싱 결과 deep-equal dump 를 반환한다", () => {
      const result = parseImportDumpBuffer(toBuffer(sampleDump));

      expect(result).toEqual({ ok: true, dump: sampleDump });
    });

    it("선두 BOM 이 붙은 같은 dump buffer 도 ok: true 로 통과한다 (T-1255 nit 회수)", () => {
      const buffer = Buffer.from(BOM + JSON.stringify(sampleDump), "utf-8");

      expect(parseImportDumpBuffer(buffer)).toEqual({
        ok: true,
        dump: sampleDump,
      });
    });
  });

  describe("deserialize 실패 분기 (error path · negative)", () => {
    it("손상 JSON buffer 는 stage: deserialize + issues 1 개를 반환하고 throw 하지 않는다", () => {
      const buffer = Buffer.from(
        '{"schemaVersion": "1", "records": [',
        "utf-8",
      );

      let result!: ImportDumpParseResult;
      expect(() => {
        result = parseImportDumpBuffer(buffer);
      }).not.toThrow();

      const { stage, issues } = expectFailure(result);
      expect(stage).toBe("deserialize");
      expect(issues).toHaveLength(1);
      expect(issues[0]).toContain("손상된 dump JSON");
    });

    it.each([
      ["null", null],
      ["undefined", undefined],
      ["string", "not-a-buffer"],
    ])(
      "비-Buffer 입력 %s 은 stage: deserialize 로 안전 반환한다",
      (_l, input) => {
        // 타입 계약상 Buffer 이지만 배선 실수로 다른 값이 올 수 있다 — 런타임 방어 검증.
        const result = parseImportDumpBuffer(input as unknown as Buffer);

        const { stage, issues } = expectFailure(result);
        expect(stage).toBe("deserialize");
        expect(issues).toHaveLength(1);
      },
    );

    it.each([
      ["빈 buffer", Buffer.alloc(0)],
      ["whitespace-only buffer", Buffer.from(" \t\r\n ", "utf-8")],
      ["BOM-only buffer", Buffer.from(BOM, "utf-8")],
    ])("%s 는 stage: deserialize 로 분류된다", (_label, buffer) => {
      const { stage, issues } = expectFailure(parseImportDumpBuffer(buffer));

      expect(stage).toBe("deserialize");
      expect(issues[0]).toContain("빈 dump 파일");
    });

    it("deserialize 실패 시 validateImportDumpStructure 를 호출하지 않는다 (단락 평가)", () => {
      const spy = jest.spyOn(validateModule, "validateImportDumpStructure");

      const result = parseImportDumpBuffer(Buffer.from("{oops", "utf-8"));

      expect(expectFailure(result).stage).toBe("deserialize");
      expect(spy).not.toHaveBeenCalled();
    });
  });

  describe("structure 실패 분기 (error path · negative)", () => {
    it("recordCount 불일치 dump 는 stage: structure + validate 위반 메시지를 담는다", () => {
      const broken = { ...sampleDump, recordCount: 5 };

      const { stage, issues } = expectFailure(
        parseImportDumpBuffer(toBuffer(broken)),
      );

      expect(stage).toBe("structure");
      expect(issues.join(" ")).toContain("recordCount");
    });

    it.each([
      ["primitive number", "123"],
      ["primitive string", '"x"'],
      ["array", "[]"],
    ])(
      "파싱은 되지만 top-level 이 %s 인 JSON 은 stage: structure 로 분류된다",
      (_label, raw) => {
        const { stage, issues } = expectFailure(
          parseImportDumpBuffer(Buffer.from(raw, "utf-8")),
        );

        expect(stage).toBe("structure");
        expect(issues[0]).toContain("plain object");
      },
    );

    it("구조 위반이 여러 개면 issues 에 2 개 이상 누적된다", () => {
      const broken = {
        schemaVersion: 7,
        generatedAt: "not-a-date",
        entityCounts: {},
        recordCount: "많음",
        records: "배열 아님",
      };

      const { stage, issues } = expectFailure(
        parseImportDumpBuffer(toBuffer(broken)),
      );

      expect(stage).toBe("structure");
      expect(issues.length).toBeGreaterThanOrEqual(2);
    });

    it("issues 는 validate verdict 의 배열 내용을 그대로 전달한다", () => {
      const broken = { ...sampleDump, recordCount: 5 };
      const expected =
        validateModule.validateImportDumpStructure(broken).issues;

      const { issues } = expectFailure(parseImportDumpBuffer(toBuffer(broken)));

      expect(issues).toEqual(expected);
    });
  });

  describe("순수성 (non-mutating)", () => {
    it("입력 buffer 는 호출 후에도 원본과 동일하다", () => {
      const source = JSON.stringify(sampleDump);
      const buffer = Buffer.from(source, "utf-8");
      const snapshot = Buffer.from(buffer);

      parseImportDumpBuffer(buffer);

      expect(buffer.equals(snapshot)).toBe(true);
      expect(buffer.toString("utf-8")).toBe(source);
    });
  });
});
