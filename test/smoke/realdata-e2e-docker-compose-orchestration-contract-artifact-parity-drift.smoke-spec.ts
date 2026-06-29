// realdata-e2e-docker-compose-orchestration-contract-artifact-parity-drift.smoke-spec.ts
// — 실 평가 e2e/deploy step① `deploy/redeploy.sh` 가 `docker compose up -d --build` 한 번으로
// 읽는 `docker-compose.yml` 의 오케스트레이션 계약(app.build.dockerfile 경로 실존·app.ports/
// environment.PORT 기본값·postgres.image 태그·healthcheck pg_isready 가 참조하는 env 이름·
// postgres 서비스명·DATABASE_URL host:port↔서비스명/포트) ↔ 실 build/runtime artifact
// (`Dockerfile` 의 EXPOSE/ENTRYPOINT·`src/parse-port.ts` 의 DEFAULT_PORT·`deploy/env.prod.example`
// 의 PORT/POSTGRES_USER/POSTGRES_DB/DATABASE_URL) parity 를, 양측 4 소스(compose + Dockerfile +
// parse-port + env.prod.example)를 readFileSync 로 읽어 정적 추출·cross-artifact 대조하는
// drift-detection non-gated build-time smoke (T-0795 박제, PLAN.md 109행 🟢 실 평가 e2e/deploy step①).
//
// 본 spec 의 존재 이유 — compose-orchestration-contract ↔ build/runtime-artifact gap 해소:
//   - `deploy/redeploy.sh` 는 매일 밤 `git reset --hard origin/main` 후 `docker compose up -d
//     --build` 한 번으로 postgres + NestJS app(web 정적 serve 포함, ADR-0003 monolith)을 함께
//     띄운다. 그 단일 명령이 읽는 `docker-compose.yml` 은 **무인 배포가 crash-loop 없이 부팅되려면
//     실 build/runtime artifact 와 정합해야만 하는 풍부한 오케스트레이션 contract** 를 하드코딩한다:
//      · app.build.dockerfile(`Dockerfile`)이 실존하고 그 Dockerfile 이 valid ENTRYPOINT 를 둠.
//      · app.ports/environment.PORT 의 기본값(`${PORT:-3000}` → 3000)이 Dockerfile EXPOSE·
//        src/parse-port DEFAULT_PORT·env.prod.example PORT 와 4중 byte-identical 정합.
//      · postgres.image(`postgres:16-alpine`)가 고정 상수이고 healthcheck `pg_isready -U X -d Y`
//        가 참조하는 X(POSTGRES_USER)·Y(POSTGRES_DB) env 가 env.prod.example 에 실존.
//      · DATABASE_URL host(`postgres`)==compose postgres 서비스명·port(`5432`)==compose ports.
//   - 이 contract 는 origin/main 시점에 **build-time 검증 0 부재** 였다:
//      (1) daily-test/docker-entrypoint/seed smoke(T-0790~0794)는 distinct surface 만 cover —
//          docker-compose.yml 오케스트레이션 계약 ↔ build/runtime artifact 대조 0.
//      (2) CI 의 "컨테이너 런타임 smoke"(ci.yml)는 실 컨테이너 부팅(gated runtime)이라 compose
//          텍스트 ↔ artifact 의 정적 drift 를 컨테이너 빌드·부팅 없이는 못 잡는다.
//   - 본 spec 은 그 빈 자리를 메운다 — `docker-compose.yml` + `Dockerfile` + `src/parse-port.ts`
//     + `deploy/env.prod.example` 4 소스를 readFileSync 로 읽어 (a) compose 측 4 오케스트레이션
//     계약, (b) artifact 측(EXPOSE·ENTRYPOINT·DEFAULT_PORT·env 키/host/port)을 추출해 (c)
//     dockerfile 경로 실존·PORT 4중 byte-identical·image 상수+healthcheck env 실존·DATABASE_URL
//     host:port↔서비스명/포트 정합을 단언한다. 이 contract 가 drift 하면(dockerfile rename·PORT
//     한 곳만 변경·서비스명 rename·EXPOSE 변경·healthcheck env 누락) 배포 컨테이너가 런타임에
//     silent 부팅 실패/응답 불가/DB 단절한다.
//
//      🔥 실 docker compose up·실 docker build·실 컨테이너 부팅·실 postgres healthcheck·실 NestJS
//         부팅·실 DB·실 HTTP 0 — 파일 read + 정적 텍스트/YAML 토큰 추출 + 합성 문자열만. compose·
//         Dockerfile·parse-port·env 소스는 읽기만(실행/build/부팅/import 0).
//      🔥 NestJS module/class import 0 — readFileSync 텍스트 read only, DI/DB 의존 0.
//      🔥 process.env 읽기 0 / gating 분기 0 — non-gated 항상 실행(describe.skip 0).
//      🔥 credential 0 — 오케스트레이션 계약은 경로·포트·서비스명·image 태그·env 키 이름만 운반.
//         env.prod.example 의 POSTGRES_PASSWORD/AUTH_JWT_SECRET 은 placeholder(`<...>`)일 뿐
//         본 smoke 의 추출 surface 미포함(POSTGRES_USER/DB 키·DATABASE_URL host:port·PORT 만).
//      🔥 새 외부 dependency 0 — node 내장(`fs`/`path`) import 만. YAML 파서 추가 0(정규식/문자열 추출).
//
// Out of Scope (T-0795):
//   - src 변경 0 — test-only. compose/Dockerfile/parse-port/env 는 readFileSync read 만.
//   - `docker-compose.yml` 변경 0 — readFileSync 로 읽기만(drift 발견 시 별도 fix task).
//   - 실 docker compose up/실 docker build/실 컨테이너 부팅/실 healthcheck/실 NestJS/실 DB/실 HTTP 0.
//   - YAML 의 완전한 spec 파싱(anchor·multi-doc·flow scalar) 0 — 필요한 계약 토큰만 정규식/슬라이스 추출.
//   - docker-entrypoint(T-0793)·seed SQL/cipher(T-0794)·daily-test 3종(T-0790~0792) 재단언 0 — distinct surface.
//   - 새 helper 모듈 신설 0(`test/helpers/` 변경 0) — spec 로컬 보조 함수만 허용.
import { readFileSync, existsSync } from "fs";
import * as path from "path";

