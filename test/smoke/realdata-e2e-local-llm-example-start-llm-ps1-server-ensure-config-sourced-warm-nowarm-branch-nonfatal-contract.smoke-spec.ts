// realdata-e2e-local-llm-example-start-llm-ps1-server-ensure-config-sourced-warm-nowarm-branch-nonfatal-contract.smoke-spec.ts
// — 로컬 Ollama live-LLM 운영 premise leg 후속. T-0966 이 `config.env`(LLM 호스트측 설정 정본)·T-0967 이 그 config 를
// 코드로 소비하는 공용 헬퍼 `_common.ps1`(모든 로컬 LLM 스크립트가 dot-source 하는 single-source 헬퍼)·T-0968 이 운영자
// README·T-0969 가 1순위 설치 진입점 `install.ps1` 을 봉했다. 본 task 는 운영자가 설치 후 **곧바로 쓰려고 서버를 세우고
// 모델을 예열하는 2순위 진입점** `deploy/local-llm-example/start-llm.ps1`(그 _common.ps1 을 dot-source 해 config 정본을
// 읽고 서버 보장 기동→모델 예열(POST /api/generate)을 수행하는 스크립트) 의 내부 계약을 세 실 파일(start-llm.ps1·
// config.env·_common.ps1)을 readFileSync 로 읽어(실 PowerShell 실행/실 Ollama 기동·예열/실 HTTP POST 0) 정적 검증하는
// non-gated smoke (T-0970, PLAN.md §108/§109 재배포 runner chain — LLM 호스트측 운영 진입점 leg).
//
// 봉함 불변식(핵심 위험 = 기동/예열 계약 drift):
//   (1) config-sourced 값 계약(1순위): start-llm.ps1 이 예열 body 의 model/keep_alive 를 `$cfg.OLLAMA_MODEL`·
//       `$cfg.OLLAMA_KEEP_ALIVE`(=Get-LlmConfig 결과)로, api base 를 `Get-LocalApiBase -OllamaHost $cfg.OLLAMA_HOST`
//       로 참조하고, `gemma4:12b`·`127.0.0.1:11434`·`5m` 같은 config 값 literal 을 본문에 하드코딩하지 않음. 하드코딩 시
//       config.env 정본(T-0966)과 조용히 divergence.
//   (2) dot-source 계약: start-llm.ps1 이 `_common.ps1` 을 상대 경로(`Split-Path -Parent $MyInvocation...` +
//       `Join-Path ... '_common.ps1'`)로 dot-source 하고, 호출 헬퍼 심볼(Get-LlmConfig·Get-LocalApiBase·
//       Start-OllamaServerIfNeeded)이 각각 _common.ps1 에 function 정의로 실존(dead 호출 0).
//   (3) CmdletBinding + 1-switch param 계약: `[CmdletBinding()]` + `[switch]$NoWarm` 정확히 1 switch.
//   (4) 서버 보장 기동 fail-fast: `Start-OllamaServerIfNeeded -ApiBase $apiBase -TimeoutSec 40` 이 false 면
//       `if (-not (...))` → `throw`(install.ps1 선행 실행 안내). fail-fast 누락 시 죽은 서버 위에서 예열 오진단.
//   (5) `-NoWarm` early-return skip 분기: `if ($NoWarm)` → Write-Host 예열 생략 안내 + `return`(예열 코드 미도달).
//       early-return 누락 시 -NoWarm 무시돼 불필요 예열.
//   (6) 예열 body 계약: `@{ model=$cfg.OLLAMA_MODEL; prompt='ok'; stream=$false; keep_alive=$cfg.OLLAMA_KEEP_ALIVE }`
//       `ConvertTo-Json` → `Invoke-RestMethod -Uri "$apiBase/api/generate" -Method Post -ContentType 'application/json'
//       -TimeoutSec 300` POST 배선. model/keep_alive 는 config-sourced, prompt 는 최소 'ok', stream 은 $false.
//   (7) 예열 실패 non-fatal: `try { ... } catch { Write-Warning ... }`(예열 실패가 throw/exit 로 치명화되지 않고 경고 후
//       진행/종료, 모델 pull 재확인 안내). 치명화 시 서버는 떠 있는데 운영 진입 차단.
//
// 전략(형제 T-0969 install.ps1·T-0967 _common.ps1·T-0966 config.env 동형): 세 실 파일에서 정본 토큰/시퀀스를 정적
// 추출하는 해석 동형 TS 순수 함수(configSourcedRef·configLiteralHardcoded·dotSourceRelative·helperSymbolDefined·
// cmdletBindingPresent·switchParams·apiBaseConfigSourced·serverEnsureFailFast·noWarmEarlyReturn·warmBodyContract·
// warmPostWiring·warmNonFatalCatch·extractStartAnchors)로 계약을 assert. 합성 mutant 사본으로 negative(a~g 7종)
// 변별. T-0966/T-0967(config.env·_common.ps1 자체 계약) 와 distinct — 본 task 는 start-llm.ps1 이 그 config/헬퍼를
// **소비/배선**하는 기동/예열 계약만.
//   🔥 실 PowerShell 실행 0 · 실 Ollama 기동/예열 0 · 실 HTTP POST/실 Invoke-RestMethod 0 ·
//      process.env 읽기 0(입력은 pure 함수 파라미터) · credential 0(§9/REQ-059) · 새 dep 0(node fs/path) ·
//      src 변경 0(test-only) · start-llm.ps1/config.env/_common.ps1 읽기만(실행 0 · 변경 0).
import { existsSync, readFileSync } from "fs";
import * as path from "path";

