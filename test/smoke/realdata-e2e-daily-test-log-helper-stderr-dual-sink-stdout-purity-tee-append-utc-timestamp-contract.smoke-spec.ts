// realdata-e2e-daily-test-log-helper-stderr-dual-sink-stdout-purity-tee-append-utc-timestamp-contract.smoke-spec.ts
// — 실 평가 e2e nightly runner `deploy/daily-test.sh` 의 **log() 헬퍼 stderr 라우팅 · stdout 순수성 계약**을
// 실 shell 파일을 readFileSync 로 읽어(실행/source 0) 정적 검증하는 non-gated build-time smoke
// (T-0953, PLAN.md §109 step④ 실 평가 e2e — 무인 routine 이 stdout 을 순수 JSON 으로 파싱).
//
// 봉함 불변식: **모든 진행 로그는 `printf '[%s] %s\n' "$(date -u +%H:%M:%S)" "$*" | tee -a "$LOG_FILE" >&2`
// 로 로그 파일 append + stderr 이중 방출되며 stdout 에는 0 byte 를 쓰고(UTC `[HH:MM:SS]` 접두 + `"$*"`
// whole-message), 스크립트 전체에서 stdout 에 방출하는 라인은 오직 387행 최종 `cat "$RESULT_JSON"` 하나뿐.**
// 이 불변식이 "무인 nightly routine 이 stdout 을 순수 JSON 으로 파싱" 하는 신뢰의 근원. 계약 6종(실 소스 유도 앵커):
//   (a) stderr + 파일 이중 sink(59행 `... | tee -a "$LOG_FILE" >&2` — tee 가 로그 파일 append + tee stdout 을
//       `>&2` 로 stderr 방출 = 한 로그 라인이 파일 + stderr 두 곳으로) ·
//   (b) stdout 순수성(`>&2` 가 tee 의 stdout 을 stderr 로 돌려 log() 는 stdout 에 0 byte — 유일 bare-stdout
//       emitter 는 387행 `cat "$RESULT_JSON"`) ·
//   (c) `tee -a` append 누적(overwrite `>` 아님 — 한 run 의 모든 로그 라인이 로그 파일에 누적) ·
//   (d) UTC timestamp 접두(`date -u +%H:%M:%S` → `[HH:MM:SS]`, 로컬 TZ 아님) ·
//   (e) whole-message pass(`"$*"` — 모든 인자를 join 해 한 줄로) ·
//   (f) stdout 은 JSON 전용 주석 계약(57행 "stdout 은 JSON 전용이라 건드리지 않음").
//
// 전략(T-0945/T-0952 동형): log 라우팅 유도 표현을 정적 앵커로 추출 + bash 라우팅 semantics 를 TS 순수 함수
// (`formatLogLine`·`logRouteTargets`·`stdoutEmitterLines`)로 동형 모델링해 stderr-이중-sink·stdout-순수성·
// append·UTC-timestamp·whole-message·유일-emitter 불변식 assert.
// T-0945(머신 JSON *방출* 측 dual-sink file+stdout cat single-source — 진행 로그 stderr 라우팅 *명시 제외*)
// 상보 distinct surface(진행 로그의 stderr 라우팅 + stdout emitter count). T-0944/T-0946/T-0947/T-0948/
// T-0949~T-0952 와도 distinct(log() 헬퍼 *내부* 라우팅 mechanics).
//   🔥 실 log/tee/stderr/stdout/date/gh/git 0 · process.env 읽기 0(입력은 pure 함수 파라미터) ·
//      credential 0(§9/REQ-059) · 새 dep 0(node fs/path) · src 변경 0(test-only) ·
//      deploy/daily-test.sh 읽기만(실행/source 0).
import { readFileSync } from "fs";
import * as path from "path";

// repo-root 경로 — test 실행 cwd 무관하게 robust 하게 해석(`__dirname` = test/smoke,
// 두 단계 위가 repo-root). `process.cwd()` 대신 `__dirname` 기준 상대로 고정한다.
const REPO_ROOT = path.resolve(__dirname, "../..");
const DAILY_TEST_SH_PATH = path.join(REPO_ROOT, "deploy/daily-test.sh");

