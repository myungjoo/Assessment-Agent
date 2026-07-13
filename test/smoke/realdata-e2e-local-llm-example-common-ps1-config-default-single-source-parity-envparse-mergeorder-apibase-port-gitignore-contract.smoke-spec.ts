// realdata-e2e-local-llm-example-common-ps1-config-default-single-source-parity-envparse-mergeorder-apibase-port-gitignore-contract.smoke-spec.ts
// — 로컬 Ollama live-LLM 운영 premise leg 후속. T-0966 이 `deploy/local-llm-example/config.env`(LLM 호스트측 설정
// 정본) 의 내부 계약 + seed cross-parity 를 봉했고, 본 task 는 그 config.env 를 **코드로 로드/소비**하며 동일 계약을
// **코드-내 기본값으로 embedding** 하는 공용 헬퍼 `deploy/local-llm-example/_common.ps1`(모든 로컬 LLM 스크립트가
// dot-source 하는 single-source 헬퍼) 의 정본 계약 + config.env/.gitignore cross-artifact parity 를 세 실 파일을
// readFileSync 로 읽어(실 PowerShell 실행/실 Ollama 기동/실 추론/실 LAN 노출 0) 정적 검증하는 non-gated smoke
// (T-0967, PLAN.md §108/§109 재배포 runner chain — LLM 호스트측 코드-정본 leg).
//
// 봉함 불변식(핵심 위험 = 코드-기본값 drift. Get-LlmConfig 는 hashtable 5종 기본값을 코드로 embedding 한 뒤
// config.env 를 읽어 덮어쓴다 — config.env 부재/누락 시 이 코드-기본값이 실효 설정. 코드-기본값이 config.env
// 정본과 어긋나면 운영자가 config.env 를 신뢰한 채 예상 못한 모델/포트/endpoint 로 조용히 서빙):
//   (1) 코드-기본값 hashtable 5종(OLLAMA_MODEL·OLLAMA_HOST·OLLAMA_KEEP_ALIVE·OPENAI_BASE_URL·LAN_ALLOW_CIDR) 각
//       값 ↔ config.env 동명 active 키 값 cross-artifact byte-parity(1순위 계약). drift 시 config.env 누락하면
//       실효 설정이 정본과 어긋남.
//   (2) Read-EnvFile 파서 형식 규약(# 주석 skip·빈 줄 skip·= 인덱스 ≥ 1 가드·값 양끝 따옴표 제거) 이 소스에 존재
//       — config.env line 8 문서 형식(KEY=VALUE·# 시작/빈 줄 무시)과 정합.
//   (3) Get-LlmConfig 병합 순서: config.env 를 먼저·config.local.env 를 나중에 Read-EnvFile(뒤가 최우선) —
//       config.env line 4~6 override 문서와 정합.
//   (4) config.local.env(_common.ps1 이 읽는 개인 override) ↔ .gitignore line 2 커밋-금지 등재 cross-artifact
//       parity. 미등재면 개인 secret override 가 실수로 커밋될 위험.
//   (5) Get-LocalApiBase 기본 포트 '11434' + 포트 추출 정규식 `:(\d+)` 이 소스에 존재하고 config.env 포트(11434)와
//       byte-동일.
//   (6) Test-OllamaServer 헬스 endpoint `/api/version`(Ollama 서버 헬스 규약).
//
// 전략(형제 T-0966 config.env 내부+cross-parity·T-0965 README runbook·T-0964 env.prod.example 동형): 세 실 파일에서
// 정본 토큰을 정적 추출하는 해석 동형 TS 순수 함수(psHashtableDefault·configValue·parserGuardsPresent·mergeOrder·
// apiBaseDefaultPort·apiBasePortRegexPresent·healthEndpointPresent·gitignoreActiveEntries·extractCommonPsAnchors)로
// 코드-기본값 cross-parity·파서/병합/포트/헬스 규약·gitignore parity 를 assert. 합성 mutant 사본으로 negative
// (a~h 8종) 변별. T-0966(config.env 내부 계약·seed cross-parity) 와 distinct — 본 task 는 config.env 를 **코드로
// 소비/embedding** 하는 _common.ps1 측 계약만.
//   🔥 실 PowerShell 실행 0 · 실 Ollama pull/serve/추론 0 · 실 LAN 노출/실 방화벽 0 · process.env 읽기 0(입력은 pure
//      함수 파라미터) · credential 0(§9/REQ-059) · 새 dep 0(node fs/path, ps1/ini 파서 추가 0) · src 변경 0(test-only)
//      · _common.ps1/config.env/.gitignore 읽기만(실행 0 · 변경 0).
import { existsSync, readFileSync } from "fs";
import * as path from "path";

