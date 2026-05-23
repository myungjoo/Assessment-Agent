# Assessment-Agent — Master Plan

> 이 파일은 planner sub-agent가 점진적으로 채우고 정련한다. 부트스트랩 시점에는 phase 골격만 존재한다.
> 자세한 단위 작업은 [docs/tasks/](tasks/) 의 T-NNNN 파일을 참조.
> 각 phase 의 bullet 은 [README.md](../README.md) 의 지시사항과 [docs/requirements.md](requirements.md) 의 REQ-NNN 매핑을 cover 해야 한다.

상태는 [STATE.json](STATE.json) 의 `phase` 필드와 동기화되어야 한다.

---

## Phase P0 — Bootstrap

목표: 자동 루프가 도는 데 필요한 최소 골격을 만든다.

- [~] T-0001 — ADR-0001 stack 결정 + NestJS 프로젝트 골격 + GitHub Actions CI **(SUPERSEDED — size cap 초과로 4개로 split, HQ-0001 결정)**
- [x] T-0002 — ADR-0001 stack 결정 박제 (NestJS / TS / pnpm / Jest / GHA) (PR-2, 8c6defe)
- [x] T-0003 — 프로젝트 base config (pnpm + tsconfig + ESLint + .gitignore) (PR-3, e6052d4)
- [ ] T-0006 — T-0003 결함 patch: jest.roots 에서 부재 디렉토리 제거 (HQ-0002 결정 b)
- [~] T-0004 — NestJS minimal src skeleton + 첫 sanity test **(BLOCKED — T-0006 merge 후 unblock)**
- [ ] T-0005 — CI workflow 에 lint/build/test step 추가 + README 명령어 단락

**참고**: `.github/workflows/ci.yml` 의 trigger·job 골격은 부트스트랩 단계에서 사용자 명시 요청에 따라 main에 직접 박혀 있다 (skeleton 상태). T-0005는 그 위에 실제 step 들을 채운다.

완료 조건: `pnpm test` 가 통과하는 빈 NestJS 프로젝트가 main에 merge되고, CI가 green.

---

## Phase P0.5 — Test·CI infra hardening (README 110-114 / §3.2 강제층)

목표: README 110–114 의 절대 규칙이 단순 문서 정책이 아니라 **CI 게이트로 강제되는 메커니즘**까지 구축. P0 끝나고 P1 진입 전에 진행 (도메인 코드가 들어가기 전에 test 인프라가 준비돼있어야 효과 큼).

- [ ] T-0007 — CI 에 "신규 production .ts 파일 → 대응 .spec.ts 필수" 검사 step 추가 (간단한 bash check 또는 git diff 분석 step)
- [ ] T-0008 — `pnpm test:cov` 를 CI 에 통합 + 최소 line/branch coverage threshold (낮게 시작, 예: 50%) — jest 설정에 threshold 명시
- [ ] T-0009 — Smoke test 인프라 (supertest 기반) + 1개 sanity smoke + CI 의 `pnpm test:smoke` step 추가 — R-113 (smoke 부분) 충족
- [ ] T-0010 — E2E test 인프라 (NestJS testing module + supertest 또는 별도 runner) + 1개 e2e + CI 의 `pnpm test:e2e` step 추가 — R-113 (e2e 부분) 충족

완료 조건: 변경된 production code 에 spec 누락이 자동으로 CI fail 을 일으키고, coverage threshold 미만이면 CI fail, smoke·e2e 까지 CI 에서 자동 실행되어 R-113 까지 모두 강제된다.

각 task 의 acceptance criteria 는 planner 의 R-112 의무 항목을 따라 happy/error/branch/negative test 자체 가짐 (즉 T-0007 의 검사 step 자체에도 test 가 따라야 한다).

---

## Phase P1 — Requirements decomposition

목표: README를 use case와 모듈로 분해하여 이후 phase의 입력을 만든다.

- [ ] Use case 발굴: README 각 섹션 → `docs/use-cases/UC-NN-*.md`
- [ ] 모듈 경계 정의: `docs/architecture/modules.md`
- [ ] 데이터 모델 초안: `docs/architecture/data-model.md`
- [ ] API contract 초안: `docs/architecture/api.md`
- [ ] 디렉토리 구조 정의: `docs/architecture/directory.md`

각 항목은 planner가 1~3개의 T-NNNN task로 분할한다.

---

## Phase P2 — Domain core

목표: 외부 통합 없이 자체적으로 돌릴 수 있는 도메인 핵심.

