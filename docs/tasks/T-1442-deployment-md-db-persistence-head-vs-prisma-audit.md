---
id: T-1442
title: deployment.md `## DB / Persistence` 전반부 (15 ~ 33 행 — heading · 도입 2 문단 · `### 배포 토폴로지` · `### Migration 정책`) 의 검증 가능 claim ↔ 실 `docker-compose.yml` · `prisma/` · `src/persistence/` · `.github/workflows/ci.yml` · `package.json` 대조 + T-1441 Follow-up 1 계승 + audit §12.40
phase: P5
status: DONE
commitMode: direct
coversReq: [REQ-029, REQ-032, REQ-043]
estimatedDiff: 200
estimatedFiles: 3
created: 2026-08-04
independentStream: uc-doc-audit-resync
dependsOn: [T-1441]
touchesFiles:
  - docs/architecture/deployment.md
  - docs/use-cases/REQ-COVERAGE-AUDIT.md
  - docs/tasks/T-1442-deployment-md-db-persistence-head-vs-prisma-audit.md
plannerNote: "uc-doc-audit-resync 54 번째 slice — T-1441 Follow-up 1 (DB / Persistence) 계승, 35 행 단락이라 전반부만. doc-only 1.6x"
---

# T-1442 — deployment.md `## DB / Persistence` 전반부 ↔ 실 `prisma/` · compose · CI 자산 대조

## Why

[T-1441](T-1441-deployment-md-secret-section-vs-deploy-audit.md) 이 [deployment.md](../architecture/deployment.md) `## Secret / 자격증명 저장` 단락을 완결하면서 ([REQ-COVERAGE-AUDIT.md](../use-cases/REQ-COVERAGE-AUDIT.md) `§ 12.39`), 잔여 2 단락 중 **`## DB / Persistence` 를 다음 slice 1 순위** 로 명시 이월했다 (T-1441 Follow-up 1). 근거는 이 단락이 DB 이미지 · 접속 경로 · migration 도구 · CI 통합 시점을 열거해 **실 자산 ([docker-compose.yml](../../docker-compose.yml) · [prisma/](../../prisma) · [src/persistence/prisma.service.ts](../../src/persistence/prisma.service.ts) · [.github/workflows/ci.yml](../../.github/workflows/ci.yml)) 과 행 단위로 직접 대조 가능** 하다는 것이다.

다만 이 단락은 **15 ~ 49 행 (35 행 · 하위 5 절)** 로 직전 slice 들이 다룬 범위 (T-1441 26 행 / T-1440 24 행) 보다 크다. [T-1439](T-1439-deployment-md-network-boundary-head-vs-src-audit.md) · [T-1440](T-1440-deployment-md-network-boundary-tail-vs-src-audit.md) 가 51 행짜리 `## 외부 네트워크 boundary` 를 전반 / 후반 2 slice 로 나눈 선례를 따라 **본 slice 는 전반부 (15 ~ 33 행 — heading · 도입 2 문단 · `### 배포 토폴로지` · `### Migration 정책`) 만** 닫고, 후반부 (`### Backup / restore 전략` · `### Raw data 저장 금지 (REQ-032)` · `### 후속 진행`) 는 다음 slice 로 남긴다. 특히 REQ-032 raw-data 금지 축은 `prisma/schema.prisma` 의 `String` column 전수 판정이 필요해 단독 slice 가 적절하다.

**행 좌표 주의** — T-1441 각주 (+6 행) 는 `## Secret / 자격증명 저장` 말미 (현 107 ~ 112 행) 에 들어가 **본 slice 범위인 15 ~ 33 행보다 뒤** 라 좌표 이동이 없다. planner 실측 기준 현 좌표는 `## DB / Persistence` **15** · `### 배포 토폴로지` **21** · `### Migration 정책` **28** · `### Backup / restore 전략` **34** (deployment.md 총 **213** 행). 그래도 AC 1 (i) 에서 재실측한다.

