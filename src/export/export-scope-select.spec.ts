// export-scope-select 순수 helper spec — R-112 4 종(happy / error / branch / negative 충분
// cover). scope 3 분기(full/range/partial) + range+entitySelector AND + 반열림 [start, end)
// 경계 + non-mutating + 예외 분기를 검증한다(deletion-window-select.spec.ts mirror).
import { PeriodRange } from "../common/period-boundary";

import {
  ExportRecord,
  ExportScope,
  ExportSelection,
  selectExportRecords,
  VALID_EXPORT_ENTITIES,
  VALID_EXPORT_SCOPES,
} from "./export-scope-select";

const d = (iso: string) => new Date(iso);

// 분류 key 만 담은 record factory — entity + instant.
const rec = (entity: ExportRecord["entity"], iso: string): ExportRecord => ({
  entity,
  instant: d(iso),
});

// 고정 dateRange [2026-06-10T00:00:00Z, 2026-06-12T00:00:00Z) — 폭 2 일.
const range: PeriodRange = {
  start: d("2026-06-10T00:00:00Z"),
  end: d("2026-06-12T00:00:00Z"),
};

// T-0445 단일 source-of-truth 통합 — export 한 허용 scope/entity 상수의 멤버십을 명시적으로
// 단언한다. 향후 멤버가 바뀌면(추가/삭제) 본 assertion 이 먼저 fail 해 의도된 변경임을 강제한다.
describe("export 상수 — VALID_EXPORT_SCOPES / VALID_EXPORT_ENTITIES (T-0445 통합)", () => {
  it("VALID_EXPORT_SCOPES 는 정확히 3 값(full/range/partial)", () => {
    expect(VALID_EXPORT_SCOPES).toHaveLength(3);
    expect([...VALID_EXPORT_SCOPES]).toEqual(["full", "range", "partial"]);
  });

  it("VALID_EXPORT_ENTITIES 는 정확히 5 entity(UC-07 §6.1 entitySelector 목록)", () => {
    expect(VALID_EXPORT_ENTITIES).toHaveLength(5);
    expect([...VALID_EXPORT_ENTITIES]).toEqual([
      "Assessment",
      "Person",
      "Group",
      "LlmConfig",
      "AuditLog",
    ]);
  });

  it("selectExportRecords 의 scope 검증은 export 상수와 동일 멤버십을 본다 (regression)", () => {
    // export 상수에 든 scope 는 전부 throw 없이 소비 가능해야 한다.
    for (const scope of VALID_EXPORT_SCOPES) {
      if (scope === "full") {
        expect(() => selectExportRecords({ scope }, [])).not.toThrow();
      } else if (scope === "range") {
        expect(() =>
          selectExportRecords({ scope, dateRange: range }, []),
        ).not.toThrow();
      } else {
        expect(() =>
          selectExportRecords({ scope, entitySelector: ["Assessment"] }, []),
        ).not.toThrow();
      }
    }
    // export 상수에 없는 scope 는 거부.
    expect(() =>
      selectExportRecords(
        { scope: "everything" } as unknown as ExportScope,
        [],
      ),
    ).toThrow(RangeError);
  });
});

describe("selectExportRecords — scope=full (happy / branch)", () => {
  it("full 은 dateRange/entitySelector 무시하고 모든 record 를 selected 로 분류한다", () => {
    const records = [
      rec("Assessment", "2020-01-01T00:00:00Z"),
      rec("AuditLog", "2099-12-31T00:00:00Z"),
    ];
    const result = selectExportRecords({ scope: "full" }, records);
    expect(result.selected).toEqual(records);
    expect(result.excluded).toEqual([]);
  });

  it("full 은 무관한 dateRange/entitySelector 가 함께 와도 전부 selected", () => {
    const scope: ExportScope = {
      scope: "full",
      dateRange: range,
      entitySelector: ["Person"],
    };
    const records = [rec("Group", "2000-01-01T00:00:00Z")];
    const result = selectExportRecords(scope, records);
    expect(result.selected).toHaveLength(1);
    expect(result.excluded).toHaveLength(0);
  });

  it("빈 records 입력은 빈 분류 결과를 반환한다 (error 아님)", () => {
    const result: ExportSelection = selectExportRecords({ scope: "full" }, []);
    expect(result.selected).toEqual([]);
    expect(result.excluded).toEqual([]);
  });
});

