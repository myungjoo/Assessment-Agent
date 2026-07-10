// realdata-e2e-daily-test-machine-result-json-schema-order-driven-steps-parity-drift.smoke-spec.ts
// — 실 평가 e2e step④ `deploy/daily-test.sh` 가 stdout/`deploy/logs/latest-result.json` 으로
// 내보내는 머신 요약 JSON 의 6-키 스키마(`ts`·`gitSha`·`result`·`failedStep`·`steps`·`logPath`)
// ↔ `steps` 객체 키 집합 == `ORDER` 배열(redeploy·health·liveness·auth·eval·collect) ↔ `failedStep`
// null(unquoted)/quoted-string 두 직렬화 분기 contract parity 를 실 shell 파일을 readFileSync
// 로 읽어 정적 검증하는 cross-artifact(shell→machine-JSON) drift-detection non-gated build-time
// smoke (T-0791 박제, PLAN.md 109행 🟢 실 평가 e2e step④).
//
// 본 spec 의 존재 이유 — 머신 요약 JSON 스키마 contract gap 해소:
//   - PLAN 109행 step④·`deploy/daily-test.sh` 헤더(18~23행)는 nightly 자율 실 평가 e2e 가
//     머신 요약 JSON 을 stdout/`latest-result.json` 으로 내보내고 **로컬 PC 의 무인 모니터링
//     routine 이 그 JSON 을 파싱**해 nightly 상태를 판단함을 명시한다. 즉 이 JSON 의 스키마
//     (키 집합·키 순서·값 직렬화 형식)는 **무인 모니터링의 운영 contract** 다.
//   - 이 contract 는 origin/main 시점에 **검증 0 부재** 였다:
//      (1) bash test `deploy/daily-test-step-eval.test.sh`(T-0612) 는 `ORDER` 배열 값·`mark`
//          헬퍼 동작만 검사 — 내보내는 머신 요약 JSON 의 6-키 스키마·`steps`↔`ORDER`·
//          `failedStep` 직렬화 분기는 미cover.
//      (2) TS 측 result-JSON 파서/스키마/smoke 0 부재 — 어떤 helper/spec 도 머신 contract 를
//          정의/검증하지 않음.
//   - 본 spec 은 그 빈 자리를 메운다 — `deploy/daily-test.sh` 를 readFileSync 로 읽어
//     (a) `printf` 머신 요약 JSON 템플릿(282행)의 top-level 키를 순서대로 추출해 6-키 벡터와
//     byte-identical, (b) `ORDER=(...)` 배열(230행)을 6-원소 벡터와 byte-identical + `steps_json`
//     이 `for s in "${ORDER[@]}"` 순회로 조립됨(276~279행) 확인, (c) `failedStep` 직렬화
//     표현식(284행)의 null-분기(`echo null`)/quoted-분기(`printf '"%s"'`) 두 토큰 정합을
//     단언한다. 이 contract 가 drift 하면(키 rename·ORDER↔steps 어긋남·failedStep 분기 깨짐)
//     머신 요약과 무인 routine 의 기대 스키마가 silent 분기 → nightly 모니터링 false 신호.
//
//      🔥 실 redeploy·실 HTTP health/liveness/auth·실 jest spawn·실 git rev-parse 0 — 파일
//         read + 정적 텍스트 추출 + 합성 JSON.parse 만. `deploy/daily-test.sh` 는 읽기만
//         (실행/source 0).
//      🔥 process.env 읽기 0 / gating 분기 0 — non-gated 항상 실행(describe.skip 0).
//      🔥 credential 0 — 머신 요약 JSON 은 ts·gitSha·result·step 상태·logPath 만 운반.
//         추출/합성 문자열에 토큰 placeholder 미surface(§9).
//      🔥 새 외부 dependency 0 — node 내장(`fs`/`path`) import 만.
//
// Out of Scope (T-0791):
//   - src 변경 0 — test-only.
//   - `deploy/daily-test.sh` 변경 0 — readFileSync 로 읽기만. printf 템플릿/ORDER/failedStep
//     미수정(drift 발견 시 별도 fix task).
//   - `deploy/daily-test-step-eval.test.sh`(T-0612 bash test) 변경/재구현 0 — 상보적 TS smoke.
//   - 실 `deploy/daily-test.sh` 실행/source/실 step 실행/실 jest spawn/실 git rev-parse 0.
//   - step_eval jest argv full-vector parity(T-0790) 재단언 0 — distinct surface.
//   - 새 helper 모듈 신설 0(`test/helpers/` 변경 0) — spec 로컬 보조 함수만 허용.
import { readFileSync } from "fs";
import * as path from "path";

