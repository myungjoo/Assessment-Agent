---
id: ADR-0026
title: coverageThreshold.global branch/statement floor ratchet 상향 — 50→90 측정-후-설정 + ratchet-only 정책 박제
status: ACCEPTED (2026-06-04)
date: 2026-06-04
relatedTask: T-0235
supersedes: null
---

# ADR-0026 — `coverageThreshold.global` branch/statement floor ratchet 상향 + ratchet-only 정책

> [test-quality-coverage-audit-2026-06](../progress/test-quality-coverage-audit-2026-06.md)(T-0231) §1·§4 P4 가 박제한 **CI 회귀-방어 gap** 을 해소한다. `package.json` 의 `coverageThreshold.global` 중 `branches`/`statements` floor 가 `50` 으로, `lines`/`functions` floor(`80`)보다 **낮게** 설정돼 있어 미래 분기/구문 회귀를 조기에 적발하지 못한다. 실측이 100% 인 현재 상태를 기준으로 floor 를 **측정값 아래 안전 margin(90)** 으로 ratchet 상향하고, 향후 floor 변경 규율(ratchet-only — 상향은 task/ADR 로 허용, 하향은 ADR 필수)을 박제한다. production code 0 LOC — 본 ADR + `package.json` jest config 수치만.

## Context

[T-0231 audit 보고서](../progress/test-quality-coverage-audit-2026-06.md) §1 은 `pnpm test:cov` 1 회 실측으로 전체 스위트가 threshold 를 압도적으로 상회함을 확인했다(2026-06-04 스냅샷: `% Branch 99.83 / % Statements 99.94 / % Functions 100 / % Lines 99.94`). 그러나 같은 §1 의 "사실 정정" 은 **`package.json` 의 `coverageThreshold.global` 이 `branches: 50 / statements: 50` 으로, `lines: 80 / functions: 80` 보다 낮게 설정돼 있다**는 정책 gap 을 지적했다.

이 gap 의 실질 위험(audit §4 P4):

- **회귀 조기 적발 기능 상실** — 실측 branch 가 99.83 임에도 floor 가 50 이라, branch coverage 가 예컨대 99.83 → 70 으로 떨어져도 jest 가 통과시켜 CI 가 green 으로 남는다. floor 가 너무 낮아 "분기 누락이 % 뒤에 숨는" 회귀를 조기에 막지 못한다.
- **line/function 과의 비대칭** — line/function 은 이미 80 floor 로 회귀를 방어하는데, branch/statement 만 50 으로 방치돼 방어선이 비대칭이다.

본 ADR 작성 시점(T-0235)에 floor 결정 전 **`pnpm test:cov` 를 재실행**한 결과, audit 스냅샷 이후 P1~P3 patch(T-0232 `encrypt-token-cli` 비-Error throw / T-0233 `difficulty-mapping.service` non-Prisma error / T-0234 `auth.module` JWT secret helper 분리)가 모두 머지되어 잔여 미커버 분기가 닫혔고, **실측이 `% Branch 100 / % Statements 100 / % Functions 100 / % Lines 100`** 로 상승했다(166 suite / 3285 test 전부 pass). 측정 blind spot(audit §2(c))은 P1~P3 로 이미 해소됐고, 남은 것은 floor 정책뿐이다 — 본 ADR 이 그 마지막 dependency-free audit backlog 항목(P4)을 처리한다.

### audit 외력

- **audit §1** — 실측/threshold 사실 정정(branch/statement 50 floor 가 line/function 80 보다 낮음).
- **audit §4 P4** — branch/statement floor 상향 권고 + "CI 정책 변경 = pr-mode + false-positive 검토 동반" 명시. 본 ADR 이 그 권고를 측정-후-설정 ratchet 으로 구현한다.

### ADR cross-reference

- **다음 free 번호 ADR-0026** — `docs/decisions/` 에 ADR-0001~ADR-0025 점유(ADR-0007 만 미신설). 본 ADR 은 다음 free 번호 ADR-0026 을 사용한다.
- **[ADR-0023](ADR-0023-permission-denied-audit-query-rbac-contract.md)** — frontmatter + 본문 구조(Context / Decision / Consequences / Alternatives) 포맷 reference.

## Decision

본 ADR 은 다음 3 결정을 박제한다.

### Decision §1 — branch/statement floor 를 측정값 아래 안전 margin 으로 ratchet 상향

`package.json` 의 `jest.coverageThreshold.global` 을 다음과 같이 변경한다(`functions`/`lines` 는 현행 80 유지 — 본 ADR 은 branch/statement 만 상향):

| 지표 | 변경 전 floor | 변경 후 floor | 본 ADR 시점 실측(All files) |
| --- | --- | --- | --- |
| `branches` | 50 | **90** | 100 |
| `statements` | 50 | **90** | 100 |
| `functions` | 80 | 80 (유지) | 100 |
| `lines` | 80 | 80 (유지) | 100 |

