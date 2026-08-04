---
id: T-1447
title: components.md `## Component table` **Backend API row (120 행) + Worker row (121 행)** 의 검증 가능 claim ↔ 실 `src/**` controller · service 인벤토리 · `ADR-0001` / `ADR-0003 §1` · REQ ID 대조 + T-1446 FU1 1 순위 계승 + audit §12.45
phase: P5
status: DONE
completedAt: 2026-08-04T09:45:00Z
commitMode: direct
coversReq: [REQ-026, REQ-038, REQ-044, REQ-049, REQ-043, REQ-005, REQ-006, REQ-007, REQ-015, REQ-031, REQ-032]
estimatedDiff: 230
estimatedFiles: 3
created: 2026-08-04
independentStream: uc-doc-audit-resync
dependsOn: [T-1446]
touchesFiles:
  - docs/architecture/components.md
  - docs/use-cases/REQ-COVERAGE-AUDIT.md
  - docs/tasks/T-1447-components-md-backend-api-worker-rows-vs-src-audit.md
plannerNote: "uc-doc-audit-resync 59 번째 slice — T-1446 FU1 1 순위 (Backend API + Worker, monolithic claim 공유) 2 row. doc-only 1.6x"
---

# T-1447 — components.md `## Component table` Backend API row + Worker row ↔ 실 `src/**` controller · service 인벤토리 · ADR · REQ 대조

## Why

[T-1446](T-1446-components-md-web-ui-row-vs-web-src-audit.md) 이 [components.md](../architecture/components.md) `## Component table` 의 **row 1 (`Web UI`)** 33 claim 을 판정하며 표 축에 진입했고 ([REQ-COVERAGE-AUDIT.md](../use-cases/REQ-COVERAGE-AUDIT.md) `§ 12.44`), 잔여 7 row 중 **다음 slice 1 순위로 `Backend API` + `Worker` 2 row 를 한 묶음** 으로 지목했다 (T-1446 FU1). 근거는 두 가지다 — ① 두 row 의 claim 은 실 `src/**` 의 controller · service 인벤토리와 1:1 대조가 가능해 검증 난이도가 낮고 (`§ 12.43` 이 이미 15 module class 목록을 실측해 둬 재사용 가능), ② 두 row 가 **`ADR-0003 §1` monolithic claim 을 공유** 해 (`Worker` 는 "Backend 와 동일 process 내 service layer" 라고 명시) 따로 판정하면 같은 축을 두 번 재는 낭비가 된다. 본 slice 는 그 1 순위를 그대로 집행한다.

2 row 를 한 slice 에 담는 것이 cap 을 깨지 않는지 planner 가 사전 훑기로 확인했다 — row 1 (`Web UI`) 은 컴포넌트 이름만 15 개라 33 claim 이었지만, `Backend API` (120 행) 는 책임 5 구 + REQ 5 개 + ADR 2 개, `Worker` (121 행) 는 책임 4 구 + REQ 6 개 + ADR 1 개 + phase pointer 1 개로 **합쳐도 row 1 과 같은 자릿수** 다. 다만 audit 절 분량은 선행 절 (`§ 12.44` = 105 행) 보다 커질 수 있으므로 본 task 는 **절 상한을 ≤ 130 행** 으로 두고 판정이 같은 claim 의 묶음을 허용한다 (하드 cap 인 300 LOC / 5 파일 은 여유 있게 지켜진다).

