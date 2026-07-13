// realdata-e2e-daily-test-step-health-bounded-polling-deadline-timeout-loop-interval-hang-guard-last-body-none-diagnostic-contract.smoke-spec.ts
// — 실 평가 e2e step② `deploy/daily-test.sh` nightly runner 의 `step_health`(79~93행) 가 재배포 직후 기동
// 중인 배포 앱을 `GET /api == HEALTH_MESSAGE` 로 준비될 때까지 *유한하게* 폴링하는 **bounded-polling
// deadline/timeout 루프 계약** 을 실 shell 파일을 readFileSync 로 읽어(실행/source 0) 정적 검증하는
// non-gated build-time smoke (T-0952, PLAN.md 109행 🟢 실 평가 e2e step②).
//
// 봉함 불변식: **step_health 는 `now + HEALTH_TIMEOUT` 이라는 유한 deadline 안에서 strict `-lt` 배타-상한으로
// 폴링하며, 각 요청은 `--max-time 5` 로 개별 hang 을 막고 `|| true` 로 transient 실패를 non-fatal 하게(빈
// body→지속) 흡수하고, 재시도는 `sleep 3` 간격을 두며, body 가 기대 health 메시지와 일치하는 *첫* 폴링에서
// early-exit(return 0)하고, deadline 이 일치 없이 경과하면 마지막 body 를 `<none>` fallback 진단으로만 노출하며
// FAIL(return 1).** 이 불변식이 무인 nightly 가 "배포 앱의 준비-대기를 무한-hang 0·busy-loop 0 으로 유한
// 시간에 판정" 하는 신뢰의 핵심. 계약 6종(실 소스 유도 앵커):
//   (a) 유한-경계 deadline 산출(82행 `deadline=$(( $(date +%s) + HEALTH_TIMEOUT ))` — 시작 epoch +
//       HEALTH_TIMEOUT(기본 180, 45행 `${HEALTH_TIMEOUT:-180}`) = 폴링 종료 시각, 무한-대기 금지 경계) ·
//   (b) strict `-lt` 배타-상한 bounded 루프(83행 `while [ "$(date +%s)" -lt "$deadline" ]` — 현재 epoch <
//       deadline 인 동안만 폴링, deadline 도달 시 종료) ·
//   (c) per-request `--max-time 5` hang guard + `|| true` non-fatal(84행 `curl -s --max-time 5 "$BASE_URL/api"
//       2>/dev/null || true` — 각 요청 5초 상한 + 요청 실패 시 빈 body 로 폴링 지속) ·
//   (d) `sleep 3` 폴링 간격(89행 — busy-loop 금지) ·
//   (e) 첫-일치 early-exit(85~87행 `if [ "$body" = "$HEALTH_MESSAGE" ]; then log OK; return 0` — 첫 일치에서
//       즉시 OK, 나머지 poll 미실행) ·
//   (f) deadline 경과 TIMEOUT `<none>` fallback 진단(91~92행 `log "step health: TIMEOUT (마지막 응답=
//       '${body:-<none>}')"; return 1` — 마지막 body(빈/미설정 시 `<none>`)만 진단하고 FAIL).
//
// 전략(T-0947/T-0948/T-0949/T-0950/T-0951 동형): health 폴링 유도 표현을 정적 앵커로 추출 + bash 폴링 루프
// semantics 를 TS 순수 함수(`healthDeadline`·`isBeforeDeadline`·`healthPollOutcome`·`healthTimeoutDiagnostic`)로
// 동형 모델링해 유한-경계·배타-상한·hang-guard·non-fatal·간격·early-exit·TIMEOUT-fallback 불변식 assert.
// T-0792(HTTP path·method·status parity + HEALTH_MESSAGE↔APP_STATUS_MESSAGE byte-parity — 폴링 mechanics
// *명시 제외*)·T-0950(liveness 3-gate 합취 — health 를 superset 대조로만)·T-0947(cascade black-box gate)·
// T-0944~T-0949 와 distinct surface(step_health *내부* bounded-polling deadline/timeout 루프 mechanics).
//   🔥 실 health curl/HTTP/sleep/date/wall-clock/gh/git 0 · 폴링 분기 실행 0(non-gated, describe.skip 0) ·
//      process.env 읽기 0(입력은 pure 함수 파라미터) · credential 0(§9/REQ-059) · 새 dep 0(node fs/path) ·
//      src 변경 0(test-only) · deploy/daily-test.sh 읽기만(실행/source 0).
import { readFileSync } from "fs";
import * as path from "path";

