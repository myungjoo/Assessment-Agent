// realdata-e2e-local-llm-example-test-llm-ps1-chat-completions-wire-bearer-utf8-body-throw-exit-branch-contract.smoke-spec.ts
// — 로컬 Ollama live-LLM 운영 premise leg 후속. T-0966 이 `config.env`(LLM 호스트측 설정 정본)·T-0967 이 그 config 를
// 코드로 소비하는 공용 헬퍼 `_common.ps1`(모든 로컬 LLM 스크립트가 dot-source 하는 single-source 헬퍼)·T-0968 이 운영자
// README·T-0969 가 1순위 설치 진입점 `install.ps1`·T-0970 이 2순위 기동/예열 진입점 `start-llm.ps1`·T-0971 이 3순위 자원
// 해제 진입점 `stop-llm.ps1`·T-0972 가 4순위 read-only 진단 진입점 `status.ps1` 을 봉했다. 본 task 는 운영자가 **실제로
// 로컬 LLM 이 Assessment-Agent 연동에 쓸 수 있는지 최종 검증하려고 쓰는 스모크 진입점** `deploy/local-llm-example/test-llm.ps1`
// (그 _common.ps1 을 dot-source 해 config 정본을 읽고 서버 기동을 보장한 뒤, **AA 의 openai-compatible.adapter 와 동일한
// wire 포맷**(POST {apiBase}/v1/chat/completions + Authorization: Bearer + {model, messages})으로 실제 chat completion 을
// 쳐 보고 응답을 표시하는 스크립트) 의 내부 계약을 세 실 파일(test-llm.ps1·config.env·_common.ps1)을 readFileSync 로
// 읽어(실 PowerShell 실행/실 Ollama 기동/실 HTTP POST(/v1/chat/completions)/실 Invoke-RestMethod 0) 정적 검증하는
// non-gated smoke (T-0973, PLAN.md §108/§109 재배포 runner chain — LLM 호스트측 최종 실-검증 진입점 leg).
//
// 봉함 불변식(핵심 위험 = wire 포맷/설정 소비 계약 drift):
//   (1) config-sourced model/api base 계약(1순위): test-llm.ps1 이 model 을 `$cfg.OLLAMA_MODEL` 로, api base 를
//       `Get-LocalApiBase -OllamaHost $cfg.OLLAMA_HOST` 로 참조하고 `gemma4:12b`·`127.0.0.1:11434` 같은 config 값 literal
//       을 본문에 하드코딩하지 않음. 하드코딩 시 config.env 정본(T-0966)과 조용히 divergence → 운영자가 config 를 바꿔도
//       스모크가 옛 값을 침.
//   (2) dot-source 계약: test-llm.ps1 이 `_common.ps1` 을 상대 경로(`Split-Path -Parent $MyInvocation...` +
//       `Join-Path ... '_common.ps1'`)로 dot-source 하고, 호출 헬퍼 심볼(Get-LlmConfig·Get-LocalApiBase·
//       Start-OllamaServerIfNeeded)이 각각 _common.ps1 에 function 정의로 실존(dead 호출 0).
//   (3) wire 포맷 계약: 요청 URL 이 `$apiBase/v1/chat/completions`(OpenAI 호환 /v1 경로 — AA adapter 와 동일)이고,
//       payload 가 model + messages(role user·content $Prompt) shape, ContentType 이 `application/json; charset=utf-8`.
//       `/api/chat`(Ollama 네이티브) 등으로 어긋나면 AA 연동 검증 의미 상실.
//   (4) Bearer 헤더 계약: `Authorization = 'Bearer ...'`(비어있지 않은 값 — adapter 가 요구). 빈 값/누락 시 adapter 거부.
//   (5) UTF-8 body 바이트 계약: `[System.Text.Encoding]::UTF8.GetBytes($payload)` 로 UTF-8 바이트를 -Body 로 전송.
//       PowerShell 5.1 의 -Body(문자열)은 Latin1 로 인코딩해 한국어가 '?' 로 깨지므로 직접 바이트 변환이 계약.
//   (6) 서버 기동 실패 throw 분기(fail-fast): `if (-not (Start-OllamaServerIfNeeded ...)) { throw ... }`. throw 누락 시
//       서버 없이 계속 진행해 오작동.
//   (7) 성공 소비 + catch exit 분기: 성공 시 `$resp.choices[0].message.content`(OpenAI 응답 shape) 소비,
//       실패 catch 분기 `Write-Host "스모크 테스트 실패:" ...` + `exit 1`(실패 코드). + UTF-8 콘솔 출력 시도
//       `try { [Console]::OutputEncoding = ... } catch {}`(비치명).
//
// 전략(형제 T-0972 status.ps1·T-0971 stop-llm.ps1·T-0970 start-llm.ps1·T-0967 _common.ps1 동형): 세 실 파일에서 정본
// 토큰/시퀀스를 정적 추출하는 해석 동형 TS 순수 함수(configValue·configSourcedRef·configLiteralHardcoded·
// dotSourceRelative·helperSymbolDefined·helperSymbolConsumed·apiBaseConfigSourced·modelConfigSourced·wireCompletionsUrl·
// payloadShape·bearerHeaderNonEmpty·utf8BodyBytes·jsonCharsetContentType·serverEnsureThrow·choicesContentConsumed·
// catchExitBranch·consoleUtf8Try·extractTestLlmAnchors)로 계약을 assert. 합성 mutant 사본으로 negative(a~g 7종) 변별.
// T-0966/T-0967(config.env·_common.ps1 자체 계약) 와 distinct — 본 task 는 test-llm.ps1 이 그 config/헬퍼를 **소비/배선**
// 하는 wire 검증 계약만.
//   🔥 실 PowerShell 실행 0 · 실 Ollama 기동 0 · 실 HTTP POST(/v1/chat/completions) 0 · 실 Invoke-RestMethod 0 ·
//      실 chat completion 0 · process.env 읽기 0(입력은 pure 함수 파라미터) · credential 0(§9/REQ-059) ·
//      새 dep 0(node fs/path) · src 변경 0(test-only) · test-llm.ps1/config.env/_common.ps1 읽기만(실행 0 · 변경 0).
import { existsSync, readFileSync } from "fs";
import * as path from "path";

