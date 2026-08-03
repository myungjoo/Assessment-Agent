---
id: T-1410
title: REQ-004 gap 권장 처리 서술 (UC-09 신설 · UC-01 확장 · T-0030+ 책임) 최신성 4 축 재판정 + §12.10 박제 + PLAN 36 행 책임 지목 정정
phase: P5
status: DONE
commitMode: direct
completed: 2026-08-03
coversReq: [REQ-001, REQ-004]
estimatedDiff: 90
estimatedFiles: 3
created: 2026-08-03
independentStream: uc-doc-audit-resync
dependsOn: [T-1409]
touchesFiles:
  - docs/use-cases/REQ-COVERAGE-AUDIT.md
  - docs/PLAN.md
  - docs/tasks/T-1410-req004-gap-recommendation-staleness-rejudge.md
plannerNote: "uc-doc-audit-resync 22 번째 slice — T-1409 Follow-up 1 (§12.9 한계 1) 채택, 권장 처리 서술 최신성 실측 + PLAN 36 행 stale 지목 1:1 정정, direct doc-only"
---

# T-1410 — REQ-004 gap 권장 처리 서술의 최신성 재판정

## Why

[T-1409](T-1409-req-coverage-cascade-ef-external-summary-verify.md) 가 cascade (e) `docs/use-cases/INDEX.md` 110 행 · (f) `docs/PLAN.md` 36 행의 **수치 4 값과 gap 서술** 을 4 축 대조해 불일치 0 으로 닫았지만, 같은 두 행이 함께 적은 **권장 처리 서술** — `UC-09 신설 또는 UC-01 확장 권장` 과 (f) 에만 있는 `follow-up task T-0030+ 책임` — 은 대조 범위 밖이었다 (§12.9 한계 1 · T-1409 Follow-up 1).

REQ-004 는 [§9](../use-cases/REQ-COVERAGE-AUDIT.md) (T-1389) 와 §12 S1 ~ S3 (T-1406 ~ T-1408) 를 거쳐 여전히 `gap` 이므로 권장 자체는 유효할 가능성이 크다. 그러나 **책임 task 지목** 은 다르다 — audit §6 140 행이 "T-0030 또는 T-0031 으로 별도 task 생성 권장" 이라 적은 두 ID 는 이미 `api.md` (T-0030) · `data-model.md` (T-0031) 로 소진됐고, PLAN.md 36 행은 그 지목을 `follow-up task T-0030+ 책임` 으로 그대로 인용하고 있다. 독자가 PLAN 만 읽으면 "T-0030 대에서 처리됐겠거니" 로 오독할 수 있다. 본 slice 가 그 최신성을 실측으로 확정하고, 살아있는 PLAN 체크리스트 한 행만 1:1 정정한다.

## Required Reading

- `docs/use-cases/REQ-COVERAGE-AUDIT.md` — §6 gap follow-up (129 ~ 140 행, 권장 (a) / (b) 원문 + 140 행 `T-0030 또는 T-0031` 지목) · §8 161 행 (`후속 task (T-0030+) 책임`) · §9 173 행 (coversReq 에 REQ-004 0/8 실측) · §12.3 306 행 (append-only 보존 규약) · §12.9 (655 ~ 719 행, 본 slice 가 승계할 기록 구조 + 한계 1)
- `docs/PLAN.md` 36 행 — Phase P2 셋째 bullet (정정 대상 유일 행)
- `docs/use-cases/INDEX.md` 110 ~ 112 행 — 권장 처리 서술이 함께 있는 (e) 대상 문단 (본 slice 는 **읽기만** — Out of Scope)
- `docs/use-cases/UC-01-evaluation-execution.md` — frontmatter `coversReq` 와 trigger 단락 (축 B 의 실측 대상)
- `docs/tasks/T-0030-p2-api-contract.md` · `docs/tasks/T-0031-p2-data-model.md` — frontmatter `title` / `status` (축 C 의 실측 대상)

## Acceptance Criteria

