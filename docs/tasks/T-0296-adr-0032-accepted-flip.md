---
id: T-0296
title: ADR-0032 status PROPOSED → ACCEPTED flip + relatedTask/relatedPR 백참조 박제
phase: P5
status: PENDING
commitMode: direct
coversReq: [TBD]
estimatedDiff: 12
estimatedFiles: 1
created: 2026-06-09
plannerNote: P5 doc-sync; ADR-0032 계약 전 chain(T-0287~T-0293) shipped 인데 status 여전히 PROPOSED — 한 줄 flip + 백참조. direct doc-only.
---

# T-0296 — ADR-0032 status PROPOSED → ACCEPTED flip + relatedTask/relatedPR 백참조 박제

## Why

ADR-0032(P5 단위 평가 계약)가 박제한 4 결정 — (1) 통합 평가 입력 / (2) LLM scoring 입력 shape / (3) 난이도·기여도·양 산출 / (4) 평가-side dedup + self-follow-up 제외 — 의 구현 chain(T-0287~T-0293)이 전부 main 에 머지됐다(src/assessment-evaluation/ 22 파일, `POST /api/assessment-evaluation/evaluate` 라이브, T-0294 api.md + T-0295 modules.md doc-sync 완결). 그러나 ADR frontmatter 는 여전히 `status: PROPOSED`(line 4) + `relatedTask: T-0286` 단일이라 reality 와 stale 하다. ADR-0032 §"구현 분리" 단락(line 91)이 명시한 "ACCEPTED 전환은 별도(status 한 줄 수정 direct)"를 본 task 가 이행한다. 선례: ADR-0031 이 구현(T-0276) 후 `Status: ACCEPTED (T-0276)` 로 flip 된 패턴 mirror.

## Required Reading

- `docs/decisions/ADR-0032-p5-evaluation-contract.md` (line 1~12 frontmatter + line 89~91 "구현 분리(design-only 박제)" 단락 + line 107~ Follow-ups — flip 대상과 백참조할 chain 확인)
- `docs/decisions/ADR-0031-collection-manual-trigger.md` (line 1~6 — 선례 flip 포맷: `Status: ACCEPTED (T-NNNN)` + 관련 ADR/REQ 백참조 스타일 참고)

## Acceptance Criteria

- [ ] `docs/decisions/ADR-0032-p5-evaluation-contract.md` frontmatter line 4 `status: PROPOSED` → `status: ACCEPTED` 로 변경.
- [ ] frontmatter `relatedTask: T-0286` 를 구현 chain 으로 확장 — `relatedTask: [T-0286, T-0287, T-0288, T-0289, T-0290, T-0291, T-0292, T-0293]` (설계 박제 T-0286 + 구현 7 slice). YAML 리스트 형식 유지.
- [ ] frontmatter 에 `relatedPR: [239, 240, 241, 242, 243, 244, 245]` 1 줄 추가 (각 slice merge PR — T-0287 #239 / T-0288 #240 / T-0289 #241 / T-0290 #242 / T-0291 #243 / T-0292 #244 / T-0293 #245). 머지 commit 으로 검증: `git log origin/main --oneline --grep "T-0287"` ~ `T-0293` 의 (#NNN) 매칭.
- [ ] 본문 line 91 의 "본 ADR status 는 PROPOSED — reviewer/사용자 검토 후 ACCEPTED 전환은 별도(status 한 줄 수정 direct)." 문장을 "본 ADR status 는 **ACCEPTED**(T-0296 flip) — 구현 chain(T-0287~T-0293, PR #239~#245)이 4 결정을 전부 main 에 박제 완료. live LLM run 만 §5 credential 게이트로 deferred." 로 reality 정합 갱신.
- [ ] 변경은 위 4 항목으로 한정 — 단일 파일, ≤15 LOC. `git diff --stat` 가 `docs/decisions/ADR-0032-p5-evaluation-contract.md` 1 파일만 표시하는지 확인.

## Out of Scope

- ADR 본문 §Decision / §Consequences / §Alternatives / §Follow-ups 의 내용 재작성 금지 — 본 task 는 순수 status flip + 백참조 박제. (필요 시 별도 follow-up)
- code / test / CI / package.json 변경 0 — direct doc-only.
- 평가 결과 영속화 schema slice / live LLM run task 등 ADR-0032 Follow-ups 의 잔여 deferred 항목은 본 task 밖 (§5 게이트 / 별도 task).
- modules.md / api.md / PLAN.md 추가 doc-sync 금지 (T-0294/T-0295 에서 이미 완결).
- AssessmentModule/SchedulerModule/WebModule placeholder 정합(executor 관찰 follow-up)은 본 task 밖.

## Suggested Sub-agents

direct doc-only — sub-agent 불요. driver 가 직접 Edit 후 commit. (executor 경유 시 implementer 없이 driver self-edit.)

## Follow-ups

(생성 시점 비어 있음. sub-agent / driver 가 관련 작업 발견 시 추가.)
