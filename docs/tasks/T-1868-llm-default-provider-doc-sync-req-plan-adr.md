---
id: T-1868
title: 기본 provider 정책 doc-sync — REQ-049/051 표기 + PLAN 106 행 + ADR-0048/0062 status
phase: P5
status: PENDING
commitMode: direct
coversReq: [REQ-049, REQ-051]
independentStream: llm-default-provider
dependsOn: [T-1865, T-1866, T-1867]
touchesFiles:
  - docs/requirements.md
  - docs/PLAN.md
  - docs/decisions/ADR-0048-default-model-id-source.md
  - docs/decisions/ADR-0062-llm-default-provider-explicit-selection.md
estimatedDiff: 30
estimatedFiles: 4
created: 2026-09-03
plannerNote: "오너 지시 2026-09-03 chain 7/7 — 구현 후 1 회 재판정 (CLAUDE.md §3.1 rule 6). ADR status 승격 + supersede 한 줄은 direct 허용 (rule 4·5)"
---

# T-1868 — 기본 provider 정책 doc-sync — REQ-049/051 표기 + PLAN 106 행 + ADR-0048/0062 status

## Why

chain T-1862 ~ T-1867 이 모두 머지된 뒤 **1 회만** 문서를 실측에 맞춘다 (CLAUDE.md §3.1 rule 6 — 구현 전 재판정 금지). 대상은 상태 표기 · pointer 뿐이며 결정 내용 변경은 없다 (rule 4 · 5 로 direct).

## Required Reading

- [docs/requirements.md](../requirements.md) `69~74 행` — REQ-050 ~ REQ-055 행. REQ-049 행 (Admin LLM 모델 지정) 도 같은 표.
- [docs/PLAN.md](../PLAN.md) — **행 좌표를 신뢰하지 말고 문구로 재탐색한다**(본 chain 진행 중에도 bullet 이 추가·이동한다). 대상 3 곳: R-96 bullet (`Admin 이 LLM 모델 지정` 로 grep), ADR-0048 deferred 문장 (`후속 ADR 이 prerequisite` 로 grep), 본 chain 을 큐잉한 2026-09-03 오너 지시 bullet (`다중-row LlmProviderConfig 기본 provider 선택` 으로 grep).
- [docs/decisions/ADR-0048-default-model-id-source.md](../decisions/ADR-0048-default-model-id-source.md) `50~57 행` §Decision 2.
- [docs/decisions/ADR-0062-llm-default-provider-explicit-selection.md](../decisions/ADR-0062-llm-default-provider-explicit-selection.md) frontmatter status.
- 머지된 PR 번호 / squash SHA — `git log --grep "T-186[3-7]"` 로 실측.

## Acceptance Criteria

- [ ] ADR-0062 frontmatter `status: PROPOSED` → `ACCEPTED` + 헤더 인용문에 구현 chain PR 번호.
- [ ] ADR-0048 §Decision 2 첫 줄에 "**(superseded by [ADR-0062](ADR-0062-llm-default-provider-explicit-selection.md) — 2026-09 오너 지시, 명시 선택 최우선)**" 한 줄. 본문 나머지 무변경.
- [ ] requirements.md REQ-049 · REQ-051 행의 비고에 "기본 provider 명시 선택 (Web UI, ADR-0062)" 반영. REQ-051 의 "custom 3 model 슬롯" 자체는 여전히 미구현이므로 status 는 실측대로 (DONE 표기 승격 금지 — 본 chain 은 prerequisite 만 닫았다).
- [ ] PLAN.md 의 "REQ-051 진입 시 … 후속 ADR 이 prerequisite (deferred)" 문장(행 좌표 아닌 문구로 탐색)을 "ADR-0062 로 닫힘 (T-1862~T-1867)" 으로 교체. 2026-09-03 오너 지시 bullet 은 `[x]` + 머지 PR 목록.
- [ ] `docs/architecture/modules.md` 의 LlmModule 행에 "기본 provider 슬롯 재지정" 구절 추가 (T-1865 reviewer MINOR 흡수 — 2026-09-05).
- [ ] markdown link 깨짐 0 (`git grep` 로 대상 파일 존재 확인). JSON 무변경.

## Out of Scope

- 코드 · schema · seed 변경. UC-05 본문 개정 (필요하면 별도 direct).

## Suggested Sub-agents

- executor 직접 (doc-only direct) → tester 면제 (CLAUDE.md §3.2 R-110 direct doc-only).

## Follow-ups

- 없음. chain 종료.