// repo-root 경로 — test 실행 cwd 무관하게 robust 하게 해석(`__dirname` = test/smoke,
// 두 단계 위가 repo-root). `process.cwd()` 대신 `__dirname` 기준 상대로 고정한다.
const REPO_ROOT = path.resolve(__dirname, "../..");
const COMPOSE_PATH = path.join(REPO_ROOT, "docker-compose.yml");
const DOCKERFILE_PATH = path.join(REPO_ROOT, "Dockerfile");
const PARSE_PORT_PATH = path.join(REPO_ROOT, "src/parse-port.ts");
const ENV_PROD_EXAMPLE_PATH = path.join(REPO_ROOT, "deploy/env.prod.example");

// ---------------------------------------------------------------------------
// 타입 정의 — compose·artifact 양측에서 추출한 오케스트레이션 계약/artifact 의 정규형.
// ---------------------------------------------------------------------------

// docker-compose.yml 이 운반하는 4 오케스트레이션 계약의 정규형.
//   · buildDockerfile: app.build.dockerfile(`Dockerfile`)
//   · portDefault: app.environment.PORT / app.ports 의 `${PORT:-N}` default N(`3000`)
//   · postgresImage: postgres.image(`postgres:16-alpine`)
//   · healthcheckUserEnv / healthcheckDbEnv: healthcheck pg_isready -U X -d Y 의 X/Y env 이름
//   · postgresServiceName: services 아래 postgres 서비스 키(`postgres`)
//   · postgresContainerPort: postgres.ports `"5432:5432"` 의 컨테이너측(우측) 포트(`5432`)
interface ComposeOrchestrationContract {
  buildDockerfile: string | null;
  portDefault: string | null;
  postgresImage: string | null;
  healthcheckUserEnv: string | null;
  healthcheckDbEnv: string | null;
  postgresServiceName: string | null;
  postgresContainerPort: string | null;
}

// env.prod.example 에서 추출한 배포 env 정본.
//   · port: PORT 값(`3000`)
//   · keys: 정의된 env 키 집합(POSTGRES_USER/POSTGRES_DB 존재 판정용)
//   · dbUrlHost / dbUrlPort: DATABASE_URL 의 host(`postgres`)·port(`5432`)
interface EnvProdArtifact {
  port: string | null;
  keys: Set<string>;
  dbUrlHost: string | null;
  dbUrlPort: string | null;
}

// ---------------------------------------------------------------------------
// compose 측 추출 — docker-compose.yml 의 4 오케스트레이션 계약.
// ---------------------------------------------------------------------------

// app.build.dockerfile 값을 추출한다(39행 `dockerfile: Dockerfile`). 못 찾으면 null.
function extractComposeBuildDockerfile(composeSource: string): string | null {
  const match = composeSource.match(/^\s*dockerfile:\s*(\S+)\s*$/m);
  return match ? match[1] : null;
}

// `${PORT:-N}` default-substitution 의 default N 을 추출한다(50·52행). 못 찾으면 null.
function extractComposePortDefault(composeSource: string): string | null {
  const match = composeSource.match(/\$\{PORT:-(\d+)\}/);
  return match ? match[1] : null;
}

