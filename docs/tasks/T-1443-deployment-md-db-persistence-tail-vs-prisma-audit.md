---
id: T-1443
title: deployment.md `## DB / Persistence` 후반부 (40 ~ 55 행 — `### Backup / restore 전략` · `### Raw data 저장 금지 (REQ-032)` · `### 후속 진행`) 의 검증 가능 claim ↔ 실 `prisma/schema.prisma` · `deploy/README.md` · `docs/ops/runbook.md` · `.claude/agents/reviewer.md` · README 대조 + T-1442 Follow-up 1 계승 + audit §12.41
phase: P5
status: PENDING
commitMode: direct
coversReq: [REQ-029, REQ-032, REQ-043]
estimatedDiff: 200
estimatedFiles: 3
created: 2026-08-04
independentStream: uc-doc-audit-resync
dependsOn: [T-1442]
touchesFiles:
  - docs/architecture/deployment.md
  - docs/use-cases/REQ-COVERAGE-AUDIT.md
  - docs/tasks/T-1443-deployment-md-db-persistence-tail-vs-prisma-audit.md
plannerNote: "uc-doc-audit-resync 55 번째 slice — T-1442 Follow-up 1 (DB 후반부 · REQ-032 column 전수 축) 계승. doc-only 1.6x × inline-amend 아님"
---

# T-1443 — deployment.md `## DB / Persistence` 후반부 ↔ 실 schema · backup 자산 · reviewer 규약 대조

## Why

[T-1442](T-1442-deployment-md-db-persistence-head-vs-prisma-audit.md) 가 [deployment.md](../architecture/deployment.md) `## DB / Persistence` **전반부** (도입 · `### 배포 토폴로지` · `### Migration 정책`) 를 각주 1 블록으로 닫으면서 ([REQ-COVERAGE-AUDIT.md](../use-cases/REQ-COVERAGE-AUDIT.md) `§ 12.40`), **후반부를 다음 slice 1 순위** 로 명시 이월했다 (T-1442 Follow-up 1). 근거는 후반부의 REQ-032 축이 `prisma/schema.prisma` 의 `String` column **전수 판정** 을 요구해 단독 slice 가 적절하다는 것이다.

본 slice 는 `### Backup / restore 전략` · `### Raw data 저장 금지 (REQ-032) 의 schema-level 강제` · `### 후속 진행` 3 절을 대상으로, ① backup 도구 · 자동화 시점 claim ↔ 실 [deploy/README.md](../../deploy/README.md) · [docs/ops/runbook.md](../ops/runbook.md) 자산, ② raw-data 금지 claim ↔ 실 `prisma/schema.prisma` column, ③ "reviewer agent 가 `String` column 추가 시 REQ-032 위반을 REQUEST_CHANGES" 라는 **규약 claim ↔ 실 [.claude/agents/reviewer.md](../../.claude/agents/reviewer.md) 체크리스트**, ④ "P3 에서 진행" · "코드 변경 0 LOC" 시점 서술의 낡음 여부를 대조한다. 본 slice 를 닫으면 `## DB / Persistence` 단락이 완결되고, 잔여는 `## 개요` (5 ~ 14 행) 1 개뿐이라 deployment.md 전 단락 대조가 사정권에 든다.

**행 좌표 주의** — T-1442 각주 (+6 행) 가 `### Migration 정책` 말미 (현 34 ~ 38 행) 에 들어가 **본 slice 범위가 그만큼 밀렸다**. planner 실측 기준 현 좌표는 `### Backup / restore 전략` **40** · `### Raw data 저장 금지 (REQ-032) 의 schema-level 강제` **46** · `### 후속 진행` **52** · 다음 단락 `## 배포 토폴로지 (Monolithic vs worker 분리)` **56** (deployment.md 총 **219** 행). 그래도 AC 1 (i) 에서 재실측한다.

