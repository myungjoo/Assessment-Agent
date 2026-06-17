---
id: T-0479
title: UC-07 §8 NFR chunked streaming 부분 손상 재요청의 재시도 예산(최대 시도 수·사용 시도 수) 잔여·소진·추가 재시도 허용 여부를 순수 산술로 derive 하는 helper deriveExportChunkRefetchRetryBudget
phase: P7
status: PENDING
commitMode: pr
coversReq: [REQ-030, REQ-032, REQ-045]
estimatedDiff: 190
estimatedFiles: 2
created: 2026-06-17
independentStream: uc07-export-import-helpers
dependsOn: []
touchesFiles:
  - src/export/export-chunk-refetch-retry-budget.ts
  - src/export/export-chunk-refetch-retry-budget.spec.ts
hqOrigin: null
plannerNote: "P7 UC-07 §8 NFR — export-streaming throughput/progress·refetch-batch(coalesce/savings/fragmentation/gap) 공간 포화. 잔여 gate-free gap = 재시도 예산 산술: coalesce/savings/reconcile 가 모두 '재시도 정책·backoff 0' 명시, retryable 은 boolean 분류뿐 — 최대/사용 시도 수로 잔여·소진·추가 재시도 허용 derive 0회 cover(git grep RetryBudget|attemptsRemaining|maxAttempts 0). pr·게이트-free·dependsOn []."
---

# T-0479 — UC-07 §8 NFR chunked streaming 재요청 재시도 예산 잔여·소진 산술 순수 helper deriveExportChunkRefetchRetryBudget

## Why

UC-07 §8 NFR 은 대량 dump 를 "async job + status polling + **chunked streaming**" 으로 전달하며, 전송 중 일부 chunk 가 손상되면 **재요청(refetch)** 으로 부분 복구한다. 기존 refetch 도메인 helper 들 — `coalesceExportChunkRefetch`(T-0473)·`summariseExportChunkRefetchSavings`(T-0474)·`Fragmentation`(T-0475)·`Gaps`(T-0476)·`reconcileExportChunkIntegrity`(T-0472) — 은 **모두 주석에 "재시도 정책·backoff 0" 을 명시**하며, 어느 chunk 가 어느 byte 범위로 몇 번의 요청으로 재전송돼야 하는지(공간 차원)만 다룬다. `import-restore-failure-message`(T-0474 외)의 `retryable` 은 사유가 일시적 장애인지의 **boolean 분류**일 뿐, *몇 번까지 재시도할 수 있는가*(횟수 차원)는 누구도 derive 하지 않는다.

운영자/streaming 클라이언트는 무한 재요청을 허용할 수 없다 — **재시도 예산(retry budget)** 안에서만 부분 복구를 반복해야 한다. 즉 "최대 N회까지 재요청 허용, 이미 M회 사용" 으로부터 **잔여 시도 수**(attemptsRemaining), **예산 소진 여부**(exhausted), **추가 재요청 허용 여부**(canRetry: 잔여 > 0 이면서 복구할 손상 chunk 가 남아 있을 때만), **예산 소비율**(usageRatio·usagePercent), **마지막 시도 여부**(lastAttempt: 잔여가 정확히 1) 를 순수 산술로 산정해야 한다. 이는 streaming 재요청 루프가 "더 재시도할지/포기하고 실패 처리할지" 를 결정하는 입력이 된다.

이 재시도 예산 산술 도메인은 42 helper(T-0437~T-0478) 중 0 회 cover 된 gap 이며, refetch-batch 공간(coalesce/savings/fragmentation/gap)·throughput series(T-0478) 와 직교한다(`git grep -iwl "RetryBudget\|attemptsRemaining\|attemptsUsed\|maxAttempts\|retriesLeft\|exhausted" src/export` → 0 매칭 확인). 실 재전송·타이머·backoff 지연 계산·시계 read 0 — 예산 수치(최대/사용 시도 수)와 잔여 손상 chunk 수는 caller 가 전달하고, 본 helper 는 산술 derive 만 한다.

## Required Reading

