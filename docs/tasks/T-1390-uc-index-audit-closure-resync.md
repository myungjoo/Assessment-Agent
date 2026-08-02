---
id: T-1390
title: UC INDEX.md 의 audit closure 요약을 2026-08-02 재판정(§9)과 동기하고 분류 통계 4 값을 재검산
phase: P5
status: DONE
commitMode: direct
coversReq: [REQ-004, REQ-001]
estimatedDiff: 35
estimatedFiles: 2
created: 2026-08-02
independentStream: uc-doc-audit-resync
dependsOn: [T-1389]
touchesFiles:
  - docs/use-cases/INDEX.md
  - docs/tasks/T-1390-uc-index-audit-closure-resync.md
plannerNote: "uc-doc-audit-resync 2 번째 slice — T-1389 Follow-up 1 (INDEX.md 104 행 stale closure 요약) 처리 + 통계 4 값 grep 재검산, doc-only direct"
---

# T-1390 — UC INDEX.md 의 audit closure 요약을 2026-08-02 재판정(§9)과 동기하고 분류 통계 4 값을 재검산

## Why

[T-1389](T-1389-uc-coverage-audit-req-004-gap-rejudge.md) 가 `docs/use-cases/REQ-COVERAGE-AUDIT.md` 에 `## 9. 2026-08-02 재판정` 절을 신설하고 3 spot (18 행 · 38 행 · 124 행) 에 pointer 를 박았지만, 그 Follow-up 1 이 남긴 대로 **`docs/use-cases/INDEX.md` 104 행의 "REQ ↔ UC coverage audit closure" 요약은 2026-05-25 판정만 반영** 한다 — 즉 audit 문서 본체는 재판정 pointer 를 갖고 INDEX 는 갖지 않는 비대칭이 남았다. 본 slice 는 그 한 문단을 §9 로 향하는 pointer 로 동기하고, 동시에 요약이 인용하는 **분류 통계 4 값 (uc-covered 48 / cross-cutting 4 / infrastructure 13 / gap 1) 이 audit 매트릭스의 실제 row 분포와 여전히 일치하는지 grep 으로 재검산** 해 숫자 stale 여부를 함께 판정한다 ([INDEX.md](../use-cases/INDEX.md) §5 갱신 룰 4·5 가 요구하는 living-document 동기 의무의 이행).

## Required Reading

- `docs/use-cases/INDEX.md` 104 행 — 수정 대상인 "REQ ↔ UC coverage audit closure" 한 문단 전체. 인접한 102 행 · 106 행 (`Refs:` 줄) 의 형식도 함께 보고 문단 경계를 정확히 파악한다.
- `docs/use-cases/INDEX.md` 92~100 행 (§5 갱신 룰) — 룰 4 (REQ 변경 시 동기) · 룰 5 (architecture 변경 시 동기) 의 문구를 확인해 본 slice 가 어느 룰의 이행인지 한 줄로 인용한다. 룰 자체는 수정하지 않는다.
- `docs/use-cases/REQ-COVERAGE-AUDIT.md` 164 행 이후 `## 9. 2026-08-02 재판정 (T-1389)` 절 — **판정 결론 한 줄과 절 번호만** 인용한다. 실측 수치 본문을 INDEX.md 로 복사하지 않는다 (INDEX 는 목차 역할, 상세는 audit 문서 책임).
- `docs/use-cases/REQ-COVERAGE-AUDIT.md` 117~126 행 (§5 분류별 요약 통계 표) — 인용된 4 값 (48 / 4 / 13 / 1) 과 합계 66 을 확인한다.
- `docs/tasks/T-1389-uc-coverage-audit-req-004-gap-rejudge.md` 의 "완료 기록" — 실측값 서술 포맷 (축별 수치 + 실재 경로 + "한계 —" 부기) 을 그대로 따른다. 그 안의 수치를 본 task 근거로 복사하지 않고 본 slice 에서 다시 실측한다.

## Acceptance Criteria

