---
id: T-1251
title: ADR — Import canonical = multipart 파일 업로드 (multer/FileInterceptor, 영속 저장 0, 크기 제한, 새 dependency 0)
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-030, REQ-032]
estimatedDiff: 150
estimatedFiles: 1
created: 2026-07-27
independentStream: import-multipart-adr
dependsOn: []
touchesFiles: [docs/decisions/ADR-0055-import-multipart-file-upload.md]
plannerNote: "P5 import chain — Q-0055 옵션(A) 승인 후 ADR-우선 첫 step. multipart 수신·영속 저장 0·크기 제한·새 dep 0 결정 박제 (ADR-0044/0046 mirror)."
---

# T-1251 — ADR: Import canonical = multipart 파일 업로드 (multer/FileInterceptor)

## Why

[Q-0055](../STATE.json) 가 오너 옵션 (A) 로 RESOLVED 됐다 — **import canonical = multipart 파일 업로드** ([T-0489](T-0489-import-controller-dto-module.md) 이 §Out of Scope 로 deferred 했던 multipart 수신을 해제). 오너가 명시한 절차는 **(1) ADR 선행 → (2) 파일 수신 배선 (FileInterceptor) + dump 파싱→실 복원 엔진 (ADR-0044 §3, runner 부재 해소) slice chain** 이다. [CLAUDE.md §1](../../CLAUDE.md) "코드보다 ADR 이 먼저" + [§3.1](../../CLAUDE.md) rule 4 (새 ADR = pr) 에 따라 본 task 는 그 chain 의 **ADR-우선 첫 step** 으로, [api.md](../architecture/api.md) 의 `POST /api/admin/import` "multipart file upload" 계약을 실제로 어떻게 수신·처리하는지 결정만 박제한다 (0 LOC 코드). [REQ-030](../requirements.md) (Import) / [REQ-032](../requirements.md) (raw 미저장) 를 cover.

## Required Reading

- [docs/decisions/ADR-0044-export-import-job-persistence.md](../decisions/ADR-0044-export-import-job-persistence.md) — §Decision §3 (Import atomic transaction all-or-nothing) + §Out of scope (multipart·복원 엔진 deferred). 본 ADR 의 직접 상류.
- [docs/decisions/ADR-0046-export-dump-materialization-storage.md](../decisions/ADR-0046-export-dump-materialization-storage.md) — 구조 mirror 대상 (§Decision 1/2/3, §Consequences, §Alternatives, §Out of scope, §Follow-ups 절 구성) + "영속 저장 0 default" 대칭 결정.
- [docs/tasks/T-0489-import-controller-dto-module.md](T-0489-import-controller-dto-module.md) — multipart 수신이 왜 deferred 됐는지 (Multer·FileInterceptor = 새 infra 표면) + `ImportJobService.createJob({ mode?, requestedById })` shape.
- [src/import/import.controller.ts](../../src/import/import.controller.ts) — 현재 `POST /api/admin/import` 이 JSON `CreateImportDto { mode? }` body 만 받고 multipart 는 주석으로 deferred 됨을 확인 (본 ADR 이 그 주석의 후속 근거).
- [docs/use-cases/UC-07-export-import.md](../use-cases/UC-07-export-import.md) — §5 Import 흐름 / §1 invariant b (atomic) / §7.5 rollback / §8 NFR (resumable upload deferred).
- `package.json` — `@nestjs/platform-express@10.4.4` 존재 확인 (multer bundled — 새 **runtime** dependency 0). `@types/multer` 는 **부재** (devDeps 에 `@types/express` 만) — 본 ADR 이 이 typing 처리 방향을 결정.
- [CLAUDE.md §3.1 / §5 / §12](../../CLAUDE.md) — commitMode / BLOCKED 게이트 (새 dependency) / 언어 정책.

## Acceptance Criteria

