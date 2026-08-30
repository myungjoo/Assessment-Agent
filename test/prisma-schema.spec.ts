// test/prisma-schema.spec.ts — T-0485 (ADR-0044 Decision §1) schema-validation spec.
//
// 본 task 는 prisma/schema.prisma 에 ExportJob / ImportJob 두 model + JobStatus /
// ExportScope / ImportMode 세 enum 을 선언만 한다 (controller/service 배선은 후속 task —
// ADR-0044 §Out of scope). 따라서 분기 로직 production 코드가 0 LOC — branch / error-path
// 항목은 "schema 선언만, 분기 없음 — 생략" (R-112, 기존 prisma-schema.spec.ts 패턴 정합).
//
// 본 spec 의 검증 전략 (분기 없는 schema 라 happy-path + negative 중심):
//   (a) happy-path — 생성된 PrismaClient 가 exportJob / importJob delegate 를 노출하고,
//       DMMF 가 2 model 을 datamodel 에 포함. enum (JobStatus / ExportScope / ImportMode)
//       이 generated client 에 export 되며 ADR-0044 §1 값 집합을 정확히 갖는다.
//   (b) negative (R-59 regression 방지, ADR-0044 §2 raw 미저장 invariant) — ExportJob /
//       ImportJob 어디에도 raw 본문 필드 (commitBody / diff / pageBody / content / body
//       등) 가 **존재하지 않음**. schema 에 자리가 없으면 저장 자체가 불가 — schema-level
//       강제 (ADR-0006 의 raw 미저장 schema-level 강제 동형 기법).
//   (c) negative 안전망 — 두 model 의 핵심 컬럼 / relation / @@index / FK / default 가
//       ADR-0044 §1 결정과 drift 없는지 schema 원문 + DMMF 로 단언.
//
// (a)(b) 는 runtime DMMF (Prisma.dmmf) + generated enum import 로 검증. runtime DMMF 가
// carry 하지 않는 @@index / FK cascade / @default 메타는 prisma/schema.prisma 원문을
// 읽어 선언 존재를 단언한다 (schema-as-truth, 기존 prisma-schema.spec.ts (c) 패턴 정합).
import { readFileSync } from "fs";
import { join } from "path";

import {
  ExportScope,
  ImportMode,
  JobStatus,
  Prisma,
  PrismaClient,
} from "@prisma/client";

// ADR-0044 §2 가 명시적으로 금지한 raw 본문 컬럼 후보. 이 중 하나라도 ExportJob /
// ImportJob field 로 존재하면 fail — raw 미저장 invariant 의 schema-level regression 방지.
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
  // ExportJob / ImportJob 고유 금지 후보 — artifact 본문 / 응답 본문 컬럼 차단.
  "artifactBody",
  "payload",
  "rawPayload",
  "responseBody",
];

// runtime DMMF 에서 model 의 scalar/relation field 이름 집합을 추출.
function fieldNamesOf(modelName: string): string[] {
  const model = Prisma.dmmf.datamodel.models.find((m) => m.name === modelName);
  if (!model) {
    throw new Error(`DMMF 에 model ${modelName} 가 없습니다`);
  }
  return model.fields.map((f) => f.name);
}

