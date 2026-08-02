---
id: T-1408
title: REQ-COVERAGE-AUDIT §12.5 S3 실판정 — infrastructure 후반 6 row (REQ-061 ~ 066) 재판정 + S1 ~ S3 종합 + L212 잔여 축 closure
phase: P5
status: PENDING
commitMode: direct
coversReq: [REQ-001]
estimatedDiff: 215
estimatedFiles: 2
created: 2026-08-03
independentStream: uc-doc-audit-resync
dependsOn: [T-1407]
touchesFiles:
  - docs/use-cases/REQ-COVERAGE-AUDIT.md
  - docs/tasks/T-1408-req-coverage-s3-infrastructure-rejudge-l212-closure.md
plannerNote: "uc-doc-audit-resync 20 번째 slice — §12.5 S3 (infrastructure 후반 6) 실판정 + 17 row 종합 + L212 closure, §12.8 append, direct doc-only"
---

# T-1408 — S3 실판정: infrastructure 후반 6 row 재판정 + L212 잔여 축 closure

## Why

[T-1406](T-1406-req-coverage-s1-crosscutting-rejudge.md) 이 **§12.6 (326 ~ 409 행)** 으로 S1 (cross-cutting 4 row — 유지 3 / 기록만 1 / 변경 0) 을, [T-1407](T-1407-req-coverage-s2-infrastructure-rejudge.md) 이 **§12.7 (411 ~ 528 행)** 으로 S2 (infrastructure 전반 7 row — 유지 5 / 기록만 2 / 변경 0, §3 51 행 stale pointer 표기-only 치환 1 건) 를 집행했다. 본 slice 는 §12.5 분할안의 **마지막 batch = S3** 로, 표가 S3 에 배정한 **infrastructure 후반 6 row (REQ-061 ~ 066 — §3 95 · 96 · 97 · 98 · 99 · 100 행)** 를 §12.2 근거 3 종 + 2/3 임계로 실판정해 **§12.8** 로 append 한다.

S3 는 §12.5 **324 행** 이 못박은 대로 **반드시 마지막** 이다 — 본 slice 만이 (1) 후보 17 row **전건 (4 + 7 + 6)** 의 종합 판정을 요약할 수 있고, (2) §10 잔여 축 bullet (**L212**) 의 `유일 잔여 축` 문구를 닫을 수 있다. 이 closure 로 L212 가 열거한 **5 축 전건이 해소** 되어 T-1393 이 남긴 미검증 축 목록이 종결된다.

**cap 검산 (분할 불요 판정)** — §12.5 322 행이 S3 를 `110 ~ 140 LOC` 로 산정했고, S2 실적은 audit 문서 삽입 **118 행 / 7 row** 라 row 당 한계 증분이 약 4 행이다. 6 row 면 삽입 ≈ **95 ~ 110 행**, 여기에 S1 ~ S3 종합 절 (+10 행) 과 L212 closure 판정 부기 (+10 행) 를 더해도 audit 문서 1 + 본 task 파일 1 = **2 파일 · 약 215 LOC** 로 cap (300 LOC / 5 파일) 안이다. **재분할하지 않는다** — 재분할하면 §12.5 의 3 slice 분할안과 분모 `17 = 4 + 7 + 6` 표기가 흔들리고, closure 를 담당할 slice 가 모호해진다.

## Required Reading

