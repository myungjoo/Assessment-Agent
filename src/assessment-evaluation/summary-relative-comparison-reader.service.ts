// SummaryRelativeComparisonReader — 좌표 `(period, periodStart)` 상대 비교 산출의
// read-adapter (REQ-036 "개발자 간 상대 비교 전용 산출 경로" 배선 2/3). 순수 helper
// `computeRelativeComparison`(T-1931)이 산출 규칙을 닫고, `SummaryService.
// findByCoordinate`(T-1932)가 그 helper 에 먹일 다중 person 입력 집합의 조회 표면을
// 닫았으나 둘을 잇는 배선이 없어 helper 의 production 소비처가 0 이었다. 본 adapter 가
// 그 한 경로(조회 → Decimal→number 매핑 → helper 위임)를 닫는다.
//
// 책임(3 단계 고정):
//   (1) `SummaryService.findByCoordinate(period, periodStart)` 로 좌표에 속한 전체
//       person 의 Summary row 를 읽는다.
//   (2) row 를 **입력 순서 그대로** `RelativeComparisonEntry[]` 로 map 한다 —
//       `metricScore` 는 Prisma `Decimal` 이라 `toEntryScore` 로 number 화한다.
//   (3) `computeRelativeComparison(entries)` 결과를 가공 없이 반환한다.
//
// 경계(task Out of Scope):
//   - **입력 검증 0** — `period` literal · `periodStart` 유효성은 `SummaryService.
//     findByCoordinate`(summary.service.ts `137~146 행`)가 단일 검증 출처이고, 그
//     `BadRequestException` 은 변환 없이 전파한다(중복 검증 · 새 검증 helper 0).
//   - **정렬 재조정 0** — repository 가 `personId: "asc"` 로 결정적 순서를 보장하므로
//     (summary.repository.ts `137 행` 이후) adapter 는 재정렬하지 않는다. helper 의
//     "동점 내부는 입력 최초 등장 순서" 규약이 그 순서 위에 얹힌다.
//   - **helper 규약 수정 0** — 0 절하 · 중복 personId `TypeError` 는 helper 소유다.
//     adapter 는 은폐하지 않고 그대로 전파한다.
//   - controller endpoint · query DTO · RBAC · orchestrator 배선은 본 slice 밖
//     (배선 3/3). 본 slice 는 module provider/export 등록까지다.
//   - `src/user/**` · `domain/summary-relative-comparison.ts` · schema 변경 0.
//
// 패턴 mirror: evaluation-persisted-records-reader.service.ts 의 constructor DI 패턴
// (@Injectable + constructor private readonly 주입 + "값 검증은 본 adapter 가 하지
// 않고 forward" 규약)을 1:1 로 따른다.
import { Injectable } from "@nestjs/common";

import { SummaryService } from "../user/summary.service";

import { computeRelativeComparison } from "./domain/summary-relative-comparison";
import type {
  RelativeComparisonEntry,
  RelativeComparisonResult,
} from "./domain/summary-relative-comparison";

// toEntryScore — Prisma `Decimal` 계열 `metricScore` 를 helper 의 `number` 계약으로
// 옮기는 내부 매핑 helper. **export 하지 않는다**(본 파일 전용).
//
// 분기 선택 이유:
//   ① `number` — Prisma driver adapter 설정에 따라 이미 number 로 오는 경로. 무가공.
//   ② `toNumber()` 보유 객체 — Prisma `Decimal` 의 정상 경로. Decimal 은 자체
//      메서드로만 안전히 number 화되므로 duck-typing 으로 확인 후 호출한다.
//   ③ `string` — Decimal 직렬화(JSON 왕복 등) fallback. `Number()` 는 파싱 실패 시
//      `NaN` 을 주는데, 그 `NaN` 은 ④와 같은 경로로 helper 가 흡수한다.
//   ④ 그 외(`null` / `undefined` / boolean 등) — `Number.NaN` 을 돌려 helper 의
//      `normalizeScore`(summary-relative-comparison.ts `99~113 행`)가 **0 으로 절하**
//      하게 맡긴다. 여기서 throw 하지 않는 것은 은폐가 아니라 위임이다 — 절하 규약의
//      단일 출처는 helper 이고, adapter 가 별도 예외를 만들면 규약이 둘로 갈라진다.
function toEntryScore(value: unknown): number {
  if (typeof value === "number") {
    return value;
  }
  if (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { toNumber?: unknown }).toNumber === "function"
  ) {
    return (value as { toNumber: () => number }).toNumber();
  }
  if (typeof value === "string") {
    return Number(value);
  }
  return Number.NaN;
}

@Injectable()
export class SummaryRelativeComparisonReader {
  constructor(private readonly summaryService: SummaryService) {}

  // readForCoordinate — 한 좌표의 person 간 상대 비교 산출을 반환한다(REQ-036).
  //
  // 흐름은 3 단계 고정이다 — 조회(findByCoordinate) → 매핑(toEntryScore) → 위임
  // (computeRelativeComparison). 빈 좌표는 별도 분기 없이 helper 의 빈 입력 규약대로
  // `{ cohortSize: 0, mean: 0, byPerson: [] }` 이 그대로 반환된다.
  //
  // @param period `"day"` / `"week"` / `"month"` 중 하나. 검증하지 않고 그대로
  //   forward 한다(단일 검증 출처 = SummaryService).
  // @param periodStart 좌표의 기간 시작 시각. 마찬가지로 forward 만 한다.
  // @returns cohort 크기 · 평균 · person 별 rank/percentile.
  // @throws {BadRequestException} `SummaryService.findByCoordinate` 의 검증 실패가
  //   변환 없이 전파된다(잘못된 period literal · Invalid Date).
  // @throws {TypeError} 같은 좌표에 같은 `personId` 가 2 행 이상 있는 비정상 입력에서
  //   helper 가 던지는 좌표 계약 위반(은폐 없이 전파). 정상 경로에서는
  //   `@@unique([personId, period, periodStart])`(schema.prisma `377 행`)가 차단한다.
  async readForCoordinate(
    period: string,
    periodStart: Date,
  ): Promise<RelativeComparisonResult> {
    // (1) 조회 — reject 시 await 가 그대로 throw 해 호출자로 자연 전파된다(재던지기 0).
    const rows = await this.summaryService.findByCoordinate(
      period,
      periodStart,
    );

    // (2) 매핑 — 반환 배열·원소를 변형하지 않고 새 entry 객체만 만든다(입력 비변형).
    //     순서는 findByCoordinate 의 `personId: "asc"` 결정적 순서를 그대로 보존한다.
    const entries: RelativeComparisonEntry[] = rows.map((row) => ({
      personId: row.personId,
      metricScore: toEntryScore(row.metricScore),
    }));

    // (3) 위임 — 산출 규칙(0 절하 · 중복 personId TypeError · 동점 tie-break)은 전부
    //     helper 소유다. adapter 는 결과를 가공하지 않는다.
    return computeRelativeComparison(entries);
  }
}
