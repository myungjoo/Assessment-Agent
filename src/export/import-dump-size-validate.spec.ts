// import-dump-size-validate.spec — validateImportDumpSize(T-0450) 단위 test. R-112 4 종 cover:
// happy-path(옵션 부재 skip · 넉넉한 cap · totals 정확) + error path(total/per-entity/다중 누적)
// + flow/branch(옵션 조합 · 경계 actual===limit / limit+1 · cap 0) + negative cases 충분 cover
// (입력 방어 TypeError 분기마다 · 5 허용 외 entity 무시 · 미지 cap key 무시 · non-mutating).
import { ExportDump } from "./export-dump";
import { ExportEntity, ExportRecord } from "./export-scope-select";
import {
  ImportDumpSizeLimits,
  validateImportDumpSize,
} from "./import-dump-size-validate";

// 테스트용 ExportDump envelope 조립 — records 만 의미 있고 나머지 metadata 는 형식만 채운다
// (본 helper 는 records 를 ground truth 로 보므로 entityCounts 와 일부러 어긋나게 둬도 무방).
function makeDump(records: ExportRecord[]): ExportDump {
  return {
    schemaVersion: "1",
    generatedAt: "2026-06-17T00:00:00.000Z",
    scope: { scope: "full" },
    entityCounts: {
      Assessment: 0,
      Person: 0,
      Group: 0,
      LlmConfig: 0,
      AuditLog: 0,
    },
    recordCount: records.length,
    records,
  };
}

function rec(entity: ExportEntity): ExportRecord {
  return { entity, instant: new Date("2026-06-17T00:00:00.000Z") };
}

