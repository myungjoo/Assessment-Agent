// export-dump-checksum — UC-07 Export dump 무결성 checksum 산출·검증 순수 helper (T-0446, P7
// R-57 / REQ-030 / REQ-032). T-0437(scope select) → T-0438(dump envelope 조립) → T-0439(version
// gate) → T-0440(구조 gate) → T-0441(영향 요약) → T-0442(복원 plan) → T-0443(audit 항목) →
// T-0444(scope validate) → T-0445(상수 DRY) 9 building block 다음, 그들이 cover 못 한 UC-07
// §5 step 5 Note("Import: file 무결성 hash — REQ-030, REQ-032") + §7.4("payload 무결성 hash
// 검증 실패 → 400, transaction 시작 전 reject") 의 **결정적 checksum 산출·검증 로직**을 순수
// 함수로 박제한다. validateImportDumpStructure(T-0440)는 구조(필드 shape·entityCounts cross-
// check)만 보므로 payload 가 전송 중 byte-level 로 손상·변조됐는지는 검출 불가 — 결정적
// checksum 이 그 gap 을 메운다(구조는 멀쩡한데 instant 한 글자가 바뀐 변조도 잡힌다).
//
// persistence/repository/DB query · file parse · JSON.parse(file→dump) · 실 streaming · 압축
// archive 해제 · REST 배선 호출 0 인 순수 결정 로직이며, Node 내장 `crypto`(createHash('sha256'))
// 만 사용해 **새 외부 dependency 0** 이다. REQ-032(raw 미저장)는 입력 dump 의 직렬화 표현만
// hash 하고 raw 를 새로 fetch 하지 않으므로 helper layer 에서 자연 유지된다. HMAC / 서명 /
// 암호화(secret key) 같은 인증된 무결성은 본 helper scope 아님(security 게이트 → 별도 ADR) —
// 본 helper 는 전송 손상·변조 검출용 단순 결정적 checksum 만 산출한다.
//
// 코드 골격은 export-dump.ts(순수-helper + 입력 방어 throw + 한국어 message)와 import-dump-
// validate.ts(비-throw verdict 반환)의 두 sibling 패턴을 함께 mirror 한다 — compute 측은 입력
// 방어 throw(잘못된 입력은 checksum 산출 불가), verify 측은 비-throw verdict(§7.4 의 검증 verdict).
// 새 타입/상수는 신설하지 않고 export-dump.ts 의 ExportDump 를 그대로 재사용한다.
import { createHash } from "crypto";

import { ExportDump } from "./export-dump";
import { ExportEntity, ExportRecord } from "./export-scope-select";

// checksum 대상 envelope 의 entityCounts 가 항상 가져야 하는 5 entity (UC-07 §6.1 entitySelector
// 목록 — export-dump.ts ALL_ENTITIES 와 동일 집합). canonical 직렬화 시 이 고정 순서로 count 를
// 박제해 JS object key 순서 비결정성을 회피한다. export-dump.ts 의 ALL_ENTITIES 는 export 되지
// 않아 본 파일에 같은 값을 mirror 한다.
const ALL_ENTITIES: ReadonlyArray<ExportEntity> = [
  "Assessment",
  "Person",
  "Group",
  "LlmConfig",
  "AuditLog",
];

// verifyDumpChecksum 의 verdict — plain object. 재계산한 computed 와 정규화한 expected 를 함께
// 반환해 mismatch 시 호출측(Import 배선)이 어느 쪽이 다른지 진단할 수 있다(§7.4 안내). valid 는
// computed === 정규화(expected) 의 결과이며 throw 하지 않는다(검증 verdict — early-throw 아님).
export interface DumpChecksumVerification {
  valid: boolean;
  computed: string;
  expected: string;
}

// 입력 방어 — 비-Date / Invalid Date 는 결정적 직렬화가 불가능하므로 명시적 TypeError
// (export-dump.ts / export-scope-select.ts 의 assertValidDate 와 동형 message convention).
function assertValidInstant(
  value: unknown,
  label: string,
): asserts value is Date {
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) {
    throw new TypeError(
      `computeDumpChecksum: ${label} 은(는) 유효한 Date instance 여야 합니다`,
    );
  }
}

