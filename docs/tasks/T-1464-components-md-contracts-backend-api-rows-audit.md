---
id: T-1464
title: components.md `## Contracts` 표 **Backend API 발신 5 row** (273 ~ 277 행) ↔ 실 `src/` 호출 그래프 · in-process seam 대조 — `§ 12.61` 파생 영향 (1) 집행 + audit §12.62
phase: P5
status: PENDING
commitMode: direct
coversReq: [REQ-057]
estimatedDiff: 230
estimatedFiles: 3
created: 2026-08-05
independentStream: uc-doc-audit-resync
dependsOn: [T-1463]
touchesFiles:
  - docs/architecture/components.md
  - docs/use-cases/REQ-COVERAGE-AUDIT.md
  - docs/tasks/T-1464-components-md-contracts-backend-api-rows-audit.md
plannerNote: "uc-doc-audit-resync 76 번째 slice — §12.61 파생 영향 (1) 집행. Contracts 표 Backend API 발신 5 row 판정. doc-only 1.6x"
---

# T-1464 — components.md `## Contracts` Backend API 발신 5 row 대조

## Why

[T-1463](T-1463-components-md-contracts-table-census-user-facing-rows-audit.md) 이 `## Contracts` 표 축을 열어 **census (data row 17 : mermaid edge 23 · 미등재 edge 0 · fan-out 축약 6)** 를 확정하고 user-facing **2** row 를 판정하면서 ([REQ-COVERAGE-AUDIT.md](../use-cases/REQ-COVERAGE-AUDIT.md) `§ 12.61`) 파생 영향 **(1)** 에서 **다음 slice 1 순위를 잔여 15 row 중 `Backend API` 발신 5 row (273 ~ 277 행)** 로 명시 지목했다 (근거: 대응 mermaid edge **5** 개 (69 ~ 73 행) 를 `§ 12.55` 가 이미 닫아 **판정 입력이 그대로 재사용** 되므로 한계 비용 최저). 본 slice 는 그 지목을 그대로 승계한다.

더욱이 `§ 12.55` 는 자기 각주 (components.md **196** 행 부근) 에서 **"대응 `## Contracts` row 5 개 (273 ~ 277 행) 의 판정은 파생 영향 소관"** 이라고 **명시 이월** 해 뒀다 — 본 slice 는 그 이월을 회수하는 slice 이기도 하다. 따라서 **backend_api node 외연 정의** (`@Controller(` 20 개 중 자기 node 를 갖는 디렉토리를 뺀 **13** 개) 도 `§ 12.55` **승계** 이며 본 절 신설이 아니다 (`§ 12.61` 이 브라우저 outbound seam 을 `§ 12.59` 에서 승계한 것과 동형).

planner 사전 확인 — **아래는 전부 가설이며 전제가 아니다** (T-1440 AC 1 이후 planner 기대가 실측에 반증·정정된 선례가 **25** 회 있고, 직전 T-1463 에서도 "어느 edge 가 row 를 갖지 않는가" 라는 기대가 **미등재 0 · 차 6 은 fan-out 축약** 으로 뒤집혔으며 "`sync/async` 정의가 없을 것" 이라는 기대도 **289 행에 정의 존재** 로 반증됐다). executor 는 AC 1 에서 전부 재측정하고 **기대와 다르면 그 축의 판정을 실측대로 뒤집는다**. ① **273** 행 `Backend API | DB Persistence | sync | Prisma typed query (in-process) | ADR-0002. NestJS DI container 의 PrismaService singleton 경유.` 의 **`singleton 경유`** — `§ 12.55` 가 대응 edge 를 **참** 으로 닫았으나 (26 파일이 `../persistence/prisma.service` 경유 · 우회 0) **singleton** 이라는 DI scope claim 자체는 아직 실측된 적이 없다. ② **274** 행 (`Backend API → LLM Gateway`) · ③ **275** 행 (`Backend API → GitHub Adapter`, 비고 **`본 contract 가 외부 GitHub 호출의 단일 진입점`**) · ④ **276** 행 (`Backend API → Confluence Adapter`) — `§ 12.55` 가 대응 edge 70 · 71 · 72 를 **셋 다 거짓** (backend_api 디렉토리군 hit **0** · 실 소비자는 `worker` node) 으로 닫았으므로 row 3 개가 같은 판정을 승계받을 가능성 + 275 행의 **`단일 진입점`** 은 발신 주체를 오기했을 가능성 (실 진입점이 backend_api 가 아니라 worker 라면). ⑤ **277** 행 (`Backend API → Worker`) 의 **`sync (또는 fire-and-forget)`** 이중 표기 + 비고 **`구체는 P5`** 미래 시제 — `§ 12.61` 축 ⑥ 이 row 272 의 **`구체는 P3 Auth task`** 를 **거짓** 으로 확정한 것과 **동형 축** 이며, 현 phase 가 `P5-in-progress` 라 "이미 이행됐는가" 의 답이 row 272 와 다를 수 있다 (동형이라고 결론까지 복사하지 않는다). ⑥ **5 row 전부 `sync`** 인데 277 행만 `(또는 fire-and-forget)` 이 붙은 비대칭 ↔ **289** 행 `sync / async 의미` 정의 (`§ 12.61` 축 ⑦ 이 **경계 미규정** 을 확정) 가 in-process 5 row 를 가르는지. ⑦ 비고 셀의 **ADR pointer** (`ADR-0002` · `ADR-0003 §1`) ↔ 실 ADR 본문 좌표 정합 + 5 row 전부 **REQ pointer 0** 인 것이 표 컬럼 규약상 결손인지 (`## Component table` 은 REQ 컬럼을 따로 갖는다).

