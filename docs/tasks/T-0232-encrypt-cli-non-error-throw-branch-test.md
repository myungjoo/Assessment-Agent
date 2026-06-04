---
id: T-0232
title: encrypt-token-cli 비-Error throw 분기 negative-case test 강화
phase: P4
status: PENDING
commitMode: pr
coversReq: [REQ-112]
estimatedDiff: 30
estimatedFiles: 1
created: 2026-06-04
plannerNote: P4 test-quality audit P1 — encrypt-cli L113 :String(error) 비-Error throw 분기(branch 91.66) security-negative gap 박제
---

# T-0232 — encrypt-token-cli 비-Error throw 분기 negative-case test 강화

## Why

T-0231 감사 보고서([docs/progress/test-quality-coverage-audit-2026-06.md](../progress/test-quality-coverage-audit-2026-06.md) §2(a)·§4 P1)가 식별한 최우선(P1) coverage gap 을 닫는다. `src/llm/encrypt-token-cli.ts:113` 의 `const message = error instanceof Error ? error.message : String(error);` 에서 **`: String(error)` 분기(비-Error 값이 throw 됐을 때)** 가 어떤 test 로도 실행되지 않아 branch coverage 가 91.66% 에 머문다. 기존 error-path test(spec L264·L281)는 전부 cipher 가 `Error` 인스턴스를 throw 하는 경로만 검증한다. 이 분기는 secret 암호화 CLI 의 error 진단 경로 — 평문 누출 invariant(CLAUDE.md §9 / ADR-0014 never-read-back)가 걸린 보안 코드라, 방어 분기가 미검증이면 회귀 시 평문 누출 회귀를 못 잡는다. README 112행(R-112 negative case — type mismatch / 비정상 throw) 충족이 본 task 의 근거다.

issue-still-relevant 확인 완료: main 의 `encrypt-token-cli.ts:113` 비-Error throw 분기는 spec 어디에서도 실행되지 않음(error-path test 전부 Error 인스턴스 throw). production 코드는 이미 `String(error)` 로 올바르게 방어 중이므로 **production 변경 없음 — test-only**.

## Required Reading

- `docs/progress/test-quality-coverage-audit-2026-06.md` (§2(a) L40 + §4 P1 L85~90 — gap 정의·검증할 invariant)
- `src/llm/encrypt-token-cli.ts` (L93~117 `runEncryptTokenCli` 의 try/catch + L113 대상 분기)
- `src/llm/encrypt-token-cli.spec.ts` (colocated spec — 기존 `makeIo` 헬퍼 L59~72, error-path test L264·L281, §9 미노출 assert 패턴. 본 task 의 새 test 는 여기 colocated 로 추가)
- `src/llm/llm-apikey-cipher.service.ts` (LlmApiKeyCipher 타입 — stub cipher 가 만족할 인터페이스 확인용. 새로 mock 할 `encrypt` 시그니처)

## Acceptance Criteria

- [ ] `src/llm/encrypt-token-cli.spec.ts` 의 `runEncryptTokenCli` describe 블록에 **비-Error throw negative test 1+** 추가: `io.cipher.encrypt` 가 **비-Error 값**(최소 string 1종; object/`{}` 등 2종이면 더 충분)을 throw 하도록 stub cipher 를 주입(`makeIo({ cipher: <stub>, ... })`)해 `encrypt-token-cli.ts:113` 의 `: String(error)` 분기를 실제로 실행한다.
- [ ] 그 test 는 단순 실행이 아니라 **실 assertion 으로 분기 효과를 검증**한다: (a) `runEncryptTokenCli` 반환값 == 1(비0 exit), (b) stdout 비어있음(`out` length 0 — ciphertext 미출력), (c) stderr 진단에 `String(error)` 결과 문자열(예: throw 한 string 값 또는 object 의 `String()` 표현)이 포함됨, (d) §9 보안 invariant — stderr·stdout 어디에도 평문 토큰이 등장하지 않음(`not.toContain(plaintext)`).
- [ ] (branch) 본 분기의 두 갈래가 모두 cover 됨을 보장: `error instanceof Error` 갈래는 기존 test(L264·L281)가, `: String(error)` 갈래는 본 task 의 새 test 가 담당 — describe/it 문자열에 "비-Error throw" 를 명시해 의도를 외화.
- [ ] (negative 충분 cover) 비-Error throw 의 대표 type 을 1종 초과로 cover(예: string + object) — 단일 negative 만으로 끝내지 않는다(R-112). type 1종만으로 분기를 닫더라도 의미상 negative variety 를 추가해 회귀 방어 폭을 넓힌다.
- [ ] `pnpm lint && pnpm build && pnpm test` 통과.
- [ ] `pnpm test:cov` 통과(line ≥ 80% / function ≥ 80%) AND `src/llm/encrypt-token-cli.ts` 의 **% Branch 가 91.66 → 100** 으로 상승함을 jest coverage summary 로 확인.

## Out of Scope

- production 코드 변경 — `encrypt-token-cli.ts` 는 이미 `String(error)` 로 올바르게 방어 중이므로 손대지 않는다(test-only task). 만약 구현 중 실제 결함이 보이면 즉시 고치지 말고 Follow-ups 에 적는다.
- P2(`difficulty-mapping.service.ts` non-Prisma error 분기)·P3(`auth.module.ts` JWT secret fallback helper 분리)·P4(branch threshold floor 상향)·P5(mutation testing) — 본 task 범위 밖. 아래 Follow-ups 참조.
- `coverageThreshold`(package.json) 수정 — 정책 변경이라 별도 task/ADR(audit P4).
- 기존 통과 중인 다른 spec 의 리팩터/정리.

## Suggested Sub-agents

`tester → implementer` 순이 자연스러우나(test-only), 표준은 `implementer → tester` — implementer 가 새 spec test 작성, tester 가 R-112 충분성 + coverage 상승(branch 100) 검증.

## Follow-ups

- P2 (audit §4) — `src/llm/difficulty-mapping.service.ts:50` `getPrismaErrorCode` 의 non-Prisma error 분기(`return undefined`) test 강화. `difficulty-mapping.service.spec.ts` 에서 `code` 필드 없는 error/비-객체 throw mock → line 96.87 → 100. ~1~2 test, ≤30 LOC, pr-mode, test-only.
- P3 (audit §4) — `src/auth/auth.module.ts:63` `process.env.AUTH_JWT_SECRET ?? ""` 를 `resolveJwtSecret(env): string` helper(신규 `src/auth/resolve-jwt-secret.ts` + colocated spec)로 분리해 coverage 측정 대상화(`coveragePathIgnorePatterns` blind-spot 해소). prod 소량 변경 동반(module edit ~3 LOC + helper ~15 LOC + spec ~30 LOC, ≤3 파일), pr-mode + reviewer 필수. `coveragePathIgnorePatterns` 자체 수정은 금지.
- P4 (정책, ADR/§5) — `coverageThreshold.global` 의 branch/statements floor(현 50)를 90 등으로 상향 검토. CI 정책 변경 = pr-mode + false-positive 검토 동반, 별도 task/ADR.
- P5 (후보, §5 BLOCKED) — mutation testing(Stryker 등) 도입 검토. 새 dependency = §5 게이트 + 별도 ADR.
