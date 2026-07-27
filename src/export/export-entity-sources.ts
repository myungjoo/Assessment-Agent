// export-entity-sources — ExportEntity → Prisma delegate accessor · model 이름 · instant
// 컬럼 매핑의 공용 single-source (T-1263, ADR-0055 §Follow-up (b) 복원 엔진 chain 아홉 번째
// slice). 기존에 export-job.service.ts 안에 module-private 로 박혀 있던 EXPORT_ENTITY_SOURCES
// 를 그대로 승격시킨 순수 데이터 module 이다 — 런타임 동작 변경 0 의 추출.
//
// 왜 공용 module 인가:
//   - 하류 복원 엔진(ADR-0044 §3 atomic `$transaction` slice)은 ImportRestoreOperation 의
//     `entity` literal 로부터 실제 `prisma.<delegate>.createMany(...)` 를 호출해야 해서 같은
//     매핑이 필요하다. service-private 상태로 두면 세 번째 사본이 생긴다.
//   - import-restore-order.spec.ts 에 이미 두 번째 사본(ENTITY_TO_PRISMA_MODEL)이 있었고
//     (T-1261 reviewer round 2 NIT-1), 본 module 이 그 사본을 흡수한다.
//   - Record<ExportEntity, ...> 타입 강제를 한 곳에 모아 entity 추가 시 컴파일 단계에서
//     누락을 catch 한다(R-112 negative — entity 확장 회귀 방지).
//
// 책임 경계 (task §Out of Scope): 순수 데이터 + 조회 함수만 — Prisma client 인스턴스 ·
// DB 접근 · repository · file I/O · REST 배선 0. delegate 를 실제로 호출하지 않는다(이름만
// 다룬다). export-entity-full-record-select.ts 의 sibling 규약(Object.freeze + 한국어
// TypeError/RangeError assert)을 그대로 mirror 한다.
import { ExportEntity } from "./export-scope-select";

// PrismaService 의 delegate accessor 이름 union — 5 export entity 가 read/write 하는 Prisma
// model 접근자. 본 union 으로 EXPORT_ENTITY_SOURCES 의 delegate 값을 컴파일 차원에서 실
// accessor 로 제약한다(오타 catch). 소비처(export-job.service.ts)는 findMany({ select })
// projection-only read 에만 쓴다.
export type ExportEntityDelegate =
  | "assessment"
  | "person"
  | "group"
  | "llmProviderConfig"
  | "permissionDeniedRecord";

// ExportEntitySource — entity 1 개에 대한 매핑 3 축.
//   - delegate — PrismaService 의 accessor 이름(camelCase). 실 query 호출 시 인덱싱 key.
//   - model — prisma/schema.prisma 의 model 이름(PascalCase). schema 원문 파싱 · 로그 ·
//     오류 메시지처럼 "model 이름" 이 필요한 곳에서 쓴다.
//   - instantColumn — range scope [start, end) 판정에 쓰는 instant 컬럼 이름.
export interface ExportEntitySource {
  delegate: ExportEntityDelegate;
  model: string;
  instantColumn: string;
}

