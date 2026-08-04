---
id: T-1448
title: components.md `## Component table` **DB Persistence row (122 행)** 의 검증 가능 claim ↔ 실 `prisma/schema.prisma` 인벤토리 · `ADR-0002` / `ADR-0003` · REQ ID 대조 + T-1447 FU1 1 순위 계승 + audit §12.46
phase: P5
status: PENDING
commitMode: direct
coversReq: [REQ-029, REQ-031, REQ-032, REQ-033]
estimatedDiff: 200
estimatedFiles: 3
created: 2026-08-04
independentStream: uc-doc-audit-resync
dependsOn: [T-1447]
touchesFiles:
  - docs/architecture/components.md
  - docs/use-cases/REQ-COVERAGE-AUDIT.md
  - docs/tasks/T-1448-components-md-db-persistence-row-vs-prisma-audit.md
plannerNote: "uc-doc-audit-resync 60 번째 slice — T-1447 FU1 1 순위 (DB Persistence row, schema.prisma 단일 정본 대조). doc-only 1.6x"
---

# T-1448 — components.md `## Component table` DB Persistence row ↔ 실 `prisma/schema.prisma` · ADR · REQ 대조

## Why

[T-1447](T-1447-components-md-backend-api-worker-rows-vs-src-audit.md) 이 [components.md](../architecture/components.md) `## Component table` 의 `Backend API` · `Worker` 2 row 를 판정하며 T-1446 FU1 을 닫았고 ([REQ-COVERAGE-AUDIT.md](../use-cases/REQ-COVERAGE-AUDIT.md) `§ 12.45`), 잔여 5 row 중 **다음 slice 1 순위로 `DB Persistence` row (122 행)** 를 지목했다. 근거는 `§ 12.45` 원문 그대로다 — ① 이 row 의 claim 은 **`prisma/schema.prisma` 단일 정본** 과 1:1 대조가 가능해 검증 난이도가 가장 낮고, ② REQ-032 (raw 저장 금지) · REQ-031 (재수집 중복 방지 unique constraint) 이 **schema-level 강제** 라 판정이 결정적이다. 본 slice 는 그 1 순위를 그대로 집행한다.

대조 축은 넷이다. ① **책임 축** ("PostgreSQL 16+ 인스턴스" · "Prisma client" · "repository layer" · "모든 component 의 영속 저장소" · "ADR-0002 결정에 따라 schema-as-code (`schema.prisma`)" · "raw text 컬럼 미정의 (REQ-032 schema-level 강제)") ↔ 실 `prisma/schema.prisma` + `src/**/*.repository.ts` 인벤토리, ② **contract 축** ("Backend API / Worker 로부터의 Prisma typed query (in-process)" · "TCP 5432 의 PostgreSQL 외부 process 와 통신") ↔ 실 datasource 설정 · 배포 자산의 포트 서술, ③ **pointer 축** ([ADR-0002](../decisions/ADR-0002-db.md) · `ADR-0003 §1 (단일 DB 인스턴스)`) 의 대상 실재 + **§ 번호 부합**, ④ **REQ ID 축** (REQ-029 / REQ-031 / REQ-032 / REQ-033) 의 [requirements.md](../requirements.md) 실재 + 괄호 병기 문구 부합.

