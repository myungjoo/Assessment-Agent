// export-dump-size-estimate — UC-07 §8 NFR Export dump 예상 크기 산정·대량 dump async/streaming
// 권고 안내 순수 helper (T-0466, P7 R-57 / REQ-030 / REQ-032 / REQ-045). T-0437 selectExportRecords
// → T-0438 buildExportDump → ... → T-0449 summarizeExportSelection → T-0450 validateImportDumpSize
// 다음의 게이트-free building block 이다. Import 측 validateImportDumpSize(T-0450)는 입력 dump 의
// size cap 위반 verdict 를 산출하지만, Export 측에는 선별된 record 집합의 예상 dump 크기를 산정해
// "이 크기면 동기 다운로드 / 대량이라 async·streaming 권고" 를 안내하는 대칭 helper 가 0 회 cover
// 된 gap 이다(git grep estimateExportDumpSize|ExportDumpSizeEstimate → 0 매칭). summarizeExportSelection
// (T-0449)은 selected/excluded breakdown 만 derive 하고 byte 단위 크기 추정·async 임계 판정은 0 이다.
// UC-07 §8 NFR 은 "본 UC 의 응답 시간은 dump size 에 비례. read 한정 SLA[REQ-048]의 3 초는 일반적
// dump 에 적용, 대량 dump 는 long-running operation 가능 — async job + status polling + chunked
// streaming" 을 명시한다. 본 helper 는 그 §8 NFR + §3 trigger 1(scope 옵션 confirmation dialog) +
// §5 step 2(scope 옵션 확인)가 필요로 하는 "선택한 scope 의 예상 다운로드 규모 + 대량 시
// long-running 경고" 를 순수 합성으로 박제한다 — ExportSelection.selected 를 받아 entity-별 byte
// weight × record 수로 추정 byte 와 async 임계 판정만 한다.
//
// 실 dump 직렬화 / 실 byte 측정 / DB query / streaming / async job / status polling 호출 0 이며,
// ExportSelection / ExportEntity 등은 export-scope-select.ts 에서 재사용(신규 도메인 타입은
// ExportDumpSizeEstimate + 옵션 타입만 신설). 새 외부 dependency 0. 코드 골격은
// import-dump-size-validate.ts(T-0450)의 isPlainObject / isValidCap 입력 방어 + 5-entity 0-init
// map + 한국어 message convention 을 mirror 한다. REQ-032(raw 미저장)는 입력 selection 의 record
// 수만 다루고 raw 를 새로 fetch 하지 않으므로 layer 에서 자연 유지된다.
import {
  ExportEntity,
  ExportSelection,
  VALID_EXPORT_ENTITIES,
} from "./export-scope-select";

// entity 별 default byte weight 부재 시 적용할 record 당 byte 추정치(보수적 1 record ≈ 1 KB).
// 정책 source(ENV / DB / config)는 본 helper 책임 0 — 옵션 defaultBytesPerRecord 로 덮어쓸 수 있다.
export const DEFAULT_BYTES_PER_RECORD = 1024;

// 이 byte 를 초과하면 large=true + async-streaming 권고로 전환하는 default 임계(10 MB).
// 옵션 asyncThresholdBytes 로 덮어쓸 수 있다(정책 source 0 — 옵션으로 받은 값만 사용).
export const DEFAULT_ASYNC_THRESHOLD_BYTES = 10 * 1024 * 1024;

// 예상 dump 크기 산정 옵션 — 전부 선택. bytesPerRecord 는 entity 별 byte weight 부분 지정 map
// (부재 entity 는 defaultBytesPerRecord 적용), defaultBytesPerRecord 는 bytesPerRecord 에 없는
// entity 의 fallback weight(부재 시 DEFAULT_BYTES_PER_RECORD), asyncThresholdBytes 는 이 값 초과
// 시 large=true·async-streaming 권고(부재 시 DEFAULT_ASYNC_THRESHOLD_BYTES). 후속 controller 가
// 정책 row · ENV 기반 동적 값을 넘긴다.
export interface ExportDumpSizeEstimateOptions {
  bytesPerRecord?: Partial<Record<ExportEntity, number>>;
  defaultBytesPerRecord?: number;
  asyncThresholdBytes?: number;
}

// 예상 dump 크기 산정 결과 — plain object. estimatedBytes 는 entity 별 byte weight × record 수의
// 합, humanSize 는 byte → B/KB/MB/GB 사람-친화 한국어 라벨, recordTotal 은 selected record 총수,
// perEntityBytes 는 5 entity 전부 key 인 byte map, large 는 estimatedBytes > asyncThresholdBytes,
// recommendation 은 large 와 동치인 "sync" | "async-streaming", guidanceLines 는 한국어 안내 줄.
// 불변: large === (recommendation === "async-streaming"). WebUI confirmation dialog / Audit row 가
// 이 결과를 그대로 사용한다(UC-07 §3 trigger 1 / §5 step 2 / §8 NFR).
export interface ExportDumpSizeEstimate {
  estimatedBytes: number;
  humanSize: string;
  recordTotal: number;
  perEntityBytes: Record<ExportEntity, number>;
  large: boolean;
  recommendation: "sync" | "async-streaming";
  guidanceLines: string[];
}

