// 최근 N일 재수집이 실 DB 에서 어떤 row 를 교체하고 무엇을 남기는지 고정한다 (REQ-041, README 74 행).
// 외부 host 만 globalThis.fetch 로 대체한다. 실 GitHub · 실 LLM 은 검증하지 않는다.
import { randomBytes } from "node:crypto";

import type { INestApplication } from "@nestjs/common";
import request from "supertest";

import { startOfKstDay } from "../../src/common/period-boundary";
import { LlmApiKeyCipher } from "../../src/llm/llm-apikey-cipher.service";
import {
  buildAuthCookie,
  createAuthenticatedE2EApp,
  type AuthenticatedE2EContext,
} from "../helpers/auth-e2e-helper";

const GITHUB_HOST = "github.e2erefresh.test";
const LLM_HOST = "llm.e2erefresh.test";
const GITHUB_ENV = {
  GITHUB_INSTANCES: "e2erefresh",
  GITHUB_E2EREFRESH_HOST: GITHUB_HOST,
  GITHUB_E2EREFRESH_REPOS: "org/repo",
};
const ADMIN_EMAIL = "recent-refresh-admin@e2e.test";
const DAY_MS = 24 * 60 * 60 * 1000;

const url = (personId: string): string =>
  `/api/schedules/recent-deletion/${personId}`;

