// realdata-e2e-daily-test-machine-json-scalar-provenance-ts-single-source-logpath-crossfield-gitsha-unknown-fallback-contract.smoke-spec.ts
// — 실 평가 e2e step④ `deploy/daily-test.sh` nightly runner 가 방출하는 머신 요약 JSON 의
// **스칼라 필드 provenance 계약**(ts·gitSha·logPath 가 어떻게 산출·직렬화되는가)을 실 shell 파일을
// readFileSync 로 읽어(실행/source 0) 정적 검증하는 non-gated build-time smoke
// (T-0948, PLAN.md 109행 🟢 실 평가 e2e step④).
//
// 봉함 불변식: **머신 JSON 의 스칼라 필드는 단일 소스(TS)로부터 결정론적으로 유도되고(ts↔로그
// 파일명 byte-identical), cross-field 로 로그 파일을 역추적 가능하며(logPath basename↔ts), git
// 실패에 내성(gitSha=unknown non-fatal)이다.** provenance 계약 4종(실 소스 유도 앵커):
//   (a) `ts` single-source(51행 `TS="$(date -u +%Y%m%dT%H%M%SZ)"` 1회 산출 → 52행 LOG_FILE·
//       376행 JSON ts·277행 시작 로그가 동일 $TS 재사용, 형식 `^\d{8}T\d{6}Z$` compact UTC Z) ·
//   (b) `logPath` ↔ `ts` cross-field(375행 JSON logPath == `$LOG_DIR/daily-$TS.log` →
//       basename(logPath) == `daily-${ts}.log` 이므로 JSON→로그 결정론 역추적) ·
//   (c) `LOG_DIR` 유도(50행 `LOG_DIR="$REPO_DIR/deploy/logs"` · 53행 RESULT_JSON 고정 basename) ·
//   (d) `gitSha` unknown-fallback(365행 `... rev-parse --short HEAD 2>/dev/null || echo unknown` →
//       git 실패 시 literal `unknown`, non-fatal, `--short` abbreviated).
//
// 전략(T-0791/T-0944/T-0946/T-0947 동형): 스칼라 유도 표현을 정적 앵커로 추출 + bash 유도 semantics 를
// TS 순수 함수(`logFileNameFromTs`·`deriveLogPath`·`isCompactUtcTs`·`resolveGitSha`)로 동형 모델링해
// provenance 불변식 assert. T-0791(6-키 schema·failedStep 직렬화 분기)과 distinct surface(스칼라 값
// 산출 provenance). T-0944(집계 값)·T-0945(dual-sink 방출)·T-0946(prune)·T-0947(cascade) 상보.
//   🔥 실 redeploy/HTTP/jest spawn/gh/git/date 0 · gating 분기 실행 0(non-gated, describe.skip 0) ·
//      process.env 읽기 0 · credential 0(§9/REQ-059) · 새 dep 0(node fs/path) · src 변경 0(test-only).
import { readFileSync } from "fs";
import * as path from "path";

// repo-root 경로 — test 실행 cwd 무관하게 robust 하게 해석(`__dirname` = test/smoke,
// 두 단계 위가 repo-root). `process.cwd()` 대신 `__dirname` 기준 상대로 고정한다.
const REPO_ROOT = path.resolve(__dirname, "../..");
const DAILY_TEST_SH_PATH = path.join(REPO_ROOT, "deploy/daily-test.sh");

// ── TS 동형 pure 함수(정본) — daily-test.sh 스칼라 유도(50/51/52/53/365/375행)를 순수 함수로 모델링.
//    입력(문자열)은 mutate 하지 않는다(읽기만). 실 date/git 실행 0 — ts/rawSha 는 함수 파라미터.

// (a) ts single-source: LOG_FILE 파일명은 `daily-${ts}.log`(52행) — 동일 $TS 재사용.
function logFileNameFromTs(ts: string): string {
  return `daily-${ts}.log`;
}

