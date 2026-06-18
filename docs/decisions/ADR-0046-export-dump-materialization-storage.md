---
id: ADR-0046
title: "ExportDump materialization + artifact 저장 위치 결정 (in-process Readable streaming + 영속 저장 0 / 외부 object-storage 는 별도 게이트)"
status: ACCEPTED
date: 2026-06-19
relatedTask: T-0505
relatedReq: [REQ-030, REQ-032]
supersedes: null
---

# ADR-0046 — ExportDump materialization + artifact 저장 위치 결정

> 본 ADR 은 사용자가 [Q-0042](../STATE.json) 를 **게이트1 (실 chunked-streaming / build service-layer chain 승인)** 으로 결정한 직후, 그 chain 의 **ADR-우선 첫 step** 이다. [T-0437](../tasks/T-0437.md)~[T-0473](../tasks/T-0473.md) 의 preview-side (dependency-free) export helper 잔여가 소진됐고, [UC-07 §5 step5·13](../use-cases/UC-07-export-import.md) + §8 NFR 이 요구하는 **실 service-layer 배선** 으로 진입하는데, 그 배선은 (1) 직렬화된 `ExportDump` envelope 를 실제 byte stream / 다운로드 본문으로 만드는 **materialization 전략**, (2) 만들어진 artifact 를 어디에 두는지 결정하는 **artifact 저장 위치** 라는 두 신규 infra 결정을 동반한다. [CLAUDE.md §1](../../CLAUDE.md) "코드보다 ADR 이 먼저" + [§3.1](../../CLAUDE.md) rule 4 (새 ADR = pr) 에 따라 이 chain 의 첫 산출물이 본 ADR 이며, 본 ADR 은 **결정 전용 0 LOC** — 실 materialization 실행 함수·streaming pipe·REST controller·repository 구현은 본 ADR ACCEPTED 후 별도 후속 task (§Out of scope / §Follow-ups) 다.
>
> **Status `ACCEPTED` 의 근거와 한계**: 사용자 Q-0042 게이트1 승인이 본 두 결정 (새 dependency 0 옵션) 의 진행을 허가했으므로 `ACCEPTED` 다. 단 **외부 object-storage (S3 / MinIO 등) 로의 전환은 본 ADR 이 내리지 않으며, 그 도입은 새 외부 dependency 이므로 [CLAUDE.md §5](../../CLAUDE.md) 에 따라 반드시 별도 사용자 게이트 결정으로 남긴다** (§Decision 2 / §Alternatives A). 본 ADR 은 어떤 새 dependency 도 추가하지 않는다.
>
> **ADR 번호 정합 note**: 본 task ([T-0505](../tasks/T-0505-adr-export-dump-materialization-storage.md)) 는 slug 를 `ADR-0044-export-dump-materialization-storage` 로 지칭했으나, id `ADR-0044` (export/import **job** 영속 데이터 모델) 와 `ADR-0045` (LLM provider deployment config) 가 이미 점유돼 있어 다음 free id `ADR-0046` 으로 신설한다 (slug 는 task 의도 그대로). 본 ADR 은 [ADR-0044](ADR-0044-export-import-job-persistence.md) 의 후속 — ADR-0044 §Out of scope 이 명시적으로 deferred 한 "materialization 전략" + "artifact 저장소 mechanism" 두 piece 를 닫는 sequel 이라 충돌이 아니라 보완이다.

## Context

[UC-07](../use-cases/UC-07-export-import.md) 은 Admin 이 평가 자료를 (a) **Export** (read-only, DB → file artifact 다운로드) 하는 흐름을 박제한다 ([REQ-030](../requirements.md)). P7 R-57 chain 은 누적 helper 로 envelope 조립 ([buildExportDump](../../src/export/export-dump.ts), T-0438) · 다운로드 descriptor 조립 ([buildExportArtifactDescriptor](../../src/export/export-artifact-descriptor.ts), T-0457) · chunked streaming 의 plan/progress/resume/integrity 산정 (`export-chunk-*.ts`, T-0469~T-0472) 까지 **순수 산정 helper** 를 전부 마련했으나, 정작 envelope → 실제 byte → 다운로드 응답으로 **materialize** 하는 piece 와 그 산출물을 **어디에 두는지** 가 비어 있다.

