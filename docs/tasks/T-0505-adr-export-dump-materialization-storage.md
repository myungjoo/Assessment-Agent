---
id: T-0505
title: ExportDump materialization + artifact 저장 위치 결정 ADR-0044 작성
phase: P7
status: PENDING
commitMode: pr
coversReq: [REQ-030, REQ-032]
estimatedDiff: 230
estimatedFiles: 2
created: 2026-06-19
plannerNote: P7 R-57 게이트1(Q-0042 승인) — 실 service-layer 배선 chain 의 ADR-우선 첫 step; materialization 전략 + artifact 저장 위치를 새 dep 0 옵션 우선으로 결정.
---

# T-0505 — ExportDump materialization + artifact 저장 위치 결정 ADR-0044 작성

## Why

사용자가 Q-0042 를 **게이트1(실 chunked-streaming / build service-layer chain 승인)** 으로 결정했다. T-0437~T-0473 의 preview-side(dependency-free) export/import helper 잔여가 소진됐고, UC-07 §5 step 5·13 + §8 (a)(c) + §8 NFR(대량 dump chunked streaming / resumable)이 요구하는 **실 service-layer 배선**으로 진입한다. 그러나 이 chain 은 (1) 직렬화된 records 를 실제 파일/바이트로 만드는 **ExportDump materialization 전략**, (2) 만들어진 artifact 를 어디에 두는지 결정하는 **artifact 저장 위치** 라는 두 신규 infra 결정을 동반한다. CLAUDE.md §5(새 외부 dependency / 새 infra = BLOCKED 급) 와 §3.1 rule 4(새 ADR = pr-mode)에 따라, 이 chain 의 **첫 step 은 구현 코드가 아니라 두 결정을 박제하는 ADR** 이어야 한다 — 코드보다 ADR 이 먼저(CLAUDE.md §1).

본 ADR(ADR-0044)은 **새 외부 dependency 를 추가하지 않는 결정 task** 다. materialization · 저장 위치 모두 **신규 외부 infra 0 인 옵션을 우선 후보**로 박제하고(예: 기존 PostgreSQL 에서 직접 streaming / 응답 본문 in-process 직렬화 / 로컬 filesystem 임시 dir), 외부 object-storage(S3 / MinIO 등)가 불가피하다면 그것을 **별도 사용자 게이트 결정**으로 남긴다고 명시한다. 즉 후속 구현 task 가 본 ADR 의 결정을 따르되, 새 dep 도입은 본 ADR 의 결론에 포함되지 않는다.

## Required Reading

- `docs/use-cases/UC-07-export-import.md` — §5 main flow(step 5·13) / §6.1 scope 옵션 / §7.5 DB write fail / §8 postcondition + NFR(대량 dump async job + chunked streaming + resumable upload 가 P5/P7 별도 설계라고 명시한 문단) — 본 ADR 이 그 "별도 설계" 의 materialization·저장 결정 부분이다.
- `src/export/export-dump.ts` — `buildExportDump` 가 조립하는 `ExportDump` envelope(직렬화 가능한 plain object) — materialization 의 입력.
- `src/export/export-artifact-descriptor.ts` — `buildExportArtifactDescriptor` 가 산출하는 `ExportArtifactDescriptor`(fileName / contentType / byteSizeHint / contentDisposition) — 다운로드 전달 메타. materialization 산출물이 이 descriptor 와 정합해야 한다.
- `src/export/export-chunk-plan.ts` + `src/export/export-chunk-resume-plan.ts` + `src/export/export-chunk-stream-progress.ts` + `src/export/export-chunk-integrity-reconcile.ts` — 이미 박제된 chunked streaming preview helper 들(chunk 분할·재개·진행·무결성 산정). 본 ADR 의 materialization 전략이 이 helper 들과 어떻게 맞물리는지 §Decision 에 명시.
- `docs/decisions/ADR-0033-evaluation-result-persistence.md` — 기존 persistence 결정 패턴(새 dep 0 선호 + Prisma/PostgreSQL 기반)의 선례. ADR 작성 template + Consequences/Alternatives 형식 mirror.
- `docs/decisions/ADR-0003-deployment.md` — monolithic NestJS in-process 배포 전제(외부 storage 미전제) — materialization 이 in-process 흐름이어야 하는 근거.
- `CLAUDE.md` §3.1(rule 4 — 새 ADR = pr) / §5(새 infra·새 dep BLOCKED 정책).

## Acceptance Criteria

