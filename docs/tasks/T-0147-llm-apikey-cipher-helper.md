---
id: T-0147
title: LlmApiKeyCipher — AES-256-GCM envelope encrypt/decrypt helper (ADR-0014)
phase: P4
status: DONE
completedAt: 2026-06-02
mergedAs: edd97c5
prNumber: 141
reviewRounds: 1
commitMode: pr
coversReq: [REQ-043, REQ-052, REQ-053, REQ-054]
estimatedDiff: 180
estimatedFiles: 3
created: 2026-06-02
plannerNote: P4 milestone-2 chain 1/4 (Q-0013 승인) — config write CRUD 의 선행 의존 encryption helper, ADR-0014 §1·§2 박제, dep 0
---

# T-0147 — LlmApiKeyCipher: AES-256-GCM envelope encrypt/decrypt helper

## Why

사용자가 §5-HITL milestone "config write CRUD" (Q-0013, milestone-2) 를 승인했다. 그 milestone 은 POST/PATCH/DELETE `/api/llm/providers` 에서 apiKey 를 request body 로 받아 **암호화 후 영속**해야 한다 ([ADR-0014](../decisions/ADR-0014-llm-api-key-encryption-at-rest.md) Decision §1). 본 task 는 그 chain 의 **첫 단계** — 모든 write endpoint 가 의존할 **AES-256-GCM envelope 암복호화 helper** 1개를 신설한다 ([ADR-0014 §"후속 task chain 박제"](../decisions/ADR-0014-llm-api-key-encryption-at-rest.md) 의 "encryption helper task" row). [PLAN.md L85/L88](../PLAN.md) P4 "LLM provider 추상화 (R-99~103)" + "자격증명 관리 (R-20/R-33)" 의 secret-at-rest backbone (REQ-043) 을 cover 한다.

본 helper 는 **Node 내장 `node:crypto` 만** 사용해 새 외부 dependency 0 ([CLAUDE.md §5](../../CLAUDE.md) 게이트 회피, Q-0013 승인 제약). 키는 `LLM_APIKEY_ENC_KEY` env var 에서 read 하며 ([ADR-0014 §2](../decisions/ADR-0014-llm-api-key-encryption-at-rest.md)), 실 secret 값은 spec / 코드 / journal 어디에도 박지 않고 test 에서는 test key 를 in-memory 로 생성해 쓴다.

## Required Reading

- [docs/decisions/ADR-0014-llm-api-key-encryption-at-rest.md](../decisions/ADR-0014-llm-api-key-encryption-at-rest.md) — 본 helper 의 결정 doc. 특히 Decision §1 (AES-256-GCM envelope: ciphertext + IV(nonce 12B random) + GCM auth tag) + §2 (`LLM_APIKEY_ENC_KEY` env var, AES-256 = 32-byte key, base64/hex 인코딩) + Consequences 의 IV 고유성 / auth tag 무결성 규율.
- [src/auth/jwt.strategy.ts](../../src/auth/jwt.strategy.ts) (L53–64) + [src/auth/auth.module.ts](../../src/auth/auth.module.ts) (L26, L63) — 기존 env getter 패턴 (`process.env.X ?? fallback`, `@nestjs/config` 미사용). 본 helper 의 `LLM_APIKEY_ENC_KEY` getter 가 mirror 할 precedent.
- [src/llm/llm-provider-config.service.ts](../../src/llm/llm-provider-config.service.ts) — apiKey never-read-back invariant 의 선행 실현 (apiKey redact view). 본 helper 가 그 invariant 의 encrypt 측 짝. `@Injectable()` NestJS service 패턴 mirror.
- [src/llm/llm.module.ts](../../src/llm/llm.module.ts) — 본 helper 를 provider 로 등록할 module (provider 배열에 추가).

## Acceptance Criteria

helper 는 `src/llm/llm-apikey-cipher.service.ts` 에 NestJS `@Injectable()` service 로 신설한다. colocated spec 은 `src/llm/llm-apikey-cipher.service.spec.ts` (colocated 우선 정책). 다음을 모두 만족:

