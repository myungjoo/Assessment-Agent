---
id: T-0320
title: ADR-0037 §Decision3 idempotency 를 first-write-wins read-through 로 design-amend + §Decision2 as-proposed 확정 + status ACCEPTED (Q-0032 결정 반영)
phase: P5
status: DONE
completedAt: 2026-06-10T12:40:00+09:00
result: 머지 — PR #268 squash 52ab7a7. ADR-0037 §Decision3 first-write-wins read-through 확정(409 폐기, P2002→read fall-through)·§Decision2 ACCEPTED as-proposed·status PROPOSED→ACCEPTED·overwrite DEFERRED follow-up. reviewer round1 APPROVE(NIT 1 비차단), 4-게이트 충족, CI 기본검사 pass. src 0(ADR markdown only).
commitMode: pr
coversReq: [REQ-009, REQ-040, REQ-045]
estimatedDiff: 90
estimatedFiles: 1
created: 2026-06-10
priority: high
hqOrigin: Q-0032
plannerNote: P5 R-9 bridge — Q-0032 옵션(2) 경계수정. ADR-0037 §Decision3 를 409 ConflictException → first-write-wins read-through 로 amend·§Decision2 as-proposed 확정·status PROPOSED→ACCEPTED·overwrite DEFERRED follow-up. ADR-only pr(src 0), architect amend.
---

# T-0320 — ADR-0037 §Decision3 idempotency design-amend (first-write-wins read-through) + §Decision2 확정 + ACCEPTED

## Why

[Q-0032](../STATE.json) 에서 사용자가 ADR-0037 의 두 PROPOSE 결정을 검토하고 **옵션 (2) 경계 수정** 으로 결정했다. 핵심 근거: "이 활동/평가는 사람이 적는 것이 아니라 LLM/Agent 가 적는(생성하는) 것이다" — 같은 좌표를 재생성하면 churn / 낭비 compute 만 발생하므로, 동일 좌표 중복 호출은 409 error 가 아니라 **기존 저장본을 읽어 반환** 해야 한다.

따라서 ADR-0037 의 ephemeral 경로(T-0313/T-0315~T-0319 머지 완료)에 이어 남은 backbone 인 Admin full-persist 경로를 진행하려면, 그 의존 결정인 §Decision2(double-write 경계)·§Decision3(idempotency)을 확정해야 한다. 본 task 는 사용자 결정을 ADR 에 박제한다:

- **§Decision2(double-write 경계, evaluation-side single-writer): as-proposed 수용** — 사용자가 §2 에 이의 없음. PROPOSE 표기를 ACCEPTED 로 확정.
- **§Decision3(idempotency): first-write-wins read-through 로 amend** — 같은 `(personId, period, scope, periodStart)` 좌표의 2번째 이후 호출은 write 없이 기존 저장본을 read 반환(409 아님). 이전 PROPOSE(P2002→409 ConflictException)를 대체.
- **overwrite/재평가(이미 영속화된 평가문 교체): DEFERRED** — 사용자가 "이미 write 한 것을 overwrite 하는 것은 나중에 고민하도록 plan 만 해두자" 지시. 지금 미구현, 별도 후속 ADR/task 로 §Follow-ups 에 명시.

CLAUDE.md §3.1 rule 4 — ADR §Decision **본문 내용** 변경(단순 status 한 줄 flip 아님)이므로 commitMode `pr`(reviewer 가 amend 된 설계 검토). src/ 변경 0(design-amend only).

## Required Reading

- `docs/decisions/ADR-0037-period-collection-evaluate-bridge.md` — amend 대상 ADR. 특히 frontmatter `status`, §Decision §2, §Decision §3, §Consequences(부정/trade-off "§Decision 2/3 는 PROPOSE — human review 의존" bullet), §Follow-ups.
- `docs/decisions/ADR-0033-evaluation-result-persistence.md` — §3 reset-and-recreate(`$transaction` delete-if-exists → create) + fill/reeval 모드 + partial-reset + P2002 → ConflictException. **본 task 가 재사용할 직렬화 substrate**(P2002 catch → read 경로 fall-through 의 base). 새 동시성 primitive 도입 0.
- `docs/decisions/ADR-0006-assessment-data-model.md` — `Assessment` immutable + `@@unique([personId, period, scope, periodStart])`. first-write-wins 의 unique 좌표 + race 직렬화 backbone.
- `CLAUDE.md` §3.1(commitMode pr 판정 — ADR Decision 본문 변경) / §12(언어 정책 — 본문 한국어, status·키·식별자 영어).

## Acceptance Criteria

