// UpdateServiceIdentityDto spec — CI scripts/check-spec-presence.sh 의 동반 spec 의무.
// ADR-0058 §Decision 3 ("PATCH 는 externalId 단일 축, null 전달 시 400") 의 계약을
// decorator 수준에서 isolated 하게 고정한다.
//
// 검증 축:
//   - happy: externalId 만 전달 / 아예 미전달(부분 갱신 semantic) 모두 0 error.
//   - error path: 값 제약 위반(빈 값 · 길이 초과 · type mismatch).
//   - null 분기: @IsOptional 이 아니라 @ValidateIf 를 쓴 이유 — null 은 error 여야 한다.
//   - drift guard: service · isPrimary 는 허용 축이 아니다.
import { plainToInstance } from "class-transformer";
import { validateSync } from "class-validator";

import { UpdateServiceIdentityDto } from "./update-service-identity.dto";

function violations(payload: unknown): string[] {
  const dto = plainToInstance(UpdateServiceIdentityDto, payload);
  return validateSync(dto).flatMap((e) => Object.keys(e.constraints ?? {}));
}

// controller-scope ValidationPipe 와 동일한 whitelist 옵션 — 미정의 필드 차단 확인용.
function strictViolations(payload: unknown): string[] {
  const dto = plainToInstance(UpdateServiceIdentityDto, payload);
  return validateSync(dto, {
    whitelist: true,
    forbidNonWhitelisted: true,
  }).flatMap((e) => Object.keys(e.constraints ?? {}));
}

describe("UpdateServiceIdentityDto", () => {
  // --------------------------------------------------------------------
  // happy
  // --------------------------------------------------------------------
  it("externalId 만 전달하면 errors 빈 배열이다 (happy)", () => {
    expect(violations({ externalId: "hong-gildong-2" })).toEqual([]);
  });

  it("빈 payload 는 errors 빈 배열이다 (분기 — 미전달 시 검증 skip)", () => {
    expect(violations({})).toEqual([]);
  });

  // --------------------------------------------------------------------
  // error path / 분기 cover
  // --------------------------------------------------------------------
  it("externalId 가 빈 문자열이면 isNotEmpty 위반 (error path — @IsNotEmpty)", () => {
    const errors = violations({ externalId: "" });
    expect(errors.length).toBeGreaterThan(0);
    expect(errors).toEqual(expect.arrayContaining(["isNotEmpty"]));
  });

  it("externalId 256 자면 maxLength 위반 (분기 — @MaxLength 경계 초과)", () => {
    expect(violations({ externalId: "a".repeat(256) })).toEqual(
      expect.arrayContaining(["maxLength"]),
    );
  });

  it("externalId 정확히 255 자는 통과한다 (경계값)", () => {
    expect(violations({ externalId: "a".repeat(255) })).toEqual([]);
  });

  // --------------------------------------------------------------------
  // negative cases
  // --------------------------------------------------------------------
  it("externalId 가 null 이면 isString 위반이다 (negative — ADR §Decision 3 의 null 400)", () => {
    const errors = violations({ externalId: null });
    expect(errors).toEqual(expect.arrayContaining(["isString"]));
  });

  it("externalId 가 number 면 isString 위반 (negative — type mismatch)", () => {
    expect(violations({ externalId: 123 })).toEqual(
      expect.arrayContaining(["isString"]),
    );
  });

  it("externalId 가 명시적 undefined 면 통과한다 (negative 대비 — 키 존재해도 값 없으면 skip)", () => {
    expect(violations({ externalId: undefined })).toEqual([]);
  });

  // --------------------------------------------------------------------
  // 계약 drift guard — ADR §Decision 3 의 금지 축.
  // service / isPrimary 를 DTO 에 추가하면 whitelistValidation 이 사라져 fail 한다.
  // --------------------------------------------------------------------
  it("service 를 body 로 보내면 whitelist 위반이다 (drift guard — 금지 축)", () => {
    expect(strictViolations({ service: "GITHUB" })).toEqual([
      "whitelistValidation",
    ]);
  });

  it("isPrimary 를 body 로 보내면 whitelist 위반이다 (drift guard — 금지 축)", () => {
    expect(strictViolations({ isPrimary: true })).toEqual([
      "whitelistValidation",
    ]);
  });

  it("허용 축은 externalId 하나뿐이다 (drift guard — 축 개수 고정)", () => {
    const dto = plainToInstance(UpdateServiceIdentityDto, {
      externalId: "ok",
      service: "GITHUB",
      isPrimary: true,
    });
    const forbidden = validateSync(dto, {
      whitelist: true,
      forbidNonWhitelisted: true,
    })
      .map((e) => e.property)
      .sort();
    expect(forbidden).toEqual(["isPrimary", "service"]);
  });
});
