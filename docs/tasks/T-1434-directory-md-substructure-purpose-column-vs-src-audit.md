---
id: T-1434
title: directory.md 표준 sub-structure 표 (68 ~ 75 행) 의 `용도` 컬럼 6 서술 ↔ 실 파일 책임 대조 + 공통 4 항목 산문 (59 ~ 64 행) 보조 축 처리 판정 + audit §12.32
phase: P5
status: DONE
commitMode: direct
coversReq: [REQ-004]
estimatedDiff: 190
estimatedFiles: 3
created: 2026-08-04
independentStream: uc-doc-audit-resync
dependsOn: [T-1433]
touchesFiles:
  - docs/architecture/directory.md
  - docs/use-cases/REQ-COVERAGE-AUDIT.md
  - docs/tasks/T-1434-directory-md-substructure-purpose-column-vs-src-audit.md
plannerNote: "uc-doc-audit-resync 46 번째 slice — audit §12.31 파생 영향 8 (용도 컬럼 ↔ 실 파일 책임) 실행. doc-only 1.6x"
---

# T-1434 — sub-structure 표 `용도` 컬럼 ↔ 실 파일 책임 대조 + 처리 판정

## Why

[T-1433](T-1433-directory-md-substructure-table-vs-src-audit.md) 은 [directory.md](../architecture/directory.md) 의 sub-structure 표를 **sub-dir 이름 축 + flat suffix 축** 으로 닫고 (77 ~ 79 행 각주 3 행), [REQ-COVERAGE-AUDIT.md](../use-cases/REQ-COVERAGE-AUDIT.md) `§ 12.31` 의 closure 선언에서 "각 sub-dir 의 `용도` 컬럼 서술 ↔ 실 파일 책임 대조는 실측 근거 없이 창작할 수 없어 **별도 slice 소관**" 이라고 잔여를 명시했다. 같은 절 **파생 영향 8** (신규 잔여) 이 그것을 후속 slice 로 위임했고, 79 행 각주 본문에도 같은 문장이 박제돼 있다. 본 slice 가 그 위임을 실행해 directory.md 의 **마지막 미검증 면 (서술 내용 축)** 을 닫는다.

planner 사전 확인 (executor 가 AC 1 에서 전부 재측정) — `용도` 컬럼 6 서술 중 **검증 가능한 수치 · 이름 claim** 이 최소 3 건 확인된다. ① `providers/` = "**5** LLM provider — custom / Azure OpenAI / Anthropic / Google Gemini / OpenAI" vs 실 `ls src/llm/providers/*.adapter.ts` = **4** (`anthropic` · `azure-openai` · `google-gemini` · `openai-compatible` — custom 과 OpenAI 가 `openai-compatible` 1 개로 통합), ② `repositories/` = "`UserRepository.findActiveByGroupId(...)` 등" vs 실 `src/user/user.repository.ts` 에 그 메서드 **부재** (실 surface 는 `create` · `findByEmail` · `findById`), ③ `entities/` = "domain entity 또는 Prisma generated type 의 re-export wrapper" vs 실 `ls src/*/*.entity.ts` = **0** (T-1433 이 이미 미shipped 로 판정). 즉 본 축은 이름 축과 달리 **서술 내용의 참·거짓** 이 걸려 있어 판정 성격이 다르다.

동시에 본 문서 3 · 19 · 55 행이 스스로를 **T-0021 시점 blueprint** 로 규정하므로 `§ 12.15` 의 append-only 축과 T-1430 / T-1432 / T-1433 이 같은 문서에서 3 회 채택한 "원문 보존 + 실측 각주 blockquote" 선례를 본 축에도 적용할지 정면 판정한다. [PLAN.md](../PLAN.md) 의 미완 bullet (106 · 108 · 109 · 140 · 151) 은 owner 게이트 · 외부 credential · 새 dependency 게이트라 planner 단독 진행 불가라, 본 doc stream 이 현 시점 우선순위 최상위다.

## Required Reading

