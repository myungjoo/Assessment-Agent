# ADR-0001 — Backend stack 확정

- Status: ACCEPTED
- Date: 2026-05-23
- Deciders: Assessment-Agent driver (autonomous)
- Refs: T-0001, CLAUDE.md §1, README.md §성능 특성, README.md §구현 과정에 대한 제약

## Context

Assessment-Agent는 200명 규모 평가대상자, 100여 GitHub repository, 1000여 Confluence page를 1시간 안에 처리해야 한다 (README 88–93행). 동시에 README §구현 과정에 대한 제약은 다음을 요구한다.

- well-known & well-maintained library 사용
- CI 기반 자동 test 실행 (unit + smoke + e2e)
- 한 commit = 한 주제, PR 기반 review

Driver-loop은 long-horizon 자율 실행이므로 stack 자체가 **빠른 빌드 / 명확한 모듈 경계 / TypeScript-native test 도구**를 제공해야 한다. 한 turn에 architect → implementer → tester sub-agent가 1시간 안에 모두 끝나야 한다.

## Decision

본 프로젝트의 backend stack을 다음으로 확정한다.

| 영역 | 선택 | 이유 |
| --- | --- | --- |
| Runtime | Node.js 22 LTS | 장기 유지(JS LTS), TypeScript-native ecosystem, GitHub Actions runner 기본 지원 |
| Language | TypeScript 5.x | 타입 안전성 — long-horizon에서 agent가 만든 코드의 회귀를 잡는 1차 방어선 |
| Framework | NestJS 10.x | 모듈/DI/Controller/Provider 경계가 명시적 → sub-agent가 task 단위로 한 모듈만 건드리기 좋음. supertest/Jest 기본 통합 |
| Package manager | pnpm 10.x | 빠른 install, content-addressable store, lockfile 결정성 |
| Unit/Integration test | Jest 29.x | NestJS 표준, snapshot, mock 내장 |
| E2E test | supertest (Phase P1+에서 도입) | NestJS 공식 권장 |
| Lint | ESLint 8.x + @typescript-eslint | NestJS CLI 기본값, 추가 dependency 0 |
| Formatter | (이번 ADR에서는 도입하지 않음 — Prettier는 follow-up) | 의존성 최소화 |
| CI | GitHub Actions | README에 명시(§구현 과정에 대한 제약 111행) |

### 채택하지 않은 대안

- **Fastify-only** (no NestJS): 가볍지만 모듈 경계가 약해 sub-agent 작업 격리가 어렵다. 거부.
- **Deno / Bun**: 빠르지만 NestJS / Jest / supertest 생태계 호환 미성숙. long-horizon용 안정성이 부족. 거부.
- **Express + 수작업 layering**: 빠른 초기 진입이지만 모듈/DI 표준 부재. 회귀 위험. 거부.
- **Yarn / npm**: lockfile 결정성/속도에서 pnpm 대비 우위 없음. 거부.
- **Vitest**: NestJS 공식 권장이 Jest이고 supertest 통합 사례 풍부. Jest 채택.

### DB / Frontend / Docker는 본 ADR의 범위가 아니다

- DB 선택은 별도 ADR (ADR-0002 후보).
- Frontend는 별도 ADR.
- Docker 도입은 별도 task.

## Consequences

### Positive

- NestJS CLI scaffolding은 ESLint + Jest를 기본 포함 → 신규 dependency 0으로 acceptance criteria 충족.
- Sub-agent가 `src/<module>/` 단위로 task를 split하기 쉬워진다.
- supertest는 phase P1에서 추가 도입 시점에만 dependency 확장 검토.

### Negative / Risks

- NestJS의 reflect-metadata 의존성 → tree-shaking 제약. 200명 규모에서 문제 없음으로 판단.
- Jest는 cold-start가 ts-jest 환경에서 느릴 수 있음 → SWC transformer는 follow-up ADR로 다룬다 (현시점 dependency 추가 회피).

### Follow-up tasks (미생성)

- ADR-0002: DB / ORM 선택
- ADR-0003: Frontend stack
- ADR-0004: 로깅/모니터링 (pino vs nestjs-pino 등)
- Prettier 도입 여부

## Compliance

- CLAUDE.md §1 의 stack table과 일치한다.
- 본 ADR 채택 후 신규 dependency 추가는 모두 별도 ADR 필요 (CLAUDE.md §5, §9).