// repo-root 경로 — test 실행 cwd 무관하게 robust 하게 해석(`__dirname` = test/smoke,
// 두 단계 위가 repo-root). `process.cwd()` 대신 `__dirname` 기준 상대로 고정한다.
const REPO_ROOT = path.resolve(__dirname, "../..");
const DAILY_TEST_SH_PATH = path.join(REPO_ROOT, "deploy/daily-test.sh");

// health-gate 기본 상수(45·48·89행 동형) — 실 bash 값의 TS mirror(실 env/date/sleep 읽기 0).
const HEALTH_MESSAGE = "Assessment-Agent"; // 48행 readonly HEALTH_MESSAGE.
const DEFAULT_HEALTH_TIMEOUT = 180; // 45행 `${HEALTH_TIMEOUT:-180}` default.
const POLL_INTERVAL_SEC = 3; // 89행 sleep 3.

// health 폴링 관측 시퀀스 입력 — 실 curl 산출(각 poll 의 응답 body)의 동형 모델.
// 실 HTTP/curl 요청 0 — 값은 함수 파라미터로만 주입(transient 실패는 빈 문자열로 표현).
interface HealthPollInput {
  polls: string[]; // 각 폴링에서 관측된 body(요청 실패 흡수 시 "").
  deadline: number; // 폴링 종료 절대 epoch(유한 경계).
  expectedMessage: string; // 성공 판정 기대 메시지(HEALTH_MESSAGE 동형).
  startEpoch?: number; // 폴링 시작 epoch(기본 0).
  intervalSec?: number; // 재시도 간격 초(기본 3 — sleep 3).
}

// health 폴링 결과 — return 0(ok:true, 첫 일치 index) / return 1(ok:false, 마지막 body).
interface HealthPollOutcome {
  ok: boolean;
  // 일치가 발생한 poll index(0-based). 미일치면 -1.
  matchedAtIndex: number;
  // 실제 소비한 poll 수(첫-일치 early-exit 증거 — 일치 이후 poll 은 미소비).
  polled: number;
  // 마지막으로 관측한 body(TIMEOUT 진단 입력 — 빈 요청이면 "").
  lastBody: string;
}

// ── TS 동형 pure 함수(정본) — daily-test.sh step_health(79~93행) 폴링 루프를 순수 함수로 모델링.
//    입력(숫자/배열)은 mutate 하지 않는다(읽기만). 실 bash/curl/date/sleep/env 읽기 0 — 입력은 파라미터.

// (a) healthDeadline(start, timeout): 82행 `deadline=$(( $(date +%s) + HEALTH_TIMEOUT ))` 동형 —
//     시작 epoch + timeout 초 = 폴링 종료 절대 시각(유한 경계). timeout 은 45행 default 180 또는 override.
function healthDeadline(startEpoch: number, timeoutSec: number): number {
  return startEpoch + timeoutSec;
}

// (b) isBeforeDeadline(now, deadline): 83행 `while [ "$(date +%s)" -lt "$deadline" ]` 동형 —
//     현재 epoch 가 deadline *미만*(strict `-lt` 배타 상한)이면 true(폴링 지속), deadline 도달/초과면
//     false(루프 종료). 경계(now == deadline)는 배타이므로 false.
function isBeforeDeadline(nowEpoch: number, deadline: number): boolean {
  return nowEpoch < deadline;
}

// (c)(d)(e) healthPollOutcome(input): bounded 폴링 루프 동형. 현재 epoch < deadline 인 동안만(배타 상한)
//     각 poll body 를 관측하고, body 가 expectedMessage 와 일치하는 *첫* poll 에서 즉시 early-exit
//     (ok:true, 나머지 poll 미소비 — return 0 동형). 빈 body(요청 실패)는 폴링을 중단하지 않고 지속
//     (`|| true` non-fatal 동형). 재시도마다 intervalSec(=sleep 3)만큼 시각 진행. deadline 이 일치 없이
//     경과하면 ok:false + 마지막 body 반환(return 1 동형).
function healthPollOutcome(input: HealthPollInput): HealthPollOutcome {
  const { polls, deadline, expectedMessage } = input;
  const intervalSec = input.intervalSec ?? POLL_INTERVAL_SEC;
  let now = input.startEpoch ?? 0;
  let lastBody = "";
  let polled = 0;
  for (let i = 0; i < polls.length; i++) {
    // bounded 루프: 현재 epoch < deadline 인 동안만(strict `-lt` 배타 상한 — 83행).
    if (!isBeforeDeadline(now, deadline)) break;
    const body = polls[i];
    lastBody = body; // 마지막 관측 body 갱신(빈 body 포함 — non-fatal 지속).
    polled++;
    if (body === expectedMessage) {
      // 첫-일치 early-exit(85~87행 return 0) — 나머지 poll 미소비.
      return { ok: true, matchedAtIndex: i, polled, lastBody };
    }
    now += intervalSec; // sleep 3 후 다음 폴링(시각 진행) — busy-loop 금지.
  }
  // deadline 경과(또는 poll 소진) — 일치 없음(91~92행 return 1).
  return { ok: false, matchedAtIndex: -1, polled, lastBody };
}

