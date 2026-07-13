// realdata-e2e-deploy-readme-runbook-cross-artifact-parity-contract.smoke-spec.ts
// — 무인 nightly 재배포 runner chain(daily-test.sh · redeploy.sh · seed-llm-config.sh · docker-entrypoint.sh ·
// systemd unit · docker-compose.yml · Dockerfile · env.prod.example) 을 운영자가 **손으로 배포·트리거·seed
// 하는 절차의 정본(single-source)** 인 `deploy/README.md` 배포 runbook 이, 각 sealed artifact 의 핵심
// 값·경로·명령을 산문으로 재기술한 **cross-artifact 문서-값 parity 계약** 을 실 파일 5종(README·timer·
// docker-compose.yml·seed-llm-config.sh·redeploy.sh)을 readFileSync 로 읽어(실 배포/실 컨테이너/실 systemd/
// 실 seed 실행 0) 정적 검증하는 non-gated 문서 single-source leg smoke
// (T-0965, PLAN.md §109 재배포 runner chain — documentation single-source leg).
//
// 봉함 불변식(README 문서-값 ↔ 실 artifact 값 cross-parity — 각 sealed artifact 의 내부 계약 T-0960~T-0964 와
// distinct 상보. 각 artifact 내부가 봉해져도 문서가 그 artifact 를 잘못 가리키면 배포가 조용히 오구성된다):
//   (1) README §5 의 `OnCalendar=*-*-* 03:00:00` 문서-값 ↔ `deploy/assessment-agent-redeploy.timer` 실 OnCalendar
//       값과 byte-동일. drift 시 운영자가 "매일 03:00" 라 믿지만 실 timer 는 다른 시각.
//   (2) README §3 `DATABASE_URL` 예시의 host(`postgres`) ↔ `docker-compose.yml` postgres 서비스명. drift 시
//       컨테이너 DB 연결 실패.
//   (3) README §3 `DATABASE_URL` 예시의 DB port(`5432`) ↔ compose postgres 서비스 노출 포트.
//   (4) README §4 named volume `assessment-agent-postgres-data` 문서-값 ↔ compose `volumes.*.name`. drift 시
//       백업·영속성 오해.
//   (5) README §4 기본 포트 `3000` 문서-값 ↔ compose `${PORT:-3000}` 기본값.
//   (6) README §5 cp 명령이 가리키는 systemd unit 파일명(`assessment-agent-redeploy.service`·`.timer`) ↔
//       `deploy/` 실 파일 실존. 오타면 `cp` 실패.
//   (7) README §3 `cp deploy/env.prod.example .env` ↔ `deploy/env.prod.example` 실 파일 실존.
//   (8) README §5.2 문서화 `SEED_LLM_*` 키셋 ↔ `deploy/seed-llm-config.sh` 소비 키셋 정확히 동일 집합
//       (누락·잉여 0). drift 시 운영자가 잘못된 키로 seed 실패.
//   (9) README §5.2 "redeploy.sh 가 seed-llm-config.sh 를 호출" 서술 ↔ `deploy/redeploy.sh` 실 호출 행
//       양방향 정합.
//
// 전략(형제 T-0964 env.prod.example 내부 템플릿·T-0963 Dockerfile 내부 빌드 시퀀스·T-0962 docker-compose 내부
// 오케스트레이션·T-0961 systemd unit 내부 directive 동형): README·timer·compose·seed·redeploy 에서 정본 토큰을
// 정적 추출하는 해석 동형 TS 순수 함수(readmeOnCalendar·timerOnCalendar·readmeDbHostPort·composeServiceNames·
// composeDbPort·readmeNamedVolume·composeNamedVolume·readmeDefaultAppPort·composeAppPortDefault·readmeCpUnitFiles·
// seedLlmKeys·redeployInvokesSeed·readmeDocumentsSeedCall·extractRunbookAnchors)로 cross-artifact parity 불변식을
// assert. 합성 mutant 사본으로 negative(a~h 8종) 변별. T-0961(timer 내부 directive)·T-0962(compose 내부
// 오케스트레이션)·T-0964(env 템플릿 키셋)·T-0959(seed gating semantic) 와 distinct — 본 task 는 README **문서-값**
// 이 그 실 artifact 값과 **parity** 인지만(각 artifact 내부 계약 재검증 0).
//   🔥 실 배포/실 cp/실 seed 실행/실 컨테이너/실 systemd/실 DB 0 · process.env 읽기 0(입력은 pure 함수 파라미터)
//      · credential 0(§9/REQ-059) · 새 dep 0(node fs/path, markdown/yaml/systemd 파서 추가 0) · src 변경 0(test-only)
//      · README/timer/compose/seed/redeploy 읽기만(실행 0 · 변경 0).
import { existsSync, readFileSync } from "fs";
import * as path from "path";

