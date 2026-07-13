// realdata-e2e-local-llm-example-stop-llm-ps1-model-unload-keepalive0-config-sourced-cli-fallback-stopserver-branch-contract.smoke-spec.ts
// — 로컬 Ollama live-LLM 운영 premise leg 후속. T-0966 이 `config.env`(LLM 호스트측 설정 정본)·T-0967 이 그 config 를
// 코드로 소비하는 공용 헬퍼 `_common.ps1`(모든 로컬 LLM 스크립트가 dot-source 하는 single-source 헬퍼)·T-0968 이 운영자
// README·T-0969 가 1순위 설치 진입점 `install.ps1`·T-0970 이 2순위 기동/예열 진입점 `start-llm.ps1` 을 봉했다. 본 task 는
// 운영자가 사용을 끝내고 **GPU/메모리 자원을 해제하려고 쓰는 3순위 진입점** `deploy/local-llm-example/stop-llm.ps1`(그
// _common.ps1 을 dot-source 해 config 정본을 읽고 서버 생존 확인→모델 언로드(POST /api/generate keep_alive=0)→(API 실패 시)
// CLI 폴백→(옵션) 서버 프로세스 종료를 수행하는 스크립트) 의 내부 계약을 세 실 파일(stop-llm.ps1·config.env·_common.ps1)을
// readFileSync 로 읽어(실 PowerShell 실행/실 Ollama 언로드·서버 종료/실 HTTP POST 0) 정적 검증하는 non-gated smoke
// (T-0971, PLAN.md §108/§109 재배포 runner chain — LLM 호스트측 자원 해제 진입점 leg).
//
// 봉함 불변식(핵심 위험 = 자원 해제 계약 drift):
//   (1) config-sourced 값 계약(1순위): stop-llm.ps1 이 언로드 body 의 model 을 `$cfg.OLLAMA_MODEL`(=Get-LlmConfig 결과)로,
//       api base 를 `Get-LocalApiBase -OllamaHost $cfg.OLLAMA_HOST` 로, CLI 폴백 인자를 `$cfg.OLLAMA_MODEL` 로 참조하고,
//       `gemma4:12b`·`127.0.0.1:11434` 같은 config 값 literal 을 본문에 하드코딩하지 않음. 하드코딩 시 config.env 정본
//       (T-0966)과 조용히 divergence.
//   (2) dot-source 계약: stop-llm.ps1 이 `_common.ps1` 을 상대 경로(`Split-Path -Parent $MyInvocation...` +
//       `Join-Path ... '_common.ps1'`)로 dot-source 하고, 호출 헬퍼 심볼(Get-LlmConfig·Get-LocalApiBase·
//       Test-OllamaServer·Get-OllamaExe)이 각각 _common.ps1 에 function 정의로 실존(dead 호출 0).
//   (3) CmdletBinding + 1-switch param 계약: `[CmdletBinding()]` + `[switch]$StopServer` 정확히 1 switch.
//   (4) 서버 미기동 early-return skip 분기: `if (-not (Test-OllamaServer -ApiBase $apiBase))` → "해제할 자원 없음" 안내 +
//       `return`(언로드 코드 미도달). early-return 누락 시 죽은 서버에 언로드 POST 를 던져 오진단.
//   (5) 모델 언로드 body 계약: `@{ model=$cfg.OLLAMA_MODEL; keep_alive=0 }` `ConvertTo-Json` →
//       `Invoke-RestMethod -Uri "$apiBase/api/generate" -Method Post -ContentType 'application/json' -TimeoutSec 30`
//       POST 배선. model 은 config-sourced, keep_alive 는 `0`(즉시 VRAM 해제 계약의 핵심 값).
//   (6) API 언로드 실패 CLI 폴백: `catch { Write-Warning ...; $exe = Get-OllamaExe; if ($exe) { & $exe stop $cfg.OLLAMA_MODEL } }`
//       (API 실패가 치명화되지 않고 CLI 로 재시도). 폴백 누락 시 API 버전차에서 언로드가 조용히 무산.
//   (7) `-StopServer` 서버 종료 분기: `if ($StopServer)` → `Get-Process -Name 'ollama app','ollama' ... | Stop-Process -Force`
//       (서버 프로세스 종료) / `else` → "서버는 유지(idle, VRAM 0)" 안내. 분기 어긋나면 idle 점유 잔존 또는 옵션 없이 서버 사망.
//
// 전략(형제 T-0970 start-llm.ps1·T-0969 install.ps1·T-0967 _common.ps1 동형): 세 실 파일에서 정본 토큰/시퀀스를 정적
// 추출하는 해석 동형 TS 순수 함수(configSourcedRef·configLiteralHardcoded·dotSourceRelative·helperSymbolDefined·
// cmdletBindingPresent·switchParams·apiBaseConfigSourced·serverDownEarlyReturn·unloadBodyContract·unloadPostWiring·
// cliFallbackCatch·stopServerBranch·extractStopAnchors)로 계약을 assert. 합성 mutant 사본으로 negative(a~g 7종)
// 변별. T-0966/T-0967(config.env·_common.ps1 자체 계약) 와 distinct — 본 task 는 stop-llm.ps1 이 그 config/헬퍼를
// **소비/배선**하는 자원 해제 계약만.
//   🔥 실 PowerShell 실행 0 · 실 Ollama 언로드/서버 종료 0 · 실 HTTP POST/실 Invoke-RestMethod/실 Stop-Process 0 ·
//      process.env 읽기 0(입력은 pure 함수 파라미터) · credential 0(§9/REQ-059) · 새 dep 0(node fs/path) ·
//      src 변경 0(test-only) · stop-llm.ps1/config.env/_common.ps1 읽기만(실행 0 · 변경 0).
import { existsSync, readFileSync } from "fs";
import * as path from "path";