핵심 사실 — **선행 ADR 이 이 두 결정을 명시적으로 deferred 했다**:

- [ADR-0044](ADR-0044-export-import-job-persistence.md) §Out of scope / §Consequences (부정) 는 `artifactRef` 를 "artifact 의 pointer (참조 식별자) 일 뿐 본문이 아니다" 로만 박제하고, **"artifact 저장소 mechanism (로컬 파일시스템 vs S3-호환 object storage) 의 구체 선택" 을 새 외부 dependency 가능성을 이유로 본 task 밖, 필요 시 별도 §5 게이트 / ADR** 로 미뤘다. 본 ADR 이 바로 그 deferred 결정을 닫는다.
- [data-model.md L171](../architecture/data-model.md) 도 동일하게 "artifact 저장소 mechanism (로컬 파일시스템 vs S3-호환 object storage — 새 외부 dependency 가능성 시 별도 §5 게이트)" 를 후속으로 남겨 두었다.

따라서 본 ADR 은 **새 entity 도입이 아니라** (ExportJob/ImportJob 은 ADR-0044 가 이미 박제), envelope 가 어떤 byte stream 전략으로 다운로드 본문이 되는지 (Decision 1) 와 그 산출물 artifact 가 어느 저장 위치에 사는지 (Decision 2) 를 **새 외부 dependency 0 옵션 우선** 으로 decide 한다.

핵심 외력:

- **[Q-0042 decision](../STATE.json)** — 사용자가 실 chunked-streaming / build service-layer chain 진입을 게이트1 로 승인. 본 ADR 의 §Decision 1·2 가 그 chain 의 첫 결정.
- **[UC-07 §8 NFR](../use-cases/UC-07-export-import.md)** — "본 UC 의 응답 시간은 dump size 에 비례 ... 대량 dump 는 long-running operation 가능 — async job + status polling + chunked streaming + resumable upload 는 P5/P7 의 별도 설계 (Out of Scope)". 본 ADR 이 그 "별도 설계" 의 **materialization·저장 부분** 이다 (§NFR 정합 절).
- **[ADR-0003 §1](ADR-0003-deployment.md)** — Monolithic NestJS in-process process (외부 storage 미전제). materialization 이 in-process 흐름 (별도 worker / broker / 외부 storage 없이 같은 process 의 service → HTTP response) 이어야 하는 근거.
- **[ADR-0033](ADR-0033-evaluation-result-persistence.md)** — "새 dependency 0 / 새 credential 0" 선례 (내장 Prisma 만). 본 ADR 도 동일 invariant — 내장 Node.js `stream` + 기존 PostgreSQL/Prisma 만 사용.
- **[CLAUDE.md §5](../../CLAUDE.md)** — 새 외부 dependency / 새 infra = BLOCKED. 본 결정은 두 결정 모두 **신규 외부 infra 0** 옵션을 채택해 이 게이트를 발화하지 않으며, 외부 object-storage 는 불가피할 때만 별도 게이트로 명시 박제한다.
- **REQ-032** — raw 미저장. materialization 입력 envelope 가 이미 raw-free (`buildExportDump` 가 선별된 derived record 만 담음) 이므로 byte stream 화·저장 어느 단계도 raw 를 새로 끌어오지 않는다 (§Decision 1 정합).

## Decision

### Decision §1 — materialization 전략: in-process JSON 직렬화 → Node `Readable` stream (새 외부 dependency 0)

**채택: `ExportDump` envelope 를 다운로드 byte 로 만드는 materialization 은 in-process 에서 Node.js 내장 `stream`/`Readable` 기반으로 수행한다 — `JSON.stringify(envelope)` 직렬화 결과 (또는 chunk 단위 직렬화 산출물) 를 Node `Readable` stream 으로 감싸 HTTP 응답 본문으로 흘려보낸다. 새 외부 dependency (압축 라이브러리 / 외부 직렬화기 / streaming SDK) 0, [ADR-0003 §1](ADR-0003-deployment.md) monolithic in-process 흐름 안에서 완결한다.**

