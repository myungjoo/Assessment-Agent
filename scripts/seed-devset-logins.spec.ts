// scripts/seed-devset-logins.spec.ts — 133 로그인 seed 실행 entrypoint 의 최소 spec
// (T-1658, check-spec-presence.sh 신규 .ts 의무 정합). `scripts/encrypt-token.spec.ts`
// (T-0206) 선례 그대로 — entrypoint 는 분기 0 의 얇은 wrapper 이므로 실 본체의 R-112
// cover 는 test/helpers/realdata-devset-seed-cli.spec.ts · -client.spec.ts 가 담당하고,
// 본 spec 은 (1) import 만으로 side effect 0, (2) 위임 계약, (3) 분기 0 · 재구현 0 ·
// 자격증명 리터럴 0 이라는 정적 계약, (4) package.json 스크립트 배선을 검증한다.
//
// 실 DB 접속 0 · 실 seed 실행 0 — 정적 소스 단언과 모듈 로드만 한다. scripts/ 는
// package.json collectCoverageFrom(src/**) 밖이라 coverage 집계 대상이 아니다.
import { existsSync, readFileSync } from "fs";
import { join } from "path";

import { runDevsetSeedCli } from "../test/helpers/realdata-devset-seed-cli";
import { createDevsetSeedClient } from "../test/helpers/realdata-devset-seed-client";

const ENTRYPOINT_PATH = join(__dirname, "seed-devset-logins.ts");
const PACKAGE_JSON_PATH = join(__dirname, "..", "package.json");
const SCRIPT_KEY = "seed:devset-logins";

// T-1658 이전부터 존재하던 script 키 — 신규 키가 기존 키를 덮어쓰지 않았음을 대조한다.
const PRE_EXISTING_SCRIPT_KEYS = [
  "build",
  "start",
  "start:dev",
  "lint",
  "format",
  "test",
  "test:watch",
  "test:cov",
  "test:smoke",
  "test:e2e",
  "test:perf",
  "test:load",
  "test:load:s1",
  "test:load:s2",
  "test:load:s3",
  "postinstall",
];

function entrypointSource(): string {
  return readFileSync(ENTRYPOINT_PATH, "utf8");
}

