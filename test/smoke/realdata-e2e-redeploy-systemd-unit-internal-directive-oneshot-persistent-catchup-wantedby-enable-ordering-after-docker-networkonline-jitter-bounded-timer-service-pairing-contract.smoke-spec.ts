// realdata-e2e-redeploy-systemd-unit-internal-directive-oneshot-persistent-catchup-wantedby-enable-ordering-after-docker-networkonline-jitter-bounded-timer-service-pairing-contract.smoke-spec.ts
// — 무인 nightly 재배포 runner chain(daily-test.sh · redeploy.sh · seed-llm-config.sh · docker-entrypoint.sh)
// 을 **처음 발화시키는 상류 trigger** 인 systemd unit 짝 `deploy/assessment-agent-redeploy.timer`(매일
// 03:00 → oneshot service 활성) + `deploy/assessment-agent-redeploy.service`(`ExecStart=.../deploy/redeploy.sh`)
// 의 **내부 semantic directive 계약**을 실 unit 파일을 readFileSync 로 읽어(실 systemctl/실 timer 발화/실
// redeploy/실 docker/네트워크 0) 정적 검증하는 non-gated build-time smoke
// (T-0961, PLAN.md §109 재배포 runner chain — 발화-leg 완결).
//
// 봉함 불변식(unit 자신의 내부 semantic directive — outer wiring parity 와 distinct 상보):
//   (a) `.service` `[Service]` `Type=oneshot` — redeploy 는 완료 후 종료하는 oneshot(상주 데몬 아님).
//       simple 로 변질되면 systemd 가 redeploy 를 상주 데몬으로 오인 → timer 재발화·완료-추적 semantics 붕괴.
//   (b) `.service` `[Unit]` `After=`/`Wants=network-online.target docker.service` — docker 데몬 + 네트워크가
//       redeploy **앞**에 준비됨(git fetch · docker compose 전제). docker.service 소실 시 미기동 docker 위에서
//       `docker compose up` 실패.
//   (c) `.timer` `[Timer]` `Persistent=true` — 호스트가 03:00 에 꺼져 있었으면 부팅 후 놓친 실행 1회 보충
//       (nightly 재배포 miss 방지). 소실 시 stale 배포 무한 지속.
//   (d) `.timer` `[Timer]` `RandomizedDelaySec` bounded jitter(정수 ≤ 300 = 최대 5분) — 03:00 창 이탈 방지.
//       상한 이탈 시 지터가 예측 불가로 커져 창 벗어남.
//   (e) `.timer` `[Install]` `WantedBy=timers.target` — 부팅 시 자동 시작 enable. 소실 시 `systemctl enable`
//       해도 timer 미활성(nightly 재배포 아예 미발화).
//   (f) timer↔service basename stem pairing — `X.timer` 는 동일 stem 의 `X.service` 를 활성. stem 어긋나면
//       timer 가 엉뚱한/부재 service 를 활성.
//   (g) §9 secret-safety — 추출/합성 토큰에 실 토큰·secret·password·실 endpoint 0(directive 키·값·정수 지터·
//       systemd target 이름·unit basename stem 만).
//
// 전략(형제 T-0960 docker-entrypoint 내부 시퀀스·T-0958 redeploy 내부 시퀀스 동형): unit 파일에서 섹션/directive
// 토큰을 정적 추출하는 해석 동형 TS 순수 함수(`sliceSection`·`hasDirectiveInSection`·`parseTargetList`·
// `parseRandomizedDelaySec`·`unitStem`·`extractUnitAnchors`)로 directive 불변식 assert. 합성 mutant 사본으로
// negative(a~f 6종) 변별. 기존 `redeploy-orchestration-entrypoint-contract-artifact-parity-drift.smoke-spec.ts`
// (T-0797: ExecStart 경로 suffix · REPO_DIR triple-match · OnCalendar 값 cross-artifact parity) 와 distinct
// 상보 surface — 본 task 는 그 3 표면(ExecStart 경로·REPO_DIR 값·OnCalendar 값)을 재검증하지 않는다(중복 금지).
//   🔥 실 systemctl/실 timer 발화/실 redeploy/실 docker/네트워크 0 · process.env 읽기 0(입력은 pure 함수 파라미터)
//      · credential 0(§9/REQ-059) · 새 dep 0(node fs/path) · src 변경 0(test-only) ·
//      deploy/assessment-agent-redeploy.{service,timer} 읽기만(실행 0 · 변경 0).
import { existsSync, readFileSync } from "fs";
import * as path from "path";

