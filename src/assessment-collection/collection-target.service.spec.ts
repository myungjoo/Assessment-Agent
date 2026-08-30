// CollectionTargetService spec — T-1810 (read + create 축) · T-1811 (update + delete 축)
// acceptance (R-112: happy / error / branch /
// negative 4 카테고리 + 신규 파일 line·function 100%). CollectionTargetRepository 를 Jest
// mock 으로 대체해 PostgreSQL 없이 실행하며, 검증축은 (a) 올바른 primitive 를 올바른 인자
// shape 으로 호출하는지, (b) 반환값 그대로 propagate, (c) ADR-0059 §Decision 5 오류 표
// c (P2002 → 409) / d (row 부재 → 404) 행 변환, (d) 도메인 검증 · credential 가공 부재.
import { ConflictException, NotFoundException } from "@nestjs/common";
import type { CollectionTarget } from "@prisma/client";

import type {
  CollectionTargetCreateInput,
  CollectionTargetRepository,
  CollectionTargetUpdateInput,
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

// update 의 기본 input — PATCH 축 (정체성 축 type / instanceKey 는 타입상 부재).
const UPDATE_INPUT: CollectionTargetUpdateInput = {
  endpoint: "https://github.example.com/v2",
  active: false,
};

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

// T-1811 — update / delete 축. 기존 describe 는 손대지 않고 신규 블록만 추가한다.
// 검증축은 위와 동일하되 변환 대상 code 가 `P2025` (§Decision 5 오류 표 d 행) 다.
describe("CollectionTargetService update / delete", () => {
  // --- happy path — 두 메서드 각 1+ (call shape + return propagate) ---
  describe("happy path", () => {
    it("update 는 (id, input) 을 그대로 repository.update 로 넘기고 결과를 돌려준다", async () => {
      const { service, repoMock } = setup();
      const updated = buildTargetFixture({ id: "t-1", active: false });
      repoMock.update.mockResolvedValue(updated);
      await expect(service.update("t-1", UPDATE_INPUT)).resolves.toBe(updated);
      expect(repoMock.update).toHaveBeenCalledWith("t-1", UPDATE_INPUT);
      expect(repoMock.update).toHaveBeenCalledTimes(1);
    });

    it("delete 는 id 를 그대로 repository.delete 로 넘기고 삭제된 row 를 돌려준다", async () => {
      const { service, repoMock } = setup();
      const removed = buildTargetFixture({ id: "t-2" });
      repoMock.delete.mockResolvedValue(removed);
      await expect(service.delete("t-2")).resolves.toBe(removed);
      expect(repoMock.delete).toHaveBeenCalledWith("t-2");
      expect(repoMock.delete).toHaveBeenCalledTimes(1);
    });
  });

  // --- error path — ADR-0059 §Decision 5 오류 표 d 행 (:id row 부재 → 404) ---
  describe("error path", () => {
    it("update 의 P2025 는 NotFoundException (404) 으로 변환된다", async () => {
      const { service, repoMock } = setup();
      repoMock.update.mockRejectedValue(prismaError("P2025"));
      const rejected = service.update("missing", UPDATE_INPUT);
      await expect(rejected).rejects.toBeInstanceOf(NotFoundException);
      await expect(rejected).rejects.toThrow(
        "collection target not found: missing",
      );
    });

    it("delete 의 P2025 는 NotFoundException (404) 으로 변환된다", async () => {
      const { service, repoMock } = setup();
      repoMock.delete.mockRejectedValue(prismaError("P2025"));
      const rejected = service.delete("gone");
      await expect(rejected).rejects.toBeInstanceOf(NotFoundException);
      await expect(rejected).rejects.toThrow(
        "collection target not found: gone",
      );
    });
  });

  // --- 분기 cover — 두 메서드 각각 (P2025 변환 / 非-P2025 code / code 부재) 3 분기 ---
  describe("분기 cover", () => {
    it("update 의 非-P2025 Prisma error 는 원본 그대로 raw propagate 된다", async () => {
      const { service, repoMock } = setup();
      const raised = prismaError("P2002");
      repoMock.update.mockRejectedValue(raised);
      await expect(service.update("t-1", UPDATE_INPUT)).rejects.toBe(raised);
    });

    it("update 의 code 없는 일반 Error 도 원본 그대로 raw propagate 된다", async () => {
      const { service, repoMock } = setup();
      const raised = new Error("연결이 끊겼습니다");
      repoMock.update.mockRejectedValue(raised);
      await expect(service.update("t-1", UPDATE_INPUT)).rejects.toBe(raised);
    });

    it("delete 의 非-P2025 Prisma error 는 원본 그대로 raw propagate 된다", async () => {
      const { service, repoMock } = setup();
      const raised = prismaError("P2003");
      repoMock.delete.mockRejectedValue(raised);
      await expect(service.delete("t-1")).rejects.toBe(raised);
    });

    it("delete 의 code 없는 일반 Error 도 원본 그대로 raw propagate 된다", async () => {
      const { service, repoMock } = setup();
      const raised = new Error("트랜잭션이 중단됐습니다");
      repoMock.delete.mockRejectedValue(raised);
      await expect(service.delete("t-1")).rejects.toBe(raised);
    });
  });

  // --- negative cases 충분 cover (task acceptance ① ~ ⑤) ---
  describe("negative cases", () => {
    it("① update 는 빈 객체 {} 도 throw 없이 그대로 forward 한다 (@updatedAt 갱신 semantics 보존)", async () => {
      const { service, repoMock } = setup();
      const touched = buildTargetFixture({
        updatedAt: new Date("2026-02-02T00:00:00.000Z"),
      });
      repoMock.update.mockResolvedValue(touched);
      const empty: CollectionTargetUpdateInput = {};
      await expect(service.update("t-1", empty)).resolves.toBe(touched);
      expect(repoMock.update).toHaveBeenCalledWith("t-1", empty);
    });

    it("② update 는 P2002 를 404 로 오변환하지 않는다", async () => {
      const { service, repoMock } = setup();
      repoMock.update.mockRejectedValue(prismaError("P2002"));
      await expect(
        service.update("t-1", UPDATE_INPUT),
      ).rejects.not.toBeInstanceOf(NotFoundException);
    });

    it("③ delete 는 P2003 같은 다른 code 를 삼키지 않고 그대로 reject 한다", async () => {
      const { service, repoMock } = setup();
      repoMock.delete.mockRejectedValue(prismaError("P2003"));
      const rejected = service.delete("t-1");
      await expect(rejected).rejects.not.toBeInstanceOf(NotFoundException);
      await expect(rejected).rejects.toThrow("Prisma error P2003");
    });

    it("③ code 가 string 이 아닌 error (숫자 code) 도 두 메서드 모두 변환 없이 propagate 한다", async () => {
      const { service, repoMock } = setup();
      const raised = Object.assign(new Error("숫자 code"), { code: 2025 });
      repoMock.update.mockRejectedValue(raised);
      repoMock.delete.mockRejectedValue(raised);
      await expect(service.update("t-1", UPDATE_INPUT)).rejects.toBe(raised);
      await expect(service.delete("t-1")).rejects.toBe(raised);
    });

    it("④ update / delete 반환 객체에 token / secret / password 계열 key 가 0 개다", async () => {
      const { service, repoMock } = setup();
      const row = buildTargetFixture();
      repoMock.update.mockResolvedValue(row);
      repoMock.delete.mockResolvedValue(row);
      const rows = [
        await service.update("target-default", UPDATE_INPUT),
        await service.delete("target-default"),
      ];
      for (const each of rows) {
        expect(
          Object.keys(each).filter((key) =>
            /token|secret|password|credential/i.test(key),
          ),
        ).toEqual([]);
        expect(each.instanceKey).toBe("gh-main");
      }
    });

    it("⑤ 도메인 검증을 하지 않는다 — 빈 문자열 · 빈 배열 조합도 인자 그대로 forward", async () => {
      const { service, repoMock } = setup();
      // GITHUB row 인데 spaces 만 채우는 등 type 별 조건부 필수성은 DTO 소관 — 본 layer 는
      // 검증 0 이므로 인자가 그대로 repository 에 도달해야 한다.
      const odd: CollectionTargetUpdateInput = {
        endpoint: "",
        orgs: [],
        spaces: ["DOCS"],
      };
      repoMock.update.mockResolvedValue(buildTargetFixture());
      repoMock.delete.mockResolvedValue(buildTargetFixture());
      await service.update("", odd);
      await service.delete("");
      expect(repoMock.update).toHaveBeenCalledWith("", odd);
      expect(repoMock.delete).toHaveBeenCalledWith("");
    });
  });
});
