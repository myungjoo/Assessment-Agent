---
id: T-1485
title: 범위 표기 규약 축 S3 batch 6 — en dash 잔여 2 + `L` 순수 1 ADR (`ADR-0001` · `ADR-0003` · `ADR-0011`) R1·R5·R6 판정 (audit §12.83)
phase: P5
status: DONE
commitMode: direct
coversReq: [REQ-057]
estimatedDiff: 145
estimatedFiles: 5
created: 2026-08-05
independentStream: uc-doc-audit-resync
dependsOn: [T-1484]
touchesFiles:
  - docs/decisions/ADR-0001-stack.md
  - docs/decisions/ADR-0003-deployment.md
  - docs/decisions/ADR-0011-difficulty-model-assignment.md
  - docs/use-cases/REQ-COVERAGE-AUDIT.md
  - docs/tasks/T-1485-range-notation-s3-adr-batch6-endash-tail.md
plannerNote: "uc-doc-audit-resync 97 번째 slice — §12.82 파생 (1) 1 순위 S3 batch 6. en dash 잔여 2 파일 마감 + `L` 순수 파일 첫 R5 존치 실판정, direct 5 파일"
---

# T-1485 — 범위 표기 규약 축 S3 batch 6 — en dash 잔여 2 + `L` 순수 1 ADR (`ADR-0001` · `ADR-0003` · `ADR-0011`) R1·R5·R6 판정

## Why

[REQ-COVERAGE-AUDIT.md](../use-cases/REQ-COVERAGE-AUDIT.md) `§ 12.82` (S3 batch 5) 의 **파생 영향 (1)** 이 **1 순위** 로 지목한 **S3 batch 6 = en dash 잔여 `ADR-0003` + `L` 잔존 ADR 묶음** 을 집행한다. 규범 정본은 `§ 12.76` 조문 `R1` ~ `R7` 이고, 판정 선례는 `§ 12.79` AC 3 ② · `§ 12.80` AC 2 · `§ 12.81` AC 3 ② · `§ 12.82` AC 3 ①③ 을 승계한다.

본 slice 가 새로 여는 판정 축은 둘이다 — (가) **en dash 잔여 축의 마감**: `ADR-0001` 의 `100–200명` · `50–100개` 는 **수량 범위** 라 규약 범위 밖일 가능성이 높고, `ADR-0003` 의 en dash 2 행은 `§ 12.76 R6` **예시 문자열 자체** (`(README 33–41 행 표기 · 실 대응 31 · 34 행 불연속)`) 와 동형이라 **인용된 원문 표기 = R1 비적용** 일 가능성이 높다. 즉 batch 6 은 "잔여를 다 고친다" 가 아니라 **면제 · 범위 밖을 실판정해 축을 닫는** slice 다. (나) **`R5` 존치 조건의 진짜 시험**: `ADR-0011` 은 파일 안 `~` 가 **0 건** 이면서 en dash 도 **0 건** 이라, `§ 12.82` AC 3 ① 이 동원한 "`R1` 정정이 `~` 를 유입시켜 존치 근거가 자기 소멸한다" 논거를 **쓸 수 없는 첫 파일** 이다.

`CLAUDE.md` §3.1 **rule 5** (기존 `docs/decisions/*` 본문의 **비-결정 수정** = `direct`) 의 여섯 번째 적용 선례이며, 편집 대상은 구분자 · `L` prefix · 단위어에 한정되고 ADR 의 결정 실질은 무편집이다.

## Required Reading