// log() 라우팅 정본 라인(59행) — 실 bash 표현의 TS mirror(실 printf/tee/date 실행 0).
const LOG_ROUTING_LINE = `printf '[%s] %s\\n' "$(date -u +%H:%M:%S)" "$*" | tee -a "$LOG_FILE" >&2`;
// 유일 bare-stdout emitter 정본 라인(387행).
const CAT_EMITTER_LINE = `cat "$RESULT_JSON"`;

// ── TS 동형 pure 함수(정본) — daily-test.sh log()(57~60행) + 유일 stdout emitter(387행) 라우팅을 모델링.
//    입력(문자열)은 mutate 하지 않는다(읽기만). 실 bash/tee/date/stream redirect/env 읽기 0 — 입력은 파라미터.

// (d)(e) formatLogLine(ts, msg): 59행 `printf '[%s] %s\n' "$(date -u +%H:%M:%S)" "$*"` 동형 —
//     UTC timestamp 접두(`[ts]`) + whole-message(`msg`) join + 개행. 실 date/printf 실행 0(입력은 파라미터).
function formatLogLine(ts: string, msg: string): string {
  return `[${ts}] ${msg}\n`;
}

// log() 라우팅 목적지 — stderr/파일/stdout 세 sink 의 분리 표현.
interface RouteTargets {
  file: boolean; // 로그 파일 sink(tee 로 파일에 씀).
  append: boolean; // append(`-a`) 인가 overwrite(`>`) 인가.
  stderr: boolean; // `>&2` 로 stderr 방출하는가.
  stdout: boolean; // stdout 을 오염시키는가(진행 로그가 stdout 으로 새는가).
}

// (a)(b)(c) logRouteTargets(logLine): 59행 라우팅 라인을 파싱해 sink 분리 판정 —
//     tee 존재 → 파일 sink, `tee -a` → append(없으면 overwrite), `>&2` 존재 → stderr 방출 +
//     tee 의 stdout 을 stderr 로 돌려 stdout 0 byte(없으면 tee stdout 이 스크립트 stdout 오염).
function logRouteTargets(logLine: string): RouteTargets {
  const hasTee = /\btee\b/.test(logLine); // tee 로 파일 sink.
  const hasAppend = /\btee\s+-a\b/.test(logLine); // `-a` append(없으면 overwrite).
  const hasStderrRedirect = logLine.includes(">&2"); // tee stdout → stderr.
  return {
    file: hasTee,
    append: hasAppend,
    stderr: hasStderrRedirect,
    // `>&2` 가 tee 의 stdout 을 stderr 로 돌리면 log() 는 stdout 에 0 byte;
    // `>&2` 부재 시 tee 의 stdout 이 스크립트 stdout 으로 새어 오염된다.
    stdout: !hasStderrRedirect,
  };
}

