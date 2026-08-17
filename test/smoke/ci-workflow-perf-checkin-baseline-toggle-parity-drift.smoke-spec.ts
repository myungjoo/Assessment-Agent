// ci-workflow-perf-checkin-baseline-toggle-parity-drift.smoke-spec.ts
// — `.github/workflows/ci.yml` 의 `perf test` step 이 싣는 체크인 baseline 비교 opt-in 토글
// (`env:` 매핑의 키·값) ↔ 판정 primitive 정본(`test/perf/checkin-baseline-plan.ts` 의
// `CHECKIN_BASELINE_ENV_FLAG` 상수 · `isCheckinBaselineEnabled` 판정) parity 를, 실 ci.yml 을
// readFileSync + 정적 텍스트 추출로 대조하는 drift-detection non-gated smoke (T-1584 박제).
//
// 존재 이유 — ADR-0056 §Decision 4 는 체크인 baseline 비교를 별도 job 신설 없이 기존 `perf
// test` step 재사용으로 편입하기로 못 박았고 §Follow-ups (b) 가 집행을 남겼다. 집행의 실체는 그
// step 에 `PERF_CHECKIN_BASELINE: "1"` 을 싣는 한 줄이고, 그 한 줄은 문자열 일치에 전적으로
// 의존한다. primitive 쪽 상수가 rename 되거나 ci.yml 쪽 키·값이 어긋나면(판정은 trim + 소문자화
// 후 `1`/`true`/`yes` 만 on 으로 인정 — 관대한 truthy 해석 금지) 토글이 조용히 off 로 떨어져
// 비교 경로가 CI 에서 한 번도 실행되지 않는다. exit code 는 불변(§Decision 3 (b))이라 CI 는 계속
// green — 기존 어떤 layer 도 이 drift 를 잡지 못한다. 본 spec 이 그 빈 자리를 메운다.
//
//      🔥 실 GitHub Actions 발화·실 pnpm 실행·실 perf 스위트 발화·실 CI run 0 — 파일 read +
//         정적 텍스트 추출 + 합성 문자열 mutation 만. NestJS import 0 · DB 의존 0.
//         process.env 읽기/쓰기 0 — 판정에는 합성 record 를 주입한다(ambient 토글 무관).
//      🔥 새 외부 dependency 0 — node 내장(`fs`/`path`) + repo 내 상수 import 만(YAML 파서 0).
//
// Out of Scope (T-1584): src·`test/perf/*.ts` 변경 0(primitive 는 import 해 읽기만) · ci.yml
//   변경 0(read only) · 완전한 YAML 파싱 0 · 다른 step 의 env 계약 단언 0 · T-0796 재단언 0.
import { readFileSync, existsSync } from "fs";
import * as path from "path";

import {
  CHECKIN_BASELINE_ENV_FLAG,
  isCheckinBaselineEnabled,
} from "../perf/checkin-baseline-plan";

// repo-root 경로 — 실행 cwd 무관하게 `__dirname`(= test/smoke) 기준 두 단계 위로 고정.
const REPO_ROOT = path.resolve(__dirname, "../..");
const CI_YML_PATH = path.join(REPO_ROOT, ".github/workflows/ci.yml");

/** 토글을 싣는 대상 step 이름과 그 step 이 유지해야 하는 `run:` 정본(§Decision 4). */
const PERF_STEP_NAME = "perf test";
const PERF_STEP_RUN = "pnpm test:perf";

/** ci.yml 한 step 에서 뽑아낸 정규형 — 존재 여부 · env 매핑 · run 커맨드. */
interface CiStepExtraction {
  found: boolean;
  env: Record<string, string>;
  run: string | null;
}

/** 행의 선행 공백 수(YAML 블록 경계 판정용). */
function indentOf(line: string): number {
  return line.length - line.trimStart().length;
}