// postgres.image 태그를 추출한다(14행 `image: postgres:16-alpine`). 못 찾으면 null.
function extractComposePostgresImage(composeSource: string): string | null {
  const match = composeSource.match(/^\s*image:\s*(postgres:\S+)\s*$/m);
  return match ? match[1] : null;
}

// healthcheck `pg_isready -U <X> -d <Y>` 에서 -U·-d 가 참조하는 env 이름을 추출한다
// (27~31행 `pg_isready -U ${POSTGRES_USER:-...} -d ${POSTGRES_DB:-...}`).
// `${ENV:-default}` 또는 `$ENV`/`${ENV}` 형태에서 ENV 이름만 뽑는다. 못 찾으면 null.
function extractComposeHealthcheckEnv(
  composeSource: string,
  flag: "U" | "d",
): string | null {
  const re = new RegExp(`pg_isready[^\\n]*-${flag}\\s+\\$\\{?(\\w+)`, "");
  const match = composeSource.match(re);
  return match ? match[1] : null;
}

// services 아래 postgres 서비스 키가 존재하는지·그 이름을 추출한다(13행 `postgres:`).
// `services:` 블록 안에서 들여쓰기 2칸 + `postgres:` 행을 찾는다. 못 찾으면 null.
function extractComposePostgresServiceName(
  composeSource: string,
): string | null {
  // services: 블록 시작 위치 이후에서 2-space 들여쓰기 서비스 키 `postgres:` 를 찾는다.
  const servicesIdx = composeSource.indexOf("\nservices:");
  if (servicesIdx < 0) {
    return null;
  }
  const after = composeSource.slice(servicesIdx);
  const match = after.match(/^\s{2}(postgres):\s*$/m);
  return match ? match[1] : null;
}

// postgres.ports `"5432:5432"` 의 컨테이너측(우측) 포트를 추출한다(22행).
// `"HOST:CONTAINER"` 형태에서 CONTAINER 를 뽑는다. 못 찾으면 null.
function extractComposePostgresContainerPort(
  composeSource: string,
): string | null {
  const match = composeSource.match(/"(\d+):(\d+)"/);
  return match ? match[2] : null;
}

// compose 측 4 오케스트레이션 계약을 정규형으로 추출한다.
function extractComposeContract(
  composeSource: string,
): ComposeOrchestrationContract {
  return {
    buildDockerfile: extractComposeBuildDockerfile(composeSource),
    portDefault: extractComposePortDefault(composeSource),
    postgresImage: extractComposePostgresImage(composeSource),
    healthcheckUserEnv: extractComposeHealthcheckEnv(composeSource, "U"),
    healthcheckDbEnv: extractComposeHealthcheckEnv(composeSource, "d"),
    postgresServiceName: extractComposePostgresServiceName(composeSource),
    postgresContainerPort: extractComposePostgresContainerPort(composeSource),
  };
}

// ---------------------------------------------------------------------------
// artifact 측 추출 — Dockerfile EXPOSE/ENTRYPOINT / parse-port DEFAULT_PORT / env.prod.example.
// ---------------------------------------------------------------------------

// Dockerfile 의 `EXPOSE N` 포트 값을 추출한다(70행 `EXPOSE 3000`). 못 찾으면 null.
function extractDockerfileExpose(dockerfileSource: string): string | null {
  const match = dockerfileSource.match(/^\s*EXPOSE\s+(\d+)\s*$/m);
  return match ? match[1] : null;
}

