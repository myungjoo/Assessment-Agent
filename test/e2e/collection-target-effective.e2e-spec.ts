// collection-target-effective.e2e-spec.ts — API 로 등록한 수집 대상이 실제 수집과 저장 판정에
// 쓰이는지 실 HTTP · 실 DB 로 고정한다 (ADR-0059 §Decision 3).
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
const ENC_KEY_ENV = "LLM_APIKEY_ENC_KEY";
const ADMIN_EMAIL = "effective-target-admin@e2e.test";
// 닫힌 기간 좌표 수 — 일 7 + 직전 주 1 + 직전 월 1.
const CLOSED_COORDINATES = 9;

const DB_HOST = "github.e2edbtarget.test";
const ENV_HOST = "github.e2eenvtarget.test";
const WIKI_HOST = "wiki.e2edbtarget.test";
const DB_TOKEN = "e2e-db-plain-token";

const DB_GITHUB_TARGET = {
  type: "GITHUB",
  instanceKey: "e2edb",
  endpoint: DB_HOST,
  repos: ["org/repo"],
};

const ENV_NAMES = [
  "GITHUB_INSTANCES",
  "GITHUB_E2EENV_HOST",
  "GITHUB_E2EENV_REPOS",
  "GITHUB_E2EENV_TOKEN_ENC",
  "GITHUB_E2EDB_TOKEN_ENC",
  "CONFLUENCE_E2EWIKI_TOKEN_ENC",
];

