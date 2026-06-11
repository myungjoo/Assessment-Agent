---
id: T-0351
title: ADR-0040 frontend stack 결정 (React+Vite vs 대안, NestJS 경계, web/ 구조)
phase: P6
status: PENDING
commitMode: pr
coversReq: [REQ-038, REQ-042, REQ-048]
estimatedDiff: 225
estimatedFiles: 2
independentStream: p6-frontend
dependsOn: []
touchesFiles:
  - docs/decisions/ADR-0040-frontend-stack.md
  - docs/architecture/INDEX.md
created: 2026-06-11
plannerNote: "P6 entry — Q-0035 옵션(4) 사용자 결정. CLAUDE §1 Frontend 행 'P6 진입 시 별도 ADR' 이행. doc-only ×1.6"
---

# T-0351 — ADR-0040 frontend stack 결정 (React+Vite vs 대안, NestJS 경계, web/ 구조)

## Why

Q-0035 RESOLVED — 사용자가 옵션 (4) **P6 frontend 진입** 을 선택했다 (나머지 옵션 보류). CLAUDE.md §1 기술 스택 표의 Frontend 행은 "별도 ADR로 결정 — 기본 후보: React + Vite, P6 진입 시" 를 명시하므로, P6 (PLAN.md "Phase P6 — Web UI": 로그인/SuperAdmin 셋업 · 시각화 대시보드 · Admin 패널 · R-78 평가 진행 중 시각화 보호) 의 어떤 UI 구현 task 보다 frontend stack ADR 이 선행해야 한다 ("코드보다 ADR이 먼저다"). README "평가 자료의 시각화와 UI" (REQ-038 sort/filter/시계열) + R-78 (REQ-042) + 조회·시각화 3초 이내 (REQ-048) 가 본 stack 결정의 요구 입력이다.

## Required Reading

- [CLAUDE.md](../../CLAUDE.md) §1 (기술 스택 표 Frontend 행) + §5 (새 외부 dependency = BLOCKED·승인 후 ADR — 본 ADR 이 그 승인 경로의 일부)
- [docs/PLAN.md](../PLAN.md) "Phase P6 — Web UI" 절 (4 bullet)
- [README.md](../../README.md) "평가 자료의 시각화와 UI" + "평가 실행 제약 사항" + "보안 특성" + "성능 특성" 절 (66~92행 부근)
- [docs/architecture/deployment.md](../architecture/deployment.md) — monolith 배포 구조 (frontend serve 통합 방식 결정의 전제)
- [docs/architecture/api.md](../architecture/api.md) — 기존 HTTP API contract (frontend 가 소비할 인터페이스, 목록 수준만)
- [docs/decisions/ADR-0001-stack.md](../decisions/ADR-0001-stack.md) — 기존 stack 결정 포맷 참조
- [docs/architecture/INDEX.md](../architecture/INDEX.md) — ADR 매핑 표 (row append 대상)

## Acceptance Criteria

- [ ] `docs/decisions/ADR-0040-frontend-stack.md` 신설 (status: **PROPOSED** — ACCEPTED flip 은 사용자/reviewer 합의 후 별도). 본문에 다음 결정 항목을 모두 포함:
  - [ ] **Frontend framework/build 선택**: React + Vite (기본 후보) vs 대안 1+ (예: Next.js, Vue+Vite, 순수 SPA 없음/server-rendered) 비교 + 채택 근거. REQ-038 (sort/filter/시계열 대시보드) + REQ-048 (조회·시각화 3초 이내) 충족 관점 포함.
  - [ ] **NestJS 와의 경계**: SPA ↔ 기존 REST API (`/api/*`) 소비 계약, 인증 흐름 연동 방식 (ADR-0008 JWT 전제), CORS/serve 경계.
  - [ ] **build/serve 통합 방식**: 개발 시 (Vite dev server + proxy) vs 운영 시 (NestJS static serve vs 별도 정적 호스팅) 결정 — deployment.md monolith 구조와 정합.
  - [ ] **`web/` 디렉토리 구조**: 최상위 layout (CLAUDE §6 파일 맵의 `web/` 위치 확정) + backend 와 lockfile/패키지 관리 방식 (pnpm workspace vs 독립 package.json) 결정.
  - [ ] **새 dependency 도입 절차 명시**: 본 ADR 은 결정 전용 0 LOC — **실 패키지 추가 (`pnpm create vite` / package.json 변경) 는 ADR ACCEPTED 후 별도 task** 로 박제 (CLAUDE §5 new-dep 게이트 + §9).
  - [ ] **R-78 (REQ-042) 시각화 보호** 의 frontend 측 책임 (평가 진행 중 배너 + 기존 자료만 표시) 이 stack 선택과 어떻게 연결되는지 1 단락.
- [ ] `docs/architecture/INDEX.md` ADR 매핑 표에 ADR-0040 row 1줄 append (영향 문서: deployment.md + directory.md, 상태 PROPOSED).
- [ ] production code 변경 0 — 분기 없음, R-112 4종 unit test 해당 없음 (본 항목으로 생략 명시). 단 R-110 에 따라 tester 가 `pnpm lint && pnpm build && pnpm test` 실행해 기존 suite green 확인 (`pnpm test:cov` line ≥ 80% / function ≥ 80% 기존 threshold 유지 확인 포함).
- [ ] ADR 본문·commit 한국어 (§12), feature branch `claude/T-0351-adr-0040-frontend-stack` → PR → reviewer → integrator 4-게이트.

## Out of Scope

- 실 패키지 추가 (`web/` scaffold, package.json/lockfile 변경, vite 설치) — ADR ACCEPTED 후 별도 task (§5 new-dep 게이트).
- `src/` 변경 (static serve wiring, CORS 설정 등) — 후속 impl chain.
- ADR-0040 PROPOSED → ACCEPTED flip — 사용자 검토 후 direct 한 줄 (§3.1 rule 4).
- PLAN.md P6 절 갱신 (ADR-first bullet 추가 등) — direct doc task 로 분리 (§3.1 rule 3), 아래 Follow-ups.
- 로그인 UI / 대시보드 / Admin 패널 등 실 화면 구현.

## Suggested Sub-agents

`architect → tester` (architect 가 ADR + INDEX row 작성, tester 가 R-110 suite green 확인. implementer 불요 — 코드 0 LOC)

## Follow-ups

- PLAN.md P6 절에 "frontend stack ADR-0040 선행" bullet + 추적 갱신 (direct).
- ADR-0040 ACCEPTED flip 후: web/ scaffold task (pnpm create vite, 새 dependency — §5 사용자 승인 게이트 명시) 분해.
