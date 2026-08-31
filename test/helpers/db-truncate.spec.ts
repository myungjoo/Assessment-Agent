// db-truncate.spec.ts — truncateAll helper 의 R-112 4 종 cover.
//
// 본 spec 은 unit jest scope (testRegex `.*\.spec\.ts$`) 에서 발화.
// 실 DB 의존성 0 — $executeRawUnsafe 를 jest.fn() spy 로 검증.
//
// R-112 cover (CLAUDE.md §3.2):
//   - Happy path 3 (호출 회수 + SQL 형태 / 8 테이블 substring 검증 / T-1819 로
//     추가된 "CollectionTarget" 을 직접 지목하는 anchor)
//   - Error path 2 ($executeRawUnsafe reject / prisma null) — T-1819 는 helper
//     시그니처를 바꾸지 않으므로 신규 error path 없이 기존 2 종 통과만 유지한다.
//   - Branch: 본 helper 는 단일 await SQL 호출 — 분기 자체가 없다. 따라서 R-112 #3
//     (분기 cover) 은 본 helper 에 해당 없음이며 의도적으로 생략한다.
//   - Negative cases 7+ (Error path 2 + 빈 객체 + 비함수 $executeRawUnsafe +
//     undefined + T-1819 회귀 차단 4 종: 중복 등장 / 기존 7 원소 prefix 보존 /
//     맨몸 CollectionTarget 토큰 부재 / 명단 길이 정확히 8)
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

    it("SQL 문 안에 8 도메인 테이블 (PascalCase quoted identifier) 이 모두 포함된다", async () => {
      const executeRawUnsafe = jest.fn().mockResolvedValue(0);
      const prisma = {
        $executeRawUnsafe: executeRawUnsafe,
      } as unknown as TruncatableClient;

      await truncateAll(prisma);

      const sql = executeRawUnsafe.mock.calls[0][0] as string;
      // 8 테이블 substring 검증 — schema 변경 시 회귀 anchor.
      for (const table of TRUNCATE_TABLES) {
        expect(sql).toContain(table);
      }
      // 명시 검증 (drift guard): 8 표 + helper 상수 일치. T-0087 — "User" 추가
      // (RBAC 첫 production 적용 endpoint 의 e2e 가 User 테이블 seed).
      // T-0208 — "PermissionDeniedRecord" 추가 (append-only audit smoke 격리).
      // T-1819 — "CollectionTarget" 추가 (@@unique([type, instanceKey]) 잔여 row
      // 가 후속 e2e 의 등록을 409 로 깨뜨리는 state leak 차단).
      expect(TRUNCATE_TABLES).toEqual([
        '"Person"',
        '"ServiceIdentity"',
        '"Group"',
        '"Part"',
        '"PersonGroupMembership"',
        '"User"',
        '"PermissionDeniedRecord"',
        '"CollectionTarget"',
      ]);
    });

    it('SQL 문 안에 "CollectionTarget" 이 quoted identifier 형태로 포함된다 (T-1819 anchor)', async () => {
      const executeRawUnsafe = jest.fn().mockResolvedValue(0);
      const prisma = {
        $executeRawUnsafe: executeRawUnsafe,
      } as unknown as TruncatableClient;

      await truncateAll(prisma);

      const sql = executeRawUnsafe.mock.calls[0][0] as string;
      // 신규 원소를 직접 지목하는 anchor — 전체 substring loop 와 별개로 유지해
      // 명단에서 빠지는 회귀를 단독 test 이름으로 드러낸다.
      expect(sql).toContain('"CollectionTarget"');
      // 명단 마지막 원소이므로 RESTART IDENTITY 직전에 위치한다.
      expect(sql).toContain('"CollectionTarget" RESTART IDENTITY CASCADE');
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

    it('"CollectionTarget" 이 명단에 정확히 1 회만 등장한다 (중복 append 차단)', () => {
      const occurrences = TRUNCATE_TABLES.filter(
        (table) => table === '"CollectionTarget"',
      );
      expect(occurrences).toHaveLength(1);
    });

    it("기존 7 원소가 순서 그대로 prefix 로 보존된다 (순서 회귀 차단)", () => {
      expect(TRUNCATE_TABLES.slice(0, 7)).toEqual([
        '"Person"',
        '"ServiceIdentity"',
        '"Group"',
        '"Part"',
        '"PersonGroupMembership"',
        '"User"',
        '"PermissionDeniedRecord"',
      ]);
    });

    it("SQL 이 따옴표 없는 맨몸 CollectionTarget 토큰을 포함하지 않는다 (quoted identifier 누락 회귀 차단)", async () => {
      const executeRawUnsafe = jest.fn().mockResolvedValue(0);
      const prisma = {
        $executeRawUnsafe: executeRawUnsafe,
      } as unknown as TruncatableClient;

      await truncateAll(prisma);

      const sql = executeRawUnsafe.mock.calls[0][0] as string;
      // 앞뒤가 따옴표가 아닌 맨몸 토큰이 있으면 quoting 이 깨진 것 — PascalCase
      // 테이블명은 unquoted 시 postgres 가 소문자로 접어 실행이 실패한다.
      expect(sql).not.toMatch(/(^|[^"])CollectionTarget([^"]|$)/);
    });

    it("명단 길이가 정확히 8 이다 (초과 append 차단)", () => {
      expect(TRUNCATE_TABLES).toHaveLength(8);
    });
  });
});
