---
id: T-1407
title: REQ-COVERAGE-AUDIT §12.5 S2 실판정 — infrastructure 7 row (REQ-001 · 017 · 056 ~ 060) 재판정을 §12.7 로 박제
phase: P5
status: PENDING
commitMode: direct
coversReq: [REQ-001]
estimatedDiff: 210
estimatedFiles: 2
created: 2026-08-03
independentStream: uc-doc-audit-resync
dependsOn: [T-1406]
touchesFiles:
  - docs/use-cases/REQ-COVERAGE-AUDIT.md
  - docs/tasks/T-1407-req-coverage-s2-infrastructure-rejudge.md
plannerNote: "uc-doc-audit-resync 19 번째 slice — §12.5 S2 (infrastructure 7) 실판정, §12.6 선례 구조 승계해 §12.7 append, direct doc-only"
---

# T-1407 — S2 실판정: infrastructure 7 row 재판정

## Why

[T-1406](T-1406-req-coverage-s1-crosscutting-rejudge.md) 이 `docs/use-cases/REQ-COVERAGE-AUDIT.md` 에 **§12.6 (326 ~ 409 행)** 을 append 해 §12.5 가 정의한 **S1 (cross-cutting 4 row)** 실판정을 집행했다 (결과 **유지 3 / 기록만 1 / 변경 0** → cascade 미발동, 불변 6 값 전건 유지). 본 slice 는 §12.5 분할안의 **두 번째 batch = S2** 로, 표가 S2 에 배정한 **infrastructure 전반 7 row (REQ-001 · 017 · 056 ~ 060 — §3 35 · 51 · 90 · 91 · 92 · 93 · 94 행)** 를 §12.2 근거 3 종 + 2/3 임계로 실판정하고 그 기록을 **§12.7** 로 append 한다.

S1 · S2 는 §12.5 324 행이 명시한 대로 서로 독립이라 순서가 무관하고 **S3 만 반드시 마지막** (L212 `유일 잔여 축` closure 가 앞 두 slice 결과를 인용) 이다. 본 slice 는 L212 문구를 닫지 않는다.

**cap 검산 (분할 불요 판정)** — §12.5 322 행이 S2 를 `100 ~ 130 LOC` 로 산정했고, S1 실적은 audit 문서 삽입 **85 행 / 4 row** 라 row 당 한계 증분이 약 4 행 (근거 표 1 row + 임계 표 1 row + 부기) 이다. 7 row 면 삽입 ≈ **100 ~ 115 행**, 여기에 REQ-017 stale pointer 판정 부기 +10 행을 더해도 audit 문서 1 + 본 task 파일 1 = **2 파일 · 약 210 LOC** 로 cap (300 LOC / 5 파일) 안이다. 따라서 **S2 를 S2a / S2b 로 재분할하지 않고 §12.5 표의 S2 정의 (7 row 전건) 를 그대로 1 slice 로 집행** 한다 — 재분할하면 §12.5 의 3 slice 분할안과 §12.7 절 번호 대응이 어긋나 후속 S3 가 참조할 분모 (17 = 4 + 7 + 6) 표기가 흔들린다.

## Required Reading