전략 박제:

- **직렬화기**: Node.js 내장 `JSON.stringify` (envelope 는 직렬화 가능한 plain object — [export-dump.ts](../../src/export/export-dump.ts) §44~51 의 `ExportDump` interface). [buildExportArtifactDescriptor](../../src/export/export-artifact-descriptor.ts) 의 `contentType: "application/json"` + `byteSizeHint = Buffer.byteLength(JSON.stringify(dump), "utf8")` 와 정합한다 — descriptor 의 hint 산정 방식이 곧 materialization 의 직렬화 방식이다 (재발명 0, drift 0).
- **stream 매체**: Node.js 내장 `stream.Readable` (예: `Readable.from(serialized)` 또는 chunk 별 `push`). NestJS controller 는 이 `Readable` 을 `StreamableFile` (Nest 내장, 새 dependency 0) 또는 직접 `res` pipe 로 반환한다 — 구체 NestJS 배선 form 은 후속 controller task 결정, 본 ADR 은 "in-process Node Readable stream" 만 박제.
- **헤더 직렬화**: 다운로드 응답 헤더 (`Content-Type` / `Content-Disposition` / `Content-Length`) 는 [buildExportArtifactDescriptor](../../src/export/export-artifact-descriptor.ts) 산출물 (`contentType` / `contentDisposition` / `byteSizeHint`) 을 그대로 직렬화한다 — descriptor 가 곧 materialization 의 메타 source.
- **streaming 방향**: 응답 본문으로 **직접 streaming** 하는 것이 default 다 (중간 영속 파일 0 — §Decision 2 와 정합). 대량 dump 의 chunked 전송은 §아래 helper 맞물림 절 참조.

**기존 chunk helper 와의 맞물림 (1 문단 — Acceptance Criteria 의무)**: 누적 chunk helper 4 종은 **모두 순수 산정 (산술) layer** 이며 materialization 이 그 산정값을 byte 경계로 소비한다 — (i) [buildExportChunkPlan](../../src/export/export-chunk-plan.ts) 이 `totalBytes`/`chunkSizeBytes` 로부터 각 chunk 의 `offsetBytes`/`sizeBytes` 를 산정하면, materialization 은 직렬화된 byte 를 그 경계대로 slice 해 Readable 에 `push` 한다 (helper 가 "어디서부터 몇 byte" 를, materialization 이 "실제 byte slice" 를 책임 — 책임 분리). (ii) [describeExportChunkStreamProgress](../../src/export/export-chunk-stream-progress.ts) 의 `currentRange` (content-range 수치) 를 materialization 이 `Content-Range: bytes {first}-{last}/{total}` 헤더로 직렬화한다 (helper 가 수치를, materialization 이 헤더 문자열 생성을). (iii) [buildExportChunkResumePlan](../../src/export/export-chunk-resume-plan.ts) 의 `resumeFromByte`/`remainingChunks` 가 재개 시 materialization 의 시작 offset 을 지시한다. (iv) [reconcileExportChunkIntegrity](../../src/export/export-chunk-integrity-reconcile.ts) 의 `refetchRanges` 가 손상 chunk 재요청 시 materialization 이 다시 slice 할 경계를 지시한다. 즉 **helper = 산정 (pure), materialization = 그 산정 byte 경계를 실제 Node Readable stream slice 로 실행 (impure)** 의 깔끔한 layer 분리이며, helper 들은 본 ADR 채택으로 변경 0 (이미 in-process Readable streaming 을 전제로 작성됨 — 각 helper 헤더 주석의 "후속 streaming controller 가 이 모델을 그대로 사용" 정합).

### Decision §2 — artifact 저장 위치: 응답 본문 직접 streaming = 영속 저장 0 (default), 외부 object-storage 는 별도 사용자 게이트

