---
id: T-1452
title: components.md `## Component table` **Scheduler row (126 행)** 의 검증 가능 claim ↔ 실 `src/scheduling/**` 인벤토리 · `ADR-0003 §3` 재측정 · REQ 대조 + T-1451 FU1 (표 완결 slice) + audit §12.50
phase: P5
status: DONE
commitMode: direct
coversReq: [REQ-039, REQ-040]
estimatedDiff: 200
estimatedFiles: 3
created: 2026-08-04
independentStream: uc-doc-audit-resync
dependsOn: [T-1451]
touchesFiles:
  - docs/architecture/components.md
  - docs/use-cases/REQ-COVERAGE-AUDIT.md
  - docs/tasks/T-1452-components-md-scheduler-row-vs-src-scheduling-audit.md
plannerNote: "uc-doc-audit-resync 64 번째 slice — T-1451 FU1 (Scheduler row 단독, 표 완결) 계승. ADR-0003 §3 은 승계 불가라 재측정. doc-only 1.6x"
---

# T-1452 — components.md `## Component table` Scheduler row ↔ 실 `src/scheduling/**` · `ADR-0003 §3` 재측정 · REQ 대조

## Why

[T-1451](T-1451-components-md-confluence-adapter-row-vs-src-confluence-audit.md) 이 [components.md](../architecture/components.md) `## Component table` 의 `Confluence Adapter` row 를 판정하며 재-split 둘째 slice 를 집행했고 ([REQ-COVERAGE-AUDIT.md](../use-cases/REQ-COVERAGE-AUDIT.md) `§ 12.49`), 그 파생 영향 (1) 이 **다음 slice 1 순위를 `Scheduler` row (126 행) 단독** 으로 지목했다. 본 task 는 그 지목을 집행한다. **이 row 를 닫으면 `## Component table` 전 7 row 대조가 완결** 된다.

`§ 12.49` 는 `Scheduler` row 의 pointer 축이 `ADR-0003 §3 (@nestjs/schedule in-process)` 라 `§ 12.47` ~ `§ 12.49` 가 3 회 승계해 온 **`§4` 판정을 재승계할 수 없다** 고 못박았다 — 본 slice 는 `§3` 좌표를 **직접 재측정** 한다. 또 이 row 는 "in-process cron + manual trigger 단일 진입점" · "DB 저장 + restart 복원" · "SchedulerRegistry dynamic 등록" · "manual trigger duplication 0" · "`@Cron` decorator handler" 로 **검증 가능 claim 밀도가 앞 6 row 중 어느 것보다 높아** 본 slice 도 **1 row 단독** 으로 유지해 cap (≤ 300 LOC / ≤ 5 파일) 안에 둔다.

대조 축은 넷이다. ① **책임 축** ("`@nestjs/schedule` 기반 in-process cron + manual trigger 단일 진입점" · "cron 표현식은 DB 에 저장되어 process restart 후에도 복원" · "Admin UI 의 cron 갱신은 SchedulerRegistry 의 dynamic 등록" · "manual trigger 는 Backend API endpoint 가 동일 service 메서드 호출 — duplication 0") ↔ 실 `src/scheduling/**` 인벤토리 · `prisma/schema.prisma`, ② **contract 축** ("입력: 시간 trigger (cron) 또는 Backend API endpoint 의 manual trigger" · "출력: Worker 또는 Backend API service 메서드의 in-process invocation (`@Cron` decorator handler)") ↔ 실 controller 표면 · registry 등록 경로, ③ **pointer 축** (`ADR-0003 §3 (@nestjs/schedule in-process)` — **승계 불가, 재측정 대상** · `P7 Scheduling & ops task`) 의 대상 실재 + § 번호 · phase 좌표 부합, ④ **REQ ID 축** (REQ-039 / REQ-040) 의 [requirements.md](../requirements.md) 실재 + 괄호 병기 문구 부합.

