// realdata-e2e-seed-llm-config-env-gating-no-op-guard-strict-mode-env-override-defaults-enckey-failfast-stdin-secret-safe-bounded-readiness-contract.smoke-spec.ts
// — 무인 nightly runner 가 재배포 직후 조건부로 호출(redeploy.sh: `if [ -f ]` guard + `|| echo` 비치명
// 계속, T-0958 봉함)하는 callee 스크립트 `deploy/seed-llm-config.sh` 의 **내부 env-gating orchestration
// 계약**(strict-mode + no-op guard + env-override 기본값 + enc-key fail-fast + apiKey stdin secret-safety +
// bounded readiness polling)을 실 shell 파일을 readFileSync 로 읽어(실행/source/실 docker·psql·node 0)
// 정적 검증하는 non-gated build-time smoke (T-0959, PLAN.md §109 step③ 로컬 Ollama seed 배선 — nightly
// runner seed leg 완결).
//
// 봉함 불변식: **seed-llm-config.sh 는 `set -euo pipefail`(errexit ON — redeploy.sh 와 동형, daily-test.sh
// 는 반대)로 시작해 `cd "$REPO_DIR"`(`${REPO_DIR:-/opt/assessment-agent}`) → `.env` 조건부 로드
// (`if [ -f .env ]` + `set -a`/`. ./.env`/`set +a`) → `SEED_LLM_ENDPOINT_URL` 비면 즉시 no-op exit 0 →
// 6종 SEED_LLM_*/POSTGRES_* env-override 기본값 해석 → `LLM_APIKEY_ENC_KEY` 부재 시 fail-fast exit 1 →
// postgres/app 컨테이너 bounded readiness polling(30회×2s ~60s) → apiKey 를 **argv 아닌 stdin 파이프**
// (`printf ... | docker compose exec -T ... node -e`)로 전달(컨테이너 `ps` 노출 회피, §9) → ciphertext
// 비면 exit 1 로 진행한다. 이 gating 중 하나라도 정본과 silent 분기하면(no-op guard 소실로 endpoint
// 미설정 공용 환경에서 seed 폭주 / enc-key fail-fast 소실로 평문 upsert / apiKey argv 노출) 무인 야간
// seed 가 stage LLM config 를 조용히 오염하거나 credential 을 누출한다.**
// 계약(실 소스 유도 앵커 — 28·30·31·35~40·42~46·48~53·55~58·65·71·76·82·89~95행 중심):
//   (a) strict-mode(28행 `set -euo pipefail` — nounset·pipefail·errexit 모두 ON; redeploy.sh 동형) ·
//   (b) REPO_DIR env-override 기본값(30행 `${REPO_DIR:-/opt/assessment-agent}` + 31행 `cd "$REPO_DIR"`) ·
//   (c) `.env` 조건부 로드(35~40행 `if [ -f .env ]` + `set -a`→`. ./.env`→`set +a` auto-export 3-token) ·
//   (d) no-op guard(42~46행 `ENDPOINT="${SEED_LLM_ENDPOINT_URL:-}"` + `if [ -z "$ENDPOINT" ]` → `exit 0`) ·
//   (e) 6종 env-override 기본값(48~53행 SEED_LLM_PROVIDER→custom / SEED_LLM_MODEL_ID→gemma4:12b /
//       SEED_LLM_API_KEY→ollama / SEED_LLM_CONFIG_ID→seed-local-llm / POSTGRES_USER / POSTGRES_DB) ·
//   (f) enc-key fail-fast(55~58행 `if [ -z "${LLM_APIKEY_ENC_KEY:-}" ]` → `exit 1`) ·
//   (g) bounded readiness polling 2종(65·76행 `for _ in $(seq 1 30)` + `sleep 2` + `[ "$ready" = 1 ] || exit 1`) ·
//   (h) apiKey stdin-not-argv(89~91행 `printf '%s' "$APIKEY_PLAIN" | docker compose exec -T ... node -e`) ·
//   (i) ciphertext fail-fast(92~95행 `if [ -z "$CIPHERTEXT" ]` → `exit 1`) ·
//   (j) §9 secret-safety(추출/합성 토큰에 실 토큰·secret·password·실 endpoint IP 0 — env 이름·무해
//       placeholder default·git/docker/psql 명령 토큰만).
//
// 전략(T-0956 shell-strictness·T-0958 redeploy 내부 시퀀스 동형): seed-llm-config.sh 유도 표현을 정적
// 앵커로 추출 + 해석 동형 TS 순수 함수(`parseShellStrictness`·`buildEnvOverrideTable`·`hasEnvOverrideLineAnchor`·
// `exitCodeAfterGuard`·`apiKeyStdinNotArgv`·`countBoundedPollingFailFast`·`hasEnvLoadBlock`)로 strict-mode·
// no-op/enc-key exit-code 방향·env-override 기본값·stdin secret-safety·bounded polling·secret-safety 불변식
// assert. 합성 mutant 사본으로 negative(a~f) 변별. T-0794(seed INSERT 컬럼 ↔ Prisma schema scalar parity·
// ON CONFLICT·cipher require-path/API — SQL/cipher artifact 정합)·T-0958(redeploy 가 seed 를 *호출하는*
// caller 측 배선) 와 distinct 상보 surface(seed *자신*의 env-gating orchestration).
//   🔥 실 docker/psql/node/git/bash/네트워크/컨테이너 0 · process.env 읽기 0(입력은 pure 함수 파라미터) ·
//      credential 0(§9/REQ-059) · 새 dep 0(node fs/path) · src·deploy 변경 0(test-only) ·
//      deploy/seed-llm-config.sh 읽기만(실행/source 0 · 변경 0).
import { readFileSync } from "fs";
import * as path from "path";

