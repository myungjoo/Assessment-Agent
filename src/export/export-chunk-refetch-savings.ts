// export-chunk-refetch-savings — UC-07 §8 NFR chunked streaming 재요청 coalescing(T-0473)이
// 절감한 HTTP Range 요청 수·절감률을 정량화하는 순수 helper (T-0474, P7 / REQ-030 / REQ-032 /
// REQ-045). 직전 coalesceExportChunkRefetch(T-0473)는 수신측 무결성 reconcile 의 연속(인접 index)
// 실패 chunk 들을 하나의 byte 범위로 *병합*한 재요청 batch(ExportChunkRefetchBatch{rangeCount,
// failedChunkCount, refetchBytes, ranges})를 산정한다. 즉 병합 *후* 의 범위 개수(rangeCount)와 병합
// *전* 의 실패 chunk 개수(failedChunkCount)를 모두 노출하지만, *병합이 실제로 절감한 HTTP Range 요청
// 수*(failedChunkCount - rangeCount)·*절감률*·그 효율 이득을 사람이 읽을 수 있는 view 로 *정량화*하는
// 합성은 37 helper 중 0 회 cover 된 gap 이다(git grep savings|Savings|reduction|requestsSaved|
// requestCount|requestsEliminated src/export → 0 매칭).
//
// coalesceExportChunkRefetch 가 재요청 범위를 *병합·열거*한다면, 본 helper 는 그와 직교(orthogonal)
// — 이미 산출된 ExportChunkRefetchBatch 를 받아 *병합으로 제거된 요청 수*(requestsSaved =
// failedChunkCount - rangeCount), *절감률*(savingsRatio = requestsSaved / failedChunkCount, 백분율),
// 효율 등급(절감 없음 / 부분 / 전부 1요청 통합 = fullyCoalesced)을 순수 산술로 derive 한다(실
// 재전송·byte slice·HTTP Range·헤더 직렬화·요청 발행 0). 이로써 coalescing 의 ROI 가 관측 가능해져
// UC-07 §8 NFR 의 효율적 부분 손상 복구를 정량적으로 채운다(WebUI/로그가 "N개 요청 → M개로 통합,
// K개 절감(P%)" 를 그대로 표시).
//
// 실 재전송 / byte slice 추출 / HTTP Range 요청·206 Partial Content / Content-Range·Range 헤더
// 직렬화 / 재시도 정책·backoff·비용 모델 0 — 입력으로 받은 ExportChunkRefetchBatch(T-0473)의 수치
// 필드만으로 요청 수 절감을 순수 산술로 정량화한다. coalesceExportChunkRefetch /
// reconcileExportChunkIntegrity 를 재호출하지 않고 입력 batch 의 필드를 그대로 사용한다(DRY —
// coalescing 재실행 금지). 새 도메인 타입은 ExportChunkRefetchSavings 만 신설하며
// ExportChunkRefetchBatch 는 재사용(import — 중복 정의 금지). 새 외부 dependency 0. 코드 골격은
// export-chunk-refetch-coalesce.ts(T-0473)의 isPlainObject / describeNonObject /
// isValidNonNegativeInteger 입력 방어 + 한국어 message convention 을 mirror 한다.
import { ExportChunkRefetchBatch } from "./export-chunk-refetch-coalesce";

// chunked streaming 재요청 coalescing 절감 효과 모델 — plain object. allIntact 는 병합할 실패 chunk
// 가 0 개인가(= batch.allIntact), failedChunkCount 는 병합 전 실패 chunk 총 개수(= 병합 없을 때 필요한
// 요청 수 = batch.failedChunkCount), rangeCount 는 병합 후 연속 범위 개수(= coalescing 후 실제 요청 수
// = batch.rangeCount), requestsSaved 는 병합으로 제거된 요청 수(= failedChunkCount - rangeCount; 0
// 이상), savingsRatio 는 절감률 0~1 소수(failedChunkCount === 0 이면 0, 아니면 requestsSaved /
// failedChunkCount), savingsPercent 는 savingsRatio × 100 을 정수로 반올림한 백분율(0~100),
// fullyCoalesced 는 모든 실패 chunk 가 하나의 범위로 통합됐는가(failedChunkCount > 0 && rangeCount ===
// 1), refetchBytes 는 batch.refetchBytes(병합은 byte 총량 보존 — 절감 view 에 함께 노출),
// headline 은 한국어 한 줄 요약이다. 후속 streaming controller / WebUI 재요청 안내가 그대로 사용한다.
export interface ExportChunkRefetchSavings {
  allIntact: boolean;
  failedChunkCount: number;
  rangeCount: number;
  requestsSaved: number;
  savingsRatio: number;
  savingsPercent: number;
  fullyCoalesced: boolean;
  refetchBytes: number;
  headline: string;
}

