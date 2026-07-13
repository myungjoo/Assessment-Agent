// realdata-e2e-daily-test-curl-code-helper-status-code-only-body-discard-maxtime-hang-guard-argv-passthrough-captured-substitution-contract.smoke-spec.ts
// — 실 평가 e2e nightly runner `deploy/daily-test.sh` 의 **curl_code() 헬퍼 status-code-only 방출 ·
// body 폐기 · max-time hang-guard · argv passthrough · caller command-substitution 캡처 계약**을
// 실 shell 파일을 readFileSync 로 읽어(실행/source 0) 정적 검증하는 non-gated build-time smoke
// (T-0954, PLAN.md §109 step④ 실 평가 e2e — 무인 routine 이 배포 기기에서 HTTP 스모크로 liveness/auth 검증).
//
// 봉함 불변식: **모든 curl_code 호출은 `curl -s -o /dev/null -w '%{http_code}' --max-time "${1}" "${@:2}"`
// 로 body 를 버리고(`-o /dev/null`) status code 만(`-w '%{http_code}'`) stdout 방출하며 첫 인자를 timeout 으로
// 배선(hang-guard `--max-time "${1}"`)하고 나머지를 curl 로 passthrough(`"${@:2}"`)하되, 그 stdout 은 caller 의
// `$(...)` 에 캡처돼 스크립트 stdout 순수성(387행 cat 유일 bare-emitter)을 깨지 않는다.** 계약 6종(실 소스 유도 앵커):
//   (a) silent(64행 `-s` — progress meter 억제) ·
//   (b) body 폐기(`-o /dev/null` — 응답 body 를 stdout 아닌 null 로) ·
//   (c) status-code-only 방출(`-w '%{http_code}'` — HTTP status code 만 stdout, caller 가 `$(...)` 캡처) ·
//   (d) max-time hang-guard positional(`--max-time "${1}"` — 첫 위치 인자가 timeout, hang 방지) ·
//   (e) argv passthrough from arg2(`"${@:2}"` — 두 번째 인자부터 URL/method/header/data 를 curl 로 전달) ·
//   (f) caller 캡처로 stdout 비오염(liveness 102·auth 122·130·137행 `code="$(curl_code ...)"` — curl_code
//       stdout 이 command-substitution 에 캡처돼 스크립트 bare-stdout 방출 아님, 유일 bare-emitter 는 387행 cat).
//
// 전략(T-0953/T-0952 동형): curl_code 유도 표현을 정적 앵커로 추출 + bash 배선 semantics 를 TS 순수 함수
// (`buildCurlCodeArgv`·`curlCodeContract`·`curlCodeCallerCaptures`)로 동형 모델링해 silent·body-폐기·
// status-only·max-time·passthrough·caller-캡처 불변식 assert.
// T-0953(log() 진행 로그 stderr 라우팅 — HTTP status 헬퍼 *명시 제외*) helper-쌍 상보 distinct surface.
// T-0950/T-0951(반환 code 의 분기 — code 를 *산출하는* curl 배선 제외)·T-0952(직접 curl, curl_code 미사용)·
// T-0944~T-0949(집계/JSON/prune/cascade/provenance/gating)와도 distinct.
//   🔥 실 curl/HTTP/network/소켓/gh/git 0 · process.env 읽기 0(입력은 pure 함수 파라미터) ·
//      credential 0(§9/REQ-059) · 새 dep 0(node fs/path) · src 변경 0(test-only) ·
//      deploy/daily-test.sh 읽기만(실행/source 0).
import { readFileSync } from "fs";
import * as path from "path";

// repo-root 경로 — test 실행 cwd 무관하게 robust 하게 해석(`__dirname` = test/smoke,
// 두 단계 위가 repo-root). `process.cwd()` 대신 `__dirname` 기준 상대로 고정한다.
const REPO_ROOT = path.resolve(__dirname, "../..");
const DAILY_TEST_SH_PATH = path.join(REPO_ROOT, "deploy/daily-test.sh");

