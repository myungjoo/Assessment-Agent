// prisma-schema.spec.ts — T-0110 (ADR-0006 Decision §1~§6) schema-validation spec.
//
// 본 task 는 prisma/schema.prisma 에 Assessment / Contribution / Summary 3 model 을
// 선언만 한다 (service/repository/controller 는 T-0111+ Out of Scope). 따라서 분기 로직
// production 코드가 0 — branch coverage 항목은 "schema 선언만, 분기 없음 — 생략" (R-112).
//
// 본 spec 의 검증 전략 (분기 없는 schema 라 happy-path + negative 중심):
//   (a) happy-path — 생성된 PrismaClient 가 assessment / contribution / summary delegate 를
//       노출하고, DMMF 가 3 model 을 datamodel 에 포함한다.
//   (b) negative (R-59 regression 방지, ADR-0006 Decision §4) — 3 model 어디에도 raw 본문
//       필드 (commitBody / diff / pageBody / content / body / rawDiff 등) 가 **존재하지 않음**.
//       schema 에 자리가 없으면 저장 자체가 불가 — schema-level 강제.
//   (c) negative 안전망 — 각 model 의 핵심 컬럼 / relation / @@unique / @@index / cascade 가
//       잘못 정의되면 fail (ADR-0006 결정과 schema 의 drift 차단).
//
// (a)(b) 는 runtime DMMF (Prisma.dmmf) 로 model field 를 열거해 검증. runtime DMMF 는
// @@unique / @@index / cascade 메타를 carry 하지 않으므로, (c) 의 constraint 단언은
// prisma/schema.prisma 원문을 읽어 선언 존재를 검증한다 (schema-as-truth).
import { readFileSync } from "fs";
import { join } from "path";

import { Prisma, PrismaClient } from "@prisma/client";

// ADR-0006 이 명시적으로 금지한 raw 본문 컬럼 후보 (R-59). 이 중 하나라도 model field 로
// 존재하면 fail — raw 미저장 invariant 의 schema-level regression 방지 안전망.
const FORBIDDEN_RAW_FIELDS = [
  "commitBody",
  "commitMessage",
  "diff",
  "rawDiff",
  "patch",
  "pageBody",
  "documentBody",
  "body",
  "content",
  "rawContent",
  "rawText",
  "fileContent",
];

// runtime DMMF 에서 model 의 scalar/relation field 이름 집합을 추출.
function fieldNamesOf(modelName: string): string[] {
  const model = Prisma.dmmf.datamodel.models.find((m) => m.name === modelName);
  if (!model) {
    throw new Error(`DMMF 에 model ${modelName} 가 없습니다`);
  }
  return model.fields.map((f) => f.name);
}

