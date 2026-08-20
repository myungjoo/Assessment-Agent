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
      // 실 load-k6.yml 의 마지막 step 은 파일 끝에서 블록이 끝난다(EOF 분기).
      const eofBlock = extractStepBlock(loadYml(), RUN_STEP_NAME) as string[];
      expect(eofBlock[0].trim()).toBe(`- name: ${RUN_STEP_NAME}`);
      expect(extractKey(eofBlock, "run")).toBe(`k6 run ${LOAD_SCRIPT_REL}`);
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
  });
});
