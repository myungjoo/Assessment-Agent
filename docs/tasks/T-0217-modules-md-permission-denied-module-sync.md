---
id: T-0217
title: modules.md 에 PermissionDeniedRecordModule 박제 + 9-module 카운트 정합 (doc-sync)
phase: P4
status: PENDING
commitMode: direct
coversReq: [REQ-016, REQ-044]
estimatedDiff: 35
estimatedFiles: 1
created: 2026-06-04
plannerNote: P4 — Q-0020 audit-endpoint milestone 완결 후 modules.md 가 9번째 shipped module(PermissionDeniedRecordModule) 누락 + "8 module" 카운트 오류라 실제 코드와 모순 → 정합.
---

# T-0217 — modules.md 에 PermissionDeniedRecordModule 박제 + 9-module 카운트 정합

## Why

`docs/architecture/modules.md` 는 시스템을 "**8 NestJS module**" 로 분해한다고 박제하나 (line 28 "다음 8 NestJS module 로 분해된다" / line 42 "위 8 module 은 `AppModule`" / line 179 "총 8 component → 8 module"), 실제 `src/app.module.ts` 는 **9 module** 을 register 한다 — `PermissionDeniedRecordModule` (T-0210, ADR-0022) 이 누락돼 있다. 이 module 은 ADR-0022 의 권한 거부 영속화 layer + ADR-0023 의 audit 조회 read path (`GET /api/permission-denied-records` controller, T-0214) 를 담는 shipped module 인데, modules.md 의 module 표 / mermaid 의존성 그래프 / topological order / components↔modules mapping 어디에도 등장하지 않는다 (현재 "PermissionDenied" 문자열은 ConfluenceModule / GithubModule cell 의 "4xx → PermissionDeniedEvent emit" 설명에만 2회 등장). CLAUDE.md §7.1 상 modules.md 는 sub-agent 가 `src/` 광범위 read 대신 먼저 읽는 **canonical module index** 이므로, 실제로 main 에 머지된 module 의 부재 + headline 카운트 오류는 cosmetic 이 아니라 material staleness 다. Q-0020 audit-endpoint milestone (T-0213~T-0216) 완결로 이 module 의 read path 까지 확정됐으니 지금 정합한다.

## Required Reading

- `docs/architecture/modules.md` — 본 task 가 수정할 대상. 특히 "Module 목록" 표 (line 26~42), mermaid 의존성 그래프 (line 44~109), Acyclic 검증의 topological order (line 118~134), "Components ↔ Modules mapping" 표 (line 164~179).
- `src/app.module.ts` — 9 module register 사실 source (PermissionDeniedRecordModule import + imports 배열).
- `src/permission-denied/permission-denied-record.module.ts` — module 책임 / providers·exports / controller 등록 (T-0210 + T-0214).
- `docs/decisions/ADR-0022-permission-denied-record-data-model.md` (Decision §1 instanceRef / §6 emitter port) + `docs/decisions/ADR-0023-permission-denied-audit-query-rbac-contract.md` (Decision §5 endpoint shape) — module 책임 1~2줄 + 관련 ADR 인용 출처.

## Acceptance Criteria

- [ ] modules.md 의 "8 module" 표현을 실제 register 수 (**9 module**) 로 정합 — 최소 line 28 / line 42 / line 179 (및 그 외 "8 module" / "8 NestJS module" 표현 전부 grep 으로 확인 후 일괄). `grep -n "8 module\|8 NestJS module\|8 component" docs/architecture/modules.md` 로 잔여 0 확인.
- [ ] "Module 목록" 표 (line 30~40) 에 **PermissionDeniedRecordModule** row 1개 추가 — 책임 1~2줄 (GitHub/Confluence adapter 의 권한 거부 이벤트 영속화 repository+service + audit 조회 controller `GET /api/permission-denied-records`, RBAC=@Roles("User") + service-layer audience 차등), 주요 dependency (PersistenceModule @Global PrismaService — imports 명시 불요), 관련 component (Backend API audit 부분 / DB Persistence), 관련 REQ (REQ-016 user/admin audience / REQ-044 권한 거부 가시화), 관련 ADR (ADR-0022 / ADR-0023). 기존 8 row 와 동일 표 포맷 유지.
- [ ] mermaid 의존성 그래프에 PermissionDeniedRecordModule 노드 + `app --> permissionDenied` (AppModule register) edge 추가. PersistenceModule 의존은 @Global 주입이라 기존 graph 의 표기 관례 (UserModule 등은 `--> persistence` 명시) 와 일관되게 처리 — leaf 성격 (다른 internal module import 0) 명시.
- [ ] Acyclic 검증의 topological order (line 124~132) 에 PermissionDeniedRecordModule 삽입 위치 반영 (PersistenceModule 이후, AppModule 이전 — leaf 성격).
- [ ] (선택) Components ↔ Modules mapping 표 갱신 — PermissionDeniedRecordModule 이 Backend API component 의 audit 조회 부분 + DB Persistence 영속화에 걸치는 N:N mapping 반영. 표의 "총 N component → N module" 합계 문장도 정합.
- [ ] 수정 후 modules.md 내 module 수 서술 (표 row 수 / 카운트 문장 / mapping 합계) 이 서로 모순 없이 9 로 일관.
- [ ] 분기 / 코드 없음 — doc-only direct commit. R-112 test 항목 해당 없음 (production code 0 LOC, tester 미호출 — direct-mode doc-only commit 은 R-110 면제).

## Out of Scope

- `src/` 코드 변경 0 — 본 task 는 doc-sync 전용. module 의 책임 / endpoint 동작을 바꾸지 않는다.
- ADR-0022 / ADR-0023 본문 수정 0 — 인용만.
- 다른 architecture doc (components.md / api.md / deployment.md / directory.md) 동시 수정 금지 — 만약 그쪽에도 9-module 정합이 필요하면 별도 follow-up task. (api.md 는 T-0215 가 이미 audit endpoint doc-sync 완료.)
- modules.md 의 8→9 정합 외 무관한 문장 (LlmModule milestone-1 서술 / ConfluenceModule milestone-3 서술 등) 재작성 금지 — diff 최소.
- non-Admin own-instance 실 필터 / User↔instance binding schema 서술 추가 금지 — 그것은 §5 DB-schema 게이트 (미승인) 라 아직 shipped 아님. PermissionDeniedRecordModule 책임 서술은 현재 shipped 범위 (Admin bypass + non-Admin binding-부재 빈 배열 fallback) 까지만.

## Suggested Sub-agents

`implementer` (doc-only direct 이므로 architect/tester 불요 — driver 가 직접 Edit 해도 무방).

## Follow-ups

(작성 시점 비어 있음)
