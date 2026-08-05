---
id: T-1489
title: 범위 표기 규약 축 S3 batch 10 — `L` 축 ADR 3 파일 (`ADR-0023` · `ADR-0032` · `ADR-0004`) R5·R4 정규화 + label 전체 좌표 · 좌표 약칭화 · 파일명 결합 label 판정 (audit §12.87)
phase: P5
status: PENDING
commitMode: direct
coversReq: [REQ-057]
estimatedDiff: 130
estimatedFiles: 5
created: 2026-08-05
independentStream: uc-doc-audit-resync
dependsOn: [T-1488]
touchesFiles:
  - docs/decisions/ADR-0023-permission-denied-audit-query-rbac-contract.md
  - docs/decisions/ADR-0032-p5-evaluation-contract.md
  - docs/decisions/ADR-0004-smoke-e2e-db-mode.md
  - docs/use-cases/REQ-COVERAGE-AUDIT.md
  - docs/tasks/T-1489-range-notation-s3-adr-batch10-lprefix.md
plannerNote: "uc-doc-audit-resync 101 번째 slice — §12.86 파생 (1) 1 순위 S3 batch 10. `L` 잔존 10 ADR 중 상위 3 파일 15 좌표, direct 5 파일"
---

# T-1489 — 범위 표기 규약 축 S3 batch 10 — `L` 축 ADR 3 파일 (`ADR-0023` · `ADR-0032` · `ADR-0004`) `R5` · `R4` 정규화

## Why

[REQ-COVERAGE-AUDIT.md](../use-cases/REQ-COVERAGE-AUDIT.md) `§ 12.86` (S3 batch 9) 의 **파생 영향 (1)** 이 **1 순위** 로 지목한 **S3 batch 10 = `L` 잔존 10 ADR 중 `ADR-0023` (5 행 / 6 좌표) · `ADR-0032` (6 행 / 6 좌표) · `ADR-0004` (3 행 / 3 좌표)** 를 집행한다. `§ 12.83` AC 6 이 en dash 축 마감을 선언했으므로 후보는 여전히 **`L` 축 단일 축** 이며, 규범 정본은 `§ 12.76` 조문 `R1` ~ `R7`, 판정 선례는 `§ 12.81` AC 3 ①② (회색지대 · 코드 파일 대상 좌표) · `§ 12.82` AC 3 (`R5` 자기 소멸 · 규약 범위 밖 문서 좌표) · `§ 12.84` AC 3 (병기 4 변형) · `§ 12.85` AC 3 (가운뎃점 · prefix 생략) · `§ 12.86` AC 3 ①②③ (식별자 범위 3 분해 · 혼합 병기 · 반복 label 동시 정정) 을 승계한다.

본 slice 가 새로 여는 판정 축은 셋이다 — (가) **markdown 링크 label 이 좌표 토큰 **하나뿐** 인 형태의 첫 등장**: `ADR-0032`:19 의 `[L82](../PLAN.md)` 는 label 전체가 좌표라, 정정하면 링크 텍스트 자체가 `82 행` 이 된다. `§ 12.84` 의 "label **안** 좌표" 선례 (label 에 다른 낱말이 함께 있는 형태) 와 달리 단위어 부착이 링크 문구를 통째로 바꾸므로 `R1` · `R5` · `R6` 화법 근거로 별도 확정이 필요하다. (나) **좌표의 약칭 지시어화**: 같은 `ADR-0032` 에서 `L82` 가 `:34` · `:37` · `:79` 에 **bare 토큰** 으로 3 회 더 등장해 특정 PLAN bullet 을 가리키는 **약칭 명사** 처럼 쓰인다 (`L82(Issue 평가)가` · `"Issue 를 문서 기여로 평가"(L82/R-30)`). 이것이 `R5` 규율 대상 좌표인지 아니면 고유 label 로 볼 여지가 있는지, 슬래시 병기 (`L82/R-30`) 안에서 단위어 부착이 가독을 해치지 않는지가 쟁점이며 — `§ 12.86` AC 3 ③ 의 **반복 label 전량 동시 정정 의무** 가 링크 형태와 bare 형태에 **걸쳐** 적용되는지도 함께 닫는다. (다) **파일명 + 좌표 결합 label**: `ADR-0004` 는 3 좌표 전량이 `[PLAN.md L66](../PLAN.md)` 형태로 label 안에서 파일명과 좌표가 붙어 있어, 단위어를 붙였을 때 (`PLAN.md 66 행`) 파일명과 좌표의 결합이 유지되는지 판정한다. 아울러 `ADR-0004` 는 편집 전 raw `~` 가 **0** 이라 `R5` 존치 조건이 **형식상 성립** 하는 본 축 두 번째 파일 — `§ 12.82` AC 3 ① 의 자기 소멸 논거를 다시 동원해야 한다.

