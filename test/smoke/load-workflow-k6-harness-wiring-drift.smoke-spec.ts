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

/**
 * `k6 run [--flag ...] <path>` 에서 스크립트 상대경로만 뽑는다. 형태가 다르면 null(추측 0).
 * T-1636 — S1 step 이 `--summary-export=<path>` 를 실행 경로 앞에 달게 되어 **선행 flag 토큰만**
 * 건너뛴다. 경로 뒤 인자가 붙는 형태(`k6 run a.js --vus 10`)는 종전대로 null 이라 "단일 커맨드
 * 정규형" 대조력은 불변이다.
 */
function scriptPathOf(command: string | null): string | null {
  const m =
    command === null
      ? null
      : command.trim().match(/^k6\s+run\s+(?:-\S+\s+)*(\S+)$/);
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
 * workflow 의 env 주입 표현식을 "실제로 선언된 값" 으로 해석한다 (T-1640).
 * - `${{ inputs.<name> }}`(또는 `${{ github.event.inputs.<name> }}`) 형태면 같은 workflow 의
 *   `workflow_dispatch.inputs.<name>.default` 를 돌려준다 — 선언 부재면 `null`(추측 0).
 * - 그 외에는 따옴표만 벗긴 리터럴 그대로 (파라미터화 이전 형태 하위호환 분기).
 * @throws {TypeError} `source`/`expr` 이 non-string 일 때(위 helper 들과 동형 계약 — false-PASS 방지).
 */
function resolveInputExpr(source: string, expr: string): string | null {
  if (typeof source !== "string" || typeof expr !== "string") {
    throw new TypeError("resolveInputExpr: source·expr 은 string 이어야 함");
  }
  const ref = unquote(expr).match(
    /^\$\{\{\s*(?:github\.event\.)?inputs\.([A-Za-z0-9_-]+)\s*\}\}$/,
  );
  if (ref === null) {
    return unquote(expr);
  }
  const lines = triggerSection(source).split("\n");
  const head = lines.findIndex((l) => l.trim() === `${ref[1]}:`);
  if (head < 0) {
    return null;
  }
  const headIndent = indentOf(lines[head]);
  for (let i = head + 1; i < lines.length; i += 1) {
    if (lines[i].trim() !== "" && indentOf(lines[i]) <= headIndent) {
      break;
    }
    if (lines[i].trim().startsWith("default:")) {
      return unquote(lines[i].trim().slice("default:".length));
    }
  }
  return null;
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
/**
 * T-1672 가 s2-read.js 에 고정한 personIds 단일 식 chain — 조회 → devset 도메인 필터 →
 * `slice(0, SEED_PERSONS)` → id 추출이 한 식으로 이어진다. 중간 변수 · 조건 분기 · `Math.min`
 * 으로 쪼개지면 즉시 깨진다(T-1620 규약 승계, s1-batch.js 의 T-1661 chain 동형).
 */
const S2_PERSON_IDS_CHAIN =
  /const personIds = persons\s*\.json\(\)\s*\.filter\([^\n]*endsWith\(`@\$\{DEVSET_EMAIL_DOMAIN\}`\),?\s*\)\s*\.slice\(0, SEED_PERSONS\)\s*\.map\(/;

/**
 * 부하 스크립트의 `__ENV.<envKey>` 선언에서 fallback 기본값 리터럴을 뽑는다(S1 · S2 공유 helper).
 * 정규화 표현(`Math.trunc(Number(__ENV.X)) || N`) 과 옛 직접 표현(`__ENV.X || N`) 을 같은 정규형
 * 으로 뽑아, 표현 형태가 바뀌어도 workflow 주입값 ↔ 스크립트 기본값 대조력이 유지된다.
 * 대상 부재면 `null`(추측 0).
 * @throws {TypeError} `source`/`envKey` 가 non-string 일 때(0-byte fallback false-PASS 방지).
 */
function extractEnvFallback(source: string, envKey: string): string | null {
  if (typeof source !== "string" || typeof envKey !== "string") {
    throw new TypeError(
      "extractEnvFallback: source·envKey 는 string 이어야 함",
    );
  }
  const m = source.match(
    new RegExp("__ENV[.]" + envKey + "[^\\n]*?[|][|]\\s*(\\d+)"),
  );
  return m ? m[1] : null;
}
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
    it("setup() 이 seed POST 4 회 + devset 조회 1 회로 규모를 __ENV 로 읽으며 id 를 return 한다", () => {
      const script = s2Script();
      expect(script).toContain("export function setup()");
      const setup = s2Body("export function setup");
      // S2_ROUTES 3 종 문자열은 그대로 남는다 — T-1672 이후 `/api/persons` 는 생성 POST 가
      // 아니라 devset **조회** GET 으로 등장한다(표현 무변경, 의미만 이동 — 설계 ④ (b)).
      S2_ROUTES.forEach(([, route]) => expect(setup).toContain(route));
      // group · part seed 2 종 + T-1624 인증 부트스트랩 2 종 = POST 4 회(person 생성은 사라짐).
      expect(setup.match(/http\.post\(/g)).toHaveLength(4);
      // 대체물 — devset 도메인으로 필터한 `/api/persons` 조회가 정확히 1 회다.
      expect(
        setup.match(/http\.get\(`\$\{BASE_URL\}\/api\/persons`/g),
      ).toHaveLength(1);
      expect(setup).toContain("endsWith(`@${DEVSET_EMAIL_DOMAIN}`)");
      // 조회 → 도메인 필터 → 표본 상한만큼 slice → id 추출이 한 식으로 이어진다(중간 변수 0).
      expect(setup).toMatch(S2_PERSON_IDS_CHAIN);
      // 반환값이 teardown 으로 전달되도록 setup 이 실제로 id 를 return 한다.
      expect(setup).toContain("return {");
      ["personIds", "groupIds", "partIds"].forEach((k) =>
        expect(setup).toContain(k),
      );
      expect(script).toContain('tags: { route: "seed" }');
      expect(script).toContain(`__ENV.${SEED_ENV_KEY}`);
    });

    it("teardown(data) 가 2 종 DELETE 로 자기가 만든 row 만 지우고 devset person 은 보존한다", () => {
      const script = s2Script();
      expect(script).toMatch(/export function teardown\(\w+\)/);
      const body = s2Body("export function teardown");
      // 회수 대상은 이 스크립트가 만든 group · part 2 종뿐이다(설계 ④ (c)).
      expect(body).toContain("/api/groups/");
      expect(body).toContain("/api/parts/");
      expect(body.match(/http\.del\(/g)).toHaveLength(2);
      expect(script).toContain('tags: { route: "teardown" }');
      // negative — person 은 seed step 이 적재한 공유 row 라 지우면 뒤따르는 step · 다음 run 이
      // 빈 DB 위에서 돈다. teardown 에 personIds · person DELETE 루프가 잔존 0 이어야 한다.
      ["personIds", "/api/persons"].forEach((t) =>
        expect(body).not.toContain(t),
      );
      expect(body.match(/for \(let i = 0;/g)).toHaveLength(2);
    });

    it("workflow S2 step 의 K6_SEED_PERSONS(= 표본 상한) 가 스크립트 __ENV 기본값과 parity 다", () => {
      const block = extractStepBlock(loadYml(), S2_RUN_STEP_NAME) as string[];
      const injected = extractKey(block, SEED_ENV_KEY) as string;
      expect(Number(injected)).toBeGreaterThan(0);
      const fallback = extractEnvFallback(s2Script(), SEED_ENV_KEY) as string;
      expect(fallback).toBe(injected);
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
      // 카운트 기반 for 반복문은 허용 — T-1672 이후 정리 2 블록(group · part)에서만 쓰인다
      // (person seed 생성 루프와 person 정리 루프가 조회 교체 · 보존 계약으로 함께 사라졌다).
      expect(script.match(/for \(let i = 0;/g)).toHaveLength(2);
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
/**
 * (T-1645) T-1644 가 계획 §3 표에 확정한 stub 조건 baseline — 표본 133 · p95 1200ms.
 * (T-1696) 값은 T-1695 가 S1 15 회차 실 run 으로 재확정한 관찰용 임계다(T-1668 규칙 ② —
 * 실 scale 표본 12 개 평균 + 3σ = 1198.83ms 의 100ms 올림). 직전 값은 1100ms(T-1676)였다.
 */
const S1_STUB_BASELINE_PERSONS = 133;
const S1_STUB_BASELINE_P95_MS = 1200;
/** baseline 원소를 표본 133 에만 얹는 조건식(분기문 0 규약을 지키는 filter 콜백 형태). */
const S1_BASELINE_GATE =
  /\.filter\(\s*\(\) => SAMPLE_PERSONS === STUB_BASELINE_PERSONS,?\s*\)/;
/** 때려도 되는 route 전량 — seed / auth / batch 의 합집합(그 밖은 임의 route 혼입). */
const S1_ROUTES = [
  "/api/persons",
  "/api/users",
  "/api/auth/login",
  // T-1632 — ADR-0057 D5 의 provider 단일-row seed 왕복(GET 열거 · DELETE 전량 · POST 1 회).
  "/api/llm/providers",
];
/** D5 seed POST body 의 allow-list 정본 4 필드(그 밖의 키는 forbidNonWhitelisted 가 400). */
const S1_PROVIDER_FIELDS = ["provider", "endpointUrl", "apiKey", "modelId"];
/** src/llm/llm-gateway.interface.ts 의 LlmProvider 허용 집합 5 값(이 밖이면 service 가 400). */
const S1_ALLOWED_PROVIDERS = [
  "custom",
  "azure_openai",
  "anthropic",
  "google_gemini",
  "openai",
];
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

/**
 * (T-1645) 한 route tag 의 임계 항목 원문 — 키 행 + 그보다 깊게 들여쓴 이어지는 행 전부. 값이
 * 여러 행에 걸친 배열·체인이어도 항목 경계를 들여쓰기로만 판정한다. 대상 행 부재면 `null`(추측 0).
 * @throws {TypeError} 입력이 non-string 일 때.
 */
function routeThresholdEntry(script: string, tag: string): string | null {
  if (typeof script !== "string" || typeof tag !== "string") {
    throw new TypeError("routeThresholdEntry: script·tag 는 string 이어야 함");
  }
  const lines = script.split("\n");
  const start = lines.findIndex((l) =>
    l.trim().startsWith(`"http_req_duration{route:${tag}}"`),
  );
  if (start < 0) return null;
  const indentOf = (l: string): number => l.length - l.trimStart().length;
  const rest = lines.slice(start + 1);
  const end = rest.findIndex(
    (l) => l.trim() !== "" && indentOf(l) <= indentOf(lines[start]),
  );
  return [lines[start], ...rest.slice(0, end < 0 ? rest.length : end)].join(
    "\n",
  );
}

/**
 * (T-1645) 한 route tag 임계 항목의 `p(95)<...` 표현식 전량(선언 순서 보존). 항목 부재 · p95 아닌
 * 집계자면 빈 배열(추측 0) — `routeP95Expression` 의 단수 계약을 배열 값으로 확장한 것이다.
 * @throws {TypeError} 입력이 non-string 일 때.
 */
function routeP95Expressions(script: string, tag: string): string[] {
  const entry = routeThresholdEntry(script, tag);
  if (entry === null) return [];
  return (entry.match(/p\(95\)<[^`"']+/g) || []).map((m) =>
    m.slice("p(95)<".length),
  );
}

/** (T-1645) baseline 배선 불변식 — mutation 검출력 확인에 그대로 재사용한다. */
const baselineWiringIntact = (script: string): boolean =>
  script.includes(
    `const STUB_BASELINE_PERSONS = ${S1_STUB_BASELINE_PERSONS};`,
  ) &&
  script.includes(`const STUB_BASELINE_P95_MS = ${S1_STUB_BASELINE_P95_MS};`) &&
  routeP95Expressions(script, "batch").join(",") ===
    "${BATCH_P95_MS},${STUB_BASELINE_P95_MS}" &&
  S1_BASELINE_GATE.test(routeThresholdEntry(script, "batch") as string);

describe("test/load/s1-batch.js S1 평가 배치 부하 골격 drift smoke (T-1631)", () => {
  describe("Happy-path: 실재 · 대상 route · tag 3 종 · 임계 key · setup/teardown", () => {
    it("s1-batch.js 가 실재하고 setup / default / teardown export 와 __ENV 기본값 2 종을 갖는다", () => {
      expect(existsSync(path.join(REPO_ROOT, S1_SCRIPT_REL))).toBe(true);
      const script = s1Script();
      expect(script).toMatch(
        /export function setup\(\)[\s\S]*export default function \(data\)[\s\S]*export function teardown\(data\)/,
      );
      // 표본 인원 기본 10 + base URL 은 smoke.js·S2·S3 와 동일(workflow 주입값 parity).
      expect(extractEnvFallback(script, S1_PERSONS_ENV_KEY)).toBe("10");
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

    it("(T-1645) batch 임계 배열이 외삽 + 표본 133 stub baseline 1200ms 2 종이다", () => {
      const script = s1Script();
      // 임계 key 목록·순서는 2 종 그대로 — 늘어난 것은 batch 값 배열의 원소뿐이다.
      expect(thresholdKeys(script)).toEqual(S1_THRESHOLD_KEYS);
      expect(routeP95Expressions(script, "batch")).toEqual([
        "${BATCH_P95_MS}",
        "${STUB_BASELINE_P95_MS}",
      ]);
      expect(script).toContain(
        `const STUB_BASELINE_PERSONS = ${S1_STUB_BASELINE_PERSONS};`,
      );
      expect(script).toContain(
        `const STUB_BASELINE_P95_MS = ${S1_STUB_BASELINE_P95_MS};`,
      );
      // 판정 게이트(외삽)와 error rate 항목은 무변경 — 두 성격을 하나로 합치지 않았다.
      expect(script).toContain('http_req_failed: ["rate<0.01"],');
      expect(baselineWiringIntact(script)).toBe(true);
    });

    it("setup 이 seed / auth tag 로 준비하고 teardown 이 person 을 회수하지 않는다", () => {
      const setup = s1Body("export function setup");
      // T-1661 이후 person 은 생성이 아니라 조회다 — signup + login + provider seed = POST 3 회.
      expect(setup.match(/http\.post\(/g)).toHaveLength(3);
      // T-1632 이후 인증이 person 조회보다 앞선다(D5 provider 왕복이 Admin+ gate 라서).
      expect(setup).toMatch(/AUTH_PARAMS[\s\S]*authCookie =[\s\S]*SEED_PARAMS/);
      // 공유 dataset 보존 — teardown 에 person 회수 반복문도 그 전용 params 도 남지 않는다.
      const down = s1Body("export function teardown");
      ["personIds", "SEED_DELETE_PARAMS"].forEach((t) =>
        expect(down).not.toContain(t),
      );
      expect(down.match(/http\.del\(/g)).toHaveLength(1);
    });

    it("(T-1632) setup 이 D5 의 멱등 3 단 왕복으로 provider row 를 1 개로 수렴시킨다", () => {
      const setup = s1Body("export function setup");
      // (a) 열거 GET → (b) 열거 전량 DELETE(카운트 반복) → (c) POST 1 회, 순서까지 고정.
      expect(setup).toMatch(
        /http\.get\(`\$\{BASE_URL\}\/api\/llm\/providers`[\s\S]*http\.del\([\s\S]*http\.post\(\s*`\$\{BASE_URL\}\/api\/llm\/providers`/,
      );
      expect(setup).toMatch(/existing\.length[\s\S]*existing\[i\]\.id/);
      // 세 왕복 모두 seed tag — cookie 를 실은 params 2 종이 batch 임계를 오염시키지 않는다.
      expect(setup.match(/tags: \{ route: "seed" \}/g)).toHaveLength(2);
      expect(setup).toContain("Cookie: authCookie");
    });

    it("(T-1632) POST body 는 더미 4 필드뿐이고 id 가 setup 반환 → teardown 회수로 흐른다", () => {
      const setup = s1Body("export function setup");
      // allow-list 4 필드가 선언 순서 그대로, 추가 키 0(정규식이 닫는 중괄호까지 고정).
      expect(setup).toMatch(
        /JSON\.stringify\(\{\s*provider: "custom",\s*endpointUrl: `[^`]+`,\s*apiKey: `[^`]+`,\s*modelId: `[^`]+`,\s*\}\)/,
      );
      S1_PROVIDER_FIELDS.forEach((f) => expect(setup).toContain(`${f}: `));
      expect(setup).toContain('providerId: provider.json("id")');
      const down = s1Body("export function teardown");
      expect(down).toContain("data.providerId");
      expect(down).toMatch(
        /http\.del\(`\$\{BASE_URL\}\/api\/llm\/providers\/\$\{data\.providerId\}`[\s\S]*route: "seed"/,
      );
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

    it("(T-1645) baseline 원소의 두 갈래가 표본 133 비교식 하나로만 갈린다", () => {
      const script = s1Script();
      const entry = routeThresholdEntry(script, "batch") as string;
      // 스크립트를 실행할 수 없으므로 ① 표본 133 → baseline 포함 / ② 그 밖 → 미포함 두 갈래를
      // 조건식 텍스트(비교 대상 상수 2 개 · 비교 연산자 형태)로 고정해 대체 cover 한다.
      expect(entry).toMatch(S1_BASELINE_GATE);
      expect(entry).toContain("`p(95)<${STUB_BASELINE_P95_MS}`");
      expect(script).toContain(
        `const STUB_BASELINE_PERSONS = ${S1_STUB_BASELINE_PERSONS};`,
      );
      expect(script).toContain(
        `const STUB_BASELINE_P95_MS = ${S1_STUB_BASELINE_P95_MS};`,
      );
      // 외삽 원소는 조건 밖 — filter 앞의 무조건 원소라 두 갈래 모두에서 살아 있다.
      expect(entry.indexOf("${BATCH_P95_MS}")).toBeGreaterThanOrEqual(0);
      expect(entry.indexOf("${BATCH_P95_MS}")).toBeLessThan(
        entry.indexOf(".filter("),
      );
      // 비교 연산자가 느슨한 동등(==)이나 부등호로 완화되지 않았다.
      expect(entry).not.toMatch(/SAMPLE_PERSONS ==[^=]/);
      expect(entry).not.toMatch(/SAMPLE_PERSONS [<>]/);
    });

    it("(T-1645) routeThresholdEntry / routeP95Expressions: 부재 · p95 아님 · non-string", () => {
      const script = s1Script();
      // 대상 있음 / 없음 두 갈래 — batch 는 2 종, 다른 tag 는 항목 자체가 없다.
      expect(routeP95Expressions(script, "batch")).toHaveLength(2);
      expect(routeThresholdEntry(script, "seed")).toBeNull();
      expect(routeP95Expressions(script, "seed")).toEqual([]);
      const dropped = script.replace('"http_req_duration{route:batch}"', "//");
      expect(routeThresholdEntry(dropped, "batch")).toBeNull();
      expect(routeP95Expressions(dropped, "batch")).toEqual([]);
      // p(95) 아닌 집계자 · thresholds 블록 부재 · 0-byte 는 throw 없이 미발견 정규형.
      expect(
        routeP95Expressions(
          '  "http_req_duration{route:batch}": ["avg<900"],',
          "batch",
        ),
      ).toEqual([]);
      expect(
        routeThresholdEntry("export const options = {\n  vus: 1,\n};", "batch"),
      ).toBeNull();
      expect(routeP95Expressions("", "batch")).toEqual([]);
      [null, undefined, 42, {}, []].forEach((v) => {
        expect(() =>
          routeThresholdEntry(v as unknown as string, "batch"),
        ).toThrow(TypeError);
        expect(() =>
          routeP95Expressions(v as unknown as string, "batch"),
        ).toThrow(TypeError);
      });
      expect(() =>
        routeP95Expressions(script, 42 as unknown as string),
      ).toThrow(TypeError);
    });

    it("(T-1632) 신규 단언도 재사용 helper 계약 위에서만 성립한다(신규 helper 0)", () => {
      // 본 slice 는 helper 를 추가하지 않고 s1Body / apiRoutesOf / routeP95Expression 3 종을
      // 재사용만 했다 — 그래서 "대상 있음 / 없음" 분기 cover 를 아래 두 helper 로 승계한다.
      expect(
        extractTopLevelBlock(s1Script(), "export function seedProvider"),
      ).toBeNull();
      expect(s1Body("export function setup")).toContain("/api/llm/providers");
      // 대상 있음 / 없음 — 주석 행만 있는 입력은 타격 route 0 으로 접힌다.
      expect(apiRoutesOf("// ${BASE_URL}/api/llm/providers")).toEqual([]);
      expect(apiRoutesOf("`${BASE_URL}/api/llm/providers/${id}`")).toEqual([
        "/api/llm/providers",
      ]);
      // non-string 계약(T-1631 블록과 동형)이 신규 단언 대상에서도 그대로다.
      [null, undefined, 42].forEach((v) =>
        expect(() =>
          extractTopLevelBlock(v as unknown as string, "export function setup"),
        ).toThrow(TypeError),
      );
      expect(routeP95Expression(s1Script(), "seed")).toBeNull();
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
    it("(1) 허용 route 5 종 외 임의 route 가 없고 guarded 조회 prefix 도 없다", () => {
      const script = s1Script();
      expect(apiRoutesOf(script).sort()).toEqual(
        [...S1_ROUTES, S1_BATCH_ROUTE].sort(),
      );
      GUARDED_PREFIXES.forEach((p) => expect(script).not.toContain(p));
    });

    it("(2) batch 외 tag 에는 p95 임계가 걸리지 않는다(준비·인증 왕복 오염 차단)", () => {
      const script = s1Script();
      ["seed", "auth"].forEach((tag) => {
        expect(routeP95Expression(script, tag)).toBeNull();
        expect(routeP95Expressions(script, tag)).toEqual([]);
      });
      // T-1645 이후 p95 표현식은 2 개지만 둘 다 batch 항목 안에 있다(다른 tag 오염 0).
      expect(script.match(/p\(95\)</g)).toHaveLength(2);
      expect(routeP95Expressions(script, "batch")).toHaveLength(2);
    });

    it("(3) 임계가 리터럴 상수로 굳어있지 않다(합성 mutation 이 검출된다)", () => {
      const script = s1Script();
      expect(routeP95Expression(script, "batch")).not.toMatch(/^\d+$/);
      const frozen = script.replace("${BATCH_P95_MS}", "270676");
      expect(routeP95Expression(frozen, "batch")).toMatch(/^\d+$/);
      // error rate 는 계획 §3 표 그대로 — 재산정 0.
      expect(script).not.toMatch(/rate<(?!0\.01)[\d.]+/);
    });

    it("(T-1645) baseline 배선 mutation 4 종이 전부 검출된다", () => {
      const script = s1Script();
      expect(baselineWiringIntact(script)).toBe(true);
      // ① 1200 → 다른 숫자로 변조(상향 · 하향 두 방향 모두 검출돼야 한다).
      const shifted = script.replace(
        "STUB_BASELINE_P95_MS = 1200;",
        "STUB_BASELINE_P95_MS = 1500;",
      );
      expect(shifted).not.toBe(script);
      expect(baselineWiringIntact(shifted)).toBe(false);
      // ①-b 하향 변조(T-1668 규칙 ③ 이 금지한 방향) 도 같은 불변식이 잡는다.
      const lowered = script.replace(
        "STUB_BASELINE_P95_MS = 1200;",
        "STUB_BASELINE_P95_MS = 800;",
      );
      expect(lowered).not.toBe(script);
      expect(baselineWiringIntact(lowered)).toBe(false);
      // ② baseline 표현식 삭제.
      const removed = script.replace("`p(95)<${STUB_BASELINE_P95_MS}`", "``");
      expect(baselineWiringIntact(removed)).toBe(false);
      // ③ 외삽 표현식을 리터럴로 굳힘(기존 (3) 케이스와 동형, 배열 첫 원소 기준).
      expect(
        baselineWiringIntact(script.replace("${BATCH_P95_MS}", "270676")),
      ).toBe(false);
      // ④ 조건식 제거로 baseline 이 축소 표본에서도 무조건 활성화되는 변조.
      const always = script.replace(S1_BASELINE_GATE, "");
      expect(always).not.toBe(script);
      expect(baselineWiringIntact(always)).toBe(false);
    });

    it("(4) 자격증명이 전부 stamp 파생 더미다(실 secret 리터럴 0 · 암호화 키 문자열 0)", () => {
      const script = s1Script();
      expect(s1Body("export function setup")).toContain("${stamp}");
      // T-1632 이후 apiKey 키 자체는 존재해야 한다(D5 의 필수 4 필드) — 대신 그 값이 stamp
      // 파생임을 고정해 run 마다 달라지는 더미임을 못박는다(T-1631 의 /apiKey/ 부재 단언 대체).
      expect(script).toMatch(/apiKey: `load-s1-dummy-\$\{stamp\}`/);
      expect(script).toMatch(/endpointUrl: `[^`"]*\$\{stamp\}`/);
      // 실 secret 리터럴 · 암호화 키 env 이름 · Bearer 헤더 · 평문 password 리터럴은 전부 0.
      [
        /password:\s*"/,
        /Bearer /,
        /LLM_APIKEY/,
        /apiKey: "/,
        /sk-[A-Za-z0-9]/,
      ].forEach((p) => expect(script).not.toMatch(p));
    });

    it("(5) 조건 분기 로직이 0 이다(카운트 기반 반복문만)", () => {
      const script = s1Script();
      ["if (", "} else", " ? ", " && ", " || ("].forEach((t) =>
        expect(script).not.toContain(t),
      );
      // __ENV 기본값의 `||` 는 분기가 아니라 fallback 관용구다(S2·S3 동형) — 2 회로 한정.
      expect(script.match(/\|\|/g)).toHaveLength(2);
    });

    it("(6) seed 왕복이 default() 측정 iteration 으로 새지 않는다", () => {
      const body = s1Body("export default function");
      ["/api/llm/providers", 'route: "seed"', "http.del(", "http.get("].forEach(
        (t) => expect(body).not.toContain(t),
      );
      // 측정 iteration 은 여전히 batch tag 1 회 호출뿐이다.
      expect(body.match(/tags: \{ route: "batch" \}/g)).toHaveLength(1);
    });

    it("(7) seed 의 provider 값이 LlmProvider 허용 집합 안에 있다(400 차단)", () => {
      const declared = (
        s1Body("export function setup").match(
          /provider: "([a-z_]+)"/,
        ) as string[]
      )[1];
      expect(S1_ALLOWED_PROVIDERS).toContain(declared);
      // 합성 mutation — 허용 집합 밖 값이면 본 단언이 무너진다.
      expect(S1_ALLOWED_PROVIDERS).not.toContain(`${declared}_unsupported`);
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// T-1633 — S1 실행 step 배선 + stub/cipher env 주입 + `test:load:s1` parity drift.
// 존재 이유 — ADR-0057 `범위 밖` 3 번째 항목이 지정한 배선은 전부 문자열이라 ① S1 step 이
// 사라지거나 ② 순서가 S2 뒤로 밀려 첫 user 가 SuperAdmin 이 아니게 되거나(403 → error rate
// 오염) ③ `LOAD_TEST_STUB` 이 `1` 아닌 표기로 drift 해 실 LLM gateway 가 붙거나 ④ 32-byte
// cipher 키가 빠져 D5 provider seed 가 throw 하거나 ⑤ `if:` / `continue-on-error` 로 임계
// 위반이 조용히 green 이 되어도, 상시 CI 는 여전히 green 이다(부하 job 은 수동 발화 전용).
//      🔥 실 GitHub Actions 발화 0 · 실 k6 실행 0 · 실 docker 실행 0 · 새 dependency 0 ·
//         process.env 읽기/쓰기 0 — 파일 read + 합성 문자열 주입만.
const S1_RUN_STEP_NAME = "k6 S1 평가 배치 부하 시나리오 실행";
/** 기동 step 이 주입해야 하는 env 이름 2 종 — load-test-stub-gating.ts 21 행 / cipher ENC_KEY_ENV. */
const STUB_ENV_KEY = "LOAD_TEST_STUB";
const ENC_KEY_ENV = "LLM_APIKEY_ENC_KEY";
/** ADR-0057 D1 이 stub 활성으로 인정하는 유일한 값(그 밖은 전부 실 gateway fall-through). */
const STUB_ENABLED_VALUE = "1";
/** 표본 인원 주입 env 이름 — 값 자체는 스크립트 __ENV 기본값에서 뽑아 대조한다(리터럴 고정 0). */
const S1_PERSONS_ENV_KEY = "K6_S1_PERSONS";
/** AES-256 키 길이 — llm-apikey-cipher.service.ts 36 행 KEY_LENGTH_BYTES 와 동일 값. */
const ENC_KEY_BYTES = 32;

/**
 * `docker run ... -e KEY=VALUE \` 형태에서 값만 뽑는다(행 끝의 이음표 백슬래시는 제거). 부재면
 * `null`(추측 0) — 이 두 갈래가 "`-e` flag 존재 / 부재" 분기의 실체다.
 * @throws {TypeError} 입력이 non-string 일 때(extractStepBlock 과 동형 계약).
 */
function dockerEnvValue(source: string, key: string): string | null {
  if (typeof source !== "string" || typeof key !== "string") {
    throw new TypeError("dockerEnvValue: source·key 는 string 이어야 함");
  }
  const m = source.match(new RegExp(`-e\\s+${key}=(\\S+)`));
  return m ? unquote(m[1].replace(/\\$/, "")) : null;
}

describe("load-k6.yml S1 step 배선 ↔ stub/cipher env 주입 ↔ package.json test:load:s1 drift smoke (T-1633)", () => {
  describe("Happy-path: S1 step 실재 · env 주입 · 3 자 parity · 실행 순서", () => {
    it("(a) S1 실행 step 이 실재하고 run 이 test/load/s1-batch.js 를 정확히 가리킨다", () => {
      const step = extractStep(loadYml(), S1_RUN_STEP_NAME);
      expect(step.found).toBe(true);
      expect(step.uses).toBeNull();
      const rel = scriptPathOf(step.run) as string;
      expect(rel).toBe(S1_SCRIPT_REL);
      // 경로 오타 drift 검출 — 겨냥한 파일이 실재해야 한다.
      expect(existsSync(path.join(REPO_ROOT, rel))).toBe(true);
    });

    it("(b) step 주입 env 2 종이 스크립트 __ENV 기본값과 동형이다", () => {
      const block = extractStepBlock(loadYml(), S1_RUN_STEP_NAME) as string[];
      expect(extractKey(block, "K6_BASE_URL")).toBe(EXPECTED_BASE_URL);
      // 표본 인원은 리터럴로 굳히지 않고 스크립트 기본값에서 뽑아 대조한다(양쪽 동시 drift 차단).
      // T-1640 — 주입값이 dispatch input 표현식이 되었으므로 선언된 default 로 해석한 뒤 대조한다.
      const declared = extractEnvFallback(
        s1Script(),
        S1_PERSONS_ENV_KEY,
      ) as string;
      expect(
        resolveInputExpr(
          loadYml(),
          extractKey(block, S1_PERSONS_ENV_KEY) as string,
        ),
      ).toBe(declared);
    });

    it("(c) workflow 실행 경로 · package.json test:load:s1 · 실 파일 3 자 parity", () => {
      const p = pkg();
      const fromPkg = scriptPathOf(p.scripts["test:load:s1"]);
      expect(fromPkg).toBe(S1_SCRIPT_REL);
      expect(scriptPathOf(extractStep(loadYml(), S1_RUN_STEP_NAME).run)).toBe(
        fromPkg,
      );
      // 기존 3 script 는 불변 — 본 slice 는 1 줄 추가만 한다.
      expect(p.scripts["test:load"]).toBe(`k6 run ${LOAD_SCRIPT_REL}`);
      expect(p.scripts["test:load:s2"]).toBe(`k6 run ${S2_SCRIPT_REL}`);
      expect(p.scripts["test:load:s3"]).toBe(`k6 run ${S3_SCRIPT_REL}`);
    });

    it("(d) step 순서가 smoke < S1 < S2 < S3 < 정리 다(ADR-0057 D2)", () => {
      const yml = loadYml();
      const smokeIdx = stepIndexOf(yml, RUN_STEP_NAME);
      const s1Idx = stepIndexOf(yml, S1_RUN_STEP_NAME);
      const s2Idx = stepIndexOf(yml, S2_RUN_STEP_NAME);
      const s3Idx = stepIndexOf(yml, S3_RUN_STEP_NAME);
      expect(smokeIdx).toBeGreaterThan(0);
      expect(s1Idx).toBeGreaterThan(smokeIdx);
      expect(s2Idx).toBeGreaterThan(s1Idx);
      expect(s3Idx).toBeGreaterThan(s2Idx);
      expect(stepIndexOf(yml, TEARDOWN_STEP_NAME)).toBeGreaterThan(s3Idx);
    });

    it("(e) 기동 step 이 stub env 1 과 32-byte cipher 더미 키를 주입한다", () => {
      const bootText = (
        extractStepBlock(loadYml(), BOOT_STEP_NAME) as string[]
      ).join("\n");
      expect(dockerEnvValue(bootText, STUB_ENV_KEY)).toBe(STUB_ENABLED_VALUE);
      const encKey = dockerEnvValue(bootText, ENC_KEY_ENV) as string;
      expect(encKey).not.toBeNull();
      // base64 우선 → 아니면 hex(resolveKey 43~65 행 동형). 어느 쪽이든 정확히 32 byte 여야
      // provider seed 가 cipher throw 없이 성립한다.
      const decoded = [
        Buffer.from(encKey, "base64"),
        Buffer.from(encKey, "hex"),
      ].map((b) => b.length);
      expect(decoded).toContain(ENC_KEY_BYTES);
      // 기존 env 3 종은 S1 배선 후에도 불변(T-1621 배선 회귀 0).
      ["-e DATABASE_URL=", "-e AUTH_JWT_SECRET=", "-e PORT=3000"].forEach((f) =>
        expect(bootText).toContain(f),
      );
    });
  });

  describe("flow / 분기 cover — 따옴표 유무 · 블록 종료 2 갈래 · -e flag 존재/부재", () => {
    it("(a) env 값의 따옴표 유무 두 형태를 extractKey 가 동일하게 처리한다", () => {
      const quoted = `      - name: ${S1_RUN_STEP_NAME}\n        env:\n          K6_BASE_URL: "${EXPECTED_BASE_URL}"\n          ${S1_PERSONS_ENV_KEY}: "10"\n        run: k6 run ${S1_SCRIPT_REL}\n      - name: 다음\n`;
      const bare = quoted.replace(/"/g, "");
      [quoted, bare].forEach((src) => {
        const b = extractStepBlock(src, S1_RUN_STEP_NAME) as string[];
        expect(extractKey(b, "K6_BASE_URL")).toBe(EXPECTED_BASE_URL);
        expect(extractKey(b, S1_PERSONS_ENV_KEY)).toBe("10");
      });
    });

    it("(b) 블록이 다음 step 헤더에서 끊김 / 파일 끝에서 끊김 두 갈래", () => {
      // 실 파일 — 다음 헤더(S2)에서 끊긴다.
      const block = extractStepBlock(loadYml(), S1_RUN_STEP_NAME) as string[];
      expect(block.join("\n")).not.toContain(S2_RUN_STEP_NAME);
      // 합성 — S1 step 이 마지막이라 파일 끝에서 끊긴다.
      const tailOnly = `jobs:\n  load:\n    steps:\n      - name: ${S1_RUN_STEP_NAME}\n        env:\n          K6_BASE_URL: ${EXPECTED_BASE_URL}\n        run: k6 run ${S1_SCRIPT_REL}`;
      const tail = extractStepBlock(tailOnly, S1_RUN_STEP_NAME) as string[];
      expect(tail).toHaveLength(4);
      // S1 step 에는 seed 인원 env(S2 전용)가 없다 — 부재 키는 null.
      expect(extractKey(block, SEED_ENV_KEY)).toBeNull();
    });

    it("(c) dockerEnvValue: -e flag 존재 / 부재 두 갈래", () => {
      const withFlag = `docker run -d --name aa-load \\\n  -e ${STUB_ENV_KEY}=1 \\\n  image`;
      expect(dockerEnvValue(withFlag, STUB_ENV_KEY)).toBe(STUB_ENABLED_VALUE);
      const withoutFlag = withFlag.replace(`-e ${STUB_ENV_KEY}=1 \\\n  `, "");
      expect(dockerEnvValue(withoutFlag, STUB_ENV_KEY)).toBeNull();
      expect(dockerEnvValue("", ENC_KEY_ENV)).toBeNull();
    });
  });

  describe("Error path — 대상 부재 / non-string 계약", () => {
    it("S1 step 이 없는 합성 YAML → throw 0 · 미발견 정규형 · index -1", () => {
      const withoutS1 = loadYml()
        .split("\n")
        .filter((l) => l.trim() !== `- name: ${S1_RUN_STEP_NAME}`)
        .join("\n");
      expect(extractStep(withoutS1, S1_RUN_STEP_NAME)).toEqual({
        found: false,
        uses: null,
        run: null,
      });
      expect(stepIndexOf(withoutS1, S1_RUN_STEP_NAME)).toBe(-1);
      expect(extractStepBlock(withoutS1, S1_RUN_STEP_NAME)).toBeNull();
    });

    it("non-string 입력 → TypeError(0-byte fallback false-PASS 방지)", () => {
      [null, undefined, 42, {}, []].forEach((v) => {
        expect(() =>
          extractStepBlock(v as unknown as string, S1_RUN_STEP_NAME),
        ).toThrow(TypeError);
        expect(() =>
          dockerEnvValue(v as unknown as string, STUB_ENV_KEY),
        ).toThrow(TypeError);
      });
      expect(() =>
        dockerEnvValue("docker run", 7 as unknown as string),
      ).toThrow(TypeError);
      // 0-byte 문자열은 정상 입력 — throw 없이 미발견 정규형.
      expect(extractStepBlock("", S1_RUN_STEP_NAME)).toBeNull();
    });
  });

  describe("negative cases 충분 cover — stub 오활성 · secret 유출 · 트리거 · 우회 flag", () => {
    it("(a) LOAD_TEST_STUB 이 1 외 표기(true · 0 · 빈 값)로 drift 하지 않았다", () => {
      const yml = loadYml();
      [
        `${STUB_ENV_KEY}=true`,
        `${STUB_ENV_KEY}=TRUE`,
        `${STUB_ENV_KEY}=0`,
        `${STUB_ENV_KEY}=yes`,
        `${STUB_ENV_KEY}="1"`,
        `${STUB_ENV_KEY}= `,
      ].forEach((t) => expect(yml).not.toContain(t));
      expect(yml.match(new RegExp(`${STUB_ENV_KEY}=`, "g"))).toHaveLength(1);
      // 합성 mutation 대조군 — 관대한 표기로 바뀌면 판정값 단언이 무너진다.
      const drifted = yml.replace(`${STUB_ENV_KEY}=1`, `${STUB_ENV_KEY}=true`);
      expect(dockerEnvValue(drifted, STUB_ENV_KEY)).not.toBe(
        STUB_ENABLED_VALUE,
      );
    });

    it("(b) load-k6.yml 에 secrets 참조 · 실 API key · 외부 endpoint 리터럴이 0 이다", () => {
      const yml = loadYml();
      [
        "${{ secrets.",
        "sk-",
        "api.openai.com",
        "openai.azure.com",
        "https://",
      ].forEach((t) => expect(yml).not.toContain(t));
      // 겨냥 대상은 전부 runner localhost — 외부로 나가는 부하 0(readiness curl 1 + 시나리오 4).
      expect(yml.match(/http:\/\/localhost:3000/g)).toHaveLength(5);
    });

    it("(c) 트리거가 여전히 workflow_dispatch 단독이다(상시 PR CI 오염 0)", () => {
      const triggers = triggerSection(loadYml());
      expect(triggers).toContain("workflow_dispatch:");
      ["pull_request:", "push:", "schedule:"].forEach((t) =>
        expect(triggers).not.toContain(t),
      );
      // ci.yml 로 S1 실행이 새지 않는다(read only).
      const ci = readFileSync(CI_YML_PATH, "utf8");
      [S1_SCRIPT_REL, "test:load:s1", S1_RUN_STEP_NAME].forEach((t) =>
        expect(ci).not.toContain(t),
      );
    });

    it("(d) package.json 에 k6 dependency 편입 0(ADR-0054 정적 바이너리 규약)", () => {
      const p = pkg();
      const deps = Object.keys({ ...p.dependencies, ...p.devDependencies });
      ["k6", "@types/k6", "xk6"].forEach((n) => expect(deps).not.toContain(n));
      // load script 는 4 종뿐 — 다른 script 가 함께 바뀌지 않았다.
      expect(
        Object.keys(p.scripts).filter((k) => k.startsWith("test:load")),
      ).toEqual(["test:load", "test:load:s1", "test:load:s2", "test:load:s3"]);
    });

    it("(e) S1 step 에 if: / continue-on-error 우회 flag 가 없다", () => {
      const block = extractStepBlock(loadYml(), S1_RUN_STEP_NAME) as string[];
      expect(extractKey(block, "if")).toBeNull();
      expect(extractKey(block, "continue-on-error")).toBeNull();
      // 정리 step 만 always() 를 갖는다(teardown 규약 불변).
      expect(
        extractKey(
          extractStepBlock(loadYml(), TEARDOWN_STEP_NAME) as string[],
          "if",
        ),
      ).toBe("always()");
    });

    it("(f) S1 step 의 run 이 k6 run 단일 커맨드이고 다른 스크립트를 함께 부르지 않는다", () => {
      const run = extractStep(loadYml(), S1_RUN_STEP_NAME).run as string;
      expect(scriptPathOf(run)).toBe(S1_SCRIPT_REL);
      ["&&", ";", "|", S2_SCRIPT_REL, S3_SCRIPT_REL, LOAD_SCRIPT_REL].forEach(
        (t) => expect(run).not.toContain(t),
      );
      // 체이닝 합성 mutation — 단일 커맨드 정규형이 깨지면 경로를 추측하지 않는다.
      expect(scriptPathOf(`${run} && k6 run ${S2_SCRIPT_REL}`)).toBeNull();
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// T-1634 — S1/S2 부하 스크립트의 표본 인원 __ENV 파싱 방어 drift.
// 존재 이유 — 인원 env 가 비수치(오타 · 단위 접미사 · 공백)면 옛 표현은 NaN 을 내고, 그 NaN 이
// S1 의 BATCH_P95_MS 산식을 타고 `p(95)<NaN` 임계로 굳어 run 이 통째로 깨진다. S2 는 seed 인원이
// NaN 이 되어 0 행 위에서 p95 를 통과하는 착시를 만든다. 정규화 표현은 실행 없이는 회귀를 알 수
// 없으므로 문자열 형태를 정적으로 고정한다. 새 helper 0 — 위 extractEnvFallback 공유.
//      🔥 실 GitHub Actions 발화 0 · 실 k6 실행 0 · 실 docker 실행 0 · 실 HTTP 0 · YAML 파서 0 ·
//         새 dependency 0 · DB 의존 0 · process.env 읽기/쓰기 0 — 파일 read + 합성 문자열 주입만.

/** 본 spec 자신의 경로 — 외부 프로세스 호출 0 을 자기 소스로 단언한다. */
const SELF_SPEC_REL =
  "test/smoke/load-workflow-k6-harness-wiring-drift.smoke-spec.ts";

/** 정규화 표현 정규형 — `Math.max(1, Math.trunc(Number(__ENV.<key>)) || <기본값>)`. */
const normalizedPersonsExpr = (envKey: string, fallback: string): RegExp =>
  new RegExp(
    `Math\\.max\\(\\s*1,\\s*Math\\.trunc\\(Number\\(__ENV\\.${envKey}\\)\\)\\s*\\|\\|\\s*${fallback},?\\s*\\)`,
  );

describe("test/load S1·S2 표본 인원 __ENV 파싱 방어 drift smoke (T-1634)", () => {
  describe("Happy-path: 정규화 표현 · 기본값 parity · 머리 주석 doc-sync", () => {
    it("s1-batch.js 의 SAMPLE_PERSONS 가 정규화 표현이고 기본값 10 이 workflow 주입값과 parity 다", () => {
      const script = s1Script();
      expect(script).toMatch(normalizedPersonsExpr(S1_PERSONS_ENV_KEY, "10"));
      // 기본값은 리터럴로 굳히지 않고 스크립트에서 뽑아 workflow 주입값과 대조한다.
      // T-1640 — 주입값은 dispatch input 표현식이라 선언된 default 로 해석해 비교한다.
      const declared = extractEnvFallback(script, S1_PERSONS_ENV_KEY) as string;
      const block = extractStepBlock(loadYml(), S1_RUN_STEP_NAME) as string[];
      expect(
        resolveInputExpr(
          loadYml(),
          extractKey(block, S1_PERSONS_ENV_KEY) as string,
        ),
      ).toBe(declared);
    });

    it("s2-read.js 의 SEED_PERSONS 가 정규화 표현이고 기본값 30 이 workflow 주입값과 parity 다", () => {
      // T-1672 로 이 값의 *의미*는 "생성할 person 수" → "조회 결과에서 취할 표본 상한" 으로
      // 바뀌었다. 그럼에도 정규화 표현 · 기본값 30 · workflow 주입 parity 는 무변경이므로
      // 단언 표현도 그대로 둔다(설계 ③ · ④ (d) — 숫자 상향은 S2 첫 실측 이후 별도 판단).
      const script = s2Script();
      expect(script).toMatch(normalizedPersonsExpr(SEED_ENV_KEY, "30"));
      const declared = extractEnvFallback(script, SEED_ENV_KEY) as string;
      const block = extractStepBlock(loadYml(), S2_RUN_STEP_NAME) as string[];
      expect(extractKey(block, SEED_ENV_KEY)).toBe(declared);
    });

    it("두 선언 위 주석이 '정규화' 의도와 '임계 무변경' 을 한국어로 남긴다", () => {
      [s1Script(), s2Script()].forEach((script) => {
        expect(script).toContain("정규화");
        expect(script).toContain("무변경");
      });
    });

    it("s1-batch.js 머리 주석의 '범위 밖' 문단이 load-k6.yml · package.json 을 후속으로 적지 않는다", () => {
      const scope = s1Script()
        .split("\n")
        .find((l) => l.startsWith("// 범위 밖(후속 slice):")) as string;
      expect(scope).toBeDefined();
      ["load-k6.yml", "package.json", "script"].forEach((t) =>
        expect(scope).not.toContain(t),
      );
      // 남는 3 항목은 ADR-0057 ## 범위 밖 잔여와 같다.
      ["133명 full seed", "baseline", "분해 지표"].forEach((t) =>
        expect(scope).toContain(t),
      );
    });
  });

  describe("Error path: extractEnvFallback 계약 — non-string throw · 대상 부재 null", () => {
    it("non-string source·envKey 는 TypeError (0-byte read false-PASS 차단)", () => {
      expect(() =>
        extractEnvFallback(undefined as unknown as string, "K6_X"),
      ).toThrow(TypeError);
      expect(() =>
        extractEnvFallback("const a = 1;", 7 as unknown as string),
      ).toThrow(TypeError);
      expect(() =>
        extractEnvFallback(null as unknown as string, "K6_X"),
      ).toThrow(/string 이어야 함/);
    });

    it("대상 env 키가 없으면 null 정규형(추측 0)", () => {
      expect(extractEnvFallback("const a = 1;", "K6_ABSENT")).toBeNull();
      // 키는 있으나 숫자 fallback 이 없으면(문자열 기본값) 역시 null.
      expect(
        extractEnvFallback(
          'const u = __ENV.K6_BASE_URL || "http://x";',
          "K6_BASE_URL",
        ),
      ).toBeNull();
    });
  });

  describe("flow / 분기 cover — 패턴 발견/미발견 · Number() 안쪽/바깥 형태", () => {
    it("helper 의 두 갈래: 발견 시 리터럴 문자열 · 미발견 시 null", () => {
      expect(
        extractEnvFallback("const n = Number(__ENV.K6_P) || 42;", "K6_P"),
      ).toBe("42");
      expect(
        extractEnvFallback("const n = Number(__ENV.K6_Q) || 42;", "K6_P"),
      ).toBeNull();
    });

    it("옛 표현(Number 안쪽 ||) · 새 표현(Number 바깥 ||) 양쪽에서 같은 정규형을 뽑는다", () => {
      const legacy = "const n = Number(__ENV.K6_P || 10);";
      const hardened =
        "const n = Math.max(1, Math.trunc(Number(__ENV.K6_P)) || 10);";
      expect(extractEnvFallback(legacy, "K6_P")).toBe("10");
      expect(extractEnvFallback(hardened, "K6_P")).toBe("10");
      // 표현 형태가 바뀌어도 parity 대조력이 유지된다 — 두 형태의 추출 결과가 동일.
      expect(extractEnvFallback(legacy, "K6_P")).toBe(
        extractEnvFallback(hardened, "K6_P"),
      );
    });
  });

  describe("Negative: 옛 취약 표현 잔존 0 · 분기 0 · 기본값/상수 무변경 · 실행 0", () => {
    it("① s1-batch.js 에 옛 취약 표현 Number(__ENV.K6_S1_PERSONS || 10) 이 남아 있지 않다", () => {
      expect(s1Script()).not.toContain("Number(__ENV.K6_S1_PERSONS || 10)");
    });

    it("② s2-read.js 에 옛 취약 표현 Number(__ENV.K6_SEED_PERSONS || 30) 이 남아 있지 않다", () => {
      expect(s2Script()).not.toContain("Number(__ENV.K6_SEED_PERSONS || 30)");
    });

    it("③ 두 스크립트에 if( · 삼항 ? 조건 분기가 새로 들어오지 않는다(분기 0 규약)", () => {
      [s1Script(), s2Script()].forEach((script) => {
        const code = script
          .split("\n")
          .filter((l) => !l.trim().startsWith("//"))
          .join("\n");
        expect(code).not.toMatch(/\bif\s*\(/);
        expect(code).not.toContain("?");
      });
    });

    it("④ 기본값이 0 · 음수 리터럴로 바뀌지 않는다", () => {
      const s1 = extractEnvFallback(s1Script(), S1_PERSONS_ENV_KEY) as string;
      const s2 = extractEnvFallback(s2Script(), SEED_ENV_KEY) as string;
      [s1, s2].forEach((v) => expect(Number(v)).toBeGreaterThan(0));
      [s1Script(), s2Script()].forEach((script) => {
        expect(script).not.toMatch(/\|\|\s*-?0\b/);
        expect(script).not.toMatch(/\|\|\s*-\d/);
      });
    });

    it("⑤ S1 임계 산식 상수(133 · 3600000)와 산식 형태가 무변경이다", () => {
      const script = s1Script();
      expect(script).toContain("const EXTRAPOLATION_PERSONS = 133;");
      expect(script).toContain("const FULL_RUN_BUDGET_MS = 3600000;");
      expect(script).toMatch(
        /BATCH_P95_MS = Math\.round\(\s*FULL_RUN_BUDGET_MS \* \(SAMPLE_PERSONS \/ EXTRAPOLATION_PERSONS\),?\s*\)/,
      );
    });

    it("⑥ 본 spec 은 실 HTTP · 실 k6 · 실 docker 실행 0 — 파일 read + 합성 문자열만", () => {
      const imports = readFileSync(path.join(REPO_ROOT, SELF_SPEC_REL), "utf8")
        .split("\n")
        .filter((l) => l.startsWith("import "));
      expect(imports.length).toBeGreaterThan(0);
      // import 는 파일 read 계열(fs · path) 뿐 — child_process · http client 편입 0.
      imports.forEach((l) => expect(l).toMatch(/from "(node:)?(fs|path)";$/));
      // 합성 문자열만으로도 helper 가 동작한다 = 외부 프로세스 · 네트워크 의존 0.
      expect(extractEnvFallback("Number(__ENV.K6_Z) || 1", "K6_Z")).toBe("1");
      expect(extractEnvFallback("", "K6_Z")).toBeNull();
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// T-1636 — S1 실측 회수 배선(`--summary-export` + `$GITHUB_STEP_SUMMARY` 기록 step) drift.
// 존재 이유 — S1 결과가 stdout 으로만 흐르면 run log 안에서 사라져 baseline(계획 §5 item 5) 을
// 잡을 수 없고, 같은 문서 §3 의 "환경 메타를 함께 기록해 비교 가능하게" 요구도 미충족이다. 이
// 배선은 순전히 문자열 parity(생성 경로 ↔ 소비 경로 · append 연산자 · step 순서)라 실 run 없이는
// 회귀를 알 수 없어 정적으로 고정한다. 새 helper 1(summaryExportPathOf) — 나머지는 위 공유.
//      🔥 실 GitHub Actions 발화 0 · 실 k6 실행 0 · 실 docker 실행 0 · 새 dependency 0 ·
//         process.env 읽기/쓰기 0 — 파일 read + 합성 문자열 주입만.

/** S1 실측 기록 step 이름 — 생성(S1 run) ↔ 소비(본 step) 문자열 parity 의 한쪽 끝. */
const S1_SUMMARY_STEP_NAME = "S1 실측 요약 기록";
/** 기록 step 이 요약을 append 하는 GitHub 제공 파일 경로 env. */
const STEP_SUMMARY_ENV = "$GITHUB_STEP_SUMMARY";

/**
 * `k6 run --summary-export=<path> ...` 에서 export 경로만 뽑는다. flag 부재면 null(추측 0).
 * @throws {TypeError} command 가 string·null 이 아닐 때(위 helper 들과 동형 계약).
 */
function summaryExportPathOf(command: string | null): string | null {
  if (command !== null && typeof command !== "string") {
    throw new TypeError(
      "summaryExportPathOf: command 는 string | null 이어야 함",
    );
  }
  const m = command === null ? null : command.match(/--summary-export=(\S+)/);
  return m ? unquote(m[1]) : null;
}

/** 기록 step script 의 `summary_file=<path>` 대입에서 소비 경로를 뽑는다. 부재면 null. */
function summaryFileVarOf(script: string): string | null {
  const m = script.match(/^\s*summary_file=(\S+)$/m);
  return m ? unquote(m[1]) : null;
}

/** 기록 step 블록 전문(개행 결합) — 대상 부재면 빈 문자열(추측 0). */
const summaryStepText = (): string =>
  (extractStepBlock(loadYml(), S1_SUMMARY_STEP_NAME) ?? []).join("\n");

describe("load-k6.yml S1 summary export ↔ 실측 기록 step 배선 drift smoke (T-1636)", () => {
  describe("Happy-path: export flag · 경로 parity · always() · step 순서 · 메타 적재", () => {
    it("(a) S1 step run 이 --summary-export 를 달고 그 경로가 기록 step 참조 경로와 동일 문자열이다", () => {
      const run = extractStep(loadYml(), S1_RUN_STEP_NAME).run as string;
      const exported = summaryExportPathOf(run) as string;
      expect(exported).not.toBeNull();
      expect(summaryFileVarOf(summaryStepText())).toBe(exported);
      // 스크립트 경로 parity 는 회귀 0 — flag 가 붙어도 겨냥 대상은 s1-batch.js 그대로다.
      expect(scriptPathOf(run)).toBe(S1_SCRIPT_REL);
    });

    it("(b) 기록 step 이 실재하고 if: always() 이며 S1 step 뒤에 온다", () => {
      const yml = loadYml();
      const block = extractStepBlock(yml, S1_SUMMARY_STEP_NAME) as string[];
      expect(block).not.toBeNull();
      expect(extractKey(block, "if")).toBe("always()");
      // 임계 위반으로 k6 가 exit 1 이어도 수치가 남아야 baseline 을 잡을 수 있다.
      expect(stepIndexOf(yml, S1_SUMMARY_STEP_NAME)).toBeGreaterThan(
        stepIndexOf(yml, S1_RUN_STEP_NAME),
      );
    });

    it("(c) 기록 step 이 환경 메타 · 표본 인원 · summary JSON 전문을 요약에 싣는다", () => {
      const text = summaryStepText();
      // 계획 §3 의 환경 고정 요구 — 커널 · 아키텍처 · vCPU · 메모리 · image 태그 2 종.
      [
        "uname -sr",
        "uname -m",
        "nproc",
        "free -h",
        "postgres:16-alpine",
        "assessment-agent:load",
        "${K6_S1_PERSONS}",
        "```json",
        'cat "$summary_file"',
      ].forEach((fragment) => expect(text).toContain(fragment));
    });
  });

  describe("Error path: append 연산자 · 경로 등장 횟수 · helper 계약", () => {
    it("(a) $GITHUB_STEP_SUMMARY 참조가 전부 >> append 이고 > 덮어쓰기가 0 이다", () => {
      const parts = summaryStepText().split(STEP_SUMMARY_ENV);
      // 3 회 참조(환경 메타 · JSON 전문 · 부재 메시지) — 앞 step 요약을 지우는 회귀 차단.
      expect(parts).toHaveLength(4);
      // T-1638 — append 경로가 `>> "..."` 에서 `| tee -a "..."` 로 바뀌었다. 둘 다 append 의미라
      // 본 단언의 취지(덮어쓰기 형태 0)는 그대로 두고 허용 형태만 두 갈래로 넓힌다.
      parts
        .slice(0, -1)
        .forEach((p) => expect(/(?:>>|tee -a) "$/.test(p)).toBe(true));
      expect(summaryStepText()).not.toMatch(
        /(^|[^>])>\s*"?\$GITHUB_STEP_SUMMARY/,
      );
    });

    it("(b) export 경로가 workflow 안에서 생성·소비 2 곳에만 등장한다", () => {
      const yml = loadYml();
      const exported = summaryExportPathOf(
        extractStep(yml, S1_RUN_STEP_NAME).run,
      ) as string;
      expect(yml.split(exported)).toHaveLength(3);
    });

    it("(c) summaryExportPathOf 계약 — non-string throw · flag 부재 null", () => {
      [42, {}, [], undefined].forEach((v) =>
        expect(() => summaryExportPathOf(v as unknown as string)).toThrow(
          TypeError,
        ),
      );
      expect(summaryExportPathOf(null)).toBeNull();
      expect(summaryExportPathOf(`k6 run ${S1_SCRIPT_REL}`)).toBeNull();
      expect(summaryFileVarOf("")).toBeNull();
    });
  });

  describe("flow / 분기 cover — 요약 파일 존재 / 부재 두 갈래", () => {
    it("(a) 존재 분기가 파일 본문을 fenced block 으로 적재한다", () => {
      const text = summaryStepText();
      expect(text).toContain('if [ -f "$summary_file" ]; then');
      expect(text).toContain('cat "$summary_file"');
    });

    it("(b) 부재 분기가 fail 없이 '요약 파일 없음' 을 명시한다", () => {
      const text = summaryStepText();
      expect(text).toContain("else");
      expect(text).toContain("요약 파일 없음");
      // 부재를 error 로 승격하지 않는다 — exit / ::error:: 로 step 을 깨지 않아야 한다.
      expect(text).not.toContain("exit 1");
      expect(text).not.toContain("::error::");
    });
  });

  describe("negative cases 충분 cover — jq 파싱 · 인원 parity · 순서 · 경로 위치 · secret", () => {
    it("① 기록 step 에 jq 등 schema 의존 파싱 로직이 없다", () => {
      const text = summaryStepText();
      ["jq ", "jq.", "python", "node -e", "grep ", "sed "].forEach((t) =>
        expect(text).not.toContain(t),
      );
    });

    it("② S1 step · 기록 step 의 K6_S1_PERSONS 가 s1-batch.js __ENV 기본값과 여전히 동일하다", () => {
      const declared = extractEnvFallback(
        s1Script(),
        S1_PERSONS_ENV_KEY,
      ) as string;
      const yml = loadYml();
      // T-1640 — 두 step 모두 dispatch input 표현식을 가리키므로 선언된 default 로 해석해 대조한다.
      [S1_RUN_STEP_NAME, S1_SUMMARY_STEP_NAME].forEach((name) =>
        expect(
          resolveInputExpr(
            yml,
            extractKey(
              extractStepBlock(yml, name) as string[],
              S1_PERSONS_ENV_KEY,
            ) as string,
          ),
        ).toBe(declared),
      );
    });

    it("③ 기록 step 이 S2 · S3 step 보다 앞에 온다(뒤 시나리오 실패에 가려지지 않음)", () => {
      const yml = loadYml();
      const recIdx = stepIndexOf(yml, S1_SUMMARY_STEP_NAME);
      expect(recIdx).toBeGreaterThan(0);
      [S2_RUN_STEP_NAME, S3_RUN_STEP_NAME, TEARDOWN_STEP_NAME].forEach((n) =>
        expect(stepIndexOf(yml, n)).toBeGreaterThan(recIdx),
      );
    });

    it("④ export 경로가 test/load/ 밑이 아니다(스크립트 디렉토리 오염 0)", () => {
      const exported = summaryExportPathOf(
        extractStep(loadYml(), S1_RUN_STEP_NAME).run,
      ) as string;
      expect(exported.startsWith("test/load/")).toBe(false);
      expect(exported).not.toContain("..");
      expect(exported.endsWith(".json")).toBe(true);
      // 실 스크립트 4 종 경로와 충돌하지 않는다.
      [LOAD_SCRIPT_REL, S1_SCRIPT_REL, S2_SCRIPT_REL, S3_SCRIPT_REL].forEach(
        (p) => expect(exported).not.toBe(p),
      );
    });

    it("⑤ 기록 step 이 secret / credential 리터럴을 요약에 싣지 않는다", () => {
      const text = summaryStepText();
      [
        "AUTH_JWT_SECRET",
        ENC_KEY_ENV,
        "ci_load_secret",
        "ci_smoke",
        "DATABASE_URL",
        "${{ secrets.",
        "docker logs",
      ].forEach((t) => expect(text).not.toContain(t));
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// T-1638 — S1 실측 기록 step 의 환경 메타·요약을 job 로그(stdout) 에도 남기는 배선 drift.
// 존재 이유 — 같은 블록이 step summary 파일로만 흐르면 사람이 run 페이지를 열어야만 읽혀, REST
// API 로 메타를 회수해 run 간 비교(load-resilience-test-plan.md §3) 를 자동화할 수 없다. T-1637
// 의 첫 실측(run 32459501970) 이 그 회수 실패를 실증했다. 본 배선은 순전히 문자열(단일 출력을
// 두 목적지로 가르는 `tee -a`)이라 실 run 없이는 회귀를 알 수 없어 정적으로 고정한다.
// 새 helper 1(teeAppendTargetsOf) — 나머지는 위 공유.
//      🔥 실 GitHub Actions 발화 0 · 실 k6 실행 0 · 실 docker 실행 0 · 새 dependency 0 ·
//         process.env 읽기/쓰기 0 — 파일 read + 합성 문자열 주입만.

/** 기록 step 이 실어야 하는 환경 메타 7 항목 — 늘리지도 줄이지도 않는다(본 slice 는 경로만 변경). */
const S1_META_FRAGMENTS = [
  "uname -sr",
  "uname -m",
  "nproc",
  "free -h",
  "postgres:16-alpine",
  "assessment-agent:load",
  "${K6_S1_PERSONS}",
];

/**
 * script 안 `| tee -a <target>` 의 append 대상들을 등장 순서대로 뽑는다. 부재면 빈 배열(추측 0).
 * @throws {TypeError} script 가 string 이 아닐 때(위 helper 들과 동형 계약 — 0-byte false-PASS 방지).
 */
function teeAppendTargetsOf(script: string): string[] {
  if (typeof script !== "string") {
    throw new TypeError("teeAppendTargetsOf: script 는 string 이어야 함");
  }
  return [...script.matchAll(/\|\s*tee\s+-a\s+(\S+)/g)].map((m) =>
    unquote(m[1]),
  );
}

/** 기록 step script 를 요약 파일 존재 / 부재 두 갈래로 자른다(경계 부재면 빈 문자열 쌍). */
function summaryBranches(): { present: string; absent: string } {
  const text = summaryStepText();
  const ifIdx = text.indexOf('if [ -f "$summary_file" ]; then');
  const elseIdx = text.indexOf("\n          else\n");
  return ifIdx < 0 || elseIdx < 0
    ? { present: "", absent: "" }
    : {
        present: text.slice(ifIdx, elseIdx),
        absent: text.slice(elseIdx),
      };
}

describe("load-k6.yml S1 실측 기록 step 의 stdout 회수 배선 drift smoke (T-1638)", () => {
  describe("Happy-path: tee 경유 이중 목적지 · 메타 7 항목 불변 · always()/순서", () => {
    it("(a) 기록 step 의 append 3 회가 모두 tee 를 경유해 step summary 로 간다", () => {
      const targets = teeAppendTargetsOf(summaryStepText());
      // 환경 메타 · JSON 전문 · 부재 메시지 3 갈래 전부가 stdout 과 summary 로 갈라져야 한다.
      expect(targets).toEqual([
        STEP_SUMMARY_ENV,
        STEP_SUMMARY_ENV,
        STEP_SUMMARY_ENV,
      ]);
    });

    it("(b) 환경 메타 7 항목이 여전히 모두 기록 step 안에 있다(집합 불변)", () => {
      const text = summaryStepText();
      S1_META_FRAGMENTS.forEach((f) => expect(text).toContain(f));
      expect(S1_META_FRAGMENTS).toHaveLength(7);
    });

    it("(c) 기록 step 이 여전히 if: always() 이고 S1 실행 step 뒤에 온다", () => {
      const yml = loadYml();
      const block = extractStepBlock(yml, S1_SUMMARY_STEP_NAME) as string[];
      expect(extractKey(block, "if")).toBe("always()");
      expect(stepIndexOf(yml, S1_SUMMARY_STEP_NAME)).toBeGreaterThan(
        stepIndexOf(yml, S1_RUN_STEP_NAME),
      );
    });
  });

  describe("Error path: -a 없는 tee · 단일 리다이렉트 · 부재 분기 fail 승격", () => {
    it("(a) `-a` 없는 tee 사용이 0 이다(summary 덮어쓰기 회귀 차단)", () => {
      expect(summaryStepText()).not.toMatch(/tee\s+(?!-a\s)/);
    });

    it("(b) step summary 를 `>` 단일 리다이렉트로 여는 표현이 0 이다", () => {
      expect(summaryStepText()).not.toMatch(
        /(^|[^>])>\s*"?\$GITHUB_STEP_SUMMARY/,
      );
    });

    it("(c) 요약 파일 부재를 여전히 fail 로 승격하지 않는다(부재 분기 생존)", () => {
      const text = summaryStepText();
      expect(text).toContain("요약 파일 없음");
      expect(text).not.toContain("exit 1");
      expect(text).not.toContain("::error::");
    });

    it("(d) teeAppendTargetsOf 계약 — non-string throw · tee 부재 빈 배열", () => {
      [42, {}, [], undefined, null].forEach((v) =>
        expect(() => teeAppendTargetsOf(v as unknown as string)).toThrow(
          TypeError,
        ),
      );
      expect(teeAppendTargetsOf("")).toEqual([]);
      expect(teeAppendTargetsOf('echo x >> "$GITHUB_STEP_SUMMARY"')).toEqual(
        [],
      );
      expect(teeAppendTargetsOf('echo x | tee -a "/tmp/a"')).toEqual([
        "/tmp/a",
      ]);
    });
  });

  describe("flow / 분기 cover — 존재 / 부재 두 갈래 모두 stdout 으로도 나간다", () => {
    it("(a) 존재 분기의 JSON 전문이 tee 를 경유한다", () => {
      const { present } = summaryBranches();
      expect(present).toContain('cat "$summary_file"');
      expect(teeAppendTargetsOf(present)).toEqual([STEP_SUMMARY_ENV]);
    });

    it("(b) 부재 분기의 안내 문구가 tee 를 경유한다", () => {
      const { absent } = summaryBranches();
      expect(absent).toContain("요약 파일 없음");
      expect(teeAppendTargetsOf(absent)).toEqual([STEP_SUMMARY_ENV]);
    });
  });

  describe("negative cases 충분 cover — 복제 · jq · 인원 parity · secret · 타 step 무변경", () => {
    it("① 메타 블록이 script 안에 복제돼 있지 않다(각 항목 등장 1 회)", () => {
      const text = summaryStepText();
      S1_META_FRAGMENTS.forEach((f) => expect(text.split(f)).toHaveLength(2));
    });

    it("② jq 등 schema 의존 파싱 로직이 새로 유입되지 않았다(T-1636 계약 유지)", () => {
      const text = summaryStepText();
      ["jq ", "jq.", "python", "node -e", "grep ", "sed "].forEach((t) =>
        expect(text).not.toContain(t),
      );
    });

    it("③ 기록 step 의 K6_S1_PERSONS 가 s1-batch.js __ENV 기본값과 여전히 parity 다", () => {
      const declared = extractEnvFallback(s1Script(), S1_PERSONS_ENV_KEY);
      expect(declared).not.toBeNull();
      // T-1640 — 기록 step 주입값도 input 표현식이라 선언된 default 로 해석해 비교한다.
      expect(
        resolveInputExpr(
          loadYml(),
          extractKey(
            extractStepBlock(loadYml(), S1_SUMMARY_STEP_NAME) as string[],
            S1_PERSONS_ENV_KEY,
          ) as string,
        ),
      ).toBe(declared);
    });

    it("④ 로그 공개 범위가 넓어져도 secret 리터럴을 출력하지 않는다", () => {
      const text = summaryStepText();
      [
        "AUTH_JWT_SECRET",
        ENC_KEY_ENV,
        "ci_load_secret",
        "ci_smoke",
        "DATABASE_URL",
        "${{ secrets.",
        "docker logs",
      ].forEach((t) => expect(text).not.toContain(t));
    });

    it("⑤ S2 · S3 · 정리 step 의 run 본문은 본 slice 가 건드리지 않았다", () => {
      const yml = loadYml();
      expect(extractStep(yml, S2_RUN_STEP_NAME).run).toBe(
        `k6 run ${S2_SCRIPT_REL}`,
      );
      expect(extractStep(yml, S3_RUN_STEP_NAME).run).toBe(
        `k6 run ${S3_SCRIPT_REL}`,
      );
      const teardown = (
        extractStepBlock(yml, TEARDOWN_STEP_NAME) as string[]
      ).join("\n");
      expect(teardown).toContain("docker rm -f aa-load || true");
      [STEP_SUMMARY_ENV, "tee"].forEach((t) =>
        expect(teardown).not.toContain(t),
      );
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// T-1640 — S1 표본 인원을 `workflow_dispatch` input 으로 파라미터화한 배선 drift.
// 존재 이유 — 표본 인원이 workflow 안 리터럴로 굳어 있으면 실 scale(133 명) 실측과 같은 조건의
// 반복 run(load-resilience-test-plan.md §5 item 5 잔여 ①·②) 마다 pr-mode slice 가 필요해진다.
// 파라미터화 자체는 순전히 문자열 배선이라 실 dispatch 없이는 회귀를 알 수 없고, 특히 두 step
// (실행 · 기록) 중 한쪽만 리터럴로 남으면 기록이 실 표본과 어긋난 채로 CI 는 green 이다.
// 새 helper 1(resolveInputExpr) — 나머지는 위 공유.
//      🔥 실 GitHub Actions 발화 0 · 실 dispatch 0 · 실 k6 실행 0 · YAML 파서 0 ·
//         새 dependency 0 · process.env 읽기/쓰기 0 — 파일 read + 합성 문자열 주입만.

/** 표본 인원 dispatch input 의 이름과 step env 가 가리켜야 하는 표현식 정본. */
const S1_PERSONS_INPUT_NAME = "s1_persons";
const S1_PERSONS_INPUT_EXPR = `\${{ inputs.${S1_PERSONS_INPUT_NAME} }}`;

describe("load-k6.yml S1 표본 인원 workflow_dispatch input 파라미터화 drift smoke (T-1640)", () => {
  describe("Happy-path: input 선언 · default parity · 두 step 동일 표현식", () => {
    it("① workflow_dispatch 가 s1_persons input 1 개를 갖고 그 default 가 스크립트 __ENV 기본값과 같다", () => {
      const triggers = triggerSection(loadYml());
      expect(triggers).toContain("inputs:");
      expect(triggers).toContain(`${S1_PERSONS_INPUT_NAME}:`);
      // input 은 정확히 1 개 — description / default 등장 횟수로 증식을 막는다.
      expect(triggers.match(/description:/g)).toHaveLength(1);
      expect(triggers.match(/^\s*default:/gm)).toHaveLength(1);
      expect(triggers).toContain("type: string");
      // default 는 리터럴로 굳히지 않고 스크립트 기본값에서 뽑아 대조한다(양쪽 동시 drift 차단).
      expect(resolveInputExpr(loadYml(), S1_PERSONS_INPUT_EXPR)).toBe(
        extractEnvFallback(s1Script(), S1_PERSONS_ENV_KEY),
      );
    });

    it("② S1 실행 step 의 K6_S1_PERSONS 가 그 input 표현식을 가리킨다", () => {
      const block = extractStepBlock(loadYml(), S1_RUN_STEP_NAME) as string[];
      expect(extractKey(block, S1_PERSONS_ENV_KEY)).toBe(S1_PERSONS_INPUT_EXPR);
    });

    it("③ 기록 step 의 K6_S1_PERSONS 도 같은 표현식을 가리킨다(두 곳 문자열 동일)", () => {
      const yml = loadYml();
      const injected = [S1_RUN_STEP_NAME, S1_SUMMARY_STEP_NAME].map((name) =>
        extractKey(extractStepBlock(yml, name) as string[], S1_PERSONS_ENV_KEY),
      );
      expect(injected[1]).toBe(S1_PERSONS_INPUT_EXPR);
      // 한쪽만 바뀌는 형태(회차 간 기록 drift 원인)를 문자열 동일성으로 차단한다.
      expect(injected[0]).toBe(injected[1]);
    });
  });

  describe("Error path: 오타 참조 · non-string throw · 미선언 input null", () => {
    it("① 주입 표현식이 오타난 input 이름을 가리키지 않는다(선언된 이름 집합과 대조)", () => {
      const yml = loadYml();
      // 선언된 이름 집합 — 트리거 섹션에서 default 를 되찾을 수 있는 이름만 유효하다.
      ["s1_person", "s1_persons_", "S1_PERSONS", "persons"].forEach((name) =>
        expect(resolveInputExpr(yml, `\${{ inputs.${name} }}`)).toBeNull(),
      );
      // 실 배선이 가리키는 이름은 그 집합 안에 있어 해석에 성공한다.
      expect(
        resolveInputExpr(
          yml,
          extractKey(
            extractStepBlock(yml, S1_RUN_STEP_NAME) as string[],
            S1_PERSONS_ENV_KEY,
          ) as string,
        ),
      ).not.toBeNull();
    });

    it("② resolveInputExpr 이 non-string 입력에 TypeError 를 던진다(기존 helper 와 동형 계약)", () => {
      expect(() =>
        resolveInputExpr(undefined as unknown as string, "x"),
      ).toThrow(TypeError);
      expect(() =>
        resolveInputExpr("on:\njobs:\n", 7 as unknown as string),
      ).toThrow(TypeError);
      expect(() => resolveInputExpr(null as unknown as string, "x")).toThrow(
        /string 이어야 함/,
      );
    });

    it("③ 선언되지 않은 input 을 조회하면 null 이다(추측 0) — default 누락도 null", () => {
      // 트리거 섹션 자체가 없는 문서.
      expect(resolveInputExpr("name: X\n", S1_PERSONS_INPUT_EXPR)).toBeNull();
      // 이름은 선언됐지만 default 가 없는 형태 — 값을 지어내지 않는다.
      const noDefault =
        "on:\n  workflow_dispatch:\n    inputs:\n      s1_persons:\n        required: false\njobs:\n";
      expect(resolveInputExpr(noDefault, S1_PERSONS_INPUT_EXPR)).toBeNull();
    });
  });

  describe("flow / 분기 cover — input 참조 갈래 · 리터럴 갈래(하위호환)", () => {
    it("(a) 표현식이 input 참조면 선언된 default 로 해석한다(github.event.inputs 형태 포함)", () => {
      const src =
        'on:\n  workflow_dispatch:\n    inputs:\n      s1_persons:\n        default: "42"\njobs:\n';
      expect(resolveInputExpr(src, S1_PERSONS_INPUT_EXPR)).toBe("42");
      expect(
        resolveInputExpr(src, "${{ github.event.inputs.s1_persons }}"),
      ).toBe("42");
      // 감싼 따옴표가 있어도 같은 갈래로 들어간다.
      expect(resolveInputExpr(src, `"${S1_PERSONS_INPUT_EXPR}"`)).toBe("42");
    });

    it("(b) 표현식이 리터럴이면 값 그대로 돌려준다(파라미터화 이전 형태 하위호환)", () => {
      const legacy =
        'on:\n  workflow_dispatch:\njobs:\n  load:\n    steps:\n      - name: x\n        env:\n          K6_S1_PERSONS: "10"\n        run: k6 run test/load/s1-batch.js\n';
      const block = extractStepBlock(legacy, "x") as string[];
      expect(
        resolveInputExpr(
          legacy,
          extractKey(block, S1_PERSONS_ENV_KEY) as string,
        ),
      ).toBe("10");
      // 리터럴 갈래는 트리거 섹션 유무와 무관하다.
      expect(resolveInputExpr("name: X\n", "133")).toBe("133");
    });
  });

  describe("negative cases 충분 cover — 무인자 dispatch · default 형태 · 트리거 · 순서 · 리터럴 잔재", () => {
    it("① input 이 required: true 가 아니다(무인자 dispatch 가 그대로 동작)", () => {
      const triggers = triggerSection(loadYml());
      expect(triggers).toContain("required: false");
      expect(triggers).not.toMatch(/required:\s*true/);
    });

    it("② default 가 비어 있거나 숫자 아닌 문자열이 아니다", () => {
      const d = resolveInputExpr(loadYml(), S1_PERSONS_INPUT_EXPR) as string;
      expect(d).not.toBeNull();
      expect(d.trim()).not.toBe("");
      expect(d).toMatch(/^\d+$/);
      expect(Number(d)).toBeGreaterThan(0);
    });

    it("③ input 신설이 pull_request · push · schedule 트리거 유입을 동반하지 않는다", () => {
      const triggers = triggerSection(loadYml());
      expect(triggers).toContain("workflow_dispatch:");
      ["pull_request:", "push:", "schedule:"].forEach((t) =>
        expect(triggers).not.toContain(t),
      );
    });

    it("④ 기록 step 이 여전히 if: always() 이고 S1 step 뒤에 온다(T-1636/T-1638 회귀 0)", () => {
      const yml = loadYml();
      const block = extractStepBlock(yml, S1_SUMMARY_STEP_NAME) as string[];
      expect(extractKey(block, "if")).toBe("always()");
      expect(stepIndexOf(yml, S1_SUMMARY_STEP_NAME)).toBeGreaterThan(
        stepIndexOf(yml, S1_RUN_STEP_NAME),
      );
    });

    it("⑤ 기록 step 의 메타 7 항목과 tee -a append 배선이 그대로다(T-1638 회귀 0)", () => {
      const text = summaryStepText();
      S1_META_FRAGMENTS.forEach((f) => expect(text).toContain(f));
      expect(S1_META_FRAGMENTS).toHaveLength(7);
      // append 3 갈래(환경 메타 · JSON 전문 · 부재 메시지) 전부가 tee 로 stdout 과 갈라진다.
      expect(teeAppendTargetsOf(text)).toEqual([
        STEP_SUMMARY_ENV,
        STEP_SUMMARY_ENV,
        STEP_SUMMARY_ENV,
      ]);
    });

    it("⑥ 두 step 의 env 에 표본 인원 리터럴 10 이 남아 있지 않다(파라미터화 누락 차단)", () => {
      const yml = loadYml();
      [S1_RUN_STEP_NAME, S1_SUMMARY_STEP_NAME].forEach((name) => {
        const injected = extractKey(
          extractStepBlock(yml, name) as string[],
          S1_PERSONS_ENV_KEY,
        ) as string;
        expect(injected).not.toMatch(/^\d+$/);
        expect(injected).toContain("inputs.");
      });
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// T-1659 — seed 실행용 Node/pnpm 툴체인 3 step 배선 drift.
// 존재 이유 — load-k6.yml 에는 Node·pnpm·node_modules 가 없어 다음 slice 의
// `pnpm seed:devset-logins`(133 명 실 dataset seed) 가 그대로는 돌지 않는다. pin 은 ci.yml
// 정본 복제라 두 workflow 가 갈리면 부하 run 만 다른 Node/pnpm 으로 돌고도 상시 CI 는
// green 이다(수동 dispatch 전용이라 아무도 red 를 못 본다). 새 helper 1(ciYml).
//      🔥 실 Actions 발화 0 · 실 install 0 · 실 k6 실행 0 · YAML 파서 0 · 새 dependency 0 ·
//         process.env 읽기/쓰기 0 — 파일 read + 합성 문자열 주입만.

/** 툴체인 step 이름 — ci.yml 정본과 문자 그대로 같아야 한다. */
const PNPM_STEP_NAME = "pnpm 설치";
const NODE_STEP_NAME = "Node.js 설치";
const DEPS_STEP_NAME = "의존성 설치";
/** 복제 대상 pin 정본(ci.yml 의 같은 이름 step). */
const PNPM_ACTION = "pnpm/action-setup@v4";
const NODE_ACTION = "actions/setup-node@v4";
const INSTALL_COMMAND = "pnpm install --frozen-lockfile";
const TOOLCHAIN_STEP_NAMES = [PNPM_STEP_NAME, NODE_STEP_NAME, DEPS_STEP_NAME];

const ciYml = (): string => readFileSync(CI_YML_PATH, "utf8");

describe("load-k6.yml seed 실행용 Node/pnpm 툴체인 step 배선 drift smoke (T-1659)", () => {
  describe("Happy-path: 3 step 실재 · ci.yml parity · 순서", () => {
    it("① 3 step 이 실재하고 uses/version/node-version/cache/run 값이 기대값과 같다", () => {
      const yml = loadYml();
      const pnpmBlock = extractStepBlock(yml, PNPM_STEP_NAME) as string[];
      expect(pnpmBlock).not.toBeNull();
      expect(extractKey(pnpmBlock, "uses")).toBe(PNPM_ACTION);
      expect(extractKey(pnpmBlock, "version")).toBe("9.12.0");

      const nodeBlock = extractStepBlock(yml, NODE_STEP_NAME) as string[];
      expect(nodeBlock).not.toBeNull();
      expect(extractKey(nodeBlock, "uses")).toBe(NODE_ACTION);
      expect(extractKey(nodeBlock, "node-version")).toBe("20");
      expect(extractKey(nodeBlock, "cache")).toBe("pnpm");

      expect(extractStep(yml, DEPS_STEP_NAME)).toEqual({
        found: true,
        uses: null,
        run: INSTALL_COMMAND,
      });
      // 세 step 모두 존재 이유 주석을 갖는다(왜 부하 job 에 툴체인이 필요한지 박제).
      TOOLCHAIN_STEP_NAMES.forEach((name) =>
        expect(
          (extractStepBlock(yml, name) as string[]).some((l) =>
            l.trim().startsWith("#"),
          ),
        ).toBe(true),
      );
    });

    it("② ci.yml 같은 이름 step 과 4 자(pnpm version · node-version · cache · install) parity", () => {
      const yml = loadYml();
      const ci = ciYml();
      const pick = (source: string, step: string, key: string): string | null =>
        extractKey(extractStepBlock(source, step) as string[], key);
      expect(pick(yml, PNPM_STEP_NAME, "version")).toBe(
        pick(ci, PNPM_STEP_NAME, "version"),
      );
      expect(pick(yml, NODE_STEP_NAME, "node-version")).toBe(
        pick(ci, NODE_STEP_NAME, "node-version"),
      );
      expect(pick(yml, NODE_STEP_NAME, "cache")).toBe(
        pick(ci, NODE_STEP_NAME, "cache"),
      );
      expect(pick(yml, DEPS_STEP_NAME, "run")).toBe(
        pick(ci, DEPS_STEP_NAME, "run"),
      );
      // action 참조(@major 핀 포함)도 같은 문자열이어야 한다.
      expect(pick(yml, PNPM_STEP_NAME, "uses")).toBe(
        pick(ci, PNPM_STEP_NAME, "uses"),
      );
      expect(pick(yml, NODE_STEP_NAME, "uses")).toBe(
        pick(ci, NODE_STEP_NAME, "uses"),
      );
    });

    it("③ checkout < pnpm < Node.js < 의존성 < k6 설치 순이고 3 step 전부가 첫 k6 run 보다 앞선다", () => {
      const yml = loadYml();
      const order = [
        "저장소 checkout",
        PNPM_STEP_NAME,
        NODE_STEP_NAME,
        DEPS_STEP_NAME,
        INSTALL_STEP_NAME,
      ].map((n) => stepIndexOf(yml, n));
      expect(order).not.toContain(-1);
      expect([...order].sort((a, b) => a - b)).toEqual(order);
      const firstRun = yml.split("\n").findIndex((l) => l.includes("k6 run "));
      expect(firstRun).toBeGreaterThan(-1);
      TOOLCHAIN_STEP_NAMES.forEach((n) =>
        expect(stepIndexOf(yml, n)).toBeLessThan(firstRun),
      );
      // 툴체인은 docker build 보다도 앞선다(빌드 전에 설치·캐시 복원이 끝나 있어야 한다).
      expect(stepIndexOf(yml, DEPS_STEP_NAME)).toBeLessThan(
        stepIndexOf(yml, BUILD_STEP_NAME),
      );
    });
  });

  describe("Error path: 미발견 정규형 · 부분 drift · non-string throw", () => {
    it("① 세 step 이 없는 합성 YAML 은 throw 없이 미발견 정규형을 돌려준다", () => {
      const stripped = [
        "jobs:",
        "  load:",
        "    steps:",
        "      - name: 저장소 checkout",
        "        uses: actions/checkout@v4",
        "",
      ].join("\n");
      TOOLCHAIN_STEP_NAMES.forEach((name) => {
        expect(extractStepBlock(stripped, name)).toBeNull();
        expect(extractStep(stripped, name)).toEqual({
          found: false,
          uses: null,
          run: null,
        });
        expect(stepIndexOf(stripped, name)).toBe(-1);
      });
    });

    it("② step 은 있으나 대상 key 만 없는 합성 입력도 null 이다(부분 drift 검출)", () => {
      const partial = [
        `      - name: ${NODE_STEP_NAME}`,
        `        uses: ${NODE_ACTION}`,
        "        with:",
        "          cache: 'pnpm'",
        "",
      ].join("\n");
      const block = extractStepBlock(partial, NODE_STEP_NAME) as string[];
      expect(block).not.toBeNull();
      expect(extractKey(block, "cache")).toBe("pnpm");
      // node-version 만 빠진 형태 — 미발견은 추측 없이 null 이다.
      expect(extractKey(block, "node-version")).toBeNull();
      expect(extractStep(partial, NODE_STEP_NAME).run).toBeNull();
    });

    it("③ non-string 입력에 helper 계약대로 TypeError 가 난다", () => {
      expect(() =>
        extractStepBlock(null as unknown as string, PNPM_STEP_NAME),
      ).toThrow(TypeError);
      expect(() =>
        extractStepBlock(loadYml(), 42 as unknown as string),
      ).toThrow(TypeError);
      expect(() =>
        extractStep(undefined as unknown as string, NODE_STEP_NAME),
      ).toThrow(TypeError);
      expect(() => lineIndexOf(loadYml(), {} as unknown as string)).toThrow(
        TypeError,
      );
    });
  });

  describe("분기 cover: 따옴표 정규화 · action step 갈래 vs 커맨드 step 갈래", () => {
    it("① 따옴표가 있는 값과 없는 값을 unquote 가 같은 결과로 정규화한다", () => {
      const quoted = [
        "      - name: X",
        "        with:",
        "          node-version: '20'",
        "",
      ].join("\n");
      const read = (src: string): string | null =>
        extractKey(extractStepBlock(src, "X") as string[], "node-version");
      expect(read(quoted)).toBe("20");
      expect(read(quoted.replace("'20'", "20"))).toBe("20");
      expect(read(quoted.replace("'20'", '"20"'))).toBe("20");
      // 짝이 맞지 않는 따옴표는 벗기지 않는다(정규화가 값을 훼손하지 않음).
      expect(unquote("'20")).toBe("'20");
    });

    it("② uses 만 있는 action step 갈래와 run 만 있는 커맨드 step 갈래", () => {
      const yml = loadYml();
      [PNPM_STEP_NAME, NODE_STEP_NAME].forEach((name) => {
        const s = extractStep(yml, name);
        expect(s.uses).not.toBeNull();
        expect(s.run).toBeNull();
      });
      const deps = extractStep(yml, DEPS_STEP_NAME);
      expect(deps.run).toBe(INSTALL_COMMAND);
      expect(deps.uses).toBeNull();
    });
  });

  describe("negative cases 충분 cover — pin drift · lockfile 우회 · 트리거 · 자격증명", () => {
    it("① 합성 mutation 으로 pnpm version / node-version 을 바꾸면 ci.yml parity 가 깨진다", () => {
      const ci = ciYml();
      const pick = (source: string, step: string, key: string): string | null =>
        extractKey(extractStepBlock(source, step) as string[], key);
      const mutatedPnpm = loadYml().replace(
        "version: 9.12.0",
        "version: 8.15.0",
      );
      expect(pick(mutatedPnpm, PNPM_STEP_NAME, "version")).not.toBe(
        pick(ci, PNPM_STEP_NAME, "version"),
      );
      const mutatedNode = loadYml().replace(
        "node-version: '20'",
        "node-version: '18'",
      );
      expect(pick(mutatedNode, NODE_STEP_NAME, "node-version")).not.toBe(
        pick(ci, NODE_STEP_NAME, "node-version"),
      );
      // 원본은 mutate 되지 않는다(대조군).
      expect(pick(loadYml(), PNPM_STEP_NAME, "version")).toBe("9.12.0");
      expect(pick(loadYml(), NODE_STEP_NAME, "node-version")).toBe("20");
    });

    it("② install 커맨드가 lockfile 우회 flag 없이 --frozen-lockfile 만 쓴다", () => {
      const run = extractStep(loadYml(), DEPS_STEP_NAME).run as string;
      expect(run).toBe(INSTALL_COMMAND);
      expect(run).toContain("--frozen-lockfile");
      ["--no-frozen-lockfile", "--force", "--lockfile-only", "-P "].forEach(
        (flag) => expect(run).not.toContain(flag),
      );
      // 합성 mutation: 우회 flag 가 붙으면 정본 문자열 동일성이 깨진다(대조군).
      expect(`${INSTALL_COMMAND} --no-frozen-lockfile`).not.toBe(
        INSTALL_COMMAND,
      );
    });

    it("③ 툴체인 추가가 pull_request · push · schedule 트리거 유입을 동반하지 않는다(T-1620 계약)", () => {
      const triggers = triggerSection(loadYml());
      expect(triggers).toContain("workflow_dispatch:");
      ["pull_request:", "push:", "schedule:"].forEach((t) =>
        expect(triggers).not.toContain(t),
      );
    });

    it("④ package.json 무변경 — k6 도 pnpm 도 dependency 로 편입되지 않았다(T-1620 계약)", () => {
      const p = pkg();
      ["k6", "pnpm"].forEach((name) => {
        expect(Object.keys(p.dependencies)).not.toContain(name);
        expect(Object.keys(p.devDependencies)).not.toContain(name);
      });
      expect(p.scripts["test:load"]).toBe(`k6 run ${LOAD_SCRIPT_REL}`);
      // pnpm 은 action 이 packageManager 선언대로 깔면 되고 lockfile 에는 들어가지 않는다.
      const declared = extractKey(
        extractStepBlock(loadYml(), PNPM_STEP_NAME) as string[],
        "version",
      );
      expect((p as unknown as Record<string, string>).packageManager).toBe(
        `pnpm@${declared}`,
      );
    });

    it("⑤ 새 step 이 secrets 참조나 자격증명 env 를 주입하지 않는다(CLAUDE.md §9)", () => {
      const yml = loadYml();
      TOOLCHAIN_STEP_NAMES.forEach((name) => {
        const block = (extractStepBlock(yml, name) as string[]).join("\n");
        expect(block).not.toContain("secrets.");
        expect(block).not.toContain("env:");
        expect(block).not.toMatch(/TOKEN|PASSWORD|APIKEY|SECRET/i);
      });
    });

    it("⑥ 기존 step 순서 회귀 0 이고 정리 step 은 여전히 if: always() 다", () => {
      const yml = loadYml();
      const legacy = [
        BUILD_STEP_NAME,
        BOOT_STEP_NAME,
        INSTALL_STEP_NAME,
        RUN_STEP_NAME,
        S1_RUN_STEP_NAME,
        S1_SUMMARY_STEP_NAME,
        S2_RUN_STEP_NAME,
        S3_RUN_STEP_NAME,
        TEARDOWN_STEP_NAME,
      ].map((n) => stepIndexOf(yml, n));
      expect(legacy).not.toContain(-1);
      expect([...legacy].sort((a, b) => a - b)).toEqual(legacy);
      expect(
        extractKey(extractStepBlock(yml, TEARDOWN_STEP_NAME) as string[], "if"),
      ).toBe("always()");
    });
  });
});

// T-1660 — 133 로그인 실 dataset seed 실행 step 배선 drift. 존재 이유 — T-1659 툴체인 위에서도
// seed 를 실제로 부르는 주체가 없으면 부하 run 은 계속 빈 DB 위에서 돈다. 배선은 문자열 3 개
// (step 위치 · `pnpm seed:devset-logins` · docker run 과 같은 DATABASE_URL)에만 의존하는데 이
// workflow 는 수동 dispatch 전용이라 어긋나도 상시 CI 는 green 이다(빈 DB 측정치가 baseline 으로
// 박히는 사고가 조용히 난다). 새 helper 1(envKeysOf) 외 기존 helper 재사용.
//      🔥 실 Actions 발화 0 · 실 seed 실행 0 · 실 DB 연결 0 · YAML 파서 0 · 새 dependency 0.

/** seed 배선 정본 — step 이름 · package.json 키 · 실행 커맨드 · 주입 env 키. */
const SEED_STEP_NAME = "133 로그인 실 dataset seed 적재";
const SEED_SCRIPT_KEY = "seed:devset-logins";
const SEED_RUN_COMMAND = `pnpm ${SEED_SCRIPT_KEY}`;
const SEED_SCRIPT_REL = "scripts/seed-devset-logins.ts";
const DB_URL_ENV_KEY = "DATABASE_URL";

/**
 * step 블록의 `env:` 아래 선언된 키 이름만 뽑는다(더 깊은 들여쓰기가 이어지는 동안 · 주석 행
 * 제외). `env` 부재면 빈 배열 — "선언 0" 이 곧 정답인 자리라 `null` 이 아니라 빈 배열이 정규형.
 * @throws {TypeError} `block` 이 배열이 아닐 때(extractStepBlock 과 동형 계약 — false-PASS 방지).
 */
function envKeysOf(block: string[]): string[] {
  if (!Array.isArray(block)) {
    throw new TypeError("envKeysOf: block 은 string[] 이어야 함");
  }
  const head = block.findIndex((l) => l.trim() === "env:");
  if (head < 0) {
    return [];
  }
  const headIndent = indentOf(block[head]);
  const keys: string[] = [];
  for (let i = head + 1; i < block.length; i += 1) {
    if (block[i].trim() !== "" && indentOf(block[i]) <= headIndent) {
      break;
    }
    const m = block[i].trim().match(/^([A-Za-z_][A-Za-z0-9_]*):/);
    if (m) {
      keys.push(m[1]);
    }
  }
  return keys;
}

/** 부하 대상 기동 step 본문(그 안의 `docker run ... -e KEY=VALUE` 리터럴 대조용). */
const bootText = (source: string): string =>
  (extractStepBlock(source, BOOT_STEP_NAME) as string[]).join("\n");
/** seed step 이 주입하는 env 값(부재면 null). */
const seedEnv = (source: string, key: string): string | null =>
  extractKey(extractStepBlock(source, SEED_STEP_NAME) as string[], key);

describe("load-k6.yml 133 로그인 실 dataset seed 실행 step 배선 drift smoke (T-1660)", () => {
  describe("Happy-path: seed step 실재 · DATABASE_URL parity · 실행 순서", () => {
    it("① seed step 이 실재하고 run 이 pnpm seed:devset-logins 이며 그 키가 package.json 에 있다", () => {
      const yml = loadYml();
      expect(extractStep(yml, SEED_STEP_NAME)).toEqual({
        found: true,
        uses: null,
        run: SEED_RUN_COMMAND,
      });
      // workflow ↔ package.json parity — 키가 실재하고 겨냥한 스크립트 파일도 실재한다.
      expect(pkg().scripts[SEED_SCRIPT_KEY]).toBe(`ts-node ${SEED_SCRIPT_REL}`);
      expect(existsSync(path.join(REPO_ROOT, SEED_SCRIPT_REL))).toBe(true);
      // 존재 이유 주석(boot 이후 · k6 이전 · 더미 자격증명)이 step 안에 남아 있다.
      const comments = (
        extractStepBlock(yml, SEED_STEP_NAME) as string[]
      ).filter((l) => l.trim().startsWith("#"));
      expect(comments.length).toBeGreaterThanOrEqual(2);
      expect(comments.join(" ")).toContain("migrate");
    });

    it("② seed step 의 DATABASE_URL 이 docker run 의 -e DATABASE_URL= 값과 문자열 동일하다", () => {
      const yml = loadYml();
      const declared = dockerEnvValue(bootText(yml), DB_URL_ENV_KEY);
      expect(declared).toContain("localhost:5432");
      expect(seedEnv(yml, DB_URL_ENV_KEY)).toBe(declared);
    });

    it("③ 의존성 설치 < 빌드 < 기동 < seed < k6 설치 순이고 seed 가 세 k6 실행 step 전부보다 앞선다", () => {
      const yml = loadYml();
      const order = [
        DEPS_STEP_NAME,
        BUILD_STEP_NAME,
        BOOT_STEP_NAME,
        SEED_STEP_NAME,
        INSTALL_STEP_NAME,
      ].map((n) => stepIndexOf(yml, n));
      expect(order).not.toContain(-1);
      expect([...order].sort((a, b) => a - b)).toEqual(order);
      const seedIdx = stepIndexOf(yml, SEED_STEP_NAME);
      [
        RUN_STEP_NAME,
        S1_RUN_STEP_NAME,
        S2_RUN_STEP_NAME,
        S3_RUN_STEP_NAME,
      ].forEach((n) => expect(seedIdx).toBeLessThan(stepIndexOf(yml, n)));
    });
  });

  describe("Error path: 미발견 정규형 · 부분 drift · non-string throw", () => {
    it("① seed step 이 없는 합성 YAML 은 throw 없이 미발견 정규형을 돌려준다", () => {
      const stripped = [
        "jobs:",
        "  load:",
        "    steps:",
        `      - name: ${INSTALL_STEP_NAME}`,
        "        uses: grafana/setup-k6-action@v1",
        "",
      ].join("\n");
      expect(extractStepBlock(stripped, SEED_STEP_NAME)).toBeNull();
      expect(extractStep(stripped, SEED_STEP_NAME)).toEqual({
        found: false,
        uses: null,
        run: null,
      });
      expect(stepIndexOf(stripped, SEED_STEP_NAME)).toBe(-1);
      expect(dockerEnvValue(stripped, DB_URL_ENV_KEY)).toBeNull();
    });

    it("② step 은 있으나 env 또는 run 한쪽만 없는 합성 입력도 null 이다(부분 drift 검출)", () => {
      const header = `      - name: ${SEED_STEP_NAME}`;
      const noEnv = [header, `        run: ${SEED_RUN_COMMAND}`, ""].join("\n");
      const noEnvBlock = extractStepBlock(noEnv, SEED_STEP_NAME) as string[];
      expect(extractKey(noEnvBlock, DB_URL_ENV_KEY)).toBeNull();
      expect(envKeysOf(noEnvBlock)).toEqual([]);
      expect(extractStep(noEnv, SEED_STEP_NAME).run).toBe(SEED_RUN_COMMAND);

      const noRun = [
        header,
        "        env:",
        `          ${DB_URL_ENV_KEY}: postgresql://u:p@localhost:5432/db`,
        "",
      ].join("\n");
      const noRunBlock = extractStepBlock(noRun, SEED_STEP_NAME) as string[];
      expect(envKeysOf(noRunBlock)).toEqual([DB_URL_ENV_KEY]);
      expect(extractStep(noRun, SEED_STEP_NAME).run).toBeNull();
    });

    it("③ non-string / non-array 입력에 helper 계약대로 TypeError 가 난다", () => {
      expect(() =>
        extractStepBlock(null as unknown as string, SEED_STEP_NAME),
      ).toThrow(TypeError);
      expect(() => extractStep(loadYml(), 42 as unknown as string)).toThrow(
        TypeError,
      );
      expect(() =>
        dockerEnvValue(undefined as unknown as string, DB_URL_ENV_KEY),
      ).toThrow(TypeError);
      // 신설 helper 도 동형 계약 — 배열이 아니면 추측하지 않고 즉시 throw.
      expect(() => envKeysOf("env:" as unknown as string[])).toThrow(TypeError);
    });
  });

  describe("분기 cover: 따옴표 유무 정규화 · env 보유 step vs env 없는 step", () => {
    it("① DATABASE_URL 값의 따옴표 유무 두 갈래를 unquote 가 같은 결과로 정규화한다", () => {
      const raw = "postgresql://u:p@localhost:5432/db?schema=public";
      const tpl = (v: string): string =>
        [
          `      - name: ${SEED_STEP_NAME}`,
          "        env:",
          `          ${DB_URL_ENV_KEY}: ${v}`,
          "",
        ].join("\n");
      const read = (v: string): string | null =>
        seedEnv(tpl(v), DB_URL_ENV_KEY);
      expect(read(`"${raw}"`)).toBe(raw);
      expect(read(`'${raw}'`)).toBe(raw);
      expect(read(raw)).toBe(raw);
      // 짝이 맞지 않는 따옴표는 벗기지 않는다(정규화가 값을 훼손하지 않음).
      expect(unquote(`"${raw}`)).toBe(`"${raw}`);
    });

    it("② env 를 가진 step 갈래와 env 가 없는 step 갈래가 각각 정규형을 돌려준다", () => {
      const yml = loadYml();
      expect(
        envKeysOf(extractStepBlock(yml, SEED_STEP_NAME) as string[]),
      ).toEqual([DB_URL_ENV_KEY]);
      expect(
        envKeysOf(extractStepBlock(yml, RUN_STEP_NAME) as string[]),
      ).toEqual(["K6_BASE_URL"]);
      [INSTALL_STEP_NAME, BUILD_STEP_NAME, DEPS_STEP_NAME].forEach((n) =>
        expect(envKeysOf(extractStepBlock(yml, n) as string[])).toEqual([]),
      );
    });
  });

  describe("negative cases 충분 cover — 순서 mutation · 실패 은닉 · 키 우회 · 선행 계약 회귀", () => {
    it("① 합성 mutation 으로 seed 를 k6 뒤로 옮기거나 DATABASE_URL 한쪽만 바꾸면 단언이 깨진다", () => {
      const yml = loadYml();
      const seedBlock = (
        extractStepBlock(yml, SEED_STEP_NAME) as string[]
      ).join("\n");
      // (a) seed 를 k6 실행 step 앞(= k6 설치 뒤)으로 옮긴 합성본 — 순서 단언이 깨진다.
      const moved = yml
        .replace(seedBlock, "")
        .replace(
          `      - name: ${RUN_STEP_NAME}`,
          `${seedBlock}      - name: ${RUN_STEP_NAME}`,
        );
      expect(stepIndexOf(moved, SEED_STEP_NAME)).toBeGreaterThan(
        stepIndexOf(moved, INSTALL_STEP_NAME),
      );
      // (b) seed 쪽 DATABASE_URL 만 바꾼 합성본 — docker run 리터럴과의 parity 가 깨진다.
      const drifted = yml.replace(
        `${DB_URL_ENV_KEY}: "${seedEnv(yml, DB_URL_ENV_KEY) as string}"`,
        `${DB_URL_ENV_KEY}: "postgresql://other:other@localhost:5432/other"`,
      );
      expect(seedEnv(drifted, DB_URL_ENV_KEY)).not.toBe(
        dockerEnvValue(bootText(drifted), DB_URL_ENV_KEY),
      );
      // 원본은 mutate 되지 않는다(대조군).
      const fresh = loadYml();
      expect(stepIndexOf(fresh, SEED_STEP_NAME)).toBeLessThan(
        stepIndexOf(fresh, INSTALL_STEP_NAME),
      );
      expect(seedEnv(fresh, DB_URL_ENV_KEY)).toBe(
        dockerEnvValue(bootText(fresh), DB_URL_ENV_KEY),
      );
    });

    it("② seed 실패를 은닉하지 않고 package.json 키를 우회하지 않으며 신규 자격증명을 도입하지 않는다", () => {
      const yml = loadYml();
      const block = extractStepBlock(yml, SEED_STEP_NAME) as string[];
      // 실패가 조용히 통과하면 빈 DB 위 측정치가 baseline 으로 박힌다.
      ["if", "continue-on-error"].forEach((k) =>
        expect(extractKey(block, k)).toBeNull(),
      );
      const run = extractStep(yml, SEED_STEP_NAME).run as string;
      expect(run).toBe(SEED_RUN_COMMAND);
      ["ts-node", "npx ", "node ", "&&", ";"].forEach((t) =>
        expect(run).not.toContain(t),
      );
      // 값은 기존 CI 더미 재사용 — 새 자격증명 env 도 외부 저장소 참조도 없다(CLAUDE.md §9).
      expect(envKeysOf(block)).toEqual([DB_URL_ENV_KEY]);
      expect(block.join("\n")).not.toMatch(/\$\{\{\s*secrets\./);
      envKeysOf(block).forEach((k) =>
        expect(k).not.toMatch(/TOKEN|PASSWORD|APIKEY|SECRET/i),
      );
    });

    it("③ 상시 트리거 유입 0 이고 package.json 은 seed 키 그대로 · k6 미편입이다(T-1620 계약)", () => {
      const triggers = triggerSection(loadYml());
      expect(triggers).toContain("workflow_dispatch:");
      ["pull_request:", "push:", "schedule:"].forEach((t) =>
        expect(triggers).not.toContain(t),
      );
      const p = pkg();
      ["k6", "pnpm"].forEach((name) => {
        expect(Object.keys(p.dependencies)).not.toContain(name);
        expect(Object.keys(p.devDependencies)).not.toContain(name);
      });
      expect(p.scripts[SEED_SCRIPT_KEY]).toBe(`ts-node ${SEED_SCRIPT_REL}`);
    });

    it("④ T-1659 툴체인 pin 과 기존 step 순서 · 정리 step 계약이 그대로다", () => {
      const yml = loadYml();
      const seedIdx = stepIndexOf(yml, SEED_STEP_NAME);
      TOOLCHAIN_STEP_NAMES.forEach((n) => {
        const idx = stepIndexOf(yml, n);
        expect(idx).toBeGreaterThan(-1);
        expect(idx).toBeLessThan(seedIdx);
      });
      const pin = (step: string, key: string): string | null =>
        extractKey(extractStepBlock(yml, step) as string[], key);
      expect(pin(PNPM_STEP_NAME, "version")).toBe("9.12.0");
      expect(pin(NODE_STEP_NAME, "node-version")).toBe("20");
      expect(extractStep(yml, DEPS_STEP_NAME).run).toBe(INSTALL_COMMAND);
      const legacy = [
        BUILD_STEP_NAME,
        BOOT_STEP_NAME,
        INSTALL_STEP_NAME,
        RUN_STEP_NAME,
        S1_RUN_STEP_NAME,
        S1_SUMMARY_STEP_NAME,
        S2_RUN_STEP_NAME,
        S3_RUN_STEP_NAME,
        TEARDOWN_STEP_NAME,
      ].map((n) => stepIndexOf(yml, n));
      expect(legacy).not.toContain(-1);
      expect([...legacy].sort((a, b) => a - b)).toEqual(legacy);
      expect(
        extractKey(extractStepBlock(yml, TEARDOWN_STEP_NAME) as string[], "if"),
      ).toBe("always()");
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// T-1661 — s1-batch.js setup() 의 실 devset dataset 조회 교체 drift. 존재 이유 — T-1660 이 배선한
// seed step 이 133 인원을 적재해도, 스크립트가 계속 합성 person 을 만들어 쓰면 그 적재는 값비싼
// no-op 이고 부하 판정은 여전히 가짜 데이터 위에서 난다. 연결은 문자열 2 개(도메인 리터럴 · 조회
// 표현)에만 의존하는데 부하 job 은 수동 dispatch 전용이라 어긋나도 상시 CI 는 green 이다(조회가
// 조용히 0 건이 되어 빈 부하가 baseline 으로 박힌다). 새 helper 1(devsetDomainOf) 외 기존 재사용.
//      🔥 실 k6 실행 0 · 실 HTTP 0 · 실 seed 실행 0 · DB 의존 0 · 새 dependency 0 — 파일 read 만.

/** devset email 도메인 정본 파일과 그 선언 형태(k6 쪽 사본과 문자 그대로 같아야 한다). */
const DEVSET_DESCRIPTORS_REL =
  "test/helpers/realdata-devset-seed-descriptors.ts";
const DEVSET_DOMAIN_DECL = /const DEVSET_EMAIL_DOMAIN = "([^"]+)";/;
/** 실 평가 e2e seed 도메인 — devset 과 **달라야** 하는 대조군(email @unique 충돌 회피 근거). */
const E2E_SEED_DOMAIN = "e2e.realdata.test";

/**
 * 소스에 선언된 `DEVSET_EMAIL_DOMAIN` 값만 뽑는다. 선언 부재(0-byte read 포함)면 `null`(추측 0)
 * — 이 두 갈래가 "선언 있음 / 없음" 분기의 실체이며, null 이 곧 parity 단언을 깨뜨린다.
 * @throws {TypeError} 입력이 non-string 일 때(extractStepBlock 과 동형 fail-fast 계약).
 */
function devsetDomainOf(source: string): string | null {
  if (typeof source !== "string") {
    throw new TypeError("devsetDomainOf: source 는 string 이어야 함");
  }
  const m = source.match(DEVSET_DOMAIN_DECL);
  return m ? m[1] : null;
}

/** devset 기술자 원문(도메인 정본 대조용). */
const descriptorsText = (): string =>
  readFileSync(path.join(REPO_ROOT, DEVSET_DESCRIPTORS_REL), "utf8");

describe("s1-batch.js 실 devset dataset 조회 교체 drift smoke (T-1661)", () => {
  describe("Happy-path: 조회 1 회 · 도메인 parity · teardown 보존", () => {
    it("① setup 이 devset 도메인으로 필터한 /api/persons 조회 1 회를 personIds 로 흘린다", () => {
      const setup = s1Body("export function setup");
      expect(
        setup.match(/http\.get\(`\$\{BASE_URL\}\/api\/persons`/g),
      ).toHaveLength(1);
      // 조회 → 도메인 필터 → 표본만큼 slice → id 추출이 한 식으로 이어진다(중간 변수 0).
      expect(setup).toMatch(
        /const personIds = persons\s*\.json\(\)\s*\.filter\([^\n]*endsWith\(`@\$\{DEVSET_EMAIL_DOMAIN\}`\),?\s*\)\s*\.slice\(0, SAMPLE_PERSONS\)\s*\.map\(/,
      );
      // setup 반환 → 측정 iteration 소비 경로는 T-1631 그대로다.
      expect(setup).toContain("personIds,");
      expect(s1Body("export default function")).toContain("data.personIds");
    });

    it("② 도메인 리터럴이 realdata-devset-seed-descriptors.ts 정본과 parity 다", () => {
      const canonical = devsetDomainOf(descriptorsText());
      expect(canonical).toBe("load.devset.test");
      expect(devsetDomainOf(s1Script())).toBe(canonical);
      // 다음 사람이 정본을 찾을 수 있게 스크립트가 그 경로를 주석으로 지목한다.
      expect(s1Script()).toContain(DEVSET_DESCRIPTORS_REL);
      // 정본 자체는 e2e seed 도메인과 달라야 한다(한 DB 공존 시 email @unique 충돌 0).
      expect(canonical).not.toBe(E2E_SEED_DOMAIN);
    });

    it("③ teardown 이 provider 회수 1 회만 남기고 머리 주석이 seed 선행 전제를 적는다", () => {
      const down = s1Body("export function teardown");
      expect(down.match(/http\.del\(/g)).toHaveLength(1);
      expect(down).toMatch(
        /http\.del\(`\$\{BASE_URL\}\/api\/llm\/providers\/\$\{data\.providerId\}`/,
      );
      ["personIds", "/api/persons", "for (", "SEED_DELETE_PARAMS"].forEach(
        (t) => expect(down).not.toContain(t),
      );
      // 실 dataset 전제 — 워크플로 seed step 이 선행해야 한다는 사실이 스크립트에 적혀 있다.
      expect(s1Script()).toContain(SEED_RUN_COMMAND);
    });
  });

  describe("Error path: 정본 파일 부재 · 0-byte read · non-string", () => {
    it("① 정본 파일이 실재하고, 없는 경로 read 와 없는 블록 추출은 조용히 PASS 하지 않는다", () => {
      expect(existsSync(path.join(REPO_ROOT, DEVSET_DESCRIPTORS_REL))).toBe(
        true,
      );
      expect(() =>
        readFileSync(path.join(REPO_ROOT, `${DEVSET_DESCRIPTORS_REL}.absent`)),
      ).toThrow();
      // 대상 블록이 없으면 s1Body 는 빈 문자열을 만들지 않고 즉시 터진다(false-PASS 차단).
      expect(() => s1Body("export function nonexistent")).toThrow();
    });

    it("② 0-byte / 선언 부재는 null, non-string 은 TypeError 로 드러난다", () => {
      expect(devsetDomainOf("")).toBeNull();
      expect(devsetDomainOf("const OTHER = 1;")).toBeNull();
      [undefined, 42, null].forEach((bad) =>
        expect(() => devsetDomainOf(bad as unknown as string)).toThrow(
          TypeError,
        ),
      );
      expect(extractTopLevelBlock("", "export function setup")).toBeNull();
    });
  });

  describe("flow / 분기 cover: 표본 > 조회 결과 · 표본 < 조회 결과 · 표본 정규화", () => {
    it("① 표본이 조회 결과보다 많을 때와 적을 때를 같은 식 하나가 처리한다(분기문 0)", () => {
      const setup = s1Body("export function setup");
      expect(setup).toContain(".slice(0, SAMPLE_PERSONS)");
      ["if (", "} else", " ? ", "Math.min("].forEach((t) =>
        expect(setup).not.toContain(t),
      );
      // 두 갈래의 실제 동치성 — 스크립트와 같은 식을 합성 배열에 적용(실 k6 실행 0).
      const take = (n: number, rows: string[]): string[] => rows.slice(0, n);
      expect(take(10, ["a", "b"])).toEqual(["a", "b"]);
      expect(take(1, ["a", "b"])).toEqual(["a"]);
      expect(take(2, [])).toEqual([]);
    });

    it("② SAMPLE_PERSONS 정규화 표현 · 기본값 10 · workflow 주입값 parity 가 회귀 0 이다", () => {
      const script = s1Script();
      expect(script).toMatch(
        /const SAMPLE_PERSONS = Math\.max\(\s*1,\s*Math\.trunc\(Number\(__ENV\.K6_S1_PERSONS\)\) \|\| 10,\s*\);/,
      );
      const declared = extractEnvFallback(script, S1_PERSONS_ENV_KEY);
      expect(declared).toBe("10");
      const yml = loadYml();
      [S1_RUN_STEP_NAME, S1_SUMMARY_STEP_NAME].forEach((name) =>
        expect(
          resolveInputExpr(
            yml,
            extractKey(
              extractStepBlock(yml, name) as string[],
              S1_PERSONS_ENV_KEY,
            ) as string,
          ),
        ).toBe(declared),
      );
    });
  });

  describe("negative cases 충분 cover — 생성 잔존 · 삭제 유입 · 분기 · 도메인 · route", () => {
    it("① setup·teardown 어디에도 person 생성 POST 가 남아 있지 않다", () => {
      const script = s1Script();
      expect(script).not.toMatch(
        /http\.post\(\s*`\$\{BASE_URL\}\/api\/persons`/,
      );
      ["배치 부하 대상", "fullName:", 'created.json("id")'].forEach((t) =>
        expect(script).not.toContain(t),
      );
    });

    it("② person DELETE 가 스크립트 전체에 0 회다(공유 dataset 삭제 차단)", () => {
      const script = s1Script();
      expect(script).not.toContain("/api/persons/");
      // 남은 DELETE 는 provider 열거 회수 1 + teardown 단일-row 회수 1 = 2 회뿐이다.
      expect(script.match(/http\.del\(/g)).toHaveLength(2);
      expect(script).not.toContain("SEED_DELETE_PARAMS");
    });

    it("③ 분기 0 규약이 회귀하지 않았다(|| 카운트 불변)", () => {
      const script = s1Script();
      ["if (", "} else", " ? ", " && ", " || ("].forEach((t) =>
        expect(script).not.toContain(t),
      );
      expect(script.match(/\|\|/g)).toHaveLength(2);
    });

    it("④ 도메인이 e2e seed 도메인이나 임의 리터럴로 바뀌면 parity 단언이 깨진다", () => {
      const script = s1Script();
      const canonical = devsetDomainOf(descriptorsText()) as string;
      // 합성 mutation 2 종 — e2e 도메인 치환 · 임의 리터럴 치환 모두 정본과 어긋난다.
      [E2E_SEED_DOMAIN, "load.devset.example"].forEach((bad) => {
        const drifted = script.replace(`"${canonical}"`, `"${bad}"`);
        expect(drifted).not.toBe(script);
        expect(devsetDomainOf(drifted)).toBe(bad);
        expect(devsetDomainOf(drifted)).not.toBe(canonical);
      });
      // 대조군 — 원본은 mutate 되지 않는다.
      expect(devsetDomainOf(s1Script())).toBe(canonical);
    });

    it("⑤ S1_ROUTES 밖의 임의 route 유입이 0 이다", () => {
      expect(apiRoutesOf(s1Script()).sort()).toEqual(
        [...S1_ROUTES, S1_BATCH_ROUTE].sort(),
      );
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// T-1666 — s1-batch.js setup() 의 devset 표본 인원 수 로그 배선 drift. 존재 이유 — T-1665 의 8
// 회차 실측은 k6 가 실제로 몇 명을 표본으로 취했는지를 seed 적재 건수 · service 구현 · p95 대역
// 이라는 간접 증거 3 종으로만 추론해야 했다. 로그 1 줄이 그 추론을 없애는데, 그 줄이 ① 사라지거나
// ② 위치가 밀려 return 뒤로 가거나 ③ 자격증명 · 경로 리터럴을 싣거나 ④ 분기 0 규약을 깨도 상시
// CI 는 green 이다(부하 job 은 수동 dispatch 전용). 새 helper 1(consoleLogArgsOf) 외 기존 재사용.
//      🔥 실 k6 실행 0 · 실 HTTP 0 · DB 의존 0 · 새 dependency 0 — 파일 read + 합성 문자열만.

/** 표본 로그의 고정 prefix — 다음 사람이 `gh run view --log` 에서 값을 grep 하는 좌표다. */
const S1_SAMPLE_LOG_PREFIX = "[s1-batch] devset 표본";
/** 로그 인자에 실리면 안 되는 토큰 — 자격증명 · cookie · email 원문 계열(민감값 유출 차단). */
const S1_LOG_FORBIDDEN_TOKENS = [
  "authCookie",
  "credentials",
  "apiKey",
  "password",
  "Cookie",
  "email",
  "stamp",
];

/**
 * 소스 안 `console.log(...)` 호출의 인자 원문 목록(주석 행 제외). 호출이 없으면 빈 배열이라
 * 0-byte read 도 조용히 통과하지 않는다 — 분기 없음(필터 + 매칭만).
 * @throws {TypeError} 입력이 non-string 일 때(extractTopLevelBlock 과 동형 fail-fast 계약).
 */
function consoleLogArgsOf(source: string): string[] {
  if (typeof source !== "string") {
    throw new TypeError("consoleLogArgsOf: source 는 string 이어야 함");
  }
  return (
    source
      .split("\n")
      .filter((l) => !l.trim().startsWith("//"))
      .join("\n")
      .match(/console\.log\([\s\S]*?\);/g) || []
  ).map((call) => call.slice("console.log(".length, -2).trim());
}

/** T-1661 이 고정한 personIds 단일 식 chain — 중간 변수로 쪼개지면 즉시 깨진다. */
const S1_PERSON_IDS_CHAIN =
  /const personIds = persons\s*\.json\(\)\s*\.filter\([^\n]*\)\s*\.slice\(0, SAMPLE_PERSONS\)\s*\.map\(/;

describe("s1-batch.js 표본 인원 수 로그 배선 drift smoke (T-1666)", () => {
  describe("Happy-path: 로그 1 회 · 두 수치 · 위치 · 주변 무변경", () => {
    it("① setup() 의 console.log 가 정확히 1 회이고 두 수치와 고정 prefix 를 싣는다", () => {
      const args = consoleLogArgsOf(s1Body("export function setup"));
      expect(args).toHaveLength(1);
      // 취한 표본 수와 요청 표본 수 — 이 둘이 있어야 표본 부족이 로그만으로 드러난다.
      expect(args[0]).toContain("${personIds.length}");
      expect(args[0]).toContain("${SAMPLE_PERSONS}");
      expect(args[0]).toContain(S1_SAMPLE_LOG_PREFIX);
      // 인자는 template literal 하나뿐 — 객체 dump 같은 추가 인자를 붙이지 않는다.
      expect(args[0]).toMatch(/^`[^`]*`,?$/);
    });

    it("② 로그가 personIds 산출 이후 · return 이전에 놓이고 그 산출 chain 은 무변경이다", () => {
      const setup = s1Body("export function setup");
      expect(setup).toMatch(
        /\.map\(\(row\) => row\.id\);[\s\S]*console\.log\([\s\S]*?\);[\s\S]*return \{/,
      );
      expect(setup).toMatch(S1_PERSON_IDS_CHAIN);
      // 산출보다 앞선 자리에 하나 더 끼우는 변조는 호출 수 단언이 잡는다(원본 1 회).
      const early = setup.replace(
        "  const persons = http.get(",
        "  console.log(`early`);\n  const persons = http.get(",
      );
      expect(early).not.toBe(setup);
      expect(consoleLogArgsOf(early)).toHaveLength(2);
    });

    it("③ setup 의 http 왕복 · return 키 집합 · teardown/default/머리 주석이 무변경이다", () => {
      const setup = s1Body("export function setup");
      // 로그는 왕복을 늘리지 않는다 — POST 3(signup · login · provider) · GET 2 · DELETE 1.
      expect(setup.match(/http\.post\(/g)).toHaveLength(3);
      expect(setup.match(/http\.get\(/g)).toHaveLength(2);
      expect(setup.match(/http\.del\(/g)).toHaveLength(1);
      [
        "personIds,",
        'providerId: provider.json("id")',
        "authCookie,",
        "periodStart:",
      ].forEach((k) => expect(setup).toContain(k));
      // 로그는 setup 안에만 — 측정 iteration · teardown · 머리 주석 리터럴은 그대로다.
      expect(consoleLogArgsOf(s1Body("export default function"))).toEqual([]);
      expect(consoleLogArgsOf(s1Body("export function teardown"))).toEqual([]);
      expect(s1Script()).toContain("// 범위 밖(후속 slice):");
    });
  });

  describe("Error path: 정본 부재 · 없는 블록 · 0-byte · non-string", () => {
    it("① 정본 파일이 실재하고, 없는 경로 read 와 없는 블록 추출은 조용히 PASS 하지 않는다", () => {
      expect(existsSync(path.join(REPO_ROOT, S1_SCRIPT_REL))).toBe(true);
      expect(() =>
        readFileSync(path.join(REPO_ROOT, `${S1_SCRIPT_REL}.absent`)),
      ).toThrow();
      expect(() => s1Body("export function nonexistent")).toThrow();
    });

    it("② 빈 입력은 null · 빈 배열이고 non-string 은 TypeError 로 드러난다", () => {
      expect(extractTopLevelBlock("", "export function setup")).toBeNull();
      expect(consoleLogArgsOf("")).toEqual([]);
      // 주석 안의 호출 흉내는 세지 않는다(거짓 1 회 차단).
      expect(consoleLogArgsOf("// console.log(`x`);")).toEqual([]);
      [undefined, 42, null].forEach((bad) =>
        expect(() => consoleLogArgsOf(bad as unknown as string)).toThrow(
          TypeError,
        ),
      );
    });
  });

  describe("flow / 분기 cover: 표본 > 조회 · 표본 < 조회 · 조회 0 · 정규화", () => {
    it("① 세 갈래의 로그 수치를 스크립트와 같은 식 하나가 만든다(실 k6 실행 0)", () => {
      const setup = s1Body("export function setup");
      expect(setup).toContain(".slice(0, SAMPLE_PERSONS)");
      const domain = devsetDomainOf(s1Script()) as string;
      // 스크립트의 filter → slice → map 을 합성 배열에 그대로 적용해 personIds.length 동치 검증.
      const logged = (
        sample: number,
        rows: { id: string; email: string }[],
      ): number =>
        rows
          .filter((row) => `${row.email}`.endsWith(`@${domain}`))
          .slice(0, sample)
          .map((row) => row.id).length;
      const rows = [
        { id: "a", email: `a@${domain}` },
        { id: "b", email: `b@${domain}` },
        { id: "c", email: "c@other.invalid" },
      ];
      expect(logged(10, rows)).toBe(2); // 표본 > 조회 결과 — 있는 만큼만 찍힌다.
      expect(logged(1, rows)).toBe(1); // 표본 < 조회 결과 — 앞에서부터 자른다.
      expect(logged(10, [])).toBe(0); // 조회 0 — 로그가 0 을 찍어 표본 부족이 드러난다.
    });

    it("② SAMPLE_PERSONS 정규화 식 · 기본값 10 · workflow 주입 parity 가 회귀 0 이다", () => {
      const script = s1Script();
      expect(script).toMatch(
        /const SAMPLE_PERSONS = Math\.max\(\s*1,\s*Math\.trunc\(Number\(__ENV\.K6_S1_PERSONS\)\) \|\| 10,\s*\);/,
      );
      const declared = extractEnvFallback(script, S1_PERSONS_ENV_KEY);
      expect(declared).toBe("10");
      const yml = loadYml();
      [S1_RUN_STEP_NAME, S1_SUMMARY_STEP_NAME].forEach((name) =>
        expect(
          resolveInputExpr(
            yml,
            extractKey(
              extractStepBlock(yml, name) as string[],
              S1_PERSONS_ENV_KEY,
            ) as string,
          ),
        ).toBe(declared),
      );
    });
  });

  describe("negative cases 충분 cover — 중복 · 유출 · 경로 · 분기 · chain 분해", () => {
    it("① console.log 가 2 회로 늘거나 setup 밖으로 새면 단언이 깨진다(합성 mutation)", () => {
      const script = s1Script();
      expect(consoleLogArgsOf(script)).toHaveLength(1);
      const doubled = script.replace(
        "  console.log(",
        "  console.log(`dup`);\n  console.log(",
      );
      expect(doubled).not.toBe(script);
      expect(consoleLogArgsOf(doubled)).toHaveLength(2);
      // teardown 으로 샌 변조도 같은 helper 가 잡는다(원본 teardown 은 0 회).
      const leaked = script.replace(
        "export function teardown(data) {",
        "export function teardown(data) {\n  console.log(`leak`);",
      );
      expect(
        consoleLogArgsOf(
          (
            extractTopLevelBlock(leaked, "export function teardown") as string[]
          ).join("\n"),
        ),
      ).toHaveLength(1);
      expect(consoleLogArgsOf(s1Body("export function teardown"))).toEqual([]);
    });

    it("② 로그 인자에 자격증명 · cookie · email 토큰 유입이 0 이다(합성 mutation 대조)", () => {
      const arg = consoleLogArgsOf(s1Body("export function setup"))[0];
      S1_LOG_FORBIDDEN_TOKENS.forEach((t) => expect(arg).not.toContain(t));
      // 대조군 — 민감값을 실은 변조는 같은 단언에서 즉시 걸린다(단언이 tautology 가 아님).
      const drifted = arg.replace("`,", " cookie=${authCookie}`,");
      expect(drifted).not.toBe(arg);
      expect(drifted).toContain("authCookie");
    });

    it("③ 로그 문자열에 /api/ 경로 리터럴 유입이 0 이다(route 집합 불변)", () => {
      const script = s1Script();
      expect(apiRoutesOf(script).sort()).toEqual(
        [...S1_ROUTES, S1_BATCH_ROUTE].sort(),
      );
      expect(
        consoleLogArgsOf(s1Body("export function setup"))[0],
      ).not.toContain("/api/");
      // 대조군 — 로그에 경로를 실으면 route 집합이 커져 T-1661 negative ⑤ 가 red 가 된다.
      const drifted = script.replace(
        S1_SAMPLE_LOG_PREFIX,
        `${S1_SAMPLE_LOG_PREFIX} /api/persons-sample`,
      );
      expect(apiRoutesOf(drifted).length).toBe(apiRoutesOf(script).length + 1);
    });

    it("④ 분기 0 규약이 회귀하지 않았다(분기 토큰 0 · || 매치 2)", () => {
      const script = s1Script();
      ["if (", "} else", " ? ", " && ", " || (", "Math.min("].forEach((t) =>
        expect(script).not.toContain(t),
      );
      // __ENV fallback 2 종만 남는다 — 로그가 `||` 를 늘리지 않았다.
      expect(script.match(/\|\|/g)).toHaveLength(2);
      // 대조군 — 로그를 조건부로 감싸는 변조는 분기 토큰 단언을 깨뜨린다.
      const drifted = script.replace(
        "  console.log(",
        "  if (personIds.length === 0) console.log(",
      );
      expect(drifted).not.toBe(script);
      expect(drifted).toContain("if (");
    });

    it("⑤ personIds 단일 식 chain 이 중간 변수로 쪼개지면 단언이 깨진다(대조군)", () => {
      const setup = s1Body("export function setup");
      expect(setup).toMatch(S1_PERSON_IDS_CHAIN);
      const split = setup.replace(
        "    .slice(0, SAMPLE_PERSONS)",
        ";\n  const sampled = filtered.slice(0, SAMPLE_PERSONS)",
      );
      expect(split).not.toBe(setup);
      expect(split).not.toMatch(S1_PERSON_IDS_CHAIN);
      // 원본은 mutate 되지 않는다 — 대조군이 성립한다.
      expect(s1Body("export function setup")).toMatch(S1_PERSON_IDS_CHAIN);
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// T-1672 — s2-read.js 의 person leg 실 devset 조회 교체 drift. 존재 이유 — T-1660 이 배선한 seed
// step 이 실 dataset 을 적재해도 S2 가 계속 합성 person 30 을 쓰면 "조회 3 초 이내"(REQ-048)
// 판정은 가짜 규모 위에서 난다. 교체 후의 연결은 문자열 2 개(도메인 리터럴 · 조회 표현)와 보존
// 계약(teardown 의 person DELETE 부재)뿐인데 부하 job 은 수동 dispatch 전용이라, 조회가 조용히
// 0 건이 되거나 공유 dataset 이 지워져도 상시 CI 는 green 이다. 새 helper 0 — 기존 재사용.
//      🔥 실 k6 실행 0 · 실 HTTP 0 · 실 seed 실행 0 · DB 의존 0 · 새 dependency 0 — 파일 read 만.

/** S2 표본 로그의 고정 prefix — `gh run view --log` 에서 값을 grep 하는 좌표다. */
const S2_SAMPLE_LOG_PREFIX = "[s2-read] devset 표본";
/** 로그 인자에 실리면 안 되는 토큰 — 자격증명 · cookie · email 원문 계열(민감값 유출 차단). */
const S2_LOG_FORBIDDEN = ["authCookie", "credentials", "password", "row.email"];
/** T-1672 가 무변경으로 고정한 SEED_PERSONS 정규화 선언(설계 ③). */
const S2_NORMALIZED_DECL =
  /const SEED_PERSONS = Math\.max\(\s*1,\s*Math\.trunc\(Number\(__ENV\.K6_SEED_PERSONS\)\) \|\| 30,\s*\);/;

describe("s2-read.js 실 devset dataset 조회 교체 drift smoke (T-1672)", () => {
  describe("Happy-path: 조회 1 회 · 도메인 parity · 표본 로그", () => {
    it("① setup 이 devset 필터 조회 1 회를 단일 식으로 personIds 에 흘린다", () => {
      const setup = s2Body("export function setup");
      expect(
        setup.match(/http\.get\(`\$\{BASE_URL\}\/api\/persons`/g),
      ).toHaveLength(1);
      expect(setup).toMatch(S2_PERSON_IDS_CHAIN);
      expect(setup).toContain("personIds,");
      // 조회는 seed tag 라 route tag 별 p95 4 종을 오염시키지 않는다.
      expect(setup).toContain("/api/persons`, SEED_PARAMS)");
    });

    it("② 도메인 리터럴이 realdata-devset-seed-descriptors.ts 정본 · s1 사본과 parity 다", () => {
      const canonical = devsetDomainOf(descriptorsText());
      expect(canonical).toBe("load.devset.test");
      [s2Script(), s1Script()].forEach((s) =>
        expect(devsetDomainOf(s)).toBe(canonical),
      );
      // 정본 경로를 주석으로 지목하고(env 키 아님), e2e seed 도메인과는 달라야 한다.
      expect(s2Script()).toContain(DEVSET_DESCRIPTORS_REL);
      expect(canonical).not.toBe(E2E_SEED_DOMAIN);
    });

    it("③ 표본 로그 1 줄이 필터 통과 총 건수와 취한 표본 수를 함께 찍는다", () => {
      const setup = s2Body("export function setup");
      const args = consoleLogArgsOf(setup);
      expect(args).toHaveLength(1); // 총 건수가 seed 완전성 신호(부족 ↔ 적재 실패 구분).
      ["${devsetTotal}", "${personIds.length}", "${SEED_PERSONS}"].forEach(
        (t) => expect(args[0]).toContain(t),
      );
      expect(args[0]).toContain(S2_SAMPLE_LOG_PREFIX);
      expect(args[0]).toMatch(/^`[^`]*`,?$/);
      // 로그는 personIds 산출 이후 · return 이전에 놓인다.
      expect(setup).toMatch(
        /\.map\(\(row\) => row\.id\);[\s\S]*console\.log\([\s\S]*?\);[\s\S]*return \{/,
      );
    });
  });

  describe("Error path: 도메인 어긋남 · 정규화 회귀 · 정본 부재 · non-string", () => {
    it("① 도메인이 e2e 도메인이나 임의 리터럴로 바뀌면 parity 가 깨진다(조용한 빈 run 차단)", () => {
      const script = s2Script();
      const canonical = devsetDomainOf(descriptorsText()) as string;
      // 합성 mutation 2 종 — 어느 쪽도 조회가 0 건이 되는 갈래를 대표한다.
      [E2E_SEED_DOMAIN, "load.devset.example"].forEach((bad) => {
        const drifted = script.replace(`"${canonical}"`, `"${bad}"`);
        expect(drifted).not.toBe(script);
        expect(devsetDomainOf(drifted)).toBe(bad);
      });
      expect(devsetDomainOf(s2Script())).toBe(canonical); // 원본은 mutate 0.
    });

    it("② SEED_PERSONS 정규화 표현이 잔존한다(NaN 표본으로 0 행 p95 통과 착시 차단)", () => {
      const script = s2Script();
      expect(script).toMatch(S2_NORMALIZED_DECL);
      expect(extractEnvFallback(script, SEED_ENV_KEY)).toBe("30");
      // 옛 취약 표현 회귀는 즉시 드러난다(합성 대조군).
      const drifted = script.replace(
        S2_NORMALIZED_DECL,
        "const SEED_PERSONS = Number(__ENV.K6_SEED_PERSONS || 30);",
      );
      expect(drifted).not.toBe(script);
      expect(drifted).not.toMatch(S2_NORMALIZED_DECL);
    });

    it("③ 정본 부재 · 없는 블록 · 0-byte · non-string 이 조용히 PASS 하지 않는다", () => {
      expect(existsSync(path.join(REPO_ROOT, DEVSET_DESCRIPTORS_REL))).toBe(
        true,
      );
      expect(() => s2Body("export function nonexistent")).toThrow();
      expect(devsetDomainOf("")).toBeNull();
      [undefined, 42, null].forEach((bad) =>
        expect(() => devsetDomainOf(bad as unknown as string)).toThrow(
          TypeError,
        ),
      );
    });
  });

  describe("flow / 분기 cover: 표본 상한 > 조회 결과 · < 조회 결과 · 조회 0", () => {
    it("① 세 갈래를 같은 식 하나가 처리한다(스크립트 쪽 분기문 0, 실 k6 실행 0)", () => {
      const setup = s2Body("export function setup");
      expect(setup).toContain(".slice(0, SEED_PERSONS)");
      ["if (", "} else", " ? ", "Math.min("].forEach((t) =>
        expect(setup).not.toContain(t),
      );
      // 스크립트와 같은 filter → slice 식을 합성 배열에 적용해 세 갈래의 동치성을 확인한다.
      const domain = devsetDomainOf(s2Script()) as string;
      const rows = [`a@${domain}`, `b@${domain}`, "c@other.invalid"];
      const take = (cap: number, src: string[]): string[] =>
        src.filter((e) => e.endsWith(`@${domain}`)).slice(0, cap);
      expect(take(30, rows)).toEqual([`a@${domain}`, `b@${domain}`]); // 상한 초과.
      expect(take(1, rows)).toHaveLength(1); // 상한 미만 — 앞에서부터 자른다.
      expect(take(30, [])).toEqual([]); // 조회 0 — 로그가 0 을 찍어 드러난다.
      // 파싱 helper 쪽 분기(블록 종료 · 대상 부재)는 기존 블록이 이미 cover 한다 — 재확인만.
      expect(extractTopLevelBlock("", "export function setup")).toBeNull();
      expect(consoleLogArgsOf("// console.log(`x`);")).toEqual([]);
    });
  });

  describe("negative cases 충분 cover — 보존 계약 · 합성 seed · chain · env · 로그 · 임계", () => {
    it("① teardown 에 person DELETE 반복문이 잔존 0 이다(공유 dataset 보존 계약)", () => {
      const down = s2Body("export function teardown");
      ["personIds", "/api/persons"].forEach((t) =>
        expect(down).not.toContain(t),
      );
      expect(down.match(/http\.del\(/g)).toHaveLength(2);
      // 대조군 — person 정리 루프를 되살린 변조는 같은 단언에서 즉시 걸린다.
      const drifted = down.replace(
        "  for (let i = 0; i < data.groupIds.length; i += 1) {",
        "  for (let i = 0; i < data.personIds.length; i += 1) {\n    http.del(`${BASE_URL}/api/persons/${data.personIds[i]}`, null, TEARDOWN_PARAMS);\n  }\n  for (let i = 0; i < data.groupIds.length; i += 1) {",
      );
      expect(drifted).toContain("/api/persons");
      expect(drifted.match(/http\.del\(/g)).toHaveLength(3);
    });

    it("② setup 에 POST /api/persons 합성 seed 가 잔존 0 이다(생성 회귀 차단)", () => {
      const script = s2Script();
      expect(script).not.toMatch(
        /http\.post\(\s*`\$\{BASE_URL\}\/api\/persons`/,
      );
      ["부하 대상 ${stamp}", "fullName:", 'created.json("id")'].forEach((t) =>
        expect(script).not.toContain(t),
      );
      // 남은 POST 는 group · part · signup · login 4 회뿐이다(잔존 생성 0).
      const setup = s2Body("export function setup");
      expect(setup.match(/http\.post\(/g)).toHaveLength(4);
    });

    it("③ personIds 단일 식이 중간 변수 · Math.min · 분기로 쪼개지면 단언이 깨진다", () => {
      const setup = s2Body("export function setup");
      expect(setup).toMatch(S2_PERSON_IDS_CHAIN);
      const split = setup.replace(
        "    .slice(0, SEED_PERSONS)",
        ";\n  const sampled = filtered.slice(0, SEED_PERSONS)",
      );
      expect(split).not.toMatch(S2_PERSON_IDS_CHAIN);
      // 분기 0 규약 — `||` 는 __ENV fallback 2 종뿐이다(BASE_URL · SEED_PERSONS).
      expect(s2Script().match(/\|\|/g)).toHaveLength(2);
    });

    it("④ 새 __ENV 키 추가가 0 이다(도메인은 env 가 아니라 상수 리터럴)", () => {
      const script = s2Script();
      expect(script.match(/__ENV\./g)).toHaveLength(2);
      ["K6_BASE_URL", SEED_ENV_KEY].forEach((k) =>
        expect(script).toContain(`__ENV.${k}`),
      );
      const block = extractStepBlock(loadYml(), S2_RUN_STEP_NAME) as string[];
      expect(extractKey(block, SEED_ENV_KEY)).toBe("30");
    });

    it("⑤ 로그에 email 원문 · 자격증명 · /api/ 경로 유입이 0 이다", () => {
      const arg = consoleLogArgsOf(s2Body("export function setup"))[0];
      S2_LOG_FORBIDDEN.forEach((t) => expect(arg).not.toContain(t));
      expect(arg).not.toContain("/api/");
      // 대조군 — 민감값을 실은 변조는 같은 단언에서 걸린다(tautology 아님).
      expect(arg.replace("`,", " cookie=${authCookie}`,")).toContain(
        "authCookie",
      );
      // route 집합 불변 — 로그가 경로 리터럴을 새로 들이지 않았다.
      const routes = S2_ROUTES.map(([, r]) => r);
      expect(apiRoutesOf(s2Script()).sort()).toEqual(
        [...routes, SIGNUP_ROUTE, LOGIN_ROUTE, AUTH_ROUTE].sort(),
      );
    });

    it("⑥ 임계 키 6 종 · 3000ms 숫자 · vus/duration 프로파일이 무변경이다", () => {
      const script = s2Script();
      expect(thresholdKeys(script)).toEqual(EXPECTED_THRESHOLD_KEYS);
      expect(script.match(/\["p\(95\)<3000"\]/g)).toHaveLength(5);
      ['http_req_failed: ["rate<0.01"]', "vus: 5", 'duration: "20s"'].forEach(
        (t) => expect(script).toContain(t),
      );
    });
  });
});

// T-1678 — S2 · S3 실행 step 의 `if: ${{ !cancelled() }}` 게이트 drift.
// 존재 이유 — T-1674 S2 1 회차(run 32746598803) 는 S1 leg 가 관찰용 임계 위반으로 exit 하자
// `if:` 없는 S2 · S3 step 이 통째로 skipped 로 떨어져 **S2 수치를 한 개도 남기지 못했다**.
// 배선이 다시 ① `if:` 유실 ② `always()` 로 바꿔치기(취소 시까지 부하 발생기 가동)
// ③ `continue-on-error` 동반(실패 은닉) ④ S1 게이트 우회 flag 유입 어느 쪽으로 drift 해도
// 부하 job 은 수동 발화 전용이라 상시 CI 는 green 이다 — 그 사각을 본 describe 가 닫는다.
//      🔥 실 GitHub Actions 발화 0 · 실 k6 실행 0 · 실 docker 실행 0 · YAML 파서 0 ·
//         새 helper 0 · 새 dependency 0 · DB 의존 0 — 파일 read + 합성 문자열 주입만.

/** S2 · S3 실행 step 이 가져야 하는 유일한 `if` 값(문자 단위 정본). */
const NOT_CANCELLED_IF = "${{ !cancelled() }}";
/** 대조군 — 요약 기록 · 정리 step 만이 가질 수 있는 `if` 값. */
const ALWAYS_IF = "always()";
/** `if: always()` 를 선언한 step 행만 세는 패턴(주석 안의 같은 문자열은 `#` 때문에 불일치). */
const ALWAYS_IF_LINE = /^\s*if:\s*always\(\)\s*$/gm;

describe("load-k6.yml S2 · S3 step 의 not-cancelled 게이트 배선 drift smoke (T-1678)", () => {
  describe("Happy-path: if 값 · step 순서 · package.json script parity", () => {
    it("(a) S2 · S3 실행 step 이 정확히 not-cancelled 표현식을 if 로 가진다", () => {
      const yml = loadYml();
      [S2_RUN_STEP_NAME, S3_RUN_STEP_NAME].forEach((name) => {
        const block = extractStepBlock(yml, name);
        expect(block).not.toBeNull();
        expect(extractKey(block as string[], "if")).toBe(NOT_CANCELLED_IF);
      });
    });

    it("(b) 두 step 이 여전히 S1 실행 step 뒤 · 정리 step 앞 순서다", () => {
      const yml = loadYml();
      const order = [
        stepIndexOf(yml, S1_RUN_STEP_NAME),
        stepIndexOf(yml, S2_RUN_STEP_NAME),
        stepIndexOf(yml, S3_RUN_STEP_NAME),
        stepIndexOf(yml, TEARDOWN_STEP_NAME),
      ];
      order.forEach((i) => expect(i).toBeGreaterThan(-1));
      expect(order).toEqual([...order].sort((a, b) => a - b));
    });

    it("(c) 두 step 의 run 이 package.json test:load:s2 · test:load:s3 와 문자 parity 다", () => {
      const yml = loadYml();
      const scripts = pkg().scripts;
      const s2Run = extractStep(yml, S2_RUN_STEP_NAME).run;
      const s3Run = extractStep(yml, S3_RUN_STEP_NAME).run;
      expect(s2Run).toBe(scripts["test:load:s2"]);
      expect(s3Run).toBe(scripts["test:load:s3"]);
      expect(scriptPathOf(s2Run)).toBe(S2_SCRIPT_REL);
      expect(scriptPathOf(s3Run)).toBe(S3_SCRIPT_REL);
    });

    it("(d) if 추가가 name · env 주입을 건드리지 않았다(문자 단위 무변경)", () => {
      const yml = loadYml();
      const s2 = extractStepBlock(yml, S2_RUN_STEP_NAME) as string[];
      expect(extractKey(s2, "K6_BASE_URL")).toBe(EXPECTED_BASE_URL);
      expect(extractKey(s2, "K6_SEED_PERSONS")).toBe("30");
      const s3 = extractStepBlock(yml, S3_RUN_STEP_NAME) as string[];
      expect(extractKey(s3, "K6_BASE_URL")).toBe(EXPECTED_BASE_URL);
      expect(extractKey(s3, "K6_SEED_PERSONS")).toBeNull();
    });
  });

  describe("Error path: 대상 부재 · non-string 입력", () => {
    /** 대상 step 이 하나도 없는 합성 workflow(실 파일 무관 — 추측 0 계약 확인용). */
    const NO_TARGET_YML = [
      "jobs:",
      "  load:",
      "    steps:",
      "      - name: 저장소 checkout",
      "        uses: actions/checkout@v4",
      "",
    ].join("\n");

    it("(e) 대상 부재 시 null · found:false · -1 을 돌려주고 throw 하지 않는다", () => {
      [S2_RUN_STEP_NAME, S3_RUN_STEP_NAME].forEach((name) => {
        expect(() => extractStepBlock(NO_TARGET_YML, name)).not.toThrow();
        expect(extractStepBlock(NO_TARGET_YML, name)).toBeNull();
        expect(extractStep(NO_TARGET_YML, name)).toEqual({
          found: false,
          uses: null,
          run: null,
        });
        expect(stepIndexOf(NO_TARGET_YML, name)).toBe(-1);
      });
    });

    it("(f) non-string 입력에는 TypeError 를 던진다(0-byte fallback false-PASS 차단)", () => {
      [S2_RUN_STEP_NAME, S3_RUN_STEP_NAME].forEach((name) => {
        expect(() =>
          extractStepBlock(undefined as unknown as string, name),
        ).toThrow(TypeError);
        expect(() => extractStep(null as unknown as string, name)).toThrow(
          TypeError,
        );
        expect(() => stepIndexOf(42 as unknown as string, name)).toThrow(
          TypeError,
        );
      });
      expect(() => extractStepBlock(loadYml(), 7 as unknown as string)).toThrow(
        TypeError,
      );
    });
  });

  describe("Flow: if 키 유무 · 따옴표 유무 · 블록 종료 지점 분기", () => {
    /** 합성 step 1 개 — `if` 값(null 이면 키 자체 생략)과 뒤따르는 꼬리를 갈아끼운다. */
    const synth = (
      name: string,
      ifValue: string | null,
      tail: string,
    ): string =>
      [
        "    steps:",
        `      - name: ${name}`,
        ...(ifValue === null ? [] : [`        if: ${ifValue}`]),
        "        env:",
        `          K6_BASE_URL: ${EXPECTED_BASE_URL}`,
        "        run: k6 run test/load/x.js",
        tail,
      ].join("\n");
    const NEXT_HEADER_TAIL = `      - name: ${TEARDOWN_STEP_NAME}\n        if: always()`;

    it("(g) if 키가 있는 갈래와 없는 갈래를 구분해 읽는다", () => {
      const withIf = synth(
        S2_RUN_STEP_NAME,
        NOT_CANCELLED_IF,
        NEXT_HEADER_TAIL,
      );
      const withoutIf = synth(S2_RUN_STEP_NAME, null, NEXT_HEADER_TAIL);
      expect(
        extractKey(
          extractStepBlock(withIf, S2_RUN_STEP_NAME) as string[],
          "if",
        ),
      ).toBe(NOT_CANCELLED_IF);
      expect(
        extractKey(
          extractStepBlock(withoutIf, S2_RUN_STEP_NAME) as string[],
          "if",
        ),
      ).toBeNull();
    });

    it("(h) 값에 따옴표가 있는 갈래도 unquote 정규화로 같은 결과가 된다", () => {
      [
        NOT_CANCELLED_IF,
        `"${NOT_CANCELLED_IF}"`,
        `'${NOT_CANCELLED_IF}'`,
      ].forEach((raw) => {
        const src = synth(S3_RUN_STEP_NAME, raw, NEXT_HEADER_TAIL);
        expect(
          extractKey(extractStepBlock(src, S3_RUN_STEP_NAME) as string[], "if"),
        ).toBe(NOT_CANCELLED_IF);
      });
    });

    it("(i) 블록이 다음 헤더에서 끊기는 갈래 / EOF 에서 끊기는 갈래가 같은 내용을 준다", () => {
      const cut = extractStepBlock(
        synth(S2_RUN_STEP_NAME, NOT_CANCELLED_IF, NEXT_HEADER_TAIL),
        S2_RUN_STEP_NAME,
      ) as string[];
      const eof = extractStepBlock(
        synth(S2_RUN_STEP_NAME, NOT_CANCELLED_IF, ""),
        S2_RUN_STEP_NAME,
      ) as string[];
      // 다음 헤더 갈래는 정리 step 을 삼키지 않는다.
      expect(cut.join("\n")).not.toContain(TEARDOWN_STEP_NAME);
      expect(cut).toHaveLength(5);
      // EOF 갈래는 꼬리 빈 행만 더 물 뿐 실질 내용이 같다.
      expect(eof.map((l) => l.trim()).filter((l) => l !== "")).toEqual(
        cut.map((l) => l.trim()),
      );
    });
  });

  describe("Negative: 게이트 우회 · 실패 은닉 · always() 오용 · mutation · CI 유입", () => {
    it("(1) S1 실행 step 은 여전히 if · continue-on-error 가 둘 다 null 이다", () => {
      const block = extractStepBlock(loadYml(), S1_RUN_STEP_NAME) as string[];
      ["if", "continue-on-error"].forEach((k) =>
        expect(extractKey(block, k)).toBeNull(),
      );
    });

    it("(2) S2 · S3 step 에 continue-on-error 가 없다(실패 은닉 차단)", () => {
      const yml = loadYml();
      [S2_RUN_STEP_NAME, S3_RUN_STEP_NAME].forEach((name) =>
        expect(
          extractKey(
            extractStepBlock(yml, name) as string[],
            "continue-on-error",
          ),
        ).toBeNull(),
      );
    });

    it("(3) S2 · S3 의 if 가 always() 가 아니고 always() step 은 요약 기록 · 정리 둘뿐이다", () => {
      const yml = loadYml();
      [S2_RUN_STEP_NAME, S3_RUN_STEP_NAME].forEach((name) =>
        expect(
          extractKey(extractStepBlock(yml, name) as string[], "if"),
        ).not.toBe(ALWAYS_IF),
      );
      expect(yml.match(ALWAYS_IF_LINE)).toHaveLength(2);
      [S1_SUMMARY_STEP_NAME, TEARDOWN_STEP_NAME].forEach((name) =>
        expect(extractKey(extractStepBlock(yml, name) as string[], "if")).toBe(
          ALWAYS_IF,
        ),
      );
    });

    it("(4) if 를 제거/변조한 합성본에서 본 단언이 실제로 검출된다(검출력 유실 0)", () => {
      const yml = loadYml();
      const removed = yml.split(`        if: ${NOT_CANCELLED_IF}\n`).join("");
      [S2_RUN_STEP_NAME, S3_RUN_STEP_NAME].forEach((name) =>
        expect(
          extractKey(extractStepBlock(removed, name) as string[], "if"),
        ).toBeNull(),
      );
      // always() 로 바꿔치기한 변조본은 (3) 의 개수 단언이 잡는다(2 → 4).
      const toAlways = yml.split(NOT_CANCELLED_IF).join(ALWAYS_IF);
      expect(
        extractKey(
          extractStepBlock(toAlways, S2_RUN_STEP_NAME) as string[],
          "if",
        ),
      ).toBe(ALWAYS_IF);
      expect(toAlways.match(ALWAYS_IF_LINE)).toHaveLength(4);
    });

    it("(5) ci.yml 에 S2 · S3 스크립트 경로와 test:load 키가 유입되지 않았다", () => {
      const ci = ciYml();
      [
        S2_SCRIPT_REL,
        S3_SCRIPT_REL,
        "test:load:s2",
        "test:load:s3",
        "k6",
      ].forEach((t) => expect(ci).not.toContain(t));
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// T-1682 — s3-concurrent.js 의 persons 행 수 로그 배선 drift. 존재 이유 — `#### S2 2 회차` 는
// 공유 dataset 보존을 `data_received` 정황으로만, `#### S3 1 회차` 는 자기 정리를 `http_reqs` 배수
// 로만 추정해야 했다. setup / teardown 의 로그 2 줄이 그 추정을 없애는데, 그 줄이 ① 사라지거나
// ② iteration 본문으로 새어 로그가 폭증하거나 ③ 민감값 · 경로 리터럴을 싣거나 ④ 분기 0 규약을
// 깨거나 ⑤ 준비/정리 tag 가 판정 tag 로 합쳐져 p95 를 오염시켜도 상시 CI 는 green 이다(부하 job
// 은 수동 dispatch 전용). 새 helper 1(routeTagsOf) 외 기존 재사용.
//      🔥 실 k6 실행 0 · 실 HTTP 0 · DB 의존 0 · 새 dependency 0 — 파일 read + 합성 문자열만.

/** 행 수 로그의 고정 prefix — 다음 사람이 `gh run view --log` 에서 값을 grep 하는 좌표다. */
const S3_ROW_LOG_PREFIX = "[s3-concurrent] persons 행 수";
/** 준비/정리 표본 왕복 전용 tag — 판정 tag 2 종(read / write)과 겹치면 안 된다. */
const S3_PROBE_TAGS = ["seed", "teardown"];
/** 로그 인자에 실리면 안 되는 토큰 — 자격증명 · cookie · email 원문 계열(민감값 유출 차단). */
const S3_LOG_FORBIDDEN_TOKENS = [
  "password",
  "cookie",
  "Cookie",
  "authCookie",
  "apiKey",
  "credentials",
  "email",
  "stamp",
];
/** 행 수 산출 식 — 조회 1 회 → `.json()` → `.length` 단일 chain(중간 변수로 쪼개지면 깨진다). */
const S3_ROW_COUNT_CHAIN =
  /http\s*\.get\(`\$\{BASE_URL\}\/api\/persons`,\s*(?:SEED|TEARDOWN)_PARAMS\)\s*\.json\(\)\s*\.length;/;

/**
 * 스크립트가 선언한 route tag 리터럴 목록(중복 제거 · 선언 순서 보존). `tags: { route: "x" }`
 * 형태만 센다 — 임계 키의 `{route:x}` 표기는 세지 않는다(집계 tag 와 임계 키의 혼동 차단).
 * @throws {TypeError} 입력이 non-string 일 때(extractTopLevelBlock 과 동형 fail-fast 계약).
 */
function routeTagsOf(script: string): string[] {
  if (typeof script !== "string") {
    throw new TypeError("routeTagsOf: script 는 string 이어야 함");
  }
  return Array.from(
    new Set(
      (script.match(/route: "[a-zA-Z]+"/g) || []).map((m) =>
        m.slice('route: "'.length, -1),
      ),
    ),
  );
}

describe("s3-concurrent.js persons 행 수 로그 배선 drift smoke (T-1682)", () => {
  describe("Happy-path: setup/teardown 각 1 왕복 · 두 수치 · 별도 tag · 주변 무변경", () => {
    it("① setup·teardown 이 실재하고 각각 GET 1 회 + console.log 1 회로 고정 prefix 를 싣는다", () => {
      expect(existsSync(path.join(REPO_ROOT, S3_SCRIPT_REL))).toBe(true);
      const setup = s3Body("export function setup");
      const teardown = s3Body("export function teardown");
      [setup, teardown].forEach((block) => {
        // 왕복은 정확히 1 회 — 표본 조회가 부하 iteration 수를 흉내내지 않는다.
        // (prettier 가 chain 을 `http\n.get(` 으로 접으므로 공백 허용 매칭으로 센다.)
        expect(block.match(/http\s*\.get\(/g)).toHaveLength(1);
        expect(block).toMatch(S3_ROW_COUNT_CHAIN);
        const args = consoleLogArgsOf(block);
        expect(args).toHaveLength(1);
        expect(args[0]).toContain(S3_ROW_LOG_PREFIX);
        // 인자는 template literal 하나뿐 — 객체 dump 같은 추가 인자를 붙이지 않는다.
        expect(args[0]).toMatch(/^`[^`]*`,?$/);
        // 표본 왕복은 읽기 전용 — POST / DELETE 를 늘리지 않는다.
        expect(block).not.toContain("http.post(");
        expect(block).not.toContain("http.del(");
      });
    });

    it("② teardown 로그가 종료 · 시작 두 수치를 담고 시작값은 setup 반환값으로 넘어온다", () => {
      const setupBlock = s3Body("export function setup");
      const setupArg = consoleLogArgsOf(setupBlock)[0];
      const teardownArg = consoleLogArgsOf(
        s3Body("export function teardown"),
      )[0];
      expect(setupArg).toContain("${startRows}");
      // 한 줄에 두 수치가 있어야 잔여 판정(종료 − 시작)이 로그만으로 성립한다.
      expect(teardownArg).toContain("${endRows}");
      expect(teardownArg).toContain("${data.startRows}");
      // 시작값 전달 경로 — setup 이 return 하고 teardown 이 파라미터로 받는다.
      expect(setupBlock).toContain(
        "return { startRows, startedAt: Date.now() };",
      );
      expect(s3Script()).toContain("export function teardown(data) {");
    });

    it("③ 준비/정리 tag 가 판정 tag 2 종과 겹치지 않고 default 본문 · 규약 주석이 무변경이다", () => {
      const script = s3Script();
      expect(routeTagsOf(script).sort()).toEqual(
        ["read", "write", ...S3_PROBE_TAGS].sort(),
      );
      S3_PROBE_TAGS.forEach((t) => expect(["read", "write"]).not.toContain(t));
      // 측정 iteration 본문은 그대로 — 표본 상수도 로그도 새어들지 않았다.
      const body = s3Body("export default function");
      ["http.post(", "http.get(", "http.del(", 'created.json("id")'].forEach(
        (t) => expect(body).toContain(t),
      );
      ["SEED_PARAMS", "TEARDOWN_PARAMS", "console.log("].forEach((t) =>
        expect(body).not.toContain(t),
      );
      // 규약 ②·⑤ 문장과 새 항등식 주석이 함께 남는다.
      expect(script).toContain(
        "② 한 iteration 이 만든 row 는 같은 iteration 이 지운다",
      );
      expect(script).toContain("⑤ 조건 분기 로직 0.");
      expect(script).toContain("3 × iterations + 2");
      // stages 총 지속시간 상한도 그대로(표본 왕복은 duration 선언을 늘리지 않는다).
      expect(
        stageSeconds(script).reduce((a, b) => a + b, 0),
      ).toBeLessThanOrEqual(S3_MAX_SEC);
    });
  });

  describe("Error path: 정본 부재 · 없는 블록 · 0-byte · non-string", () => {
    it("① 정본 경로 오탈자 read 와 없는 블록 추출이 조용히 PASS 하지 않는다", () => {
      expect(() =>
        readFileSync(path.join(REPO_ROOT, `${S3_SCRIPT_REL}.absent`)),
      ).toThrow();
      expect(() => s3Body("export function nonexistent")).toThrow();
    });

    it("② 빈 입력은 null · 빈 배열이고 non-string 은 TypeError 로 드러난다", () => {
      expect(extractTopLevelBlock("", "export function setup")).toBeNull();
      expect(consoleLogArgsOf("")).toEqual([]);
      expect(routeTagsOf("")).toEqual([]);
      [undefined, 42, null, {}].forEach((bad) => {
        expect(() => routeTagsOf(bad as unknown as string)).toThrow(TypeError);
        expect(() => consoleLogArgsOf(bad as unknown as string)).toThrow(
          TypeError,
        );
      });
    });
  });

  describe("flow / 분기 cover: 133 행 · 1 행 · 빈 배열(0 건)", () => {
    it("① 스크립트와 같은 식 하나가 세 갈래의 로그 수치를 만든다(실 k6 실행 0)", () => {
      // 스크립트의 산출 식은 `.json().length` 단일 chain — 같은 식을 합성 배열에 적용해 동치 검증.
      expect(s3Body("export function setup")).toMatch(S3_ROW_COUNT_CHAIN);
      const logged = (rows: { id: string }[]): number => rows.length;
      const many = Array.from({ length: 133 }, (_, i) => ({ id: `p${i}` }));
      expect(logged(many)).toBe(133); // 공유 dataset 보존 — S2 teardown 이 지우지 않았다.
      expect(logged([{ id: "solo" }])).toBe(1); // 잔여 1 행도 그대로 드러난다.
      expect(logged([])).toBe(0); // 빈 DB 위 false-PASS 가 0 으로 로그에 드러난다.
    });
  });

  describe("negative cases 충분 cover — 중복 · 유출 · 경로 · 분기 · 임계 · tag 합침", () => {
    it("(1) console.log 총 2 회이고 iteration 본문으로 새면 단언이 깨진다(합성 mutation)", () => {
      const script = s3Script();
      expect(consoleLogArgsOf(script)).toHaveLength(2);
      // iteration 마다 찍혀 로그가 폭증하는 회귀 — 합성본에서 default 본문 로그가 1 회로 잡힌다.
      const leaked = script.replace(
        "export default function (data) {",
        "export default function (data) {\n  console.log(`leak`);",
      );
      expect(leaked).not.toBe(script);
      expect(
        consoleLogArgsOf(
          (
            extractTopLevelBlock(leaked, "export default function") as string[]
          ).join("\n"),
        ),
      ).toHaveLength(1);
      expect(consoleLogArgsOf(s3Body("export default function"))).toEqual([]);
    });

    it("(2) 로그 인자에 자격증명 · cookie · email 원문 토큰 유입이 0 이다(대조군 동반)", () => {
      const args = consoleLogArgsOf(s3Script());
      args.forEach((arg) => {
        S3_LOG_FORBIDDEN_TOKENS.forEach((t) => expect(arg).not.toContain(t));
        // email 원문은 `@도메인` 형태로 새므로 그 패턴 자체를 금지한다.
        expect(arg).not.toMatch(/@[A-Za-z]/);
      });
      // 대조군 — 민감값을 실은 변조는 같은 단언에서 즉시 걸린다(단언이 tautology 가 아님).
      const drifted = `${args[0].slice(0, -1)} credentials.email\``;
      expect(drifted).toContain("credentials");
      expect(drifted).toContain("email");
    });

    it("(3) 로그 문자열에 /api/ 경로 리터럴 유입이 0 이다(route 집합 불변 · 대조군 동반)", () => {
      const script = s3Script();
      expect(apiRoutesOf(script)).toEqual(["/api/persons"]);
      consoleLogArgsOf(script).forEach((arg) =>
        expect(arg).not.toContain("/api/"),
      );
      // 대조군 — 로그에 경로를 실으면 route 집합이 커져 본 단언이 red 가 된다.
      const drifted = script.replace(
        S3_ROW_LOG_PREFIX,
        `${S3_ROW_LOG_PREFIX} /api/persons-rows`,
      );
      expect(apiRoutesOf(drifted).length).toBe(apiRoutesOf(script).length + 1);
    });

    it("(4) 분기 0 규약(T-1625 negative (4))이 로그 배선 후에도 회귀 0 이다(대조군 동반)", () => {
      const script = s3Script();
      const banned = ["/api/users", "Authorization", "if (", "} else", " ? "];
      [...GUARDED_PREFIXES, ...banned, " && "].forEach((t) =>
        expect(script).not.toContain(t),
      );
      // __ENV fallback 1 종만 남는다 — 로그가 `||` 를 늘리지 않았다.
      expect(script.match(/\|\|/g)).toHaveLength(1);
      // 대조군 — 로그를 조건부로 감싸는 변조는 분기 토큰 단언을 깨뜨린다.
      const drifted = script.replace(
        "  console.log(`[s3-concurrent]",
        "  if (startRows === 0) console.log(`[s3-concurrent]",
      );
      expect(drifted).not.toBe(script);
      expect(drifted).toContain("if (");
    });

    it("(5) 임계가 여전히 4 종 · 선언 순서 · 값 그대로다(새 tag 용 임계 추가 0)", () => {
      const script = s3Script();
      expect(thresholdKeys(script)).toEqual(S3_THRESHOLD_KEYS);
      expect(script.match(/p\(95\)<3000/g)).toHaveLength(3);
      expect(script.match(/rate<0\.01/g)).toHaveLength(1);
      // 준비/정리 tag 용 임계를 몰래 끼운 합성본은 키 개수 단언이 잡는다(4 → 5).
      const added = script.replace(
        '    "http_req_duration{route:write}": ["p(95)<3000"],',
        '    "http_req_duration{route:write}": ["p(95)<3000"],\n    "http_req_duration{route:seed}": ["p(95)<3000"],',
      );
      expect(added).not.toBe(script);
      expect(thresholdKeys(added)).toHaveLength(S3_THRESHOLD_KEYS.length + 1);
    });

    it("(6) 준비/정리 tag 가 판정 tag 로 합쳐지는 합성 mutation 에서 단언이 실제로 깨진다", () => {
      const script = s3Script();
      const merged = script
        .split('route: "seed"')
        .join('route: "read"')
        .split('route: "teardown"')
        .join('route: "write"');
      expect(merged).not.toBe(script);
      // 합쳐진 합성본에는 준비/정리 tag 가 남지 않아 p95 오염 차단이 무너진 것이 드러난다.
      S3_PROBE_TAGS.forEach((t) =>
        expect(routeTagsOf(merged)).not.toContain(t),
      );
      expect(routeTagsOf(merged).sort()).toEqual(["read", "write"]);
      // 원본은 mutate 되지 않는다 — 대조군이 성립한다.
      expect(routeTagsOf(s3Script()).sort()).toEqual(
        ["read", "write", ...S3_PROBE_TAGS].sort(),
      );
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// T-1688 — 부하 스크립트 3 종의 `options.summaryTrendStats` p(99) 배선 drift. 존재 이유 —
// 계획 §3 "집계" 규약 셋째 항(p99)이 S1 12·13 · S2 2·3 · S3 1·2 회차 전 회차에서 "미확보" 로
// 이월된 원인은 k6 기본 요약이 p(90) · p(95) 까지만 낸다는 것 하나뿐이었다. 설계 후보 A 가 그
// 열을 여는데, 그 선언이 ① 한 스크립트에서만 빠지거나 ② 기본 6 종 중 하나를 지워 기존 회차와
// 대조 불가가 되거나 ③ p(99) 가 관찰이 아니라 임계로 굳어도 상시 CI 는 green 이다(부하 job 은
// workflow_dispatch 전용). 새 helper 1(summaryTrendStatsOf) 외 기존 재사용.
//      🔥 실 k6 실행 0 · 실 HTTP 0 · DB 의존 0 · 새 dependency 0 — 파일 read + 합성 문자열만.

/** k6 가 기본으로 내는 Trend 통계 6 종 — 하나라도 지우면 기존 회차 기록과 열 대조가 끊긴다. */
const K6_DEFAULT_TREND_STATS = ["avg", "min", "med", "max", "p(90)", "p(95)"];
/** 설계 후보 A 가 더하는 열 하나 — 문제 (a)(p99 미확보)를 닫는 유일한 추가분. */
const ADDED_TREND_STAT = "p(99)";
/** 배선 대상 3 종 — 회차 기록이 있는 시나리오 스크립트만(smoke.js 는 측정 대상이 아니다). */
const TREND_STAT_SCRIPTS: [string, () => string][] = [
  [S1_SCRIPT_REL, s1Script],
  [S2_SCRIPT_REL, s2Script],
  [S3_SCRIPT_REL, s3Script],
];

/**
 * (T-1688) `options.summaryTrendStats` 배열의 원소 목록(선언 순서 보존).
 * 선언이 없으면 `null`(미발견 정규형 — 추측 0 · throw 0), non-string 입력은 `TypeError`.
 * 따옴표 종류(`"` / `'`)와 원소 사이 줄바꿈 배치가 달라도 같은 정규형을 낸다.
 */
function summaryTrendStatsOf(script: string): string[] | null {
  if (typeof script !== "string") {
    throw new TypeError("summaryTrendStatsOf: script 는 string 이어야 함");
  }
  const matched = script.match(/summaryTrendStats:\s*\[([^\]]*)\]/);
  if (matched === null) {
    return null;
  }
  return (matched[1].match(/"[^"]*"|'[^']*'/g) || []).map((raw) =>
    raw.slice(1, -1),
  );
}

/** 배선 불변식 — 선언이 있고 기본 6 종 + p(99) 를 모두 담고 있어야 true. */
function trendStatsIntact(script: string): boolean {
  const stats = summaryTrendStatsOf(script);
  return (
    stats !== null &&
    [...K6_DEFAULT_TREND_STATS, ADDED_TREND_STAT].every((s) =>
      stats.includes(s),
    )
  );
}

describe("부하 스크립트 3 종 summaryTrendStats p(99) 배선 drift smoke (T-1688)", () => {
  describe("Happy-path: 세 스크립트가 기본 6 종 + p(99) 를 선언한다", () => {
    TREND_STAT_SCRIPTS.forEach(([rel, read]) => {
      it(`${rel} 이 summaryTrendStats 로 기본 6 종 + p(99) 를 선언하고 목적 주석을 남긴다`, () => {
        expect(existsSync(path.join(REPO_ROOT, rel))).toBe(true);
        const script = read();
        const stats = summaryTrendStatsOf(script) as string[];
        expect(stats).not.toBeNull();
        // 기본 6 종은 선언 순서까지 그대로 — 기존 회차 기록의 열 대조가 유지된다.
        expect(stats.slice(0, K6_DEFAULT_TREND_STATS.length)).toEqual(
          K6_DEFAULT_TREND_STATS,
        );
        expect(stats).toContain(ADDED_TREND_STAT);
        expect(stats).toHaveLength(K6_DEFAULT_TREND_STATS.length + 1);
        expect(trendStatsIntact(script)).toBe(true);
        // 목적(관찰 전용 · 문제 (a) 회수)이 스크립트 안에 한국어 주석으로 남아 있다.
        expect(script).toContain("(T-1688)");
        expect(script).toContain("관찰 전용");
      });
    });

    it("세 스크립트의 선언이 서로 같은 정규형이라 회차 간 열 대조가 성립한다", () => {
      const declared = TREND_STAT_SCRIPTS.map(([, read]) =>
        summaryTrendStatsOf(read()),
      );
      expect(declared[0]).toEqual(declared[1]);
      expect(declared[1]).toEqual(declared[2]);
    });
  });

  describe("Error path: 정본 경로 오탈자 · non-string 입력", () => {
    it("없는 스크립트 경로 read 는 throw 하고 non-string 입력은 TypeError 다", () => {
      // 0-byte 조용한 fallback 으로 false-PASS 되지 않는다 — 경로가 틀리면 즉시 드러난다.
      expect(() =>
        readFileSync(path.join(REPO_ROOT, `${S1_SCRIPT_REL}.absent`)),
      ).toThrow();
      [undefined, 42, null, {}, []].forEach((bad) => {
        expect(() => summaryTrendStatsOf(bad as unknown as string)).toThrow(
          TypeError,
        );
      });
    });
  });

  describe("flow / 분기 cover: 선언 있음 · 없음 · 표기 변형", () => {
    it("(a) 배열이 있는 합성 입력은 원소 목록을 선언 순서 그대로 낸다", () => {
      expect(
        summaryTrendStatsOf('  summaryTrendStats: ["avg", "p(99)"],'),
      ).toEqual(["avg", "p(99)"]);
    });

    it("(b) 선언이 없는 입력은 throw 없이 null(미발견 정규형)이다", () => {
      expect(
        summaryTrendStatsOf("export const options = { vus: 1 };"),
      ).toBeNull();
      expect(summaryTrendStatsOf("")).toBeNull();
    });

    it("(c) 따옴표 종류 · 줄바꿈 배치가 달라도 같은 정규형을 낸다", () => {
      const expected = ["avg", "p(95)", "p(99)"];
      expect(
        summaryTrendStatsOf(`summaryTrendStats: ['avg', 'p(95)', 'p(99)']`),
      ).toEqual(expected);
      expect(
        summaryTrendStatsOf(
          'summaryTrendStats: [\n  "avg",\n  "p(95)",\n  "p(99)",\n]',
        ),
      ).toEqual(expected);
      expect(
        summaryTrendStatsOf(`summaryTrendStats:["avg",'p(95)',"p(99)"]`),
      ).toEqual(expected);
    });
  });

  describe("negative cases 충분 cover — 열 소실 · 임계화 · dependency · 트리거", () => {
    it("(1) p(99) 를 뺀 합성 본문이면 guard 가 검출한다(세 스크립트 각각)", () => {
      TREND_STAT_SCRIPTS.forEach(([, read]) => {
        const script = read();
        const dropped = script.replace(`, "${ADDED_TREND_STAT}"`, "");
        expect(dropped).not.toBe(script);
        expect(trendStatsIntact(dropped)).toBe(false);
        expect(summaryTrendStatsOf(dropped)).not.toContain(ADDED_TREND_STAT);
        // 원본은 mutate 되지 않는다 — 대조군이 성립한다.
        expect(trendStatsIntact(read())).toBe(true);
      });
    });

    it("(2) 기본 6 종 중 med 를 지운 합성 본문이면 guard 가 검출한다(열 소실 차단)", () => {
      TREND_STAT_SCRIPTS.forEach(([, read]) => {
        const script = read();
        const removed = script.replace(`"med", `, "");
        expect(removed).not.toBe(script);
        expect(trendStatsIntact(removed)).toBe(false);
        expect(summaryTrendStatsOf(removed)).not.toContain("med");
      });
    });

    it("(3) 세 스크립트 어디에도 p(99) 를 임계로 쓴 표현이 없다(관찰 전용 · 조항 ②)", () => {
      TREND_STAT_SCRIPTS.forEach(([, read]) => {
        const script = read();
        expect(script).not.toContain("p(99)<");
        // 주석을 뺀 코드 행에서 p(99) 는 summaryTrendStats 선언 한 곳뿐이다.
        const p99CodeLines = script
          .split("\n")
          .filter((l) => !l.trim().startsWith("//"))
          .filter((l) => l.includes(ADDED_TREND_STAT));
        expect(p99CodeLines).toHaveLength(1);
        expect(p99CodeLines[0]).toContain("summaryTrendStats:");
        // 임계 키 집합에도 새 항목이 붙지 않았다 — 판정면 문자 단위 0 변경.
        expect(thresholdKeys(script)).not.toContain("summaryTrendStats");
      });
      // 대조군 — p(99) 를 임계로 굳힌 합성본은 위 단언에서 즉시 걸린다.
      const drifted = s3Script().replace(
        'http_req_failed: ["rate<0.01"],',
        'http_req_failed: ["rate<0.01"],\n    http_req_duration: ["p(99)<3000"],',
      );
      expect(drifted).toContain("p(99)<");
    });

    it("(4) package.json 어디에도 k6 dependency 키가 없다(정적 바이너리 규약 승계)", () => {
      const p = pkg();
      const deps = Object.keys({ ...p.dependencies, ...p.devDependencies });
      ["k6", "@types/k6"].forEach((name) => expect(deps).not.toContain(name));
    });

    it("(5) load-k6.yml 에 여전히 pull_request · push · schedule 트리거가 없다", () => {
      const triggers = triggerSection(loadYml());
      ["pull_request:", "push:", "schedule:"].forEach((t) =>
        expect(triggers).not.toContain(t),
      );
      expect(triggers).toContain("workflow_dispatch:");
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// T-1689 — s3-concurrent.js 단계 식별 tag key 배선 drift. 존재 이유 — 계획 §3 설계 조항 ③ 이
// 굳힌 "판정 tag 를 늘리지 않고 새 tag key 1 개만 추가" 가 ① key 자체가 사라지거나 ② 단계 값이
// stages 3 단과 어긋나거나 ③ 단계 값이 route 축에 섞여 판정 sub-metric 표본이 쪼개지거나
// ④ 관찰 전용이어야 할 축이 임계로 굳거나 ⑤ 값 산출에 조건 분기가 스며들어도(머리 주석 규약 ⑤)
// 상시 CI 는 green 이다(부하 job 은 workflow_dispatch 전용). 새 helper 2 개 + 기존 재사용.
//      🔥 실 k6 실행 0 · 실 HTTP 0 · DB 의존 0 · 새 dependency 0 — 파일 read + 합성 문자열만.

/** 단계 식별 전용 tag key 정본 — route 축과 직교한 새 key 하나(조항 ③). */
const S3_STAGE_TAG_KEY = "stage";
/** options.stages 3 단과 1:1 대응하는 단계 값 3 종(선언 순서 그대로). */
const S3_STAGE_TAG_VALUES = ["1", "2", "3"];
/** route 값 집합 정본 — 여기에 단계 값이 섞이면 판정 표본이 단계 수만큼 쪼개진다. */
const S3_ROUTE_TAG_VALUES = ["read", "write", "seed", "teardown"];

/**
 * (T-1689) 스크립트가 선언한 `STAGE_TAG_VALUES` 원소 목록(선언 순서 보존).
 * 선언이 없으면 `null`(미발견 정규형 — 추측 0 · throw 0), non-string 입력은 `TypeError`.
 * 따옴표 종류(`"` / `'`)와 한 줄 / 여러 줄 배치가 달라도 같은 정규형을 낸다.
 */
function stageTagValuesOf(script: string): string[] | null {
  if (typeof script !== "string") {
    throw new TypeError("stageTagValuesOf: script 는 string 이어야 함");
  }
  const matched = script.match(/STAGE_TAG_VALUES\s*=\s*\[([^\]]*)\]/);
  if (matched === null) {
    return null;
  }
  return (matched[1].match(/"[^"]*"|'[^']*'/g) || []).map((raw) =>
    raw.slice(1, -1),
  );
}

/** (T-1689) `STAGE_TAG_KEY` 선언 값 — 부재면 `null`(추측 0), non-string 은 `TypeError`. */
function stageTagKeyOf(script: string): string | null {
  if (typeof script !== "string") {
    throw new TypeError("stageTagKeyOf: script 는 string 이어야 함");
  }
  const matched = script.match(/STAGE_TAG_KEY\s*=\s*("[^"]*"|'[^']*')/);
  return matched === null ? null : matched[1].slice(1, -1);
}

describe("s3-concurrent.js 단계 식별 tag key 배선 drift smoke (T-1689)", () => {
  describe("Happy-path: key 1 개 · 값 3 종 · route 축 불변 · 판정면 0 변경", () => {
    it("① stage tag key 가 실재하고 ② 값이 1·2·3 3 종이며 tags 객체에 실제로 배선된다", () => {
      const script = s3Script();
      expect(stageTagKeyOf(script)).toBe(S3_STAGE_TAG_KEY);
      expect(stageTagValuesOf(script)).toEqual(S3_STAGE_TAG_VALUES);
      // 선언만 있고 배선이 없으면 축이 생기지 않는다 — 요청 params 병합 경로까지 확인한다.
      expect(script).toContain("[STAGE_TAG_KEY]:");
      ["WRITE_PARAMS", "READ_PARAMS", "DELETE_PARAMS"].forEach((params) =>
        expect(script).toContain(`withStage(${params}, data.startedAt)`),
      );
    });

    it("③ route tag 값 집합이 기존 4 종 그대로이고 단계 값이 섞이지 않았다", () => {
      const script = s3Script();
      expect(routeTagsOf(script).sort()).toEqual(
        [...S3_ROUTE_TAG_VALUES].sort(),
      );
      routeTagsOf(script).forEach((value) =>
        S3_STAGE_TAG_VALUES.forEach((stage) =>
          expect(value).not.toContain(stage),
        ),
      );
      // 준비/정리 왕복은 단계 축 밖이다 — stages 가 도는 구간이 아니기 때문.
      expect(s3Body("export function setup")).not.toContain("withStage(");
      expect(s3Body("export function teardown")).not.toContain("withStage(");
    });

    it("④ 판정면이 문자 단위 0 변경이다(임계 4 종 순서 · 숫자 · p(99) 열 그대로)", () => {
      const script = s3Script();
      expect(thresholdKeys(script)).toEqual(S3_THRESHOLD_KEYS);
      expect(script.match(/p\(95\)<3000/g)).toHaveLength(3);
      expect(script.match(/rate<0\.01/g)).toHaveLength(1);
      expect(trendStatsIntact(script)).toBe(true);
      // 새 tag 용 임계는 0 — 단계 축은 관찰 전용이다(조항 ②).
      thresholdKeys(script).forEach((key) =>
        expect(key).not.toContain(`{${S3_STAGE_TAG_KEY}:`),
      );
      expect(
        stageSeconds(script).reduce((a, b) => a + b, 0),
      ).toBeLessThanOrEqual(S3_MAX_SEC);
    });

    it("단계 값 3 종이 stages 3 단 · 단 폭과 1:1 대응하고 기존 로그 2 줄은 회귀 0 이다", () => {
      const script = s3Script();
      expect(stageTargets(script)).toHaveLength(S3_STAGE_TAG_VALUES.length);
      // 경계 상수는 첫 단 duration(초)과 같은 폭이어야 축과 stages 가 갈리지 않는다.
      const stepMs = Number(
        (script.match(/STAGE_STEP_MS = (\d+)/) as RegExpMatchArray)[1],
      );
      expect(stepMs).toBe(stageSeconds(script)[0] * 1000);
      // T-1682 로그 2 줄과 startRows 소비 경로는 그대로다.
      expect(consoleLogArgsOf(script)).toHaveLength(2);
      expect(script).toContain("return { startRows, startedAt: Date.now() };");
      expect(s3Body("export function teardown")).toContain("data.startRows");
    });
  });

  describe("Error path: 0-byte · 선언 부재 · non-string(0-byte false-PASS 방지)", () => {
    it("빈 본문 · tag 선언 없는 합성 본문은 추측 없이 null 이고 non-string 은 TypeError 다", () => {
      [stageTagValuesOf, stageTagKeyOf].forEach((fn) => {
        expect(fn("")).toBeNull();
        expect(fn("export const options = { vus: 1 };")).toBeNull();
        [undefined, 42, null, {}, []].forEach((bad) =>
          expect(() => fn(bad as unknown as string)).toThrow(TypeError),
        );
      });
      // 정본 경로 오탈자도 조용히 PASS 하지 않는다.
      expect(() =>
        readFileSync(path.join(REPO_ROOT, `${S3_SCRIPT_REL}.absent`)),
      ).toThrow();
    });
  });

  describe("flow / 분기 cover: 표기 변형 · clamp 산술 3 구간 + 초과분", () => {
    it("따옴표 종류 · 한 줄/여러 줄 배치가 달라도 같은 정규형을 낸다", () => {
      expect(stageTagValuesOf(`STAGE_TAG_VALUES = ['1', '2', '3']`)).toEqual(
        S3_STAGE_TAG_VALUES,
      );
      expect(
        stageTagValuesOf(
          'const STAGE_TAG_VALUES = [\n  "1",\n  "2",\n  "3",\n];',
        ),
      ).toEqual(S3_STAGE_TAG_VALUES);
      expect(stageTagValuesOf(`STAGE_TAG_VALUES=["1",'2',"3"]`)).toEqual(
        S3_STAGE_TAG_VALUES,
      );
      expect(stageTagKeyOf(`const STAGE_TAG_KEY = 'stage';`)).toBe(
        S3_STAGE_TAG_KEY,
      );
    });

    it("clamp 산술 1 식이 3 구간과 초과분을 마지막 단으로 접는다(실 k6 실행 0)", () => {
      // 스크립트와 같은 식을 합성 경과시간에 적용해 동치 검증한다.
      const stageOf = (elapsedMs: number): string =>
        S3_STAGE_TAG_VALUES[
          Math.min(
            S3_STAGE_TAG_VALUES.length - 1,
            Math.floor(elapsedMs / 10000),
          )
        ];
      expect([0, 9999].map(stageOf)).toEqual(["1", "1"]);
      expect([10000, 19999].map(stageOf)).toEqual(["2", "2"]);
      expect([20000, 24999].map(stageOf)).toEqual(["3", "3"]);
      // ramp-down 뒤 잔여 iteration 도 4 번째 값을 만들지 않는다(clamp 분기).
      expect(stageOf(600000)).toBe("3");
    });
  });

  describe("negative cases 충분 cover — 축 소실 · 값 결손 · 축 오염 · 임계화 · 분기", () => {
    it("(1) stage tag 선언을 제거한 합성 본문을 guard 가 검출한다", () => {
      const script = s3Script();
      const dropped = script
        .split("STAGE_TAG_KEY")
        .join("//")
        .split("STAGE_TAG_VALUES")
        .join("//");
      expect(dropped).not.toBe(script);
      expect(stageTagKeyOf(dropped)).toBeNull();
      expect(stageTagValuesOf(dropped)).toBeNull();
      // 원본은 mutate 되지 않는다 — 대조군이 성립한다.
      expect(stageTagKeyOf(s3Script())).toBe(S3_STAGE_TAG_KEY);
    });

    it("(2) 단계 값 하나(3)를 지운 합성 본문을 guard 가 검출한다", () => {
      const script = s3Script();
      const removed = script.replace(`, "${S3_STAGE_TAG_VALUES[2]}"]`, "]");
      expect(removed).not.toBe(script);
      expect(stageTagValuesOf(removed)).toEqual(["1", "2"]);
      expect(stageTagValuesOf(removed)).not.toEqual(S3_STAGE_TAG_VALUES);
      expect(stageTagValuesOf(s3Script())).toEqual(S3_STAGE_TAG_VALUES);
    });

    it("(3) route 값에 단계 문자열을 섞은 합성 본문(판정 표본 오염)을 검출한다", () => {
      const script = s3Script();
      const polluted = script
        .split('route: "read"')
        .join(`route: "read${S3_STAGE_TAG_VALUES[1]}"`);
      expect(polluted).not.toBe(script);
      expect(routeTagsOf(polluted)).not.toContain("read");
      expect(routeTagsOf(polluted).sort()).not.toEqual(
        [...S3_ROUTE_TAG_VALUES].sort(),
      );
      expect(routeTagsOf(s3Script()).sort()).toEqual(
        [...S3_ROUTE_TAG_VALUES].sort(),
      );
    });

    it("(4) stage 를 임계 키로 굳힌 합성 본문(관찰 전용 위반)을 검출한다", () => {
      const script = s3Script();
      const drifted = script.replace(
        '    "http_req_duration{route:write}": ["p(95)<3000"],',
        '    "http_req_duration{route:write}": ["p(95)<3000"],\n    "http_req_duration{stage:2}": ["p(95)<3000"],',
      );
      expect(drifted).not.toBe(script);
      expect(thresholdKeys(drifted)).toHaveLength(S3_THRESHOLD_KEYS.length + 1);
      expect(
        thresholdKeys(drifted).some((k) => k.includes(`{${S3_STAGE_TAG_KEY}:`)),
      ).toBe(true);
      expect(thresholdKeys(s3Script())).toEqual(S3_THRESHOLD_KEYS);
    });

    it("(5) 조건 분기가 새로 들어간 합성 본문을 검출한다(머리 주석 규약 ⑤ 위반)", () => {
      const script = s3Script();
      const banned = ["if (", "} else", " ? ", " && ", "switch ("];
      [...GUARDED_PREFIXES, ...banned].forEach((t) =>
        expect(script).not.toContain(t),
      );
      // __ENV fallback 1 종만 남는다 — 단계 축이 `||` 를 늘리지 않았다.
      expect(script.match(/\|\|/g)).toHaveLength(1);
      const branched = script.replace(
        "const stageTagOf =",
        "const stageAlt = (e) => (e > 10 ? STAGE_TAG_VALUES[0] : STAGE_TAG_VALUES[1]);\nconst stageTagOf =",
      );
      expect(branched).not.toBe(script);
      expect(branched).toContain(" ? ");
      expect(s3Script()).not.toContain(" ? ");
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// T-1691 — s3-concurrent.js 단계별 custom Trend 배선(계획 §3 설계 조항 ⑥ 경로 β) drift.
// 존재 이유 — k6 종료 요약은 request tag 를 sub-metric 으로 자동 분해하지 않아(조항 ⑥ (가))
// T-1689 의 stage tag 만으로는 단계별 값이 만들어지지 않는다. 값을 만드는 유일한 배선이 내장
// `k6/metrics` 의 Trend record 라 ① import 소실 ② 단계 Trend 결손 ③ 3 왕복 중 record 누락
// ④ custom Trend 의 임계화(판정면 오염) ⑤ 조건 분기 유입 어느 것도 실 run 전에는 드러나지
// 않는다(부하 job 은 workflow_dispatch 전용). 새 helper 3 개 + 기존 재사용.
//      🔥 실 k6 실행 0 · 실 HTTP 0 · DB 의존 0 · 새 dependency 0 — 파일 read + 합성 문자열만.

/** k6 런타임 내장 metrics 모듈 — npm 설치 대상이 아니라 새 외부 dependency 0(조항 ⑥ (다)). */
const K6_METRICS_MODULE = "k6/metrics";
/** 단계별 Trend 지표 이름 정본 — 단계 값 3 종과 1:1 대응하는 고정 접두형. */
const S3_STAGE_TREND_NAMES = S3_STAGE_TAG_VALUES.map(
  (value) => `s3_stage_duration_${value}`,
);

/**
 * `k6/metrics` 에서 가져온 import 심볼 목록(선언 순서 보존). 한 줄 / 여러 줄 배치와 따옴표
 * 종류(`"` / `'`)가 달라도 같은 정규형을 낸다. 해당 import 가 없으면 `null`(추측 0).
 * @throws {TypeError} `script` 가 non-string 일 때(0-byte fallback false-PASS 방지).
 */
function k6MetricsImportsOf(script: string): string[] | null {
  if (typeof script !== "string") {
    throw new TypeError("k6MetricsImportsOf: script 는 string 이어야 함");
  }
  const matched = script.match(
    /import\s*\{([^}]*)\}\s*from\s*["']k6\/metrics["']/,
  );
  if (matched === null) {
    return null;
  }
  return matched[1]
    .split(",")
    .map((symbol) => symbol.trim())
    .filter((symbol) => symbol !== "");
}

/**
 * `new Trend("<name>")` 로 선언된 custom 지표 이름 목록(선언 순서 보존 · 따옴표 종류 무관 ·
 * 개별 `const` 와 객체 리터럴 배치 모두 같은 정규형). 선언이 없으면 `[]`(추측 0).
 * @throws {TypeError} `script` 가 non-string 일 때.
 */
function trendMetricNamesOf(script: string): string[] {
  if (typeof script !== "string") {
    throw new TypeError("trendMetricNamesOf: script 는 string 이어야 함");
  }
  return (script.match(/new\s+Trend\(\s*("[^"]*"|'[^']*')/g) || []).map(
    (declaration) =>
      (declaration.match(/("[^"]*"|'[^']*')/) as RegExpMatchArray)[1].slice(
        1,
        -1,
      ),
  );
}

/**
 * `.add(<인자>)` 호출의 인자 목록(중첩 괄호 없는 단순 인자만 · 등장 순서 보존). 부재면 `[]`.
 * @throws {TypeError} `source` 가 non-string 일 때.
 */
function trendAddArgsOf(source: string): string[] {
  if (typeof source !== "string") {
    throw new TypeError("trendAddArgsOf: source 는 string 이어야 함");
  }
  return (source.match(/\.add\(([^)]*)\)/g) || []).map((call) =>
    call.slice(".add(".length, -1).trim(),
  );
}

describe("s3-concurrent.js 단계별 custom Trend 배선 drift smoke (T-1691)", () => {
  describe("Happy-path: 내장 import · Trend 3 종 1:1 · 3 왕복 record · 판정면 0 변경", () => {
    it("① k6/metrics 의 Trend 를 내장 모듈에서 import 하고 새 dependency 는 0 이다", () => {
      const script = s3Script();
      expect(k6MetricsImportsOf(script)).toEqual(["Trend"]);
      expect(script).toContain(`from "${K6_METRICS_MODULE}"`);
      // 회수 수단은 k6 내장 기능 한정(조항 ①) — package.json 에는 k6 항목이 유입되지 않는다.
      const p = pkg();
      const deps = Object.keys({ ...p.dependencies, ...p.devDependencies });
      ["k6", "@types/k6", "k6-metrics"].forEach((name) =>
        expect(deps).not.toContain(name),
      );
    });

    it("② Trend 인스턴스 3 개가 단계 값 3 종과 1:1 대응하고 lookup 표 키가 그 값에서 나온다", () => {
      const script = s3Script();
      expect(trendMetricNamesOf(script)).toEqual(S3_STAGE_TREND_NAMES);
      expect(trendMetricNamesOf(script)).toHaveLength(
        (stageTagValuesOf(script) as string[]).length,
      );
      // 키를 STAGE_TAG_VALUES 원소로 만들어야 tag 값과 Trend 행이 같은 정본을 공유한다.
      S3_STAGE_TAG_VALUES.forEach((_, i) =>
        expect(script).toContain(`[STAGE_TAG_VALUES[${i}]]: new Trend(`),
      );
      // 단계 → Trend 선택은 조회 1 회다 — 분기 토큰이 새로 들어가지 않았다(규약 ⑤).
      ["if (", "} else", " ? ", " && ", "switch ("].forEach((token) =>
        expect(script).not.toContain(token),
      );
    });

    it("③ export default 의 write · read · delete 3 왕복이 모두 add 로 record 된다", () => {
      const body = s3Body("export default function");
      expect(trendAddArgsOf(body)).toEqual([
        "created.timings.duration",
        "listed.timings.duration",
        "removed.timings.duration",
      ]);
      // 단계 결정은 요청에 실제로 붙은 tag 재사용 — 요청 뒤 stageTagOf 재호출은 0 이다.
      ["writeParams", "readParams", "deleteParams"].forEach((params) =>
        expect(body).toContain(
          `STAGE_TRENDS[${params}.tags[STAGE_TAG_KEY]].add(`,
        ),
      );
      expect(body).not.toContain("stageTagOf(");
      ["WRITE_PARAMS", "READ_PARAMS", "DELETE_PARAMS"].forEach((params) =>
        expect(body).toContain(`withStage(${params}, data.startedAt)`),
      );
    });

    it("④ 판정면 0 변경 · custom Trend 임계 0 · 준비/정리 왕복 record 0 이다", () => {
      const script = s3Script();
      expect(thresholdKeys(script)).toEqual(S3_THRESHOLD_KEYS);
      expect(script.match(/p\(95\)<3000/g)).toHaveLength(3);
      expect(script.match(/rate<0\.01/g)).toHaveLength(1);
      expect(trendStatsIntact(script)).toBe(true);
      // custom 지표 이름이 임계 키에 섞이면 관찰 전용 계약이 깨진다(조항 ⑥ (라)).
      S3_STAGE_TREND_NAMES.forEach((name) =>
        thresholdKeys(script).forEach((key) => expect(key).not.toContain(name)),
      );
      // 단계 축 밖인 seed / teardown 왕복은 record 하지 않고 로그 2 줄도 회귀 0 이다.
      ["export function setup", "export function teardown"].forEach((header) =>
        expect(trendAddArgsOf(s3Body(header))).toEqual([]),
      );
      expect(consoleLogArgsOf(script)).toHaveLength(2);
      expect(script).toContain("return { startRows, startedAt: Date.now() };");
    });
  });

  describe("Error path: 0-byte · import/선언 부재 · non-string(0-byte false-PASS 방지)", () => {
    it("빈 본문과 배선 없는 합성 본문은 추측 없이 null · 빈 배열을 낸다", () => {
      expect(k6MetricsImportsOf("")).toBeNull();
      expect(k6MetricsImportsOf('import http from "k6/http";')).toBeNull();
      [trendMetricNamesOf, trendAddArgsOf].forEach((fn) => {
        expect(fn("")).toEqual([]);
        expect(fn("export const options = { vus: 1 };")).toEqual([]);
      });
      // 정본 경로 오탈자 read 도 조용히 PASS 하지 않는다.
      expect(() =>
        readFileSync(path.join(REPO_ROOT, `${S3_SCRIPT_REL}.absent`)),
      ).toThrow();
    });

    it("non-string 입력은 세 helper 모두 TypeError 로 드러난다(명시 계약)", () => {
      [k6MetricsImportsOf, trendMetricNamesOf, trendAddArgsOf].forEach((fn) =>
        [undefined, 42, null, {}, []].forEach((bad) =>
          expect(() => fn(bad as unknown as string)).toThrow(TypeError),
        ),
      );
    });
  });

  describe("flow / 분기 cover: 따옴표 · 한 줄/여러 줄 import · const/객체 리터럴 선언", () => {
    it("따옴표 종류와 import 배치가 달라도 같은 정규형을 낸다", () => {
      expect(k6MetricsImportsOf(`import { Trend } from 'k6/metrics';`)).toEqual(
        ["Trend"],
      );
      expect(
        k6MetricsImportsOf(
          'import {\n  Trend,\n  Counter,\n} from "k6/metrics";',
        ),
      ).toEqual(["Trend", "Counter"]);
      expect(k6MetricsImportsOf(`import {Trend} from "k6/metrics"`)).toEqual([
        "Trend",
      ]);
    });

    it("Trend 선언이 개별 const 든 객체 리터럴이든 같은 이름 목록을 낸다", () => {
      const asConsts = S3_STAGE_TREND_NAMES.map(
        (name, i) => `const t${i} = new Trend('${name}', true);`,
      ).join("\n");
      const asLiteral = `const M = {\n${S3_STAGE_TREND_NAMES.map(
        (name, i) => `  [V[${i}]]: new Trend("${name}", true),`,
      ).join("\n")}\n};`;
      expect(trendMetricNamesOf(asConsts)).toEqual(S3_STAGE_TREND_NAMES);
      expect(trendMetricNamesOf(asLiteral)).toEqual(S3_STAGE_TREND_NAMES);
      // 인자 없는 호출은 이름을 만들어내지 않는다(추측 0).
      expect(trendMetricNamesOf("new Trend()")).toEqual([]);
      // add 인자도 공백 배치와 무관하게 같은 정규형이다.
      expect(trendAddArgsOf("a.add( x.y );\nb.add(z)")).toEqual(["x.y", "z"]);
    });
  });

  describe("negative cases 충분 cover — import 소실 · Trend 결손 · record 누락 · 임계화 · 분기", () => {
    it("(1) k6/metrics import 를 지운 합성 본문을 guard 가 검출한다", () => {
      const script = s3Script();
      const dropped = script.replace(
        `import { Trend } from "${K6_METRICS_MODULE}";`,
        "",
      );
      expect(dropped).not.toBe(script);
      expect(k6MetricsImportsOf(dropped)).toBeNull();
      expect(k6MetricsImportsOf(s3Script())).toEqual(["Trend"]);
    });

    it("(2) 단계 3 의 Trend 인스턴스를 지운 합성 본문을 guard 가 검출한다", () => {
      const script = s3Script();
      const removed = script.replace(
        `  [STAGE_TAG_VALUES[2]]: new Trend("${S3_STAGE_TREND_NAMES[2]}", true),\n`,
        "",
      );
      expect(removed).not.toBe(script);
      expect(trendMetricNamesOf(removed)).toEqual(
        S3_STAGE_TREND_NAMES.slice(0, 2),
      );
      expect(trendMetricNamesOf(removed)).not.toEqual(S3_STAGE_TREND_NAMES);
      expect(trendMetricNamesOf(s3Script())).toEqual(S3_STAGE_TREND_NAMES);
    });

    it("(3) 3 왕복 중 하나의 record 를 지운 합성 본문을 guard 가 검출한다", () => {
      const body = s3Body("export default function");
      const cut = body.replace(
        "  STAGE_TRENDS[readParams.tags[STAGE_TAG_KEY]].add(listed.timings.duration);\n",
        "",
      );
      expect(cut).not.toBe(body);
      expect(trendAddArgsOf(cut)).toHaveLength(2);
      expect(trendAddArgsOf(cut)).not.toContain("listed.timings.duration");
      expect(trendAddArgsOf(s3Body("export default function"))).toHaveLength(3);
    });

    it("(4) custom Trend 를 임계로 굳힌 합성 본문(판정면 오염)을 검출한다", () => {
      const script = s3Script();
      const drifted = script.replace(
        '    http_req_failed: ["rate<0.01"],',
        `    http_req_failed: ["rate<0.01"],\n    ${S3_STAGE_TREND_NAMES[0]}: ["p(95)<3000"],`,
      );
      expect(drifted).not.toBe(script);
      expect(thresholdKeys(drifted)).toHaveLength(S3_THRESHOLD_KEYS.length + 1);
      expect(thresholdKeys(drifted)).toContain(S3_STAGE_TREND_NAMES[0]);
      expect(thresholdKeys(s3Script())).toEqual(S3_THRESHOLD_KEYS);
    });

    it("(5) 조건 분기가 새로 들어간 합성 본문을 검출한다(머리 주석 규약 ⑤ 위반)", () => {
      const script = s3Script();
      [...GUARDED_PREFIXES, "if (", "} else", " ? ", " && "].forEach((token) =>
        expect(script).not.toContain(token),
      );
      // __ENV fallback 1 종만 남는다 — Trend 배선이 `||` 를 늘리지 않았다.
      expect(script.match(/\|\|/g)).toHaveLength(1);
      const branched = script.replace(
        "  STAGE_TRENDS[writeParams.tags[STAGE_TAG_KEY]].add(",
        "  if (created.status === 201) STAGE_TRENDS[STAGE_TAG_VALUES[0]].add(",
      );
      expect(branched).not.toBe(script);
      expect(branched).toContain("if (");
      expect(s3Script()).not.toContain("if (");
    });

    it("(6) package.json 의 dependencies · devDependencies 에 k6 항목 유입이 0 이다", () => {
      const p = pkg();
      const deps = Object.keys({ ...p.dependencies, ...p.devDependencies });
      ["k6", "@types/k6", "k6-metrics", "k6/metrics"].forEach((name) =>
        expect(deps).not.toContain(name),
      );
      // 대조군 — 유입된 합성 목록은 같은 단언에서 즉시 걸린다(단언이 tautology 가 아님).
      expect([...deps, "k6"]).toContain("k6");
    });
  });
});
