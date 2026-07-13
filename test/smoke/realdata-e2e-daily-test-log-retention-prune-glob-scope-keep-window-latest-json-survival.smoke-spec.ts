// realdata-e2e-daily-test-log-retention-prune-glob-scope-keep-window-latest-json-survival.smoke-spec.ts
// — 실 평가 e2e step④ `deploy/daily-test.sh` nightly runner 가 매 run 마다 남기는 per-run 로그
// (`deploy/logs/daily-$TS.log`) 의 **오래된 daily 로그 prune contract** 를 실 shell 파일을
// readFileSync 로 읽어(실행/source 0) 정적 검증하는 non-gated build-time smoke (T-0946,
// PLAN.md 109행 🟢 실 평가 e2e step④/⑤).
//
// gap: PLAN 109행 step④·`deploy/daily-test.sh` 헤더는 runner 가 사람용 per-run 로그
// `deploy/logs/daily-$TS.log` 를 남기고 파일 무한 누적을 막으려 마지막에 오래된 daily 로그를
// prune 함을 명시한다(384행):
//   ls -1t "$LOG_DIR"/daily-*.log 2>/dev/null | tail -n +"$((LOG_KEEP + 1))" | xargs -r rm -f
// 이 prune 라인에는 무인 nightly 운영이 조용히 의존하는 계약 다발이 있다:
//   (a) glob scope 가 `daily-*.log` 뿐 — 무인 모니터링이 읽는 `latest-result.json`(basename
//       불일치)은 절대 prune 대상이 아니다(방출 상태 파일 생존).
//   (b) keep-window — `tail -n +"$((LOG_KEEP + 1))"` 는 mtime 최신 LOG_KEEP(기본 14) 개를
//       유지하고 초과분만 삭제한다.
//   (c) mtime newest-first sort — `ls -1t` 의 `-t` 가 최신순 정렬이라 tail offset 이 오래된
//       것부터 지운다(정렬 방향 뒤집히면 최신 진단 이력 유실).
//   (d) `xargs -r`(--no-run-if-empty) 빈-입력 guard — 매칭 0 일 때 `rm` 이 인자 없이 실행되지
//       않는다.
//   (e) 실행 위치 — prune 은 머신-JSON write(375~378행 `>"$RESULT_JSON"`) 뒤 · stdout
//       `cat "$RESULT_JSON"`(387행) 앞이라 방금 쓴 result JSON 을 오염/차단 0.
// 추가로 머신-JSON `logPath` 필드가 `$LOG_FILE`(=`$LOG_DIR/daily-$TS.log`, per-run 로그 —
// `latest-result.json` 과 distinct)에 bind 됨을 앵커한다.
// 이 **로그 보관/prune 경로** 표면은 origin/main 검증 0 부재였다 — T-0791 은 printf 6-키
// 스키마/order 만, T-0944 는 result/failedStep 집계 값 semantics 만, T-0945 는 dual-sink
// single-source 방출 경로만 봉했다. 본 spec 이 그 상보적 표면을 닫는다.
//
// 전략(T-0791/T-0944/T-0945 동형): daily-test.sh 를 readFileSync 로 읽어 prune 라인·`LOG_KEEP`·
// `LOG_FILE`/`LOG_DIR`·머신-JSON logPath 필드를 정적 앵커로 추출하고, prune contract(glob==
// daily-*.log·keep offset==LOG_KEEP+1·`-t` sort·`xargs -r` guard·write<prune<cat 순서·
// logPath==LOG_FILE·latest-result.json 생존)를 assert. mutant 는 원본을 복제 후 치환해 본
// smoke 가 drift 를 실제로 잡음을 실증(원본 문자열 mutate 0).
//   🔥 실 redeploy/HTTP/jest spawn/gh/git/rm 0 — 파일 read + 정적 텍스트 추출 + 합성 mutant 만.
//   🔥 gating 분기 0 — non-gated 항상 실행(describe.skip 0). credential 0(§9/REQ-059).
//   🔥 새 외부 dependency 0(node 내장 fs/path). src 변경 0(test-only). daily-test.sh 읽기만.
import { readFileSync } from "fs";
import * as path from "path";

