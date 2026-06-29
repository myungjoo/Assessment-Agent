// ci-workflow-verification-chain-contract-scripts-parity-drift.smoke-spec.ts
// — `.github/workflows/ci.yml` 이 R-110/R-111/R-113 검증 체인(코드 검토 + test 작성 +
// test 수행 + smoke + e2e 가 CI 에서 자동 실행)을 구성하려고 호출하는 검증-체인 계약
// (모든 `run: pnpm <script>` 의 루트-워크스페이스 <script> 집합·모든 `run: bash <path>` 의
// <path> 집합·test:smoke/test:e2e 가 `--config` 로 가리키는 jest config 경로) ↔ 실 build/test
// artifact(`package.json` 의 scripts 객체 키집합·실 scripts/*.sh·deploy/*.test.sh 파일 실존·
// test/jest-smoke.json·test/jest-e2e.json 실존) parity 를, ci.yml·package.json·스크립트 파일을
// readFileSync/existsSync 로 정적 추출·cross-artifact 대조하는 drift-detection non-gated
// build-time smoke (T-0796 박제).
//
// 본 spec 의 존재 이유 — CI 검증-체인 계약 ↔ 실 build/test artifact gap 해소:
//   - `.github/workflows/ci.yml` 은 CLAUDE.md §3.2 의 "test fail → CI error" 절대 규칙을
//     실제로 구성하는 단일 진입점이다. 그 강제는 ci.yml 이 호출하는 인보케이션 토큰이 실 build/
//     test artifact 와 정합할 때만 유효하다. ci.yml 은 다수의 인보케이션으로 검증 체인을 조립한다:
//      · `run: pnpm <script>` — `pnpm lint`·`pnpm build`·`pnpm test:cov`·`pnpm test:smoke`·
//        `pnpm test:e2e` 등 루트 워크스페이스 script(이 <script> 들은 package.json scripts 키에
//        실존해야 함). `pnpm --filter web build/test`·`pnpm install ...`·`pnpm prisma migrate
//        deploy` 는 워크스페이스 필터/pnpm 내장/binary 라 루트-scripts 대조 대상이 아님(추출 제외).
//      · `run: bash <path>` — `bash scripts/check-spec-presence.test.sh`·`check-doc-only-pr
//        .test.sh`·`verify-ref-cas-lock.sh`·`select-claim.test.sh`·`reclaim-stale-claim.test.sh`·
//        `acquire-lock.test.sh`·`lib-lock-tree.test.sh`·`deploy/daily-test-step-eval.test.sh`
//        등 shell 검증 스크립트(이 <path> 들은 전부 실 파일로 실존해야 함).
//      · package.json `test:smoke = jest --config ./test/jest-smoke.json`·`test:e2e = jest
//        --config ./test/jest-e2e.json` 의 `--config <path>`(이 jest config 파일이 실존해야
//        `pnpm test:smoke`/`pnpm test:e2e` 가 실제로 발화).
//   - 이 contract 는 origin/main 시점에 **build-time 검증 0 부재** 였다:
//      (1) deploy smoke 6종(T-0790~0795)은 distinct surface 만 cover — deploy 컨테이너 artifact
//          (daily-test/docker-entrypoint/seed/compose)이고 CI 검증-체인 ↔ scripts 표면 미합류.
//      (2) CI 자체 run 은 실 ci.yml 을 GitHub Actions 가 실행하지만, 그건 그 시점의 ci.yml 이
//          실행 가능한지일 뿐 — package.json/스크립트 파일이 silent drift 한 직후 push 가 처음
//          CI 를 깨기 전까지는 검출 안 됨. build-time smoke 는 push 전(같은 PR 의 smoke 단계)에서
//          정적으로 drift 를 잡는다.
//   - 본 spec 은 그 빈 자리를 메운다 — ci.yml + package.json + 스크립트 파일을 readFileSync/
//     existsSync 로 읽어 (a) ci.yml 측 검증-체인 계약(루트-`pnpm <script>` 집합·`bash <path>`
//     집합), (b) artifact 측(package.json scripts 키집합·test:smoke/test:e2e 의 `--config`)을
//     추출해 (c) pnpm-script ⊆ package.json scripts·bash-path 전부 existsSync true·jest config
//     existsSync true·R-113 체인(test:cov/test:smoke/test:e2e) 인보케이션 완결을 단언한다.
//     이 contract 가 drift 하면(script rename·bash path 삭제·jest config 이동·검증 layer 누락)
//     CI 가 silent error 하거나 검증 layer 가 누락되어 R-110/R-111/R-113 절대 규칙이 무력화된다.
//
//      🔥 실 GitHub Actions 발화·실 pnpm 실행·실 bash 실행·실 CI run·실 jest 발화 0 —
//         파일 read + 정적 텍스트/정규식 추출 + existsSync + 합성 문자열만. ci.yml·package.json·
//         스크립트 파일·jest config 는 읽기/실존-확인만(실행/발화/import 0).
//      🔥 NestJS module/class import 0 — readFileSync 텍스트 read only, DI/DB 의존 0.
//      🔥 process.env 읽기 0 / gating 분기 0 — non-gated 항상 실행(describe.skip 0).
//      🔥 credential 0 — 검증-체인 계약은 script-name·bash-path·config-path 토큰만 운반.
//         ci.yml 의 `permissions`/`secrets.GITHUB_TOKEN`/`GH_TOKEN` 참조는 토큰 이름·scope
//         선언일 뿐 실 값 0 — 본 smoke 의 추출 surface 는 script-name·bash-path·config-path 만.
//      🔥 새 외부 dependency 0 — node 내장(`fs`/`path`) import 만. YAML 파서 추가 0(정규식/문자열 추출).
//
// Out of Scope (T-0796):
//   - src 변경 0 — test-only. ci.yml/package.json/스크립트 파일/jest config 는 readFileSync read
//     또는 existsSync 실존-확인만(실행/발화 0).
//   - `.github/workflows/ci.yml` 변경 0 — readFileSync 로 읽기만(drift 발견 시 별도 fix task).
//   - `package.json` 변경 0 — 읽기만(scripts 객체 미변경).
//   - 실 GitHub Actions 발화/실 pnpm 실행/실 bash 실행/실 CI run/실 jest 발화 0.
//   - YAML 의 완전한 spec 파싱(anchor·multi-doc·flow scalar) 0 — 필요한 계약 토큰(`run: pnpm
//     <script>`·`run: bash <path>` 라인)만 정규식/슬라이스 추출.
//   - `pnpm --filter web build/test`·`pnpm install`·`pnpm prisma migrate deploy` 를 루트-script
//     로 대조 0 — 비-script 토큰이라 추출 단계에서 skip.
//   - docker-compose(T-0795)·docker-entrypoint(T-0793)·seed(T-0794)·daily-test 3종(T-0790~0792)
//     재단언 0 — distinct surface(CI 검증-체인 ↔ scripts).
//   - 새 helper 모듈 신설 0(`test/helpers/` 변경 0) — spec 로컬 보조 함수만 허용.
import { readFileSync, existsSync } from "fs";
import * as path from "path";

