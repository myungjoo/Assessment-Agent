---
id: T-1435
title: directory.md `9 module 별 디렉토리 mapping` 표 (97 ~ 106 행) 의 `표준 sub-dir` · `비고` 두 컬럼 claim ↔ 실 파일 대조 + 처리 판정 + audit §12.33
phase: P5
status: DONE
commitMode: direct
coversReq: [REQ-004]
estimatedDiff: 200
estimatedFiles: 3
created: 2026-08-03
independentStream: uc-doc-audit-resync
dependsOn: [T-1434]
touchesFiles:
  - docs/architecture/directory.md
  - docs/use-cases/REQ-COVERAGE-AUDIT.md
  - docs/tasks/T-1435-directory-md-mapping-table-columns-vs-src-audit.md
plannerNote: "uc-doc-audit-resync 47 번째 slice — §12.32 closure 잔여 (a) + 파생 영향 5 실행 (mapping 표 2 컬럼 서술 축). doc-only 1.6x"
---

# T-1435 — mapping 표 `표준 sub-dir` · `비고` 컬럼 ↔ 실 파일 대조 + 처리 판정

## Why

[T-1434](T-1434-directory-md-substructure-purpose-column-vs-src-audit.md) 는 [directory.md](../architecture/directory.md) 의 **sub-structure 표 `용도` 컬럼** 을 서술 내용 축으로 닫으면서 ([REQ-COVERAGE-AUDIT.md](../use-cases/REQ-COVERAGE-AUDIT.md) `§ 12.32`, 각주 81 ~ 82 행), **closure 선언의 잔여 (a)** 와 **파생 영향 5** 로 "`9 module 별 디렉토리 mapping` 표 **99 행** (현 **103 행**) LlmModule row 가 같은 5 provider claim 을 **파일명까지** 열거하는 두 번째 사본이고 그 파일명 규약 (`*.provider.ts`) 마저 실 `*.adapter.ts` 와 다르다 — mapping 표 소관 후속 slice" 를 명시적으로 남겼다. 그 결과 현재 directory.md 는 **같은 claim 이 한 문서 안에서 부분적으로만 각주된 상태** 다 (`§ 12.32` 한계 2).

본 slice 가 그 위임을 실행한다. 대상은 mapping 표의 **아직 어느 slice 도 대조하지 않은 두 컬럼** — `표준 sub-dir` 와 `비고` 다. [T-1430](T-1430-directory-md-module-coordinate-resync.md) 각주 (108 행) 는 **row ↔ 디렉토리 경로 존재 축** (① 실재 7 · ② 미실재 2 · ③ 표 미기재 7) 만 닫았고, 같은 각주가 스스로 "③ 7 개의 `표준 sub-dir` · `비고` 컬럼은 실측 근거 없이 창작할 수 없어 별도 slice 소관" 이라고 적었다. 즉 **표에 이미 있는 9 row 의 두 컬럼 내용** 은 지금까지 어느 축에서도 검증된 적이 없다.

planner 사전 확인 (executor 가 AC 1 에서 전부 재측정) — 최소 4 건의 검증 가능한 불일치가 확인된다. ① `LlmModule` 비고의 5 파일명 (`custom.provider.ts` … `openai.provider.ts`) vs 실 `src/llm/providers/*.adapter.ts` **4** (개수 −1 **및** suffix 규약 `.provider.ts` ≠ `.adapter.ts`), ② `GithubModule` 의 `표준 sub-dir` = `dto/`, `adapters/` vs 실 `src/github/` 에 **두 디렉토리 모두 부재** (flat `github-adapter.service.ts` 등 7 파일), ③ `ConfluenceModule` 도 동형, ④ `WebModule` 의 `(controller only)` vs 실 `src/web/` = `web.module.ts` **1 파일** (controller **0**). 반면 `LlmModule` 의 `dto/`, `providers/` 는 **둘 다 실재** 하고 `PersistenceModule` 의 "(특수 — `prisma.service.ts` 만, controller 없음)" 도 실측과 맞아, 판정이 일률적이지 않다. 본 축도 [T-1434](T-1434-directory-md-substructure-purpose-column-vs-src-audit.md) 와 같이 `참 / 부분참 / 거짓` 3 값으로 갈린다.