// repo-root 경로 — test 실행 cwd 무관하게 robust 하게 해석(`__dirname` = test/smoke,
// 두 단계 위가 repo-root). `process.cwd()` 대신 `__dirname` 기준 상대로 고정한다.
const REPO_ROOT = path.resolve(__dirname, "../..");
const DAILY_TEST_SH_PATH = path.join(REPO_ROOT, "deploy/daily-test.sh");

// 문서화 contract 정본 벡터 — 본 spec 이 박제하는 기대값.
// 머신 요약 JSON top-level 6-키(순서 포함, `deploy/daily-test.sh` 282행 printf 템플릿).
const EXPECTED_RESULT_JSON_KEYS = [
  "ts",
  "gitSha",
  "result",
  "failedStep",
  "steps",
  "logPath",
] as const;
// step 순회 정본 ORDER(`deploy/daily-test.sh` 230행) — steps 객체 키 집합 == 이 벡터.
// T-0888 에서 `collect` step 이 6번째 원소로 append 됨(step_collect bash 배선).
const EXPECTED_ORDER = [
  "redeploy",
  "health",
  "liveness",
  "auth",
  "eval",
  "collect",
] as const;

// shell 소스에서 머신 요약 JSON `printf` 템플릿 문자열(282행 `{"ts":"%s",...}`)을 추출한다.
//
// `deploy/daily-test.sh` 282행은 single-quote 로 감싼 printf format:
//   printf '{"ts":"%s","gitSha":"%s","result":"%s","failedStep":%s,"steps":%s,"logPath":"%s"}\n' \
//
// 추출 전략(robust): `printf '` 이후 `{` 로 시작해 `}` 로 닫히는 첫 JSON-object format 슬라이스를
// 잡는다. 못 찾으면 빈 문자열을 반환(silent fallback 방지는 호출측 단언이 담당).
function extractResultJsonTemplate(shellSource: string): string {
  // `printf '{...}` — single-quote 안의 `{` 시작 ~ `}` 끝(non-greedy) JSON-object format.
  const match = shellSource.match(/printf\s+'(\{.*?\})\\n'/);
  if (!match) {
    return "";
  }
  return match[1];
}

// 머신 요약 JSON 템플릿 문자열에서 top-level 키를 등장 순서대로 추출한다.
//
// 템플릿: `{"ts":"%s","gitSha":"%s","result":"%s","failedStep":%s,"steps":%s,"logPath":"%s"}`
// 키는 `"key":` 패턴(값 직전의 따옴표 키). 값이 `"%s"`(quoted) 든 `%s`(unquoted) 든 키 추출은
// 동일. nested object 가 없는 flat 템플릿이라 top-level 키만 등장한다.
function extractTemplateKeys(template: string): string[] {
  const keys: string[] = [];
  const re = /"([a-zA-Z][a-zA-Z0-9]*)"\s*:/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(template)) !== null) {
    keys.push(m[1]);
  }
  return keys;
}

// shell 소스에서 `ORDER=(...)` 배열(230행 `ORDER=(redeploy health liveness auth eval collect)`)의
// 원소를 등장 순서대로 추출한다. 못 찾으면 빈 배열을 반환.
function extractOrderArray(shellSource: string): string[] {
  const match = shellSource.match(/^ORDER=\(([^)]*)\)/m);
  if (!match) {
    return [];
  }
  return match[1]
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length > 0);
}