planner 사전 확인 — **아래는 전부 가설이며 전제가 아니다** (T-1440 AC 1 · T-1441 가설 ④ · T-1442 가설 ⑧ · T-1443 가설 ② · T-1444 가설 ① · T-1445 가설 ① · T-1446 의 `AuthGate` 부분참 · T-1447 의 `RBAC` 이름 상이 판정이 planner 기대를 실측으로 반증한 선례가 9 회 있다). executor 는 AC 1 에서 전부 재측정하고 **기대와 다르면 그 축의 편집을 중단** 한다. ① planner 훑기상 `schema.prisma` 는 **666 행 · `^model ` 15 개** 이고 **44 행 `provider = "postgresql"`** 이라 provider 는 참이나, **major version (`16+`) 은 schema 에 없다** — 버전 근거가 배포 자산 쪽에만 있으면 이 구는 `schema 로는 검증 불가 (배포 자산이 출처)` 로 분류될 여지가 있다. ② `src/**/*.repository.ts` 는 실재하므로 "repository layer" 는 **참** 쪽이나 개수는 실측해야 한다. ③ **`ADR-0003 §1` 의 § 번호가 drift 일 수 있다** — `§ 12.45` 가 실측한 바로 **32 행 `### Decision §1 — Monolithic NestJS process`** 는 process 토폴로지 절이라, "단일 DB 인스턴스" 가 그 절이 아니라 다른 § 에 있으면 pointer 는 **부분참** 이다. ④ "raw text 컬럼 미정의" 는 [requirements.md](../requirements.md) REQ-032 row 가 이미 `Assessment` · `Contribution` · `Summary` 3 model 기준 raw 본문 컬럼 0 을 적어 뒀으나, 본 row 의 claim 은 **schema 전체 (15 model)** 를 대상으로 읽히므로 **범위 차이** 를 분리 판정해야 한다.

**행 좌표 주의** — components.md 는 T-1447 각주 8 행 추가로 **210** 행이고, `## Component table` 은 **115** 행, `DB Persistence` row 는 **122** 행, T-1446 각주 blockquote 는 **128 ~ 132** 행, T-1447 각주 blockquote 는 **134 ~ 140** 행, `## GitHub Adapter …` heading 은 **142** 행이다. AC 1 (i) 에서 재실측한다.

[PLAN.md](../PLAN.md) 의 미완 bullet (106 · 108 · 109 · 140 · 151) 은 owner 게이트 · 외부 credential · 새 dependency 게이트라 planner 단독 진행 불가이므로, 본 doc stream 이 현 시점 우선순위 최상위다.

## Required Reading

- `docs/architecture/components.md` — **210 행**. 다음 구간만 읽는다.
  - **115 ~ 122 행** (`## Component table` heading + 표 header 2 행 + 앞 3 row + **`DB Persistence` row**) — **122 행이 본 slice 의 유일한 주 판정 대상**, 119 ~ 121 행은 경계 확인 · 판정 승계 인용만.
  - **123 ~ 126 행** (잔여 4 row) — **무편집, 경계 확인만**. 판정하지 않는다.
  - **128 ~ 140 행** (T-1446 · T-1447 각주 blockquote 2 블록) — **무편집, 화법 · 배치 template 확인용**. 본 slice 각주는 T-1447 blockquote **직후** 에 붙는다.
  - **1 ~ 4 행** (문서 성격 선언 blockquote — "본 문서는 P1 T-A3 의 산출물") — **무편집**, 판정의 최강 제약. 인용만 한다.
  - **그 밖 전 구간** — **무편집, heading 좌표 확인만**.
- `docs/use-cases/REQ-COVERAGE-AUDIT.md` — **4610 행**. **`### 12.15`** (시점 기록 append-only 처리 방침 정본) · **`### 12.45`** (**4485** 행 — T-1447 판정표 화법 template + FU1 원문 + 잔여 5 row 목록) · **`## 11. References` (4597 행)** — `§ 12.46` 삽입 위치 경계. **그 밖의 절은 열지 않는다** (§7).
- `prisma/schema.prisma` — **666 행. 무편집, 읽기만**. `grep` / `sed` 로 **datasource block · `^model ` 목록 · raw 본문 컬럼 후보 · `@@unique`** 만 인용한다 (**666 행 통독 금지**).
- `docs/decisions/ADR-0002-db.md` — **무편집, 읽기만**. **status 1 줄 + PostgreSQL / Prisma 결정 1 ~ 2 구** 확인까지만. 본문 재판정 · status 변경 금지.
- `docs/decisions/ADR-0003-deployment.md` — **무편집, 읽기만**. **"단일 DB 인스턴스" 서술이 실제로 몇 번째 `### Decision §N` 절인지** 확인까지만 (**파일명 주의 — `ADR-0003-deployment-topology.md` 가 아니다**, `§ 12.45` FU16 이 지적한 표기 drift).
- `docs/requirements.md` — **97 행. 무편집, 읽기만**. REQ-029 / REQ-031 / REQ-032 / REQ-033 의 **실재 + 제목 1 구** 확인용 `grep` 만. 본문 재판정 금지.
- `CLAUDE.md` §3 (task 크기 상한) · §3.2 (direct doc-only 면제) · §12 (언어 정책)