// (b)+(c) logPath 유도: `${repoDir}/deploy/logs/daily-${ts}.log`(50행 LOG_DIR + 52행 LOG_FILE).
function deriveLogPath(repoDir: string, ts: string): string {
  return `${repoDir}/deploy/logs/${logFileNameFromTs(ts)}`;
}

// LOG_DIR 유도(50행) — `${repoDir}/deploy/logs`. RESULT_JSON basename(53행)은 고정 latest-result.json.
function deriveLogDir(repoDir: string): string {
  return `${repoDir}/deploy/logs`;
}

// (a) ts 형식 검증: compact UTC Z(`YYYYMMDDTHHMMSSZ`, 구분자 없음). 51행 `date -u +%Y%m%dT%H%M%SZ` 산출물.
function isCompactUtcTs(ts: string): boolean {
  return /^\d{8}T\d{6}Z$/.test(ts);
}

// (d) gitSha unknown-fallback(365행): git 성공 시 abbreviated SHA, 실패 시 literal `unknown`(빈 문자열 아님).
function resolveGitSha(rawSha: string, gitFailed: boolean): string {
  return gitFailed ? "unknown" : rawSha;
}

// 머신 JSON 한 건에서 사람용 로그 파일명 역추적: basename(logPath)(375행 logPath → 무인 routine 상관).
function logBasename(logPath: string): string {
  return path.posix.basename(logPath);
}

// ── 정적 앵커 추출 보조 함수 (실 bash 스칼라 유도 표현이 소스에 실재하는지) ──────────────────

// (c) LOG_DIR 유도 앵커(50행) — `LOG_DIR="$REPO_DIR/deploy/logs"`.
function hasLogDirAnchor(shellSource: string): boolean {
  return shellSource.includes('LOG_DIR="$REPO_DIR/deploy/logs"');
}

// (a) ts single-source 앵커(51행) — `TS="$(date -u +%Y%m%dT%H%M%SZ)"`. compact UTC Z 포맷 리터럴.
function hasTsSingleSourceAnchor(shellSource: string): boolean {
  return shellSource.includes('TS="$(date -u +%Y%m%dT%H%M%SZ)"');
}

// (a) LOG_FILE 이 동일 $TS 재사용 앵커(52행) — `LOG_FILE="$LOG_DIR/daily-$TS.log"`(별도 date 재호출 아님).
function hasLogFileReuseTsAnchor(shellSource: string): boolean {
  return shellSource.includes('LOG_FILE="$LOG_DIR/daily-$TS.log"');
}

// (c) RESULT_JSON 고정 basename 앵커(53행) — `RESULT_JSON="$LOG_DIR/latest-result.json"`(distinct).
function hasResultJsonAnchor(shellSource: string): boolean {
  return shellSource.includes('RESULT_JSON="$LOG_DIR/latest-result.json"');
}

// (d) gitSha `--short` + `|| echo unknown` fallback 앵커(365행) — 빈 문자열 `""` 아님.
function hasGitShaFallbackAnchor(shellSource: string): boolean {
  return shellSource.includes(
    'GIT_SHA="$(git -C "$REPO_DIR" rev-parse --short HEAD 2>/dev/null || echo unknown)"',
  );
}

// (b) printf 머신 JSON 의 ts·logPath 스칼라 slot 앵커(375행) — `"ts":"%s"` · `"logPath":"%s"`.
function hasPrintfScalarSlotAnchor(shellSource: string): boolean {
  return (
    shellSource.includes('"ts":"%s"') && shellSource.includes('"logPath":"%s"')
  );
}

// 4종 스칼라 유도 앵커가 모두 실재하는지 — 하나라도 부재면 명시적 실패(빈 결과 성공-위장 0).
function extractScalarProvenanceAnchors(shellSource: string): {
  logDir: boolean;
  tsSingleSource: boolean;
  logFileReuseTs: boolean;
  resultJson: boolean;
  gitShaFallback: boolean;
  printfScalarSlot: boolean;
} {
  return {
    logDir: hasLogDirAnchor(shellSource),
    tsSingleSource: hasTsSingleSourceAnchor(shellSource),
    logFileReuseTs: hasLogFileReuseTsAnchor(shellSource),
    resultJson: hasResultJsonAnchor(shellSource),
    gitShaFallback: hasGitShaFallbackAnchor(shellSource),
    printfScalarSlot: hasPrintfScalarSlotAnchor(shellSource),
  };
}

