---
id: T-1474
title: pointer 정정 batch 착수 전 방침 확정 — `§ 12.15` append-only ↔ in-place 정정 관계 + ADR 각주 append 의 commit mode 판정 (§3.1 미규정 구간) + 대상 14 건 목록 · slice 분해안 확정 + audit §12.72
phase: P5
status: DONE
commitMode: direct
coversReq: [REQ-057]
estimatedDiff: 190
estimatedFiles: 2
created: 2026-08-04
independentStream: uc-doc-audit-resync
dependsOn: [T-1473]
touchesFiles:
  - docs/use-cases/REQ-COVERAGE-AUDIT.md
  - docs/tasks/T-1474-pointer-correction-batch-policy-and-14-target-list.md
plannerNote: "uc-doc-audit-resync 86 번째 slice — §12.71 AC 5 (1) 1 순위 (A) 집행. 판정 재고 0 · 정정 재고 14 의 착수 게이트. doc-only 1.6x"
---

# T-1474 — pointer 정정 batch 방침 확정 + 대상 14 건 목록 · 분해안 확정

## Why

[T-1473](T-1473-pointer-axis-final-batch-latter-33-plus-prose-7.md) 이 pointer 축 **140 지점 전량** 을 마감하며 ([REQ-COVERAGE-AUDIT.md](../use-cases/REQ-COVERAGE-AUDIT.md) `§ 12.71` — **140 : 172 : 126 : 14 : 0**, 참율 **90.0%** · 거짓 0 이 4 batch 연속) **"판정" 재고를 0** 으로 만든 반면 **"정정" 재고는 14 건으로 확정** 됐다. `§ 12.71` AC 5 파생 영향 **(1)** 은 다음 slice 1 순위로 **(A) pointer 정정 batch** 를 지목하면서, 착수 **전에** 두 가지를 먼저 확정해야 한다고 못박았다 — ① [`§ 12.15`](../use-cases/REQ-COVERAGE-AUDIT.md) 의 **append-only 처리 방침** 과 **in-place 정정** 의 관계, ② **ADR 각주 append 의 commit mode 판정** ([CLAUDE.md](../../CLAUDE.md) §3.1 표의 미규정 구간). 본 slice 는 그 게이트를 여는 **방침 확정 slice** 이며, 정정 자체는 착수하지 않는다.

본 slice 가 앞선 87 개 slice 와 다른 점은 **측정이 아니라 규칙 결정** 이라는 것이다. 그래서 산출물의 성질도 다르다 — 판정표 대신 **(a) 대상 14 건의 파일별 목록 · 정정 유형 분류**, **(b) 처리 방식 3 분류 (in-place 정정 / 각주 append / 무처리) 의 판정 규칙**, **(c) commit mode 판정 결론**, **(d) cap (300 LOC · 5 파일) 안에 들어가는 slice 분해안** 이다. 이 4 개가 확정돼야 다음 slice 부터 기계적으로 정정을 집행할 수 있고, 확정 없이 착수하면 `§ 12.15` 가 세운 append-only 원칙과 충돌하는 편집이 main 에 들어간다.

**어떤 판정 대상 파일도 편집하지 않는다** — 14 건이 걸린 `docs/decisions/ADR-*.md` · `CLAUDE.md` · `docs/requirements.md` · `docs/architecture/*.md` · `.claude/agents/*.md` 는 본 slice 에서 **무편집** 이고, 결과는 audit 절 `§ 12.72` 에만 박제한다 (`§ 12.15` append-only + `§ 12.68` ~ `§ 12.71` 선례 승계).

**context 위험 경고 (본 slice 고유)** — `§ 12.68` (6263 ~ 6326) · `§ 12.69` (6327 ~ 6407) · `§ 12.71` (6480 ~ 6564) 판정표를 **통째로 열지 않는다**. 14 건은 전부 `부분참` 행이므로 **`grep -n '부분참'` + 행 범위 필터** 로 해당 행만 추출한다 (`§7` context 절약).