planner 사전 확인 — **아래는 전부 가설이며 전제가 아니다** (T-1437 Follow-up 4 · T-1440 AC 1 · T-1441 가설 ④ 가 planner 기대를 실측으로 반증한 선례가 3 회 있다). executor 는 AC 1 에서 전부 재측정하고, **기대와 다르면 그 축의 편집을 중단** 한다. ① 19 행 "채택: PostgreSQL + Prisma" 는 **참** 쪽 (compose 에 `postgres:16-alpine` · repo 에 `prisma/` 실재). ② 23 행의 `postgres:16-alpine` 표기는 실 compose 와 **일치** 할 가능성이 높으나, "동일 host 의 다른 process **또는** 로컬 Docker container 가 default" 라는 양자 택일 서술은 실제로 compose 단일 경로로 **확정** 됐을 가능성 (부분참). ③ 24 행의 "docker-compose 내부 network 의 service 이름 (예: `db:5432`)" 은 실 service 이름이 `db` 가 아닐 가능성 — 예시임을 감안해도 **오도 risk** 판정 대상. ④ 24 행 "구체 변수 이름은 T-0015 의 secret 단락이 결정" 은 이미 이행돼 **시점 서술이 낡았을** 가능성 (`DATABASE_URL` 실재 여부는 실측). ⑤ 25 행 "PrismaService 의 singleton 으로 보유" 는 실재하나 **경로가 `src/persistence/`** 라 문서가 module 위치를 명시하지 않는 차이. ⑥ 25 행 "Pool 크기와 statement timeout 의 구체 값은 P3 Persistence layer task 에서 결정" 은 실 설정 grep 이 0 hit 이면 **미이행 + 시점 낡음** 두 축이 겹칠 가능성. ⑦ 26 행 worker 분리 조건절은 ADR-0003 이 monolithic 을 채택했으면 **조건 미성립 서술** (검증 가능하나 거짓은 아님). ⑧ 30 ~ 31 행 `prisma migrate dev` / `deploy` · `prisma/migrations/` 누적은 **참** 쪽. ⑨ 32 행 "CI 통합은 P3 phase 의 task 에서 ci.yml step 또는 별도 deployment script 로 도입. 본 task 는 정책만 박제" 는 ci.yml 에 이미 `Prisma migrate deploy` step 이 있으면 **시점 서술이 낡음** (거짓 축).

[PLAN.md](../PLAN.md) 의 미완 bullet (106 · 108 · 109 · 140 · 151) 은 owner 게이트 · 외부 credential · 새 dependency 게이트라 planner 단독 진행 불가이므로, 본 doc stream 이 현 시점 우선순위 최상위다.

## Required Reading

- `docs/architecture/deployment.md` — **213 행**. 다음 구간만 읽는다.
  - **15 ~ 33 행** (`## DB / Persistence` heading + 도입 2 문단 (17 · 19) + `### 배포 토폴로지` (21 ~ 26) + `### Migration 정책` (28 ~ 32)) — 본 slice 의 **주 편집 후보 구간**.
  - **34 ~ 49 행** (`### Backup / restore 전략` · `### Raw data 저장 금지 (REQ-032)` · `### 후속 진행`) — **무편집, 경계 확인용으로만** 읽는다 (다음 slice 소관).
  - **1 ~ 4 행** (문서 성격 선언 blockquote — "본 문서는 P1 T-A2 의 산출물") — **무편집**, 판정의 최강 제약.
  - **187 ~ 189 행 · 209 ~ 213 행** (T-1439 · T-1441 이 삽입한 각주 blockquote) — **무편집, 읽기만**. 각주 화법 승계용 template.