// (f) healthTimeoutDiagnostic(lastBody): 91행 `log "step health: TIMEOUT (마지막 응답='${body:-<none>}')"`
//     동형 — 마지막 body 를 진단에 노출하되, 빈/undefined 이면 `<none>` fallback(raw echo 0, §9-safe).
function healthTimeoutDiagnostic(lastBody: string | undefined): string {
  const shown = lastBody === undefined || lastBody === "" ? "<none>" : lastBody;
  return `step health: TIMEOUT (마지막 응답='${shown}')`;
}

// ── 정적 앵커 추출 보조 함수 (실 bash health 폴링 표현이 소스에 실재하는지) ──────────────

// step_health 함수 정의 앵커(79행) — `step_health() {`.
function hasHealthFnAnchor(shellSource: string): boolean {
  return shellSource.includes("step_health() {");
}

// deadline 산출 앵커(82행) — `deadline=$(( $(date +%s) + HEALTH_TIMEOUT ))`.
function hasDeadlineAnchor(shellSource: string): boolean {
  return shellSource.includes("deadline=$(( $(date +%s) + HEALTH_TIMEOUT ))");
}

// bounded 루프 앵커(83행) — strict `-lt` 배타 상한 while 루프.
function hasBoundedLoopAnchor(shellSource: string): boolean {
  return shellSource.includes('while [ "$(date +%s)" -lt "$deadline" ]');
}

// 요청 앵커(84행) — `curl -s --max-time 5 "$BASE_URL/api" 2>/dev/null || true`.
function hasRequestAnchor(shellSource: string): boolean {
  return shellSource.includes(
    'curl -s --max-time 5 "$BASE_URL/api" 2>/dev/null || true',
  );
}

// 성공 gate 앵커(85~87행) — `[ "$body" = "$HEALTH_MESSAGE" ]` + `return 0`.
function hasSuccessGateAnchor(shellSource: string): boolean {
  return (
    shellSource.includes('if [ "$body" = "$HEALTH_MESSAGE" ]; then') &&
    shellSource.includes("return 0")
  );
}

// 폴링 간격 앵커(89행) — `sleep 3`.
function hasSleepAnchor(shellSource: string): boolean {
  return shellSource.includes("sleep 3");
}

// TIMEOUT `<none>` fallback 진단 앵커(91~92행) — `마지막 응답='${body:-<none>}'` + `return 1`.
function hasTimeoutAnchor(shellSource: string): boolean {
  return (
    shellSource.includes(
      "step health: TIMEOUT (마지막 응답='${body:-<none>}')",
    ) && shellSource.includes("return 1")
  );
}

// HEALTH_TIMEOUT default 앵커(45행) — `HEALTH_TIMEOUT="${HEALTH_TIMEOUT:-180}"`.
function hasHealthTimeoutDefaultAnchor(shellSource: string): boolean {
  return shellSource.includes('HEALTH_TIMEOUT="${HEALTH_TIMEOUT:-180}"');
}

// 8종 health 폴링 유도 앵커가 모두 실재하는지 — 하나라도 부재면 명시적 실패(빈 결과 성공-위장 0).
function extractHealthPollAnchors(shellSource: string): {
  healthFn: boolean;
  deadline: boolean;
  boundedLoop: boolean;
  request: boolean;
  successGate: boolean;
  sleep: boolean;
  timeout: boolean;
  timeoutDefault: boolean;
} {
  return {
    healthFn: hasHealthFnAnchor(shellSource),
    deadline: hasDeadlineAnchor(shellSource),
    boundedLoop: hasBoundedLoopAnchor(shellSource),
    request: hasRequestAnchor(shellSource),
    successGate: hasSuccessGateAnchor(shellSource),
    sleep: hasSleepAnchor(shellSource),
    timeout: hasTimeoutAnchor(shellSource),
    timeoutDefault: hasHealthTimeoutDefaultAnchor(shellSource),
  };
}

// step_health 함수 본문 슬라이스(79행 정의 ~ 다음 함수 step_liveness 직전) — 요청 라인·guard 검사용.
function extractHealthFnSlice(shellSource: string): string {
  const start = shellSource.indexOf("step_health() {");
  if (start === -1) return "";
  const next = shellSource.indexOf("step_liveness() {", start);
  return next === -1
    ? shellSource.slice(start)
    : shellSource.slice(start, next);
}

