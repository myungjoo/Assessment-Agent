// signup-failure-contract.e2e-spec.ts — `POST /api/users` 실패 응답 **body 의 축별 사유
// 문자열 계약** 을 고정하는 e2e (T-1716).
//
// 책임 경계 (users.e2e-spec.ts 와 중복 아님): **status** 는 users.e2e-spec.ts 의 signup describe
// 가 담당하고(400 / 409 / 201 자체), **응답 body 의 축별 사유 문자열 계약** 은 본 spec 이 담당한다
// — `message` 가 배열인지 · 각 위반이 별도 문자열로 분리되는지 · 중복 축(409)에 형식/길이 어휘가
// 섞이지 않는지 · 실패 body 에 평문 password / hashedPassword 가 새지 않는지. 단언 축이 갈리므로
// 중복이 아니며 기존 it 는 수정하지 않는다.
//
// 왜 필요한가 (REQ-068 / REQ-069, docs/requirements.md 87~88 행): REQ-068 은 "실패 사유를 구체적으로
// 표시(포괄 문구 금지)", REQ-069 는 "중복 아이디와 형식·길이 위반을 구분" 을 요구하며 verify 축이
// `unit + e2e` 다. 표시 측(web/src/api/signupError.ts 의 MESSAGE_MAP)의 key 는 backend
// class-validator 문구 **원문** 이라 backend DTO 문구가 바뀌면 web 은 조용히 fallback 문구로 퇴화하고
// 어떤 test 도 그 회귀를 잡지 못한다. 본 spec 이 backend 가 실제로 내려주는 문자열을 고정하고 마지막
// drift guard 가 그 5 종이 소비 측 매핑표의 key 로 남아 있는지를 대조해 양방향 회귀를 red 로 만든다.
//
// 실행 관용구는 기존 signup describe 와 동일(격리 app + finally 정리)이라 실행 순서와 무관하다.
// Out of Scope: backend 문구의 한국어화 · web/ 수정(읽기만) · 기존 signup it 의 이관/삭제.
import { readFileSync } from "node:fs";
import { join } from "node:path";

import request from "supertest";

import type {
  AuthenticatedE2EContext,
  SeedUserInput,
} from "../helpers/auth-e2e-helper";
import { createAuthenticatedE2EApp } from "../helpers/auth-e2e-helper";
import { truncateAll } from "../helpers/db-truncate";

// 실패 응답 body 의 관측 surface — NestJS 의 기본 exception body 형태.
interface FailureBody {
  statusCode?: number;
  message?: string | string[];
}
// backend 가 실제로 내려주는 class-validator 문구 5 종 — 소비 측 MESSAGE_MAP 의 key 정본.
const CONTRACT_MESSAGES = {
  emailFormat: "email must be an email",
  emailEmpty: "email should not be empty",
  passwordMinLength: "password must be longer than or equal to 8 characters",
  passwordEmpty: "password should not be empty",
  passwordType: "password must be a string",
} as const;
// 형식/길이 축 전용 어휘 — 409(중복) body 에 절대 섞이면 안 되는 토큰(REQ-069 구분 축).
const INVALID_INPUT_VOCABULARY = [
  "must be an email",
  "longer than or equal",
  "should not be empty",
];
// 본 spec 이 실행 중 backend 응답에서 실제로 관측한 문구 누적 — 마지막 drift guard 가 소비.
const observedMessages = new Set<string>();
// 격리 app 1 개를 띄워 run 을 수행하고 반드시 정리한다(기존 signup describe 의 try/finally 관용구).
async function withSignupApp(
  seed: SeedUserInput[],
  run: (ctx: AuthenticatedE2EContext) => Promise<void>,
): Promise<void> {
  const ctx = await createAuthenticatedE2EApp(seed);
  try {
    await run(ctx);
  } finally {
    await truncateAll(ctx.prisma);
    await ctx.app.close();
    await ctx.prisma.$disconnect();
  }
}
// signup 호출 1 회 — 비정상 type payload 도 그대로 보낼 수 있어야 하므로 unknown 을 받는다.
async function postSignup(
  ctx: AuthenticatedE2EContext,
  payload: unknown,
): Promise<request.Response> {
  return request(ctx.app.getHttpServer())
    .post("/api/users")
    .send(payload as object);
}
// 400 body 의 message 를 배열로 확정하고 관측 목록에 누적한다.
function messagesOf(body: FailureBody): string[] {
  expect(Array.isArray(body.message)).toBe(true);
  const items = body.message as string[];
  items.forEach((item) => {
    expect(typeof item).toBe("string");
    observedMessages.add(item);
  });
  return items;
}
// 소비 측 매핑표(web/src/api/signupError.ts)의 MESSAGE_MAP key 목록을 원문에서 뽑는다.
// web 은 별도 package 라 import 하지 않고 파일을 읽기만 한다(Out of Scope 준수).
function extractMessageMapKeys(source: string): string[] {
  const start = source.indexOf("const MESSAGE_MAP");
  expect(start).toBeGreaterThanOrEqual(0);
  const end = source.indexOf("\n};", start);
  expect(end).toBeGreaterThan(start);
  return Array.from(source.slice(start, end).matchAll(/^\s*'([^']+)':/gm)).map(
    (m) => m[1],
  );
}

