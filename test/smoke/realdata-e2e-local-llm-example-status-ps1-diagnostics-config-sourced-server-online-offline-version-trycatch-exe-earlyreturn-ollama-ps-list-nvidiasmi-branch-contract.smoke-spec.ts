// realdata-e2e-local-llm-example-status-ps1-diagnostics-config-sourced-server-online-offline-version-trycatch-exe-earlyreturn-ollama-ps-list-nvidiasmi-branch-contract.smoke-spec.ts
// — 로컬 Ollama live-LLM 운영 premise leg 후속. T-0966 이 `config.env`(LLM 호스트측 설정 정본)·T-0967 이 그 config 를
// 코드로 소비하는 공용 헬퍼 `_common.ps1`(모든 로컬 LLM 스크립트가 dot-source 하는 single-source 헬퍼)·T-0968 이 운영자
// README·T-0969 가 1순위 설치 진입점 `install.ps1`·T-0970 이 2순위 기동/예열 진입점 `start-llm.ps1`·T-0971 이 3순위 자원 해제
// 진입점 `stop-llm.ps1` 을 봉했다. 본 task 는 운영자가 **현재 로컬 LLM 상태를 한눈에 확인하려고 쓰는 4순위 read-only
// 진단 진입점** `deploy/local-llm-example/status.ps1`(그 _common.ps1 을 dot-source 해 config 정본을 읽고 서버 생존/실행
// 파일을 판정한 뒤 설정 요약·서버 ONLINE/OFFLINE·적재 모델(ollama ps)·받아둔 모델(ollama list)·(선택) GPU 사용량
// (nvidia-smi)을 표시하는 스크립트) 의 내부 계약을 세 실 파일(status.ps1·config.env·_common.ps1)을 readFileSync 로
// 읽어(실 PowerShell 실행/실 Ollama ps/list·실 nvidia-smi·실 HTTP GET 0) 정적 검증하는 non-gated smoke
// (T-0972, PLAN.md §108/§109 재배포 runner chain — LLM 호스트측 read-only 진단 진입점 leg).
//
// 봉함 불변식(핵심 위험 = 진단 표시 계약 drift):
//   (1) config-sourced 표시 값 계약(1순위): status.ps1 이 설정 요약을 `$cfg.OLLAMA_MODEL`·`$cfg.OLLAMA_HOST`·
//       `$cfg.OLLAMA_KEEP_ALIVE`·`$cfg.OPENAI_BASE_URL` 로, api base 를 `Get-LocalApiBase -OllamaHost $cfg.OLLAMA_HOST`
//       로 참조하고, `gemma4:12b`·`127.0.0.1:11434`·`5m`·`http://127.0.0.1:11434/v1` 같은 config 값 literal 을 본문에
//       하드코딩하지 않음. 하드코딩 시 config.env 정본(T-0966)과 조용히 divergence → 운영자가 실제와 다른 설정을 봄.
//   (2) dot-source 계약: status.ps1 이 `_common.ps1` 을 상대 경로(`Split-Path -Parent $MyInvocation...` +
//       `Join-Path ... '_common.ps1'`)로 dot-source 하고, 호출 헬퍼 심볼(Get-LlmConfig·Get-LocalApiBase·
//       Test-OllamaServer·Get-OllamaExe)이 각각 _common.ps1 에 function 정의로 실존(dead 호출 0).
//   (3) 서버 ONLINE/OFFLINE 분기: `if (Test-OllamaServer -ApiBase $apiBase)` → ONLINE 표시 / `else` → OFFLINE 안내.
//       분기가 어긋나면 상태가 반대로 표시된다.
//   (4) version 조회 try/catch: `try { Invoke-RestMethod -Uri "$apiBase/api/version" -TimeoutSec 3 } catch { ... }`
//       (version API 실패해도 ONLINE 표시가 치명화되지 않음). try/catch 누락 시 미지원/타임아웃에서 스크립트가 죽어 상태 못 봄.
//   (5) exe 미발견 early-return skip 분기: `if (-not $exe)` → "install.ps1" 안내 + `return`(이후 `& $exe ps`/`list` 미도달).
//       skip 누락 시 없는 exe 로 `& $exe ps` 를 호출해 오진단.
//   (6) 진단 실행: `& $exe ps`(적재 모델) · `& $exe list`(받아둔 모델) 두 호출.
//   (7) nvidia-smi 선택 분기: `$smi = Get-Command nvidia-smi -ErrorAction SilentlyContinue` + `if ($smi) { & nvidia-smi ... }`
//       (존재할 때만 조건부 실행). 무조건 호출하면 GPU 없는 호스트에서 오류.
//
// 전략(형제 T-0971 stop-llm.ps1·T-0970 start-llm.ps1·T-0967 _common.ps1 동형): 세 실 파일에서 정본 토큰/시퀀스를 정적
// 추출하는 해석 동형 TS 순수 함수(configValue·configSourcedRef·configLiteralHardcoded·dotSourceRelative·
// helperSymbolDefined·helperSymbolConsumed·apiBaseConfigSourced·serverOnlineOfflineBranch·versionTryCatch·
// exeMissingEarlyReturn·ollamaDiagnostics·nvidiaSmiOptional·extractStatusAnchors)로 계약을 assert. 합성 mutant 사본으로
// negative(a~g 7종) 변별. T-0966/T-0967(config.env·_common.ps1 자체 계약) 와 distinct — 본 task 는 status.ps1 이 그
// config/헬퍼를 **소비/배선**하는 진단 표시 계약만.
//   🔥 실 PowerShell 실행 0 · 실 Ollama ps/list 0 · 실 nvidia-smi 0 · 실 HTTP GET(/api/version)/실 Invoke-RestMethod/
//      실 Get-Command 0 · process.env 읽기 0(입력은 pure 함수 파라미터) · credential 0(§9/REQ-059) · 새 dep 0(node fs/path)
//      · src 변경 0(test-only) · status.ps1/config.env/_common.ps1 읽기만(실행 0 · 변경 0).
import { existsSync, readFileSync } from "fs";
import * as path from "path";

