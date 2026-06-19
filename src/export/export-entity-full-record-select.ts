// export-entity-full-record-select — UC-07 Export full-record DB-read 의 entity 별 allow-list
// select 상수 single-source (T-0514, ADR-0047 §Decision1·§Decision2). preview 의 `{instant}`
// 1-컬럼 projection(EXPORT_ENTITY_SOURCES.instantColumn)이 full-record read 로 확장될 때,
// 그 확장은 "전체 row read" 가 아니라 "본 allow-list 컬럼만 명시 select" 여야 한다(ADR-0047
// §Decision1). 후속 materialization service / repository query 가 본 상수를 contract 로 받아
// 바로 `delegate.findMany({ select })` 에 배선한다 — secret(`apiKey`)이 select 객체에 애초에
// 없음(projection-only deny, ADR-0047 §Decision2(b)(c))을 single-source 로 보장한다.
//
// 본 helper 는 dependency-free 순수 데이터 + key 타입만 — Prisma runtime import 0, DB /
// repository / controller / service 호출 0(ADR-0047 §Decision3(iii)). ExportEntity union 은
// export-scope-select.ts 에서 import(새 union 신설 금지). 컬럼 경계는 ADR-0047 §Decision1
// 표가 source 이며 prisma/schema.prisma 의 5 export entity scalar 컬럼과 일치한다.
import { ExportEntity } from "./export-scope-select";

// Prisma select 객체 형태 — `{ <컬럼>: true }`. 본 helper 는 Prisma runtime 을 import 하지
// 않으므로 자체 alias 로 형태만 표현한다(후속 caller 가 `findMany({ select })` 에 그대로 전달).
export type FullRecordSelect = Record<string, true>;

// EXPORT_ENTITY_FULL_RECORD_SELECT — 5 ExportEntity 별 full-record allow-list select 상수
// (ADR-0047 §Decision1 표 single-source). 각 entity 의 allow-list 컬럼만 `{ <col>: true }` 로
// 명시한다 — allow-list 는 명시적 opt-in 이라 표에 없는 컬럼(특히 secret)은 default deny.
//
// 🔥 LlmConfig(→ Prisma LlmProviderConfig) 의 select 에는 `apiKey` key 가 없다(ADR-0047
// §Decision2(b) deny-list). apiKey 는 외부 LLM 호출 자격증명(암호화 secret)이라 dump 유출 시
// 보안 사고 — select 객체에 애초에 넣지 않아 query 단계에서 read 자체가 안 된다.
//
// Record<ExportEntity, ...> 타입 강제 — ExportEntity union 에 새 entity 가 추가되면 본 상수가
// 컴파일 단계에서 누락을 catch(EXPORT_ENTITY_SOURCES 의 single-source 패턴 mirror).
//
// Object.freeze(deep) — 호출자가 반환 객체를 변형해도 본 상수 원본은 불변(non-mutating 보장).
export const EXPORT_ENTITY_FULL_RECORD_SELECT: Record<
  ExportEntity,
  FullRecordSelect
> = {
  // Assessment → Assessment — 전 컬럼이 derived 평가 결과(raw 외부 본문 0, ADR-0006 §4).
  Assessment: Object.freeze({
    id: true,
    personId: true,
    period: true,
    scope: true,
    periodStart: true,
    difficulty: true,
    contributionScore: true,
    volume: true,
    narrative: true,
    createdAt: true,
  }),
  // Person → Person — 인원 master 식별 컬럼. relation 배열은 scalar 아님 → 미포함. secret 0.
  Person: Object.freeze({
    id: true,
    fullName: true,
    email: true,
    active: true,
    partId: true,
    createdAt: true,
    updatedAt: true,
  }),
  // Group → Group — grouping master 식별 컬럼. secret / raw 0.
  Group: Object.freeze({
    id: true,
    name: true,
    createdAt: true,
    updatedAt: true,
  }),
  // LlmConfig → LlmProviderConfig — LLM provider 설정 master. 🔥 apiKey 는 명시 deny(부재).
  LlmConfig: Object.freeze({
    id: true,
    provider: true,
    endpointUrl: true,
    modelId: true,
    createdAt: true,
    updatedAt: true,
  }),
  // AuditLog → PermissionDeniedRecord — append-only audit row. instanceRef/resourceRef 는
  // 참조 식별자(token 미포함, ADR-0022 §1). 응답 본문 컬럼 schema 부재 → raw read 자리 0.
  AuditLog: Object.freeze({
    id: true,
    provider: true,
    instanceRef: true,
    resourceRef: true,
    principal: true,
    httpStatus: true,
    reason: true,
    createdAt: true,
  }),
};

// 허용 ExportEntity 집합 — derive 함수의 멤버십 검사용(VALID_EXPORT_ENTITIES 와 동일 5 집합,
// 본 상수의 key 가 source 라 drift 0).
const VALID_ENTITY_SET: ReadonlySet<string> = new Set(
  Object.keys(EXPORT_ENTITY_FULL_RECORD_SELECT),
);

// getExportEntityFullRecordSelect — 주어진 entity 의 full-record allow-list select 객체를
// 반환한다(ADR-0047 §Decision1·§Decision3(ii)). 반환 객체는 상수 원본의 방어 복제(shallow
// clone)라 호출자가 변형해도 원본 상수는 불변하다(non-mutating). entity 가 비-string 이면
// 한국어 TypeError, 알 수 없는 entity literal 이면 한국어 RangeError 를 throw 한다
// (export-scope-select 의 assert convention mirror).
//
// secret invariant: LlmConfig 반환 객체에는 `apiKey` key 가 절대 없다(상수 원본에 부재 →
// 복제본에도 부재). 후속 caller 는 본 반환을 그대로 `findMany({ select })` 에 전달한다.
export function getExportEntityFullRecordSelect(
  entity: ExportEntity,
): FullRecordSelect {
  if (typeof entity !== "string") {
    throw new TypeError(
      `getExportEntityFullRecordSelect: entity 는 문자열이어야 합니다 (받음: ${typeof entity})`,
    );
  }

  if (!VALID_ENTITY_SET.has(entity)) {
    throw new RangeError(
      `getExportEntityFullRecordSelect: 지원하지 않는 entity 입니다 (받음: ${entity})`,
    );
  }

  // 방어 복제 — 상수 원본(frozen)을 변형 없이 보호하면서 호출자가 자유롭게 다룰 새 객체 반환.
  return { ...EXPORT_ENTITY_FULL_RECORD_SELECT[entity] };
}