// repo-root 경로 — test 실행 cwd 무관하게 robust 하게 해석(`__dirname` = test/smoke,
// 두 단계 위가 repo-root). `process.cwd()` 대신 `__dirname` 기준 상대로 고정(sibling T-0967/T-0970).
const REPO_ROOT = path.resolve(__dirname, "../..");
const LLM_DIR = path.join(REPO_ROOT, "deploy", "local-llm-example");
const STOP_PS1_PATH = path.join(LLM_DIR, "stop-llm.ps1");
const CONFIG_ENV_PATH = path.join(LLM_DIR, "config.env");
const COMMON_PS1_PATH = path.join(LLM_DIR, "_common.ps1");

// 정본 앵커(실 artifact 표현의 TS mirror — 실 PowerShell/실 Ollama 0).
// stop-llm.ps1 이 config-sourced 로 참조해야 하는 값(하드코딩 금지 대상) — config.env 정본이 근거.
// keep_alive 는 여기서 config 값이 아니라 계약 상수 0(즉시 VRAM 해제) 이므로 config-sourced 대상이 아니다.
const CONFIG_SOURCED_KEYS = ["OLLAMA_MODEL", "OLLAMA_HOST"]; // stop-llm.ps1 이 $cfg.<KEY> 로 참조해야 하는 2종.
// 위 키의 config.env active 값 — stop-llm.ps1 본문에 literal 로 등장하면 divergence 위험(하드코딩 검출 대상).
const CONFIG_LITERALS: Record<string, string> = {
  OLLAMA_MODEL: "gemma4:12b",
  OLLAMA_HOST: "127.0.0.1:11434",
};
// stop-llm.ps1 이 dot-source 후 호출하는 헬퍼 심볼 — 각각 _common.ps1 에 function 정의로 실존해야(dead 호출 0).
const CONSUMED_HELPER_SYMBOLS = [
  "Get-LlmConfig",
  "Get-LocalApiBase",
  "Test-OllamaServer",
  "Get-OllamaExe",
];
// param 블록 1 switch.
const EXPECTED_SWITCHES = ["StopServer"];

// ── TS 동형 pure 함수(정본) — stop-llm.ps1 / config.env / _common.ps1 의 정본 토큰/시퀀스를 모델링.
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

// configSourcedRef(stop, key): stop-llm.ps1 이 `$cfg.<KEY>` 로 config-sourced 참조를 하는가(소스 리터럴 존재).
function configSourcedRef(stop: string, key: string): boolean {
  return new RegExp(`\\$cfg\\.${key}\\b`).test(stop);
}

// configLiteralHardcoded(stop, literal): config 값 literal 이 stop-llm.ps1 본문에 하드코딩됐는가(있으면 위반).
//   `$cfg.` 참조는 literal 이 아니라 참조이므로 걸리지 않는다 — 값 문자열 자체의 등장만 검출.
function configLiteralHardcoded(stop: string, literal: string): boolean {
  return stop.includes(literal);
}

