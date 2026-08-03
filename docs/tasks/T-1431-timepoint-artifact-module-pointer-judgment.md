---
id: T-1431
title: 시점 기록성 P1~P3 산출물 3 문서 (components.md · p3-implementation-plan.md · p3-to-p4-transition.md) 의 modules.md 파생 pointer 5 지점을 정본 12 module 과 대조 후 §12.15 처리 판정 + audit §12.29
phase: P5
status: DONE
commitMode: direct
coversReq: [REQ-004]
estimatedDiff: 220
estimatedFiles: 5
created: 2026-08-04
independentStream: uc-doc-audit-resync
dependsOn: [T-1430]
touchesFiles:
  - docs/architecture/components.md
  - docs/architecture/p3-implementation-plan.md
  - docs/architecture/p3-to-p4-transition.md
  - docs/use-cases/REQ-COVERAGE-AUDIT.md
  - docs/tasks/T-1431-timepoint-artifact-module-pointer-judgment.md
plannerNote: "uc-doc-audit-resync 43 번째 slice — T-1430 Follow-up 8 (파생 영향 8) 의 시점 기록 3 문서 판정. doc-only 1.6x"
---

# T-1431 — 시점 기록성 3 문서의 `modules.md` 파생 pointer 5 지점 판정

## Why

[T-1430](T-1430-directory-md-module-coordinate-resync.md) 은 [REQ-COVERAGE-AUDIT.md](../use-cases/REQ-COVERAGE-AUDIT.md) `§ 12.28` 에서 정본 [modules.md](../architecture/modules.md) 의 **파생 4 문서** ([INDEX.md](../use-cases/INDEX.md) T-1423 · [data-model.md](../architecture/data-model.md) T-1426 · [api.md](../architecture/api.md) T-1429 · [directory.md](../architecture/directory.md) T-1430) module 어휘 축 closure 를 선언하면서, **파생 영향 8** 로 "시점 기록성 module 수치 문서 3 종 ([components.md](../architecture/components.md) · `p3-implementation-plan.md` · `p3-to-p4-transition.md`) 은 `§ 12.15` 상 **보존 후보** 이며 별도 판정 slice 소관" 을 목록만 남겼다. 본 slice 가 그 위임된 판정을 실행한다.

planner 사전 확인 (executor 가 AC 1 에서 전부 재측정) — 세 문서는 각각 **T-A3 (P1)** · **T-0057 시점 (P3)** · **T-0062 closure 시점 (P3)** 산출물이고, 특히 `p3-to-p4-transition.md` 는 `3` · `111` · `136` · `329` 행에 "**§2.x 의 박제 freeze … 는 역사 박제로 유지 — 본문 수정 0**" 이라는 **자기-freeze 선언** 을 네 번 보유한다. 즉 이 문서군의 module 수치는 [T-1417](T-1417-audit-legacy-summary-forward-pointer.md) 이 `§ 12.15` 로 명문화한 "**옛 요약 = 시점 기록이라 append-only**" 축에 정확히 해당한다.

단 그중 **일부는 시점 진척 tally 가 아니라 정본을 현재형으로 가리키는 파생 pointer** 다 — `p3-implementation-plan.md` **13 · 243** 행과 `p3-to-p4-transition.md` **20 · 314** 행은 References 절에서 "`modules.md` — **9 NestJS module** 의 source" 라고 **정본이 지금 무엇을 담는지** 를 서술하고, [components.md](../architecture/components.md) **11** 행은 T-A4 가 mapping 할 module class 를 **8 개 괄호 열거** 한다. 정본은 [T-1422](T-1422-modules-md-module-count-resync.md) 확정 이후 **12** 다. 이는 T-1430 이 directory.md **168** 행 (References 파생 pointer) 에 적용한 판정과 **같은 축** 이라, 본 slice 는 "freeze 선언 보유 문서에서도 References 파생 pointer 는 in-place 동기 대상인가" 를 정면으로 판정한다.