describe("E2E: 최근 N일 재수집 row 교체 (REQ-041)", () => {
  let ctx: AuthenticatedE2EContext;
  let app: INestApplication;
  let adminCookie: string;
  let githubStatus = 200;
  let githubCommits: unknown[] = [];
  let llmStatus = 200;
  let holdGithub: Promise<void> | null = null;
  const realFetch = globalThis.fetch;

  const jsonResponse = (body: unknown, status = 200): Response =>
    Response.json(body, { status });

  const yesterday = (): Date =>
    new Date(startOfKstDay(new Date()).getTime() - DAY_MS);
  const today = (): Date => startOfKstDay(new Date());
  const daysAgo = (days: number): Date =>
    new Date(today().getTime() - days * DAY_MS);

  const commit = (date: Date): unknown => ({
    sha: `sha-${date.getTime()}`,
    commit: { author: { name: "kim", date: date.toISOString() } },
    author: { login: "kim" },
  });

  const createPerson = (email: string, identities = 1) =>
    ctx.prisma.person.create({
      data: {
        fullName: email,
        email,
        serviceIdentities: {
          create: Array.from({ length: identities }, () => ({
            service: "e2erefresh",
            externalId: "kim",
          })),
        },
      },
    });

  // 이전 평가를 흉내 낸 row. Contribution 1 건을 달아 cascade 교체를 확인한다.
  const seedRow = (personId: string, periodStart: Date) => {
    const scored = { difficulty: "easy", contributionScore: 1, volume: 1 };
    const contribution = {
      ...scored,
      sourceType: "commit",
      sourceUrl: "https://example.test/old",
      sourceRef: "old-sha",
    };
    return ctx.prisma.assessment.create({
      data: {
        ...scored,
        personId,
        period: "day",
        scope: "aggregate",
        periodStart,
        narrative: "이전 평가",
        contributions: { create: [contribution] },
      },
    });
  };

  const post = (personId: string, days: number) =>
    request(app.getHttpServer())
      .post(url(personId))
      .set("Cookie", adminCookie)
      .send({ days });

  async function runToEnd(
    personId: string,
    days: number,
  ): Promise<Record<string, unknown>> {
    expect((await post(personId, days)).status).toBe(202);
    return waitForResult(personId);
  }

  async function waitForResult(
    personId: string,
  ): Promise<Record<string, unknown>> {
    const deadline = Date.now() + 8_000;
    while (Date.now() < deadline) {
      const status = await request(app.getHttpServer())
        .get(url(personId))
        .set("Cookie", adminCookie);
      expect(status.status).toBe(200);
      if (!status.body.running) {
        return status.body.result as Record<string, unknown>;
      }
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    throw new Error("재수집이 8 초 안에 끝나지 않았다");
  }

  const unchanged = async (row: { id: string; narrative: string }) => {
    const current = await ctx.prisma.assessment.findUnique({
      where: { id: row.id },
      include: { contributions: true },
    });
    expect(current?.narrative).toBe(row.narrative);
    expect(current?.contributions).toHaveLength(1);
  };

  beforeAll(async () => {
    globalThis.fetch = (async (input: unknown, init?: RequestInit) => {
      const target = String(input);
      if (target.includes(LLM_HOST)) {
        return jsonResponse(
          { choices: [{ message: { content: "새 평가" } }] },
          llmStatus,
        );
      }
      if (!target.includes(GITHUB_HOST)) {
        return realFetch(input as string, init);
      }
      await holdGithub;
      const body = target.includes("/commits") ? githubCommits : [];
      return jsonResponse(body, githubStatus);
    }) as typeof fetch;
    ctx = await createAuthenticatedE2EApp([
      { role: "Admin", email: ADMIN_EMAIL },
    ]);
    app = ctx.app;
    adminCookie = buildAuthCookie(ctx.tokens[ADMIN_EMAIL]);
  });

  afterAll(async () => {
    await app.close();
    await ctx.prisma.$disconnect();
    globalThis.fetch = realFetch;
  });

  beforeEach(async () => {
    githubStatus = 200;
    githubCommits = [];
    llmStatus = 200;
    holdGithub = null;
    process.env.LLM_APIKEY_ENC_KEY = randomBytes(32).toString("base64");
    Object.assign(process.env, GITHUB_ENV, {
      GITHUB_E2EREFRESH_TOKEN_ENC: app
        .get(LlmApiKeyCipher, { strict: false })
        .encrypt("e2e-token"),
    });
    await ctx.prisma.llmProviderConfig.create({
      data: {
        provider: "custom",
        endpointUrl: `http://${LLM_HOST}/v1`,
        apiKey: app
          .get(LlmApiKeyCipher, { strict: false })
          .encrypt("e2e-llm-key"),
        modelId: "test-model",
      },
    });
  });

  afterEach(async () => {
    for (const key of [
      ...Object.keys(GITHUB_ENV),
      "GITHUB_E2EREFRESH_TOKEN_ENC",
    ]) {
      delete process.env[key];
    }
    await ctx.prisma.permissionDeniedRecord.deleteMany();
    await ctx.prisma.summary.deleteMany();
    await ctx.prisma.assessment.deleteMany();
    await ctx.prisma.person.deleteMany();
    await ctx.prisma.llmProviderConfig.deleteMany();
  });

  it("창 안 row 만 새 평가로 교체하고 창 밖 · 오늘 · 다른 인원 · Summary 는 그대로다", async () => {
    const target = await createPerson("refresh-target@e2e.test");
    const other = await createPerson("refresh-other@e2e.test");
    const inWindow = await seedRow(target.id, yesterday());
    const beforeWindow = await seedRow(target.id, daysAgo(2));
    const todayRow = await seedRow(target.id, today());
    const otherRow = await seedRow(other.id, yesterday());
    const summary = await ctx.prisma.summary.create({
      data: {
        personId: target.id,
        period: "day",
        periodStart: yesterday(),
        narrative: "이전 요약",
        metricScore: 1,
      },
    });
    githubCommits = [commit(new Date(yesterday().getTime() + 1_000))];

    const result = await runToEnd(target.id, 1);

    expect(result).toMatchObject({
      deletedCount: 1,
      refreshedCount: 1,
      notRefreshedCount: 0,
      aborted: false,
    });
    const replaced = await ctx.prisma.assessment.findFirst({
      where: { personId: target.id, period: "day", periodStart: yesterday() },
      include: { contributions: true },
    });
    expect(replaced?.id).not.toBe(inWindow.id);
    expect(replaced?.narrative).toContain("새 평가");
    expect(replaced?.contributions.map((c) => c.sourceRef)).not.toContain(
      "old-sha",
    );
    expect(replaced?.contributions).toHaveLength(1);
    await unchanged(beforeWindow);
    await unchanged(todayRow);
    await unchanged(otherRow);
    expect(
      await ctx.prisma.summary.findUnique({ where: { id: summary.id } }),
    ).toMatchObject({ narrative: "이전 요약" });
    expect(await ctx.prisma.assessment.count()).toBe(4);
  });

  it("저장본이 없던 닫힌 날도 채운다", async () => {
    const target = await createPerson("refresh-gap@e2e.test");
    const result = await runToEnd(target.id, 1);
    expect(result).toMatchObject({ deletedCount: 0, refreshedCount: 1 });
    expect(await ctx.prisma.assessment.count()).toBe(1);
  });

  it("식별자가 없으면 이전 row 를 빈 평가로 덮지 않는다_n", async () => {
    const target = await createPerson("refresh-none@e2e.test", 0);
    const row = await seedRow(target.id, yesterday());

    const result = await runToEnd(target.id, 1);

    expect(result).toMatchObject({ deletedCount: 0, notRefreshedCount: 1 });
    await unchanged(row);
  });

  it("GitHub 장애면 이전 row 를 그대로 두고 not refreshed 로 알린다_n", async () => {
    const target = await createPerson("refresh-down@e2e.test");
    const row = await seedRow(target.id, yesterday());
    githubStatus = 500;

    const result = await runToEnd(target.id, 1);

    expect(result).toMatchObject({ deletedCount: 0, notRefreshedCount: 1 });
    await unchanged(row);
    expect(await ctx.prisma.assessment.count()).toBe(1);
  });

  it("LLM 장애면 이전 row 를 그대로 둔다_n", async () => {
    const target = await createPerson("refresh-llm@e2e.test");
    const row = await seedRow(target.id, yesterday());
    githubCommits = [commit(new Date(yesterday().getTime() + 1_000))];
    llmStatus = 500;

    const result = await runToEnd(target.id, 1);

    expect(result).toMatchObject({ deletedCount: 0, notRefreshedCount: 1 });
    await unchanged(row);
  });

  it("실행 중 재요청은 409 이고 row 를 건드리지 않는다_n", async () => {
    const target = await createPerson("refresh-busy@e2e.test");
    const row = await seedRow(target.id, yesterday());
    let release = (): void => undefined;
    holdGithub = new Promise((resolve) => {
      release = resolve;
    });
    githubStatus = 500;

    expect((await post(target.id, 1)).status).toBe(202);
    const during = await request(app.getHttpServer())
      .get(url(target.id))
      .set("Cookie", adminCookie);
    expect(during.body).toMatchObject({ running: true, result: null });
    expect((await post(target.id, 1)).status).toBe(409);
    release();
    await waitForResult(target.id);
    await unchanged(row);
  });
});