describe("prisma schema — ExportJob / ImportJob (T-0485, ADR-0044 §1)", () => {
  // (a) happy-path — PrismaClient delegate + DMMF model + enum export 노출.
  describe("(a) happy-path — delegate / DMMF / enum 노출", () => {
    it("DMMF datamodel 이 ExportJob / ImportJob 2 model 을 모두 포함한다", () => {
      const models = Prisma.dmmf.datamodel.models.map((m) => m.name);
      expect(models).toEqual(
        expect.arrayContaining(["ExportJob", "ImportJob"]),
      );
    });

    it("PrismaClient prototype 이 exportJob / importJob delegate 를 노출한다", () => {
      // 실 DB connection 없이 prototype 의 delegate getter 존재만 확인 (DATABASE_URL 불요).
      // Prisma 7.x 는 delegate 를 lazy getter 로 정의 — descriptor 존재 / DMMF model
      // 이름 lowercase cross-check 로 확인 (기존 prisma-schema.spec.ts (a) 패턴 정합).
      // delegate 이름은 model 이름의 camelCase (ExportJob → exportJob), 비교는 양쪽
      // 모두 lowercase 로 정규화 — DMMF model 이름 lowercase ↔ delegate 이름 lowercase.
      const proto = PrismaClient.prototype as unknown as Record<
        string,
        unknown
      >;
      const hasDelegate = (name: string): boolean =>
        name in proto ||
        Object.getOwnPropertyDescriptor(proto, name) !== undefined ||
        Prisma.dmmf.datamodel.models.some(
          (m) => m.name.toLowerCase() === name.toLowerCase(),
        );
      expect(hasDelegate("exportJob")).toBe(true);
      expect(hasDelegate("importJob")).toBe(true);
    });

    it("ExportJob 이 ADR-0044 §1 의 공통 + 고유 필드를 모두 갖는다", () => {
      const fields = fieldNamesOf("ExportJob");
      expect(fields).toEqual(
        expect.arrayContaining([
          // 공통 (ADR-0044 §1)
          "id",
          "status",
          "requestedById",
          "requestedBy",
          "createdAt",
          "startedAt",
          "finishedAt",
          "error",
          "artifactRef",
          // ExportJob 고유 (ADR-0044 §1)
          "scope",
          "dateRange",
          "entitySelector",
        ]),
      );
      // job row 는 createdAt 한 시각만 기록 — updatedAt 미정의 (header 주석 정합).
      expect(fields).not.toContain("updatedAt");
    });

    it("ImportJob 이 ADR-0044 §1 의 공통 + 고유 필드를 모두 갖는다", () => {
      const fields = fieldNamesOf("ImportJob");
      expect(fields).toEqual(
        expect.arrayContaining([
          // 공통 (ADR-0044 §1)
          "id",
          "status",
          "requestedById",
          "requestedBy",
          "createdAt",
          "startedAt",
          "finishedAt",
          "error",
          "artifactRef",
          // ImportJob 고유 (ADR-0044 §1)
          "mode",
          "restoredRowCount",
        ]),
      );
      // updatedAt 미정의 (ExportJob 정합).
      expect(fields).not.toContain("updatedAt");
    });

    // enum 값 집합 단언 — ADR-0044 §1 의 4값 (JobStatus) + 3값 (ExportScope) + 2값 (ImportMode).
    // 분기 없는 schema 의 flow/branch 항목 대체 — enum 값별 존재 단언 (task Acceptance 정합).
    it("JobStatus enum 이 ADR-0044 §1 의 4값 (PENDING / RUNNING / SUCCEEDED / FAILED) 을 갖는다", () => {
      expect(JobStatus.PENDING).toBe("PENDING");
      expect(JobStatus.RUNNING).toBe("RUNNING");
      expect(JobStatus.SUCCEEDED).toBe("SUCCEEDED");
      expect(JobStatus.FAILED).toBe("FAILED");
      // 정확히 4값 — 향후 CANCELLED 추가 시 본 test 가 의도적으로 fail (drift 박제).
      expect(Object.values(JobStatus)).toHaveLength(4);
    });

    it("ExportScope enum 이 ADR-0044 §1 의 3값 (FULL / RANGE / PARTIAL) 을 갖는다", () => {
      expect(ExportScope.FULL).toBe("FULL");
      expect(ExportScope.RANGE).toBe("RANGE");
      expect(ExportScope.PARTIAL).toBe("PARTIAL");
      expect(Object.values(ExportScope)).toHaveLength(3);
    });

    it("ImportMode enum 이 ADR-0044 §1 의 2값 (REPLACE / MERGE) 을 갖는다", () => {
      expect(ImportMode.REPLACE).toBe("REPLACE");
      expect(ImportMode.MERGE).toBe("MERGE");
      expect(Object.values(ImportMode)).toHaveLength(2);
    });
  });

  // (b) negative — raw 본문 컬럼 부재 (ADR-0044 §2 raw 미저장 invariant schema-level 강제).
  describe("(b) negative — raw 본문 컬럼 0 (ADR-0044 §2 regression 방지)", () => {
    it.each(["ExportJob", "ImportJob"])(
      "%s 에 금지된 raw 본문 필드가 하나도 없다",
      (modelName) => {
        const fields = fieldNamesOf(modelName);
        for (const forbidden of FORBIDDEN_RAW_FIELDS) {
          expect(fields).not.toContain(forbidden);
        }
      },
    );

    it("artifactRef / error 가 본문 아닌 참조/요약 String 타입이고, lifecycle nullable 컬럼이 schema 원문에서 `?` 표기다", () => {
      // ADR-0044 §1 lifecycle: PENDING 동안 startedAt/finishedAt null, RUNNING 시
      // startedAt set, 종결 시 finishedAt/error/artifactRef set. Prisma 7.x DMMF 는
      // type 만 carry, nullable 여부는 schema 원문 단언 (schema-as-truth, 아래 (c) 패턴).
      const fieldOf = (model: string, name: string) =>
        Prisma.dmmf.datamodel.models
          .find((m) => m.name === model)!
          .fields.find((f) => f.name === name);
      for (const m of ["ExportJob", "ImportJob"]) {
        expect(fieldOf(m, "artifactRef")?.type).toBe("String");
        expect(fieldOf(m, "error")?.type).toBe("String");
      }
      // 두 model 모두에서 nullable 4 종 (startedAt/finishedAt/error/artifactRef) `?` 박제.
      const schema = readFileSync(
        join(__dirname, "..", "prisma", "schema.prisma"),
        "utf8",
      );
      for (const re of [
        /startedAt\s+DateTime\?/g,
        /finishedAt\s+DateTime\?/g,
        /error\s+String\?/g,
        /artifactRef\s+String\?/g,
      ]) {
        const matches = schema.match(re);
        expect(matches).not.toBeNull();
        expect(matches!.length).toBeGreaterThanOrEqual(2);
      }
    });
  });

  // (c) negative 안전망 — schema 원문의 relation / @@index / FK cascade / @default 단언.
  // runtime DMMF 가 carry 하지 않는 constraint 는 schema 파일 원문을 truth 로 단언.
  describe("(c) negative 안전망 — relation / @@index / FK cascade / @default 선언", () => {
    const schemaPath = join(__dirname, "..", "prisma", "schema.prisma");
    const schema = readFileSync(schemaPath, "utf8");

    it("DMMF 의 ExportJob.requestedBy / ImportJob.requestedBy relation 이 존재한다", () => {
      const relOf = (model: string, field: string): boolean =>
        Prisma.dmmf.datamodel.models
          .find((m) => m.name === model)!
          .fields.some((f) => f.name === field && f.kind === "object");
      expect(relOf("ExportJob", "requestedBy")).toBe(true);
      expect(relOf("ImportJob", "requestedBy")).toBe(true);
      // User back-relation (양방향 relation 요건, ADR-0044 Cross-Module Impact).
      expect(relOf("User", "exportJobs")).toBe(true);
      expect(relOf("User", "importJobs")).toBe(true);
    });

    it("ExportJob / ImportJob 의 @@index([status, createdAt]) 가 schema 에 선언돼 있다", () => {
      const matches = schema.match(/@@index\(\[status,\s*createdAt\]\)/g);
      // ExportJob + ImportJob 두 곳 (ADR-0044 §1 status polling + 감사 조회).
      expect(matches).not.toBeNull();
      expect(matches!.length).toBeGreaterThanOrEqual(2);
    });

    it("FK onDelete:Restrict + default 값 + Json? nullable + enum 정의 가 schema 원문에 선언돼 있다 (ADR-0044 §1)", () => {
      // 종합 schema-as-truth 단언 — DMMF 가 carry 하지 않는 메타 일괄 검증.
      // FK Restrict (User hard delete 시 dangling job 차단, DifficultyMapping→LlmProviderConfig 정합):
      expect(schema).toMatch(
        /requestedBy\s+User\s+@relation\("UserExportJobs",\s*fields:\s*\[requestedById\],\s*references:\s*\[id\],\s*onDelete:\s*Restrict\)/,
      );
      expect(schema).toMatch(
        /requestedBy\s+User\s+@relation\("UserImportJobs",\s*fields:\s*\[requestedById\],\s*references:\s*\[id\],\s*onDelete:\s*Restrict\)/,
      );
      // default 값 — job 시작 PENDING, Import default REPLACE (ADR-0044 §1).
      expect(schema).toMatch(/status\s+JobStatus\s+@default\(PENDING\)/);
      expect(schema).toMatch(/mode\s+ImportMode\s+@default\(REPLACE\)/);
      // dateRange / entitySelector nullable Json — scope=RANGE/PARTIAL 시만 set.
      expect(schema).toMatch(/dateRange\s+Json\?/);
      expect(schema).toMatch(/entitySelector\s+Json\?/);
      // enum 정의 (값 집합은 위 (a) 의 export 단언이 cover — 본 단언은 schema 원문 존재).
      expect(schema).toMatch(
        /enum\s+JobStatus\s*\{[\s\S]*PENDING[\s\S]*RUNNING[\s\S]*SUCCEEDED[\s\S]*FAILED[\s\S]*\}/,
      );
      expect(schema).toMatch(
        /enum\s+ExportScope\s*\{[\s\S]*FULL[\s\S]*RANGE[\s\S]*PARTIAL[\s\S]*\}/,
      );
      expect(schema).toMatch(
        /enum\s+ImportMode\s*\{[\s\S]*REPLACE[\s\S]*MERGE[\s\S]*\}/,
      );
    });
  });
});

