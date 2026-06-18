// CreateExportDto spec — T-0488. CI scripts/check-spec-presence.sh 가 신규
// production .ts 에 동반 spec 의무를 강제. class-validator decorator 동작을 isolated
// 하게 검증 (controller 의 ValidationPipe 통합 검증은 export.controller.spec.ts 가
// cover). R-112 — happy / branch / negative 충분 cover. collect-trigger.dto.spec.ts /
// grant-instance-access.dto 패턴 mirror.
import "reflect-metadata";

import { ExportScope } from "@prisma/client";
import { plainToInstance } from "class-transformer";
import { validate, type ValidatorOptions } from "class-validator";

import { CreateExportDto } from "./create-export.dto";

// helper — plain 객체 → DTO instance 변환 후 validate. constraint key 목록 반환
// (어떤 decorator 가 실패했는지 식별). options 로 whitelist/forbidNonWhitelisted 검증 지원.
async function validatePlain(
  payload: unknown,
  options?: ValidatorOptions,
): Promise<string[]> {
  const dto = plainToInstance(CreateExportDto, payload);
  const errors = await validate(dto, options);
  return errors.flatMap((e) => Object.keys(e.constraints ?? {}));
}

describe("CreateExportDto", () => {
  // --------------------------------------------------------------------------
  // happy (R-112 #1): scope=FULL 단독 (한정값 없음) → errors 빈 배열.
  // --------------------------------------------------------------------------
  it("scope=FULL 단독 payload 는 errors 빈 배열 (happy — 전체 entity 전 기간)", async () => {
    const errors = await validatePlain({ scope: ExportScope.FULL });
    expect(errors).toEqual([]);
  });

  // --------------------------------------------------------------------------
  // happy/branch (R-112 #3): scope=RANGE + dateRange (객체) → 통과 (@IsOptional 분기).
  // --------------------------------------------------------------------------
  it("scope=RANGE + dateRange 객체 payload 는 errors 빈 배열 (branch — RANGE 한정 축)", async () => {
    const errors = await validatePlain({
      scope: ExportScope.RANGE,
      dateRange: { start: "2026-01-01", end: "2026-03-31" },
    });
    expect(errors).toEqual([]);
  });

  // --------------------------------------------------------------------------
  // happy/branch: scope=PARTIAL + entitySelector (객체) → 통과 (@IsOptional 분기).
  // --------------------------------------------------------------------------
  it("scope=PARTIAL + entitySelector 객체 payload 는 errors 빈 배열 (branch — PARTIAL 한정 축)", async () => {
    const errors = await validatePlain({
      scope: ExportScope.PARTIAL,
      entitySelector: { personIds: ["p1", "p2"] },
    });
    expect(errors).toEqual([]);
  });

  // --------------------------------------------------------------------------
  // negative (R-112 #2): scope 누락 → isEnum.
  // --------------------------------------------------------------------------
  it("scope 누락 시 isEnum 위반 (negative — 필수 누락)", async () => {
    const errors = await validatePlain({});
    expect(errors).toEqual(expect.arrayContaining(["isEnum"]));
  });

  // --------------------------------------------------------------------------
  // negative: 잘못된 scope enum 값 → isEnum.
  // --------------------------------------------------------------------------
  it("잘못된 scope enum 값 (ALL) 시 isEnum 위반 (negative — invalid enum)", async () => {
    const errors = await validatePlain({ scope: "ALL" });
    expect(errors).toEqual(expect.arrayContaining(["isEnum"]));
  });

  it("소문자 scope 값 (full) 시 isEnum 위반 (negative — case-sensitive enum)", async () => {
    const errors = await validatePlain({ scope: "full" });
    expect(errors).toEqual(expect.arrayContaining(["isEnum"]));
  });

  it("scope 가 number 시 isEnum 위반 (negative — type mismatch)", async () => {
    const errors = await validatePlain({ scope: 123 });
    expect(errors).toEqual(expect.arrayContaining(["isEnum"]));
  });

  // --------------------------------------------------------------------------
  // negative: dateRange/entitySelector 가 객체 아님 → isObject.
  // --------------------------------------------------------------------------
  it("dateRange 가 string 시 isObject 위반 (negative — 한정값 type mismatch)", async () => {
    const errors = await validatePlain({
      scope: ExportScope.RANGE,
      dateRange: "2026-01-01",
    });
    expect(errors).toEqual(expect.arrayContaining(["isObject"]));
  });

  it("entitySelector 가 number 시 isObject 위반 (negative — 한정값 type mismatch)", async () => {
    const errors = await validatePlain({
      scope: ExportScope.PARTIAL,
      entitySelector: 42,
    });
    expect(errors).toEqual(expect.arrayContaining(["isObject"]));
  });

  // --------------------------------------------------------------------------
  // negative (forbidNonWhitelisted): 정의 외 필드 (raw 본문 키 / requestedById 위장)
  // → whitelistValidation. ValidationPipe 의 whitelist+forbidNonWhitelisted 동작을
  // spec 레벨에서 직접 검증 (ADR-0044 §2 raw 미저장 정합).
  // --------------------------------------------------------------------------
  it("정의 외 raw 본문 키 (rawCommitMessage) 는 forbidNonWhitelisted 로 whitelistValidation 위반 (negative — ADR-0044 §2)", async () => {
    const errors = await validatePlain(
      { scope: ExportScope.FULL, rawCommitMessage: "secret" },
      { whitelist: true, forbidNonWhitelisted: true },
    );
    expect(errors).toEqual(expect.arrayContaining(["whitelistValidation"]));
  });

  it("requestedById 위장 키 는 forbidNonWhitelisted 로 거부 (negative — actor 위장 차단)", async () => {
    const errors = await validatePlain(
      { scope: ExportScope.FULL, requestedById: "spoofed" },
      { whitelist: true, forbidNonWhitelisted: true },
    );
    expect(errors).toEqual(expect.arrayContaining(["whitelistValidation"]));
  });

  // --------------------------------------------------------------------------
  // DTO contract: 정의된 키만 선언됨 (requestedById 는 DTO contract 밖 — actor 추출).
  // --------------------------------------------------------------------------
  it("DTO 는 scope/dateRange/entitySelector 만 contract 로 가지며 requestedById 는 없다", () => {
    const dto = plainToInstance(CreateExportDto, {
      scope: ExportScope.RANGE,
      dateRange: { start: "x" },
      entitySelector: { y: 1 },
    });
    expect(Object.keys(dto).sort()).toEqual(
      ["dateRange", "entitySelector", "scope"].sort(),
    );
    expect(dto).not.toHaveProperty("requestedById");
  });
});