**행 좌표 주의** — components.md 는 T-1463 각주 +8 행으로 **309** 행이고, heading 은 `## 개요` **5** · `## Deployment 컨텍스트` **22** · `## Component diagram` **28** · `## Component table` **115** · `## GitHub Adapter …` **233** · `## Contracts` **265** · `## References` **299** 다. `## Contracts` 절은 서문 **267**, header **269**, 구분 **270**, data row **271 ~ 287** (**17** 개), `sync / async 의미` 문단 **289**, **T-1463 각주 blockquote 291 ~ 297**, 빈 줄 **298** 이며 그 뒤 **299** heading 이다. 각주군 (T-1436 ~ T-1462 블록) 은 여전히 `## Component table` 절 안 **231** 행까지다. AC 1 (i) 에서 재실측한다.

[PLAN.md](../PLAN.md) 의 미완 bullet (106 · 108 · 109 · 140 · 151) 은 owner 게이트 · 외부 credential · 새 dependency 게이트라 planner 단독 진행 불가이므로, 본 doc stream 이 현 시점 우선순위 최상위다.

## Required Reading

- `docs/architecture/components.md` — **309 행**. 다음 구간만 읽는다.
  - **265 ~ 270 행** (`## Contracts` heading · 서문 · header · 구분) + **273 ~ 277 행** (data row **5** 개) — **본 slice 의 판정 대상**.
  - **271 · 272 행** (user-facing 2 row) · **278 ~ 287 행** (Scheduler · Worker · DB · egress 10 row) — **무편집**, **census 재확인 (개수) 까지만**. **row 본문 판정 금지** (271 · 272 는 `§ 12.61` 이 닫았고 나머지 10 은 후속 slice 소관).
  - **289 행** (`sync / async 의미` 문단) — **무편집, 인용만**. 정의문 보강은 `§ 12.61` 파생 영향 (27) 소관이다.
  - **291 ~ 297 행** (T-1463 각주 blockquote) — **무편집**. 삽입점 후보 좌표 확인 + census 수치 · seam 정의 승계 근거 1 구 인용용.
  - **193 ~ 197 행** (T-1457 각주 블록) — **무편집**. **backend_api node 외연 정의 (13 개) 승계 근거 1 구 인용** + edge 70 ~ 73 판정 결과 인용 + **"row 5 개 판정은 파생 영향 소관" 이월 문구** 확인용.
  - **199 ~ 204 행** (T-1458 각주 블록) — **무편집**. `worker` node 외연 (2 디렉토리) 1 구 인용까지만 (축 ② ~ ④ 의 "실 소비자" 대조용).
  - **69 ~ 73 행** (`%% Backend orchestration` edge 5 개) — **무편집, 대조용**. 좌표와 label 확인까지만 (`§ 12.55` 가 이미 닫았다).
  - **108 ~ 113 행** (`다이어그램 표기` bullet) — 인용만. 재판정 금지.
  - **119 ~ 126 행 표 row** — **무편집**, 컬럼 규약 대조용 문구 인용까지만 (축 ⑦). **row 본문 재판정 금지** (`§ 12.44` ~ `§ 12.50` 소관).
  - **그 밖 전 구간** — **무편집, heading 좌표 확인만**.
- `docs/use-cases/REQ-COVERAGE-AUDIT.md` — **5898 행**. **`### 12.15`** (append-only 처리 방침 정본) · **`### 12.61`** (파생 영향 **(1)** 원문 = 본 slice 의 지목 근거 + census 표 + (viii) 계수 규칙 + **한계 6** = 각주 위치 관행 미결) · **`### 12.55`** 의 **backend_api 외연 정의 · edge 70 ~ 73 판정 단락만** (승계 원문 인용용 — 절 전체 통독 금지) · **`## 11. References`** (**5885** 행 부근) — `§ 12.62` 삽입 위치 경계. **`§ 12.44` ~ `§ 12.54` · `§ 12.56` ~ `§ 12.60` 본문은 열지 않는다** — 필요한 판정은 components.md 각주 1 구 인용으로 갈음한다 (§7 context 절약).
- `src/persistence/prisma.service.ts` · `src/persistence/prisma.module.ts` — **무편집, read-only**. `@Injectable` / `@Global` / `providers` / `exports` **선언 행 1 ~ 2 개 인용까지만**. **파일 통독 금지** (축 ① 의 singleton scope 확인 목적 한정).
- `docs/decisions/ADR-0003-deployment.md` — **173 행. 무편집, 읽기만**. `Decision §1` (monolithic) 문장 **1 구 인용까지만** (축 ⑦ pointer 정합).
- `docs/decisions/ADR-0002-db.md` — **무편집, 읽기만**. Prisma / DI 관련 문장이 있는지 `grep` 확인까지만 (축 ① · ⑦ pointer 정합).
- `docs/PLAN.md` — **175 행. 무편집, 읽기만**. 미완 bullet 좌표 + **P5 phase bullet 문구** 확인용 `grep` 만 (축 ⑤ 의 `구체는 P5` 대조).
- `CLAUDE.md` §3 (task 크기 상한) · §3.2 (direct doc-only 면제) · §7 (context 절약) · §9 (secret 금지) · §12 (언어 정책)

