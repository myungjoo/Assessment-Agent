// UpdateCollectionTargetDto spec — CI scripts/check-spec-presence.sh 가 신규 production
// .ts 에 동반 spec 을 의무화한다. 본 spec 은 class-validator decorator 의 동작을 isolated
// 하게 검증하며, ValidationPipe 통합 검증은 후속 controller slice 의 supertest 가 맡는다.
// 구조는 create-collection-target.dto.spec.ts 를 mirror 한다.
//
// 검증 축(ADR-0059 §Decision 5 PATCH 행 · §Decision 4 필드 표 · §Decision 2 credential 경계):
//   - happy: 빈 객체 `{}` / 단일 필드 / 5 필드 전량 payload 각각 0 error.
//   - error path: 전달된 필드가 계약을 위반할 때(빈 endpoint · 문자열 active) error.
//   - 분기: @ValidateIf · @IsNotEmpty · @MaxLength · @IsArray ·
//     @IsString({ each: true }) · @IsBoolean 각 decorator 별 1+ 케이스. 특히 @ValidateIf
//     의 두 분기 — 값이 `undefined` 면 skip(0 error), `null` 이면 skip 하지 않음.
//   - negative: 빈 값 · 공백만 · 길이 초과 · 배열 아님 · 원소 타입 불일치 · 명시적 null ·
//     type 불일치. **명시적 `null` 은 5 필드 전량에서 거절**(400) 계약이다 — @IsOptional
//     이 null 까지 skip 하던 종전 계약을 T-1818 이 @ValidateIf 로 뒤집었다.
//   - drift guard: 정체성 축(`type` · `instanceKey`, §Decision 5)과 credential 계열
//     (`token` · `password` · `apiKey`, §Decision 2)이 허용 축이 아님을 고정.
import { plainToInstance } from "class-transformer";
import { validateSync } from "class-validator";

import { UpdateCollectionTargetDto } from "./update-collection-target.dto";

// helper — plain 객체를 DTO instance 로 변환한 뒤 위반 constraint 키 목록을 반환.
function violations(payload: unknown): string[] {
  const dto = plainToInstance(UpdateCollectionTargetDto, payload);
  return validateSync(dto).flatMap((e) => Object.keys(e.constraints ?? {}));
}

// helper — controller-scope ValidationPipe 와 동일한 whitelist 옵션으로 검증. 미정의
// 필드가 오면 whitelistValidation 위반이 나오는지 확인하는 데 쓴다.
function strictViolations(payload: unknown): string[] {
  const dto = plainToInstance(UpdateCollectionTargetDto, payload);
  return validateSync(dto, {
    whitelist: true,
    forbidNonWhitelisted: true,
  }).flatMap((e) => Object.keys(e.constraints ?? {}));
}