// step_health 슬라이스에서 실 요청 라인(84행, `$BASE_URL/api` 폴링 라인)만 추출 — hang-guard/non-fatal 검사용.
function extractHealthRequestLine(shellSource: string): string {
  const slice = extractHealthFnSlice(shellSource);
  return (
    slice
      .split("\n")
      .find((l) => l.includes('curl -s --max-time 5 "$BASE_URL/api"')) ?? ""
  );
}

// per-request hang guard(`--max-time 5`) 존재 판정 — 요청 라인에 5초 상한이 있는지.
function hasPerRequestHangGuard(requestLine: string): boolean {
  return requestLine.includes("--max-time 5");
}

// non-fatal(`|| true`) 존재 판정 — 요청 실패를 빈 body 로 흡수(폴링 지속)하는지.
function hasNonFatalGuard(requestLine: string): boolean {
  return requestLine.includes("2>/dev/null || true");
}

// 정상 폴링 입력(deadline 충분히 커 모든 poll 소비 가능) — 실 curl 산출의 동형 placeholder.
function okPollInput(polls: string[]): HealthPollInput {
  return {
    polls,
    deadline: healthDeadline(0, DEFAULT_HEALTH_TIMEOUT),
    expectedMessage: HEALTH_MESSAGE,
  };
}

