// CollectionTargetReader spec — 매 호출 DB 조회와 오류 전파를 고정한다.
import type { PrismaService } from "../persistence/prisma.service";

import { CollectionTargetReader } from "./collection-target-reader.service";

function makeReader(findMany: jest.Mock): CollectionTargetReader {
  return new CollectionTargetReader({
    collectionTarget: { findMany },
  } as unknown as PrismaService);
}

describe("CollectionTargetReader", () => {
  it("비활성 row 를 거르지 않고 그대로 돌려준다", async () => {
    const rows = [{ instanceKey: "a", active: false }];
    const findMany = jest.fn().mockResolvedValue(rows);

    await expect(makeReader(findMany).findAll()).resolves.toBe(rows);
    expect(findMany.mock.calls[0][0].where).toBeUndefined();
  });

  it("캐시하지 않아 변경이 다음 호출에 보인다", async () => {
    const findMany = jest
      .fn()
      .mockResolvedValueOnce([{ instanceKey: "a" }])
      .mockResolvedValueOnce([]);
    const reader = makeReader(findMany);

    await expect(reader.findAll()).resolves.toHaveLength(1);
    await expect(reader.findAll()).resolves.toEqual([]);
  });

  it("DB 오류는 삼키지 않는다_n", async () => {
    const findMany = jest.fn().mockRejectedValue(new Error("db down"));

    await expect(makeReader(findMany).findAll()).rejects.toThrow("db down");
  });
});
