---
id: T-2068
title: 등록 수집 대상 허용 host ④ — redirect 고정 · 배포 계약 · ADR 결정
phase: P7
status: PENDING
commitMode: pr
coversReq: [REQ-072]
estimatedDiff: 150
estimatedFiles: 5
created: 2026-10-31
dependsOn: [T-2067]
touchesFiles: [src/collection-target/registered-target-redirect.spec.ts, docs/decisions/ADR-0059-collection-target-registration.md, deploy/env.prod.example, docs/ops/runbook.md, docs/architecture/api.md]
plannerNote: P7 · ADR-0059 §Consequences (e) 봉합 arc ④ — 마지막 조각
---

# T-2068 — redirect · 배포 계약 · ADR

## Why

T-2065~T-2067 로 enforcement 가 들어갔다. 새 배포 계약 (`*_ALLOWED_HOST`) 을 운영 문서에 적고, ADR-0059 §Consequences (e) 의 "owner 판단 대기" 를 결정으로 닫아야 한다. redirect 안전은 런타임 fetch 동작에 기대므로 test 로 고정한다.

## Required Reading

- ADR-0059 §Decision 2 · 3 · §Consequences (b) (e), [T-2066](T-2066-target-host-guard-wiring.md) Follow-ups, PR #1627 리뷰 MAJOR-1.

## Acceptance Criteria

- [ ] 실 fetch · 로컬 서버로 GitHub · Confluence adapter 의 cross-origin redirect 에서 Authorization 이 다음 host 로 가지 않음을 고정한다.
- [ ] ADR-0059 에 결정을 적는다: 허용 host 규칙, port · 끝 점 규칙, https 강제, env 대상 제외, redirect, 등록 시점 검증 미도입 사유, 완화 안 된 잔여 위험.
- [ ] `deploy/env.prod.example` · runbook 에 계약과 진단을 적는다. 허용 값은 host 1 개이며 목록 · wildcard 가 아니다.
- [ ] `api.md` 의 등록 route 설명이 fail closed 를 말한다.
- [ ] `pnpm lint && pnpm build && pnpm test` green, PR CI green.

## Out of Scope

- `rejected` 진단의 API 노출, 등록 · 수정 시점 검증, 수동 경로의 저장 판정.

## Follow-ups

- (owner) 수동 경로의 저장 판정: `POST /period` · `POST /collect` 는 거부 row 만 가진 인원에 대해서도 빈 좌표를 저장해 first-write-wins 로 자동 평가의 재기록을 막는다. credential 부재 row 의 기존 동작과 같다. token 은 나가지 않는다.
- (owner) 허용 host 로 등록한 서버가 다른 host 로 redirect 하면 인증 없이 받은 응답을 수집 결과로 쓴다. token 유출은 아니다. `redirect: "error"` 는 GitHub 의 저장소 이름 변경 301 까지 끊으므로 정책 판단이 필요하다.
