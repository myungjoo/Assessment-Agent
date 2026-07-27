import { ImportMode } from "@prisma/client";

import { EXPORT_SCHEMA_VERSION } from "../export/export-dump";
import type { FullExportRecord } from "../export/export-full-record";
import type { ExportRecord } from "../export/export-scope-select";
import * as planModule from "../export/import-restore-plan";
import type { ImportRestorePlan } from "../export/import-restore-plan";

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

  // ─── T-1269 — plan / records 를 FullExportRecord 축으로 좁힌 증분 ────────────────────
  // ts-jest 는 diagnostics 가 켜져 있어 아래 대입이 타입 오류가 되면 suite 자체가 fail 한다.
  // 그래서 타입 pin test 들은 컴파일 계약과 런타임 값을 동시에 고정한다 (vacuous pin 방지 —
  // 모든 pin 이 런타임 단언을 동반한다).

  // dump 원문의 fields 기대값 — 순서까지 그대로 plan.toInsert 로 실려 나와야 한다.
  const expectedFields: Record<string, unknown>[] = [
    { id: "a1" },
    { id: "p1", fullName: "홍길동" },
    { id: "g1", name: "1팀" },
    { id: "c1", provider: "openai" },
    { id: "l1", principal: "system" },
  ];

  // records 만 갈아끼운 dump — entityCounts 는 **실제 record 의 entity 분포** 를 세어 싣고 합계 ==
  // recordCount 정합을 유지해 구조 검증을 통과시킨 뒤 hydrate 단계의 fields 분기만 재현한다.
  // key 존재 판정은 `in` 이 아니라 hasOwnProperty 로 한다 (prototype chain key 오탐 차단 —
  // T-1268 reviewer NIT-5 권고 반영).
  const dumpWithRecords = (records: unknown[]) => {
    const entityCounts: Record<ExportRecord["entity"], number> = {
      Assessment: 0,
      Person: 0,
      Group: 0,
      LlmConfig: 0,
      AuditLog: 0,
    };
    records.forEach((record) => {
      const entity = (record as { entity?: unknown } | null)?.entity;
      const key =
        typeof entity === "string" &&
        Object.prototype.hasOwnProperty.call(entityCounts, entity)
          ? (entity as ExportRecord["entity"])
          : "AuditLog";
      entityCounts[key] += 1;
    });

    return {
      ...sampleDump,
      entityCounts,
      recordCount: records.length,
      records,
    };
  };

  describe("타입 pin (컴파일 타임 계약)", () => {
    it("성공 갈래의 plan / records 는 assertion 없이 좁은 타입에 대입된다 (좁힘)", () => {
      const result = expectSuccess(
        prepareImportRestorePlan(toBuffer(sampleDump), [], ImportMode.REPLACE),
      );

      // 좁힘 방향 — 다음 slice 의 `$transaction` 이 `createMany({ data })` 로 쓸 row payload 를
      // 타입 상으로 볼 수 있어야 한다.
      const narrowedPlan: ImportRestorePlan<FullExportRecord> = result.plan;
      const narrowedRecords: FullExportRecord[] = result.records;

      expect(narrowedPlan.toInsert).toHaveLength(5);
      // 캐스팅 없이 fields 를 읽는다 — 타입이 다시 넓어지면 이 문장이 컴파일 오류가 된다.
      expect(narrowedPlan.toInsert[0].fields).toEqual({ id: "a1" });
      expect(narrowedPlan.toInsert[1].fields.fullName).toBe("홍길동");
      expect(narrowedRecords[3].fields.provider).toBe("openai");
    });

    it("같은 값이 기본 파라미터 ImportRestorePlan / ExportRecord[] 변수·인자 위치에도 대입된다 (넓힘)", () => {
      const result = expectSuccess(
        prepareImportRestorePlan(
          toBuffer(sampleDump),
          existingPair(),
          ImportMode.MERGE,
        ),
      );

      // 변수 위치 — 좁힌 타입이 기본 파라미터 타입에 그대로 들어간다 (covariance). 기존 소비처
      // (import-restore-plan-summary / import-merge-conflict / import-restore-ops) 가 한 줄도
      // 고쳐지지 않아야 함을 spec 이 먼저 잡는다.
      const widenedPlan: ImportRestorePlan = result.plan;
      const widenedRecords: ExportRecord[] = result.records;
      // 인자 위치 — 하류 소비처와 동형 파라미터 배선.
      const sizeOf = (plan: ImportRestorePlan): number =>
        plan.toDelete.length + plan.toInsert.length + plan.toKeep.length;
      const entitiesOf = (records: ReadonlyArray<ExportRecord>): string[] =>
        records.map((record) => record.entity);

      expect(sizeOf(result.plan)).toBe(sizeOf(widenedPlan));
      expect(sizeOf(widenedPlan)).toBe(7);
      expect(entitiesOf(result.records)).toEqual(entitiesOf(widenedRecords));
      expect(entitiesOf(widenedRecords)).toEqual([
        "Assessment",
        "Person",
        "Group",
        "LlmConfig",
        "AuditLog",
      ]);
    });

    it("실패 갈래에는 plan / records 가 타입 상으로도 존재하지 않는다", () => {
      const failure = expectFailure(
        prepareImportRestorePlan(
          Buffer.from("{oops", "utf-8"),
          [],
          ImportMode.REPLACE,
        ),
      );

      // @ts-expect-error 실패 verdict 는 plan 을 갖지 않는다 (부분 결과 미반환 계약의 타입 pin).
      const absentPlan: unknown = failure.plan;
      // @ts-expect-error 실패 verdict 는 records 도 갖지 않는다.
      const absentRecords: unknown = failure.records;

      expect(absentPlan).toBeUndefined();
      expect(absentRecords).toBeUndefined();
      expect(failure).not.toHaveProperty("plan");
      expect(failure).not.toHaveProperty("records");
    });
  });

  describe("fields payload 끝까지 전달 (happy path 증분)", () => {
    it("REPLACE 는 dump 원문 fields 를 순서 보존해 plan.toInsert 까지 실어 보낸다", () => {
      const result = expectSuccess(
        prepareImportRestorePlan(
          toBuffer(sampleDump),
          existingPair(),
          ImportMode.REPLACE,
        ),
      );

      expect(result.plan.toInsert.map((record) => record.fields)).toEqual(
        expectedFields,
      );
      expect(result.records.map((record) => record.fields)).toEqual(
        expectedFields,
      );
      // toDelete / toKeep 은 기존 row 축이라 fields 를 갖지 않는다 (T-1266 결정 유지).
      expect(result.plan.toDelete).toEqual(existingPair());
      expect(result.plan.toKeep).toEqual([]);
    });

    it("MERGE 도 fields 를 보존하며 분류만 달라진다", () => {
      const result = expectSuccess(
        prepareImportRestorePlan(
          toBuffer(sampleDump),
          existingPair(),
          ImportMode.MERGE,
        ),
      );

      expect(result.plan.toInsert.map((record) => record.fields)).toEqual(
        expectedFields,
      );
      expect(result.plan.toDelete).toEqual([conflicting]);
      expect(result.plan.toKeep).toEqual([untouched]);
    });

    // 빈 records (0 개) 경계 자체는 위 "성공 분기" it.each 가 이미 cover 하므로 여기서는 그
    // 경계에서도 좁은 타입이 유지되는지만 덧붙인다.
    it("빈 records 경계에서도 toInsert 가 FullExportRecord[] 로 유지된다", () => {
      const result = expectSuccess(
        prepareImportRestorePlan(toBuffer(emptyDump), [], ImportMode.REPLACE),
      );
      const narrowed: FullExportRecord[] = result.plan.toInsert;

      expect(narrowed).toEqual([]);
      expect(result.records).toEqual([]);
    });

    it("두 번 호출하면 값은 같지만 records 배열은 서로 다른 instance 다", () => {
      const buffer = toBuffer(sampleDump);
      const first = expectSuccess(
        prepareImportRestorePlan(buffer, [], ImportMode.REPLACE),
      );
      const second = expectSuccess(
        prepareImportRestorePlan(buffer, [], ImportMode.REPLACE),
      );

      expect(second.records).toEqual(first.records);
      expect(second.records).not.toBe(first.records);
      expect(second.records[0].fields).not.toBe(first.records[0].fields);
    });
  });

  describe("stage · issues 문구 회귀 pinning (error path)", () => {
    it("mode 실패 issues 는 helper 자신의 한국어 문구 그대로다", () => {
      const failure = expectFailure(
        prepareImportRestorePlan(
          toBuffer(sampleDump),
          [],
          "replace" as unknown as ImportMode,
        ),
      );

      expect(failure.issues).toEqual([
        "prepareImportRestorePlan: mode 는 REPLACE 또는 MERGE 여야 합니다 (받음: replace)",
      ]);
    });

    it.each([
      ["손상 JSON buffer", Buffer.from('{"records": ['), "deserialize"],
      ["array top-level", Buffer.from("[]", "utf-8"), "structure"],
      ["호환 불가 schemaVersion", toBuffer(legacyDump), "version"],
      ["instant 위반 record", toBuffer(badInstantDump), "records"],
    ])(
      "%s 는 상류 verdict 의 stage 와 issues 배열을 재가공 0 으로 전달한다",
      (_label, buffer, stage) => {
        const upstream = inputModule.prepareImportRestoreInput(
          buffer as Buffer,
        );
        if (upstream.ok) {
          throw new Error("상류가 실패 verdict 를 낼 입력이어야 합니다");
        }

        const failure = expectFailure(
          prepareImportRestorePlan(
            buffer as Buffer,
            existingPair(),
            ImportMode.REPLACE,
          ),
        );

        expect(failure.stage).toBe(stage);
        expect(failure.stage).toBe(upstream.stage);
        expect(failure.issues).toEqual(upstream.issues);
        expect(failure.issues.every((issue) => typeof issue === "string")).toBe(
          true,
        );
      },
    );

    it("plan throw 흡수 issues 는 buildImportRestorePlan 의 message 와 동일하다", () => {
      let expected = "";
      try {
        planModule.buildImportRestorePlan(
          "not-an-array" as unknown as ExportRecord[],
          [],
          "replace",
        );
      } catch (error) {
        expected = (error as Error).message;
      }

      const failure = expectFailure(
        prepareImportRestorePlan(
          toBuffer(sampleDump),
          "not-an-array" as unknown as ExportRecord[],
          ImportMode.REPLACE,
        ),
      );

      expect(expected).toContain("배열이어야 합니다");
      expect(failure.stage).toBe("plan");
      expect(failure.issues).toEqual([expected]);
    });
  });

  describe("fields 규칙 negative · 값 비노출 (REQ-032)", () => {
    // 실 배선에서는 쓰이지 않지만 값 노출 여부를 검사하기 위한 secret 유사 문자열.
    const SECRET = "sk-live-이-값은-issue-에-절대-실리면-안-된다";

    it("fields 가 없는 legacy dump record 는 stage: records 로 거부되고 부분 결과가 없다", () => {
      const failure = expectFailure(
        prepareImportRestorePlan(
          toBuffer(
            dumpWithRecords([
              { entity: "Person", instant: "2026-02-02T01:02:03.000Z" },
            ]),
          ),
          existingPair(),
          ImportMode.REPLACE,
        ),
      );

      expect(failure.stage).toBe("records");
      expect(failure.issues).toEqual([
        "records[0].fields 는 컬럼명→값 map 인 object 여야 합니다 (받음: undefined)",
      ]);
      expect(failure).not.toHaveProperty("plan");
      expect(failure).not.toHaveProperty("records");
    });

    it("allow-list 밖 key (apiKey) 가 섞이면 stage: records 로 거부하고 값은 싣지 않는다", () => {
      const failure = expectFailure(
        prepareImportRestorePlan(
          toBuffer(
            dumpWithRecords([
              {
                entity: "LlmConfig",
                instant: "2026-04-04T07:08:09.000Z",
                fields: { id: "c1", apiKey: SECRET },
              },
            ]),
          ),
          [],
          ImportMode.MERGE,
        ),
      );

      expect(failure.stage).toBe("records");
      expect(failure.issues).toEqual([
        "records[0].fields 에 LlmConfig allow-list 밖 key 가 있습니다 (받음: apiKey) — " +
          "secret / 미정의 컬럼은 복원할 수 없습니다",
      ]);
      // key 이름만 알리고 값은 절대 노출하지 않는다.
      expect(failure.issues[0]).not.toContain(SECRET);
    });

    it("실패 issues 에 fields 안 값이나 stack 이 실리지 않는다", () => {
      const failure = expectFailure(
        prepareImportRestorePlan(
          toBuffer(
            dumpWithRecords([
              {
                entity: "Person",
                instant: "not-a-date",
                fields: { id: SECRET, fullName: SECRET },
              },
            ]),
          ),
          [],
          ImportMode.REPLACE,
        ),
      );

      expect(failure.stage).toBe("records");
      failure.issues.forEach((issue) => {
        expect(issue).not.toContain(SECRET);
        expect(issue).not.toMatch(/\n\s+at .+:\d+:\d+/);
      });
    });
  });
});
