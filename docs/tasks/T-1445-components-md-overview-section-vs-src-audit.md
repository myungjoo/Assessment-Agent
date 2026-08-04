---
id: T-1445
title: components.md `## 개요` (5 ~ 14 행) 의 검증 가능 claim ↔ 실 `src/**/*.module.ts` 인벤토리 · `package.json` dependency · `docs/architecture/INDEX.md` · `ADR-0003` · 현 phase 대조 + T-1444 Follow-up 1 계승 (components.md 축 진입) + audit §12.43
phase: P5
status: PENDING
commitMode: direct
coversReq: [REQ-004, REQ-030]
estimatedDiff: 200
estimatedFiles: 3
created: 2026-08-04
independentStream: uc-doc-audit-resync
dependsOn: [T-1444]
touchesFiles:
  - docs/architecture/components.md
  - docs/use-cases/REQ-COVERAGE-AUDIT.md
  - docs/tasks/T-1445-components-md-overview-section-vs-src-audit.md
plannerNote: "uc-doc-audit-resync 57 번째 slice — T-1444 FU1 (components.md 축 진입) 계승. 문서 앞머리 `## 개요` 부터 top-down, doc-only 1.6x"
---

# T-1445 — components.md `## 개요` ↔ 실 module 인벤토리 · dependency · 참조 문서 대조 (components.md 축 진입)

## Why

[T-1444](T-1444-deployment-md-overview-section-vs-repo-audit.md) 가 [deployment.md](../architecture/deployment.md) `## 개요` 를 닫으면서 그 문서 **6 단락 전부의 대조가 완결** 됐고 ([REQ-COVERAGE-AUDIT.md](../use-cases/REQ-COVERAGE-AUDIT.md) `§ 12.42`), 다음 문서 축 1 순위로 [components.md](../architecture/components.md) 를 지목했다 (T-1444 Follow-up 1). 근거는 components.md 3 행 blockquote 가 스스로 밝히듯 본 문서가 **P1 T-A3 시점의 blueprint 원본** 이라 "구현 이전 서술 ↔ shipped 코드" drift 표면을 그대로 갖고 있다는 점이다. 본 slice 는 그 축의 **첫 slice** 로, 문서 앞머리 `## 개요` 부터 top-down 으로 진입한다.

대상은 `## 개요` (heading **5** · 본문 **7 · 9 · 11 ~ 14**) 이며 대조 축은 넷이다. ① **운영 토폴로지 5 요소 열거** (7 행 — "단일 NestJS process / PostgreSQL / @nestjs/config / @nestjs/schedule / direct egress") ↔ 실 `package.json` dependency + [ADR-0003](../decisions/ADR-0003-deployment.md), ② **NestJS module class 8 명 열거** (11 행 — `AssessmentModule` / `UserModule` / `GithubModule` / `ConfluenceModule` / `LlmModule` / `AuthModule` / `SchedulerModule` / `WebModule`) ↔ 실 `src/**/*.module.ts` 인벤토리, ③ **pointer 축** ([deployment.md](../architecture/deployment.md) · [INDEX.md](../architecture/INDEX.md) `MVA 원칙` · ADR-0003 · [modules.md](../architecture/modules.md)) 의 실재 여부, ④ **시점 축** (11 ~ 14 행의 "다음 task 들의 책임" 미래형 화법 — T-A4 / P2 / P3 / P4 가 전부 완료된 현 시점 phase 와의 정합).

