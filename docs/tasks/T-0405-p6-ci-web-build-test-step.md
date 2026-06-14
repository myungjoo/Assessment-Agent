---
id: T-0405
title: P6 ci.yml web build + vitest test step 배선 (R-111/R-113, T-0355 CI slice)
phase: P6
status: DONE
completedAt: 2026-06-14T14:13Z
commitMode: pr
coversReq: [REQ-038, REQ-048]
estimatedDiff: 15
estimatedFiles: 1
dependsOn: []
touchesFiles:
  - .github/workflows/ci.yml
independentStream: p6-frontend-scaffold
created: 2026-06-14
plannerNote: "T-0355(scaffold slice 3, 6파일 sizeExempt)의 핵심 CI-wiring AC 만 분리한 focused slice. driver(loop@vb707106)가 T-0355 staleness 확인 후 split — check-spec-presence.sh 의 .test.ts 처리는 T-0380 에서 이미 반영, web/ workspace(pnpm-workspace.yaml)·web/package.json(build/test script) 완비. 나머지 T-0355 AC(smoke web-static spec / web.module.ts coverage 포함 / check-spec-presence.test.sh web self-test / directory.md 동기)는 T-0355 잔여로 유지. workflow-scope 게이트는 사용자 재인증(gh auth refresh -s workflow)으로 해소."
hqOrigin: null
---

# T-0405 — P6 ci.yml web build + vitest test step 배선

## Why

P6 프론트엔드(web/ Vite React SPA)의 vitest 스위트(로컬 검증 기준 476 test / 23 파일, T-0362~T-0393 누적)가 **로컬에서만 실행되고 CI 에 미배선**이다. CLAUDE.md §3.2 R-111(모든 test 는 CI 에서 자동 실행)·R-113(unit 외 통합 검증) 정합을 위해 ci.yml 에 web build + web test step 을 추가한다. T-0353 reviewer MINOR("web vitest CI 미실행 transient gap", "지체 없이 진행" 명시)의 해소이며, T-0355(scaffold slice 3, 6파일 sizeExempt)의 핵심 CI-wiring AC 만 분리한 focused slice 다.

driver 가 T-0355 staleness 를 확인했다: check-spec-presence.sh 의 `.test.ts` 처리는 T-0380 에서 이미 반영됐고, web/ workspace(pnpm-workspace.yaml)·web/package.json(build/test script)·src/web/web.module.ts(AppModule 배선)가 모두 완비됐다. 로컬 검증 결과 web test 476 pass / web build(tsc --noEmit + vite build) green 으로, CI 배선 시 trivially green 예상.

## Required Reading

- `.github/workflows/ci.yml` — step 구조(checkout → spec-presence self-test 3종 → ref-CAS/select-claim/reclaim self-test → pnpm/Node 설치 → 의존성 설치 → Lint → Build → Prisma migrate → test:cov → smoke → e2e → reviewer approval), 한국어 주석 convention
- `web/package.json` — build(`tsc --noEmit -p tsconfig.json && vite build`) / test(`vitest run`) script
- `pnpm-workspace.yaml` — web workspace 등록(단일 lockfile, ADR-0040 §4)

## Acceptance Criteria

- [ ] ci.yml 에 **web build step**(`pnpm --filter web build`) 추가 — root "Build" step 직후, smoke step 이전 배치(향후 dist-존재 통합 검증의 전제). 한국어 주석(도입 근거 + T-0405) 동반. PR CI 에서 step green.
- [ ] ci.yml 에 **web unit test step**(`pnpm --filter web test`) 추가 — web build 직후. vitest run 이 CI 에서 자동 실행(R-111). 한국어 주석 동반. PR CI 에서 step green.
- [ ] R-110: production code 변경 0 이라도 tester 가 root `pnpm lint && pnpm build && pnpm test` + 신규 web build/test 를 로컬 green 확인.
- [ ] R-114: push 후 PR CI 전 step green 확인(신규 web step 2개 포함). approval-gate ordering fail 은 benignRedNote case A 절차(reviewer approve comment 후 `gh run rerun --failed`)로 처리.

## Out of Scope

- web-static smoke spec(NestFactory boot + dist-존재 통합 검증), src/web/web.module.ts coverage 포함(coveragePathIgnorePatterns 조정), check-spec-presence.test.sh web self-test 케이스, directory.md 실 구현 동기 — **T-0355 잔여**(별도 task 로 재개).
- ci.yml node-version 20→24 bump(Q-0034 (4) make-work 판정 유지 — 2026-06-16 deprecation 은 non-blocking 경고).
- web vitest coverage threshold 실 도입(`@vitest/coverage-v8` 새 dev dep §5 게이트).

## Suggested Sub-agents

`implementer`(ci.yml only) → `tester`(로컬 verify). architect 불요(ADR-0040 + T-0353~T-0355 가 결정 완료, 본 task 는 CI step 배선만).

## Result (DONE — 2026-06-14, loop@WIN-JQIPLSBL9QV-vb707106)

사용자가 `gh auth refresh -s workflow` 로 credential 게이트(workflow scope)를 해소한 뒤 로컬 `/loop`(workflow-scoped)가 resume 하여 완료.

- **구현**: `.github/workflows/ci.yml` 에 root "Build" step 직후 / "Prisma migrate deploy" 이전에 2 step 추가 — "Web 빌드"(`pnpm --filter web build`) + "Web 단위 test"(`pnpm --filter web test`). 한국어 주석 동반. +10/-0 LOC, 단일 파일.
- **검증**: 로컬 web test 476 pass / 23 파일, web build(tsc --noEmit + vite build) green. PR CI run 27501403767 = first-pass success — 신규 'Web 빌드'·'Web 단위 test' 2 step 모두 success 확인(vitest 가 CI 에서 실제 실행 = R-111/R-113 정합 실증).
- **머지**: PR #326 → reviewer APPROVE r1/7(finding 0) → 4-게이트 PASS → squash merge `4566f7c` --delete-branch.
- **동시성 사고 기록**: 로컬 시계 skew(~2.5h 뒤)로 cron@cloud 가 driver lock 을 stale 로 탈취 + 본 task 를 BLOCKED(credential) 로 오판했으나, merge 는 lock 무관하게 성공. 본 closeout 에서 status BLOCKED→DONE 정정 + STATE.blockers B-credential-2026-06-14T12:41Z close + tasksCompleted 396→397.

이전 cron 의 BLOCKED Status note(2026-06-14 aa-local-scheduled)는 본 완료로 supersede.