**채택: Export artifact 의 default 저장 위치는 "영속 저장 0" — 즉 dump 를 디스크/외부 storage 에 먼저 쓰지 않고 HTTP 응답 본문으로 직접 streaming 해 Admin 브라우저로 흘려보낸다 (on-the-fly materialization). 신규 외부 infra (S3 / MinIO / object storage SDK / 별도 파일 서버) 0. 응답 streaming 만으로 부족한 경우 (대량 dump 의 resumable 다운로드 등) 에 한해 로컬 filesystem 임시 dir + 다운로드 후 정리를 보조 옵션으로 둘 수 있으나, 이 역시 새 외부 dependency 0 (Node 내장 `fs`/`os.tmpdir()`). 외부 object-storage 로의 전환은 본 ADR 이 내리지 않으며 — 그것은 새 외부 dependency 이므로 [CLAUDE.md §5](../../CLAUDE.md) 에 따라 반드시 별도 사용자 게이트 결정 (Q-NNNN + 새 ADR) 으로 남긴다.**

저장 위치 박제 (우선순위):

- **(default) 영속 저장 0 — 응답 본문 직접 streaming**: §Decision 1 의 Node Readable 을 HTTP 응답으로 직접 pipe. dump 가 디스크에 쓰이지 않으므로 (a) 저장소 cleanup 책임 0, (b) raw/derived 데이터가 process 밖에 머무는 시간 0 (REQ-032 정합 — artifact 가 영속 저장소에 잔류하지 않음), (c) [ADR-0003 §1](ADR-0003-deployment.md) monolithic in-process 와 정합 (외부 storage hop 0). [ADR-0044](ADR-0044-export-import-job-persistence.md) 의 `ExportJob.artifactRef` 는 이 모드에서는 "생성될 다운로드의 논리 핸들 / 파일명" (예: descriptor 의 `fileName`) 을 가리키는 pointer 일 뿐, 영속 byte 본문의 위치가 아니다.
- **(보조, 필요 시) 로컬 filesystem 임시 dir + 다운로드 후 정리**: resumable 다운로드 / 재시도가 같은 byte 를 재전송해야 하는데 응답 streaming 만으로 재개 보장이 어려운 경우, Node 내장 `fs` + `os.tmpdir()` 의 임시 파일에 materialize 후 다운로드 완료 시 (또는 TTL 만료 시) 삭제한다. 새 외부 dependency 0. `artifactRef` 가 이 임시 경로를 가리킬 수 있으나, retention/cleanup 정책 (TTL / 다운로드 후 즉시 삭제) 은 후속 service task 책임 (ADR-0044 §Out of scope "job row retention / cleanup 정책" 과 정합).
- **(불가피할 때만, 별도 게이트) 외부 object-storage**: 운영 규모가 응답 streaming + 임시 dir 로 cover 안 되는 수준 (예: 다중 인스턴스 간 artifact 공유, 장기 보관 다운로드 링크) 으로 커지면 S3-호환 object storage 가 필요할 수 있다. **그것은 새 외부 dependency (object storage SDK) + 새 credential (access key) + ([ADR-0003 §4](ADR-0003-deployment.md) corporate-host 가정 변화 가능성) 를 동반하므로 본 ADR 이 채택하지 않는다** — 필요가 실측되면 별도 사용자 게이트 (Q-NNNN) + 새 ADR 로 박제한다 (§Alternatives A). 본 ADR 은 이 전환 가능성을 forward note 로만 남긴다.

### Decision §3 — 후속 구현 task 가 지켜야 할 제약 (invariant 박제)

**채택: 본 ADR 을 따르는 후속 구현 task (실 service-layer materialization 함수 / streaming pipe / REST controller / repository 게이트) 는 다음 invariant 를 강제한다.**