// repo-root 경로 — test 실행 cwd 무관하게 robust 하게 해석(`__dirname` = test/smoke,
// 두 단계 위가 repo-root). `process.cwd()` 대신 `__dirname` 기준 상대로 고정(sibling T-0972/T-0971/T-0970).
const REPO_ROOT = path.resolve(__dirname, "../..");
const LLM_DIR = path.join(REPO_ROOT, "deploy", "local-llm-example");
const TEST_LLM_PS1_PATH = path.join(LLM_DIR, "test-llm.ps1");
const CONFIG_ENV_PATH = path.join(LLM_DIR, "config.env");
const COMMON_PS1_PATH = path.join(LLM_DIR, "_common.ps1");

// 정본 앵커(실 artifact 표현의 TS mirror — 실 PowerShell/실 Ollama 0).
// test-llm.ps1 이 config-sourced 로 참조해야 하는 값(하드코딩 금지 대상) — config.env 정본이 근거.
const CONFIG_SOURCED_KEYS = ["OLLAMA_MODEL", "OLLAMA_HOST"]; // model=$cfg.OLLAMA_MODEL, host=$cfg.OLLAMA_HOST.
// 위 키의 config.env active 값 — test-llm.ps1 본문에 literal 로 등장하면 divergence 위험(하드코딩 검출 대상).
const CONFIG_LITERALS: Record<string, string> = {
  OLLAMA_MODEL: "gemma4:12b",
  OLLAMA_HOST: "127.0.0.1:11434",
};
// test-llm.ps1 이 dot-source 후 호출하는 헬퍼 심볼 — 각각 _common.ps1 에 function 정의로 실존해야(dead 호출 0).
const CONSUMED_HELPER_SYMBOLS = [
  "Get-LlmConfig",
  "Get-LocalApiBase",
  "Start-OllamaServerIfNeeded",
];

// ── TS 동형 pure 함수(정본) — test-llm.ps1 / config.env / _common.ps1 의 정본 토큰/시퀀스를 모델링.
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

// configSourcedRef(source, key): test-llm.ps1 이 `$cfg.<KEY>` 로 config-sourced 참조를 하는가(소스 리터럴 존재).
function configSourcedRef(source: string, key: string): boolean {
  return new RegExp(`\\$cfg\\.${key}\\b`).test(source);
}

// configLiteralHardcoded(source, literal): config 값 literal 이 test-llm.ps1 본문에 하드코딩됐는가(있으면 위반).
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

// helperSymbolConsumed(source, symbol): test-llm.ps1 이 그 헬퍼 심볼을 호출/참조하는가.
function helperSymbolConsumed(source: string, symbol: string): boolean {
  return new RegExp(`\\b${symbol}\\b`).test(source);
}

