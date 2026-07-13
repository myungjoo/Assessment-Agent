// realdata-e2e-dockerfile-internal-multistage-build-sequence-base-image-pin-layer-cache-order-frozen-lockfile-prune-nonroot-entrypoint-wiring-contract.smoke-spec.ts
// — 무인 nightly 재배포 runner chain(daily-test.sh · redeploy.sh · seed-llm-config.sh · docker-entrypoint.sh ·
// systemd unit · docker-compose.yml) 의 **빌드 leg** — `docker-compose.yml`(T-0962 봉함)의 `app.build` 가
// 참조하고 그 이미지의 `ENTRYPOINT` 가 곧 `docker-entrypoint.sh`(T-0960 봉함)인 `Dockerfile` 의
// **내부 멀티스테이지 빌드 시퀀스 semantic 계약**을 실 Dockerfile 을 readFileSync 로 읽어
// (실 docker build/실 이미지 빌드/실 pnpm install/실 컨테이너 0) 정적 검증하는 non-gated build-time smoke
// (T-0963, PLAN.md §109 재배포 runner chain — 빌드 leg).
//
// 봉함 불변식(Dockerfile 자신의 내부 빌드 시퀀스 semantic — T-0795/T-0797 outer parity 와 distinct 상보):
//   (1) 정확히 2개 named build stage `builder`/`runtime` 분리 — build toolchain 을 런타임 이미지에서 격리.
//       붕괴 시 runtime 에 build toolchain 잔존 → 이미지 비대·보안 표면 확대.
//   (2) 두 stage 모두 동일 pinned 베이스 `node:20-bookworm-slim` — major/variant tag 고정으로 런타임 결정성.
//       tag 이탈(node:latest 등) 시 런타임 non-determinism.
//   (3) builder 레이어-캐시 순서: 의존성 메타 COPY → `pnpm install --frozen-lockfile` → `COPY . .` → `pnpm build`.
//       순서 소실 시 소스 변경마다 install layer 무효화 → 빌드 시간 폭증.
//   (4) `pnpm install --frozen-lockfile` — lockfile 정확 일치 강제(deterministic install, CI parity).
//       `--frozen-lockfile` 소실 시 lockfile-drift 로 CI 와 이미지 의존성 불일치.
//   (5) `pnpm build`(backend) 가 `pnpm --filter web build`(web) 보다 먼저/같은 RUN — backend+web 이중 빌드.
//   (6) `pnpm prune --prod` 존재 + 소스상 `pnpm build` 이후 — devDependency 제거로 slim 런타임.
//       소실 시 devDependency 가 런타임 이미지에 잔존(비대).
//   (7) runtime `COPY --from=builder` 선별 산출물 복사(node_modules/dist/web/dist/prisma) — builder 로부터만 이관.
//       전체 복사 시 slim 이미지 목적 붕괴.
//   (8) `COPY --from=builder --chown=node:node` — 소유권을 node uid 로(비루트 소유).
//   (9) `USER node` 비루트 실행. 소실 시 root 실행(보안 회귀).
//   (10) `ENV NODE_ENV=production`(runtime stage).
//   (11) `ENTRYPOINT ["./deploy/docker-entrypoint.sh"]` — T-0960 봉함 entrypoint 로 배선(migration-before-boot 진입).
//   (12) `RUN chmod +x ./deploy/docker-entrypoint.sh` 가 `USER node` **이전** — USER 전환 후 root-only chmod 불가.
//   (13) runtime `COPY --from=builder` 참조 stage 이름이 실제 선언된 `AS builder` 와 정합 — 미존재 stage 참조 시 build 실패.
//   (14) §9 secret-safety — 추출/합성 토큰에 실 secret/password/토큰/실 DATABASE_URL/실 endpoint 0
//        (빌드 지시 키·베이스 이미지 tag·pnpm 명령·stage 이름·USER node·경로만).
//
// 전략(형제 T-0962 docker-compose 내부 오케스트레이션·T-0961 systemd unit 내부 directive·T-0960 docker-entrypoint
// 내부 부팅 동형): Dockerfile 에서 stage 선언·builder/runtime 블록·빌드 지시 토큰을 정적 추출하는 해석 동형
// TS 순수 함수(`stageDeclarations`·`stageBlock`·`stageImage`·`builderCopyLines`·`entrypointArgv`·
// `extractDockerfileBuildAnchors`)로 빌드 시퀀스 불변식 assert. 합성 mutant 사본으로 negative(a~g 7종) 변별.
// 기존 `realdata-e2e-docker-compose-orchestration-contract-artifact-parity-drift.smoke-spec.ts`
// (T-0795: EXPOSE 포트 **값**·ENTRYPOINT 행 **단순 존재**·PORT 4중 byte-identity) 와
// `realdata-e2e-docker-entrypoint-runtime-contract-build-artifact-parity-drift.smoke-spec.ts`
// (T-0797: package.json prisma dependency **배치** 가 prune --prod 후 생존) 와 distinct 상보 surface —
// 본 task 는 EXPOSE 값·ENTRYPOINT 단순 존재·prisma dep 배치를 재검증하지 않는다(중복 금지). 본 task 는
// Dockerfile 내부 빌드 시퀀스 semantic(2-stage 분리·베이스 pin·레이어캐시 순서·frozen-lockfile·prune·선별 COPY·
// USER node·NODE_ENV·chmod→USER 순서·ENTRYPOINT 배선 경로·stage 이름 정합)만. ENTRYPOINT 는 본 task 에서
// **배선 대상 경로 정합**(`./deploy/docker-entrypoint.sh`) 관점으로만 assert — 단순 "행 존재"(T-0795) 와 구분.
//   🔥 실 docker build/실 이미지 빌드/실 pnpm install/실 컨테이너 0 · process.env 읽기 0(입력은 pure 함수 파라미터)
//      · credential 0(§9/REQ-059) · 새 dep 0(node fs/path, YAML/Dockerfile 파서 추가 0) · src 변경 0(test-only)
//      · Dockerfile 읽기만(실행 0 · 변경 0).
import { existsSync, readFileSync } from "fs";
import * as path from "path";

