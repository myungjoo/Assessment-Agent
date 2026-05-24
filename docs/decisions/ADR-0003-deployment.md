---
id: ADR-0003
title: Deployment 토폴로지 4 결정 — Monolithic NestJS / env-based Secret / @nestjs/schedule / direct-egress Network
status: ACCEPTED
date: 2026-05-24
relatedTask: T-0015
supersedes: null
---

# ADR-0003 — Deployment 토폴로지 4 결정

## Context

Assessment-Agent 의 운영 토폴로지는 **process 구조 (단일 vs worker 분리) / 자격증명 보관 위치 / 시간 trigger 의 위치 / 외부 네트워크 접근 boundary** 4 가지로 압축된다. 본 ADR 은 이 4 결정을 1 문서로 응집해 박제한다. 4 결정이 모두 "운영 토폴로지" 라는 단일 관심사에 속하고 상호 의존적 (예: monolithic 채택이 scheduler 위치를 in-process 로 강제, in-process scheduler 가 secret 의 process-level 주입 필요성을 강화) 이라서, split 4 ADR 보다 응집 1 ADR 이 정합성을 한 번에 검토하기 좋다.

본 ADR 은 [ADR-0002 (PostgreSQL + Prisma)](ADR-0002-db.md) 와 함께 P1 의 T-A2 (Deployment view) 의 **source of truth** 다. 본 ADR 의 결정이 [docs/architecture/deployment.md](../architecture/deployment.md) 의 4 단락 (Monolithic / Secret / Scheduler / Network) 으로 풀려 view layer 에 반영된다.

본 ADR 이 cover 하는 REQ ([docs/requirements.md](../requirements.md) / [README.md](../../README.md)):

- **REQ-005/006/007** (README 7–17 행) — 3 GitHub instance (github.com / github.sec.samsung.net / github.ecodesamsung.com) → Decision §4 직접 motivation.
- **REQ-016** (README 33–41 행) — Confluence (confluence.sec.samsung.net 등) → Decision §4 동반.
- **REQ-020** (README 19–22 행) — 권한 부족 통지 → Decision §2 secret 흐름 + Decision §4 4xx catch.
- **REQ-039 / REQ-040** (README 71–74 행) — Admin UI cron 주기 / manual trigger → Decision §3 직접 motivation.
- **REQ-047** (README 88–92 행) — 100~200 명 / 50~100 repo / 1 h NFR → Decision §1 직접 motivation.

추가 외력 — **single-operator long-horizon** ([CLAUDE.md](../../CLAUDE.md) §1 / §10, 무거운 인프라 ROI 낮음) / **새 dependency BLOCKED** ([CLAUDE.md](../../CLAUDE.md) §5 / §9, 본 ADR 은 정책 박제만, 실제 패키지 도입은 P3/P4/P7 별도 task) / **Agent 친화성** (NestJS 표준 module 의 docs 풍부, framework convention 응집).

## Decision

본 ADR 은 4 결정을 응집한다. 각 결정은 default 권고를 채택하되, 향후 NFR 압박 (예: 300+ 명, sub-hour 평가, sharding) 또는 운영 환경 변화 (cloud-managed 전환) 시 본 ADR 을 SUPERSEDE 하는 새 ADR 로 전환한다.

### Decision §1 — Monolithic NestJS process (in-process queue OK)

**결정 (1 줄)**: Backend 는 **단일 NestJS process** 로 시작한다. HTTP API / scheduler / 평가 파이프라인 / LLM gateway / GitHub & Confluence adapter 가 동일 process 안에서 동작한다. 큐 분리 (Redis + BullMQ + 별도 worker process) 는 P5 (Evaluation pipeline) phase 이후 NFR 압박이 실제로 확인되면 별도 ADR 로 전환한다.

**근거**:

1. **REQ-047 의 boundary 가 monolithic 수용 가능 범위** — 100~200 명 × 50~100 repo × 7 일치 commit data 를 1 h 내 처리. 일 평균 1 회 평가 + cron 기반 야간 처리이므로 동시성 압박이 본질적으로 낮다. 동기 sequential 처리 또는 `Promise.all` + concurrency limit (예: 10 동시) 으로 충분히 안에 들어온다.
2. **운영 단순성** — single-operator 환경에서 process 1 개의 `pnpm start` / `node dist/main.js` / systemd unit 1 개로 모든 책임을 운영. 별도 worker process / Redis broker / job persistence layer 의 운영 부담 0.
3. **NestJS 의 in-process 응집** — `@nestjs/schedule` 의 cron + controller 의 manual trigger + service layer 의 평가 파이프라인이 같은 DI container 안에서 직접 호출 가능. 큐를 거치면서 발생하는 serialization / retry / dead-letter 정책의 복잡도가 본 단계에서는 over-engineering.
4. **새 dependency 회피** — Redis / BullMQ / @nestjs/bull 도입은 [CLAUDE.md](../../CLAUDE.md) §5 BLOCKED 룰 대상. monolithic 결정은 본 룰을 자연스럽게 회피.
5. **scheduler 결정 (§3) 과의 정합** — in-process scheduler 가 평가 pipeline 을 같은 process 의 service 메서드로 직접 호출. monolithic 이면 trigger → handler 의 hop 이 1 단계.

**전환 조건 (worker 분리의 future)**: 다음 중 하나라도 발생 시 본 ADR SUPERSEDED 별도 ADR 로 worker 분리 검토 — (a) REQ-047 의 NFR 이 monolithic 으로 안 들어옴 (실측), (b) 사용자 / 대상 규모가 300+ 명, (c) HA (active-active) 가 요구사항으로 추가됨, (d) 평가 파이프라인이 process crash 에 대한 durable retry 가 운영 요구가 됨.

### Decision §2 — Secret 저장 = 환경변수 (`@nestjs/config` 기반)

**결정 (1 줄)**: 자격증명 / API key / DB URL 등 모든 secret 은 **환경변수 (`process.env`)** 로 주입한다. 개발 환경은 `.env` 파일 (`.gitignore` 등록 필수, NestJS `@nestjs/config` 의 `ConfigModule.forRoot({ envFilePath: '.env' })` 패턴), 운영 환경은 process supervisor (systemd `EnvironmentFile=` / Docker `--env-file` / CI/CD secret injection) 의 환경변수. 외부 vault (HashiCorp Vault / AWS Secrets Manager / Azure Key Vault 등) 는 P7 / P8 운영 강화 단계에서 별도 ADR 로 도입.

**근거**:

1. **12-factor app config** — 환경변수 기반 config 는 industry standard. 운영 환경 별 (dev / staging / prod) 분리가 자연스럽고 image / artifact 는 환경 독립.
2. **`@nestjs/config` 의 표준성** — NestJS docs 의 first-class 패턴. `ConfigService` 가 type-safe getter 제공 + schema validation (`joi`) 옵션 있음. agent 가 표준 패턴을 따르기 쉽다.
3. **single-operator 환경의 ROI** — vault 도입은 operator 1 명이 자기 머신에서 운영하는 본 단계에서 over-engineering. vault 의 진짜 가치 (audit trail / dynamic credentials / rotation) 는 multi-operator + production 운영에서 발현.
4. **REQ-020 (권한 부족 통지) 와의 정합** — 자격증명 흐름이 단일 source (env) 에서 service layer 의 외부 adapter 까지 explicit 하게 전달되므로, 4xx 응답 catch 시 어느 service / 어느 credential 이 실패했는지 추적 가능.
5. **새 dependency 추가 회피** — `@nestjs/config` 자체는 별도 task (P3 entry 또는 Persistence layer task) 가 사용자 승인 후 도입. 본 ADR 은 패턴만 박제.

**secret 의 종류 (참고)**: GitHub 3 instance 의 PAT 또는 OAuth token / Confluence 의 PAT / LLM provider (Azure OpenAI / Anthropic / Google / OpenAI / custom) API key / DB 의 `DATABASE_URL` / Backend 의 JWT secret 또는 session secret. 각 환경변수 이름은 도입 task 의 reviewer 가 schema 일관성 점검.

**전환 조건**: multi-operator 운영 / audit 요구 / credential rotation 자동화가 요구 사항이 되면 별도 ADR 로 vault 도입.