**측정-후-설정 규율 (CI green 보장의 핵심)** — floor 는 반드시 floor 결정 직전 실행한 `pnpm test:cov` 의 All-files 실측값 **이하**로 설정한다. 측정값보다 높게 설정하면 jest exit 1 → CI `test:cov` step fail → PR red 가 되므로 절대 금지. 본 ADR 시점 실측은 branch/statement 모두 100 이므로 floor 90 은 측정값 아래 10%p 안전 margin 을 확보한다.

### Decision §2 — ratchet(점진) 원칙 — 한번에 100 으로 올리지 않는다

floor 를 실측값(100)과 **동일하게** 설정하지 않고 그 아래 안전 margin(90)으로 설정한다. 사유:

- spec 추가/변경에 따른 미세 coverage drift(예: 새 분기 1 개가 일시적으로 미커버되는 round)에도 floor 100 은 즉시 false-positive(정상 PR 의 CI red)를 유발한다. 90 floor 는 그 drift 를 흡수하면서도 50 대비 회귀 방어를 대폭 강화한다.
- 90 은 line/function 의 80 floor 보다도 높아, branch/statement 가 더 엄격하게 방어된다(현 실측이 100 이라 정당).
- 추가 상향(예: 90→95)은 본 ADR 의 ratchet-only 정책(Decision §3) 하에서 별도 task/ADR 로 언제든 가능하다.

### Decision §3 — ratchet-only 정책 박제 (상향은 자유, 하향은 ADR 필수)

본 ADR 이후 `coverageThreshold.global` floor 변경 규율을 박제한다:

- **상향(ratchet up)** — floor 를 더 높이는 변경은 측정-후-설정 규율(Decision §1)만 지키면 일반 task/PR 로 허용한다(별도 ADR 불요). 실측이 충분히 높아지면 점진적으로 올린다.
- **하향(loosen)** — floor 를 낮추는 변경은 회귀 방어선 후퇴이므로 **별도 ADR 로 근거를 박제**해야 한다(예: 측정 방식 변경으로 실측이 구조적으로 하락한 경우). 무근거 하향 금지.

이 ratchet-only 규율이 long-horizon 동안 coverage floor 가 "낮아지지 않고 높아지기만 하는" 단조 증가 방어선이 되도록 보장한다.

## Consequences

**긍정**

- 미래 branch/statement 회귀가 floor(90) 미만으로 떨어지면 jest exit 1 → CI `test:cov` step fail → PR red 로 **조기 적발**된다(audit §4 P4 권고 충족). 50 floor 의 회귀 방어 무력화 상태가 해소된다.
- branch/statement(90)가 line/function(80)보다 높은 비대칭이 해소돼, 분기 누락이 % 뒤에 숨는 risk 를 방어한다.
- ratchet-only 정책으로 floor 단조 증가가 보장돼, long-horizon 동안 coverage 품질이 후퇴하지 않는다.
- 새 외부 dependency 0 (jest 내장 `coverageThreshold` — 신규 도구 도입 없음).

**부정 / 비용**

- 향후 PR 이 일시적으로 branch/statement 를 90 미만으로 떨어뜨리면 CI 가 red 가 되어, 해당 PR 에서 test 보강이 강제된다(의도된 방어 — 비용이자 효익). margin 10%p(실측 100 vs floor 90)가 미세 drift 의 false-positive 를 흡수한다.
- line/function floor(80)는 본 ADR 범위 밖이라 유지 — 추후 별도 검토 여지(현행 적정).

## Alternatives

| 대안 | 채택 여부 | 사유 |
| --- | --- | --- |
| **(a) floor 를 실측값 100 으로 즉시 설정** | 기각 | 미세 coverage drift(새 분기 1 개 일시 미커버 등)에도 정상 PR 이 CI red 가 되는 false-positive 위험. ratchet 원칙(Decision §2)상 측정값 아래 margin 으로만. |
| **(b) per-file threshold 도입** | 기각 | 파일 단위 floor 는 너무 granular — 신규 파일마다 floor 관리 부담 + 본 audit gap(global floor 비대칭)의 핵심과 무관. global floor 상향으로 충분. |
| **(c) 현행 50 유지** | 기각 | 회귀 조기 적발 기능 무력화 상태 지속(audit §4 P4 가 지적한 gap 미해소). |
| **(d) mutation testing(audit P5) 도입** | 본 ADR 범위 밖 | Stryker 등 mutation testing 은 새 외부 dependency = [CLAUDE.md §5](../../CLAUDE.md) HITL 게이트 + 별도 ADR 대상. 후속 별도 검토(audit P5 후보 언급만). |
| **(e) branch/statement floor 를 line/function 과 동일한 80 으로 flat 설정** | 기각 | 실측이 100 이라 80 은 회귀 방어선이 불필요하게 느슨(50→80 은 개선이나 90 대비 margin 과다). 측정값 아래 ratchet(90)이 더 강한 방어선이면서도 drift 흡수 가능. |