// repo-root 경로 — test 실행 cwd 무관하게 robust 하게 해석(`__dirname` = test/smoke,
// 두 단계 위가 repo-root). `process.cwd()` 대신 `__dirname` 기준 상대로 고정한다.
const REPO_ROOT = path.resolve(__dirname, "../..");
const DAILY_TEST_SH_PATH = path.join(REPO_ROOT, "deploy/daily-test.sh");

// 무인 모니터링이 읽는 방출 상태 파일 basename(53행 RESULT_JSON) — prune 대상이 되면 안 됨.
const RESULT_JSON_BASENAME = "latest-result.json";
// per-run 로그 파일 basename glob 정본(384행 prune glob). LOG_KEEP 기본값(46행).
const EXPECTED_PRUNE_GLOB = "daily-*.log";
const EXPECTED_LOG_KEEP_DEFAULT = "14";

// prune 라인(384행)을 소스에서 추출한다 — `ls -1t ... | tail -n +... | xargs -r rm -f`.
// 라인 식별은 mutant 가 바꾸는 glob/sort/keep 토큰이 아니라 안정적인 파이프 골격
// (`ls` … `xargs` … `rm`)으로 앵커한다 — glob/sort/keep 을 mutate 한 사본에서도 동일 라인을
// 잡아 계약 위반을 검출할 수 있게 한다. 앵커 부재 시 빈 문자열 반환(호출측 단언이 명시적
// 실패 담당 — 빈 결과 성공-위장 0).
function extractPruneLine(source: string): string {
  const line = source
    .split("\n")
    .find((l) => /\bls\b/.test(l) && /\bxargs\b/.test(l) && /\brm\b/.test(l));
  return line ?? "";
}

// prune 라인에서 glob 토큰을 추출한다 — `"$LOG_DIR"/daily-*.log` 의 basename glob 부분.
// 앵커 부재 시 null.
function extractPruneGlob(pruneLine: string): string | null {
  const m = pruneLine.match(/"\$LOG_DIR"\/(\S+\.log)/);
  return m ? m[1] : null;
}

// prune 라인의 `ls` flag 묶음을 추출한다(예: `-1t`). 앵커 부재 시 null.
function extractLsFlags(pruneLine: string): string | null {
  const m = pruneLine.match(/ls\s+(-\S+)/);
  return m ? m[1] : null;
}

// prune 라인의 `xargs` flag 묶음을 추출한다(예: `-r`). 앵커 부재 시 null.
function extractXargsFlags(pruneLine: string): string | null {
  const m = pruneLine.match(/xargs\s+(-\S+)/);
  return m ? m[1] : null;
}

// prune 라인의 keep-window offset 표현을 추출한다 — `tail -n +"$((LOG_KEEP + 1))"`.
// 앵커 부재 시 null.
function extractKeepOffsetExpr(pruneLine: string): string | null {
  const m = pruneLine.match(/tail\s+-n\s+(\+"\$\(\([^)]*\)\)")/);
  return m ? m[1] : null;
}

// `LOG_KEEP="${LOG_KEEP:-14}"`(46행) 의 기본값(14)을 추출한다. 부재 시 null.
function extractLogKeepDefault(source: string): string | null {
  const m = source.match(/^LOG_KEEP="\$\{LOG_KEEP:-(\d+)\}"/m);
  return m ? m[1] : null;
}

// `LOG_FILE="$LOG_DIR/daily-$TS.log"`(52행) 정의 우변을 추출한다. 부재 시 null.
function extractLogFileDef(source: string): string | null {
  const m = source.match(/^LOG_FILE="([^"]*)"/m);
  return m ? m[1] : null;
}

// `RESULT_JSON="$LOG_DIR/latest-result.json"`(53행) 정의 우변을 추출한다. 부재 시 null.
function extractResultJsonDef(source: string): string | null {
  const m = source.match(/^RESULT_JSON="([^"]*)"/m);
  return m ? m[1] : null;
}

