// export-full-record-read-client — 실 `PrismaService` 를 `collectFullExportRecords` 가 요구하는
// 좁은 read client 타입으로 좁히는 **이름 있는 캐스팅 helper** (T-1283, ADR-0055 §Follow-up (b)
// 복원 엔진 chain 실행 slice **3c-2d**). T-1280 이 read 본문을 helper 로 뽑으면서 "실
// PrismaService 캐스팅은 호출자 몫" 으로 남겼고, 그 결과 같은 `as unknown as` 표현이 production
// 2 곳 (export-job.service.ts · import-restore.service.ts) 으로 확산돼 "왜 안전한가" 근거가 주석
// 사본으로 갈라졌다 (T-1281 reviewer 이월 nit (iii)). 본 module 이 그 표현을 한 곳에 모은다.
//
// 왜 별도 파일인가: export-full-record-collect.ts 안에 넣으면 (a) 그 helper 의 "Prisma 타입을
// 모른다" 경계가 깨지고, (b) import-restore.service.spec.ts 의 module mock factory 가 신규
// export 를 누락해 깨진다. 파일을 나누면 두 문제가 동시에 사라진다 (기존 spec 수정 0).
//
// (a) 왜 `as unknown as` 가 필요한가 — Prisma 가 생성하는 delegate 의 `findMany` 시그니처는
//     model 마다 다른 overload union (model 별 select · where · include 타입) 이라
//     `ExportFullRecordReadDelegate` 의 좁은 `(args: { select: Record<string, true> }) =>
//     Promise<Array<Record<string, unknown>>>` 형태와 **구조적 호환이 성립하지 않는다**.
//     그래서 직접 캐스팅(`as`)이 컴파일 에러가 되고 `unknown` 경유가 유일한 표현이다.
// (b) 왜 안전한가 — 본 read 가 client 에 요구하는 surface 는 EXPORT_ENTITY_SOURCES 의 5
//     delegate (assessment · person · group · llmProviderConfig · permissionDeniedRecord) 에 대한
//     **projection-only `findMany` 한 개씩** 이 전부이고, `PrismaService` 는 그 5 개를 실제로
//     모두 제공한다. 즉 캐스팅은 타입을 넓히는 게 아니라 실재하는 surface 의 부분집합만
//     남기는 좁히기다 (delegate 이름 오타는 `ExportEntityDelegate` union 이 컴파일 단계에서
//     catch — import-restore-order.spec.ts 의 schema 파싱 test 가 2 차 그물).
// (c) 경계 — 본 helper 는 **런타임 identity** 다. 캐스팅은 컴파일 타임 표현이라 인자를 그대로
//     돌려주며 검증 · 정규화 · 복제 · Proxy · 캐시 · 로깅 · throw 가 0 이다 (task §Out of Scope
//     "helper 안에 런타임 검증 추가 0" — 부분 mock 을 쓰는 기존 spec 다수가 guard 로 깨진다).
//     따라서 본 module 도입의 동작 변화는 0 이다.
import { type PrismaService } from "../persistence/prisma.service";

import { type ExportFullRecordReadClient } from "./export-full-record-collect";

// asExportFullRecordReadClient — `PrismaService` 인스턴스를 그대로 돌려주되 타입만
// `ExportFullRecordReadClient` 로 좁힌다. 호출자는 `collectFullExportRecords(...)` 의 인자로
// 바로 넘기면 되고, 캐스팅 근거는 위 헤더 (a)~(c) 한 곳에서만 읽는다 (사본 0).
export function asExportFullRecordReadClient(
  prisma: PrismaService,
): ExportFullRecordReadClient {
  return prisma as unknown as ExportFullRecordReadClient;
}
