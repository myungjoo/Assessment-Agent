// load-workflow-k6-harness-wiring-drift.smoke-spec.ts
// — R-91 / REQ-047 부하 harness 실행 배선(`.github/workflows/load-k6.yml` 의 `workflow_dispatch`
// 전용 트리거 + k6 설치/실행 step) ↔ 실 스크립트(`test/load/smoke.js`) ↔ `package.json` 의
// `test:load` 3 자 parity 를 실 파일 read + 정적 텍스트 추출로 대조하는 drift smoke (T-1620).
// 존재 이유 — ADR-0054 §Consequences 긍정("PR CI 무영향 — k6 는 별도 정기/수동 job 분리")과
// load-resilience-test-plan.md §5 item 4 는 문자열 배선에만 의존해, ① 상시 트리거 혼입 ② 실행
// 경로 분기 ③ k6 의 npm dependency 편입 어느 것도 상시 CI 를 red 로 만들지 않는다.
//      🔥 실 GitHub Actions 발화 0 · 실 k6 실행 0 · YAML 파서 0 · 새 dependency 0 · DB 의존 0 ·
//         process.env 읽기/쓰기 0 — 파일 read + 합성 문자열 주입만. src·ci.yml 변경 0(read only).
import { readFileSync, existsSync } from "fs";
import * as path from "path";

// repo-root — 실행 cwd 무관하게 `__dirname`(= test/smoke) 기준 두 단계 위로 고정.
const REPO_ROOT = path.resolve(__dirname, "../..");
const LOAD_YML_PATH = path.join(REPO_ROOT, ".github/workflows/load-k6.yml");
const CI_YML_PATH = path.join(REPO_ROOT, ".github/workflows/ci.yml");
const PKG_JSON_PATH = path.join(REPO_ROOT, "package.json");

/** 배선 정본 — workflow step 이름과 부하 스크립트 경로. */
const INSTALL_STEP_NAME = "k6 설치";
const RUN_STEP_NAME = "k6 부하 스크립트 실행";
const LOAD_SCRIPT_REL = "test/load/smoke.js";
/** T-1621 — 부하 대상 기동/정리 step 이름과 겨냥 base URL. */
const BUILD_STEP_NAME = "부하 대상 이미지 빌드";
const BOOT_STEP_NAME = "부하 대상 컨테이너 기동 + readiness polling";
const TEARDOWN_STEP_NAME = "부하 대상 정리";
const EXPECTED_BASE_URL = "http://localhost:3000";

/** load-k6.yml 한 step 의 정규형 — 존재 여부 · uses · run. */
interface StepExtraction {
  found: boolean;
  uses: string | null;
  run: string | null;
}

/** 행의 선행 공백 수(YAML 블록 경계 판정용). 분기 없음. */
function indentOf(line: string): number {
  return line.length - line.trimStart().length;
}

/** 값의 감싼 따옴표만 벗긴다(내부 공백은 보존). */
function unquote(raw: string): string {
  const v = raw.trim();
  const q = v[0];
  return v.length >= 2 && (q === '"' || q === "'") && v[v.length - 1] === q
    ? v.slice(1, -1)
    : v;
}

/**
 * `- name: <stepName>` 블록 행들을 잘라낸다(헤더보다 깊은 들여쓰기가 이어지는 동안 계속, 같거나
 * 얕은 비어있지 않은 행에서 종료 — 없으면 파일 끝에서 종료). 대상 부재면 `null`(추측 0).
 * @throws {TypeError} `source`/`stepName` 이 non-string 일 때(0-byte fallback false-PASS 방지).
 */
function extractStepBlock(source: string, stepName: string): string[] | null {
  if (typeof source !== "string" || typeof stepName !== "string") {
    throw new TypeError(
      "extractStepBlock: source·stepName 은 string 이어야 함",
    );
  }
  const lines = source.split("\n");
  const headerIdx = lines.findIndex((l) => l.trim() === `- name: ${stepName}`);
  if (headerIdx < 0) {
    return null;
  }
  const headerIndent = indentOf(lines[headerIdx]);
  const block = [lines[headerIdx]];
  for (let i = headerIdx + 1; i < lines.length; i += 1) {
    if (lines[i].trim() !== "" && indentOf(lines[i]) <= headerIndent) {
      break;
    }
    block.push(lines[i]);
  }
  return block;
}

/** step 블록에서 `key:` 한 줄 값(인라인 형태만). 부재면 null. */
function extractKey(block: string[], key: string): string | null {
  const line = block.find((l) => l.trim().startsWith(`${key}:`));
  return line ? unquote(line.trim().slice(key.length + 1)) : null;
}

/** workflow 텍스트에서 한 step 의 정규형(대상 부재면 found=false · uses/run null). */
function extractStep(source: string, stepName: string): StepExtraction {
  const block = extractStepBlock(source, stepName);
  return block === null
    ? { found: false, uses: null, run: null }
    : {
        found: true,
        uses: extractKey(block, "uses"),
        run: extractKey(block, "run"),
      };
}

/** `k6 run <path>` 에서 스크립트 상대경로만 뽑는다. 형태가 다르면 null(추측 0). */
function scriptPathOf(command: string | null): string | null {
  const m =
    command === null ? null : command.trim().match(/^k6\s+run\s+(\S+)$/);
  return m ? m[1] : null;
}

/** workflow 텍스트의 트리거 선언부(`on:` 행 ~ `jobs:` 행 직전)만 잘라낸다. */
function triggerSection(source: string): string {
  const lines = source.split("\n");
  const start = lines.findIndex((l) => l.trim() === "on:");
  const end = lines.findIndex((l) => l.trim() === "jobs:");
  return start < 0 || end < 0 ? "" : lines.slice(start, end).join("\n");
}

/**
 * trim 기준으로 정확히 일치하는 행의 index(step 순서 비교 · 섹션 경계 판정 공용). 부재면 -1(추측 0).
 * @throws {TypeError} non-string 입력일 때(extractStepBlock 과 동형 계약 — 0-byte false-PASS 방지).
 */
function lineIndexOf(source: string, trimmedLine: string): number {
  if (typeof source !== "string" || typeof trimmedLine !== "string") {
    throw new TypeError("lineIndexOf: source·trimmedLine 은 string 이어야 함");
  }
  return source.split("\n").findIndex((l) => l.trim() === trimmedLine);
}

/** step 헤더 행 index(순서 단언용). 부재면 -1. */
const stepIndexOf = (source: string, name: string): number =>
  lineIndexOf(source, `- name: ${name}`);

const loadYml = (): string => readFileSync(LOAD_YML_PATH, "utf8");
const pkg = (): Record<string, Record<string, string>> =>
  JSON.parse(readFileSync(PKG_JSON_PATH, "utf8"));

