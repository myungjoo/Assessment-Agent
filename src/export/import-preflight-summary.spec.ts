// import-preflight-summary.spec — summarizeImportPreflight(T-0452) 의 R-112 4 종(happy / error /
// flow / negative 충분) cover. UC-07 §7.4 transaction 전 go/no-go 통합 정합 + non-mutating + 입력
// 방어 + proceed === (blockingIssues.length === 0) 불변 + blocking/warning 누적을 단언한다.
// 신규 파일 line/branch/func 100% 목표.
import { DumpChecksumVerification } from "./export-dump-checksum";
import { ImportDumpSizeVerdict } from "./import-dump-size-validate";
import { ImportDumpValidation } from "./import-dump-validate";
import { ImportMergeConflictReport } from "./import-merge-conflict";
import {
  ImportPreflightVerdicts,
  summarizeImportPreflight,
} from "./import-preflight-summary";
import { SchemaVersionCompat } from "./schema-version-compat";

// 정상 sub-verdict factory — 전부 valid + version accept. 개별 override 로 분기를 만든다.
function okStructure(): ImportDumpValidation {
  return { valid: true, issues: [] };
}
function okSize(): ImportDumpSizeVerdict {
  return {
    valid: true,
    errors: [],
    totals: {
      total: 0,
      perEntity: {
        Assessment: 0,
        Person: 0,
        Group: 0,
        LlmConfig: 0,
        AuditLog: 0,
      },
    },
  };
}
function okChecksum(): DumpChecksumVerification {
  return { valid: true, computed: "abc", expected: "abc" };
}
function acceptVersion(): SchemaVersionCompat {
  return {
    compatible: true,
    action: "accept",
    uploadedVersion: "1.0.0",
    currentVersion: "1.0.0",
  };
}
function migrateVersion(): SchemaVersionCompat {
  return {
    compatible: false,
    action: "migrate",
    uploadedVersion: "0.9.0",
    currentVersion: "1.0.0",
    reason: "0.9.0→1.0.0 자동 migration 후보",
  };
}
function rejectVersion(): SchemaVersionCompat {
  return {
    compatible: false,
    action: "reject",
    uploadedVersion: "0.8.0",
    currentVersion: "1.0.0",
    reason: "schema version mismatch: 0.8.0 ≠ 1.0.0",
  };
}
function conflictReport(total: number): ImportMergeConflictReport {
  return {
    hasConflict: total > 0,
    conflicts: [],
    perEntity: {
      Assessment: 0,
      Person: 0,
      Group: 0,
      LlmConfig: 0,
      AuditLog: 0,
    },
    total,
  };
}

// 전부 통과 + version accept + mergeConflict 부재(replace mode)의 base 묶음.
function okVerdicts(): ImportPreflightVerdicts {
  return {
    structure: okStructure(),
    version: acceptVersion(),
    size: okSize(),
    checksum: okChecksum(),
  };
}

