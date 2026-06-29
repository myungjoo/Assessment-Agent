// realdata-e2e-docker-entrypoint-runtime-contract-build-artifact-parity-drift.smoke-spec.ts
// — 실 평가 e2e/deploy step① `deploy/docker-entrypoint.sh` 가 컨테이너 entrypoint 로서
// 하드코딩한 두 런타임 계약(`./node_modules/.bin/prisma migrate deploy` 의 prisma 바이너리
// 경로 + `migrate deploy` 서브커맨드, `exec node dist/src/main` 의 빌드-산출물 경로) ↔ 실
// build/runtime artifact(`package.json` 의 prisma `dependencies` 배치(pnpm prune --prod
// 생존)·`tsconfig.json` 의 outDir·`Dockerfile` 의 ENTRYPOINT/COPY dist·prisma.config.ts)
// parity 를, 양측 소스(shell + package.json + tsconfig + Dockerfile)를 readFileSync/
// JSON.parse 로 읽어 정적 추출·cross-artifact 대조하는 drift-detection non-gated build-time
// smoke (T-0793 박제, PLAN.md 109행 🟢 실 평가 e2e/deploy step①).
//
// 본 spec 의 존재 이유 — entrypoint-runtime-contract ↔ build/runtime-artifact gap 해소:
//   - `deploy/docker-entrypoint.sh` 는 컨테이너 ENTRYPOINT 로서 (1) `./node_modules/.bin/
//     prisma migrate deploy`(14행) 로 DB migration 을 적용한 뒤 (2) `exec node dist/src/main`
//     (20행) 로 NestJS 앱을 기동한다. 이 두 런타임 계약은 **실 build/runtime artifact 와
//     정합해야만 컨테이너가 crash-loop 없이 부팅되는 운영 contract** 다:
//      · prisma 바이너리(`./node_modules/.bin/prisma`)는 `pnpm prune --prod`(Dockerfile
//        41행) 후에도 `node_modules/.bin/` 에 존재해야 → prisma 가 `devDependencies` 가
//        아니라 `dependencies` 여야 prod prune 생존. `migrate deploy` 는 배포 migration
//        정책(idempotent·미적용 migration 순차 적용)이어야 한다.
//      · `dist/src/main` 의 `dist` prefix 는 `tsconfig.json` 의 outDir(`./dist`) basename
//        과 정합해야 → outDir 변경 시 경로 무효.
//      · Dockerfile 이 ENTRYPOINT=`./deploy/docker-entrypoint.sh` + COPY dist·prisma.config.ts
//        로 위 경로들을 valid 하게 조립해야 한다.
//   - 이 contract 는 origin/main 시점에 **검증 0 부재** 였다:
//      (1) daily-test smoke(T-0790 step_eval argv·T-0791 머신 JSON 스키마·T-0792 HTTP step
//          ↔ controller route)는 distinct surface(daily-test.sh)만 cover — docker-entrypoint
//          런타임 계약 ↔ build/runtime artifact 대조 0.
//      (2) CI 의 "컨테이너 런타임 smoke"(ci.yml 286행)는 실 컨테이너 부팅(gated DB-bound
//          runtime)이라 shell 텍스트 ↔ config artifact 의 정적 drift 를 컨테이너 빌드·부팅
//          없이는 못 잡는다(ci.yml 의 `sh -n` 은 shell 문법 검사만, 계약값 대조 0).
//   - 본 spec 은 그 빈 자리를 메운다 — `deploy/docker-entrypoint.sh` + `package.json` +
//     `tsconfig.json` + `Dockerfile` 4 소스를 readFileSync/JSON.parse 로 읽어 (a) shell 측
//     두 런타임 계약(prisma 바이너리 경로+`migrate deploy` 서브커맨드, `dist/src/main`
//     빌드-산출물 경로)을 추출, (b) artifact 측(prisma dependency 배치·tsconfig outDir·
//     Dockerfile ENTRYPOINT/COPY)을 추출해 (c) prisma 가 dependencies(prune 생존)·
//     `migrate deploy` byte-identical·`dist` prefix==outDir basename·ENTRYPOINT/COPY 정합을
//     단언한다. 이 contract 가 drift 하면(prisma→devDeps·outDir 변경·migrate 서브커맨드
//     swap·ENTRYPOINT rename·COPY 누락) 배포 컨테이너가 런타임에 silent crash-loop 한다.
//
//      🔥 실 컨테이너·실 docker build·실 prisma migrate·실 NestJS 부팅·실 DB·실 HTTP 0 —
//         파일 read + 정적 텍스트/JSON 추출 + 합성 문자열/객체만. shell·config·Dockerfile
//         소스는 읽기만(실행/build/부팅/import 0).
//      🔥 NestJS module/class import 0 — readFileSync/JSON.parse 텍스트·JSON read only, DI/DB 의존 0.
//      🔥 process.env 읽기 0 / gating 분기 0 — non-gated 항상 실행(describe.skip 0).
//      🔥 credential 0 — 런타임 계약은 경로·서브커맨드 토큰만 운반. 추출/합성 문자열에 토큰
//         placeholder 미surface(§9). docker-entrypoint.sh 의 DATABASE_URL 은 주석 언급일 뿐
//         본 smoke 추출 surface 미포함.
//      🔥 새 외부 dependency 0 — node 내장(`fs`/`path`) import 만.
//
// Out of Scope (T-0793):
//   - src 변경 0 — test-only. package.json/tsconfig/Dockerfile 은 readFileSync/JSON.parse read 만.
//   - `deploy/docker-entrypoint.sh` 변경 0 — readFileSync 로 읽기만(drift 발견 시 별도 fix task).
//   - 실 docker build/실 컨테이너 부팅/실 prisma migrate deploy/실 node dist/src/main 실행/실 DB/실 HTTP 0.
//   - nest build 의 `dist/src/main.js` 전체 emit 경로(특히 `/src/` 하위 segment 가 rootDir
//     추론으로 생기는지)의 실 빌드 검증 0 — 본 spec 은 `dist` prefix ↔ tsconfig outDir
//     basename 정합만 정적 단언(전체 emit 경로 추론은 별도 영역).
//   - daily-test.sh step_eval argv(T-0790)·머신 JSON 스키마(T-0791)·HTTP-contract(T-0792) 재단언 0
//     — distinct surface(docker-entrypoint 런타임 계약 ↔ build artifact).
//   - 새 helper 모듈 신설 0(`test/helpers/` 변경 0) — spec 로컬 보조 함수만 허용.
import { readFileSync } from "fs";
import * as path from "path";