- `docs/use-cases/UC-07-export-import.md` §8 (NFR — async job + status polling + chunked streaming) + 부분 손상 재요청 흐름
- `src/export/export-chunk-refetch-savings.ts` — `isPlainObject` / `describeNonObject` / `isValidNonNegativeInteger` 입력 방어 + 한국어 message convention + non-mutating·결정성·한국어 headline 패턴 mirror 대상. 본 helper 는 그와 직교(절감률이 아니라 재시도 횟수 예산) — savings 를 재호출하지 않는다.
- `src/export/export-chunk-stream-throughput.ts` — 단일 입력 객체로부터 파생 필드를 derive 하는 순수 helper 코드 골격 mirror 대상(처리율 재산정 금지 — 본 helper 는 예산 산술만).
- `CLAUDE.md` §3.2 (R-112 4종 test 의무) + §12 (언어 정책 — 식별자 영어, 메시지·주석 한국어)

## Acceptance Criteria

- [ ] `src/export/export-chunk-refetch-retry-budget.ts` 신설. 신규 도메인 타입 신설: `ExportChunkRefetchRetryBudgetInput`(plain object: `maxAttempts: number`(허용된 최대 재요청 시도 수 — 비-음수 정수; 0 이면 재시도 자체 미허용), `attemptsUsed: number`(이미 사용한 시도 수 — 비-음수 정수), `failedChunkCount: number`(아직 복구되지 않은 손상 chunk 수 — 비-음수 정수; 0 이면 복구할 대상 없음))와 결과 타입 `ExportChunkRefetchRetryBudget`(plain object: `maxAttempts: number`, `attemptsUsed: number`, `failedChunkCount: number`(입력 echo), `attemptsRemaining: number`(= max(0, maxAttempts - attemptsUsed)), `exhausted: boolean`(= attemptsRemaining === 0), `canRetry: boolean`(= attemptsRemaining > 0 && failedChunkCount > 0), `lastAttempt: boolean`(= attemptsRemaining === 1), `usageRatio: number`(= maxAttempts === 0 ? 0 : min(1, attemptsUsed / maxAttempts) 의 0~1 소수), `usagePercent: number`(= Math.round(usageRatio * 100) 의 0~100 정수), `headline: string`(한국어 한 줄 — 잔여/최대 시도·추가 재시도 허용 여부·소진 여부 요약)). 옵션 타입은 신설하지 않음.
- [ ] `deriveExportChunkRefetchRetryBudget(input)` 순수 함수: 위 필드를 단일 산술 패스로 derive. 불변(invariant): `0 <= attemptsRemaining <= maxAttempts`, `exhausted === (attemptsRemaining === 0)`, `lastAttempt === (attemptsRemaining === 1)`, `canRetry === (attemptsRemaining > 0 && failedChunkCount > 0)`, `0 <= usageRatio <= 1`, `usagePercent === Math.round(usageRatio * 100)`, `exhausted ⟹ canRetry === false`, `failedChunkCount === 0 ⟹ canRetry === false`. non-mutating(입력 객체 변형 0, 반환 객체 항상 새 것). 동일 입력 2회 호출은 동등 결과(순수·결정성).
- [ ] 경계 입력 처리: `attemptsUsed > maxAttempts`(예산 초과 사용 — clamp) → attemptsRemaining=0·exhausted=true·canRetry=false·usageRatio=1(clamp). `maxAttempts === 0`(재시도 미허용) → attemptsRemaining=0·exhausted=true·canRetry=false·usageRatio=0·usagePercent=0. `attemptsUsed === 0`(미사용) → attemptsRemaining=maxAttempts·usageRatio=0. 잔여 1(lastAttempt=true) vs 잔여 ≥ 2 분기. failedChunkCount=0(복구 대상 없음) → 잔여가 남아도 canRetry=false. 각 경계를 spec 으로 명시 검증.
- [ ] 입력 방어: `input` 이 plain object 아님(null/배열/원시값) → 한국어 `TypeError`(label "input"·받은 값 박제). `input.maxAttempts` / `input.attemptsUsed` / `input.failedChunkCount` 중 비-음수 유한 정수 아님(음수·NaN·Infinity·소수·비-number 각각) → `TypeError`(label·받은 값 박제). 각 위반 종류마다 spec 으로 박제·일관 적용.
- [ ] **Happy-path unit test**: 정상 예산(maxAttempts=3·attemptsUsed=1·failedChunkCount=2 → attemptsRemaining=2·canRetry=true·lastAttempt=false·usagePercent=33), 미사용 예산(attemptsUsed=0 → usageRatio=0·attemptsRemaining=maxAttempts), 마지막 시도(attemptsRemaining=1 → lastAttempt=true·canRetry=true), 손상 없음(failedChunkCount=0 → canRetry=false), headline 한국어 내용 검증 test 각 1+ (총 5+ happy test).
- [ ] **Error path unit test**: input 비-object / maxAttempts 비-음수정수 아님(음수·NaN·Infinity·소수·비-number 각각) / attemptsUsed 비-음수정수 아님 / failedChunkCount 비-음수정수 아님 각각에 대해 throw 검증 test 1+ (메시지 label·받은 값 포함 확인). 단일 negative 만 작성 금지 — 부적합 입력 종류마다 분리.
- [ ] **Flow / branch 분리 test**: maxAttempts === 0 분기(재시도 미허용) vs > 0 분기, attemptsUsed > maxAttempts clamp 분기 vs 정상 분기, exhausted true(잔여 0) vs false 분기, canRetry true(잔여>0 && 손상>0) vs false 의 두 false 경로(잔여 0 / 손상 0) 각각, lastAttempt true(잔여 1) vs false(잔여 0·잔여 ≥2) 분기, usageRatio clamp(used>max → 1) vs 비-clamp 분기 각 1+ test.
- [ ] **Negative cases 충분 cover**: `0 <= attemptsRemaining <= maxAttempts`, `exhausted === (attemptsRemaining === 0)`, `lastAttempt === (attemptsRemaining === 1)`, `canRetry === (attemptsRemaining > 0 && failedChunkCount > 0)`, `0 <= usageRatio <= 1`, `exhausted ⟹ canRetry === false`, `failedChunkCount === 0 ⟹ canRetry === false` 를 미허용·미사용·정상·초과사용·마지막시도·손상없음 케이스 전수로 검증하는 test 1+, non-mutating(입력 객체 deepFreeze 통과 + 반환 객체가 호출마다 새 인스턴스 — 두 호출 결과 `!==` 이면서 deep-equal) 검증 1+.
- [ ] `src/export/export-chunk-refetch-retry-budget.spec.ts` colocated spec 으로 위 test 작성(NestJS convention).
- [ ] `pnpm lint && pnpm build && pnpm test` 통과.
- [ ] `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80% — 신규 파일은 100% 목표).

## Out of Scope

- 재요청 byte 범위 병합·열거·절감률·byte gap·범위 분산 — `coalesceExportChunkRefetch`(T-0473)/`summariseExportChunkRefetchSavings`(T-0474)/`Fragmentation`(T-0475)/`Gaps`(T-0476)의 책임. 본 helper 는 재시도 *횟수* 예산만(공간 차원과 직교 — refetch-batch 도메인 재호출·재구현 금지).
- backoff 지연 시간(exponential/jitter) 계산·다음 재시도 시각 산정·타이머·`Date.now()`·`setTimeout` 등 실 시계·스케줄 read(시계 read 0 — 예산 수치는 caller 가 전달).
- 재시도 사유가 일시적/영구인지의 분류(retryable) — `import-restore-failure-message` 의 책임. 본 helper 는 횟수 예산만(사유 분류 0).
- 처리율·진행·정체·ETA 산정 — `estimateExportChunkStreamThroughput`(T-0477)/`summariseExportChunkThroughputSeries`(T-0478)/`describeExportChunkStreamProgress`(T-0470)의 책임.
- 무결성 검증 / digest / checksum / 어느 chunk 가 손상됐는지 판정 — `reconcileExportChunkIntegrity`(T-0472)의 책임. 본 helper 는 입력으로 받은 failedChunkCount 수치만 사용(무결성 source 0).
- 실 재전송 / HTTP Range·206 Partial Content / SSE·long-poll / 요청 발행 / repository·transaction 배선 — P5 service/controller layer(repository 게이트).
- REST controller / endpoint / HTTP 상태 mapping / WebUI 재시도 버튼·안내 컴포넌트 렌더 — repository·WebUI 게이트 후속.
- 새 외부 dependency 추가 금지.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(없음 — 생성 시점)