// repo-root 경로 — test 실행 cwd 무관하게 robust 하게 해석(`__dirname` = test/smoke,
// 두 단계 위가 repo-root). `process.cwd()` 대신 `__dirname` 기준 상대로 고정한다.
const REPO_ROOT = path.resolve(__dirname, "../..");
const CI_YML_PATH = path.join(REPO_ROOT, ".github/workflows/ci.yml");
const PACKAGE_JSON_PATH = path.join(REPO_ROOT, "package.json");

// ---------------------------------------------------------------------------
// 타입 정의 — ci.yml·artifact 양측에서 추출한 검증-체인 계약/artifact 의 정규형.
// ---------------------------------------------------------------------------

// ci.yml 이 운반하는 검증-체인 계약의 정규형.
//   · pnpmScripts: 모든 `run: pnpm <script>` 의 루트-워크스페이스 <script> 집합
//     (`--filter`/`install`/`prisma`/`exec` 등 비-script 토큰은 제외).
//   · bashPaths: 모든 `run: bash <path>` 의 <path> 집합.
interface CiVerificationChainContract {
  pnpmScripts: string[];
  bashPaths: string[];
}

// package.json 에서 추출한 build/test artifact 정본.
//   · scriptKeys: scripts 객체의 키 집합.
//   · smokeConfigPath / e2eConfigPath: test:smoke/test:e2e 의 `--config <path>` 값.
interface PackageArtifact {
  scriptKeys: string[];
  smokeConfigPath: string | null;
  e2eConfigPath: string | null;
}