### 1. 4 축 실측 (판정이 본 slice 의 1 급 산출물)

- [x] **축 A — 권장 (a) UC-09 신설 착수 여부**: `ls docs/use-cases/UC-*.md` 로 UC 본문 파일 수를 세고 (`UC-09*` hit **0** 기대), `docs/use-cases/INDEX.md` §2 표 row 수 (8) 에 UC-09 가 없음을 확인. 착수 / 미착수를 건수로 판정.
- [x] **축 B — 권장 (b) UC-01 확장 착수 여부**: `docs/use-cases/UC-01-evaluation-execution.md` frontmatter `coversReq` 에 `REQ-004` 포함 여부 + 본문의 `사용자 지정 기간` / `임의 기간` / `date-range` grep hit 수를 실측. §9 173 행의 `coversReq 에 REQ-004 를 포함한 UC = 0 / 8` 실측과 일치하는지 대조. 착수 / 미착수를 건수로 판정.
- [x] **축 C — 책임 task 지목 최신성**: `T-0030` · `T-0031` 두 task 파일의 frontmatter `title` / `status` 를 실측해 실제 산출물이 `api.md` / `data-model.md` 임을 확인하고, 추가로 `grep -l "REQ-004" docs/tasks/*.md` 로 REQ-004 를 다룬 task 가 있는지 전수 확인. 결과로 **지목 stale 여부** 를 명시 판정 (stale = 지목된 ID 가 다른 산출물로 소진 + 대체 책임 task 부재).
- [x] **축 D — 권장 자체의 유효성**: REQ-004 가 §9 (T-1389) · §12.6 ~ §12.8 (S1 ~ S3) 를 거쳐 여전히 `gap` 임을 §3 38 행 · §5 126 행에서 재확인하고, §6 이 (a) 를 우선 권장한 근거 (`UC-01 은 cron/manual full-period 파이프라인이라 분리가 깔끔`) 가 현 UC-01 본문 trigger 서술과 여전히 부합하는지 1 회 확인. 권장 유효 / 무효를 판정.
- [x] 4 축 결과로 **정정 대상을 명시 확정**: 권장 (a) / (b) 문구 자체가 유효하면 문구는 손대지 않고, 축 C 가 stale 로 나온 **책임 task 지목만** 정정 대상으로 삼는다. 축 D 가 무효로 나오면 정정하지 말고 Follow-up 으로 올린다 (§6 는 2026-05-25 시점 기록이라 append-only 보존 대상 — §12.3 306 행).

### 2. 기록 — audit 문서에 §12.10 append

- [x] `docs/use-cases/REQ-COVERAGE-AUDIT.md` 의 §12.9 마지막 행 (719 행) 과 `## 11. References` (720 행) **사이에만** `### 12.10` 절을 삽입 (삽입 hunk 1 개). 1 ~ 719 행은 1 자도 변경 금지.
- [x] §12.10 은 §12.9 구조를 승계: (i) 대상·범위 1 문단, (ii) 축 A ~ D 실측 표, (iii) 정정 대상 확정 판정, (iv) PLAN.md 36 행 before → after 요지, (v) 불변 검산 표, (vi) 한계 명시.
- [x] 새 절은 `## ` 로 시작하는 heading 을 만들지 않는다 (`###` / `####` 만 사용). `212 행` · `미검증 축` 문자열도 쓰지 않는다 (T-1405 ~ T-1409 회피 표기 승계).

### 3. 편집 — PLAN.md 36 행 1 행 → 1 행 in-place 치환

- [x] `docs/PLAN.md` **36 행만** 1:1 교체 (T-1404 · T-1409 선례 동형) — `follow-up task T-0030+ 책임` 구간을 축 C 실측 결과로 갱신 (T-0030 / T-0031 이 다른 산출물로 소진됐고 REQ-004 해소 task 는 미생성이라는 사실 + 근거는 audit §12.10 위임). 삽입 / 삭제 금지 (파일 행 수 175 불변, 36 행 번호 불변).
- [x] 기존 문장·링크·수치 4 값 (`uc-covered 48 / cross-cutting 4 / infrastructure 13 / gap 1 = 66`) · T-1409 가 덧붙인 2026-08-03 재판정 pointer 문장은 **한 글자도 축약하지 않는다**.
- [x] 권장 처리 문구 `UC-09 신설 또는 UC-01 확장 권장` 은 축 D 가 유효 판정이면 **원문 그대로 보존**.

