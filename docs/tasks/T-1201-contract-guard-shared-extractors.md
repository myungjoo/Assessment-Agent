---
id: T-1201
title: contract-guard 공용 정규식 추출기(stripComments/extractControllerRoute/extractHandlerMethods/extractHandlerParams/composeRoute/stripQuery 등) 를 web/src/views/__contract-guard__/ 공용 helper 모듈로 추출 + 콜로케이트 단위 test (refactor split slice 1 — 소비 spec 미이관, helper 신설·자체 test 만)
phase: P6
status: DONE
mergedAs: 8abaf0d3
prNumber: 1093
reviewRounds: 1
completedAt: 2026-07-24T22:51:38Z
commitMode: pr
coversReq: [REQ-060]
estimatedDiff: 240
estimatedFiles: 2
created: 2026-07-25
independentStream: web-contract-guard
dependsOn: []
touchesFiles: [web/src/views/__contract-guard__/contract-extractors.ts, web/src/views/__contract-guard__/contract-extractors.test.ts]
plannerNote: "P6 contract-guard arc — GET read 표면 전량 봉합(T-1190~T-1200) 후 T-1200 Follow-up 이 지목한 공용 helper 추출 refactor 의 split slice 1. 30+ spec 이 중복 복사한 invariant 정규식 추출기만 신설 모듈+자체 test 로 고정(소비 spec 이관은 후속 slice). 신규 __contract-guard__/ 디렉토리라 AdminView.tsx·기존 spec 전부 파일-disjoint → 동시 claim 안전, dependsOn 없음."
---

# T-1201 — contract-guard 공용 정규식 추출기 helper 모듈 추출 (refactor split slice 1)

## Why

P6 web↔backend contract-guard arc 가 AdminView 의 `useApiResource` GET read 발사 전량(groups/persons/parts/users/schedules/group-members/llm-providers/difficulty-mappings/part-persons/auth-me — T-1190~T-1200)과 mutation 발사 다수를 test-only drift-guard 로 봉합 완료했다. 그 결과 30+ 개 contract-guard spec 이 **동일한 정규식 추출기 블록**(`stripComments`, `extractControllerRoute`, `extractHandlerMethods`, `extractHandlerParams`, `normalizeRoute`, `composeRoute`, `pathSegments`, `stripQuery`)을 각 파일마다 복사해 들고 있다(예: `AdminView.schedules-list-contract.test.ts` L15~99, `AdminView.persons-list-contract.test.ts` 등 동형). T-1200 의 Follow-up 이 "GET read 표면 전량 덮인 시점이라 추출 ROI 재평가 적기"로 이 중복 제거 refactor 를 지목했다(REQ-060 unit test 유지보수성).

본 task 는 그 refactor 의 **split slice 1** — 여러 spec 에서 **글자 그대로 동일한(per-spec 변형 없는) invariant 추출기만** `web/src/views/__contract-guard__/contract-extractors.ts` 공용 모듈로 신설하고, 그 모듈에 대한 **포괄 colocated 단위 test** 를 붙인다. **기존 spec 의 이관(inline → import 교체)은 본 slice 범위 밖** — 후속 slice 들이 각 spec 을 하나씩 이관한다(각 이관은 파일-disjoint 소diff). 본 slice 를 먼저 두는 이유: (1) 공용 추출기의 정확성을 단일 지점에서 철저히 test 로 고정한 뒤 이관해야 회귀 위험이 낮고, (2) 신규 디렉토리라 진행 중인 어떤 spec 과도 파일-disjoint 라 stage 5b 동시 claim 에 안전하다.

## Required Reading

