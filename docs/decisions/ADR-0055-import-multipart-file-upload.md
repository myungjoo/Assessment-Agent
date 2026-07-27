---
id: ADR-0055
title: "Import canonical = multipart 파일 업로드 (multer/FileInterceptor 내장 수신 + 영속 저장 0 + 크기 제한 + 새 dependency 0)"
status: ACCEPTED
date: 2026-07-27
relatedTask: T-1251
relatedReq: [REQ-030, REQ-032]
supersedes: null
---

# ADR-0055 — Import canonical = multipart 파일 업로드 (multer/FileInterceptor)

> 본 ADR 은 [Q-0055](../STATE.json) 가 **오너 옵션 (A) (import canonical = multipart 파일 업로드)** 로 RESOLVED 된 직후, 오너가 명시한 절차 **(1) ADR 선행 → (2) 파일 수신 배선 (FileInterceptor) + dump 파싱→실 복원 엔진 (ADR-0044 §3, runner 부재 해소) slice chain** 의 **dependency-free 첫 step (1)** 이다. [T-0489](../tasks/T-0489-import-controller-dto-module.md) 이 `POST /api/admin/import` 을 JSON `CreateImportDto { mode? }` body 만 받고 multipart 수신을 §Out of Scope 로 deferred (multer·FileInterceptor = 새 infra 표면) 한 상태를 회수하는 **contract source** 를 박제한다. [CLAUDE.md §1](../../CLAUDE.md) "코드보다 ADR 이 먼저" + [§3.1](../../CLAUDE.md) rule 4 (새 ADR = pr) 에 따라 본 ADR 은 **결정 전용 0 LOC** — 실 FileInterceptor 배선·파싱·복원 엔진·크기 제한 config·interim guard 구현은 본 ADR ACCEPTED 후 별도 후속 task (§Out of scope / §Follow-ups) 다.
>
> **Status `ACCEPTED` 의 근거**: 오너 Q-0055 옵션 (A) 승인이 "multipart 수신" 진행을 허가했으므로 (T-0489 §Out of Scope 의 deferral 해제) `ACCEPTED` 다. 본 ADR 은 그 승인 범위 안에서 **새 외부 dependency 0 옵션** 만 채택하므로 [CLAUDE.md §5](../../CLAUDE.md) BLOCKED 게이트를 발화하지 않는다 — 외부 object-storage 전환 등 새 dependency 를 요구하는 결정은 본 ADR 이 내리지 않고 별도 게이트로 남긴다 (§Alternatives).
>
> **ADR 번호 정합 note**: `ADR-0054` 까지 점유돼 다음 free id `ADR-0055` 로 신설한다. 본 ADR 은 [ADR-0044](ADR-0044-export-import-job-persistence.md) (export/import job 영속 backbone) + [ADR-0046](ADR-0046-export-dump-materialization-storage.md) (export 측 materialization·저장) 의 **Import 대칭 sequel** 이라 충돌이 아니라 보완이다 — ADR-0044 §Out of scope 이 deferred 한 "multipart 수신·복원 엔진" piece 중 수신 mechanism 을 닫는다.

## Context

[UC-07](../use-cases/UC-07-export-import.md) 은 Admin 이 평가 자료를 (b) **Import / Restore** (destructive write, file artifact 업로드 → DB 복원) 하는 흐름을 박제한다 ([REQ-030](../requirements.md)). [api.md](../architecture/api.md) 의 `POST /api/admin/import` 계약은 "multipart file upload" 로 명시돼 있으나, 현 [import.controller.ts](../../src/import/import.controller.ts) 는 JSON `CreateImportDto { mode? }` body 만 받고 실 파일 수신은 주석으로 deferred 돼 있다 ("multipart 파일 수신 0 — JSON CreateImportDto body 만", T-0489 §Out of Scope). 즉 job record 는 생성되나 **복원할 dump artifact 를 받을 입구 자체가 부재**하다.

핵심 외력:

- **[Q-0055 decision](../STATE.json)** — 오너가 import canonical 을 옵션 (A) multipart 파일 업로드로 확정. T-0489 이 "새 infra 표면" 을 이유로 미룬 multipart 수신의 deferral 이 이 승인으로 해제됐다. 본 ADR 이 그 chain 의 첫 결정.
- **[ADR-0044 §3](ADR-0044-export-import-job-persistence.md)** — Import atomic transaction all-or-nothing (`$transaction([deleteMany, ...create])`). 본 ADR 이 결정하는 "수신한 파일 buffer → 파싱 → 복원 엔진" 의 복원 엔진 부분이 이 §3 계약을 소비한다 (본 ADR 은 그 앞단인 "어떻게 파일을 받는가" 만 결정).
- **[ADR-0046](ADR-0046-export-dump-materialization-storage.md) §Decision 2** — export 측 "영속 저장 0 default" (응답 본문 직접 streaming, 디스크/외부 storage 잔류 0). 본 ADR 은 그 **대칭** — import 측도 업로드 파일을 디스크에 먼저 쓰지 않고 in-memory buffer 로 받아 곧장 복원 엔진에 전달하는 "영속 저장 0" 을 default 로 채택.
- **[package.json](../../package.json)** — `@nestjs/platform-express@10.4.4` 가 **이미 dependency 로 존재** (multer bundled). 따라서 multipart 수신에 **새 runtime dependency 0**. 단 `@types/multer` 는 devDeps 에 **부재** (`@types/express@5.0.0` 만 존재) — 본 ADR 이 이 typing 처리 방향을 §Decision 4 로 결정.
- **[CLAUDE.md §5](../../CLAUDE.md)** — 새 외부 dependency 는 BLOCKED. 본 결정은 runtime·typing 모두 새 dependency 0 을 채택해 이 게이트를 발화하지 않는다.
- **REQ-032** — raw 미저장. 업로드 파일이 디스크/외부 storage 에 영속 저장되지 않고 in-memory buffer 로만 처리돼 (§Decision 2), raw/derived 가 process 밖 저장소에 잔류하지 않는다.

본 ADR 은 **import 파일 수신 mechanism (수신 방식 + 저장 정책 + 크기 제한 + typing) 만** decide 하며, 실 배선·파싱·복원 엔진 구현은 후속 task 로 분리해 size cap (≤300 LOC / ≤5 파일) 을 지킨다.

## Decision

### Decision §1 — 수신 mechanism: multipart 파일 업로드 (NestJS 내장 FileInterceptor, 새 runtime dependency 0)

**채택: Import canonical 입력 = multipart 파일 업로드. NestJS 내장 `FileInterceptor` (`@UseInterceptors(FileInterceptor("file", {...}))`) + `@UploadedFile()` 파라미터 데코레이터로 수신한다. 이 둘은 [@nestjs/platform-express](../../package.json) (multer bundled, 이미 dependency) 가 제공하므로 `package.json` 에 `multer` 를 직접 추가하지 않는다 — 새 runtime dependency 0.**

전략 박제:

- **수신 form**: `POST /api/admin/import` 이 `multipart/form-data` 로 dump artifact 파일 1개 (필드명 예: `file`) + 기존 `mode?` (form field 또는 별도 처리) 를 받는다. `@UploadedFile()` 이 multer 가 파싱한 파일 객체를, `@Body()` (또는 form field) 가 `mode` 를 controller 에 전달한다. 구체 필드 조합·DTO 재배치 form 은 후속 배선 task 결정, 본 ADR 은 "FileInterceptor + @UploadedFile 수신" mechanism 만 박제.
- **provider 위임**: multipart 파싱은 multer 가 `@nestjs/platform-express` 안에서 수행 — 본 프로젝트는 직접 multer API 를 호출하지 않고 NestJS 추상화 (`FileInterceptor`) 만 사용한다. multer 는 platform-express 의 transitive dependency 로 이미 lockfile 에 존재하므로 별도 설치 0.
- **RBAC 보존**: 기존 controller 의 `@UseGuards(JwtAuthGuard, RolesGuard)` + `@Roles("Admin")` stack (T-0489) 은 그대로 — multipart 수신 추가가 인증/권한 결정을 바꾸지 않는다 (REQ-045 Admin 전용 불변).

### Decision §2 — 영속 저장 0: multer memoryStorage in-memory buffer → 복원 엔진 직접 전달 (ADR-0046 대칭)