// repo-root 경로 — test 실행 cwd 무관하게 robust 하게 해석(`__dirname` = test/smoke,
// 두 단계 위가 repo-root). `process.cwd()` 대신 `__dirname` 기준 상대로 고정한다(sibling T-0962).
const REPO_ROOT = path.resolve(__dirname, "../..");
const DOCKERFILE_PATH = path.join(REPO_ROOT, "Dockerfile");

// 정본 앵커(실 Dockerfile 표현의 TS mirror — 실 docker build 실행 0).
const BASE_IMAGE = "node:20-bookworm-slim"; // 두 stage 공통 pinned 베이스 이미지.
const BUILDER_STAGE = "builder"; // build toolchain + backend/web 빌드 stage.
const RUNTIME_STAGE = "runtime"; // 산출물 + 운영 의존성만 담은 슬림 런타임 stage.
const ENTRYPOINT_SCRIPT = "./deploy/docker-entrypoint.sh"; // T-0960 봉함 entrypoint 배선 대상.
// runtime 이 builder 로부터 선별 복사해야 할 핵심 산출물 소스 경로(정본).
const SELECTIVE_ARTIFACTS = [
  "/app/node_modules",
  "/app/dist",
  "/app/web/dist",
  "/app/prisma",
];

// ── TS 동형 pure 함수(정본) — Dockerfile 의 stage 선언·builder/runtime 블록·빌드 지시를 모델링.
//    입력(문자열)은 mutate 하지 않는다(읽기만). 실 docker/pnpm 읽기 0 — 입력은 파라미터.
//    전체 Dockerfile 스펙 파싱이 아니라 stage 헤더 슬라이스 + 필요한 빌드 토큰만 추출.

// 소스를 CRLF-정규화 후 라인 배열로 — 모든 파서의 공통 입력.
function toLines(source: string): string[] {
  return source.replace(/\r\n/g, "\n").split("\n");
}

// stageDeclarations(source): `FROM <image> AS <name>` 선언들을 {image, name} 배열로. 부재면 빈 배열.
function stageDeclarations(source: string): { image: string; name: string }[] {
  return toLines(source)
    .map((l) => l.match(/^\s*FROM\s+(\S+)\s+AS\s+(\S+)\s*$/))
    .filter((m): m is RegExpMatchArray => m !== null)
    .map((m) => ({ image: m[1], name: m[2] }));
}

// declaredStageNames(source): 선언된 모든 stage 이름.
function declaredStageNames(source: string): string[] {
  return stageDeclarations(source).map((s) => s.name);
}

// stageImage(source, name): 특정 stage 의 베이스 이미지 — 부재면 undefined.
function stageImage(source: string, name: string): string | undefined {
  return stageDeclarations(source).find((s) => s.name === name)?.image;
}

// stageBlock(source, name): `FROM ... AS <name>` 헤더 직후부터 다음 `FROM` 라인(또는 EOF) 직전까지.
//   builder/runtime 블록 격리. 부재면 빈 배열.
function stageBlock(source: string, name: string): string[] {
  const lines = toLines(source);
  const start = lines.findIndex((l) =>
    new RegExp(`^\\s*FROM\\s+\\S+\\s+AS\\s+${name}\\s*$`).test(l),
  );
  if (start < 0) return [];
  const rest = lines.slice(start + 1);
  const nextFrom = rest.findIndex((l) => /^\s*FROM\s+/.test(l));
  return nextFrom < 0 ? rest : rest.slice(0, nextFrom);
}

// firstMatchIndex(lines, re): 라인 배열에서 re 에 처음 매칭되는 인덱스 — 부재면 -1.
function firstMatchIndex(lines: string[], re: RegExp): number {
  return lines.findIndex((l) => re.test(l));
}

// hasStage(source, name, image): `FROM <image> AS <name>` 정확 선언 존재.
function hasStage(source: string, name: string, image: string): boolean {
  return stageDeclarations(source).some(
    (s) => s.name === name && s.image === image,
  );
}

// builderCopyLines(source): runtime stage 의 `COPY --from=builder ...` 라인들.
function builderCopyLines(source: string): string[] {
  return stageBlock(source, RUNTIME_STAGE).filter((l) =>
    /^\s*COPY\s+--from=builder\b/.test(l),
  );
}

