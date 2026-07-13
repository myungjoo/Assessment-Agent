// realdata-e2e-local-llm-example-install-ps1-ordered-sequence-config-sourced-idempotent-fallback-envvar-autostart-restart-modelpull-contract.smoke-spec.ts
// — 로컬 Ollama live-LLM 운영 premise leg 후속. T-0966 이 `config.env`(LLM 호스트측 설정 정본)·T-0967 이
// 그 config 를 코드로 소비하는 공용 헬퍼 `_common.ps1`(모든 로컬 LLM 스크립트가 dot-source 하는 single-source
// 헬퍼)·T-0968 이 운영자 README 를 봉했다. 본 task 는 운영자가 로컬 LLM 을 **실제로 세우는 1순위 진입점**
// `deploy/local-llm-example/install.ps1`(그 _common.ps1 을 dot-source 해 config 정본을 읽고 설치→환경변수→
// 자동시작→서버 재기동→모델 pull 5-step 을 순서대로 수행하는 스크립트) 의 내부 계약을 세 실 파일(install.ps1·
// config.env·_common.ps1)을 readFileSync 로 읽어(실 PowerShell 실행/실 Ollama 설치·기동/실 winget·
// Invoke-WebRequest/실 레지스트리 쓰기 0) 정적 검증하는 non-gated smoke (T-0969, PLAN.md §108/§109 재배포
// runner chain — LLM 호스트측 설치 스크립트 leg).
//
// 봉함 불변식(핵심 위험 = 설치 시퀀스 계약 drift):
//   (1) config-sourced 값 계약(1순위): install.ps1 이 모델/HOST/KEEP_ALIVE 를 `$cfg.OLLAMA_MODEL`·
//       `$cfg.OLLAMA_HOST`·`$cfg.OLLAMA_KEEP_ALIVE`(=Get-LlmConfig 결과)로 참조하고, `gemma4:12b`·
//       `127.0.0.1:11434`·`5m` 같은 config 값 literal 을 본문에 하드코딩하지 않음. 하드코딩 시 config.env
//       정본(T-0966)과 조용히 divergence.
//   (2) dot-source 계약: install.ps1 이 `_common.ps1` 을 상대 경로(`Split-Path -Parent $MyInvocation...` +
//       `Join-Path ... '_common.ps1'`)로 dot-source 하고, 호출 헬퍼 심볼(Get-LlmConfig·Get-LocalApiBase·
//       Get-OllamaExe·Get-OllamaAppExe·Wait-OllamaServer)이 각각 _common.ps1 에 function 정의로 실존(dead 호출 0).
//   (3) CmdletBinding + 2-switch param 계약: `[CmdletBinding()]` + `[switch]$NoModelPull`·`[switch]$NoAutostart`
//       정확히 2 switch.
//   (4) 5-step ordered 시퀀스: `[1/5]`~`[5/5]` 배너가 오름차순 단조로 각 1회씩, 의미가 순서대로 설치→환경변수→
//       자동시작→서버 재기동+헬스대기→모델 pull.
//   (5) [1/5] 멱등 guard(Get-OllamaExe 존재 시 skip) + fallback chain(winget LASTEXITCODE -eq 0 → 실패 시
//       Invoke-WebRequest OllamaSetup.exe 직접 다운로드 → /VERYSILENT /NORESTART 무인 설치 → 재확인 후 throw).
//   (6) [2/5] env-var dual-write(User scope 2개 + 세션 $env: 2개 = 4 write).
//   (7) [3/5] 자동시작 분기(-NoAutostart → HKCU Run 'Ollama' Remove-ItemProperty / else → 부재 시
//       Get-OllamaAppExe + New-ItemProperty 등록).
//   (8) [4/5] 서버 재기동(Stop-Process → Start-Sleep 2 → Start-Process serve → Wait-OllamaServer 60s → non-fatal warn).
//   (9) [5/5] 모델 pull 분기(-NoModelPull skip / else → & $exe pull $cfg.OLLAMA_MODEL + LASTEXITCODE -ne 0 non-fatal warn).
//
// 전략(형제 T-0967 _common.ps1·T-0966 config.env·T-0965 README 동형): 세 실 파일에서 정본 토큰/시퀀스를 정적
// 추출하는 해석 동형 TS 순수 함수(configSourcedRef·configLiteralHardcoded·dotSourceRelative·helperSymbolDefined·
// cmdletBindingPresent·switchParams·stepBannerOrder·installFallbackChain·envVarDualWrite·autostartBranch·
// serverRestartSequence·modelPullBranch·extractInstallAnchors)로 계약을 assert. 합성 mutant 사본으로 negative
// (a~h 8종) 변별. T-0966/T-0967(config.env·_common.ps1 자체 계약) 와 distinct — 본 task 는 install.ps1 이 그
// config/헬퍼를 **소비/배선**하는 설치 시퀀스 계약만.
//   🔥 실 PowerShell 실행 0 · 실 Ollama 설치/기동/pull 0 · 실 winget/Invoke-WebRequest 0 · 실 레지스트리 쓰기 0 ·
//      process.env 읽기 0(입력은 pure 함수 파라미터) · credential 0(§9/REQ-059) · 새 dep 0(node fs/path) ·
//      src 변경 0(test-only) · install.ps1/config.env/_common.ps1 읽기만(실행 0 · 변경 0).
import { existsSync, readFileSync } from "fs";
import * as path from "path";

