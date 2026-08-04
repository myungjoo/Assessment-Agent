---
id: T-1465
title: components.md `## Contracts` 표 **Scheduler 발신 2 row** (278 · 279 행) ↔ 실 `src/scheduling/` 호출 그래프 대조 — `§ 12.62` 파생 영향 (1) 집행 + audit §12.63
phase: P5
status: PENDING
commitMode: direct
coversReq: [REQ-057]
estimatedDiff: 215
estimatedFiles: 3
created: 2026-08-04
independentStream: uc-doc-audit-resync
dependsOn: [T-1464]
touchesFiles:
  - docs/architecture/components.md
  - docs/use-cases/REQ-COVERAGE-AUDIT.md
  - docs/tasks/T-1465-components-md-contracts-scheduler-rows-audit.md
plannerNote: "uc-doc-audit-resync 77 번째 slice — §12.62 파생 영향 (1) 집행. Contracts 표 Scheduler 발신 2 row 판정. doc-only 1.6x"
---

# T-1465 — components.md `## Contracts` Scheduler 발신 2 row 대조

## Why

[T-1464](T-1464-components-md-contracts-backend-api-rows-audit.md) 가 `## Contracts` 표의 **orchestration 5 row (273 ~ 277 행)** 를 닫으면서 ([REQ-COVERAGE-AUDIT.md](../use-cases/REQ-COVERAGE-AUDIT.md) `§ 12.62`) 파생 영향 **(1)** 에서 **다음 slice 1 순위를 잔여 10 row 중 `Scheduler` 발신 2 row (278 · 279 행)** 로 명시 지목했다 (근거: 대응 mermaid edge **2** 개 (**76 · 77** 행) 를 edge 축 첫 slice `§ 12.54` 가 이미 닫아 **판정 입력이 그대로 재사용** 되므로 한계 비용 최저). 본 slice 는 그 지목을 그대로 승계한다.

동시에 `§ 12.54` 는 자기 (vii) 에서 같은 `@Cron` claim 이 문서 안 **6 지점** 에 중복된다고 박제하면서 **"`## Contracts` 2 row 의 참 / 거짓은 파생 영향 (3) 이 판정한다"** 고 **명시 이월** 해 뒀다 (components.md **192** 행 각주 말미 · audit `§ 12.54` 파생 영향 **3**). 본 slice 는 그 이월을 회수하는 slice 이기도 하다 — `§ 12.62` 가 `§ 12.55` 의 이월을 회수한 것과 **동형** 이다. 따라서 **`scheduler` node 외연 (= `src/scheduling/`)** 도 `§ 12.53` · `§ 12.54` **승계** 이며 본 절 신설이 아니다.

**주의 — `§ 12.54` 는 당시 좌표로 `## Contracts` 2 row 를 `234 · 235` 행이라 적었다.** 그 사이 components.md 는 **247 → 317** 행으로 자랐으므로 현 좌표는 **278 · 279** 로 추정되나, **AC 1 (i) 에서 반드시 재실측** 한다 (좌표 drift 는 본 stream 의 상습 오차원이다).

planner 사전 확인 — **아래는 전부 가설이며 전제가 아니다** (T-1440 AC 1 이후 planner 기대가 실측에 반증·정정된 선례가 **26** 회 있고, 직전 T-1464 에서도 "row 277 의 `구체는 P5` 도 row 272 처럼 거짓일 것" 이라는 기대가 **참** 으로 갈렸으며 "`prisma.module.ts`" 라는 파일명 전제도 **실 파일은 `persistence.module.ts`** 로 반증됐다). executor 는 AC 1 에서 전부 재측정하고 **기대와 다르면 그 축의 판정을 실측대로 뒤집는다**. ① **278** 행 `Scheduler | Worker | sync (handler 실행 자체) | NestJS @Cron decorator handler | ADR-0003 §3 in-process scheduler. cron 시각 도달 시 handler 직접 호출.` 의 **결선 실재** — `§ 12.54` 축 ① 이 대응 edge 76 을 **부분참** (결선은 실재하나 진입이 `backfill.controller.ts` **50** 행 REST runner 경로이고 **cron 발화 경로는 미결선**) 으로 닫았으므로 row 도 같은 판정을 승계받을 가능성. ② 같은 row 의 **`NestJS @Cron decorator handler`** message format 셀 — `§ 12.54` 축 ② 가 `@Cron(` **0 hit** 으로 **거짓** 확정했고 실 등록 경로는 `SchedulerRegistry` · `CronJob` **dynamic 등록** (components.md **175** 행 각주) 이라 row 셀도 같은 오기일 가능성 (다만 row 는 edge label 과 **문구가 다르다** — `decorator` 라는 단어가 추가돼 있어 오기의 강도가 다를 수 있다). ③ 같은 row 비고의 **`cron 시각 도달 시 handler 직접 호출`** — `scheduling.module.ts` **36 ~ 45** 행 `CRON_TICK_HANDLER` 기본 provider 가 stub no-op 이라는 `§ 12.54` · `§ 12.52` 판정과 상충하는지. ④ **279** 행 `Scheduler | Backend API | sync | NestJS @Cron handler 가 controller/service 호출 | manual trigger 와 동일 service 메서드 호출 — duplication 0 (ADR-0003 §3).` 의 **결선 · 방향** — `§ 12.54` 축 ③ 이 edge 77 을 **거짓** (관측되는 유일한 결선은 `cron-schedule.controller.ts` **80** 행의 scheduler node **내부** controller → service 이고 방향도 HTTP → scheduler 로 **반대**) 으로 닫았으므로 승계 가능성. ⑤ 279 행 비고의 **`manual trigger 와 동일 service 메서드 호출 — duplication 0`** claim — 실제로 manual trigger 경로와 cron 경로가 **같은 service 메서드** 를 공유하는지, 아니면 (④ 대로 cron → backend_api 결선이 부재해) claim 자체가 **미이행 설계 의도** 인지. ⑥ 2 row 의 `sync/async` 값 — 278 행만 **`sync (handler 실행 자체)`** 라는 **괄호 한정** 이 붙은 비대칭 ↔ **289** 행 정의문 (`§ 12.62` 축 ⑥ 이 **in-process 판별력 0** 을 확정) 이 이 한정을 설명하는지. ⑦ 비고 셀 **ADR pointer (`ADR-0003 §3`) 2 row 공통** ↔ 실 ADR 좌표 (**62** 행 `Decision §3` · **70** 행 `trigger → handler 가 한 hop`) 정합 + REQ pointer **0** (`§ 12.62` 축 ⑦ 이 "`## Contracts` 에 REQ 컬럼이 없어 결손 아님" 으로 확정 — **승계이며 재판정 아님**). ⑧ `§ 12.54` (vii) 이 박제한 **`@Cron` 6 지점 좌표 (76 · 126 · 143 · 175 · 234 · 235)** 의 현 유효성 — 뒤 2 개가 **278 · 279** 로 밀렸다면 그 stale 을 실측으로 확정한다 (정정 여부는 AC 3 · AC 4 소관).

