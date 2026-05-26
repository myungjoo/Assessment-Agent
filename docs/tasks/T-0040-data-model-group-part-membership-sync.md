---
id: T-0040
title: data-model.md 갱신 — Group / Part / PersonGroupMembership entity 박제 + Person↔Group N:M 관계의 join entity 명시 (T-0039 reviewer MINOR follow-up)
phase: P3
status: PENDING
commitMode: direct
coversReq: [REQ-028]
estimatedDiff: 45
estimatedFiles: 1
created: 2026-05-26
plannerNote: T-0039 reviewer round 1 MINOR finding — Group/Part schema 박제됐으나 data-model.md §2/§3 의 living document 갱신 누락. 단일 파일 doc-only direct, cap 보존.
dependsOn: [T-0039]
blocks: []
hqOrigin: null
humanApprovalGate: false
supersedes: null
plannerSource: docs/tasks/T-0039-group-part-entity-and-repository.md §Follow-ups 4번째 bullet ("data-model.md / api.md / modules.md living document 갱신 — Group / Part / PersonGroupMembership entity 의 컬럼 박제 + Person↔Part / Person↔Group endpoint 추가") 의 data-model.md 부분만 1 task 로 분리. api.md 의 Group/Part endpoint 는 T-0030 시점에 이미 박제 (L76~83). modules.md UserModule 책임 행 (L34) 도 Group/Part conceptual 이미 cover. 따라서 실제 living document 갱신 gap 은 data-model.md 한 파일에 집중.
---

# T-0040 — data-model.md 갱신 (Group / Part / PersonGroupMembership entity 박제)

## Why

[docs/tasks/T-0039-group-part-entity-and-repository.md](T-0039-group-part-entity-and-repository.md) 가 P3 backbone 의 Group / Part / PersonGroupMembership 3 entity 의 Prisma model + repository + UserModule wiring 을 박제하면서 reviewer round 1 MINOR finding 으로 **data-model.md 의 living document 갱신 누락** 을 지적했다 (T-0039 §Follow-ups L109). 본 task 가 그 gap 을 단일 파일 doc-only direct 로 보강한다.

구체 gap:

- [docs/architecture/data-model.md](../architecture/data-model.md) §2 entity 표는 현재 **10 entity (+ 1 conceptual mention)** 로 박제 — Group / Part 는 row 3 / row 4 로 이미 존재 (REQ-028) 하지만 **PersonGroupMembership join entity** 의 row 미박제. T-0039 의 `prisma/schema.prisma` 는 본 join entity 를 실제로 신설했으므로 conceptual model 과 schema 간 mismatch 상태.
- §3 관계 2 (Person ↔ Group N:M) 가 "중간 join entity (예: `PersonGroupMembership`) 의 구체 schema 는 P3" 로 표기되어 있으나 **이미 T-0039 가 P3 안에서 박제 완료** — 현재 표기는 stale. 본 task 가 join entity 이름을 explicit + 구체 schema 위치 (T-0039 mergeCommit c25a5de + `prisma/schema.prisma`) 참조로 갱신.
- 합계 단락 ("10 entity (+ 1 conceptual mention)") 도 join entity 신설로 1 자리 shift 필요 → "11 entity (+ 1 conceptual mention)". data-model.md §2 의 합계 정정 단락은 본 task 의 책임.

본 task 는 [REQ-028](../requirements.md) (Group 다중 소속 + Part 정확히 1) 의 schema-level enforcement 와 conceptual model 정합성을 회복한다. living document 정합성 회복은 후속 T-0041+ backbone task (Assessment / Contribution / Summary / User+AuthModule 등) 가 data-model.md 를 reference 할 때 outdated row 로 confuse 되는 것을 사전 차단한다.

## Required Reading

- [docs/architecture/data-model.md](../architecture/data-model.md) — 본 task 가 갱신할 단일 파일. §1 / §2 entity 표 / §3 mermaid ER diagram / §6 REQ → entity coverage / §8 References 단락이 직접 영향 대상.
- [docs/tasks/T-0039-group-part-entity-and-repository.md](T-0039-group-part-entity-and-repository.md) §Acceptance Criteria 의 Schema/migration 단락 — 본 task 가 갱신할 join entity / 관계 박제의 source.
- [prisma/schema.prisma](../../prisma/schema.prisma) — T-0039 머지 (c25a5de) 후 현재 main 의 schema. Group / Part / PersonGroupMembership 3 model 의 실제 컬럼 / relation / unique constraint 의 검증 source. data-model.md §2 의 컬럼 conceptual mention 이 실 schema 와 정합한지 검산.
- [docs/architecture/p3-implementation-plan.md](../architecture/p3-implementation-plan.md) §2 표 row "Group + Part" — 본 task scope 외 (별도 follow-up T-0041 후보).
- [docs/requirements.md](../requirements.md) REQ-028 — Group / Part invariant 의 source.

