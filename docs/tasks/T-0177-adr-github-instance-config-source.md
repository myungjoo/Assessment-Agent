---
id: T-0177
title: ADR-0017 — GithubModule instance sub-config source (env 기반) 결정 박제
phase: P4
status: DONE
commitMode: pr
coversReq: [REQ-005, REQ-006, REQ-007, REQ-008, REQ-044]
estimatedDiff: 130
estimatedFiles: 3
created: 2026-06-03
completedAt: 2026-06-03T00:42:46+09:00
prNumber: 161
mergeCommit: 014ba12
reviewRounds: 1
plannerNote: P4 milestone-3 — ADR-0016 §2 가 deferred 한 instance sub-config source(env vs DB) 결정. GithubModule wiring + token JIT decrypt 의 공통 선행. ADR-first split.
---

# T-0177 — ADR-0017: GithubModule instance sub-config source (env 기반) 결정 박제

## Why

[ADR-0016 §2](../decisions/ADR-0016-github-adapter-http-transport-contract.md) 는 GithubAdapter 의 transport 계약(host 라우팅 / auth header / 도메인 매핑 / Link pagination)을 확정했으나, **instance 별 sub-config (host / org / token) 의 실 설정 source 형태 (env vs DB config) 는 "GithubAdapter 코드 task 책임" 으로 명시적으로 deferred** 했다. 이 결정은 GithubModule (`github.module.ts`) NestJS wiring 과 token JIT decrypt ([ADR-0016 §6](../decisions/ADR-0016-github-adapter-http-transport-contract.md)) 의 **공통 선행** 이다 — config source 가 정해지지 않으면 두 후속 slice 모두 inline 으로 architecture 결정을 끌어들이게 되어 reviewer-risk + diff 비대화. [CLAUDE.md §1](../../CLAUDE.md) "코드보다 ADR이 먼저다" + [§3.1 rule 4](../../CLAUDE.md) (새 ADR = pr-mode) 정합으로, 본 ADR 이 그 결정을 단독 박제한다 ([PLAN.md L81](../PLAN.md) "각 instance 의 URL·org·token 설정 분리" 의 직접 구현 경로). milestone-1 의 [ADR-0015](../decisions/ADR-0015-llm-live-integration-test-contract.md) / milestone-3 의 [ADR-0016](../decisions/ADR-0016-github-adapter-http-transport-contract.md) 이 코드보다 먼저 결정을 박제한 ADR-first 패턴을 mirror 한다.

## Required Reading

- [docs/decisions/ADR-0016-github-adapter-http-transport-contract.md](../decisions/ADR-0016-github-adapter-http-transport-contract.md) — §2 (instance key sub-config 분리 + "설정 형태 env/DB 는 코드 task 책임" deferred 문구) / §6 (token JIT decrypt 위상 + ADR-0014 cipher 재사용) / "후속 task chain" 표 (GithubAdapter scaffold / PermissionDeniedRecord entity row).
- [docs/decisions/ADR-0014-llm-api-key-encryption-at-rest.md](../decisions/ADR-0014-llm-api-key-encryption-at-rest.md) — §1 AES-256-GCM envelope / §3 never-read-back. token-at-rest 와 본 config source 의 관계 박제 시 참조.
- [src/llm/llm-apikey-cipher.service.ts](../../src/llm/llm-apikey-cipher.service.ts) — `process.env[ENC_KEY_ENV]` 직접 read 패턴 (env-as-config-source 의 기존 선례).
- [src/auth/auth.module.ts](../../src/auth/auth.module.ts) — `process.env.AUTH_JWT_SECRET ?? ""` useFactory 패턴 + env 검증 layer 주석 (NestJS module 이 env 를 config source 로 쓰는 기존 선례).
- [docs/architecture/modules.md](../architecture/modules.md) — GithubModule row ("단일 module + instance sub-config", adapter leaf, 3 instance host) — 본 ADR pointer 1 줄 추가 대상.
- [docs/architecture/INDEX.md](../architecture/INDEX.md) — ADR 목록 row 추가 대상 (ADR-0017).
- [docs/decisions/ADR-0013-confluence-space-traversal-policy.md](../decisions/ADR-0013-confluence-space-traversal-policy.md) — ADR template / HITL 경계 단락 / Alternatives 표 형식 mirror 참조 (본문 read 불요 — 형식만).

## Acceptance Criteria

체크리스트 — 각 항목은 파일 inspect 또는 명령으로 검증 가능해야 한다.

