// redeploy-orchestration-entrypoint-contract-artifact-parity-drift.smoke-spec.ts
// — 무인 야간 재배포 체인의 진입점 오케스트레이션 wiring 계약(systemd .timer → .service →
//   `deploy/redeploy.sh` → sub-script/compose) 이 실 배포 artifact 와 정합함을 정적 추출·
//   cross-artifact 대조하는 drift-detection non-gated build-time smoke (T-0797 박제).
//
// 본 spec 의 존재 이유 — redeploy 진입점 오케스트레이션 wiring ↔ 실 artifact gap 해소:
//   `deploy/redeploy.sh` 는 무인 야간 재배포 체인의 진입점 오케스트레이터다 — systemd
//   `.timer`(매일 03:00) → `.service`(oneshot) → `redeploy.sh`(origin/main 동기 → 이미지
//   재빌드 → 컨테이너 교체 → LLM config seed → 잔여 이미지 정리). 이 체인은 여러 artifact
//   사이의 경로/식별자 계약 위에서만 작동한다:
//     1. systemd `.service` `ExecStart=/opt/assessment-agent/deploy/redeploy.sh` 의 경로
//        suffix(`deploy/redeploy.sh`)는 실 `deploy/redeploy.sh` 파일을 가리켜야 한다.
//     2. `.service` 의 `ExecStart`·`Environment=REPO_DIR=`·`WorkingDirectory` 세 곳이 동일
//        배포 루트 prefix(`/opt/assessment-agent`)를 공유해야 한다(triple-match).
//     3. redeploy.sh `REPO_DIR="${REPO_DIR:-/opt/assessment-agent}"` 기본값 == service
//        `Environment=REPO_DIR=` 값 — service 주입 실행과 cron/수동 기본값 실행이 같은 루트.
//     4. redeploy.sh 의 `bash "$REPO_DIR/deploy/seed-llm-config.sh"` 호출 경로
//        suffix(`deploy/seed-llm-config.sh`)는 실 seed 파일을 가리켜야 한다.
//     5. redeploy.sh 의 `docker compose up -d --build` 는 repo-root 의 compose 파일을 전제.
//     6. `.timer` `OnCalendar=*-*-* 03:00:00` 무인 스케줄 계약 + service/timer unit 식별자 짝.
//   이 계약이 silent drift 하면(redeploy.sh 이동·triple-match 어긋남·REPO_DIR 불일치·seed 경로
//   삭제·compose 누락) 무인 야간 재배포(03:00)가 실 호스트에서 처음 터지기 전까지 검출 0.
//   본 spec 은 그 빈 자리를 메운다 — redeploy.sh + .service + .timer 를 readFileSync 로 읽어
//   계약/식별자를 정적 추출하고, 실 artifact(redeploy.sh·seed-llm-config.sh·docker-compose.yml)
//   existsSync 와 cross-artifact 대조한다.
//
//      🔥 실 systemd 발화·실 redeploy.sh 실행·실 docker compose·실 git reset·실 seed 실행 0 —
//         파일 read + 정적 텍스트 추출 + existsSync 만. redeploy.sh·unit·seed·compose 는 읽기만.
//      🔥 NestJS module/class import 0 — readFileSync 텍스트 read only, DI/DB 의존 0.
//      🔥 process.env 읽기 0 / gating 분기 0 — non-gated 항상 실행(describe.skip 0).
//      🔥 credential 0 — 운반 토큰은 경로·식별자·스케줄뿐. redeploy.sh 의 SEED_LLM_* 는 변수
//         이름 언급일 뿐 실 값 0 — 본 추출 surface 미포함(경로·REPO_DIR·ExecStart·OnCalendar 만).
//      🔥 새 외부 dependency 0 — node 내장(`fs`/`path`) import 만. systemd/shell 파서 추가 0.
//
// Out of Scope (T-0797):
//   - src 변경 0 — test-only. redeploy.sh·unit·seed·compose 는 readFileSync/existsSync read 만.
//   - redeploy.sh·systemd unit·compose 변경 0(drift 발견 시 별도 fix task).
//   - 실 systemd timer/service 발화·실 redeploy.sh 실행·실 docker compose·실 git reset·실 seed 0.
//   - systemd unit 의 완전한 spec 파싱(모든 directive) 0 — 필요한 계약 토큰만 정규식/슬라이스 추출.
//   - docker-compose.yml service 토폴로지(T-0795)·seed SQL/cipher(T-0794) 재단언 0 — 본 task 는
//     compose/seed 파일 **실존**과 redeploy.sh 의 **호출 경로 정합**만 본다.
//   - 새 helper 모듈 신설 0(`test/helpers/` 변경 0) — spec 로컬 보조 함수만 허용.
import { readFileSync, existsSync } from "fs";
import * as path from "path";