describe("UpdateCollectionTargetDto", () => {
  // --------------------------------------------------------------------
  // happy
  // --------------------------------------------------------------------
  it("빈 객체 `{}` 는 0 error 다 — merge patch 의 no-field 요청 (happy)", () => {
    expect(violations({})).toEqual([]);
  });

  it("단일 필드만 담은 payload 는 0 error 다 (happy)", () => {
    expect(violations({ active: false })).toEqual([]);
  });

  it("허용 5 필드 전량 payload 도 0 error 다 (happy)", () => {
    expect(
      violations({
        endpoint: "https://wiki.example.com/wiki/rest/api",
        orgs: ["acme"],
        repos: ["acme/api"],
        spaces: ["ENG", "PLAT"],
        active: true,
      }),
    ).toEqual([]);
  });

  // --------------------------------------------------------------------
  // error path — 전달된 필드의 값이 계약을 위반하는 경우
  // --------------------------------------------------------------------
  it("endpoint 를 빈 문자열로 전달하면 isNotEmpty 위반 (error path)", () => {
    const errors = violations({ endpoint: "" });
    expect(errors.length).toBeGreaterThan(0);
    expect(errors).toEqual(expect.arrayContaining(["isNotEmpty"]));
  });

  it("active 를 문자열 'false' 로 전달하면 isBoolean 위반 (error path)", () => {
    const errors = violations({ active: "false" });
    expect(errors.length).toBeGreaterThan(0);
    expect(errors).toEqual(expect.arrayContaining(["isBoolean"]));
  });

  it("한 payload 안의 위반 필드가 각각 error 로 보고된다 (error path — 복수 위반)", () => {
    const properties = validateSync(
      plainToInstance(UpdateCollectionTargetDto, {
        endpoint: "",
        orgs: "acme",
        active: 1,
      }),
    )
      .map((e) => e.property)
      .sort();
    expect(properties).toEqual(["active", "endpoint", "orgs"]);
  });

  // --------------------------------------------------------------------
  // 분기 cover — decorator 별 1+ 케이스
  // --------------------------------------------------------------------
  it("미전달 필드는 나머지 decorator 가 평가되지 않는다 (분기 — @ValidateIf skip)", () => {
    const dto = plainToInstance(UpdateCollectionTargetDto, { active: true });
    expect(validateSync(dto)).toEqual([]);
    // 미전달 축은 undefined 로 남아 repository update 의 "미변경" 대상이 된다.
    expect(dto.endpoint).toBeUndefined();
    expect(dto.orgs).toBeUndefined();
    expect(dto.repos).toBeUndefined();
    expect(dto.spaces).toBeUndefined();
  });

  it("키가 있어도 값이 undefined 면 skip 되어 0 error 다 (분기 — @ValidateIf 참 분기)", () => {
    // merge patch 의 "미전달 = 미변경" 계약은 키 존재 여부가 아니라 값이 undefined 인지로
    // 판정된다. JSON body 에는 undefined 가 없지만 내부 호출 경로에서 명시적 undefined 가
    // 실릴 수 있어 그 축을 고정한다.
    expect(
      violations({
        endpoint: undefined,
        orgs: undefined,
        repos: undefined,
        spaces: undefined,
        active: undefined,
      }),
    ).toEqual([]);
  });

  it("값이 null 이면 skip 되지 않아 후속 decorator 가 평가된다 (분기 — @ValidateIf 거짓 분기)", () => {
    // @IsOptional 이었다면 0 error 였을 payload 다. @ValidateIf 는 undefined 만 skip 하므로
    // null 은 @IsString / @IsArray / @IsBoolean 으로 흘러가 위반이 된다.
    const properties = validateSync(
      plainToInstance(UpdateCollectionTargetDto, {
        endpoint: null,
        orgs: null,
        repos: null,
        spaces: null,
        active: null,
      }),
    )
      .map((e) => e.property)
      .sort();
    expect(properties).toEqual([
      "active",
      "endpoint",
      "orgs",
      "repos",
      "spaces",
    ]);
  });

  it("endpoint 를 전달하면 @IsNotEmpty 가 평가된다 (분기 — @ValidateIf 반대편)", () => {
    expect(violations({ endpoint: "github.com" })).toEqual([]);
    expect(violations({ endpoint: "" })).toEqual(
      expect.arrayContaining(["isNotEmpty"]),
    );
  });

  it("endpoint 정확히 255 자는 통과한다 (분기 — @MaxLength 경계 통과)", () => {
    expect(violations({ endpoint: "a".repeat(255) })).toEqual([]);
  });

  it("endpoint 256 자면 maxLength 위반 (분기 — @MaxLength 경계 초과)", () => {
    expect(violations({ endpoint: "a".repeat(256) })).toEqual(
      expect.arrayContaining(["maxLength"]),
    );
  });

  it("배열 3 축은 빈 배열도 통과한다 (분기 — @IsArray 통과)", () => {
    expect(violations({ orgs: [], repos: [], spaces: [] })).toEqual([]);
  });

  it("배열 원소가 전부 string 이면 통과한다 (분기 — @IsString({ each: true }) 통과)", () => {
    expect(violations({ spaces: ["ENG"] })).toEqual([]);
  });

  it("active 는 boolean 이면 true/false 모두 통과한다 (분기 — @IsBoolean)", () => {
    expect(violations({ active: true })).toEqual([]);
    expect(violations({ active: false })).toEqual([]);
  });

  // --------------------------------------------------------------------
  // negative cases — 예외 상황 분기별 거절 검증(7 종)
  // --------------------------------------------------------------------
  it("① endpoint 가 빈 문자열이면 isNotEmpty 위반 (negative)", () => {
    expect(violations({ endpoint: "" })).toEqual(
      expect.arrayContaining(["isNotEmpty"]),
    );
  });

  it("② endpoint 가 공백만이면 현재 통과한다 (negative — 계약 고정)", () => {
    // class-validator 의 @IsNotEmpty 는 trim 하지 않으므로 공백만인 값은 현재 계약상
    // 통과한다(Create 축 spec 의 instanceKey 공백 케이스와 동형 — ADR-0059 는 endpoint
    // 에 형식 정규식을 두지 않고 길이 상한만 걸었다). 나중에 @Matches 등 trim 계열
    // 검증이 조용히 추가되면 본 test 가 fail 해 계약 변경을 드러낸다.
    expect(violations({ endpoint: "   " })).toEqual([]);
  });

  it("③ endpoint 가 256 자면 maxLength 위반 (negative — 경계값 초과)", () => {
    expect(violations({ endpoint: "a".repeat(256) })).toEqual(
      expect.arrayContaining(["maxLength"]),
    );
  });

  it("④ orgs 가 배열이 아니면 isArray 위반 (negative)", () => {
    expect(violations({ orgs: "acme" })).toEqual(
      expect.arrayContaining(["isArray"]),
    );
  });

  it("⑤ repos 원소가 number 면 isString 위반 (negative — 원소 타입 불일치)", () => {
    expect(violations({ repos: [1, 2] })).toEqual(
      expect.arrayContaining(["isString"]),
    );
  });

  it("⑥ spaces 가 null 이면 isArray 위반이다 (negative — 명시적 null 거절)", () => {
    // T-1818 이 @IsOptional → @ValidateIf 교체로 확정한 계약이다. 종전 @IsOptional 은
    // undefined 와 null 을 **둘 다** skip 해서 명시적 null 이 DTO 를 통과해 repository 로
    // 내려갔고, 그만큼 ADR-0059 §Decision 5 오류 표 e 행(형식 검증 실패 = 400)이 샜다.
    // 이제 null 은 skip 대상이 아니라 @IsArray 위반이며 ValidationPipe 가 400 을 낸다
    // (UpdateServiceIdentityDto 선례와 동일). null 로의 삭제 semantic 은 지원하지 않는다.
    expect(violations({ spaces: null })).toEqual(
      expect.arrayContaining(["isArray"]),
    );
  });

  it("⑥-a endpoint 가 null 이면 isString 위반이다 (negative — 명시적 null 거절)", () => {
    expect(violations({ endpoint: null })).toEqual(
      expect.arrayContaining(["isString"]),
    );
  });

  it("⑥-b orgs 가 null 이면 isArray 위반이다 (negative — 명시적 null 거절)", () => {
    expect(violations({ orgs: null })).toEqual(
      expect.arrayContaining(["isArray"]),
    );
  });

  it("⑥-c repos 가 null 이면 isArray 위반이다 (negative — 명시적 null 거절)", () => {
    expect(violations({ repos: null })).toEqual(
      expect.arrayContaining(["isArray"]),
    );
  });

  it("⑥-d active 가 null 이면 isBoolean 위반이다 (negative — 명시적 null 거절)", () => {
    expect(violations({ active: null })).toEqual(
      expect.arrayContaining(["isBoolean"]),
    );
  });

  it("⑥' spaces 원소가 null 이면 isString 위반 (negative — 원소 타입 불일치)", () => {
    expect(violations({ spaces: ["ENG", null] })).toEqual(
      expect.arrayContaining(["isString"]),
    );
  });

  it("⑦ active 가 문자열 'true' 면 isBoolean 위반 (negative — type 불일치)", () => {
    expect(violations({ active: "true" })).toEqual(
      expect.arrayContaining(["isBoolean"]),
    );
  });

  it("⑦' endpoint 가 number 면 isString 위반 (negative — type 불일치)", () => {
    expect(violations({ endpoint: 1 })).toEqual(
      expect.arrayContaining(["isString"]),
    );
  });

  // --------------------------------------------------------------------
  // 계약 drift guard — 정체성 축(§Decision 5)과 credential 계열(§Decision 2)은
  // 허용 축이 아니다. 누군가 DTO 에 이 필드를 추가하면 whitelistValidation 이 사라져
  // 아래 test 들이 fail 한다.
  // --------------------------------------------------------------------
  it.each(["type", "instanceKey"])(
    "정체성 축 %s 는 whitelist 위반이다 (drift guard — §Decision 5 변경은 DELETE + POST)",
    (field) => {
      const payload = field === "type" ? "GITHUB" : "acme";
      expect(strictViolations({ [field]: payload })).toEqual([
        "whitelistValidation",
      ]);
    },
  );

  it.each(["token", "password", "apiKey"])(
    "credential 계열 필드 %s 는 whitelist 위반이다 (drift guard — §Decision 2)",
    (field) => {
      expect(strictViolations({ [field]: "s3cret" })).toEqual([
        "whitelistValidation",
      ]);
    },
  );

  it("id 를 body 로 보내면 whitelist 위반이다 (drift guard — 서버 생성 축)", () => {
    expect(strictViolations({ id: "ct1" })).toEqual(["whitelistValidation"]);
  });

  it("유효 payload 는 whitelist 모드에서도 0 error 다 (drift guard — false positive 방지)", () => {
    expect(strictViolations({ endpoint: "github.com", active: true })).toEqual(
      [],
    );
    expect(strictViolations({})).toEqual([]);
  });
});