## Acceptance Criteria

- [ ] **AC 1 — 실측 선행 (날조 금지)**: 편집 전에 다음을 직접 측정해 `§ 12.62` 에 **명령과 출력을 함께** 인용한다. 기대값과 **다르면 그 축의 판정을 실측대로 뒤집는다** (Why 의 ① ~ ⑦ 은 가설일 뿐이다).
  - (i) **좌표 재확인**: `grep -n '^#\{1,3\} ' docs/architecture/components.md` 로 heading 좌표를 **먼저 실측** 한다 (본 AC 의 `265` · `299` 도 stale 일 수 있다 — T-1436 ~ T-1463 선례). 이어 `grep -n '^| ' docs/architecture/components.md` 로 표 행 좌표를 확정해 `## Component table` 표와 `## Contracts` 표를 **좌표로 분리** 하고, `grep -n '^> ' docs/architecture/components.md | tail -12` 로 **T-1463 각주 blockquote 의 마지막 행** (삽입점 후보) 을 확정한다.
  - (ii) **census 승계 재확인 (신설 아님)**: `awk 'NR>=265' docs/architecture/components.md | grep -c '^| '` → **19** 에서 header · 구분 **2** 를 빼 **data row 17** 을 재확인하고, `§ 12.61` 의 census 표 (그룹별 edge : row = user-facing 2:2 · orchestration **5:5** · scheduler 2:2 · worker 4:4 · db 1:1 · egress 9:3) 를 **1 구 인용으로 승계** 한다 (**재산출 금지**). 본 slice 판정 대상은 **orchestration 5 row** 이며, 종료 시 **표 17 중 7 판정 완료 · 잔여 10** 임을 수치로 명시한다 (`§ 12.61` 이 세운 **2/17** 에 **+5**).
  - (iii) **대상 row 원문 인용**: `sed -n '269,277p' docs/architecture/components.md` (좌표는 (i) 실측값으로 교체) 로 header · 구분 · data row **5** 개를 그대로 인용하고, 5 row × **5 컬럼** 분해표를 만든다.
  - (iv) **backend_api node 외연 승계 (신설 아님)**: `§ 12.55` 가 신설한 외연 정의 (`@Controller(` **20** 개 중 자기 node 를 갖는 디렉토리 — `src/scheduling/` **3** = scheduler · `src/assessment-collection|evaluation/` **2** = worker · `src/llm/` **2** = llm_gateway — 를 뺀 **13** 개) 를 components.md **193** 행 부근 각주 1 구 인용으로 **그대로 승계** 하고, 여전히 유효한지 `grep -rn '@Controller(' src --include=*.ts | grep -v spec | wc -l` + `grep -rln '@Controller(' src --include=*.ts | grep -v spec | cut -d/ -f2 | sort | uniq -c` 로 **재검증** 한다 (T-1457 이후 controller 증감이 있으면 그 수치를 실측대로 갱신해 인용하고, 갱신이 판정에 미치는 영향을 1 구로 밝힌다 — **재정의가 아니라 재검증** 이다).
  - (v) **row 273 실측 (축 ①)**: ⓐ `grep -n '@Global\|@Injectable\|Scope\.' src/persistence/prisma.module.ts src/persistence/prisma.service.ts | head -8` (DI scope 선언 — `Scope.REQUEST` / `Scope.TRANSIENT` 가 있으면 `singleton` claim 이 흔들린다), ⓑ `grep -n 'providers\|exports' src/persistence/prisma.module.ts | head -5`, ⓒ `grep -rln 'PrismaService' src --include=*.ts | grep -v spec | wc -l` + `grep -rn "persistence/prisma.service'" src --include=*.ts | grep -v spec | wc -l` (`§ 12.55` 의 **26 파일 · 우회 0** 이 유지되는지 재검증), ⓓ `grep -rn 'new PrismaClient\|PrismaClient(' src --include=*.ts | grep -v spec | head -5` (DI 를 우회한 직접 인스턴스화가 있으면 `singleton 경유` 가 부분참으로 내려간다).
  - (vi) **row 274 · 275 · 276 실측 (축 ② ~ ④)**: ⓐ `§ 12.55` 가 확정한 **backend_api 디렉토리군 hit 0** (LLM · GitHub · Confluence) 을 components.md **195** 행 부근 각주 1 구로 인용 승계하고, ⓑ `grep -rn 'LLM_GATEWAY\|LlmGateway' src --include=*.ts | grep -v spec | cut -d: -f1 | sort -u | head -8` · ⓒ `grep -rn 'GithubInstanceClient\|GithubCollection' src --include=*.ts | grep -v spec | cut -d: -f1 | sort -u | head -8` · ⓓ `grep -rn 'Confluence' src --include=*.ts | grep -v spec | cut -d: -f1 | sort -u | head -8` 로 **실 소비자 디렉토리** 를 열거해 (iv) 외연과 대조한다 (**edge 재판정이 아니라 row 셀 문구 축** 임을 1 구로 명시). ⓔ **275 행의 `본 contract 가 외부 GitHub 호출의 단일 진입점`** 은 두 축으로 가른다 — (가) **발신 주체** 가 backend_api 가 맞는지 ((iv) 외연 대조), (나) **단일성** 자체 (adapter 밖에서 GitHub 을 직접 호출하는 지점이 있는지 — `grep -rn 'api.github.com\|Octokit\|@octokit' src --include=*.ts | grep -v spec | cut -d: -f1 | sort -u | head -5`).
  - (vii) **row 277 실측 (축 ⑤)**: ⓐ `§ 12.55` 의 **backend_api → worker 호출 0 · 역방향 import 22 지점** 을 각주 1 구로 인용 승계하고 `grep -rn 'AssessmentEvaluation\|AssessmentCollection' src --include=*.ts | grep -v spec | cut -d: -f1 | sort -u | head -8` 로 재검증한다. ⓑ **`sync (또는 fire-and-forget)`** 의 fire-and-forget 이 실재하는지 — `grep -rn 'void this\.\|setImmediate\|\.catch((' src/scheduling src/assessment-evaluation --include=*.ts | grep -v spec | head -6`. ⓒ **`구체는 P5` 미래 시제** ↔ 실 이행 상태 — `ls src/assessment-evaluation/*.service.ts 2>/dev/null | wc -l` + `grep -n 'P5' docs/PLAN.md | head -5` + `grep -n '"phase"' docs/STATE.json` (현 phase 토큰까지만 인용). **row 272 의 `구체는 P3 Auth task` 가 거짓이었다는 이유만으로 본 축을 거짓으로 복사하지 않는다** — 실측이 가른다.
  - (viii) **축 ⑥ · ⑦ 실측**: ⓐ **289** 행 정의문 (`sync = 호출자 thread 가 응답까지 await` · `async = 외부 HTTPS 경계`) 을 그대로 인용해 **in-process 5 row 를 가르는 축이 되는지** 판단하고, 277 행만 `(또는 fire-and-forget)` 이 붙은 비대칭이 정의문으로 설명되는지 1 구로 가른다 (`§ 12.61` 축 ⑦ 의 **경계 미규정** 결론을 인용 승계하되 본 축은 **in-process 쪽** 이라 다른 면임을 밝힌다). ⓑ `grep -n 'Decision' docs/decisions/ADR-0003-deployment.md | head -6` + `grep -c 'Prisma' docs/decisions/ADR-0002-db.md` 로 비고 셀 ADR pointer 의 **가리키는 대상 실재** 를 확인하고, `sed -n '117,118p' docs/architecture/components.md` 로 `## Component table` header 를 인용해 **REQ 컬럼 유무 차이** 를 대조한다 (5 row 의 REQ pointer **0** 이 표 규약상 결손인지 — `## Contracts` header 에 REQ 컬럼이 아예 없으면 결손이 아니다).
  - (ix) **좌표 stale · 삽입 파급 실측 (AC 3 · AC 4 입력)**: `grep -n '\*\*[0-9]\{2,3\}\*\* 행' docs/architecture/components.md | head -40` + (i) 실측 대조로 **자기 좌표 stale 이 몇 지점인지** 를 가르고 (T-1461 **6** · T-1462 **0** · T-1463 **0** 지점 선례 — 3 회 추세를 1 구로), 신규 각주를 ⓐ **T-1463 각주 뒤 (`## Contracts` 절 안, 297 행 뒤)** 에 넣을 때 / ⓑ **각주군 말미 (231 행 뒤)** 에 넣을 때 **각각 밀리는 자기 참조 좌표가 몇 지점인지** 를 **수치 2 개** 로 제시한다 (`§ 12.55` → `§ 12.61` 로 이어진 계수 규칙 = components.md 자기 좌표 토큰만 세고 외부 파일 좌표는 제외, 범위 · 나열 토큰 `A ~ B` · `A · B` 는 1 지점 — 그 규칙을 그대로 승계하고 승계 사실을 1 구로 명시).
  - (x) **baseline** — `wc -l` components.md **309** · audit **5898** · ADR-0003 **173** · requirements.md **97** · deployment.md **232** · directory.md **203** · modules.md **259** · PLAN.md **175**, `grep -c '^## '` components.md **7** · audit **12**, audit `grep -c '^| REQ-'` **66** · `grep -c '^### 12\.'` **61**, components.md `grep -c '^> '` **101**.
