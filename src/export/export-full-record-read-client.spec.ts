// export-full-record-read-client.spec — T-1283 캐스팅 helper 의 R-112 4 종 (happy / error /
// 분기 / negative 충분 cover). 실 DB 0 · 실 PrismaService 인스턴스화 0 — 좁은 mock 객체만으로
// **runtime identity** 와 **부작용 0** 을 고정한다. 본문에 분기가 0 (조건문 · 삼항 · optional
// chaining 0) 이라 분기별 test 대신 **입력 형태별 case** 가 모두 identity 로 통과함을 단언해
// "분기 없음" 을 고정한다 (방어 guard · 복제 · Proxy 가 몰래 들어오면 fail).
import { type PrismaService } from "../persistence/prisma.service";

import { type ExportFullRecordReadDelegate } from "./export-full-record-collect";
import { asExportFullRecordReadClient } from "./export-full-record-read-client";

// EXPORT_ENTITY_SOURCES 가 요구하는 실제 delegate key 5 개 (본 spec 의 기대값).
const DELEGATE_KEYS = [
  "assessment",
  "person",
  "group",
  "llmProviderConfig",
  "permissionDeniedRecord",
] as const;

type MockClient = Record<string, ExportFullRecordReadDelegate> & {
  $transaction: jest.Mock;
};

// 좁은 mock client — delegate 5 개 각각이 projection-only findMany 하나만 제공한다.
function makeClient(): MockClient {
  const client = { $transaction: jest.fn() } as Record<string, unknown>;
  for (const key of DELEGATE_KEYS) {
    client[key] = { findMany: jest.fn().mockResolvedValue([]) };
  }
  return client as MockClient;
}

// 임의 입력을 helper 시그니처에 태우는 통로 — 타입 계약을 우회해 runtime 동작만 본다.
function cast(input: unknown): PrismaService {
  return input as unknown as PrismaService;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value as Record<string, unknown>;
}

describe("asExportFullRecordReadClient", () => {
  describe("happy path", () => {
    it("입력 client 를 같은 참조 그대로 돌려준다 (runtime identity)", () => {
      const client = makeClient();
      expect(asExportFullRecordReadClient(cast(client))).toBe(client);
    });

    it("반환값의 5 delegate key 가 입력 그대로 접근되고 findMany 가 입력 mock 을 호출한다", async () => {
      const client = makeClient();
      const narrowed = asExportFullRecordReadClient(cast(client));
      for (const key of DELEGATE_KEYS) {
        expect(narrowed[key]).toBe(client[key]);
        await expect(
          narrowed[key].findMany({ select: { id: true } }),
        ).resolves.toEqual([]);
        expect(client[key].findMany).toHaveBeenCalledWith({
          select: { id: true },
        });
      }
    });
  });

  describe("error path", () => {
    it("null / undefined 를 넘겨도 throw 하지 않고 그대로 돌려준다 (검증 책임 0)", () => {
      expect(() => asExportFullRecordReadClient(cast(null))).not.toThrow();
      expect(asExportFullRecordReadClient(cast(null))).toBeNull();
      expect(() => asExportFullRecordReadClient(cast(undefined))).not.toThrow();
      expect(asExportFullRecordReadClient(cast(undefined))).toBeUndefined();
    });

    it("findMany 가 reject 하는 client 도 helper 단계에서는 아무 일이 없다 (reject 는 실 호출 시점)", async () => {
      const boom = new Error("delegate 실패");
      const client = makeClient();
      client.person.findMany = jest.fn().mockRejectedValue(boom);
      const narrowed = asExportFullRecordReadClient(cast(client));
      expect(client.person.findMany).not.toHaveBeenCalled();
      await expect(
        narrowed.person.findMany({ select: { id: true } }),
      ).rejects.toBe(boom);
    });
  });

  describe("분기 없음 — 입력 형태별 identity", () => {
    it.each([
      ["일반 객체", makeClient()],
      ["빈 객체", {}],
      ["frozen 객체", Object.freeze({ person: { findMany: jest.fn() } })],
      ["배열", [1, 2, 3]],
      ["원시값(문자열)", "prisma"],
      ["원시값(0)", 0],
      ["null", null],
      ["undefined", undefined],
    ])("%s 입력이 동일하게 identity 로 통과한다", (_label, input) => {
      expect(asExportFullRecordReadClient(cast(input))).toBe(input);
    });
  });

  describe("negative cases", () => {
    it("(a) 입력 객체를 변형하지 않는다 (key 집합 동일 · 신규 key 0 · frozen 통과)", () => {
      const client = makeClient();
      const before = Object.keys(client).sort();
      const narrowed = asExportFullRecordReadClient(cast(client));
      expect(Object.keys(client).sort()).toEqual(before);
      expect(Object.keys(asRecord(narrowed)).sort()).toEqual(before);
      const frozen = Object.freeze(makeClient());
      expect(asExportFullRecordReadClient(cast(frozen))).toBe(frozen);
      expect(Object.isFrozen(frozen)).toBe(true);
    });

    it("(b) helper 호출만으로는 어떤 delegate 도 호출되지 않는다 ($transaction 포함 0 회)", () => {
      const client = makeClient();
      asExportFullRecordReadClient(cast(client));
      for (const key of DELEGATE_KEYS) {
        expect(client[key].findMany).not.toHaveBeenCalled();
      }
      expect(client.$transaction).not.toHaveBeenCalled();
    });

    it("(c) getter property 를 가진 입력에서 property 접근이 0 회다 (복제 · Proxy · 얕은 read 0)", () => {
      const getter = jest.fn(() => ({ findMany: jest.fn() }));
      const client = {};
      Object.defineProperty(client, "person", {
        get: getter,
        enumerable: true,
      });
      asExportFullRecordReadClient(cast(client));
      expect(getter).not.toHaveBeenCalled();
    });

    it("(d) 같은 입력으로 두 번 호출하면 두 반환값이 서로 동일하다 (새 wrapper · 캐시 0)", () => {
      const client = makeClient();
      const first = asExportFullRecordReadClient(cast(client));
      const second = asExportFullRecordReadClient(cast(client));
      expect(first).toBe(second);
      expect(first).toBe(client);
    });

    it("(e) delegate 가 일부 누락된 부분 client 도 runtime throw 0 이다 (타입 차원 계약일 뿐)", () => {
      const partial = { person: { findMany: jest.fn() } };
      expect(() => asExportFullRecordReadClient(cast(partial))).not.toThrow();
      const narrowed = asRecord(asExportFullRecordReadClient(cast(partial)));
      expect(narrowed).toBe(partial);
      expect(narrowed.assessment).toBeUndefined();
    });

    it("(f) 반환값에 apiKey 같은 secret key · 진단 문자열이 추가되지 않는다 (REQ-032)", () => {
      const client = makeClient();
      const narrowed = asRecord(asExportFullRecordReadClient(cast(client)));
      expect(Object.keys(narrowed)).toEqual(Object.keys(client));
      for (const leaked of ["apiKey", "secret", "token", "__narrowedBy"]) {
        expect(leaked in narrowed).toBe(false);
      }
    });
  });
});