planner 사전 확인 — **아래는 전부 가설이며 전제가 아니다** (T-1437 Follow-up 4 · T-1440 AC 1 · T-1441 가설 ④ · T-1442 가설 ⑧ 이 planner 기대를 실측으로 반증한 선례가 4 회 있다). executor 는 AC 1 에서 전부 재측정하고, **기대와 다르면 그 축의 편집을 중단** 한다. ① 41 행 "`pg_dump` / `pg_restore` 로 backup 가능" 은 **참** 쪽 (repo 에 `pg_dump` 언급 자산 2 개 실재 — `deploy/README.md` · `docs/ops/runbook.md`). ② 같은 행의 **"README 57 행 (export / backup / restore)"** pointer 는 **부정확할 가능성** — planner 실측상 export/backup/restore 요구는 README 56 행 쪽이고 57 행은 재수집 중복 방지 서술로 보인다 (행 번호 pointer 의 drift 축). ③ 42 행 "자동 backup 은 **P7 phase 의 task**. 본 task 는 정책만 박제" 는 P7 이 이미 진입/진행 중이면 **시점 서술이 낡았거나** 자동화가 여전히 미도입인 두 축이 겹칠 가능성. ④ 43 행 "Migration history 도 함께 복원되어 schema 상태가 동기" 는 `pg_restore` 동작에 대한 **설계 서술** 로 검증 가능/불가 이분이 필요. ⑤ 47 행 "`schema.prisma` 에 commit/문서의 raw 본문 column 을 정의하지 않는다" 는 **전수 판정 필요** — `String` 출현이 74 회 · model 15 개라, raw 본문 보관으로 읽힐 수 있는 column (예: 본문/내용/message/body 계열) 이 실제로 0 인지 실측해야 한다. ⑥ 48 행 "**Schema PR 의 reviewer agent 는 `String` 타입 column 추가 시 … REQ-032 위반으로 REQUEST_CHANGES**" 는 planner grep 상 `.claude/agents/*.md` 에 `REQ-032` 어휘가 **0 hit** 이라 **미이행 규약** 일 가능성이 높다 (거짓 축 후보 1 순위). ⑦ 49 행 "구체 column 설계 / 인덱스 / unique constraint 는 **P3 Persistence layer task 에서 진행**" 은 schema 가 이미 존재하므로 **시점 낡음**. ⑧ 53 행 "migration 도구 실제 도입 (`prisma` package install) / PrismaService NestJS module 작성은 모두 P3 에서 진행 … 코드 변경은 0 LOC" 는 전부 이행돼 **시점 낡음** (본 단락이 P1 blueprint 시점 기록이라는 성격과의 긴장은 `§ 12.15` 방침으로 판정).

[PLAN.md](../PLAN.md) 의 미완 bullet (106 · 108 · 109 · 140 · 151) 은 owner 게이트 · 외부 credential · 새 dependency 게이트라 planner 단독 진행 불가이므로, 본 doc stream 이 현 시점 우선순위 최상위다.

## Required Reading

- `docs/architecture/deployment.md` — **219 행**. 다음 구간만 읽는다.
  - **40 ~ 55 행** (`### Backup / restore 전략` (40 ~ 44) + `### Raw data 저장 금지 (REQ-032) 의 schema-level 강제` (46 ~ 50) + `### 후속 진행` (52 ~ 54)) — 본 slice 의 **주 편집 후보 구간**.
  - **15 ~ 38 행** (`## DB / Persistence` 전반부 + T-1442 각주) — **무편집, 경계 확인 + 각주 화법 승계용** 으로만 읽는다.
  - **56 행 이후** — **무편집, 경계 확인만** (`## 배포 토폴로지` 이하 전 구간은 T-1437 이 이미 닫음).
  - **1 ~ 4 행** (문서 성격 선언 blockquote — "본 문서는 P1 T-A2 의 산출물") — **무편집**, 판정의 최강 제약.
- `docs/use-cases/REQ-COVERAGE-AUDIT.md` — **4072 행**. **`### 12.15`** (**1002** 행 — 시점 기록 append-only 처리 방침 정본) · **`### 12.40`** (**3949** 행 — T-1442 판정표 화법 template + Follow-up 1 원문) · **`## 11. References` (4059 행)** — `§ 12.41` 삽입 위치 경계. **그 밖의 절은 열지 않는다** (§7).
- `prisma/schema.prisma` — **무편집, 읽기만**. REQ-032 축의 핵심 대조 상대. **model / column 이름만** `grep` 으로 인용하고 **전문 read 금지** (§7).
- `deploy/README.md` · `docs/ops/runbook.md` — **무편집, 읽기만**. `pg_dump` / `pg_restore` 실 절차 등재 여부 판정 입력. **grep 인용만**.
- `.claude/agents/reviewer.md` — **무편집, 읽기만**. 48 행 규약 claim 의 이행 여부 판정 입력. **grep 인용만**.
- `README.md` — **무편집, 읽기만**. 41 행의 "README 57 행" pointer 유효성 판정 입력. **해당 행 부근만** `sed -n` 인용.
- `docs/PLAN.md` — **무편집, 읽기만**. `## Phase P7` (131 행) 존재 · 진행 표기만 확인 (42 행 시점 축 판정 입력). 본문 재판정 금지.
- `docs/decisions/ADR-0002-db.md` — **heading 목록만** (47 행이 인용한 `Decision §2` pointer 유효성 확인용). 본문 재판정 금지.
- `CLAUDE.md` §3 (task 크기 상한) · §3.2 (direct doc-only 면제) · §12 (언어 정책)