- `docs/use-cases/REQ-COVERAGE-AUDIT.md` — **3962 행**. **`### 12.15`** (**1002** 행 — 시점 기록 append-only 처리 방침 정본) · **`### 12.39`** (**3835** 행 — T-1441 판정표 화법 template + Follow-up 1 원문) · **`## 11. References` (3949 행)** — `§ 12.40` 삽입 위치 경계.
- `docker-compose.yml` — **무편집, 읽기만**. DB service 이름 · image tag · port · volume 판정 입력 (본 slice 의 **핵심 대조 상대**). **필요한 부분만 grep** 으로 인용 (전문 read 금지 — §7).
- `prisma/schema.prisma` (datasource block 만) · `prisma/migrations/` (디렉토리 목록만) — **무편집, 읽기만**. migration 누적 · provider 판정 입력. **schema 의 model / column 은 본 slice 판정 대상이 아니다** (후반부 slice 소관).
- `src/persistence/prisma.service.ts` — **무편집, 읽기만**. PrismaService singleton · pool 설정 유무 판정 입력. **필요한 행만 grep 인용**.
- `.github/workflows/ci.yml` · `package.json` · `Dockerfile` · `.env.example` — **무편집, 읽기만**. `prisma migrate deploy` 도입 여부 · `DATABASE_URL` 실재 판정 입력. **grep 인용만**.
- `docs/decisions/ADR-0002-db.md` · `docs/decisions/ADR-0003-deployment.md` — **heading 목록만** (pointer 유효성 확인용). 본문 재판정 금지.
- `CLAUDE.md` §3 (task 크기 상한) · §3.2 (direct doc-only 면제) · §12 (언어 정책)

## Acceptance Criteria