// repo-root 경로 — test 실행 cwd 무관하게 robust 하게 해석(`__dirname` = test/smoke,
// 두 단계 위가 repo-root). `process.cwd()` 대신 `__dirname` 기준 상대로 고정한다(sibling T-0960).
const REPO_ROOT = path.resolve(__dirname, "../..");
const SERVICE_BASENAME = "assessment-agent-redeploy.service";
const TIMER_BASENAME = "assessment-agent-redeploy.timer";
const SERVICE_PATH = path.join(REPO_ROOT, "deploy", SERVICE_BASENAME);
const TIMER_PATH = path.join(REPO_ROOT, "deploy", TIMER_BASENAME);

// 정본 앵커(실 unit 표현의 TS mirror — 실 systemctl/timer/redeploy 실행 0).
const NETWORK_ONLINE_TARGET = "network-online.target"; // ordering 대상 1.
const DOCKER_SERVICE_TARGET = "docker.service"; // ordering 대상 2.
const JITTER_UPPER_BOUND = 300; // RandomizedDelaySec bounded jitter 상한(초 = 5분).

// ── TS 동형 pure 함수(정본) — systemd unit 파일(.service/.timer)의 섹션·directive 를 모델링.
//    입력(문자열)은 mutate 하지 않는다(읽기만). 실 systemctl/timer/env 읽기 0 — 입력은 파라미터.

// 소스를 CRLF-정규화 후 라인 배열로 — 모든 파서의 공통 입력.
function toLines(source: string): string[] {
  return source.replace(/\r\n/g, "\n").split("\n");
}

// sliceSection(source, section): `[Section]` 헤더부터 다음 `[...]` 헤더(또는 EOF) 직전까지의 라인 배열 추출.
//   systemd unit 은 `[Unit]`/`[Service]`/`[Timer]`/`[Install]` 섹션으로 구성 — directive 를 섹션 단위로
//   격리해 다른 섹션 오검출 방지. 섹션 부재면 빈 배열.
function sliceSection(source: string, section: string): string[] {
  const lines = toLines(source);
  const header = `[${section}]`;
  const start = lines.findIndex((l) => l.trim() === header);
  if (start < 0) return [];
  const rest = lines.slice(start + 1);
  const nextHeaderIdx = rest.findIndex((l) => /^\s*\[[^\]]+\]\s*$/.test(l));
  const body = nextHeaderIdx < 0 ? rest : rest.slice(0, nextHeaderIdx);
  return body;
}

// hasDirectiveInSection(source, section, key, value): 특정 섹션 안에 `key=value` directive 가 존재하는지.
//   value 생략 시 key 존재만 확인(comment `#` 라인은 제외). 실 systemctl 조회 0.
function hasDirectiveInSection(
  source: string,
  section: string,
  key: string,
  value?: string,
): boolean {
  return sliceSection(source, section).some((l) => {
    const t = l.trim();
    if (t.startsWith("#")) return false;
    const m = t.match(/^([^=]+)=(.*)$/);
    if (!m) return false;
    if (m[1].trim() !== key) return false;
    return value === undefined ? true : m[2].trim() === value;
  });
}

// directiveValueInSection(source, section, key): 섹션 안 `key=` directive 의 값(우변) 추출 — 부재면 undefined.
function directiveValueInSection(
  source: string,
  section: string,
  key: string,
): string | undefined {
  for (const l of sliceSection(source, section)) {
    const t = l.trim();
    if (t.startsWith("#")) continue;
    const m = t.match(/^([^=]+)=(.*)$/);
    if (m && m[1].trim() === key) return m[2].trim();
  }
  return undefined;
}

// parseTargetList(value): `After=`/`Wants=` 의 공백 구분 target 목록을 배열로 — `network-online.target docker.service`
//   → [`network-online.target`, `docker.service`]. 부재/빈 값이면 빈 배열.
function parseTargetList(value: string | undefined): string[] {
  if (!value) return [];
  return value.split(/\s+/).filter((t) => t.length > 0);
}

