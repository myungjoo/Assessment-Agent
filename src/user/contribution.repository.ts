// ContributionRepository — Contribution entity 의 CRUD primitive 를 PrismaService
// 위에 얇게 wrapping 한 repository. T-0112 acceptance §36–48 의 4 메서드 시그니처
// 박제. AssessmentRepository (T-0111) 의 패턴 1:1 mirror.
//
// 책임 경계:
//   - 본 repository 는 도메인 invariant (sourceType 의 `"commit"` / `"pr"` /
//     `"document"` literal 검증, sourceUrl / sourceRef 형식 검증, FK 부재 시
//     HTTP exception 변환 등) 를 검증하지 않는다 — 후속 ContributionService 책임
//     (ADR-0006 §Consequences 음의 4).
//   - 본 class 는 PrismaService 의 `contribution` delegate 에 1:1 forwarding 만 한다.
//   - 테스트는 PrismaService 의 `contribution` 을 Jest mock 으로 대체해 호출 인자 +
//     return 값 정합성만 검증한다 (DB 실연결 불필요, assessment.repository.spec.ts
//     의 `buildPrismaMock` 패턴 mirror).
//
// Contribution 은 immutable (ADR-0006 Decision §2 — `updatedAt` 미정의, 개별 commit/
// PR/문서 단위의 1 회성 영속, 재수집 시 재생성):
//   - update / softDelete / restore 메서드 미박제.
//   - lifecycle 은 create → read → hard delete 의 3 phase 만.
//
// raw 미저장 (R-59 / REQ-032 / ADR-0006 Decision §4) schema-level 강제:
//   - `Contribution` 모델 (schema.prisma L259–273) 에 raw 본문 컬럼 (commit body /
//     diff / 문서 본문 / `rawBody` / `content` 등) 자체가 부재 → 본 repository 의
//     input shape `ContributionCreateInput` 도 7 키 (ADR-0006 §2 의 허용 입력 컬럼)
//     로만 한정. raw 키 자체가 type 차원에서 reject 됨 — schema 강제의 type-level guard.
//   - sourceUrl + sourceRef 는 외부 본문을 가리키는 pointer (참조 식별자) 일 뿐
//     본문 자체가 아니다 — REQ-031 재수집의 backbone.
//
// Prisma error 정책:
//   - findById 가 row 부재 시 null 반환 (throw 안 함) — null-safe API
//     (AssessmentRepository.findById mirror).
//   - findByAssessment 의 매칭 row 0 → Prisma findMany 의 native 동작에 따라 빈
//     배열 `[]` 반환 (null 반환 안 함).
//   - create 가 `assessmentId` FK 위반 (Assessment row 부재) 시 Prisma 의 `P2003`
//     이 그대로 propagate — 호출자 (ContributionService) 가 BadRequestException
//     등으로 변환할 책임.
//   - delete 가 row 부재 시 Prisma 의 `P2025` error 가 그대로 propagate — 호출자가
//     NotFoundException 등으로 변환할 책임. Assessment 의 hard delete 시 component
//     Contribution 동반 삭제는 schema 의 `onDelete: Cascade` (schema.prisma L272)
//     가 별도 책임 (본 repository 우회 — Admin 의 row 별 manual delete 만 cover).
import { Injectable } from "@nestjs/common";
import type { Contribution, Prisma } from "@prisma/client";

import { PrismaService } from "../persistence/prisma.service";

// Contribution create input shape — ADR-0006 §2 의 허용 입력 컬럼 7 종.
// `id` / `createdAt` 는 schema 의 `@default(cuid())` / `@default(now())` 가 cover →
// caller 가 전달 X. raw 본문 컬럼 (commit body / diff / 문서 본문 / `rawBody` /
// `content` / `message` 등) 은 type 차원에서 reject (R-59 schema-level 강제의
// type-level guard).
//
// contributionScore 는 `Decimal` 컬럼 — Prisma 의 `Decimal` runtime type 또는 plain
// number / string 모두 accept (Prisma 가 내부 변환). 본 type 은 Prisma 의 input type
// 을 직접 사용하여 caller 의 유연성 보장.
export interface ContributionCreateInput {
  // Assessment N:1 FK — 부재 시 Prisma `P2003` propagate.
  assessmentId: string;
  // `"commit"` / `"pr"` / `"document"` enum-as-String. literal 값 검증은 service-layer 책임.
  sourceType: string;
  // 외부 GitHub / Confluence URL — 본문이 아닌 pointer (참조 식별자).
  sourceUrl: string;
  // commit SHA / PR number / page version ID — 본문이 아닌 pointer.
  sourceRef: string;
  // `"easy"` / `"medium"` / `"hard"` enum-as-String. literal 값 검증은 service-layer 책임.
  difficulty: string;
  // 기여도 정규화 수치 (REQ-036). Prisma 의 Decimal input — number / string / Decimal 모두 accept.
  contributionScore: Prisma.Decimal | number | string;
  // 양 (변경 line 수 / 문서 단어 수 등 단일 Contribution 의 정량 수치).
  volume: number;
}

@Injectable()
export class ContributionRepository {
  constructor(private readonly prisma: PrismaService) {}

  // create — `assessmentId` FK 위반 (Assessment row 부재) 시 Prisma 가 `P2003`
  // throw → 본 layer catch X, 호출자 (ContributionService) 책임.
  // `id` / `createdAt` 는 schema 의 `@default` 가 cover → caller 가 전달 X (input
  // shape 에 부재). raw 본문 컬럼은 input shape 차원에서 reject (R-59 schema-level
  // 강제의 type-level guard).
  async create(input: ContributionCreateInput): Promise<Contribution> {
    return this.prisma.contribution.create({ data: input });
  }

  // findById — findUnique 의 row 부재 분기는 null 반환 (Prisma native 동작과 일치).
  // AssessmentRepository.findById 의 null-safe API 정공법 mirror.
  async findById(id: string): Promise<Contribution | null> {
    return this.prisma.contribution.findUnique({ where: { id } });
  }

  // findByAssessment — REQ-033 commit·문서별 보유 데이터의 aggregate-level fan-out.
  // 특정 Assessment 의 component Contribution 전체 조회. 정렬은 항상
  // `orderBy: { createdAt: "asc" }` — 수집 순서 보존 (시간축 자연 순서).
  //
  // 매칭 row 0 시 Prisma findMany 의 native 동작에 따라 빈 배열 `[]` 반환 (null
  // 반환 안 함). assessmentId 자체의 존재 검증 (Assessment row 가 실제 존재하는지)
  // 은 본 layer 책임 외 — 호출자 (후속 ContributionService) 가 별도 lookup 으로
  // 처리.
  async findByAssessment(assessmentId: string): Promise<Contribution[]> {
    return this.prisma.contribution.findMany({
      where: { assessmentId },
      orderBy: { createdAt: "asc" },
    });
  }

  // delete — hard delete (REQ-041 Admin 개별 manual delete, ADR-0006 §6).
  // row 부재 시 Prisma `P2025` throw → 본 layer catch X, 호출자 책임.
  // Assessment 전체 hard delete 시는 schema 의 `onDelete: Cascade`
  // (schema.prisma L272) 가 동반 삭제 책임 — 본 메서드는 Admin 의 개별 row 수동
  // 삭제 경로만 cover.
  async delete(id: string): Promise<void> {
    await this.prisma.contribution.delete({ where: { id } });
  }
}
