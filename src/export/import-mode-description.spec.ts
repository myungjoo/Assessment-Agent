// import-mode-description 순수 helper spec — R-112 4 종(happy / error / branch / negative 충분
// cover). 선택된 ImportRestoreMode(replace/merge)에서 describeImportMode 가 {headline,
// detailLines[], destructive, mergeStrategy, reason} 설명 모델을 정확히 합성하는지(replace →
// 파괴적·mergeStrategy null / merge → 보존적·mergeStrategy 채움) + 입력 방어 분기(비-string
// TypeError / 허용 외 문자열 RangeError) 별 한국어 메시지 + destructive === (reason === "replace")
// 불변 + 동일 입력 2 회 동등(순수·결정성)을 검증한다(export-scope-description.spec.ts mirror).
import {
  describeImportMode,
  ImportModeDescription,
} from "./import-mode-description";
import { ImportRestoreMode } from "./import-restore-plan";

describe("describeImportMode — happy path", () => {
  it('mode="replace" → 파괴적 모델(destructive·mergeStrategy null·reason replace)', () => {
    const desc: ImportModeDescription = describeImportMode("replace");

    expect(desc.reason).toBe("replace");
    expect(desc.destructive).toBe(true);
    expect(desc.mergeStrategy).toBeNull();
    expect(desc.headline).toContain("전체 교체");
    expect(desc.headline).toContain("replace");
    expect(desc.detailLines.length).toBeGreaterThan(0);
    expect(desc.detailLines.some((l) => l.includes("삭제"))).toBe(true);
    expect(desc.detailLines.some((l) => l.includes("file snapshot"))).toBe(
      true,
    );
  });

  it('mode="merge" → 보존적 모델(non-destructive·mergeStrategy 채움·reason merge)', () => {
    const desc = describeImportMode("merge");

    expect(desc.reason).toBe("merge");
    expect(desc.destructive).toBe(false);
    expect(desc.mergeStrategy).not.toBeNull();
    expect(typeof desc.mergeStrategy).toBe("string");
    expect(desc.mergeStrategy).toContain("conflict");
    expect(desc.headline).toContain("병합");
    expect(desc.headline).toContain("merge");
    expect(desc.detailLines.length).toBeGreaterThan(0);
    expect(desc.detailLines.some((l) => l.includes("보존"))).toBe(true);
  });
});

describe("describeImportMode — branch / flow cover", () => {
  it("replace / merge 2 분기 headline·reason 분기", () => {
    expect(describeImportMode("replace").headline).toContain("전체 교체");
    expect(describeImportMode("replace").reason).toBe("replace");
    expect(describeImportMode("merge").headline).toContain("병합");
    expect(describeImportMode("merge").reason).toBe("merge");
  });

  it("destructive true/false 분기 — replace=true·merge=false", () => {
    expect(describeImportMode("replace").destructive).toBe(true);
    expect(describeImportMode("merge").destructive).toBe(false);
  });

  it("mergeStrategy null/non-null 분기 — replace=null·merge 문자열", () => {
    expect(describeImportMode("replace").mergeStrategy).toBeNull();
    const merge = describeImportMode("merge");
    expect(merge.mergeStrategy).toEqual(expect.any(String));
    expect((merge.mergeStrategy as string).length).toBeGreaterThan(0);
  });
});

describe("describeImportMode — error path / negative cases", () => {
  it("mode 대문자 REPLACE → RangeError(한국어·받음 노출)", () => {
    expect(() =>
      describeImportMode("REPLACE" as unknown as ImportRestoreMode),
    ).toThrow(/mode 는 replace\/merge 중 하나여야 합니다.*받음: REPLACE/);
  });

  it('mode 임의 문자열 "overwrite" → RangeError', () => {
    expect(() =>
      describeImportMode("overwrite" as unknown as ImportRestoreMode),
    ).toThrow(RangeError);
  });

  it("mode 빈 문자열 → RangeError", () => {
    expect(() =>
      describeImportMode("" as unknown as ImportRestoreMode),
    ).toThrow(/replace\/merge 중 하나/);
  });

  it("mode null → TypeError(받음: null)", () => {
    expect(() =>
      describeImportMode(null as unknown as ImportRestoreMode),
    ).toThrow(/mode 는 string 이어야 합니다.*받음: null/);
  });

  it("mode undefined → TypeError(받음: undefined)", () => {
    expect(() =>
      describeImportMode(undefined as unknown as ImportRestoreMode),
    ).toThrow(/mode 는 string 이어야 합니다.*받음: undefined/);
  });

  it("mode 숫자 → TypeError(받음: number)", () => {
    expect(() => describeImportMode(1 as unknown as ImportRestoreMode)).toThrow(
      /받음: number/,
    );
  });

  it("mode 객체 → TypeError(받음: object)", () => {
    expect(() =>
      describeImportMode({} as unknown as ImportRestoreMode),
    ).toThrow(/받음: object/);
  });

  it("detailLines 는 빈 배열이 아님 — 두 mode 모두", () => {
    expect(describeImportMode("replace").detailLines).not.toEqual([]);
    expect(describeImportMode("merge").detailLines).not.toEqual([]);
  });
});

describe("describeImportMode — 불변·순수성 regression", () => {
  it('destructive === (reason === "replace") 불변 — 두 mode 모두 성립', () => {
    for (const mode of ["replace", "merge"] as ImportRestoreMode[]) {
      const desc = describeImportMode(mode);
      expect(desc.destructive).toBe(desc.reason === "replace");
    }
  });

  it("동일 입력 2 회 호출 → 동등 결과(순수·결정성)", () => {
    expect(describeImportMode("replace")).toEqual(
      describeImportMode("replace"),
    );
    expect(describeImportMode("merge")).toEqual(describeImportMode("merge"));
  });

  it("반환 객체는 호출마다 새 인스턴스(공유 mutable 상태 0)", () => {
    const a = describeImportMode("merge");
    const b = describeImportMode("merge");
    expect(a).not.toBe(b);
    expect(a.detailLines).not.toBe(b.detailLines);
    // 한 반환의 detailLines 를 변형해도 다음 호출에 누수되지 않음.
    a.detailLines.push("오염");
    expect(describeImportMode("merge").detailLines).not.toContain("오염");
  });
});