## Acceptance Criteria

- [ ] **AC 1 — 실측 선행 (날조 금지)**: 편집 전에 다음을 직접 측정해 `§ 12.41` 에 **명령과 출력을 함께** 인용한다. 기대값과 **다르면 그 축의 편집을 중단** 하고 불성립 사실을 `§ 12.41` 에 기록한다 (Why 의 ① ~ ⑧ 은 가설일 뿐이다).
  - (i) **단락 원문 + 좌표 재확인**: `grep -n '^#\{1,3\} ' docs/architecture/deployment.md` 로 heading 좌표를 **먼저 실측** 한 뒤 (본 AC 의 `40 ~ 55 행` 도 stale 일 수 있다 — T-1436 ~ T-1442 선례) 해당 범위를 `sed -n` 으로 인용한다. 이어 **실측으로 참·거짓을 가릴 수 있는 claim** (도구 이름 · 파일 경로 · column 이름 · 행 번호 pointer · agent 규약 · phase 표기) 만 뽑아 열거하고, 순수 설계 가정 · 운영 전망 (restore 후 schema 동기 서술 · "표준 도구 사용" 정책 선언 등) 은 **검증 불가 claim** 으로 분류해 판정 대상에서 제외한다. 이 이분 자체를 남긴다.
  - (ii) **backup 도구 축 (41 행)**: `grep -rn "pg_dump\|pg_restore" deploy docs/ops scripts package.json 2>/dev/null | head -8` 로 실 등재 지점을 인용해, "표준 `pg_dump` / `pg_restore` 로 backup 가능" 이 문서 밖 자산으로 뒷받침되는지 판정한다 (`참 / 부분참 / 거짓` 중 하나).
  - (iii) **README pointer 축 (41 행)**: `grep -n "export" README.md | head -6` 으로 export / backup / restore 요구 문장의 **실 행 번호** 를 인용하고, 문서가 적은 "README 57 행" 과 대조한다. 어긋나면 **행 번호 pointer drift** 로 판정하되 **README 는 무편집** 이다.
  - (iv) **자동화 시점 축 (42 행)**: `grep -rn "backup" .github/workflows/ci.yml deploy scripts src --include='*' 2>/dev/null | head -8` 로 자동 backup 자산 실재 여부를 인용하고, `grep -n "^## Phase P7" docs/PLAN.md` + `grep -n '"phase"' docs/STATE.json | head -2` 로 P7 진입 상태와 현 phase 를 대조해 "P7 phase 의 task" 서술이 **낡음 / 미이행 / 둘 다** 중 무엇인지 **축을 분리** 판정한다.
  - (v) **REQ-032 raw column 전수 축 (47 행)**: `grep -n "^model \|String" prisma/schema.prisma | head -40` 과 `grep -c "String" prisma/schema.prisma` · `grep -c "^model " prisma/schema.prisma` 로 규모를 인용한 뒤, **raw 본문 보관으로 읽힐 수 있는 column 후보** 를 `grep -n "body\|content\|message\|diff\|patch\|rawText\|raw " prisma/schema.prisma | head -12` 로 좁혀 **0 hit 인지, hit 이면 그 column 이 실제로 raw 본문인지** 를 1 구씩 판정한다. hit 이 있어도 **schema 는 무편집** 이며 사실만 기록한다 (수정은 `pr` mode + REQ 재해석 소관).
  - (vi) **reviewer 규약 축 (48 행)**: `grep -rn "REQ-032\|raw data\|raw 본문" .claude/agents/*.md | head -8` 로 reviewer 체크리스트의 실 등재 여부를 인용한다. 0 hit 이면 **"reviewer agent 는 … REQUEST_CHANGES" 가 미이행 규약** 임을 그대로 기록하고, 문서가 **미래 정책** 을 서술하는지 **현행 규약** 으로 서술하는지 원문 화법을 근거로 1 구 판정한다.
  - (vii) **P3 시점 축 (49 · 53 행)**: `ls -1 prisma/migrations | wc -l` · `grep -rn "class PrismaService" src --include='*.ts' | head -2` · `grep -n '"@prisma/client"\|"prisma"' package.json | head -4` · `grep -n "@@index\|@@unique\|@unique" prisma/schema.prisma | head -6` 으로 "column 설계 / 인덱스 / unique constraint / prisma install / PrismaService module" 이 **모두 이행됐는지** 를 인용한다. 이어 `§ 12.15` 의 시점 기록 append-only 방침이 이 축에 어느 강도로 걸리는지 1 구로 논증한다.
  - (viii) **pointer 유효성 축 (47 행)**: `grep -n '^## \|^### ' docs/decisions/ADR-0002-db.md | head -12` 로 문서가 인용한 `Decision §2` 절이 실재하고 raw-data 금지를 실제로 담는지 절 제목 수준에서 확인한다. **ADR 본문 재판정 · status 변경은 하지 않는다**.
  - (ix) baseline — `wc -l` deployment.md **219** · audit **4072** · directory.md **203** · modules.md **259**, `grep -c '^## '` deployment.md **6** · audit **12**, audit `grep -c '^| REQ-'` **66** · `grep -c '^### 12\.'` **40**.
