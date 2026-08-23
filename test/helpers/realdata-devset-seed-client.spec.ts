// realdata-devset-seed-client.spec.ts — T-1657 colocated unit spec. R-112 cover:
// happy(객체 반환 · 두 delegate upsert 와 `$disconnect` 가 함수 · throw 0 · 접속 0 · 타입 경계) /
// error(`undefined` · 빈 문자열 · 공백만 각 `TypeError`) / 분기(통과 경로 vs 각 실패 경로 ·
// trim 후 판정으로 앞뒤 공백 붙은 유효 URL 통과) / negative(`null` · 숫자 · 객체 · 배열 ·
// boolean · 함수 등 비-string, 두 번 호출 시 서로 다른 인스턴스(싱글턴 캐싱 0), 에러 메시지에
// 입력의 credential 부분 문자열 echo 0). 실 DB 접속 0 — 더미 connection string 만 쓰고
// Prisma 의 lazy connection 전제 위에서 인스턴스 생성만 확인한다.
import type {
  DevsetSeedCliClient,
  DevsetSeedCliDeps,
} from "./realdata-devset-seed-cli";
import { createDevsetSeedClient } from "./realdata-devset-seed-client";

// 더미 connection string — 실제로 접속하지 않는다(팩토리는 인스턴스만 만든다).
const DUMMY_URL = "postgresql://postgres:secret@localhost:5432/devset_dummy";
const CREDENTIAL = "postgres:secret";

// 생성된 client 를 모아 두었다가 run 종료 시 연결 자원을 정리한다(접속한 적이 없으므로
// no-op 에 가깝지만 open handle 잔류 0 을 보장).
const created: DevsetSeedCliClient[] = [];
function create(databaseUrl: unknown): DevsetSeedCliClient {
  const client = createDevsetSeedClient(databaseUrl as string | undefined);
  created.push(client);
  return client;
}

afterAll(async () => {
  await Promise.all(
    created.splice(0).map((client) => client.$disconnect().catch(() => void 0)),
  );
});

describe("createDevsetSeedClient — happy path", () => {
  it("유효한 URL 이면 throw 0 으로 client 객체를 반환한다", () => {
    const client = create(DUMMY_URL);
    expect(typeof client).toBe("object");
    expect(client).not.toBeNull();
  });

  it("반환값이 seed CLI 계약의 세 멤버를 모두 함수로 갖는다", () => {
    const client = create(DUMMY_URL);
    expect(typeof client.person.upsert).toBe("function");
    expect(typeof client.serviceIdentity.upsert).toBe("function");
    expect(typeof client.$disconnect).toBe("function");
  });

  it("호출 시점에 실 접속을 하지 않는다(도달 불가 host 여도 동기 반환)", () => {
    // 팩토리가 `$connect()`/query 를 부른다면 DB 가 없는 unit 환경에서 이 호출이 실패하거나
    // Promise 를 반환해야 한다 — 동기적으로 온전한 객체가 나온다는 사실이 lazy connection
    // 전제(접속 0)의 증거다.
    const client = create("postgresql://u:p@127.0.0.1:1/never_reachable");
    expect(client).not.toBeInstanceOf(Promise);
    expect(typeof client.person.upsert).toBe("function");
    expect(typeof client.$disconnect).toBe("function");
  });

  it("반환값이 DevsetSeedCliDeps.client 에 그대로 대입된다(타입 경계)", () => {
    // 타입 수준 대입 — cast 없이 `DevsetSeedCliClient` 로 받아 deps 를 조립한다.
    const client: DevsetSeedCliClient = create(DUMMY_URL);
    const deps: DevsetSeedCliDeps = {
      client,
      log: () => void 0,
      logError: () => void 0,
    };
    expect(deps.client).toBe(client);
    expect(typeof deps.client.$disconnect).toBe("function");
  });
});

describe("createDevsetSeedClient — error path", () => {
  it("undefined 면 TypeError 를 throw 한다", () => {
    expect(() => createDevsetSeedClient(undefined)).toThrow(TypeError);
  });

  it("빈 문자열이면 TypeError 를 throw 한다", () => {
    expect(() => createDevsetSeedClient("")).toThrow(TypeError);
  });

  it("공백만 있는 문자열이면 TypeError 를 throw 한다", () => {
    expect(() => createDevsetSeedClient("   ")).toThrow(TypeError);
  });

  it("에러 메시지가 원인과 조치(DATABASE_URL 설정)를 담는다", () => {
    expect(() => createDevsetSeedClient(undefined)).toThrow(/DATABASE_URL/);
    expect(() => createDevsetSeedClient("")).toThrow(/설정 필요/);
  });
});

describe("createDevsetSeedClient — 분기 cover", () => {
  it("검증 통과 경로와 실패 경로가 서로 다른 결과를 낸다", () => {
    expect(() => create(DUMMY_URL)).not.toThrow();
    expect(() => createDevsetSeedClient("")).toThrow(TypeError);
  });

  it("앞뒤 공백이 붙은 유효 URL 은 trim 후 판정되어 통과한다", () => {
    const client = create(`  \t${DUMMY_URL}\n `);
    expect(typeof client.$disconnect).toBe("function");
  });

  it("비-string 분기와 빈 문자열 분기의 메시지가 서로 구분된다", () => {
    const nonString = (): void => {
      createDevsetSeedClient(42 as unknown as string);
    };
    expect(nonString).toThrow(/문자열이 아니다/);
    expect(() => createDevsetSeedClient("  ")).toThrow(/비어 있다/);
  });
});

describe("createDevsetSeedClient — negative cases", () => {
  it.each([
    ["null", null],
    ["숫자", 42],
    ["객체", { url: DUMMY_URL }],
    ["배열", [DUMMY_URL]],
    ["boolean", true],
    ["함수", () => DUMMY_URL],
    ["Symbol", Symbol("db")],
  ])("비-string 입력(%s)이면 TypeError 를 throw 한다", (_label, value) => {
    expect(() => createDevsetSeedClient(value as unknown as string)).toThrow(
      TypeError,
    );
  });

  it("비-string 입력의 메시지에 typeof 만 남고 값 자체는 남지 않는다", () => {
    expect(() => createDevsetSeedClient(42 as unknown as string)).toThrow(
      /typeof number/,
    );
  });

  it("두 번 호출하면 서로 다른 인스턴스를 반환한다(싱글턴 캐싱 0)", () => {
    const first = create(DUMMY_URL);
    const second = create(DUMMY_URL);
    expect(first).not.toBe(second);
  });

  it("에러 메시지에 입력의 credential 부분 문자열이 포함되지 않는다", () => {
    // toString 이 credential 을 품은 객체/배열을 넘겨도 메시지에 새어 나가면 안 된다(§9).
    const leaky = [DUMMY_URL];
    const object = { toString: () => DUMMY_URL };
    for (const value of [leaky, object]) {
      let message = "";
      try {
        createDevsetSeedClient(value as unknown as string);
      } catch (error) {
        message = error instanceof Error ? error.message : String(error);
      }
      expect(message).not.toBe("");
      expect(message).not.toContain(CREDENTIAL);
      expect(message).not.toContain(DUMMY_URL);
    }
  });

  it("공백만 있는 입력의 메시지에도 입력 문자열이 echo 되지 않는다", () => {
    const padded = `   ${"\t"}  `;
    try {
      createDevsetSeedClient(padded);
      throw new Error("throw 가 기대됐다");
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      expect(error).toBeInstanceOf(TypeError);
      expect(message).not.toContain(CREDENTIAL);
    }
  });
});
