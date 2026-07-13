// realdata-e2e-redeploy-internal-step-sequence-strict-mode-reset-hard-mirror-idempotency-nonfatal-seed-continuation-contract.smoke-spec.ts
// — 무인 nightly runner 가 호출하는 재배포 스크립트 `deploy/redeploy.sh` 의 **내부 ordered 재배포
// 단계-시퀀스 + `set -euo pipefail` 엄격모드 + reset-hard mirror 멱등 + 비치명 seed 계속 계약**을
// 실 shell 파일을 readFileSync 로 읽어(실행/source/실 git·docker·seed 0) 정적 검증하는 non-gated
// build-time smoke (T-0958, PLAN.md §109 step①/④ realdata-e2e nightly runner — 재배포 leg 완결).
//
// 봉함 불변식: **redeploy.sh 는 `set -euo pipefail`(errexit ON — daily-test.sh 와 정반대)로 시작해
// REPO_DIR/BRANCH 를 env-override 기본값으로 해석하고, cd → git fetch --prune → git checkout →
// git reset --hard origin/$BRANCH(mirror 멱등 복구) → docker compose up -d --build → 조건부 seed
// (`if [ -f ]` guard + `|| echo` 비치명 continuation) → docker image prune -f(build 뒤) → docker
// compose ps 순서로 진행한다. 이 순서·strict-mode·reset-hard·비치명 seed 중 하나라도 정본과 silent
// 분기하면 무인 야간 재배포가 잘못된 상태(빌드 전 prune·drift 미복구·seed 실패가 재배포를 깨뜨림)로 진행된다.**
// 계약(실 소스 유도 앵커 — 5·8·9·11·14·15·18·23·31~34·40·43행 중심):
//   (a) strict-mode(5행 `set -euo pipefail` — nounset·pipefail·errexit 모두 ON; daily-test.sh 는 errexit OFF = 반대) ·
//   (b) env-override 기본값(8행 REPO_DIR·9행 DEPLOY_BRANCH→BRANCH 매핑 + `:-default`) ·
//   (c) ordered step-sequence(cd→fetch→checkout→reset-hard→build→seed→prune→ps 의 소스 내 index 단조 증가) ·
//   (d) reset-hard mirror 멱등(18행 `git reset --hard "origin/${BRANCH}"` — --soft 아님, drift 복구) ·
//   (e) 비치명 seed continuation(31~34행 `if [ -f ]` guard + seed 호출 + `|| echo` — errexit-ON 하 seed 만 non-fatal) ·
//   (f) prune-after-build(40행 prune 이 23행 build 뒤 — build 앞이면 방금 만든 이미지 정리 위험) ·
//   (g) seed 경로 실존(deploy/seed-llm-config.sh 가 repo-root 기준 실 파일 — dangling 방지) ·
//   (h) §9 secret-safety(추출/합성 토큰에 실 토큰·secret·password·실 endpoint 0 — 경로/git/docker/env 이름만).
//
// 전략(T-0956 shell-strictness·T-0955 step_redeploy invocation·T-0797 artifact-parity 동형): redeploy.sh
// 유도 표현을 정적 앵커로 추출 + 해석 동형 TS 순수 함수(`parseShellStrictness`·`stepIndices`·
// `isStrictlyIncreasing`·`parseSeedBlock`·`hasResetHardMirror`)로 strict-mode·ordered-index·reset-hard·
// 비치명 seed·prune-순서·secret-safety 불변식 assert. 합성 mutant 사본으로 negative(a~e) 변별.
// T-0797(redeploy ↔ service/timer/compose artifact parity — outer 배선)·T-0955(daily-test.sh 가
// redeploy.sh 를 *호출하는* 배선 — caller 측)·T-0956(daily-test.sh 서두 shell-strictness — errexit OFF
// 반대 계약) 와 distinct 상보 surface(redeploy.sh *내부* ordered 시퀀스).
//   🔥 실 git/docker/seed/systemd/bash/네트워크 0 · process.env 읽기 0(입력은 pure 함수 파라미터) ·
//      credential 0(§9/REQ-059) · 새 dep 0(node fs/path) · src 변경 0(test-only) ·
//      deploy/redeploy.sh 읽기만(실행/source 0 · 변경 0).
import { readFileSync, existsSync } from "fs";
import * as path from "path";

