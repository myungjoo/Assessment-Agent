// export-artifact-descriptor — UC-07 Export 다운로드 artifact descriptor 조립 순수 helper
// (T-0457, P7 R-57 / REQ-030 / REQ-032). T-0438 buildExportDump 가 직렬화 가능한 dump
// envelope(schemaVersion/generatedAt/scope/entityCounts/recordCount/records)만 조립했다면,
// 본 helper 는 그 envelope 를 받아 사람·브라우저에 **다운로드 가능한 파일**로 전달할 때 필요한
// artifact 메타데이터(파일명·content-type·byte size 추정·content-disposition 헤더 값·scope
// 토큰)를 조립만 한다. UC-07 §5 step13(`Export: 다운로드 완료`) + §8 (a)(c) Export
// postcondition(`Admin 에게 file artifact 전달 완료`)의 다운로드 artifact descriptor 0회-cover
// gap 을 박제한다.
//
// 실 file streaming · res.download · chunked/resumable response · REST controller 배선 ·
// persistence/repository/transaction · 압축 archive(.gz/.zip) · 실 byte 정확 측정(encoding/
// 압축 고려)은 전부 §Out of Scope(repository 게이트된 후속) — 본 helper 는 추정 hint 만
// 산출하는 순수 조립이다. 새 외부 dependency 0, 새 도메인 타입은 ExportArtifactDescriptor 만
// 신설(ExportDump/ExportScope/ExportEntity/PeriodRange 재사용).
//
// 코드 골격은 export-result.ts(T-0456) / export-dump.ts(T-0438)의 순수-helper 패턴
// (non-mutating · isPlainObject 입력 방어 · 한국어 TypeError/RangeError · assertValidDate
// convention)을 mirror 한다. REQ-032(raw 미저장)는 입력 dump 의 metadata 만 다뤄 raw 를 새로
// fetch 하지 않으므로 helper layer 에서 자연 유지된다.
import { ExportDump } from "./export-dump";
import { VALID_EXPORT_SCOPES } from "./export-scope-select";

// 다운로드 artifact descriptor 모델 — plain object. fileName 은 scope 토큰 + timestamp 토큰 +
// `.json` 확장자로 조립한 안전 charset 파일명, contentType 은 `application/json`, byteSizeHint
// 은 JSON.stringify(dump) 의 UTF-8 byte length 추정, contentDisposition 은
// `attachment; filename="<fileName>"`, scopeToken 은 §6.1 scope(full/range/partial) 토큰이다.
// 후속 REST controller(repository 게이트 후속)가 본 descriptor 를 HTTP 헤더로 직렬화하고,
// WebUI(P6)가 다운로드 링크 표시에 활용한다.
export interface ExportArtifactDescriptor {
  fileName: string;
  contentType: string;
  byteSizeHint: number;
  contentDisposition: string;
  scopeToken: string;
}

// 다운로드 artifact 의 고정 content-type — JSON dump 단일 포맷(§Out of Scope: 압축/SQL 포맷 후속).
const JSON_CONTENT_TYPE = "application/json";

// 파일명 base prefix — Export 산출물임을 사람이 식별하는 머리 토큰.
const FILE_NAME_PREFIX = "export";

// 허용 scope 집합 — VALID_EXPORT_SCOPES(T-0437) single-source 를 그대로 set 으로 감싼다(DRY).
const VALID_SCOPES: ReadonlySet<string> = new Set(VALID_EXPORT_SCOPES);

// plain object(null / 배열 / 비-object 아님) 판정 — top-level dump 입력 방어에 쓴다.
function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

// 비-plain-object 값의 표시명 — 메시지에 어떤 잘못된 입력이 왔는지 담는다.
function describeNonObject(value: unknown): string {
  return value === undefined
    ? "undefined"
    : value === null
      ? "null"
      : Array.isArray(value)
        ? "array"
        : typeof value;
}

// Invalid Date / 비-Date 입력은 명시적 error (buildExportDump.assertValidDate 동형 convention —
// options.now 검증에 쓴다).
function assertValidDate(value: unknown, label: string): asserts value is Date {
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) {
    throw new TypeError(
      `buildExportArtifactDescriptor: ${label} 은(는) 유효한 Date instance 여야 합니다`,
    );
  }
}

// timestamp 토큰 산출 — 우선순위: options.now(검증된 Date) → dump.generatedAt(ISO string 파싱).
// 둘 다 Invalid 면 fallback timestamp 토큰("unknown")으로 관대 처리(파일명 자체는 항상 안전한
// charset 유지 — §Negative (e) dump.generatedAt 비정상 값 방어). 반환 토큰은 ISO 문자열에서
// 파일명-안전 charset(영숫자)만 남긴 형태(예: 2026-06-17T03:04:05.000Z → 20260617T030405).
function resolveTimestampToken(
  dump: ExportDump,
  now: Date | undefined,
): string {
  // options.now 가 명시되면 그것을 우선(검증은 호출측에서 이미 수행).
  let source: Date | null = null;
  if (now !== undefined) {
    source = now;
  } else {
    // dump.generatedAt 은 ISO string — 파싱해 유효하면 사용, 아니면 null(fallback).
    const parsed = new Date(dump.generatedAt);
    if (!Number.isNaN(parsed.getTime())) {
      source = parsed;
    }
  }

  if (source === null) {
    return "unknown";
  }

  // ISO → 파일명-안전 토큰: 구분자(-, :, .)와 밀리초/Z 를 제거하고 영숫자 + 'T' 만 남긴다.
  // 결과는 path traversal/특수문자가 섞일 수 없는 [0-9A-Za-z] charset(§Negative (f)).
  const iso = source.toISOString(); // 예: 2026-06-17T03:04:05.000Z
  return iso
    .replace(/\.\d+Z$/, "") // 밀리초 + Z 제거
    .replace(/[^0-9A-Za-z]/g, ""); // 남은 비-영숫자(-, :, T 의 T 는 영문이라 보존) 제거
}