- `docs/use-cases/REQ-COVERAGE-AUDIT.md` **251 ~ 324 행 (§12.1 ~ §12.5)** — 본 slice 의 집행 규약 정본. 특히 **§12.2 (276 ~ 290 행)** 근거 3 종 표 + 2/3 임계 + **290 행 부기 (링크 rot 은 분류 오류가 아니라 cover 위치 셀의 표기 오류 — 임계에서 1 종으로만 계상)**, **§12.3 (292 ~ 305 행)** cascade 6 지점 표, **§12.4 (307 ~ 312 행)** `(a) ~ (d) 원자 · (e) · (f) 분리 허용`, **§12.5 322 · 324 행 (S3 행 + `S3 는 반드시 마지막` 규약)**.
- `docs/use-cases/REQ-COVERAGE-AUDIT.md` **411 ~ 528 행 (§12.7 = S2 선례)** — **구조를 그대로 승계** 한다: 실측 명령 (축별 묶음) → row 별 근거 3 종 표 → 임계 적용 + 최종 판정 표 → 주의 지점 명시 판정 → cascade 판정 → 불변 검산 표 → hunk 국한 검증 → 종합 + 잔여 → `#### 한계 —` 열거. 표 컬럼 구성과 화법도 동형으로 쓴다 (drift 방지). **read-only — 1 자도 고치지 않는다**. §12.6 (326 ~ 409 행) 은 S1 판정 분포 확인 목적으로 **398 ~ 403 행만** 본다.
- `docs/use-cases/REQ-COVERAGE-AUDIT.md` **20 ~ 27 행 (§2 분류 정책)** — 4 enum 정의. **재정의 금지 · 참조만**. 특히 **26 행 `infrastructure` 정의** (`Constraint REQ — UC 영역 밖. ADR / CLAUDE.md / LOOP.md / ci.yml / PLAN.md 의 운영 정책 backlog 에서 cover`) 가 본 slice 판정의 축이다.
- `docs/use-cases/REQ-COVERAGE-AUDIT.md` **95 ~ 100 행 (판정 대상 6 row)** — REQ-061 (`CLAUDE.md §3.2 R-113 + T-0009/T-0010`) · REQ-062 (`§3.2 R-114 + LOOP §1 [5]`) · REQ-063 (`integrator.md → reviewer.md`) · REQ-064 (`§3.3 + integrator`) · REQ-065 (`reviewer.md`) · REQ-066 (`§3.1`). 5 컬럼 셀 값 전체.
- `docs/use-cases/REQ-COVERAGE-AUDIT.md` **212 행 (§10 잔여 축 bullet)** — closure 대상 1 행. 5 축 열거 문구와 순서, 각 축 뒤 해소 pointer (213 · 217 · 221 · 225 · 228 ~ 249 행) 를 **원문 그대로 보존** 해야 하므로 편집 전 전문을 정확히 확보한다.
- `docs/use-cases/REQ-COVERAGE-AUDIT.md` **115 행 (§4 정합식)** · **121 ~ 127 행 (§5 표)** — cascade (c) · (d) 의 현재 값. **125 행 `infrastructure` 비고 셀 13 건** 중 본 slice 대상이 마지막 6 건임을 대조한다.
- `docs/requirements.md` **80 ~ 85 행** — 근거 (iii) 원문. **kind 컬럼과 지시 원문 컬럼만** 본다. status 컬럼 서술은 **통독 금지** (앞 200 자 이내).
- `CLAUDE.md` — 근거 (iii) 지목 대상 실재 확인용. **전문 통독 금지** — `grep -n "^### 3.1\|^### 3.2\|^### 3.3\|R-113\|R-114" CLAUDE.md` **1 회** 로 갈음.
- `.claude/agents/reviewer.md` · `.claude/agents/integrator.md` — heading 목록 수준만 (`grep -n "^## " ` 1 회). **본문 통독 금지**.
- `docs/LOOP.md` **§1 [5] 존재 확인 1 회** · `docs/tasks/T-0009-*.md` · `docs/tasks/T-0010-*.md` **frontmatter status 행만** — REQ-061 · REQ-062 의 pointer 실재 판정용.
- `docs/use-cases/UC-0*.md` — 근거 (i) · (ii) 확인은 `grep -n "REQ-061\|REQ-062\|REQ-063\|REQ-064\|REQ-065\|REQ-066" docs/use-cases/UC-0*.md` **1 회** 로 갈음한다. **read-only**.

## Acceptance Criteria