**채택: 업로드 파일은 multer 의 default `memoryStorage` 로 받아 in-memory `Buffer` (`file.buffer`) 로 controller/service 에 전달하고, 파싱→복원 엔진 ([ADR-0044 §3](ADR-0044-export-import-job-persistence.md) atomic `$transaction`) 으로 **직접** 넘긴다. 디스크/외부 storage 에 영속 저장 0 — [ADR-0046 §Decision 2](ADR-0046-export-dump-materialization-storage.md) 의 export 측 "영속 저장 0" 과 대칭이다.**

- **default = memoryStorage**: `FileInterceptor` 에 diskStorage 를 지정하지 않으면 multer 는 memoryStorage 를 쓴다 — 업로드 본문이 `file.buffer` (Node `Buffer`) 로만 존재하고 요청 처리가 끝나면 GC 대상이 된다. 디스크 임시 파일 0, 외부 storage hop 0.
- **REQ-032 정합**: raw/derived 데이터가 process 밖 저장소 (디스크/object storage) 에 잔류하는 시간이 0 이다. 업로드 buffer 는 파싱→`$transaction` 복원에 소비된 뒤 메모리에서 사라진다 ([ADR-0046 §Decision 2](ADR-0046-export-dump-materialization-storage.md) 의 "process 밖 잔류 0" 대칭).
- **in-process 완결**: 별도 worker / 외부 storage 없이 같은 process 의 controller→service→Prisma `$transaction` 으로 복원이 완결된다 ([ADR-0003 §1](ADR-0003-deployment.md) monolithic in-process 정합, ADR-0046 과 동일 근거).
- **대용량 trade-off**: memoryStorage 는 파일 전체를 메모리에 올리므로 대용량 dump 에서 메모리 압박이 있을 수 있다 — 이 완화 (streaming 파싱 / diskStorage 임시 파일) 는 §Consequences 부정 + §Follow-ups 로 후속 task 에 남긴다. 크기 상한 (§Decision 3) 이 1차 방어선이다.

### Decision §3 — 크기 제한: FileInterceptor limits.fileSize 상한 강제 + 초과 거부

**채택: `FileInterceptor` 의 `limits.fileSize` 옵션으로 업로드 크기 상한을 강제하고, 초과 시 요청을 거부한다 (413 Payload Too Large 또는 400 Bad Request). 구체 상한 수치는 후속 구현 task 가 config (env / 상수) 로 결정하며, 본 ADR 은 "상한이 반드시 강제된다" invariant 만 박제한다.**

- **강제 지점**: `FileInterceptor("file", { limits: { fileSize: <상한> } })`. multer 가 상한 초과를 감지하면 error 를 던지고, NestJS exception filter 가 이를 4xx (413 권장 — Payload Too Large, 또는 400) 로 변환한다. 구체 응답 코드 확정은 후속 task.
- **왜 상한이 필수인가**: 상한 없는 memoryStorage (§Decision 2) 는 무제한 업로드가 프로세스 메모리를 소진시키는 DoS 표면이 된다. 상한 강제가 §Decision 2 memoryStorage 채택의 안전 전제다.
- **본 ADR 범위**: 수치·응답 코드·초과 시 job status 처리 (FAILED 기록 여부 등) 는 후속 config task (§Follow-ups (c)). 본 ADR 은 "limits.fileSize invariant 존재" 만 결정.

### Decision §4 — 새 dependency 0 (typing 포함): zero-dep local 타입 채택

**채택: multer 가 넘기는 파일 객체의 TypeScript typing 을 위해 `@types/multer` 를 새 devDependency 로 추가하지 않는다. 대신 후속 배선 task 가 필요한 최소 필드만 담은 local 타입 (예: `interface UploadedDumpFile { buffer: Buffer; originalname: string; size: number; mimetype: string }`) 을 정의해 새 dependency 0 을 유지한다.**

