---
id: T-0283
title: PLAN P4 LLM apiKey encryption-at-rest bullet (L90) doc-sync
phase: P4
status: PENDING
commitMode: direct
coversReq: [REQ-040]
estimatedDiff: 3
estimatedFiles: 1
created: 2026-06-08
plannerNote: P4 doc-sync Group C slice — L90 LLM apiKey at-rest bullet [ ]→[x] flip; main reality(cipher.encrypt write + sanitize read + JIT decrypt) 박제 검증 완료, doc-only inline-amend ×0.64
---

# T-0283 — PLAN P4 LLM apiKey encryption-at-rest bullet (L90) doc-sync

## Why

[docs/PLAN.md](../PLAN.md) Phase P4 의 L90 bullet (`[credential-prep / 운영 공백] LLM provider apiKey encryption-at-rest 완결`) 은 아직 `[ ]` stale 이며 본문이 "`apiKey String` 이 아직 **평문 placeholder**", "완결한다" 라고 미완 시제로 기술한다. 그러나 main 코드 대조 결과 encryption-at-rest 가 이미 end-to-end 박제됐다 — write 경로 `LlmProviderConfigService.create/update` 가 `LlmApiKeyCipher.encrypt` 로 AES-256-GCM ciphertext 영속(line 159/221), read 경로는 sanitize(Omit apiKey) never-read-back, gateway `LlmHttpGatewayService` 가 LLM 호출 시점에만 `cipher.decrypt` JIT(line 143), `prisma/schema.prisma` 의 `apiKey String` 컬럼도 ciphertext 주석(line 361~366)으로 amend 완료. 즉 PLAN bullet 의 [ ] 박스와 미완 시제가 reality 와 drift 한 순수 문서 결손이다. T-0278~T-0282 (Group A/B/C) 동형의 stale-checkbox doc-sync 로 정합한다.

## Required Reading

- `docs/PLAN.md` (L90 — Phase P4 의 LLM apiKey encryption-at-rest bullet 한 줄. L88/L82 등 다른 P4 bullet 은 본 task 범위 아님)

## Acceptance Criteria

- [ ] `docs/PLAN.md` L90 의 bullet 체크박스를 `- [ ]` → `- [x]` 로 flip.
- [ ] 같은 bullet 본문 끝에 main reality 인용 한 줄 추가: write 경로 `LlmProviderConfigService.create/update` 의 `LlmApiKeyCipher.encrypt`(ADR-0014 AES-256-GCM envelope) ciphertext 영속 + read sanitize never-read-back + `LlmHttpGatewayService` JIT `cipher.decrypt` + `prisma/schema.prisma` apiKey 컬럼 ciphertext 주석 박제. 미완 시제("완결한다" / "아직 평문 placeholder")는 완료 시제로 자연스럽게 정합. `**(완료)**` 마커 부착(L89/L83/L84 동형 포맷).
- [ ] 변경 파일은 `docs/PLAN.md` 단 1개. diff ≤ ~5 LOC.
- [ ] 인용한 사실(service encrypt/decrypt 호출, sanitize, schema 주석)이 실제 main 코드와 일치(이미 본 task Why 에서 grep 검증됨 — 허위 인용 0).

## Out of Scope

- L88 (`자격증명 관리 + 권한 부족 감지·통지`) doc-sync — 별도 후속 fire 가 처리 (한 task 1 bullet 룰).
- L82 (`GitHub Issue 평가 + self-follow-up 제외`) — grep 0 의 진짜 미구현 backlog, doc-sync 부적합. 후속 planner survey 가 escalate 가능.
- `src/`, `prisma/`, `docs/architecture/`, ADR 등 코드/설계 문서 변경 일절 금지 (순수 PLAN 체크박스 정합).
- 새 schema migration / encryption 로직 변경 — 이미 main 에 박제됨, 본 task 는 문서만.

## Suggested Sub-agents

없음 — driver 직접 Edit (direct doc-only, commitMode=direct 라 reviewer/PR/tester 호출 0, R-110/R-112 면제, 분기 없음).

## Follow-ups

(생성 시점 비어있음)