본 slice 는 **문서 축의 좌표 정합** 이지 진척 tally 재작성이 아니다 — `p3-implementation-plan.md` **52 · 186 · 187 · 188** 행 · `p3-to-p4-transition.md` **10 · 53 · 55 · 57 · 63 · 128 · 149 · 198** 행 같은 **시점 진척 수치는 절대 편집하지 않는다** (Out of Scope 1). [PLAN.md](../PLAN.md) 의 미완 bullet (106 · 108 · 109 · 140 · 151) 은 각각 owner 게이트 · 외부 credential · 새 dependency 게이트라 planner 단독 진행 불가라 본 doc stream 이 현 시점 우선순위 최상위다.

## Required Reading

- `docs/architecture/components.md` — **190 행**. 다음 구간만 읽는다.
  - **1 ~ 16 행** (frontmatter blockquote **3** 행 = `P1 T-A3 산출물` 시점 marker + `## 개요` + **11** 행 T-A4 module class **8 괄호 열거** — 본 slice 편집 후보 1).
  - **185 ~ 190 행** (`## References` 말미 — 파생 pointer 추가 존재 여부 확인용).
  - 그 외 구간 — **무편집**, AC 1 (i) grep 결과 확인 용도로만.
- `docs/architecture/p3-implementation-plan.md` — **272 행**. **13** 행 (References 파생 pointer, `9 NestJS module (8 application + PersistenceModule)`) · **243** 행 (`## References` 파생 pointer) 두 지점 + **52 · 186 ~ 188** 행 (**무편집 대상** — 시점 진척 tally 임을 판별하기 위한 대조 재료).
- `docs/architecture/p3-to-p4-transition.md` — **364 행**. **20** 행 · **314** 행 (References 파생 pointer 2) + **3 · 111 · 136 · 329** 행 (**freeze 선언 blockquote 4** — 판정의 핵심 근거 원문) + **10 · 53 · 55 · 57 · 63 · 128 · 149 · 198** 행 (**무편집 대상** 시점 진척 tally).
- `docs/architecture/modules.md` — **무편집, 읽기만**. **28** 행 (`다음 12 NestJS module 로 분해된다`) · **32 ~ 43** 행 (정본 표 row 12) · **45** 행 · **47 ~ 48** 행 (T-1425 미기재 3 각주 + 카운트 경계). `AssessmentModule` (미shipped placeholder) · `SchedulerModule` (실 shipped 명 `SchedulingModule`) 두 row 문장은 AC 2 판정 근거라 그대로 인용.
- `docs/use-cases/REQ-COVERAGE-AUDIT.md` — **`### 12.15`** (T-1417 이 명문화한 처리 방침 정본 = 시점 기록 append-only / living document in-place) · **`### 12.28`** (**2505** 행 — T-1430 의 3 축 대조 + 각주 채택 화법 template, 그 **파생 영향 8** 이 본 slice 위임 원문) · **`## 11. References` (2688 행)** — `§ 12.29` 삽입 위치 경계.
- `CLAUDE.md` §3 (task 크기 상한) · §3.2 (direct doc-only 면제) · §12 (언어 정책)

## Acceptance Criteria