대조 축은 다섯이다. ① **Backend API 책임 축** ("NestJS controller + service layer" · "HTTP API entry point" · "Auth / RBAC / 인원 / Group / 평가 조회 endpoint 진입점" · "평가 trigger 시 Worker 호출" · "외부 시스템 호출은 직접 하지 않고 adapter 경유") ↔ 실 `src/**/*.controller.ts` 인벤토리, ② **Worker 책임 축** ("commit / 문서 / Confluence page 평가 파이프라인" · "난이도 · 기여도 · 양 · LLM 정성 평가문 생성" · "Backend 와 동일 process 내 service layer" · "Scheduler 또는 Backend API 가 trigger") ↔ 실 `src/assessment*` · `src/**/*.service.ts` 인벤토리, ③ **monolithic 공유 claim** ("동일 process") ↔ [ADR-0003](../decisions/ADR-0003-deployment-topology.md) §1 본문, ④ **pointer 축** (`ADR-0001` · `ADR-0003 §1` · "P5 Evaluation pipeline phase" 서술) 의 대상 실재, ⑤ **REQ ID 축** (REQ-026 / REQ-038 / REQ-044 / REQ-049 / REQ-043 / REQ-005~007 / REQ-015 / REQ-031 / REQ-032) 의 [requirements.md](../requirements.md) 실재 + 서술 부합.

planner 사전 확인 — **아래는 전부 가설이며 전제가 아니다** (T-1437 FU4 · T-1440 AC 1 · T-1441 가설 ④ · T-1442 가설 ⑧ · T-1443 가설 ② · T-1444 가설 ① · T-1445 가설 ① · T-1446 의 `AuthGate` 부분참 판정이 planner 기대를 실측으로 반증한 선례가 8 회 있다). executor 는 AC 1 에서 전부 재측정하고 **기대와 다르면 그 축의 편집을 중단** 한다. ① planner 훑기상 `src/**/*.controller.ts` 는 **19 개** 로 "Auth / RBAC / 인원 / Group / 평가 조회" 를 넘는 표면 (예: `AssessmentCollectionController` · `LlmProviderConfigController` · summary 계열) 이 이미 존재해, Backend API row 의 endpoint 열거는 **부분참 (열거가 실제보다 좁다)** 일 가능성이 있다. ② "평가 trigger 시 Worker 를 호출" 은 [modules.md](../architecture/modules.md) 의 `AssessmentCollectionModule` 서술상 manual trigger controller → orchestration service 경로가 실재하나, 문서가 말하는 "Worker" 가 어느 실 class 인지 **1:1 대응 class 가 없을** 수 있어 (논리적 책임 분리라고 row 자신이 밝힘) `검증 불가` 로 분류될 여지가 있다. ③ Worker row 의 "난이도 · 기여도 · 양 · LLM 정성 평가문 생성" 4 요소는 P5 진행 중이라 **일부만 shipped** 일 가능성이 높다 — 4 요소를 **하나씩 분리 판정** 해야 한다. ④ "외부 시스템 호출은 adapter 경유" 는 adapter module 이 실재하므로 **참** 쪽이나, controller / service 가 직접 `fetch` 를 호출하는 지점이 없는지 grep 1 회로 근사 확인한다 (전수 증명은 §7 예산 밖 — 근사임을 명시).

**행 좌표 주의** — components.md 는 T-1446 각주 6 행 추가로 **202** 행이고, `## Component table` 은 **115** 행, `Backend API` row 는 **120** 행, `Worker` row 는 **121** 행, T-1446 각주 blockquote 는 **128 ~ 133** 행, `## GitHub Adapter …` heading 은 **134** 행이다. AC 1 (i) 에서 재실측한다.

[PLAN.md](../PLAN.md) 의 미완 bullet (106 · 108 · 109 · 140 · 151) 은 owner 게이트 · 외부 credential · 새 dependency 게이트라 planner 단독 진행 불가이므로, 본 doc stream 이 현 시점 우선순위 최상위다.

## Required Reading

- `docs/architecture/components.md` — **202 행**. 다음 구간만 읽는다.
  - **115 ~ 121 행** (`## Component table` heading + 표 header 2 행 + `Web UI` row + **`Backend API` row** + **`Worker` row**) — **120 · 121 행이 본 slice 의 주 판정 대상**, 119 행은 경계 확인만.
  - **122 ~ 126 행** (나머지 5 row) — **무편집, 경계 확인만**. 판정하지 않는다.
  - **128 ~ 133 행** (T-1446 각주 blockquote) — **무편집, 화법 · 배치 template 확인용**. 본 slice 각주는 이 blockquote **직후** 에 붙는다.
  - **1 ~ 4 행** (문서 성격 선언 blockquote — "본 문서는 P1 T-A3 의 산출물") — **무편집**, 판정의 최강 제약. 인용만 한다.
  - **그 밖 전 구간** — **무편집, heading 좌표 확인만**.
