// CollectionTargetRepository spec — T-1809 acceptance (R-112: happy / error /
// branch / negative 4 카테고리 + coverage line·function 100%). PrismaService 의
// `collectionTarget` delegate 를 Jest mock 으로 대체해 PostgreSQL 없이 실행하며,
// 검증축은 (a) 올바른 delegate 를 올바른 인자 shape 으로 호출하는지, (b) return 값
// 그대로 propagate, (c) Prisma error (P2002 / P2025) raw reject, (d) 도메인 검증을
// 본 layer 가 하지 않고 pass-through 하는지 (ADR-0059 §Consequences (c)).
import type { CollectionTarget } from "@prisma/client";

import type { PrismaService } from "../persistence/prisma.service";

import {
  CollectionTargetRepository,
  type CollectionTargetCreateInput,
  type CollectionTargetUpdateInput,
} from "./collection-target.repository";

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

// test 마다 새 mock instance 를 만들어 호출 카운터를 격리하는 factory.
function setup() {
  const targetMock = {
    create: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  };
  const prisma = { collectionTarget: targetMock } as unknown as PrismaService;
  return { repo: new CollectionTargetRepository(prisma), targetMock };
}

// Prisma error 모사 — code 필드만 있으면 상위 layer 의 분기 판정에 충분하다.
function prismaError(code: string): Error & { code: string } {
  return Object.assign(new Error(`Prisma error ${code}`), { code });
}

const CREATE_INPUT: CollectionTargetCreateInput = {
  type: "GITHUB",
  instanceKey: "gh-main",
  endpoint: "https://github.example.com",
};