- `docs/architecture/directory.md` — **191 행**. 다음 구간만 읽는다.
  - **57 ~ 86 행** (`## 각 module 디렉토리의 표준 sub-structure` heading + **59 ~ 64 행 공통 4 항목 산문** + 66 행 도입구 + **68 ~ 75 행 표** + **77 ~ 79 행 T-1433 각주** + 81 ~ 86 행 `PersistenceModule 의 특수 sub-structure`) — 본 slice 의 **유일한 편집 후보 구간**.
  - **77 ~ 79 행** (T-1433 각주 3 행) — **무편집 원칙** (AC 3 이 (C) 를 채택해 각주에 1 행 append 하는 경우만 예외). 79 행이 본 slice 의 위임 원문이라 반드시 인용한다.
  - **52 ~ 53 행** (T-1432 트리 축 각주) · **104 ~ 105 행** (T-1430 mapping 표 축 각주) — **무편집**, 각주 화법 template 확인용.
  - **3 · 19 · 55 행** (시점 blueprint 선언 3 지점) — **무편집**, 판정의 최강 제약.
  - **88 ~ 105 행** (`## 9 module 별 디렉토리 mapping` 표 + T-1430 각주) · **109 ~ 191 행** (`## common/` 이후 전 구간 + `## References` + `Refs:` 말미) — **무편집** 경계 확인용. 특히 99 행 (LlmModule row 의 `providers/` 5 provider 파일명 열거) 은 **같은 claim 의 두 번째 사본** 이나 본 slice 편집 대상이 **아니다** (AC 7 로 이월).
- `docs/use-cases/REQ-COVERAGE-AUDIT.md` — **3064 행**. **`### 12.15`** (**1002** 행 — 시점 기록 append-only 처리 방침 정본) · **`### 12.31`** (**2930** 행 — T-1433 의 이름 축 대조 + 판정표 화법 template + **파생 영향 8** 이 본 slice 위임 원문 + closure 선언의 "이름 축뿐" 한계 1 항) · **`## 11. References` (3051 행)** — `§ 12.32` 삽입 위치 경계.
- `docs/architecture/modules.md` — **무편집, 읽기만**. **32 ~ 43 행** (정본 표 row 12) · **47 ~ 48 행** (T-1425 미기재 3 각주). `채택 module` 값 (`assessment` · `scheduler`) 판정 근거는 이미 T-1430 / T-1433 각주가 인용했으므로 재판정하지 않는다.
- `CLAUDE.md` §3 (task 크기 상한) · §3.2 (direct doc-only 면제) · §12 (언어 정책)

## Acceptance Criteria

