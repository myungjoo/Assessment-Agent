// realdata-e2e-daily-test-liveness-app-alive-three-gate-conjunction-spa-html-detection-per-condition-diagnostic-contract.smoke-spec.ts
// — 실 평가 e2e step④ `deploy/daily-test.sh` nightly runner 의 `step_liveness`(95~114행) 가 기동된
// 컨테이너의 "앱-생존" 을 판정하는 **내부 3-gate 합취(conjunction) 계약** 을 실 shell 파일을 readFileSync
// 로 읽어(실행/source 0) 정적 검증하는 non-gated build-time smoke (T-0950, PLAN.md 109행 🟢 실 평가 e2e step④).
//
// 봉함 불변식: **liveness 는 3-조건(① GET /api body == $HEALTH_MESSAGE · ② GET / status == 200 ·
// ③ GET / body 가 SPA-HTML)을 *모두* 만족해야만 앱-생존을 단언하고(부분 통과는 FAIL), 실패 시 어느
// *조건* 이 깨졌는지만 진단해 응답 body 실값을 누출하지 않으며(§9), SPA-HTML 판정은 doctype 또는
// root-div 정규식으로만 한다.** 이 불변식이 무인 nightly 가 "배포 앱이 실제로 살아있고 SPA 를 서빙한다"
// 를 false-positive/negative 없이 판정하는 신뢰의 핵심. 계약 4종(실 소스 유도 앵커):
//   (a) 3-gate 합취 규칙(95~114행 step_liveness — ① 98행 `[ "$body" != "$HEALTH_MESSAGE" ]` AND
//       ② 104행 `[ "$code" != "200" ]`(102행 `curl_code 10 "$BASE_URL/"`) AND ③ 108행 SPA 정규식 —
//       셋 모두 통과해야 113행 return 0, 하나라도 실패면 return 1) ·
//   (b) SPA-HTML 탐지 정규식(108행 `grep -qiE '<!doctype html|id="root"'` — doctype 선언 또는 SPA mount
//       root div 중 하나만 있어도 case-insensitive 로 SPA 인정, health 문자열 단독은 SPA 아님) ·
//   (c) 조건별 §9-safe 진단(99·105·109행 `log "step liveness: FAIL — ..."` — 어느 gate 가 깨졌는지 *조건*
//       만 진단, 응답 body 실값은 `${body:-<none>}` placeholder 로만 노출, credential/secret echo 0) ·
//   (d) health-vs-liveness 구분(step_health 79~93행 은 GET /api body 일치만, step_liveness 는 그 위에
//       root 200 + SPA-HTML 을 *더* 요구 — liveness 가 health 의 strict superset).
//
// 전략(T-0947/T-0948/T-0949 동형): liveness 합취 유도 표현을 정적 앵커로 추출 + bash 3-gate 합취 semantics
// 를 TS 순수 함수(`isSpaHtml`·`isAlive`·`livenessDiagnostic`)로 동형 모델링해 합취·SPA-정규식·조건별-진단
// 불변식 assert. T-0792(HTTP path·method·status parity — SPA-HTML 내용 비교 *명시 제외*, 그 spec line 46)·
// T-0947(cascade black-box outcome)·T-0944(집계 값)·T-0945(dual-sink)·T-0946(prune)·T-0948(스칼라
// provenance)·T-0949(gating-env 완전성) 와 distinct surface(liveness 함수 *내부* 3-gate 합취 + SPA-HTML semantics).
//   🔥 실 redeploy/HTTP/curl/jest spawn/gh/git 0 · liveness 분기 실행 0(non-gated, describe.skip 0) ·
//      process.env 읽기 0(입력은 pure 함수 파라미터) · credential 0(§9/REQ-059) · 새 dep 0(node fs/path) ·
//      src 변경 0(test-only) · deploy/daily-test.sh 읽기만(실행/source 0).
import { readFileSync } from "fs";
import * as path from "path";