// repo-root 경로 — test 실행 cwd 무관하게 robust 하게 해석(`__dirname` = test/smoke,
// 두 단계 위가 repo-root). `process.cwd()` 대신 `__dirname` 기준 상대로 고정(sibling T-0967/T-0969).
const REPO_ROOT = path.resolve(__dirname, "../..");
const LLM_DIR = path.join(REPO_ROOT, "deploy", "local-llm-example");
const START_PS1_PATH = path.join(LLM_DIR, "start-llm.ps1");
const CONFIG_ENV_PATH = path.join(LLM_DIR, "config.env");
const COMMON_PS1_PATH = path.join(LLM_DIR, "_common.ps1");

// 정본 앵커(실 artifact 표현의 TS mirror — 실 PowerShell/실 Ollama 0).
// start-llm.ps1 이 config-sourced 로 참조해야 하는 값(하드코딩 금지 대상) — config.env 정본이 근거.
const CONFIG_SOURCED_KEYS = [
  "OLLAMA_MODEL",
  "OLLAMA_HOST",
  "OLLAMA_KEEP_ALIVE",
]; // start-llm.ps1 이 $cfg.<KEY> 로 참조해야 하는 3종.
// 위 키의 config.env active 값 — start-llm.ps1 본문에 literal 로 등장하면 divergence 위험(하드코딩 검출 대상).
const CONFIG_LITERALS: Record<string, string> = {
  OLLAMA_MODEL: "gemma4:12b",
  OLLAMA_HOST: "127.0.0.1:11434",
  OLLAMA_KEEP_ALIVE: "5m",
};
// start-llm.ps1 이 dot-source 후 호출하는 헬퍼 심볼 — 각각 _common.ps1 에 function 정의로 실존해야(dead 호출 0).
const CONSUMED_HELPER_SYMBOLS = [
  "Get-LlmConfig",
  "Get-LocalApiBase",
  "Start-OllamaServerIfNeeded",
];
// param 블록 1 switch.
const EXPECTED_SWITCHES = ["NoWarm"];

// ── TS 동형 pure 함수(정본) — start-llm.ps1 / config.env / _common.ps1 의 정본 토큰/시퀀스를 모델링.
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

// configSourcedRef(start, key): start-llm.ps1 이 `$cfg.<KEY>` 로 config-sourced 참조를 하는가(소스 리터럴 존재).
function configSourcedRef(start: string, key: string): boolean {
  return new RegExp(`\\$cfg\\.${key}\\b`).test(start);
}

// configLiteralHardcoded(start, literal): config 값 literal 이 start-llm.ps1 본문에 하드코딩됐는가(있으면 위반).
//   `$cfg.` 참조·Write-Host 포맷은 literal 이 아니라 참조이므로 걸리지 않는다 — 값 문자열 자체의 등장만 검출.
function configLiteralHardcoded(start: string, literal: string): boolean {
  return start.includes(literal);
}