[PLAN.md](../PLAN.md) 의 미완 bullet (106 · 108 · 109 · 140 · 151) 은 owner 게이트 · 외부 credential · 새 dependency 게이트라 planner 단독 진행 불가이므로, 본 doc stream 이 현 시점 우선순위 최상위다.

## Required Reading

- `docs/architecture/directory.md` — **195 행**. 다음 구간만 읽는다.
  - **92 ~ 111 행** (`## 9 module 별 디렉토리 mapping` heading + 94 행 도입 산문 + **96 ~ 106 행 표** (header 2 + row 9) + **108 행 T-1430 각주** + 110 행 마무리 산문) — 본 slice 의 **유일한 편집 후보 구간**.
  - **108 행** (T-1430 각주) — **무편집 원칙** (AC 3 이 (C) 를 채택하는 경우만 예외). 본 slice 의 위임 원문 ("`표준 sub-dir` · `비고` 컬럼은 … 별도 slice 소관") 이라 반드시 인용한다.
  - **52 행** (T-1432 트리 축) · **77 행** (T-1433 이름 축) · **81 ~ 82 행** (T-1434 서술 축) — **무편집**, 각주 화법 · attribution 규약 template 확인용. 특히 **82 행** 은 5 provider claim 의 **첫 번째 사본에 대한 판정** 이라 본 slice 가 승계할 근거다.
  - **3 · 19 · 55 행** (시점 blueprint 선언 3 지점) — **무편집**, 판정의 최강 제약.
  - **57 ~ 90 행** (sub-structure 단락 전체) · **113 ~ 195 행** (`## common/` 이후 전 구간 + `## References` + `Refs:` 말미) — **무편집** 경계 확인용.
- `docs/use-cases/REQ-COVERAGE-AUDIT.md` — **3173 행**. **`### 12.15`** (**1002** 행 — 시점 기록 append-only 처리 방침 정본) · **`### 12.28`** (T-1430 의 mapping 표 경로 축 — 본 slice 가 이어받는 직전 축) · **`### 12.32`** (**3051** 행 — T-1434 의 판정표 화법 template + closure 잔여 (a) + 파생 영향 5 + 한계 2 가 본 slice 위임 원문) · **`## 11. References` (3160 행)** — `§ 12.33` 삽입 위치 경계.
- `docs/architecture/modules.md` — **무편집, 읽기만**. **32 ~ 43 행** (정본 표 row 12) · **47 ~ 48 행** (T-1425 미기재 3 각주). `AssessmentModule` · `SchedulerModule` 의 미shipped / 개명 판정은 T-1430 각주가 이미 박제했으므로 **재판정하지 않고 승계** 한다.
- `CLAUDE.md` §3 (task 크기 상한) · §3.2 (direct doc-only 면제) · §12 (언어 정책)

## Acceptance Criteria