- **local 타입 근거**: 복원 엔진이 실제로 소비하는 필드는 `buffer` (파싱 입력) + 진단/검증용 `originalname`/`size`/`mimetype` 정도로 좁다. `@types/multer` 전체 (`Express.Multer.File` 전 필드) 를 끌어올 필요가 없으므로, 최소 local interface 로 충분하며 이것이 새 devDependency 0 을 유지하는 default 다.
- **불가피 시 게이트**: 만약 후속 구현에서 typing 이 불가피하게 `@types/multer` 를 요구한다고 판명되면 (예: 여러 파일 / diskStorage metadata 등 넓은 표면 필요), 그 devDependency 추가는 [CLAUDE.md §5](../../CLAUDE.md) 새 dependency 게이트 대상임을 명시한다 — 본 ADR 은 그 경우에도 **zero-dep local 타입 채택을 default 결정** 으로 두고, `@types/multer` 는 default 를 벗어날 때만 별도 판단한다.
- **`@types/express` 재사용 가능성**: 이미 존재하는 `@types/express@5.0.0` 이 `Express.Multer.File` 을 augment 로 노출하는지 여부는 버전 의존적이라 본 ADR 은 이에 의존하지 않는다 — local 타입이 버전 독립적이고 표면이 가장 작아 default 다.

## Consequences

### 긍정

- **새 runtime dependency 0 / 새 devDependency 0 / 새 credential 0** — `@nestjs/platform-express` (multer bundled) 가 이미 존재하고 typing 은 local 타입으로 처리해 [CLAUDE.md §5](../../CLAUDE.md) BLOCKED 게이트를 발화하지 않는다 ([ADR-0046](ADR-0046-export-dump-materialization-storage.md)/[ADR-0033](ADR-0033-evaluation-result-persistence.md) "새 dep 0" 선례 정합).
- **[ADR-0046](ADR-0046-export-dump-materialization-storage.md) 과 export/import 대칭 완성** — export 는 응답 직접 streaming (영속 저장 0), import 는 memoryStorage buffer 직접 복원 (영속 저장 0) 으로 양방향 모두 process 밖 잔류 0 이 되어 REQ-032 invariant 가 대칭으로 보존된다.
- **[ADR-0044 §3](ADR-0044-export-import-job-persistence.md) 복원 엔진의 입력 계약 확정** — "어떻게 파일을 받아 buffer 로 만드는가" 가 결정돼, ADR-0044 §Out of scope 이 미룬 multipart 수신 piece 가 닫히고 복원 엔진 후속 task 의 상류 contract 가 완성된다.
- **크기 상한이 데이터 모델 차원에서 명문화** — memoryStorage 채택의 DoS 표면이 §Decision 3 상한 invariant 로 사전 차단돼, 후속 구현 task 가 상한 없이 배선할 표면이 생기지 않는다.
- **기존 controller RBAC / job 생성 흐름 보존** — T-0489 의 guard stack·job record 생성 로직을 바꾸지 않고 수신 입구만 추가하므로 cross-module 파괴 변경 0.

### 부정 / trade-off

- **chain 완주 전 import UI false-success 상태** (오너 지시 명시 박제) — multipart 수신 배선 (§Follow-ups (a)) + dump 파싱→실 복원 엔진 (§Follow-ups (b), ADR-0044 §3 runner 부재 해소) slice chain 이 **완주하기 전까지** import 는 파일을 받아도 실제 DB 복원 없이 `ImportJob` record (status=PENDING) 만 만들어 UI 상 성공처럼 보이는 **interim 상태** 가 존재한다. 이 interim 구간의 guard (예: 복원 엔진 미배선 동안 명시적 "미구현/비활성" 응답 또는 job 을 SUCCEEDED 로 오표기하지 않기) 는 후속 task (§Follow-ups (d)) 근거로 본 §Consequences 에 보존한다 — 본 ADR 자체는 guard 를 구현하지 않고 그 필요성만 박제.
- **memoryStorage 대용량 메모리 압박** — §Decision 2 memoryStorage 는 파일 전체를 메모리에 올려 대용량 dump 에서 메모리 spike 가능. 1차 방어는 §Decision 3 크기 상한이고, 근본 완화 (streaming 파싱 / diskStorage 임시 파일 + cleanup) 는 후속 task — [ADR-0046 §Decision 2](ADR-0046-export-dump-materialization-storage.md) 보조 옵션 (로컬 임시 dir) 대칭.
- **local 타입 유지보수 비용** — `@types/multer` 대신 local interface 를 쓰므로 multer 파일 객체 표면이 넓어지면 local 타입을 손봐야 한다. 표면이 좁게 유지되는 한 (buffer 중심) 비용이 낮으나, 넓어지면 §Decision 4 의 `@types/multer` 게이트 판단이 재소환된다.

### Cross-Module Impact