// 머신-JSON printf 문(375~378행)을 line-continuation(`\`) 을 따라 재조립해 반환한다.
// logPath 인자·redirect 대상이 마지막 continuation 줄에 있으므로 문 전체를 잡아야 한다.
// 앵커 부재 시 빈 문자열 반환.
function extractMachineJsonPrintfStatement(source: string): string {
  const lines = source.split("\n");
  const startIdx = lines.findIndex((l) => /printf\s+'\{"ts":"%s"/.test(l));
  if (startIdx === -1) {
    return "";
  }
  const collected: string[] = [];
  for (let i = startIdx; i < lines.length; i++) {
    collected.push(lines[i]);
    if (!lines[i].trimEnd().endsWith("\\")) {
      break;
    }
  }
  return collected.join("\n");
}

// 단순 glob(`*` = 임의 문자열) 을 basename 에 매칭한다 — prune glob 이 실제로 어떤 파일을
// 잡는지 판정(정적 문자열 검사 — 실 파일시스템 접근/`ls` 0).
function globMatches(basename: string, glob: string): boolean {
  const escaped = glob
    .replace(/[.+^${}()|[\]\\]/g, "\\$&")
    .replace(/\*/g, ".*");
  return new RegExp(`^${escaped}$`).test(basename);
}

// 소스에서 특정 앵커의 라인 인덱스를 반환한다(실행 순서 비교용). 부재 시 -1.
function lineIndexOf(source: string, predicate: RegExp): number {
  return source.split("\n").findIndex((l) => predicate.test(l));
}

describe("realdata-e2e step④ daily-test.sh 로그 prune contract smoke — glob=daily-*.log · keep=LOG_KEEP · -t sort · xargs -r guard · write<prune<cat 순서 · latest-result.json 생존 (T-0946)", () => {
  describe("Happy-path: prune glob scope 는 daily-*.log 뿐(latest-result.json 생존)", () => {
    it("실 deploy/daily-test.sh 를 읽어 prune glob 이 `daily-*.log` — latest-result.json basename 은 이 glob 에 미매칭(방출 상태 파일 prune 대상 아님)", () => {
      const shellSource = readFileSync(DAILY_TEST_SH_PATH, "utf8");
      const pruneLine = extractPruneLine(shellSource);
      const glob = extractPruneGlob(pruneLine);
      // 앵커 실재(빈 결과 성공-위장 0).
      expect(glob).not.toBeNull();
      expect(glob).toBe(EXPECTED_PRUNE_GLOB);
      // per-run 로그는 매칭, 방출 상태 파일은 미매칭(생존).
      expect(globMatches("daily-20260713T020000Z.log", glob as string)).toBe(
        true,
      );
      expect(globMatches(RESULT_JSON_BASENAME, glob as string)).toBe(false);
    });
  });

  describe("Happy-path: keep-window 는 최근 LOG_KEEP 개 유지(기본 14)", () => {
    it('prune 라인의 keep offset 이 `tail -n +"$((LOG_KEEP + 1))"`(LOG_KEEP 초과분만 삭제)이고 LOG_KEEP 기본값이 14', () => {
      const shellSource = readFileSync(DAILY_TEST_SH_PATH, "utf8");
      const pruneLine = extractPruneLine(shellSource);
      const keepOffset = extractKeepOffsetExpr(pruneLine);
      const logKeepDefault = extractLogKeepDefault(shellSource);
      expect(keepOffset).not.toBeNull();
      expect(keepOffset).toBe('+"$((LOG_KEEP + 1))"');
      expect(logKeepDefault).toBe(EXPECTED_LOG_KEEP_DEFAULT);
    });
  });

  describe("Happy-path: mtime newest-first sort(`ls -1t`)", () => {
    it("prune 라인 sort 가 `ls -1t`(`-t` newest-first flag 존재 — 오래된 로그부터 삭제 방향 고정)", () => {
      const shellSource = readFileSync(DAILY_TEST_SH_PATH, "utf8");
      const pruneLine = extractPruneLine(shellSource);
      const lsFlags = extractLsFlags(pruneLine);
      expect(lsFlags).not.toBeNull();
      // `-t`(newest-first) 존재, reverse(`r`) 부재.
      expect((lsFlags as string).includes("t")).toBe(true);
      expect((lsFlags as string).includes("r")).toBe(false);
    });
  });

  describe("Happy-path: 빈-입력 guard(`xargs -r`)", () => {
    it("prune 라인이 `xargs -r rm -f`(`-r`/--no-run-if-empty guard 존재 — 매칭 0 시 rm 인자 없이 실행 0)", () => {
      const shellSource = readFileSync(DAILY_TEST_SH_PATH, "utf8");
      const pruneLine = extractPruneLine(shellSource);
      const xargsFlags = extractXargsFlags(pruneLine);
      expect(xargsFlags).not.toBeNull();
      expect((xargsFlags as string).includes("r")).toBe(true);
      expect(pruneLine.includes("rm -f")).toBe(true);
    });
  });

  describe("Happy-path: 실행 순서 write < prune < cat", () => {
    it('머신-JSON printf redirect(`>"$RESULT_JSON"`) 라인 < prune 라인 < stdout `cat "$RESULT_JSON"` 라인(prune 이 방금 쓴 result JSON 오염/차단 0)', () => {
      const shellSource = readFileSync(DAILY_TEST_SH_PATH, "utf8");
      const writeIdx = lineIndexOf(shellSource, /printf\s+'\{"ts":"%s"/);
      const pruneIdx = lineIndexOf(
        shellSource,
        /ls\s+-\S*t\S*\s+.*daily-\*\.log/,
      );
      const catIdx = lineIndexOf(shellSource, /^cat\s+"\$RESULT_JSON"/);
      // 세 앵커 모두 실재.
      expect(writeIdx).toBeGreaterThanOrEqual(0);
      expect(pruneIdx).toBeGreaterThanOrEqual(0);
      expect(catIdx).toBeGreaterThanOrEqual(0);
      // write < prune < cat.
      expect(writeIdx).toBeLessThan(pruneIdx);
      expect(pruneIdx).toBeLessThan(catIdx);
    });
  });

  describe("Happy-path: logPath == LOG_FILE binding", () => {
    it('머신-JSON printf 의 logPath 인자가 `$LOG_FILE`(redirect `>"$RESULT_JSON"` 직전 인자)이고 LOG_FILE=$LOG_DIR/daily-$TS.log — RESULT_JSON(latest-result.json)과 basename distinct', () => {
      const shellSource = readFileSync(DAILY_TEST_SH_PATH, "utf8");
      const stmt = extractMachineJsonPrintfStatement(shellSource);
      // printf 템플릿에 logPath 필드 존재 + 마지막 인자가 $LOG_FILE(redirect 직전).
      expect(stmt.includes('"logPath":"%s"')).toBe(true);
      expect(/"\$LOG_FILE"\s*>"\$RESULT_JSON"/.test(stmt)).toBe(true);
      // LOG_FILE / RESULT_JSON 정의 해석 — basename distinct.
      const logFileDef = extractLogFileDef(shellSource);
      const resultJsonDef = extractResultJsonDef(shellSource);
      expect(logFileDef).toBe("$LOG_DIR/daily-$TS.log");
      expect(resultJsonDef).toBe("$LOG_DIR/latest-result.json");
      expect(path.basename(logFileDef as string)).not.toBe(
        path.basename(resultJsonDef as string),
      );
      expect(path.basename(resultJsonDef as string)).toBe(RESULT_JSON_BASENAME);
    });
  });

  describe("Error path: 앵커 부재 시 조용한 성공-위장 0", () => {
    it("error path — shell 파일 부재 경로 → readFileSync throw(silent 0-byte fallback 0, T-0945 동형)", () => {
      const badPath = path.join(REPO_ROOT, "deploy/__does_not_exist__.sh");
      expect(() => readFileSync(badPath, "utf8")).toThrow();
    });

    it("error path — prune/logPath 앵커 부재 합성 소스 → 추출 빈 결과/null(빈 매칭이 pass 로 오통과 0)", () => {
      const noPrune = "#!/bin/bash\necho noop\n";
      expect(extractPruneLine(noPrune)).toBe("");
      expect(extractPruneGlob(extractPruneLine(noPrune))).toBeNull();
      expect(extractLsFlags("")).toBeNull();
      expect(extractXargsFlags("")).toBeNull();
      expect(extractKeepOffsetExpr("")).toBeNull();
      expect(extractLogKeepDefault(noPrune)).toBeNull();
      // logPath 앵커 부재.
      expect(extractMachineJsonPrintfStatement(noPrune)).toBe("");
      expect(extractLogFileDef(noPrune)).toBeNull();
    });
  });

  describe("branch: glob scope / sort 방향 분기 변별(본 smoke 가 drift 를 실제로 잡음)", () => {
    it("glob scope 분기 — `daily-*.log` 만 통과, `*.log`(또는 `*`)로 넓힌 mutant 사본은 정본 glob 등가 assert 실패(원본 mutate 0)", () => {
      const shellSource = readFileSync(DAILY_TEST_SH_PATH, "utf8");
      const canonicalGlob = extractPruneGlob(extractPruneLine(shellSource));
      expect(canonicalGlob).toBe(EXPECTED_PRUNE_GLOB);

      // mutant(사본): glob 을 `*.log` 로 넓힘.
      const wideMutant = shellSource.replace(
        '"$LOG_DIR"/daily-*.log',
        '"$LOG_DIR"/*.log',
      );
      const mutantGlob = extractPruneGlob(extractPruneLine(wideMutant));
      expect(mutantGlob).toBe("*.log");
      expect(mutantGlob).not.toBe(EXPECTED_PRUNE_GLOB);

      // 원본 mutate 0.
      expect(extractPruneGlob(extractPruneLine(shellSource))).toBe(
        EXPECTED_PRUNE_GLOB,
      );
    });

    it("sort 방향 분기 — `ls -1t` 만 통과, `-t` 제거(`ls -1`)/reverse(`ls -1tr`) mutant 사본은 newest-first assert 실패", () => {
      const shellSource = readFileSync(DAILY_TEST_SH_PATH, "utf8");
      const canonicalFlags = extractLsFlags(extractPruneLine(shellSource));
      expect((canonicalFlags as string).includes("t")).toBe(true);
      expect((canonicalFlags as string).includes("r")).toBe(false);

      // mutant(사본): `-t` 제거 → 임의 정렬(최신 로그 삭제 risk).
      const noTMutant = shellSource.replace(
        'ls -1t "$LOG_DIR"/daily-*.log',
        'ls -1 "$LOG_DIR"/daily-*.log',
      );
      expect(
        (extractLsFlags(extractPruneLine(noTMutant)) as string).includes("t"),
      ).toBe(false);

      // mutant(사본): reverse(`-1tr`) → 정렬 방향 뒤집힘(최신부터 삭제 risk).
      const reverseMutant = shellSource.replace(
        'ls -1t "$LOG_DIR"/daily-*.log',
        'ls -1tr "$LOG_DIR"/daily-*.log',
      );
      expect(
        (extractLsFlags(extractPruneLine(reverseMutant)) as string).includes(
          "r",
        ),
      ).toBe(true);

      // 원본 mutate 0.
      expect(
        (extractLsFlags(extractPruneLine(shellSource)) as string).includes("t"),
      ).toBe(true);
    });
  });

  describe("negative cases 충분 cover (각 1+, 단일 negative 금지)", () => {
    it("negative (a) — latest-result.json prune 편입 drift 변별: glob 을 `*`(전체 매칭)로 넓힌 mutant 사본은 latest-result.json 이 glob 에 매칭(생존 계약 위반)", () => {
      const shellSource = readFileSync(DAILY_TEST_SH_PATH, "utf8");
      const canonicalGlob = extractPruneGlob(extractPruneLine(shellSource));
      // 원본: latest-result.json 은 prune 대상 아님.
      expect(globMatches(RESULT_JSON_BASENAME, canonicalGlob as string)).toBe(
        false,
      );

      // mutant(사본): glob 을 `*` 로 넓힘 → 모든 파일 매칭.
      const wideMutant = shellSource.replace(
        '"$LOG_DIR"/daily-*.log',
        '"$LOG_DIR"/*',
      );
      const mutantGlob = extractPruneGlob(extractPruneLine(wideMutant));
      // NB: `*` glob 은 `\S+\.log` 매칭이 아니므로 별도 관대 매칭으로 재확인.
      const rawGlob =
        extractPruneLine(wideMutant).match(/"\$LOG_DIR"\/(\S+)/)?.[1];
      expect(rawGlob).toBe("*");
      expect(globMatches(RESULT_JSON_BASENAME, "*")).toBe(true);
      // 원본 mutate 0(정본 glob 미변).
      expect(mutantGlob).not.toBe(EXPECTED_PRUNE_GLOB);
      expect(extractPruneGlob(extractPruneLine(shellSource))).toBe(
        EXPECTED_PRUNE_GLOB,
      );
    });

    it('negative (b) — keep-window off-by-one drift 변별: `tail -n +"$((LOG_KEEP + 1))"` → `tail -n +"$LOG_KEEP"` mutant 사본은 keep offset assert 실패', () => {
      const shellSource = readFileSync(DAILY_TEST_SH_PATH, "utf8");
      const canonicalOffset = extractKeepOffsetExpr(
        extractPruneLine(shellSource),
      );
      expect(canonicalOffset).toBe('+"$((LOG_KEEP + 1))"');

      // mutant(사본): +1 제거 → 유지 개수 off-by-one(LOG_KEEP 번째 로그가 실수로 삭제).
      const offByOneMutant = shellSource.replace(
        'tail -n +"$((LOG_KEEP + 1))"',
        'tail -n +"$LOG_KEEP"',
      );
      const mutantOffset = extractKeepOffsetExpr(
        extractPruneLine(offByOneMutant),
      );
      // `+"$LOG_KEEP"` 은 `$(( ... ))` 형태가 아니므로 앵커 미매칭(null) — 정본 offset 과 불일치.
      expect(mutantOffset).toBeNull();
      expect(mutantOffset).not.toBe(canonicalOffset);

      // 원본 mutate 0.
      expect(extractKeepOffsetExpr(extractPruneLine(shellSource))).toBe(
        '+"$((LOG_KEEP + 1))"',
      );
    });

    it("negative (c) — xargs -r guard 제거 drift 변별: `xargs -r rm -f` → `xargs rm -f` mutant 사본은 empty-guard assert 실패", () => {
      const shellSource = readFileSync(DAILY_TEST_SH_PATH, "utf8");
      const canonicalXargs = extractXargsFlags(extractPruneLine(shellSource));
      expect((canonicalXargs as string).includes("r")).toBe(true);

      // mutant(사본): `-r`(--no-run-if-empty) 제거 → 빈 파이프에서 `rm` 오작동 risk.
      const noGuardMutant = shellSource.replace(
        "xargs -r rm -f",
        "xargs rm -f",
      );
      // guard 제거로 `xargs <flag>` 앵커 미매칭(null) — 정본 계약 위반 검출.
      expect(extractXargsFlags(extractPruneLine(noGuardMutant))).toBeNull();

      // 원본 mutate 0.
      expect(
        (extractXargsFlags(extractPruneLine(shellSource)) as string).includes(
          "r",
        ),
      ).toBe(true);
    });

    it("negative (d) — 실행 순서 drift 변별: prune 라인을 `cat` 뒤로 옮긴 mutant 사본은 write<prune<cat 순서 assert 실패", () => {
      const shellSource = readFileSync(DAILY_TEST_SH_PATH, "utf8");
      const pruneLine = extractPruneLine(shellSource);

      // mutant(사본): prune 라인을 제거 후 `cat "$RESULT_JSON"` 뒤에 재삽입(순서 회귀).
      const withoutPrune = shellSource.replace(`${pruneLine}\n`, "");
      const movedMutant = withoutPrune.replace(
        'cat "$RESULT_JSON"\n',
        `cat "$RESULT_JSON"\n${pruneLine}\n`,
      );
      const pruneIdx = lineIndexOf(
        movedMutant,
        /ls\s+-\S*t\S*\s+.*daily-\*\.log/,
      );
      const catIdx = lineIndexOf(movedMutant, /^cat\s+"\$RESULT_JSON"/);
      // 이제 prune 이 cat 뒤 → 순서 계약 위반.
      expect(pruneIdx).toBeGreaterThan(catIdx);

      // 원본은 여전히 prune < cat.
      const origPruneIdx = lineIndexOf(
        shellSource,
        /ls\s+-\S*t\S*\s+.*daily-\*\.log/,
      );
      const origCatIdx = lineIndexOf(shellSource, /^cat\s+"\$RESULT_JSON"/);
      expect(origPruneIdx).toBeLessThan(origCatIdx);
    });

    it("negative (e) — credential 누출 0: 추출/합성한 어떤 문자열(prune 라인·glob·경로·logPath)에도 gh 토큰 어휘 미등장", () => {
      const shellSource = readFileSync(DAILY_TEST_SH_PATH, "utf8");
      const pruneLine = extractPruneLine(shellSource);
      const glob = extractPruneGlob(pruneLine) ?? "";
      const keepOffset = extractKeepOffsetExpr(pruneLine) ?? "";
      const logFileDef = extractLogFileDef(shellSource) ?? "";
      const resultJsonDef = extractResultJsonDef(shellSource) ?? "";
      const printfStmt = extractMachineJsonPrintfStatement(shellSource);

      const credentialPattern =
        /(ghp_|--token|GITHUB_TOKEN|GH_TOKEN|\bBearer\b|Authorization|\bsk-)/i;

      const haystacks = [
        pruneLine,
        glob,
        keepOffset,
        logFileDef,
        resultJsonDef,
        printfStmt,
      ];
      haystacks.forEach((s) => {
        expect(credentialPattern.test(s)).toBe(false);
      });
    });
  });

  describe("flow: 결정론 · no-mutation", () => {
    it("동일 shell 소스로 앵커 추출·검사를 두 번 호출하면 byte-identical deep-equal(결정론)", () => {
      const shellSource = readFileSync(DAILY_TEST_SH_PATH, "utf8");
      expect(extractPruneLine(shellSource)).toBe(extractPruneLine(shellSource));
      const p1 = extractPruneLine(shellSource);
      const p2 = extractPruneLine(shellSource);
      expect(extractPruneGlob(p1)).toBe(extractPruneGlob(p2));
      expect(extractLsFlags(p1)).toBe(extractLsFlags(p2));
      expect(extractXargsFlags(p1)).toBe(extractXargsFlags(p2));
      expect(extractKeepOffsetExpr(p1)).toBe(extractKeepOffsetExpr(p2));
      expect(extractLogKeepDefault(shellSource)).toBe(
        extractLogKeepDefault(shellSource),
      );
      expect(extractMachineJsonPrintfStatement(shellSource)).toBe(
        extractMachineJsonPrintfStatement(shellSource),
      );
    });

    it("추출 보조 함수가 입력(shell 문자열)을 mutate 0 · mutant 사본 생성이 원본 불변", () => {
      const shellSource = readFileSync(DAILY_TEST_SH_PATH, "utf8");
      const sourceSnapshot = shellSource;
      const pruneLine = extractPruneLine(shellSource);
      extractPruneGlob(pruneLine);
      extractLsFlags(pruneLine);
      extractXargsFlags(pruneLine);
      extractKeepOffsetExpr(pruneLine);
      extractLogKeepDefault(shellSource);
      extractLogFileDef(shellSource);
      extractResultJsonDef(shellSource);
      extractMachineJsonPrintfStatement(shellSource);
      expect(shellSource).toBe(sourceSnapshot);

      // mutant 사본(replace) 생성 후에도 원본 문자열 불변.
      const _mutant = shellSource.replace(
        '"$LOG_DIR"/daily-*.log',
        '"$LOG_DIR"/*.log',
      );
      expect(shellSource).toBe(sourceSnapshot);
      expect(_mutant).not.toBe(shellSource);
    });
  });

  describe("dormant / non-gated 확인 — side-effect 0", () => {
    it("추출·검사 보조 함수가 env / 전역 상태 없이 순수하게 동작(non-gated — gating 분기 0)", () => {
      // 본 describe 가 실행된다는 것 자체가 describe.skip 0(항상 실행)의 런타임 증거.
      const shellSource = readFileSync(DAILY_TEST_SH_PATH, "utf8");
      const envSnapshot = { ...process.env };
      const before = extractPruneGlob(extractPruneLine(shellSource));
      // env 를 임의로 주입해도 추출 결과 불변 — 모델이 gating env 를 참조하지 않음을 입증.
      Object.assign(process.env, { INJECTED_GATING_ENV: "1" });
      const after = extractPruneGlob(extractPruneLine(shellSource));
      delete process.env.INJECTED_GATING_ENV;
      expect(after).toBe(before);
      // env 원복(테스트 side-effect 0).
      expect(Object.keys(process.env)).toEqual(Object.keys(envSnapshot));
    });

    it("파일 read 는 deploy/daily-test.sh 읽기만 — 실 shell 실행/source/rm 0(추출 결과가 텍스트지 실행 산출물 아님)", () => {
      const shellSource = readFileSync(DAILY_TEST_SH_PATH, "utf8");
      // 읽은 값은 shell 스크립트 텍스트(첫 줄 shebang)일 뿐 실행 결과가 아님.
      expect(shellSource.startsWith("#!")).toBe(true);
      // 앵커 추출은 순수 문자열 검사(실행 0).
      expect(extractPruneGlob(extractPruneLine(shellSource))).toBe(
        EXPECTED_PRUNE_GLOB,
      );
    });
  });
});
