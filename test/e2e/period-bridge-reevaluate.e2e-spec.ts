// period-bridge-reevaluate.e2e-spec.ts — POST /api/assessment-evaluation/period 의
// **reevaluate replace 실측 + 동시 reevaluate 수렴 semantics 실측** e2e
// (T-0337, ADR-0038 slice 4). Admin full-persist e2e(T-0323,
// period-bridge-admin-persist.e2e-spec.ts)의 실 DB/no-network/lifecycle 전략을
// 1:1 mirror 하되 **reevaluate flag 분기(ADR-0038 §Decision3/4/5)** 에 집중한다
// (기존 first-write-wins idempotency 케이스 중복 작성 0).
//
// 책임:
//   - replace 실측(§Decision2/3): 같은 좌표 Admin + reevaluate:true → 성공 + count 1
//     stable + 새 assessmentId(B ≠ A) + B.createdAt > A.createdAt. no-network 전략상
//     두 평가의 content 는 동일할 수 있으므로(빈 수집 → 빈 결과) **replace 의
//     authoritative 신호는 id 변화 + createdAt 증가 + count stable**(content diff 아님).
//   - default first-write-wins 보존(§Decision3 회귀 0): reevaluate:false 명시/미지정
//     read-through + 좌표 부재 reevaluate:true create degrade(에러 아님).
//   - 동시 reevaluate 2건 수렴 실측(§Decision5 의무) — 해당 test 상단 주석 참조.
//   - negative(§Decision4 (ii) + R-112 항목 2·4): User 403(영속 0/기존 row 무변경)·
//     wrong-type 400·미인증 401 — 각각 영속 변경 0.
//
// no-network/실 DB 전략(template 동일): target Person 빈 serviceIdentities seed →
// fetch 0/LLM 0 → 빈 결과 → valid Assessment 1 row(contributions 0). mock override
// 0(ADR-0004), afterEach truncateAll, DATABASE_URL 부재 시 CI 전용(PR CI green 인증).
import type { INestApplication } from "@nestjs/common";
import request from "supertest";

import { PrismaService } from "../../src/persistence/prisma.service";
import {
  buildAuthCookie,
  createAuthenticatedE2EApp,
  type AuthenticatedE2EContext,
} from "../helpers/auth-e2e-helper";
import { truncateAll } from "../helpers/db-truncate";

// NestJS ValidationPipe message 는 string 또는 string[] 모두 cover.
const messageText = (body: { message: unknown }): string =>
  Array.isArray(body.message)
    ? (body.message as string[]).join(" ")
    : String(body.message);

const PERIOD = "/api/assessment-evaluation/period";

// 좌표 base — 같은 4-tuple 재사용. persist 정합 valid 값 "week"/"commit"(template 동일).
const validBody = (personId: string) => ({
  personId,
  period: "week",
  scope: "commit",
  periodStart: "2026-05-01T00:00:00.000Z",
});