// pnpm <script> 의 첫 토큰이 루트-script 가 아닌(워크스페이스 필터/pnpm 내장/binary)
// 토큰들. 이들은 루트 package.json scripts 키 대조 대상이 아니라 추출 시 skip 한다.
//   · --filter: 워크스페이스 필터(`pnpm --filter web build`)
//   · install: pnpm 내장 명령(`pnpm install --frozen-lockfile`)
//   · prisma / exec / dlx / add / remove / run / prune: binary/내장 위임 토큰
const NON_SCRIPT_PNPM_TOKENS = new Set([
  "--filter",
  "install",
  "prisma",
  "exec",
  "dlx",
  "add",
  "remove",
  "run",
  "prune",
  "-r",
  "--recursive",
]);

// 루트-script 이름의 유효 shape — 영문자 1+ 시작(또는 포함), 영문/숫자/콜론/하이픈/언더스코어만.
// `9`(버전 숫자)·`pnpm/action-setup`(경로형) 같은 비-script 토큰을 추출 단계에서 배제한다.
// package.json scripts 키(build·lint·test:cov·test:smoke·test:e2e 등)는 모두 이 shape 다.
const SCRIPT_NAME_SHAPE = /^[a-z][a-z0-9:_-]*$/i;

// ---------------------------------------------------------------------------
// ci.yml 측 추출 — 검증-체인 계약(pnpm <script> 집합·bash <path> 집합).
// ---------------------------------------------------------------------------

// ci.yml 텍스트에서 모든 `pnpm <첫토큰>` 인보케이션을 스캔해, 첫 토큰이 루트-script
// 인 것만(비-script 토큰 skip) 수집한다. `run: pnpm lint`(인라인)와 `run: |` block
// scalar 안의 `pnpm test:cov` 둘 다 매칭한다. YAML 주석 행(trim 후 `#` 시작)은 실 인보케이션이
// 아니므로 스캔에서 제외(예: `# pnpm 9 (ADR-0001)`·`# pnpm prune --prod` 가 script 로 오인되지
// 않게). 또한 첫 토큰이 script-name shape 가 아니면(버전 숫자 `9`·경로형 `pnpm/...`) 배제한다.
// 중복은 제거(Set)하고 정렬해 결정론을 보장한다.
function extractCiPnpmScripts(ciSource: string): string[] {
  const scripts = new Set<string>();
  for (const rawLine of ciSource.split("\n")) {
    // YAML 주석 행은 실 `run:` 인보케이션이 아니므로 skip(comment 안의 pnpm 언급 오인 방지).
    if (rawLine.trim().startsWith("#")) {
      continue;
    }
    // 한 행 안의 모든 `pnpm <첫토큰>` 매칭(인라인 run: 과 block scalar 행 둘 다).
    const re = /\bpnpm\s+(\S+)/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(rawLine)) !== null) {
      const firstToken = m[1];
      // 비-script 토큰(워크스페이스 필터/pnpm 내장/binary)은 루트-script 대조 대상 아님 — skip.
      if (NON_SCRIPT_PNPM_TOKENS.has(firstToken)) {
        continue;
      }
      // 버전 숫자(`9`)·경로형(`pnpm/action-setup`) 등 script-name shape 가 아니면 배제.
      if (!SCRIPT_NAME_SHAPE.test(firstToken)) {
        continue;
      }
      scripts.add(firstToken);
    }
  }
  return [...scripts].sort();
}

// ci.yml 텍스트에서 모든 `bash <path>` 인보케이션의 <path> 를 수집한다.
// `run: bash scripts/x.test.sh`(인라인)와 `run: |` block 안의 `bash scripts/x.sh` 둘 다
// 매칭. `BASE_REF=origin/main bash scripts/check-spec-presence.sh` 같이 env-prefix 가
// 붙은 형태도 `bash <path>` 토큰을 잡는다. 중복 제거·정렬해 결정론 보장.
function extractCiBashPaths(ciSource: string): string[] {
  const paths = new Set<string>();
  for (const rawLine of ciSource.split("\n")) {
    // YAML 주석 행은 실 `run:` 인보케이션이 아니므로 skip.
    if (rawLine.trim().startsWith("#")) {
      continue;
    }
    // `bash <path>` — <path> 는 공백 아닌 `.sh` 로 끝나는 연속 문자(scripts/*.sh·deploy/*.sh).
    const re = /\bbash\s+(\S+\.sh)\b/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(rawLine)) !== null) {
      paths.add(m[1]);
    }
  }
  return [...paths].sort();
}

// ci.yml 측 검증-체인 계약을 정규형으로 추출한다.
function extractCiContract(ciSource: string): CiVerificationChainContract {
  return {
    pnpmScripts: extractCiPnpmScripts(ciSource),
    bashPaths: extractCiBashPaths(ciSource),
  };
}

