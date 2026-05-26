// db-truncate.spec.ts — truncateAll helper 의 R-112 4 종 cover.
//
// 본 spec 은 unit jest scope (testRegex `.*\.spec\.ts$`) 에서 발화.
// 실 DB 의존성 0 — $executeRawUnsafe 를 jest.fn() spy 로 검증.
//
// R-112 cover (CLAUDE.md §3.2):
//   - Happy path 2 (호출 회수 + SQL 형태 / 5 테이블 substring 검증)
//   - Error path 2 ($executeRawUnsafe reject / prisma null)
//   - Branch: 본 helper 는 단일 await — 분기 없음 (생략 명시)
//   - Negative cases 3+ (Error path 2 + 빈 객체 + 비함수 $executeRawUnsafe)
import {
  TRUNCATE_TABLES,
  truncateAll,
  type TruncatableClient,
} from "./db-truncate";

describe("truncateAll", () => {
  describe("happy path", () => {
    it("prisma.$executeRawUnsafe 를 정확히 1 회 호출하고 TRUNCATE ... RESTART IDENTITY CASCADE SQL 을 전달한다", async () => {
      const executeRawUnsafe = jest.fn().mockResolvedValue(0);
      const prisma = {
        $executeRawUnsafe: executeRawUnsafe,
      } as unknown as TruncatableClient;

      const result = await truncateAll(prisma);

      expect(executeRawUnsafe).toHaveBeenCalledTimes(1);
      const sql = executeRawUnsafe.mock.calls[0][0] as string;
      expect(sql).toMatch(/^TRUNCATE TABLE /);
      expect(sql).toMatch(/ RESTART IDENTITY CASCADE$/);
      // Promise<void> 계약 — 반환값 undefined.
      expect(result).toBeUndefined();
    });

    it("SQL 문 안에 5 도메인 테이블 (PascalCase quoted identifier) 이 모두 포함된다", async () => {
      const executeRawUnsafe = jest.fn().mockResolvedValue(0);
      const prisma = {
        $executeRawUnsafe: executeRawUnsafe,
      } as unknown as TruncatableClient;

      await truncateAll(prisma);

      const sql = executeRawUnsafe.mock.calls[0][0] as string;
      // 5 테이블 substring 검증 — schema 변경 시 회귀 anchor.
      for (const table of TRUNCATE_TABLES) {
        expect(sql).toContain(table);
      }
      // 명시 검증: 5 표 + helper 상수 일치.
      expect(TRUNCATE_TABLES).toEqual([
        '"Person"',
        '"ServiceIdentity"',
        '"Group"',
        '"Part"',
        '"PersonGroupMembership"',
      ]);
    });
  });

  describe("error path", () => {
    it("$executeRawUnsafe 가 reject 시 동일 error 를 propagate 한다", async () => {
      const executeRawUnsafe = jest.fn().mockRejectedValue(new Error("boom"));
      const prisma = {
        $executeRawUnsafe: executeRawUnsafe,
      } as unknown as TruncatableClient;

      await expect(truncateAll(prisma)).rejects.toThrow("boom");
      expect(executeRawUnsafe).toHaveBeenCalledTimes(1);
    });

    it("prisma 인자가 null 이면 TypeError 가 propagate 된다", async () => {
      // null on TruncatableClient 위치 — runtime 에서 property access 실패.
      await expect(
        truncateAll(null as unknown as TruncatableClient),
      ).rejects.toThrow(TypeError);
    });
  });

  describe("negative cases (R-112 #4 충분 cover)", () => {
    // 본 helper 는 단일 await SQL 호출 — 본 helper 자체엔 분기 없음 (R-112 #3
    // branch coverage 항목은 본 helper 에 적용 불가 / 100% 자연 달성).
    // 본 describe 는 R-112 #4 negative 충분 cover — 비정상 input 변종.

    it("prisma 인자가 빈 객체 {} 이면 $executeRawUnsafe 미존재로 TypeError propagate", async () => {
      const prisma = {} as TruncatableClient;
      await expect(truncateAll(prisma)).rejects.toThrow(TypeError);
    });

    it("$executeRawUnsafe 가 함수가 아닌 string 이면 TypeError propagate", async () => {
      const prisma = {
        $executeRawUnsafe: "not-a-function",
      } as unknown as TruncatableClient;
      await expect(truncateAll(prisma)).rejects.toThrow(TypeError);
    });

    it("prisma 인자가 undefined 이면 TypeError propagate", async () => {
      await expect(
        truncateAll(undefined as unknown as TruncatableClient),
      ).rejects.toThrow(TypeError);
    });
  });
});
