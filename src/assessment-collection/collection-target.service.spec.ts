// CollectionTargetService spec — T-1810 acceptance (R-112: happy / error / branch /
// negative 4 카테고리 + 신규 파일 line·function 100%). CollectionTargetRepository 를 Jest
// mock 으로 대체해 PostgreSQL 없이 실행하며, 검증축은 (a) 올바른 primitive 를 올바른 인자
// shape 으로 호출하는지, (b) 반환값 그대로 propagate, (c) ADR-0059 §Decision 5 오류 표
// c (P2002 → 409) / d (row 부재 → 404) 행 변환, (d) 도메인 검증 · credential 가공 부재.
import { ConflictException, NotFoundException } from "@nestjs/common";
import type { CollectionTarget } from "@prisma/client";

import type {
  CollectionTargetCreateInput,
  CollectionTargetRepository,
} from "./collection-target.repository";
import { CollectionTargetService } from "./collection-target.service";

// CollectionTarget fixture — schema 의 10 컬럼을 모두 채운 default row.
function buildTargetFixture(
  overrides: Partial<CollectionTarget> = {},
): CollectionTarget {
  return {
    id: "target-default",
    type: "GITHUB",
    instanceKey: "gh-main",
    endpoint: "https://github.example.com",
    orgs: ["acme"],
    repos: [],
    spaces: [],
    active: true,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    ...overrides,
  };
}

// test 마다 새 mock instance 를 만들어 호출 카운터를 격리하는 factory (5 primitive 전부).
function setup() {
  const repoMock = {
    create: jest.fn(),
    findById: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  };
  const service = new CollectionTargetService(
    repoMock as unknown as CollectionTargetRepository,
  );
  return { service, repoMock };
}

// Prisma error 모사 — code 필드만 있으면 service 의 duck-typing 판정에 충분하다.
function prismaError(code: string): Error & { code: string } {
  return Object.assign(new Error(`Prisma error ${code}`), { code });
}

const CREATE_INPUT: CollectionTargetCreateInput = {
  type: "GITHUB",
  instanceKey: "gh-main",
  endpoint: "https://github.example.com",
};

