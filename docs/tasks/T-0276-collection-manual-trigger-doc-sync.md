---
id: T-0276
title: collection manual-trigger doc-sync (modules.md + api.md + ADR-0031 ACCEPTED)
phase: P4
status: PENDING
commitMode: direct
coversReq: [REQ-040]
estimatedDiff: 40
estimatedFiles: 3
created: 2026-06-07
plannerNote: P4 ADR-0031 chain 마지막 slice(#5 doc-sync) — controller+CollectionTriggerService+collect endpoint 정합 + ADR status flip(direct, doc-only)
---

# T-0276 — collection manual-trigger doc-sync (modules.md + api.md + ADR-0031 ACCEPTED)

## Why

ADR-0031(collection manual-trigger HTTP endpoint) 의 호출처 결선 chain (#1 DTO[T-0271] → #2a read[T-0272] → #2b orchestration[T-0273] → #3 controller[T-0274] → #4 e2e[T-0275]) 이 코드 레벨로 전부 머지됐다. 이제 architecture 문서가 reality 와 어긋나 있다: modules.md 의 AssessmentCollectionModule row 는 "구성(9 service)" + "호출처(scheduler/manual trigger) 결선...은 후속 deferred" 로 stale 하고, api.md 에 `POST /api/assessment-collection/collect` endpoint row 가 부재하며, ADR-0031 status 가 PROPOSED 그대로다. 본 task 는 이 3종 문서를 머지된 코드(REQ-040 manual trigger)로 정합하는 **chain 의 마지막 slice (#5, ADR-0031 §6 implementation plan)** 다. 순수 문서 정합 + ADR status 한 줄 flip 이라 direct.

## Required Reading

- `docs/architecture/modules.md` line 3 (머리말 — T-0269 까지의 이력 chain, 본 task 이력 append 위치), line 40 (AssessmentCollectionModule row — "구성(9 service)" / "호출처...deferred" stale 문구), line 188 (components↔module mapping 의 "Backend API" row — 현재 4 module 나열, controller 추가 점검), line 196 (총 component→module mapping 요약 문구)
- `docs/architecture/api.md` line 89~97 (`/api/assessments` endpoint 표 — 5-col 패턴 METHOD/path/책임 UC/1줄 description/auth tier + section header 패턴 `| **...** | | | | |`. 신규 collect endpoint row 를 mirror 할 reference), line 140 (201 status code policy 예시 목록), line 157 (UC-01 cross-reference row)
- `docs/decisions/ADR-0031-collection-manual-trigger-endpoint.md` — §1(경계 timestamp) / §2(endpoint 계약: route `POST /api/assessment-collection/collect` / RBAC Admin / `CollectTriggerDto{personId,period,scope,periodStart?}` / response 201 `CollectionTriggerSummary` / 에러 404·400·409) / line 2 Status 줄(PROPOSED→ACCEPTED flip 대상)
- `src/assessment-collection/assessment-collection.controller.ts` (머지된 controller — `@Controller("api/assessment-collection")` + `POST collect` 201 + `@Roles("Admin")`, doc 표기 reality source)
- `src/assessment-collection/collection-trigger.service.ts` line 24~32 (`CollectionTriggerSummary` shape — response 표기 reality source) + line 35~41 (10번째 service 로 추가될 `CollectionTriggerService` orchestration)

## Acceptance Criteria

doc-only task — R-112(test 작성)·R-110(코드 검토)은 코드 변경 0 이므로 무관. 검증은 파일 inspection 으로 한다.

- [ ] `docs/architecture/modules.md` 의 AssessmentCollectionModule row(line 40) 가 reality 정합: (a) "구성(9 service)" → controller(`AssessmentCollectionController`, POST `/api/assessment-collection/collect`, Admin RBAC) + 10 service(`CollectionTriggerService` orchestration 포함) 로 갱신, (b) "호출처(scheduler/manual trigger) 결선...은 후속 deferred" 문구를 "manual trigger 호출처 결선 완료(T-0271~T-0275, ADR-0031); scheduler 자동화·live/credentialed 수집(Q-0025)은 후속 deferred" 로 정정. T-0271~T-0276 / ADR-0031 링크 박제.
- [ ] modules.md line 188(Backend API ↔ module mapping) 점검 — manual trigger endpoint 가 AssessmentCollectionModule controller 로 노출되므로, Backend API row 에 AssessmentCollectionModule(collection trigger 부분) 반영 필요 여부 판단 후 정합(필요 시 module 나열 + N 갱신, line 196 요약 문구도 동기). 변경 불요로 판단 시 task 본문에 근거 명시.
- [ ] modules.md line 3 머리말 끝에 T-0276 이력 1줄 append (기존 T-0255/T-0266/T-0269 chain 표기 패턴 mirror — collection manual-trigger 호출처 결선 doc-sync 박제).
- [ ] `docs/architecture/api.md` 에 `POST /api/assessment-collection/collect` endpoint row 추가 — 기존 5-col 표 패턴(METHOD | path | 책임 UC | 1줄 description | auth tier) mirror. description 에 ADR-0031 §2 계약 박제: request body `CollectTriggerDto{personId,period,scope,periodStart?}`, response 201 `CollectionTriggerSummary`, 에러 404(Person 부재)·400(literal 위반)·409(동일 경계 P2002), T-0271~T-0275 / ADR-0031 링크. tier=Admin+. 책임 UC=UC-01(manual trigger). 적절한 section(예: `/api/assessments` UC-01 근처 또는 신규 collection section header)에 배치. UC-01 cross-reference(line 157) 갱신 여부 점검.
- [ ] `docs/decisions/ADR-0031-collection-manual-trigger-endpoint.md` line 2 Status: `PROPOSED (T-0270)` → `ACCEPTED (T-0276)` 한 줄 flip (chain 구현 완료 — ADR status 갱신은 direct 허용, CLAUDE.md §3.1 규칙 4).
- [ ] 변경 diff 가 순수 문서 정합 범위 — src/ · test/ · package.json · CI workflow 미변경. cap ≤300 LOC / ≤5 파일 준수(3 파일).

## Out of Scope

- ADR-0031 본문(§1~§6) 의 status 외 내용 재작성 — status 한 줄 flip 만.
- src/ · test/ 코드 변경 — 코드 chain(#1~#4)은 이미 머지 완료. 본 task 는 doc-only.
- scheduler 자동화(주기 수집) 호출처 결선 — ADR-0031 §6/§7 가 후속 deferred 로 명시(미승인).
- live/credentialed 수집(Q-0025, 실 token + 실 네트워크 round-trip) — UI 이후 deferred, 별도 §5 게이트.
- modules.md / api.md 의 collection trigger 와 무관한 다른 row 정합 — 본 task 범위 밖.

## Suggested Sub-agents

`implementer` 단독 — doc-only direct edit (3 파일 inline-amend). architect/tester 불요(코드 변경 0, ADR 신설 아님).

## Follow-ups

- ADR-0031 호출처 결선 chain(#1~#5) 완료 — 본 task 가 마지막 slice. 추가 후속 없음.
- 비-빈 serviceIdentities 의 live 수집(실 GitHub/Confluence round-trip) 검증은 Q-0025 로 deferred(UI 이후, §5 credential 게이트).