- [docs/use-cases/REQ-COVERAGE-AUDIT.md](../use-cases/REQ-COVERAGE-AUDIT.md) — `§ 12.76` (정본 조문 `R1` ~ `R7` · 특히 `R4` · `R5` 존치 조건 · `R6` 예시 문자열 · AC 3 ② 적용 범위) · `§ 12.79` AC 3 ②③ · `§ 12.80` AC 2 · 한계 5 · `§ 12.81` AC 3 ②(회색 다) · `§ 12.82` 전문 (7143 행~ · 특히 AC 3 ①③ · 파생 영향 (1)). 신설 절은 파일 **끝** (`## 11. References` 직전) 에 append.
- [docs/decisions/ADR-0001-stack.md](../decisions/ADR-0001-stack.md) — planner 실측 후보 **1 행** (`:20` — `100–200명` · `50–100개` 2 좌표 · raw `~` 는 `88~92행` 등 보유). `L` prefix **0**.
- [docs/decisions/ADR-0003-deployment.md](../decisions/ADR-0003-deployment.md) — planner 실측 후보 **3 행** (`:21` en dash 1 · `:74` `L72` 1 · `:168` en dash 1). raw `~` **13**.
- [docs/decisions/ADR-0011-difficulty-model-assignment.md](../decisions/ADR-0011-difficulty-model-assignment.md) — planner 실측 후보 **3 행** (`:14` · `:28` · `:108` — 전부 `[docs/PLAN.md L86](../PLAN.md)` 링크 label). raw `~` **0** · en dash **0**.
- [CLAUDE.md](../../CLAUDE.md) — §3 (cap 300 LOC · 5 파일) · §3.1 rule 5 (비-결정 doc 수정 = `direct`) · §12 정본 pointer 소절.

## 완료 요약 (2026-08-05)

`§ 12.83` 신설로 AC 1 ~ AC 8 전량 충족. 후보 **7 행 / 8 좌표** 중 **정정 4 행 / 4 좌표** (`ADR-0003`:74 `L72` → `72 행` · `ADR-0011`:14 · 28 · 108 `[docs/PLAN.md L86]` → `[docs/PLAN.md 86 행]`), **`R6` 면제 2 행** (`ADR-0003`:21 · 168 — 조문 예시와 동형인 인용 원문 병기 · 본 축 최초 `R6` 실발동), **범위 밖 1 행 / 2 좌표** (`ADR-0001`:20 수량 범위 `100–200명` · `50–100개` → 파일 전체 무편집). **en dash 축 마감 선언** (잔여 파일 2 는 미처리가 아니라 판정 결과 · 정정 재고 **0**), `L` 잔존 ADR **20 → 18**. `R5` 존치 조건은 자기 소멸 논거 없이 "예시 목록 = 예시적 · 존치는 재량" 으로 정정 확정 (AC 3 ③). diff `0/0` · `1/1` · `3/3` (4/4) · 3 파일 행 수 · 링크 수 · heading 수 불변 · `## Decision` hunk 1 건은 rule 5 경계가 **구간이 아니라 결정 실질** 임을 확인. `CLAUDE.md` §3.1 rule 5 **여섯 번째 선례**.

## Acceptance Criteria

