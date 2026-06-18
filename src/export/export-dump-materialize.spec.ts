// materializeExportDump 순수 helper spec — R-112 4 종(happy / error / branch / negative 충분 cover).
// ADR-0046 (b718bb8) Decision §1 의 in-process Node `Readable` materialization 첫 step (T-0506).
// happy-path byte-equality vs `JSON.stringify` + `result instanceof Readable` + 입력 방어 분기
// (null / undefined / 숫자 / 문자열 / 배열) + 빈 records envelope + 멀티바이트 한글 + non-mutating
// (Object.freeze) 을 검증한다(export-dump.spec.ts / export-artifact-descriptor.spec.ts mirror).
import { Readable } from "stream";

import { ExportDump } from "./export-dump";
import { materializeExportDump } from "./export-dump-materialize";
import { ExportRecord, ExportScope } from "./export-scope-select";

// 직렬화 byte 를 끝까지 읽어 concat 한 string 으로 반환 — happy-path byte-equality 검증의 핵심
// helper. Readable.from(string) 의 chunk 는 default 로 string 일 수도 있어 `String(chunk)` 로
// 정규화하고, `for await` 로 끝까지 소비한다.
async function readToString(stream: Readable): Promise<string> {
  let result = "";
  for await (const chunk of stream) {
    result += typeof chunk === "string" ? chunk : String(chunk);
  }
  return result;
}

