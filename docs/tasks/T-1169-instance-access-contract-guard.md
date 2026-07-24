---
id: T-1169
title: 인스턴스 접근 web↔backend 계약 drift-guard spec 추가
phase: P6
status: DONE
commitMode: pr
coversReq: [REQ-016, REQ-044]
estimatedDiff: 190
estimatedFiles: 1
created: 2026-07-24
completedAt: 2026-07-24T04:24:30Z
prNumber: 1061
independentStream: web-admin-user
dependsOn: [T-1168]
touchesFiles:
  - web/src/views/AdminView.instance-access-contract.test.ts
plannerNote: P6 line120 사용자 관리 arc 12번째 slice — T-1168 Follow-ups 의 web↔backend 계약 drift-guard 집행 (test-only 1파일)
---

# T-1169 — 인스턴스 접근 web↔backend 계약 drift-guard spec 추가

## Why

PLAN.md P6 line 120 (Admin 패널) 사용자 관리 arc 의 12번째 slice 이며, T-1168 이 Follow-ups 에 박제한 후보 (2) 를 그대로 집행한다. T-1166/T-1167 이 배선한 인스턴스 접근 부여·회수 러너는 backend 계약을 **web 쪽에 하드코딩** 하고 있다 — path shape (`/api/users/:id/instance-access`), method (`POST` / `DELETE`), request body 필드명 (`instanceRef`) 셋 다 web 소스의 문자열 리터럴이다. 현재 web test 는 그 리터럴이 **자기 자신과** 일치하는지만 확인하므로, backend 가 route 를 바꾸거나 DTO 필드를 rename 하면 web test 는 전부 green 인 채로 런타임 404 / 400 이 된다.

본 task 는 backend 소스(`user-instance-access.controller.ts` 의 decorator, `grant-instance-access.dto.ts` 의 필드)에서 계약을 **추출** 해, web 러너가 실제로 발사하는 URL·method·body 키 집합과 대조하는 guard spec 1개를 추가한다. 동작 변경 0 — 신규 test 파일 1개만 추가하는 test-only slice 다.

## Required Reading

- `src/user-instance-access/user-instance-access.controller.ts` 60~115행 — `@Controller("api/users/:id/instance-access")` (63행 부근), grant 의 `@Post()`, revoke 의 `@Delete()` + `@HttpCode(204)`, 양쪽 `@Body() dto: GrantInstanceAccessDto`. **주의: 이 파일의 주석 블록에도 `POST /api/users/:id/instance-access` / `DELETE ...` 문자열이 그대로 들어 있다** — 추출 정규식이 주석을 잡으면 guard 가 무의미해진다(아래 negative case (e)).
- `src/user-instance-access/grant-instance-access.dto.ts` 파일 끝 `GrantInstanceAccessDto` 클래스 — `@IsString() @IsNotEmpty() @MaxLength(2048) instanceRef!: string;`. grant/revoke 가 **같은 DTO 를 공유** 하는 것이 ADR-0027 §2 계약이며, controller 의 `whitelist + forbidNonWhitelisted` ValidationPipe 때문에 **DTO 필드 집합 밖의 키를 web 이 보내면 400** 이 된다.
- `web/src/views/AdminView.tsx` 106행 `USERS_PATH = '/api/users'` + 1722~1724행 `buildInstanceAccessPath` — web 이 조립하는 path.
- `web/src/views/AdminView.tsx` 1773~1820행 `runGrantInstanceAccess` — `deps.grant(path, { method: 'POST', headers, body: JSON.stringify({ instanceRef: trimmedRef }) })` 발사 형태.
- `web/src/views/AdminView.tsx` 1822~1860행 `runRevokeInstanceAccess` — `deps.revoke(path, { method: 'DELETE', ... })` 발사 형태(body 는 grant 와 동일 shape).
- `web/src/views/AdminView.tsx` 4750~4800행 test-only `export { ... }` 목록 — `buildInstanceAccessPath` · `runGrantInstanceAccess` · `runRevokeInstanceAccess` 가 이미 export 돼 있다(**본 task 는 이 목록을 수정하지 않는다**).
- `web/src/views/AdminView.test.tsx` 9371~9400행 `describe('AdminView — 인스턴스 접근 폼 비활성 배선 drift guard (T-1168)')` — `readFileSync(new URL('./AdminView.tsx', import.meta.url), 'utf8')` 로 소스를 읽어 단언하는 drift guard convention 원본.
- `web/src/views/AdminView.test.tsx` 9150행~ `describe('... T-1167 runRevokeInstanceAccess ...')` 의 `makeDeps` harness — 러너를 mock deps 로 직접 호출해 인자를 캡처하는 방식. 본 spec 도 같은 방식으로 실제 발사 인자를 얻는다(ADR-0040 §5 — RTL 없음).
- `web/src/views/AdminView.userlist-wiring.test.tsx` 1~25행 — `AdminView.test.tsx` 와 **별도 spec 파일** 을 두는 선례와 그 이유 주석 톤(파일 상단에 "왜 별도 파일인가" 를 한국어로 박제).