- [x] **AC 1 — 실측 선행 (날조 금지)**: 편집 전에 다음을 직접 측정해 `§ 12.33` 에 **명령과 출력을 함께** 인용한다. 기대값과 **다르면 그 축의 편집을 중단** 하고 불성립 사실을 `§ 12.33` 에 기록한다.
  - (i) **표 원문 전수**: `sed -n '96,106p' docs/architecture/directory.md` 로 표 원문을 인용하고, 9 row 각각의 `표준 sub-dir` · `비고` 두 컬럼에서 **실측으로 참·거짓을 가릴 수 있는 claim** (디렉토리 존재 · 파일명 · 개수 · decorator · controller 유무 · 외부 pointer) 만 뽑아 열거한다. 순수 설계 의도 서술 (예: "Worker 책임을 service layer 로 흡수") 은 **검증 불가 claim** 으로 별도 분류해 판정 대상에서 제외하고, 이 이분 자체를 `§ 12.33` 에 남긴다.
  - (ii) **`표준 sub-dir` 컬럼 축 (9 row 일괄)**: `ls -d src/*/dto/ src/*/guards/ src/*/entities/ src/*/repositories/ src/*/adapters/ src/*/providers/ 2>&1` **1 개 명령** 의 출력을 그대로 인용해 표가 주장한 sub-dir 집합과 대조한다. 기대 — `dto/` **8** · `providers/` **1** · 나머지 4 종 **0** (T-1433 `§ 12.31` 실측 승계). row 별 판정은 이 한 출력에서 파생시키고 row 마다 별도 `ls` 를 반복하지 않는다 (명령 수 절약).
  - (iii) **`LlmModule` 비고 축 (본 slice 의 핵심 — 두 번째 사본)**: `ls src/llm/providers/*.adapter.ts` 와 `ls src/llm/providers/*.provider.ts 2>&1` 두 출력을 인용한다. 기대 — 전자 **4**, 후자 **부재** (`No such file`). 표가 열거한 5 파일명이 **개수 (−1) 와 suffix 규약 (`.provider.ts` ≠ `.adapter.ts`) 두 축 모두** 어긋남을 보이고, 통합 근거는 **재측정하지 않고** 82 행 T-1434 각주 판정을 승계 인용한다. 추가로 `ls src/llm/llm.service.ts 2>&1` 로 같은 row 의 "`llm.service.ts` 가 Admin 지정 modelId 로 라우팅" claim 의 **파일 실재 여부** 를 확인한다 (부재면 실제 routing 진입점을 `grep -rln "modelId" src/llm/*.ts | head -3` 로 1 회만 조회해 기록, 그 이상 추적 금지).
  - (iv) **`GithubModule` · `ConfluenceModule` 비고 축**: `ls src/github/ src/confluence/ | grep -v spec` 출력을 인용해 표가 주장한 `github.adapter.ts` · `confluence.adapter.ts` 의 **실재 여부와 실 파일명** 을 대조한다. 기대 — 실 파일명은 `github-adapter.service.ts` · `confluence-adapter.service.ts` (flat, `.adapter.ts` 아님). 3 instance key (`com` / `sec` / `ecode`) 축은 **T-1434 `§ 12.32` 판정을 승계** 하고 재측정하지 않는다.
  - (v) **`AuthModule` · `PersistenceModule` · `UserModule` · `WebModule` 비고 축**: 4 개 명령으로만 대조한다 — `ls src/auth/*.service.ts src/auth/*.guard.ts` (표의 `auth.service.ts` + `RolesGuard` claim), `grep -n "@Global()" src/persistence/persistence.module.ts` (표의 "@Global() 적용"), `ls src/user/*.controller.ts 2>&1` (표의 "controller endpoint 노출"), `ls src/web/ | grep -v spec` (표의 `(controller only)` — 기대 `web.module.ts` **1**, controller **0**).
  - (vi) **`AssessmentModule` · `SchedulerModule` row (경로 미실재 2)**: 두 row 는 T-1430 각주가 이미 **경로 부재** 로 판정했으므로 **두 컬럼 claim 을 실측 대상에서 제외** 하고 그 사실만 1 구로 기록한다 (없는 디렉토리의 sub-dir 을 대조하는 것은 무의미). 단 `SchedulerModule` 비고의 `@nestjs/schedule` claim 은 실 개명체 `src/scheduling/` 에서 `grep -rn "@nestjs/schedule" src/scheduling/ | wc -l` **1 회** 로만 확인해 "개명체에서는 성립" 여부를 기록한다.
  - (vii) baseline — `wc -l` directory.md **195** · audit **3173** · modules.md **259**, `grep -c '^## '` directory.md **10** · audit **12**, audit `grep -c '^| REQ-'` **66** · `grep -c '^### 12\.'` **32**.
