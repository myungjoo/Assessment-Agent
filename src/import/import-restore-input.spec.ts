import { EXPORT_SCHEMA_VERSION } from "../export/export-dump";
import type { SchemaVersionCompatOptions } from "../export/schema-version-compat";

import * as hydrateModule from "./import-dump-records-hydrate";
import * as screenModule from "./import-dump-screen";
import {
  prepareImportRestoreInput,
  type ImportRestoreInputResult,
} from "./import-restore-input";

// 본 spec 은 R-112 4 종 (happy / error / flow·branch / negative 충분 cover) 을 3 분기
// (screening 실패 전달 · hydrate 실패 → records stage · 성공) 기준으로 검증한다. 하류 helper
// (screenImportDumpBuffer / hydrateImportDumpRecords) 의 세부 규칙은 각자의 colocated spec 이
// 이미 cover 하므로, 여기서는 **합성 계약** (호출 순서 · 단락 평가 · stage 분류 · verdict 전달 ·
// migrate 비차단 · 순수성) 에 집중한다.
describe("prepareImportRestoreInput", () => {
  // 정상 dump envelope — 5 entity 혼합 + ISO instant + 현재 schemaVersion (accept 분기).
  const sampleDump = {
    schemaVersion: EXPORT_SCHEMA_VERSION,
    generatedAt: "2026-07-27T00:00:00.000Z",
    scope: { scope: "full" },
    entityCounts: {
      Assessment: 1,
      Person: 1,
      Group: 1,
      LlmConfig: 1,
      AuditLog: 1,
    },
    recordCount: 5,
    records: [
      { entity: "Assessment", instant: "2026-01-01T00:00:00.000Z" },
      { entity: "Person", instant: "2026-02-02T01:02:03.000Z" },
      { entity: "Group", instant: "2026-03-03T04:05:06.000Z" },
      { entity: "LlmConfig", instant: "2026-04-04T07:08:09.000Z" },
      { entity: "AuditLog", instant: "2026-05-05T10:11:12.000Z" },
    ],
  };
  // 빈 dump — records 0 개 (복원할 게 없는 정상 dump).
  const emptyDump = {
    ...sampleDump,
    entityCounts: {
      Assessment: 0,
      Person: 0,
      Group: 0,
      LlmConfig: 0,
      AuditLog: 0,
    },
    recordCount: 0,
    records: [],
  };
  // 과거 version dump — version reject / migrate 분기를 나누는 입력.
  const OLD = "0.9";
  const legacyDump = { ...sampleDump, schemaVersion: OLD };

  const toBuffer = (value: unknown): Buffer =>
    Buffer.from(JSON.stringify(value), "utf-8");

  // instant 만 위반인 dump 생성 — 구조 검증 (instant 존재 여부만 확인) 은 통과하고 hydrate 에서
  // 걸리도록 만들어, screening 통과 후의 "records" stage 분기를 실 입력으로 재현한다.
  const dumpWithInstants = (...instants: unknown[]) => ({
    ...sampleDump,
    entityCounts: {
      Assessment: 0,
      Person: instants.length,
      Group: 0,
      LlmConfig: 0,
      AuditLog: 0,
    },
    recordCount: instants.length,
    records: instants.map((instant) => ({ entity: "Person", instant })),
  });

  // verdict 를 좁히는 helper — 기대와 다른 분기가 나오면 그 자리에서 실패시킨다.
  const expectFailure = (result: ImportRestoreInputResult) => {
    if (result.ok) {
      throw new Error("실패 verdict 를 기대했으나 ok: true 가 반환되었습니다");
    }
    return result;
  };
  const expectSuccess = (result: ImportRestoreInputResult) => {
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

  describe("성공 분기 (happy path)", () => {
    it("5 entity 혼합 dump 는 순서를 보존한 ExportRecord[] + accept 판정을 반환한다", () => {
      const result = expectSuccess(
        prepareImportRestoreInput(toBuffer(sampleDump)),
      );

      expect(result.records).toHaveLength(5);
      expect(result.records.map((record) => record.entity)).toEqual([
        "Assessment",
        "Person",
        "Group",
        "LlmConfig",
        "AuditLog",
      ]);
      // instant 는 ISO string 이 아니라 Date instance 로 복원된다 ($transaction 복원 입력 계약).
      result.records.forEach((record) => {
        expect(record.instant).toBeInstanceOf(Date);
      });
      expect(result.records[1].instant.toISOString()).toBe(
        "2026-02-02T01:02:03.000Z",
      );
      // version 판정은 screening 결과를 재해석 없이 그대로 실어 보낸다.
      expect(result.version.action).toBe("accept");
      expect(result.version.compatible).toBe(true);
      expect(result.version.currentVersion).toBe(EXPORT_SCHEMA_VERSION);
      expect(result).not.toHaveProperty("stage");
    });

    it("records 가 빈 dump 는 ok: true + 빈 배열을 반환한다", () => {
      const result = expectSuccess(
        prepareImportRestoreInput(toBuffer(emptyDump)),
      );

      expect(result.records).toEqual([]);
      expect(result.version.action).toBe("accept");
    });

    it("커스텀 currentVersion 을 전달하면 그 기준으로 판정돼 통과한다", () => {
      // options 미전달 경로 (현재 시스템 version default) 는 위 두 test 가 이미 cover 한다.
      const result = expectSuccess(
        prepareImportRestoreInput(toBuffer(legacyDump), {
          currentVersion: OLD,
        }),
      );

      expect(result.version.currentVersion).toBe(OLD);
      expect(result.version.action).toBe("accept");
      expect(result.records).toHaveLength(5);
    });

    it("version.action 이 migrate 여도 차단하지 않고 ok: true 로 통과시킨다", () => {
      // migrate 는 차단이 아니라 호출측 confirmation 영역 — 판단 근거만 실어 보낸다.
      const result = expectSuccess(
        prepareImportRestoreInput(toBuffer(legacyDump), {
          allowMigrationFrom: [OLD],
        }),
      );

      expect(result.version.action).toBe("migrate");
      expect(result.version.compatible).toBe(false);
      expect(result.records).toHaveLength(5);
    });
  });

  describe("screening 실패 전달 분기 (error path · negative)", () => {
    it.each([
      ["손상 JSON buffer", Buffer.from('{"schemaVersion": "1", "records": [')],
      ["빈 buffer", Buffer.alloc(0)],
      ["whitespace-only buffer", Buffer.from(" \t\r\n ", "utf-8")],
      ["null", null],
      ["undefined", undefined],
      ["비-Buffer string", "not-a-buffer"],
    ])("%s 는 stage: deserialize 로 안전 반환한다", (_label, input) => {
      // 타입 계약상 Buffer 이지만 배선 실수로 다른 값이 올 수 있다 — 런타임 방어 검증.
      let result!: ImportRestoreInputResult;
      expect(() => {
        result = prepareImportRestoreInput(input as unknown as Buffer);
      }).not.toThrow();

      const failure = expectFailure(result);
      expect(failure.stage).toBe("deserialize");
      expect(failure.issues).toHaveLength(1);
      expect(failure).not.toHaveProperty("records");
    });

    it.each([
      ["primitive number top-level", "123", "plain object"],
      ["array top-level", "[]", "plain object"],
      [
        "recordCount 불일치 dump",
        JSON.stringify({ ...sampleDump, recordCount: 9 }),
        "recordCount",
      ],
    ])("%s 는 stage: structure 로 분류된다", (_label, raw, fragment) => {
      const failure = expectFailure(
        prepareImportRestoreInput(Buffer.from(raw, "utf-8")),
      );

      expect(failure.stage).toBe("structure");
      // 하류 verdict 의 위반 메시지를 재가공 없이 그대로 전달한다.
      expect(failure.issues.join(" ")).toContain(fragment);
    });

    it.each([
      ["migration 미허용", legacyDump, undefined, OLD],
      ["migration 빈 목록", legacyDump, { allowMigrationFrom: [] }, OLD],
      ["currentVersion 명시", sampleDump, { currentVersion: "9.9.9" }, "9.9.9"],
    ])(
      "호환 불가 schemaVersion (%s) 은 stage: version 으로 분류된다",
      (_label, dump, options, expected) => {
        let result!: ImportRestoreInputResult;
        expect(() => {
          result = prepareImportRestoreInput(
            toBuffer(dump),
            options as SchemaVersionCompatOptions | undefined,
          );
        }).not.toThrow();

        const failure = expectFailure(result);
        expect(failure.stage).toBe("version");
        expect(failure.issues).toHaveLength(1);
        expect(failure.issues[0]).toContain(expected as string);
      },
    );

    it.each([
      ["deserialize", Buffer.from("{oops", "utf-8")],
      ["structure", Buffer.from("[]", "utf-8")],
      ["version", toBuffer(legacyDump)],
    ])(
      "screening 이 %s 로 실패하면 hydrate 를 호출하지 않는다 (단락 평가)",
      (stage, buffer) => {
        const spy = jest.spyOn(hydrateModule, "hydrateImportDumpRecords");

        const failure = expectFailure(prepareImportRestoreInput(buffer));

        expect(failure.stage).toBe(stage);
        expect(spy).not.toHaveBeenCalled();

        // positive control — 같은 spy 가 성공 경로에서는 실제로 호출된다 (spy 자체가 죽어서
        // not.toHaveBeenCalled 가 통과한 게 아님을 보장).
        expectSuccess(prepareImportRestoreInput(toBuffer(sampleDump)));
        expect(spy).toHaveBeenCalledTimes(1);
      },
    );
  });

  describe("hydrate 실패 분기 (stage: records · negative)", () => {
    it.each([
      ["파싱 불가 문자열", "not-a-date"],
      ["빈 문자열", ""],
      ["Invalid Date 문자열", "2026-13-45T99:99:99Z"],
      ["number", 1767225600000],
      ["null", null],
      ["object", { id: "p1" }],
      ["boolean", true],
    ])(
      "instant 가 %s 이면 stage: records + 해당 index issue 를 반환한다",
      (_label, instant) => {
        let result!: ImportRestoreInputResult;
        expect(() => {
          result = prepareImportRestoreInput(
            toBuffer(dumpWithInstants(instant)),
          );
        }).not.toThrow();

        const failure = expectFailure(result);
        expect(failure.stage).toBe("records");
        expect(failure.issues).toHaveLength(1);
        expect(failure.issues[0]).toContain("records[0].instant");
        // 실패 시 부분 결과를 돌려주지 않는다 (복원은 all-or-nothing).
        expect(failure).not.toHaveProperty("records");
      },
    );

    it("위반 원소가 2 개 이상이면 issues 를 모두 누적하고 부분 결과를 반환하지 않는다", () => {
      const failure = expectFailure(
        prepareImportRestoreInput(
          toBuffer(
            dumpWithInstants("2026-01-01T00:00:00.000Z", "nope", 42, null),
          ),
        ),
      );

      expect(failure.stage).toBe("records");
      expect(failure.issues).toHaveLength(3);
      expect(failure.issues.join(" ")).toContain("records[1].instant");
      expect(failure.issues.join(" ")).toContain("records[2].instant");
      expect(failure.issues.join(" ")).toContain("records[3].instant");
      expect(failure).not.toHaveProperty("records");
    });

    it.each([
      [
        "entity 가 5-union 밖",
        [{ entity: "Unknown", instant: "2026-01-01T00:00:00.000Z" }],
        "records[0].entity",
      ],
      ["instant 누락", [{ entity: "Person" }], "records[0].instant"],
      ["원소가 object 아님", ["nope"], "records[0]"],
      ["records 가 배열 아님", "not-an-array", "records 는 배열"],
    ])(
      "screening 을 통과한 dump 라도 hydrate 가 %s 로 거부하면 stage: records 다",
      (_label, records, fragment) => {
        // 위 위반들은 실제 chain 에서는 구조 검증이 먼저 잡지만, 상류 계약이 느슨해져도 본
        // helper 가 hydrate 실패를 "records" stage 로 분류함을 고정한다.
        jest.spyOn(screenModule, "screenImportDumpBuffer").mockReturnValue({
          ok: true,
          dump: { ...sampleDump, records } as Record<string, unknown>,
          version: {
            compatible: true,
            action: "accept",
            uploadedVersion: EXPORT_SCHEMA_VERSION,
            currentVersion: EXPORT_SCHEMA_VERSION,
          },
        });

        const failure = expectFailure(
          prepareImportRestoreInput(toBuffer(sampleDump)),
        );

        expect(failure.stage).toBe("records");
        expect(failure.issues.join(" ")).toContain(fragment);
      },
    );
  });

  describe("순수성 (non-mutating · idempotent)", () => {
    it("호출 후 입력 buffer 가 불변이고 두 번 호출해도 동일 결과다 (idempotent)", () => {
      const source = JSON.stringify(sampleDump);
      const buffer = Buffer.from(source, "utf-8");

      const first = expectSuccess(prepareImportRestoreInput(buffer));
      const second = expectSuccess(prepareImportRestoreInput(buffer));

      expect(buffer.toString("utf-8")).toBe(source);
      expect(second.records).toEqual(first.records);
      expect(second.version).toEqual(first.version);
      // 두 호출의 결과 배열은 서로 다른 객체다 (내부 상태 공유 0).
      expect(second.records).not.toBe(first.records);
    });

    it("freeze 된 options 로 호출해도 통과하며 options 는 변형되지 않는다", () => {
      const options = Object.freeze({
        currentVersion: EXPORT_SCHEMA_VERSION,
        allowMigrationFrom: Object.freeze([OLD]),
      });

      let result!: ImportRestoreInputResult;
      expect(() => {
        result = prepareImportRestoreInput(toBuffer(sampleDump), options);
      }).not.toThrow();

      expect(expectSuccess(result).version.action).toBe("accept");
      expect(options).toEqual({
        currentVersion: EXPORT_SCHEMA_VERSION,
        allowMigrationFrom: [OLD],
      });
    });
  });
});
