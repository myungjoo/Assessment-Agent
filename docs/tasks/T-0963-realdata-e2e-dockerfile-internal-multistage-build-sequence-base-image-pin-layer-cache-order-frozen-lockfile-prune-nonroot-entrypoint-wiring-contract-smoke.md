---
id: T-0963
title: Dockerfile 내부 멀티스테이지 빌드 시퀀스 계약(2-stage builder/runtime 분리 + node:20-bookworm-slim 베이스 pin ×2 + dep-meta-COPY→frozen-lockfile install→소스-COPY→build 레이어캐시 순서 + backend→web build 순서 + prune --prod devDep 제거 + COPY --from=builder --chown=node:node 선별 복사 + USER node 비루트 + ENV NODE_ENV=production + chmod+x→USER 순서 + ENTRYPOINT docker-entrypoint 배선) 정적 smoke
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-061, REQ-062]
estimatedDiff: 460
estimatedFiles: 1
sizeExempt: true
exemptReason: "test-only 단일 smoke-spec 1파일. sibling T-0962(docker-compose 내부 오케스트레이션, 420 LOC)·T-0961(systemd unit 내부 directive, 642 LOC)·T-0960(docker-entrypoint 내부 부팅, 521 LOC)·T-0959(seed-llm-config env-gating, 628 LOC) 동형. R-112 4종 cover 위한 다수 assert(2-stage 분리·베이스 pin ×2·레이어캐시 순서·frozen-lockfile·build 순서·prune·선별 COPY·USER node·NODE_ENV·chmod→USER 순서·ENTRYPOINT 배선·negative mutant a~g 7종) 불가피로 300 LOC 초과 예상이나 accepted sibling 패턴 그대로 — production 0 LOC·Dockerfile 미변경."
independentStream: realdata-e2e-dockerfile-internal-multistage-build-sequence-contract
dependsOn: []
touchesFiles: [test/smoke/realdata-e2e-dockerfile-internal-multistage-build-sequence-base-image-pin-layer-cache-order-frozen-lockfile-prune-nonroot-entrypoint-wiring-contract.smoke-spec.ts]
created: 2026-07-14
plannerNote: "P5 §109 재배포 runner chain 의 빌드 leg — Dockerfile 내부 멀티스테이지 빌드 시퀀스 미봉. 기존 T-0795 parity(EXPOSE 값·ENTRYPOINT 존재)·T-0797(prisma dep prune 생존)는 상보 outer surface만 봉함(2-stage 분리·베이스 pin·레이어캐시 순서·frozen-lockfile·USER node·선별 COPY 미봉, grep NONE). compose/entrypoint/systemd parity→internal split(T-0960/T-0961/T-0962)과 동형."
---

# T-0963 — Dockerfile 내부 멀티스테이지 빌드 시퀀스 계약(2-stage builder/runtime 분리 + node:20-bookworm-slim 베이스 pin ×2 + dep-meta-COPY→frozen-lockfile install→소스-COPY→build 레이어캐시 순서 + backend→web build 순서 + prune --prod + COPY --from=builder --chown=node:node 선별 복사 + USER node 비루트 + ENV NODE_ENV=production + chmod+x→USER 순서 + ENTRYPOINT docker-entrypoint 배선) 정적 smoke

## Why

