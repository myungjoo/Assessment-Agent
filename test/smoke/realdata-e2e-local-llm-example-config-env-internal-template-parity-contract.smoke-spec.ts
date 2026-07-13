// realdata-e2e-local-llm-example-config-env-internal-template-parity-contract.smoke-spec.ts
// — 무인 nightly 재배포 runner chain(T-0944~T-0965)이 봉해온 AA **서버측** artifact 의 counterpart 인
// **LLM 호스트측 설정 정본** `deploy/local-llm-example/config.env`(로컬 PC Ollama 의 실 서빙 설정 — pull/serve
// 할 모델 tag·bind 주소·OpenAI-호환 endpoint·LAN 허용 범위) 의 내부 template 계약 + `deploy/seed-llm-config.sh`
// 기본 모델 tag·예시 endpoint 규약과의 cross-artifact parity 를 두 실 파일을 readFileSync 로 읽어(실 Ollama
// 기동/실 추론/실 seed/실 LAN 노출 0) 정적 검증하는 non-gated live-LLM 운영 premise leg smoke
// (T-0966, PLAN.md §108/§109 재배포 runner chain — LLM 호스트측 설정 정본 leg).
//
// 봉함 불변식(config.env 내부 계약 + config.env↔seed cross-parity — 서버측 env.prod.example(T-0964)·README
// runbook(T-0965) 와 distinct 상보. 이 호스트측 정본이 변질되면 로컬 LLM 호스트가 AA 서버 seed 기대와 다른
// 모델/포트로 서빙 → 무인 재배포 후 live-LLM 평가가 조용히 오구성 진행):
//   (1) 필수 active 키 5종(OLLAMA_MODEL·OLLAMA_HOST·OLLAMA_KEEP_ALIVE·OPENAI_BASE_URL·LAN_ALLOW_CIDR) 이
//       주석 아닌 KEY=VALUE 행으로 각각 존재. 누락 시 스크립트/운영자가 기대 키를 못 읽어 오구성.
//   (2) OLLAMA_HOST 의 포트(11434) ↔ OPENAI_BASE_URL 의 포트(11434) 내부 parity. drift 시 Ollama 가 서빙하는
//       포트와 OpenAI-호환 base 가 달라 클라이언트가 죽은 포트로 연결.
//   (3) OPENAI_BASE_URL 이 http:// 스킴 + /v1 suffix(OpenAI-호환 규약). suffix 유실 시 OpenAI Chat Completions
//       호환 endpoint 아님.
//   (4) OLLAMA_KEEP_ALIVE 값(5m) 이 파일 주석이 문서화한 허용 값 집합(5m/0/-1) 중 하나. 규율 밖 값이면
//       자원 해제 정책 오구성.
//   (5) config.env OLLAMA_MODEL(gemma4:12b) ↔ seed-llm-config.sh SEED_LLM_MODEL_ID 기본값(gemma4:12b)
//       cross-artifact byte-parity. drift 시 호스트가 서빙하는 모델 ≠ seed 가 등록하는 modelId → 모델-미스매치.
//   (6) config.env OPENAI_BASE_URL 의 포트(11434)+suffix(/v1) ↔ seed-llm-config.sh 주석 예시 endpoint
//       (http://192.168.0.5:11434/v1) 의 포트(11434)+suffix(/v1) 동일 규약(host 는 환경 가변이라 대조 제외).
//       OpenAI-호환 경로 성립의 cross-artifact 조건.
//
// 전략(형제 T-0964 env.prod.example 내부 템플릿·T-0965 README runbook cross-artifact 동형): config.env·seed 에서
// 정본 토큰을 정적 추출하는 해석 동형 TS 순수 함수(configActiveKeys·configValue·extractPort·hasV1Suffix·
// hasHttpScheme·keepAliveDocumentedSet·seedModelDefault·seedExampleEndpoint·extractLocalLlmAnchors)로 내부·
// cross-artifact 불변식을 assert. 합성 mutant 사본으로 negative(a~g 7종) 변별. T-0959(seed 런타임 gating
// semantic) 와 distinct — 본 task 는 config.env 정적 설정 값 + seed **기본 모델 tag·예시 endpoint 규약** parity 만.
//   🔥 실 Ollama pull/serve/추론 0 · 실 seed/실 DB 0 · 실 LAN 노출/실 방화벽 0 · process.env 읽기 0(입력은 pure
//      함수 파라미터) · credential 0(§9/REQ-059) · 새 dep 0(node fs/path, env/ini 파서 추가 0) · src 변경 0(test-only)
//      · config.env/seed-llm-config.sh 읽기만(실행 0 · 변경 0).
import { existsSync, readFileSync } from "fs";
import * as path from "path";

