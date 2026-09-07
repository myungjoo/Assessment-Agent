---
id: T-1946
title: 내용 지문 dedup pass 2 제거 건수 관측 로그 배선
phase: P5
status: DONE
commitMode: pr
coversReq: [REQ-009]
estimatedDiff: 150
estimatedFiles: 2
created: 2026-09-07
independentStream: collection-content-dedup
dependsOn: [T-1944, T-1945]
touchesFiles:
  - src/assessment-collection/github-collection.service.ts
  - src/assessment-collection/github-collection.service.spec.ts
plannerNote: P5 · ADR-0063 §Follow-ups (c) — pass 2 제거 건수 1 줄 로그(raw 유출 0) 배선, chain 마지막 코드 slice
---

# T-1946 — 내용 지문 dedup pass 2 제거 건수 관측 로그 배선

## Why

[ADR-0063](../decisions/ADR-0063-commit-content-fingerprint-dedup.md) `§ Decision 7` 은 내용 지문 dedup 의 v1 관측 수단을 **"수집 flow 호출부에서 pass 2 가 제거한 건수를 Nest `Logger` 로 1 줄"** 로 못박고, 그 로그가 재검토 트리거 (a) "지문 dedup 제거 건수가 pass 1 을 상시 초과" 를 운영이 **수치로** 인지하는 유일한 입력이라고 규정한다. 앞선 두 slice (T-1944 지문 helper + mapper / T-1945 pass 2 + flow 직렬 합성) 로 지문 dedup 이 production 경로에서 실제로 활동을 **제거** 하기 시작했으므로, 오탐(= 기여 1 건이 조용히 사라짐, `§ Decision 4`) 을 감시할 수단 없이 방치하지 않기 위해 지금이 이 slice 의 자리다. 본 task 는 ADR-0063 `§ Follow-ups (c)` 를 그대로 수행하며 chain 의 마지막 코드 slice 다 ((d) doc-sync 는 direct, 본 task 머지 후 별건).

**issue-still-relevant pre-check (origin/main `364425d8` 실측)** — 아직 안착 0 임을 확인했다.

- `git grep -n "content-fingerprint dedup\|contentFingerprintRemoved\|new Logger" origin/main -- src/assessment-collection` → **매칭 0**. 수집 slice 전체에 `Logger` 주입 자체가 없다.
- `git show origin/main:src/assessment-collection/github-collection.service.ts` 의 `124 행` 이 `return dedupGithubActivitiesByContent(dedupGithubActivities(collected));` **단일 표현식** 이라 pass 1 출력이 지역 변수로 남지 않는다 → 제거 건수를 셀 좌표가 아직 없다.
- `GithubCollectionService` (`78~80 행`) 의 constructor 는 `private readonly client: GithubInstanceClient` 뿐이고 logger 필드가 없다.
- 참고로 chain 선행분은 이미 머지돼 있다 — pass 2 `dedupGithubActivitiesByContent` 는 같은 파일 `37~40 행` import 에 실재 (T-1945, main `1b7b9c2f`).

**오너 게이트 판정** — 셋 다 미침범.

- PLAN `157 행` (R-91 k6 최우선): k6 chain 은 이미 착수·안착 (`origin/main:.github/workflows/load-k6.yml` + `package.json` 매칭) 이라 자원 경합 0.
- PLAN `158 행` (per-route perf baseline 신규 slice 금지): `test/perf/` 무변경 → 비해당.
- PLAN `183 행` (REQ 재판정 구현 후 1 회): 본 task 는 `docs/requirements.md` 를 **건드리지 않는다**. REQ-009 재판정은 ADR-0063 `§ Follow-ups (d)` 에서 (a)~(c) 머지 후 1 회만 한다.

**CLAUDE.md `§ 3` 소비처 동반 의무 판정: 충족** — 본 slice 는 helper/factory 신설이 아니라 **배선 그 자체** 다 (production 호출 경로인 `collectGithubActivities` 안에서 로그가 발생). 분리 Follow-up 0, cap 예외 주장 0.

## Required Reading