- [x] **AC 1 — 대상 선정 · 한정 소급 · mode · cap 판정.** audit 신설 절 `§ 12.83` 안에 ① 선정 근거 (`§ 12.82` 파생 (1) 1 순위 · 3 파일 편성 이유 · 후보를 더 얹지 않은 5 파일 cap 근거), ② 한정 소급 준수 (AC 2 census 가 파일 · 행 단위로 특정 → `§ 12.76` AC 3 ③ "이미 어긋남이 확인된 좌표에 한정" 충족 · **전면 일괄 치환 금지** 재확인), ③ mode 근거 (`CLAUDE.md` §3.1 rule 5 **여섯 번째 선례** · 선례 `§ 12.78` ~ `§ 12.82` ③ 열거), ④ cap 가드 (확정 정정 좌표 수 대비 이월 여부) 를 각각 **1 문단씩** 박제.
- [x] **AC 2 — 후보 census 재실측 (집계 1 구).** 3 파일에 대해 `grep -nE '[0-9]+ *– *[0-9]+|L[0-9]+' <file>` (행 단위) 와 `grep -oE '[0-9]+ *– *[0-9]+|L[0-9]+' <file> | wc -l` (좌표 단위), raw `grep -o '~' <file> | wc -l` 을 실행해 값을 절 안에 기록하고, Required Reading 의 planner 기준값 (`1` · `3` · `3` 행) 과의 **차이를 명시** (차이 0 이면 "차이 0"). `§ 12.80` AC 2 의 "행 수 ≠ 좌표 수 · `grep -c` 는 하한" 승계를 1 문장으로 재확인.
- [x] **AC 3 — 판정 3 종 독립 결론.** ① **`ADR-0001` 수량 범위 판정** — `:20` 의 `100–200명` · `50–100개` 가 행 좌표가 아니라 **수량 범위** 임을 원문 인용으로 보이고 `§ 12.76` AC 3 ② 적용 범위에 비춰 **범위 밖 (무편집)** 인지 확정. ② **`ADR-0003` en dash 2 행의 `R6` 면제 판별** — `:21` · `:168` 문자열이 `§ 12.76` `R6` 예시 (`(README 33–41 행 표기 · 실 대응 31 · 34 행 불연속)`) 와 **동형의 인용된 원문 표기** 인지 각 행별로 판정하고, 면제면 무편집 · 비면제면 `R1` 정정으로 결론 (행별 결론을 **각각** 적는다). `:74` 의 `L72` 는 `R5` + `R4` 로 정정 여부 판정. ③ **`ADR-0011` 의 `R5` 존치 조건 실판정** — 파일 안 `~` **0 건** 이고 en dash 도 **0 건** 이라 `§ 12.82` AC 3 ① 의 "`R1` 유입에 의한 자기 소멸" 논거를 **동원할 수 없음** 을 명시한 뒤, (가) `R5` 존치 예시 목록 3 파일 (`p3-implementation-plan.md` · `ADR-0005` · `reviewer.md`) 이 **열거적인지 예시적인지**, (나) 대상이 5 문서군 밖 문서 (`docs/PLAN.md`) 를 가리키는 좌표라는 점 (`§ 12.82` AC 3 ③ 신규 변형의 **두 번째 선례**) 두 축으로 **정정 / 존치** 를 확정. 어느 쪽이든 근거를 조문 번호로 명시.
- [x] **AC 4 — 대조표.** 후보 행 전량 (3 파일 합계) 을 `# / 파일 / 행 / 원 표기 / 판정 / 근거 조문` **6 컬럼** 표로 박제 (유형이 같으면 행 압축 허용 · 압축 시 행·좌표 수를 셀 안에 표기). `R6` · `R7` · `R4` 판별과 `L` 제거로 인한 **조사 보정 건수** 를 1 구로 명시.
- [x] **AC 5 — 무편집 검산.** `git diff --numstat` 로 3 파일의 **추가 행 수 = 삭제 행 수** 임을 보이고 (무편집 파일은 `0/0`), hunk 좌표가 전부 `## Context` · `## References` 등 **비-결정 구간** 안이며 `## Decision` · `## Consequences` · `## Alternatives` hunk **0** · frontmatter (`status` · `date`) hunk **0** 임을 기록. 정정 후 재실측으로 **행 수 · 링크 수 · `## ` heading 수 불변** 과 `L` prefix · en dash **잔존 수** 를 파일별로 적고, 잔존 수가 면제 · 범위 밖 판정분과 **동수** 인지 대조.
- [x] **AC 6 — en dash 축 마감 선언 + 잔여 갱신.** `grep -lE '[0-9] *– *[0-9]' docs/decisions/ADR-*.md` 와 `grep -lE 'L[0-9]+' docs/decisions/ADR-*.md` 를 정정 후 재실행해 **en dash 잔여 ADR 파일 수** 와 **`L` 잔존 ADR 파일 수** 를 절 안에 갱신 기록하고, `§ 12.82` 한계 1 의 값 (en dash **2** · `L` **20**) 과 대조. en dash 축이 (정정 · 면제 · 범위 밖을 합쳐) 마감됐는지 **명시적으로 선언** 하고, 미마감이면 잔여를 batch 7 후보로 파생 영향에 넘긴다.
- [x] **AC 7 — 자기 준수 · 범위 검산 1 구.** 신규 추가분 자기 준수 grep (`grep -nE '[0-9]+ *– *[0-9]+|L[0-9]+'` 를 신설 절 · task 파일 대상으로) hit 수를 적고 전량이 **원 표기 인용 (`R6` 예외)** 임을 확인. `wc -l docs/use-cases/REQ-COVERAGE-AUDIT.md` 전후 값으로 신설 절이 **≤ 60 행** 임을, `git diff --stat` 으로 **≤ 300 LOC · ≤ 5 파일** 임을, `git status --short` 로 `README.md` · `CLAUDE.md` · `docs/requirements.md` · `docs/PLAN.md` · `docs/architecture/` · 다른 `docs/decisions/*` · `.claude/agents/` · `docs/LOOP.md` · `src/` · `prisma/` 변경 **0** 임을 검산. audit 파일 fence **짝수** · 신설 표 **6 컬럼 균일** · heading 순번 `12.82` → `12.83` **연속** 도 확인. doc-only 라 `pnpm test` 불요 (`CLAUDE.md` §3.2 direct doc-only 면제).
- [x] **AC 8 — 진척 · 한계 · 파생 영향.** 절 말미에 진척 1 문단 (batch 6 결과 수치), 한계 **4 개 이상** (좌표 값 정확성 미검증 승계 · census 행 단위 하한 · 회색지대 조문 부재 · FU14 anchor 흡수 관계 등), 파생 영향 **목록만** (다음 1 순위 = `L` 잔존 비-ADR 또는 ADR 묶음 batch 7 · `R5` 예시 갱신 이월 · `R8` 조문화 우선순위) 을 박제. **파생 항목은 본 slice 에서 착수 금지**.