// repo-root 경로 — test 실행 cwd 무관하게 robust 하게 해석(`__dirname` = test/smoke,
// 두 단계 위가 repo-root). `process.cwd()` 대신 `__dirname` 기준 상대로 고정(sibling T-0966/T-0967).
const REPO_ROOT = path.resolve(__dirname, "../..");
const LLM_DIR = path.join(REPO_ROOT, "deploy", "local-llm-example");
const INSTALL_PS1_PATH = path.join(LLM_DIR, "install.ps1");
const CONFIG_ENV_PATH = path.join(LLM_DIR, "config.env");
const COMMON_PS1_PATH = path.join(LLM_DIR, "_common.ps1");

// 정본 앵커(실 artifact 표현의 TS mirror — 실 PowerShell/실 Ollama 0).
// install.ps1 이 config-sourced 로 참조해야 하는 값(하드코딩 금지 대상) — config.env 정본이 근거.
const CONFIG_SOURCED_KEYS = [
  "OLLAMA_MODEL",
  "OLLAMA_HOST",
  "OLLAMA_KEEP_ALIVE",
]; // install.ps1 이 $cfg.<KEY> 로 참조해야 하는 3종.
// 위 키의 config.env active 값 — install.ps1 본문에 literal 로 등장하면 divergence 위험(하드코딩 검출 대상).
const CONFIG_LITERALS: Record<string, string> = {
  OLLAMA_MODEL: "gemma4:12b",
  OLLAMA_HOST: "127.0.0.1:11434",
  OLLAMA_KEEP_ALIVE: "5m",
};
// install.ps1 이 dot-source 후 호출하는 헬퍼 심볼 — 각각 _common.ps1 에 function 정의로 실존해야(dead 호출 0).
const CONSUMED_HELPER_SYMBOLS = [
  "Get-LlmConfig",
  "Get-LocalApiBase",
  "Get-OllamaExe",
  "Get-OllamaAppExe",
  "Wait-OllamaServer",
];
// param 블록 2 switch.
const EXPECTED_SWITCHES = ["NoModelPull", "NoAutostart"];
// 5-step ordered 배너.
const STEP_BANNERS = ["[1/5]", "[2/5]", "[3/5]", "[4/5]", "[5/5]"];

// ── TS 동형 pure 함수(정본) — install.ps1 / config.env / _common.ps1 의 정본 토큰/시퀀스를 모델링.
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

// configSourcedRef(install, key): install.ps1 이 `$cfg.<KEY>` 로 config-sourced 참조를 하는가(소스 리터럴 존재).
function configSourcedRef(install: string, key: string): boolean {
  return new RegExp(`\\$cfg\\.${key}\\b`).test(install);
}

// configLiteralHardcoded(install, literal): config 값 literal 이 install.ps1 본문에 하드코딩됐는가(있으면 위반).
//   `$cfg.` 참조·Write-Host 포맷은 literal 이 아니라 참조이므로 걸리지 않는다 — 값 문자열 자체의 등장만 검출.
function configLiteralHardcoded(install: string, literal: string): boolean {
  return install.includes(literal);
}

// dotSourceRelative(install): _common.ps1 을 상대 경로로 dot-source 하는가(Split-Path -Parent + Join-Path + '_common.ps1').
function dotSourceRelative(install: string): boolean {
  const hasDotSource = /^\s*\.\s+\(Join-Path/m.test(install);
  const hasScriptDir = install.includes(
    "Split-Path -Parent $MyInvocation.MyCommand.Path",
  );
  const hasCommonRef = install.includes("'_common.ps1'");
  return hasDotSource && hasScriptDir && hasCommonRef;
}

// helperSymbolDefined(common, symbol): 헬퍼 심볼이 _common.ps1 에 `function <symbol>` 정의로 실존하는가.
function helperSymbolDefined(common: string, symbol: string): boolean {
  return new RegExp(`function\\s+${symbol}\\b`, "i").test(common);
}

// helperSymbolConsumed(install, symbol): install.ps1 이 그 헬퍼 심볼을 호출/참조하는가.
function helperSymbolConsumed(install: string, symbol: string): boolean {
  return new RegExp(`\\b${symbol}\\b`).test(install);
}

// cmdletBindingPresent(install): `[CmdletBinding()]` 어트리뷰트가 소스에 존재하는가.
function cmdletBindingPresent(install: string): boolean {
  return install.includes("[CmdletBinding()]");
}

// switchParams(install): param 블록에 선언된 `[switch]$Name` 스위치 이름 목록(등장 순).
function switchParams(install: string): string[] {
  const out: string[] = [];
  const re = /\[switch\]\$(\w+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(install)) !== null) out.push(m[1]);
  return out;
}

