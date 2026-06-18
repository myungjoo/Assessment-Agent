// CreateImportDto spec — T-0489. CI scripts/check-spec-presence.sh 가 신규
// production .ts 에 동반 spec 의무를 강제. class-validator decorator 동작을 isolated
// 하게 검증 (controller 의 ValidationPipe 통합 검증은 import.controller.spec.ts 가
// cover). R-112 — happy / branch / negative 충분 cover. create-export.dto.spec.ts
// 패턴 mirror.
import "reflect-metadata";

import { ImportMode } from "@prisma/client";
import { plainToInstance } from "class-transformer";
import { validate, type ValidatorOptions } from "class-validator";

import { CreateImportDto } from "./create-import.dto";

// helper — plain 객체 → DTO instance 변환 후 validate. constraint key 목록 반환
// (어떤 decorator 가 실패했는지 식별). options 로 whitelist/forbidNonWhitelisted 검증 지원.
async function validatePlain(
  payload: unknown,
  options?: ValidatorOptions,
): Promise<string[]> {
  const dto = plainToInstance(CreateImportDto, payload);
  const errors = await validate(dto, options);
  return errors.flatMap((e) => Object.keys(e.constraints ?? {}));
}

describe("CreateImportDto", () => {
  // --------------------------------------------------------------------------
  // happy (R-112 #1): mode 미지정 (빈 body) → errors 빈 배열 (@IsOptional 분기 —
  // service 가 schema @default(REPLACE) 위임).
  // --------------------------------------------------------------------------
  it("mode 미지정 (빈 body) 는 errors 빈 배열 (happy — service default 위임)", async () => {
    const errors = await validatePlain({});
    expect(errors).toEqual([]);
  });

  // --------------------------------------------------------------------------
  // happy/branch (R-112 #3): mode=REPLACE / MERGE 각각 → 통과 (@IsEnum 분기).
  // --------------------------------------------------------------------------
  it.each([ImportMode.REPLACE, ImportMode.MERGE])(
    "mode=%s payload 는 errors 빈 배열 (branch — 유효 ImportMode 멤버)",
    async (mode) => {
      const errors = await validatePlain({ mode });
      expect(errors).toEqual([]);
    },
  );

  // --------------------------------------------------------------------------
  // negative (R-112 #2): 잘못된 mode enum 값 → isEnum.
  // --------------------------------------------------------------------------
  it("잘못된 mode enum 값 (PATCH) 시 isEnum 위반 (negative — invalid enum)", async () => {
    const errors = await validatePlain({ mode: "PATCH" });
    expect(errors).toEqual(expect.arrayContaining(["isEnum"]));
  });

  it("소문자 mode 값 (replace) 시 isEnum 위반 (negative — case-sensitive enum)", async () => {
    const errors = await validatePlain({ mode: "replace" });
    expect(errors).toEqual(expect.arrayContaining(["isEnum"]));
  });

  it("mode 가 number 시 isEnum 위반 (negative — type mismatch)", async () => {
    const errors = await validatePlain({ mode: 123 });
    expect(errors).toEqual(expect.arrayContaining(["isEnum"]));
  });

  // --------------------------------------------------------------------------
  // negative (forbidNonWhitelisted): 정의 외 필드 (raw 본문 키 / requestedById 위장)
  // → whitelistValidation. ValidationPipe 의 whitelist+forbidNonWhitelisted 동작을
  // spec 레벨에서 직접 검증 (ADR-0044 §2 raw 미저장 정합).
  // --------------------------------------------------------------------------
  it("정의 외 raw 본문 키 (rawPayload) 는 forbidNonWhitelisted 로 whitelistValidation 위반 (negative — ADR-0044 §2)", async () => {
    const errors = await validatePlain(
      { mode: ImportMode.REPLACE, rawPayload: "secret" },
      { whitelist: true, forbidNonWhitelisted: true },
    );
    expect(errors).toEqual(expect.arrayContaining(["whitelistValidation"]));
  });

  it("requestedById 위장 키 는 forbidNonWhitelisted 로 거부 (negative — actor 위장 차단)", async () => {
    const errors = await validatePlain(
      { mode: ImportMode.REPLACE, requestedById: "spoofed" },
      { whitelist: true, forbidNonWhitelisted: true },
    );
    expect(errors).toEqual(expect.arrayContaining(["whitelistValidation"]));
  });

  // --------------------------------------------------------------------------
  // DTO contract: 정의된 키만 선언됨 (requestedById 는 DTO contract 밖 — actor 추출,
  // multipart file 도 contract 밖 — JSON body 만).
  // --------------------------------------------------------------------------
  it("DTO 는 mode 만 contract 로 가지며 requestedById 는 없다", () => {
    const dto = plainToInstance(CreateImportDto, {
      mode: ImportMode.MERGE,
    });
    expect(Object.keys(dto)).toEqual(["mode"]);
    expect(dto).not.toHaveProperty("requestedById");
  });
});