- [ ] **AC 1 — 실측 선행 (날조 금지)**: 편집 전에 다음을 직접 측정해 `§ 12.29` 에 **명령과 출력을 함께** 인용한다. 기대값과 **다르면 그 축의 편집을 중단** 하고 불성립 사실을 `§ 12.29` 에 기록한다.
  - (i) **문서 축 전수**: `grep -n '[0-9] module\|[0-9] NestJS module' docs/architecture/components.md docs/architecture/p3-implementation-plan.md docs/architecture/p3-to-p4-transition.md` 전체 출력을 인용하고, 각 hit 를 **① 파생 pointer** (정본이 지금 담는 내용을 현재형으로 서술) / **② 시점 진척 tally** (해당 task 시점의 박제 수치) 로 **전수 이분** 한다. 기대 — ① 은 `components.md` **11** · `p3-implementation-plan.md` **13 · 243** · `p3-to-p4-transition.md` **20 · 314** = **5 지점**, ② 는 `p3-implementation-plan.md` **52 · 186 · 187 · 188** · `p3-to-p4-transition.md` **10 · 53 · 55 · 57 · 63 · 128 · 149 · 198** = **12 지점**. 분류마다 근거 1 구 (애매어 금지).
  - (ii) **freeze marker 축**: `sed -n '3p' docs/architecture/components.md` · `sed -n '3p;111p;136p;329p' docs/architecture/p3-to-p4-transition.md` · `sed -n '1,5p' docs/architecture/p3-implementation-plan.md` 로 각 문서의 **시점 marker / freeze 선언** 유무를 원문 인용한다. `p3-to-p4-transition.md` 의 "**본문 수정 0**" 문구는 그대로 인용 — 본 slice 판정의 최강 제약이다.
  - (iii) **정본 축**: `sed -n '28p;45p;47,48p' docs/architecture/modules.md` 원문 인용 — 정본이 **12** 이고 각주 3 module 이 카운트 밖이라는 사실이 대체값 근거임을 명시. `components.md` **11** 행 괄호 열거 **8** 개와 정본 12 의 차이가 어느 module 인지 (전수 차집합) 1 구로.
  - (iv) **선례 축**: T-1430 이 `directory.md` **168** 행 (References 파생 pointer) 을 어떻게 처리했는지 (`§ 12.28` 원문) 와, T-1417 이 `§ 12.15` 에서 "옛 요약 = 시점 기록 append-only" 를 어떻게 규정했는지 각각 1 구 인용. **두 선례가 본 문서군에서 충돌하는지** 를 명시적으로 평가한다 (파생 pointer 이면서 동시에 freeze 문서 안에 있음 — 본 slice 의 핵심 질문).
  - (v) baseline — `wc -l` components.md **190** · p3-implementation-plan.md **272** · p3-to-p4-transition.md **364** · audit **2701** · modules.md **259** · directory.md **184**, `grep -c '^## '` components.md **7** · p3-implementation-plan.md **8** · p3-to-p4-transition.md **8** · audit **12**, audit `grep -c '^| REQ-'` **66**.
- [ ] **AC 2 — 5 지점 판정표**: AC 1 (i) ① 의 파생 pointer **5 지점** 각각에 대해 `in-place 동기` / `원문 보존 + 부기` / `무편집` 중 하나를 판정한 표를 만든다. 각 row 는 **문서 · 행 · 현 서술 1 구 인용 · freeze 선언 유무 · 판정 · 근거 1 구** 6 컬럼.
  - 판정 기준 **3 축** 명시 — ① **서술 시제** (정본을 현재형으로 가리키는 pointer 인가, 그 시점의 사실 기록인가), ② **freeze 선언 적용 범위** (`p3-to-p4-transition.md` 의 freeze 는 `§2.x` 를 대상으로 하는데 **20 · 314** 행이 그 범위 안인지 밖인지 — 행 번호로 판정), ③ **cascade** (한 지점을 바꾸면 같은 문서의 ② tally 12 지점과 자기모순이 생기는가).
  - **`components.md` 11 행 괄호 8 열거** 는 별도 1 구 — 열거를 12 로 늘리면 그 행이 서술하는 **T-A4 시점** 사실과 어긋나므로 in-place 확장 조합은 자동 기각인지 여부를 판정한다.
  - **`p3-implementation-plan.md` 13 행 괄호 부연** (`8 application + PersistenceModule` = 8 + 1 = 9 자기-검산) 도 별도 1 구 — 카운트만 12 로 바꾸고 부연을 두면 한 행 안에서 자기모순이므로 그 조합은 자동 기각.
- [ ] **AC 3 — 처리 방식 판정**: 후보 4 개 중 **채택 1 · 기각 3** 인 판정표를 만든다. 기각마다 근거 1 구.
  - 후보 — (A) **5 지점 전부 12 로 in-place 치환** (T-1430 directory.md 168 행 선례 확대 적용), (B) **원문 무편집 + 각 문서 References 절에 forward pointer 부기 1 행** (T-1417 `§ 12.15` append-only 선례), (C) **문서별 혼합** (freeze 선언 없는 문서만 in-place, 있는 문서는 부기), (D) **전 지점 무편집 + audit 기록만**.
  - 판정 기준 **4 축** 명시 — ① `§ 12.15` 정합, ② 독자 오도 risk (파생 pointer 를 그대로 두면 독자가 정본을 9 로 오인하는가), ③ **cap** — 예상 diff ≤ 300 LOC · 변경 파일 **5 고정** (초과 후보는 자동 기각 + split 제안을 `§ 12.29` 에 기록), ④ 선례 일관성 (T-1430 in-place vs T-1417 append-only 중 본 문서군 성격에 맞는 쪽).
