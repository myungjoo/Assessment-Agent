// SummaryRepository — Summary entity 의 CRUD primitive 를 PrismaService 위에 얇게
// wrapping 한 repository. T-0113 acceptance §39–45 의 4 메서드 시그니처 박제.
// ContributionRepository (T-0112) / AssessmentRepository (T-0111) 의 패턴 1:1 mirror.
//
// 책임 경계:
//   - 본 repository 는 도메인 invariant (period 의 `"daily"` / `"weekly"` /
//     `"monthly"` literal 검증, periodStart 의 단위 정합 (일=자정 / 주=월요일 자정 /
//     월=1일 자정), FK 부재 시 HTTP exception 변환 등) 를 검증하지 않는다 — 후속
//     SummaryService 책임 (ADR-0006 §Consequences 음의 4).
//   - 본 class 는 PrismaService 의 `summary` delegate 에 1:1 forwarding 만 한다.
//   - 테스트는 PrismaService 의 `summary` 를 Jest mock 으로 대체해 호출 인자 +
//     return 값 정합성만 검증한다 (DB 실연결 불필요, contribution.repository.spec.ts
//     의 `buildPrismaMock` 패턴 mirror).
//
// Summary 는 immutable (ADR-0006 Decision §3 — `updatedAt` 미정의, 재계산은 hard
// delete 후 재생성, REQ-037 재평가 lifecycle):
//   - update / softDelete / restore 메서드 미박제.
//   - lifecycle 은 create → read → hard delete 의 3 phase 만.
//
// raw 미저장 (R-59 / REQ-032 / ADR-0006 Decision §4) schema-level 강제:
//   - `Summary` 모델 (schema.prisma L285–299) 에 raw 본문 컬럼 (commit body / diff /
//     문서 본문 / `rawBody` / `content` 등) 자체가 부재 → 본 repository 의 input shape
//     `SummaryCreateInput` 도 5 키 (ADR-0006 §3 의 허용 입력 컬럼) 로만 한정. raw 키
//     자체가 type 차원에서 reject 됨 — schema 강제의 type-level guard.
//   - `narrative` 는 LLM 정성 요약 평가문 (LLM 생성 결과물) — raw 본문 인용이 아니다.
//     따라서 R-59 (raw 미저장) 의 적용 대상이 아니며 schema 에 정상 컬럼으로 존재한다.
//     본 repository 의 raw 미저장 invariant 는 commit body / diff / 문서 본문 같은
//     "수집 원천 본문" 컬럼의 부재만을 의미한다 — `narrative` 값 자체의 내용 검증은
//     본 layer 책임 외 (P5 LLM prompt 설계 책임, ADR-0006 §Consequences 음의 3).
//
// Prisma error 정책:
//   - findById 가 row 부재 시 null 반환 (throw 안 함) — null-safe API
//     (ContributionRepository.findById mirror).
//   - findByPerson 의 매칭 row 0 → Prisma findMany 의 native 동작에 따라 빈 배열 `[]`
//     반환 (null 반환 안 함).
//   - create 가 `personId` FK 위반 (Person row 부재) 시 Prisma 의 `P2003` 이 그대로
//     propagate — 호출자 (SummaryService) 가 BadRequestException 등으로 변환할 책임.
//   - delete 가 row 부재 시 Prisma 의 `P2025` error 가 그대로 propagate — 호출자가
//     NotFoundException 등으로 변환할 책임. Person 전체 hard delete 시 동반 Summary
//     삭제는 schema 의 `onDelete: Cascade` (schema.prisma L295) 가 별도 책임 (본
//     repository 우회 — Admin 의 개별 row manual delete + 재계산 경로만 cover).
import { Injectable } from "@nestjs/common";
import type { Summary, Prisma } from "@prisma/client";

import { PrismaService } from "../persistence/prisma.service";