// repo-root 경로 — test 실행 cwd 무관하게 robust 하게 해석(`__dirname` = test/smoke,
// 두 단계 위가 repo-root). `process.cwd()` 대신 `__dirname` 기준 상대로 고정한다.
const REPO_ROOT = path.resolve(__dirname, "../..");
const DAILY_TEST_SH_PATH = path.join(REPO_ROOT, "deploy/daily-test.sh");

// 실 소스 mirror 용 health 문자열 placeholder — 실 $HEALTH_MESSAGE 값이 아니라 동형 모델의 기대치.
// credential/secret 아님(단순 앱 이름 문자열). liveness 입력은 아래 pure 함수 파라미터로만 표현.
const HEALTH_MESSAGE = "Assessment-Agent";

// liveness 입력 3-tuple — 실 curl 산출(GET /api body · GET / status · GET / body)의 동형 모델.
// 실 네트워크 요청 0 — 값은 함수 파라미터로만 주입.
interface LivenessInput {
  apiBody: string;
  rootStatus: number;
  rootBody: string;
}

// ── TS 동형 pure 함수(정본) — daily-test.sh step_liveness(95~114행) 3-gate 합취를 순수 함수로 모델링.
//    입력(문자열·숫자)은 mutate 하지 않는다(읽기만). 실 bash/curl/env 읽기 0 — 입력은 함수 파라미터.

// (b) isSpaHtml(body): 108행 `grep -qiE '<!doctype html|id="root"'` 동형 — doctype 선언 또는 SPA mount
//     root-div(`id="root"`) 중 *하나만* 있어도 case-insensitive(`-i`)로 SPA 인정. 둘 다 없으면 false.
function isSpaHtml(body: string): boolean {
  return /<!doctype html|id="root"/i.test(body);
}

// (a) isAlive(input): 3-gate 합취(AND) — ① apiBody == HEALTH_MESSAGE(98행) AND ② rootStatus == 200(104행)
//     AND ③ isSpaHtml(rootBody)(108행). 셋 *모두* true 여야 alive(return 0 동형). 하나라도 false 면
//     not-alive(return 1 동형) — 부분 통과는 FAIL(half-broken 배포를 alive 로 오판하지 않음).
function isAlive(input: LivenessInput): boolean {
  return (
    input.apiBody === HEALTH_MESSAGE &&
    input.rootStatus === 200 &&
    isSpaHtml(input.rootBody)
  );
}

// (c) livenessDiagnostic(input): 실패 시 어느 *조건* 이 깨졌는지만 진단(99·105·109행 동형). 응답 body
//     실값(apiBody/rootBody)은 반환 문자열에 절대 포함하지 않는다(§9) — 조건명 + status 코드만 노출.
//     첫 실패 gate 의 조건만 진단(bash 의 조기 return 순서: gate① → gate② → gate③).
function livenessDiagnostic(input: LivenessInput): string {
  if (input.apiBody !== HEALTH_MESSAGE) {
    return "GET /api 불일치";
  }
  if (input.rootStatus !== 200) {
    return `GET / status=${input.rootStatus}`;
  }
  if (!isSpaHtml(input.rootBody)) {
    return "GET / 가 SPA HTML 아님";
  }
  return "OK";
}

// ── 정적 앵커 추출 보조 함수 (실 bash liveness 3-gate 합취 표현이 소스에 실재하는지) ──────────────

// step_liveness 함수 정의 앵커(95행) — `step_liveness() {`.
function hasLivenessFnAnchor(shellSource: string): boolean {
  return shellSource.includes("step_liveness() {");
}

// gate① — GET /api body 대조 앵커(98행) `[ "$body" != "$HEALTH_MESSAGE" ]`.
function hasApiMatchGateAnchor(shellSource: string): boolean {
  return shellSource.includes('[ "$body" != "$HEALTH_MESSAGE" ]');
}

// gate② — root status 추출(102행) `curl_code 10 "$BASE_URL/"` + 판정(104행) `[ "$code" != "200" ]`.
function hasRootStatusGateAnchor(shellSource: string): boolean {
  return (
    shellSource.includes('curl_code 10 "$BASE_URL/"') &&
    shellSource.includes('[ "$code" != "200" ]')
  );
}