- `web/src/views/AdminView.schedules-list-contract.test.ts` — **추출 원본 참조**(L15~99). 옮길 invariant 추출기의 정확한 시그니처·본문: `stripComments`(L15~21, 블록/줄 주석 제거), `extractControllerRoute`(L22~25, `@Controller("...")` base 추출, 부재 null), `HandlerDecorator` 인터페이스(L26~29) + `extractHandlerMethods`(L30~49, handler→{method,subPath} 매핑, 비-HTTP decorator 무시), `extractHandlerParams`(L52~68, 균형 괄호 매칭으로 handler 서명 슬라이스, 부재 null), `normalizeRoute`(L93), `composeRoute`(L94~97, base+subPath 합성), `pathSegments`(L98), `stripQuery`(L99, `?_r` cache-buster strip). 이 8종이 이관 대상. **`extractSchedulesFireMethod`(L73~80)·`BackendContract`/`WebFire` 타입(L81~92)·`diffContract`(L103~118) 는 per-spec 변형이 있어 이관 대상 아님 — 각 spec inline 유지.**
- `web/src/views/AdminView.persons-list-contract.test.ts` — **동형 대조**. 위 8종 추출기가 이 spec 에서도 글자 그대로 동일한지 대조(invariant 확인 — 변형이 있으면 그 함수는 이관에서 제외하고 Follow-up 에 남긴다).
- `web/vitest.config.ts`(또는 web workspace vitest 설정) — 신규 `web/src/views/__contract-guard__/*.ts` 가 coverage 대상에 포함되는지 + 제외 패턴 확인(read-only, 수정 없음). 신규 non-test `.ts` 는 colocated `.test.ts` 로 coverage 충족.

## Acceptance Criteria

신규 파일 **정확히 2개**만 추가한다 — 기존 spec 은 건드리지 않는다.

- [ ] `web/src/views/__contract-guard__/contract-extractors.ts` 신설 — 위 8종 invariant 추출기(`stripComments`, `extractControllerRoute`, `HandlerDecorator` 타입, `extractHandlerMethods`, `extractHandlerParams`, `normalizeRoute`, `composeRoute`, `pathSegments`, `stripQuery`)를 `export` 로 노출. 본문은 `AdminView.schedules-list-contract.test.ts` 원본과 **의미 동일**(정규식·괄호매칭 로직 무변형 — 옮기기만).
- [ ] `web/src/views/__contract-guard__/contract-extractors.test.ts` 신설(colocated) — 아래 R-112 4종 + negative 를 합성 입력으로 모두 cover.
- [ ] **happy-path**: 각 export 함수의 정상 동작 1+ — `extractControllerRoute('@Controller("api/x")...')` → `'api/x'`; `extractHandlerMethods` 가 `@Get("me")` 핸들러를 `{method:'GET', subPath:'me'}` 로 매핑; `extractHandlerParams(src,'foo')` 가 `@Body`/`@Param` 서명 슬라이스 반환; `composeRoute('api/x','me')` → `/api/x/me`, `composeRoute('api/x','')` → `/api/x`; `stripQuery('/p?_r=3')` → `/p`; `pathSegments('/a/b')` → `['a','b']`.
- [ ] **error path**: 각 추출 함수의 부재/빈 입력 처리 1+ — `extractControllerRoute('')` → `null`, `extractHandlerMethods('')` → `{}`, `extractHandlerParams('', 'foo')` → `null`, `extractHandlerParams(src, '없는핸들러')` → `null`. 빈 입력이 falsy 통과로 오인되지 않음.
- [ ] **flow / 분기 cover**: 분기 있는 함수의 각 분기 1+ — `composeRoute` 의 subPath 유(有)/무(無) 두 분기; `normalizeRoute` 의 leading-slash 유/무 두 분기; `extractHandlerMethods` 의 (HTTP decorator 매칭 / 비-HTTP decorator(`@UseGuards`/`@HttpCode`) skip / handler 라인 매칭) 분기; `extractHandlerParams` 의 균형 괄호 depth 매칭(중첩 괄호 포함 서명)·미종결 시 null 분기.
- [ ] **negative 충분 cover** — 각 예외 상황 1+:
  - (a) 주석 false-positive: 주석 줄의 `@Controller(...)`/`@Get(...)`/`@Post(...)` 문자열을 실 decorator 로 오인하지 않음(`stripComments` 후 추출 — 블록 주석 `/* */` + 줄 주석 `//` 둘 다).
  - (b) 비-HTTP decorator 혼동: `@UseGuards`/`@Roles`/`@HttpCode` 를 handler method 로 오인하지 않음(`extractHandlerMethods` 가 skip).
  - (c) 형제 method 판별: 같은 base 위 `@Get("me")` 와 `@Post("login")` 형제를 method+subPath 로 구분 매핑.
  - (d) 균형 괄호: `@Param("id") id: string, @Body() dto: T<{a:1}>` 처럼 서명 안 중첩 괄호/제네릭이 있어도 `extractHandlerParams` 가 handler 닫는 괄호까지 정확 슬라이스(조기 종료 안 함).
  - (e) query strip 경계: `stripQuery('/p')`(query 없음) → `/p` 그대로, `stripQuery('/p?a=1&b=2')` → `/p`.
