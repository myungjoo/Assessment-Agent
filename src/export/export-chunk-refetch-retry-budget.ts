// export-chunk-refetch-retry-budget — UC-07 §8 NFR chunked streaming 부분 손상 재요청의 재시도
// *횟수* 예산(최대 시도 수·사용 시도 수)으로부터 잔여 시도·예산 소진·추가 재시도 허용 여부를 순수
// 산술로 derive 하는 helper (T-0479, P7 / REQ-030 / REQ-032 / REQ-045). 기존 refetch 도메인
// helper 들 — coalesceExportChunkRefetch(T-0473)·summariseExportChunkRefetchSavings(T-0474)·
// Fragmentation(T-0475)·Gaps(T-0476)·reconcileExportChunkIntegrity(T-0472) — 은 모두 "재시도
// 정책·backoff 0" 을 명시하며 어느 chunk 가 어느 byte 범위로 몇 번의 요청으로 재전송돼야 하는지(공간
// 차원)만 다룬다. import-restore-failure-message 의 retryable 은 사유가 일시적인지의 boolean 분류일
// 뿐, *몇 번까지 재시도할 수 있는가*(횟수 차원)는 누구도 derive 하지 않는다 — 이 재시도 예산 산술
// 도메인은 42 helper(T-0437~T-0478) 중 0 회 cover 된 gap 이다(git grep -iwl
// "RetryBudget\|attemptsRemaining\|attemptsUsed\|maxAttempts\|retriesLeft\|exhausted" src/export
// → 0 매칭).
//
// 운영자/streaming 클라이언트는 무한 재요청을 허용할 수 없다 — 재시도 예산(retry budget) 안에서만
// 부분 복구를 반복해야 한다. 본 helper 는 "최대 N회 허용, 이미 M회 사용, 잔여 손상 K개" 로부터 잔여
// 시도(attemptsRemaining)·예산 소진(exhausted)·추가 재시도 허용(canRetry = 잔여>0 && 손상>0)·소비율
// (usageRatio·usagePercent)·마지막 시도(lastAttempt = 잔여 정확히 1)를 순수 산술로 산정한다. 이는
// streaming 재요청 루프가 "더 재시도할지/포기할지" 를 결정하는 입력이 된다.
//
// 실 재전송 / byte slice / HTTP Range·206 Partial Content / backoff 지연·exponential·jitter /
// 다음 재시도 시각·타이머·Date.now()·setTimeout 등 실 시계·스케줄 read 0 — 예산 수치(최대/사용 시도
// 수)와 잔여 손상 chunk 수는 caller 가 전달하고 본 helper 는 산술 derive 만 한다(순수·결정성·
// non-mutating). refetch-batch helper(coalesce/savings/fragmentation/gap)를 재호출·재구현하지
// 않는다(DRY — 공간 차원과 직교, 재시도 *횟수* 만). 새 도메인 타입 ExportChunkRefetchRetryBudgetInput
// /ExportChunkRefetchRetryBudget 만 신설(옵션 타입 없음). 새 외부 dependency 0. 코드 골격은
// export-chunk-refetch-savings.ts(T-0474)의 isPlainObject / describeNonObject /
// isValidNonNegativeInteger 입력 방어 + 한국어 message convention 을 mirror 한다.

// chunked streaming 재요청 재시도 예산 입력 — plain object. maxAttempts 는 허용된 최대 재요청 시도
// 수(비-음수 정수; 0 이면 재시도 자체 미허용), attemptsUsed 는 이미 사용한 시도 수(비-음수 정수),
// failedChunkCount 는 아직 복구되지 않은 손상 chunk 수(비-음수 정수; 0 이면 복구할 대상 없음)이다.
export interface ExportChunkRefetchRetryBudgetInput {
  maxAttempts: number;
  attemptsUsed: number;
  failedChunkCount: number;
}

