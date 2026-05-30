// AssessmentRepository — Assessment entity 의 CRUD primitive 를 PrismaService 위에
// 얇게 wrapping 한 repository. T-0111 acceptance §32–37 의 4 메서드 시그니처 박제.
//
// 책임 경계:
//   - 본 repository 는 도메인 invariant (period / scope / difficulty 의 enum-as-String
//     literal 값 검증 / `@@unique([personId, period, scope, periodStart])` 정책의
//     HTTP exception 변환 등) 를 검증하지 않는다 — 후속 AssessmentService 책임.
//   - 본 class 는 PrismaService 의 `assessment` delegate 에 1:1 forwarding 만 한다.
//   - 테스트는 PrismaService 의 `assessment` 를 Jest mock 으로 대체해 호출 인자 +
//     return 값 정합성만 검증한다 (DB 실연결 불필요, person.repository.spec.ts 의
//     `buildPrismaMock` 패턴 mirror).
//
// Assessment 는 immutable (ADR-0006 Decision §1 — `updatedAt` 미정의, 재평가는 hard
// delete 후 재생성, REQ-037 / REQ-041):
//   - update / softDelete / restore 메서드 미박제.
//   - lifecycle 은 create → read → hard delete 의 3 phase 만.
//
// raw 미저장 (R-59 / REQ-032 / ADR-0006 Decision §4) schema-level 강제:
//   - `Assessment` 모델에 raw 본문 컬럼 (commit body / diff / 문서 본문 / Confluence
//     page 본문) 자체가 부재 → 본 repository 의 input shape `AssessmentCreateInput`
//     도 8 키 (ADR-0006 §1 의 허용 입력 컬럼) 로만 한정. raw 키 자체가 type 차원에서
//     reject 됨 — schema 강제의 type-level guard.
//
// Prisma error 정책:
//   - findById 가 row 부재 시 null 반환 (throw 안 함) — null-safe API (PersonRepository.findById mirror).
//   - create 가 `@@unique([personId, period, scope, periodStart])` 위반 시 Prisma 의
//     `P2002` error 가 그대로 propagate — 호출자 (AssessmentService) 가 ConflictException
//     등으로 변환할 책임 (PersonRepository.create 의 P2002 정책 mirror).
//   - delete 가 row 부재 시 Prisma 의 `P2025` error 가 그대로 propagate — 호출자가
//     NotFoundException 등으로 변환할 책임. component Contribution 은 schema 의
//     `onDelete: Cascade` (schema.prisma L272) 가 동반 삭제 책임.
//   - findByPerson 의 매칭 row 0 → Prisma findMany 의 native 동작에 따라 빈 배열 `[]`
//     반환 (null 반환 안 함).
import { Injectable } from "@nestjs/common";
import type { Assessment, Prisma } from "@prisma/client";

import { PrismaService } from "../persistence/prisma.service";

// Assessment create input shape — ADR-0006 §1 의 허용 입력 컬럼 8 종.
// `id` / `createdAt` 는 schema 의 `@default(cuid())` / `@default(now())` 가 cover →
// caller 가 전달 X. raw 본문 컬럼 (commit body / diff / 문서 본문 / `rawBody` /
// `content` 등) 은 type 차원에서 reject (R-59 schema-level 강제의 type-level guard).
//
// contributionScore 는 `Decimal` 컬럼 — Prisma 의 `Decimal` runtime type 또는 plain
// number / string 모두 accept (Prisma 가 내부 변환). 본 type 은 Prisma 의 input type
// 을 직접 사용하여 caller 의 유연성 보장.
export interface AssessmentCreateInput {
  personId: string;
  // `"day"` / `"week"` / `"month"` enum-as-String. literal 값 검증은 service-layer 책임.
  period: string;
  // `"commit"` / `"document"` / `"aggregate"` enum-as-String. literal 값 검증은 service-layer 책임.
  scope: string;
  // 평가 기간 시작 (일/주/월 경계). timezone 정책은 cross-cutting field ADR 책임.
  periodStart: Date;
  // `"easy"` / `"medium"` / `"hard"` enum-as-String. literal 값 검증은 service-layer 책임.
  difficulty: string;
  // 기여도 정규화 수치 (REQ-036). Prisma 의 Decimal input — number / string / Decimal 모두 accept.
  contributionScore: Prisma.Decimal | number | string;
  // 양 (commit 수 / 변경 line / 문서 수 등 aggregate 수치).
  volume: number;
  // LLM 정성 평가문 텍스트 (LLM 생성 결과물 — raw 아님, R-59 적용 외).
  narrative: string;
}

