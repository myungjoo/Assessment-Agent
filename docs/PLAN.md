# Assessment-Agent — Master Plan

> 이 파일은 planner sub-agent가 점진적으로 채우고 정련한다. 부트스트랩 시점에는 phase 골격만 존재한다.
> 자세한 단위 작업은 [docs/tasks/](tasks/) 의 T-NNNN 파일을 참조.

상태는 [STATE.json](STATE.json) 의 `phase` 필드와 동기화되어야 한다.

---

## Phase P0 — Bootstrap

목표: 자동 루프가 도는 데 필요한 최소 골격을 만든다.

- [~] T-0001 — ADR-0001 stack 결정 + NestJS 프로젝트 골격 + GitHub Actions CI **(SUPERSEDED — size cap 초과로 4개로 split, HQ-0001 결정)**
- [x] T-0002 — ADR-0001 stack 결정 박제 (NestJS / TS / pnpm / Jest / GHA) (PR-2, 8c6defe)
- [ ] T-0003 — 프로젝트 base config (pnpm + tsconfig + ESLint + .gitignore)
- [ ] T-0004 — NestJS minimal src skeleton + 첫 sanity test
- [ ] T-0005 — CI workflow 에 lint/build/test step 추가 + README 명령어 단락

**참고**: `.github/workflows/ci.yml` 의 trigger·job 골격은 부트스트랩 단계에서 사용자 명시 요청에 따라 main에 직접 박혀 있다 (skeleton 상태). T-0005는 그 위에 실제 step 들을 채운다.

완료 조건: `pnpm test` 가 통과하는 빈 NestJS 프로젝트가 main에 merge되고, CI가 green.

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

- [ ] 평가 대상 인원 관리 (CRUD, group, deactivate)
- [ ] 평가 결과 저장 모델 (commit/document 단위, 일/주/월 요약)
- [ ] Persistence layer (DB 선택은 ADR-0002로)
- [ ] Auth/RBAC 모델 (SuperAdmin/Admin/User)

---

## Phase P3 — External integrations

- [ ] GitHub (github.com / github.sec.samsung.net / github.ecodesamsung.com) 통합
- [ ] Confluence 통합
- [ ] LLM provider 추상화 (custom OpenAI-호환 / Azure / Anthropic / Gemini / OpenAI)
- [ ] 자격증명 관리 + 권한 부족 감지·통지

---

## Phase P4 — Evaluation pipeline

- [ ] 단위 commit/document 평가 (난이도·기여도·양)
- [ ] 일/주/월 요약 평가 (LLM 정성 + Metric 수치)
- [ ] 중복 제거 (fork/rebase/meld)
- [ ] Abusing 방지 metric
- [ ] 평가 재실행·부분 reset

---

## Phase P5 — Web UI

- [ ] 로그인 / SuperAdmin 초기 셋업 흐름
- [ ] 시각화 대시보드 (정렬·필터·시계열)
- [ ] Admin 패널 (인원·그룹·재평가·import/export·스케줄)
- [ ] "평가 진행중" 경고 배너

---

## Phase P6 — Scheduling & operations

- [ ] Admin이 cron 주기 지정 (예: KST 02:00)
- [ ] Manual trigger
- [ ] 최근 N일 결과 manual delete → 재수집
- [ ] Import / export / restore
- [ ] 100~200명 / 50~100 repo / ~1000 confluence page / 1h 이내 성능 검증

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