// repo-root 경로 — test 실행 cwd 무관하게 robust 하게 해석(`__dirname` = test/smoke,
// 두 단계 위가 repo-root). `process.cwd()` 대신 `__dirname` 기준 상대로 고정한다(sibling T-0956/T-0958).
const REPO_ROOT = path.resolve(__dirname, "../..");
const SEED_SH_PATH = path.join(REPO_ROOT, "deploy/seed-llm-config.sh");

// 정본 앵커(실 bash 표현의 TS mirror — 실 bash/docker/psql/node 실행 0).
const STRICT_MODE_LINE = `set -euo pipefail`; // 28행 — errexit ON(redeploy.sh 동형, daily-test.sh 반대).
// 아래 `${...}` 포함 리터럴은 JS 템플릿 보간 회피 위해 단일따옴표로 담는다.
const REPO_DIR_LINE = 'REPO_DIR="${REPO_DIR:-/opt/assessment-agent}"'; // 30행.
const CD_REPO_DIR_LINE = 'cd "$REPO_DIR"'; // 31행.
const ENDPOINT_ASSIGN_LINE = 'ENDPOINT="${SEED_LLM_ENDPOINT_URL:-}"'; // 42행 — no-op trigger.
const NO_OP_GUARD_COND = 'if [ -z "$ENDPOINT" ]; then'; // 43행 no-op guard 조건.
const ENC_KEY_GUARD_COND = 'if [ -z "${LLM_APIKEY_ENC_KEY:-}" ]; then'; // 55행 enc-key fail-fast 조건.
const CIPHERTEXT_GUARD_COND = 'if [ -z "$CIPHERTEXT" ]; then'; // 92행 ciphertext fail-fast 조건.
const POLLING_FOR_LINE = `for _ in $(seq 1 30); do`; // 65·76행 bounded polling 반복.
// 89행 apiKey stdin 전달 — `$APIKEY_PLAIN` 은 `${` 아니므로 backtick 안전, `'%s'` 단일따옴표 포함.
const APIKEY_STDIN_PREFIX = `printf '%s' "$APIKEY_PLAIN" | docker compose exec -T`;
// 90행 enc-key 컨테이너 주입 — `${` 없어 backtick 안전.
const ENC_KEY_INJECT = `-e LLM_APIKEY_ENC_KEY="$LLM_APIKEY_ENC_KEY" app node -e`;
// 35~39행 `.env` 조건부 auto-export 로드 3-token 시퀀스.
const ENV_LOAD_GUARD = `if [ -f .env ]; then`; // 35행.
const ENV_LOAD_SET_A = `set -a`; // 36행 auto-export ON.
const ENV_LOAD_SOURCE = `. ./.env`; // 38행 source.
const ENV_LOAD_SET_PLUS_A = `set +a`; // 39행 auto-export OFF.

// ── TS 동형 pure 함수(정본) — seed-llm-config.sh 내부 env-gating(28~95행)을 모델링.
//    입력(문자열)은 mutate 하지 않는다(읽기만). 실 bash/docker/psql/node/env 읽기 0 — 입력은 파라미터.

// (a) shell-strictness 파싱 결과 — `set` 플래그 3종 분리 boolean.
interface ShellStrictness {
  nounset: boolean; // `-u` — unset 변수 참조 시 error.
  pipefail: boolean; // `-o pipefail` — 파이프 중간 실패 전파.
  errexit: boolean; // `-e` — 첫 실패에서 script abort. **seed 정본은 true(ON)**.
}

// (a) parseShellStrictness(setLine): `set -euo pipefail` 라인을 파싱해 strictness 플래그 분리 —
//     조합 short-flag(`-euo`, `-uo`) 와 개별 flag(`-e -u -o pipefail`) 모두 수용. 실 bash `set` 실행 0.
function parseShellStrictness(setLine: string): ShellStrictness {
  const shortFlagChars = new Set<string>();
  for (const m of setLine.matchAll(/(?<![\w-])-([a-zA-Z]+)\b/g)) {
    for (const ch of m[1]) shortFlagChars.add(ch);
  }
  const pipefail = /-\w*o\b\s+pipefail\b/.test(setLine);
  return {
    nounset: shortFlagChars.has("u"),
    pipefail,
    errexit: shortFlagChars.has("e"),
  };
}

// (e) env-override 표 원소 — 외부 env 이름 → 내부 shell 변수 + documented default.
interface EnvOverrideEntry {
  envName: string; // 외부 env 이름(운영자가 .env 로 주입).
  shellVar: string; // 내부 shell 변수 이름(스크립트가 사용).
  default: string; // `${VAR:-default}` 의 default 값(무해 placeholder).
}

