// realdata-e2e-local-llm-example-orphan-runner-killlist-single-source-parity-contract.smoke-spec.ts
// — 로컬 Ollama live-LLM 운영 premise leg 후속(T-1315). 오너 실측(RTX 4070 12GB, 2026-07-30): 서버가 멈춰
// 폴백 정리 경로를 탈 때 종료 대상 목록의 마지막 이름이 구버전(`ollama_llama_server`)이라, 현재 Ollama 가
// 모델을 적재하는 자식 프로세스 **`llama-server`** 가 고아로 남아 VRAM 10,588 MiB 를 계속 점유했다(직접 종료 후
// 1,357 MiB 복귀). 고아가 VRAM 을 물면 새 서버의 모델 적재가 CPU offload 되거나 실패해 daily-test live leg
// 타임아웃/FAIL 의 잠재 원인이 된다. 동일 목록이 세 실 파일(_common.ps1 폴백 · expose-lan.ps1 재기동 ·
// install.ps1 재기동)에 글자-동일하게 복제돼 있어 세 곳을 함께 교정했고, 본 spec 이 그 목록의 drift 를 봉한다.
//
// 봉함 불변식(핵심 위험 = stale 런너 kill 목록 drift / 세 사본 divergence):
//   (1) 신 런너 이름 포함: 세 파일의 `Get-Process -Name` 목록에 `llama-server` 가 실존(본 결함의 회귀 방지).
//   (2) 레거시 3 이름 보존: `ollama app` · `ollama` · `ollama_llama_server` 가 구버전 호환으로 글자 그대로 유지.
//   (3) parity(single-source 동형): 세 파일 목록이 **집합 동일** — 한 곳만 고쳐지는 부분 수정 차단.
//   (4) wildcard 과잉 매칭 금지: `ollama*` / `*llama*` 류 토큰이 목록에 없음(무관 프로세스 대량 종료 방지).
//   (5) `-ErrorAction SilentlyContinue` 유지: 대상 부재가 에러로 치명화되지 않음.
//   (6) stop-llm.ps1 정상 경로 불변(Out of Scope 봉함): 정상 VRAM 해제는 여전히 `keep_alive = 0` 서버 자기
//       언로드이고, 강제 kill 은 `-StopServer` 분기 안에만 있어 언로드를 대체하지 않는다.
//
// 전략(형제 realdata-e2e-local-llm-example-* 계열 동형): 실 파일을 readFileSync 로 읽고, 해석 동형 TS 순수
// 함수(parseKillList · killListLines · hasSilentlyContinue)로만 계약을 assert. 합성 mutant 사본으로
// negative 변별(목록 부재 · 주석 처리 · 이름 누락 · wildcard · ErrorAction 누락).
//   🔥 실 PowerShell 실행 0 · 실 프로세스 종료 0 · 실 Ollama/nvidia-smi 호출 0 · process.env 읽기 0 ·
//      credential 0(§9/REQ-059) · 새 dep 0(node fs/path) · src 변경 0(test-only) · ps1 읽기만(실행 0 · 변경 0).
import { existsSync, readFileSync } from "fs";
import * as path from "path";

// repo-root 경로 — test 실행 cwd 무관하게 `__dirname`(=test/smoke) 기준으로 해석(형제 spec 동형).
const REPO_ROOT = path.resolve(__dirname, "../..");
const LLM_DIR = path.join(REPO_ROOT, "deploy", "local-llm-example");

// 동일 kill 목록을 복제 보유한 세 정본 파일(본 spec 의 parity 대상).
const PARITY_FILES = ["_common.ps1", "expose-lan.ps1", "install.ps1"] as const;
// 참조만 하는 파일(수정 금지 — 정상 언로드 경로 봉함용).
const STOP_PS1 = "stop-llm.ps1";

// 정본 앵커(실 artifact 표현의 TS mirror).
const NEW_RUNNER_NAME = "llama-server"; // 현 Ollama 가 모델을 적재하는 자식 프로세스.
const LEGACY_NAMES = ["ollama app", "ollama", "ollama_llama_server"]; // 구버전 호환 보존 대상.
const EXPECTED_KILL_LIST = [...LEGACY_NAMES, NEW_RUNNER_NAME];