// repo-root 경로 — test 실행 cwd 무관하게 robust 하게 해석(`__dirname` = test/smoke,
// 두 단계 위가 repo-root). `process.cwd()` 대신 `__dirname` 기준 상대로 고정한다.
const REPO_ROOT = path.resolve(__dirname, "../..");
const REDEPLOY_PATH = path.join(REPO_ROOT, "deploy/redeploy.sh");
const SERVICE_PATH = path.join(
  REPO_ROOT,
  "deploy/assessment-agent-redeploy.service",
);
const TIMER_PATH = path.join(
  REPO_ROOT,
  "deploy/assessment-agent-redeploy.timer",
);

// ---------------------------------------------------------------------------
// 타입 정의 — redeploy.sh·service·timer 양측에서 추출한 계약/식별자의 정규형.
// ---------------------------------------------------------------------------

// deploy/redeploy.sh 가 운반하는 오케스트레이션 계약의 정규형.
//   · repoDirDefault: `REPO_DIR="${REPO_DIR:-/opt/assessment-agent}"` 의 기본값.
//   · seedScriptSuffix: `bash "$REPO_DIR/deploy/seed-llm-config.sh"` 의 repo-root 상대 경로 suffix.
//   · hasDockerCompose: `docker compose up -d --build` 명령 존재 여부(compose 전제).
interface RedeployContract {
  repoDirDefault: string;
  seedScriptSuffix: string;
  hasDockerCompose: boolean;
}

// systemd .service 가 운반하는 경로 식별자의 정규형.
//   · execStart: `ExecStart=` 의 전체 경로.
//   · execStartSuffix: ExecStart 경로의 repo-root 상대 suffix(`deploy/redeploy.sh`).
//   · environmentRepoDir: `Environment=REPO_DIR=` 의 값.
//   · workingDirectory: `WorkingDirectory=` 의 값.
interface ServiceContract {
  execStart: string;
  execStartSuffix: string;
  environmentRepoDir: string;
  workingDirectory: string;
}

// systemd .timer 가 운반하는 스케줄 계약의 정규형.
//   · onCalendar: `OnCalendar=` 의 값(무인 야간 스케줄).
interface TimerContract {
  onCalendar: string;
}

// ---------------------------------------------------------------------------
// 추출 보조 함수 — 입력 문자열을 mutate 0(순수 read-only 정규식/슬라이스).
// ---------------------------------------------------------------------------

// redeploy.sh 텍스트에서 오케스트레이션 계약을 추출한다.
function extractRedeployContract(text: string): RedeployContract {
  // `REPO_DIR="${REPO_DIR:-/opt/assessment-agent}"` 의 기본값 부분(`:-` 뒤 ~ `}` 앞).
  const repoDirMatch = text.match(/REPO_DIR="\$\{REPO_DIR:-([^}]+)\}"/);
  // `bash "$REPO_DIR/deploy/seed-llm-config.sh"` 의 `$REPO_DIR/` 뒤 경로 suffix.
  const seedMatch = text.match(/bash\s+"\$REPO_DIR\/([^"]+)"/);
  // `docker compose up -d --build` 명령 존재 여부.
  const hasDockerCompose = /docker\s+compose\s+up\s+-d\s+--build/.test(text);
  return {
    repoDirDefault: repoDirMatch ? repoDirMatch[1].trim() : "",
    seedScriptSuffix: seedMatch ? seedMatch[1].trim() : "",
    hasDockerCompose,
  };
}

