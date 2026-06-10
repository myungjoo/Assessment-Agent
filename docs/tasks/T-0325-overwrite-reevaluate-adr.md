---
id: T-0325
title: overwrite / 이미 영속화된 평가문 재평가(re-evaluate) capability 설계 ADR (ADR-0038) — Admin 명시적 재평가 요청 contract + ADR-0033 reeval(reset-and-recreate) 재사용 + ADR-0037 §Decision3 first-write-wins 의 명시적 opt-out + RBAC Admin + idempotency/safety 경계
phase: P5
status: DONE
mergedAs: 06ae245
prNumber: 272
reviewRounds: 1
completedAt: 2026-06-10T16:58:00+09:00
commitMode: pr
coversReq: [REQ-009, REQ-040, REQ-045]
estimatedDiff: 200
estimatedFiles: 1
created: 2026-06-10
priority: high
hqOrigin: Q-0033
plannerNote: P5 R-9 확장 — Q-0033 옵션(1) overwrite/재평가 설계 진입. 새 ADR-0038 로 Admin 명시적 재평가 contract·ADR-0033 reeval 재사용·ADR-0037 first-write-wins opt-out·RBAC·safety 경계 박제. design-only pr(src 0), architect.
---

# T-0325 — overwrite / 이미 영속화된 평가문 재평가(re-evaluate) 설계 ADR (ADR-0038)

## Why

[Q-0033](../STATE.json) 에서 사용자가 **옵션 (1) overwrite / 재평가 capability 설계 진입** 을 선택했다. [ADR-0037](../decisions/ADR-0037-period-collection-evaluate-bridge.md) §Decision 3 의 Admin full-persist bridge 는 현재 **first-write-wins read-through**(create-if-absent-else-read — 같은 좌표 2번째 호출은 기존 저장본을 read 반환, write 0)로 동작한다. 이는 [Q-0032](../STATE.json) 에서 "이미 write 한 것을 overwrite 하는 것은 나중에 고민하도록 plan 만 해두자" 로 **DEFERRED** 됐던 항목이며, 이제 그 설계로 진입한다.

본 task 는 **이미 영속화된 평가문을 Admin 이 의도적으로 재평가/교체** 하는 capability 의 경계를 새 ADR(다음 free 번호 = **ADR-0038**)로 박제한다. 이 capability 는 새 persist primitive 를 만드는 것이 아니라 [ADR-0033](../decisions/ADR-0033-evaluation-result-persistence.md) 이 이미 정의한 **`reeval` PersistMode(reset-and-recreate: delete → create in `$transaction`)** 경로를 재사용한다 — 설계 질문은 (a) Admin caller 가 그 재평가를 **어떻게 요청** 하는가(bridge DTO/endpoint 의 mode/flag vs 별도 endpoint), (b) [ADR-0037](../decisions/ADR-0037-period-collection-evaluate-bridge.md) §Decision 3 의 first-write-wins 와 어떻게 **공존** 하는가(default first-write-wins / 명시적 opt-out 으로 reeval), (c) RBAC(누가 재평가 권한), (d) idempotency/concurrency + safety(재평가가 기존 평가문을 파괴 — v1 허용 가능 여부 / audit follow-up)다.

이는 여러 기존 결정([ADR-0033](../decisions/ADR-0033-evaluation-result-persistence.md) reeval, [ADR-0006](../decisions/ADR-0006-assessment-data-model.md) immutability/`@@unique`, [ADR-0037](../decisions/ADR-0037-period-collection-evaluate-bridge.md) §Decision 3 first-write-wins, RBAC)에 걸친 새 **design 결정** 이므로 CLAUDE.md §3.1 rule 4 에 따라 코드 전에 ADR 로 경계를 박제한다(commitMode `pr`, design-only, src 0 — T-0313/T-0320 ADR-only precedent 동형). 새 외부 dependency 0 / credential 0 / schema 변경 0(기존 reeval 경로 + 기존 entity 재사용).

## Required Reading

