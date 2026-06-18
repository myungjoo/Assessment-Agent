// export-descriptor-drift-verify — UC-07 Export 다운로드 descriptor single-source 강제 순수
// helper (T-0508, P7 R-57 / REQ-030 / REQ-032). 머지된 ADR-0046 (b718bb8) Decision §3 invariant
// 박제는 다음을 요구한다: "descriptor single-source — 다운로드 메타(fileName/contentType/
// Content-Length/Content-Disposition)는 buildExportArtifactDescriptor 산출물을 그대로 직렬화 —
// controller 가 헤더값을 새로 계산하지 않는다(drift 0)". 또 §Decision 1 은 descriptor 의
// byteSizeHint = Buffer.byteLength(JSON.stringify(dump), "utf8") 가 곧 materialization 의 직렬화
// 방식임을 박제했다 — 즉 descriptor 의 hint, 실 materialization 의 byte length, 그리고 chunk
// plan 의 totalBytes 셋이 모두 같은 값이어야 한다는 invariant 가 성립한다.
//
// 직전 chain 은 materializeExportDump(T-0506)와 sliceMaterializedDumpByChunkPlan(T-0507)이
// 직렬화·byte slice piece 를 박제했고, T-0507 은 자기 안에서 Buffer.byteLength(serialized) ===
// plan.totalBytes 만 강제했다. 그러나 descriptor 의 byteSizeHint 가 실 직렬화 byte / plan.totalBytes
// 와 어긋나는지(stale descriptor 가 잘못된 Content-Length 헤더를 만드는 drift) 를 controller/
// service 가 배선 전에 사전 검증하는 순수 helper 는 33+ helper 중 0 회 cover 된 gap 이다(git grep
// verifyExportDumpDescriptor|DescriptorDrift|descriptorByteDrift src/export → 0 매칭, main 미박제
// 확인). 본 함수는 그 gap 을 순수 함수 1 개로 닫는다 — ExportArtifactDescriptor + ExportDump(+
// 선택적 ExportChunkPlan)를 받아 hint·실 byte·plan.totalBytes 의 일치 여부와 drift 수치를 derive
// 하는 pure helper. controller/service/repository/stream pipe 배선은 후속 task 책임.
//
// 직렬화 방식은 export-artifact-descriptor.ts(estimateByteSize L104~110: Buffer.byteLength(
// JSON.stringify(dump), "utf8")) / export-dump-materialize.ts / export-dump-chunk-slice.ts 와
// 정확히 동일해야 drift 판정이 의미를 가진다 — 본 helper 가 직접 같은 산식을 호출한다. drift
// 자체는 throw 가 아니라 consistent: false 로 보고한다(검증 helper 는 판정만, throw 결정은 후속
// controller 책임 — controller 가 적절한 HTTP status / 헤더 보정 / 재계산 trigger 를 결정).
//
// DB / repository / controller / Readable stream / HTTP 헤더 직렬화 / chunk 별 drift 검증 / chunk
// 무결성(checksum) 은 전부 §Out of Scope. 본 helper 는 이미 메모리에 있는 descriptor + dump (+ plan)
// 만 입력으로 받아 in-memory report 객체만 반환한다. 새 도메인 타입 신설은 ExportDumpDescriptorDrift
// Report 1 종만, ExportArtifactDescriptor 는 ./export-artifact-descriptor, ExportDump 는
// ./export-dump, ExportChunkPlan 는 ./export-chunk-plan 에서 import 재사용. 새 외부 dependency
// 0(Node 내장 Buffer/JSON 만). 코드 골격은 export-dump-chunk-slice.ts(T-0507) 의 isPlainObject /
// describeNonObject 입력 방어 + 한국어 TypeError + non-mutating + freeze 통과 패턴을 mirror 한다.
import { ExportArtifactDescriptor } from "./export-artifact-descriptor";
import { ExportChunkPlan } from "./export-chunk-plan";
import { ExportDump } from "./export-dump";

