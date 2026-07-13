// realdata-e2e-local-llm-example-readme-runbook-config-doc-value-single-source-parity-script-table-file-existence-gitignore-crossref-contract.smoke-spec.ts
// — 무인 nightly 재배포 runner chain 이 봉해온 LLM 호스트측 설정 정본 config.env(T-0966)·공용 헬퍼 _common.ps1(T-0967)
// 의 **문서 counterpart** `deploy/local-llm-example/README.md`(운영자가 실제로 읽고 따라 하는 사용법 runbook) 의
// documentation single-source 계약을 세 실 파일(README.md·config.env·.gitignore)을 readFileSync 로 읽고 스크립트
// 표 7종 + cross-ref 2종은 existsSync 로 실 파일 존재만 확인해(실 PowerShell 실행/실 Ollama 기동/실 추론/실 markdown
// 렌더 0) 정적 검증하는 non-gated live-LLM 운영 premise leg smoke (T-0968, PLAN.md §108/§109 — LLM 호스트측 문서 leg).
//
// 봉함 불변식(README 문서-값 ↔ config.env active 키/실 스크립트 파일 cross-artifact parity — 서버측 재배포 runbook
// deploy/README.md(T-0965) 의 LLM 호스트측 counterpart. 이 문서-정본이 drift 하면 문서를 믿은 운영자가 config.env
// 정본과 다른 모델/포트/endpoint 로 로컬 LLM 을 오구성 → 무인 재배포 후 live-LLM 평가가 조용히 오구성 진행):
//   (1) README §설정 바꾸기(ini 블록)가 문서-값으로 명기하는 config 값 4종(OLLAMA_MODEL·OLLAMA_HOST·
//       OLLAMA_KEEP_ALIVE·OPENAI_BASE_URL) 이 config.env 동명 active 키 값과 byte-parity. drift 시 문서-오구성.
//   (2) README §LAN 노출의 LAN_ALLOW_CIDR(192.168.0.0/24) ↔ config.env active 키 byte-parity.
//   (3) README §AA에 연결하기 표의 endpointUrl ↔ config.env OPENAI_BASE_URL, modelId ↔ config.env OLLAMA_MODEL
//       byte-parity(운영자가 AA 에 등록하는 값이 호스트 서빙 정본과 일치).
//   (4) 포트 11434 가 README 문서-값(OLLAMA_HOST·OPENAI_BASE_URL·SEED_LLM_ENDPOINT_URL 예시) 전반 + config.env 에서
//       일관. drift 시 클라이언트가 죽은 포트로 연결.
//   (5) README §스크립트 설명 표가 열거하는 7종(install/start-llm/stop-llm/status/test-llm.ps1·config.env·_common.ps1)
//       이 deploy/local-llm-example/ 에 실 파일로 존재(existsSync). dead 안내 검출.
//   (6) README §설정 바꾸기(config.local.env gitignore됨) 안내 파일명이 .gitignore 커밋-금지 항목과 parity.
//   (7) README §다른 기기 cross-ref(deploy/README.md·deploy/seed-llm-config.sh) 실 파일 존재(existsSync — dead-link 여부만).
//
// 전략(형제 T-0965 README runbook·T-0966 config.env 내부+seed cross-parity 동형): README/config.env/.gitignore 에서
// 정본 토큰을 정적 추출하는 해석 동형 TS 순수 함수(readmeIniValue·configValue·readmeTableFieldValue·readmeLanCidr·
// extractPort·hasV1Suffix·scriptTableEntries·crossRefPaths·gitignoreBans·seedEndpointExamplePort·
// extractReadmeParityAnchors)로 문서-값 cross-artifact 불변식을 assert. 합성 mutant 사본으로 negative(a~h 8종) 변별.
//   🔥 실 Ollama pull/serve/추론 0 · 실 PowerShell/실 markdown 렌더 0 · 실 seed/실 LAN 노출/실 방화벽 0 ·
//      process.env 읽기 0(입력은 pure 함수 파라미터) · credential 0(§9/REQ-059) · 새 dep 0(node fs/path 만, markdown
//      파서 추가 0) · src 변경 0(test-only) · README.md/config.env/.gitignore/스크립트 읽기만(실행 0 · 변경 0).
import { existsSync, readFileSync } from "fs";
import * as path from "path";

