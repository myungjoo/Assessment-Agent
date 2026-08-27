// CreateServiceIdentityDto spec — CI scripts/check-spec-presence.sh 가 신규 production
// .ts 에 동반 spec 의무를 강제한다. 본 spec 은 class-validator decorator 의 동작을
// isolated 하게 검증하며, controller 의 ValidationPipe 통합 검증은 후속 controller
// slice 의 supertest 케이스가 cover 한다.
//
// 검증 축 (ADR-0058 §Decision 6 의 4 형식 검증 + §Decision 2 의 isPrimary 미수용):
//   - happy: 유효 payload 는 0 error.
//   - error path: 필수 필드 누락.
//   - 분기: @IsNotEmpty · @MaxLength · @Matches · @IsString 각각 개별 케이스.
//   - drift guard: whitelist 모드에서 isPrimary 가 허용 축이 아님.
import { plainToInstance } from "class-transformer";
import { validateSync } from "class-validator";

import { CreateServiceIdentityDto } from "./create-service-identity.dto";

// helper — plain 객체를 DTO instance 로 변환한 뒤 위반 constraint 키 목록을 반환.
function violations(payload: unknown): string[] {
  const dto = plainToInstance(CreateServiceIdentityDto, payload);
  return validateSync(dto).flatMap((e) => Object.keys(e.constraints ?? {}));
}

// helper — controller-scope ValidationPipe 와 동일한 whitelist 옵션으로 검증.
// 미정의 필드가 오면 whitelistValidation 위반이 나오는지 확인하는 데 쓴다.
function strictViolations(payload: unknown): string[] {
  const dto = plainToInstance(CreateServiceIdentityDto, payload);
  return validateSync(dto, {
    whitelist: true,
    forbidNonWhitelisted: true,
  }).flatMap((e) => Object.keys(e.constraints ?? {}));
}

describe("CreateServiceIdentityDto", () => {
  // --------------------------------------------------------------------
  // happy
  // --------------------------------------------------------------------
  it("유효 payload 는 errors 빈 배열을 반환한다 (happy)", () => {
    expect(
      violations({ service: "GITHUB", externalId: "hong-gildong" }),
    ).toEqual([]);
  });

  it("허용 문자 집합(영숫자 . _ -) 전부를 쓴 service 도 통과한다 (happy)", () => {
    expect(violations({ service: "gh.corp_v2-1", externalId: "a" })).toEqual(
      [],
    );
  });

  // --------------------------------------------------------------------
  // error path — 필수 필드 누락
  // --------------------------------------------------------------------
  it("service 누락 시 isNotEmpty 위반 (error path)", () => {
    const errors = violations({ externalId: "hong-gildong" });
    expect(errors.length).toBeGreaterThan(0);
    expect(errors).toEqual(expect.arrayContaining(["isNotEmpty"]));
  });

  it("externalId 누락 시 isNotEmpty 위반 (error path)", () => {
    const errors = violations({ service: "GITHUB" });
    expect(errors.length).toBeGreaterThan(0);
    expect(errors).toEqual(expect.arrayContaining(["isNotEmpty"]));
  });

  // --------------------------------------------------------------------
  // 분기 cover — decorator 별 1+ 케이스
  // --------------------------------------------------------------------
  it("service 가 빈 문자열이면 isNotEmpty 위반 (분기 — @IsNotEmpty)", () => {
    expect(violations({ service: "", externalId: "hong" })).toEqual(
      expect.arrayContaining(["isNotEmpty"]),
    );
  });

  it("externalId 가 빈 문자열이면 isNotEmpty 위반 (분기 — @IsNotEmpty)", () => {
    expect(violations({ service: "GITHUB", externalId: "" })).toEqual(
      expect.arrayContaining(["isNotEmpty"]),
    );
  });

  it("service 65 자면 maxLength 위반 (분기 — @MaxLength 경계 초과)", () => {
    expect(violations({ service: "a".repeat(65), externalId: "hong" })).toEqual(
      expect.arrayContaining(["maxLength"]),
    );
  });

  it("externalId 256 자면 maxLength 위반 (분기 — @MaxLength 경계 초과)", () => {
    expect(
      violations({ service: "GITHUB", externalId: "a".repeat(256) }),
    ).toEqual(expect.arrayContaining(["maxLength"]));
  });

  it("service 에 허용 문자 밖 기호(@) 가 있으면 matches 위반 (분기 — @Matches)", () => {
    expect(violations({ service: "git@hub", externalId: "hong" })).toEqual(
      expect.arrayContaining(["matches"]),
    );
  });

  // --------------------------------------------------------------------
  // negative cases — 예외 분기별
  // --------------------------------------------------------------------
  it("service 가 공백만이면 matches 위반 (negative — 공백은 허용 문자 밖)", () => {
    const errors = violations({ service: "   ", externalId: "hong" });
    expect(errors).toEqual(expect.arrayContaining(["matches"]));
  });

  it("service 중간 공백도 matches 위반 (negative)", () => {
    expect(violations({ service: "git hub", externalId: "hong" })).toEqual(
      expect.arrayContaining(["matches"]),
    );
  });

  it("service 가 number 면 isString 위반 (negative — type mismatch)", () => {
    expect(violations({ service: 123, externalId: "hong" })).toEqual(
      expect.arrayContaining(["isString"]),
    );
  });

  it("externalId 가 null 이면 isString 위반 (negative — type mismatch)", () => {
    expect(violations({ service: "GITHUB", externalId: null })).toEqual(
      expect.arrayContaining(["isString"]),
    );
  });

  it("두 필드 모두 누락이면 두 필드가 각각 error 를 낸다 (negative — 빈 입력)", () => {
    const dto = plainToInstance(CreateServiceIdentityDto, {});
    const properties = validateSync(dto)
      .map((e) => e.property)
      .sort();
    expect(properties).toEqual(["externalId", "service"]);
  });

  // --------------------------------------------------------------------
  // 경계값 정상 통과
  // --------------------------------------------------------------------
  it("service 정확히 64 자는 통과한다 (경계값)", () => {
    expect(violations({ service: "a".repeat(64), externalId: "hong" })).toEqual(
      [],
    );
  });

  it("externalId 정확히 255 자는 통과한다 (경계값)", () => {
    expect(
      violations({ service: "GITHUB", externalId: "a".repeat(255) }),
    ).toEqual([]);
  });

  // --------------------------------------------------------------------
  // 계약 drift guard — isPrimary 는 create 의 허용 축이 아니다 (ADR §Decision 2).
  // 누군가 DTO 에 isPrimary 를 추가하면 whitelistValidation 이 사라져 본 test 가 fail 한다.
  // --------------------------------------------------------------------
  it("isPrimary 를 body 로 보내면 whitelist 위반이다 (drift guard — ADR §Decision 2)", () => {
    const errors = strictViolations({
      service: "GITHUB",
      externalId: "hong",
      isPrimary: true,
    });
    expect(errors).toEqual(["whitelistValidation"]);
  });

  it("personId 를 body 로 보내면 whitelist 위반이다 (drift guard — path param 축)", () => {
    expect(
      strictViolations({
        service: "GITHUB",
        externalId: "hong",
        personId: "p1",
      }),
    ).toEqual(["whitelistValidation"]);
  });
});
