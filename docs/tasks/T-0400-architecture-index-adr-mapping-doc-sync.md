---
id: T-0400
title: architecture INDEX.md ADR 매핑 표 doc-sync (ADR-0040 PROPOSED→ACCEPTED + ADR-0041 신규 row)
phase: P4-complete / P5-in-progress
status: DONE
commitMode: direct
coversReq: [REQ-038]
estimatedDiff: 18
estimatedFiles: 1
created: 2026-06-14
dependsOn: []
touchesFiles: [docs/architecture/INDEX.md]
independentStream: p6-frontend-doc-sync
plannerNote: P6-closure doc-sync 가족 ⑥ — INDEX.md ADR 매핑 표의 ADR-0040 PROPOSED→ACCEPTED 정정 + ADR-0041 누락 row 추가(genuine stale)
---

# T-0400 — architecture INDEX.md ADR 매핑 표 doc-sync

## Why

P6 composition-wiring 스트림(T-0353~T-0394)이 완결되고 ADR-0040(React+Vite)·ADR-0041(composition-wiring)이 모두 ACCEPTED 됐는데, architecture 디렉토리의 canonical 인덱스인 `docs/architecture/INDEX.md` 의 ADR 매핑 표는 두 군데가 stale 하다 — (1) ADR-0040 row 상태가 아직 `PROPOSED (T-0351)`(실제는 T-0377 에서 ACCEPTED flip 됨), (2) **ADR-0041 row 가 표에서 통째로 누락**. T-0395(modules.md)·T-0396(PLAN.md)·T-0397(directory.md)·T-0398(components.md)·T-0399(deployment.md) 가 완성한 P6-closure doc-sync 가족의 마지막 genuine 잔여 멤버다. INDEX.md 가 다른 architecture 문서를 찾는 진입점이므로 ADR 상태가 틀리면 후속 작업의 출발 정보가 오염된다.

## Required Reading

- `docs/architecture/INDEX.md` — 갱신 대상 (특히 line 50 ADR-0040 row 와 "## ADR 매핑" 표 전체)
- `docs/decisions/ADR-0040-frontend-stack.md` — frontmatter `status: ACCEPTED` / `date: 2026-06-11` / `relatedTask: T-0351` 확인 (상태는 ACCEPTED, T-0377 에서 flip)
- `docs/decisions/ADR-0041-frontend-composition-wiring.md` — frontmatter `status: ACCEPTED` / `relatedTask: T-0376` 확인 (신규 row 작성 근거)

## Acceptance Criteria

- [ ] INDEX.md "## ADR 매핑" 표의 ADR-0040 row 상태를 `PROPOSED (T-0351)` → `ACCEPTED (T-0377 flip)` 로 정정한다. "영향받는 view 문서" 컬럼에 기존 `deployment.md + directory.md` 에 더해 P6 doc-sync 가 갱신한 `modules.md`·`components.md` 를 반영(예: `deployment.md + directory.md + modules.md + components.md`).
- [ ] INDEX.md "## ADR 매핑" 표에 **ADR-0041 신규 row 1개**를 추가한다 — 링크 `[ADR-0041](../decisions/ADR-0041-frontend-composition-wiring.md)`, 한 줄 요약(composition-wiring 전환: App.tsx 조립 구조·무라우터 view 전환·fetch hook 경계·R-78 보호 배선·non-parallel single-claim stream), 영향받는 view 문서(modules.md + components.md + directory.md), 상태 `ACCEPTED (T-0376/T-0377)`. ADR-0040 row 바로 아래에 배치.
- [ ] (선택) "## 문서 목록" 표에 `frontend-api-contract.md` 외 P6 doc-sync 로 갱신된 문서가 있으면 상태 컬럼 stale 여부만 확인 — 사실과 다르면 한 줄 정정, 맞으면 변경 없음(이 항목은 over-edit 회피, 실제 stale 만 손댄다).
- [ ] doc-only 변경만 — `src/`·`web/`·`test/`·코드/CI/manifest 변경 0. `grep -rn "PROPOSED" docs/architecture/INDEX.md` 결과에 ADR-0040 row 가 더 이상 없어야 한다.
- [ ] 변경은 INDEX.md 단일 파일에 국한(다른 architecture 문서·ADR 본문 미변경 — ADR frontmatter 는 이미 ACCEPTED 라 손대지 않음).

## Out of Scope

- ADR-0040 / ADR-0041 본문 또는 frontmatter 변경 (이미 ACCEPTED — 본 task 는 INDEX.md 색인만 동기).
- 다른 architecture 문서(modules.md / components.md / directory.md / deployment.md / PLAN.md) 본문 변경 — 이미 T-0395~T-0399 에서 doc-sync 완료.
- backend-게이트 잔여 stream(import 결과 상세 / GroupMember add/remove mutation / SchedulePanel(P7) / ReEvaluationTriggerPanel / R-78 auto-polling) 박제 — 본 doc-sync 범위 아님(중복 박제 금지, 링크만).
- 코드·테스트·CI·dependency 변경 일체.

## Suggested Sub-agents

`implementer` (doc-only 단일 파일 edit) — direct doc-only 이므로 tester 면제(§3.2: 코드 0 LOC).

## Follow-ups

(없음 — 생성 시점)

## 결과 (DONE 2026-06-14)

direct doc-only, main `a2744dd` (loop@vb707106 t1). INDEX.md ADR 매핑 표 +2/-1: ADR-0040 row `PROPOSED (T-0351)`→`ACCEPTED (T-0377 flip)` + 영향 view 문서에 `modules.md`·`components.md` 추가, ADR-0041 신규 row(composition-wiring, view=modules/components/directory, `ACCEPTED (T-0376/T-0377)`) 를 ADR-0040 바로 아래 삽입. ADR frontmatter 실측으로 양쪽 ACCEPTED 확인. grep `PROPOSED` 가 ADR-0040 row 0 match. (선택) 문서 목록 표는 genuine stale 부재라 미변경(over-edit 회피). tester 면제(§3.2 direct doc-only). CI run a2744dd in_progress(doc-only trivially green 예상, 다음 turn 재확인).