// dotSourceRelative(start): _common.ps1 을 상대 경로로 dot-source 하는가(Split-Path -Parent + Join-Path + '_common.ps1').
function dotSourceRelative(start: string): boolean {
  const hasDotSource = /^\s*\.\s+\(Join-Path/m.test(start);
  const hasScriptDir = start.includes(
    "Split-Path -Parent $MyInvocation.MyCommand.Path",
  );
  const hasCommonRef = start.includes("'_common.ps1'");
  return hasDotSource && hasScriptDir && hasCommonRef;
}

// helperSymbolDefined(common, symbol): 헬퍼 심볼이 _common.ps1 에 `function <symbol>` 정의로 실존하는가.
function helperSymbolDefined(common: string, symbol: string): boolean {
  return new RegExp(`function\\s+${symbol}\\b`, "i").test(common);
}

// helperSymbolConsumed(start, symbol): start-llm.ps1 이 그 헬퍼 심볼을 호출/참조하는가.
function helperSymbolConsumed(start: string, symbol: string): boolean {
  return new RegExp(`\\b${symbol}\\b`).test(start);
}

// cmdletBindingPresent(start): `[CmdletBinding()]` 어트리뷰트가 소스에 존재하는가.
function cmdletBindingPresent(start: string): boolean {
  return start.includes("[CmdletBinding()]");
}

// switchParams(start): param 블록에 선언된 `[switch]$Name` 스위치 이름 목록(등장 순).
function switchParams(start: string): string[] {
  const out: string[] = [];
  const re = /\[switch\]\$(\w+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(start)) !== null) out.push(m[1]);
  return out;
}

// apiBaseConfigSourced(start): api base 를 `Get-LocalApiBase -OllamaHost $cfg.OLLAMA_HOST` 로 config-sourced 하게 얻는가.
function apiBaseConfigSourced(start: string): boolean {
  return /Get-LocalApiBase\s+-OllamaHost\s+\$cfg\.OLLAMA_HOST/.test(start);
}