- [ ] **AC 2 — 판정표**: AC 1 이 실측한 **축** 마다 `참 / 부분참 / 거짓` 을 판정한 표를 만든다. 각 row 는 **축 1 구 · 실측 근거 (행 번호 포함) · 판정 · 근거 1 구** 4 컬럼이다. 최소 축 **7** 개 — ① **row 273 의 `NestJS DI container 의 PrismaService singleton 경유`** ((v) ⓐ ~ ⓓ), ② **row 274 의 `Backend API → LLM Gateway` 결선 실재** ((vi) ⓐⓑ — `§ 12.55` 판정 **인용 승계** 이며 edge 재판정이 아님을 1 구로 명시), ③ **row 275 의 결선 실재 + `본 contract 가 외부 GitHub 호출의 단일 진입점`** ((vi) ⓐⓒⓔ — (가) 발신 주체 · (나) 단일성 **2 축을 분리** 판정), ④ **row 276 의 결선 실재 + `동일 process`** ((vi) ⓐⓓ), ⑤ **row 277 의 `sync (또는 fire-and-forget)` 이중 표기 + `manual trigger flow` + `구체는 P5` 미래 시제** ((vii) ⓐⓑⓒ), ⑥ **5 row 의 `sync/async` 컬럼 값 (4 `sync` + 1 이중) ↔ 289 행 정의문의 in-process 판별력** ((viii) ⓐ), ⑦ **비고 셀 ADR pointer 정합 + REQ pointer 0** ((viii) ⓑ).
  - row **5** 개가 실 호출 표면 대비 **몇 중 표기** 인지를 `§ 12.58` 의 `5 : 1 : 4` · `§ 12.59` 의 `2 : 1 : 1` · `§ 12.60` 의 `1 : 1 : 29` · `§ 12.61` 의 `2 : 1 : 1` 과 **같은 형식** (row N : 실 결선 M : 실 소비자 node K) 으로 수치화한다.
  - **판정은 (iv) 의 backend_api node 외연 정의 위에서만 유효** 함을 표 아래 1 구로 명시하고, **그 정의가 본 절 신설이 아니라 `§ 12.55` 승계** 임을 함께 밝힌다.
  - **mermaid edge 재판정 금지** (`§ 12.54` ~ `§ 12.60` 이 23/23 을 닫았다 — 좌표 · 판정 결과 인용까지만) · **node 축 재판정 금지** (`§ 12.53`) · **`## Component table` row 본문 재판정 금지** (`§ 12.44` ~ `§ 12.50`) · **`## Contracts` 잔여 10 row (271 · 272 · 278 ~ 287) 판정 금지** (271 · 272 는 `§ 12.61` 이 닫았고 나머지 10 은 후속 slice 소관 — census 재확인까지만).