// stepBannerOrder(install): STEP_BANNERS 각 배너의 최초 등장 인덱스 배열 — 부재면 -1.
//   오름차순 단조(각 ≥ 0 이고 strictly increasing) 이어야 5-step ordered 시퀀스 성립.
function stepBannerOrder(install: string): number[] {
  return STEP_BANNERS.map((b) => install.indexOf(b));
}

// stepBannersMonotonic(install): 5 배너가 각 1회+ 존재하고 소스에서 오름차순 단조로 등장하는가.
function stepBannersMonotonic(install: string): boolean {
  const idxs = stepBannerOrder(install);
  if (idxs.some((i) => i < 0)) return false;
  for (let i = 1; i < idxs.length; i++) {
    if (idxs[i] <= idxs[i - 1]) return false;
  }
  return true;
}

// installFallbackChain(install): [1/5] 설치 단계의 멱등 guard + winget→직접다운로드 fallback→throw 토큰이
//   모두 존재하고 소스 순서(winget 성공판정 → Invoke-WebRequest → 무인 설치 → throw)가 성립하는가.
function installFallbackChain(install: string): boolean {
  const idempotentGuard = /if\s*\(\s*\$exe\s*\)/.test(install); // Get-OllamaExe 결과 있으면 skip.
  const wingetSuccess = install.includes("$LASTEXITCODE -eq 0");
  const directDownload = install.includes("Invoke-WebRequest");
  const setupExe = install.includes("OllamaSetup.exe");
  const silentInstall =
    install.includes("/VERYSILENT") && install.includes("/NORESTART");
  const throwOnMissing = /throw\b/.test(install);
  if (
    !(
      idempotentGuard &&
      wingetSuccess &&
      directDownload &&
      setupExe &&
      silentInstall &&
      throwOnMissing
    )
  ) {
    return false;
  }
  // 순서: winget 성공판정 → 직접 다운로드 → throw.
  const wingetAt = install.indexOf("$LASTEXITCODE -eq 0");
  const downloadAt = install.indexOf("Invoke-WebRequest");
  const throwAt = install.search(/throw\b/);
  return wingetAt < downloadAt && downloadAt < throwAt;
}

// envVarDualWrite(install): [2/5] 환경변수 이중 기록 — User scope 2개 + 세션 $env: 2개 = 4 write 모두 존재.
function envVarDualWrite(install: string): boolean {
  const userKeepAlive =
    /\[Environment\]::SetEnvironmentVariable\(\s*'OLLAMA_KEEP_ALIVE'[^)]*'User'\s*\)/.test(
      install,
    );
  const userHost =
    /\[Environment\]::SetEnvironmentVariable\(\s*'OLLAMA_HOST'[^)]*'User'\s*\)/.test(
      install,
    );
  const sessionKeepAlive = /\$env:OLLAMA_KEEP_ALIVE\s*=/.test(install);
  const sessionHost = /\$env:OLLAMA_HOST\s*=/.test(install);
  return userKeepAlive && userHost && sessionKeepAlive && sessionHost;
}

// autostartBranch(install): [3/5] 자동시작 분기 — -NoAutostart 제거 경로 + else 등록 경로 토큰이 모두 존재.
function autostartBranch(install: string): boolean {
  const noAutostartGuard = /if\s*\(\s*\$NoAutostart\s*\)/.test(install);
  const runKey = install.includes(
    "HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Run",
  );
  const removeProp =
    /Remove-ItemProperty[^\n]*'Ollama'/.test(install) ||
    (install.includes("Remove-ItemProperty") && install.includes("'Ollama'"));
  const registerProp =
    install.includes("New-ItemProperty") &&
    install.includes("Get-OllamaAppExe");
  return noAutostartGuard && runKey && removeProp && registerProp;
}

// serverRestartSequence(install): [4/5] 서버 재기동 시퀀스 — Stop-Process → Start-Sleep 2 → serve → Wait-OllamaServer 60s.
function serverRestartSequence(install: string): boolean {
  const stopAt = install.indexOf("Stop-Process");
  const sleepAt = install.search(/Start-Sleep\s+-Seconds\s+2/);
  const serveAt = install.search(/Start-Process[^\n]*'serve'/);
  const waitAt = install.search(/Wait-OllamaServer[^\n]*-TimeoutSec\s+60/);
  if (stopAt < 0 || sleepAt < 0 || serveAt < 0 || waitAt < 0) return false;
  return stopAt < sleepAt && sleepAt < serveAt && serveAt < waitAt;
}

// modelPullBranch(install): [5/5] 모델 pull 분기 — -NoModelPull skip + else pull($cfg.OLLAMA_MODEL) + LASTEXITCODE non-fatal.
function modelPullBranch(install: string): boolean {
  const noPullGuard = /if\s*\(\s*\$NoModelPull\s*\)/.test(install);
  const pullCall = /&\s*\$exe\s+pull\s+\$cfg\.OLLAMA_MODEL/.test(install);
  const nonFatal =
    install.includes("$LASTEXITCODE -ne 0") &&
    install.includes("Write-Warning");
  return noPullGuard && pullCall && nonFatal;
}