### Decision §3 — Scheduler 위치 = `@nestjs/schedule` (in-process)

**결정 (1 줄)**: 시간 trigger 는 **`@nestjs/schedule` 모듈** (NestJS 내장, `node-cron` 기반) 을 Backend NestJS process 내부에서 사용. 외부 cron (system cron / Kubernetes CronJob / 외부 큐의 delayed job 등) 은 사용하지 않는다. Manual trigger (REQ-040) 는 동일 NestJS controller 의 HTTP endpoint 로 처리.

**근거**:

1. **REQ-039 의 동적 cron 갱신** — Admin 이 UI 에서 cron 주기를 변경 → DB 의 schedule 설정 row 갱신 → SchedulerModule 이 dynamic 하게 `CronJob` 재등록. 외부 cron 은 file 또는 OS 설정 변경이 필요해 runtime 갱신 어려움. in-process scheduler 는 `SchedulerRegistry.addCronJob` / `deleteCronJob` 로 자연스럽게 처리.
2. **REQ-040 manual trigger 와의 응집** — cron 과 manual 이 동일 service 메서드 (예: `EvaluationOrchestrator.runFullAssessment()`) 를 호출. trigger 경로가 controller (manual) / scheduler (cron) 둘 다 동일 entrypoint 로 환원.
3. **Decision §1 (monolithic) 과의 정합** — in-process scheduler 가 monolithic 의 자연스러운 귀결. 별도 process / 별도 큐 broker 도입 없이 trigger → handler 가 한 hop.
4. **운영 단순성** — Backend process 1 개만 살아 있으면 scheduler 도 동작. systemd / Docker container 도 1 개.
5. **새 dependency 추가 회피** — `@nestjs/schedule` 자체는 별도 task (P7 Scheduling & operations 진입 시) 가 사용자 승인 후 도입.

**default cron 시각**: KST 02:00 ([README.md](../../README.md) L72 의 예시). Admin 이 UI 에서 변경 가능. 실제 default 값은 도입 task 가 박제.

**전환 조건**: HA / multi-instance 가 도입되면 in-process scheduler 가 instance 별로 동시 실행되어 중복 trigger 위험. 그때 별도 ADR 로 distributed scheduler (예: PostgreSQL advisory lock 기반 leader election / Redis 기반 lock / 외부 cron service) 로 전환.

### Decision §4 — 외부 네트워크 boundary = direct outbound from app process

**결정 (1 줄)**: Backend process 가 **모든 외부 endpoint** 에 **직접 outbound** 한다. 별도 egress proxy / NAT gateway / SOCKS bastion 은 사용하지 않는다. Samsung 내부망 (github.sec / ecodesamsung / confluence.sec / 내부 LLM proxy / custom OpenAI 호환 서버) 과 public network (github.com / Azure OpenAI / Anthropic / Google / OpenAI 공개 API) 둘 다 같은 process 에서 호출한다. **운영 호스트는 corporate network (사내 host 또는 VPN) 에 위치한다고 가정** — 본 호스트가 내부+외부 둘 다 reach 가능.

**근거**:

1. **REQ-005/006/007/016 의 내부망 접근** — 3 GitHub instance 중 2 개 (github.sec / ecodesamsung) 와 Confluence (confluence.sec) 가 Samsung 내부망 host. corporate network 에 위치한 운영 호스트가 이 endpoint 에 직접 HTTPS 호출.
2. **public network 도 corporate host 에서 가능** — github.com / public LLM provider 는 corporate proxy (사내 인터넷 게이트웨이) 를 통해 outbound. Node.js 의 `HTTPS_PROXY` / `HTTP_PROXY` 환경변수가 표준이라 별도 코드 없이 지원.
3. **운영 단순성** — egress proxy / NAT gateway 분리는 본 단계의 ROI 가 낮음. trace / firewall rule 정렬은 운영 매뉴얼 (P7 / P8) 에서 처리.
4. **TLS / 사내 인증서** — 사내 PKI (Samsung 사내 CA) 가 발급한 인증서는 `NODE_EXTRA_CA_CERTS=/path/to/samsung-ca-bundle.pem` 환경변수로 trust. `NODE_TLS_REJECT_UNAUTHORIZED=0` 은 **금지** (보안 위험, MITM 노출). 본 결정은 표준 Node.js HTTPS stack 만 사용 → 별도 dependency 0.
5. **REQ-020 권한 부족 흐름** — adapter (`GithubAdapter` / `ConfluenceAdapter` / `LlmGatewayService`) 가 4xx 응답을 catch → 권한-부족 event 를 emit → 통지 모듈로 전달. event 전파 경로가 같은 process 안에 있어 hop 최소.