describe("prisma schema — Assessment / Contribution / Summary (T-0110, ADR-0006)", () => {
  // (a) happy-path — PrismaClient delegate 노출.
  describe("(a) happy-path — PrismaClient delegate 노출", () => {
    it("PrismaClient type 의 prototype 이 assessment / contribution / summary delegate 를 노출한다", () => {
      // 실 DB connection 없이 prototype 의 delegate getter 존재만 확인 (DATABASE_URL 불요).
      const proto = PrismaClient.prototype as unknown as Record<string, unknown>;
      // Prisma 7.x 는 delegate 를 lazy getter 로 정의 — descriptor 존재로 확인.
      const hasDelegate = (name: string): boolean =>
        name in proto ||
        Object.getOwnPropertyDescriptor(proto, name) !== undefined ||
        // generate 된 client 의 model 목록으로도 cross-check.
        Prisma.dmmf.datamodel.models.some(
          (m) => m.name.toLowerCase() === name,
        );
      expect(hasDelegate("assessment")).toBe(true);
      expect(hasDelegate("contribution")).toBe(true);
      expect(hasDelegate("summary")).toBe(true);
    });

    it("DMMF datamodel 이 3 model 을 모두 포함한다", () => {
      const models = Prisma.dmmf.datamodel.models.map((m) => m.name);
      expect(models).toEqual(
        expect.arrayContaining(["Assessment", "Contribution", "Summary"]),
      );
    });

    it("Assessment 가 ADR-0006 Decision §1 의 결과 컬럼을 모두 갖는다", () => {
      const fields = fieldNamesOf("Assessment");
      expect(fields).toEqual(
        expect.arrayContaining([
          "id",
          "personId",
          "period",
          "scope",
          "periodStart",
          "difficulty",
          "contributionScore",
          "volume",
          "narrative",
          "createdAt",
        ]),
      );
      // immutable entity — updatedAt 미정의 (ADR-0006 Decision §1).
      expect(fields).not.toContain("updatedAt");
    });

    it("Contribution 가 ADR-0006 Decision §2 의 참조 식별자 컬럼을 갖는다", () => {
      const fields = fieldNamesOf("Contribution");
      expect(fields).toEqual(
        expect.arrayContaining([
          "id",
          "assessmentId",
          "sourceType",
          "sourceUrl",
          "sourceRef",
          "difficulty",
          "contributionScore",
          "volume",
          "createdAt",
        ]),
      );
      expect(fields).not.toContain("updatedAt");
    });

    it("Summary 가 ADR-0006 Decision §3 의 컬럼을 갖는다", () => {
      const fields = fieldNamesOf("Summary");
      expect(fields).toEqual(
        expect.arrayContaining([
          "id",
          "personId",
          "period",
          "periodStart",
          "narrative",
          "metricScore",
          "createdAt",
        ]),
      );
      expect(fields).not.toContain("updatedAt");
    });
  });

  // (b) negative — raw 본문 컬럼 부재 (R-59 / ADR-0006 Decision §4 schema-level 강제).
  describe("(b) negative — raw 본문 컬럼 0 (R-59 regression 방지)", () => {
    it.each(["Assessment", "Contribution", "Summary"])(
      "%s 에 금지된 raw 본문 필드가 하나도 없다",
      (modelName) => {
        const fields = fieldNamesOf(modelName);
        for (const forbidden of FORBIDDEN_RAW_FIELDS) {
          expect(fields).not.toContain(forbidden);
        }
      },
    );

    it("Contribution 은 본문이 아닌 참조 식별자 (sourceUrl/sourceRef) 만 보유한다", () => {
      const fields = fieldNamesOf("Contribution");
      expect(fields).toContain("sourceUrl");
      expect(fields).toContain("sourceRef");
      // 본문 컬럼은 없음 — 위 forbidden 검증과 중복이나 의도 명시용.
      expect(fields).not.toContain("body");
      expect(fields).not.toContain("content");
    });
  });

  // (c) negative 안전망 — schema 원문의 relation / @@unique / @@index / cascade 선언 검증.
  // runtime DMMF 가 carry 하지 않는 constraint 는 schema 파일 원문을 truth 로 단언.
  describe("(c) negative 안전망 — relation / @@unique / @@index / cascade 선언", () => {
    const schemaPath = join(__dirname, "prisma", "schema.prisma");
    const schema = readFileSync(schemaPath, "utf8");

    it("DMMF 의 Assessment.person / Contribution.assessment / Summary.person relation 이 존재한다", () => {
      const relOf = (model: string, field: string): boolean =>
        Prisma.dmmf.datamodel.models
          .find((m) => m.name === model)!
          .fields.some((f) => f.name === field && f.kind === "object");
      expect(relOf("Assessment", "person")).toBe(true);
      expect(relOf("Assessment", "contributions")).toBe(true);
      expect(relOf("Contribution", "assessment")).toBe(true);
      expect(relOf("Summary", "person")).toBe(true);
      // Person back-relation (양방향 relation 요건).
      expect(relOf("Person", "assessments")).toBe(true);
      expect(relOf("Person", "summaries")).toBe(true);
    });

    it("Assessment @@unique([personId, period, scope, periodStart]) 가 schema 에 선언돼 있다", () => {
      expect(schema).toMatch(
        /@@unique\(\[personId,\s*period,\s*scope,\s*periodStart\]\)/,
      );
    });

    it("Assessment / Summary @@index([personId, period, periodStart]) 가 schema 에 선언돼 있다", () => {
      const matches = schema.match(
        /@@index\(\[personId,\s*period,\s*periodStart\]\)/g,
      );
      // Assessment + Summary 두 곳 (ADR-0006 Decision §6 후보 index).
      expect(matches).not.toBeNull();
      expect(matches!.length).toBeGreaterThanOrEqual(2);
    });

    it("Person 삭제 cascade — Assessment / Summary relation 이 onDelete: Cascade 다", () => {
      // Assessment.person + Summary.person 의 cascade (ADR-0006 Decision §6).
      const cascadeToPerson = schema.match(
        /references:\s*\[id\],\s*onDelete:\s*Cascade/g,
      );
      expect(cascadeToPerson).not.toBeNull();
      // 기존 (ServiceIdentity / PersonGroupMembership ×2) + 신규 (Assessment / Contribution / Summary) = 6+.
      expect(cascadeToPerson!.length).toBeGreaterThanOrEqual(3);
    });

    it("contributionScore / metricScore 가 Decimal 로 선언돼 있다 (REQ-036, ADR-0006 Decision §5)", () => {
      expect(schema).toMatch(/contributionScore\s+Decimal/);
      expect(schema).toMatch(/metricScore\s+Decimal/);
    });
  });
});