`CLAUDE.md` §3.1 **rule 5** (기존 `docs/decisions/*` 본문의 **비-결정 수정** = `direct`) 의 **열 번째** 적용 선례이며, 편집 대상은 `L` prefix 제거 + 단위어 부착 + 구분자 보존에 한정되고 ADR 의 결정 실질은 무편집이다.

## Required Reading

- [docs/use-cases/REQ-COVERAGE-AUDIT.md](../use-cases/REQ-COVERAGE-AUDIT.md) — `§ 12.76` (정본 조문 `R1` ~ `R7` · 특히 `R1` · `R4` · `R5` 존치 조건 · `R6` · `R7` · AC 3 ③ 한정 소급) · `§ 12.82` AC 3 ① (자기 소멸 · 규약 범위 밖 문서 좌표) · `§ 12.84` AC 3 (label 안 · heading 내 병기) · `§ 12.85` AC 3 ② (구분자 보존) · `§ 12.86` 전문 (7367 행~ · 특히 AC 3 ①②③ · AC 4 대조표 · AC 5 hunk 구간 판정 · AC 6 잔존 목록 · 한계 5 · 6 · 파생 영향 (1)). 신설 절은 파일 **끝** (`## 11. References` 직전) 에 append.
- [docs/decisions/ADR-0023-permission-denied-audit-query-rbac-contract.md](../decisions/ADR-0023-permission-denied-audit-query-rbac-contract.md) — planner 실측 후보 **5 행 / 6 좌표**, raw `~` **4** (전량 좌표), en dash **0**, 총 **156 행** · 링크 **61** · `## ` heading **5**. `:23` · `:66` · `:150` 의 코드 파일 대상 반복 label (`auth.service.ts` `L36~42` **3 회**) · `:30` `README` 단일 좌표 `L33` · `:31` **콤마 병기 + 범위/단일 혼합** (`L19~22, L33`) 포함.
- [docs/decisions/ADR-0032-p5-evaluation-contract.md](../decisions/ADR-0032-p5-evaluation-contract.md) — planner 실측 후보 **6 행 / 6 좌표**, raw `~` **1** (좌표 `L94~106` 자신), en dash **0**, 총 **118 행** · 링크 **23** · `## ` heading **5**. `:17` 의 괄호 안 범위 (`Phase P5(L94~106)`) · `:19` 의 **label 전체가 좌표인 링크** (`[L82](../PLAN.md)`) · `:34` · `:37` · `:79` 의 **bare 약칭** `L82` (슬래시 병기 `L82/R-30` 포함) · `:48` 의 `PLAN P5 L97`.
- [docs/decisions/ADR-0004-smoke-e2e-db-mode.md](../decisions/ADR-0004-smoke-e2e-db-mode.md) — planner 실측 후보 **3 행 / 3 좌표**, raw `~` **0**, en dash **0**, 총 **139 행** · 링크 **21** · `## ` heading **6**. `:15` · `:26` · `:130` 전량이 **파일명 결합 label** `[PLAN.md L66](../PLAN.md)` 형태의 **동일 좌표 3 회 반복**.
- [CLAUDE.md](../../CLAUDE.md) — §3 (cap 300 LOC · 5 파일) · §3.1 rule 5 (비-결정 doc 수정 = `direct`) · §12 정본 pointer 소절.

## Acceptance Criteria