- `docs/decisions/ADR-0037-period-collection-evaluate-bridge.md` — 특히 **§Decision 3(first-write-wins read-through, create-if-absent-else-read)** / §Decision 1(period RBAC: Admin full / User ephemeral) / §Decision 2(evaluation-side single-writer) / §Follow-ups 의 **"(DEFERRED) overwrite / 이미 영속화된 평가문 재평가"** 항목. 본 ADR-0038 이 그 DEFERRED 항목을 설계로 승격한다.
- `docs/decisions/ADR-0033-evaluation-result-persistence.md` — **`reeval` PersistMode(reset-and-recreate: `$transaction` delete-if-exists → create)** / fill 모드 / partial-reset / P2002 → ConflictException. overwrite capability 가 **재사용** 할 기존 persist primitive(새 primitive 도입 0).
- `docs/decisions/ADR-0006-assessment-data-model.md` — `Assessment`/`Contribution` immutable + `@@unique([personId, period, scope, periodStart])`. reset-and-recreate(delete old row → create new)가 immutable Assessment 를 "변경" 하는 sanctioned 방식임을 확인(in-place mutation 아님).
- `src/assessment-evaluation/period-bridge-admin-persist.service.ts` — 현재 Admin full-persist 의 first-write-wins read-through(create-if-absent-else-read, P2002 race loser catch → read fall-through) 동작. 본 ADR 이 어디에 reeval opt-out 분기를 추가할지의 anchor.
- `src/assessment-evaluation/assessment-evaluation.controller.ts` — 기존 `POST /api/assessment-evaluation/period` controller(role dispatch). 재평가 요청 contract(mode field vs 별도 endpoint)의 anchor.
- `src/assessment-evaluation/evaluation-result-persist.service.ts` — `persist(context, results, mode)` / `PersistMode`(fill·reeval) 시그니처. reeval 호출 surface.
- `CLAUDE.md` §3.1(commitMode pr 판정 — 새 ADR 작성) / §5(BLOCKED 게이트 — dep/schema/credential 0 확인) / §12(언어 정책 — 본문 한국어, 키/식별자/enum 영어).

## Acceptance Criteria

본 task 는 **ADR-0038 1개 markdown 파일** 을 작성한다(src 0). ADR 본문이 다음 **6 결정 + 2 경계** 를 cover 해야 한다(각 항목은 ADR 의 해당 § 를 inspect 해 검증):

