# Assessment-Agent — Master Plan

> 이 파일은 planner sub-agent가 점진적으로 채우고 정련한다. 부트스트랩 시점에는 phase 골격만 존재한다.
> 자세한 단위 작업은 [docs/tasks/](tasks/) 의 T-NNNN 파일을 참조.
> 각 phase 의 bullet 은 [README.md](../README.md) 의 지시사항과 [docs/requirements.md](requirements.md) 의 REQ-NNN 매핑을 cover 해야 한다.
> 완료된 phase 의 본문은 [PLAN_archive.md](PLAN_archive.md) 로 분리 보관 — planner hot read 절감.

상태는 [STATE.json](STATE.json) 의 `phase` 필드와 동기화되어야 한다.

---

## Phase P0 — Bootstrap

**완료 (2026-05-24 00:34 KST)** — 자동 루프 골격 + main CI lint/build/test 검증. 본문은 [PLAN_archive.md](PLAN_archive.md#phase-p0--bootstrap) 참조.

---

## Phase P0.5 — Test·CI infra hardening (README 110-114 / §3.2 강제층)

**완료 (2026-05-24 19:02 KST)** — T-0007 spec-presence (+ T-0012 patch) / T-0008 coverage threshold 50% / T-0009 smoke / T-0010 e2e 모두 main 진입. CI 8 step 으로 R-110~R-114 multi-layer 강제. 본문은 [PLAN_archive.md](PLAN_archive.md#phase-p05--testci-infra-hardening-readme-110-114--§32-강제층) 참조.

---

## Phase P1 — Architecture (MVA)

**완료** — 4 architecture document (requirements.md kind 컬럼 / deployment.md / components.md / modules.md) 모두 main 진입 + ADR-0001 / ADR-0002 / ADR-0003 ACCEPTED. 본문은 [PLAN_archive.md](PLAN_archive.md#phase-p1--architecture-mva) 참조.

---

## Phase P2 — Use case decomposition

목표: README + P1 architecture 를 기반으로 각 use case 를 1 파일씩 분해. 이후 phase 들의 task 가 use case 를 cover 하는 형태로 진행.

- [x] Use case 발굴: README 각 섹션 → [docs/use-cases/](use-cases/) 의 `UC-NN-*.md`. 각 use case 는 actor (SuperAdmin / Admin / User / Scheduler / Reviewer Agent) / 트리거 / 흐름 / 데이터 / NFR (성능·보안) / 관련 REQ 명시. **P2-Entry 진행: [docs/use-cases/INDEX.md](use-cases/INDEX.md) 8 UC backbone 박제 완료 (T-0019, PR-18)**. UC-01 본문 분해 ([UC-01-evaluation-execution.md](use-cases/UC-01-evaluation-execution.md), T-0020) 완료. UC-02 본문 분해 ([UC-02-evaluation-query.md](use-cases/UC-02-evaluation-query.md), T-0022) 완료. UC-03 본문 분해 ([UC-03-person-crud.md](use-cases/UC-03-person-crud.md), T-0023) 완료. UC-04 본문 분해 ([UC-04-account-auth.md](use-cases/UC-04-account-auth.md), T-0024) 완료. UC-05 본문 분해 ([UC-05-llm-config.md](use-cases/UC-05-llm-config.md), T-0025) 완료. UC-06 본문 분해 ([UC-06-evaluation-delete-reeval.md](use-cases/UC-06-evaluation-delete-reeval.md), T-0026) 완료. UC-07 본문 분해 ([UC-07-export-import.md](use-cases/UC-07-export-import.md), T-0027) 완료. UC-08 본문 분해 ([UC-08-permission-denied.md](use-cases/UC-08-permission-denied.md), T-0028) 완료. **P2 UC 본문 분해 8/8 closure (UC-01 ~ UC-08, T-0020 ~ T-0028).**
- [x] 각 use case 가 P1 component view 의 어느 component 를 거치는지 매핑 (sequence diagram 또는 텍스트). UC-01 cover ([UC-01](use-cases/UC-01-evaluation-execution.md) §5 sequence + §9 component/module mapping). UC-02 cover ([UC-02](use-cases/UC-02-evaluation-query.md) §5 sequence + §9 component/module mapping). UC-03 cover ([UC-03](use-cases/UC-03-person-crud.md) §5 sequence + §9 component/module mapping). UC-04 cover ([UC-04](use-cases/UC-04-account-auth.md) §5 sequence + §9 component/module mapping). UC-05 cover ([UC-05](use-cases/UC-05-llm-config.md) §5 sequence + §9 component/module mapping). UC-06 cover ([UC-06](use-cases/UC-06-evaluation-delete-reeval.md) §5 sequence + §9 component/module mapping). UC-07 cover ([UC-07](use-cases/UC-07-export-import.md) §5 sequence + §9 component/module mapping). UC-08 cover ([UC-08](use-cases/UC-08-permission-denied.md) §5 sequence + §9 component/module mapping). **P2 UC 매핑 8/8 closure.**
- [x] **Use case 인벤토리 검증**: requirements.md 의 모든 functional REQ 가 1+ use case 로 cover 되는지 확인. 빠지면 use case 추가. **[REQ-COVERAGE-AUDIT.md](use-cases/REQ-COVERAGE-AUDIT.md) ([T-0029](tasks/T-0029-uc-inventory-audit.md)) 완료 — gap 1 건 (REQ-004 사용자 지정 기간 임의 평가문, UC-09 신설 또는 UC-01 확장 권장 — follow-up task T-0030+ 책임)**. uc-covered 48 / cross-cutting 4 / infrastructure 13 / gap 1 = 66.
- [x] **API contract 초안** — [docs/architecture/api.md](architecture/api.md). use case 흐름 기반으로 HTTP endpoint 목록. 구체 schema 는 P3 에서. **T-0030 으로 박제 완료 — [api.md](architecture/api.md) (8 UC × 약 35 endpoint × 9 resource prefix, MVA 수준 — METHOD/path/UC/description/auth tier 5 컬럼 표 + 표준 status code policy + UC §5 step cross-reference).**
- [x] **데이터 모델 초안** — [docs/architecture/data-model.md](architecture/data-model.md). 핵심 entity (Person / ServiceIdentity / Assessment / Contribution / Summary / Group / Part / LlmProviderConfig 등) 의 conceptual model. 테이블 컬럼은 P3. **T-0031 으로 박제 완료 — [data-model.md](architecture/data-model.md) (10 entity × 5 컬럼 표 + 10 관계 mermaid ER + raw 미저장 invariant § 4 + cross-cutting field § 5 + REQ coverage 20/20 § 6). 본 task 머지로 Phase P2 fully complete.**
- [x] **디렉토리 구조 정의** — [docs/architecture/directory.md](architecture/directory.md). NestJS 표준 + module view 와 mapping. T-0021 으로 박제 완료.

각 항목은 planner가 1~3개의 T-NNNN task로 분할한다. 모두 commitMode: direct 또는 pr (use case 는 doc → direct; api/data-model 은 ADR 동반 시 pr).

**Phase P2 fully complete** — T-0031 머지 시점. 5 entry artifact (UC backbone INDEX.md / 8 UC 본문 / api.md / data-model.md / directory.md) + REQ coverage audit 모두 박제. 다음 자연 phase 진입은 **P3 Domain core** (Persistence layer / Auth/RBAC / 인원 관리 / 평가 결과 저장 모델). P3 의 첫 task 는 planner 가 다음 호출에서 결정.

---

## Phase P3 — Domain core

목표: 외부 통합 없이 자체적으로 돌릴 수 있는 도메인 핵심.

**P3 entry document**: [p3-implementation-plan.md](architecture/p3-implementation-plan.md) ([T-0032](tasks/T-0032-p3-entry-implementation-plan.md)) — 10 bullet ↔ 약 8 T-NNNN task 시퀀스 (T-0033 ~ T-0040) 매핑 + 의존성 graph + ADR 후보 5 항목 + 인간 승인 게이트 (T-0033 `pnpm add prisma @prisma/client pg`).

- [ ] 평가 대상 인원 관리 (CRUD, group, deactivate/activate — 휴직 시 숨김)
- [ ] **서비스별 ID 매핑** — github.com / github.sec.samsung.net / github.ecodesamsung.com / confluence.sec.samsung.net 등 각 서비스의 ID 보유, 일부 NULL 허용 (R-48)
- [ ] **Primary key 역할 ID 지정** — 서비스 중 1개의 ID 를 기준 식별자로 (예: confluence.sec.samsung.net ID) (R-47)
- [ ] **Group 정책** — 한 인원은 임의 group 다중 소속 가능, 단 조직도 파트는 정확히 1개 (R-51)
- [ ] 평가 결과 저장 모델 (commit/document 단위, 일/주/월 요약)
- [ ] **🔥 Raw data 저장 금지 (R-59)** — code commit 본문·문서 변경 본문 등 raw 는 저장하지 않고 평가된 결과 (난이도/기여도/양/평가문) 만 보유. ADR-필수 항목.
- [ ] **상대 비교 가능 데이터 구조** — 개발자 간 동일 metric 비교가 가능한 형태 (R-63)
- [ ] Persistence layer (DB 는 ADR-0002 에서 이미 결정됨 — 본 phase 에서 구현)
- [ ] Auth/RBAC 모델 (SuperAdmin/Admin/User) — 첫 로그인 SuperAdmin 지정, Admin→User 변경은 SuperAdmin만, 본인 self-demote 금지 (R-84)
- [ ] User read-only 권한 범위 명시 — 조회·sort·filter 만 (R-86)
- [x] **[테스트 품질] unit branch coverage 완성** — `person.service.ts` L120 `update()` P2002 발생 시 `patch.email` 이 undefined 인 케이스 unit test 추가 (현재 branch 96.66% → 100% 목표). R-112 negative case 충분 cover 의무 이행. **(완료 — `src/user/person.service.spec.ts` L407~428 에 dedicated test 존재, branch 100% 도달. T-0153 doc-sync 확인.)**
- [x] **[테스트 품질] smoke test domain endpoint 확장** — 현재 smoke 가 `GET /` 만 커버. `/api/persons` CRUD (POST·GET·PATCH·DELETE) + 향후 Group/Part endpoint 에 대한 bootstrap smoke 추가. AppModule mock-DB 방식으로 실 DB 없이 supertest 실행. **(완료 — `test/smoke/{persons,groups,parts}.smoke-spec.ts` 등 domain smoke spec 존재, T-0043→T-0053 real DB cutover 로 진화. T-0153 doc-sync 확인.)**
- [x] **[테스트 품질] e2e test domain endpoint 확장** — 현재 e2e 가 `GET /` HTTP contract 만 검증. `/api/persons` 의 status code + response body shape (DTO contract) + 4xx error shape 를 e2e-spec 으로 커버. R-113 e2e 의무 이행. **(완료 — `test/e2e/` 에 persons/groups/parts/users/auth/assessments/contributions/summaries 등 9 e2e spec 존재. T-0153 doc-sync 확인.)**
- [x] **[테스트 품질] CI smoke/e2e real PostgreSQL 전환** — 현재 T-0043 smoke / T-0044 e2e 는 [test/helpers/prisma-mock.ts](../test/helpers/prisma-mock.ts) 의 PrismaService override 로 mock-DB 사용. 사용자 정책 변경 (2026-05-26): mock 이 아닌 real PostgreSQL 을 CI 안에서 직접 띄워서 통합 검증. 구현 방향: `.github/workflows/ci.yml` 에 `services: postgres:` container (또는 `apt install postgresql` + `pg_ctlcluster start`) + `DATABASE_URL` env var 셋업 + `pnpm prisma migrate deploy` step 추가 + smoke/e2e 가 real DB 에 query 발행하도록 PrismaService override 제거 (또는 mock 과 real 양쪽 mode 병행 — `TEST_DB_MODE` env var 분기). ADR 동반 — mock vs real 의 trade-off (CI 속도 vs 통합 정확도) 박제 + 선택 사유 + 후속 e2e cleanup (`afterEach` truncate) 정책. 본 task 후 mock-DB helper 의 위상 (unit-only 보조 vs deprecated) 도 결정. **[ADR-0004](decisions/ADR-0004-smoke-e2e-db-mode.md) 박제 완료 (T-0051) — 후속 T-0052 가 본 ADR 의 결정에 따라 .github/workflows/ci.yml services.postgres + DATABASE_URL env + migrate deploy step + smoke/e2e override 제거 + afterEach truncate helper 추가.**

### P3 → P4 전이 trigger

P3 진행 중 발견된 진척 status quo + P4 진입 trigger 의사결정 가능 형태를 별도 doc 으로 박제: [docs/architecture/p3-to-p4-transition.md](architecture/p3-to-p4-transition.md) (T-0063 doc-only direct).

- **현 status (T-0075 closure 시점, session #22 turn 1 refresh)**: entity 박제 layer-progress 5/11 → **8/11 (45% → 73%)** — Person / ServiceIdentity / Group (CRUD-U 4-layer fully closed) / Part (CRUD-U 4-layer fully closed) / PersonGroupMembership / module 2/5 유지 (PersistenceModule / UserModule) / ADR 1/4 유지 (ADR-0004 ACCEPTED) / test-quality 4/4 + 9-cell closure 유지 (backbone 3 도메인 × 3 layer, mock 시대 종결). Group + Part CRUD-U 4-layer 박제 milestone 추가 (T-0066+T-0067+T-0068 + T-0069+T-0071+T-0075).
- **권장 trigger option**: **(c) hybrid-parallel** — 핵심 backbone (User + AuthModule + ADR-0008 + Assessment + Contribution + Summary + ADR-0005 cross-cutting + raw 미저장 R-59 schema-level 강제) 완성 후 P4 진입. LlmProviderConfig + DifficultyMapping + PermissionDeniedRecord 는 P4 와 병행. ~9 task estimate (T-0063 박제 시점) → **~5~6 task** 로 축소 (T-0076 session #22 refresh, Group + Part CRUD-U 박제 후). 권장 강화 (선택 강제 안 함, 권장만 박제 — [p3-to-p4-transition.md §4.1](architecture/p3-to-p4-transition.md) 박제).
- **전이 시점의 실 의사결정은 다음 planner dispatch 또는 humanQuestion 발화의 책임** — 본 doc 은 trigger option (a) eager-transition / (b) strict-completion / (c) hybrid-parallel 의 trade-off 만 박제, T-0063 머지로 STATE.phase 변경 0 (P3-in-progress 유지).
- **binding decision (T-0133)**: option (c) hybrid-parallel 채택, STATE.phase P4-in-progress 전환 — entity 9/11 + module 3/5 + ADR 8 ACCEPTED + RBAC chain 3/3 완결 (T-0125/T-0132 closure) 후 위임된 binding-decision 박제. 박제 위치 [p3-to-p4-transition.md §7](architecture/p3-to-p4-transition.md). LlmProviderConfig / DifficultyMapping / PermissionDeniedRecord + ADR-0005 cross-cutting + ADR-0007 audit log 는 P4 와 병행 (본 task 머지 commit 이 전환 박제).

---

## Phase P4 — External integrations

- [x] GitHub 통합 — 3 instance 모두: **github.com / github.sec.samsung.net / github.ecodesamsung.com**. 각 instance 의 URL·org·token 설정 분리. **(완료)** — GithubModule 단일 GithubAdapter + instance-keyed config (`GITHUB_INSTANCES` + per-key `_HOST` / `_ORG` / `_TOKEN_ENC`) 박제 (ADR-0016 transport 계약 + ADR-0017 config source). 3 host variant (github.com / github.sec.samsung.net / github.ecodesamsung.com) 분리 + token JIT decrypt (ADR-0014) + 4xx → PermissionDeniedEvent emit.
- [ ] **GitHub Issue 평가** (R-30) — Repo 내 Issue 작성을 문서 기여로 평가. 단 **본인이 본인 follow-up 을 남기고 본인이 소비하는 경우 카운트 제외**.
- [x] Confluence 통합 — 지정 주소의 Confluence Service 내 **지정 SPACE들** 다중 관리. **(완료)** — ConfluenceModule 단일 ConfluenceAdapter + instance-keyed config (`CONFLUENCE_INSTANCES` + per-key `_BASE_URL` / `_AUTH_USER` / `_TOKEN_ENC` / `_SPACE_ALLOWLIST`) 박제 (ADR-0018 transport 계약 + ADR-0019 same-host auth restriction). 지정 SPACE 다중 관리는 per-instance allowlist env + ConfluenceSpaceTraversalService 의 allowlist 순회 로 박제 + token JIT decrypt (ADR-0014) + 4xx → PermissionDeniedEvent emit.
- [x] **Confluence SPACE 탐색 정책** (R-34) — Crawling 또는 page List/Hierarchy 기반 탐색 중 택. ADR 로 결정. **(완료)** — ADR-0013 ACCEPTED 가 셋 (crawling / page List / Hierarchy) 중 **page List 기반 allowlist 순회** 를 default 로 박제 (Crawling 미선택). multi-SPACE 경계 + 4xx skip-and-continue 정책 동반. ConfluenceSpaceTraversalService 가 per-instance `_SPACE_ALLOWLIST` env 의 allowlist 를 순회 + 4xx → PermissionDeniedEvent emit + 다음 SPACE 진행 으로 in-code 박제.
- [x] **LLM provider 추상화** — 5 provider: **custom (OpenAI 호환 / 내부 자체 서버 / proxy 가능 / 3 model 슬롯을 모두 custom 으로 채울 수도 있음)** / Azure OpenAI / Anthropic / Google Gemini / OpenAI (R-99~103) **(완료)** — 5 provider adapter (openai-compatible/azure_openai/anthropic/google_gemini) + LlmHttpGateway dispatch 머지. T-0157 (custom/openai) / T-0158 (routing) / T-0160 (anthropic) / T-0162 (gemini).
- [x] **3가지 난이도 모델 할당** (R-97) — 평가 항목별 난이도 분류 + 어떤 항목이 어떤 난이도 모델로 처리될지 구현 과정에서 결정. ADR 로 박제. **(완료)** — ADR-0011 (3 난이도 모델 할당) ACCEPTED + T-0165 PR-153 LlmHttpGateway 난이도 routing wiring + T-0166/T-0167 doc-sync.
- [x] **Admin 이 LLM 모델 지정** UI (R-96) **(backend 완결, UI 는 P6)** — GET /api/llm/providers (T-0140~T-0142) + POST/PATCH/DELETE (T-0149/T-0151/T-0150) + api.md (T-0152). UI 는 P6 frontend phase 잔여.
- [x] 자격증명 관리 + **권한 부족 감지·통지** (사용자 + 관리자 모두 인식 가능, R-20·33) **(완료)** — 권한 부족 감지·통지는 `src/permission-denied/` 의 PermissionDeniedRecord chain(controller/service/repository/module + GitHub·Confluence persisting emitter, ADR-0022 data-model + ADR-0023 audit RBAC)으로 adapter 4xx → `PermissionDeniedEvent` emit → 영속 → `GET /api/permission-denied-records`(`@Roles("User")`) 조회로 박제. R-33 "사용자 + 관리자 모두 인식 가능" 은 service-layer audience 차등(Admin 전체 / non-Admin binding-scoped)으로 충족. 자격증명 관리는 `src/user-instance-access/` 의 UserInstanceAccess binding(ADR-0024 data-model + ADR-0027 grant RBAC) + instance-keyed `_TOKEN_ENC` JIT decrypt(ADR-0014)로 박제.
- [x] **[credential-prep / 운영 공백] 토큰 암호화 CLI** — GitHub/Confluence env 의 `GITHUB_<KEY>_TOKEN_ENC` / `CONFLUENCE_<KEY>_TOKEN_ENC` 는 **암호화된 ciphertext** 를 요구하나, 평문 토큰 → ciphertext 변환 도구가 아직 없다. `src/llm/llm-apikey-cipher.service.ts`(LlmApiKeyCipher, ADR-0014)를 재사용하는 작은 CLI/script (예: `scripts/encrypt-token.ts` — stdin 평문 토큰 + `LLM_APIKEY_ENC_KEY` → base64 AES-256-GCM envelope 출력)로 박제. **사용자 GitHub/Confluence token 주입의 선행 조건**. dependency 0(Node 내장 crypto), 실 token·실 key 0(test 는 test key). 사용자 대화 결정(2026-06-03)으로 backlog 박제. **(완료)** — `scripts/encrypt-token.ts` (T-0206 박제) 가 LlmApiKeyCipher (ADR-0014 AES-256-GCM envelope) 를 재사용해 stdin 평문 토큰 + `LLM_APIKEY_ENC_KEY` env → base64 ciphertext envelope 출력 으로 박제. argv 경로 fallback + TTY 분기 + 평문 토큰·키 stdout/stderr echo 0 (§9 보안). colocated spec (`encrypt-token.spec.ts`) R-112 4 종 cover. 새 외부 dependency 0 (Node 내장 crypto).
- [x] **[credential-prep / 운영 공백] LLM provider apiKey encryption-at-rest 완결** — `POST/PATCH /api/llm/providers` write 입력 시 LlmApiKeyCipher(ADR-0014)로 `apiKey` 를 암호화 저장 + read never-back + JIT decrypt 배선을 완결했다. **DB schema migration 동반 가능 → §5 schema 게이트 그 task 진입 시 재확인**. 실 LLM key 주입의 선행 조건. 사용자 대화 결정(2026-06-03)으로 backlog 박제. **(완료)** — write 경로 `LlmProviderConfigService.create/update` 가 `LlmApiKeyCipher.encrypt`(AES-256-GCM envelope)로 ciphertext 영속(service line 159/221), read 경로는 `LlmProviderConfigView = Omit<…,"apiKey">` sanitize 로 never-read-back, `LlmHttpGatewayService` 가 LLM 호출 시점에만 `cipher.decrypt`(line 143)로 JIT 복호, `prisma/schema.prisma` 의 `apiKey` 컬럼도 ciphertext 주석(line 361~366)으로 amend 완료. 새 schema migration·외부 dependency 0(Node 내장 crypto).

---

## Phase P5 — Evaluation pipeline

- [ ] 단위 commit/document 평가 (난이도·기여도·양)
- [ ] 일/주/월 요약 평가 (LLM 정성 + Metric 수치). **당일 활동은 자정까지 평가 미실시** (R-61). 주간은 다음주 시작 시, 월간은 다음달 시작 시.
- [ ] **사용자 지정 기간** 임의 평가문 생성 (R-9) — Admin/User 가 임의 기간을 지정해 LLM 평가문 요청
- [ ] **중복 제거** — fork/rebase/meld 로 인한 중복 + **시간적 중복** (earlier date 우선 — 2월 결과물이 3월 timestamp 일 때 2월 기여로 판단, R-21)
- [ ] **재수집 정책** — 평가 자료 재수집 시 저장 부분 중복 방지. **최근 1주 는 재수집·중복 제거 OK** (data sync 보호, R-58)
- [ ] **Abusing 방지 metric** — 코드 abusing (commit/PR 숫자만 늘리기, R-26) + **문서 abusing** (의미 없는 기여 단순 반복, R-40)
- [ ] **문서 update 횟수 중립화** (R-41) — 습관적 중간 저장으로 update 횟수만 늘어나는 경우 advantage/disadvantage **둘 다 없어야**
- [ ] **품질 분류** (R-37·38) — 단순 보고·copy-paste 로그 = **zero-contribution** / 새 알고리즘 설계·외부 연구 도입 소개자료 = **높은 contribution**
- [ ] **"어렵고 남이 못할 일" 정성 평가** (R-25) — 중요한 기여 / 난이도 높은 기여 식별
- [ ] **저성과자 식별** (R-27) — 코드 기여 현격히 떨어지는 인원 식별
- [ ] 평가 재실행·부분 reset (R-64) — **(부분 완료)** Q-0045 옵션1 run-side 사슬이 `POST /api/assessment-evaluation/unevaluated-fill-run`(평가 없는 부분 일괄 평가, REQ-037)까지 닫혔다. chain T-0556~T-0570(순수 조각→`@Injectable` orchestrator(T-0564)→controller route(T-0565)→e2e(T-0566)→[ADR-0048](decisions/ADR-0048-default-model-id-source.md)(T-0567)→resolver(T-0568)→controller resolver wiring(T-0569)→request body `defaultModelId` 필드 제거(T-0570, PR #484 squash c2e7c0c 머지)). default modelId 의 source 가 server-side `LlmProviderConfigResolver`(단일-row 운용 가정, ADR-0048 §Decision 1)로 단일화돼 caller-free 로 닫혔다. **checkbox `[ ]` 유지** — 본 사슬은 R-64 의 "재실행·부분 reset" 중 unevaluated-fill-run(부분 재실행)만 cover 했고, overwrite/reset 잔여는 bullet 107(DEFERRED, Q-0032 first-write-wins 유지)이 별도. REQ-051(custom 3 model 슬롯) 진입 시 다중-row default 선택 정책은 [ADR-0048](decisions/ADR-0048-default-model-id-source.md) §Decision 2 후속 ADR 이 prerequisite(deferred).
- [ ] **(DEFERRED) overwrite / 이미 영속화된 평가문 재평가** (replace existing — ADR-0033 reeval/reset-and-recreate 경로) — Q-0032 결정으로 v1 은 first-write-wins read-through(ADR-0037 §Decision3), overwrite 는 별도 후속 ADR/task 로 plan 만
- [ ] **🔴 live-LLM bridge 검증 — 사용자 승인 (2026-06-11), ⏰ credential 만료 2026-06-30 전 실행 필수** — [ADR-0037](decisions/ADR-0037-period-collection-evaluate-bridge.md) §Decision5: 머지된 mocked-only bridge(POST /period)를 **실 네트워크 LLM 1회 round-trip** 으로 검증 — 평가문 품질·scoring·narrative 경로 확인. credential = Q-0022 와 동일 경로 재사용(로컬 `secrets.env` repo 밖, `AZURE_OPENAI_*` → `LLM_LIVE_*` 매핑, **만료 2026-06-30**). env-gated live spec(env 부재 시 skip → CI green), 새 외부 dependency 0, §9 실값 파일 금지. **§5 credential 게이트는 본 사용자 승인으로 충족** (Q-0034 권고 ③ 채택 — 사용자 conversation 결정). T-0333 (ADR-0038 chain) 과 독립 — chain 진행 중 병행 또는 직후 큐잉 가능. 만료일 임박 고려해 우선 처리 권장.
- [ ] **timezone = KST(Asia/Seoul) 확정 반영 — 사용자 결정 (2026-06-11)** — 그동안 deferred 였던 timezone 쟁점(Asia/Seoul vs UTC, Q-0034 context (5) 참조)을 사용자가 **KST(Asia/Seoul)** 로 확정. 적용 대상: P5 일/주/월 요약 경계(위 R-61 자정 룰의 "자정" = KST 자정), 주간/월간 시작 시점 판정, 사용자 지정 기간(R-9) 해석, 시각화 표시. 세부(저장은 UTC timestamptz 유지 + 경계 계산·표시만 KST 등 표준 패턴)는 구현 진입 시 **ADR 로 박제** — 본 bullet 은 사용자 결정의 박제이며 ADR-first 로 처리. 새 dependency 0.

---

## Phase P6 — Web UI

- [x] 로그인 / SuperAdmin 초기 셋업 흐름 **(완료)** — composition-wiring ②(AuthGate, T-0379)·⑥(SuperAdminSetupForm 배선, T-0394)로 조립 완료. 인증 게이트 + 최초 SuperAdmin 셋업 폼이 AppShell 에 배선됨(REQ-044 3 권한 로그인 UI / REQ-038).
- [x] 시각화 대시보드 (정렬·필터·시계열) **(완료)** — DashboardView(③a~③b-3, T-0381~T-0384) + presentational(필터바·시계열·분포·페이지네이션 등, T-0361~T-0375) 조립 완료(REQ-038).
- [x] Admin 패널 (인원·그룹·재평가·import/export·스케줄) **(부분 완료 — shipped 계약 범위)** — AdminView(④a~④h, T-0385~T-0392)로 GroupMemberList 조회·DifficultyModelSelector·export/import·scope·RBAC gating 조립 완료(REQ-049). 단 **재평가(ReEvaluationTriggerPanel)·스케줄(SchedulePanel) 은 backend 계약 미shipped 로 미마운트 defer**(아래 deferred 잔여 참조).
- [x] **평가 진행 중 시각화 보호** (R-78) — 평가 자료 수집/평가 중에는 기존 자료만 표시 + 상단 경고 배너 **(완료 — 배선)** — EvaluationGuardBanner DashboardView 배선(⑤, T-0393) 완료(REQ-078). 단 **자동 polling 은 backend status 계약 미shipped 로 defer**(아래 deferred 잔여 참조).
- **composition-wiring 전환 (완결)** — presentational 분해 완료(15 컴포넌트, T-0361~T-0375). [ADR-0041](decisions/ADR-0041-frontend-composition-wiring.md)(ACCEPTED, T-0377 flip) 이 App.tsx 조립 구조(AppShell→인증 게이트→화면 컨테이너→presentational, controlled lift-up)·무라우터 view 전환 라우팅·native fetch hook data-fetch 경계·non-parallel single-claim shape 를 박제했고, 후속 wiring chain ①~⑥(T-0378~T-0394)이 `independentStream: p6-frontend-composition` 단일-claim 순차로 **완결**됐다(②AuthGate→③DashboardView→④AdminView→⑤EvaluationGuardBanner→⑥SuperAdminSetupForm, PR #325 squash b152181 로 마무리).
  - **deferred 잔여 (backend 계약 확정 후 배선)** — 다음은 make-work 가 아니라 backend-contract 미shipped 로 의도적 defer: ReEvaluationTriggerPanel·SchedulePanel 미마운트(api.md 94~97 `/run`·bulk DELETE·`/reeval`·`/reset` 미구현; SchedulePanel 은 SchedulerModule = P7 + `@nestjs/schedule` 새 dep) / EvaluationGuardBanner 자동 polling(assessments rows status 필드 부재) / GroupMember add·remove mutation / import 결과 상세. backend 계약 확정 후 배선한다.
  - **게이트된 backlog** — web vitest CI 배선(T-0355)은 `onHold: credential-workflow-scope`(token workflow scope 부재)로 게이트됨 — 진입 시 게이트 상태 재확인 필요.

---

## Phase P7 — Scheduling & operations

- [ ] Admin이 cron 주기 지정 (예: KST 02:00) (R-72)
- [ ] Manual trigger (R-73)
- [ ] 최근 N일 결과 manual delete → 재수집 (예: 1일/7일/30일, R-74)
- [ ] **신규 인원 추가 시 1년치 평가 1회** (R-50) — 일반 인원의 매일 1주일 단위 평가와 분리
- [ ] Import / export / restore (R-57) — 평가 자료 backup/restore
- [ ] **성능 검증**:
  - 100~200명 / 50~100 repo / ~1000 confluence page / **1h 이내** (R-91)
  - **조회·시각화 3초 이내** (R-92) — 이미 저장된 결과 조회 시

---

## Phase P8 — Hardening & launch

- [ ] E2E 시나리오 커버리지
- [ ] 보안 점검 (secret 처리, 인증 흐름, RBAC)
- [ ] 운영 문서 (배포·복구·trouble-shoot)
- [ ] 부하·내성 테스트

---

## 운영 정책 review backlog

phase 진행과 별개로, driver / loop / cron 등 운영 정책 자체의 완화·강화를 정기 검토 대상으로 박제. 본 절은 결정이 아니라 **future ADR 의 출발점 인덱스** — 트리거 조건이 충족되면 planner 가 해당 항목을 ADR 작성 task 로 변환한다.

- [x] **cron 1-fire 1-task 정책 완화 검토 — 완결** — 현 [docs/LOOP.md](LOOP.md) §3 의 cron 매 발화 1-task 종료 정책의 완화 가능성을 [ADR-0020](decisions/ADR-0020-multi-task-fire-cron-n2-activation.md) (ACCEPTED) 으로 검토·결정 완결했다. 4-step rollout (T-0197 ADR / T-0198 STATE `flags.multiTaskFire` 필드 / T-0199 LOOP.md §1 `[7.5]` cron chain 분기 / T-0200 §10 재조정 + 토글) 으로 **N=2 cron-fire 한정 활성** 완료 — 한 cron fire 안 task 최대 2 개 chain (`/loop`·human 진입점은 1-task/turn 불변). `STATE.json` `flags.multiTaskFire: true` 토글로 활성화됐으며, 활성 후 30 일 dogfood 관찰 window 진행 중 (위반/context 누적/race/push-contention 관찰, 1 회 재발 시 flag `false` rollback). N≥3 는 ADR-0020 이 금지.
- [x] **CLAUDE.md / LOOP.md 길이 mitigation 검토 — 완결(후보 a 채택)** — 두 문서 후반부 hard rule (CLAUDE §11 trail / §12 언어 / LOOP §4 push hard rule / [.claude/agents/reviewer.md](../.claude/agents/reviewer.md) (4) sub-check 등) attention drift 누락 위험을, 후보 (a) **CLAUDE.md 앞단 §0.5 "Hard rule 인덱스" 1 페이지 cheat sheet** (핵심 8 룰 요약 + 본문 § navigation) 로 mitigate 완료. 트리거 평가 (session #49, [Q-0018](STATE.json) (4)(a) 사용자 결정): LOC 합 = CLAUDE 461 + LOOP 444 = **905 ≥ 800 MET**, 그러나 "룰 누락 사고 1건 재발" 트리거는 §0.5 도입 후 **0 건** — cheat sheet 가 attention-drift 를 실효 차단 중. 후보 (b) LOOP.md §1 표준 prompt 의 `docs/DRIVER_PROMPT.md` 분리는 single-source doc-drift 유지비용 > 현 가치라 **미채택** (사고 1건 재발 시 ADR 로 재검토 — 재검토 트리거는 살아있음). → 본 항목 완결, §0.5 cheat sheet 가 표준 mitigation.
- [x] **cron@cloud `refs/locks/*` 403 자율성 해소 — 완결(2026-06-05)** — cloud sandbox credential proxy 가 `claude/*` 접두 브랜치로만 push 허용([공식](https://code.claude.com/docs/en/claude-code-on-the-web))해 [ADR-0009](decisions/ADR-0009-strong-ref-cas-lock.md) 의 `refs/locks/driver`(브랜치 아님) lock CAS push 가 **HTTP 403** → cron@cloud 가 ref-CAS lock 미획득·pr-mode stand down (로컬 `/loop` 의존, 진정한 cron 자율 long-horizon 불가). GitHub 권한 grant(2026-06-02) 후에도 **403 잔존 실증** (`B-credential-2026-06-04T16:04Z` + 06-05 cron@cloud no-op journal) → proxy 제한이 GitHub App scope 와 별개 층임 확정. **해법(설계 기존재, 현 SUPERSEDED = [T-0154](tasks/T-0154-cloud-proxy-branch-lock-adr.md))**: lock 저장소를 `refs/locks/driver`(blob ref) → `claude/*` 네임스페이스 **브랜치**(예: `refs/heads/claude/lock-driver`, commit ref)로 이전 — proxy 기본 허용이라 **PAT·토글 없이** cron@cloud 자율 lock 가능, `--force-with-lease` CAS 원자성(강한 mutex)은 ref 종류 무관 불변. **planner 처리**: T-0154 refresh 활성화 — ① premise-gate 충족 박제(403 잔존 실증 → ADR 진행 분기) ② T-0154 계획의 ADR-0015 번호 선점됐으므로 다음 free `ADR-NNNN` 재배정 → ADR(pr) 신설 → 후속 direct: LOOP.md §1[1]·§4 + CLAUDE.md §10 의 lock 명령을 브랜치-lock 프로토콜로 동기 + feature-branch cleanup 이 lock 브랜치 오삭제 안 하게 가드 → ACCEPTED flip + 다음 cron@cloud fire 자율 lock 검증. 대안 기각: PAT 주입(§5 외부 credential 부담) / "unrestricted branch pushes" 토글(`refs/locks/*` 는 브랜치 아니라 여전히 403, 불충분). dependency 0. **해소 결과**: ADR-0028 (T-0242 PR-209 c5926fd PROPOSED → T-0243 414a6e2 ACCEPTED, 2026-06-05) 가 lock 저장소를 `refs/locks/driver` (blob) → `refs/heads/claude/lock-driver` (commit ref) 로 이전. 첫 cron@cloud 자율 lock CAS 성공 = cron@vm-454c 8195047 (16:08 KST, `claude/lock-driver` zero-sha 생성 → tip 0472be7, credential 0, 옛 9 회 403 패턴 종결). T-0154 SUPERSEDED (T-0244 22dd70f, `supersededBy: [ADR-0028, T-0242, T-0243]`). ADR-0028 Follow-up §3 운영 관찰 검증 완료.
- [ ] **PLAN.md 단계별 분리 검토** — 현재 PLAN.md 1 파일 + [PLAN_archive.md](PLAN_archive.md) 완료-phase 분리로 충분. 트리거: phase 별 평균 LOC ≥ 30 또는 PLAN.md 합계 LOC ≥ 350 도달 시 phase 별 (`PLAN_PN.md`) 파일 분리 ADR-NNNN 검토. 트리거 미달 시 현 구조 유지.
- [ ] **ADR-0036 fine-grained concurrency staged rollout 추적** — [ADR-0036](decisions/ADR-0036-fine-grained-concurrency.md) (PROPOSED) 의 critical-section-only lock + claim 기반 task 소유 (driver=N 동시 진행) 를 `flags.fineGrainedConcurrency` 토글 기반 5-stage rollout 으로 점진 채택. **stage 1 진행 중** (T-0326, direct): `flags.fineGrainedConcurrency: false` 자리 박제 + [planner.md](../.claude/agents/planner.md) "독립-stream 분해 정책" § (frontmatter `independentStream`/`dependsOn`/`touchesFiles` + 동시 claimable 조건 = 파일-disjoint·의존성 없음·같은 commitMode). **stage 2~5 보류** — stage 2(pr claim registry schema + select+claim) / stage 3(direct §1 loop 재작성 + CLAUDE §10 / LOOP §4 동기) / stage 4(pr .github per-PR concurrency group) / stage 5(direct 토글 ON, 1~4 머지 + 30일 dogfood 후). **break-even gate**: 한 시점 독립 task ≥ 2 가 실증되기 전까지 stage 2 진입 보류 (ADR-0036 §Decision 0 — 독립 task 공급 없으면 throughput 이득 0). 토글 OFF 인 동안 driver 동작 불변 (forward-looking spec).

---

## 의존성

P0 → P0.5 → **P1 (Architecture)** → **P2 (Use case decomposition)** → (P3, P4 병행) → P5 → P6 → P7 → P8

각 phase 내부 task 순서는 planner가 결정한다.

P1 의 architecture document 는 living document — 이후 task 진행 중 architect 가 ADR 와 함께 갱신한다 ([.claude/agents/architect.md](../.claude/agents/architect.md)).