// dump 를 **결정적 정규화 직렬화** 한다 — JSON.stringify 는 object key 삽입 순서에 의존해
// 비결정적일 수 있으므로(같은 논리 dump 라도 key 순서가 다르면 다른 문자열) field 순서를 명시적
// canonical 순서로 고정한다. record 배열 순서는 보존(순서 자체가 dump 의미의 일부)하되 각 record
// 의 entity/instant 는 고정 순서로 박제한다. scope 는 JSON.stringify 로 직렬화하되 그 안의 선택
// field(dateRange/entitySelector)도 명시 순서로 펼쳐 결정성을 보장한다.
function canonicalize(dump: ExportDump): string {
  // top-level 가 plain object 가 아니면 field 접근이 불가능하므로 즉시 방어.
  if (typeof dump !== "object" || dump === null || Array.isArray(dump)) {
    throw new TypeError(
      `computeDumpChecksum: dump 는 ExportDump 객체여야 합니다 (받음: ${
        dump === null ? "null" : Array.isArray(dump) ? "array" : typeof dump
      })`,
    );
  }

  // schemaVersion / generatedAt — checksum 대상 헤더. 누락/비-string 이면 결정적 직렬화 불가.
  if (typeof dump.schemaVersion !== "string") {
    throw new TypeError(
      `computeDumpChecksum: schemaVersion 은 string 이어야 합니다 (받음: ${typeof dump.schemaVersion})`,
    );
  }
  if (typeof dump.generatedAt !== "string") {
    throw new TypeError(
      `computeDumpChecksum: generatedAt 은 string 이어야 합니다 (받음: ${typeof dump.generatedAt})`,
    );
  }

  // records 가 배열이 아니면 순회 불가 — 방어 throw.
  if (!Array.isArray(dump.records)) {
    throw new TypeError(
      `computeDumpChecksum: records 는 배열이어야 합니다 (받음: ${typeof dump.records})`,
    );
  }

  // entityCounts — 5 entity 를 고정 순서로 직렬화(JS object key 순서 비의존). 누락 key 는 0 으로
  // 취급하지 않고 명시적으로 NaN 회피를 위해 number 검증; 비-number 면 방어 throw.
  const counts = dump.entityCounts as
    | Record<string, unknown>
    | null
    | undefined;
  if (typeof counts !== "object" || counts === null || Array.isArray(counts)) {
    throw new TypeError(
      `computeDumpChecksum: entityCounts 는 객체여야 합니다 (받음: ${
        counts === null ? "null" : typeof counts
      })`,
    );
  }
  const countsParts: string[] = [];
  for (let i = 0; i < ALL_ENTITIES.length; i += 1) {
    const key = ALL_ENTITIES[i];
    const value = (counts as Record<string, unknown>)[key];
    if (typeof value !== "number" || Number.isNaN(value)) {
      throw new TypeError(
        `computeDumpChecksum: entityCounts.${key} 는 number 여야 합니다 (받음: ${typeof value})`,
      );
    }
    countsParts.push(`${key}=${value}`);
  }

  // records — 입력 순서 보존 + 각 record 를 entity|instant(ISO) 고정 순서로 펼친다. instant 는
  // Invalid Date 면 방어 throw(직렬화 불가). index 를 message 에 담아 진단성 확보.
  const recordParts: string[] = [];
  for (let index = 0; index < dump.records.length; index += 1) {
    const record: ExportRecord = dump.records[index];
    assertValidInstant(record?.instant, `records[${index}].instant`);
    recordParts.push(
      `${String(record.entity)}@${record.instant.toISOString()}`,
    );
  }

  // scope 는 결정적 직렬화 — scope 종류 + dateRange(있으면 ISO 경계) + entitySelector(있으면
  // 입력 순서). 선택 field 부재는 명시 토큰으로 구분(undefined vs 빈 배열).
  const scope = dump.scope;
  const scopeKind =
    scope && typeof scope === "object" ? String(scope.scope) : String(scope);
  let scopeRange = "none";
  if (scope && scope.dateRange) {
    assertValidInstant(scope.dateRange.start, "scope.dateRange.start");
    assertValidInstant(scope.dateRange.end, "scope.dateRange.end");
    scopeRange = `${scope.dateRange.start.toISOString()}..${scope.dateRange.end.toISOString()}`;
  }
  const scopeEntities =
    scope && scope.entitySelector ? scope.entitySelector.join(",") : "none";

  // recordCount — number 검증 후 박제(structure gate 와 별개로 checksum 의 한 축).
  const recordCount = dump.recordCount;
  if (typeof recordCount !== "number" || Number.isNaN(recordCount)) {
    throw new TypeError(
      `computeDumpChecksum: recordCount 는 number 여야 합니다 (받음: ${typeof recordCount})`,
    );
  }

  // 모든 축을 줄바꿈으로 결합 — 각 field 가 명시 prefix 를 가져 field 경계 모호성(예: 한 field
  // 의 끝이 다음 field 의 시작과 붙어 같은 직렬화를 만드는 collision)을 줄인다.
  return [
    `schemaVersion=${dump.schemaVersion}`,
    `generatedAt=${dump.generatedAt}`,
    `scopeKind=${scopeKind}`,
    `scopeRange=${scopeRange}`,
    `scopeEntities=${scopeEntities}`,
    `recordCount=${recordCount}`,
    `entityCounts=${countsParts.join("&")}`,
    `records=${recordParts.join(";")}`,
  ].join("\n");
}

