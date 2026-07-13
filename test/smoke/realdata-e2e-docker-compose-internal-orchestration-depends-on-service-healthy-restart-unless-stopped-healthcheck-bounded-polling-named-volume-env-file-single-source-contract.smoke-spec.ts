// realdata-e2e-docker-compose-internal-orchestration-depends-on-service-healthy-restart-unless-stopped-healthcheck-bounded-polling-named-volume-env-file-single-source-contract.smoke-spec.ts
// — 무인 nightly 재배포 runner chain(daily-test.sh · redeploy.sh · seed-llm-config.sh · docker-entrypoint.sh)
// 의 런타임-스택 leg — `redeploy.sh` 가 `docker compose up -d --build` 한 번으로 구동하는
// `docker-compose.yml` 의 **내부 오케스트레이션 semantic 계약**을 실 compose 파일을 readFileSync 로
// 읽어(실 docker compose up/실 docker build/실 컨테이너 부팅/실 postgres healthcheck/실 DB/실 HTTP 0)
// 정적 검증하는 non-gated build-time smoke (T-0962, PLAN.md §109 재배포 runner chain — 런타임-스택 leg).
//
// 봉함 불변식(compose 자신의 내부 오케스트레이션 semantic — T-0795 outer wiring parity 와 distinct 상보):
//   (a) `app.depends_on.postgres.condition: service_healthy` — app 은 postgres 가 healthy 이후에만 기동
//       (startup ordering 게이트, docker-entrypoint 의 migration-before-boot 전제). service_started 로
//       변질되면 DB ready 전 app 기동 → `prisma migrate deploy` 가 DB 미연결로 실패.
//   (b) `postgres`·`app` 두 서비스 **모두** `restart: unless-stopped` — crash/재부팅 후 자동 복구.
//       소실 시 무인 야간 배포 후 컨테이너가 조용히 down 유지.
//   (c) `postgres.healthcheck` 의 bounded polling — `interval`/`timeout`/`retries` 세 값 모두 존재하고
//       유한(interval/timeout 은 양의 시간값, retries 는 양의 정수). 이탈 시 DB ready 판정 window 가
//       무한/0 으로 붕괴해 depends_on 게이트 오작동.
//   (d) `postgres-data` named volume 영속 — postgres 가 `postgres-data:/var/lib/postgresql/data` 로
//       마운트 AND top-level `volumes.postgres-data` 선언 존재 AND 두 이름 일치. 미선언/불일치 시
//       anonymous volume 격하 → 컨테이너 재생성마다 DB 데이터 소멸(평가 결과 영영 유실).
//   (e) `app.env_file: .env` single-source secret 주입 — DATABASE_URL/AUTH_JWT_SECRET 등이 .env 한
//       곳에서 주입(§9 commit 금지 대상). 소실 시 app 부팅 실패.
//   (f) healthcheck↔depends_on 상호 의존 — healthcheck 가 존재해야 service_healthy condition 이 유효
//       (healthcheck 부재 시 condition 영원히 충족 불가 → app 무한 대기).
//   (g) §9 secret-safety — 추출/합성 토큰에 실 토큰·secret 실값·실 endpoint 0(오케스트레이션 키·
//       condition/restart/interval/timeout/retries 값·volume 이름·.env 파일명·서비스명만).
//       compose 의 `${POSTGRES_PASSWORD:-change_me_in_env}` 는 env-substitution placeholder(실값 아님).
//
// 전략(형제 T-0961 systemd unit 내부 directive·T-0960 docker-entrypoint 내부 시퀀스 동형): compose 파일에서
// services/volumes 블록·nested directive 토큰을 정적 추출하는 해석 동형 TS 순수 함수(`sliceTopLevelBlock`·
// `sliceServiceBlock`·`sliceNested`·`nestedDirectiveValue`·`serviceHasDirective`·`extractComposeAnchors`)로
// 오케스트레이션 불변식 assert. 합성 mutant 사본으로 negative(a~f 6종) 변별.
// 기존 `realdata-e2e-docker-compose-orchestration-contract-artifact-parity-drift.smoke-spec.ts`
// (T-0795: build.dockerfile 경로·PORT 4중 byte-identical·postgres image 상수·healthcheck env **이름**·
// DATABASE_URL host:port cross-artifact parity) 와 distinct 상보 surface — 본 task 는 그 5 표면을
// 재검증하지 않는다(중복 금지). 본 task 는 compose 내부 오케스트레이션 semantic(depends_on 게이트·restart
// 정책·healthcheck **timing** semantic·named volume 영속·env_file single-source)만.
//   🔥 실 docker compose up/실 docker build/실 컨테이너 부팅/실 postgres healthcheck/실 DB/실 HTTP 0
//      · process.env 읽기 0(입력은 pure 함수 파라미터) · credential 0(§9/REQ-059) · 새 dep 0(node fs/path,
//      YAML 파서 추가 0) · src 변경 0(test-only) · docker-compose.yml 읽기만(실행 0 · 변경 0).
import { existsSync, readFileSync } from "fs";
import * as path from "path";