- [ ] `docs/decisions/ADR-0055-import-multipart-file-upload.md` 신설 (status `ACCEPTED` — Q-0055 오너 옵션 (A) 승인이 근거). frontmatter (id: ADR-0055, title, status, date, relatedTask: T-1251, relatedReq: [REQ-030, REQ-032]) + ADR-0046 와 동형 절 구성 (Context / Decision / Consequences / Alternatives considered / Out of scope / References / Follow-ups).
- [ ] **Decision §1 — 수신 mechanism**: Import canonical 입력 = multipart 파일 업로드. NestJS 내장 `FileInterceptor` + `@UploadedFile()` (`@nestjs/platform-express` 제공, multer bundled) 로 수신함을 박제. **새 runtime dependency 0** — `package.json` 에 `multer` 를 직접 추가하지 않는다 (platform-express 가 이미 bundle).
- [ ] **Decision §2 — 영속 저장 0**: 업로드 파일은 multer memoryStorage (default) 의 in-memory buffer 로 받아 파싱→복원 엔진 (ADR-0044 §3 atomic `$transaction`) 으로 직접 전달, **디스크/외부 storage 영속 저장 0** (ADR-0046 §Decision 2 export 측 "영속 저장 0" 과 대칭). REQ-032 정합 — raw/derived 가 process 밖 저장소에 잔류 0.
- [ ] **Decision §3 — 크기 제한**: `FileInterceptor` 의 `limits.fileSize` 로 업로드 크기 상한을 강제하고 초과 시 거부 (413 또는 400) 함을 박제 (구체 상한 수치는 후속 구현 task 가 config 로 결정 — 본 ADR 은 "상한 강제" invariant 만).
- [ ] **Decision §4 — 새 dependency 0 (typing 포함)**: TypeScript typing 위해 `@types/multer` 를 새 devDependency 로 추가하지 않고, 최소 local 타입 (`{ buffer: Buffer; originalname: string; size: number; mimetype: string }` 형태) 을 정의해 새 dependency 0 을 유지함을 박제. 만약 후속 구현에서 typing 이 불가피하게 `@types/multer` 를 요구하면 그것은 [CLAUDE.md §5](../../CLAUDE.md) 게이트 대상임을 명시 (본 ADR 은 zero-dep local 타입 채택을 default 로 결정).
- [ ] **§Consequences (부정)** 에 오너 지시대로 **"chain 완주 전 import UI false-success 상태"** 를 명시 — multipart 수신 배선 + 복원 엔진 slice chain 이 완주하기 전까지 import 가 실제 복원 없이 job record 만 만들어 UI 상 성공처럼 보이는 interim 상태가 존재하며, interim guard 는 후속 task 근거로 보존함을 박제.
- [ ] **§Alternatives considered** 에 최소 2 안 (예: JSON base64 inline body / 외부 object-storage pre-signed upload) 을 미채택 근거와 함께 박제.
- [ ] **§Follow-ups** 에 후속 slice chain 을 dependency-free 로 나열: (a) `FileInterceptor` + `@UploadedFile` 수신 배선 (`import.controller.ts`), (b) dump 파싱→실 복원 엔진 (ADR-0044 §3 atomic `$transaction`, runner 부재 해소), (c) 크기 제한 config + 초과 거부 분기, (d) interim false-success guard. 각 ≤300 LOC / ≤5 파일 + R-112 명시.
- [ ] `src/` / `test/` 코드 변경 0 (ADR = 결정 전용). 분기 없음 — R-112 4종 test 항목은 본 doc-only ADR 에 미적용 (production symbol 신설 0).
- [ ] `tester` 가 R-110 검증: `pnpm lint && pnpm build && pnpm test` 실행 결과 확인 (코드 변경 0 이어도 회귀 없음 확인 의무).

## Out of Scope

- **multipart 수신 실 배선** (`import.controller.ts` 에 `@UseInterceptors(FileInterceptor(...))` + `@UploadedFile()` 추가) — 후속 slice (`commitMode: pr`).
- **dump 파싱→실 복원 엔진 구현** (역직렬화 → ADR-0044 §3 atomic `$transaction` DB load, runner 부재 해소) — 후속 slice.
- **크기 제한 상한 수치 config** + 초과 거부 응답 코드 확정 — 후속 slice.
- **interim false-success guard 구현** — 후속 slice (본 ADR 은 그 근거만 §Consequences 에 박제).
- **resumable upload / chunked 수신** — UC-07 §8 NFR 이 deferred, 별도 설계.
- **외부 object-storage 도입** — 새 외부 dependency 이므로 별도 사용자 게이트 (Q-NNNN) + 새 ADR.
- ADR 번호를 ADR-0055 외 값으로 바꾸는 것 (0055 가 다음 free id — 0054 까지 점유).

## Suggested Sub-agents

`architect → tester` (architect 가 ADR 작성, tester 가 R-110 lint/build/test 확인 — 코드 변경 0).

## Follow-ups

(비어있음 — sub-agent 가 관련 작업 발견 시 append.)