// systemd .service 텍스트에서 경로 식별자를 추출한다.
function extractServiceContract(text: string): ServiceContract {
  // 주석(`#` 으로 시작) 라인은 무시하고 directive 라인만 매칭한다.
  const directive = (key: string): string => {
    const re = new RegExp(`^\\s*${key}=(.+)$`, "m");
    const m = text.match(re);
    return m ? m[1].trim() : "";
  };
  const execStart = directive("ExecStart");
  // `Environment=REPO_DIR=/opt/assessment-agent` 형태 — `REPO_DIR=` 의 값만 슬라이스.
  const envLine = directive("Environment");
  const envRepoDirMatch = envLine.match(/^REPO_DIR=(.+)$/);
  // ExecStart 경로에서 repo-root 상대 suffix(`deploy/redeploy.sh`) 추출 — 마지막
  // `/deploy/...` 또는 `deploy/...` 부분. 배포 루트 prefix 를 제거한 꼬리.
  const suffixMatch = execStart.match(/\/((?:deploy)\/.+)$/);
  return {
    execStart,
    execStartSuffix: suffixMatch ? suffixMatch[1].trim() : "",
    environmentRepoDir: envRepoDirMatch ? envRepoDirMatch[1].trim() : "",
    workingDirectory: directive("WorkingDirectory"),
  };
}

// systemd .timer 텍스트에서 스케줄 계약을 추출한다.
function extractTimerContract(text: string): TimerContract {
  const m = text.match(/^\s*OnCalendar=(.+)$/m);
  return { onCalendar: m ? m[1].trim() : "" };
}

// ExecStart 전체 경로(`/<prefix>/deploy/redeploy.sh`)에서 배포 루트 prefix 를 추출한다.
//   예: `/opt/assessment-agent/deploy/redeploy.sh` → `/opt/assessment-agent`.
function execStartPrefix(execStart: string): string {
  const m = execStart.match(/^(.+)\/deploy\/redeploy\.sh$/);
  return m ? m[1].trim() : "";
}

// service triple-match 판정 — ExecStart prefix·Environment=REPO_DIR·WorkingDirectory 가
// 동일 배포 루트를 공유하는지. true 면 정합, false 면 drift.
function isTripleMatch(svc: ServiceContract): boolean {
  const prefix = execStartPrefix(svc.execStart);
  return (
    prefix !== "" &&
    prefix === svc.environmentRepoDir &&
    prefix === svc.workingDirectory
  );
}

// ---------------------------------------------------------------------------
// 실 artifact 텍스트 read (build-time, 실행 0).
// ---------------------------------------------------------------------------
const redeployText = readFileSync(REDEPLOY_PATH, "utf8");
const serviceText = readFileSync(SERVICE_PATH, "utf8");
const timerText = readFileSync(TIMER_PATH, "utf8");