// ---------------------------------------------------------------------------
// artifact 측 추출 — package.json scripts 키집합 + test:smoke/test:e2e --config 경로.
// ---------------------------------------------------------------------------

// package.json 의 `--config <path>` 토큰을 한 script 값에서 추출한다(`jest --config
// ./test/jest-smoke.json` → `./test/jest-smoke.json`). 못 찾으면 null.
function extractConfigPath(scriptValue: string | undefined): string | null {
  if (!scriptValue) {
    return null;
  }
  const m = scriptValue.match(/--config\s+(\S+)/);
  return m ? m[1] : null;
}

// package.json 텍스트를 JSON.parse 해 scripts 키집합과 test:smoke/test:e2e 의
// `--config` 경로를 추출한다. scripts 객체 부재면 빈 정본.
function extractPackageArtifact(packageJsonSource: string): PackageArtifact {
  const parsed = JSON.parse(packageJsonSource) as {
    scripts?: Record<string, string>;
  };
  const scripts = parsed.scripts ?? {};
  return {
    scriptKeys: Object.keys(scripts).sort(),
    smokeConfigPath: extractConfigPath(scripts["test:smoke"]),
    e2eConfigPath: extractConfigPath(scripts["test:e2e"]),
  };
}

// ---------------------------------------------------------------------------
// 본 spec 이 박제하는 contract 정본 — ci.yml·artifact 양측이 수렴해야 하는 기대값.
// ---------------------------------------------------------------------------

// ci.yml 이 R-110/R-111/R-113 검증 체인을 위해 호출해야 하는 핵심 루트-script 인보케이션.
//   · lint·build — R-110 코드 검토/빌드 layer
//   · test:cov — R-112 unit + coverage layer
//   · test:smoke — R-113 smoke layer
//   · test:e2e — R-113 e2e layer
const EXPECTED_CORE_PNPM_SCRIPTS = [
  "lint",
  "build",
  "test:cov",
  "test:smoke",
  "test:e2e",
];

// R-113 의 unit+smoke+e2e 3종 test layer 인보케이션(이 셋이 모두 ci.yml 에 있어야 체인 완결).
const R113_TEST_LAYERS = ["test:cov", "test:smoke", "test:e2e"];

// package.json test:smoke/test:e2e 의 `--config` 가 가리키는 jest config 정본.
const EXPECTED_SMOKE_CONFIG = "./test/jest-smoke.json";
const EXPECTED_E2E_CONFIG = "./test/jest-e2e.json";