// dotSourceRelative(stop): _common.ps1 을 상대 경로로 dot-source 하는가(Split-Path -Parent + Join-Path + '_common.ps1').
function dotSourceRelative(stop: string): boolean {
  const hasDotSource = /^\s*\.\s+\(Join-Path/m.test(stop);
  const hasScriptDir = stop.includes(
    "Split-Path -Parent $MyInvocation.MyCommand.Path",
  );
  const hasCommonRef = stop.includes("'_common.ps1'");
  return hasDotSource && hasScriptDir && hasCommonRef;
}

// helperSymbolDefined(common, symbol): 헬퍼 심볼이 _common.ps1 에 `function <symbol>` 정의로 실존하는가.
function helperSymbolDefined(common: string, symbol: string): boolean {
  return new RegExp(`function\\s+${symbol}\\b`, "i").test(common);
}

// helperSymbolConsumed(stop, symbol): stop-llm.ps1 이 그 헬퍼 심볼을 호출/참조하는가.
function helperSymbolConsumed(stop: string, symbol: string): boolean {
  return new RegExp(`\\b${symbol}\\b`).test(stop);
}

// cmdletBindingPresent(stop): `[CmdletBinding()]` 어트리뷰트가 소스에 존재하는가.
function cmdletBindingPresent(stop: string): boolean {
  return stop.includes("[CmdletBinding()]");
}

// switchParams(stop): param 블록에 선언된 `[switch]$Name` 스위치 이름 목록(등장 순).
function switchParams(stop: string): string[] {
  const out: string[] = [];
  const re = /\[switch\]\$(\w+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(stop)) !== null) out.push(m[1]);
  return out;
}

// apiBaseConfigSourced(stop): api base 를 `Get-LocalApiBase -OllamaHost $cfg.OLLAMA_HOST` 로 config-sourced 하게 얻는가.
function apiBaseConfigSourced(stop: string): boolean {
  return /Get-LocalApiBase\s+-OllamaHost\s+\$cfg\.OLLAMA_HOST/.test(stop);
}

// serverDownEarlyReturn(stop): 서버 미기동 early-return skip 분기 — `if (-not (Test-OllamaServer -ApiBase $apiBase))`
//   가드 이후, 언로드 body(`$body`) 앞에 `return`(early-exit) 이 존재. 이 return 이 언로드 코드를 skip 하게 한다.
function serverDownEarlyReturn(stop: string): boolean {
  const guardAt = stop.search(
    /if\s*\(-not\s*\(Test-OllamaServer\s+-ApiBase\s+\$apiBase\)\)/,
  );
  if (guardAt < 0) return false;
  const bodyAt = stop.indexOf("$body");
  const re = /(^|\n)\s*return\b/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(stop)) !== null) {
    const idx = m.index;
    if (idx > guardAt && (bodyAt < 0 || idx < bodyAt)) return true;
  }
  return false;
}

// unloadBodyContract(stop): 언로드 body hashtable 2 필드 — model=$cfg.OLLAMA_MODEL(config-sourced) · keep_alive=0
//   (즉시 VRAM 해제 계약 상수) + ConvertTo-Json.
function unloadBodyContract(stop: string): boolean {
  const model = /model\s*=\s*\$cfg\.OLLAMA_MODEL\b/.test(stop);
  // keep_alive = 0 은 hashtable 닫힘 `}` 앞에 있어야(주석 라인의 `keep_alive=0 으로` 오탐 회피).
  const keepAlive = /keep_alive\s*=\s*0\s*\}/.test(stop);
  const json = /ConvertTo-Json/.test(stop);
  return model && keepAlive && json;
}

// unloadPostWiring(stop): 언로드 POST 배선 — Invoke-RestMethod 로 "$apiBase/api/generate" 에 -Method Post,
//   -ContentType 'application/json', -TimeoutSec 30.
function unloadPostWiring(stop: string): boolean {
  const uri = /Invoke-RestMethod\s+-Uri\s+"\$apiBase\/api\/generate"/.test(
    stop,
  );
  const method = /-Method\s+Post\b/.test(stop);
  const contentType = /-ContentType\s+'application\/json'/.test(stop);
  const timeout = /-TimeoutSec\s+30\b/.test(stop);
  return uri && method && contentType && timeout;
}