- [ ] **AC 2 — 지점 판정표**: AC 1 이 뽑은 **검증 가능 claim** 각각에 대해 `in-place 수정` / `원문 보존 + 각주 부기` / `무편집` / `상위 slice 판정 승계` 중 하나를 판정한 표를 만든다. 각 row 는 **지점 (행) · claim 1 구 · 실측 결과 · 판정 (참 / 부분참 / 거짓) · 처리 · 근거 1 구** 6 컬럼.
  - 판정 기준 **3 축** 명시 — ① **문서 성격** (1 ~ 4 행 blockquote 의 P1 T-A2 blueprint 선언에 `§ 12.15` append-only 제약이 어느 강도로 걸리는가), ② `§ 12.15` **정합** (본 단락에 시점 marker 가 있는지 실측 grep 으로 근거를 둔다 — 42 · 49 · 53 행이 그 marker 후보다), ③ **선례** (T-1430 ~ T-1435 · T-1437 ~ T-1442 의 "원문 보존 + 실측 각주" vs [T-1429](T-1429-api-md-module-vocab-and-uc-range-resync.md) 의 in-place 1:1 치환 vs [T-1436](T-1436-directory-md-web-frontend-section-vs-src-audit.md) 의 혼합 채택).
  - **거짓 / 부분참 축 (README 행 pointer · reviewer 규약 미이행) 과 시점 축 (P7 자동화 · P3 column 설계 · P3 module 작성) 의 처리를 분리 판정** 한다 — 두 축의 처리가 갈려도 무방하나 그 이유를 각각 1 구로 적는다.
- [ ] **AC 3 — 처리 방식 판정**: 후보 4 개 중 **채택 1 · 기각 3** 인 판정표를 만든다. 기각마다 근거 1 구.
  - 후보 — (A) **전 지점 in-place 동기**, (B) **원문 무편집 + 후반부 말미 각주 blockquote 1 개 신설** (T-1437 ~ T-1442 화법 승계), (C) **혼합** (행 번호 pointer 만 in-place, 나머지는 각주), (D) **전 지점 무편집 + audit 기록만**.
  - 판정 기준 **4 축** 명시 — ① `§ 12.15` 정합, ② **오도 risk** (독자가 본 단락을 근거로 reviewer 가 REQ-032 를 자동 차단한다고 믿거나, 자동 backup 이 이미 도입됐다고 오인할 때의 비용), ③ **cap** — 예상 diff ≤ 300 LOC · 변경 파일 **3 고정** (초과 후보는 자동 기각 + split 제안 기록), ④ 선례 일관성.