## Acceptance Criteria

본 task 는 **단일 파일 (`docs/architecture/data-model.md`) doc-only direct** — 코드 / 테스트 / CI 변경 0. Acceptance Criteria 는 R-110 ~ R-114 면제 (doc-only direct commit), 대신 다음 갱신 항목 모두 만족.

**§2 entity 표 갱신**:

- [ ] §2 entity 표에 **PersonGroupMembership** row 신규 추가 (entity row 11번째 자리, Group / Part row 직후 또는 §2 표 끝의 자연스러운 자리). 책임 컬럼: "Person ↔ Group 다대다 관계의 join entity (REQ-028). `@@unique([personId, groupId])` 로 중복 membership 방지." source UC: UC-03. 관련 REQ: REQ-028. 책임 module: UserModule.
- [ ] §2 합계 단락의 "**10 entity (+ 1 conceptual mention)**" 를 "**11 entity (+ 1 conceptual mention)**" 로 정정. 본 task 머지로 entity 합계가 1 자리 shift 됨을 단락 본문에서 명시.
- [ ] §2 표 footer 의 "**module 명 정합성**" 단락은 추가 module 신설 0 — UserModule scope 안에서 처리되므로 본 단락 본문 변경 0 (PersonGroupMembership 의 책임 module = UserModule 으로 §2 표 row 에서 박제하는 것으로 충분).

**§3 ER diagram 갱신**:

- [ ] §3 mermaid ER diagram 의 `Person }o--o{ Group : "N:M (다중 그룹 소속 REQ-028)"` 관계를 **join entity 명시 형태** 로 갱신 — 예: `Person ||--o{ PersonGroupMembership : "1:N (membership row)"` + `Group ||--o{ PersonGroupMembership : "1:N (membership row)"` 의 2 관계로 분해. mermaid syntax 정합 검산 (단순 indent + 화살표 chars 만 변경, 다른 entity 관계는 unchanged).
- [ ] §3 본문 관계 박제 단락 (관계 2 — Person ↔ Group N:M) 의 "중간 join entity (예: `PersonGroupMembership`) 의 구체 schema 는 P3" 문장을 "**PersonGroupMembership join entity 가 T-0039 (mergeCommit c25a5de) 시점에 박제 완료. `prisma/schema.prisma` 참조**" 로 정정. (예: ... 의 syntactic example 부분 → 실 박제 결과 reference 로 격상)

**§5 cross-cutting field 단락 검토**:

- [ ] §5 표 의 `createdAt` 행 본문은 unchanged (모든 entity 공통 적용). `updatedAt` 행에 "mutable entity (... 기존 list ...)" 마지막에 PersonGroupMembership 추가 불요 — 본 join entity 는 mutation 없는 append-only relation (membership 생성/삭제만, 갱신 없음) → 본 단락 본문 변경 0.

**§6 REQ → entity coverage 갱신**:

- [ ] §6 표의 REQ-028 행의 "cover 하는 entity" 컬럼을 "Group, Part" → "Group, Part, **PersonGroupMembership**" 로 정정. 본 update 로 REQ-028 의 multi-soskok invariant 의 schema 차원 cover entity 가 3 개로 명시.

**§8 References 갱신**:

- [ ] §8 References 단락에 [docs/tasks/T-0039-group-part-entity-and-repository.md](T-0039-group-part-entity-and-repository.md) reference 1 줄 추가 — "T-0039 산출물 — Group / Part / PersonGroupMembership 의 Prisma schema 박제. 본 §2 / §3 갱신의 source." 본 reference 는 living document 의 갱신 source 추적을 보강.
- [ ] Refs 마지막 줄에 T-0039 ID 추가 (기존 Refs 에 T-0040 미포함 — 본 task 가 T-0040 이므로 본 task ID 도 추가).

**기타**:

- [ ] §1 본문 / §4 raw 미저장 invariant / §7 Out of scope 의 본문은 변경 없음 (본 task scope 외 — entity 추가는 join entity 1 개 만, raw 본문 / out-of-scope policy 영향 0).
- [ ] 파일 끝 라인 endings (CRLF/LF) 는 기존 파일과 동일 유지 — formatter 자동 변환 차단.
- [ ] 본 task 의 변경은 **단일 파일 (data-model.md) 만** — 다른 docs/architecture/*.md 또는 docs/use-cases/*.md 또는 prisma/* 변경 0. 다른 doc artifact 의 갱신은 별도 follow-up task 의 책임.

## Out of Scope

본 task 는 **하지 않는다** — 후속 task 책임:

- **modules.md UserModule 책임 행 갱신** — modules.md L34 의 UserModule 책임 단락이 이미 "평가 대상 인원 CRUD + group / part 소속 / activate·deactivate" 로 Group / Part conceptual 을 cover. PersonGroupMembership 의 mention 까지 격상은 별도 작은 doc task 또는 본 task 직후 follow-up 으로 분리 가능 — 본 task scope 외.
- **api.md 의 Group / Part endpoint 갱신** — api.md L76 ~ 83 의 Group / Part endpoint 8 행이 T-0030 시점에 이미 박제 완료. 본 task 머지 후에도 unchanged.
- **p3-implementation-plan.md §2 표의 task ID shift 정정** — T-0039 의 §Follow-ups L106 박제. T-0038 (cron #7 갱신에서 backbone 책임 박제) → T-0039 (실제 머지) → T-0040 (본 doc-sync) → T-0041 (다음 backbone) shift 의 §2 표 정정은 별도 doc-only direct task 로 분리.
- **PersonGroupMembership 의 구체 컬럼 type / unique constraint 정확 표기** — 본 task 는 conceptual model 만 박제 (data-model.md §1 의 MVA 원칙). 구체 schema 는 prisma/schema.prisma + T-0039 migration SQL 이 source — 본 task 가 별도 인용 불요.
- **Group / Part 의 컬럼 추가 (description / leaderId 등)** — 본 task 는 T-0039 가 박제한 schema 만 conceptual 로 동기화. 신규 컬럼 추가는 별도 task + 별도 entity scope 확장 결정.
- **REQ-028 invariant 의 service-layer 강제 (정확히 1 Part / multi Group)** — 별도 task T-0041+ 의 GroupService / PartService 책임.
- **§2 conceptual mention 의 AuditLog entity row** — 본 task scope 외, 별도 보안 ADR (예: ADR-0007 audit-log schema) 책임.
- **gap REQ-004** (사용자 지정 기간 임의 평가문) 의 entity 영향 박제 — REQ-COVERAGE-AUDIT.md gap 의 P5 책임, 본 task 는 reference 만.
- **data-model.md 전반의 typo / 표 정렬 / mermaid syntax 정합 정리** — 본 task 는 Group / Part / PersonGroupMembership 갱신만 — 다른 entity 행은 unchanged.

## Suggested Sub-agents

`implementer → (R-110 면제 doc-only direct — tester 호출 불요)`.

본 task 는 doc-only direct commit — coverage / lint / build / test 면제 (CLAUDE.md §3.2 R-110 적용 제외 단서 "direct-mode doc-only commit 만 본 규칙 면제"). architect 호출 불요 (신규 ADR / 결정 0 — T-0039 가 이미 박제한 schema 의 conceptual model 동기화만). implementer 가 data-model.md 단일 파일 edit 후 driver 가 STATE / journal / task frontmatter 만 wrap.

## Follow-ups

(작성 시점 비어 있음 — sub-agent 가 작업 중 발견한 항목을 본 섹션에 append.)

선행 후보 (planner pre-fill, sub-agent 가 검토 후 유지 / 제거):

- [ ] **modules.md UserModule 책임 행에 PersonGroupMembership mention 1 줄 추가** — 본 task scope 외로 분리. 매우 작은 doc-only direct (1 줄 변경 / 1 파일) — 별도 task 또는 본 task 진행 중 implementer 가 함께 처리 검토 가능 (scope 위반 위험 — 본 task 의 단일 파일 원칙 깨짐, 분리 권장).
- [ ] **p3-implementation-plan.md §2 표 task ID shift 정정** — T-0038 (cron #7 박제 "Group+Part backbone") → T-0039 (실제 entity-only 머지) + 후속 row 의 T-0040 → T-0041 / T-0041 → T-0042 / T-0042 → T-0043 / T-0043 → T-0044 1 자리 shift. mermaid graph 의 노드 라벨 + 의존성 화살표 + §3 본문 / §4 ADR 표 / §6 P3 closure 단락 등 단일 파일 다단락 갱신. doc-only direct ~70 LOC 추정 (T-0038 의 갱신 패턴 재실행).
- [ ] **api.md 의 Group / Part endpoint 행에 PersonGroupMembership 의 membership add/remove endpoint 추가 여부 검토** — REQ-028 의 Person ↔ Group 다대다 mutation API 는 T-0041+ 의 GroupService / PartService 책임으로 별도 task 에서 endpoint 추가 시 api.md 동시 갱신.
- [ ] **PersonRepository 확장** — `findByPartId(partId)` + `findByGroupId(groupId)` query 메서드 (T-0039 §Follow-ups L108 박제). pr-mode code task — 본 doc-sync 후 별도 진입.
- [ ] **data-model.md §2 conceptual mention AuditLog row 의 schema 박제 ADR 신설** — 본 task scope 외, 별도 보안 ADR 책임 (T-0043+ 또는 P4 hook).