/** 값의 감싼 따옴표만 벗긴다(내부 공백은 보존 — trim 정규화는 판정 함수 몫). */
function unquote(raw: string): string {
  const v = raw.trim();
  const q = v[0];
  return v.length >= 2 && (q === '"' || q === "'") && v[v.length - 1] === q
    ? v.slice(1, -1)
    : v;
}

/**
 * `- name: <stepName>` 헤더로 시작하는 step 블록 행들을 잘라낸다(헤더보다 깊은 들여쓰기가
 * 이어지는 동안 계속, 같거나 얕은 비어있지 않은 행에서 종료). 대상 부재면 `null`(추측 0).
 *
 * @throws {TypeError} `ciSource`/`stepName` 이 non-string 일 때(0-byte fallback false-PASS 방지).
 */
function extractStepBlock(ciSource: string, stepName: string): string[] | null {
  if (typeof ciSource !== "string") {
    throw new TypeError("extractStepBlock: ciSource 는 string 이어야 함");
  }
  if (typeof stepName !== "string") {
    throw new TypeError("extractStepBlock: stepName 은 string 이어야 함");
  }
  const lines = ciSource.split("\n");
  const headerIdx = lines.findIndex((l) => l.trim() === `- name: ${stepName}`);
  if (headerIdx < 0) {
    return null;
  }
  const headerIndent = indentOf(lines[headerIdx]);
  const block = [lines[headerIdx]];
  for (let i = headerIdx + 1; i < lines.length; i += 1) {
    const line = lines[i];
    if (line.trim() !== "" && indentOf(line) <= headerIndent) {
      break;
    }
    block.push(line);
  }
  return block;
}

/** step 블록의 `env:` 매핑을 `KEY: VALUE` 로 추출한다(블록 부재면 빈 객체). */
function extractEnvMap(block: string[]): Record<string, string> {
  const env: Record<string, string> = {};
  const envIdx = block.findIndex((l) => l.trim() === "env:");
  if (envIdx < 0) {
    return env;
  }
  const envIndent = indentOf(block[envIdx]);
  for (let i = envIdx + 1; i < block.length; i += 1) {
    const line = block[i];
    if (line.trim() === "" || line.trim().startsWith("#")) {
      continue;
    }
    if (indentOf(line) <= envIndent) {
      break;
    }
    const m = line.trim().match(/^([A-Za-z_][A-Za-z0-9_]*):\s*(.*)$/);
    if (m) {
      env[m[1]] = unquote(m[2]);
    }
  }
  return env;
}

/** step 블록의 `run:` 한 줄 값(인라인 형태만 — block scalar 는 `|` 그대로). */
function extractRun(block: string[]): string | null {
  const runLine = block.find((l) => l.trim().startsWith("run:"));
  return runLine ? runLine.trim().slice("run:".length).trim() : null;
}

/** ci.yml 텍스트에서 한 step 의 정규형을 낸다(대상 부재면 found=false · 빈 env · run null). */
function extractStep(ciSource: string, stepName: string): CiStepExtraction {
  const block = extractStepBlock(ciSource, stepName);
  return block === null
    ? { found: false, env: {}, run: null }
    : { found: true, env: extractEnvMap(block), run: extractRun(block) };
}

/** 실 ci.yml 의 토글 값만 합성으로 바꿔(원본은 read only) 추출한 env 매핑을 낸다. */
function envWithSyntheticValue(rawYamlValue: string): Record<string, string> {
  const mutated = readFileSync(CI_YML_PATH, "utf8").replace(
    `${CHECKIN_BASELINE_ENV_FLAG}: "1"`,
    `${CHECKIN_BASELINE_ENV_FLAG}: ${rawYamlValue}`,
  );
  return extractStep(mutated, PERF_STEP_NAME).env;
}