// repo-root 경로 — test 실행 cwd 무관하게 robust 하게 해석(`__dirname` = test/smoke,
// 두 단계 위가 repo-root). `process.cwd()` 대신 `__dirname` 기준 상대로 고정(sibling T-0966).
const REPO_ROOT = path.resolve(__dirname, "../..");
const LLM_DIR = path.join(REPO_ROOT, "deploy", "local-llm-example");
const COMMON_PS1_PATH = path.join(LLM_DIR, "_common.ps1");
const CONFIG_ENV_PATH = path.join(LLM_DIR, "config.env");
const GITIGNORE_PATH = path.join(LLM_DIR, ".gitignore");

// 정본 앵커(실 artifact 표현의 TS mirror — 실 PowerShell/실 Ollama 0).
const CODE_DEFAULT_KEYS = [
  "OLLAMA_MODEL",
  "OLLAMA_HOST",
  "OLLAMA_KEEP_ALIVE",
  "OPENAI_BASE_URL",
  "LAN_ALLOW_CIDR",
]; // Get-LlmConfig 코드-기본값 hashtable 5종.
const EXPECTED_DEFAULTS: Record<string, string> = {
  OLLAMA_MODEL: "gemma4:12b",
  OLLAMA_HOST: "127.0.0.1:11434",
  OLLAMA_KEEP_ALIVE: "5m",
  OPENAI_BASE_URL: "http://127.0.0.1:11434/v1",
  LAN_ALLOW_CIDR: "192.168.0.0/24",
}; // 코드-기본값 = config.env active 값(cross-parity 대상).
const EXPECTED_PORT = "11434"; // OLLAMA_HOST · OPENAI_BASE_URL · Get-LocalApiBase 기본 포트 공통.
const LOCAL_OVERRIDE_FILE = "config.local.env"; // _common.ps1 이 읽는 개인 override — .gitignore 등재 대상.
const HEALTH_ENDPOINT = "/api/version"; // Test-OllamaServer 헬스 endpoint 규약.

// ── TS 동형 pure 함수(정본) — _common.ps1 / config.env / .gitignore 의 정본 토큰을 모델링.
//    입력(문자열)은 mutate 하지 않는다(읽기만). 실 ps1/ini 파서 라이브러리 0 — 정규식/행 슬라이스만.

// 소스를 CRLF-정규화 후 라인 배열로 — 모든 파서의 공통 입력.
function toLines(source: string): string[] {
  return source.replace(/\r\n/g, "\n").split("\n");
}

// psHashtableDefault(common, key): Get-LlmConfig 코드-기본값 hashtable 의 `KEY = '<value>'` 값 — 부재면 undefined.
//   PowerShell 작은따옴표 리터럴만 매칭(hashtable 표현) — 부재/변질 시 undefined 로 명시적 실패.
function psHashtableDefault(common: string, key: string): string | undefined {
  const m = common.match(new RegExp(`\\b${key}\\s*=\\s*'([^']*)'`));
  return m ? m[1] : undefined;
}

