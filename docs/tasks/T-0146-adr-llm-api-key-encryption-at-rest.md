---
id: T-0146
title: ADR-0014 신설 — LLM API key encryption-at-rest 정책
phase: P4
status: DONE
completedAt: 2026-06-01T23:58:30+09:00
prNumber: 140
mergedAs: cd98a69
reviewRounds: 1
commitMode: pr
coversReq: [REQ-052, REQ-053, REQ-054]
estimatedDiff: 200
estimatedFiles: 2
created: 2026-06-01
plannerNote: P4 — p4-plan §3 ADR 후보(c) mandated-but-unwritten; LlmProviderConfig.apiKey encryption-at-rest 결정 ADR. config write CRUD(HITL) 선행 doc-only 정책. dependency-free.
---

# T-0146 — ADR-0014 신설: LLM API key encryption-at-rest 정책

## Why

[docs/PLAN.md](../PLAN.md) Phase P4 "LLM provider 추상화 (L85, R-99~103)" + "자격증명 관리 (L88)" bullet 의 backbone 인 `LlmProviderConfig.apiKey` 컬럼은 현재 평문 String 으로 박제돼 있다 ([src/llm/llm-provider-config.repository.ts](../../src/llm/llm-provider-config.repository.ts), T-0135 머지). [docs/architecture/data-model.md](../architecture/data-model.md) 는 이 컬럼을 **"API key (encrypted at rest, 별도 ADR)"** (L31) 로 박제하고 §7 (L150) + future-hook (L172) 에서 **"LLM API key 의 encryption-at-rest 구체 mechanism — 별도 보안 ADR 책임"** 으로 명시 deferral 한다. [docs/architecture/p4-implementation-plan.md §3 ADR 후보 (c)](../architecture/p4-implementation-plan.md) 도 이 ADR 을 mandated 후보로 박제하나 (표기된 "ADR-0006" 번호는 stale — ADR-0006 은 assessment-data-model 이 점유, [ADR-0011 §"ADR cross-reference"](../decisions/ADR-0011-difficulty-model-assignment.md) 가 stale 박제 확인) 아직 **미신설**이다.

본 ADR 은 [CLAUDE.md §1](../../CLAUDE.md) ("코드보다 ADR이 먼저다") 정합으로, secret 처리 코드 / config write CRUD endpoint (apiKey 를 request body 로 받음 — §5 HITL 게이트) 의 **선행 결정 doc** 을 단독 박제한다. ADR-0011 (난이도) / ADR-0013 (Confluence 탐색) 이 각각 HITL-gated 구현의 선행 ADR 였던 패턴 mirror — 본 ADR 은 doc-only (외부 dependency 0 / `pnpm add` 0 / 자격증명 0 / secret literal 0 / schema migration 0) 라 §5 HITL 미발화. 실 encryption 구현 + 필요 시 dependency 추가 (`pgcrypto` extension / crypto lib) 는 후속 task 의 §5 게이트 책임.

## Required Reading

- [docs/architecture/data-model.md](../architecture/data-model.md) — L31 (LlmProviderConfig apiKey "encrypted at rest, 별도 ADR"), §7 L150 + L172 (encryption-at-rest mechanism deferral, "ADR-0005 secret-encryption" stale 표기 포함)
- [docs/architecture/p4-implementation-plan.md](../architecture/p4-implementation-plan.md) — §3 ADR 후보 (c) (LLM API key encryption-at-rest, 트리거 = LlmProviderConfig entity) + §4 (HITL 게이트 inventory — 본 ADR 미발화 확인)
- [src/llm/llm-provider-config.repository.ts](../../src/llm/llm-provider-config.repository.ts) — 현재 평문 apiKey String 컬럼 (decision 의 대상)
- [docs/decisions/ADR-0011-difficulty-model-assignment.md](../decisions/ADR-0011-difficulty-model-assignment.md) — ADR-first split + 번호 정합 패턴 (ADR-0006 stale 박제) + ADR 본문 template (Context / Decision / Consequences / Alternatives / References)
- [docs/decisions/ADR-0008-auth-credential-type.md](../decisions/ADR-0008-auth-credential-type.md) — security/auth 결정을 ADR 로 doc-only 박제한 precedent (JWT cookie)
- [docs/decisions/ADR-0002-db.md](../decisions/ADR-0002-db.md) — PostgreSQL + Prisma baseline (pgcrypto 후보의 기반)
- [docs/architecture/INDEX.md](../architecture/INDEX.md) — "ADR 매핑" 표 (새 row 추가 대상) + 다음 free ADR 번호 = ADR-0014 확인
- [CLAUDE.md](../../CLAUDE.md) §1 (ADR 먼저) / §3.1 rule 4 (새 ADR = pr) / §5 (secret 처리 BLOCKED 게이트는 구현 task 책임 — 본 doc-only ADR 미발화)