- [ ] **AC 3 — 처리 방식 판정**: 후보 4 개 중 **채택 1 · 기각 3** 인 판정표를 만든다. 기각마다 근거 1 구.
  - 후보 — (A) **현행 유지 + 무편집** (audit `§ 12.62` 기록만), (B) **각주군 말미 append** — 각주 구간 **끝 (현 231 행 뒤)** 에 blockquote **1 블록 (≤ 7 행)** 을 신설하고 AC 1 (ix) 이 stale 로 확정한 좌표만 in-place 정정 (**≤ 8 지점**), (C) **`## Contracts` 절 안 — T-1463 각주 직후 (현 297 행 뒤)** 에 blockquote **1 블록 (≤ 7 행)** 이어 붙임, (D) **표 셀 · 서문 · 289 행 정의문 in-place 수정**.
  - 판정 기준 **4 축** 명시 — ① `§ 12.15` **append-only 정합** (**(D) 는 이 축에서 먼저 판정**), ② **좌표 drift 파급** (AC 1 (ix) 의 수치 2 개를 그대로 근거로), ③ **cap** — 예상 diff ≤ 300 LOC · 변경 파일 **3 고정** (초과 후보는 **자동 기각 + split 제안을 파생 영향에 기록**), ④ **탐색성** — **본 축은 `§ 12.61` 한계 6 이 남긴 미결 (`## Contracts` 축 각주를 표 곁에 이어 붙일지 각주군으로 되돌아갈지) 을 실측으로 확정하는 자리** 이므로, 축 ② · ④ 재측정 결과를 근거로 **관행을 명시 확정** 하고 그 확정을 1 구로 남긴다 (다음 slice 가 다시 재고하지 않도록).
  - **AC 2 축 ① ~ ⑦ 중 하나라도 `거짓` 이면 (A) 는 자동 기각**. **전 축이 `참` 이어도 (A) 를 자동 채택하지 않는다** — 탐색성 (축 ④) 을 함께 재고해 결론을 1 구로 남긴다.
  - **표의 셀 값 · 서문 문구 · 289 행 정의문을 고쳐 쓰는 선택지는 채택하지 않는다** — 처리는 **각주 병기** 로 한다. **코드 (`src/`) 를 고쳐 row 를 참으로 만드는 처리도 금지** — `pr` task 소관이다.