// repo-root 경로 — test 실행 cwd 무관하게 robust 하게 해석(`__dirname` = test/smoke,
// 두 단계 위가 repo-root). `process.cwd()` 대신 `__dirname` 기준 상대로 고정한다.
const REPO_ROOT = path.resolve(__dirname, "../..");
const DOCKER_ENTRYPOINT_PATH = path.join(
  REPO_ROOT,
  "deploy/docker-entrypoint.sh",
);
const PACKAGE_JSON_PATH = path.join(REPO_ROOT, "package.json");
const TSCONFIG_PATH = path.join(REPO_ROOT, "tsconfig.json");
const DOCKERFILE_PATH = path.join(REPO_ROOT, "Dockerfile");

// ---------------------------------------------------------------------------
// 타입 정의 — shell·artifact 양측에서 추출한 런타임 계약/artifact 의 정규형.
// ---------------------------------------------------------------------------

// docker-entrypoint.sh 가 운반하는 두 런타임 계약의 정규형.
//   · prismaBinaryPath: `./node_modules/.bin/prisma`(14행 호출의 바이너리 경로)
//   · prismaSubcommand: `migrate deploy`(14행 호출의 서브커맨드 — 배포 migration 정책)
//   · buildArtifactPath: `dist/src/main`(20행 `exec node <path>` 의 빌드-산출물 경로)
interface ShellRuntimeContract {
  prismaBinaryPath: string | null;
  prismaSubcommand: string | null;
  buildArtifactPath: string | null;
}

// package.json 의 prisma dependency 배치 — prune --prod 생존 여부 판정의 정본.
interface PrismaDependencyPlacement {
  inDependencies: boolean; // dependencies.prisma 존재
  inDevDependencies: boolean; // devDependencies.prisma 존재
  clientInDependencies: boolean; // dependencies["@prisma/client"] 존재
}

// ---------------------------------------------------------------------------
// shell 측 추출 — docker-entrypoint.sh 의 두 런타임 계약(prisma 경로·서브커맨드·dist 경로).
// ---------------------------------------------------------------------------

