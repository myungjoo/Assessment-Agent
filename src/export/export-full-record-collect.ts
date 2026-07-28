// export-full-record-collect — 5 export entity 의 full-record allow-list DB-read 를 client 인자로
// 받는 공용 helper (T-1280, ADR-0055 §Follow-up (b) 복원 엔진 chain 실행 slice **3c-2a**).
// 기존에 export-job.service.ts 안에 private 메서드로 박혀 있던 collectFullExportRecords 본문을
// 그대로 승격시킨 추출이다 — 런타임 동작 변경 0 (필터 · 정렬 · 재시도 · 로깅 · 캐시 0).
//
// 왜 공용 helper 인가:
//   - 다음 slice (3c-2b) 의 복원 orchestrator 는 prepareImportRestorePlan 의 두 번째 인자인
//     "기존 record 배열(FullExportRecord[])" 을 어디선가 읽어와야 한다. 읽기 로직이
//     service-private 로 남아 있으면 import 경로가 없어 두 번째 사본이 생긴다.
//   - client 를 **인자로** 받으므로 ImportModule 이 ExportModule / ExportJobService 를 import 할
//     필요가 없다 — cross-module DI 결합 0 (import-restore-run-steps.ts 의 ImportRestoreTxClient
//     규약 mirror). 실 Prisma 타입 캐스팅은 helper 안이 아니라 **호출자** 몫이다.
//   - ExportJobService 의 동명 private 메서드는 같은 commit 에서 본 helper 로 위임하도록 바꿨다
//     (사본 0 — 이름 · 시그니처 · 호출처는 그대로).
//
// 책임 경계 (task §Out of Scope): 순수 read + 조립만 — PrismaService 주입 · $transaction ·
// scope 기반 선별 · pagination · streaming chunk read · 성능 최적화(배치 · 커서) 0.
import { getExportEntityFullRecordSelect } from "./export-entity-full-record-select";
import {
  EXPORT_ENTITY_SOURCES,
  type ExportEntityDelegate,
  type ExportEntitySource,
} from "./export-entity-sources";
import {
  buildFullExportRecord,
  type FullExportRecord,
} from "./export-full-record";
import { type ExportEntity } from "./export-scope-select";

// delegate 1 개가 제공해야 하는 최소 surface — allow-list projection read 전용. Prisma 의 실
// findMany 시그니처는 model 마다 다른 union 이라 본 helper 는 "select 를 받아 row 배열을
// 돌려준다" 는 좁은 형태만 요구한다 (evaluation-result-persist.service · ImportRestoreDelegateClient
// 의 좁은 선언 선례).
export interface ExportFullRecordReadDelegate {
  findMany: (args: {
    select: Record<string, true>;
  }) => Promise<Array<Record<string, unknown>>>;
}

// 실 `PrismaService` 캐스팅은 호출자 몫 — 아래 5 delegate key 가 본 read 가 요구하는 client 의
// 전부다 (ImportRestoreTxClient 규약 mirror). Readonly 라 helper 가 client 를 변형하지 않음이
// 타입 차원에서도 드러난다.
export type ExportFullRecordReadClient = Readonly<
  Record<ExportEntityDelegate, ExportFullRecordReadDelegate>
>;

// collectFullExportRecords — 5 entity 에서 full-record allow-list 컬럼만 projection read 후
// FullExportRecord[] 로 평탄화한다 (T-0516 원본, ADR-0047 §Decision1·§Decision2·§Decision3).
// EXPORT_ENTITY_SOURCES 매핑표를 돌며 각 delegate.findMany({ select:
// getExportEntityFullRecordSelect(entity) }) 로 read 한다 — 전체 row 읽기(findMany() 무인자 /
// select 생략) 금지, 명시 projection 만 (REQ-032 / §Decision3(ii)).
//
// 🔥 secret deny: getExportEntityFullRecordSelect 는 T-0514 상수의 방어 복제라 LlmConfig select
// 객체에 apiKey key 가 애초에 없다(query 단계 1 차 그물). row → fields 조립은
// buildFullExportRecord 에 위임해 allow-list 외 key(상류 select 결함 시뮬 시 apiKey 등)가 섞이면
// RangeError 로 거부(조립 단계 2 차 그물 — §Decision2(b)). instant(createdAt)가 비-Date/누락이면
// buildFullExportRecord 의 TypeError 가 swallow 없이 propagate.
//
// 빈 DB(전 entity 빈 배열)는 빈 FullExportRecord[] 정상 반환(throw 0, 경계). 일부 entity 만 row
// 존재해도 존재 entity 분만 평탄 반환. delegate.findMany reject(의존성 실패)는 Promise.all 이
// 인스턴스 그대로 propagate(swallow 0). client 에 delegate 가 누락돼 있으면 조용히 빈 배열을
// 돌려주지 않고 접근 시점의 TypeError 가 그대로 전파된다.
//
// 비변형 — 입력 client 를 읽기만 하고(key 추가 · 함수 교체 0) 매 호출마다 새 배열을 조립해
// 반환한다(같은 client 로 두 번 불러도 반환 인스턴스는 서로 다르다).
export async function collectFullExportRecords(
  client: ExportFullRecordReadClient,
): Promise<FullExportRecord[]> {
  const entries = Object.entries(EXPORT_ENTITY_SOURCES) as Array<
    [ExportEntity, ExportEntitySource]
  >;

  const perEntity = await Promise.all(
    entries.map(async ([entity, source]) => {
      const delegate = client[source.delegate];
      // 🔥 allow-list projection-only — T-0514 상수의 방어 복제 select(apiKey 부재).
      const rows = await delegate.findMany({
        select: getExportEntityFullRecordSelect(entity),
      });
      // row → FullExportRecord 조립. instant 는 entity 별 instant 컬럼(createdAt) 값을 Date 로
      // forward(비-Date/누락 시 builder TypeError). fields 는 row 전체를 넘겨 builder 의
      // allow-list 멤버십 단언(allow-list 외 key → RangeError)에 맡긴다.
      return rows.map((row) =>
        buildFullExportRecord(entity, row[source.instantColumn] as Date, row),
      );
    }),
  );

  return perEntity.flat();
}