- `docs/use-cases/REQ-COVERAGE-AUDIT.md` — **4498 행**. **`### 12.15`** (시점 기록 append-only 처리 방침 정본) · **`### 12.44`** (**4379** 행 — T-1446 판정표 화법 template + FU1 원문) · **`## 11. References` (4485 행)** — `§ 12.45` 삽입 위치 경계. **그 밖의 절은 열지 않는다** (§7).
- `docs/architecture/modules.md` — **무편집, 읽기만**. `§ 12.43` 이 실측해 둔 **module class 목록** 과 `AssessmentCollectionModule` 서술을 **grep 인용 1 ~ 3 구만** 재사용한다 (259 행 통독 금지).
- `docs/decisions/ADR-0003-deployment-topology.md` — **무편집, 읽기만**. **§1 monolithic 서술 1 ~ 2 구 + status 1 줄** 확인까지만. 본문 재판정 · status 변경 금지.
- `docs/decisions/ADR-0001-*.md` — **무편집, 읽기만**. **파일 실재 + status 1 줄** 확인까지만.
- `docs/requirements.md` — **무편집, 읽기만**. 위 11 개 REQ ID 의 **실재 + 제목 1 구** 확인용 `grep` 만. 본문 재판정 금지.
- `docs/PLAN.md` — **무편집, 읽기만**. "P5 Evaluation pipeline phase" pointer 실재 판정 입력 `grep` 1 회.
- `CLAUDE.md` §3 (task 크기 상한) · §3.2 (direct doc-only 면제) · §12 (언어 정책)

## Acceptance Criteria