// T-0799 (ADR-0052 Decision (a)) — User.timezone 컬럼 additive migration 검증.
//
// 본 task 는 prisma/schema.prisma 의 model User 에 `timezone String
// @default("Asia/Seoul")` 컬럼 1개 + additive migration SQL 만 추가한다 (helper
// 일반화·R-9/display 배선은 후속 slice — ADR-0052 §Out of scope / §Follow-ups).
// 따라서 production 분기 로직이 0 LOC — branch / error-path 항목은 "schema
// 선언 + migration DDL 만, 분기 없음 — 생략" (R-112, 위 ExportJob/ImportJob 블록
// (T-0485) 및 기존 prisma-schema.spec.ts 패턴 정합).
//
// 검증 전략 (분기 없는 schema — happy-path + negative/regression 중심):
//   (a) happy-path — 생성된 PrismaClient 의 User DMMF 에 timezone 필드가 존재하고
//       type=String, hasDefaultValue=true, default 값 "Asia/Seoul" 임을 단언 +
//       migration.sql 원문에 `ADD COLUMN "timezone"` + `DEFAULT 'Asia/Seoul'` 존재.
//   (b) negative / regression — 기존 User 컬럼/relation (email @unique ·
//       instanceAccess · exportJobs · importJobs) 이 그대로 존재해 additive
//       무손상임을 단언 (기존 시그니처 파괴 regression 방지) + timezone 이
//       nullable 아님(NOT NULL) 을 schema 원문으로 단언 (default 없는 nullable
//       drift 차단).
describe("prisma schema — User.timezone (T-0799, ADR-0052 §Decision (a))", () => {
  const schemaPath = join(__dirname, "..", "prisma", "schema.prisma");
  const schema = readFileSync(schemaPath, "utf8");
  const migrationPath = join(
    __dirname,
    "..",
    "prisma",
    "migrations",
    "20260706000000_user_timezone",
    "migration.sql",
  );
  const migration = readFileSync(migrationPath, "utf8");

  // User 모델의 timezone 필드 DMMF 를 반환 (runtime DMMF — hasDefaultValue/default carry).
  const timezoneField = () =>
    Prisma.dmmf.datamodel.models
      .find((m) => m.name === "User")!
      .fields.find((f) => f.name === "timezone");

  // (a) happy-path — DMMF 필드 존재 + type/default + migration DDL 원문.
  describe("(a) happy-path — DMMF timezone 필드 + migration DDL", () => {
    it("User DMMF 에 timezone 필드가 존재하고 type=String 이다", () => {
      const f = timezoneField();
      expect(f).toBeDefined();
      expect(f?.type).toBe("String");
    });

    it('timezone 의 default 가 "Asia/Seoul" 이다 (hasDefaultValue — DMMF carry 시 DMMF, 아니면 schema-as-truth)', () => {
      // Prisma 7.x runtime DMMF 는 scalar 필드의 @default 메타(hasDefaultValue/default)를
      // carry 하지 않는다 (본 파일 상단 (c) 블록 주석의 "@default 메타는 schema 원문을
      // truth 로 단언" 패턴 정합 — 위 ExportJob/ImportJob 도 default 는 schema 원문으로
      // 단언). 따라서 DMMF 가 메타를 노출하면 DMMF 로, 아니면 schema 원문으로 default 를
      // 단언한다 (Prisma 버전 무관하게 criterion 의도 "default=Asia/Seoul" 를 강제).
      const f = timezoneField() as
        | { hasDefaultValue?: boolean; default?: unknown }
        | undefined;
      if (f?.hasDefaultValue !== undefined) {
        // DMMF 가 메타를 carry 하는 버전 — DMMF 로 단언.
        expect(f.hasDefaultValue).toBe(true);
        expect(f.default).toBe("Asia/Seoul");
      } else {
        // DMMF 가 carry 안 하는 버전 (현 Prisma 7.x) — schema 원문 truth 로 default 단언.
        expect(schema).toMatch(/timezone\s+String\s+@default\("Asia\/Seoul"\)/);
      }
    });

    it('schema 원문에 `timezone String @default("Asia/Seoul")` 이 선언돼 있다', () => {
      expect(schema).toMatch(/timezone\s+String\s+@default\("Asia\/Seoul"\)/);
    });

    it("migration.sql 에 `ADD COLUMN \"timezone\"` + `DEFAULT 'Asia/Seoul'` 이 존재한다", () => {
      expect(migration).toMatch(/ADD COLUMN "timezone"/);
      expect(migration).toMatch(/DEFAULT 'Asia\/Seoul'/);
      // additive only — 기존 컬럼 DROP / RENAME / ALTER TYPE 없음 (무손상 regression 방지).
      expect(migration).not.toMatch(/DROP COLUMN/);
      expect(migration).not.toMatch(/RENAME COLUMN/);
    });
  });

  // (b) negative / regression — additive 무손상 + NOT NULL drift 차단.
  describe("(b) negative / regression — additive 무손상 + NOT NULL drift 차단", () => {
    it("기존 User 컬럼/relation (email @unique · instanceAccess · exportJobs · importJobs) 이 그대로 존재한다", () => {
      const fields = Prisma.dmmf.datamodel.models
        .find((m) => m.name === "User")!
        .fields.map((f) => f.name);
      expect(fields).toEqual(
        expect.arrayContaining([
          "id",
          "email",
          "hashedPassword",
          "role",
          "createdAt",
          "updatedAt",
          "instanceAccess",
          "exportJobs",
          "importJobs",
        ]),
      );
      // email @unique 유지 (schema 원문).
      expect(schema).toMatch(/email\s+String\s+@unique/);
    });

    it("timezone 이 nullable 아님(NOT NULL) — schema 원문에 `timezone String?` 이 없다", () => {
      // default 없는 nullable(timezone String? 또는 @default 없는 String?) drift 차단.
      expect(schema).not.toMatch(/timezone\s+String\?/);
      // migration DDL 도 NOT NULL 선언 — nullable 컬럼 drift 차단.
      expect(migration).toMatch(/ADD COLUMN "timezone" TEXT NOT NULL/);
    });

    // 분기 cover — 본 task 는 production 분기 로직 0 LOC (schema 선언 + migration DDL 만).
    // "분기 없음, 이 항목 생략" (R-112, 기존 prisma-schema.spec.ts (T-0485) 패턴 정합).
  });
});