planner 사전 확인 — **아래는 전부 가설이며 전제가 아니다** (T-1440 AC 1 · T-1446 의 `AuthGate` 부분참 · T-1447 의 `RBAC` 이름 상이 · T-1448 의 `ADR-0003 §1` 좌표 drift · T-1449 의 `generate` 시그니처 부분참 · T-1450 의 `fetchCommits` 0 hit · T-1451 의 `listPages` / `fetchPageVersion` 0 hit 판정이 planner 기대를 실측으로 반증하거나 정정한 선례가 13 회 있다). executor 는 AC 1 에서 전부 재측정하고 **기대와 다르면 그 축의 편집을 중단** 한다. ① planner 훑기상 `prisma/schema.prisma` 에 `model *Schedule*` / `model *Cron*` 이 **0 hit** 이고 `src/scheduling/*.ts` 에 `onModuleInit` / `restore` 도 **0 hit** 이라 **"DB 에 저장되어 process restart 후에도 복원" 은 거짓 또는 미구현** 일 가능성이 크다 (다른 module 이 영속화할 여지는 실측으로 가른다). ② **"`@Cron` decorator handler" 는 거짓 가능** — `src/app.module.ts` **51** 행 주석이 "정적 `@Cron` job 정의 0" 을 명시하고 실 등록 경로는 `CronScheduleService` 의 `SchedulerRegistry` 동적 등록으로 보인다. ③ **"단일 진입점" 은 부분참 가능** — `src/scheduling` 의 `export class` 가 controller **3** · service / runner **4** 로 보여 어느 것이 단일 진입점인지 실측으로 가른다. ④ **"Worker 또는 Backend API service 메서드의 in-process invocation" 은 부분참 가능** — `§ 12.45` 각주가 이미 "`Scheduler` 의 자동 trigger 는 미결선" 을 실측 판정했다 (그 판정 승계 가능 여부까지 함께 본다). ⑤ **pointer `ADR-0003 §3` 은 참일 가능성이 크다** — [ADR-0003-deployment.md](../decisions/ADR-0003-deployment.md) **62** 행에 `### Decision §3 — Scheduler 위치 = @nestjs/schedule (in-process)` 가 보인다 (AC 1 에서 재확인). ⑥ **`ADR-0042` 등 scheduling 계열 ADR 이 pointer 셀에 미등재** 로 보이나 **새 pointer 추가는 금지** 라 파생 영향에만 남긴다.

**행 좌표 주의** — components.md 는 T-1451 각주 6 행 추가로 **236** 행이고, `## Component table` 은 **115** 행, `Scheduler` row 는 **126** 행, 각주 blockquote 6 블록은 **128 ~ 166** 구간, `## GitHub Adapter — 3 instance 묶음 vs 분리 결정` heading 은 **168** 행, `## Contracts` **200**, `## References` **226** 이다. AC 1 (i) 에서 재실측한다.

[PLAN.md](../PLAN.md) 의 미완 bullet (106 · 108 · 109 · 140 · 151) 은 owner 게이트 · 외부 credential · 새 dependency 게이트라 planner 단독 진행 불가이므로, 본 doc stream 이 현 시점 우선순위 최상위다.

## Required Reading

- `docs/architecture/components.md` — **236 행**. 다음 구간만 읽는다.
  - **115 ~ 126 행** (`## Component table` heading + 표 header 2 행 + 앞 7 row + **`Scheduler` row**) — **126 행이 본 slice 의 유일한 주 판정 대상**, 119 ~ 125 행은 경계 확인 · 판정 승계 인용만.
  - **128 ~ 166 행** (T-1446 ~ T-1451 각주 blockquote 6 블록) — **무편집, 화법 · 배치 template 확인용**. 본 slice 각주는 T-1451 blockquote **직후** 에 붙는다.
  - **1 ~ 4 행** (문서 성격 선언 blockquote — "본 문서는 P1 T-A3 의 산출물") — **무편집**, 판정의 최강 제약. 인용만 한다.
  - **그 밖 전 구간** — **무편집, heading 좌표 확인만** (`## GitHub Adapter …` **168** · `## Contracts` **200** · `## References` **226**).