// curl_code() 배선 정본 라인(64행) — 실 bash 표현의 TS mirror(실 curl 실행 0). 실 64행 배선과 byte-동일.
const CURL_CODE_WIRING = `curl -s -o /dev/null -w '%{http_code}' --max-time "\${1}" "\${@:2}"`;
// 계약 의도 주석 정본(62행).
const CURL_CODE_INTENT_COMMENT =
  "HTTP status code 만 반환 (응답 body 는 버림). --max-time 으로 hang 방지";

// ── TS 동형 pure 함수(정본) — daily-test.sh curl_code()(62~65행) + caller 캡처(102·122·130·137행)를 모델링.
//    입력(문자열/배열)은 mutate 하지 않는다(읽기만). 실 curl/bash/소켓/env 읽기 0 — 입력은 파라미터.

// (a)~(e) buildCurlCodeArgv(timeout, rest): 64행 `curl -s -o /dev/null -w '%{http_code}' --max-time "${1}" "${@:2}"`
//     동형 — silent + body 폐기 + status-only + max-time positional(timeout 앞) + rest passthrough(뒤).
//     실 curl 실행 0(입력은 파라미터, 산출은 argv 배열).
function buildCurlCodeArgv(
  timeout: number | string,
  rest: readonly string[],
): string[] {
  return [
    "curl",
    "-s",
    "-o",
    "/dev/null",
    "-w",
    "%{http_code}",
    "--max-time",
    String(timeout),
    ...rest,
  ];
}

// curl_code() 배선 계약 — 5 요소 분리 판정.
interface CurlCodeContract {
  silent: boolean; // `-s` (progress meter 억제).
  bodyDiscardDevNull: boolean; // `-o /dev/null` (body 를 null 로).
  statusCodeOnlyWrite: boolean; // `-w '%{http_code}'` (status code 만 stdout).
  maxTimePositional: boolean; // `--max-time "${1}"` (첫 위치 인자 timeout).
  restPassthroughFromArg2: boolean; // `"${@:2}"` (두 번째 인자부터 passthrough).
}

// (a)~(e) curlCodeContract(defLine): 64행 배선 라인을 파싱해 5 계약 요소 분리 판정.
//     silent(`-s`) · body 폐기(`-o /dev/null`) · status-only(`-w '%{http_code}'`) ·
//     max-time positional(`--max-time "${1}"`) · passthrough(`"${@:2}"`, `"$@"` 아님).
function curlCodeContract(defLine: string): CurlCodeContract {
  return {
    // `-s` 를 독립 토큰으로(공백 경계) — `-something` 오매칭 회피.
    silent: /(^|\s)-s(\s|$)/.test(defLine),
    bodyDiscardDevNull: defLine.includes("-o /dev/null"),
    // status code 방출만 — `%{http_code}` write-out(타 metric `%{time_total}` 아님).
    statusCodeOnlyWrite: defLine.includes("-w '%{http_code}'"),
    // 첫 위치 인자가 timeout — `--max-time "${1}"`.
    maxTimePositional: defLine.includes('--max-time "${1}"'),
    // 두 번째 인자부터 passthrough — `"${@:2}"`(전-인자 `"$@"` 아님).
    restPassthroughFromArg2: defLine.includes('"${@:2}"'),
  };
}

// curl_code caller 한 호출부의 캡처 판정.
interface CallerCapture {
  raw: string; // 논리 라인(line-continuation 병합).
  captured: boolean; // command-substitution `$(curl_code ...)` 안에 캡처되는가.
  assignedToVar: boolean; // `code="$(curl_code ...)"` 형태(변수 흡수)인가.
  timeout: string; // 첫 위치 인자(timeout) — `curl_code 10 ...` → `10`.
}