// repo-root 경로 — test 실행 cwd 무관하게 robust 하게 해석(`__dirname` = test/smoke,
// 두 단계 위가 repo-root). `process.cwd()` 대신 `__dirname` 기준 상대로 고정한다(sibling T-0964).
const REPO_ROOT = path.resolve(__dirname, "../..");
const README_PATH = path.join(REPO_ROOT, "deploy", "README.md");
const TIMER_PATH = path.join(
  REPO_ROOT,
  "deploy",
  "assessment-agent-redeploy.timer",
);
const COMPOSE_PATH = path.join(REPO_ROOT, "docker-compose.yml");
const SEED_SCRIPT_PATH = path.join(REPO_ROOT, "deploy", "seed-llm-config.sh");
const REDEPLOY_PATH = path.join(REPO_ROOT, "deploy", "redeploy.sh");
const ENV_EXAMPLE_PATH = path.join(REPO_ROOT, "deploy", "env.prod.example");
const DEPLOY_DIR = path.join(REPO_ROOT, "deploy");

// 정본 앵커(실 artifact 표현의 TS mirror — 실 배포/실 로드 0).
const EXPECTED_ONCALENDAR = "*-*-* 03:00:00"; // README §5 ↔ timer.
const EXPECTED_DB_HOST = "postgres"; // README §3 DATABASE_URL host ↔ compose postgres 서비스명.
const EXPECTED_DB_PORT = "5432"; // README §3 DATABASE_URL port ↔ compose postgres 포트.
const EXPECTED_NAMED_VOLUME = "assessment-agent-postgres-data"; // README §4 ↔ compose volumes.name.
const EXPECTED_APP_PORT = "3000"; // README §4 ↔ compose ${PORT:-3000}.
const EXPECTED_UNIT_FILES = [
  "assessment-agent-redeploy.service",
  "assessment-agent-redeploy.timer",
]; // README §5 cp ↔ deploy/ 실 파일.
const EXPECTED_SEED_KEYS = [
  "SEED_LLM_API_KEY",
  "SEED_LLM_CONFIG_ID",
  "SEED_LLM_ENDPOINT_URL",
  "SEED_LLM_MODEL_ID",
  "SEED_LLM_PROVIDER",
]; // README §5.2 문서화 == seed-llm-config.sh 소비 키셋(정렬 유니크).

// ── TS 동형 pure 함수(정본) — README/timer/compose/seed/redeploy 의 정본 토큰을 모델링.
//    입력(문자열)은 mutate 하지 않는다(읽기만). 실 파서 라이브러리 0 — 정규식/행 슬라이스만.

// 소스를 CRLF-정규화 후 라인 배열로 — 모든 파서의 공통 입력.
function toLines(source: string): string[] {
  return source.replace(/\r\n/g, "\n").split("\n");
}

// 공백 붕괴 — 라인 넘김이 낀 산문 서술의 단일-라인 정규화(README 서술 매칭용).
function collapseWs(source: string): string {
  return source.replace(/\s+/g, " ");
}

// readmeOnCalendar(readme): README 산문의 OnCalendar 문서-값(`*-*-* HH:MM:SS`) — 부재면 undefined.
function readmeOnCalendar(readme: string): string | undefined {
  const m = readme.match(/OnCalendar=(\*-\*-\* \d{2}:\d{2}:\d{2})/);
  return m ? m[1] : undefined;
}

