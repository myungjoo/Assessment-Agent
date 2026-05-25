# PLAN_archive.md — 완료된 Phase 본문 보관

[docs/PLAN.md](PLAN.md) 의 hot read (planner sub-agent) context 절감을 위해 완료 phase 본문을 본 파일로 분리. PLAN.md 에는 1 줄 summary stub 만 유지. **진행 중 phase 는 PLAN.md 에 그대로 유지**, 완료 phase 만 본 파일로 이동.

본 파일은 archive 성격 — planner sub-agent 는 hot path 에서 본 파일을 read 하지 않는다. 사람 / architect 가 historical context 필요 시 참조.

---

## Phase P0 — Bootstrap

목표: 자동 루프가 도는 데 필요한 최소 골격을 만든다.

- [~] T-0001 — ADR-0001 stack 결정 + NestJS 프로젝트 골격 + GitHub Actions CI **(SUPERSEDED — size cap 초과로 4개로 split, HQ-0001 결정)**
- [x] T-0002 — ADR-0001 stack 결정 박제 (NestJS / TS / pnpm / Jest / GHA) (PR-2, 8c6defe)
- [x] T-0003 — 프로젝트 base config (pnpm + tsconfig + ESLint + .gitignore) (PR-3, e6052d4)
- [x] T-0006 — T-0003 결함 patch: jest.roots 라인 제거 (HQ-0002, AC#1 deviation 옵션 a) (PR-5, 3e501a7)
- [x] T-0004 — NestJS minimal src skeleton + 첫 sanity test (PR-6, 0e5855f; cron 발화)
- [x] T-0005 — CI workflow 에 lint/build/test step 추가 + README 로컬 빌드 단락 (PR-7, e58852d; loop session #2/10)

**Phase P0 완료 (2026-05-24 00:34 KST)**. main CI 가 실제 lint/build/test 검증 — 자동 루프 골격 완성.

**참고**: `.github/workflows/ci.yml` 의 trigger·job 골격은 부트스트랩 단계에서 사용자 명시 요청에 따라 main에 직접 박혀 있었고 (skeleton), T-0005가 그 위에 실제 step 채움.

---

## Phase P1 — Architecture (MVA)

목표: 도메인 코드가 들어가기 전에 **꼭 필요한 architecture 결정** 을 박제. 4+1 view 전체가 아니라 **Minimum Viable Architecture** — 코드 시작에 필요한 만큼만, 나머지는 task 진행 중 ADR 로 진화.

- [ ] **P1-Entry** — README → REQ 매핑 표 완성 ([docs/requirements.md](requirements.md) 모든 row 검증). planner 가 자동 생성하는 P1 첫 task. commitMode: direct.
- [x] **T-A1: Requirement 분리** — FR / NFR / Constraint 컬럼 추가 (T-0013 으로 subsumed: requirements.md kind 컬럼이 채워짐, FR 46 / NFR 4 / Constraint 16). 검증 위치 (test 종류) 와의 결합 미세조정은 P2 진입 시 재검토.
- [x] **T-A2: Deployment view** — [docs/architecture/deployment.md](architecture/deployment.md) 신설 완료. (T-0014 + T-0015 = T-A2 complete; [ADR-0002](decisions/ADR-0002-db.md) + [ADR-0003](decisions/ADR-0003-deployment.md) 모두 ACCEPTED). split 결과: T-0014 = ADR-0002 DB 선택, T-0015 = ADR-0003 나머지 4 결정:
  - Monolithic NestJS vs queue+worker 분리 (R-91 1h 처리량을 고려)
  - DB (외부 PostgreSQL vs embedded vs sqlite — ADR-0002 로 합쳐도 OK)
  - Secret 저장 (env / vault / file)
  - Scheduler 위치 (NestJS `@nestjs/schedule` / 외부 cron / queue trigger)
  - 외부 네트워크 boundary (Samsung 내부망 접근 — github.sec / ecode)
- [x] **T-A3: Component view** — [docs/architecture/components.md](architecture/components.md) 신설 완료 (T-0016, components.md ACCEPTED). mermaid 다이어그램 + 각 component 책임:
  - Web UI (Frontend) ↔ Backend API
  - Worker (평가 파이프라인)
  - DB / Persistence
  - LLM Gateway (5 provider abstraction)
  - GitHub Adapter (3 instance, 단일 component + sub-config 묶음 결정 박제) / Confluence Adapter
  - Scheduler / Trigger
  각 컴포넌트 간 contract (sync/async, message format) 명시.
- [x] **T-A4: Module view (확장)** — [docs/architecture/modules.md](architecture/modules.md) 신설 완료 (T-0017). NestJS 8 module (AssessmentModule / UserModule / GithubModule / ConfluenceModule / LlmModule / AuthModule / SchedulerModule / WebModule) 의 책임 표 + 의존성 mermaid graph + topological order 로 acyclic 검증 + components ↔ modules N:N mapping + PersistenceModule 분리 결정 인라인 박제.

**Phase P1 (Architecture / MVA) 완료**. 4 architecture document (requirements.md kind 컬럼 / deployment.md / components.md / modules.md) 모두 main 진입 + ADR-0001 / ADR-0002 / ADR-0003 ACCEPTED. P2 (Use case decomposition) 진입 가능.

이 phase 끝나면 P2 (Use case decomposition) 가 architecture 기반으로 use case 를 각 component / module 에 분류해 진행할 수 있다.

**범위 밖** (over-design 회피, 후속 phase 에서 진화):

- 구체적 데이터 모델 schema (테이블 컬럼) — P3 (Domain core) 에서.
- 구체적 API endpoint signature — P3 / P4 진행 중.
- 구체적 NestJS service 클래스 / 메서드 시그니처 — implementer 책임.
- Frontend 컴포넌트 트리 — P6 (Web UI) 진입 시.