- `docs/use-cases/REQ-COVERAGE-AUDIT.md` — **4995 행**. **`### 12.15`** (시점 기록 append-only 처리 방침 정본) · **`### 12.49`** (**4900** 행 — T-1451 판정표 화법 template + 파생 영향 원문 + 각주 배치 규약 판정 + 각주 6 블록 임계 기록) · **`### 12.45`** (**4485** 행 — "`Scheduler` 자동 trigger 미결선" 실측 판정 **1 ~ 2 구만** 인용) · **`## 11. References` (4982 행)** — `§ 12.50` 삽입 위치 경계. **그 밖의 절은 열지 않는다** (§7).
- `src/scheduling/cron-schedule.service.ts` — **무편집, 읽기만**. `SchedulerRegistry` 동적 등록 지점 · public 메서드 이름 **3 개 이내** 만 `grep` / `sed` 로 인용 (**통독 금지**).
- `src/scheduling/cron-schedule.controller.ts` · `src/scheduling/scheduling.module.ts` — **무편집, 읽기만**. route prefix · manual trigger endpoint · provider 바인딩 **1 ~ 2 구** 씩만.
- `src/app.module.ts` — **무편집, 읽기만**. `ScheduleModule.forRoot()` 등록 1 행 + "정적 `@Cron` job 정의 0" 주석 (**50 ~ 55 행** 부근) 인용까지만.
- `prisma/schema.prisma` — **666 행. 무편집, 읽기만**. cron / schedule 계열 model 유무 `grep` **1 명령** 만 (**통독 금지**).
- `docs/decisions/ADR-0003-deployment.md` — **무편집, 읽기만**. **`### Decision §3` 좌표 1 행** 재측정 (**승계 불가 — 본 slice 가 직접 측정**) + `@nestjs/schedule` 결정 문구 **1 구** 인용까지만.
- `docs/requirements.md` — **97 행. 무편집, 읽기만**. REQ-039 / REQ-040 의 **실재 + 제목 1 구** 확인용 `grep` 만 (**행이 매우 길어 통독 금지 — `cut -c1-160` 등으로 잘라 인용**). 본문 재판정 금지.
- `docs/PLAN.md` — **175 행. 무편집, 읽기만**. `Phase P7` + Scheduling 관련 bullet 좌표 확인용 `grep` 만.
- `CLAUDE.md` §3 (task 크기 상한) · §3.2 (direct doc-only 면제) · §12 (언어 정책)

## Acceptance Criteria