- **새 외부 dependency 0**: materialization·저장 어느 구현도 `package.json` 에 새 패키지 (압축 lib / object storage SDK / streaming SDK) 를 추가하지 않는다 — Node 내장 `stream`/`fs`/`os` + NestJS 내장 (`StreamableFile`) + 기존 Prisma/PostgreSQL 만. 새 dependency 가 필요해지면 그 task 는 [CLAUDE.md §5](../../CLAUDE.md) BLOCKED → 별도 사용자 게이트.
- **in-process 완결**: 별도 worker process / broker / 외부 storage hop 0 ([ADR-0003 §1](ADR-0003-deployment.md) 정합). materialization 은 controller/service 가 같은 process 에서 Readable 을 만들어 응답으로 흘려보낸다.
- **descriptor single-source**: 다운로드 메타 (fileName / contentType / Content-Length / Content-Disposition) 는 [buildExportArtifactDescriptor](../../src/export/export-artifact-descriptor.ts) 산출물을 그대로 직렬화 — controller 가 헤더값을 새로 계산하지 않는다 (drift 0).
- **chunk helper 재호출 없이 산정값만 소비**: materialization 은 `export-chunk-*` helper 가 산정한 byte 경계 (`offsetBytes`/`sizeBytes`/content-range) 를 입력으로 받아 slice 만 한다 — helper 의 산정 로직을 controller/service 가 재구현하지 않는다.
- **REQ-032 raw 미저장 보존**: materialization 입력 envelope 가 이미 raw-free 이므로, byte stream 화·임시 파일 저장 어느 단계도 raw 본문을 새로 끌어오거나 영속 저장소에 raw 를 남기지 않는다.

## Consequences

### 긍정

- **새 외부 dependency 0 / 새 infra 0 / 새 credential 0** — Node 내장 stream + NestJS 내장 + 기존 PostgreSQL/Prisma 만으로 materialization·저장이 완결돼 [CLAUDE.md §5](../../CLAUDE.md) BLOCKED 게이트를 발화하지 않는다 ([ADR-0033](ADR-0033-evaluation-result-persistence.md) 의 "새 dep 0" 선례 정합).
- **[ADR-0003 §1](ADR-0003-deployment.md) monolithic in-process 와 완전 정합** — 외부 storage hop 0, worker/broker 0. 운영 표면이 가장 작다 (single-operator long-horizon 정합).
- **REQ-032 raw 미저장 invariant 의 새 위반 표면 0** — default 가 영속 저장 0 (응답 직접 streaming) 이라 artifact 가 process 밖 저장소에 잔류하는 시간이 없다. 입력 envelope 가 raw-free 이므로 materialization 이 raw 를 끌어올 자리 자체가 없다.
- **누적 chunk helper 4 종이 변경 0 으로 그대로 배선됨** — helper 가 이미 in-process Readable streaming 을 전제로 작성돼 (각 helper 헤더 주석의 "후속 streaming controller" 정합), 본 ADR 채택이 helper 의 산정 layer 와 materialization 의 실행 layer 를 깔끔히 분리해 helper 재작업이 불요하다.
- **[ADR-0044](ADR-0044-export-import-job-persistence.md) 의 deferred piece 두 개가 닫힘** — ADR-0044 §Out of scope 이 미룬 "materialization 전략" + "artifact 저장소 mechanism" 이 본 ADR 로 확정돼 실 controller/service 배선 task 의 contract source 가 완성된다.

### 부정 / trade-off