- [ ] **삽입 위치·형식 (선행 항목)** — 판정 기록을 `### 12.8 S3 실판정 — infrastructure 후반 6 row (T-1408)` 로 **§12.7 마지막 행 (현 528 행) 뒤, `## 11. References` (현 529 행) 앞** 에 삽입한다. `###` 이므로 `## ` heading count 는 불변이다. 본 slice 의 **유일한 528 행 이전 편집은 L212 1:1 치환뿐** 이며 그것이 행 수 불변 (-1 / +1) 이라 213 행 이하 전건의 행 번호가 보존됨을 완료 기록 첫머리에 2 줄 이내로 박제한다.
- [ ] **(1) row 별 근거 3 종 실측** — REQ-061 · 062 · 063 · 064 · 065 · 066 **각각** 에 대해 §12.2 표의 근거 (i) UC frontmatter · (ii) UC 본문 §5 / §6 / §8 hit · (iii) `docs/requirements.md` 원문 kind + cover 위치 셀 지목 대상 실재 를 실측하고, §12.7 442 ~ 452 행과 동형의 **row 별 표 (대상 row / (i) / (ii) / (iii) / 어긋남 종수)** 로 적는다. grep 은 **row 별이 아니라 축별로 묶어 총 5 회 이내** 로 제한하고 명령 원문을 박제한다 (context 보호).
- [ ] **(2) 임계 적용 + 분류 판정** — row 마다 어긋남 종수를 세어 §12.2 288 행 임계를 기계적으로 적용한다: **2 종 이상 → 분류 변경**, **1 종 → `기록만` (분류 무수정)**, **0 종 → 무수정**. 각 row 최종 판정을 `유지` / `기록만` / `변경 (X → Y)` 중 하나로 명시하고 **어긋남 종수를 숫자로** 병기한다. 임계 밖 재량 판정 금지 — 갈리면 보수적으로 `유지` 또는 `기록만` 을 택하고 이유를 1 줄 적는다. `requirements.md` 의 status 컬럼 (구현 진척 축) 은 분류 전이 근거로 쓰지 않는다 (§12.6 · §12.7 선례).
- [ ] **(3) task-ID pointer 명시 판정 (REQ-061)** — §3 **95 행** cover 위치 셀은 `CLAUDE.md §3.2 R-113 + T-0009/T-0010` 으로, 다른 infrastructure row 와 달리 **정책 문서가 아니라 task ID 를 지목** 한다. 이 pointer 형식이 §2 26 행 `infrastructure` 정의 (`ADR / CLAUDE.md / LOOP.md / ci.yml / PLAN.md 의 운영 정책 backlog`) 를 만족하는지 — 즉 완료된 task 를 지목하는 것이 근거 (iii) 의 "지목 대상 실재" 를 충족하는지 — 를 **명시적으로 1 개 판정** 으로 적는다 (2 줄 이내 근거). stale 로 판정되면 §12.2 290 행 부기를 적용해 **분류값 `infrastructure` 는 무수정** 임을 못박고, §12.3 (a) 의 표기 경로로 셀을 치환할지 여부와 before → after 를 박제한다 (치환 안 함도 명시적 선택으로 기록).
- [ ] **(4) agent spec pointer 명시 판정 (REQ-063 · 065)** — §3 **97 · 99 행** 은 `.claude/agents/*.md` 를 지목한다. `.claude/` 는 §2 26 행 열거 (`ADR / CLAUDE.md / LOOP.md / ci.yml / PLAN.md`) 에 문자 그대로는 없다. 열거가 **예시** 인지 **폐쇄 목록** 인지를 판정해 두 row 의 근거 (iii) 충족 여부를 **명시적으로 1 개 판정** 으로 적는다 (§12.7 483 ~ 485 행의 REQ-001 자기참조 판정과 동형 화법). §2 를 재정의하지 않고 해석 판정만 남긴다.
- [ ] **(5) cascade 집행 또는 미발동 명시** — 6 row 판정 결과 **enum 변경이 0 건이면** `cascade (a) ~ (f) 발동 대상 없음` 을 한 줄로 박제한다 (T-1406 · T-1407 선례 화법). 표기-only 셀 치환을 했다면 그것이 **(a) 의 표기 경로일 뿐 enum cascade 가 아님** 을 같은 줄에서 구분 표기한다. **1 건이라도 enum 이 바뀌면** §12.4 원자성 규약대로 **(a) → (b) → (c) → (d) 를 본 slice 안에서 함께** 갱신하고 (e) INDEX.md 110 행 · (f) PLAN.md 36 행 은 건드리지 않은 채 Follow-ups 에 남긴다. 모든 cascade 편집은 **in-place 셀·수치 치환만** 허용 — 행 삽입·삭제 금지. 갱신 지점과 before → after 를 표로 박제한다.
- [ ] **(6) S1 ~ S3 종합 판정 (본 slice 고유)** — §12.8 말미에 **후보 17 row 전건** 의 판정 분포를 한 표로 합산한다: S1 (4 — 유지 3 / 기록만 1 / 변경 0), S2 (7 — 유지 5 / 기록만 2 / 변경 0), S3 (6 — 본 slice 실측값), **합계 17**. 합이 `4 + 7 + 6 = 17` 로 §12.1 분모와 닫힘을 검산식으로 보이고, **전 slice 통틀어 enum 변경 총 N 건 · 표기-only 치환 총 M 건** 을 숫자로 명시한다. cascade 가 3 slice 통틀어 한 번도 발동하지 않았다면 그 사실이 §3 매트릭스 66 row 분류의 **2026-05-25 T-0029 최초 판정이 재검증을 통과했다** 는 의미임을 1 ~ 2 줄로 적는다 (과장 금지 — §12.1 이 후보를 17 row 부분집합으로 좁혔다는 한계를 같은 문단에서 병기).
- [ ] **(7) L212 잔여 축 closure (본 slice 고유 · 1:1 교체)** — §10 **212 행** 의 4 번째 축 `§3 매트릭스 66 row 분류 자체의 재판정 → **미해소 — 유일 잔여 축** (cascade 설계 선행 필요)` 을 **해소 표기로 in-place 교체** 한다 (T-1404 선례와 동형). 제약: (a) **1 행 → 1 행** (numstat 상 해당 hunk 가 `-1 / +1`), (b) **5 축 문구·순서·나머지 4 축의 해소 pointer (213 · 217 · 221 · 225 · 228 ~ 249 행) 원문 보존** — 편집 후 `grep -n` 으로 5 개 pointer 전건 일치 확인, (c) 새 pointer 는 **§12.5 ~ §12.8 (T-1405 설계 + T-1406 ~ T-1408 실판정, 후보 17 row 전건)** 을 가리키되 **행 번호를 쓰려면 삽입 후 실측값** 을 쓴다, (d) 문자열 **`미검증 축` 은 그대로 유지** (불변 (c) 보호), (e) 새 문장에 **`212 행` 문자열을 쓰지 않는다** (불변 (d) 보호 — `L212` 회피 표기 승계), (f) L212 괄호 안의 갱신 시점 표기 (`… 각 축 뒤 해소 표기는 2026-08-03 (T-1404) 갱신분이다`) 를 본 slice 반영으로 자연스럽게 갱신하되 같은 1 행 안에서 처리한다. before → after 전문을 완료 기록에 박제한다.
- [ ] **불변 검산 7 값** — 편집 후 실측해 §12.7 491 ~ 501 행과 동형의 표로 적는다: (a) `grep -c "^| REQ-" docs/use-cases/REQ-COVERAGE-AUDIT.md` = **66** 불변, (b) `grep -c "^## "` = **12** 불변 (`###` 추가이므로), (c) `grep -n "미검증 축"` 첫 hit = **212** · 총 hit **10** 불변, (d) `grep -c "212 행"` = **9** 불변, (e) `sed -n '115p'` 정합식이 **여전히 115 행** 이며 합 **66**, (f) §5 표 (121 ~ 127 행) count `48 / 4 / 13 / 1` = **66** · 합계 row `**100 %**` 불변, (g) **`grep -c "유일 잔여 축"` = 4 → 3** — 본 slice 가 의도한 **유일한 감소** 이며 남은 3 hit 이 §12.5 322 행 · §12.6 402 행 · §12.7 520 행 (모두 append-only 보존 대상) 임을 `grep -n` 으로 실측 박제한다.
- [ ] **hunk 국한 검증 (R-112 대체, doc-only)** — 코드 변경 0 이므로 unit test 대신 `git diff -U0 docs/use-cases/REQ-COVERAGE-AUDIT.md | grep '^@@'` 의 hunk 헤더 전량 + `git diff --numstat` 을 박제한다. hunk 는 **정확히 2 개** 여야 한다 — (1) `@@ -212 +212 @@` 1:1 치환, (2) §12.7 마지막 행과 §11 References 사이 삽입 `@@ -528,0 +529,N @@` (빈 줄 정렬로 anchor ±1 이동 허용, 단 삽입 위치 사실은 명시). §3 셀 표기-only 치환을 했다면 hunk 3 개가 되며 그 hunk 도 `-1 / +1` 이고 해당 row 의 **`|` 필드 수가 편집 전후 동일 (5 컬럼 → 파이프 6 개)** 임을 실측 박제한다 ([T-1370](T-1370-requirements-fork-rebase-dedup-status-rejudge.md) · [T-1375](T-1375-requirements-org-document-contribution-score-status-rejudge.md) 표 파손 사고 재발 방지). 212 행 · (치환 시) 해당 §3 행 외 1 ~ 528 행 hunk **0** 이고 순수 삭제 **0** 임을 명시한다. `git status --porcelain` 이 위 `touchesFiles` 2 개 외 변경 파일 **0** 임도 적는다.
- [ ] **한계 명시** — 완료 기록에 `#### 한계 —` 절을 두고 최소 4 건을 열거한다: (1) §12.1 이 후보를 **17 row 부분집합** 으로 좁혔으므로 나머지 **49 row (uc-covered 48 + gap 1) 는 본 재판정 대상이 아니었다** — L212 closure 는 "설계된 범위의 재판정 완료" 이지 66 row 전건 재검증이 아니다, (2) cascade (e) `docs/use-cases/INDEX.md` 110 행 · (f) `docs/PLAN.md` 36 행 정합 확인 미수행 (T-1404 Follow-up 3 소관), (3) 표기 비일관 3 건 (§3 83 행 `(cover)` · 79 행 `(인접)` · UC §10 표 `§5 step N` 편차) 미정정, (4) 근거 (iii) 확인은 heading / step 이름 / task frontmatter 실재 수준의 **정적 실측** 이라 그 정책이 해당 REQ 를 **충분히** 집행하는지의 질적 평가는 하지 않았다 (§12.7 한계 4 승계).