## Acceptance Criteria

- [ ] 신규 파일 `web/src/views/AdminView.instance-access-contract.test.ts` 1개만 추가한다(JSX 불요 → `.ts`). 기존 파일은 **한 줄도 수정하지 않는다**.
- [ ] 파일 상단에 한국어 주석으로 (a) 왜 별도 spec 파일인가(교차 패키지 소스 읽기라는 새 패턴을 한곳에 격리), (b) 이 guard 가 막는 결함(backend route/DTO 변경 시 web test 는 green 인 채 런타임 404/400) 을 박제한다.
- [ ] backend 계약 추출 — `readFileSync(new URL('../../../src/user-instance-access/user-instance-access.controller.ts', import.meta.url), 'utf8')` 와 동일 방식의 DTO 소스 읽기로 (1) `@Controller("...")` 인자 route, (2) grant/revoke 의 HTTP method decorator, (3) `GrantInstanceAccessDto` 의 필드명 집합을 문자열에서 뽑는다. 추출 로직은 **본 spec 파일 안의 로컬 함수** 로 둔다(공용 helper 파일 신설 금지).
- [ ] happy-path test 1+ — 현재 상태에서 web 이 발사하는 값이 backend 추출 계약과 일치한다: `buildInstanceAccessPath('u-1')` 결과가 backend route 의 `:id` 자리에 사용자 id 를 넣은 형태와 같고(선행 `/` 유무 차이만 정규화 허용), grant 발사 method 가 backend grant decorator 와, revoke 발사 method 가 backend revoke decorator 와 같다.
- [ ] error path test 1+ — **추출 실패를 조용히 통과시키지 않는다**: route / method / DTO 필드 추출 결과가 `null` 이거나 빈 집합이면 그 자체로 fail 하는 선단언을 둔다(추출기가 깨지면 guard 가 무력화되는 것을 막는 방어).
- [ ] 분기 cover — grant 방향(POST)과 revoke 방향(DELETE) 을 **각각 독립 test** 로 검증한다. 두 방향이 같은 path·같은 body shape 를 쓴다는 것도 1 test 로 못박는다(ADR-0027 §2 단일 DTO 공유).
- [ ] body 키 집합 일치 test 1+ — 러너를 mock deps 로 실제 호출해 `JSON.parse(init.body)` 의 키 집합을 얻고, 그것이 backend DTO 필드 집합과 **정확히 같음**(부족도 초과도 없음)을 단언한다. 근거: controller ValidationPipe 의 `forbidNonWhitelisted` 로 초과 키는 400.
- [ ] negative cases 충분 cover — 각 1+ test: (a) web 의 필드명을 `instance_ref` 로 바꾼 가짜 body 는 DTO 필드 집합 대조에서 fail 함을 추출기 함수 단위로 확인, (b) backend route 문자열이 달라진 가짜 소스 입력에 대해 대조 함수가 불일치를 보고함, (c) method 가 뒤바뀐(POST↔DELETE) 가짜 입력이 불일치로 판정됨, (d) 사용자 id 에 `/` · 공백 등 escape 대상 문자가 들어가도 web path 가 `encodeURIComponent` 로 안전하게 조립됨(경로 주입 방어), (e) **주석 false-positive 방지** — 주석 줄에만 `POST /api/users/:id/instance-access` 가 있고 decorator 가 없는 가짜 소스를 넣으면 method 추출이 실패(=fail 판정)함, (f) 빈 문자열 소스 입력 시 추출기가 `null`/빈 집합을 반환하고 대조가 통과하지 않음.
- [ ] 실측 확인 — 구현자는 web 러너의 `instanceRef` 리터럴을 1회 임시로 바꿔 본 guard 가 실제로 fail 하는 것을 확인한 뒤 되돌린다(되돌림 후 green 인 상태로 commit).
- [ ] 기존 spec 회귀 0 — `AdminView.test.tsx` / `AdminView.userlist-wiring.test.tsx` 의 assertion 을 하나도 삭제·약화하지 않고 전부 green.
- [ ] `pnpm --dir web test` (vitest) 전체 green + `pnpm --dir web build` (tsc + vite) green. 루트 `pnpm lint` clean.
- [ ] `pnpm test:cov` 기준선 유지 — 본 task 는 `src/` 를 건드리지 않으므로 backend coverage (line ≥ 80% / function ≥ 80%) 가 그대로 통과해야 한다.
- [ ] 사이즈 게이트 — 최종 diff ≤ 300 LOC / 파일 1개. 초과 예상 시 추출기 주석을 선례 참조 한 줄로 압축하고 negative case 를 `it.each` 표로 합친다. **test 항목 자체를 빼서 줄이지 말 것** (R-112 위반).

