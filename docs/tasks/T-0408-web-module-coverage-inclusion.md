---
id: T-0408
title: T-0355 잔여(m2) — src/web/web.module.ts 를 coverage 측정에 포함 (다른 *.module.ts 는 ignore 유지)
phase: P6
status: PENDING
commitMode: pr
coversReq: [REQ-038, REQ-048]
estimatedDiff: 40
estimatedFiles: 2
created: 2026-06-15
independentStream: p6-frontend-scaffold
dependsOn: []
touchesFiles:
  - package.json
  - src/web/web.module.spec.ts
plannerNote: "T-0355 잔여 2건 중 (a) — coveragePathIgnorePatterns 조정으로 web.module.ts 분기 helper 를 threshold enforcement 안으로. dependency-free, ci.yml 미변경(workflow scope 불요). single-helper config × 1.0 ≈ 40 LOC."
---

# T-0408 — src/web/web.module.ts 를 coverage 측정에 포함 (T-0355 m2 잔여)

## Why

T-0355 (P6 frontend scaffold slice 3) 의 잔여 AC 중 m2 항목이다. `src/web/web.module.ts` 의 `resolveServeStaticOptions` 는 dist 존재/부재·index.html 부재·빈 입력·비정상 경로 등 **실제 분기 helper 로직**을 담고 있어 R-112 의 coverage threshold enforcement 대상이 되어야 한다. 하지만 현재 `package.json` 의 `jest.coveragePathIgnorePatterns` 에 `"\\.module\\.ts$"` 가 있어 모든 `*.module.ts` 가 coverage 측정에서 제외된다 — 그래서 `web.module.spec.ts` 가 이미 그 분기를 충실히 cover (happy/error/branch/negative·type-mismatch) 함에도 coverage 리포트에는 반영되지 않는다. 본 task 는 ignore 패턴을 조정해 `src/web/web.module.ts` 만 coverage 측정에 포함하고 나머지 10개의 trivial 한 decorator-only `*.module.ts` 는 ignore 를 유지한다. (REQ-038 SPA 전달 경로 + REQ-048 same-origin 의 serve-static 분기 신뢰도 확보.)

## Driver 주의사항

- **ci.yml 미변경** — 본 task 는 `package.json` 의 jest 설정과 colocated spec 만 건드린다. token 의 `workflow` scope 불요. T-0407 과 동일하게 일반 pr-mode feature branch (`claude/T-0408-web-module-coverage`) → PR → reviewer → integrator 4-게이트.
- 현 global threshold 는 `branches: 90, functions: 80, lines: 80, statements: 90` (package.json `coverageThreshold.global`). `web.module.ts` 를 포함시킨 뒤 `pnpm test:cov` 가 전체 threshold 를 여전히 통과해야 한다 — 미달 시 `web.module.spec.ts` 에 분기 test 를 보강한다.

## Required Reading

- `docs/tasks/T-0355-p6-ci-web-steps-policy-doc-sync.md` — m2 AC 의 원 의도 (rescopeNote + AC L56) + Out of Scope (vitest coverage threshold 실 도입은 본 task 비대상)
- `package.json` — `jest.collectCoverageFrom` (`src/**/*.(t|j)s`) + `jest.coveragePathIgnorePatterns` (현재 `/node_modules/`, `src/main.ts`, `\.module\.ts$`) + `coverageThreshold.global` (branches 90 / functions 80 / lines 80 / statements 90)
- `src/web/web.module.ts` — `resolveServeStaticOptions` 분기 helper (dist 존재/index.html 부재/빈 입력/비정상 경로) + `WEB_DIST_PATH` / `API_EXCLUDE_PATTERN` + `WebModule` 데코레이터
- `src/web/web.module.spec.ts` — 기존 R-112 cover 현황 (resolveServeStaticOptions happy/error/branch/negative 6 case + WebModule compile + WEB_DIST_PATH anchor). 신규 분기 test 보강 시 이 colocated 파일에 추가 (helper fallback 불요 — 단일 spec)

## Acceptance Criteria

