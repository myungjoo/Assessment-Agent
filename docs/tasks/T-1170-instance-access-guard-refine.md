---
id: T-1170
title: 인스턴스 접근 계약 drift-guard 정밀화 (decorator 인자·optional 필드·body 진단)
phase: P6
status: DONE
mergedAs: 40b34a21
prNumber: 1062
reviewRounds: 1
commitMode: pr
coversReq: [REQ-016, REQ-044]
estimatedDiff: 55
estimatedFiles: 1
created: 2026-07-24
independentStream: web-admin-user
dependsOn: [T-1169]
touchesFiles:
  - web/src/views/AdminView.instance-access-contract.test.ts
plannerNote: P6 line120 사용자 관리 arc 13번째 slice — T-1169 Follow-ups (1)(2)(3) 을 같은 guard 파일 1개에서 묶어 정밀화 (test-only, pr)
---

# T-1170 — 인스턴스 접근 계약 drift-guard 정밀화 (decorator 인자·optional 필드·body 진단)

## Why

PLAN.md P6 line 120 (Admin 패널) 사용자 관리 arc 의 13번째 slice 이며, T-1169 가 Follow-ups 에 박제한 reviewer round 1 지적 3건 (MINOR 2 / NIT 1) 을 그대로 집행한다. 세 지적은 모두 T-1169 가 신규 추가한 **동일 파일 1개** (`web/src/views/AdminView.instance-access-contract.test.ts`) 의 계약 추출·대조 로직 결함이라, 하나의 test-only slice 로 묶어 정밀화하는 것이 자연스럽다.

현재 guard 는 세 곳에서 느슨하다: (1) `@Post(...)` decorator 의 **인자를 읽지 않아** backend 가 `@Post('grant')` 로 sub-path 를 붙이면 실 route 가 바뀌어도 green 을 유지한다(런타임 404 silent pass). (2) DTO 필드 대조가 `required` 와 `optional` 을 구분하지 않고 정렬-문자열 정확 일치를 요구해, backend 가 하위호환 optional 필드를 추가하면 web 이 유효한데도 CI 가 red 가 된다(정상 진화를 막는 오탐). (3) body 미전송 시 `JSON.parse(String(undefined))` 가 `SyntaxError` 를 던져 원인 진단이 한 단계 느려진다. 본 task 는 이 셋을 계약에 더 정확하게 고쳐, guard 가 진짜 drift 만 잡고 정상 진화는 통과시키도록 만든다. 동작 변경 0 — test 파일 1개만 수정한다.

## Required Reading

- `web/src/views/AdminView.instance-access-contract.test.ts` 전체 — T-1169 가 만든 guard spec 원본. 특히 로컬 함수 `extractHandlerMethods` / `extractDtoFields` / `toFire` (또는 그에 상응하는 이름) 의 현재 추출·대조 로직. **본 task 는 이 파일만 수정한다.**
- `src/user-instance-access/user-instance-access.controller.ts` 60~115행 — `@Controller("api/users/:id/instance-access")`, grant `@Post()`, revoke `@Delete()` + `@HttpCode(204)`. Follow-up (1) 대조를 위해 **method decorator 의 인자(예: `@Post('grant')`) 를 route 에 합성해야** 실 route shape 를 재구성할 수 있음을 확인한다(현재 decorator 는 인자 없음 → `''` 로 합성 시 base route 그대로).
- `src/user-instance-access/grant-instance-access.dto.ts` 파일 끝 `GrantInstanceAccessDto` — `@IsString() @IsNotEmpty() @MaxLength(2048) instanceRef!: string;`. `!`(required) 와 `?`(optional) 표기 구분이 Follow-up (2) 부분집합 대조의 입력이다. controller 의 `whitelist + forbidNonWhitelisted` ValidationPipe 계약도 재확인(초과 키 = 400).
- `web/src/views/AdminView.tsx` 1773~1860행 `runGrantInstanceAccess` / `runRevokeInstanceAccess` — mock deps 로 호출해 실제 발사 `init.body` 를 캡처하는 방식(Follow-up (3) 의 `options.body` 부재 매핑 대상).

## Acceptance Criteria