// gate③ — SPA-HTML 탐지 정규식 앵커(108행) `grep -qiE '<!doctype html|id="root"'`.
function hasSpaHtmlGateAnchor(shellSource: string): boolean {
  return shellSource.includes(`grep -qiE '<!doctype html|id="root"'`);
}

// OK return 앵커(112~113행) — `step liveness: OK (GET /api 일치, GET / 200 + SPA HTML)` + `return 0`.
function hasLivenessOkAnchor(shellSource: string): boolean {
  return (
    shellSource.includes(
      "step liveness: OK (GET /api 일치, GET / 200 + SPA HTML)",
    ) && shellSource.includes("return 0")
  );
}

// curl_code helper 앵커(62~65행) — status-only 추출 `%{http_code}` + hang guard `--max-time`.
function hasCurlCodeHelperAnchor(shellSource: string): boolean {
  return (
    shellSource.includes("curl_code() {") &&
    shellSource.includes("%{http_code}") &&
    shellSource.includes('--max-time "${1}"')
  );
}

// 6종 liveness 합취 유도 앵커가 모두 실재하는지 — 하나라도 부재면 명시적 실패(빈 결과 성공-위장 0).
function extractLivenessConjunctionAnchors(shellSource: string): {
  livenessFn: boolean;
  apiMatchGate: boolean;
  rootStatusGate: boolean;
  spaHtmlGate: boolean;
  okReturn: boolean;
  curlCodeHelper: boolean;
} {
  return {
    livenessFn: hasLivenessFnAnchor(shellSource),
    apiMatchGate: hasApiMatchGateAnchor(shellSource),
    rootStatusGate: hasRootStatusGateAnchor(shellSource),
    spaHtmlGate: hasSpaHtmlGateAnchor(shellSource),
    okReturn: hasLivenessOkAnchor(shellSource),
    curlCodeHelper: hasCurlCodeHelperAnchor(shellSource),
  };
}

// step_liveness 함수 본문 슬라이스(95행 정의 ~ 다음 함수 정의 직전) — health superset 대조·§9 진단 검사용.
function extractLivenessFnSlice(shellSource: string): string {
  const start = shellSource.indexOf("step_liveness() {");
  if (start === -1) return "";
  // 다음 top-level 함수 정의(`step_auth() {`)가 liveness 뒤에 온다 — 그 직전까지 슬라이스.
  const next = shellSource.indexOf("step_auth() {", start);
  return next === -1
    ? shellSource.slice(start)
    : shellSource.slice(start, next);
}

// step_health 함수 본문 슬라이스(79행 정의 ~ step_liveness 직전) — liveness 가 health 의 superset 임 대조용.
function extractHealthFnSlice(shellSource: string): string {
  const start = shellSource.indexOf("step_health() {");
  if (start === -1) return "";
  const next = shellSource.indexOf("step_liveness() {", start);
  return next === -1
    ? shellSource.slice(start)
    : shellSource.slice(start, next);
}

// 정상 alive 입력(3-gate 모두 통과) — 실 curl 산출의 동형 placeholder(실 네트워크 0).
function aliveInput(): LivenessInput {
  return {
    apiBody: HEALTH_MESSAGE,
    rootStatus: 200,
    rootBody: '<!doctype html><html><body><div id="root"></div></body></html>',
  };
}