// (집계) extractInstallAnchors(install, config, common): 설치 스크립트 내부 계약 불변식을 한 번에 집계 —
//   하나라도 부재/변질이면 명시적 false(빈 결과 성공-위장 0).
function extractInstallAnchors(
  install: string,
  config: string,
  common: string,
): {
  configSourced: boolean;
  noConfigLiteralHardcoded: boolean;
  dotSource: boolean;
  helperSymbolsWired: boolean;
  cmdletBinding: boolean;
  twoSwitches: boolean;
  stepSequence: boolean;
  installFallback: boolean;
  envDualWrite: boolean;
  autostart: boolean;
  serverRestart: boolean;
  modelPull: boolean;
} {
  // config-sourced: 3 키 모두 $cfg.<KEY> 참조.
  const configSourced = CONFIG_SOURCED_KEYS.every((k) =>
    configSourcedRef(install, k),
  );
  // 하드코딩 금지: config.env active 값 literal 이 install 본문에 등장하지 않음.
  const noConfigLiteralHardcoded = CONFIG_SOURCED_KEYS.every((k) => {
    const literal = configValue(config, k);
    return literal !== undefined && !configLiteralHardcoded(install, literal);
  });
  // 헬퍼 심볼 배선: install 이 호출하는 심볼이 각각 _common.ps1 에 function 정의로 실존.
  const helperSymbolsWired = CONSUMED_HELPER_SYMBOLS.every(
    (s) => helperSymbolConsumed(install, s) && helperSymbolDefined(common, s),
  );
  const switches = switchParams(install);
  const twoSwitches =
    switches.length === EXPECTED_SWITCHES.length &&
    EXPECTED_SWITCHES.every((s) => switches.includes(s));
  return {
    configSourced,
    noConfigLiteralHardcoded,
    dotSource: dotSourceRelative(install),
    helperSymbolsWired,
    cmdletBinding: cmdletBindingPresent(install),
    twoSwitches,
    stepSequence: stepBannersMonotonic(install),
    installFallback: installFallbackChain(install),
    envDualWrite: envVarDualWrite(install),
    autostart: autostartBranch(install),
    serverRestart: serverRestartSequence(install),
    modelPull: modelPullBranch(install),
  };
}

