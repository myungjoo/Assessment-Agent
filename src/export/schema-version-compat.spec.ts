// schema-version-compat 순수 helper spec — R-112 4 종(happy / error / branch / negative 충분
// cover). accept(version 일치) vs migrate(allowMigrationFrom 포함) vs reject(mismatch + 후보
// 아님) 3 분기 + currentVersion default vs 명시 분기 + allowMigrationFrom 부재/빈/매칭/비매칭
// 분기 + non-mutating(freeze 통과) + 예외 분기(uploadedVersion/currentVersion/allowMigrationFrom)
// 를 검증한다(export-dump.spec.ts mirror).
import { EXPORT_SCHEMA_VERSION } from "./export-dump";
import {
  checkSchemaVersionCompat,
  SchemaVersionCompat,
  SchemaVersionCompatOptions,
} from "./schema-version-compat";

describe("checkSchemaVersionCompat — happy path (정상 verdict)", () => {
  it("uploadedVersion === currentVersion → accept (compatible true, reason 생략)", () => {
    const v: SchemaVersionCompat = checkSchemaVersionCompat("1", {
      currentVersion: "1",
    });
    expect(v).toEqual({
      compatible: true,
      action: "accept",
      uploadedVersion: "1",
      currentVersion: "1",
    });
    expect(v.reason).toBeUndefined();
  });

  it("currentVersion 부재 시 EXPORT_SCHEMA_VERSION('1') default 를 적용한다", () => {
    const v = checkSchemaVersionCompat("1");
    expect(v.currentVersion).toBe(EXPORT_SCHEMA_VERSION);
    expect(v.currentVersion).toBe("1");
    expect(v.action).toBe("accept");
  });

  it("mismatch + allowMigrationFrom 에 포함 → migrate 후보 verdict (reason 박제)", () => {
    const v = checkSchemaVersionCompat("0", {
      currentVersion: "1",
      allowMigrationFrom: ["0"],
    });
    expect(v.compatible).toBe(false);
    expect(v.action).toBe("migrate");
    expect(v.reason).toBe("0→1 자동 migration 후보");
    expect(v.uploadedVersion).toBe("0");
    expect(v.currentVersion).toBe("1");
  });

  it("mismatch + migration 후보 아님 → reject verdict (mismatch reason)", () => {
    const v = checkSchemaVersionCompat("2", { currentVersion: "1" });
    expect(v.compatible).toBe(false);
    expect(v.action).toBe("reject");
    expect(v.reason).toBe("schema version mismatch: 2 ≠ 1");
  });
});

describe("checkSchemaVersionCompat — flow / branch coverage", () => {
  it("currentVersion 명시 분기: default 미적용, 명시 값으로 비교한다", () => {
    const v = checkSchemaVersionCompat("9", { currentVersion: "9" });
    expect(v.action).toBe("accept");
    expect(v.currentVersion).toBe("9");
  });

  it("allowMigrationFrom 부재 분기: mismatch 는 reject (migration 후보 없음)", () => {
    const v = checkSchemaVersionCompat("0", { currentVersion: "1" });
    expect(v.action).toBe("reject");
  });

  it("allowMigrationFrom 매칭 분기: migrate", () => {
    const v = checkSchemaVersionCompat("0", {
      currentVersion: "1",
      allowMigrationFrom: ["0", "0.5"],
    });
    expect(v.action).toBe("migrate");
  });

  it("allowMigrationFrom 비매칭 분기: 목록은 있으나 uploadedVersion 없음 → reject", () => {
    const v = checkSchemaVersionCompat("3", {
      currentVersion: "1",
      allowMigrationFrom: ["0", "0.5"],
    });
    expect(v.action).toBe("reject");
    expect(v.reason).toBe("schema version mismatch: 3 ≠ 1");
  });

  it("options 인자 자체 부재(default {}) 시 default currentVersion 으로 동작한다", () => {
    const v = checkSchemaVersionCompat("1");
    expect(v.action).toBe("accept");
  });
});

