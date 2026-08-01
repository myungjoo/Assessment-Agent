---
id: T-1365
title: requirements.md 50 행 REQ-031 재수집 중복 방지 + 최근 1주 재수집 상태를 실측 기반 재판정
phase: P7
status: PENDING
commitMode: direct
coversReq: [REQ-031]
estimatedDiff: 16
estimatedFiles: 2
created: 2026-08-01
independentStream: requirements-status-resync
dependsOn: []
touchesFiles:
  - docs/requirements.md
  - docs/tasks/T-1365-requirements-recollection-dedup-status-rejudge.md
plannerNote: "requirements-status-resync 11 번째 slice — T-1364 Follow-ups 가 지목한 REQ-031 (commit-dedup/page-dedup/recollection-window 실재로 PLANNED stale 의심)"
---

# T-1365 — requirements.md 50 행 REQ-031 재수집 중복 방지 + 최근 1주 재수집 상태를 실측 기반 재판정

## Why

[docs/requirements.md](../requirements.md) 50 행 REQ-031 (README 58 행 — "재수집 시 중복 방지 + 최근 1주 재수집 허용") 은 아직 상태 컬럼이 `PLANNED` 이지만, `src/assessment-collection/domain/` 에 `commit-dedup.ts` · `page-dedup.ts` · `recollection-window.ts` 와 각각의 colocated spec 이 main 에 실재해 표가 실제 코드베이스와 어긋난다. T-1364 Follow-ups 가 다음 slice 후보로 명시적으로 지목한 row 이며, `requirements-status-resync` stream 의 11 번째 slice 로 표를 requirements 추적의 신뢰 가능한 single source of truth 로 되돌린다.

## Required Reading

- `docs/requirements.md` — 50 행 (REQ-031) 및 9 행의 상태 enum 정의
- `docs/tasks/T-1364-requirements-export-restore-status-rejudge.md` — 직전 slice 의 상태 문자열 서술 포맷 (`DONE (implemented-on-main — <근거>)` + `한계 — ...`) 을 그대로 따른다
- `README.md` 58 행 — REQ-031 의 원문 지시 (중복 방지 축 + 최근 1주 재수집·중복 제거 축 + 뒤늦은 push 누락 방지 축)
- `src/assessment-collection/domain/commit-dedup.ts` · `src/assessment-collection/domain/page-dedup.ts` — 중복 판정 키/알고리즘 실측
- `src/assessment-collection/domain/recollection-window.ts` — "최근 1주" window 산정 로직 실측 (기본 일수 상수 포함)
- `src/assessment-collection/github-collection.service.ts` · `src/assessment-collection/confluence-collection.service.ts` — 위 domain helper 가 실제 수집 경로에 배선돼 있는지 확인

## Acceptance Criteria

- [ ] `commit-dedup.ts` · `page-dedup.ts` 의 export 심볼과 중복 판정 키 (예: commit sha / page id+version) 를 실측해 상태 문자열에 근거로 인용한다 (추측한 심볼명·키를 적지 않는다).
- [ ] `recollection-window.ts` 를 실측해 "최근 1주" 재수집 window 의 기본 일수 값과 산정 함수명을 확인하고 상태 문자열에 인용한다. 값이 7 일이 아니면 실제 값을 그대로 적는다.
- [ ] 위 domain helper 가 `github-collection.service.ts` · `confluence-collection.service.ts` 중 어디에서 호출되는지 grep 으로 확인해 (예: `grep -n "commit-dedup\|recollection-window" src/assessment-collection/*.ts`), 배선 여부를 상태 문자열에 명시한다. 배선이 확인되지 않으면 DONE 근거로 쓰지 않는다.
- [ ] 관련 spec 파일 목록과 각 파일의 `it(` 개수를 실측해 (예: `grep -c "it(" src/assessment-collection/domain/commit-dedup.spec.ts`), 검증 위치 컬럼 `unit` 이 실제 근거를 갖는지 확인한 뒤 개수를 상태 문자열에 인용한다.
- [ ] REQ-031 (50 행) 의 상태 컬럼을 실측 결과에 따라 `PLANNED` → `DONE (implemented-on-main — <근거>)` 또는 근거 부족 시 `PLANNED` 유지 + 유지 사유 부기 중 하나로 갱신한다. 근거에는 실재하는 소스 파일 경로 2 개 이상 + spec 파일 경로 1 개 이상이 포함돼야 한다.
- [ ] README 원문의 세 축 중 실측으로 확인되지 않은 부분 (특히 "뒤늦게 push 된 과거 자료를 놓치지 않는다" 축 — 재수집 window 밖의 late-arriving 데이터 보정 경로가 있는지, 주기 수집 scheduler 가 실재하는지) 은 상태 문자열 안에 "한계 —" 로 1~2 절 부기한다. 확인되지 않은 사실을 DONE 근거로 쓰지 않는다.
- [ ] `grep -n "REQ-031" docs/requirements.md` 결과에서 해당 행의 상태 컬럼이 갱신됐고, 표의 컬럼 수 (`|` 구분 8 개) 가 인접 행 (REQ-030 · REQ-032) 과 동일하게 유지됨을 확인한다. `wc -l docs/requirements.md` 와 `grep -c "^| REQ-" docs/requirements.md` 값이 편집 전후 불변임도 확인한다.
- [ ] 본 task 파일의 `status` 를 `DONE` 으로 바꾸고 완료 시각·결과 요약 (실측값 포함) 을 추가한다.

## Out of Scope

- 상태 컬럼 외 다른 컬럼 (README 행 번호 · 분류 · phase · 구현 위치 · 검증 위치) 수정 — 검증 위치 컬럼 재판정은 별도 slice 다.
- `src/` · `test/` · `prisma/` 등 코드 변경 일체 (본 task 는 `commitMode: direct` doc-only). dedup / window 로직 결함이 보여도 고치지 않는다.
- 주기 수집 scheduler · late-arriving 데이터 보정 경로의 신규 구현 (발견된 gap 은 Follow-ups 에만 적는다).
- 새 ADR 작성 또는 기존 ADR status 변경.
- REQ-031 외 다른 `PLANNED` row 재판정 (다음 slice 로 미룬다). 특히 인접한 REQ-033 (건별 기여도·난이도·양) 은 건드리지 않는다.

## Suggested Sub-agents

`implementer` (doc-only 실측 + 표 갱신). 코드 변경이 0 이므로 tester 는 생략한다 (CLAUDE.md §3.2 R-110 의 direct-mode doc-only 면제).

## Follow-ups

- 실측 중 확인된 gap (본 task 범위 밖, 구현 금지): `scheduling.module.ts` 의 `CRON_TICK_HANDLER` 기본 provider 가 logging no-op stub 이라 주기 수집이 실 평가 pipeline 에 미결선이다. 자동 주기 재수집 결선은 별도 pr-mode task 로 분리 필요.
- window (기본 7 일) 밖에서 뒤늦게 push 된 과거 자료를 잡는 보정 경로가 부재하다 — 현재는 manual `backfill.controller.ts` 호출 의존. 보정 정책은 ADR-first 로 다룰 후보.
- 다음 `requirements-status-resync` slice 후보: REQ-033 (58 행 인접, 건별 기여도·난이도·양) 이 여전히 `PLANNED` 인지 실측 재판정.
