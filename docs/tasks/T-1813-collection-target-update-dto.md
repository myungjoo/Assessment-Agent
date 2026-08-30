---
id: T-1813
title: CollectionTarget 편집 API 의 Update DTO 신설
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-070, REQ-072, REQ-073]
estimatedDiff: 300
estimatedFiles: 2
created: 2026-08-30
independentStream: collection-target-registration
dependsOn: [T-1812]
touchesFiles:
  - src/assessment-collection/dto/update-collection-target.dto.ts
  - src/assessment-collection/dto/update-collection-target.dto.spec.ts
sizeExempt: true
exemptReason: 초과분 전량이 R-112 강제 colocated spec — production 순증 ≤ 70 LOC (필드 5 개, 전량 optional). T-1812(340 LOC · 7 필드 DTO) 선례 승계.
plannerNote: ADR-0059 Follow-ups (c) 의 둘째 조각 — DTO 2 종 중 Update 축만. controller/route/guard 는 별도 slice.
---

# T-1813 — CollectionTarget 편집 API 의 Update DTO 신설

## Why

오너 지시 [PLAN](../PLAN.md) `130 행`(REQ-070 / REQ-072 / REQ-073) 의 수집 대상 등록·편집 축 chain 을 잇는다. [ADR-0059](../decisions/ADR-0059-collection-target-registration.md) `§Follow-ups (b)` 는 T-1808 ~ T-1811 로 종결됐고, `§Follow-ups (c)`("Create / Update DTO + 5 route + guard 배선") 는 [T-1812](T-1812-collection-target-create-dto.md) 가 `CreateCollectionTargetDto` 를 박아 첫 조각을 끝냈다. 남은 것은 **Update DTO · controller + 5 route + guard 배선** 인데, 이 둘을 한 task 로 묶으면 파일 4+ · R-112 spec 포함 600 LOC 을 넘겨 [CLAUDE.md §3](../../CLAUDE.md) cap 을 확실히 초과한다. 그래서 본 slice 는 **PATCH 의 payload 검증 계약(Update DTO 1 종)만** 잘라 박제한다. 이 DTO 는 ADR `§Decision 5` PATCH 행의 두 계약 — (i) RFC-7396 merge patch 의 전 필드 optional, (ii) 정체성 축(`type` · `instanceKey`) 갱신 금지 — 를 controller 보다 앞서 타입·검증 층에 고정해, 후속 controller slice 가 그 계약을 재추론하지 않게 한다.

## Required Reading

- [docs/decisions/ADR-0059-collection-target-registration.md](../decisions/ADR-0059-collection-target-registration.md) — `§Decision 5`(PATCH 200 / RFC-7396 merge patch / `type` · `instanceKey` 는 갱신 축 제외 — 변경은 DELETE + POST / 오류 표 e 행 = 검증 실패 400) · `§Decision 4`(필드 표 7 종 중 좌표 5 종의 타입) · `§Decision 2`(credential 계열 필드 금지)
- [src/assessment-collection/collection-target.repository.ts](../../src/assessment-collection/collection-target.repository.ts) — `CollectionTargetUpdateInput`(`endpoint?` · `orgs?` · `repos?` · `spaces?` · `active?` 5 종, 빈 객체 `{}` 도 valid) 의 필드명·optional 경계 정합 대상
- [src/assessment-collection/dto/create-collection-target.dto.ts](../../src/assessment-collection/dto/create-collection-target.dto.ts) — 같은 모듈의 Create 축 DTO. decorator 조합·주석 톤·`COLLECTION_TARGET_TYPES` 상수 재사용 여부 판단 대상
- [src/assessment-collection/dto/create-collection-target.dto.spec.ts](../../src/assessment-collection/dto/create-collection-target.dto.spec.ts) — colocated spec 의 `plainToInstance` + `validateSync` 검증 관례(본 spec 이 mirror 할 구조)
- [src/user/dto/update-service-identity.dto.ts](../../src/user/dto/update-service-identity.dto.ts) — 선행 도메인의 "전 필드 optional + 정체성 축 제외" Update DTO 선례(존재 시 mirror, 부재 시 Create DTO 관례 승계)

## Acceptance Criteria