## Out of Scope

- 본 3 ADR **밖** 의 파일 편집 — `L` 잔존 나머지 ADR (약 19 파일) · 비-ADR (`directory.md` · `integrator.md` · `reviewer.md` · `race-patterns.md` · `p3-*.md`) 정규화는 batch 7 이후.
- `§ 12.76` **조문 본문 편집** — `R5` 존치 예시 목록의 stale (`ADR-0005`) 갱신은 `§ 12.79` 파생 (3) 이월 유지 (append-only 준수 방식과 함께 별도 slice).
- **`R8` 조문화** (회색지대 4 ~ 5 종) · `R2` · `R3` 병합 재설계 · FU14 anchor 좌표계 이행 — 관계 언급만, 착수 금지.
- 좌표가 가리키는 **값 자체의 정확성 재검증** (`§ 12.74` 판정 승계 — 본 slice 는 표기 형식만).
- ADR 의 `## Decision` · `## Consequences` · `## Alternatives` 실질 · frontmatter `status` · `date` 변경, 링크 URL 변경.
- `docs/STATE.json` · `docs/progress/journal-*.md` 편집 (driver bookkeeping 몫) · `src/` · `prisma/` · `.github/workflows/` 일체.

## Suggested Sub-agents

`implementer` 단독 (doc-only · 최대 3 파일 in-place 정정 + audit 절 신설 1). 코드 변경 0 이므로 `tester` 불요 ([CLAUDE.md](../../CLAUDE.md) §3.2 direct doc-only 면제).

## Follow-ups

- **batch 7 편성 후보** — `L` 잔존 ADR 중 hit 수가 큰 군 (`ADR-0024` 21 행 / 26 좌표 · `ADR-0039` 15 행 / 22 좌표 · `ADR-0022` 12 행 / 14 좌표) 은 단독으로도 cap 압박이 있어 **1 ~ 2 파일 편성** 이 유력. 소규모 군 (`ADR-0004` · `ADR-0015` · `ADR-0047` 등 1 ~ 3 행) 은 묶음 처리 가능.
- **`R5` 존치 조건의 실효성 재검토** — 본 slice AC 3 ③ 이 "존치 예시 목록은 예시적" 으로 결론내면 조건 자체가 사실상 사문화되므로, `§ 12.76 R5` 개정 (조건 삭제 또는 목록 갱신) 을 별도 slice 후보로 승격할지 판단.
- **범위 밖 문서 대상 좌표 (`docs/PLAN.md`) 판정의 조문화** — `§ 12.82` AC 3 ③ + 본 slice AC 3 ③ 으로 **선례 2 건** 확보 시 `R8` 후보 묶음에 정식 편입.
- **수량 범위 vs 좌표 범위 판별의 조문 부재** — AC 3 ① 이 `ADR-0001` 을 범위 밖으로 판정하면 "숫자 + 단위어 (`명` · `개` · `건`) 는 좌표가 아니다" 가 선례로만 남는다. census 오탐 방지를 위해 조문화 후보에 추가.