- `docs/use-cases/REQ-COVERAGE-AUDIT.md` **251 ~ 324 행 (§12.1 ~ §12.5)** — 본 slice 의 집행 규약 정본. 특히 **§12.2 (276 ~ 290 행)** 근거 3 종 표 + 2/3 임계 + **290 행 부기 (링크 rot 은 분류 오류가 아니라 cover 위치 셀의 표기 오류 — 임계에서 1 종으로만 계상)**, **§12.3 (292 ~ 305 행)** cascade 6 지점 표 (특히 (a) 의 `표기 오류만이면 cover 위치 · 참고 셀만`), **§12.4 (307 ~ 312 행)** `(a) ~ (d) 원자 · (e) · (f) 분리 허용`, **§12.5 322 행 (S2 행)**.
- `docs/use-cases/REQ-COVERAGE-AUDIT.md` **326 ~ 409 행 (§12.6 = S1 선례)** — **구조를 그대로 승계** 한다: 실측 명령 (축별 묶음) → row 별 근거 3 종 표 → 임계 적용 표 → 주의 지점 명시 판정 → cascade 판정 → 불변 6 값 표 → 종합 + 잔여 → `#### 한계 —` 열거. 표 컬럼 구성과 화법도 동형으로 쓴다 (drift 방지). **read-only — 1 자도 고치지 않는다**.
- `docs/use-cases/REQ-COVERAGE-AUDIT.md` **20 ~ 27 행 (§2 분류 정책)** — 4 enum 정의. **재정의 금지 · 참조만**. 특히 **26 행 `infrastructure` 정의** (`Constraint REQ — UC 영역 밖. ADR / CLAUDE.md / LOOP.md / ci.yml / PLAN.md 의 운영 정책 backlog 에서 cover`) 가 본 slice 판정의 축이다.
- `docs/use-cases/REQ-COVERAGE-AUDIT.md` **35 · 51 · 90 · 91 · 92 · 93 · 94 행 (판정 대상 7 row)** — REQ-001 (README + INDEX) · REQ-017 (`P4 ADR 예정`) · REQ-056 (CLAUDE.md §1 + ci.yml) · REQ-057 (§3) · REQ-058 (§3.2 R-110 + agents) · REQ-059 (§3.2 R-111 + ci.yml) · REQ-060 (§3.2 R-112 + planner). 5 컬럼 셀 값 전체.
- `docs/use-cases/REQ-COVERAGE-AUDIT.md` **115 행 (§4 정합식)** · **121 ~ 127 행 (§5 표)** — cascade (c) · (d) 의 현재 값. **126 행 `infrastructure` 비고 셀이 `REQ-001 / REQ-017 / REQ-056 ~ REQ-066` 13 건** 을 열거하며 본 slice 대상은 그중 **7 건** 임을 대조한다.
- `docs/requirements.md` **20 · 36 · 75 · 76 · 77 · 78 · 79 행** — 근거 (iii) 원문. **kind 컬럼과 지시 원문 컬럼만** 본다. status 컬럼 서술은 행당 수천 자 규모라 **통독 금지** — 필요 시 앞 200 자만 (특히 20 · 36 · 75 행).
- `docs/decisions/ADR-0013-confluence-space-traversal-policy.md` **frontmatter 3 행 (id · status · date) 만** — REQ-017 의 `P4 ADR 예정` pointer 가 stale 인지 판정용. 본문 통독 금지.
- `CLAUDE.md` · `.github/workflows/ci.yml` · `README.md` · `docs/use-cases/INDEX.md` — 근거 (iii) 의 "지목 대상이 실재하며 그 REQ 를 실제로 다루는지" 확인용. **전문 통독 금지** — CLAUDE.md 는 `grep -n "^## 1\.\|^## 3\.\|^### 3.2\|R-110\|R-111\|R-112" CLAUDE.md` 1 회, ci.yml 은 step `name:` 목록 1 회, README · INDEX 는 heading 존재 확인 수준. **전부 read-only**.
- `docs/use-cases/UC-0*.md` — 근거 (i) · (ii) 확인은 `grep -n "REQ-001\|REQ-017\|REQ-056\|REQ-057\|REQ-058\|REQ-059\|REQ-060" docs/use-cases/UC-0*.md` **1 회** 로 갈음한다. **read-only**.

## Acceptance Criteria