- [ ] `package.json` 의 `jest.coveragePathIgnorePatterns` 를 조정해 **`src/web/web.module.ts` 가 coverage 측정에 포함**되도록 한다. 다른 10개 `*.module.ts` (auth/user/github/llm/confluence/persistence/permission-denied/user-instance-access/assessment-collection/assessment-evaluation) 는 ignore 를 유지한다. 권장 방식: `"\\.module\\.ts$"` 를 `web/web.module.ts` 만 제외하는 패턴 (예: 음수 lookahead `\.module\.ts$` 를 web 만 빼는 정규식, 또는 `src/web/web.module.ts` 를 명시 포함하도록 collectCoverageFrom/ignorePatterns 조합 조정). 어떤 방식이든 `pnpm test:cov --collectCoverageFrom` 리포트에 `src/web/web.module.ts` 행이 나타나고 다른 module.ts 는 나타나지 않음을 확인.
- [ ] `pnpm test:cov` 통과 — 전체 global threshold (branches ≥ 90 / functions ≥ 80 / lines ≥ 80 / statements ≥ 90) 를 만족한다. `web.module.ts` 포함 후 미달 분기가 있으면 `src/web/web.module.spec.ts` 에 해당 분기 test 를 보강한다.
- [ ] **happy-path 검증 (R-112 항목 1)** — `resolveServeStaticOptions` 의 정상 등록 분기 (dist + index.html 존재 → 옵션 1개) test 가 coverage 에 반영됨 (기존 spec L31-43 green 유지).
- [ ] **error/negative cases 충분 cover (R-112 항목 2·4)** — 존재하지 않는 경로 / index.html 부재 / 빈 문자열 / 비정상 경로(NUL·일반 파일) / undefined(type mismatch) 분기가 각 1+ test 로 cover 됨 (기존 spec L47-90 green 유지). coverage 포함 후 누락 분기가 드러나면 보강한다.
- [ ] **flow / branch cover (R-112 항목 3)** — `resolveServeStaticOptions` 의 모든 조건 분기 (`!distPath` early return / `!existsSync(index.html)` early return / 정상 등록) 가 각각 cover 되어 branches threshold ≥ 90% 를 만족한다.
- [ ] R-110: production code 변경이 사실상 0 (설정·spec 만) 이어도 tester 가 root `pnpm lint && pnpm build && pnpm test:cov` + `pnpm test:smoke` + `pnpm test:e2e` 실행·green 확인.
- [ ] R-114: push 후 PR CI 전 step green 확인 — approval-gate ordering fail 은 benignRedNote case A 절차(rerun)로 처리.

## Out of Scope

- `scripts/check-spec-presence.test.sh` 의 web self-test 케이스 추가 (T-0355 잔여 (b)) — 별도 task. 본 task 는 coverage 포함 (m2) 만.
- `src/web/web.module.ts` production code 변경 — dist 부재 시 boot log 추가 (m3 silent degradation 검토) 는 본 task 미포함, 별도 task.
- vitest coverage threshold 실 도입 (`@vitest/coverage-v8` 새 dev dep — ADR-0040 §5 BLOCKED 게이트). 본 task 는 jest(backend) coverage 만.
- 다른 10개 `*.module.ts` 를 coverage 에 포함시키는 것 — 그들은 decorator-only 라 측정 의미가 적고 threshold 를 흔들 risk 가 있으므로 ignore 유지.
- ci.yml / web 워크스페이스 / package.json 의 jest 외 영역 변경.
- docs/architecture/directory.md 동기 (T-0355 잔여 doc 항목) — 별도 doc-only direct task.

## Suggested Sub-agents

`implementer → tester` (architect 불요 — m2 의도가 T-0355 + ADR-0040 §3 에서 확정. jest 설정 정규식 1줄 조정 + 필요 시 분기 test 보강의 소형 task)

## Follow-ups

- (planner 선제) T-0355 잔여 (b): `scripts/check-spec-presence.test.sh` 에 web 정책 self-test 케이스 (web `.ts` + colocated `.test.ts` → pass / web `.ts` 단독 → fail / web `*.d.ts` 단독 → pass). 단 현 `check-spec-presence.sh` 의 pathspec 이 `'*.ts'` (`.tsx` 미매칭) 이고 `*.d.ts` 제외가 미구현이라, self-test 추가 전 main script 의 `.tsx`/`*.d.ts` 처리 확장 필요 여부 점검 — 별도 task.
- (planner 선제) T-0355 잔여 doc: `docs/architecture/directory.md` §"Frontend (web/) 의 위치" 실 구현 동기 (hybrid 구조 + WEB_DIST_PATH cwd 가정 + web coverage 보류 정책) — direct doc-only task.