// apiBaseConfigSourced(source): api base 를 `Get-LocalApiBase -OllamaHost $cfg.OLLAMA_HOST` 로 config-sourced 하게 얻는가.
function apiBaseConfigSourced(source: string): boolean {
  return /Get-LocalApiBase\s+-OllamaHost\s+\$cfg\.OLLAMA_HOST/.test(source);
}

// modelConfigSourced(source): payload 의 model 을 `$cfg.OLLAMA_MODEL` 로 config-sourced 하게 참조하는가.
function modelConfigSourced(source: string): boolean {
  return /model\s*=\s*\$cfg\.OLLAMA_MODEL\b/.test(source);
}

// wireCompletionsUrl(source): 요청 URL 이 `$apiBase/v1/chat/completions`(OpenAI 호환 /v1 경로)인가.
function wireCompletionsUrl(source: string): boolean {
  return /\$url\s*=\s*"\$apiBase\/v1\/chat\/completions"/.test(source);
}

// payloadShape(source): payload 가 model + messages(role 'user' · content $Prompt) shape 인가.
function payloadShape(source: string): boolean {
  const hasModel = /model\s*=\s*\$cfg\.OLLAMA_MODEL\b/.test(source);
  const hasMessages = /messages\s*=/.test(source);
  const hasRole = /role\s*=\s*'user'/.test(source);
  const hasContent = /content\s*=\s*\$Prompt\b/.test(source);
  return hasModel && hasMessages && hasRole && hasContent;
}

// bearerHeaderNonEmpty(source): `Authorization = 'Bearer <non-empty>'` 헤더가 비어있지 않은 값으로 존재하는가.
function bearerHeaderNonEmpty(source: string): boolean {
  return /Authorization\s*=\s*'Bearer\s+\S+'/.test(source);
}

// utf8BodyBytes(source): body 를 `[System.Text.Encoding]::UTF8.GetBytes(...)` 바이트로 만들어 `-Body $bodyBytes` 로 전송하는가.
function utf8BodyBytes(source: string): boolean {
  const hasGetBytes =
    /\[System\.Text\.Encoding\]::UTF8\.GetBytes\(\$payload\)/.test(source);
  const bodyIsBytes = /-Body\s+\$bodyBytes\b/.test(source);
  return hasGetBytes && bodyIsBytes;
}

// jsonCharsetContentType(source): ContentType 이 `application/json; charset=utf-8` 인가.
function jsonCharsetContentType(source: string): boolean {
  return /-ContentType\s+'application\/json;\s*charset=utf-8'/.test(source);
}

