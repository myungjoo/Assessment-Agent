---
id: T-1438
title: deployment.md `## Scheduler 위치` 단락 (107 ~ 145 행) 의 검증 가능 claim ↔ 실 `src/scheduling/` · `src/app.module.ts` · `prisma/schema.prisma` 대조 + T-1437 Follow-up 1 closure + audit §12.36
phase: P5
status: DONE
commitMode: direct
coversReq: [REQ-039, REQ-040]
estimatedDiff: 200
estimatedFiles: 3
created: 2026-08-04
independentStream: uc-doc-audit-resync
dependsOn: [T-1437]
touchesFiles:
  - docs/architecture/deployment.md
  - docs/use-cases/REQ-COVERAGE-AUDIT.md
  - docs/tasks/T-1438-deployment-md-scheduler-section-vs-src-audit.md
plannerNote: "uc-doc-audit-resync 50 번째 slice — T-1437 Follow-up 1 (`## Scheduler 위치` ↔ 실 src/scheduling/ 대조) 1 순위 계승. doc-only 1.6x"
completedAt: 2026-08-04T01:50:00Z
resultCommit: 03e812ed
---

# T-1438 — deployment.md `## Scheduler 위치` 단락 ↔ 실 `src/scheduling/` 대조

## Why

[T-1437](T-1437-deployment-md-topology-section-vs-src-audit.md) 이 [deployment.md](../architecture/deployment.md) 의 `## 배포 토폴로지` 단락을 닫으면서 ([REQ-COVERAGE-AUDIT.md](../use-cases/REQ-COVERAGE-AUDIT.md) `§ 12.35`) **잔여 미대조 5 단락 중 `## Scheduler 위치` 를 다음 slice 1 순위** 로 지정했다 (audit 3478 행 + T-1437 Follow-up 1). 근거는 `§ 12.35` 실측이 `@Cron(` **0 hit** (선언형 cron job 0, 등록은 `SchedulerRegistry` 동적형) 을 잡았는데 그 의미를 판정할 소관 단락이 바로 본 단락이라는 것이다.

대상 구간은 `## Scheduler 위치` (107 ~ 145 행) 이며 하위 4 절 (`### cron 주기 설정 흐름 (REQ-039)` · `### Manual trigger 흐름 (REQ-040)` · `### 동시 실행 방지` · `### 후속 task 책임`) 로 구성된다. 이 구간은 **route · service 클래스명 · 메서드명 · 영속화 대상** 을 구체적으로 열거하는 운영/연결 문서라 stale 시 오도 비용이 크다 — 특히 두 개의 code-block flow 는 "무엇을 호출하면 평가가 돈다" 를 지시하는 서술이다.

planner 사전 확인 — **아래는 전부 가설이며 전제가 아니다** (T-1437 Follow-up 4 의 박제: planner 기대 ② 가 실측에 반증된 선례가 있다). executor 는 AC 1 에서 전부 재측정하고, **기대와 다르면 그 축의 편집을 중단** 한다. ① 117 · 130 행의 route (`PATCH /admin/schedule` · `POST /admin/evaluation/trigger`) 는 실 `@Controller("api/schedules")` + `@Get()` / `@Post("trigger")` 와 어긋날 가능성. ② 118 · 131 · 132 행의 심볼 (`ScheduleService.updateCron` · `EvaluationController.triggerNow` · `EvaluationOrchestrator.runFullAssessment`) 은 실 `CronScheduleService` (`registerOrReplace` / `remove` / `list` / `exists`) · `CronScheduleController` · `EvaluationOrchestratorService` 와 명칭이 갈릴 가능성. ③ 119 · 124 행의 "DB 의 schedule 설정 row 갱신" · "cron 표현식이 DB 에 저장되어 process restart 후에도 복원" 은 `prisma/schema.prisma` 에 대응 model 이 없다면 **미shipped (거짓 또는 부분참)**. ④ 144 행 "`@nestjs/schedule` 의 실제 도입 … 은 P7 phase 책임" 은 `package.json` 등재 + `app.module.ts` 의 `ScheduleModule.forRoot()` 로 **이미 shipped** 라 시점 서술이 낡았을 가능성. ⑤ 111 행 채택 선언과 138 ~ 140 행 동시 실행 방지 (P5 책임) 는 별도 판정.

[PLAN.md](../PLAN.md) 의 미완 bullet (106 · 108 · 109 · 140 · 151) 은 owner 게이트 · 외부 credential · 새 dependency 게이트라 planner 단독 진행 불가이므로, 본 doc stream 이 현 시점 우선순위 최상위다.