// (f) curlCodeCallerCaptures(shellSource): curl_code 호출부(102·122·130·137행)를 열거해 각 호출이
//     `code="$(curl_code ...)"` 형태(command-substitution `$(...)` 안 캡처)임을 판정. 정의 라인
//     (`curl_code() {`)·주석(`# curl_code:`)은 caller 아니므로 제외. line-continuation(`\`)은 논리 라인 병합.
function curlCodeCallerCaptures(shellSource: string): CallerCapture[] {
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

  return logical
    .filter((line) => {
      const trimmed = line.trim();
      if (trimmed.startsWith("#")) return false; // 주석(`# curl_code:`) 제외.
      if (trimmed.includes("curl_code() {")) return false; // 정의 라인 제외.
      // curl_code 를 command 로 호출(뒤에 timeout arg 가 오는 형태) — `curl_code <digit>`.
      return /\bcurl_code\s+\d/.test(trimmed);
    })
    .map((line) => {
      const trimmed = line.trim();
      // command-substitution `$(curl_code` 안에 캡처되는가.
      const captured = /\$\(\s*curl_code\b/.test(trimmed);
      // `<var>="$(curl_code ...)"` — 변수로 흡수(caller 캡처)인가.
      const assignedToVar = /\w+="\$\(\s*curl_code\b/.test(trimmed);
      // 첫 위치 인자(timeout) 추출 — `curl_code 10 ...` → `10`.
      const m = trimmed.match(/curl_code\s+(\d+)/);
      return {
        raw: trimmed,
        captured,
        assignedToVar,
        timeout: m ? m[1] : "",
      };
    });
}

// ── 정적 앵커 추출 보조 함수 (실 bash curl_code 배선 표현이 소스에 실재하는지) ──────────────

// curl_code() 함수 정의 앵커(63행) — `curl_code() {`.
function hasCurlCodeFnAnchor(shellSource: string): boolean {
  return shellSource.includes("curl_code() {");
}

// curl_code() 배선 라인 앵커(64행) — silent + body 폐기 + status-only + max-time + passthrough 전부.
function hasCurlCodeWiringAnchor(shellSource: string): boolean {
  return shellSource.includes(CURL_CODE_WIRING);
}

// 계약 의도 주석 앵커(62행).
function hasCurlCodeIntentCommentAnchor(shellSource: string): boolean {
  return shellSource.includes(CURL_CODE_INTENT_COMMENT);
}

// curl_code() 배선 라인을 소스에서 추출 — `curl -s -o /dev/null -w '%{http_code}'` 를 포함하는 라인.
function extractCurlCodeWiringLine(shellSource: string): string {
  return (
    shellSource
      .replace(/\r\n/g, "\n")
      .split("\n")
      .find((l) => l.includes("curl -s -o /dev/null -w '%{http_code}'")) ?? ""
  );
}

// 3종 curl_code 배선 유도 앵커가 모두 실재하는지 — 하나라도 부재면 명시적 실패(빈 결과 성공-위장 0).
function extractCurlCodeAnchors(shellSource: string): {
  fnDef: boolean;
  wiring: boolean;
  intentComment: boolean;
} {
  return {
    fnDef: hasCurlCodeFnAnchor(shellSource),
    wiring: hasCurlCodeWiringAnchor(shellSource),
    intentComment: hasCurlCodeIntentCommentAnchor(shellSource),
  };
}

describe('realdata-e2e step④ daily-test.sh curl_code() 헬퍼 status-code-only · body 폐기 · max-time hang-guard · argv passthrough · caller 캡처 contract smoke — `-s -o /dev/null -w \'%{http_code}\' --max-time "${1}" "${@:2}"` + caller `$(...)` 캡처 (T-0954)', () => {
  describe("Happy-path: curl_code 헬퍼 앵커 정적 추출(pure 함수가 실 bash 배선을 mirror)", () => {
    it("curl_code() 정의(63)·배선 라인(64)·caller 캡처(102·122·130·137)·계약 주석(62)이 실 소스에 존재", () => {
      const shellSource = readFileSync(DAILY_TEST_SH_PATH, "utf8");
      const anchors = extractCurlCodeAnchors(shellSource);
      expect(anchors.fnDef).toBe(true);
      expect(anchors.wiring).toBe(true);
      expect(anchors.intentComment).toBe(true);
      // caller 캡처가 4 개 실재.
      expect(curlCodeCallerCaptures(shellSource)).toHaveLength(4);
    });
  });

  describe("Happy-path: buildCurlCodeArgv(timeout, rest) — max-time positional + rest passthrough", () => {
    it("buildCurlCodeArgv 는 `[curl, -s, -o, /dev/null, -w, %{http_code}, --max-time, <timeout>, ...rest]`(64행 배선 동형) 반환", () => {
      expect(buildCurlCodeArgv(10, ["$BASE_URL/"])).toEqual([
        "curl",
        "-s",
        "-o",
        "/dev/null",
        "-w",
        "%{http_code}",
        "--max-time",
        "10",
        "$BASE_URL/",
      ]);
      // signup caller(122행) 동형 — timeout 이 --max-time 뒤, method/URL/header/data 가 뒤에 passthrough.
      const signup = buildCurlCodeArgv(10, [
        "-X",
        "POST",
        "http://x/api/users",
        "-H",
        "Content-Type: application/json",
        "-d",
        "$payload",
      ]);
      expect(signup.slice(0, 8)).toEqual([
        "curl",
        "-s",
        "-o",
        "/dev/null",
        "-w",
        "%{http_code}",
        "--max-time",
        "10",
      ]);
      expect(signup.slice(8)).toEqual([
        "-X",
        "POST",
        "http://x/api/users",
        "-H",
        "Content-Type: application/json",
        "-d",
        "$payload",
      ]);
      // timeout 이 항상 `--max-time` 바로 뒤 위치(positional) — 여러 timeout 값 실증.
      expect(buildCurlCodeArgv(5, []).indexOf("--max-time")).toBe(6);
      expect(buildCurlCodeArgv("30", []).at(-1)).toBe("30");
    });
  });

  describe("Happy-path: curlCodeContract — silent·body-폐기·status-only·max-time·passthrough 5요소 분리", () => {
    it('정본 배선 라인 → 5 계약 요소 전부 true(-s + -o /dev/null + -w \'%{http_code}\' + --max-time "${1}" + "${@:2}")', () => {
      const c = curlCodeContract(CURL_CODE_WIRING);
      expect(c).toEqual({
        silent: true,
        bodyDiscardDevNull: true,
        statusCodeOnlyWrite: true,
        maxTimePositional: true,
        restPassthroughFromArg2: true,
      });
    });

    it("실 소스에서 추출한 배선 라인도 동일 판정 — 5 요소 전부 true", () => {
      const shellSource = readFileSync(DAILY_TEST_SH_PATH, "utf8");
      const line = extractCurlCodeWiringLine(shellSource);
      expect(line).not.toBe("");
      expect(curlCodeContract(line)).toEqual({
        silent: true,
        bodyDiscardDevNull: true,
        statusCodeOnlyWrite: true,
        maxTimePositional: true,
        restPassthroughFromArg2: true,
      });
    });
  });

  describe("Happy-path: curlCodeCallerCaptures — 모든 caller 가 command-substitution 캡처", () => {
    it('4 caller(102·122·130·137) 전부 `code="$(curl_code ...)"` 캡처 + timeout=10, bare-stdout 방출 0', () => {
      const shellSource = readFileSync(DAILY_TEST_SH_PATH, "utf8");
      const callers = curlCodeCallerCaptures(shellSource);
      expect(callers).toHaveLength(4);
      callers.forEach((c) => {
        expect(c.captured).toBe(true); // `$(curl_code ...)` 캡처.
        expect(c.assignedToVar).toBe(true); // `code="$(...)"` 변수 흡수.
        expect(c.timeout).toBe("10"); // 첫 인자 timeout 10.
      });
    });
  });

  describe("branch: body 폐기(`-o /dev/null`) 존재 → status 만 stdout", () => {
    it("정본은 bodyDiscardDevNull=true, `-o /dev/null` 제거 mutant 은 false — 두 입력으로 분리 실증", () => {
      expect(curlCodeContract(CURL_CODE_WIRING).bodyDiscardDevNull).toBe(true);
      // mutant(모델 사본): `-o /dev/null` 제거 → 응답 body 가 status 앞에 stdout 오염 회귀.
      const mutant = CURL_CODE_WIRING.replace("-o /dev/null ", "");
      expect(curlCodeContract(mutant).bodyDiscardDevNull).toBe(false);
      // 실 소스 배선 라인이 `-o /dev/null` 포함.
      const line = extractCurlCodeWiringLine(
        readFileSync(DAILY_TEST_SH_PATH, "utf8"),
      );
      expect(line).toContain("-o /dev/null");
    });
  });

  describe("branch: status-only(`-w '%{http_code}'`) vs 다른 write-out 정적 대조", () => {
    it("정본은 statusCodeOnlyWrite=true(`%{http_code}`), `%{time_total}` mutant 은 false", () => {
      expect(curlCodeContract(CURL_CODE_WIRING).statusCodeOnlyWrite).toBe(true);
      // mutant(모델 사본): `%{http_code}` → `%{time_total}`(잘못된 metric — status 미방출 회귀).
      const mutant = CURL_CODE_WIRING.replace("%{http_code}", "%{time_total}");
      expect(curlCodeContract(mutant).statusCodeOnlyWrite).toBe(false);
      // 실 소스가 `%{http_code}` 이고 `%{time_total}` 이 아님.
      const line = extractCurlCodeWiringLine(
        readFileSync(DAILY_TEST_SH_PATH, "utf8"),
      );
      expect(line).toContain("%{http_code}");
      expect(line).not.toContain("%{time_total}");
    });
  });

  describe('branch: max-time positional(`--max-time "${1}"`) vs 부재 정적 대조', () => {
    it('정본은 maxTimePositional=true, `--max-time "${1}"` 제거 mutant 은 false — hang-guard 소실 검출', () => {
      expect(curlCodeContract(CURL_CODE_WIRING).maxTimePositional).toBe(true);
      // mutant(모델 사본): `--max-time "${1}"` 제거 → 응답 없는 endpoint 에서 무한 대기 회귀.
      const mutant = CURL_CODE_WIRING.replace('--max-time "${1}" ', "");
      expect(curlCodeContract(mutant).maxTimePositional).toBe(false);
      // 실 소스가 `--max-time "${1}"` 포함.
      const line = extractCurlCodeWiringLine(
        readFileSync(DAILY_TEST_SH_PATH, "utf8"),
      );
      expect(line).toContain('--max-time "${1}"');
    });
  });

  describe('branch: passthrough(`"${@:2}"`) vs `"$@"` 정적 대조', () => {
    it('정본은 restPassthroughFromArg2=true(`"${@:2}"`), `"$@"` mutant 은 false — timeout-as-URL 오배선 검출', () => {
      expect(curlCodeContract(CURL_CODE_WIRING).restPassthroughFromArg2).toBe(
        true,
      );
      // mutant(모델 사본): `"${@:2}"` → `"$@"`(timeout 포함 전-인자 — 첫 인자가 URL 로 오배선 회귀).
      const mutant = CURL_CODE_WIRING.replace('"${@:2}"', '"$@"');
      expect(curlCodeContract(mutant).restPassthroughFromArg2).toBe(false);
      // 실 소스가 `"${@:2}"` 이고 `"$@"`(전-인자)가 아님.
      const line = extractCurlCodeWiringLine(
        readFileSync(DAILY_TEST_SH_PATH, "utf8"),
      );
      expect(line).toContain('"${@:2}"');
      expect(line).not.toContain('"$@"');
    });
  });

  describe("Error path / negative cases 충분 cover", () => {
    it("error path — shell 파일 부재 경로 → readFileSync throw(silent 0-byte fallback 0)", () => {
      const badPath = path.join(REPO_ROOT, "deploy/__does_not_exist__.sh");
      expect(() => readFileSync(badPath, "utf8")).toThrow();
    });

    it("error path — curl_code 앵커 부재 시 명시적 실패(빈 매칭을 pass 로 오통과 0)", () => {
      // 앵커를 제거한 합성 소스(curl_code 유도 표현 부재).
      const emptySource = "#!/usr/bin/env bash\necho hello\n";
      const anchors = extractCurlCodeAnchors(emptySource);
      expect(anchors.fnDef).toBe(false);
      expect(anchors.wiring).toBe(false);
      expect(anchors.intentComment).toBe(false);
      // 배선 라인 추출도 빈 결과(성공-위장 0), caller 열거도 0.
      expect(extractCurlCodeWiringLine(emptySource)).toBe("");
      expect(curlCodeCallerCaptures(emptySource)).toHaveLength(0);
      // 실 소스는 반대로 전부 존재 — 부재/실재를 변별함을 대비로 실증.
      const realAnchors = extractCurlCodeAnchors(
        readFileSync(DAILY_TEST_SH_PATH, "utf8"),
      );
      expect(realAnchors.fnDef).toBe(true);
      expect(realAnchors.wiring).toBe(true);
      expect(realAnchors.intentComment).toBe(true);
    });

    it("negative (a) — body 폐기 파괴 drift 변별: `-o /dev/null` 제거 사본에서 'body 폐기' assert 실패", () => {
      expect(curlCodeContract(CURL_CODE_WIRING).bodyDiscardDevNull).toBe(true);
      // mutant(모델 사본): `-o /dev/null` 제거 → caller `$(...)` 캡처가 body 섞인 오염값 얻는 회귀.
      const mutant = CURL_CODE_WIRING.replace("-o /dev/null ", "");
      expect(curlCodeContract(mutant).bodyDiscardDevNull).toBe(false);
      expect(curlCodeContract(mutant).bodyDiscardDevNull).not.toBe(
        curlCodeContract(CURL_CODE_WIRING).bodyDiscardDevNull,
      );
      // 원본 문자열/함수 불변(replace 는 사본 반환).
      expect(curlCodeContract(CURL_CODE_WIRING).bodyDiscardDevNull).toBe(true);
    });

    it("negative (b) — status-only → 타 metric drift 변별: `%{http_code}` → `%{time_total}` 사본에서 'status-only' assert 실패", () => {
      expect(curlCodeContract(CURL_CODE_WIRING).statusCodeOnlyWrite).toBe(true);
      // mutant(모델 사본): `%{http_code}` → `%{time_total}`(status 미방출 → code 공백 회귀).
      const mutant = CURL_CODE_WIRING.replace("%{http_code}", "%{time_total}");
      expect(curlCodeContract(mutant).statusCodeOnlyWrite).toBe(false);
      expect(curlCodeContract(mutant).statusCodeOnlyWrite).not.toBe(
        curlCodeContract(CURL_CODE_WIRING).statusCodeOnlyWrite,
      );
      // 원본 불변.
      expect(curlCodeContract(CURL_CODE_WIRING).statusCodeOnlyWrite).toBe(true);
    });

    it("negative (c) — max-time 제거 drift 변별: `--max-time \"${1}\"` 제거 사본에서 'max-time positional' assert 실패", () => {
      expect(curlCodeContract(CURL_CODE_WIRING).maxTimePositional).toBe(true);
      // mutant(모델 사본): `--max-time "${1}"` 제거 → 무한 대기 hang 회귀.
      const mutant = CURL_CODE_WIRING.replace('--max-time "${1}" ', "");
      expect(curlCodeContract(mutant).maxTimePositional).toBe(false);
      expect(curlCodeContract(mutant).maxTimePositional).not.toBe(
        curlCodeContract(CURL_CODE_WIRING).maxTimePositional,
      );
      // 원본 불변.
      expect(curlCodeContract(CURL_CODE_WIRING).maxTimePositional).toBe(true);
    });

    it('negative (d) — passthrough → 전-인자 drift 변별: `"${@:2}"` → `"$@"` 사본에서 \'passthrough from arg2\' assert 실패', () => {
      expect(curlCodeContract(CURL_CODE_WIRING).restPassthroughFromArg2).toBe(
        true,
      );
      // mutant(모델 사본): `"${@:2}"` → `"$@"`(첫 인자 timeout 이 URL 로 오배선 회귀).
      const mutant = CURL_CODE_WIRING.replace('"${@:2}"', '"$@"');
      expect(curlCodeContract(mutant).restPassthroughFromArg2).toBe(false);
      expect(curlCodeContract(mutant).restPassthroughFromArg2).not.toBe(
        curlCodeContract(CURL_CODE_WIRING).restPassthroughFromArg2,
      );
      // 원본 불변.
      expect(curlCodeContract(CURL_CODE_WIRING).restPassthroughFromArg2).toBe(
        true,
      );
    });

    it('negative (e) — caller bare-호출 drift 변별: 한 caller 를 `curl_code 10 "$URL"`(bare) 로 mutate 하면 그 caller 캡처 실패(stdout 순수성 상보)', () => {
      const shellSource = readFileSync(DAILY_TEST_SH_PATH, "utf8");
      // 정본: 4 caller 전부 캡처.
      const real = curlCodeCallerCaptures(shellSource);
      expect(real).toHaveLength(4);
      expect(real.every((c) => c.captured && c.assignedToVar)).toBe(true);
      // mutant(모델 사본): liveness caller(102행)를 bare 호출로 치환 — status code 가 스크립트
      // bare-stdout 으로 새어 T-0953 stdout 순수성(387행 cat 유일-emitter) 깨는 회귀.
      const mutant = shellSource.replace(
        'code="$(curl_code 10 "$BASE_URL/")"',
        'curl_code 10 "$BASE_URL/"',
      );
      const mutantCallers = curlCodeCallerCaptures(mutant);
      // bare 호출도 caller 로 열거되지만 캡처 아님(command-substitution 밖).
      const bare = mutantCallers.find(
        (c) => c.raw === 'curl_code 10 "$BASE_URL/"',
      );
      expect(bare).toBeDefined();
      expect(bare!.captured).toBe(false);
      expect(bare!.assignedToVar).toBe(false);
      // 전부-캡처 불변식이 mutant 에서 깨짐(정본 true → mutant false).
      expect(mutantCallers.every((c) => c.captured)).toBe(false);
      expect(real.every((c) => c.captured)).toBe(true);
      // 원본 소스 불변(replace 는 사본 반환).
      expect(curlCodeCallerCaptures(shellSource)).toHaveLength(4);
    });

    it("negative (f) — credential/secret 누출 0: 추출/합성 문자열에 gh 토큰 어휘·credential 실값 미등장(§9/REQ-059)", () => {
      const shellSource = readFileSync(DAILY_TEST_SH_PATH, "utf8");
      const synthesized = [
        buildCurlCodeArgv(10, ["-X", "POST", "$BASE_URL/api/users"]).join(" "),
        JSON.stringify(curlCodeContract(CURL_CODE_WIRING)),
        JSON.stringify(extractCurlCodeAnchors(shellSource)),
        extractCurlCodeWiringLine(shellSource),
        JSON.stringify(curlCodeCallerCaptures(shellSource)),
      ];
      const credentialPattern =
        /(ghp_|--token|GITHUB_TOKEN|GH_TOKEN|\bBearer\b|Authorization|\bsk-)/i;
      synthesized.forEach((s) => {
        expect(credentialPattern.test(s)).toBe(false);
      });
      // caller 앵커의 `"$payload"`/`"$SMOKE_PASSWORD"` 는 변수 참조 토큰이지 실값 아님 — 실 secret 미surface.
      const callers = curlCodeCallerCaptures(shellSource);
      callers.forEach((c) => {
        expect(c.raw).not.toMatch(/ghp_|password=|Bearer /i);
      });
    });
  });

  describe("flow: 결정론 · no-mutation", () => {
    it("동일 입력(timeout·rest·shell 소스)으로 pure 함수를 두 번 호출하면 deep-equal(결정론)", () => {
      const shellSource = readFileSync(DAILY_TEST_SH_PATH, "utf8");
      expect(buildCurlCodeArgv(10, ["$URL"])).toEqual(
        buildCurlCodeArgv(10, ["$URL"]),
      );
      expect(curlCodeContract(CURL_CODE_WIRING)).toEqual(
        curlCodeContract(CURL_CODE_WIRING),
      );
      expect(curlCodeCallerCaptures(shellSource)).toEqual(
        curlCodeCallerCaptures(shellSource),
      );
      expect(extractCurlCodeAnchors(shellSource)).toEqual(
        extractCurlCodeAnchors(shellSource),
      );
    });

    it("pure 함수·추출 보조 함수가 입력(shell 소스·rest 배열)을 mutate 0(원본 불변)", () => {
      const shellSource = readFileSync(DAILY_TEST_SH_PATH, "utf8");
      const sourceSnapshot = shellSource;
      extractCurlCodeAnchors(shellSource);
      extractCurlCodeWiringLine(shellSource);
      curlCodeCallerCaptures(shellSource);
      expect(shellSource).toBe(sourceSnapshot);

      const rest = ["-X", "POST", "$URL"];
      const restSnapshot = [...rest];
      buildCurlCodeArgv(10, rest);
      expect(rest).toEqual(restSnapshot);

      const lineSnapshot = CURL_CODE_WIRING;
      curlCodeContract(CURL_CODE_WIRING);
      expect(CURL_CODE_WIRING).toBe(lineSnapshot);
    });
  });

  describe("dormant / non-gated 확인 — side-effect 0", () => {
    it("curl_code 모델이 env / 전역 상태 없이 순수하게 동작(non-gated — 입력은 파라미터로만)", () => {
      // 본 describe 가 실행된다는 것 자체가 describe.skip 0(항상 실행)의 런타임 증거.
      const envSnapshot = { ...process.env };
      const before = curlCodeContract(CURL_CODE_WIRING);
      // 실 process.env 를 mutate 해도 산출 불변 — 모델이 process.env 를 참조하지 않음(파라미터로만).
      Object.assign(process.env, { BASE_URL: "http://x" });
      const after = curlCodeContract(CURL_CODE_WIRING);
      delete process.env.BASE_URL;
      expect(after).toEqual(before);
      expect(Object.keys(process.env)).toEqual(Object.keys(envSnapshot));
    });

    it("파일 read 는 deploy/daily-test.sh 읽기만 — 실 curl/HTTP/network/git 실행 0(추출 결과가 문자열이지 실행 산출물 아님)", () => {
      const shellSource = readFileSync(DAILY_TEST_SH_PATH, "utf8");
      expect(shellSource.startsWith("#!")).toBe(true);
      expect(hasCurlCodeFnAnchor(shellSource)).toBe(true);
      expect(hasCurlCodeWiringAnchor(shellSource)).toBe(true);
    });
  });
});