// UTF-8 byte length 추정 — JSON.stringify 결과를 Buffer 로 변환해 실제 byte 수를 센다(멀티바이트
// 한글 등도 정확히 cover). dump 가 직렬화 불가(순환 참조 등)면 throw 가 전파되나, 본 helper 의
// 입력은 직렬화 가능한 envelope 전제이므로 happy-path 에서는 발생하지 않는다.
function estimateByteSize(dump: ExportDump): number {
  const serialized = JSON.stringify(dump);
  return Buffer.byteLength(serialized, "utf8");
}

// buildExportArtifactDescriptor — dump envelope(T-0438)를 받아 다운로드 artifact descriptor 를
// 순수 조립한다(UC-07 §5 step13 + §8 (a)(c) 정합):
//   - scopeToken — dump.scope.scope(full/range/partial) 토큰.
//   - fileName — `export-<scopeToken>-<timestampToken>.json`(안전 charset — path traversal 0).
//   - contentType — `application/json`.
//   - byteSizeHint — JSON.stringify(dump) 의 UTF-8 byte length 추정.
//   - contentDisposition — `attachment; filename="<fileName>"`.
//
// timestamp 토큰은 options.now(제공 시) → dump.generatedAt(ISO string) → "unknown" 순서로
// fallback 한다. 입력 dump 객체·중첩 구조를 변형하지 않고 새 descriptor 객체를 반환한다
// (non-mutating — freeze 된 입력으로 호출해도 통과). 직렬화 전 안전을 위한 입력 방어:
//   - dump 가 plain object 아님(null / undefined / 숫자 / 문자열 / 배열) → TypeError.
//   - dump.scope 가 plain object 아님(부재 포함) → TypeError.
//   - dump.scope.scope 가 full/range/partial 외 값(빈 문자열 / "weird" / 대문자 / 숫자) →
//     RangeError(허용 enum 위반은 RangeError, shape 위반은 TypeError 로 구분).
//   - options.now 가 비-Date / Invalid Date → TypeError(assertValidDate convention).
export function buildExportArtifactDescriptor(
  dump: ExportDump,
  options?: { now?: Date },
): ExportArtifactDescriptor {
  // top-level dump 가 plain object 가 아니면 scope/generatedAt 에 접근할 수 없어 즉시 throw.
  if (!isPlainObject(dump)) {
    throw new TypeError(
      `buildExportArtifactDescriptor: dump 는 plain object 여야 합니다 (받음: ${describeNonObject(
        dump,
      )})`,
    );
  }

  // dump.scope shape 방어 — 비-object(부재 포함)면 scope.scope 에 접근할 수 없어 TypeError.
  const scopeValue = (dump as { scope?: unknown }).scope;
  if (!isPlainObject(scopeValue)) {
    throw new TypeError(
      `buildExportArtifactDescriptor: dump.scope 는 plain object 여야 합니다 (받음: ${describeNonObject(
        scopeValue,
      )})`,
    );
  }

  // dump.scope.scope 는 세 허용 값 외 거부 — 빈 문자열 / "weird" / 대문자 / 숫자 등 RangeError.
  const scopeKind = (scopeValue as { scope?: unknown }).scope;
  if (typeof scopeKind !== "string" || !VALID_SCOPES.has(scopeKind)) {
    throw new RangeError(
      `buildExportArtifactDescriptor: dump.scope.scope 는 full/range/partial 중 하나여야 합니다 ` +
        `(받음: ${String(scopeKind)})`,
    );
  }

  // options.now 가 명시되면 유효 Date 인지 검증(비-Date/Invalid Date 면 TypeError).
  const now = options?.now;
  if (now !== undefined) {
    assertValidDate(now, "options.now");
  }

  const scopeToken = scopeKind;
  const timestampToken = resolveTimestampToken(dump as ExportDump, now);

  // 파일명 — 모든 토큰이 안전 charset([0-9A-Za-z])이고 구분자는 '-' 뿐이라 path traversal
  // (`../`, `/`, `\`)이나 특수문자가 섞일 수 없다(§Negative (f) sanitize 보장).
  const fileName = `${FILE_NAME_PREFIX}-${scopeToken}-${timestampToken}.json`;

  return {
    fileName,
    contentType: JSON_CONTENT_TYPE,
    byteSizeHint: estimateByteSize(dump as ExportDump),
    contentDisposition: `attachment; filename="${fileName}"`,
    scopeToken,
  };
}