- [x] **분류 통계 재검산** — audit 매트릭스 row 의 분류 컬럼을 직접 집계해 4 값을 각각 숫자로 적는다. 집계 명령은 `awk -F'|' '/^\| REQ-/{gsub(/ /,"",$4); c[$4]++} END{for(k in c) print k, c[k]}' docs/use-cases/REQ-COVERAGE-AUDIT.md` 를 사용하고, 그 출력값을 §5 통계 표의 4 값 (`uc-covered` 48 · `cross-cutting` 4 · `infrastructure` 13 · `gap` 1) 과 1:1 대조한다.
- [x] **row 수 검산** — `grep -c "^| REQ-" docs/use-cases/REQ-COVERAGE-AUDIT.md` 값이 66 이고 위 4 값의 합과 같음을 확인해 완료 기록에 적는다. 불일치 시 (숫자가 어긋나면) INDEX 를 임의 보정하지 말고 불일치 사실만 박제하고 Follow-ups 에 별도 slice 로 남긴다.
- [x] **INDEX.md 104 행 동기** — 해당 문단에 (a) 2026-05-25 audit 이 원 출처임을 유지하고, (b) `2026-08-02 재판정: REQ-COVERAGE-AUDIT.md §9 참조` pointer 를 T-1389 가 쓴 것과 **동일 문구 형태** 로 부기하며, (c) 위 재검산 결과 (일치 / 불일치) 를 한 구절로 반영한다. 문단은 **최대 3 줄** 로 유지한다 (INDEX 는 목차 — 상세 서술 금지).
- [x] **원 판정 보존** — 104 행의 2026-05-25 audit 수치 (48 / 4 / 13 / 1) 와 "UC-09 신설 또는 UC-01 확장 권장" 문구는 역사적 기록으로 **삭제하지 않는다**. 재판정 결과는 덧붙이는 형태로만 표현한다.
- [x] **REQ-004 판정 정합** — T-1389 가 확정한 판정 (`gap` 유지 — UC cover 축 0, 구현 실재 축은 `POST /api/assessment-evaluation/period` + ADR-0037 ACCEPTED) 과 INDEX 문구가 모순되지 않음을 확인한다. INDEX 에는 "gap 유지" 사실만 적고 근거 실측값은 §9 로 위임한다.
- [x] **파일 무결성** — 편집 후 `wc -l docs/use-cases/INDEX.md` 가 106 ± 2 행 범위이고, §2 UC 목록 표의 row 수가 불변임을 `grep -c "^| UC-" docs/use-cases/INDEX.md` 로 확인해 값을 완료 기록에 적는다. 표 셀 안에 리터럴 `|` 를 넣지 않는다 ([T-1370](T-1370-requirements-fork-rebase-dedup-status-rejudge.md) · [T-1375](T-1375-requirements-org-document-contribution-score-status-rejudge.md) 사고 재발 방지).
- [x] **한계 부기** — 실측으로 확인하지 않은 부분 (예: UC 목록 표의 status 컬럼 실제 진척과의 정합 · "관련 REQ" 컬럼의 requirements.md 대조 · UC-09 신설 타당성) 을 완료 기록의 "한계 —" 절에 1~2 줄 적는다. INDEX 본문에는 한계 서술을 넣지 않는다.
- [x] **R-112 대체 검증** — 본 task 는 `commitMode: direct` 문서 전용이라 production 코드 0 LOC · 신규 public symbol 0 · 신규 분기 0 이므로 happy-path / error path / 분기 / negative cases 각각에 대응하는 신규 test 대상이 **없다** ([T-1327](T-1327-uc01-uc05-step-count-realign.md) · [T-1346](T-1346-uc05-difficulty-mapping-route-parity.md) · [T-1389](T-1389-uc-coverage-audit-req-004-gap-rejudge.md) 선례). 대신 위 재검산 · row 수 · 표 무결성 grep 3 종으로 대체한다.
- [x] 본 task 파일의 `status` 를 `DONE` 으로 바꾸고 완료 시각 · 결과 요약 (재검산 4 값 포함) 을 추가한다.

## Out of Scope

- **`docs/use-cases/REQ-COVERAGE-AUDIT.md` 수정** — §9 는 T-1389 가 이미 박제했다. 본 slice 는 인용만 하고 audit 문서를 건드리지 않는다 (재검산 결과가 §5 통계와 불일치해도 audit 문서 보정 금지 — Follow-ups 로).
- **UC 문서 (`docs/use-cases/UC-*.md`) 신설·수정** — UC-09 신설 여부 결정 · UC-01 의 `coversReq` 에 REQ-004 추가는 별도 정책 slice (T-1389 Follow-up 2).
- **INDEX.md §2 UC 목록 표 수정** — status 컬럼 · 관련 REQ 컬럼 · component / module 컬럼을 갱신하지 않는다. 본 slice 는 104 행 한 문단만 건드린다.
- **INDEX.md §5 갱신 룰 수정** — 룰 문구는 인용만 한다.
- **`docs/requirements.md` 수정** — REQ-004 (23 행) 상태는 [T-1377](T-1377-requirements-metric-llm-comment-period-status-rejudge.md) 판정 유지.
- **66 REQ 전수 재audit** — 분류 통계 4 값의 **집계 일치 여부만** 검산한다. 개별 REQ 의 분류가 여전히 타당한지는 재판정하지 않는다 (T-1389 Follow-up 3).
- **`src/` · `test/` · `scripts/` · `.github/workflows/` 등 코드 · 코드 주석 변경 일체** — 본 task 는 doc-only direct.

## Suggested Sub-agents