// copiesFromBuilder(source, srcPath): runtime 이 builder 로부터 정확히 srcPath 를 복사(src 토큰 == srcPath).
//   `COPY --from=builder --chown=node:node /app/dist ./dist` → src = 마지막에서 두 번째 토큰.
function copiesFromBuilder(source: string, srcPath: string): boolean {
  return builderCopyLines(source).some((l) => {
    const tokens = l.trim().split(/\s+/);
    return tokens[tokens.length - 2] === srcPath;
  });
}

// referencedFromStages(source): 전체 소스의 `--from=<name>` 참조 stage 이름 집합.
function referencedFromStages(source: string): string[] {
  const out: string[] = [];
  for (const l of toLines(source)) {
    const m = l.match(/--from=(\S+)/);
    if (m) out.push(m[1]);
  }
  return out;
}

// entrypointArgv(source): `ENTRYPOINT ["a", "b"]` exec-form argv 배열 — 부재/shell-form 이면 빈 배열.
function entrypointArgv(source: string): string[] {
  const line = toLines(source).find((l) => /^\s*ENTRYPOINT\s+\[/.test(l));
  if (!line) return [];
  const inner = line.match(/\[(.*)\]/);
  if (!inner) return [];
  return inner[1]
    .split(",")
    .map((s) => s.trim().replace(/^["']|["']$/g, ""))
    .filter((s) => s.length > 0);
}

// hasFrozenLockfileInstall(source): builder 에 `pnpm install --frozen-lockfile` 존재.
function hasFrozenLockfileInstall(source: string): boolean {
  return stageBlock(source, BUILDER_STAGE).some((l) =>
    /pnpm install --frozen-lockfile/.test(l),
  );
}

// layerCacheOrderIntact(source): builder 의 dep-meta COPY → frozen install → COPY . . → pnpm build 상대 순서.
//   네 토큰 모두 존재하고 이 순서로 등장해야 true. 하나라도 부재/역전이면 false.
function layerCacheOrderIntact(source: string): boolean {
  const b = stageBlock(source, BUILDER_STAGE);
  const depMeta = firstMatchIndex(b, /^\s*COPY\s+package\.json\b/);
  const install = firstMatchIndex(b, /pnpm install --frozen-lockfile/);
  const fullCopy = firstMatchIndex(b, /^\s*COPY\s+\.\s+\.\s*$/);
  const build = firstMatchIndex(b, /\bpnpm build\b/);
  if ([depMeta, install, fullCopy, build].some((i) => i < 0)) return false;
  return depMeta < install && install < fullCopy && fullCopy < build;
}

// backendBuildBeforeWeb(source): backend `pnpm build` 가 web `pnpm --filter web build` 보다 먼저/같은 위치.
//   둘 다 존재해야 하고 backendIdx <= webIdx.
function backendBuildBeforeWeb(source: string): boolean {
  const b = stageBlock(source, BUILDER_STAGE);
  const backend = firstMatchIndex(b, /\bpnpm build\b/);
  const web = firstMatchIndex(b, /pnpm --filter web build/);
  if (backend < 0 || web < 0) return false;
  return backend <= web;
}

// pruneAfterBuild(source): `pnpm prune --prod` 가 존재하고 소스상 `pnpm build` 이후 위치.
function pruneAfterBuild(source: string): boolean {
  const b = stageBlock(source, BUILDER_STAGE);
  const build = firstMatchIndex(b, /\bpnpm build\b/);
  const prune = firstMatchIndex(b, /pnpm prune --prod/);
  if (build < 0 || prune < 0) return false;
  return prune > build;
}

// selectiveArtifactsCopied(source): 핵심 산출물 4종 모두 builder 로부터 선별 복사됨.
function selectiveArtifactsCopied(source: string): boolean {
  return SELECTIVE_ARTIFACTS.every((a) => copiesFromBuilder(source, a));
}

// builderCopiesChownNode(source): 모든 `COPY --from=builder` 라인이 `--chown=node:node` 소유권 지정.
function builderCopiesChownNode(source: string): boolean {
  const lines = builderCopyLines(source);
  return lines.length > 0 && lines.every((l) => /--chown=node:node\b/.test(l));
}

// hasUserNode(source): runtime 에 `USER node`(비루트 실행) 존재.
function hasUserNode(source: string): boolean {
  return stageBlock(source, RUNTIME_STAGE).some((l) =>
    /^\s*USER\s+node\s*$/.test(l),
  );
}

// hasNodeEnvProduction(source): runtime 에 `ENV NODE_ENV=production` 존재.
function hasNodeEnvProduction(source: string): boolean {
  return stageBlock(source, RUNTIME_STAGE).some((l) =>
    /^\s*ENV\s+NODE_ENV=production\s*$/.test(l),
  );
}

// entrypointWiredToScript(source): ENTRYPOINT exec argv 가 정확히 [ENTRYPOINT_SCRIPT].
function entrypointWiredToScript(source: string): boolean {
  const argv = entrypointArgv(source);
  return argv.length === 1 && argv[0] === ENTRYPOINT_SCRIPT;
}

// chmodBeforeUser(source): runtime 에서 `RUN chmod +x ...docker-entrypoint.sh` 가 `USER node` **이전**.
//   USER 전환 후에는 root-only chmod 권한이 없을 수 있어 실행권 부여가 root 단계에서 선행돼야 함.
function chmodBeforeUser(source: string): boolean {
  const r = stageBlock(source, RUNTIME_STAGE);
  const chmod = firstMatchIndex(r, /^\s*RUN\s+chmod\s+\+x\b/);
  const user = firstMatchIndex(r, /^\s*USER\s+node\s*$/);
  if (chmod < 0 || user < 0) return false;
  return chmod < user;
}

// stageNamesConsistent(source): 모든 `--from=<name>` 참조가 실제 선언된 stage 이름 집합에 존재.
//   미존재 stage 참조(build 실패) 검출.
function stageNamesConsistent(source: string): boolean {
  const declared = declaredStageNames(source);
  const referenced = referencedFromStages(source);
  return referenced.length > 0 && referenced.every((r) => declared.includes(r));
}

// (집계) extractDockerfileBuildAnchors(source): 내부 빌드 시퀀스 불변식을 한 번에 집계 —
//   하나라도 부재/변질이면 명시적 false(빈 결과 성공-위장 0).
function extractDockerfileBuildAnchors(source: string): {
  builderStage: boolean;
  runtimeStage: boolean;
  builderPinned: boolean;
  runtimePinned: boolean;
  layerCacheOrder: boolean;
  frozenLockfile: boolean;
  backendBeforeWeb: boolean;
  pruneAfterBuild: boolean;
  selectiveCopy: boolean;
  chownNode: boolean;
  userNode: boolean;
  nodeEnvProd: boolean;
  entrypointWired: boolean;
  chmodBeforeUser: boolean;
  stageNamesConsistent: boolean;
} {
  return {
    builderStage: hasStage(source, BUILDER_STAGE, BASE_IMAGE),
    runtimeStage: hasStage(source, RUNTIME_STAGE, BASE_IMAGE),
    builderPinned: stageImage(source, BUILDER_STAGE) === BASE_IMAGE,
    runtimePinned: stageImage(source, RUNTIME_STAGE) === BASE_IMAGE,
    layerCacheOrder: layerCacheOrderIntact(source),
    frozenLockfile: hasFrozenLockfileInstall(source),
    backendBeforeWeb: backendBuildBeforeWeb(source),
    pruneAfterBuild: pruneAfterBuild(source),
    selectiveCopy: selectiveArtifactsCopied(source),
    chownNode: builderCopiesChownNode(source),
    userNode: hasUserNode(source),
    nodeEnvProd: hasNodeEnvProduction(source),
    entrypointWired: entrypointWiredToScript(source),
    chmodBeforeUser: chmodBeforeUser(source),
    stageNamesConsistent: stageNamesConsistent(source),
  };
}

describe("realdata-e2e §109 Dockerfile 내부 멀티스테이지 빌드 시퀀스 계약 smoke — 2-stage builder/runtime 분리 + node:20-bookworm-slim 베이스 pin ×2 + dep-meta→frozen-install→소스-COPY→build 레이어캐시 순서 + backend→web build + prune --prod + COPY --from=builder --chown=node:node 선별 복사 + USER node 비루트 + ENV NODE_ENV=production + chmod→USER 순서 + ENTRYPOINT docker-entrypoint 배선 + secret-safety (T-0963)", () => {
  describe("Happy-path: Dockerfile 실존 + 내부 빌드 시퀀스 앵커 정적 추출(pure 함수가 실 소스를 mirror)", () => {
    it("Dockerfile 이 repo-root 기준 실존(existsSync)", () => {
      expect(existsSync(DOCKERFILE_PATH)).toBe(true);
    });

    it("15 불변식(builder/runtime stage·pin ×2·레이어캐시·frozen·backend→web·prune·선별 COPY·chown·USER·NODE_ENV·ENTRYPOINT·chmod→USER·stage 이름 정합) 전부 true", () => {
      const source = readFileSync(DOCKERFILE_PATH, "utf8");
      const anchors = extractDockerfileBuildAnchors(source);
      expect(anchors.builderStage).toBe(true);
      expect(anchors.runtimeStage).toBe(true);
      expect(anchors.builderPinned).toBe(true);
      expect(anchors.runtimePinned).toBe(true);
      expect(anchors.layerCacheOrder).toBe(true);
      expect(anchors.frozenLockfile).toBe(true);
      expect(anchors.backendBeforeWeb).toBe(true);
      expect(anchors.pruneAfterBuild).toBe(true);
      expect(anchors.selectiveCopy).toBe(true);
      expect(anchors.chownNode).toBe(true);
      expect(anchors.userNode).toBe(true);
      expect(anchors.nodeEnvProd).toBe(true);
      expect(anchors.entrypointWired).toBe(true);
      expect(anchors.chmodBeforeUser).toBe(true);
      expect(anchors.stageNamesConsistent).toBe(true);
    });
  });

  describe("Happy-path: 정확히 2개 named build stage builder/runtime 분리(build toolchain 격리)", () => {
    it("FROM ... AS builder AND FROM ... AS runtime 두 stage 선언 존재", () => {
      const source = readFileSync(DOCKERFILE_PATH, "utf8");
      const names = declaredStageNames(source);
      expect(names).toContain(BUILDER_STAGE);
      expect(names).toContain(RUNTIME_STAGE);
    });

    it("정확히 2개 stage 만 선언(과다 stage 없음 — 2-stage 계약)", () => {
      const source = readFileSync(DOCKERFILE_PATH, "utf8");
      expect(stageDeclarations(source)).toHaveLength(2);
    });
  });

  describe("Happy-path: 두 stage 모두 node:20-bookworm-slim 베이스 pin(런타임 결정성)", () => {
    it("builder·runtime 두 stage 의 베이스 이미지가 모두 node:20-bookworm-slim(major/variant tag 고정)", () => {
      const source = readFileSync(DOCKERFILE_PATH, "utf8");
      expect(stageImage(source, BUILDER_STAGE)).toBe(BASE_IMAGE);
      expect(stageImage(source, RUNTIME_STAGE)).toBe(BASE_IMAGE);
      // latest / unpinned tag 가 아님을 명시.
      expect(stageImage(source, RUNTIME_STAGE)).not.toBe("node:latest");
      expect(stageImage(source, RUNTIME_STAGE)).not.toBe("node");
    });
  });

  describe("Happy-path: builder 레이어-캐시 순서(dep-meta COPY → frozen install → COPY . . → build)", () => {
    it("의존성 메타 COPY → pnpm install --frozen-lockfile → COPY . . → pnpm build 상대 순서 유지(install-before-source)", () => {
      const source = readFileSync(DOCKERFILE_PATH, "utf8");
      expect(layerCacheOrderIntact(source)).toBe(true);
    });

    it("pnpm install --frozen-lockfile 존재(lockfile 정확 일치 강제 — deterministic install/CI parity)", () => {
      const source = readFileSync(DOCKERFILE_PATH, "utf8");
      expect(hasFrozenLockfileInstall(source)).toBe(true);
    });
  });

  describe("Happy-path: backend build → web build 순서(backend+web 이중 빌드)", () => {
    it("pnpm build(backend) 가 pnpm --filter web build(web) 보다 먼저/같은 RUN 에 등장", () => {
      const source = readFileSync(DOCKERFILE_PATH, "utf8");
      expect(backendBuildBeforeWeb(source)).toBe(true);
    });
  });

  describe("Happy-path: pnpm prune --prod 존재 + build 이후 위치(slim 런타임)", () => {
    it("pnpm prune --prod 라인이 pnpm build 이후 위치(devDependency 제거)", () => {
      const source = readFileSync(DOCKERFILE_PATH, "utf8");
      expect(pruneAfterBuild(source)).toBe(true);
    });
  });

  describe("Happy-path: runtime COPY --from=builder 선별 산출물 복사 + node:node 소유", () => {
    it("node_modules·dist·web/dist·prisma 각각 builder 로부터 선별 복사(전체 복사 아님)", () => {
      const source = readFileSync(DOCKERFILE_PATH, "utf8");
      for (const artifact of SELECTIVE_ARTIFACTS) {
        expect(copiesFromBuilder(source, artifact)).toBe(true);
      }
      expect(selectiveArtifactsCopied(source)).toBe(true);
    });

    it("모든 COPY --from=builder 라인이 --chown=node:node 소유권 지정(비루트 소유)", () => {
      const source = readFileSync(DOCKERFILE_PATH, "utf8");
      expect(builderCopiesChownNode(source)).toBe(true);
      expect(builderCopyLines(source).length).toBeGreaterThan(0);
    });
  });

  describe("Happy-path: USER node 비루트 실행 + ENV NODE_ENV=production", () => {
    it("runtime 에 USER node 존재(비루트 실행 — 보안 표면 축소)", () => {
      const source = readFileSync(DOCKERFILE_PATH, "utf8");
      expect(hasUserNode(source)).toBe(true);
    });

    it("runtime 에 ENV NODE_ENV=production 존재", () => {
      const source = readFileSync(DOCKERFILE_PATH, "utf8");
      expect(hasNodeEnvProduction(source)).toBe(true);
    });
  });

  describe("Happy-path: ENTRYPOINT docker-entrypoint 배선(경로 정합 — T-0795 단순 존재와 구분)", () => {
    it("ENTRYPOINT exec argv 가 정확히 [./deploy/docker-entrypoint.sh](T-0960 봉함 entrypoint 로 배선)", () => {
      const source = readFileSync(DOCKERFILE_PATH, "utf8");
      expect(entrypointArgv(source)).toEqual([ENTRYPOINT_SCRIPT]);
      expect(entrypointWiredToScript(source)).toBe(true);
    });
  });

  describe("chmod→USER 순서 계약: RUN chmod +x 가 USER node 이전", () => {
    it("RUN chmod +x ./deploy/docker-entrypoint.sh 가 소스상 USER node 이전(root 단계 실행권 부여 선행)", () => {
      const source = readFileSync(DOCKERFILE_PATH, "utf8");
      expect(chmodBeforeUser(source)).toBe(true);
      const r = stageBlock(source, RUNTIME_STAGE);
      const chmodIdx = firstMatchIndex(r, /^\s*RUN\s+chmod\s+\+x\b/);
      const userIdx = firstMatchIndex(r, /^\s*USER\s+node\s*$/);
      expect(chmodIdx).toBeGreaterThanOrEqual(0);
      expect(userIdx).toBeGreaterThanOrEqual(0);
      expect(chmodIdx).toBeLessThan(userIdx);
    });
  });

  describe("stage 소유 계약(build↔runtime 격리): COPY --from=builder 참조 stage == 선언된 AS builder", () => {
    it("runtime 의 --from=builder 참조 이름이 실제 선언된 stage 이름 집합에 존재(미존재 stage 참조 → build 실패 검출)", () => {
      const source = readFileSync(DOCKERFILE_PATH, "utf8");
      expect(referencedFromStages(source)).toContain(BUILDER_STAGE);
      expect(declaredStageNames(source)).toContain(BUILDER_STAGE);
      expect(stageNamesConsistent(source)).toBe(true);
    });
  });

  describe("branch: 각 불변식 있음/없음 정적 대조(합성 mutant 사본 — 원본 미변조)", () => {
    it("베이스 pin 있음/이탈(node:latest) 분기", () => {
      const source = readFileSync(DOCKERFILE_PATH, "utf8");
      expect(stageImage(source, RUNTIME_STAGE)).toBe(BASE_IMAGE);
      const mutant = source.replace(
        `FROM ${BASE_IMAGE} AS ${RUNTIME_STAGE}`,
        `FROM node:latest AS ${RUNTIME_STAGE}`,
      );
      expect(stageImage(mutant, RUNTIME_STAGE)).toBe("node:latest");
      expect(extractDockerfileBuildAnchors(mutant).runtimePinned).toBe(false);
      // 원본 불변.
      expect(stageImage(source, RUNTIME_STAGE)).toBe(BASE_IMAGE);
    });

    it("frozen-lockfile 있음/없음 분기", () => {
      const source = readFileSync(DOCKERFILE_PATH, "utf8");
      expect(hasFrozenLockfileInstall(source)).toBe(true);
      const mutant = source.replace(
        "pnpm install --frozen-lockfile",
        "pnpm install",
      );
      expect(hasFrozenLockfileInstall(mutant)).toBe(false);
    });

    it("레이어-캐시 순서 정상/역전 분기", () => {
      const source = readFileSync(DOCKERFILE_PATH, "utf8");
      expect(layerCacheOrderIntact(source)).toBe(true);
      // COPY . . 를 dep-meta COPY 앞으로 이동(순서 역전).
      const mutant = source
        .replace(/\nCOPY \. \.\n/, "\n")
        .replace(/COPY package\.json/, "COPY . .\nCOPY package.json");
      expect(layerCacheOrderIntact(mutant)).toBe(false);
    });

    it("prune 있음/없음 분기", () => {
      const source = readFileSync(DOCKERFILE_PATH, "utf8");
      expect(pruneAfterBuild(source)).toBe(true);
      const mutant = source.replace("RUN pnpm prune --prod", "RUN true");
      expect(pruneAfterBuild(mutant)).toBe(false);
    });

    it("USER node 있음/없음 분기", () => {
      const source = readFileSync(DOCKERFILE_PATH, "utf8");
      expect(hasUserNode(source)).toBe(true);
      const mutant = source.replace(/\nUSER node\n/, "\n");
      expect(hasUserNode(mutant)).toBe(false);
    });

    it("ENTRYPOINT 정상/우회 분기", () => {
      const source = readFileSync(DOCKERFILE_PATH, "utf8");
      expect(entrypointWiredToScript(source)).toBe(true);
      const mutant = source.replace(
        `ENTRYPOINT ["${ENTRYPOINT_SCRIPT}"]`,
        'ENTRYPOINT ["node", "dist/src/main"]',
      );
      expect(entrypointWiredToScript(mutant)).toBe(false);
    });

    it("stage 이름 일치/불일치 분기", () => {
      const source = readFileSync(DOCKERFILE_PATH, "utf8");
      expect(stageNamesConsistent(source)).toBe(true);
      const mutant = source.replace(/--from=builder/g, "--from=build");
      expect(stageNamesConsistent(mutant)).toBe(false);
    });
  });

  describe("Error path / negative cases 충분 cover (mutant 합성 사본 — 원본 미변조)", () => {
    it("error path — Dockerfile 부재 경로 → readFileSync throw(silent 0-byte fallback 0)", () => {
      const badPath = path.join(REPO_ROOT, "__does_not_exist__.Dockerfile");
      expect(existsSync(badPath)).toBe(false);
      expect(() => readFileSync(badPath, "utf8")).toThrow();
    });

    it("error path — 빌드 토큰 부재 시 명시적 false(빈 매칭을 pass 로 오통과 0)", () => {
      const emptyDockerfile = "FROM scratch\n";
      const anchors = extractDockerfileBuildAnchors(emptyDockerfile);
      expect(anchors.builderStage).toBe(false);
      expect(anchors.runtimeStage).toBe(false);
      expect(anchors.builderPinned).toBe(false);
      expect(anchors.runtimePinned).toBe(false);
      expect(anchors.layerCacheOrder).toBe(false);
      expect(anchors.frozenLockfile).toBe(false);
      expect(anchors.backendBeforeWeb).toBe(false);
      expect(anchors.pruneAfterBuild).toBe(false);
      expect(anchors.selectiveCopy).toBe(false);
      expect(anchors.chownNode).toBe(false);
      expect(anchors.userNode).toBe(false);
      expect(anchors.nodeEnvProd).toBe(false);
      expect(anchors.entrypointWired).toBe(false);
      expect(anchors.chmodBeforeUser).toBe(false);
      expect(anchors.stageNamesConsistent).toBe(false);
      // 실 소스는 반대로 전부 true — 부재/실재를 변별함을 대비로 실증.
      const real = extractDockerfileBuildAnchors(
        readFileSync(DOCKERFILE_PATH, "utf8"),
      );
      expect(real.builderStage).toBe(true);
      expect(real.layerCacheOrder).toBe(true);
      expect(real.entrypointWired).toBe(true);
    });

    it("negative (a) — runtime FROM node:20-bookworm-slim→node:latest mutant → 베이스 pin 이탈(비결정) 검출", () => {
      const source = readFileSync(DOCKERFILE_PATH, "utf8");
      expect(stageImage(source, RUNTIME_STAGE)).toBe(BASE_IMAGE);
      const mutant = source.replace(
        `FROM ${BASE_IMAGE} AS ${RUNTIME_STAGE}`,
        `FROM node:latest AS ${RUNTIME_STAGE}`,
      );
      expect(stageImage(mutant, RUNTIME_STAGE)).toBe("node:latest");
      expect(extractDockerfileBuildAnchors(mutant).runtimePinned).toBe(false);
      // builder 는 여전히 pin 유지(runtime 만 이탈).
      expect(stageImage(mutant, BUILDER_STAGE)).toBe(BASE_IMAGE);
      // 원본 불변.
      expect(stageImage(source, RUNTIME_STAGE)).toBe(BASE_IMAGE);
    });

    it("negative (b) — pnpm install 에서 --frozen-lockfile 제거 mutant → lockfile-drift 허용 검출", () => {
      const source = readFileSync(DOCKERFILE_PATH, "utf8");
      expect(hasFrozenLockfileInstall(source)).toBe(true);
      const mutant = source.replace(
        "pnpm install --frozen-lockfile",
        "pnpm install",
      );
      expect(hasFrozenLockfileInstall(mutant)).toBe(false);
      expect(extractDockerfileBuildAnchors(mutant).frozenLockfile).toBe(false);
      // 원본 불변.
      expect(hasFrozenLockfileInstall(source)).toBe(true);
    });

    it("negative (c) — dep-meta COPY 를 COPY . . 뒤로 옮긴(레이어캐시 순서 역전) mutant → install-before-source 소실 검출", () => {
      const source = readFileSync(DOCKERFILE_PATH, "utf8");
      expect(layerCacheOrderIntact(source)).toBe(true);
      const mutant = source
        .replace(/\nCOPY \. \.\n/, "\n")
        .replace(/COPY package\.json/, "COPY . .\nCOPY package.json");
      expect(layerCacheOrderIntact(mutant)).toBe(false);
      expect(extractDockerfileBuildAnchors(mutant).layerCacheOrder).toBe(false);
      // 원본 불변.
      expect(layerCacheOrderIntact(source)).toBe(true);
    });

    it("negative (d) — pnpm prune --prod 라인 제거 mutant → devDependency 런타임 잔존(비대) 검출", () => {
      const source = readFileSync(DOCKERFILE_PATH, "utf8");
      expect(pruneAfterBuild(source)).toBe(true);
      const mutant = source.replace("RUN pnpm prune --prod", "RUN true");
      expect(pruneAfterBuild(mutant)).toBe(false);
      expect(extractDockerfileBuildAnchors(mutant).pruneAfterBuild).toBe(false);
      // 원본 불변.
      expect(pruneAfterBuild(source)).toBe(true);
    });

    it("negative (e) — USER node 라인 제거 mutant → root 실행(보안 회귀) 검출", () => {
      const source = readFileSync(DOCKERFILE_PATH, "utf8");
      expect(hasUserNode(source)).toBe(true);
      const mutant = source.replace(/\nUSER node\n/, "\n");
      expect(hasUserNode(mutant)).toBe(false);
      expect(extractDockerfileBuildAnchors(mutant).userNode).toBe(false);
      // 원본 불변.
      expect(hasUserNode(source)).toBe(true);
    });

    it("negative (f) — ENTRYPOINT 를 node dist/src/main(entrypoint 우회)로 바꾼 mutant → migration-before-boot 우회 검출", () => {
      const source = readFileSync(DOCKERFILE_PATH, "utf8");
      expect(entrypointWiredToScript(source)).toBe(true);
      const mutant = source.replace(
        `ENTRYPOINT ["${ENTRYPOINT_SCRIPT}"]`,
        'ENTRYPOINT ["node", "dist/src/main"]',
      );
      expect(entrypointWiredToScript(mutant)).toBe(false);
      expect(entrypointArgv(mutant)).toEqual(["node", "dist/src/main"]);
      // 원본 불변.
      expect(entrypointWiredToScript(source)).toBe(true);
    });

    it("negative (g) — COPY --from=builder 의 builder 를 존재하지 않는 stage(build)로 바꾼 mutant → stage 이름 불일치(build 실패) 검출", () => {
      const source = readFileSync(DOCKERFILE_PATH, "utf8");
      expect(stageNamesConsistent(source)).toBe(true);
      const mutant = source.replace(/--from=builder/g, "--from=build");
      expect(stageNamesConsistent(mutant)).toBe(false);
      // 참조 이름은 build 로 바뀌었으나 선언된 stage 는 여전히 builder/runtime.
      expect(referencedFromStages(mutant)).toContain("build");
      expect(declaredStageNames(mutant)).toContain(BUILDER_STAGE);
      expect(declaredStageNames(mutant)).not.toContain("build");
      // 원본 불변.
      expect(stageNamesConsistent(source)).toBe(true);
    });

    it("negative — §9 credential/secret 누출 0: 추출/합성 토큰에 gh 토큰 어휘·credential 실값·실 endpoint 미등장(§9/REQ-059)", () => {
      const source = readFileSync(DOCKERFILE_PATH, "utf8");
      const anchors = extractDockerfileBuildAnchors(source);
      // 추출 토큰 — 빌드 지시 키·베이스 이미지 tag·pnpm 명령·stage 이름·경로만.
      const synthesized = [
        JSON.stringify(anchors),
        JSON.stringify(stageDeclarations(source)),
        JSON.stringify(declaredStageNames(source)),
        JSON.stringify(referencedFromStages(source)),
        JSON.stringify(builderCopyLines(source)),
        JSON.stringify(entrypointArgv(source)),
        String(stageImage(source, BUILDER_STAGE)),
        String(stageImage(source, RUNTIME_STAGE)),
      ];
      // 강한 패턴(password/secret 포함) — 추출 토큰은 빌드 지시 값만이라 전부 clean.
      const strongPattern =
        /(ghp_|--token|GITHUB_TOKEN|GH_TOKEN|\bBearer\b|Authorization|\bsk-|password|passwd|secret)/i;
      synthesized.forEach((s) => {
        expect(strongPattern.test(s)).toBe(false);
      });
      // 실 Dockerfile 소스에도 실 토큰(ghp_)·실 endpoint(IP URL)·Bearer 자격 미등장.
      const leakPattern = /(ghp_|GH_TOKEN=|\bBearer\b|Authorization:)/;
      expect(leakPattern.test(source)).toBe(false);
      expect(source).not.toMatch(/https?:\/\/\d+\.\d+\.\d+\.\d+/);
      // DATABASE_URL 실값(user:pass@host)도 Dockerfile 에 미등장 — 빌드 명세일 뿐.
      expect(source).not.toMatch(/postgres(ql)?:\/\/[^@\s]+:[^@\s]+@/);
    });
  });

  describe("flow: 결정론 · no-mutation(원본 read-only 입증)", () => {
    it("동일 입력으로 pure 함수를 두 번 호출하면 deep-equal(결정론)", () => {
      const source = readFileSync(DOCKERFILE_PATH, "utf8");
      expect(extractDockerfileBuildAnchors(source)).toEqual(
        extractDockerfileBuildAnchors(source),
      );
      expect(stageDeclarations(source)).toEqual(stageDeclarations(source));
      expect(builderCopyLines(source)).toEqual(builderCopyLines(source));
    });

    it("합성 mutate(사본 replace) 후에도 원본 소스 텍스트·pure 함수 산출이 불변(원본 read-only)", () => {
      const source = readFileSync(DOCKERFILE_PATH, "utf8");
      const snapshot = source;
      // 사본 mutate(negative a/b/f/g 에서 쓰는 replace) — 원본 불변 확인.
      source.replace(
        `FROM ${BASE_IMAGE} AS ${RUNTIME_STAGE}`,
        `FROM node:latest AS ${RUNTIME_STAGE}`,
      );
      source.replace("pnpm install --frozen-lockfile", "pnpm install");
      source.replace(/--from=builder/g, "--from=build");
      source.replace(/\nUSER node\n/, "\n");
      expect(source).toBe(snapshot);
      // 추출/파싱 후에도 원본 불변.
      extractDockerfileBuildAnchors(source);
      expect(source).toBe(snapshot);
    });
  });

  describe("dormant / non-gated 확인 — side-effect 0", () => {
    it("빌드 해석 모델이 env / 전역 상태 없이 순수하게 동작(non-gated — describe.skip 0·gating 분기 0)", () => {
      // 본 describe 가 실행된다는 것 자체가 describe.skip 0(항상 실행)의 런타임 증거.
      const envSnapshot = { ...process.env };
      const source = readFileSync(DOCKERFILE_PATH, "utf8");
      const before = layerCacheOrderIntact(source);
      // 실 process.env 를 mutate 해도 산출 불변 — 모델이 process.env 를 참조하지 않음(파라미터로만).
      Object.assign(process.env, { DOCKERFILE_UNIT_TEST: "x" });
      const after = layerCacheOrderIntact(source);
      delete process.env.DOCKERFILE_UNIT_TEST;
      expect(after).toBe(before);
      expect(Object.keys(process.env)).toEqual(Object.keys(envSnapshot));
    });

    it("파일 read 는 Dockerfile 읽기만 — 실 docker build/실 이미지 빌드/실 pnpm install/실 컨테이너 실행 0. Dockerfile 은 조건 분기 없는 선언적 빌드 명세 — 런타임 분기 없음(선언적 빌드)이라 happy/negative mutant 로 대체 cover", () => {
      const source = readFileSync(DOCKERFILE_PATH, "utf8");
      expect(hasStage(source, BUILDER_STAGE, BASE_IMAGE)).toBe(true);
      expect(hasStage(source, RUNTIME_STAGE, BASE_IMAGE)).toBe(true);
      expect(layerCacheOrderIntact(source)).toBe(true);
      expect(pruneAfterBuild(source)).toBe(true);
      expect(hasUserNode(source)).toBe(true);
      expect(entrypointWiredToScript(source)).toBe(true);
    });
  });
});
