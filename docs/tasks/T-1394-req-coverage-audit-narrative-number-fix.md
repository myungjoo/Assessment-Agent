---
id: T-1394
title: REQ-COVERAGE-AUDIT §4 115 행 · §5 121 행의 요약 수치 오차 3 건을 매트릭스 실측값으로 정정
phase: P5
status: PENDING
commitMode: direct
coversReq: [REQ-001]
estimatedDiff: 45
estimatedFiles: 2
created: 2026-08-02
independentStream: uc-doc-audit-resync
dependsOn: [T-1393]
touchesFiles:
  - docs/use-cases/REQ-COVERAGE-AUDIT.md
  - docs/tasks/T-1394-req-coverage-audit-narrative-number-fix.md
plannerNote: "uc-doc-audit-resync 6 번째 slice — T-1393 Follow-up 1 (수치 오차 3 건 cascade 정정) 처리, audit 문서 내부 2 행 정정 + §10 반영 bullet, doc-only direct"
---

# T-1394 — REQ-COVERAGE-AUDIT §4 115 행 · §5 121 행의 요약 수치 오차 3 건을 매트릭스 실측값으로 정정

## Why

[T-1393](T-1393-req-coverage-reverse-coverage-recheck.md) 이 역방향 coverage 를 3 축으로 실측해 **집합·분류 차원 결함 0 건** 을 확정하면서, 동시에 **요약 수치 서술 오차 3 건** (§4 115 행의 `union 31` · 같은 행의 `envelope 13` · §5 121 행 비고의 분해 `31 직접 + 17 envelope`) 을 판정만 하고 정정은 Follow-up 1 로 넘겼다. 이 오차는 2026-05-25 PR-28 reviewer 가 이미 MINOR 로 지적했던 것이라 **15 개월째 미정정 존속** 상태이며, 115 행의 합산식은 `31 + 13 + 4 + 13 + 1 = 62 ≠ 66` 으로 문서 안에서 산술이 성립하지 않는다. 본 slice 는 §3 매트릭스 66 row 실측 (T-1390 이 §5 합계 48 / 4 / 13 / 1 과 1:1 일치 확인) 을 **유일한 anchor** 로 삼아 두 행의 숫자만 실측값 (`33 직접 + 15 envelope`) 으로 맞춘다. 분류 판정 자체 (REQ-031 · REQ-034 의 `adjacent` vs `uc-covered` 귀속) 는 건드리지 않는다 — 그 재판정은 매트릭스 row 까지 바꾸는 별개 cascade 라 Follow-up 으로 남긴다.

## Required Reading

- `docs/use-cases/REQ-COVERAGE-AUDIT.md` 115 행 — §4 마지막 요약 문장. 정정 대상 1·2 (`union: 31 REQ` → 33, `envelope-cover (UC-01 의 P5 알고리즘 13 REQ)` → 잔차 15). **106 ~ 113 행 bullet 8 줄은 무수정** (T-1393 축 B 가 bullet union 은 이미 33 으로 정확함을 확인).
- `docs/use-cases/REQ-COVERAGE-AUDIT.md` 117 ~ 125 행 — §5 통계 표. 정정 대상 3 은 **121 행 비고 셀의 분해 서술** 뿐. **count 컬럼 `48` · percentage `73 %` · 합계 row 66 은 전부 정확하므로 절대 건드리지 않는다** (T-1390 재검산 완료분).
- `docs/use-cases/REQ-COVERAGE-AUDIT.md` 198 ~ 211 행 — §10 (T-1393 dated 절). 본 slice 는 이 절 **끝에 정정 반영 bullet 1 ~ 2 줄만 append** 한다. 특히 200 행 blockquote 의 "정정도 하지 않았다" 는 T-1393 시점 서술이므로 **원문 무수정**, 새 bullet 이 그 시점성을 명시한다.
- `docs/tasks/T-1393-req-coverage-reverse-coverage-recheck.md` "완료 기록" 축 B · 축 C — 정정에 쓸 실측 근거값 (union 33 / envelope 잔차 15 / 정합식 `33 + 15 + 4 + 13 + 1 = 66`). 본 slice 는 이 값을 **그대로 신뢰하지 않고 1 회 재실측** 한 뒤 반영한다.
- `docs/use-cases/INDEX.md` 110 행 · `docs/PLAN.md` 36 행 — 외부 인용처 2 곳. 둘 다 **read-only**. 이 두 곳이 인용하는 값이 outer 4 값 (48 / 4 / 13 / 1) 뿐이어서 본 정정의 cascade 대상이 **아님** 을 실측 확인하는 것이 본 slice 의 판정 항목 중 하나다.

## Acceptance Criteria