// plain object(null/배열/비-object 아님) 판정 — batch 입력 방어에 쓴다
// (export-chunk-refetch-coalesce.isPlainObject 동형).
function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

// value 가 null/배열/비-object 일 때의 사람-친화 type label — 입력 방어 메시지에 쓴다
// (export-chunk-refetch-coalesce.describeNonObject 동형).
function describeNonObject(value: unknown): string {
  return value === null
    ? "null"
    : Array.isArray(value)
      ? "array"
      : typeof value;
}

// 값이 유효한 비-음수 정수(0 허용)인지 판정 — NaN/Infinity/소수/음수/비-number 거부
// (export-chunk-refetch-coalesce.isValidNonNegativeInteger 동형).
function isValidNonNegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

// summariseExportChunkRefetchSavings — 이미 산출된 ExportChunkRefetchBatch(T-0473)로부터 병합이
// 절감한 HTTP Range 요청 수·절감률·완전 통합 여부를 순수 산술로 derive 한다(UC-07 §8 NFR 정합).
//
// 산정:
//   - requestsSaved = failedChunkCount - rangeCount(병합으로 제거된 요청 수; rangeCount <=
//     failedChunkCount 이므로 항상 0 이상).
//   - savingsRatio = failedChunkCount === 0 ? 0 : requestsSaved / failedChunkCount(0~1).
//   - savingsPercent = Math.round(savingsRatio * 100)(0~100).
//   - fullyCoalesced = failedChunkCount > 0 && rangeCount === 1(모든 실패가 하나의 범위로 통합).
//   - allIntact = batch.allIntact, refetchBytes = batch.refetchBytes(byte 총량은 절감 대상 아님 —
//     함께 노출만).
//
// 경계: allIntact(0,0) → requestsSaved 0, savingsRatio 0, fullyCoalesced false, "재요청 불필요(무결)".
// 단일 실패(1,1) → requestsSaved 0, fullyCoalesced true(1 chunk 가 1 범위 — 통합 단위). 전부 연속
// (5,1) → requestsSaved 4, savingsPercent 80, fullyCoalesced true. 전부 비연속(3,3) → requestsSaved 0,
// fullyCoalesced false. 혼합(3,2) → requestsSaved 1, savingsPercent 33, fullyCoalesced false.
//
// 입력 batch / batch.ranges 를 변형하지 않으며(non-mutating — freeze 된 입력 통과), 반환 객체는 항상
// 새 것. 동일 입력 2 회 호출은 동등 결과(순수·결정성). 입력 방어:
//   - batch 이 plain object 아님(null/배열/원시값) → TypeError(label "batch").
//   - batch.failedChunkCount / batch.rangeCount / batch.refetchBytes 비-음수정수 아님 → TypeError
//     (label·받은 값 박제 — 손상된 batch 거부).
//   - batch.allIntact 가 boolean 아님 → TypeError(label·받은 값 박제).
//   - batch.rangeCount > batch.failedChunkCount(병합이 요청 수를 늘린 모순 — coalescing 계약 위반) →
//     RangeError(위반 박제 — 손상된 batch).
//   - batch.allIntact 와 수치의 모순(true 인데 failedChunkCount/rangeCount !== 0; false 인데
//     failedChunkCount === 0) → RangeError(모순 박제).
//   - batch.failedChunkCount === 0 ⊻ batch.rangeCount === 0(무결/손상 정의 위반) → RangeError(모순 박제).
export function summariseExportChunkRefetchSavings(
  batch: ExportChunkRefetchBatch,
): ExportChunkRefetchSavings {
  // top-level batch 이 plain object 가 아니면 하위 필드 접근 불가 — 즉시 throw.
  if (!isPlainObject(batch)) {
    throw new TypeError(
      `summariseExportChunkRefetchSavings: batch 은 plain object 여야 합니다 (받음: ${describeNonObject(
        batch,
      )})`,
    );
  }

  const allIntact = (batch as { allIntact: unknown }).allIntact;
  if (typeof allIntact !== "boolean") {
    throw new TypeError(
      `summariseExportChunkRefetchSavings: batch.allIntact 는 boolean 이어야 합니다 (받음: ${String(
        allIntact,
      )})`,
    );
  }

  const failedChunkCount = (batch as { failedChunkCount: unknown })
    .failedChunkCount;
  if (!isValidNonNegativeInteger(failedChunkCount)) {
    throw new TypeError(
      `summariseExportChunkRefetchSavings: batch.failedChunkCount 는 0 이상의 정수여야 합니다 (받음: ${String(
        failedChunkCount,
      )})`,
    );
  }

  const rangeCount = (batch as { rangeCount: unknown }).rangeCount;
  if (!isValidNonNegativeInteger(rangeCount)) {
    throw new TypeError(
      `summariseExportChunkRefetchSavings: batch.rangeCount 는 0 이상의 정수여야 합니다 (받음: ${String(
        rangeCount,
      )})`,
    );
  }

  const refetchBytes = (batch as { refetchBytes: unknown }).refetchBytes;
  if (!isValidNonNegativeInteger(refetchBytes)) {
    throw new TypeError(
      `summariseExportChunkRefetchSavings: batch.refetchBytes 는 0 이상의 정수여야 합니다 (받음: ${String(
        refetchBytes,
      )})`,
    );
  }

  // allIntact ⟺ failedChunkCount === 0 ⟺ rangeCount === 0 — 무결/손상 정의 모순 거부.
  // (rangeCount > failedChunkCount 검사보다 *먼저* 둔다: allIntact=true 인데 rangeCount!==0 인
  //  모순은 failedChunkCount=0 이라 rangeCount>failedChunkCount 와 겹치므로, 더 구체적인 allIntact
  //  모순 메시지를 우선 발화하기 위함.)
  if (allIntact === true && failedChunkCount !== 0) {
    throw new RangeError(
      `summariseExportChunkRefetchSavings: batch.allIntact 가 true 인데 batch.failedChunkCount(${failedChunkCount})가 0 이 아닙니다 — 모순된 batch`,
    );
  }
  if (allIntact === true && rangeCount !== 0) {
    throw new RangeError(
      `summariseExportChunkRefetchSavings: batch.allIntact 가 true 인데 batch.rangeCount(${rangeCount})가 0 이 아닙니다 — 모순된 batch`,
    );
  }
  if (allIntact === false && failedChunkCount === 0) {
    throw new RangeError(
      `summariseExportChunkRefetchSavings: batch.allIntact 가 false 인데 batch.failedChunkCount 가 0 입니다 — 모순된 batch`,
    );
  }

  // 병합이 요청 수를 늘릴 수 없다 — rangeCount 는 failedChunkCount 이하여야 한다(coalescing 계약).
  if (rangeCount > failedChunkCount) {
    throw new RangeError(
      `summariseExportChunkRefetchSavings: batch.rangeCount(${rangeCount})가 batch.failedChunkCount(${failedChunkCount})보다 큽니다 — 병합이 요청 수를 늘릴 수 없습니다 (손상된 batch)`,
    );
  }

  // failedChunkCount > 0 ⟺ rangeCount > 0 — 손상이 있는데 범위가 0 이면 정의 위반.
  // (failedChunkCount === 0 인데 rangeCount > 0 인 모순은 위 allIntact 모순 검사 두 분기가
  //  이미 선차단한다: allIntact=true → rangeCount!==0 분기, allIntact=false → failedChunkCount===0
  //  분기. 따라서 별도 분기 불요.)
  if (failedChunkCount > 0 && rangeCount === 0) {
    throw new RangeError(
      `summariseExportChunkRefetchSavings: batch.failedChunkCount(${failedChunkCount})가 0 보다 큰데 batch.rangeCount 가 0 입니다 — 모순된 batch`,
    );
  }

  const requestsSaved = failedChunkCount - rangeCount;
  const savingsRatio =
    failedChunkCount === 0 ? 0 : requestsSaved / failedChunkCount;
  const savingsPercent = Math.round(savingsRatio * 100);
  const fullyCoalesced = failedChunkCount > 0 && rangeCount === 1;

  const headline =
    failedChunkCount === 0
      ? `chunked streaming 재요청 절감: 재요청 불필요(무결) — 절감 0`
      : `chunked streaming 재요청 절감: ${failedChunkCount}개 요청 → ${rangeCount}개로 통합, ${requestsSaved}개 절감(${savingsPercent}%)`;

  return {
    allIntact,
    failedChunkCount,
    rangeCount,
    requestsSaved,
    savingsRatio,
    savingsPercent,
    fullyCoalesced,
    refetchBytes,
    headline,
  };
}