- [ ] **AC 1 — 실측 선행 (날조 금지)**: 편집 전에 다음을 직접 측정해 `§ 12.40` 에 **명령과 출력을 함께** 인용한다. 기대값과 **다르면 그 축의 편집을 중단** 하고 불성립 사실을 `§ 12.40` 에 기록한다 (Why 의 ① ~ ⑨ 는 가설일 뿐이다).
  - (i) **단락 원문 + 좌표 재확인**: `grep -n '^#\{1,3\} ' docs/architecture/deployment.md` 로 heading 좌표를 **먼저 실측** 한 뒤 (본 AC 의 `15 ~ 33 행` 도 stale 일 수 있다 — T-1436 ~ T-1440 선례) 해당 범위를 `sed -n` 으로 인용한다. 이어 **실측으로 참·거짓을 가릴 수 있는 claim** (image tag · service 이름 · env 변수명 · 파일 경로 · CLI 명령 · phase 표기) 만 뽑아 열거하고, 순수 설계 가정 · 운영 권장 서술 (single-operator 컨텍스트에서 "가장 가볍다" 는 평가 · managed service 전환 전망 등) 은 **검증 불가 claim** 으로 분류해 판정 대상에서 제외한다. 이 이분 자체를 남긴다.
  - (ii) **DB 인스턴스 축 (23 행)**: `grep -n "image:\|container_name:\|ports:\|5432" docker-compose.yml | head -12` 로 실 DB service 정의를 인용해, 문서의 `postgres:16-alpine` · "PostgreSQL 16 이상" 표기와 대조한다. "동일 host 의 다른 process **또는** 로컬 Docker container 형태가 default" 라는 양자 서술이 실제로 **compose 단일 경로로 확정** 됐는지 1 구로 판정한다 (`참 / 부분참 / 거짓` 중 하나).
  - (iii) **접속 경로 축 (24 행)**: `grep -n '^  [a-z-]\+:' docker-compose.yml | head -8` 로 **실 service 이름** 을 인용하고 (`services:` 하위 key), 문서가 예시로 든 `db:5432` 와 대조한다. 실 이름이 `db` 가 아니면 **예시로 명시돼 있어도 오도 risk 가 있는지** 를 1 구로 판정한다. 이어 `grep -rn "DATABASE_URL" .env.example docker-compose.yml .github/workflows/ci.yml 2>/dev/null | head -6` 으로 변수명 실재를 인용해, "`DATABASE_URL` 표준 명칭이 Prisma convention" 이 실제로 채택됐는지 판정한다.
  - (iv) **PrismaService · pool 축 (25 행)**: `grep -rn "class PrismaService" src --include='*.ts' | head -3` 으로 **실 경로 (`src/persistence/`)** 를 인용하고, `grep -rn "connection_limit\|pool_timeout\|statement_timeout\|poolSize" src prisma docker-compose.yml .env.example 2>/dev/null | head -6` 으로 pool / timeout 설정 실재 여부를 인용한다. hit 이 0 이면 **"P3 에서 결정" 이 미이행 상태로 남았음** 을 그대로 기록하고, 시점 서술 낡음 축과 미이행 축을 **분리** 판정한다.
  - (v) **worker 분리 조건절 축 (26 행)**: `grep -n '^## \|^### ' docs/decisions/ADR-0003-deployment.md | head -12` 로 ADR-0003 이 monolithic / worker 중 무엇을 채택했는지 절 제목 수준에서 확인해, 문서의 조건절 (`worker process 분리가 결정되면`) 이 **미성립 조건인지** 1 구로 판정한다. **ADR 본문 재판정 · status 변경은 하지 않는다**.
  - (vi) **Migration 도구 · 누적 축 (30 ~ 31 행)**: `grep -rn "prisma migrate" package.json .github/workflows/ci.yml Dockerfile deploy/ 2>/dev/null | head -8` 로 `migrate dev` / `migrate deploy` 의 실 사용처를 인용하고, `ls -1 prisma/migrations | head -10` + `ls -1 prisma/migrations | wc -l` 로 migration 누적 개수를 인용한다. "git 으로 버전 관리" 는 `git ls-files prisma/migrations | head -3` 으로 tracked 임을 실증한다.
  - (vii) **CI 통합 시점 축 (32 행)**: `grep -n "Prisma migrate deploy\|migrate deploy" .github/workflows/ci.yml | head -6` 으로 ci.yml step 실재를 인용하고, `grep -n '"phase"' docs/STATE.json | head -2` 의 현 phase 값과 대조해 "P3 phase 의 task 에서 … 도입. 본 task 는 정책만 박제" 가 **이미 지난 시점을 미래로 서술하는지** 판정한다. `§ 12.15` 의 시점 기록 append-only 방침이 이 축에 어느 강도로 걸리는지 1 구로 논증한다.
  - (viii) **pointer 유효성 축 (17 · 19 · 23 · 26 행)**: `grep -n '^## \|^### ' docs/decisions/ADR-0002-db.md | head -12` 로 ADR-0002 절 실재를 확인하고, 23 행이 인용한 **[CLAUDE.md](../../CLAUDE.md) §1 의 "single-operator 운영 컨텍스트"** 가 실제로 §1 에 있는지 `grep -n "^## 1\.\|single-operator\|단일" CLAUDE.md | head -8` 로 확인한다 (§ 번호가 어긋나면 pointer 부정확 축으로 판정 — **CLAUDE.md 는 무편집**).
  - (ix) baseline — `wc -l` deployment.md **213** · audit **3962** · directory.md **203** · modules.md **259**, `grep -c '^## '` deployment.md **6** · audit **12**, audit `grep -c '^| REQ-'` **66** · `grep -c '^### 12\.'` **39**.