// repo-root 경로 — test 실행 cwd 무관하게 robust 하게 해석(`__dirname` = test/smoke,
// 두 단계 위가 repo-root). `process.cwd()` 대신 `__dirname` 기준 상대로 고정한다(sibling T-0797/T-0956).
const REPO_ROOT = path.resolve(__dirname, "../..");
const REDEPLOY_SH_PATH = path.join(REPO_ROOT, "deploy/redeploy.sh");

// 정본 앵커(실 bash 표현의 TS mirror — 실 bash/git/docker 실행 0).
const STRICT_MODE_LINE = `set -euo pipefail`; // 5행 — errexit ON(daily-test.sh 와 반대).
const RESET_HARD_LINE = `git reset --hard "origin/${"$"}{BRANCH}"`; // 18행 — mirror 멱등(아래 상수로 대체).
const SEED_SCRIPT_SUFFIX = `deploy/seed-llm-config.sh`; // 31~32행 seed 호출 경로 suffix.

// reset-hard 정본 라인(18행) — JS 템플릿 보간 회피 위해 단일따옴표 리터럴로 `${BRANCH}` 를 그대로 담는다.
const RESET_HARD_MIRROR = 'git reset --hard "origin/${BRANCH}"';

// ── TS 동형 pure 함수(정본) — redeploy.sh 내부 시퀀스(5~43행)를 모델링.
//    입력(문자열)은 mutate 하지 않는다(읽기만). 실 bash/git/docker/env 읽기 0 — 입력은 파라미터.

// (a) shell-strictness 파싱 결과 — `set` 플래그 3종 분리 boolean.
interface ShellStrictness {
  nounset: boolean; // `-u` — unset 변수 참조 시 error.
  pipefail: boolean; // `-o pipefail` — 파이프 중간 실패 전파.
  errexit: boolean; // `-e` — 첫 실패에서 script abort. **redeploy 정본은 true(ON)**.
}

// (a) parseShellStrictness(setLine): `set -euo pipefail` 라인을 파싱해 strictness 플래그 분리 —
//     조합 short-flag(`-euo`, `-uo`) 와 개별 flag(`-e -u -o pipefail`) 모두 수용. 실 bash `set` 실행 0.
function parseShellStrictness(setLine: string): ShellStrictness {
  const shortFlagChars = new Set<string>();
  for (const m of setLine.matchAll(/(?<![\w-])-([a-zA-Z]+)\b/g)) {
    // `-o` 뒤 옵션 이름(`pipefail`)은 flag 문자가 아니므로 `o` 만 남기고 값은 별도 처리.
    for (const ch of m[1]) shortFlagChars.add(ch);
  }
  const pipefail = /-\w*o\b\s+pipefail\b/.test(setLine);
  return {
    nounset: shortFlagChars.has("u"),
    pipefail,
    errexit: shortFlagChars.has("e"),
  };
}

// (b) env-override 표 원소 — 외부 env 이름 → 내부 shell 변수 + documented default.
interface EnvOverrideEntry {
  envName: string; // 외부 env 이름(운영자가 주입).
  shellVar: string; // 내부 shell 변수 이름(스크립트가 사용).
  default: string; // `${VAR:-default}` 의 default 값.
}

// (b) buildEnvOverrideTable(): 8~9행 2 env-override 배선 동형 — 순서 포함 2 원소 배열.
//     REPO_DIR(동일 이름)·DEPLOY_BRANCH→BRANCH(상이 매핑). 실 env 읽기 0.
function buildEnvOverrideTable(): EnvOverrideEntry[] {
  return [
    {
      envName: "REPO_DIR",
      shellVar: "REPO_DIR",
      default: "/opt/assessment-agent",
    }, // 8행.
    { envName: "DEPLOY_BRANCH", shellVar: "BRANCH", default: "main" }, // 9행 매핑.
  ];
}