// (b) stdoutEmitterLines(shellSource): 스크립트에서 bare-stdout 으로 방출하는 라인만 열거 —
//     문장-선두 emitter(cat/echo/printf) 이면서 (1) 주석 아님 (2) stdout 밖으로 돌리는 redirect
//     (`>&2`/`>file`/`>>`) 없음 (3) 다른 명령으로 pipe(`|`) 안 함 인 라인. line-continuation(`\`)
//     은 논리 라인으로 병합해 다중-라인 printf(375~378행, `>"$RESULT_JSON"` 로 파일 redirect)를
//     bare-stdout 으로 오분류하지 않는다. command-substitution `$(...)` 안의 curl/echo 는 문장-선두가
//     `$(` 나 `var=` 라 자연히 제외된다. 정본 소스에서 정확히 1개(387행 `cat "$RESULT_JSON"`) 반환.
function stdoutEmitterLines(shellSource: string): string[] {
  const EMITTERS = ["cat", "echo", "printf"];
  // CRLF 정규화 후 line-continuation(`\`) 논리 라인 병합.
  const rawLines = shellSource.replace(/\r\n/g, "\n").split("\n");
  const logical: string[] = [];
  let buf = "";
  for (const line of rawLines) {
    if (line.endsWith("\\")) {
      buf += line.slice(0, -1) + " "; // 다음 물리 라인과 이어 붙임.
    } else {
      logical.push(buf + line);
      buf = "";
    }
  }
  if (buf !== "") logical.push(buf);

  return logical.filter((line) => {
    const trimmed = line.trim();
    if (trimmed.startsWith("#")) return false; // 주석 제외.
    const firstToken = trimmed.split(/\s+/)[0]; // 문장-선두 토큰.
    if (!EMITTERS.includes(firstToken)) return false; // emitter 로 시작 안 하면 제외.
    if (trimmed.includes(">&2")) return false; // stderr 로 redirect(59행 log) → stdout 아님.
    // 파일/기타로 redirect(`>"$RESULT_JSON"`·`> file`·`>>`) → stdout 아님(375~378행 printf).
    if (/>\s*"?\$?[\w/.]/.test(trimmed) || trimmed.includes(">>")) return false;
    if (trimmed.includes("|")) return false; // 다른 명령으로 pipe → stdout 아님.
    return true;
  });
}

// ── 정적 앵커 추출 보조 함수 (실 bash log 라우팅 표현이 소스에 실재하는지) ──────────────

// log() 함수 정의 앵커(58행) — `log() {`.
function hasLogFnAnchor(shellSource: string): boolean {
  return shellSource.includes("log() {");
}

// log() 라우팅 라인 앵커(59행) — printf + UTC ts + whole-message + tee -a + LOG_FILE + `>&2`.
function hasLogRoutingAnchor(shellSource: string): boolean {
  return shellSource.includes(LOG_ROUTING_LINE);
}

// 유일 stdout emitter 앵커(387행) — `cat "$RESULT_JSON"`.
function hasCatEmitterAnchor(shellSource: string): boolean {
  return shellSource.includes(CAT_EMITTER_LINE);
}

// stdout=JSON 전용 계약 주석 앵커(57행) — "stdout 은 JSON 전용이라 건드리지 않음".
function hasStdoutJsonCommentAnchor(shellSource: string): boolean {
  return shellSource.includes("stdout 은 JSON 전용이라 건드리지 않음");
}

// log() 라우팅 라인을 소스에서 추출 — `| tee -a "$LOG_FILE" >&2` 를 포함하는 라인.
function extractLogRoutingLine(shellSource: string): string {
  return (
    shellSource
      .replace(/\r\n/g, "\n")
      .split("\n")
      .find((l) => l.includes('| tee -a "$LOG_FILE" >&2')) ?? ""
  );
}

// UTC timestamp(`date -u +%H:%M:%S`) 존재 판정 — 로컬 `date` 아닌 `-u`(UTC) 인지.
//   (51행 `date -u +%Y%m%dT%H%M%SZ` 와 혼동 안 하도록 log() 의 `%H:%M:%S` 포맷만 대상.)
function hasUtcTimestamp(logLine: string): boolean {
  return /date\s+-u\s+\+%H:%M:%S/.test(logLine);
}

// whole-message(`"$*"`) 존재 판정 — 첫 인자만(`"$1"`) 이 아닌 전 인자 join 인지.
function hasWholeMessage(logLine: string): boolean {
  return logLine.includes('"$*"');
}

// 4종 log 라우팅 유도 앵커가 모두 실재하는지 — 하나라도 부재면 명시적 실패(빈 결과 성공-위장 0).
function extractLogRoutingAnchors(shellSource: string): {
  logFn: boolean;
  routing: boolean;
  catEmitter: boolean;
  stdoutComment: boolean;
} {
  return {
    logFn: hasLogFnAnchor(shellSource),
    routing: hasLogRoutingAnchor(shellSource),
    catEmitter: hasCatEmitterAnchor(shellSource),
    stdoutComment: hasStdoutJsonCommentAnchor(shellSource),
  };
}

describe('realdata-e2e step④ daily-test.sh log() 헬퍼 stderr 라우팅 · stdout 순수성 contract smoke — stderr+파일 이중 sink + `tee -a` append + UTC `[HH:MM:SS]` timestamp + whole-message `"$*"` + 유일 stdout emitter=387행 `cat` (T-0953)', () => {
  describe("Happy-path: log 라우팅 앵커 정적 추출(pure 함수가 실 bash 라우팅을 mirror)", () => {
    it("log() 정의(58)·라우팅 라인(59)·유일 cat emitter(387)·stdout=JSON 계약 주석(57)이 실 소스에 존재(4 앵커 전부 true)", () => {
      const shellSource = readFileSync(DAILY_TEST_SH_PATH, "utf8");
      const anchors = extractLogRoutingAnchors(shellSource);
      expect(anchors.logFn).toBe(true);
      expect(anchors.routing).toBe(true);
      expect(anchors.catEmitter).toBe(true);
      expect(anchors.stdoutComment).toBe(true);
    });
  });

  describe("Happy-path: formatLogLine(ts, msg) — UTC 접두 + whole-message join", () => {
    it("formatLogLine 은 `[${ts}] ${msg}\\n`(59행 `printf '[%s] %s\\n'` 동형) 반환 — 여러 (ts, msg) 조합 실증", () => {
      expect(formatLogLine("12:00:00", "step health: OK")).toBe(
        "[12:00:00] step health: OK\n",
      );
      expect(formatLogLine("00:00:01", "step redeploy: 실행")).toBe(
        "[00:00:01] step redeploy: 실행\n",
      );
      // whole-message: 공백 포함 다중 단어가 한 줄로 join(`"$*"` 동형).
      expect(formatLogLine("23:59:59", "a b c")).toBe("[23:59:59] a b c\n");
      // 각 라인은 항상 개행으로 끝남(로그 파일 라인 단위 누적 전제).
      expect(formatLogLine("01:02:03", "x").endsWith("\n")).toBe(true);
    });
  });

  describe("Happy-path: logRouteTargets — stderr+파일 이중 sink, stdout 제외", () => {
    it("정본 라우팅 라인 → {file:true, append:true, stderr:true, stdout:false}(tee -a 파일 sink + `>&2` stderr + stdout 0 byte)", () => {
      const targets = logRouteTargets(LOG_ROUTING_LINE);
      expect(targets.file).toBe(true); // tee 로 로그 파일 sink.
      expect(targets.append).toBe(true); // `-a` append.
      expect(targets.stderr).toBe(true); // `>&2` stderr 방출.
      expect(targets.stdout).toBe(false); // 진행 로그가 stdout 으로 새지 않음.
    });

    it("실 소스에서 추출한 라우팅 라인도 동일 판정 — 세 sink 분리(file+stderr true, stdout false)", () => {
      const shellSource = readFileSync(DAILY_TEST_SH_PATH, "utf8");
      const line = extractLogRoutingLine(shellSource);
      expect(line).not.toBe("");
      const targets = logRouteTargets(line);
      expect(targets).toEqual({
        file: true,
        append: true,
        stderr: true,
        stdout: false,
      });
    });
  });

  describe("Happy-path: stdoutEmitterLines — 유일 stdout emitter == 387행 cat", () => {
    it('실 소스의 bare-stdout emitter 정확히 1개(`cat "$RESULT_JSON"`) — log()(>&2)·printf(>file)·`$(...)` 캡처는 미포함', () => {
      const shellSource = readFileSync(DAILY_TEST_SH_PATH, "utf8");
      const emitters = stdoutEmitterLines(shellSource);
      expect(emitters).toHaveLength(1);
      expect(emitters[0].trim()).toBe(CAT_EMITTER_LINE);
    });
  });

  describe("branch: `tee -a` append vs `tee` overwrite 정적 대조", () => {
    it("정본은 `tee -a`(append=true), `-a` 제거 mutant 은 append=false — 두 입력으로 분리 실증", () => {
      // 정본: append true.
      expect(logRouteTargets(LOG_ROUTING_LINE).append).toBe(true);
      // mutant(모델 사본): `tee -a` → `tee`(overwrite — 로그 이력 소실 회귀).
      const overwriteMutant = LOG_ROUTING_LINE.replace("tee -a", "tee");
      expect(logRouteTargets(overwriteMutant).append).toBe(false);
      // 파일 sink 자체는 양쪽 다 존재(tee 는 남음) — 다른 것은 append 여부.
      expect(logRouteTargets(overwriteMutant).file).toBe(true);
      // 실 소스 라인이 `tee -a "$LOG_FILE"`(append) 이고 overwrite `> "$LOG_FILE"` 가 아님.
      const line = extractLogRoutingLine(
        readFileSync(DAILY_TEST_SH_PATH, "utf8"),
      );
      expect(line).toContain('tee -a "$LOG_FILE"');
      expect(line).not.toContain('> "$LOG_FILE"');
    });
  });

  describe("branch: UTC(`date -u`) vs 로컬(`date`) 정적 대조", () => {
    it("정본은 `date -u +%H:%M:%S`(UTC), `-u` 제거 mutant 은 로컬 — hasUtcTimestamp 로 분리 판정", () => {
      // 정본: UTC true.
      expect(hasUtcTimestamp(LOG_ROUTING_LINE)).toBe(true);
      // mutant(모델 사본): `date -u` → `date`(로컬 TZ — 시각 흔들림 회귀).
      const localMutant = LOG_ROUTING_LINE.replace(
        "date -u +%H:%M:%S",
        "date +%H:%M:%S",
      );
      expect(hasUtcTimestamp(localMutant)).toBe(false);
      // 실 소스 라우팅 라인이 UTC(`date -u`) 임을 정적 확인.
      const line = extractLogRoutingLine(
        readFileSync(DAILY_TEST_SH_PATH, "utf8"),
      );
      expect(hasUtcTimestamp(line)).toBe(true);
    });
  });

  describe("branch: stderr redirect(`>&2`) 존재 → stdout 미방출", () => {
    it("정본은 `>&2`(stderr:true, stdout:false), `>&2` 제거 mutant 은 stdout 오염(stderr:false, stdout:true)", () => {
      // 정본: >&2 존재 → stdout false.
      const real = logRouteTargets(LOG_ROUTING_LINE);
      expect(real.stderr).toBe(true);
      expect(real.stdout).toBe(false);
      // mutant(모델 사본): ` >&2` 제거 → tee stdout 이 스크립트 stdout 오염.
      const noRedirect = LOG_ROUTING_LINE.replace(" >&2", "");
      const mutant = logRouteTargets(noRedirect);
      expect(mutant.stderr).toBe(false);
      expect(mutant.stdout).toBe(true);
      // 실 소스 라우팅 라인이 `>&2` 를 포함.
      const line = extractLogRoutingLine(
        readFileSync(DAILY_TEST_SH_PATH, "utf8"),
      );
      expect(line).toContain(">&2");
    });
  });

  describe("Error path / negative cases 충분 cover", () => {
    it("error path — shell 파일 부재 경로 → readFileSync throw(silent 0-byte fallback 0)", () => {
      const badPath = path.join(REPO_ROOT, "deploy/__does_not_exist__.sh");
      expect(() => readFileSync(badPath, "utf8")).toThrow();
    });

    it("error path — log 라우팅 앵커 부재 시 명시적 실패(빈 매칭을 pass 로 오통과 0)", () => {
      // 앵커를 제거한 합성 소스(log 라우팅 유도 표현 부재).
      const emptySource = "#!/usr/bin/env bash\necho hello\n";
      const anchors = extractLogRoutingAnchors(emptySource);
      expect(anchors.logFn).toBe(false);
      expect(anchors.routing).toBe(false);
      expect(anchors.catEmitter).toBe(false);
      expect(anchors.stdoutComment).toBe(false);
      // 라우팅 라인 추출도 빈 결과(성공-위장 0).
      expect(extractLogRoutingLine(emptySource)).toBe("");
      // 실 소스는 반대로 전부 존재 — 부재/실재를 변별함을 대비로 실증.
      const realAnchors = extractLogRoutingAnchors(
        readFileSync(DAILY_TEST_SH_PATH, "utf8"),
      );
      expect(realAnchors.logFn).toBe(true);
      expect(realAnchors.routing).toBe(true);
      expect(realAnchors.catEmitter).toBe(true);
      expect(realAnchors.stdoutComment).toBe(true);
    });

    it("negative (a) — stdout 순수성 파괴 drift 변별: `>&2` 제거 사본에서 'log 는 stdout 미방출(stdout:false)' assert 실패", () => {
      // 정본: stdout false(진행 로그가 stdout 으로 안 샘).
      expect(logRouteTargets(LOG_ROUTING_LINE).stdout).toBe(false);
      // mutant(모델 사본): `>&2` 제거 → tee stdout 이 스크립트 stdout 오염(JSON 파싱 붕괴 회귀).
      const mutant = LOG_ROUTING_LINE.replace(" >&2", "");
      expect(logRouteTargets(mutant).stdout).toBe(true);
      expect(logRouteTargets(mutant).stdout).not.toBe(
        logRouteTargets(LOG_ROUTING_LINE).stdout,
      );
      // 원본 문자열/함수 불변(replace 는 사본 반환).
      expect(logRouteTargets(LOG_ROUTING_LINE).stdout).toBe(false);
    });

    it("negative (b) — append → overwrite drift 변별: `tee -a` → `tee` 사본에서 '로그 파일 append(`-a`)' assert 실패", () => {
      // 정본: append true.
      expect(logRouteTargets(LOG_ROUTING_LINE).append).toBe(true);
      // mutant(모델 사본): `tee -a` → `tee`(overwrite — 로그 이력 소실 회귀).
      const mutant = LOG_ROUTING_LINE.replace("tee -a", "tee");
      expect(logRouteTargets(mutant).append).toBe(false);
      expect(logRouteTargets(mutant).append).not.toBe(
        logRouteTargets(LOG_ROUTING_LINE).append,
      );
      // 원본 불변.
      expect(logRouteTargets(LOG_ROUTING_LINE).append).toBe(true);
    });

    it("negative (c) — UTC → 로컬 date drift 변별: `date -u` → `date` 사본에서 'UTC timestamp(`-u`)' assert 실패", () => {
      // 정본: UTC true.
      expect(hasUtcTimestamp(LOG_ROUTING_LINE)).toBe(true);
      // mutant(모델 사본): `date -u +%H:%M:%S` → `date +%H:%M:%S`(로컬 TZ — 시각 흔들림 회귀).
      const mutant = LOG_ROUTING_LINE.replace(
        "date -u +%H:%M:%S",
        "date +%H:%M:%S",
      );
      expect(hasUtcTimestamp(mutant)).toBe(false);
      expect(hasUtcTimestamp(mutant)).not.toBe(
        hasUtcTimestamp(LOG_ROUTING_LINE),
      );
      // 원본 불변.
      expect(hasUtcTimestamp(LOG_ROUTING_LINE)).toBe(true);
    });

    it("negative (d) — 유일-stdout-emitter 위반 drift 변별: 중간 step 에 bare-stdout `echo` 추가 사본에서 emitter 2개 → '정확히 1개' assert 실패", () => {
      const shellSource = readFileSync(DAILY_TEST_SH_PATH, "utf8");
      // 정본: emitter 정확히 1개(387행 cat).
      expect(stdoutEmitterLines(shellSource)).toHaveLength(1);
      // mutant(모델 사본): 중간 step 에 bare-stdout echo 추가(stdout 순수성 정량 위반 회귀).
      const mutant = shellSource.replace(
        'cat "$RESULT_JSON"',
        'echo "$RESULT"\ncat "$RESULT_JSON"',
      );
      const mutantEmitters = stdoutEmitterLines(mutant);
      expect(mutantEmitters).toHaveLength(2);
      expect(mutantEmitters.length).not.toBe(
        stdoutEmitterLines(shellSource).length,
      );
      // 원본 소스 불변(replace 는 사본 반환).
      expect(stdoutEmitterLines(shellSource)).toHaveLength(1);
    });

    it('negative (e) — whole-message 소실 drift 변별: `"$*"` → `"$1"` 사본에서 \'whole-message pass(`"$*"`)\' assert 실패', () => {
      // 정본: whole-message true.
      expect(hasWholeMessage(LOG_ROUTING_LINE)).toBe(true);
      // mutant(모델 사본): `"$*"` → `"$1"`(첫 인자만 — 다중-인자 로그 절단 회귀).
      const mutant = LOG_ROUTING_LINE.replace('"$*"', '"$1"');
      expect(hasWholeMessage(mutant)).toBe(false);
      expect(hasWholeMessage(mutant)).not.toBe(
        hasWholeMessage(LOG_ROUTING_LINE),
      );
      // 실 소스 라우팅 라인이 `"$*"`(whole-message) 임을 정적 확인.
      const line = extractLogRoutingLine(
        readFileSync(DAILY_TEST_SH_PATH, "utf8"),
      );
      expect(hasWholeMessage(line)).toBe(true);
      // 원본 불변.
      expect(hasWholeMessage(LOG_ROUTING_LINE)).toBe(true);
    });

    it("negative (f) — credential/secret 누출 0: 추출/합성 문자열(앵커·formatLogLine·라우팅 파싱·emitter)에 gh 토큰 어휘·credential 실값 미등장(§9/REQ-059)", () => {
      const shellSource = readFileSync(DAILY_TEST_SH_PATH, "utf8");
      const synthesized = [
        formatLogLine("12:00:00", "step health: OK"),
        JSON.stringify(logRouteTargets(LOG_ROUTING_LINE)),
        JSON.stringify(extractLogRoutingAnchors(shellSource)),
        extractLogRoutingLine(shellSource),
        stdoutEmitterLines(shellSource).join("\n"),
        String(hasUtcTimestamp(LOG_ROUTING_LINE)),
        String(hasWholeMessage(LOG_ROUTING_LINE)),
      ];
      const credentialPattern =
        /(ghp_|--token|GITHUB_TOKEN|GH_TOKEN|\bBearer\b|Authorization|\bsk-)/i;
      synthesized.forEach((s) => {
        expect(credentialPattern.test(s)).toBe(false);
      });
      // 라우팅 검증은 stream 목적지(file/stderr/stdout)만 다루고 실 로그 payload/credential 미포함.
      expect(formatLogLine("00:00:00", "step auth: OK")).not.toMatch(
        credentialPattern,
      );
    });
  });

  describe("flow: 결정론 · no-mutation", () => {
    it("동일 입력(ts·msg·라우팅 라인·shell 소스)으로 pure 함수를 두 번 호출하면 deep-equal(결정론)", () => {
      const shellSource = readFileSync(DAILY_TEST_SH_PATH, "utf8");
      expect(formatLogLine("12:00:00", "x")).toBe(
        formatLogLine("12:00:00", "x"),
      );
      expect(logRouteTargets(LOG_ROUTING_LINE)).toEqual(
        logRouteTargets(LOG_ROUTING_LINE),
      );
      expect(stdoutEmitterLines(shellSource)).toEqual(
        stdoutEmitterLines(shellSource),
      );
      expect(extractLogRoutingAnchors(shellSource)).toEqual(
        extractLogRoutingAnchors(shellSource),
      );
    });

    it("pure 함수·추출 보조 함수가 입력(shell 소스·라우팅 라인)을 mutate 0(원본 불변)", () => {
      const shellSource = readFileSync(DAILY_TEST_SH_PATH, "utf8");
      const sourceSnapshot = shellSource;
      extractLogRoutingAnchors(shellSource);
      extractLogRoutingLine(shellSource);
      stdoutEmitterLines(shellSource);
      expect(shellSource).toBe(sourceSnapshot);

      const lineSnapshot = LOG_ROUTING_LINE;
      logRouteTargets(LOG_ROUTING_LINE);
      hasUtcTimestamp(LOG_ROUTING_LINE);
      hasWholeMessage(LOG_ROUTING_LINE);
      expect(LOG_ROUTING_LINE).toBe(lineSnapshot);
    });
  });

  describe("dormant / non-gated 확인 — side-effect 0", () => {
    it("log 라우팅 모델이 env / 전역 상태 없이 순수하게 동작(non-gated — 입력은 파라미터로만)", () => {
      // 본 describe 가 실행된다는 것 자체가 describe.skip 0(항상 실행)의 런타임 증거.
      const envSnapshot = { ...process.env };
      const before = logRouteTargets(LOG_ROUTING_LINE);
      // 실 process.env 를 mutate 해도 산출 불변 — 모델이 process.env 를 참조하지 않음(파라미터로만).
      Object.assign(process.env, { LOG_FILE: "/tmp/x.log" });
      const after = logRouteTargets(LOG_ROUTING_LINE);
      delete process.env.LOG_FILE;
      expect(after).toEqual(before);
      expect(Object.keys(process.env)).toEqual(Object.keys(envSnapshot));
    });

    it("파일 read 는 deploy/daily-test.sh 읽기만 — 실 log/tee/stderr/date/git 실행 0(추출 결과가 문자열이지 실행 산출물 아님)", () => {
      const shellSource = readFileSync(DAILY_TEST_SH_PATH, "utf8");
      expect(shellSource.startsWith("#!")).toBe(true);
      expect(hasLogFnAnchor(shellSource)).toBe(true);
      expect(hasCatEmitterAnchor(shellSource)).toBe(true);
    });
  });
});