planner 사전 확인 — **아래는 전부 가설이며 전제가 아니다** (T-1437 Follow-up 4 · T-1440 AC 1 · T-1441 가설 ④ · T-1442 가설 ⑧ · T-1443 가설 ② · T-1444 가설 ① 이 planner 기대를 실측으로 반증한 선례가 6 회 있다). executor 는 AC 1 에서 전부 재측정하고, **기대와 다르면 그 축의 편집을 중단** 한다. ① planner grep 상 `grep -n "@nestjs/config" package.json` 이 **0 hit** 이라 7 행의 `@nestjs/config` 는 **거짓** 쪽 (반면 `@nestjs/schedule` 은 31 행에 실재해 **참** 쪽) — 즉 5 요소를 **요소별로 분리 판정** 해야 한다. ② planner 실측상 `src/**/*.module.ts` 는 15 개이고 그 이름이 문서의 8 명과 상당수 어긋난다 (`AssessmentModule` 대신 `assessment-collection` · `assessment-evaluation` 2 개, `SchedulerModule` 대신 `scheduling`, 문서에 없는 `PersistenceModule` · `ExportModule` · `ImportModule` · `PermissionDeniedRecordModule` · `UserInstanceAccessModule` 등) — **8 명 각각을 개별 row 로** 판정해야 하며 파일명이 아니라 **class 이름** 으로 대조해야 한다. ③ `INDEX.md` `MVA 원칙` pointer 는 **참** 쪽 (`§ 12.42` 가 54 행 `## MVA 원칙` 실재를 이미 인용). ④ 11 ~ 14 행의 "다음 task 들의 책임" 은 T-A4 · P2 · P3 · P4 가 모두 지난 시점이라 **낡은 미래형 화법** 일 가능성이 높으나, `§ 12.15` append-only 방침상 시점 marker 는 **보존 + 각주** 가 기본이다. ⑤ 9 행의 "구체 module class / 메서드 시그니처 / endpoint URL / DB schema 컬럼은 본 문서의 범위 밖" 은 **자기규정** 이라 검증 불가 claim 으로 분류될 가능성이 크지만, 11 행이 module class 이름 8 개를 실제로 열거한다는 **자체 긴장** 을 각주에서 1 구로 다룰 가치가 있다.

**행 좌표 주의** — components.md 는 현재 **190** 행이고 본 slice 범위는 문서 앞머리라 밀림이 없어야 하나, AC 1 (i) 에서 재실측한다.

[PLAN.md](../PLAN.md) 의 미완 bullet (106 · 108 · 109 · 140 · 151) 은 owner 게이트 · 외부 credential · 새 dependency 게이트라 planner 단독 진행 불가이므로, 본 doc stream 이 현 시점 우선순위 최상위다.

## Required Reading

- `docs/architecture/components.md` — **190 행**. 다음 구간만 읽는다.
  - **5 ~ 14 행** (`## 개요` heading + 본문 3 문단 + 하위 4 bullet) — 본 slice 의 **주 편집 후보 구간**.
  - **1 ~ 4 행** (문서 성격 선언 blockquote — "본 문서는 P1 T-A3 의 산출물") — **무편집**, 판정의 최강 제약. 인용만 한다.
  - **16 ~ 21 행** (`## Deployment 컨텍스트`) — **무편집, 경계 확인 + 다음 slice 후보 확인용** 으로만 읽는다.
  - **22 행 이후** (`## Component diagram` · `## Component table` · `## GitHub Adapter …` · `## Contracts` · `## References`) — **무편집, heading 좌표 확인만**.
- `docs/use-cases/REQ-COVERAGE-AUDIT.md` — **4283 행**. **`### 12.15`** (**1002** 행 — 시점 기록 append-only 처리 방침 정본) · **`### 12.42`** (**4165** 행 — T-1444 판정표 화법 template + Follow-up 원문) · **`## 11. References` (4270 행)** — `§ 12.43` 삽입 위치 경계. **그 밖의 절은 열지 않는다** (§7).
- `docs/architecture/modules.md` — **무편집, 읽기만**. 11 행의 "T-A4 (modules.md)" pointer + "의존성 acyclic 검증" claim 판정 입력. **heading grep + 해당 서술 1 ~ 2 구 인용만** (259 행 전문 통독 금지).
- `docs/architecture/INDEX.md` — **무편집, 읽기만**. `MVA 원칙` 절 실재 판정 입력. **heading grep 인용만**.
- `docs/decisions/ADR-0003-deployment.md` — **무편집, 읽기만**. 7 행 "운영 토폴로지" 5 요소 귀속 판정 입력. **`### Decision §` heading 목록만**. 본문 재판정 · status 변경 금지.
- `package.json` — **무편집, 읽기만**. `@nestjs/config` · `@nestjs/schedule` dependency 실재 판정 입력. **grep 인용만**.
- `docs/PLAN.md` — **무편집, 읽기만**. `## Phase P2` ~ `## Phase P4` heading 과 진행 표기만 확인 (시점 축 판정 입력). 본문 재판정 금지.
- `CLAUDE.md` §3 (task 크기 상한) · §3.2 (direct doc-only 면제) · §12 (언어 정책)