describe("CollectionTargetRepository", () => {
  // --- happy path — 5 메서드 각 1+ (call shape + return propagate) ---
  describe("happy path", () => {
    it("create 는 { data: input } 으로 호출하고 결과를 그대로 돌려준다", async () => {
      const { repo, targetMock } = setup();
      const created = buildTargetFixture({ id: "t-1" });
      targetMock.create.mockResolvedValue(created);
      await expect(repo.create(CREATE_INPUT)).resolves.toBe(created);
      expect(targetMock.create).toHaveBeenCalledWith({ data: CREATE_INPUT });
    });
    it("findById 는 { where: { id } } 로 findUnique 를 호출한다", async () => {
      const { repo, targetMock } = setup();
      const found = buildTargetFixture({ id: "t-2" });
      targetMock.findUnique.mockResolvedValue(found);
      await expect(repo.findById("t-2")).resolves.toBe(found);
      expect(targetMock.findUnique).toHaveBeenCalledWith({
        where: { id: "t-2" },
      });
    });
    it("findMany 는 인자 없이 호출하고 목록을 그대로 돌려준다", async () => {
      const { repo, targetMock } = setup();
      const rows = [buildTargetFixture()];
      targetMock.findMany.mockResolvedValue(rows);
      await expect(repo.findMany()).resolves.toBe(rows);
      expect(targetMock.findMany).toHaveBeenCalledWith();
    });
    it("update 는 { where: { id }, data: input } 으로 호출한다", async () => {
      const { repo, targetMock } = setup();
      const updated = buildTargetFixture({ active: false });
      targetMock.update.mockResolvedValue(updated);
      const input: CollectionTargetUpdateInput = { active: false };
      await expect(repo.update("t-3", input)).resolves.toBe(updated);
      expect(targetMock.update).toHaveBeenCalledWith({
        where: { id: "t-3" },
        data: input,
      });
    });
    it("delete 는 { where: { id } } 로 호출한다", async () => {
      const { repo, targetMock } = setup();
      const removed = buildTargetFixture({ id: "t-4" });
      targetMock.delete.mockResolvedValue(removed);
      await expect(repo.delete("t-4")).resolves.toBe(removed);
      expect(targetMock.delete).toHaveBeenCalledWith({ where: { id: "t-4" } });
    });
  });

  // --- error path — Prisma error 를 catch 없이 raw propagate ---
  describe("error path", () => {
    it("create 의 P2002 (동일 type+instanceKey 재등록) 를 그대로 reject", async () => {
      const { repo, targetMock } = setup();
      const error = prismaError("P2002");
      targetMock.create.mockRejectedValue(error);
      await expect(repo.create(CREATE_INPUT)).rejects.toBe(error);
    });
    it("update 의 P2025 (row 부재) 를 그대로 reject", async () => {
      const { repo, targetMock } = setup();
      const error = prismaError("P2025");
      targetMock.update.mockRejectedValue(error);
      await expect(repo.update("missing", { active: false })).rejects.toBe(
        error,
      );
    });
    it("delete 의 P2025 (row 부재) 를 그대로 reject", async () => {
      const { repo, targetMock } = setup();
      const error = prismaError("P2025");
      targetMock.delete.mockRejectedValue(error);
      await expect(repo.delete("missing")).rejects.toBe(error);
    });
  });

  // --- 분기 cover — findById null / findMany 빈 배열 / create 선택 필드 ---
  describe("branch", () => {
    it("findById 는 row 부재 시 throw 없이 null 을 돌려준다", async () => {
      const { repo, targetMock } = setup();
      targetMock.findUnique.mockResolvedValue(null);
      await expect(repo.findById("missing")).resolves.toBeNull();
    });
    it("findMany 는 0 row 일 때 빈 배열을 돌려준다", async () => {
      const { repo, targetMock } = setup();
      targetMock.findMany.mockResolvedValue([]);
      await expect(repo.findMany()).resolves.toEqual([]);
    });
    it("create 는 선택 필드 미지정 시 그 키를 넣지 않아 schema default 에 위임", async () => {
      const { repo, targetMock } = setup();
      targetMock.create.mockResolvedValue(buildTargetFixture());
      await repo.create(CREATE_INPUT);
      const { data } = targetMock.create.mock.calls[0][0];
      expect(Object.keys(data).sort()).toEqual([
        "endpoint",
        "instanceKey",
        "type",
      ]);
    });
    it("create 는 선택 필드 명시 시 그 값을 그대로 전달한다", async () => {
      const { repo, targetMock } = setup();
      targetMock.create.mockResolvedValue(buildTargetFixture());
      const input: CollectionTargetCreateInput = {
        ...CREATE_INPUT,
        type: "CONFLUENCE",
        instanceKey: "cf-main",
        orgs: [],
        repos: [],
        spaces: ["ENG"],
        active: false,
      };
      await repo.create(input);
      expect(targetMock.create).toHaveBeenCalledWith({ data: input });
    });
  });

  // --- negative — 검증을 본 layer 가 하지 않음을 고정 ---
  describe("negative", () => {
    it("update 는 빈 객체 {} 도 그대로 forward 한다 (@updatedAt 만 갱신)", async () => {
      const { repo, targetMock } = setup();
      targetMock.update.mockResolvedValue(buildTargetFixture());
      await repo.update("t-5", {});
      expect(targetMock.update).toHaveBeenCalledWith({
        where: { id: "t-5" },
        data: {},
      });
    });
    it("type 값을 검증하지 않고 임의 문자열도 raw pass-through 한다", async () => {
      const { repo, targetMock } = setup();
      targetMock.create.mockResolvedValue(buildTargetFixture());
      const input: CollectionTargetCreateInput = {
        type: "NOT_A_REAL_TYPE",
        instanceKey: "x",
        endpoint: "not-a-url",
      };
      await repo.create(input);
      expect(targetMock.create).toHaveBeenCalledWith({ data: input });
    });
    it("CollectionTargetUpdateInput 에 정체성 축이 부재한다 (drift guard)", () => {
      // Record 의 key 집합이 interface 와 정확히 일치해야 compile 된다 — type /
      // instanceKey 가 추가되면 이 리터럴이 컴파일 실패해 test 가 깨진다.
      const updatableKeys: Record<keyof CollectionTargetUpdateInput, true> = {
        endpoint: true,
        orgs: true,
        repos: true,
        spaces: true,
        active: true,
      };
      expect(Object.keys(updatableKeys).sort()).toEqual([
        "active",
        "endpoint",
        "orgs",
        "repos",
        "spaces",
      ]);
    });
    it("GITHUB 인데 spaces 가 찬 type 별 부정합도 거르지 않고 넘긴다", async () => {
      const { repo, targetMock } = setup();
      targetMock.create.mockResolvedValue(buildTargetFixture());
      const input: CollectionTargetCreateInput = {
        ...CREATE_INPUT,
        instanceKey: "gh-odd",
        spaces: ["ENG"],
      };
      await repo.create(input);
      expect(targetMock.create).toHaveBeenCalledWith({ data: input });
    });
  });
});
