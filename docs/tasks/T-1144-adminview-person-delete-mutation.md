---
id: T-1144
title: AdminView 인원 삭제 mutation 배선 DELETE /api/persons/:id
phase: P6
status: DONE
commitMode: pr
prNumber: 1036
mergedAs: 2707432a
completedAt: 2026-07-23T13:25Z
coversReq: [REQ-049]
estimatedDiff: 300
estimatedFiles: 4
created: 2026-07-23
sizeExempt: true
exemptReason: "R-112 backbone × 1.5 — PersonList onDelete prop + AdminView runDeletePerson + 두 colocated spec 의 R-112 충분 cover(happy/404/403/network/분기/negative) 로 test 파일이 무거움. T-1135(provider delete, impl +149 +331 test) 동형 precedent."
independentStream: p6-frontend-person
dependsOn: []
touchesFiles:
  - web/src/components/PersonList.tsx
  - web/src/components/PersonList.test.tsx
  - web/src/views/AdminView.tsx
  - web/src/views/AdminView.test.tsx
plannerNote: "cap-bend pre-justified: R-112 backbone × 1.5 = 300 LOC, T-1135 provider-delete 패턴 정당화. P6 Admin 인원관리 delete slice, T-1143 create 후속."
---

# T-1144 — AdminView 인원 삭제 mutation 배선 DELETE /api/persons/:id

## Why

P6 PLAN.md line120 "Admin 패널 (인원·그룹…)" 의 인원 관리 UI 는 read(T-1142)·create(T-1143) 까지 배선됐다. 본 task 는 CRUD 의 delete slice 를 채워 `DELETE /api/persons/:id`(person.controller.ts `@Delete(":id")`, 204 No Content, row 부재 404) 를 AdminView 인원 관리 섹션에 배선한다. LLM provider 삭제(T-1135)·그룹 멤버 제거(T-1130) 와 동형 mirror 패턴이며 REQ-049(Admin 인원 관리) 를 잇는다.

## Required Reading

- `web/src/views/AdminView.tsx` — 특히 PERSONS_PATH(66행), buildPersonsPath(601행), personsRefreshNonce(1528행), runCreatePerson(1365 부근), 인원 관리 섹션 렌더. runDeleteProvider(T-1135) 를 mirror 대상으로 참조.
- `web/src/components/PersonList.tsx` — PersonListProps(38행), 현재 onDelete prop 부재. LlmProviderConfigList 의 onDelete prop 패턴(행별 삭제 버튼, 미제공 시 미렌더) 을 mirror.
- `web/src/components/PersonList.test.tsx` — 기존 presentational spec 컨벤션.
- `web/src/views/AdminView.test.tsx` — 기존 person create/read spec 컨벤션(mutation 러너 test 패턴).
- `src/user/person.controller.ts` (89–95행) — DELETE 계약(204, 404) 확인만.

## Acceptance Criteria

- [ ] `PersonList.tsx` 에 optional `onDelete?: (id: string) => void` prop 추가 — 제공 시에만 각 행에 "삭제" 버튼 렌더(미제공 시 버튼 미렌더, T-1135 provider onDelete mirror). presentational 책임 유지(실 fetch 없음).
- [ ] `AdminView.tsx` 에 `runDeletePerson` 순수 러너 + `handleDeletePerson` 배선 추가 — `DELETE /api/persons/:id` 호출, 성공 시 `personsRefreshNonce` bump 로 GET /api/persons 재조회, 실패 시 error state 설정(no-throw), in-flight 이중 DELETE 가드(deleting id 추적). `buildPersonsPath`·`personsRefreshNonce` 재사용(신규 path 상수 0).
- [ ] apiClient / useApiResource / backend 파일 수정 0(배선만).
- [ ] happy-path unit test 1+ — `runDeletePerson`/onDelete 정상 삭제 후 nonce bump·재조회 검증, PersonList "삭제" 버튼 클릭 시 onDelete(id) 호출 검증.
- [ ] error path unit test 1+ — DELETE 404(row 부재)·403(권한 부족)·network 실패 각각 error state 설정·throw 안 함 검증.
- [ ] 분기/flow test — in-flight 가드(중복 클릭 시 두 번째 DELETE 미발화)·onDelete 미제공 시 버튼 미렌더 각 분기 1+.
- [ ] negative cases 충분 cover — 빈/비정상 id, 재조회 전 컴포넌트 unmount 안전, 이중 삭제 방지, 삭제 실패 후 목록 유지 등 예외 분기마다 1+.
- [ ] `pnpm --dir web test` (vitest) 및 `pnpm --dir web build` green.
- [ ] `pnpm test:cov` 통과(line ≥ 80% / function ≥ 80%). web 테스트는 vitest coverage 로 확인.

## Out of Scope

- 인원 수정(PATCH /api/persons/:id) mutation — 별도 후속 task(T-1145 예정).
- PersonList 정렬·필터·페이지네이션.
- 삭제 확인 다이얼로그(confirm modal) — 단순 버튼 배선까지만. 필요 시 Follow-up.
- backend person.controller / service / DTO 변경.
- 다른 stream(그룹·LLM provider·permission-denied) 파일 변경.

## Suggested Sub-agents

implementer → tester

## Follow-ups

(비어 있음)