// timerOnCalendar(timer): systemd timer 파일의 실 OnCalendar 값(주석 아닌 지시행) — 부재면 undefined.
function timerOnCalendar(timer: string): string | undefined {
  for (const line of toLines(timer)) {
    if (/^\s*#/.test(line)) continue;
    const m = line.match(/^\s*OnCalendar=(\S.*?)\s*$/);
    if (m) return m[1];
  }
  return undefined;
}

// readmeDbHostPort(readme): README §3 DATABASE_URL 예시의 host/port — 부재면 undefined.
function readmeDbHostPort(
  readme: string,
): { host: string; port: string } | undefined {
  const m = readme.match(/postgres(?:ql)?:\/\/[^@\s]+@([^:/\s]+):(\d+)\//);
  return m ? { host: m[1], port: m[2] } : undefined;
}

// composeServiceNames(compose): docker-compose `services:` 블록의 2-space 인덴트 서비스명 유니크 집합.
function composeServiceNames(compose: string): string[] {
  const lines = toLines(compose);
  const start = lines.findIndex((l) => /^services:\s*$/.test(l));
  if (start < 0) return [];
  const names: string[] = [];
  for (let i = start + 1; i < lines.length; i++) {
    const line = lines[i];
    if (/^\S/.test(line)) break; // 다음 top-level 키(volumes: 등) 도달.
    const m = line.match(/^ {2}([a-z][\w-]*):\s*$/);
    if (m) names.push(m[1]);
  }
  return names;
}

// composeServiceBlock(compose, service): 특정 서비스의 텍스트 블록(다음 동급 키 전까지).
function composeServiceBlock(compose: string, service: string): string {
  const lines = toLines(compose);
  const start = lines.findIndex((l) =>
    new RegExp(`^ {2}${service}:\\s*$`).test(l),
  );
  if (start < 0) return "";
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i++) {
    if (/^\S/.test(lines[i]) || /^ {2}[a-z][\w-]*:\s*$/.test(lines[i])) {
      end = i;
      break;
    }
  }
  return lines.slice(start, end).join("\n");
}

// composeDbPort(compose): postgres 서비스의 노출 포트("<host>:<container>")의 container port — 부재면 undefined.
function composeDbPort(compose: string): string | undefined {
  const block = composeServiceBlock(compose, "postgres");
  const m = block.match(/"(\d+):(\d+)"/);
  return m ? m[2] : undefined;
}

// readmeNamedVolume(readme): README §4 산문의 named volume 문서-값 — 부재면 undefined.
function readmeNamedVolume(readme: string): string | undefined {
  const m = readme.match(/named volume `([\w-]+)`/);
  return m ? m[1] : undefined;
}

// composeNamedVolume(compose): compose `volumes:` 블록의 `name:` 값 — 부재면 undefined.
//   `container_name:` 는 매칭 안 됨(선행 whitespace 직후 정확히 `name:` 요구).
function composeNamedVolume(compose: string): string | undefined {
  const m = compose.match(/^\s+name:\s*([\w-]+)\s*$/m);
  return m ? m[1] : undefined;
}

// readmeDefaultAppPort(readme): README §4 산문의 기본 포트 문서-값 — 부재면 undefined.
function readmeDefaultAppPort(readme: string): string | undefined {
  const m = readme.match(/기본 포트 `(\d+)`/);
  return m ? m[1] : undefined;
}

// composeAppPortDefault(compose): compose `${PORT:-<n>}` 의 기본값 — 부재면 undefined.
function composeAppPortDefault(compose: string): string | undefined {
  const m = compose.match(/\$\{PORT:-(\d+)\}/);
  return m ? m[1] : undefined;
}

// readmeCpUnitFiles(readme): README cp 명령이 가리키는 systemd unit 파일명 유니크 집합(정렬).
function readmeCpUnitFiles(readme: string): string[] {
  const set = new Set<string>();
  const re = /cp\s+\S*deploy\/(assessment-agent-redeploy\.\w+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(readme)) !== null) set.add(m[1]);
  return [...set].sort();
}

// readmeReferencesEnvExampleCp(readme): README §3 `cp deploy/env.prod.example .env` 명령 행 존재.
function readmeReferencesEnvExampleCp(readme: string): boolean {
  return /cp\s+deploy\/env\.prod\.example\s+\.env/.test(readme);
}

// seedLlmKeys(source): 소스에서 SEED_LLM_[A-Z_]+ 토큰을 정적 추출한 정렬된 유니크 집합(주석·코드 무관).
function seedLlmKeys(source: string): string[] {
  const set = new Set<string>();
  const re = /SEED_LLM_[A-Z_]+/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(source)) !== null) set.add(m[0]);
  return [...set].sort();
}

// setsEqual(a, b): 두 문자열 배열이 같은 집합(순서 무관·중복 무시)인가.
function setsEqual(a: string[], b: string[]): boolean {
  const sa = new Set(a);
  const sb = new Set(b);
  if (sa.size !== sb.size) return false;
  for (const x of sa) if (!sb.has(x)) return false;
  return true;
}

// redeployInvokesSeed(redeploy): redeploy.sh 가 seed-llm-config.sh 를 실제 호출하는 행 존재.
function redeployInvokesSeed(redeploy: string): boolean {
  return /bash\s+"?[^"\n]*deploy\/seed-llm-config\.sh/.test(redeploy);
}

// readmeDocumentsSeedCall(readme): README §5.2 가 "redeploy.sh 가 seed-llm-config.sh 를 호출" 이라 서술.
//   라인 넘김을 붕괴 후 redeploy.sh → seed-llm-config.sh → 호출 순서로 근접 매칭.
function readmeDocumentsSeedCall(readme: string): boolean {
  const flat = collapseWs(readme);
  return /redeploy\.sh.{0,80}seed-llm-config\.sh.{0,40}호출/.test(flat);
}