// repo-root 경로 — test 실행 cwd 무관하게 robust 하게 해석(`__dirname` = test/smoke,
// 두 단계 위가 repo-root). `process.cwd()` 대신 `__dirname` 기준 상대로 고정한다(sibling T-0965/T-0966).
const REPO_ROOT = path.resolve(__dirname, "../..");
const LLM_DIR = path.join(REPO_ROOT, "deploy", "local-llm-example");
const README_PATH = path.join(LLM_DIR, "README.md");
const CONFIG_ENV_PATH = path.join(LLM_DIR, "config.env");
const GITIGNORE_PATH = path.join(LLM_DIR, ".gitignore");

// 정본 앵커(실 artifact 표현의 TS mirror — 실 Ollama/실 seed 0).
const EXPECTED_MODEL_TAG = "gemma4:12b"; // README 문서-값 ↔ config.env OLLAMA_MODEL.
const EXPECTED_HOST = "127.0.0.1:11434"; // README 문서-값 ↔ config.env OLLAMA_HOST.
const EXPECTED_KEEP_ALIVE = "5m"; // README 문서-값 ↔ config.env OLLAMA_KEEP_ALIVE.
const EXPECTED_BASE_URL = "http://127.0.0.1:11434/v1"; // README 문서-값 ↔ config.env OPENAI_BASE_URL.
const EXPECTED_CIDR = "192.168.0.0/24"; // README §LAN ↔ config.env LAN_ALLOW_CIDR.
const EXPECTED_PORT = "11434"; // README 전반 + config.env 공통 포트.
const DOC_CONFIG_KEYS = [
  "OLLAMA_MODEL",
  "OLLAMA_HOST",
  "OLLAMA_KEEP_ALIVE",
  "OPENAI_BASE_URL",
]; // README §설정 바꾸기 ini 블록이 문서-값으로 재기술하는 config 키 4종.
const SCRIPT_TABLE_FILES = [
  "install.ps1",
  "start-llm.ps1",
  "stop-llm.ps1",
  "status.ps1",
  "test-llm.ps1",
  "config.env",
  "_common.ps1",
]; // README §스크립트 설명 표가 열거하는 7종.
const CROSS_REF_PATHS = ["deploy/README.md", "deploy/seed-llm-config.sh"]; // README §다른 기기 cross-ref 2종.

// ── TS 동형 pure 함수(정본) — README / config.env / .gitignore 의 정본 토큰을 모델링.
//    입력(문자열)은 mutate 하지 않는다(읽기만). 실 markdown 파서 라이브러리 0 — 정규식/행 슬라이스만.

// 소스를 CRLF-정규화 후 라인 배열로 — 모든 파서의 공통 입력.
function toLines(source: string): string[] {
  return source.replace(/\r\n/g, "\n").split("\n");
}