## Acceptance Criteria

- [ ] **AC 1 — 실측 선행 (날조 금지)**: 편집 전에 다음을 직접 측정해 `§ 12.43` 에 **명령과 출력을 함께** 인용한다. 기대값과 **다르면 그 축의 편집을 중단** 하고 불성립 사실을 `§ 12.43` 에 기록한다 (Why 의 ① ~ ⑤ 는 가설일 뿐이다).
  - (i) **단락 원문 + 좌표 재확인**: `grep -n '^#\{1,3\} ' docs/architecture/components.md` 로 heading 좌표를 **먼저 실측** 한 뒤 (본 AC 의 `5 ~ 14 행` 도 stale 일 수 있다 — T-1436 ~ T-1444 선례) 해당 범위를 `sed -n` 으로 인용한다. 이어 **실측으로 참·거짓을 가릴 수 있는 claim** (dependency 이름 · module class 이름 · 문서 pointer · 절 이름 · phase 표기) 만 뽑아 열거하고, 순수 범위 선언 · 자기규정 (`본 문서의 범위 밖` 등) 은 **검증 불가 claim** 으로 분류해 판정 대상에서 제외한다. 이 이분 자체를 남긴다.
  - (ii) **운영 토폴로지 5 요소 축 (7 행)**: `grep -n '"@nestjs/config"\|"@nestjs/schedule"' package.json || echo "none"` · `grep -n '^### Decision §' docs/decisions/ADR-0003-deployment.md` 로 dependency 실재와 ADR 결정 목록을 인용해, "단일 NestJS process / PostgreSQL / @nestjs/config / @nestjs/schedule / direct egress" **5 요소를 각각** `참 / 부분참 / 거짓` 으로 분리 판정한다. **문서가 ADR 에 귀속시킨 것과 ADR 이 실제로 결정한 것이 다를 수 있음** 을 축으로 두고, dependency 부재 요소는 "ADR 이 결정했으나 미도입" 인지 "문서만의 창작" 인지 1 구로 구분한다.
  - (iii) **module class 8 명 축 (11 행)**: `ls -1 src/*.module.ts src/*/*.module.ts` 로 실 module 파일을, `grep -rhn '^export class .*Module' src --include=*.module.ts | sed 's/.*export class //' | sort` 로 **실 class 이름** 을 인용한 뒤, 문서가 열거한 8 명 (`AssessmentModule` / `UserModule` / `GithubModule` / `ConfluenceModule` / `LlmModule` / `AuthModule` / `SchedulerModule` / `WebModule`) **각각** 을 `실재 / 이름 상이 / 부재` 로 판정한다. 파일명이 아니라 **class 이름 기준** 이며, 문서에 없는 실 module (초과분) 도 개수와 이름을 함께 인용한다. 이어 "의존성 acyclic 검증" claim 이 [modules.md](../architecture/modules.md) 에서 실제로 수행됐는지 `grep -n "acyclic\|순환" docs/architecture/modules.md | head -5` 로 확인한다.
  - (iv) **pointer 축 (7 · 9 · 11 행)**: `ls -1 docs/architecture/deployment.md docs/architecture/modules.md docs/architecture/INDEX.md` · `grep -n "MVA" docs/architecture/INDEX.md | head -4` · `ls -1 docs/tasks/T-0016-*.md docs/tasks/T-0017-*.md 2>/dev/null || echo "none"` 로 각 pointer 의 대상 실재를 인용해 `참 / 부분참 / 거짓` 판정한다. T-A4 가 어느 task ID 인지 문서가 명시하지 않는 점도 판정 대상 (**pointer 불완전** 여부).
  - (v) **시점 축 (11 ~ 14 행)**: `grep -n "^## Phase P" docs/PLAN.md` + `PYTHONIOENCODING=utf-8 python -c "import json,io;print(json.load(io.open('docs/STATE.json',encoding='utf-8'))['phase'])"` 로 P2 ~ P4 진행 표기와 현 phase 를 대조해, "다음 task 들의 책임" 4 bullet (T-A4 / P2 / P3 / P4) 이 **낡음 / 여전히 유효 / bullet 별로 갈림** 중 무엇인지 판정한다. `§ 12.15` 의 시점 marker 취급 방침을 근거로 인용한다.
  - (vi) **자기규정 축 (9 행)**: "구체 NestJS module class / service 메서드 시그니처 / API endpoint URL / DB schema 컬럼은 본 문서의 범위 밖" 을 검증 불가 claim 으로 두되, **같은 절 11 행이 module class 이름 8 개를 실제로 열거** 하는 자체 긴장을 1 구로 논증한다. 새로 재측정하지 말고 (iii) 결과를 인용만 한다 (§7).
  - (vii) baseline — `wc -l` components.md **190** · audit **4283** · deployment.md **232** · directory.md **203** · modules.md **259**, `grep -c '^## '` components.md **7** · audit **12**, audit `grep -c '^| REQ-'` **66** · `grep -c '^### 12\.'` **42**.