## Acceptance Criteria

- [ ] **AC 1 — 실측 선행 (날조 금지)**: 편집 전에 다음을 직접 측정해 `§ 12.46` 에 **명령과 출력을 함께** 인용한다. 기대값과 **다르면 그 축의 편집을 중단** 하고 불성립 사실을 `§ 12.46` 에 기록한다 (Why 의 ① ~ ④ 는 가설일 뿐이다).
  - (i) **좌표 + 원문 재확인**: `grep -n '^#\{1,3\} ' docs/architecture/components.md` 로 heading 좌표를 **먼저 실측** 한 뒤 (본 AC 의 `115` · `122` · `142` 도 stale 일 수 있다 — T-1436 ~ T-1447 선례) `sed -n '122p'` 로 row 원문을 인용한다. 이어 **실측으로 참 · 거짓을 가릴 수 있는 claim** (책임 구 · schema 사실 · contract 구 · ADR ID / § 번호 · REQ ID) 만 뽑아 열거하고, 순수 성격 서술은 **검증 불가 claim** 으로 분류해 판정 대상에서 제외한다. 이 이분 자체를 남긴다.
  - (ii) **schema 인벤토리 축**: `wc -l prisma/schema.prisma` · `grep -c '^model ' prisma/schema.prisma` · `grep -n '^datasource' -A 4 prisma/schema.prisma` · `grep -n '^generator' -A 3 prisma/schema.prisma` 로 정본 사실을 인용해 **"PostgreSQL 인스턴스"** · **"Prisma client"** · **"schema-as-code (`schema.prisma`)"** 3 구를 각각 판정한다. **`16+` major version 구는 schema 안 근거 유무를 먼저 밝히고**, 없으면 `docker-compose.yml` · `docs/architecture/deployment.md` 의 postgres image tag / 포트 서술을 **read-only grep 1 ~ 2 회** 로 확인해 **출처가 schema 가 아님을 명시** 한 채 판정한다 (배포 자산은 **읽기만** — 편집 금지).
  - (iii) **repository layer + raw 컬럼 축**: `ls -1 src/**/*.repository.ts 2>/dev/null | grep -v '\.spec\.' | wc -l` (또는 `find src -name '*.repository.ts' -not -name '*.spec.ts'`) 로 repository 파일 수 + 대표 이름 3 개를 인용해 **"repository layer"** 를 판정한다. **"raw text 컬럼 미정의"** 는 `grep -n '^model ' prisma/schema.prisma` 로 얻은 **15 model 전체** 를 대상으로 `grep -n 'String' prisma/schema.prisma | grep -i 'body\|content\|diff\|raw\|payload\|text' | head -10` 등 **raw 본문 후보 컬럼 grep** 을 돌려 **hit 0 여부** 를 인용하고, hit 이 있으면 그 컬럼이 raw 본문인지 식별자 / 서술 필드인지 1 구로 가른다. **범위 차이 (row 는 schema 전체를 함의, REQ-032 근거는 3 model 기준)** 를 반드시 분리해 적는다.
  - (iv) **contract + pointer 축**: `grep -n '5432' prisma/schema.prisma docs/architecture/deployment.md docker-compose.yml 2>/dev/null | head -5` 로 **"TCP 5432"** 구의 근거 실재를, `ls -1 docs/decisions/ADR-0002-*.md docs/decisions/ADR-0003-*.md` · `grep -n '^status:\|^## Status' docs/decisions/ADR-0002-db.md docs/decisions/ADR-0003-deployment.md | head -4` · `grep -n '^### Decision §' docs/decisions/ADR-0003-deployment.md` · `grep -n '단일 DB\|PostgreSQL' docs/decisions/ADR-0003-deployment.md | head -5` 로 **`ADR-0003 §1 (단일 DB 인스턴스)` 의 § 번호 부합** 을 판정한다. **§ 번호가 다르면 그 사실 자체가 판정 결과** 이며 (부분참), 옳은 § 번호를 실측 출력으로 함께 인용한다.
  - (v) **REQ ID 축**: `grep -n 'REQ-029\|REQ-031\|REQ-032\|REQ-033' docs/requirements.md | head -8` 으로 **4 개 REQ ID 의 실재** 를 인용하고, row 가 괄호로 병기한 설명 문구 (`REQ-029 (non-volatile 저장)` · `REQ-031 (재수집 중복 방지 unique constraint)` · `REQ-032 (raw 저장 금지)` · `REQ-033 (commit/문서 단위)`) 가 **실 requirements 제목과 부합** 하는지 판정한다. 특히 REQ-031 의 **`unique constraint`** 병기는 `grep -n '@@unique' prisma/schema.prisma | head -6` 실측으로 뒷받침한다. 판정이 동일한 ID 는 묶어도 된다.
  - (vi) baseline — `wc -l` components.md **210** · audit **4610** · schema.prisma **666** · requirements.md **97** · deployment.md **232** · directory.md **203** · modules.md **259** · PLAN.md **175**, `grep -c '^## '` components.md **7** · audit **12**, audit `grep -c '^| REQ-'` **66** · `grep -c '^### 12\.'` **45**.