- [ ] **(AC1) §Decision — Admin 이 overwrite 를 어떻게 요청하는가(request contract)**: ADR 이 **period bridge 입력에 mode/flag 를 두는 안**(예: DTO 에 `reevaluate: boolean`(default `false`) 또는 `mode: "first-write-wins" | "reevaluate"`(default `"first-write-wins"`) field) **vs 별도 endpoint** 중 하나를 **결정하고 정당화** 한다. 권장은 기존 `POST /api/assessment-evaluation/period` DTO 에 mode/flag 를 추가해 default first-write-wins 를 보존하고 명시적 opt-in 으로 reeval 을 trigger 하는 안(별도 endpoint 분기 비용 회피 + 기존 controller dispatch 재사용). 요청 contract(field 명/타입/default/validation)를 박제. 별도 endpoint 안을 §Alternatives 에 미채택 근거와 함께 기록.
- [ ] **(AC2) §Decision — persistence semantics(reeval reset-and-recreate 재사용)**: overwrite 는 [ADR-0033](../decisions/ADR-0033-evaluation-result-persistence.md) 의 **`reeval` PersistMode(reset-and-recreate: `$transaction` 내 기존 Assessment+Contribution delete → fresh create)** 를 사용하고 **in-place mutation 이 아님**(ADR-0006 immutability 존중) 을 명시한다. **새 persist primitive 를 도입하지 않고 기존 reeval mode 를 재사용** 함을 explicit 으로 박제(persist service 시그니처 변경 0 — bridge 가 `mode: "reeval"` 을 넘길 뿐).
- [ ] **(AC3) §Decision — first-write-wins(ADR-0037 §Decision3)와의 관계**: default 는 first-write-wins read-through 로 유지되고, overwrite 는 그 **명시적 opt-out**(caller 가 재평가를 명시 요청하면 bridge 가 read-through 하지 않고 reset-and-recreate)임을 정의한다. 두 mode 의 **공존**(default first-write-wins / explicit flag = reevaluate)을 박제. **존재하지 않는 좌표에서 reevaluate 요청 시 동작**(좌표 부재 → create, fill 과 동일 — destructive 대상이 없으므로 일반 create)도 정의.
- [ ] **(AC4) §Decision — RBAC**: 재평가는 **Admin only**(User ephemeral 경로는 영속화 자체를 안 하므로 N/A — User 는 항상 write 0, 재평가 대상 없음). persist-path RBAC(ADR-0037 §Decision1 Admin full-persist guard) 재사용을 명시(새 guard/role 도입 0). User 가 reevaluate flag 를 넘겨도 ephemeral 경로라 영속 변경이 일어나지 않음(또는 fail-closed reject) — negative 경계를 박제.
- [ ] **(AC5) §Decision — idempotency/concurrency + safety**: 동시 reevaluate 호출 + `$transaction`/`@@unique` 상호작용(reset-and-recreate 의 직렬화 — ADR-0033 재사용)을 정의한다. overwrite 가 **기존 평가문을 파괴**(이전 평가 row delete)함을 명시하고, **v1 에서 그것이 acceptable 한지** 결정(권장: v1 acceptable — 평가문은 LLM/Agent 생성물이고 Admin 의 의도적 명시 요청이므로 churn-방지 first-write-wins 의 의도적 우회). 파괴된 이전 평가의 **audit trail(이력 보존)이 필요하면 별도 follow-up** 으로 §Follow-ups 에 flag(v1 범위 밖 — audit/version history 는 새 data-model 결정 동반).
- [ ] **(AC6) §Follow-ups — impl chain 분해(dependency-ordered slices)**: overwrite impl 을 dependency 순서 slice 로 분해(각 ≤300 LOC / ≤5 파일 + R-112 4 종(+ negative cases 충분 cover)). 예: (1) DTO 에 mode/flag field 추가 + validator + colocated spec → (2) orchestration 에 reeval opt-out 분기(default first-write-wins / flag 시 reset-and-recreate 호출) + unit(R-112: flag 분기 / Admin only / 좌표 부재 시 create / 좌표 존재 시 reset-and-recreate / User flag negative) → (3) controller wiring(mode field dispatch) + unit → (4) e2e(실 PostgreSQL: overwrite 가 기존 평가문을 replace, row count 가 1 로 stable 하되 content 가 NEW, default 호출은 여전히 first-write-wins). 각 slice 는 ADR-0038 머지 후 planner 가 큐잉.
- [ ] **(AC7) §5 boundary 확인**: ADR 본문(또는 Context/외력)에 **새 외부 dependency 0 / 외부 credential 0 / DB schema 변경 0**(기존 ADR-0033 reeval 경로 + 기존 entity·`@@unique`·guard 재사용 — 새 table/컬럼/unique/migration 미동반)임을 명시. live-LLM 검증만 후속 §5 credential 게이트(본 chain 밖). CLAUDE.md §5 BLOCKED 게이트의 어느 축(dep/schema/credential)도 발화 0.
- [ ] **(AC8) frontmatter status `PROPOSED`**: ADR-0038 의 frontmatter `status: PROPOSED` 로 작성한다. 사용자가 Q-0033 으로 이미 본 설계 진입을 승인했으므로 architect 가 PROPOSE 하고 **reviewer 가 ADR PR 을 검토** 한다(ADR-0037 T-0313 precedent mirror). PROPOSED→ACCEPTED flip 은 후속 follow-up 또는 impl-chain gating 의 일부로 처리(ADR-0037 이 §Decision2/3 를 다룬 방식 mirror — 본 ADR 의 §Status / §Follow-ups 에 flip 경로를 1줄 명시). frontmatter `relatedTask: [T-0325]`, `coversReq` 에 ADR-0037 와 동일 REQ, `supersedes: null`.
- [ ] **(AC9) R-110 tester 게이트(0 src 변경 검증)**: 본 task 는 ADR 1개만 작성하고 src/ 변경 0(markdown only)이므로, tester 가 `pnpm lint && pnpm build && pnpm test` 가 여전히 green(회귀 0)임을 확인한다. 신규 production symbol 0 → happy/error/branch/negative unit test 항목은 **본 ADR-only design task 에 해당 없음**(분기 있는 production 코드 미추가 — R-112 4 종은 §Follow-ups impl slice 의 Acceptance 에서 강제). spec-presence/CI 미파손 + coverage threshold 불변(src 0). **T-0313/T-0320 design-only precedent 와 동일 class**.
- [ ] **(AC10) 언어**: ADR 본문 한국어(§12), frontmatter `status`/키/식별자/경로/enum(`reeval`·`fill`·`PersistMode`·`P2002`·`$transaction`·`@@unique`·`ConflictException`)·HTTP method/path 는 영어 유지.

