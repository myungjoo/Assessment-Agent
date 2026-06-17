// import-race-guard.spec — evaluateImportRaceGuard(T-0460) 단위 test. R-112 4 종 cover:
// happy-path(active=false proceed / interrupt proceed / defer / timeout 각 분기 올바른 verdict·
// blocking·headline) + error path(입력 방어 TypeError/RangeError 분기마다) + flow/branch(4 verdict
// 각 별 test 분리) + negative cases 충분 cover(경계 경과===timeoutMs / startedAt===now 경과 0 /
// UC-01 vs UC-06 operation 라벨 분기 / freeze 입력 non-mutating / options 미지정 default 정책).
import {
  InProgressOperationState,
  ImportRaceOptions,
  evaluateImportRaceGuard,
} from "./import-race-guard";

// 테스트용 진행 중 작업 state 조립 helper.
function activeState(
  startedAt: Date,
  operation: InProgressOperationState["operation"] = "UC01-pipeline",
): InProgressOperationState {
  return { active: true, operation, startedAt };
}

const BASE = new Date("2026-06-17T00:00:00.000Z");
// BASE + n ms 인 instant 를 만든다.
function plus(ms: number): Date {
  return new Date(BASE.getTime() + ms);
}

describe("evaluateImportRaceGuard", () => {
  describe("happy path / branch — 4 verdict 분기", () => {
    it("(a) active=false → proceed + blocking=false (진행 중 작업 없음)", () => {
      const verdict = evaluateImportRaceGuard({ active: false });
      expect(verdict.verdict).toBe("proceed");
      expect(verdict.blocking).toBe(false);
      expect(verdict.reason).toBe("no-active-operation");
      expect(verdict.headline).toContain("진행 중인 작업이 없어");
      expect(verdict.detailLines.length).toBeGreaterThan(0);
    });

    it("(b) active=true && interrupt → proceed + blocking=false (§6.4 (ii))", () => {
      const verdict = evaluateImportRaceGuard(activeState(plus(0)), {
        now: plus(10),
        timeoutMs: 1000,
        onConflict: "interrupt",
      });
      expect(verdict.verdict).toBe("proceed");
      expect(verdict.blocking).toBe(false);
      expect(verdict.reason).toBe("interrupt-policy");
      expect(verdict.headline).toContain("중단하고 Import");
    });

    it("(c) active=true && defer && 경과 ≤ timeout → defer + blocking=true (§6.4 (i))", () => {
      const verdict = evaluateImportRaceGuard(activeState(plus(0)), {
        now: plus(500),
        timeoutMs: 1000,
        onConflict: "defer",
      });
      expect(verdict.verdict).toBe("defer");
      expect(verdict.blocking).toBe(true);
      expect(verdict.reason).toBe("defer-policy");
      expect(verdict.headline).toContain("완료 후 자동 재시도");
    });

    it("(d) active=true && defer && 경과 > timeout → timeout + blocking=true (§7.6)", () => {
      const verdict = evaluateImportRaceGuard(activeState(plus(0)), {
        now: plus(2000),
        timeoutMs: 1000,
        onConflict: "defer",
      });
      expect(verdict.verdict).toBe("timeout");
      expect(verdict.blocking).toBe(true);
      expect(verdict.reason).toBe("operation-timeout");
      expect(verdict.headline).toContain("재시도");
    });

    it("(e) blocking === (verdict !== 'proceed') 불변 — 4 분기 모두", () => {
      const cases: Array<[InProgressOperationState, ImportRaceOptions]> = [
        [{ active: false }, {}],
        [activeState(plus(0)), { now: plus(0), onConflict: "interrupt" }],
        [activeState(plus(0)), { now: plus(1), timeoutMs: 1000 }],
        [activeState(plus(0)), { now: plus(5000), timeoutMs: 1000 }],
      ];
      for (const [state, opts] of cases) {
        const v = evaluateImportRaceGuard(state, opts);
        expect(v.blocking).toBe(v.verdict !== "proceed");
      }
    });
  });

  describe("negative cases — 경계 / 분기 / non-mutating", () => {
    it("(a) 경과 === timeoutMs 경계 → defer (아직 hang 아님)", () => {
      const verdict = evaluateImportRaceGuard(activeState(plus(0)), {
        now: plus(1000),
        timeoutMs: 1000,
      });
      expect(verdict.verdict).toBe("defer");
    });

    it("(a2) 경과 === timeoutMs + 1 → timeout (임계 초과)", () => {
      const verdict = evaluateImportRaceGuard(activeState(plus(0)), {
        now: plus(1001),
        timeoutMs: 1000,
      });
      expect(verdict.verdict).toBe("timeout");
    });

    it("(b) startedAt === now (경과 0) → defer", () => {
      const verdict = evaluateImportRaceGuard(activeState(plus(0)), {
        now: plus(0),
        timeoutMs: 1000,
      });
      expect(verdict.verdict).toBe("defer");
      expect(verdict.detailLines.some((l) => l.includes("0ms"))).toBe(true);
    });

    it("(c) UC-01 vs UC-06 operation 라벨 분기 — detailLines 에 노출", () => {
      const uc01 = evaluateImportRaceGuard(
        activeState(plus(0), "UC01-pipeline"),
        { now: plus(1), timeoutMs: 1000 },
      );
      const uc06 = evaluateImportRaceGuard(
        activeState(plus(0), "UC06-destructive"),
        { now: plus(1), timeoutMs: 1000 },
      );
      expect(uc01.detailLines.some((l) => l.includes("UC-01"))).toBe(true);
      expect(uc06.detailLines.some((l) => l.includes("UC-06"))).toBe(true);
    });

    it("(c2) interrupt 분기도 operation 라벨 노출", () => {
      const v = evaluateImportRaceGuard(
        activeState(plus(0), "UC06-destructive"),
        { onConflict: "interrupt" },
      );
      expect(v.detailLines.some((l) => l.includes("UC-06"))).toBe(true);
    });

    it("(d) freeze 된 입력 non-mutating — state / options 변형 0", () => {
      const state = Object.freeze(activeState(plus(0)));
      const options = Object.freeze<ImportRaceOptions>({
        now: plus(500),
        timeoutMs: 1000,
        onConflict: "defer",
      });
      expect(() => evaluateImportRaceGuard(state, options)).not.toThrow();
      const verdict = evaluateImportRaceGuard(state, options);
      expect(verdict.verdict).toBe("defer");
      // 입력은 그대로(freeze 라 변형 시 throw 됐을 것).
      expect(state.active).toBe(true);
      expect(options.timeoutMs).toBe(1000);
    });

    it("(e) options 미지정 → default 정책(defer + 기본 timeout) — 방금 시작한 작업은 defer", () => {
      // now 부재 → 현재 시각, startedAt 도 방금 → 경과 ~0 → 기본 timeout 이내 → defer.
      const verdict = evaluateImportRaceGuard(activeState(new Date()));
      expect(verdict.verdict).toBe("defer");
      expect(verdict.blocking).toBe(true);
    });

    it("(e2) onConflict 미지정이어도 default=defer 로 timeout 분기 도달 가능", () => {
      const verdict = evaluateImportRaceGuard(activeState(plus(0)), {
        now: plus(10000),
        timeoutMs: 1000,
      });
      expect(verdict.verdict).toBe("timeout");
    });

    it("(f) now 부재 + interrupt → proceed (now 불필요 경로)", () => {
      const verdict = evaluateImportRaceGuard(activeState(plus(0)), {
        onConflict: "interrupt",
      });
      expect(verdict.verdict).toBe("proceed");
    });
  });

  describe("error path — 입력 방어 TypeError / RangeError", () => {
    it("(a) state null → TypeError", () => {
      expect(() =>
        evaluateImportRaceGuard(null as unknown as InProgressOperationState),
      ).toThrow(TypeError);
    });

    it("(a2) state 배열 → TypeError", () => {
      expect(() =>
        evaluateImportRaceGuard([] as unknown as InProgressOperationState),
      ).toThrow(/plain object/);
    });

    it("(a3) state 원시값 → TypeError", () => {
      expect(() =>
        evaluateImportRaceGuard(42 as unknown as InProgressOperationState),
      ).toThrow(TypeError);
    });

    it("(b) state.active 비-boolean → TypeError", () => {
      expect(() =>
        evaluateImportRaceGuard({
          active: "yes",
        } as unknown as InProgressOperationState),
      ).toThrow(/active 는 boolean/);
    });

    it("(c) active=true 인데 operation 부재 → TypeError", () => {
      expect(() =>
        evaluateImportRaceGuard({
          active: true,
          startedAt: plus(0),
        } as unknown as InProgressOperationState),
      ).toThrow(/operation/);
    });

    it("(c2) active=true 인데 operation 허용 외 → TypeError", () => {
      expect(() =>
        evaluateImportRaceGuard({
          active: true,
          operation: "UC99-bogus",
          startedAt: plus(0),
        } as unknown as InProgressOperationState),
      ).toThrow(/operation/);
    });

    it("(d) active=true 인데 startedAt 부재 → TypeError", () => {
      expect(() =>
        evaluateImportRaceGuard({
          active: true,
          operation: "UC01-pipeline",
        } as unknown as InProgressOperationState),
      ).toThrow(/startedAt/);
    });

    it("(d2) active=true 인데 startedAt 비-Date → TypeError", () => {
      expect(() =>
        evaluateImportRaceGuard({
          active: true,
          operation: "UC01-pipeline",
          startedAt: "2026-06-17",
        } as unknown as InProgressOperationState),
      ).toThrow(/startedAt/);
    });

    it("(d3) active=true 인데 startedAt Invalid Date → TypeError", () => {
      expect(() =>
        evaluateImportRaceGuard(activeState(new Date("not-a-date"))),
      ).toThrow(/startedAt/);
    });

    it("(e) options 비-object(원시값) → TypeError", () => {
      expect(() =>
        evaluateImportRaceGuard(
          activeState(plus(0)),
          7 as unknown as ImportRaceOptions,
        ),
      ).toThrow(/options 는 plain object/);
    });

    it("(e2) options 배열 → TypeError", () => {
      expect(() =>
        evaluateImportRaceGuard(
          activeState(plus(0)),
          [] as unknown as ImportRaceOptions,
        ),
      ).toThrow(/plain object/);
    });

    it("(f) options.now 비-Date → TypeError", () => {
      expect(() =>
        evaluateImportRaceGuard(activeState(plus(0)), {
          now: 123 as unknown as Date,
        }),
      ).toThrow(/now/);
    });

    it("(f2) options.now Invalid Date → TypeError", () => {
      expect(() =>
        evaluateImportRaceGuard(activeState(plus(0)), {
          now: new Date("bad"),
        }),
      ).toThrow(/now/);
    });

    it("(g) options.timeoutMs 0 → TypeError", () => {
      expect(() =>
        evaluateImportRaceGuard(activeState(plus(0)), { timeoutMs: 0 }),
      ).toThrow(/timeoutMs/);
    });

    it("(g2) options.timeoutMs 음수 → TypeError", () => {
      expect(() =>
        evaluateImportRaceGuard(activeState(plus(0)), { timeoutMs: -5 }),
      ).toThrow(/timeoutMs/);
    });

    it("(g3) options.timeoutMs 소수 → TypeError", () => {
      expect(() =>
        evaluateImportRaceGuard(activeState(plus(0)), { timeoutMs: 1.5 }),
      ).toThrow(/timeoutMs/);
    });

    it("(h) options.onConflict 허용 외 → TypeError", () => {
      expect(() =>
        evaluateImportRaceGuard(activeState(plus(0)), {
          onConflict: "abort" as unknown as "defer",
        }),
      ).toThrow(/onConflict/);
    });

    it("(i) now < startedAt (시간 역행) → RangeError", () => {
      expect(() =>
        evaluateImportRaceGuard(activeState(plus(1000)), {
          now: plus(0),
          timeoutMs: 1000,
        }),
      ).toThrow(RangeError);
    });
  });
});
