import type { ExportEntity } from "../export/export-scope-select";

import {
  hydrateImportDumpRecords,
  type ImportDumpRecordsHydration,
} from "./import-dump-records-hydrate";

// ExportEntity union drift 감시 상수 — helper 는 union 값을 로컬 mirror(ALL_ENTITIES)로 들고
// 있어 union 이 확장돼도 조용히 어긋날 수 있다. 이 `Record<ExportEntity, true>` 는 union 확장
// 시 key 누락으로 **컴파일이 즉시 fail** 하고, mirror 가 따라오지 않으면 아래 test 가 fail 한다.
const ENTITY_EXHAUSTIVE: Record<ExportEntity, true> = {
  Assessment: true,
  Person: true,
  Group: true,
  LlmConfig: true,
  AuditLog: true,
};

// 본 spec 은 R-112 4 종 (happy / error / flow·branch / negative 충분 cover) 을 helper 의 3 분기
// ((1) 비-배열 records · (2) 원소 위반 누적 · (3) 성공 복원) 기준으로 검증한다. 상류 helper
// (구조 무결성 · schema version) 의 규칙은 각자의 colocated spec 이 cover 하므로 여기서는
// **records 원소의 타입 복원 계약** (Date 복원 · 순서 보존 · non-mutating · throw 0) 에 집중한다.
describe("hydrateImportDumpRecords", () => {
  const ISO = [
    "2026-07-27T00:00:00.000Z",
    "2026-07-26T12:34:56.000Z",
    "2026-01-01T00:00:00.000Z",
    "2025-12-31T23:59:59.999Z",
    "2026-03-15T08:00:00.000Z",
  ];

  // 정상 dump — 5 entity 혼합 + ISO string instant (helper 는 records 만 본다).
  const sampleDump = (): Record<string, unknown> => ({
    schemaVersion: "1",
    records: [
      { entity: "Assessment", instant: ISO[0] },
      { entity: "Person", instant: ISO[1] },
      { entity: "Group", instant: ISO[2] },
      { entity: "LlmConfig", instant: ISO[3] },
      { entity: "AuditLog", instant: ISO[4] },
    ],
  });

  // verdict 를 좁히는 helper — ok 를 assert 한 뒤 payload 를 꺼내 쓴다.
  const expectSuccess = (
    result: ImportDumpRecordsHydration,
  ): { entity: string; instant: Date }[] => {
    expect(result.ok).toBe(true);
    return result.ok ? result.records : [];
  };

  const expectFailure = (result: ImportDumpRecordsHydration): string[] => {
    expect(result.ok).toBe(false);
    return result.ok ? [] : result.issues;
  };

  describe("성공 분기 (happy path)", () => {
    it("5 entity 혼합 dump 를 ExportRecord[] 로 복원하고 순서·instant 값을 보존한다", () => {
      const records = expectSuccess(hydrateImportDumpRecords(sampleDump()));

      expect(records.map((record) => record.entity)).toEqual([
        "Assessment",
        "Person",
        "Group",
        "LlmConfig",
        "AuditLog",
      ]);
      records.forEach((record, index) => {
        expect(record.instant).toBeInstanceOf(Date);
        expect(record.instant.getTime()).toBe(new Date(ISO[index]).getTime());
      });
    });

    it("빈 records 배열은 ok: true 와 빈 배열을 돌려준다", () => {
      expect(hydrateImportDumpRecords({ records: [] })).toEqual({
        ok: true,
        records: [],
      });
    });

    it("instant 가 이미 Date instance 여도 복원하며 원본과 다른 새 Date 를 만든다", () => {
      const original = new Date(ISO[2]);
      const records = expectSuccess(
        hydrateImportDumpRecords({
          records: [{ entity: "Person", instant: original }],
        }),
      );

      expect(records[0].instant.getTime()).toBe(original.getTime());
      expect(records[0].instant).not.toBe(original);
    });

    it("ExportEntity union 의 5 값이 모두 수용된다 (union drift 감시)", () => {
      const entities = Object.keys(ENTITY_EXHAUSTIVE);
      const records = expectSuccess(
        hydrateImportDumpRecords({
          records: entities.map((entity) => ({ entity, instant: ISO[0] })),
        }),
      );

      expect(records.map((record) => record.entity)).toEqual(entities);
    });

    it("raw 원소의 여분 field 는 버리고 { entity, instant } 만 담는다", () => {
      const records = expectSuccess(
        hydrateImportDumpRecords({
          records: [
            { entity: "Person", instant: ISO[0], id: 7, payload: { a: 1 } },
          ],
        }),
      );

      expect(Object.keys(records[0]).sort()).toEqual(["entity", "instant"]);
    });

    it("비-ISO 이지만 Date 로 파싱 가능한 string 도 수용한다 (RFC 2822)", () => {
      const rfc2822 = "Mon, 27 Jul 2026 00:00:00 GMT";
      const records = expectSuccess(
        hydrateImportDumpRecords({
          records: [{ entity: "Group", instant: rfc2822 }],
        }),
      );

      expect(records[0].instant.getTime()).toBe(new Date(rfc2822).getTime());
    });
  });

  describe("비-배열 records 분기 (error path)", () => {
    // dump 자체가 plain object 가 아닌 입력 (null / 배열 / 비-object) 도 같은 분기로 흡수된다 —
    // records 를 미상(undefined)으로 취급하며 throw 하지 않는다.
    it.each([
      ["records 누락(undefined)", {}, "undefined"],
      ["records 가 object", { records: { entity: "Person" } }, "object"],
      ["records 가 string", { records: "Person" }, "string"],
      ["records 가 null", { records: null }, "null"],
      ["records 가 number", { records: 3 }, "number"],
      ["dump 가 null", null, "undefined"],
      ["dump 가 배열", [1, 2], "undefined"],
      ["dump 가 string", "dump", "undefined"],
      ["dump 가 undefined", undefined, "undefined"],
    ])("%s 이면 issue 1 건으로 거부한다", (_label, dump, kind) => {
      const call = (): ImportDumpRecordsHydration =>
        hydrateImportDumpRecords(dump as unknown as Record<string, unknown>);

      expect(call).not.toThrow();
      expect(expectFailure(call())).toEqual([
        `records 는 배열이어야 합니다 (받음: ${kind})`,
      ]);
    });
  });

  describe("원소 위반 누적 분기 (negative cases)", () => {
    it.each([
      ["null", null],
      ["배열", []],
      ["number", 7],
    ])("원소가 %s 이면 그 index 를 담은 issue 를 낸다", (_label, record) => {
      expect(
        expectFailure(hydrateImportDumpRecords({ records: [record] })),
      ).toEqual([
        "records[0] 는 { entity, instant } 형태의 object 여야 합니다",
      ]);
    });

    it.each([
      ["5-union 밖 문자열", "Unknown"],
      ["빈 문자열", ""],
      ["비-string(number)", 3],
      ["null", null],
      ["누락(undefined)", undefined],
    ])("entity 가 %s 이면 거부한다", (_label, entity) => {
      const issues = expectFailure(
        hydrateImportDumpRecords({ records: [{ entity, instant: ISO[0] }] }),
      );

      expect(issues).toHaveLength(1);
      expect(issues[0]).toContain("records[0].entity");
      expect(issues[0]).toContain("5 허용 entity");
    });

    it.each([
      ["빈 문자열", ""],
      ["파싱 불가 문자열", "어제"],
      ["Invalid Date instance", new Date("nope")],
      ["number(epoch millis)", 1_700_000_000_000],
      ["null", null],
      ["누락(undefined)", undefined],
    ])("instant 가 %s 이면 거부한다", (_label, instant) => {
      const issues = expectFailure(
        hydrateImportDumpRecords({ records: [{ entity: "Person", instant }] }),
      );

      expect(issues).toHaveLength(1);
      expect(issues[0]).toContain("records[0].instant");
    });

    it("한 원소가 entity·instant 를 모두 위반하면 issue 2 건이 누적된다", () => {
      const issues = expectFailure(
        hydrateImportDumpRecords({
          records: [{ entity: "Nope", instant: "" }],
        }),
      );

      expect(issues).toHaveLength(2);
      expect(issues[0]).toContain("records[0].entity");
      expect(issues[1]).toContain("records[0].instant");
    });

    it("위반 원소가 2 개 이상이면 서로 다른 index 의 issue 가 모두 누적된다", () => {
      const issues = expectFailure(
        hydrateImportDumpRecords({
          records: [
            { entity: "Nope", instant: ISO[0] },
            { entity: "Person", instant: "어제" },
            null,
          ],
        }),
      );

      expect(issues).toHaveLength(3);
      expect(issues[0]).toContain("records[0]");
      expect(issues[1]).toContain("records[1]");
      expect(issues[2]).toContain("records[2]");
    });

    it("유효 원소와 위반 원소가 섞이면 부분 결과 없이 ok: false 만 돌려준다", () => {
      const result = hydrateImportDumpRecords({
        records: [
          { entity: "Person", instant: ISO[0] },
          { entity: "Person", instant: "어제" },
        ],
      });

      expect(result).not.toHaveProperty("records");
      expect(expectFailure(result)).toHaveLength(1);
    });
  });

  describe("순수성 계약", () => {
    it("freeze 된 dump/records/원소로 호출해도 통과하고 원본을 변형하지 않는다", () => {
      const record = Object.freeze({ entity: "Person", instant: ISO[1] });
      const dump = Object.freeze({ records: Object.freeze([record]) });

      const records = expectSuccess(
        hydrateImportDumpRecords(dump as unknown as Record<string, unknown>),
      );

      expect(records[0].instant.getTime()).toBe(new Date(ISO[1]).getTime());
      // 원본 원소의 instant 는 여전히 ISO string 그대로여야 한다 (in-place 변환 0).
      expect(record.instant).toBe(ISO[1]);
      expect(records[0]).not.toBe(record);
    });

    it("어떤 입력에서도 throw 하지 않는다", () => {
      const inputs: unknown[] = [
        {},
        { records: "x" },
        { records: [null, 1, "a", [], { entity: "Nope" }] },
        { records: [{ entity: "AuditLog", instant: ISO[0] }] },
        Object.freeze({ records: Object.freeze([]) }),
      ];

      inputs.forEach((input) => {
        expect(() =>
          hydrateImportDumpRecords(input as Record<string, unknown>),
        ).not.toThrow();
      });
    });
  });
});