무인 nightly 재배포 runner 의 계약 표면을 봉해온 chain(daily-test.sh: T-0944~T-0957, redeploy.sh 내부 시퀀스: T-0958, seed-llm-config.sh env-gating: T-0959, docker-entrypoint.sh 내부 부팅: T-0960, systemd unit 내부 directive: T-0961, docker-compose.yml 내부 오케스트레이션: T-0962)에서, 그 재배포가 실제로 **기동시키는 스택의 이미지를 생산하는** `Dockerfile` 의 **내부 멀티스테이지 빌드 시퀀스 계약**은 아직 미봉이다. `docker-compose.yml`(T-0962 봉함)의 `app.build` 가 참조하는 build 대상이 이 Dockerfile 이고, 이 Dockerfile 이 생산하는 이미지의 `ENTRYPOINT` 가 곧 `docker-entrypoint.sh`(T-0960 봉함)이므로, Dockerfile 의 내부 빌드 semantic 이 재배포 runner chain 의 **빌드 leg** 다. 기존 Dockerfile smoke 는 상보적 다른 표면만 봉했다 — `realdata-e2e-docker-compose-orchestration-contract-artifact-parity-drift.smoke-spec.ts`(T-0795)는 Dockerfile 의 `EXPOSE N` **포트 값** parity(compose `${PORT:-3000}` 4중 byte-identity)와 `ENTRYPOINT [...]` **행 존재** 여부만 봉했고, `realdata-e2e-docker-entrypoint-runtime-contract-build-artifact-parity-drift.smoke-spec.ts`(T-0797)는 `package.json` 의 prisma **dependency 배치**가 `pnpm prune --prod` 후 생존하는지(prod 컨테이너 migrate 가능성)만 봉했다. 그러나 Dockerfile 자신의 **내부 빌드 시퀀스 semantic 계약**(정확히 2개 named stage `builder`/`runtime` 분리·두 stage 모두 `node:20-bookworm-slim` 베이스 pin·의존성 메타 먼저 COPY→`pnpm install --frozen-lockfile`→`COPY . .`→`pnpm build` 로 이어지는 레이어-캐시 최적 순서·`pnpm build`(backend)→`pnpm --filter web build`(web) 순서·`pnpm prune --prod` 로 devDependency 제거·runtime stage 의 `COPY --from=builder --chown=node:node` 선별 산출물 복사·`USER node` 비루트 실행·`ENV NODE_ENV=production`·`chmod +x` 후 `USER node` 전환 순서·`ENTRYPOINT ["./deploy/docker-entrypoint.sh"]` 배선)은 어느 smoke 도 assert 하지 않았다(origin/main grep 확인 — `AS builder`/`--from=builder`/`USER node`/`--frozen-lockfile`/multi-stage 토큰에 `expect` NONE, 두 parity smoke 는 EXPOSE 값·ENTRYPOINT 존재·prisma dep 배치만). 이 관계는 docker-entrypoint.sh 가 parity(T-0797) 봉함 뒤에도 T-0960(내부 부팅 시퀀스)이, systemd unit 이 parity 뒤에도 T-0961(내부 directive)이, docker-compose.yml 이 parity(T-0795) 뒤에도 T-0962(내부 오케스트레이션)가 별도로 필요했던 것과 정확히 동형이다. 이 내부 빌드 시퀀스가 변질되면 — 2-stage 분리 붕괴(runtime 에 build toolchain 잔존) 시 이미지 비대·보안 표면 확대 / 베이스 이미지 tag 이탈 시 런타임 non-determinism / dep-meta-먼저-COPY 순서 소실 시 소스 변경마다 install layer 무효화(빌드 시간 폭증) / `--frozen-lockfile` 소실 시 lockfile-drift 로 CI 와 이미지 의존성 불일치 / `pnpm prune --prod` 소실 시 devDependency 가 런타임 이미지에 잔존(비대) / `COPY --from=builder` 대신 전체 복사 시 slim 이미지 목적 붕괴 / `USER node` 소실 시 root 실행(보안 회귀) / `ENTRYPOINT` 배선 이탈 시 컨테이너가 docker-entrypoint.sh(migration-before-boot) 를 부팅 안 함 — 무인 배포 이미지가 조용히 비대/비결정/보안회귀/미기동으로 진행된다. 본 task 는 그 빌드 leg 의 내부 멀티스테이지 시퀀스를 정적 앵커로 봉해 재배포 runner chain 을 완결에 한 걸음 더 붙인다(PLAN.md 109행 재배포 runner chain).

## Required Reading

- `Dockerfile` 전체(74행 — builder stage: `FROM node:20-bookworm-slim AS builder`(11행)·apt python3/make/g++(14~16행)·`corepack enable`(19행)·`WORKDIR /app`(21행)·dep-meta COPY(24~26행: package.json/pnpm-lock.yaml/pnpm-workspace.yaml/prisma.config.ts + prisma + web/package.json)·`pnpm install --frozen-lockfile`(30행)·`COPY . .`(33행)·`pnpm build && pnpm --filter web build`(36~37행)·`pnpm prune --prod`(41행) / runtime stage: `FROM node:20-bookworm-slim AS runtime`(46행)·apt openssl/ca-certificates(50~52행)·`ENV NODE_ENV=production`(54행)·`WORKDIR /app`(55행)·`COPY --from=builder --chown=node:node` ×6(58~63행: node_modules/dist/web/dist/prisma/package.json/prisma.config.ts)·`COPY --chown=node:node deploy/docker-entrypoint.sh`(64행)·`RUN chmod +x`(66행)·`USER node`(69행)·`EXPOSE 3000`(70행)·`ENTRYPOINT ["./deploy/docker-entrypoint.sh"]`(73행)).
- `test/smoke/realdata-e2e-docker-compose-orchestration-contract-artifact-parity-drift.smoke-spec.ts` — 기존 Dockerfile 관련 parity smoke(T-0795: `extractDockerfileExpose` EXPOSE **값** parity·`extractDockerfileEntrypoint` ENTRYPOINT **행 존재**). 본 task 는 그와 상보(Dockerfile 내부 빌드 시퀀스 semantic vs outer 값 parity) — 재구현/변경 0, 중복 assert 금지. 특히 이 smoke 가 이미 잡는 `EXPOSE` 포트 **값**·`ENTRYPOINT` 행 **단순 존재**는 본 task 에서 재검증하지 않는다.
- `test/smoke/realdata-e2e-docker-entrypoint-runtime-contract-build-artifact-parity-drift.smoke-spec.ts` — 기존 T-0797 parity(package.json prisma dependency 배치가 `pnpm prune --prod` 후 생존). 본 task 는 그와 상보 — prisma dep **배치** 재검증 0, 본 task 는 Dockerfile 에 `pnpm prune --prod` 라인이 **존재하고 build 이후에 위치**하는 시퀀스만.
- `test/smoke/realdata-e2e-docker-compose-internal-orchestration-depends-on-service-healthy-restart-unless-stopped-healthcheck-bounded-polling-named-volume-env-file-single-source-contract.smoke-spec.ts` — 형제 T-0962 내부 오케스트레이션 smoke 패턴(readFileSync 정적 추출·repo-root `__dirname` 해석·선언적 파일 토큰 존재/값/순서 assert·합성 mutant drift-detection·원본 read-only·§9 credential 누출 0 구조). 본 task 는 동일 패턴을 Dockerfile 에 적용 — 재구현이 아니라 패턴 참조.