// computeDumpChecksum — ExportDump 의 결정적 정규화 직렬화 후 sha256 hex digest(64자 소문자
// hex)를 산출한다. UC-07 §5 step 5 Note / §7.4 정합:
//   - 같은 논리 입력 → 항상 같은 digest(결정성). field/record 가 한 가지라도 다르면 다른 digest.
//   - record 순서는 dump 의미의 일부이므로 보존(순서가 다르면 다른 digest).
//   - 잘못된 입력(null dump / 누락 헤더 / records 비-배열 / Invalid Date instant 등)은 결정적
//     직렬화가 불가능하므로 TypeError(한국어 message) — checksum 산출 자체를 거부한다.
// 입력 인자를 변형하지 않는다(non-mutating — freeze 된 dump/records 로 호출해도 통과).
export function computeDumpChecksum(dump: ExportDump): string {
  const canonical = canonicalize(dump);
  return createHash("sha256").update(canonical, "utf8").digest("hex");
}

// verifyDumpChecksum — dump 를 재계산한 checksum 과 expected 를 case-insensitive 비교해 verdict
// 를 반환한다(§7.4 의 검증 verdict — early-throw 아님). hex digest 는 대소문자 의미가 없으므로
// 대소문자만 다른 expected 는 valid:true. computed/expected 를 함께 반환해 mismatch 시 호출측이
// 진단 가능. expected 가 비-string 이면 빈 문자열로 정규화해 항상 mismatch(valid:false) 로 만든다
// (잘못된 expected 입력도 throw 없이 verdict 로 흡수 — 검증 흐름은 transaction 전 reject 판정용).
// dump 자체가 잘못돼 computeDumpChecksum 이 throw 하면 그 throw 는 전파된다(입력 방어는 compute
// 책임 — verify 는 expected 비교 verdict 만 담당).
export function verifyDumpChecksum(
  dump: ExportDump,
  expected: string,
): DumpChecksumVerification {
  const computed = computeDumpChecksum(dump);
  // hex digest 는 대소문자 무의미 — 양쪽을 소문자로 정규화해 비교. 비-string expected 는 빈
  // 문자열로 정규화(64자 hex 와 절대 일치하지 않아 valid:false).
  const normalizedExpected =
    typeof expected === "string" ? expected.toLowerCase() : "";
  return {
    valid: computed === normalizedExpected,
    computed,
    expected: normalizedExpected,
  };
}