// chunked streaming 재요청 재시도 예산 모델 — plain object. maxAttempts/attemptsUsed/
// failedChunkCount 는 입력 echo, attemptsRemaining 은 잔여 시도 수(= max(0, maxAttempts -
// attemptsUsed); attemptsUsed > maxAttempts 인 예산 초과 사용은 0 으로 clamp), exhausted 는 예산
// 소진 여부(= attemptsRemaining === 0), canRetry 는 추가 재요청 허용 여부(= attemptsRemaining > 0 &&
// failedChunkCount > 0 — 잔여가 남아도 복구 대상이 없으면 false), lastAttempt 는 마지막 시도 여부
// (= attemptsRemaining === 1), usageRatio 는 예산 소비율 0~1 소수(= maxAttempts === 0 ? 0 :
// min(1, attemptsUsed / maxAttempts) — 초과 사용은 1 로 clamp), usagePercent 는 그 백분율
// (= Math.round(usageRatio * 100) 의 0~100 정수), headline 은 한국어 한 줄 요약이다. 후속 streaming
// 재요청 루프 / WebUI 재시도 안내가 그대로 사용한다.
// 불변: 0 <= attemptsRemaining <= maxAttempts, exhausted === (attemptsRemaining === 0),
// lastAttempt === (attemptsRemaining === 1), canRetry === (attemptsRemaining > 0 &&
// failedChunkCount > 0), 0 <= usageRatio <= 1, usagePercent === Math.round(usageRatio * 100),
// exhausted ⟹ canRetry === false, failedChunkCount === 0 ⟹ canRetry === false.
export interface ExportChunkRefetchRetryBudget {
  maxAttempts: number;
  attemptsUsed: number;
  failedChunkCount: number;
  attemptsRemaining: number;
  exhausted: boolean;
  canRetry: boolean;
  lastAttempt: boolean;
  usageRatio: number;
  usagePercent: number;
  headline: string;
}

// plain object(null/배열/비-object 아님) 판정 — input 입력 방어에 쓴다
// (export-chunk-refetch-savings.isPlainObject 동형).
function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

// value 가 null/배열/비-object 일 때의 사람-친화 type label — 입력 방어 메시지에 쓴다
// (export-chunk-refetch-savings.describeNonObject 동형).
function describeNonObject(value: unknown): string {
  return value === null
    ? "null"
    : Array.isArray(value)
      ? "array"
      : typeof value;
}

// 값이 유효한 비-음수 정수(0 허용)인지 판정 — NaN/Infinity/소수/음수/비-number 거부
// (export-chunk-refetch-savings.isValidNonNegativeInteger 동형).
function isValidNonNegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

