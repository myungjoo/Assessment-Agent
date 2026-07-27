import { EXPORT_ENTITY_FULL_RECORD_SELECT } from "../export/export-entity-full-record-select";
import type { FullExportRecord } from "../export/export-full-record";
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

// allow-list 사본 0 감시 — helper 가 entity 별 허용 key 를 손복사하지 않고 export 측
// single-source(`EXPORT_ENTITY_FULL_RECORD_SELECT`)를 재사용함을 test 도 같은 source 로 검증한다.
const allowedKeys = (entity: ExportEntity): string[] =>
  Object.keys(EXPORT_ENTITY_FULL_RECORD_SELECT[entity]);

// 해당 entity 의 allow-list 안 key 만으로 채운 fields 샘플 — 값은 helper 가 들여다보지 않으므로
// key 이름 기반의 임의 값이면 충분하다(값 identity 보존 단언에 쓰인다).
const allowedFields = (entity: ExportEntity): Record<string, unknown> => {
  const fields: Record<string, unknown> = {};
  allowedKeys(entity).forEach((key, index) => {
    fields[key] = `${entity}:${key}:${index}`;
  });
  return fields;
};

// 본 spec 은 R-112 4 종 (happy / error / flow·branch / negative 충분 cover) 을 helper 의 3 분기
// ((1) 비-배열 records · (2) 원소 위반 누적 · (3) 성공 복원) 기준으로 검증한다. 상류 helper
// (구조 무결성 · schema version) 의 규칙은 각자의 colocated spec 이 cover 하므로 여기서는
// **records 원소의 타입 복원 계약** (Date 복원 · fields 보존 · allow-list 엄격 거부 · 순서 보존 ·
// non-mutating · throw 0) 에 집중한다.
describe("hydrateImportDumpRecords", () => {
  const ISO = [
    "2026-07-27T00:00:00.000Z",
    "2026-07-26T12:34:56.000Z",
    "2026-01-01T00:00:00.000Z",
    "2025-12-31T23:59:59.999Z",
    "2026-03-15T08:00:00.000Z",
  ];

  // 정상 dump — 5 entity 혼합 + ISO string instant + allow-list 안 fields (helper 는 records 만 본다).
  const sampleDump = (): Record<string, unknown> => ({
    schemaVersion: "1",
    records: [
      {
        entity: "Assessment",
        instant: ISO[0],
        fields: allowedFields("Assessment"),
      },
      { entity: "Person", instant: ISO[1], fields: allowedFields("Person") },
      { entity: "Group", instant: ISO[2], fields: allowedFields("Group") },
      {
        entity: "LlmConfig",
        instant: ISO[3],
        fields: allowedFields("LlmConfig"),
      },
      {
        entity: "AuditLog",
        instant: ISO[4],
        fields: allowedFields("AuditLog"),
      },
    ],
  });

  // verdict 를 좁히는 helper — ok 를 assert 한 뒤 payload 를 꺼내 쓴다.
  const expectSuccess = (
    result: ImportDumpRecordsHydration,
  ): FullExportRecord[] => {
    expect(result.ok).toBe(true);
    return result.ok ? result.records : [];
  };

  const expectFailure = (result: ImportDumpRecordsHydration): string[] => {
    expect(result.ok).toBe(false);
    return result.ok ? [] : result.issues;
  };

  describe("성공 분기 (happy path)", () => {
    it("5 entity 혼합 dump 를 FullExportRecord[] 로 복원하고 순서·instant 값을 보존한다", () => {
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

    it.each(Object.keys(ENTITY_EXHAUSTIVE) as ExportEntity[])(
      "%s 의 allow-list fields 를 key 집합·값 identity 손실 없이 승계한다",
      (entity) => {
        const fields = allowedFields(entity);
        const records = expectSuccess(
          hydrateImportDumpRecords({
            records: [{ entity, instant: ISO[0], fields }],
          }),
        );

        expect(Object.keys(records[0].fields).sort()).toEqual(
          allowedKeys(entity).sort(),
        );
        // 값은 변환 0 — 원본 값 identity 를 그대로 옮긴다 (불투명 이동, REQ-032).
        allowedKeys(entity).forEach((key) => {
          expect(records[0].fields[key]).toBe(fields[key]);
        });
      },
    );

    it("fields 가 빈 객체인 원소도 정상 통과한다 (필수 컬럼 판정은 본 layer 책임 아님)", () => {
      const records = expectSuccess(
        hydrateImportDumpRecords({
          records: [{ entity: "Group", instant: ISO[0], fields: {} }],
        }),
      );

      expect(records).toHaveLength(1);
      expect(records[0].fields).toEqual({});
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
          records: [
            {
              entity: "Person",
              instant: original,
              fields: allowedFields("Person"),
            },
          ],
        }),
      );

      expect(records[0].instant.getTime()).toBe(original.getTime());
      expect(records[0].instant).not.toBe(original);
    });

    it("ExportEntity union 의 5 값이 모두 수용된다 (union drift 감시)", () => {
      const entities = Object.keys(ENTITY_EXHAUSTIVE) as ExportEntity[];
      const records = expectSuccess(
        hydrateImportDumpRecords({
          records: entities.map((entity) => ({
            entity,
            instant: ISO[0],
            fields: allowedFields(entity),
          })),
        }),
      );

      expect(records.map((record) => record.entity)).toEqual(entities);
    });

    it("raw 원소의 여분 top-level field 는 버리고 { entity, instant, fields } 만 담는다", () => {
      // T-1265 계약 변경 박제 — 이전에는 fields 도 drop 됐지만 이제 3 key 를 승계한다.
      const records = expectSuccess(
        hydrateImportDumpRecords({
          records: [
            {
              entity: "Person",
              instant: ISO[0],
              fields: allowedFields("Person"),
              id: 7,
              payload: { a: 1 },
            },
          ],
        }),
      );

      expect(Object.keys(records[0]).sort()).toEqual([
        "entity",
        "fields",
        "instant",
      ]);
    });

    it("여러 원소 혼합 입력에서 fields 가 원소별로 어긋나지 않고 입력 순서를 보존한다", () => {
      const records = expectSuccess(
        hydrateImportDumpRecords({
          records: [
            { entity: "Group", instant: ISO[0], fields: { name: "g1" } },
            { entity: "Person", instant: ISO[1], fields: { email: "p@x" } },
            { entity: "Group", instant: ISO[2], fields: { name: "g2" } },
          ],
        }),
      );

      expect(records.map((record) => record.fields)).toEqual([
        { name: "g1" },
        { email: "p@x" },
        { name: "g2" },
      ]);
      expect(records.map((record) => record.instant.toISOString())).toEqual([
        ISO[0],
        ISO[1],
        ISO[2],
      ]);
    });

    it("비-ISO 이지만 Date 로 파싱 가능한 string 도 수용한다 (RFC 2822)", () => {
      const rfc2822 = "Mon, 27 Jul 2026 00:00:00 GMT";
      const records = expectSuccess(
        hydrateImportDumpRecords({
          records: [
            { entity: "Group", instant: rfc2822, fields: { name: "g" } },
          ],
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
        hydrateImportDumpRecords({
          records: [{ entity, instant: ISO[0], fields: {} }],
        }),
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
        hydrateImportDumpRecords({
          records: [{ entity: "Person", instant, fields: {} }],
        }),
      );

      expect(issues).toHaveLength(1);
      expect(issues[0]).toContain("records[0].instant");
    });

    it("한 원소가 entity·instant 를 모두 위반하면 issue 2 건이 누적된다", () => {
      const issues = expectFailure(
        hydrateImportDumpRecords({
          records: [{ entity: "Nope", instant: "", fields: {} }],
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
            { entity: "Nope", instant: ISO[0], fields: {} },
            { entity: "Person", instant: "어제", fields: {} },
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
          { entity: "Person", instant: ISO[0], fields: {} },
          { entity: "Person", instant: "어제", fields: {} },
        ],
      });

      expect(result).not.toHaveProperty("records");
      expect(expectFailure(result)).toHaveLength(1);
    });
  });

  describe("fields 필수 계약 (error path · 분기 cover)", () => {
    it.each([
      ["누락(undefined)", undefined, "undefined"],
      ["null", null, "null"],
      ["배열", [], "array"],
      ["문자열", "nope", "string"],
      ["숫자", 42, "number"],
      ["boolean", true, "boolean"],
    ])(
      "fields 가 %s 이면 그 index 를 담은 issue 를 낸다",
      (_label, fields, kind) => {
        const issues = expectFailure(
          hydrateImportDumpRecords({
            records: [{ entity: "Person", instant: ISO[0], fields }],
          }),
        );

        expect(issues).toHaveLength(1);
        expect(issues[0]).toContain("records[0].fields");
        expect(issues[0]).toContain(`받음: ${kind}`);
      },
    );

    it("instant 와 fields 가 동시에 무효면 issue 2 건이 누적된다", () => {
      const issues = expectFailure(
        hydrateImportDumpRecords({
          records: [{ entity: "Person", instant: "어제", fields: null }],
        }),
      );

      expect(issues).toHaveLength(2);
      expect(issues[0]).toContain("records[0].instant");
      expect(issues[1]).toContain("records[0].fields");
    });

    it("두 원소가 각각 다른 사유(fields 부재 / allow-list 위반)로 위반하면 둘 다 누적된다", () => {
      const issues = expectFailure(
        hydrateImportDumpRecords({
          records: [
            { entity: "Person", instant: ISO[0] },
            { entity: "Group", instant: ISO[1], fields: { nope: 1 } },
          ],
        }),
      );

      expect(issues).toHaveLength(2);
      expect(issues[0]).toContain("records[0].fields");
      expect(issues[1]).toContain("records[1].fields");
      expect(issues[1]).toContain("allow-list");
    });

    it("fields 위반이 있으면 다른 원소가 모두 유효해도 부분 결과를 돌려주지 않는다", () => {
      const result = hydrateImportDumpRecords({
        records: [
          { entity: "Person", instant: ISO[0], fields: {} },
          { entity: "Person", instant: ISO[1], fields: 3 },
        ],
      });

      expect(result).not.toHaveProperty("records");
      expect(expectFailure(result)).toHaveLength(1);
    });
  });

  describe("allow-list 엄격 거부 (ADR-0047 §Decision 2(b) import mirror)", () => {
    it("LlmConfig 의 apiKey 는 allow-list 밖이라 거부된다 (secret 혼입 차단)", () => {
      const issues = expectFailure(
        hydrateImportDumpRecords({
          records: [
            {
              entity: "LlmConfig",
              instant: ISO[0],
              fields: { id: "c1", apiKey: "sk-live-DO-NOT-LEAK-0001" },
            },
          ],
        }),
      );

      expect(issues).toHaveLength(1);
      expect(issues[0]).toContain("records[0].fields");
      expect(issues[0]).toContain("apiKey");
    });

    it("issue 메시지에 fields 의 값이 실리지 않는다 (key 이름과 index 만)", () => {
      const secret = "sk-live-DO-NOT-LEAK-0002";
      const issues = expectFailure(
        hydrateImportDumpRecords({
          records: [
            {
              entity: "LlmConfig",
              instant: ISO[0],
              fields: { apiKey: secret, token: secret },
            },
          ],
        }),
      );

      expect(issues.join(" ")).not.toMatch(/sk-live-DO-NOT-LEAK-0002/);
      expect(issues.join(" ")).not.toMatch(/DO-NOT-LEAK/);
      expect(issues[0]).toContain("apiKey");
    });

    it("allow-list 밖 key 가 여러 개면 issue 가 그 사실을 index 와 함께 알린다", () => {
      const issues = expectFailure(
        hydrateImportDumpRecords({
          records: [
            {
              entity: "Group",
              instant: ISO[0],
              fields: { name: "g", secretA: 1, secretB: 2 },
            },
          ],
        }),
      );

      expect(issues).toHaveLength(1);
      expect(issues[0]).toContain("records[0].fields");
      expect(issues[0]).toContain("secretA");
      expect(issues[0]).toContain("secretB");
      // 허용 key(name)는 위반 목록에 들어가지 않는다.
      expect(issues[0]).not.toContain("name");
    });

    it.each([["__proto__"], ["constructor"], ["hasOwnProperty"], ["toString"]])(
      "own enumerable key %s 는 상속 속성 오탐 없이 allow-list 위반으로 잡힌다",
      (key) => {
        // 계산된 key 로 넣어야 __proto__ 가 prototype 설정이 아닌 own property 가 된다.
        const fields: Record<string, unknown> = { [key]: "x" };

        const issues = expectFailure(
          hydrateImportDumpRecords({
            records: [{ entity: "Group", instant: ISO[0], fields }],
          }),
        );

        expect(issues).toHaveLength(1);
        expect(issues[0]).toContain(key);
      },
    );

    it("허용 key 만 있으면 상속 속성 이름과 무관하게 통과한다 (오탐 0)", () => {
      // Object.prototype 을 상속한 평범한 객체 — constructor/toString 은 own key 가 아니다.
      const records = expectSuccess(
        hydrateImportDumpRecords({
          records: [
            { entity: "Group", instant: ISO[0], fields: { name: "g" } },
          ],
        }),
      );

      expect(records[0].fields).toEqual({ name: "g" });
    });

    it("entity 가 무효인 원소는 entity issue 1 건만 내고 allow-list issue 를 중복 생성하지 않는다", () => {
      const issues = expectFailure(
        hydrateImportDumpRecords({
          records: [
            {
              entity: "Nope",
              instant: ISO[0],
              fields: { apiKey: "x", 아무거나: 1 },
            },
          ],
        }),
      );

      expect(issues).toHaveLength(1);
      expect(issues[0]).toContain("records[0].entity");
      expect(issues.join(" ")).not.toContain("allow-list");
    });

    it("5 entity 각각의 allow-list 전체 key 가 통과한다 (상수 손복사 0 drift 감시)", () => {
      const entities = Object.keys(ENTITY_EXHAUSTIVE) as ExportEntity[];

      entities.forEach((entity) => {
        const keys = allowedKeys(entity);
        const records = expectSuccess(
          hydrateImportDumpRecords({
            records: [
              { entity, instant: ISO[0], fields: allowedFields(entity) },
            ],
          }),
        );

        expect(Object.keys(records[0].fields).sort()).toEqual([...keys].sort());
        // 같은 entity 라도 다른 entity 의 전용 key 를 넣으면 거부된다 (표별 경계 확인).
        const foreign = entities
          .filter((other) => other !== entity)
          .flatMap((other) => allowedKeys(other))
          .find((key) => !keys.includes(key));
        if (foreign !== undefined) {
          const issues = expectFailure(
            hydrateImportDumpRecords({
              records: [{ entity, instant: ISO[0], fields: { [foreign]: 1 } }],
            }),
          );
          expect(issues[0]).toContain(foreign);
        }
      });
    });
  });

  describe("순수성 계약", () => {
    it("freeze 된 dump/records/원소/fields 로 호출해도 통과하고 원본을 변형하지 않는다", () => {
      const fields = Object.freeze({ name: "g" });
      const record = Object.freeze({
        entity: "Person",
        instant: ISO[1],
        fields: Object.freeze(allowedFields("Person")),
      });
      const dump = Object.freeze({ records: Object.freeze([record]) });
      const frozenGroup = Object.freeze({
        records: Object.freeze([
          Object.freeze({ entity: "Group", instant: ISO[1], fields }),
        ]),
      });

      const call = (): ImportDumpRecordsHydration =>
        hydrateImportDumpRecords(dump as unknown as Record<string, unknown>);
      expect(call).not.toThrow();
      const records = expectSuccess(call());

      expect(records[0].instant.getTime()).toBe(new Date(ISO[1]).getTime());
      // 원본 원소의 instant 는 여전히 ISO string 그대로여야 한다 (in-place 변환 0).
      expect(record.instant).toBe(ISO[1]);
      expect(records[0]).not.toBe(record);
      expect(records[0].fields).not.toBe(record.fields);
      // freeze 된 입력 두 번 호출 결과가 동일하다.
      expect(expectSuccess(call())).toEqual(records);
      expect(
        expectSuccess(
          hydrateImportDumpRecords(
            frozenGroup as unknown as Record<string, unknown>,
          ),
        )[0].fields,
      ).toEqual({ name: "g" });
    });

    it("반환 record 의 fields 를 변형해도 입력 dump 의 fields 는 불변이다", () => {
      const fields: Record<string, unknown> = { name: "g", id: "g1" };
      const dump = {
        records: [{ entity: "Group", instant: ISO[0], fields }],
      };

      const records = expectSuccess(hydrateImportDumpRecords(dump));
      records[0].fields.name = "바뀜";
      records[0].fields.추가 = true;
      delete records[0].fields.id;

      expect(fields).toEqual({ name: "g", id: "g1" });
    });

    it("어떤 입력에서도 throw 하지 않는다", () => {
      const inputs: unknown[] = [
        {},
        { records: "x" },
        { records: [null, 1, "a", [], { entity: "Nope" }] },
        { records: [{ entity: "AuditLog", instant: ISO[0] }] },
        { records: [{ entity: "AuditLog", instant: ISO[0], fields: null }] },
        {
          records: [
            { entity: "AuditLog", instant: ISO[0], fields: { nope: 1 } },
          ],
        },
        {
          records: [
            { entity: "AuditLog", instant: ISO[0], fields: { id: "a1" } },
          ],
        },
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