// Dockerfile 의 `ENTRYPOINT [...]` 행 존재 여부(73행). compose build 가 valid entrypoint
// 이미지를 만드는지 판정. exec-form 첫 인자가 있으면 그 경로, 없으면 null.
function extractDockerfileEntrypoint(dockerfileSource: string): string | null {
  const match = dockerfileSource.match(/ENTRYPOINT\s+\[\s*["']([^"']*)["']/);
  return match ? match[1] : null;
}

// src/parse-port.ts 의 `DEFAULT_PORT = N` 값을 추출한다(8행 텍스트 read 만, import 0).
// 못 찾으면 null.
function extractParsePortDefault(parsePortSource: string): string | null {
  const match = parsePortSource.match(/DEFAULT_PORT\s*=\s*(\d+)/);
  return match ? match[1] : null;
}

// env.prod.example 텍스트에서 `KEY=value` 행을 파싱해 배포 env 정본을 추출한다.
// 주석(`#`)·빈 행은 무시. DATABASE_URL 은 host:port 를 추가 추출.
function extractEnvProdArtifact(envSource: string): EnvProdArtifact {
  const keys = new Set<string>();
  let port: string | null = null;
  let dbUrlHost: string | null = null;
  let dbUrlPort: string | null = null;

  for (const rawLine of envSource.split("\n")) {
    const line = rawLine.trim();
    if (line.length === 0 || line.startsWith("#")) {
      continue;
    }
    const eq = line.indexOf("=");
    if (eq <= 0) {
      continue;
    }
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    // 양끝 따옴표 제거(DATABASE_URL 은 큰따옴표로 감쌈).
    value = value.replace(/^["']/, "").replace(/["']$/, "");
    keys.add(key);
    if (key === "PORT") {
      port = value;
    }
    if (key === "DATABASE_URL") {
      // postgresql://user:pass@HOST:PORT/db 에서 HOST:PORT 추출.
      const m = value.match(/@([^/@:\s]+):(\d+)\//);
      if (m) {
        dbUrlHost = m[1];
        dbUrlPort = m[2];
      }
    }
  }
  return { port, keys, dbUrlHost, dbUrlPort };
}

// ---------------------------------------------------------------------------
// 본 spec 이 박제하는 contract 정본 — compose·artifact 양측이 수렴해야 하는 기대값.
// ---------------------------------------------------------------------------

const EXPECTED_BUILD_DOCKERFILE = "Dockerfile";
const EXPECTED_PORT_DEFAULT = "3000";
const EXPECTED_POSTGRES_IMAGE = "postgres:16-alpine";
const EXPECTED_HEALTHCHECK_USER_ENV = "POSTGRES_USER";
const EXPECTED_HEALTHCHECK_DB_ENV = "POSTGRES_DB";
const EXPECTED_POSTGRES_SERVICE_NAME = "postgres";
const EXPECTED_POSTGRES_PORT = "5432";

describe("realdata-e2e/deploy step① docker-compose.yml 오케스트레이션 계약(build.dockerfile·PORT 기본값·postgres image/healthcheck env·DATABASE_URL host:port) ↔ 실 build/runtime artifact(Dockerfile EXPOSE/ENTRYPOINT·parse-port DEFAULT_PORT·env.prod.example) parity drift smoke (T-0795)", () => {
  describe("Happy-path: compose + build/runtime artifact 소스 read + 계약/artifact 추출", () => {
    it("실 docker-compose.yml + Dockerfile + src/parse-port.ts + deploy/env.prod.example 4 소스를 읽어 compose 계약·artifact 를 비어있지 않게 추출한다", () => {
      const composeSource = readFileSync(COMPOSE_PATH, "utf8");
      const dockerfileSource = readFileSync(DOCKERFILE_PATH, "utf8");
      const parsePortSource = readFileSync(PARSE_PORT_PATH, "utf8");
      const envSource = readFileSync(ENV_PROD_EXAMPLE_PATH, "utf8");

      // compose 측 4 오케스트레이션 계약이 비어있지 않게 추출됨.
      const contract = extractComposeContract(composeSource);
      expect(contract.buildDockerfile).toBeTruthy();
      expect(contract.portDefault).toBeTruthy();
      expect(contract.postgresImage).toBeTruthy();
      expect(contract.healthcheckUserEnv).toBeTruthy();
      expect(contract.healthcheckDbEnv).toBeTruthy();
      expect(contract.postgresServiceName).toBeTruthy();
      expect(contract.postgresContainerPort).toBeTruthy();

      // artifact 측 추출이 비어있지 않음.
      expect(extractDockerfileExpose(dockerfileSource)).toBeTruthy();
      expect(extractDockerfileEntrypoint(dockerfileSource)).toBeTruthy();
      expect(extractParsePortDefault(parsePortSource)).toBeTruthy();
      const env = extractEnvProdArtifact(envSource);
      expect(env.port).toBeTruthy();
      expect(env.keys.size).toBeGreaterThan(0);
      expect(env.dbUrlHost).toBeTruthy();
      expect(env.dbUrlPort).toBeTruthy();
    });

    it("repo-root 경로가 __dirname 기준으로 robust 하게 해석되어 4 소스가 실재한다", () => {
      // cwd 무관 — __dirname 기준 상대(path.resolve)로 해석한 경로가 실제 파일을 가리킨다.
      expect(existsSync(COMPOSE_PATH)).toBe(true);
      expect(existsSync(DOCKERFILE_PATH)).toBe(true);
      expect(existsSync(PARSE_PORT_PATH)).toBe(true);
      expect(existsSync(ENV_PROD_EXAMPLE_PATH)).toBe(true);
      expect(readFileSync(COMPOSE_PATH, "utf8")).toContain(
        "dockerfile: Dockerfile",
      );
      expect(readFileSync(COMPOSE_PATH, "utf8")).toContain(
        '"${PORT:-3000}:${PORT:-3000}"',
      );
    });
  });

  describe("app.build.dockerfile ↔ Dockerfile 실존 정합 수렴(핵심 불변식 1)", () => {
    it("compose app.build.dockerfile 가 'Dockerfile'(byte-identical)이고 그 파일 실존 AND ENTRYPOINT 행 보유", () => {
      const composeSource = readFileSync(COMPOSE_PATH, "utf8");

      // (a) compose build.dockerfile 값이 'Dockerfile' byte-identical.
      const buildDockerfile = extractComposeBuildDockerfile(composeSource);
      expect(buildDockerfile).toBe(EXPECTED_BUILD_DOCKERFILE);

      // (b) 그 경로의 파일이 실존(rename·삭제 silent drift 검출).
      const referencedPath = path.join(REPO_ROOT, buildDockerfile as string);
      expect(existsSync(referencedPath)).toBe(true);
      expect(() => readFileSync(referencedPath, "utf8")).not.toThrow();

      // (c) 그 Dockerfile 이 ENTRYPOINT 행을 가짐(compose build 가 valid entrypoint 이미지 생성).
      const dockerfileSource = readFileSync(referencedPath, "utf8");
      expect(extractDockerfileEntrypoint(dockerfileSource)).toBeTruthy();
    });
  });

  describe("PORT 기본값 4중 정합 수렴(핵심 불변식 2)", () => {
    it("compose ${PORT:-N} default == Dockerfile EXPOSE == parse-port DEFAULT_PORT == env.prod.example PORT 가 모두 3000 byte-identical", () => {
      const composeSource = readFileSync(COMPOSE_PATH, "utf8");
      const dockerfileSource = readFileSync(DOCKERFILE_PATH, "utf8");
      const parsePortSource = readFileSync(PARSE_PORT_PATH, "utf8");
      const envSource = readFileSync(ENV_PROD_EXAMPLE_PATH, "utf8");

      const composePort = extractComposePortDefault(composeSource);
      const exposePort = extractDockerfileExpose(dockerfileSource);
      const defaultPort = extractParsePortDefault(parsePortSource);
      const envPort = extractEnvProdArtifact(envSource).port;

      // 네 source 가 모두 3000 byte-identical.
      expect(composePort).toBe(EXPECTED_PORT_DEFAULT);
      expect(exposePort).toBe(EXPECTED_PORT_DEFAULT);
      expect(defaultPort).toBe(EXPECTED_PORT_DEFAULT);
      expect(envPort).toBe(EXPECTED_PORT_DEFAULT);

      // 4중 정합(한 곳만 silent drift 면 every 가 false).
      const ports = [composePort, exposePort, defaultPort, envPort];
      expect(ports.every((p) => p === composePort)).toBe(true);

      // compose ports 매핑 좌·우 둘 다 ${PORT:-3000} 동일(host==container 포트 매핑 정합).
      expect(composeSource).toContain('"${PORT:-3000}:${PORT:-3000}"');
    });
  });

  describe("postgres image + healthcheck env 정합 수렴(핵심 불변식 3)", () => {
    it("compose postgres.image 가 postgres:16-alpine(고정상수) AND healthcheck pg_isready 가 참조하는 env(POSTGRES_USER/POSTGRES_DB)가 env.prod.example 에 실존", () => {
      const composeSource = readFileSync(COMPOSE_PATH, "utf8");
      const envSource = readFileSync(ENV_PROD_EXAMPLE_PATH, "utf8");

      // (a) postgres.image 고정상수 byte-identical(태그 silent 변경 검출).
      expect(extractComposePostgresImage(composeSource)).toBe(
        EXPECTED_POSTGRES_IMAGE,
      );

      // (b) healthcheck -U·-d 가 참조하는 env 이름.
      const userEnv = extractComposeHealthcheckEnv(composeSource, "U");
      const dbEnv = extractComposeHealthcheckEnv(composeSource, "d");
      expect(userEnv).toBe(EXPECTED_HEALTHCHECK_USER_ENV);
      expect(dbEnv).toBe(EXPECTED_HEALTHCHECK_DB_ENV);

      // 그 env 들이 env.prod.example 에 키로 실존(누락시 healthcheck/depends_on 게이트 무효).
      const env = extractEnvProdArtifact(envSource);
      expect(env.keys.has(userEnv as string)).toBe(true);
      expect(env.keys.has(dbEnv as string)).toBe(true);
    });
  });

  describe("DATABASE_URL host:port ↔ compose 서비스명/포트 정합 수렴(핵심 불변식 4)", () => {
    it("env.prod.example DATABASE_URL host(postgres)==compose postgres 서비스명 AND port(5432)==compose ports 컨테이너측", () => {
      const composeSource = readFileSync(COMPOSE_PATH, "utf8");
      const envSource = readFileSync(ENV_PROD_EXAMPLE_PATH, "utf8");

      const env = extractEnvProdArtifact(envSource);
      const serviceName = extractComposePostgresServiceName(composeSource);
      const containerPort = extractComposePostgresContainerPort(composeSource);

      // host == compose postgres 서비스명(서비스 rename 시 app→DB 단절 검출).
      expect(env.dbUrlHost).toBe(EXPECTED_POSTGRES_SERVICE_NAME);
      expect(serviceName).toBe(EXPECTED_POSTGRES_SERVICE_NAME);
      expect(env.dbUrlHost).toBe(serviceName);

      // port == compose ports 컨테이너측(5432).
      expect(env.dbUrlPort).toBe(EXPECTED_POSTGRES_PORT);
      expect(containerPort).toBe(EXPECTED_POSTGRES_PORT);
      expect(env.dbUrlPort).toBe(containerPort);
    });
  });

  describe("drift-detection 변별성 수렴(본 smoke 가 drift 를 실제로 잡음을 입증)", () => {
    it("parse-port DEFAULT_PORT 를 8080 으로 바꾼 합성 → compose ${PORT:-3000} default 와 not.toBe — 원본 추출 불변·mutate 0", () => {
      const composeSource = readFileSync(COMPOSE_PATH, "utf8");
      const parsePortSource = readFileSync(PARSE_PORT_PATH, "utf8");

      const composePort = extractComposePortDefault(composeSource);
      // 원본 추출(불변 baseline).
      const origDefault = extractParsePortDefault(parsePortSource);
      expect(origDefault).toBe(EXPECTED_PORT_DEFAULT);

      // 사본만 mutate: DEFAULT_PORT 3000 → 8080.
      const mutated = parsePortSource.replace(
        /DEFAULT_PORT\s*=\s*3000/,
        "DEFAULT_PORT = 8080",
      );
      const mutatedDefault = extractParsePortDefault(mutated);
      expect(mutatedDefault).toBe("8080");
      // compose default 와 정합 아님(PORT 매핑 mismatch 검출).
      expect(mutatedDefault).not.toBe(composePort);

      // 원본은 mutate 0 — 재추출이 baseline 과 동일.
      expect(extractParsePortDefault(parsePortSource)).toBe(origDefault);
    });

    it("compose dockerfile: Dockerfile.dev / 서비스명 pg / ${PORT:-8080} 으로 바꾼 사본이 artifact 정본과 not.toBe — 원본 추출 불변", () => {
      const composeSource = readFileSync(COMPOSE_PATH, "utf8");

      // 원본 추출(baseline).
      const orig = extractComposeContract(composeSource);
      expect(orig.buildDockerfile).toBe(EXPECTED_BUILD_DOCKERFILE);
      expect(orig.postgresServiceName).toBe(EXPECTED_POSTGRES_SERVICE_NAME);
      expect(orig.portDefault).toBe(EXPECTED_PORT_DEFAULT);

      // 사본만 mutate: dockerfile rename·서비스명 rename·PORT default 변경.
      const mutated = composeSource
        .replace(/dockerfile:\s*Dockerfile/, "dockerfile: Dockerfile.dev")
        .replace(/^\s{2}postgres:\s*$/m, "  pg:")
        .replace(/\$\{PORT:-3000\}/g, "${PORT:-8080}");
      const mutatedContract = extractComposeContract(mutated);
      expect(mutatedContract.buildDockerfile).not.toBe(
        EXPECTED_BUILD_DOCKERFILE,
      );
      expect(mutatedContract.postgresServiceName).not.toBe(
        EXPECTED_POSTGRES_SERVICE_NAME,
      );
      expect(mutatedContract.portDefault).not.toBe(EXPECTED_PORT_DEFAULT);

      // 원본은 mutate 0 — 재추출이 baseline 과 deep-equal.
      expect(extractComposeContract(composeSource)).toEqual(orig);
    });

    it("env.prod.example DATABASE_URL host 를 db 로 바꾼 사본 → compose postgres 서비스명과 not.toBe — 원본 불변", () => {
      const composeSource = readFileSync(COMPOSE_PATH, "utf8");
      const envSource = readFileSync(ENV_PROD_EXAMPLE_PATH, "utf8");

      const serviceName = extractComposePostgresServiceName(composeSource);
      const origHost = extractEnvProdArtifact(envSource).dbUrlHost;
      expect(origHost).toBe(EXPECTED_POSTGRES_SERVICE_NAME);

      // 사본만 mutate: DATABASE_URL host postgres → db.
      const mutated = envSource.replace(/@postgres:5432\//, "@db:5432/");
      const mutatedHost = extractEnvProdArtifact(mutated).dbUrlHost;
      expect(mutatedHost).toBe("db");
      // compose 서비스명과 정합 아님(app→DB 연결 단절 drift 검출).
      expect(mutatedHost).not.toBe(serviceName);

      // 원본 불변.
      expect(extractEnvProdArtifact(envSource).dbUrlHost).toBe(origHost);
    });
  });

  describe("Error path / negative cases 충분 cover", () => {
    it("존재하지 않는 경로로 readFileSync → ENOENT throw(silent 0-byte fallback false-PASS 방지)", () => {
      const badPath = path.join(REPO_ROOT, "docker-compose.does-not-exist.yml");
      expect(() => readFileSync(badPath, "utf8")).toThrow();
      expect(existsSync(badPath)).toBe(false);
    });

    it("PORT 기본값 drift 검출(합성) — DEFAULT_PORT = 8080 인 합성 parse-port → compose ${PORT:-3000} default 와 not.toBe", () => {
      const composeSource = readFileSync(COMPOSE_PATH, "utf8");
      const composePort = extractComposePortDefault(composeSource);
      const synthetic = "export const DEFAULT_PORT = 8080;";
      const syntheticPort = extractParsePortDefault(synthetic);
      expect(syntheticPort).toBe("8080");
      expect(syntheticPort).not.toBe(composePort);
    });

    it("dockerfile 경로 변경 검출(합성) — compose dockerfile: Dockerfile.dev 인 합성 → 실존 Dockerfile 와 mismatch 또는 그 경로 부재", () => {
      const synthetic =
        "    build:\n      context: .\n      dockerfile: Dockerfile.dev\n";
      const buildDockerfile = extractComposeBuildDockerfile(synthetic);
      expect(buildDockerfile).toBe("Dockerfile.dev");
      // 정본 Dockerfile 와 mismatch.
      expect(buildDockerfile).not.toBe(EXPECTED_BUILD_DOCKERFILE);
      // 그 경로 파일도 부재.
      expect(existsSync(path.join(REPO_ROOT, buildDockerfile as string))).toBe(
        false,
      );
    });

    it("EXPOSE 변경 drift 검출(합성) — Dockerfile EXPOSE 9000 인 합성 → compose PORT 기본값(3000)과 not.toBe", () => {
      const composeSource = readFileSync(COMPOSE_PATH, "utf8");
      const composePort = extractComposePortDefault(composeSource);
      const synthetic = 'USER node\nEXPOSE 9000\nENTRYPOINT ["./x.sh"]';
      const exposePort = extractDockerfileExpose(synthetic);
      expect(exposePort).toBe("9000");
      expect(exposePort).not.toBe(composePort);
    });

    it("DATABASE_URL host mismatch 검출(합성) — host=db 인 합성 env → compose postgres 서비스명과 not.toBe", () => {
      const composeSource = readFileSync(COMPOSE_PATH, "utf8");
      const serviceName = extractComposePostgresServiceName(composeSource);
      const synthetic =
        'DATABASE_URL="postgresql://u:p@db:5432/d?schema=public"\nPORT=3000';
      const host = extractEnvProdArtifact(synthetic).dbUrlHost;
      expect(host).toBe("db");
      expect(host).not.toBe(serviceName);
    });

    it("healthcheck env 누락 검출(합성) — POSTGRES_DB 키가 없는 합성 env → healthcheck -d 가 참조하는 env 미존재(keys.has false)", () => {
      const composeSource = readFileSync(COMPOSE_PATH, "utf8");
      const dbEnv = extractComposeHealthcheckEnv(composeSource, "d");
      // 합성 env: POSTGRES_USER 만 존재, POSTGRES_DB 부재.
      const synthetic = "POSTGRES_USER=assessment_agent\nPORT=3000";
      const env = extractEnvProdArtifact(synthetic);
      // healthcheck 가 참조하는 POSTGRES_DB 가 env 템플릿에 누락 검출.
      expect(env.keys.has(dbEnv as string)).toBe(false);
      // 대조군 — POSTGRES_USER 는 존재(함수가 무조건 false 가 아님을 입증).
      expect(env.keys.has("POSTGRES_USER")).toBe(true);
    });

    it("compose 계약 토큰 미존재 검출 — postgres/dockerfile/PORT 토큰 없는 합성 compose → 추출이 null", () => {
      const synthetic = "services:\n  web:\n    image: nginx\n";
      expect(extractComposeBuildDockerfile(synthetic)).toBeNull();
      expect(extractComposePortDefault(synthetic)).toBeNull();
      expect(extractComposePostgresImage(synthetic)).toBeNull();
      expect(extractComposePostgresServiceName(synthetic)).toBeNull();
    });
  });

  describe("credential 누출 0(REQ-059 / §9)", () => {
    it("추출/합성하는 어떤 문자열(서비스명·포트·image·healthcheck env 이름·EXPOSE/ENTRYPOINT·DEFAULT_PORT·PORT·host:port·합성)에도 credential 실값 미surface", () => {
      const composeSource = readFileSync(COMPOSE_PATH, "utf8");
      const dockerfileSource = readFileSync(DOCKERFILE_PATH, "utf8");
      const parsePortSource = readFileSync(PARSE_PORT_PATH, "utf8");
      const envSource = readFileSync(ENV_PROD_EXAMPLE_PATH, "utf8");

      const contract = extractComposeContract(composeSource);
      const env = extractEnvProdArtifact(envSource);
      // 본 smoke 가 다루는 surface 만 검사 — password 값은 미surface(키/host/port 토큰만).
      const haystacks = [
        contract.buildDockerfile ?? "",
        contract.portDefault ?? "",
        contract.postgresImage ?? "",
        contract.healthcheckUserEnv ?? "",
        contract.healthcheckDbEnv ?? "",
        contract.postgresServiceName ?? "",
        contract.postgresContainerPort ?? "",
        extractDockerfileExpose(dockerfileSource) ?? "",
        extractDockerfileEntrypoint(dockerfileSource) ?? "",
        extractParsePortDefault(parsePortSource) ?? "",
        env.port ?? "",
        env.dbUrlHost ?? "",
        env.dbUrlPort ?? "",
        EXPECTED_BUILD_DOCKERFILE,
        EXPECTED_POSTGRES_IMAGE,
        EXPECTED_HEALTHCHECK_USER_ENV,
        EXPECTED_HEALTHCHECK_DB_ENV,
      ];

      // 실 token/password 형태(GH_TOKEN/Bearer/Authorization/x-*-token/ghp_/sk-/DB 실 password)만 검출.
      const credentialPattern =
        /(GH_TOKEN|\bBearer\b|Authorization|x-access-token|x-github-token|ghp_|\bsk-|postgres:\/\/[^@\s]*:[^@\s]+@)/i;
      haystacks.forEach((s) => {
        expect(credentialPattern.test(s)).toBe(false);
      });

      // 본 smoke 의 추출 surface 에 POSTGRES_PASSWORD/AUTH_JWT_SECRET 값이 포함되지 않음.
      // (env.prod.example 의 그 값은 placeholder `<...>` 이고, 본 smoke 는 키/host/port 만 추출.)
      expect(env.keys.size).toBeGreaterThan(0);
      const surfaceJoined = haystacks.join("|");
      expect(surfaceJoined).not.toContain("AUTH_JWT_SECRET");
      expect(surfaceJoined.toLowerCase()).not.toContain("password");
    });
  });

  describe("결정론·no-mutation", () => {
    it("동일 compose·Dockerfile·parse-port·env 소스로 추출을 두 번 → 결과가 byte-identical deep-equal", () => {
      const composeSource = readFileSync(COMPOSE_PATH, "utf8");
      const envSource = readFileSync(ENV_PROD_EXAMPLE_PATH, "utf8");

      const a = extractComposeContract(composeSource);
      const b = extractComposeContract(composeSource);
      expect(a).toEqual(b);

      const ea = extractEnvProdArtifact(envSource);
      const eb = extractEnvProdArtifact(envSource);
      expect(ea.port).toBe(eb.port);
      expect(ea.dbUrlHost).toBe(eb.dbUrlHost);
      expect(ea.dbUrlPort).toBe(eb.dbUrlPort);
      expect([...ea.keys].sort()).toEqual([...eb.keys].sort());
    });

    it("추출 보조 함수가 입력 문자열을 mutate 0 — 사본 mutate 후에도 원본 추출 결과 deep-equal 유지", () => {
      const composeSource = readFileSync(COMPOSE_PATH, "utf8");
      const before = extractComposeContract(composeSource);

      // 사본 mutate(drift 변별성 항과 동형) — 사본만 변형되나 원본 string·추출 결과는 불변.
      const mutated = composeSource
        .replace(/dockerfile:\s*Dockerfile/, "dockerfile: Dockerfile.dev")
        .replace(/\$\{PORT:-3000\}/g, "${PORT:-8080}");
      const mutatedContract = extractComposeContract(mutated);
      expect(mutatedContract).not.toEqual(before);

      // 원본 재추출은 before 와 deep-equal(보조 함수가 입력 mutate 0).
      expect(extractComposeContract(composeSource)).toEqual(before);
    });
  });
});