// configValue(config, key): config.env 의 주석 아닌 첫 `KEY=VALUE` 행의 VALUE(trim) — 부재면 undefined.
function configValue(config: string, key: string): string | undefined {
  for (const line of toLines(config)) {
    if (/^\s*#/.test(line)) continue;
    const m = line.match(new RegExp(`^\\s*${key}=(.*)$`));
    if (m) return m[1].trim();
  }
  return undefined;
}

// readmeIniValue(readme, key): README §설정 바꾸기 ini 블록의 `KEY=VALUE  # 주석` 행에서 VALUE(inline `#` 주석
//   제거 후 trim) — 부재면 undefined. `http://` 의 `//` 는 공백-# 이 아니라 보존되고, 뒤의 ` # 주석` 만 잘린다.
function readmeIniValue(readme: string, key: string): string | undefined {
  for (const line of toLines(readme)) {
    const m = line.match(new RegExp(`^${key}=(.*)$`));
    if (m) return m[1].replace(/\s+#.*$/, "").trim();
  }
  return undefined;
}

// readmeTableFieldValue(readme, field): README §AA에 연결하기 markdown 표 `| \`field\` | \`VALUE\` ... |` 행의
//   VALUE 컬럼 첫 backtick 토큰 — 부재면 undefined. modelId 행의 trailing `(받은 모델 tag)` 은 무시(첫 backtick 만).
function readmeTableFieldValue(
  readme: string,
  field: string,
): string | undefined {
  const m = readme.match(
    new RegExp("\\|\\s*`" + field + "`\\s*\\|\\s*`([^`]+)`"),
  );
  return m ? m[1].trim() : undefined;
}

// readmeLanCidr(readme): README §LAN 노출이 문서-값으로 명기하는 첫 backtick CIDR(`X.X.X.X/Y`) — 부재면 undefined.
//   line 153 의 단일 IP(192.168.0.7, `/` 없음)는 CIDR 아니라 매칭 제외.
function readmeLanCidr(readme: string): string | undefined {
  const m = readme.match(/`(\d{1,3}(?:\.\d{1,3}){3}\/\d{1,2})`/);
  return m ? m[1] : undefined;
}

// extractPort(hostOrUrl): `host:PORT` 또는 `scheme://host:PORT/path` 의 포트 — 부재면 undefined.
//   스킴 콜론(`http:`) 은 뒤가 `//` 이라 매칭 안 됨 — 첫 `:<digits>` 만 포트로 인식.
function extractPort(hostOrUrl: string | undefined): string | undefined {
  if (hostOrUrl === undefined) return undefined;
  const m = hostOrUrl.match(/:(\d{2,5})(?:\/|$)/);
  return m ? m[1] : undefined;
}

// hasV1Suffix(url): OpenAI-호환 규약 — trailing `/v1` 로 끝나는가(양끝 공백 무시).
function hasV1Suffix(url: string | undefined): boolean {
  return url !== undefined && /\/v1$/.test(url.trim());
}

// scriptTableEntries(readme): README §스크립트 설명 표 섹션에서 각 데이터 행 첫 컬럼 backtick 파일명 목록.
//   "## 스크립트 설명" 부터 다음 "###"/"---" 전까지 슬라이스 후 `| \`name\` |` 행에서 name 추출.
function scriptTableEntries(readme: string): string[] {
  const lines = toLines(readme);
  const start = lines.findIndex((l) => /^##\s+스크립트 설명/.test(l));
  if (start < 0) return [];
  const names: string[] = [];
  for (let i = start + 1; i < lines.length; i++) {
    if (/^(###|---|##\s)/.test(lines[i])) break;
    const m = lines[i].match(/^\|\s*`([^`]+)`\s*\|/);
    if (m) names.push(m[1]);
  }
  return names;
}

// crossRefPaths(readme): README 가 참조하는 backtick 감싼 deploy 경로(`deploy/....md|sh`) 목록(중복 제거).
function crossRefPaths(readme: string): string[] {
  const set = new Set<string>();
  const re = /`(deploy\/[^`]+\.(?:md|sh))`/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(readme)) !== null) set.add(m[1]);
  return [...set];
}

// gitignoreBans(gitignore, name): .gitignore 가 주석 아닌 행으로 name 을 커밋-금지 등재하는가.
function gitignoreBans(gitignore: string, name: string): boolean {
  return toLines(gitignore).some((line) => {
    if (/^\s*#/.test(line) || /^\s*$/.test(line)) return false;
    return line.trim() === name;
  });
}

// seedEndpointExamplePort(readme): README §다른 기기 `SEED_LLM_ENDPOINT_URL=<url>` 예시의 포트 — 부재면 undefined.
function seedEndpointExamplePort(readme: string): string | undefined {
  const m = readme.match(/SEED_LLM_ENDPOINT_URL=(\S+)/);
  return m ? extractPort(m[1]) : undefined;
}

// (집계) extractReadmeParityAnchors(readme, config, gitignore): 문자열-기반 문서-값 cross-artifact 불변식을
//   한 번에 집계 — 하나라도 부재/변질이면 명시적 false(빈 결과 성공-위장 0). 파일 존재(스크립트 표·cross-ref)는
//   fs 의존이라 별도 test 에서 existsSync 로 대조(본 집계는 순수 문자열만).
function extractReadmeParityAnchors(
  readme: string,
  config: string,
  gitignore: string,
): {
  docConfigParity: boolean;
  lanCidrParity: boolean;
  aaEndpointParity: boolean;
  aaModelIdParity: boolean;
  portConsistency: boolean;
  gitignoreParity: boolean;
  seedEndpointPortParity: boolean;
} {
  const docParity = DOC_CONFIG_KEYS.every((k) => {
    const r = readmeIniValue(readme, k);
    const c = configValue(config, k);
    return r !== undefined && c !== undefined && r === c;
  });
  const readmeCidr = readmeLanCidr(readme);
  const configCidr = configValue(config, "LAN_ALLOW_CIDR");
  const endpointUrl = readmeTableFieldValue(readme, "endpointUrl");
  const modelId = readmeTableFieldValue(readme, "modelId");
  const configBaseUrl = configValue(config, "OPENAI_BASE_URL");
  const configModel = configValue(config, "OLLAMA_MODEL");
  const readmeHostPort = extractPort(readmeIniValue(readme, "OLLAMA_HOST"));
  const readmeBasePort = extractPort(readmeIniValue(readme, "OPENAI_BASE_URL"));
  const configPort = extractPort(configValue(config, "OLLAMA_HOST"));
  const seedPort = seedEndpointExamplePort(readme);
  return {
    docConfigParity: docParity,
    lanCidrParity:
      readmeCidr !== undefined &&
      configCidr !== undefined &&
      readmeCidr === configCidr,
    aaEndpointParity:
      endpointUrl !== undefined &&
      configBaseUrl !== undefined &&
      endpointUrl === configBaseUrl &&
      hasV1Suffix(endpointUrl),
    aaModelIdParity:
      modelId !== undefined &&
      configModel !== undefined &&
      modelId === configModel,
    portConsistency:
      readmeHostPort !== undefined &&
      readmeBasePort !== undefined &&
      configPort !== undefined &&
      readmeHostPort === EXPECTED_PORT &&
      readmeBasePort === EXPECTED_PORT &&
      configPort === EXPECTED_PORT,
    gitignoreParity:
      readme.includes("config.local.env") &&
      gitignoreBans(gitignore, "config.local.env"),
    seedEndpointPortParity:
      seedPort !== undefined && seedPort === EXPECTED_PORT,
  };
}

describe("realdata-e2e §108/§109 deploy/local-llm-example/README.md 사용법 runbook cross-artifact 정본 계약 smoke — 문서-값 config 4종↔config.env byte-parity + LAN_ALLOW_CIDR/포트 11434 parity + AA 연결 endpointUrl/modelId↔config.env + 스크립트 표 7종 실 파일 존재 + config.local.env↔.gitignore 커밋금지 parity + SEED_LLM_ENDPOINT_URL 포트 규약 + deploy/README·seed-llm-config.sh cross-ref 실존 + secret-safety (T-0968)", () => {
  const readme = () => readFileSync(README_PATH, "utf8");
  const config = () => readFileSync(CONFIG_ENV_PATH, "utf8");
  const gitignore = () => readFileSync(GITIGNORE_PATH, "utf8");

  describe("Happy-path: 대조 artifact 3종 실존 + 7 문자열 불변식 전부 true", () => {
    it("README.md·config.env·.gitignore 가 repo-root 기준 실존(existsSync)", () => {
      expect(existsSync(README_PATH)).toBe(true);
      expect(existsSync(CONFIG_ENV_PATH)).toBe(true);
      expect(existsSync(GITIGNORE_PATH)).toBe(true);
    });

    it("7 문자열 불변식(문서-값 4종 parity·LAN CIDR·AA endpoint·AA modelId·포트 일관·gitignore parity·seed 포트) 전부 true", () => {
      const anchors = extractReadmeParityAnchors(
        readme(),
        config(),
        gitignore(),
      );
      expect(anchors.docConfigParity).toBe(true);
      expect(anchors.lanCidrParity).toBe(true);
      expect(anchors.aaEndpointParity).toBe(true);
      expect(anchors.aaModelIdParity).toBe(true);
      expect(anchors.portConsistency).toBe(true);
      expect(anchors.gitignoreParity).toBe(true);
      expect(anchors.seedEndpointPortParity).toBe(true);
    });
  });

  describe("Happy-path(1순위 계약): README §설정 바꾸기 문서-값 config 4종 ↔ config.env active 키 byte-parity", () => {
    it("OLLAMA_MODEL·OLLAMA_HOST·OLLAMA_KEEP_ALIVE·OPENAI_BASE_URL 이 README 문서-값과 config.env 에서 각각 byte-동일", () => {
      const r = readme();
      const c = config();
      for (const k of DOC_CONFIG_KEYS) {
        const rv = readmeIniValue(r, k);
        const cv = configValue(c, k);
        expect(rv).toBeDefined();
        expect(cv).toBeDefined();
        expect(rv).toBe(cv);
      }
      // 실 값 스냅샷(정본 동기 확인).
      expect(readmeIniValue(r, "OLLAMA_MODEL")).toBe(EXPECTED_MODEL_TAG);
      expect(readmeIniValue(r, "OLLAMA_HOST")).toBe(EXPECTED_HOST);
      expect(readmeIniValue(r, "OLLAMA_KEEP_ALIVE")).toBe(EXPECTED_KEEP_ALIVE);
      expect(readmeIniValue(r, "OPENAI_BASE_URL")).toBe(EXPECTED_BASE_URL);
    });
  });

  describe("Happy-path(부수 문서-값 parity): LAN_ALLOW_CIDR · AA endpointUrl/modelId · 포트 11434", () => {
    it("README §LAN 노출 CIDR(192.168.0.0/24) ↔ config.env LAN_ALLOW_CIDR byte-parity", () => {
      expect(readmeLanCidr(readme())).toBe(EXPECTED_CIDR);
      expect(configValue(config(), "LAN_ALLOW_CIDR")).toBe(EXPECTED_CIDR);
      expect(readmeLanCidr(readme())).toBe(
        configValue(config(), "LAN_ALLOW_CIDR"),
      );
    });

    it("README §AA에 연결하기 endpointUrl ↔ config.env OPENAI_BASE_URL, modelId ↔ config.env OLLAMA_MODEL byte-parity", () => {
      const r = readme();
      const c = config();
      expect(readmeTableFieldValue(r, "endpointUrl")).toBe(EXPECTED_BASE_URL);
      expect(readmeTableFieldValue(r, "endpointUrl")).toBe(
        configValue(c, "OPENAI_BASE_URL"),
      );
      expect(readmeTableFieldValue(r, "modelId")).toBe(EXPECTED_MODEL_TAG);
      expect(readmeTableFieldValue(r, "modelId")).toBe(
        configValue(c, "OLLAMA_MODEL"),
      );
    });

    it("포트 11434 가 README 문서-값(OLLAMA_HOST·OPENAI_BASE_URL·SEED_LLM_ENDPOINT_URL 예시) 전반 + config.env 에서 일관", () => {
      const r = readme();
      const c = config();
      expect(extractPort(readmeIniValue(r, "OLLAMA_HOST"))).toBe(EXPECTED_PORT);
      expect(extractPort(readmeIniValue(r, "OPENAI_BASE_URL"))).toBe(
        EXPECTED_PORT,
      );
      expect(seedEndpointExamplePort(r)).toBe(EXPECTED_PORT);
      expect(extractPort(configValue(c, "OLLAMA_HOST"))).toBe(EXPECTED_PORT);
      expect(extractPort(configValue(c, "OPENAI_BASE_URL"))).toBe(
        EXPECTED_PORT,
      );
    });
  });

  describe("Happy-path(스크립트 표 실 파일 존재 계약): README §스크립트 설명 표 7종이 deploy/local-llm-example/ 에 실존", () => {
    it("표에서 추출한 7종(install/start-llm/stop-llm/status/test-llm.ps1·config.env·_common.ps1)이 표 텍스트에 열거되고 각각 existsSync true", () => {
      const entries = scriptTableEntries(readme());
      expect(entries).toEqual(expect.arrayContaining(SCRIPT_TABLE_FILES));
      expect(entries.length).toBe(SCRIPT_TABLE_FILES.length);
      for (const name of entries) {
        expect(existsSync(path.join(LLM_DIR, name))).toBe(true);
      }
    });
  });

  describe("cross-artifact config.local.env↔.gitignore parity 계약", () => {
    it("README §설정 바꾸기가 안내하는 config.local.env 가 .gitignore 커밋-금지 항목으로 등재됨", () => {
      const r = readme();
      const g = gitignore();
      expect(r.includes("config.local.env")).toBe(true);
      expect(gitignoreBans(g, "config.local.env")).toBe(true);
    });
  });

  describe("cross-ref 실존 계약: README §다른 기기 참조 deploy/README.md·deploy/seed-llm-config.sh", () => {
    it("README 가 참조하는 cross-ref 2종이 backtick 경로로 열거되고 각각 repo-root 기준 existsSync true", () => {
      const refs = crossRefPaths(readme());
      expect(refs).toEqual(expect.arrayContaining(CROSS_REF_PATHS));
      for (const rel of CROSS_REF_PATHS) {
        expect(existsSync(path.join(REPO_ROOT, rel))).toBe(true);
      }
    });
  });

  describe("Error path / negative cases 충분 cover (mutant 합성 사본 — 원본 미변조, 예외 분기마다 각 1+)", () => {
    it("error path — 대조 artifact 부재 경로 → readFileSync throw(silent 0-byte fallback 0)", () => {
      const badPath = path.join(LLM_DIR, "__does_not_exist__.README.md");
      expect(existsSync(badPath)).toBe(false);
      expect(() => readFileSync(badPath, "utf8")).toThrow();
    });

    it("error path — 앵커 토큰 부재 시 명시적 false(빈 매칭을 pass 로 오통과 0)", () => {
      const anchors = extractReadmeParityAnchors("", "", "");
      expect(anchors.docConfigParity).toBe(false);
      expect(anchors.lanCidrParity).toBe(false);
      expect(anchors.aaEndpointParity).toBe(false);
      expect(anchors.aaModelIdParity).toBe(false);
      expect(anchors.portConsistency).toBe(false);
      expect(anchors.gitignoreParity).toBe(false);
      expect(anchors.seedEndpointPortParity).toBe(false);
      // 실 소스는 반대로 전부 true — 부재/실재 변별.
      const real = extractReadmeParityAnchors(readme(), config(), gitignore());
      expect(Object.values(real).every((v) => v === true)).toBe(true);
    });

    it("negative (a) — README 문서-값 OLLAMA_MODEL gemma4:12b→llama3:8b mutant → 문서↔config.env cross-parity drift 검출", () => {
      const r = readme();
      const mutant = r.replace(
        "OLLAMA_MODEL=gemma4:12b",
        "OLLAMA_MODEL=llama3:8b",
      );
      expect(readmeIniValue(mutant, "OLLAMA_MODEL")).toBe("llama3:8b");
      expect(
        extractReadmeParityAnchors(mutant, config(), gitignore())
          .docConfigParity,
      ).toBe(false);
      // 원본 불변.
      expect(readmeIniValue(r, "OLLAMA_MODEL")).toBe(EXPECTED_MODEL_TAG);
    });

    it("negative (b) — README OLLAMA_HOST 포트 11434→8080 mutant → 포트 cross-parity drift 검출", () => {
      const r = readme();
      const mutant = r.replace(
        "OLLAMA_HOST=127.0.0.1:11434",
        "OLLAMA_HOST=127.0.0.1:8080",
      );
      expect(extractPort(readmeIniValue(mutant, "OLLAMA_HOST"))).toBe("8080");
      expect(
        extractReadmeParityAnchors(mutant, config(), gitignore())
          .portConsistency,
      ).toBe(false);
      // 원본 불변.
      expect(extractPort(readmeIniValue(r, "OLLAMA_HOST"))).toBe(EXPECTED_PORT);
    });

    it("negative (c) — README endpointUrl 의 /v1 suffix 제거 mutant → AA 연결 endpoint 규약 drift 검출", () => {
      const r = readme();
      const mutant = r.replace(
        "`endpointUrl` | `http://127.0.0.1:11434/v1`",
        "`endpointUrl` | `http://127.0.0.1:11434`",
      );
      expect(hasV1Suffix(readmeTableFieldValue(mutant, "endpointUrl"))).toBe(
        false,
      );
      expect(
        extractReadmeParityAnchors(mutant, config(), gitignore())
          .aaEndpointParity,
      ).toBe(false);
      // 원본 불변.
      expect(hasV1Suffix(readmeTableFieldValue(r, "endpointUrl"))).toBe(true);
    });

    it("negative (d) — README modelId gemma4:12b→qwen3:8b mutant → modelId↔config.env drift 검출", () => {
      const r = readme();
      const mutant = r.replace(
        "`modelId` | `gemma4:12b`",
        "`modelId` | `qwen3:8b`",
      );
      expect(readmeTableFieldValue(mutant, "modelId")).toBe("qwen3:8b");
      expect(
        extractReadmeParityAnchors(mutant, config(), gitignore())
          .aaModelIdParity,
      ).toBe(false);
      // 원본 불변.
      expect(readmeTableFieldValue(r, "modelId")).toBe(EXPECTED_MODEL_TAG);
    });

    it("negative (e) — README LAN_ALLOW_CIDR 192.168.0.0/24→10.0.0.0/8 mutant → CIDR cross-parity drift 검출", () => {
      const r = readme();
      const mutant = r.replace("`192.168.0.0/24`", "`10.0.0.0/8`");
      expect(readmeLanCidr(mutant)).toBe("10.0.0.0/8");
      expect(
        extractReadmeParityAnchors(mutant, config(), gitignore()).lanCidrParity,
      ).toBe(false);
      // 원본 불변.
      expect(readmeLanCidr(r)).toBe(EXPECTED_CIDR);
    });

    it("negative (f) — README §스크립트 표 test-llm.ps1→run-llm.ps1(비실존) mutant → 스크립트 표 실 파일 존재 계약 drift(existsSync false) 검출", () => {
      const r = readme();
      const mutant = r.replace("| `test-llm.ps1` |", "| `run-llm.ps1` |");
      const entries = scriptTableEntries(mutant);
      expect(entries).toContain("run-llm.ps1");
      expect(entries).not.toContain("test-llm.ps1");
      // 표가 가리키는 파일이 실존하지 않음 → dead 안내.
      expect(existsSync(path.join(LLM_DIR, "run-llm.ps1"))).toBe(false);
      const allExist = entries.every((n) => existsSync(path.join(LLM_DIR, n)));
      expect(allExist).toBe(false);
      // 원본 불변(원본 표는 전부 실존).
      expect(
        scriptTableEntries(r).every((n) => existsSync(path.join(LLM_DIR, n))),
      ).toBe(true);
    });

    it("negative (g) — .gitignore 에서 config.local.env 행 제거 mutant → 문서 안내↔gitignore parity drift(gitignore 측) 검출", () => {
      const g = gitignore();
      const mutant = g.replace(/^config\.local\.env$/m, "");
      expect(gitignoreBans(mutant, "config.local.env")).toBe(false);
      expect(
        extractReadmeParityAnchors(readme(), config(), mutant).gitignoreParity,
      ).toBe(false);
      // 원본 불변.
      expect(gitignoreBans(g, "config.local.env")).toBe(true);
    });

    it("negative (h) — README cross-ref deploy/README.md→deploy/DEPLOY.md(비실존) mutant → cross-ref 실존 계약 drift(existsSync false) 검출", () => {
      const r = readme();
      const mutant = r.replace("`deploy/README.md`", "`deploy/DEPLOY.md`");
      const refs = crossRefPaths(mutant);
      expect(refs).toContain("deploy/DEPLOY.md");
      expect(refs).not.toContain("deploy/README.md");
      expect(existsSync(path.join(REPO_ROOT, "deploy/DEPLOY.md"))).toBe(false);
      const allExist = refs.every((rel) =>
        existsSync(path.join(REPO_ROOT, rel)),
      );
      expect(allExist).toBe(false);
      // 원본 불변(원본 cross-ref 는 전부 실존).
      expect(
        crossRefPaths(r).every((rel) => existsSync(path.join(REPO_ROOT, rel))),
      ).toBe(true);
    });

    it("negative — §9 credential/secret 누출 0: 추출/합성 토큰에 gh 토큰 어휘·실 credential·실 password·apiKey 값 미등장(§9/REQ-059)", () => {
      const r = readme();
      const c = config();
      const g = gitignore();
      const synthesized = [
        JSON.stringify(extractReadmeParityAnchors(r, c, g)),
        JSON.stringify(scriptTableEntries(r)),
        JSON.stringify(crossRefPaths(r)),
        String(readmeIniValue(r, "OLLAMA_MODEL")),
        String(readmeIniValue(r, "OLLAMA_HOST")),
        String(readmeIniValue(r, "OLLAMA_KEEP_ALIVE")),
        String(readmeIniValue(r, "OPENAI_BASE_URL")),
        String(readmeLanCidr(r)),
        String(readmeTableFieldValue(r, "endpointUrl")),
        String(readmeTableFieldValue(r, "modelId")),
        String(seedEndpointExamplePort(r)),
      ];
      const strongPattern =
        /(ghp_|--token|GITHUB_TOKEN|GH_TOKEN|\bBearer\b|Authorization|\bsk-|PASSWORD=|apiKey"?\s*[:=]\s*["']?\w)/i;
      synthesized.forEach((s) => {
        expect(strongPattern.test(s)).toBe(false);
      });
      // 합성 mutant 값도 명백한 dummy(8080·llama3:8b·qwen3:8b·10.0.0.0/8·run-llm.ps1·deploy/DEPLOY.md)로 한정 — 실 자격 0.
      const dummies = [
        "8080",
        "llama3:8b",
        "qwen3:8b",
        "10.0.0.0/8",
        "run-llm.ps1",
        "deploy/DEPLOY.md",
      ];
      dummies.forEach((d) => expect(strongPattern.test(d)).toBe(false));
      // 추출 값은 모두 비시크릿 설정 값/경로/예시(bind 주소·CIDR·모델 tag·keep-alive·/v1·apiKey 안내 더미 ollama).
      expect(readmeIniValue(r, "OLLAMA_HOST")).toBe(EXPECTED_HOST);
      expect(readmeLanCidr(r)).toBe(EXPECTED_CIDR);
      // README apiKey 안내값은 명백한 더미 `ollama`(Ollama 는 키 미검증) — 실 자격 아님.
      expect(r.includes("`ollama`")).toBe(true);
    });
  });

  describe("flow: 결정론 · no-mutation(원본 read-only 입증)", () => {
    it("동일 입력으로 pure 함수를 두 번 호출하면 deep-equal(결정론)", () => {
      const r = readme();
      const c = config();
      const g = gitignore();
      expect(extractReadmeParityAnchors(r, c, g)).toEqual(
        extractReadmeParityAnchors(r, c, g),
      );
      expect(scriptTableEntries(r)).toEqual(scriptTableEntries(r));
      expect(crossRefPaths(r)).toEqual(crossRefPaths(r));
    });

    it("합성 mutate(사본 replace) 후에도 원본 소스 텍스트·pure 함수 산출이 불변(원본 read-only)", () => {
      const r = readme();
      const g = gitignore();
      const rSnap = r;
      const gSnap = g;
      // 사본 mutate(negative a~h 에서 쓰는 replace) — 원본 불변 확인.
      r.replace("OLLAMA_MODEL=gemma4:12b", "OLLAMA_MODEL=llama3:8b");
      r.replace("OLLAMA_HOST=127.0.0.1:11434", "OLLAMA_HOST=127.0.0.1:8080");
      r.replace(
        "`endpointUrl` | `http://127.0.0.1:11434/v1`",
        "`endpointUrl` | `http://127.0.0.1:11434`",
      );
      r.replace("`modelId` | `gemma4:12b`", "`modelId` | `qwen3:8b`");
      r.replace("`192.168.0.0/24`", "`10.0.0.0/8`");
      r.replace("| `test-llm.ps1` |", "| `run-llm.ps1` |");
      r.replace("`deploy/README.md`", "`deploy/DEPLOY.md`");
      g.replace(/^config\.local\.env$/m, "");
      expect(r).toBe(rSnap);
      expect(g).toBe(gSnap);
      // 추출/파싱 후에도 원본 불변.
      extractReadmeParityAnchors(r, config(), g);
      expect(r).toBe(rSnap);
      expect(g).toBe(gSnap);
    });
  });

  describe("dormant / non-gated 확인 — side-effect 0", () => {
    it("parity 모델이 env / 전역 상태 없이 순수하게 동작(non-gated — describe.skip 0·gating 분기 0)", () => {
      // 본 describe 가 실행된다는 것 자체가 describe.skip 0(항상 실행)의 런타임 증거.
      const envSnapshot = { ...process.env };
      const r = readme();
      const before = readmeIniValue(r, "OLLAMA_MODEL");
      // 실 process.env 를 mutate 해도 산출 불변 — 모델이 process.env 를 참조하지 않음(파라미터로만).
      Object.assign(process.env, { LOCAL_LLM_README_PARITY_UNIT_TEST: "x" });
      const after = readmeIniValue(r, "OLLAMA_MODEL");
      delete process.env.LOCAL_LLM_README_PARITY_UNIT_TEST;
      expect(after).toBe(before);
      expect(Object.keys(process.env)).toEqual(Object.keys(envSnapshot));
    });

    it("파일 read 는 README.md/config.env/.gitignore 읽기만 — 실 Ollama/실 추론/실 markdown 렌더 0. 세 파일은 조건 분기 없는 선언적 문서·설정 — 런타임 분기 없음(정적 소스 텍스트 앵커)이라 happy/negative mutant 로 대체 cover", () => {
      const anchors = extractReadmeParityAnchors(
        readme(),
        config(),
        gitignore(),
      );
      expect(Object.values(anchors).every((v) => v === true)).toBe(true);
    });
  });
});