- [ ] **Follow-up (1) — decorator 인자 합성 대조**: method 추출기가 `@Post(...)`/`@Delete(...)`/`@Patch(...)` 의 **인자 문자열까지 파싱**해, base `@Controller` route 와 합성한 최종 route shape 를 만들어 web 발사 path 와 대조한다. 인자 없는 `@Post()` 는 base route 그대로, `@Post('grant')` 는 `.../instance-access/grant` 로 합성되어야 한다.
- [ ] **Follow-up (2) — optional 필드 구분 부분집합 대조**: DTO 필드 추출기가 `instanceRef!`(required) 와 가상의 `note?`(optional) 를 구분해 `{required, optional}` 두 집합을 반환한다. body 키 대조는 정확 일치 대신 **`fired ⊆ declared`(초과 키 없음, forbidNonWhitelisted 근거) AND `required ⊆ fired`(필수 누락 없음)** 로 완화한다.
- [ ] **Follow-up (3) — body 미전송 진단 개선**: `options.body` 가 `undefined`/부재이면 `JSON.parse(String(undefined))` 로 `SyntaxError` 를 내지 말고 **빈 키 집합** 으로 매핑해, 실패가 "body 키 불일치" 로 명확히 떨어지도록 한다.
- [ ] **Happy-path test 1+**: 현재 backend(인자 없는 decorator, `instanceRef` 단일 required 필드) 상태에서 web 발사가 정밀화된 route/method/body 대조를 모두 통과함을 검증(정밀화가 정상 케이스를 깨지 않음).
- [ ] **Error path test 1+**: 추출기가 `null`/빈 집합을 반환하는 입력(빈 소스 등)에서 대조가 조용히 통과하지 않고 선단언으로 fail 함을 유지·검증(guard 무력화 방어 — T-1169 계약 회귀 0).
- [ ] **분기 cover**: 세 정밀화 각각의 새 분기를 test 로 나눈다 — (1) decorator 인자 있음(sub-path 합성) vs 없음(base) 각 1 test, (2) 부분집합 대조의 `fired ⊄ declared`(초과) 실패분기 · `required ⊄ fired`(필수 누락) 실패분기 · optional 필드 추가 시 통과분기 각 1 test, (3) `options.body` 부재 → 빈 집합 매핑분기 1 test.
- [ ] **Negative cases 충분 cover** — 각 1+ test: (a) backend 가 `@Post('grant')` 로 sub-path 를 붙였는데 web 은 base path 그대로 발사 → 불일치로 fail(Follow-up (1) 핵심 회귀), (b) web 이 DTO 에 없는 초과 키(`instance_ref` 오타 등)를 보내면 `fired ⊆ declared` 위반으로 fail, (c) web 이 required `instanceRef` 를 누락하면 `required ⊆ fired` 위반으로 fail, (d) backend 가 하위호환 optional 필드를 추가해도 web 발사는 유효 → **통과**(오탐 제거 검증), (e) `options.body` 부재 시 `SyntaxError` 없이 "body 키 불일치"(빈 집합 ≠ required) 로 판정, (f) 주석 줄에만 `@Post(...)` 문자열이 있고 실 decorator 가 없는 가짜 소스는 method 추출 실패로 판정(T-1169 주석 false-positive 방어 유지).
- [ ] **실측 확인**: 구현자는 backend decorator 를 임시로 `@Post('grant')` 로 바꿔 정밀화된 guard 가 실제로 fail 하는 것을 1회 확인한 뒤 되돌린다(되돌림 후 green 상태로 commit).
- [ ] **기존 spec 회귀 0**: T-1169 가 추가한 15 test 중 계약상 유효한 assertion 은 하나도 삭제·약화하지 않는다(정확-일치 → 부분집합 완화는 (2) 의 의도된 변경이며, 이는 assertion 약화가 아니라 계약 정정임을 파일 주석에 한 줄 박제). `AdminView.test.tsx` / `AdminView.userlist-wiring.test.tsx` 전부 green.
- [ ] `pnpm --dir web test` (vitest) 전체 green + `pnpm --dir web build` (tsc + vite) green. 루트 `pnpm lint` clean.
- [ ] `pnpm test:cov` 기준선 유지 — 본 task 는 `src/` 를 건드리지 않으므로 backend coverage (line ≥ 80% / function ≥ 80%) 가 그대로 통과해야 한다.
- [ ] **사이즈 게이트** — 최종 diff ≤ 300 LOC / 파일 1개. 초과 예상 시 negative case 를 `it.each` 표로 합치고 추출기 주석을 선례 참조 한 줄로 압축한다. **test 항목 자체를 빼서 줄이지 말 것**(R-112 위반).

## Out of Scope

- `web/src/views/AdminView.tsx` · `src/user-instance-access/**` 등 **production 소스 수정 전면 금지** — 본 slice 는 test-only 다. 대조 결과 실제 drift 가 발견되면 고치지 말고 Follow-ups 에 적는다.
- 공용 계약 추출 helper 파일 신설(`web/src/test-utils/*` 등) — 재사용처가 여전히 1곳뿐이라 로컬 함수로 둔다(YAGNI). T-1169 Out of Scope 그대로.
- backend 소스 파싱용 AST 파서·새 devDependency 도입 — 문자열/정규식으로 충분(§5 게이트 대상).
- 다른 endpoint(사용자 생성/역할 변경/그룹/인원/LLM provider)로 계약 guard 확산 — 패턴 안정 후 별도 slice.
- 응답 status code(201/204/409/404) 대조 · OpenAPI 스키마 공유 구조 · jsdom/RTL 도입 — ADR-0040 §5 harness 경계 그대로.
- `web/package.json` vitest coverage threshold 도입 — 새 외부 dependency(`@vitest/coverage-v8`) PLAN P6 게이트 backlog.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(작성 시 비어 있음. sub-agent 가 관련 작업 발견 시 여기에 추가.)
