---
id: T-1840
title: ADR-0060 — 평가/수집 실행 상태 조회 endpoint 계약 결정 (R-78 polling 선행)
phase: P6
status: PENDING
commitMode: pr
coversReq: [REQ-083]
estimatedDiff: 290
estimatedFiles: 1
estimatedFilesNote: docs/decisions/ADR-0060-*.md 1 개만 — 코드 0 LOC
created: 2026-09-02
independentStream: r78-polling
dependsOn: []
touchesFiles: [docs/decisions/ADR-0060-evaluation-run-status-endpoint.md]
plannerNote: P6 PLAN 133 행 잔여 ④ R-78 polling 의 선행 gap — 실행 상태 endpoint 계약을 ADR 로 먼저 확정 (doc-only enumerated-section × 1.6)
---

# T-1840 — ADR-0060 평가/수집 실행 상태 조회 endpoint 계약 결정

## Why

[docs/PLAN.md](../PLAN.md) `133 행` bullet 의 잔여 두 조각 (① 전역 CSS · ④ R-78 polling) 중 ④ 를 여는 첫 slice 다. [docs/requirements.md](../requirements.md) `102 행` REQ-083 (평가 진행 중 경고 배너의 자동 갱신 + **실행 상태 조회 endpoint 신설**) 은 아직 `PLANNED` 이고, [docs/architecture/frontend-api-contract.md](../architecture/frontend-api-contract.md) `87 행` 표가 "전역 경고 배너 토글 ← 평가/수집 실행 상태 조회 endpoint — **gap (미존재)**" 로, [ADR-0041](../decisions/ADR-0041-frontend-composition-wiring.md) `88 행` 이 "R-78 polling 은 실행 상태 endpoint 의 backend 존재에 의존 — 부재 시 backend 선행 task 필요" 로 이미 이 선행 의존을 박제해 두었다.

문제는 backend 에 **실행 상태라는 자산 자체가 없다**는 것이다 — 평가 (`POST /api/assessment-evaluation/evaluate` · `period` · `unevaluated-fill-run`) 와 수집 (`POST /api/assessment-collection/collect`) 은 전부 동기 요청이고 `prisma/schema.prisma` 에는 실행 상태를 담는 model 이 없다 (`ExportJob` · `ImportJob` 만 job 형태). 따라서 "무엇을 실행 중으로 볼 것인가 · 그 상태를 어디에 둘 것인가" 는 대안이 실재하는 설계 결정이며, 그중 일부 (Prisma model 신설) 는 CLAUDE.md `§5` 의 DB schema 변경 게이트에 걸린다. 코드보다 ADR 이 먼저다 (CLAUDE.md `§1`) — [ADR-0059](../decisions/ADR-0059-collection-target-registration.md) → backend slice chain 선례와 같은 순서로, 본 task 는 **결정만 박제**하고 구현은 `§Follow-ups` 로 이월한다.

## Required Reading

- [docs/architecture/frontend-api-contract.md](../architecture/frontend-api-contract.md) — `81~110 행` (§3.4 R-78 배너 데이터 소스 + gap 1)
- [docs/decisions/ADR-0041-frontend-composition-wiring.md](../decisions/ADR-0041-frontend-composition-wiring.md) — `59~64 행`, `88 행`, `98 행` (R-78 배선 · 선행 의존 · ⑤ slice)
- [docs/decisions/ADR-0059-collection-target-registration.md](../decisions/ADR-0059-collection-target-registration.md) — frontmatter + `§Status` (ADR-only slice 의 형식·분량 선례)
- [web/src/components/EvaluationGuardBanner.tsx](../../web/src/components/EvaluationGuardBanner.tsx) — 소비 측 props 계약 (`active` · `message`)
- [src/assessment-evaluation/assessment-evaluation.controller.ts](../../src/assessment-evaluation/assessment-evaluation.controller.ts) — `208 행` · `339 행` · `538 행` · `599 행` 4 route (현행 동기 실행 진입점)
- [src/assessment-collection/assessment-collection.controller.ts](../../src/assessment-collection/assessment-collection.controller.ts) — `54 행` `@Post("collect")`
- [docs/requirements.md](../requirements.md) — `102 행` REQ-083 row

## Acceptance Criteria