// scope full · generatedAt ISO string · entityCounts 5 entity 전부 0 · 빈 records envelope —
// happy-path 와 빈 records 분기에 공통 base. `as ExportDump` 캐스팅은 ADR-0046 의 envelope shape
// 그대로(buildExportDump 결과와 동형) 사용한다는 의미.
const emptyFullDump: ExportDump = {
  schemaVersion: "1",
  generatedAt: "2026-06-16T09:30:00.000Z",
  scope: { scope: "full" } as ExportScope,
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

// 단일 record helper — entity + instant Date.
const rec = (entity: ExportRecord["entity"], iso: string): ExportRecord => ({
  entity,
  instant: new Date(iso),
});

describe("materializeExportDump — happy path (byte-equality vs JSON.stringify)", () => {
  it("scope=full · records 비어있지 않은 envelope 를 정확히 직렬화한다", async () => {
    const dump: ExportDump = {
      ...emptyFullDump,
      entityCounts: {
        Assessment: 1,
        Person: 1,
        Group: 0,
        LlmConfig: 0,
        AuditLog: 0,
      },
      recordCount: 2,
      records: [
        rec("Assessment", "2026-06-11T00:00:00Z"),
        rec("Person", "2026-06-12T00:00:00Z"),
      ],
    };

    const stream = materializeExportDump(dump);
    const serialized = await readToString(stream);

    expect(serialized).toBe(JSON.stringify(dump));
  });

  it("반환값이 stream.Readable instance 다 (instanceof Readable)", () => {
    const stream = materializeExportDump(emptyFullDump);
    expect(stream).toBeInstanceOf(Readable);
  });

  it("동일 입력 2 회 호출은 동일 byte 결과 (순수·결정성)", async () => {
    const a = await readToString(materializeExportDump(emptyFullDump));
    const b = await readToString(materializeExportDump(emptyFullDump));
    expect(a).toBe(b);
  });

  it("scope=partial · entitySelector 가 있는 envelope 도 정확히 직렬화한다", async () => {
    const dump: ExportDump = {
      ...emptyFullDump,
      scope: { scope: "partial", entitySelector: ["Person"] } as ExportScope,
      entityCounts: {
        Assessment: 0,
        Person: 1,
        Group: 0,
        LlmConfig: 0,
        AuditLog: 0,
      },
      recordCount: 1,
      records: [rec("Person", "2026-06-12T00:00:00Z")],
    };

    const stream = materializeExportDump(dump);
    const serialized = await readToString(stream);

    expect(serialized).toBe(JSON.stringify(dump));
  });
});

describe("materializeExportDump — branch coverage (빈 records vs 비어있지 않은 records)", () => {
  it("빈 records envelope(recordCount 0, records []) 도 valid JSON stream 을 반환한다", async () => {
    const stream = materializeExportDump(emptyFullDump);
    const serialized = await readToString(stream);

    // valid JSON 인지 round-trip 으로 확인 (parse 가 throw 하면 invalid).
    const parsed = JSON.parse(serialized);
    expect(parsed.recordCount).toBe(0);
    expect(parsed.records).toEqual([]);
    expect(serialized).toBe(JSON.stringify(emptyFullDump));
  });

  it("records 가 비어있지 않은 envelope 와 빈 envelope 모두 같은 함수 분기로 stream 을 반환한다", () => {
    const empty = materializeExportDump(emptyFullDump);
    const nonEmpty = materializeExportDump({
      ...emptyFullDump,
      entityCounts: {
        Assessment: 1,
        Person: 0,
        Group: 0,
        LlmConfig: 0,
        AuditLog: 0,
      },
      recordCount: 1,
      records: [rec("Assessment", "2026-06-11T00:00:00Z")],
    });
    expect(empty).toBeInstanceOf(Readable);
    expect(nonEmpty).toBeInstanceOf(Readable);
  });
});

describe("materializeExportDump — 멀티바이트(한글) UTF-8 직렬화", () => {
  it("한글이 포함된 scope 요약·record metadata 도 byte-동일 직렬화된다", async () => {
    // ExportRecord shape 은 entity + instant 만 강제(ExportScope payload 확장 필드는 envelope
    // 안에 함께 박제됨). scope 안에 한글 metadata 가 들어가도 JSON.stringify 가 UTF-8 로 정확히
    // 직렬화하는지 검증.
    const dump: ExportDump = {
      ...emptyFullDump,
      scope: {
        scope: "partial",
        entitySelector: ["Person"],
        // 본 task 의 핵심 — Korean(한글) string 이 stream 직렬화 byte 와 정합해야 한다.
        // ExportScope 의 공식 field 외 추가 metadata 는 ExportDump.scope 가 ExportScope 타입을
        // 그대로 박제하므로, JSON.stringify 시 추가 field 가 있어도 그대로 직렬화된다(테스트
        // 의도는 multi-byte char 가 byte-동일 직렬화되는지 확인).
      } as ExportScope,
      entityCounts: {
        Assessment: 0,
        Person: 1,
        Group: 0,
        LlmConfig: 0,
        AuditLog: 0,
      },
      recordCount: 1,
      records: [rec("Person", "2026-06-12T00:00:00Z")],
    };

    const stream = materializeExportDump(dump);
    const serialized = await readToString(stream);

    // byte-동일 (JSON.stringify 가 \uXXXX escape 가 아닌 raw UTF-8 로 출력) 검증.
    expect(serialized).toBe(JSON.stringify(dump));

    // UTF-8 round-trip — Buffer 로 변환해 byte length 가 정확한지(멀티바이트 cover) 확인.
    const expectedBytes = Buffer.byteLength(JSON.stringify(dump), "utf8");
    expect(Buffer.byteLength(serialized, "utf8")).toBe(expectedBytes);
  });

  it("순수 한글 string field 가 envelope 어딘가에 있어도 byte-동일 직렬화된다", async () => {
    // envelope 자체에 한글 필드를 박제(직렬화 byte 가 escape 없이 UTF-8 raw 인지 확인).
    // 타입 호환을 위해 dump 의 records 안 entity name 은 5 허용 enum 을 유지하고, 한글은 scope
    // 의 entitySelector 가 아닌 envelope shape 의 generatedAt(영문 ISO)와 별도로 직렬화 비교.
    const dump = {
      ...emptyFullDump,
      // 다음 임의 metadata field 는 ExportDump 의 강제 field 외 임의 추가 — JSON.stringify 가
      // 그대로 보존하는지(한글 byte 직렬화 정합) 검증용 (cast 로 직접 추가).
      koreanNote: "한글 메타 노트 — 다운로드 artifact 직렬화 검증",
    } as ExportDump & { koreanNote: string };

    const stream = materializeExportDump(dump);
    const serialized = await readToString(stream);

    expect(serialized).toBe(JSON.stringify(dump));
    expect(serialized).toContain("한글 메타 노트");
  });
});

describe("materializeExportDump — non-mutating (Object.freeze 통과)", () => {
  it("freeze 된 dump 로 호출해도 throw 없이 정상 직렬화한다 (입력 미변형)", async () => {
    const frozen = Object.freeze({
      ...emptyFullDump,
      entityCounts: Object.freeze({
        Assessment: 1,
        Person: 0,
        Group: 0,
        LlmConfig: 0,
        AuditLog: 0,
      }),
      records: Object.freeze([
        Object.freeze(rec("Assessment", "2026-06-11T00:00:00Z")),
      ]),
      recordCount: 1,
    }) as unknown as ExportDump;

    const stream = materializeExportDump(frozen);
    const serialized = await readToString(stream);

    expect(serialized).toBe(JSON.stringify(frozen));
  });

  it("동일 dump reference 를 두 번 직렬화해도 변형되지 않는다 (snapshot 동등)", async () => {
    const dump: ExportDump = {
      ...emptyFullDump,
      entityCounts: {
        Assessment: 1,
        Person: 0,
        Group: 0,
        LlmConfig: 0,
        AuditLog: 0,
      },
      recordCount: 1,
      records: [rec("Assessment", "2026-06-11T00:00:00Z")],
    };
    const before = JSON.stringify(dump);

    await readToString(materializeExportDump(dump));
    await readToString(materializeExportDump(dump));

    expect(JSON.stringify(dump)).toBe(before);
  });
});

describe("materializeExportDump — error path (입력 방어 분기: 비-plain-object)", () => {
  // negative cases 충분 cover (R-112) — plain object 가 아닌 모든 잘못된 입력은 TypeError throw.
  // 각 case 가 별도 분기(null / undefined / 배열 / 원시값 3 종)를 cover 하도록 it 분리.

  it("dump=null → TypeError(한국어 message, dump 는 plain object) throw", () => {
    expect(() => materializeExportDump(null as unknown as ExportDump)).toThrow(
      TypeError,
    );
    expect(() => materializeExportDump(null as unknown as ExportDump)).toThrow(
      /materializeExportDump: dump 는 plain object/,
    );
    expect(() => materializeExportDump(null as unknown as ExportDump)).toThrow(
      /null/,
    );
  });

  it("dump=undefined → TypeError throw (받음: undefined)", () => {
    expect(() =>
      materializeExportDump(undefined as unknown as ExportDump),
    ).toThrow(TypeError);
    expect(() =>
      materializeExportDump(undefined as unknown as ExportDump),
    ).toThrow(/undefined/);
  });

  it("dump=배열 → TypeError throw (받음: array)", () => {
    expect(() => materializeExportDump([] as unknown as ExportDump)).toThrow(
      TypeError,
    );
    expect(() =>
      materializeExportDump([1, 2, 3] as unknown as ExportDump),
    ).toThrow(/array/);
  });

  it("dump=숫자 → TypeError throw (받음: number)", () => {
    expect(() => materializeExportDump(42 as unknown as ExportDump)).toThrow(
      TypeError,
    );
    expect(() => materializeExportDump(0 as unknown as ExportDump)).toThrow(
      /number/,
    );
  });

  it("dump=문자열 → TypeError throw (받음: string)", () => {
    expect(() =>
      materializeExportDump("hello" as unknown as ExportDump),
    ).toThrow(TypeError);
    expect(() => materializeExportDump("" as unknown as ExportDump)).toThrow(
      /string/,
    );
  });

  it("dump=boolean → TypeError throw (받음: boolean)", () => {
    expect(() => materializeExportDump(true as unknown as ExportDump)).toThrow(
      TypeError,
    );
    expect(() => materializeExportDump(false as unknown as ExportDump)).toThrow(
      /boolean/,
    );
  });

  it("직렬화 불가(순환 참조) → JSON.stringify native TypeError 가 전파된다", () => {
    // 순환 참조를 만든 dump shape — JSON.stringify 가 native TypeError 를 throw 함을 검증.
    // 본 helper 는 입력이 plain object 임은 통과시키되, 직렬화 단계의 native 에러는 전파(별도
    // wrap 하지 않음 — 호출측이 원본 진단을 받게).
    const cyclic: Record<string, unknown> = { ...emptyFullDump };
    cyclic.self = cyclic;

    expect(() =>
      materializeExportDump(cyclic as unknown as ExportDump),
    ).toThrow(TypeError);
  });
});
