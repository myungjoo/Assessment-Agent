// realdata-e2e-env-prod-example-internal-template-single-source-required-active-key-presence-placeholder-secret-safety-optional-gated-discipline-seed-llm-key-parity-contract.smoke-spec.ts
// — 무인 nightly 재배포 runner chain(daily-test.sh · redeploy.sh · seed-llm-config.sh · docker-entrypoint.sh ·
// systemd unit · docker-compose.yml · Dockerfile) 이 런타임에 소비하는 **설정의 정본(single-source)** 인
// `deploy/env.prod.example` 의 **내부 env 템플릿 semantic 계약** 을 실 파일을 readFileSync 로 읽어
// (실 .env 생성/실 컨테이너/실 seed 실행/실 DB 0) 정적 검증하는 non-gated 설정-leg smoke
// (T-0964, PLAN.md §109 재배포 runner chain — 설정 single-source leg).
//
// 봉함 불변식(env.prod.example 자신의 내부 템플릿 semantic — T-0795 cross-artifact 값 parity 와 distinct 상보):
//   (1) 필수 active 키 6종(POSTGRES_USER·POSTGRES_PASSWORD·POSTGRES_DB·DATABASE_URL·PORT·AUTH_JWT_SECRET)이
//       각각 **주석 아닌** KEY=value 행으로 실존 — 소실/주석-강등 시 운영자가 미설정으로 부팅.
//   (2) 시크릿 보유 키(POSTGRES_PASSWORD·AUTH_JWT_SECRET)의 값이 실값이 아니라 <...> angle-bracket placeholder
//       만 담음(§9 — .example 이 실 secret 을 담지 않음). 실값 커밋 시 secret 유출.
//   (3) 비시크릿 키가 사용 가능한 구체 기본값을 담음(POSTGRES_USER=assessment_agent·POSTGRES_DB=assessment_agent·
//       PORT=3000) — cp 직후 즉시 동작하는 실용 기본값.
//   (4) DATABASE_URL 의 credential user 세그먼트(postgresql://<user>:...)가 POSTGRES_USER 값(assessment_agent)과
//       동일 — 내부 credential parity. user 불일치 시 컨테이너 DB 인증 실패.
//   (5) 선택/gated 키 9종(LLM_APIKEY_ENC_KEY·SEED_LLM_* 5종·NODE_EXTRA_CA_CERTS·HTTPS_PROXY·NO_PROXY)이 각각
//       **주석 처리된**(# KEY=...) 형태로만 존재(active 아님) — default-on 강제 안 함(미사용 배포 마찰 0).
//   (6) 헤더 안전 지시(.env 는 .gitignore 대상·절대 commit 금지)와 cp deploy/env.prod.example .env 사용법 존재.
//   (7) 문서화된 SEED_LLM_* 키셋이 seed-llm-config.sh 가 실제 소비하는 SEED_LLM_* 키셋과 정확히 동일 집합
//       (cross-artifact 키셋 parity — 누락·잉여 0). drift 시 운영자가 오타/누락 키로 seed 실패.
//   (8) §9 secret-safety — 추출/합성 토큰에 실 secret/password/토큰/실 DATABASE_URL 자격/실 endpoint 0
//       (env 키 이름·<...> placeholder·비시크릿 기본값 assessment_agent/3000·주석 지시문·SEED_LLM_* 키 이름만).
//
// 전략(형제 T-0963 Dockerfile 내부 빌드 시퀀스·T-0962 docker-compose 내부 오케스트레이션·T-0961 systemd unit 내부
// directive·T-0960 docker-entrypoint 내부 부팅 동형): env.prod.example 에서 active/commented 대입·placeholder·
// credential user·SEED_LLM 키셋을 정적 추출하는 해석 동형 TS 순수 함수(activeAssignments·activeValue·
// hasCommentedKey·isAnglePlaceholder·databaseUrlCredentialUser·seedLlmKeys·extractEnvTemplateAnchors)로 템플릿
// 불변식 assert. 합성 mutant 사본으로 negative(a~g 7종) 변별. 기존
// `realdata-e2e-docker-compose-orchestration-contract-artifact-parity-drift.smoke-spec.ts`
// (T-0795: PORT 4중 byte-identity·POSTGRES_USER/POSTGRES_DB 키 실존·DATABASE_URL host:port parity) 와
// distinct 상보 surface — 본 task 는 PORT 값·DATABASE_URL host(postgres)/port(5432) 를 재검증하지 않는다
// (본 task 의 DATABASE_URL 관점은 credential user ↔ POSTGRES_USER 내부 parity 만).
//   🔥 실 .env 생성/실 cp/실 seed 실행/실 컨테이너/실 DB 0 · process.env 읽기 0(입력은 pure 함수 파라미터)
//      · credential 0(§9/REQ-059) · 새 dep 0(node fs/path, dotenv 파서 추가 0) · src 변경 0(test-only)
//      · env.prod.example/seed-llm-config.sh 읽기만(실행 0 · 변경 0).
import { existsSync, readFileSync } from "fs";
import * as path from "path";