- [ ] **AC 1 — 실측 선행 (날조 금지)**: 편집 전에 다음을 직접 측정해 `§ 12.50` 에 **명령과 출력을 함께** 인용한다. 기대값과 **다르면 그 축의 편집을 중단** 하고 불성립 사실을 `§ 12.50` 에 기록한다 (Why 의 ① ~ ⑥ 은 가설일 뿐이다).
  - (i) **좌표 + 원문 재확인**: `grep -n '^#\{1,3\} ' docs/architecture/components.md` 로 heading 좌표를 **먼저 실측** 한 뒤 (본 AC 의 `115` · `126` · `168` 도 stale 일 수 있다 — T-1436 ~ T-1451 선례) `sed -n '126p'` 로 row 원문을 인용한다. 이어 **실측으로 참 · 거짓을 가릴 수 있는 claim** (in-process cron 근거 · 단일 진입점 · DB 저장 + restart 복원 · dynamic 등록 · manual trigger duplication 0 · 입력 2 종 · 출력 대상 · `@Cron` decorator handler · ADR § 번호 · phase pointer · REQ ID) 만 뽑아 열거하고, 순수 성격 서술은 **검증 불가 claim** 으로 분류해 판정 대상에서 제외한다. 이 이분 자체를 남긴다.
  - (ii) **인벤토리 + 단일 진입점 축**: `find src -ipath '*schedul*' -name '*.ts' -not -name '*.spec.ts' | sort` (파일 **14** 개 예상 — 실측값을 그대로 쓴다) · `grep -rn 'export class' src/scheduling/*.ts | grep -v spec` 으로 **"단일 진입점"** 을 판정한다. class 가 여러 개면 **어느 것이 cron 진입점 본체이고 나머지 (backfill · recent-deletion runner / controller) 가 어떤 역할인지 1 ~ 2 구** 로 가른다.
  - (iii) **in-process + dynamic 등록 축**: `grep -rn '@nestjs/schedule' src --include='*.ts' | grep -v spec | head -5` · `grep -rn '@Cron(' src --include='*.ts' | grep -v spec | head -5` · `grep -n 'SchedulerRegistry\|addCronJob\|CronJob\|CronTime' src/scheduling/cron-schedule.service.ts | head -8` 으로 **"`@Cron` decorator handler"** 와 **"SchedulerRegistry dynamic 등록"** 을 **개별로** 판정한다. **정적 `@Cron` 이 0 hit 이면 그 사실이 판정 결과** 이며 (거짓), `src/app.module.ts` 주석 (**50 ~ 55 행** 부근) 을 근거로 함께 인용한다.
  - (iv) **DB 저장 + restart 복원 축**: `grep -n 'model ' prisma/schema.prisma | grep -i 'cron\|sched'` · `grep -rn 'onModuleInit\|OnModuleInit\|restore\|rehydrate' src/scheduling/*.ts | grep -v spec | head -5` 로 **"cron 표현식은 DB 에 저장되어 process restart 후에도 복원"** 을 판정한다. **둘 다 0 hit 이면 그 사실이 판정 결과** (거짓 또는 미구현) 이며, 표현이 **미래 설계 의도인지 shipped 현황인지** 를 1 ~ 4 행 blockquote (P1 T-A3 blueprint 선언) 근거로 1 구 덧붙인다. 다른 module 의 영속화 여지는 `grep -rn 'cronExpression\|cron_expression' src --include='*.ts' | grep -v spec | head -5` **1 명령** 으로만 확인한다 (전수 증명은 §7 예산 밖 — 한계에 남긴다).
  - (v) **contract + manual trigger 축**: `grep -n '@Controller\|@Get\|@Put\|@Post\|@Delete' src/scheduling/cron-schedule.controller.ts | head -10` 으로 **입력 축 (manual trigger endpoint 실재)** 을 인용하고, `grep -n '  async \|^  [a-z][A-Za-z]*(' src/scheduling/cron-schedule.service.ts | head -8` 로 **controller 와 cron 이 같은 service 메서드를 부르는지 (duplication 0)** 를 판정한다. **출력 축** ("Worker 또는 Backend API service 메서드의 in-process invocation") 은 `§ 12.45` 의 **"`Scheduler` 자동 trigger 미결선" 판정을 인용** 하되, 승계로 끝내지 말고 `grep -rn 'CollectionTrigger\|collect(' src/scheduling/*.ts | grep -v spec | head -5` **1 명령** 으로 결선 유무를 재확인한다.
  - (vi) **pointer + REQ 축**: `grep -n '^### Decision §3' docs/decisions/ADR-0003-deployment.md` 로 `ADR-0003 §3 (@nestjs/schedule in-process)` 좌표를 **직접 재측정** 한다 — **`§ 12.47` ~ `§ 12.49` 의 `§4` 승계는 본 축에 적용 불가** 임을 판정 본문에 1 구로 명시한다. `sed -n` 으로 그 결정 문구 **1 구** 를 인용해 row 괄호 병기 (`@nestjs/schedule in-process`) 와의 부합을 가른다. `grep -n 'P7\|Scheduling' docs/PLAN.md | head -5` 로 **`P7 Scheduling & ops task`** pointer 를 판정한다. REQ 는 `grep -n 'REQ-039\|REQ-040' docs/requirements.md | cut -c1-160` 로 **2 개 ID 의 실재** 와 괄호 병기 문구 (`Admin cron 주기 지정` · `Admin manual trigger`) 의 실 제목 부합을 판정한다 (**requirements.md 는 행이 매우 길어 반드시 잘라서 인용**).
  - (vii) baseline — `wc -l` components.md **236** · audit **4995** · requirements.md **97** · deployment.md **232** · directory.md **203** · modules.md **259** · PLAN.md **175** · prisma/schema.prisma **666**, `grep -c '^## '` components.md **7** · audit **12**, audit `grep -c '^| REQ-'` **66** · `grep -c '^### 12\.'` **49**.
