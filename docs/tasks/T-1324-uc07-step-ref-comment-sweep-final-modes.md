---
id: T-1324
title: UC-07 §5 step 참조 주석 sweep 종결 slice — import mode 설명 endpoint 주석 2 곳 (옛 step 2 → 현 4)
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-030]
estimatedDiff: 6
estimatedFiles: 1
created: 2026-07-30
independentStream: uc07-step-ref-comment-sweep
dependsOn: [T-1316, T-1317, T-1318, T-1319, T-1320, T-1321, T-1322, T-1323]
touchesFiles:
  - src/import/import.controller.ts
plannerNote: "T-1321~T-1323 이 3연속 격리한 미확정 2 곳을 blame 근거로 확정(옛 2 → 현 4) — sweep 종결. pr, 6 LOC / 1 파일"
---

# T-1324 — UC-07 §5 step 참조 주석 sweep 종결 slice (import mode 설명 endpoint)

## Why

[T-1316](T-1316-uc07-step-count-and-mapping-table.md) 이 박제한 [UC-07](../use-cases/UC-07-export-import.md) `§5.1 step 번호 · 이름 대응표` 를 소비하는 주석 sweep 의 **종결 slice** 다. slice 1~7 ([T-1317](T-1317-uc07-step-ref-comment-sweep-chunk.md) ~ [T-1323](T-1323-uc07-step-ref-comment-sweep-guard-payload.md)) 이 63 곳을 닫았고, origin/main `cf6d230c` 실측 잔여는 **`src/import/import.controller.ts` 의 `§5 step 2` 2 곳뿐** 이다 (`git grep -cE "§5 step ?2" -- src/` → 이 파일 2 hit, `step 5` · `step 7` 은 전 src 0 hit).

이 2 곳은 T-1321 · T-1322 · T-1323 이 "현 2/3 (preview 왕복) 인지 현 4 (confirmation dialog) 인지 인용만으로 확정 불가" 라며 3 연속 Out of Scope 로 격리해 온 항목이다. 본 task 는 아래 §판정표 에서 **blame 시점 근거 + 이름 근거 두 가지로 판정을 확정** 해 stream 을 닫는다. PLAN P5 의 UC-07 문서 ↔ 코드 주석 정합 유지 (REQ-030) 를 잇는다.

## 판정표 (실측 2 곳 / 1 파일 — origin/main `cf6d230c`)

### 판정 K — import mode 선택 dialog → 현 step 4 (2 곳)

| 파일:행 | 현 문자열 | 판정 |
| --- | --- | --- |
| `src/import/import.controller.ts:38` | `설명 목록, UC-07 §5 step 2 + §6.2 — describeImportMode helper 를 …` | → `§5 step 4` |
| `src/import/import.controller.ts:347` | `설명 목록 조회 (UC-07 §5 step 2 + §6.2, REQ-030 Import mode 선택)` | → `§5 step 4` |

**판정 근거 (실행 중 재추론 금지 — 아래가 정본)**:

1. **작성 시점 근거 (결정적)** — `git blame -L 38,38 -- src/import/import.controller.ts` 의 두 줄 모두 `74263daf` (**2026-06-21**) 다. 현 step 2/3 (`WebUI→>BackendAPI: import preview 요청` · 그 응답) 은 [T-1311](T-1311-uc07-sequence-preview-step-sync.md) 이 **2026-07-30** 에 §5 mermaid 에 삽입한 arrow 라, 2026-06-21 시점의 주석이 그 두 arrow 를 가리키는 것은 **시간적으로 불가능** 하다. 따라서 이 `step 2` 는 T-1311 이전 번호계이고, §5.1 표의 `T-1311 이전 번호 = 2` → **현 4** 로 lookup 된다.
2. **이름 근거 (독립 확인)** — 주석이 스스로 인용하는 이름은 `import mode 선택 dialog` = §5 mermaid 70 행 `WebUI->>Admin: 사용자 confirmation dialog (Export 는 scope 옵션 선택, Import 는 강한 confirmation …)` = **현 4**. 현 2/3 은 `WebUI ↔ BackendAPI` 왕복이라 **dialog 가 아니다** (사람에게 보이는 화면 요소 0). §6.2 (Import merge 옵션) 를 함께 인용하는 것도 mode 선택이 이뤄지는 dialog step 과 정합.
3. 즉 표 lookup (이전 2 → 현 4) 과 이름 판정이 **일치** 하며 drift 없음. 결과적으로 T-1322 의 판정 F/H (`step 7`·`step 2` → 현 4) 와 같은 종착지다.

교체 결과: 두 곳 모두 `§5 step 2` → `§5 step 4` (번호만 교체).

## Required Reading