**전환 조건**: 운영 호스트가 corporate 외부 (cloud-managed AWS / Azure 등) 로 이전하면 본 ADR SUPERSEDED. cloud-host 에서는 내부망 (github.sec / confluence.sec) reach 가능성을 별도로 보장 (사내 VPN tunnel / Direct Connect / ExpressRoute 등) 해야 하며, 그 토폴로지를 새 ADR 로 박제.

## Consequences

### 긍정

- **운영 단순성**: process 1 개 + DB 1 개 (ADR-0002) + 환경변수 1 set + corporate host 1 대 = 운영 표면이 가장 작다. single-operator long-horizon 정합.
- **NestJS native 응집**: `@nestjs/config` + `@nestjs/schedule` + DI container 가 framework convention 안에서 자연스럽게 묶임. agent 환각 ↓.
- **REQ-039 / REQ-040 통합 진입점**: cron 과 manual trigger 가 같은 service 메서드 호출 — duplication 0.
- **새 dependency 0**: 본 ADR 은 정책만 박제 — 실제 도입은 별도 task ([CLAUDE.md](../../CLAUDE.md) §5 / §9 자체 회피).
- **trace 단순화**: 외부 호출 → adapter → event → notification hop 이 1 process 안에서 일어남. correlation ID 처리 trivial.
- **REQ-047 NFR 충족 가능성**: in-process concurrency (Promise.all + limit) 로 100~200 명 × 50~100 repo × 1 h 들어옴. 실측은 P5.

### 부정 / trade-off

- **scale-out 한계**: monolithic + in-process scheduler 가 HA / sharding 에 어울리지 않음. 사용자 규모 증가 시 worker 분리 ADR 필요.
- **process crash 시 in-flight job 손실**: 평가 파이프라인 진행 중 process 가 죽으면 진행 중 job 의 partial state 가 in-memory 에서 소실. 보완책은 P5 phase 에서 DB 기반 checkpoint 또는 idempotent 재실행 설계로 처리.
- **secret rotation 수동**: env-based secret 은 rotation 시 process restart 필요 (또는 SIGHUP + ConfigModule reload — `@nestjs/config` 의 dynamic reload 는 표준 패턴 아님). 자동화는 P7 / P8 vault 도입 ADR 의 책임.
- **corporate-host 의존**: Decision §4 가 운영 호스트의 위치를 corporate network 로 가정. cloud-managed 환경 전환 시 본 ADR SUPERSEDE 필요.
- **vault 부재의 audit 한계**: secret 의 접근 audit / rotation history 가 OS 의 env 단위 로 그침. multi-operator / regulatory audit 요구 시 vault ADR 필요.

### 후속 task 전망

- **P3 Persistence layer**: `@nestjs/config` + ConfigModule 도입 — Decision §2 actual 시작점 (env 기반 `DATABASE_URL` / app config).
- **P4 External integrations**: GitHub / Confluence / LLM adapter 가 `ConfigService` 에서 secret 읽는 패턴 적용 — Decision §2 + §4 actual 사용처.
- **P5 Evaluation pipeline**: monolithic in-process 동시성 limit / checkpoint / idempotency — Decision §1 actual 검증.
- **P7 Scheduling & ops**: `@nestjs/schedule` 도입 + cron 동적 갱신 + manual trigger endpoint — Decision §3 actual. P7 / P8 운영 매뉴얼 — Decision §4 운영 측면.

## Alternatives considered

### Decision §1 — Monolithic vs worker 분리

