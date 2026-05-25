// prisma.config.ts 의 default export 가 PrismaConfig 형태 (schema / migrations / datasource)
// 를 갖추는지 박제. Prisma 7.x 의 datasource.url removal 대응으로 본 file 이 schema 의
// datasource block 을 대체 — 잘못 박제되면 prisma CLI 동작 전체가 깨진다.
//
// spec-presence check 가 새 .ts production 파일에 대응 spec 을 요구 (scripts/check-spec-presence.sh).
// 본 config 는 declarative 라 직접 호출할 함수가 없으므로 shape 검증으로 R-112 의 의도를 만족.
import prismaConfig from "./prisma.config";

describe("prisma.config", () => {
  it("default export 가 PrismaConfig shape 의 필수 키 (schema/migrations/datasource) 를 갖춘다 (happy)", () => {
    expect(prismaConfig).toBeDefined();
    expect(prismaConfig.schema).toBe("./prisma/schema.prisma");
    expect(prismaConfig.migrations?.path).toBe("./prisma/migrations");
    expect(prismaConfig.datasource).toBeDefined();
  });

  it("datasource.url 이 process.env.DATABASE_URL 에서 read 된다 (flow-branch)", () => {
    // 모듈을 reload 해서 process.env 변화의 effect 를 capture.
    const prev = process.env.DATABASE_URL;
    process.env.DATABASE_URL = "postgresql://x:y@h:1/d?schema=public";
    jest.resetModules();
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const reloaded = require("./prisma.config").default;
    expect(reloaded.datasource.url).toBe(
      "postgresql://x:y@h:1/d?schema=public",
    );
    if (prev === undefined) {
      delete process.env.DATABASE_URL;
    } else {
      process.env.DATABASE_URL = prev;
    }
  });

  it("DATABASE_URL 미설정 시 datasource.url 은 빈 문자열 fallback (negative)", () => {
    const prev = process.env.DATABASE_URL;
    delete process.env.DATABASE_URL;
    jest.resetModules();
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const reloaded = require("./prisma.config").default;
    expect(reloaded.datasource.url).toBe("");
    if (prev !== undefined) {
      process.env.DATABASE_URL = prev;
    }
  });
});