- [x] **AC 2 — 지점 판정표**: AC 1 이 뽑은 **검증 가능 claim** 각각에 대해 `in-place 수정` / `원문 보존 + 각주 부기` / `무편집` / `상위 slice 판정 승계` 중 하나를 판정한 표를 만든다. 각 row 는 **module row · 컬럼 · claim 1 구 · 실측 결과 · 판정 (참 / 부분참 / 거짓 / 대상외) · 처리 · 근거 1 구** 7 컬럼.
  - 판정 기준 **3 축** 명시 — ① **문서 성격** (3 · 19 · 55 행의 T-0021 blueprint 자기규정과 서술 수정의 자기모순 여부), ② `§ 12.15` **정합** (시점 기록 append-only), ③ **선례** (같은 문서에서 4 회 채택된 "원문 보존 + 실측 각주" 화법 — `§ 12.28` 표 축 · `§ 12.30` 트리 축 · `§ 12.31` 이름 축 · `§ 12.32` 서술 축).
  - **`거짓` 과 `부분참` 을 반드시 구분** — 예: `GithubModule` 의 `adapters/` sub-dir 은 **디렉토리 자체가 부재** 하지만 adapter **책임** 은 flat 파일로 shipped 이므로 "형태만 다름 (부분참)" 인지 "구조 주장이 성립하지 않음 (거짓)" 인지 근거 컬럼에서 갈라 적는다. 반면 `LlmModule` 의 `custom.provider.ts` 는 **그 이름의 파일이 존재하지 않아** 독자가 없는 경로를 열게 되므로 거짓 성격이 더 강하다 — 이 차이를 1 구로 남긴다.
  - **중복 각주 회피 판정** 을 반드시 포함 — 5 provider claim 은 **82 행에 이미 각주된 첫 번째 사본** 이 있으므로, 본 slice 의 각주는 그 판정을 **반복하지 않고 "파일명 규약 축" 이라는 새 사실만** 적고 82 행을 참조한다 (같은 사실의 각주 2 개 = `§ 12.32` 가 `entities/` 에서 이미 기각한 패턴).
- [x] **AC 3 — 처리 방식 판정**: 후보 4 개 중 **채택 1 · 기각 3** 인 판정표를 만든다. 기각마다 근거 1 구.
  - 후보 — (A) **두 컬럼 in-place 재작성** (거짓 claim 을 실측 서술로 교체), (B) **표 원문 무편집 + T-1430 각주 (108 행) 뒤에 컬럼 축 각주 blockquote 1 개 신설** (같은 문서 5 번째 각주), (C) **T-1430 각주 블록에 1 ~ 2 행 append**, (D) **전 지점 무편집 + audit 기록만**.
  - 판정 기준 **4 축** 명시 — ① `§ 12.15` 정합, ② 독자 오도 risk (P3+ implementer 가 `src/llm/providers/custom.provider.ts` 를 열려 하거나 `src/github/adapters/` 를 신설하는가), ③ **cap** — 예상 diff ≤ 300 LOC · 변경 파일 **3 고정** (초과 후보는 자동 기각 + split 제안을 `§ 12.33` 에 기록), ④ 선례 일관성 ((B) 는 4 회 채택된 화법의 5 번째 적용 / (C) 는 T-1434 가 misattribution 근거로 기각한 후보와 동형인지).
