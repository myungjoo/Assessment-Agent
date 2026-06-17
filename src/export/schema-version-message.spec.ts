// schema-version-message 순수 helper spec — R-112 4 종(happy / error / branch / negative 충분
// cover). checkSchemaVersionCompat(T-0439)가 산출한 SchemaVersionCompat verdict 에서
// buildVersionCompatMessage 가 {headline, detailLines[], action, blocking} 사람-친화 version 호환
// 안내 메시지 모델을 정확히 합성하는지(accept / migrate / reject 3 분기 × blocking 불변 × uploaded
// /current version detailLines 노출) + 입력 방어 분기(비-object compat · action invalid · version
// string 부적합)별 한국어 TypeError/RangeError + non-mutating(freeze 통과)을 검증한다
// (export-import-audit-message.spec.ts mirror).
import { SchemaVersionCompat } from "./schema-version-compat";
import {
  VersionCompatMessage,
  buildVersionCompatMessage,
} from "./schema-version-message";

// 정상 호환 verdict 생성 헬퍼 — action / version override 를 받아 합성.
function makeCompat(over?: Partial<SchemaVersionCompat>): SchemaVersionCompat {
  return {
    compatible: true,
    action: "accept",
    uploadedVersion: "1.0.0",
    currentVersion: "1.0.0",
    ...over,
  };
}

describe("buildVersionCompatMessage — happy path", () => {
  it("accept verdict → 호환 확인 headline + blocking=false + uploaded/current version 라인", () => {
    const compat = makeCompat({
      action: "accept",
      uploadedVersion: "2.1.0",
      currentVersion: "2.1.0",
    });
    const msg: VersionCompatMessage = buildVersionCompatMessage(compat);

    expect(msg.action).toBe("accept");
    expect(msg.blocking).toBe(false);
    expect(msg.headline).toContain("호환 확인");
    expect(msg.detailLines.some((l) => l.includes("2.1.0"))).toBe(true);
    expect(msg.detailLines.some((l) => l.includes("추가 변환 없이"))).toBe(
      true,
    );
  });

  it("migrate verdict → 자동 migration 후보 headline + blocking=false + uploaded→current 변환 라인", () => {
    const compat = makeCompat({
      compatible: false,
      action: "migrate",
      uploadedVersion: "1.0.0",
      currentVersion: "2.0.0",
      reason: "1.0.0→2.0.0 자동 migration 후보",
    });
    const msg = buildVersionCompatMessage(compat);

    expect(msg.action).toBe("migrate");
    expect(msg.blocking).toBe(false);
    expect(msg.headline).toContain("자동 migration 후보");
    expect(
      msg.detailLines.some((l) => l.includes("1.0.0") && l.includes("2.0.0")),
    ).toBe(true);
    expect(msg.detailLines.some((l) => l.includes("결정한 뒤"))).toBe(true);
  });

  it("reject verdict → version 불일치 거부 headline + blocking=true + 재확인 안내 라인", () => {
    const compat = makeCompat({
      compatible: false,
      action: "reject",
      uploadedVersion: "0.9.0",
      currentVersion: "2.0.0",
      reason: "schema version mismatch: 0.9.0 ≠ 2.0.0",
    });
    const msg = buildVersionCompatMessage(compat);

    expect(msg.action).toBe("reject");
    expect(msg.blocking).toBe(true);
    expect(msg.headline).toContain("복원할 수 없습니다");
    expect(msg.detailLines.some((l) => l.includes("다시 업로드"))).toBe(true);
    expect(msg.detailLines.some((l) => l.includes("지원되지 않습니다"))).toBe(
      true,
    );
  });
});