describe("E2E: 등록 수집 대상의 수집 반영 (ADR-0059 §Decision 3)", () => {
  let ctx: AuthenticatedE2EContext;
  let app: INestApplication;
  let adminCookie: string;
  const realFetch = globalThis.fetch;
  // 가짜 host 로 나간 호출. 이 URL 조각을 포함한 호출만 500 으로 실패시킨다.
  let calls: { url: string; authorization: string }[] = [];
  let failPath: string | null = null;

  const callsTo = (host: string) => calls.filter((c) => c.url.includes(host));

  const encrypt = (plain: string): string =>
    app.get(LlmApiKeyCipher, { strict: false }).encrypt(plain);

  function useEnvTarget(): void {
    Object.assign(process.env, {
      GITHUB_INSTANCES: "e2eenv",
      GITHUB_E2EENV_HOST: ENV_HOST,
      GITHUB_E2EENV_REPOS: "org/repo",
      GITHUB_E2EENV_TOKEN_ENC: encrypt("e2e-env-plain-token"),
    });
  }

  async function register(body: Record<string, unknown>): Promise<string> {
    const response = await request(app.getHttpServer())
      .post(TARGETS_URL)
      .set("Cookie", adminCookie)
      .send(body);
    expect(response.status).toBe(201);
    return (response.body as { id: string }).id;
  }

  async function setActive(id: string, active: boolean): Promise<void> {
    const response = await request(app.getHttpServer())
      .patch(`${TARGETS_URL}/${id}`)
      .set("Cookie", adminCookie)
      .send({ active });
    expect(response.status).toBe(200);
  }

  const createPerson = (...services: string[]) =>
    ctx.prisma.person.create({
      data: {
        fullName: "등록 대상 수집",
        email: "effective-target-person@e2e.test",
        serviceIdentities: {
          create: services.map((service) => ({ service, externalId: "kim" })),
        },
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

  beforeAll(async () => {
    // adapter 가 생성 시점에 fetch 를 잡으므로 app 부팅 전에 교체한다.
    globalThis.fetch = (async (input: unknown, init?: RequestInit) => {
      const url = String(input);
      if (![DB_HOST, ENV_HOST, WIKI_HOST].some((h) => url.includes(h))) {
        return realFetch(input as string, init);
      }
      const headers = new Headers(init?.headers);
      calls.push({ url, authorization: headers.get("authorization") ?? "" });
      const failing = failPath !== null && url.includes(failPath);
      const body = url.includes(WIKI_HOST) ? { results: [] } : [];
      return new Response(JSON.stringify(body), {
        status: failing ? 500 : 200,
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
    failPath = null;
    process.env[ENC_KEY_ENV] = randomBytes(32).toString("base64");
    process.env.GITHUB_E2EDB_TOKEN_ENC = encrypt(DB_TOKEN);
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

  it("등록한 대상이 재기동 없이 수집되고, 비활성화하면 다음 수집에서 빠진다", async () => {
    await createPerson("e2edb");
    const id = await register(DB_GITHUB_TARGET);

    await runCollection();

    expect(callsTo(DB_HOST).length).toBeGreaterThan(0);
    for (const call of callsTo(DB_HOST)) {
      expect(call.authorization).toBe(`Bearer ${DB_TOKEN}`);
    }
    expect(await ctx.prisma.assessment.count()).toBe(CLOSED_COORDINATES);

    await setActive(id, false);
    await ctx.prisma.assessment.deleteMany();
    await runCollection();

    expect(callsTo(DB_HOST)).toEqual([]);
    expect(await ctx.prisma.assessment.count()).toBe(0);
  });

  it("env 대상과 등록 대상을 함께 수집하고, 비활성 대상의 식별자는 env 대상의 저장을 막지 않는다", async () => {
    useEnvTarget();
    await createPerson("e2eenv", "e2edb");
    const id = await register(DB_GITHUB_TARGET);

    await runCollection();

    expect(callsTo(ENV_HOST).length).toBeGreaterThan(0);
    expect(callsTo(DB_HOST).length).toBeGreaterThan(0);
    expect(await ctx.prisma.assessment.count()).toBe(CLOSED_COORDINATES);

    await setActive(id, false);
    await ctx.prisma.assessment.deleteMany();
    await runCollection();

    expect(callsTo(ENV_HOST).length).toBeGreaterThan(0);
    expect(callsTo(DB_HOST)).toEqual([]);
    expect(await ctx.prisma.assessment.count()).toBe(CLOSED_COORDINATES);
  });

  it("같은 key 가 env 에 있으면 env host 로만 나가고, row 를 비활성화해도 env 는 계속 수집된다_n", async () => {
    useEnvTarget();
    await createPerson("e2eenv");
    const id = await register({
      type: "GITHUB",
      instanceKey: "e2eenv",
      endpoint: DB_HOST,
      repos: ["other/repo"],
    });

    await runCollection();

    expect(callsTo(ENV_HOST).length).toBeGreaterThan(0);
    expect(callsTo(DB_HOST)).toEqual([]);
    expect(await ctx.prisma.assessment.count()).toBe(CLOSED_COORDINATES);

    await setActive(id, false);
    await ctx.prisma.assessment.deleteMany();
    await runCollection();

    expect(callsTo(ENV_HOST).length).toBeGreaterThan(0);
    expect(await ctx.prisma.assessment.count()).toBe(CLOSED_COORDINATES);
  });

  it("등록 대상의 호출이 실패하면 좌표를 비워 두고, 복구 후 채운다_n", async () => {
    await createPerson("e2edb");
    await register(DB_GITHUB_TARGET);
    failPath = "/issues";

    await runCollection();

    expect(callsTo(DB_HOST).length).toBeGreaterThan(0);
    expect(await ctx.prisma.assessment.count()).toBe(0);

    failPath = null;
    await runCollection();

    expect(await ctx.prisma.assessment.count()).toBe(CLOSED_COORDINATES);
  });

  it("credential 이 없는 등록 대상은 호출 없이 실패로 쳐서 다른 대상이 있어도 저장하지 않는다_n", async () => {
    useEnvTarget();
    delete process.env.GITHUB_E2EDB_TOKEN_ENC;
    await createPerson("e2eenv", "e2edb");
    await register(DB_GITHUB_TARGET);

    await runCollection();

    expect(callsTo(DB_HOST)).toEqual([]);
    expect(await ctx.prisma.assessment.count()).toBe(0);
  });

  it("복호화할 수 없는 credential 의 등록 대상은 실패로 친다_n", async () => {
    process.env.GITHUB_E2EDB_TOKEN_ENC = "not-a-valid-envelope";
    await createPerson("e2edb");
    await register(DB_GITHUB_TARGET);

    await runCollection();

    expect(callsTo(DB_HOST)).toEqual([]);
    expect(await ctx.prisma.assessment.count()).toBe(0);
  });

  it("등록한 Confluence 대상도 수집하고, 호출이 실패하면 좌표를 비워 둔다", async () => {
    process.env.CONFLUENCE_E2EWIKI_TOKEN_ENC = encrypt("e2e-wiki-plain-token");
    await createPerson("e2ewiki");
    await register({
      type: "CONFLUENCE",
      instanceKey: "e2ewiki",
      endpoint: `https://${WIKI_HOST}/rest/api`,
      spaces: ["SP"],
    });
    failPath = WIKI_HOST;

    await runCollection();

    expect(callsTo(WIKI_HOST).length).toBeGreaterThan(0);
    expect(await ctx.prisma.assessment.count()).toBe(0);

    failPath = null;
    await runCollection();

    expect(callsTo(WIKI_HOST).length).toBeGreaterThan(0);
    expect(await ctx.prisma.assessment.count()).toBe(CLOSED_COORDINATES);
  });
});