describe("E2E: POST /api/assessment-evaluation/period — reevaluate replace·동시성 수렴 (T-0337, ADR-0038 §Decision3/4/5)", () => {
  let ctx: AuthenticatedE2EContext;
  let app: INestApplication;
  let prisma: PrismaService;

  // Admin actor — reevaluate trigger 권한(§Decision4 Admin only).
  const adminEmail = "reeval-admin@e2e.test";
  let adminCookie: string;

  // User actor — User + reevaluate fail-closed 403 negative(§Decision4 (ii)) 검증용.
  const userEmail = "reeval-user@e2e.test";
  let userCookie: string;

  beforeAll(async () => {
    ctx = await createAuthenticatedE2EApp([
      { role: "Admin", email: adminEmail },
      { role: "User", email: userEmail },
    ]);
    app = ctx.app;
    prisma = ctx.prisma;
    adminCookie = buildAuthCookie(ctx.tokens[adminEmail]);
    userCookie = buildAuthCookie(ctx.tokens[userEmail]);
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  afterEach(async () => {
    await truncateAll(prisma);
  });

  // target Person seed — 빈 serviceIdentities → no-network(template 동일).
  async function seedTargetPerson(): Promise<string> {
    const person = await prisma.person.create({
      data: {
        fullName: "재평가대상",
        email: `reeval-target-${Date.now()}-${Math.random()}@example.test`,
      },
    });
    return person.id;
  }

  function postPeriod(cookie: string, body: object) {
    return request(app.getHttpServer())
      .post(PERIOD)
      .set("Cookie", cookie)
      .send(body);
  }

  // 좌표 seed — Admin default(fill) 첫 호출로 좌표 create 후 row A 를 read-back.
  async function seedCoordinate(
    personId: string,
  ): Promise<{ id: string; createdAt: Date }> {
    const first = await postPeriod(adminCookie, validBody(personId));
    expect(first.status).toBe(200);
    expect(await prisma.assessment.count()).toBe(1);
    const row = await prisma.assessment.findUnique({
      where: { id: first.body.assessmentId },
    });
    expect(row).not.toBeNull();
    return { id: row!.id, createdAt: row!.createdAt };
  }

  // 영속 변경 0 검증 — negative case 의 회귀 차단(template 동일).
  async function expectNoPersistedRows(): Promise<void> {
    expect(await prisma.assessment.count()).toBe(0);
    expect(await prisma.contribution.count()).toBe(0);
  }

  // -- replace 실측 (happy-path — reset-and-recreate, §Decision2/3) --

  it("같은 좌표 Admin + reevaluate:true 시 200 + count 1 stable + 새 assessmentId + createdAt 증가 (replace 실측)", async () => {
    const personId = await seedTargetPerson();
    const a = await seedCoordinate(personId);

    const response = await postPeriod(adminCookie, {
      ...validBody(personId),
      reevaluate: true,
    });

    expect(response.status).toBe(200);
    // reeval 경로의 created 는 항상 true(replace 든 degrade 든 fresh row — slice 2b 박제).
    expect(response.body.created).toBe(true);
    // 새 assessmentId(B ≠ A) + count 1 stable — delete→create 의 NEW row 실증(증가 0).
    const idB = response.body.assessmentId;
    expect(typeof idB).toBe("string");
    expect(idB).not.toBe(a.id);
    expect(await prisma.assessment.count()).toBe(1);
    // 이전 row A 는 hard delete 로 부재(파괴적 교체 — §Decision5 v1 acceptable).
    expect(
      await prisma.assessment.findUnique({ where: { id: a.id } }),
    ).toBeNull();
    // NEW row B — 좌표 보존 + createdAt 이 A 보다 뒤(fresh create 실증).
    const rowB = await prisma.assessment.findUnique({ where: { id: idB } });
    expect(rowB).not.toBeNull();
    expect(rowB?.personId).toBe(personId);
    expect(rowB?.period).toBe("week");
    expect(rowB?.scope).toBe("commit");
    expect(rowB!.createdAt.getTime()).toBeGreaterThan(a.createdAt.getTime());
  });

  // -- default first-write-wins 보존 (flow/branch, §Decision3 회귀 0) --

  it("좌표 존재 + reevaluate:false 명시 시 200 + count 1 + 동일 assessmentId (default first-write-wins 보존)", async () => {
    const personId = await seedTargetPerson();
    const a = await seedCoordinate(personId);

    const response = await postPeriod(adminCookie, {
      ...validBody(personId),
      reevaluate: false,
    });

    expect(response.status).toBe(200);
    // read-through — write 0, 기존 저장본 그대로(동일 id + count 불변).
    expect(response.body.assessmentId).toBe(a.id);
    expect(response.body.created).toBe(false);
    expect(await prisma.assessment.count()).toBe(1);
  });

  it("replace 후 reevaluate 미지정 호출 시 200 + 교체된 row 로 read-through (미지정 default 보존)", async () => {
    const personId = await seedTargetPerson();
    const a = await seedCoordinate(personId);
    // replace — NEW row B 로 교체.
    const reeval = await postPeriod(adminCookie, {
      ...validBody(personId),
      reevaluate: true,
    });
    expect(reeval.status).toBe(200);
    const idB = reeval.body.assessmentId;
    expect(idB).not.toBe(a.id);

    // 미지정(default) — 교체된 B 를 read-through(write 0, 새 replace 미발생).
    const response = await postPeriod(adminCookie, validBody(personId));

    expect(response.status).toBe(200);
    expect(response.body.assessmentId).toBe(idB);
    expect(await prisma.assessment.count()).toBe(1);
  });

  it("좌표 부재 + reevaluate:true 시 200 + count 0→1 create degrade (에러 아님 — §Decision3 idempotent 진입)", async () => {
    const personId = await seedTargetPerson();
    expect(await prisma.assessment.count()).toBe(0);

    const response = await postPeriod(adminCookie, {
      ...validBody(personId),
      reevaluate: true,
    });

    expect(response.status).toBe(200);
    expect(response.body.created).toBe(true);
    expect(await prisma.assessment.count()).toBe(1);
    const row = await prisma.assessment.findUnique({
      where: { id: response.body.assessmentId },
    });
    expect(row?.personId).toBe(personId);
  });

  // -- 동시 reevaluate 2건 수렴 실측 (§Decision5 의무) --
  // 관측 가능 outcome(비결정 — run/timing 따라 다름, 둘 다 valid 수렴):
  //   (i) 둘 다 200 — 자연 직렬화(last-write-wins, 뒤 commit 이 앞 row 재교체).
  //   (ii) 한쪽 409 — 경합 loser 의 P2002 → ConflictException 전파(reeval 경로는
  //        read-through 위장 없이 전파 — silent 유실 0). 그 외(500 누출 등)는 결함.

  it("동시 reevaluate 2건 시 각 status ∈ {200,409} + 성공 ≥ 1 + 최종 count 1 + 최소 1회 replace (§Decision5 수렴 실측)", async () => {
    const personId = await seedTargetPerson();
    const a = await seedCoordinate(personId);
    const body = { ...validBody(personId), reevaluate: true };

    const [r1, r2] = await Promise.all([
      postPeriod(adminCookie, body),
      postPeriod(adminCookie, body),
    ]);

    // 각 응답은 성공(200) 또는 Conflict(409) — invariant 밖 status 는 결함 노출.
    for (const r of [r1, r2]) {
      expect([200, 409]).toContain(r.status);
    }
    // 성공 ≥ 1건 — 적어도 한 호출의 재평가는 영속화된다.
    const successes = [r1, r2].filter((r) => r.status === 200);
    expect(successes.length).toBeGreaterThanOrEqual(1);
    // 최종 count 정확히 1 — 중복 row 0 + 유실 0(수렴).
    expect(await prisma.assessment.count()).toBe(1);
    // 생존 row — 좌표 일치 + 첫 create 의 A 와 다른 id(최소 1회 replace 발생).
    const survivor = await prisma.assessment.findFirst();
    expect(survivor).not.toBeNull();
    expect(survivor?.personId).toBe(personId);
    expect(survivor?.period).toBe("week");
    expect(survivor?.scope).toBe("commit");
    expect(survivor?.id).not.toBe(a.id);
  });

  // -- negative ×4 (§Decision4 (ii) fail-closed + ValidationPipe + JwtAuthGuard) --

  it("User + reevaluate:true 시 403 + 영속 변경 0 (negative — 재평가는 Admin 전용 fail-closed)", async () => {
    const personId = await seedTargetPerson();

    const response = await postPeriod(userCookie, {
      ...validBody(personId),
      reevaluate: true,
    });

    expect(response.status).toBe(403);
    expect(messageText(response.body)).toMatch(/재평가.*Admin 전용/);
    await expectNoPersistedRows();
  });

  it("User + reevaluate:true + 좌표 기존재 시 403 + 기존 row 무변경 (negative — 파괴 0)", async () => {
    const personId = await seedTargetPerson();
    const a = await seedCoordinate(personId);

    const response = await postPeriod(userCookie, {
      ...validBody(personId),
      reevaluate: true,
    });

    expect(response.status).toBe(403);
    // 기존 row 무변경 — id/createdAt 불변(replace 미발생, count 불변).
    expect(await prisma.assessment.count()).toBe(1);
    const row = await prisma.assessment.findUnique({ where: { id: a.id } });
    expect(row).not.toBeNull();
    expect(row?.createdAt.getTime()).toBe(a.createdAt.getTime());
  });

  it('wrong-type reevaluate:"yes" 시 400 + 영속 변경 0 (negative — ValidationPipe @IsBoolean)', async () => {
    const personId = await seedTargetPerson();

    const response = await postPeriod(adminCookie, {
      ...validBody(personId),
      reevaluate: "yes",
    });

    expect(response.status).toBe(400);
    expect(response.body.statusCode).toBe(400);
    expect(messageText(response.body)).toMatch(/reevaluate/);
    await expectNoPersistedRows();
  });

  it("cookie 부재 + reevaluate:true 시 401 + 영속 변경 0 (negative — JwtAuthGuard)", async () => {
    const personId = await seedTargetPerson();

    const response = await request(app.getHttpServer())
      .post(PERIOD)
      .send({ ...validBody(personId), reevaluate: true });

    expect(response.status).toBe(401);
    await expectNoPersistedRows();
  });
});