- [ ] **AC 2 — 지점 판정표**: AC 1 이 뽑은 **검증 가능 claim** 각각에 대해 `in-place 수정` / `원문 보존 + 각주 부기` / `무편집` / `상위 slice 판정 승계` 중 하나를 판정한 표를 만든다. 각 row 는 **지점 (행) · claim 1 구 · 실측 결과 · 판정 (참 / 부분참 / 거짓) · 처리 · 근거 1 구** 6 컬럼.
  - 판정 기준 **3 축** 명시 — ① **문서 성격** (1 ~ 4 행 blockquote 의 P1 T-A2 blueprint 선언에 `§ 12.15` append-only 제약이 어느 강도로 걸리는가), ② `§ 12.15` **정합** (본 단락에 시점 marker 가 있는지 실측 grep 으로 근거를 둔다 — 24 · 25 · 32 행이 그 marker 후보다), ③ **선례** (T-1430 ~ T-1435 · T-1437 ~ T-1441 의 "원문 보존 + 실측 각주" vs [T-1429](T-1429-api-md-module-vocab-and-uc-range-resync.md) 의 in-place 1:1 치환 vs [T-1436](T-1436-directory-md-web-frontend-section-vs-src-audit.md) 의 혼합 채택).
  - **거짓 / 부분참 축 (service 이름 · pool 미설정 · worker 조건절) 과 시점 축 (`DATABASE_URL` 결정 · P3 pool 결정 · P3 CI 통합) 의 처리를 분리 판정** 한다 — 두 축의 처리가 갈려도 무방하나 그 이유를 각각 1 구로 적는다.
- [ ] **AC 3 — 처리 방식 판정**: 후보 4 개 중 **채택 1 · 기각 3** 인 판정표를 만든다. 기각마다 근거 1 구.
  - 후보 — (A) **전 지점 in-place 동기**, (B) **원문 무편집 + 전반부 말미 각주 blockquote 1 개 신설** (T-1437 ~ T-1441 화법 승계), (C) **혼합** (시점 서술만 in-place, 나머지는 각주), (D) **전 지점 무편집 + audit 기록만**.
  - 판정 기준 **4 축** 명시 — ① `§ 12.15` 정합, ② **오도 risk** (독자가 본 단락을 배포 지시로 읽고 compose service 이름 `db` 로 접속 문자열을 만들거나 migration CI 통합을 미도입으로 오인할 때의 비용), ③ **cap** — 예상 diff ≤ 300 LOC · 변경 파일 **3 고정** (초과 후보는 자동 기각 + split 제안 기록), ④ 선례 일관성.
- [ ] **AC 4 — 채택안 반영**: AC 3 채택안대로만 편집한다. 각 지점은 AC 2 판정 결과를 따른다.
  - **각주 blockquote 는 `### Migration 정책` 본문 말미 (현 32 행) 와 `### Backup / restore 전략` heading (현 34 행) 사이에 삽입** 한다 — T-1439 가 `## 외부 네트워크 boundary` 전반부 말미에 각주를 둔 배치 (현 187 ~ 189 행) 와 동형. **각주 blockquote 1 개 (≤ 5 행) + in-place 치환 (≤ 2 지점) 이내**, `wc -l` 증가 **+6 이내** (213 → ≤ 219).
  - **문구·service 이름·env 변수명·파일 경로·image tag·CLI 명령은 AC 1 실측 출력과 1:1 일치** 해야 하며, 실측되지 않은 값 (존재하지 않는 env 이름, 미도입 pool 설정값, 배포 호스트의 실제 경로) 을 **새로 창작하지 않는다**.
  - **secret 값 · connection string 실값을 문서에 옮겨 적지 않는다** — 변수 **이름** 까지만 인용한다 (CLAUDE.md §9).
  - **1 ~ 4 행 blockquote 무편집** · **34 ~ 49 행 (DB 단락 후반부) 무편집** · **`## DB / Persistence` 밖 전 구간 무편집** (`## 개요` · `## 배포 토폴로지` · `## Scheduler 위치` · `## Secret / 자격증명 저장` · `## 외부 네트워크 boundary` 및 T-1437 ~ T-1441 각주).
  - **새 pointer 추가 금지** — ADR-0002 / ADR-0003 외의 문서를 본문에 새로 등재하지 않는다 (audit 쪽에만 기록).