describe("load-k6.yml ↔ test/load/smoke.js ↔ package.json test:load 부하 harness 배선 drift smoke (T-1620)", () => {
  describe("Happy-path: workflow 신설 · 트리거 · 설치/실행 step · 경로 parity", () => {
    it("load-k6.yml 이 실재하고 workflow_dispatch 트리거를 가진다", () => {
      expect(existsSync(LOAD_YML_PATH)).toBe(true);
      expect(triggerSection(loadYml())).toContain("workflow_dispatch:");
    });
    it("k6 설치 step 1개가 grafana/setup-k6-action 을 uses 로 싣는다(run 은 없음)", () => {
      const step = extractStep(loadYml(), INSTALL_STEP_NAME);
      expect(step.found).toBe(true);
      expect(step.uses).toContain("grafana/setup-k6-action");
      expect(step.run).toBeNull();
    });
    it("k6 실행 step 1개가 실재 파일을 겨냥하고 그 스크립트가 계획 §3 임계 2종을 선언한다", () => {
      const step = extractStep(loadYml(), RUN_STEP_NAME);
      expect(step.found).toBe(true);
      const scriptPath = scriptPathOf(step.run);
      expect(scriptPath).toBe(LOAD_SCRIPT_REL);
      // 실행 경로가 실제로 존재하는 파일이어야 한다(경로 오타 drift 검출).
      const abs = path.join(REPO_ROOT, scriptPath as string);
      expect(existsSync(abs)).toBe(true);
      const script = readFileSync(abs, "utf8");
      expect(script).toContain('http_req_duration: ["p(95)<3000"]');
      expect(script).toContain('http_req_failed: ["rate<0.01"]');
    });
    it("workflow 실행 경로와 package.json test:load 의 경로가 동일하다(parity)", () => {
      const fromPkg = scriptPathOf(pkg().scripts["test:load"]);
      expect(fromPkg).toBe(LOAD_SCRIPT_REL);
      expect(scriptPathOf(extractStep(loadYml(), RUN_STEP_NAME).run)).toBe(
        fromPkg,
      );
    });
  });

  describe("Happy-path: 부하 대상 기동 배선 (T-1621)", () => {
    it("jobs.load 에 services.postgres 가 ci.yml deploy-artifacts 와 동일 형태로 실재한다", () => {
      const src = loadYml();
      const svcIdx = lineIndexOf(src, "services:");
      const stepsIdx = lineIndexOf(src, "steps:");
      expect(svcIdx).toBeGreaterThan(-1);
      expect(svcIdx).toBeLessThan(stepsIdx);
      const services = src.split("\n").slice(svcIdx, stepsIdx).join("\n");
      // image · env 3종 · ports · health 옵션 4종 — health check 가 빠지면 앱이 DB 준비
      // 전에 붙어 부팅에 실패한다(ci.yml deploy-artifacts 와 동일 형태 요구).
      [
        "postgres:",
        "image: postgres:16-alpine",
        "POSTGRES_USER: assessment_agent",
        "POSTGRES_PASSWORD:",
        "POSTGRES_DB: assessment_agent",
        "- 5432:5432",
        '--health-cmd "pg_isready -U assessment_agent"',
        "--health-interval",
        "--health-timeout",
        "--health-retries",
      ].forEach((fragment) => expect(services).toContain(fragment));
    });

    it("기동 step 이 이미지 빌드 · 컨테이너 run · readiness polling · crash 감지를 담는다", () => {
      const build = extractStep(loadYml(), BUILD_STEP_NAME);
      expect(build.found).toBe(true);
      expect(build.run).toContain("docker build -t assessment-agent:load");
      const boot = extractStepBlock(loadYml(), BOOT_STEP_NAME) as string[];
      expect(boot).not.toBeNull();
      const bootText = boot.join("\n");
      // env 3종 주입 + readiness polling(curl) + crash 시 로그. polling 이 빠지면
      // 부팅 지연이 부하 측정치에 섞여 오염된다. DATABASE_URL 은 services 자격증명과 일치.
      [
        "docker run -d --name aa-load --network host",
        "-e DATABASE_URL=",
        "-e AUTH_JWT_SECRET=",
        "-e PORT=3000",
        "curl -fsS",
        "docker logs aa-load",
        "postgresql://assessment_agent:ci_smoke@localhost:5432/assessment_agent",
      ].forEach((fragment) => expect(bootText).toContain(fragment));
    });

    it("k6 실행 step 의 K6_BASE_URL 이 smoke.js 기본값(포트 포함)과 동일하다", () => {
      const runBlock = extractStepBlock(loadYml(), RUN_STEP_NAME) as string[];
      const injected = extractKey(runBlock, "K6_BASE_URL");
      expect(injected).toBe(EXPECTED_BASE_URL);
      const script = readFileSync(
        path.join(REPO_ROOT, LOAD_SCRIPT_REL),
        "utf8",
      );
      const fallback = script.match(
        /__ENV\.K6_BASE_URL\s*\|\|\s*"([^"]+)"/,
      ) as RegExpMatchArray;
      expect(fallback[1]).toBe(injected);
      expect(new URL(injected as string).port).toBe(new URL(fallback[1]).port);
      // run 명령 자체는 T-1620 그대로 유지(parity 불변).
      expect(extractKey(runBlock, "run")).toBe(`k6 run ${LOAD_SCRIPT_REL}`);
    });

    it("step 순서가 checkout → 빌드 → 기동 → 설치 → k6 실행 → 정리 로 단조 증가한다", () => {
      const src = loadYml();
      const order = [
        stepIndexOf(src, "저장소 checkout"),
        stepIndexOf(src, BUILD_STEP_NAME),
        stepIndexOf(src, BOOT_STEP_NAME),
        stepIndexOf(src, INSTALL_STEP_NAME),
        stepIndexOf(src, RUN_STEP_NAME),
        stepIndexOf(src, TEARDOWN_STEP_NAME),
      ];
      expect(order.every((i) => i > -1)).toBe(true);
      expect([...order].sort((a, b) => a - b)).toEqual(order);
      // AC (5)④ — 부하 대상이 뜨기 전에 k6 가 발화하면 배선이 무의미하다.
      expect(order[2]).toBeLessThan(order[4]);
    });
  });

  describe("flow / 분기 cover — 따옴표 유무 · 블록 종료 조건 · 커맨드 형태", () => {
    it("unquote / scriptPathOf 분기 — 따옴표 유무 · 한쪽만 따옴표 · 커맨드 형태 불일치", () => {
      expect(unquote('  "actions/checkout@v4"  ')).toBe("actions/checkout@v4");
      expect(unquote("'k6 run a.js'")).toBe("k6 run a.js");
      expect(unquote("  k6 run a.js  ")).toBe("k6 run a.js");
      expect(unquote('" x "')).toBe(" x ");
      expect(unquote('"unbalanced')).toBe('"unbalanced');
      expect(scriptPathOf("k6 run test/load/smoke.js")).toBe(LOAD_SCRIPT_REL);
      expect(scriptPathOf("  k6   run   a/b.js  ")).toBe("a/b.js");
      expect(scriptPathOf("pnpm k6 run a.js")).toBeNull();
      expect(scriptPathOf("k6 run a.js --vus 10")).toBeNull();
      expect(scriptPathOf(null)).toBeNull();
    });
    it("extractStepBlock: 얕은 들여쓰기 행으로 끝나는 블록 / 파일 끝에서 끝나는 블록 / 빈 행은 안 끊음", () => {
      // 빈 행은 블록을 끊지 않고, 같은 깊이의 다음 step 헤더에서 끊긴다.
      const terminated = extractStepBlock(
        "      - name: A\n\n        run: one\n      - name: B\n        run: two",
        "A",
      ) as string[];
      expect(terminated).toHaveLength(3);
      expect(extractKey(terminated, "run")).toBe("one");
      expect(extractKey(terminated, "uses")).toBeNull();
      // 실 load-k6.yml 의 마지막 step(정리)은 파일 끝에서 블록이 끝난다(EOF 분기).
      const eofBlock = extractStepBlock(
        loadYml(),
        TEARDOWN_STEP_NAME,
      ) as string[];
      expect(eofBlock[0].trim()).toBe(`- name: ${TEARDOWN_STEP_NAME}`);
      // k6 실행 step 은 다음 step 헤더에서 끊긴다(비-EOF 분기) — 정리 step 을 삼키지 않는다.
      const midBlock = extractStepBlock(loadYml(), RUN_STEP_NAME) as string[];
      expect(midBlock.join("\n")).not.toContain(TEARDOWN_STEP_NAME);
      expect(extractKey(midBlock, "run")).toBe(`k6 run ${LOAD_SCRIPT_REL}`);
    });
    it("env 블록 존재/부재 분기 — 값 추출 vs null (합성 입력 대조)", () => {
      const withEnv = extractStepBlock(
        '      - name: A\n        env:\n          K6_BASE_URL: "http://localhost:3000"\n        run: k6 run x.js',
        "A",
      ) as string[];
      expect(extractKey(withEnv, "K6_BASE_URL")).toBe(EXPECTED_BASE_URL);
      // env 블록이 없는 step(설치 step)은 같은 키에서 null — 미주입 drift 를 검출한다.
      const noEnv = extractStepBlock(loadYml(), INSTALL_STEP_NAME) as string[];
      expect(extractKey(noEnv, "K6_BASE_URL")).toBeNull();
    });
  });

  describe("Error path", () => {
    it("존재하지 않는 workflow 경로 → existsSync false · readFileSync 는 throw(silent fallback 방지)", () => {
      const bad = path.join(REPO_ROOT, ".github/workflows/load-k6.absent.yml");
      expect(existsSync(bad)).toBe(false);
      expect(() => readFileSync(bad, "utf8")).toThrow();
    });
    it("대상 step 이 없는 합성 YAML → throw 하지 않고 미발견 정규형, non-string 입력만 TypeError", () => {
      const synthetic = "      - name: Lint\n        run: pnpm lint";
      expect(extractStep(synthetic, RUN_STEP_NAME)).toEqual({
        found: false,
        uses: null,
        run: null,
      });
      expect(extractStepBlock(synthetic, INSTALL_STEP_NAME)).toBeNull();
      expect(extractStep("", RUN_STEP_NAME).found).toBe(false);
      expect(triggerSection("name: X\n")).toBe("");
      expect(() =>
        extractStepBlock(undefined as unknown as string, RUN_STEP_NAME),
      ).toThrow(TypeError);
      expect(() =>
        extractStepBlock("- name: x", 42 as unknown as string),
      ).toThrow(TypeError);
    });
    it("lineIndexOf: 대상 행 부재 → -1(미발견 정규형), non-string 입력 → TypeError", () => {
      const synthetic = "jobs:\n  load:\n    steps:\n      - name: Lint";
      expect(lineIndexOf(synthetic, "services:")).toBe(-1);
      expect(stepIndexOf(synthetic, BOOT_STEP_NAME)).toBe(-1);
      expect(lineIndexOf(synthetic, "jobs:")).toBe(0);
      expect(() => lineIndexOf(null as unknown as string, "jobs:")).toThrow(
        TypeError,
      );
      expect(() => lineIndexOf("jobs:", 7 as unknown as string)).toThrow(
        TypeError,
      );
    });
  });

  describe("negative cases 충분 cover — 상시 CI 오염 · dependency 규약 위반 차단", () => {
    it("(1) load-k6.yml 에 pull_request · push · schedule 트리거가 없다(상시 PR CI 무영향)", () => {
      const triggers = triggerSection(loadYml());
      expect(triggers).not.toContain("pull_request:");
      expect(triggers).not.toContain("push:");
      expect(triggers).not.toContain("schedule:");
    });
    it("(2) ci.yml 에 k6 실행 문자열이 없다(부하가 상시 CI 로 새지 않음 — ci.yml 은 read only)", () => {
      const ci = readFileSync(CI_YML_PATH, "utf8");
      expect(ci).not.toContain("k6 run");
      expect(ci).not.toContain("setup-k6-action");
      expect(ci).not.toContain("test:load");
    });

    it("(3) dependencies/devDependencies 어디에도 k6 키가 없다(정적 바이너리 규약)", () => {
      const p = pkg();
      expect(Object.keys(p.dependencies)).not.toContain("k6");
      expect(Object.keys(p.devDependencies)).not.toContain("k6");
      expect(p.scripts["test:load"]).toBe(`k6 run ${LOAD_SCRIPT_REL}`);
    });

    it("(4) 합성 mutation: 실행 경로가 갈라지거나 트리거가 추가되면 drift 로 검출된다", () => {
      const mutatedPath = loadYml().replace(
        `k6 run ${LOAD_SCRIPT_REL}`,
        "k6 run test/load/other.js",
      );
      const drifted = scriptPathOf(extractStep(mutatedPath, RUN_STEP_NAME).run);
      expect(drifted).not.toBe(scriptPathOf(pkg().scripts["test:load"]));
      expect(existsSync(path.join(REPO_ROOT, drifted as string))).toBe(false);
      // 원본은 mutate 되지 않는다(대조군).
      expect(scriptPathOf(extractStep(loadYml(), RUN_STEP_NAME).run)).toBe(
        LOAD_SCRIPT_REL,
      );
      const mutatedTrigger = loadYml().replace(
        "on:\n  workflow_dispatch:",
        "on:\n  workflow_dispatch:\n  pull_request:",
      );
      expect(triggerSection(mutatedTrigger)).toContain("pull_request:");
    });

    it("(5) 정리 step 이 if: always() 를 가진다(k6 실패 시 컨테이너 잔존 차단)", () => {
      const teardown = extractStepBlock(
        loadYml(),
        TEARDOWN_STEP_NAME,
      ) as string[];
      expect(teardown).not.toBeNull();
      expect(extractKey(teardown, "if")).toBe("always()");
      expect(teardown.join("\n")).toContain("docker rm -f aa-load");
    });

    it("(6) K6_BASE_URL 이 외부 host 가 아니라 로컬 인스턴스를 겨냥한다", () => {
      const injected = extractKey(
        extractStepBlock(loadYml(), RUN_STEP_NAME) as string[],
        "K6_BASE_URL",
      ) as string;
      const host = new URL(injected).hostname;
      expect(["localhost", "127.0.0.1"]).toContain(host);
      expect(injected).not.toContain("https://");
      // 합성 mutation: 외부 host 로 갈리면 같은 단언이 실패한다(대조군).
      const drifted = new URL(injected.replace(host, "example.com")).hostname;
      expect(["localhost", "127.0.0.1"]).not.toContain(drifted);
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// T-1622 — S2(조회 API 응답 지연, REQ-048) 시나리오 배선 drift.
// 존재 이유 — S2 는 workflow step · 스크립트 · package.json script 3 자가 전부 문자열 배선이라
// ① 경로 갈림 ② 임계 재산정 ③ auth-guarded route 혼입(401 이 error rate 임계 오염) ④ id 경로
// 혼입(빈 DB 404) 어느 것도 상시 CI 를 red 로 만들지 않는다. 기존 helper 재사용 + 새 helper 1 개.
//      🔥 실 GitHub Actions 발화 0 · 실 k6 실행 0 · 실 docker 실행 0 · 실 HTTP 0 · YAML 파서 0 ·
//         새 dependency 0 · DB 의존 0 · process.env 읽기/쓰기 0 — 파일 read + 합성 문자열 주입만.
const S2_RUN_STEP_NAME = "k6 S2 조회 부하 시나리오 실행";
const S2_SCRIPT_REL = "test/load/s2-read.js";
/** 타격 대상 — guard-free 목록 GET 3 종(route tag 이름 ↔ 경로). */
const S2_ROUTES: ReadonlyArray<[string, string]> = [
  ["persons", "/api/persons"],
  ["groups", "/api/groups"],
  ["parts", "/api/parts"],
];
/**
 * 타격 금지 — @UseGuards 가 붙어 토큰 없이는 401 인 조회 prefix.
 * T-1624 에서 `/api/users` 는 본 목록에서 빠졌다 — `POST /api/users` signup 은 guard 없는
 * public endpoint 라 인증 부트스트랩이 정당하게 쓴다. Admin+ 인 `GET /api/users` 목록 타격
 * 금지는 T-1624 negative (2) 가 별도로 지킨다.
 */
const GUARDED_PREFIXES = [
  "/api/assessments",
  "/api/contributions",
  "/api/summaries",
];

/** S2 스크립트 본문(신규 helper 1 개 — 그 외는 T-1620 helper 재사용). 분기 없음. */
const s2Script = (): string =>
  readFileSync(path.join(REPO_ROOT, S2_SCRIPT_REL), "utf8");

describe("load-k6.yml ↔ test/load/s2-read.js ↔ package.json test:load:s2 S2 조회 부하 배선 drift smoke (T-1622)", () => {
  describe("Happy-path: 스크립트 신설 · 임계 게이트 · workflow 배선 · parity", () => {
    it("s2-read.js 가 실재하고 guard-free 3 route 를 route tag 와 함께 타격한다", () => {
      expect(existsSync(path.join(REPO_ROOT, S2_SCRIPT_REL))).toBe(true);
      const script = s2Script();
      S2_ROUTES.forEach(([tag, route]) => {
        expect(script).toContain(route);
        expect(script).toContain(`tags: { route: "${tag}" }`);
      });
      // base URL 기본값이 smoke.js · workflow 주입값과 동일해야 배선이 일관된다.
      const fallback = script.match(
        /__ENV\.K6_BASE_URL\s*\|\|\s*"([^"]+)"/,
      ) as RegExpMatchArray;
      expect(fallback[1]).toBe(EXPECTED_BASE_URL);
    });

    it("반복 조회 프로파일(vus + duration)을 선언하고 ramping stages 는 쓰지 않는다", () => {
      const script = s2Script();
      const vus = script.match(/vus:\s*(\d+)/) as RegExpMatchArray;
      expect(Number(vus[1])).toBeGreaterThan(1);
      expect(script).toMatch(/duration:\s*"\d+s"/);
      expect(script).not.toContain("stages:");
    });

    it("전역 임계 2 종 + route tag 임계 3 종을 계획 §3 값(3000ms) 그대로 선언한다", () => {
      const script = s2Script();
      expect(script).toContain('http_req_duration: ["p(95)<3000"]');
      expect(script).toContain('http_req_failed: ["rate<0.01"]');
      S2_ROUTES.forEach(([tag]) => {
        expect(script).toContain(
          `"http_req_duration{route:${tag}}": ["p(95)<3000"]`,
        );
      });
    });

    it("workflow 의 S2 실행 step 이 실재 파일을 겨냥하고 smoke 실행 뒤 · 정리 앞에 온다", () => {
      const src = loadYml();
      const step = extractStep(src, S2_RUN_STEP_NAME);
      expect(step.found).toBe(true);
      const scriptPath = scriptPathOf(step.run);
      expect(scriptPath).toBe(S2_SCRIPT_REL);
      expect(existsSync(path.join(REPO_ROOT, scriptPath as string))).toBe(true);
      const order = [
        stepIndexOf(src, RUN_STEP_NAME),
        stepIndexOf(src, S2_RUN_STEP_NAME),
        stepIndexOf(src, TEARDOWN_STEP_NAME),
      ];
      expect(order.every((i) => i > -1)).toBe(true);
      expect([...order].sort((a, b) => a - b)).toEqual(order);
      // 기존 smoke 실행 step 의 run 은 불변(T-1620 parity 보존).
      expect(extractStep(src, RUN_STEP_NAME).run).toBe(
        `k6 run ${LOAD_SCRIPT_REL}`,
      );
    });

    it("workflow S2 경로 ↔ package.json test:load:s2 경로가 동일하고 test:load 는 불변이다", () => {
      const fromPkg = scriptPathOf(pkg().scripts["test:load:s2"]);
      expect(fromPkg).toBe(S2_SCRIPT_REL);
      expect(scriptPathOf(extractStep(loadYml(), S2_RUN_STEP_NAME).run)).toBe(
        fromPkg,
      );
      expect(pkg().scripts["test:load"]).toBe(`k6 run ${LOAD_SCRIPT_REL}`);
    });
  });

  describe("flow / 분기 cover — 따옴표 유무 · 블록 종료 조건 · env 존재/부재", () => {
    it("S2 step 은 다음 헤더에서 끊기고(비-EOF) env 주입값을 갖는다 / 따옴표 유무 무관", () => {
      const block = extractStepBlock(loadYml(), S2_RUN_STEP_NAME) as string[];
      expect(block).not.toBeNull();
      // 비-EOF 종료 분기 — 정리 step 을 삼키지 않는다.
      expect(block.join("\n")).not.toContain(TEARDOWN_STEP_NAME);
      // env 존재 분기 — 따옴표 없는 실 값과 따옴표 있는 합성 값이 같은 정규형으로 나온다.
      expect(extractKey(block, "K6_BASE_URL")).toBe(EXPECTED_BASE_URL);
      const quoted = extractStepBlock(
        `      - name: ${S2_RUN_STEP_NAME}\n        env:\n          K6_BASE_URL: "${EXPECTED_BASE_URL}"\n        run: k6 run ${S2_SCRIPT_REL}\n      - name: 다음`,
        S2_RUN_STEP_NAME,
      ) as string[];
      expect(extractKey(quoted, "K6_BASE_URL")).toBe(EXPECTED_BASE_URL);
      // EOF 종료 분기 + env 부재 분기 — 합성 입력이 파일 끝에서 끝나고 env 키가 없다.
      const eof = extractStepBlock(
        `      - name: ${S2_RUN_STEP_NAME}\n        run: k6 run ${S2_SCRIPT_REL}`,
        S2_RUN_STEP_NAME,
      ) as string[];
      expect(eof).toHaveLength(2);
      expect(extractKey(eof, "K6_BASE_URL")).toBeNull();
      expect(scriptPathOf(extractKey(eof, "run"))).toBe(S2_SCRIPT_REL);
    });
  });

  describe("Error path — 재사용 helper 계약(미발견 정규형 / TypeError) 이 S2 상수에서도 성립", () => {
    it("S2 step 이 없는 합성 YAML → throw 하지 않고 미발견 정규형(found=false)", () => {
      const synthetic = "      - name: Lint\n        run: pnpm lint";
      expect(extractStep(synthetic, S2_RUN_STEP_NAME)).toEqual({
        found: false,
        uses: null,
        run: null,
      });
      expect(extractStepBlock(synthetic, S2_RUN_STEP_NAME)).toBeNull();
      expect(stepIndexOf(synthetic, S2_RUN_STEP_NAME)).toBe(-1);
      expect(scriptPathOf(null)).toBeNull();
      expect(scriptPathOf("k6 run a.js --vus 5")).toBeNull();
    });

    it("non-string 입력 → TypeError(0-byte fallback false-PASS 방지)", () => {
      expect(() =>
        extractStepBlock(undefined as unknown as string, S2_RUN_STEP_NAME),
      ).toThrow(TypeError);
      expect(() =>
        extractStepBlock(loadYml(), null as unknown as string),
      ).toThrow(TypeError);
      expect(() =>
        lineIndexOf(42 as unknown as string, S2_RUN_STEP_NAME),
      ).toThrow(TypeError);
      // 존재하지 않는 스크립트 경로 → existsSync false · readFileSync throw.
      const bad = path.join(REPO_ROOT, "test/load/s2-read.absent.js");
      expect(existsSync(bad)).toBe(false);
      expect(() => readFileSync(bad, "utf8")).toThrow();
    });
  });

  describe("negative cases 충분 cover — 임계 오염 · 상시 CI 유출 · dependency 규약", () => {
    it("(1) s2-read.js 에 auth-guarded 조회 prefix 가 없다(401 이 error rate 임계 오염 차단)", () => {
      const script = s2Script();
      GUARDED_PREFIXES.forEach((prefix) =>
        expect(script).not.toContain(prefix),
      );
    });

    it("(2) 조회 iteration 에 id 파라미터 경로가 없다(빈 DB 404 → non-2xx 오염 차단)", () => {
      const script = s2Script();
      // T-1623 이후 teardown 이 `/api/<x>/<id>` DELETE 를 쓰므로 본 단언의 대상을 부하 측정
      // iteration(= default 함수 본문)으로 좁힌다. seed / 정리는 별도 tag 라 route tag 별
      // p95 임계 3 종을 오염시키지 않는다.
      const readBody = (
        extractTopLevelBlock(script, "export default function") as string[]
      ).join("\n");
      S2_ROUTES.forEach(([, route]) => {
        expect(readBody).not.toContain(`${route}/`);
      });
      expect(readBody).not.toContain("${id}");
      expect(readBody).not.toMatch(/\/api\/\w+\/\d/);
    });

    it("(3) load-k6.yml 에 여전히 pull_request · push · schedule 트리거가 없다", () => {
      const triggers = triggerSection(loadYml());
      ["pull_request:", "push:", "schedule:"].forEach((t) =>
        expect(triggers).not.toContain(t),
      );
    });

    it("(4) ci.yml 에 S2 실행 문자열이 없다(부하가 상시 CI 로 새지 않음 — read only)", () => {
      const ci = readFileSync(CI_YML_PATH, "utf8");
      expect(ci).not.toContain(S2_SCRIPT_REL);
      expect(ci).not.toContain("test:load:s2");
      expect(ci).not.toContain("k6 run");
    });

    it("(5) package.json 어디에도 k6 dependency 키가 없다(정적 바이너리 규약)", () => {
      const p = pkg();
      expect(Object.keys(p.dependencies)).not.toContain("k6");
      expect(Object.keys(p.devDependencies)).not.toContain("k6");
      expect(p.scripts["test:load:s2"]).toBe(`k6 run ${S2_SCRIPT_REL}`);
    });

    it("(6) 임계 문자열이 3000/0.01 이 아닌 값으로 재산정되지 않았다 + 합성 mutation 검출", () => {
      const script = s2Script();
      // 전역 + route tag 임계 5 종(T-1624 의 me 포함)이 모두 3000ms. 다른 숫자로 갈리면
      // 아래 count 가 어긋난다.
      expect(script.match(/p\(95\)<3000/g)).toHaveLength(5);
      expect(script).not.toMatch(/p\(95\)<(?!3000)\d+/);
      expect(script.match(/rate<0\.01/g)).toHaveLength(1);
      // 합성 mutation: 임계가 완화되면 같은 단언이 실패한다(대조군).
      const mutated = script.replace("p(95)<3000", "p(95)<9000");
      expect(mutated).toMatch(/p\(95\)<(?!3000)\d+/);
      // workflow 경로가 갈리면 실재 파일이 아니게 된다(대조군).
      const driftedYml = loadYml().replace(
        `k6 run ${S2_SCRIPT_REL}`,
        "k6 run test/load/s2-other.js",
      );
      const drifted = scriptPathOf(
        extractStep(driftedYml, S2_RUN_STEP_NAME).run,
      );
      expect(existsSync(path.join(REPO_ROOT, drifted as string))).toBe(false);
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// T-1623 — S2 조회 부하의 seed 배선(setup/teardown) drift.
// 존재 이유 — 부하 job 의 DB 는 run 마다 빈 상태라, seed 배선이 빠지거나 갈리면 S2 는 0 행
// 목록만 읽으면서도 p95 게이트를 통과해 "측정했다" 는 착시를 만든다. 또 seed / 정리 요청이 읽기
// route tag 를 재사용하면 쓰기 지연이 조회 임계에 섞인다. 어느 쪽도 상시 CI 를 red 로 만들지
// 않으므로 문자열 배선 parity 를 정적으로 대조한다. 새 helper 1 개 + 기존 helper 재사용.
//      🔥 실 GitHub Actions 발화 0 · 실 k6 실행 0 · 실 docker 실행 0 · 실 HTTP 0 · YAML 파서 0 ·
//         새 dependency 0 · DB 의존 0 · process.env 읽기/쓰기 0 — 파일 read + 합성 문자열 주입만.
const SEED_ENV_KEY = "K6_SEED_PERSONS";
/** seed / 정리 전용 route tag — 읽기 route tag 3 종과 겹치면 안 된다. */
const WRITE_TAGS = ["seed", "teardown"];

/**
 * s2-read.js 의 top-level 블록 하나(`header` 로 시작하는 행 ~ 열 0 의 닫는 `}` 행)를 잘라낸다.
 * 닫는 행이 없으면 파일 끝까지, 대상 부재면 `null`(추측 0).
 * @throws {TypeError} `source`/`header` 가 non-string 일 때(0-byte fallback false-PASS 방지).
 */
function extractTopLevelBlock(source: string, header: string): string[] | null {
  if (typeof source !== "string" || typeof header !== "string") {
    throw new TypeError(
      "extractTopLevelBlock: source·header 는 string 이어야 함",
    );
  }
  const lines = source.split("\n");
  const startIdx = lines.findIndex((l) => l.startsWith(header));
  if (startIdx < 0) {
    return null;
  }
  const offset = lines.slice(startIdx + 1).findIndex((l) => l === "}");
  const end = offset < 0 ? lines.length : startIdx + offset + 2;
  return lines.slice(startIdx, end);
}

/** s2-read.js 의 한 함수 본문 텍스트(재사용 축약). */
const s2Body = (header: string): string =>
  (extractTopLevelBlock(s2Script(), header) as string[]).join("\n");

describe("test/load/s2-read.js ↔ load-k6.yml S2 seed/teardown 배선 drift smoke (T-1623)", () => {
  describe("Happy-path: setup/teardown 선언 · seed POST · 정리 DELETE · env parity", () => {
    it("setup() 이 3 종 POST 를 seed tag 로 때리고 규모를 __ENV 로 읽으며 id 를 return 한다", () => {
      const script = s2Script();
      expect(script).toContain("export function setup()");
      const setup = s2Body("export function setup");
      S2_ROUTES.forEach(([, route]) => expect(setup).toContain(route));
      // 조회 대상 3 종 + T-1624 의 인증 부트스트랩 2 종(signup · login) = POST 5 회.
      expect(setup.match(/http\.post\(/g)).toHaveLength(5);
      // 반환값이 teardown 으로 전달되도록 setup 이 실제로 id 를 return 한다.
      expect(setup).toContain("return {");
      ["personIds", "groupIds", "partIds"].forEach((k) =>
        expect(setup).toContain(k),
      );
      expect(script).toContain('tags: { route: "seed" }');
      expect(script).toContain(`__ENV.${SEED_ENV_KEY}`);
    });

    it("teardown(data) 가 3 종 DELETE 로 setup 산출 id 를 모두 지운다", () => {
      const script = s2Script();
      expect(script).toMatch(/export function teardown\(\w+\)/);
      const body = s2Body("export function teardown");
      S2_ROUTES.forEach(([, route]) => expect(body).toContain(`${route}/`));
      expect(body.match(/http\.del\(/g)).toHaveLength(3);
      expect(script).toContain('tags: { route: "teardown" }');
    });

    it("workflow S2 step 의 K6_SEED_PERSONS 가 스크립트 __ENV 기본값과 parity 다", () => {
      const block = extractStepBlock(loadYml(), S2_RUN_STEP_NAME) as string[];
      const injected = extractKey(block, SEED_ENV_KEY) as string;
      expect(Number(injected)).toBeGreaterThan(0);
      const fallback = s2Script().match(
        new RegExp(`__ENV\\.${SEED_ENV_KEY}\\s*\\|\\|\\s*(\\d+)`),
      ) as RegExpMatchArray;
      expect(fallback[1]).toBe(injected);
      // 기존 배선은 불변 — run 명령 · base URL 주입값이 그대로다.
      expect(extractKey(block, "run")).toBe(`k6 run ${S2_SCRIPT_REL}`);
      expect(extractKey(block, "K6_BASE_URL")).toBe(EXPECTED_BASE_URL);
    });
  });

  describe("flow / 분기 cover — 블록 종료 조건 · env 키 1개/2개 · 따옴표 유무", () => {
    it("extractTopLevelBlock: 닫는 } 로 끝남 / 파일 끝에서 끝남 / 대상 부재", () => {
      const closed = extractTopLevelBlock(
        "export function a() {\n  x();\n}\nexport function b() {\n  y();\n}",
        "export function a",
      ) as string[];
      expect(closed).toHaveLength(3);
      expect(closed.join("\n")).not.toContain("y()");
      // 닫는 행이 없는 입력은 파일 끝까지(EOF 분기), 대상 부재면 null(미발견 정규형).
      expect(
        extractTopLevelBlock(
          "export function a() {\n  x();",
          "export function a",
        ),
      ).toHaveLength(2);
      expect(
        extractTopLevelBlock("const x = 1;", "export function a"),
      ).toBeNull();
    });

    it("S2 step env 키 2개/1개 · 값 따옴표 유무가 같은 정규형으로 추출된다", () => {
      // 실 파일 — env 키 2 개(K6_BASE_URL + K6_SEED_PERSONS), seed 값은 따옴표 있음.
      const real = extractStepBlock(loadYml(), S2_RUN_STEP_NAME) as string[];
      expect(extractKey(real, SEED_ENV_KEY)).toBe("30");
      expect(extractKey(real, "K6_BASE_URL")).toBe(EXPECTED_BASE_URL);
      // 합성 — env 키 1 개 · 따옴표 없음 · 다음 헤더에서 종료(비-EOF 분기).
      const oneKey = extractStepBlock(
        `      - name: ${S2_RUN_STEP_NAME}\n        env:\n          ${SEED_ENV_KEY}: 30\n        run: k6 run x.js\n      - name: 다음`,
        S2_RUN_STEP_NAME,
      ) as string[];
      expect(extractKey(oneKey, SEED_ENV_KEY)).toBe("30");
      expect(extractKey(oneKey, "K6_BASE_URL")).toBeNull();
    });
  });

  describe("Error path — 대상 부재 / non-string 계약", () => {
    it("seed 키·step 이 없는 합성 YAML → throw 하지 않고 미발견 정규형", () => {
      const synthetic = "      - name: Lint\n        run: pnpm lint";
      expect(extractStepBlock(synthetic, S2_RUN_STEP_NAME)).toBeNull();
      expect(extractStep(synthetic, S2_RUN_STEP_NAME).found).toBe(false);
      // step 은 있으나 seed 키만 없는 경우도 null(부분 drift 검출).
      const noSeedKey = extractStepBlock(
        `      - name: ${S2_RUN_STEP_NAME}\n        run: k6 run ${S2_SCRIPT_REL}`,
        S2_RUN_STEP_NAME,
      ) as string[];
      expect(extractKey(noSeedKey, SEED_ENV_KEY)).toBeNull();
    });

    it("non-string 입력 → TypeError(0-byte fallback false-PASS 방지)", () => {
      expect(() =>
        extractTopLevelBlock(undefined as unknown as string, "export function"),
      ).toThrow(TypeError);
      expect(() =>
        extractTopLevelBlock(s2Script(), 42 as unknown as string),
      ).toThrow(TypeError);
      expect(() =>
        extractStepBlock(null as unknown as string, S2_RUN_STEP_NAME),
      ).toThrow(TypeError);
    });
  });

  describe("negative cases 충분 cover — 지표 오염 · 임계 재산정 · 상시 CI 유출", () => {
    it("(1) seed 배선 후에도 guarded prefix 0 · 조건 분기 0 규약이 유지된다", () => {
      const script = s2Script();
      GUARDED_PREFIXES.forEach((prefix) =>
        expect(script).not.toContain(prefix),
      );
      ["if (", "} else", " ? ", " && "].forEach((token) =>
        expect(script).not.toContain(token),
      );
      // 카운트 기반 for 반복문은 허용 — seed 1 + 정리 3 블록에서 쓰인다.
      expect(script.match(/for \(let i = 0;/g)).toHaveLength(4);
    });

    it("(2) seed / teardown tag 가 읽기 route tag 3 종과 겹치지 않는다", () => {
      const readTags = S2_ROUTES.map(([tag]) => tag);
      WRITE_TAGS.forEach((tag) => expect(readTags).not.toContain(tag));
      const script = s2Script();
      // 읽기 tag 는 options 임계 1 회 + http.get 1 회로 정확히 2 회만 등장한다 — seed /
      // 정리가 읽기 tag 를 재사용하면 이 수가 늘어 drift 로 검출된다.
      readTags.forEach((tag) =>
        expect(
          script.match(new RegExp(`route:${tag}|route: "${tag}"`, "g")),
        ).toHaveLength(2),
      );
      WRITE_TAGS.forEach((tag) => expect(script).toContain(`route: "${tag}"`));
    });

    it("(3) 임계 6 종의 값·개수와 vus / duration 이 불변이다(재산정 금지)", () => {
      const script = s2Script();
      expect(script.match(/p\(95\)<3000/g)).toHaveLength(5);
      expect(script).not.toMatch(/p\(95\)<(?!3000)\d+/);
      expect(script.match(/rate<0\.01/g)).toHaveLength(1);
      expect(script).toContain("vus: 5");
      expect(script).toContain('duration: "20s"');
      expect(script).not.toContain("stages:");
    });

    it("(4) 트리거 3 종 부재 · k6 dependency 부재 규약이 그대로다", () => {
      const triggers = triggerSection(loadYml());
      ["pull_request:", "push:", "schedule:"].forEach((t) =>
        expect(triggers).not.toContain(t),
      );
      const p = pkg();
      expect(Object.keys(p.dependencies)).not.toContain("k6");
      expect(Object.keys(p.devDependencies)).not.toContain("k6");
      expect(p.scripts["test:load:s2"]).toBe(`k6 run ${S2_SCRIPT_REL}`);
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// T-1624 — S2 조회 부하의 인증 조회 확장(signup → login → GET /api/auth/me) drift.
// 존재 이유 — 인증 조회는 guard-free 목록에 없는 구간(JwtAuthGuard + cookie 추출 + findById
// DB round-trip) 을 지나는데, ① 인증 배선이 갈려 401 만 재게 되거나 ② 토큰이 하드코딩되거나
// ③ Admin+ 인 GET /api/users 목록으로 번지거나 ④ 임계가 재산정되어도 상시 CI 는 green 이다.
// 문자열 배선 parity 를 정적으로 대조해 그 침묵을 깬다. 새 helper 1 개 + 기존 helper 재사용.
//      🔥 실 GitHub Actions 발화 0 · 실 k6 실행 0 · 실 docker 실행 0 · 실 HTTP 0 · YAML 파서 0 ·
//         새 dependency 0 · DB 의존 0 · process.env 읽기/쓰기 0 — 파일 read + 합성 문자열 주입만.
const AUTH_ROUTE = "/api/auth/me";
const AUTH_TAG = "me";
const SIGNUP_ROUTE = "/api/users";
const LOGIN_ROUTE = "/api/auth/login";
const COOKIE_NAME = "access_token";
/** 임계 정본 — 전역 2 + route tag 4(T-1624 의 me 포함) = 6 종. */
const EXPECTED_THRESHOLD_KEYS = [
  "http_req_duration",
  "http_req_failed",
  "http_req_duration{route:persons}",
  "http_req_duration{route:groups}",
  "http_req_duration{route:parts}",
  `http_req_duration{route:${AUTH_TAG}}`,
];

/**
 * `options.thresholds` 블록의 항목 키 목록(감싼 따옴표 제거 · 선언 순서 보존). 블록은 `},`
 * 행에서 끝나고 없으면 파일 끝까지, 대상 부재면 `[]`(추측 0).
 * @throws {TypeError} `script` 가 non-string 일 때(0-byte fallback false-PASS 방지).
 */
function thresholdKeys(script: string): string[] {
  if (typeof script !== "string") {
    throw new TypeError("thresholdKeys: script 는 string 이어야 함");
  }
  const lines = script.split("\n");
  const start = lines.findIndex((l) => l.trim() === "thresholds: {");
  if (start < 0) {
    return [];
  }
  const rest = lines.slice(start + 1);
  const end = rest.findIndex((l) => l.trim() === "},");
  return rest
    .slice(0, end < 0 ? rest.length : end)
    .map((l) => l.trim().match(/^(.*):\s*\[/))
    .filter((m): m is RegExpMatchArray => m !== null)
    .map((m) => unquote(m[1]));
}

describe("test/load/s2-read.js 인증 조회 확장(signup → login → me) 배선 drift smoke (T-1624)", () => {
  describe("Happy-path: 인증 부트스트랩 · cookie 배선 · me 타격 · 임계 6 종", () => {
    it("setup() 이 signup · login 을 seed tag 로 때리고 access_token 을 authCookie 로 return 한다", () => {
      const setup = s2Body("export function setup");
      expect(setup).toContain(SIGNUP_ROUTE);
      expect(setup).toContain(LOGIN_ROUTE);
      // 두 요청 모두 seed tag 재사용 — 조회 route tag 4 종의 p95 오염 0.
      expect(setup.match(/SEED_PARAMS/g)).toHaveLength(5);
      // 토큰은 Set-Cookie 로만 오므로 응답 cookie 에서 값을 꺼내 문자열로 담는다.
      expect(setup).toContain(`cookies["${COOKIE_NAME}"][0].value`);
      expect(setup).toMatch(
        new RegExp(`authCookie:\\s*\`${COOKIE_NAME}=\\$\\{`),
      );
      // 자격증명은 run 마다 stamp 로 생성(고정 리터럴 0) — password 는 8 자 이상.
      expect(setup).toMatch(/email: `[^`]*\$\{stamp\}[^`]*@/);
      expect(setup).toMatch(/password: `[^`]*\$\{stamp\}`/);
    });

    it("default(data) 가 Cookie header + route:me tag 로 인증 route 를 타격한다(기존 3 종 불변)", () => {
      const script = s2Script();
      expect(script).toMatch(/export default function \(\w+\)/);
      const body = s2Body("export default function");
      expect(body).toContain(AUTH_ROUTE);
      expect(body).toContain("headers: { Cookie: data.authCookie }");
      expect(body).toContain(`tags: { route: "${AUTH_TAG}" }`);
      // 기존 guard-free 3 종의 URL · tag · 호출 순서 불변 — me 는 그 뒤에 온다.
      const order = S2_ROUTES.map(([, route]) => body.indexOf(route));
      expect(order.every((i) => i > -1)).toBe(true);
      expect([...order].sort((a, b) => a - b)).toEqual(order);
      expect(body.indexOf(AUTH_ROUTE)).toBeGreaterThan(Math.max(...order));
      expect(body.match(/http\.get\(/g)).toHaveLength(4);
    });

    it("options.thresholds 가 전역 2 + route 4 = 6 종이고 me 항목이 3000ms 다", () => {
      const script = s2Script();
      expect(thresholdKeys(script)).toEqual(EXPECTED_THRESHOLD_KEYS);
      expect(script).toContain(
        `"http_req_duration{route:${AUTH_TAG}}": ["p(95)<3000"]`,
      );
    });
  });

  describe("flow / 분기 cover — 따옴표 유무 · 블록 종료 조건 · 토큰 1 회/다회 등장", () => {
    it("thresholdKeys: 따옴표 유무 · 닫는 행 종료 / EOF 종료 · 대상 다회 등장 시 첫 블록", () => {
      // 따옴표 있는 키 / 없는 키가 같은 정규형으로 나온다 + 닫는 행에서 블록이 끝난다.
      const mixed =
        '  thresholds: {\n    http_req_failed: ["rate<0.01"],\n    "a{route:me}": ["p(95)<3000"],\n  },\n  vus: 5,\n  after: ["x"],';
      expect(thresholdKeys(mixed)).toEqual(["http_req_failed", "a{route:me}"]);
      // 닫는 행이 없으면 파일 끝까지(EOF 분기).
      expect(
        thresholdKeys('  thresholds: {\n    only: ["p(95)<3000"],'),
      ).toEqual(["only"]);
      // 대상 토큰이 다회 등장하면 첫 블록만(둘째 블록 키는 섞이지 않음).
      expect(thresholdKeys(`${mixed}\n${mixed}`)).toEqual([
        "http_req_failed",
        "a{route:me}",
      ]);
    });

    it("s2Body: 인증 확장 후에도 setup / default 블록이 서로 섞이지 않는다", () => {
      const setup = s2Body("export function setup");
      const read = s2Body("export default function");
      expect(setup).not.toContain(AUTH_ROUTE);
      expect(read).not.toContain(LOGIN_ROUTE);
      expect(read).not.toContain(SIGNUP_ROUTE);
    });
  });

  describe("Error path — 대상 부재 / non-string 계약", () => {
    it("thresholds 블록이 없는 합성 입력 → throw 하지 않고 빈 배열(미발견 정규형)", () => {
      expect(thresholdKeys("export const options = {\n  vus: 5,\n};")).toEqual(
        [],
      );
      expect(
        extractTopLevelBlock("const x = 1;", "export default function"),
      ).toBeNull();
    });

    it("non-string 입력 → TypeError(0-byte fallback false-PASS 방지)", () => {
      expect(() => thresholdKeys(undefined as unknown as string)).toThrow(
        TypeError,
      );
      expect(() => thresholdKeys(42 as unknown as string)).toThrow(TypeError);
    });
  });

  describe("negative cases 충분 cover — 권한 의존 · 토큰 하드코딩 · 임계 재산정 차단", () => {
    it("(1) 인증 확장은 me 1 종뿐 — guarded 조회 3 prefix 는 여전히 0 이다", () => {
      const script = s2Script();
      GUARDED_PREFIXES.forEach((prefix) =>
        expect(script).not.toContain(prefix),
      );
    });

    it("(2) Admin+ 인 GET /api/users 목록 타격이 없다(첫-user SuperAdmin 의존 회피)", () => {
      const script = s2Script();
      // signup POST 1 회만 등장 — 목록 GET 이 섞이면 이 수가 늘어 drift 로 검출된다.
      expect(script.match(/\/api\/users/g)).toHaveLength(1);
      expect(script).not.toMatch(/http\.get\([^)]*\/api\/users/);
      expect(s2Body("export default function")).not.toContain(SIGNUP_ROUTE);
    });

    it("(3) 하드코딩 JWT 리터럴 · Bearer 문자열이 없다(토큰은 run 시점 login 으로만 획득)", () => {
      const script = s2Script();
      expect(script).not.toContain("eyJ");
      expect(script).not.toContain("Bearer ");
      expect(script).not.toContain("Authorization");
    });

    it("(4) 임계가 정확히 6 종이고 기존 5 종 문자열 · vus / duration 이 불변이다", () => {
      const script = s2Script();
      expect(thresholdKeys(script)).toHaveLength(6);
      expect(script.match(/p\(95\)<3000/g)).toHaveLength(5);
      expect(script).not.toMatch(/p\(95\)<(?!3000)\d+/);
      expect(script.match(/rate<0\.01/g)).toHaveLength(1);
      expect(script).toContain("vus: 5");
      expect(script).toContain('duration: "20s"');
      // 합성 mutation: me 임계만 완화돼도 검출된다(대조군).
      expect(
        script.replace(
          `"http_req_duration{route:${AUTH_TAG}}": ["p(95)<3000"]`,
          `"http_req_duration{route:${AUTH_TAG}}": ["p(95)<9000"]`,
        ),
      ).toMatch(/p\(95\)<(?!3000)\d+/);
    });

    it("(5) load-k6.yml 이 무변경이다(트리거 3 종 부재 · run · env 주입값 그대로)", () => {
      const triggers = triggerSection(loadYml());
      ["pull_request:", "push:", "schedule:"].forEach((t) =>
        expect(triggers).not.toContain(t),
      );
      const block = extractStepBlock(loadYml(), S2_RUN_STEP_NAME) as string[];
      expect(extractKey(block, "run")).toBe(`k6 run ${S2_SCRIPT_REL}`);
      expect(extractKey(block, "K6_BASE_URL")).toBe(EXPECTED_BASE_URL);
      expect(extractKey(block, SEED_ENV_KEY)).toBe("30");
      // 새 __ENV 키 없이 스크립트 안에서 자격증명을 만든다(파일 cap 보호).
      expect(s2Script().match(/__ENV\./g)).toHaveLength(2);
    });

    it("(6) package.json 에 k6 dependency 키가 없고 조건 분기 0 규약이 유지된다", () => {
      const p = pkg();
      expect(Object.keys(p.dependencies)).not.toContain("k6");
      expect(Object.keys(p.devDependencies)).not.toContain("k6");
      const script = s2Script();
      ["if (", "} else", " ? ", " && "].forEach((token) =>
        expect(script).not.toContain(token),
      );
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// T-1625 — S3 동시 요청 내성(read + write 혼합 · 동시성 단계 상승) 배선 drift.
// 존재 이유 — ① ramping stages 가 고정 vus 로 되돌아가거나 ② write 가 자기 정리를 잃어 DB 를
// 무한 성장시키거나 ③ read / write 가 같은 route tag 를 공유해 지표가 섞이거나 ④ 임계가
// 재산정되어도 상시 CI 는 green 이다(부하 job 은 수동 발화 전용). 새 helper 2 개 + 기존 재사용.
//      🔥 실 GitHub Actions 발화 0 · 실 k6 실행 0 · 실 HTTP 0 · YAML 파서 0 · 새 dependency 0 ·
//         DB 의존 0 · process.env 읽기/쓰기 0 — 파일 read + 합성 문자열 주입만.
const S3_RUN_STEP_NAME = "k6 S3 동시 요청 내성 시나리오 실행";
const S3_SCRIPT_REL = "test/load/s3-concurrent.js";
/** S3 임계 정본 — 전역 2 + route tag 2(read / write) = 4 종, 선언 순서 그대로. */
const S3_THRESHOLD_KEYS = [
  "http_req_duration",
  "http_req_failed",
  "http_req_duration{route:read}",
  "http_req_duration{route:write}",
];
const S3_MAX_SEC = 40; // 수동 job 비용 상한 — stages 총 지속시간(초).
const s3Script = (): string =>
  readFileSync(path.join(REPO_ROOT, S3_SCRIPT_REL), "utf8");
const s3Body = (header: string): string =>
  (extractTopLevelBlock(s3Script(), header) as string[]).join("\n");

/**
 * `stages: [` 블록의 `target:` 값 목록(선언 순서 보존). 블록은 `],` 행에서 끝나고 없으면 파일
 * 끝까지, 대상 부재면 `[]`(추측 0). non-string 이면 `TypeError`(0-byte false-PASS 방지).
 */
function stageTargets(script: string): number[] {
  if (typeof script !== "string") {
    throw new TypeError("stageTargets: script 는 string 이어야 함");
  }
  const lines = script.split("\n");
  const start = lines.findIndex((l) => l.trim() === "stages: [");
  if (start < 0) {
    return [];
  }
  const rest = lines.slice(start + 1);
  const end = rest.findIndex((l) => l.trim() === "],");
  return rest
    .slice(0, end < 0 ? rest.length : end)
    .map((l) => l.match(/target:\s*(\d+)/))
    .filter((m): m is RegExpMatchArray => m !== null)
    .map((m) => Number(m[1]));
}

/** `duration: "<n>s"` 선언의 초 값 목록 — 총합으로 수동 job 비용 상한을 대조한다. */
const stageSeconds = (script: string): number[] =>
  (script.match(/duration: "\d+s"/g) || []).map((d) =>
    Number(d.replace(/\D/g, "")),
  );

describe("load-k6.yml ↔ test/load/s3-concurrent.js ↔ package.json test:load:s3 S3 동시 요청 내성 배선 drift smoke (T-1625)", () => {
  describe("Happy-path: 혼합 iteration · ramping stages · 임계 · workflow 배선 · parity", () => {
    it("s3-concurrent.js 가 실재하고 read + write 를 별도 route tag 로 타격하며 자기 정리한다", () => {
      expect(existsSync(path.join(REPO_ROOT, S3_SCRIPT_REL))).toBe(true);
      const script = s3Script();
      const body = s3Body("export default function");
      // 생성 id 를 같은 iteration 이 DELETE 로 회수하고, 식별자는 stamp 접미사로 충돌을 피한다.
      [
        "http.post(",
        "http.get(",
        "http.del(",
        'created.json("id")',
        "/api/persons/",
        "Date.now()",
        "__VU",
        "__ITER",
      ].forEach((t) => expect(body).toContain(t));
      expect(script).toContain('tags: { route: "read" }');
      expect(script).toContain('tags: { route: "write" }');
    });

    it("동시성 단계 상승(stages)을 선언하고 고정 vus 는 없으며 총 지속시간이 40s 이내다", () => {
      const script = s3Script();
      const targets = stageTargets(script);
      expect(targets.length).toBeGreaterThanOrEqual(3);
      // 마지막 ramp-down(0) 을 뺀 앞 단계가 중복 없이 단조 증가 — "단계 상승" 의 실체.
      const rampUp = targets.slice(0, -1);
      expect(rampUp).toEqual([...rampUp].sort((a, b) => a - b));
      expect(targets[targets.length - 1]).toBe(0);
      expect(script).not.toMatch(/^\s*vus:/m);
      const total = stageSeconds(script).reduce((a, b) => a + b, 0);
      expect(total).toBeLessThanOrEqual(S3_MAX_SEC);
    });

    it("임계 4 종을 계획 §3 값(p95 3000ms · rate<0.01) 그대로 선언하고 cliff 는 관찰만 한다", () => {
      const script = s3Script();
      expect(thresholdKeys(script)).toEqual(S3_THRESHOLD_KEYS);
      expect(script.match(/p\(95\)<3000/g)).toHaveLength(3);
      expect(script.match(/rate<0\.01/g)).toHaveLength(1);
      expect(script).toContain("latency cliff");
    });

    it("workflow S3 step 이 S2 뒤 · 정리 앞에 있고 경로가 test:load:s3 와 parity 다", () => {
      const yml = loadYml();
      const step = extractStep(yml, S3_RUN_STEP_NAME);
      expect(step.found).toBe(true);
      expect(step.uses).toBeNull();
      const rel = scriptPathOf(step.run) as string;
      expect(rel).toBe(S3_SCRIPT_REL);
      expect(existsSync(path.join(REPO_ROOT, rel))).toBe(true);
      const s2Idx = stepIndexOf(yml, S2_RUN_STEP_NAME);
      const s3Idx = stepIndexOf(yml, S3_RUN_STEP_NAME);
      expect(s2Idx).toBeGreaterThan(0);
      expect(s3Idx).toBeGreaterThan(s2Idx);
      expect(stepIndexOf(yml, TEARDOWN_STEP_NAME)).toBeGreaterThan(s3Idx);
      // 실행 경로 parity + 기존 script 2 종 불변.
      const p = pkg();
      expect(rel).toBe(scriptPathOf(p.scripts["test:load:s3"]));
      expect(p.scripts["test:load"]).toBe(`k6 run ${LOAD_SCRIPT_REL}`);
      expect(p.scripts["test:load:s2"]).toBe(`k6 run ${S2_SCRIPT_REL}`);
    });
  });

  describe("flow / 분기 cover — 블록 종료 조건 · 따옴표 유무 · stages 항목 1 개/다수", () => {
    it("extractStepBlock: S3 step 이 다음 헤더에서 끊김 / 파일 끝에서 끊김 · 따옴표 무관", () => {
      const block = extractStepBlock(loadYml(), S3_RUN_STEP_NAME) as string[];
      expect(block.join("\n")).not.toContain(TEARDOWN_STEP_NAME);
      // 파일 끝에서 끊기는 분기 — S3 step 을 마지막에 둔 합성 YAML(값은 따옴표로 감쌈).
      const synthetic = `jobs:\n  load:\n    steps:\n      - name: ${S3_RUN_STEP_NAME}\n        env:\n          K6_BASE_URL: "${EXPECTED_BASE_URL}"\n        run: k6 run ${S3_SCRIPT_REL}`;
      const tail = extractStepBlock(synthetic, S3_RUN_STEP_NAME) as string[];
      expect(tail).toHaveLength(4);
      expect(extractKey(tail, "K6_BASE_URL")).toBe(EXPECTED_BASE_URL);
      expect(extractKey(block, "K6_BASE_URL")).toBe(EXPECTED_BASE_URL);
      // S3 는 seed 주입이 없다(write 자기 정리) — 부재 키는 null.
      expect(extractKey(block, SEED_ENV_KEY)).toBeNull();
    });

    it("stageTargets / stageSeconds: 항목 1 개 · 다수 · EOF 종료 · 블록 밖 값 · 대상 부재", () => {
      const one = 'stages: [\n  { duration: "5s", target: 7 },\n],';
      expect(stageTargets(one)).toEqual([7]);
      expect(stageTargets(`${one.slice(0, -2)}  { target: 9 },\n],`)).toEqual([
        7, 9,
      ]);
      // 닫는 `],` 가 없으면 파일 끝까지 (미종료 블록도 throw 0). 블록 밖 값·부재는 [].
      expect(stageTargets(one.slice(0, -2))).toEqual([7]);
      expect(stageTargets("target: 99\nvus: 5")).toEqual([]);
      expect(stageSeconds(one)).toEqual([5]);
      expect(stageSeconds("stages: []")).toEqual([]);
    });
  });

  describe("Error path — 대상 부재 / non-string 계약", () => {
    it("S3 step 이 없는 합성 YAML → throw 하지 않고 미발견 정규형(found=false)", () => {
      const withoutS3 = loadYml()
        .split("\n")
        .filter((l) => l.trim() !== `- name: ${S3_RUN_STEP_NAME}`)
        .join("\n");
      expect(extractStep(withoutS3, S3_RUN_STEP_NAME)).toEqual({
        found: false,
        uses: null,
        run: null,
      });
      expect(stepIndexOf(withoutS3, S3_RUN_STEP_NAME)).toBe(-1);
      // 커맨드 형태가 다르면 경로도 추측하지 않는다.
      expect(scriptPathOf("k6 run")).toBeNull();
    });

    it("non-string 입력 → TypeError(0-byte fallback false-PASS 방지)", () => {
      [null, undefined, 42, {}, []].forEach((v) => {
        expect(() => stageTargets(v as unknown as string)).toThrow(TypeError);
        expect(() => thresholdKeys(v as unknown as string)).toThrow(TypeError);
        expect(() =>
          extractStepBlock(v as unknown as string, S3_RUN_STEP_NAME),
        ).toThrow(TypeError);
      });
      // 0-byte 문자열은 정상 입력 — throw 없이 미발견 정규형.
      expect(stageTargets("")).toEqual([]);
      expect(extractStepBlock("", S3_RUN_STEP_NAME)).toBeNull();
    });
  });

  describe("negative cases 충분 cover — 상시 CI 유출 · 임계 오염 · dependency 규약", () => {
    it("(1) load-k6.yml 에 여전히 pull_request · push · schedule 트리거가 없다", () => {
      const triggers = triggerSection(loadYml());
      ["pull_request:", "push:", "schedule:"].forEach((t) =>
        expect(triggers).not.toContain(t),
      );
    });

    it("(2) ci.yml 에 S3 실행 문자열이 없다(부하가 상시 CI 로 새지 않음 — read only)", () => {
      const ci = readFileSync(CI_YML_PATH, "utf8");
      [S3_SCRIPT_REL, "test:load:s3", S3_RUN_STEP_NAME].forEach((token) =>
        expect(ci).not.toContain(token),
      );
    });

    it("(3) package.json 어디에도 k6 dependency 키가 없다(정적 바이너리 규약)", () => {
      const p = pkg();
      const deps = Object.keys({ ...p.dependencies, ...p.devDependencies });
      ["k6", "@types/k6"].forEach((n) => expect(deps).not.toContain(n));
    });

    it("(4) S3 스크립트에 auth-guarded prefix 가 없고 조건 분기 0 규약이 유지된다", () => {
      const script = s3Script(); // 401 오염 차단 — guarded 경로 타격 0 + 분기 토큰 0.
      const banned = ["/api/users", "Authorization", "if (", "} else", " ? "];
      [...GUARDED_PREFIXES, ...banned, " && "].forEach((t) =>
        expect(script).not.toContain(t),
      );
    });

    it("(5) 정리 step 의 if: always() 와 기동 배선이 S3 추가 후에도 불변이다", () => {
      const yml = loadYml();
      const block = extractStepBlock(yml, TEARDOWN_STEP_NAME) as string[];
      expect(extractKey(block, "if")).toBe("always()");
      expect(block.join("\n")).toContain("docker rm -f aa-load");
      expect(stepIndexOf(yml, BOOT_STEP_NAME)).toBeGreaterThan(
        stepIndexOf(yml, BUILD_STEP_NAME),
      );
    });

    it("(6) 임계가 3000 / 0.01 이외 값으로 재산정되지 않았고 합성 mutation 이 검출된다", () => {
      const script = s3Script();
      expect(script).not.toMatch(/p\(95\)<(?!3000)\d+/);
      expect(script).not.toMatch(/rate<(?!0\.01)[\d.]+/);
      // 합성 mutation 대조군 ① 임계 완화 ② route 임계 삭제 ③ 실행 경로 갈림.
      const relaxed = script.replace(
        'write}": ["p(95)<3000',
        'write}": ["p(95)<90',
      );
      expect(relaxed).toMatch(/p\(95\)<(?!3000)\d+/);
      const dropped = script.replace('"http_req_duration{route:read}"', "//");
      expect(thresholdKeys(dropped)).not.toContain(S3_THRESHOLD_KEYS[2]);
      const drifted = scriptPathOf(
        extractStep(
          loadYml().replace(S3_SCRIPT_REL, "test/load/s3-other.js"),
          S3_RUN_STEP_NAME,
        ).run,
      ) as string;
      expect(existsSync(path.join(REPO_ROOT, drifted))).toBe(false);
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// T-1631 — S1 평가 배치 부하(ADR-0057 D2 진입점 · D3 tag 3 종 · D4 외삽 임계) 골격 drift.
// 존재 이유 — ① 대상 route 가 부하 전용 신규 route 로 갈리거나 ② tag 가 합쳐져 준비·인증 왕복이
// 판정 지표를 오염시키거나 ③ 외삽 임계가 리터럴로 굳어 표본 수와 drift 하거나 ④ 자격증명이 고정
// 리터럴로 박히거나 ⑤ 조건 분기가 스며들어도 상시 CI 는 green 이다(부하 job 은 수동 발화 전용).
//      🔥 실 k6 실행 0 · 실 HTTP 0 · 새 dependency 0 · DB 의존 0 — 파일 read + 합성 문자열만.
const S1_SCRIPT_REL = "test/load/s1-batch.js";
/** ADR-0057 D2 가 확정한 유일한 타격 route(신규 route 노출 0). */
const S1_BATCH_ROUTE = "/api/assessment-evaluation/unevaluated-fill-run";
/** S1 임계 정본 — batch p95(외삽 산식) + 전역 error rate = 2 종, 선언 순서 그대로. */
const S1_THRESHOLD_KEYS = ["http_req_duration{route:batch}", "http_req_failed"];
/** 때려도 되는 route 전량 — seed / auth / batch 의 합집합(그 밖은 임의 route 혼입). */
const S1_ROUTES = ["/api/persons", "/api/users", "/api/auth/login"];
const s1Script = (): string =>
  readFileSync(path.join(REPO_ROOT, S1_SCRIPT_REL), "utf8");
const s1Body = (header: string): string =>
  (extractTopLevelBlock(s1Script(), header) as string[]).join("\n");

/** 주석 행을 뺀 코드의 타격 `/api/...` 경로(중복 제거). 분기 없음 — 필터 + 매칭만. */
const apiRoutesOf = (script: string): string[] =>
  Array.from(
    new Set(
      script
        .split("\n")
        .filter((l) => !l.trim().startsWith("//"))
        .join("\n")
        .match(/\/api\/[a-zA-Z0-9-]+(?:\/[a-zA-Z0-9-]+)*/g) || [],
    ),
  );

/**
 * 한 route tag 의 `p(95)<...` 임계 표현식(산식이면 산식 문자열 그대로). 대상 임계 행이 없거나
 * p95 형태가 아니면 `null`(추측 0) — 이 두 갈래가 "대상 블록 있음 / 없음" 분기의 실체다.
 * @throws {TypeError} 입력이 non-string 일 때.
 */
function routeP95Expression(script: string, tag: string): string | null {
  if (typeof script !== "string" || typeof tag !== "string") {
    throw new TypeError("routeP95Expression: script·tag 는 string 이어야 함");
  }
  const line = script
    .split("\n")
    .find((l) => l.trim().startsWith(`"http_req_duration{route:${tag}}"`));
  if (line === undefined) return null;
  const m = line.match(/p\(95\)<([^`"']+)/);
  return m ? m[1] : null;
}

describe("test/load/s1-batch.js S1 평가 배치 부하 골격 drift smoke (T-1631)", () => {
  describe("Happy-path: 실재 · 대상 route · tag 3 종 · 임계 key · setup/teardown", () => {
    it("s1-batch.js 가 실재하고 setup / default / teardown export 와 __ENV 기본값 2 종을 갖는다", () => {
      expect(existsSync(path.join(REPO_ROOT, S1_SCRIPT_REL))).toBe(true);
      const script = s1Script();
      expect(script).toMatch(
        /export function setup\(\)[\s\S]*export default function \(data\)[\s\S]*export function teardown\(data\)/,
      );
      // 표본 인원 기본 10 + base URL 은 smoke.js·S2·S3 와 동일(workflow 주입값 parity).
      expect(script).toContain("__ENV.K6_S1_PERSONS || 10");
      expect(script).toContain(`__ENV.K6_BASE_URL || "${EXPECTED_BASE_URL}"`);
    });

    it("타격 route 는 D2 의 batch route 하나이고 default 가 좌표 4 축 + cookie 로 1 회 때린다", () => {
      const body = s1Body("export default function");
      expect(body).toContain(S1_BATCH_ROUTE);
      expect(body.match(/http\.post\(/g)).toHaveLength(1);
      // 좌표 4 축은 PeriodBridgeDto 의 필수 필드 — 선언 순서까지 그대로.
      expect(body).toMatch(
        /rawBridges[\s\S]*personId:[\s\S]*period:[\s\S]*scope:[\s\S]*periodStart:/,
      );
      expect(body).toContain("Cookie: data.authCookie");
      expect(body).toContain('tags: { route: "batch" }');
    });

    it("route tag 3 종(batch / seed / auth)이 전부 선언된다", () => {
      const script = s1Script();
      ["batch", "seed", "auth"].forEach((tag) =>
        expect(script).toContain(`route: "${tag}"`),
      );
    });

    it("임계 key 2 종이 목록·순서까지 일치하고 상한이 외삽 산식으로 계산된다", () => {
      const script = s1Script();
      expect(thresholdKeys(script)).toEqual(S1_THRESHOLD_KEYS);
      expect(routeP95Expression(script, "batch")).toBe("${BATCH_P95_MS}");
      expect(script).toMatch(
        /EXTRAPOLATION_PERSONS = 133;[\s\S]*FULL_RUN_BUDGET_MS = 3600000;/,
      );
      expect(script).toContain(
        "FULL_RUN_BUDGET_MS * (SAMPLE_PERSONS / EXTRAPOLATION_PERSONS)",
      );
      expect(script).toContain("rate<0.01");
    });

    it("setup 이 seed / auth tag 로 준비하고 teardown 이 seed person 을 전량 회수한다", () => {
      const setup = s1Body("export function setup");
      // 표본 person seed(반복문) + signup + login = POST 3 회.
      expect(setup.match(/http\.post\(/g)).toHaveLength(3);
      expect(setup).toMatch(/SEED_PARAMS[\s\S]*AUTH_PARAMS[\s\S]*authCookie:/);
      const down = s1Body("export function teardown");
      expect(down).toMatch(/personIds\.length[\s\S]*http\.del\(/);
      expect(down).toContain("SEED_DELETE_PARAMS");
    });
  });

  describe("flow / 분기 cover · Error path — 대상 있음 / 없음 · non-string 계약", () => {
    it("routeP95Expression: 대상 행 있음 / 없음 / p95 형태 아님 3 갈래", () => {
      const script = s1Script();
      expect(routeP95Expression(script, "batch")).toBe("${BATCH_P95_MS}");
      expect(routeP95Expression(script, "seed")).toBeNull();
      const dropped = script.replace('"http_req_duration{route:batch}"', "//");
      expect(routeP95Expression(dropped, "batch")).toBeNull();
      const literal = '  "http_req_duration{route:batch}": ["p(95)<270676"],';
      expect(routeP95Expression(literal, "batch")).toBe("270676");
      expect(
        routeP95Expression(literal.replace("p(95)<", "avg<"), "batch"),
      ).toBeNull();
    });

    it("부재 경로 read 는 throw · 부재 블록은 null · non-string 은 TypeError", () => {
      const bad = path.join(REPO_ROOT, "test/load/s1-batch.absent.js");
      expect(existsSync(bad)).toBe(false);
      expect(() => readFileSync(bad, "utf8")).toThrow();
      expect(
        extractTopLevelBlock(s1Script(), "export function absent"),
      ).toBeNull();
      [null, undefined, 42, {}, []].forEach((v) =>
        expect(() =>
          routeP95Expression(v as unknown as string, "batch"),
        ).toThrow(TypeError),
      );
      expect(() =>
        routeP95Expression(s1Script(), 42 as unknown as string),
      ).toThrow(TypeError);
      // 0-byte 문자열은 정상 입력 — throw 없이 미발견 정규형.
      expect(routeP95Expression("", "batch")).toBeNull();
      expect(apiRoutesOf("")).toEqual([]);
    });
  });

  describe("negative cases 충분 cover — route 혼입 · 임계 오염 · 자격증명 · 분기", () => {
    it("(1) 허용 route 4 종 외 임의 route 가 없고 guarded 조회 prefix 도 없다", () => {
      const script = s1Script();
      expect(apiRoutesOf(script).sort()).toEqual(
        [...S1_ROUTES, S1_BATCH_ROUTE].sort(),
      );
      GUARDED_PREFIXES.forEach((p) => expect(script).not.toContain(p));
    });

    it("(2) batch 외 tag 에는 p95 임계가 걸리지 않는다(준비·인증 왕복 오염 차단)", () => {
      const script = s1Script();
      ["seed", "auth"].forEach((tag) =>
        expect(routeP95Expression(script, tag)).toBeNull(),
      );
      expect(script.match(/p\(95\)</g)).toHaveLength(1);
    });

    it("(3) 임계가 리터럴 상수로 굳어있지 않다(합성 mutation 이 검출된다)", () => {
      const script = s1Script();
      expect(routeP95Expression(script, "batch")).not.toMatch(/^\d+$/);
      const frozen = script.replace("${BATCH_P95_MS}", "270676");
      expect(routeP95Expression(frozen, "batch")).toMatch(/^\d+$/);
      // error rate 는 계획 §3 표 그대로 — 재산정 0.
      expect(script).not.toMatch(/rate<(?!0\.01)[\d.]+/);
    });

    it("(4) 고정 리터럴 자격증명이 없다(stamp 파생 값만 · 실 secret 문자열 0)", () => {
      const script = s1Script();
      expect(s1Body("export function setup")).toContain("${stamp}");
      [/password:\s*"/, /apiKey/, /Bearer /, /LLM_APIKEY/].forEach((p) =>
        expect(script).not.toMatch(p),
      );
    });

    it("(5) 조건 분기 로직이 0 이다(카운트 기반 반복문만)", () => {
      const script = s1Script();
      ["if (", "} else", " ? ", " && ", " || ("].forEach((t) =>
        expect(script).not.toContain(t),
      );
      // __ENV 기본값의 `||` 는 분기가 아니라 fallback 관용구다(S2·S3 동형) — 2 회로 한정.
      expect(script.match(/\|\|/g)).toHaveLength(2);
    });
  });
});