## Required Reading

- `docs/architecture/deployment.md` — **192 행**. 다음 구간만 읽는다.
  - **107 ~ 145 행** (`## Scheduler 위치` heading + 109 행 ADR pointer + 111 행 채택 선언 + `### cron 주기 설정 흐름 (REQ-039)` code-block + 124 행 산문 + `### Manual trigger 흐름 (REQ-040)` code-block + 136 행 산문 + `### 동시 실행 방지` + `### 후속 task 책임`) — 본 slice 의 **주 편집 후보 구간**.
  - **1 ~ 4 행** (문서 성격 선언 blockquote — "본 문서는 P1 T-A2 의 산출물") — **무편집**, 판정의 최강 제약.
  - **50 ~ 80 행** (`## 배포 토폴로지` + T-1437 이 삽입한 각주 blockquote) — **무편집**. 각주 화법 선례 참고용 + 중복 각주 회피 판정 입력.
- `docs/use-cases/REQ-COVERAGE-AUDIT.md` — **3517 행**. **`### 12.15`** (시점 기록 append-only 처리 방침 정본) · **`### 12.35`** (**3389** 행 — T-1437 판정표 화법 template + 각주 1 블록 채택 선례 + 3470 행 "deployment.md 잔여 미대조 5" 이월 선언 + 3478 행 Follow-up 5 + 3501 행 한계 1) · **`## 11. References` (3504 행)** — `§ 12.36` 삽입 위치 경계.
- `src/scheduling/cron-schedule.controller.ts` · `src/scheduling/cron-schedule.service.ts` — **무편집, 읽기만**. route decorator · 클래스명 · public 메서드명 축 판정 입력.
- `src/app.module.ts` — **무편집, 읽기만**. `ScheduleModule.forRoot()` 등록 여부 (144 행 축).
- `prisma/schema.prisma` — **무편집, 읽기만**. cron 설정 영속 model 존재 여부 (119 · 124 행 축). `grep -n '^model '` 만으로 충분.
- `CLAUDE.md` §3 (task 크기 상한) · §3.2 (direct doc-only 면제) · §12 (언어 정책)

## Acceptance Criteria

- [x] **AC 1 — 실측 선행 (날조 금지)**: 편집 전에 다음을 직접 측정해 `§ 12.36` 에 **명령과 출력을 함께** 인용한다. 기대값과 **다르면 그 축의 편집을 중단** 하고 불성립 사실을 `§ 12.36` 에 기록한다 (Why 의 ① ~ ⑤ 는 가설일 뿐이다).
  - (i) **단락 원문 전수 + 좌표 재확인**: `grep -n '^#\{1,3\} ' docs/architecture/deployment.md` 로 heading 좌표를 **먼저 실측** 한 뒤 (본 AC 의 `107 ~ 145 행` 도 stale 일 수 있다 — T-1436 · T-1437 선례) 해당 범위를 `sed -n` 으로 인용한다. 이어 **실측으로 참·거짓을 가릴 수 있는 claim** (route · 클래스/메서드 명칭 · dependency 등재 · 영속 model 존재 · shipped 여부) 만 뽑아 열거하고, 순수 설계 의도 · 후속 책임 배분 서술은 **검증 불가 claim** 으로 분류해 판정 대상에서 제외한다. 이 이분 자체를 남긴다.
  - (ii) **route 축 (117 · 130 행)**: `grep -n "@Controller\|@Get\|@Post\|@Patch\|@Delete" src/scheduling/cron-schedule.controller.ts` 1 회로 실 route 를 인용하고 문서의 `PATCH /admin/schedule` · `POST /admin/evaluation/trigger` 와 **경로 prefix · HTTP method 두 축** 으로 대조한다. 판정은 `참 / 부분참 / 거짓` 중 하나.
  - (iii) **심볼 축 (118 · 131 · 132 · 136 행)**: `grep -n "export class\|^  [a-zA-Z]\+(" src/scheduling/cron-schedule.service.ts src/scheduling/cron-schedule.controller.ts` + `grep -rn "class EvaluationOrchestrator" src --include='*.ts' | grep -v spec` + `grep -rn "runFullAssessment" src --include='*.ts' | head` 로 — `ScheduleService.updateCron` · `EvaluationController.triggerNow` · `EvaluationOrchestrator.runFullAssessment` 3 심볼의 **실재 여부** 를 판정한다. hit 0 이면 "실재 0" 을 그대로 기록한다 (유사 심볼로 임의 치환 금지 — 실측된 실 명칭만 인용).
  - (iv) **영속화 축 (119 · 124 행)**: `grep -n '^model ' prisma/schema.prisma` + `grep -rn "SchedulerRegistry" src/scheduling/cron-schedule.service.ts` 를 인용해 — cron 설정이 **DB row 로 영속** 되는지, 아니면 **in-memory registry 전용** 인지 판정한다. 영속 model 부재가 확인되면 124 행의 "process restart 후에도 복원" 은 **미shipped** 로 분류한다.
  - (v) **dependency / 도입 시점 축 (111 · 144 행)**: `grep -n "@nestjs/schedule" package.json` + `grep -n "ScheduleModule" src/app.module.ts` + `grep -rn "@Cron(" src --include='*.ts' | grep -v spec | head` 를 인용해 — 채택 선언 (111 행) 의 shipped 여부와 144 행 "P7 phase 도입 책임" 서술의 **현재 유효성** 을 판정한다. `@Cron(` 0 hit 이면 `§ 12.35` 실측 (선언형 0 · 동적 등록) 과의 **일치 확인 1 구** 를 남긴다 (T-1437 Follow-up 1 의 직접 답).
  - (vi) **동시 실행 방지 축 (140 행)**: `grep -rn "RUNNING\|mutex\|isRunning" src/scheduling src/assessment-evaluation --include='*.ts' | grep -v spec | head` 1 회로 in-process mutex 또는 `status=RUNNING` 검사의 실재 여부만 확인한다. **구현 설계 제안 금지** — 실재 여부 기록까지만.
  - (vii) **pointer 유효성 축**: `ls docs/decisions/ADR-0003-deployment.md docs/decisions/ADR-0042-*.md docs/tasks/T-0412-*.md 2>&1` 로 단락 · 코드 주석이 인용한 근거 파일 실재를 확인한다. **ADR 본문 재판정은 하지 않는다** (파일 존재 = pointer 유효까지만).
  - (viii) baseline — `wc -l` deployment.md **192** · audit **3517** · directory.md **203** · modules.md **259**, `grep -c '^## '` deployment.md **6** · audit **12**, audit `grep -c '^| REQ-'` **66** · `grep -c '^### 12\.'` **35**.
