// import-restore-transaction.e2e-spec — `ImportRestoreTransactionService.restore()` 의 실
// PostgreSQL 원자성 왕복 e2e (T-1276, REQ-030 / REQ-032). ADR-0055 §Follow-up (b) 복원 엔진
// chain 실행 조각 **3b-2b** — 3b-2a (T-1275, PR #1166) 가 배선한 단일 `$transaction` 이
// ADR-0044 §3 의 atomic 복원을 실제로 보장하는지 실 DB 사실로 확인한다.
// mock unit (`import-restore-transaction.service.spec.ts`) 과의 분업: 호출 횟수 · 순서 · 입력
// 비변형처럼 **흉내로 증명 가능한 것** 은 그쪽이 이미 덮었다. 본 spec 은 mock 으로 증명
// **불가능** 한 것만 본다 — 실 rollback · 실 Prisma 제약 거부 · 실 row 상태. 하지 않는 것:
// HTTP · RBAC · module provider 등록 (3c) / production 코드 수정 0.
// 매핑 pin 갱신 (T-1278, 실행 조각 **3b-2c-2**): 아래 매핑 test 는 원래 "본 service 가 감싸지
// 않는다 (매핑 부재)" 를 pin 했고 스스로 갱신을 예고했다 — 배선이 닫힌 지금은 실 P2002 가 실제로
// `ConflictException` 409 로 나오는지를 **실 DB 사실** 로 본다 (mock 은 실 제약 code 를 못 만든다).
// 실 DB 전략: AppModule · supertest · JWT 없이 `Test.createTestingModule` 로 PrismaService +
// 본 service 만 올린다 (truncate 후 actor User re-seed 부담 0 — T-0520 사고 회피). CI 의
// `pnpm test:e2e` step + `services.postgres` 에서 실행되고, 로컬은 `DATABASE_URL` 부재 시
// globalSetup 이 fail-fast 한다 (본 spec 만의 skip 분기 0). 격리: 각 `it` 이 자기 seed 로
// 시작하고 `afterEach` 의 `truncateAll` 로 끝난다 — 순서 의존 · 전역 mutable 상태 0.
// timeout 관측 (PR #1166 NIT-4 회수): 본 규모 (row 10 건 미만) 왕복은 수백 ms 로 끝나
// `IMPORT_RESTORE_TRANSACTION_OPTIONS` 의 `maxWait` 10s · `timeout` 120s 어디에도 닿지 않고,
// 실 Prisma 커넥션 풀 대기 · Postgres `statement_timeout` 과도 경합하지 않았다 (값 조정 0).
import { ConflictException } from "@nestjs/common";
import { Test, type TestingModule } from "@nestjs/testing";

import { type FullExportRecord } from "../../src/export/export-full-record";
import { type ExportRecord } from "../../src/export/export-scope-select";
import { type ImportRestorePlan } from "../../src/export/import-restore-plan";
import { ImportRestoreTransactionService } from "../../src/import/import-restore-transaction.service";
import { PrismaService } from "../../src/persistence/prisma.service";
import { truncateAll } from "../helpers/db-truncate";

type Entity = ExportRecord["entity"];
type Fields = Record<string, unknown>;
type Plan = ImportRestorePlan<FullExportRecord>;

// 실패 경로에서 프로젝트 산출물에 실려선 안 되는 payload sentinel (REQ-032).
const MARKER = "leak-me-T1276-payload";
// seed instant — row 마다 **다른** 값이어야 한다. delete 는 `{ createdAt: { in: [...] } }` 로
// 나가므로 같은 createdAt 을 공유하면 의도치 않은 row 까지 함께 지워진다.
const AT = (s: number): Date => new Date(Date.UTC(2026, 6, 20, 9, 0, s));

// plan / record 조립 helper — 본 service 는 `toKeep` 을 읽지 않으므로 항상 빈 배열이다.
function planOf(toDelete: ExportRecord[], toInsert: FullExportRecord[]): Plan {
  return { toDelete, toInsert, toKeep: [] };
}
function del(entity: Entity, instant: Date): ExportRecord {
  return { entity, instant };
}
function ins(entity: Entity, fields: Fields): FullExportRecord {
  return { entity, instant: AT(0), fields };
}