**행 좌표 주의** — components.md 는 T-1464 각주 +8 행으로 **317** 행이고, heading 은 `## 개요` **5** · `## Deployment 컨텍스트` **22** · `## Component diagram` **28** · `## Component table` **115** · `## GitHub Adapter …` **233** · `## Contracts` **265** · `## References` **307** 다. `## Contracts` 절은 서문 **267**, header **269**, 구분 **270**, data row **271 ~ 287** (**17** 개), `sync / async 의미` 문단 **289**, **T-1463 각주 291 ~ 297**, 빈 줄 **298**, **T-1464 각주 299 ~ 305**, 빈 줄 **306** 이며 그 뒤 **307** heading 이다. 각주군 (T-1436 ~ T-1462 블록) 은 여전히 `## Component table` 절 안 **231** 행까지다. AC 1 (i) 에서 재실측한다.

[PLAN.md](../PLAN.md) 의 미완 bullet (106 · 108 · 109 · 140 · 151) 은 owner 게이트 · 외부 credential · 새 dependency 게이트라 planner 단독 진행 불가이므로, 본 doc stream 이 현 시점 우선순위 최상위다.

## Required Reading

- `docs/architecture/components.md` — **317 행**. 다음 구간만 읽는다.
  - **265 ~ 270 행** (`## Contracts` heading · 서문 · header · 구분) + **278 · 279 행** (data row **2** 개) — **본 slice 의 판정 대상**.
  - **271 ~ 277 행** (user-facing 2 + orchestration 5 row) · **280 ~ 287 행** (Worker 4 · DB 1 · egress 3 row) — **무편집**, **census 재확인 (개수) 까지만**. **row 본문 판정 금지** (271 ~ 277 은 `§ 12.61` · `§ 12.62` 가 닫았고 나머지 8 은 후속 slice 소관).
  - **289 행** (`sync / async 의미` 문단) — **무편집, 인용만**. 정의문 보강은 `§ 12.61` 파생 영향 (27) 소관이다.
  - **299 ~ 305 행** (T-1464 각주 blockquote) — **무편집**. 삽입점 좌표 확인 + census 수치 (**17 중 7 판정 · 잔여 10**) · 축 ⑥ · ⑦ 승계 근거 1 구 인용용.
  - **189 ~ 192 행** (T-1456 각주 블록) — **무편집**. **`scheduler` node 외연 · edge 76 · 77 판정 결과 승계 근거 1 구 인용** + **"`## Contracts` 2 row 판정은 파생 영향 소관" 이월 문구** 확인 + **`@Cron` 6 지점 좌표 (234 · 235 포함) 의 stale 여부** 확인용.
  - **173 ~ 178 행** (T-1452 각주 블록 = `## Component table` 의 `Scheduler` row) — **무편집**. `SchedulerRegistry` dynamic 등록 · stub no-op · `ADR-0003 §3` 좌표 **1 구 인용까지만** (축 ② · ③ · ⑦ 대조용). **row 본문 재판정 금지**.
  - **76 · 77 행** (`%% Scheduler triggers` edge 2 개) — **무편집, 대조용**. 좌표와 label 확인까지만 (`§ 12.54` 가 이미 닫았다).
  - **108 ~ 113 행** (`다이어그램 표기` bullet) — 인용만. 재판정 금지.
  - **126 행 표 row** (`Scheduler`) — **무편집**, `@Cron` 중복 좌표 확인까지만 (축 ⑧). **row 본문 재판정 금지** (`§ 12.52` 소관).
  - **그 밖 전 구간** — **무편집, heading 좌표 확인만**.