describe("realdata-e2e step④ daily-test.sh step_liveness 앱-생존 3-gate 합취 contract smoke — GET /api match AND GET / 200 AND SPA-HTML · 조건별 §9-safe 진단 (T-0950)", () => {
  describe("Happy-path: step_liveness 3-gate 앵커 정적 추출(pure 함수가 실 bash 합취를 mirror)", () => {
    it("함수 정의(95)·gate① api-match(98)·gate② root-status(102/104)·gate③ SPA-regex(108)·OK return(113)·curl_code helper(62~65)가 실 소스에 존재(6 앵커 전부 true)", () => {
      const shellSource = readFileSync(DAILY_TEST_SH_PATH, "utf8");
      const anchors = extractLivenessConjunctionAnchors(shellSource);
      expect(anchors.livenessFn).toBe(true);
      expect(anchors.apiMatchGate).toBe(true);
      expect(anchors.rootStatusGate).toBe(true);
      expect(anchors.spaHtmlGate).toBe(true);
      expect(anchors.okReturn).toBe(true);
      expect(anchors.curlCodeHelper).toBe(true);
    });
  });

  describe("Happy-path: 3-조건 모두 통과 → alive", () => {
    it("isAlive 는 apiBody==HEALTH_MESSAGE AND rootStatus==200 AND SPA-HTML 인 입력에서 true(return 0 동형) + 진단은 OK", () => {
      const input = aliveInput();
      expect(isAlive(input)).toBe(true);
      expect(livenessDiagnostic(input)).toBe("OK");
    });

    it("SPA-HTML 이 root-div 만(doctype 없이) 있어도 3-조건 통과면 alive(108행 `|` OR 분기)", () => {
      const input: LivenessInput = {
        apiBody: HEALTH_MESSAGE,
        rootStatus: 200,
        rootBody: '<html><body><div id="root"></div></body></html>',
      };
      expect(isAlive(input)).toBe(true);
    });
  });

  describe("Happy-path: isSpaHtml 정규식 검증(doctype OR root-div, case-insensitive)", () => {
    it("doctype(대/소문자)·root-div(대/소문자 혼합) 각각 true, health 문자열·빈 body·임의 텍스트는 false", () => {
      // doctype 선언(대문자/소문자) — 각각 SPA 인정.
      expect(isSpaHtml("<!DOCTYPE html>")).toBe(true);
      expect(isSpaHtml("<!doctype html>")).toBe(true);
      // doctype 없이 root-div 만(대소문자 혼합) — `|` OR 분기로 SPA 인정.
      expect(isSpaHtml('<div id="root"></div>')).toBe(true);
      expect(isSpaHtml('<DIV ID="ROOT"></DIV>')).toBe(true);
      // 둘 다 존재해도 SPA.
      expect(isSpaHtml('<!doctype html>...<div id="root">')).toBe(true);
      // health 문자열 단독은 SPA 아님(GET /api 응답을 root 로 오인 금지).
      expect(isSpaHtml("Assessment-Agent")).toBe(false);
      // 빈 body·doctype/root 둘 다 없는 임의 텍스트 — false.
      expect(isSpaHtml("")).toBe(false);
      expect(isSpaHtml("<html><body>404 Not Found</body></html>")).toBe(false);
      expect(isSpaHtml('{"json":"api response"}')).toBe(false);
    });
  });

  describe("branch: gate 별 실패 → not-alive + 조건별 진단(99·105·109행 앵커)", () => {
    it("(i) apiBody 불일치(root 정상) → not-alive + 'GET /api 불일치' 진단", () => {
      const input: LivenessInput = {
        apiBody: "wrong-health",
        rootStatus: 200,
        rootBody: '<!doctype html><div id="root"></div>',
      };
      expect(isAlive(input)).toBe(false);
      expect(livenessDiagnostic(input)).toBe("GET /api 불일치");
    });

    it("(ii) apiBody 일치이나 rootStatus != 200 → not-alive + 'GET / status=' 진단", () => {
      const input: LivenessInput = {
        apiBody: HEALTH_MESSAGE,
        rootStatus: 500,
        rootBody: '<!doctype html><div id="root"></div>',
      };
      expect(isAlive(input)).toBe(false);
      expect(livenessDiagnostic(input)).toBe("GET / status=500");
    });

    it("(iii) apiBody 일치 + 200 이나 rootBody 비-SPA → not-alive + 'GET / 가 SPA HTML 아님' 진단", () => {
      const input: LivenessInput = {
        apiBody: HEALTH_MESSAGE,
        rootStatus: 200,
        rootBody: "<html><body>plain</body></html>",
      };
      expect(isAlive(input)).toBe(false);
      expect(livenessDiagnostic(input)).toBe("GET / 가 SPA HTML 아님");
    });

    it("첫 실패 gate 의 조건만 진단(gate①②③ 동시 실패 시 gate① 진단 — bash 조기 return 순서)", () => {
      const input: LivenessInput = {
        apiBody: "wrong",
        rootStatus: 500,
        rootBody: "plain",
      };
      expect(livenessDiagnostic(input)).toBe("GET /api 불일치");
    });
  });

  describe("branch: health superset 대조(liveness 가 health 의 strict superset)", () => {
    it("step_health 슬라이스는 GET /api body 일치만(root/SPA 미검사), step_liveness 슬라이스는 root 200 + SPA-HTML 을 더 요구", () => {
      const shellSource = readFileSync(DAILY_TEST_SH_PATH, "utf8");
      const healthSlice = extractHealthFnSlice(shellSource);
      const livenessSlice = extractLivenessFnSlice(shellSource);
      // 양 step 공통: GET /api body == $HEALTH_MESSAGE.
      expect(healthSlice).toContain("$HEALTH_MESSAGE");
      expect(livenessSlice).toContain("$HEALTH_MESSAGE");
      // health 는 root/SPA 미검사 — SPA 정규식·root status gate 미등장.
      expect(healthSlice).not.toContain("grep -qiE");
      expect(healthSlice).not.toContain("<!doctype html");
      expect(healthSlice).not.toContain('id="root"');
      expect(healthSlice).not.toContain('[ "$code" != "200" ]');
      // liveness 는 그 위에 root 200 + SPA-HTML 을 더 요구(strict superset).
      expect(livenessSlice).toContain('[ "$code" != "200" ]');
      expect(livenessSlice).toContain(`grep -qiE '<!doctype html|id="root"'`);
    });
  });

  describe("Error path / negative cases 충분 cover", () => {
    it("error path — shell 파일 부재 경로 → readFileSync throw(silent 0-byte fallback 0)", () => {
      const badPath = path.join(REPO_ROOT, "deploy/__does_not_exist__.sh");
      expect(() => readFileSync(badPath, "utf8")).toThrow();
    });

    it("error path — liveness 합취 앵커 부재 시 명시적 실패(빈 매칭을 pass 로 오통과 0)", () => {
      // 앵커를 제거한 합성 소스(liveness 유도 표현 부재)에서 추출기가 false / 빈 슬라이스를 낸다.
      const emptySource = "#!/usr/bin/env bash\necho hello\n";
      const anchors = extractLivenessConjunctionAnchors(emptySource);
      expect(anchors.livenessFn).toBe(false);
      expect(anchors.apiMatchGate).toBe(false);
      expect(anchors.rootStatusGate).toBe(false);
      expect(anchors.spaHtmlGate).toBe(false);
      expect(anchors.okReturn).toBe(false);
      expect(anchors.curlCodeHelper).toBe(false);
      // 슬라이스 추출도 빈 결과(성공-위장 0).
      expect(extractLivenessFnSlice(emptySource)).toBe("");
      // 실 소스는 반대로 전부 존재 — 부재/실재를 변별함을 대비로 실증.
      const realAnchors = extractLivenessConjunctionAnchors(
        readFileSync(DAILY_TEST_SH_PATH, "utf8"),
      );
      expect(realAnchors.livenessFn).toBe(true);
      expect(realAnchors.spaHtmlGate).toBe(true);
    });

    it("negative (a) — 합취 OR-약화 drift 변별: 3-gate 를 OR(하나만 통과해도 alive)로 mutate 한 모델에서 '부분 통과는 not-alive' assert 실패", () => {
      // mutant(모델 사본): OR 합취 — 하나라도 통과하면 alive.
      const mutantIsAlive = (input: LivenessInput): boolean =>
        input.apiBody === HEALTH_MESSAGE ||
        input.rootStatus === 200 ||
        isSpaHtml(input.rootBody);
      // health 만 맞고 root 500 + 비-SPA(부분 통과).
      const partial: LivenessInput = {
        apiBody: HEALTH_MESSAGE,
        rootStatus: 500,
        rootBody: "plain",
      };
      // 정본(AND 합취): 부분 통과 → not-alive.
      expect(isAlive(partial)).toBe(false);
      // mutant(OR): 부분 통과를 alive 로 오판(half-broken 배포 회귀) — 정본과 어긋남.
      expect(mutantIsAlive(partial)).toBe(true);
      expect(mutantIsAlive(partial)).not.toBe(isAlive(partial));
      // 원본 불변(재호출 시 여전히 AND 합취).
      expect(isAlive(partial)).toBe(false);
    });

    it("negative (b) — SPA 정규식 과광범위 drift 변별: isSpaHtml 을 항상 true 로 약화한 mutant 에서 'health 문자열/빈 body 는 SPA 아님' assert 실패", () => {
      // mutant(모델 사본): 임의 200 응답을 SPA 로 인정(항상 true).
      const mutantIsSpaHtml = (): boolean => true;
      // 정본: health 문자열/빈 body 는 SPA 아님.
      expect(isSpaHtml("Assessment-Agent")).toBe(false);
      expect(isSpaHtml("")).toBe(false);
      // mutant: 404/에러 페이지를 SPA 로 오인(회귀) — 정본과 어긋남.
      expect(mutantIsSpaHtml()).toBe(true);
      expect(mutantIsSpaHtml()).not.toBe(isSpaHtml("Assessment-Agent"));
      // 원본 불변.
      expect(isSpaHtml("Assessment-Agent")).toBe(false);
    });

    it("negative (c) — SPA 정규식 과협소 drift 변별: isSpaHtml 을 doctype 만(root-div 미인정)으로 좁힌 mutant 에서 'root-div 만 있어도 SPA' assert 실패", () => {
      // mutant(모델 사본): doctype 만 SPA 인정(108행 `|` OR 분기 손실).
      const mutantIsSpaHtml = (body: string): boolean =>
        /<!doctype html/i.test(body);
      const rootDivOnly = '<html><div id="root"></div></html>';
      // 정본: doctype 없이 root-div 만 있어도 SPA(정상 SPA).
      expect(isSpaHtml(rootDivOnly)).toBe(true);
      // mutant: root-div-only 정상 SPA 를 false-negative(회귀) — 정본과 어긋남.
      expect(mutantIsSpaHtml(rootDivOnly)).toBe(false);
      expect(mutantIsSpaHtml(rootDivOnly)).not.toBe(isSpaHtml(rootDivOnly));
      // 원본 불변.
      expect(isSpaHtml(rootDivOnly)).toBe(true);
    });

    it("negative (d) — §9 진단 body-누출 drift 변별: 조건명 대신 body 실값을 내는 mutant 진단에서 '진단은 조건만' assert 실패 + 실 소스 진단은 조건만", () => {
      const shellSource = readFileSync(DAILY_TEST_SH_PATH, "utf8");
      const secretBody = "SECRET-USER-DATA-leaked-body-xyz";
      const input: LivenessInput = {
        apiBody: secretBody, // 불일치 body(실값 — 진단에 누출 금지 대상).
        rootStatus: 200,
        rootBody: secretBody,
      };
      // 정본 진단: 조건만(body 실값 미포함).
      expect(livenessDiagnostic(input)).toBe("GET /api 불일치");
      expect(livenessDiagnostic(input)).not.toContain(secretBody);
      // mutant(모델 사본): 진단이 body 실값 전체를 내도록 변조 — 응답 body 가 진단 문자열에 실림.
      const mutantDiagnostic = (i: LivenessInput): string =>
        `GET /api 불일치 body=${i.apiBody}`;
      expect(mutantDiagnostic(input)).toContain(secretBody);
      // 실 소스 99·105·109행 진단 라인은 조건만(+`${body:-<none>}` placeholder) — body 전체 echo 미등장.
      const livenessSlice = extractLivenessFnSlice(shellSource);
      const failLines = livenessSlice
        .split("\n")
        .filter((l) => l.includes("step liveness: FAIL"));
      expect(failLines.length).toBe(3);
      failLines.forEach((l) => {
        // 진단은 조건/status/placeholder 만 — `$root`(root body 실값 dereference) 미등장.
        expect(l).not.toContain("$root");
      });
      // gate① 진단은 `${body:-<none>}` placeholder(실 body 대신) 만 노출.
      expect(livenessSlice).toContain("${body:-<none>}");
    });

    it("negative (e) — credential 누출 0: 추출/합성 문자열(앵커 텍스트·진단·SPA 정규식·입력 body)에 gh 토큰 어휘·실값 미등장(§9/REQ-059)", () => {
      const shellSource = readFileSync(DAILY_TEST_SH_PATH, "utf8");
      const livenessSlice = extractLivenessFnSlice(shellSource);
      const synthesized = [
        livenessDiagnostic(aliveInput()),
        livenessDiagnostic({ apiBody: "x", rootStatus: 200, rootBody: "y" }),
        String(isSpaHtml('<div id="root">')),
        JSON.stringify(aliveInput()),
        livenessSlice,
      ];
      const credentialPattern =
        /(ghp_|--token|GITHUB_TOKEN|GH_TOKEN|\bBearer\b|Authorization|\bsk-)/i;
      synthesized.forEach((s) => {
        expect(credentialPattern.test(s)).toBe(false);
      });
      // liveness 슬라이스는 SMOKE_PASSWORD/env 실값 dereference 미등장(liveness 는 credential 미사용).
      expect(livenessSlice).not.toContain("SMOKE_PASSWORD");
      expect(livenessSlice).not.toContain("$SMOKE_PASSWORD");
    });
  });

  describe("flow: 결정론 · no-mutation", () => {
    it("동일 입력(liveness input)으로 pure 함수를 두 번 호출하면 byte-identical(결정론)", () => {
      const input = aliveInput();
      expect(isAlive(input)).toBe(isAlive(input));
      expect(livenessDiagnostic(input)).toBe(livenessDiagnostic(input));
      expect(isSpaHtml('<div id="root">')).toBe(isSpaHtml('<div id="root">'));
    });

    it("동일 shell 소스로 앵커 추출·슬라이스 추출을 두 번 하면 deep-equal(결정론)", () => {
      const shellSource = readFileSync(DAILY_TEST_SH_PATH, "utf8");
      expect(extractLivenessConjunctionAnchors(shellSource)).toEqual(
        extractLivenessConjunctionAnchors(shellSource),
      );
      expect(extractLivenessFnSlice(shellSource)).toBe(
        extractLivenessFnSlice(shellSource),
      );
    });

    it("pure 함수·추출 보조 함수가 입력(liveness input·shell 소스)을 mutate 0(원본 불변)", () => {
      const shellSource = readFileSync(DAILY_TEST_SH_PATH, "utf8");
      const sourceSnapshot = shellSource;
      extractLivenessConjunctionAnchors(shellSource);
      extractLivenessFnSlice(shellSource);
      expect(shellSource).toBe(sourceSnapshot);

      const input = aliveInput();
      const inputSnapshot = { ...input };
      isAlive(input);
      livenessDiagnostic(input);
      isSpaHtml(input.rootBody);
      expect(input).toEqual(inputSnapshot);
    });
  });

  describe("dormant / non-gated 확인 — side-effect 0", () => {
    it("liveness 3-gate 모델이 env / 전역 상태 없이 순수하게 동작(non-gated — 입력은 파라미터로만)", () => {
      // 본 describe 가 실행된다는 것 자체가 describe.skip 0(항상 실행)의 런타임 증거.
      const envSnapshot = { ...process.env };
      const before = isAlive(aliveInput());
      // 실 process.env 를 mutate 해도 liveness 산출 불변 — 모델이 process.env 를 참조하지 않음(파라미터로만).
      Object.assign(process.env, { BASE_URL: "http://injected" });
      const after = isAlive(aliveInput());
      delete process.env.BASE_URL;
      expect(after).toBe(before);
      expect(Object.keys(process.env)).toEqual(Object.keys(envSnapshot));
    });

    it("파일 read 는 deploy/daily-test.sh 읽기만 — 실 bash/curl/git/HTTP 실행 0(추출 결과가 문자열이지 실행 산출물 아님)", () => {
      const shellSource = readFileSync(DAILY_TEST_SH_PATH, "utf8");
      expect(shellSource.startsWith("#!")).toBe(true);
      expect(hasLivenessFnAnchor(shellSource)).toBe(true);
    });
  });
});