- **응답 streaming 중 process 재시작 시 다운로드 실패** — 영속 저장 0 default 는 dump 가 디스크에 없으므로, 장시간 다운로드 중 process 가 죽으면 그 다운로드는 처음부터 재요청해야 한다 (resumable 보장이 응답 streaming 만으로는 약함). 보완은 §Decision 2 의 보조 옵션 (로컬 임시 dir) 또는 chunk resume helper 기반 재요청 — 후속 task 가 필요 시 채택.
- **외부 object-storage 미채택의 한계** — 다중 인스턴스 간 artifact 공유 / 장기 보관 다운로드 링크 / CDN 전달 같은 시나리오는 본 ADR 의 in-process 모델로 cover 안 된다. 그 요구가 실측되면 별도 게이트 + 새 ADR 이 필요하다 (의도된 범위 분할 — 새 dependency 를 본 ADR 이 끌어오지 않기 위함).
- **대량 dump 의 메모리 압박 risk** — `JSON.stringify` 가 전체 envelope 를 한 번에 직렬화하면 대량 dump 에서 메모리 spike 가능. chunk-plan 기반 chunk 단위 직렬화 (전체를 한 번에 stringify 하지 않고 record 부분집합씩) 로 완화 가능하나, 그 구체 chunk 단위 직렬화 구현은 후속 task 책임 (본 ADR 은 "Node Readable stream" 전략만 박제).
- **임시 파일 cleanup 책임** — 보조 옵션 (로컬 임시 dir) 채택 시 TTL / 다운로드 후 삭제 정책을 후속 service task 가 강제해야 한다 (미정 시 디스크 누수 risk — ADR-0044 §Out of scope "retention / cleanup 정책" 과 함께 후속).

### Cross-Module Impact

본 결정은 기존 export contract 를 바꾸지 않고 **추가** 한다 (materialization 실행 함수 + controller streaming 배선 신설 — 기존 `buildExportDump` / `buildExportArtifactDescriptor` / `export-chunk-*` helper 의 export 시그니처·반환 계약을 모두 **보존**, 변경 0). 따라서 hard rule (cross-module impact) 의 "public API / shared symbol contract 변경" 에 해당하는 파괴적 변경은 없다. 영향 module 은 **AssessmentModule 1 개로 한정** ([data-model.md §2](../architecture/data-model.md) export/import 책임 module 정합 / [ADR-0044](ADR-0044-export-import-job-persistence.md) Decision §1 — `/api/admin` = AssessmentModule controller) — `export-*` helper 를 호출하는 inbound caller 는 controller/service 신규 배선뿐이고 기존 helper 간 의존은 그대로다. ≥3 module spread 아님 → BLOCKED 미해당.

## NFR 정합 ([UC-07 §8](../use-cases/UC-07-export-import.md) "별도 설계" 와의 관계)

[UC-07 §8 NFR](../use-cases/UC-07-export-import.md) 은 "대량 dump 는 long-running operation 가능 — async job + status polling + chunked streaming + resumable upload 는 P5/P7 의 별도 설계 (Out of Scope)" 로 그 설계를 명시 deferred 했다. 본 ADR 은 **그 "별도 설계" 의 materialization·저장 부분** 을 정확히 cover 한다 — (a) **chunked streaming** 의 byte 경계는 누적 `export-chunk-*` helper 가 산정하고 본 ADR 의 §Decision 1 in-process Readable stream 이 그 경계를 실제 byte slice 로 실행한다, (b) **resumable** 다운로드는 §Decision 2 의 보조 옵션 (로컬 임시 dir) + chunk resume helper (`buildExportChunkResumePlan`) 가 cover 한다, (c) **async job + status polling** 의 진행 추적 backbone 은 [ADR-0044](ADR-0044-export-import-job-persistence.md) 의 ExportJob/ImportJob entity 가 이미 박제했고 본 ADR 의 materialization 이 그 job 의 `artifactRef` 가 가리키는 산출물을 생성한다. 즉 ADR-0044 (job 영속 backbone) + ADR-0046 (materialization·저장) + 누적 helper (chunk 산정) 가 UC-07 §8 의 "별도 설계" 를 함께 완성하며, 본 ADR 은 그 중 "envelope → byte → 다운로드 / 어디에 두나" 조각을 닫는다.

## Alternatives considered

### A. 외부 object-storage (S3 / MinIO) 즉시 도입 (미채택 — 별도 게이트로 보류)