planner 사전 census — **아래는 전부 가설이며 전제가 아니다** (planner 기대가 실측에 반증된 선례가 **34** 회 있다). executor 는 AC 1 에서 전부 재측정하고 **기대와 다르면 실측대로 뒤집는다**. ① 부분참 분포 = `§ 12.68` **2** + `§ 12.69` **11** + `§ 12.70` **0** + `§ 12.71` **1** = **14**. ② 파일 분포는 ADR 군 (`§ 12.69`) 에 몰릴 것이며 `directory.md` 197 이 1 건. ③ 14 건 **전량이 범위 표기** (`§ 12.71` AC 3 (a) 의 "어긋남 14 건은 전량 범위 표기 · 단일 좌표 113 지점 어긋남 0"). ④ 따라서 정정 유형은 대부분 **범위 끝 좌표 재정렬** 이며 `§ 12.71` (b) 가 도출한 **경계 정렬 지표** 가 그대로 정정 규칙이 된다. ⑤ `§ 3.1` 표는 "새 `docs/decisions/*` **추가**" 만 `pr` 로 규정하고 **기존 ADR 본문 1 줄 수정** 은 status 갱신 (rule 4) 외에 미규정이다.

[PLAN.md](../PLAN.md) 의 미완 bullet (106 · 108 · 109 · 140 · 151) 은 owner 게이트 · 외부 credential · 새 dependency 게이트라 planner 단독 진행 불가이므로, 본 doc stream 이 현 시점 우선순위 최상위다.

## Required Reading

- `docs/use-cases/REQ-COVERAGE-AUDIT.md` — **6578 행 (실측 확인)**. 다음 좌표만 연다.
  - **`### 12.15`** (**1002 행**) — append-only 처리 방침 **정본**. 본 slice 의 핵심 입력이므로 절 전체를 읽되 인용은 규칙 문장 **2 ~ 3 구** 로 제한한다.
  - **`### 12.68`** (**6263 행**) · **`### 12.69`** (**6327 행**) · **`### 12.71`** (**6480 행**) — **판정표 통째 열람 금지**. `grep -n '부분참' docs/use-cases/REQ-COVERAGE-AUDIT.md` 결과를 위 행 범위로 필터해 **해당 행만** 확보한다.
  - **`## 11. References`** 직전 좌표 (**6565 행** — `§ 12.72` 삽입 위치 경계, AC 1 에서 재실측).
  - **`§ 12.44` ~ `§ 12.67` · `§ 12.70` 본문은 열지 않는다**.
- `CLAUDE.md` **§3.1** (commit mode 표 + 판정 규칙 4 개) — **무편집, 판정 근거 원본**. `grep -n` 으로 §3.1 구간만 확보한다. **§3 (task 크기 상한) · §7 (context 절약) · §9 (secret 금지) · §12 (언어 정책) 도 무편집 준수**.
- 정정 대상 파일들 — **무편집. 본 slice 에서는 열지 않고 목록의 좌표만 승계한다** (실 행 대조는 이미 `§ 12.68` · `§ 12.69` · `§ 12.71` 이 마쳤다). 파일 행 수만 `wc -l` 로 실측한다.
- `docs/PLAN.md` — **175 행. 무편집**. 미완 bullet 좌표 확인용 `grep` 만.

## Acceptance Criteria