describe("buildVersionCompatMessage — branch / flow cover", () => {
  it("accept 분기 → blocking=false (action===reject 불변)", () => {
    const msg = buildVersionCompatMessage(makeCompat({ action: "accept" }));
    expect(msg.blocking).toBe(false);
    expect(msg.blocking).toBe(msg.action === "reject");
  });

  it("migrate 분기 → blocking=false (action===reject 불변)", () => {
    const msg = buildVersionCompatMessage(
      makeCompat({
        compatible: false,
        action: "migrate",
        uploadedVersion: "1.0.0",
        currentVersion: "2.0.0",
      }),
    );
    expect(msg.blocking).toBe(false);
    expect(msg.blocking).toBe(msg.action === "reject");
  });

  it("reject 분기 → blocking=true (action===reject 불변)", () => {
    const msg = buildVersionCompatMessage(
      makeCompat({
        compatible: false,
        action: "reject",
        uploadedVersion: "1.0.0",
        currentVersion: "2.0.0",
      }),
    );
    expect(msg.blocking).toBe(true);
    expect(msg.blocking).toBe(msg.action === "reject");
  });

  it("모든 분기 detailLines 는 비어있지 않다(headline + 최소 1 라인)", () => {
    for (const action of ["accept", "migrate", "reject"] as const) {
      const msg = buildVersionCompatMessage(
        makeCompat({
          action,
          uploadedVersion: "1.0.0",
          currentVersion: action === "accept" ? "1.0.0" : "2.0.0",
        }),
      );
      expect(msg.headline.length).toBeGreaterThan(0);
      expect(msg.detailLines.length).toBeGreaterThan(0);
    }
  });
});

describe("buildVersionCompatMessage — error path / negative cases 충분 cover", () => {
  it("compat=null → TypeError(한국어 plain object)", () => {
    expect(() => buildVersionCompatMessage(null as never)).toThrow(TypeError);
    expect(() => buildVersionCompatMessage(null as never)).toThrow(
      /plain object/,
    );
  });

  it("compat=undefined → TypeError", () => {
    expect(() => buildVersionCompatMessage(undefined as never)).toThrow(
      TypeError,
    );
  });

  it("compat=배열 → TypeError(plain object)", () => {
    expect(() => buildVersionCompatMessage([] as never)).toThrow(
      /plain object/,
    );
  });

  it("compat=숫자(비-object) → TypeError", () => {
    expect(() => buildVersionCompatMessage(42 as never)).toThrow(TypeError);
  });

  it("compat=문자열(비-object) → TypeError", () => {
    expect(() => buildVersionCompatMessage("accept" as never)).toThrow(
      TypeError,
    );
  });

  it("action 부재 → RangeError(accept/migrate/reject)", () => {
    const compat = makeCompat();
    delete (compat as unknown as Record<string, unknown>).action;
    expect(() => buildVersionCompatMessage(compat)).toThrow(RangeError);
    expect(() => buildVersionCompatMessage(compat)).toThrow(
      /accept\/migrate\/reject/,
    );
  });

  it("action 빈 문자열 → RangeError", () => {
    const compat = makeCompat({ action: "" as never });
    expect(() => buildVersionCompatMessage(compat)).toThrow(RangeError);
  });

  it("action 대문자 ACCEPT → RangeError(case-sensitive)", () => {
    const compat = makeCompat({ action: "ACCEPT" as never });
    expect(() => buildVersionCompatMessage(compat)).toThrow(RangeError);
  });

  it("action 허용 외 문자열 → RangeError", () => {
    const compat = makeCompat({ action: "delete" as never });
    expect(() => buildVersionCompatMessage(compat)).toThrow(RangeError);
  });

  it("action 숫자 → RangeError", () => {
    const compat = makeCompat({ action: 1 as never });
    expect(() => buildVersionCompatMessage(compat)).toThrow(RangeError);
  });

  it("uploadedVersion 비-string(number) → TypeError", () => {
    const compat = makeCompat({ uploadedVersion: 100 as never });
    expect(() => buildVersionCompatMessage(compat)).toThrow(TypeError);
    expect(() => buildVersionCompatMessage(compat)).toThrow(/uploadedVersion/);
  });

  it("uploadedVersion 빈 문자열 → TypeError", () => {
    const compat = makeCompat({ uploadedVersion: "" });
    expect(() => buildVersionCompatMessage(compat)).toThrow(/uploadedVersion/);
  });

  it("uploadedVersion 공백만 → TypeError", () => {
    const compat = makeCompat({ uploadedVersion: "   " });
    expect(() => buildVersionCompatMessage(compat)).toThrow(/uploadedVersion/);
  });

  it("uploadedVersion 부재 → TypeError", () => {
    const compat = makeCompat();
    delete (compat as unknown as Record<string, unknown>).uploadedVersion;
    expect(() => buildVersionCompatMessage(compat)).toThrow(/uploadedVersion/);
  });

  it("currentVersion 비-string(null) → TypeError", () => {
    const compat = makeCompat({ currentVersion: null as never });
    expect(() => buildVersionCompatMessage(compat)).toThrow(TypeError);
    expect(() => buildVersionCompatMessage(compat)).toThrow(/currentVersion/);
  });

  it("currentVersion 빈 문자열 → TypeError", () => {
    const compat = makeCompat({ currentVersion: "" });
    expect(() => buildVersionCompatMessage(compat)).toThrow(/currentVersion/);
  });

  it("currentVersion 공백만 → TypeError", () => {
    const compat = makeCompat({ currentVersion: "\t\n" });
    expect(() => buildVersionCompatMessage(compat)).toThrow(/currentVersion/);
  });
});