## Out of Scope

- **§3 매트릭스에서 REQ-061 ~ 066 이외 row 의 어떤 셀 수정** — 금지. S1 4 row · S2 7 row 재판정 결과도 다시 손대지 않는다.
- **S3 를 §12.5 정의와 다르게 재분할** — 금지. 본 slice 는 §12.5 322 행의 S3 행 (6 row 전건) 을 1 slice 로 집행한다 (Why 의 cap 검산 참조).
- **§12.1 ~ §12.7 (251 ~ 528 행) 의 어떤 행 수정** — 금지 (append-only 규약). 본 slice 산출물은 §12.8 append 1 지점 + L212 1:1 치환 (+ 필요 시 §3 표기-only 셀 치환) 뿐이다.
- **§9 · §10 의 212 행 외 어떤 행 수정 · §10 말미 bullet append** — 금지 (§12.3 305 행 시점 판정 보존 규약). 특히 200 · 209 · 213 · 214 행과 217 ~ 249 행 bullet 은 무수정이다.
- **L212 를 2 행 이상으로 늘리거나 축 순서 변경 · 축 문구 재작성** — 금지. 4 번째 축의 해소 표기만 교체한다.
- **`docs/use-cases/INDEX.md` 110 행 · `docs/PLAN.md` 36 행 동기화** — 금지 (cascade (e) · (f), T-1404 Follow-up 3 소관).
- **`docs/requirements.md` · `CLAUDE.md` · `docs/LOOP.md` · `.claude/agents/*` · `.github/workflows/ci.yml` · `docs/decisions/*` · `docs/use-cases/UC-0*.md` · `docs/architecture/*` · `src/` · `web/` 수정** — 전부 read-only.
- **§2 4 enum 재정의 · 새 분류값 신설** — 금지 (§12.2 가 참조만 허용). (4) 의 `.claude/` 해석 판정도 §2 본문을 고치지 않고 §12.8 본문에만 기록한다.
- **새 ADR 신설 · `docs/architecture/*` 신규 파일 추가** — 금지 (commitMode 가 pr 로 바뀌어 본 slice 판정과 충돌).
- **References (§11) 항목 추가 · Refs 줄 변경** — 금지.