describe("validateImportDumpSize", () => {
  describe("happy path", () => {
    it("(a) 옵션 부재 → cap skip, valid=true, totals 만 산출", () => {
      const dump = makeDump([rec("Assessment"), rec("Person")]);
      const verdict = validateImportDumpSize(dump);
      expect(verdict.valid).toBe(true);
      expect(verdict.errors).toEqual([]);
      expect(verdict.totals.total).toBe(2);
      expect(verdict.totals.perEntity.Assessment).toBe(1);
      expect(verdict.totals.perEntity.Person).toBe(1);
    });

    it("(a2) options 가 빈 객체(두 필드 모두 부재) → cap skip, valid=true", () => {
      const dump = makeDump([rec("Group")]);
      const verdict = validateImportDumpSize(dump, {});
      expect(verdict.valid).toBe(true);
      expect(verdict.errors).toEqual([]);
      expect(verdict.totals.total).toBe(1);
    });

    it("(b) 작은 dump + 넉넉한 cap → valid=true, errors 빈 배열", () => {
      const dump = makeDump([rec("Assessment"), rec("AuditLog")]);
      const verdict = validateImportDumpSize(dump, {
        maxTotalRecords: 100,
        maxPerEntity: { Assessment: 50, AuditLog: 50 },
      });
      expect(verdict.valid).toBe(true);
      expect(verdict.errors).toEqual([]);
    });

    it("(c) totals 정확 — 빈 records → 전부 0", () => {
      const verdict = validateImportDumpSize(makeDump([]));
      expect(verdict.totals.total).toBe(0);
      expect(verdict.totals.perEntity).toEqual({
        Assessment: 0,
        Person: 0,
        Group: 0,
        LlmConfig: 0,
        AuditLog: 0,
      });
      expect(verdict.valid).toBe(true);
    });

    it("(c) totals 정확 — 5 entity 섞인 records", () => {
      const dump = makeDump([
        rec("Assessment"),
        rec("Assessment"),
        rec("Person"),
        rec("Group"),
        rec("LlmConfig"),
        rec("AuditLog"),
      ]);
      const verdict = validateImportDumpSize(dump);
      expect(verdict.totals.total).toBe(6);
      expect(verdict.totals.perEntity).toEqual({
        Assessment: 2,
        Person: 1,
        Group: 1,
        LlmConfig: 1,
        AuditLog: 1,
      });
    });

    it("(c) totals 정확 — 단일 entity 만 있는 records", () => {
      const dump = makeDump([rec("Person"), rec("Person"), rec("Person")]);
      const verdict = validateImportDumpSize(dump);
      expect(verdict.totals.perEntity.Person).toBe(3);
      expect(verdict.totals.perEntity.Assessment).toBe(0);
    });
  });

  describe("error path", () => {
    it("(a) maxTotalRecords 초과 → total-overflow + limit/actual 박제", () => {
      const dump = makeDump([rec("Assessment"), rec("Person"), rec("Group")]);
      const verdict = validateImportDumpSize(dump, { maxTotalRecords: 2 });
      expect(verdict.valid).toBe(false);
      expect(verdict.errors).toHaveLength(1);
      expect(verdict.errors[0]).toMatchObject({
        kind: "total-overflow",
        limit: 2,
        actual: 3,
      });
      expect(verdict.errors[0].entity).toBeUndefined();
    });

    it("(b) 단일 entity maxPerEntity 초과 → per-entity-overflow + entity/limit/actual 박제", () => {
      const dump = makeDump([
        rec("Assessment"),
        rec("Assessment"),
        rec("Assessment"),
      ]);
      const verdict = validateImportDumpSize(dump, {
        maxPerEntity: { Assessment: 2 },
      });
      expect(verdict.valid).toBe(false);
      expect(verdict.errors).toHaveLength(1);
      expect(verdict.errors[0]).toMatchObject({
        kind: "per-entity-overflow",
        entity: "Assessment",
        limit: 2,
        actual: 3,
      });
    });

    it("(c) total + 두 entity 동시 초과 → errors 3 누적(throw 0)", () => {
      const dump = makeDump([
        rec("Assessment"),
        rec("Assessment"),
        rec("Person"),
        rec("Person"),
        rec("Group"),
      ]);
      const verdict = validateImportDumpSize(dump, {
        maxTotalRecords: 4,
        maxPerEntity: { Assessment: 1, Person: 1 },
      });
      expect(verdict.valid).toBe(false);
      expect(verdict.errors).toHaveLength(3);
      const kinds = verdict.errors.map((e) => e.kind);
      expect(kinds).toContain("total-overflow");
      const perEntity = verdict.errors.filter(
        (e) => e.kind === "per-entity-overflow",
      );
      expect(perEntity.map((e) => e.entity).sort()).toEqual([
        "Assessment",
        "Person",
      ]);
    });
  });

  describe("flow / branch", () => {
    it("단독 maxTotalRecords (maxPerEntity 부재)", () => {
      const dump = makeDump([rec("Group"), rec("Group")]);
      expect(validateImportDumpSize(dump, { maxTotalRecords: 5 }).valid).toBe(
        true,
      );
      expect(validateImportDumpSize(dump, { maxTotalRecords: 1 }).valid).toBe(
        false,
      );
    });

    it("단독 maxPerEntity (maxTotalRecords 부재)", () => {
      const dump = makeDump([rec("LlmConfig"), rec("LlmConfig")]);
      expect(
        validateImportDumpSize(dump, { maxPerEntity: { LlmConfig: 5 } }).valid,
      ).toBe(true);
      expect(
        validateImportDumpSize(dump, { maxPerEntity: { LlmConfig: 1 } }).valid,
      ).toBe(false);
    });

    it("둘 다 있음 + 둘 다 통과", () => {
      const dump = makeDump([rec("Assessment")]);
      const verdict = validateImportDumpSize(dump, {
        maxTotalRecords: 10,
        maxPerEntity: { Assessment: 10 },
      });
      expect(verdict.valid).toBe(true);
    });

    it("5 entity 각각 cap 초과 분기 — 전부 per-entity-overflow", () => {
      const entities: ExportEntity[] = [
        "Assessment",
        "Person",
        "Group",
        "LlmConfig",
        "AuditLog",
      ];
      for (const entity of entities) {
        const dump = makeDump([rec(entity), rec(entity)]);
        const verdict = validateImportDumpSize(dump, {
          maxPerEntity: { [entity]: 1 } as ImportDumpSizeLimits["maxPerEntity"],
        });
        expect(verdict.valid).toBe(false);
        expect(verdict.errors[0].entity).toBe(entity);
      }
    });

    it("경계 — actual === limit → 통과 (total)", () => {
      const dump = makeDump([rec("Person"), rec("Person")]);
      expect(validateImportDumpSize(dump, { maxTotalRecords: 2 }).valid).toBe(
        true,
      );
    });

    it("경계 — actual === limit + 1 → 초과 (total)", () => {
      const dump = makeDump([rec("Person"), rec("Person"), rec("Person")]);
      expect(validateImportDumpSize(dump, { maxTotalRecords: 2 }).valid).toBe(
        false,
      );
    });

    it("경계 — actual === limit → 통과 (per-entity)", () => {
      const dump = makeDump([rec("Group"), rec("Group")]);
      expect(
        validateImportDumpSize(dump, { maxPerEntity: { Group: 2 } }).valid,
      ).toBe(true);
    });

    it("경계 — 빈 records + cap 0 → 통과", () => {
      const dump = makeDump([]);
      const verdict = validateImportDumpSize(dump, {
        maxTotalRecords: 0,
        maxPerEntity: { Assessment: 0 },
      });
      expect(verdict.valid).toBe(true);
    });

    it("경계 — cap 0 + 1 record → 초과", () => {
      const dump = makeDump([rec("Assessment")]);
      const verdict = validateImportDumpSize(dump, { maxTotalRecords: 0 });
      expect(verdict.valid).toBe(false);
      expect(verdict.errors[0]).toMatchObject({ limit: 0, actual: 1 });
    });
  });

  describe("negative cases", () => {
    it.each([
      ["null", null],
      ["undefined", undefined],
      ["array", []],
      ["number", 42],
      ["string", "dump"],
    ])("dump 가 %s → TypeError(label dump)", (_label, value) => {
      expect(() =>
        validateImportDumpSize(value as unknown as ExportDump),
      ).toThrow(/dump 는 plain object/);
    });

    it.each([
      ["string", "nope"],
      ["number", 7],
      ["object", { length: 1 }],
      ["null", null],
    ])(
      "dump.records 가 %s → TypeError(label dump.records)",
      (_label, value) => {
        const dump = {
          ...makeDump([]),
          records: value,
        } as unknown as ExportDump;
        expect(() => validateImportDumpSize(dump)).toThrow(
          /dump\.records 는 배열/,
        );
      },
    );

    it("record 원소 entity 가 5 허용 외 값 → perEntity 누락 0(자연 무시)", () => {
      const dump = makeDump([
        { entity: "Unknown" as ExportEntity, instant: new Date() },
        rec("Assessment"),
      ]);
      const verdict = validateImportDumpSize(dump);
      expect(verdict.totals.total).toBe(2);
      expect(verdict.totals.perEntity.Assessment).toBe(1);
      // 5 허용 외는 어느 perEntity key 도 증가시키지 않는다.
      const sum = Object.values(verdict.totals.perEntity).reduce(
        (a, b) => a + b,
        0,
      );
      expect(sum).toBe(1);
    });

    it("record 원소 entity 가 비-string → 자연 무시", () => {
      const dump = makeDump([
        { entity: 123 as unknown as ExportEntity, instant: new Date() },
      ]);
      const verdict = validateImportDumpSize(dump);
      expect(verdict.totals.total).toBe(1);
      const sum = Object.values(verdict.totals.perEntity).reduce(
        (a, b) => a + b,
        0,
      );
      expect(sum).toBe(0);
    });

    it.each([
      ["0 음수", -1],
      ["NaN", NaN],
      ["Infinity", Infinity],
      ["소수", 1.5],
      ["string", "10" as unknown as number],
      ["null", null as unknown as number],
    ])(
      "maxTotalRecords 가 %s → TypeError",
      (_label, value: number | unknown) => {
        const dump = makeDump([rec("Assessment")]);
        expect(() =>
          validateImportDumpSize(dump, {
            maxTotalRecords: value as number,
          }),
        ).toThrow(/maxTotalRecords/);
      },
    );

    it.each([
      ["array", []],
      ["null", null],
      ["number", 5],
      ["string", "cap"],
    ])("maxPerEntity 가 %s → TypeError", (_label, value) => {
      const dump = makeDump([rec("Assessment")]);
      expect(() =>
        validateImportDumpSize(dump, {
          maxPerEntity:
            value as unknown as ImportDumpSizeLimits["maxPerEntity"],
        }),
      ).toThrow(/maxPerEntity 는 entity/);
    });

    it.each([
      ["음수", -1],
      ["NaN", NaN],
      ["소수", 2.5],
      ["string", "3" as unknown as number],
    ])("maxPerEntity[k] 가 %s → TypeError(entity 박제)", (_label, value) => {
      const dump = makeDump([rec("Person")]);
      expect(() =>
        validateImportDumpSize(dump, {
          maxPerEntity: { Person: value as number },
        }),
      ).toThrow(/maxPerEntity\.Person/);
    });

    it("알 수 없는 entity key 가 maxPerEntity 에 들어옴 → 무시(5 entity 만 검사)", () => {
      const dump = makeDump([rec("Assessment"), rec("Assessment")]);
      const verdict = validateImportDumpSize(dump, {
        maxPerEntity: {
          Bogus: 0,
        } as unknown as ImportDumpSizeLimits["maxPerEntity"],
      });
      // Bogus cap 은 무시되고, Assessment cap 미지정이라 통과.
      expect(verdict.valid).toBe(true);
    });

    it("단일 record dump 경계", () => {
      const dump = makeDump([rec("Group")]);
      expect(validateImportDumpSize(dump, { maxTotalRecords: 1 }).valid).toBe(
        true,
      );
      expect(validateImportDumpSize(dump, { maxTotalRecords: 0 }).valid).toBe(
        false,
      );
    });

    it("5 entity 전부 cap 초과 동시 발생 → errors 5 누적", () => {
      const dump = makeDump([
        rec("Assessment"),
        rec("Person"),
        rec("Group"),
        rec("LlmConfig"),
        rec("AuditLog"),
      ]);
      const verdict = validateImportDumpSize(dump, {
        maxPerEntity: {
          Assessment: 0,
          Person: 0,
          Group: 0,
          LlmConfig: 0,
          AuditLog: 0,
        },
      });
      expect(verdict.valid).toBe(false);
      expect(verdict.errors).toHaveLength(5);
      expect(
        verdict.errors.every((e) => e.kind === "per-entity-overflow"),
      ).toBe(true);
    });
  });

  describe("non-mutating", () => {
    it("freeze 된 dump/options 로 호출해도 통과, 입력 변형 0", () => {
      const records = [rec("Assessment"), rec("Person")];
      const dump = Object.freeze(makeDump(records)) as ExportDump;
      Object.freeze(dump.records);
      const options = Object.freeze({
        maxTotalRecords: 10,
        maxPerEntity: Object.freeze({ Assessment: 10 }),
      }) as ImportDumpSizeLimits;
      const verdict = validateImportDumpSize(dump, options);
      expect(verdict.valid).toBe(true);
      // 반환 errors/totals 는 새 객체.
      expect(verdict.errors).not.toBe(options);
      expect(verdict.totals.perEntity).not.toBe(dump.entityCounts);
    });
  });
});