- [ ] **AC 2 — 지점 판정표**: AC 1 이 뽑은 **검증 가능 claim** 각각에 대해 `in-place 수정` / `원문 보존 + 각주 부기` / `무편집` / `상위 slice 판정 승계` 중 하나를 판정한 표를 만든다. 각 row 는 **claim 1 구 · 실측 결과 · 판정 (참 / 부분참 / 거짓) · 처리 · 근거 1 구** 5 컬럼이다.
  - **REQ ID 4 개는 판정이 같으면 1 row 로 묶고 ID 를 전부 나열** 해도 무방하다 (묶을 경우 묶음 근거 1 구). **책임 구 · contract 구 · pointer 는 묶음 금지**.
  - 판정 기준 **3 축** 명시 — ① **문서 성격** (1 ~ 4 행 blockquote 의 P1 T-A3 blueprint 선언 + 이 표가 이미 여러 차례 shipped 현황으로 갱신된 흔적), ② `§ 12.15` **정합** (row 에 시점 marker 가 있는지 실측 grep 근거), ③ **선례** (T-1430 ~ T-1447 의 "원문 보존 + 실측 각주" vs [T-1429](T-1429-api-md-module-vocab-and-uc-range-resync.md) 의 in-place 1:1 치환 vs [T-1436](T-1436-directory-md-web-frontend-section-vs-src-audit.md) 의 혼합 채택).