- [ ] **AC 2 — 지점 판정표**: AC 1 이 뽑은 **검증 가능 claim** 각각에 대해 `in-place 수정` / `원문 보존 + 각주 부기` / `무편집` / `상위 slice 판정 승계` 중 하나를 판정한 표를 만든다. 각 row 는 **claim 1 구 · 실측 결과 · 판정 (참 / 부분참 / 거짓) · 처리 · 근거 1 구** 5 컬럼이다.
  - **REQ ID 2 개는 판정이 같으면 1 row 로 묶고 ID 를 전부 나열** 해도 무방하다 (묶을 경우 묶음 근거 1 구). **단일 진입점 · DB 복원 · dynamic 등록 · `@Cron` handler · pointer 는 묶음 금지**.
  - **`ADR-0003 §3` row 의 처리는 `상위 slice 판정 승계` 가 아님** 을 근거 컬럼에 1 구로 명시한다 (`§ 12.49` 가 승계 불가를 못박았다 — 본 절의 직접 실측이 근거).
  - 판정 기준 **3 축** 명시 — ① **문서 성격** (1 ~ 4 행 blockquote 의 P1 T-A3 blueprint 선언 + 이 표가 이미 여러 차례 shipped 현황으로 갱신된 흔적), ② `§ 12.15` **정합** (row 에 시점 marker 가 있는지 실측 grep 근거), ③ **선례** (T-1430 ~ T-1451 의 "원문 보존 + 실측 각주" vs [T-1429](T-1429-api-md-module-vocab-and-uc-range-resync.md) 의 in-place 1:1 치환 vs [T-1436](T-1436-directory-md-web-frontend-section-vs-src-audit.md) 의 혼합 채택).
- [ ] **AC 3 — 처리 방식 판정**: 후보 4 개 중 **채택 1 · 기각 3** 인 판정표를 만든다. 기각마다 근거 1 구.
  - 후보 — (A) row 셀 **in-place 동기** (틀린 복원 서술 · `@Cron` handler 표기 치환), (B) **원문 무편집 + T-1451 각주 blockquote 직후에 각주 blockquote 1 개 신설** (T-1437 ~ T-1451 화법 승계), (C) **혼합** (거짓 판정 지점만 in-place, 나머지는 각주), (D) **전 지점 무편집 + audit 기록만**.
  - 판정 기준 **4 축** 명시 — ① `§ 12.15` 정합, ② **오도 risk** (독자가 이 표만 읽고 cron 영속화 · restart 복원 · 정적 `@Cron` 존재 · 자동 trigger 결선을 오인할 때의 비용), ③ **cap** — 예상 diff ≤ 300 LOC · 변경 파일 **3 고정** (초과 후보는 자동 기각 + split 제안 기록), ④ **각주 누적 구조** — 본 slice 는 **7 번째 블록** 이자 **마지막 블록** 이며, `§ 12.49` AC 3.5 가 `표 완결까지 현 규약 (표 뒤 blockquote 나열) 유지` 로 이미 결착했음을 근거로 재설계를 시도하지 않는다.