describe("redeploy 오케스트레이션-진입점 계약 ↔ 실 배포 artifact parity drift smoke (T-0797)", () => {
  // -------------------------------------------------------------------------
  // Happy-path: 세 정본 read + 계약/식별자 추출 — 추출 결과 non-empty.
  // -------------------------------------------------------------------------
  describe("happy-path: redeploy.sh + .service/.timer read + 계약/식별자 추출", () => {
    it("redeploy.sh 에서 REPO_DIR 기본값·seed 호출 경로 suffix·docker compose 전제를 non-empty 로 추출", () => {
      const c = extractRedeployContract(redeployText);
      expect(c.repoDirDefault).toBeTruthy();
      expect(c.repoDirDefault).toBe("/opt/assessment-agent");
      expect(c.seedScriptSuffix).toBeTruthy();
      expect(c.seedScriptSuffix).toBe("deploy/seed-llm-config.sh");
      expect(c.hasDockerCompose).toBe(true);
    });

    it(".service 에서 ExecStart(전체·suffix)·Environment=REPO_DIR·WorkingDirectory 를 non-empty 로 추출", () => {
      const s = extractServiceContract(serviceText);
      expect(s.execStart).toBeTruthy();
      expect(s.execStartSuffix).toBe("deploy/redeploy.sh");
      expect(s.environmentRepoDir).toBeTruthy();
      expect(s.workingDirectory).toBeTruthy();
    });

    it(".timer 에서 OnCalendar 값을 non-empty 로 추출", () => {
      const t = extractTimerContract(timerText);
      expect(t.onCalendar).toBeTruthy();
    });

    it("repo-root 경로를 __dirname 기준으로 cwd-robust 하게 해석(세 정본 실존)", () => {
      expect(existsSync(REDEPLOY_PATH)).toBe(true);
      expect(existsSync(SERVICE_PATH)).toBe(true);
      expect(existsSync(TIMER_PATH)).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // 핵심 불변식 1: service ExecStart ↔ 실 redeploy.sh 파일 실존.
  // -------------------------------------------------------------------------
  describe("service ExecStart ↔ 실 redeploy.sh 파일 실존 정합", () => {
    it("ExecStart suffix(deploy/redeploy.sh)가 repo-root 기준 실 파일로 실존 AND ExecStart 가 deploy/redeploy.sh 로 끝남", () => {
      const s = extractServiceContract(serviceText);
      expect(s.execStartSuffix).toBe("deploy/redeploy.sh");
      expect(existsSync(path.resolve(REPO_ROOT, s.execStartSuffix))).toBe(true);
      expect(s.execStart.endsWith("deploy/redeploy.sh")).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // 핵심 불변식 2: service 경로 식별자 triple-match.
  // -------------------------------------------------------------------------
  describe("service 경로 식별자 triple-match 정합", () => {
    it("ExecStart prefix == Environment=REPO_DIR == WorkingDirectory (동일 배포 루트 공유)", () => {
      const s = extractServiceContract(serviceText);
      expect(isTripleMatch(s)).toBe(true);
      expect(s.environmentRepoDir).toBe(s.workingDirectory);
      expect(execStartPrefix(s.execStart)).toBe(s.environmentRepoDir);
    });
  });

  // -------------------------------------------------------------------------
  // 핵심 불변식 3: redeploy.sh REPO_DIR 기본값 ↔ service Environment=REPO_DIR.
  // -------------------------------------------------------------------------
  describe("redeploy.sh REPO_DIR 기본값 ↔ service Environment=REPO_DIR 정합", () => {
    it("redeploy.sh REPO_DIR 기본값 == service Environment=REPO_DIR 값(toBe)", () => {
      const c = extractRedeployContract(redeployText);
      const s = extractServiceContract(serviceText);
      expect(c.repoDirDefault).toBe(s.environmentRepoDir);
    });
  });

  // -------------------------------------------------------------------------
  // 핵심 불변식 4: redeploy.sh seed 호출 경로 ↔ 실 seed-llm-config.sh 실존.
  // -------------------------------------------------------------------------
  describe("redeploy.sh seed 호출 경로 ↔ 실 seed-llm-config.sh 실존 정합", () => {
    it("seed 호출 경로 suffix(deploy/seed-llm-config.sh)가 repo-root 기준 실 파일로 실존", () => {
      const c = extractRedeployContract(redeployText);
      expect(c.seedScriptSuffix).toBe("deploy/seed-llm-config.sh");
      expect(existsSync(path.resolve(REPO_ROOT, c.seedScriptSuffix))).toBe(
        true,
      );
    });
  });

  // -------------------------------------------------------------------------
  // 핵심 불변식 5: redeploy.sh docker compose 전제 ↔ compose 파일 실존.
  // -------------------------------------------------------------------------
  describe("redeploy.sh docker compose 전제 ↔ compose 파일 실존 정합", () => {
    it("docker compose 명령 포함(추출 true) AND repo-root 에 docker-compose.yml 실존", () => {
      const c = extractRedeployContract(redeployText);
      expect(c.hasDockerCompose).toBe(true);
      expect(existsSync(path.resolve(REPO_ROOT, "docker-compose.yml"))).toBe(
        true,
      );
    });
  });

  // -------------------------------------------------------------------------
  // 핵심 불변식 6: timer 스케줄 계약 존재 + service/timer unit 식별자 짝.
  // -------------------------------------------------------------------------
  describe("timer 스케줄 계약 존재 + service/timer unit 식별자 짝", () => {
    it("OnCalendar 값이 non-empty(03:00:00 포함) AND .service/.timer 가 동일 unit 식별자 공유", () => {
      const t = extractTimerContract(timerText);
      expect(t.onCalendar).toBeTruthy();
      expect(t.onCalendar).toContain("03:00:00");
      // 파일명 기준 unit 식별자 — 확장자만 다른 동일 base name.
      const serviceUnit = path.basename(SERVICE_PATH, ".service");
      const timerUnit = path.basename(TIMER_PATH, ".timer");
      expect(serviceUnit).toBe(timerUnit);
      expect(serviceUnit).toBe("assessment-agent-redeploy");
    });
  });

  // -------------------------------------------------------------------------
  // drift-detection 변별성 — 합성 mutate 사본이 계약과 정합 아님을 입증.
  // 본 smoke 의 parity 단언이 진짜 그물임을 박제. 원본 추출 결과는 mutate 0.
  // -------------------------------------------------------------------------
  describe("drift-detection 변별성 (합성 mutate 사본이 mismatch — 본 smoke 가 drift 를 잡는 그물)", () => {
    it("(a) ExecStart 를 redeploy-renamed.sh 로 바꾼 합성 → suffix existsSync false(rename 검출)", () => {
      const mutated = serviceText.replace(
        "ExecStart=/opt/assessment-agent/deploy/redeploy.sh",
        "ExecStart=/opt/assessment-agent/deploy/redeploy-renamed.sh",
      );
      const s = extractServiceContract(mutated);
      expect(s.execStartSuffix).toBe("deploy/redeploy-renamed.sh");
      expect(existsSync(path.resolve(REPO_ROOT, s.execStartSuffix))).toBe(
        false,
      );
    });

    it("(b) WorkingDirectory 만 /srv/app 으로 바꾼 합성 → triple-match false(prefix 불일치 검출)", () => {
      const mutated = serviceText.replace(
        "WorkingDirectory=/opt/assessment-agent",
        "WorkingDirectory=/srv/app",
      );
      const s = extractServiceContract(mutated);
      expect(isTripleMatch(s)).toBe(false);
    });

    it("(c) redeploy.sh REPO_DIR 기본값을 /srv/aa 로 바꾼 합성 → service Environment=REPO_DIR 와 toBe 불일치(검출)", () => {
      const mutated = redeployText.replace(
        'REPO_DIR="${REPO_DIR:-/opt/assessment-agent}"',
        'REPO_DIR="${REPO_DIR:-/srv/aa}"',
      );
      const c = extractRedeployContract(mutated);
      const s = extractServiceContract(serviceText);
      expect(c.repoDirDefault).toBe("/srv/aa");
      expect(c.repoDirDefault).not.toBe(s.environmentRepoDir);
    });

    it("(d) redeploy.sh seed 호출 경로를 deploy/seed-renamed.sh 로 바꾼 합성 → existsSync false(검출)", () => {
      const mutated = redeployText.replace(
        'bash "$REPO_DIR/deploy/seed-llm-config.sh"',
        'bash "$REPO_DIR/deploy/seed-renamed.sh"',
      );
      const c = extractRedeployContract(mutated);
      expect(c.seedScriptSuffix).toBe("deploy/seed-renamed.sh");
      expect(existsSync(path.resolve(REPO_ROOT, c.seedScriptSuffix))).toBe(
        false,
      );
    });

    it("(e) redeploy.sh 에서 docker compose 라인을 제거한 합성 → docker compose 전제 추출 false(검출)", () => {
      const mutated = redeployText.replace(
        "docker compose up -d --build",
        "echo skip-build",
      );
      const c = extractRedeployContract(mutated);
      expect(c.hasDockerCompose).toBe(false);
    });

    it("원본 추출 결과는 합성 mutate 후에도 불변(원본 read-only 입증)", () => {
      const before = extractRedeployContract(redeployText);
      // 사본만 변형 — 원본 텍스트/추출은 영향 0.
      redeployText.replace("docker compose up -d --build", "echo skip-build");
      const after = extractRedeployContract(redeployText);
      expect(after).toEqual(before);
    });
  });

  // -------------------------------------------------------------------------
  // Error path / negative cases — 예외/경계 분기마다 각 1+.
  // -------------------------------------------------------------------------
  describe("error path / negative cases", () => {
    it("redeploy.sh/service/timer/compose 파일 부재 경로 → readFileSync throw(ENOENT, silent fallback 0)", () => {
      const badRedeploy = path.join(
        REPO_ROOT,
        "deploy/redeploy-nonexistent.sh",
      );
      const badService = path.join(REPO_ROOT, "deploy/nonexistent.service");
      const badTimer = path.join(REPO_ROOT, "deploy/nonexistent.timer");
      const badCompose = path.join(REPO_ROOT, "docker-compose-nonexistent.yml");
      expect(() => readFileSync(badRedeploy, "utf8")).toThrow();
      expect(() => readFileSync(badService, "utf8")).toThrow();
      expect(() => readFileSync(badTimer, "utf8")).toThrow();
      expect(() => readFileSync(badCompose, "utf8")).toThrow();
    });

    it("ExecStart 경로 rename 검출(합성) → 실존하지 않는 스크립트 suffix existsSync false", () => {
      const mutated = serviceText.replace(
        "ExecStart=/opt/assessment-agent/deploy/redeploy.sh",
        "ExecStart=/opt/assessment-agent/deploy/redeploy-nonexistent.sh",
      );
      const s = extractServiceContract(mutated);
      expect(existsSync(path.resolve(REPO_ROOT, s.execStartSuffix))).toBe(
        false,
      );
    });

    it("triple-match prefix 불일치 검출(합성) → Environment≠WorkingDirectory 인 service false", () => {
      const mutated = serviceText
        .replace(
          "Environment=REPO_DIR=/opt/assessment-agent",
          "Environment=REPO_DIR=/opt/aa",
        )
        .replace(
          "WorkingDirectory=/opt/assessment-agent",
          "WorkingDirectory=/srv/aa",
        );
      const s = extractServiceContract(mutated);
      expect(isTripleMatch(s)).toBe(false);
    });

    it("REPO_DIR 기본값 불일치 검출(합성) → redeploy.sh 기본값 ≠ service Environment=REPO_DIR", () => {
      const mutated = redeployText.replace(
        'REPO_DIR="${REPO_DIR:-/opt/assessment-agent}"',
        'REPO_DIR="${REPO_DIR:-/var/aa}"',
      );
      const c = extractRedeployContract(mutated);
      const s = extractServiceContract(serviceText);
      expect(c.repoDirDefault).not.toBe(s.environmentRepoDir);
    });

    it("seed 호출 경로 삭제 검출(합성) → 실존하지 않는 경로 suffix existsSync false", () => {
      const mutated = redeployText.replace(
        'bash "$REPO_DIR/deploy/seed-llm-config.sh"',
        'bash "$REPO_DIR/deploy/seed-missing.sh"',
      );
      const c = extractRedeployContract(mutated);
      expect(c.seedScriptSuffix).toBe("deploy/seed-missing.sh");
      expect(existsSync(path.resolve(REPO_ROOT, c.seedScriptSuffix))).toBe(
        false,
      );
    });

    it("docker compose 전제 누락 검출(합성) → docker compose 라인 빠진 redeploy.sh 추출 false", () => {
      const mutated = redeployText.replace(
        /docker\s+compose\s+up\s+-d\s+--build/,
        "",
      );
      const c = extractRedeployContract(mutated);
      expect(c.hasDockerCompose).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // credential 누출 0 (REQ-059 / CLAUDE.md §9).
  // -------------------------------------------------------------------------
  describe("credential 누출 0", () => {
    it("추출/합성하는 어떤 토큰에도 실 토큰/secret/password 가 등장하지 않음", () => {
      const c = extractRedeployContract(redeployText);
      const s = extractServiceContract(serviceText);
      const t = extractTimerContract(timerText);
      const surface = [
        c.repoDirDefault,
        c.seedScriptSuffix,
        String(c.hasDockerCompose),
        s.execStart,
        s.execStartSuffix,
        s.environmentRepoDir,
        s.workingDirectory,
        t.onCalendar,
      ].join("\n");
      // secret 류 토큰/실 값 패턴 — case-insensitive. 경로·식별자·스케줄만 운반해야 한다.
      const credPattern =
        /(gh[pousr]_[A-Za-z0-9]{20,}|Bearer\s+[A-Za-z0-9._-]+|Authorization:|x-(?:access|github)-token|AUTH_JWT_SECRET\s*=\s*\S|password\s*=\s*\S|ghp_|github_pat_)/i;
      expect(credPattern.test(surface)).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // 결정론·no-mutation.
  // -------------------------------------------------------------------------
  describe("결정론·no-mutation", () => {
    it("동일 소스로 추출을 두 번 → byte-identical deep-equal(결정론)", () => {
      expect(extractRedeployContract(redeployText)).toEqual(
        extractRedeployContract(redeployText),
      );
      expect(extractServiceContract(serviceText)).toEqual(
        extractServiceContract(serviceText),
      );
      expect(extractTimerContract(timerText)).toEqual(
        extractTimerContract(timerText),
      );
    });

    it("추출 보조 함수가 입력 문자열을 mutate 0(원본 텍스트 길이 불변)", () => {
      const lenBefore = redeployText.length;
      extractRedeployContract(redeployText);
      extractServiceContract(serviceText);
      extractTimerContract(timerText);
      expect(redeployText.length).toBe(lenBefore);
    });
  });
});