- [x] **AC 2 — 지점 판정표**: AC 1 이 뽑은 **검증 가능 claim** 각각에 대해 `in-place 수정` / `원문 보존 + 각주 부기` / `무편집` / `상위 slice 판정 승계` 중 하나를 판정한 표를 만든다. 각 row 는 **지점 (행) · claim 1 구 · 실측 결과 · 판정 (참 / 부분참 / 거짓) · 처리 · 근거 1 구** 6 컬럼.
  - 판정 기준 **3 축** 명시 — ① **문서 성격** (1 ~ 4 행 blockquote 의 P1 T-A2 blueprint 선언에 `§ 12.15` append-only 제약이 어느 강도로 걸리는가), ② `§ 12.15` **정합** (본 단락에 시점 marker 가 있는지 실측 grep 으로 근거를 둔다), ③ **선례** (T-1430 ~ T-1435 · T-1437 의 "원문 보존 + 실측 각주" vs [T-1429](T-1429-api-md-module-vocab-and-uc-range-resync.md) 의 in-place 1:1 치환 vs [T-1436](T-1436-directory-md-web-frontend-section-vs-src-audit.md) 의 혼합 채택).
  - **code-block 내부 claim 의 처리를 별도 판정** 한다 — 117 ~ 121 행 · 129 ~ 133 행은 코드블록 안이라 [T-1430](T-1430-directory-md-module-coordinate-resync.md) 이 ASCII tree 코드블록을 **무편집** 으로 판정한 선례가 걸린다. 그 선례를 승계할지 여부를 **1 구로 논증** 한다 (승계 시 각주로만 처리).
  - **미shipped 축 (영속화 · 동시 실행 방지) 과 명칭 어긋남 축 (route · 심볼) 의 처리를 분리 판정** 한다 — 전자는 blueprint 의 미래 서술로 성립할 여지가 있고, 후자는 **shipped 코드가 이미 다른 이름으로 존재** 하는 어긋남이라 성격이 다르다. 한 slice 안에서 처리가 갈려도 무방하나 그 이유를 반드시 1 구로 적는다.
