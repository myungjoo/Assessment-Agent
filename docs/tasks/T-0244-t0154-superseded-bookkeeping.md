---
id: T-0244
title: T-0154 task 파일 status SUPERSEDED 처리 (ADR-0028/T-0242/T-0243 로 대체)
phase: P4
status: DONE
commitMode: direct
coversReq: []
estimatedDiff: 12
estimatedFiles: 1
created: 2026-06-05
plannerNote: P4 운영 bookkeeping. T-0154(cloud-fire-lock ADR-0015 안)는 ADR-0028+T-0242+T-0243 으로 실현·완결 → 원본 task SUPERSEDED 표기. direct doc-only, 기존 task 파일 frontmatter 1줄 + pointer note. dependency-free, §5 미발화.
---

# T-0244 — T-0154 task 파일 status SUPERSEDED 처리

## Why

T-0154 (cron@web 자율성 확보를 위한 claude/* 브랜치 기반 driver lock ADR-0015 신설안) 은 session #60 의 ADR-0028(T-0242, PR-209 c5926fd, PROPOSED→ACCEPTED) + LOOP/CLAUDE 프로토콜 동기(T-0243) chain 으로 **다른 ID 번호 체계 하에 실현·완결**됐다. T-0154 의 의도(refs/locks/driver blob → claude/lock-driver 브랜치 lock 이전으로 cloud proxy 403 자율성 해소)는 ADR-0028 이 그대로 박제했고 T-0243 이 LOOP §1[1]·§4 + CLAUDE §10 에 반영하며 ADR-0028 을 ACCEPTED 로 전이시켰다. 따라서 T-0154 는 더 이상 실행되지 않는 superseded task 다 — 현 main 의 frontmatter 가 여전히 `status: PENDING` 이라 stale 하므로 SUPERSEDED 로 박제해 다음 planner 의 backlog survey 가 이미 완결된 task 를 다시 픽업하지 않도록 한다.

## Required Reading

- `docs/tasks/T-0154-cloud-proxy-branch-lock-adr.md` — frontmatter `status:` 와 본문 Premise gate (403 잔존 분기). 본 task 의 편집 대상.
- `docs/decisions/ADR-0028-cloud-proxy-branch-lock.md` — T-0154 의 의도를 실현한 ACCEPTED ADR (status·Decision 확인용, 편집 대상 아님).

## Acceptance Criteria

- [ ] `docs/tasks/T-0154-cloud-proxy-branch-lock-adr.md` frontmatter 의 `status: PENDING` → `status: SUPERSEDED` 로 변경.
- [ ] 같은 frontmatter 에 pointer 필드 추가: `supersededBy: [ADR-0028, T-0242, T-0243]` + `supersededAt: 2026-06-05`.
- [ ] T-0154 본문 최상단(제목 `# T-0154 …` 바로 아래)에 SUPERSEDED 박스 1개 추가 — "본 task 는 ADR-0028(T-0242, PR-209) + T-0243 LOOP/CLAUDE 동기 chain 으로 실현·완결됨. ADR-0015 번호는 미선점되어 ADR-0028 로 재배정. 본 task 는 실행되지 않음." 한 줄~세 줄 한국어.
- [ ] T-0154 의 나머지 본문(Why / Premise gate / Acceptance Criteria / Out of Scope 등)은 **삭제하지 않고 그대로 보존** — historical 증거. 상단 SUPERSEDED 박스 + frontmatter 만 추가/수정.
- [ ] 변경은 T-0154 task 파일 1개에만 국한. ADR-0028 / T-0242 / T-0243 / 다른 task 파일은 건드리지 않음.
- [ ] 언어 정책(§12): 본문 한국어, frontmatter 키/enum 값(`status`, `SUPERSEDED`, `supersededBy`)·ID·경로는 영어 유지.

## Out of Scope

- ADR-0028 / T-0242 / T-0243 본문 수정 — 이미 머지 완결, 본 task 와 무관.
- T-0154 본문의 기존 Why/Premise/Acceptance/Out-of-Scope 절 삭제·축약 — historical 증거로 보존(상단 박스 + frontmatter 만 추가).
- ADR-0028 의 첫 cron@cloud 자율 lock 획득 운영 관찰 — 실 cron@cloud fire 발생 후에야 actionable 한 OBSERVATION 작업이라 본 task 에서 다루지 않음(Follow-ups 참조).
- src/ 코드 변경 0, STATE.json counters/lock 변경 0 (driver bookkeeping 영역).

## Suggested Sub-agents

`implementer` (또는 driver-direct 처리 — doc-only frontmatter + 1 박스 수정이라 trivial).

## Follow-ups

- (운영, 현재 미actionable) ADR-0028 의 첫 cron@cloud 자율 lock 획득 검증 — claude/lock-driver 브랜치 lock 을 cron@cloud 가 PAT/UI 토글 없이 자율 획득해 STAND DOWN 재발 없이 task 를 픽업하는지 관찰. **실 cron@cloud fire 가 발생한 뒤에야 actionable** 하므로 지금 task 로 큐잉하면 block 됨 — fire 발생 후 planner 가 OBSERVATION task 로 큐잉. (lock 프로토콜 cutover 효력 = 다음 fresh session/fire — session #60 이후 첫 cron@cloud fire 가 검증 시점.)

## 완료 기록

- **DONE (doc-sync 정합, T-0404)** — 본 task 산출물(T-0154 frontmatter `status: SUPERSEDED` 처리)은 `3be8260 docs(driver): /loop #61 t1 — T-0154 SUPERSEDED bookkeeping (T-0244)` 로 main 안착했고 T-0154 frontmatter = `SUPERSEDED` 확인됨. 자기 frontmatter `status:` 만 `PENDING` 으로 누락 잔류했던 것을 T-0404 direct doc-only fire 가 `DONE` 으로 정합.
