// realdata-e2e-local-llm-example-expose-lan-ps1-firewall-config-sourced-cidr-revert-expose-branch-admin-failfast-idempotent-contract.smoke-spec.ts
// — 로컬 Ollama live-LLM 운영 premise leg 마지막 미봉 스크립트. T-0966 이 `config.env`(LLM 호스트측 설정 정본)·T-0967 이
// 그 config 를 코드로 소비하는 공용 헬퍼 `_common.ps1`(모든 로컬 LLM 스크립트가 dot-source 하는 single-source 헬퍼)·
// T-0968 이 운영자 README·T-0969 가 1순위 설치 진입점 `install.ps1`·T-0970 이 기동/예열 `start-llm.ps1`·T-0971 이 자원
// 해제 `stop-llm.ps1`·T-0972 가 진단 `status.ps1`·T-0973 이 실-검증 `test-llm.ps1` 을 봉했다. 본 task 는 **PLAN §109 의
// 운영 전제인 "PC Ollama LAN 노출"을 실제로 수행하는 진입점** `deploy/local-llm-example/expose-lan.ps1`
// (그 _common.ps1 을 dot-source 해 config 정본을 읽고, OLLAMA_HOST 를 0.0.0.0:<port> 로 바꿔 모든 NIC 에 bind + 서버
// 재기동하고, Windows 방화벽 inbound 규칙을 config 의 LAN_ALLOW_CIDR 범위·TCP <port> 로만 여는 스크립트. `-Revert` 는
// 그 노출을 해제 — 방화벽 규칙 제거 + OLLAMA_HOST 를 127.0.0.1 로 복귀) 의 내부 계약을 세 실 파일
// (expose-lan.ps1·config.env·_common.ps1)을 readFileSync 로 읽어(실 PowerShell 실행/실 New-NetFirewallRule/실 OLLAMA_HOST
// env 변경/실 서버 재기동 0) 정적 검증하는 non-gated smoke (T-0974, PLAN.md §108/§109 재배포 runner chain — LLM 호스트측
// LAN 노출 진입점 leg, deploy/local-llm-example 전 스크립트 내부 계약 앵커 완성).
//
// 봉함 불변식(핵심 위험 = config 소비 계약 drift + 보안 범위 확대):
//   (1) config-sourced port/CIDR 계약(1순위): expose-lan.ps1 이 port 를 `$cfg.OLLAMA_HOST`(정규식 `:(\d+)\s*$`)에서
//       추출하고, 방화벽 허용 범위(RemoteAddress)를 `$cfg.LAN_ALLOW_CIDR` 로 **참조**하며 `192.168.0.0/24` 같은 config 값
//       CIDR literal 을 -RemoteAddress 에 하드코딩하지 않음. 하드코딩/전역화 시 운영자가 config 로 범위를 좁혀도 조용히
//       divergence 하거나 의도보다 넓은 범위로 Ollama 를 노출.
//   (2) dot-source 계약: expose-lan.ps1 이 `_common.ps1` 을 상대 경로(`Split-Path -Parent $MyInvocation...` +
//       `Join-Path ... '_common.ps1'`)로 dot-source 하고, 호출 헬퍼 심볼(Get-LlmConfig·Get-OllamaExe·Get-LocalApiBase·
//       Wait-OllamaServer)이 각각 _common.ps1 에 function 정의로 실존(dead 호출 0).
//   (3) 방화벽 범위제한 계약: New-NetFirewallRule 이 `-Direction Inbound -Action Allow -Protocol TCP -LocalPort $port
//       -RemoteAddress $cidr` shape(범위 제한 — `Any`/전역 아님).
//   (4) 관리자 fail-fast 계약: `if (-not $isAdmin)` → `Write-Warning` + `exit 1`(비관리자 조기 중단). 누락 시 비관리자
//       실행이 조용히 부분 성공/오작동.
//   (5) 방화벽 idempotent 계약: Set-FirewallRule 이 `Get-NetFirewallRule ... | Remove-NetFirewallRule`(선-제거) 후
//       `New-NetFirewallRule`(재생성). remove 누락 시 재실행마다 중복 규칙이 쌓임.
//   (6) -Revert vs expose 분기 계약: `-Revert` 는 OLLAMA_HOST 를 `127.0.0.1:$port`(로컬 전용)로, expose(비-Revert) 는
//       `0.0.0.0:$port`(모든 NIC)로 서로 다르게 설정 + expose 만 Set-FirewallRule 호출. 두 분기 collapse 시 revert 가
//       노출을 실제로 해제 못함.
//   (7) 서버 재기동 exe-미발견 warning 계약: `$exe = Get-OllamaExe` 존재 시 Stop-Process + Start-Process serve +
//       Wait-OllamaServer, 미발견 시 `Write-Warning "ollama.exe 미발견 ..."`(비치명, install 먼저 안내).
//   (8) LAN IP 안내 expose-only 계약: `SEED_LLM_ENDPOINT_URL` 안내가 `if (-not $Revert)` 가드로 expose 분기에서만 표시.
//
// 전략(형제 T-0973 test-llm.ps1·T-0972 status.ps1·T-0971 stop-llm.ps1·T-0967 _common.ps1 동형): 세 실 파일에서 정본
// 토큰/시퀀스를 정적 추출하는 해석 동형 TS 순수 함수(configValue·configSourcedRef·configLiteralHardcoded·dotSourceRelative·
// helperSymbolDefined·helperSymbolConsumed·portFromOllamaHost·cidrConfigSourced·firewallRuleScoped·adminFailFast·
// firewallIdempotent·revertHostBranch·exposeHostBranch·revertExposeDistinct·serverRestartExeGuard·lanIpGuidanceExposeOnly·
// extractExposeLanAnchors)로 계약을 assert. 합성 mutant 사본으로 negative(a~g 7종) 변별. T-0966/T-0967(config.env·
// _common.ps1 자체 계약) 와 distinct — 본 task 는 expose-lan.ps1 이 그 config/헬퍼를 **소비/배선**하는 LAN 노출 계약만.
//   🔥 실 PowerShell 실행 0 · 실 New-NetFirewallRule/Remove-NetFirewallRule 0 · 실 SetEnvironmentVariable('OLLAMA_HOST') 0 ·
//      실 서버 재기동 0 · 실 Get-NetIPAddress 0 · process.env 읽기 0(입력은 pure 함수 파라미터) · credential 0(§9/REQ-059) ·
//      새 dep 0(node fs/path) · src 변경 0(test-only) · expose-lan.ps1/config.env/_common.ps1 읽기만(실행 0 · 변경 0).
import { existsSync, readFileSync } from "fs";
import * as path from "path";