| 대안 | 장점 | 단점 | 채택 여부 |
| --- | --- | --- | --- |
| **Monolithic NestJS (단일 process)** (채택) | 운영 단순 / 새 dependency 0 / NestJS DI 안에서 응집 / Decision §3 in-process scheduler 와 정합 | scale-out 한계 / process crash 시 in-flight 손실 / HA 불가 | **✓ 채택** |
| Monolithic + in-process queue (예: 자체 `BullModule`-like 가 아닌 `Promise.all` + concurrency limiter `p-limit` 패턴) | dependency 추가 거의 0 (`p-limit` 매우 작음) / sequential 보다 처리량 약간 ↑ | 본 ADR 의 monolithic 와 사실상 동일 — 별도 결정 분리 불필요. P5 implementer 가 자연스럽게 채택할 패턴 | 미채택 — Decision §1 의 monolithic 안에 포함된 구현 선택지로 본다 (별도 ADR 분리 안 함) |
| 별도 worker process + Redis + BullMQ (`@nestjs/bull`) | durable job queue / process crash 시 retry / horizontal scale 가능 | Redis dependency 추가 (BLOCKED 룰) / 운영 process 2 개 + broker 1 개 / serialization 비용 / dead-letter 정책 추가 복잡도 | 미채택 — REQ-047 boundary 가 본 패턴을 요구하지 않음. P5 이후 NFR 압박 시 별도 ADR |
| Kubernetes Job 분리 (k8s 클러스터 + CronJob + Job) | cloud-native 운영 / HA / auto-scaling 표준 | k8s 클러스터 자체가 single-operator 환경에서 over-engineering / 운영자 1 명에게 운영 부담 큼 | 미채택 — single-operator long-horizon 컨텍스트 와 어긋남 |

### Decision §2 — Secret 저장

| 대안 | 장점 | 단점 | 채택 여부 |
| --- | --- | --- | --- |
| **env + `@nestjs/config` + `.env` (dev)** (채택) | 12-factor 표준 / NestJS first-class 패턴 / dependency 추가 1 개 (별도 task) / 운영 단순 | rotation 수동 / audit trail 부재 / multi-operator 시 source-of-truth 분산 | **✓ 채택** |
| `.env` 단독 (NestJS ConfigModule 없이 직접 `process.env`) | dependency 추가 0 / 가장 단순 | type-safe getter 부재 / schema validation 없음 / scattered access / agent 가 config schema 추론 어려움 | 미채택 — type safety 와 schema validation 의 ROI 가 작은 추가 dependency 비용을 초과 |
| HashiCorp Vault (또는 동등 vault) | audit trail / dynamic credentials / rotation 자동화 / multi-operator 안전 | vault server 운영 부담 / single-operator 환경 ROI 낮음 / dependency 추가 (vault SDK + agent) / NestJS 통합이 second-class | 미채택 — P7 / P8 hardening 시 재검토 |
| Cloud-managed secrets (AWS Secrets Manager / Azure Key Vault / GCP Secret Manager) | managed service / IAM 통합 / rotation 자동화 옵션 | corporate-host 가정 (Decision §4) 과 어긋남 / 외부 SDK dependency / cloud-host 전환 ADR 과 함께 고려해야 함 | 미채택 — Decision §4 SUPERSEDE 시 동반 검토 |

### Decision §3 — Scheduler 위치

| 대안 | 장점 | 단점 | 채택 여부 |
| --- | --- | --- | --- |
| **`@nestjs/schedule` (in-process, NestJS 내장)** (채택) | REQ-039 동적 cron 갱신 자연스러움 / REQ-040 manual trigger 와 controller 응집 / Decision §1 monolithic 정합 / 운영 단순 | HA / multi-instance 시 중복 trigger 위험 / process crash 시 trigger 손실 | **✓ 채택** |
| System cron (OS 의 `/etc/cron.d/` 또는 systemd timer) | 표준 OS 도구 / NestJS process 죽어도 trigger 발사 (이후 HTTP curl 로 endpoint 호출) | REQ-039 의 UI 기반 동적 갱신이 어렵다 (OS file 갱신 → 별도 permission / sync) / trigger 경로가 OS-level 로 빠져서 가독성 낮음 / 운영 호스트 별 cron 설정 동기화 필요 | 미채택 — REQ-039 동적 갱신 요구와 정합 낮음 |
| Queue-based delayed job (Redis + BullMQ 의 `repeat` 옵션) | durable scheduling / retry / multi-instance 안전 (broker 가 lock) | Redis dependency 추가 (BLOCKED) / Decision §1 monolithic 결정 과 어긋남 / over-engineering | 미채택 — worker 분리 ADR 이 도입될 때 동반 검토 |
| Kubernetes CronJob | k8s 표준 / 분리된 trigger / scale-out | k8s 클러스터 자체 부담 / 운영 호스트 가정 (Decision §4) 과 어긋남 / over-engineering | 미채택 — Decision §1 worker 분리 ADR 동반 시 재검토 |

