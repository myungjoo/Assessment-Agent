---
id: T-0215
title: api.md §5 에 GET /api/permission-denied-records audit 조회 endpoint row 박제 (doc-sync)
phase: P4
status: DONE
commitMode: direct
coversReq: [REQ-016, REQ-044]
estimatedDiff: 20
estimatedFiles: 1
created: 2026-06-04
completedAt: 2026-06-04T10:50:00+09:00
plannerNote: P4 — T-0214 가 shipped 한 GET /api/permission-denied-records 가 api.md §5 endpoint 표에 미박제. REQ-016/044 가시화 doc-sync (direct).
---

# T-0215 — api.md §5 에 GET /api/permission-denied-records audit 조회 endpoint row 박제

## Why

T-0214 (PR-188, 5bf362d) 가 `GET /api/permission-denied-records` audit 조회 endpoint 를 실제로 shipped 했으나 ([src/permission-denied/permission-denied-record.controller.ts](../../src/permission-denied/permission-denied-record.controller.ts)), [docs/architecture/api.md](../architecture/api.md) §5 endpoint 표에는 이 endpoint 가 박제돼 있지 않다. §5 표의 "UC-08 권한 부족 통지" 그룹은 conceptual placeholder 2 row (`GET /api/me/permission-denied` / `GET /api/admin/permission-denied`) 만 가지고 있고, 실제 shipped 된 `/api/permission-denied-records` 는 누락이다. api.md 는 **living document** (문서 머리말 박제) 로 endpoint 신설 시 갱신 의무가 있으며, 본 doc-sync 가 REQ-016 (권한 부족의 user/admin audience 분리) + REQ-044 (권한 거부 가시화) 의 운영자 조회 경로를 contract source 에 반영한다. ADR-0023 §5 (endpoint shape) 의 결정을 표 row 로 외화한다.

## Required Reading

- [docs/architecture/api.md](../architecture/api.md) — §5 endpoint 표 (특히 L121~125 "UC-08 권한 부족 통지" 그룹 + L109~115 LLM endpoint row 들이 T-NNNN 주석 + auth tier 를 어떻게 박제하는지 mirror 대상) + L125 합계 줄
- [src/permission-denied/permission-denied-record.controller.ts](../../src/permission-denied/permission-denied-record.controller.ts) — 실제 endpoint shape (경로 `/api/permission-denied-records`, `@Get()`, `@UseGuards(JwtAuthGuard, RolesGuard)`, `@Roles("User")`, query param instanceRef/provider/httpStatus, 응답 record view 배열)
- [docs/decisions/ADR-0023-permission-denied-audit-query-rbac-contract.md](../decisions/ADR-0023-permission-denied-audit-query-rbac-contract.md) §1 (audience: Admin bypass / non-Admin own-instance) + §4 (401/403/빈결과 경계) + §5 (endpoint shape · query param · 응답 shape · RBAC stack)

## Acceptance Criteria

- [ ] api.md §5 endpoint 표에 `GET /api/permission-denied-records` row 1 개 추가. METHOD=GET / path=`/api/permission-denied-records` / UC=UC-08 / auth tier=User+ 컬럼 박제. description 컬럼 (≤ 1~2 줄) 에 다음 사실 포함: (i) audit 조회 (권한 거부 record 목록), (ii) RBAC = `@Roles("User")` — authenticated 면 접근, audience 차등은 service-layer (Admin/SuperAdmin = 전체 record bypass / non-Admin authenticated = User↔instance binding 미박제로 현재 빈 배열 fallback), (iii) query param `instanceRef` / `provider` (github/confluence) / `httpStatus` 필터, (iv) 응답 record view 배열 (provider/instanceRef/resourceRef/principal/httpStatus/reason/createdAt — secret 컬럼 부재라 redaction 불요), (v) 401 (미인증), 200 빈 배열 (매칭 0 또는 non-Admin binding 부재), (vi) T-0214 박제 + ADR-0023 참조. 기존 LLM endpoint row (L109~115) 의 T-NNNN 주석 + ADR 링크 스타일 mirror.
- [ ] 본 endpoint 가 기존 placeholder 2 row (`GET /api/me/permission-denied` / `GET /api/admin/permission-denied`) 와의 관계를 1 줄로 명확화 — placeholder 는 UC-08 §5 sequence 의 conceptual audience-split 표현이고, 실제 shipped 된 단일 통합 endpoint 가 `/api/permission-denied-records` 임을 표 또는 인접 주석에 박제 (독자가 3 row 의 관계를 오인하지 않도록). placeholder row 를 삭제하지는 않는다 (UC-08 sequence cross-reference L160 가 참조 중 — out of scope).
- [ ] §5 끝 합계 줄 (L125 "약 46 endpoint ...") 의 endpoint 수 / prefix 수를 본 row 추가에 맞춰 정합 (예: "약 47 endpoint", prefix `/api/permission-denied-records` 추가 시 11 → 12 — 실제 표 재집계로 확정). 정합이 애매하면 합계 문구에 "audit 조회 endpoint 포함" 1 구절만 추가하고 정확 수치는 보수적으로 갱신.
- [ ] 변경은 [docs/architecture/api.md](../architecture/api.md) 단일 파일에 한정. `git diff --stat` 가 1 파일만 보고.
- [ ] 분기·코드·심볼 없음 (순수 문서) → R-112 test 항목 / coverage threshold 적용 대상 아님 (commitMode direct, doc-only). tester 미호출.

## Out of Scope

- modules.md 의 PermissionDenied 모듈 row 신설 — modules.md 는 MVA 8-module 표라 module 추가는 별도 판단콜. 본 task 는 api.md 만. (Follow-up 후보)
- `permission-denied-record.e2e-spec.ts` 신설 (HTTP round-trip + RBAC 401/403/happy e2e) — 다른 RBAC controller (auth/users/assessments/contributions/summaries) 는 모두 `*.e2e-spec.ts` 가 있으나 permission-denied 는 prisma-model smoke 만 존재. 이는 pr-mode 코드 task 라 본 direct doc-sync 와 분리. (Follow-up 으로 박제)
- placeholder row (`/api/me/permission-denied` / `/api/admin/permission-denied`) 삭제 / UC-08 sequence cross-reference (§7) 재작성 — UC-08 use-case 문서 정합은 본 task 범위 밖.
- non-Admin own-instance 실 필터 / User↔instance binding schema 관련 문서 — §5 DB-schema 게이트 (미승인) 라 본 doc-sync 는 "현재 binding 미박제 → non-Admin 빈 배열 fallback" 현 상태만 박제하고 미래 동작은 기술하지 않는다.

## Suggested Sub-agents

direct doc-only — sub-agent 불요. driver 가 직접 api.md 편집 후 main 직접 commit/push.

## Follow-ups

- (planner 검토 후보) `permission-denied-record.e2e-spec.ts` 신설 — `GET /api/permission-denied-records` 의 end-to-end HTTP round-trip + RBAC (미인증 401 / authed Admin happy 전체 record / non-Admin authed 빈 배열) + query param 필터 검증. 기존 RBAC controller e2e (users.e2e / assessments.e2e) 1:1 mirror, 실 PostgreSQL (createAuthenticatedE2EApp helper). commitMode pr, R-112/R-113.
- (planner 검토 후보) modules.md 에 PermissionDenied 모듈/controller 표현 추가 여부 판단 — MVA 8-module 표 확장 vs 인라인 주석.