// configValue(config, key): 주석 아닌 첫 `KEY=VALUE` 행의 VALUE(양끝 공백 trim) — 부재면 undefined.
function configValue(config: string, key: string): string | undefined {
  for (const line of toLines(config)) {
    if (/^\s*#/.test(line)) continue;
    const m = line.match(new RegExp(`^\\s*${key}=(.*)$`));
    if (m) return m[1].trim();
  }
  return undefined;
}

// extractPort(hostOrUrl): `host:PORT` 또는 `scheme://host:PORT/path` 문자열의 포트 — 부재면 undefined.
//   스킴 콜론(`http:`) 은 뒤가 숫자가 아니라 `//` 이라 매칭 안 됨 — 첫 `:<digits>` 만 포트로 인식.
function extractPort(hostOrUrl: string | undefined): string | undefined {
  if (hostOrUrl === undefined) return undefined;
  const m = hostOrUrl.match(/:(\d{2,5})(?:\/|$)/);
  return m ? m[1] : undefined;
}

// parserGuardsPresent(common): Read-EnvFile 파서 형식 규약 4종이 소스에 모두 존재하는가.
//   (# 주석 skip · 빈 줄 skip · '=' 인덱스 ≥ 1 가드 · 값 양끝 따옴표 제거 로직)
function parserGuardsPresent(common: string): boolean {
  const commentSkip = common.includes(".StartsWith('#')");
  const blankSkip = /\$t\s+-eq\s+''/.test(common);
  const eqIndexGuard = /\$idx\s+-lt\s+1/.test(common);
  const quoteStrip = common.includes("$val.Substring(1, $val.Length - 2)");
  return commentSkip && blankSkip && eqIndexGuard && quoteStrip;
}

// mergeOrder(common): Get-LlmConfig 가 Read-EnvFile 로 읽는 config.env / config.local.env 의 소스 등장 순서.
//   { configEnvAt, localEnvAt } — 부재면 -1. configEnvAt < localEnvAt 이어야 병합순서(local 최우선) 성립.
function mergeOrder(common: string): {
  configEnvAt: number;
  localEnvAt: number;
} {
  return {
    configEnvAt: common.indexOf("'config.env'"),
    localEnvAt: common.indexOf("'config.local.env'"),
  };
}

// mergeOrderConfigThenLocal(common): config.env 를 먼저·config.local.env 를 나중에 읽는가(뒤가 최우선).
function mergeOrderConfigThenLocal(common: string): boolean {
  const { configEnvAt, localEnvAt } = mergeOrder(common);
  return configEnvAt >= 0 && localEnvAt >= 0 && configEnvAt < localEnvAt;
}

// apiBaseDefaultPort(common): Get-LocalApiBase 의 `$port = '<digits>'` 기본 포트 토큰 — 부재면 undefined.
function apiBaseDefaultPort(common: string): string | undefined {
  const m = common.match(/\$port\s*=\s*'(\d+)'/);
  return m ? m[1] : undefined;
}

// apiBasePortRegexPresent(common): host:port 에서 port 를 추출하는 정규식 `:(\d+)` 이 소스에 존재하는가.
function apiBasePortRegexPresent(common: string): boolean {
  return common.includes(":(\\d+)");
}

// healthEndpointPresent(common): Test-OllamaServer 헬스 endpoint `/api/version` 이 소스에 존재하는가.
function healthEndpointPresent(common: string): boolean {
  return common.includes(HEALTH_ENDPOINT);
}

// gitignoreActiveEntries(gitignore): 주석(#)/빈 줄 아닌 항목 행(trim)들의 집합.
function gitignoreActiveEntries(gitignore: string): string[] {
  const out: string[] = [];
  for (const line of toLines(gitignore)) {
    const t = line.trim();
    if (t === "" || t.startsWith("#")) continue;
    out.push(t);
  }
  return out;
}

// gitignoreHasEntry(gitignore, name): 특정 항목이 커밋-금지로 등재됐는가.
function gitignoreHasEntry(gitignore: string, name: string): boolean {
  return gitignoreActiveEntries(gitignore).includes(name);
}

// localOverrideRead(common): _common.ps1 이 개인 override 로 config.local.env 를 읽는가(소스 리터럴 존재).
function localOverrideRead(common: string): boolean {
  return common.includes(`'${LOCAL_OVERRIDE_FILE}'`);
}

// (집계) extractCommonPsAnchors(common, config, gitignore): 코드-기본값 cross-parity·파서/병합/포트/헬스 규약·
//   gitignore parity 불변식을 한 번에 집계 — 하나라도 부재/변질이면 명시적 false(빈 결과 성공-위장 0).
function extractCommonPsAnchors(
  common: string,
  config: string,
  gitignore: string,
): {
  codeDefaultCrossParity: boolean;
  parserFormatContract: boolean;
  mergeOrderContract: boolean;
  localOverrideGitignored: boolean;
  apiBasePortContract: boolean;
  healthEndpointContract: boolean;
} {
  const codeDefaultCrossParity = CODE_DEFAULT_KEYS.every((k) => {
    const codeVal = psHashtableDefault(common, k);
    const cfgVal = configValue(config, k);
    return codeVal !== undefined && cfgVal !== undefined && codeVal === cfgVal;
  });
  const apiPort = apiBaseDefaultPort(common);
  const hostPort = extractPort(configValue(config, "OLLAMA_HOST"));
  const basePort = extractPort(configValue(config, "OPENAI_BASE_URL"));
  return {
    codeDefaultCrossParity,
    parserFormatContract: parserGuardsPresent(common),
    mergeOrderContract: mergeOrderConfigThenLocal(common),
    localOverrideGitignored:
      localOverrideRead(common) &&
      gitignoreHasEntry(gitignore, LOCAL_OVERRIDE_FILE),
    apiBasePortContract:
      apiBasePortRegexPresent(common) &&
      apiPort === EXPECTED_PORT &&
      hostPort === EXPECTED_PORT &&
      basePort === EXPECTED_PORT,
    healthEndpointContract: healthEndpointPresent(common),
  };
}

describe("realdata-e2e §108/§109 deploy/local-llm-example/_common.ps1 공용 헬퍼 코드-정본 계약 + config.env/.gitignore cross-artifact parity smoke — Get-LlmConfig 코드-기본값 5종↔config.env byte-parity + Read-EnvFile 형식 규약 + config.env→config.local.env 병합순서 + config.local.env↔.gitignore 커밋금지 parity + Get-LocalApiBase 포트 11434 규약 + Test-OllamaServer /api/version 헬스 endpoint + secret-safety (T-0967)", () => {
  const common = () => readFileSync(COMMON_PS1_PATH, "utf8");
  const config = () => readFileSync(CONFIG_ENV_PATH, "utf8");
  const gitignore = () => readFileSync(GITIGNORE_PATH, "utf8");

  describe("Happy-path: 대조 artifact 3종 실존 + 6 불변식 전부 true", () => {
    it("_common.ps1·config.env·.gitignore 가 repo-root 기준 실존(existsSync)", () => {
      expect(existsSync(COMMON_PS1_PATH)).toBe(true);
      expect(existsSync(CONFIG_ENV_PATH)).toBe(true);
      expect(existsSync(GITIGNORE_PATH)).toBe(true);
    });

    it("6 불변식(코드-기본값 cross-parity·파서 형식 규약·병합순서·gitignore parity·포트 규약·헬스 endpoint) 전부 true", () => {
      const anchors = extractCommonPsAnchors(common(), config(), gitignore());
      expect(anchors.codeDefaultCrossParity).toBe(true);
      expect(anchors.parserFormatContract).toBe(true);
      expect(anchors.mergeOrderContract).toBe(true);
      expect(anchors.localOverrideGitignored).toBe(true);
      expect(anchors.apiBasePortContract).toBe(true);
      expect(anchors.healthEndpointContract).toBe(true);
    });
  });

  describe("Happy-path(1순위 계약): 코드-기본값 hashtable 5종 ↔ config.env active 값 cross-artifact byte-parity(키당 1+)", () => {
    it("OLLAMA_MODEL 코드-기본값(gemma4:12b) 이 config.env 값과 byte-동일", () => {
      expect(psHashtableDefault(common(), "OLLAMA_MODEL")).toBe(
        EXPECTED_DEFAULTS.OLLAMA_MODEL,
      );
      expect(configValue(config(), "OLLAMA_MODEL")).toBe(
        EXPECTED_DEFAULTS.OLLAMA_MODEL,
      );
      expect(psHashtableDefault(common(), "OLLAMA_MODEL")).toBe(
        configValue(config(), "OLLAMA_MODEL"),
      );
    });

    it("OLLAMA_HOST 코드-기본값(127.0.0.1:11434) 이 config.env 값과 byte-동일", () => {
      expect(psHashtableDefault(common(), "OLLAMA_HOST")).toBe(
        EXPECTED_DEFAULTS.OLLAMA_HOST,
      );
      expect(psHashtableDefault(common(), "OLLAMA_HOST")).toBe(
        configValue(config(), "OLLAMA_HOST"),
      );
    });

    it("OLLAMA_KEEP_ALIVE 코드-기본값(5m) 이 config.env 값과 byte-동일", () => {
      expect(psHashtableDefault(common(), "OLLAMA_KEEP_ALIVE")).toBe(
        EXPECTED_DEFAULTS.OLLAMA_KEEP_ALIVE,
      );
      expect(psHashtableDefault(common(), "OLLAMA_KEEP_ALIVE")).toBe(
        configValue(config(), "OLLAMA_KEEP_ALIVE"),
      );
    });

    it("OPENAI_BASE_URL 코드-기본값(http://127.0.0.1:11434/v1) 이 config.env 값과 byte-동일", () => {
      expect(psHashtableDefault(common(), "OPENAI_BASE_URL")).toBe(
        EXPECTED_DEFAULTS.OPENAI_BASE_URL,
      );
      expect(psHashtableDefault(common(), "OPENAI_BASE_URL")).toBe(
        configValue(config(), "OPENAI_BASE_URL"),
      );
    });

    it("LAN_ALLOW_CIDR 코드-기본값(192.168.0.0/24) 이 config.env 값과 byte-동일", () => {
      expect(psHashtableDefault(common(), "LAN_ALLOW_CIDR")).toBe(
        EXPECTED_DEFAULTS.LAN_ALLOW_CIDR,
      );
      expect(psHashtableDefault(common(), "LAN_ALLOW_CIDR")).toBe(
        configValue(config(), "LAN_ALLOW_CIDR"),
      );
    });

    it("5종 전부 코드-기본값 = config.env 값(집계 cross-parity true)", () => {
      expect(
        extractCommonPsAnchors(common(), config(), gitignore())
          .codeDefaultCrossParity,
      ).toBe(true);
    });
  });

  describe("Happy-path: Read-EnvFile 파서 형식 규약(# skip·빈 줄 skip·= 인덱스 ≥ 1·따옴표 제거) 소스 존재", () => {
    it("4 파서 가드가 모두 소스에 존재하고 config.env line 8 문서 형식(KEY=VALUE·# 무시)과 정합", () => {
      const c = common();
      expect(parserGuardsPresent(c)).toBe(true);
      expect(c.includes(".StartsWith('#')")).toBe(true);
      expect(/\$idx\s+-lt\s+1/.test(c)).toBe(true);
      expect(c.includes("$val.Substring(1, $val.Length - 2)")).toBe(true);
      // config.env 가 형식(# 시작/빈 줄 무시) 을 문서화.
      expect(config()).toContain("'#' 로 시작하는 줄과 빈 줄은 무시된다");
    });
  });

  describe("Happy-path: Get-LlmConfig 병합 순서(config.env 먼저·config.local.env 나중 — local 최우선)", () => {
    it("config.env 가 config.local.env 보다 소스에서 먼저 Read-EnvFile 호출됨(뒤가 최우선)", () => {
      const c = common();
      const { configEnvAt, localEnvAt } = mergeOrder(c);
      expect(configEnvAt).toBeGreaterThanOrEqual(0);
      expect(localEnvAt).toBeGreaterThanOrEqual(0);
      expect(configEnvAt).toBeLessThan(localEnvAt);
      expect(mergeOrderConfigThenLocal(c)).toBe(true);
      // config.env 주석이 override(config.local.env 최우선) 를 문서화.
      expect(config()).toContain("config.local.env");
    });
  });

  describe("cross-artifact: config.local.env(_common.ps1 이 읽는 개인 override) ↔ .gitignore 커밋-금지 parity", () => {
    it("_common.ps1 이 config.local.env 를 읽고 그 파일이 .gitignore line 2 에 커밋-금지로 등재됨", () => {
      const c = common();
      const g = gitignore();
      expect(localOverrideRead(c)).toBe(true);
      expect(gitignoreHasEntry(g, LOCAL_OVERRIDE_FILE)).toBe(true);
      expect(gitignoreActiveEntries(g)).toContain(LOCAL_OVERRIDE_FILE);
    });
  });

  describe("Happy-path: Get-LocalApiBase 기본 포트 '11434' + 추출 정규식 존재 + config.env 포트 byte-parity", () => {
    it("기본 포트 토큰 11434 · `:(\\d+)` 정규식 존재 · config.env host/base 포트(11434) 와 동일", () => {
      const c = common();
      expect(apiBaseDefaultPort(c)).toBe(EXPECTED_PORT);
      expect(apiBasePortRegexPresent(c)).toBe(true);
      expect(extractPort(configValue(config(), "OLLAMA_HOST"))).toBe(
        EXPECTED_PORT,
      );
      expect(extractPort(configValue(config(), "OPENAI_BASE_URL"))).toBe(
        EXPECTED_PORT,
      );
      expect(
        extractCommonPsAnchors(c, config(), gitignore()).apiBasePortContract,
      ).toBe(true);
    });
  });

  describe("Happy-path: Test-OllamaServer 헬스 endpoint /api/version 규약", () => {
    it("Test-OllamaServer 가 /api/version 헬스 endpoint 를 소스에 포함", () => {
      const c = common();
      expect(healthEndpointPresent(c)).toBe(true);
      expect(c).toContain(HEALTH_ENDPOINT);
    });
  });

  describe("Error path / negative cases 충분 cover (mutant 합성 사본 — 원본 미변조, 예외 분기마다 각 1+)", () => {
    it("error path — 대조 artifact 부재 경로 → readFileSync throw(silent 0-byte fallback 0)", () => {
      const badPath = path.join(LLM_DIR, "__does_not_exist___common.ps1");
      expect(existsSync(badPath)).toBe(false);
      expect(() => readFileSync(badPath, "utf8")).toThrow();
    });

    it("error path — 앵커 토큰 부재 시 명시적 false(빈 매칭을 pass 로 오통과 0)", () => {
      const anchors = extractCommonPsAnchors("", "", "");
      expect(anchors.codeDefaultCrossParity).toBe(false);
      expect(anchors.parserFormatContract).toBe(false);
      expect(anchors.mergeOrderContract).toBe(false);
      expect(anchors.localOverrideGitignored).toBe(false);
      expect(anchors.apiBasePortContract).toBe(false);
      expect(anchors.healthEndpointContract).toBe(false);
      // 실 소스는 반대로 전부 true — 부재/실재 변별.
      const real = extractCommonPsAnchors(common(), config(), gitignore());
      expect(Object.values(real).every((v) => v === true)).toBe(true);
    });

    it("negative (a) — 코드-기본값 OLLAMA_MODEL gemma4:12b→llama3:8b mutant → config.env 와 코드-기본값 cross-parity drift 검출", () => {
      const c = common();
      const mutant = c.replace(
        "OLLAMA_MODEL      = 'gemma4:12b'",
        "OLLAMA_MODEL      = 'llama3:8b'",
      );
      expect(psHashtableDefault(mutant, "OLLAMA_MODEL")).toBe("llama3:8b");
      expect(
        extractCommonPsAnchors(mutant, config(), gitignore())
          .codeDefaultCrossParity,
      ).toBe(false);
      // 원본 불변.
      expect(psHashtableDefault(c, "OLLAMA_MODEL")).toBe(
        EXPECTED_DEFAULTS.OLLAMA_MODEL,
      );
    });

    it("negative (b) — 코드-기본값 OLLAMA_HOST 포트 11434→8080 mutant → config.env 포트와 cross-parity drift 검출", () => {
      const c = common();
      const mutant = c.replace(
        "OLLAMA_HOST       = '127.0.0.1:11434'",
        "OLLAMA_HOST       = '127.0.0.1:8080'",
      );
      expect(extractPort(psHashtableDefault(mutant, "OLLAMA_HOST"))).toBe(
        "8080",
      );
      expect(
        extractCommonPsAnchors(mutant, config(), gitignore())
          .codeDefaultCrossParity,
      ).toBe(false);
      // 원본 불변.
      expect(psHashtableDefault(c, "OLLAMA_HOST")).toBe(
        EXPECTED_DEFAULTS.OLLAMA_HOST,
      );
    });

    it("negative (c) — 코드-기본값 OPENAI_BASE_URL 의 /v1 suffix 제거 mutant → config.env endpoint 규약과 drift 검출", () => {
      const c = common();
      const mutant = c.replace(
        "OPENAI_BASE_URL   = 'http://127.0.0.1:11434/v1'",
        "OPENAI_BASE_URL   = 'http://127.0.0.1:11434'",
      );
      expect(psHashtableDefault(mutant, "OPENAI_BASE_URL")).toBe(
        "http://127.0.0.1:11434",
      );
      expect(
        extractCommonPsAnchors(mutant, config(), gitignore())
          .codeDefaultCrossParity,
      ).toBe(false);
      // 원본 불변.
      expect(psHashtableDefault(c, "OPENAI_BASE_URL")).toBe(
        EXPECTED_DEFAULTS.OPENAI_BASE_URL,
      );
    });

    it("negative (d) — Read-EnvFile 의 `#` 주석 skip 가드 제거 mutant → 파서 형식 규약 drift 검출", () => {
      const c = common();
      const mutant = c.replace(" -or $t.StartsWith('#')", "");
      expect(mutant.includes(".StartsWith('#')")).toBe(false);
      expect(parserGuardsPresent(mutant)).toBe(false);
      expect(
        extractCommonPsAnchors(mutant, config(), gitignore())
          .parserFormatContract,
      ).toBe(false);
      // 원본 불변.
      expect(parserGuardsPresent(c)).toBe(true);
    });

    it("negative (e) — 병합 순서 뒤집기(config.local.env 먼저·config.env 나중) mutant → 병합순서(local 최우선) drift 검출", () => {
      const c = common();
      const original =
        "    Read-EnvFile -Path (Join-Path $script:LlmExampleDir 'config.env') -Into $cfg\n" +
        "    Read-EnvFile -Path (Join-Path $script:LlmExampleDir 'config.local.env') -Into $cfg";
      const swapped =
        "    Read-EnvFile -Path (Join-Path $script:LlmExampleDir 'config.local.env') -Into $cfg\n" +
        "    Read-EnvFile -Path (Join-Path $script:LlmExampleDir 'config.env') -Into $cfg";
      const mutant = c.replace(/\r\n/g, "\n").replace(original, swapped);
      expect(mergeOrderConfigThenLocal(mutant)).toBe(false);
      expect(
        extractCommonPsAnchors(mutant, config(), gitignore())
          .mergeOrderContract,
      ).toBe(false);
      // 원본 불변.
      expect(mergeOrderConfigThenLocal(c)).toBe(true);
    });

    it("negative (f) — Get-LocalApiBase 기본 포트 11434→11500 mutant → 포트 규약 cross-parity drift 검출", () => {
      const c = common();
      const mutant = c.replace("$port = '11434'", "$port = '11500'");
      expect(apiBaseDefaultPort(mutant)).toBe("11500");
      expect(
        extractCommonPsAnchors(mutant, config(), gitignore())
          .apiBasePortContract,
      ).toBe(false);
      // 원본 불변.
      expect(apiBaseDefaultPort(c)).toBe(EXPECTED_PORT);
    });

    it("negative (g) — Test-OllamaServer 헬스 endpoint /api/version→/api/tags mutant → 헬스 endpoint 규약 drift 검출", () => {
      const c = common();
      const mutant = c.replace("/api/version", "/api/tags");
      expect(healthEndpointPresent(mutant)).toBe(false);
      expect(
        extractCommonPsAnchors(mutant, config(), gitignore())
          .healthEndpointContract,
      ).toBe(false);
      // 원본 불변.
      expect(healthEndpointPresent(c)).toBe(true);
    });

    it("negative (h) — .gitignore 에서 config.local.env 행 제거 mutant → 커밋-금지 등재 drift(gitignore 측) 검출", () => {
      const g = gitignore();
      const mutant = g.replace(/^config\.local\.env$/m, "");
      expect(gitignoreHasEntry(mutant, LOCAL_OVERRIDE_FILE)).toBe(false);
      expect(
        extractCommonPsAnchors(common(), config(), mutant)
          .localOverrideGitignored,
      ).toBe(false);
      // 원본 불변.
      expect(gitignoreHasEntry(g, LOCAL_OVERRIDE_FILE)).toBe(true);
    });

    it("negative — §9 credential/secret 누출 0: 추출/합성 토큰에 gh 토큰 어휘·실 credential·실 password·apiKey 값 미등장(§9/REQ-059)", () => {
      const synthesized = [
        JSON.stringify(extractCommonPsAnchors(common(), config(), gitignore())),
        ...CODE_DEFAULT_KEYS.map((k) =>
          String(psHashtableDefault(common(), k)),
        ),
        ...CODE_DEFAULT_KEYS.map((k) => String(configValue(config(), k))),
        JSON.stringify(gitignoreActiveEntries(gitignore())),
        String(apiBaseDefaultPort(common())),
        HEALTH_ENDPOINT,
      ];
      const strongPattern =
        /(ghp_|--token|GITHUB_TOKEN|GH_TOKEN|\bBearer\b|Authorization|\bsk-|PASSWORD=|apiKey"?\s*[:=]\s*["']?\w)/i;
      synthesized.forEach((s) => {
        expect(strongPattern.test(s)).toBe(false);
      });
      // 합성 mutant 값도 명백한 dummy(8080·11500·llama3:8b·/api/tags)로 한정 — 실 자격 0.
      const dummies = ["8080", "11500", "llama3:8b", "/api/tags"];
      dummies.forEach((d) => expect(strongPattern.test(d)).toBe(false));
      // 추출 값은 모두 비시크릿 설정 값/경로(bind 주소·CIDR·모델 tag·keep-alive·/v1·헬스 endpoint).
      expect(psHashtableDefault(common(), "OLLAMA_HOST")).toBe(
        "127.0.0.1:11434",
      );
      expect(psHashtableDefault(common(), "LAN_ALLOW_CIDR")).toBe(
        "192.168.0.0/24",
      );
    });
  });

  describe("branch: 각 정본 앵커 일치/drift 정적 대조(합성 mutant 사본 — 원본 미변조)", () => {
    it("코드-기본값 cross-parity 일치/drift 분기", () => {
      const c = common();
      expect(
        extractCommonPsAnchors(c, config(), gitignore()).codeDefaultCrossParity,
      ).toBe(true);
      const mutant = c.replace(
        "OLLAMA_KEEP_ALIVE = '5m'",
        "OLLAMA_KEEP_ALIVE = '9m'",
      );
      expect(
        extractCommonPsAnchors(mutant, config(), gitignore())
          .codeDefaultCrossParity,
      ).toBe(false);
    });

    it("gitignore parity 일치/drift 분기", () => {
      const g = gitignore();
      expect(
        extractCommonPsAnchors(common(), config(), g).localOverrideGitignored,
      ).toBe(true);
      const mutant = g.replace(/^config\.local\.env$/m, "");
      expect(
        extractCommonPsAnchors(common(), config(), mutant)
          .localOverrideGitignored,
      ).toBe(false);
    });
  });

  describe("flow: 결정론 · no-mutation(원본 read-only 입증)", () => {
    it("동일 입력으로 pure 함수를 두 번 호출하면 deep-equal(결정론)", () => {
      const c = common();
      const cfg = config();
      const g = gitignore();
      expect(extractCommonPsAnchors(c, cfg, g)).toEqual(
        extractCommonPsAnchors(c, cfg, g),
      );
      expect(gitignoreActiveEntries(g)).toEqual(gitignoreActiveEntries(g));
    });

    it("합성 mutate(사본 replace) 후에도 원본 소스 텍스트·pure 함수 산출이 불변(원본 read-only)", () => {
      const c = common();
      const cfg = config();
      const g = gitignore();
      const cSnap = c;
      const cfgSnap = cfg;
      const gSnap = g;
      // 사본 mutate(negative a~h 에서 쓰는 replace) — 원본 불변 확인.
      c.replace("OLLAMA_MODEL      = 'gemma4:12b'", "OLLAMA_MODEL      = 'x'");
      c.replace(" -or $t.StartsWith('#')", "");
      c.replace("$port = '11434'", "$port = '11500'");
      c.replace("/api/version", "/api/tags");
      g.replace(/^config\.local\.env$/m, "");
      expect(c).toBe(cSnap);
      expect(cfg).toBe(cfgSnap);
      expect(g).toBe(gSnap);
      // 추출/파싱 후에도 원본 불변.
      extractCommonPsAnchors(c, cfg, g);
      expect(c).toBe(cSnap);
      expect(g).toBe(gSnap);
    });
  });

  describe("dormant / non-gated 확인 — side-effect 0", () => {
    it("parity 모델이 env / 전역 상태 없이 순수하게 동작(non-gated — describe.skip 0·gating 분기 0)", () => {
      // 본 describe 가 실행된다는 것 자체가 describe.skip 0(항상 실행)의 런타임 증거.
      const envSnapshot = { ...process.env };
      const c = common();
      const before = psHashtableDefault(c, "OLLAMA_MODEL");
      // 실 process.env 를 mutate 해도 산출 불변 — 모델이 process.env 를 참조하지 않음(파라미터로만).
      Object.assign(process.env, { LOCAL_LLM_COMMON_PS1_UNIT_TEST: "x" });
      const after = psHashtableDefault(c, "OLLAMA_MODEL");
      delete process.env.LOCAL_LLM_COMMON_PS1_UNIT_TEST;
      expect(after).toBe(before);
      expect(Object.keys(process.env)).toEqual(Object.keys(envSnapshot));
    });

    it("파일 read 는 _common.ps1/config.env/.gitignore 읽기만 — 실 PowerShell/실 Ollama/실 추론 0. 세 파일은 조건 분기 없는 선언적 스크립트·설정 — 런타임 분기 없음(정적 소스 텍스트 앵커)이라 happy/negative mutant 로 대체 cover", () => {
      const anchors = extractCommonPsAnchors(common(), config(), gitignore());
      expect(Object.values(anchors).every((v) => v === true)).toBe(true);
    });
  });
});
