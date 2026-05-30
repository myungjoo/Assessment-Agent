// assessment-schema.spec.ts — T-0110 schema-validation spec.
//
// 본 spec 은 ADR-0006 Decision §1~§6 가 prisma/schema.prisma 에 1:1 mirror 되었는지
// 와 R-59 (raw 본문 미저장) invariant 가 schema-level 로 강제되는지를 회귀-방지
// 안전망으로 박제한다. 본 task 는 schema 선언만 추가하므로 production 분기 로직
// 없음 — 본 spec 의 R-112 cover 는 다음과 같이 mapping:
//   - happy path: PrismaClient delegate 존재 (3 model) + schema 텍스트 안의 키
//     컬럼 / `@@unique` / `@@index` / cascade 단언.
//   - error path: schema-only task 이므로 runtime error path 없음 — 대신 raw 본문
//     컬럼 부재를 "잘못된 컬럼 추가 시 fail" 형태로 negative 안전망 구성.
//   - branch coverage: 본 task 의 schema 선언에는 분기 로직이 없음 — branch
//     항목 자체 생략. Task 정의서 Acceptance §35 "schema 선언만, 분기 없음" 정합.
//   - negative cases 충분 cover: raw 컬럼 부재 (3 model × 4 후보 컬럼) +
//     `@@unique` / relation 단언 (각 model 1+) + cascade 단언 (각 relation 1+).
//
// 본 spec 은 DB 의존성 0 — schema 텍스트 정적 검증 + PrismaClient type-level
// delegate 존재 확인만 수행.
import * as fs from "node:fs";
import * as path from "node:path";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

// schema 텍스트를 한 번만 로드해 모든 test 에서 공유 — I/O cost 최소화.
const schemaPath = path.resolve(__dirname, "../../prisma/schema.prisma");
const schemaText = fs.readFileSync(schemaPath, "utf-8");

/**
 * Extract a single `model <Name> { ... }` block from the schema text.
 * Returns the body (between the braces) so per-model assertions can scope
 * their regex to one block. 정확히 1 회 매칭 안 되면 throw — 잘못된 schema
 * (model 중복 / 누락) 의 빠른 fail signal.
 */
function extractModelBody(modelName: string): string {
  const re = new RegExp(`model\\s+${modelName}\\s*\\{([\\s\\S]*?)\\n\\}`, "g");
  const matches = [...schemaText.matchAll(re)];
  if (matches.length !== 1) {
    throw new Error(
      `expected exactly 1 'model ${modelName}' block, found ${matches.length}`,
    );
  }
  return matches[0][1];
}