본 결정은 기존 import contract 를 바꾸지 않고 **추가** 한다 (FileInterceptor 수신 + buffer 전달 배선 신설 — 기존 `ImportJobService` / `ImportController` guard stack·job 생성 시그니처를 **보존**). 영향 module 은 **AssessmentModule (import 책임) 1 개로 한정** ([ADR-0044 §1](ADR-0044-export-import-job-persistence.md) `/api/admin` = AssessmentModule controller 정합) — ≥3 module spread 아님 → BLOCKED 미해당. `package.json` 변경 0 (multer bundled, typing local).

## Alternatives considered

### A. JSON base64 inline body (파일을 base64 문자열로 JSON body 에 인라인) (미채택)

`POST /api/admin/import` 이 `{ mode?, dump: "<base64>" }` 처럼 dump 를 base64 문자열로 JSON body 에 담아 받는 안 (multipart 0, 기존 JSON 흐름 유지). 장점: T-0489 의 JSON body 흐름을 거의 그대로 재사용, multer/FileInterceptor 무배선. 미채택 — (a) base64 는 원본 대비 ~33% payload 팽창 + 인코딩/디코딩 CPU 비용, (b) 대용량 dump 를 JSON body 로 받으면 body parser 의 메모리·크기 제한과 이중으로 얽혀 크기 상한 제어가 지저분해진다, (c) [api.md](../architecture/api.md) 계약이 이미 "multipart file upload" 로 명시돼 있어 base64 는 계약 drift. 오너 Q-0055 옵션 (A) 도 multipart 를 canonical 로 확정했으므로 base64 는 그 결정과 부정합.

### B. 외부 object-storage pre-signed upload (S3/MinIO 로 직접 업로드 후 key 전달) (미채택 — 별도 게이트)

Admin 브라우저가 파일을 S3-호환 object storage 에 pre-signed URL 로 직접 업로드하고, `POST /api/admin/import` 에는 object key 만 넘겨 서버가 그 key 로 dump 를 가져와 복원하는 안. 장점: 서버 메모리 압박 회피 / 대용량·resumable 업로드 자연스러움 / 다중 인스턴스 공유. 미채택 — 이는 **새 외부 dependency (object storage SDK) + 새 credential (access key) + [ADR-0003 §4](ADR-0003-deployment.md) corporate-host 가정 변화** 를 동반하므로 [CLAUDE.md §5](../../CLAUDE.md) BLOCKED 대상이고, Q-0055 옵션 (A) (multipart) 범위를 벗어난다. 현 single-operator monolithic 단계에서는 multipart + memoryStorage + 크기 상한으로 충분하므로 ROI 가 낮다 — [ADR-0046 §Alternatives A](ADR-0046-export-dump-materialization-storage.md) (export 측 object-storage 보류) 와 대칭으로, 필요가 실측되면 별도 사용자 게이트 (Q-NNNN) + 새 ADR 로 박제한다.

## Out of scope

본 ADR 은 **수신 mechanism (수신 방식 + 저장 정책 + 크기 제한 invariant + typing 방향) 만** 결정한다 — 다음은 후속 task / 별도 ADR 책임:

- **multipart 수신 실 배선** (`import.controller.ts` 에 `@UseInterceptors(FileInterceptor("file", {...}))` + `@UploadedFile()` 추가 + DTO 재배치) — 후속 slice (`commitMode: pr`).
- **dump 파싱→실 복원 엔진 구현** (buffer 역직렬화 → [ADR-0044 §3](ADR-0044-export-import-job-persistence.md) atomic `$transaction` DB load, runner 부재 해소) — 후속 slice.
- **크기 제한 상한 수치 config** + 초과 거부 응답 코드 (413/400) 확정 + 초과 시 job status 처리 — 후속 slice.
- **interim false-success guard 구현** (복원 엔진 미배선 동안 import 를 성공으로 오표기하지 않기) — 후속 slice (본 ADR 은 §Consequences 부정에 근거만 박제).
- **memoryStorage 대용량 완화** (streaming 파싱 / diskStorage 임시 파일 + retention/cleanup) — 후속 task (필요 실측 시, [ADR-0046 §Decision 2](ADR-0046-export-dump-materialization-storage.md) 보조 옵션 대칭).
- **resumable upload / chunked 수신** — [UC-07 §8 NFR](../use-cases/UC-07-export-import.md) deferred, 별도 설계.
- **외부 object-storage 도입** (S3/MinIO) — 새 외부 dependency 이므로 별도 사용자 게이트 (Q-NNNN) + 새 ADR (§Alternatives B).
- 코드 변경 일절 (`src/` / `test/` 수정 0) — 본 ADR 은 결정 전용.