- [ ] **AC 4 — 채택안 반영**: AC 3 채택안대로만 편집한다. 각 지점은 AC 2 판정 결과를 따른다.
  - **각주 blockquote 는 T-1451 각주 blockquote 마지막 행 (현 166 행) 과 `## GitHub Adapter — 3 instance 묶음 vs 분리 결정` heading (현 168 행) 사이에 삽입** 한다. **각주 blockquote 1 개 (≤ 6 행) + in-place 치환 (≤ 2 지점) 이내**, `wc -l` 증가 **+7 이내** (236 → ≤ 243).
  - **각주 첫 구에 "본 각주는 `Scheduler` row 한정" 과 함께 "이로써 `## Component table` 7 row 대조가 완결" 을 명시** 한다.
  - **문구 · 파일 이름 · 메서드 이름 · 시그니처 · 수치 · 행 번호 · ADR § 번호 · REQ ID · task ID 는 AC 1 실측 출력과 1:1 일치** 해야 하며, 실측되지 않은 값 (존재하지 않는 model, 임의 카운트, 없는 절 번호) 을 **새로 창작하지 않는다**.
  - **1 ~ 4 행 blockquote · 119 ~ 125 행 7 row · 126 행 `Scheduler` row 원문 · 128 ~ 166 행 기존 각주 6 블록 · 168 행 이후 전 구간 무편집**.
  - **새 pointer 추가 금지** — 본문 · `src/scheduling/**` · `ADR-0003` · `PLAN.md` · `requirements.md` 외의 문서를 새로 등재하지 않는다 (`ADR-0042` 등 scheduling 계열 ADR 은 **audit 쪽 파생 영향에만** 기록).
  - **secret · token · 실 credential 을 문서에 옮겨 적지 않는다** (CLAUDE.md §9).
- [ ] **AC 5 — audit `§ 12.50` 신설**: [REQ-COVERAGE-AUDIT.md](../use-cases/REQ-COVERAGE-AUDIT.md) 의 `## 11. References` (4982 행) **직전** 에 `### 12.50 …` 절을 **순수 append** 한다 (기존 절 수정 0). 구성 — 본 절의 위치 · 계보 1 문단 (**T-1451 파생 영향 (1) 이 지목한 표 완결 slice** 임과 `ADR-0003 §3` 은 승계 불가라 직접 재측정했다는 사실) / AC 1 실측 (명령 + 출력) / AC 2 지점 판정표 / AC 3 처리 판정표 / AC 4 반영 결과 + 무편집 경계 / **`## Component table` 7 row 대조 완결 선언** (각 row 를 닫은 절 번호 `§ 12.44` ~ `§ 12.50` 매핑 1 줄) / 파생 영향 (목록만) / 불변 검산 / 한계. **절 전체 ≤ 115 행** (초과 시 실측 인용을 요약형으로 압축하고 압축 사실을 한계에 명시).
  - `###` 레벨이라 `grep -c '^## '` **12 불변** · `grep -c '^| REQ-'` **66 불변** · `grep -c '^### 12\.'` **49 → 50**.