- `docs/use-cases/REQ-COVERAGE-AUDIT.md` — **5968 행**. **`### 12.15`** (append-only 처리 방침 정본) · **`### 12.62`** (파생 영향 **(1)** 원문 = 본 slice 의 지목 근거 + 진척 수치 + (ix) 계수 규칙 + **각주 위치 관행 확정** 문단) · **`### 12.54`** 의 **edge 76 · 77 판정표 · (vii) `@Cron` 6 지점 · 파생 영향 (3) 단락만** (승계 원문 인용용 — 절 전체 통독 금지) · **`## 11. References`** (**5955** 행) — `§ 12.63` 삽입 위치 경계. **`§ 12.44` ~ `§ 12.53` · `§ 12.55` ~ `§ 12.61` 본문은 열지 않는다** — 필요한 판정은 components.md 각주 1 구 인용으로 갈음한다 (§7 context 절약).
- `src/scheduling/scheduling.module.ts` · `src/scheduling/cron-schedule.controller.ts` — **무편집, read-only**. provider 선언 · 주입 지점 **행 1 ~ 3 개 인용까지만**. **파일 통독 금지** (축 ① · ③ · ④ 한정).
- `docs/decisions/ADR-0003-deployment.md` — **173 행. 무편집, 읽기만**. `Decision §3` (in-process scheduler) 문장 **1 구 인용까지만** (축 ⑦ pointer 정합).
- `docs/PLAN.md` — **175 행. 무편집, 읽기만**. 미완 bullet 좌표 확인용 `grep` 만.
- `CLAUDE.md` §3 (task 크기 상한) · §3.2 (direct doc-only 면제) · §7 (context 절약) · §9 (secret 금지) · §12 (언어 정책)

## Acceptance Criteria