describe("Assessment/Contribution/Summary schema (ADR-0006 / T-0110)", () => {
  describe("PrismaClient delegate (happy — type-level)", () => {
    // PrismaClient 의 delegate property 존재로 prisma generate 가 본 3 model 을
    // 정상적으로 생성했음을 확인. delegate 부재 시 본 test 가 fail 하므로
    // schema → client codegen 회귀 안전망.
    let prisma: PrismaClient;

    beforeAll(() => {
      // Prisma 7.x driver-only 모델 — PrismaPg adapter 를 inject 해 instance 생성.
      // 실 connect 는 하지 않음 ($connect 미호출) — delegate property 존재 확인이 목표.
      // connectionString 값은 lazy — 실제 query 시점에야 평가되므로 dummy 도 OK.
      const adapter = new PrismaPg({
        connectionString: "postgresql://dummy:dummy@localhost:5432/dummy",
      });
      prisma = new PrismaClient({ adapter });
    });

    afterAll(async () => {
      // 미 connect 상태에서도 disconnect 는 안전 (no-op).
      await prisma.$disconnect();
    });

    it("prisma.assessment delegate 가 존재한다", () => {
      expect(prisma.assessment).toBeDefined();
      expect(typeof prisma.assessment.create).toBe("function");
      expect(typeof prisma.assessment.findUnique).toBe("function");
    });

    it("prisma.contribution delegate 가 존재한다", () => {
      expect(prisma.contribution).toBeDefined();
      expect(typeof prisma.contribution.create).toBe("function");
      expect(typeof prisma.contribution.findUnique).toBe("function");
    });

    it("prisma.summary delegate 가 존재한다", () => {
      expect(prisma.summary).toBeDefined();
      expect(typeof prisma.summary.create).toBe("function");
      expect(typeof prisma.summary.findUnique).toBe("function");
    });
  });

  describe("Assessment model (ADR-0006 Decision §1)", () => {
    let body: string;
    beforeAll(() => {
      body = extractModelBody("Assessment");
    });

    it("ADR-0006 §1 의 모든 컬럼이 schema 에 박제되어 있다 (happy)", () => {
      // 각 컬럼 줄을 정규식으로 단언 — 누락 시 fail.
      expect(body).toMatch(/\bid\s+String\s+@id\s+@default\(cuid\(\)\)/);
      expect(body).toMatch(/\bpersonId\s+String\b/);
      expect(body).toMatch(/\bperiod\s+String\b/);
      expect(body).toMatch(/\bscope\s+String\b/);
      expect(body).toMatch(/\bperiodStart\s+DateTime\b/);
      expect(body).toMatch(/\bdifficulty\s+String\b/);
      expect(body).toMatch(/\bcontributionScore\s+Decimal\b/);
      expect(body).toMatch(/\bvolume\s+Int\b/);
      expect(body).toMatch(/\bnarrative\s+String\b/);
      expect(body).toMatch(/\bcreatedAt\s+DateTime\s+@default\(now\(\)\)/);
    });

    it("Person N:1 relation 이 `onDelete: Cascade` 와 함께 박제되어 있다", () => {
      expect(body).toMatch(
        /person\s+Person\s+@relation\(fields:\s*\[personId\],\s*references:\s*\[id\],\s*onDelete:\s*Cascade\)/,
      );
    });

    it("Contribution[] back-relation 이 박제되어 있다 (양방향 relation 요건)", () => {
      expect(body).toMatch(/contributions\s+Contribution\[\]/);
    });

    it("`@@unique([personId, period, scope, periodStart])` 가 박제되어 있다 (재수집 중복 방지 backbone)", () => {
      expect(body).toMatch(
        /@@unique\(\[personId,\s*period,\s*scope,\s*periodStart\]\)/,
      );
    });

    it("`@@index([personId, period, periodStart])` 가 박제되어 있다 (시계열 조회 후보)", () => {
      expect(body).toMatch(/@@index\(\[personId,\s*period,\s*periodStart\]\)/);
    });

    it("`updatedAt` 미정의 — Assessment 는 immutable (재평가 = hard delete 후 재생성)", () => {
      expect(body).not.toMatch(/\bupdatedAt\b/);
    });
  });

  describe("Contribution model (ADR-0006 Decision §2)", () => {
    let body: string;
    beforeAll(() => {
      body = extractModelBody("Contribution");
    });

    it("ADR-0006 §2 의 모든 컬럼이 schema 에 박제되어 있다 (happy)", () => {
      expect(body).toMatch(/\bid\s+String\s+@id\s+@default\(cuid\(\)\)/);
      expect(body).toMatch(/\bassessmentId\s+String\b/);
      expect(body).toMatch(/\bsourceType\s+String\b/);
      expect(body).toMatch(/\bsourceUrl\s+String\b/);
      expect(body).toMatch(/\bsourceRef\s+String\b/);
      expect(body).toMatch(/\bdifficulty\s+String\b/);
      expect(body).toMatch(/\bcontributionScore\s+Decimal\b/);
      expect(body).toMatch(/\bvolume\s+Int\b/);
      expect(body).toMatch(/\bcreatedAt\s+DateTime\s+@default\(now\(\)\)/);
    });

    it("Assessment N:1 relation 이 `onDelete: Cascade` 와 함께 박제되어 있다", () => {
      expect(body).toMatch(
        /assessment\s+Assessment\s+@relation\(fields:\s*\[assessmentId\],\s*references:\s*\[id\],\s*onDelete:\s*Cascade\)/,
      );
    });

    it("`updatedAt` 미정의 — Contribution 은 immutable", () => {
      expect(body).not.toMatch(/\bupdatedAt\b/);
    });
  });

  describe("Summary model (ADR-0006 Decision §3)", () => {
    let body: string;
    beforeAll(() => {
      body = extractModelBody("Summary");
    });

    it("ADR-0006 §3 의 모든 컬럼이 schema 에 박제되어 있다 (happy)", () => {
      expect(body).toMatch(/\bid\s+String\s+@id\s+@default\(cuid\(\)\)/);
      expect(body).toMatch(/\bpersonId\s+String\b/);
      expect(body).toMatch(/\bperiod\s+String\b/);
      expect(body).toMatch(/\bperiodStart\s+DateTime\b/);
      expect(body).toMatch(/\bnarrative\s+String\b/);
      expect(body).toMatch(/\bmetricScore\s+Decimal\b/);
      expect(body).toMatch(/\bcreatedAt\s+DateTime\s+@default\(now\(\)\)/);
    });

    it("Person N:1 relation 이 `onDelete: Cascade` 와 함께 박제되어 있다", () => {
      expect(body).toMatch(
        /person\s+Person\s+@relation\(fields:\s*\[personId\],\s*references:\s*\[id\],\s*onDelete:\s*Cascade\)/,
      );
    });

    it("`@@index([personId, period, periodStart])` 가 박제되어 있다 (시계열 조회 후보)", () => {
      expect(body).toMatch(/@@index\(\[personId,\s*period,\s*periodStart\]\)/);
    });

    it("`updatedAt` 미정의 — Summary 는 immutable (재계산 = hard delete 후 재생성)", () => {
      expect(body).not.toMatch(/\bupdatedAt\b/);
    });
  });

  describe("Person back-relation (양방향 relation 요건)", () => {
    let body: string;
    beforeAll(() => {
      body = extractModelBody("Person");
    });

    it("Person 에 `assessments Assessment[]` back-relation 이 박제되어 있다", () => {
      expect(body).toMatch(/assessments\s+Assessment\[\]/);
    });

    it("Person 에 `summaries Summary[]` back-relation 이 박제되어 있다", () => {
      expect(body).toMatch(/summaries\s+Summary\[\]/);
    });
  });

  describe("R-59 raw 본문 컬럼 부재 (negative — schema-level 강제)", () => {
    // ADR-0006 Decision §4 — raw 본문 (commit body / diff / 문서 본문 / Confluence
    // page 본문) 은 schema 에 컬럼 자체가 없어야 한다. 본 describe 는 raw 후보 컬럼
    // 명을 enumerate 해 "잘못 추가 시 fail" negative 안전망 구성. R-59 회귀 방지.
    //
    // narrative / sourceUrl / sourceRef 는 raw 가 아님 (Task 정의서 §33,
    // ADR-0006 Decision §4 명시) — 본 enumerate 에서 제외.
    const rawCandidateColumns = [
      "commitBody",
      "commitMessage",
      "diff",
      "patch",
      "documentBody",
      "pageBody",
      "pageContent",
      "rawContent",
      "body",
    ];

    it.each(rawCandidateColumns)(
      "Assessment model 에 raw 본문 후보 컬럼 '%s' 가 없다",
      (col) => {
        const body = extractModelBody("Assessment");
        // 컬럼명은 모델 안에서 줄 시작 (whitespace 후) 의 identifier — comment
        // 본문에 단어가 등장하는 것은 무시하기 위해 `^<ws>name<ws>` 매칭.
        const colRe = new RegExp(`^\\s*${col}\\s+`, "m");
        expect(body).not.toMatch(colRe);
      },
    );

    it.each(rawCandidateColumns)(
      "Contribution model 에 raw 본문 후보 컬럼 '%s' 가 없다",
      (col) => {
        const body = extractModelBody("Contribution");
        const colRe = new RegExp(`^\\s*${col}\\s+`, "m");
        expect(body).not.toMatch(colRe);
      },
    );

    it.each(rawCandidateColumns)(
      "Summary model 에 raw 본문 후보 컬럼 '%s' 가 없다",
      (col) => {
        const body = extractModelBody("Summary");
        const colRe = new RegExp(`^\\s*${col}\\s+`, "m");
        expect(body).not.toMatch(colRe);
      },
    );
  });

  describe("Migration SQL 동기 (회귀 안전망)", () => {
    // ADR-0006 의 hand-authored migration SQL 이 schema 와 동기되어 있는지의
    // 단순 substring 확인. PostgreSQL DDL 정확 parsing 은 본 spec scope 외 —
    // table 생성 + FK CASCADE + unique/index 라인 존재만 박제.
    const migrationPath = path.resolve(
      __dirname,
      "../../prisma/migrations/20260531000000_assessment_contribution_summary/migration.sql",
    );
    let sql: string;

    beforeAll(() => {
      sql = fs.readFileSync(migrationPath, "utf-8");
    });

    it("3 model 의 CREATE TABLE 이 모두 존재한다", () => {
      expect(sql).toMatch(/CREATE TABLE "Assessment"/);
      expect(sql).toMatch(/CREATE TABLE "Contribution"/);
      expect(sql).toMatch(/CREATE TABLE "Summary"/);
    });

    it("Assessment 의 `@@unique` 가 SQL CREATE UNIQUE INDEX 로 변환되어 있다", () => {
      expect(sql).toMatch(
        /CREATE UNIQUE INDEX "Assessment_personId_period_scope_periodStart_key"/,
      );
    });

    it("Assessment/Summary 의 `@@index` 가 SQL CREATE INDEX 로 변환되어 있다", () => {
      expect(sql).toMatch(
        /CREATE INDEX "Assessment_personId_period_periodStart_idx"/,
      );
      expect(sql).toMatch(
        /CREATE INDEX "Summary_personId_period_periodStart_idx"/,
      );
    });

    it("3 FK 모두 ON DELETE CASCADE 로 박제되어 있다", () => {
      expect(sql).toMatch(
        /ALTER TABLE "Assessment" ADD CONSTRAINT "Assessment_personId_fkey"[\s\S]*?ON DELETE CASCADE/,
      );
      expect(sql).toMatch(
        /ALTER TABLE "Contribution" ADD CONSTRAINT "Contribution_assessmentId_fkey"[\s\S]*?ON DELETE CASCADE/,
      );
      expect(sql).toMatch(
        /ALTER TABLE "Summary" ADD CONSTRAINT "Summary_personId_fkey"[\s\S]*?ON DELETE CASCADE/,
      );
    });
  });
});
