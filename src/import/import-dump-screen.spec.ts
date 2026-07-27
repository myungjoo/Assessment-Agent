import { EXPORT_SCHEMA_VERSION } from "../export/export-dump";
import * as compatModule from "../export/schema-version-compat";

import {
  screenImportDumpBuffer,
  type ImportDumpScreenResult,
} from "./import-dump-screen";

// 본 spec 은 R-112 4 종 (happy / error / flow·branch / negative 충분 cover) 을 4 분기
// (parse 실패 전달 · version reject · version migrate · version accept) 기준으로 검증한다.
// 하류 helper (parseImportDumpBuffer / checkSchemaVersionCompat) 의 세부 규칙은 각자의 colocated
// spec 이 이미 cover 하므로, 여기서는 **합성 계약** (stage 분류 · 단락 평가 · verdict 전달 ·
// migrate 등급) 에 집중한다.
describe("screenImportDumpBuffer", () => {
  // 정상 dump envelope — buildExportDump(ExportDump) 의 축소판 (5 entity key 정합).
  // schemaVersion 은 현재 시스템 상수를 그대로 써 accept 분기를 만든다.
  const sampleDump = {
    schemaVersion: EXPORT_SCHEMA_VERSION,
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
  // 과거 version dump — reject / migrate 분기를 나누는 입력.
  const OLD = "0.9";
  const legacyDump = { ...sampleDump, schemaVersion: OLD };
  // 구조 위반 (recordCount 불일치) dump 의 raw JSON.
  const brokenRaw = JSON.stringify({ ...sampleDump, recordCount: 5 });

  const toBuffer = (value: unknown): Buffer =>
    Buffer.from(JSON.stringify(value), "utf-8");

  // verdict 를 좁히는 helper — 기대와 다른 분기가 나오면 그 자리에서 실패시킨다.
  const expectFailure = (result: ImportDumpScreenResult) => {
    if (result.ok) {
      throw new Error("실패 verdict 를 기대했으나 ok: true 가 반환되었습니다");
    }
    return result;
  };
  const expectSuccess = (result: ImportDumpScreenResult) => {
    if (!result.ok) {
      throw new Error(
        `성공 verdict 를 기대했으나 stage: ${result.stage} 가 반환되었습니다`,
      );
    }
    return result;
  };

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("현재 schemaVersion dump 는 ok: true + accept 판정 + 파싱 dump 를 반환한다", () => {
    const result = expectSuccess(screenImportDumpBuffer(toBuffer(sampleDump)));

    expect(result.dump).toEqual(sampleDump);
    expect(result.version.action).toBe("accept");
    expect(result.version.compatible).toBe(true);
    // options 생략 시 현재 시스템 version 이 default 로 적용된다.
    expect(result.version.currentVersion).toBe(EXPORT_SCHEMA_VERSION);
    expect(result.version.uploadedVersion).toBe(EXPORT_SCHEMA_VERSION);
  });

  describe("parse 실패 전달 분기 (error path · negative)", () => {
    it.each([
      ["손상 JSON buffer", Buffer.from('{"schemaVersion": "1", "records": [')],
      ["빈 buffer", Buffer.alloc(0)],
      ["whitespace-only buffer", Buffer.from(" \t\r\n ", "utf-8")],
      ["null", null],
      ["undefined", undefined],
      ["string", "not-a-buffer"],
    ])("%s 입력은 stage: deserialize 로 안전 반환한다", (_label, input) => {
      // 타입 계약상 Buffer 이지만 배선 실수로 다른 값이 올 수 있다 — 런타임 방어 검증.
      let result!: ImportDumpScreenResult;
      expect(() => {
        result = screenImportDumpBuffer(input as unknown as Buffer);
      }).not.toThrow();

      expect(expectFailure(result).stage).toBe("deserialize");
      expect(expectFailure(result).issues).toHaveLength(1);
    });

    it.each([
      ["primitive number", "123", "plain object"],
      ["primitive string", '"x"', "plain object"],
      ["array", "[]", "plain object"],
      ["recordCount 불일치 dump", brokenRaw, "recordCount"],
    ])("%s 는 stage: structure 로 분류된다", (_label, raw, fragment) => {
      const result = expectFailure(
        screenImportDumpBuffer(Buffer.from(raw, "utf-8")),
      );

      expect(result.stage).toBe("structure");
      // 하류 validate verdict 의 위반 메시지를 재가공 없이 그대로 전달한다.
      expect(result.issues.join(" ")).toContain(fragment);
    });

    it.each([
      ["deserialize", "{oops"],
      ["structure", "[]"],
    ])(
      "%s 실패 시 checkSchemaVersionCompat 를 호출하지 않는다 (단락 평가)",
      (stage, raw) => {
        const spy = jest.spyOn(compatModule, "checkSchemaVersionCompat");

        const result = expectFailure(
          screenImportDumpBuffer(Buffer.from(raw, "utf-8")),
        );

        expect(result.stage).toBe(stage);
        expect(spy).not.toHaveBeenCalled();
      },
    );
  });

  describe("version reject 분기 (error path · negative)", () => {
    it.each([
      ["migration 미허용", legacyDump, undefined, OLD],
      ["migration 빈 목록", legacyDump, { allowMigrationFrom: [] }, OLD],
      ["currentVersion 명시", sampleDump, { currentVersion: "9.9.9" }, "9.9.9"],
    ])(
      "%s 는 stage: version + issues 1 개를 반환하고 throw 하지 않는다",
      (_label, dump, options, expected) => {
        let result!: ImportDumpScreenResult;
        expect(() => {
          result = screenImportDumpBuffer(
            toBuffer(dump),
            options as compatModule.SchemaVersionCompatOptions | undefined,
          );
        }).not.toThrow();

        const failure = expectFailure(result);
        expect(failure.stage).toBe("version");
        expect(failure.issues).toHaveLength(1);
        expect(failure.issues[0]).toContain(expected as string);
      },
    );

    it("reason 없는 reject verdict 가 와도 issues 1 개를 합성한다 (방어 분기)", () => {
      // 현재 checkSchemaVersionCompat 는 reject 시 항상 reason 을 채우지만 계약상 optional
      // 이므로, 하류가 생략해도 issues 가 비지 않아야 한다.
      jest.spyOn(compatModule, "checkSchemaVersionCompat").mockReturnValue({
        compatible: false,
        action: "reject",
        uploadedVersion: OLD,
        currentVersion: EXPORT_SCHEMA_VERSION,
      });

      const result = expectFailure(
        screenImportDumpBuffer(toBuffer(sampleDump)),
      );

      expect(result.stage).toBe("version");
      expect(result.issues).toHaveLength(1);
      expect(result.issues[0]).toContain(OLD);
    });
  });

  it("allowMigrationFrom 에 업로드 version 이 포함되면 ok: true + migrate 를 반환한다", () => {
    // migrate 는 차단이 아니라 호출측 confirmation 영역 (preflight warning 등급과 동일 분류).
    const raw = screenImportDumpBuffer(toBuffer(legacyDump), {
      allowMigrationFrom: [OLD],
    });
    const result = expectSuccess(raw);

    expect(result.version.action).toBe("migrate");
    expect(result.version.compatible).toBe(false);
    expect(result.version.reason).toContain("migration");
    expect(result.dump).toEqual(legacyDump);
    expect(raw).not.toHaveProperty("issues");
  });

  describe("순수성 (non-mutating)", () => {
    it("입력 buffer 는 호출 후에도 원본과 동일하다", () => {
      const source = JSON.stringify(sampleDump);
      const buffer = Buffer.from(source, "utf-8");
      const snapshot = Buffer.from(buffer);

      screenImportDumpBuffer(buffer);

      expect(buffer.equals(snapshot)).toBe(true);
      expect(buffer.toString("utf-8")).toBe(source);
    });

    it("freeze 된 options 로 호출해도 통과하며 options 는 변형되지 않는다", () => {
      const options = Object.freeze({
        currentVersion: EXPORT_SCHEMA_VERSION,
        allowMigrationFrom: Object.freeze([OLD]),
      });

      let result!: ImportDumpScreenResult;
      expect(() => {
        result = screenImportDumpBuffer(toBuffer(sampleDump), options);
      }).not.toThrow();

      expect(expectSuccess(result).version.action).toBe("accept");
      expect(options).toEqual({
        currentVersion: EXPORT_SCHEMA_VERSION,
        allowMigrationFrom: [OLD],
      });
    });
  });
});