- [ ] **AC 1 — 실측 선행 (날조 금지)**: 편집 전에 다음을 직접 측정해 `§ 12.63` 에 **명령과 출력을 함께** 인용한다. 기대값과 **다르면 그 축의 판정을 실측대로 뒤집는다** (Why 의 ① ~ ⑧ 은 가설일 뿐이다).
  - (i) **좌표 재확인**: `grep -n '^#\{1,3\} ' docs/architecture/components.md` 로 heading 좌표를 **먼저 실측** 한다 (본 AC 의 `265` · `307` 도 stale 일 수 있다 — T-1436 ~ T-1464 선례). 이어 `grep -n '^| ' docs/architecture/components.md` 로 표 행 좌표를 확정해 `## Component table` 표와 `## Contracts` 표를 **좌표로 분리** 하고, **`Scheduler |` 로 시작하는 data row 2 개의 실 행 번호** 를 확정한다 (`grep -n '^| Scheduler |' docs/architecture/components.md`). `grep -n '^> ' docs/architecture/components.md | tail -10` 으로 **T-1464 각주 blockquote 의 마지막 행** (삽입점) 을 확정한다.
  - (ii) **census 승계 재확인 (신설 아님)**: `awk 'NR>=265' docs/architecture/components.md | grep -c '^| '` → **19** 에서 header · 구분 **2** 를 빼 **data row 17** 을 재확인하고, `§ 12.61` 의 census 표 (그룹별 edge : row = user-facing 2:2 · orchestration 5:5 · **scheduler 2:2** · worker 4:4 · db 1:1 · egress 9:3) 를 **1 구 인용으로 승계** 한다 (**재산출 금지**). 본 slice 판정 대상은 **scheduler 2 row** 이며, 종료 시 **표 17 중 9 판정 완료 · 잔여 8** 임을 수치로 명시한다 (`§ 12.62` 가 세운 **7/17** 에 **+2**).
  - (iii) **대상 row 원문 인용**: `sed -n '269,270p;278,279p' docs/architecture/components.md` (좌표는 (i) 실측값으로 교체) 로 header · 구분 · data row **2** 개를 그대로 인용하고, 2 row × **5 컬럼** 분해표를 만든다.
  - (iv) **`scheduler` node 외연 승계 (신설 아님)**: `§ 12.53` · `§ 12.54` 가 확정한 외연 (`scheduler` = `src/scheduling/` 단일 디렉토리) 을 components.md **186** 행 · **189** 행 부근 각주 **1 구 인용으로 그대로 승계** 하고, 여전히 유효한지 `ls src/scheduling/*.ts | wc -l` + `grep -rln '@Controller(' src/scheduling --include=*.ts | grep -v spec` 로 **재검증** 한다 (T-1456 이후 증감이 있으면 실측대로 갱신 인용하고 그 갱신이 판정에 미치는 영향을 1 구로 밝힌다 — **재정의가 아니라 재검증** 이다).
  - (v) **row 278 실측 (축 ① ~ ③)**: ⓐ `grep -rn '@Cron(' src --include=*.ts | grep -v spec | wc -l` (`§ 12.54` 의 **0 hit** 재검증 — 0 이 아니면 축 ② 판정을 실측대로 뒤집는다), ⓑ `grep -n 'SchedulerRegistry\|CronJob\|CronTime' src/scheduling/*.ts | grep -v spec | head -8` (dynamic 등록 경로 실재 확인), ⓒ `grep -n 'CRON_TICK_HANDLER\|provide:\|useValue\|useFactory' src/scheduling/scheduling.module.ts | head -10` (기본 provider 가 여전히 stub no-op 인지 — `§ 12.52` · `§ 12.54` 판정 재검증), ⓓ `grep -rn 'triggerCollection\|CollectionTriggerService' src --include=*.ts | grep -v spec | cut -d: -f1 | sort -u | head -6` (scheduler → worker 실 결선 경로와 그 **진입점** 이 REST 인지 cron 인지).
  - (vi) **row 279 실측 (축 ④ · ⑤)**: ⓐ `grep -rn 'CronScheduleService' src --include=*.ts | grep -v spec | cut -d: -f1 | sort -u` (주입 지점이 `src/scheduling/` **내부** 뿐인지 = node 내부 결선인지), ⓑ `grep -rln 'scheduling/' src --include=*.ts | grep -v spec | grep -v '^src/scheduling' | head -6` (scheduler **밖** 에서 scheduling 을 import 하는 지점 = 방향 확인), ⓒ **`manual trigger 와 동일 service 메서드 호출 — duplication 0`** 을 가르기 위해 manual trigger controller 와 cron 경로가 **같은 service 메서드** 를 부르는지 `grep -n 'Service\.' src/scheduling/*.ts | grep -v spec | head -8` + (v) ⓓ 결과와 대조한다. **claim 이 "현 구현의 사실" 인지 "설계 의도" 인지를 1 구로 가른다.**
  - (vii) **축 ⑥ · ⑦ 실측**: ⓐ **289** 행 정의문을 그대로 인용해 278 행의 **`(handler 실행 자체)` 괄호 한정** 이 정의문으로 설명되는지 1 구로 가른다 (`§ 12.62` 축 ⑥ 의 **in-process 판별력 0** 결론을 **인용 승계** 하되 본 축은 **괄호 한정 비대칭** 이라 다른 면임을 밝힌다). ⓑ `grep -n 'Decision' docs/decisions/ADR-0003-deployment.md | head -6` + `sed -n '70p' docs/decisions/ADR-0003-deployment.md` 로 `ADR-0003 §3` pointer 의 **가리키는 대상 실재** 를 확인한다. ⓒ REQ pointer **0** 은 `§ 12.62` 축 ⑦ 이 **"`## Contracts` header 에 REQ 컬럼이 없어 결손 아님"** 으로 확정했으므로 **1 구 인용 승계까지만** 하고 **재판정하지 않는다**.
  - (viii) **축 ⑧ — `@Cron` 중복 좌표 stale 실측**: `grep -n '@Cron' docs/architecture/components.md` 로 현 중복 지점 좌표를 전수 뽑아 `§ 12.54` (vii) 이 박제한 **6 지점 (76 · 126 · 143 · 175 · 234 · 235)** 과 대조하고, **몇 지점이 stale 인지** 를 수치로 확정한다 (정정 실행 여부는 AC 3 · AC 4 소관 — 여기서는 측정만).
  - (ix) **좌표 stale · 삽입 파급 실측 (AC 3 · AC 4 입력)**: `grep -n '\*\*[0-9]\{2,3\}\*\* 행' docs/architecture/components.md | head -40` + (i) 실측 대조로 **자기 좌표 stale 이 몇 지점인지** 를 가르고 (T-1461 **6** · T-1462 **0** · T-1463 **0** · T-1464 **0** 지점 선례 — 4 회 추세를 1 구로), 신규 각주를 **T-1464 각주 뒤 (`## Contracts` 절 안, 305 행 뒤)** 에 넣을 때 **밀리는 자기 참조 좌표가 몇 지점인지** 를 **수치 1 개** 로 제시한다 (`§ 12.55` → `§ 12.62` 로 이어진 계수 규칙 = components.md 자기 좌표 토큰만 세고 외부 파일 좌표는 제외, 범위 · 나열 토큰 `A ~ B` · `A · B` 는 1 지점 — 그 규칙을 그대로 승계하고 승계 사실을 1 구로 명시).
  - (x) **baseline** — `wc -l` components.md **317** · audit **5968** · ADR-0003 **173** · requirements.md **97** · deployment.md **232** · directory.md **203** · modules.md **259** · PLAN.md **175**, `grep -c '^## '` components.md **7** · audit **12**, audit `grep -c '^| REQ-'` **66** · `grep -c '^### 12\.'` **62**, components.md `grep -c '^> '` **108**.