dump artifact 를 S3-호환 object storage 에 써 두고 pre-signed URL 로 Admin 에게 다운로드 링크를 전달하는 안. 장점: 다중 인스턴스 artifact 공유 / 장기 보관 / CDN 전달 / 대량 dump 의 메모리 압박 회피. 미채택 — 이는 **새 외부 dependency (object storage SDK) + 새 credential (access key) + [ADR-0003 §4](ADR-0003-deployment.md) corporate-host 가정 변화 가능성** 를 동반하므로 [CLAUDE.md §5](../../CLAUDE.md) BLOCKED 대상이고, 사용자 Q-0042 게이트1 승인 범위 (새 dep 0 옵션) 를 벗어난다. 현 single-operator monolithic 단계 ([ADR-0003 §1](ADR-0003-deployment.md)) 에서는 응답 직접 streaming 으로 충분하므로 ROI 가 낮다. 운영 규모가 실측으로 이 안을 요구하면 그때 **별도 사용자 게이트 (Q-NNNN) + 새 ADR** 로 박제한다 — 본 ADR 은 그 전환 가능성을 forward note 로만 남긴다.

### B. dump 를 항상 로컬 filesystem 에 영속 저장 후 다운로드 (미채택)

모든 Export 를 먼저 로컬 디스크 파일로 materialize 한 뒤 그 파일을 다운로드시키는 안 (응답 직접 streaming 안 함). 장점: resumable 다운로드가 자연스럽고 process 재시작에 강하다. 미채택 — (a) artifact 가 디스크에 잔류하는 시간이 생겨 cleanup 책임 + (REQ-032 정신상) derived 데이터의 process-밖 잔류가 발생, (b) 모든 dump (작은 dump 포함) 에 디스크 write/read hop 을 강제해 default 경로가 무거워진다. 본 ADR 은 영속 저장 0 (응답 직접 streaming) 을 default 로, 로컬 임시 dir 은 resumable 이 실제로 필요한 경우의 **보조 옵션** 으로만 둔다 (§Decision 2) — 항상-영속이 아니라 필요-시-임시.

### C. 외부 직렬화/압축 라이브러리 (예: `JSONStream` / `archiver` / gzip lib) 도입 (미채택)

대량 dump 의 streaming 직렬화나 `.gz`/`.zip` 압축 archive 를 위해 외부 라이브러리를 도입하는 안. 장점: 메모리 효율적 streaming 직렬화 / 전송량 감소. 미채택 — 새 외부 dependency 이므로 [CLAUDE.md §5](../../CLAUDE.md) BLOCKED 이고 Q-0042 새-dep-0 범위 밖이다. Node 내장 `stream` + `JSON.stringify` (필요 시 chunk 단위) + (압축이 정말 필요하면) Node 내장 `zlib` 로 대부분 cover 되므로 외부 lib ROI 가 현 단계에서 낮다. 압축 archive 포맷 (`.gz`/`.zip`) 자체가 요구로 부상하면 Node 내장 `zlib` 우선 검토 후, 그래도 부족하면 별도 게이트.

## Out of scope

본 ADR 은 **두 결정 (materialization 전략 + 저장 위치) 만** 한다 — 다음은 후속 task / 별도 ADR 책임:

- **실 service-layer materialization 함수 / streaming pipe 구현** (`ExportDump` → Node Readable → HTTP 응답) — 후속 task (`commitMode: pr`).
- **REST controller 배선** (`GET /api/admin/export` streaming 응답) + repository 게이트된 실 DB query streaming — 후속 task (ADR-0044 §Follow-ups chain 과 정합).
- **chunk 단위 직렬화 구현** (대량 dump 의 메모리 압박 완화 — record 부분집합씩 stringify) — 후속 task.
- **로컬 임시 dir 채택 시 retention / cleanup (TTL / 다운로드 후 삭제) 정책** — 후속 service task (ADR-0044 §Out of scope "retention / cleanup" 과 함께).
- **외부 object-storage 도입** (S3 / MinIO) — 새 외부 dependency 이므로 별도 사용자 게이트 (Q-NNNN) + 새 ADR (§Alternatives A).
- **압축 archive 포맷** (`.gz`/`.zip`) — Node 내장 `zlib` 우선, 외부 lib 필요 시 별도 게이트 (§Alternatives C).
- **Import / Restore 측 materialization** (역직렬화 → DB load 의 transaction 전략) — [ADR-0044](ADR-0044-export-import-job-persistence.md) Decision §3 (Import atomic transaction) 이 이미 박제, 실 구현은 후속 service task.
- 코드 변경 일절 (`src/` / `test/` 수정 0) — 본 ADR 은 결정 전용.