// 정상 nightly TS 예시(실 date 실행 0 — 함수 파라미터로만 표현).
const SAMPLE_TS = "20260713T020000Z";
const SAMPLE_REPO = "/home/pi/assessment-agent";

describe("realdata-e2e step④ daily-test.sh 머신 JSON scalar-value provenance contract smoke — ts single-source · logPath↔ts cross-field · gitSha unknown-fallback · LOG_DIR 유도 (T-0948)", () => {
  describe("Happy-path: ts single-source 정적 추출", () => {
    it("실 deploy/daily-test.sh 를 읽어 51행 TS 산출·52행 LOG_FILE 이 동일 $TS 재사용(별도 date 재호출 아님)임을 정적 확인", () => {
      const shellSource = readFileSync(DAILY_TEST_SH_PATH, "utf8");
      // 51행: TS 는 date -u +%Y%m%dT%H%M%SZ 로 1회 산출(compact UTC Z 포맷 리터럴).
      expect(hasTsSingleSourceAnchor(shellSource)).toBe(true);
      // 52행: LOG_FILE 은 $TS 를 재사용($( date ...) 재호출 아님) — single-source 앵커.
      expect(hasLogFileReuseTsAnchor(shellSource)).toBe(true);
      // LOG_FILE 정의에 별도 date 재호출($(date 이 LOG_FILE 라인에 없음)이 없음을 실증.
      const logFileLine = shellSource
        .split("\n")
        .find((l) => l.startsWith("LOG_FILE="));
      expect(logFileLine).toBeDefined();
      expect(logFileLine).toContain("$TS");
      expect(logFileLine).not.toContain("date");
    });
  });

  describe("Happy-path: 스칼라 유도 앵커 정적 추출(TS pure 함수가 실 bash 유도를 mirror)", () => {
    it("LOG_DIR(50)·RESULT_JSON(53)·gitSha fallback(365)·printf 스칼라 slot(375)이 실 소스에 존재(6 앵커 전부 true)", () => {
      const shellSource = readFileSync(DAILY_TEST_SH_PATH, "utf8");
      const anchors = extractScalarProvenanceAnchors(shellSource);
      expect(anchors.logDir).toBe(true);
      expect(anchors.tsSingleSource).toBe(true);
      expect(anchors.logFileReuseTs).toBe(true);
      expect(anchors.resultJson).toBe(true);
      expect(anchors.gitShaFallback).toBe(true);
      expect(anchors.printfScalarSlot).toBe(true);
    });
  });

  describe("Happy-path: ts single-source 재사용 model(logFileNameFromTs·deriveLogPath)", () => {
    it("logFileNameFromTs(ts) 는 daily-${ts}.log, deriveLogPath(repoDir, ts) 는 ${repoDir}/deploy/logs/daily-${ts}.log 를 결정론적으로 유도", () => {
      expect(logFileNameFromTs(SAMPLE_TS)).toBe("daily-20260713T020000Z.log");
      expect(deriveLogPath(SAMPLE_REPO, SAMPLE_TS)).toBe(
        "/home/pi/assessment-agent/deploy/logs/daily-20260713T020000Z.log",
      );
      // deriveLogPath 는 deriveLogDir 하위(daily-<ts>.log) — single-source TS 로부터 유도.
      expect(deriveLogPath(SAMPLE_REPO, SAMPLE_TS)).toBe(
        `${deriveLogDir(SAMPLE_REPO)}/${logFileNameFromTs(SAMPLE_TS)}`,
      );
    });
  });

  describe("Happy-path: isCompactUtcTs 형식 검증(51행 date 포맷 정합)", () => {
    it("compact UTC Z(`^\\d{8}T\\d{6}Z$`)만 true, 구분자 포함·Z 누락·소수초 포함은 false", () => {
      // 51행 date -u +%Y%m%dT%H%M%SZ 가 산출하는 형식.
      expect(isCompactUtcTs("20260713T020000Z")).toBe(true);
      expect(isCompactUtcTs(SAMPLE_TS)).toBe(true);
      // 구분자 포함(ISO extended) — false.
      expect(isCompactUtcTs("2026-07-13T02:00:00Z")).toBe(false);
      // Z 누락 — false.
      expect(isCompactUtcTs("20260713T020000")).toBe(false);
      // 소수초 포함 — false.
      expect(isCompactUtcTs("20260713T020000.123Z")).toBe(false);
      // 빈 문자열 — false.
      expect(isCompactUtcTs("")).toBe(false);
      // 소문자 z — false(정규식 대문자 Z 강제).
      expect(isCompactUtcTs("20260713T020000z")).toBe(false);
    });
  });

  describe("branch: logPath ↔ ts cross-field 역추적", () => {
    it("머신 JSON 한 건 { ts, logPath } 에서 basename(logPath) == daily-${ts}.log(JSON→로그 결정론 역추적)", () => {
      const ts = SAMPLE_TS;
      const machineJson = {
        ts,
        logPath: deriveLogPath(SAMPLE_REPO, ts),
      };
      // cross-field 불변식: basename(logPath) 의 TS 가 ts 필드와 byte-identical.
      expect(logBasename(machineJson.logPath)).toBe(logFileNameFromTs(ts));
      expect(logBasename(machineJson.logPath)).toBe(`daily-${ts}.log`);
      // ts 값이 logPath basename 에 embed 됨을 실증.
      expect(logBasename(machineJson.logPath)).toContain(ts);
    });

    it("다른 TS 두 건은 서로 다른 logPath basename → 각자 자기 ts 로 역추적(상호 혼선 0)", () => {
      const tsA = "20260713T020000Z";
      const tsB = "20260714T140000Z";
      const pathA = deriveLogPath(SAMPLE_REPO, tsA);
      const pathB = deriveLogPath(SAMPLE_REPO, tsB);
      expect(logBasename(pathA)).toBe(`daily-${tsA}.log`);
      expect(logBasename(pathB)).toBe(`daily-${tsB}.log`);
      expect(logBasename(pathA)).not.toBe(logBasename(pathB));
    });
  });

  describe("branch: gitSha unknown-fallback (git 성공 vs 실패)", () => {
    it("resolveGitSha 는 git 성공 시 abbreviated SHA, 실패 시 literal `unknown`(빈 문자열 아님) 반환", () => {
      // git 성공: --short abbreviated SHA 그대로.
      expect(resolveGitSha("a1b2c3d", false)).toBe("a1b2c3d");
      // git 실패: literal unknown(365행 `|| echo unknown`).
      expect(resolveGitSha("a1b2c3d", true)).toBe("unknown");
      // fallback 은 빈 문자열이 아니어야 함(리비전 상관 위해).
      expect(resolveGitSha("", true)).toBe("unknown");
      expect(resolveGitSha("", true)).not.toBe("");
    });

    it('소스에서 fallback 표현이 `|| echo unknown`(빈 문자열 `""` 아님)임을 정적 확인', () => {
      const shellSource = readFileSync(DAILY_TEST_SH_PATH, "utf8");
      expect(hasGitShaFallbackAnchor(shellSource)).toBe(true);
      expect(shellSource).toContain("|| echo unknown");
      // 빈 문자열 fallback(`|| echo ""`)이 아님.
      expect(shellSource).not.toContain(
        'rev-parse --short HEAD 2>/dev/null || echo ""',
      );
      // `--short`(abbreviated) 이므로 full 40-char SHA 강제 아님.
      expect(shellSource).toContain("rev-parse --short HEAD");
    });
  });

  describe("branch: LOG_DIR / RESULT_JSON 유도 distinct", () => {
    it("LOG_DIR == ${repoDir}/deploy/logs, RESULT_JSON basename == latest-result.json(logPath basename daily-<ts>.log 와 distinct)", () => {
      expect(deriveLogDir(SAMPLE_REPO)).toBe(
        "/home/pi/assessment-agent/deploy/logs",
      );
      // RESULT_JSON 고정 basename(53행) — 사람용 로그와 다른 파일.
      const resultJsonBasename = "latest-result.json";
      const logBasenameVal = logFileNameFromTs(SAMPLE_TS);
      expect(resultJsonBasename).not.toBe(logBasenameVal);
      // 둘 다 같은 LOG_DIR 하위지만 basename distinct(T-0946 prune 이 daily-*.log 만 대상·latest-result.json 생존과 정합).
      expect(logBasenameVal).toMatch(/^daily-.*\.log$/);
      expect(resultJsonBasename).not.toMatch(/^daily-.*\.log$/);
    });
  });

  describe("Error path / negative cases 충분 cover", () => {
    it("error path — shell 파일 부재 경로 → readFileSync throw(silent 0-byte fallback 0)", () => {
      const badPath = path.join(REPO_ROOT, "deploy/__does_not_exist__.sh");
      expect(() => readFileSync(badPath, "utf8")).toThrow();
    });

    it("error path — 스칼라 유도 앵커 부재 시 명시적 실패(빈 매칭을 pass 로 오통과 0)", () => {
      // 앵커를 제거한 합성 소스(스칼라 유도 표현 부재)에서 추출기가 false 를 낸다.
      const emptySource = "#!/usr/bin/env bash\necho hello\n";
      const anchors = extractScalarProvenanceAnchors(emptySource);
      expect(anchors.logDir).toBe(false);
      expect(anchors.tsSingleSource).toBe(false);
      expect(anchors.logFileReuseTs).toBe(false);
      expect(anchors.resultJson).toBe(false);
      expect(anchors.gitShaFallback).toBe(false);
      expect(anchors.printfScalarSlot).toBe(false);
      // 실 소스는 반대로 전부 존재 — 부재/실재를 변별함을 대비로 실증.
      const realAnchors = extractScalarProvenanceAnchors(
        readFileSync(DAILY_TEST_SH_PATH, "utf8"),
      );
      expect(realAnchors.tsSingleSource).toBe(true);
      expect(realAnchors.gitShaFallback).toBe(true);
    });

    it("negative (a) — ts non-single-source drift 변별: LOG_FILE 이 $TS 대신 $(date ...) 재호출하는 mutant 소스에서 single-source 앵커 소실", () => {
      const shellSource = readFileSync(DAILY_TEST_SH_PATH, "utf8");
      // mutant(사본): LOG_FILE 이 $TS 대신 별도 date 재호출(single-source 회귀).
      const mutatedSource = shellSource.replace(
        'LOG_FILE="$LOG_DIR/daily-$TS.log"',
        'LOG_FILE="$LOG_DIR/daily-$(date -u +%Y%m%dT%H%M%SZ).log"',
      );
      // 원본은 single-source 앵커 존재.
      expect(hasLogFileReuseTsAnchor(shellSource)).toBe(true);
      // 사본은 $TS 재사용 앵커 소실(별도 date 재호출로 drift).
      expect(hasLogFileReuseTsAnchor(mutatedSource)).toBe(false);
      // 원본 소스 문자열은 mutate 0.
      expect(shellSource).toContain('LOG_FILE="$LOG_DIR/daily-$TS.log"');
    });

    it("negative (b) — date 포맷 drift 변별: 51행 date 포맷을 구분자 포함으로 치환한 mutant 소스에서 compact 앵커 소실 + isCompactUtcTs 실패", () => {
      const shellSource = readFileSync(DAILY_TEST_SH_PATH, "utf8");
      // mutant(사본): date 포맷을 ISO extended(구분자 포함)로 치환.
      const mutatedSource = shellSource.replace(
        'TS="$(date -u +%Y%m%dT%H%M%SZ)"',
        'TS="$(date -u +%Y-%m-%dT%H:%M:%SZ)"',
      );
      expect(hasTsSingleSourceAnchor(shellSource)).toBe(true);
      expect(hasTsSingleSourceAnchor(mutatedSource)).toBe(false);
      // 구분자 포함 TS 는 isCompactUtcTs 로 false(로그 파일명↔ts 형식 회귀).
      expect(isCompactUtcTs("2026-07-13T02:00:00Z")).toBe(false);
      expect(isCompactUtcTs("20260713T020000Z")).toBe(true);
      // 원본 문자열은 mutate 0.
      expect(shellSource).toContain('TS="$(date -u +%Y%m%dT%H%M%SZ)"');
    });

    it('negative (c) — gitSha fallback 제거/변조 drift 변별: `|| echo unknown` 제거·`|| echo ""` 치환 사본에서 fallback 앵커 소실', () => {
      const shellSource = readFileSync(DAILY_TEST_SH_PATH, "utf8");
      // mutant1(사본): `|| echo unknown` 제거 → git 실패 fatal(set -uo pipefail 하 중단).
      const removedFallback = shellSource.replace(
        'GIT_SHA="$(git -C "$REPO_DIR" rev-parse --short HEAD 2>/dev/null || echo unknown)"',
        'GIT_SHA="$(git -C "$REPO_DIR" rev-parse --short HEAD)"',
      );
      // mutant2(사본): `|| echo ""`(빈 문자열) → 리비전 상관 불가.
      const emptyFallback = shellSource.replace(
        "|| echo unknown)",
        '|| echo "")',
      );
      expect(hasGitShaFallbackAnchor(shellSource)).toBe(true);
      expect(hasGitShaFallbackAnchor(removedFallback)).toBe(false);
      expect(hasGitShaFallbackAnchor(emptyFallback)).toBe(false);
      // resolveGitSha 모델도 fallback 이 literal unknown(빈 문자열 아님)임을 재확인.
      expect(resolveGitSha("", true)).toBe("unknown");
      // 원본 문자열은 mutate 0.
      expect(shellSource).toContain("|| echo unknown");
    });

    it("negative (d) — logPath↔ts cross-field drift 변별: deriveLogPath 를 다른 basename 내도록 mutate 한 모델 사본에서 cross-field assert 실패", () => {
      const ts = SAMPLE_TS;
      const otherTs = "20250101T000000Z";
      // 정본: basename(logPath) == daily-${ts}.log.
      const canonicalPath = deriveLogPath(SAMPLE_REPO, ts);
      expect(logBasename(canonicalPath)).toBe(`daily-${ts}.log`);
      // mutant(모델 사본): logPath 가 다른 TS 를 참조(cross-field 역추적 회귀).
      const mutantDerive = (repoDir: string): string =>
        `${repoDir}/deploy/logs/daily-${otherTs}.log`;
      const mutantPath = mutantDerive(SAMPLE_REPO);
      // cross-field 불변식(basename == daily-${ts}.log)이 mutant 에서 실패함을 실증.
      expect(logBasename(mutantPath)).not.toBe(`daily-${ts}.log`);
      expect(logBasename(mutantPath)).toBe(`daily-${otherTs}.log`);
      // 원본 모델은 불변(정본 재호출 시 여전히 ts 로 역추적).
      expect(logBasename(deriveLogPath(SAMPLE_REPO, ts))).toBe(
        `daily-${ts}.log`,
      );
    });

    it("negative (e) — credential 누출 0: 추출/합성하는 어떤 문자열(TS·gitSha·logPath·LOG_DIR)에도 gh 토큰 어휘 미등장", () => {
      const shellSource = readFileSync(DAILY_TEST_SH_PATH, "utf8");
      const synthesized = [
        logFileNameFromTs(SAMPLE_TS),
        deriveLogPath(SAMPLE_REPO, SAMPLE_TS),
        deriveLogDir(SAMPLE_REPO),
        resolveGitSha("a1b2c3d", false),
        resolveGitSha("", true),
        SAMPLE_TS,
      ];
      // 스칼라 유도 앵커 슬라이스(50~53행 부근)도 검사 대상.
      const anchorSlice = shellSource.slice(
        shellSource.indexOf('LOG_DIR="$REPO_DIR/deploy/logs"'),
        shellSource.indexOf('LOG_DIR="$REPO_DIR/deploy/logs"') + 300,
      );

      const credentialPattern =
        /(ghp_|--token|GITHUB_TOKEN|GH_TOKEN|\bBearer\b|Authorization|\bsk-)/i;

      const haystacks = [...synthesized, anchorSlice];
      haystacks.forEach((s) => {
        expect(credentialPattern.test(s)).toBe(false);
      });
      // gating env 이름(REALDATA_E2E_*)조차 본 스칼라 provenance 합성 문자열엔 무관(등장 0).
      synthesized.forEach((s) => {
        expect(s).not.toContain("REALDATA_E2E_");
      });
    });
  });

  describe("flow: 결정론 · no-mutation", () => {
    it("동일 입력(ts·repoDir·rawSha)으로 pure 함수를 두 번 호출하면 byte-identical(결정론)", () => {
      expect(logFileNameFromTs(SAMPLE_TS)).toBe(logFileNameFromTs(SAMPLE_TS));
      expect(deriveLogPath(SAMPLE_REPO, SAMPLE_TS)).toBe(
        deriveLogPath(SAMPLE_REPO, SAMPLE_TS),
      );
      expect(resolveGitSha("a1b2c3d", false)).toBe(
        resolveGitSha("a1b2c3d", false),
      );
      expect(resolveGitSha("a1b2c3d", true)).toBe(
        resolveGitSha("a1b2c3d", true),
      );
    });

    it("동일 shell 소스로 앵커 추출을 두 번 하면 deep-equal(결정론)", () => {
      const shellSource = readFileSync(DAILY_TEST_SH_PATH, "utf8");
      const a1 = extractScalarProvenanceAnchors(shellSource);
      const a2 = extractScalarProvenanceAnchors(shellSource);
      expect(a1).toEqual(a2);
    });

    it("pure 함수·추출 보조 함수가 입력(문자열·shell 소스)을 mutate 0(원본 불변)", () => {
      const shellSource = readFileSync(DAILY_TEST_SH_PATH, "utf8");
      const sourceSnapshot = shellSource;
      extractScalarProvenanceAnchors(shellSource);
      expect(shellSource).toBe(sourceSnapshot);

      const tsSnapshot = SAMPLE_TS;
      const repoSnapshot = SAMPLE_REPO;
      logFileNameFromTs(SAMPLE_TS);
      deriveLogPath(SAMPLE_REPO, SAMPLE_TS);
      resolveGitSha("a1b2c3d", false);
      // 원시 문자열 입력은 불변(JS 문자열 immutable 재확인).
      expect(SAMPLE_TS).toBe(tsSnapshot);
      expect(SAMPLE_REPO).toBe(repoSnapshot);
    });
  });

  describe("dormant / non-gated 확인 — side-effect 0", () => {
    it("provenance 모델이 env / 전역 상태 없이 순수하게 동작(non-gated — ts/gitSha 는 파라미터로만)", () => {
      // 본 describe 가 실행된다는 것 자체가 describe.skip 0(항상 실행)의 런타임 증거.
      const envSnapshot = { ...process.env };
      const before = deriveLogPath(SAMPLE_REPO, SAMPLE_TS);
      // env 를 mutate 해도 provenance 산출 불변 — 모델이 env 를 참조하지 않음(파라미터로만).
      Object.assign(process.env, { INJECTED_TS_ENV: "1" });
      const after = deriveLogPath(SAMPLE_REPO, SAMPLE_TS);
      delete process.env.INJECTED_TS_ENV;
      expect(after).toBe(before);
      expect(Object.keys(process.env)).toEqual(Object.keys(envSnapshot));
    });

    it("파일 read 는 deploy/daily-test.sh 읽기만 — 실 shell/date/git 실행 0(추출 결과가 문자열이지 실행 산출물 아님)", () => {
      const shellSource = readFileSync(DAILY_TEST_SH_PATH, "utf8");
      expect(shellSource.startsWith("#!")).toBe(true);
      expect(hasTsSingleSourceAnchor(shellSource)).toBe(true);
    });
  });
});
