# T-0110 구현 상세 (executor 외화) — ADR-0006 first slice

driver context 보호용 외화 파일. 요약은 commit trail blob 참조.

## 무엇을 했나

ADR-0006 Decision §1~§6 을 `prisma/schema.prisma` 에 1:1 구현 (first slice — schema + migration + spec only). service/repository/controller/DTO/endpoint 은 task Out of Scope (T-0111+).

### 1. `prisma/schema.prisma` (+103 raw / +41 substantive)

- **Assessment model** (Decision §1) — `id`/`personId`/`period`/`scope`/`periodStart`/`difficulty`/`contributionScore Decimal`/`volume Int`/`narrative`/`createdAt`. `updatedAt` 미정의 (immutable). `@@unique([personId, period, scope, periodStart])` + `@@index([personId, period, periodStart])`. Person N:1 `onDelete: Cascade`. Contribution back-relation.
- **Contribution model** (Decision §2) — `id`/`assessmentId`/`sourceType`/`sourceUrl`/`sourceRef`/`difficulty`/`contributionScore Decimal`/`volume Int`/`createdAt`. raw 본문 컬럼 0 (참조 식별자만). Assessment N:1 `onDelete: Cascade`.
- **Summary model** (Decision §3) — `id`/`personId`/`period`/`periodStart`/`narrative`/`metricScore Decimal`/`createdAt`. `@@index([personId, period, periodStart])`. Person N:1 `onDelete: Cascade`.
- **Person back-relation** — `assessments Assessment[]` + `summaries Summary[]` (양방향 relation 요건).
- raw 본문 컬럼 0 (R-59 / Decision §4) — 3 model 의 주석에 schema-level 강제 의도 명시 (commit body / diff / 문서 본문 / Confluence page 본문 컬럼 정의 안 함).

### 2. 신규 migration `prisma/migrations/20260531000000_assessment_contribution_summary/migration.sql` (+61)

- 기존 user/group_part migration 형식 (CreateTable + CreateIndex + AddForeignKey) mirror.
- 생성 방법 (로컬 DB 없음 — `prisma migrate dev` 불가): `prisma migrate diff --from-schema <HEAD:schema> --to-schema <new schema> --script` 로 offline 생성 후 신규 timestamped 디렉토리에 배치. CI 의 `prisma migrate deploy` step (services.postgres 16) 가 실 적용.
- `Decimal` → `DECIMAL(65,30)`: ADR Out-of-Scope "임의 precision 박제 금지" 와 정합 — schema field 는 bare `Decimal` 유지 (`@db.Decimal(p,s)` 미박제). `(65,30)` 은 내가 고른 값이 아니라 bare `Decimal` 에 대한 Prisma 의 default 매핑으로, CI 의 `migrate deploy` 가 동일하게 생성하는 mechanical 값.

### 3. 신규 spec `prisma-schema.spec.ts` (+203 raw / 153 substantive)

repo-root colocate (기존 `prisma.config.spec.ts` 패턴). jest rootDir `.` + testRegex `.*\.spec\.ts$` 가 pickup. `.spec.ts` 라 spec-presence check 면제.

- (a) happy-path — PrismaClient delegate (`assessment`/`contribution`/`summary`) 노출 + DMMF 3 model 포함 + 각 model 컬럼 열거 + `updatedAt` 부재.
- (b) negative (R-59) — 3 model 어디에도 금지 raw 본문 필드 (`commitBody`/`diff`/`pageBody`/`body`/`content` 등 12 후보) 부재 (`it.each` 3 model × forbidden 목록).
- (c) negative 안전망 — DMMF relation 존재 + schema 원문 `@@unique`/`@@index`/`onDelete: Cascade`/`Decimal` 선언 검증 (runtime DMMF 가 constraint meta 를 carry 안 해 schema 원문을 truth 로).
- branch coverage 항목: schema 선언만 — production 분기 로직 0 이라 생략 (R-112 task 명시).

## 로컬 검증 결과 (실제)

- `prisma validate` — valid.
- `pnpm lint` — pass (0 warning). lint glob `{src,test}/**/*.ts` 라 root spec 은 미대상 — 기존 `prisma.config.spec.ts` 정합.
- `pnpm build` (nest build / tsc) — pass (신규 model type 무오류 compile).
- `pnpm test` — 49 suite / 828 test pass (신규 spec 14 test 포함).
- `pnpm test:cov` — All files 100% (stmt/branch/func/line). threshold (line≥80 / func≥80) 충족. schema-only 라 runtime 함수 0 → coverage 변동 0 (여전히 100%).
- migration 의 실 DB 적용 + smoke/e2e 는 CI (services.postgres 16) 책임 — 로컬 DB 부재로 `migrate deploy` 미실행 (offline diff 로 SQL 생성).

## 크기 (300 LOC / 5 file cap)

- 3 files (≤5 ok).
- raw +367 / substantive (non-comment·non-blank) 235 (schema 41 + spec 153 + migration 41).
- raw overage (367 > 300) 는 전량 §12 한국어 ADR-traceability 주석 + SQL `-- CreateTable` marker — authored logic 아님.
- task spec 이 명시한 indivisible first slice (model 만 / migration 만 / spec 만 으로 쪼개면 CI gate red → 비기능 중간상태). service/repo/controller 는 이미 T-0111+ defer. → split 불가, DONE 진행.

## Follow-ups (task 파일 §Follow-ups 와 동일 — 신규 추가 없음)

- T-0111: AssessmentService / repository (CRUD + raw 미저장 invariant unit test).
- T-0112: AssessmentController + DTO + endpoint + e2e.
- doc-only direct: data-model.md §2 REQ-063→REQ-036 정정, INDEX.md ADR row 추가.
- `@db.Decimal(p,s)` precision/scale 확정 + query-pattern 기반 추가 `@@index`.