## Acceptance Criteria

- [ ] `test/smoke/realdata-e2e-dockerfile-internal-multistage-build-sequence-base-image-pin-layer-cache-order-frozen-lockfile-prune-nonroot-entrypoint-wiring-contract.smoke-spec.ts` 신설. `Dockerfile` 을 `readFileSync` 로 읽어 내부 빌드 시퀀스 토큰을 정적 추출한다(실 `docker build`/실 이미지 빌드/실 pnpm install/실 컨테이너 0). repo-root 경로는 `__dirname` 기준으로 cwd-robust 하게 해석(sibling T-0962 패턴). `process.env` 읽기 0 — fixture 는 정적 파일 텍스트만. 실 YAML/Dockerfile 파서 라이브러리 도입 0 — node 내장 `fs`/`path` + 정규식/행 슬라이스만.
- [ ] **Happy-path**: Dockerfile 내부 빌드 시퀀스 계약 불변식 각각에 대해 성공 assert 1+ —
  - 정확히 2개 named build stage 존재: `FROM ... AS builder` AND `FROM ... AS runtime`(builder/runtime 분리 — build toolchain 을 런타임 이미지에서 격리),
  - 두 stage 모두 동일 pinned 베이스 이미지 `node:20-bookworm-slim`(major/variant tag 고정 — 런타임 결정성),
  - builder stage 의 레이어-캐시 순서: 의존성 메타 COPY(package.json 등) → `pnpm install --frozen-lockfile` → `COPY . .`(전체 소스) → `pnpm build` 가 **소스 정의 순서상 이 상대 순서**로 등장(install-before-full-source-copy — 소스 변경이 install layer 를 무효화하지 않도록),
  - `pnpm install --frozen-lockfile` 존재(lockfile 정확 일치 강제 — deterministic install, CI parity),
  - `pnpm build`(backend) 가 `pnpm --filter web build`(web) 보다 먼저 또는 같은 RUN 에서 둘 다 등장(backend+web 이중 빌드),
  - `pnpm prune --prod` 존재하고 소스상 `pnpm build` 이후 위치(devDependency 제거로 slim 런타임),
  - runtime stage 의 `COPY --from=builder`(선별 산출물 복사 — builder 로부터만 선별 이관)가 1+ 존재하고 그중 핵심 산출물(`node_modules`/`dist`/`web/dist`/`prisma`) 각각 복사됨,
  - `COPY --from=builder ... --chown=node:node`(또는 `COPY --chown=node:node`)로 소유권을 node uid 로 지정(비루트 소유),
  - `USER node`(비루트 실행) 존재,
  - `ENV NODE_ENV=production`(runtime stage) 존재,
  - `ENTRYPOINT ["./deploy/docker-entrypoint.sh"]` 존재(T-0960 봉함 entrypoint 로 배선 — 컨테이너 부팅 시 migration-before-boot 진입).