// 특정 env-override 라인 앵커 — `SHELLVAR="${ENVNAME:-DEFAULT}"` 형태가 실 소스에 존재하는지.
function hasEnvOverrideLineAnchor(
  shellSource: string,
  entry: EnvOverrideEntry,
): boolean {
  const expected = `${entry.shellVar}="\${${entry.envName}:-${entry.default}}"`;
  return shellSource.includes(expected);
}

// (c) ordered step 정본 — 각 단계의 정본 앵커 토큰(소스 내 등장 순서가 정본 순서).
interface OrderedStep {
  name: string; // 단계 이름(진단용).
  token: string; // 실 소스에 등장하는 앵커 토큰.
}

// (c) buildOrderedSteps(): redeploy.sh 내부 재배포 8 단계 정본 순서 — 이 배열 순서가 소스 내
//     단조 증가해야 한다(reorder = 계약 위반). 실 git/docker 실행 0.
function buildOrderedSteps(): OrderedStep[] {
  return [
    { name: "cd", token: 'cd "$REPO_DIR"' }, // 11행.
    { name: "fetch", token: "git fetch --prune origin" }, // 14행.
    { name: "checkout", token: 'git checkout "$BRANCH"' }, // 15행.
    { name: "reset-hard", token: RESET_HARD_MIRROR }, // 18행.
    { name: "build", token: "docker compose up -d --build" }, // 23행.
    {
      name: "seed-guard",
      token: 'if [ -f "$REPO_DIR/deploy/seed-llm-config.sh" ]',
    }, // 31행.
    { name: "prune", token: "docker image prune -f" }, // 40행.
    { name: "ps", token: "docker compose ps" }, // 43행.
  ];
}

// (c) stepIndices(source, steps): 각 step 토큰의 소스 내 첫 등장 index 배열 — 부재는 -1.
//     실 실행 0(문자열 indexOf). 순서 판정의 입력.
function stepIndices(source: string, steps: OrderedStep[]): number[] {
  return steps.map((s) => source.indexOf(s.token));
}

// (c) isStrictlyIncreasing(nums): 모든 원소가 >= 0 이며 단조 강증가하는지 — 하나라도 -1(부재) 이거나
//     역전이면 false. ordered step-sequence 계약 판정. 빈 배열은 true(vacuous).
function isStrictlyIncreasing(nums: number[]): boolean {
  for (let i = 0; i < nums.length; i++) {
    if (nums[i] < 0) return false; // 부재 토큰.
    if (i > 0 && nums[i] <= nums[i - 1]) return false; // 역전/동일.
  }
  return true;
}

// (c) synthOrderedSource(order): step 이름 순서대로 정본 토큰을 개행 연결한 합성 소스 —
//     정본 순서면 단조 증가, 뒤바뀐 순서면 역전. 실 소스 미변조(합성 사본만).
function synthOrderedSource(order: string[]): string {
  const byName = new Map(buildOrderedSteps().map((s) => [s.name, s.token]));
  return order.map((n) => byName.get(n) ?? "").join("\n");
}

// (d) hasResetHardMirror(source): 18행 `git reset --hard "origin/${BRANCH}"` mirror 멱등 라인 존재 —
//     `--soft`/`--mixed` 로 변질되거나 대상이 origin/$BRANCH 아니면 false(drift 미복구 검출).
function hasResetHardMirror(source: string): boolean {
  return source.includes(RESET_HARD_MIRROR);
}

// (e) 비치명 seed 블록 파싱 결과 — guard·호출·비치명 continuation 분리 boolean.
interface SeedBlockContract {
  hasGuard: boolean; // `if [ -f "$REPO_DIR/deploy/seed-llm-config.sh" ]` 존재.
  invokesSeed: boolean; // `bash "$REPO_DIR/deploy/seed-llm-config.sh"` 호출.
  nonFatalContinuation: boolean; // `|| echo`(또는 `|| true`) — seed 실패가 재배포를 안 깸.
}

// (e) parseSeedBlock(source): 31~34행 seed 조건블록을 파싱 — guard·호출·비치명 continuation 검출.
//     errexit-ON(`set -e`) 하에서도 seed 만 `||` 로 예외적 non-fatal. 실 seed 실행 0.
function parseSeedBlock(source: string): SeedBlockContract {
  return {
    hasGuard:
      /if\s+\[\s+-f\s+"\$REPO_DIR\/deploy\/seed-llm-config\.sh"\s+\]/.test(
        source,
      ),
    invokesSeed: /bash\s+"\$REPO_DIR\/deploy\/seed-llm-config\.sh"/.test(
      source,
    ),
    nonFatalContinuation: /\|\|\s*(echo|true)\b/.test(source),
  };
}