describe("E2E: POST /api/users 실패 응답 body 의 축별 사유 계약 (REQ-068 / REQ-069)", () => {
  // happy-path — 두 축이 동시에 위반되면 사유가 **각각** 별도 문자열로 온다(REQ-068).
  it("happy — email 형식 위반 + password 8 자 미만 동시 위반 시 400 이고 두 사유가 각각 온다", async () => {
    await withSignupApp([], async (ctx) => {
      const response = await postSignup(ctx, {
        email: "not-an-email",
        password: "short",
      });
      expect(response.status).toBe(400);
      const items = messagesOf(response.body as FailureBody);
      expect(items).toContain(CONTRACT_MESSAGES.emailFormat);
      expect(items).toContain(CONTRACT_MESSAGES.passwordMinLength);
      expect(items.length).toBeGreaterThanOrEqual(2);
      // 두 축이 한 문자열로 뭉쳐 오지 않는다 — 각 항목은 한 축만 언급한다.
      const merged = items.filter(
        (item) => item.startsWith("email") && item.includes("password"),
      );
      expect(merged).toEqual([]);
    });
  });

  // error path — 409 중복 축은 형식/길이 어휘와 섞이지 않는다(REQ-069).
  it("error — 중복 email 재요청 시 409 이고 body 는 중복 사실만 담는다(형식·길이 어휘 불포함)", async () => {
    await withSignupApp(
      [{ role: "SuperAdmin", email: "dup-contract@e2e.test" }],
      async (ctx) => {
        const response = await postSignup(ctx, {
          email: "dup-contract@e2e.test",
          password: "securepass",
        });
        expect(response.status).toBe(409);
        const body = response.body as FailureBody;
        // 409 의 message 는 **문자열 1 개** (ConflictException 의 string 인자).
        expect(typeof body.message).toBe("string");
        const message = body.message as string;
        expect(message).toContain("already exists");
        INVALID_INPUT_VOCABULARY.forEach((token) => {
          expect(message).not.toContain(token);
        });
      },
    );
  });

  // 분기 cover — POST /api/users 의 실패 분기마다 1+.
  it("분기 ① — email 누락 시 400 이고 'email should not be empty' 사유가 온다", async () => {
    await withSignupApp([], async (ctx) => {
      const response = await postSignup(ctx, { password: "securepass" });
      expect(response.status).toBe(400);
      expect(messagesOf(response.body as FailureBody)).toContain(
        CONTRACT_MESSAGES.emailEmpty,
      );
    });
  });

  it("분기 ② — password 빈 문자열이면 400 이고 'password should not be empty' 사유가 온다", async () => {
    await withSignupApp([], async (ctx) => {
      const response = await postSignup(ctx, {
        email: "empty-pw@e2e.test",
        password: "",
      });
      expect(response.status).toBe(400);
      expect(messagesOf(response.body as FailureBody)).toContain(
        CONTRACT_MESSAGES.passwordEmpty,
      );
    });
  });

  it("분기 ③ — password 가 비-문자열(숫자)이면 400 이고 'password must be a string' 사유가 온다", async () => {
    await withSignupApp([], async (ctx) => {
      const response = await postSignup(ctx, {
        email: "typed-pw@e2e.test",
        password: 12345678,
      });
      expect(response.status).toBe(400);
      expect(messagesOf(response.body as FailureBody)).toContain(
        CONTRACT_MESSAGES.passwordType,
      );
    });
  });

  it("분기 ④ — 미정의 필드(role) 포함 시 400 이고 그 사유가 유실 없이 남는다(other 축 보존 경로)", async () => {
    await withSignupApp([], async (ctx) => {
      const response = await postSignup(ctx, {
        email: "extra-field@e2e.test",
        password: "securepass",
        role: "SuperAdmin",
      });
      expect(response.status).toBe(400);
      const roleReason = messagesOf(response.body as FailureBody).find((item) =>
        item.includes("role"),
      );
      expect(roleReason).toBeDefined();
      // email/password 접두사가 아니므로 소비 측에서 other 축에 원문 보존된다.
      expect((roleReason as string).startsWith("email")).toBe(false);
      expect((roleReason as string).startsWith("password")).toBe(false);
    });
  });

  // negative cases 충분 cover.
  it("negative ① — 400 · 409 어느 실패 body 에도 요청에 보낸 평문 password 값이 등장하지 않는다", async () => {
    await withSignupApp(
      [{ role: "SuperAdmin", email: "dup-leak@e2e.test" }],
      async (ctx) => {
        const plain = "PlainProbe-4821";
        const badRequest = await postSignup(ctx, {
          email: "not-an-email",
          password: plain,
        });
        const conflict = await postSignup(ctx, {
          email: "dup-leak@e2e.test",
          password: plain,
        });
        expect(badRequest.status).toBe(400);
        expect(conflict.status).toBe(409);
        [badRequest, conflict].forEach((response) => {
          expect(JSON.stringify(response.body)).not.toContain(plain);
          expect(response.text).not.toContain(plain);
        });
      },
    );
  });

  it("negative ② — 400 · 409 어느 실패 응답에도 hashedPassword 키가 없다", async () => {
    await withSignupApp(
      [{ role: "SuperAdmin", email: "dup-hash@e2e.test" }],
      async (ctx) => {
        const badRequest = await postSignup(ctx, {
          email: "not-an-email",
          password: "short",
        });
        const conflict = await postSignup(ctx, {
          email: "dup-hash@e2e.test",
          password: "securepass",
        });
        expect(badRequest.status).toBe(400);
        expect(conflict.status).toBe(409);
        [badRequest, conflict].forEach((response) => {
          expect(response.body).not.toHaveProperty("hashedPassword");
          expect(JSON.stringify(response.body)).not.toContain("hashedPassword");
        });
      },
    );
  });

  it("negative ③ — 400 응답의 message 가 빈 배열이 아니다(표시 측 최소 1 줄 보장의 backend 근거)", async () => {
    await withSignupApp([], async (ctx) => {
      const response = await postSignup(ctx, {});
      expect(response.status).toBe(400);
      const items = messagesOf(response.body as FailureBody);
      expect(items.length).toBeGreaterThan(0);
      items.forEach((item) => expect(item.trim()).not.toBe(""));
    });
  });

  it("negative ④ — 400 body 의 statusCode 는 400, 409 body 의 statusCode 는 409 다", async () => {
    await withSignupApp(
      [{ role: "SuperAdmin", email: "dup-status@e2e.test" }],
      async (ctx) => {
        const badRequest = await postSignup(ctx, {
          email: "not-an-email",
          password: "short",
        });
        const conflict = await postSignup(ctx, {
          email: "dup-status@e2e.test",
          password: "securepass",
        });
        expect((badRequest.body as FailureBody).statusCode).toBe(400);
        expect((conflict.body as FailureBody).statusCode).toBe(409);
      },
    );
  });

  it("negative ⑤ — 유효 payload 는 201 이며 실패 어휘가 전혀 없다(false-positive 방지 대조군)", async () => {
    await withSignupApp([], async (ctx) => {
      const response = await postSignup(ctx, {
        email: "valid-contract@e2e.test",
        password: "securepass",
      });
      expect(response.status).toBe(201);
      expect(response.body).not.toHaveProperty("message");
      expect(response.body).not.toHaveProperty("statusCode");
      const raw = JSON.stringify(response.body);
      [...INVALID_INPUT_VOCABULARY, "already exists"].forEach((token) => {
        expect(raw).not.toContain(token);
      });
    });
  });

  // drift guard — 관측 문구 5 종 ↔ web MESSAGE_MAP key 대조. 한쪽만 바뀌면 red 가 된다.
  it("drift guard — 관측된 backend 문구 5 종이 web MESSAGE_MAP 의 key 로 전부 존재한다", () => {
    const source = readFileSync(
      join(__dirname, "..", "..", "web", "src", "api", "signupError.ts"),
      "utf8",
    );
    const keys = extractMessageMapKeys(source);
    expect(keys.length).toBeGreaterThanOrEqual(5);
    Object.values(CONTRACT_MESSAGES).forEach((message) => {
      // (a) 앞선 it 들이 backend 응답에서 실제로 관측했는가 — backend 측 회귀 감지.
      expect(Array.from(observedMessages)).toContain(message);
      // (b) 소비 측 매핑표에 key 로 남아 있는가 — web 측 회귀 감지.
      expect(keys).toContain(message);
    });
  });
});