- [ ] **AC 1 — 실측 선행 (날조 금지)**: 편집 전에 다음을 직접 측정해 `§ 12.45` 에 **명령과 출력을 함께** 인용한다. 기대값과 **다르면 그 축의 편집을 중단** 하고 불성립 사실을 `§ 12.45` 에 기록한다 (Why 의 ① ~ ④ 는 가설일 뿐이다).
  - (i) **좌표 + 원문 재확인**: `grep -n '^#\{1,3\} ' docs/architecture/components.md` 로 heading 좌표를 **먼저 실측** 한 뒤 (본 AC 의 `115` · `120` · `121` · `134` 도 stale 일 수 있다 — T-1436 ~ T-1446 선례) 두 row 를 `sed -n '120,121p'` 로 인용한다. 이어 **실측으로 참 · 거짓을 가릴 수 있는 claim** (책임 구 · 실 class / endpoint 존재 · REQ ID · ADR ID · phase pointer) 만 뽑아 **row 별로 분리해** 열거하고, 순수 성격 서술 (`논리적 책임으로 분리` 등) 은 **검증 불가 claim** 으로 분류해 판정 대상에서 제외한다. 이 이분 자체를 남긴다.
  - (ii) **Backend API 책임 축**: `ls -1 src/**/*.controller.ts 2>/dev/null | grep -v '\.spec\.' | wc -l` 과 `grep -rhn '^export class .*Controller' src --include=*.controller.ts | sed 's/.*class //;s/ .*//' | sort -u` (또는 동등 명령) 로 실 controller 인벤토리를 인용한 뒤, row 가 열거한 **"Auth / RBAC / 인원 / Group / 평가 조회" 5 표면 각각** 을 `실재 / 이름 상이 / 부재` 로 판정하고, **문서가 열거하지 않은 초과 controller** 의 개수 (+ 대표 이름 2 ~ 3 개) 를 인용해 열거의 **포괄성** 을 `참 / 부분참 / 거짓` 으로 판정한다. "외부 시스템 호출은 adapter 경유" 는 `grep -rln 'globalThis\.fetch\|await fetch(' src --include=*.ts | head -10` 로 **fetch 직접 호출 파일이 adapter / gateway 계열에 한정되는지** 근사 확인하고 **근사치임을 명시** 한다.
  - (iii) **Worker 책임 축**: `grep -rhn '^export class .*Service' src --include=*.service.ts | sed 's/.*class //;s/ .*//' | sort -u | wc -l` 로 service 총수를, `ls -1 src/assessment* -d 2>/dev/null` · `grep -rln 'difficulty\|contribution\|quantity' src --include=*.service.ts | head -8` 등으로 **"난이도 · 기여도 · 양 · LLM 정성 평가문" 4 요소 각각** 의 shipped 여부를 판정한다. "Scheduler 또는 Backend API 가 trigger" 는 `grep -rn '@Cron\|collect' src --include=*.controller.ts | head -5` 로 manual trigger 진입점 실재를 인용해 판정한다. **문서가 말하는 "Worker" 에 1:1 대응하는 실 class 가 없으면 그 사실 자체를 판정 결과로 적는다** (없다는 것도 실측 결과다 — 억지 대응 금지).
  - (iv) **monolithic 공유 claim + pointer 축**: `ls -1 docs/decisions/ADR-0001-*.md docs/decisions/ADR-0003-*.md 2>/dev/null || echo "none"` · `grep -n '^status:\|^## Status' docs/decisions/ADR-0001-*.md docs/decisions/ADR-0003-*.md | head -4` · `grep -n '동일 process\|monolith' docs/decisions/ADR-0003-deployment-topology.md | head -4` · `grep -n 'Evaluation pipeline\|P5' docs/PLAN.md | head -4` 로 각 pointer 대상의 실재를 인용해 `참 / 부분참 / 거짓` 판정한다. **`ADR-0003 §1` 이 실제로 monolithic 을 다루는 절 번호인지** (§ 번호 drift) 까지 본다.
  - (v) **REQ ID 축**: `grep -n 'REQ-005\|REQ-006\|REQ-007\|REQ-015\|REQ-026\|REQ-031\|REQ-032\|REQ-038\|REQ-043\|REQ-044\|REQ-049' docs/requirements.md | head -20` 으로 **11 개 REQ ID 의 실재** 를 인용하고, row 가 괄호로 병기한 **설명 문구 (예: `REQ-043 (ID/Password 보호)` · `REQ-032 (raw 저장 금지)`) 가 실 requirements 제목과 부합** 하는지 판정한다. 판정이 동일한 ID 는 묶어도 된다.
  - (vi) baseline — `wc -l` components.md **202** · audit **4498** · deployment.md **232** · directory.md **203** · modules.md **259** · PLAN.md **175**, `grep -c '^## '` components.md **7** · audit **12**, audit `grep -c '^| REQ-'` **66** · `grep -c '^### 12\.'` **44**.
- [ ] **AC 2 — 지점 판정표**: AC 1 이 뽑은 **검증 가능 claim** 각각에 대해 `in-place 수정` / `원문 보존 + 각주 부기` / `무편집` / `상위 slice 판정 승계` 중 하나를 판정한 표를 만든다. 각 row 는 **claim 1 구 · 실측 결과 · 판정 (참 / 부분참 / 거짓) · 처리 · 근거 1 구** 5 컬럼이며, **`Backend API` / `Worker` 소속을 컬럼 또는 소제목으로 구분** 한다.
  - **REQ ID 11 개는 판정이 같으면 1 row 로 묶고 ID 를 전부 나열** 해도 무방하다 (cap 보호 — 묶을 경우 묶음 근거 1 구). **책임 구 · pointer · monolithic claim 은 묶음 금지**.
  - 판정 기준 **3 축** 명시 — ① **문서 성격** (1 ~ 4 행 blockquote 의 P1 T-A3 blueprint 선언 + 이 표가 이미 여러 차례 shipped 현황으로 갱신된 흔적), ② `§ 12.15` **정합** (두 row 에 시점 marker 가 있는지 실측 grep 근거), ③ **선례** (T-1430 ~ T-1446 의 "원문 보존 + 실측 각주" vs [T-1429](T-1429-api-md-module-vocab-and-uc-range-resync.md) 의 in-place 1:1 치환 vs [T-1436](T-1436-directory-md-web-frontend-section-vs-src-audit.md) 의 혼합 채택).