describe("selectExportRecords — scope=range (happy / 반열림 경계)", () => {
  const scope: ExportScope = { scope: "range", dateRange: range };

  it("range [start, end) 안/밖/경계가 섞인 목록을 순서 보존하며 분류한다", () => {
    const before = rec("Assessment", "2026-06-09T23:59:59Z"); // start 직전 → excluded
    const atStart = rec("Assessment", "2026-06-10T00:00:00Z"); // start 동일 → selected
    const middle = rec("Assessment", "2026-06-11T12:00:00Z"); // 내부 → selected
    const atEnd = rec("Assessment", "2026-06-12T00:00:00Z"); // end 동일 → excluded(배타)
    const after = rec("Assessment", "2026-06-13T00:00:00Z"); // end 이후 → excluded

    const result = selectExportRecords(scope, [
      before,
      atStart,
      middle,
      atEnd,
      after,
    ]);
    expect(result.selected).toEqual([atStart, middle]);
    expect(result.excluded).toEqual([before, atEnd, after]);
    expect(result.selected.length + result.excluded.length).toBe(5);
  });

  it("instant === dateRange.start 는 selected 다 (start 포함)", () => {
    const result = selectExportRecords(scope, [
      rec("Person", "2026-06-10T00:00:00Z"),
    ]);
    expect(result.selected).toHaveLength(1);
    expect(result.excluded).toHaveLength(0);
  });

  it("instant === dateRange.end 는 excluded 다 (end 배타)", () => {
    const result = selectExportRecords(scope, [
      rec("Person", "2026-06-12T00:00:00Z"),
    ]);
    expect(result.selected).toHaveLength(0);
    expect(result.excluded).toHaveLength(1);
  });

  it("end 보다 1ms 이른 instant 는 selected 다 (배타 경계 직전)", () => {
    const result = selectExportRecords(scope, [
      rec("Group", "2026-06-11T23:59:59.999Z"),
    ]);
    expect(result.selected).toHaveLength(1);
  });
});

describe("selectExportRecords — scope=partial (happy / branch)", () => {
  it("partial 은 entitySelector 에 든 entity 의 record 만 selected", () => {
    const scope: ExportScope = {
      scope: "partial",
      entitySelector: ["Assessment", "AuditLog"],
    };
    const a = rec("Assessment", "2026-06-11T00:00:00Z");
    const p = rec("Person", "2026-06-11T00:00:00Z");
    const log = rec("AuditLog", "2026-06-11T00:00:00Z");
    const result = selectExportRecords(scope, [a, p, log]);
    expect(result.selected).toEqual([a, log]); // 입력 순서 보존
    expect(result.excluded).toEqual([p]);
  });

  it("entitySelector 에 없는 entity 만 있는 records 는 전부 excluded", () => {
    const scope: ExportScope = {
      scope: "partial",
      entitySelector: ["LlmConfig"],
    };
    const records = [
      rec("Assessment", "2026-06-11T00:00:00Z"),
      rec("Group", "2026-06-11T00:00:00Z"),
    ];
    const result = selectExportRecords(scope, records);
    expect(result.selected).toEqual([]);
    expect(result.excluded).toEqual(records);
  });
});