- [ ] **AC 1 — 실측 선행 (날조 금지)**: 편집 전에 다음을 직접 측정해 `§ 12.32` 에 **명령과 출력을 함께** 인용한다. 기대값과 **다르면 그 축의 편집을 중단** 하고 불성립 사실을 `§ 12.32` 에 기록한다.
  - (i) **서술 축 전수**: `sed -n '68,75p' docs/architecture/directory.md` 로 표 원문을 인용하고, 6 row 각각의 `용도` 컬럼에서 **실측으로 참·거짓을 가릴 수 있는 claim** 만 뽑아 열거한다 (수치 · 파일명 · 메서드명 · 경로 · 외부 문서 참조). 순수 의도 서술 (예: "domain-cohesion 유지") 은 **검증 불가 claim** 으로 별도 분류해 판정 대상에서 제외한다 — 이 이분 자체를 `§ 12.32` 에 표로 남긴다.
  - (ii) **`providers/` 축**: `ls src/llm/providers/*.adapter.ts` 출력을 인용한다. 기대 — **4** (`anthropic.adapter.ts` · `azure-openai.adapter.ts` · `google-gemini.adapter.ts` · `openai-compatible.adapter.ts`). 표의 "**5** provider — custom / Azure OpenAI / Anthropic / Google Gemini / OpenAI" 와 대조해 **custom + OpenAI 가 `openai-compatible` 1 파일로 통합** 됐는지 `grep -n "custom\|OpenAI-호환\|openai-compatible" src/llm/providers/openai-compatible.adapter.ts | head -5` 로 확인 인용한다 (통합 근거가 파일 안에서 확인되지 않으면 "미확인" 으로 기록하고 단정하지 않는다).
  - (iii) **`repositories/` 축**: `grep -n "async \w*(" src/user/user.repository.ts` 로 실 메서드 surface 를 인용한다. 기대 — 표가 예시한 `findActiveByGroupId` **부재**. 추가로 `grep -rn "findActiveByGroupId" src/ | wc -l` = **0** 을 인용해 repo 전역 부재를 보인다.
  - (iv) **`entities/` · `adapters/` · `dto/` · `guards/` 축**: 각 row 의 claim 을 1 개 명령으로 대조한다 — `entities/` (`ls src/*/*.entity.ts` = **0**, T-1433 판정 승계), `adapters/` (표의 "github 3 instance (`com` / `sec` / `ecode`) 단일 adapter + sub-config 라우팅" vs `grep -rn "ecode" src/github/ | wc -l` 출력 — **0 이면 3 instance 라우팅 미shipped** 로 기록), `dto/` (표의 "모든 endpoint 가진 module" vs `ls -d src/*/dto/` **8** ↔ `ls src/*/*.controller.ts` **19** 의 module 집합 차), `guards/` (표의 `RolesGuard` vs `ls src/auth/*.guard.ts` **2** — `jwt-auth.guard.ts` · `roles.guard.ts`, 즉 표 미기재 1 종 존재).
  - (v) **공통 4 항목 산문 축 (보조, 59 ~ 64 행)**: `ls src/*/*.module.ts` · `src/*/*.controller.ts` · `src/*/*.service.ts` · `src/*/*.service.spec.ts` 4 개 count 를 인용한다. 기대 — **14 · 19 · 51 · 51**. `.module.ts` 14 = shipped module 수 (T-1430 실측 일치) 이나 `.controller.ts` 19 · `.service.ts` 51 은 "module 당 1 개" 를 전제한 산문 서술과 배수가 어긋남을 기록한다. 본 축은 판정 대상에 포함하되 편집 여부는 AC 3 채택안을 따른다.
  - (vi) **외부 참조 축 (보조)**: 표가 인용하는 외부 pointer 3 개 — `[REQ-038]` · `[ADR-0002](../decisions/ADR-0002-db.md) §2` · `[components.md](components.md) "GitHub Adapter 묶음 결정"` — 의 **대상 존재 여부만** 확인한다 (`grep -c "REQ-038" docs/requirements.md`, `ls docs/decisions/ADR-0002-db.md`, `grep -n "GitHub Adapter" docs/architecture/components.md`). 내용 정합까지는 보지 않는다 (범위 밖 — AC 7 로 이월).
  - (vii) baseline — `wc -l` directory.md **191** · audit **3064** · modules.md **259**, `grep -c '^## '` directory.md **10** · audit **12**, audit `grep -c '^| REQ-'` **66** · `grep -c '^### 12\.'` **31**.
- [ ] **AC 2 — 지점 판정표**: AC 1 (i) 이 뽑은 **검증 가능 claim** 각각에 대해 `in-place 수정` / `원문 보존 + 각주 부기` / `무편집` 중 하나를 판정한 표를 만든다. 각 row 는 **row (sub-dir) · claim 1 구 · 실측 결과 · 판정 (참 / 거짓 / 부분참) · 처리 · 근거 1 구** 6 컬럼.
  - 판정 기준 **3 축** 명시 — ① **문서 성격** (3 · 19 · 55 행의 T-0021 blueprint 자기규정과 서술 수정의 자기모순 여부), ② `§ 12.15` **정합** (시점 기록 append-only), ③ **선례** (T-1430 · T-1432 · T-1433 이 같은 문서에서 3 회 채택한 "원문 보존 + 실측 각주" 화법의 서술 축 적용 가능성).
  - **"거짓" 과 "부분참" 을 반드시 구분** — `repositories/` 의 `findActiveByGroupId` 는 **예시 메서드가 repo 전역 부재** (거짓) 인 반면, `providers/` 의 "5 provider" 는 **책임은 shipped 이나 파일 통합으로 4** (부분참) 다. 같은 "불일치" 라도 독자 오도 성격이 다름을 근거 컬럼에 1 구로 남긴다.