- [ ] `docs/decisions/ADR-0060-evaluation-run-status-endpoint.md` 1 개를 신설한다. frontmatter 는 ADR-0059 형식 (`id` · `title` · `status: ACCEPTED` · `date` · `relatedTask: [T-1840]` · `relatedReq: [REQ-083]` · `supersedes: null`) 을 따른다.
- [ ] `§Status` 에 **본 ADR 은 결정만 박제하고 코드 0 LOC** 임을 명시한다 — 본 task 의 diff 는 ADR 파일 1 개뿐이며 `src/` · `web/` · `test/` · `prisma/` · `package.json` · `.github/workflows/` 변경이 0 임을 검증 가능한 문장으로 적는다.
- [ ] `§Decision 1` — **실행 상태의 보유 방식**을 택하고 근거를 적는다. 최소 3 안 (a) 프로세스 in-memory 실행 카운터 서비스, (b) Prisma model 신설 (`EvaluationRun` 류), (c) 기존 데이터 (Assessment `updatedAt` 등) 에서 파생 추론 — 을 비교하고, 채택안이 **새 외부 dependency 0 · Prisma schema 변경 0** 인지 명시한다. 만약 schema 변경을 동반하는 안을 채택한다면 CLAUDE.md `§5` DB schema 게이트에 걸린다는 점과 그 경우 후속 task 가 BLOCKED → notifier 를 거쳐야 함을 `§Consequences` 에 박제한다.
- [ ] `§Decision 2` — **endpoint 계약**을 확정한다: HTTP method · 정확한 경로 · 응답 body shape (필드명 · 타입 · 각 필드의 의미) · 성공 status code. 응답에는 최소한 배너 토글을 결정하는 boolean 축이 포함돼야 하며, `EvaluationGuardBanner` 의 `active` prop 에 어떻게 매핑되는지 1 문장으로 잇는다.
- [ ] `§Decision 3` — **인증 · RBAC 경계**를 확정한다 (guard 적용 여부, 접근 가능 역할 등급, 미인증 요청의 status). 기존 `/api/*` 의 JWT HttpOnly cookie 계약 ([ADR-0008](../decisions/ADR-0008-auth-credential-type.md)) 과의 정합을 1 문장으로 명시한다.
- [ ] `§Decision 4` — **상태 전이 시점**을 확정한다: 어느 실행 진입점 (평가 3 route + 수집 1 route 중 어디까지) 이 상태를 켜고 끄는지, 예외 발생 · 프로세스 재시작 시의 복구 규칙 (stuck 상태 방지) 을 적는다.
- [ ] `§Decision 5` — **polling 주기와 다중 인스턴스 한계**를 적는다: 권장 polling 간격과 그 근거, 그리고 채택안이 단일 프로세스 전제일 경우 다중 인스턴스에서 어떤 부정확이 발생하는지 · 그 부정확이 R-78 의 보호 의도 (기존 자료만 표시 + 경고) 를 깨지 않는 이유 (또는 깬다면 그 완화책).
- [ ] `§Consequences` 에 **chain 완주 전에는 배너가 항상 비활성** 이라는 중간 상태를 명시한다 (Q-0055 선례 — false-success 상태의 사전 박제).
- [ ] `§Alternatives` 에 위 `§Decision 1` 의 기각안 2 종 각각의 기각 사유를 적는다.
- [ ] `§Follow-ups` 에 구현 chain 을 **slice 단위로** 나열한다 — 각 slice 는 어느 파일의 어느 배선인지까지 적고 (CLAUDE.md `§3` 소비처 동반 의무), 예상 순서는 backend 상태 보유 → controller route + e2e → web polling 배선 → REQ-083 재판정 (`§3.1` 규칙 6 — 구현 머지 후 1 회) 이다. 각 slice 가 cap (300 LOC / 5 파일) 안에 들어오도록 쪼갠다.
- [ ] 코드 · 테스트 · schema 변경 0 — `git diff --stat` 결과가 `docs/decisions/ADR-0060-*.md` 1 파일뿐이다.
- [ ] R-110 (doc-only pr-mode 라도 tester 호출 의무): `pnpm lint && pnpm build && pnpm test` 가 green 임을 tester 가 확인한다. **production code 변경이 0 LOC 이라 신규 spec 은 추가하지 않는다** — R-112 의 happy / error / 분기 / negative 4 항목은 새로 추가·수정된 public symbol 이 0 개이므로 본 task 에 적용 대상이 없으며, 그 사실을 PR 본문에 1 문장으로 명시한다 (분기 없음 — 해당 항목 생략).
- [ ] `pnpm test:cov` 가 기존 임계 (line ≥ 80% / function ≥ 80%) 를 그대로 통과한다 (본 task 는 코드 0 LOC 라 커버리지 변동이 없어야 한다).
- [ ] ADR 본문은 한국어 (CLAUDE.md `§12`), 행 범위 표기는 `~` 단일 구분자 · 단일 행은 `194 행` 형식.

## Out of Scope

- `src/` · `web/` · `test/` · `prisma/` 의 **모든 코드 변경** — 상태 보유 서비스 · controller route · DTO · e2e · web polling 배선은 전부 `§Follow-ups` 로 이월한다.
- `docs/requirements.md` REQ-083 row 의 status 재판정 — CLAUDE.md `§3.1` 규칙 6 상 구현 slice 머지 **후** 1 회만 한다. 본 task 에서 건드리지 않는다.
- `docs/PLAN.md` `133 행` bullet 마커 변경 — 잔여 ① · ④ 가 남아 있으므로 `[ ]` 유지, 본 task 는 PLAN 을 수정하지 않는다.
- [docs/architecture/frontend-api-contract.md](../architecture/frontend-api-contract.md) `§3.4` gap 표 갱신 — endpoint 가 실제로 shipped 된 뒤의 doc-sync slice 소관.
- 새 외부 dependency 추가 (polling 라이브러리 · 상태관리 라이브러리 등) — 필요하다고 판단되면 결정하지 말고 `§Follow-ups` 에 "CLAUDE.md `§5` 게이트 선행" 으로 남긴다.
- PLAN `133 행` 잔여 ① 전역 CSS — 독립 arc 다.

## Suggested Sub-agents

`architect → tester`

## Follow-ups