- [ ] **AC 2 — 지점 판정표**: AC 1 이 뽑은 **검증 가능 claim** 각각에 대해 `in-place 수정` / `원문 보존 + 각주 부기` / `무편집` / `상위 slice 판정 승계` 중 하나를 판정한 표를 만든다. 각 row 는 **지점 (행) · claim 1 구 · 실측 결과 · 판정 (참 / 부분참 / 거짓) · 처리 · 근거 1 구** 6 컬럼. module class 8 명은 **8 row 로 분리** 한다 (묶음 판정 금지).
  - 판정 기준 **3 축** 명시 — ① **문서 성격** (1 ~ 4 행 blockquote 의 P1 T-A3 blueprint 선언에 `§ 12.15` append-only 제약이 어느 강도로 걸리는가), ② `§ 12.15` **정합** (본 단락에 시점 marker 가 있는지 실측 grep 으로 근거를 둔다 — 11 ~ 14 행 "다음 task 들의 책임" 이 그 marker 후보다), ③ **선례** (T-1430 ~ T-1435 · T-1437 ~ T-1444 의 "원문 보존 + 실측 각주" vs [T-1429](T-1429-api-md-module-vocab-and-uc-range-resync.md) 의 in-place 1:1 치환 vs [T-1436](T-1436-directory-md-web-frontend-section-vs-src-audit.md) 의 혼합 채택).
  - **시점 축 (11 ~ 14 행 미래형 화법) 과 사실 축 (dependency · module class 이름 · pointer) 의 처리를 분리 판정** 한다 — 두 축의 처리가 갈려도 무방하나 그 이유를 각각 1 구로 적는다.
- [ ] **AC 3 — 처리 방식 판정**: 후보 4 개 중 **채택 1 · 기각 3** 인 판정표를 만든다. 기각마다 근거 1 구.
  - 후보 — (A) **전 지점 in-place 동기** (module class 8 명을 실 이름으로 치환 + `@nestjs/config` 삭제), (B) **원문 무편집 + `## 개요` 말미 각주 blockquote 1 개 신설** (T-1437 ~ T-1444 화법 승계), (C) **혼합** (거짓 판정 요소만 in-place, 시점 축은 각주), (D) **전 지점 무편집 + audit 기록만**.
  - 판정 기준 **4 축** 명시 — ① `§ 12.15` 정합, ② **오도 risk** (독자가 본 절만 읽고 "shipped module 은 이 8 개다" 또는 "`@nestjs/config` 가 도입돼 있다" 고 오인할 때의 비용 — 문서 앞머리라 노출도가 가장 높다는 점을 논거로 쓴다), ③ **cap** — 예상 diff ≤ 300 LOC · 변경 파일 **3 고정** (초과 후보는 자동 기각 + split 제안 기록), ④ 선례 일관성 (**components.md 축의 첫 slice 라 이후 slice 의 template 이 된다** 는 점을 1 구로 명시).