// shell 14행 `./node_modules/.bin/prisma migrate deploy` 에서 prisma 바이너리 경로를
// 추출한다. 못 찾으면 null(silent fallback 방지는 호출측 단언).
function extractShellPrismaBinaryPath(shellSource: string): string | null {
  const match = shellSource.match(
    /(\.\/node_modules\/\.bin\/prisma)\s+migrate\s+deploy/,
  );
  return match ? match[1] : null;
}

// shell 14행 `./node_modules/.bin/prisma migrate deploy` 에서 prisma 서브커맨드를
// 추출한다(`migrate deploy` — 공백 1개 정규화). 못 찾으면 null.
function extractShellPrismaSubcommand(shellSource: string): string | null {
  const match = shellSource.match(
    /\.\/node_modules\/\.bin\/prisma\s+(migrate\s+\w+)/,
  );
  if (!match) {
    return null;
  }
  // 내부 공백을 단일 공백으로 정규화(`migrate   deploy` → `migrate deploy`).
  return match[1].replace(/\s+/g, " ");
}

// shell 20행 `exec node dist/src/main` 에서 빌드-산출물 경로(`dist/src/main`)를 추출한다.
// `exec node <path>` 패턴의 path 토큰. 못 찾으면 null.
function extractShellBuildArtifactPath(shellSource: string): string | null {
  const match = shellSource.match(/exec\s+node\s+(\S+)/);
  return match ? match[1] : null;
}

// shell 측 두 런타임 계약을 정규형(ShellRuntimeContract)으로 추출한다.
function extractShellRuntimeContract(
  shellSource: string,
): ShellRuntimeContract {
  return {
    prismaBinaryPath: extractShellPrismaBinaryPath(shellSource),
    prismaSubcommand: extractShellPrismaSubcommand(shellSource),
    buildArtifactPath: extractShellBuildArtifactPath(shellSource),
  };
}

// 빌드-산출물 경로(`dist/src/main`)의 첫 path segment(`dist`)를 추출한다 — outDir
// basename 과 정합 대조용. 못 추출하면 null.
function extractBuildArtifactPrefix(
  buildArtifactPath: string | null,
): string | null {
  if (!buildArtifactPath) {
    return null;
  }
  const segs = buildArtifactPath.replace(/^\/+/, "").split("/");
  return segs.length > 0 && segs[0].length > 0 ? segs[0] : null;
}

// ---------------------------------------------------------------------------
// artifact 측 추출 — package.json prisma 배치 / tsconfig outDir / Dockerfile.
// ---------------------------------------------------------------------------

// package.json(JSON.parse 결과)에서 prisma dependency 배치를 추출한다 — prune --prod
// 생존 판정용. dependencies.prisma 가 truthy AND devDependencies.prisma 미존재여야 prod 생존.
function extractPrismaDependencyPlacement(pkg: {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}): PrismaDependencyPlacement {
  const deps = pkg.dependencies ?? {};
  const devDeps = pkg.devDependencies ?? {};
  return {
    inDependencies: typeof deps.prisma === "string" && deps.prisma.length > 0,
    inDevDependencies:
      typeof devDeps.prisma === "string" && devDeps.prisma.length > 0,
    clientInDependencies:
      typeof deps["@prisma/client"] === "string" &&
      deps["@prisma/client"].length > 0,
  };
}

// prisma 바이너리가 `pnpm prune --prod` 후에도 생존하는지 판정한다 — prisma 가
// dependencies 에 있고 devDependencies 에 없어야 true(prod 컨테이너 migrate deploy 가능).
function prismaSurvivesProdPrune(
  placement: PrismaDependencyPlacement,
): boolean {
  return placement.inDependencies && !placement.inDevDependencies;
}

// tsconfig(JSON.parse 결과)에서 compilerOptions.outDir 의 basename(`dist`)을 추출한다.
// `"./dist"` → `dist`. 못 찾으면 null.
function extractTsconfigOutDirBasename(tsconfig: {
  compilerOptions?: { outDir?: string };
}): string | null {
  const outDir = tsconfig.compilerOptions?.outDir;
  if (typeof outDir !== "string" || outDir.length === 0) {
    return null;
  }
  // `./dist` / `dist/` / `dist` → `dist`(양끝 슬래시·`.` prefix 제거 후 마지막 segment).
  const segs = outDir
    .replace(/^\.\/+/, "")
    .replace(/\/+$/, "")
    .split("/")
    .filter((s) => s.length > 0 && s !== ".");
  return segs.length > 0 ? segs[segs.length - 1] : null;
}

