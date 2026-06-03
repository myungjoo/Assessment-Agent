---
id: T-0207
title: ADR-0022 박제 — PermissionDeniedRecord 데이터 모델·영속화 설계 (권한 거부 이벤트 영속화)
phase: P4
status: DONE
completedAt: 2026-06-04T00:31:00+09:00
mergedAs: 7477cdb
prNumber: 181
reviewRounds: 2
commitMode: pr
coversReq: [REQ-044]
hqOrigin: Q-0019
hqNote: Q-0019 PermissionDeniedRecord DB migration 승인(§5 DB schema 게이트 OPEN) — ADR-first 첫 slice. 데이터 모델·영속화 설계만 박제, prisma schema/migration/repo/service/wiring/test 은 후속 task.
estimatedDiff: 200
estimatedFiles: 2
estimatedFilesNote: 새 ADR-0022 1 파일 + docs/architecture/INDEX.md 1-row 추가 (doc-only enumerated-section new-ADR — milestone-3 ADR-0021/T-0203 패턴 mirror).
created: 2026-06-04
plannerNote: P4 PermissionDeniedRecord milestone — ADR-0022 only (데이터 모델·영속화 설계). prisma schema/migration/repo/service/wiring/test 은 후속 chain. doc-only new-ADR.
---

# T-0207 — ADR-0022 박제: PermissionDeniedRecord 데이터 모델·영속화 설계

## Why

P4 의 GitHub / Confluence adapter 는 non-2xx(401/403/권한 비가시 404) 를 만나면 `PermissionDeniedEvent`(host / path / status 만 담는 in-memory 이벤트, `src/github/github-adapter.service.ts` L202~209)를 `PermissionDeniedEmitter` port 로 흘려보내지만, 그 이벤트를 **영속화하는 실 entity 는 아직 없다** — `NO_OP_PERMISSION_DENIED_EMITTER`(L221)가 부수효과 없이 swallow 하고, `prisma/schema.prisma` 헤더(L39~41)는 `PermissionDeniedRecord` 를 명시적으로 후속 task 의 Out of Scope 로 deferred 했다. 사용자가 session #51(Q-0019)에서 PermissionDeniedRecord DB migration 을 승인(§5 DB schema 게이트 OPEN, 외부 credential 0)했으므로, milestone-3 이 [ADR-0021](../decisions/ADR-0021-github-confluence-live-integration-test-contract.md)(T-0203)을 코드보다 먼저 박제한 ADR-first 패턴을 mirror 해 **PermissionDeniedRecord 의 데이터 모델 + 영속화 설계를 단일 ADR-0022 로 선행 박제**한다. 이렇게 하면 (i) reviewer 가 prisma schema 변경 전에 데이터 모델·영속화 경계를 점검하고, (ii) 후속 prisma schema + migration / repository / service / wiring / test slice 가 본 ADR 을 단일 source 로 mirror 하며, (iii) REQ-044(instance 별 권한 분리·권한 거부 가시화)의 영속화 측 계약이 코드보다 ADR 에 먼저 외화된다.

## Required Reading

- `docs/STATE.json` — `humanQuestions[Q-0019]` decision(PermissionDeniedRecord DB migration 승인 + 제약: 외부 credential 0 / CI 실 PostgreSQL ADR-0004 / ADR-0004 migrate-deploy 패턴 준수 / R-112 4종 + negative + regression).
- `src/github/github-adapter.service.ts` (L198~225) — `PermissionDeniedEvent` interface(host / path / status) + `PermissionDeniedEmitter` port + `NO_OP_PERMISSION_DENIED_EMITTER`. **영속화 record 가 mirror 할 이벤트 shape 의 single source** — token 평문 절대 미포함(§9) invariant 포함.
- `src/confluence/confluence-adapter.service.ts` — Confluence 측 동일 `PermissionDeniedEmitter` / `PermissionDeniedEvent` 재export(adapter 양측이 같은 port 를 공유함을 확인 — record 가 두 adapter 의 이벤트를 동형으로 수용해야 함).
- `prisma/schema.prisma` (헤더 L1~41 + 기존 model 6+종) — 박제된 prisma 컨벤션: `id String @id @default(cuid())`, `createdAt DateTime @default(now())`, enum-as-String literal(`service`/`role`/`provider`/`period` 패턴), `@@unique` / `@@index` 사용 관례, immutable entity 의 `updatedAt` 미정의 관례(Assessment / Contribution / Summary). PermissionDeniedRecord 의 컬럼·index·관계 설계가 이 컨벤션을 따라야 한다.
- `docs/decisions/ADR-0004-smoke-e2e-db-mode.md` (Context + Decision 앞부분) — CI 실 PostgreSQL + `prisma migrate deploy` 패턴. ADR-0022 의 migration 절(후속 task 가 따를 절차)이 이 패턴을 mirror 하도록 reference.
- `docs/decisions/ADR-0021-github-confluence-live-integration-test-contract.md` (frontmatter + Context + Decision §구조 + Consequences + 후속 task chain) — **본 ADR-0022 가 mirror 할 ADR-first TEMPLATE**(Decision 을 §1~§N enumerated section 으로, Consequences, Alternatives, 후속 task chain 구조).
- `docs/tasks/T-0203-github-confluence-live-integration-test-contract.md` (frontmatter + Why + Acceptance Criteria) — 동형 ADR-only task 의 검증 항목 형태 reference.
- `docs/architecture/INDEX.md` (L38~42 ADR row 들) — 새 ADR-0022 row 를 추가할 정확한 위치·포맷(`| [ADR-NNNN](...) <제목 + 핵심 결정 요약> | modules.md (<module>) | <status (T-NNNN)> |`).