// repo-root 경로 — test 실행 cwd 무관하게 robust 하게 해석(`__dirname` = test/smoke,
// 두 단계 위가 repo-root). `process.cwd()` 대신 `__dirname` 기준 상대로 고정한다(sibling T-0964).
const REPO_ROOT = path.resolve(__dirname, "../..");
const CONFIG_ENV_PATH = path.join(
  REPO_ROOT,
  "deploy",
  "local-llm-example",
  "config.env",
);
const SEED_SCRIPT_PATH = path.join(REPO_ROOT, "deploy", "seed-llm-config.sh");

// 정본 앵커(실 artifact 표현의 TS mirror — 실 Ollama/실 seed 0).
const REQUIRED_KEYS = [
  "OLLAMA_MODEL",
  "OLLAMA_HOST",
  "OLLAMA_KEEP_ALIVE",
  "OPENAI_BASE_URL",
  "LAN_ALLOW_CIDR",
]; // config.env 필수 active 키 5종.
const EXPECTED_MODEL_TAG = "gemma4:12b"; // config.env OLLAMA_MODEL ↔ seed SEED_LLM_MODEL_ID 기본값.
const EXPECTED_ENDPOINT_PORT = "11434"; // OLLAMA_HOST · OPENAI_BASE_URL · seed 예시 endpoint 공통 포트.
const EXPECTED_KEEP_ALIVE = "5m"; // config.env OLLAMA_KEEP_ALIVE 값.
const EXPECTED_KEEP_ALIVE_SET = ["5m", "0", "-1"]; // 파일 주석 문서화 허용 값 집합.

// ── TS 동형 pure 함수(정본) — config.env / seed 의 정본 토큰을 모델링.
//    입력(문자열)은 mutate 하지 않는다(읽기만). 실 env/ini 파서 라이브러리 0 — 정규식/행 슬라이스만.

// 소스를 CRLF-정규화 후 라인 배열로 — 모든 파서의 공통 입력.
function toLines(source: string): string[] {
  return source.replace(/\r\n/g, "\n").split("\n");
}

// configActiveKeys(config): 주석(#) / 빈 줄 아닌 `KEY=VALUE` 행의 KEY 유니크 집합(정렬).
function configActiveKeys(config: string): string[] {
  const set = new Set<string>();
  for (const line of toLines(config)) {
    if (/^\s*#/.test(line) || /^\s*$/.test(line)) continue;
    const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)=/);
    if (m) set.add(m[1]);
  }
  return [...set].sort();
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
//   스킴 콜론(`http:`) 은 뒤에 숫자가 아니라 `//` 이라 매칭 안 됨 — 첫 `:<digits>` 만 포트로 인식.
function extractPort(hostOrUrl: string | undefined): string | undefined {
  if (hostOrUrl === undefined) return undefined;
  const m = hostOrUrl.match(/:(\d{2,5})(?:\/|$)/);
  return m ? m[1] : undefined;
}

// hasV1Suffix(url): OpenAI-호환 규약 — trailing `/v1` 로 끝나는가(양끝 공백 무시).
function hasV1Suffix(url: string | undefined): boolean {
  return url !== undefined && /\/v1$/.test(url.trim());
}

// hasHttpScheme(url): `http://` 스킴으로 시작하는가.
function hasHttpScheme(url: string | undefined): boolean {
  return url !== undefined && /^http:\/\//.test(url.trim());
}