## Out of Scope

- **src/ 변경 일체 금지** — DTO mode field / orchestration reeval 분기 / controller wiring / e2e impl 은 전부 후속 slice(본 ADR-0038 머지 후 planner 가 큐잉). 본 task 는 ADR 문서 1개 작성만.
- **overwrite impl chain 자체** — §Follow-ups slice 들은 ADR-0038 머지 후 큐잉되는 후속 task.
- **audit trail / version history 구현** — ADR 은 필요 시 §Follow-ups 에 flag 만(새 data-model 결정 동반 — v1 범위 밖).
- **live-LLM 검증**(§5 credential, Q-0022) — 본 설계와 독립, 별도 게이트.
- **timezone**(Q-0026) — 본 ADR 과 독립.
- **새 외부 dependency 추가 / schema migration** — §5 게이트(본 task 는 dep/schema 0 — 기존 reeval 경로 + 기존 entity 재사용).

## Suggested Sub-agents

`architect` — ADR-0038(새 ADR markdown 1개, src 0) 작성: §Context(외력 Q-0033/ADR-0037 §Decision3/ADR-0033 reeval/ADR-0006 immutability) + §Decision 1~5(request contract / persistence semantics / first-write-wins 관계 / RBAC / idempotency·safety) + §Consequences + §Alternatives(별도 endpoint 안 미채택) + §Follow-ups(impl chain slice + audit follow-up) + frontmatter status PROPOSED. 이어 `tester` 가 pr-mode R-110 충족(0 src 변경 → lint/build/test green 확인). `reviewer` 가 pr-mode design ADR 검토(결정 일관성·Q-0033 정합·ADR-0033/0037/0006 cross-ref 정확성·§5 경계).

## Follow-ups

(ADR-0038 머지 후 다음 planner survey 가 dependency chain 으로 큐잉 — overwrite impl chain. 각 별도 task, ≤300 LOC·≤5 파일 + R-112.)

1. **slice 1 — DTO mode/flag field**: period bridge 입력 DTO 에 `reevaluate`/`mode` field 추가 + validator(default first-write-wins) + colocated spec(negative: wrong-type / default 보존).
2. **slice 2 — orchestration reeval opt-out 분기**: Admin persist orchestration 에 default first-write-wins / flag 시 reset-and-recreate(`mode: "reeval"`) 분기 + unit(R-112: flag 분기 / Admin only / 좌표 부재 시 create / 좌표 존재 시 reset-and-recreate / User flag negative).
3. **slice 3 — controller wiring**: controller 가 mode field 를 dispatch(Admin reevaluate 경로) + unit(orchestrator mock).
4. **slice 4 — e2e**: 실 PostgreSQL — overwrite 가 기존 평가문을 replace(row count 1 stable + content NEW) + default 호출은 여전히 first-write-wins(기존 read 반환) + 동시 reevaluate 수렴.
5. **(DEFERRED) audit trail / 이전 평가 version history** — overwrite 가 파괴한 이전 평가문을 보존/조회하는 경로(새 data-model 결정 동반 — v1 범위 밖, 필요 시 별도 ADR).