// (집계) extractRunbookAnchors(...): cross-artifact parity 불변식을 한 번에 집계 —
//   하나라도 부재/변질이면 명시적 false(빈 결과 성공-위장 0).
function extractRunbookAnchors(
  readme: string,
  timer: string,
  compose: string,
  seed: string,
  redeploy: string,
): {
  onCalendarParity: boolean;
  dbHostParity: boolean;
  dbPortParity: boolean;
  namedVolumeParity: boolean;
  appPortParity: boolean;
  unitFilesReferenced: boolean;
  envExampleCpReferenced: boolean;
  seedKeysetParity: boolean;
  seedCallParity: boolean;
} {
  const rOnCal = readmeOnCalendar(readme);
  const tOnCal = timerOnCalendar(timer);
  const dbHP = readmeDbHostPort(readme);
  const services = composeServiceNames(compose);
  return {
    onCalendarParity:
      rOnCal !== undefined && tOnCal !== undefined && rOnCal === tOnCal,
    dbHostParity: dbHP !== undefined && services.includes(dbHP.host),
    dbPortParity: dbHP !== undefined && composeDbPort(compose) === dbHP.port,
    namedVolumeParity:
      readmeNamedVolume(readme) !== undefined &&
      readmeNamedVolume(readme) === composeNamedVolume(compose),
    appPortParity:
      readmeDefaultAppPort(readme) !== undefined &&
      readmeDefaultAppPort(readme) === composeAppPortDefault(compose),
    unitFilesReferenced: setsEqual(
      readmeCpUnitFiles(readme),
      EXPECTED_UNIT_FILES,
    ),
    envExampleCpReferenced: readmeReferencesEnvExampleCp(readme),
    seedKeysetParity:
      seedLlmKeys(readme).length > 0 &&
      setsEqual(seedLlmKeys(readme), seedLlmKeys(seed)),
    seedCallParity:
      readmeDocumentsSeedCall(readme) === redeployInvokesSeed(redeploy),
  };
}

