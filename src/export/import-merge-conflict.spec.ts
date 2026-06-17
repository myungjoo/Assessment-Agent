// import-merge-conflict.spec — detectImportMergeConflicts(T-0451) 의 R-112 4 종(happy / error /
// flow / negative 충분) cover. UC-07 §6.2 merge 충돌 검출·보고 정합 + non-mutating + 입력 방어
// + perEntity/total 산출 + 입력 순서 보존을 단언한다. 신규 파일 line/branch/func 100% 목표.
import { ExportEntity, ExportRecord } from "./export-scope-select";
import {
  detectImportMergeConflicts,
  ImportMergeConflictReport,
} from "./import-merge-conflict";

// 테스트 record 생성 helper — entity + epoch millis 로 ExportRecord 를 만든다.
function rec(entity: ExportEntity, millis: number): ExportRecord {
  return { entity, instant: new Date(millis) };
}

// perEntity 가 5 entity 전부 key 를 갖는지 + 기대값 매칭 단언.
function expectPerEntity(
  report: ImportMergeConflictReport,
  expected: Partial<Record<ExportEntity, number>>,
): void {
  const base: Record<ExportEntity, number> = {
    Assessment: 0,
    Person: 0,
    Group: 0,
    LlmConfig: 0,
    AuditLog: 0,
  };
  expect(report.perEntity).toEqual({ ...base, ...expected });
}

