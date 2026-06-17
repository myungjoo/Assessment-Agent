// export-dump-size-estimate.spec — estimateExportDumpSize(T-0466) 단위 test. R-112 4 종 cover:
// happy-path(sync 경로 · async-streaming 경로 · 기대 필드 검증) + error path(입력 방어 TypeError
// 분기마다 — selection/selected/options/bytesPerRecord/byte weight 부적합) + flow/branch(large
// true/false · 빈 selection · 일부 entity weight 만 지정 · 임계 경계 · humanSize B/KB/MB/GB 단위)
// + negative cases 충분 cover(5 허용 외 entity 무시 · large↔recommendation 불변 · non-mutating ·
// 옵션 미지정 default 적용).
import {
  DEFAULT_ASYNC_THRESHOLD_BYTES,
  DEFAULT_BYTES_PER_RECORD,
  estimateExportDumpSize,
  ExportDumpSizeEstimateOptions,
} from "./export-dump-size-estimate";
import {
  ExportEntity,
  ExportRecord,
  ExportSelection,
} from "./export-scope-select";

function rec(entity: ExportEntity): ExportRecord {
  return { entity, instant: new Date("2026-06-17T00:00:00.000Z") };
}

// selection 조립 — selected 만 의미 있고 excluded 는 형식만 채운다(helper 는 selected 만 본다).
function sel(selected: ExportRecord[]): ExportSelection {
  return { selected, excluded: [] };
}