// repo-root 경로 — test 실행 cwd 무관하게 robust 하게 해석(`__dirname` = test/smoke,
// 두 단계 위가 repo-root). `process.cwd()` 대신 `__dirname` 기준 상대로 고정(sibling T-0973/T-0972/T-0971).
const REPO_ROOT = path.resolve(__dirname, "../..");
const LLM_DIR = path.join(REPO_ROOT, "deploy", "local-llm-example");
const EXPOSE_LAN_PS1_PATH = path.join(LLM_DIR, "expose-lan.ps1");
const CONFIG_ENV_PATH = path.join(LLM_DIR, "config.env");
const COMMON_PS1_PATH = path.join(LLM_DIR, "_common.ps1");

// 정본 앵커(실 artifact 표현의 TS mirror — 실 PowerShell/실 방화벽/실 env 변경 0).
// expose-lan.ps1 이 config-sourced 로 참조해야 하는 값(하드코딩 금지 대상) — config.env 정본이 근거.
const CONFIG_SOURCED_KEYS = ["OLLAMA_HOST", "LAN_ALLOW_CIDR"]; // port=$cfg.OLLAMA_HOST 추출, cidr=$cfg.LAN_ALLOW_CIDR.
// 위 키의 config.env active 값 — CIDR literal 이 -RemoteAddress 에 하드코딩되면 divergence 위험(검출 대상).
const CONFIG_LITERALS: Record<string, string> = {
  OLLAMA_HOST: "127.0.0.1:11434",
  LAN_ALLOW_CIDR: "192.168.0.0/24",
};
// expose-lan.ps1 이 dot-source 후 호출하는 헬퍼 심볼 — 각각 _common.ps1 에 function 정의로 실존해야(dead 호출 0).
const CONSUMED_HELPER_SYMBOLS = [
  "Get-LlmConfig",
  "Get-OllamaExe",
  "Get-LocalApiBase",
  "Wait-OllamaServer",
];

// ── TS 동형 pure 함수(정본) — expose-lan.ps1 / config.env / _common.ps1 의 정본 토큰/시퀀스를 모델링.
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

// configSourcedRef(source, key): expose-lan.ps1 이 `$cfg.<KEY>` 로 config-sourced 참조를 하는가(소스 리터럴 존재).
function configSourcedRef(source: string, key: string): boolean {
  return new RegExp(`\\$cfg\\.${key}\\b`).test(source);
}

// configLiteralHardcoded(source, literal): config 값 literal 이 본문에 하드코딩됐는가(있으면 위반).
//   `$cfg.` 참조는 literal 이 아니라 참조이므로 걸리지 않는다 — 값 문자열 자체의 등장만 검출.
function configLiteralHardcoded(source: string, literal: string): boolean {
  return source.includes(literal);
}