describe("selectExportRecords — scope=range + entitySelector AND (§6.1 분기 backup)", () => {
  it("range 안 AND entitySelector 포함 둘 다 만족해야 selected", () => {
    const scope: ExportScope = {
      scope: "range",
      dateRange: range,
      entitySelector: ["Assessment"],
    };
    const inRangeMatch = rec("Assessment", "2026-06-11T00:00:00Z"); // 둘 다 만족 → selected
    const inRangeOther = rec("AuditLog", "2026-06-11T00:00:00Z"); // entity 불일치 → excluded
    const outRangeMatch = rec("Assessment", "2026-06-01T00:00:00Z"); // range 밖 → excluded
    const result = selectExportRecords(scope, [
      inRangeMatch,
      inRangeOther,
      outRangeMatch,
    ]);
    expect(result.selected).toEqual([inRangeMatch]);
    expect(result.excluded).toEqual([inRangeOther, outRangeMatch]);
  });

  it("range + 빈 entitySelector 는 entity 제약 없이 dateRange 만으로 분류한다", () => {
    const scope: ExportScope = {
      scope: "range",
      dateRange: range,
      entitySelector: [],
    };
    const inRange = rec("AuditLog", "2026-06-11T00:00:00Z");
    const outRange = rec("AuditLog", "2026-06-20T00:00:00Z");
    const result = selectExportRecords(scope, [inRange, outRange]);
    expect(result.selected).toEqual([inRange]);
    expect(result.excluded).toEqual([outRange]);
  });
});

describe("selectExportRecords — non-mutating", () => {
  it("입력 배열의 순서/내용을 변형하지 않고 새 배열을 반환한다", () => {
    const inputArr = [
      rec("Assessment", "2026-06-11T00:00:00Z"),
      rec("Person", "2026-06-09T00:00:00Z"),
    ];
    const snapshot = [...inputArr];
    const result = selectExportRecords({ scope: "full" }, inputArr);
    expect(inputArr).toEqual(snapshot);
    expect(inputArr).toHaveLength(2);
    expect(result.selected).not.toBe(inputArr);
    expect(result.excluded).not.toBe(inputArr);
  });

  it("freeze 된 입력 배열로 호출해도 변형 없이 통과한다", () => {
    const frozen = Object.freeze([
      rec("Assessment", "2026-06-11T00:00:00Z"),
      rec("Group", "2026-06-13T00:00:00Z"),
    ]);
    const scope: ExportScope = { scope: "range", dateRange: range };
    expect(() => selectExportRecords(scope, frozen)).not.toThrow();
    const result = selectExportRecords(scope, frozen);
    expect(result.selected).toHaveLength(1);
    expect(result.excluded).toHaveLength(1);
  });
});

describe("selectExportRecords — error path (RangeError: scope)", () => {
  it("scope 값이 허용 외 문자열이면 RangeError", () => {
    const bad = { scope: "everything" } as unknown as ExportScope;
    expect(() => selectExportRecords(bad, [])).toThrow(RangeError);
  });

  it("scope 객체가 null 이면 RangeError", () => {
    expect(() =>
      selectExportRecords(null as unknown as ExportScope, []),
    ).toThrow(RangeError);
  });
});

describe("selectExportRecords — error path (RangeError: range/partial 필수 옵션)", () => {
  it("scope=range 인데 dateRange 부재 시 RangeError", () => {
    expect(() => selectExportRecords({ scope: "range" }, [])).toThrow(
      RangeError,
    );
  });

  it("scope=partial 인데 entitySelector 부재 시 RangeError", () => {
    expect(() => selectExportRecords({ scope: "partial" }, [])).toThrow(
      RangeError,
    );
  });

  it("scope=partial 인데 entitySelector 가 빈 배열이면 RangeError (모호 상태 거부)", () => {
    expect(() =>
      selectExportRecords({ scope: "partial", entitySelector: [] }, []),
    ).toThrow(RangeError);
  });
});