- [x] **AC 1 — 대상 선정 · 한정 소급 · mode · cap 판정.** audit 신설 절 `§ 12.87` 안에 ① 선정 근거 (`§ 12.86` 파생 (1) 1 순위 · 잔존 10 중 좌표 수 **상위 3 파일** 편성 이유 · 4 번째 파일을 얹지 않은 5 파일 cap 근거), ② 한정 소급 준수 (AC 2 census 가 파일 · 행 단위로 특정 → `§ 12.76` AC 3 ③ "이미 어긋남이 확인된 좌표에 한정" 충족 · **전면 일괄 치환 금지** 재확인), ③ mode 근거 (`CLAUDE.md` §3.1 rule 5 **열 번째 선례** · 선례 `§ 12.78` ~ `§ 12.86` ③ 열거), ④ **cap 가드** (확정 정정 좌표 수가 **70 초과** 면 `ADR-0004` 를 batch 11 로 이월하고 그 판단 결과를 명시 · `§ 12.85` AC 1 ④ · `§ 12.86` AC 1 ④ 선례 승계) 를 각각 **1 문단씩** 박제.
- [x] **AC 2 — 후보 census 재실측 (집계 1 구).** 3 파일에 대해 `grep -nE 'L[0-9]+' <file>` (행 단위) · `grep -oE 'L[0-9]+' <file> | wc -l` (좌표 단위) · raw `grep -oE '[0-9] *~ *[0-9]' <file> | wc -l` 을 실행해 값을 절 안에 기록하고, Required Reading 의 planner 기준값 (**5 / 6** · **6 / 6** · **3 / 3**) 과의 **차이를 명시** (차이 0 이면 "차이 0"). `§ 12.80` AC 2 의 "행 수 ≠ 좌표 수 · 행 단위 grep 은 하한" 승계를 1 문장으로 재확인하고, 본 batch 최대 격차 파일 (`ADR-0023` 6−5 = **1**) 이 어느 행에서 발생하는지 **행 번호로 지목**. 본 batch 는 격차가 **1** 로 `§ 12.86` (격차 8) 대비 현저히 작다는 사실을 1 문장으로 대조.
- [x] **AC 3 — 판정 3 종 독립 결론.** ① **label 전체 좌표 첫 판정** — `ADR-0032`:19 의 `[L82](../PLAN.md)` 에 대해 **원 표기 → 정정 표기** 를 제시하고, 링크 텍스트가 통째로 `82 행` 이 되는 것이 (가) `R1` · `R5` 적용 대상인지 (나) `R6` (인용 원문) 면제 여지가 있는지 (다) URL 무편집 원칙과 충돌하지 않는지를 조문 근거로 확정. `§ 12.84` 의 "label **안** 좌표" 선례와의 차이 (label 에 다른 낱말 유무) 를 1 문장으로 구분. ② **좌표 약칭화 + 슬래시 병기 판정** — `ADR-0032` 의 bare `L82` **3 회** (`:34` · `:37` · `:79`) 가 특정 PLAN bullet 의 **약칭 명사** 로 쓰이는 형태에 대해, (가) `R5` 규율 대상인지 (고유 label 로 보아 면제할 여지가 있는지) 를 `R5` · `R6` 문언 근거로 결론내고, (나) `L82/R-30` 슬래시 병기에서 단위어 부착 위치 (`82 행/R-30` vs `82 행 / R-30`) 를 `§ 12.84` 슬래시 병기 선례 승계로 확정하며, (다) `§ 12.86` AC 3 ③ 의 **반복 label 전량 동시 정정 의무** 가 **링크 형태 (`:19`) 와 bare 형태 (`:34` · `:37` · `:79`) 에 걸쳐** 적용됨을 1 문장으로 박제한다. ③ **파일명 결합 label + `R5` 존치 조건 파일별 판정** — (가) `ADR-0004` 3 좌표 전량의 `[PLAN.md L66](../PLAN.md)` 에 대해 정정 표기 (`PLAN.md 66 행`) 를 제시하고 파일명 · 좌표 · 단위어 3 토큰의 결합이 `R4` (단일 행) 를 충족하는지 확정. (나) 3 파일의 raw `~` 실측치를 `§ 12.86` AC 3 ① 의 **좌표 / 수량 / 식별자 3 분해** 로 나눠 파일별 존치 조건 성립 여부를 결론내고, `ADR-0004` 가 raw `~` **0** 으로 존치 조건이 형식상 성립하는 두 번째 파일임을 밝힌 뒤 `§ 12.82` AC 3 ① **자기 소멸** 논거를 명시 동원해 정정 결론임을 1 문단으로 확정. `ADR-0032` 의 유일한 `~` (`L94~106`) 가 `L` 접두 좌표 자신이라 좌표 범위로 계수된다는 `§ 12.85` AC 3 ① 선례도 명시 승계.
- [x] **AC 4 — 대조표.** 후보 행 전량 (3 파일 합계 **14 행**) 을 `# / 파일 / 행 / 원 표기 / 판정 / 근거 조문` **6 컬럼** 표로 박제 (유형이 같으면 행 압축 허용 · 압축 시 행·좌표 수를 셀 안에 표기). `R6` · `R7` · `R4` 면제 판별 건수와 `L` 제거로 인한 **조사 보정 건수** 를 1 구로 명시하고, 이미 `~` 를 쓰는 좌표 (`R1` 이미 준수 · `R5` 만 적용) 와 단일 행 좌표 (`R4` 병용) 의 수를 구분해 적는다. 반복 label (`L36~42` 3 회 · `L82` 4 회 · `L66` 3 회) 은 **반복 횟수** 를 셀 안에 표기.
- [x] **AC 5 — 무편집 검산.** `git diff --numstat` 로 3 파일의 **추가 행 수 = 삭제 행 수** 임을 보이고, hunk 가 `## Decision` · `## Consequences` · `## Alternatives` 구간에 떨어지면 `§ 12.83` AC 5 · `§ 12.86` AC 5 의 "rule 5 경계는 **구간이 아니라 결정 실질**" 판정을 승계해 비-결정 수정임을 1 문장으로 확인 (문장 · 수치 · 링크 URL 무변경 — 특히 label 안 좌표 정정이 **URL 을 건드리지 않았음** 을 링크 수 불변으로 명시). frontmatter (`status` · `date`) hunk **0**. 정정 후 재실측으로 **행 수 (156 · 118 · 139) · 링크 수 (61 · 23 · 21) · `## ` heading 수 (5 · 5 · 6) 불변** 과 `L` prefix **잔존 수** 를 파일별로 적고, 잔존 수가 면제 · 이월 판정분과 **동수** 인지 대조.
- [x] **AC 6 — `L` 축 잔여 갱신.** `grep -lE 'L[0-9]+' docs/decisions/ADR-*.md | wc -l` 과 비-ADR 대상 `grep -lE 'L[0-9]+' docs/architecture/*.md .claude/agents/*.md | wc -l` 을 정정 후 실행해 **`L` 잔존 파일 수** 를 갱신 기록하고 `§ 12.86` AC 6 의 값 (ADR **10** · 비-ADR **14**) 과 대조. 감소분이 본 batch 처리 파일 수 (**3**) 와 일치하는지 확인하고, 불일치 시 원인 (AC 3 면제 잔존 · 부분 이월) 을 명시. 잔존 ADR 목록을 좌표 수와 함께 열거해 batch 11 편성 근거를 남기고, 잔존 7 파일이 **좌표 소규모** (`§ 12.86` AC 6 실측상 1~3 행) 임을 근거로 **1 batch 로 마감 가능한지** 를 5 파일 cap 관점에서 1 문장 판단한다.
- [x] **AC 7 — 자기 준수 · 범위 검산 1 구.** 신규 추가분 대상 자기 준수 grep (`grep -nE '[0-9]+ *– *[0-9]+|L[0-9]+'` 를 신설 절 · task 파일 대상으로) hit 수를 적고 전량이 **원 표기 인용 (`R6` 예외)** 임을 확인. `wc -l docs/use-cases/REQ-COVERAGE-AUDIT.md` 전후 값으로 신설 절이 **≤ 60 행** 임을, `git diff --stat` 으로 **≤ 300 LOC · ≤ 5 파일** 임을, `git status --short` 로 `README.md` · `CLAUDE.md` · `docs/requirements.md` · `docs/PLAN.md` · `docs/architecture/` · 다른 `docs/decisions/*` · `.claude/agents/` · `docs/LOOP.md` · `src/` · `prisma/` 변경 **0** 임을 검산. audit 파일 fence **짝수** · 신설 표 **6 컬럼 균일** · heading 순번 `12.86` → `12.87` **연속** 도 확인. doc-only 라 `pnpm test` 불요 (`CLAUDE.md` §3.2 direct doc-only 면제).
- [x] **AC 8 — 진척 · 한계 · 파생 영향.** 절 말미에 진척 1 문단 (batch 10 결과 수치 · 처리 좌표 수 · 면제 · 이월 여부 · `L` 잔존 ADR 추이 · 병기 변형 누적 수), 한계 **4 개 이상** (좌표 값 정확성 미검증 승계 · census 행 단위 하한 · 회색지대 조문 부재 (현 **5 종** + 식별자 범위 + 병기 변형 누적 + **label 전체 좌표 · 좌표 약칭화 신규**) · 단위어 부착 규칙의 비조문성 · 반복 label 일관성의 grep 미검출 (`§ 12.86` 한계 5 승계) · 약칭화 판정의 저자 의도 의존성 · FU14 anchor 흡수 관계 등), 파생 영향 **목록만** (다음 1 순위 = `L` 축 batch 11 후보 (잔존 7 파일) · 비-ADR 14 파일 정규화 · `R5` 개정 판단 · `R8` 조문화 우선순위) 을 박제. **파생 항목은 본 slice 에서 착수 금지**.