- [ ] **AC 3 — 처리 방식 판정**: 후보 4 개 중 **채택 1 · 기각 3** 인 판정표를 만든다. 기각마다 근거 1 구.
  - 후보 — (A) **`용도` 컬럼 in-place 재작성** (거짓 claim 을 실측 서술로 교체), (B) **표 원문 무편집 + T-1433 각주 (79 행) 뒤에 서술 축 각주 blockquote 1 개 신설** (같은 문서 4 번째 각주), (C) **T-1433 각주 블록에 1 ~ 2 행 append** (별도 blockquote 신설 대신 기존 각주 확장), (D) **전 지점 무편집 + audit 기록만**.
  - 판정 기준 **4 축** 명시 — ① `§ 12.15` 정합, ② 독자 오도 risk (P3+ implementer 가 `UserRepository.findActiveByGroupId` 를 **이미 있는 메서드로 오인** 하거나 5 번째 provider 파일을 신설하는가), ③ **cap** — 예상 diff ≤ 300 LOC · 변경 파일 **3 고정** (초과 후보는 자동 기각 + split 제안을 `§ 12.32` 에 기록), ④ 선례 일관성 (3 회 채택된 각주 화법 + 같은 표 직후에 blockquote 를 2 개 두는 것이 가독성상 타당한가 — (B) vs (C) 의 실질 쟁점).
- [ ] **AC 4 — 채택안 반영**: AC 3 채택안대로만 편집한다. 각 지점은 AC 2 판정 결과를 따른다.
  - **directory.md 편집은 각주 blockquote 1 개 (≤ 3 행) 또는 기존 각주 append (≤ 2 행) 이내** — `wc -l` 증가 **+4 이내**.
  - **표 본문 (68 ~ 75 행) 내부는 AC 3 이 (A) 를 채택한 경우에만 편집** 하며, 그 경우에도 **실측으로 확인된 claim 만** 손댄다 (창작 금지 — 실측되지 않은 `용도` 문구를 새로 쓰지 않는다).
  - **3 · 19 · 55 행 시점 선언 무편집** · **52 ~ 53 행 · 104 ~ 105 행 각주 무편집** · **81 ~ 86 행 PersistenceModule 단락 무편집** (T-1433 이 3 파일 실재로 확인 완료) · **88 ~ 105 행 mapping 표 무편집** (99 행 5 provider 사본 포함) · **109 행 이후 전 구간 무편집** · `Refs:` 말미 무편집.
  - **59 ~ 64 행 공통 4 항목 산문은 AC 1 (v) 가 불일치를 실증하고 AC 3 채택안이 그 축을 포함한 경우에만** 손대며, 기본값은 **무편집** 이다.