// keepAliveDocumentedSet(config): 파일 주석이 문서화한 keep-alive 허용 값 집합(정렬).
//   주석 블록의 `#   <token>  : ...` 형식(들여쓰기 2+칸 후 토큰, 콜론 앞)에서 토큰 추출.
function keepAliveDocumentedSet(config: string): string[] {
  const set = new Set<string>();
  for (const line of toLines(config)) {
    const m = line.match(/^#\s{2,}(\S+)\s+:/);
    if (m) set.add(m[1]);
  }
  return [...set].sort();
}

// seedModelDefault(seed): seed-llm-config.sh 의 `${SEED_LLM_MODEL_ID:-<default>}` 기본 모델 tag — 부재면 undefined.
function seedModelDefault(seed: string): string | undefined {
  const m = seed.match(/SEED_LLM_MODEL_ID:-([^}]+)\}/);
  return m ? m[1].trim() : undefined;
}

// seedExampleEndpoint(seed): seed-llm-config.sh 주석의 예시 endpoint(`예: http://<host>:<port>/v1`) — 부재면 undefined.
function seedExampleEndpoint(seed: string): string | undefined {
  const m = seed.match(/예:\s*(https?:\/\/\S+)/);
  return m ? m[1].trim() : undefined;
}

// (집계) extractLocalLlmAnchors(config, seed): 내부·cross-artifact 불변식을 한 번에 집계 —
//   하나라도 부재/변질이면 명시적 false(빈 결과 성공-위장 0).
function extractLocalLlmAnchors(
  config: string,
  seed: string,
): {
  requiredKeysPresent: boolean;
  internalPortParity: boolean;
  openaiCompatSuffix: boolean;
  keepAliveDocumented: boolean;
  modelTagCrossParity: boolean;
  endpointConventionCrossParity: boolean;
} {
  const keys = configActiveKeys(config);
  const host = configValue(config, "OLLAMA_HOST");
  const baseUrl = configValue(config, "OPENAI_BASE_URL");
  const model = configValue(config, "OLLAMA_MODEL");
  const keepAlive = configValue(config, "OLLAMA_KEEP_ALIVE");
  const hostPort = extractPort(host);
  const basePort = extractPort(baseUrl);
  const seedModel = seedModelDefault(seed);
  const seedEndpoint = seedExampleEndpoint(seed);
  const seedPort = extractPort(seedEndpoint);
  const docSet = keepAliveDocumentedSet(config);
  return {
    requiredKeysPresent: REQUIRED_KEYS.every((k) => keys.includes(k)),
    internalPortParity:
      hostPort !== undefined && basePort !== undefined && hostPort === basePort,
    openaiCompatSuffix: hasHttpScheme(baseUrl) && hasV1Suffix(baseUrl),
    keepAliveDocumented:
      keepAlive !== undefined &&
      docSet.length > 0 &&
      docSet.includes(keepAlive),
    modelTagCrossParity:
      model !== undefined && seedModel !== undefined && model === seedModel,
    endpointConventionCrossParity:
      basePort !== undefined &&
      seedPort !== undefined &&
      basePort === seedPort &&
      hasV1Suffix(baseUrl) &&
      hasV1Suffix(seedEndpoint),
  };
}

