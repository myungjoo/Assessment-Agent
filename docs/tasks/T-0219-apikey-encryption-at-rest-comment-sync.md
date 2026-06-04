---
id: T-0219
title: LlmProviderConfig.apiKey 평문 placeholder 주석 정합 (encryption-at-rest 완결 반영)
phase: P4
status: IN_PROGRESS
commitMode: pr
prNumber: 191
coversReq: [REQ-049, REQ-058]
estimatedDiff: 6
estimatedFiles: 1
created: 2026-06-04
plannerNote: P4 stale-comment 정합 — schema.prisma L311-312 가 apiKey '평문 placeholder/암호화 0' 라 주장하나 main 은 ADR-0014 AES-256-GCM write-encrypt+JIT-decrypt 완결. comment-only pr.
---

# T-0219 — LlmProviderConfig.apiKey 평문 placeholder 주석 정합 (encryption-at-rest 완결 반영)

## Why

`prisma/schema.prisma` 의 `LlmProviderConfig` model 컬럼 결정 주석(L311~312)은 현재 다음과 같이 박제돼 있다:

```
//   - apiKey 는 평문 String — encryption-at-rest 는 ADR-0006 follow-up 책임. 본
//     task 는 secret 처리 코드 0, 암호화 0 (apiKey 컬럼은 평문 저장 placeholder).
```