- [ ] **AC 2 — 판정표**: AC 1 이 실측한 **축** 마다 `참 / 부분참 / 거짓` 을 판정한 표를 만든다. 각 row 는 **축 1 구 · 실측 근거 (행 번호 포함) · 판정 · 근거 1 구** 4 컬럼이다. 최소 축 **7** 개 — ① **row 278 의 `Scheduler → Worker` 결선 실재** ((v) ⓑⓓ — `§ 12.54` 축 ① 판정의 **인용 승계** 이며 edge 재판정이 아님을 1 구로 명시), ② **row 278 의 `NestJS @Cron decorator handler` message format** ((v) ⓐⓑ — edge label 과 **문구가 다르다** 는 점을 반영해 판정한다), ③ **row 278 비고의 `cron 시각 도달 시 handler 직접 호출`** ((v) ⓒ), ④ **row 279 의 결선 실재 · 방향** ((vi) ⓐⓑ), ⑤ **row 279 비고의 `manual trigger 와 동일 service 메서드 호출 — duplication 0`** ((vi) ⓒ — **사실 / 설계 의도** 2 축 분리), ⑥ **2 row 의 `sync/async` 값 (278 행 괄호 한정 비대칭) ↔ 289 행 정의문** ((vii) ⓐ), ⑦ **비고 셀 `ADR-0003 §3` pointer 정합 + REQ pointer 0 (승계)** ((vii) ⓑⓒ). 축 **⑧ `@Cron` 6 지점 좌표 stale** ((viii)) 도 판정표에 포함한다.
  - row **2** 개가 실 호출 표면 대비 **몇 중 표기** 인지를 `§ 12.58` 의 `5 : 1 : 4` · `§ 12.59` · `§ 12.61` 의 `2 : 1 : 1` · `§ 12.60` 의 `1 : 1 : 29` · `§ 12.62` 의 `5 : 1 : 2` 와 **같은 형식** (row N : 실 결선 M : 실 발신 node K) 으로 수치화한다.
  - **판정은 (iv) 의 `scheduler` node 외연 위에서만 유효** 함을 표 아래 1 구로 명시하고, **그 정의가 본 절 신설이 아니라 `§ 12.53` · `§ 12.54` 승계** 임을 함께 밝힌다.
  - **mermaid edge 재판정 금지** (`§ 12.54` ~ `§ 12.60` 이 23/23 을 닫았다 — 좌표 · 판정 결과 인용까지만) · **node 축 재판정 금지** (`§ 12.53`) · **`## Component table` row 본문 재판정 금지** (`§ 12.44` ~ `§ 12.52`) · **`## Contracts` 잔여 15 row (271 ~ 277 · 280 ~ 287) 판정 금지** (271 ~ 277 은 `§ 12.61` · `§ 12.62` 가 닫았고 나머지 8 은 후속 slice 소관 — census 재확인까지만).
- [ ] **AC 3 — 처리 방식 판정**: 후보 **3** 개 중 **채택 1 · 기각 2** 인 판정표를 만든다. 기각마다 근거 1 구.
  - 후보 — (A) **현행 유지 + 무편집** (audit `§ 12.63` 기록만), (B) **`## Contracts` 절 안 — T-1464 각주 직후 (현 305 행 뒤)** 에 blockquote **1 블록 (≤ 7 행)** 삽입 + AC 1 (viii) · (ix) 가 stale 로 확정한 좌표만 in-place 정정 (**≤ 8 지점**), (C) **표 셀 · 서문 · 289 행 정의문 in-place 수정**.
  - **각주군 말미 (231 행 뒤) 이전 후보는 평가하지 않는다** — `§ 12.62` 가 **"`## Contracts` 축 각주는 `## Contracts` 절 안 · 직전 slice 각주 뒤에 이어 붙인다"** 는 관행을 축 ② (파급 0 vs 11) · 축 ④ (표와의 거리) 실측으로 **확정** 했고 **다음 slice 는 재고하지 않는다** 고 못 박았다. 그 승계 사실을 1 구로 명시한다.
  - 판정 기준 **4 축** 명시 — ① `§ 12.15` **append-only 정합** (**(C) 는 이 축에서 먼저 판정**), ② **좌표 drift 파급** (AC 1 (ix) 수치를 그대로 근거로), ③ **cap** — 예상 diff ≤ 300 LOC · 변경 파일 **3 고정** (초과 후보는 **자동 기각 + split 제안을 파생 영향에 기록**), ④ **탐색성**.
  - **AC 2 축 ① ~ ⑧ 중 하나라도 `거짓` 이면 (A) 는 자동 기각**. **전 축이 `참` 이어도 (A) 를 자동 채택하지 않는다** — 탐색성 (축 ④) 을 함께 재고해 결론을 1 구로 남긴다.
  - **표의 셀 값 · 서문 문구 · 289 행 정의문을 고쳐 쓰는 선택지는 채택하지 않는다** — 처리는 **각주 병기** 로 한다. **코드 (`src/`) 를 고쳐 row 를 참으로 만드는 처리도 금지** — `pr` task 소관이다 (`§ 12.50` FU18 = cron → 평가 pipeline 미결선).