- [ ] **AC 5 — audit `§ 12.40` 신설**: [REQ-COVERAGE-AUDIT.md](../use-cases/REQ-COVERAGE-AUDIT.md) 의 `## 11. References` (3949 행) **직전** 에 `### 12.40 …` 절을 **순수 append** 한다 (기존 절 수정 0). 구성 — 본 절의 위치 · 계보 1 문단 / AC 1 실측 (명령 + 출력) / AC 2 지점 판정표 / AC 3 처리 판정표 / AC 4 반영 결과 + 무편집 경계 / **T-1441 Follow-up 1 의 전반부 closure 선언 + 후반부 이월 명시** / **deployment.md 잔여 미대조 갱신** (DB 단락 후반부 + `## 개요`) / 파생 영향 (목록만) / 불변 검산 / 한계. **절 전체 ≤ 110 행** (cap 준수 — 초과 시 실측 인용을 요약형으로 압축).
  - `###` 레벨이라 `grep -c '^## '` **12 불변** · `grep -c '^| REQ-'` **66 불변** · `grep -c '^### 12\.'` **39 → 40**.
- [ ] **AC 6 — 불변 검산**: 다음을 실행해 출력을 `§ 12.40` 에 인용한다. `wc -l` deployment.md (213 → ≤ 219) · audit (3962 → +110 이내) · directory.md (**203 불변**) · modules.md (**259 불변**), `git diff -U0 -- docs/architecture/deployment.md | grep '^@@'` 로 **hunk 개수 · 위치** 를 보이고 AC 4 허용 구간 밖 hunk **0** 을 실증, `git diff --numstat` 으로 **순수 삭제 0** (삭제 행이 있으면 in-place 치환의 짝임을 1 구로 설명), `git status --porcelain src/ test/ prisma/ web/ deploy/ docker-compose.yml .github/ package.json` **빈 출력** (코드·배포자산·CI·의존성 무변경), `git status --porcelain` 이 **3 파일** 임을 확인.
- [ ] **AC 7 — 파생 영향 기록 (목록만, 본 slice 편집 금지)**: `§ 12.40` 말미에 후속 slice 대상을 목록으로 남긴다. 최소 포함 — (1) **`## DB / Persistence` 후반부 (`### Backup / restore 전략` · `### Raw data 저장 금지 (REQ-032)` · `### 후속 진행`) = 다음 slice 1 순위** + 근거 1 구 (REQ-032 축은 `prisma/schema.prisma` column 전수 판정이 필요해 단독 slice 가 적절), (2) `## 개요` (5 ~ 13 행) 를 그 다음 순위로 지정 — 닫으면 deployment.md 전 단락 대조 완결, (3) **README 행 번호 pointer (36 행 "README 57 행")** 의 유효성 — 후반부 slice 소관, (4) **`deploy/README.md` ↔ deployment.md 배포 절차 정합** (T-1441 Follow-up 3 미소진), (5) `@nestjs/config` 미도입 사실의 다른 문서 전수 sweep (T-1441 Follow-up 2, ADR 게이트), (6) REQ 번호 체계 잔재 전수 sweep (`§ 12.38` Follow-up 3 미소진), (7) UC-09 `§ 5` sequence participant 병기 (24 회째 이월), (8) 정본 [modules.md](../architecture/modules.md) 카운트 claim 대조 (`§ 12.34` Follow-up 1 미소진 — ADR 게이트), (9) 행 번호 → anchor 좌표계 이행 (18 회째), (10) 산문 tally ↔ 실측 CI drift-guard spec (`pr` mode 소관).
- [ ] **AC 8 — R-110 / R-112 면제 근거 명시**: 본 task 는 `commitMode: direct` doc-only 로 production code **0 LOC** · 분기 **0** 이라 [CLAUDE.md](../../CLAUDE.md) §3.2 direct-mode 면제 조항에 따라 tester 호출 · happy / error / flow / negative 4 항목 · `pnpm test:cov` 가 **N/A** 임을 `§ 12.40` 에 1 구로 명시한다.
- [ ] **AC 9 — 언어 · 링크 규약**: 추가 문장은 모두 한국어 (§12), 문서 간 참조는 상대경로 markdown 링크, 수치는 실측 출력과 1:1 일치.

## Out of Scope