// cliFallbackCatch(stop): API 언로드 실패 CLI 폴백 — catch 블록 안에서 Get-OllamaExe 로 실행 파일을 찾아
//   `& $exe stop $cfg.OLLAMA_MODEL` 로 재시도(API 실패 non-fatal, CLI 폴백).
function cliFallbackCatch(stop: string): boolean {
  const hasCatch = /catch\s*\{/.test(stop);
  const getExe = /\$exe\s*=\s*Get-OllamaExe/.test(stop);
  const fallbackStop = /&\s*\$exe\s+stop\s+\$cfg\.OLLAMA_MODEL/.test(stop);
  return hasCatch && getExe && fallbackStop;
}

// stopServerBranch(stop): `-StopServer` 서버 종료 분기 — `if ($StopServer)` 가드 → Get-Process -Name 'ollama app','ollama'
//   … | Stop-Process -Force(서버 프로세스 종료) + `else`(서버 유지 안내) 양쪽 존재.
function stopServerBranch(stop: string): boolean {
  const guard = /if\s*\(\s*\$StopServer\s*\)/.test(stop);
  const getProcess = /Get-Process\s+-Name\s+'ollama app',\s*'ollama'/.test(
    stop,
  );
  const stopProcess = /Stop-Process\s+-Force/.test(stop);
  const elseBranch = /}\s*else\s*\{/.test(stop);
  return guard && getProcess && stopProcess && elseBranch;
}

// (집계) extractStopAnchors(stop, config, common): 자원 해제 스크립트 내부 계약 불변식을 한 번에 집계 —
//   하나라도 부재/변질이면 명시적 false(빈 결과 성공-위장 0).
function extractStopAnchors(
  stop: string,
  config: string,
  common: string,
): {
  configSourced: boolean;
  noConfigLiteralHardcoded: boolean;
  dotSource: boolean;
  helperSymbolsWired: boolean;
  cmdletBinding: boolean;
  singleSwitch: boolean;
  apiBaseSourced: boolean;
  serverDownReturn: boolean;
  unloadBody: boolean;
  unloadPost: boolean;
  cliFallback: boolean;
  stopServer: boolean;
} {
  // config-sourced: 2 키 모두 $cfg.<KEY> 참조.
  const configSourced = CONFIG_SOURCED_KEYS.every((k) =>
    configSourcedRef(stop, k),
  );
  // 하드코딩 금지: config.env active 값 literal 이 stop 본문에 등장하지 않음.
  const noConfigLiteralHardcoded = CONFIG_SOURCED_KEYS.every((k) => {
    const literal = configValue(config, k);
    return literal !== undefined && !configLiteralHardcoded(stop, literal);
  });
  // 헬퍼 심볼 배선: stop 이 호출하는 심볼이 각각 _common.ps1 에 function 정의로 실존.
  const helperSymbolsWired = CONSUMED_HELPER_SYMBOLS.every(
    (s) => helperSymbolConsumed(stop, s) && helperSymbolDefined(common, s),
  );
  const switches = switchParams(stop);
  const singleSwitch =
    switches.length === EXPECTED_SWITCHES.length &&
    EXPECTED_SWITCHES.every((s) => switches.includes(s));
  return {
    configSourced,
    noConfigLiteralHardcoded,
    dotSource: dotSourceRelative(stop),
    helperSymbolsWired,
    cmdletBinding: cmdletBindingPresent(stop),
    singleSwitch,
    apiBaseSourced: apiBaseConfigSourced(stop),
    serverDownReturn: serverDownEarlyReturn(stop),
    unloadBody: unloadBodyContract(stop),
    unloadPost: unloadPostWiring(stop),
    cliFallback: cliFallbackCatch(stop),
    stopServer: stopServerBranch(stop),
  };
}

describe("realdata-e2e §108/§109 deploy/local-llm-example/stop-llm.ps1 모델 언로드+서버종료+CLI 폴백 스크립트 내부 계약 smoke — config-sourced 값 참조(하드코딩 금지, 1순위) + _common.ps1 dot-source·헬퍼 심볼 배선 + CmdletBinding 1-switch(-StopServer) + 서버 미기동 early-return skip 분기 + 언로드 body(model config-sourced·keep_alive=0) POST /api/generate 배선 + API 실패 CLI 폴백(Get-OllamaExe → & $exe stop) + -StopServer 서버 종료/else 유지 분기 + secret-safety (T-0971)", () => {
  const stop = () => readFileSync(STOP_PS1_PATH, "utf8");
  const config = () => readFileSync(CONFIG_ENV_PATH, "utf8");
  const common = () => readFileSync(COMMON_PS1_PATH, "utf8");

  describe("Happy-path: 대조 artifact 3종 실존 + 12 불변식 전부 true", () => {
    it("stop-llm.ps1·config.env·_common.ps1 가 repo-root 기준 실존(existsSync)", () => {
      expect(existsSync(STOP_PS1_PATH)).toBe(true);
      expect(existsSync(CONFIG_ENV_PATH)).toBe(true);
      expect(existsSync(COMMON_PS1_PATH)).toBe(true);
    });

    it("12 불변식(config-sourced·하드코딩금지·dot-source·헬퍼배선·CmdletBinding·1-switch·api base sourced·서버 미기동 return·언로드 body·언로드 POST·CLI 폴백·-StopServer 분기) 전부 true", () => {
      const anchors = extractStopAnchors(stop(), config(), common());
      expect(Object.values(anchors).every((v) => v === true)).toBe(true);
    });
  });

  describe("Happy-path(1순위 계약): config-sourced 값 참조($cfg.<KEY>) + config 값 literal 하드코딩 부재(키당 1+)", () => {
    it("언로드 body model 을 $cfg.OLLAMA_MODEL 로 참조하고 gemma4:12b literal 을 하드코딩하지 않음", () => {
      const s = stop();
      expect(configSourcedRef(s, "OLLAMA_MODEL")).toBe(true);
      expect(configLiteralHardcoded(s, CONFIG_LITERALS.OLLAMA_MODEL)).toBe(
        false,
      );
      // config.env 가 그 값의 정본(byte 근거).
      expect(configValue(config(), "OLLAMA_MODEL")).toBe(
        CONFIG_LITERALS.OLLAMA_MODEL,
      );
    });

    it("api base 를 Get-LocalApiBase -OllamaHost $cfg.OLLAMA_HOST 로 얻고 127.0.0.1:11434 literal 을 하드코딩하지 않음", () => {
      const s = stop();
      expect(configSourcedRef(s, "OLLAMA_HOST")).toBe(true);
      expect(apiBaseConfigSourced(s)).toBe(true);
      expect(configLiteralHardcoded(s, CONFIG_LITERALS.OLLAMA_HOST)).toBe(
        false,
      );
      expect(configValue(config(), "OLLAMA_HOST")).toBe(
        CONFIG_LITERALS.OLLAMA_HOST,
      );
    });

    it("CLI 폴백 인자도 $cfg.OLLAMA_MODEL 로 참조(하드코딩 아님)", () => {
      const s = stop();
      expect(/&\s*\$exe\s+stop\s+\$cfg\.OLLAMA_MODEL/.test(s)).toBe(true);
      expect(configLiteralHardcoded(s, CONFIG_LITERALS.OLLAMA_MODEL)).toBe(
        false,
      );
    });

    it("2종 전부 config-sourced 참조 + 하드코딩 부재(집계 true)", () => {
      const anchors = extractStopAnchors(stop(), config(), common());
      expect(anchors.configSourced).toBe(true);
      expect(anchors.noConfigLiteralHardcoded).toBe(true);
      expect(anchors.apiBaseSourced).toBe(true);
    });
  });

  describe("Happy-path: _common.ps1 dot-source(상대경로) + 호출 헬퍼 심볼 4종이 function 정의로 실존(dead 호출 0)", () => {
    it("stop-llm.ps1 이 _common.ps1 을 상대경로로 dot-source", () => {
      const s = stop();
      expect(dotSourceRelative(s)).toBe(true);
      expect(s).toContain("Split-Path -Parent $MyInvocation.MyCommand.Path");
      expect(s).toContain("'_common.ps1'");
    });

    it("stop-llm.ps1 이 호출하는 헬퍼 심볼 4종(Get-LlmConfig·Get-LocalApiBase·Test-OllamaServer·Get-OllamaExe)이 각각 _common.ps1 에 function 정의로 실존", () => {
      const s = stop();
      const c = common();
      CONSUMED_HELPER_SYMBOLS.forEach((sym) => {
        expect(helperSymbolConsumed(s, sym)).toBe(true);
        expect(helperSymbolDefined(c, sym)).toBe(true);
      });
      expect(extractStopAnchors(s, config(), c).helperSymbolsWired).toBe(true);
    });
  });

  describe("Happy-path: CmdletBinding + 1-switch param 계약", () => {
    it("[CmdletBinding()] 존재 + [switch]$StopServer 정확히 1 switch(그 외 switch 없음)", () => {
      const s = stop();
      expect(cmdletBindingPresent(s)).toBe(true);
      const switches = switchParams(s);
      expect(switches).toHaveLength(1);
      expect(switches).toContain("StopServer");
      expect(extractStopAnchors(s, config(), common()).singleSwitch).toBe(true);
    });
  });

  describe("Flow/branch cover: 서버 미기동 early-return skip 분기(if (-not (Test-OllamaServer -ApiBase $apiBase)) → Write-Host + return, 언로드 코드 미도달)", () => {
    it("if (-not (Test-OllamaServer -ApiBase $apiBase)) 가드 이후 언로드 body($body) 앞에 return early-exit 존재", () => {
      const s = stop();
      expect(serverDownEarlyReturn(s)).toBe(true);
      expect(
        /if\s*\(-not\s*\(Test-OllamaServer\s+-ApiBase\s+\$apiBase\)\)/.test(s),
      ).toBe(true);
      // return 위치가 서버 미기동 가드 뒤 · 언로드 body 앞(언로드 skip).
      const guardAt = s.search(
        /if\s*\(-not\s*\(Test-OllamaServer\s+-ApiBase\s+\$apiBase\)\)/,
      );
      const returnAt = s.search(/(^|\n)\s*return\b/);
      const bodyAt = s.indexOf("$body");
      expect(returnAt).toBeGreaterThan(guardAt);
      expect(returnAt).toBeLessThan(bodyAt);
    });
  });

  describe("Flow/branch cover: 언로드 body 2 필드(model config-sourced·keep_alive=0) + POST /api/generate 배선", () => {
    it("body @{ model=$cfg.OLLAMA_MODEL; keep_alive=0 } ConvertTo-Json", () => {
      const s = stop();
      expect(unloadBodyContract(s)).toBe(true);
      expect(/model\s*=\s*\$cfg\.OLLAMA_MODEL\b/.test(s)).toBe(true);
      expect(/keep_alive\s*=\s*0\s*\}/.test(s)).toBe(true);
      expect(s).toContain("ConvertTo-Json");
    });

    it("Invoke-RestMethod -Uri \"$apiBase/api/generate\" -Method Post -ContentType 'application/json' -TimeoutSec 30 배선", () => {
      const s = stop();
      expect(unloadPostWiring(s)).toBe(true);
      expect(
        /Invoke-RestMethod\s+-Uri\s+"\$apiBase\/api\/generate"/.test(s),
      ).toBe(true);
      expect(/-Method\s+Post\b/.test(s)).toBe(true);
      expect(/-ContentType\s+'application\/json'/.test(s)).toBe(true);
      expect(/-TimeoutSec\s+30\b/.test(s)).toBe(true);
    });
  });

  describe("Flow/branch cover: API 실패 CLI 폴백(catch { ...; $exe = Get-OllamaExe; if ($exe) { & $exe stop $cfg.OLLAMA_MODEL } })", () => {
    it("catch 블록 안 Get-OllamaExe 로 실행 파일 탐색 → & $exe stop $cfg.OLLAMA_MODEL 로 CLI 재시도", () => {
      const s = stop();
      expect(cliFallbackCatch(s)).toBe(true);
      expect(/catch\s*\{/.test(s)).toBe(true);
      expect(/\$exe\s*=\s*Get-OllamaExe/.test(s)).toBe(true);
      expect(/&\s*\$exe\s+stop\s+\$cfg\.OLLAMA_MODEL/.test(s)).toBe(true);
    });
  });

  describe("Flow/branch cover: -StopServer 서버 종료 분기(if ($StopServer) → Get-Process | Stop-Process -Force) + else 서버 유지", () => {
    it("if ($StopServer) → Get-Process -Name 'ollama app','ollama' | Stop-Process -Force + else(서버 유지 안내) 양쪽 존재", () => {
      const s = stop();
      expect(stopServerBranch(s)).toBe(true);
      expect(/if\s*\(\s*\$StopServer\s*\)/.test(s)).toBe(true);
      expect(/Get-Process\s+-Name\s+'ollama app',\s*'ollama'/.test(s)).toBe(
        true,
      );
      expect(/Stop-Process\s+-Force/.test(s)).toBe(true);
      expect(/}\s*else\s*\{/.test(s)).toBe(true);
    });
  });

  describe("Error path / negative cases 충분 cover (mutant 합성 사본 — 원본 미변조, 예외 분기마다 각 1+)", () => {
    it("error path — 대조 artifact 부재 경로 → readFileSync throw(silent 0-byte fallback 0)", () => {
      const badPath = path.join(LLM_DIR, "__does_not_exist___stop-llm.ps1");
      expect(existsSync(badPath)).toBe(false);
      expect(() => readFileSync(badPath, "utf8")).toThrow();
    });

    it("error path — 앵커 토큰 부재 시 명시적 false(빈 매칭을 pass 로 오통과 0)", () => {
      const anchors = extractStopAnchors("", "", "");
      expect(Object.values(anchors).some((v) => v === true)).toBe(false);
      // 실 소스는 반대로 전부 true — 부재/실재 변별.
      const real = extractStopAnchors(stop(), config(), common());
      expect(Object.values(real).every((v) => v === true)).toBe(true);
    });

    it("negative (a) — config 값 gemma4:12b 를 언로드 body 에 literal 로 하드코딩한 mutant → config-sourced 값 계약(하드코딩 금지) 위반 검출", () => {
      const s = stop();
      const mutant = s.replace(
        "model = $cfg.OLLAMA_MODEL",
        "model = 'gemma4:12b'",
      );
      expect(configLiteralHardcoded(mutant, "gemma4:12b")).toBe(true);
      expect(
        extractStopAnchors(mutant, config(), common()).noConfigLiteralHardcoded,
      ).toBe(false);
      expect(unloadBodyContract(mutant)).toBe(false);
      // 원본 불변.
      expect(configLiteralHardcoded(s, "gemma4:12b")).toBe(false);
    });

    it("negative (b) — dot-source 행을 절대경로/타 파일로 바꾼 mutant → dot-source 상대경로 계약 drift 검출", () => {
      const s = stop();
      const mutant = s.replace(
        ". (Join-Path (Split-Path -Parent $MyInvocation.MyCommand.Path) '_common.ps1')",
        ". C:\\ollama\\helpers.ps1",
      );
      expect(dotSourceRelative(mutant)).toBe(false);
      expect(extractStopAnchors(mutant, config(), common()).dotSource).toBe(
        false,
      );
      // 원본 불변.
      expect(dotSourceRelative(s)).toBe(true);
    });

    it("negative (c) — 서버 미기동 분기의 return early-exit 를 제거(꺼진 서버에도 언로드 진행)한 mutant → skip 분기 drift 검출", () => {
      const s = stop();
      const mutant = s.replace(/^\s*return\s*$/m, "");
      expect(serverDownEarlyReturn(mutant)).toBe(false);
      expect(
        extractStopAnchors(mutant, config(), common()).serverDownReturn,
      ).toBe(false);
      // 원본 불변.
      expect(serverDownEarlyReturn(s)).toBe(true);
    });

    it("negative (d) — 언로드 body 의 keep_alive = 0 을 keep_alive = '5m' 로 바꾼 mutant → 즉시 VRAM 해제 계약 drift 검출", () => {
      const s = stop();
      const mutant = s.replace("keep_alive = 0", "keep_alive = '5m'");
      expect(/keep_alive\s*=\s*0\s*\}/.test(mutant)).toBe(false);
      expect(unloadBodyContract(mutant)).toBe(false);
      expect(extractStopAnchors(mutant, config(), common()).unloadBody).toBe(
        false,
      );
      // 원본 불변.
      expect(unloadBodyContract(s)).toBe(true);
    });

    it("negative (e) — catch 의 CLI 폴백(& $exe stop $cfg.OLLAMA_MODEL)을 제거한 mutant → API 실패 폴백 계약 drift 검출", () => {
      const s = stop();
      const mutant = s.replace(
        "if ($exe) { & $exe stop $cfg.OLLAMA_MODEL 2>$null }",
        "if ($exe) { }",
      );
      expect(/&\s*\$exe\s+stop\s+\$cfg\.OLLAMA_MODEL/.test(mutant)).toBe(false);
      expect(cliFallbackCatch(mutant)).toBe(false);
      expect(extractStopAnchors(mutant, config(), common()).cliFallback).toBe(
        false,
      );
      // 원본 불변.
      expect(cliFallbackCatch(s)).toBe(true);
    });

    it("negative (f) — -StopServer 분기의 Stop-Process -Force 를 제거한 mutant → 서버 종료 분기 drift 검출", () => {
      const s = stop();
      const mutant = s.replace(
        "Stop-Process -Force -ErrorAction SilentlyContinue",
        "Out-Null",
      );
      expect(/Stop-Process\s+-Force/.test(mutant)).toBe(false);
      expect(stopServerBranch(mutant)).toBe(false);
      expect(extractStopAnchors(mutant, config(), common()).stopServer).toBe(
        false,
      );
      // 원본 불변.
      expect(stopServerBranch(s)).toBe(true);
    });

    it("negative (g) — stop-llm.ps1 이 호출하는 Test-OllamaServer 를 _common.ps1 정의에서 제거한 합성 mutant → dead 호출(심볼 소비 계약) 검출", () => {
      const s = stop();
      const c = common();
      const mutantCommon = c.replace(
        /function\s+Test-OllamaServer\b/,
        "function Test-SomethingElse",
      );
      expect(helperSymbolConsumed(s, "Test-OllamaServer")).toBe(true); // stop 은 여전히 호출.
      expect(helperSymbolDefined(mutantCommon, "Test-OllamaServer")).toBe(
        false,
      ); // 정의는 사라짐 → dead 호출.
      expect(
        extractStopAnchors(s, config(), mutantCommon).helperSymbolsWired,
      ).toBe(false);
      // 원본 불변.
      expect(helperSymbolDefined(c, "Test-OllamaServer")).toBe(true);
    });

    it("negative — §9 credential/secret 누출 0: 추출/합성 토큰에 gh 토큰 어휘·실 credential·실 password·apiKey 값 미등장(§9/REQ-059)", () => {
      const synthesized = [
        JSON.stringify(extractStopAnchors(stop(), config(), common())),
        ...CONFIG_SOURCED_KEYS.map((k) => String(configValue(config(), k))),
        switchParams(stop()).join(","),
        CONSUMED_HELPER_SYMBOLS.join(","),
      ];
      const strongPattern =
        /(ghp_|--token|GITHUB_TOKEN|GH_TOKEN|\bBearer\b|Authorization|\bsk-|PASSWORD=|apiKey"?\s*[:=]\s*["']?\w)/i;
      synthesized.forEach((v) => {
        expect(strongPattern.test(v)).toBe(false);
      });
      // 합성 mutant 값도 명백한 dummy(하드코딩 gemma4:12b/5m literal·타 파일 경로 C:\ollama\helpers.ps1 등)로 한정 — 실 자격 0.
      const dummies = ["gemma4:12b", "5m", "C:\\ollama\\helpers.ps1"];
      dummies.forEach((d) => expect(strongPattern.test(d)).toBe(false));
      // 추출 값은 모두 비시크릿 설정 값/경로(bind 주소·모델 tag·endpoint·프로세스명).
      expect(configValue(config(), "OLLAMA_HOST")).toBe("127.0.0.1:11434");
      expect(stop()).toContain("$apiBase/api/generate");
      expect(stop()).toContain("'ollama app', 'ollama'");
    });
  });

  describe("branch: 각 정본 앵커 일치/drift 정적 대조(합성 mutant 사본 — 원본 미변조)", () => {
    it("config-sourced 값 계약 일치/drift 분기", () => {
      const s = stop();
      expect(
        extractStopAnchors(s, config(), common()).noConfigLiteralHardcoded,
      ).toBe(true);
      const mutant = s.replace(
        "$apiBase = Get-LocalApiBase -OllamaHost $cfg.OLLAMA_HOST",
        "$apiBase = Get-LocalApiBase -OllamaHost 127.0.0.1:11434",
      );
      expect(
        extractStopAnchors(mutant, config(), common()).noConfigLiteralHardcoded,
      ).toBe(false);
      expect(apiBaseConfigSourced(mutant)).toBe(false);
    });

    it("헬퍼 심볼 배선 일치/drift 분기", () => {
      const c = common();
      expect(extractStopAnchors(stop(), config(), c).helperSymbolsWired).toBe(
        true,
      );
      const mutant = c.replace(
        /function\s+Get-OllamaExe\b/,
        "function Get-Nothing",
      );
      expect(
        extractStopAnchors(stop(), config(), mutant).helperSymbolsWired,
      ).toBe(false);
    });
  });

  describe("flow: 결정론 · no-mutation(원본 read-only 입증)", () => {
    it("동일 입력으로 pure 함수를 두 번 호출하면 deep-equal(결정론)", () => {
      const s = stop();
      const cfg = config();
      const c = common();
      expect(extractStopAnchors(s, cfg, c)).toEqual(
        extractStopAnchors(s, cfg, c),
      );
      expect(switchParams(s)).toEqual(switchParams(s));
    });

    it("합성 mutate(사본 replace) 후에도 원본 소스 텍스트·pure 함수 산출이 불변(원본 read-only)", () => {
      const s = stop();
      const cfg = config();
      const c = common();
      const sSnap = s;
      const cfgSnap = cfg;
      const cSnap = c;
      // 사본 mutate(negative a~g 에서 쓰는 replace) — 원본 불변 확인.
      s.replace("model = $cfg.OLLAMA_MODEL", "model = 'gemma4:12b'");
      s.replace("keep_alive = 0", "keep_alive = '5m'");
      s.replace(/^\s*return\s*$/m, "");
      s.replace(
        "if ($exe) { & $exe stop $cfg.OLLAMA_MODEL 2>$null }",
        "if ($exe) { }",
      );
      c.replace(
        /function\s+Test-OllamaServer\b/,
        "function Test-SomethingElse",
      );
      expect(s).toBe(sSnap);
      expect(cfg).toBe(cfgSnap);
      expect(c).toBe(cSnap);
      // 추출/파싱 후에도 원본 불변.
      extractStopAnchors(s, cfg, c);
      expect(s).toBe(sSnap);
      expect(c).toBe(cSnap);
    });
  });

  describe("dormant / non-gated 확인 — side-effect 0", () => {
    it("계약 모델이 env / 전역 상태 없이 순수하게 동작(non-gated — describe.skip 0·gating 분기 0)", () => {
      // 본 describe 가 실행된다는 것 자체가 describe.skip 0(항상 실행)의 런타임 증거.
      const envSnapshot = { ...process.env };
      const s = stop();
      const before = switchParams(s);
      // 실 process.env 를 mutate 해도 산출 불변 — 모델이 process.env 를 참조하지 않음(파라미터로만).
      Object.assign(process.env, { LOCAL_LLM_STOP_PS1_UNIT_TEST: "x" });
      const after = switchParams(s);
      delete process.env.LOCAL_LLM_STOP_PS1_UNIT_TEST;
      expect(after).toEqual(before);
      expect(Object.keys(process.env)).toEqual(Object.keys(envSnapshot));
    });

    it("파일 read 는 stop-llm.ps1/config.env/_common.ps1 읽기만 — 실 PowerShell/실 Ollama/실 HTTP POST/실 Stop-Process 0. 세 파일은 선언적 스크립트·설정이라 런타임 분기 없이 정적 소스 텍스트 앵커로 happy/negative mutant 로 대체 cover", () => {
      const anchors = extractStopAnchors(stop(), config(), common());
      expect(Object.values(anchors).every((v) => v === true)).toBe(true);
    });
  });
});