- [ ] **AC 4 — 채택안 반영**: AC 3 채택안대로만 편집한다. 각 지점은 AC 2 판정 결과를 따른다.
  - **각주 blockquote 는 `## 개요` 본문 말미 (현 14 행) 와 `## Deployment 컨텍스트` heading (현 16 행) 사이에 삽입** 한다 — T-1442 ~ T-1444 가 단락 말미에 각주를 둔 배치와 동형. **각주 blockquote 1 개 (≤ 7 행) + in-place 치환 (≤ 2 지점) 이내**, `wc -l` 증가 **+8 이내** (190 → ≤ 198).
  - **문구 · module class 이름 · dependency 이름 · 절 이름 · 수치 · phase 표기는 AC 1 실측 출력과 1:1 일치** 해야 하며, 실측되지 않은 값 (존재하지 않는 module class, 임의 phase 배정, 없는 절 이름) 을 **새로 창작하지 않는다**.
  - **1 ~ 4 행 blockquote 무편집** · **16 행 이후 전 구간 무편집** (`## Deployment 컨텍스트` · `## Component diagram` · `## Component table` · `## GitHub Adapter — 3 instance 묶음 vs 분리 결정` · `## Contracts` · `## References`). 특히 **`## Component table` 8 row 는 손대지 않는다** — 별도 후속 slice 소관.
  - **새 pointer 추가 금지** — 본문에 이미 등재된 문서 (deployment.md · ADR-0003 · ADR-0002 · ADR-0001 · INDEX.md · modules.md) 외의 문서를 새로 등재하지 않는다 (audit 쪽에만 기록).
  - **secret · connection string · 실 호스트명을 문서에 옮겨 적지 않는다** (CLAUDE.md §9).
- [ ] **AC 5 — audit `§ 12.43` 신설**: [REQ-COVERAGE-AUDIT.md](../use-cases/REQ-COVERAGE-AUDIT.md) 의 `## 11. References` (4270 행) **직전** 에 `### 12.43 …` 절을 **순수 append** 한다 (기존 절 수정 0). 구성 — 본 절의 위치 · 계보 1 문단 (**T-1444 Follow-up 1 closure + components.md 축 진입 선언**) / AC 1 실측 (명령 + 출력) / AC 2 지점 판정표 / AC 3 처리 판정표 / AC 4 반영 결과 + 무편집 경계 / **components.md 잔여 미대조 단락 목록** (`## Deployment 컨텍스트` · `## Component diagram` · `## Component table` · `## GitHub Adapter …` · `## Contracts` · `## References` 6 개 — 다음 slice 1 순위 + 선정 근거 1 구) / 파생 영향 (목록만) / 불변 검산 / 한계. **절 전체 ≤ 110 행** (cap 준수 — 초과 시 실측 인용을 요약형으로 압축).
  - `###` 레벨이라 `grep -c '^## '` **12 불변** · `grep -c '^| REQ-'` **66 불변** · `grep -c '^### 12\.'` **42 → 43**.
- [ ] **AC 6 — 불변 검산**: 다음을 실행해 출력을 `§ 12.43` 에 인용한다. `wc -l` components.md (190 → ≤ 198) · audit (4283 → +110 이내) · deployment.md (**232 불변**) · directory.md (**203 불변**) · modules.md (**259 불변**), `git diff -U0 -- docs/architecture/components.md | grep '^@@'` 로 **hunk 개수 · 위치** 를 보이고 AC 4 허용 구간 밖 hunk **0** 을 실증, `git diff --numstat` 으로 **순수 삭제 0** (삭제 행이 있으면 in-place 치환의 짝임을 1 구로 설명), `git status --porcelain src/ test/ prisma/ web/ deploy/ docker-compose.yml Dockerfile .github/ package.json README.md .claude/ docs/decisions/ docs/ops/` **빈 출력** (코드 · 스키마 · 배포자산 · CI · 의존성 · ADR · runbook 무변경), `git status --porcelain` 이 **3 파일** 임을 확인.
- [ ] **AC 7 — 파생 영향 기록 (목록만, 본 slice 편집 금지)**: `§ 12.43` 말미에 후속 slice 대상을 목록으로 남긴다. 최소 포함 — (1) **components.md 다음 단락 1 순위** (`## Deployment 컨텍스트` 또는 claim 밀도가 가장 높은 `## Component table`) + 선정 근거 1 구, (2) `@nestjs/config` 미도입 전수 sweep (`§ 12.39` FU3 — 본 slice 가 components.md 1 지점을 국소 판정할 뿐 sweep 은 미착수, ADR 게이트), (3) reviewer 규약 미이행 (`.claude/agents/reviewer.md` 에 REQ-032 항목 0 hit — `§ 12.41` FU2 미소진), (4) `deploy/README.md` ↔ deployment.md ↔ runbook 3 자 정합 (`§ 12.41` FU3 미소진), (5) README 행 번호 pointer drift 전수 sweep, (6) REQ 번호 체계 잔재 전수 sweep (`§ 12.38` FU3 미소진), (7) `CLAUDE.md` §1 pointer 부정확 (T-1442 FU3 미소진), (8) UC-09 `§ 5` sequence participant 병기 (27 회째 이월), (9) 정본 [modules.md](../architecture/modules.md) 카운트 claim 대조 (`§ 12.34` FU1 미소진 — ADR 게이트), (10) 행 번호 → anchor 좌표계 이행 (21 회째), (11) 산문 tally ↔ 실측 CI drift-guard spec (`pr` mode 소관).
- [ ] **AC 8 — R-110 / R-112 면제 근거 명시**: 본 task 는 `commitMode: direct` doc-only 로 production code **0 LOC** · 분기 **0** 이라 [CLAUDE.md](../../CLAUDE.md) §3.2 direct-mode 면제 조항에 따라 tester 호출 · happy / error / flow / negative 4 항목 · `pnpm test:cov` 가 **N/A** 임을 `§ 12.43` 에 1 구로 명시한다.
- [ ] **AC 9 — 언어 · 링크 규약**: 추가 문장은 모두 한국어 (§12), 문서 간 참조는 상대경로 markdown 링크, 수치는 실측 출력과 1:1 일치.