- [ ] **AC 4 — 채택안 반영**: AC 3 채택안대로만 편집한다.
  - **(A) 채택 시** — components.md **무편집** (`git status --porcelain docs/architecture/components.md` **빈 출력**) 이며, 유지 근거를 `§ 12.62` 에 남긴다.
  - **(C) 채택 시** — 신규 blockquote 는 **T-1463 각주 blockquote 마지막 행 직후 · `## References` heading 직전** 에 삽입하고 **≤ 7 행** (기존 blockquote 와 **연속** 시킬지 **빈 줄 1 행으로 분리** 할지는 실측한 렌더링 관행에 따라 정하고 그 선택을 1 구로 밝힌다), in-place 정정은 **AC 1 (ix) 이 stale 로 확정한 지점만 ≤ 8 지점** (숫자 1 개씩 치환, **문장 재작성 금지**). `wc -l` 증가 **+8 이내** (309 → ≤ 317).
  - **(B) 채택 시** — 삽입 위치는 **마지막 각주 블록 뒤 · `## GitHub Adapter …` heading 직전**, **≤ 7 행 + 앞 빈 줄 1 행**, 밀린 자기 좌표는 **전부** 정정한다. 실측이 상한 (8 지점) 을 넘으면 **넘긴 수치와 원인을 `§ 12.62` 에 1 구로 남기고 실측대로 전부 정정** 한다 (일부만 고치고 stale 을 남기지 않는다 — `§ 12.59` 선례).
  - **(D) 채택 시** — 변경 파일 3 · diff ≤ 300 LOC 를 **먼저 검산** 하고, 초과하거나 정정 지점이 **9 지점 이상** 이면 채택을 철회해 (C) 로 내린 뒤 그 사실을 `§ 12.62` 에 1 구로 남긴다.
  - **삽입으로 heading 좌표가 다시 밀리면 편집 후 `grep -n '^## ' docs/architecture/components.md` 로 재측정해 반영** 한다 (`§ 12.51` `175` → `§ 12.58` `219` → `§ 12.59` `226` → `§ 12.60` `233` 으로 이어지다 `§ 12.61` 에서 끊긴 재-drift 사슬이 **본 절에서 재현되는지** 를 1 구로 기록).
  - **문구 · 행 번호 · 절 번호 · task ID 는 AC 1 실측 출력과 1:1 일치** 해야 하며, 실측되지 않은 값을 **새로 창작하지 않는다**.
  - **`## Contracts` 표 본체 (269 ~ 287 행) · 서문 (267 행) · 289 행 `sync / async 의미` 문단 · T-1463 각주 (291 ~ 297 행) 본문 · mermaid 블록 (30 ~ 106 행) · `다이어그램 표기` bullet (108 ~ 113 행) · `## Component table` 표 본체 (117 ~ 126 행) · 1 ~ 4 행 blockquote · `## 개요` 각주 (16 ~ 20 행) · 안내 blockquote (128 ~ 131 행) · 각주 16 블록의 판정 문장 · `## References` 절 전체 무편집**. 허용되는 in-place 는 **stale 숫자 치환뿐** 이다.
  - **secret · 토큰 값 · 실 접속 문자열을 문서에 옮겨 적지 않는다** (CLAUDE.md §9 — 상수 **이름** · 옵션명 · path 문자열까지만 허용).
- [ ] **AC 5 — audit `§ 12.62` 신설**: [REQ-COVERAGE-AUDIT.md](../use-cases/REQ-COVERAGE-AUDIT.md) 의 `## 11. References` **직전** 에 `### 12.62 …` 절을 **순수 append** 한다 (기존 절 수정 0). 구성 — 본 절의 위치 · 계보 1 문단 (**`§ 12.61` 파생 영향 (1) 이 지목한 orchestration 5 row · `§ 12.55` 가 명시 이월한 row 판정의 회수** 명시 + **backend_api 외연이 신설이 아니라 `§ 12.55` 승계** 임을 명시) / AC 1 실측 (명령 + 출력) / **진척 (표 17 중 7 판정 완료 · 잔여 10)** / AC 2 판정표 / AC 3 처리 판정표 (+ **각주 위치 관행 확정** 1 구) / AC 4 반영 결과 + 무편집 경계 / 파생 영향 (목록만) / 불변 검산 / 한계. **절 전체 ≤ 100 행** (초과 시 실측 인용을 요약형으로 압축하고 압축 사실을 한계에 명시).
  - `###` 레벨이라 `grep -c '^## '` **12 불변** · `grep -c '^| REQ-'` **66 불변** · `grep -c '^### 12\.'` **61 → 62**.