## Out of Scope

- 본 3 ADR **밖** 의 파일 편집 — `L` 잔존 나머지 ADR (`ADR-0027` · `ADR-0029` · `ADR-0046` · `ADR-0002` · `ADR-0008` · `ADR-0015` · `ADR-0047` 7 파일) · 비-ADR (`directory.md` · `integrator.md` · `reviewer.md` · `race-patterns.md` · `p3-*.md` 등 14 파일) 정규화는 batch 11 이후.
- **en dash 축 재개** — `§ 12.83` AC 6 이 마감을 선언했으므로 잔존 좌표는 재판정하지 않는다.
- **좌표가 가리키는 대상 파일 (`src/**` · `docs/PLAN.md` · `README.md`) 의 편집** — 본 slice 는 ADR 안 표기 형식만 고친다. 대상 파일의 행 번호가 실제로 맞는지도 검증하지 않는다 (`§ 12.74` 판정 승계). 특히 `ADR-0032` 의 `L82` · `L94~106` · `L97` 이 현재 `docs/PLAN.md` 의 어느 bullet 인지 재확인하지 않는다.
- `§ 12.76` **조문 본문 편집** — `R5` 존치 조건 개정 · 예시 목록 갱신 · 단위어 부착 규칙 · 식별자 범위 · 약칭 좌표 규정의 조문화는 `§ 12.79` 파생 (3) + `§ 12.85` 한계 3 · 4 + `§ 12.86` 파생 (3) 이월 유지 (별도 slice).
- **`R8` 조문화** (회색지대 + 병기 변형 + 저자 test) · `R2` · `R3` 병합 재설계 · FU14 anchor 좌표계 이행 — 관계 언급만, 착수 금지.
- ADR 의 `## Decision` · `## Consequences` · `## Alternatives` 실질 · frontmatter `status` · `date` 변경, 링크 URL 변경 (label 안 좌표만 정정).
- `docs/STATE.json` · `docs/progress/journal-*.md` 편집 (driver bookkeeping 몫) · `src/` · `prisma/` · `.github/workflows/` 일체.