## Out of Scope

- **코드 · 스키마 · 배포 자산 · CI · agent 정의 변경 절대 금지** — `src/` · `test/` · `prisma/` · `web/` · `scripts/` · `deploy/` · `docker-compose.yml` · `Dockerfile` · `.github/workflows/` · `package.json` · `.claude/agents/` 는 diff 에 등장하면 안 된다. **`@nestjs/config` 를 새로 설치하지 않는다** (새 dependency = CLAUDE.md §5 BLOCKED — 문서를 실제에 맞출 뿐, 실제를 문서에 맞추지 않는다). **module class rename 도 금지**.
- **components.md 16 행 이후 전 구간 편집 금지** — 특히 `## Component table` 8 row · `## Contracts` 표 · mermaid diagram 은 후속 slice 소관이며 본 slice 에서 손대면 cap 이 즉시 깨진다.
- **1 ~ 4 행 blockquote 편집 금지** — pointer 실재 확인까지만. 문서 성격 선언은 판정의 제약이지 편집 대상이 아니다.
- **ADR-0003 · ADR-0002 · ADR-0001 본문 재판정 · status 변경 금지** — Decision 절 목록 확인까지만.
- **[modules.md](../architecture/modules.md) · [INDEX.md](../architecture/INDEX.md) · [deployment.md](../architecture/deployment.md) 편집 금지** — 정합 판정 필요 사실은 파생 영향 목록에만 남긴다 (**modules.md 259 행 · deployment.md 232 행 불변**).
- **`docs/PLAN.md` 편집 금지** — phase 표기 확인까지만. phase 상태 갱신은 driver 소관.
- **빌드 · 테스트 · 설치 실행 금지** — `pnpm install` · `pnpm build` · `pnpm test` · `prisma migrate` 어느 것도 실행하지 않는다 (측정은 전부 read-only grep / ls / sed).
- **정본 [directory.md](../architecture/directory.md) · [api.md](../architecture/api.md) · [data-model.md](../architecture/data-model.md) 편집 금지** — 본 slice 는 components.md `## 개요` 만 닫는다.
- **다른 문서로의 cascade 금지** — [use-cases/INDEX.md](../use-cases/INDEX.md) · `UC-01` ~ `UC-09` · ADR · [PLAN.md](../PLAN.md) · [requirements.md](../requirements.md) · [README.md](../../README.md) 는 무편집.
- **행 번호 → anchor 좌표계 이행 금지** — 파생 영향 목록에만 남긴다 (21 회째 이월).
- **CI drift-guard spec 작성 금지** — `pr` mode 소관이라 본 direct task 에서 진행하면 §3.1 위반.
- **audit 기존 절 (`§ 12.1` ~ `§ 12.42`) 수정 금지** — `§ 12.43` 순수 append 만.

## Suggested Sub-agents

`implementer` 단독 (doc-only, 코드 0 LOC — architect · tester 불요. §3.2 direct-mode 면제).

## Follow-ups

(생성 시 비어 있음 — sub-agent 가 발견한 후속 작업을 여기에 append 한다.)