- [ ] **AC 6 — 불변 검산**: 다음을 실행해 출력을 `§ 12.50` 에 인용한다. `wc -l` components.md (236 → ≤ 243) · audit (4995 → +115 이내) · **`prisma/schema.prisma` 666 불변** · deployment.md (**232 불변**) · directory.md (**203 불변**) · modules.md (**259 불변**) · PLAN.md (**175 불변**) · requirements.md (**97 불변**), `git diff -U0 -- docs/architecture/components.md | grep '^@@'` 로 **hunk 개수 · 위치** 를 보이고 AC 4 허용 구간 밖 hunk **0** 을 실증, `git diff --numstat` 으로 **순수 삭제 0** (삭제 행이 있으면 in-place 치환의 짝임을 1 구로 설명), `git status --porcelain src/ test/ web/ prisma/ deploy/ docker-compose.yml Dockerfile .github/ package.json README.md .claude/ docs/decisions/ docs/ops/ docs/PLAN.md docs/requirements.md` **빈 출력** (코드 · schema · frontend · 배포자산 · CI · 의존성 · ADR · PLAN · requirements 무변경), `git status --porcelain` 이 **3 파일 이내** 임을 확인.
- [ ] **AC 7 — 파생 영향 기록 (목록만, 본 slice 편집 금지)**: `§ 12.50` 말미에 후속 slice 대상을 목록으로 남긴다. 최소 포함 — (1) **각주 7 블록 누적 구조 재판정** (`§ 12.49` 한계 4 가 "`Scheduler` row 종료 직후" 로 이월한 항목 — 표가 완결됐으므로 **다음 slice 1 순위 후보**), (2) **`Scheduler` row pointer 셀 보강** (본 절이 실측한 scheduling 계열 ADR 미등재 — 새 pointer 추가는 본 slice 금지라 별도 slice 소관), (3) `## Deployment 컨텍스트` (22 ~ 26 행 — "모든 8 component 는 동일 process" claim 이 표 7 row 와 카운트가 어긋나는지 포함, T-1445 FU1 차순위로 **7 회째 이월**), (4) `## Component diagram` mermaid node ↔ 실 module 대조, (5) `## GitHub Adapter — 3 instance 묶음 vs 분리 결정` sub-section (168 ~ 199 행) 본문 ↔ 실 코드 대조 (`§ 12.48` FU4 미소진), (6) `## Contracts` 표 (200 ~ 225 행) ↔ 실 계약 표면 대조, (7) `Confluence Adapter` row pointer 셀 보강 (`§ 12.49` FU2 미소진), (8) `@nestjs/config` 미도입 전수 sweep (`§ 12.39` FU3 미소진, ADR 게이트), (9) reviewer 규약 미이행 (`.claude/agents/reviewer.md` REQ-032 0 hit — `§ 12.41` FU2 미소진), (10) `deploy/README.md` ↔ deployment.md ↔ runbook 3 자 정합 (`§ 12.41` FU3 미소진), (11) README 행 번호 pointer drift 전수 sweep, (12) REQ 번호 체계 잔재 전수 sweep (`§ 12.38` FU3 미소진), (13) `CLAUDE.md` §1 pointer 부정확 (T-1442 FU3 미소진), (14) UC-09 `§ 5` sequence participant 병기 (**35 회째 이월**), (15) 정본 [modules.md](../architecture/modules.md) 카운트 claim 대조 (`§ 12.34` FU1 미소진, ADR 게이트), (16) 행 번호 → anchor 좌표계 이행 (**29 회째 이월**), (17) `§ 12.44` 미해결 한계 — "mutation 러너 26 개" 정의 미확정 (`pr` mode drift-guard spec 소관), (18) **`Scheduler` cron → 평가 pipeline 미결선** (`§ 12.45` FU15 — **코드 소관, `pr` task 로만 처리 가능**. 본 절 실측이 재확인하면 그 사실을 1 구 덧붙인다), (19) `ADR-0003` 의 "단일 DB 인스턴스" 좌표 부재 (`§ 12.46` FU16 — ADR 소관 별도 task), (20) LLM provider 배포 config ADR 3 종 pointer 미등재 (`§ 12.47` FU5 미소진), (21) GitHub adapter ADR 3 종 pointer 미등재 (`§ 12.48` FU3 미소진).
- [ ] **AC 8 — R-110 / R-112 면제 근거 명시**: 본 task 는 `commitMode: direct` doc-only 로 production code **0 LOC** · 분기 **0** 이라 [CLAUDE.md](../../CLAUDE.md) §3.2 direct-mode 면제 조항에 따라 tester 호출 · happy / error / flow / negative 4 항목 · `pnpm test:cov` 가 **N/A** 임을 `§ 12.50` 에 1 구로 명시한다.
- [ ] **AC 9 — 언어 · 링크 규약**: 추가 문장은 모두 한국어 (§12), 문서 간 참조는 상대경로 markdown 링크, 수치는 실측 출력과 1:1 일치. **ADR-0003 파일 경로는 `docs/decisions/ADR-0003-deployment.md`** 로만 적는다 (`§ 12.45` FU16 이 지적한 `-deployment-topology.md` 표기 drift 재발 금지).