describe("realdata-e2e step② daily-test.sh step_health bounded-polling deadline/timeout 루프 contract smoke — 유한-경계 deadline + strict `-lt` 배타-상한 + `--max-time 5` hang guard + `|| true` non-fatal + `sleep 3` 간격 + first-match early-exit + TIMEOUT `<none>` fallback 진단 (T-0952)", () => {
  describe("Happy-path: step_health 폴링 앵커 정적 추출(pure 함수가 실 bash 폴링 루프를 mirror)", () => {
    it("함수 정의(79)·deadline(82)·bounded 루프(83)·요청(84)·성공 gate(85~87)·sleep 3(89)·TIMEOUT `<none>`(91~92)·HEALTH_TIMEOUT default(45)가 실 소스에 존재(8 앵커 전부 true)", () => {
      const shellSource = readFileSync(DAILY_TEST_SH_PATH, "utf8");
      const anchors = extractHealthPollAnchors(shellSource);
      expect(anchors.healthFn).toBe(true);
      expect(anchors.deadline).toBe(true);
      expect(anchors.boundedLoop).toBe(true);
      expect(anchors.request).toBe(true);
      expect(anchors.successGate).toBe(true);
      expect(anchors.sleep).toBe(true);
      expect(anchors.timeout).toBe(true);
      expect(anchors.timeoutDefault).toBe(true);
    });
  });

  describe("Happy-path: healthDeadline(start + timeout)", () => {
    it("healthDeadline 는 startEpoch + timeoutSec 반환(82행 산술 동형) — default 180·override 60 각각 실증", () => {
      // default 180(45행) — 시작 1_000_000 → deadline 1_000_180.
      expect(healthDeadline(1_000_000, DEFAULT_HEALTH_TIMEOUT)).toBe(1_000_180);
      // override 60 — 시작 1_000_000 → deadline 1_000_060.
      expect(healthDeadline(1_000_000, 60)).toBe(1_000_060);
      // deadline 은 항상 시작 + 해당 timeout(유한 경계).
      expect(healthDeadline(0, 180)).toBe(180);
      expect(healthDeadline(500, 0)).toBe(500);
    });
  });

  describe("Happy-path: 준비된 앱 — 첫-일치 early-exit → OK", () => {
    it("첫 poll 즉시 일치 → ok:true, matchedAtIndex:0, polled:1(나머지 poll 미소비 — return 0 동형)", () => {
      const outcome = healthPollOutcome(
        okPollInput([HEALTH_MESSAGE, HEALTH_MESSAGE, HEALTH_MESSAGE]),
      );
      expect(outcome.ok).toBe(true);
      expect(outcome.matchedAtIndex).toBe(0);
      // 첫 poll 에서 early-exit — 뒤의 poll 은 소비하지 않음.
      expect(outcome.polled).toBe(1);
      expect(outcome.lastBody).toBe(HEALTH_MESSAGE);
    });

    it("3번째 poll 에서 일치(앞 2회 미준비 body) → ok:true, matchedAtIndex:2, polled:3(첫 일치에서 멈춤)", () => {
      const outcome = healthPollOutcome(
        okPollInput(["starting", "starting", HEALTH_MESSAGE, HEALTH_MESSAGE]),
      );
      expect(outcome.ok).toBe(true);
      expect(outcome.matchedAtIndex).toBe(2);
      // 3회 폴링 후 일치 — 4번째 poll 은 미소비(early-exit).
      expect(outcome.polled).toBe(3);
    });
  });

  describe("Happy-path: isBeforeDeadline(strict `-lt` 배타 상한)", () => {
    it("nowEpoch < deadline → true, nowEpoch == deadline(경계 정확 도달) 및 nowEpoch > deadline → false(83행 strict `-lt` 배타)", () => {
      const deadline = 1_000_180;
      // deadline-1 → 아직 폴링 지속(true).
      expect(isBeforeDeadline(deadline - 1, deadline)).toBe(true);
      // deadline 정확 도달 → 루프 종료(false — 배타 상한).
      expect(isBeforeDeadline(deadline, deadline)).toBe(false);
      // deadline+1 → 종료(false).
      expect(isBeforeDeadline(deadline + 1, deadline)).toBe(false);
    });
  });

  describe("branch: hang guard(`--max-time 5`) + non-fatal(`|| true`) 정적 대조", () => {
    it("84행 요청 라인이 `--max-time 5`(per-request hang 상한) AND `2>/dev/null || true`(non-fatal) 둘 다 포함 — 같은 라인에 결합", () => {
      const shellSource = readFileSync(DAILY_TEST_SH_PATH, "utf8");
      const requestLine = extractHealthRequestLine(shellSource);
      expect(requestLine).not.toBe("");
      // 두 guard 가 각각 존재.
      expect(hasPerRequestHangGuard(requestLine)).toBe(true);
      expect(hasNonFatalGuard(requestLine)).toBe(true);
      // 같은 요청 라인에 결합(hang guard + non-fatal 동시).
      expect(requestLine).toContain(
        '--max-time 5 "$BASE_URL/api" 2>/dev/null || true',
      );
    });
  });

  describe("branch: transient 요청 실패 → 빈 body → 폴링 지속(non-fatal)", () => {
    it("중간 poll 이 빈 body(요청 실패 흡수)여도 폴링 지속 → 이후 일치 poll 에서 ok:true, matchedAtIndex:2(`|| true` 동형)", () => {
      const outcome = healthPollOutcome(okPollInput(["", "", HEALTH_MESSAGE]));
      expect(outcome.ok).toBe(true);
      // 빈 body 가 폴링을 중단하지 않음 — 3번째 poll 에서 일치.
      expect(outcome.matchedAtIndex).toBe(2);
      expect(outcome.polled).toBe(3);
    });

    it("모든 poll 이 빈 body(일치 0) → ok:false + 마지막 body='' (transient 실패 지속하나 준비 안 됨)", () => {
      const outcome = healthPollOutcome(okPollInput(["", "", ""]));
      expect(outcome.ok).toBe(false);
      expect(outcome.matchedAtIndex).toBe(-1);
      expect(outcome.lastBody).toBe("");
    });
  });

  describe("branch: deadline 경과 → TIMEOUT + last-body `<none>` fallback 진단", () => {
    it("일치 없이 poll 소진(deadline 경과) → ok:false, lastBody 반환(return 1 동형) + TIMEOUT 진단은 lastBody 노출", () => {
      const outcome = healthPollOutcome(okPollInput(["boot", "boot"]));
      expect(outcome.ok).toBe(false);
      expect(outcome.lastBody).toBe("boot");
      // lastBody 가 비어있지 않으면 그대로 진단(91행 `${body:-<none>}` — body 존재).
      expect(healthTimeoutDiagnostic(outcome.lastBody)).toBe(
        "step health: TIMEOUT (마지막 응답='boot')",
      );
    });

    it("deadline 이 시작 시각 이하면 폴링 0회(bounded 루프 즉시 종료) → ok:false, polled:0, lastBody='' → `<none>` fallback", () => {
      // deadline == startEpoch → isBeforeDeadline(start, start)=false → 루프 미진입.
      const outcome = healthPollOutcome({
        polls: [HEALTH_MESSAGE, HEALTH_MESSAGE],
        deadline: 0,
        expectedMessage: HEALTH_MESSAGE,
        startEpoch: 0,
      });
      expect(outcome.ok).toBe(false);
      expect(outcome.polled).toBe(0);
      expect(outcome.lastBody).toBe("");
      // 빈 lastBody → `<none>` fallback(91행 `${body:-<none>}`).
      expect(healthTimeoutDiagnostic(outcome.lastBody)).toBe(
        "step health: TIMEOUT (마지막 응답='<none>')",
      );
    });

    it("healthTimeoutDiagnostic: 비어있지 않은 last-body 는 그대로, 빈/undefined 는 `<none>` fallback(91행 `${body:-<none>}` 동형)", () => {
      // 비어있지 않음 → 그대로 노출.
      expect(healthTimeoutDiagnostic("<some>")).toBe(
        "step health: TIMEOUT (마지막 응답='<some>')",
      );
      // 빈 문자열 → `<none>` fallback.
      expect(healthTimeoutDiagnostic("")).toBe(
        "step health: TIMEOUT (마지막 응답='<none>')",
      );
      // undefined(미설정) → `<none>` fallback.
      expect(healthTimeoutDiagnostic(undefined)).toBe(
        "step health: TIMEOUT (마지막 응답='<none>')",
      );
    });
  });

  describe("Error path / negative cases 충분 cover", () => {
    it("error path — shell 파일 부재 경로 → readFileSync throw(silent 0-byte fallback 0)", () => {
      const badPath = path.join(REPO_ROOT, "deploy/__does_not_exist__.sh");
      expect(() => readFileSync(badPath, "utf8")).toThrow();
    });

    it("error path — health 폴링 앵커 부재 시 명시적 실패(빈 매칭을 pass 로 오통과 0)", () => {
      // 앵커를 제거한 합성 소스(health 유도 표현 부재)에서 추출기가 false / 빈 슬라이스를 낸다.
      const emptySource = "#!/usr/bin/env bash\necho hello\n";
      const anchors = extractHealthPollAnchors(emptySource);
      expect(anchors.healthFn).toBe(false);
      expect(anchors.deadline).toBe(false);
      expect(anchors.boundedLoop).toBe(false);
      expect(anchors.request).toBe(false);
      expect(anchors.successGate).toBe(false);
      expect(anchors.timeout).toBe(false);
      expect(anchors.timeoutDefault).toBe(false);
      // 슬라이스·요청 라인 추출도 빈 결과(성공-위장 0).
      expect(extractHealthFnSlice(emptySource)).toBe("");
      expect(extractHealthRequestLine(emptySource)).toBe("");
      // 실 소스는 반대로 전부 존재 — 부재/실재를 변별함을 대비로 실증.
      const realAnchors = extractHealthPollAnchors(
        readFileSync(DAILY_TEST_SH_PATH, "utf8"),
      );
      expect(realAnchors.healthFn).toBe(true);
      expect(realAnchors.boundedLoop).toBe(true);
      expect(realAnchors.timeout).toBe(true);
    });

    it("negative (a) — 유한-경계 deadline 제거 drift 변별: isBeforeDeadline 을 항상 true(deadline 무시)로 약화한 mutant 에서 'now == deadline 이면 종료(false)' assert 실패", () => {
      // mutant(모델 사본): deadline 을 무시하고 항상 폴링 지속(무한 루프 회귀).
      const mutantIsBeforeDeadline = (): boolean => true;
      const deadline = 1_000_180;
      // 정본: deadline 정확 도달 시 종료(false — 유한 경계).
      expect(isBeforeDeadline(deadline, deadline)).toBe(false);
      // mutant: deadline 도달에도 계속 true(무한-hang 회귀) — 정본과 어긋남.
      expect(mutantIsBeforeDeadline()).toBe(true);
      expect(mutantIsBeforeDeadline()).not.toBe(
        isBeforeDeadline(deadline, deadline),
      );
      // 원본 불변.
      expect(isBeforeDeadline(deadline, deadline)).toBe(false);
    });

    it("negative (b) — strict `-lt` → 포함(`<=`) drift 변별: isBeforeDeadline 을 `now <= deadline`(배타→포함)으로 mutate 한 사본에서 'deadline 정확 도달 시 false(배타)' assert 실패", () => {
      // mutant(모델 사본): 배타 상한(`<`)을 포함(`<=`)으로 약화 — deadline 순간에도 1회 더 폴링.
      const mutantIsBeforeDeadline = (now: number, deadline: number): boolean =>
        now <= deadline;
      const deadline = 1_000_180;
      // 정본: deadline 정확 도달 → false(배타 상한 — 루프 종료).
      expect(isBeforeDeadline(deadline, deadline)).toBe(false);
      // mutant: deadline 도달에도 true(경계 우회 — 배타 상한 상실) — 정본과 어긋남.
      expect(mutantIsBeforeDeadline(deadline, deadline)).toBe(true);
      expect(mutantIsBeforeDeadline(deadline, deadline)).not.toBe(
        isBeforeDeadline(deadline, deadline),
      );
      // deadline-1 은 양쪽 동일(true).
      expect(mutantIsBeforeDeadline(deadline - 1, deadline)).toBe(
        isBeforeDeadline(deadline - 1, deadline),
      );
      // 원본 불변.
      expect(isBeforeDeadline(deadline, deadline)).toBe(false);
    });

    it("negative (c) — hang guard(`--max-time 5`) 누락 drift 변별: 요청 라인에서 `--max-time 5` 를 뺀 mutant 라인에서 'per-request hang guard 존재' assert 실패", () => {
      const shellSource = readFileSync(DAILY_TEST_SH_PATH, "utf8");
      const requestLine = extractHealthRequestLine(shellSource);
      // 정본: 요청 라인에 per-request hang guard 존재.
      expect(hasPerRequestHangGuard(requestLine)).toBe(true);
      // mutant(모델 사본): `--max-time 5 ` 제거(개별 요청 무한-hang 재도입 회귀).
      const mutantLine = requestLine.replace("--max-time 5 ", "");
      expect(hasPerRequestHangGuard(mutantLine)).toBe(false);
      expect(hasPerRequestHangGuard(mutantLine)).not.toBe(
        hasPerRequestHangGuard(requestLine),
      );
      // 원본 불변(replace 는 사본 반환).
      expect(hasPerRequestHangGuard(requestLine)).toBe(true);
    });

    it("negative (d) — non-fatal(`|| true`) 제거 → transient 실패가 폴링 중단 drift 변별: 빈 body 만나면 즉시 중단하는 mutant 에서 '빈 body 지속 → 이후 일치 OK' assert 실패", () => {
      // mutant(모델 사본): `|| true` 제거 동형 — 빈 body(요청 실패) 만나면 즉시 폴링 중단(FAIL).
      const mutantPollOutcome = (input: HealthPollInput): HealthPollOutcome => {
        const { polls, expectedMessage } = input;
        let lastBody = "";
        let polled = 0;
        for (let i = 0; i < polls.length; i++) {
          const body = polls[i];
          lastBody = body;
          polled++;
          // non-fatal 제거: 빈 body 를 장애로 오판해 즉시 중단.
          if (body === "") {
            return { ok: false, matchedAtIndex: -1, polled, lastBody };
          }
          if (body === expectedMessage) {
            return { ok: true, matchedAtIndex: i, polled, lastBody };
          }
        }
        return { ok: false, matchedAtIndex: -1, polled, lastBody };
      };
      const input = okPollInput(["", "", HEALTH_MESSAGE]);
      // 정본(non-fatal): 빈 body 지속 → 3번째 일치 poll 에서 ok:true.
      expect(healthPollOutcome(input).ok).toBe(true);
      expect(healthPollOutcome(input).matchedAtIndex).toBe(2);
      // mutant: 첫 빈 body 에서 즉시 중단(정상 부팅 지연을 장애로 오판 — false-negative 회귀).
      expect(mutantPollOutcome(input).ok).toBe(false);
      expect(mutantPollOutcome(input).ok).not.toBe(healthPollOutcome(input).ok);
      // 원본 불변.
      expect(healthPollOutcome(input).ok).toBe(true);
    });

    it("negative (e) — TIMEOUT `<none>` fallback → raw echo drift 변별: fallback 없이 빈 body 를 그대로 내는 mutant 에서 '빈 last-body 는 `<none>`' assert 실패 + 실 소스 91행이 `${body:-<none>}`", () => {
      // mutant(모델 사본): `<none>` fallback 제거 — 빈 body 를 그대로 raw echo(진단 모호/§9 위험).
      const mutantDiagnostic = (lastBody: string): string =>
        `step health: TIMEOUT (마지막 응답='${lastBody}')`;
      // 정본: 빈 last-body → `<none>` fallback.
      expect(healthTimeoutDiagnostic("")).toBe(
        "step health: TIMEOUT (마지막 응답='<none>')",
      );
      // mutant: 빈 body 를 그대로 노출(마지막 응답='' — 모호) — 정본과 어긋남.
      expect(mutantDiagnostic("")).toBe(
        "step health: TIMEOUT (마지막 응답='')",
      );
      expect(mutantDiagnostic("")).not.toBe(healthTimeoutDiagnostic(""));
      // 실 소스 91행이 `${body:-<none>}` fallback 임을 정적 확인.
      const shellSource = readFileSync(DAILY_TEST_SH_PATH, "utf8");
      expect(shellSource).toContain("${body:-<none>}");
      // 원본 불변.
      expect(healthTimeoutDiagnostic("")).toBe(
        "step health: TIMEOUT (마지막 응답='<none>')",
      );
    });

    it("negative (f) — credential/secret 누출 0: 추출/합성 문자열(앵커·진단·poll body·deadline·슬라이스)에 gh 토큰 어휘·credential 실값 미등장(§9/REQ-059)", () => {
      const shellSource = readFileSync(DAILY_TEST_SH_PATH, "utf8");
      const healthSlice = extractHealthFnSlice(shellSource);
      const synthesized = [
        healthTimeoutDiagnostic(""),
        healthTimeoutDiagnostic("boot"),
        String(healthDeadline(1_000_000, DEFAULT_HEALTH_TIMEOUT)),
        String(isBeforeDeadline(1, 2)),
        JSON.stringify(healthPollOutcome(okPollInput(["", HEALTH_MESSAGE]))),
        JSON.stringify(extractHealthPollAnchors(shellSource)),
        healthSlice,
        extractHealthRequestLine(shellSource),
      ];
      const credentialPattern =
        /(ghp_|--token|GITHUB_TOKEN|GH_TOKEN|\bBearer\b|Authorization|\bsk-)/i;
      synthesized.forEach((s) => {
        expect(credentialPattern.test(s)).toBe(false);
      });
      // TIMEOUT 진단은 last-body(HEALTH_MESSAGE app-status 또는 `<none>`)만 노출 — credential 미포함.
      expect(healthTimeoutDiagnostic(HEALTH_MESSAGE)).not.toMatch(
        credentialPattern,
      );
    });
  });

  describe("flow: 결정론 · no-mutation", () => {
    it("동일 입력(poll 시퀀스·deadline·start/timeout)으로 pure 함수를 두 번 호출하면 deep-equal(결정론)", () => {
      const input = okPollInput(["", "", HEALTH_MESSAGE]);
      expect(healthPollOutcome(input)).toEqual(healthPollOutcome(input));
      expect(healthDeadline(500, 180)).toBe(healthDeadline(500, 180));
      expect(isBeforeDeadline(1, 2)).toBe(isBeforeDeadline(1, 2));
      expect(healthTimeoutDiagnostic("")).toBe(healthTimeoutDiagnostic(""));
    });

    it("동일 shell 소스로 앵커 추출·슬라이스·요청 라인 추출을 두 번 하면 deep-equal(결정론)", () => {
      const shellSource = readFileSync(DAILY_TEST_SH_PATH, "utf8");
      expect(extractHealthPollAnchors(shellSource)).toEqual(
        extractHealthPollAnchors(shellSource),
      );
      expect(extractHealthFnSlice(shellSource)).toBe(
        extractHealthFnSlice(shellSource),
      );
      expect(extractHealthRequestLine(shellSource)).toBe(
        extractHealthRequestLine(shellSource),
      );
    });

    it("pure 함수·추출 보조 함수가 입력(poll 시퀀스·shell 소스)을 mutate 0(원본 불변)", () => {
      const shellSource = readFileSync(DAILY_TEST_SH_PATH, "utf8");
      const sourceSnapshot = shellSource;
      extractHealthPollAnchors(shellSource);
      extractHealthFnSlice(shellSource);
      extractHealthRequestLine(shellSource);
      expect(shellSource).toBe(sourceSnapshot);

      const polls = ["", "", HEALTH_MESSAGE];
      const pollsSnapshot = [...polls];
      const input = okPollInput(polls);
      healthPollOutcome(input);
      expect(polls).toEqual(pollsSnapshot);
    });
  });

  describe("dormant / non-gated 확인 — side-effect 0", () => {
    it("health 폴링 모델이 env / 전역 상태 없이 순수하게 동작(non-gated — 입력은 파라미터로만)", () => {
      // 본 describe 가 실행된다는 것 자체가 describe.skip 0(항상 실행)의 런타임 증거.
      const envSnapshot = { ...process.env };
      const before = healthPollOutcome(okPollInput([HEALTH_MESSAGE])).ok;
      // 실 process.env 를 mutate 해도 산출 불변 — 모델이 process.env 를 참조하지 않음(파라미터로만).
      Object.assign(process.env, { HEALTH_TIMEOUT: "9999" });
      const after = healthPollOutcome(okPollInput([HEALTH_MESSAGE])).ok;
      delete process.env.HEALTH_TIMEOUT;
      expect(after).toBe(before);
      expect(Object.keys(process.env)).toEqual(Object.keys(envSnapshot));
    });

    it("파일 read 는 deploy/daily-test.sh 읽기만 — 실 curl/HTTP/sleep/date/git 실행 0(추출 결과가 문자열이지 실행 산출물 아님)", () => {
      const shellSource = readFileSync(DAILY_TEST_SH_PATH, "utf8");
      expect(shellSource.startsWith("#!")).toBe(true);
      expect(hasHealthFnAnchor(shellSource)).toBe(true);
    });
  });
});