- [ ] **AC 4 — 채택안 반영**: AC 3 채택안대로만 편집한다.
  - **(A) 채택 시** — components.md **무편집** (`git status --porcelain docs/architecture/components.md` **빈 출력**) 이며, 유지 근거를 `§ 12.63` 에 남긴다.
  - **(B) 채택 시** — 신규 blockquote 는 **T-1464 각주 blockquote 마지막 행 직후 · `## References` heading 직전** 에 삽입하고 **≤ 7 행 + 앞 빈 줄 1 행** (기존 각주 블록 간 구분이 빈 줄 1 행이라는 `§ 12.62` 실측 관행을 승계하되, 실측이 다르면 실측을 따르고 그 선택을 1 구로 밝힌다), in-place 정정은 **AC 1 (viii) · (ix) 가 stale 로 확정한 지점만 ≤ 8 지점** (숫자 1 개씩 치환, **문장 재작성 금지**). `wc -l` 증가 **+8 이내** (317 → ≤ 325).
  - **(C) 채택 시** — 변경 파일 3 · diff ≤ 300 LOC 를 **먼저 검산** 하고, 초과하거나 정정 지점이 **9 지점 이상** 이면 채택을 철회해 (B) 로 내린 뒤 그 사실을 `§ 12.63` 에 1 구로 남긴다.
  - **삽입으로 heading 좌표가 다시 밀리면 편집 후 `grep -n '^## ' docs/architecture/components.md` 로 재측정해 반영** 한다 (`§ 12.51` `175` → `§ 12.60` `233` 으로 이어지다 `§ 12.61` · `§ 12.62` 에서 끊긴 재-drift 사슬이 **본 절에서 재현되는지** 를 1 구로 기록).
  - **문구 · 행 번호 · 절 번호 · task ID 는 AC 1 실측 출력과 1:1 일치** 해야 하며, 실측되지 않은 값을 **새로 창작하지 않는다**.
  - **`## Contracts` 표 본체 (269 ~ 287 행) · 서문 (267 행) · 289 행 `sync / async 의미` 문단 · T-1463 각주 (291 ~ 297 행) · T-1464 각주 (299 ~ 305 행) 본문 · mermaid 블록 (30 ~ 106 행) · `다이어그램 표기` bullet (108 ~ 113 행) · `## Component table` 표 본체 (117 ~ 126 행) · 1 ~ 4 행 blockquote · `## 개요` 각주 (16 ~ 20 행) · 안내 blockquote (128 ~ 131 행) · 각주 16 블록의 판정 문장 · `## References` 절 전체 무편집**. 허용되는 in-place 는 **stale 숫자 치환뿐** 이다.
  - **secret · 토큰 값 · 실 접속 문자열을 문서에 옮겨 적지 않는다** (CLAUDE.md §9 — 상수 **이름** · 옵션명 · path 문자열까지만 허용).
- [ ] **AC 5 — audit `§ 12.63` 신설**: [REQ-COVERAGE-AUDIT.md](../use-cases/REQ-COVERAGE-AUDIT.md) 의 `## 11. References` (**5955** 행, 좌표는 실측으로 교체) **직전** 에 `### 12.63 …` 절을 **순수 append** 한다 (기존 절 수정 0). 구성 — 본 절의 위치 · 계보 1 문단 (**`§ 12.62` 파생 영향 (1) 이 지목한 scheduler 2 row · `§ 12.54` 파생 영향 (3) 이 명시 이월한 row 판정의 회수** 명시 + **`scheduler` 외연이 신설이 아니라 승계** 임을 명시) / AC 1 실측 (명령 + 출력) / **진척 (표 17 중 9 판정 완료 · 잔여 8 · scheduler 그룹 2/2 마감)** / AC 2 판정표 / AC 3 처리 판정표 / AC 4 반영 결과 + 무편집 경계 / 파생 영향 (목록만) / 불변 검산 / 한계. **절 전체 ≤ 100 행** (초과 시 실측 인용을 요약형으로 압축하고 압축 사실을 한계에 명시).
  - `###` 레벨이라 `grep -c '^## '` **12 불변** · `grep -c '^| REQ-'` **66 불변** · `grep -c '^### 12\.'` **62 → 63**.