- [x] **AC 3 — 처리 방식 판정**: 후보 4 개 중 **채택 1 · 기각 3** 인 판정표를 만든다. 기각마다 근거 1 구.
  - 후보 — (A) **전 지점 in-place 동기** (route · 심볼을 실 명칭으로 치환), (B) **단락 원문 무편집 + 단락 말미 각주 blockquote 1 개 신설** (T-1437 화법 승계), (C) **혼합** (코드블록 밖 산문만 in-place, 코드블록은 각주), (D) **전 지점 무편집 + audit 기록만**.
  - 판정 기준 **4 축** 명시 — ① `§ 12.15` 정합, ② **운영 오도 risk** (운영자가 문서의 route 로 실제 호출을 시도하면 404 가 되는가 — 본 문서는 연결 지시 문서라 risk 가중치가 높다는 점을 1 구로 논증), ③ **cap** — 예상 diff ≤ 300 LOC · 변경 파일 **3 고정** (초과 후보는 자동 기각 + split 제안 기록), ④ 선례 일관성.
- [x] **AC 4 — 채택안 반영**: AC 3 채택안대로만 편집한다. 각 지점은 AC 2 판정 결과를 따른다.
  - **deployment.md 편집은 각주 blockquote 1 개 (≤ 4 행) + in-place 치환 (≤ 3 지점) 이내** — `wc -l` 증가 **+5 이내** (192 → ≤ 197).
  - **문구·경로·심볼명은 AC 1 실측 출력과 1:1 일치** 해야 하며, 실측되지 않은 동작 (예: 실제 cron 등록 주기 default 값, 미구현 mutex 의 설계) 을 **새로 창작하지 않는다**.
  - **1 ~ 4 행 blockquote 무편집** · **`## Scheduler 위치` 밖 전 구간 무편집** (`## 개요` · `## DB / Persistence` · `## 배포 토폴로지` · `## Secret / 자격증명 저장` · `## 외부 네트워크 boundary`).
  - **새 pointer 추가 금지** — ADR-0003 · ADR-0042 · T-0412 중 이미 본문에 없는 것을 새로 등재하지 않는다 (audit 쪽에만 기록).
- [x] **AC 5 — audit `§ 12.36` 신설**: [REQ-COVERAGE-AUDIT.md](../use-cases/REQ-COVERAGE-AUDIT.md) 의 `## 11. References` (3504 행) **직전** 에 `### 12.36 …` 절을 **순수 append** 한다 (기존 절 수정 0). 구성 — 본 절의 위치 · 계보 1 문단 / AC 1 실측 (명령 + 출력) / AC 2 지점 판정표 / AC 3 처리 판정표 / AC 4 반영 결과 + 무편집 경계 / **T-1437 Follow-up 1 (`@Cron` 0 의 의미 판정) closure 선언** / **deployment.md 잔여 미대조 단락 갱신** (5 → 4, 남은 목록 명시) / 파생 영향 (목록만) / 불변 검산 / 한계. **절 전체 ≤ 115 행** (cap 준수 — 초과 시 실측 인용을 요약형으로 압축).
  - `###` 레벨이라 `grep -c '^## '` **12 불변** · `grep -c '^| REQ-'` **66 불변** · `grep -c '^### 12\.'` **35 → 36**.
- [x] **AC 6 — 불변 검산**: 다음을 실행해 출력을 `§ 12.36` 에 인용한다. `wc -l` deployment.md (192 → ≤ 197) · audit (3517 → +115 이내) · directory.md (**203 불변**) · modules.md (**259 불변**), `git diff -U0 -- docs/architecture/deployment.md | grep '^@@'` 로 **hunk 개수 · 위치** 를 보이고 AC 4 허용 구간 밖 hunk **0** 을 실증, `git diff --numstat` 으로 **순수 삭제 0** (삭제 행이 있으면 in-place 치환의 짝임을 1 구로 설명), `git status --porcelain src/ test/ prisma/ web/ package.json` **빈 출력** (코드 무변경), `git status --porcelain` 이 **3 파일** 임을 확인.
- [x] **AC 7 — 파생 영향 기록 (목록만, 본 slice 편집 금지)**: `§ 12.36` 말미에 후속 slice 대상을 목록으로 남긴다. 최소 포함 — (1) deployment.md 잔여 미대조 단락 **4** (`## 외부 네트워크 boundary` · `## Secret / 자격증명 저장` · `## DB / Persistence` · `## 개요`) 와 그 우선순위 1 구, (2) UC-01 `§ 5` 의 cron / manual trigger 서술 ↔ 본 slice 실측 route 정합 (미대조), (3) UC-09 `§ 5` sequence participant 병기 (20 회째 이월), (4) 정본 [modules.md](../architecture/modules.md) "WebModule 의 frontend 분리" 단락 카운트 claim 대조 (`§ 12.34` Follow-up 1 미소진 — ADR 게이트), (5) 행 번호 → anchor 좌표계 이행 (14 회째), (6) 산문 tally ↔ 실측 CI drift-guard spec (`pr` mode 소관).
- [x] **AC 8 — R-110 / R-112 면제 근거 명시**: 본 task 는 `commitMode: direct` doc-only 로 production code **0 LOC** · 분기 **0** 이라 [CLAUDE.md](../../CLAUDE.md) §3.2 direct-mode 면제 조항에 따라 tester 호출 · happy / error / flow / negative 4 항목 · `pnpm test:cov` 가 **N/A** 임을 `§ 12.36` 에 1 구로 명시한다.
- [x] **AC 9 — 언어 · 링크 규약**: 추가 문장은 모두 한국어 (§12), 문서 간 참조는 상대경로 markdown 링크, 수치는 실측 출력과 1:1 일치.