- [ ] **AC 3 — 처리 방식 판정**: 후보 4 개 중 **채택 1 · 기각 3** 인 판정표를 만든다. 기각마다 근거 1 구.
  - 후보 — (A) row 셀 **in-place 동기** (틀린 § 번호 · 낡은 서술 치환), (B) **원문 무편집 + T-1447 각주 blockquote 직후에 각주 blockquote 1 개 신설** (T-1437 ~ T-1447 화법 승계), (C) **혼합** (거짓 판정 지점만 in-place, 나머지는 각주), (D) **전 지점 무편집 + audit 기록만**.
  - 판정 기준 **4 축** 명시 — ① `§ 12.15` 정합, ② **오도 risk** (독자가 이 표만 읽고 DB 버전 · raw 컬럼 강제 범위 · ADR § 좌표를 오인할 때의 비용), ③ **cap** — 예상 diff ≤ 300 LOC · 변경 파일 **3 고정** (초과 후보는 자동 기각 + split 제안 기록), ④ **각주 누적 구조 제약** — 표 뒤 blockquote 가 누적되므로 본 slice 는 **3 번째 블록** 이며 첫 구에 **"본 각주는 `DB Persistence` row 한정"** 을 반드시 명시해야 한다는 점 (5 ~ 6 블록 시점의 배치 규약 재검토는 `§ 12.44` 한계 3 소관으로 본 slice 범위 밖 — 파생 영향에만 기록).
- [ ] **AC 4 — 채택안 반영**: AC 3 채택안대로만 편집한다. 각 지점은 AC 2 판정 결과를 따른다.
  - **각주 blockquote 는 T-1447 각주 blockquote 마지막 행 (현 140 행) 과 `## GitHub Adapter — 3 instance 묶음 vs 분리 결정` heading (현 142 행) 사이에 삽입** 한다. **각주 blockquote 1 개 (≤ 6 행) + in-place 치환 (≤ 2 지점) 이내**, `wc -l` 증가 **+7 이내** (210 → ≤ 217).
  - **각주 첫 구에 "본 각주는 `DB Persistence` row 한정" 을 명시** 한다 — 잔여 4 row 는 미판정임을 독자가 즉시 알 수 있어야 한다.
  - **문구 · model 이름 · 수치 · ADR ID · § 번호 · REQ ID · task ID 는 AC 1 실측 출력과 1:1 일치** 해야 하며, 실측되지 않은 값 (존재하지 않는 model, 임의 카운트, 없는 절 번호) 을 **새로 창작하지 않는다**.
  - **1 ~ 4 행 blockquote · 119 ~ 121 행 3 row · 123 ~ 126 행 잔여 4 row · 128 ~ 140 행 기존 각주 2 블록 · 142 행 이후 전 구간 무편집**.
  - **새 pointer 추가 금지** — 본문 · `schema.prisma` · 두 ADR · requirements.md 외의 문서를 새로 등재하지 않는다 (audit 쪽에만 기록).
  - **secret · connection string · 실 호스트명 · 실 DB 비밀번호를 문서에 옮겨 적지 않는다** (CLAUDE.md §9) — `DATABASE_URL` 값은 인용 금지, 변수명 언급까지만.
- [ ] **AC 5 — audit `§ 12.46` 신설**: [REQ-COVERAGE-AUDIT.md](../use-cases/REQ-COVERAGE-AUDIT.md) 의 `## 11. References` (4597 행) **직전** 에 `### 12.46 …` 절을 **순수 append** 한다 (기존 절 수정 0). 구성 — 본 절의 위치 · 계보 1 문단 (**T-1447 FU1 1 순위 closure**) / AC 1 실측 (명령 + 출력) / AC 2 지점 판정표 / AC 3 처리 판정표 / AC 4 반영 결과 + 무편집 경계 / **Component table 잔여 미판정 row 목록** (`LLM Gateway` · `GitHub Adapter` · `Confluence Adapter` · `Scheduler` **4 row** — 다음 slice 1 순위 + 선정 근거 1 구) / 파생 영향 (목록만) / 불변 검산 / 한계. **절 전체 ≤ 115 행** (초과 시 실측 인용을 요약형으로 압축하고 압축 사실을 한계에 명시).
  - `###` 레벨이라 `grep -c '^## '` **12 불변** · `grep -c '^| REQ-'` **66 불변** · `grep -c '^### 12\.'` **45 → 46**.
