import { ImportMode } from "@prisma/client";

import { EXPORT_SCHEMA_VERSION } from "../export/export-dump";
import type { ExportRecord } from "../export/export-scope-select";
import * as planModule from "../export/import-restore-plan";

import * as inputModule from "./import-restore-input";
import {
  prepareImportRestorePlan,
  type ImportRestorePlanPrepareResult,
} from "./import-restore-plan-prepare";

// 본 spec 은 R-112 4 종 (happy / error / flow·branch / negative 충분 cover) 을 5 분기 (mode 실패 ·
// 복원 입력 실패 · plan throw 흡수 · 성공 REPLACE · 성공 MERGE) 기준으로 검증한다. 하류 helper
// (prepareImportRestoreInput / buildImportRestorePlan) 의 세부 규칙은 각자의 colocated spec 이
// 이미 cover 하므로, 여기서는 **합성 계약** (mode 매핑 · 단락 평가 · stage 분류 · throw→verdict
// 흡수 · migrate 비차단 · 순수성) 에 집중한다.
describe("prepareImportRestorePlan", () => {
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
    // T-1265 이후 hydrate 는 `fields` 를 필수로 요구한다 (allow-list 안 key 만 허용).
    records: [
      {
        entity: "Assessment",
        instant: "2026-01-01T00:00:00.000Z",
        fields: { id: "a1" },
      },
      {
        entity: "Person",
        instant: "2026-02-02T01:02:03.000Z",
        fields: { id: "p1", fullName: "홍길동" },
      },
      {
        entity: "Group",
        instant: "2026-03-03T04:05:06.000Z",
        fields: { id: "g1", name: "1팀" },
      },
      {
        entity: "LlmConfig",
        instant: "2026-04-04T07:08:09.000Z",
        fields: { id: "c1", provider: "openai" },
      },
      {
        entity: "AuditLog",
        instant: "2026-05-05T10:11:12.000Z",
        fields: { id: "l1", principal: "system" },
      },
    ],
  };
  // 빈 dump — 복원할 record 가 0 개인 정상 dump.
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
  // instant 만 위반인 dump — 구조 검증은 통과하고 records hydrate 에서 걸린다.
  const badInstantDump = {
    ...sampleDump,
    entityCounts: { ...emptyDump.entityCounts, Person: 1 },
    recordCount: 1,
    records: [
      { entity: "Person", instant: "not-a-date", fields: { id: "p1" } },
    ],
  };
  // 구조 검증 (recordCount ↔ records.length 일치) 만 위반인 dump.
  const countMismatchDump = { ...sampleDump, recordCount: 9 };
  // plan 산출 helper 의 throw 를 유발하는 잘못된 기존 record 원소.
  const invalidDate = new Date("nope");

  const toBuffer = (value: unknown): Buffer =>
    Buffer.from(JSON.stringify(value), "utf-8");

  // 기존 record — 첫 원소는 dump 의 Person record 와 같은 key (충돌), 둘째는 비충돌.
  const conflicting: ExportRecord = {
    entity: "Person",
    instant: new Date("2026-02-02T01:02:03.000Z"),
  };
  const untouched: ExportRecord = {
    entity: "Assessment",
    instant: new Date("2020-01-01T00:00:00.000Z"),
  };
  const existingPair = (): ExportRecord[] => [
    { ...conflicting },
    { ...untouched },
  ];

  // verdict 를 좁히는 helper — 기대와 다른 분기가 나오면 그 자리에서 실패시킨다.
  const expectFailure = (result: ImportRestorePlanPrepareResult) => {
    if (result.ok) {
      throw new Error("실패 verdict 를 기대했으나 ok: true 가 반환되었습니다");
    }
    return result;
  };
  const expectSuccess = (result: ImportRestorePlanPrepareResult) => {
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
    it("REPLACE 는 기존 전부 toDelete + dump 전부 toInsert + 빈 toKeep 을 산출한다", () => {
      const existing = existingPair();
      const result = expectSuccess(
        prepareImportRestorePlan(
          toBuffer(sampleDump),
          existing,
          ImportMode.REPLACE,
        ),
      );

      expect(result.plan.toDelete).toEqual(existing);
      expect(result.plan.toInsert).toHaveLength(5);
      expect(result.plan.toKeep).toEqual([]);
      // records 는 ISO string 이 아니라 Date instance 로 복원돼 plan 에 실린다.
      result.records.forEach((record) => {
        expect(record.instant).toBeInstanceOf(Date);
      });
      expect(result.plan.toInsert).toEqual(result.records);
      expect(result.version.action).toBe("accept");
      expect(result.version.currentVersion).toBe(EXPORT_SCHEMA_VERSION);
      expect(result).not.toHaveProperty("stage");
    });

    it("MERGE 는 충돌 기존만 toDelete, 비충돌 기존은 toKeep 으로 분류한다", () => {
      const result = expectSuccess(
        prepareImportRestorePlan(
          toBuffer(sampleDump),
          existingPair(),
          ImportMode.MERGE,
        ),
      );

      expect(result.plan.toDelete).toEqual([conflicting]);
      expect(result.plan.toKeep).toEqual([untouched]);
      expect(result.plan.toInsert).toHaveLength(5);
    });

    it.each([
      ["existing 이 빈 배열", [] as ExportRecord[], sampleDump, 0, 5],
      ["dump records 가 빈 배열", existingPair(), emptyDump, 2, 0],
      ["둘 다 빈 배열", [] as ExportRecord[], emptyDump, 0, 0],
    ])(
      "%s 여도 ok: true 로 plan 을 산출한다",
      (_label, existing, dump, deleteCount, insertCount) => {
        const result = expectSuccess(
          prepareImportRestorePlan(
            toBuffer(dump),
            existing as ExportRecord[],
            ImportMode.REPLACE,
          ),
        );

        expect(result.plan.toDelete).toHaveLength(deleteCount as number);
        expect(result.plan.toInsert).toHaveLength(insertCount as number);
        expect(result.records).toHaveLength(insertCount as number);
      },
    );

    it("커스텀 currentVersion 을 전달하면 그 기준으로 판정돼 통과한다", () => {
      // options 미전달 (undefined) 경로는 위 test 들이 이미 cover 한다.
      const result = expectSuccess(
        prepareImportRestorePlan(toBuffer(legacyDump), [], ImportMode.MERGE, {
          currentVersion: OLD,
        }),
      );

      expect(result.version.currentVersion).toBe(OLD);
      expect(result.plan.toInsert).toHaveLength(5);
    });

    it("version.action 이 migrate 여도 차단하지 않고 plan 까지 산출한다", () => {
      // migrate 는 차단이 아니라 호출측 confirmation 영역 — 판단 근거만 실어 보낸다.
      const result = expectSuccess(
        prepareImportRestorePlan(toBuffer(legacyDump), [], ImportMode.REPLACE, {
          allowMigrationFrom: [OLD],
        }),
      );

      expect(result.version.action).toBe("migrate");
      expect(result.version.compatible).toBe(false);
      expect(result.plan.toInsert).toHaveLength(5);
    });
  });

  describe("Prisma ImportMode enum drift 감지", () => {
    // MODE_MAP 은 REPLACE / MERGE 두 멤버만 매핑한다. Prisma schema 에 멤버가 추가되면 그
    // 멤버는 매핑이 없어 stage "mode" 로 거부되는데, 아래 it.each 가 enum 전 멤버를 순회하므로
    // 매핑 누락이 곧바로 fail 로 드러난다 (drift 를 조용히 통과시키지 않는다).
    it.each(Object.values(ImportMode))(
      "enum 멤버 %s 는 MODE_MAP 에 매핑돼 정상 dump + 빈 existing 에서 ok: true 를 낸다",
      (mode) => {
        let result!: ImportRestorePlanPrepareResult;
        expect(() => {
          result = prepareImportRestorePlan(toBuffer(sampleDump), [], mode);
        }).not.toThrow();

        const success = expectSuccess(result);
        expect(success.records).toHaveLength(5);
        expect(success.plan.toInsert).toHaveLength(5);
        expect(success.plan.toDelete).toEqual([]);
      },
    );
  });

  describe("mode 실패 분기 (stage: mode · negative)", () => {
    it.each([
      ["소문자 replace", "replace"],
      ["소문자 merge", "merge"],
      ["미지원 PATCH", "PATCH"],
      ["null", null],
      ["undefined", undefined],
      ["number", 1],
      ["객체", { mode: "REPLACE" }],
      ["빈 문자열", ""],
      ["boolean", true],
      ["bigint", BigInt(2)],
    ])("%s 는 stage: mode 로 즉시 거부한다", (_label, mode) => {
      let result!: ImportRestorePlanPrepareResult;
      expect(() => {
        result = prepareImportRestorePlan(
          toBuffer(sampleDump),
          existingPair(),
          mode as unknown as ImportMode,
        );
      }).not.toThrow();

      const failure = expectFailure(result);
      expect(failure.stage).toBe("mode");
      expect(failure.issues).toHaveLength(1);
      expect(failure.issues[0]).toContain("REPLACE 또는 MERGE");
      // 실패 verdict 는 부분 결과를 절대 포함하지 않는다.
      expect(failure).not.toHaveProperty("plan");
      expect(failure).not.toHaveProperty("records");
    });

    // 문자열화 자체가 throw 하는 mode — 거부 message 를 만들다가 helper 가 throw 하면 verdict
    // 계약 (throw 0) 이 깨진다. 아래 두 test 가 그 hazard 를 직접 겨냥한다.
    it("prototype 이 없는 mode (Object.create(null)) 여도 throw 없이 stage: mode 로 거부한다", () => {
      const bareMode = Object.create(null) as ImportMode;

      let result!: ImportRestorePlanPrepareResult;
      expect(() => {
        result = prepareImportRestorePlan(
          toBuffer(sampleDump),
          existingPair(),
          bareMode,
        );
      }).not.toThrow();

      const failure = expectFailure(result);
      expect(failure.stage).toBe("mode");
      expect(failure.issues).toHaveLength(1);
      expect(failure.issues[0]).toContain("REPLACE 또는 MERGE");
      expect(failure.issues[0]).toContain("object");
    });

    it("toString 이 throw 하는 mode 객체여도 throw 없이 stage: mode 로 거부한다", () => {
      const explosiveMode = {
        toString() {
          throw new Error("toString 폭발");
        },
      } as unknown as ImportMode;

      let result!: ImportRestorePlanPrepareResult;
      expect(() => {
        result = prepareImportRestorePlan(
          toBuffer(sampleDump),
          existingPair(),
          explosiveMode,
        );
      }).not.toThrow();

      const failure = expectFailure(result);
      expect(failure.stage).toBe("mode");
      expect(failure.issues).toHaveLength(1);
      expect(failure.issues[0]).toContain("REPLACE 또는 MERGE");
      // 표기 실패는 종류만 알리고 raw 객체 / stack 을 흘리지 않는다.
      expect(failure.issues[0]).not.toContain("폭발");
    });

    it("mode 실패 시 복원 입력 준비를 호출하지 않는다 (단락 평가)", () => {
      const spy = jest.spyOn(inputModule, "prepareImportRestoreInput");

      expectFailure(
        prepareImportRestorePlan(
          toBuffer(sampleDump),
          [],
          "nope" as unknown as ImportMode,
        ),
      );
      expect(spy).not.toHaveBeenCalled();

      // positive control — 같은 spy 가 성공 경로에서는 실제로 호출된다.
      expectSuccess(
        prepareImportRestorePlan(toBuffer(sampleDump), [], ImportMode.REPLACE),
      );
      expect(spy).toHaveBeenCalledTimes(1);
    });
  });

  describe("복원 입력 실패 전달 분기 (error path · negative)", () => {
    it.each([
      ["손상 JSON buffer", Buffer.from('{"records": ['), "deserialize"],
      ["빈 buffer", Buffer.alloc(0), "deserialize"],
      ["비-Buffer string", "not-a-buffer", "deserialize"],
      ["array top-level", Buffer.from("[]", "utf-8"), "structure"],
      ["recordCount 불일치", toBuffer(countMismatchDump), "structure"],
      ["호환 불가 schemaVersion", toBuffer(legacyDump), "version"],
      ["instant 위반 record", toBuffer(badInstantDump), "records"],
    ])("%s 는 상류 실패 stage 를 그대로 전달한다", (_label, buffer, stage) => {
      let result!: ImportRestorePlanPrepareResult;
      expect(() => {
        result = prepareImportRestorePlan(
          buffer as unknown as Buffer,
          existingPair(),
          ImportMode.REPLACE,
        );
      }).not.toThrow();

      const failure = expectFailure(result);
      expect(failure.stage).toBe(stage);
      expect(failure.issues.length).toBeGreaterThan(0);
      expect(failure).not.toHaveProperty("plan");
      expect(failure).not.toHaveProperty("records");
    });

    it("복원 입력 실패 시 plan 산출을 호출하지 않는다 (단락 평가)", () => {
      const spy = jest.spyOn(planModule, "buildImportRestorePlan");

      expectFailure(
        prepareImportRestorePlan(
          Buffer.from("{oops", "utf-8"),
          [],
          ImportMode.MERGE,
        ),
      );
      expect(spy).not.toHaveBeenCalled();

      // positive control — 같은 spy 가 성공 경로에서는 실제로 호출된다.
      expectSuccess(
        prepareImportRestorePlan(toBuffer(sampleDump), [], ImportMode.MERGE),
      );
      expect(spy).toHaveBeenCalledTimes(1);
    });
  });

  describe("plan throw 흡수 분기 (stage: plan · negative)", () => {
    it.each([
      ["existing 이 배열 아님", "not-an-array"],
      ["Invalid Date 원소", [{ entity: "Person", instant: invalidDate }]],
      ["string instant 원소", [{ entity: "Person", instant: "2026-01-01" }]],
      ["null 원소", [null]],
      [
        "위반 원소 2 개 이상",
        [
          { entity: "Person", instant: invalidDate },
          { entity: "Group", instant: 42 },
        ],
      ],
    ])(
      "%s 이면 throw 없이 stage: plan verdict 로 종료한다",
      (_label, existing) => {
        let result!: ImportRestorePlanPrepareResult;
        expect(() => {
          result = prepareImportRestorePlan(
            toBuffer(sampleDump),
            existing as unknown as ExportRecord[],
            ImportMode.REPLACE,
          );
        }).not.toThrow();

        const failure = expectFailure(result);
        expect(failure.stage).toBe("plan");
        // issues 는 정확히 1 개이며 한국어 message 만 담는다 (stack / Error 객체 미노출).
        expect(failure.issues).toHaveLength(1);
        expect(typeof failure.issues[0]).toBe("string");
        expect(failure.issues[0]).toMatch(/[가-힣]/);
        // stack frame ("\n    at fn (file.ts:12:34)") 형태가 섞여 들어오지 않았는지 확인한다.
        expect(failure.issues[0]).not.toMatch(/\n\s+at .+:\d+:\d+/);
        // message 는 한 줄 — 개행이 있으면 stack 이 붙었다는 신호다.
        expect(failure.issues[0]).not.toContain("\n");
        expect(failure).not.toHaveProperty("plan");
        expect(failure).not.toHaveProperty("records");
      },
    );

    it("Error 가 아닌 값이 throw 돼도 문자열 issue 로 흡수한다", () => {
      jest
        .spyOn(planModule, "buildImportRestorePlan")
        .mockImplementation(() => {
          throw "문자열 throw";
        });

      const failure = expectFailure(
        prepareImportRestorePlan(toBuffer(sampleDump), [], ImportMode.REPLACE),
      );

      expect(failure.stage).toBe("plan");
      expect(failure.issues).toEqual(["문자열 throw"]);
    });

    it("toString 이 throw 하는 비-Error 가 throw 돼도 흡수해 stage: plan 으로 종료한다", () => {
      jest
        .spyOn(planModule, "buildImportRestorePlan")
        .mockImplementation(() => {
          // 문자열화 자체가 폭발하는 값 — 흡수 helper 가 그대로 String() 하면 verdict 대신
          // 예외가 새어 나간다.
          throw {
            toString() {
              throw new Error("toString 폭발");
            },
          };
        });

      let result!: ImportRestorePlanPrepareResult;
      expect(() => {
        result = prepareImportRestorePlan(
          toBuffer(sampleDump),
          [],
          ImportMode.REPLACE,
        );
      }).not.toThrow();

      const failure = expectFailure(result);
      expect(failure.stage).toBe("plan");
      expect(failure.issues).toHaveLength(1);
      expect(typeof failure.issues[0]).toBe("string");
      expect(failure.issues[0]).toContain("object");
      expect(failure.issues[0]).not.toContain("폭발");
    });
  });

  describe("순수성 (non-mutating · idempotent)", () => {
    it("호출 후 buffer / existing 이 불변이고 두 번 호출하면 동일 결과다", () => {
      const source = JSON.stringify(sampleDump);
      const buffer = Buffer.from(source, "utf-8");
      const existing = existingPair();
      const instants = existing.map((record) => record.instant.getTime());

      const first = expectSuccess(
        prepareImportRestorePlan(buffer, existing, ImportMode.MERGE),
      );
      const second = expectSuccess(
        prepareImportRestorePlan(buffer, existing, ImportMode.MERGE),
      );

      expect(buffer.toString("utf-8")).toBe(source);
      expect(existing).toHaveLength(2);
      expect(existing.map((record) => record.instant.getTime())).toEqual(
        instants,
      );
      expect(second.plan).toEqual(first.plan);
      expect(second.records).toEqual(first.records);
      expect(second.version).toEqual(first.version);
      // 두 호출의 결과는 서로 다른 객체다 (내부 상태 공유 0).
      expect(second.plan).not.toBe(first.plan);
    });

    it("freeze 된 existing / options 로 호출해도 통과한다", () => {
      const existing = Object.freeze([Object.freeze({ ...conflicting })]);
      const options = Object.freeze({
        currentVersion: EXPORT_SCHEMA_VERSION,
        allowMigrationFrom: Object.freeze([OLD]),
      });

      let result!: ImportRestorePlanPrepareResult;
      expect(() => {
        result = prepareImportRestorePlan(
          toBuffer(sampleDump),
          existing,
          ImportMode.MERGE,
          options,
        );
      }).not.toThrow();

      expect(expectSuccess(result).plan.toDelete).toEqual([conflicting]);
      expect(options).toEqual({
        currentVersion: EXPORT_SCHEMA_VERSION,
        allowMigrationFrom: [OLD],
      });
    });
  });
});