- [ ] **AC 6 — 불변 검산**: 다음을 실행해 출력을 `§ 12.63` 에 인용한다. `wc -l` components.md (317 → ≤ 325) · audit (5968 → +100 이내) · **ADR-0003 173 불변** · requirements.md (**97 불변**) · deployment.md (**232 불변**) · directory.md (**203 불변**) · modules.md (**259 불변**) · PLAN.md (**175 불변**), `git diff -U0 -- docs/architecture/components.md | grep '^@@'` 로 **hunk 개수 · 위치** 를 보이고 AC 4 허용 구간 밖 hunk **0** 을 실증 (무편집 채택 시 **hunk 0**), `git diff --numstat` 으로 **순수 삭제 0** (삭제 행이 있으면 stale 숫자 치환의 짝임을 1 구로 설명), `git status --porcelain src/ web/ test/ prisma/ deploy/ docker-compose.yml Dockerfile .github/ package.json README.md .claude/ docs/decisions/ docs/ops/ docs/PLAN.md docs/requirements.md docs/architecture/modules.md` **빈 출력** (특히 **`src/scheduling/` 무편집** 을 1 구로 명시), `git status --porcelain` 전체가 **3 파일 이내**.
- [ ] **AC 7 — 파생 영향 기록 (목록만, 본 slice 편집 금지)**: `§ 12.63` 말미에 후속 slice 대상을 목록으로 남긴다. 최소 포함 — (1) **다음 slice 1 순위 = `## Contracts` 잔여 8 row 중 `Worker` 발신 4 row (280 ~ 283 행)** — 대응 edge 4 개 (**80 ~ 83** 행) 를 `§ 12.56` 이 이미 닫아 판정 입력이 그대로 재사용되므로 한계 비용 최저임을 1 구로 (좌표는 AC 1 (i) 실측값으로 기재하고, 남은 그룹 분해 = Worker **4** · DB→PostgreSQL **1** (284) · 외부 egress **3** (285 ~ 287) 을 수치로 병기) / (2) fan-out 축약 **6** 의 표 등재 여부 (`§ 12.61` FU2 미소진 — 표 편집이라 본 stream 밖) / (3) `## GitHub Adapter — 3 instance 묶음 vs 분리 결정` 본문 ↔ 코드 대조 (`§ 12.48` FU4) / (4) row pointer 셀 보강 2 건 (`§ 12.50` FU2 · `§ 12.49` FU2) / (5) LLM · GitHub adapter ADR pointer 미등재 (`§ 12.47` FU5 · `§ 12.48` FU3) / (6) `@nestjs/config` 미도입 전수 sweep (`§ 12.39` FU3, ADR 게이트) / (7) reviewer 규약 미이행 (`§ 12.41` FU2) / (8) `deploy/README.md` ↔ deployment.md ↔ runbook 3 자 정합 (`§ 12.41` FU3) / (9) README 행 번호 pointer drift 전수 sweep / (10) REQ 번호 체계 잔재 sweep (`§ 12.38` FU3) / (11) `CLAUDE.md` §1 pointer 부정확 (T-1442 FU3) / (12) UC-09 `§ 5` sequence participant 병기 (**54 회째 이월**) / (13) modules.md 카운트 claim 대조 (`§ 12.34` FU1, ADR 게이트) / (14) **행 번호 → anchor 좌표계 이행** (**48 회째 이월** — 본 절 AC 1 (viii) 의 `@Cron` 좌표 stale 실측을 근거로 보탠다) / (15) 각주 heading 참조 anchor 이행 축소 scope (`§ 12.51` FU19) / (16) `§ 12.44` 한계 "mutation 러너 26 개" 정의 미확정 / (17) **`Scheduler` cron → 평가 pipeline 미결선** (`§ 12.50` FU18 — 본 절 축 ① · ③ 이 재확인했다면 1 구 병기, 코드 소관 `pr` task) / (18) `ADR-0003` "단일 DB 인스턴스" 좌표 부재 (`§ 12.46` FU16 · `§ 12.60` FU17) / (19) `Web UI` node 의 process subgraph 소속 표기 (`§ 12.53` FU19 · `§ 12.61` FU19) / (20) node · row 외연 정의의 문서 미박제 (`§ 12.55` FU20 · `§ 12.61` FU20 · `§ 12.62` FU20 — 본 절이 `scheduler` 외연을 **한 번 더 승계** 한 사실을 1 구로) / (21) modules.md **200** 행 1:N 매핑 ↔ 디렉토리 외연 상충 (`§ 12.56` FU21) / (22) 가변 instance 수 ↔ 고정 표기 정합 (`§ 12.57` FU22 · `§ 12.58` FU22) / (23) `worker --> backend_api` 미표기 결선 (`§ 12.56` FU23) / (24) dev / prod 2 모드의 다이어그램 · 표 미분리 (`§ 12.59` FU24 · `§ 12.61` FU24) / (25) `prisma migrate deploy` 채널 미표기 + `PostgreSQL 16+` version claim 정정 (`§ 12.60` FU25) / (26) 인증 규약의 문서 단일 정본 부재 (`§ 12.61` FU26) / (27) `sync/async` 컬럼 정의 (289 행) 의 경계 미규정 (`§ 12.61` FU27 · `§ 12.62` FU27 — 본 절 축 ⑥ 의 **괄호 한정 비대칭** 을 더한다면 병기) / (28) `## Contracts` 표의 REQ pointer 컬럼 부재 (`§ 12.62` FU28 승계) / (29) **`@Cron` claim 중복 6 지점의 좌표 동기 방식** — 축 ⑧ 이 stale 을 확정했다면, 같은 claim 이 6 곳에 흩어진 구조 자체를 어떻게 단일 정본화할지 (본 stream 밖 · 표 · 다이어그램 편집 소관).
- [ ] **AC 8 — R-110 / R-112 면제 근거 명시**: 본 task 는 `commitMode: direct` doc-only 로 production code **0 LOC** · 분기 **0** 이라 [CLAUDE.md](../../CLAUDE.md) §3.2 direct-mode 면제 조항에 따라 tester 호출 · happy / error / flow / negative 4 항목 · `pnpm test:cov` 가 **N/A** 임을 `§ 12.63` 에 1 구로 명시한다.
- [ ] **AC 9 — 언어 · 링크 규약**: 추가 문장은 모두 한국어 (§12), 문서 간 참조는 상대경로 markdown 링크, 수치는 실측 출력과 1:1 일치.

## Out of Scope