### Decision §4 — 외부 네트워크 boundary

| 대안 | 장점 | 단점 | 채택 여부 |
| --- | --- | --- | --- |
| **Direct outbound from app process (corporate host)** (채택) | 운영 단순 / hop 최소 / 표준 Node.js HTTPS / 사내 CA 는 `NODE_EXTRA_CA_CERTS` / dependency 0 | corporate-host 가정 의존성 / cloud-host 전환 시 ADR SUPERSEDE 필요 | **✓ 채택** |
| Explicit egress proxy (예: Squid / 사내 web proxy + `HTTPS_PROXY`) | egress traffic 의 audit / firewall rule 의 중앙 관리 | proxy 운영 부담 추가 / 본 단계 ROI 낮음 / 표준 `HTTPS_PROXY` 환경변수로 충분히 지원 가능 (필요해지면 코드 변경 0) | 미채택 — 필요 시 환경변수만 set 하면 본 결정 안에서 흡수 가능 |
| NAT gateway + dedicated outbound IP (예: AWS NAT Gateway) | egress IP 고정 / 외부 endpoint 의 IP allowlist 적용 가능 | cloud-managed 환경 의존 / corporate-host 가정 (Decision §4) 과 어긋남 | 미채택 — cloud-host 전환 ADR 동반 시 재검토 |
| SOCKS bastion / SSH tunnel | bastion 1 점에 모든 외부 호출 집중 / audit 강함 | hop 1 단계 추가 / 운영 호스트 별 bastion 설정 부담 / TLS layering 복잡 | 미채택 |

## 범위 밖 (deferred)

- 실제 패키지 도입 (`@nestjs/config` / `@nestjs/schedule` / BullMQ / Redis / dotenv / vault SDK 등) — 사용자 승인 후 별도 task ([CLAUDE.md](../../CLAUDE.md) §5 / §9).
- 구체 `.env.example` / ConfigModule / SchedulerModule NestJS module 작성 — P3 / P4 / P7 task.
- 운영 매뉴얼 (corporate host 셋업 / 사내 CA bundle / firewall rule / systemd unit) — P7 / P8.
- LLM provider 5 종 endpoint 차이 — P4 LLM gateway task. Authentication / RBAC — P3. web frontend deployment — P6.
- corporate network 구체 토폴로지 (VPN / DNS / 사내 PKI 매뉴얼) — 운영 매뉴얼 영역.

## References

- [CLAUDE.md](../../CLAUDE.md) §1 / §5 / §9 / §10 / §12 — 스택 / 새 dependency BLOCKED / single-operator / 한국어 정책
- [ADR-0001](ADR-0001-stack.md) / [ADR-0002](ADR-0002-db.md) — 선행 ADR (스택 / DB)
- [README.md](../../README.md) — 7–17 (REQ-005~007 GitHub) / 19–22 (REQ-020 권한) / 33–41 (REQ-016 Confluence) / 71–74 (REQ-039/040 schedule) / 88–92 (REQ-047 NFR)
- [docs/requirements.md](../requirements.md) — REQ table source of truth
- [docs/architecture/INDEX.md](../architecture/INDEX.md) / [docs/architecture/deployment.md](../architecture/deployment.md) — view layer
- NestJS docs (<https://docs.nestjs.com/techniques/configuration> / <https://docs.nestjs.com/techniques/task-scheduling>) / 12-factor app (<https://12factor.net/config>)

Refs: T-0015, REQ-005, REQ-006, REQ-007, REQ-016, REQ-020, REQ-039, REQ-040, REQ-047