## References

- [docs/use-cases/UC-07-export-import.md](../use-cases/UC-07-export-import.md) — §5 Import 흐름 / §1 invariant b (atomic) / §7.5 rollback / §8 NFR (resumable upload deferred)
- [docs/decisions/ADR-0044-export-import-job-persistence.md](ADR-0044-export-import-job-persistence.md) — §3 Import atomic `$transaction` (본 ADR 이 결정하는 수신 buffer 의 하류 복원 계약) + §Out of scope (multipart 수신 deferred — 본 ADR 이 닫는 대상)
- [docs/decisions/ADR-0046-export-dump-materialization-storage.md](ADR-0046-export-dump-materialization-storage.md) — 구조 mirror + §Decision 2 "영속 저장 0" (본 ADR §Decision 2 의 import 대칭 source)
- [docs/decisions/ADR-0033-evaluation-result-persistence.md](ADR-0033-evaluation-result-persistence.md) — "새 dep 0 / 새 credential 0" 선례
- [docs/decisions/ADR-0003-deployment.md](ADR-0003-deployment.md) — §1 monolithic in-process (외부 storage 미전제 — memoryStorage in-process 복원 근거)
- [docs/tasks/T-0489-import-controller-dto-module.md](../tasks/T-0489-import-controller-dto-module.md) — multipart 수신이 왜 deferred 됐는지 + `ImportJobService.createJob({ mode?, requestedById })` shape
- [src/import/import.controller.ts](../../src/import/import.controller.ts) — 현 JSON-only `POST /api/admin/import` (본 ADR 이 그 deferred 주석의 후속 근거)
- [docs/architecture/api.md](../architecture/api.md) — `POST /api/admin/import` "multipart file upload" 계약 (본 ADR 이 수신 방식 확정)
- [package.json](../../package.json) — `@nestjs/platform-express@10.4.4` (multer bundled — 새 runtime dep 0) / `@types/multer` 부재 (§Decision 4 typing 방향)
- [docs/STATE.json](../STATE.json) — Q-0055 decision (오너 옵션 (A) 승인 — 본 ADR 의 외력)
- [README.md](../../README.md) — REQ-030 (Import) / REQ-032 (raw 미저장)
- [CLAUDE.md §3.1 / §5 / §12](../../CLAUDE.md) — commitMode / BLOCKED 게이트 (새 dependency) / 언어 정책

## Follow-ups

(ADR ACCEPTED 후 planner 가 dependency-free chain 으로 분해 — 각 ≤300 LOC / ≤5 파일 + R-112 (happy + error + branch + negative 충분 cover).)

- (후속) (a) T-NNNN: `import.controller.ts` 에 `@UseInterceptors(FileInterceptor("file", {...}))` + `@UploadedFile()` 수신 배선 + DTO 재배치 — `commitMode: pr`, §Decision 1 기반. R-112: multipart 정상 수신 / 파일 누락 (400) / 비 Admin (403) / 미인증 (401) test.
- (후속) (b) T-NNNN: dump buffer 파싱 → 실 복원 엔진 (역직렬화 → ADR-0044 §3 atomic `$transaction` DB load, runner 부재 해소) — §Decision 2 기반. R-112: 정상 복원 / 손상 dump 파싱 실패 / 부분 실패 rollback (all-or-nothing) regression test.
- (후속) (c) T-NNNN: 크기 제한 config (`limits.fileSize` 상한 수치 env/상수) + 초과 거부 분기 (413/400) + 초과 시 job status 처리 — §Decision 3 기반. R-112: 상한 이하 통과 / 상한 초과 거부 / 경계값 test.
- (후속) (d) T-NNNN: interim false-success guard (복원 엔진 미배선 동안 import 를 성공으로 오표기하지 않기) — §Consequences 부정 근거. R-112: guard active 시 명시적 미구현/비활성 응답 / job status 오표기 안 됨 test.

Refs: T-1251, ADR-0044, ADR-0046, ADR-0033, ADR-0003, REQ-030, REQ-032, Q-0055