describe("ci.yml perf test step 체크인 baseline 토글(env: PERF_CHECKIN_BASELINE) ↔ 판정 primitive(CHECKIN_BASELINE_ENV_FLAG · isCheckinBaselineEnabled) parity drift smoke (T-1584)", () => {
  describe("Happy-path: 실 ci.yml 추출 + 판정 primitive 대조", () => {
    it("perf test step 의 env 키가 CHECKIN_BASELINE_ENV_FLAG 와 일치하고 값이 isCheckinBaselineEnabled 로 true 이며 run 은 pnpm test:perf 불변", () => {
      const step = extractStep(
        readFileSync(CI_YML_PATH, "utf8"),
        PERF_STEP_NAME,
      );

      expect(step.found).toBe(true);
      // 키 parity — 문자열 하드코딩이 아니라 상수 import 로 대조(rename drift 검출).
      expect(Object.keys(step.env)).toContain(CHECKIN_BASELINE_ENV_FLAG);
      // 값 parity — 판정 primitive 가 실제로 on 으로 읽는 값이어야 한다.
      expect(isCheckinBaselineEnabled(step.env)).toBe(true);
      // §Decision 4 — 기존 step 재사용이라 run 커맨드는 불변.
      expect(step.run).toBe(PERF_STEP_RUN);
      // 결정론 — 같은 소스를 다시 태워도 deep-equal.
      expect(
        extractStep(readFileSync(CI_YML_PATH, "utf8"), PERF_STEP_NAME),
      ).toEqual(step);
    });

    it("repo-root 가 __dirname 기준으로 해석되어 실 ci.yml 이 실재하고 토글 키 문자열을 담는다", () => {
      expect(existsSync(CI_YML_PATH)).toBe(true);
      expect(readFileSync(CI_YML_PATH, "utf8")).toContain(
        CHECKIN_BASELINE_ENV_FLAG,
      );
    });
  });

  describe("flow / 분기 cover — env 유무 · step 부재 · 판정 on/off", () => {
    it("(a) env 블록이 있는 step → env 비어있지 않음 / (b) env 블록이 없는 실 step(스모크 테스트) → 빈 env + run 은 추출됨", () => {
      const ciSource = readFileSync(CI_YML_PATH, "utf8");

      expect(
        Object.keys(extractStep(ciSource, PERF_STEP_NAME).env).length,
      ).toBeGreaterThan(0);

      const withoutEnv = extractStep(ciSource, "스모크 테스트");
      expect(withoutEnv.found).toBe(true);
      expect(withoutEnv.env).toEqual({});
      expect(withoutEnv.run).toBe("pnpm test:smoke");
    });

    it("(c) 대상 step 이름이 없는 합성 소스 → found=false · 빈 env · run null", () => {
      const synthetic = "      - name: Lint\n        run: pnpm lint";
      expect(extractStep(synthetic, PERF_STEP_NAME)).toEqual({
        found: false,
        env: {},
        run: null,
      });
    });

    it("isCheckinBaselineEnabled 의 on 3종(1·true·yes)과 off 계열(미설정·빈문자열·0·false)을 각각 태워 분기를 모두 cover", () => {
      ["1", "true", "yes"].forEach((v) => {
        expect(
          isCheckinBaselineEnabled({ [CHECKIN_BASELINE_ENV_FLAG]: v }),
        ).toBe(true);
      });
      expect(isCheckinBaselineEnabled({})).toBe(false);
      ["", "0", "false"].forEach((v) => {
        expect(
          isCheckinBaselineEnabled({ [CHECKIN_BASELINE_ENV_FLAG]: v }),
        ).toBe(false);
      });
    });
  });

  describe("drift-detection 변별성 / negative cases 충분 cover", () => {
    it("(a) 합성에서 env 블록을 제거 → 토글 부재가 검출되고 원본 추출은 불변(mutate 0)", () => {
      const ciSource = readFileSync(CI_YML_PATH, "utf8");
      const before = extractStep(ciSource, PERF_STEP_NAME);

      const mutated = ciSource.replace(
        `        env:\n          ${CHECKIN_BASELINE_ENV_FLAG}: "1"\n`,
        "",
      );
      const after = extractStep(mutated, PERF_STEP_NAME);
      expect(after.found).toBe(true);
      expect(Object.keys(after.env)).not.toContain(CHECKIN_BASELINE_ENV_FLAG);
      expect(isCheckinBaselineEnabled(after.env)).toBe(false);
      // run 은 그대로 — env 만 사라진 drift 임을 대조군으로 확인.
      expect(after.run).toBe(PERF_STEP_RUN);

      // 원본 재추출이 baseline 과 deep-equal — 보조 함수가 입력을 mutate 하지 않는다.
      expect(extractStep(ciSource, PERF_STEP_NAME)).toEqual(before);
    });

    it('(b) 합성 값이 "0" 이면 토글 off 로 판정', () => {
      const env = envWithSyntheticValue('"0"');
      expect(env[CHECKIN_BASELINE_ENV_FLAG]).toBe("0");
      expect(isCheckinBaselineEnabled(env)).toBe(false);
    });

    it('(c) 값 앞뒤 공백·대문자(" TRUE ")도 추출 후 on 으로 정규화된다', () => {
      const env = envWithSyntheticValue('" TRUE "');
      // 따옴표만 벗기고 내부 공백은 보존 — 정규화는 판정 함수 책임.
      expect(env[CHECKIN_BASELINE_ENV_FLAG]).toBe(" TRUE ");
      expect(isCheckinBaselineEnabled(env)).toBe(true);
    });

    it("(d) yes-please 같은 관대 truthy 오인 값은 off(관대한 해석 금지)", () => {
      const env = envWithSyntheticValue('"yes-please"');
      expect(env[CHECKIN_BASELINE_ENV_FLAG]).toBe("yes-please");
      expect(isCheckinBaselineEnabled(env)).toBe(false);
      expect(
        isCheckinBaselineEnabled({ [CHECKIN_BASELINE_ENV_FLAG]: "onn" }),
      ).toBe(false);
    });

    it("(e) perf test step 의 run 을 pnpm test:perf 가 아닌 것으로 바꾼 합성 → §Decision 4 계약 위반 검출", () => {
      const mutated = readFileSync(CI_YML_PATH, "utf8").replace(
        "run: pnpm test:perf",
        "run: pnpm test:perf:checkin",
      );
      const step = extractStep(mutated, PERF_STEP_NAME);
      expect(step.run).not.toBe(PERF_STEP_RUN);
      // 토글이 그대로여도 run 계약이 깨지면 별도 스위트 신설 drift 다.
      expect(isCheckinBaselineEnabled(step.env)).toBe(true);
    });
  });

  describe("Error path", () => {
    it("존재하지 않는 경로로 readFileSync → ENOENT throw(silent 0-byte fallback false-PASS 방지)", () => {
      const bad = path.join(REPO_ROOT, ".github/workflows/ci.absent.yml");
      expect(() => readFileSync(bad, "utf8")).toThrow();
      expect(existsSync(bad)).toBe(false);
    });

    it("추출 helper 에 non-string 입력 → TypeError, 빈 문자열 → found=false(추측 0)", () => {
      expect(() =>
        extractStepBlock(undefined as unknown as string, PERF_STEP_NAME),
      ).toThrow(TypeError);
      expect(() =>
        extractStepBlock(null as unknown as string, PERF_STEP_NAME),
      ).toThrow(TypeError);
      expect(() =>
        extractStepBlock("- name: x", 42 as unknown as string),
      ).toThrow(TypeError);
      expect(extractStep("", PERF_STEP_NAME)).toEqual({
        found: false,
        env: {},
        run: null,
      });
    });

    it("isCheckinBaselineEnabled 에 null 주입 → TypeError, non-string 값은 예외 없이 off", () => {
      expect(() =>
        isCheckinBaselineEnabled(null as unknown as Record<string, string>),
      ).toThrow(TypeError);
      expect(
        isCheckinBaselineEnabled({
          [CHECKIN_BASELINE_ENV_FLAG]: 1 as unknown as string,
        }),
      ).toBe(false);
    });
  });
});