describe("buildVersionCompatMessage — negative / 비정상 verdict 경계", () => {
  it("uploadedVersion===currentVersion 인데 action=reject(비정상 verdict) → 거부 메시지 그대로 합성(verdict 신뢰)", () => {
    // checkSchemaVersionCompat 정상 흐름엔 없으나 helper 는 verdict 를 재계산하지 않고
    // 입력 action 을 신뢰한다 — version 동일해도 action=reject 면 거부 메시지.
    const compat = makeCompat({
      compatible: false,
      action: "reject",
      uploadedVersion: "1.0.0",
      currentVersion: "1.0.0",
    });
    const msg = buildVersionCompatMessage(compat);
    expect(msg.action).toBe("reject");
    expect(msg.blocking).toBe(true);
    expect(msg.headline).toContain("복원할 수 없습니다");
  });

  it("uploadedVersion===currentVersion 인데 action=migrate(비정상 verdict) → migration 메시지 그대로(version 동일 라인 노출)", () => {
    const compat = makeCompat({
      compatible: false,
      action: "migrate",
      uploadedVersion: "3.0.0",
      currentVersion: "3.0.0",
    });
    const msg = buildVersionCompatMessage(compat);
    expect(msg.action).toBe("migrate");
    expect(msg.blocking).toBe(false);
    expect(msg.detailLines.some((l) => l.includes("3.0.0 → 3.0.0"))).toBe(true);
  });
});

describe("buildVersionCompatMessage — non-mutating regression", () => {
  it("freeze 된 accept compat 으로 호출해도 throw 0 + 입력 불변", () => {
    const compat = Object.freeze(
      makeCompat({
        action: "accept",
        uploadedVersion: "1.0.0",
        currentVersion: "1.0.0",
      }),
    );
    const before = JSON.stringify(compat);
    expect(() => buildVersionCompatMessage(compat)).not.toThrow();
    const msg = buildVersionCompatMessage(compat);
    expect(msg.detailLines.length).toBeGreaterThan(0);
    expect(JSON.stringify(compat)).toBe(before);
  });

  it("freeze 된 reject compat 으로 호출해도 throw 0 + 입력 불변", () => {
    const compat = Object.freeze(
      makeCompat({
        compatible: false,
        action: "reject",
        uploadedVersion: "1.0.0",
        currentVersion: "2.0.0",
        reason: "schema version mismatch: 1.0.0 ≠ 2.0.0",
      }),
    );
    const before = JSON.stringify(compat);
    expect(() => buildVersionCompatMessage(compat)).not.toThrow();
    expect(JSON.stringify(compat)).toBe(before);
  });
});