describe("checkSchemaVersionCompat — negative cases 충분 cover", () => {
  it("allowMigrationFrom 빈 배열: mismatch 전부 reject (후보 없음)", () => {
    const v = checkSchemaVersionCompat("0", {
      currentVersion: "1",
      allowMigrationFrom: [],
    });
    expect(v.action).toBe("reject");
  });

  it("uploadedVersion == currentVersion 인데 allowMigrationFrom 에도 포함 → accept 우선 (migrate 아님)", () => {
    const v = checkSchemaVersionCompat("1", {
      currentVersion: "1",
      allowMigrationFrom: ["1"],
    });
    expect(v.action).toBe("accept");
    expect(v.reason).toBeUndefined();
  });

  it("reason 은 reject·migrate verdict 에만 존재하고 accept 엔 생략된다", () => {
    const accept = checkSchemaVersionCompat("1", { currentVersion: "1" });
    const migrate = checkSchemaVersionCompat("0", {
      currentVersion: "1",
      allowMigrationFrom: ["0"],
    });
    const reject = checkSchemaVersionCompat("2", { currentVersion: "1" });
    expect("reason" in accept).toBe(false);
    expect(typeof migrate.reason).toBe("string");
    expect(typeof reject.reason).toBe("string");
  });

  it("입력 allowMigrationFrom 배열을 변형하지 않는다 (freeze 후 호출 통과)", () => {
    const frozen = Object.freeze(["0"]);
    const snapshot = [...frozen];
    expect(() =>
      checkSchemaVersionCompat("0", {
        currentVersion: "1",
        allowMigrationFrom: frozen,
      }),
    ).not.toThrow();
    expect([...frozen]).toEqual(snapshot);
    expect(frozen).toHaveLength(1);
  });
});

describe("checkSchemaVersionCompat — error path (TypeError: uploadedVersion)", () => {
  it("uploadedVersion 이 비-string(number) 이면 TypeError", () => {
    expect(() => checkSchemaVersionCompat(1 as unknown as string)).toThrow(
      TypeError,
    );
    expect(() => checkSchemaVersionCompat(1 as unknown as string)).toThrow(
      /schemaVersion/,
    );
  });

  it("uploadedVersion 이 빈 문자열이면 TypeError", () => {
    expect(() => checkSchemaVersionCompat("")).toThrow(TypeError);
  });

  it("uploadedVersion 이 공백만이면 TypeError", () => {
    expect(() => checkSchemaVersionCompat("   ")).toThrow(TypeError);
  });

  it("uploadedVersion 이 null 이면 TypeError", () => {
    expect(() => checkSchemaVersionCompat(null as unknown as string)).toThrow(
      TypeError,
    );
  });
});

describe("checkSchemaVersionCompat — error path (TypeError: currentVersion)", () => {
  it("currentVersion 이 비-string(number, 명시) 이면 TypeError", () => {
    expect(() =>
      checkSchemaVersionCompat("1", {
        currentVersion: 1 as unknown as string,
      }),
    ).toThrow(TypeError);
  });

  it("currentVersion 이 빈 문자열(명시) 이면 TypeError", () => {
    expect(() => checkSchemaVersionCompat("1", { currentVersion: "" })).toThrow(
      TypeError,
    );
  });

  it("currentVersion 이 공백만(명시) 이면 TypeError", () => {
    expect(() =>
      checkSchemaVersionCompat("1", { currentVersion: "  " }),
    ).toThrow(TypeError);
  });
});

describe("checkSchemaVersionCompat — error path (TypeError: allowMigrationFrom)", () => {
  it("allowMigrationFrom 이 비-배열(객체) 이면 TypeError", () => {
    expect(() =>
      checkSchemaVersionCompat("1", {
        currentVersion: "1",
        allowMigrationFrom: {} as unknown as ReadonlyArray<string>,
      }),
    ).toThrow(TypeError);
  });

  it("allowMigrationFrom 이 비-배열(string) 이면 TypeError", () => {
    expect(() =>
      checkSchemaVersionCompat("1", {
        currentVersion: "1",
        allowMigrationFrom: "0" as unknown as ReadonlyArray<string>,
      } as SchemaVersionCompatOptions),
    ).toThrow(TypeError);
  });

  it("allowMigrationFrom 원소가 비-string(number) 이면 그 index 를 메시지에 담아 TypeError", () => {
    expect(() =>
      checkSchemaVersionCompat("0", {
        currentVersion: "1",
        allowMigrationFrom: ["0", 1] as unknown as ReadonlyArray<string>,
      }),
    ).toThrow(/allowMigrationFrom\[1\]/);
    expect(() =>
      checkSchemaVersionCompat("0", {
        currentVersion: "1",
        allowMigrationFrom: ["0", 1] as unknown as ReadonlyArray<string>,
      }),
    ).toThrow(TypeError);
  });
});