// 주석(설명 산문) 을 걷어낸 실행 코드만 남긴다 — 분기 토큰 · 금지 문자열 단언이
// 주석 문구에 오탐하지 않도록. entrypoint 의 주석은 전부 줄 단위 형태다.
function entrypointCode(): string {
  return entrypointSource()
    .split("\n")
    .filter((line) => !/^\s*\/\//.test(line))
    .join("\n");
}

function packageScripts(): Record<string, string> {
  const parsed = JSON.parse(readFileSync(PACKAGE_JSON_PATH, "utf8")) as {
    scripts: Record<string, string>;
  };
  return parsed.scripts;
}

describe("scripts/seed-devset-logins entrypoint (T-1658)", () => {
  describe("happy-path", () => {
    it("(a) import 만으로 throw · process.exit 없이 resolve 한다 (require.main 가드)", async () => {
      // jest 환경에서는 require.main !== module 이라 main() 이 실행되지 않아야 한다.
      await expect(import("./seed-devset-logins")).resolves.toBeDefined();
    });

    it("(b) 위임 대상 createDevsetSeedClient · runDevsetSeedCli 가 함수로 존재한다", () => {
      expect(typeof createDevsetSeedClient).toBe("function");
      expect(typeof runDevsetSeedCli).toBe("function");
    });

    it("(c) package.json 의 신규 스크립트 키가 실존하는 entrypoint 파일을 가리킨다", () => {
      const command = packageScripts()[SCRIPT_KEY];
      expect(command).toContain("ts-node");
      const target = command.trim().split(/\s+/).slice(-1)[0];
      expect(target).toBe("scripts/seed-devset-logins.ts");
      expect(existsSync(join(__dirname, "..", target))).toBe(true);
    });
  });

  describe("error path", () => {
    it("(a) 최상위 실패 흡수 경로가 존재하고 exit code 1 로 귀결한다", () => {
      const code = entrypointCode();
      expect(code).toContain(".catch(");
      const handler = code.slice(code.indexOf(".catch("));
      expect(handler).toContain("process.stderr.write");
      expect(handler).toContain("process.exit(1)");
    });

    it("(b) 실패 흡수 경로가 DATABASE_URL 값을 출력 문자열에 삽입하지 않는다", () => {
      const code = entrypointCode();
      const handler = code.slice(code.indexOf(".catch("));
      expect(handler).not.toContain("process.env");
      expect(handler).not.toContain("DATABASE_URL");
      // 오류는 무조건 문자열화만 한다 (객체 덤프 0 — CLAUDE.md §9).
      expect(handler).toContain("String(error)");
    });
  });

  describe("분기 cover (설계상 분기 0 — 정적 단언으로 대체)", () => {
    it("(a) require.main === module 가드가 정확히 1 개 존재한다", () => {
      const code = entrypointCode();
      expect(code.match(/require\.main === module/g)).toHaveLength(1);
      expect(code.match(/\bif\s*\(/g)).toHaveLength(1);
    });

    it("(b) 그 외 조건 분기 토큰이 0 이다", () => {
      const code = entrypointCode();
      // 유일한 if 는 위 가드이므로, 그 줄을 뺀 나머지에는 어떤 분기 토큰도 없다.
      const rest = code
        .split("\n")
        .filter((line) => !line.includes("require.main === module"))
        .join("\n");
      [
        /\bif\s*\(/,
        /\bswitch\s*\(/,
        /\bfor\s*\(/,
        /\bwhile\s*\(/,
        /\?/,
        /&&/,
        /\|\|/,
      ].forEach((token) => expect(rest).not.toMatch(token));
    });
  });

  describe("negative cases", () => {
    it("(a) seed 로직을 재구현하지 않는다 (upsert · args 조립 · runDevsetSeed 직접 호출 0)", () => {
      const code = entrypointCode();
      expect(code).not.toContain("upsert");
      expect(code).not.toContain("resolveDevsetSeedUpsertArgs");
      expect(code).not.toMatch(/\brunDevsetSeed\s*\(/);
      // 팩토리 1 회 + 본체 1 회 호출뿐.
      expect(code.match(/createDevsetSeedClient\(/g)).toHaveLength(1);
      expect(code.match(/runDevsetSeedCli\(/g)).toHaveLength(1);
    });

    it("(b) @prisma/client 값 import 가 0 이다", () => {
      expect(entrypointCode()).not.toContain("@prisma/");
    });

    it("(c) hard-coded connection string · 비밀값 리터럴이 0 이다", () => {
      const source = entrypointSource();
      expect(source).not.toMatch(/postgres(ql)?:\/\//);
      expect(source).not.toMatch(/password\s*=/i);
    });

    it("(d) package.json 의 test:load* 키집합이 정확히 기존 4 종이다", () => {
      expect(
        Object.keys(packageScripts()).filter((key) =>
          key.startsWith("test:load"),
        ),
      ).toEqual(["test:load", "test:load:s1", "test:load:s2", "test:load:s3"]);
    });

    it("(e) 신규 키가 기존 키를 덮어쓰지 않는다 (기존 키 전량 보존 · 중복 0)", () => {
      const keys = Object.keys(packageScripts());
      PRE_EXISTING_SCRIPT_KEYS.forEach((key) => expect(keys).toContain(key));
      expect(keys).toContain(SCRIPT_KEY);
      expect(keys).toHaveLength(PRE_EXISTING_SCRIPT_KEYS.length + 1);
      const raw = readFileSync(PACKAGE_JSON_PATH, "utf8");
      expect(raw.match(new RegExp(`"${SCRIPT_KEY}"`, "g"))).toHaveLength(1);
    });

    it("(f) process.env 를 DATABASE_URL 외 다른 이름으로 읽지 않는다", () => {
      const code = entrypointCode();
      expect(code).not.toContain("process.env[");
      expect(code.match(/process\.env\.[A-Z_]+/g)).toEqual([
        "process.env.DATABASE_URL",
      ]);
    });
  });
});