- [ ] `docs/decisions/ADR-0044-export-dump-materialization-storage.md` 신설. 표준 ADR template(Status / Context / Decision / Consequences / Alternatives) 사용. Status 는 `ACCEPTED`(사용자 Q-0042 게이트1 승인이 근거) 또는 chain 진행을 막지 않는 수준으로 박제하되, 외부 object-storage 전환은 별도 게이트로 남긴다고 Status/Decision 에 명시.
- [ ] **Decision 1 — materialization 전략**: `ExportDump` envelope 를 실제 byte stream / 다운로드 본문으로 만드는 전략을 결정. **새 외부 dependency 0 인 옵션을 우선 후보**로 박제(예: in-process `JSON.stringify` 직렬화 후 응답 본문 streaming / Node `Readable` stream 기반 chunk 생성 / 기존 PostgreSQL query 결과를 직접 streaming). 기존 chunk helper(chunk-plan / resume / progress / integrity)와의 맞물림을 1 문단으로 명시.
- [ ] **Decision 2 — artifact 저장 위치**: 만들어진 artifact 를 어디에 두는지 결정. **신규 외부 infra 0 옵션 우선**(예: 응답 본문으로 직접 streaming 해 영속 저장 0 / 로컬 filesystem 임시 dir + 다운로드 후 정리 / 기존 DB 에서 on-the-fly 생성). object-storage(S3 / MinIO 등)는 **불가피할 때만, 별도 사용자 게이트 결정으로 남긴다**고 명시(본 ADR 은 새 dep 를 추가하지 않음).
- [ ] **Consequences**: 본 결정이 후속 구현 task(실 service-layer 배선 / REST controller / repository 게이트)에 주는 제약을 열거. 새 dep 0 유지 invariant 명시.
- [ ] **Alternatives**: 채택하지 않은 옵션(외부 object-storage 즉시 도입 / 별도 파일 서버 등)과 기각 사유(새 infra BLOCKED 정책 / monolithic 전제 / 게이트 필요)를 1+ 항목씩 박제.
- [ ] UC-07 §8 NFR 의 "async job + status polling + chunked streaming + resumable upload 는 별도 설계" 문단과 본 ADR 의 정합 1 문단(본 ADR 이 그 설계의 materialization·저장 부분임을 명시).
- [ ] (선택) 결정이 architecture doc 갱신을 요구하면 `docs/architecture/data-model.md` 또는 관련 doc 에 1~2 줄 cross-reference 추가(전체 파일 ≤ 2 유지).
- [ ] 본 task 는 production code 0 LOC(ADR + doc 갱신만) — `src/` 변경 0. 따라서 R-112 의 happy/error/branch/negative 4 항목은 **N/A**(분기 있는 새 public symbol 추가 0). ADR task 임을 본문에 명시하고 R-112 항목 생략 근거를 PR 본문에 적는다.
- [ ] `tester` 가 `pnpm lint && pnpm build && pnpm test` 를 실행해 무회귀 확인(R-110 — pr-mode 는 코드 0 LOC 이어도 tester 호출 의무). 새 spec 추가 0 이므로 coverage threshold 는 기존 그대로 유지(line ≥ 80% / function ≥ 80%) — `pnpm test:cov` 통과 확인.

## Out of Scope

- 실 service-layer 구현 코드(materialization 실행 함수 / streaming pipe / repository query) — 본 ADR 의 결정을 따르는 **후속 구현 task** 책임. 본 task 는 결정만.
- REST controller(`GET /api/admin/export` / `POST /api/admin/restore`) 배선 — repository/schema 게이트된 후속.
- 새 외부 dependency 추가(S3 SDK / MinIO client / 압축 라이브러리 등) — 본 ADR 은 새 dep 를 **추가하지 않음**. object-storage 채택은 별도 사용자 게이트 결정.
- prisma schema 변경 / DB migration — 별도 게이트(CLAUDE.md §5).
- 실 chunked-streaming runtime / resumable upload 구현 — 본 ADR 이 전략을 결정하되 구현은 후속 task.
- Import / Restore 측 materialization(역직렬화 → DB load) 의 transaction 전략 — Export materialization 결정 후 별도 task(또는 본 ADR 에 대칭 결정 포함 여부는 작성자 판단, 단 cap ≤ 5 파일 / 코드 0 유지).

## Suggested Sub-agents

`architect → tester`

## Follow-ups

(작성 시 비어 있음. sub-agent 가 관련 작업 발견 시 여기에 append.)