- [ ] **AC 5 — audit §12.32 절 신설**: `## 11. References` (**3051** 행) 바로 앞 (= `§ 12.31` 뒤) 에 `### 12.32 …` 절을 **순수 append** 로 삽입한다 (audit `grep -c '^## '` = **12 불변** — `###` 이므로, `^### 12\.` 는 31 → **32**). **본 절 ≤ 110 행** (cap 보호). 구성은 `§ 12.30` · `§ 12.31` 화법 승계 — (i) 서두 blockquote (본 절이 `§ 12.31` **파생 영향 8** 의 위임을 실행하며 T-1422 → … → T-1433 계보에서 directory.md 의 **서술 내용 축** 임을 규정), (ii) AC 1 실측 7 항 인용 (검증 가능 / 불가 claim 이분 + 4 개 축 실측 + 보조 2 축), (iii) AC 2 판정표, (iv) AC 3 4 후보 판정표 + 채택 결론, (v) AC 4 반영 결과 (편집 지점 목록 + 각 지점 근거), (vi) 무편집 경계, (vii) 파생 영향 목록 (AC 7), (viii) **closure 선언** (directory.md 가 표 · pointer · 트리 · sub-structure 이름 · sub-structure 서술 **5 면** 에서 닫혔는지 — 닫히지 않았다면 잔여를 명시), (ix) 불변 검산 출력 블록, (x) **한계 3 항 이상** — 최소: ① 본 대조는 **검증 가능 claim 축** 이라 의도 서술 (`domain-cohesion` 등 설계 의도) 의 타당성은 미검증, ② 같은 claim 의 **두 번째 사본** (99 행 LlmModule row 의 5 provider 파일명 열거) 은 mapping 표 소관이라 본 slice 가 닫지 않아 **한 문서 안에서 부분적으로만 각주된 상태** 가 남음, ③ blueprint 서술 ↔ 코드 drift 는 CI drift-guard 축으로만 재발 방지되며 본 slice 는 시점 사실 기록뿐.
- [ ] **AC 6 — 불변 검산**: `git status --porcelain` 변경 파일이 **최대 3 개** (`directory.md` · `REQ-COVERAGE-AUDIT.md` + 본 task 파일 — AC 3 채택안이 (D) 면 directory.md 가 빠져 2 개). 불변 — audit `^## ` **12** · `^| REQ-` **66**, directory.md `^## ` **10**, `modules.md` `wc -l` **259** 무편집. `git diff -U0 -- docs/architecture/directory.md` 의 `^@@` hunk 목록을 제시해 AC 4 허용 구간 밖이 없음을 보인다. **순수 삭제 0** (삭제 행은 전부 in-place 치환의 짝). `git status --porcelain src/ test/ prisma/ web/` 이 **빈 출력** 임을 인용. 합계 diff ≤ 300 LOC · 파일 ≤ 3.
- [ ] **AC 7 — 파생 영향 목록 (편집 금지)**: 본 slice 가 닫지 않는 동종 잔여를 **목록만** `§ 12.32` 에 남긴다 — 최소 ① [UC-09](../use-cases/UC-09-user-defined-period-evaluation.md) `§ 5` sequence participant 병기 (**16 회째 이월**), ② 정본 [modules.md](../architecture/modules.md) 표 row 신설 축 (ADR 게이트), ③ 행 번호 좌표계 → anchor 좌표계 이행 (**10 회째**), ④ 산문 tally ↔ 표 row 수 / 트리 항목 수 / sub-dir 종 수 / provider 파일 수 CI drift-guard spec, ⑤ **신규 — mapping 표 99 행 LlmModule row 의 5 provider 파일명 열거** (본 slice 와 같은 claim 의 두 번째 사본, mapping 표 소관), ⑥ [components.md](../architecture/components.md) 11 행 8 열거의 forward pointer 부기 (T-1431 잔여), ⑦ 표 외부 참조 3 개 (`REQ-038` · `ADR-0002 §2` · components.md "GitHub Adapter 묶음 결정") 의 **내용 정합** 대조 (본 slice 는 존재 여부만), ⑧ 각 UC 본문 `§ 9` module 산정 수치의 이중 관리. 각 항목에 "후속 slice 소관" 을 명시하고 **본 slice 에서는 편집하지 않는다**.
- [ ] **AC 8 — R-110 / R-112 면제 확인**: 본 task 는 `commitMode: direct` + production code 0 LOC 이라 [CLAUDE.md](../../CLAUDE.md) §3.2 의 "direct-mode doc-only commit 면제" 조항으로 tester 호출 (R-110) · R-112 4 항목 (happy / error / branch / negative 충분 cover) · `pnpm test:cov` 가 전부 **N/A** 임을 완료 기록에 1 줄 명시 (분기 0).

## Out of Scope

- **`src/` 파일 · 디렉토리 신설 · 이동 · rename · 메서드 추가 일체** — 문서를 코드에 맞추는 slice 이지 그 역이 아니다. 특히 `UserRepository.findActiveByGroupId` 를 실제로 구현하거나 5 번째 provider adapter 파일을 만드는 것은 절대 금지.
- **[modules.md](../architecture/modules.md) 편집 일체** — 정본 표 row 신설 / 각주 확장은 ADR 게이트 소관 (AC 7 ②).
- **directory.md 의 mapping 표 (88 ~ 105 행, 99 행 5 provider 사본 포함) · ASCII 트리 블록 (21 ~ 53 행) · PersistenceModule 단락 (81 ~ 86 행) · `## common/` 이후 전 구간 (109 ~ 191 행)** — 전부 무편집.
- **시점 선언 3 지점 (directory.md 3 · 19 · 55 행) 편집** — `§ 12.15` 상 보존.
- **[components.md](../architecture/components.md) · [api.md](../architecture/api.md) · [data-model.md](../architecture/data-model.md) · `docs/architecture/INDEX.md` · `docs/architecture/p3-*.md` · `docs/use-cases/INDEX.md` · `UC-01` ~ `UC-09` 본문 · `docs/requirements.md` · `docs/decisions/ADR-*.md` · [PLAN.md](../PLAN.md)** — 전부 무편집, diff 에 미등장.
- **`test/` · `prisma/` · `web/` · `scripts/` 일체** 및 66 REQ 전수 재audit · audit 기존 절 (`§ 12.1` ~ `§ 12.31`) 본문 재편집.
- **`scripts/daily-test.sh` leg 추가 · CI drift-guard spec 신설** — AC 7 ④ 로 이월 (drift-guard smoke spec 3 개 동반 갱신이 5 파일 cap 을 넘긴다 — 과거 T-1122 BLOCKED · Q-0054 선례).
- `package.json` · CI workflow 일체.