describe("selectExportRecords — error path (RangeError: dateRange 역전/빈 구간)", () => {
  it("dateRange.start === end (빈 구간) 면 RangeError", () => {
    const bad: ExportScope = {
      scope: "range",
      dateRange: {
        start: d("2026-06-10T00:00:00Z"),
        end: d("2026-06-10T00:00:00Z"),
      },
    };
    expect(() => selectExportRecords(bad, [])).toThrow(RangeError);
  });

  it("dateRange.start > end (역전) 면 RangeError", () => {
    const bad: ExportScope = {
      scope: "range",
      dateRange: {
        start: d("2026-06-12T00:00:00Z"),
        end: d("2026-06-10T00:00:00Z"),
      },
    };
    expect(() => selectExportRecords(bad, [])).toThrow(RangeError);
  });
});

describe("selectExportRecords — error path (TypeError: dateRange 비-Date)", () => {
  it("dateRange.start 가 비-Date 면 TypeError", () => {
    const bad = {
      scope: "range",
      dateRange: { start: "2026-06-10" as unknown as Date, end: range.end },
    } as ExportScope;
    expect(() => selectExportRecords(bad, [])).toThrow(TypeError);
  });

  it("dateRange.end 가 Invalid Date 면 TypeError", () => {
    const bad: ExportScope = {
      scope: "range",
      dateRange: { start: range.start, end: new Date("nope") },
    };
    expect(() => selectExportRecords(bad, [])).toThrow(TypeError);
  });
});

describe("selectExportRecords — error path (TypeError: records / instant)", () => {
  const scope: ExportScope = { scope: "full" };

  it("records 가 배열이 아니면(null) TypeError", () => {
    expect(() =>
      selectExportRecords(scope, null as unknown as ExportRecord[]),
    ).toThrow(TypeError);
  });

  it("records 가 배열이 아니면(객체) TypeError", () => {
    expect(() =>
      selectExportRecords(scope, {} as unknown as ExportRecord[]),
    ).toThrow(TypeError);
  });

  it("record.instant 가 Invalid Date 면 그 index 를 메시지에 담아 TypeError", () => {
    const arr = [
      rec("Assessment", "2026-06-11T00:00:00Z"),
      { entity: "Person", instant: new Date("nope") } as ExportRecord,
    ];
    expect(() => selectExportRecords(scope, arr)).toThrow(/records\[1\]/);
    expect(() => selectExportRecords(scope, arr)).toThrow(TypeError);
  });

  it("record.instant 가 비-Date(문자열) 면 TypeError", () => {
    const arr = [
      { entity: "Group", instant: "2026-06-11" as unknown as Date },
    ] as ExportRecord[];
    expect(() => selectExportRecords(scope, arr)).toThrow(TypeError);
  });

  it("record.instant 가 NaN timestamp(Invalid Date) 면 TypeError", () => {
    const arr = [
      { entity: "AuditLog", instant: new Date(NaN) } as ExportRecord,
    ];
    expect(() => selectExportRecords(scope, arr)).toThrow(TypeError);
  });
});

describe("selectExportRecords — negative cases 충분 cover (경계값/특이 instant)", () => {
  const scope: ExportScope = { scope: "range", dateRange: range };

  it("Infinity timestamp instant 는 Invalid Date 로 TypeError", () => {
    const arr = [
      { entity: "Assessment", instant: new Date(Infinity) } as ExportRecord,
    ];
    expect(() => selectExportRecords(scope, arr)).toThrow(TypeError);
  });

  it("음수 timestamp instant(1970 이전) 는 정상 Date 로 분류된다 (range 밖 → excluded)", () => {
    const negative: ExportRecord = {
      entity: "Person",
      instant: new Date(-1000),
    };
    const result = selectExportRecords(scope, [negative]);
    expect(result.excluded).toEqual([negative]);
    expect(result.selected).toEqual([]);
  });

  it("range 안 음수 timestamp 도 selected 로 정상 분류 (반열림 비교는 부호 무관)", () => {
    const wideRange: ExportScope = {
      scope: "range",
      dateRange: { start: new Date(-2000), end: new Date(2000) },
    };
    const at = rec("Group", "1970-01-01T00:00:00.000Z"); // t=0, [-2000, 2000) 안
    const result = selectExportRecords(wideRange, [at]);
    expect(result.selected).toEqual([at]);
  });
});