// repo-root 경로 — test 실행 cwd 무관하게 robust 하게 해석(`__dirname` = test/smoke,
// 두 단계 위가 repo-root). `process.cwd()` 대신 `__dirname` 기준 상대로 고정(sibling T-0971/T-0970).
const REPO_ROOT = path.resolve(__dirname, "../..");
const LLM_DIR = path.join(REPO_ROOT, "deploy", "local-llm-example");
const STATUS_PS1_PATH = path.join(LLM_DIR, "status.ps1");
const CONFIG_ENV_PATH = path.join(LLM_DIR, "config.env");
const COMMON_PS1_PATH = path.join(LLM_DIR, "_common.ps1");

// 정본 앵커(실 artifact 표현의 TS mirror — 실 PowerShell/실 Ollama 0).
// status.ps1 이 설정 요약에서 config-sourced 로 참조해야 하는 값(하드코딩 금지 대상) — config.env 정본이 근거.
const CONFIG_SOURCED_KEYS = [
  "OLLAMA_MODEL",
  "OLLAMA_HOST",
  "OLLAMA_KEEP_ALIVE",
  "OPENAI_BASE_URL",
]; // status.ps1 이 $cfg.<KEY> 로 참조해야 하는 4종.
// 위 키의 config.env active 값 — status.ps1 본문에 literal 로 등장하면 divergence 위험(하드코딩 검출 대상).
const CONFIG_LITERALS: Record<string, string> = {
  OLLAMA_MODEL: "gemma4:12b",
  OLLAMA_HOST: "127.0.0.1:11434",
  OLLAMA_KEEP_ALIVE: "5m",
  OPENAI_BASE_URL: "http://127.0.0.1:11434/v1",
};
// status.ps1 이 dot-source 후 호출하는 헬퍼 심볼 — 각각 _common.ps1 에 function 정의로 실존해야(dead 호출 0).
const CONSUMED_HELPER_SYMBOLS = [
  "Get-LlmConfig",
  "Get-LocalApiBase",
  "Test-OllamaServer",
  "Get-OllamaExe",
];

// ── TS 동형 pure 함수(정본) — status.ps1 / config.env / _common.ps1 의 정본 토큰/시퀀스를 모델링.
//    입력(문자열)은 mutate 하지 않는다(읽기만). 실 ps1 파서 라이브러리 0 — 정규식/행 슬라이스/indexOf 만.