- [ ] **AC 6 — 불변 검산**: 다음을 실행해 출력을 `§ 12.46` 에 인용한다. `wc -l` components.md (210 → ≤ 217) · audit (4610 → +115 이내) · **`prisma/schema.prisma` 666 불변** · deployment.md (**232 불변**) · directory.md (**203 불변**) · modules.md (**259 불변**) · PLAN.md (**175 불변**) · requirements.md (**97 불변**), `git diff -U0 -- docs/architecture/components.md | grep '^@@'` 로 **hunk 개수 · 위치** 를 보이고 AC 4 허용 구간 밖 hunk **0** 을 실증, `git diff --numstat` 으로 **순수 삭제 0** (삭제 행이 있으면 in-place 치환의 짝임을 1 구로 설명), `git status --porcelain src/ test/ web/ prisma/ deploy/ docker-compose.yml Dockerfile .github/ package.json README.md .claude/ docs/decisions/ docs/ops/ docs/PLAN.md docs/requirements.md` **빈 출력** (코드 · schema · frontend · 배포자산 · CI · 의존성 · ADR · PLAN · requirements 무변경), `git status --porcelain` 이 **3 파일 이내** 임을 확인.
- [ ] **AC 7 — 파생 영향 기록 (목록만, 본 slice 편집 금지)**: `§ 12.46` 말미에 후속 slice 대상을 목록으로 남긴다. 최소 포함 — (1) **Component table 잔여 4 row** + 다음 slice 1 순위 (claim 밀도 · 실 코드 대조 난이도 근거 1 구 — `§ 12.45` 는 3 adapter 를 차순위, `Scheduler` 를 후순위로 이월했다), (2) **표 뒤 각주 blockquote 누적 배치 규약 재검토** (`§ 12.44` 한계 3 — 본 slice 로 3 블록째), (3) `## Deployment 컨텍스트` (22 ~ 26 행 — "모든 8 component 는 동일 process" claim, T-1445 FU1 차순위로 **3 회째 이월**), (4) `## Component diagram` mermaid node ↔ 실 module 대조, (5) `@nestjs/config` 미도입 전수 sweep (`§ 12.39` FU3 미소진, ADR 게이트), (6) reviewer 규약 미이행 (`.claude/agents/reviewer.md` REQ-032 0 hit — `§ 12.41` FU2 미소진, **본 절의 raw 컬럼 판정과 직접 인접**), (7) `deploy/README.md` ↔ deployment.md ↔ runbook 3 자 정합 (`§ 12.41` FU3 미소진), (8) README 행 번호 pointer drift 전수 sweep, (9) REQ 번호 체계 잔재 전수 sweep (`§ 12.38` FU3 미소진), (10) `CLAUDE.md` §1 pointer 부정확 (T-1442 FU3 미소진), (11) UC-09 `§ 5` sequence participant 병기 (31 회째 이월), (12) 정본 [modules.md](../architecture/modules.md) 카운트 claim 대조 (`§ 12.34` FU1 미소진, ADR 게이트), (13) 행 번호 → anchor 좌표계 이행 (25 회째), (14) `§ 12.44` 미해결 한계 — "mutation 러너 26 개" 정의 미확정 (`pr` mode drift-guard spec 소관), (15) `Scheduler` cron → 평가 pipeline 미결선 (`§ 12.45` FU15 — **코드 소관, `pr` task 로만 처리 가능**).
- [ ] **AC 8 — R-110 / R-112 면제 근거 명시**: 본 task 는 `commitMode: direct` doc-only 로 production code **0 LOC** · 분기 **0** 이라 [CLAUDE.md](../../CLAUDE.md) §3.2 direct-mode 면제 조항에 따라 tester 호출 · happy / error / flow / negative 4 항목 · `pnpm test:cov` 가 **N/A** 임을 `§ 12.46` 에 1 구로 명시한다.
- [ ] **AC 9 — 언어 · 링크 규약**: 추가 문장은 모두 한국어 (§12), 문서 간 참조는 상대경로 markdown 링크, 수치는 실측 출력과 1:1 일치. **ADR-0003 파일 경로는 `docs/decisions/ADR-0003-deployment.md`** 로만 적는다 (`§ 12.45` FU16 이 지적한 `-deployment-topology.md` 표기 drift 재발 금지).