- [ ] `src/assessment-collection/dto/update-collection-target.dto.ts` 에 `UpdateCollectionTargetDto` 신설 — 필드는 `endpoint?` · `orgs?` · `repos?` · `spaces?` · `active?` **5 개뿐**이며 `CollectionTargetUpdateInput` 과 필드명·타입이 1:1 로 일치한다.
- [ ] 정체성 축(`type` · `instanceKey`) 은 **본 DTO 의 허용 축이 아니다** — ADR `§Decision 5` PATCH 행(변경은 DELETE + POST) 근거를 주석 1 줄로 박제하고, controller-scope `ValidationPipe` 의 `forbidNonWhitelisted` 가 이를 400 으로 거부함을 명시.
- [ ] 전 필드 optional — `endpoint?` 는 `@IsOptional` · `@IsString` · `@IsNotEmpty` · `@MaxLength(255)`, `orgs?` · `repos?` · `spaces?` 는 `@IsOptional` · `@IsArray` · `@IsString({ each: true })`, `active?` 는 `@IsOptional` · `@IsBoolean`. 빈 객체 `{}` 도 valid(merge patch 의 no-field 요청 — Prisma 가 `@updatedAt` 만 갱신) 임을 주석 1 줄로 명시.
- [ ] `endpoint` 는 Create 축과 달리 "미전달 = 미변경" 이고 "전달 시에는 빈 값 불가" 라는 두 의미가 겹치는 필드임을 주석 1 줄로 구분 박제(`@IsOptional` + `@IsNotEmpty` 조합의 의도).
- [ ] 헤더 주석에 책임 경계(Out of Scope: `CollectionTargetController` · 5 route · `@UseGuards(JwtAuthGuard, RolesGuard)` · `@Roles` 배선은 ADR `§Follow-ups (c)` 후속 slice) 를 §12 한국어로 박제.
- [ ] happy-path unit test 1+ — ① 빈 객체 `{}` ② 단일 필드만(`{ active: false }`) ③ 5 필드 전량 payload 각각이 `validateSync` 결과 0 error.
- [ ] error path unit test 1+ — 전달된 필드의 값이 계약 위반일 때(예: `endpoint: ""`, `active: "false"`) error 가 발생함을 케이스별로 검증.
- [ ] 분기 cover — decorator 별 분기 각 1+ test: `@IsOptional`(미전달 시 다른 decorator 가 평가되지 않음) · `@IsNotEmpty`(빈 문자열 · 공백만) · `@MaxLength`(경계 255 자 통과 / 256 자 실패) · `@IsArray` · `@IsString({ each: true })`(원소 타입 불일치) · `@IsBoolean`.
- [ ] negative cases 충분 cover — 최소 7 종: ① `endpoint: ""` ② `endpoint: "   "`(공백만) ③ `endpoint` 256 자 초과 ④ `orgs: "acme"`(배열 아님) ⑤ `repos: [1, 2]`(원소 타입 불일치) ⑥ `spaces: null` ⑦ `active: "true"`(문자열) 각각 error 1+.
- [ ] 정체성 축 drift guard 1+ — `whitelist: true, forbidNonWhitelisted: true` 옵션으로 `validateSync` 할 때 `{ type: "GITHUB" }` · `{ instanceKey: "acme" }` payload 가 **error 를 낸다**는 것을 test 로 고정(나중에 정체성 축이 조용히 허용되면 fail). ADR `§Decision 5` 회귀 방지.
- [ ] credential 표면 drift guard 1+ — 같은 `forbidNonWhitelisted` 경로로 `token` · `password` · `apiKey` 계열 필드가 DTO 의 허용 축이 아님을 test 가 드러내도록 한다. ADR `§Decision 2` 회귀 방지.
- [ ] `pnpm lint` · `pnpm build` 통과.
- [ ] `pnpm test:cov` 통과 — line ≥ 80% AND function ≥ 80%(신규 DTO 파일 포함 전역 threshold).
- [ ] production 순증 ≤ 70 LOC(DTO 파일 1 개). 초과분은 전부 colocated spec 이어야 한다.

## Out of Scope

- `CollectionTargetController` · 5 route(GET 목록 · GET 단건 · POST · PATCH · DELETE) · `@UseGuards(JwtAuthGuard, RolesGuard)` · `@Roles("User")` / `@Roles("Admin")` 부착 — ADR `§Follow-ups (c)` 의 후속 slice(본 task 는 controller 파일 diff 0).
- `AssessmentCollectionModule` 의 `controllers` 배열 변경 — controller slice 와 같은 task 에서 처리(본 task 는 module 파일 diff 0).
- `CreateCollectionTargetDto` 수정 — T-1812 로 종결. `COLLECTION_TARGET_TYPES` 상수를 **읽기만** 하고 이동·재정의하지 않는다(필요 없으면 import 자체를 하지 않는다).
- `CollectionTargetService` · `CollectionTargetRepository` 수정 — `§Follow-ups (b)` 로 종결. 두 파일 diff 0.
- `type` 별 조건부 필수성(GITHUB 은 `orgs`, CONFLUENCE 는 `spaces`) 의 service 층 검증 — ADR `§Consequences (c)` 축이며 본 DTO 책임 아님.
- e2e 오류 계약 고정 · api.md · requirements.md doc-sync — `§Follow-ups (d)` · `(f)`.
- env 병합 배선(`§Decision 3` union + env 우선) — `§Follow-ups (g)`.
- AdminView 등록·편집 패널 — `§Follow-ups (e)`.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(비어 있음 — sub-agent 가 발견 시 append)