describe("estimateExportDumpSize", () => {
  describe("happy path", () => {
    it("(a) 혼합 entity selection + 옵션 부재 → default weight·threshold 로 sync 추정", () => {
      const selection = sel([rec("Assessment"), rec("Person"), rec("Group")]);
      const result = estimateExportDumpSize(selection);
      // 3 record × 1024 = 3072 byte = 3 KB (10 MB 임계 미만 → sync)
      expect(result.estimatedBytes).toBe(3 * DEFAULT_BYTES_PER_RECORD);
      expect(result.recordTotal).toBe(3);
      expect(result.perEntityBytes.Assessment).toBe(DEFAULT_BYTES_PER_RECORD);
      expect(result.perEntityBytes.Person).toBe(DEFAULT_BYTES_PER_RECORD);
      expect(result.perEntityBytes.Group).toBe(DEFAULT_BYTES_PER_RECORD);
      expect(result.perEntityBytes.LlmConfig).toBe(0);
      expect(result.humanSize).toBe("3 KB");
      expect(result.large).toBe(false);
      expect(result.recommendation).toBe("sync");
      expect(result.guidanceLines.length).toBeGreaterThan(0);
      expect(result.guidanceLines[0]).toContain("동기 다운로드");
    });

    it("(b) 임계 초과(낮은 threshold) → large·async-streaming + long-running 안내", () => {
      const selection = sel([rec("Assessment"), rec("Assessment")]);
      const result = estimateExportDumpSize(selection, {
        asyncThresholdBytes: 1000,
      });
      // 2 × 1024 = 2048 byte > 1000 → large
      expect(result.estimatedBytes).toBe(2048);
      expect(result.large).toBe(true);
      expect(result.recommendation).toBe("async-streaming");
      expect(
        result.guidanceLines.some((line) =>
          line.includes("async job + status polling"),
        ),
      ).toBe(true);
    });

    it("(c) entity 별 byte weight + default fallback 정확 적용", () => {
      const selection = sel([
        rec("Assessment"),
        rec("Assessment"),
        rec("AuditLog"),
      ]);
      const options: ExportDumpSizeEstimateOptions = {
        bytesPerRecord: { Assessment: 500 },
        defaultBytesPerRecord: 100,
      };
      const result = estimateExportDumpSize(selection, options);
      // Assessment 2 × 500 = 1000, AuditLog 1 × default 100 = 100 → 1100
      expect(result.perEntityBytes.Assessment).toBe(1000);
      expect(result.perEntityBytes.AuditLog).toBe(100);
      expect(result.estimatedBytes).toBe(1100);
    });
  });

  describe("error path — 입력 방어 TypeError", () => {
    it("(a) selection 이 null → TypeError(label selection)", () => {
      expect(() =>
        estimateExportDumpSize(null as unknown as ExportSelection),
      ).toThrow(/selection 은 plain object/);
    });

    it("(a2) selection 이 배열 → TypeError(label selection)", () => {
      expect(() =>
        estimateExportDumpSize([] as unknown as ExportSelection),
      ).toThrow(/selection 은 plain object/);
    });

    it("(a3) selection 이 원시값 → TypeError", () => {
      expect(() =>
        estimateExportDumpSize(42 as unknown as ExportSelection),
      ).toThrow(/selection 은 plain object/);
    });

    it("(b) selection.selected 가 배열 아님 → TypeError(label selection.selected)", () => {
      expect(() =>
        estimateExportDumpSize({
          selected: "x",
          excluded: [],
        } as unknown as ExportSelection),
      ).toThrow(/selection\.selected 는 배열/);
    });

    it("(c) options 가 배열 → TypeError(label options)", () => {
      expect(() =>
        estimateExportDumpSize(
          sel([]),
          [] as unknown as ExportDumpSizeEstimateOptions,
        ),
      ).toThrow(/options 는 plain object/);
    });

    it("(c2) options 가 null → TypeError(label options)", () => {
      expect(() =>
        estimateExportDumpSize(
          sel([]),
          null as unknown as ExportDumpSizeEstimateOptions,
        ),
      ).toThrow(/options 는 plain object/);
    });

    it("(d) bytesPerRecord 가 비-object(원시값) → TypeError", () => {
      expect(() =>
        estimateExportDumpSize(sel([]), {
          bytesPerRecord: 5 as unknown as Record<ExportEntity, number>,
        }),
      ).toThrow(/bytesPerRecord 는 entity/);
    });

    it("(d2) bytesPerRecord 가 배열 → TypeError", () => {
      expect(() =>
        estimateExportDumpSize(sel([]), {
          bytesPerRecord: [] as unknown as Record<ExportEntity, number>,
        }),
      ).toThrow(/bytesPerRecord 는 entity/);
    });

    it("(e) bytesPerRecord entity weight 가 음수 → TypeError(entity 박제)", () => {
      expect(() =>
        estimateExportDumpSize(sel([]), {
          bytesPerRecord: { Assessment: -1 },
        }),
      ).toThrow(/bytesPerRecord\.Assessment 는 0 이상의 정수/);
    });

    it("(e2) bytesPerRecord entity weight 가 소수 → TypeError", () => {
      expect(() =>
        estimateExportDumpSize(sel([]), {
          bytesPerRecord: { Person: 1.5 },
        }),
      ).toThrow(/bytesPerRecord\.Person 는 0 이상의 정수/);
    });

    it("(e3) bytesPerRecord entity weight 가 NaN → TypeError", () => {
      expect(() =>
        estimateExportDumpSize(sel([]), {
          bytesPerRecord: { Group: Number.NaN },
        }),
      ).toThrow(/bytesPerRecord\.Group 는 0 이상의 정수/);
    });

    it("(e4) bytesPerRecord entity weight 가 Infinity → TypeError", () => {
      expect(() =>
        estimateExportDumpSize(sel([]), {
          bytesPerRecord: { LlmConfig: Number.POSITIVE_INFINITY },
        }),
      ).toThrow(/bytesPerRecord\.LlmConfig 는 0 이상의 정수/);
    });

    it("(e5) bytesPerRecord entity weight 가 비-number(string) → TypeError", () => {
      expect(() =>
        estimateExportDumpSize(sel([]), {
          bytesPerRecord: {
            AuditLog: "100" as unknown as number,
          },
        }),
      ).toThrow(/bytesPerRecord\.AuditLog 는 0 이상의 정수/);
    });

    it("(f) defaultBytesPerRecord 가 음수 → TypeError", () => {
      expect(() =>
        estimateExportDumpSize(sel([]), { defaultBytesPerRecord: -5 }),
      ).toThrow(/defaultBytesPerRecord 는 0 이상의 정수/);
    });

    it("(f2) defaultBytesPerRecord 가 NaN → TypeError", () => {
      expect(() =>
        estimateExportDumpSize(sel([]), {
          defaultBytesPerRecord: Number.NaN,
        }),
      ).toThrow(/defaultBytesPerRecord 는 0 이상의 정수/);
    });

    it("(g) asyncThresholdBytes 가 소수 → TypeError", () => {
      expect(() =>
        estimateExportDumpSize(sel([]), { asyncThresholdBytes: 1.2 }),
      ).toThrow(/asyncThresholdBytes 는 0 이상의 정수/);
    });

    it("(g2) asyncThresholdBytes 가 Infinity → TypeError", () => {
      expect(() =>
        estimateExportDumpSize(sel([]), {
          asyncThresholdBytes: Number.POSITIVE_INFINITY,
        }),
      ).toThrow(/asyncThresholdBytes 는 0 이상의 정수/);
    });
  });

  describe("flow / branch 분리", () => {
    it("(a) large=false 분기 — 임계 미만 → sync", () => {
      const result = estimateExportDumpSize(sel([rec("Person")]), {
        asyncThresholdBytes: 10000,
      });
      expect(result.large).toBe(false);
      expect(result.recommendation).toBe("sync");
    });

    it("(b) large=true 분기 — 임계 초과 → async-streaming", () => {
      const result = estimateExportDumpSize(sel([rec("Person")]), {
        asyncThresholdBytes: 10,
      });
      expect(result.large).toBe(true);
      expect(result.recommendation).toBe("async-streaming");
    });

    it("(c) 빈 selection → estimatedBytes 0 / humanSize '0 B' / sync", () => {
      const result = estimateExportDumpSize(sel([]));
      expect(result.estimatedBytes).toBe(0);
      expect(result.recordTotal).toBe(0);
      expect(result.humanSize).toBe("0 B");
      expect(result.large).toBe(false);
      expect(result.recommendation).toBe("sync");
      expect(result.perEntityBytes.Assessment).toBe(0);
    });

    it("(d) bytesPerRecord 일부 entity 만 지정 → 나머지는 default weight", () => {
      const selection = sel([rec("Assessment"), rec("Person")]);
      const result = estimateExportDumpSize(selection, {
        bytesPerRecord: { Assessment: 200 },
      });
      expect(result.perEntityBytes.Assessment).toBe(200);
      // Person 은 default 적용
      expect(result.perEntityBytes.Person).toBe(DEFAULT_BYTES_PER_RECORD);
    });

    it("(e) asyncThresholdBytes 경계값(estimatedBytes === threshold) → 초과 아님 → sync", () => {
      // 1 record × 1024 = 1024, threshold 1024 → 같음 → sync
      const result = estimateExportDumpSize(sel([rec("Group")]), {
        asyncThresholdBytes: 1024,
      });
      expect(result.estimatedBytes).toBe(1024);
      expect(result.large).toBe(false);
      expect(result.recommendation).toBe("sync");
    });

    it("(e2) threshold + 1 byte 초과 → large", () => {
      const result = estimateExportDumpSize(sel([rec("Group")]), {
        asyncThresholdBytes: 1023,
      });
      expect(result.estimatedBytes).toBe(1024);
      expect(result.large).toBe(true);
    });

    it("(f) humanSize B 단위 — 작은 byte", () => {
      const result = estimateExportDumpSize(sel([rec("Assessment")]), {
        defaultBytesPerRecord: 512,
      });
      expect(result.humanSize).toBe("512 B");
    });

    it("(f2) humanSize KB 단위 — 소수 라벨", () => {
      // 1536 byte = 1.5 KB
      const result = estimateExportDumpSize(sel([rec("Assessment")]), {
        defaultBytesPerRecord: 1536,
      });
      expect(result.humanSize).toBe("1.5 KB");
    });

    it("(f3) humanSize MB 단위", () => {
      const result = estimateExportDumpSize(sel([rec("Assessment")]), {
        defaultBytesPerRecord: 2 * 1024 * 1024,
        asyncThresholdBytes: 100 * 1024 * 1024,
      });
      expect(result.humanSize).toBe("2 MB");
    });

    it("(f4) humanSize GB 단위(상한)", () => {
      const result = estimateExportDumpSize(sel([rec("Assessment")]), {
        defaultBytesPerRecord: 3 * 1024 * 1024 * 1024,
        asyncThresholdBytes: 10 * 1024 * 1024 * 1024,
      });
      expect(result.humanSize).toBe("3 GB");
    });
  });

  describe("negative cases 충분 cover", () => {
    it("(a) 5 허용 외 entity 가 record 에 섞여도 자연 무시(perEntity key 없음)", () => {
      const selection = sel([
        rec("Assessment"),
        { entity: "Unknown" as ExportEntity, instant: new Date() },
      ]);
      const result = estimateExportDumpSize(selection);
      // recordTotal 은 2 지만 추정 byte 는 인식된 Assessment 1 건만
      expect(result.recordTotal).toBe(2);
      expect(result.estimatedBytes).toBe(DEFAULT_BYTES_PER_RECORD);
      expect(result.perEntityBytes.Assessment).toBe(DEFAULT_BYTES_PER_RECORD);
    });

    it("(a2) entity 가 비-string 인 record 도 무시", () => {
      const selection = sel([
        { entity: 123 as unknown as ExportEntity, instant: new Date() },
      ]);
      const result = estimateExportDumpSize(selection);
      expect(result.estimatedBytes).toBe(0);
    });

    it("(b) large === (recommendation === 'async-streaming') 불변 — sync 측", () => {
      const result = estimateExportDumpSize(sel([rec("Person")]));
      expect(result.large).toBe(result.recommendation === "async-streaming");
    });

    it("(b2) large === (recommendation === 'async-streaming') 불변 — async 측", () => {
      const result = estimateExportDumpSize(sel([rec("Person")]), {
        asyncThresholdBytes: 0,
      });
      expect(result.large).toBe(result.recommendation === "async-streaming");
      expect(result.large).toBe(true);
    });

    it("(c) non-mutating — 입력 selection 객체·배열 불변", () => {
      const selected = [rec("Assessment"), rec("Person")];
      const selection = sel(selected);
      const frozen = Object.freeze({
        selected: Object.freeze([...selected]),
        excluded: Object.freeze([]),
      }) as unknown as ExportSelection;
      // freeze 된 입력으로 호출해도 throw 없이 통과(non-mutating)
      expect(() => estimateExportDumpSize(frozen)).not.toThrow();
      // 원본 selection 의 selected 배열 길이/참조 불변
      expect(selection.selected.length).toBe(2);
      expect(selection.selected).toBe(selected);
    });

    it("(d) 옵션 미지정 시 default weight·default threshold 적용", () => {
      const selection = sel([rec("Assessment")]);
      const result = estimateExportDumpSize(selection);
      expect(result.estimatedBytes).toBe(DEFAULT_BYTES_PER_RECORD);
      // 1 KB 는 default 10 MB 임계 미만 → sync
      expect(result.large).toBe(false);
      expect(DEFAULT_ASYNC_THRESHOLD_BYTES).toBe(10 * 1024 * 1024);
    });

    it("(e) weight 0 / threshold 0 정상 허용(0 은 유효 정수)", () => {
      const result = estimateExportDumpSize(sel([rec("Assessment")]), {
        bytesPerRecord: { Assessment: 0 },
        asyncThresholdBytes: 0,
      });
      expect(result.perEntityBytes.Assessment).toBe(0);
      expect(result.estimatedBytes).toBe(0);
      // estimatedBytes 0 > threshold 0 은 false → sync
      expect(result.large).toBe(false);
    });
  });
});