- [ ] **(AC1) §Decision §3 를 first-write-wins read-through 로 재작성**: 같은 `(personId, period, scope, periodStart)` 좌표에 대해 — 첫 호출은 create + persist + 결과 반환, 2번째 이후 호출은 **기존 영속 평가문을 read 해 그대로 반환(write 0)**. 즉 get-or-create / read-through semantics. **동시 race**: ADR-0033 의 `$transaction` + `Assessment.@@unique` 가 직렬화 — create-winner 가 persist, loser 는 P2002 를 catch 해 **read 경로로 fall-through** 하여 winner 의 영속 결과를 반환(caller 들이 같은 저장본으로 수렴 — duplicate-coordinate case 에서 client 에게 **409 전파 없음**). 본문에 "이는 이전 PROPOSE(P2002 → `ConflictException(409)` 전파)를 **REPLACES**" 명시. ADR-0033 의 `$transaction`/`@@unique`/P2002 를 **재사용하는 직렬화 substrate** 로 참조(새 동시성 primitive 도입 0).
- [ ] **(AC2) §Decision §2 를 ACCEPTED as-proposed 로 확정**: §2 제목/본문의 "(PROPOSE, human review)" qualifier 와 PROPOSE 안내 인용(`>` blockquote) 제거 — evaluation-side single-writer 경계(collection-side persist 우회, `EvaluationResultPersistService` 일원화)를 확정 표현으로. 본문 내용(채택안 A) 자체는 유지하되 PROPOSE 표기만 ACCEPTED 로.
- [ ] **(AC3) frontmatter `status: PROPOSED` → `status: ACCEPTED`**; §Decision §3 의 "(PROPOSE, human review)" 표기·PROPOSE blockquote 를 amend 된 ACCEPTED 본문으로 교체; §Decision §3(또는 인접 Context/외력 line)에 **Q-0032 가 본 결정을 resolve 했음** 을 1~2줄 credit(예: "외력: Q-0032 — 사용자가 옵션(2) 경계 수정으로 §3 를 first-write-wins read-through 로 확정"). frontmatter `relatedTask` 에 T-0320 추가.
- [ ] **(AC4) §Follow-ups 에 DEFERRED overwrite 항목 명시 추가**: **"overwrite / 이미 영속화된 평가문 재평가(replace existing — ADR-0033 reeval/reset-and-recreate 경로)"** 는 Admin full-persist v1 chain **범위 밖**, 별도 후속 설계/ADR 필요(근거: 평가문은 LLM/Agent 생성물 — v1 은 first-write-wins). 그리고 Admin full-persist impl chain(slice 2 orchestration Admin-persist 분기 / slice 3 controller Admin 분기 / slice 4 RBAC / slice 5 e2e)이 이제 **create-if-absent-else-read** 를 쓰며 **reeval 아님** 을 명확히.
- [ ] **(AC5) §Consequences trade-off 갱신**: "§Decision 2/3 는 PROPOSE — human review 의존" bullet 을 Q-0032 가 둘 다 resolve(§2 as-proposed 확정, §3 first-write-wins read-through 로 amend)했고 **더 이상 pending 아님** 을 반영하도록 수정.
- [ ] **(AC6) R-110 tester 게이트(0 src 변경 검증)**: 본 task 는 ADR 1개만 amend 하고 src/ 변경 0(markdown only)이므로, tester 가 `pnpm lint && pnpm build && pnpm test` 가 **여전히 green**(회귀 0)임을 확인. 신규 production symbol 0 → happy-path/error-path/branch/negative unit test 항목은 **본 ADR-only design-amend task 에 해당 없음**(분기 있는 production 코드 미추가 — R-112 4종은 후속 impl slice 의 Acceptance 에서 강제). spec-presence/CI 미파손 확인. coverage threshold 는 src 변경 0 이라 불변. **T-0313 design-only precedent 와 동일 class**(ADR-only pr, src 0).
- [ ] **(AC7) 언어**: ADR 본문 한국어(§12), frontmatter `status`/키/식별자/경로/enum(P2002·`ConflictException`·`$transaction`·`@@unique`)·HTTP status code(409)는 영어 유지.

## Out of Scope

- **src/ 변경 일체 금지** — orchestration Admin-persist 분기·controller Admin 분기·RBAC·e2e impl 은 전부 후속 slice(본 ADR ACCEPTED 머지 후 planner 가 큐잉). 본 task 는 ADR 문서 1개 amend 만.
- **Admin full-persist impl chain 자체** — slice 2~5 는 T-0320 머지 후 큐잉되는 후속 task.
- **DEFERRED overwrite capability** — 본 task 는 §Follow-ups 에 plan(항목 박제)만, 구현/설계 안 함.
- **live-LLM 검증**(§Decision5/Q-0022 credential)·**timezone**(Q-0026) — 본 amend 와 독립, 별도 게이트.
- 새 외부 dependency 추가 — §5 게이트(본 task 는 dep 0).

## Suggested Sub-agents

`architect` — ADR-0037 §Decision2/§Decision3/§Consequences/§Follow-ups/frontmatter amend(단일 ADR, src 0). 이어 `tester` 가 pr-mode R-110 충족(0 src 변경 → lint/build/test green 확인). `reviewer` 가 pr-mode design-amend 검토(amend 의미·일관성·Q-0032 정합).

## Follow-ups

(T-0320 머지 후 다음 planner survey 가 dependency chain 으로 큐잉 — Admin full-persist impl chain. 각 별도 task, ≤300 LOC·≤5 파일.)

1. **slice 2 — orchestration Admin first-write-wins persist 분기**: bridge orchestration service 에 Admin 경로(collect persist-free → evaluate → `EvaluationResultPersistService` 일원화 persist) + **create-if-absent-else-read**(좌표 존재 시 기존 read 반환, 부재 시 create) 분기. P2002 catch → read fall-through.
2. **slice 3 — controller Admin role 분기**: 기존 POST /api/assessment-evaluation/period 에 Admin 분기(임의 personId full-persist) + 영속 Assessment 식별자 응답.
3. **slice 4 — RBAC Admin arbitrary-personId 경로**: Admin 은 임의 personId 허용(User self-only 와 대비) guard/orchestration 강제 + negative(User 가 Admin 경로 접근 → 차단).
4. **slice 5 — e2e**: Admin full-persist round-trip(영속 검증) + **first-write-wins read-through idempotency**(같은 좌표 2번째 호출 → 기존 반환, **409 아님**, row 증가 0) + 동시 race 수렴(같은 좌표 동시 2호출 → 최종 row 1 + 양쪽 동일 결과).
5. **(DEFERRED) overwrite / 이미 영속화된 평가문 재평가** — replace existing(ADR-0033 reeval/reset-and-recreate 경로), Admin full-persist v1 범위 밖, 별도 후속 ADR/task(근거: LLM/Agent 생성물 — v1 은 first-write-wins).