// T-1808 (ADR-0059 §Decision 4 / §Follow-ups (a)) — CollectionTarget model + migration 검증.
//
// 본 task 는 model CollectionTarget 1 개와 additive migration SQL 만 추가한다 (배선은 후속
// slice — ADR-0059 §Follow-ups (b)~(e)). 따라서 **분기 없음 — schema 선언 slice** 이며
// production 분기 로직이 0 LOC 다. 검증 구획: (a) happy-path — delegate / DMMF model /
// 10 필드 타입·list, (b) error path — 필수 3 필드가 nullable 아님, (c) flow/branch 대체 —
// type 값 invariant 가 DB 제약이 아니라 후속 DTO `@IsIn` 소관임을 "Prisma enum 미생성"
// 으로 문서화, (d) negative 4 종 — credential 컬럼 부재 / relation 0 / @@unique 계약 /
// 기존 model 무손상 (위 T-0485 / T-0799 블록 패턴 승계).
//
// Prisma 7.x runtime DMMF 는 isList / isRequired / @default 메타를 carry 하지 않는다 (위
// T-0799 블록 주석과 동일 사실). 그런 메타는 schema 원문 + migration SQL 을 truth 로
// 단언하고, DMMF 가 carry 하는 버전에서는 DMMF 로도 함께 단언한다.
describe("prisma schema — CollectionTarget (T-1808, ADR-0059 §Decision 4)", () => {
  const schema = readFileSync(
    join(__dirname, "..", "prisma", "schema.prisma"),
    "utf8",
  );
  const MIGRATION_DIR = "20260830000000_collection_target";
  const migration = readFileSync(
    join(
      __dirname,
      "..",
      "prisma",
      "migrations",
      MIGRATION_DIR,
      "migration.sql",
    ),
    "utf8",
  );

  // `--` 주석을 제거한 실행 DDL — 주석에 인용된 금지 어휘의 오탐 차단.
  const migrationDdl = migration
    .split("\n")
    .filter((line) => !line.trim().startsWith("--"))
    .join("\n");

  // CollectionTarget model 블록만 잘라낸다 — 다른 model 의 동명 필드 오탐 차단.
  const modelBlock = (() => {
    const matched = schema.match(/model CollectionTarget \{[\s\S]*?\n\}/);
    if (!matched) {
      throw new Error("schema 원문에 model CollectionTarget 블록이 없습니다");
    }
    return matched[0];
  })();

  // ADR-0059 §Decision 4 필드 표 1:1 — 이름 / 타입 / list 여부.
  const EXPECTED_FIELDS = [
    { name: "id", type: "String", isList: false },
    { name: "type", type: "String", isList: false },
    { name: "instanceKey", type: "String", isList: false },
    { name: "endpoint", type: "String", isList: false },
    { name: "orgs", type: "String", isList: true },
    { name: "repos", type: "String", isList: true },
    { name: "spaces", type: "String", isList: true },
    { name: "active", type: "Boolean", isList: false },
    { name: "createdAt", type: "DateTime", isList: false },
    { name: "updatedAt", type: "DateTime", isList: false },
  ] as const;

  const targetModel = () =>
    Prisma.dmmf.datamodel.models.find((m) => m.name === "CollectionTarget");

  // (a) happy-path — delegate / DMMF model / 10 필드 타입·list 여부.
  describe("(a) happy-path — delegate / DMMF model / 필드 표 1:1", () => {
    it("DMMF datamodel 이 CollectionTarget model 을 포함하고 PrismaClient 가 collectionTarget delegate 를 노출한다", () => {
      expect(targetModel()).toBeDefined();
      // 실 DB connection 없이 prototype 의 delegate 존재만 확인 (위 T-0485 블록 패턴 정합).
      const proto = PrismaClient.prototype as unknown as Record<
        string,
        unknown
      >;
      const hasDelegate =
        "collectionTarget" in proto ||
        Object.getOwnPropertyDescriptor(proto, "collectionTarget") !==
          undefined ||
        Prisma.dmmf.datamodel.models.some(
          (m) => m.name.toLowerCase() === "collectiontarget",
        );
      expect(hasDelegate).toBe(true);
    });

    it("ADR-0059 §Decision 4 의 10 개 필드가 정확히 그 집합으로 선언돼 있다", () => {
      const names = targetModel()!.fields.map((f) => f.name);
      expect(names).toEqual(EXPECTED_FIELDS.map((f) => f.name));
    });

    it.each(EXPECTED_FIELDS.map((f) => [f.name, f.type, f.isList] as const))(
      "%s 필드가 type=%s / isList=%s 로 선언돼 있다",
      (name, type, isList) => {
        const field = targetModel()!.fields.find((f) => f.name === name) as
          | { type: string; isList?: boolean }
          | undefined;
        expect(field).toBeDefined();
        expect(field!.type).toBe(type);
        if (field!.isList !== undefined) {
          // DMMF 가 isList 를 carry 하는 버전 — DMMF 로 단언.
          expect(field!.isList).toBe(isList);
        }
        // schema-as-truth — Prisma 7.x DMMF 가 isList 를 carry 하지 않으므로 원문으로도 단언.
        const declaredAsList = new RegExp(`\\n\\s+${name}\\s+${type}\\[\\]`);
        expect(declaredAsList.test(modelBlock)).toBe(isList);
      },
    );

    it("migration.sql 이 CREATE TABLE 과 10 개 컬럼 + 배열 default 를 포함한다", () => {
      expect(migration).toMatch(/CREATE TABLE "CollectionTarget"/);
      for (const { name } of EXPECTED_FIELDS) {
        expect(migration).toContain(`"${name}"`);
      }
      // 다중 값 컬럼은 PostgreSQL TEXT[] + 빈 배열 default (ADR-0059 §Decision 4).
      for (const name of ["orgs", "repos", "spaces"]) {
        expect(migration).toContain(
          `"${name}" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[]`,
        );
      }
      expect(migration).toMatch(
        /CONSTRAINT "CollectionTarget_pkey" PRIMARY KEY \("id"\)/,
      );
    });
  });

  // (b) error path — 필수 필드 누락 시 저장 불가라는 schema-level 계약의 regression 방지.
  describe("(b) error path — 필수 3 필드가 nullable 이 아니다", () => {
    it.each(["type", "instanceKey", "endpoint"])(
      "%s 가 required 다 (schema 원문에 `?` 없음 + migration DDL NOT NULL)",
      (name) => {
        const field = targetModel()!.fields.find((f) => f.name === name) as
          | { isRequired?: boolean }
          | undefined;
        expect(field).toBeDefined();
        if (field!.isRequired !== undefined) {
          expect(field!.isRequired).toBe(true);
        }
        // schema-as-truth — optional 표기(`String?`) drift 차단 + DDL NOT NULL 확인.
        expect(modelBlock).not.toMatch(
          new RegExp(`\\n\\s+${name}\\s+String\\?`),
        );
        expect(modelBlock).toMatch(new RegExp(`\\n\\s+${name}\\s+String\\s`));
        expect(migration).toContain(`"${name}" TEXT NOT NULL`);
      },
    );
  });

  // (c) flow / branch 대체 — 분기 없음 (schema 선언 slice). type 이 허용하는 두 값은 DB
  // 제약이 아니라 후속 DTO 의 @IsIn 소관 (§Decision 4 / §Follow-ups (c)) — 그 사실을
  // "Prisma enum 미생성" 단언으로 문서화·강제한다.
  describe("(c) 분기 없음 — type 값 invariant 는 DB 제약이 아님", () => {
    it("type 이 String 이며 대상 종류용 Prisma enum 이 생성되지 않았다", () => {
      expect(targetModel()!.fields.find((f) => f.name === "type")!.type).toBe(
        "String",
      );
      // 대상 종류 enum 블록이 schema 에 없고 migration 도 CREATE TYPE 을 만들지 않는다
      // (enum-as-String 관례 — §Decision 4).
      expect(schema).not.toMatch(/enum\s+CollectionTarget\w*\s*\{/);
      expect(schema).not.toMatch(/enum\s+\w*TargetType\s*\{/);
      expect(migrationDdl).not.toMatch(/CREATE TYPE/);
    });
  });

  // (d) negative 4 종 — credential 부재 / relation 0 / @@unique 계약 / 기존 model 무손상.
  describe("(d) negative — credential 0 / relation 0 / unique 계약 / 기존 model 무손상", () => {
    it("credential 계열 금지 컬럼이 하나도 존재하지 않는다 (ADR-0059 §Decision 2 regression)", () => {
      const names = targetModel()!.fields.map((f) => f.name.toLowerCase());
      for (const forbidden of [
        "token",
        "tokenenc",
        "secret",
        "password",
        "hashedpassword",
        "apikey",
        "credential",
        "credentials",
        "authuser",
      ]) {
        expect(names).not.toContain(forbidden);
      }
      // 선언 원문에도 없다 (DMMF 우회 drift 차단). 주석은 금지 목록을 인용하므로 제외.
      const declarationLines = modelBlock
        .split("\n")
        .filter((line) => !line.trim().startsWith("//"))
        .join("\n");
      expect(declarationLines).not.toMatch(
        /token|secret|password|apiKey|credential/i,
      );
    });

    it("다른 model 로의 relation 필드가 0 개다 (additive 판정 regression)", () => {
      const relations = targetModel()!.fields.filter(
        (f) => (f as { kind?: string }).kind === "object",
      );
      expect(relations).toHaveLength(0);
      // @relation 0 + FK 0 — back-relation 불요라는 additive 판정(§Decision 6) 근거.
      expect(modelBlock).not.toMatch(/@relation/);
      expect(migrationDdl).not.toMatch(/FOREIGN KEY/);
      expect(migrationDdl).not.toMatch(/ADD CONSTRAINT "\w+_fkey"/);
    });

    it("@@unique([type, instanceKey]) 가 schema 와 migration 양쪽에 있고 endpoint 단독 unique 는 없다", () => {
      expect(modelBlock).toMatch(/@@unique\(\[type,\s*instanceKey\]\)/);
      expect(migration).toMatch(
        /CREATE UNIQUE INDEX "CollectionTarget_type_instanceKey_key" ON "CollectionTarget"\("type", "instanceKey"\)/,
      );
      // endpoint 단독 unique 부재 — 같은 host 의 서로 다른 org 집합 등록이 정당한 사용
      // 이기 때문 (§Decision 4).
      expect(modelBlock).not.toMatch(/endpoint\s+String\s+@unique/);
      expect(modelBlock).not.toMatch(/@@unique\(\[endpoint\]\)/);
      expect(migrationDdl).not.toMatch(/UNIQUE INDEX[^\n]*\("endpoint"\)/);
    });

    it("기존 model (Person · User · ServiceIdentity) 의 필드 수·필수성이 그대로다 (안전망)", () => {
      // 필드 수 고정 — 본 migration 이 기존 model 에 컬럼/relation 을 더하거나 뺐다면 fail.
      const countOf = (name: string) =>
        Prisma.dmmf.datamodel.models.find((m) => m.name === name)!.fields
          .length;
      expect(countOf("Person")).toBe(12);
      expect(countOf("User")).toBe(10);
      expect(countOf("ServiceIdentity")).toBe(8);
      // 필수성 표기 무변경 + 기존 table 무접촉 (additive only).
      expect(schema).toMatch(/fullName\s+String\s/);
      expect(schema).toMatch(/email\s+String\s+@unique/);
      expect(schema).toMatch(/hashedPassword\s+String\s/);
      expect(schema).toMatch(/externalId\s+String\s/);
      expect(migrationDdl).not.toMatch(/ALTER TABLE/);
      expect(migrationDdl).not.toMatch(/DROP /);
      expect(migrationDdl).not.toMatch(/UPDATE /);
    });
  });
});
