---
id: T-0571
title: PLAN bullet 106 Q-0045 run-side chain 완결 doc-sync + ADR-0048 PROPOSED→ACCEPTED flip
phase: P5
status: DONE
commitMode: direct
coversReq: [REQ-037, REQ-051]
estimatedDiff: 40
estimatedFiles: 3
independentStream: q0045-run-side-default-model
dependsOn: [T-0570]
touchesFiles:
  - docs/PLAN.md
  - docs/decisions/ADR-0048-default-model-id-source.md
  - docs/architecture/deployment.md
created: 2026-06-22
plannerNote: P5 bullet106 ADR-0048 §Out-of-scope chain item(5) — run-side 사슬 완결 doc-sync + ADR-0048 status ACCEPTED flip; T-0570 머지로 DTO 필드 제거 닫힘
---

# T-0571 — PLAN bullet 106 chain 완결 doc-sync + ADR-0048 ACCEPTED flip

## Why

[ADR-0048 §Out of scope](../decisions/ADR-0048-default-model-id-source.md) 가 chain item(5) 로 박제한 **"PLAN.md bullet 106 의 chain 완결 표기 + REQ-051 진입 시 후속 ADR 이 prerequisite 임을 명시"** 를 수행한다. Q-0045 옵션1 run-side 사슬은 순수 조각(T-0556~T-0563) → @Injectable orchestrator(T-0564) → controller route(T-0565) → e2e(T-0566) → ADR-0048(T-0567) → resolver(T-0568) → controller resolver wiring(T-0569) → request body `defaultModelId` 필드 제거(T-0570, PR #484 squash c2e7c0c **머지 완료**)로 닫혔다. 이제 PLAN.md bullet 106 (`평가 재실행·부분 reset (R-64)`) 은 run-side 사슬 완결 상태를 미반영한 `[ ]` 로 남아있어 doc 정합이 깨져 있다. 동시에 ADR-0048 의 결정안이 구현 사슬(item 1~3)로 전부 박제됐으므로 status 를 PROPOSED→ACCEPTED 로 flip 한다 (CLAUDE.md §3.1 rule 4 — ADR status 한 줄 flip 은 `direct`).

## Required Reading

- `docs/decisions/ADR-0048-default-model-id-source.md` (frontmatter `status: PROPOSED` line 4 + `relatedPR: null` line 7 + `relatedTask: [T-0567]` line 6 + §Out of scope "PLAN.md doc-sync" 항목)
- `docs/PLAN.md` L94~110 (P5 Evaluation pipeline 섹션 — bullet 106 `평가 재실행·부분 reset (R-64)` + 인접 완결 bullet 의 doc-sync 표기 양식 참조)
- `docs/architecture/deployment.md` L160~162 (`지원 LLM 환경 = 배포 config` 단락 — line 162 의 `[ADR-0048](...) PROPOSED` 참조)
- 본 task 파일 외 코드/spec 읽기 금지 — 본 task 는 doc-only direct.

## Acceptance Criteria

- [ ] `docs/PLAN.md` 의 bullet 106 (`평가 재실행·부분 reset (R-64)`) 에 Q-0045 옵션1 run-side 사슬 완결 표기를 append 한다. 인접 완결 bullet 의 양식(굵게 `(완료)` 또는 `(부분 완료)` + 핵심 task ID·머지 경로 1~2줄)을 따른다. 최소 명시 사항: (1) Q-0045 옵션1 run-side 사슬이 `POST /api/assessment-evaluation/unevaluated-fill-run` 까지 닫힘(REQ-037), (2) 핵심 task chain T-0556~T-0570(순수 조각→orchestrator→controller route→e2e→ADR-0048→resolver→controller wiring→DTO 필드 제거), (3) defaultModelId 의 source 가 server-side `LlmProviderConfigResolver`(ADR-0048)로 단일화됨. bullet 의 checkbox 는 R-64 의 "재실행·부분 reset" 중 unevaluated-fill-run(부분 재실행) 만 cover 했으므로 — overwrite/reset 잔여(bullet 107 DEFERRED)와의 관계를 고려해 **`[ ]` 유지하되 부분 완료 주석** 으로 표기하거나, R-64 의 본 사슬 cover 범위를 명확히 구분해 적는다(judgment).
- [ ] `docs/PLAN.md` 에 **REQ-051(custom 3 model 슬롯) 진입 시 다중-row default 선택 정책 후속 ADR 이 prerequisite** 임을 1줄 명시한다 (ADR-0048 §Decision 2 / §Out of scope 정합). bullet 99(REQ-051 / 3 model 슬롯) 인접 또는 bullet 106 주석에 배치 — 위치는 judgment, 단 REQ-051 task 큐잉 시 본 후속 ADR 을 선행으로 읽을 수 있게 link 형태로 박제.
- [ ] `docs/decisions/ADR-0048-default-model-id-source.md` frontmatter 의 `status: PROPOSED` → `status: ACCEPTED` 로 flip + `relatedPR: null` → 사슬 구현 PR 목록(최소 #482·#483·#484 중 본문 흐름에 맞게) 반영 + `relatedTask` 에 구현 task(T-0568·T-0569·T-0570) 추가. 본문 상단 `> 본 ADR 은 **PROPOSED**` 도입 문장도 ACCEPTED 로 갱신(구현 사슬 완결을 1줄 반영).
- [ ] `docs/architecture/deployment.md` L162 의 `[ADR-0048](../decisions/ADR-0048-default-model-id-source.md) PROPOSED` 참조를 `ACCEPTED` 로 동기.
- [ ] 변경 후 `docs/STATE.json` 은 만지지 않는다(driver 책임). 본 task 는 PLAN/ADR/deployment 3 doc 만 수정.
- [ ] (선택) ADR-0048 본문에 "구현 사슬 완결: item1 resolver(T-0568) · item2 DTO 필드 제거(T-0570) · item3 controller wiring(T-0569) 머지됨; 남은 후속 = REQ-051 다중-row ADR(deferred) + 비어있지-않은 좌표 live-LLM round-trip(LAN 수동)" 1~2줄 박제(중복 회피 — 이미 §Out of scope 에 있으면 status 줄만).

## Out of Scope

- `src/` / `test/` / spec 변경 — 본 task 는 doc-only direct. 코드 동작 변경 0.
- REQ-051 다중-row default 정책 후속 ADR 신설 — chain item(4), deferred(본 task 는 "prerequisite 임을 명시" 만, ADR 본문 작성 아님).
- 비어있지-않은 좌표 live-LLM round-trip 1회 — chain item(6), LAN(AKIHA 192.168.0.5 Ollama) 수동 검증, cloud cron LAN 무경로 standing 게이트(ADR-0045). 본 task 에서 다루지 않음.
- bullet 107 (overwrite / 재평가 DEFERRED) 의 상태 변경 — 본 사슬 범위 밖(Q-0032 first-write-wins 유지).
- ADR-0048 의 결정 내용 자체 변경 — status flip + 구현 사슬 완결 박제만, Decision §1~§4 내용 수정 0.

## Suggested Sub-agents

(direct doc-only task — executor 가 직접 편집, sub-agent dispatch 불요)

## Follow-ups

(생성 시 비어있음)

## Status

- **DONE** (2026-06-21T21:37:49Z, cron@claude-cloud-2137z, direct doc-only)
- 변경: `docs/PLAN.md`(bullet 106 chain 완결 표기 + REQ-051 다중-row default 후속 ADR prerequisite link, checkbox `[ ]` 유지) · `docs/decisions/ADR-0048-default-model-id-source.md`(status PROPOSED→ACCEPTED, relatedTask +T-0568/T-0569/T-0570, relatedPR [482,483,484], 도입문 사슬완결 1줄) · `docs/architecture/deployment.md`(L162 ADR-0048 참조 PROPOSED→ACCEPTED). +6/-6 (3 doc).
- Acceptance Criteria 5종 전부 충족. STATE.json 미변경(driver bookkeeping 책임). Q-0045 옵션1 run-side chain(T-0556~T-0571) 완결.