// drift 검증 report — plain object. consistent 는 hint·실 byte (·plan.totalBytes) 가 모두 같은지
// 여부, hintBytes 는 descriptor.byteSizeHint 그대로, actualBytes 는 실 직렬화 byte length,
// planTotalBytes 는 plan 제공 시 plan.totalBytes / 미제공 시 null, hintActualDelta = hint - actual,
// hintPlanDelta 는 plan 제공 시 hint - planTotalBytes / 미제공 시 null, headline 은 사람 친화
// 한국어 한 줄 요약(일치/불일치 + delta 수치). 후속 controller / service 가 이 report 를 그대로
// 소비해 HTTP status / 헤더 보정 / 재계산 trigger 결정에 사용한다.
export interface ExportDumpDescriptorDriftReport {
  consistent: boolean;
  hintBytes: number;
  actualBytes: number;
  planTotalBytes: number | null;
  hintActualDelta: number;
  hintPlanDelta: number | null;
  headline: string;
}

// plain object(null / 배열 / 비-object 아님) 판정 — top-level descriptor / dump / plan 입력 방어
// 에 쓴다(export-dump-chunk-slice.isPlainObject 동형).
function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

// 비-plain-object 값의 표시명 — 메시지에 어떤 잘못된 입력이 왔는지 담는다
// (export-dump-chunk-slice.describeNonObject 동형).
function describeNonObject(value: unknown): string {
  return value === undefined
    ? "undefined"
    : value === null
      ? "null"
      : Array.isArray(value)
        ? "array"
        : typeof value;
}

// 값이 유효한 비-음수 정수(0 허용)인지 판정 — NaN/Infinity/소수/음수/비-number 거부. byteSizeHint
// 과 plan.totalBytes 검증에 쓴다(export-chunk-plan.isValidNonNegativeInteger 동형).
function isValidNonNegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

