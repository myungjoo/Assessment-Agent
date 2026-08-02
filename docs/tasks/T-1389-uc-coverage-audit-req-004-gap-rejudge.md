---
id: T-1389
title: REQ-COVERAGE-AUDIT 의 REQ-004 gap 판정을 2026-08-02 실측으로 재판정하고 amendment 절 박제
phase: P5
status: PENDING
commitMode: direct
coversReq: [REQ-004, REQ-001]
estimatedDiff: 60
estimatedFiles: 2
created: 2026-08-02
independentStream: uc-doc-audit-resync
dependsOn: []
touchesFiles:
  - docs/use-cases/REQ-COVERAGE-AUDIT.md
  - docs/tasks/T-1389-uc-coverage-audit-req-004-gap-rejudge.md
plannerNote: "requirements-status-resync 종결(T-1388) 후 그 Follow-up 2 를 잇는 첫 slice — audit 문서의 REQ-004 gap 판정 stale 여부 실측, doc-only direct"
---

# T-1389 — REQ-COVERAGE-AUDIT 의 REQ-004 gap 판정을 2026-08-02 실측으로 재판정하고 amendment 절 박제

## Why

[T-1388](T-1388-requirements-usecase-basis-status-rejudge.md) 이 `requirements-status-resync` stream 의 마지막 `PLANNED` row 를 처리해 stream 을 종결하면서, Follow-ups 2 번에 "**REQ-004 gap 미해소** — `docs/use-cases/REQ-COVERAGE-AUDIT.md` 18 행이 2026-05-25 audit 시점에 gap 1 건 (REQ-004) 을 검출했으나 그 gap 이 해소됐는지는 확인하지 않았다 (audit 재실행 slice 검토)" 를 남겼다. 그 사이 main 에는 사용자 지정 기간 평가 요청 경로가 `src/assessment-evaluation/assessment-evaluation.controller.ts` 339 행 `@Post("period")` 로 실재하고 [ADR-0037](../decisions/ADR-0037-period-collection-evaluate-bridge.md) 이 그 bridge 를 박제한 반면, audit 문서는 여전히 REQ-004 를 `gap` 으로 두고 "UC-09 신설 권장" 을 §6 에 남겨 저장소 사실보다 뒤처졌을 가능성이 있다. 본 slice 는 **UC 문서 cover 축과 구현 실재 축을 분리해** 실측하고, 2026-05-25 audit 본문(역사적 기록)은 보존한 채 **dated amendment 절**로 재판정 결과만 덧붙인다.

## Required Reading

- `docs/use-cases/REQ-COVERAGE-AUDIT.md` — 전체 구조(1 개요 / 2 분류 정책 / 3 audit 매트릭스 / 5 통계 / 6 gap follow-up / 7 spot check / 8 결론)와 다음 4 spot 의 정확한 행 번호를 먼저 확인한다: 18 행(audit 결과 요약의 "gap 1 건"), 38 행(매트릭스 REQ-004 row), 124 행(통계 표 `gap` row), 131~136 행(§6 REQ-004 절). frontmatter 의 `auditDate: 2026-05-25` · `status: DONE` · `sourceTask: T-0029` 도 확인한다.
- `docs/requirements.md` 23 행 (REQ-004) — [T-1377](T-1377-requirements-metric-llm-comment-period-status-rejudge.md) 이 이미 `IN_PROGRESS (...)` 로 재판정해 둔 상태 문자열의 **충족 축 / 미충족 축 요약만** 인용한다. 근거 본문을 본 task 로 복사하지 않는다 — 본 task 는 requirements.md 를 수정하지 않는다.
- `src/assessment-evaluation/assessment-evaluation.controller.ts` 339 행 부근 — `@Post("period")` 핸들러의 route path 와 method 시그니처 1~2 줄만 확인한다 (구현 실재 축의 1 차 근거). 본문 로직은 읽지 않는다.
- `docs/decisions/ADR-0037-period-collection-evaluate-bridge.md` — frontmatter 의 `status` 값과 제목 한 줄만 확인해 인용한다 (구현 실재 축의 2 차 근거). 본문 재서술 금지.
- UC cover 축 실측용 — `grep -n "coversReq" docs/use-cases/UC-*.md` 로 8 UC 의 `coversReq` 배열에 `REQ-004` 가 등장하는지 전수 확인하고, `ls docs/use-cases/` 로 `UC-09*` 파일 실재 여부를 확인한다.
- UC 본문 cover 축 실측용 — `grep -c "REQ-004" docs/use-cases/UC-*.md` 로 frontmatter 외 본문 언급 건수를 파일별로 센다. 0 건이 아닌 파일이 있으면 그 행을 1 줄 인용한다.
- `docs/tasks/T-1388-requirements-usecase-basis-status-rejudge.md` 의 "완료 기록" — 실측값 서술 포맷 (축별 충족/부재 + 실재 파일 경로 + "한계 —" 부기) 을 그대로 따른다. 그 안의 실측 수치를 본 task 근거로 복사하지 않는다.

## Acceptance Criteria