- [ ] **AC 3 — 처리 방식 판정**: 후보 4 개 중 **채택 1 · 기각 3** 인 판정표를 만든다. 기각마다 근거 1 구.
  - 후보 — (A) 두 row 셀 **in-place 동기** (낡은 열거 · 거짓 pointer 치환), (B) **원문 무편집 + T-1446 각주 blockquote 직후에 각주 blockquote 1 개 신설** (T-1437 ~ T-1446 화법 승계), (C) **혼합** (거짓 판정 지점만 in-place, 나머지는 각주), (D) **전 지점 무편집 + audit 기록만**.
  - 판정 기준 **4 축** 명시 — ① `§ 12.15` 정합, ② **오도 risk** (독자가 이 표만 읽고 backend 표면을 실제보다 좁게 오인하거나 미구현 평가 요소를 shipped 로 오인할 때의 비용), ③ **cap** — 예상 diff ≤ 300 LOC · 변경 파일 **3 고정** (초과 후보는 자동 기각 + split 제안 기록), ④ **각주 누적 구조 제약** — `§ 12.44` 한계 3 이 지적한 대로 표 뒤 blockquote 가 누적되므로, 본 slice 는 **2 번째 블록** 이며 첫 구에 **"본 각주는 `Backend API` · `Worker` 2 row 한정"** 을 반드시 명시해야 한다는 점 (5 ~ 6 블록 시점의 배치 규약 재검토는 본 slice 범위 밖 — 파생 영향에만 기록).
- [ ] **AC 4 — 채택안 반영**: AC 3 채택안대로만 편집한다. 각 지점은 AC 2 판정 결과를 따른다.
  - **각주 blockquote 는 T-1446 각주 blockquote 마지막 행 (현 133 행) 과 `## GitHub Adapter — 3 instance 묶음 vs 분리 결정` heading (현 134 행) 사이에 삽입** 한다. **각주 blockquote 1 개 (≤ 8 행) + in-place 치환 (≤ 2 지점) 이내**, `wc -l` 증가 **+9 이내** (202 → ≤ 211).
  - **각주 첫 구에 "본 각주는 `Backend API` · `Worker` row 한정" 을 명시** 한다 — 잔여 5 row 는 미판정임을 독자가 즉시 알 수 있어야 한다.
  - **문구 · class 이름 · 수치 · ADR ID · REQ ID · task ID 는 AC 1 실측 출력과 1:1 일치** 해야 하며, 실측되지 않은 값 (존재하지 않는 class, 임의 카운트, 없는 절 번호) 을 **새로 창작하지 않는다**.
  - **1 ~ 4 행 blockquote · 119 행 `Web UI` row · 128 ~ 133 행 T-1446 각주 · 잔여 5 row · 134 행 이후 전 구간 무편집**.
  - **새 pointer 추가 금지** — 본문 · modules.md · 두 ADR · requirements.md · PLAN.md 외의 문서를 새로 등재하지 않는다 (audit 쪽에만 기록).
  - **secret · connection string · 실 호스트명 · 실 PAT 를 문서에 옮겨 적지 않는다** (CLAUDE.md §9).
