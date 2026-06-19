// export-full-record — UC-07 Export full-record materialization 입력 contract 순수 helper
// (T-0515, P7 R-57 / REQ-030 / REQ-032, ADR-0047 §Decision1·§Decision2). T-0514 의
// EXPORT_ENTITY_FULL_RECORD_SELECT allow-list 상수의 소비측 짝이다 — preview 의 `{instant}`
// 1-컬럼 projection 을 넘어 dump 가 담을 full record payload(`fields`)를 표현하는 타입 +
// 그 payload 를 검증·조립하는 dependency-free 순수 builder.
//
// 본 helper 는 DB / Prisma / repository / service / controller 를 일절 건드리지 않는다
// (Prisma runtime import 0 — ADR-0047 §Decision3(iii)). 실 full-record DB read(impure)
// 배선은 본 task 의 다음 step 이며 별도 task 다. 코드 골격은 export-scope-select.ts /
// export-dump.ts 의 순수-helper 패턴(assertValidDate · 입력 비변형 · 한국어 error)과
// export-entity-full-record-select.ts 의 allow-list source 활용을 mirror 한다.
//
// 🔥 핵심 invariant(ADR-0047 §Decision2(b)): `fields` 에 deny-listed secret key(특히
// LlmConfig 의 apiKey)가 섞이면 본 builder 가 2 차 단언으로 RangeError 를 throw 한다.
// 1 차 guard 는 query 단계의 projection-only(select 에 secret 부재 — T-0514 상수)이며,
// 본 builder 는 조립 layer 의 마지막 그물로 secret 의 dump 혼입을 차단한다.
import {
  EXPORT_ENTITY_FULL_RECORD_SELECT,
  FullRecordSelect,
} from "./export-entity-full-record-select";
import { ExportEntity, ExportRecord } from "./export-scope-select";

// FullExportRecord — 현 ExportRecord(`{entity, instant}`)를 확장해 full-record payload
// `fields` 를 추가한 dump 단위. entity/ExportRecord 는 export-scope-select.ts 에서 import
// 재사용한다(새 union/record 신설 금지 — ADR-0047 §Out of scope). `fields` 는 해당 entity 의
// allow-list 컬럼 값들을 담은 plain object(예: { id, fullName, email, ... }).
export interface FullExportRecord extends ExportRecord {
  fields: Record<string, unknown>;
}

// allow-list 외 임의 key 정책(ADR-0047 §Decision2 정합 분기 — 명시 박제):
//   본 builder 는 "엄격 거부(strict reject)" 를 채택한다 — `fields` 의 모든 key 는 해당
//   entity 의 allow-list(EXPORT_ENTITY_FULL_RECORD_SELECT[entity]) 안에 있어야 하며, allow-list
//   외 key(secret 포함 / 미정의 컬럼 포함)가 하나라도 있으면 RangeError 를 throw 한다.
//   근거: allow-list 는 명시적 opt-in 이라 표 밖 컬럼은 default deny(§Decision2(b)).
//   "무시(silent drop)" 가 아니라 "거부" 인 이유 — secret(apiKey)이 silent 하게 떨어지면
//   호출자가 secret 을 넘긴 사실 자체를 모른 채 진행해 상류 query 결함을 숨긴다. 엄격 거부는
//   상류(repository select)가 deny 컬럼을 잘못 read 한 경우를 조립 단계에서 즉시 드러낸다.
//   향후 다른 secret key(token 등)가 어느 entity 에 추가돼도 allow-list 에 없으면 동형으로
//   본 단언이 catch 한다(secret 전용 분기 불요 — allow-list 멤버십 검사가 일반화된 그물).

// 비-Date / Invalid Date 입력은 명시적 error(export-scope-select.assertValidDate 와 동형
// message convention — 해당 helper 가 export 되지 않아 본 파일에 mirror 한다).
function assertValidDate(value: unknown, label: string): asserts value is Date {
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) {
    throw new TypeError(
      `buildFullExportRecord: ${label} 은(는) 유효한 Date instance 여야 합니다`,
    );
  }
}