## Suggested Sub-agents

`implementer` (축별 grep ≤ 5 회 → row 6 건 임계 판정 → pointer 형식 명시 판정 2 건 → §12.8 append → L212 1:1 closure 치환 → 불변 7 값 · hunk · 파이프 필드 수 검산) → 별도 tester 불요 (direct doc-only, R-110 면제 — 코드 변경 0). 단 실측 grep 명령과 hunk / numstat 출력, L212 before → after 전문은 반드시 완료 기록에 박제한다.

## 완료 기록 (2026-08-03)

**삽입 위치·형식 (선행 항목)** — 판정 기록을 `### 12.8 S3 실판정 — infrastructure 후반 6 row (T-1408)` 으로 §12.7 마지막 행 (구 528 행) 뒤 · `## 11. References` (구 529 행) 앞에 **126 행** 삽입했다. `###` 이라 `## ` heading count 는 **12 불변**. 528 행 이전 편집은 L212 1:1 치환 **1 건뿐** 이고 행 수 불변 (`-1 / +1`) 이라 213 행 이하 전건의 행 번호가 보존된다.

**(1) row 별 근거 3 종 실측** — 축별 5 회 (row 별 아님) grep/awk 로 갈음했고 명령 원문·출력 요약은 §12.8 `실측 명령 (축별 5 회)` 코드블록에 박제. 축 1 (`grep -n "REQ-061\|…\|REQ-066" docs/use-cases/UC-0*.md`) 은 **hit 0 (exit 1)** — 6 row 전건에서 근거 (i) · (ii) 가 현 분류 `infrastructure` 와 일치. 축 2 = `awk 'NR>=80&&NR<=85' docs/requirements.md` (kind 6 건 전부 `Constraint`), 축 3 = `grep -n "^### 3\.1\|^### 3\.2\|^### 3\.3\|R-113\|R-114" CLAUDE.md` (127 · 147 · 171 · 174 · 176 · 184 행), 축 4 = `grep -n "^#\{1,3\} " .claude/agents/reviewer.md .claude/agents/integrator.md` (reviewer 34 행 8 check · integrator 25 행 reviewer dispatch 의무), 축 5 = `grep -n "\[5\]" docs/LOOP.md` (234 행) + `grep -n "^status:" docs/tasks/T-0009-*.md docs/tasks/T-0010-*.md` (둘 다 `DONE`).

