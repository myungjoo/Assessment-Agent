# Architecture documents — INDEX

본 디렉토리는 Assessment-Agent 의 architecture document 들을 모은 곳이다. P1 (Architecture) phase 의 각 task 가 본 디렉토리에 문서를 신설·갱신한다. 모두 living document — 이후 phase 진행 중 architect agent 가 ADR 와 함께 갱신.

## 문서 목록

| 문서 | 책임 | 생성 task | 상태 |
| --- | --- | --- | --- |
| [requirements.md](../requirements.md) | FR/NFR/Constraint 분리된 REQ-NNN 매핑 표 | T-A1 (P1) | 부분 (P1-Entry 가 kind 채움) |
| [deployment.md](deployment.md) | Deployment view — monolith vs worker / DB / secrets / scheduler / 네트워크 boundary | T-A2 (P1) | 완료 (T-0014 + T-0015) |
| [components.md](components.md) | Component view — 시스템을 component 단위 + 외부 시스템 + 상호 contract | T-A3 (P1) | 완료 (T-0016) |
| [modules.md](modules.md) | Module view — NestJS module 구조 + 의존성 방향 (acyclic) | T-A4 (P1) | 완료 (T-0017) |
| [api.md](api.md) | API contract — HTTP endpoint 목록 + schema | T-0030 (P2) | 완료 (T-0030) |
| [data-model.md](data-model.md) | Conceptual data model — entity + 관계 (구체 schema 는 P3) | T-0031 (P2) | 완료 (T-0031) |
| [directory.md](directory.md) | 디렉토리 구조 정의 — NestJS 표준 + module view mapping | P2 (T-0021) | 완료 (T-0021) |

## 갱신 룰

- 각 문서는 architect agent 가 책임. ADR 신설 시 관련 view 문서 동시 갱신 (architect.md 참조).
- 큰 변경 (예: monolith → worker 분리 전환) 은 새 ADR 로 박제 + 기존 view 문서 갱신. 이전 결정은 SUPERSEDED ADR 로 보존.
- view 문서 자체는 한 commit 안에서 너무 커지면 split (예: components.md 가 비대해지면 components/overview.md + components/<name>.md 로 분리). 단 INDEX.md 는 항상 동기.

## ADR 매핑

| ADR | 영향받는 view 문서 | 상태 |
| --- | --- | --- |
| ADR-0001 stack (NestJS / TS / pnpm / Jest / GHA) | modules.md (NestJS choice 반영) | ACCEPTED (T-0002, 8c6defe) |
| ADR-0002 DB (PostgreSQL + Prisma) | deployment.md + data-model.md | ACCEPTED (T-0014) |
| ADR-0003 Deployment (monolith vs worker, secret, scheduler, network) | deployment.md + components.md | ACCEPTED (T-0015) |

## MVA 원칙

본 디렉토리의 문서는 **Minimum Viable Architecture** 수준 — over-design 회피.

- 구체적 schema 컬럼 / API endpoint signature / service 메서드 시그니처는 본 문서 범위 밖. P3+ 의 task 에서 구체화.
- "어떤 component 가 있고 어떤 boundary 로 분리되어 있는가" + "deployment 구조" + "NFR 충족 계획" 까지만 P1 에서.
- 나머지는 ADR + 코드와 함께 진화.