// repo-root 경로 — test 실행 cwd 무관하게 robust 하게 해석(`__dirname` = test/smoke,
// 두 단계 위가 repo-root). `process.cwd()` 대신 `__dirname` 기준 상대로 고정한다(sibling T-0961).
const REPO_ROOT = path.resolve(__dirname, "../..");
const COMPOSE_PATH = path.join(REPO_ROOT, "docker-compose.yml");

// 정본 앵커(실 compose 표현의 TS mirror — 실 docker compose 실행 0).
const NAMED_VOLUME = "postgres-data"; // postgres 데이터 named volume 이름.
const VOLUME_TARGET = "/var/lib/postgresql/data"; // postgres 데이터 디렉토리(마운트 지점).
const ENV_FILE = ".env"; // app secret single-source 주입 파일.

// ── TS 동형 pure 함수(정본) — docker-compose.yml 의 services/volumes 블록·nested directive 를 모델링.
//    입력(문자열)은 mutate 하지 않는다(읽기만). 실 docker/env 읽기 0 — 입력은 파라미터.
//    전체 YAML 스펙 파싱이 아니라 indent 기반 블록 슬라이스 + 필요한 오케스트레이션 토큰만 추출.

// 소스를 CRLF-정규화 후 라인 배열로 — 모든 파서의 공통 입력.
function toLines(source: string): string[] {
  return source.replace(/\r\n/g, "\n").split("\n");
}

// 라인의 선행 공백(indent) 폭.
function indentOf(line: string): number {
  const m = line.match(/^\s*/);
  return m ? m[0].length : 0;
}

// sliceTopLevelBlock(source, key): column-0 헤더 `key:` 부터 다음 column-0 라인(또는 EOF) 직전까지의
//   라인 배열 추출. `services:`/`volumes:` 같은 최상위 블록 격리. 부재면 빈 배열.
function sliceTopLevelBlock(source: string, key: string): string[] {
  const lines = toLines(source);
  const start = lines.findIndex((l) => new RegExp(`^${key}:\\s*$`).test(l));
  if (start < 0) return [];
  const rest = lines.slice(start + 1);
  // 다음 최상위(비들여쓰기) 라인 직전까지 — 빈 줄/주석은 블록에 포함해도 무해.
  const nextTop = rest.findIndex((l) => /^\S/.test(l));
  return nextTop < 0 ? rest : rest.slice(0, nextTop);
}

// sliceServiceBlock(source, serviceName): `services:` 블록 안 2-space 들여쓰기 `  serviceName:` 헤더부터
//   다음 2-space 헤더(다른 서비스) 또는 블록 끝까지. 부재면 빈 배열.
function sliceServiceBlock(source: string, serviceName: string): string[] {
  const svc = sliceTopLevelBlock(source, "services");
  const start = svc.findIndex((l) =>
    new RegExp(`^ {2}${serviceName}:\\s*$`).test(l),
  );
  if (start < 0) return [];
  const rest = svc.slice(start + 1);
  const nextSvc = rest.findIndex((l) => /^ {2}\S/.test(l));
  return nextSvc < 0 ? rest : rest.slice(0, nextSvc);
}

// sliceNested(block, key): 블록 안 `key:` 라인 직후, 그 라인보다 더 깊이 들여쓴 라인들만 추출.
//   depends_on/healthcheck/volumes/env_file 같은 nested mapping/list 를 격리. 부재면 빈 배열.
function sliceNested(block: string[], key: string): string[] {
  const idx = block.findIndex((l) => l.trim() === `${key}:`);
  if (idx < 0) return [];
  const baseIndent = indentOf(block[idx]);
  const out: string[] = [];
  for (const l of block.slice(idx + 1)) {
    if (l.trim() === "") {
      out.push(l);
      continue;
    }
    if (indentOf(l) <= baseIndent) break;
    out.push(l);
  }
  return out;
}