## Acceptance Criteria

- [ ] `docs/decisions/ADR-0022-permission-denied-record-data-model.md` 신설 — frontmatter(`id: ADR-0022`, `title`, `status: PROPOSED` 또는 `ACCEPTED (2026-06-04)`, `date`, `relatedTask: T-0207`, `supersedes: null`) + 본문(한국어, §12).
- [ ] ADR 본문이 다음 결정 축을 enumerated section(§1~§N)으로 **모두** 박제(설계 결정만 — 코드/구현 금지):
  - [ ] **필드(데이터 모델)** — record 가 보유할 컬럼: 어느 adapter/host variant(예: github.sec.samsung.net / confluence.sec.samsung.net)인지, resource ref(path / resource 식별자), principal(권한 거부의 주체 — 가능/불가 여부 명시), http status / reason(401 / 403 / 권한 비가시 404), timestamp(`createdAt`). **token 평문·secret 미포함 invariant(§9)** 를 schema 차원에서 명시.
  - [ ] **무엇을 / 언제 영속화** — `PermissionDeniedEvent` emit 시점에 1 row 박제하는지, 어느 host/status 집합을 record 대상으로 삼는지(adapter 의 emit 경계와 정합).
  - [ ] **retention / idempotency** — 보존 기간 정책(영구 vs TTL — 결정 + 사유) + 중복 이벤트(동일 host/path/status 반복)의 idempotency 처리(매 emit 새 row vs upsert/dedup — 결정 + 사유). `@@unique` / `@@index` 사용 여부를 prisma 컨벤션 위에서 결정.
  - [ ] **query path / indexing** — 조회 경로(host 별 / 기간 별 / status 별 audit 조회)와 그에 대응하는 `@@index` 후보(기존 Assessment/Summary 의 `@@index` 패턴 정합).
  - [ ] **기존 prisma model 과의 관계** — Person / User / ServiceIdentity 등과 relation 을 맺는지 vs standalone(독립) entity 인지 결정 + 사유(cascade 정책 포함 또는 relation 부재 명시).
  - [ ] **adapter 이벤트 → 영속화 흐름** — `PermissionDeniedEvent` 가 영속화로 흐르는 경로의 **설계 결정**: service 직접 호출 vs event emitter 패턴(`PermissionDeniedEmitter` port 를 영속화 어댑터로 구현). **결정만, 구현 금지.**
- [ ] ADR 가 ADR-0004 migrate-deploy 패턴(후속 migration task 가 따를 절차)을 reference 로 한 줄 이상 언급.
- [ ] ADR Consequences / Alternatives 절 박제(후속 chain·trade-off — 예: standalone vs relation, 영구 보존 vs TTL).
- [ ] ADR 끝에 **후속 task chain** 절 박제 — prisma schema + migration / repository / service / wiring / R-112 test 를 별도 후속 task 로 나열(본 task 에서 큐잉하지 않음 — Follow-ups 와 정합).
- [ ] `docs/architecture/INDEX.md` 에 ADR-0022 1-row 추가(L38~42 ADR 블록 끝, 기존 row 포맷 정확히 일치).
- [ ] (R-110) `commitMode: pr` 이므로 production code 변경이 0 LOC 이어도 tester 가 `pnpm lint && pnpm build && pnpm test` 를 실행해 green 을 확인. **본 task 는 production symbol 추가 0(새 ADR + INDEX row 뿐)이므로 신규 unit spec 불요** — tester / reviewer 가 "spec 누락" 으로 flag 하지 않도록 PR 본문에 "ADR-only, production symbol 0 → R-112 신규 spec N/A" 명시.
- [ ] §12 언어 정책 준수 — ADR 본문/제목 한국어, 식별자·경로·status 토큰·HTTP status 이름은 영어 유지.

## Out of Scope

- `prisma/schema.prisma` 에 `PermissionDeniedRecord` model 추가 — **후속 task**(본 ADR 이 설계만 박제).
- prisma migration 생성/적용(`prisma migrate`) — **후속 task**.
- repository / service / persistence emitter 구현 코드 — **후속 task**.
- `NO_OP_PERMISSION_DENIED_EMITTER` 를 실 영속화 emitter 로 교체하는 wiring — **후속 task**.
- R-112 unit / regression test 작성 — production symbol 추가가 0 이므로 본 task 엔 신규 spec 없음(후속 구현 task 가 R-112 4종 + negative + regression 책임).
- milestone-1(credentialed live LLM run) / milestone-3(GitHub·Confluence live token run) 관련 작업 — 별개 §5 미승인 게이트.
- 본 task 에서 후속 prisma/repo/service/wiring/test task 를 큐잉(planner 1-task 원칙 — Follow-ups 에 나열만).

## Suggested Sub-agents

`architect → tester` — architect 가 ADR-0022 + INDEX row 를 작성(데이터 모델·영속화 설계 결정), tester 가 R-110 `pnpm lint && pnpm build && pnpm test` green 확인(신규 spec 불요 — production symbol 0).

## Follow-ups

(생성 시 비어있음. sub-agent 가 관련 작업을 발견하면 여기 append. 본 ADR 이 박제할 후속 chain 후보 — planner 가 이후 별도 task 로 큐잉:)
- (후속) `prisma/schema.prisma` 에 `PermissionDeniedRecord` model 추가(ADR-0022 §필드 결정 mirror) + prisma migration 생성.
- (후속) `PermissionDeniedRecord` repository + service(영속화 경로) 구현 + R-112 4종 + negative + regression test.
- (후속) `NO_OP_PERMISSION_DENIED_EMITTER` → 실 영속화 emitter wiring(GithubModule / ConfluenceModule).