// verifyExportDumpDescriptorDrift — descriptor.byteSizeHint, 실 직렬화 byte length, (선택적)
// plan.totalBytes 의 일치 여부를 derive 하는 순수 helper. ADR-0046 §Decision 3 descriptor
// single-source invariant 정합:
//   (a) actualBytes = Buffer.byteLength(JSON.stringify(dump), "utf8") — estimateByteSize (export-
//       artifact-descriptor.ts L104~110) 와 정확히 같은 직렬화 방식(drift 판정의 전제).
//   (b) hintBytes = descriptor.byteSizeHint.
//   (c) hintActualDelta = hintBytes - actualBytes.
//   (d) plan 제공 시 planTotalBytes = plan.totalBytes / hintPlanDelta = hintBytes - planTotalBytes,
//       plan 미제공 시 둘 다 null.
//   (e) consistent = (hintActualDelta === 0) && (plan 미제공 ? true : hintPlanDelta === 0).
//
// 입력 객체·중첩 구조를 변형하지 않으며(non-mutating — Object.freeze 통과), 새 report 객체를 반환한다.
// 동일 입력 2 회 호출은 모든 필드까지 동등 결과(순수·결정성 — JSON.stringify 결정성에 위임).
// drift 자체는 throw 가 아니라 consistent: false 로 보고(검증 helper 는 판정만, throw 결정은 후속
// controller 책임).
//
// 입력 방어 (분기 분리 — branch coverage):
//   - descriptor 가 plain object 아님(null/undefined/숫자/문자열/배열) → TypeError(한국어 message).
//   - descriptor.byteSizeHint 가 비-음수 정수 아님(음수/소수/NaN/Infinity/비-number) → TypeError.
//   - dump 가 plain object 아님 → TypeError.
//   - plan 이 제공됐는데 plain object 아님(배열/null/원시값 — undefined 는 정상) → TypeError.
//   - plan 제공됐는데 plan.totalBytes 가 비-음수 정수 아님 → TypeError.
//   - 직렬화 불가 입력(순환 참조 등)은 JSON.stringify 의 native TypeError 가 그대로 전파.
export function verifyExportDumpDescriptorDrift(
  descriptor: ExportArtifactDescriptor,
  dump: ExportDump,
  plan?: ExportChunkPlan,
): ExportDumpDescriptorDriftReport {
  // top-level descriptor 가 plain object 가 아니면 byteSizeHint 접근 불가 — 즉시 throw.
  if (!isPlainObject(descriptor)) {
    throw new TypeError(
      `verifyExportDumpDescriptorDrift: descriptor 는 plain object 여야 합니다 (받음: ${describeNonObject(
        descriptor,
      )})`,
    );
  }

  // descriptor.byteSizeHint 는 0 이상의 정수여야 한다(0 hint 는 정상 — 빈 envelope 의 stale hint
  // 시나리오 cover). 음수/소수/NaN/Infinity/비-number 는 drift 판정 자체가 무의미 — TypeError.
  const hintBytes = (descriptor as { byteSizeHint: unknown }).byteSizeHint;
  if (!isValidNonNegativeInteger(hintBytes)) {
    throw new TypeError(
      `verifyExportDumpDescriptorDrift: descriptor.byteSizeHint 는 0 이상의 정수여야 합니다 (받음: ${String(
        hintBytes,
      )})`,
    );
  }

  // top-level dump 가 plain object 가 아니면 직렬화 의미가 없어 즉시 throw.
  if (!isPlainObject(dump)) {
    throw new TypeError(
      `verifyExportDumpDescriptorDrift: dump 는 plain object 여야 합니다 (받음: ${describeNonObject(
        dump,
      )})`,
    );
  }

  // plan 은 선택적 — undefined 면 plan-less 모드. 주어졌으면 plain object + totalBytes 검증.
  let planTotalBytes: number | null = null;
  if (plan !== undefined) {
    if (!isPlainObject(plan)) {
      throw new TypeError(
        `verifyExportDumpDescriptorDrift: plan 은 plain object 여야 합니다 (받음: ${describeNonObject(
          plan,
        )})`,
      );
    }
    const totalBytes = (plan as { totalBytes: unknown }).totalBytes;
    if (!isValidNonNegativeInteger(totalBytes)) {
      throw new TypeError(
        `verifyExportDumpDescriptorDrift: plan.totalBytes 는 0 이상의 정수여야 합니다 (받음: ${String(
          totalBytes,
        )})`,
      );
    }
    planTotalBytes = totalBytes;
  }

  // estimateByteSize / materializeExportDump / sliceMaterializedDumpByChunkPlan 과 정확히 같은
  // 직렬화 방식 — JSON.stringify(dump) 의 UTF-8 byte length. 직렬화 불가 입력은 native TypeError
  // 가 그대로 전파.
  const actualBytes = Buffer.byteLength(JSON.stringify(dump), "utf8");

  const hintActualDelta = hintBytes - actualBytes;
  const hintPlanDelta =
    planTotalBytes === null ? null : hintBytes - planTotalBytes;
  const consistent =
    hintActualDelta === 0 && (hintPlanDelta === null || hintPlanDelta === 0);

  // 사람 친화 한국어 요약 — 일치 시 "일치", 불일치 시 delta 수치를 담아 후속 log / WebUI 진행
  // view 가 그대로 표시 가능. plan 제공 여부에 따라 두 줄 요약을 모두 표현한다.
  const headline = consistent
    ? planTotalBytes === null
      ? `descriptor drift 검증: 일치 (hint=${hintBytes} B, actual=${actualBytes} B)`
      : `descriptor drift 검증: 일치 (hint=${hintBytes} B, actual=${actualBytes} B, plan.totalBytes=${planTotalBytes} B)`
    : planTotalBytes === null
      ? `descriptor drift 검증: 불일치 (hint=${hintBytes} B, actual=${actualBytes} B, hint-actual=${hintActualDelta} B)`
      : `descriptor drift 검증: 불일치 (hint=${hintBytes} B, actual=${actualBytes} B, plan.totalBytes=${planTotalBytes} B, hint-actual=${hintActualDelta} B, hint-plan=${String(
          hintPlanDelta,
        )} B)`;

  return {
    consistent,
    hintBytes,
    actualBytes,
    planTotalBytes,
    hintActualDelta,
    hintPlanDelta,
    headline,
  };
}
