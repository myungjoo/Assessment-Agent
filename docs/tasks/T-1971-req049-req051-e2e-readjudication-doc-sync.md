---
id: T-1971
title: REQ-049 · REQ-051 상태 칸에 LLM provider config 구현 · unit · e2e 좌표 박제
phase: P5
status: DONE
commitMode: direct
coversReq: [REQ-049, REQ-051]
estimatedDiff: 14
estimatedFiles: 2
created: 2026-09-08
independentStream: docs-requirements-readjudication
dependsOn: [T-1967, T-1970]
touchesFiles: [docs/requirements.md, docs/tasks/T-1971-req049-req051-e2e-readjudication-doc-sync.md]
plannerNote: P5 · PLAN 183 행 once-rule — T-1967+T-1970 e2e arc 머지로 REQ-049(검증=e2e) 근거 공백이 열림, REQ 당 1 회 좌표 박제
---

# T-1971 — REQ-049 · REQ-051 상태 칸에 LLM provider config 구현 · unit · e2e 좌표 박제

## Why

[docs/PLAN.md](../PLAN.md) `183 행` 오너 지시("REQ 재판정 왕복 제거 — 구현 후 1 회만") 와 [CLAUDE.md](../../CLAUDE.md) §3.1 규칙 6 에 따라, REQ 상태 칸 재판정은 **그 REQ 를 구현하는 slice 가 머지된 뒤 REQ 당 1 회** 만 한다. LLM provider config REST 의 e2e arc 인 T-1967(목록, PR #1543 → main `b2a6ce5d`) + T-1970(`:id` 조회 · 삭제, PR #1545 → main `5e05de31`) 이 모두 머지돼 그 1 회 시점이 지금 열렸다.

현재 [docs/requirements.md](../requirements.md) `68 행` REQ-049 는 검증 방법을 `e2e` 로 **선언만 하고** 상태 칸에 파일 좌표가 0 개이며(`grep -c "llm-provider-configs.e2e-spec" docs/requirements.md` = 0), `70 행` REQ-051 도 "adapter·gateway 배선" 이라는 서술만 있고 좌표가 없다. 이 task 는 두 행의 상태 칸에 **구현 축 · unit 축 · e2e 축 좌표 + 한계** 를 실측으로 1 회 박제해 근거 공백을 닫는다. 코드 변경은 0 이다.

## Required Reading

- [docs/requirements.md](../requirements.md) `68 행` (REQ-049 행 — 검증 방법 칸 `e2e`, 상태 칸이 수정 대상) · `70 행` (REQ-051 행 — 검증 방법 칸 `unit`, 상태 칸이 수정 대상)
- [docs/requirements.md](../requirements.md) `58~60 행` (REQ-039 · REQ-040 · REQ-041 — 직전 T-1969 · T-1964 가 박제한 좌표 서술 형식의 본보기. 같은 문체 · 같은 축 분해를 따른다)
- [src/llm/llm-provider-config.controller.ts](../../src/llm/llm-provider-config.controller.ts) `77 행` (`@Controller("api/llm/providers")`) · `95 · 123 · 141 · 159 · 180 · 199 행` 부근 (6 handler 의 route decorator, `@Put("default")` 의 선언 순서 주석 `110~111 행` 포함) · 각 handler 의 `@UseGuards(JwtAuthGuard, RolesGuard)` + `@Roles("Admin")` RBAC 축
- [src/llm/llm-provider-config.service.ts](../../src/llm/llm-provider-config.service.ts) (404 / 409 분기 · sanitize 경로) 와 [src/llm/llm-provider-config.repository.ts](../../src/llm/llm-provider-config.repository.ts)
- [src/llm/llm-default-provider.repository.ts](../../src/llm/llm-default-provider.repository.ts) · [src/llm/llm-provider-config-resolver.service.ts](../../src/llm/llm-provider-config-resolver.service.ts) (REQ-049 의 "Admin 이 모델 지정" 결과가 실제 호출 경로로 이어지는지 확인용)
- [test/e2e/llm-provider-configs.e2e-spec.ts](../../test/e2e/llm-provider-configs.e2e-spec.ts) `60 행` (목록 describe, T-1967) · `256 행` (`:id` describe, T-1970) · `472 행` 부근 (`it.each(RBAC_CASES)`)
- [src/llm/llm-provider-config.controller.spec.ts](../../src/llm/llm-provider-config.controller.spec.ts) · [src/llm/llm-provider-config.service.spec.ts](../../src/llm/llm-provider-config.service.spec.ts) (unit 축 실계수 근거)
- [docs/decisions/ADR-0062-llm-default-provider-explicit-selection.md](../decisions/ADR-0062-llm-default-provider-explicit-selection.md) §Decision (두 행이 이미 참조하는 ADR — 링크는 유지한다)
- [docs/PLAN.md](../PLAN.md) `183 행` (REQ 재판정 1 회 규칙) · `157 · 158 · 182 행` (침범 금지 오너 게이트)

## Acceptance Criteria

- [ ] `docs/requirements.md` `68 행` REQ-049 상태 칸에 다음 3 축이 좌표와 함께 박제된다: **구현 축**(`llm-provider-config.controller.ts` 의 `@Controller` + 6 handler route 행번호 + `@Put("default")` 의 `:id` 선행 선언 제약, service · repository · resolver 파일) · **unit 축**(`llm-provider-config.controller.spec.ts` · `llm-provider-config.service.spec.ts` 등 실 spec 파일과 실계수) · **e2e 축**(`test/e2e/llm-provider-configs.e2e-spec.ts` 의 두 describe 와 실계수, 출처 `T-1967 · PR #1543 · main b2a6ce5d` / `T-1970 · PR #1545 · main 5e05de31`).
- [ ] `docs/requirements.md` `70 행` REQ-051 상태 칸에도 같은 3 축 좌표가 박제되고, 기존 서술 중 **참인 부분**("adapter·gateway 배선", "live 는 env-gated", "custom 3 model 슬롯 자체는 미구현 잔여") 과 [ADR-0062](../decisions/ADR-0062-llm-default-provider-explicit-selection.md) 링크는 보존된다.
- [ ] 두 행 모두에 **한계 축** 이 최소 2 종 명시된다 — (a) 쓰기 3 route(`POST /` · `PATCH /:id` · `PUT /default`) 는 apiKey 암호화 경로(`LLM_APIKEY_ENC_KEY` 주입 방식) 결정이 선행이라 e2e 미고정 (b) REQ-051 의 custom 3 model 슬롯 자체는 미구현. 이 한계를 적어 두어 **쓰기 축 e2e 가 머지되기 전에는 같은 REQ 재판정 task 를 다시 만들지 않는다**(PLAN `183 행` 왕복 금지).
- [ ] 모든 수치(spec 파일 수 · `it` 수 · `it.each` 행 수 · route 수)는 task 파일 숫자를 베끼지 않고 **실행 시점에 재검산** 한다. 재검산 결과가 본 task 본문과 다르면 **실측이 정본** 이고, 다른 부분은 journal 에 1 줄로 남긴다.
- [ ] 검증: `grep -n "llm-provider-configs.e2e-spec" docs/requirements.md` 가 2 hit 이상(REQ-049 · REQ-051 각 1) 이고, `sed -n '68p;70p' docs/requirements.md` 로 두 행이 여전히 유효한 표 행(`|` 7 칸 구조 · 검증 방법 칸 원값 `e2e` / `unit` 불변)임을 확인한다.
- [ ] 검증: `git diff --stat` 이 `docs/requirements.md` (+ 본 task 파일의 `status:` 1 행) 만 보여주고 `src/` · `test/` · `web/` · `prisma/` · `.github/` diff 가 0 이다.
- [ ] **R-112 4 축 판정** — 본 task 는 `commitMode: direct` doc-only 이고 production · test 코드 diff 가 0 이므로 [CLAUDE.md](../../CLAUDE.md) §3.2 의 R-110 · R-112 면제 대상이다. 따라서 (1) happy-path unit test (2) error path test (3) 분기별 test (4) negative case test 4 축은 **신규 public symbol 0 · 분기 0** 이므로 각각 생략하며, 그 사유를 commit trail 의 `TESTER: added: none` 로 남긴다. 위 `git diff --stat` 항목이 면제 요건(코드 diff 0)의 검증 수단이다.

## Out of Scope

- `src/` · `test/` · `web/` · `prisma/` 의 어떤 파일도 수정하지 않는다 — 본 task 는 문서 좌표 박제 전용이다.
- 쓰기 3 route(`POST /` · `PATCH /:id` · `PUT /default`) 의 e2e spec 신설 — `LLM_APIKEY_ENC_KEY` 주입 방식 결정이 선행이며 별도 pr task 다.
- REQ-043(`62 행`) 의 상태 칸 갱신 — 그 행은 74 route 보호 적용률 실측 서술이라 갱신하려면 전 route 재측정이 필요하다. 본 task 범위 밖이며 Follow-ups 로 남긴다.
- REQ-049 · REQ-051 의 `상태` 판정값 자체(둘 다 `DONE`) 변경 — 근거 좌표만 채우고 판정 등급은 건드리지 않는다. 등급을 낮춰야 할 실측이 나오면 고치지 말고 Follow-ups 에 적는다.
- REQ-050(`69 행`) · REQ-052 · REQ-053 등 인접 행 손대기.
- `docs/PLAN.md` `157 · 158 · 182 · 183 행` 오너 게이트 침범 — per-route perf baseline 신설 · k6 chain · AdminView 리팩터 전부 무관하다.

## Suggested Sub-agents

`implementer` (문서 좌표 실측 + 2 행 갱신). direct doc-only 라 tester 는 §3.2 R-110 면제.

## Follow-ups

- REQ-051 의 "custom 3 model 슬롯 자체는 미구현 잔여" 서술과 `prisma/schema.prisma` 416 행 주석("custom provider 1 config 가 3 슬롯 모두 차지 가능 (REQ-051)") 이 서로 긴장 관계다 — 슬롯 측 수용은 이미 schema 에 있고 미구현 잔여의 실제 범위(예: custom 전용 3 슬롯 프리셋 UI · seed)가 무엇인지 재정의가 필요하다. 본 slice 는 doc-only 이자 판정 등급 불변 범위라 서술만 보존했다.
- REQ-043(`62 행`) 상태 칸의 route 보호 적용률(74 route 중 49 보호) 실측은 그 이후 신설된 route 를 반영하지 못한다 — 전 route 재측정이 필요한 별도 task 다 (본 task Out of Scope).
- 쓰기 3 route(`POST /api/llm/providers` · `PATCH /:id` · `PUT /default`) e2e spec 신설 — `LLM_APIKEY_ENC_KEY`(ADR-0014 §2) 주입 방식 결정이 선행인 pr task. 이 축이 머지되기 전에는 REQ-049 · REQ-051 재판정 task 를 다시 열지 않는다.
- 실측 대조 결과 task 본문과의 불일치 없음 — e2e 좌표 `60 행` · `256 행` · `472 행` `it.each(RBAC_CASES)` 는 모두 현행 파일과 일치했고, 재검산 수치(e2e describe 2 · `it(` 14 + `it.each` 6 행 = 20 케이스, unit 8 spec `it(` 170 + `it.each` 13 블록)를 정본으로 박제했다.