## Out of Scope

- `web/src/views/AdminView.tsx` · `src/user-instance-access/**` 등 **production 소스 수정 전면 금지** — 본 slice 는 test-only 다. 대조 결과 실제 drift 가 발견되면 고치지 말고 Follow-ups 에 적는다.
- 다른 endpoint (사용자 생성 / 역할 변경 / 그룹 / 인원 / LLM provider) 로 계약 guard 확산 — 패턴이 자리잡은 뒤 별도 slice.
- 공용 계약 추출 helper 파일 신설 (`web/src/test-utils/*` 등) — 재사용처가 1곳뿐이라 지금은 로컬 함수로 둔다(YAGNI). 2번째 사용처가 생기면 그때 추출.
- backend 소스를 파싱하기 위한 AST 파서 · 새 devDependency 도입 — 문자열/정규식으로 충분하며 새 외부 dependency 는 CLAUDE.md §5 게이트 대상.
- OpenAPI/스키마 생성으로 계약을 공유하는 구조적 해결 — 훨씬 큰 설계 변경(ADR 필요).
- 응답 status code (201 / 204 / 409 / 404) 대조 — 러너가 body/status 를 읽지 않는 현 계약(T-1166/T-1167)이라 대조 대상이 없다.
- jsdom / RTL 도입 — ADR-0040 §5 harness 경계 그대로.
- `web/package.json` 의 vitest coverage threshold 도입 — `@vitest/coverage-v8` 새 외부 dependency (PLAN P6 게이트된 backlog).
- backend (`src/`) · prisma schema · `deploy/daily-test.sh` · smoke drift-guard spec (T-0791/T-0944/T-0947) · `docs/architecture/*` 수정.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

- **(1) handler decorator 인자를 route 에 합성해 대조** (reviewer round 1 MINOR 1) — `extractHandlerMethods` 가 `@Post(...)` 의 **인자를 읽지 않아**, backend 가 `@Post()` → `@Post('grant')` 로 바꿔 실제 route 가 `/api/users/:id/instance-access/grant` 가 되어도 guard 가 green 을 유지한다(런타임 404 silent pass). ~10 LOC 수정이나 본 PR 이 298/300 LOC 라 cap 초과로 이월.
- **(2) DTO optional 필드 구분해 부분집합 대조로 완화** (reviewer round 1 MINOR 2) — `extractDtoFields` 가 `instanceRef!` 와 `note?` 를 구분하지 않고 정렬 문자열 정확 일치를 요구해, backend 가 하위호환 optional 필드를 추가하면 web 이 유효한데도 CI 가 red 가 된다(정상 진화를 막는 오탐). `fired ⊆ declared` + `required ⊆ fired` 로 완화가 계약에 더 정확.
- **(3) body 미전송 시 진단 메시지 개선** (reviewer round 1 NIT 1) — `toFire` 가 `JSON.parse(String(undefined))` 로 `SyntaxError` 를 내 원인 파악이 한 단계 느려진다. `options.body` 부재를 빈 키 집합으로 매핑하면 "body 키 불일치" 로 떨어져 진단이 명확해진다. cap 여유 2 LOC 라 in-PR nit-closure 불가로 이월.

## 결과 요약

PR [#1061](https://github.com/myungjoo/Assessment-Agent/pull/1061) squash 머지 (`fd136ead`, 2026-07-24T04:24:30Z). web↔backend 인스턴스 접근 계약 drift-guard spec 1 파일 신규 (+298 LOC, test-only, production 변경 0). 신규 15 test — happy 3 · error path 1 · grant/revoke 분기 각 1 · body 키 집합 2 · negative 6종 8. web 1197/1197 · backend 11363/11363 green, method·필드명 drift 주입 실측으로 9 fail 확인 후 되돌림. reviewer round 1 APPROVE (BLOCKER 0 / MAJOR 0 / MINOR 2 / NIT 1 — 전부 cap 사유로 위 Follow-ups 이월), 4-게이트 모두 PASS.