- [x] **AC 4 — 채택안 반영**: AC 3 채택안대로만 편집한다. 각 지점은 AC 2 판정 결과를 따른다.
  - **directory.md 편집은 각주 blockquote 1 개 (≤ 3 행) 또는 기존 각주 append (≤ 2 행) 이내** — `wc -l` 증가 **+4 이내** (195 → ≤ 199).
  - **표 본문 (96 ~ 106 행) 내부는 AC 3 이 (A) 를 채택한 경우에만 편집** 하며, 그 경우에도 **실측으로 확인된 claim 만** 손댄다 (창작 금지 — 실측되지 않은 `비고` 문구를 새로 쓰지 않는다).
  - 표 heading (92 행) 과 도입 산문 (94 행) 의 `9` 는 **표 row 수 자기-카운트** 라 표를 늘리지 않는 한 **무편집** (T-1430 선례 승계).
  - `AssessmentModule` · `SchedulerModule` row 는 AC 1 (vi) 대로 **대상외** — 어떤 채택안에서도 편집하지 않는다.
- [x] **AC 5 — audit `§ 12.33` 신설**: [REQ-COVERAGE-AUDIT.md](../use-cases/REQ-COVERAGE-AUDIT.md) 의 `## 11. References` (3160 행) **직전** 에 `### 12.33 …` 절을 **순수 append** 한다 (기존 절 수정 0). 구성 — 본 절의 위치 · 계보 1 문단 / AC 1 실측 (명령 + 출력) / AC 2 지점 판정표 / AC 3 처리 판정표 / AC 4 반영 결과 + 무편집 경계 / 파생 영향 (목록만) / closure 선언 / 불변 검산 / 한계. **절 전체 ≤ 115 행** (cap 준수 — 초과 시 실측 인용을 요약형으로 압축).
  - `###` 레벨이라 `grep -c '^## '` **12 불변** · `grep -c '^| REQ-'` **66 불변** · `grep -c '^### 12\.'` **32 → 33**.
- [x] **AC 6 — 불변 검산**: 다음을 실행해 출력을 `§ 12.33` 에 인용한다. `wc -l` directory.md (195 → ≤ 199) · audit (3173 → +115 이내) · modules.md (**259 불변**), `git diff -U0 -- docs/architecture/directory.md | grep '^@@'` 로 **hunk 개수 · 위치** 를 보이고 AC 4 허용 구간 밖 hunk **0** 을 실증, `git diff --numstat` 으로 **순수 삭제 0** (삭제 행이 있으면 in-place 치환의 짝임을 1 구로 설명), `git status --porcelain src/ test/ prisma/ web/` **빈 출력** (코드 무변경), `git status --porcelain` 이 **3 파일** 임을 확인.
- [x] **AC 7 — 파생 영향 기록 (목록만, 본 slice 편집 금지)**: `§ 12.33` 말미에 후속 slice 대상을 목록으로 남긴다. 최소 포함 — (1) UC-09 `§ 5` sequence participant 병기 (17 회째 이월), (2) 정본 modules.md 표 row 신설 축 (ADR 게이트 선행), (3) 행 번호 → anchor 좌표계 이행 (11 회째), (4) 산문 tally ↔ 실측 CI drift-guard spec, (5) 본 slice 가 실측 대상에서 제외한 `AssessmentModule` · `SchedulerModule` 두 row 의 두 컬럼 (경로 신설 / 개명 시 재발화), (6) `§ 12.32` 파생 영향 6 · 7 (components.md 11 행 forward pointer · 외부 참조 내용 정합) 의 잔존.
- [x] **AC 8 — R-110 / R-112 면제 근거 명시**: 본 task 는 `commitMode: direct` doc-only 로 production code **0 LOC** · 분기 **0** 이라 [CLAUDE.md](../../CLAUDE.md) §3.2 direct-mode 면제 조항에 따라 tester 호출 · happy / error / flow / negative 4 항목 · `pnpm test:cov` 가 **N/A** 임을 `§ 12.33` 에 1 구로 명시한다.
- [x] **AC 9 — 언어 · 링크 규약**: 추가 문장은 모두 한국어 (§12), 문서 간 참조는 상대경로 markdown 링크, 수치는 실측 출력과 1:1 일치.