**(2) 임계 적용 + 분류 판정** — §12.2 288 행 임계 기계 적용: REQ-061 **0 → 유지**, REQ-062 **0 → 유지**, REQ-063 **1 → 기록만**, REQ-064 **0 → 유지**, REQ-065 **1 → 기록만**, REQ-066 **0 → 유지**. **분류 변경 0 건**. requirements.md status 컬럼 (6 건 `DONE`) 은 구현 진척 축이라 전이 근거로 쓰지 않았다.

**(3) REQ-061 task-ID pointer 명시 판정** — **충족 (stale 아님) · 셀 치환 안 함 (명시적 선택) · 분류 무수정**. T-0009 · T-0010 파일이 `status: DONE` 으로 실재하고 CLAUDE.md 174 행 R-113 본문이 그 두 task 를 인프라 도입 주체로 직접 지목하므로 근거 (iii) 의 "지목 대상 실재" 충족 — §12.2 290 행 부기 (링크 rot) 적용 대상 아님, before → after 없음.

**(4) REQ-063 · 065 agent spec pointer 명시 판정** — §2 26 행 열거는 **폐쇄 목록이 아니라 예시** (열거 뒤 `운영 정책 backlog` 가 상위 범주 본체) 로 판정 → 근거 (iii) 충족. 다만 지목처가 문면 밖이라는 표기 경계는 §12.7 485 행 REQ-001 선례와 동형으로 **1 종 계상** → 두 row `기록만` (분류 무수정 · 셀 치환 없음). §2 본문은 무수정.