// repo-root 경로 — test 실행 cwd 무관하게 robust 하게 해석(`__dirname` = test/smoke,
// 두 단계 위가 repo-root). `process.cwd()` 대신 `__dirname` 기준 상대로 고정한다(sibling T-0963).
const REPO_ROOT = path.resolve(__dirname, "../..");
const ENV_EXAMPLE_PATH = path.join(REPO_ROOT, "deploy", "env.prod.example");
const SEED_SCRIPT_PATH = path.join(REPO_ROOT, "deploy", "seed-llm-config.sh");

// 정본 앵커(실 env.prod.example 표현의 TS mirror — 실 .env 로드 0).
const REQUIRED_ACTIVE_KEYS = [
  "POSTGRES_USER",
  "POSTGRES_PASSWORD",
  "POSTGRES_DB",
  "DATABASE_URL",
  "PORT",
  "AUTH_JWT_SECRET",
]; // 주석 아닌 KEY=value 행으로 실존해야 하는 필수 active 키.
const SECRET_KEYS = ["POSTGRES_PASSWORD", "AUTH_JWT_SECRET"]; // 실값 아닌 <...> placeholder 만 담아야.
const NON_SECRET_DEFAULTS: Record<string, string> = {
  POSTGRES_USER: "assessment_agent",
  POSTGRES_DB: "assessment_agent",
  PORT: "3000",
}; // 비시크릿 키의 사용 가능한 구체 기본값.
const GATED_KEYS = [
  "LLM_APIKEY_ENC_KEY",
  "SEED_LLM_ENDPOINT_URL",
  "SEED_LLM_PROVIDER",
  "SEED_LLM_MODEL_ID",
  "SEED_LLM_API_KEY",
  "SEED_LLM_CONFIG_ID",
  "NODE_EXTRA_CA_CERTS",
  "HTTPS_PROXY",
  "NO_PROXY",
]; // 주석 처리(# KEY=...)로만 존재해야 하는 선택/gated 키.
const EXPECTED_DB_USER = "assessment_agent"; // DATABASE_URL credential user == POSTGRES_USER.

// ── TS 동형 pure 함수(정본) — env.prod.example 의 active/commented 대입·placeholder·credential·키셋을 모델링.
//    입력(문자열)은 mutate 하지 않는다(읽기만). 실 dotenv 로드 0 — 입력은 파라미터.
//    전체 dotenv 스펙 파싱이 아니라 KEY=value 행 슬라이스 + 필요한 토큰만 추출.

// 소스를 CRLF-정규화 후 라인 배열로 — 모든 파서의 공통 입력.
function toLines(source: string): string[] {
  return source.replace(/\r\n/g, "\n").split("\n");
}

// isCommented(line): 라인이 (선행 공백 후) # 로 시작 — 주석 행.
function isCommented(line: string): boolean {
  return /^\s*#/.test(line);
}

// activeAssignments(source): 주석 아닌 KEY=value 행들을 {key, value} 배열로. value 는 원문(따옴표 포함).
function activeAssignments(source: string): { key: string; value: string }[] {
  return toLines(source)
    .filter((l) => !isCommented(l))
    .map((l) => l.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)=(.*)$/))
    .filter((m): m is RegExpMatchArray => m !== null)
    .map((m) => ({ key: m[1], value: m[2] }));
}

// activeValue(source, key): 특정 key 의 active 대입 값(원문) — 부재면 undefined.
function activeValue(source: string, key: string): string | undefined {
  return activeAssignments(source).find((a) => a.key === key)?.value;
}

// hasActiveKey(source, key): key 가 주석 아닌 KEY=value 행으로 실존.
function hasActiveKey(source: string, key: string): boolean {
  return activeAssignments(source).some((a) => a.key === key);
}