- [ ] **실측 재확인 (정정 전)** — 정정 직전에 (a) 8 UC frontmatter `coversReq` unique union, (b) §3 매트릭스 `uc-covered` row 수, (c) (b) − (a) 로 계산한 envelope 잔차 3 값을 명령으로 재산출해 각각 **33 / 48 / 15** 인지 확인하고 사용한 명령과 출력값을 완료 기록에 박제한다. 하나라도 다르면 **정정을 중단** 하고 그 사실만 기록한다 (틀린 anchor 로 정정하지 않는다).
- [ ] **정정 1·2 — §4 115 행** — `8 UC 의 coversReq union: 31 REQ` → **33**, `envelope-cover (UC-01 의 P5 알고리즘 13 REQ)` → **envelope 잔차 15 REQ** 로 고치고, 합산식을 `33 + 15 + 4 cross-cutting + 13 infrastructure + 1 gap = 66` 으로 맞춘다. 잔차 15 와 §4 bullet 이 나열한 envelope 13 건 사이의 차이 2 건 (REQ-031 · REQ-034 — bullet 은 `adjacent`, §3 매트릭스는 `uc-covered`) 을 같은 행 또는 바로 뒤 1 줄에 **명시** 해 문서 내부에서 13 과 15 가 동시에 읽혀도 모순으로 보이지 않게 한다. **115 행 편집 후 문장이 산술적으로 66 으로 닫히는지** 를 직접 더해 확인한다.
- [ ] **정정 3 — §5 121 행 비고 셀** — `31 REQ 가 … 직접 명시 + 17 REQ 가 … envelope` → `33 REQ … 직접 명시 + 15 REQ … envelope` 로 고친다. **같은 row 의 count `48` · percentage `73 %` 는 무수정**. 셀 안에 리터럴 `|` 를 넣지 않는다 ([T-1370](T-1370-requirements-fork-rebase-dedup-status-rejudge.md) · [T-1375](T-1375-requirements-org-document-contribution-score-status-rejudge.md) 사고 재발 방지) — 편집 후 121 행의 `|` 개수가 편집 전과 **동일** 함을 세어 완료 기록에 적는다.
- [ ] **외부 인용처 cascade 판정** — `grep -n "48\|31 직접\|17 envelope" docs/use-cases/INDEX.md docs/PLAN.md` 등으로 INDEX 110 행 · PLAN 36 행이 인용하는 값을 실측해, 두 곳이 outer 4 값만 인용하고 본 정정 대상 3 값 (31 / 13 / 17) 은 **인용하지 않음** 을 확인한다. 결과에 따라 (a) 확인되면 "cascade 대상 아님 — 두 파일 무수정" 을 완료 기록에 명시, (b) 예상과 달리 인용이 발견되면 **본 slice 에서 고치지 말고** Follow-up 으로 넘긴다 (파일 상한 보호).
- [ ] **§10 정정 반영 bullet** — §10 마지막 bullet (211 행 "미검증 축") **뒤** 에 `- **2026-08-02 정정 반영 (T-1394)** — …` bullet 을 **최대 2 줄** append. 내용은 (1) 정정한 3 값 before → after, (2) anchor 가 §3 매트릭스 실측이라는 점, (3) 200 행 blockquote 의 "정정도 하지 않았다" 는 T-1393 시점 서술이며 본 bullet 이 그 이후 상태임을 1 구절로 명시. **새 `##` 절을 만들지 않는다** (References 번호 churn 회피).
- [ ] **불변 검산** — 편집 전후로 (a) `grep -c "^| REQ-" docs/use-cases/REQ-COVERAGE-AUDIT.md` **66 불변**, (b) `grep -c "^## "` **11 불변** (신설 절 0), (c) §5 표의 합계 row 가 여전히 `**66** | **100 %**` 이고 count 컬럼 4 값이 48 / 4 / 13 / 1 **불변**, (d) `git diff --stat` 의 변경 파일이 `docs/use-cases/REQ-COVERAGE-AUDIT.md` **1 개** (+ 본 task 파일) 세 ~ 네 값을 완료 기록에 적는다.
- [ ] **R-112 대체 검증 (doc-only)** — 코드 변경 0 이므로 unit test 대신 위 grep / awk 출력값 전건 박제로 대체한다. 추가로 `git diff -U0 docs/use-cases/REQ-COVERAGE-AUDIT.md` 의 hunk 가 **§4 115 행 · §5 121 행 · §10 말미 3 지점** 에만 국한됨을 hunk 헤더 목록으로 보여 적는다.
- [ ] **한계 명시** — 완료 기록에 "한계 —" 절을 두고 본 slice 가 판정하지 않은 축 (REQ-031 · REQ-034 의 `adjacent` vs `uc-covered` 귀속 · §4 bullet 의 envelope 나열 13 건 자체의 의미적 타당성 · §3 매트릭스 row 분류 재판정 · UC 본문 forward dangling 검사) 을 열거한다.

## Out of Scope

- **REQ-031 · REQ-034 의 귀속 재판정** — §4 bullet 의 `adjacent` 표기와 §3 매트릭스의 `uc-covered` 중 어느 쪽이 옳은지는 본 slice 가 판정하지 않는다. 본 slice 는 **매트릭스를 anchor 로 고정** 하고 숫자만 맞춘다 (T-1393 Follow-up 2 존속).
- **§3 매트릭스 66 row 수정** — 어떤 row 의 분류값도 바꾸지 않는다.
- **§5 표의 count / percentage / 합계 수정** — 비고 셀 문구 1 곳 외 일절 금지 (T-1390 이 이미 정확함을 확인).
- **§1 ~ §3 · §6 ~ §9 본문 수정** — 일절 금지. §10 은 **말미 bullet append 만** 허용하고 기존 13 줄은 무수정.
- **`docs/use-cases/INDEX.md` · `docs/PLAN.md` · `docs/requirements.md` · 8 UC 본문 · `src/` 수정** — 전부 read-only. 인용처 판정 결과가 예상과 달라도 본 slice 에서 고치지 않는다.
- **새 dated 절 (§12) 신설 · References 번호 변경** — 금지 (anchor churn 회피).

## Suggested Sub-agents

`implementer` (doc 편집 + grep / awk 재실측) → 별도 tester 불요 (direct doc-only, R-110 면제 — 코드 변경 0). 단 위 R-112 대체 검증 항목의 명령 출력은 반드시 완료 기록에 박제한다.

## Follow-ups

(생성 시 비어 있음 — sub-agent 가 관련 작업 발견 시 여기에 append)