// serviceHasDirective(block, key, value?): 블록 안에 `key: value` 매핑 directive 존재 여부.
//   value 생략 시 key 존재만(comment `#` 제외). list 항목(`- x`)은 제외.
function serviceHasDirective(
  block: string[],
  key: string,
  value?: string,
): boolean {
  return block.some((l) => {
    const t = l.trim();
    if (t.startsWith("#") || t.startsWith("- ")) return false;
    const m = t.match(/^([^:]+):\s*(.*)$/);
    if (!m) return false;
    if (m[1].trim() !== key) return false;
    return value === undefined ? true : m[2].trim() === value;
  });
}

// nestedDirectiveValue(block, key): 블록 안 `key: value` 매핑의 값(우변) 추출 — 부재면 undefined.
function nestedDirectiveValue(
  block: string[],
  key: string,
): string | undefined {
  for (const l of block) {
    const t = l.trim();
    if (t.startsWith("#") || t.startsWith("- ")) continue;
    const m = t.match(/^([^:]+):\s*(.*)$/);
    if (m && m[1].trim() === key) return m[2].trim();
  }
  return undefined;
}

// listEntries(block): 블록 안 `- item` 리스트 항목들을 배열로(앞의 `- ` 제거·comment 제외).
function listEntries(block: string[]): string[] {
  return block
    .map((l) => l.trim())
    .filter((t) => t.startsWith("- "))
    .map((t) => t.slice(2).trim());
}

// dependsOnServiceHealthy(source): `app.depends_on.postgres.condition: service_healthy` 존재 —
//   app 이 postgres healthy 이후에만 기동하는 startup ordering 게이트. 부재/service_started 면 false.
function dependsOnServiceHealthy(source: string): boolean {
  const app = sliceServiceBlock(source, "app");
  const dependsOn = sliceNested(app, "depends_on");
  const postgresDep = sliceNested(dependsOn, "postgres");
  return serviceHasDirective(postgresDep, "condition", "service_healthy");
}

// serviceHasRestartUnlessStopped(source, service): 서비스에 `restart: unless-stopped` 존재.
function serviceHasRestartUnlessStopped(
  source: string,
  service: string,
): boolean {
  return serviceHasDirective(
    sliceServiceBlock(source, service),
    "restart",
    "unless-stopped",
  );
}

// isBoundedTime(v): healthcheck interval/timeout 값이 양의 유한 시간값(정수 + 선택 단위 ms/s/m/h).
//   부재/0/음수/비수치면 false.
function isBoundedTime(v: string | undefined): boolean {
  if (v === undefined) return false;
  const m = v.match(/^(\d+)(ms|s|m|h)?$/);
  if (!m) return false;
  return Number.parseInt(m[1], 10) > 0;
}

// isBoundedRetries(v): healthcheck retries 값이 양의 정수(≥1) — DB ready 판정이 유한 횟수로 종료.
//   부재/0/음수/비정수면 false(무한/즉시 붕괴 검출).
function isBoundedRetries(v: string | undefined): boolean {
  if (v === undefined) return false;
  if (!/^\d+$/.test(v)) return false;
  return Number.parseInt(v, 10) >= 1;
}

// healthcheckBoundedPolling(source): postgres.healthcheck 의 interval/timeout/retries 세 값이
//   모두 존재하고 유한·bounded. 하나라도 부재/붕괴면 false.
function healthcheckBoundedPolling(source: string): boolean {
  const hc = postgresHealthcheck(source);
  if (hc.length === 0) return false;
  return (
    isBoundedTime(nestedDirectiveValue(hc, "interval")) &&
    isBoundedTime(nestedDirectiveValue(hc, "timeout")) &&
    isBoundedRetries(nestedDirectiveValue(hc, "retries"))
  );
}

// postgresHealthcheck(source): postgres 서비스의 healthcheck nested 블록 — 부재면 빈 배열.
function postgresHealthcheck(source: string): string[] {
  return sliceNested(sliceServiceBlock(source, "postgres"), "healthcheck");
}

// serviceVolumeMounts(source, service): 서비스 volumes 리스트를 {name, target} 배열로 파싱 —
//   `- postgres-data:/var/lib/postgresql/data` → {name: "postgres-data", target: "/var/lib/postgresql/data"}.
function serviceVolumeMounts(
  source: string,
  service: string,
): { name: string; target: string }[] {
  const vols = sliceNested(sliceServiceBlock(source, service), "volumes");
  return listEntries(vols).map((entry) => {
    const idx = entry.indexOf(":");
    return idx < 0
      ? { name: entry, target: "" }
      : { name: entry.slice(0, idx), target: entry.slice(idx + 1) };
  });
}