describe("realdata-e2e §109 deploy/README.md 배포 runbook cross-artifact 정본 계약 smoke — OnCalendar 03:00↔timer + DATABASE_URL host:port↔compose + named volume↔compose + PORT 3000↔compose + systemd unit 파일명 실존 + cp env.prod.example .env + SEED_LLM_* 키셋↔seed-llm-config.sh 소비셋 + redeploy→seed 호출 문서 parity + secret-safety (T-0965)", () => {
  const readme = () => readFileSync(README_PATH, "utf8");
  const timer = () => readFileSync(TIMER_PATH, "utf8");
  const compose = () => readFileSync(COMPOSE_PATH, "utf8");
  const seed = () => readFileSync(SEED_SCRIPT_PATH, "utf8");
  const redeploy = () => readFileSync(REDEPLOY_PATH, "utf8");

  describe("Happy-path: 대조 artifact 5종 실존 + 9 cross-parity 앵커 전부 true", () => {
    it("README·timer·docker-compose.yml·seed-llm-config.sh·redeploy.sh 가 repo-root 기준 실존(existsSync)", () => {
      expect(existsSync(README_PATH)).toBe(true);
      expect(existsSync(TIMER_PATH)).toBe(true);
      expect(existsSync(COMPOSE_PATH)).toBe(true);
      expect(existsSync(SEED_SCRIPT_PATH)).toBe(true);
      expect(existsSync(REDEPLOY_PATH)).toBe(true);
    });

    it("9 cross-parity 불변식(OnCalendar·DB host·DB port·named volume·app port·unit 파일 참조·env.example cp·SEED_LLM 키셋·redeploy→seed 호출) 전부 true", () => {
      const anchors = extractRunbookAnchors(
        readme(),
        timer(),
        compose(),
        seed(),
        redeploy(),
      );
      expect(anchors.onCalendarParity).toBe(true);
      expect(anchors.dbHostParity).toBe(true);
      expect(anchors.dbPortParity).toBe(true);
      expect(anchors.namedVolumeParity).toBe(true);
      expect(anchors.appPortParity).toBe(true);
      expect(anchors.unitFilesReferenced).toBe(true);
      expect(anchors.envExampleCpReferenced).toBe(true);
      expect(anchors.seedKeysetParity).toBe(true);
      expect(anchors.seedCallParity).toBe(true);
    });
  });

  describe("Happy-path: OnCalendar 03:00 문서-값 ↔ timer 실값 byte-동일", () => {
    it("README §5 OnCalendar 문서-값이 `*-*-* 03:00:00` 이고 timer 실 OnCalendar 값과 동일", () => {
      expect(readmeOnCalendar(readme())).toBe(EXPECTED_ONCALENDAR);
      expect(timerOnCalendar(timer())).toBe(EXPECTED_ONCALENDAR);
      expect(readmeOnCalendar(readme())).toBe(timerOnCalendar(timer()));
    });
  });

  describe("Happy-path: DATABASE_URL host:port ↔ compose postgres 서비스명·포트", () => {
    it("README §3 DATABASE_URL host `postgres` 가 compose 서비스명 집합에 존재, port `5432` 가 compose postgres 노출 포트와 일치", () => {
      const hp = readmeDbHostPort(readme());
      expect(hp).toBeDefined();
      expect(hp?.host).toBe(EXPECTED_DB_HOST);
      expect(hp?.port).toBe(EXPECTED_DB_PORT);
      expect(composeServiceNames(compose())).toContain(EXPECTED_DB_HOST);
      expect(composeDbPort(compose())).toBe(EXPECTED_DB_PORT);
    });
  });

  describe("Happy-path: named volume 문서-값 ↔ compose volumes.name", () => {
    it("README §4 named volume `assessment-agent-postgres-data` 가 compose volumes.*.name 과 일치", () => {
      expect(readmeNamedVolume(readme())).toBe(EXPECTED_NAMED_VOLUME);
      expect(composeNamedVolume(compose())).toBe(EXPECTED_NAMED_VOLUME);
      expect(readmeNamedVolume(readme())).toBe(composeNamedVolume(compose()));
    });
  });

  describe("Happy-path: 기본 포트 3000 문서-값 ↔ compose ${PORT:-3000}", () => {
    it("README §4 기본 포트 `3000` 이 compose ${PORT:-3000} 기본값과 일치", () => {
      expect(readmeDefaultAppPort(readme())).toBe(EXPECTED_APP_PORT);
      expect(composeAppPortDefault(compose())).toBe(EXPECTED_APP_PORT);
      expect(readmeDefaultAppPort(readme())).toBe(
        composeAppPortDefault(compose()),
      );
    });
  });

  describe("Happy-path: systemd unit 파일명 참조 ↔ deploy/ 실 파일 실존", () => {
    it("README §5 cp 명령이 가리키는 unit 파일명 2종이 정확히 {service,timer} 이고 각각 deploy/ 에 실 파일로 존재", () => {
      expect(readmeCpUnitFiles(readme())).toEqual(EXPECTED_UNIT_FILES);
      for (const fname of EXPECTED_UNIT_FILES) {
        expect(existsSync(path.join(DEPLOY_DIR, fname))).toBe(true);
      }
    });
  });

  describe("Happy-path: cp deploy/env.prod.example .env 참조 ↔ env.prod.example 실존", () => {
    it("README §3 `cp deploy/env.prod.example .env` 명령이 존재하고 deploy/env.prod.example 이 실 파일로 존재", () => {
      expect(readmeReferencesEnvExampleCp(readme())).toBe(true);
      expect(existsSync(ENV_EXAMPLE_PATH)).toBe(true);
    });
  });

  describe("SEED_LLM_* 키셋 cross-artifact parity 계약: README 문서화셋 == seed-llm-config.sh 소비셋", () => {
    it("README §5.2 문서화 SEED_LLM_* 키셋이 seed-llm-config.sh 소비 키셋과 정확히 동일 집합(누락·잉여 0)", () => {
      const readmeKeys = seedLlmKeys(readme());
      const seedKeys = seedLlmKeys(seed());
      expect(readmeKeys.length).toBeGreaterThan(0);
      expect(seedKeys.length).toBeGreaterThan(0);
      expect(setsEqual(readmeKeys, seedKeys)).toBe(true);
      // 실 소비 키셋 스냅샷(문서-스크립트 동기 확인).
      expect(seedKeys).toEqual(EXPECTED_SEED_KEYS);
      expect(readmeKeys).toEqual(EXPECTED_SEED_KEYS);
    });
  });

  describe("redeploy→seed 호출 문서 parity 계약: README §5.2 서술 ↔ redeploy.sh 실 호출 행", () => {
    it("redeploy.sh 가 seed-llm-config.sh 를 실제 호출하고 README §5.2 가 그 호출을 서술 — 양방향 정합", () => {
      expect(redeployInvokesSeed(redeploy())).toBe(true);
      expect(readmeDocumentsSeedCall(readme())).toBe(true);
      expect(readmeDocumentsSeedCall(readme())).toBe(
        redeployInvokesSeed(redeploy()),
      );
    });
  });

  describe("branch: 각 정본 앵커 일치/drift 정적 대조(합성 mutant 사본 — 원본 미변조)", () => {
    it("OnCalendar 일치/drift 분기", () => {
      const r = readme();
      expect(readmeOnCalendar(r)).toBe(timerOnCalendar(timer()));
      const mutant = r.replace(
        "OnCalendar=*-*-* 03:00:00",
        "OnCalendar=*-*-* 04:00:00",
      );
      expect(readmeOnCalendar(mutant)).toBe("*-*-* 04:00:00");
      expect(readmeOnCalendar(mutant)).not.toBe(timerOnCalendar(timer()));
    });

    it("DB host 일치/drift 분기", () => {
      const r = readme();
      expect(composeServiceNames(compose())).toContain(
        readmeDbHostPort(r)?.host,
      );
      const mutant = r.replace("@postgres:5432", "@localhost:5432");
      expect(readmeDbHostPort(mutant)?.host).toBe("localhost");
      expect(composeServiceNames(compose())).not.toContain("localhost");
    });

    it("named volume 일치/drift 분기", () => {
      const r = readme();
      expect(readmeNamedVolume(r)).toBe(composeNamedVolume(compose()));
      const mutant = r.replace("assessment-agent-postgres-data", "pgdata");
      expect(readmeNamedVolume(mutant)).toBe("pgdata");
      expect(readmeNamedVolume(mutant)).not.toBe(composeNamedVolume(compose()));
    });

    it("app port 일치/drift 분기", () => {
      const r = readme();
      expect(readmeDefaultAppPort(r)).toBe(composeAppPortDefault(compose()));
      const mutant = r.replace("기본 포트 `3000`", "기본 포트 `8080`");
      expect(readmeDefaultAppPort(mutant)).toBe("8080");
      expect(readmeDefaultAppPort(mutant)).not.toBe(
        composeAppPortDefault(compose()),
      );
    });

    it("SEED_LLM 키셋 일치/drift 분기", () => {
      const r = readme();
      expect(setsEqual(seedLlmKeys(r), seedLlmKeys(seed()))).toBe(true);
      const mutant = r.replace(/SEED_LLM_MODEL_ID/g, "OMITTED_MODEL_ID");
      expect(setsEqual(seedLlmKeys(mutant), seedLlmKeys(seed()))).toBe(false);
    });

    it("redeploy→seed 호출 있음/없음 분기", () => {
      const rd = redeploy();
      expect(redeployInvokesSeed(rd)).toBe(true);
      const mutant = rd.replace(
        /bash\s+"[^"\n]*deploy\/seed-llm-config\.sh"/,
        ": # seed 호출 제거됨",
      );
      expect(redeployInvokesSeed(mutant)).toBe(false);
    });
  });

  describe("Error path / negative cases 충분 cover (mutant 합성 사본 — 원본 미변조, 예외 분기마다 각 1+)", () => {
    it("error path — 대조 artifact 부재 경로 → readFileSync throw(silent 0-byte fallback 0)", () => {
      const badPath = path.join(DEPLOY_DIR, "__does_not_exist__.README.md");
      expect(existsSync(badPath)).toBe(false);
      expect(() => readFileSync(badPath, "utf8")).toThrow();
    });

    it("error path — 앵커 토큰 부재 시 명시적 false(빈 매칭을 pass 로 오통과 0)", () => {
      const anchors = extractRunbookAnchors("", "", "", "", "");
      expect(anchors.onCalendarParity).toBe(false);
      expect(anchors.dbHostParity).toBe(false);
      expect(anchors.dbPortParity).toBe(false);
      expect(anchors.namedVolumeParity).toBe(false);
      expect(anchors.appPortParity).toBe(false);
      expect(anchors.unitFilesReferenced).toBe(false);
      expect(anchors.envExampleCpReferenced).toBe(false);
      expect(anchors.seedKeysetParity).toBe(false);
      // 빈 소스는 문서 서술도 호출 행도 없어 false===false → parity vacuous true 이나,
      // 실 소스는 반대로 전부 true — 부재/실재 변별.
      const real = extractRunbookAnchors(
        readme(),
        timer(),
        compose(),
        seed(),
        redeploy(),
      );
      expect(real.onCalendarParity).toBe(true);
      expect(real.seedKeysetParity).toBe(true);
      expect(real.seedCallParity).toBe(true);
    });

    it("negative (a) — README OnCalendar 03:00→04:00 mutant → 스케줄 문서-값 drift(timer 불일치) 검출", () => {
      const r = readme();
      expect(readmeOnCalendar(r)).toBe(timerOnCalendar(timer()));
      const mutant = r.replace(
        "OnCalendar=*-*-* 03:00:00",
        "OnCalendar=*-*-* 04:00:00",
      );
      expect(
        extractRunbookAnchors(mutant, timer(), compose(), seed(), redeploy())
          .onCalendarParity,
      ).toBe(false);
      // 원본 불변.
      expect(readmeOnCalendar(r)).toBe(EXPECTED_ONCALENDAR);
    });

    it("negative (b) — README DB host postgres→localhost mutant → DB host 문서-값 drift(compose 서비스명 불일치) 검출", () => {
      const r = readme();
      const mutant = r.replace("@postgres:5432", "@localhost:5432");
      expect(readmeDbHostPort(mutant)?.host).toBe("localhost");
      expect(
        extractRunbookAnchors(mutant, timer(), compose(), seed(), redeploy())
          .dbHostParity,
      ).toBe(false);
      // 원본 불변.
      expect(readmeDbHostPort(r)?.host).toBe(EXPECTED_DB_HOST);
    });

    it("negative (c) — README named volume →pgdata mutant → volume 문서-값 drift 검출", () => {
      const r = readme();
      const mutant = r.replace("assessment-agent-postgres-data", "pgdata");
      expect(readmeNamedVolume(mutant)).toBe("pgdata");
      expect(
        extractRunbookAnchors(mutant, timer(), compose(), seed(), redeploy())
          .namedVolumeParity,
      ).toBe(false);
      // 원본 불변.
      expect(readmeNamedVolume(r)).toBe(EXPECTED_NAMED_VOLUME);
    });

    it("negative (d) — README 기본 포트 3000→8080 mutant → 포트 문서-값 drift(compose 기본값 불일치) 검출", () => {
      const r = readme();
      const mutant = r.replace("기본 포트 `3000`", "기본 포트 `8080`");
      expect(readmeDefaultAppPort(mutant)).toBe("8080");
      expect(
        extractRunbookAnchors(mutant, timer(), compose(), seed(), redeploy())
          .appPortParity,
      ).toBe(false);
      // 원본 불변.
      expect(readmeDefaultAppPort(r)).toBe(EXPECTED_APP_PORT);
    });

    it("negative (e) — README cp unit 파일명 .timer→redeploy.timer mutant → 존재하지 않는 파일 가리킴(cp 실패) 검출", () => {
      const r = readme();
      const mutant = r.replace(
        /deploy\/assessment-agent-redeploy\.timer/g,
        "deploy/redeploy.timer",
      );
      const mutated = readmeCpUnitFiles(mutant);
      expect(mutated).not.toEqual(EXPECTED_UNIT_FILES);
      expect(setsEqual(mutated, EXPECTED_UNIT_FILES)).toBe(false);
      // 가리키는 파일이 실제로 존재하지 않음(cp 실패 유발).
      expect(existsSync(path.join(DEPLOY_DIR, "redeploy.timer"))).toBe(false);
      expect(
        extractRunbookAnchors(mutant, timer(), compose(), seed(), redeploy())
          .unitFilesReferenced,
      ).toBe(false);
      // 원본 불변.
      expect(readmeCpUnitFiles(r)).toEqual(EXPECTED_UNIT_FILES);
    });

    it("negative (f) — README §5.2 SEED_LLM_MODEL_ID 문서화 제거 mutant → 소비셋 ⊋ 문서화셋 parity drift 검출", () => {
      const r = readme();
      const s = seed();
      expect(setsEqual(seedLlmKeys(r), seedLlmKeys(s))).toBe(true);
      const mutant = r.replace(/SEED_LLM_MODEL_ID/g, "OMITTED_MODEL_ID");
      expect(seedLlmKeys(mutant)).not.toContain("SEED_LLM_MODEL_ID");
      expect(seedLlmKeys(s)).toContain("SEED_LLM_MODEL_ID");
      expect(
        extractRunbookAnchors(mutant, timer(), compose(), s, redeploy())
          .seedKeysetParity,
      ).toBe(false);
      // 원본 불변.
      expect(setsEqual(seedLlmKeys(r), seedLlmKeys(s))).toBe(true);
    });

    it("negative (g) — seed-llm-config.sh 소비셋 fixture 에 스크립트 미소비 SEED_LLM_TEMPERATURE 추가 합성 mutant → 문서화셋 ⊊ 소비셋(잉여 키) drift 검출", () => {
      const r = readme();
      const s = seed();
      expect(setsEqual(seedLlmKeys(r), seedLlmKeys(s))).toBe(true);
      // 스크립트가 실제로는 안 읽는 잉여 키를 소비셋에 추가(합성) — README 문서화셋에는 없음.
      const seedMutant = s + '\nTEMP="${SEED_LLM_TEMPERATURE:-0}"\n';
      expect(seedLlmKeys(seedMutant)).toContain("SEED_LLM_TEMPERATURE");
      expect(seedLlmKeys(r)).not.toContain("SEED_LLM_TEMPERATURE");
      expect(setsEqual(seedLlmKeys(r), seedLlmKeys(seedMutant))).toBe(false);
      expect(
        extractRunbookAnchors(r, timer(), compose(), seedMutant, redeploy())
          .seedKeysetParity,
      ).toBe(false);
      // 원본 불변.
      expect(seedLlmKeys(s)).not.toContain("SEED_LLM_TEMPERATURE");
    });

    it("negative (h) — redeploy.sh 의 seed-llm-config.sh 호출 행 제거 mutant → 문서(§5.2 호출 서술) ↔ 스크립트(호출 없음) 양방향 drift 검출", () => {
      const rd = redeploy();
      expect(redeployInvokesSeed(rd)).toBe(true);
      expect(readmeDocumentsSeedCall(readme())).toBe(true);
      const mutant = rd.replace(
        /bash\s+"[^"\n]*deploy\/seed-llm-config\.sh"/,
        ": # seed 호출 제거됨",
      );
      expect(redeployInvokesSeed(mutant)).toBe(false);
      expect(
        extractRunbookAnchors(readme(), timer(), compose(), seed(), mutant)
          .seedCallParity,
      ).toBe(false);
      // 원본 불변.
      expect(redeployInvokesSeed(rd)).toBe(true);
    });

    it("negative — §9 credential/secret 누출 0: 추출/합성 토큰에 gh 토큰 어휘·실 credential·실 endpoint·실 password 미등장(§9/REQ-059)", () => {
      const anchors = extractRunbookAnchors(
        readme(),
        timer(),
        compose(),
        seed(),
        redeploy(),
      );
      // 추출 토큰 — OnCalendar 값·서비스명·볼륨명·포트·파일명·SEED_LLM 키 이름·비시크릿 값만.
      const synthesized = [
        JSON.stringify(anchors),
        JSON.stringify(readmeCpUnitFiles(readme())),
        JSON.stringify(seedLlmKeys(readme())),
        JSON.stringify(seedLlmKeys(seed())),
        JSON.stringify(composeServiceNames(compose())),
        String(readmeOnCalendar(readme())),
        String(readmeNamedVolume(readme())),
        String(readmeDbHostPort(readme())?.host),
        String(readmeDbHostPort(readme())?.port),
      ];
      const strongPattern =
        /(ghp_|--token|GITHUB_TOKEN|GH_TOKEN|\bBearer\b|Authorization|\bsk-)/i;
      synthesized.forEach((s) => {
        expect(strongPattern.test(s)).toBe(false);
      });
      // 합성 mutant 값도 명백한 dummy(04:00:00·localhost·pgdata·8080)로 한정 — 실 자격 0.
      const dummies = ["04:00:00", "localhost", "pgdata", "8080"];
      dummies.forEach((d) => expect(strongPattern.test(d)).toBe(false));
      // 실 DATABASE_URL 예시는 실 password 가 아니라 <...> placeholder 만 담음.
      expect(readme()).toMatch(
        /postgresql:\/\/assessment_agent:<[^>]*>@postgres:5432\//,
      );
    });
  });

  describe("flow: 결정론 · no-mutation(원본 read-only 입증)", () => {
    it("동일 입력으로 pure 함수를 두 번 호출하면 deep-equal(결정론)", () => {
      const r = readme();
      const anchors1 = extractRunbookAnchors(
        r,
        timer(),
        compose(),
        seed(),
        redeploy(),
      );
      const anchors2 = extractRunbookAnchors(
        r,
        timer(),
        compose(),
        seed(),
        redeploy(),
      );
      expect(anchors1).toEqual(anchors2);
      expect(seedLlmKeys(r)).toEqual(seedLlmKeys(r));
      expect(readmeCpUnitFiles(r)).toEqual(readmeCpUnitFiles(r));
    });

    it("합성 mutate(사본 replace) 후에도 원본 소스 텍스트·pure 함수 산출이 불변(원본 read-only)", () => {
      const r = readme();
      const rd = redeploy();
      const s = seed();
      const rSnap = r;
      const rdSnap = rd;
      const sSnap = s;
      // 사본 mutate(negative a~h 에서 쓰는 replace) — 원본 불변 확인.
      r.replace("OnCalendar=*-*-* 03:00:00", "OnCalendar=*-*-* 04:00:00");
      r.replace("@postgres:5432", "@localhost:5432");
      r.replace("assessment-agent-postgres-data", "pgdata");
      r.replace("기본 포트 `3000`", "기본 포트 `8080`");
      r.replace(/SEED_LLM_MODEL_ID/g, "OMITTED");
      rd.replace(/bash\s+"[^"\n]*deploy\/seed-llm-config\.sh"/, ":");
      expect(r).toBe(rSnap);
      expect(rd).toBe(rdSnap);
      expect(s).toBe(sSnap);
      // 추출/파싱 후에도 원본 불변.
      extractRunbookAnchors(r, timer(), compose(), s, rd);
      expect(r).toBe(rSnap);
      expect(rd).toBe(rdSnap);
      expect(s).toBe(sSnap);
    });
  });

  describe("dormant / non-gated 확인 — side-effect 0", () => {
    it("runbook parity 모델이 env / 전역 상태 없이 순수하게 동작(non-gated — describe.skip 0·gating 분기 0)", () => {
      // 본 describe 가 실행된다는 것 자체가 describe.skip 0(항상 실행)의 런타임 증거.
      const envSnapshot = { ...process.env };
      const r = readme();
      const before = readmeOnCalendar(r);
      // 실 process.env 를 mutate 해도 산출 불변 — 모델이 process.env 를 참조하지 않음(파라미터로만).
      Object.assign(process.env, { RUNBOOK_PARITY_UNIT_TEST: "x" });
      const after = readmeOnCalendar(r);
      delete process.env.RUNBOOK_PARITY_UNIT_TEST;
      expect(after).toBe(before);
      expect(Object.keys(process.env)).toEqual(Object.keys(envSnapshot));
    });

    it("파일 read 는 README/timer/compose/seed/redeploy 읽기만 — 실 배포/실 cp/실 seed/실 컨테이너/실 systemd 0. README/artifact 는 조건 분기 없는 선언적 runbook·설정 — 런타임 분기 없음(선언적)이라 happy/negative mutant 로 대체 cover", () => {
      const anchors = extractRunbookAnchors(
        readme(),
        timer(),
        compose(),
        seed(),
        redeploy(),
      );
      expect(Object.values(anchors).every((v) => v === true)).toBe(true);
    });
  });
});
