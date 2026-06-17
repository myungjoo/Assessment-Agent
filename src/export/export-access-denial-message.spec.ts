// export-access-denial-message 순수 helper spec — R-112 4 종(happy / error / branch / negative
// 충분 cover). 실 guard 가 산출한 ExportAccessDecision descriptor 에서 buildExportAccessDenial 이
// {headline, detailLines[], blocking, reason} 사람-친화 접근 거부/허용 안내 메시지 모델을 정확히
// 합성하는지(unauthenticated / insufficient-role / granted 3 분기 × operation export/import 분기 ×
// blocking === (reason !== "granted") 불변 × §7.1 우선순위(미인증이 role 보다 우선) × role
// 부재/null/User/union 외 fail-safe 거부) + 입력 방어 분기(비-object decision · authenticated
// 비-boolean · operation union 외)별 한국어 TypeError/RangeError + non-mutating(deepFreeze 통과)을
// 검증한다(export-scope-rejection-message.spec.ts mirror).
import {
  ExportAccessDecision,
  ExportAccessDenialMessage,
  buildExportAccessDenial,
} from "./export-access-denial-message";

// 정상 decision 생성 헬퍼 — override 를 받아 합성.
function makeDecision(
  over?: Partial<ExportAccessDecision>,
): ExportAccessDecision {
  return {
    authenticated: true,
    role: "Admin",
    operation: "export",
    ...over,
  };
}

// 중첩 구조까지 freeze — non-mutating regression 단언용.
function deepFreeze<T>(obj: T): T {
  if (obj && typeof obj === "object") {
    Object.values(obj as Record<string, unknown>).forEach((v) => deepFreeze(v));
    Object.freeze(obj);
  }
  return obj;
}