### 4. 불변 검산 (편집 후 실측값을 §12.10 표에 박제)

- [x] `grep -c "^| REQ-" docs/use-cases/REQ-COVERAGE-AUDIT.md` = **66** 불변.
- [x] `grep -c "^## " docs/use-cases/REQ-COVERAGE-AUDIT.md` = **12** 불변.
- [x] `grep -c "212 행" docs/use-cases/REQ-COVERAGE-AUDIT.md` = **9** · `grep -c "미검증 축"` = **10** 불변.
- [x] `sed -n '115p'` 정합식 `33 + 15 + 4 + 13 + 1 = 66` · §5 표 (121 ~ 127 행) count 4 값 `48 / 4 / 13 / 1` + 합계 `**66**` · `**100 %**` 불변.
- [x] `wc -l docs/PLAN.md` = **175** 불변 · `wc -l docs/use-cases/INDEX.md` = **114** 불변 (INDEX.md 는 본 slice 에서 **무편집** — `git status` 에 등장하면 안 됨).
- [x] `git diff -U0` 의 hunk 가 정확히 **2 개** (audit 삽입 1 · PLAN 1:1 치환 1), `git diff --numstat` 의 삭제 열 합 = **1** (PLAN 치환의 짝) → **순수 삭제 0**.
- [x] `git status --porcelain` 이 `touchesFiles` 3 개 외 변경 파일 **0**.

### 5. 검증 (doc-only — R-112 대체)

- [x] 코드 변경 0 이라 unit test 없음. 대신 4 항의 검산 명령 출력과 `git diff -U0 … | grep '^@@'` / `--numstat` 결과를 task 파일 완료 기록에 박제 (T-1404 · T-1408 · T-1409 선례).
- [x] 분기 없음 — R-112 의 flow / branch 항목은 해당 없음.

## Out of Scope

- **UC-09 신설 또는 UC-01 본문 확장 실행** — 본 slice 는 권장의 최신성만 판정한다. 실제 UC 산출물 작성은 별도 slice (Follow-up 1).
- **audit §6 (129 ~ 140 행) · §8 (161 행) 수정** — 두 절은 2026-05-25 시점 기록이라 append-only 규약 (§12.3 306 행) 상 보존한다. 140 행의 `T-0030 또는 T-0031` 지목도 그대로 둔다.
- **`docs/use-cases/INDEX.md` 편집 일체** — 110 행 문자열·행 번호는 §12.3 (e) 가 참조하는 invariant 이며 T-1409 가 이미 시점 pointer 를 붙였다. 본 slice 는 읽기만.
- **§3 매트릭스 셀 편집 · §5 통계 · §4 정합식 갱신** — 분류 변경 0 이라 발동 대상 없음.
- **§12.3 표 수정** — 7 번째 cascade 지점 (§4 117 행 blockquote) 추가는 T-1408 Follow-up 2 소관 그대로 이월.
- **재판정 후보 밖 49 row 취급 결정** · **표기 비일관 3 건 정정** — T-1408 Follow-up 3 이월분, 별도 slice.
- `src/` · `test/` · CI · package.json 등 코드 계열 파일 일체.

## Suggested Sub-agents

`implementer → tester` (doc-only direct — implementer 가 4 축 실측 + §12.10 append + PLAN 36 행 1:1 치환, tester 는 §4 불변 검산 명령 실행과 hunk 국한 확인만 담당)

## Follow-ups

