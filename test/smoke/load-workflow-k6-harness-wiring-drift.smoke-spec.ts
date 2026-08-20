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
/** 타격 금지 — @UseGuards 가 붙어 토큰 없이는 401 인 조회 prefix. */
const GUARDED_PREFIXES = [
  "/api/assessments",
  "/api/contributions",
  "/api/summaries",
  "/api/users",
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

    it("(2) 타격 경로에 id 파라미터 경로가 없다(빈 DB 404 → non-2xx 오염 차단)", () => {
      const script = s2Script();
      S2_ROUTES.forEach(([, route]) => {
        expect(script).not.toContain(`${route}/`);
      });
      expect(script).not.toContain("${id}");
      expect(script).not.toMatch(/\/api\/\w+\/\d/);
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
      // 전역 + route tag 임계 4 종이 모두 3000ms. 다른 숫자로 갈리면 아래 count 가 어긋난다.
      expect(script.match(/p\(95\)<3000/g)).toHaveLength(4);
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