- [ ] **AC 4 — 채택안 반영**: AC 3 채택안대로만 편집한다. 각 지점은 AC 2 의 판정 결과를 따른다.
  - **문서당 편집 최대 2 행 또는 부기 블록 1 개 (≤ 3 행)** — 세 문서 합계 `wc -l` 증가 **+9 이내**.
  - **AC 1 (i) ② 시점 진척 tally 12 지점은 전부 무편집** — diff 에 미등장 (AC 6 이 hunk 목록으로 검증).
  - **freeze 선언 blockquote 4 지점 (`p3-to-p4-transition.md` 3 · 111 · 136 · 329) 무편집**.
  - **표 · 코드블록 · mermaid 다이어그램 내부 무편집**.
  - 세 문서의 `Refs:` / 말미 줄 무편집.
- [ ] **AC 5 — audit §12.29 절 신설**: `## 11. References` (**2688** 행) 바로 앞 (= `§ 12.28` 뒤) 에 `### 12.29 …` 절을 **순수 append** 로 삽입한다 (audit `grep -c '^## '` = **12 불변** — `###` 이므로). **본 절 ≤ 120 행** (cap 보호). 구성은 `§ 12.28` 화법 승계 — (i) 서두 blockquote (본 절이 `§ 12.28` **파생 영향 8** 의 위임을 실행하며 T-1422 → T-1423 → T-1426 → T-1429 → T-1430 → T-1431 계보에서 **정본 파생 문서 축의 마지막 잔여군** 임을 규정), (ii) AC 1 실측 5 항 인용 (① ② 이분 전수 포함), (iii) AC 2 5 지점 판정표, (iv) AC 3 4 후보 판정표 + 채택 결론, (v) AC 4 반영 결과 (편집 지점 목록 + 각 지점 근거), (vi) 무편집 경계, (vii) 파생 영향 목록 (AC 7), (viii) **closure 선언** (정본 module 어휘 축이 파생 문서 전 범위에서 닫혔는지 — 닫히지 않았다면 잔여를 명시), (ix) 불변 검산 출력 블록, (x) **한계 3 항 이상** — 최소: ① 본 동기가 **카운트 · pointer 축** 이라 세 문서의 나머지 서술이 현 코드와 맞는지는 미검증, ② 시점 기록 문서가 정본을 복제하는 구조 자체는 남아 재-stale 반복 (CI drift-guard 축으로만 닫힘), ③ 시점 진척 tally 12 지점은 판정상 보존이라 독자가 여전히 옛 수치를 만난다.
- [ ] **AC 6 — 불변 검산**: `git status --porcelain` 변경 파일이 **최대 5 개** (`components.md` · `p3-implementation-plan.md` · `p3-to-p4-transition.md` · `REQ-COVERAGE-AUDIT.md` + 본 task 파일 — AC 3 채택안이 (D) 면 문서 3 개가 빠져 2 개). 불변 — audit `^## ` **12** · `^| REQ-` **66**, 세 문서 `^## ` **7 / 8 / 8**, `modules.md` `wc -l` **259** · `directory.md` **184** 무편집. `git diff -U0 -- docs/architecture/` 의 `^@@` hunk 목록을 제시해 AC 4 허용 구간 밖이 없음을 보인다. **순수 삭제 0** (삭제 행은 전부 in-place 치환의 짝). `git status --porcelain src/ test/ prisma/ web/` 이 **빈 출력** 임을 인용. 합계 diff ≤ 300 LOC · 파일 ≤ 5.
- [ ] **AC 7 — 파생 영향 목록 (편집 금지)**: 본 slice 가 닫지 않는 동종 잔여를 **목록만** `§ 12.29` 에 남긴다 — 최소 ① [UC-09](../use-cases/UC-09-user-defined-period-evaluation.md) `§ 5` sequence participant 병기 (**13 회째 이월**), ② 정본 [modules.md](../architecture/modules.md) 표 row 신설 축 (ADR 게이트), ③ 외부 package module (`ScheduleModule.forRoot()`) 계상 규약, ④ 행 번호 좌표계 → anchor 좌표계 이행 (**7 회째** — 본 slice 도 17 개 행 번호에 전면 의존), ⑤ 산문 tally ↔ 표 row 수 CI drift-guard spec, ⑥ 각 UC 본문 `§ 9` module 산정 수치의 이중 관리, ⑦ [directory.md](../architecture/directory.md) ASCII tree ↔ 실 `src/` 트리 정합 (T-1430 잔여), ⑧ 시점 진척 tally 12 지점의 독자 오도 완화 (본 slice 판정상 보존). 각 항목에 "후속 slice 소관" 을 명시하고 **본 slice 에서는 편집하지 않는다**.
- [ ] **AC 8 — R-110 / R-112 면제 확인**: 본 task 는 `commitMode: direct` + production code 0 LOC 이라 [CLAUDE.md](../../CLAUDE.md) §3.2 의 "direct-mode doc-only commit 면제" 조항으로 tester 호출 (R-110) · R-112 4 항목 (happy / error / branch / negative) · `pnpm test:cov` 가 전부 **N/A** 임을 완료 기록에 1 줄 명시 (분기 0).

