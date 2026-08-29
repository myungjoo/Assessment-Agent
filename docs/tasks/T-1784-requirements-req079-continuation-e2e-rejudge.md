---
id: T-1784
title: Re-judge REQ-079 against the shipped person-identity continuation e2e
phase: P5
status: DONE
commitMode: direct
coversReq: [REQ-079]
independentStream: service-identity-doc-sync
dependsOn: [T-1783]
touchesFiles:
  - docs/requirements.md
estimatedDiff: 40
estimatedFiles: 1
created: 2026-08-29
completedAt: 2026-08-29T14:45:00Z
plannerNote: P5 / ADR-0058 §Follow-ups (e) 잔여 — T-1783 연속 동선 e2e shipped 실측으로 REQ-079 최종 재판정 (doc-only)
---

# T-1784 — 인원 추가·수정 → 매핑 연속 동선 e2e shipped 실측으로 REQ-079 재판정

## Why

[T-1782](T-1782-requirements-req079-autoselect-rejudge.md) 는 REQ-079 를 축별로 재판정하면서 **잔여 (1) 동선 연결 = 해소** / **잔여 (2) e2e 연속 동선 고정 = 미충족** 으로 적고 상태 토큰을 `IN_PROGRESS` 로 유지했다. 그 잔여 (2) 는 [T-1783](T-1783-person-identity-continuation-e2e.md) 이 `test/e2e/person-identity-continuation.e2e-spec.ts` 를 신설·머지(PR #1409)하며 **실제로 해소** 됐는데, [requirements.md](../requirements.md) `98 행` 의 REQ-079 행은 여전히 "`test/e2e/service-identities.e2e-spec.ts` 는 identity API 5 route 만 덮을 뿐 연속 동선을 고정하지 않는다 … 남은 slice 는 하나" 라고 적혀 있다 — 머지된 사실과 추적 표가 어긋난 drift 다.

본 slice 는 그 한 행만 실측 좌표로 최종 재판정해 [ADR-0058](../decisions/ADR-0058-service-identity-management-api.md) `§Follow-ups (e)` 의 REQ-079 축을 닫는다. 코드 변경 0 · 기존 문서 1 행의 inline-amend 이므로 [CLAUDE.md §3.1](../../CLAUDE.md) 판정 1 에 따라 `commitMode: direct`.

## Required Reading

- [docs/requirements.md](../requirements.md) `1~12 행` (운영 룰 · 상태 enum `PLANNED` / `IN_PROGRESS` / `DONE` / `BLOCKED` / `SUPERSEDED` · 검증 위치 enum · 7 컬럼 schema) 와 `98 행` (REQ-079 행 본문 — 유일한 수정 대상)
- [docs/tasks/T-1782-requirements-req079-autoselect-rejudge.md](T-1782-requirements-req079-autoselect-rejudge.md) `## Why` 와 완료 기록 — 직전 재판정이 정의한 잔여 (1) · (2) 의 정확한 범위
- [test/e2e/person-identity-continuation.e2e-spec.ts](../../test/e2e/person-identity-continuation.e2e-spec.ts) — 잔여 (2) 를 닫은 **검증 실체**. 특히 `61 행` describe 제목, `108 행` (생성 축 happy) · `134 행` (수정 축 happy) · `164 행` · `180 행` (자동 승격 분기 ① · ②) · `204 행` · `216 행` (error path) · `230 행` · `242 행` · `255 행` · `273 행` (401 / 403 / 404 / 409 negative) 의 `it(...)` 제목
- [docs/decisions/ADR-0058-service-identity-management-api.md](../decisions/ADR-0058-service-identity-management-api.md) `§Follow-ups (d)·(e)` (약 `276~285 행`) — 본 slice 가 닫는 범위 경계 (ADR 본문 자체는 이번에 수정하지 않는다)

## Acceptance Criteria

- [ ] `docs/requirements.md` 의 REQ-079 행 (`98 행`) 이 **잔여 (2) 해소** 사실로 갱신된다 — 최소 신규 spec 경로 `test/e2e/person-identity-continuation.e2e-spec.ts` 를 인용하고, `ls test/e2e/person-identity-continuation.e2e-spec.ts` 가 exit 0 임을 확인한 뒤 인용한다.
- [ ] 상태 토큰이 실측에 맞게 재판정된다 — 잔여 (1) (T-1780 · T-1781 동선 연결) 과 잔여 (2) (T-1783 연속 동선 e2e) 가 **둘 다 해소** 임을 근거로 `IN_PROGRESS` → `DONE` 으로 승격하거나, 실측에서 여전히 미충족인 축이 발견되면 `IN_PROGRESS` 를 유지하고 **그 잔여를 한 줄로 명시** 한다. 어느 쪽이든 **근거 없이 토큰만 바꾸지 않는다** — 판정 문장이 (1) · (2) 각각의 충족 이유를 적어야 한다.
- [ ] 근거 문장이 e2e 의 **실제 cover 범위** 를 사실대로 적는다 — happy 2 축(생성 / 수정) · 자동 승격 분기 2 종 · error path · 401 / 403 / 404 / 409 negative 를 인용하되, `grep -n "it(" test/e2e/person-identity-continuation.e2e-spec.ts` 결과에 없는 케이스를 만들어 적지 않는다.
- [ ] 검증 위치 컬럼은 `unit + e2e` 를 유지하되(web colocated spec 2 개 = unit 축, 신규 supertest spec = e2e 축), `docs/requirements.md` `10 행` 의 검증 위치 enum 밖의 새 토큰을 만들지 않는다.
- [ ] REQ-079 의 "구현 위치" 컬럼에 e2e 고정 slice ID `T-1783` 이 comma 로 추가된다 (`grep -c "T-1783" docs/requirements.md` ≥ 1). 기존에 적힌 `T-1766` · `T-1767` · `T-1768` · `T-1777` · `T-1778` · `T-1780` · `T-1781` 은 삭제하지 않는다.
- [ ] 7 컬럼 schema 가 깨지지 않는다 — 수정 후 REQ-079 행의 `|` 구분자 개수가 표의 다른 행과 같고, 행 안에 개행이 들어가지 않는다.
- [ ] 변경 파일은 `docs/requirements.md` **1 개뿐** — `git status --short` 에 다른 production 파일이 나타나지 않는다 (task 파일 · STATE · journal 은 driver bookkeeping 소관이라 예외).
- [ ] doc-only direct 이므로 코드 0 LOC — [CLAUDE.md §3.2](../../CLAUDE.md) R-110 의 tester 의무와 R-112 4 항목(happy / error path / 분기 / negative)은 **적용 대상 없음**. 대신 인용 좌표가 실제 파일과 일치하는지 grep 으로 검증하는 것으로 대체한다.

## Out of Scope

- **ADR-0058 본문 수정 금지** — `§Status` · `§Follow-ups (d)·(e)` 의 closure 표기는 별도 direct doc slice 소관이다. 본 slice 는 `docs/requirements.md` 한 파일만 건드린다.
- **REQ-078 을 포함한 다른 REQ 행 수정 금지** — REQ-079 행 외의 어떤 행도 문체 통일 목적으로도 손대지 않는다.
- **PLAN.md `132 행` 마커 변경 금지** — bullet 승격 판정은 별도 slice.
- **코드 · spec 변경 0** — `web/` · `src/` · `test/` 어느 파일도 수정하지 않는다. e2e 에 케이스를 더 추가하고 싶어도 Follow-ups 에만 적는다.
- **표 schema · enum 변경 금지** — 7 컬럼 구조 · 상태 enum 5 값 · 검증 위치 enum 값 자체를 늘리거나 줄이지 않는다.

## Suggested Sub-agents

`implementer` (doc-only 1 행 inline-amend — architect · tester 불요)

## Follow-ups

(작성 시점 비어 있음 — sub-agent 가 관련 작업을 발견하면 여기에 추가)