describe("realdata-e2e §108/§109 deploy/local-llm-example/install.ps1 설치 스크립트 내부 계약 smoke — config-sourced 값 참조(하드코딩 금지, 1순위) + _common.ps1 dot-source·헬퍼 심볼 배선 + CmdletBinding 2-switch + 5-step ordered 시퀀스 + [1/5] 멱등 guard/winget→직접다운로드 fallback/throw + [2/5] env-var dual-write + [3/5] HKCU Run 자동시작 분기 + [4/5] Stop→serve→Wait-OllamaServer 60s + [5/5] -NoModelPull skip/pull non-fatal + secret-safety (T-0969)", () => {
  const install = () => readFileSync(INSTALL_PS1_PATH, "utf8");
  const config = () => readFileSync(CONFIG_ENV_PATH, "utf8");
  const common = () => readFileSync(COMMON_PS1_PATH, "utf8");

  describe("Happy-path: 대조 artifact 3종 실존 + 12 불변식 전부 true", () => {
    it("install.ps1·config.env·_common.ps1 가 repo-root 기준 실존(existsSync)", () => {
      expect(existsSync(INSTALL_PS1_PATH)).toBe(true);
      expect(existsSync(CONFIG_ENV_PATH)).toBe(true);
      expect(existsSync(COMMON_PS1_PATH)).toBe(true);
    });

    it("12 불변식(config-sourced·하드코딩금지·dot-source·헬퍼배선·CmdletBinding·2-switch·5-step·설치fallback·env dual-write·자동시작·서버재기동·모델pull) 전부 true", () => {
      const anchors = extractInstallAnchors(install(), config(), common());
      expect(Object.values(anchors).every((v) => v === true)).toBe(true);
    });
  });

  describe("Happy-path(1순위 계약): config-sourced 값 참조($cfg.<KEY>) + config 값 literal 하드코딩 부재(키당 1+)", () => {
    it("OLLAMA_MODEL 을 $cfg.OLLAMA_MODEL 로 참조하고 gemma4:12b literal 을 하드코딩하지 않음", () => {
      const i = install();
      expect(configSourcedRef(i, "OLLAMA_MODEL")).toBe(true);
      expect(configLiteralHardcoded(i, CONFIG_LITERALS.OLLAMA_MODEL)).toBe(
        false,
      );
      // config.env 가 그 값의 정본(byte 근거).
      expect(configValue(config(), "OLLAMA_MODEL")).toBe(
        CONFIG_LITERALS.OLLAMA_MODEL,
      );
    });

    it("OLLAMA_HOST 를 $cfg.OLLAMA_HOST 로 참조하고 127.0.0.1:11434 literal 을 하드코딩하지 않음", () => {
      const i = install();
      expect(configSourcedRef(i, "OLLAMA_HOST")).toBe(true);
      expect(configLiteralHardcoded(i, CONFIG_LITERALS.OLLAMA_HOST)).toBe(
        false,
      );
      expect(configValue(config(), "OLLAMA_HOST")).toBe(
        CONFIG_LITERALS.OLLAMA_HOST,
      );
    });

    it("OLLAMA_KEEP_ALIVE 를 $cfg.OLLAMA_KEEP_ALIVE 로 참조하고 5m literal 을 하드코딩하지 않음", () => {
      const i = install();
      expect(configSourcedRef(i, "OLLAMA_KEEP_ALIVE")).toBe(true);
      // '5m' 는 짧아 오탐 위험 — config-sourced 참조가 존재하고 안커가 true 임으로 확인(하드코딩 아님).
      expect(
        extractInstallAnchors(i, config(), common()).noConfigLiteralHardcoded,
      ).toBe(true);
      expect(configValue(config(), "OLLAMA_KEEP_ALIVE")).toBe(
        CONFIG_LITERALS.OLLAMA_KEEP_ALIVE,
      );
    });

    it("3종 전부 config-sourced 참조 + 하드코딩 부재(집계 true)", () => {
      const anchors = extractInstallAnchors(install(), config(), common());
      expect(anchors.configSourced).toBe(true);
      expect(anchors.noConfigLiteralHardcoded).toBe(true);
    });
  });

  describe("Happy-path: _common.ps1 dot-source(상대경로) + 호출 헬퍼 심볼 5종이 function 정의로 실존(dead 호출 0)", () => {
    it("install.ps1 이 _common.ps1 을 상대경로로 dot-source", () => {
      const i = install();
      expect(dotSourceRelative(i)).toBe(true);
      expect(i).toContain("Split-Path -Parent $MyInvocation.MyCommand.Path");
      expect(i).toContain("'_common.ps1'");
    });

    it("install.ps1 이 호출하는 헬퍼 심볼 5종이 각각 _common.ps1 에 function 정의로 실존", () => {
      const i = install();
      const c = common();
      CONSUMED_HELPER_SYMBOLS.forEach((s) => {
        expect(helperSymbolConsumed(i, s)).toBe(true);
        expect(helperSymbolDefined(c, s)).toBe(true);
      });
      expect(extractInstallAnchors(i, config(), c).helperSymbolsWired).toBe(
        true,
      );
    });
  });

  describe("Happy-path: CmdletBinding + 2-switch param 계약", () => {
    it("[CmdletBinding()] 존재 + [switch]$NoModelPull·[switch]$NoAutostart 정확히 2 switch", () => {
      const i = install();
      expect(cmdletBindingPresent(i)).toBe(true);
      const switches = switchParams(i);
      expect(switches).toHaveLength(2);
      expect(switches).toContain("NoModelPull");
      expect(switches).toContain("NoAutostart");
      expect(extractInstallAnchors(i, config(), common()).twoSwitches).toBe(
        true,
      );
    });
  });

  describe("Happy-path: 5-step ordered 시퀀스([1/5]~[5/5] 오름차순 단조·각 1회)", () => {
    it("5 배너가 각 존재하고 소스에서 오름차순 단조로 등장", () => {
      const i = install();
      const idxs = stepBannerOrder(i);
      expect(idxs.every((x) => x >= 0)).toBe(true);
      for (let k = 1; k < idxs.length; k++) {
        expect(idxs[k]).toBeGreaterThan(idxs[k - 1]);
      }
      expect(stepBannersMonotonic(i)).toBe(true);
    });

    it("각 단계 의미가 순서대로 설치→환경변수→자동시작→서버재기동→모델pull", () => {
      const i = install();
      const at = (b: string) => i.indexOf(b);
      // [1/5] 설치 근처에 Ollama 설치, [2/5] 환경변수, [3/5] 자동시작, [4/5] 서버 재기동, [5/5] 모델 pull.
      expect(i.indexOf("Get-OllamaExe")).toBeGreaterThan(-1);
      expect(at("[2/5]")).toBeLessThan(i.indexOf("SetEnvironmentVariable"));
      expect(at("[3/5]")).toBeLessThan(i.indexOf("$runKey"));
      expect(at("[4/5]")).toBeLessThan(i.indexOf("Wait-OllamaServer"));
      expect(at("[5/5]")).toBeLessThan(i.indexOf("pull $cfg.OLLAMA_MODEL"));
    });
  });

  describe("Flow/branch cover: [1/5] 멱등 guard + winget→직접다운로드 fallback→throw", () => {
    it("멱등 guard(if $exe skip) + winget 성공판정 → Invoke-WebRequest 직접다운로드 → /VERYSILENT/NORESTART → throw 순서", () => {
      const i = install();
      expect(installFallbackChain(i)).toBe(true);
      expect(/if\s*\(\s*\$exe\s*\)/.test(i)).toBe(true);
      expect(i).toContain("$LASTEXITCODE -eq 0");
      expect(i).toContain("Invoke-WebRequest");
      expect(i).toContain("OllamaSetup.exe");
      expect(i).toContain("/VERYSILENT");
      expect(i).toContain("/NORESTART");
      expect(/throw\b/.test(i)).toBe(true);
    });
  });

  describe("Flow/branch cover: [2/5] env-var dual-write(User 2개 + 세션 2개)", () => {
    it("OLLAMA_KEEP_ALIVE·OLLAMA_HOST 를 User scope + 세션 $env: 로 이중 기록(4 write)", () => {
      const i = install();
      expect(envVarDualWrite(i)).toBe(true);
      expect(i).toContain(
        "[Environment]::SetEnvironmentVariable('OLLAMA_KEEP_ALIVE'",
      );
      expect(i).toContain(
        "[Environment]::SetEnvironmentVariable('OLLAMA_HOST'",
      );
      expect(i).toContain("$env:OLLAMA_KEEP_ALIVE =");
      expect(i).toContain("$env:OLLAMA_HOST =");
      // User scope write 2개.
      const userWrites = (
        i.match(/SetEnvironmentVariable\([^)]*'User'\s*\)/g) || []
      ).length;
      expect(userWrites).toBe(2);
    });
  });

  describe("Flow/branch cover: [3/5] 자동시작 분기(-NoAutostart 제거 / else 등록)", () => {
    it("-NoAutostart → Remove-ItemProperty 'Ollama' / else → 부재 시 Get-OllamaAppExe + New-ItemProperty 등록", () => {
      const i = install();
      expect(autostartBranch(i)).toBe(true);
      expect(/if\s*\(\s*\$NoAutostart\s*\)/.test(i)).toBe(true);
      expect(i).toContain(
        "HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Run",
      );
      expect(i).toContain("Remove-ItemProperty");
      expect(i).toContain("New-ItemProperty");
      expect(i).toContain("Get-OllamaAppExe");
    });
  });

  describe("Flow/branch cover: [4/5] 서버 재기동(Stop→Sleep 2→serve→Wait-OllamaServer 60s)", () => {
    it("Stop-Process → Start-Sleep 2 → Start-Process serve → Wait-OllamaServer -TimeoutSec 60 순서 + non-fatal warn", () => {
      const i = install();
      expect(serverRestartSequence(i)).toBe(true);
      expect(i).toContain("Stop-Process");
      expect(/Start-Sleep\s+-Seconds\s+2/.test(i)).toBe(true);
      expect(/Start-Process[^\n]*'serve'/.test(i)).toBe(true);
      expect(/Wait-OllamaServer[^\n]*-TimeoutSec\s+60/.test(i)).toBe(true);
      // 미응답 시 non-fatal warning.
      expect(i).toContain("Write-Warning");
    });
  });

  describe("Flow/branch cover: [5/5] 모델 pull 분기(-NoModelPull skip / else pull non-fatal)", () => {
    it("-NoModelPull → skip / else → & $exe pull $cfg.OLLAMA_MODEL + LASTEXITCODE -ne 0 non-fatal warn", () => {
      const i = install();
      expect(modelPullBranch(i)).toBe(true);
      expect(/if\s*\(\s*\$NoModelPull\s*\)/.test(i)).toBe(true);
      expect(/&\s*\$exe\s+pull\s+\$cfg\.OLLAMA_MODEL/.test(i)).toBe(true);
      expect(i).toContain("$LASTEXITCODE -ne 0");
    });
  });

  describe("Error path / negative cases 충분 cover (mutant 합성 사본 — 원본 미변조, 예외 분기마다 각 1+)", () => {
    it("error path — 대조 artifact 부재 경로 → readFileSync throw(silent 0-byte fallback 0)", () => {
      const badPath = path.join(LLM_DIR, "__does_not_exist___install.ps1");
      expect(existsSync(badPath)).toBe(false);
      expect(() => readFileSync(badPath, "utf8")).toThrow();
    });

    it("error path — 앵커 토큰 부재 시 명시적 false(빈 매칭을 pass 로 오통과 0)", () => {
      const anchors = extractInstallAnchors("", "", "");
      expect(Object.values(anchors).some((v) => v === true)).toBe(false);
      // 실 소스는 반대로 전부 true — 부재/실재 변별.
      const real = extractInstallAnchors(install(), config(), common());
      expect(Object.values(real).every((v) => v === true)).toBe(true);
    });

    it("negative (a) — config 값 gemma4:12b 를 install.ps1 에 literal 로 하드코딩한 mutant → config-sourced 값 계약(하드코딩 금지) 위반 검출", () => {
      const i = install();
      const mutant = i.replace(
        "& $exe pull $cfg.OLLAMA_MODEL",
        "& $exe pull gemma4:12b",
      );
      expect(configLiteralHardcoded(mutant, "gemma4:12b")).toBe(true);
      expect(
        extractInstallAnchors(mutant, config(), common())
          .noConfigLiteralHardcoded,
      ).toBe(false);
      // 원본 불변.
      expect(configLiteralHardcoded(i, "gemma4:12b")).toBe(false);
    });

    it("negative (b) — dot-source 행을 절대경로/타 파일로 바꾼 mutant → dot-source 상대경로 계약 drift 검출", () => {
      const i = install();
      const mutant = i.replace(
        ". (Join-Path (Split-Path -Parent $MyInvocation.MyCommand.Path) '_common.ps1')",
        ". C:\\ollama\\helpers.ps1",
      );
      expect(dotSourceRelative(mutant)).toBe(false);
      expect(extractInstallAnchors(mutant, config(), common()).dotSource).toBe(
        false,
      );
      // 원본 불변.
      expect(dotSourceRelative(i)).toBe(true);
    });

    it("negative (c) — [3/5] 배너를 제거해 4-step 으로 만든 mutant → 5-step ordered 시퀀스 단조성 위반 검출", () => {
      const i = install();
      const mutant = i.replace(/\[3\/5\]/g, "");
      expect(stepBannerOrder(mutant)[2]).toBe(-1);
      expect(stepBannersMonotonic(mutant)).toBe(false);
      expect(
        extractInstallAnchors(mutant, config(), common()).stepSequence,
      ).toBe(false);
      // 원본 불변.
      expect(stepBannersMonotonic(i)).toBe(true);
    });

    it("negative (d) — [2/5] 세션 $env:OLLAMA_HOST write 를 제거한 mutant → env-var dual-write 계약 drift(세션측 누락) 검출", () => {
      const i = install();
      const mutant = i.replace("$env:OLLAMA_HOST = $cfg.OLLAMA_HOST", "");
      expect(/\$env:OLLAMA_HOST\s*=/.test(mutant)).toBe(false);
      expect(envVarDualWrite(mutant)).toBe(false);
      expect(
        extractInstallAnchors(mutant, config(), common()).envDualWrite,
      ).toBe(false);
      // 원본 불변.
      expect(envVarDualWrite(i)).toBe(true);
    });

    it("negative (e) — winget fallback 의 Invoke-WebRequest 직접다운로드 분기를 제거한 mutant → 설치 fallback chain drift 검출", () => {
      const i = install();
      const mutant = i.replace(
        "Invoke-WebRequest -Uri $url -OutFile $tmp -UseBasicParsing",
        "",
      );
      expect(mutant.includes("Invoke-WebRequest")).toBe(false);
      expect(installFallbackChain(mutant)).toBe(false);
      expect(
        extractInstallAnchors(mutant, config(), common()).installFallback,
      ).toBe(false);
      // 원본 불변.
      expect(installFallbackChain(i)).toBe(true);
    });

    it("negative (f) — -NoModelPull switch 를 param 에서 제거한 mutant → 2-switch param 계약 drift 검출", () => {
      const i = install();
      const mutant = i.replace("[switch]$NoModelPull,", "");
      const switches = switchParams(mutant);
      expect(switches).not.toContain("NoModelPull");
      expect(
        extractInstallAnchors(mutant, config(), common()).twoSwitches,
      ).toBe(false);
      // 원본 불변.
      expect(switchParams(i)).toContain("NoModelPull");
    });

    it("negative (g) — Wait-OllamaServer 호출을 제거한 mutant → [4/5] 헬스 대기 계약 drift 검출", () => {
      const i = install();
      const mutant = i.replace(
        /if \(Wait-OllamaServer -ApiBase \$apiBase -TimeoutSec 60\)/,
        "if ($true)",
      );
      expect(/Wait-OllamaServer[^\n]*-TimeoutSec\s+60/.test(mutant)).toBe(
        false,
      );
      expect(serverRestartSequence(mutant)).toBe(false);
      expect(
        extractInstallAnchors(mutant, config(), common()).serverRestart,
      ).toBe(false);
      // 원본 불변.
      expect(serverRestartSequence(i)).toBe(true);
    });

    it("negative (h) — install.ps1 이 호출하는 Get-LocalApiBase 를 _common.ps1 정의에서 제거한 합성 mutant → dead 호출(심볼 소비 계약) 검출", () => {
      const i = install();
      const c = common();
      const mutantCommon = c.replace(
        /function\s+Get-LocalApiBase\b/,
        "function Get-SomethingElse",
      );
      expect(helperSymbolConsumed(i, "Get-LocalApiBase")).toBe(true); // install 은 여전히 호출.
      expect(helperSymbolDefined(mutantCommon, "Get-LocalApiBase")).toBe(false); // 정의는 사라짐 → dead 호출.
      expect(
        extractInstallAnchors(i, config(), mutantCommon).helperSymbolsWired,
      ).toBe(false);
      // 원본 불변.
      expect(helperSymbolDefined(c, "Get-LocalApiBase")).toBe(true);
    });

    it("negative — §9 credential/secret 누출 0: 추출/합성 토큰에 gh 토큰 어휘·실 credential·실 password·apiKey 값 미등장(§9/REQ-059)", () => {
      const synthesized = [
        JSON.stringify(extractInstallAnchors(install(), config(), common())),
        ...CONFIG_SOURCED_KEYS.map((k) => String(configValue(config(), k))),
        switchParams(install()).join(","),
        stepBannerOrder(install()).join(","),
        CONSUMED_HELPER_SYMBOLS.join(","),
      ];
      const strongPattern =
        /(ghp_|--token|GITHUB_TOKEN|GH_TOKEN|\bBearer\b|Authorization|\bsk-|PASSWORD=|apiKey"?\s*[:=]\s*["']?\w)/i;
      synthesized.forEach((s) => {
        expect(strongPattern.test(s)).toBe(false);
      });
      // 합성 mutant 값도 명백한 dummy(하드코딩 gemma4:12b·타 파일 경로 C:\ollama\helpers.ps1 등)로 한정 — 실 자격 0.
      const dummies = ["gemma4:12b", "C:\\ollama\\helpers.ps1", "/VERYSILENT"];
      dummies.forEach((d) => expect(strongPattern.test(d)).toBe(false));
      // 추출 값은 모두 비시크릿 설정 값/경로(bind 주소·모델 tag·keep-alive·다운로드 URL·레지스트리 경로·설치 플래그).
      expect(configValue(config(), "OLLAMA_HOST")).toBe("127.0.0.1:11434");
      expect(install()).toContain(
        "https://ollama.com/download/OllamaSetup.exe",
      );
    });
  });

  describe("branch: 각 정본 앵커 일치/drift 정적 대조(합성 mutant 사본 — 원본 미변조)", () => {
    it("config-sourced 값 계약 일치/drift 분기", () => {
      const i = install();
      expect(
        extractInstallAnchors(i, config(), common()).noConfigLiteralHardcoded,
      ).toBe(true);
      const mutant = i.replace(
        "$cfg.OLLAMA_HOST, $cfg.OLLAMA_KEEP_ALIVE",
        "127.0.0.1:11434, $cfg.OLLAMA_KEEP_ALIVE",
      );
      expect(
        extractInstallAnchors(mutant, config(), common())
          .noConfigLiteralHardcoded,
      ).toBe(false);
    });

    it("헬퍼 심볼 배선 일치/drift 분기", () => {
      const c = common();
      expect(
        extractInstallAnchors(install(), config(), c).helperSymbolsWired,
      ).toBe(true);
      const mutant = c.replace(
        /function\s+Wait-OllamaServer\b/,
        "function Wait-Nothing",
      );
      expect(
        extractInstallAnchors(install(), config(), mutant).helperSymbolsWired,
      ).toBe(false);
    });
  });

  describe("flow: 결정론 · no-mutation(원본 read-only 입증)", () => {
    it("동일 입력으로 pure 함수를 두 번 호출하면 deep-equal(결정론)", () => {
      const i = install();
      const cfg = config();
      const c = common();
      expect(extractInstallAnchors(i, cfg, c)).toEqual(
        extractInstallAnchors(i, cfg, c),
      );
      expect(switchParams(i)).toEqual(switchParams(i));
      expect(stepBannerOrder(i)).toEqual(stepBannerOrder(i));
    });

    it("합성 mutate(사본 replace) 후에도 원본 소스 텍스트·pure 함수 산출이 불변(원본 read-only)", () => {
      const i = install();
      const cfg = config();
      const c = common();
      const iSnap = i;
      const cfgSnap = cfg;
      const cSnap = c;
      // 사본 mutate(negative a~h 에서 쓰는 replace) — 원본 불변 확인.
      i.replace("& $exe pull $cfg.OLLAMA_MODEL", "& $exe pull gemma4:12b");
      i.replace(/\[3\/5\]/g, "");
      i.replace("$env:OLLAMA_HOST = $cfg.OLLAMA_HOST", "");
      i.replace("[switch]$NoModelPull,", "");
      c.replace(/function\s+Get-LocalApiBase\b/, "function Get-SomethingElse");
      expect(i).toBe(iSnap);
      expect(cfg).toBe(cfgSnap);
      expect(c).toBe(cSnap);
      // 추출/파싱 후에도 원본 불변.
      extractInstallAnchors(i, cfg, c);
      expect(i).toBe(iSnap);
      expect(c).toBe(cSnap);
    });
  });

  describe("dormant / non-gated 확인 — side-effect 0", () => {
    it("계약 모델이 env / 전역 상태 없이 순수하게 동작(non-gated — describe.skip 0·gating 분기 0)", () => {
      // 본 describe 가 실행된다는 것 자체가 describe.skip 0(항상 실행)의 런타임 증거.
      const envSnapshot = { ...process.env };
      const i = install();
      const before = switchParams(i);
      // 실 process.env 를 mutate 해도 산출 불변 — 모델이 process.env 를 참조하지 않음(파라미터로만).
      Object.assign(process.env, { LOCAL_LLM_INSTALL_PS1_UNIT_TEST: "x" });
      const after = switchParams(i);
      delete process.env.LOCAL_LLM_INSTALL_PS1_UNIT_TEST;
      expect(after).toEqual(before);
      expect(Object.keys(process.env)).toEqual(Object.keys(envSnapshot));
    });

    it("파일 read 는 install.ps1/config.env/_common.ps1 읽기만 — 실 PowerShell/실 Ollama/실 winget/실 레지스트리 0. 세 파일은 선언적 스크립트·설정이라 런타임 분기 없이 정적 소스 텍스트 앵커로 happy/negative mutant 로 대체 cover", () => {
      const anchors = extractInstallAnchors(install(), config(), common());
      expect(Object.values(anchors).every((v) => v === true)).toBe(true);
    });
  });
});