// commentedAssignments(source): `# KEY=value` 주석 대입 행들을 {key, value} 배열로.
function commentedAssignments(
  source: string,
): { key: string; value: string }[] {
  return toLines(source)
    .map((l) => l.match(/^\s*#\s*([A-Za-z_][A-Za-z0-9_]*)=(.*)$/))
    .filter((m): m is RegExpMatchArray => m !== null)
    .map((m) => ({ key: m[1], value: m[2] }));
}

// hasCommentedKey(source, key): key 가 `# KEY=...` 주석 대입으로 존재.
function hasCommentedKey(source: string, key: string): boolean {
  return commentedAssignments(source).some((a) => a.key === key);
}

// unquote(value): 값을 감싼 한 겹 따옴표 제거 + 인라인 주석 앞까지 trim.
function unquote(value: string): string {
  return value.trim().replace(/^["']|["']$/g, "");
}

// isAnglePlaceholder(value): 값이 <...> angle-bracket placeholder 토큰만 담음(실값 아님).
function isAnglePlaceholder(value: string): boolean {
  return /^<[^<>]*>$/.test(unquote(value));
}

// gatedKeyDisciplined(source, key): key 가 주석 처리로만 존재하고 active 로는 존재 안 함(default-on 강제 안 함).
function gatedKeyDisciplined(source: string, key: string): boolean {
  return hasCommentedKey(source, key) && !hasActiveKey(source, key);
}

// databaseUrlCredentialUser(source): DATABASE_URL 의 postgresql://<user>:... credential user — 부재면 undefined.
function databaseUrlCredentialUser(source: string): string | undefined {
  const raw = activeValue(source, "DATABASE_URL");
  if (raw === undefined) return undefined;
  const m = unquote(raw).match(/^postgres(?:ql)?:\/\/([^:/@\s]+):/);
  return m ? m[1] : undefined;
}

// credentialParityHolds(source): DATABASE_URL credential user == POSTGRES_USER active 값.
function credentialParityHolds(source: string): boolean {
  const dbUser = databaseUrlCredentialUser(source);
  const pgUser = activeValue(source, "POSTGRES_USER");
  return dbUser !== undefined && pgUser !== undefined && dbUser === pgUser;
}

// seedLlmKeys(source): 소스에서 SEED_LLM_[A-Z_]+ 토큰을 정적 추출한 정렬된 유니크 집합(주석·코드 무관).
function seedLlmKeys(source: string): string[] {
  const set = new Set<string>();
  const re = /SEED_LLM_[A-Z_]+/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(source)) !== null) set.add(m[0]);
  return [...set].sort();
}

// setsEqual(a, b): 두 문자열 배열이 같은 집합(순서 무관·중복 무시)인가.
function setsEqual(a: string[], b: string[]): boolean {
  const sa = new Set(a);
  const sb = new Set(b);
  if (sa.size !== sb.size) return false;
  for (const x of sa) if (!sb.has(x)) return false;
  return true;
}

// hasGitignoreWarning(source): 헤더에 .gitignore 대상·절대 commit 금지 안전 지시 존재.
function hasGitignoreWarning(source: string): boolean {
  return /\.gitignore/.test(source) && /절대 commit 금지/.test(source);
}

// hasCpUsage(source): cp deploy/env.prod.example .env 사용법 행 존재.
function hasCpUsage(source: string): boolean {
  return /cp\s+deploy\/env\.prod\.example\s+\.env/.test(source);
}

// (집계) extractEnvTemplateAnchors(envSource, seedSource): 내부 템플릿 불변식을 한 번에 집계 —
//   하나라도 부재/변질이면 명시적 false(빈 결과 성공-위장 0).
function extractEnvTemplateAnchors(
  envSource: string,
  seedSource: string,
): {
  requiredActivePresent: boolean;
  secretsArePlaceholders: boolean;
  nonSecretDefaults: boolean;
  credentialParity: boolean;
  gatedDisciplined: boolean;
  headerSafety: boolean;
  seedKeysetParity: boolean;
} {
  return {
    requiredActivePresent: REQUIRED_ACTIVE_KEYS.every((k) =>
      hasActiveKey(envSource, k),
    ),
    secretsArePlaceholders: SECRET_KEYS.every((k) => {
      const v = activeValue(envSource, k);
      return v !== undefined && isAnglePlaceholder(v);
    }),
    nonSecretDefaults: Object.entries(NON_SECRET_DEFAULTS).every(
      ([k, expected]) => unquote(activeValue(envSource, k) ?? "") === expected,
    ),
    credentialParity: credentialParityHolds(envSource),
    gatedDisciplined: GATED_KEYS.every((k) =>
      gatedKeyDisciplined(envSource, k),
    ),
    headerSafety: hasGitignoreWarning(envSource) && hasCpUsage(envSource),
    seedKeysetParity: setsEqual(
      seedLlmKeys(envSource),
      seedLlmKeys(seedSource),
    ),
  };
}

describe("realdata-e2e §109 env.prod.example 내부 env 템플릿 single-source 계약 smoke — 필수 active 키 6종 존재 + POSTGRES_PASSWORD/AUTH_JWT_SECRET placeholder-secret-safety + 비시크릿 구체 기본값 + DATABASE_URL credential user↔POSTGRES_USER 내부 parity + 선택 gated 키 9종 주석-규율 + SEED_LLM_* 키셋 seed-llm-config.sh 소비셋 parity + secret-safety (T-0964)", () => {
  describe("Happy-path: env.prod.example/seed-llm-config.sh 실존 + 내부 템플릿 앵커 정적 추출(pure 함수가 실 소스를 mirror)", () => {
    it("env.prod.example·seed-llm-config.sh 가 repo-root 기준 실존(existsSync)", () => {
      expect(existsSync(ENV_EXAMPLE_PATH)).toBe(true);
      expect(existsSync(SEED_SCRIPT_PATH)).toBe(true);
    });

    it("7 불변식(필수 active·placeholder-safety·비시크릿 기본값·credential parity·gated 규율·헤더 안전·SEED_LLM 키셋 parity) 전부 true", () => {
      const env = readFileSync(ENV_EXAMPLE_PATH, "utf8");
      const seed = readFileSync(SEED_SCRIPT_PATH, "utf8");
      const anchors = extractEnvTemplateAnchors(env, seed);
      expect(anchors.requiredActivePresent).toBe(true);
      expect(anchors.secretsArePlaceholders).toBe(true);
      expect(anchors.nonSecretDefaults).toBe(true);
      expect(anchors.credentialParity).toBe(true);
      expect(anchors.gatedDisciplined).toBe(true);
      expect(anchors.headerSafety).toBe(true);
      expect(anchors.seedKeysetParity).toBe(true);
    });
  });

  describe("Happy-path: 필수 active 키 6종이 주석 아닌 KEY=value 행으로 실존", () => {
    it("POSTGRES_USER·POSTGRES_PASSWORD·POSTGRES_DB·DATABASE_URL·PORT·AUTH_JWT_SECRET 각각 active 대입 존재", () => {
      const env = readFileSync(ENV_EXAMPLE_PATH, "utf8");
      for (const key of REQUIRED_ACTIVE_KEYS) {
        expect(hasActiveKey(env, key)).toBe(true);
      }
    });

    it("필수 active 키가 주석 행(# KEY=...)으로 위장 실존이 아님 — 실제 active 대입만 인정", () => {
      const env = readFileSync(ENV_EXAMPLE_PATH, "utf8");
      const activeKeys = activeAssignments(env).map((a) => a.key);
      for (const key of REQUIRED_ACTIVE_KEYS) {
        expect(activeKeys).toContain(key);
      }
    });
  });

  describe("Happy-path: 시크릿 보유 키 placeholder-safety(§9 — 실 secret 미포함)", () => {
    it("POSTGRES_PASSWORD·AUTH_JWT_SECRET 값이 실값 아닌 <...> angle-bracket placeholder 만 담음", () => {
      const env = readFileSync(ENV_EXAMPLE_PATH, "utf8");
      for (const key of SECRET_KEYS) {
        const v = activeValue(env, key);
        expect(v).toBeDefined();
        expect(isAnglePlaceholder(v as string)).toBe(true);
      }
    });
  });

  describe("Happy-path: 비시크릿 키 구체 기본값(cp 직후 즉시 동작)", () => {
    it("POSTGRES_USER=assessment_agent·POSTGRES_DB=assessment_agent·PORT=3000 구체 기본값", () => {
      const env = readFileSync(ENV_EXAMPLE_PATH, "utf8");
      for (const [key, expected] of Object.entries(NON_SECRET_DEFAULTS)) {
        expect(unquote(activeValue(env, key) as string)).toBe(expected);
      }
    });
  });

  describe("Happy-path: DATABASE_URL credential user ↔ POSTGRES_USER 내부 parity", () => {
    it("DATABASE_URL 의 postgresql://<user>: 세그먼트가 POSTGRES_USER 값(assessment_agent)과 동일", () => {
      const env = readFileSync(ENV_EXAMPLE_PATH, "utf8");
      expect(databaseUrlCredentialUser(env)).toBe(EXPECTED_DB_USER);
      expect(activeValue(env, "POSTGRES_USER")).toBe(EXPECTED_DB_USER);
      expect(credentialParityHolds(env)).toBe(true);
    });
  });

  describe("Happy-path: 선택/gated 키 9종 주석-규율(default-on 강제 안 함)", () => {
    it("LLM_APIKEY_ENC_KEY·SEED_LLM_* 5종·NODE_EXTRA_CA_CERTS·HTTPS_PROXY·NO_PROXY 각각 주석 처리로만 존재(active 아님)", () => {
      const env = readFileSync(ENV_EXAMPLE_PATH, "utf8");
      for (const key of GATED_KEYS) {
        expect(hasCommentedKey(env, key)).toBe(true);
        expect(hasActiveKey(env, key)).toBe(false);
        expect(gatedKeyDisciplined(env, key)).toBe(true);
      }
    });
  });

  describe("Happy-path: 헤더 안전 지시 + cp 사용법 존재", () => {
    it(".env 는 .gitignore 대상·절대 commit 금지 안전 지시 + cp deploy/env.prod.example .env 사용법 행 존재", () => {
      const env = readFileSync(ENV_EXAMPLE_PATH, "utf8");
      expect(hasGitignoreWarning(env)).toBe(true);
      expect(hasCpUsage(env)).toBe(true);
    });
  });

  describe("SEED_LLM_* 키셋 cross-artifact parity 계약: 문서화셋 == seed-llm-config.sh 소비셋", () => {
    it("env.prod.example 문서화 SEED_LLM_* 키셋이 seed-llm-config.sh 소비 키셋과 정확히 동일 집합(누락·잉여 0)", () => {
      const env = readFileSync(ENV_EXAMPLE_PATH, "utf8");
      const seed = readFileSync(SEED_SCRIPT_PATH, "utf8");
      const envKeys = seedLlmKeys(env);
      const seedKeys = seedLlmKeys(seed);
      // 둘 다 비어있지 않음(빈 집합끼리 vacuous 일치 오통과 0).
      expect(seedKeys.length).toBeGreaterThan(0);
      expect(envKeys.length).toBeGreaterThan(0);
      expect(setsEqual(envKeys, seedKeys)).toBe(true);
      // 실제 소비 키셋 스냅샷(문서-스크립트 동기 확인).
      expect(seedKeys).toEqual([
        "SEED_LLM_API_KEY",
        "SEED_LLM_CONFIG_ID",
        "SEED_LLM_ENDPOINT_URL",
        "SEED_LLM_MODEL_ID",
        "SEED_LLM_PROVIDER",
      ]);
    });
  });

  describe("branch: 각 불변식 있음/없음 정적 대조(합성 mutant 사본 — 원본 미변조)", () => {
    it("필수 active 키 있음/주석-강등 분기", () => {
      const env = readFileSync(ENV_EXAMPLE_PATH, "utf8");
      expect(hasActiveKey(env, "DATABASE_URL")).toBe(true);
      const mutant = env.replace(/\nDATABASE_URL=/, "\n# DATABASE_URL=");
      expect(hasActiveKey(mutant, "DATABASE_URL")).toBe(false);
    });

    it("placeholder 있음/실값 분기(×2 시크릿 키)", () => {
      const env = readFileSync(ENV_EXAMPLE_PATH, "utf8");
      for (const key of SECRET_KEYS) {
        expect(isAnglePlaceholder(activeValue(env, key) as string)).toBe(true);
      }
      const mutant = env
        .replace(/POSTGRES_PASSWORD=<[^>]*>/, "POSTGRES_PASSWORD=hunter2-real")
        .replace(/AUTH_JWT_SECRET=<[^>]*>/, "AUTH_JWT_SECRET=deadbeefcafe0123");
      expect(
        isAnglePlaceholder(activeValue(mutant, "POSTGRES_PASSWORD") as string),
      ).toBe(false);
      expect(
        isAnglePlaceholder(activeValue(mutant, "AUTH_JWT_SECRET") as string),
      ).toBe(false);
    });

    it("credential user 일치/불일치 분기", () => {
      const env = readFileSync(ENV_EXAMPLE_PATH, "utf8");
      expect(credentialParityHolds(env)).toBe(true);
      const mutant = env.replace(
        "postgresql://assessment_agent:",
        "postgresql://root:",
      );
      expect(databaseUrlCredentialUser(mutant)).toBe("root");
      expect(credentialParityHolds(mutant)).toBe(false);
    });

    it("gated 키 주석/활성 분기", () => {
      const env = readFileSync(ENV_EXAMPLE_PATH, "utf8");
      expect(gatedKeyDisciplined(env, "LLM_APIKEY_ENC_KEY")).toBe(true);
      const mutant = env.replace(
        /# LLM_APIKEY_ENC_KEY=/,
        "LLM_APIKEY_ENC_KEY=",
      );
      expect(hasActiveKey(mutant, "LLM_APIKEY_ENC_KEY")).toBe(true);
      expect(gatedKeyDisciplined(mutant, "LLM_APIKEY_ENC_KEY")).toBe(false);
    });

    it("SEED_LLM_* 키셋 일치/drift 분기", () => {
      const env = readFileSync(ENV_EXAMPLE_PATH, "utf8");
      const seed = readFileSync(SEED_SCRIPT_PATH, "utf8");
      expect(setsEqual(seedLlmKeys(env), seedLlmKeys(seed))).toBe(true);
      // env 문서에서 SEED_LLM_MODEL_ID 언급을 모두 제거 → 문서화셋 ⊊ 소비셋.
      const mutant = env.replace(/SEED_LLM_MODEL_ID/g, "OMITTED_MODEL_ID");
      expect(setsEqual(seedLlmKeys(mutant), seedLlmKeys(seed))).toBe(false);
    });
  });

  describe("Error path / negative cases 충분 cover (mutant 합성 사본 — 원본 미변조)", () => {
    it("error path — env.prod.example 부재 경로 → readFileSync throw(silent 0-byte fallback 0)", () => {
      const badPath = path.join(
        REPO_ROOT,
        "deploy",
        "__does_not_exist__.env.example",
      );
      expect(existsSync(badPath)).toBe(false);
      expect(() => readFileSync(badPath, "utf8")).toThrow();
    });

    it("error path — 템플릿 토큰 부재 시 명시적 false(빈 매칭을 pass 로 오통과 0)", () => {
      const anchors = extractEnvTemplateAnchors("# empty\n", "# empty\n");
      expect(anchors.requiredActivePresent).toBe(false);
      expect(anchors.secretsArePlaceholders).toBe(false);
      expect(anchors.nonSecretDefaults).toBe(false);
      expect(anchors.credentialParity).toBe(false);
      expect(anchors.gatedDisciplined).toBe(false);
      expect(anchors.headerSafety).toBe(false);
      // 빈 SEED_LLM 집합끼리는 setsEqual true 이나, 실 소스는 반대로 전부 true — 부재/실재 변별.
      const real = extractEnvTemplateAnchors(
        readFileSync(ENV_EXAMPLE_PATH, "utf8"),
        readFileSync(SEED_SCRIPT_PATH, "utf8"),
      );
      expect(real.requiredActivePresent).toBe(true);
      expect(real.secretsArePlaceholders).toBe(true);
      expect(real.seedKeysetParity).toBe(true);
    });

    it("negative (a) — POSTGRES_PASSWORD placeholder→구체 실값(hunter2-real-secret) mutant → 시크릿 보유 키 실 secret 커밋(§9 유출) 검출", () => {
      const env = readFileSync(ENV_EXAMPLE_PATH, "utf8");
      expect(
        isAnglePlaceholder(activeValue(env, "POSTGRES_PASSWORD") as string),
      ).toBe(true);
      const mutant = env.replace(
        /POSTGRES_PASSWORD=<[^>]*>/,
        "POSTGRES_PASSWORD=hunter2-real-secret",
      );
      expect(activeValue(mutant, "POSTGRES_PASSWORD")).toBe(
        "hunter2-real-secret",
      );
      expect(
        isAnglePlaceholder(activeValue(mutant, "POSTGRES_PASSWORD") as string),
      ).toBe(false);
      expect(
        extractEnvTemplateAnchors(
          mutant,
          readFileSync(SEED_SCRIPT_PATH, "utf8"),
        ).secretsArePlaceholders,
      ).toBe(false);
      // 원본 불변.
      expect(
        isAnglePlaceholder(activeValue(env, "POSTGRES_PASSWORD") as string),
      ).toBe(true);
    });

    it("negative (b) — AUTH_JWT_SECRET active 행 제거 mutant → 필수 active 키 누락(서명 secret 미설정 부팅) 검출", () => {
      const env = readFileSync(ENV_EXAMPLE_PATH, "utf8");
      expect(hasActiveKey(env, "AUTH_JWT_SECRET")).toBe(true);
      const mutant = env.replace(/\nAUTH_JWT_SECRET=<[^>]*>\n/, "\n");
      expect(hasActiveKey(mutant, "AUTH_JWT_SECRET")).toBe(false);
      expect(
        extractEnvTemplateAnchors(
          mutant,
          readFileSync(SEED_SCRIPT_PATH, "utf8"),
        ).requiredActivePresent,
      ).toBe(false);
      // 원본 불변.
      expect(hasActiveKey(env, "AUTH_JWT_SECRET")).toBe(true);
    });

    it("negative (c) — DATABASE_URL active 행을 # DATABASE_URL 로 주석-강등 mutant → 필수 active 키 주석-강등(DB 연결 문자열 소실) 검출", () => {
      const env = readFileSync(ENV_EXAMPLE_PATH, "utf8");
      expect(hasActiveKey(env, "DATABASE_URL")).toBe(true);
      const mutant = env.replace(/\nDATABASE_URL=/, "\n# DATABASE_URL=");
      expect(hasActiveKey(mutant, "DATABASE_URL")).toBe(false);
      expect(hasCommentedKey(mutant, "DATABASE_URL")).toBe(true);
      expect(
        extractEnvTemplateAnchors(
          mutant,
          readFileSync(SEED_SCRIPT_PATH, "utf8"),
        ).requiredActivePresent,
      ).toBe(false);
      // 원본 불변.
      expect(hasActiveKey(env, "DATABASE_URL")).toBe(true);
    });

    it("negative (d) — env 에서 SEED_LLM_MODEL_ID 문서화 제거 mutant → 소비셋 ⊋ 문서화셋 parity drift 검출", () => {
      const env = readFileSync(ENV_EXAMPLE_PATH, "utf8");
      const seed = readFileSync(SEED_SCRIPT_PATH, "utf8");
      expect(setsEqual(seedLlmKeys(env), seedLlmKeys(seed))).toBe(true);
      const mutant = env.replace(/SEED_LLM_MODEL_ID/g, "OMITTED_MODEL_ID");
      expect(seedLlmKeys(mutant)).not.toContain("SEED_LLM_MODEL_ID");
      expect(seedLlmKeys(seed)).toContain("SEED_LLM_MODEL_ID");
      expect(setsEqual(seedLlmKeys(mutant), seedLlmKeys(seed))).toBe(false);
      expect(extractEnvTemplateAnchors(mutant, seed).seedKeysetParity).toBe(
        false,
      );
      // 원본 불변.
      expect(setsEqual(seedLlmKeys(env), seedLlmKeys(seed))).toBe(true);
    });

    it("negative (e) — DATABASE_URL credential user assessment_agent→root(POSTGRES_USER 불일치) mutant → 내부 credential parity drift 검출", () => {
      const env = readFileSync(ENV_EXAMPLE_PATH, "utf8");
      expect(credentialParityHolds(env)).toBe(true);
      const mutant = env.replace(
        "postgresql://assessment_agent:",
        "postgresql://root:",
      );
      expect(databaseUrlCredentialUser(mutant)).toBe("root");
      expect(activeValue(mutant, "POSTGRES_USER")).toBe("assessment_agent");
      expect(credentialParityHolds(mutant)).toBe(false);
      expect(
        extractEnvTemplateAnchors(
          mutant,
          readFileSync(SEED_SCRIPT_PATH, "utf8"),
        ).credentialParity,
      ).toBe(false);
      // 원본 불변.
      expect(credentialParityHolds(env)).toBe(true);
    });

    it("negative (f) — # LLM_APIKEY_ENC_KEY 주석-해제(활성화) mutant → gated-optional 키 default-on 강제(미사용 배포 마찰) 검출", () => {
      const env = readFileSync(ENV_EXAMPLE_PATH, "utf8");
      expect(gatedKeyDisciplined(env, "LLM_APIKEY_ENC_KEY")).toBe(true);
      const mutant = env.replace(
        /# LLM_APIKEY_ENC_KEY=/,
        "LLM_APIKEY_ENC_KEY=",
      );
      expect(hasActiveKey(mutant, "LLM_APIKEY_ENC_KEY")).toBe(true);
      expect(gatedKeyDisciplined(mutant, "LLM_APIKEY_ENC_KEY")).toBe(false);
      expect(
        extractEnvTemplateAnchors(
          mutant,
          readFileSync(SEED_SCRIPT_PATH, "utf8"),
        ).gatedDisciplined,
      ).toBe(false);
      // 원본 불변.
      expect(gatedKeyDisciplined(env, "LLM_APIKEY_ENC_KEY")).toBe(true);
    });

    it("negative (g) — AUTH_JWT_SECRET placeholder→구체 실값(deadbeef...) mutant → 두 번째 시크릿 보유 키 실값 커밋(§9 유출) 검출", () => {
      const env = readFileSync(ENV_EXAMPLE_PATH, "utf8");
      expect(
        isAnglePlaceholder(activeValue(env, "AUTH_JWT_SECRET") as string),
      ).toBe(true);
      const mutant = env.replace(
        /AUTH_JWT_SECRET=<[^>]*>/,
        "AUTH_JWT_SECRET=deadbeefcafe0123deadbeefcafe0123",
      );
      expect(activeValue(mutant, "AUTH_JWT_SECRET")).toBe(
        "deadbeefcafe0123deadbeefcafe0123",
      );
      expect(
        isAnglePlaceholder(activeValue(mutant, "AUTH_JWT_SECRET") as string),
      ).toBe(false);
      expect(
        extractEnvTemplateAnchors(
          mutant,
          readFileSync(SEED_SCRIPT_PATH, "utf8"),
        ).secretsArePlaceholders,
      ).toBe(false);
      // 원본 불변.
      expect(
        isAnglePlaceholder(activeValue(env, "AUTH_JWT_SECRET") as string),
      ).toBe(true);
    });

    it("negative — §9 credential/secret 누출 0: 추출/합성 토큰에 gh 토큰 어휘·실 credential·실 endpoint 미등장(§9/REQ-059)", () => {
      const env = readFileSync(ENV_EXAMPLE_PATH, "utf8");
      const seed = readFileSync(SEED_SCRIPT_PATH, "utf8");
      const anchors = extractEnvTemplateAnchors(env, seed);
      // 추출 토큰 — env 키 이름·placeholder·비시크릿 기본값·SEED_LLM 키 이름만.
      const synthesized = [
        JSON.stringify(anchors),
        JSON.stringify(activeAssignments(env).map((a) => a.key)),
        JSON.stringify(seedLlmKeys(env)),
        JSON.stringify(seedLlmKeys(seed)),
        String(databaseUrlCredentialUser(env)),
        String(activeValue(env, "POSTGRES_USER")),
      ];
      // 강한 패턴(password/secret 값 포함) — 추출 토큰은 키 이름·placeholder 뿐이라 전부 clean.
      const strongPattern =
        /(ghp_|--token|GITHUB_TOKEN|GH_TOKEN|\bBearer\b|Authorization|\bsk-)/i;
      synthesized.forEach((s) => {
        expect(strongPattern.test(s)).toBe(false);
      });
      // 실 env.prod.example 소스에도 실 토큰(ghp_)·Bearer 자격·실값 secret 미등장.
      const leakPattern = /(ghp_|GH_TOKEN=|\bBearer\b|Authorization:)/;
      expect(leakPattern.test(env)).toBe(false);
      // 시크릿 보유 키 값이 placeholder 뿐(실 hex/base64 secret 미등장) — <...> 만.
      expect(
        isAnglePlaceholder(activeValue(env, "POSTGRES_PASSWORD") as string),
      ).toBe(true);
      expect(
        isAnglePlaceholder(activeValue(env, "AUTH_JWT_SECRET") as string),
      ).toBe(true);
      // DATABASE_URL 에 실 password(user:pass@host)가 아니라 <...> placeholder 만.
      expect(unquote(activeValue(env, "DATABASE_URL") as string)).toMatch(
        /postgresql:\/\/assessment_agent:<[^>]*>@postgres:5432\//,
      );
    });
  });

  describe("flow: 결정론 · no-mutation(원본 read-only 입증)", () => {
    it("동일 입력으로 pure 함수를 두 번 호출하면 deep-equal(결정론)", () => {
      const env = readFileSync(ENV_EXAMPLE_PATH, "utf8");
      const seed = readFileSync(SEED_SCRIPT_PATH, "utf8");
      expect(extractEnvTemplateAnchors(env, seed)).toEqual(
        extractEnvTemplateAnchors(env, seed),
      );
      expect(activeAssignments(env)).toEqual(activeAssignments(env));
      expect(seedLlmKeys(env)).toEqual(seedLlmKeys(env));
    });

    it("합성 mutate(사본 replace) 후에도 원본 env/seed 소스 텍스트·pure 함수 산출이 불변(원본 read-only)", () => {
      const env = readFileSync(ENV_EXAMPLE_PATH, "utf8");
      const seed = readFileSync(SEED_SCRIPT_PATH, "utf8");
      const envSnap = env;
      const seedSnap = seed;
      // 사본 mutate(negative a/c/e/f 에서 쓰는 replace) — 원본 불변 확인.
      env.replace(
        /POSTGRES_PASSWORD=<[^>]*>/,
        "POSTGRES_PASSWORD=hunter2-real",
      );
      env.replace(/\nDATABASE_URL=/, "\n# DATABASE_URL=");
      env.replace("postgresql://assessment_agent:", "postgresql://root:");
      env.replace(/# LLM_APIKEY_ENC_KEY=/, "LLM_APIKEY_ENC_KEY=");
      seed.replace(/SEED_LLM_MODEL_ID/g, "OMITTED");
      expect(env).toBe(envSnap);
      expect(seed).toBe(seedSnap);
      // 추출/파싱 후에도 원본 불변.
      extractEnvTemplateAnchors(env, seed);
      expect(env).toBe(envSnap);
      expect(seed).toBe(seedSnap);
    });
  });

  describe("dormant / non-gated 확인 — side-effect 0", () => {
    it("템플릿 해석 모델이 env / 전역 상태 없이 순수하게 동작(non-gated — describe.skip 0·gating 분기 0)", () => {
      // 본 describe 가 실행된다는 것 자체가 describe.skip 0(항상 실행)의 런타임 증거.
      const envSnapshot = { ...process.env };
      const env = readFileSync(ENV_EXAMPLE_PATH, "utf8");
      const before = credentialParityHolds(env);
      // 실 process.env 를 mutate 해도 산출 불변 — 모델이 process.env 를 참조하지 않음(파라미터로만).
      Object.assign(process.env, { ENV_TEMPLATE_UNIT_TEST: "x" });
      const after = credentialParityHolds(env);
      delete process.env.ENV_TEMPLATE_UNIT_TEST;
      expect(after).toBe(before);
      expect(Object.keys(process.env)).toEqual(Object.keys(envSnapshot));
    });

    it("파일 read 는 env.prod.example/seed-llm-config.sh 읽기만 — 실 .env 생성/실 cp/실 seed/실 컨테이너/실 DB 0. env.prod.example 은 조건 분기 없는 선언적 env 템플릿 — 런타임 분기 없음(선언적 템플릿)이라 happy/negative mutant 로 대체 cover", () => {
      const env = readFileSync(ENV_EXAMPLE_PATH, "utf8");
      const seed = readFileSync(SEED_SCRIPT_PATH, "utf8");
      expect(REQUIRED_ACTIVE_KEYS.every((k) => hasActiveKey(env, k))).toBe(
        true,
      );
      expect(
        SECRET_KEYS.every((k) =>
          isAnglePlaceholder(activeValue(env, k) as string),
        ),
      ).toBe(true);
      expect(credentialParityHolds(env)).toBe(true);
      expect(GATED_KEYS.every((k) => gatedKeyDisciplined(env, k))).toBe(true);
      expect(setsEqual(seedLlmKeys(env), seedLlmKeys(seed))).toBe(true);
    });
  });
});