1. **REQ-004 UC 문서 축 해소 slice** — 축 A · B 가 양쪽 미착수를 확인했고 축 D 가 권장을 유효로 판정했으므로, `UC-09` 신설 (권장 (a)) 또는 UC-01 §3 trigger 확장 (권장 (b)) 중 하나를 실제로 수행하는 slice 가 필요하다. 착수 시 §6 139 행의 규모 추정 (T-0028 동급 ≤180 LOC) 재산정 동반 (§9.5 한계 1 · §12.10 한계 1).
2. **지목 공백 3 지점 동기** — `docs/architecture/api.md` 211 행 · `docs/architecture/data-model.md` 168 행의 "UC-09 신설 또는 UC-01 확장 후 … 추가 예정" 서술은 위 1 의 승계 task 가 생기는 시점에 함께 갱신하는 편이 경제적이다 (audit §8 161 행은 append-only 보존 대상이라 제외).
3. **§6 대안 (b) 의 서수 표기 어긋남** — `셋째 entry 로 추가` 는 UC-01 §3 이 3 경로가 된 현재 넷째가 되나, §6 은 시점 기록이라 정정하지 않고 §12.10 축 D 부기로만 남겼다. UC-01 확장을 실제 수행하는 slice 가 참고할 것.

## 완료 기록 (2026-08-03)

### 4 축 판정 결과

| 축 | 판정 | 핵심 실측 |
| --- | --- | --- |
| (A) UC-09 신설 | **미착수** | UC 본문 8 파일 (UC-01 ~ UC-08) · `UC-09*` hit 0 · INDEX §2 표 row 8 |
| (B) UC-01 확장 | **미착수** | `coversReq` 13 원소에 REQ-004 없음 · `사용자 지정 기간` / `임의 기간` / `date-range` / `REQ-004` grep hit 각 0 (§9 173 행 `0 / 8` 과 일치) |
| (C) 책임 task 지목 | **stale** | T-0030 = api.md / DONE (PR 29) · T-0031 = data-model.md / DONE (PR 30) · 두 task 132 · 148 행이 REQ-004 을 Out of Scope 로 재이관 · REQ-004 언급 task 24 중 UC 문서 축 해소 task 0 |
| (D) 권장 유효성 | **유효** | §3 38 행 · §5 126 행 모두 `gap` · UC-01 §3 은 cron / manual / 재수집 3 경로이나 사용자 지정 기간 경로 없음 |

정정 대상은 축 C 의 `follow-up task T-0030+ 책임` 1 구간으로 확정, 권장 문구 (`UC-09 신설 또는 UC-01 확장 권장`) 는 원문 보존.

### 검산 명령 출력

```
$ grep -c "^| REQ-" docs/use-cases/REQ-COVERAGE-AUDIT.md   → 66
$ grep -c "^## " docs/use-cases/REQ-COVERAGE-AUDIT.md      → 12
$ grep -c "212 행" docs/use-cases/REQ-COVERAGE-AUDIT.md    → 9
$ grep -c "미검증 축" docs/use-cases/REQ-COVERAGE-AUDIT.md  → 10
$ wc -l docs/PLAN.md                                       → 175
$ wc -l docs/use-cases/INDEX.md                            → 114 (무편집)
$ sed -n '115p' …  → 33 + 15 + 4 + 13 + 1 = 66 (불변)
$ sed -n '121,127p' … → 48 / 4 / 13 / 1 · 합 **66** · **100 %** (불변)

$ git diff -U0 | grep '^@@'
@@ -36 +36 @@
@@ -719,0 +720,70 @@
$ git diff --numstat
1    1   docs/PLAN.md
70   0   docs/use-cases/REQ-COVERAGE-AUDIT.md
$ git status --porcelain
 M docs/PLAN.md
 M docs/use-cases/REQ-COVERAGE-AUDIT.md
```

hunk 2 개 (audit 삽입 1 · PLAN 1:1 치환 1) · 삭제 열 합 1 (PLAN 치환의 짝) → 순수 삭제 0. INDEX.md 는 변경 목록 미등장. 코드 변경 0 이라 unit test 없음 (R-112 flow / branch 항목 해당 없음).