**(5) cascade 집행 여부** — 분류값 변경 0 건이라 **`cascade (a) ~ (f) 발동 대상 없음`**. 표기-only 셀 치환도 **0 건** 이라 (a) 의 표기 경로조차 발동하지 않았다 (S2 의 §3 51 행 치환과 대비).

**(6) S1 ~ S3 종합** — S1 4 (유지 3 / 기록만 1 / 변경 0) + S2 7 (5 / 2 / 0) + S3 6 (4 / 2 / 0) = **17 (유지 12 / 기록만 5 / 변경 0)**, `4 + 7 + 6 = 17` · `12 + 5 = 17` 로 §12.1 274 행 분모와 닫힘. **3 slice 통틀어 enum 변경 총 0 건 · 표기-only 치환 총 1 건** (S2 §3 51 행). 한계 (후보 17 row 부분집합) 는 §12.8 종합 문단에 병기.

**(7) L212 closure — before → after 전문** (1 행 → 1 행, hunk `-1 / +1`):

```
before: - **미검증 축** (열거 자체는 T-1393 시점 서술이고, 각 축 뒤 해소 표기는 2026-08-03 (T-1404) 갱신분이다 — 아래 214 행이 200 · 209 행에 대해 쓴 시점 구분 화법과 동형) — envelope-cover 판정의 **의미적** 타당성 → **해소** (221 행 T-1396 UC-01 13 건 + 225 행 T-1397 UC-02 3 건 = label 보유 bullet 2 줄 전량), `adjacent` 서술의 정확성 (REQ-031 · REQ-034 의 adjacent vs uc-covered 귀속 포함) → **해소** (217 행 T-1395), UC 본문 §5 / §6 / §8 이 frontmatter 대로 실제 cover 하는지 → **해소** (228 ~ 249 행 T-1398 ~ T-1403, 8 UC 전건 · coversReq union 33/33), §3 매트릭스 66 row 분류 자체의 재판정 → **미해소 — 유일 잔여 축** (cascade 설계 선행 필요), 위 수치 오차 3 건의 실제 정정 → **해소** (213 행 T-1394).
after : - **미검증 축** (열거 자체는 T-1393 시점 서술이고, 각 축 뒤 해소 표기는 2026-08-03 (T-1404 · 4 번째 축은 T-1408) 갱신분이다 — 아래 214 행이 200 · 209 행에 대해 쓴 시점 구분 화법과 동형) — envelope-cover 판정의 **의미적** 타당성 → **해소** (221 행 T-1396 UC-01 13 건 + 225 행 T-1397 UC-02 3 건 = label 보유 bullet 2 줄 전량), `adjacent` 서술의 정확성 (REQ-031 · REQ-034 의 adjacent vs uc-covered 귀속 포함) → **해소** (217 행 T-1395), UC 본문 §5 / §6 / §8 이 frontmatter 대로 실제 cover 하는지 → **해소** (228 ~ 249 행 T-1398 ~ T-1403, 8 UC 전건 · coversReq union 33/33), §3 매트릭스 66 row 분류 자체의 재판정 → **해소** (§12.5 ~ §12.8 T-1405 설계 + T-1406 ~ T-1408 실판정, 후보 17 row 전건 — 유지 12 / 기록만 5 / 분류 변경 0), 위 수치 오차 3 건의 실제 정정 → **해소** (213 행 T-1394).
```

제약 준수: (a) 1 행 → 1 행, (b) 5 축 문구·순서 보존 + 나머지 4 축 pointer 전건 일치 (`grep -o '213 행 T-1394|217 행 T-1395|221 행 T-1396|225 행 T-1397|228 ~ 249 행 T-1398 ~ T-1403'` → 각 1 회), (c) 새 pointer 는 §12.5 ~ §12.8 (행 번호 미사용 — § 번호 표기), (d) `미검증 축` 문자열 유지, (e) 새 문장에 `212 행` 문자열 미사용, (f) 갱신 시점 표기를 같은 1 행 안에서 `(T-1404 · 4 번째 축은 T-1408)` 로 갱신. audit 문서 본문에는 검산 (g) count 보존을 위해 before 원문을 인용하지 않고 본 완료 기록에만 박제했다.