// plain object(null/배열/비-object 아님) 판정 — top-level selection + options + bytesPerRecord
// 입력 방어에 쓴다(import-dump-size-validate.isPlainObject 동형).
function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

// byte weight 후보값이 유효한 비-음수 정수(0 허용)인지 판정 — NaN/Infinity/소수/음수/비-number
// 거부(import-dump-size-validate.isValidCap 동형). weight 0 은 "해당 entity 는 크기 0 추정" 의
// 정상 정책이므로 허용한다.
function isValidByteWeight(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

// value 가 null/배열/비-object 일 때의 사람-친화 type label — 입력 방어 메시지에 쓴다.
function describeNonObject(value: unknown): string {
  return value === null
    ? "null"
    : Array.isArray(value)
      ? "array"
      : typeof value;
}

// byte → B/KB/MB/GB 사람-친화 한국어 라벨. 1024 진법으로 가장 큰 단위까지 환산하며, 소수 1 자리
// 까지(정수면 소수 0 자리 효과) 표기한다. 0 → "0 B". GB 초과는 GB 로 유지(상한 단위).
function formatHumanSize(bytes: number): string {
  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  // B 단위는 정수 byte 이므로 소수 없이, 그 외는 소수 1 자리(불필요한 .0 은 제거).
  const rounded = unitIndex === 0 ? value : Math.round(value * 10) / 10;
  const text = Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
  return `${text} ${units[unitIndex]}`;
}

// estimateExportDumpSize — selectExportRecords(T-0437)가 산출한 ExportSelection 의 selected
// record 를 entity-별 byte weight 로 추정해 예상 dump 크기 + async 임계 판정 + 한국어 안내를
// 순수 derivation 으로 산출한다. UC-07 §8 NFR 정합:
//   - selection.selected 를 entity-별로 1 회 순회 집계 → perEntityBytes(entity 별 weight × 수) +
//     estimatedBytes(합). 5 허용 외 entity 값은 perEntity key 가 없어 자연 무시(T-0440 구조 검증
//     책임 위임). recordTotal = selected.length.
//   - estimatedBytes > asyncThresholdBytes → large=true + recommendation="async-streaming" +
//     long-running 권고 안내. 아니면 large=false + recommendation="sync" + 동기 다운로드 안내.
//     경계(estimatedBytes === asyncThresholdBytes)는 초과 아님 → sync.
//   - humanSize 는 byte → B/KB/MB/GB 한국어 라벨. 빈 selection → estimatedBytes 0 / "0 B" / sync.
//
// 입력 selection / 배열 / options 를 변형하지 않으며(non-mutating — freeze 된 입력 통과),
// perEntityBytes/guidanceLines 는 항상 새 객체/배열. 최소 입력 방어:
//   - selection 이 plain object 아님(null/배열/비-object) → TypeError(label "selection").
//   - selection.selected 가 배열 아님 → TypeError(label "selection.selected").
//   - options 가 비-object(배열/null — undefined 는 정상) → TypeError(label "options").
//   - bytesPerRecord 가 비-object(배열/null/원시값) → TypeError. 각 entity weight 가 비-정수·
//     음수·NaN·Infinity·비-number → TypeError(어느 entity 인지 박제).
//   - defaultBytesPerRecord / asyncThresholdBytes 가 부적합 byte weight → TypeError(어느 옵션인지
//     박제).
export function estimateExportDumpSize(
  selection: ExportSelection,
  options?: ExportDumpSizeEstimateOptions,
): ExportDumpSizeEstimate {
  // top-level selection 이 plain object 가 아니면 하위 배열에 접근할 수 없어 즉시 throw.
  if (!isPlainObject(selection)) {
    throw new TypeError(
      `estimateExportDumpSize: selection 은 plain object 여야 합니다 (받음: ${describeNonObject(
        selection,
      )})`,
    );
  }

  const selected = (selection as { selected: unknown }).selected;
  if (!Array.isArray(selected)) {
    throw new TypeError(
      `estimateExportDumpSize: selection.selected 는 배열이어야 합니다 (받음: ${typeof selected})`,
    );
  }

  // options 가 주어졌으면 비-object 거부(undefined 는 정상 — 전체 default 적용).
  if (options !== undefined && !isPlainObject(options)) {
    throw new TypeError(
      `estimateExportDumpSize: options 는 plain object 여야 합니다 (받음: ${describeNonObject(
        options,
      )})`,
    );
  }

  const opts = (options ?? {}) as ExportDumpSizeEstimateOptions;

  // defaultBytesPerRecord — 주어졌을 때만 검증. 부재 시 DEFAULT_BYTES_PER_RECORD.
  if (
    opts.defaultBytesPerRecord !== undefined &&
    !isValidByteWeight(opts.defaultBytesPerRecord)
  ) {
    throw new TypeError(
      `estimateExportDumpSize: options.defaultBytesPerRecord 는 0 이상의 정수여야 합니다 (받음: ${String(
        opts.defaultBytesPerRecord,
      )})`,
    );
  }
  const defaultWeight = opts.defaultBytesPerRecord ?? DEFAULT_BYTES_PER_RECORD;

  // asyncThresholdBytes — 주어졌을 때만 검증. 부재 시 DEFAULT_ASYNC_THRESHOLD_BYTES.
  if (
    opts.asyncThresholdBytes !== undefined &&
    !isValidByteWeight(opts.asyncThresholdBytes)
  ) {
    throw new TypeError(
      `estimateExportDumpSize: options.asyncThresholdBytes 는 0 이상의 정수여야 합니다 (받음: ${String(
        opts.asyncThresholdBytes,
      )})`,
    );
  }
  const asyncThresholdBytes =
    opts.asyncThresholdBytes ?? DEFAULT_ASYNC_THRESHOLD_BYTES;

  // bytesPerRecord — 주어졌을 때만 검증. 비-object 거부 + 각 entity weight 검증(어느 entity 박제).
  const bytesPerRecord = opts.bytesPerRecord;
  if (bytesPerRecord !== undefined) {
    if (!isPlainObject(bytesPerRecord)) {
      throw new TypeError(
        `estimateExportDumpSize: options.bytesPerRecord 는 entity→number weight map 이어야 합니다 (받음: ${describeNonObject(
          bytesPerRecord,
        )})`,
      );
    }
    for (let i = 0; i < VALID_EXPORT_ENTITIES.length; i += 1) {
      const entity = VALID_EXPORT_ENTITIES[i];
      const weight = (bytesPerRecord as Record<string, unknown>)[entity];
      if (weight !== undefined && !isValidByteWeight(weight)) {
        throw new TypeError(
          `estimateExportDumpSize: options.bytesPerRecord.${entity} 는 0 이상의 정수여야 합니다 (받음: ${String(
            weight,
          )})`,
        );
      }
    }
  }

  // entity 별 record 수 1 회 순회 집계 — 5 entity 0-init map. 5 허용 외 entity 는 key 없어 무시.
  const perEntityCount = {
    Assessment: 0,
    Person: 0,
    Group: 0,
    LlmConfig: 0,
    AuditLog: 0,
  } as Record<ExportEntity, number>;
  for (let index = 0; index < selected.length; index += 1) {
    const record = selected[index] as { entity?: unknown };
    const entity = record?.entity;
    if (typeof entity === "string" && entity in perEntityCount) {
      perEntityCount[entity as ExportEntity] += 1;
    }
  }

  // perEntityBytes = entity 별 (weight × 수). weight 는 bytesPerRecord[entity] 우선, 부재 시
  // defaultWeight. estimatedBytes 는 합.
  const perEntityBytes = {
    Assessment: 0,
    Person: 0,
    Group: 0,
    LlmConfig: 0,
    AuditLog: 0,
  } as Record<ExportEntity, number>;
  let estimatedBytes = 0;
  for (let i = 0; i < VALID_EXPORT_ENTITIES.length; i += 1) {
    const entity = VALID_EXPORT_ENTITIES[i];
    const perRecord =
      bytesPerRecord && bytesPerRecord[entity] !== undefined
        ? (bytesPerRecord[entity] as number)
        : defaultWeight;
    const bytes = perEntityCount[entity] * perRecord;
    perEntityBytes[entity] = bytes;
    estimatedBytes += bytes;
  }

  const recordTotal = selected.length;
  const humanSize = formatHumanSize(estimatedBytes);

  // async 임계 판정 — 초과 시에만 large(경계 === 는 초과 아님 → sync).
  const large = estimatedBytes > asyncThresholdBytes;
  const recommendation: "sync" | "async-streaming" = large
    ? "async-streaming"
    : "sync";

  // 한국어 안내 — sync 면 3 초 내 동기 다운로드 가능 류, async-streaming 면 §8 NFR 의 long-running
  // operation(async job + status polling + chunked streaming) 권고 류.
  const guidanceLines = large
    ? [
        `예상 dump 크기 ${humanSize}(record ${recordTotal} 건)는 대량 dump 입니다.`,
        "대량 dump 는 long-running operation 으로 처리됩니다 — async job + status polling + chunked streaming 을 권고합니다.",
      ]
    : [
        `예상 dump 크기 ${humanSize}(record ${recordTotal} 건)는 3 초 내 동기 다운로드가 가능합니다.`,
      ];

  return {
    estimatedBytes,
    humanSize,
    recordTotal,
    perEntityBytes,
    large,
    recommendation,
    guidanceLines,
  };
}
