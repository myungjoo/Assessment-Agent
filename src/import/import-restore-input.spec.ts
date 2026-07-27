import { EXPORT_SCHEMA_VERSION } from "../export/export-dump";
import type { FullExportRecord } from "../export/export-full-record";
import type { ExportRecord } from "../export/export-scope-select";
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
    records: instants.map((instant) => ({
      entity: "Person",
      instant,
      fields: { id: "p1" },
    })),
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
      // T-1268 — fields payload 가 dump 원문 값 그대로 끝까지 실려 나온다 (값 변환 0).
      expect(result.records.map((record) => record.fields)).toEqual(
        sampleDump.records.map((record) => record.fields),
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
      [
        "원소가 object 아님",
        ["nope"],
        "records[0] 는 { entity, instant } 형태의 object",
      ],
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

  // ─── T-1268 — records 타입을 FullExportRecord[] 로 좁힌 증분 ───────────────────────────
  // ts-jest 는 diagnostics 가 켜져 있어 아래 대입이 타입 오류가 되면 suite 자체가 fail 한다.
  // 그래서 타입 pin test 들은 컴파일 계약과 런타임 값을 동시에 고정한다 (vacuous pin 방지 —
  // 모든 pin 이 런타임 단언을 동반한다).
  describe("타입 pin (컴파일 타임 계약)", () => {
    it("성공 갈래의 records 는 type assertion 없이 FullExportRecord[] 에 대입된다 (좁힘)", () => {
      const result = expectSuccess(
        prepareImportRestoreInput(toBuffer(sampleDump)),
      );

      // 좁힘 방향 — 하류 `$transaction` 이 `createMany({ data: fields })` 로 쓸 payload 를
      // 타입 상으로 볼 수 있어야 한다.
      const narrowed: FullExportRecord[] = result.records;

      expect(narrowed).toHaveLength(5);
      // 캐스팅 없이 fields 를 읽는다 — 타입이 다시 넓어지면 이 문장이 컴파일 오류가 된다.
      expect(narrowed[1].fields.fullName).toBe("홍길동");
      expect(narrowed[0].fields).toEqual({ id: "a1" });
    });

    it("같은 값이 ExportRecord[] 변수와 인자 위치에도 그대로 대입된다 (넓힘)", () => {
      const result = expectSuccess(
        prepareImportRestoreInput(toBuffer(sampleDump)),
      );

      // 변수 위치 — 좁힌 타입이 상위 타입 배열에 그대로 들어간다 (covariance).
      const widened: ExportRecord[] = result.records;
      // 인자 위치 — 하류 소비처 (import-restore-plan-prepare.ts →
      // buildImportRestorePlan(existing, incoming, mode)) 와 동형 파라미터 배선.
      const entitiesOf = (records: ReadonlyArray<ExportRecord>): string[] =>
        records.map((record) => record.entity);

      expect(entitiesOf(result.records)).toEqual(entitiesOf(widened));
      expect(entitiesOf(widened)).toEqual([
        "Assessment",
        "Person",
        "Group",
        "LlmConfig",
        "AuditLog",
      ]);
    });

    it("실패 갈래에는 records 필드가 타입 상으로도 존재하지 않는다", () => {
      const failure = expectFailure(
        prepareImportRestoreInput(Buffer.from("{oops", "utf-8")),
      );

      // @ts-expect-error 실패 verdict 는 records 를 갖지 않는다 (부분 결과 미반환 계약의 타입 pin).
      const absent: unknown = failure.records;

      expect(absent).toBeUndefined();
      expect(failure).not.toHaveProperty("records");
    });
  });

  describe("fields payload 전달 (negative · 경계)", () => {
    // 실 배선에서는 쓰이지 않지만 값 노출 여부를 검사하기 위한 secret 유사 문자열.
    const SECRET = "sk-live-이-값은-issue-에-절대-실리면-안-된다";

    // records 만 갈아끼운 dump — entityCounts 는 **실제 record 의 entity 분포** 를 세어 싣고
    // (fixture 자체 모순 제거), 합계 == recordCount 정합은 그대로 유지해 구조 검증을 통과시키고
    // hydrate 단계의 fields 분기만 재현한다. entity 를 읽을 수 없는 원소 (object 아님 / 5-union
    // 밖) 는 AuditLog 로 몰아 합계만 맞춘다 — 구조 검증은 per-entity 분포를 보지 않는다.
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
          typeof entity === "string" && entity in entityCounts
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

    it("fields 가 없는 legacy dump record 는 stage: records 로 거부되고 부분 결과가 없다", () => {
      const failure = expectFailure(
        prepareImportRestoreInput(
          toBuffer(
            dumpWithRecords([
              { entity: "Person", instant: "2026-02-02T01:02:03.000Z" },
            ]),
          ),
        ),
      );

      expect(failure.stage).toBe("records");
      expect(failure.issues).toEqual([
        "records[0].fields 는 컬럼명→값 map 인 object 여야 합니다 (받음: undefined)",
      ]);
      expect(failure).not.toHaveProperty("records");
    });

    it("allow-list 밖 key (apiKey) 가 섞이면 거부하며 그 값은 issue 에 싣지 않는다", () => {
      const failure = expectFailure(
        prepareImportRestoreInput(
          toBuffer(
            dumpWithRecords([
              {
                entity: "LlmConfig",
                instant: "2026-04-04T07:08:09.000Z",
                fields: { id: "c1", provider: "openai", apiKey: SECRET },
              },
            ]),
          ),
        ),
      );

      expect(failure.stage).toBe("records");
      expect(failure.issues).toHaveLength(1);
      // key 이름은 안내하되 값은 절대 싣지 않는다 (REQ-032).
      expect(failure.issues[0]).toContain("apiKey");
      expect(failure.issues[0]).toContain("allow-list 밖 key");
      expect(failure.issues[0]).not.toContain(SECRET);
      expect(failure).not.toHaveProperty("records");
    });

    it("issue 문자열에 fields 값도 stack 도 실리지 않는다", () => {
      const failure = expectFailure(
        prepareImportRestoreInput(
          toBuffer(
            dumpWithRecords([
              {
                entity: "LlmConfig",
                instant: "not-a-date",
                fields: { id: "c1", modelId: SECRET },
              },
            ]),
          ),
        ),
      );

      const joined = failure.issues.join(" ");
      expect(failure.stage).toBe("records");
      expect(joined).toContain("records[0].instant");
      expect(joined).not.toContain(SECRET);
      // Error 객체 / stack 흔적 미노출 (REQ-032 정합). "Error" 부분 문자열 금지는 정상 한국어
      // 안내 문구에도 걸릴 수 있어 오탐 여지가 있으므로, stack 형태 자체 (V8 frame 의
      // " at <파일>:<줄>:<열>") 와 Error toString prefix ("<Name>Error: ") 의 부재로 단언한다.
      expect(joined).not.toMatch(/ at .+:\d+:\d+/);
      expect(joined).not.toMatch(/\w*Error:\s/);
    });

    it("빈 records 경계에서도 ok: true + 빈 FullExportRecord[] 다", () => {
      const result = expectSuccess(
        prepareImportRestoreInput(toBuffer(emptyDump)),
      );

      const narrowed: FullExportRecord[] = result.records;
      expect(narrowed).toEqual([]);
      expect(result.version.action).toBe("accept");
    });

    it("version 이 migrate 판정이어도 차단하지 않고 fields 를 그대로 실어 보낸다", () => {
      const result = expectSuccess(
        prepareImportRestoreInput(toBuffer(legacyDump), {
          allowMigrationFrom: [OLD],
        }),
      );

      expect(result.version.action).toBe("migrate");
      expect(result.records[3].fields).toEqual({
        id: "c1",
        provider: "openai",
      });
    });

    it("호출 후 입력 buffer 의 바이트가 그대로다 (비변형)", () => {
      const buffer = toBuffer(sampleDump);
      const snapshot = Buffer.from(buffer);

      expectSuccess(prepareImportRestoreInput(buffer));

      expect(Buffer.compare(buffer, snapshot)).toBe(0);
    });

    it("두 번 호출하면 fields 까지 동일하되 서로 다른 객체다 (idempotent)", () => {
      const buffer = toBuffer(sampleDump);

      const first = expectSuccess(prepareImportRestoreInput(buffer));
      const second = expectSuccess(prepareImportRestoreInput(buffer));

      expect(second.records.map((record) => record.fields)).toEqual(
        first.records.map((record) => record.fields),
      );
      expect(second.records[0].fields).not.toBe(first.records[0].fields);
    });

    it("fields 안 값 (nested object · Date · null) 은 identity 를 보존해 전달된다", () => {
      // JSON round-trip 없이 참조 동일성을 확인하려면 상류 verdict 를 직접 주입해야 한다.
      const nested = { level: { deep: "value" } };
      const createdAt = new Date("2026-06-06T00:00:00.000Z");
      const injected = {
        ...sampleDump,
        records: [
          {
            entity: "Assessment",
            instant: "2026-01-01T00:00:00.000Z",
            fields: {
              id: "a1",
              narrative: nested,
              createdAt,
              personId: null,
            },
          },
        ],
      } as Record<string, unknown>;
      jest.spyOn(screenModule, "screenImportDumpBuffer").mockReturnValue({
        ok: true,
        dump: injected,
        version: {
          compatible: true,
          action: "accept",
          uploadedVersion: EXPORT_SCHEMA_VERSION,
          currentVersion: EXPORT_SCHEMA_VERSION,
        },
      });

      const result = expectSuccess(
        prepareImportRestoreInput(toBuffer(sampleDump)),
      );

      expect(result.records[0].fields.narrative).toBe(nested);
      expect(result.records[0].fields.createdAt).toBe(createdAt);
      expect(result.records[0].fields.personId).toBeNull();
      // fields 객체 자체는 새 shallow copy — 반환값을 바꿔도 입력 dump 는 오염되지 않는다.
      const injectedFields = (injected.records as { fields: unknown }[])[0]
        .fields;
      expect(result.records[0].fields).not.toBe(injectedFields);
      expect(result.records[0].fields).toEqual(injectedFields);
    });
  });

  describe("실패 verdict 문구 회귀 pinning", () => {
    it("hydrate 실패는 stage: records + 하류 helper 문구를 그대로 전달한다", () => {
      const failure = expectFailure(
        prepareImportRestoreInput(toBuffer(dumpWithInstants("nope"))),
      );

      expect(failure.stage).toBe("records");
      expect(failure.issues).toEqual([
        "records[0].instant 는 Date 로 파싱 가능한 string 또는 유효한 Date instance 여야 합니다 (받음: string)",
      ]);
      expect(failure).not.toHaveProperty("records");
    });

    it.each([
      ["deserialize", Buffer.from("{oops", "utf-8")],
      ["structure", Buffer.from("[]", "utf-8")],
      ["version", Buffer.from(JSON.stringify(legacyDump), "utf-8")],
      // 비-Buffer 입력도 같은 방식으로 문구까지 pin 한다 — 위 "비-Buffer string" test 는 stage 와
      // issues.length 만 봐서 상류 문구가 바뀌어도 회귀를 잡지 못했다.
      ["비-Buffer string", "not-a-buffer"],
    ])(
      "screening 실패 (%s) 는 상류 verdict 의 stage · issues 와 완전히 동일하다 (재가공 0)",
      (_label, input) => {
        // 같은 입력으로 상류 helper 를 직접 호출해 기준선을 만든 뒤 문자열 배열까지 비교한다.
        const direct = screenModule.screenImportDumpBuffer(
          input as unknown as Buffer,
        );
        if (direct.ok) {
          throw new Error("상류 screening 실패를 기대했으나 성공했습니다");
        }

        const failure = expectFailure(
          prepareImportRestoreInput(input as unknown as Buffer),
        );

        expect(failure.stage).toBe(direct.stage);
        expect(failure.issues).toEqual(direct.issues);
        expect(failure).not.toHaveProperty("records");
      },
    );
  });
});