describe("summarizeImportPreflight", () => {
  // ----- happy path -----
  describe("happy path", () => {
    it("4 verdict valid + version accept + mergeConflict 부재 → proceed true, 누적 빈 배열", () => {
      const report = summarizeImportPreflight(okVerdicts());

      expect(report.proceed).toBe(true);
      expect(report.blockingIssues).toEqual([]);
      expect(report.warnings).toEqual([]);
      expect(report.summary).toBe("사전 검증 통과");
    });

    it("merge mode 에서 mergeConflict.hasConflict false → proceed true, warning 0", () => {
      const report = summarizeImportPreflight({
        ...okVerdicts(),
        mergeConflict: conflictReport(0),
      });

      expect(report.proceed).toBe(true);
      expect(report.warnings).toEqual([]);
      expect(report.summary).toBe("사전 검증 통과");
    });
  });

  // ----- blocking 분기 4 종 (각 1+) -----
  describe("blocking 분기", () => {
    it("structure invalid → proceed false + blockingIssues 1건", () => {
      const report = summarizeImportPreflight({
        ...okVerdicts(),
        structure: { valid: false, issues: ["x"] },
      });

      expect(report.proceed).toBe(false);
      expect(report.blockingIssues).toHaveLength(1);
      expect(report.blockingIssues[0]).toContain("structure invalid");
      expect(report.summary).toBe("사전 검증 실패 (차단 1건)");
    });

    it("size invalid → proceed false + blockingIssues 1건", () => {
      const report = summarizeImportPreflight({
        ...okVerdicts(),
        size: { ...okSize(), valid: false },
      });

      expect(report.proceed).toBe(false);
      expect(report.blockingIssues[0]).toContain("size invalid");
    });

    it("checksum invalid → proceed false + blockingIssues 1건", () => {
      const report = summarizeImportPreflight({
        ...okVerdicts(),
        checksum: { valid: false, computed: "a", expected: "b" },
      });

      expect(report.proceed).toBe(false);
      expect(report.blockingIssues[0]).toContain("checksum invalid");
    });

    it("version reject → proceed false + reason 을 메시지에 포함", () => {
      const report = summarizeImportPreflight({
        ...okVerdicts(),
        version: rejectVersion(),
      });

      expect(report.proceed).toBe(false);
      expect(report.blockingIssues[0]).toContain("version reject");
      expect(report.blockingIssues[0]).toContain("0.8.0 ≠ 1.0.0");
    });

    it("version reject 인데 reason 없음 → 메시지에 reason 미부착(분기 cover)", () => {
      const report = summarizeImportPreflight({
        ...okVerdicts(),
        version: {
          compatible: false,
          action: "reject",
          uploadedVersion: "0.8.0",
          currentVersion: "1.0.0",
        },
      });

      expect(report.blockingIssues[0]).toBe(
        "schema version 호환 불가 (version reject)",
      );
    });
  });

  // ----- warning 분기 2 종 (각 1+) -----
  describe("warning 분기", () => {
    it("version migrate → proceed true + warning 1건 + reason 포함", () => {
      const report = summarizeImportPreflight({
        ...okVerdicts(),
        version: migrateVersion(),
      });

      expect(report.proceed).toBe(true);
      expect(report.warnings).toHaveLength(1);
      expect(report.warnings[0]).toContain("version migrate");
      expect(report.warnings[0]).toContain("migration 후보");
      expect(report.summary).toBe("사전 검증 통과 (경고 1건)");
    });

    it("version migrate 인데 reason 없음 → reason 미부착(분기 cover)", () => {
      const report = summarizeImportPreflight({
        ...okVerdicts(),
        version: {
          compatible: false,
          action: "migrate",
          uploadedVersion: "0.9.0",
          currentVersion: "1.0.0",
        },
      });

      expect(report.warnings[0]).toBe(
        "schema version 자동 migration 후보 (version migrate)",
      );
    });

    it("mergeConflict.hasConflict true → proceed true + warning 에 충돌 건수 포함", () => {
      const report = summarizeImportPreflight({
        ...okVerdicts(),
        mergeConflict: conflictReport(3),
      });

      expect(report.proceed).toBe(true);
      expect(report.warnings).toHaveLength(1);
      expect(report.warnings[0]).toContain("3건");
    });

    it("mergeConflict.hasConflict true 이나 total 비-number → 0건으로 표기(방어 분기)", () => {
      const report = summarizeImportPreflight({
        ...okVerdicts(),
        mergeConflict: {
          ...conflictReport(2),
          total: undefined as unknown as number,
        },
      });

      expect(report.warnings[0]).toContain("0건");
    });
  });

  // ----- blocking + warning 동시 + 다중 누적 (negative 충분) -----
  describe("동시·다중 누적", () => {
    it("blocking + warning 동시 → proceed false, summary 는 차단 우선", () => {
      const report = summarizeImportPreflight({
        ...okVerdicts(),
        size: { ...okSize(), valid: false },
        mergeConflict: conflictReport(1),
      });

      expect(report.proceed).toBe(false);
      expect(report.blockingIssues).toHaveLength(1);
      expect(report.warnings).toHaveLength(1);
      expect(report.summary).toBe("사전 검증 실패 (차단 1건)");
    });

    it("여러 verdict 동시 invalid → blockingIssues 다중 누적 (즉시 throw 0)", () => {
      const report = summarizeImportPreflight({
        structure: { valid: false, issues: ["s"] },
        version: rejectVersion(),
        size: { ...okSize(), valid: false },
        checksum: { valid: false, computed: "a", expected: "b" },
      });

      expect(report.proceed).toBe(false);
      expect(report.blockingIssues).toHaveLength(4);
      expect(report.summary).toBe("사전 검증 실패 (차단 4건)");
    });

    it("proceed === (blockingIssues.length === 0) 불변 — blocking 존재 시 false", () => {
      const report = summarizeImportPreflight({
        ...okVerdicts(),
        checksum: { valid: false, computed: "a", expected: "b" },
      });

      expect(report.proceed).toBe(report.blockingIssues.length === 0);
    });
  });

  // ----- mergeConflict 부재 vs 제공 양 분기 -----
  describe("mergeConflict 부재 vs 제공", () => {
    it("replace mode(mergeConflict 부재) → warning 누적 0", () => {
      const report = summarizeImportPreflight(okVerdicts());
      expect(report.warnings).toEqual([]);
    });

    it("merge mode(mergeConflict 제공·충돌) → warning 누적", () => {
      const report = summarizeImportPreflight({
        ...okVerdicts(),
        mergeConflict: conflictReport(5),
      });
      expect(report.warnings).toHaveLength(1);
    });
  });

  // ----- error path (negative 충분) -----
  describe("error path", () => {
    it("verdicts 가 null → TypeError", () => {
      expect(() =>
        summarizeImportPreflight(null as unknown as ImportPreflightVerdicts),
      ).toThrow(TypeError);
    });

    it("verdicts 가 undefined → TypeError", () => {
      expect(() =>
        summarizeImportPreflight(
          undefined as unknown as ImportPreflightVerdicts,
        ),
      ).toThrow(/verdicts 는 object 여야 합니다/);
    });

    it("verdicts 가 배열 → TypeError", () => {
      expect(() =>
        summarizeImportPreflight([] as unknown as ImportPreflightVerdicts),
      ).toThrow(/array/);
    });

    it("structure 부재 → TypeError(structure 명시)", () => {
      expect(() =>
        summarizeImportPreflight({
          ...okVerdicts(),
          structure: undefined as unknown as ImportDumpValidation,
        }),
      ).toThrow(/structure verdict 는 object/);
    });

    it("version 부재 → TypeError(version 명시)", () => {
      expect(() =>
        summarizeImportPreflight({
          ...okVerdicts(),
          version: undefined as unknown as SchemaVersionCompat,
        }),
      ).toThrow(/version verdict 는 object/);
    });

    it("size 부재 → TypeError(size 명시)", () => {
      expect(() =>
        summarizeImportPreflight({
          ...okVerdicts(),
          size: undefined as unknown as ImportDumpSizeVerdict,
        }),
      ).toThrow(/size verdict 는 object/);
    });

    it("checksum 부재 → TypeError(checksum 명시)", () => {
      expect(() =>
        summarizeImportPreflight({
          ...okVerdicts(),
          checksum: undefined as unknown as DumpChecksumVerification,
        }),
      ).toThrow(/checksum verdict 는 object/);
    });

    it("structure.valid 가 비-boolean → TypeError", () => {
      expect(() =>
        summarizeImportPreflight({
          ...okVerdicts(),
          structure: {
            valid: "yes" as unknown as boolean,
            issues: [],
          },
        }),
      ).toThrow(/structure\.valid 은\(는\) boolean/);
    });

    it("size.valid 가 비-boolean → TypeError", () => {
      expect(() =>
        summarizeImportPreflight({
          ...okVerdicts(),
          size: { ...okSize(), valid: 1 as unknown as boolean },
        }),
      ).toThrow(/size\.valid 은\(는\) boolean/);
    });

    it("checksum.valid 가 비-boolean → TypeError", () => {
      expect(() =>
        summarizeImportPreflight({
          ...okVerdicts(),
          checksum: {
            valid: null as unknown as boolean,
            computed: "a",
            expected: "a",
          },
        }),
      ).toThrow(/checksum\.valid 은\(는\) boolean/);
    });

    it("version.action 이 미허용 enum → TypeError", () => {
      expect(() =>
        summarizeImportPreflight({
          ...okVerdicts(),
          version: {
            ...acceptVersion(),
            action: "skip" as unknown as SchemaVersionCompat["action"],
          },
        }),
      ).toThrow(/version\.action/);
    });

    it("version.action 이 비-string → TypeError", () => {
      expect(() =>
        summarizeImportPreflight({
          ...okVerdicts(),
          version: {
            ...acceptVersion(),
            action: 3 as unknown as SchemaVersionCompat["action"],
          },
        }),
      ).toThrow(/version\.action/);
    });

    it("sub-verdict 가 string(비-object) → TypeError", () => {
      expect(() =>
        summarizeImportPreflight({
          ...okVerdicts(),
          structure: "ok" as unknown as ImportDumpValidation,
        }),
      ).toThrow(/structure verdict 는 object/);
    });

    it("sub-verdict 가 number(비-object) → TypeError", () => {
      expect(() =>
        summarizeImportPreflight({
          ...okVerdicts(),
          size: 5 as unknown as ImportDumpSizeVerdict,
        }),
      ).toThrow(/size verdict 는 object/);
    });

    it("sub-verdict 가 배열(비-object) → TypeError(array 명시)", () => {
      expect(() =>
        summarizeImportPreflight({
          ...okVerdicts(),
          checksum: [] as unknown as DumpChecksumVerification,
        }),
      ).toThrow(/checksum verdict 는 object .*array/);
    });

    it("sub-verdict 가 null(비-object) → TypeError(null 명시)", () => {
      expect(() =>
        summarizeImportPreflight({
          ...okVerdicts(),
          structure: null as unknown as ImportDumpValidation,
        }),
      ).toThrow(/structure verdict 는 object .*null/);
    });

    it("mergeConflict 제공됐으나 비-object → TypeError", () => {
      expect(() =>
        summarizeImportPreflight({
          ...okVerdicts(),
          mergeConflict: "x" as unknown as ImportMergeConflictReport,
        }),
      ).toThrow(/mergeConflict verdict 는 object/);
    });

    it("mergeConflict 제공됐으나 hasConflict 비-boolean → TypeError", () => {
      expect(() =>
        summarizeImportPreflight({
          ...okVerdicts(),
          mergeConflict: {
            ...conflictReport(0),
            hasConflict: "no" as unknown as boolean,
          },
        }),
      ).toThrow(/mergeConflict\.hasConflict 은\(는\) boolean/);
    });
  });

  // ----- non-mutating (freeze 입력) -----
  describe("non-mutating", () => {
    it("freeze 된 입력 verdict 로 호출해도 통과 + 입력 미변형", () => {
      const verdicts: ImportPreflightVerdicts = {
        structure: Object.freeze(okStructure()),
        version: Object.freeze(acceptVersion()),
        size: Object.freeze(okSize()),
        checksum: Object.freeze(okChecksum()),
        mergeConflict: Object.freeze(conflictReport(2)),
      };
      Object.freeze(verdicts);

      const report = summarizeImportPreflight(verdicts);

      expect(report.proceed).toBe(true);
      expect(report.warnings).toHaveLength(1);
      // 반환은 새 객체 — 입력 어느 것과도 참조 공유 0.
      expect(report.blockingIssues).not.toBe(verdicts.structure.issues);
    });
  });
});