// plain object 판정 — null / 배열 / Date / 함수 / primitive 를 거부하고 순수 객체만 허용.
// `fields` 는 컬럼명→값 map 이어야 하므로 Object literal / Object.create(null) 만 통과한다.
function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== "object") {
    return false;
  }
  if (Array.isArray(value) || value instanceof Date) {
    return false;
  }
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

// buildFullExportRecord — entity / instant / fields 를 검증한 뒤 동결된 FullExportRecord 를
// 반환한다(ADR-0047 §Decision1·§Decision2). 검증 분기:
//   - entity 가 비-string 이면 TypeError, allow-list(5 entity) 밖이면 RangeError.
//   - instant 가 비-Date/Invalid Date 면 TypeError.
//   - fields 가 plain object 가 아니면(null/undefined/배열/Date 등) TypeError.
//   - fields 의 key 중 해당 entity allow-list 밖(secret apiKey 포함)이 있으면 RangeError.
//
// 입력 `fields` 객체를 변형하지 않고 그 얕은 복제를 동결해 반환한다(non-mutating —
// Object.freeze(fields) 로 호출해도 통과). 반환 FullExportRecord 와 그 `fields` 는 frozen.
// 빈 `fields`(allow-list 컬럼이 하나도 없는 경계)는 정상 허용한다(error 아님).
export function buildFullExportRecord(
  entity: ExportEntity,
  instant: Date,
  fields: Record<string, unknown>,
): FullExportRecord {
  // entity 타입 분기 — 비-string 거부.
  if (typeof entity !== "string") {
    throw new TypeError(
      `buildFullExportRecord: entity 는 문자열이어야 합니다 (받음: ${typeof entity})`,
    );
  }

  // entity 멤버십 분기 — allow-list 상수의 key 가 5 entity source(미지원 literal 거부).
  const allowSelect: FullRecordSelect | undefined =
    EXPORT_ENTITY_FULL_RECORD_SELECT[entity as ExportEntity];
  if (!allowSelect) {
    throw new RangeError(
      `buildFullExportRecord: 지원하지 않는 entity 입니다 (받음: ${entity})`,
    );
  }

  // instant 유효성 분기 — 비-Date/Invalid Date 거부.
  assertValidDate(instant, "instant");

  // fields 형태 분기 — plain object 만 허용.
  if (!isPlainObject(fields)) {
    throw new TypeError(
      `buildFullExportRecord: fields 는 plain object 여야 합니다 (받음: ${
        fields === null
          ? "null"
          : Array.isArray(fields)
            ? "array"
            : typeof fields
      })`,
    );
  }

  // secret / allow-list 외 key 분기(🔥 REQ-032 §Decision2(b) 2 차 단언) — fields 의 모든
  // key 가 해당 entity allow-list 안에 있어야 한다. apiKey 등 deny key 는 allow-list 에
  // 없으므로 본 검사가 자연 catch 한다.
  const copied: Record<string, unknown> = {};
  for (const key of Object.keys(fields)) {
    if (!Object.prototype.hasOwnProperty.call(allowSelect, key)) {
      throw new RangeError(
        `buildFullExportRecord: ${entity} 의 fields 에 allow-list 외 key 가 있습니다 ` +
          `(받음: ${key}) — secret/미정의 컬럼은 dump 에 포함될 수 없습니다`,
      );
    }
    // 입력 비변형 — 새 객체로 얕은 복제(원본 fields 는 frozen 이어도 무관).
    copied[key] = fields[key];
  }

  // 동결된 FullExportRecord 반환 — fields 도 동결해 caller 변형으로부터 보호(non-mutating).
  return Object.freeze({
    entity: entity as ExportEntity,
    instant,
    fields: Object.freeze(copied),
  });
}
