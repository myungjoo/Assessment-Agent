---
id: T-1812
title: CollectionTarget 등록 API 의 Create DTO 신설
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-070, REQ-072, REQ-073]
estimatedDiff: 340
estimatedFiles: 2
created: 2026-08-30
independentStream: collection-target-registration
dependsOn: [T-1811]
touchesFiles:
  - src/assessment-collection/dto/create-collection-target.dto.ts
  - src/assessment-collection/dto/create-collection-target.dto.spec.ts
sizeExempt: true
exemptReason: 초과분 전량이 R-112 강제 colocated spec — production 순증 ≤ 100 LOC (필드 7 개). T-1739(320 LOC · 2 필드 DTO) 선례 승계.
plannerNote: ADR-0059 Follow-ups (c) 의 첫 조각 — DTO 2 종 중 Create 축만. 7 필드라 Update 축은 별도 slice.
---

# T-1812 — CollectionTarget 등록 API 의 Create DTO 신설

## Why

오너 지시 [PLAN](../PLAN.md) `130 행`(REQ-070 / REQ-072 / REQ-073) 의 수집 대상 등록 축 chain 을 잇는다. [T-1808](T-1808-collection-target-schema-migration.md) 이 `model CollectionTarget` 과 migration 을, [T-1809](T-1809-collection-target-repository.md) 가 repository CRUD 5 종을, [T-1810](T-1810-collection-target-service-read-create.md) · [T-1811](T-1811-collection-target-service-update-delete-module.md) 이 service 5 메서드 + module 배선을 박아 [ADR-0059](../decisions/ADR-0059-collection-target-registration.md) `§Follow-ups (b)` 를 종결했다. 남은 `§Follow-ups (c)` 는 "Create / Update DTO + 5 route + guard 배선" 을 한 덩어리로 묶고 있는데, `CollectionTarget` 은 필드가 7 개(`type` · `instanceKey` · `endpoint` · `orgs` · `repos` · `spaces` · `active`) 라 DTO 2 종 + controller 를 한 task 로 하면 파일 6+ · R-112 spec 포함 700 LOC 을 넘겨 [CLAUDE.md §3](../../CLAUDE.md) cap 을 확실히 초과한다. 그래서 본 slice 는 **POST 의 payload 검증 계약(Create DTO 1 종)만** 잘라 박제하고, Update DTO · controller · route · guard 는 후속 slice 로 남긴다.

## Required Reading

- [docs/decisions/ADR-0059-collection-target-registration.md](../decisions/ADR-0059-collection-target-registration.md) — `§Decision 4`(필드 표 7 종 · `type` 은 Prisma enum 격상 없이 String + DTO `@IsIn` · 다중 값은 `String[]`) · `§Decision 5`(POST 201 / 오류 표 e 행 = 검증 실패 400) · `§Decision 2`(credential 계열 필드 금지 — DB 는 `instanceKey` 참조만)
- [src/assessment-collection/collection-target.repository.ts](../../src/assessment-collection/collection-target.repository.ts) — `CollectionTargetCreateInput` 의 필드명 · 필수/선택 경계 정합 대상(`orgs` · `repos` · `spaces` · `active` 는 optional)
- [src/assessment-evaluation/dto/evaluate-activities.dto.ts](../../src/assessment-evaluation/dto/evaluate-activities.dto.ts) — `@IsIn` discriminator + 배열 필드 decorator 관례 mirror 대상
- [src/user/dto/create-service-identity.dto.ts](../../src/user/dto/create-service-identity.dto.ts) — 헤더 주석 관례(책임 경계 · ADR 근거 인용) mirror 대상
- [src/user/dto/create-service-identity.dto.spec.ts](../../src/user/dto/create-service-identity.dto.spec.ts) — colocated spec 의 `plainToInstance` + `validateSync` 검증 관례
- [src/assessment-collection/dto/collect-trigger.dto.ts](../../src/assessment-collection/dto/collect-trigger.dto.ts) — 같은 모듈 `dto/` 디렉토리의 기존 파일 배치·주석 톤

## Acceptance Criteria