## References

- [docs/use-cases/UC-07-export-import.md](../use-cases/UC-07-export-import.md) — §5 step5·13 (Export 다운로드) / §8 NFR (async/chunked/resumable "별도 설계" — 본 ADR 이 그 materialization·저장 부분)
- [docs/decisions/ADR-0044-export-import-job-persistence.md](ADR-0044-export-import-job-persistence.md) — ExportJob/ImportJob 영속 entity + `artifactRef` pointer + §Out of scope 이 deferred 한 "materialization·저장소" (본 ADR 의 직접 상류)
- [docs/decisions/ADR-0033-evaluation-result-persistence.md](ADR-0033-evaluation-result-persistence.md) — "새 dep 0 / 새 credential 0" 선례 + ADR template
- [docs/decisions/ADR-0003-deployment.md](ADR-0003-deployment.md) — §1 monolithic in-process (외부 storage 미전제) / §4 corporate-host 가정 (object-storage 전환 시 영향)
- [docs/decisions/ADR-0002-db.md](ADR-0002-db.md) — PostgreSQL + Prisma stack (DB streaming source)
- [src/export/export-dump.ts](../../src/export/export-dump.ts) — `ExportDump` envelope (materialization 입력)
- [src/export/export-artifact-descriptor.ts](../../src/export/export-artifact-descriptor.ts) — `ExportArtifactDescriptor` (다운로드 메타 single-source)
- [src/export/export-chunk-plan.ts](../../src/export/export-chunk-plan.ts) / [export-chunk-stream-progress.ts](../../src/export/export-chunk-stream-progress.ts) / [export-chunk-resume-plan.ts](../../src/export/export-chunk-resume-plan.ts) / [export-chunk-integrity-reconcile.ts](../../src/export/export-chunk-integrity-reconcile.ts) — chunk 경계/진행/재개/무결성 산정 helper (materialization 이 byte slice 로 소비)
- [docs/architecture/data-model.md](../architecture/data-model.md) — §2 ExportJob/ImportJob / L171 artifact 저장소 deferred (본 ADR 이 닫는 대상)
- [docs/STATE.json](../STATE.json) — Q-0042 decision (게이트1 승인 — 본 ADR 의 외력)
- [README.md](../../README.md) — REQ-030 (Export) / REQ-032 (raw 미저장)
- [CLAUDE.md §3.1 / §5 / §12](../../CLAUDE.md) — commitMode / BLOCKED 게이트 / 언어 정책

## Follow-ups

(ADR ACCEPTED 후 planner 가 dependency-free chain 으로 분해 — 각 ≤300 LOC / ≤5 파일 + R-112.)

- (후속) T-NNNN: 실 service-layer materialization 함수 (`ExportDump` → Node `Readable` stream, JSON 직렬화 + descriptor 메타) — `commitMode: pr`, Decision §1 기반.
- (후속) T-NNNN: AssessmentModule export controller (`GET /api/admin/export`) streaming 응답 배선 — descriptor 헤더 직렬화 + Readable pipe, Decision §1·§3 기반.
- (후속) T-NNNN: chunk-plan 기반 chunk 단위 직렬화 (대량 dump 메모리 압박 완화) + chunk helper (`export-chunk-*`) 실 byte slice 배선 — Decision §1 맞물림 절 기반.
- (후속) T-NNNN: (resumable 필요 시) 로컬 임시 dir materialization + retention/cleanup 정책 — Decision §2 보조 옵션.
- (후속, 별도 게이트) 외부 object-storage 가 실측으로 요구되면 Q-NNNN 사용자 게이트 + 새 ADR (§Alternatives A) — 본 ADR 이 직접 발급하지 않음.

Refs: T-0505, ADR-0044, ADR-0033, ADR-0003, ADR-0002, REQ-030, REQ-032, Q-0042