// 머신 요약 JSON 템플릿(`%s` 슬롯)을 합성 더미값으로 채워 valid JSON 문자열을 만든다.
// 6-키 순서는 템플릿 그대로. `failedStep` 슬롯은 `%s`(unquoted) 라 null 또는 `"step"`
// (quoted)을 직접 주입해 두 직렬화 분기를 모사한다.
function fillTemplate(
  template: string,
  values: {
    ts: string;
    gitSha: string;
    result: string;
    failedStepSerialized: string; // `null`(unquoted) 또는 `"auth"`(quoted) — JSON 조각 그대로
    stepsSerialized: string; // `{"redeploy":"PASS",...}` JSON object 조각
    logPath: string;
  },
): string {
  // 템플릿의 `%s` 를 등장 순서대로 채운다. 순서: ts, gitSha, result, failedStep, steps, logPath.
  const ordered = [
    values.ts,
    values.gitSha,
    values.result,
    // failedStep·steps 슬롯은 unquoted `%s` 라 직렬화된 조각을 그대로.
    values.failedStepSerialized,
    values.stepsSerialized,
    values.logPath,
  ];
  let i = 0;
  return template.replace(/%s/g, () => ordered[i++]);
}

// ORDER 원소로 steps JSON object 조각을 조립한다(shell `steps_json` 276~279행 모사 —
// `for s in "${ORDER[@]}"` 순회로 `"$s":"PASS"` 키 생성). 모든 step 을 "PASS" 로.
function buildStepsJson(order: readonly string[]): string {
  const inner = order.map((s) => `"${s}":"PASS"`).join(",");
  return `{${inner}}`;
}

