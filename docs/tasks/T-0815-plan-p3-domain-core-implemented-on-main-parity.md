---
id: T-0815
title: PLAN.md P3 domain-core bullet 10종 implemented-on-main checkbox 정합
phase: P5
status: DONE
completedAt: 2026-07-07T19:39Z
commitMode: direct
coversReq: [REQ-047, REQ-048, REQ-051, REQ-059, REQ-063, REQ-084, REQ-086, REQ-032]
estimatedDiff: 14
estimatedFiles: 1
created: 2026-07-08
independentStream: plan-doc-drift
dependsOn: []
touchesFiles: [docs/PLAN.md]
plannerNote: P5-in-progress; T-0809/0811~0814 drift 패턴을 미정합 P3 bullet(L53~62)에 mirror — P3 domain-core 는 이미 shipped 인데 `[ ]` stale
---

# T-0815 — PLAN.md P3 domain-core bullet 10종 implemented-on-main checkbox 정합

## Why

T-0809(P5 detection/adjustment)·T-0811(P7 scheduling)·T-0812~0814(P5 단위/요약/overwrite) 가 교정해 온 "PLAN↔shipped-code drift" 패턴을 **아직 미정합인 P3 Phase(Domain core) bullet 에 mirror** 한다. STATE.phase 는 이미 `P4-complete / P5-in-progress` 이고 binding decision T-0133 이 P3→P4 전이를 박제했는데, `docs/PLAN.md` L53~62 의 P3 domain-core bullet 10종(인원 CRUD/deactivate·서비스별 ID 매핑 R-48·primary ID R-47·Group 정책 R-51·평가 결과 저장 모델·raw 미저장 R-59·상대 비교 R-63·Persistence layer·Auth/RBAC R-84·User read-only R-86)은 여전히 `[ ]` 미체크 stale drift 상태다. grep 실측 결과 이 10 capability 는 전부 `src/user/`·`prisma/schema.prisma`·`src/auth/` 에 shipped-on-main 이다(PersonService/GroupService/PartService·`isPrimary` schema invariant·Assessment/Contribution/Summary model·raw 본문 컬럼 0 schema-level·RolesGuard/SuperAdmin self-demote guard). 이를 `[x]` + implemented-on-main 절로 정합해 미래 planner 의 done-bullet 재큐잉(make-work) risk 를 차단한다.

## Required Reading

- `docs/PLAN.md` (L47~62 P3 phase 헤더 + 대상 10 bullet; L63~66 이미 `[x]` 된 test-quality bullet 의 implemented-on-main 포맷 참고)
- `docs/tasks/T-0811-plan-p7-scheduling-implemented-on-main-parity.md` (checkbox 정합 precedent — implemented-on-main 절 포맷 mirror 대상)
- 실shipped 확인용(읽기만, 링크 경로/symbol 실존 재검증):
  - `src/user/person.service.ts` / `src/user/person.controller.ts` (인원 CRUD + deactivate/reactivate, activeOnly 조회)
  - `prisma/schema.prisma` L251~262(`isPrimary` 1-Person-1-primary invariant, R-47/R-48 서비스별 ID 매핑) + L294 `model Assessment` / L329 `model Contribution` / L361 `model Summary`(평가 결과 저장 모델 commit/document·일/주/월 요약) + L280~285(raw 본문 컬럼 0, R-59 schema-level 강제) + L290(`contributionScore Decimal`, R-63 상대 비교 정규화)
  - `src/user/group.service.ts` / `src/user/group.controller.ts` + `src/user/dto/add-member.dto.ts`(Group 다중 소속 + 조직도 파트 정확히 1개, R-51)
  - `src/user/part.service.ts` / `src/user/part.controller.ts`
  - `src/persistence/` 또는 `PrismaService`(Persistence layer — ADR-0002)
  - `src/user/user.service.ts`(REQ-044 5 invariant + 첫 user SuperAdmin + self-demote 금지, R-84) + `src/auth/` RolesGuard/@Roles
  - `src/user/dto/user-response.dto.ts`(User read-only 응답 whitelist, R-86)

## Acceptance Criteria