- [ ] `encrypt(plaintext: string): string` — AES-256-GCM 으로 평문 apiKey 를 암호화. IV 는 매 호출 `crypto.randomBytes(12)` 로 고유 생성. 반환은 IV + authTag + ciphertext 를 단일 string (base64 등) 으로 envelope packing 한 form (구체 인코딩은 implementer 결정, decrypt 와 round-trip 호환되면 됨).
- [ ] `decrypt(envelope: string): string` — envelope 을 unpack 해 IV / authTag / ciphertext 분리 후 복호화. auth tag 검증 실패 (변조 / 잘못된 키) 시 throw (swallow 금지).
- [ ] 키는 `LLM_APIKEY_ENC_KEY` env var 에서 read (32-byte AES-256 key, base64 또는 hex 디코딩). env 부재 / 길이 미달 시 명확한 error throw — 평문 fallback 절대 금지 (보안 invariant). `jwt.strategy.ts` 의 env getter 패턴 mirror 하되, **암호화 키는 placeholder fallback 을 두지 않는다** (JWT 와 달리 secret 부재 시 boot 가 아니라 암호화 시점에 fail-fast).
- [ ] **Happy-path unit test**: `encrypt` → `decrypt` round-trip 이 원본 평문을 복원하는 test 1+ (test 전용 32-byte 키를 spec 내 `crypto.randomBytes(32)` 또는 고정 test 상수로 in-memory 주입 — 실 secret 박제 0).
- [ ] **Error path unit test**: (a) `LLM_APIKEY_ENC_KEY` 미설정 시 throw, (b) 키 길이 미달 (32B 아님) 시 throw, (c) `decrypt` 에 잘못된 envelope (깨진 base64 / 길이 부족) 입력 시 throw — 각 1+.
- [ ] **Flow / branch coverage**: env 부재 분기 / 키 길이 검증 분기 / auth tag 검증 분기 등 각 분기 1+ test.
- [ ] **Negative cases 충분 cover** (보안 민감 — 각 1+ test):
  - tamper / auth-tag failure: ciphertext 1 byte 변조 후 `decrypt` 시 throw (GCM 무결성 검증).
  - wrong-key failure: A 키로 encrypt 한 envelope 를 B 키로 `decrypt` 시 throw.
  - missing-env-key failure: `LLM_APIKEY_ENC_KEY` 미설정 시 `encrypt` / `decrypt` 모두 fail-fast throw.
  - IV 고유성: 동일 평문을 2회 `encrypt` 시 envelope (ciphertext/IV) 가 서로 다름 — IV 재사용 회귀 방지 ([ADR-0014 Consequences §3](../decisions/ADR-0014-llm-api-key-encryption-at-rest.md)).
- [ ] `LlmApiKeyCipher` 를 `LlmModule` provider 배열에 등록 (후속 service 가 주입받을 수 있도록). module spec 이 깨지지 않음.
- [ ] `pnpm lint && pnpm build` 통과.
- [ ] `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%).
- [ ] tester 가 unit + smoke + e2e 실행 결과 확인 (R-113). PR 본문에 결과 요약.

## Out of Scope

- **POST/PATCH/DELETE config write endpoint** — Follow-up #2 (본 task 는 helper 만, endpoint 0).
- **write DTO (CreateLlmProviderConfigDto 등)** — Follow-up #2 (endpoint task 와 함께).
- **DB schema migration** — 본 helper 는 string → string 변환만, 컬럼 form 전환 (`apiKey` 평문 → ciphertext) 은 별도 schema task ([ADR-0014 §4](../decisions/ADR-0014-llm-api-key-encryption-at-rest.md)). **본 task 에서 `prisma/schema.prisma` / migration 을 건드리면 안 된다** — 만약 helper 구현이 schema 변경을 강제한다고 판단되면 STOP 하고 Follow-ups 에 적은 뒤 BLOCKED escalate (Q-0013 제약: schema migration 은 별도 게이트).
- **repository / service 의 encrypt 호출 wire** — Follow-up #2 (endpoint 가 helper 를 주입해 호출). 본 task 는 helper 의 self-contained 단위 + module 등록까지만.
- **LlmGateway decrypt wire (LLM 호출 직전 복호화)** — Follow-up #4 ([ADR-0014 chain](../decisions/ADR-0014-llm-api-key-encryption-at-rest.md) "LlmGateway 복호화 wire" row).
- **새 dependency 추가 / `pnpm add`** — Node 내장 `node:crypto` 만. 외부 crypto 라이브러리 도입 금지.
- **키 rotation batch / key version prefix** — ADR-0014 §2 상 후속 KMS 전환 ADR 책임. 본 task 는 manual single-key 만.

## Suggested Sub-agents

`implementer → tester` (architect 불요 — ADR-0014 가 이미 모든 결정 박제. implementer 가 ADR Decision §1/§2 를 그대로 구현).

## Follow-ups

본 helper 머지 후 milestone-2 (config write CRUD) 나머지 chain ([ADR-0014 §"후속 task chain"](../decisions/ADR-0014-llm-api-key-encryption-at-rest.md) 정합) — planner 가 순차 큐잉:

- **#1 (다음 task)**: schema migration — `LlmProviderConfig.apiKey` 평문 String → ciphertext form 전환 (`prisma/schema.prisma` + `prisma migrate`). **[CLAUDE.md §5](../../CLAUDE.md) schema-migration BLOCKED 게이트 대상** — Q-0013 제약상 별도 사람 확인 필요할 수 있음. dev row 0 / seed 평문 부재면 단순 transform 가능 ([ADR-0014 §4](../decisions/ADR-0014-llm-api-key-encryption-at-rest.md)).
- **#2**: config write CRUD endpoint — POST/PATCH/DELETE `/api/llm/providers` + CreateLlmProviderConfigDto / UpdateLlmProviderConfigDto (colocated spec `src/llm/dto/*.spec.ts`) + service write slice (본 helper 주입해 encrypt 후 영속) + controller (Admin+ RBAC, 기존 GET endpoint mirror) + write-only / never-read-back invariant 강제 (PATCH 시 apiKey 부재 = 기존 키 유지). cap 초과 예상 → service+DTO / controller 2 task 로 split 가능.
- **#3**: api.md doc-sync — §5 LLM endpoint 표에 POST/PATCH/DELETE 추가 (direct).
- (implementer/tester 가 작업 중 발견한 추가 follow-up 은 여기에 append.)