// Summary create input shape — ADR-0006 §3 의 허용 입력 컬럼 5 종.
// `id` / `createdAt` 는 schema 의 `@default(cuid())` / `@default(now())` 가 cover →
// caller 가 전달 X. raw 본문 컬럼 (commit body / diff / 문서 본문 / `rawBody` /
// `content` / `commitBody` 등) 은 type 차원에서 reject (R-59 schema-level 강제의
// type-level guard).
//
// metricScore 는 `Decimal` 컬럼 — Prisma 의 `Decimal` runtime type 또는 plain
// number / string 모두 accept (Prisma 가 내부 변환). 본 type 은 Prisma 의 input type
// 을 직접 사용하여 caller 의 유연성 보장.
export interface SummaryCreateInput {
  // Person N:1 FK — 부재 시 Prisma `P2003` propagate.
  personId: string;
  // `"daily"` / `"weekly"` / `"monthly"` enum-as-String. literal 값 검증은 service-layer 책임.
  period: string;
  // 요약 기간 시작 (일/주/월 경계). 단위 정합 (자정 / 월요일 / 1일) 검증은 service-layer 책임.
  periodStart: Date;
  // LLM 정성 요약 평가문 (LLM 생성 결과물 — raw 본문 인용 아님, R-59 적용 외).
  narrative: string;
  // 요약 단위의 정규화 metric 수치. Prisma 의 Decimal input — number / string / Decimal 모두 accept.
  metricScore: Prisma.Decimal | number | string;
}

// findByPerson 의 분기 옵션 — period 가 주어지면 `where: { personId, period }`,
// 아니면 `where: { personId }` 의 2 분기. 시계열 조회 (REQ-038) 의 query 단순화
// (AssessmentRepository.AssessmentFindByPersonOptions 패턴 1:1 mirror).
export interface SummaryFindByPersonOptions {
  // `"daily"` / `"weekly"` / `"monthly"` 중 하나. undefined 면 전체 period 조회.
  period?: string;
}

@Injectable()
export class SummaryRepository {
  constructor(private readonly prisma: PrismaService) {}

  // create — `personId` FK 위반 (Person row 부재) 시 Prisma 가 `P2003` throw → 본
  // layer catch X, 호출자 (SummaryService) 책임. `id` / `createdAt` 는 schema 의
  // `@default` 가 cover → caller 가 전달 X (input shape 에 부재). raw 본문 컬럼은
  // input shape 차원에서 reject (R-59 schema-level 강제의 type-level guard).
  async create(input: SummaryCreateInput): Promise<Summary> {
    return this.prisma.summary.create({ data: input });
  }

  // findById — findUnique 의 row 부재 분기는 null 반환 (Prisma native 동작과 일치).
  // ContributionRepository.findById 의 null-safe API 정공법 mirror.
  async findById(id: string): Promise<Summary | null> {
    return this.prisma.summary.findUnique({ where: { id } });
  }

  // findByPerson — REQ-038 시계열 조회. `@@index([personId, period, periodStart])`
  // 정합. options.period 가 주어지면 `where: { personId, period }` (2 컬럼 index hit),
  // 아니면 `where: { personId }` (leftmost prefix index hit). 정렬은 항상
  // `orderBy: { periodStart: "desc" }` — 시계열 최신순 (AssessmentRepository 정합).
  //
  // 매칭 row 0 시 Prisma findMany 의 native 동작에 따라 빈 배열 `[]` 반환 (null 아님).
  // personId 자체의 존재 검증 (Person row 가 실제 존재하는지) 은 본 layer 책임 외 —
  // 호출자 (후속 SummaryService) 가 별도 lookup 으로 처리 (AssessmentRepository 의
  // findByPerson personId 검증 정책 mirror).
  async findByPerson(
    personId: string,
    options?: SummaryFindByPersonOptions,
  ): Promise<Summary[]> {
    if (options?.period !== undefined) {
      return this.prisma.summary.findMany({
        where: { personId, period: options.period },
        orderBy: { periodStart: "desc" },
      });
    }
    return this.prisma.summary.findMany({
      where: { personId },
      orderBy: { periodStart: "desc" },
    });
  }

  // delete — hard delete (REQ-041 Admin 개별 manual delete + 재계산 lifecycle,
  // ADR-0006 §3 / §6). row 부재 시 Prisma `P2025` throw → 본 layer catch X, 호출자
  // 책임. Person 전체 hard delete 시 동반 Summary 삭제는 schema 의 `onDelete: Cascade`
  // (schema.prisma L295) 가 책임 — 본 메서드는 Admin 의 개별 row 수동 삭제 + 재계산
  // 경로만 cover.
  async delete(id: string): Promise<void> {
    await this.prisma.summary.delete({ where: { id } });
  }
}