- [ ] **chmod→USER 순서 계약**: `RUN chmod +x ./deploy/docker-entrypoint.sh` 가 소스상 `USER node` **이전**에 위치함을 단언하는 assert 1+ (USER 전환 후에는 root-only chmod 권한이 없을 수 있어 실행권 부여가 root 단계에서 선행돼야 함 — 순서 역전 검출).
- [ ] **stage 소유 계약(build↔runtime 격리)**: runtime stage 의 `COPY --from=builder` 참조 stage 이름(`builder`)이 실제 선언된 `AS builder` stage 이름과 동일함을 단언하는 assert 1+ (존재하지 않는 stage 를 `--from` 참조하면 build 실패 — 이름 정합 검출).
- [ ] **Error/negative path 충분 cover** — 예외 상황 분기마다 mutant 합성 소스로 not-match/실패 단언 각 1+ (최소 a~g 7종):
  - (a) runtime stage 의 `FROM node:20-bookworm-slim AS runtime` 을 `FROM node:latest AS runtime` 로 바꾼 mutant → 베이스 이미지 pin 이탈(비결정) 검출,
  - (b) `pnpm install --frozen-lockfile` 에서 `--frozen-lockfile` 을 제거한 mutant → lockfile-drift 허용 검출,
  - (c) dep-meta COPY 를 `COPY . .` 뒤로 옮긴(레이어-캐시 순서 역전) mutant → install-before-source 순서 소실 검출,
  - (d) `pnpm prune --prod` 라인을 제거한 mutant → devDependency 런타임 잔존(이미지 비대) 검출,
  - (e) `USER node` 라인을 제거한 mutant → root 실행(보안 회귀) 검출,
  - (f) `ENTRYPOINT ["./deploy/docker-entrypoint.sh"]` 를 `ENTRYPOINT ["node", "dist/src/main"]`(entrypoint 우회) 로 바꾼 mutant → migration-before-boot 우회 검출,
  - (g) runtime `COPY --from=builder` 의 `builder` 를 존재하지 않는 stage 이름(`build`)으로 바꾼 mutant → stage 이름 불일치(build 실패) 검출.
- [ ] **원본 read-only 입증**: 합성 mutate 후에도 원본 Dockerfile 추출 결과가 불변(원본 텍스트 미변조)임을 단언하는 test 1+.
- [ ] **§9 secret-safety**: 추출/합성하는 어떤 토큰에도 실 secret/password/토큰/실 DATABASE_URL/실 endpoint 가 등장하지 않음(빌드 지시 키·베이스 이미지 tag·pnpm 명령·stage 이름·`USER node`·경로만)을 단언하는 test 1+. `process.env` 읽기 0.
- [ ] **Flow/branch cover**: 베이스 pin 있음/이탈 mutant 분기·frozen-lockfile 있음/없음 분기·레이어-캐시 순서 정상/역전 분기·prune 있음/없음 분기·USER node 있음/없음 분기·ENTRYPOINT 정상/우회 분기·stage 이름 일치/불일치 분기를 각 test 로 분리. Dockerfile 은 조건 분기 없는 선언적 빌드 명세 — "런타임 분기 없음(선언적 빌드) — happy/negative mutant 로 대체 cover" 명시.
- [ ] non-gated 항상 실행(describe.skip / gating 분기 0), 실 `docker build`/실 이미지 빌드/실 pnpm install/실 컨테이너 0, `Dockerfile` 변경 0(readFileSync 읽기만).
- [ ] `pnpm lint && pnpm build` green.
- [ ] `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%). 본 spec 은 production 0 LOC 라 coverageThreshold 무회귀 — 기존 임계 유지 확인.

## Out of Scope

- `Dockerfile` 수정 금지(drift 실제 발견 시 별도 fix task — 본 task 는 검증 smoke 신설만).
- 기존 `realdata-e2e-docker-compose-orchestration-contract-artifact-parity-drift.smoke-spec.ts`(T-0795: EXPOSE 포트 **값** parity·ENTRYPOINT 행 **단순 존재**) 재구현/변경 0 — outer 값 parity vs 본 task 의 Dockerfile 내부 빌드 시퀀스 semantic 은 distinct 상보 표면. 본 task 는 `EXPOSE` 포트 값·`${PORT:-3000}` 4중 byte-identity 를 재검증하지 않는다(중복 금지). ENTRYPOINT 는 본 task 에서 **배선 대상 경로(`./deploy/docker-entrypoint.sh`) 정합** 관점으로만 assert — 단순 "행 존재"(T-0795) 와 구분.
- 기존 `realdata-e2e-docker-entrypoint-runtime-contract-build-artifact-parity-drift.smoke-spec.ts`(T-0797: package.json prisma dependency **배치** 가 prune --prod 후 생존) 재구현/변경 0 — prisma dep 배치 재검증 0. 본 task 는 Dockerfile 에 `pnpm prune --prod` 라인이 **존재·build 이후 위치**하는 시퀀스만.
- T-0958(redeploy.sh 내부 시퀀스)·T-0960(docker-entrypoint.sh 내부 부팅)·T-0961(systemd unit 내부 directive)·T-0962(docker-compose.yml 내부 오케스트레이션) smoke 재구현/변경 0 — script/unit/compose 내부 계약 vs 본 task 의 Dockerfile 내부 빌드 시퀀스는 distinct.
- 실 `docker build`/BuildKit/레이어 캐시 실측 도입 0 — 정적 텍스트 앵커만(선언적 빌드 명세의 토큰 존재·상대 순서·이름 정합).

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(없음)