// afterTargetsCoverOrdering(source): `.service` `[Unit]` `After=` 가 network-online.target 과 docker.service
//   **둘 다** 포함 — ordering-before-redeploy 계약. 하나라도 빠지면 false(미준비 의존 위 redeploy 위험).
function afterTargetsCoverOrdering(source: string): boolean {
  const targets = parseTargetList(
    directiveValueInSection(source, "Unit", "After"),
  );
  return (
    targets.includes(NETWORK_ONLINE_TARGET) &&
    targets.includes(DOCKER_SERVICE_TARGET)
  );
}

// wantsTargetsCoverOrdering(source): `.service` `[Unit]` `Wants=` 가 두 대상 모두 포함(soft want).
function wantsTargetsCoverOrdering(source: string): boolean {
  const targets = parseTargetList(
    directiveValueInSection(source, "Unit", "Wants"),
  );
  return (
    targets.includes(NETWORK_ONLINE_TARGET) &&
    targets.includes(DOCKER_SERVICE_TARGET)
  );
}

// parseRandomizedDelaySec(source): `.timer` `[Timer]` `RandomizedDelaySec=` 값을 정수로 파싱 —
//   부재나 비정수면 null(성공-위장 0). systemd 는 `300`/`5min` 등 허용하나 정본은 정수 초 표기.
function parseRandomizedDelaySec(source: string): number | null {
  const raw = directiveValueInSection(source, "Timer", "RandomizedDelaySec");
  if (raw === undefined) return null;
  if (!/^\d+$/.test(raw)) return null;
  return Number.parseInt(raw, 10);
}

// jitterIsBounded(source): RandomizedDelaySec 가 정수이며 ≤ 상한(300) — bounded jitter 계약.
//   부재/비정수/초과면 false.
function jitterIsBounded(source: string): boolean {
  const v = parseRandomizedDelaySec(source);
  return v !== null && v <= JITTER_UPPER_BOUND;
}

// unitStem(basename): unit 파일 basename 에서 확장자(`.service`/`.timer`)를 뗀 stem —
//   `assessment-agent-redeploy.timer` → `assessment-agent-redeploy`. systemd pairing 관례의 키.
function unitStem(basename: string): string {
  return basename.replace(/\.(service|timer)$/, "");
}

// (집계) extractUnitAnchors(serviceSource, timerSource, serviceBasename, timerBasename):
//   6 directive 불변식을 한 번에 집계 — 하나라도 부재면 명시적 false(빈 결과 성공-위장 0).
function extractUnitAnchors(
  serviceSource: string,
  timerSource: string,
  serviceBasename: string,
  timerBasename: string,
): {
  oneshot: boolean;
  afterOrdering: boolean;
  wantsOrdering: boolean;
  persistent: boolean;
  boundedJitter: boolean;
  wantedBy: boolean;
  pairing: boolean;
} {
  return {
    oneshot: hasDirectiveInSection(serviceSource, "Service", "Type", "oneshot"),
    afterOrdering: afterTargetsCoverOrdering(serviceSource),
    wantsOrdering: wantsTargetsCoverOrdering(serviceSource),
    persistent: hasDirectiveInSection(
      timerSource,
      "Timer",
      "Persistent",
      "true",
    ),
    boundedJitter: jitterIsBounded(timerSource),
    wantedBy: hasDirectiveInSection(
      timerSource,
      "Install",
      "WantedBy",
      "timers.target",
    ),
    pairing: unitStem(serviceBasename) === unitStem(timerBasename),
  };
}