// `Get-Process -Name 'a', 'b', ...` 의 quoted 이름 나열부를 잡는다(단일 인용부호만 — 정본 표기).
const KILL_LIST_RE = /Get-Process\s+-Name\s+((?:'[^']*'\s*,\s*)*'[^']*')/;

// ── TS 동형 pure 함수(정본) — 입력 문자열은 mutate 하지 않는다(읽기만). ps1 파서 라이브러리 0.

// 소스를 CRLF-정규화 후 라인 배열로 — 공통 입력.
function toLines(source: string): string[] {
  return source.replace(/\r\n/g, "\n").split("\n");
}

// killListLines(source): 주석(`#`) 처리되지 않은 kill 목록 라인들. 부재 시 빈 배열.
function killListLines(source: string): string[] {
  return toLines(source).filter(
    (line) => !/^\s*#/.test(line) && KILL_LIST_RE.test(line),
  );
}

// parseKillList(source): 첫 유효 kill 목록 라인의 프로세스 이름 배열. 부재/빈 입력이면 빈 배열(throw 0).
function parseKillList(source: string): string[] {
  const lines = killListLines(source);
  if (lines.length === 0) return [];
  const matched = KILL_LIST_RE.exec(lines[0]);
  if (!matched) return [];
  return matched[1]
    .split(",")
    .map((token) => token.trim().replace(/^'/, "").replace(/'$/, "").trim())
    .filter((name) => name.length > 0);
}

// hasSilentlyContinue(source): 모든 유효 kill 목록 라인이 `-ErrorAction SilentlyContinue` 를 유지하는가.
function hasSilentlyContinue(source: string): boolean {
  const lines = killListLines(source);
  return (
    lines.length > 0 &&
    lines.every((line) => /-ErrorAction\s+SilentlyContinue/.test(line))
  );
}

// 실 파일 읽기(1 회) — 이후 assert 는 이 문자열만 본다.
function readLlmFile(name: string): string {
  const filePath = path.join(LLM_DIR, name);
  if (!existsSync(filePath)) throw new Error(`정본 파일 부재: ${filePath}`);
  return readFileSync(filePath, "utf8");
}

const SOURCES: Record<string, string> = {};
for (const name of [...PARITY_FILES, STOP_PS1])
  SOURCES[name] = readLlmFile(name);

describe("local-llm-example stale 런너 kill 목록 single-source parity 계약 (정적)", () => {
  describe("happy path — 세 파일이 신 런너 이름을 포함한 목록을 노출", () => {
    it.each(PARITY_FILES.map((name) => [name]))(
      "%s 의 parseKillList 가 llama-server 를 포함한 4 이름 목록을 돌려준다",
      (name) => {
        const parsed = parseKillList(SOURCES[name]);
        expect(parsed).toContain(NEW_RUNNER_NAME);
        expect(parsed).toEqual(EXPECTED_KILL_LIST);
      },
    );

    it("세 파일 모두 kill 목록 라인이 정확히 1 개다(중복 정리 경로 0)", () => {
      for (const name of PARITY_FILES) {
        expect(killListLines(SOURCES[name])).toHaveLength(1);
      }
    });
  });

  describe("error path — 목록 부재/빈 입력에서 빈 배열(throw 0)", () => {
    it("빈 문자열 입력이면 빈 배열", () => {
      expect(() => parseKillList("")).not.toThrow();
      expect(parseKillList("")).toEqual([]);
      expect(hasSilentlyContinue("")).toBe(false);
    });

    it("Get-Process -Name 라인이 없는 입력이면 빈 배열", () => {
      const noList = "Write-Host 'noop'\nStart-Sleep -Seconds 2\n";
      expect(() => parseKillList(noList)).not.toThrow();
      expect(parseKillList(noList)).toEqual([]);
      expect(hasSilentlyContinue(noList)).toBe(false);
    });
  });

  describe("flow / branch cover — helper 분기 3 종", () => {
    it("(a) 목록 라인 존재 분기 — 이름 배열을 돌려준다", () => {
      const withList =
        "Get-Process -Name 'ollama', 'llama-server' -ErrorAction SilentlyContinue |";
      expect(parseKillList(withList)).toEqual(["ollama", NEW_RUNNER_NAME]);
      expect(killListLines(withList)).toHaveLength(1);
    });

    it("(b) 목록 라인 부재 분기 — 빈 배열", () => {
      expect(parseKillList("Get-Process | Stop-Process -Force")).toEqual([]);
    });

    it("(c) 주석(#) 처리된 라인은 유효 목록으로 세지 않는다", () => {
      const commented =
        "# Get-Process -Name 'ollama', 'llama-server' -ErrorAction SilentlyContinue |\n" +
        "   #Get-Process -Name 'ollama app' -ErrorAction SilentlyContinue\n";
      expect(killListLines(commented)).toEqual([]);
      expect(parseKillList(commented)).toEqual([]);
      expect(hasSilentlyContinue(commented)).toBe(false);
    });
  });

  describe("negative cases — 결함이 되돌아오면 red", () => {
    it("(a) 회귀 방지: llama-server 가 빠진 mutant 는 fail 로 변별된다", () => {
      for (const name of PARITY_FILES) {
        const mutant = SOURCES[name].replace(", 'llama-server'", "");
        expect(parseKillList(mutant)).not.toContain(NEW_RUNNER_NAME);
        expect(parseKillList(SOURCES[name])).toContain(NEW_RUNNER_NAME);
      }
    });

    it("(b) 레거시 3 이름 중 하나라도 사라지면 fail 로 변별된다", () => {
      for (const name of PARITY_FILES) {
        const parsed = parseKillList(SOURCES[name]);
        for (const legacy of LEGACY_NAMES) expect(parsed).toContain(legacy);
        const mutant = SOURCES[name].replace("'ollama_llama_server', ", "");
        expect(parseKillList(mutant)).not.toContain("ollama_llama_server");
      }
    });

    it("(c) wildcard 과잉 매칭 토큰이 목록에 없다", () => {
      for (const name of PARITY_FILES) {
        for (const parsed of parseKillList(SOURCES[name])) {
          expect(parsed).not.toContain("*");
        }
      }
      const wildcardMutant =
        "Get-Process -Name 'ollama*' -ErrorAction SilentlyContinue |";
      expect(parseKillList(wildcardMutant)[0]).toContain("*");
    });

    it("(d) parity: 세 파일 목록이 서로 다르면 fail 로 변별된다(집합 동일)", () => {
      const sets = PARITY_FILES.map((name) =>
        [...parseKillList(SOURCES[name])].sort(),
      );
      expect(sets[0]).toHaveLength(EXPECTED_KILL_LIST.length); // 빈 배열끼리의 헛통과 차단.
      for (const each of sets) expect(each).toEqual([...sets[0]]);
      const partial = SOURCES["install.ps1"].replace(", 'llama-server'", "");
      expect([...parseKillList(partial)].sort()).not.toEqual([...sets[0]]);
    });

    it("(e) -ErrorAction SilentlyContinue 누락 시 fail 로 변별된다", () => {
      for (const name of PARITY_FILES) {
        expect(hasSilentlyContinue(SOURCES[name])).toBe(true);
        const mutant = SOURCES[name].replace(
          "'llama-server' -ErrorAction SilentlyContinue",
          "'llama-server'",
        );
        expect(hasSilentlyContinue(mutant)).toBe(false);
      }
    });

    it("(f) stop-llm.ps1 정상 경로는 여전히 keep_alive = 0 언로드(강제 kill 로 대체 0)", () => {
      const stop = SOURCES[STOP_PS1];
      expect(stop).toMatch(/keep_alive\s*=\s*0/);
      const unloadAt = stop.indexOf("keep_alive");
      const killAt = stop.search(KILL_LIST_RE);
      expect(unloadAt).toBeGreaterThanOrEqual(0);
      expect(killAt).toBeGreaterThan(unloadAt); // 강제 kill 은 언로드 뒤에만 등장.
      expect(stop).toMatch(/if\s*\(\$StopServer\)/);
      // Out of Scope 봉함: stop-llm.ps1 목록은 확장 대상이 아니다(고아 미발생 경로).
      expect(parseKillList(stop)).toEqual(["ollama app", "ollama"]);
    });
  });
});