- [ ] **AC 5 — audit `§ 12.45` 신설**: [REQ-COVERAGE-AUDIT.md](../use-cases/REQ-COVERAGE-AUDIT.md) 의 `## 11. References` (4485 행) **직전** 에 `### 12.45 …` 절을 **순수 append** 한다 (기존 절 수정 0). 구성 — 본 절의 위치 · 계보 1 문단 (**T-1446 FU1 1 순위 closure + 2 row 를 한 slice 로 묶은 근거**) / AC 1 실측 (명령 + 출력) / AC 2 지점 판정표 / AC 3 처리 판정표 / AC 4 반영 결과 + 무편집 경계 / **Component table 잔여 미판정 row 목록** (`DB Persistence` · `LLM Gateway` · `GitHub Adapter` · `Confluence Adapter` · `Scheduler` **5 row** — 다음 slice 1 순위 + 선정 근거 1 구) / 파생 영향 (목록만) / 불변 검산 / 한계. **절 전체 ≤ 130 행** (2 row 분량 반영 — 초과 시 실측 인용을 요약형으로 압축하고 압축 사실을 한계에 명시).
  - `###` 레벨이라 `grep -c '^## '` **12 불변** · `grep -c '^| REQ-'` **66 불변** · `grep -c '^### 12\.'` **44 → 45**.
- [ ] **AC 6 — 불변 검산**: 다음을 실행해 출력을 `§ 12.45` 에 인용한다. `wc -l` components.md (202 → ≤ 211) · audit (4498 → +130 이내) · deployment.md (**232 불변**) · directory.md (**203 불변**) · modules.md (**259 불변**) · PLAN.md (**175 불변**) · requirements.md (**불변**), `git diff -U0 -- docs/architecture/components.md | grep '^@@'` 로 **hunk 개수 · 위치** 를 보이고 AC 4 허용 구간 밖 hunk **0** 을 실증, `git diff --numstat` 으로 **순수 삭제 0** (삭제 행이 있으면 in-place 치환의 짝임을 1 구로 설명), `git status --porcelain src/ test/ web/ prisma/ deploy/ docker-compose.yml Dockerfile .github/ package.json README.md .claude/ docs/decisions/ docs/ops/ docs/PLAN.md docs/requirements.md` **빈 출력** (코드 · frontend · 배포자산 · CI · 의존성 · ADR · PLAN · requirements 무변경), `git status --porcelain` 이 **3 파일 이내** 임을 확인.
- [ ] **AC 7 — 파생 영향 기록 (목록만, 본 slice 편집 금지)**: `§ 12.45` 말미에 후속 slice 대상을 목록으로 남긴다. 최소 포함 — (1) **Component table 잔여 5 row** + 다음 slice 1 순위 (claim 밀도 · 실 코드 대조 난이도 근거 1 구), (2) **표 뒤 각주 blockquote 누적 배치 규약 재검토** (`§ 12.44` 한계 3 — 본 slice 로 2 블록째), (3) `## Deployment 컨텍스트` (22 ~ 26 행 — "모든 8 component 는 동일 process" claim, T-1445 FU1 차순위로 2 회째 이월), (4) `## Component diagram` mermaid node ↔ 실 module 대조, (5) `@nestjs/config` 미도입 전수 sweep (`§ 12.39` FU3 미소진, ADR 게이트), (6) reviewer 규약 미이행 (`.claude/agents/reviewer.md` REQ-032 0 hit — `§ 12.41` FU2 미소진), (7) `deploy/README.md` ↔ deployment.md ↔ runbook 3 자 정합 (`§ 12.41` FU3 미소진), (8) README 행 번호 pointer drift 전수 sweep, (9) REQ 번호 체계 잔재 전수 sweep (`§ 12.38` FU3 미소진), (10) `CLAUDE.md` §1 pointer 부정확 (T-1442 FU3 미소진), (11) UC-09 `§ 5` sequence participant 병기 (30 회째 이월), (12) 정본 [modules.md](../architecture/modules.md) 카운트 claim 대조 (`§ 12.34` FU1 미소진, ADR 게이트), (13) 행 번호 → anchor 좌표계 이행 (24 회째), (14) `§ 12.44` 미해결 한계 — "mutation 러너 26 개" 정의 미확정 (`pr` mode drift-guard spec 소관).
- [ ] **AC 8 — R-110 / R-112 면제 근거 명시**: 본 task 는 `commitMode: direct` doc-only 로 production code **0 LOC** · 분기 **0** 이라 [CLAUDE.md](../../CLAUDE.md) §3.2 direct-mode 면제 조항에 따라 tester 호출 · happy / error / flow / negative 4 항목 · `pnpm test:cov` 가 **N/A** 임을 `§ 12.45` 에 1 구로 명시한다.
- [ ] **AC 9 — 언어 · 링크 규약**: 추가 문장은 모두 한국어 (§12), 문서 간 참조는 상대경로 markdown 링크, 수치는 실측 출력과 1:1 일치.