// 소스를 CRLF-정규화 후 라인 배열로 — 공통 입력.
function toLines(source: string): string[] {
  return source.replace(/\r\n/g, "\n").split("\n");
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

// configSourcedRef(status, key): status.ps1 이 `$cfg.<KEY>` 로 config-sourced 참조를 하는가(소스 리터럴 존재).
function configSourcedRef(status: string, key: string): boolean {
  return new RegExp(`\\$cfg\\.${key}\\b`).test(status);
}

// configLiteralHardcoded(status, literal): config 값 literal 이 status.ps1 본문에 하드코딩됐는가(있으면 위반).
//   `$cfg.` 참조는 literal 이 아니라 참조이므로 걸리지 않는다 — 값 문자열 자체의 등장만 검출.
function configLiteralHardcoded(status: string, literal: string): boolean {
  return status.includes(literal);
}

// dotSourceRelative(status): _common.ps1 을 상대 경로로 dot-source 하는가(Split-Path -Parent + Join-Path + '_common.ps1').
function dotSourceRelative(status: string): boolean {
  const hasDotSource = /^\s*\.\s+\(Join-Path/m.test(status);
  const hasScriptDir = status.includes(
    "Split-Path -Parent $MyInvocation.MyCommand.Path",
  );
  const hasCommonRef = status.includes("'_common.ps1'");
  return hasDotSource && hasScriptDir && hasCommonRef;
}

// helperSymbolDefined(common, symbol): 헬퍼 심볼이 _common.ps1 에 `function <symbol>` 정의로 실존하는가.
function helperSymbolDefined(common: string, symbol: string): boolean {
  return new RegExp(`function\\s+${symbol}\\b`, "i").test(common);
}

// helperSymbolConsumed(status, symbol): status.ps1 이 그 헬퍼 심볼을 호출/참조하는가.
function helperSymbolConsumed(status: string, symbol: string): boolean {
  return new RegExp(`\\b${symbol}\\b`).test(status);
}

// apiBaseConfigSourced(status): api base 를 `Get-LocalApiBase -OllamaHost $cfg.OLLAMA_HOST` 로 config-sourced 하게 얻는가.
function apiBaseConfigSourced(status: string): boolean {
  return /Get-LocalApiBase\s+-OllamaHost\s+\$cfg\.OLLAMA_HOST/.test(status);
}

// serverOnlineOfflineBranch(status): 서버 생존 판정 분기 — `if (Test-OllamaServer -ApiBase $apiBase)`(ONLINE) +
//   `} else {`(OFFLINE 안내) 양쪽 존재. 두 분기가 모두 있어야 상태를 옳게 표시.
function serverOnlineOfflineBranch(status: string): boolean {
  const guard = /if\s*\(Test-OllamaServer\s+-ApiBase\s+\$apiBase\)/.test(
    status,
  );
  const elseBranch = /}\s*else\s*\{/.test(status);
  const offlineMarker = /OFFLINE/.test(status);
  return guard && elseBranch && offlineMarker;
}

// versionTryCatch(status): version 조회를 try/catch 로 감쌈 — `try { ... Invoke-RestMethod -Uri "$apiBase/api/version"
//   -TimeoutSec 3 ... } catch { ... }`. version API 실패해도 ONLINE 표시가 치명화되지 않게 하는 계약.
function versionTryCatch(status: string): boolean {
  const hasTry = /\btry\s*\{/.test(status);
  const versionCall =
    /Invoke-RestMethod\s+-Uri\s+"\$apiBase\/api\/version"\s+-TimeoutSec\s+3/.test(
      status,
    );
  const hasCatch = /\}\s*catch\s*\{/.test(status);
  return hasTry && versionCall && hasCatch;
}

// exeMissingEarlyReturn(status): exe 미발견 early-return skip 분기 — `if (-not $exe)` 가드 이후, 진단(`& $exe ps`) 앞에
//   `return`(early-exit) 이 존재. 이 return 이 없는 exe 로의 진단 호출을 skip 하게 한다.
function exeMissingEarlyReturn(status: string): boolean {
  const guardAt = status.search(/if\s*\(-not\s*\$exe\)/);
  if (guardAt < 0) return false;
  const diagAt = status.indexOf("& $exe ps");
  const re = /(^|\n)\s*return\b/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(status)) !== null) {
    const idx = m.index;
    if (idx > guardAt && (diagAt < 0 || idx < diagAt)) return true;
  }
  return false;
}

// ollamaDiagnostics(status): 진단 실행 — `& $exe ps`(적재 모델) · `& $exe list`(받아둔 모델) 두 호출 존재.
function ollamaDiagnostics(status: string): boolean {
  const ps = /&\s*\$exe\s+ps\b/.test(status);
  const list = /&\s*\$exe\s+list\b/.test(status);
  return ps && list;
}

// nvidiaSmiOptional(status): GPU 사용량 선택 분기 — `Get-Command nvidia-smi -ErrorAction SilentlyContinue` 로 존재 확인 +
//   `if ($smi)` 가드 + `& nvidia-smi ...`. 존재할 때만 조건부 실행(무조건 호출 금지).
function nvidiaSmiOptional(status: string): boolean {
  const getCommand =
    /Get-Command\s+nvidia-smi\s+-ErrorAction\s+SilentlyContinue/.test(status);
  const guard = /if\s*\(\s*\$smi\s*\)/.test(status);
  const invoke = /&\s*nvidia-smi\b/.test(status);
  return getCommand && guard && invoke;
}

// (집계) extractStatusAnchors(status, config, common): 진단 스크립트 내부 계약 불변식을 한 번에 집계 —
//   하나라도 부재/변질이면 명시적 false(빈 결과 성공-위장 0).
function extractStatusAnchors(
  status: string,
  config: string,
  common: string,
): {
  configSourced: boolean;
  noConfigLiteralHardcoded: boolean;
  dotSource: boolean;
  helperSymbolsWired: boolean;
  apiBaseSourced: boolean;
  serverBranch: boolean;
  versionTry: boolean;
  exeEarlyReturn: boolean;
  diagnostics: boolean;
  nvidiaOptional: boolean;
} {
  // config-sourced: 4 키 모두 $cfg.<KEY> 참조.
  const configSourced = CONFIG_SOURCED_KEYS.every((k) =>
    configSourcedRef(status, k),
  );
  // 하드코딩 금지: config.env active 값 literal 이 status 본문에 등장하지 않음.
  const noConfigLiteralHardcoded = CONFIG_SOURCED_KEYS.every((k) => {
    const literal = configValue(config, k);
    return literal !== undefined && !configLiteralHardcoded(status, literal);
  });
  // 헬퍼 심볼 배선: status 가 호출하는 심볼이 각각 _common.ps1 에 function 정의로 실존.
  const helperSymbolsWired = CONSUMED_HELPER_SYMBOLS.every(
    (s) => helperSymbolConsumed(status, s) && helperSymbolDefined(common, s),
  );
  return {
    configSourced,
    noConfigLiteralHardcoded,
    dotSource: dotSourceRelative(status),
    helperSymbolsWired,
    apiBaseSourced: apiBaseConfigSourced(status),
    serverBranch: serverOnlineOfflineBranch(status),
    versionTry: versionTryCatch(status),
    exeEarlyReturn: exeMissingEarlyReturn(status),
    diagnostics: ollamaDiagnostics(status),
    nvidiaOptional: nvidiaSmiOptional(status),
  };
}

describe("realdata-e2e §108/§109 deploy/local-llm-example/status.ps1 진단 상태 표시 스크립트 내부 계약 smoke — config-sourced 표시 값 참조(하드코딩 금지, 1순위) + _common.ps1 dot-source·헬퍼 심볼 배선 + 서버 ONLINE/OFFLINE 분기 + version 조회 try/catch(비치명) + exe 미발견 early-return skip 분기 + ollama ps/list 진단 + nvidia-smi 선택 분기 + secret-safety (T-0972)", () => {
  const status = () => readFileSync(STATUS_PS1_PATH, "utf8");
  const config = () => readFileSync(CONFIG_ENV_PATH, "utf8");
  const common = () => readFileSync(COMMON_PS1_PATH, "utf8");

  describe("Happy-path: 대조 artifact 3종 실존 + 10 불변식 전부 true", () => {
    it("status.ps1·config.env·_common.ps1 가 repo-root 기준 실존(existsSync)", () => {
      expect(existsSync(STATUS_PS1_PATH)).toBe(true);
      expect(existsSync(CONFIG_ENV_PATH)).toBe(true);
      expect(existsSync(COMMON_PS1_PATH)).toBe(true);
    });

    it("10 불변식(config-sourced·하드코딩금지·dot-source·헬퍼배선·api base sourced·서버 ONLINE/OFFLINE 분기·version try/catch·exe 미발견 return·ollama ps/list 진단·nvidia-smi 선택 분기) 전부 true", () => {
      const anchors = extractStatusAnchors(status(), config(), common());
      expect(Object.values(anchors).every((v) => v === true)).toBe(true);
    });
  });

  describe("Happy-path(1순위 계약): config-sourced 표시 값 참조($cfg.<KEY>) + config 값 literal 하드코딩 부재(키당 1+)", () => {
    it("설정 요약을 $cfg.OLLAMA_MODEL·$cfg.OLLAMA_HOST·$cfg.OLLAMA_KEEP_ALIVE·$cfg.OPENAI_BASE_URL 4종으로 참조", () => {
      const s = status();
      CONFIG_SOURCED_KEYS.forEach((k) => {
        expect(configSourcedRef(s, k)).toBe(true);
      });
    });

    it("gemma4:12b·127.0.0.1:11434·5m·http://127.0.0.1:11434/v1 literal 을 status.ps1 본문에 하드코딩하지 않음(config.env 가 그 값의 정본)", () => {
      const s = status();
      const cfg = config();
      CONFIG_SOURCED_KEYS.forEach((k) => {
        expect(configLiteralHardcoded(s, CONFIG_LITERALS[k])).toBe(false);
        // config.env 가 그 값의 정본(byte 근거).
        expect(configValue(cfg, k)).toBe(CONFIG_LITERALS[k]);
      });
      expect(
        extractStatusAnchors(s, cfg, common()).noConfigLiteralHardcoded,
      ).toBe(true);
    });

    it("api base 를 Get-LocalApiBase -OllamaHost $cfg.OLLAMA_HOST 로 config-sourced 하게 얻음(하드코딩 아님)", () => {
      const s = status();
      expect(apiBaseConfigSourced(s)).toBe(true);
      expect(configSourcedRef(s, "OLLAMA_HOST")).toBe(true);
      expect(extractStatusAnchors(s, config(), common()).apiBaseSourced).toBe(
        true,
      );
    });
  });

  describe("Happy-path: _common.ps1 dot-source(상대경로) + 호출 헬퍼 심볼 4종이 function 정의로 실존(dead 호출 0)", () => {
    it("status.ps1 이 _common.ps1 을 상대경로로 dot-source", () => {
      const s = status();
      expect(dotSourceRelative(s)).toBe(true);
      expect(s).toContain("Split-Path -Parent $MyInvocation.MyCommand.Path");
      expect(s).toContain("'_common.ps1'");
    });

    it("status.ps1 이 호출하는 헬퍼 심볼 4종(Get-LlmConfig·Get-LocalApiBase·Test-OllamaServer·Get-OllamaExe)이 각각 _common.ps1 에 function 정의로 실존", () => {
      const s = status();
      const c = common();
      CONSUMED_HELPER_SYMBOLS.forEach((sym) => {
        expect(helperSymbolConsumed(s, sym)).toBe(true);
        expect(helperSymbolDefined(c, sym)).toBe(true);
      });
      expect(extractStatusAnchors(s, config(), c).helperSymbolsWired).toBe(
        true,
      );
    });
  });

  describe("Flow/branch cover: 서버 ONLINE/OFFLINE 분기(if (Test-OllamaServer -ApiBase $apiBase) → ONLINE / else → OFFLINE 안내)", () => {
    it("if (Test-OllamaServer -ApiBase $apiBase) 가드 + } else { OFFLINE 안내 양쪽 존재", () => {
      const s = status();
      expect(serverOnlineOfflineBranch(s)).toBe(true);
      expect(/if\s*\(Test-OllamaServer\s+-ApiBase\s+\$apiBase\)/.test(s)).toBe(
        true,
      );
      expect(/}\s*else\s*\{/.test(s)).toBe(true);
      expect(s).toContain("OFFLINE");
    });
  });

  describe("Flow/branch cover: version 조회 try/catch(API 실패해도 ONLINE 표시 비치명)", () => {
    it('try { Invoke-RestMethod -Uri "$apiBase/api/version" -TimeoutSec 3 } catch { ... } 존재', () => {
      const s = status();
      expect(versionTryCatch(s)).toBe(true);
      expect(/\btry\s*\{/.test(s)).toBe(true);
      expect(
        /Invoke-RestMethod\s+-Uri\s+"\$apiBase\/api\/version"\s+-TimeoutSec\s+3/.test(
          s,
        ),
      ).toBe(true);
      expect(/\}\s*catch\s*\{/.test(s)).toBe(true);
    });
  });

  describe("Flow/branch cover: exe 미발견 early-return skip 분기(if (-not $exe) → install.ps1 안내 + return, 이후 & $exe ps/list 미도달)", () => {
    it("if (-not $exe) 가드 이후 진단(& $exe ps) 앞에 return early-exit 존재", () => {
      const s = status();
      expect(exeMissingEarlyReturn(s)).toBe(true);
      expect(/if\s*\(-not\s*\$exe\)/.test(s)).toBe(true);
      // return 위치가 exe 미발견 가드 뒤 · 진단(& $exe ps) 앞(진단 skip).
      const guardAt = s.search(/if\s*\(-not\s*\$exe\)/);
      const returnAt = s.search(/(^|\n)\s*return\b/);
      const diagAt = s.indexOf("& $exe ps");
      expect(returnAt).toBeGreaterThan(guardAt);
      expect(returnAt).toBeLessThan(diagAt);
    });
  });

  describe("Flow/branch cover: 진단 실행(& $exe ps · & $exe list 두 호출) + nvidia-smi 선택 분기", () => {
    it("& $exe ps(적재 모델) · & $exe list(받아둔 모델) 두 진단 호출 존재", () => {
      const s = status();
      expect(ollamaDiagnostics(s)).toBe(true);
      expect(/&\s*\$exe\s+ps\b/.test(s)).toBe(true);
      expect(/&\s*\$exe\s+list\b/.test(s)).toBe(true);
    });

    it("nvidia-smi 는 Get-Command ... -ErrorAction SilentlyContinue + if ($smi) 로 존재할 때만 조건부 실행", () => {
      const s = status();
      expect(nvidiaSmiOptional(s)).toBe(true);
      expect(
        /Get-Command\s+nvidia-smi\s+-ErrorAction\s+SilentlyContinue/.test(s),
      ).toBe(true);
      expect(/if\s*\(\s*\$smi\s*\)/.test(s)).toBe(true);
      expect(/&\s*nvidia-smi\b/.test(s)).toBe(true);
    });
  });

  describe("Error path / negative cases 충분 cover (mutant 합성 사본 — 원본 미변조, 예외 분기마다 각 1+)", () => {
    it("error path — 대조 artifact 부재 경로 → readFileSync throw(silent 0-byte fallback 0)", () => {
      const badPath = path.join(LLM_DIR, "__does_not_exist___status.ps1");
      expect(existsSync(badPath)).toBe(false);
      expect(() => readFileSync(badPath, "utf8")).toThrow();
    });

    it("error path — 앵커 토큰 부재 시 명시적 false(빈 매칭을 pass 로 오통과 0)", () => {
      const anchors = extractStatusAnchors("", "", "");
      expect(Object.values(anchors).some((v) => v === true)).toBe(false);
      // 실 소스는 반대로 전부 true — 부재/실재 변별.
      const real = extractStatusAnchors(status(), config(), common());
      expect(Object.values(real).every((v) => v === true)).toBe(true);
    });

    it("negative (a) — 설정 요약에 config 값 gemma4:12b·127.0.0.1:11434 를 literal 로 하드코딩한 mutant → config-sourced 표시 값 계약(하드코딩 금지) 위반 검출", () => {
      const s = status();
      const mutant = s.replace(
        "$cfg.OLLAMA_MODEL, $cfg.OLLAMA_HOST",
        "'gemma4:12b', '127.0.0.1:11434'",
      );
      expect(configLiteralHardcoded(mutant, "gemma4:12b")).toBe(true);
      expect(configLiteralHardcoded(mutant, "127.0.0.1:11434")).toBe(true);
      expect(
        extractStatusAnchors(mutant, config(), common())
          .noConfigLiteralHardcoded,
      ).toBe(false);
      // 원본 불변.
      expect(configLiteralHardcoded(s, "gemma4:12b")).toBe(false);
      expect(configLiteralHardcoded(s, "127.0.0.1:11434")).toBe(false);
    });

    it("negative (b) — dot-source 행을 절대경로/타 파일로 바꾼 mutant → dot-source 상대경로 계약 drift 검출", () => {
      const s = status();
      const mutant = s.replace(
        ". (Join-Path (Split-Path -Parent $MyInvocation.MyCommand.Path) '_common.ps1')",
        ". C:\\ollama\\helpers.ps1",
      );
      expect(dotSourceRelative(mutant)).toBe(false);
      expect(extractStatusAnchors(mutant, config(), common()).dotSource).toBe(
        false,
      );
      // 원본 불변.
      expect(dotSourceRelative(s)).toBe(true);
    });

    it("negative (c) — 서버 판정의 else(OFFLINE 안내) 분기를 제거한 mutant → ONLINE/OFFLINE 분기 drift 검출", () => {
      const s = status();
      const mutant = s.replace("} else {", "}");
      expect(serverOnlineOfflineBranch(mutant)).toBe(false);
      expect(
        extractStatusAnchors(mutant, config(), common()).serverBranch,
      ).toBe(false);
      // 원본 불변.
      expect(serverOnlineOfflineBranch(s)).toBe(true);
    });

    it("negative (d) — version 조회의 try/catch 를 제거(bare Invoke-RestMethod)한 mutant → version 실패 비치명 계약 drift 검출", () => {
      const s = status();
      const mutant = s.replace(/\btry\s*\{/, "");
      expect(/\btry\s*\{/.test(mutant)).toBe(false);
      expect(versionTryCatch(mutant)).toBe(false);
      expect(extractStatusAnchors(mutant, config(), common()).versionTry).toBe(
        false,
      );
      // 원본 불변.
      expect(versionTryCatch(s)).toBe(true);
    });

    it("negative (e) — exe 미발견 분기의 return early-exit 를 제거(없는 exe 로 & $exe ps 진행)한 mutant → skip 분기 drift 검출", () => {
      const s = status();
      const mutant = s.replace(/^\s*return\s*$/m, "");
      expect(exeMissingEarlyReturn(mutant)).toBe(false);
      expect(
        extractStatusAnchors(mutant, config(), common()).exeEarlyReturn,
      ).toBe(false);
      // 원본 불변.
      expect(exeMissingEarlyReturn(s)).toBe(true);
    });

    it("negative (f) — nvidia-smi 의 if ($smi) 가드(+Get-Command ... SilentlyContinue)를 제거해 무조건 & nvidia-smi 실행하는 mutant → GPU 선택 분기 drift 검출", () => {
      const s = status();
      const mutant = s
        .replace(
          "$smi = Get-Command nvidia-smi -ErrorAction SilentlyContinue",
          "",
        )
        .replace("if ($smi) {", "");
      expect(nvidiaSmiOptional(mutant)).toBe(false);
      expect(
        extractStatusAnchors(mutant, config(), common()).nvidiaOptional,
      ).toBe(false);
      // 원본 불변.
      expect(nvidiaSmiOptional(s)).toBe(true);
    });

    it("negative (g) — status.ps1 이 호출하는 Test-OllamaServer 를 _common.ps1 정의에서 제거한 합성 mutant → dead 호출(심볼 소비 계약) 검출", () => {
      const s = status();
      const c = common();
      const mutantCommon = c.replace(
        /function\s+Test-OllamaServer\b/,
        "function Test-SomethingElse",
      );
      expect(helperSymbolConsumed(s, "Test-OllamaServer")).toBe(true); // status 는 여전히 호출.
      expect(helperSymbolDefined(mutantCommon, "Test-OllamaServer")).toBe(
        false,
      ); // 정의는 사라짐 → dead 호출.
      expect(
        extractStatusAnchors(s, config(), mutantCommon).helperSymbolsWired,
      ).toBe(false);
      // 원본 불변.
      expect(helperSymbolDefined(c, "Test-OllamaServer")).toBe(true);
    });

    it("negative — §9 credential/secret 누출 0: 추출/합성 토큰에 gh 토큰 어휘·실 credential·실 password·apiKey 값 미등장(§9/REQ-059)", () => {
      const synthesized = [
        JSON.stringify(extractStatusAnchors(status(), config(), common())),
        ...CONFIG_SOURCED_KEYS.map((k) => String(configValue(config(), k))),
        CONSUMED_HELPER_SYMBOLS.join(","),
      ];
      const strongPattern =
        /(ghp_|--token|GITHUB_TOKEN|GH_TOKEN|\bBearer\b|Authorization|\bsk-|PASSWORD=|apiKey"?\s*[:=]\s*["']?\w)/i;
      synthesized.forEach((v) => {
        expect(strongPattern.test(v)).toBe(false);
      });
      // 합성 mutant 값도 명백한 dummy(하드코딩 gemma4:12b/127.0.0.1:11434 literal·타 파일 경로 C:\ollama\helpers.ps1 등)로 한정 — 실 자격 0.
      const dummies = [
        "gemma4:12b",
        "127.0.0.1:11434",
        "C:\\ollama\\helpers.ps1",
      ];
      dummies.forEach((d) => expect(strongPattern.test(d)).toBe(false));
      // 추출 값은 모두 비시크릿 설정 값/경로(bind 주소·모델 tag·endpoint·진단 명령).
      expect(configValue(config(), "OLLAMA_HOST")).toBe("127.0.0.1:11434");
      expect(status()).toContain("$apiBase/api/version");
      expect(status()).toContain("nvidia-smi");
    });
  });

  describe("branch: 각 정본 앵커 일치/drift 정적 대조(합성 mutant 사본 — 원본 미변조)", () => {
    it("config-sourced 값 계약 일치/drift 분기", () => {
      const s = status();
      expect(
        extractStatusAnchors(s, config(), common()).noConfigLiteralHardcoded,
      ).toBe(true);
      const mutant = s.replace(
        "$apiBase = Get-LocalApiBase -OllamaHost $cfg.OLLAMA_HOST",
        "$apiBase = Get-LocalApiBase -OllamaHost 127.0.0.1:11434",
      );
      expect(
        extractStatusAnchors(mutant, config(), common())
          .noConfigLiteralHardcoded,
      ).toBe(false);
      expect(apiBaseConfigSourced(mutant)).toBe(false);
    });

    it("헬퍼 심볼 배선 일치/drift 분기", () => {
      const c = common();
      expect(
        extractStatusAnchors(status(), config(), c).helperSymbolsWired,
      ).toBe(true);
      const mutant = c.replace(
        /function\s+Get-OllamaExe\b/,
        "function Get-Nothing",
      );
      expect(
        extractStatusAnchors(status(), config(), mutant).helperSymbolsWired,
      ).toBe(false);
    });
  });

  describe("flow: 결정론 · no-mutation(원본 read-only 입증)", () => {
    it("동일 입력으로 pure 함수를 두 번 호출하면 deep-equal(결정론)", () => {
      const s = status();
      const cfg = config();
      const c = common();
      expect(extractStatusAnchors(s, cfg, c)).toEqual(
        extractStatusAnchors(s, cfg, c),
      );
    });

    it("합성 mutate(사본 replace) 후에도 원본 소스 텍스트·pure 함수 산출이 불변(원본 read-only)", () => {
      const s = status();
      const cfg = config();
      const c = common();
      const sSnap = s;
      const cfgSnap = cfg;
      const cSnap = c;
      // 사본 mutate(negative a~g 에서 쓰는 replace) — 원본 불변 확인.
      s.replace(
        "$cfg.OLLAMA_MODEL, $cfg.OLLAMA_HOST",
        "'gemma4:12b', '127.0.0.1:11434'",
      );
      s.replace("} else {", "}");
      s.replace(/\btry\s*\{/, "");
      s.replace(/^\s*return\s*$/m, "");
      c.replace(
        /function\s+Test-OllamaServer\b/,
        "function Test-SomethingElse",
      );
      expect(s).toBe(sSnap);
      expect(cfg).toBe(cfgSnap);
      expect(c).toBe(cSnap);
      // 추출/파싱 후에도 원본 불변.
      extractStatusAnchors(s, cfg, c);
      expect(s).toBe(sSnap);
      expect(c).toBe(cSnap);
    });
  });

  describe("dormant / non-gated 확인 — side-effect 0", () => {
    it("계약 모델이 env / 전역 상태 없이 순수하게 동작(non-gated — describe.skip 0·gating 분기 0)", () => {
      // 본 describe 가 실행된다는 것 자체가 describe.skip 0(항상 실행)의 런타임 증거.
      const envSnapshot = { ...process.env };
      const s = status();
      const before = extractStatusAnchors(s, config(), common());
      // 실 process.env 를 mutate 해도 산출 불변 — 모델이 process.env 를 참조하지 않음(파라미터로만).
      Object.assign(process.env, { LOCAL_LLM_STATUS_PS1_UNIT_TEST: "x" });
      const after = extractStatusAnchors(s, config(), common());
      delete process.env.LOCAL_LLM_STATUS_PS1_UNIT_TEST;
      expect(after).toEqual(before);
      expect(Object.keys(process.env)).toEqual(Object.keys(envSnapshot));
    });

    it("파일 read 는 status.ps1/config.env/_common.ps1 읽기만 — 실 PowerShell/실 Ollama ps·list/실 nvidia-smi/실 HTTP GET 0. 세 파일은 선언적 스크립트·설정이라 런타임 분기 없이 정적 소스 텍스트 앵커로 happy/negative mutant 로 대체 cover", () => {
      const anchors = extractStatusAnchors(status(), config(), common());
      expect(Object.values(anchors).every((v) => v === true)).toBe(true);
    });
  });
});