- [ ] `pnpm --dir web test`(web workspace vitest) 실측 통과 — 위 모든 케이스 green.
- [ ] `pnpm test:cov` 통과(line ≥ 80% / function ≥ 80%) — 신규 `contract-extractors.ts` 가 colocated test 로 8종 함수 전부 커버, coverageThreshold 무회귀 확인.
- [ ] size gate: diff ≤ 300 LOC, 변경 파일 정확히 2개(신규 2, 수정 0).

## Out of Scope

- **기존 contract-guard spec 30+ 파일의 이관(inline 추출기 → 신규 helper import 교체) 금지** — 본 slice 는 helper 신설·자체 test 만. 각 spec 이관은 후속 split slice(파일당 소diff, 파일-disjoint). 본 slice 에서 spec 을 하나라도 수정하면 5-파일 cap·파일-disjoint 위반 + 회귀 표면 확대.
- `diffContract`·`BackendContract`/`WebFire` 타입·per-endpoint 발사기 추출기(`extract*FireMethod`) 이관 금지 — per-spec 변형이 있어 공용화 대상 아님(각 spec inline 유지). 옮기려 하지 말 것.
- production 코드(`AdminView.tsx`, backend controller, `useApiResource.ts`) 수정 금지.
- 신규 devDependency 추가 금지 — 기존 vitest·node:fs 만.
- vitest 설정(`vitest.config.ts`) 수정 금지 — 신규 파일이 기존 coverage/spec-presence 규칙으로 자동 수용되는지 확인만(수정 필요가 드러나면 Follow-up 에 남기고 본 slice 는 설정 무변경으로 green 확인).

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

- (split 후속) 신규 `contract-extractors.ts` 를 소비하도록 기존 contract-guard spec 을 하나씩 이관하는 slice 들 — 각 spec 의 inline 8종 추출기 삭제 + `import { ... } from './__contract-guard__/contract-extractors'` 교체. 파일당 소diff, 서로 파일-disjoint 라 stage 5b 병렬 claim 적합. 이관 순서는 최근/단순 read spec(schedules-list, persons-list)부터.
- (미해결 drift — 사람 확인 필요) **export 계약 실 drift**: web `runExport` 가 `GET /api/admin/export?scope=...`(bare-base GET, 파일 blob 다운로드 기대, AdminView L177/889)를 발사하나 backend `@Controller("api/admin/export")`(`src/export/export.controller.ts` L138)에는 **bare `@Get()` 라우트가 없다**(`@Post()` createJob · `@Get("running")` · `@Get(":id/download")` · `@Get(":id/status-view")` · `@Get(":id")` — job 기반). 즉 web 이 존재하지 않는 endpoint 를 호출 → 404 가능성. drift-guard 는 계약 일치를 가정하므로 이 실 drift 위에는 만들 수 없음 — web 이 잘못됐는지(job 기반 POST→download 로 바꿔야) backend 가 미완인지 **오너 도메인 결정 필요**(humanQuestion 후보).
- (미해결 drift — 사람 확인 필요) **import 계약 실 drift**: web `runImport` 가 `POST /api/admin/import` 에 multipart `FormData(file)` 를 발사(AdminView L299/986)하나 backend `@Post()` create(`src/import/import.controller.ts` L109)는 `@Body() CreateImportDto`(JSON `{mode}`) 를 기대 — `@UploadedFile`/`FileInterceptor` 없음. body 형식 drift 가능성 → 도메인 확인 후 slice.
- (후보) `DELETE /api/schedules/:name`(remove) 계약 guard — AdminView 에 remove 발사 UI 미확인(web 발사 없음)이라 현재 대조 대상 아님. web UI 추가 시 slice.