describe("E2E: ImportRestoreTransactionService.restore 실 DB 원자성 (T-1276)", () => {
  let moduleRef: TestingModule;
  let prisma: PrismaService;
  let service: ImportRestoreTransactionService;

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      providers: [PrismaService, ImportRestoreTransactionService],
    }).compile();
    await moduleRef.init();
    prisma = moduleRef.get(PrismaService);
    service = moduleRef.get(ImportRestoreTransactionService);
  });
  afterEach(async () => {
    await truncateAll(prisma);
  });
  afterAll(async () => {
    await moduleRef.close();
    await prisma.$disconnect();
  });

  // 공통 seed factory — Group 2 건 (삭제 대상 A · 보존 대상 B) + Person 1 건. **DB 가 돌려준
  // row** 를 그대로 반환하므로 `toDelete[].instant` 는 그 `createdAt` 을 쓰면 되고, 정밀도
  // 불일치로 0 건이 삭제되는 함정이 생기지 않는다. 시나리오별 사본을 만들지 않는다.
  const mkGroup = (name: string, at: Date) =>
    prisma.group.create({ data: { name, createdAt: at } });
  const seed = async () => ({
    groupA: await mkGroup("삭제-A", AT(1)),
    groupB: await mkGroup("보존-B", AT(2)),
    person: await prisma.person.create({
      data: { fullName: "보존", email: "k@t1276.test", createdAt: AT(3) },
    }),
  });
  const counts = async () => ({
    group: await prisma.group.count(),
    person: await prisma.person.count(),
  });
  const hasGroup = async (id: string) =>
    (await prisma.group.count({ where: { id } })) === 1;
  const hasPerson = async (id: string) =>
    (await prisma.person.count({ where: { id } })) === 1;

  it("delete + insert 혼합 plan 이 실 DB 에 반영되고 반환 합계와 row 변화량이 일치한다", async () => {
    const { groupA, groupB, person } = await seed();
    const result = await service.restore(
      planOf(
        [del("Group", groupA.createdAt)],
        [
          ins("Person", { id: "p-new", fullName: "신규", email: "n@t.test" }),
          ins("Group", { id: "g-new", name: "새 그룹" }),
        ],
      ),
    );
    expect(result).toMatchObject({ deleted: 1, inserted: 2 });
    // delete 가 모든 insert 앞 (FK 를 끊고 다시 잇는 순서) — insert 는 Person < Group.
    expect(result.outcomes.map((o) => o.phase)).toEqual([
      "delete",
      "insert",
      "insert",
    ]);
    expect(await hasGroup(groupA.id)).toBe(false);
    expect(await hasGroup("g-new")).toBe(true);
    expect(await hasPerson("p-new")).toBe(true);
    // 손대지 않은 row 보존.
    expect(await hasGroup(groupB.id)).toBe(true);
    expect(await hasPerson(person.id)).toBe(true);
    // 합계만 맞고 DB 는 안 바뀌는 회귀 차단 — seed(group 2 / person 1) → -1 delete, +2 insert.
    expect(await counts()).toEqual({ group: 2, person: 2 });
  });

  it("빈 plan 은 빈 결과를 돌려주고 DB 를 전혀 건드리지 않는다", async () => {
    await seed();
    const before = await counts();
    await expect(service.restore(planOf([], []))).resolves.toEqual({
      outcomes: [],
      deleted: 0,
      inserted: 0,
    });
    expect(await counts()).toEqual(before);
  });

  it("delete-only plan 은 대상 row 만 지우고 나머지를 보존한다", async () => {
    const { groupA, groupB, person } = await seed();
    const plan = planOf([del("Group", groupA.createdAt)], []);
    expect(await service.restore(plan)).toMatchObject({
      deleted: 1,
      inserted: 0,
    });
    expect(await counts()).toEqual({ group: 1, person: 1 });
    expect(await hasGroup(groupB.id)).toBe(true);
    expect(await hasPerson(person.id)).toBe(true);
  });

  // 본 task 의 핵심 — step 순서는 delete Group → insert Person → insert Group 이라, 마지막
  // Group insert 가 실 PK 제약을 위반하면 **앞선 delete 와 앞선 insert 가 모두 되돌아가야** 한다.
  it("중간 step 실패 시 선행 delete · 선행 insert 가 전량 rollback 된다", async () => {
    const { groupA, groupB } = await seed();
    const before = await counts();
    await expect(
      service.restore(
        planOf(
          [del("Group", groupA.createdAt)],
          [
            ins("Person", { id: "p-roll", fullName: "롤백", email: "r@t.io" }),
            ins("Group", { id: groupB.id, name: `중복-PK-${MARKER}` }),
          ],
        ),
      ),
    ).rejects.toThrow();
    // (a) 선행 delete 대상이 여전히 존재 / (b) 먼저 성공했던 insert row 가 하나도 남지 않음 /
    // (c) 전체 row 수가 seed 직후와 동일.
    expect(await hasGroup(groupA.id)).toBe(true);
    expect(await hasPerson("p-roll")).toBe(false);
    expect(await counts()).toEqual(before);
  });

  it("실 PK 중복 (실 P2002) 은 ConflictException 409 로 매핑된다 (3b-2c-2 갱신)", async () => {
    const { groupA, groupB } = await seed();
    const error: unknown = await service
      .restore(
        planOf(
          [del("Group", groupA.createdAt)],
          [ins("Group", { id: groupB.id, name: `중복-PK-${MARKER}` })],
        ),
      )
      .catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(ConflictException);
    expect((error as ConflictException).getStatus()).toBe(409);
    expect((error as Error).message).toMatch(/고유 제약을 위반/);
    // 원본 Prisma error 는 매핑에 흡수되고 code · 이름이 응답 객체로 새어 나오지 않는다.
    expect((error as Error).name).not.toMatch(/^PrismaClient/);
    expect((error as { code?: string }).code).toBeUndefined();
    // REQ-032 — 메시지에도 `getResponse()` 직렬화에도 원본 문구 · payload sentinel 0.
    const dump = `${(error as Error).message} ${JSON.stringify(
      (error as ConflictException).getResponse(),
    )}`;
    expect(dump).not.toContain(MARKER);
    expect(dump).not.toMatch(/PrismaClient|Unique constraint/);
  });

  it.each<[string, "group" | "person"]>([
    ["Group PK 중복", "group"],
    ["Person email 중복", "person"],
  ])("실 unique 제약 위반 (%s) 은 reject + 원상 복귀", async (_label, kind) => {
    const { groupA, groupB, person } = await seed();
    const before = await counts();
    const bad =
      kind === "group"
        ? ins("Group", { id: groupB.id, name: `중복-${MARKER}` })
        : ins("Person", { id: "p-dup", fullName: "중복", email: person.email });
    await expect(
      service.restore(planOf([del("Group", groupA.createdAt)], [bad])),
    ).rejects.toThrow();
    expect(await counts()).toEqual(before);
    expect(await hasGroup(groupA.id)).toBe(true);
  });

  it.each<[string, Fields]>([
    ["없는 컬럼", { id: "g-bad", name: "나쁜 그룹", nope: MARKER }],
    ["타입 불일치", { id: "g-bad", name: 12345 }],
  ])(
    "Prisma 가 거부하는 fields (%s) 는 부분 삽입 0 + 원상 복귀",
    async (_l, f) => {
      const { groupA } = await seed();
      const before = await counts();
      await expect(
        service.restore(
          planOf([del("Group", groupA.createdAt)], [ins("Group", f)]),
        ),
      ).rejects.toThrow();
      expect(await hasGroup("g-bad")).toBe(false);
      expect(await counts()).toEqual(before);
    },
  );

  it.each<[string, () => Plan, RegExp]>([
    [
      "instant 가 비-Date",
      () =>
        planOf(
          [{ entity: "Group", instant: MARKER } as unknown as ExportRecord],
          [],
        ),
      /유효한 Date/,
    ],
    [
      "entity 가 5 종 밖",
      () =>
        planOf(
          [{ entity: "Nope", instant: AT(1) } as unknown as ExportRecord],
          [],
        ),
      /export entity 5 종/,
    ],
  ])(
    "조립 결함 (%s) 은 상류 한국어 throw 전파 + DB 무변화",
    async (_l, build, re) => {
      await seed();
      const before = await counts();
      const error: unknown = await service
        .restore(build())
        .catch((caught: unknown) => caught);
      expect((error as Error).message).toMatch(re);
      // REQ-032 — 프로젝트가 만든 메시지에 payload sentinel 이 실리지 않는다 (종류 이름만).
      expect((error as Error).message).not.toContain(MARKER);
      expect(await counts()).toEqual(before);
    },
  );

  it("존재하지 않는 instant 로 삭제하는 plan 은 reject 0 · deleted 0 · row 보존", async () => {
    await seed();
    const before = await counts();
    const result = await service.restore(planOf([del("Group", AT(59))], []));
    expect(result).toMatchObject({ deleted: 0, inserted: 0 });
    expect(await counts()).toEqual(before);
  });
});