- [ ] **UC 문서 cover 축** 을 실측한다 — (a) `ls docs/use-cases/` 결과에 `UC-09*` 파일이 존재하는지, (b) 8 UC 의 `coversReq` frontmatter 중 `REQ-004` 를 포함한 파일 수, (c) `grep -c "REQ-004" docs/use-cases/UC-*.md` 의 파일별 본문 언급 건수를 각각 숫자로 적는다.
- [ ] **구현 실재 축** 을 실측한다 — `src/assessment-evaluation/assessment-evaluation.controller.ts` 의 `@Post("period")` 행 번호와 controller 의 base path (`@Controller(...)` 인자) 를 인용해 사용자 지정 기간 평가 요청의 HTTP 진입점 실재 여부를 판정하고, ADR-0037 의 `status` 값을 함께 적는다.
- [ ] **두 축의 분리** 를 결론에 명시한다 — audit 의 `gap` enum 정의 (2 절: "1+ UC 에 cover 안 됐고 cross-cutting 도 infrastructure 도 아닌 functional REQ") 를 인용해, **구현 실재 ≠ UC cover** 임을 한 절로 구분해 적는다. 즉 구현이 생겼다는 사실만으로 gap 을 해소로 바꾸지 않는다.
- [ ] **재판정 결과** 를 다음 중 하나로 확정한다 — (i) `gap 유지` (UC cover 축 여전히 0 → 단 구현 진행 사실을 부기), (ii) `gap 해소` (UC 가 REQ-004 를 cover 하게 됨 → 근거 파일·행 인용), (iii) `분류 변경` (예: `uc-covered` 또는 `cross-cutting` 으로 재분류 → 근거 인용). 어느 판정이든 **실재하는 파일 경로 3 개 이상** 을 근거에 포함한다.
- [ ] `docs/use-cases/REQ-COVERAGE-AUDIT.md` 말미에 **새 절 `## 9. 2026-08-02 재판정 (T-1389)`** 을 추가해 위 실측값 · 판정 · 한계를 박제한다. **2026-05-25 audit 본문(1~8 절)의 수치·판정 서술은 역사적 기록으로 보존** 하고 재작성하지 않는다.
- [ ] 다음 3 spot 에 §9 로 향하는 pointer 를 **한 줄씩만** 인라인 부기한다 — 18 행 (audit 결과 요약), 38 행 (매트릭스 REQ-004 row), 124 행 (통계 표 `gap` row). pointer 문구는 "2026-08-02 재판정: §9 참조" 형태로 통일한다.
- [ ] **표 무결성** 을 확인한다 — 38 행 · 124 행 편집 후 `|` 필드 수가 각 표의 헤더 행 및 인접 행과 동일함을 확인하고, 표 셀 안에 리터럴 `|` 문자를 넣지 않는다 (grep alternation `\|` 도 금지 — 중점 · 로 나열). [T-1370](T-1370-requirements-fork-rebase-dedup-status-rejudge.md) · [T-1375](T-1375-requirements-org-document-contribution-score-status-rejudge.md) 사고 재발 방지.
- [ ] `grep -c "^| REQ-" docs/use-cases/REQ-COVERAGE-AUDIT.md` 값이 편집 전후 불변임을 확인하고, 그 값을 완료 기록에 적는다 (매트릭스 row 수 보존 검산).
- [ ] 실측으로 확인되지 않은 부분 (예: UC-09 신설 여부의 정책적 타당성 · REQ-004 의 프런트 노출 축 · 다른 gap 후보의 전수 재audit 미수행 등) 을 §9 안에 "한계 —" 로 1~2 절 부기한다.
- [ ] **R-112 대체 검증** — 본 task 는 `commitMode: direct` 문서 전용이라 production 코드 0 LOC · 신규 public symbol 0 · 신규 분기 0 이므로 happy-path / error path / 분기 / negative cases 각각에 대응하는 신규 test 대상이 **없다** ([T-1327](T-1327-uc01-uc05-step-count-realign.md) · [T-1346](T-1346-uc05-difficulty-mapping-route-parity.md) 선례). 대신 위 표 무결성 · row 수 검산 grep 으로 대체한다.
- [ ] 본 task 파일의 `status` 를 `DONE` 으로 바꾸고 완료 시각 · 결과 요약 (실측값 포함) 을 추가한다.

## Out of Scope

- **`docs/requirements.md` 수정** — REQ-004 (23 행) 상태 컬럼은 [T-1377](T-1377-requirements-metric-llm-comment-period-status-rejudge.md) 이 이미 재판정했다. 본 slice 는 인용만 하고 건드리지 않는다.
- **UC 문서 (`docs/use-cases/UC-*.md`) 신설·수정** — UC-09 를 새로 만들거나 UC-01 / UC-02 의 `coversReq` 에 REQ-004 를 추가하지 않는다. 필요 판단이 서면 Follow-ups 에만 적는다 (별도 slice).
- **`docs/use-cases/INDEX.md` 수정** — 104 행의 audit closure 요약이 §9 와 어긋나 보여도 본 slice 에서 고치지 않는다. Follow-ups 에 적는다.
- **66 REQ 전수 재audit** — 3 절 매트릭스 전체를 다시 판정하지 않는다. 본 slice 는 REQ-004 1 건 + 그 pointer 3 spot 으로 범위를 한정한다.
- **audit frontmatter 의 `auditDate` · `status` 변경** — 2026-05-25 audit 의 정체성을 바꾸지 않는다 (재판정은 §9 안에서만 표현).
- **`src/` · `test/` · `scripts/` · `.github/workflows/` 등 코드 · 코드 주석 변경 일체** — 본 task 는 doc-only direct.
- **ADR-0037 본문 재서술 또는 status 변경**.

## Suggested Sub-agents

`implementer` (doc-only 실측 + amendment 절 박제). 코드 변경이 0 이므로 tester 는 생략한다 (CLAUDE.md §3.2 R-110 의 direct-mode doc-only 면제).

## Follow-ups

(작성 시점 비어 있음 — sub-agent 가 관련 작업 발견 시 append)