- [ ] **삽입 위치·형식 (선행 항목)** — 판정 기록을 `### 12.7 S2 실판정 — infrastructure 7 row (T-1407)` 로 **§12.6 마지막 행 (현 409 행) 뒤, `## 11. References` (현 411 행) 앞** 에 삽입한다. `###` 이므로 `## ` heading count 는 불변이다. 이 위치 제약과 근거 (410 행 이전 행 번호 전건 불변 → §10 의 L212 잔여 축 bullet 참조 · §4 115 행 정합식 참조 보호) 를 완료 기록 첫머리에 2 줄 이내로 박제한다.
- [ ] **(1) row 별 근거 3 종 실측** — REQ-001 · 017 · 056 · 057 · 058 · 059 · 060 **각각** 에 대해 §12.2 표의 근거 (i) UC frontmatter · (ii) UC 본문 §5 / §6 / §8 hit · (iii) `docs/requirements.md` 원문 kind + cover 위치 셀 지목 대상 실재 를 실측하고, §12.6 과 동형의 **row 별 표 (대상 row / (i) / (ii) / (iii) / 어긋남 종수)** 로 적는다. grep 은 **row 별이 아니라 축별로 묶어 총 5 회 이내** 로 제한하고 명령 원문을 박제한다 (context 보호).
- [ ] **(2) 임계 적용 + 분류 판정** — row 마다 어긋남 종수를 세어 §12.2 288 행 임계를 기계적으로 적용한다: **2 종 이상 → 분류 변경**, **1 종 → `기록만` (분류 무수정)**, **0 종 → 무수정**. 각 row 최종 판정을 `유지` / `기록만` / `변경 (X → Y)` 중 하나로 명시하고 **어긋남 종수를 숫자로** 병기한다. 임계 밖 재량 판정 금지 — 갈리면 보수적으로 `유지` 또는 `기록만` 을 택하고 이유를 1 줄 적는다. `requirements.md` 의 status 컬럼 (구현 진척 축) 은 분류 전이 근거로 쓰지 않는다 (§12.6 선례).
- [ ] **(3) REQ-017 stale pointer 명시 판정** — §3 **51 행** cover 위치 셀은 `P4 ADR 예정 (Confluence 탐색 정책)` 인데 `docs/decisions/ADR-0013-confluence-space-traversal-policy.md` 가 실재하고 `docs/requirements.md` 36 행 status 도 `DONE (implemented-on-main — ADR 실재 축 …)` 이다. 이 pointer 가 stale 인지를 **명시적으로 1 개 판정** 으로 적고, stale 로 판정하면 §12.2 290 행 부기 (링크 rot = 분류 오류 아님 · 표기 오류 1 종) 를 적용해 **분류값 `infrastructure` 는 무수정** 임을 못박는다. 그 위에서 §12.3 (a) 의 `표기 오류만이면 cover 위치 · 참고 셀만` 경로로 **51 행 cover 위치 셀만 in-place 치환** 할 수 있다 — 치환하면 **enum 전이가 아니므로 (b) ~ (f) 는 발동하지 않음** 을 1 줄로 명시한다. 치환 여부 (했다 / 안 했다) 와 before → after 값을 반드시 박제한다.
- [ ] **(4) REQ-001 자기참조 축 명시 판정** — §3 **35 행** 의 cover 위치는 `README.md + 본 INDEX.md` 로 **audit 문서 자신이 속한 UC 문서군** 을 지목하는데, §2 26 행 `infrastructure` 정의는 `UC 영역 밖` 을 요건으로 든다. 이 둘이 모순인지, 아니면 REQ-001 이 UC 문서의 **내용** 이 아니라 **문서 존재·형식을 규정하는 meta 지시** 라 양립하는지를 **명시적으로 1 개 판정** 으로 적는다 (§12.6 의 REQ-003 주의 지점 판정과 동형 화법, 2 줄 이내 근거). 근거 3 종 임계를 그대로 적용한다.
- [ ] **(5) cascade 집행 또는 미발동 명시** — 7 row 판정 결과 **enum 변경이 0 건이면** `cascade (a) ~ (f) 발동 대상 없음` 을 한 줄로 박제한다 (T-1400 ~ T-1403 · T-1406 선례 화법). 단 (3) 의 표기-only 셀 치환을 했다면 그것이 **(a) 의 표기 경로일 뿐 enum cascade 가 아님** 을 같은 줄에서 구분 표기한다. **1 건이라도 enum 이 바뀌면** §12.4 원자성 규약대로 **(a) → (b) → (c) → (d) 를 본 slice 안에서 함께** 갱신하고 (e) INDEX.md 110 행 · (f) PLAN.md 36 행 은 건드리지 않은 채 Follow-ups 에 남긴다. 모든 cascade 편집은 **in-place 셀·수치 치환만** 허용 — 행 삽입·삭제 금지. 갱신 지점과 before → after 를 표로 박제한다.
- [ ] **(6) S2 종합 판정 + 잔여** — §12.7 말미에 7 row 판정 분포 (`유지 N / 기록만 N / 변경 N`) 를 한 줄로 요약하고, **후보 17 중 11 완료 (S1 4 + S2 7) · 잔여 6 (S3 = REQ-061 ~ 066)** 임을 명시한다. **L212 잔여 축 문구는 건드리지 않는다** — closure 가 S3 소관임을 1 줄로 못박는다.
- [ ] **불변 검산 6 값** — 편집 후 실측해 §12.6 과 동형의 표로 적는다: (a) `grep -c "^| REQ-" docs/use-cases/REQ-COVERAGE-AUDIT.md` = **66** 불변, (b) `grep -c "^## "` = **12** 불변 (`###` 추가이므로), (c) `grep -n "미검증 축"` 첫 hit = **212** · 총 hit **10** 불변, (d) `grep -c "212 행"` = **9** 불변 (§12.7 본문은 `L212` 회피 표기를 쓴다 — T-1405 · T-1406 선례), (e) `sed -n '115p'` 정합식이 **여전히 115 행** 이며 합 **66**, (f) §5 표 (121 ~ 127 행) count `48 / 4 / 13 / 1` = **66** · 합계 row `**100 %**` 불변. (3) 의 51 행 셀 치환을 했더라도 분류값은 무변이므로 (a) · (f) 는 그대로여야 한다.
- [ ] **hunk 국한 검증 (R-112 대체, doc-only)** — 코드 변경 0 이므로 unit test 대신 `git diff -U0 docs/use-cases/REQ-COVERAGE-AUDIT.md | grep '^@@'` 의 hunk 헤더 전량 + `git diff --numstat` 을 박제한다. 치환이 없으면 hunk 는 **삽입 1 개뿐** (`@@ -409,0 +410,N @@` 형태 — 빈 줄 정렬로 anchor 가 ±1 이동하는 것은 허용, 단 §12.6 과 §11 사이 삽입이라는 사실은 명시) 이고 1 ~ 409 행 hunk **0** · 삭제 열 **0** 이어야 한다. 51 행 셀 치환을 했다면 그 hunk 가 **1:1 치환 (-1 / +1)** 임을 hunk 헤더와 numstat 으로 보이고, 치환한 row 의 **`|` 필드 수가 편집 전후 동일 (5 컬럼 → 파이프 6 개)** 임을 실측해 박제한다 ([T-1370](T-1370-requirements-fork-rebase-dedup-status-rejudge.md) · [T-1375](T-1375-requirements-org-document-contribution-score-status-rejudge.md) 표 파손 사고 재발 방지). `git status --porcelain` 이 위 `touchesFiles` 2 개 외 변경 파일 **0** 임도 적는다.
- [ ] **한계 명시** — 완료 기록에 `#### 한계 —` 절을 두고 최소 4 건을 열거한다: (1) S3 배정 6 row (REQ-061 ~ 066) 미판정, (2) cascade (e) INDEX.md 110 행 · (f) PLAN.md 36 행 미동기 (T-1404 Follow-up 3 소관), (3) 표기 비일관 3 건 (§3 83 행 `(cover)` · 79 행 `(인접)` · UC §10 표 `§5 step N` 편차) 미정정, (4) 근거 (iii) 의 `CLAUDE.md` · `ci.yml` · `README.md` 확인은 heading / step 이름 실재 수준의 정적 실측이라 그 정책이 해당 REQ 를 **충분히** 집행하는지의 질적 평가는 하지 않았다.