- **코드 · 스키마 · 배포 자산 · CI 변경 절대 금지** — `src/` · `test/` · `prisma/` · `web/` · `scripts/` · `deploy/` · `docker-compose.yml` · `Dockerfile` · `.github/workflows/` · `package.json` 은 diff 에 등장하면 안 된다. 특히 compose service 이름 변경, pool / statement timeout 설정 추가, migration 파일 생성은 **어떤 경우에도 하지 않는다** (문서를 실제에 맞출 뿐, 실제를 문서에 맞추지 않는다).
- **DB 단락 후반부 (34 ~ 49 행) 편집 금지** — `### Backup / restore 전략` · `### Raw data 저장 금지 (REQ-032)` · `### 후속 진행` 은 다음 slice 소관. 본 slice 에서 REQ-032 raw-data 축을 판정하지 않는다.
- **`prisma/schema.prisma` 의 model / column 판정 금지** — datasource / provider 확인까지만. column 전수 sweep 은 후반부 slice 소관.
- **DB 접속 · migration 실행 금지** — `prisma migrate` · `docker compose up` · `pnpm build` · `pnpm test` 어느 것도 실행하지 않는다 (측정은 전부 read-only grep / ls).
- **배포 호스트 상태 측정 금지** — repo 밖 파일시스템 · 실 DB 인스턴스는 판정 대상이 아니다.
- **ADR-0002 · ADR-0003 본문 재판정 · status 변경 금지** — 절 존재 확인까지만. 결정 자체의 번복은 owner 게이트.
- **[CLAUDE.md](../../CLAUDE.md) 편집 금지** — §1 pointer 부정확이 확인돼도 audit 기록만 (운영 규칙 문서 수정은 별도 task).
- **[deploy/README.md](../../deploy/README.md) · [docs/ops/runbook.md](../ops/runbook.md) 편집 금지** — 정합 판정 필요 사실은 파생 영향 목록에만 남긴다.
- **정본 [modules.md](../architecture/modules.md) · [directory.md](../architecture/directory.md) · [api.md](../architecture/api.md) 편집 금지** — 본 slice 는 deployment.md DB 전반부만 닫는다.
- **다른 문서로의 cascade 금지** — [components.md](../architecture/components.md) · [data-model.md](../architecture/data-model.md) · `docs/architecture/INDEX.md` · [INDEX.md](../use-cases/INDEX.md) · `UC-01` ~ `UC-09` · ADR · [PLAN.md](../PLAN.md) · [requirements.md](../requirements.md) 는 무편집.
- **행 번호 → anchor 좌표계 이행 금지** — 파생 영향 목록에만 남긴다 (18 회째 이월).
- **CI drift-guard spec 작성 금지** — `pr` mode 소관이라 본 direct task 에서 진행하면 §3.1 위반.
- **audit 기존 절 (`§ 12.1` ~ `§ 12.39`) 수정 금지** — `§ 12.40` 순수 append 만.

## Suggested Sub-agents

`implementer` 단독 (doc-only, 코드 0 LOC — architect · tester 불요. §3.2 direct-mode 면제).

## 결과 요약