// topLevelVolumeNames(source): top-level `volumes:` 블록에 선언된 named volume 이름들(2-space 헤더).
function topLevelVolumeNames(source: string): string[] {
  return sliceTopLevelBlock(source, "volumes")
    .filter((l) => /^ {2}\S+:\s*$/.test(l))
    .map((l) => l.trim().replace(/:$/, ""));
}

// namedVolumeConsistent(source): postgres 가 마운트하는 volume 이름이 top-level 선언에 존재 —
//   미선언 참조(anonymous volume 격하 → 영속성 상실) 검출.
function namedVolumeConsistent(source: string): boolean {
  const declared = topLevelVolumeNames(source);
  const mounts = serviceVolumeMounts(source, "postgres");
  return mounts.length > 0 && mounts.every((m) => declared.includes(m.name));
}

// appEnvFileEntries(source): app.env_file 리스트 항목(파일명) 배열.
function appEnvFileEntries(source: string): string[] {
  return listEntries(sliceNested(sliceServiceBlock(source, "app"), "env_file"));
}

// (집계) extractComposeAnchors(source): 내부 오케스트레이션 불변식을 한 번에 집계 —
//   하나라도 부재/변질이면 명시적 false(빈 결과 성공-위장 0).
function extractComposeAnchors(source: string): {
  dependsHealthy: boolean;
  postgresRestart: boolean;
  appRestart: boolean;
  healthcheckPresent: boolean;
  boundedPolling: boolean;
  volumeConsistent: boolean;
  volumeDeclared: boolean;
  envFileDotEnv: boolean;
} {
  return {
    dependsHealthy: dependsOnServiceHealthy(source),
    postgresRestart: serviceHasRestartUnlessStopped(source, "postgres"),
    appRestart: serviceHasRestartUnlessStopped(source, "app"),
    healthcheckPresent: postgresHealthcheck(source).length > 0,
    boundedPolling: healthcheckBoundedPolling(source),
    volumeConsistent: namedVolumeConsistent(source),
    volumeDeclared: topLevelVolumeNames(source).includes(NAMED_VOLUME),
    envFileDotEnv: appEnvFileEntries(source).includes(ENV_FILE),
  };
}