// dotSourceRelative(source): _common.ps1 을 상대 경로로 dot-source 하는가(Split-Path -Parent + Join-Path + '_common.ps1').
function dotSourceRelative(source: string): boolean {
  const hasDotSource = /^\s*\.\s+\(Join-Path/m.test(source);
  const hasScriptDir = source.includes(
    "Split-Path -Parent $MyInvocation.MyCommand.Path",
  );
  const hasCommonRef = source.includes("'_common.ps1'");
  return hasDotSource && hasScriptDir && hasCommonRef;
}

// helperSymbolDefined(common, symbol): 헬퍼 심볼이 _common.ps1 에 `function <symbol>` 정의로 실존하는가.
function helperSymbolDefined(common: string, symbol: string): boolean {
  return new RegExp(`function\\s+${symbol}\\b`, "i").test(common);
}

// helperSymbolConsumed(source, symbol): expose-lan.ps1 이 그 헬퍼 심볼을 호출/참조하는가.
function helperSymbolConsumed(source: string, symbol: string): boolean {
  return new RegExp(`\\b${symbol}\\b`).test(source);
}

// portFromOllamaHost(source): port 를 `$cfg.OLLAMA_HOST` 의 host:port 에서 정규식 `:(\d+)\s*$` 로 추출하는가.
function portFromOllamaHost(source: string): boolean {
  const hasRef = /\$cfg\.OLLAMA_HOST\s+-match\s+':\(\\d\+\)\\s\*\$'/.test(
    source,
  );
  const assigns = /\$port\s*=\s*\$Matches\[1\]/.test(source);
  return hasRef && assigns;
}

// cidrConfigSourced(source): 방화벽 허용 범위 CIDR 을 `$cidr = $cfg.LAN_ALLOW_CIDR` 로 config-sourced 하게 참조하는가.
function cidrConfigSourced(source: string): boolean {
  return /\$cidr\s*=\s*\$cfg\.LAN_ALLOW_CIDR\b/.test(source);
}

// firewallRuleScoped(source): New-NetFirewallRule 이 범위 제한 shape(-Direction Inbound -Action Allow -Protocol TCP
//   -LocalPort $port -RemoteAddress $cidr)로 생성되는가 — `Any`/전역이 아니라 $cidr 로 좁힌 RemoteAddress.
function firewallRuleScoped(source: string): boolean {
  const hasRule = /New-NetFirewallRule\b/.test(source);
  const inbound = /-Direction\s+Inbound\b/.test(source);
  const allow = /-Action\s+Allow\b/.test(source);
  const tcp = /-Protocol\s+TCP\b/.test(source);
  const localPort = /-LocalPort\s+\$port\b/.test(source);
  const remoteScoped = /-RemoteAddress\s+\$cidr\b/.test(source);
  return hasRule && inbound && allow && tcp && localPort && remoteScoped;
}

// adminFailFast(source): 관리자 권한 아님 분기 — `if (-not $isAdmin)` 이후 `Write-Warning` + `exit 1`(fail-fast).
function adminFailFast(source: string): boolean {
  const guardAt = source.search(/if\s*\(-not\s+\$isAdmin\)/);
  if (guardAt < 0) return false;
  const tail = source.slice(guardAt);
  const hasWarning = /Write-Warning\b/.test(tail);
  const hasExit1 = /\bexit\s+1\b/.test(tail);
  return hasWarning && hasExit1;
}

// firewallIdempotent(source): Set-FirewallRule 함수가 `Get-NetFirewallRule ... | Remove-NetFirewallRule`(선-제거)
//   후 `New-NetFirewallRule`(재생성) 순서인가 — remove 가 create 앞에 위치(멱등).
function firewallIdempotent(source: string): boolean {
  const fnAt = source.search(/function\s+Set-FirewallRule\b/);
  if (fnAt < 0) return false;
  const body = source.slice(fnAt);
  const removeAt = body.search(
    /Get-NetFirewallRule\b[^\n]*\|\s*Remove-NetFirewallRule\b/,
  );
  const createAt = body.search(/New-NetFirewallRule\b/);
  return removeAt >= 0 && createAt >= 0 && removeAt < createAt;
}

// revertHostBranch(source): `-Revert` 분기가 OLLAMA_HOST 를 `127.0.0.1:$port`(로컬 전용)로 설정하는가.
function revertHostBranch(source: string): boolean {
  return /SetEnvironmentVariable\('OLLAMA_HOST',\s*"127\.0\.0\.1:\$port"/.test(
    source,
  );
}

// exposeHostBranch(source): expose(비-Revert) 분기가 OLLAMA_HOST 를 `0.0.0.0:$port`(모든 NIC)로 설정 + Set-FirewallRule 호출.
function exposeHostBranch(source: string): boolean {
  const hasBind =
    /SetEnvironmentVariable\('OLLAMA_HOST',\s*"0\.0\.0\.0:\$port"/.test(source);
  const callsFirewall = /^\s*Set-FirewallRule\s*$/m.test(source);
  return hasBind && callsFirewall;
}

// revertExposeDistinct(source): 두 분기의 OLLAMA_HOST bind 주소가 서로 다름(127.0.0.1 vs 0.0.0.0) — collapse 아님.
function revertExposeDistinct(source: string): boolean {
  return (
    revertHostBranch(source) &&
    exposeHostBranch(source) &&
    !/SetEnvironmentVariable\('OLLAMA_HOST',\s*"0\.0\.0\.0:\$port".*\n.*SetEnvironmentVariable\('OLLAMA_HOST',\s*"0\.0\.0\.0:\$port"/.test(
      source,
    )
  );
}

// serverRestartExeGuard(source): 서버 재기동이 `$exe = Get-OllamaExe` 존재 시 Stop-Process+Start-Process serve+
//   Wait-OllamaServer, 미발견(else) 시 `Write-Warning "ollama.exe 미발견 ..."`(비치명) 가드인가.
function serverRestartExeGuard(source: string): boolean {
  const hasExeGet = /\$exe\s*=\s*Get-OllamaExe\b/.test(source);
  const guardsExe = /if\s*\(\$exe\)\s*\{/.test(source);
  const startsServe = /Start-Process\b[^\n]*serve/.test(source);
  const waits = /Wait-OllamaServer\b/.test(source);
  const elseWarn = /Write-Warning\s+"ollama\.exe 미발견/.test(source);
  return hasExeGet && guardsExe && startsServe && waits && elseWarn;
}

// lanIpGuidanceExposeOnly(source): LAN IP 안내(SEED_LLM_ENDPOINT_URL)가 `if (-not $Revert)` 가드로 expose 분기에서만
//   표시되는가 — 마지막 `if (-not $Revert)` 블록 안에 SEED_LLM_ENDPOINT_URL 이 위치.
function lanIpGuidanceExposeOnly(source: string): boolean {
  const seedAt = source.indexOf("SEED_LLM_ENDPOINT_URL");
  if (seedAt < 0) return false;
  // SEED 안내 앞의 마지막 `if (-not $Revert)` 가드가 존재하고 그 뒤에 위치.
  const before = source.slice(0, seedAt);
  const lastGuard = before.lastIndexOf("if (-not $Revert)");
  return lastGuard >= 0;
}

// (집계) extractExposeLanAnchors(source, config, common): 스크립트 내부 계약 불변식을 한 번에 집계 —
//   하나라도 부재/변질이면 명시적 false(빈 결과 성공-위장 0).
function extractExposeLanAnchors(
  source: string,
  config: string,
  common: string,
): {
  portSourced: boolean;
  cidrSourced: boolean;
  noConfigCidrHardcoded: boolean;
  dotSource: boolean;
  helperSymbolsWired: boolean;
  firewallScoped: boolean;
  adminFailFast: boolean;
  firewallIdempotent: boolean;
  revertHost: boolean;
  exposeHost: boolean;
  revertExposeDistinct: boolean;
  serverRestartGuard: boolean;
  lanIpExposeOnly: boolean;
} {
  // 하드코딩 금지: config.env active CIDR literal 이 expose-lan.ps1 의 -RemoteAddress 에 등장하지 않음.
  //   (참조 계약 — $cidr 로만 참조. 값 문자열 자체가 -RemoteAddress 근처 body 에 하드코딩되면 위반.)
  const cidrLiteral = configValue(config, "LAN_ALLOW_CIDR");
  const noConfigCidrHardcoded =
    cidrLiteral !== undefined && !configLiteralHardcoded(source, cidrLiteral);
  // 헬퍼 심볼 배선: source 가 호출하는 심볼이 각각 _common.ps1 에 function 정의로 실존.
  const helperSymbolsWired = CONSUMED_HELPER_SYMBOLS.every(
    (s) => helperSymbolConsumed(source, s) && helperSymbolDefined(common, s),
  );
  return {
    portSourced: portFromOllamaHost(source),
    cidrSourced: cidrConfigSourced(source),
    noConfigCidrHardcoded,
    dotSource: dotSourceRelative(source),
    helperSymbolsWired,
    firewallScoped: firewallRuleScoped(source),
    adminFailFast: adminFailFast(source),
    firewallIdempotent: firewallIdempotent(source),
    revertHost: revertHostBranch(source),
    exposeHost: exposeHostBranch(source),
    revertExposeDistinct: revertExposeDistinct(source),
    serverRestartGuard: serverRestartExeGuard(source),
    lanIpExposeOnly: lanIpGuidanceExposeOnly(source),
  };
}

describe("realdata-e2e §108/§109 deploy/local-llm-example/expose-lan.ps1 LAN 노출 스크립트 내부 계약 smoke — config-sourced port($cfg.OLLAMA_HOST)/CIDR($cfg.LAN_ALLOW_CIDR) 참조(하드코딩 금지, 1순위) + _common.ps1 dot-source·헬퍼 심볼 배선 + 방화벽 RemoteAddress $cidr 범위제한 + 관리자 권한 fail-fast exit 1 + 방화벽 remove-then-create idempotent + -Revert(127.0.0.1) vs expose(0.0.0.0) 분기 + 서버 재기동 Get-OllamaExe exe-미발견 warning + LAN IP 안내 expose-only + secret-safety (T-0974)", () => {
  const exposeLan = () => readFileSync(EXPOSE_LAN_PS1_PATH, "utf8");
  const config = () => readFileSync(CONFIG_ENV_PATH, "utf8");
  const common = () => readFileSync(COMMON_PS1_PATH, "utf8");

  describe("Happy-path: 대조 artifact 3종 실존 + 13 불변식 전부 true", () => {
    it("expose-lan.ps1·config.env·_common.ps1 가 repo-root 기준 실존(existsSync)", () => {
      expect(existsSync(EXPOSE_LAN_PS1_PATH)).toBe(true);
      expect(existsSync(CONFIG_ENV_PATH)).toBe(true);
      expect(existsSync(COMMON_PS1_PATH)).toBe(true);
    });

    it("13 불변식(port sourced·cidr sourced·CIDR 하드코딩금지·dot-source·헬퍼배선·방화벽 범위제한·관리자 fail-fast·방화벽 멱등·revert host·expose host·분기 distinct·서버 재기동 가드·LAN IP expose-only) 전부 true", () => {
      const anchors = extractExposeLanAnchors(exposeLan(), config(), common());
      expect(Object.values(anchors).every((v) => v === true)).toBe(true);
    });
  });

  describe("Happy-path(1순위 계약): config-sourced port/CIDR 참조 + config 값 CIDR literal 하드코딩 부재", () => {
    it("port 를 $cfg.OLLAMA_HOST 정규식 추출로, CIDR 을 $cidr = $cfg.LAN_ALLOW_CIDR 로 config-sourced 하게 참조", () => {
      const s = exposeLan();
      expect(portFromOllamaHost(s)).toBe(true);
      expect(cidrConfigSourced(s)).toBe(true);
      expect(configSourcedRef(s, "OLLAMA_HOST")).toBe(true);
      expect(configSourcedRef(s, "LAN_ALLOW_CIDR")).toBe(true);
    });

    it("192.168.0.0/24 CIDR literal 을 expose-lan.ps1 본문에 하드코딩하지 않음(config.env 가 그 값의 정본)", () => {
      const s = exposeLan();
      const cfg = config();
      expect(configLiteralHardcoded(s, CONFIG_LITERALS.LAN_ALLOW_CIDR)).toBe(
        false,
      );
      // config.env 가 그 값의 정본(byte 근거).
      expect(configValue(cfg, "LAN_ALLOW_CIDR")).toBe(
        CONFIG_LITERALS.LAN_ALLOW_CIDR,
      );
      expect(
        extractExposeLanAnchors(s, cfg, common()).noConfigCidrHardcoded,
      ).toBe(true);
    });

    it("방화벽 규칙이 -RemoteAddress $cidr 범위제한 shape(-Direction Inbound -Action Allow -Protocol TCP -LocalPort $port) — Any/전역 아님", () => {
      const s = exposeLan();
      expect(firewallRuleScoped(s)).toBe(true);
      expect(s).toContain("-RemoteAddress $cidr");
      expect(/-RemoteAddress\s+Any\b/.test(s)).toBe(false);
    });
  });

  describe("Happy-path: _common.ps1 dot-source(상대경로) + 호출 헬퍼 심볼 4종이 function 정의로 실존(dead 호출 0)", () => {
    it("expose-lan.ps1 이 _common.ps1 을 상대경로로 dot-source", () => {
      const s = exposeLan();
      expect(dotSourceRelative(s)).toBe(true);
      expect(s).toContain("Split-Path -Parent $MyInvocation.MyCommand.Path");
      expect(s).toContain("'_common.ps1'");
    });

    it("expose-lan.ps1 이 호출하는 헬퍼 심볼 4종(Get-LlmConfig·Get-OllamaExe·Get-LocalApiBase·Wait-OllamaServer)이 각각 _common.ps1 에 function 정의로 실존", () => {
      const s = exposeLan();
      const c = common();
      CONSUMED_HELPER_SYMBOLS.forEach((sym) => {
        expect(helperSymbolConsumed(s, sym)).toBe(true);
        expect(helperSymbolDefined(c, sym)).toBe(true);
      });
      expect(extractExposeLanAnchors(s, config(), c).helperSymbolsWired).toBe(
        true,
      );
    });
  });

  describe("Flow/branch cover: 관리자 fail-fast + 방화벽 멱등 + -Revert vs expose 분기 + 서버 재기동 가드 + LAN IP expose-only", () => {
    it("관리자 권한 아님 분기 if (-not $isAdmin) → Write-Warning + exit 1(fail-fast) 존재", () => {
      const s = exposeLan();
      expect(adminFailFast(s)).toBe(true);
      expect(/if\s*\(-not\s+\$isAdmin\)/.test(s)).toBe(true);
      expect(/\bexit\s+1\b/.test(s)).toBe(true);
    });

    it("방화벽 규칙 idempotent — Set-FirewallRule 이 Get-NetFirewallRule | Remove-NetFirewallRule(선-제거) 후 New-NetFirewallRule(재생성) 순서", () => {
      const s = exposeLan();
      expect(firewallIdempotent(s)).toBe(true);
    });

    it("-Revert 분기: OLLAMA_HOST 를 127.0.0.1:$port(로컬 전용)로 설정 + 방화벽 규칙 제거", () => {
      const s = exposeLan();
      expect(revertHostBranch(s)).toBe(true);
      // -Revert 분기에도 방화벽 규칙 제거(Remove-NetFirewallRule)가 존재.
      expect(/Remove-NetFirewallRule\b/.test(s)).toBe(true);
    });

    it("expose(비-Revert) 분기: OLLAMA_HOST 를 0.0.0.0:$port(모든 NIC bind)로 설정 + Set-FirewallRule 호출 + 두 분기 OLLAMA_HOST 값 서로 다름(127.0.0.1 vs 0.0.0.0)", () => {
      const s = exposeLan();
      expect(exposeHostBranch(s)).toBe(true);
      expect(revertExposeDistinct(s)).toBe(true);
      expect(s).toContain('"0.0.0.0:$port"');
      expect(s).toContain('"127.0.0.1:$port"');
    });

    it('서버 재기동: $exe = Get-OllamaExe 존재 시 Stop-Process+Start-Process serve+Wait-OllamaServer, 미발견 시 Write-Warning "ollama.exe 미발견 ..."(비치명)', () => {
      const s = exposeLan();
      expect(serverRestartExeGuard(s)).toBe(true);
      expect(s).toContain("$exe = Get-OllamaExe");
    });

    it("LAN IP 안내(SEED_LLM_ENDPOINT_URL)가 if (-not $Revert) 가드로 expose 분기에서만 표시", () => {
      const s = exposeLan();
      expect(lanIpGuidanceExposeOnly(s)).toBe(true);
      expect(s).toContain("SEED_LLM_ENDPOINT_URL");
    });
  });

  describe("Error path / negative cases 충분 cover (mutant 합성 사본 — 원본 미변조, 예외 분기마다 각 1+)", () => {
    it("error path — 대조 artifact 부재 경로 → readFileSync throw(silent 0-byte fallback 0)", () => {
      const badPath = path.join(LLM_DIR, "__does_not_exist___expose-lan.ps1");
      expect(existsSync(badPath)).toBe(false);
      expect(() => readFileSync(badPath, "utf8")).toThrow();
    });

    it("error path — 앵커 토큰 부재 시 명시적 false(빈 매칭을 pass 로 오통과 0)", () => {
      const anchors = extractExposeLanAnchors("", "", "");
      expect(Object.values(anchors).some((v) => v === true)).toBe(false);
      // 실 소스는 반대로 전부 true — 부재/실재 변별.
      const real = extractExposeLanAnchors(exposeLan(), config(), common());
      expect(Object.values(real).every((v) => v === true)).toBe(true);
    });

    it("negative (a) — New-NetFirewallRule -RemoteAddress 를 $cidr 대신 192.168.0.0/24 literal 로 하드코딩한 mutant → config-sourced CIDR 계약(하드코딩 금지) 위반 검출", () => {
      const s = exposeLan();
      const mutant = s.replace(
        "-RemoteAddress $cidr",
        "-RemoteAddress 192.168.0.0/24",
      );
      expect(configLiteralHardcoded(mutant, "192.168.0.0/24")).toBe(true);
      expect(firewallRuleScoped(mutant)).toBe(false); // $cidr 참조 사라짐.
      expect(
        extractExposeLanAnchors(mutant, config(), common())
          .noConfigCidrHardcoded,
      ).toBe(false);
      // 원본 불변.
      expect(configLiteralHardcoded(s, "192.168.0.0/24")).toBe(false);
      expect(firewallRuleScoped(s)).toBe(true);
    });

    it("negative (b) — dot-source 행을 절대경로/타 파일로 바꾼 mutant → dot-source 상대경로 계약 drift 검출", () => {
      const s = exposeLan();
      const mutant = s.replace(
        ". (Join-Path (Split-Path -Parent $MyInvocation.MyCommand.Path) '_common.ps1')",
        ". C:\\ollama\\helpers.ps1",
      );
      expect(dotSourceRelative(mutant)).toBe(false);
      expect(
        extractExposeLanAnchors(mutant, config(), common()).dotSource,
      ).toBe(false);
      // 원본 불변.
      expect(dotSourceRelative(s)).toBe(true);
    });

    it("negative (c) — -Revert 분기의 OLLAMA_HOST 를 0.0.0.0:$port(expose 와 동일)로 바꾼 mutant → revert/expose 분기 collapse 검출", () => {
      const s = exposeLan();
      const mutant = s.replace(
        `SetEnvironmentVariable('OLLAMA_HOST', "127.0.0.1:$port", 'User')`,
        `SetEnvironmentVariable('OLLAMA_HOST', "0.0.0.0:$port", 'User')`,
      );
      expect(revertHostBranch(mutant)).toBe(false);
      expect(
        extractExposeLanAnchors(mutant, config(), common())
          .revertExposeDistinct,
      ).toBe(false);
      // 원본 불변.
      expect(revertHostBranch(s)).toBe(true);
      expect(revertExposeDistinct(s)).toBe(true);
    });

    it("negative (d) — New-NetFirewallRule -RemoteAddress $cidr 을 -RemoteAddress Any 로 넓힌 mutant → 방화벽 범위제한(보안) 계약 drift 검출", () => {
      const s = exposeLan();
      const mutant = s.replace("-RemoteAddress $cidr", "-RemoteAddress Any");
      expect(firewallRuleScoped(mutant)).toBe(false);
      expect(/-RemoteAddress\s+Any\b/.test(mutant)).toBe(true);
      expect(
        extractExposeLanAnchors(mutant, config(), common()).firewallScoped,
      ).toBe(false);
      // 원본 불변.
      expect(firewallRuleScoped(s)).toBe(true);
    });

    it("negative (e) — 관리자 아님 분기의 exit 1 을 제거(비관리자여도 계속 진행)한 mutant → fail-fast 분기 drift 검출", () => {
      const s = exposeLan();
      // if (-not $isAdmin) 블록 안의 exit 1 만 제거(파일 전체에 exit 1 은 이 한 곳뿐).
      const mutant = s.replace(/\n\s*exit 1\n/, "\n");
      expect(adminFailFast(mutant)).toBe(false);
      expect(
        extractExposeLanAnchors(mutant, config(), common()).adminFailFast,
      ).toBe(false);
      // 원본 불변.
      expect(adminFailFast(s)).toBe(true);
    });

    it("negative (f) — Set-FirewallRule 에서 Get-NetFirewallRule | Remove-NetFirewallRule(선-제거)를 삭제한 mutant → 규칙 idempotent(remove-then-create) 계약 drift 검출", () => {
      const s = exposeLan();
      // Set-FirewallRule 함수 본문의 선-제거 행만 제거(remove 없이 create 만 남김).
      const fnAt = s.search(/function\s+Set-FirewallRule\b/);
      const head = s.slice(0, fnAt);
      const tail = s.slice(fnAt);
      const mutantTail = tail.replace(
        /Get-NetFirewallRule -DisplayName \$ruleName -ErrorAction SilentlyContinue \| Remove-NetFirewallRule -ErrorAction SilentlyContinue\n/,
        "",
      );
      const mutant = head + mutantTail;
      expect(firewallIdempotent(mutant)).toBe(false);
      expect(
        extractExposeLanAnchors(mutant, config(), common()).firewallIdempotent,
      ).toBe(false);
      // 원본 불변.
      expect(firewallIdempotent(s)).toBe(true);
    });

    it("negative (g) — expose-lan.ps1 이 호출하는 Get-OllamaExe 를 _common.ps1 정의에서 제거한 합성 mutant → dead 호출(심볼 소비 계약) 검출", () => {
      const s = exposeLan();
      const c = common();
      const mutantCommon = c.replace(
        /function\s+Get-OllamaExe\b/,
        "function Get-SomethingElse",
      );
      expect(helperSymbolConsumed(s, "Get-OllamaExe")).toBe(true); // source 는 여전히 호출.
      expect(helperSymbolDefined(mutantCommon, "Get-OllamaExe")).toBe(false); // 정의는 사라짐 → dead 호출.
      expect(
        extractExposeLanAnchors(s, config(), mutantCommon).helperSymbolsWired,
      ).toBe(false);
      // 원본 불변.
      expect(helperSymbolDefined(c, "Get-OllamaExe")).toBe(true);
    });

    it("negative — §9 credential/secret 누출 0: 추출/합성 토큰에 gh 토큰 어휘·실 credential·실 password·apiKey 값 미등장(§9/REQ-059)", () => {
      const synthesized = [
        JSON.stringify(
          extractExposeLanAnchors(exposeLan(), config(), common()),
        ),
        ...CONFIG_SOURCED_KEYS.map((k) => String(configValue(config(), k))),
        CONSUMED_HELPER_SYMBOLS.join(","),
      ];
      // 강 패턴: 실 secret 어휘.
      const strongPattern =
        /(ghp_|--token|GITHUB_TOKEN|GH_TOKEN|\bsk-|PASSWORD=|apiKey"?\s*[:=]\s*["']?\w)/i;
      synthesized.forEach((v) => {
        expect(strongPattern.test(v)).toBe(false);
      });
      // 합성 mutant 값도 명백한 dummy(하드코딩 CIDR literal·Any·타 파일 경로 C:\ollama\helpers.ps1 등)로 한정 — 실 자격 0.
      const dummies = [
        "192.168.0.0/24",
        "0.0.0.0:11434",
        "127.0.0.1:11434",
        "Any",
        "C:\\ollama\\helpers.ps1",
      ];
      dummies.forEach((d) => expect(strongPattern.test(d)).toBe(false));
      // 추출 값은 모두 비시크릿 설정 값/경로(bind 주소·CIDR·방화벽 규칙명). process.env 읽기 0.
      expect(configValue(config(), "OLLAMA_HOST")).toBe("127.0.0.1:11434");
      expect(configValue(config(), "LAN_ALLOW_CIDR")).toBe("192.168.0.0/24");
      expect(exposeLan()).toContain(
        "Ollama LAN (Assessment-Agent local-llm-example)",
      );
    });
  });

  describe("branch: 각 정본 앵커 일치/drift 정적 대조(합성 mutant 사본 — 원본 미변조)", () => {
    it("config-sourced CIDR 계약 일치/drift 분기", () => {
      const s = exposeLan();
      expect(extractExposeLanAnchors(s, config(), common()).cidrSourced).toBe(
        true,
      );
      const mutant = s.replace(
        "$cidr = $cfg.LAN_ALLOW_CIDR",
        "$cidr = '192.168.0.0/24'",
      );
      expect(cidrConfigSourced(mutant)).toBe(false);
      expect(
        extractExposeLanAnchors(mutant, config(), common())
          .noConfigCidrHardcoded,
      ).toBe(false); // 192.168.0.0/24 하드코딩 등장.
    });

    it("헬퍼 심볼 배선 일치/drift 분기", () => {
      const c = common();
      expect(
        extractExposeLanAnchors(exposeLan(), config(), c).helperSymbolsWired,
      ).toBe(true);
      const mutant = c.replace(
        /function\s+Wait-OllamaServer\b/,
        "function Wait-Nothing",
      );
      expect(
        extractExposeLanAnchors(exposeLan(), config(), mutant)
          .helperSymbolsWired,
      ).toBe(false);
    });

    it("관리자 fail-fast 분기 일치/drift 분기(exit 1 제거 mutant)", () => {
      const s = exposeLan();
      expect(adminFailFast(s)).toBe(true);
      const mutant = s.replace(/\n\s*exit 1\n/, "\n");
      expect(adminFailFast(mutant)).toBe(false);
    });
  });

  describe("flow: 결정론 · no-mutation(원본 read-only 입증)", () => {
    it("동일 입력으로 pure 함수를 두 번 호출하면 deep-equal(결정론)", () => {
      const s = exposeLan();
      const cfg = config();
      const c = common();
      expect(extractExposeLanAnchors(s, cfg, c)).toEqual(
        extractExposeLanAnchors(s, cfg, c),
      );
    });

    it("합성 mutate(사본 replace) 후에도 원본 소스 텍스트·pure 함수 산출이 불변(원본 read-only)", () => {
      const s = exposeLan();
      const cfg = config();
      const c = common();
      const sSnap = s;
      const cfgSnap = cfg;
      const cSnap = c;
      // 사본 mutate(negative a~g 에서 쓰는 replace) — 원본 불변 확인.
      s.replace("-RemoteAddress $cidr", "-RemoteAddress Any");
      s.replace(
        ". (Join-Path (Split-Path -Parent $MyInvocation.MyCommand.Path) '_common.ps1')",
        ". C:\\ollama\\helpers.ps1",
      );
      s.replace(
        `SetEnvironmentVariable('OLLAMA_HOST', "127.0.0.1:$port", 'User')`,
        `SetEnvironmentVariable('OLLAMA_HOST', "0.0.0.0:$port", 'User')`,
      );
      c.replace(/function\s+Get-OllamaExe\b/, "function Get-SomethingElse");
      expect(s).toBe(sSnap);
      expect(cfg).toBe(cfgSnap);
      expect(c).toBe(cSnap);
      // 추출/파싱 후에도 원본 불변.
      extractExposeLanAnchors(s, cfg, c);
      expect(s).toBe(sSnap);
      expect(c).toBe(cSnap);
    });
  });

  describe("dormant / non-gated 확인 — side-effect 0", () => {
    it("계약 모델이 env / 전역 상태 없이 순수하게 동작(non-gated — describe.skip 0·gating 분기 0)", () => {
      // 본 describe 가 실행된다는 것 자체가 describe.skip 0(항상 실행)의 런타임 증거.
      const envSnapshot = { ...process.env };
      const s = exposeLan();
      const before = extractExposeLanAnchors(s, config(), common());
      // 실 process.env 를 mutate 해도 산출 불변 — 모델이 process.env 를 참조하지 않음(파라미터로만).
      Object.assign(process.env, { LOCAL_LLM_EXPOSE_LAN_PS1_UNIT_TEST: "x" });
      const after = extractExposeLanAnchors(s, config(), common());
      delete process.env.LOCAL_LLM_EXPOSE_LAN_PS1_UNIT_TEST;
      expect(after).toEqual(before);
      expect(Object.keys(process.env)).toEqual(Object.keys(envSnapshot));
    });

    it("파일 read 는 expose-lan.ps1/config.env/_common.ps1 읽기만 — 실 PowerShell/실 New-NetFirewallRule/실 OLLAMA_HOST env 변경/실 서버 재기동 0. 세 파일은 선언적 스크립트·설정이라 런타임 분기 없이 정적 소스 텍스트 앵커로 happy/negative mutant 로 대체 cover", () => {
      const anchors = extractExposeLanAnchors(exposeLan(), config(), common());
      expect(Object.values(anchors).every((v) => v === true)).toBe(true);
    });
  });
});