## Out of Scope

- **코드 변경 절대 금지** — `src/` · `test/` · `prisma/` · `web/` · `scripts/` · `package.json` 은 diff 에 등장하면 안 된다. 특히 route rename, `CronScheduleService` 메서드 추가, cron 설정 영속 model 신설, mutex 구현은 **어떤 경우에도 하지 않는다** (문서를 코드에 맞출 뿐, 코드를 문서에 맞추지 않는다).
- **테스트 · 빌드 실행 금지** — `pnpm build` · `pnpm test` 어느 것도 실행하지 않는다 (측정만).
- **deployment.md 의 `## Scheduler 위치` 밖 단락 편집 금지** — 잔여 4 단락은 파생 영향 목록에만 남긴다.
- **정본 [modules.md](../architecture/modules.md) · [directory.md](../architecture/directory.md) · [api.md](../architecture/api.md) 편집 금지** — 본 slice 는 deployment.md 축만 닫는다. 실 route (`api/schedules`) 를 api.md endpoint 표와 대조하는 작업도 별도 slice 소관.
- **ADR-0003 · ADR-0042 본문 재판정 · status 변경 금지** — 파일 존재 확인까지만.
- **다른 문서로의 cascade 금지** — [components.md](../architecture/components.md) · [data-model.md](../architecture/data-model.md) · `docs/architecture/INDEX.md` · [INDEX.md](../use-cases/INDEX.md) · `UC-01` ~ `UC-09` · ADR · [PLAN.md](../PLAN.md) · [requirements.md](../requirements.md) 는 무편집.
- **행 번호 → anchor 좌표계 이행 금지** — 파생 영향 목록에만 남긴다 (14 회째 이월).
- **CI drift-guard spec 작성 금지** — `pr` mode 소관이라 본 direct task 에서 진행하면 §3.1 위반.
- **audit 기존 절 (`§ 12.1` ~ `§ 12.35`) 수정 금지** — `§ 12.36` 순수 append 만.

## Suggested Sub-agents

`implementer` 단독 (doc-only, 코드 0 LOC — architect · tester 불요. §3.2 direct-mode 면제).

## Follow-ups

1. **deployment.md 잔여 미대조 단락 4 (다음 slice 1 순위 = `## 외부 네트워크 boundary`)** — 접근 대상 목록 · TLS · REQ-020 권한 부족 흐름이 실 `src/github/` · `src/confluence/` · `PermissionDeniedRecord` model 과 대조 가능해 검증 가능 claim 밀도가 가장 높다. 이어 `## Secret / 자격증명 저장` · `## DB / Persistence` · `## 개요`.
2. **route 표기 3 문서 정합 (deployment.md · [api.md](../architecture/api.md) · UC-01 `§ 5`)** — 본 slice 는 deployment.md 축만 닫았다. 실 `api/schedules` 4 endpoint 가 api.md endpoint 표 · UC-01 cron / manual trigger 서술과 어긋나는지 미판정 (`§ 12.36` 파생 영향 2 · 한계 2).
3. **cron 등록의 restart 휘발성** — `@Cron` 0 · registry 동적 등록의 대가로 process restart 시 등록 cron 이 전부 사라진다 (`§ 12.36` closure 선언). 영속 model 신설은 schema 변경이라 §5 BLOCKED 게이트 대상 — doc slice 가 아니라 별도 ADR 판단.
4. **정본 [modules.md](../architecture/modules.md) "WebModule 의 frontend 분리" 단락 카운트 claim 대조** — `§ 12.34` Follow-up 1 미소진 (정본 편집은 ADR 게이트).
5. **행 번호 → anchor 좌표계 이행** (14 회째 이월) — 본 slice 의 각주 5 행 삽입으로 `## 외부 네트워크 boundary` 가 146 → **151** 행으로 밀려 후속 task 좌표가 다시 낡는다.