- [ ] **AC 6 — 불변 검산**: 다음을 실행해 출력을 `§ 12.62` 에 인용한다. `wc -l` components.md (309 → ≤ 317) · audit (5898 → +100 이내) · **ADR-0003 173 불변** · **ADR-0002 불변** · requirements.md (**97 불변**) · deployment.md (**232 불변**) · directory.md (**203 불변**) · modules.md (**259 불변**) · PLAN.md (**175 불변**), `git diff -U0 -- docs/architecture/components.md | grep '^@@'` 로 **hunk 개수 · 위치** 를 보이고 AC 4 허용 구간 밖 hunk **0** 을 실증 (무편집 채택 시 **hunk 0**), `git diff --numstat` 으로 **순수 삭제 0** (삭제 행이 있으면 stale 숫자 치환의 짝임을 1 구로 설명), `git status --porcelain src/ web/ test/ prisma/ deploy/ docker-compose.yml Dockerfile .github/ package.json README.md .claude/ docs/decisions/ docs/ops/ docs/PLAN.md docs/requirements.md docs/architecture/modules.md` **빈 출력** (특히 **`src/persistence/` · `src/assessment-*/` 무편집** 을 1 구로 명시), `git status --porcelain` 전체가 **3 파일 이내**.
- [ ] **AC 7 — 파생 영향 기록 (목록만, 본 slice 편집 금지)**: `§ 12.62` 말미에 후속 slice 대상을 목록으로 남긴다. 최소 포함 — (1) **다음 slice 1 순위 = `## Contracts` 잔여 10 row 중 `Scheduler` 발신 2 row (278 · 279 행)** — 대응 edge 2 개 (**76 · 77** 행) 를 edge 축 첫 slice 가 이미 닫아 판정 입력이 그대로 재사용되므로 한계 비용 최저임을 1 구로 (좌표는 AC 1 (i) 실측값으로 기재하고, 남은 그룹 분해 = Scheduler **2** · Worker **4** (280 ~ 283) · DB→PostgreSQL **1** (284) · 외부 egress **3** (285 ~ 287) 을 수치로 병기) / (2) **census 가 드러낸 fan-out 축약 6 의 표 등재 여부** (`§ 12.61` FU2 미소진 — 표 편집이라 본 stream 밖) / (3) `## GitHub Adapter — 3 instance 묶음 vs 분리 결정` 본문 ↔ 코드 대조 (`§ 12.48` FU4) / (4) row pointer 셀 보강 2 건 (`Scheduler` = `ADR-0042` 미등재 `§ 12.50` FU2 · `Confluence Adapter` `§ 12.49` FU2) / (5) LLM · GitHub adapter ADR pointer 미등재 (`§ 12.47` FU5 · `§ 12.48` FU3) / (6) `@nestjs/config` 미도입 전수 sweep (`§ 12.39` FU3, ADR 게이트) / (7) reviewer 규약 미이행 (`§ 12.41` FU2) / (8) `deploy/README.md` ↔ deployment.md ↔ runbook 3 자 정합 (`§ 12.41` FU3) / (9) README 행 번호 pointer drift 전수 sweep / (10) REQ 번호 체계 잔재 sweep (`§ 12.38` FU3) / (11) `CLAUDE.md` §1 pointer 부정확 (T-1442 FU3) / (12) UC-09 `§ 5` sequence participant 병기 (**53 회째 이월**) / (13) modules.md 카운트 claim 대조 (`§ 12.34` FU1, ADR 게이트) / (14) **행 번호 → anchor 좌표계 이행** (**47 회째 이월** — 본 절 AC 1 (ix) 파급 수치를 근거로 보탠다) / (15) 각주 heading 참조 anchor 이행 축소 scope (`§ 12.51` FU19) / (16) `§ 12.44` 한계 "mutation 러너 26 개" 정의 미확정 / (17) `Scheduler` cron → 평가 pipeline 미결선 (`§ 12.50` FU18 — 코드 소관, `pr` task 로만) / (18) `ADR-0003` "단일 DB 인스턴스" 좌표 부재 (`§ 12.46` FU16 · `§ 12.60` FU17) / (19) `Web UI` node 의 process subgraph 소속 표기 (`§ 12.53` FU19 · `§ 12.61` FU19) / (20) node · row 외연 정의의 문서 미박제 (`§ 12.55` FU20 · `§ 12.60` FU19 · `§ 12.61` FU20 — 본 절이 외연을 **한 번 더 승계** 한 사실이 "정의를 문서 본문에 박제해야 한다" 는 근거를 더한다면 1 구로) / (21) modules.md **200** 행 1:N 매핑 ↔ 디렉토리 외연 상충 (`§ 12.56` FU21) / (22) 가변 instance 수 ↔ 고정 표기 정합 (`§ 12.57` FU22 · `§ 12.58` FU22) / (23) `worker --> backend_api` 미표기 결선 (`§ 12.56` FU23 — 본 절 축 ⑤ 의 역방향 import 재검증 결과를 병기) / (24) dev / prod 2 모드의 다이어그램 · 표 미분리 (`§ 12.59` FU24 · `§ 12.61` FU24) / (25) `prisma migrate deploy` 채널 미표기 + `PostgreSQL 16+` version claim 정정 (`§ 12.60` FU25) / (26) 인증 규약의 문서 단일 정본 부재 (`§ 12.61` FU26) / (27) `sync/async` 컬럼 정의 (289 행) 의 경계 미규정 (`§ 12.61` FU27 — 본 절 축 ⑥ 이 **in-process 판별력** 축을 더했다면 병기) / (28) **`## Contracts` 표의 REQ pointer 컬럼 부재** (축 ⑦ 이 `## Component table` 과의 규약 차이를 확정한 경우에만 — 컬럼 신설은 표 편집이라 본 stream 밖) / (29) **(B) · (D) 후보 split 제안** (기각이 cap 사유였을 때만).
- [ ] **AC 8 — R-110 / R-112 면제 근거 명시**: 본 task 는 `commitMode: direct` doc-only 로 production code **0 LOC** · 분기 **0** 이라 [CLAUDE.md](../../CLAUDE.md) §3.2 direct-mode 면제 조항에 따라 tester 호출 · happy / error / flow / negative 4 항목 · `pnpm test:cov` 가 **N/A** 임을 `§ 12.62` 에 1 구로 명시한다.
- [ ] **AC 9 — 언어 · 링크 규약**: 추가 문장은 모두 한국어 (§12), 문서 간 참조는 상대경로 markdown 링크, 수치는 실측 출력과 1:1 일치.

## Out of Scope

