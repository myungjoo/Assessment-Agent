---
id: T-0827
title: 부하·내성 harness 도구 선택 ADR 신설 (k6/artillery/autocannon/supertest 비교·권고)
phase: P8
status: DONE
commitMode: pr  # 본 cron fire 는 운영 지침(문서 변경=direct commit)에 따라 direct doc-only 로 처리 — ADR 순수 문서·코드/dep 0. content 20dab424.
coversReq: [REQ-047, REQ-048]
estimatedDiff: 190
estimatedFiles: 2
created: 2026-07-08
independentStream: p8-load-harness
dependsOn: []
touchesFiles:
  - docs/decisions/ADR-0054-load-resilience-harness-tool.md
  - docs/ops/load-resilience-test-plan.md
plannerNote: P8 line148 부하·내성 follow-up — T-0826 계획의 §5 도구 선택 결정을 ADR 로 확정(권고만, dep 도입은 owner 승인 후 별도 task). ADR 신설=pr.
estimatedModel: "doc-only enumerated-section(ADR 신설) × 1.6 = base 120 × 1.6 ≈ 190 LOC, T-0063/T-0070 패턴"
---

# T-0827 — 부하·내성 harness 도구 선택 ADR 신설

## Why

PLAN.md P8 line148 (부하·내성 테스트) 은 T-0826 이 계획 문서
([docs/ops/load-resilience-test-plan.md](../ops/load-resilience-test-plan.md)) 로 시나리오·임계를
확정했으나, 실제 harness 를 구현하려면 부하 생성 도구(k6 / artillery / autocannon / 기존 supertest 기반)
선택이 선행돼야 한다. 그 계획의 §4·§5 는 도구 선택 결정을 **명시적으로 follow-up 으로 남겼다**.
본 task 는 그 결정을 ADR 로 박제해 다음 harness 구현 task 가 도구 재추론 없이 진행하도록 한다.
ADR 은 **도구를 권고만** 하며 실제 dependency 도입(package.json 변경)은 CLAUDE.md §5 (새 외부
dependency = BLOCKED) 에 따라 owner 승인 후 별도 task 로 넘긴다 — 본 ADR 은 그 승인의 근거 자료다.

## Required Reading

- `docs/ops/load-resilience-test-plan.md` — 특히 §2 시나리오 3종(S1 배치 1h / S2 조회 p95<3s / S3 동시성 내성), §3 임계 표, §4 접근·도구 후보, §5 follow-up. ADR 이 back 하는 계획.
- `docs/requirements.md` line 66~67 — REQ-047 / REQ-048 (성능 NFR, 검증 위치 `perf`).
- `docs/decisions/ADR-0002-db.md` — ADR 문서 포맷(Context / Decision / Consequences / Alternatives) 참조용 최소 1개.
- `CLAUDE.md` §5 (BLOCKED — 새 외부 dependency) + §1 기술 스택 표 — 도구 도입이 왜 owner 승인 대상인지, pnpm/Jest/supertest 기존 스택 경계.

## Acceptance Criteria

- [ ] `docs/decisions/ADR-0054-load-resilience-harness-tool.md` 신설. 다음 free ADR 번호(ADR-0053 이 최신 → 0054) 사용. 파일 존재 확인.
- [ ] ADR 에 표준 섹션 포함: **Status**(PROPOSED), **Context**(REQ-047/048 + load-resilience-test-plan §2 시나리오가 요구하는 부하 생성 능력), **Decision**(권고 도구 1종 명시 + 근거), **Consequences**, **Alternatives**(기각 도구별 이유).
- [ ] Alternatives 에 최소 3 후보 비교: (a) 기존 supertest 기반 자체 harness(신규 dep 0), (b) autocannon, (c) k6, (d) artillery 중 3+ 를 각각 장단점(신규 dep 여부·시나리오 fit·CI 통합 난이도·유지비)으로 서술.
- [ ] Decision 절에 "본 ADR 은 도구 **권고만** 하며 실제 dependency 도입은 CLAUDE.md §5 에 따라 owner 승인 후 별도 pr-mode task(package.json 변경)로 진행 — 본 task 는 dependency 를 추가하지 않는다" 를 명시. `git diff` 로 package.json / pnpm-lock.yaml 무변경 확인.
- [ ] Status 는 **PROPOSED** 로 둔다(owner 가 도구 승인 시 ACCEPTED flip 은 별도 direct 1줄 수정). ADR 안에 이 flip 조건 명시.
- [ ] `docs/ops/load-resilience-test-plan.md` §5(follow-up)에 본 ADR-0054 링크 1줄 추가(계획↔ADR cross-link). 그 외 계획 문서 본문 무변경(§1~§4 무손상).
- [ ] 분기 없음 — 본 task 는 markdown 문서(ADR + cross-link)만 추가/수정하며 실행 코드·public symbol 을 도입하지 않는다. 따라서 R-112 unit/error/branch/negative test 항목은 적용 대상 없음(생략).
- [ ] R-110 준수: pr-mode task 이므로 tester 가 `pnpm lint && pnpm build && pnpm test` 를 실행해 문서 추가가 기존 test/build 를 깨지 않음을 확인(production code 0 LOC 변경이어도 실행 의무). coverageThreshold 는 코드 미변경이라 기존 통과 유지 확인.

## Out of Scope

- **실제 harness 스크립트 작성 금지** — 부하 생성 코드·측정 실행은 owner 승인 + dependency 도입 후 별도 task.
- **package.json / pnpm-lock.yaml 변경 금지** — 어떤 새 dependency 도 추가하지 않는다(추가 필요 시 BLOCKED → notifier).
- **CI workflow(`.github/workflows/`) 변경 금지** — 부하 test CI step 추가는 harness 구현 task 범위.
- **load-resilience-test-plan.md 의 §1~§4 재작성 금지** — §5 에 ADR 링크 1줄만 추가.
- **REQ-047/048 상태(PLANNED) 변경 금지** — 계획 문서·ADR 신설만으로 NFR 검증 완료 아님.
- **다른 P8 bullet 정합 금지** — line148 외 bullet 은 건드리지 않는다.

## Suggested Sub-agents

`architect → tester` — architect 가 ADR 작성(도구 비교·권고) 후 tester 가 lint/build/test 로 회귀 없음 확인. implementer 는 문서만이라 architect 가 겸함(코드 변경 0).

## Follow-ups

(비어 있음 — sub-agent 가 관련 작업 발견 시 여기 append. 예: owner 도구 승인 시 ADR ACCEPTED flip direct task + harness 구현 pr task + dependency 추가 BLOCKED task)