## Out of Scope

- **§3 매트릭스에서 REQ-001 · 017 · 056 ~ 060 이외 row 의 어떤 셀 수정** — 금지. S1 4 row 재판정도, S3 배정 6 row (REQ-061 ~ 066) 선행 판정도 하지 않는다.
- **S2 를 §12.5 정의와 다르게 재분할** — 금지. 본 slice 는 §12.5 322 행의 S2 행 (7 row 전건) 을 그대로 1 slice 로 집행한다 (Why 의 cap 검산 참조).
- **L212 (§10 잔여 축 bullet) 문구 수정** — 금지. `유일 잔여 축` closure 는 S3 소관이다.
- **§12.1 ~ §12.6 (251 ~ 409 행) 의 어떤 행 수정** — 금지 (§12.6 S1 판정 기록 포함 — append-only 규약). 본 slice 산출물은 §12.7 append 1 지점 (+ 표기-only 51 행 셀 치환 또는 enum 발동 시 cascade in-place 치환) 뿐이다.
- **§9 · §10 의 어떤 행 수정 · §10 말미 bullet append** — 금지 (§12.3 305 행이 명시한 시점 판정 보존 규약).
- **`docs/use-cases/INDEX.md` 110 행 · `docs/PLAN.md` 36 행 동기화** — 금지 (cascade (e) · (f), T-1404 Follow-up 3 소관).
- **`docs/requirements.md` · `CLAUDE.md` · `README.md` · `.github/workflows/ci.yml` · `docs/decisions/*` · `docs/use-cases/UC-0*.md` · `docs/architecture/*` · `src/` · `web/` 수정** — 전부 read-only. 특히 REQ-017 판정 결과로 `requirements.md` 36 행 서술이나 ADR-0013 을 고치지 않는다.
- **§2 4 enum 재정의 · 새 분류값 신설** — 금지 (§12.2 가 참조만 허용).
- **새 ADR 신설 · `docs/architecture/*` 신규 파일 추가** — 금지 (commitMode 가 pr 로 바뀌어 본 slice 판정과 충돌).
- **References (§11) 항목 추가 · Refs 줄 변경** — 금지.