describe("realdata-e2e §108/§109 deploy/local-llm-example/config.env 로컬 LLM 호스트 템플릿 내부 계약 + seed cross-artifact parity smoke — 필수 active 키 5종 + OLLAMA_HOST↔OPENAI_BASE_URL 포트 내부 parity + /v1 OpenAI-호환 suffix + keep-alive 문서화 값 규율 + 모델 tag gemma4:12b↔seed 기본값 + :11434/v1 endpoint 규약 cross-parity + secret-safety (T-0966)", () => {
  const config = () => readFileSync(CONFIG_ENV_PATH, "utf8");
  const seed = () => readFileSync(SEED_SCRIPT_PATH, "utf8");

  describe("Happy-path: 대조 artifact 2종 실존 + 6 불변식(내부 4 + cross 2) 전부 true", () => {
    it("config.env·seed-llm-config.sh 가 repo-root 기준 실존(existsSync)", () => {
      expect(existsSync(CONFIG_ENV_PATH)).toBe(true);
      expect(existsSync(SEED_SCRIPT_PATH)).toBe(true);
    });

    it("6 불변식(필수 키 presence·내부 포트 parity·/v1 suffix·keep-alive 규율·모델 tag cross·endpoint 규약 cross) 전부 true", () => {
      const anchors = extractLocalLlmAnchors(config(), seed());
      expect(anchors.requiredKeysPresent).toBe(true);
      expect(anchors.internalPortParity).toBe(true);
      expect(anchors.openaiCompatSuffix).toBe(true);
      expect(anchors.keepAliveDocumented).toBe(true);
      expect(anchors.modelTagCrossParity).toBe(true);
      expect(anchors.endpointConventionCrossParity).toBe(true);
    });
  });

  describe("Happy-path: 필수 active 키 5종이 주석 아닌 KEY=VALUE 행으로 각각 존재", () => {
    it("OLLAMA_MODEL·OLLAMA_HOST·OLLAMA_KEEP_ALIVE·OPENAI_BASE_URL·LAN_ALLOW_CIDR 이 active 키 집합에 각각 존재", () => {
      const keys = configActiveKeys(config());
      for (const k of REQUIRED_KEYS) {
        expect(keys).toContain(k);
      }
      // 실 값 스냅샷(정본 동기 확인).
      expect(configValue(config(), "OLLAMA_MODEL")).toBe(EXPECTED_MODEL_TAG);
      expect(configValue(config(), "OLLAMA_HOST")).toBe("127.0.0.1:11434");
      expect(configValue(config(), "OLLAMA_KEEP_ALIVE")).toBe(
        EXPECTED_KEEP_ALIVE,
      );
      expect(configValue(config(), "OPENAI_BASE_URL")).toBe(
        "http://127.0.0.1:11434/v1",
      );
      expect(configValue(config(), "LAN_ALLOW_CIDR")).toBe("192.168.0.0/24");
    });
  });

  describe("Happy-path: OLLAMA_HOST 포트 ↔ OPENAI_BASE_URL 포트 내부 parity", () => {
    it("OLLAMA_HOST 포트(11434) 와 OPENAI_BASE_URL 포트(11434) 가 byte-동일", () => {
      const hostPort = extractPort(configValue(config(), "OLLAMA_HOST"));
      const basePort = extractPort(configValue(config(), "OPENAI_BASE_URL"));
      expect(hostPort).toBe(EXPECTED_ENDPOINT_PORT);
      expect(basePort).toBe(EXPECTED_ENDPOINT_PORT);
      expect(hostPort).toBe(basePort);
    });
  });

  describe("Happy-path: OPENAI_BASE_URL OpenAI-호환 규약(http:// 스킴 + /v1 suffix)", () => {
    it("OPENAI_BASE_URL 이 http:// 로 시작하고 /v1 로 끝남", () => {
      const baseUrl = configValue(config(), "OPENAI_BASE_URL");
      expect(hasHttpScheme(baseUrl)).toBe(true);
      expect(hasV1Suffix(baseUrl)).toBe(true);
    });
  });

  describe("Happy-path: OLLAMA_KEEP_ALIVE 값이 파일 주석 문서화 허용 집합 중 하나", () => {
    it("OLLAMA_KEEP_ALIVE 값(5m) 이 주석 문서화 허용 값 집합(5m/0/-1) 에 포함", () => {
      const docSet = keepAliveDocumentedSet(config());
      const value = configValue(config(), "OLLAMA_KEEP_ALIVE");
      expect(docSet).toEqual(EXPECTED_KEEP_ALIVE_SET.slice().sort());
      expect(value).toBe(EXPECTED_KEEP_ALIVE);
      expect(docSet).toContain(value);
    });
  });

  describe("cross-artifact 기본 모델 tag parity: config.env OLLAMA_MODEL ↔ seed SEED_LLM_MODEL_ID 기본값", () => {
    it("config.env OLLAMA_MODEL 값과 seed-llm-config.sh SEED_LLM_MODEL_ID 기본값이 byte-동일(gemma4:12b)", () => {
      const model = configValue(config(), "OLLAMA_MODEL");
      const seedModel = seedModelDefault(seed());
      expect(model).toBe(EXPECTED_MODEL_TAG);
      expect(seedModel).toBe(EXPECTED_MODEL_TAG);
      expect(model).toBe(seedModel);
    });
  });

  describe("cross-artifact endpoint 규약 parity: config.env OPENAI_BASE_URL 포트+/v1 ↔ seed 예시 endpoint 포트+/v1", () => {
    it("config.env OPENAI_BASE_URL 의 포트(11434)+suffix(/v1) 와 seed 주석 예시 endpoint(http://192.168.0.5:11434/v1) 의 포트(11434)+suffix(/v1) 가 동일 규약(host 대조 제외)", () => {
      const baseUrl = configValue(config(), "OPENAI_BASE_URL");
      const seedEndpoint = seedExampleEndpoint(seed());
      expect(seedEndpoint).toBe("http://192.168.0.5:11434/v1");
      expect(extractPort(baseUrl)).toBe(EXPECTED_ENDPOINT_PORT);
      expect(extractPort(seedEndpoint)).toBe(EXPECTED_ENDPOINT_PORT);
      expect(extractPort(baseUrl)).toBe(extractPort(seedEndpoint));
      expect(hasV1Suffix(baseUrl)).toBe(true);
      expect(hasV1Suffix(seedEndpoint)).toBe(true);
    });
  });

  describe("branch: 각 정본 앵커 일치/drift 정적 대조(합성 mutant 사본 — 원본 미변조)", () => {
    it("내부 포트 parity 일치/drift 분기", () => {
      const c = config();
      expect(extractLocalLlmAnchors(c, seed()).internalPortParity).toBe(true);
      const mutant = c.replace(
        "OLLAMA_HOST=127.0.0.1:11434",
        "OLLAMA_HOST=127.0.0.1:8080",
      );
      expect(extractLocalLlmAnchors(mutant, seed()).internalPortParity).toBe(
        false,
      );
    });

    it("/v1 suffix 규약 일치/drift 분기", () => {
      const c = config();
      expect(extractLocalLlmAnchors(c, seed()).openaiCompatSuffix).toBe(true);
      const mutant = c.replace(
        "OPENAI_BASE_URL=http://127.0.0.1:11434/v1",
        "OPENAI_BASE_URL=http://127.0.0.1:11434",
      );
      expect(extractLocalLlmAnchors(mutant, seed()).openaiCompatSuffix).toBe(
        false,
      );
    });

    it("모델 tag cross-parity 일치/drift 분기", () => {
      const c = config();
      expect(extractLocalLlmAnchors(c, seed()).modelTagCrossParity).toBe(true);
      const mutant = c.replace(
        "OLLAMA_MODEL=gemma4:12b",
        "OLLAMA_MODEL=llama3:8b",
      );
      expect(extractLocalLlmAnchors(mutant, seed()).modelTagCrossParity).toBe(
        false,
      );
    });

    it("keep-alive 문서화 규율 일치/drift 분기", () => {
      const c = config();
      expect(extractLocalLlmAnchors(c, seed()).keepAliveDocumented).toBe(true);
      const mutant = c.replace("OLLAMA_KEEP_ALIVE=5m", "OLLAMA_KEEP_ALIVE=99x");
      expect(extractLocalLlmAnchors(mutant, seed()).keepAliveDocumented).toBe(
        false,
      );
    });
  });

  describe("Error path / negative cases 충분 cover (mutant 합성 사본 — 원본 미변조, 예외 분기마다 각 1+)", () => {
    it("error path — 대조 artifact 부재 경로 → readFileSync throw(silent 0-byte fallback 0)", () => {
      const badPath = path.join(
        REPO_ROOT,
        "deploy",
        "local-llm-example",
        "__does_not_exist__.config.env",
      );
      expect(existsSync(badPath)).toBe(false);
      expect(() => readFileSync(badPath, "utf8")).toThrow();
    });

    it("error path — 앵커 토큰 부재 시 명시적 false(빈 매칭을 pass 로 오통과 0)", () => {
      const anchors = extractLocalLlmAnchors("", "");
      expect(anchors.requiredKeysPresent).toBe(false);
      expect(anchors.internalPortParity).toBe(false);
      expect(anchors.openaiCompatSuffix).toBe(false);
      expect(anchors.keepAliveDocumented).toBe(false);
      expect(anchors.modelTagCrossParity).toBe(false);
      expect(anchors.endpointConventionCrossParity).toBe(false);
      // 실 소스는 반대로 전부 true — 부재/실재 변별.
      const real = extractLocalLlmAnchors(config(), seed());
      expect(Object.values(real).every((v) => v === true)).toBe(true);
    });

    it("negative (a) — OLLAMA_HOST 포트 11434→8080 mutant → 내부 host↔base 포트 parity drift 검출", () => {
      const c = config();
      const mutant = c.replace(
        "OLLAMA_HOST=127.0.0.1:11434",
        "OLLAMA_HOST=127.0.0.1:8080",
      );
      expect(extractPort(configValue(mutant, "OLLAMA_HOST"))).toBe("8080");
      expect(extractLocalLlmAnchors(mutant, seed()).internalPortParity).toBe(
        false,
      );
      // 원본 불변.
      expect(configValue(c, "OLLAMA_HOST")).toBe("127.0.0.1:11434");
    });

    it("negative (b) — OPENAI_BASE_URL trailing /v1 제거 mutant → OpenAI-호환 suffix 규약 drift 검출", () => {
      const c = config();
      const mutant = c.replace(
        "OPENAI_BASE_URL=http://127.0.0.1:11434/v1",
        "OPENAI_BASE_URL=http://127.0.0.1:11434",
      );
      expect(hasV1Suffix(configValue(mutant, "OPENAI_BASE_URL"))).toBe(false);
      expect(extractLocalLlmAnchors(mutant, seed()).openaiCompatSuffix).toBe(
        false,
      );
      // /v1 유실 시 cross endpoint 규약도 함께 drift.
      expect(
        extractLocalLlmAnchors(mutant, seed()).endpointConventionCrossParity,
      ).toBe(false);
      // 원본 불변.
      expect(hasV1Suffix(configValue(c, "OPENAI_BASE_URL"))).toBe(true);
    });

    it("negative (c) — config.env OLLAMA_MODEL gemma4:12b→llama3:8b mutant → seed 기본 모델과 cross-artifact drift(config 측) 검출", () => {
      const c = config();
      const mutant = c.replace(
        "OLLAMA_MODEL=gemma4:12b",
        "OLLAMA_MODEL=llama3:8b",
      );
      expect(configValue(mutant, "OLLAMA_MODEL")).toBe("llama3:8b");
      expect(seedModelDefault(seed())).toBe(EXPECTED_MODEL_TAG);
      expect(extractLocalLlmAnchors(mutant, seed()).modelTagCrossParity).toBe(
        false,
      );
      // 원본 불변.
      expect(configValue(c, "OLLAMA_MODEL")).toBe(EXPECTED_MODEL_TAG);
    });

    it("negative (d) — seed SEED_LLM_MODEL_ID 기본값 gemma4:12b→qwen2:7b mutant → config.env 와 cross-artifact drift(seed 측) 검출", () => {
      const s = seed();
      const mutant = s.replace(
        "SEED_LLM_MODEL_ID:-gemma4:12b",
        "SEED_LLM_MODEL_ID:-qwen2:7b",
      );
      expect(seedModelDefault(mutant)).toBe("qwen2:7b");
      expect(configValue(config(), "OLLAMA_MODEL")).toBe(EXPECTED_MODEL_TAG);
      expect(extractLocalLlmAnchors(config(), mutant).modelTagCrossParity).toBe(
        false,
      );
      // 원본 불변.
      expect(seedModelDefault(s)).toBe(EXPECTED_MODEL_TAG);
    });

    it("negative (e) — config.env 필수 키 OLLAMA_MODEL 행 제거 mutant → 필수 active 키 presence drift 검출", () => {
      const c = config();
      const mutant = c.replace(/^OLLAMA_MODEL=.*$/m, "");
      expect(configActiveKeys(mutant)).not.toContain("OLLAMA_MODEL");
      expect(extractLocalLlmAnchors(mutant, seed()).requiredKeysPresent).toBe(
        false,
      );
      // 원본 불변.
      expect(configActiveKeys(c)).toContain("OLLAMA_MODEL");
    });

    it("negative (f) — OPENAI_BASE_URL 포트 11434→11500 mutant → seed 예시 endpoint 포트 규약과 cross-artifact drift 검출", () => {
      const c = config();
      const mutant = c.replace(
        "OPENAI_BASE_URL=http://127.0.0.1:11434/v1",
        "OPENAI_BASE_URL=http://127.0.0.1:11500/v1",
      );
      expect(extractPort(configValue(mutant, "OPENAI_BASE_URL"))).toBe("11500");
      expect(extractPort(seedExampleEndpoint(seed()))).toBe(
        EXPECTED_ENDPOINT_PORT,
      );
      expect(
        extractLocalLlmAnchors(mutant, seed()).endpointConventionCrossParity,
      ).toBe(false);
      // 원본 불변.
      expect(extractPort(configValue(c, "OPENAI_BASE_URL"))).toBe(
        EXPECTED_ENDPOINT_PORT,
      );
    });

    it("negative (g) — OLLAMA_KEEP_ALIVE 값 5m→99x(문서화 집합 밖) mutant → 문서화 허용 값 규율 drift 검출", () => {
      const c = config();
      const mutant = c.replace("OLLAMA_KEEP_ALIVE=5m", "OLLAMA_KEEP_ALIVE=99x");
      expect(configValue(mutant, "OLLAMA_KEEP_ALIVE")).toBe("99x");
      expect(keepAliveDocumentedSet(mutant)).not.toContain("99x");
      expect(extractLocalLlmAnchors(mutant, seed()).keepAliveDocumented).toBe(
        false,
      );
      // 원본 불변.
      expect(configValue(c, "OLLAMA_KEEP_ALIVE")).toBe(EXPECTED_KEEP_ALIVE);
    });

    it("negative — §9 credential/secret 누출 0: 추출/합성 토큰에 gh 토큰 어휘·실 credential·실 password·apiKey 값 미등장(§9/REQ-059)", () => {
      const anchors = extractLocalLlmAnchors(config(), seed());
      // 추출 토큰 — 필수 키 이름·포트·모델 tag·keep-alive·CIDR·예시 endpoint(비시크릿 예시 host) 만.
      const synthesized = [
        JSON.stringify(anchors),
        JSON.stringify(configActiveKeys(config())),
        String(configValue(config(), "OLLAMA_MODEL")),
        String(configValue(config(), "OLLAMA_HOST")),
        String(configValue(config(), "OLLAMA_KEEP_ALIVE")),
        String(configValue(config(), "OPENAI_BASE_URL")),
        String(configValue(config(), "LAN_ALLOW_CIDR")),
        String(seedModelDefault(seed())),
        String(seedExampleEndpoint(seed())),
        JSON.stringify(keepAliveDocumentedSet(config())),
      ];
      const strongPattern =
        /(ghp_|--token|GITHUB_TOKEN|GH_TOKEN|\bBearer\b|Authorization|\bsk-|PASSWORD=|apiKey"?\s*[:=]\s*["']?\w)/i;
      synthesized.forEach((s) => {
        expect(strongPattern.test(s)).toBe(false);
      });
      // 합성 mutant 값도 명백한 dummy(8080·11500·llama3:8b·qwen2:7b·99x)로 한정 — 실 자격 0.
      const dummies = ["8080", "11500", "llama3:8b", "qwen2:7b", "99x"];
      dummies.forEach((d) => expect(strongPattern.test(d)).toBe(false));
      // 추출 값은 모두 비시크릿 설정 값/예시(bind 주소·CIDR·모델 tag·keep-alive·/v1·예시 host).
      expect(configValue(config(), "OLLAMA_HOST")).toBe("127.0.0.1:11434");
      expect(configValue(config(), "LAN_ALLOW_CIDR")).toBe("192.168.0.0/24");
      expect(seedExampleEndpoint(seed())).toBe("http://192.168.0.5:11434/v1");
    });
  });

  describe("flow: 결정론 · no-mutation(원본 read-only 입증)", () => {
    it("동일 입력으로 pure 함수를 두 번 호출하면 deep-equal(결정론)", () => {
      const c = config();
      const s = seed();
      expect(extractLocalLlmAnchors(c, s)).toEqual(
        extractLocalLlmAnchors(c, s),
      );
      expect(configActiveKeys(c)).toEqual(configActiveKeys(c));
      expect(keepAliveDocumentedSet(c)).toEqual(keepAliveDocumentedSet(c));
    });

    it("합성 mutate(사본 replace) 후에도 원본 소스 텍스트·pure 함수 산출이 불변(원본 read-only)", () => {
      const c = config();
      const s = seed();
      const cSnap = c;
      const sSnap = s;
      // 사본 mutate(negative a~g 에서 쓰는 replace) — 원본 불변 확인.
      c.replace("OLLAMA_HOST=127.0.0.1:11434", "OLLAMA_HOST=127.0.0.1:8080");
      c.replace(
        "OPENAI_BASE_URL=http://127.0.0.1:11434/v1",
        "OPENAI_BASE_URL=http://127.0.0.1:11434",
      );
      c.replace("OLLAMA_MODEL=gemma4:12b", "OLLAMA_MODEL=llama3:8b");
      c.replace(/^OLLAMA_MODEL=.*$/m, "");
      c.replace("OLLAMA_KEEP_ALIVE=5m", "OLLAMA_KEEP_ALIVE=99x");
      s.replace("SEED_LLM_MODEL_ID:-gemma4:12b", "SEED_LLM_MODEL_ID:-qwen2:7b");
      expect(c).toBe(cSnap);
      expect(s).toBe(sSnap);
      // 추출/파싱 후에도 원본 불변.
      extractLocalLlmAnchors(c, s);
      expect(c).toBe(cSnap);
      expect(s).toBe(sSnap);
    });
  });

  describe("dormant / non-gated 확인 — side-effect 0", () => {
    it("parity 모델이 env / 전역 상태 없이 순수하게 동작(non-gated — describe.skip 0·gating 분기 0)", () => {
      // 본 describe 가 실행된다는 것 자체가 describe.skip 0(항상 실행)의 런타임 증거.
      const envSnapshot = { ...process.env };
      const c = config();
      const before = configValue(c, "OLLAMA_MODEL");
      // 실 process.env 를 mutate 해도 산출 불변 — 모델이 process.env 를 참조하지 않음(파라미터로만).
      Object.assign(process.env, { LOCAL_LLM_PARITY_UNIT_TEST: "x" });
      const after = configValue(c, "OLLAMA_MODEL");
      delete process.env.LOCAL_LLM_PARITY_UNIT_TEST;
      expect(after).toBe(before);
      expect(Object.keys(process.env)).toEqual(Object.keys(envSnapshot));
    });

    it("파일 read 는 config.env/seed-llm-config.sh 읽기만 — 실 Ollama/실 추론/실 seed 0. config.env/seed 는 조건 분기 없는 선언적 설정·스크립트 기본값 — 런타임 분기 없음(선언적)이라 happy/negative mutant 로 대체 cover", () => {
      const anchors = extractLocalLlmAnchors(config(), seed());
      expect(Object.values(anchors).every((v) => v === true)).toBe(true);
    });
  });
});