이 주석은 **scaffold 시점(T-0135, PR #131)** 에 박제된 이후 갱신되지 않았는데, 그 사이 main 에서 encryption-at-rest 가 **완결됐다** — 따라서 주석이 secret-handling invariant 에 대해 **정면으로 틀린(misleading) 상태**다. 실제 main 코드:

- **write-encrypt 완결** — `src/llm/llm-provider-config.service.ts` 의 `create`(L159 `this.cipher.encrypt(dto.apiKey)`) / `update`(L221 `data.apiKey = this.cipher.encrypt(dto.apiKey)`) 가 평문 apiKey 를 AES-256-GCM envelope ciphertext 로 변환한 뒤 `repository.create/update` 로 영속(ADR-0014 §1). 평문 apiKey 는 DB 에 닿지 않는다.
- **JIT-decrypt 완결** — `src/llm/llm-http-gateway.service.ts` L143 `this.cipher.decrypt(config.apiKey)` 가 LLM 호출 시점에만 평문화(ADR-0014 §3 never-read-back path 와 분리).
- **never-read-back 완결** — 동 service 의 `sanitize`(L93~102, `LlmProviderConfigView = Omit<LlmProviderConfig, "apiKey">`)가 GET 응답에서 apiKey 를 타입 레벨로 배제.

즉 컬럼은 **AES-256-GCM ciphertext 를 at-rest 로 저장**하며, 그 정책 권위는 **ADR-0006 이 아니라 ADR-0014**(`docs/decisions/ADR-0014-llm-api-key-encryption-at-rest.md`, ACCEPTED)다. 현 주석을 읽는 개발자는 "API key 가 평문 저장 placeholder" 라고 잘못 결론내려 secret-handling 보안 invariant 를 오인하게 된다. 이는 cosmetic churn 이 아니라 보안 민감 컬럼의 **틀린 사실 정정**이다. PLAN.md P4 L90("LLM provider apiKey encryption-at-rest 완결") bullet 의 잔여분도 본 주석 정합 한 줄뿐(기능 work 는 이미 shipped). 순수 comment-only — 동작 변경 0, 새 dependency 0, schema 컬럼 타입 변경 0(→ `prisma migrate diff` 결과 migration 0), auth 모델 0 (§5 미발화).

## Required Reading

- `prisma/schema.prisma` — `LlmProviderConfig` model(L301~333). 변경 대상은 L311~312 의 `apiKey` 컬럼 결정 주석 2 줄뿐. `apiKey String`(L325) 컬럼 타입·`@id`·relation 등 schema 본체는 손대지 않는다.
- `src/llm/llm-provider-config.service.ts` — `create`(L148~171) / `update`(L195~238) 의 `cipher.encrypt` 호출 + `sanitize`(L93~102) never-read-back. 주석 문구의 사실 근거 reference (변경 대상 아님).
- `src/llm/llm-http-gateway.service.ts` — L143 `cipher.decrypt(config.apiKey)` JIT-decrypt. reference (변경 대상 아님).
- `docs/decisions/ADR-0014-llm-api-key-encryption-at-rest.md` — 정정 주석이 가리킬 정확한 ADR 권위(§1 write-encrypt / §3 never-read-back). reference.

## Acceptance Criteria

- [ ] `prisma/schema.prisma` L311~312 의 `apiKey 는 평문 String … 평문 저장 placeholder` 주석을 현 main reality 로 정정한다. 정정 후 주석은 (1) apiKey 가 **ADR-0014 AES-256-GCM envelope ciphertext 로 encryption-at-rest 저장**됨, (2) write 경로(`LlmProviderConfigService.create/update`)가 `LlmApiKeyCipher.encrypt` 로 암호화 후 영속, (3) read 경로는 `sanitize`(Omit apiKey)로 never-read-back, gateway 가 JIT `decrypt` 함을 명시하고, (4) 잘못된 권위 표기 `ADR-0006 follow-up` 을 `ADR-0014` 로 교체한다. `String` 컬럼 타입 자체는 ciphertext 도 문자열이라 정합(타입 변경 0).
- [ ] 정정 후 `git grep -n "평문 저장 placeholder\|평문 String" -- "prisma/schema.prisma"` 결과 0 건(stale 문구 잔여 없음).
- [ ] 정정 후 `git grep -n "ADR-0006 follow-up" -- "prisma/schema.prisma"` 결과 0 건(틀린 ADR 권위 표기 잔여 없음 — 단 schema 의 다른 ADR-0006 정상 참조(Assessment/Contribution/Summary 등)는 건드리지 않음. 본 grep 은 apiKey 주석의 `ADR-0006 follow-up` 표현만 대상이며, 만약 schema 내 다른 위치에 `ADR-0006 follow-up` 정당 표기가 있으면 본 항목은 apiKey 주석 줄로 한정해 재해석).
- [ ] 본 task 는 **주석(comment) 외 schema 본체·컬럼·SQL·코드·동작 변경 0** — `apiKey String` 컬럼 정의 / `LlmProviderConfig` model body / 다른 model / migration 디렉토리 어떤 것도 수정하지 않는다. diff 는 주석 텍스트뿐.
- [ ] `prisma migrate diff`(또는 `prisma format` 후 git diff) 가 schema 본체 변경 0 임을 확인 — 주석만 바뀌어 새 migration 이 필요 없음을 보증(migration 파일 신규 생성 금지).
- [ ] **happy-path / error-path / branch / negative 신규 test 항목 없음** — 본 task 는 production public symbol 추가/수정이 0 인 comment-only(schema 주석) 변경이라 R-112 신규 test 4 종은 적용 대상 없음(분기 없음 — 이 항목 생략). 단 R-110 에 따라 tester 가 `pnpm lint && pnpm build && pnpm test` 를 실행해 기존 spec(특히 `llm-provider-config.service.spec.ts` encrypt/redact test, `llm-http-gateway.service.spec.ts` decrypt test)이 여전히 green 임을 확인(주석 변경이 prisma generate/compile/test 를 깨지 않음 보증).
- [ ] `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%) — 주석 변경은 coverage 수치에 영향 0 이나 CI gate 통과 확인.

## Out of Scope

- `apiKey` 컬럼 타입 변경(예: `String` → 별도 ciphertext 구조체 / 길이 제약 추가) — 본 task 는 주석 정정만, 타입·제약 변경 0.
- write CRUD / gateway 의 encrypt·decrypt 로직 수정 (이미 ADR-0014 로 완결 — 손대지 않음).
- `prisma/migrations/` 신규 migration 생성 (주석 변경은 migration 불요).
- PLAN.md L90 bullet `[x]` flip 또는 다른 doc 의 doc-sync — 별도 direct doc-sync 로 분리(Follow-up). 본 task 는 schema.prisma 주석 1 곳만(pr-mode, schema.prisma 가 pr-mode 파일이라 mixed-commit 금지: PLAN flip 은 direct 이므로 한 task 에 섞지 않는다).
- non-Admin own-instance 실 필터 / User↔instance binding schema (§5 미승인 게이트 — 본 task 무관).

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

- (planner 후보) PLAN.md P4 L90("LLM provider apiKey encryption-at-rest 완결") bullet 의 `[ ]` → `[x]` flip + 본문에 "write-encrypt(T-0149/T-0151) + JIT-decrypt(T-0158) + never-read-back(sanitize) + schema 주석 정합(T-0219) 으로 완결" 박제. **direct doc-sync** 라 본 pr task 와 별도 task. 단 PLAN L89(token CLI) bullet 도 main 에 `scripts/encrypt-token.ts` 로 shipped 됐는데 `[ ]` stale 이므로 같은 direct doc-sync task 에서 함께 flip 가능(묶음).