// serverEnsureThrow(source): 서버 기동 실패 fail-fast 분기 — `if (-not (Start-OllamaServerIfNeeded ...))` 가드 이후,
//   wire URL 할당(`$url =`) 앞에 `throw` 가 존재(실패 시 조기 중단). throw 누락 시 서버 없이 계속 진행.
function serverEnsureThrow(source: string): boolean {
  const guardAt = source.search(/if\s*\(-not\s*\(Start-OllamaServerIfNeeded\b/);
  if (guardAt < 0) return false;
  const urlAt = source.search(/\$url\s*=/);
  const throwRe = /\bthrow\b/g;
  let m: RegExpExecArray | null;
  while ((m = throwRe.exec(source)) !== null) {
    const idx = m.index;
    if (idx > guardAt && (urlAt < 0 || idx < urlAt)) return true;
  }
  return false;
}

// choicesContentConsumed(source): 성공 경로에서 `$resp.choices[0].message.content`(OpenAI 응답 shape) 소비하는가.
function choicesContentConsumed(source: string): boolean {
  return /\$resp\.choices\[0\]\.message\.content/.test(source);
}

// catchExitBranch(source): 실패 catch 분기 — `} catch {` + `Write-Host "스모크 테스트 실패:"` + `exit 1` 존재.
function catchExitBranch(source: string): boolean {
  const hasCatch = /\}\s*catch\s*\{/.test(source);
  const hasFailMsg = source.includes('Write-Host "스모크 테스트 실패:"');
  const hasExit1 = /\bexit\s+1\b/.test(source);
  return hasCatch && hasFailMsg && hasExit1;
}

// consoleUtf8Try(source): UTF-8 콘솔 출력 인코딩을 try/catch 로 비치명 시도 — `try { [Console]::OutputEncoding = ... } catch {}`.
function consoleUtf8Try(source: string): boolean {
  return /try\s*\{\s*\[Console\]::OutputEncoding\s*=\s*\[System\.Text\.Encoding\]::UTF8\s*\}\s*catch\s*\{\s*\}/.test(
    source,
  );
}

// (집계) extractTestLlmAnchors(source, config, common): 스모크 스크립트 내부 계약 불변식을 한 번에 집계 —
//   하나라도 부재/변질이면 명시적 false(빈 결과 성공-위장 0).
function extractTestLlmAnchors(
  source: string,
  config: string,
  common: string,
): {
  modelSourced: boolean;
  apiBaseSourced: boolean;
  noConfigLiteralHardcoded: boolean;
  dotSource: boolean;
  helperSymbolsWired: boolean;
  wireUrl: boolean;
  payload: boolean;
  bearer: boolean;
  utf8Body: boolean;
  contentType: boolean;
  serverThrow: boolean;
  choicesConsumed: boolean;
  catchExit: boolean;
  consoleUtf8: boolean;
} {
  // 하드코딩 금지: config.env active 값 literal 이 test-llm.ps1 본문에 등장하지 않음.
  const noConfigLiteralHardcoded = CONFIG_SOURCED_KEYS.every((k) => {
    const literal = configValue(config, k);
    return literal !== undefined && !configLiteralHardcoded(source, literal);
  });
  // 헬퍼 심볼 배선: source 가 호출하는 심볼이 각각 _common.ps1 에 function 정의로 실존.
  const helperSymbolsWired = CONSUMED_HELPER_SYMBOLS.every(
    (s) => helperSymbolConsumed(source, s) && helperSymbolDefined(common, s),
  );
  return {
    modelSourced: modelConfigSourced(source),
    apiBaseSourced: apiBaseConfigSourced(source),
    noConfigLiteralHardcoded,
    dotSource: dotSourceRelative(source),
    helperSymbolsWired,
    wireUrl: wireCompletionsUrl(source),
    payload: payloadShape(source),
    bearer: bearerHeaderNonEmpty(source),
    utf8Body: utf8BodyBytes(source),
    contentType: jsonCharsetContentType(source),
    serverThrow: serverEnsureThrow(source),
    choicesConsumed: choicesContentConsumed(source),
    catchExit: catchExitBranch(source),
    consoleUtf8: consoleUtf8Try(source),
  };
}

describe("realdata-e2e §108/§109 deploy/local-llm-example/test-llm.ps1 OpenAI 호환 스모크 스크립트 내부 계약 smoke — config-sourced model/api base 참조(하드코딩 금지, 1순위) + _common.ps1 dot-source·헬퍼 심볼 배선 + wire /v1/chat/completions URL·payload shape·Bearer 헤더·UTF-8 body 바이트·charset ContentType + 서버 기동 실패 throw(fail-fast) 분기 + choices[0].message.content 소비 + catch exit 1 분기 + 콘솔 UTF-8 try + secret-safety (T-0973)", () => {
  const testLlm = () => readFileSync(TEST_LLM_PS1_PATH, "utf8");
  const config = () => readFileSync(CONFIG_ENV_PATH, "utf8");
  const common = () => readFileSync(COMMON_PS1_PATH, "utf8");

  describe("Happy-path: 대조 artifact 3종 실존 + 14 불변식 전부 true", () => {
    it("test-llm.ps1·config.env·_common.ps1 가 repo-root 기준 실존(existsSync)", () => {
      expect(existsSync(TEST_LLM_PS1_PATH)).toBe(true);
      expect(existsSync(CONFIG_ENV_PATH)).toBe(true);
      expect(existsSync(COMMON_PS1_PATH)).toBe(true);
    });

    it("14 불변식(model sourced·api base sourced·하드코딩금지·dot-source·헬퍼배선·wire /v1 URL·payload shape·Bearer·UTF-8 body·charset CT·서버 throw·choices 소비·catch exit·콘솔 UTF-8 try) 전부 true", () => {
      const anchors = extractTestLlmAnchors(testLlm(), config(), common());
      expect(Object.values(anchors).every((v) => v === true)).toBe(true);
    });
  });

  describe("Happy-path(1순위 계약): config-sourced model/api base 참조 + config 값 literal 하드코딩 부재", () => {
    it("model 을 $cfg.OLLAMA_MODEL 로, api base 를 Get-LocalApiBase -OllamaHost $cfg.OLLAMA_HOST 로 config-sourced 하게 참조", () => {
      const s = testLlm();
      expect(modelConfigSourced(s)).toBe(true);
      expect(apiBaseConfigSourced(s)).toBe(true);
      expect(configSourcedRef(s, "OLLAMA_MODEL")).toBe(true);
      expect(configSourcedRef(s, "OLLAMA_HOST")).toBe(true);
    });

    it("gemma4:12b·127.0.0.1:11434 literal 을 test-llm.ps1 본문에 하드코딩하지 않음(config.env 가 그 값의 정본)", () => {
      const s = testLlm();
      const cfg = config();
      CONFIG_SOURCED_KEYS.forEach((k) => {
        expect(configLiteralHardcoded(s, CONFIG_LITERALS[k])).toBe(false);
        // config.env 가 그 값의 정본(byte 근거).
        expect(configValue(cfg, k)).toBe(CONFIG_LITERALS[k]);
      });
      expect(
        extractTestLlmAnchors(s, cfg, common()).noConfigLiteralHardcoded,
      ).toBe(true);
    });
  });

  describe("Happy-path: _common.ps1 dot-source(상대경로) + 호출 헬퍼 심볼 3종이 function 정의로 실존(dead 호출 0)", () => {
    it("test-llm.ps1 이 _common.ps1 을 상대경로로 dot-source", () => {
      const s = testLlm();
      expect(dotSourceRelative(s)).toBe(true);
      expect(s).toContain("Split-Path -Parent $MyInvocation.MyCommand.Path");
      expect(s).toContain("'_common.ps1'");
    });

    it("test-llm.ps1 이 호출하는 헬퍼 심볼 3종(Get-LlmConfig·Get-LocalApiBase·Start-OllamaServerIfNeeded)이 각각 _common.ps1 에 function 정의로 실존", () => {
      const s = testLlm();
      const c = common();
      CONSUMED_HELPER_SYMBOLS.forEach((sym) => {
        expect(helperSymbolConsumed(s, sym)).toBe(true);
        expect(helperSymbolDefined(c, sym)).toBe(true);
      });
      expect(extractTestLlmAnchors(s, config(), c).helperSymbolsWired).toBe(
        true,
      );
    });
  });

  describe("Happy-path(wire 포맷 계약): /v1/chat/completions URL + payload shape + Bearer 헤더 + UTF-8 body 바이트 + charset ContentType", () => {
    it("요청 URL 이 $apiBase/v1/chat/completions(OpenAI 호환 /v1 경로 — AA adapter 와 동일)", () => {
      const s = testLlm();
      expect(wireCompletionsUrl(s)).toBe(true);
      expect(s).toContain('"$apiBase/v1/chat/completions"');
    });

    it("payload 가 model($cfg.OLLAMA_MODEL) + messages(role 'user' · content $Prompt) shape", () => {
      const s = testLlm();
      expect(payloadShape(s)).toBe(true);
      expect(/role\s*=\s*'user'/.test(s)).toBe(true);
      expect(/content\s*=\s*\$Prompt\b/.test(s)).toBe(true);
    });

    it("Bearer 헤더(Authorization = 'Bearer ...' 비어있지 않은 값)", () => {
      const s = testLlm();
      expect(bearerHeaderNonEmpty(s)).toBe(true);
      expect(s).toContain("Authorization = 'Bearer ollama'");
    });

    it("body 가 [System.Text.Encoding]::UTF8.GetBytes($payload) UTF-8 바이트로 -Body 전송 + ContentType application/json; charset=utf-8", () => {
      const s = testLlm();
      expect(utf8BodyBytes(s)).toBe(true);
      expect(jsonCharsetContentType(s)).toBe(true);
      expect(s).toContain("[System.Text.Encoding]::UTF8.GetBytes($payload)");
    });
  });

  describe("Flow/branch cover: 서버 기동 실패 throw(fail-fast) + choices 소비 + catch exit 1 + 콘솔 UTF-8 try", () => {
    it("서버 기동 실패 분기 if (-not (Start-OllamaServerIfNeeded ...)) { throw ... }(fail-fast) 존재", () => {
      const s = testLlm();
      expect(serverEnsureThrow(s)).toBe(true);
      expect(/if\s*\(-not\s*\(Start-OllamaServerIfNeeded\b/.test(s)).toBe(true);
      // throw 가 서버 가드 뒤 · wire URL 할당 앞에 위치(조기 중단).
      const guardAt = s.search(/if\s*\(-not\s*\(Start-OllamaServerIfNeeded\b/);
      const throwAt = s.search(/\bthrow\b/);
      const urlAt = s.search(/\$url\s*=/);
      expect(throwAt).toBeGreaterThan(guardAt);
      expect(throwAt).toBeLessThan(urlAt);
    });

    it("요청 성공 경로에서 $resp.choices[0].message.content(OpenAI 응답 shape) 소비 존재", () => {
      const s = testLlm();
      expect(choicesContentConsumed(s)).toBe(true);
    });

    it('실패 catch 분기 } catch { ... Write-Host "스모크 테스트 실패:" ... exit 1 존재', () => {
      const s = testLlm();
      expect(catchExitBranch(s)).toBe(true);
      expect(/\}\s*catch\s*\{/.test(s)).toBe(true);
      expect(/\bexit\s+1\b/.test(s)).toBe(true);
    });

    it("콘솔 UTF-8 출력 인코딩 try { [Console]::OutputEncoding = ... } catch {}(비치명) 존재", () => {
      const s = testLlm();
      expect(consoleUtf8Try(s)).toBe(true);
    });
  });

  describe("Error path / negative cases 충분 cover (mutant 합성 사본 — 원본 미변조, 예외 분기마다 각 1+)", () => {
    it("error path — 대조 artifact 부재 경로 → readFileSync throw(silent 0-byte fallback 0)", () => {
      const badPath = path.join(LLM_DIR, "__does_not_exist___test-llm.ps1");
      expect(existsSync(badPath)).toBe(false);
      expect(() => readFileSync(badPath, "utf8")).toThrow();
    });

    it("error path — 앵커 토큰 부재 시 명시적 false(빈 매칭을 pass 로 오통과 0)", () => {
      const anchors = extractTestLlmAnchors("", "", "");
      expect(Object.values(anchors).some((v) => v === true)).toBe(false);
      // 실 소스는 반대로 전부 true — 부재/실재 변별.
      const real = extractTestLlmAnchors(testLlm(), config(), common());
      expect(Object.values(real).every((v) => v === true)).toBe(true);
    });

    it("negative (a) — payload 의 model 을 gemma4:12b literal 로 하드코딩한 mutant → config-sourced model 계약(하드코딩 금지) 위반 검출", () => {
      const s = testLlm();
      const mutant = s.replace(
        "model    = $cfg.OLLAMA_MODEL",
        "model    = 'gemma4:12b'",
      );
      expect(configLiteralHardcoded(mutant, "gemma4:12b")).toBe(true);
      expect(modelConfigSourced(mutant)).toBe(false);
      expect(
        extractTestLlmAnchors(mutant, config(), common())
          .noConfigLiteralHardcoded,
      ).toBe(false);
      // 원본 불변.
      expect(configLiteralHardcoded(s, "gemma4:12b")).toBe(false);
      expect(modelConfigSourced(s)).toBe(true);
    });

    it("negative (b) — dot-source 행을 절대경로/타 파일로 바꾼 mutant → dot-source 상대경로 계약 drift 검출", () => {
      const s = testLlm();
      const mutant = s.replace(
        ". (Join-Path (Split-Path -Parent $MyInvocation.MyCommand.Path) '_common.ps1')",
        ". C:\\ollama\\helpers.ps1",
      );
      expect(dotSourceRelative(mutant)).toBe(false);
      expect(extractTestLlmAnchors(mutant, config(), common()).dotSource).toBe(
        false,
      );
      // 원본 불변.
      expect(dotSourceRelative(s)).toBe(true);
    });

    it("negative (c) — 요청 URL 을 /api/chat(Ollama 네이티브)로 바꾼 mutant → /v1/chat/completions OpenAI 호환 wire 계약 drift 검출", () => {
      const s = testLlm();
      const mutant = s.replace(
        '$url = "$apiBase/v1/chat/completions"',
        '$url = "$apiBase/api/chat"',
      );
      expect(wireCompletionsUrl(mutant)).toBe(false);
      expect(extractTestLlmAnchors(mutant, config(), common()).wireUrl).toBe(
        false,
      );
      // 원본 불변.
      expect(wireCompletionsUrl(s)).toBe(true);
    });

    it("negative (d) — body 를 UTF8.GetBytes 대신 문자열 -Body $payload 로 바꾼 mutant → UTF-8 바이트 계약 drift 검출", () => {
      const s = testLlm();
      const mutant = s
        .replace(
          "$bodyBytes = [System.Text.Encoding]::UTF8.GetBytes($payload)",
          "",
        )
        .replace("-Body $bodyBytes", "-Body $payload");
      expect(utf8BodyBytes(mutant)).toBe(false);
      expect(extractTestLlmAnchors(mutant, config(), common()).utf8Body).toBe(
        false,
      );
      // 원본 불변.
      expect(utf8BodyBytes(s)).toBe(true);
    });

    it("negative (e) — 서버 기동 실패 분기의 throw 를 제거(실패해도 계속 진행)한 mutant → fail-fast 분기 drift 검출", () => {
      const s = testLlm();
      const mutant = s.replace(
        'throw "Ollama 서버 기동 실패. install.ps1 을 먼저 실행했는지 확인하세요."',
        'Write-Host "server down (continue)"',
      );
      expect(serverEnsureThrow(mutant)).toBe(false);
      expect(
        extractTestLlmAnchors(mutant, config(), common()).serverThrow,
      ).toBe(false);
      // 원본 불변.
      expect(serverEnsureThrow(s)).toBe(true);
    });

    it("negative (f) — Bearer 헤더를 제거/빈 값으로 바꾼 mutant → 비어있지 않은 Bearer 계약 drift 검출", () => {
      const s = testLlm();
      const mutant = s.replace(
        "Authorization = 'Bearer ollama'",
        "X-None = ''",
      );
      expect(bearerHeaderNonEmpty(mutant)).toBe(false);
      expect(extractTestLlmAnchors(mutant, config(), common()).bearer).toBe(
        false,
      );
      // 원본 불변.
      expect(bearerHeaderNonEmpty(s)).toBe(true);
    });

    it("negative (g) — test-llm.ps1 이 호출하는 Start-OllamaServerIfNeeded 를 _common.ps1 정의에서 제거한 합성 mutant → dead 호출(심볼 소비 계약) 검출", () => {
      const s = testLlm();
      const c = common();
      const mutantCommon = c.replace(
        /function\s+Start-OllamaServerIfNeeded\b/,
        "function Start-SomethingElse",
      );
      expect(helperSymbolConsumed(s, "Start-OllamaServerIfNeeded")).toBe(true); // source 는 여전히 호출.
      expect(
        helperSymbolDefined(mutantCommon, "Start-OllamaServerIfNeeded"),
      ).toBe(false); // 정의는 사라짐 → dead 호출.
      expect(
        extractTestLlmAnchors(s, config(), mutantCommon).helperSymbolsWired,
      ).toBe(false);
      // 원본 불변.
      expect(helperSymbolDefined(c, "Start-OllamaServerIfNeeded")).toBe(true);
    });

    it("negative — §9 credential/secret 누출 0: 추출/합성 토큰에 gh 토큰 어휘·실 credential·실 password·apiKey 값 미등장(§9/REQ-059)", () => {
      const synthesized = [
        JSON.stringify(extractTestLlmAnchors(testLlm(), config(), common())),
        ...CONFIG_SOURCED_KEYS.map((k) => String(configValue(config(), k))),
        CONSUMED_HELPER_SYMBOLS.join(","),
      ];
      // 강 패턴: 실 secret 어휘. Bearer/Authorization 은 wire 계약 토큰이라 별도(아래 dummy 검증에서 placeholder 만 등장).
      const strongPattern =
        /(ghp_|--token|GITHUB_TOKEN|GH_TOKEN|\bsk-|PASSWORD=|apiKey"?\s*[:=]\s*["']?\w)/i;
      synthesized.forEach((v) => {
        expect(strongPattern.test(v)).toBe(false);
      });
      // 합성 mutant 값도 명백한 dummy(하드코딩 gemma4:12b literal·타 파일 경로 C:\ollama\helpers.ps1 등)로 한정 — 실 자격 0.
      const dummies = [
        "gemma4:12b",
        "127.0.0.1:11434",
        "C:\\ollama\\helpers.ps1",
      ];
      dummies.forEach((d) => expect(strongPattern.test(d)).toBe(false));
      // 추출 값은 모두 비시크릿 설정 값/경로(bind 주소·모델 tag·endpoint 경로). placeholder Bearer 값은 Ollama 가 무시하는 dummy 'ollama'.
      expect(configValue(config(), "OLLAMA_HOST")).toBe("127.0.0.1:11434");
      expect(testLlm()).toContain("$apiBase/v1/chat/completions");
      expect(testLlm()).toContain("Bearer ollama"); // placeholder dummy — 실 secret 아님.
      expect(strongPattern.test("Bearer ollama")).toBe(false);
    });
  });

  describe("branch: 각 정본 앵커 일치/drift 정적 대조(합성 mutant 사본 — 원본 미변조)", () => {
    it("config-sourced api base 계약 일치/drift 분기", () => {
      const s = testLlm();
      expect(extractTestLlmAnchors(s, config(), common()).apiBaseSourced).toBe(
        true,
      );
      const mutant = s.replace(
        "$apiBase = Get-LocalApiBase -OllamaHost $cfg.OLLAMA_HOST",
        "$apiBase = 'http://127.0.0.1:11434'",
      );
      expect(apiBaseConfigSourced(mutant)).toBe(false);
      expect(
        extractTestLlmAnchors(mutant, config(), common())
          .noConfigLiteralHardcoded,
      ).toBe(false); // 127.0.0.1:11434 하드코딩 등장.
    });

    it("헬퍼 심볼 배선 일치/drift 분기", () => {
      const c = common();
      expect(
        extractTestLlmAnchors(testLlm(), config(), c).helperSymbolsWired,
      ).toBe(true);
      const mutant = c.replace(
        /function\s+Get-LocalApiBase\b/,
        "function Get-Nothing",
      );
      expect(
        extractTestLlmAnchors(testLlm(), config(), mutant).helperSymbolsWired,
      ).toBe(false);
    });

    it("catch exit 분기 일치/drift 분기(exit 1 제거 mutant)", () => {
      const s = testLlm();
      expect(catchExitBranch(s)).toBe(true);
      const mutant = s.replace(/\bexit\s+1\b/, "");
      expect(catchExitBranch(mutant)).toBe(false);
    });
  });

  describe("flow: 결정론 · no-mutation(원본 read-only 입증)", () => {
    it("동일 입력으로 pure 함수를 두 번 호출하면 deep-equal(결정론)", () => {
      const s = testLlm();
      const cfg = config();
      const c = common();
      expect(extractTestLlmAnchors(s, cfg, c)).toEqual(
        extractTestLlmAnchors(s, cfg, c),
      );
    });

    it("합성 mutate(사본 replace) 후에도 원본 소스 텍스트·pure 함수 산출이 불변(원본 read-only)", () => {
      const s = testLlm();
      const cfg = config();
      const c = common();
      const sSnap = s;
      const cfgSnap = cfg;
      const cSnap = c;
      // 사본 mutate(negative a~g 에서 쓰는 replace) — 원본 불변 확인.
      s.replace("model    = $cfg.OLLAMA_MODEL", "model    = 'gemma4:12b'");
      s.replace(
        '$url = "$apiBase/v1/chat/completions"',
        '$url = "$apiBase/api/chat"',
      );
      s.replace("-Body $bodyBytes", "-Body $payload");
      s.replace("Authorization = 'Bearer ollama'", "X-None = ''");
      c.replace(
        /function\s+Start-OllamaServerIfNeeded\b/,
        "function Start-SomethingElse",
      );
      expect(s).toBe(sSnap);
      expect(cfg).toBe(cfgSnap);
      expect(c).toBe(cSnap);
      // 추출/파싱 후에도 원본 불변.
      extractTestLlmAnchors(s, cfg, c);
      expect(s).toBe(sSnap);
      expect(c).toBe(cSnap);
    });
  });

  describe("dormant / non-gated 확인 — side-effect 0", () => {
    it("계약 모델이 env / 전역 상태 없이 순수하게 동작(non-gated — describe.skip 0·gating 분기 0)", () => {
      // 본 describe 가 실행된다는 것 자체가 describe.skip 0(항상 실행)의 런타임 증거.
      const envSnapshot = { ...process.env };
      const s = testLlm();
      const before = extractTestLlmAnchors(s, config(), common());
      // 실 process.env 를 mutate 해도 산출 불변 — 모델이 process.env 를 참조하지 않음(파라미터로만).
      Object.assign(process.env, { LOCAL_LLM_TEST_PS1_UNIT_TEST: "x" });
      const after = extractTestLlmAnchors(s, config(), common());
      delete process.env.LOCAL_LLM_TEST_PS1_UNIT_TEST;
      expect(after).toEqual(before);
      expect(Object.keys(process.env)).toEqual(Object.keys(envSnapshot));
    });

    it("파일 read 는 test-llm.ps1/config.env/_common.ps1 읽기만 — 실 PowerShell/실 Ollama 기동/실 HTTP POST(/v1/chat/completions)/실 Invoke-RestMethod 0. 세 파일은 선언적 스크립트·설정이라 런타임 분기 없이 정적 소스 텍스트 앵커로 happy/negative mutant 로 대체 cover", () => {
      const anchors = extractTestLlmAnchors(testLlm(), config(), common());
      expect(Object.values(anchors).every((v) => v === true)).toBe(true);
    });
  });
});