- **채택안 = (B) 원문 무편집 + `### Migration 정책` 말미 각주 blockquote 1 블록 (5 행)**. AC 3 의 (A) · (C) · (D) 는 각각 치환 지점 7 (`≤ 2` 초과) · 시점 축의 새 phase 배정 창작 필요 · `db:5432` 오도와 CI step 중복 추가 risk 로 기각. 판정 근거 전문은 [REQ-COVERAGE-AUDIT § 12.40](../use-cases/REQ-COVERAGE-AUDIT.md).
- **판정 합계 — 검증 가능 15 row = 참 8 (전건 불성립 1 포함) · 부분참 3 · 거짓 4**, 검증 불가 3 ("가장 가볍다" 평가 · managed service 전환 전망 · "connection string 만 교체하면 동작" 전망) 은 대상 제외. 거짓 4 = pointer 1 (23-c) · 시점 3 (24-c · 25-b · 32).
- **planner 가설 검증 결과** — ① PostgreSQL + Prisma 채택 = **참** 확정, ② `postgres:16-alpine` 일치 · 양자 서술은 **부분참** (compose 단일 통합 경로로 확정), ③ service 이름은 실제로 **`postgres`** 라 `db:5432` 예시에 오도 risk 존속 (가설 적중), ④ `DATABASE_URL` 실재 참 + T-0015 시점 서술 낡음, ⑤ PrismaService 실 경로 `src/persistence/prisma.service.ts` 29 행 확인, ⑥ pool / timeout 4 키워드 **0 hit** 로 시점 낡음 + 미결정 잔존 겹침 확정, ⑦ ADR-0003 §1 = Monolithic 이라 worker 조건절 **전건 불성립**, ⑧ `migrate deploy` · `prisma/migrations/` 14 개 tracked = 참이나 **가설 일부 반증** — `prisma migrate dev` 는 `package.json` · CI · Dockerfile · `deploy/` 에서 **0 hit** 이라 개발 명령은 미등재 (부분참), ⑨ ci.yml 209 행 step 실재로 CI 통합 시점 서술 **낡음** 확정.
- **가설 밖 추가 발견** — 23 행이 인용한 `CLAUDE.md §1` 은 실제로 `기술 스택 (확정)` 이고 `single-operator` 어휘는 CLAUDE.md 전체 **0 hit** 이라 pointer 가 부정확하다 (CLAUDE.md 무편집 — Out of Scope).
- **불변 검산** — deployment.md 213 → **219** (+6/-0, hunk 1 = `@@ -33,0 +34,6 @@`) · audit 3962 → **4072** (+110, `§ 12.40` 110 행) · directory.md **203** · modules.md **259** 불변 · `^## ` 6 / 12 불변 · `^| REQ-` **66** 불변 · `^### 12\.` 39 → **40** · `src/` · `prisma/` · `deploy/` · `docker-compose.yml` · `.github/` · `package.json` 무변경 · 변경 **3 파일**.
- **R-110 / R-112** — `commitMode: direct` doc-only (production code 0 LOC · 분기 0) 라 CLAUDE.md §3.2 면제, `prisma migrate` · `docker compose` · `pnpm build` · `pnpm test` 미실행 (측정은 전부 read-only).

## Follow-ups

1. **`## DB / Persistence` 후반부 (현 40 ~ 55 행 — 각주 +6 반영 후) = 다음 slice 1 순위** — `### Backup / restore 전략` · `### Raw data 저장 금지 (REQ-032)` · `### 후속 진행`. REQ-032 축은 `prisma/schema.prisma` 의 `String` column 전수 판정이 필요해 단독 slice 가 적절. 이후 `## 개요` (5 ~ 14 행) 를 닫으면 deployment.md 전 단락 대조 완결.
2. **README 행 번호 pointer 유효성** — 후반부의 "README 57 행 (export / backup / restore)" 표기는 후반부 slice 소관.
3. **`CLAUDE.md` §1 pointer 부정확** — 23 행이 `§1` 을 single-operator 컨텍스트로 인용하나 §1 은 기술 스택이다. 운영 규칙 문서 수정은 별도 task 소관 (본 slice 는 audit 기록만).
4. 이월 — `deploy/README.md` ↔ deployment.md 배포 절차 정합 (`§ 12.39` FU4) · `@nestjs/config` 미도입 전수 sweep (`§ 12.39` FU3, ADR 게이트) · REQ 번호 체계 전수 sweep (`§ 12.38` FU3) · UC-09 `§ 5` participant 병기 (24 회째) · modules.md 카운트 claim 대조 (`§ 12.34` FU1) · 행 번호 → anchor 좌표계 이행 (18 회째, 본 각주로 34 행 이후 좌표 **+6** 이동) · 산문 tally drift-guard spec (`pr` mode 소관).