- [x] **AC 1 — 대상 14 건 목록 실측 (날조 금지)**: 편집 전에 `grep -n '부분참' docs/use-cases/REQ-COVERAGE-AUDIT.md` 를 실행하고 결과를 `§ 12.68` (6263 ~ 6326) · `§ 12.69` (6327 ~ 6407) · `§ 12.70` (6408 ~ 6479) · `§ 12.71` (6480 ~ 6564) 구간으로 **분류 계수** 한다. 사용한 명령을 그대로 적는다. planner 기대 (**2 + 11 + 0 + 1 = 14**) 와 다르면 **실측값을 채택** 하고 차이 사유를 1 구로 적는다 (판정표 밖의 산문에도 `부분참` 어휘가 나오므로 **판정표 행만** 계수하고 그 필터 기준을 명시한다). 각 건에서 **대상 파일 · 파일 행 · 주장 좌표 · 실 대응 좌표** 4 값을 승계 추출하고, `wc -l` 로 대상 파일들의 현재 행 수를 실측한다.
- [x] **AC 2 — `§ 12.15` append-only ↔ in-place 정정 관계 확정**: `§ 12.15` 의 규칙 문장을 **2 ~ 3 구 인용** 하고, 그 방침이 (a) **audit 문서 자신** 의 절 추가에만 걸리는지 (b) **판정 대상 문서** 의 편집까지 규율하는지를 판별해 결론을 1 ~ 2 구로 확정한다. 그 위에서 14 건의 처리 방식을 **3 분류** 로 판정한다 — **(I) in-place 정정** (좌표 값만 고치는 무손실 수정) / **(II) 각주 · 병기 append** (원 표기를 남겨야 하는 경우) / **(III) 무처리** (정정이 오히려 의미를 훼손하거나 대상이 시점 기록인 경우). 각 분류의 **판정 규칙을 먼저 문장으로** 세운 뒤 14 건을 배정하고 분류별 건수를 보고한다.
- [x] **AC 3 — commit mode 판정 (§3.1 미규정 구간)**: `CLAUDE.md` §3.1 표와 판정 규칙 4 개를 근거로 **기존 `docs/decisions/ADR-*.md` 본문의 pointer 좌표 1 줄 수정 · 각주 append** 가 `direct` 인지 `pr` 인지 결론을 낸다. 근거는 §3.1 rule 4 (status 갱신 = direct) 와 "새 ADR 추가 = pr" 의 **경계 해석** 이어야 하고, "동작 변경을 일으키는가" 기준을 1 구로 적용한다. 같은 판정을 `CLAUDE.md` · `docs/requirements.md` · `docs/architecture/*` · `.claude/agents/*` 대상 건에도 각각 적용해 **파일군별 commit mode 표** (1 표, 행 ≤ 6) 를 만든다. **`CLAUDE.md` §3.1 본문 편집은 하지 않는다** — 명문화 필요 여부만 Follow-ups 후보로 1 구 기록한다.
- [x] **AC 4 — 정정 batch slice 분해안 확정**: AC 2 · AC 3 결과를 합쳐 **몇 개 slice 로 · 각 slice 가 어느 파일 몇 건을** 처리할지 분해안을 표로 확정한다. 각 slice 는 **cap (≤ 300 LOC · ≤ 5 파일)** 을 만족해야 하며, **audit 절 1 개 + 정정 대상 파일 N 개 + task 파일 1 개** 로 파일 수를 검산한다 (`§ 12.71` 의 행당 실측 비용 방식 승계). commit mode 가 다른 건은 **같은 slice 에 섞지 않는다** ([CLAUDE.md](../../CLAUDE.md) §3.1 rule 3 · §2.5 (e)). 분해안의 **1 순위 slice** 를 지목하고 그 예상 규모를 수치로 적는다.
- [x] **AC 5 — audit 절 신설**: [REQ-COVERAGE-AUDIT.md](../use-cases/REQ-COVERAGE-AUDIT.md) 에 **`### 12.72`** 를 `## 11. References` **직전** 에 신설한다. 구성: 위치 · 계보 (`§ 12.71` AC 5 (1) (A) 승계 + 무편집 사유) → AC 1 실측 (14 건 목록표) → AC 2 3 분류 규칙 · 배정 → AC 3 commit mode 표 → AC 4 분해안 표 → 진척 (**정정 축 = 대상 14 건 중 착수 0 · 방침 확정 완료**) → 한계 → 파생 영향 (목록만). **절 ≤ 90 행**. **분할 판단 의무** — AC 1 직후 예상 절 길이를 산출해 (목록표 14 + 헤더 6 + 표 2 개 밖 구조 ~35 ≈ **60 행** 예상) 90 행 초과가 예상되면 **AC 4 분해안을 별도 slice 로 이월** 하고 근거를 1 ~ 2 구로 박제한다.
- [x] **AC 6 — 검증 명령**: `wc -l docs/use-cases/REQ-COVERAGE-AUDIT.md` 로 증분을 보고하고 `git diff --stat` 이 **≤ 2 파일 · ≤ 300 LOC** 임을 확인한다. `git status --short` 로 **`docs/decisions/` · `CLAUDE.md` · `docs/requirements.md` · `docs/architecture/` · `.claude/agents/` · `README.md` 가 변경 목록에 없음** 을 명시적으로 검산한다. doc-only 변경이므로 `pnpm test` 는 불요 ([CLAUDE.md](../../CLAUDE.md) §3.2 direct doc-only 면제) — 단 markdown 문법 무손상을 audit 파일의 ` ``` ` fence **짝수 개** 와 신설 표들의 컬럼 수 일치로 확인한다.

## Out of Scope

- **pointer 정정 실집행 금지** — 14 건 중 **단 1 건도 고치지 않는다**. 본 slice 는 방침 · 목록 · 분해안 확정까지이며, 실제 좌표 수정은 AC 4 가 지목한 후속 slice 소관이다.
- **`docs/decisions/` · `CLAUDE.md` · `docs/requirements.md` · `docs/architecture/` · `.claude/agents/` · `README.md` 편집 금지** — 전부 무편집. §3.1 명문화 제안도 Follow-ups 기록까지만.
- **pointer 재판정 금지** — `§ 12.68` ~ `§ 12.71` 이 마감한 140 지점의 참 / 부분참 / 거짓 판정을 다시 다투지 않는다. 본 slice 는 **부분참 14 건을 그대로 승계** 해 처리 방식만 정한다.
- **판정표 통째 열람 금지** — `grep` 필터 추출분만 (본 task Why 의 context 경고).
- **범위 표기 규약 신설 착수 금지** (`§ 12.71` 파생 (5)) — AC 2 의 정정 규칙이 규약의 씨앗이 되더라도 별도 문서 신설은 하지 않는다.
- **anchor 좌표계 이행 (FU14) 착수 금지** — `§ 12.71` 이 시급성 "낮음 유지" 로 결론냈다.
- **새 REQ 신설 · REQ 정의 타당성 검증 금지**.
- **ADR 신설 · 새 dependency 도입 금지** ([CLAUDE.md](../../CLAUDE.md) §5 게이트).
- **secret · token · API key 실값 인용 금지** (§9).
- `docs/STATE.json` · journal write 금지 (driver 소관).

## Suggested Sub-agents

`implementer` 단독 (doc-only). 코드 변경 0 이므로 `tester` 불요 ([CLAUDE.md](../../CLAUDE.md) §3.2 direct doc-only 면제).

## Follow-ups

1. **S1 실집행 (다음 slice 1 순위)** — `ADR-0003` 8 건 · `ADR-0001` 2 건 · `ADR-0002` 1 건 = 편집 **8 행**, 파일 5 (ADR 3 + audit 절 1 + task 1), diff ≈ 75 LOC, `commitMode: direct`. 규칙 C 병기 2 건 (#7 · #12, `33–41`) 의 화법 (각주 vs 인라인 괄호) 을 여기서 처음 정한다.
2. **S2 실집행** — `requirements.md` 2 건 (20 · 39 행) · `directory.md` 1 건 (197 행) = 편집 3 행, 파일 4, diff ≈ 55 LOC, `direct`.
3. **`CLAUDE.md` §3.1 rule 5 명문화 후보** — "기존 `docs/decisions/*` · `docs/architecture/*` 본문의 **비-결정 수정** (pointer 좌표 · typo) = `direct`". `§ 12.72` AC 3 이 판정 선례를 세웠으므로 시급성 낮음 (본 slice 는 `CLAUDE.md` 무편집 유지).
4. **정정 slice 의 좌표 재확인 의무** — `§ 12.72` 한계 1 승계: 실 대응 좌표는 판정표 승계값이라 S1 · S2 는 편집 직전 대상 행 · README 행을 **1 회 재대조** 한 뒤 고친다.

## 완료 요약 (2026-08-05)

`§ 12.72` 신설 (**84 행 추가**, 6578 → **6662** 행). 부분참 **14** 건 실측 (raw grep hit 37 → 판정표 행 필터 14; 구간 분포 2 + 11 + 0 + 1 로 planner 기대와 **일치**) · 파일 분포 5 파일 (ADR 군 11 · `requirements.md` 2 · `directory.md` 1, 편집 행은 11) · 3 분류 배정 **(I) 12 · (II) 2 · (III) 0** · commit mode **전량 `direct`** · 분해안 **2 slice (S1 1 순위)** 확정. 판정 대상 파일은 **전부 무편집** (`git status` 검산: `docs/decisions/` · `CLAUDE.md` · `docs/requirements.md` · `docs/architecture/` · `.claude/agents/` · `README.md` 변경 없음). fence 166 (짝수) · 표 컬럼 일치 확인.