## Out of Scope

- **코드 · schema · frontend · 배포 자산 · CI · agent 정의 변경 절대 금지** — `src/` · `web/` · `test/` · **`prisma/`** · `scripts/` · `deploy/` · `docker-compose.yml` · `Dockerfile` · `.github/workflows/` · `package.json` · `.claude/agents/` 는 diff 에 등장하면 안 된다. **model / 컬럼 추가 · rename 으로 문서를 맞추는 행위 금지** (문서를 실제에 맞출 뿐, 실제를 문서에 맞추지 않는다).
- **Component table 잔여 4 row 판정 · 편집 금지** — `LLM Gateway` · `GitHub Adapter` · `Confluence Adapter` · `Scheduler` 는 후속 slice 소관이며 본 slice 에서 손대면 cap 이 즉시 깨진다.
- **`Web UI` · `Backend API` · `Worker` row (119 ~ 121 행) 재판정 금지** — `§ 12.44` · `§ 12.45` 가 이미 닫았다. 필요 시 판정 승계 인용까지만.
- **components.md 142 행 이후 전 구간 편집 금지** — `## GitHub Adapter …` · `## Contracts` 표 · `## References` · mermaid diagram 무편집.
- **1 ~ 4 행 blockquote · 128 ~ 140 행 T-1446 / T-1447 각주 편집 금지** — 인용 · 화법 참조까지만.
- **`docs/PLAN.md` · `docs/requirements.md` 편집 금지** — pointer / REQ 실재 확인용 grep 인용까지만.
- **ADR-0002 · ADR-0003 본문 재판정 · status 변경 금지** — 파일 실재 + status 1 줄 + § 좌표 실측까지만. **§ 번호 drift 를 발견해도 ADR 을 고치지 않는다** (components.md 쪽 판정 · 각주로만 처리).
- **[modules.md](../architecture/modules.md) · [INDEX.md](../architecture/INDEX.md) · [deployment.md](../architecture/deployment.md) · [directory.md](../architecture/directory.md) 편집 금지** — 정합 판정 필요 사실은 파생 영향 목록에만 남긴다 (**modules.md 259 행 · deployment.md 232 행 · directory.md 203 행 불변**).
- **DB 접속 · migration 실행 금지** — `prisma migrate` · `prisma generate` · `psql` 어느 것도 실행하지 않는다.
- **빌드 · 테스트 · 설치 실행 금지** — `pnpm install` · `pnpm build` · `pnpm test` 어느 것도 실행하지 않는다 (측정은 전부 read-only grep / ls / find / sed / wc / git).
- **다른 문서로의 cascade 금지** — [use-cases/INDEX.md](../use-cases/INDEX.md) · `UC-01` ~ `UC-09` · ADR · [README.md](../../README.md) 는 무편집.
- **각주 배치 규약 자체의 재설계 금지** — `§ 12.44` 한계 3 이 제기한 "표 뒤 나열 vs row 별 anchor" 재검토는 파생 영향 목록에만 남긴다.
- **행 번호 → anchor 좌표계 이행 금지** — 파생 영향 목록에만 남긴다 (25 회째 이월).
- **CI drift-guard spec 작성 금지** — `pr` mode 소관이라 본 direct task 에서 진행하면 §3.1 위반.
- **audit 기존 절 (`§ 12.1` ~ `§ 12.45`) 수정 금지** — `§ 12.46` 순수 append 만.

## Suggested Sub-agents

`implementer` 단독 (doc-only, 코드 0 LOC — architect · tester 불요. §3.2 direct-mode 면제).

## Follow-ups

(생성 시점 비어 있음 — sub-agent 가 관련 작업을 발견하면 여기에 append 한다.)