- `docs/use-cases/UC-07-export-import.md` — §5 mermaid (63~71 행: 현 2/3/4 arrow) + `§5.1 step 번호 · 이름 대응표` (109~127 행) + 판정 규약 (129 행, 기계적 +2 금지).
- `docs/tasks/T-1323-uc07-step-ref-comment-sweep-guard-payload.md` — 직전 slice 의 Out of Scope 1 항 (본 task 가 인수하는 항목) + 주석 교체 관례 (이름 병기 회피 · 축자 인용 보존).
- `src/import/import.controller.ts` — 36~40 행 (파일 상단 route 요약 주석 블록) 및 344~350 행 (`describeModes` 핸들러 주석 블록).

## Acceptance Criteria

- [ ] 위 판정표 2 곳의 `§5 step 2` 를 **`§5 step 4`** 로 교체한다. **판정을 실행 중 재추론하지 말 것** — 표와 3 근거가 정본이다.
- [ ] **이름 중복 병기 회피** (T-1323 선례) — 두 곳 모두 같은 문장이 이미 `import mode 선택 dialog` / `import mode(replace/merge) 선택 dialog` 로 대상 step 의 이름을 말하고 있으므로 **번호만 교체** 하고 `(confirmation dialog)` 같은 이름을 덧붙이지 않는다.
- [ ] `+ §6.2` · `, REQ-030 Import mode 선택` 등 **인접 인용은 글자 그대로 보존** — 인접 문장의 의미 변경 0, 재줄바꿈은 폭이 깨지는 줄에 한해서만 (기존 80~100 char 폭 유지).
- [ ] **주석-only 게이트**: `git diff -U0 origin/main -- src/` 결과의 추가/삭제 줄이 **전부 `//` 주석 줄** 임을 확인한다 (production 로직 0 LOC 변경, decorator · route 선언 · 반환 shape 무변경).
- [ ] **sweep 종결 검증 grep** — 공백 유무 양쪽을 본다:
  - `git grep -nE "§5 step ?2" -- "src/"` → **0 hit** (본 stream 종결의 정의)
  - `git grep -nE "§5 step ?5" -- "src/"` → 0 hit, `git grep -nE "§5 step ?7" -- "src/"` → 0 hit (slice 7 결과 유지)
  - `git grep -oE "§5 step ?4" -- "src/" | wc -l` → **19** (기존 17 + 본 task 2)
  - `git grep -nE "§5 step ?[0-9]+" -- "src/import/"` → 4 hit (`step 4` 2 곳 + `import-job-runner.service.ts:55` · `import-restore.service.ts:54` 의 `step 15` — 후자 2 곳은 현 15 `결과 응답 (복원 row count + 영향 요약)` 과 이미 정합하므로 **무변경이 정상**)
- [ ] **R-112**: 본 task 는 주석 전용 변경이라 **신규 public symbol 0 · 신규 분기 0** — happy-path / error path / 분기 / negative cases 각각에 **대응하는 신규 test 대상이 없다** (T-1317~T-1323 선례와 동일). 대신 기존 spec 무회귀로 대체 검증한다:
  - `pnpm lint && pnpm build` 통과.
  - `pnpm test` 전량 통과 (특히 `src/import/import.controller.spec.ts` 의 `describeModes` 관련 케이스 — happy 2 mode 반환 · RBAC guard · route 선언 순서 검증이 그대로 green).
  - `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%).

## Out of Scope

- **`docs/use-cases/UC-07-export-import.md` §5.1 과도기 표 제거** — 본 task 로 코드 주석 sweep 이 완결되므로 표 제거 조건이 처음으로 충족되지만, 문서 변경은 별건 task 로 분리한다 (본 task 는 `src/` 주석 1 파일만). Follow-ups 에 남길 것.
- 이미 정정 완료된 참조 (`step 17` 34 곳 · `step 4` 17 곳 · `step 14` · `step 15` · `step 8` · `step 9` · `step 9·13` 등) 의 재수정 · 표현 통일 · 이름 병기 방식 일괄 정렬.
- `src/import/import-job-runner.service.ts:55` · `src/import/import-restore.service.ts:54` 의 `§5 step 15` — 현 번호와 이미 정합 (무변경).
- drift-guard smoke 신설 (`§5 step` 참조가 다시 어긋나면 fail 하는 spec) — 별건. daily-test leg 추가는 3 개 drift-guard smoke 동기 수정을 강제하므로 cap 을 넘긴다 (Q-0054 선례).
- `docs/use-cases/UC-08-*.md` 의 step 수 정합 (16 vs 14) — 별건.
- spec 파일 본문 수정 · 주석 외 리팩터 · 신규 helper · route 동작 변경.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

- (planner 사전 기록) sweep 완결 후 `UC-07 §5.1 step 번호 · 이름 대응표` 는 129 행이 스스로 밝힌 **과도기 표** 로서 제거 후보다. 제거 시 §5 103 행의 "번호와 step 이름 병기" 규약은 남겨야 한다 — 별도 task 로 판단할 것.