describe("ci.yml 검증-체인 계약(run: pnpm <script> ↔ package.json scripts · run: bash <path> ↔ 실 스크립트 파일 · test:smoke/test:e2e ↔ jest config) ↔ 실 build/test artifact parity drift smoke (T-0796)", () => {
  describe("Happy-path: ci.yml + package.json 소스 read + 계약/artifact 추출", () => {
    it("실 ci.yml + package.json 을 읽어 검증-체인 계약(pnpm <script>·bash <path> 집합)·artifact(scripts 키·config 경로)를 비어있지 않게 추출한다", () => {
      const ciSource = readFileSync(CI_YML_PATH, "utf8");
      const packageSource = readFileSync(PACKAGE_JSON_PATH, "utf8");

      // ci.yml 측 검증-체인 계약이 비어있지 않게 추출됨.
      const contract = extractCiContract(ciSource);
      expect(contract.pnpmScripts.length).toBeGreaterThan(0);
      expect(contract.bashPaths.length).toBeGreaterThan(0);
      // pnpm <script> 집합에 최소 핵심 5종 포함.
      EXPECTED_CORE_PNPM_SCRIPTS.forEach((s) => {
        expect(contract.pnpmScripts).toContain(s);
      });
      // bash <path> 집합에 최소 1+ 포함.
      expect(contract.bashPaths.length).toBeGreaterThanOrEqual(1);

      // artifact 측(package.json scripts 키집합·config 경로)이 비어있지 않게 추출됨.
      const artifact = extractPackageArtifact(packageSource);
      expect(artifact.scriptKeys.length).toBeGreaterThan(0);
      expect(artifact.smokeConfigPath).toBeTruthy();
      expect(artifact.e2eConfigPath).toBeTruthy();
    });

    it("repo-root 경로가 __dirname 기준으로 robust 하게 해석되어 ci.yml·package.json 이 실재한다", () => {
      // cwd 무관 — __dirname 기준 상대(path.resolve)로 해석한 경로가 실제 파일을 가리킨다.
      expect(existsSync(CI_YML_PATH)).toBe(true);
      expect(existsSync(PACKAGE_JSON_PATH)).toBe(true);
      expect(readFileSync(CI_YML_PATH, "utf8")).toContain(
        "run: pnpm test:smoke",
      );
      expect(readFileSync(PACKAGE_JSON_PATH, "utf8")).toContain(
        "jest --config ./test/jest-smoke.json",
      );
    });
  });

  describe("pnpm <script> ↔ package.json scripts 실존 정합 수렴(핵심 불변식 1)", () => {
    it("ci.yml 의 모든 루트-pnpm <script> 가 package.json scripts 객체에 키로 실존(script rename/삭제 silent drift 검출)", () => {
      const ciSource = readFileSync(CI_YML_PATH, "utf8");
      const packageSource = readFileSync(PACKAGE_JSON_PATH, "utf8");

      const pnpmScripts = extractCiPnpmScripts(ciSource);
      const scriptKeys = extractPackageArtifact(packageSource).scriptKeys;

      // ci.yml 이 호출하는 모든 루트-script 가 package.json scripts 키에 존재.
      pnpmScripts.forEach((s) => {
        expect(scriptKeys).toContain(s);
      });
      // 핵심 5종도 명시적으로 package.json scripts 에 존재.
      expect(
        EXPECTED_CORE_PNPM_SCRIPTS.every((s) => scriptKeys.includes(s)),
      ).toBe(true);
    });
  });

  describe("bash <path> ↔ 실 스크립트 파일 실존 정합 수렴(핵심 불변식 2)", () => {
    it("ci.yml 의 모든 run: bash <path> 가 repo-root 기준 실 파일로 실존(스크립트 이동/삭제 silent drift 검출)", () => {
      const ciSource = readFileSync(CI_YML_PATH, "utf8");
      const bashPaths = extractCiBashPaths(ciSource);

      expect(bashPaths.length).toBeGreaterThanOrEqual(1);
      // 추출한 모든 bash <path> 가 실 파일로 실존.
      bashPaths.forEach((p) => {
        expect(existsSync(path.resolve(REPO_ROOT, p))).toBe(true);
      });
    });
  });

  describe("test:smoke/test:e2e jest config 실존 정합 수렴(핵심 불변식 3)", () => {
    it("package.json test:smoke/test:e2e 의 --config 가 가리키는 jest config 파일이 repo-root 기준 실존(config 이동/삭제 drift 검출)", () => {
      const packageSource = readFileSync(PACKAGE_JSON_PATH, "utf8");
      const artifact = extractPackageArtifact(packageSource);

      // 추출 경로가 정본과 byte-identical.
      expect(artifact.smokeConfigPath).toBe(EXPECTED_SMOKE_CONFIG);
      expect(artifact.e2eConfigPath).toBe(EXPECTED_E2E_CONFIG);

      // 그 jest config 파일들이 repo-root 기준 실존(이동/삭제 시 smoke/e2e layer 실행 불가 drift).
      expect(
        existsSync(path.resolve(REPO_ROOT, artifact.smokeConfigPath as string)),
      ).toBe(true);
      expect(
        existsSync(path.resolve(REPO_ROOT, artifact.e2eConfigPath as string)),
      ).toBe(true);
    });
  });

  describe("검증 layer 완결성 수렴(핵심 불변식 4, R-110/111/113 체인)", () => {
    it("ci.yml pnpm <script> 집합이 R-113 의 unit+smoke+e2e 3종(test:cov/test:smoke/test:e2e) AND lint·build 를 빠짐없이 포함", () => {
      const ciSource = readFileSync(CI_YML_PATH, "utf8");
      const pnpmScripts = extractCiPnpmScripts(ciSource);

      // R-113 체인의 unit+smoke+e2e 3종이 모두 ci.yml 인보케이션에 존재.
      R113_TEST_LAYERS.forEach((layer) => {
        expect(pnpmScripts).toContain(layer);
      });
      expect(R113_TEST_LAYERS.every((l) => pnpmScripts.includes(l))).toBe(true);

      // R-110 의 lint·build 도 존재.
      expect(pnpmScripts).toContain("lint");
      expect(pnpmScripts).toContain("build");
    });
  });

  describe("drift-detection 변별성 수렴(본 smoke 가 drift 를 실제로 잡음을 입증)", () => {
    it("package.json scripts 에서 test:smoke 키를 뺀 합성 → ci.yml pnpm test:smoke 가 그 키집합에 부재 — 원본 추출 불변·mutate 0", () => {
      const ciSource = readFileSync(CI_YML_PATH, "utf8");
      const packageSource = readFileSync(PACKAGE_JSON_PATH, "utf8");

      const pnpmScripts = extractCiPnpmScripts(ciSource);
      expect(pnpmScripts).toContain("test:smoke");

      // 원본 artifact 추출(불변 baseline).
      const origArtifact = extractPackageArtifact(packageSource);
      expect(origArtifact.scriptKeys).toContain("test:smoke");

      // 사본만 mutate: scripts 에서 test:smoke 키 제거.
      const parsed = JSON.parse(packageSource) as {
        scripts?: Record<string, string>;
      };
      delete (parsed.scripts as Record<string, string>)["test:smoke"];
      const mutatedKeys = Object.keys(parsed.scripts as Record<string, string>);
      // ci.yml 이 호출하는 test:smoke 가 합성 키집합에 부재(rename/삭제 drift 검출).
      expect(mutatedKeys).not.toContain("test:smoke");

      // 원본은 mutate 0 — 재추출이 baseline 과 deep-equal.
      expect(extractPackageArtifact(packageSource)).toEqual(origArtifact);
    });

    it("ci.yml 의 bash scripts/select-claim.test.sh 를 -renamed 로 바꾼 합성 → 그 <path> 가 실 파일로 부재(existsSync false) — 원본 추출 불변", () => {
      const ciSource = readFileSync(CI_YML_PATH, "utf8");

      // 원본 추출(baseline) — select-claim.test.sh 가 실존.
      const origPaths = extractCiBashPaths(ciSource);
      const target = "scripts/select-claim.test.sh";
      expect(origPaths).toContain(target);
      expect(existsSync(path.resolve(REPO_ROOT, target))).toBe(true);

      // 사본만 mutate: select-claim.test.sh → select-claim-renamed.test.sh.
      const mutated = ciSource.replace(
        "bash scripts/select-claim.test.sh",
        "bash scripts/select-claim-renamed.test.sh",
      );
      const mutatedPaths = extractCiBashPaths(mutated);
      expect(mutatedPaths).toContain("scripts/select-claim-renamed.test.sh");
      // 그 <path> 가 실 파일로 부재(bash path 삭제 drift 검출).
      expect(
        existsSync(
          path.resolve(REPO_ROOT, "scripts/select-claim-renamed.test.sh"),
        ),
      ).toBe(false);

      // 원본은 mutate 0 — 재추출이 baseline 과 deep-equal.
      expect(extractCiBashPaths(ciSource)).toEqual(origPaths);
    });

    it("package.json test:smoke 의 --config 를 ./test/jest-missing.json 으로 바꾼 합성 → 그 config 경로가 실 파일로 부재(existsSync false) — 원본 불변", () => {
      const packageSource = readFileSync(PACKAGE_JSON_PATH, "utf8");

      // 원본 추출(baseline) — jest-smoke.json 이 실존.
      const orig = extractPackageArtifact(packageSource);
      expect(orig.smokeConfigPath).toBe(EXPECTED_SMOKE_CONFIG);
      expect(
        existsSync(path.resolve(REPO_ROOT, orig.smokeConfigPath as string)),
      ).toBe(true);

      // 사본만 mutate: test:smoke 의 --config 경로 변경.
      const mutated = packageSource.replace(
        "jest --config ./test/jest-smoke.json",
        "jest --config ./test/jest-missing.json",
      );
      const mutatedArtifact = extractPackageArtifact(mutated);
      expect(mutatedArtifact.smokeConfigPath).toBe("./test/jest-missing.json");
      // 그 config 경로가 실 파일로 부재(config 이동 drift 검출).
      expect(
        existsSync(
          path.resolve(REPO_ROOT, mutatedArtifact.smokeConfigPath as string),
        ),
      ).toBe(false);

      // 원본 불변.
      expect(extractPackageArtifact(packageSource)).toEqual(orig);
    });
  });

  describe("Error path / negative cases 충분 cover", () => {
    it("존재하지 않는 경로로 readFileSync → ENOENT throw(silent 0-byte fallback false-PASS 방지)", () => {
      const badCi = path.join(
        REPO_ROOT,
        ".github/workflows/ci.does-not-exist.yml",
      );
      const badPkg = path.join(REPO_ROOT, "package.does-not-exist.json");
      expect(() => readFileSync(badCi, "utf8")).toThrow();
      expect(() => readFileSync(badPkg, "utf8")).toThrow();
      expect(existsSync(badCi)).toBe(false);
      expect(existsSync(badPkg)).toBe(false);
    });

    it("script rename 검출(합성) — test:smoke 키가 빠진 합성 package.json scripts → ci.yml pnpm test:smoke 가 그 키집합에 not 포함(검출 함수 false)", () => {
      const ciSource = readFileSync(CI_YML_PATH, "utf8");
      const pnpmScripts = extractCiPnpmScripts(ciSource);
      // 합성 package.json: test:smoke 가 test:smoke:all 로 rename 됨.
      const synthetic = JSON.stringify({
        scripts: {
          lint: "eslint",
          build: "nest build",
          "test:cov": "jest --coverage",
          "test:smoke:all": "jest --config ./test/jest-smoke.json",
          "test:e2e": "jest --config ./test/jest-e2e.json",
        },
      });
      const artifact = extractPackageArtifact(synthetic);
      // ci.yml 이 호출하는 test:smoke 가 합성 키집합에 부재(rename drift 검출).
      expect(pnpmScripts).toContain("test:smoke");
      expect(artifact.scriptKeys).not.toContain("test:smoke");
      // 대조군 — test:cov 는 합성에도 존재(함수가 무조건 false 가 아님 입증).
      expect(artifact.scriptKeys).toContain("test:cov");
    });

    it("bash path 삭제 검출(합성) — ci.yml 의 한 bash <path> 를 nonexistent 로 바꾼 합성 → 추출 후 그 <path> existsSync false", () => {
      const ciSource = readFileSync(CI_YML_PATH, "utf8");
      const mutated = ciSource.replace(
        "bash scripts/check-spec-presence.test.sh",
        "bash scripts/nonexistent.test.sh",
      );
      const paths = extractCiBashPaths(mutated);
      expect(paths).toContain("scripts/nonexistent.test.sh");
      expect(
        existsSync(path.resolve(REPO_ROOT, "scripts/nonexistent.test.sh")),
      ).toBe(false);
    });

    it("jest config 경로 변경 검출(합성) — test:smoke 값을 jest --config ./test/jest-missing.json 으로 바꾼 합성 → 추출 config 경로 existsSync false", () => {
      const synthetic = JSON.stringify({
        scripts: {
          "test:smoke": "jest --config ./test/jest-missing.json",
          "test:e2e": "jest --config ./test/jest-e2e.json",
        },
      });
      const artifact = extractPackageArtifact(synthetic);
      expect(artifact.smokeConfigPath).toBe("./test/jest-missing.json");
      expect(
        existsSync(path.resolve(REPO_ROOT, artifact.smokeConfigPath as string)),
      ).toBe(false);
    });

    it("검증 layer 누락 검출(합성) — pnpm test:e2e 인보케이션이 빠진 합성 ci.yml → 추출 pnpm <script> 집합에 test:e2e not 포함(R-113 체인 불완결)", () => {
      // 합성 ci.yml: lint/build/test:cov/test:smoke 는 있으나 test:e2e 인보케이션 누락.
      const synthetic = [
        "      - name: Lint",
        "        run: pnpm lint",
        "      - name: Build",
        "        run: pnpm build",
        "      - name: 테스트",
        "        run: pnpm test:cov",
        "      - name: 스모크",
        "        run: pnpm test:smoke",
      ].join("\n");
      const pnpmScripts = extractCiPnpmScripts(synthetic);
      // R-113 체인의 test:e2e layer 가 누락 검출.
      expect(pnpmScripts).not.toContain("test:e2e");
      // 대조군 — 나머지 layer 는 추출됨(함수가 무조건 빈 배열이 아님 입증).
      expect(pnpmScripts).toContain("test:cov");
      expect(pnpmScripts).toContain("test:smoke");
    });

    it("비-script pnpm 토큰 제외 정확성 — pnpm --filter/install/prisma 만 있는 합성 ci.yml → 추출 루트-script 집합이 빈 배열(비-script 오인 수집 0)", () => {
      const synthetic = [
        "        run: pnpm --filter web build",
        "        run: pnpm install --frozen-lockfile",
        "        run: pnpm prisma migrate deploy",
        "        run: pnpm --filter web test",
      ].join("\n");
      const pnpmScripts = extractCiPnpmScripts(synthetic);
      // --filter/install/prisma 를 script-name 으로 false-수집하지 않음.
      expect(pnpmScripts).toEqual([]);
      expect(pnpmScripts).not.toContain("--filter");
      expect(pnpmScripts).not.toContain("install");
      expect(pnpmScripts).not.toContain("prisma");
    });

    it("bash 인보케이션 부재 검출 — bash <path> 토큰이 없는 합성 ci.yml → 추출 bashPaths 빈 배열", () => {
      const synthetic = "      - name: Lint\n        run: pnpm lint\n";
      expect(extractCiBashPaths(synthetic)).toEqual([]);
    });

    it("package.json scripts 객체 부재 — scripts 가 없는 합성 → scriptKeys 빈 배열·config 경로 null", () => {
      const synthetic = JSON.stringify({ name: "no-scripts" });
      const artifact = extractPackageArtifact(synthetic);
      expect(artifact.scriptKeys).toEqual([]);
      expect(artifact.smokeConfigPath).toBeNull();
      expect(artifact.e2eConfigPath).toBeNull();
    });
  });

  describe("credential 누출 0(REQ-059 / §9)", () => {
    it("추출/합성하는 어떤 문자열(ci.yml script/path 토큰·scripts 값·config 경로·합성)에도 credential 실값 미surface", () => {
      const ciSource = readFileSync(CI_YML_PATH, "utf8");
      const packageSource = readFileSync(PACKAGE_JSON_PATH, "utf8");

      const contract = extractCiContract(ciSource);
      const artifact = extractPackageArtifact(packageSource);

      // 본 smoke 가 다루는 surface 만 검사 — script-name·bash-path·config-path 토큰만.
      const haystacks = [
        ...contract.pnpmScripts,
        ...contract.bashPaths,
        ...artifact.scriptKeys,
        artifact.smokeConfigPath ?? "",
        artifact.e2eConfigPath ?? "",
        EXPECTED_SMOKE_CONFIG,
        EXPECTED_E2E_CONFIG,
        ...EXPECTED_CORE_PNPM_SCRIPTS,
      ];

      // 실 token/password 형태(GH_TOKEN/Bearer/Authorization/x-*-token/ghp_/sk-/DB 실 password)만 검출.
      const credentialPattern =
        /(GH_TOKEN|\bBearer\b|Authorization|x-access-token|x-github-token|ghp_|\bsk-|postgres:\/\/[^@\s]*:[^@\s]+@)/i;
      haystacks.forEach((s) => {
        expect(credentialPattern.test(s)).toBe(false);
      });

      // 본 smoke 의 추출 surface 에 AUTH_JWT_SECRET 실값/password 가 포함되지 않음.
      // (ci.yml 의 GH_TOKEN/secrets.GITHUB_TOKEN 은 토큰 이름·scope 선언일 뿐 — 본 smoke 의
      //  추출 surface 는 script-name·bash-path·config-path 토큰만이라 secret 값 미포함.)
      const surfaceJoined = haystacks.join("|");
      expect(surfaceJoined).not.toContain("AUTH_JWT_SECRET");
      expect(surfaceJoined).not.toContain("GH_TOKEN");
      expect(surfaceJoined.toLowerCase()).not.toContain("password");
    });
  });

  describe("결정론·no-mutation", () => {
    it("동일 ci.yml·package.json 소스로 추출을 두 번 → 결과가 byte-identical deep-equal", () => {
      const ciSource = readFileSync(CI_YML_PATH, "utf8");
      const packageSource = readFileSync(PACKAGE_JSON_PATH, "utf8");

      const a = extractCiContract(ciSource);
      const b = extractCiContract(ciSource);
      expect(a).toEqual(b);

      const pa = extractPackageArtifact(packageSource);
      const pb = extractPackageArtifact(packageSource);
      expect(pa).toEqual(pb);
    });

    it("추출 보조 함수가 입력 문자열을 mutate 0 — 사본 mutate 후에도 원본 추출 결과 deep-equal 유지", () => {
      const ciSource = readFileSync(CI_YML_PATH, "utf8");
      const before = extractCiContract(ciSource);

      // 사본 mutate(drift 변별성 항과 동형) — 사본만 변형되나 원본 string·추출 결과는 불변.
      const mutated = ciSource
        .replace("bash scripts/select-claim.test.sh", "bash scripts/x.test.sh")
        .replace("run: pnpm test:e2e", "run: pnpm lint");
      const mutatedContract = extractCiContract(mutated);
      expect(mutatedContract).not.toEqual(before);

      // 원본 재추출은 before 와 deep-equal(보조 함수가 입력 mutate 0).
      expect(extractCiContract(ciSource)).toEqual(before);
    });
  });
});