- **코드 · schema · 배포 자산 · CI · agent 정의 변경 절대 금지** — `src/` · `web/` · `test/` · `prisma/` · `scripts/` · `deploy/` · `docker-compose.yml` · `Dockerfile` · `.github/workflows/` · `package.json` · `.claude/agents/` 는 diff 에 등장하면 안 된다 (`grep` 열람은 read-only 라 허용). **row 를 참으로 만들려고 `src/` 에 결선을 추가하는 시도 금지** — 미결선은 판정 대상이지 수리 대상이 아니다 (`pr` task 소관).
- **`## Contracts` 표 잔여 10 row (271 · 272 · 278 ~ 287 행) 판정 금지** — census 재확인 (개수) 까지만이며, 271 · 272 는 `§ 12.61` 이 이미 닫았고 나머지 10 의 셀 본문 판정은 후속 slice 소관이다.
- **`## Contracts` 표 셀 · 서문 · 289 행 `sync / async 의미` 문단 편집 금지** — row 추가 · 삭제 · 셀 문구 수정 · 정의문 보강 어느 것도 하지 않는다. 판정은 각주 병기로만 남긴다.
- **mermaid edge 재판정 · 편집 금지** — `§ 12.54` ~ `§ 12.60` 이 23/23 을 닫았다 (좌표 · 판정 결과 인용까지만). 본 slice 의 축 ② ~ ⑤ 는 **row 셀 문구** 축일 뿐 edge 재판정이 아니다.
- **node 집합 · 이름 · 카운트 · 소속 · 외연 재정의 금지** — `§ 12.53` (node 축) · `§ 12.55` (backend_api 외연) · `§ 12.56` (worker 외연) 이 이미 닫았다. 본 절은 **승계 + 유효성 재검증** 까지만이다.
- **`## Component table` 8 row 의 본문 (책임 · contract · REQ · pointer) 재판정 · 편집 금지** — `§ 12.44` ~ `§ 12.50` 이 이미 닫았다. header 컬럼 규약 대조 (축 ⑦) 를 위한 **117 행 인용까지만** 허용한다.
- **DI · 트랜잭션 · connection pool 정책 자체 판정 금지** — row 273 의 **표기** 가 실 구현과 어긋나는지만 보고 (축 ①), `PrismaService` 의 pool size · transaction 경계 · shutdown hook 적정성은 열지 않는다 (`pr` task 소관).
- **P5 evaluation pipeline 실작업 · 진척 평가 금지** — 축 ⑤ 는 `구체는 P5` 라는 **문서 표기** 의 시제를 대조할 뿐이며, pipeline 자체의 완성도 · 잔여 작업 산정은 별도 축이다 (`docs/PLAN.md` · `docs/STATE.json` 무편집).
- **`docs/decisions/**` 편집 금지** — `ADR-0002` · `ADR-0003` 은 pointer 정합 확인용 인용까지만 (무편집).
- **각주 16 블록 + T-1463 각주 블록의 판정 내용 재검토 · 재작성 · 삭제 · 이관 금지** — 좌표 확인 · 1 구 인용 · AC 4 가 허용한 stale 숫자 치환 (≤ 8 지점) 까지만.
- **audit 기존 절 (`§ 12.1` ~ `§ 12.61`) 수정 금지** — 판정은 `§ 12.62` 순수 append 로만 세운다 (`§ 12.15`).
- **[modules.md](../architecture/modules.md) · `docs/PLAN.md` · `docs/requirements.md` 편집 금지** — 좌표 확인용 grep 인용까지만.
- **components.md 전면 anchor 좌표계 이행 실행 금지** — 파생 영향 (14) · (15) 소관이다.
- **다른 문서로의 cascade 금지** — [use-cases/INDEX.md](../use-cases/INDEX.md) · `UC-01` ~ `UC-09` · [INDEX.md](../architecture/INDEX.md) · [deployment.md](../architecture/deployment.md) · [directory.md](../architecture/directory.md) · [api.md](../architecture/api.md) · [README.md](../../README.md) 는 무편집.
- **빌드 · 테스트 · 설치 실행 금지** — `pnpm install` · `pnpm build` · `pnpm test` · `pnpm dev` 어느 것도 실행하지 않는다. 측정은 전부 read-only `grep` · `sed` · `awk` · `ls` · `wc` · `git` 이다.
- **CI drift-guard spec 작성 금지** — `pr` mode 소관이라 본 direct task 에서 진행하면 §3.1 위반.

## Suggested Sub-agents

`implementer` 단독 (doc-only, 코드 0 LOC — architect · tester 불요. §3.2 direct-mode 면제).

## Follow-ups

- 다음 slice 1 순위 = `## Contracts` 잔여 10 row 중 `Scheduler` 발신 **2** row (278 · 279 행) — 대응 edge 2 개 (76 · 77 행) 의 판정 입력 재사용으로 한계 비용 최저.
- `## Contracts` 각주 위치 관행 (`§ 12.61` 한계 6 미결) 은 본 slice AC 3 축 ④ 가 확정한다 — 확정 후 다음 slice 는 재고하지 않는다.
- 나머지 이월 항목 전량은 [REQ-COVERAGE-AUDIT.md](../use-cases/REQ-COVERAGE-AUDIT.md) `§ 12.62` 파생 영향 (1) ~ (29) 참조.
