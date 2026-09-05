---
id: T-1868
title: 기본 provider 정책 doc-sync — ADR-0062 ACCEPTED + ADR-0048 supersede 한 줄 + REQ-049/051 + PLAN 106·107 행 + modules.md
phase: P5
status: PENDING
commitMode: direct
coversReq: [REQ-049, REQ-051]
independentStream: llm-default-provider
dependsOn: [T-1862, T-1863, T-1864, T-1865, T-1867, T-1897, T-1898, T-1899, T-1900, T-1901, T-1902]
touchesFiles:
  - docs/decisions/ADR-0062-llm-default-provider-explicit-selection.md
  - docs/decisions/ADR-0048-default-model-id-source.md
  - docs/requirements.md
  - docs/PLAN.md
  - docs/architecture/modules.md
estimatedDiff: 45
estimatedFiles: 5
created: 2026-09-03
requeued: 2026-09-05
plannerNote: "오너 지시 2026-09-03 chain 마지막 조각 — 구현 전량 머지 후 1 회 재판정 (CLAUDE.md §3.1 rule 6). ADR status 승격 + supersede 한 줄은 direct 허용"
---

# T-1868 — 기본 provider 정책 doc-sync (chain closeout)

## Why

[PLAN.md](../PLAN.md) `107 행` 의 2026-09-03 오너 지시 chain (다중-row LlmProviderConfig 기본 provider 명시 선택) 이 **전량 머지**됐다 — ADR (T-1862 `9e8f901d` / PR #1485) · schema+migration+repository (T-1863 `ae3bbe2e` / #1486) · resolver+service (T-1864 `e5b11cde` / #1487) · endpoint (T-1865 `9e0242f1` / #1488) · web 읽기/쓰기 축 (T-1897 `17fe0a12` / #1489, T-1898 `edc5299b` / #1490, T-1899 `b4a945ea` / #1491, T-1900 `be003858` / #1492, T-1901 `efc108e6` / #1493, T-1902 `ca5e7b85` / #1494) · seed no-override (T-1867 `3927fbf2` / #1495). CLAUDE.md §3.1 rule 6 에 따라 **구현이 다 머지된 지금 REQ 당 1 회만** 문서를 실측에 맞춘다.

issue-still-relevant pre-check (origin/main `6ab71011`): ADR-0062 frontmatter 는 여전히 `status: PROPOSED` (`4 행`), ADR-0048 `§ Decision 2` (`50 행`) 에 supersede 표기 0, PLAN `106 행` 은 아직 "후속 ADR 이 prerequisite(deferred)" 문장을 들고 있고 `107 행` bullet 은 `[ ]` 이며, `docs/architecture/modules.md` `38 행` LlmModule 행에 기본 provider 슬롯 서술 0 — 5 곳 전부 미박제이므로 본 task 는 유효하다.

## Required Reading

- [docs/decisions/ADR-0062-llm-default-provider-explicit-selection.md](../decisions/ADR-0062-llm-default-provider-explicit-selection.md) `1~10 행` frontmatter + `14~18 행` §Status — 본문이 "ADR-0048 supersede 한 줄 + 본 ADR status 승격은 **T-1868 소관**" 이라고 명시한다.
- [docs/decisions/ADR-0048-default-model-id-source.md](../decisions/ADR-0048-default-model-id-source.md) `50~57 행` §Decision 2 (다중-row deferred 결정 — 본 task 가 supersede 한 줄만 덧댄다).
- [docs/requirements.md](../requirements.md) `68 행` REQ-049 행 · `70 행` REQ-051 행. 표 마지막 열이 status 이며 부가 설명은 그 열의 괄호 주석으로 적는다 (별도 비고 열 없음).
- [docs/PLAN.md](../PLAN.md) `106 행` (ADR-0048 §Decision 2 deferred 문장 — `후속 ADR 이 prerequisite` 로 grep) + `107 행` (2026-09-03 오너 지시 bullet — `다중-row LlmProviderConfig 기본 provider 선택` 으로 grep). **행 좌표보다 문구 grep 을 신뢰**한다 (본 chain 진행 중 bullet 이 이동했다).
- [docs/architecture/modules.md](../architecture/modules.md) `38 행` LlmModule 행 (T-1865 reviewer MINOR 흡수 대상).

## Acceptance Criteria

- [ ] ADR-0062 frontmatter `status: PROPOSED` → `ACCEPTED`, `relatedTask` 에 구현 chain task 반영. §Status 첫 문단에 "구현 chain 전량 머지 (PR #1485~#1495)" 한 줄 추가 — 결정 내용(§Decision) 본문은 무변경.
- [ ] ADR-0048 `§ Decision 2` 채택 문단 첫 줄 앞에 `**(부분 superseded by [ADR-0062](ADR-0062-llm-default-provider-explicit-selection.md) — 2026-09 오너 지시, Web UI 명시 선택 최우선)**` 한 줄 삽입. §Decision 1 · 3 · 4 및 나머지 본문 무변경 (ADR-0048 전체 status 는 ACCEPTED 유지 — 전체 supersede 아님).
- [ ] requirements.md REQ-049 · REQ-051 행의 status 열 괄호 주석에 "기본 provider 명시 선택 (Web UI · `PUT /api/llm/providers/default`, ADR-0062)" 취지 반영. **status enum 값 자체는 실측대로 유지** — REQ-051 의 "custom 3 model 슬롯" 은 여전히 미구현이므로 승격 금지 (본 chain 은 prerequisite 만 닫았다).
- [ ] PLAN.md `106 행` 의 "REQ-051 진입 시 다중-row default 선택 정책은 ADR-0048 §Decision 2 후속 ADR 이 prerequisite(deferred)" 문장을 "다중-row default 선택 정책은 [ADR-0062](decisions/ADR-0062-llm-default-provider-explicit-selection.md) 로 닫혔다 (T-1862~T-1868)" 로 교체. `106 행` bullet 의 checkbox `[ ]` 는 유지 (R-64 overwrite/reset 잔여는 별도).
- [ ] PLAN.md `107 행` 오너 지시 bullet 을 `[x]` 로 닫고, 장문의 "다음 큐잉 대상 / 이전 갱신 기록" 서술을 **머지 PR 목록 1~2 문장으로 축약**한다 (chain 종료 — pointer 로서의 수명이 끝났다).
- [ ] `docs/architecture/modules.md` `38 행` LlmModule 행에 "기본 provider 슬롯 재지정 (`LlmDefaultProvider` 단일 슬롯 table + `PUT /api/llm/providers/default`, ADR-0062)" 구절 추가 (T-1865 reviewer MINOR 흡수).
- [ ] `git grep -n "ADR-0062-llm-default-provider-explicit-selection.md"` 로 새로 추가한 상대 경로 link 가 실재 파일을 가리키는지 확인 (깨진 link 0).
- [ ] 변경 파일이 위 5 개뿐인지 `git status --short` 로 확인 (CLAUDE.md §3 파일 cap). `docs/STATE.json` · journal · 본 task 파일 status 는 driver bookkeeping commit 소관이라 본 commit 에서 제외.

## Out of Scope

- `src/` · `web/` · `test/` · `prisma/` · `deploy/` 어떤 코드 · schema · seed 변경도 금지 (direct commitMode 이므로 pr 대상 파일을 건드리면 §3.1 위반).
- UC-05 본문 개정, api.md 개정 (T-1865 가 이미 반영). 필요 시 별도 direct task.
- 아래 Follow-ups 의 M1 · M2 는 코드/test 변경이라 본 task 에서 처리 금지.

## Suggested Sub-agents

- executor 직접 (doc-only direct) → tester 면제 (CLAUDE.md §3.2 R-110 direct doc-only 면제 조항).

## Follow-ups

- **M1 (T-1867 reviewer MINOR, 비차단)** — `deploy/seed-llm-config.sh` 의 기본 provider bootstrap INSERT 는 `LlmDefaultProvider` 단일 슬롯 unique index 를 전제한다. 운영자가 잉여 row 를 수동 삽입한 상태면 seed INSERT 가 unique 위반으로 실패할 수 있다 (ADR-0062 가 명시한 잔여 trade-off 범위 안). 방어적 `ON CONFLICT DO NOTHING` 또는 사전 row 수 점검을 검토하는 `pr` task 후보.
- **M2 (T-1867 reviewer MINOR, 비차단)** — smoke spec 2 개 (`test/smoke/realdata-e2e-seed-llm-config-*.smoke-spec.ts` 계열) 의 주석에 적힌 스크립트 행 좌표가 T-1867 의 preamble 편집으로 +4 행 drift 했다. 주석만 정정하는 test-only `pr` task 후보 (동작 변경 0).