## Out of Scope

- **코드 변경 절대 금지** — `src/` · `test/` · `prisma/` · `web/` · `scripts/` · `package.json` 은 diff 에 등장하면 안 된다. 특히 `src/github/adapters/` · `src/confluence/adapters/` 디렉토리 신설, `src/llm/providers/*.adapter.ts` → `*.provider.ts` rename, `src/web/` controller 신설, `src/assessment/` 신설, `src/scheduling/` → `src/scheduler/` rename 은 **어떤 경우에도 하지 않는다** (문서를 코드에 맞출 뿐, 코드를 문서에 맞추지 않는다).
- **정본 [modules.md](../architecture/modules.md) 편집 금지** — 표 row 신설 · 각주 추가 모두 ADR 게이트 소관.
- **mapping 표 row 신설 · 삭제 금지** — 표 미기재 7 module 의 row 를 만들지 않는다 (T-1430 이 이미 각주로 처리, `표준 sub-dir` · `비고` 창작 불가).
- **sub-structure 단락 (57 ~ 90 행) 재편집 금지** — T-1433 · T-1434 각주 3 개는 무편집. 5 provider claim 의 첫 번째 사본 (82 행) 도 손대지 않고 **참조만** 한다.
- **다른 문서로의 cascade 금지** — [components.md](../architecture/components.md) · [api.md](../architecture/api.md) · [data-model.md](../architecture/data-model.md) · `docs/architecture/INDEX.md` · [INDEX.md](../use-cases/INDEX.md) · `UC-01` ~ `UC-09` · ADR · [PLAN.md](../PLAN.md) · [requirements.md](../requirements.md) 는 무편집.
- **행 번호 → anchor 좌표계 이행 금지** — 파생 영향 목록에만 남긴다 (11 회째 이월).
- **CI drift-guard spec 작성 금지** — `pr` mode 소관이라 본 direct task 에서 진행하면 §3.1 위반.
- **audit 기존 절 (`§ 12.1` ~ `§ 12.32`) 수정 금지** — `§ 12.33` 순수 append 만.

## Suggested Sub-agents

`implementer` 단독 (doc-only, 코드 0 LOC — architect · tester 불요. §3.2 direct-mode 면제).

## 완료 요약 (2026-08-04)

AC 3 은 **(B) 표 원문 무편집 + T-1430 각주 직후 컬럼 축 각주 blockquote 1 개 신설** 을 채택 (A · C · D 기각 — 각각 blueprint 자기규정 모순 / misattribution / 오도 risk 잔존). 대상외 2 row 를 뺀 **7 row 의 검증 가능 claim 28** 판정 = **참 14 · 부분참 5 · 거짓 8 · 유보 1**. 새 사실 — 표가 `GithubModule` · `ConfluenceModule` 에 준 `dto/` 는 두 module 모두 **부재 (거짓)**, `비고` 가 이름까지 지정한 4 파일 (`github.adapter.ts` · `confluence.adapter.ts` · `llm.service.ts` + LlmModule 5 provider 파일명) 의 **실재 0**, `WebModule` 의 `(controller only)` 는 실 controller **0** 으로 거짓. 5 provider 의 **개수 축** 은 82 행 T-1434 각주를 참조만 하고 반복하지 않아 중복 각주를 회피했다. directory.md **+4 행** (195 → 199, hunk 1) · audit `§ 12.33` 순수 append · 코드 **0 LOC** · 3 파일.

## Follow-ups

- `WebModule` 비고의 serve-static mount · 비-`/api/*` SPA fallback · ADR-0040 옵션 1 서술은 본 slice 실측 예산 (AC 1 (v) 4 개 명령) 밖이라 **유보** — 별도 slice 에서 실측.
- 표 미기재 7 module · 대상외 2 row 의 두 컬럼은 경로 신설 / 개명 정합 시 재발화 (`§ 12.33` 파생 영향 5).