- [ ] 평가 대상 인원 관리 (CRUD, group, deactivate/activate — 휴직 시 숨김)
- [ ] **서비스별 ID 매핑** — github.com / github.sec.samsung.net / github.ecodesamsung.com / confluence.sec.samsung.net 등 각 서비스의 ID 보유, 일부 NULL 허용 (R-48)
- [ ] **Primary key 역할 ID 지정** — 서비스 중 1개의 ID 를 기준 식별자로 (예: confluence.sec.samsung.net ID) (R-47)
- [ ] **Group 정책** — 한 인원은 임의 group 다중 소속 가능, 단 조직도 파트는 정확히 1개 (R-51)
- [ ] 평가 결과 저장 모델 (commit/document 단위, 일/주/월 요약)
- [ ] **🔥 Raw data 저장 금지 (R-59)** — code commit 본문·문서 변경 본문 등 raw 는 저장하지 않고 평가된 결과 (난이도/기여도/양/평가문) 만 보유. ADR-필수 항목.
- [ ] **상대 비교 가능 데이터 구조** — 개발자 간 동일 metric 비교가 가능한 형태 (R-63)
- [ ] Persistence layer (DB 선택은 ADR-0002로)
- [ ] Auth/RBAC 모델 (SuperAdmin/Admin/User) — 첫 로그인 SuperAdmin 지정, Admin→User 변경은 SuperAdmin만, 본인 self-demote 금지 (R-84)
- [ ] User read-only 권한 범위 명시 — 조회·sort·filter 만 (R-86)

---

## Phase P3 — External integrations

- [ ] GitHub 통합 — 3 instance 모두: **github.com / github.sec.samsung.net / github.ecodesamsung.com**. 각 instance 의 URL·org·token 설정 분리.
- [ ] **GitHub Issue 평가** (R-30) — Repo 내 Issue 작성을 문서 기여로 평가. 단 **본인이 본인 follow-up 을 남기고 본인이 소비하는 경우 카운트 제외**.
- [ ] Confluence 통합 — 지정 주소의 Confluence Service 내 **지정 SPACE들** 다중 관리
- [ ] **Confluence SPACE 탐색 정책** (R-34) — Crawling 또는 page List/Hierarchy 기반 탐색 중 택. ADR 로 결정.
- [ ] **LLM provider 추상화** — 5 provider: **custom (OpenAI 호환 / 내부 자체 서버 / proxy 가능 / 3 model 슬롯을 모두 custom 으로 채울 수도 있음)** / Azure OpenAI / Anthropic / Google Gemini / OpenAI (R-99~103)
- [ ] **3가지 난이도 모델 할당** (R-97) — 평가 항목별 난이도 분류 + 어떤 항목이 어떤 난이도 모델로 처리될지 구현 과정에서 결정. ADR 로 박제.
- [ ] **Admin 이 LLM 모델 지정** UI (R-96)
- [ ] 자격증명 관리 + **권한 부족 감지·통지** (사용자 + 관리자 모두 인식 가능, R-20·33)

---

## Phase P4 — Evaluation pipeline

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
- [ ] 평가 재실행·부분 reset (R-64)

---

## Phase P5 — Web UI

- [ ] 로그인 / SuperAdmin 초기 셋업 흐름
- [ ] 시각화 대시보드 (정렬·필터·시계열)
- [ ] Admin 패널 (인원·그룹·재평가·import/export·스케줄)
- [ ] "평가 진행중" 경고 배너

---

## Phase P6 — Scheduling & operations

- [ ] Admin이 cron 주기 지정 (예: KST 02:00) (R-72)
- [ ] Manual trigger (R-73)
- [ ] 최근 N일 결과 manual delete → 재수집 (예: 1일/7일/30일, R-74)
- [ ] **신규 인원 추가 시 1년치 평가 1회** (R-50) — 일반 인원의 매일 1주일 단위 평가와 분리
- [ ] Import / export / restore (R-57) — 평가 자료 backup/restore
- [ ] **성능 검증**:
  - 100~200명 / 50~100 repo / ~1000 confluence page / **1h 이내** (R-91)
  - **조회·시각화 3초 이내** (R-92) — 이미 저장된 결과 조회 시
- [ ] **평가 진행 중 시각화 보호** (R-78) — 평가 자료 수집/평가 중에는 기존 자료만 표시 + 상단 경고 배너

---

## Phase P7 — Hardening & launch

- [ ] E2E 시나리오 커버리지
- [ ] 보안 점검 (secret 처리, 인증 흐름, RBAC)
- [ ] 운영 문서 (배포·복구·trouble-shoot)
- [ ] 부하·내성 테스트

---

## 의존성

P0 → P1 → (P2, P3 병행) → P4 → P5 → P6 → P7

각 phase 내부 task 순서는 planner가 결정한다.