// EXPORT_ENTITY_SOURCES — 5 ExportEntity(UC-07 §6.1 entitySelector 목록) → Prisma
// model delegate accessor + model 이름 + instant 컬럼 매핑표 (T-0497 architect 결정,
// ADR-0044 §1 dump 대상 entity 정합). ExportEntity union 의 5 literal 과 Prisma model
// 이름이 일부 다른(LlmConfig→LlmProviderConfig, AuditLog→PermissionDeniedRecord) 차이를
// 본 표가 흡수한다(schema·helper 변경 0).
//
// 🔥 model 은 delegate 문자열에서 파생(첫 글자 대문자화 등)시키지 않고 **명시 값**으로
// 박제한다 — Prisma 의 delegate↔model naming convention 이 바뀌거나 예외 model 이 생기면
// 파생식이 조용히 틀린 이름을 만들어내기 때문이다(오타·convention 변경 취약성 제거).
//
// instant 컬럼 결정(UC-07 §6.1 range scope [start,end) 판정의 "record 가 생성/발생한
// 시각" 의미 정합): 5 model 모두 `createdAt`(row 생성 시각)을 instant 로 쓴다 —
// Assessment 는 평가 record 생성, Person/Group/LlmProviderConfig 는 master record 생성,
// PermissionDeniedRecord(=AuditLog) 는 감사 사건 발생 시각으로 모두 createdAt 이 자연.
//
// Record<ExportEntity, ...> 타입 강제 — ExportEntity union 에 새 entity 가 추가되면
// 본 표가 컴파일 단계에서 누락을 catch(R-112 negative — entity 확장 회귀 방지).
//
// Object.freeze(표 자체 + 각 value) — 호출자가 매핑을 변형해 다른 소비처의 동작을 바꾸는
// 사고를 차단한다(단일 source-of-truth 의 불변성 보장).
//
// 🔥 REQ-032 projection-only — value 의 `instantColumn` 만 Prisma `select` 로 read 하고
// 전체 row·raw 본문 컬럼은 select 하지 않는다(export-job.service.ts 의 findMany select).
export const EXPORT_ENTITY_SOURCES: Readonly<
  Record<ExportEntity, ExportEntitySource>
> = Object.freeze({
  Assessment: Object.freeze<ExportEntitySource>({
    delegate: "assessment",
    model: "Assessment",
    instantColumn: "createdAt",
  }),
  Person: Object.freeze<ExportEntitySource>({
    delegate: "person",
    model: "Person",
    instantColumn: "createdAt",
  }),
  Group: Object.freeze<ExportEntitySource>({
    delegate: "group",
    model: "Group",
    instantColumn: "createdAt",
  }),
  LlmConfig: Object.freeze<ExportEntitySource>({
    delegate: "llmProviderConfig",
    model: "LlmProviderConfig",
    instantColumn: "createdAt",
  }),
  AuditLog: Object.freeze<ExportEntitySource>({
    delegate: "permissionDeniedRecord",
    model: "PermissionDeniedRecord",
    instantColumn: "createdAt",
  }),
});

// 허용 ExportEntity 집합 — 조회 함수의 멤버십 검사용. 본 매핑표의 key 가 source 라 표와
// drift 0 이며, prototype 상속 속성(`__proto__` / `constructor` / `toString`)이 멤버로
// 오탐되지 않는다(Set 은 자기 원소만 안다 — `in` 연산자·직접 인덱싱과 다른 지점).
const VALID_ENTITY_SET: ReadonlySet<string> = new Set(
  Object.keys(EXPORT_ENTITY_SOURCES),
);

// exportEntityPrismaModel — 주어진 ExportEntity 에 대응하는 Prisma model 이름(PascalCase)
// 을 반환한다. 매핑표의 명시 값을 그대로 돌려주는 non-mutating 조회이며, 반환값은 primitive
// string 이라 호출자가 그것을 어떻게 다루든 표 원본에 영향이 없다.
//
// entity 가 비-string 이면 한국어 TypeError, 알 수 없는 entity literal 이면 한국어
// RangeError 를 throw 한다(export-entity-full-record-select.ts 의 assert convention mirror).
//
// 🔥 REQ-032 — 비-string 입력은 **타입 이름만** 메시지에 싣는다. 입력 객체를 문자열로 강제
// 변환하면 raw payload 조각(예: record 필드)이 error message·로그로 새어나갈 수 있다.
export function exportEntityPrismaModel(entity: ExportEntity): string {
  if (typeof entity !== "string") {
    throw new TypeError(
      `exportEntityPrismaModel: entity 는 문자열이어야 합니다 (받음: ${typeof entity})`,
    );
  }

  if (!VALID_ENTITY_SET.has(entity)) {
    throw new RangeError(
      `exportEntityPrismaModel: 지원하지 않는 entity 입니다 (받음: ${entity})`,
    );
  }

  return EXPORT_ENTITY_SOURCES[entity].model;
}
