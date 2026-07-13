// realdata-e2e-docker-entrypoint-internal-step-sequence-strict-mode-exec-pid1-migration-before-boot-posix-sh-contract.smoke-spec.ts
// — 무인 nightly runner 의 재배포가 재기동하는 컨테이너의 부팅 스크립트 `deploy/docker-entrypoint.sh`
// 의 **내부 부팅 시퀀스 + `set -e` errexit-ON strict-mode + exec PID-1 치환 + migration-before-boot
// ordered + `#!/bin/sh` POSIX 인터프리터 + echo 진단 관측성 계약**을 실 shell 파일을 readFileSync 로
// 읽어(실행/source/실 docker·prisma·node 0) 정적 검증하는 non-gated build-time smoke
// (T-0960, PLAN.md §109 step①/③ realdata-e2e nightly runner — 컨테이너-부팅 leg 완결).
//
// 봉함 불변식: **docker-entrypoint.sh 는 `#!/bin/sh`(POSIX sh — alpine busybox ash 호환, bash 아님)로
// 시작해 `set -e`(errexit ON — nounset·pipefail 은 미설정 = 최소 strict-mode)를 켠 뒤, echo 진단 →
// `prisma migrate deploy`(migration 적용) → echo 진단 → `exec node dist/src/main`(PID-1 치환 앱 기동)
// 순서로 진행한다. 이 순서·strict-mode·exec·shebang·echo 중 하나라도 정본과 silent 분기하면 —
// set -e 소실로 migration 실패가 조용히 무시된 채 미적용 스키마 위 부팅 / migrate·boot 순서 뒤집힘으로
// 앱이 마이그레이션 전 스키마에 붙음 / exec 소실로 node 가 PID 1 아닌 자식으로 떠 SIGTERM 미전파(docker
// stop hang) / #!/bin/sh→bashism 도입 시 alpine sh 부팅 실패 — 무인 야간 재배포가 crash-loop 또는
// 조용한 stale/broken 배포로 진행된다.**
// 계약(실 소스 유도 앵커 — 1·11·13·14·19·20행 중심):
//   (a) POSIX-sh 인터프리터(1행 `#!/bin/sh` — bash 아님) ·
//   (b) 최소 strict-mode(11행 `set -e` — errexit ON, nounset·pipefail OFF; redeploy `set -euo pipefail`·
//       daily-test `set -uo pipefail` 와 구별) ·
//   (c) migration-before-boot ordered(14행 `prisma migrate deploy` 명령이 20행 `exec node dist/src/main`
//       명령 앞 — 미적용 스키마 위 부팅 방지) ·
//   (d) exec PID-1 치환(20행 부팅 명령이 `exec node ...` — 단순 `node ...` 아님; SIGTERM/graceful shutdown 전파) ·
//   (e) echo 진단 관측성(13·19행 — 두 step 앞에 `echo "[entrypoint] ..."` 진단 라인 = crash-loop 진단 앵커) ·
//   (f) §9 secret-safety(추출/합성 토큰에 실 토큰·secret·password·실 endpoint 0 — shebang/flag/명령/echo 문자열만).
//
// 전략(T-0958 redeploy 내부 시퀀스·T-0956 shell-strictness·T-0797 artifact-parity 동형): docker-entrypoint.sh
// 유도 표현을 정적 앵커로 추출 + 해석 동형 TS 순수 함수(`parseInterpreter`·`parseShellStrictness`·
// `extractCommandLines`·`migrateBeforeBoot`·`bootLineUsesExec`·`entrypointEchoDiagnostics`)로 shebang·
// strict-mode·ordered·exec·echo 불변식 assert. 합성 mutant 사본으로 negative(a~e) 변별.
// 기존 `realdata-e2e-docker-entrypoint-runtime-contract-build-artifact-parity-drift.smoke-spec.ts`(prisma
// 바이너리 경로·`migrate deploy` 서브커맨드 ↔ package.json/tsconfig/Dockerfile artifact parity)·T-0958
// (redeploy.sh 가 컨테이너를 재기동하는 상위 orchestration) 와 distinct 상보 surface
// (docker-entrypoint.sh *내부* 부팅 시퀀스·strict-mode·exec).
//   🔥 실 docker/prisma/node/migration/컨테이너/네트워크 0 · process.env 읽기 0(입력은 pure 함수 파라미터) ·
//      credential 0(§9/REQ-059) · 새 dep 0(node fs/path) · src 변경 0(test-only) ·
//      deploy/docker-entrypoint.sh 읽기만(실행/source 0 · 변경 0).
import { readFileSync } from "fs";
import * as path from "path";