- **코드 · schema · 배포 자산 · CI · agent 정의 변경 절대 금지** — `src/` · `web/` · `test/` · `prisma/` · `scripts/` · `deploy/` · `docker-compose.yml` · `Dockerfile` · `.github/workflows/` · `package.json` · `.claude/agents/` 는 diff 에 등장하면 안 된다 (`grep` 열람은 read-only 라 허용). **row 를 참으로 만들려고 `src/scheduling/` 에 cron → pipeline 결선을 추가하는 시도 금지** — 미결선은 판정 대상이지 수리 대상이 아니다 (`§ 12.50` FU18, `pr` task 소관).
- **`## Contracts` 표 잔여 15 row (271 ~ 277 · 280 ~ 287 행) 판정 금지** — census 재확인 (개수) 까지만이며, 271 ~ 277 은 `§ 12.61` · `§ 12.62` 가 이미 닫았고 나머지 8 의 셀 본문 판정은 후속 slice 소관이다.
- **`## Contracts` 표 셀 · 서문 · 289 행 `sync / async 의미` 문단 편집 금지** — row 추가 · 삭제 · 셀 문구 수정 · 정의문 보강 어느 것도 하지 않는다. 판정은 각주 병기로만 남긴다.
- **mermaid edge 재판정 · 편집 금지** — `§ 12.54` ~ `§ 12.60` 이 23/23 을 닫았다 (좌표 · 판정 결과 인용까지만). 본 slice 의 축 ① ~ ④ 는 **row 셀 문구** 축일 뿐 edge 재판정이 아니다.
- **node 집합 · 이름 · 카운트 · 소속 · 외연 재정의 금지** — `§ 12.53` (node 축) · `§ 12.54` (`scheduler` 외연) 이 이미 닫았다. 본 절은 **승계 + 유효성 재검증** 까지만이다.
- **`## Component table` 8 row 의 본문 (책임 · contract · REQ · pointer) 재판정 · 편집 금지** — `§ 12.44` ~ `§ 12.52` 가 이미 닫았다. `Scheduler` row (126 행) 는 `@Cron` 중복 좌표 확인용 인용까지만 허용한다.
- **각주 위치 관행 재고 금지** — `§ 12.62` 가 실측으로 확정했다. 각주군 말미 이전 후보는 AC 3 에서 평가하지 않는다.
- **scheduler 구현 정책 자체 판정 금지** — row 278 · 279 의 **표기** 가 실 구현과 어긋나는지만 보고, dynamic 등록 방식의 적정성 · cron 표현식 검증 · timezone 처리 · job 중복 실행 방지 설계는 열지 않는다 (`pr` task 소관).
- **`docs/decisions/**` 편집 금지** — `ADR-0003` 은 pointer 정합 확인용 인용까지만 (무편집).
- **각주 16 블록 + T-1463 · T-1464 각주 블록의 판정 내용 재검토 · 재작성 · 삭제 · 이관 금지** — 좌표 확인 · 1 구 인용 · AC 4 가 허용한 stale 숫자 치환 (≤ 8 지점) 까지만.
- **audit 기존 절 (`§ 12.1` ~ `§ 12.62`) 수정 금지** — 판정은 `§ 12.63` 순수 append 로만 세운다 (`§ 12.15`). **`§ 12.54` 의 stale 좌표 (234 · 235) 도 audit 안에서는 고치지 않는다** — 측정 결과를 `§ 12.63` 에 새로 적는 것으로 갈음한다.
- **[modules.md](../architecture/modules.md) · `docs/PLAN.md` · `docs/requirements.md` 편집 금지** — 좌표 확인용 grep 인용까지만.
- **components.md 전면 anchor 좌표계 이행 실행 금지** — 파생 영향 (14) · (15) 소관이다.
- **다른 문서로의 cascade 금지** — [use-cases/INDEX.md](../use-cases/INDEX.md) · `UC-01` ~ `UC-09` · [INDEX.md](../architecture/INDEX.md) · [deployment.md](../architecture/deployment.md) · [directory.md](../architecture/directory.md) · [api.md](../architecture/api.md) · [README.md](../../README.md) 는 무편집.
- **빌드 · 테스트 · 설치 실행 금지** — `pnpm install` · `pnpm build` · `pnpm test` · `pnpm dev` 어느 것도 실행하지 않는다. 측정은 전부 read-only `grep` · `sed` · `awk` · `ls` · `wc` · `git` 이다.
- **CI drift-guard spec 작성 금지** — `pr` mode 소관이라 본 direct task 에서 진행하면 §3.1 위반.

## Suggested Sub-agents

`implementer` 단독 (doc-only, 코드 0 LOC — architect · tester 불요. §3.2 direct-mode 면제).

## Follow-ups

- 다음 slice 1 순위 = `## Contracts` 잔여 8 row 중 `Worker` 발신 **4** row (280 ~ 283 행) — 대응 edge 4 개 (80 ~ 83 행, `§ 12.56`) 의 판정 입력 재사용으로 한계 비용 최저.
- 축 ⑧ 이 `§ 12.54` 의 `@Cron` 좌표 stale 을 확정하면, 같은 claim 이 문서 안 6 지점에 흩어진 구조의 단일 정본화는 별도 stream 소관이다.
- 나머지 이월 항목 전량은 [REQ-COVERAGE-AUDIT.md](../use-cases/REQ-COVERAGE-AUDIT.md) `§ 12.63` 파생 영향 (1) ~ (29) 참조.