describe("realdata-e2e step④ daily-test.sh 머신 요약 JSON 6-키 스키마 ↔ ORDER-driven steps ↔ failedStep null/quoted 분기 parity drift smoke (T-0791)", () => {
  describe("Happy-path: shell 소스 read + 머신 요약 JSON 템플릿/ORDER 추출", () => {
    it("실 deploy/daily-test.sh 를 읽어 printf 머신 요약 JSON 템플릿과 ORDER 배열을 추출한다", () => {
      const shellSource = readFileSync(DAILY_TEST_SH_PATH, "utf8");
      const template = extractResultJsonTemplate(shellSource);
      const order = extractOrderArray(shellSource);

      // 템플릿이 비어있지 않고 `{` 시작·`}` 끝.
      expect(template.length).toBeGreaterThan(0);
      expect(template.startsWith("{")).toBe(true);
      expect(template.endsWith("}")).toBe(true);
      // ORDER 추출이 비어있지 않은 배열.
      expect(Array.isArray(order)).toBe(true);
      expect(order.length).toBeGreaterThan(0);
    });

    it("repo-root 경로가 __dirname 기준으로 robust 하게 해석되어 daily-test.sh 가 실재한다", () => {
      // cwd 무관 — __dirname 기준 상대(path.resolve)로 해석한 경로가 실제 파일을 가리킨다.
      const shellSource = readFileSync(DAILY_TEST_SH_PATH, "utf8");
      expect(shellSource).toContain(
        "ORDER=(redeploy health liveness auth eval collect)",
      );
      expect(shellSource).toContain('printf \'{"ts":"%s"');
    });
  });

  describe("6-키 스키마 집합·순서 정합 수렴(핵심 불변식 1)", () => {
    it("추출한 printf 템플릿의 top-level 키가 [ts·gitSha·result·failedStep·steps·logPath]와 byte-identical(순서·개수 1:1)", () => {
      const shellSource = readFileSync(DAILY_TEST_SH_PATH, "utf8");
      const template = extractResultJsonTemplate(shellSource);
      const keys = extractTemplateKeys(template);

      // 6 키가 모두 존재하고 문서화 contract 순서대로임(키 rename·추가/누락·순서 변경 검출).
      expect(keys).toEqual([...EXPECTED_RESULT_JSON_KEYS]);
      expect(keys).toHaveLength(6);
    });
  });

  describe("steps 키 집합 == ORDER byte-identical 수렴(핵심 불변식 2 — 본 task 의 새 표면)", () => {
    it("추출한 ORDER 가 [redeploy·health·liveness·auth·eval·collect]와 byte-identical(6-원소 ordered)", () => {
      const shellSource = readFileSync(DAILY_TEST_SH_PATH, "utf8");
      const order = extractOrderArray(shellSource);

      expect(order).toEqual([...EXPECTED_ORDER]);
      expect(order).toHaveLength(6);
    });

    it("steps_json 이 ORDER 를 순회 source 로 조립함(for s in ORDER 패턴 + steps_json 에 키 삽입)이 shell 소스에 등장", () => {
      const shellSource = readFileSync(DAILY_TEST_SH_PATH, "utf8");

      // 276~279행 — `for s in "${ORDER[@]}"` 순회로 `steps_json` 에 `"$s":"..."` 키 삽입.
      expect(shellSource).toContain('for s in "${ORDER[@]}"');
      expect(shellSource).toContain(
        'steps_json="$steps_json,\\"$s\\":\\"${STEP_STATUS[$s]}\\""',
      );
      // 즉 내보내는 JSON 의 steps 키 집합이 ORDER 와 정확히 일치하도록 조립됨.
    });
  });

  describe("failedStep null/quoted 두 직렬화 분기 정합 수렴(핵심 불변식 3)", () => {
    it("failedStep 직렬화 표현식(284행)에 null-분기 토큰(echo null)과 quoted-분기 토큰(printf '\"%s\"')이 둘 다 등장", () => {
      const shellSource = readFileSync(DAILY_TEST_SH_PATH, "utf8");

      // 284행 — `[ "$FAILED_STEP" = "null" ] && echo null || printf '"%s"' "$FAILED_STEP"`.
      expect(shellSource).toContain('[ "$FAILED_STEP" = "null" ]');
      expect(shellSource).toContain("echo null"); // null 분기 — unquoted JSON null
      expect(shellSource).toContain("printf '\"%s\"'"); // quoted 분기 — JSON string
    });
  });

  describe("머신 요약 JSON 파싱-가능성 수렴(branch)", () => {
    it("템플릿 %s 슬롯을 더미값으로 채운 JSON 이 JSON.parse valid · 6 키 보유 · failedStep null 분기 · steps 키==ORDER", () => {
      const shellSource = readFileSync(DAILY_TEST_SH_PATH, "utf8");
      const template = extractResultJsonTemplate(shellSource);
      const order = extractOrderArray(shellSource);

      const json = fillTemplate(template, {
        ts: "20260629T000000Z",
        gitSha: "abc1234",
        result: "PASS",
        failedStepSerialized: "null", // null 분기 — unquoted
        stepsSerialized: buildStepsJson(order),
        logPath: "/x.log",
      });

      const parsed = JSON.parse(json) as Record<string, unknown>;
      expect(Object.keys(parsed)).toEqual([...EXPECTED_RESULT_JSON_KEYS]);
      expect(parsed.failedStep).toBeNull(); // null 분기 → JSON null
      expect(typeof parsed.steps).toBe("object");
      expect(Object.keys(parsed.steps as Record<string, unknown>)).toEqual([
        ...EXPECTED_ORDER,
      ]);
    });

    it("failedStep=\"auth\"(quoted 분기)로 채운 변형이 JSON.parse → failedStep === 'auth'(string)", () => {
      const shellSource = readFileSync(DAILY_TEST_SH_PATH, "utf8");
      const template = extractResultJsonTemplate(shellSource);
      const order = extractOrderArray(shellSource);

      const json = fillTemplate(template, {
        ts: "20260629T000000Z",
        gitSha: "abc1234",
        result: "FAIL",
        failedStepSerialized: '"auth"', // quoted 분기 — JSON string
        stepsSerialized: buildStepsJson(order),
        logPath: "/x.log",
      });

      const parsed = JSON.parse(json) as Record<string, unknown>;
      expect(parsed.failedStep).toBe("auth");
      expect(typeof parsed.failedStep).toBe("string");
      // null/quoted 두 분기 모두 valid JSON 산출 입증(위 it 의 null 분기와 쌍).
    });
  });

  describe("drift-detection 변별성 수렴(본 smoke 가 drift 를 실제로 잡음을 입증)", () => {
    it("키 한 개를 mutate 한 사본(result→status)·키 순서 swap·키 삭제 사본이 expected 6-키 벡터와 not.toEqual(원본은 mutate 0)", () => {
      const shellSource = readFileSync(DAILY_TEST_SH_PATH, "utf8");
      const template = extractResultJsonTemplate(shellSource);
      const keys = extractTemplateKeys(template);

      // 사본만 변형 — 키 rename(result→status) 모사.
      const renamed = [...keys];
      renamed[2] = "status";
      expect(renamed).not.toEqual([...EXPECTED_RESULT_JSON_KEYS]);

      // 키 순서 swap 모사([0]↔[2]).
      const swapped = [...keys];
      [swapped[0], swapped[2]] = [swapped[2], swapped[0]];
      expect(swapped).not.toEqual([...EXPECTED_RESULT_JSON_KEYS]);

      // 키 삭제 모사.
      const dropped = keys.filter((k) => k !== "failedStep");
      expect(dropped).not.toEqual([...EXPECTED_RESULT_JSON_KEYS]);

      // 원본 추출 키 배열은 mutate 0 — 여전히 정본과 byte-identical.
      expect(keys).toEqual([...EXPECTED_RESULT_JSON_KEYS]);
    });

    it("ORDER 한 원소를 mutate/제거한 사본이 expected ORDER 벡터와 not.toEqual(원본은 mutate 0)", () => {
      const shellSource = readFileSync(DAILY_TEST_SH_PATH, "utf8");
      const order = extractOrderArray(shellSource);

      // 원소 추가 모사.
      const added = [...order, "extra"];
      expect(added).not.toEqual([...EXPECTED_ORDER]);

      // 원소 제거 모사.
      const removed = order.filter((s) => s !== "eval");
      expect(removed).not.toEqual([...EXPECTED_ORDER]);

      // 순서 swap 모사([0]↔[4]).
      const swapped = [...order];
      [swapped[0], swapped[4]] = [swapped[4], swapped[0]];
      expect(swapped).not.toEqual([...EXPECTED_ORDER]);

      // 원본 추출 ORDER 배열은 mutate 0.
      expect(order).toEqual([...EXPECTED_ORDER]);
    });
  });

  describe("Error path / negative cases 충분 cover", () => {
    it("shell 파일 부재 경로 → readFileSync 가 throw(ENOENT, silent 0-byte fallback 0)", () => {
      const badPath = path.join(REPO_ROOT, "deploy/__does_not_exist__.sh");
      expect(() => readFileSync(badPath, "utf8")).toThrow();
    });

    it("printf 머신 요약 템플릿 부재 합성 shell → 추출 결과 빈 문자열(silent PASS 미누출)", () => {
      const noPrintf = "#!/bin/bash\necho noop\n";
      const template = extractResultJsonTemplate(noPrintf);
      expect(template).toBe("");
      // 빈 템플릿에서 추출한 키는 expected 6-키 벡터와 결코 같지 않음.
      expect(extractTemplateKeys(template)).not.toEqual([
        ...EXPECTED_RESULT_JSON_KEYS,
      ]);
    });

    it("failedStep 키가 빠진 합성 printf 템플릿 → 추출 키 배열이 expected 6-키 벡터와 not.toEqual(키 누락 검출)", () => {
      // failedStep 슬롯 제거한 5-키 합성 템플릿.
      const synthetic =
        'printf \'{"ts":"%s","gitSha":"%s","result":"%s","steps":%s,"logPath":"%s"}\\n\'';
      const template = extractResultJsonTemplate(synthetic);
      const keys = extractTemplateKeys(template);

      expect(keys).not.toEqual([...EXPECTED_RESULT_JSON_KEYS]);
      expect(keys).not.toContain("failedStep");
      expect(keys).toHaveLength(5);
    });

    it("ORDER 에 원소가 추가된 합성(또는 순서 swap) → expected 6-원소 벡터와 not.toEqual(ORDER drift 검출)", () => {
      // 원소 추가 합성(6-원소 정본에 deploy 를 더한 7-원소) — steps 키 contract 를 깨뜨릴 risk 를 본 smoke 가 잡음.
      const orderAdded =
        "ORDER=(redeploy health liveness auth eval collect deploy)";
      const extracted = extractOrderArray(orderAdded);
      expect(extracted).not.toEqual([...EXPECTED_ORDER]);
      expect(extracted).toContain("deploy");

      // 순서 swap 합성(6-원소 정본의 [0]↔[1] swap).
      const orderSwapped = "ORDER=(health redeploy liveness auth eval collect)";
      const swappedExtracted = extractOrderArray(orderSwapped);
      expect(swappedExtracted).not.toEqual([...EXPECTED_ORDER]);
    });

    it("failedStep null-분기만 있고 quoted-분기(printf '\"%s\"') 부재 합성 → 두 분기 정합 단언이 FAIL(분기 누락 검출)", () => {
      // null 분기 토큰만 있는 합성 표현식(quoted 분기 누락).
      const nullOnly =
        '[ "$FAILED_STEP" = "null" ] && echo null || echo SOMETHING_ELSE';
      // 두 분기 정합 단언 = null 토큰 AND quoted 토큰 둘 다 등장. quoted 부재면 정합 FAIL.
      const hasNullBranch = nullOnly.includes("echo null");
      const hasQuotedBranch = nullOnly.includes("printf '\"%s\"'");
      expect(hasNullBranch).toBe(true);
      expect(hasQuotedBranch).toBe(false); // quoted 분기 누락 → 정합 깨짐 검출
      // 즉 본 smoke 의 failedStep 두-분기 단언(hasNull && hasQuoted)은 이 합성에서 FAIL.
      expect(hasNullBranch && hasQuotedBranch).toBe(false);
    });
  });

  describe("credential 누출 0(REQ-059 / §9)", () => {
    it("추출/합성하는 어떤 문자열(템플릿·ORDER·failedStep 표현식·합성 JSON)에도 credential placeholder 미surface", () => {
      const shellSource = readFileSync(DAILY_TEST_SH_PATH, "utf8");
      const template = extractResultJsonTemplate(shellSource);
      const order = extractOrderArray(shellSource);
      const json = fillTemplate(template, {
        ts: "20260629T000000Z",
        gitSha: "abc1234",
        result: "PASS",
        failedStepSerialized: "null",
        stepsSerialized: buildStepsJson(order),
        logPath: "/x.log",
      });

      // token 형태(GH_TOKEN/Bearer/Authorization/x-*-token/ghp_/sk- prefix)만 검출.
      // `logPath` 의 "Path" 같은 정상 키와 충돌하지 않도록 word-boundary·prefix 한정.
      const credentialPattern =
        /(GH_TOKEN|\bBearer\b|Authorization|x-access-token|x-github-token|ghp_|\bsk-)/i;

      const haystacks = [template, order.join(" "), json];
      haystacks.forEach((s) => {
        expect(credentialPattern.test(s)).toBe(false);
      });
    });
  });

  describe("결정론·no-mutation", () => {
    it("동일 shell 소스로 템플릿/ORDER 추출을 두 번 → 결과가 두 번 byte-identical deep-equal", () => {
      const shellSource = readFileSync(DAILY_TEST_SH_PATH, "utf8");
      const t1 = extractResultJsonTemplate(shellSource);
      const t2 = extractResultJsonTemplate(shellSource);
      const o1 = extractOrderArray(shellSource);
      const o2 = extractOrderArray(shellSource);

      expect(t1).toBe(t2);
      expect(extractTemplateKeys(t1)).toEqual(extractTemplateKeys(t2));
      expect(o1).toEqual(o2);
    });

    it("추출 보조 함수가 입력 shell 문자열을 mutate 0 · 원본 추출 배열이 사본 mutate 후에도 불변", () => {
      const shellSource = readFileSync(DAILY_TEST_SH_PATH, "utf8");
      const sourceSnapshot = shellSource;
      extractResultJsonTemplate(shellSource);
      extractOrderArray(shellSource);
      expect(shellSource).toBe(sourceSnapshot);

      // 원본 추출 배열이 사본 mutate 후에도 deep-equal 유지.
      const keys = extractTemplateKeys(extractResultJsonTemplate(shellSource));
      const keysSnapshot = [...keys];
      const copy = [...keys];
      copy[0] = "MUTATED";
      expect(keys).toEqual(keysSnapshot);
    });
  });
});