## Suggested Sub-agents

`implementer` (축별 grep ≤ 5 회 → row 7 건 임계 판정 → REQ-017 · REQ-001 명시 판정 2 건 → §12.7 append → 필요 시 51 행 셀 in-place 치환 → 불변 6 값 · hunk · 파이프 필드 수 검산) → 별도 tester 불요 (direct doc-only, R-110 면제 — 코드 변경 0). 단 실측 grep 명령과 hunk / numstat 출력은 반드시 완료 기록에 박제한다.

## Follow-ups

1. **S3 실판정 slice (마지막)** — infrastructure 후반 6 (REQ-061 ~ 066) 재판정을 §12.8 로 append 하고, S1 ~ S3 종합 판정을 요약한 뒤 §10 잔여 축 bullet (L212) 의 `유일 잔여 축` 문구를 in-place 1 줄 교체로 닫는다 (T-1404 선례와 동형).
2. **cascade (e) `docs/use-cases/INDEX.md` 110 행 · (f) `docs/PLAN.md` 36 행 동기** — S1 · S2 모두 enum 변경 0 이면 수치 동기는 불요이나 **정합 확인 자체가 미수행** 이다. S3 종료 후 1 slice 로 확인 (T-1404 Follow-up 3 과 통합 가능).
3. **cascade 7 번째 지점의 §12.3 표 반영** — §4 117 행 blockquote 가 (c) `15` 항의 부속임을 T-1406 이 §12.6 본문에 기록했으나 §12.3 표에는 넣지 못했다 (append-only 행 번호 invariant). S3 이후 행 번호 제약이 풀리는 시점의 정리 후보.