// deriveExportChunkRefetchRetryBudget — 재시도 예산 입력(최대/사용 시도 수 + 잔여 손상 chunk 수)
// 으로부터 잔여 시도·소진·추가 재시도 허용·소비율·마지막 시도 여부를 순수 산술로 derive 한다
// (UC-07 §8 NFR 정합):
//   - attemptsRemaining = max(0, maxAttempts - attemptsUsed)(초과 사용은 0 으로 clamp).
//   - exhausted = attemptsRemaining === 0.
//   - canRetry = attemptsRemaining > 0 && failedChunkCount > 0.
//   - lastAttempt = attemptsRemaining === 1.
//   - usageRatio = maxAttempts === 0 ? 0 : min(1, attemptsUsed / maxAttempts)(초과 사용은 1 clamp).
//   - usagePercent = Math.round(usageRatio * 100).
//
// 경계: maxAttempts === 0(재시도 미허용) → attemptsRemaining=0·exhausted=true·canRetry=false·
// usageRatio=0·usagePercent=0. attemptsUsed === 0(미사용) → attemptsRemaining=maxAttempts·
// usageRatio=0. attemptsUsed > maxAttempts(초과 사용) → attemptsRemaining=0·exhausted=true·
// canRetry=false·usageRatio=1(clamp). 잔여 1(lastAttempt=true) vs 잔여 ≥ 2 분기.
// failedChunkCount === 0(복구 대상 없음) → 잔여가 남아도 canRetry=false.
//
// 입력 객체를 변형하지 않으며(non-mutating — freeze 된 입력 통과), 반환 객체는 항상 새 것. 동일 입력
// 2 회 호출은 동등 결과(순수·결정성). 입력 방어:
//   - input 이 plain object 아님(null/배열/원시값) → TypeError(label "input"·받은 값 박제).
//   - input.maxAttempts / input.attemptsUsed / input.failedChunkCount 중 비-음수 유한 정수 아님
//     (음수·NaN·Infinity·소수·비-number 각각) → TypeError(label·받은 값 박제).
// 예산 초과 사용(attemptsUsed > maxAttempts)은 손상이 아니라 정상 clamp 대상이므로 throw 하지 않는다.
export function deriveExportChunkRefetchRetryBudget(
  input: ExportChunkRefetchRetryBudgetInput,
): ExportChunkRefetchRetryBudget {
  // top-level input 이 plain object 가 아니면 하위 필드 접근 불가 — 즉시 throw.
  if (!isPlainObject(input)) {
    throw new TypeError(
      `deriveExportChunkRefetchRetryBudget: input 은 plain object 여야 합니다 (받음: ${describeNonObject(
        input,
      )})`,
    );
  }

  const maxAttempts = (input as { maxAttempts: unknown }).maxAttempts;
  if (!isValidNonNegativeInteger(maxAttempts)) {
    throw new TypeError(
      `deriveExportChunkRefetchRetryBudget: input.maxAttempts 는 0 이상의 정수여야 합니다 (받음: ${String(
        maxAttempts,
      )})`,
    );
  }

  const attemptsUsed = (input as { attemptsUsed: unknown }).attemptsUsed;
  if (!isValidNonNegativeInteger(attemptsUsed)) {
    throw new TypeError(
      `deriveExportChunkRefetchRetryBudget: input.attemptsUsed 는 0 이상의 정수여야 합니다 (받음: ${String(
        attemptsUsed,
      )})`,
    );
  }

  const failedChunkCount = (input as { failedChunkCount: unknown })
    .failedChunkCount;
  if (!isValidNonNegativeInteger(failedChunkCount)) {
    throw new TypeError(
      `deriveExportChunkRefetchRetryBudget: input.failedChunkCount 는 0 이상의 정수여야 합니다 (받음: ${String(
        failedChunkCount,
      )})`,
    );
  }

  // 잔여 시도 — 초과 사용(attemptsUsed > maxAttempts)은 0 으로 clamp(음수 잔여 금지).
  const attemptsRemaining = Math.max(0, maxAttempts - attemptsUsed);
  const exhausted = attemptsRemaining === 0;
  // 추가 재요청 허용 — 잔여가 있으면서 복구할 손상 chunk 도 남아 있을 때만.
  const canRetry = attemptsRemaining > 0 && failedChunkCount > 0;
  const lastAttempt = attemptsRemaining === 1;

  // 소비율 — 재시도 미허용(max 0)이면 0, 그 외 used/max 를 1 로 clamp(초과 사용 흡수).
  const usageRatio =
    maxAttempts === 0 ? 0 : Math.min(1, attemptsUsed / maxAttempts);
  const usagePercent = Math.round(usageRatio * 100);

  const headline =
    maxAttempts === 0
      ? `chunked streaming 재시도 예산: 재시도 미허용(최대 0회) — 추가 재요청 불가`
      : exhausted
        ? `chunked streaming 재시도 예산: 소진(${attemptsUsed}/${maxAttempts}회 사용) — 추가 재요청 불가 (잔여 손상 ${failedChunkCount}개)`
        : canRetry
          ? `chunked streaming 재시도 예산: 잔여 ${attemptsRemaining}/${maxAttempts}회${
              lastAttempt ? "(마지막 시도)" : ""
            }, 추가 재요청 허용 (잔여 손상 ${failedChunkCount}개)`
          : `chunked streaming 재시도 예산: 잔여 ${attemptsRemaining}/${maxAttempts}회 — 복구 대상 없음(손상 0), 추가 재요청 불필요`;

  return {
    maxAttempts,
    attemptsUsed,
    failedChunkCount,
    attemptsRemaining,
    exhausted,
    canRetry,
    lastAttempt,
    usageRatio,
    usagePercent,
    headline,
  };
}