// repo-root 경로 — test 실행 cwd 무관하게 robust 하게 해석(`__dirname` = test/smoke,
// 두 단계 위가 repo-root). `process.cwd()` 대신 `__dirname` 기준 상대로 고정한다(sibling T-0958).
const REPO_ROOT = path.resolve(__dirname, "../..");
const ENTRYPOINT_SH_PATH = path.join(REPO_ROOT, "deploy/docker-entrypoint.sh");

// 정본 앵커(실 shell 표현의 TS mirror — 실 shell/docker/prisma/node 실행 0).
const POSIX_SHEBANG = `#!/bin/sh`; // 1행 — POSIX sh(bash 아님).
const STRICT_MODE_LINE = `set -e`; // 11행 — errexit ON(nounset·pipefail OFF = 최소 strict-mode).
const MIGRATE_CMD = `./node_modules/.bin/prisma migrate deploy`; // 14행 — migration 적용 명령.
const BOOT_CMD = `exec node dist/src/main`; // 20행 — exec PID-1 치환 앱 기동.

// ── TS 동형 pure 함수(정본) — docker-entrypoint.sh 부팅 시퀀스(1~20행)를 모델링.
//    입력(문자열)은 mutate 하지 않는다(읽기만). 실 shell/docker/prisma/env 읽기 0 — 입력은 파라미터.

// 소스를 CRLF-정규화 후 라인 배열로 — 모든 파서의 공통 입력.
function toLines(source: string): string[] {
  return source.replace(/\r\n/g, "\n").split("\n");
}