// Dockerfile 소스에서 `ENTRYPOINT ["..."]` 의 entrypoint 경로를 추출한다(73행
// `ENTRYPOINT ["./deploy/docker-entrypoint.sh"]`). exec-form 의 첫 인자. 못 찾으면 null.
function extractDockerfileEntrypoint(dockerfileSource: string): string | null {
  const match = dockerfileSource.match(/ENTRYPOINT\s+\[\s*["']([^"']*)["']/);
  return match ? match[1] : null;
}

// Dockerfile 소스에 특정 COPY target 토큰(`dist`·`prisma.config.ts` 등)을 운반하는
// COPY 행이 존재하는지 판정한다. 라인 단위로 `COPY` 로 시작하고 needle 을 포함하는 행 검색.
function dockerfileHasCopyToken(
  dockerfileSource: string,
  needle: string,
): boolean {
  return dockerfileSource
    .split("\n")
    .some((line) => /^\s*COPY\s+/.test(line) && line.includes(needle));
}

// ---------------------------------------------------------------------------
// 본 spec 이 박제하는 contract 정본 — shell·artifact 양측이 수렴해야 하는 기대값.
// ---------------------------------------------------------------------------

const EXPECTED_PRISMA_BINARY_PATH = "./node_modules/.bin/prisma";
const EXPECTED_PRISMA_SUBCOMMAND = "migrate deploy";
const EXPECTED_BUILD_ARTIFACT_PATH = "dist/src/main";
const EXPECTED_DIST_PREFIX = "dist";
const EXPECTED_ENTRYPOINT_PATH = "./deploy/docker-entrypoint.sh";

describe("realdata-e2e/deploy step① docker-entrypoint.sh 런타임 계약(prisma 바이너리·migrate deploy·dist/src/main) ↔ 실 build/runtime artifact(package.json prisma deps·tsconfig outDir·Dockerfile ENTRYPOINT/COPY) parity drift smoke (T-0793)", () => {
  describe("Happy-path: shell + build/runtime artifact 소스 read + 계약/artifact 추출", () => {
    it("실 docker-entrypoint.sh + package.json + tsconfig.json + Dockerfile 4 소스를 읽어 shell 런타임 계약·artifact 를 비어있지 않게 추출한다", () => {
      const shellSource = readFileSync(DOCKER_ENTRYPOINT_PATH, "utf8");
      const pkg = JSON.parse(readFileSync(PACKAGE_JSON_PATH, "utf8"));
      const tsconfig = JSON.parse(readFileSync(TSCONFIG_PATH, "utf8"));
      const dockerfile = readFileSync(DOCKERFILE_PATH, "utf8");

      // shell 측 두 런타임 계약이 비어있지 않게 추출됨.
      const contract = extractShellRuntimeContract(shellSource);
      expect(contract.prismaBinaryPath).toBeTruthy();
      expect(contract.prismaSubcommand).toBeTruthy();
      expect(contract.buildArtifactPath).toBeTruthy();

      // artifact 측 추출이 비어있지 않음.
      const placement = extractPrismaDependencyPlacement(pkg);
      expect(placement.inDependencies).toBe(true);
      expect(extractTsconfigOutDirBasename(tsconfig)).toBeTruthy();
      expect(extractDockerfileEntrypoint(dockerfile)).toBeTruthy();
      // package.json 의 build 스크립트(nest build) sanity — dist 산출물 생성 주체.
      expect(pkg.scripts?.build).toBe("nest build");
    });

    it("repo-root 경로가 __dirname 기준으로 robust 하게 해석되어 4 소스가 실재한다", () => {
      // cwd 무관 — __dirname 기준 상대(path.resolve)로 해석한 경로가 실제 파일을 가리킨다.
      expect(readFileSync(DOCKER_ENTRYPOINT_PATH, "utf8")).toContain(
        "./node_modules/.bin/prisma migrate deploy",
      );
      expect(readFileSync(DOCKER_ENTRYPOINT_PATH, "utf8")).toContain(
        "exec node dist/src/main",
      );
      expect(readFileSync(TSCONFIG_PATH, "utf8")).toContain(
        '"outDir": "./dist"',
      );
      expect(readFileSync(DOCKERFILE_PATH, "utf8")).toContain(
        'ENTRYPOINT ["./deploy/docker-entrypoint.sh"]',
      );
    });
  });

  describe("prisma 바이너리 prune-survival 정합 수렴(핵심 불변식 1)", () => {
    it("shell ./node_modules/.bin/prisma 호출이 prod 컨테이너에서 valid — prisma 가 dependencies AND devDependencies 부재(prune --prod 생존)", () => {
      const shellSource = readFileSync(DOCKER_ENTRYPOINT_PATH, "utf8");
      const pkg = JSON.parse(readFileSync(PACKAGE_JSON_PATH, "utf8"));

      // shell 측: 바이너리 경로 byte-identical.
      const binaryPath = extractShellPrismaBinaryPath(shellSource);
      expect(binaryPath).toBe(EXPECTED_PRISMA_BINARY_PATH);

      // artifact 측: prisma 가 dependencies(truthy) AND devDependencies 부재(undefined).
      expect(pkg.dependencies?.prisma).toBeDefined();
      expect(pkg.devDependencies?.prisma).toBeUndefined();
      // @prisma/client 도 dependencies(런타임 의존).
      expect(pkg.dependencies?.["@prisma/client"]).toBeDefined();

      // prune-survival 판정 보조 함수가 true(prod 컨테이너에서 바이너리 생존).
      const placement = extractPrismaDependencyPlacement(pkg);
      expect(prismaSurvivesProdPrune(placement)).toBe(true);
      expect(placement.clientInDependencies).toBe(true);
    });
  });

  describe("migrate deploy 서브커맨드 정합 수렴(핵심 불변식 2)", () => {
    it("shell 14행 prisma 서브커맨드가 migrate deploy(byte-identical) — 배포 migration 정책(idempotent·미적용만 순차)", () => {
      const shellSource = readFileSync(DOCKER_ENTRYPOINT_PATH, "utf8");
      const subcommand = extractShellPrismaSubcommand(shellSource);
      // `migrate deploy` byte-identical(`migrate dev`/`db push` swap 검출).
      expect(subcommand).toBe(EXPECTED_PRISMA_SUBCOMMAND);
    });
  });

  describe("dist/src/main 빌드-산출물 경로 정합 수렴(핵심 불변식 3)", () => {
    it("shell exec node dist/src/main 의 dist prefix 가 tsconfig outDir basename(dist)과 정합", () => {
      const shellSource = readFileSync(DOCKER_ENTRYPOINT_PATH, "utf8");
      const tsconfig = JSON.parse(readFileSync(TSCONFIG_PATH, "utf8"));

      // shell 측: 빌드-산출물 경로 byte-identical + dist prefix.
      const artifactPath = extractShellBuildArtifactPath(shellSource);
      expect(artifactPath).toBe(EXPECTED_BUILD_ARTIFACT_PATH);
      const shellPrefix = extractBuildArtifactPrefix(artifactPath);
      expect(shellPrefix).toBe(EXPECTED_DIST_PREFIX);

      // artifact 측: tsconfig outDir basename.
      const outDirBasename = extractTsconfigOutDirBasename(tsconfig);
      expect(outDirBasename).toBe(EXPECTED_DIST_PREFIX);

      // 정합: shell dist prefix == tsconfig outDir basename(outDir 변경 drift 검출).
      expect(shellPrefix).toBe(outDirBasename);
    });
  });

  describe("Dockerfile ENTRYPOINT + COPY artifact 정합 수렴(핵심 불변식 4)", () => {
    it("Dockerfile ENTRYPOINT 가 ./deploy/docker-entrypoint.sh AND COPY 에 dist·prisma.config.ts 존재(entrypoint 경로를 valid 하게 조립)", () => {
      const dockerfile = readFileSync(DOCKERFILE_PATH, "utf8");

      // (a) ENTRYPOINT 가 본 shell 파일 경로와 byte-identical.
      const entrypoint = extractDockerfileEntrypoint(dockerfile);
      expect(entrypoint).toBe(EXPECTED_ENTRYPOINT_PATH);

      // (b) COPY 에 dist 존재 — entrypoint 의 dist/src/main 경로가 valid.
      expect(dockerfileHasCopyToken(dockerfile, "dist")).toBe(true);

      // (c) COPY 에 prisma.config.ts 존재 — prisma CLI 번들 로더 config 가 컨테이너에 존재.
      expect(dockerfileHasCopyToken(dockerfile, "prisma.config.ts")).toBe(true);
    });
  });

  describe("drift-detection 변별성 수렴(본 smoke 가 drift 를 실제로 잡음을 입증)", () => {
    it("package.json prisma 를 devDependencies 로 옮긴 합성 객체 → prune-survival false — 원본은 true·mutate 0", () => {
      const pkg = JSON.parse(readFileSync(PACKAGE_JSON_PATH, "utf8"));

      // 원본 추출(불변 baseline).
      const original = extractPrismaDependencyPlacement(pkg);
      expect(prismaSurvivesProdPrune(original)).toBe(true);

      // 사본만 mutate: prisma 를 dependencies → devDependencies 로 이동.
      const mutated = {
        dependencies: { ...(pkg.dependencies ?? {}) } as Record<string, string>,
        devDependencies: {
          ...(pkg.devDependencies ?? {}),
        } as Record<string, string>,
      };
      mutated.devDependencies.prisma = mutated.dependencies.prisma;
      delete mutated.dependencies.prisma;
      const mutatedPlacement = extractPrismaDependencyPlacement(mutated);
      // prune-survival 이 false(prod 컨테이너에서 바이너리 소멸 drift 검출).
      expect(prismaSurvivesProdPrune(mutatedPlacement)).toBe(false);

      // 원본은 mutate 0 — 여전히 dependencies 에 prisma.
      expect(pkg.dependencies?.prisma).toBeDefined();
      expect(pkg.devDependencies?.prisma).toBeUndefined();
    });

    it("tsconfig outDir 를 ./build 로 바꾼 합성 객체 → shell dist prefix 와 not.toBe", () => {
      const shellSource = readFileSync(DOCKER_ENTRYPOINT_PATH, "utf8");
      const shellPrefix = extractBuildArtifactPrefix(
        extractShellBuildArtifactPath(shellSource),
      );

      // 사본만 mutate: outDir ./dist → ./build.
      const mutatedTsconfig = { compilerOptions: { outDir: "./build" } };
      const mutatedBasename = extractTsconfigOutDirBasename(mutatedTsconfig);
      // shell 의 dist prefix 와 정합 아님(outDir 변경 drift 검출).
      expect(mutatedBasename).not.toBe(shellPrefix);
      expect(mutatedBasename).toBe("build");
      // 원본 shell prefix 는 여전히 dist.
      expect(shellPrefix).toBe(EXPECTED_DIST_PREFIX);
    });

    it("shell migrate deploy 를 migrate dev 로, dist/src/main 을 build/src/main 으로 바꾼 사본이 정본과 not.toBe — 원본 추출 불변", () => {
      const shellSource = readFileSync(DOCKER_ENTRYPOINT_PATH, "utf8");

      // 원본 추출(baseline).
      const origContract = extractShellRuntimeContract(shellSource);
      expect(origContract.prismaSubcommand).toBe(EXPECTED_PRISMA_SUBCOMMAND);
      expect(origContract.buildArtifactPath).toBe(EXPECTED_BUILD_ARTIFACT_PATH);

      // 사본만 mutate: migrate deploy → migrate dev, dist/src/main → build/src/main.
      // global replace — 주석/echo 행에도 `migrate deploy`·`dist/src/main` 문구가 있어
      // 14·20행 실 command 까지 확실히 변형하려면 모든 occurrence 를 바꿔야 한다.
      const mutated = shellSource
        .replace(/migrate deploy/g, "migrate dev")
        .replace(/dist\/src\/main/g, "build/src/main");
      const mutatedContract = extractShellRuntimeContract(mutated);
      expect(mutatedContract.prismaSubcommand).not.toBe(
        EXPECTED_PRISMA_SUBCOMMAND,
      );
      expect(mutatedContract.buildArtifactPath).not.toBe(
        EXPECTED_BUILD_ARTIFACT_PATH,
      );

      // 원본은 mutate 0 — 재추출이 baseline 과 deep-equal.
      expect(extractShellRuntimeContract(shellSource)).toEqual(origContract);
    });

    it("Dockerfile ENTRYPOINT 를 ./deploy/other.sh 로 바꾼 합성 문자열 → 본 shell 파일을 안 가리킴(not.toBe)", () => {
      const dockerfile = readFileSync(DOCKERFILE_PATH, "utf8");

      const mutated = dockerfile.replace(
        'ENTRYPOINT ["./deploy/docker-entrypoint.sh"]',
        'ENTRYPOINT ["./deploy/other.sh"]',
      );
      const mutatedEntrypoint = extractDockerfileEntrypoint(mutated);
      // mutate 사본의 ENTRYPOINT 가 본 shell 파일 경로와 정합 아님(rename drift 검출).
      expect(mutatedEntrypoint).not.toBe(EXPECTED_ENTRYPOINT_PATH);
      // 원본은 정합.
      expect(extractDockerfileEntrypoint(dockerfile)).toBe(
        EXPECTED_ENTRYPOINT_PATH,
      );
    });
  });

  describe("Error path / negative cases 충분 cover", () => {
    it("존재하지 않는 경로로 readFileSync → ENOENT throw(silent 0-byte fallback false-PASS 방지)", () => {
      const badPath = path.join(REPO_ROOT, "deploy/does-not-exist-xyz.sh");
      expect(() => readFileSync(badPath, "utf8")).toThrow();
    });

    it("prisma devDependencies drift 검출(합성) — prisma 가 devDependencies 에만 있는 합성 package.json → prune-survival false", () => {
      // 합성: prisma 가 devDependencies 에만 존재(dependencies 부재).
      const synthetic = {
        dependencies: { "@prisma/client": "^7.8.0" },
        devDependencies: { prisma: "^7.8.0" },
      };
      const placement = extractPrismaDependencyPlacement(synthetic);
      expect(placement.inDependencies).toBe(false);
      expect(placement.inDevDependencies).toBe(true);
      // prune --prod 후 미생존(prod 컨테이너 migrate deploy crash-loop) — silent PASS 아님.
      expect(prismaSurvivesProdPrune(placement)).toBe(false);
    });

    it("outDir 변경 drift 검출(합성) — outDir ./build 인 합성 tsconfig → shell dist prefix 와 not.toBe", () => {
      const shellSource = readFileSync(DOCKER_ENTRYPOINT_PATH, "utf8");
      const shellPrefix = extractBuildArtifactPrefix(
        extractShellBuildArtifactPath(shellSource),
      );
      const synthetic = { compilerOptions: { outDir: "./build" } };
      expect(extractTsconfigOutDirBasename(synthetic)).not.toBe(shellPrefix);
    });

    it("migrate 서브커맨드 swap 검출(합성) — shell migrate deploy 를 migrate dev 로 바꾼 합성 shell → 정본 migrate deploy 와 not.toBe", () => {
      const synthetic =
        "./node_modules/.bin/prisma migrate dev\nexec node dist/src/main";
      const subcommand = extractShellPrismaSubcommand(synthetic);
      // 비-deploy 서브커맨드 drift 검출.
      expect(subcommand).not.toBe(EXPECTED_PRISMA_SUBCOMMAND);
      expect(subcommand).toBe("migrate dev");
    });

    it("ENTRYPOINT 경로 drift 검출(합성) — ENTRYPOINT 를 ./deploy/other.sh 로 바꾼 합성 Dockerfile → 본 shell 파일 미지칭", () => {
      const synthetic = 'ENTRYPOINT ["./deploy/other.sh"]';
      const entrypoint = extractDockerfileEntrypoint(synthetic);
      expect(entrypoint).not.toBe(EXPECTED_ENTRYPOINT_PATH);
    });

    it("COPY 누락 검출(합성) — dist COPY 행이 없는 합성 Dockerfile → entrypoint dist/src/main 경로가 valid 하지 않음(false)", () => {
      // 합성: dist COPY 행 부재(prisma.config.ts COPY 만 존재).
      const synthetic =
        "FROM node:20\nCOPY package.json ./package.json\nCOPY prisma.config.ts ./prisma.config.ts";
      expect(dockerfileHasCopyToken(synthetic, "dist")).toBe(false);
      // prisma.config.ts COPY 는 존재(대조군 — 함수가 무조건 false 가 아님을 입증).
      expect(dockerfileHasCopyToken(synthetic, "prisma.config.ts")).toBe(true);
    });

    it("prisma 바이너리/서브커맨드 미존재 검출 — prisma 호출 없는 합성 shell → 추출이 null", () => {
      const synthetic = "set -e\necho hello\nexec node dist/src/main";
      expect(extractShellPrismaBinaryPath(synthetic)).toBeNull();
      expect(extractShellPrismaSubcommand(synthetic)).toBeNull();
    });

    it("exec node 경로 미존재 검출 — exec node 호출 없는 합성 shell → buildArtifactPath null", () => {
      const synthetic = "set -e\n./node_modules/.bin/prisma migrate deploy";
      expect(extractShellBuildArtifactPath(synthetic)).toBeNull();
      expect(extractBuildArtifactPrefix(null)).toBeNull();
    });
  });

  describe("credential 누출 0(REQ-059 / §9)", () => {
    it("추출/합성하는 어떤 문자열(prisma 경로·서브커맨드·dist 경로·outDir·ENTRYPOINT·COPY·합성 config/Dockerfile)에도 credential placeholder 미surface", () => {
      const shellSource = readFileSync(DOCKER_ENTRYPOINT_PATH, "utf8");
      const tsconfig = JSON.parse(readFileSync(TSCONFIG_PATH, "utf8"));
      const dockerfile = readFileSync(DOCKERFILE_PATH, "utf8");

      const contract = extractShellRuntimeContract(shellSource);
      // 본 smoke 가 다루는 surface 만 검사 — 계약 path·서브커맨드·prefix·outDir·ENTRYPOINT.
      const haystacks = [
        contract.prismaBinaryPath ?? "",
        contract.prismaSubcommand ?? "",
        contract.buildArtifactPath ?? "",
        extractTsconfigOutDirBasename(tsconfig) ?? "",
        extractDockerfileEntrypoint(dockerfile) ?? "",
        EXPECTED_PRISMA_BINARY_PATH,
        EXPECTED_PRISMA_SUBCOMMAND,
        EXPECTED_BUILD_ARTIFACT_PATH,
        EXPECTED_ENTRYPOINT_PATH,
      ];

      // token 형태(GH_TOKEN/Bearer/Authorization/x-*-token/ghp_/sk-/DATABASE_URL 실값)만 검출.
      const credentialPattern =
        /(GH_TOKEN|\bBearer\b|Authorization|x-access-token|x-github-token|ghp_|\bsk-|postgres:\/\/[^@\s]*:[^@\s]+@)/i;
      haystacks.forEach((s) => {
        expect(credentialPattern.test(s)).toBe(false);
      });
    });
  });

  describe("결정론·no-mutation", () => {
    it("동일 shell·config·Dockerfile 소스로 추출을 두 번 → 결과가 byte-identical deep-equal", () => {
      const shellSource = readFileSync(DOCKER_ENTRYPOINT_PATH, "utf8");
      const pkg = JSON.parse(readFileSync(PACKAGE_JSON_PATH, "utf8"));

      const a = extractShellRuntimeContract(shellSource);
      const b = extractShellRuntimeContract(shellSource);
      expect(a).toEqual(b);

      const pa = extractPrismaDependencyPlacement(pkg);
      const pb = extractPrismaDependencyPlacement(pkg);
      expect(pa).toEqual(pb);
    });

    it("추출 보조 함수가 입력 객체를 mutate 0 — 사본 mutate 후에도 원본 추출 결과 불변", () => {
      const pkg = JSON.parse(readFileSync(PACKAGE_JSON_PATH, "utf8"));
      const before = extractPrismaDependencyPlacement(pkg);

      // 사본 mutate(drift 변별성 항과 동형) — 사본은 변형되나 원본 객체·추출 결과는 불변.
      const mutated = {
        dependencies: { ...(pkg.dependencies ?? {}) } as Record<string, string>,
        devDependencies: {
          ...(pkg.devDependencies ?? {}),
        } as Record<string, string>,
      };
      mutated.devDependencies.prisma = mutated.dependencies.prisma;
      delete mutated.dependencies.prisma;
      const mutatedPlacement = extractPrismaDependencyPlacement(mutated);
      expect(mutatedPlacement).not.toEqual(before);
      // 원본 재추출은 before 와 deep-equal(보조 함수가 입력 mutate 0).
      const after = extractPrismaDependencyPlacement(pkg);
      expect(after).toEqual(before);
    });
  });
});