describe("CollectionTargetService", () => {
  // --- happy path — 3 메서드 각 1+ (call shape + return propagate) ---
  describe("happy path", () => {
    it("create 는 받은 input 을 그대로 repository.create 로 넘기고 결과를 돌려준다", async () => {
      const { service, repoMock } = setup();
      const created = buildTargetFixture({ id: "t-1" });
      repoMock.create.mockResolvedValue(created);
      await expect(service.create(CREATE_INPUT)).resolves.toBe(created);
      expect(repoMock.create).toHaveBeenCalledWith(CREATE_INPUT);
      expect(repoMock.create).toHaveBeenCalledTimes(1);
    });

    it("findAll 은 repository.findMany 를 인자 없이 호출하고 목록을 그대로 돌려준다", async () => {
      const { service, repoMock } = setup();
      const rows = [
        buildTargetFixture({ id: "t-1" }),
        buildTargetFixture({ id: "t-2", type: "CONFLUENCE" }),
      ];
      repoMock.findMany.mockResolvedValue(rows);
      await expect(service.findAll()).resolves.toBe(rows);
      expect(repoMock.findMany).toHaveBeenCalledWith();
    });

    it("findById 는 row 가 있으면 가공 없이 그대로 돌려준다", async () => {
      const { service, repoMock } = setup();
      const found = buildTargetFixture({ id: "t-3" });
      repoMock.findById.mockResolvedValue(found);
      await expect(service.findById("t-3")).resolves.toBe(found);
      expect(repoMock.findById).toHaveBeenCalledWith("t-3");
    });
  });

  // --- error path — ADR-0059 §Decision 5 오류 표 c / d 행 ---
  describe("error path", () => {
    it("create 의 P2002 는 ConflictException (409) 으로 변환된다", async () => {
      const { service, repoMock } = setup();
      repoMock.create.mockRejectedValue(prismaError("P2002"));
      const rejected = service.create(CREATE_INPUT);
      await expect(rejected).rejects.toBeInstanceOf(ConflictException);
      await expect(rejected).rejects.toThrow(
        "collection target already registered: GITHUB/gh-main",
      );
    });

    it("findById 가 null 을 받으면 NotFoundException (404) 으로 변환된다", async () => {
      const { service, repoMock } = setup();
      repoMock.findById.mockResolvedValue(null);
      const rejected = service.findById("missing");
      await expect(rejected).rejects.toBeInstanceOf(NotFoundException);
      await expect(rejected).rejects.toThrow(
        "collection target not found: missing",
      );
    });
  });

  // --- 분기 cover — create 3 분기 / findById 2 분기 ---
  describe("분기 cover", () => {
    it("create 의 非-P2002 Prisma error 는 원본 그대로 raw propagate 된다", async () => {
      const { service, repoMock } = setup();
      const raised = prismaError("P2025");
      repoMock.create.mockRejectedValue(raised);
      await expect(service.create(CREATE_INPUT)).rejects.toBe(raised);
    });

    it("create 의 code 없는 일반 Error 도 원본 그대로 raw propagate 된다", async () => {
      const { service, repoMock } = setup();
      const raised = new Error("연결이 끊겼습니다");
      repoMock.create.mockRejectedValue(raised);
      await expect(service.create(CREATE_INPUT)).rejects.toBe(raised);
    });

    it("findById 의 row 존재 분기와 null 분기가 서로 다르게 동작한다", async () => {
      const { service, repoMock } = setup();
      const found = buildTargetFixture({ id: "t-4" });
      repoMock.findById.mockResolvedValueOnce(found);
      repoMock.findById.mockResolvedValueOnce(null);
      await expect(service.findById("t-4")).resolves.toBe(found);
      await expect(service.findById("t-4")).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  // --- negative cases 충분 cover (task acceptance ① ~ ⑤) ---
  describe("negative cases", () => {
    it("① findAll 은 0 row 여도 throw 하지 않고 빈 배열을 그대로 돌려준다", async () => {
      const { service, repoMock } = setup();
      repoMock.findMany.mockResolvedValue([]);
      await expect(service.findAll()).resolves.toEqual([]);
    });

    it("② create 는 P2025 같은 다른 Prisma code 를 409 로 오변환하지 않는다", async () => {
      const { service, repoMock } = setup();
      repoMock.create.mockRejectedValue(prismaError("P2025"));
      await expect(service.create(CREATE_INPUT)).rejects.not.toBeInstanceOf(
        ConflictException,
      );
    });

    it("③ code 필드가 없는 Error 를 삼키지 않고 그대로 reject 한다", async () => {
      const { service, repoMock } = setup();
      repoMock.create.mockRejectedValue(new Error("code 없음"));
      await expect(service.create(CREATE_INPUT)).rejects.toThrow("code 없음");
    });

    it("③ code 가 string 이 아닌 error (숫자 code) 도 변환 없이 propagate 한다", async () => {
      const { service, repoMock } = setup();
      const raised = Object.assign(new Error("숫자 code"), { code: 2002 });
      repoMock.create.mockRejectedValue(raised);
      await expect(service.create(CREATE_INPUT)).rejects.toBe(raised);
    });

    it("④ 반환 객체에 token / secret / password 계열 key 가 0 개다", async () => {
      const { service, repoMock } = setup();
      const created = buildTargetFixture();
      repoMock.create.mockResolvedValue(created);
      repoMock.findMany.mockResolvedValue([created]);
      repoMock.findById.mockResolvedValue(created);
      const rows = [
        await service.create(CREATE_INPUT),
        ...(await service.findAll()),
        await service.findById("target-default"),
      ];
      for (const row of rows) {
        expect(
          Object.keys(row).filter((key) =>
            /token|secret|password|credential/i.test(key),
          ),
        ).toEqual([]);
        expect(row.instanceKey).toBe("gh-main");
      }
    });

    it("⑤ 도메인 검증을 하지 않는다 — 미허용 type · 빈 필드 · type 별 조건부 필드 조합을 인자 그대로 forward", async () => {
      const { service, repoMock } = setup();
      // (a) 미허용 type + 빈 문자열 필드, (b) GITHUB 인데 spaces 가 채워진 조합.
      const invalid = { type: "SLACK", instanceKey: "", endpoint: "" };
      const odd = { ...CREATE_INPUT, spaces: ["DOCS"], orgs: [] };
      repoMock.create.mockResolvedValue(buildTargetFixture());
      await service.create(invalid);
      await service.create(odd);
      expect(repoMock.create).toHaveBeenNthCalledWith(1, invalid);
      expect(repoMock.create).toHaveBeenNthCalledWith(2, odd);
    });

    it("⑤ findById 는 빈 문자열 id 도 가공 없이 repository 로 넘긴다", async () => {
      const { service, repoMock } = setup();
      repoMock.findById.mockResolvedValue(null);
      await expect(service.findById("")).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(repoMock.findById).toHaveBeenCalledWith("");
    });
  });
});