## Out of Scope

- **코드 · frontend · 스키마 · 배포 자산 · CI · agent 정의 변경 절대 금지** — `src/` · `web/` · `test/` · `prisma/` · `scripts/` · `deploy/` · `docker-compose.yml` · `Dockerfile` · `.github/workflows/` · `package.json` · `.claude/agents/` 는 diff 에 등장하면 안 된다. **controller / service rename · 파일 추가로 문서를 맞추는 행위 금지** (문서를 실제에 맞출 뿐, 실제를 문서에 맞추지 않는다).
- **Component table 잔여 5 row 판정 · 편집 금지** — `DB Persistence` · `LLM Gateway` · `GitHub Adapter` · `Confluence Adapter` · `Scheduler` 는 후속 slice 소관이며 본 slice 에서 손대면 cap 이 즉시 깨진다.
- **`Web UI` row (119 행) 재판정 금지** — `§ 12.44` 가 이미 닫았다. 필요 시 판정 승계 인용까지만.
- **components.md 134 행 이후 전 구간 편집 금지** — `## GitHub Adapter …` · `## Contracts` 표 · `## References` · mermaid diagram 무편집.
- **1 ~ 4 행 blockquote · 128 ~ 133 행 T-1446 각주 편집 금지** — 인용 · 화법 참조까지만.
- **`docs/PLAN.md` · `docs/requirements.md` 편집 금지** — pointer 실재 확인용 grep 인용까지만. 체크박스 · REQ 본문 변경은 별도 소관.
- **ADR-0001 · ADR-0003 본문 재판정 · status 변경 금지** — 파일 실재 + status 1 줄 + §1 서술 인용까지만.
- **[modules.md](../architecture/modules.md) · [INDEX.md](../architecture/INDEX.md) · [deployment.md](../architecture/deployment.md) · [directory.md](../architecture/directory.md) 편집 금지** — 정합 판정 필요 사실은 파생 영향 목록에만 남긴다 (**modules.md 259 행 · deployment.md 232 행 · directory.md 203 행 불변**).
- **빌드 · 테스트 · 설치 실행 금지** — `pnpm install` · `pnpm build` · `pnpm test` 어느 것도 실행하지 않는다 (측정은 전부 read-only grep / ls / sed / wc / git).
- **다른 문서로의 cascade 금지** — [use-cases/INDEX.md](../use-cases/INDEX.md) · `UC-01` ~ `UC-09` · ADR · [README.md](../../README.md) 는 무편집.
- **각주 배치 규약 자체의 재설계 금지** — `§ 12.44` 한계 3 이 제기한 "표 뒤 나열 vs row 별 anchor" 재검토는 파생 영향 목록에만 남긴다.
- **행 번호 → anchor 좌표계 이행 금지** — 파생 영향 목록에만 남긴다 (24 회째 이월).
- **CI drift-guard spec 작성 금지** — `pr` mode 소관이라 본 direct task 에서 진행하면 §3.1 위반.
- **audit 기존 절 (`§ 12.1` ~ `§ 12.44`) 수정 금지** — `§ 12.45` 순수 append 만.

## Suggested Sub-agents

`implementer` 단독 (doc-only, 코드 0 LOC — architect · tester 불요. §3.2 direct-mode 면제).

## Follow-ups

(생성 시점 비어 있음 — sub-agent 가 관련 작업을 발견하면 여기에 append 한다.)
