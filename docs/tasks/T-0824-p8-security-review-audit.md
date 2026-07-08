---
id: T-0824
title: P8 보안 점검 감사 문서 신설 (secret 처리 / 인증 흐름 / RBAC)
phase: P8
status: PENDING
commitMode: direct
coversReq: [REQ-043, REQ-045, REQ-008, REQ-016]
estimatedDiff: 200
estimatedFiles: 2
created: 2026-07-08
independentStream: p8-hardening-docs
dependsOn: []
touchesFiles: [docs/ops/security-review.md, docs/PLAN.md]
plannerNote: P8 line146 보안 점검 bullet — main 의 auth/RBAC/secret 통제 감사 문서 신설(doc-only direct), gap 은 Follow-up 으로.
---

# T-0824 — P8 보안 점검 감사 문서 신설 (secret 처리 / 인증 흐름 / RBAC)

## Why

PLAN.md P8 (line 146) "보안 점검 (secret 처리, 인증 흐름, RBAC)" bullet 은 아직 `[ ]` 이며 launch 전 hardening 항목이다. main 에는 이미 상당한 보안 통제 (`src/auth/*` JWT 인증·guard·roles decorator, permission-denied audit, secret env 주입 정책 §9) 가 shipped 되어 있으나 이를 **한 곳에서 감사·검증한 문서가 부재**하다. 본 task 는 기존 통제를 열거·검증하고 gap 을 식별하는 감사 문서(`docs/ops/security-review.md`)를 신설해, README REQ-043(모든 기능 ID/Password 보호)·REQ-045(Admin RBAC)·REQ-008/016(접근 권한 부족 인식) 의 보안 요구를 launch 관점에서 정리한다. doc-only 이므로 direct commit.

## Required Reading

- `docs/PLAN.md` line 143~148 (P8 Hardening 섹션, line 146 대상 bullet)
- `src/auth/jwt-auth.guard.ts`, `src/auth/roles.decorator.ts`, `src/auth/jwt.strategy.ts`, `src/auth/resolve-jwt-secret.ts` (인증·RBAC·secret 해석 통제 실체)
- `docs/decisions/ADR-0023-permission-denied-audit-query-rbac-contract.md` (permission-denied audit / RBAC 계약)
- `docs/ops/runbook.md` §4 (운영 전제 — secret/PAT 주입 정책)
- `CLAUDE.md` §9 (secret 실값 git/journal 금지 안전장치)
- `docs/requirements.md` REQ-043 / REQ-045 / REQ-008 / REQ-016 행

## Acceptance Criteria

- [ ] `docs/ops/security-review.md` 신설. 다음 4 섹션을 실증 근거(파일 경로·심볼) 기반으로 작성:
  1. **Secret 처리** — JWT secret 해석(`resolve-jwt-secret.ts`), env/암호화 토큰 주입 정책(runbook §4, §9), git/STATE/journal 실값 금지 규율. secret 이 코드/문서에 노출되지 않음을 grep 근거로 확인 기술.
  2. **인증 흐름** — JWT 발급(`auth.service.ts`)·검증(`jwt.strategy.ts`)·guard 배선(`jwt-auth.guard.ts`), 미인증 요청 차단 경로. REQ-043(모든 기능 ID/Password 보호) 매핑.
  3. **RBAC** — `roles.decorator.ts` + guard 로 Admin 권한(재작성/Reset/Import/Export/인원편집/Group편집, REQ-045) 게이트, permission-denied audit(ADR-0023) 계약. REQ-008/016(접근 권한 부족 인식·통지) 매핑.
  4. **감사 결과 + 잔여 gap** — 각 통제의 커버 여부를 표(통제 / 실증 파일 / REQ / 상태)로 정리. gap 발견 시 Follow-ups 에만 기록(본 task 에서 코드 수정 금지).
- [ ] `docs/PLAN.md` line 146 bullet 을 `[ ]`→`[x]` flip 하고 `**보안 감사 완료**: [docs/ops/security-review.md](ops/security-review.md)` 근거 절 append. (단, 감사 결과 심각한 미비 통제가 발견되면 flip 하지 말고 `[ ]` 유지 + gap 을 Follow-up 으로 — false-positive flip 금지.)
- [ ] 분기 없음 — doc-only, 코드/test 변경 0. R-112 test 항목은 해당 없음(direct doc-only, §3.2 면제).
- [ ] secret 실값(토큰/키/비밀번호) 0 — 문서에 통제 위치·정책만 기술하고 실값은 절대 적지 않는다(§9).

## Out of Scope

- `src/` / `test/` 코드 변경 (감사에서 gap 발견 시 별도 pr-mode task 로 Follow-up).
- 새 ADR 신설 (감사가 정책 변경을 요구하면 Follow-up ADR task).
- 부하·내성 테스트(line 148) / E2E 커버리지(line 145) / 성능 검증(P7 line 137) — 각각 별도 P8 bullet.
- 실제 penetration test 또는 외부 보안 도구 실행.

## Suggested Sub-agents

direct doc-only 이므로 executor → implementer (감사 문서 작성). tester 불요(코드 0).

## Follow-ups

(비어 있음 — 감사 중 발견된 gap 을 여기 append)