- [ ] `src/assessment-collection/dto/create-collection-target.dto.ts` 에 `CreateCollectionTargetDto` 신설 — 필드는 ADR `§Decision 4` 표의 7 개(`type` · `instanceKey` · `endpoint` · `orgs?` · `repos?` · `spaces?` · `active?`) 뿐. `id` · `createdAt` · `updatedAt` 는 서버 생성 축이라 받지 않는다.
- [ ] `type` 은 `@IsIn(["GITHUB", "CONFLUENCE"])` + `@IsString` — Prisma enum 으로 격상하지 않은 근거(ADR `§Decision 4` 의 확장 축 논리) 를 주석 1 줄로 박제.
- [ ] `instanceKey` · `endpoint` 는 `@IsString` · `@IsNotEmpty` · `@MaxLength(255)`(필수 축). `instanceKey` 가 credential 참조 key 일 뿐 자격증명 값이 아니라는 `§Decision 2` 경계를 주석 1 줄로 명시.
- [ ] `orgs?` · `repos?` · `spaces?` 는 `@IsOptional` · `@IsArray` · `@IsString({ each: true })`, `active?` 는 `@IsOptional` · `@IsBoolean`. 미전달 시 DB default(빈 배열 / `true`) 로 위임됨을 주석에 1 줄.
- [ ] `type` 별 조건부 필수성(GITHUB 은 `orgs`, CONFLUENCE 는 `spaces`) 은 **본 DTO 가 강제하지 않는다** — ADR `§Consequences (c)` 가 단일 model 채택의 대가로 명시한 부분이며, 이를 헤더 주석의 Out of Scope 에 §12 한국어로 박제.
- [ ] 헤더 주석에 책임 경계(Out of Scope: Update DTO · controller · route · `@Roles` guard 배선은 `§Follow-ups (c)` 후속 slice) 를 한국어로 박제.
- [ ] happy-path unit test 1+ — 필수 3 필드만 담은 최소 payload, 7 필드 전량 payload 각각이 `validateSync` 결과 0 error 임을 검증.
- [ ] error path unit test 1+ — 필수 필드 누락(`type` · `instanceKey` · `endpoint` 각각) 이 error 를 내는 것을 케이스별로 검증.
- [ ] 분기 cover — decorator 별 분기 각 1+ test: `@IsIn`(허용 값 2 종 통과 · 미허용 값 실패) · `@IsNotEmpty`(빈 문자열) · `@MaxLength`(경계 255 자 통과 / 256 자 실패) · `@IsOptional`(선택 4 필드 미전달 시 0 error) · `@IsArray` · `@IsString({ each: true })`(원소 타입 불일치) · `@IsBoolean`.
- [ ] negative cases 충분 cover — 최소 7 종: ① `type: "GITLAB"` 등 미허용 값 ② `type` 소문자(`"github"`) 도 거절되는지 ③ `instanceKey` 공백만(`"   "`) ④ `endpoint` 256 자 초과 ⑤ `orgs: "acme"`(배열 아님) ⑥ `repos: [1, 2]`(원소 타입 불일치) ⑦ `active: "true"`(문자열) · `endpoint: null` 타입 불일치.
- [ ] 계약 drift guard 1+ — credential 계열 필드(`token` · `password` · `apiKey` 등) 와 정체성 이외 서버 생성 축(`id`)이 DTO 의 허용 축이 아님을 test 가 드러내도록 한다(나중에 조용히 추가되면 fail). `§Decision 2` 회귀 방지.
- [ ] `pnpm lint` · `pnpm build` 통과.
- [ ] `pnpm test:cov` 통과 — line ≥ 80% AND function ≥ 80%(신규 DTO 파일 포함 전역 threshold).
- [ ] production 순증 ≤ 100 LOC(DTO 파일 1 개). 초과분은 전부 colocated spec 이어야 한다.

## Out of Scope

- `UpdateCollectionTargetDto` — 정체성 축(`type` · `instanceKey`) 제외 + 5 필드 optional 계약은 후속 slice(본 task 는 update DTO 파일 diff 0).
- `CollectionTargetController` · 5 route · `@UseGuards(JwtAuthGuard, RolesGuard)` · `@Roles` 부착 — ADR `§Follow-ups (c)` 후속 slice.
- `AssessmentCollectionModule` 의 `controllers` 배열 변경 — controller slice 와 같은 task 에서 처리(본 task 는 module 파일 diff 0).
- `CollectionTargetService` · `CollectionTargetRepository` 수정 — 이미 `§Follow-ups (b)` 로 종결됨. 본 task 는 두 파일 diff 0.
- e2e · api.md · requirements.md doc-sync — `§Follow-ups (d)` · `(f)`.
- env 병합 배선(`§Decision 3` union + env 우선) — `§Follow-ups (g)`.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(비어 있음 — sub-agent 가 발견 시 append)