- [ ] `docs/PLAN.md` L53~62 의 P3 domain-core bullet 10종(현 `- [ ]`)을 각각 `- [x]` 로 flip.
- [ ] 각 bullet 끝에 **implemented-on-main** 절 append — 실 파일 경로(상대링크) + symbol + 해당 ADR 참조. L96~105(P5, T-0809/0812) 및 L37~44(T-0811) 포맷 mirror. 예: 인원 CRUD = `[person.service.ts](../src/user/person.service.ts)` PersonService CRUD + deactivate/reactivate.
- [ ] append 하는 모든 링크 경로·symbol 을 구현 직전 `git grep`/`ls` 로 origin/main 실존 재확인(T-0809/T-0811 규율). 실존 안 하는 경로 링크 금지 — 특히 Persistence layer 의 실 module/service 경로(`src/persistence/` vs 다른 위치)를 grep 으로 확정 후 링크.
- [ ] R-59(raw 미저장)는 `prisma/schema.prisma` 의 "raw 본문 컬럼 0" schema-level 강제(L280~285 주석 + 참조 식별자만 보유)로 implemented 임을 절에 명시(ADR-0006 §4).
- [ ] R-84(Auth/RBAC)는 첫 로그인 SuperAdmin 지정 + Admin→User 변경 SuperAdmin 한정 + self-demote 금지 3 invariant 가 `user.service.ts`(REQ-044) + RolesGuard 로 shipped 임을 절에 명시.
- [ ] append-only 규율 — 기존 REQ 참조·설명 본문·헤더·이미 `[x]` 된 L63~66 test-quality bullet 은 보존, checkbox flip + implemented-on-main 절 추가만.
- [ ] 분기 없음 — doc checkbox flip 이라 코드 분기/negative test 무관(이 항목 생략, R-112 코드 task 아님).
- [ ] direct doc-only commit — 코드/test 0 이라 tester 불요(R-110 면제). markdown 형식 유효성만 확인(링크 렌더·리스트 구조 보존).

## Out of Scope

- P3 phase 헤더(L47~51 목표/entry document blockquote) 문구 변경.
- L63~66 의 이미 `[x]` 된 test-quality bullet 재편집.
- 확실히 shipped 판정 안 되는 bullet 이 있으면(예: 특정 capability 의 실 경로가 grep 으로 명확히 안 잡히면) 그 bullet 은 flip 하지 말고 `[ ]` 유지 + Follow-ups 에 사유 기록(보수적 판정 — false-positive flip 금지).
- P5/P7 의 남은 `[ ]` bullet(L98 R-9·L106 R-64·L108~110 live-LLM/실 github e2e·L136~148 P7/P8) 변경 — 본 task 는 P3 L53~62 국한.
- `src/` 코드·`prisma/schema.prisma` 변경 일체 — 본 task 는 PLAN.md doc-drift 정합만.
- STATE.json / journal / counters write(driver 몫).

## Suggested Sub-agents

`implementer` (doc-only, PLAN.md 편집 + 링크 경로 실존 재확인). tester 불요(direct doc-only, R-110 면제).

## Follow-ups

(비어있음 — sub-agent 가 관련 작업 발견 시 여기 append)

## 완료 요약 (DONE)

- **완료 시각**: 2026-07-07T19:39Z (cron@AKIHA-1e0ae7f4-9838 fire).
- **결과**: `docs/PLAN.md` L53~62 P3 domain-core bullet 10종을 `[ ]`→`[x]` flip + 각 bullet 에 implemented-on-main 절(실 파일 경로 링크 + symbol + ADR) append (+10/-10, 1 파일). commit 406812b0 direct main push(fast-forward, source=target=main).
- **실존 재확인**: 참조한 13개 src/prisma 경로 + ADR-0002/ADR-0006(파일명 `ADR-0006-assessment-data-model.md` 확정) 전부 origin/main 실존 grep/ls 확인. false-positive flip 0(10 bullet 전부 shipped 명확).
- **패턴**: T-0809/0811~0814 PLAN↔shipped-code drift-reconciliation mirror — 미래 planner 의 done-bullet 재큐잉(make-work) 차단.