- [ ] **AC 4 — 채택안 반영**: AC 3 채택안대로만 편집한다. 각 지점은 AC 2 판정 결과를 따른다.
  - **각주 blockquote 는 `### 후속 진행` 본문 말미 (현 54 행) 와 `## 배포 토폴로지 (Monolithic vs worker 분리)` heading (현 56 행) 사이에 삽입** 한다 — T-1442 가 전반부 말미에 각주를 둔 배치 (현 34 ~ 38 행) 와 동형. **각주 blockquote 1 개 (≤ 6 행) + in-place 치환 (≤ 2 지점) 이내**, `wc -l` 증가 **+7 이내** (219 → ≤ 226).
  - **문구 · column 이름 · 파일 경로 · 도구 이름 · 행 번호 · phase 표기는 AC 1 실측 출력과 1:1 일치** 해야 하며, 실측되지 않은 값 (존재하지 않는 column, 미도입 backup script 경로, 임의 phase 배정) 을 **새로 창작하지 않는다**.
  - **schema 의 실 데이터 · secret · connection string 을 문서에 옮겨 적지 않는다** — column **이름** 까지만 인용한다 (CLAUDE.md §9).
  - **1 ~ 4 행 blockquote 무편집** · **15 ~ 38 행 (DB 단락 전반부 + T-1442 각주) 무편집** · **56 행 이후 전 구간 무편집** (`## 배포 토폴로지` · `## Scheduler 위치` · `## Secret / 자격증명 저장` · `## 외부 네트워크 boundary` 및 T-1437 ~ T-1441 각주).
  - **새 pointer 추가 금지** — ADR-0002 외의 문서를 본문에 새로 등재하지 않는다 (audit 쪽에만 기록).
- [ ] **AC 5 — audit `§ 12.41` 신설**: [REQ-COVERAGE-AUDIT.md](../use-cases/REQ-COVERAGE-AUDIT.md) 의 `## 11. References` (4059 행) **직전** 에 `### 12.41 …` 절을 **순수 append** 한다 (기존 절 수정 0). 구성 — 본 절의 위치 · 계보 1 문단 / AC 1 실측 (명령 + 출력) / AC 2 지점 판정표 / AC 3 처리 판정표 / AC 4 반영 결과 + 무편집 경계 / **T-1442 Follow-up 1 closure 선언 + `## DB / Persistence` 단락 완결 선언** / **deployment.md 잔여 미대조 갱신 (`## 개요` 1 개)** / 파생 영향 (목록만) / 불변 검산 / 한계. **절 전체 ≤ 110 행** (cap 준수 — 초과 시 실측 인용을 요약형으로 압축).
  - `###` 레벨이라 `grep -c '^## '` **12 불변** · `grep -c '^| REQ-'` **66 불변** · `grep -c '^### 12\.'` **40 → 41**.
- [ ] **AC 6 — 불변 검산**: 다음을 실행해 출력을 `§ 12.41` 에 인용한다. `wc -l` deployment.md (219 → ≤ 226) · audit (4072 → +110 이내) · directory.md (**203 불변**) · modules.md (**259 불변**), `git diff -U0 -- docs/architecture/deployment.md | grep '^@@'` 로 **hunk 개수 · 위치** 를 보이고 AC 4 허용 구간 밖 hunk **0** 을 실증, `git diff --numstat` 으로 **순수 삭제 0** (삭제 행이 있으면 in-place 치환의 짝임을 1 구로 설명), `git status --porcelain src/ test/ prisma/ web/ deploy/ docker-compose.yml .github/ package.json README.md .claude/` **빈 출력** (코드 · 스키마 · 배포자산 · CI · 의존성 · agent 정의 무변경), `git status --porcelain` 이 **3 파일** 임을 확인.
- [ ] **AC 7 — 파생 영향 기록 (목록만, 본 slice 편집 금지)**: `§ 12.41` 말미에 후속 slice 대상을 목록으로 남긴다. 최소 포함 — (1) **`## 개요` (5 ~ 14 행) = 다음 slice 1 순위** + 근거 1 구 (닫으면 deployment.md 전 단락 대조 완결), (2) **reviewer 규약 미이행 사실** 의 처리 경로 — `.claude/agents/reviewer.md` 수정은 별도 direct task 소관 (본 slice 는 audit 기록만), (3) **README 행 번호 pointer drift** 의 전수 sweep 후보, (4) `deploy/README.md` ↔ deployment.md 배포 절차 정합 (T-1441 Follow-up 3 미소진), (5) `@nestjs/config` 미도입 전수 sweep (`§ 12.39` FU3, ADR 게이트), (6) REQ 번호 체계 잔재 전수 sweep (`§ 12.38` FU3 미소진), (7) `CLAUDE.md` §1 pointer 부정확 (T-1442 FU3 미소진), (8) UC-09 `§ 5` sequence participant 병기 (25 회째 이월), (9) 정본 [modules.md](../architecture/modules.md) 카운트 claim 대조 (`§ 12.34` FU1 미소진 — ADR 게이트), (10) 행 번호 → anchor 좌표계 이행 (19 회째), (11) 산문 tally ↔ 실측 CI drift-guard spec (`pr` mode 소관).
- [ ] **AC 8 — R-110 / R-112 면제 근거 명시**: 본 task 는 `commitMode: direct` doc-only 로 production code **0 LOC** · 분기 **0** 이라 [CLAUDE.md](../../CLAUDE.md) §3.2 direct-mode 면제 조항에 따라 tester 호출 · happy / error / flow / negative 4 항목 · `pnpm test:cov` 가 **N/A** 임을 `§ 12.41` 에 1 구로 명시한다.
- [ ] **AC 9 — 언어 · 링크 규약**: 추가 문장은 모두 한국어 (§12), 문서 간 참조는 상대경로 markdown 링크, 수치는 실측 출력과 1:1 일치.