// (g) seedScriptExists(): seed 호출 경로(deploy/seed-llm-config.sh)가 repo-root 기준 실 파일로 실존 —
//     오타·dangling 경로 검출. 정적 파일 존재만 확인(실행 0).
function seedScriptExists(suffix: string): boolean {
  return existsSync(path.join(REPO_ROOT, suffix));
}

// (h) 정본 앵커가 모두 실재하는지 — 하나라도 부재면 명시적 실패(빈 결과 성공-위장 0).
function extractSequenceAnchors(source: string): {
  strictMode: boolean;
  resetHardMirror: boolean;
  orderedMonotonic: boolean;
  seedNonFatal: boolean;
} {
  return {
    strictMode: source.includes(STRICT_MODE_LINE),
    resetHardMirror: hasResetHardMirror(source),
    orderedMonotonic: isStrictlyIncreasing(
      stepIndices(source, buildOrderedSteps()),
    ),
    seedNonFatal: parseSeedBlock(source).nonFatalContinuation,
  };
}

describe("realdata-e2e step①/④ redeploy.sh 내부 재배포 단계-시퀀스 계약 smoke — strict-mode(`set -euo pipefail` errexit ON) + env-override(REPO_DIR·DEPLOY_BRANCH→BRANCH) + ordered 8-step(cd→fetch→checkout→reset-hard→build→seed→prune→ps) + reset-hard mirror 멱등 + 비치명 seed continuation + prune-after-build + seed 경로 실존 + secret-safety (T-0958)", () => {
  describe("Happy-path: 서두/시퀀스 앵커 정적 추출(pure 함수가 실 소스를 mirror)", () => {
    it("5행 `set -euo pipefail`·18행 reset-hard mirror·8-step 단조성·seed 비치명 continuation 4 앵커 전부 true", () => {
      const source = readFileSync(REDEPLOY_SH_PATH, "utf8");
      const anchors = extractSequenceAnchors(source);
      expect(anchors.strictMode).toBe(true);
      expect(anchors.resetHardMirror).toBe(true);
      expect(anchors.orderedMonotonic).toBe(true);
      expect(anchors.seedNonFatal).toBe(true);
    });

    it('2 env-override 라인(REPO_DIR·DEPLOY_BRANCH→BRANCH)이 각각 `SHELLVAR="${ENVNAME:-DEFAULT}"` 형태로 실 소스에 개별 존재(env-override 배선)', () => {
      const source = readFileSync(REDEPLOY_SH_PATH, "utf8");
      for (const entry of buildEnvOverrideTable()) {
        expect(hasEnvOverrideLineAnchor(source, entry)).toBe(true);
      }
    });
  });

  describe("Happy-path: parseShellStrictness(setLine) — redeploy 는 errexit ON(daily-test.sh 와 반대)", () => {
    it("`set -euo pipefail` → { nounset:true, pipefail:true, errexit:true } — `-e` 존재로 errexit true(첫 실패 abort)", () => {
      expect(parseShellStrictness("set -euo pipefail")).toEqual({
        nounset: true,
        pipefail: true,
        errexit: true,
      });
    });

    it("실 소스 5행에서 추출한 strictness 라인도 동일 판정 — nounset/pipefail/errexit 모두 true", () => {
      const source = readFileSync(REDEPLOY_SH_PATH, "utf8");
      const line = source
        .replace(/\r\n/g, "\n")
        .split("\n")
        .find((l) => l.trim().startsWith("set -"));
      expect(line).toBeDefined();
      const strictness = parseShellStrictness(line as string);
      expect(strictness.nounset).toBe(true);
      expect(strictness.pipefail).toBe(true);
      expect(strictness.errexit).toBe(true);
    });
  });

  describe("Happy-path: buildEnvOverrideTable()", () => {
    it("2 원소 배열(순서 포함) — REPO_DIR(동일)·DEPLOY_BRANCH→BRANCH(상이 매핑)", () => {
      expect(buildEnvOverrideTable()).toEqual([
        {
          envName: "REPO_DIR",
          shellVar: "REPO_DIR",
          default: "/opt/assessment-agent",
        },
        { envName: "DEPLOY_BRANCH", shellVar: "BRANCH", default: "main" },
      ]);
    });

    it("DEPLOY_BRANCH→BRANCH 는 env 이름과 shell 변수 이름이 상이(매핑 배선 — 오배선 검출점)", () => {
      const branch = buildEnvOverrideTable().find(
        (e) => e.envName === "DEPLOY_BRANCH",
      ) as EnvOverrideEntry;
      expect(branch.shellVar).toBe("BRANCH");
      expect(branch.envName).not.toBe(branch.shellVar);
    });
  });

  describe("Happy-path: ordered 8-step 시퀀스 단조성", () => {
    it("실 소스에서 8 step 토큰이 정본 순서대로 단조 증가 index 로 등장(cd<fetch<checkout<reset-hard<build<seed<prune<ps)", () => {
      const source = readFileSync(REDEPLOY_SH_PATH, "utf8");
      const idx = stepIndices(source, buildOrderedSteps());
      // 모든 토큰 실재(부재 -1 없음).
      idx.forEach((i) => expect(i).toBeGreaterThanOrEqual(0));
      // 단조 강증가.
      expect(isStrictlyIncreasing(idx)).toBe(true);
    });

    it("정확히 8 step — 재배포 시퀀스 표가 과부족 없음", () => {
      expect(buildOrderedSteps()).toHaveLength(8);
    });
  });

  describe("Happy-path: reset-hard mirror 멱등(18행)", () => {
    it('실 소스에 `git reset --hard "origin/${BRANCH}"` 존재 — --hard 이며 대상이 origin/$BRANCH(drift 복구)', () => {
      const source = readFileSync(REDEPLOY_SH_PATH, "utf8");
      expect(hasResetHardMirror(source)).toBe(true);
      expect(source).toContain("git reset --hard");
      // --soft/--mixed 는 mirror 정렬을 안 하므로 실 소스에 부재.
      expect(source).not.toContain("git reset --soft");
      expect(source).not.toContain("git reset --mixed");
    });
  });

  describe("Happy-path: 비치명 seed continuation(31~34행) + seed 경로 실존", () => {
    it("seed 블록이 guard(`if [ -f ]`) + seed 호출 + `|| echo` 비치명 continuation 3요소 모두 충족", () => {
      const source = readFileSync(REDEPLOY_SH_PATH, "utf8");
      const seed = parseSeedBlock(source);
      expect(seed.hasGuard).toBe(true);
      expect(seed.invokesSeed).toBe(true);
      expect(seed.nonFatalContinuation).toBe(true);
    });

    it("errexit-ON(`set -e`) 인데도 seed 라인이 `||` 로 감싸져 seed 실패가 재배포를 안 깸(예외적 non-fatal)", () => {
      const source = readFileSync(REDEPLOY_SH_PATH, "utf8");
      // strict-mode(errexit ON) 와 seed non-fatal 이 공존.
      expect(parseShellStrictness(STRICT_MODE_LINE).errexit).toBe(true);
      expect(parseSeedBlock(source).nonFatalContinuation).toBe(true);
      // `|| echo` continuation 실재.
      expect(source).toContain("|| echo");
    });

    it("seed 호출 경로(deploy/seed-llm-config.sh)가 repo-root 기준 실 파일로 실존(existsSync — dangling 방지)", () => {
      expect(seedScriptExists(SEED_SCRIPT_SUFFIX)).toBe(true);
    });
  });

  describe("Happy-path: prune-after-build 순서(40행 prune > 23행 build)", () => {
    it("`docker image prune -f` 가 `docker compose up -d --build` 뒤에 옴(방금 만든 이미지 정리 위험 차단)", () => {
      const source = readFileSync(REDEPLOY_SH_PATH, "utf8");
      const buildIdx = source.indexOf("docker compose up -d --build");
      const pruneIdx = source.indexOf("docker image prune -f");
      expect(buildIdx).toBeGreaterThanOrEqual(0);
      expect(pruneIdx).toBeGreaterThanOrEqual(0);
      expect(pruneIdx).toBeGreaterThan(buildIdx);
    });
  });

  describe("branch: strict-mode 있음/없음 정적 대조", () => {
    it("정본 `set -euo pipefail` → errexit true, mutant `set -uo pipefail`(daily-test.sh 형) → errexit false — 두 입력 분리 실증", () => {
      expect(parseShellStrictness("set -euo pipefail").errexit).toBe(true);
      expect(parseShellStrictness("set -uo pipefail").errexit).toBe(false);
      expect(parseShellStrictness("set -euo pipefail").errexit).not.toBe(
        parseShellStrictness("set -uo pipefail").errexit,
      );
      // 실 소스 5행은 `set -euo pipefail`(errexit ON) 이고 daily-test.sh 형 `set -uo pipefail` 아님.
      const source = readFileSync(REDEPLOY_SH_PATH, "utf8");
      expect(source).toContain("set -euo pipefail");
    });
  });

  describe("branch: prune 순서 정상/뒤집힘 분리", () => {
    it("정본 순서 합성 → 단조 true, prune 을 build 앞으로 옮긴 합성 → 단조 false(순서 뒤집힘 검출)", () => {
      const canonicalOrder = [
        "cd",
        "fetch",
        "checkout",
        "reset-hard",
        "build",
        "seed-guard",
        "prune",
        "ps",
      ];
      const canonical = synthOrderedSource(canonicalOrder);
      expect(
        isStrictlyIncreasing(stepIndices(canonical, buildOrderedSteps())),
      ).toBe(true);
      // prune 을 build 앞으로 이동한 뒤바뀐 순서.
      const reordered = [
        "cd",
        "fetch",
        "checkout",
        "reset-hard",
        "prune",
        "build",
        "seed-guard",
        "ps",
      ];
      const swapped = synthOrderedSource(reordered);
      expect(
        isStrictlyIncreasing(stepIndices(swapped, buildOrderedSteps())),
      ).toBe(false);
    });
  });

  describe("Error path / negative cases 충분 cover (mutant 합성 사본 — 원본 미변조)", () => {
    it("error path — redeploy 파일 부재 경로 → readFileSync throw(silent 0-byte fallback 0)", () => {
      const badPath = path.join(REPO_ROOT, "deploy/__does_not_exist__.sh");
      expect(() => readFileSync(badPath, "utf8")).toThrow();
    });

    it("error path — 시퀀스 앵커 부재 시 명시적 실패(빈 매칭을 pass 로 오통과 0)", () => {
      const emptySource = "#!/usr/bin/env bash\necho hello\n";
      const anchors = extractSequenceAnchors(emptySource);
      expect(anchors.strictMode).toBe(false);
      expect(anchors.resetHardMirror).toBe(false);
      expect(anchors.orderedMonotonic).toBe(false);
      expect(anchors.seedNonFatal).toBe(false);
      // 실 소스는 반대로 전부 true — 부재/실재를 변별함을 대비로 실증.
      const realAnchors = extractSequenceAnchors(
        readFileSync(REDEPLOY_SH_PATH, "utf8"),
      );
      expect(realAnchors.strictMode).toBe(true);
      expect(realAnchors.resetHardMirror).toBe(true);
      expect(realAnchors.orderedMonotonic).toBe(true);
      expect(realAnchors.seedNonFatal).toBe(true);
    });

    it("negative (a) — errexit 제거 drift 변별: `set -euo pipefail`→`set -uo pipefail` 사본에서 'errexit === true' assert 실패(daily-test.sh 와 혼동 방지)", () => {
      // 정본: errexit ON.
      expect(parseShellStrictness(STRICT_MODE_LINE).errexit).toBe(true);
      // mutant(모델 사본): `-e` 제거 → errexit false(strict-mode 위반).
      const mutant = STRICT_MODE_LINE.replace("-euo", "-uo");
      expect(parseShellStrictness(mutant).errexit).toBe(false);
      expect(parseShellStrictness(mutant).errexit).not.toBe(
        parseShellStrictness(STRICT_MODE_LINE).errexit,
      );
      // 원본 판정 불변(replace 는 사본 반환).
      expect(parseShellStrictness(STRICT_MODE_LINE).errexit).toBe(true);
    });

    it("negative (b) — reset --hard→--soft drift 변별: 사본에서 hasResetHardMirror false(mirror 멱등 위반)", () => {
      const source = readFileSync(REDEPLOY_SH_PATH, "utf8");
      // 정본: reset --hard mirror 존재.
      expect(hasResetHardMirror(source)).toBe(true);
      // mutant(모델 사본): --hard → --soft(drift 미복구 회귀).
      const mutant = source.replace("git reset --hard", "git reset --soft");
      expect(hasResetHardMirror(mutant)).toBe(false);
      expect(mutant).toContain("git reset --soft");
      // 원본 불변.
      expect(hasResetHardMirror(source)).toBe(true);
      expect(source).not.toContain("git reset --soft");
    });

    it("negative (c) — prune 을 build 앞으로 옮긴 mutant → ordered-index 단조성 false(순서 뒤집힘 검출)", () => {
      // 정본 순서 → 단조 true.
      const canonical = synthOrderedSource([
        "cd",
        "fetch",
        "checkout",
        "reset-hard",
        "build",
        "seed-guard",
        "prune",
        "ps",
      ]);
      expect(
        isStrictlyIncreasing(stepIndices(canonical, buildOrderedSteps())),
      ).toBe(true);
      // mutant: prune 을 build 앞으로 → 단조 false.
      const mutant = synthOrderedSource([
        "cd",
        "fetch",
        "checkout",
        "reset-hard",
        "prune",
        "build",
        "seed-guard",
        "ps",
      ]);
      expect(
        isStrictlyIncreasing(stepIndices(mutant, buildOrderedSteps())),
      ).toBe(false);
    });

    it("negative (d) — seed `|| echo` 제거 mutant → parseSeedBlock.nonFatalContinuation false(seed 실패가 재배포를 깨뜨림)", () => {
      const source = readFileSync(REDEPLOY_SH_PATH, "utf8");
      // 정본: 비치명 continuation 존재.
      expect(parseSeedBlock(source).nonFatalContinuation).toBe(true);
      // mutant(모델 사본): `|| echo ...` continuation 제거 → non-fatal 소실(errexit-ON 하 seed 실패 = 재배포 abort).
      const mutant = source.replace(/\s*\|\|\s*echo[^\n]*/g, "");
      expect(parseSeedBlock(mutant).nonFatalContinuation).toBe(false);
      // guard·호출 자체는 mutant 에도 남음(continuation 만 소실).
      expect(parseSeedBlock(mutant).hasGuard).toBe(true);
      expect(parseSeedBlock(mutant).invokesSeed).toBe(true);
      // 원본 불변.
      expect(parseSeedBlock(source).nonFatalContinuation).toBe(true);
    });

    it("negative (e) — seed 경로 rename mutant(deploy/seed-renamed.sh) → existsSync false(dangling 경로 검출)", () => {
      // 정본 경로: 실존.
      expect(seedScriptExists(SEED_SCRIPT_SUFFIX)).toBe(true);
      // mutant(모델 사본): rename 된 경로 → 부재.
      expect(seedScriptExists("deploy/seed-renamed.sh")).toBe(false);
      // 원본 경로 판정 불변.
      expect(seedScriptExists(SEED_SCRIPT_SUFFIX)).toBe(true);
    });

    it("negative (f) — credential/secret 누출 0: 추출/합성 문자열에 gh 토큰 어휘·credential 실값·실 endpoint 미등장(§9/REQ-059)", () => {
      const source = readFileSync(REDEPLOY_SH_PATH, "utf8");
      const synthesized = [
        JSON.stringify(buildEnvOverrideTable()),
        JSON.stringify(buildOrderedSteps()),
        JSON.stringify(parseShellStrictness(STRICT_MODE_LINE)),
        JSON.stringify(parseSeedBlock(source)),
        JSON.stringify(extractSequenceAnchors(source)),
        String(seedScriptExists(SEED_SCRIPT_SUFFIX)),
      ];
      const credentialPattern =
        /(ghp_|--token|GITHUB_TOKEN|GH_TOKEN|\bBearer\b|Authorization|\bsk-|password|passwd|secret)/i;
      synthesized.forEach((s) => {
        expect(credentialPattern.test(s)).toBe(false);
      });
      // 실 소스 자체도 토큰/secret 어휘 미포함(경로·git·docker·env 이름만).
      expect(credentialPattern.test(source)).toBe(false);
      // 추출 토큰은 실 endpoint(IP/URL) 도 미포함 — env 이름·경로만.
      expect(source).not.toMatch(/https?:\/\/\d+\.\d+\.\d+\.\d+/);
    });
  });

  describe("flow: 결정론 · no-mutation(원본 read-only 입증)", () => {
    it("동일 입력으로 pure 함수를 두 번 호출하면 deep-equal(결정론)", () => {
      const source = readFileSync(REDEPLOY_SH_PATH, "utf8");
      expect(parseShellStrictness(STRICT_MODE_LINE)).toEqual(
        parseShellStrictness(STRICT_MODE_LINE),
      );
      expect(buildOrderedSteps()).toEqual(buildOrderedSteps());
      expect(buildEnvOverrideTable()).toEqual(buildEnvOverrideTable());
      expect(parseSeedBlock(source)).toEqual(parseSeedBlock(source));
      expect(extractSequenceAnchors(source)).toEqual(
        extractSequenceAnchors(source),
      );
    });

    it("합성 mutate(사본 replace) 후에도 원본 소스 텍스트·pure 함수 산출이 불변(원본 read-only)", () => {
      const source = readFileSync(REDEPLOY_SH_PATH, "utf8");
      const snapshot = source;
      // 사본 mutate(negative a/b/d 에서 쓰는 replace) — 원본 불변 확인.
      source.replace("-euo", "-uo");
      source.replace("git reset --hard", "git reset --soft");
      source.replace(/\s*\|\|\s*echo[^\n]*/g, "");
      expect(source).toBe(snapshot);
      // 추출/파싱 후에도 원본 불변.
      extractSequenceAnchors(source);
      parseSeedBlock(source);
      stepIndices(source, buildOrderedSteps());
      expect(source).toBe(snapshot);
      // buildOrderedSteps 산출을 mutate 해도 다음 호출은 fresh(공유 참조 노출 0).
      const first = buildOrderedSteps();
      first[0].token = "MUTATED";
      expect(buildOrderedSteps()[0].token).toBe('cd "$REPO_DIR"');
    });
  });

  describe("dormant / non-gated 확인 — side-effect 0", () => {
    it("시퀀스 해석 모델이 env / 전역 상태 없이 순수하게 동작(non-gated — describe.skip 0·gating 분기 0)", () => {
      // 본 describe 가 실행된다는 것 자체가 describe.skip 0(항상 실행)의 런타임 증거.
      const envSnapshot = { ...process.env };
      const before = parseShellStrictness(STRICT_MODE_LINE);
      // 실 process.env 를 mutate 해도 산출 불변 — 모델이 process.env 를 참조하지 않음(파라미터로만).
      Object.assign(process.env, { DEPLOY_BRANCH: "feature-x" });
      const after = parseShellStrictness(STRICT_MODE_LINE);
      delete process.env.DEPLOY_BRANCH;
      expect(after).toEqual(before);
      expect(Object.keys(process.env)).toEqual(Object.keys(envSnapshot));
    });

    it("파일 read 는 deploy/redeploy.sh 읽기만 — 실 git/docker/seed/bash 실행 0(추출 결과가 문자열이지 실행 산출물 아님)", () => {
      const source = readFileSync(REDEPLOY_SH_PATH, "utf8");
      expect(source.startsWith("#!")).toBe(true);
      expect(source.includes(STRICT_MODE_LINE)).toBe(true);
      expect(
        isStrictlyIncreasing(stepIndices(source, buildOrderedSteps())),
      ).toBe(true);
      // 상수 RESET_HARD_LINE 는 참조만 — 사용처 없는 dead 상수 회귀 방지 겸 형태 확인.
      expect(RESET_HARD_LINE).toContain("git reset --hard");
    });
  });
});