// findByPerson 의 분기 옵션 — period 가 주어지면 `where: { personId, period }`,
// 아니면 `where: { personId }` 의 2 분기. 시계열 조회 (REQ-038) 의 query 단순화.
export interface AssessmentFindByPersonOptions {
  // `"day"` / `"week"` / `"month"` 중 하나. undefined 면 전체 period 조회.
  period?: string;
}

@Injectable()
export class AssessmentRepository {
  constructor(private readonly prisma: PrismaService) {}

  // create — `@@unique([personId, period, scope, periodStart])` 위반 시 Prisma 가
  // `P2002` throw → 본 layer catch X, 호출자 (AssessmentService) 책임.
  // `id` / `createdAt` 는 schema 의 `@default` 가 cover → caller 가 전달 X (input
  // shape 에 부재). raw 본문 컬럼은 input shape 차원에서 reject (R-59 schema-level
  // 강제의 type-level guard).
  async create(input: AssessmentCreateInput): Promise<Assessment> {
    return this.prisma.assessment.create({ data: input });
  }

  // findById — findUnique 의 row 부재 분기는 null 반환 (Prisma native 동작과 일치).
  // PersonRepository.findById 의 null-safe API 정공법 mirror.
  async findById(id: string): Promise<Assessment | null> {
    return this.prisma.assessment.findUnique({ where: { id } });
  }

  // findByPerson — REQ-038 시계열 조회. `@@index([personId, period, periodStart])`
  // 정합. options.period 가 주어지면 `where: { personId, period }` (2 컬럼 index hit),
  // 아니면 `where: { personId }` (leftmost prefix index hit). 정렬은 항상
  // `orderBy: { periodStart: "desc" }` — 시계열 최신순.
  //
  // 매칭 row 0 시 Prisma findMany 의 native 동작에 따라 빈 배열 `[]` 반환 (null 아님).
  // personId 자체의 존재 검증 (Person row 가 실제 존재하는지) 은 본 layer 책임 외 —
  // 호출자 (후속 AssessmentService) 가 별도 lookup 으로 처리 (PersonRepository 의
  // findByPartId / findByGroupId 의 partId / groupId 검증 정책 mirror).
  async findByPerson(
    personId: string,
    options?: AssessmentFindByPersonOptions,
  ): Promise<Assessment[]> {
    if (options?.period !== undefined) {
      return this.prisma.assessment.findMany({
        where: { personId, period: options.period },
        orderBy: { periodStart: "desc" },
      });
    }
    return this.prisma.assessment.findMany({
      where: { personId },
      orderBy: { periodStart: "desc" },
    });
  }

  // delete — hard delete (REQ-041 Admin manual delete / REQ-037 lifecycle,
  // ADR-0006 §6). row 부재 시 Prisma `P2025` throw → 본 layer catch X, 호출자 책임.
  // Assessment 삭제 시 component Contribution 은 schema 의 `onDelete: Cascade`
  // (schema.prisma L272) 가 동반 삭제 책임 — 본 layer 가 별도 cascade 처리 X.
  async delete(id: string): Promise<void> {
    await this.prisma.assessment.delete({ where: { id } });
  }
}