// (e) buildEnvOverrideTable(): 48~53행 6 env-override 배선 동형 — 순서 포함 6 원소 배열.
//     각 원소의 envName/shellVar/default 가 실 소스 라인과 일치(정적 대조 대상). 실 env 읽기 0.
function buildEnvOverrideTable(): EnvOverrideEntry[] {
  return [
    { envName: "SEED_LLM_PROVIDER", shellVar: "PROVIDER", default: "custom" }, // 48행.
    { envName: "SEED_LLM_MODEL_ID", shellVar: "MODEL", default: "gemma4:12b" }, // 49행.
    {
      envName: "SEED_LLM_API_KEY",
      shellVar: "APIKEY_PLAIN",
      default: "ollama",
    }, // 50행.
    {
      envName: "SEED_LLM_CONFIG_ID",
      shellVar: "CONFIG_ID",
      default: "seed-local-llm",
    }, // 51행.
    {
      envName: "POSTGRES_USER",
      shellVar: "PG_USER",
      default: "assessment_agent",
    }, // 52행.
    { envName: "POSTGRES_DB", shellVar: "PG_DB", default: "assessment_agent" }, // 53행.
  ];
}

// (b) REPO_DIR 은 no-op guard 앞 preamble 이라 6종 표와 별도 원소로 모델링.
const REPO_DIR_ENTRY: EnvOverrideEntry = {
  envName: "REPO_DIR",
  shellVar: "REPO_DIR",
  default: "/opt/assessment-agent",
}; // 30행.

// 특정 env-override 라인 앵커 — `SHELLVAR="${ENVNAME:-DEFAULT}"` 형태가 실 소스에 존재하는지.
function hasEnvOverrideLineAnchor(
  shellSource: string,
  entry: EnvOverrideEntry,
): boolean {
  const expected = `${entry.shellVar}="\${${entry.envName}:-${entry.default}}"`;
  return shellSource.includes(expected);
}

// 6 env-override 라인이 모두 실 소스에 존재하는지 — 하나라도 부재면 false.
function allEnvOverrideLinesPresent(shellSource: string): boolean {
  return buildEnvOverrideTable().every((e) =>
    hasEnvOverrideLineAnchor(shellSource, e),
  );
}

// (d)(f)(i) exitCodeAfterGuard(shellSource, guardCond): guard 조건 라인 직후 몇 줄 안의 `exit N` 을
//     추출 — no-op(exit 0) vs fail-fast(exit 1) 방향을 소스에서 직접 유도. 못 찾으면 null.
//     실 bash 실행 0(라인 스캔). scanWindow 안에서 첫 `exit <숫자>` 를 반환.
function exitCodeAfterGuard(
  shellSource: string,
  guardCond: string,
  scanWindow = 4,
): number | null {
  const lines = shellSource.replace(/\r\n/g, "\n").split("\n");
  const idx = lines.findIndex((l) => l.includes(guardCond));
  if (idx < 0) return null;
  for (let i = idx; i < Math.min(idx + scanWindow, lines.length); i++) {
    const m = lines[i].match(/\bexit\s+(\d+)\b/);
    if (m) return Number(m[1]);
  }
  return null;
}

// (h) apiKeyStdinNotArgv(block): 평문 apiKey 가 stdin 파이프로만 전달되는지 —
//     (1) `printf '%s' "$APIKEY_PLAIN" | docker compose exec` prefix 존재 AND
//     (2) `$APIKEY_PLAIN` 이 블록에 정확히 1회만 등장(argv 위치 재등장 0 — printf 에서만).
//     argv 로 넘기면 컨테이너 `ps` 노출(§9) → 회귀 검출. 실 docker 실행 0(문자열 검사).
function apiKeyStdinNotArgv(block: string): boolean {
  const stdinPrefix =
    /printf\s+'%s'\s+"\$APIKEY_PLAIN"\s*\|\s*docker compose exec/.test(block);
  const occurrences = (block.match(/\$APIKEY_PLAIN/g) || []).length;
  return stdinPrefix && occurrences === 1;
}