## Acceptance Criteria

- [ ] `docs/decisions/ADR-0014-llm-api-key-encryption-at-rest.md` 신설 — frontmatter (`id: ADR-0014` / `title` / `status: ACCEPTED` / `date` / `relatedTask: T-0146` / `supersedes: null`) + 본문 Context / Decision / Consequences / Alternatives considered / References 5 섹션 (ADR-0011 template mirror).
- [ ] **Context** — L85/L88 PLAN bullet + data-model.md L31/§7 deferral + p4-plan §3 (c) 트리거 + 현 평문 apiKey 상태 + ADR-0006/ADR-0005 stale 번호 정합 (본 ADR = ADR-0014) 박제.
- [ ] **Decision** — 최소 다음 축을 확정: (1) encryption mechanism 선택 (PostgreSQL `pgcrypto` column-level vs application-layer envelope encryption [Node 내장 `crypto` AES-GCM] vs 외부 KMS), (2) 암호화 키 자체의 보관·rotation 정책 방향 (env var / secret manager — 실 secret 값 0 기재), (3) apiKey 의 write-only/never-read-back contract (config write CRUD 의 §5 HITL endpoint 에 전달될 invariant — GET 응답에 apiKey 비노출, T-0140 service 가 이미 비노출 박제한 사실과 정합), (4) 평문 → 암호화 전환 migration 방향 (구체 SQL 은 후속 task).
- [ ] **Consequences** — 양/음 trade-off + 후속 task chain 박제 (encryption 구현 task 가 §5 HITL 게이트 발화 — dependency / 키 자격증명 추가 시점) + config write CRUD 의 선행 의존 관계 명시.
- [ ] **Alternatives considered** — 최소 3 대안 비교 표 (pgcrypto / application-layer envelope / KMS / 평문 유지[기각]) + 채택 사유.
- [ ] `docs/architecture/INDEX.md` "ADR 매핑" 표에 ADR-0014 row 1 줄 추가 (영향 view 문서 = data-model.md LlmProviderConfig + 상태 ACCEPTED).
- [ ] `pnpm lint && pnpm build && pnpm test` green (R-110 — production code 0 LOC 변경이어도 tester 가 CI 정합 확인). `pnpm test:cov` line ≥ 80% / function ≥ 80% 유지 (코드 변경 0 이라 coverage 영향 0, 회귀 없음 확인).
- [ ] **분기 없음 — R-112 4-item (happy/error/branch/negative) 생략**: 본 task 는 doc-only ADR 신설로 production code · 새 public symbol · 분기 추가 0. tester 는 R-110 (lint/build/test green) 만 확인.

## Out of Scope

- **실 encryption 코드 작성** — `pgcrypto` extension enable / apiKey 컬럼 암복호화 로직 / envelope encryption 구현은 후속 task 책임 (§5 HITL 게이트 발화 대상 — dependency / 키 자격증명 추가 시).
- **`pnpm add`** — crypto lib / KMS SDK 추가 0. 본 ADR 은 mechanism **결정** 만, 패키지 추가는 후속 구현 task.
- **schema migration** — `LlmProviderConfig.apiKey` 의 평문 → encrypted 전환 `prisma/migrations/*.sql` 작성 0 (ADR 은 방향만, 실 migration 은 후속 task).
- **config write CRUD endpoint (POST/PATCH/DELETE)** — apiKey 를 request body 로 받는 endpoint 구현은 §5 HITL (secret 처리) 게이트 대상 — 본 ADR 머지 + 사용자 승인 후 별도 task.
- **실 secret 값 / 키 기재** — ADR 본문에 어떤 API key / 암호화 키 값도 기재 0 (CLAUDE.md §9).
- **다른 entity 의 encryption** — Person email 등 PII encryption 은 별도 ADR (본 ADR 은 LLM API key 단독).
- **STATE.json / counters / journal** — driver single-writer 책임 (본 task 는 ADR + INDEX 만).

## Suggested Sub-agents

`architect → tester` (architect 가 ADR-0014 신설 + INDEX row 추가; tester 가 R-110 lint/build/test green 확인 — production code 0 이므로 새 spec 불요, 회귀 없음만 검증).

## Follow-ups

(작성 시 비어 있음 — sub-agent 가 관련 작업 발견 시 추가)