## Suggested Sub-agents

`implementer` 단독 (doc-only · ADR 3 파일 in-place 정정 + audit 절 신설 1). 코드 변경 0 이므로 `tester` 불요 ([CLAUDE.md](../../CLAUDE.md) §3.2 direct doc-only 면제).

## Follow-ups

- **batch 11 편성 후보** — 잔존 7 파일 (`ADR-0027` 2 행 / 3 좌표 · `ADR-0029` 2/2 · `ADR-0046` 2/2 · `ADR-0002` 1/7 · `ADR-0008` 1/2 · `ADR-0015` 1/1 · `ADR-0047` 1/1) 은 합 **10 행 / 18 좌표** 로 작지만 **파일 수 7 > 5 파일 cap** 이라 최소 2 batch 가 더 필요하다. batch 크기 상한을 파일 수가 아니라 좌표 수로 재설계할지 판단 여지 (`§ 12.86` Follow-up 승계).
- **비-ADR `L` 축 14 파일** — `R5` 존치 예시 목록 (`p3-implementation-plan.md` · `reviewer.md`) 과 정면 충돌이라 `§ 12.76 R5` 개정 판단 slice 를 **선행** 시킬지 순서 판단 필요.
- **좌표 약칭화의 조문화** — 본 slice 가 `L82` 의 약칭 명사 용법을 처음 판정하면, 좌표 표기가 **지시 대상의 고유 이름** 처럼 굳은 경우의 취급 (정정 vs `R6` 면제) 을 `R8` 후보 묶음에 편입할 실익이 커진다.