## Out of Scope

- **코드 · schema · frontend · 배포 자산 · CI · agent 정의 변경 절대 금지** — `src/` · `web/` · `test/` · `prisma/` · `scripts/` · `deploy/` · `docker-compose.yml` · `Dockerfile` · `.github/workflows/` · `package.json` · `.claude/agents/` 는 diff 에 등장하면 안 된다. **cron 영속화 model 추가 · `@Cron` handler 추가로 문서를 맞추는 행위 금지** (문서를 실제에 맞출 뿐, 실제를 문서에 맞추지 않는다).
- **`Web UI` · `Backend API` · `Worker` · `DB Persistence` · `LLM Gateway` · `GitHub Adapter` · `Confluence Adapter` row (119 ~ 125 행) 재판정 금지** — `§ 12.44` ~ `§ 12.49` 가 이미 닫았다. 필요 시 판정 승계 인용까지만.
- **각주 blockquote 규약 재설계 · 기존 6 블록 재배치 금지** — `§ 12.49` AC 3.5 가 `표 완결까지 현 규약 유지` 로 결착했다. 재판정은 파생 영향 (1) 소관이다.
- **`## GitHub Adapter — 3 instance 묶음 vs 분리 결정` sub-section (168 ~ 199 행) · `## Contracts` (200 ~ 225 행) 본문 판정 · 편집 금지** — 각각 `§ 12.48` FU4 · 본 절 파생 영향 (6) 소관이다.
- **components.md 168 행 이후 전 구간 편집 금지** — `## Contracts` 표 · `## References` · mermaid diagram 무편집.
- **1 ~ 4 행 blockquote · 128 ~ 166 행 T-1446 ~ T-1451 각주 6 블록 편집 금지** — 인용 · 화법 참조까지만.
- **`docs/PLAN.md` · `docs/requirements.md` 편집 금지** — pointer / REQ 실재 확인용 grep 인용까지만 (**requirements.md 는 행이 길어 통독 금지**).
- **ADR 본문 재판정 · status 변경 금지** — 파일 실재 + § 좌표 실측까지만. **§ 번호 drift 를 발견해도 ADR 을 고치지 않는다** (components.md 쪽 판정 · 각주로만 처리).
- **[modules.md](../architecture/modules.md) · [INDEX.md](../architecture/INDEX.md) · [deployment.md](../architecture/deployment.md) · [directory.md](../architecture/directory.md) · [api.md](../architecture/api.md) 편집 금지** — 정합 판정 필요 사실은 파생 영향 목록에만 남긴다 (**modules.md 259 행 · deployment.md 232 행 · directory.md 203 행 불변**).
- **cron 실발화 · live spec 실행 금지** — scheduler 를 실제로 등록 · 발화시키지 않는다 (측정은 전부 read-only grep / ls / find / sed / wc / git).
- **빌드 · 테스트 · 설치 실행 금지** — `pnpm install` · `pnpm build` · `pnpm test` 어느 것도 실행하지 않는다.
- **다른 문서로의 cascade 금지** — [use-cases/INDEX.md](../use-cases/INDEX.md) · `UC-01` ~ `UC-09` · ADR · [README.md](../../README.md) 는 무편집.
- **행 번호 → anchor 좌표계 이행 금지** — 파생 영향 목록에만 남긴다 (29 회째 이월).
- **CI drift-guard spec 작성 금지** — `pr` mode 소관이라 본 direct task 에서 진행하면 §3.1 위반.
- **audit 기존 절 (`§ 12.1` ~ `§ 12.49`) 수정 금지** — `§ 12.50` 순수 append 만.

## Suggested Sub-agents

`implementer` 단독 (doc-only, 코드 0 LOC — architect · tester 불요. §3.2 direct-mode 면제).

## Follow-ups