// (g) countBoundedPollingFailFast(shellSource): `[ "$ready" = 1 ] || {` fail-fast guard 개수 —
//     postgres·app 2종이 정본. fail-fast 를 제거한 mutant 는 개수가 줄어 회귀 검출. 실 sleep/polling 0.
function countBoundedPollingFailFast(shellSource: string): number {
  return (shellSource.match(/\[ "\$ready" = 1 \] \|\| \{/g) || []).length;
}

// (c) hasEnvLoadBlock(shellSource): `.env` 조건부 auto-export 로드 3-token 시퀀스가 순서대로 존재하는지 —
//     `if [ -f .env ]` → `set -a` → `. ./.env` → `set +a`. 실 source(`.`) 실행 0(문자열 순서 검사).
function hasEnvLoadBlock(shellSource: string): boolean {
  const gi = shellSource.indexOf(ENV_LOAD_GUARD);
  const ai = shellSource.indexOf(ENV_LOAD_SET_A);
  const si = shellSource.indexOf(ENV_LOAD_SOURCE);
  const pi = shellSource.indexOf(ENV_LOAD_SET_PLUS_A);
  return gi >= 0 && ai > gi && si > ai && pi > si;
}

// ── branch 모델(정본) — bash 분기의 방향을 pure 함수로 — flow/branch cover 분리용.

// (c) `.env` 존재 분기: 존재 → 로드, 부재 → skip.
function envLoadBranch(dotEnvExists: boolean): "load" | "skip" {
  return dotEnvExists ? "load" : "skip";
}

// (d) no-op guard 분기: ENDPOINT 빈 값 → exit 0(no-op), 값 있음 → 계속.
function noOpGuardBranch(endpoint: string): "noop-exit0" | "continue" {
  return endpoint === "" ? "noop-exit0" : "continue";
}

// (f) enc-key fail-fast 분기: 키 빈 값 → exit 1(fail-fast), 값 있음 → 계속.
function encKeyBranch(encKey: string): "failfast-exit1" | "continue" {
  return encKey === "" ? "failfast-exit1" : "continue";
}

// (g) readiness 분기: ready=1 → 진행, 그 외 → exit 1(fail-fast).
function readinessBranch(ready: number): "proceed" | "failfast-exit1" {
  return ready === 1 ? "proceed" : "failfast-exit1";
}

// 서두/gating 유도 앵커가 모두 실재하는지 — 하나라도 부재면 명시적 실패(빈 결과 성공-위장 0).
function extractGatingAnchors(shellSource: string): {
  strictMode: boolean;
  repoDir: boolean;
  envLoad: boolean;
  noOpGuard: boolean;
  envOverrides: boolean;
  encKeyFailFast: boolean;
  boundedPolling: boolean;
  apiKeyStdin: boolean;
  ciphertextFailFast: boolean;
} {
  return {
    strictMode: shellSource.includes(STRICT_MODE_LINE),
    repoDir:
      shellSource.includes(REPO_DIR_LINE) &&
      shellSource.includes(CD_REPO_DIR_LINE),
    envLoad: hasEnvLoadBlock(shellSource),
    noOpGuard:
      shellSource.includes(ENDPOINT_ASSIGN_LINE) &&
      shellSource.includes(NO_OP_GUARD_COND),
    envOverrides: allEnvOverrideLinesPresent(shellSource),
    encKeyFailFast: shellSource.includes(ENC_KEY_GUARD_COND),
    boundedPolling:
      shellSource.includes(POLLING_FOR_LINE) &&
      countBoundedPollingFailFast(shellSource) === 2,
    apiKeyStdin: apiKeyStdinNotArgv(shellSource),
    ciphertextFailFast: shellSource.includes(CIPHERTEXT_GUARD_COND),
  };
}

describe("realdata-e2e step③ seed-llm-config.sh 내부 env-gating 계약 smoke — strict-mode(errexit ON) + no-op guard(exit0) + 6 env-override 기본값 + enc-key fail-fast(exit1) + bounded readiness polling + apiKey stdin secret-safety + secret-safety (T-0959)", () => {
  describe("Happy-path: gating 앵커 정적 추출(pure 함수가 실 소스를 mirror)", () => {
    it("28·30·31·35~39·42·43·48~53·55·65·71·82·89~92행 gating 앵커 9종이 실 소스에 전부 존재", () => {
      const shellSource = readFileSync(SEED_SH_PATH, "utf8");
      const anchors = extractGatingAnchors(shellSource);
      expect(anchors.strictMode).toBe(true);
      expect(anchors.repoDir).toBe(true);
      expect(anchors.envLoad).toBe(true);
      expect(anchors.noOpGuard).toBe(true);
      expect(anchors.envOverrides).toBe(true);
      expect(anchors.encKeyFailFast).toBe(true);
      expect(anchors.boundedPolling).toBe(true);
      expect(anchors.apiKeyStdin).toBe(true);
      expect(anchors.ciphertextFailFast).toBe(true);
    });

    it("28행 `set -euo pipefail` → { nounset:true, pipefail:true, errexit:true } — redeploy.sh 동형(errexit ON)", () => {
      expect(parseShellStrictness(STRICT_MODE_LINE)).toEqual({
        nounset: true,
        pipefail: true,
        errexit: true,
      });
      // 실 소스 28행에서 추출한 라인도 동일 판정.
      const shellSource = readFileSync(SEED_SH_PATH, "utf8");
      const line = shellSource
        .replace(/\r\n/g, "\n")
        .split("\n")
        .find((l) => l.trim().startsWith("set -"));
      expect(line).toBeDefined();
      expect(parseShellStrictness(line as string)).toEqual({
        nounset: true,
        pipefail: true,
        errexit: true,
      });
    });

    it('30행 REPO_DIR env-override 기본값 + 31행 `cd "$REPO_DIR"` 가 실 소스에 존재', () => {
      const shellSource = readFileSync(SEED_SH_PATH, "utf8");
      expect(hasEnvOverrideLineAnchor(shellSource, REPO_DIR_ENTRY)).toBe(true);
      expect(shellSource).toContain(CD_REPO_DIR_LINE);
    });

    it("35~39행 `.env` 조건부 auto-export 로드 3-token 시퀀스(`if [ -f .env ]`→`set -a`→`. ./.env`→`set +a`)가 순서대로 존재", () => {
      const shellSource = readFileSync(SEED_SH_PATH, "utf8");
      expect(hasEnvLoadBlock(shellSource)).toBe(true);
    });

    it('42~46행 no-op guard(`ENDPOINT="${SEED_LLM_ENDPOINT_URL:-}"` + `if [ -z "$ENDPOINT" ]` → exit 0)가 실 소스에 존재', () => {
      const shellSource = readFileSync(SEED_SH_PATH, "utf8");
      expect(shellSource).toContain(ENDPOINT_ASSIGN_LINE);
      expect(shellSource).toContain(NO_OP_GUARD_COND);
      expect(exitCodeAfterGuard(shellSource, NO_OP_GUARD_COND)).toBe(0);
    });

    it('48~53행 6 env-override 라인이 각각 `SHELLVAR="${ENVNAME:-DEFAULT}"` 형태로 실 소스에 개별 존재(배선 동형)', () => {
      const shellSource = readFileSync(SEED_SH_PATH, "utf8");
      for (const entry of buildEnvOverrideTable()) {
        expect(hasEnvOverrideLineAnchor(shellSource, entry)).toBe(true);
      }
    });

    it("buildEnvOverrideTable() 는 정확히 6 원소(SEED_LLM_* 4 + POSTGRES_* 2) — 과부족 없음", () => {
      const table = buildEnvOverrideTable();
      expect(table).toHaveLength(6);
      expect(table).toEqual([
        {
          envName: "SEED_LLM_PROVIDER",
          shellVar: "PROVIDER",
          default: "custom",
        },
        {
          envName: "SEED_LLM_MODEL_ID",
          shellVar: "MODEL",
          default: "gemma4:12b",
        },
        {
          envName: "SEED_LLM_API_KEY",
          shellVar: "APIKEY_PLAIN",
          default: "ollama",
        },
        {
          envName: "SEED_LLM_CONFIG_ID",
          shellVar: "CONFIG_ID",
          default: "seed-local-llm",
        },
        {
          envName: "POSTGRES_USER",
          shellVar: "PG_USER",
          default: "assessment_agent",
        },
        {
          envName: "POSTGRES_DB",
          shellVar: "PG_DB",
          default: "assessment_agent",
        },
      ]);
    });

    it('55~58행 enc-key fail-fast(`if [ -z "${LLM_APIKEY_ENC_KEY:-}" ]` → exit 1)가 실 소스에 존재', () => {
      const shellSource = readFileSync(SEED_SH_PATH, "utf8");
      expect(shellSource).toContain(ENC_KEY_GUARD_COND);
      expect(exitCodeAfterGuard(shellSource, ENC_KEY_GUARD_COND)).toBe(1);
    });

    it('65·76행 bounded readiness polling 2종(`for _ in $(seq 1 30)` + `sleep 2` + `[ "$ready" = 1 ] || exit 1`)이 실 소스에 존재', () => {
      const shellSource = readFileSync(SEED_SH_PATH, "utf8");
      // `for _ in $(seq 1 30)` 는 2회(postgres·app), `sleep 2`·fail-fast guard 도 2회.
      expect((shellSource.match(/for _ in \$\(seq 1 30\)/g) || []).length).toBe(
        2,
      );
      expect((shellSource.match(/sleep 2/g) || []).length).toBe(2);
      expect(countBoundedPollingFailFast(shellSource)).toBe(2);
    });

    it("89~91행 apiKey stdin 전달(`printf '%s' \"$APIKEY_PLAIN\" | docker compose exec -T ... node -e`) + enc-key 컨테이너 `-e` 주입이 실 소스에 존재", () => {
      const shellSource = readFileSync(SEED_SH_PATH, "utf8");
      expect(shellSource).toContain(APIKEY_STDIN_PREFIX);
      expect(shellSource).toContain(ENC_KEY_INJECT);
      expect(apiKeyStdinNotArgv(shellSource)).toBe(true);
    });

    it('92~95행 ciphertext fail-fast(`if [ -z "$CIPHERTEXT" ]` → exit 1)가 실 소스에 존재', () => {
      const shellSource = readFileSync(SEED_SH_PATH, "utf8");
      expect(shellSource).toContain(CIPHERTEXT_GUARD_COND);
      expect(exitCodeAfterGuard(shellSource, CIPHERTEXT_GUARD_COND)).toBe(1);
    });
  });

  describe("Happy-path: no-op vs fail-fast exit-code 방향 분기 계약", () => {
    it("SEED_LLM_ENDPOINT_URL 부재 → exit 0(no-op), LLM_APIKEY_ENC_KEY 부재 → exit 1(fail-fast) — 두 방향이 반대", () => {
      const shellSource = readFileSync(SEED_SH_PATH, "utf8");
      const noOpExit = exitCodeAfterGuard(shellSource, NO_OP_GUARD_COND);
      const encKeyExit = exitCodeAfterGuard(shellSource, ENC_KEY_GUARD_COND);
      expect(noOpExit).toBe(0); // 정상 no-op.
      expect(encKeyExit).toBe(1); // 실패.
      // 두 미설정 상황의 exit-code 방향이 반대임을 검출(no-op 이 실패로, fail-fast 가 성공으로 변질 방지).
      expect(noOpExit).not.toBe(encKeyExit);
    });
  });

  describe("Happy-path: stdin-not-argv secret-safety 계약", () => {
    it("평문 apiKey(`$APIKEY_PLAIN`)가 argv 아닌 stdin 파이프로만 전달 — `$APIKEY_PLAIN` 은 소스에 정확히 1회(printf 위치)만 등장", () => {
      const shellSource = readFileSync(SEED_SH_PATH, "utf8");
      expect(apiKeyStdinNotArgv(shellSource)).toBe(true);
      // `$APIKEY_PLAIN` 은 50행 default 대입(`APIKEY_PLAIN=...`)이 아닌 `$` prefix 참조로 89행에서만 1회.
      expect((shellSource.match(/\$APIKEY_PLAIN\b/g) || []).length).toBe(1);
      // node -e argv(single-quote 스크립트) 뒤에 `$APIKEY_PLAIN` 재등장 0 — argv 노출 회귀 검출.
      expect(shellSource).toContain(APIKEY_STDIN_PREFIX);
    });
  });

  describe("Error path / negative cases 충분 cover — mutant 합성 소스로 not-match 단언(a~f)", () => {
    it("error path — shell 파일 부재 경로 → readFileSync throw(silent 0-byte fallback 0)", () => {
      const badPath = path.join(REPO_ROOT, "deploy/__does_not_exist__.sh");
      expect(() => readFileSync(badPath, "utf8")).toThrow();
    });

    it("error path — gating 앵커 부재 시 명시적 실패(빈 매칭을 pass 로 오통과 0)", () => {
      const emptySource = "#!/usr/bin/env bash\necho hello\n";
      const anchors = extractGatingAnchors(emptySource);
      expect(anchors.strictMode).toBe(false);
      expect(anchors.repoDir).toBe(false);
      expect(anchors.envLoad).toBe(false);
      expect(anchors.noOpGuard).toBe(false);
      expect(anchors.envOverrides).toBe(false);
      expect(anchors.encKeyFailFast).toBe(false);
      expect(anchors.boundedPolling).toBe(false);
      expect(anchors.apiKeyStdin).toBe(false);
      expect(anchors.ciphertextFailFast).toBe(false);
      // 실 소스는 반대로 전부 존재 — 부재/실재 변별을 대비로 실증.
      const realAnchors = extractGatingAnchors(
        readFileSync(SEED_SH_PATH, "utf8"),
      );
      expect(Object.values(realAnchors).every((v) => v === true)).toBe(true);
    });

    it("negative (a) — strict-mode errexit 제거 drift: `set -euo pipefail`→`set -uo pipefail` mutant 에서 errexit false", () => {
      const shellSource = readFileSync(SEED_SH_PATH, "utf8");
      // 정본: errexit true.
      expect(parseShellStrictness(STRICT_MODE_LINE).errexit).toBe(true);
      // mutant(모델 사본): `-e` 제거 → errexit false(첫 실패 흡수 회귀 — seed 오류가 조용히 통과).
      const mutant = STRICT_MODE_LINE.replace("-euo", "-uo");
      expect(parseShellStrictness(mutant).errexit).toBe(false);
      expect(parseShellStrictness(mutant).errexit).not.toBe(
        parseShellStrictness(STRICT_MODE_LINE).errexit,
      );
      // 실 소스는 `set -euo pipefail` 이고 `set -uo pipefail`(errexit 없음) 아님.
      expect(shellSource).toContain("set -euo pipefail");
      expect(shellSource).not.toContain("set -uo pipefail");
    });

    it("negative (b) — no-op guard 제거 drift: guard 블록 삭제 mutant 에서 noOpGuard 앵커·exit0 소실 검출", () => {
      const shellSource = readFileSync(SEED_SH_PATH, "utf8");
      // 정본: no-op guard + exit 0 존재.
      expect(shellSource).toContain(NO_OP_GUARD_COND);
      expect(exitCodeAfterGuard(shellSource, NO_OP_GUARD_COND)).toBe(0);
      // mutant(모델 사본): guard 조건 라인 제거 → 앵커 부재 + exit0 유도 실패(endpoint 미설정 무해-종료 소실).
      const mutant = shellSource.replace(NO_OP_GUARD_COND, "# (guard removed)");
      expect(mutant).not.toContain(NO_OP_GUARD_COND);
      expect(exitCodeAfterGuard(mutant, NO_OP_GUARD_COND)).toBeNull();
      expect(extractGatingAnchors(mutant).noOpGuard).toBe(false);
    });

    it("negative (c) — env-override default drift: `SEED_LLM_MODEL_ID:-gemma4:12b`→`:-llama3:8b` mutant 에서 default 앵커 소실", () => {
      const shellSource = readFileSync(SEED_SH_PATH, "utf8");
      const canonicalModel = buildEnvOverrideTable().find(
        (e) => e.envName === "SEED_LLM_MODEL_ID",
      ) as EnvOverrideEntry;
      expect(canonicalModel.default).toBe("gemma4:12b");
      // 정본 라인은 실 소스에 존재.
      expect(hasEnvOverrideLineAnchor(shellSource, canonicalModel)).toBe(true);
      // mutant(모델 사본): default drift → 실 소스에 그 라인 부재(모델 tag 오변경 회귀 검출).
      const modelMutant = { ...canonicalModel, default: "llama3:8b" };
      expect(hasEnvOverrideLineAnchor(shellSource, modelMutant)).toBe(false);
      // 원본 표 불변.
      expect(
        buildEnvOverrideTable().find((e) => e.envName === "SEED_LLM_MODEL_ID")
          ?.default,
      ).toBe("gemma4:12b");
    });

    it("negative (d) — enc-key fail-fast 제거 drift: guard 블록 삭제 mutant 에서 exit1 유도 소실(평문 upsert 방지 계약 소실)", () => {
      const shellSource = readFileSync(SEED_SH_PATH, "utf8");
      // 정본: enc-key guard + exit 1 존재.
      expect(shellSource).toContain(ENC_KEY_GUARD_COND);
      expect(exitCodeAfterGuard(shellSource, ENC_KEY_GUARD_COND)).toBe(1);
      // mutant(모델 사본): guard 제거 → exit1 유도 실패(암호화 키 부재 시 평문 upsert 위험 회귀).
      const mutant = shellSource.replace(
        ENC_KEY_GUARD_COND,
        "# (guard removed)",
      );
      expect(exitCodeAfterGuard(mutant, ENC_KEY_GUARD_COND)).toBeNull();
      expect(extractGatingAnchors(mutant).encKeyFailFast).toBe(false);
    });

    it('negative (e) — apiKey stdin→argv 이전 drift: printf 파이프 제거 + node 뒤 `"$APIKEY_PLAIN"` argv 삽입 mutant 에서 apiKeyStdinNotArgv false', () => {
      const shellSource = readFileSync(SEED_SH_PATH, "utf8");
      // 정본: stdin 전달.
      expect(apiKeyStdinNotArgv(shellSource)).toBe(true);
      // mutant 1(모델 사본): printf 파이프 제거 → stdin prefix 소실(argv 로 이전).
      const argvMutant = shellSource.replace(
        APIKEY_STDIN_PREFIX,
        `docker compose exec -T`,
      );
      // node -e 뒤에 apiKey 를 argv 로 추가한 형태를 합성(재등장 → 2회 또는 prefix 소실).
      const argvMutant2 = `${argvMutant}\n# node -e '...' "$APIKEY_PLAIN"`;
      expect(apiKeyStdinNotArgv(argvMutant2)).toBe(false);
      // mutant 2(모델 사본): printf 유지하되 argv 위치에도 재등장 → occurrences 2 → false.
      const argvMutant3 = `${shellSource}\nnode -e 'x' "$APIKEY_PLAIN"`;
      expect(apiKeyStdinNotArgv(argvMutant3)).toBe(false);
    });

    it('negative (f) — bounded polling fail-fast 제거 drift: `[ "$ready" = 1 ] || {` 1개 제거 mutant 에서 개수 2→1 소실(무한/미준비 방치)', () => {
      const shellSource = readFileSync(SEED_SH_PATH, "utf8");
      // 정본: fail-fast guard 2개(postgres·app).
      expect(countBoundedPollingFailFast(shellSource)).toBe(2);
      // mutant(모델 사본): 첫 fail-fast guard 1개 제거 → 개수 1(미준비 방치 회귀).
      const mutant = shellSource.replace('[ "$ready" = 1 ] || {', "# removed");
      expect(countBoundedPollingFailFast(mutant)).toBe(1);
      expect(extractGatingAnchors(mutant).boundedPolling).toBe(false);
    });
  });

  describe("원본 read-only 입증 — 합성 mutate 후에도 원본 추출 결과 불변", () => {
    it("mutant 합성(replace 는 사본 반환) 후에도 원본 소스 텍스트·앵커 추출 결과가 불변", () => {
      const shellSource = readFileSync(SEED_SH_PATH, "utf8");
      const snapshot = shellSource;
      const before = extractGatingAnchors(shellSource);
      // 여러 mutant 합성(전부 replace = 새 문자열 반환, 원본 미변조).
      shellSource.replace(NO_OP_GUARD_COND, "x");
      shellSource.replace(ENC_KEY_GUARD_COND, "x");
      shellSource.replace(STRICT_MODE_LINE, "set -uo pipefail");
      shellSource.replace('[ "$ready" = 1 ] || {', "x");
      // 원본 텍스트 불변.
      expect(shellSource).toBe(snapshot);
      // 재추출도 동일(결정론 + 원본 불변).
      expect(extractGatingAnchors(shellSource)).toEqual(before);
      // buildEnvOverrideTable 산출 mutate 해도 다음 호출 fresh(공유 참조 노출 0).
      const first = buildEnvOverrideTable();
      first[0].default = "MUTATED";
      expect(buildEnvOverrideTable()[0].default).toBe("custom");
    });
  });

  describe("§9 secret-safety — 추출/합성 토큰에 실 credential 0", () => {
    it("추출/합성 문자열(앵커·표·exit·boolean)에 gh 토큰 어휘·실 secret·실 endpoint IP 미등장(§9/REQ-059)", () => {
      const shellSource = readFileSync(SEED_SH_PATH, "utf8");
      const synthesized = [
        JSON.stringify(buildEnvOverrideTable()),
        JSON.stringify(REPO_DIR_ENTRY),
        JSON.stringify(parseShellStrictness(STRICT_MODE_LINE)),
        JSON.stringify(extractGatingAnchors(shellSource)),
        String(exitCodeAfterGuard(shellSource, NO_OP_GUARD_COND)),
        String(exitCodeAfterGuard(shellSource, ENC_KEY_GUARD_COND)),
        String(apiKeyStdinNotArgv(shellSource)),
        String(countBoundedPollingFailFast(shellSource)),
      ];
      // gh 토큰·Bearer·Authorization·sk- 등 실 credential 어휘.
      const credentialPattern =
        /(ghp_|--token|GITHUB_TOKEN|GH_TOKEN|\bBearer\b|Authorization|\bsk-)/i;
      // 실 endpoint IP(예: 192.168.x.y) — 추출 토큰에 등장 0(소스 주석의 예시 IP 는 추출 대상 아님).
      const ipPattern = /\b(?:\d{1,3}\.){3}\d{1,3}\b/;
      synthesized.forEach((s) => {
        expect(credentialPattern.test(s)).toBe(false);
        expect(ipPattern.test(s)).toBe(false);
      });
      // 기본값 placeholder(ollama·gemma4:12b·custom·seed-local-llm·assessment_agent)는 무해 — 허용.
      expect(JSON.stringify(buildEnvOverrideTable())).toContain("ollama");
      expect(JSON.stringify(buildEnvOverrideTable())).toContain(
        "seed-local-llm",
      );
      // process.env 읽기 0 — fixture 는 정적 파일 텍스트만(입력이 파라미터).
    });
  });

  describe("flow/branch cover — .env 존재·no-op guard·enc-key fail-fast·readiness 분기 분리", () => {
    it("branch: `.env` 존재-분기(if [ -f .env ]) — 존재→load / 부재→skip 양측 분리", () => {
      expect(envLoadBranch(true)).toBe("load");
      expect(envLoadBranch(false)).toBe("skip");
      expect(envLoadBranch(true)).not.toBe(envLoadBranch(false));
    });

    it("branch: no-op guard true 분기 — ENDPOINT 빈 값→noop-exit0 / 값 있음→continue 양측 분리", () => {
      expect(noOpGuardBranch("")).toBe("noop-exit0");
      expect(noOpGuardBranch("http://host:11434/v1")).toBe("continue");
      expect(noOpGuardBranch("")).not.toBe(noOpGuardBranch("x"));
    });

    it("branch: enc-key fail-fast 분기 — 키 빈 값→failfast-exit1 / 값 있음→continue 양측 분리", () => {
      expect(encKeyBranch("")).toBe("failfast-exit1");
      expect(encKeyBranch("deadbeef")).toBe("continue");
      expect(encKeyBranch("")).not.toBe(encKeyBranch("k"));
    });

    it("branch: readiness ready/미ready 분기 — ready=1→proceed / 그 외→failfast-exit1 양측 분리", () => {
      expect(readinessBranch(1)).toBe("proceed");
      expect(readinessBranch(0)).toBe("failfast-exit1");
      expect(readinessBranch(1)).not.toBe(readinessBranch(0));
    });
  });

  describe("dormant / non-gated 확인 — side-effect 0", () => {
    it("gating 해석 모델이 env / 전역 상태 없이 순수하게 동작(non-gated — describe.skip 0·항상 실행)", () => {
      // 본 describe 가 실행된다는 것 자체가 항상 실행(gating 분기 0)의 런타임 증거.
      const envSnapshot = { ...process.env };
      const before = parseShellStrictness(STRICT_MODE_LINE);
      // 실 process.env 를 mutate 해도 산출 불변 — 모델이 process.env 미참조(파라미터로만).
      Object.assign(process.env, { SEED_LLM_MODEL_ID: "tampered" });
      const after = parseShellStrictness(STRICT_MODE_LINE);
      delete process.env.SEED_LLM_MODEL_ID;
      expect(after).toEqual(before);
      expect(Object.keys(process.env)).toEqual(Object.keys(envSnapshot));
      // buildEnvOverrideTable 도 process.env 미참조.
      expect(buildEnvOverrideTable()[1].default).toBe("gemma4:12b");
    });

    it("파일 read 는 deploy/seed-llm-config.sh 읽기만 — 실 docker/psql/node/bash 실행 0(추출 결과가 문자열이지 실행 산출물 아님)", () => {
      const shellSource = readFileSync(SEED_SH_PATH, "utf8");
      expect(shellSource.startsWith("#!")).toBe(true);
      expect(
        Object.values(extractGatingAnchors(shellSource)).every((v) => v),
      ).toBe(true);
    });

    it("pure/추출 함수가 입력(shell 소스)을 mutate 0(원본 불변) + 결정론", () => {
      const shellSource = readFileSync(SEED_SH_PATH, "utf8");
      const snap = shellSource;
      extractGatingAnchors(shellSource);
      allEnvOverrideLinesPresent(shellSource);
      hasEnvLoadBlock(shellSource);
      apiKeyStdinNotArgv(shellSource);
      countBoundedPollingFailFast(shellSource);
      expect(shellSource).toBe(snap);
      // 결정론 — 동일 입력 두 번 호출 deep-equal.
      expect(extractGatingAnchors(shellSource)).toEqual(
        extractGatingAnchors(shellSource),
      );
      expect(buildEnvOverrideTable()).toEqual(buildEnvOverrideTable());
    });
  });
});