// (a) parseInterpreter(source): 1행 shebang 에서 인터프리터 경로를 추출 — `#!/bin/sh` → `/bin/sh`.
//     shebang 부재면 null. 실 exec 0(문자열 파싱).
function parseInterpreter(source: string): string | null {
  const first = toLines(source)[0] ?? "";
  const m = first.match(/^#!\s*(\S+)/);
  return m ? m[1] : null;
}

// (a) isPosixSh(interp): 인터프리터가 POSIX `/bin/sh`(bash 아님) 인지 — alpine busybox ash 호환 계약.
function isPosixSh(interp: string | null): boolean {
  return interp === "/bin/sh";
}

// (b) shell-strictness 파싱 결과 — `set` 플래그 3종 분리 boolean.
interface ShellStrictness {
  nounset: boolean; // `-u` — unset 변수 참조 시 error. **entrypoint 정본은 false(미설정)**.
  pipefail: boolean; // `-o pipefail` — 파이프 중간 실패 전파. **entrypoint 정본은 false(미설정)**.
  errexit: boolean; // `-e` — 첫 실패에서 script abort. **entrypoint 정본은 true(ON)**.
}

// (b) parseShellStrictness(setLine): `set -e` 라인을 파싱해 strictness 플래그 분리 — 조합 short-flag
//     (`-euo`)·단일 flag(`-e`) 모두 수용. entrypoint 는 errexit-ON·nounset/pipefail-OFF 최소 strict-mode.
//     실 bash `set` 실행 0.
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

// (b) extractSetLine(source): 실 소스에서 `set ` 로 시작하는 strict-mode 라인 추출 — 부재면 undefined.
function extractSetLine(source: string): string | undefined {
  return toLines(source).find((l) => l.trim().startsWith("set "));
}

// (b) hasErrexit(source): 실 소스가 errexit-ON strict-mode 를 켜는지 — set 라인 부재나 `-e` 소실이면 false.
function hasErrexit(source: string): boolean {
  const line = extractSetLine(source);
  return line !== undefined && parseShellStrictness(line).errexit;
}

// (c) extractCommandLines(source): comment/shebang/set/echo/빈 라인을 제외한 실 실행 명령 라인 배열 —
//     소스 등장 순서 보존. entrypoint 정본은 [`./node_modules/.bin/prisma migrate deploy`,
//     `exec node dist/src/main`] 2 명령. echo 진단 라인은 제외해 명령-순서만 모델링(echo 안의
//     `node dist/src/main` 문자열 오검출 방지). 실 실행 0.
function extractCommandLines(source: string): string[] {
  return toLines(source)
    .map((l) => l.trim())
    .filter(
      (l) =>
        l.length > 0 &&
        !l.startsWith("#") && // 주석 + shebang(`#!`).
        !l.startsWith("set ") && // strict-mode 라인.
        !l.startsWith("echo "), // 진단 라인.
    );
}

// (c) migrateBeforeBoot(source): 명령 라인 중 `prisma migrate deploy` 명령이 `node dist/src/main`
//     부팅 명령보다 **앞**에 옴 — migration-before-boot ordered 계약. 하나라도 부재거나 순서 뒤집히면 false.
function migrateBeforeBoot(source: string): boolean {
  const cmds = extractCommandLines(source);
  const migrateIdx = cmds.findIndex((c) => /prisma migrate deploy/.test(c));
  const bootIdx = cmds.findIndex((c) => /\bnode\s+dist\/src\/main\b/.test(c));
  return migrateIdx >= 0 && bootIdx >= 0 && migrateIdx < bootIdx;
}

// (d) findBootCommandLine(source): 부팅 명령 라인(`node dist/src/main` 으로 끝나는 명령, exec 유무 무관)
//     추출 — echo 진단 라인(따옴표 + 뒤 텍스트) 은 정규식 anchor(`$`) 로 배제. 부재면 undefined.
function findBootCommandLine(source: string): string | undefined {
  return toLines(source)
    .map((l) => l.trim())
    .find((l) => /^(exec\s+)?node\s+dist\/src\/main$/.test(l));
}

// (d) bootLineUsesExec(source): 부팅 명령 라인이 `exec` 로 시작 — node 가 자식이 아닌 PID 1 치환
//     (SIGTERM/graceful shutdown 전파, docker stop hang 방지). exec 소실이면 false.
function bootLineUsesExec(source: string): boolean {
  const line = findBootCommandLine(source);
  return line !== undefined && /^exec\s+/.test(line);
}

// (e) echo 진단 관측성 파싱 결과 — 두 step(migrate·boot) 앞에 `echo "[entrypoint] ..."` 진단 라인 존재 여부.
interface EchoDiagnostics {
  count: number; // `echo "[entrypoint] ..."` 라인 수(정본 2).
  beforeMigrate: boolean; // migrate 진단 echo 가 migrate 명령 앞.
  beforeBoot: boolean; // boot 진단 echo 가 boot 명령 앞.
}

// (e) entrypointEchoDiagnostics(source): 13·19행 진단 echo 를 파싱 — 각 echo 가 대응 명령 앞에 오는지.
//     crash-loop 진단 시 stdout 로그 앵커(주석 8~9행이 이 로그를 진단 가이드로 명시). 실 실행 0.
function entrypointEchoDiagnostics(source: string): EchoDiagnostics {
  const echoLines = toLines(source).filter((l) =>
    /^\s*echo\s+"\[entrypoint\]/.test(l),
  );
  const migrateEchoIdx = source.search(
    /echo\s+"\[entrypoint\][^"]*migrate deploy/,
  );
  const migrateCmdIdx = source.indexOf(MIGRATE_CMD);
  const bootEchoIdx = source.search(/echo\s+"\[entrypoint\][^"]*기동/);
  const bootCmdIdx = source.indexOf(BOOT_CMD);
  return {
    count: echoLines.length,
    beforeMigrate:
      migrateEchoIdx >= 0 &&
      migrateCmdIdx >= 0 &&
      migrateEchoIdx < migrateCmdIdx,
    beforeBoot: bootEchoIdx >= 0 && bootCmdIdx >= 0 && bootEchoIdx < bootCmdIdx,
  };
}