describe("buildExportAccessDenial", () => {
  describe("happy path — 3 reason 분기", () => {
    it("미인증 decision → §7.1 인증 거부 모델(unauthenticated, blocking=true)", () => {
      const result = buildExportAccessDenial(
        makeDecision({ authenticated: false, role: null }),
      );
      expect(result.reason).toBe("unauthenticated");
      expect(result.blocking).toBe(true);
      expect(result.headline).toContain("로그인");
      expect(result.detailLines.length).toBeGreaterThan(0);
      // 재로그인 안내 라인 존재.
      expect(result.detailLines.some((l) => l.includes("로그인"))).toBe(true);
    });

    it("User 권한 decision → §7.2 권한 거부 모델(insufficient-role, blocking=true)", () => {
      const result = buildExportAccessDenial(
        makeDecision({ authenticated: true, role: "User" }),
      );
      expect(result.reason).toBe("insufficient-role");
      expect(result.blocking).toBe(true);
      expect(result.headline).toContain("권한");
      expect(result.detailLines.some((l) => l.includes("Admin"))).toBe(true);
    });

    it("Admin decision → granted 모델(blocking=false)", () => {
      const result = buildExportAccessDenial(
        makeDecision({ authenticated: true, role: "Admin" }),
      );
      expect(result.reason).toBe("granted");
      expect(result.blocking).toBe(false);
      expect(result.headline).toContain("허용");
      expect(result.detailLines.length).toBeGreaterThan(0);
    });

    it("SuperAdmin decision → granted 모델(blocking=false)", () => {
      const result = buildExportAccessDenial(
        makeDecision({ authenticated: true, role: "SuperAdmin" }),
      );
      expect(result.reason).toBe("granted");
      expect(result.blocking).toBe(false);
    });
  });

  describe("branch — operation export/import 맥락 반영", () => {
    it("operation=export 거부 시 detailLines 가 내보내기 맥락 반영", () => {
      const result = buildExportAccessDenial(
        makeDecision({ authenticated: false, operation: "export" }),
      );
      expect(result.detailLines.some((l) => l.includes("내보내기"))).toBe(true);
      expect(result.detailLines.some((l) => l.includes("가져오기"))).toBe(
        false,
      );
    });

    it("operation=import 권한 거부 시 detailLines 가 가져오기 맥락 반영", () => {
      const result = buildExportAccessDenial(
        makeDecision({
          authenticated: true,
          role: "User",
          operation: "import",
        }),
      );
      expect(result.detailLines.some((l) => l.includes("가져오기"))).toBe(true);
    });

    it("granted 분기도 operation 맥락을 detailLine 에 반영", () => {
      const result = buildExportAccessDenial(
        makeDecision({ operation: "import", role: "Admin" }),
      );
      expect(result.detailLines.some((l) => l.includes("가져오기"))).toBe(true);
    });
  });

  describe("blocking 불변 — blocking === (reason !== 'granted')", () => {
    it.each([
      [{ authenticated: false, role: null }, true],
      [{ authenticated: true, role: "User" }, true],
      [{ authenticated: true, role: "Admin" }, false],
      [{ authenticated: true, role: "SuperAdmin" }, false],
    ] as Array<[Partial<ExportAccessDecision>, boolean]>)(
      "%o → blocking=%s",
      (over, expected) => {
        const result = buildExportAccessDenial(makeDecision(over));
        expect(result.blocking).toBe(expected);
        expect(result.blocking).toBe(result.reason !== "granted");
      },
    );
  });

  describe("§7.1 우선순위 — 미인증이 role 보다 우선", () => {
    it("authenticated=false 인데 role=Admin 이어도 인증 거부가 이긴다", () => {
      const result = buildExportAccessDenial(
        makeDecision({ authenticated: false, role: "Admin" }),
      );
      expect(result.reason).toBe("unauthenticated");
      expect(result.blocking).toBe(true);
    });

    it("authenticated=false 인데 role=SuperAdmin 이어도 인증 거부가 이긴다", () => {
      const result = buildExportAccessDenial(
        makeDecision({ authenticated: false, role: "SuperAdmin" }),
      );
      expect(result.reason).toBe("unauthenticated");
    });
  });

  describe("negative — role 부재/null/union 외 fail-safe 거부", () => {
    it("authenticated=true 인데 role 부재(undefined) → insufficient-role 로 거부", () => {
      const decision = {
        authenticated: true,
        operation: "export",
      } as ExportAccessDecision;
      const result = buildExportAccessDenial(decision);
      expect(result.reason).toBe("insufficient-role");
      expect(result.blocking).toBe(true);
    });

    it("authenticated=true 인데 role=null → insufficient-role 로 거부", () => {
      const result = buildExportAccessDenial(
        makeDecision({ authenticated: true, role: null }),
      );
      expect(result.reason).toBe("insufficient-role");
    });

    it("role 이 union 외 임의 문자열('Manager') → insufficient-role 로 거부", () => {
      const decision = {
        authenticated: true,
        role: "Manager",
        operation: "export",
      } as unknown as ExportAccessDecision;
      const result = buildExportAccessDenial(decision);
      expect(result.reason).toBe("insufficient-role");
      expect(result.blocking).toBe(true);
    });

    it("role 이 빈 문자열 → insufficient-role 로 거부", () => {
      const decision = {
        authenticated: true,
        role: "",
        operation: "import",
      } as unknown as ExportAccessDecision;
      const result = buildExportAccessDenial(decision);
      expect(result.reason).toBe("insufficient-role");
    });
  });

  describe("error path — 입력 방어", () => {
    it("decision 이 null → TypeError", () => {
      expect(() =>
        buildExportAccessDenial(null as unknown as ExportAccessDecision),
      ).toThrow(TypeError);
    });

    it("decision 이 배열 → TypeError", () => {
      expect(() =>
        buildExportAccessDenial([] as unknown as ExportAccessDecision),
      ).toThrow(TypeError);
    });

    it("decision 이 비-object(문자열) → TypeError", () => {
      expect(() =>
        buildExportAccessDenial("denied" as unknown as ExportAccessDecision),
      ).toThrow(TypeError);
    });

    it("decision.authenticated 가 비-boolean(문자열) → TypeError", () => {
      const decision = {
        authenticated: "yes",
        role: "Admin",
        operation: "export",
      } as unknown as ExportAccessDecision;
      expect(() => buildExportAccessDenial(decision)).toThrow(TypeError);
    });

    it("decision.authenticated 가 부재(undefined) → TypeError", () => {
      const decision = {
        role: "Admin",
        operation: "export",
      } as unknown as ExportAccessDecision;
      expect(() => buildExportAccessDenial(decision)).toThrow(TypeError);
    });

    it("decision.operation 이 export/import 외 값 → RangeError", () => {
      const decision = {
        authenticated: true,
        role: "Admin",
        operation: "delete",
      } as unknown as ExportAccessDecision;
      expect(() => buildExportAccessDenial(decision)).toThrow(RangeError);
    });

    it("decision.operation 이 대소문자 mismatch('Export') → RangeError", () => {
      const decision = {
        authenticated: true,
        role: "Admin",
        operation: "Export",
      } as unknown as ExportAccessDecision;
      expect(() => buildExportAccessDenial(decision)).toThrow(RangeError);
    });

    it("decision.operation 이 부재 → RangeError", () => {
      const decision = {
        authenticated: true,
        role: "Admin",
      } as unknown as ExportAccessDecision;
      expect(() => buildExportAccessDenial(decision)).toThrow(RangeError);
    });

    it("operation 검증은 authenticated 검증 이후 — authenticated 비-boolean 이 우선 throw", () => {
      const decision = {
        authenticated: 1,
        operation: "delete",
      } as unknown as ExportAccessDecision;
      expect(() => buildExportAccessDenial(decision)).toThrow(TypeError);
    });
  });

  describe("non-mutating — deepFreeze 통과 + 입력 불변", () => {
    it("deepFreeze 된 decision 으로 호출해도 throw 0 + 새 객체 반환", () => {
      const decision = deepFreeze(
        makeDecision({
          authenticated: true,
          role: "User",
          operation: "import",
        }),
      );
      let result!: ExportAccessDenialMessage;
      expect(() => {
        result = buildExportAccessDenial(decision);
      }).not.toThrow();
      // 반환 객체는 입력과 독립.
      expect(result.detailLines).not.toBe(
        (decision as unknown as { detailLines?: unknown }).detailLines,
      );
    });

    it("호출 후에도 입력 decision 의 필드가 변형되지 않는다", () => {
      const decision = makeDecision({
        authenticated: false,
        role: "Admin",
        operation: "export",
      });
      buildExportAccessDenial(decision);
      expect(decision.authenticated).toBe(false);
      expect(decision.role).toBe("Admin");
      expect(decision.operation).toBe("export");
    });
  });
});