## Out of Scope

- **시점 진척 tally 편집 일체** — `p3-implementation-plan.md` **52 · 186 · 187 · 188** 행 · `p3-to-p4-transition.md` **10 · 53 · 55 · 57 · 63 · 128 · 149 · 198** 행은 그 task 시점의 사실 기록이라 `§ 12.15` 상 **보존**. 수치가 현 코드와 다르다는 이유로 고치는 것은 역사 왜곡.
- **[modules.md](../architecture/modules.md) 편집 일체** — 정본 12 표 row 신설 / 각주 확장은 ADR 게이트 소관 (AC 7 ②).
- **[directory.md](../architecture/directory.md) · [api.md](../architecture/api.md) · [data-model.md](../architecture/data-model.md) · `docs/architecture/INDEX.md` · `docs/use-cases/INDEX.md` · `UC-01` ~ `UC-09` 본문 · `docs/decisions/ADR-*.md` · [PLAN.md](../PLAN.md) · `docs/requirements.md`** — 전부 무편집, diff 에 미등장.
- **`src/` · `test/` · `prisma/` · `web/` 일체** — 디렉토리 rename · 신설 · 코드 변경 절대 금지.
- **세 문서의 mermaid 다이어그램 · 표 · 코드블록 재작성** — 별도 slice 소관.
- 66 REQ 전수 재audit · 분류 재판정 · audit 기존 절 (`§ 12.1` ~ `§ 12.28`) 본문 재편집.
- `package.json` · CI workflow · `scripts/` 일체.

## Suggested Sub-agents

`implementer` (doc-only, 단독).

## Follow-ups

(작성 시 비어 있음 — sub-agent 가 관련 작업 발견 시 append)

## 완료 기록

- 완료 시각: 2026-08-03T18:56Z (commit 233a4cfe)
- 결과: References 파생 pointer 4 지점 (p3-implementation-plan 13·243 · p3-to-p4-transition 20·314) 을 정본 12 module 로 in-place 동기 + 시점 단서 병기. freeze 선언 3 개가 §2.x 한정임을 실측해 §1·§6 pointer 만 편집 범위로 판정.
- components.md 는 AC 1 기대 grep hit 0 (불성립) 이라 중단 규칙 적용, 무편집 보존.
- audit `§ 12.29` (120 행) 신설 — 실측 5 항 · 5 지점 판정표 · 4 후보 판정 (채택 C) · 파생 영향 9 · 한계 3 박제.
- 규모: 3 파일 +125/-4 (cap 이내). doc-only 라 R-110 / R-112 면제 (production code 0 LOC).