`implementer` (doc-only 재검산 + 한 문단 동기). 코드 변경이 0 이므로 tester 는 생략한다 (CLAUDE.md §3.2 R-110 의 direct-mode doc-only 면제).

## Follow-ups

1. **UC-09 신설 여부 결정** — T-1389 Follow-up 2 그대로 유효. 구현 (`POST /api/assessment-evaluation/period` + ADR-0037 ACCEPTED) 이 UC 없이 선행됐으므로 §6 권장 (a) UC-09 신설 / (b) UC-01 확장 중 택일하는 정책 slice 필요. 확정 시 INDEX.md 104 행 문단과 §2 UC 목록 표를 함께 동기해야 한다.
2. **INDEX.md §2 UC 목록 표의 status 컬럼 실측 대조** — 본 slice 는 row 수 8 불변만 확인했고 각 UC 의 status 값이 실제 진척 (UC 본문 파일 · 관련 task 상태) 과 정합한지는 미검증. 별도 slice 로 재판정 검토.
3. **다른 gap 후보 전수 재audit** — T-1389 Follow-up 3 그대로 유효. 본 slice 는 분류 **집계 일치** 만 검산했고 개별 REQ 분류의 타당성은 재판정하지 않았다.

## 완료 기록

- **완료 시각**: 2026-08-02 (UTC)
- **결과**: `docs/use-cases/INDEX.md` 104 행의 "REQ ↔ UC coverage audit closure" 문단을 §9 재판정과 동기했다. 원 2026-05-25 수치 (48 / 4 / 13 / 1) 와 "UC-09 신설 또는 UC-01 확장 권장" 문구는 그대로 보존하고 (원 출처 2026-05-25) 표기만 부기했으며, 둘째 줄에 `2026-08-02 재판정: REQ-COVERAGE-AUDIT.md §9 참조` pointer 를 T-1389 와 동일 문구 형태로 덧붙이고 재검산 결과 (일치) 와 REQ-004 `gap` 유지 사실만 적었다 (근거 실측값은 §9 위임). 문단은 2 줄 (상한 3 줄 이내). 본 동기는 INDEX.md §5 갱신 룰 4 ("REQ 가 추가·변경·삭제될 때 … 관련 REQ 컬럼을 동기") 가 요구하는 living-document 동기 의무의 이행이다.
- **실측 — 분류 통계 재검산**: `awk -F'|' '/^\| REQ-/{gsub(/ /,"",$4); c[$4]++} END{for(k in c) print k, c[k]}' docs/use-cases/REQ-COVERAGE-AUDIT.md` 출력 = `infrastructure 13` · `uc-covered 48` · `cross-cutting 4` · `gap 1`. §5 통계 표의 4 값 (48 / 4 / 13 / 1) 과 **1:1 완전 일치** (불일치 0 건).
- **실측 — row 수 검산**: `grep -c "^| REQ-" docs/use-cases/REQ-COVERAGE-AUDIT.md` = **66**. 위 4 값의 합 48+4+13+1 = **66** 으로 동일 — 검산 통과.
- **실측 — 파일 무결성**: 편집 후 `wc -l docs/use-cases/INDEX.md` = **107 행** (기준 106 ± 2 범위 내, +1 행은 pointer 줄), `grep -c "^| UC-" docs/use-cases/INDEX.md` = **8** 로 §2 UC 목록 표 row 수 불변. 표 셀 안에 리터럴 `|` 추가 0 (편집 대상은 표 밖 산문 문단).
- **REQ-004 판정 정합**: T-1389 §9.4 의 판정 (`gap` 유지 — UC cover 축 (a) UC-09 파일 0 · (b) coversReq 0/8 · (c) 본문 언급 0, 구현 실재 축은 `POST /api/assessment-evaluation/period` + ADR-0037 ACCEPTED) 과 INDEX 문구가 모순되지 않음을 확인했다. INDEX 에는 "gap 유지" 사실만 적고 실측 근거는 §9 로 위임.
- **한계 —** (1) §2 UC 목록 표의 `status` 컬럼이 각 UC 의 실제 진척과 정합한지, "관련 REQ" 컬럼이 현재 `docs/requirements.md` 66 row 와 일치하는지는 **실측하지 않았다** (본 slice 는 104 행 한 문단 + row 수 8 불변만 검증). (2) 분류 통계는 **집계 일치 여부만** 검산했고 개별 REQ 의 분류 타당성 · UC-09 신설의 정책적 타당성은 재판정하지 않았다 (Follow-ups 1 · 3).
- **변경 파일**: `docs/use-cases/INDEX.md` (+1 행 / -1 행 문단 교체), `docs/tasks/T-1390-uc-index-audit-closure-resync.md` (status DONE + 완료 기록 + Follow-ups).