- `docs/decisions/ADR-0063-commit-content-fingerprint-dedup.md` — `§ Decision 7` (관측 · 개입: 제거 건수 1 줄, 식별자·메시지 미기록) · `§ Follow-ups (c)` (파일 목록 · R-112 4 축) · `§ Decision 5` (2-pass 직렬 순서 — 세는 대상은 pass 2 의 제거분뿐)
- `src/assessment-collection/github-collection.service.ts` — `78~80 행` (class + constructor), `122~124 행` (2-pass 합성 반환부, 본 task 의 유일한 production 변경 지점)
- `src/assessment-collection/github-collection.service.spec.ts` — `82~151 행` (describe 골격 + happy path), `152~213 행` (`dedup 통합` describe — 본 task 의 로그 단언을 붙일 이웃)
- `src/run-status/run-status.service.spec.ts` `41 행` — `jest.spyOn(Logger.prototype, "warn").mockImplementation(() => {})` 사내 Logger spy 선례 (동형으로 `log` spy 사용)
- `src/permission-denied/persisting-permission-denied-emitter.ts` `39 행` — `private readonly logger = new Logger(<Class>.name)` 필드 선언 선례

## Acceptance Criteria

- [x] `GithubCollectionService` 에 `private readonly logger = new Logger(GithubCollectionService.name);` 필드를 추가한다 (constructor 시그니처 무변경 — DI 주입 아님, 위 emitter 선례와 동형).
- [x] `collectGithubActivities` 의 반환부를 pass 1 결과 · pass 2 결과 두 지역 변수로 풀고, **pass 2 가 제거한 건수** (`pass1.length - pass2.length`) 만 계산한다. pass 1 제거분은 세지 않는다 (ADR-0063 `§ Decision 7` 은 지문 dedup 제거 건수만 요구).
- [x] 제거 건수 `> 0` 일 때만 `this.logger.log(...)` 를 **정확히 1 회** 호출한다. 제거 `0` 이면 로그를 **억제** 한다 (수집 호출마다 0 건 로그가 쌓이는 것을 막기 위한 결정 — 이 억제 규칙을 코드 주석 1 줄로 명시).
- [x] 로그 문자열에 활동 식별자 (`externalId` · SHA) · `author` · commit message · `contentFingerprint` digest 중 **어느 것도 포함하지 않는다** (raw 유출 0, `§ Decision 7`). 건수 + 고정 문구만.
- [x] 반환값 계약 무변경 — `collectGithubActivities` 는 여전히 2-pass 합성 결과 배열을 그대로 반환하고 순서·내용이 바뀌지 않는다.
- [x] happy-path test 1+ (R-112-1): 지문이 같은 rebase 사본이 섞인 입력에서 수집 후 `logger.log` 가 1 회 호출되고 인자 문자열에 제거 건수가 담긴다.
- [x] error path test 1+ (R-112-2): 모든 source 가 throw 해 수집 결과가 빈 배열인 경우 (또는 빈 `sources` 입력) 로그 0 회 · throw 0.
- [x] 분기별 test (R-112-3): (i) 제거 `> 0` → 로그 1 회 (ii) 제거 `0` (지문 중복 없음) → 로그 0 회 (iii) pass 1 만 제거하고 pass 2 제거 0 인 입력 → 로그 0 회 (pass 1 제거분을 세지 않음의 직접 검증).
- [x] negative test (R-112-4): 로그 인자 문자열이 입력 활동의 `externalId` · `author` · `contentFingerprint` 값 어느 것도 **포함하지 않음** 을 단언 (raw 유출 0) + 로그 spy 를 걸어도 반환 배열이 기존 spec 의 기대와 동일함 (계약 회귀 0).
- [x] `pnpm lint && pnpm build && pnpm test` 통과.
- [x] `pnpm test:cov` 통과 (전역 line ≥ 80% / function ≥ 80%) 이며 변경 파일 `github-collection.service.ts` 의 line·branch 100% 유지.

## Out of Scope

- `src/assessment-collection/domain/commit-dedup.ts` · `commit-content-fingerprint.ts` · `github-activity.mapper.ts` 변경 (T-1944 / T-1945 로 이미 종결 — 1 LOC 도 건드리지 않는다).
- 제거된 활동의 **목록** 노출 · Admin UI 복원(allowlist) 경로 — ADR-0063 `§ Decision 7` 이 명시적으로 defer 했다 (영속 표면 신설로 직결).
- 지문 dedup 지표의 영속화 · metrics endpoint · run-status 연동 (v1 은 로그 1 줄뿐).
- `docs/requirements.md` REQ-009 재판정 · ADR-0063 status flip · `docs/PLAN.md` `99 행` 갱신 — 전부 `§ Follow-ups (d)` (direct doc-sync, 별건 task).
- `test/e2e/` · `test/smoke/` · `test/perf/` 신규 spec 추가 (PLAN `158 행` 및 cap 준수).
- `page-dedup.ts` (Confluence) · `evaluation-dedup.ts` (평가-side) — ADR-0063 `§ Decision 6` · `§ Consequences` 경계 밖.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(비어 있음 — sub-agent 가 관련 작업을 발견하면 여기에 추가한다.)