// serverEnsureFailFast(start): 서버 보장 기동 fail-fast — `Start-OllamaServerIfNeeded -ApiBase $apiBase -TimeoutSec 40`
//   호출을 `if (-not (...))` 로 감싸 false 면 `throw`(install.ps1 선행 안내). 호출·guard·throw 존재 + guard 가 throw 앞.
function serverEnsureFailFast(start: string): boolean {
  const call =
    /Start-OllamaServerIfNeeded\s+-ApiBase\s+\$apiBase\s+-TimeoutSec\s+40/;
  const guard = /if\s*\(-not\s*\(Start-OllamaServerIfNeeded/;
  const hasThrow = /throw\b/;
  if (!call.test(start) || !guard.test(start) || !hasThrow.test(start)) {
    return false;
  }
  const guardAt = start.search(/if\s*\(-not\s*\(Start-OllamaServerIfNeeded/);
  const throwAt = start.search(/throw\b/);
  return guardAt >= 0 && throwAt >= 0 && guardAt < throwAt;
}

// noWarmEarlyReturn(start): `-NoWarm` early-return skip 분기 — `if ($NoWarm)` 가드 이후, 예열 body(`$body`) 앞에
//   `return`(early-exit) 이 존재. 이 return 이 예열 코드를 skip 하게 한다.
function noWarmEarlyReturn(start: string): boolean {
  const guardAt = start.search(/if\s*\(\s*\$NoWarm\s*\)/);
  if (guardAt < 0) return false;
  const bodyAt = start.indexOf("$body");
  const re = /(^|\n)\s*return\b/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(start)) !== null) {
    const idx = m.index;
    if (idx > guardAt && (bodyAt < 0 || idx < bodyAt)) return true;
  }
  return false;
}

// warmBodyContract(start): 예열 body hashtable 4 필드 — model=$cfg.OLLAMA_MODEL · prompt='ok' · stream=$false ·
//   keep_alive=$cfg.OLLAMA_KEEP_ALIVE + ConvertTo-Json. model/keep_alive 는 config-sourced, prompt 최소 'ok', stream $false.
function warmBodyContract(start: string): boolean {
  const model = /model\s*=\s*\$cfg\.OLLAMA_MODEL\b/.test(start);
  const prompt = /prompt\s*=\s*'ok'/.test(start);
  const stream = /stream\s*=\s*\$false\b/.test(start);
  const keepAlive = /keep_alive\s*=\s*\$cfg\.OLLAMA_KEEP_ALIVE\b/.test(start);
  const json = /ConvertTo-Json/.test(start);
  return model && prompt && stream && keepAlive && json;
}

// warmPostWiring(start): 예열 POST 배선 — Invoke-RestMethod 로 "$apiBase/api/generate" 에 -Method Post,
//   -ContentType 'application/json', -TimeoutSec 300.
function warmPostWiring(start: string): boolean {
  const uri = /Invoke-RestMethod\s+-Uri\s+"\$apiBase\/api\/generate"/.test(
    start,
  );
  const method = /-Method\s+Post\b/.test(start);
  const contentType = /-ContentType\s+'application\/json'/.test(start);
  const timeout = /-TimeoutSec\s+300\b/.test(start);
  return uri && method && contentType && timeout;
}

// warmNonFatalCatch(start): 예열 실패 non-fatal — try 블록 + catch 블록 안에서 Write-Warning(치명화 아닌 경고).
function warmNonFatalCatch(start: string): boolean {
  const hasTry = /\btry\s*\{/.test(start);
  const catchWarn = /catch\s*\{[^}]*Write-Warning/.test(start);
  return hasTry && catchWarn;
}

// (집계) extractStartAnchors(start, config, common): 기동/예열 스크립트 내부 계약 불변식을 한 번에 집계 —
//   하나라도 부재/변질이면 명시적 false(빈 결과 성공-위장 0).
function extractStartAnchors(
  start: string,
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
  serverFailFast: boolean;
  noWarmReturn: boolean;
  warmBody: boolean;
  warmPost: boolean;
  nonFatalCatch: boolean;
} {
  // config-sourced: 3 키 모두 $cfg.<KEY> 참조.
  const configSourced = CONFIG_SOURCED_KEYS.every((k) =>
    configSourcedRef(start, k),
  );
  // 하드코딩 금지: config.env active 값 literal 이 start 본문에 등장하지 않음.
  const noConfigLiteralHardcoded = CONFIG_SOURCED_KEYS.every((k) => {
    const literal = configValue(config, k);
    return literal !== undefined && !configLiteralHardcoded(start, literal);
  });
  // 헬퍼 심볼 배선: start 가 호출하는 심볼이 각각 _common.ps1 에 function 정의로 실존.
  const helperSymbolsWired = CONSUMED_HELPER_SYMBOLS.every(
    (s) => helperSymbolConsumed(start, s) && helperSymbolDefined(common, s),
  );
  const switches = switchParams(start);
  const singleSwitch =
    switches.length === EXPECTED_SWITCHES.length &&
    EXPECTED_SWITCHES.every((s) => switches.includes(s));
  return {
    configSourced,
    noConfigLiteralHardcoded,
    dotSource: dotSourceRelative(start),
    helperSymbolsWired,
    cmdletBinding: cmdletBindingPresent(start),
    singleSwitch,
    apiBaseSourced: apiBaseConfigSourced(start),
    serverFailFast: serverEnsureFailFast(start),
    noWarmReturn: noWarmEarlyReturn(start),
    warmBody: warmBodyContract(start),
    warmPost: warmPostWiring(start),
    nonFatalCatch: warmNonFatalCatch(start),
  };
}

describe("realdata-e2e §108/§109 deploy/local-llm-example/start-llm.ps1 서버 보장 기동+모델 예열 스크립트 내부 계약 smoke — config-sourced 값 참조(하드코딩 금지, 1순위) + _common.ps1 dot-source·헬퍼 심볼 배선 + CmdletBinding 1-switch(-NoWarm) + Start-OllamaServerIfNeeded fail-fast throw + -NoWarm early-return skip 분기 + 예열 body(model/keep_alive config-sourced·prompt 'ok'·stream false) POST /api/generate 배선 + 예열 실패 non-fatal Write-Warning + secret-safety (T-0970)", () => {
  const start = () => readFileSync(START_PS1_PATH, "utf8");
  const config = () => readFileSync(CONFIG_ENV_PATH, "utf8");
  const common = () => readFileSync(COMMON_PS1_PATH, "utf8");

  describe("Happy-path: 대조 artifact 3종 실존 + 12 불변식 전부 true", () => {
    it("start-llm.ps1·config.env·_common.ps1 가 repo-root 기준 실존(existsSync)", () => {
      expect(existsSync(START_PS1_PATH)).toBe(true);
      expect(existsSync(CONFIG_ENV_PATH)).toBe(true);
      expect(existsSync(COMMON_PS1_PATH)).toBe(true);
    });

    it("12 불변식(config-sourced·하드코딩금지·dot-source·헬퍼배선·CmdletBinding·1-switch·api base sourced·서버 fail-fast·-NoWarm return·예열 body·예열 POST·non-fatal catch) 전부 true", () => {
      const anchors = extractStartAnchors(start(), config(), common());
      expect(Object.values(anchors).every((v) => v === true)).toBe(true);
    });
  });

  describe("Happy-path(1순위 계약): config-sourced 값 참조($cfg.<KEY>) + config 값 literal 하드코딩 부재(키당 1+)", () => {
    it("예열 body model 을 $cfg.OLLAMA_MODEL 로 참조하고 gemma4:12b literal 을 하드코딩하지 않음", () => {
      const s = start();
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
      const s = start();
      expect(configSourcedRef(s, "OLLAMA_HOST")).toBe(true);
      expect(apiBaseConfigSourced(s)).toBe(true);
      expect(configLiteralHardcoded(s, CONFIG_LITERALS.OLLAMA_HOST)).toBe(
        false,
      );
      expect(configValue(config(), "OLLAMA_HOST")).toBe(
        CONFIG_LITERALS.OLLAMA_HOST,
      );
    });

    it("예열 body keep_alive 를 $cfg.OLLAMA_KEEP_ALIVE 로 참조하고 5m literal 을 하드코딩하지 않음", () => {
      const s = start();
      expect(configSourcedRef(s, "OLLAMA_KEEP_ALIVE")).toBe(true);
      // '5m' 는 짧아 오탐 위험 — config-sourced 참조가 존재하고 안커가 true 임으로 확인(하드코딩 아님).
      expect(
        extractStartAnchors(s, config(), common()).noConfigLiteralHardcoded,
      ).toBe(true);
      expect(configValue(config(), "OLLAMA_KEEP_ALIVE")).toBe(
        CONFIG_LITERALS.OLLAMA_KEEP_ALIVE,
      );
    });

    it("3종 전부 config-sourced 참조 + 하드코딩 부재(집계 true)", () => {
      const anchors = extractStartAnchors(start(), config(), common());
      expect(anchors.configSourced).toBe(true);
      expect(anchors.noConfigLiteralHardcoded).toBe(true);
      expect(anchors.apiBaseSourced).toBe(true);
    });
  });

  describe("Happy-path: _common.ps1 dot-source(상대경로) + 호출 헬퍼 심볼 3종이 function 정의로 실존(dead 호출 0)", () => {
    it("start-llm.ps1 이 _common.ps1 을 상대경로로 dot-source", () => {
      const s = start();
      expect(dotSourceRelative(s)).toBe(true);
      expect(s).toContain("Split-Path -Parent $MyInvocation.MyCommand.Path");
      expect(s).toContain("'_common.ps1'");
    });

    it("start-llm.ps1 이 호출하는 헬퍼 심볼 3종(Get-LlmConfig·Get-LocalApiBase·Start-OllamaServerIfNeeded)이 각각 _common.ps1 에 function 정의로 실존", () => {
      const s = start();
      const c = common();
      CONSUMED_HELPER_SYMBOLS.forEach((sym) => {
        expect(helperSymbolConsumed(s, sym)).toBe(true);
        expect(helperSymbolDefined(c, sym)).toBe(true);
      });
      expect(extractStartAnchors(s, config(), c).helperSymbolsWired).toBe(true);
    });
  });

  describe("Happy-path: CmdletBinding + 1-switch param 계약", () => {
    it("[CmdletBinding()] 존재 + [switch]$NoWarm 정확히 1 switch(그 외 switch 없음)", () => {
      const s = start();
      expect(cmdletBindingPresent(s)).toBe(true);
      const switches = switchParams(s);
      expect(switches).toHaveLength(1);
      expect(switches).toContain("NoWarm");
      expect(extractStartAnchors(s, config(), common()).singleSwitch).toBe(
        true,
      );
    });
  });

  describe("Flow/branch cover: 서버 보장 기동 fail-fast(Start-OllamaServerIfNeeded -TimeoutSec 40 → -not → throw)", () => {
    it("if (-not (Start-OllamaServerIfNeeded -ApiBase $apiBase -TimeoutSec 40)) → throw(install.ps1 선행 안내) 순서", () => {
      const s = start();
      expect(serverEnsureFailFast(s)).toBe(true);
      expect(
        /Start-OllamaServerIfNeeded\s+-ApiBase\s+\$apiBase\s+-TimeoutSec\s+40/.test(
          s,
        ),
      ).toBe(true);
      expect(/if\s*\(-not\s*\(Start-OllamaServerIfNeeded/.test(s)).toBe(true);
      expect(/throw\b/.test(s)).toBe(true);
    });
  });

  describe("Flow/branch cover: -NoWarm early-return skip 분기(if ($NoWarm) → Write-Host + return, 예열 코드 미도달)", () => {
    it("if ($NoWarm) 가드 이후 예열 body($body) 앞에 return early-exit 존재", () => {
      const s = start();
      expect(noWarmEarlyReturn(s)).toBe(true);
      expect(/if\s*\(\s*\$NoWarm\s*\)/.test(s)).toBe(true);
      // return 위치가 -NoWarm 가드 뒤 · 예열 body 앞(예열 skip).
      const guardAt = s.search(/if\s*\(\s*\$NoWarm\s*\)/);
      const returnAt = s.search(/(^|\n)\s*return\b/);
      const bodyAt = s.indexOf("$body");
      expect(returnAt).toBeGreaterThan(guardAt);
      expect(returnAt).toBeLessThan(bodyAt);
    });
  });

  describe("Flow/branch cover: 예열 body 4 필드(model/keep_alive config-sourced·prompt 'ok'·stream false) + POST /api/generate 배선", () => {
    it("body @{ model=$cfg.OLLAMA_MODEL; prompt='ok'; stream=$false; keep_alive=$cfg.OLLAMA_KEEP_ALIVE } ConvertTo-Json", () => {
      const s = start();
      expect(warmBodyContract(s)).toBe(true);
      expect(/model\s*=\s*\$cfg\.OLLAMA_MODEL\b/.test(s)).toBe(true);
      expect(/prompt\s*=\s*'ok'/.test(s)).toBe(true);
      expect(/stream\s*=\s*\$false\b/.test(s)).toBe(true);
      expect(/keep_alive\s*=\s*\$cfg\.OLLAMA_KEEP_ALIVE\b/.test(s)).toBe(true);
      expect(s).toContain("ConvertTo-Json");
    });

    it("Invoke-RestMethod -Uri \"$apiBase/api/generate\" -Method Post -ContentType 'application/json' -TimeoutSec 300 배선", () => {
      const s = start();
      expect(warmPostWiring(s)).toBe(true);
      expect(
        /Invoke-RestMethod\s+-Uri\s+"\$apiBase\/api\/generate"/.test(s),
      ).toBe(true);
      expect(/-Method\s+Post\b/.test(s)).toBe(true);
      expect(/-ContentType\s+'application\/json'/.test(s)).toBe(true);
      expect(/-TimeoutSec\s+300\b/.test(s)).toBe(true);
    });
  });

  describe("Flow/branch cover: 예열 실패 non-fatal(try { ... } catch { Write-Warning ... })", () => {
    it("try 블록 + catch 블록 안 Write-Warning(예열 실패가 throw/exit 로 치명화되지 않고 경고)", () => {
      const s = start();
      expect(warmNonFatalCatch(s)).toBe(true);
      expect(/\btry\s*\{/.test(s)).toBe(true);
      expect(/catch\s*\{[^}]*Write-Warning/.test(s)).toBe(true);
    });
  });

  describe("Error path / negative cases 충분 cover (mutant 합성 사본 — 원본 미변조, 예외 분기마다 각 1+)", () => {
    it("error path — 대조 artifact 부재 경로 → readFileSync throw(silent 0-byte fallback 0)", () => {
      const badPath = path.join(LLM_DIR, "__does_not_exist___start-llm.ps1");
      expect(existsSync(badPath)).toBe(false);
      expect(() => readFileSync(badPath, "utf8")).toThrow();
    });

    it("error path — 앵커 토큰 부재 시 명시적 false(빈 매칭을 pass 로 오통과 0)", () => {
      const anchors = extractStartAnchors("", "", "");
      expect(Object.values(anchors).some((v) => v === true)).toBe(false);
      // 실 소스는 반대로 전부 true — 부재/실재 변별.
      const real = extractStartAnchors(start(), config(), common());
      expect(Object.values(real).every((v) => v === true)).toBe(true);
    });

    it("negative (a) — config 값 gemma4:12b 를 예열 body 에 literal 로 하드코딩한 mutant → config-sourced 값 계약(하드코딩 금지) 위반 검출", () => {
      const s = start();
      const mutant = s.replace(
        "model      = $cfg.OLLAMA_MODEL",
        "model      = 'gemma4:12b'",
      );
      expect(configLiteralHardcoded(mutant, "gemma4:12b")).toBe(true);
      expect(
        extractStartAnchors(mutant, config(), common())
          .noConfigLiteralHardcoded,
      ).toBe(false);
      expect(warmBodyContract(mutant)).toBe(false);
      // 원본 불변.
      expect(configLiteralHardcoded(s, "gemma4:12b")).toBe(false);
    });

    it("negative (b) — dot-source 행을 절대경로/타 파일로 바꾼 mutant → dot-source 상대경로 계약 drift 검출", () => {
      const s = start();
      const mutant = s.replace(
        ". (Join-Path (Split-Path -Parent $MyInvocation.MyCommand.Path) '_common.ps1')",
        ". C:\\ollama\\helpers.ps1",
      );
      expect(dotSourceRelative(mutant)).toBe(false);
      expect(extractStartAnchors(mutant, config(), common()).dotSource).toBe(
        false,
      );
      // 원본 불변.
      expect(dotSourceRelative(s)).toBe(true);
    });

    it("negative (c) — Start-OllamaServerIfNeeded 실패 시 throw 를 제거(false 여도 진행)한 mutant → 서버 보장 fail-fast 계약 drift 검출", () => {
      const s = start();
      const mutant = s.replace(
        'throw "Ollama 서버 기동 실패. install.ps1 을 먼저 실행했는지 확인하세요."',
        'Write-Host "서버 미기동이지만 계속 진행"',
      );
      expect(/throw\b/.test(mutant)).toBe(false);
      expect(serverEnsureFailFast(mutant)).toBe(false);
      expect(
        extractStartAnchors(mutant, config(), common()).serverFailFast,
      ).toBe(false);
      // 원본 불변.
      expect(serverEnsureFailFast(s)).toBe(true);
    });

    it("negative (d) — -NoWarm 분기의 return early-exit 를 제거한 mutant → 예열 skip 분기 drift(예열 무조건 실행) 검출", () => {
      const s = start();
      const mutant = s.replace(/^\s*return\s*$/m, "");
      expect(/(^|\n)\s*return\b/.test(mutant)).toBe(false);
      expect(noWarmEarlyReturn(mutant)).toBe(false);
      expect(extractStartAnchors(mutant, config(), common()).noWarmReturn).toBe(
        false,
      );
      // 원본 불변.
      expect(noWarmEarlyReturn(s)).toBe(true);
    });

    it("negative (e) — 예열 body 의 keep_alive = $cfg.OLLAMA_KEEP_ALIVE 를 literal 5m 로 바꾼 mutant → config-sourced keep_alive drift 검출", () => {
      const s = start();
      const mutant = s.replace(
        "keep_alive = $cfg.OLLAMA_KEEP_ALIVE",
        "keep_alive = '5m'",
      );
      expect(/keep_alive\s*=\s*\$cfg\.OLLAMA_KEEP_ALIVE\b/.test(mutant)).toBe(
        false,
      );
      expect(warmBodyContract(mutant)).toBe(false);
      expect(configLiteralHardcoded(mutant, "5m")).toBe(true);
      expect(
        extractStartAnchors(mutant, config(), common())
          .noConfigLiteralHardcoded,
      ).toBe(false);
      // 원본 불변.
      expect(warmBodyContract(s)).toBe(true);
    });

    it("negative (f) — 예열 catch { Write-Warning ... } 를 제거(예열 실패 치명화)한 mutant → non-fatal 예열 계약 drift 검출", () => {
      const s = start();
      const mutant = s.replace(/catch\s*\{[\s\S]*?\}/, "catch { throw }");
      expect(/catch\s*\{[^}]*Write-Warning/.test(mutant)).toBe(false);
      expect(warmNonFatalCatch(mutant)).toBe(false);
      expect(
        extractStartAnchors(mutant, config(), common()).nonFatalCatch,
      ).toBe(false);
      // 원본 불변.
      expect(warmNonFatalCatch(s)).toBe(true);
    });

    it("negative (g) — start-llm.ps1 이 호출하는 Start-OllamaServerIfNeeded 를 _common.ps1 정의에서 제거한 합성 mutant → dead 호출(심볼 소비 계약) 검출", () => {
      const s = start();
      const c = common();
      const mutantCommon = c.replace(
        /function\s+Start-OllamaServerIfNeeded\b/,
        "function Start-SomethingElse",
      );
      expect(helperSymbolConsumed(s, "Start-OllamaServerIfNeeded")).toBe(true); // start 는 여전히 호출.
      expect(
        helperSymbolDefined(mutantCommon, "Start-OllamaServerIfNeeded"),
      ).toBe(false); // 정의는 사라짐 → dead 호출.
      expect(
        extractStartAnchors(s, config(), mutantCommon).helperSymbolsWired,
      ).toBe(false);
      // 원본 불변.
      expect(helperSymbolDefined(c, "Start-OllamaServerIfNeeded")).toBe(true);
    });

    it("negative — §9 credential/secret 누출 0: 추출/합성 토큰에 gh 토큰 어휘·실 credential·실 password·apiKey 값 미등장(§9/REQ-059)", () => {
      const synthesized = [
        JSON.stringify(extractStartAnchors(start(), config(), common())),
        ...CONFIG_SOURCED_KEYS.map((k) => String(configValue(config(), k))),
        switchParams(start()).join(","),
        CONSUMED_HELPER_SYMBOLS.join(","),
      ];
      const strongPattern =
        /(ghp_|--token|GITHUB_TOKEN|GH_TOKEN|\bBearer\b|Authorization|\bsk-|PASSWORD=|apiKey"?\s*[:=]\s*["']?\w)/i;
      synthesized.forEach((s) => {
        expect(strongPattern.test(s)).toBe(false);
      });
      // 합성 mutant 값도 명백한 dummy(하드코딩 gemma4:12b/5m literal·타 파일 경로 C:\ollama\helpers.ps1 등)로 한정 — 실 자격 0.
      const dummies = ["gemma4:12b", "5m", "C:\\ollama\\helpers.ps1"];
      dummies.forEach((d) => expect(strongPattern.test(d)).toBe(false));
      // 추출 값은 모두 비시크릿 설정 값/경로(bind 주소·모델 tag·keep-alive·endpoint).
      expect(configValue(config(), "OLLAMA_HOST")).toBe("127.0.0.1:11434");
      expect(start()).toContain("$apiBase/api/generate");
    });
  });

  describe("branch: 각 정본 앵커 일치/drift 정적 대조(합성 mutant 사본 — 원본 미변조)", () => {
    it("config-sourced 값 계약 일치/drift 분기", () => {
      const s = start();
      expect(
        extractStartAnchors(s, config(), common()).noConfigLiteralHardcoded,
      ).toBe(true);
      const mutant = s.replace(
        "$apiBase = Get-LocalApiBase -OllamaHost $cfg.OLLAMA_HOST",
        "$apiBase = Get-LocalApiBase -OllamaHost 127.0.0.1:11434",
      );
      expect(
        extractStartAnchors(mutant, config(), common())
          .noConfigLiteralHardcoded,
      ).toBe(false);
      expect(apiBaseConfigSourced(mutant)).toBe(false);
    });

    it("헬퍼 심볼 배선 일치/drift 분기", () => {
      const c = common();
      expect(extractStartAnchors(start(), config(), c).helperSymbolsWired).toBe(
        true,
      );
      const mutant = c.replace(
        /function\s+Get-LocalApiBase\b/,
        "function Get-Nothing",
      );
      expect(
        extractStartAnchors(start(), config(), mutant).helperSymbolsWired,
      ).toBe(false);
    });
  });

  describe("flow: 결정론 · no-mutation(원본 read-only 입증)", () => {
    it("동일 입력으로 pure 함수를 두 번 호출하면 deep-equal(결정론)", () => {
      const s = start();
      const cfg = config();
      const c = common();
      expect(extractStartAnchors(s, cfg, c)).toEqual(
        extractStartAnchors(s, cfg, c),
      );
      expect(switchParams(s)).toEqual(switchParams(s));
    });

    it("합성 mutate(사본 replace) 후에도 원본 소스 텍스트·pure 함수 산출이 불변(원본 read-only)", () => {
      const s = start();
      const cfg = config();
      const c = common();
      const sSnap = s;
      const cfgSnap = cfg;
      const cSnap = c;
      // 사본 mutate(negative a~g 에서 쓰는 replace) — 원본 불변 확인.
      s.replace("model      = $cfg.OLLAMA_MODEL", "model      = 'gemma4:12b'");
      s.replace("keep_alive = $cfg.OLLAMA_KEEP_ALIVE", "keep_alive = '5m'");
      s.replace(/^\s*return\s*$/m, "");
      s.replace(/catch\s*\{[\s\S]*?\}/, "catch { throw }");
      c.replace(
        /function\s+Start-OllamaServerIfNeeded\b/,
        "function Start-SomethingElse",
      );
      expect(s).toBe(sSnap);
      expect(cfg).toBe(cfgSnap);
      expect(c).toBe(cSnap);
      // 추출/파싱 후에도 원본 불변.
      extractStartAnchors(s, cfg, c);
      expect(s).toBe(sSnap);
      expect(c).toBe(cSnap);
    });
  });

  describe("dormant / non-gated 확인 — side-effect 0", () => {
    it("계약 모델이 env / 전역 상태 없이 순수하게 동작(non-gated — describe.skip 0·gating 분기 0)", () => {
      // 본 describe 가 실행된다는 것 자체가 describe.skip 0(항상 실행)의 런타임 증거.
      const envSnapshot = { ...process.env };
      const s = start();
      const before = switchParams(s);
      // 실 process.env 를 mutate 해도 산출 불변 — 모델이 process.env 를 참조하지 않음(파라미터로만).
      Object.assign(process.env, { LOCAL_LLM_START_PS1_UNIT_TEST: "x" });
      const after = switchParams(s);
      delete process.env.LOCAL_LLM_START_PS1_UNIT_TEST;
      expect(after).toEqual(before);
      expect(Object.keys(process.env)).toEqual(Object.keys(envSnapshot));
    });

    it("파일 read 는 start-llm.ps1/config.env/_common.ps1 읽기만 — 실 PowerShell/실 Ollama/실 HTTP POST 0. 세 파일은 선언적 스크립트·설정이라 런타임 분기 없이 정적 소스 텍스트 앵커로 happy/negative mutant 로 대체 cover", () => {
      const anchors = extractStartAnchors(start(), config(), common());
      expect(Object.values(anchors).every((v) => v === true)).toBe(true);
    });
  });
});