## Suggested Sub-agents

`implementer` (doc-only, 단독).

## 완료 기록

- **AC 3 채택안 = (B)** — 표 (68 ~ 75 행) · 공통 4 항목 산문 (59 ~ 64 행) **원문 무편집** + T-1433 각주 (79 행) 직후에 서술 축 각주 blockquote **3 행** 신설 ([directory.md](../architecture/directory.md) `wc -l` 191 → **195**, +4, 상한 +4 충족). (A) 는 3 · 19 · 55 행의 T-0021 시점 blueprint 선언과 자기모순 (`§ 12.15` 위반), (C) 는 "(T-1433 실측 각주) 이름 축" header 블록에 서술 축 사실을 넣는 **misattribution** + 79 행 위임 문장과의 한 블록 충돌, (D) 는 오도 risk 최대 (없는 `findActiveByGroupId` 호출 · 5 번째 provider adapter 신설) 라 각각 기각.
- **실측 (AC 1)** — `용도` 컬럼 claim 이 **검증 가능 12 · 검증 불가 3** 으로 갈리고 전자의 판정은 **참 7 · 부분참 3 · 거짓 2**. 거짓 2 = `findActiveByGroupId` (`grep -rn … src/` **0**, 실 surface 6) · `entities/` re-export wrapper (`*.entity.ts` **0**, T-1433 승계). 부분참 3 = `providers/` "5 provider" vs `*.adapter.ts` **4** (custom + OpenAI → `openai-compatible` 통합, 파일 1 · 13 · 114 행 주석이 근거) · `adapters/` key `com` **0** (실 예시 `public`) · components.md 인용 문구 1 낱말 차. **기대 정정 1** — `grep -rn "ecode" src/github/` = **31** 이라 "0 이면 3 instance 미shipped" 조건절의 전건이 불성립 (라우팅은 shipped). 보조 축 — 산문 4 항목 **14 · 19 · 51 · 51** · 외부 pointer 3 전부 대상 실재. baseline 7 값 전부 일치 (중단 지점 0).
- **audit `### 12.32` 신설** — `## 11. References` 앞 순수 append **108 행** (cap 110 안, audit `wc -l` 3064 → **3173** = 절 108 + 구분 빈 줄 1), `^## ` **12** · `^| REQ-` **66** 불변 · `^### 12\.` 31 → **32**, `modules.md` 259 무편집. 변경 파일 **3** · `git diff --numstat` = `4 0` · `109 0` · `8 1` (삭제 1 행 = 본 파일 Follow-ups placeholder 치환 짝 ⇒ 순수 삭제 0) · `git status --porcelain src/ test/ prisma/ web/` 빈 출력.
- **closure + AC 8** — directory.md 대조 축이 **표 · pointer · 트리 · sub-structure 이름 · sub-structure 서술 5 면 전부** 닫혔다 (`§ 12.32` closure 선언). 잔여는 mapping 표 99 행 사본 (파생 영향 5) 과 검증 불가 claim 3 (범위 밖) 뿐. `commitMode: direct` + production code **0 LOC** 이라 [CLAUDE.md](../../CLAUDE.md) §3.2 doc-only 면제로 R-110 tester 호출 · R-112 4 항목 (happy / error / branch / negative) · `pnpm test:cov` 전부 **N/A** (분기 0).

## Follow-ups

- **[REQ-COVERAGE-AUDIT § 12.32](../use-cases/REQ-COVERAGE-AUDIT.md) 파생 영향 8 항** 이 정본 목록 — 특히 신규 ⑤ mapping 표 99 행 LlmModule row 의 5 provider 파일명 열거 (본 slice 와 동일 claim 의 두 번째 사본, 파일명 규약마저 실 `*.adapter.ts` 와 다름), ④ provider 파일 수 · sub-dir 종 수 CI drift-guard spec (재-stale 을 막는 유일한 축), ③ 행 번호 → anchor 좌표계 이행 (10 회째) 이 우선순위다. 전부 후속 slice 소관 (본 slice 편집 금지).
