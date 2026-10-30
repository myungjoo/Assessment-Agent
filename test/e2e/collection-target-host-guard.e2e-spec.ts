// collection-target-host-guard.e2e-spec.ts — 등록 대상의 허용 host 검사가 자동 평가와 수동 경로
// 모두에서 token 전송을 막는지 실 HTTP · 실 DB 로 고정한다 (ADR-0059 §Consequences (e)).
//
// 외부 host 만 globalThis.fetch 로 대체한다. 활동 0 건만 돌려주므로 LLM 은 호출되지 않는다.
// 실 GitHub · 실 Confluence · 실 LLM 은 검증하지 않는다.
import { randomBytes } from "node:crypto";

import type { INestApplication } from "@nestjs/common";
import request from "supertest";

import { LlmApiKeyCipher } from "../../src/llm/llm-apikey-cipher.service";
import { RunStatusService } from "../../src/run-status/run-status.service";
import {
  buildAuthCookie,
  createAuthenticatedE2EApp,
  type AuthenticatedE2EContext,
} from "../helpers/auth-e2e-helper";

const TARGETS_URL = "/api/collection-targets";
const TRIGGER_URL = "/api/schedules/trigger";
const COLLECT_URL = "/api/assessment-collection/collect";
const PERIOD_URL = "/api/assessment-evaluation/period";
const ENC_KEY_ENV = "LLM_APIKEY_ENC_KEY";
const ADMIN_EMAIL = "host-guard-admin@e2e.test";
// 닫힌 기간 좌표 수 — 일 7 + 직전 주 1 + 직전 월 1.
const CLOSED_COORDINATES = 9;

const DB_HOST = "github.e2eguard.test";
const WIKI_HOST = "wiki.e2eguard.test";
const EVIL_HOST = "evil.e2eguard.test";
const TOKEN = "e2e-guard-plain-token";

const ALLOWED_ENV = "GITHUB_E2EGUARD_ALLOWED_HOST";
const WIKI_ALLOWED_ENV = "CONFLUENCE_E2EGUARDWIKI_ALLOWED_HOST";
const ENV_NAMES = [
  ALLOWED_ENV,
  WIKI_ALLOWED_ENV,
  "GITHUB_E2EGUARD_TOKEN_ENC",
  "CONFLUENCE_E2EGUARDWIKI_TOKEN_ENC",
];

const githubTarget = (endpoint: string) => ({
  type: "GITHUB",
  instanceKey: "e2eguard",
  endpoint,
  repos: ["org/repo"],
});

const wikiTarget = (endpoint: string) => ({
  type: "CONFLUENCE",
  instanceKey: "e2eguardwiki",
  endpoint,
  spaces: ["SP"],
});