describe("realdata-e2e §109 docker-compose.yml 내부 오케스트레이션 계약 smoke — app.depends_on.postgres.condition=service_healthy 기동-순서 게이트 + postgres/app restart=unless-stopped ×2 + postgres.healthcheck bounded polling(interval/timeout/retries) + postgres-data named volume 영속 + app.env_file=.env single-source secret 주입 + secret-safety (T-0962)", () => {
  describe("Happy-path: docker-compose.yml 실존 + 내부 오케스트레이션 앵커 정적 추출(pure 함수가 실 소스를 mirror)", () => {
    it("docker-compose.yml 이 repo-root 기준 실존(existsSync)", () => {
      expect(existsSync(COMPOSE_PATH)).toBe(true);
    });

    it("8 불변식(depends healthy·postgres restart·app restart·healthcheck 존재·bounded polling·volume 일치·volume 선언·env_file .env) 전부 true", () => {
      const source = readFileSync(COMPOSE_PATH, "utf8");
      const anchors = extractComposeAnchors(source);
      expect(anchors.dependsHealthy).toBe(true);
      expect(anchors.postgresRestart).toBe(true);
      expect(anchors.appRestart).toBe(true);
      expect(anchors.healthcheckPresent).toBe(true);
      expect(anchors.boundedPolling).toBe(true);
      expect(anchors.volumeConsistent).toBe(true);
      expect(anchors.volumeDeclared).toBe(true);
      expect(anchors.envFileDotEnv).toBe(true);
    });
  });

  describe("Happy-path: app.depends_on.postgres.condition=service_healthy(기동-순서 게이트)", () => {
    it("app 은 postgres 가 healthy 이후에만 기동 — condition: service_healthy 존재(migration-before-boot 전제)", () => {
      const source = readFileSync(COMPOSE_PATH, "utf8");
      expect(dependsOnServiceHealthy(source)).toBe(true);
      // service_started 가 아니라 service_healthy 인지 명시 확인.
      const app = sliceServiceBlock(source, "app");
      const postgresDep = sliceNested(
        sliceNested(app, "depends_on"),
        "postgres",
      );
      expect(
        serviceHasDirective(postgresDep, "condition", "service_started"),
      ).toBe(false);
    });
  });

  describe("Happy-path: postgres·app 두 서비스 모두 restart=unless-stopped(자동 복구 ×2)", () => {
    it("postgres 서비스에 restart: unless-stopped 존재(crash/재부팅 후 자동 복구)", () => {
      const source = readFileSync(COMPOSE_PATH, "utf8");
      expect(serviceHasRestartUnlessStopped(source, "postgres")).toBe(true);
    });

    it("app 서비스에 restart: unless-stopped 존재(무인 야간 배포 후 조용히 down 방지)", () => {
      const source = readFileSync(COMPOSE_PATH, "utf8");
      expect(serviceHasRestartUnlessStopped(source, "app")).toBe(true);
    });
  });

  describe("Happy-path: postgres.healthcheck bounded polling(interval/timeout/retries 유한)", () => {
    it("interval·timeout·retries 세 값 모두 존재하고 각각 양의 유한값(DB ready 판정 window 유한)", () => {
      const source = readFileSync(COMPOSE_PATH, "utf8");
      const hc = postgresHealthcheck(source);
      expect(hc.length).toBeGreaterThan(0);
      expect(isBoundedTime(nestedDirectiveValue(hc, "interval"))).toBe(true);
      expect(isBoundedTime(nestedDirectiveValue(hc, "timeout"))).toBe(true);
      expect(isBoundedRetries(nestedDirectiveValue(hc, "retries"))).toBe(true);
      expect(healthcheckBoundedPolling(source)).toBe(true);
    });
  });

  describe("Happy-path: postgres-data named volume 영속(마운트 + top-level 선언 + 이름 일치)", () => {
    it("postgres 가 postgres-data:/var/lib/postgresql/data 로 named volume 을 데이터 디렉토리에 마운트", () => {
      const source = readFileSync(COMPOSE_PATH, "utf8");
      const mounts = serviceVolumeMounts(source, "postgres");
      expect(mounts).toContainEqual({
        name: NAMED_VOLUME,
        target: VOLUME_TARGET,
      });
    });

    it("top-level volumes 블록에 postgres-data 선언 존재(컨테이너 재생성 간 DB 데이터 생존)", () => {
      const source = readFileSync(COMPOSE_PATH, "utf8");
      expect(topLevelVolumeNames(source)).toContain(NAMED_VOLUME);
    });
  });

  describe("Happy-path: app.env_file=.env single-source secret 주입", () => {
    it("app.env_file 에 .env 존재 — DATABASE_URL/AUTH_JWT_SECRET 등이 .env 한 곳에서 주입(§9 commit 금지)", () => {
      const source = readFileSync(COMPOSE_PATH, "utf8");
      expect(appEnvFileEntries(source)).toContain(ENV_FILE);
    });
  });

  describe("healthcheck↔depends_on 연결 계약: healthcheck 가 있어야 service_healthy 게이트가 유효", () => {
    it("postgres.healthcheck 존재 AND app.depends_on service_healthy 존재 — 두 토큰 상호 의존(healthcheck 부재 시 게이트 무한 대기)", () => {
      const source = readFileSync(COMPOSE_PATH, "utf8");
      expect(postgresHealthcheck(source).length).toBeGreaterThan(0);
      expect(dependsOnServiceHealthy(source)).toBe(true);
    });
  });

  describe("named-volume 영속 정합 계약: 서비스 마운트 이름 == top-level 선언 이름", () => {
    it("postgres 가 참조하는 volume 이름이 top-level 선언에 존재(미선언 참조 → anonymous volume 격하 검출)", () => {
      const source = readFileSync(COMPOSE_PATH, "utf8");
      const mountName = serviceVolumeMounts(source, "postgres")[0].name;
      expect(topLevelVolumeNames(source)).toContain(mountName);
      expect(namedVolumeConsistent(source)).toBe(true);
    });
  });

  describe("branch: 각 불변식 있음/없음 정적 대조(합성 mutant 사본 — 원본 미변조)", () => {
    it("depends_on service_healthy 있음/없음 분기", () => {
      const source = readFileSync(COMPOSE_PATH, "utf8");
      expect(dependsOnServiceHealthy(source)).toBe(true);
      const mutant = source.replace(
        "condition: service_healthy",
        "condition: service_started",
      );
      expect(dependsOnServiceHealthy(mutant)).toBe(false);
      // 원본 불변.
      expect(dependsOnServiceHealthy(source)).toBe(true);
    });

    it("app restart 있음/없음 분기", () => {
      const source = readFileSync(COMPOSE_PATH, "utf8");
      expect(serviceHasRestartUnlessStopped(source, "app")).toBe(true);
      // app 의 restart 만 제거(container_name 앵커로 정밀 타겟 — postgres restart 는 보존).
      const mutant = source.replace(
        /container_name: assessment-agent-app\n\s*restart: unless-stopped\n/,
        "container_name: assessment-agent-app\n",
      );
      expect(serviceHasRestartUnlessStopped(mutant, "app")).toBe(false);
      // postgres restart 는 mutant 에도 남음.
      expect(serviceHasRestartUnlessStopped(mutant, "postgres")).toBe(true);
    });

    it("healthcheck retries 있음/없음(붕괴) 분기", () => {
      const source = readFileSync(COMPOSE_PATH, "utf8");
      expect(healthcheckBoundedPolling(source)).toBe(true);
      const mutant = source.replace(/\n\s*retries: 10/, "");
      expect(healthcheckBoundedPolling(mutant)).toBe(false);
    });

    it("top-level volume 선언 있음/없음 분기", () => {
      const source = readFileSync(COMPOSE_PATH, "utf8");
      expect(topLevelVolumeNames(source)).toContain(NAMED_VOLUME);
      const mutant = source.replace(
        /\nvolumes:\n\s*postgres-data:\n\s*name:[^\n]*\n?/,
        "\n",
      );
      expect(topLevelVolumeNames(mutant)).not.toContain(NAMED_VOLUME);
    });

    it("env_file .env 있음/없음 분기", () => {
      const source = readFileSync(COMPOSE_PATH, "utf8");
      expect(appEnvFileEntries(source)).toContain(ENV_FILE);
      const mutant = source.replace(/\n\s*env_file:\n\s*- \.env/, "");
      expect(appEnvFileEntries(mutant)).not.toContain(ENV_FILE);
    });

    it("volume 이름 일치/불일치 분기", () => {
      const source = readFileSync(COMPOSE_PATH, "utf8");
      expect(namedVolumeConsistent(source)).toBe(true);
      const mutant = source.replace(
        "- postgres-data:/var/lib/postgresql/data",
        "- pg-data:/var/lib/postgresql/data",
      );
      expect(namedVolumeConsistent(mutant)).toBe(false);
    });
  });

  describe("Error path / negative cases 충분 cover (mutant 합성 사본 — 원본 미변조)", () => {
    it("error path — compose 파일 부재 경로 → readFileSync throw(silent 0-byte fallback 0)", () => {
      const badPath = path.join(REPO_ROOT, "__does_not_exist__.yml");
      expect(existsSync(badPath)).toBe(false);
      expect(() => readFileSync(badPath, "utf8")).toThrow();
    });

    it("error path — 오케스트레이션 토큰 부재 시 명시적 false(빈 매칭을 pass 로 오통과 0)", () => {
      const emptyCompose = "services:\n  app:\n    image: x\nvolumes:\n";
      const anchors = extractComposeAnchors(emptyCompose);
      expect(anchors.dependsHealthy).toBe(false);
      expect(anchors.postgresRestart).toBe(false);
      expect(anchors.appRestart).toBe(false);
      expect(anchors.healthcheckPresent).toBe(false);
      expect(anchors.boundedPolling).toBe(false);
      expect(anchors.volumeConsistent).toBe(false);
      expect(anchors.volumeDeclared).toBe(false);
      expect(anchors.envFileDotEnv).toBe(false);
      // 실 소스는 반대로 전부 true — 부재/실재를 변별함을 대비로 실증.
      const real = extractComposeAnchors(readFileSync(COMPOSE_PATH, "utf8"));
      expect(real.dependsHealthy).toBe(true);
      expect(real.boundedPolling).toBe(true);
      expect(real.volumeConsistent).toBe(true);
    });

    it("negative (a) — condition: service_healthy→service_started mutant → healthy-gate 계약 위반 검출(DB ready 전 app 기동 → migration 실패 위험)", () => {
      const source = readFileSync(COMPOSE_PATH, "utf8");
      expect(dependsOnServiceHealthy(source)).toBe(true);
      const mutant = source.replace(
        "condition: service_healthy",
        "condition: service_started",
      );
      expect(dependsOnServiceHealthy(mutant)).toBe(false);
      expect(extractComposeAnchors(mutant).dependsHealthy).toBe(false);
      // 원본 불변(replace 는 사본 반환).
      expect(dependsOnServiceHealthy(source)).toBe(true);
    });

    it("negative (b) — app restart: unless-stopped 라인 제거 mutant → app restart 정책 소실 검출", () => {
      const source = readFileSync(COMPOSE_PATH, "utf8");
      expect(serviceHasRestartUnlessStopped(source, "app")).toBe(true);
      const mutant = source.replace(
        /container_name: assessment-agent-app\n\s*restart: unless-stopped\n/,
        "container_name: assessment-agent-app\n",
      );
      expect(serviceHasRestartUnlessStopped(mutant, "app")).toBe(false);
      // postgres restart 는 보존(app 만 소실).
      expect(serviceHasRestartUnlessStopped(mutant, "postgres")).toBe(true);
      // 원본 불변.
      expect(serviceHasRestartUnlessStopped(source, "app")).toBe(true);
    });

    it("negative (c) — postgres.healthcheck retries: 10 제거 mutant → bounded polling 계약 소실/붕괴 검출", () => {
      const source = readFileSync(COMPOSE_PATH, "utf8");
      expect(healthcheckBoundedPolling(source)).toBe(true);
      const mutant = source.replace(/\n\s*retries: 10/, "");
      expect(healthcheckBoundedPolling(mutant)).toBe(false);
      // retries: 0 도 붕괴로 검출(무한/즉시 판정).
      const zeroMutant = source.replace("retries: 10", "retries: 0");
      expect(isBoundedRetries("0")).toBe(false);
      expect(healthcheckBoundedPolling(zeroMutant)).toBe(false);
      // 원본 불변.
      expect(healthcheckBoundedPolling(source)).toBe(true);
    });

    it("negative (d) — top-level volumes.postgres-data 선언 제거 mutant → named volume 미선언(영속성 상실) 검출", () => {
      const source = readFileSync(COMPOSE_PATH, "utf8");
      expect(topLevelVolumeNames(source)).toContain(NAMED_VOLUME);
      const mutant = source.replace(
        /\nvolumes:\n\s*postgres-data:\n\s*name:[^\n]*\n?/,
        "\n",
      );
      expect(topLevelVolumeNames(mutant)).not.toContain(NAMED_VOLUME);
      // 서비스는 여전히 마운트를 참조하지만 top-level 미선언 → 일치성 붕괴.
      expect(namedVolumeConsistent(mutant)).toBe(false);
      expect(extractComposeAnchors(mutant).volumeDeclared).toBe(false);
      // 원본 불변.
      expect(topLevelVolumeNames(source)).toContain(NAMED_VOLUME);
    });

    it("negative (e) — app.env_file 의 .env 제거 mutant → secret single-source 주입 계약 소실 검출", () => {
      const source = readFileSync(COMPOSE_PATH, "utf8");
      expect(appEnvFileEntries(source)).toContain(ENV_FILE);
      const mutant = source.replace(/\n\s*env_file:\n\s*- \.env/, "");
      expect(appEnvFileEntries(mutant)).not.toContain(ENV_FILE);
      expect(extractComposeAnchors(mutant).envFileDotEnv).toBe(false);
      // 원본 불변.
      expect(appEnvFileEntries(source)).toContain(ENV_FILE);
    });

    it("negative (f) — postgres volume 참조 이름을 top-level 선언과 다르게(postgres-data→pg-data) 만든 mutant → 이름 불일치(영속성 격하) 검출", () => {
      const source = readFileSync(COMPOSE_PATH, "utf8");
      expect(namedVolumeConsistent(source)).toBe(true);
      const mutant = source.replace(
        "- postgres-data:/var/lib/postgresql/data",
        "- pg-data:/var/lib/postgresql/data",
      );
      expect(namedVolumeConsistent(mutant)).toBe(false);
      // 서비스 마운트 이름은 pg-data 로 바뀌었으나 top-level 은 postgres-data 만 선언.
      expect(serviceVolumeMounts(mutant, "postgres")[0].name).toBe("pg-data");
      expect(topLevelVolumeNames(mutant)).toContain(NAMED_VOLUME);
      expect(topLevelVolumeNames(mutant)).not.toContain("pg-data");
      // 원본 불변.
      expect(namedVolumeConsistent(source)).toBe(true);
    });

    it("negative (g) — credential/secret 누출 0: 추출/합성 토큰에 gh 토큰 어휘·credential 실값·실 endpoint 미등장(§9/REQ-059)", () => {
      const source = readFileSync(COMPOSE_PATH, "utf8");
      const anchors = extractComposeAnchors(source);
      const hc = postgresHealthcheck(source);
      // 추출 토큰 — 오케스트레이션 키·값·volume 이름·서비스명·파일명만.
      const synthesized = [
        JSON.stringify(anchors),
        JSON.stringify(serviceVolumeMounts(source, "postgres")),
        JSON.stringify(topLevelVolumeNames(source)),
        JSON.stringify(appEnvFileEntries(source)),
        String(nestedDirectiveValue(hc, "interval")),
        String(nestedDirectiveValue(hc, "timeout")),
        String(nestedDirectiveValue(hc, "retries")),
      ];
      // 강한 패턴(password/secret 포함) — 추출 토큰은 오케스트레이션 값만이라 전부 clean.
      const strongPattern =
        /(ghp_|--token|GITHUB_TOKEN|GH_TOKEN|\bBearer\b|Authorization|\bsk-|password|passwd|secret)/i;
      synthesized.forEach((s) => {
        expect(strongPattern.test(s)).toBe(false);
      });
      // 실 compose 소스는 POSTGRES_PASSWORD/AUTH_JWT_SECRET **env 이름**을 언급하나 실값은 0 —
      //   POSTGRES_PASSWORD 는 env-substitution placeholder 형태(`${...:-change_me_in_env}`)일 뿐.
      expect(source).toContain("${POSTGRES_PASSWORD:-change_me_in_env}");
      // 실 토큰(ghp_)·실 endpoint(IP URL)·Bearer 자격은 소스에도 미등장(약한 패턴 — env 이름 제외).
      const leakPattern = /(ghp_|GH_TOKEN=|\bBearer\b|Authorization:)/;
      expect(leakPattern.test(source)).toBe(false);
      expect(source).not.toMatch(/https?:\/\/\d+\.\d+\.\d+\.\d+/);
    });
  });

  describe("flow: 결정론 · no-mutation(원본 read-only 입증)", () => {
    it("동일 입력으로 pure 함수를 두 번 호출하면 deep-equal(결정론)", () => {
      const source = readFileSync(COMPOSE_PATH, "utf8");
      expect(extractComposeAnchors(source)).toEqual(
        extractComposeAnchors(source),
      );
      expect(serviceVolumeMounts(source, "postgres")).toEqual(
        serviceVolumeMounts(source, "postgres"),
      );
      expect(topLevelVolumeNames(source)).toEqual(topLevelVolumeNames(source));
    });

    it("합성 mutate(사본 replace) 후에도 원본 소스 텍스트·pure 함수 산출이 불변(원본 read-only)", () => {
      const source = readFileSync(COMPOSE_PATH, "utf8");
      const snapshot = source;
      // 사본 mutate(negative a/f 에서 쓰는 replace) — 원본 불변 확인.
      source.replace(
        "condition: service_healthy",
        "condition: service_started",
      );
      source.replace(
        "- postgres-data:/var/lib/postgresql/data",
        "- pg-data:/var/lib/postgresql/data",
      );
      source.replace(/\n\s*retries: 10/, "");
      source.replace(/\n\s*env_file:\n\s*- \.env/, "");
      expect(source).toBe(snapshot);
      // 추출/파싱 후에도 원본 불변.
      extractComposeAnchors(source);
      expect(source).toBe(snapshot);
    });
  });

  describe("dormant / non-gated 확인 — side-effect 0", () => {
    it("오케스트레이션 해석 모델이 env / 전역 상태 없이 순수하게 동작(non-gated — describe.skip 0·gating 분기 0)", () => {
      // 본 describe 가 실행된다는 것 자체가 describe.skip 0(항상 실행)의 런타임 증거.
      const envSnapshot = { ...process.env };
      const source = readFileSync(COMPOSE_PATH, "utf8");
      const before = dependsOnServiceHealthy(source);
      // 실 process.env 를 mutate 해도 산출 불변 — 모델이 process.env 를 참조하지 않음(파라미터로만).
      Object.assign(process.env, { COMPOSE_UNIT_TEST: "x" });
      const after = dependsOnServiceHealthy(source);
      delete process.env.COMPOSE_UNIT_TEST;
      expect(after).toBe(before);
      expect(Object.keys(process.env)).toEqual(Object.keys(envSnapshot));
    });

    it("파일 read 는 docker-compose.yml 읽기만 — 실 docker compose/실 docker build/실 컨테이너/실 healthcheck/실 DB 실행 0. compose 는 조건 분기 없는 선언적 orchestration 파일 — 런타임 분기 없음(선언적 orchestration)이라 happy/negative mutant 로 대체 cover", () => {
      const source = readFileSync(COMPOSE_PATH, "utf8");
      expect(dependsOnServiceHealthy(source)).toBe(true);
      expect(serviceHasRestartUnlessStopped(source, "postgres")).toBe(true);
      expect(serviceHasRestartUnlessStopped(source, "app")).toBe(true);
      expect(healthcheckBoundedPolling(source)).toBe(true);
      expect(namedVolumeConsistent(source)).toBe(true);
      expect(appEnvFileEntries(source)).toContain(ENV_FILE);
    });
  });
});