**불변 검산 7 값** (편집 후 실측, 괄호 안이 요구치): (a) `grep -c "^| REQ-"` = **66** (66) · (b) `grep -c "^## "` = **12** (12) · (c) 잔여 축 열거 문구 첫 hit **212** / 총 **10** (212 / 10) · (d) L212 참조 문자열 count **9** (9) · (e) `sed -n '115p'` = 여전히 115 행 `합 = 33 + 15 + 4 cross-cutting + 13 infrastructure + 1 gap = 66` (115 행 · 합 66) · (f) §5 표 count `48 / 4 / 13 / 1` = 66 · 합계 row `**100 %**` (불변) · (g) closure 대상 문구 count **4 → 3**, 잔여 hit 는 `grep -n` 실측으로 **322 · 402 · 520 행** (§12.5 S3 행 · §12.6 · §12.7 종합 bullet — 전부 append-only 보존 대상).

**hunk 국한 검증 (R-112 대체, doc-only)** — 코드 변경 0. hunk 헤더 전량 + numstat:

```
$ git diff -U0 docs/use-cases/REQ-COVERAGE-AUDIT.md | grep '^@@'
@@ -212 +212 @@ REQ 의 cover 방식을 다음 4 enum 으로 분류:
@@ -528,0 +529,126 @@ hunk 는 **2 개뿐** — (1) 51 행 1:1 치환 ...
$ git diff --numstat
127     1       docs/use-cases/REQ-COVERAGE-AUDIT.md
```

hunk **정확히 2 개** — (1) L212 1:1 치환 (`-1 / +1`), (2) §12.7 마지막 행과 §11 References 사이 삽입 126 행. §3 셀 표기-only 치환이 0 건이라 3 번째 hunk 는 없고, 1 ~ 528 행 중 L212 외 hunk **0** · 삭제 열 **1** 은 그 치환의 짝이라 순수 삭제 **0**. §3 매트릭스를 전혀 건드리지 않아 표 파손 (T-1370 · T-1375) 위험은 원천 차단됐고 (a) `66` · (f) `48 / 4 / 13 / 1` 검산이 이중 확인. content commit 시점 `git status --porcelain` 은 `touchesFiles` 2 개 (`docs/use-cases/REQ-COVERAGE-AUDIT.md` · 본 task 파일) 외 변경 파일 **0**.

**한계** — (1) §12.1 이 후보를 17 row 부분집합으로 좁혀 나머지 **49 row (uc-covered 48 + gap 1) 는 본 재판정 대상이 아니었다** (L212 closure = "설계된 범위의 재판정 완료"), (2) cascade (e) INDEX.md 110 행 · (f) PLAN.md 36 행 미동기 (변경 0 이라 불요였으나 정합 확인도 미수행), (3) 표기 비일관 3 건 (§3 83 행 `(cover)` · 79 행 `(인접)` · UC §10 표 `§5 step N` 편차) + 본 slice 가 새로 기록한 표기 경계 2 건 미정정, (4) 근거 (iii) 확인은 heading / step 번호 / task frontmatter 실재 수준의 정적 실측이라 그 정책이 REQ 를 **충분히** 집행하는지의 질적 평가는 하지 않았다.

## Follow-ups

1. **cascade (e) `docs/use-cases/INDEX.md` 110 행 · (f) `docs/PLAN.md` 36 행 정합 확인** — S1 ~ S3 전건 enum 변경이 0 이면 수치 동기는 불요이나 **정합 확인 자체가 미수행** 이다. 1 slice 로 확인 (T-1404 Follow-up 3 · T-1407 Follow-up 2 와 통합).
2. **cascade 7 번째 지점의 §12.3 표 반영** — §4 117 행 blockquote 가 (c) `15` 항의 부속임을 T-1406 이 §12.6 본문에만 기록했다. append-only 행 번호 invariant 가 풀리는 시점 (L212 closure 이후) 의 정리 후보.
3. **재판정 후보 밖 49 row (uc-covered 48 + gap 1) 의 취급 결정** — §12.1 이 부분집합 안을 채택한 근거를 재검토해, 추가 재판정을 할지 / 현 판정을 확정으로 둘지를 1 slice 로 판단 (판정 0 · 설계만, T-1405 선례).