## Out of Scope

- **코드 · 스키마 · 배포 자산 · CI · agent 정의 변경 절대 금지** — `src/` · `test/` · `prisma/` · `web/` · `scripts/` · `deploy/` · `docker-compose.yml` · `Dockerfile` · `.github/workflows/` · `package.json` · `.claude/agents/` 는 diff 에 등장하면 안 된다. 특히 **raw 본문 후보 column 발견 시에도 schema 를 고치지 않으며**, reviewer 체크리스트에 REQ-032 항목을 추가하지 않는다 (문서를 실제에 맞출 뿐, 실제를 문서에 맞추지 않는다).
- **`## DB / Persistence` 전반부 (15 ~ 38 행) 편집 금지** — T-1442 가 이미 닫았다. 그 각주의 문구 · 수치도 손대지 않는다.
- **56 행 이후 전 구간 편집 금지** — T-1437 ~ T-1441 이 닫은 단락과 각주는 무편집.
- **README 편집 금지** — 행 번호 pointer 가 어긋나도 deployment.md 쪽 각주 기록까지만 (README 는 요구사항 정본, §3.1 별개 소관).
- **`docs/PLAN.md` 편집 금지** — P7 진행 표기 확인까지만. phase 상태 갱신은 driver 소관.
- **DB 접속 · backup / restore 실행 금지** — `pg_dump` · `pg_restore` · `prisma migrate` · `docker compose up` · `pnpm build` · `pnpm test` 어느 것도 실행하지 않는다 (측정은 전부 read-only grep / ls).
- **배포 호스트 상태 측정 금지** — repo 밖 파일시스템 · 실 DB 인스턴스 · 실 backup 파일은 판정 대상이 아니다.
- **ADR-0002 본문 재판정 · status 변경 금지** — 절 존재 확인까지만. REQ-032 정책 자체의 재해석은 owner 게이트.
- **[deploy/README.md](../../deploy/README.md) · [docs/ops/runbook.md](../ops/runbook.md) 편집 금지** — 정합 판정 필요 사실은 파생 영향 목록에만 남긴다.
- **정본 [modules.md](../architecture/modules.md) · [directory.md](../architecture/directory.md) · [api.md](../architecture/api.md) · [data-model.md](../architecture/data-model.md) 편집 금지** — 본 slice 는 deployment.md DB 후반부만 닫는다.
- **다른 문서로의 cascade 금지** — [components.md](../architecture/components.md) · `docs/architecture/INDEX.md` · [INDEX.md](../use-cases/INDEX.md) · `UC-01` ~ `UC-09` · ADR · [PLAN.md](../PLAN.md) · [requirements.md](../requirements.md) 는 무편집.
- **행 번호 → anchor 좌표계 이행 금지** — 파생 영향 목록에만 남긴다 (19 회째 이월).
- **CI drift-guard spec 작성 금지** — `pr` mode 소관이라 본 direct task 에서 진행하면 §3.1 위반.
- **audit 기존 절 (`§ 12.1` ~ `§ 12.40`) 수정 금지** — `§ 12.41` 순수 append 만.

## Suggested Sub-agents

`implementer` 단독 (doc-only, 코드 0 LOC — architect · tester 불요. §3.2 direct-mode 면제).

## Follow-ups

(비어 있음 — 작업 중 발견 사항을 여기에 append)