describe("E2E: 등록 수집 대상의 허용 host 검사 (ADR-0059 §Consequences (e))", () => {
  let ctx: AuthenticatedE2EContext;
  let app: INestApplication;
  let adminCookie: string;
  const realFetch = globalThis.fetch;
  // .test host 로 나간 모든 호출.
  let calls: { url: string; authorization: string }[] = [];

  const encrypt = (plain: string): string =>
    app.get(LlmApiKeyCipher, { strict: false }).encrypt(plain);

  async function register(body: Record<string, unknown>): Promise<void> {
    const response = await request(app.getHttpServer())
      .post(TARGETS_URL)
      .set("Cookie", adminCookie)
      .send(body);
    expect(response.status).toBe(201);
  }

  const createPerson = (service: string) =>
    ctx.prisma.person.create({
      data: {
        fullName: "허용 host 검사",
        email: "host-guard-person@e2e.test",
        serviceIdentities: { create: [{ service, externalId: "kim" }] },
      },
    });

  async function waitIdle(): Promise<void> {
    const status = app.get(RunStatusService, { strict: false });
    const deadline = Date.now() + 4_000;
    while (status.snapshot().evaluation.active) {
      if (Date.now() > deadline) {
        throw new Error("평가 실행이 4 초 안에 끝나지 않았다");
      }
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
  }

  async function runCollection(): Promise<void> {
    calls = [];
    const response = await request(app.getHttpServer())
      .post(TRIGGER_URL)
      .set("Cookie", adminCookie);
    expect(response.status).toBe(202);
    await waitIdle();
  }

  const postManual = (url: string, personId: string) => {
    calls = [];
    return request(app.getHttpServer())
      .post(url)
      .set("Cookie", adminCookie)
      .send({
        personId,
        period: "week",
        scope: "commit",
        periodStart: "2026-05-01T00:00:00.000Z",
      });
  };

  const expectSentOnlyTo = (host: string): void => {
    expect(calls.length).toBeGreaterThan(0);
    for (const call of calls) {
      expect(new URL(call.url).hostname).toBe(host);
      expect(call.authorization).toBe(`Bearer ${TOKEN}`);
    }
  };

  beforeAll(async () => {
    // adapter 가 생성 시점에 fetch 를 잡으므로 app 부팅 전에 교체한다.
    globalThis.fetch = (async (input: unknown, init?: RequestInit) => {
      const url = String(input);
      if (!new URL(url).hostname.endsWith(".test")) {
        return realFetch(input as string, init);
      }
      const headers = new Headers(init?.headers);
      calls.push({ url, authorization: headers.get("authorization") ?? "" });
      const body = url.includes(WIKI_HOST) ? { results: [] } : [];
      return new Response(JSON.stringify(body), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
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
    calls = [];
    process.env[ENC_KEY_ENV] = randomBytes(32).toString("base64");
    process.env.GITHUB_E2EGUARD_TOKEN_ENC = encrypt(TOKEN);
    process.env.CONFLUENCE_E2EGUARDWIKI_TOKEN_ENC = encrypt(TOKEN);
    await ctx.prisma.collectionTarget.deleteMany();
    await ctx.prisma.llmProviderConfig.deleteMany();
    await ctx.prisma.llmProviderConfig.create({
      data: {
        provider: "openai-compatible",
        endpointUrl: "http://llm.e2e.test/v1",
        apiKey: "e2e-placeholder-key",
        modelId: "test-model",
      },
    });
  });

  afterEach(async () => {
    await waitIdle();
    for (const name of ENV_NAMES) {
      delete process.env[name];
    }
    await ctx.prisma.collectionTarget.deleteMany();
    await ctx.prisma.assessment.deleteMany();
    await ctx.prisma.person.deleteMany();
    await ctx.prisma.llmProviderConfig.deleteMany();
  });

  it("허용 host 가 없으면 호출 · Authorization 0 이고 좌표를 비워 두며, 설정하면 재기동 없이 수집한다_n", async () => {
    await createPerson("e2eguard");
    await register(githubTarget(DB_HOST));

    await runCollection();

    expect(calls).toEqual([]);
    expect(await ctx.prisma.assessment.count()).toBe(0);

    process.env[ALLOWED_ENV] = DB_HOST;
    await runCollection();

    expectSentOnlyTo(DB_HOST);
    expect(await ctx.prisma.assessment.count()).toBe(CLOSED_COORDINATES);
  });

  it("허용 host 와 다르면 Admin 이 고른 host 로 나가지 않는다_n", async () => {
    process.env[ALLOWED_ENV] = DB_HOST;
    await createPerson("e2eguard");
    await register(githubTarget(EVIL_HOST));

    await runCollection();

    expect(calls).toEqual([]);
    expect(await ctx.prisma.assessment.count()).toBe(0);

    process.env[ALLOWED_ENV] = EVIL_HOST;
    await runCollection();

    expectSentOnlyTo(EVIL_HOST);
  });

  it.each([
    ["userinfo", `${DB_HOST}@${EVIL_HOST}`],
    ["suffix", `${DB_HOST}.${EVIL_HOST}`],
    ["path", `${EVIL_HOST}/${DB_HOST}`],
  ])("%s 우회 endpoint 로 나가지 않는다_n", async (_label, endpoint) => {
    process.env[ALLOWED_ENV] = DB_HOST;
    await createPerson("e2eguard");
    await register(githubTarget(endpoint));

    await runCollection();

    expect(calls).toEqual([]);
    expect(await ctx.prisma.assessment.count()).toBe(0);
  });

  it("Confluence 는 https 와 허용 host 를 모두 만족해야 수집한다", async () => {
    process.env[WIKI_ALLOWED_ENV] = WIKI_HOST;
    await createPerson("e2eguardwiki");
    await register(wikiTarget(`http://${WIKI_HOST}/rest/api`));

    await runCollection();

    expect(calls).toEqual([]);
    expect(await ctx.prisma.assessment.count()).toBe(0);

    const row = await ctx.prisma.collectionTarget.findFirstOrThrow();
    await request(app.getHttpServer())
      .patch(`${TARGETS_URL}/${row.id}`)
      .set("Cookie", adminCookie)
      .send({ endpoint: `https://${WIKI_HOST}/rest/api` })
      .expect(200);
    await runCollection();

    expectSentOnlyTo(WIKI_HOST);
    expect(await ctx.prisma.assessment.count()).toBe(CLOSED_COORDINATES);
  });

  it.each([
    ["POST /collect", COLLECT_URL, 201],
    ["POST /period", PERIOD_URL, 200],
  ])("%s 도 같은 규칙을 따른다", async (_label, url, status) => {
    const person = await createPerson("e2eguard");
    await register(githubTarget(DB_HOST));

    const rejected = await postManual(url, person.id);

    expect(rejected.status).toBe(status);
    expect(calls).toEqual([]);

    // 수동 경로는 저장 판정이 없어 거부 row 만 가진 인원도 좌표를 만든다. 같은 좌표 재요청 충돌을 비운다.
    await ctx.prisma.assessment.deleteMany();
    process.env[ALLOWED_ENV] = DB_HOST;
    const allowed = await postManual(url, person.id);

    expect(allowed.status).toBe(status);
    expectSentOnlyTo(DB_HOST);
  });
});