describe("detectImportMergeConflicts", () => {
  // ---- happy-path ----
  describe("happy-path", () => {
    it("(a) existing/incoming key 완전 disjoint → hasConflict=false, conflicts 빈 배열, total=0", () => {
      const existing = [rec("Assessment", 1000), rec("Person", 2000)];
      const incoming = [rec("Group", 3000), rec("LlmConfig", 4000)];
      const report = detectImportMergeConflicts(existing, incoming);
      expect(report.hasConflict).toBe(false);
      expect(report.conflicts).toEqual([]);
      expect(report.total).toBe(0);
      expectPerEntity(report, {});
    });

    it("(b) 단일 충돌(한 key 가 양쪽에 1건씩) → conflicts 1 + perEntity 정확 + count=1", () => {
      const existing = [rec("Assessment", 1000), rec("Person", 9000)];
      const incoming = [rec("Assessment", 1000), rec("Group", 5000)];
      const report = detectImportMergeConflicts(existing, incoming);
      expect(report.hasConflict).toBe(true);
      expect(report.total).toBe(1);
      expect(report.conflicts).toHaveLength(1);
      expect(report.conflicts[0].entity).toBe("Assessment");
      expect(report.conflicts[0].instant.getTime()).toBe(1000);
      expect(report.conflicts[0].existingCount).toBe(1);
      expect(report.conflicts[0].incomingCount).toBe(1);
      expectPerEntity(report, { Assessment: 1 });
    });

    it("(c) 빈 existing + 빈 incoming → 충돌 0 정상", () => {
      const report = detectImportMergeConflicts([], []);
      expect(report.hasConflict).toBe(false);
      expect(report.conflicts).toEqual([]);
      expect(report.total).toBe(0);
      expectPerEntity(report, {});
    });
  });

  // ---- error path(충돌 다중 누적 / 중복 count) ----
  describe("conflict 누적·count", () => {
    it("(a) 다중 충돌(2+ key 양쪽 존재) → 다중 누적(throw 0, incoming 입력 순서 보존)", () => {
      const existing = [
        rec("Assessment", 1000),
        rec("Person", 2000),
        rec("Group", 3000),
      ];
      // incoming 순서: Group(3000) → Assessment(1000) → 비충돌 → Person(2000)
      const incoming = [
        rec("Group", 3000),
        rec("Assessment", 1000),
        rec("LlmConfig", 8000),
        rec("Person", 2000),
      ];
      const report = detectImportMergeConflicts(existing, incoming);
      expect(report.total).toBe(3);
      // 입력 순서 보존: Group → Assessment → Person
      expect(report.conflicts.map((c) => c.entity)).toEqual([
        "Group",
        "Assessment",
        "Person",
      ]);
      expectPerEntity(report, { Assessment: 1, Person: 1, Group: 1 });
    });

    it("(b) 같은 key 가 incoming 에 여러 건 → incomingCount > 1 정확", () => {
      const existing = [rec("Assessment", 1000)];
      const incoming = [
        rec("Assessment", 1000),
        rec("Assessment", 1000),
        rec("Assessment", 1000),
      ];
      const report = detectImportMergeConflicts(existing, incoming);
      expect(report.total).toBe(1);
      expect(report.conflicts[0].incomingCount).toBe(3);
      expect(report.conflicts[0].existingCount).toBe(1);
    });

    it("(c) 같은 key 가 existing 에 여러 건 → existingCount > 1 정확", () => {
      const existing = [rec("Person", 2000), rec("Person", 2000)];
      const incoming = [rec("Person", 2000)];
      const report = detectImportMergeConflicts(existing, incoming);
      expect(report.total).toBe(1);
      expect(report.conflicts[0].existingCount).toBe(2);
      expect(report.conflicts[0].incomingCount).toBe(1);
    });
  });

  // ---- flow / branch ----
  describe("flow / branch", () => {
    it("빈 existing(incoming 만) → 충돌 0", () => {
      const report = detectImportMergeConflicts([], [rec("Assessment", 1000)]);
      expect(report.hasConflict).toBe(false);
      expect(report.total).toBe(0);
    });

    it("빈 incoming(existing 만) → 충돌 0", () => {
      const report = detectImportMergeConflicts([rec("Assessment", 1000)], []);
      expect(report.hasConflict).toBe(false);
      expect(report.total).toBe(0);
    });

    it("같은 instant 다른 entity → 충돌 아님(entity 까지 일치해야 충돌)", () => {
      const existing = [rec("Assessment", 1000)];
      const incoming = [rec("Person", 1000)];
      const report = detectImportMergeConflicts(existing, incoming);
      expect(report.hasConflict).toBe(false);
      expect(report.total).toBe(0);
    });

    it("같은 entity 다른 instant → 충돌 아님", () => {
      const existing = [rec("Assessment", 1000)];
      const incoming = [rec("Assessment", 2000)];
      const report = detectImportMergeConflicts(existing, incoming);
      expect(report.hasConflict).toBe(false);
      expect(report.total).toBe(0);
    });

    it("5 entity 각각 충돌 분기 각 1+ — 전 entity 충돌", () => {
      const entities: ExportEntity[] = [
        "Assessment",
        "Person",
        "Group",
        "LlmConfig",
        "AuditLog",
      ];
      const existing = entities.map((e, i) => rec(e, 1000 + i));
      const incoming = entities.map((e, i) => rec(e, 1000 + i));
      const report = detectImportMergeConflicts(existing, incoming);
      expect(report.total).toBe(5);
      expectPerEntity(report, {
        Assessment: 1,
        Person: 1,
        Group: 1,
        LlmConfig: 1,
        AuditLog: 1,
      });
    });

    it("충돌과 비충돌이 섞인 입력 → 충돌만 박제", () => {
      const existing = [rec("Assessment", 1000), rec("Person", 2000)];
      const incoming = [
        rec("Assessment", 1000), // 충돌
        rec("Group", 7000), // 비충돌(신규)
        rec("Person", 9999), // 비충돌(entity 같으나 instant 다름)
      ];
      const report = detectImportMergeConflicts(existing, incoming);
      expect(report.total).toBe(1);
      expect(report.conflicts[0].entity).toBe("Assessment");
    });

    it("같은 instant millis boundary(밀리초 단위 동등성)", () => {
      const existing = [rec("Group", 1700000000000)];
      const incoming = [
        rec("Group", 1700000000000),
        rec("Group", 1700000000001),
      ];
      const report = detectImportMergeConflicts(existing, incoming);
      expect(report.total).toBe(1);
      expect(report.conflicts[0].instant.getTime()).toBe(1700000000000);
    });

    it("대량 record(같은 key 중복 다수) → count 정확", () => {
      const existing = Array.from({ length: 50 }, () => rec("AuditLog", 5000));
      const incoming = Array.from({ length: 30 }, () => rec("AuditLog", 5000));
      const report = detectImportMergeConflicts(existing, incoming);
      expect(report.total).toBe(1);
      expect(report.conflicts[0].existingCount).toBe(50);
      expect(report.conflicts[0].incomingCount).toBe(30);
    });
  });

  // ---- non-mutating ----
  describe("non-mutating", () => {
    it("freeze 된 existing/incoming 으로 호출해도 통과 + 입력 변형 0", () => {
      const eRec = rec("Assessment", 1000);
      const iRec = rec("Assessment", 1000);
      const existing = Object.freeze([
        Object.freeze(eRec),
      ]) as ReadonlyArray<ExportRecord>;
      const incoming = Object.freeze([
        Object.freeze(iRec),
      ]) as ReadonlyArray<ExportRecord>;
      const report = detectImportMergeConflicts(existing, incoming);
      expect(report.total).toBe(1);
      // 입력 배열 길이·원소 instant 불변.
      expect(existing).toHaveLength(1);
      expect(incoming).toHaveLength(1);
      expect(eRec.instant.getTime()).toBe(1000);
      // 반환 instant 는 incoming 입력 Date 참조(입력 변형 0).
      expect(report.conflicts[0].instant).toBe(iRec.instant);
    });

    it("반환 perEntity 는 새 객체 — 호출마다 독립", () => {
      const r1 = detectImportMergeConflicts([], []);
      const r2 = detectImportMergeConflicts([], []);
      expect(r1.perEntity).not.toBe(r2.perEntity);
    });
  });

  // ---- negative cases 충분 cover ----
  describe("negative — 입력 방어", () => {
    it.each([
      ["null", null],
      ["undefined", undefined],
      ["object", {} as unknown],
      ["string", "x" as unknown],
      ["number", 5 as unknown],
    ])(
      "existing 이 비-배열(%s) → TypeError(label existing)",
      (_label, value) => {
        expect(() => detectImportMergeConflicts(value as never, [])).toThrow(
          /existing 는 배열이어야 합니다/,
        );
      },
    );

    it.each([
      ["null", null],
      ["undefined", undefined],
      ["object", {} as unknown],
      ["string", "x" as unknown],
    ])(
      "incoming 이 비-배열(%s) → TypeError(label incoming)",
      (_label, value) => {
        expect(() => detectImportMergeConflicts([], value as never)).toThrow(
          /incoming 는 배열이어야 합니다/,
        );
      },
    );

    it("existing record 원소가 비-object(null) → TypeError(배열·index 박제)", () => {
      expect(() => detectImportMergeConflicts([null as never], [])).toThrow(
        /existing\[0\] 는 object 여야 합니다/,
      );
    });

    it("incoming record 원소가 비-object(string) → TypeError(배열·index 박제)", () => {
      expect(() => detectImportMergeConflicts([], ["x" as never])).toThrow(
        /incoming\[0\] 는 object 여야 합니다/,
      );
    });

    it("record 원소가 array → TypeError(비-object)", () => {
      expect(() => detectImportMergeConflicts([[] as never], [])).toThrow(
        /existing\[0\] 는 object 여야 합니다/,
      );
    });

    it("record instant 가 비-Date(숫자) → TypeError(index 박제)", () => {
      expect(() =>
        detectImportMergeConflicts(
          [{ entity: "Assessment", instant: 1000 } as never],
          [],
        ),
      ).toThrow(/existing\[0\]\.instant/);
    });

    it("record instant 가 Invalid Date → TypeError(index 박제)", () => {
      expect(() =>
        detectImportMergeConflicts(
          [],
          [{ entity: "Person", instant: new Date("nope") } as never],
        ),
      ).toThrow(/incoming\[0\]\.instant/);
    });

    it("entity 가 5 허용 외 값 → perEntity 미반영이되 충돌 key 매칭은 동작", () => {
      const existing = [
        { entity: "Unknown" as ExportEntity, instant: new Date(1000) },
      ];
      const incoming = [
        { entity: "Unknown" as ExportEntity, instant: new Date(1000) },
      ];
      const report = detectImportMergeConflicts(existing, incoming);
      // 충돌 key 매칭은 문자열 동등성으로 동작 → 충돌 1.
      expect(report.total).toBe(1);
      expect(report.hasConflict).toBe(true);
      // perEntity 는 5 허용 entity 만 — Unknown 은 자연 무시.
      expectPerEntity(report, {});
    });
  });
});