describe("realdata-e2e §109 systemd redeploy unit 내부 directive 계약 smoke — .service Type=oneshot + Wants/After=network-online.target docker.service ordering + .timer Persistent=true missed-boot catchup + RandomizedDelaySec≤300 bounded jitter + [Install] WantedBy=timers.target enable + timer↔service basename pairing + secret-safety (T-0961)", () => {
  describe("Happy-path: 두 unit 파일 실존 + 내부 directive 앵커 정적 추출(pure 함수가 실 소스를 mirror)", () => {
    it(".service·.timer 두 파일이 repo-root 기준 실존(existsSync)", () => {
      expect(existsSync(SERVICE_PATH)).toBe(true);
      expect(existsSync(TIMER_PATH)).toBe(true);
    });

    it("7 불변식(oneshot·after ordering·wants ordering·persistent·bounded jitter·wantedBy·pairing) 전부 true", () => {
      const service = readFileSync(SERVICE_PATH, "utf8");
      const timer = readFileSync(TIMER_PATH, "utf8");
      const anchors = extractUnitAnchors(
        service,
        timer,
        SERVICE_BASENAME,
        TIMER_BASENAME,
      );
      expect(anchors.oneshot).toBe(true);
      expect(anchors.afterOrdering).toBe(true);
      expect(anchors.wantsOrdering).toBe(true);
      expect(anchors.persistent).toBe(true);
      expect(anchors.boundedJitter).toBe(true);
      expect(anchors.wantedBy).toBe(true);
      expect(anchors.pairing).toBe(true);
    });
  });

  describe("Happy-path: .service [Service] Type=oneshot(상주 데몬 아님)", () => {
    it("[Service] 섹션에 `Type=oneshot` 존재 — redeploy 는 완료 후 종료(상주 데몬 오인 방지)", () => {
      const service = readFileSync(SERVICE_PATH, "utf8");
      expect(hasDirectiveInSection(service, "Service", "Type", "oneshot")).toBe(
        true,
      );
      // Type=simple 로는 매칭되지 않음(정본은 oneshot).
      expect(hasDirectiveInSection(service, "Service", "Type", "simple")).toBe(
        false,
      );
    });
  });

  describe("Happy-path: .service [Unit] After=/Wants= 가 network-online.target·docker.service 둘 다 포함(ordering-before-redeploy)", () => {
    it("After= 목록이 network-online.target 과 docker.service 두 대상 모두 나열(순서 의존 — docker·네트워크가 redeploy 앞 준비)", () => {
      const service = readFileSync(SERVICE_PATH, "utf8");
      const afterTargets = parseTargetList(
        directiveValueInSection(service, "Unit", "After"),
      );
      expect(afterTargets).toContain(NETWORK_ONLINE_TARGET);
      expect(afterTargets).toContain(DOCKER_SERVICE_TARGET);
      expect(afterTargetsCoverOrdering(service)).toBe(true);
    });

    it("Wants= 목록도 두 대상 모두 나열(soft want — 두 target 활성화 유발)", () => {
      const service = readFileSync(SERVICE_PATH, "utf8");
      const wantsTargets = parseTargetList(
        directiveValueInSection(service, "Unit", "Wants"),
      );
      expect(wantsTargets).toContain(NETWORK_ONLINE_TARGET);
      expect(wantsTargets).toContain(DOCKER_SERVICE_TARGET);
      expect(wantsTargetsCoverOrdering(service)).toBe(true);
    });
  });

  describe("Happy-path: .timer [Timer] Persistent=true(missed-boot catchup)", () => {
    it("[Timer] 섹션에 `Persistent=true` 존재 — 호스트가 03:00 에 꺼져 있었으면 부팅 후 놓친 실행 1회 보충", () => {
      const timer = readFileSync(TIMER_PATH, "utf8");
      expect(hasDirectiveInSection(timer, "Timer", "Persistent", "true")).toBe(
        true,
      );
    });
  });

  describe("Happy-path: .timer [Timer] RandomizedDelaySec bounded jitter(정수 ≤ 300)", () => {
    it("RandomizedDelaySec 값이 정수이며 ≤ 300(최대 5분 — 03:00 창 이탈 방지)", () => {
      const timer = readFileSync(TIMER_PATH, "utf8");
      const jitter = parseRandomizedDelaySec(timer);
      expect(jitter).not.toBeNull();
      expect(Number.isInteger(jitter)).toBe(true);
      expect(jitter as number).toBeLessThanOrEqual(JITTER_UPPER_BOUND);
      expect(jitterIsBounded(timer)).toBe(true);
    });
  });

  describe("Happy-path: .timer [Install] WantedBy=timers.target(부팅 시 자동 시작 enable)", () => {
    it("[Install] 섹션에 `WantedBy=timers.target` 존재 — 없으면 `systemctl enable` 해도 timer 미활성", () => {
      const timer = readFileSync(TIMER_PATH, "utf8");
      expect(
        hasDirectiveInSection(timer, "Install", "WantedBy", "timers.target"),
      ).toBe(true);
    });
  });

  describe("Happy-path: timer↔service basename stem pairing(systemd 관례)", () => {
    it("`.timer` stem == `.service` stem == `assessment-agent-redeploy`(X.timer 가 동일 stem 의 X.service 활성)", () => {
      expect(unitStem(TIMER_BASENAME)).toBe("assessment-agent-redeploy");
      expect(unitStem(SERVICE_BASENAME)).toBe("assessment-agent-redeploy");
      expect(unitStem(TIMER_BASENAME)).toBe(unitStem(SERVICE_BASENAME));
    });
  });

  describe("branch: oneshot 있음/없음 정적 대조", () => {
    it("정본 Type=oneshot → true, mutant(Type=simple) → oneshot 매칭 false(두 입력 분리 실증)", () => {
      const service = readFileSync(SERVICE_PATH, "utf8");
      expect(hasDirectiveInSection(service, "Service", "Type", "oneshot")).toBe(
        true,
      );
      const mutant = service.replace("Type=oneshot", "Type=simple");
      expect(hasDirectiveInSection(mutant, "Service", "Type", "oneshot")).toBe(
        false,
      );
      // 원본 불변.
      expect(hasDirectiveInSection(service, "Service", "Type", "oneshot")).toBe(
        true,
      );
    });
  });

  describe("branch: Persistent 있음/없음 분리", () => {
    it("정본 Persistent=true → true, mutant(라인 제거) → false", () => {
      const timer = readFileSync(TIMER_PATH, "utf8");
      expect(hasDirectiveInSection(timer, "Timer", "Persistent", "true")).toBe(
        true,
      );
      const mutant = timer.replace(/^\s*Persistent=true\s*$/m, "");
      expect(hasDirectiveInSection(mutant, "Timer", "Persistent", "true")).toBe(
        false,
      );
    });
  });

  describe("branch: WantedBy 있음/없음 분리", () => {
    it("정본 [Install] WantedBy=timers.target → true, mutant([Install] 섹션 제거) → false", () => {
      const timer = readFileSync(TIMER_PATH, "utf8");
      expect(
        hasDirectiveInSection(timer, "Install", "WantedBy", "timers.target"),
      ).toBe(true);
      // [Install] 헤더 + WantedBy 라인 제거 → 섹션 자체 소실.
      const mutant = timer
        .replace(/^\s*\[Install\]\s*$/m, "")
        .replace(/^\s*WantedBy=timers\.target\s*$/m, "");
      expect(
        hasDirectiveInSection(mutant, "Install", "WantedBy", "timers.target"),
      ).toBe(false);
    });
  });

  describe("branch: After docker.service 있음/없음 분리", () => {
    it("정본 After= 두 대상 → afterOrdering true, mutant(docker.service 제거) → false", () => {
      const service = readFileSync(SERVICE_PATH, "utf8");
      expect(afterTargetsCoverOrdering(service)).toBe(true);
      const mutant = service.replace(
        "After=network-online.target docker.service",
        "After=network-online.target",
      );
      expect(afterTargetsCoverOrdering(mutant)).toBe(false);
    });
  });

  describe("branch: jitter bounded/초과 분리", () => {
    it("정본 RandomizedDelaySec=300 → bounded true, mutant(=3600) → false(상한 이탈 검출)", () => {
      const timer = readFileSync(TIMER_PATH, "utf8");
      expect(jitterIsBounded(timer)).toBe(true);
      const mutant = timer.replace(
        "RandomizedDelaySec=300",
        "RandomizedDelaySec=3600",
      );
      expect(jitterIsBounded(mutant)).toBe(false);
      expect(parseRandomizedDelaySec(mutant)).toBe(3600);
    });
  });

  describe("branch: pairing 정상/어긋남 분리", () => {
    it("정본 stem 동일 → pairing true, 합성(timer stem 에 접미사) → false", () => {
      expect(unitStem(TIMER_BASENAME)).toBe(unitStem(SERVICE_BASENAME));
      const mutantTimerBasename = "assessment-agent-redeploy-nightly.timer";
      expect(unitStem(mutantTimerBasename)).not.toBe(
        unitStem(SERVICE_BASENAME),
      );
    });
  });

  describe("Error path / negative cases 충분 cover (mutant 합성 사본 — 원본 미변조)", () => {
    it("error path — unit 파일 부재 경로 → readFileSync throw(silent 0-byte fallback 0)", () => {
      const badPath = path.join(REPO_ROOT, "deploy/__does_not_exist__.service");
      expect(existsSync(badPath)).toBe(false);
      expect(() => readFileSync(badPath, "utf8")).toThrow();
    });

    it("error path — directive 부재 시 명시적 false(빈 매칭을 pass 로 오통과 0)", () => {
      const emptyService = "[Unit]\nDescription=x\n";
      const emptyTimer = "[Timer]\nOnCalendar=daily\n";
      const anchors = extractUnitAnchors(
        emptyService,
        emptyTimer,
        SERVICE_BASENAME,
        TIMER_BASENAME,
      );
      expect(anchors.oneshot).toBe(false);
      expect(anchors.afterOrdering).toBe(false);
      expect(anchors.wantsOrdering).toBe(false);
      expect(anchors.persistent).toBe(false);
      expect(anchors.boundedJitter).toBe(false);
      expect(anchors.wantedBy).toBe(false);
      // pairing 은 basename 만으로 판정 — 소스 무관하게 true.
      expect(anchors.pairing).toBe(true);
      // 실 소스는 반대로 directive 전부 true — 부재/실재를 변별함을 대비로 실증.
      const realAnchors = extractUnitAnchors(
        readFileSync(SERVICE_PATH, "utf8"),
        readFileSync(TIMER_PATH, "utf8"),
        SERVICE_BASENAME,
        TIMER_BASENAME,
      );
      expect(realAnchors.oneshot).toBe(true);
      expect(realAnchors.persistent).toBe(true);
      expect(realAnchors.wantedBy).toBe(true);
    });

    it("negative (a) — Type=oneshot→Type=simple mutant → oneshot 계약 위반 검출(상주 데몬 오인 → timer/완료-추적 semantics 붕괴)", () => {
      const service = readFileSync(SERVICE_PATH, "utf8");
      // 정본: oneshot.
      expect(hasDirectiveInSection(service, "Service", "Type", "oneshot")).toBe(
        true,
      );
      // mutant(모델 사본): Type 을 simple 로 변질.
      const mutant = service.replace("Type=oneshot", "Type=simple");
      expect(hasDirectiveInSection(mutant, "Service", "Type", "oneshot")).toBe(
        false,
      );
      expect(
        extractUnitAnchors(
          mutant,
          readFileSync(TIMER_PATH, "utf8"),
          SERVICE_BASENAME,
          TIMER_BASENAME,
        ).oneshot,
      ).toBe(false);
      // 원본 불변(replace 는 사본 반환).
      expect(hasDirectiveInSection(service, "Service", "Type", "oneshot")).toBe(
        true,
      );
    });

    it("negative (b) — Persistent=true 라인 제거 mutant → missed-boot catchup 계약 소실 검출", () => {
      const timer = readFileSync(TIMER_PATH, "utf8");
      // 정본: Persistent=true.
      expect(hasDirectiveInSection(timer, "Timer", "Persistent", "true")).toBe(
        true,
      );
      // mutant(모델 사본): Persistent 라인 제거.
      const mutant = timer.replace(/^\s*Persistent=true\s*$/m, "");
      expect(hasDirectiveInSection(mutant, "Timer", "Persistent", "true")).toBe(
        false,
      );
      // 원본 불변.
      expect(hasDirectiveInSection(timer, "Timer", "Persistent", "true")).toBe(
        true,
      );
    });

    it("negative (c) — [Install]/WantedBy=timers.target 제거 mutant → 부팅-시 enable 계약 소실(timer 미활성) 검출", () => {
      const timer = readFileSync(TIMER_PATH, "utf8");
      // 정본: [Install] WantedBy.
      expect(
        hasDirectiveInSection(timer, "Install", "WantedBy", "timers.target"),
      ).toBe(true);
      // mutant(모델 사본): [Install] 섹션 + WantedBy 라인 제거.
      const mutant = timer
        .replace(/^\s*\[Install\]\s*$/m, "")
        .replace(/^\s*WantedBy=timers\.target\s*$/m, "");
      expect(
        hasDirectiveInSection(mutant, "Install", "WantedBy", "timers.target"),
      ).toBe(false);
      expect(
        extractUnitAnchors(
          readFileSync(SERVICE_PATH, "utf8"),
          mutant,
          SERVICE_BASENAME,
          TIMER_BASENAME,
        ).wantedBy,
      ).toBe(false);
      // 원본 불변.
      expect(
        hasDirectiveInSection(timer, "Install", "WantedBy", "timers.target"),
      ).toBe(true);
    });

    it("negative (d) — After= 에서 docker.service 제거(network-online 만 남김) mutant → 순서 의존 소실(docker 미기동 상태 redeploy → compose 실패) 검출", () => {
      const service = readFileSync(SERVICE_PATH, "utf8");
      // 정본: 두 대상 모두.
      expect(afterTargetsCoverOrdering(service)).toBe(true);
      // mutant(모델 사본): docker.service 제거.
      const mutant = service.replace(
        "After=network-online.target docker.service",
        "After=network-online.target",
      );
      expect(afterTargetsCoverOrdering(mutant)).toBe(false);
      // network-online.target 은 mutant 에도 남음(docker.service 만 소실).
      const afterTargets = parseTargetList(
        directiveValueInSection(mutant, "Unit", "After"),
      );
      expect(afterTargets).toContain(NETWORK_ONLINE_TARGET);
      expect(afterTargets).not.toContain(DOCKER_SERVICE_TARGET);
      // 원본 불변.
      expect(afterTargetsCoverOrdering(service)).toBe(true);
    });

    it("negative (e) — RandomizedDelaySec=300→3600(상한 초과) mutant → bounded jitter(≤300) 계약 위반 검출", () => {
      const timer = readFileSync(TIMER_PATH, "utf8");
      // 정본: bounded.
      expect(jitterIsBounded(timer)).toBe(true);
      // mutant(모델 사본): 상한 초과값.
      const mutant = timer.replace(
        "RandomizedDelaySec=300",
        "RandomizedDelaySec=3600",
      );
      expect(jitterIsBounded(mutant)).toBe(false);
      expect(
        (parseRandomizedDelaySec(mutant) as number) > JITTER_UPPER_BOUND,
      ).toBe(true);
      // 원본 불변.
      expect(jitterIsBounded(timer)).toBe(true);
    });

    it("negative (f) — timer/service basename stem 을 서로 다르게 만든 합성 mutant → timer↔service pairing 위반 검출", () => {
      // 정본: stem 동일.
      expect(unitStem(TIMER_BASENAME)).toBe(unitStem(SERVICE_BASENAME));
      const anchors = extractUnitAnchors(
        readFileSync(SERVICE_PATH, "utf8"),
        readFileSync(TIMER_PATH, "utf8"),
        SERVICE_BASENAME,
        TIMER_BASENAME,
      );
      expect(anchors.pairing).toBe(true);
      // mutant(모델 사본): timer basename stem 에 접미사 추가 → stem 어긋남.
      const mutantAnchors = extractUnitAnchors(
        readFileSync(SERVICE_PATH, "utf8"),
        readFileSync(TIMER_PATH, "utf8"),
        SERVICE_BASENAME,
        "assessment-agent-redeploy-nightly.timer",
      );
      expect(mutantAnchors.pairing).toBe(false);
    });

    it("negative (g) — credential/secret 누출 0: 추출/합성 문자열에 gh 토큰 어휘·credential 실값·실 endpoint 미등장(§9/REQ-059)", () => {
      const service = readFileSync(SERVICE_PATH, "utf8");
      const timer = readFileSync(TIMER_PATH, "utf8");
      const synthesized = [
        JSON.stringify(
          extractUnitAnchors(service, timer, SERVICE_BASENAME, TIMER_BASENAME),
        ),
        JSON.stringify(
          parseTargetList(directiveValueInSection(service, "Unit", "After")),
        ),
        JSON.stringify(
          parseTargetList(directiveValueInSection(service, "Unit", "Wants")),
        ),
        String(parseRandomizedDelaySec(timer)),
        unitStem(SERVICE_BASENAME),
        unitStem(TIMER_BASENAME),
      ];
      const credentialPattern =
        /(ghp_|--token|GITHUB_TOKEN|GH_TOKEN|\bBearer\b|Authorization|\bsk-|password|passwd|secret)/i;
      synthesized.forEach((s) => {
        expect(credentialPattern.test(s)).toBe(false);
      });
      // 실 unit 소스 자체도 토큰/secret 어휘 미포함(directive 키·값·target·경로·User=root 만).
      expect(credentialPattern.test(service)).toBe(false);
      expect(credentialPattern.test(timer)).toBe(false);
      // 추출 토큰은 실 endpoint(IP/URL) 도 미포함.
      expect(service).not.toMatch(/https?:\/\/\d+\.\d+\.\d+\.\d+/);
      expect(timer).not.toMatch(/https?:\/\/\d+\.\d+\.\d+\.\d+/);
      // User=root 는 권한 모델 진단 값일 뿐 secret 아님 — 존재만 확인(값은 secret 표면 아님).
      expect(hasDirectiveInSection(service, "Service", "User", "root")).toBe(
        true,
      );
    });
  });

  describe("flow: 결정론 · no-mutation(원본 read-only 입증)", () => {
    it("동일 입력으로 pure 함수를 두 번 호출하면 deep-equal(결정론)", () => {
      const service = readFileSync(SERVICE_PATH, "utf8");
      const timer = readFileSync(TIMER_PATH, "utf8");
      expect(
        extractUnitAnchors(service, timer, SERVICE_BASENAME, TIMER_BASENAME),
      ).toEqual(
        extractUnitAnchors(service, timer, SERVICE_BASENAME, TIMER_BASENAME),
      );
      expect(
        parseTargetList(directiveValueInSection(service, "Unit", "After")),
      ).toEqual(
        parseTargetList(directiveValueInSection(service, "Unit", "After")),
      );
      expect(parseRandomizedDelaySec(timer)).toBe(
        parseRandomizedDelaySec(timer),
      );
    });

    it("합성 mutate(사본 replace) 후에도 원본 소스 텍스트·pure 함수 산출이 불변(원본 read-only)", () => {
      const service = readFileSync(SERVICE_PATH, "utf8");
      const timer = readFileSync(TIMER_PATH, "utf8");
      const serviceSnapshot = service;
      const timerSnapshot = timer;
      // 사본 mutate(negative a/d 에서 쓰는 replace) — 원본 불변 확인.
      service.replace("Type=oneshot", "Type=simple");
      service.replace(
        "After=network-online.target docker.service",
        "After=network-online.target",
      );
      timer.replace(/^\s*Persistent=true\s*$/m, "");
      timer.replace("RandomizedDelaySec=300", "RandomizedDelaySec=3600");
      expect(service).toBe(serviceSnapshot);
      expect(timer).toBe(timerSnapshot);
      // 추출/파싱 후에도 원본 불변.
      extractUnitAnchors(service, timer, SERVICE_BASENAME, TIMER_BASENAME);
      expect(service).toBe(serviceSnapshot);
      expect(timer).toBe(timerSnapshot);
    });
  });

  describe("dormant / non-gated 확인 — side-effect 0", () => {
    it("directive 해석 모델이 env / 전역 상태 없이 순수하게 동작(non-gated — describe.skip 0·gating 분기 0)", () => {
      // 본 describe 가 실행된다는 것 자체가 describe.skip 0(항상 실행)의 런타임 증거.
      const envSnapshot = { ...process.env };
      const timer = readFileSync(TIMER_PATH, "utf8");
      const before = parseRandomizedDelaySec(timer);
      // 실 process.env 를 mutate 해도 산출 불변 — 모델이 process.env 를 참조하지 않음(파라미터로만).
      Object.assign(process.env, { REDEPLOY_UNIT_TEST: "x" });
      const after = parseRandomizedDelaySec(timer);
      delete process.env.REDEPLOY_UNIT_TEST;
      expect(after).toBe(before);
      expect(Object.keys(process.env)).toEqual(Object.keys(envSnapshot));
    });

    it("파일 read 는 deploy/assessment-agent-redeploy.{service,timer} 읽기만 — 실 systemctl/timer/redeploy/docker 실행 0. systemd unit 은 조건 분기 없는 선언적 directive 파일 — 런타임 분기 없음(선언적 directive)이라 happy/negative mutant 로 대체 cover", () => {
      const service = readFileSync(SERVICE_PATH, "utf8");
      const timer = readFileSync(TIMER_PATH, "utf8");
      expect(hasDirectiveInSection(service, "Service", "Type", "oneshot")).toBe(
        true,
      );
      expect(afterTargetsCoverOrdering(service)).toBe(true);
      expect(hasDirectiveInSection(timer, "Timer", "Persistent", "true")).toBe(
        true,
      );
      expect(jitterIsBounded(timer)).toBe(true);
      expect(
        hasDirectiveInSection(timer, "Install", "WantedBy", "timers.target"),
      ).toBe(true);
    });
  });
});