// (f) extractEntrypointAnchors(source): 부팅 계약 5 불변식을 한 번에 집계 — 하나라도 부재면 명시적
//     false(빈 결과 성공-위장 0).
function extractEntrypointAnchors(source: string): {
  posixSh: boolean;
  errexit: boolean;
  migrateBeforeBoot: boolean;
  execPid1: boolean;
  echoDiagnostics: boolean;
} {
  const echo = entrypointEchoDiagnostics(source);
  return {
    posixSh: isPosixSh(parseInterpreter(source)),
    errexit: hasErrexit(source),
    migrateBeforeBoot: migrateBeforeBoot(source),
    execPid1: bootLineUsesExec(source),
    echoDiagnostics: echo.count >= 2 && echo.beforeMigrate && echo.beforeBoot,
  };
}

describe("realdata-e2e step①/③ docker-entrypoint.sh 내부 부팅 시퀀스 계약 smoke — POSIX-sh(`#!/bin/sh`) + 최소 strict-mode(`set -e` errexit ON, nounset·pipefail OFF) + migration-before-boot ordered(prisma migrate deploy < exec node dist/src/main) + exec PID-1 치환 + echo 진단 관측성 + secret-safety (T-0960)", () => {
  describe("Happy-path: 부팅 시퀀스 앵커 정적 추출(pure 함수가 실 소스를 mirror)", () => {
    it("5 불변식(posix-sh·errexit·migrate<boot·exec-pid1·echo 진단) 전부 true", () => {
      const source = readFileSync(ENTRYPOINT_SH_PATH, "utf8");
      const anchors = extractEntrypointAnchors(source);
      expect(anchors.posixSh).toBe(true);
      expect(anchors.errexit).toBe(true);
      expect(anchors.migrateBeforeBoot).toBe(true);
      expect(anchors.execPid1).toBe(true);
      expect(anchors.echoDiagnostics).toBe(true);
    });

    it("실 소스에 1행 `#!/bin/sh`·11행 `set -e`·14행 migrate 명령·20행 `exec node dist/src/main` 4 앵커 전부 존재", () => {
      const source = readFileSync(ENTRYPOINT_SH_PATH, "utf8");
      expect(source).toContain(POSIX_SHEBANG);
      expect(source).toContain(STRICT_MODE_LINE);
      expect(source).toContain(MIGRATE_CMD);
      expect(source).toContain(BOOT_CMD);
    });
  });

  describe("Happy-path: parseInterpreter/isPosixSh — POSIX sh(bash 아님)", () => {
    it("실 소스 shebang → `/bin/sh` 이며 isPosixSh true(alpine busybox ash 호환)", () => {
      const source = readFileSync(ENTRYPOINT_SH_PATH, "utf8");
      const interp = parseInterpreter(source);
      expect(interp).toBe("/bin/sh");
      expect(isPosixSh(interp)).toBe(true);
      // bash 인터프리터 아님(bashism 위험 배제).
      expect(interp).not.toContain("bash");
    });

    it("shebang 없는 소스 → parseInterpreter null → isPosixSh false(부재 오통과 0)", () => {
      expect(parseInterpreter("echo hi\n")).toBeNull();
      expect(isPosixSh(null)).toBe(false);
    });
  });

  describe("Happy-path: parseShellStrictness(setLine) — entrypoint 는 errexit ON·nounset/pipefail OFF(최소 strict-mode)", () => {
    it("`set -e` → { nounset:false, pipefail:false, errexit:true } — redeploy `set -euo pipefail`·daily-test `set -uo pipefail` 와 구별되는 최소 strict-mode", () => {
      expect(parseShellStrictness("set -e")).toEqual({
        nounset: false,
        pipefail: false,
        errexit: true,
      });
    });

    it("실 소스 11행에서 추출한 strictness 라인도 동일 판정 — errexit true·nounset/pipefail false", () => {
      const source = readFileSync(ENTRYPOINT_SH_PATH, "utf8");
      const line = extractSetLine(source);
      expect(line).toBeDefined();
      const strictness = parseShellStrictness(line as string);
      expect(strictness.errexit).toBe(true);
      expect(strictness.nounset).toBe(false);
      expect(strictness.pipefail).toBe(false);
    });
  });

  describe("Happy-path: extractCommandLines — 정확히 2 실행 명령(migrate·boot)만 추출(echo/comment/set/shebang 제외)", () => {
    it("실 소스 명령 라인 = [prisma migrate deploy, exec node dist/src/main] 2개(echo 진단·주석·set·shebang 미포함)", () => {
      const source = readFileSync(ENTRYPOINT_SH_PATH, "utf8");
      const cmds = extractCommandLines(source);
      expect(cmds).toHaveLength(2);
      expect(cmds[0]).toContain("prisma migrate deploy");
      expect(cmds[1]).toContain("node dist/src/main");
      // echo 진단·set·shebang 은 명령 목록에서 배제됨.
      expect(cmds.some((c) => c.startsWith("echo"))).toBe(false);
      expect(cmds.some((c) => c.startsWith("set"))).toBe(false);
      expect(cmds.some((c) => c.startsWith("#"))).toBe(false);
    });
  });

  describe("Happy-path: migration-before-boot ordered(14행 migrate < 20행 boot)", () => {
    it("실 소스에서 `prisma migrate deploy` 명령이 `node dist/src/main` 부팅 명령 앞에 옴(미적용 스키마 위 부팅 방지)", () => {
      const source = readFileSync(ENTRYPOINT_SH_PATH, "utf8");
      expect(migrateBeforeBoot(source)).toBe(true);
    });
  });

  describe("Happy-path: exec PID-1 치환(20행 boot 라인)", () => {
    it("부팅 명령 라인이 `exec node dist/src/main`(단순 node 아님) — node 가 PID 1 치환(SIGTERM/graceful shutdown 전파)", () => {
      const source = readFileSync(ENTRYPOINT_SH_PATH, "utf8");
      expect(findBootCommandLine(source)).toBe("exec node dist/src/main");
      expect(bootLineUsesExec(source)).toBe(true);
    });
  });

  describe("Happy-path: echo 진단 관측성(13·19행)", () => {
    it('`echo "[entrypoint] ..."` 진단 라인 2개가 각각 migrate·boot 명령 앞에 옴(crash-loop stdout 로그 앵커)', () => {
      const source = readFileSync(ENTRYPOINT_SH_PATH, "utf8");
      const echo = entrypointEchoDiagnostics(source);
      expect(echo.count).toBe(2);
      expect(echo.beforeMigrate).toBe(true);
      expect(echo.beforeBoot).toBe(true);
    });
  });

  describe("branch: strict-mode 있음/없음 정적 대조", () => {
    it("정본 `set -e` → errexit true, mutant(set 라인 제거) → errexit false — 두 입력 분리 실증", () => {
      const source = readFileSync(ENTRYPOINT_SH_PATH, "utf8");
      expect(hasErrexit(source)).toBe(true);
      // set 라인을 제거한 사본 → errexit false.
      const mutant = source.replace(/^\s*set -e\s*$/m, "");
      expect(hasErrexit(mutant)).toBe(false);
      // 원본 불변.
      expect(hasErrexit(source)).toBe(true);
    });

    it("entrypoint(`set -e`)·redeploy(`set -euo pipefail`)·daily-test(`set -uo pipefail`) 3 strict-mode 프로파일이 서로 구별됨", () => {
      const entry = parseShellStrictness("set -e");
      const redeploy = parseShellStrictness("set -euo pipefail");
      const daily = parseShellStrictness("set -uo pipefail");
      // errexit: entry ON, redeploy ON, daily OFF.
      expect([entry.errexit, redeploy.errexit, daily.errexit]).toEqual([
        true,
        true,
        false,
      ]);
      // nounset: entry OFF, redeploy·daily ON.
      expect([entry.nounset, redeploy.nounset, daily.nounset]).toEqual([
        false,
        true,
        true,
      ]);
      // entry 는 pipefail OFF(최소 strict-mode).
      expect(entry.pipefail).toBe(false);
    });
  });

  describe("branch: migrate/boot 순서 정상/뒤집힘 분리", () => {
    it("정본 순서 → migrateBeforeBoot true, boot 를 migrate 앞으로 옮긴 합성 → false(순서 뒤집힘 검출)", () => {
      const canonical =
        "./node_modules/.bin/prisma migrate deploy\nexec node dist/src/main\n";
      expect(migrateBeforeBoot(canonical)).toBe(true);
      const swapped =
        "exec node dist/src/main\n./node_modules/.bin/prisma migrate deploy\n";
      expect(migrateBeforeBoot(swapped)).toBe(false);
    });
  });

  describe("branch: exec 있음/없음 분리", () => {
    it("`exec node dist/src/main` → bootLineUsesExec true, `node dist/src/main`(exec 제거) → false", () => {
      expect(bootLineUsesExec("exec node dist/src/main\n")).toBe(true);
      expect(bootLineUsesExec("node dist/src/main\n")).toBe(false);
    });
  });

  describe("branch: shebang sh/bash 분리", () => {
    it("`#!/bin/sh` → isPosixSh true, `#!/bin/bash` → false(POSIX-sh 계약 위반)", () => {
      expect(isPosixSh(parseInterpreter("#!/bin/sh\n"))).toBe(true);
      expect(isPosixSh(parseInterpreter("#!/bin/bash\n"))).toBe(false);
    });
  });

  describe("Error path / negative cases 충분 cover (mutant 합성 사본 — 원본 미변조)", () => {
    it("error path — entrypoint 파일 부재 경로 → readFileSync throw(silent 0-byte fallback 0)", () => {
      const badPath = path.join(REPO_ROOT, "deploy/__does_not_exist__.sh");
      expect(() => readFileSync(badPath, "utf8")).toThrow();
    });

    it("error path — 부팅 앵커 부재 시 명시적 false(빈 매칭을 pass 로 오통과 0)", () => {
      const emptySource = "#!/usr/bin/env bash\necho hello\n";
      const anchors = extractEntrypointAnchors(emptySource);
      expect(anchors.posixSh).toBe(false);
      expect(anchors.errexit).toBe(false);
      expect(anchors.migrateBeforeBoot).toBe(false);
      expect(anchors.execPid1).toBe(false);
      expect(anchors.echoDiagnostics).toBe(false);
      // 실 소스는 반대로 전부 true — 부재/실재를 변별함을 대비로 실증.
      const realAnchors = extractEntrypointAnchors(
        readFileSync(ENTRYPOINT_SH_PATH, "utf8"),
      );
      expect(realAnchors.posixSh).toBe(true);
      expect(realAnchors.errexit).toBe(true);
      expect(realAnchors.migrateBeforeBoot).toBe(true);
      expect(realAnchors.execPid1).toBe(true);
      expect(realAnchors.echoDiagnostics).toBe(true);
    });

    it("negative (a) — `set -e` 제거 mutant → hasErrexit false(strict-mode 위반; migration 실패 silent-무시 방지)", () => {
      const source = readFileSync(ENTRYPOINT_SH_PATH, "utf8");
      // 정본: errexit ON.
      expect(hasErrexit(source)).toBe(true);
      // mutant(모델 사본): set -e 라인 제거 → errexit 소실.
      const mutant = source.replace(/^\s*set -e\s*$/m, "");
      expect(hasErrexit(mutant)).toBe(false);
      expect(extractEntrypointAnchors(mutant).errexit).toBe(false);
      // 원본 불변(replace 는 사본 반환).
      expect(hasErrexit(source)).toBe(true);
    });

    it("negative (b) — `exec node dist/src/main` 을 migrate 앞으로 옮긴 mutant → migrateBeforeBoot false(순서 뒤집힘 검출)", () => {
      const source = readFileSync(ENTRYPOINT_SH_PATH, "utf8");
      // 정본: migrate < boot.
      expect(migrateBeforeBoot(source)).toBe(true);
      // mutant(모델 사본): boot 명령 라인을 migrate 명령 라인 앞으로 재배치.
      const withoutBoot = source.replace(/^exec node dist\/src\/main$/m, "");
      const mutant = withoutBoot.replace(
        /^(\.\/node_modules\/\.bin\/prisma migrate deploy)$/m,
        "exec node dist/src/main\n$1",
      );
      expect(migrateBeforeBoot(mutant)).toBe(false);
      // 원본 불변.
      expect(migrateBeforeBoot(source)).toBe(true);
    });

    it("negative (c) — `exec node dist/src/main`→`node dist/src/main`(exec 제거) mutant → bootLineUsesExec false(PID-1 치환/signal 전파 위반)", () => {
      const source = readFileSync(ENTRYPOINT_SH_PATH, "utf8");
      // 정본: exec 로 PID-1 치환.
      expect(bootLineUsesExec(source)).toBe(true);
      // mutant(모델 사본): 부팅 명령 라인의 `exec ` 제거(echo 안 문자열은 anchor 로 미영향).
      const mutant = source.replace(
        /^exec node dist\/src\/main$/m,
        "node dist/src/main",
      );
      expect(bootLineUsesExec(mutant)).toBe(false);
      expect(extractEntrypointAnchors(mutant).execPid1).toBe(false);
      // node 부팅 명령 자체는 mutant 에도 남음(exec 만 소실).
      expect(findBootCommandLine(mutant)).toBe("node dist/src/main");
      // 원본 불변.
      expect(bootLineUsesExec(source)).toBe(true);
    });

    it("negative (d) — `#!/bin/sh`→`#!/bin/bash` mutant → isPosixSh false(POSIX-sh 계약 위반; bashism 위험)", () => {
      const source = readFileSync(ENTRYPOINT_SH_PATH, "utf8");
      // 정본: POSIX sh.
      expect(isPosixSh(parseInterpreter(source))).toBe(true);
      // mutant(모델 사본): shebang 을 bash 로 변질.
      const mutant = source.replace("#!/bin/sh", "#!/bin/bash");
      expect(isPosixSh(parseInterpreter(mutant))).toBe(false);
      expect(parseInterpreter(mutant)).toBe("/bin/bash");
      // 원본 불변.
      expect(isPosixSh(parseInterpreter(source))).toBe(true);
    });

    it('negative (e) — migrate/boot 앞 `echo "[entrypoint] ..."` 진단 라인 제거 mutant → echoDiagnostics 소실(관측성 계약 소실)', () => {
      const source = readFileSync(ENTRYPOINT_SH_PATH, "utf8");
      // 정본: 진단 echo 2개 + 각 명령 앞.
      const canonical = entrypointEchoDiagnostics(source);
      expect(canonical.count).toBe(2);
      expect(canonical.beforeMigrate).toBe(true);
      expect(canonical.beforeBoot).toBe(true);
      // mutant(모델 사본): `echo "[entrypoint] ..."` 진단 라인 전부 제거.
      const mutant = source.replace(/^\s*echo\s+"\[entrypoint\][^\n]*$/gm, "");
      const mutated = entrypointEchoDiagnostics(mutant);
      expect(mutated.count).toBe(0);
      expect(mutated.beforeMigrate).toBe(false);
      expect(mutated.beforeBoot).toBe(false);
      expect(extractEntrypointAnchors(mutant).echoDiagnostics).toBe(false);
      // 원본 불변.
      expect(entrypointEchoDiagnostics(source).count).toBe(2);
    });

    it("negative (f) — credential/secret 누출 0: 추출/합성 문자열에 gh 토큰 어휘·credential 실값·실 endpoint 미등장(§9/REQ-059)", () => {
      const source = readFileSync(ENTRYPOINT_SH_PATH, "utf8");
      const synthesized = [
        String(parseInterpreter(source)),
        JSON.stringify(parseShellStrictness(STRICT_MODE_LINE)),
        JSON.stringify(extractCommandLines(source)),
        JSON.stringify(entrypointEchoDiagnostics(source)),
        JSON.stringify(extractEntrypointAnchors(source)),
        String(findBootCommandLine(source)),
      ];
      const credentialPattern =
        /(ghp_|--token|GITHUB_TOKEN|GH_TOKEN|\bBearer\b|Authorization|\bsk-|password|passwd|secret)/i;
      synthesized.forEach((s) => {
        expect(credentialPattern.test(s)).toBe(false);
      });
      // 실 소스 자체도 토큰/secret 어휘 미포함(shebang·flag·명령·echo 문자열만).
      expect(credentialPattern.test(source)).toBe(false);
      // 추출 토큰은 실 endpoint(IP/URL) 도 미포함.
      expect(source).not.toMatch(/https?:\/\/\d+\.\d+\.\d+\.\d+/);
    });
  });

  describe("flow: 결정론 · no-mutation(원본 read-only 입증)", () => {
    it("동일 입력으로 pure 함수를 두 번 호출하면 deep-equal(결정론)", () => {
      const source = readFileSync(ENTRYPOINT_SH_PATH, "utf8");
      expect(parseShellStrictness(STRICT_MODE_LINE)).toEqual(
        parseShellStrictness(STRICT_MODE_LINE),
      );
      expect(extractCommandLines(source)).toEqual(extractCommandLines(source));
      expect(entrypointEchoDiagnostics(source)).toEqual(
        entrypointEchoDiagnostics(source),
      );
      expect(extractEntrypointAnchors(source)).toEqual(
        extractEntrypointAnchors(source),
      );
    });

    it("합성 mutate(사본 replace) 후에도 원본 소스 텍스트·pure 함수 산출이 불변(원본 read-only)", () => {
      const source = readFileSync(ENTRYPOINT_SH_PATH, "utf8");
      const snapshot = source;
      // 사본 mutate(negative a/c/d/e 에서 쓰는 replace) — 원본 불변 확인.
      source.replace(/^\s*set -e\s*$/m, "");
      source.replace(/^exec node dist\/src\/main$/m, "node dist/src/main");
      source.replace("#!/bin/sh", "#!/bin/bash");
      source.replace(/^\s*echo\s+"\[entrypoint\][^\n]*$/gm, "");
      expect(source).toBe(snapshot);
      // 추출/파싱 후에도 원본 불변.
      extractEntrypointAnchors(source);
      extractCommandLines(source);
      entrypointEchoDiagnostics(source);
      expect(source).toBe(snapshot);
    });
  });

  describe("dormant / non-gated 확인 — side-effect 0", () => {
    it("부팅 해석 모델이 env / 전역 상태 없이 순수하게 동작(non-gated — describe.skip 0·gating 분기 0)", () => {
      // 본 describe 가 실행된다는 것 자체가 describe.skip 0(항상 실행)의 런타임 증거.
      const envSnapshot = { ...process.env };
      const before = parseShellStrictness(STRICT_MODE_LINE);
      // 실 process.env 를 mutate 해도 산출 불변 — 모델이 process.env 를 참조하지 않음(파라미터로만).
      Object.assign(process.env, { ENTRYPOINT_TEST: "x" });
      const after = parseShellStrictness(STRICT_MODE_LINE);
      delete process.env.ENTRYPOINT_TEST;
      expect(after).toEqual(before);
      expect(Object.keys(process.env)).toEqual(Object.keys(envSnapshot));
    });

    it("파일 read 는 deploy/docker-entrypoint.sh 읽기만 — 실 docker/prisma/node 실행 0(추출 결과가 문자열이지 실행 산출물 아님). docker-entrypoint.sh 는 조건 분기 없는 선형 스크립트 — 런타임 분기 없음(선형 시퀀스)이라 happy/negative mutant 로 대체 cover", () => {
      const source = readFileSync(ENTRYPOINT_SH_PATH, "utf8");
      expect(source.startsWith("#!")).toBe(true);
      expect(source.includes(STRICT_MODE_LINE)).toBe(true);
      expect(migrateBeforeBoot(source)).toBe(true);
      expect(bootLineUsesExec(source)).toBe(true);
    });
  });
});