- [ ] `docs/decisions/ADR-0017-github-instance-config-source.md` 신설. frontmatter (`id: ADR-0017`, `status: PROPOSED`, `date: 2026-06-03`, `relatedTask: T-0177`, `supersedes: null`) + ADR-0013/0016 동형 섹션 구조 (Context / Decision / Consequences / Alternatives considered / References).
- [ ] **Context** — ADR-0016 §2 가 deferred 한 config-source 결정임을 명시 + GithubModule wiring / token JIT decrypt 의 공통 선행 위상 + REQ-005~008/REQ-044 외력 + milestone-1 ADR-first 패턴 정합 박제.
- [ ] **Decision** — 다음 결정을 박제 (architect 가 env-기반을 채택하되 근거 명시):
  - [ ] **config source = env 기반** — instance sub-config (host / org / encrypted token) 를 `process.env` 에서 읽는다 (기존 `AUTH_JWT_SECRET` / `ENC_KEY_ENV` 선례 mirror, 새 `@nestjs/config` dependency 0). DB config 미채택 (Alternatives 에서 schema 게이트 회피 근거).
  - [ ] **env 변수 형태 박제 (실값 0, 이름/shape 만 — [CLAUDE.md §9](../../CLAUDE.md))** — 3 instance 의 (host / org / token) 를 어떤 env 키 convention 으로 분리하는지 결정 (예: per-instance 접두 `GITHUB_SEC_*` / `GITHUB_ECODE_*` / `GITHUB_PUBLIC_*` 형태 vs 단일 JSON env — architect 가 택일 + 근거). 구체 env 키 **이름** 만 박제하고 token **실값** 은 절대 기재 금지.
  - [ ] **instance key 라우팅 / 자동 발견 안 함** — ADR-0016 §2 의 "설정으로 주어진 instance key 집합만 순회" 와 정합 (env 에 정의된 instance 만 활성).
  - [ ] **token-at-rest 관계** — env 에 실리는 token 이 ADR-0014 cipher 로 encrypted-at-rest 인지(JIT decrypt) vs env 평문 직접 주입인지의 위상을 ADR-0016 §6 / ADR-0014 §3 와 정합하게 박제 (live-run 시 실 token 주입 경로는 §5 게이트로 deferred 명시).
  - [ ] **parsing / validation 경계** — env → instance sub-config 객체로의 변환을 순수 함수 (unit-testable, 부수효과 0) 로 둔다는 경계 박제 ([llm-live-test-gating.ts](../../src/llm/llm-live-test-gating.ts) 의 env map 파싱 패턴 mirror). 실 parser 코드는 본 ADR scope 외 (후속 wiring code task).
- [ ] **Consequences** — 양/음 trade-off 박제 (env 채택의 dependency-free / schema 게이트 회피 positive + env multi-field 관리 부담 / boot 시 검증 layer 필요 negative). "후속 task chain" 표에 GithubModule wiring code task + token JIT decrypt code task 가 본 ADR 머지 후 진입함을 박제 + 각 BLOCKED risk 명시 (wiring = 없음 / live-run = §5 credential 게이트).
- [ ] **Alternatives considered** — 표 형식. 최소: (1) env 기반 (채택), (2) DB config entity (**schema 게이트 → §5 + migration 부담** 으로 기각), (3) `@nestjs/config` package 도입 (**새 dependency → §5 BLOCKED** 으로 기각) — 각 장점/단점/채택 여부.
- [ ] **References** — ADR-0016 / ADR-0014 / ADR-0013 / modules.md / PLAN.md L81 / requirements.md REQ-005~008/REQ-044 / CLAUDE.md §1·§3.1·§5·§9 링크.
- [ ] `docs/architecture/INDEX.md` 에 ADR-0017 row 1 줄 추가.
- [ ] `docs/architecture/modules.md` 의 GithubModule row (또는 인접 위치) 에 ADR-0017 pointer 1 줄 추가 (instance sub-config source = env 결정 링크).
- [ ] **token / secret 실값 0 기재** ([CLAUDE.md §9](../../CLAUDE.md)) — 어떤 GitHub token 실값도 ADR / doc 에 기재하지 않는다 (env 키 이름 / header 형태만). grep 으로 sentinel 부재 확인.
- [ ] `pnpm lint && pnpm build && pnpm test` green — 본 task 는 doc-only (production code 0 LOC) 이나 R-110 정합으로 tester 가 lint/build/test 무손상 확인 (코드 0 변경이므로 회귀 0 이어야 함).
- [ ] CI 의 unit + smoke + e2e 전부 green (doc-only 변경이므로 회귀 0 / 실 token 0 / 실 네트워크 0 → [§5](../../CLAUDE.md) 미발화).

분기 없음 (doc-only ADR) — R-112 happy/error/branch/negative unit test 항목은 production code 가 없어 적용 대상 0. tester 는 기존 suite 무손상 + lint/build green 만 확인 (신규 spec 추가 0).

## Out of Scope

본 task 는 **건드리지 않는다** (Follow-up 으로 분리 — ADR-first, 결정만 박제):

- **GithubModule (`github.module.ts`) NestJS wiring** + AppModule 등록 — 본 ADR 머지 후 별도 code task. 본 task 는 결정 doc 만.
- **instance sub-config parser 실 코드** (env → config 객체 변환 함수) — 본 ADR 이 경계만 박제, 실 parser 는 후속 wiring code task.
- **token JIT decrypt 실 코드** (ADR-0014 cipher 호출) — 후속 code task. 본 ADR 은 token-at-rest 관계 위상만 박제.
- **PermissionDeniedRecord entity schema / persistence** — 별도 entity task (DB schema → §5 게이트).
- **실 GitHub token (3 host variant) env/secret 주입 + live smoke** — 후속 live-run task 의 [§5](../../CLAUDE.md) credential 게이트.
- **ADR-0016 PROPOSED → ACCEPTED 전이** — scaffold 머지 후 별도 direct 한 줄 갱신 (본 ADR 과 무관).
- **`@nestjs/config` 또는 dotenv 등 새 package 추가** — env 는 `process.env` 직접 read (기존 선례) 로 충족, 새 dependency 0.

## Suggested Sub-agents

`architect → tester`. **architect 필요 (y)** — config source (env vs DB vs config-package) 선택 + env 변수 shape convention + token-at-rest 위상은 새 architecture 결정이라 ADR 박제 대상이다 (ADR-0016 §2 가 명시적으로 deferred). architect 가 ADR-0017 doc + INDEX/modules.md pointer 를 작성하고, tester 가 doc-only 변경의 lint/build/test 무손상 (+ secret sentinel 부재) 을 확인한다. implementer 불요 (production code 0 LOC).

## Follow-ups

(비어 있음 — sub-agent 가 관련 작업 발견 시 append)
