---
id: T-0198
title: STATE.json 에 flags.multiTaskFire false 필드 추가 + LOOP.md schema 동기
phase: P4
status: PENDING
commitMode: direct
coversReq: []
estimatedDiff: 25
estimatedFiles: 2
created: 2026-06-03
dependsOn: []
parents: []
plannerNote: P4/ADR-0020 활성화 step2 — STATE.json flags.multiTaskFire:false 필드 추가 + LOOP.md schema 동기 (schema-only, 토글 OFF 유지)
---

# T-0198 — STATE.json 에 flags.multiTaskFire false 필드 추가 + LOOP.md schema 동기

## Why

ADR-0020 (multi-task fire cron N=2 활성) 의 4-step 활성화 롤아웃 중 **step 2** 를 수행한다. step 1 (ADR-0020 자체) 은 T-0197 로 merged 됐다. step 2 는 `docs/STATE.json` schema 에 `flags.multiTaskFire: false` 필드를 추가하고, STATE.json 구조를 설명하는 문서에 이 필드의 의미·기본값·활성화 게이팅을 동기하는 작업이다 (CLAUDE.md §2.5 "기본 OFF 의 의미" 활성화 step 2, ADR-0020 §(6) 롤아웃 시퀀스 step 2 row).

본 task 는 **schema-only** 다 — 필드를 추가하되 값은 `false` 로 유지하며, **이것은 활성화가 아니다**. 실제 토글 ON (`true`) 은 step 4 의 별도 task 에서, 그것도 step 3 (LOOP.md cron chain 분기 로직) 이 먼저 완료된 뒤에만 가능하다 (ADR-0020 §(6) 순서 강제). 본 task 는 그 토글이 읽을 필드의 자리만 미리 박제한다.

## Required Reading

- `docs/decisions/ADR-0020-multi-task-fire-cron-n2-activation.md` — §(6) 활성화 롤아웃 시퀀스 (step 2 row + 순서 강제 규칙), §2.5 활성화 4-step 의 근거.
- `CLAUDE.md` §2.5 "Multi-task fire (실험적, 기본 OFF)" — 특히 "기본 OFF 의 의미" 의 활성화 step 1~4 목록 (step 2 = 본 task) + 활성화 조건 (a)~(e).
- `docs/LOOP.md` §4 "Lock & 충돌 규약" 의 "Lock 형태" 블록 (line ~300~318) — STATE.json 구조 (lock blob JSON + loopSession 필드 annotation) 가 문서화된 위치. 본 task 가 `flags` 필드 설명을 추가할 sync 대상.
- `docs/STATE.json` — top-level 키 목록 (`schemaVersion`, `phase`, `currentTask`, ..., `counters`). `flags` 키가 현재 부재함을 확인 (issue-still-relevant pre-check 에서 확인됨 — `flags` 키 미존재).

## Acceptance Criteria

- [ ] `docs/STATE.json` 에 top-level `flags` object 를 추가하고 그 안에 `"multiTaskFire": false` 를 둔다. 값은 반드시 `false` (활성화 아님). 기존 키 (`counters` 등) 는 일절 변경하지 않는다.
- [ ] STATE.json 이 valid JSON 으로 유지됨을 검증: `node -e "JSON.parse(require('fs').readFileSync('docs/STATE.json','utf8')); console.log('valid')"` 가 `valid` 출력 + exit 0.
- [ ] `docs/LOOP.md` §4 "Lock 형태" 인접 위치 (또는 STATE.json 구조를 설명하는 가장 적절한 지점) 에 `flags.multiTaskFire` 필드를 1~3 줄로 기술: (1) boolean 타입, (2) 기본값 `false`, (3) 의미 — multi-task fire (한 cron fire 안 N=2 task chain) 의 활성 토글 (CLAUDE.md §2.5), (4) `true` 로의 전환은 ADR-0020 롤아웃 step 3 (LOOP.md cron chain 분기) + step 4 (토글) 가 선행돼야 한다는 게이팅 명시.
- [ ] LOOP.md 의 추가 문장이 ADR-0020 또는 CLAUDE.md §2.5 를 참조 링크로 가리켜, 독자가 활성화 절차를 추적할 수 있게 한다.
- [ ] 본 task 는 direct/doc-only 이므로 unit test 없음 — 단 STATE.json 의 JSON 유효성은 위 `node -e ...` 명령으로 검증 (필수).

## Out of Scope

- **`multiTaskFire` 를 `true` 로 토글하지 않는다** — 활성화 (ADR-0020 step 4) 는 별도 후속 task 이며, step 3 완료가 선행 조건이다.
- **LOOP.md §1 의 cron chain 분기 step 추가** (직전 task 완료 후 §2.5 (a)~(e) 평가 → 2번째 task 진입 로직 + `FIRE-BATCH` marker 지침) = ADR-0020 step 3 — 별도 task. 본 task 에서 하지 않는다.
- **CLAUDE.md §10 cron 간격 `(2×평균)×2` 재명문화** = ADR-0020 step 4 의 일부 — 별도 task. 본 task 에서 하지 않는다.
- `flags` object 에 `multiTaskFire` 외 다른 필드를 추가하지 않는다 (현 시점 불필요).
- `currentTask`, `nextTask`, `counters`, `lock`, `loopSession` 등 STATE.json 의 기존 필드는 본 task 에서 일절 수정하지 않는다 (driver bookkeeping 영역).

## Suggested Sub-agents

direct/doc-only task 이므로 sub-agent dispatch 불요 — driver 가 직접 `docs/STATE.json` + `docs/LOOP.md` 를 edit 한 뒤 `node -e` JSON 검증 후 main 에 direct commit.

## Follow-ups

- ADR-0020 활성화 **step 3** (다음): `docs/LOOP.md §1` 에 cron 전용 multi-task chain 분기 step 추가 — 직전 task 완료 후 §2.5 (a)~(e) 평가 → true 면 2번째 task 진입 (N≤2), false 면 현행 step 7 종료. `FIRE-BATCH: <task1>+<task2>` marker 를 chained commit trail 에 박는 지침 포함 (direct, 선행 조건 = 본 step 2).
