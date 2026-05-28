// db-truncate.ts — smoke/e2e test 의 afterEach hook 용 TRUNCATE helper.
//
// 책임 (T-0052 — ADR-0004 §Cleanup 정책 박제):
//   - ADR-0004 §Decision 의 cleanup 정책 박제: 각 test 후 모든 도메인 테이블을
//     TRUNCATE ... RESTART IDENTITY CASCADE 로 초기화하여 test 간 격리 보장.
//   - prisma.$executeRawUnsafe 1 회 호출 — 단일 SQL 문 안에 5 테이블 동시 처리
//     (race 안전 + statement timing 단축).
//   - RESTART IDENTITY: serial/identity sequence reset → 다음 test 의 id 가 1 부터.
//   - CASCADE: foreign key 의 ON DELETE 동작 자동 처리 — Person ↔ ServiceIdentity
//     (CASCADE) / Person ↔ PersonGroupMembership (CASCADE) / Group ↔
//     PersonGroupMembership (CASCADE) / Person ↔ Part (RESTRICT 이나 TRUNCATE 의
//     CASCADE 는 ON DELETE 와 분리된 별도 의미 — 모든 referenced 테이블 동반 truncate).
//
// 테이블 명단 (prisma/migrations/ 의 CREATE TABLE 문 기준 PascalCase quoted identifier):
//   "Person", "ServiceIdentity", "Group", "Part", "PersonGroupMembership", "User"
// User 추가 (T-0087) — RBAC 첫 production 적용 endpoint (users.e2e-spec.ts) 의
// afterEach 격리. email @unique 의 cross-test 충돌 방지.
//
// 사용 예시 (T-0053 머지 시점부터 활용):
//   afterEach(async () => {
//     await truncateAll(prisma);
//   });
//
// 파일 경로 정책: `test/helpers/db-truncate.ts` 는 jest 의 어떤 testRegex 도
// 매칭하지 않으므로 test 로 pickup 0. package.json 의 `collectCoverageFrom:
// ["src/**/*"]` scope 밖이라 coverage 통계 영향 0.
import type { PrismaService } from "../../src/persistence/prisma.service";

// PrismaService 의 $executeRawUnsafe 시그니처와 호환되는 최소 shape.
// 실 PrismaService 인스턴스 / mock 양쪽을 받을 수 있게 의도적으로 좁힘 — spec
// 에서 jest.fn() 1 개로 검증 가능.
export type TruncatableClient = Pick<PrismaService, "$executeRawUnsafe">;

// TRUNCATE 대상 6 테이블 (PascalCase quoted identifier — prisma default mapping).
// const 로 노출하여 spec 에서 substring 검증 anchor 로 활용.
// T-0087: "User" 추가 — RBAC 첫 production 적용 endpoint 의 e2e 가 User 테이블에
// SuperAdmin / target user seed → afterEach 격리 필수.
export const TRUNCATE_TABLES: readonly string[] = [
  '"Person"',
  '"ServiceIdentity"',
  '"Group"',
  '"Part"',
  '"PersonGroupMembership"',
  '"User"',
];

// truncateAll — 5 테이블 전체를 1 SQL 문으로 TRUNCATE.
// 호출자 책임: prisma 가 connection 된 상태일 것 (PrismaService.onModuleInit
// 완료 후). connection 미수립 시 $executeRawUnsafe 가 reject → 본 함수도 reject.
export async function truncateAll(prisma: TruncatableClient): Promise<void> {
  const sql = `TRUNCATE TABLE ${TRUNCATE_TABLES.join(", ")} RESTART IDENTITY CASCADE`;
  await prisma.$executeRawUnsafe(sql);
}
