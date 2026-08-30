// CreateCollectionTargetDto spec — CI scripts/check-spec-presence.sh 가 신규 production
// .ts 에 동반 spec 을 의무화한다. 본 spec 은 class-validator decorator 의 동작을 isolated
// 하게 검증하며, ValidationPipe 통합 검증은 후속 controller slice 의 supertest 가 맡는다.
//
// 검증 축(ADR-0059 §Decision 4 필드 표 7 종 · §Decision 2 credential 경계):
//   - happy: 필수 3 필드 최소 payload / 7 필드 전량 payload 각각 0 error.
//   - error path: 필수 필드(type · instanceKey · endpoint) 누락 케이스별 검증.
//   - 분기: @IsIn · @IsNotEmpty · @MaxLength · @IsOptional · @IsArray ·
//     @IsString({ each: true }) · @IsBoolean 각 decorator 별 1+ 케이스.
//   - negative: 미허용 값 · 소문자 표기 · 길이 초과 · 배열 아님 · 원소 타입 불일치 ·
//     type 불일치 · 빈 입력.
//   - drift guard: credential 계열(token · password · apiKey)과 서버 생성 축(id ·
//     createdAt)이 허용 축이 아님(§Decision 2 회귀 방지).
import { plainToInstance } from "class-transformer";
import { validateSync } from "class-validator";

import { CreateCollectionTargetDto } from "./create-collection-target.dto";

// 필수 3 필드만 담은 최소 유효 payload — 각 케이스가 한 필드만 바꿔 쓰는 baseline.
const MINIMAL = {
  type: "GITHUB",
  instanceKey: "com",
  endpoint: "github.com",
};

// helper — plain 객체를 DTO instance 로 변환한 뒤 위반 constraint 키 목록을 반환.
function violations(payload: unknown): string[] {
  const dto = plainToInstance(CreateCollectionTargetDto, payload);
  return validateSync(dto).flatMap((e) => Object.keys(e.constraints ?? {}));
}

// helper — controller-scope ValidationPipe 와 동일한 whitelist 옵션으로 검증. 미정의
// 필드가 오면 whitelistValidation 위반이 나오는지 확인하는 데 쓴다.
function strictViolations(payload: unknown): string[] {
  const dto = plainToInstance(CreateCollectionTargetDto, payload);
  return validateSync(dto, {
    whitelist: true,
    forbidNonWhitelisted: true,
  }).flatMap((e) => Object.keys(e.constraints ?? {}));
}

describe("CreateCollectionTargetDto", () => {
  // --------------------------------------------------------------------
  // happy
  // --------------------------------------------------------------------
  it("필수 3 필드만 담은 최소 payload 는 0 error 다 (happy)", () => {
    expect(violations(MINIMAL)).toEqual([]);
  });

  it("7 필드 전량 payload 도 0 error 다 (happy)", () => {
    expect(
      violations({
        type: "CONFLUENCE",
        instanceKey: "wiki",
        endpoint: "https://wiki.example.com/wiki/rest/api",
        orgs: [],
        repos: [],
        spaces: ["ENG", "PLAT"],
        active: false,
      }),
    ).toEqual([]);
  });

  // --------------------------------------------------------------------
  // error path — 필수 필드 누락
  // --------------------------------------------------------------------
  it("type 누락 시 error 를 낸다 (error path)", () => {
    const errors = violations({
      instanceKey: "com",
      endpoint: "github.com",
    });
    expect(errors.length).toBeGreaterThan(0);
    expect(errors).toEqual(expect.arrayContaining(["isIn"]));
  });

  it("instanceKey 누락 시 isNotEmpty 위반 (error path)", () => {
    const errors = violations({ type: "GITHUB", endpoint: "github.com" });
    expect(errors.length).toBeGreaterThan(0);
    expect(errors).toEqual(expect.arrayContaining(["isNotEmpty"]));
  });

  it("endpoint 누락 시 isNotEmpty 위반 (error path)", () => {
    const errors = violations({ type: "GITHUB", instanceKey: "com" });
    expect(errors.length).toBeGreaterThan(0);
    expect(errors).toEqual(expect.arrayContaining(["isNotEmpty"]));
  });

  // --------------------------------------------------------------------
  // 분기 cover — decorator 별 1+ 케이스
  // --------------------------------------------------------------------
  it("type 은 허용 값 2 종(GITHUB · CONFLUENCE) 모두 통과한다 (분기 — @IsIn 통과)", () => {
    expect(violations({ ...MINIMAL, type: "GITHUB" })).toEqual([]);
    expect(violations({ ...MINIMAL, type: "CONFLUENCE" })).toEqual([]);
  });

  it("instanceKey 가 빈 문자열이면 isNotEmpty 위반 (분기 — @IsNotEmpty)", () => {
    expect(violations({ ...MINIMAL, instanceKey: "" })).toEqual(
      expect.arrayContaining(["isNotEmpty"]),
    );
  });

  it("endpoint 가 빈 문자열이면 isNotEmpty 위반 (분기 — @IsNotEmpty)", () => {
    expect(violations({ ...MINIMAL, endpoint: "" })).toEqual(
      expect.arrayContaining(["isNotEmpty"]),
    );
  });

  it("instanceKey 정확히 255 자는 통과한다 (분기 — @MaxLength 경계 통과)", () => {
    expect(violations({ ...MINIMAL, instanceKey: "a".repeat(255) })).toEqual(
      [],
    );
  });

  it("instanceKey 256 자면 maxLength 위반 (분기 — @MaxLength 경계 초과)", () => {
    expect(violations({ ...MINIMAL, instanceKey: "a".repeat(256) })).toEqual(
      expect.arrayContaining(["maxLength"]),
    );
  });

  it("endpoint 정확히 255 자는 통과한다 (분기 — @MaxLength 경계 통과)", () => {
    expect(violations({ ...MINIMAL, endpoint: "a".repeat(255) })).toEqual([]);
  });

  it("선택 4 필드(orgs · repos · spaces · active) 미전달은 0 error 다 (분기 — @IsOptional)", () => {
    const dto = plainToInstance(CreateCollectionTargetDto, MINIMAL);
    expect(validateSync(dto)).toEqual([]);
    // 미전달 필드는 undefined 로 남아 DB default(빈 배열 / true) 위임 대상이 된다.
    expect(dto.orgs).toBeUndefined();
    expect(dto.repos).toBeUndefined();
    expect(dto.spaces).toBeUndefined();
    expect(dto.active).toBeUndefined();
  });

  it("orgs 에 빈 배열을 명시해도 통과한다 (분기 — @IsArray 통과)", () => {
    expect(violations({ ...MINIMAL, orgs: [] })).toEqual([]);
  });

  it("spaces 원소가 전부 string 이면 통과한다 (분기 — @IsString({ each: true }) 통과)", () => {
    expect(violations({ ...MINIMAL, spaces: ["ENG"] })).toEqual([]);
  });

  it("active 는 boolean 이면 true/false 모두 통과한다 (분기 — @IsBoolean 통과)", () => {
    expect(violations({ ...MINIMAL, active: true })).toEqual([]);
    expect(violations({ ...MINIMAL, active: false })).toEqual([]);
  });

  // --------------------------------------------------------------------
  // negative cases — 예외 상황 분기별 거절 검증
  // --------------------------------------------------------------------
  it("① type 이 미허용 값(GITLAB)이면 isIn 위반 (negative)", () => {
    expect(violations({ ...MINIMAL, type: "GITLAB" })).toEqual(
      expect.arrayContaining(["isIn"]),
    );
  });

  it("② type 이 소문자(github)면 isIn 위반 — 대소문자 구분 (negative)", () => {
    expect(violations({ ...MINIMAL, type: "github" })).toEqual(
      expect.arrayContaining(["isIn"]),
    );
  });

  it("③ instanceKey 가 공백만이면 현재 통과한다 (negative — 계약 고정)", () => {
    // ADR-0059 §Decision 4 는 instanceKey 값 집합의 정본을 배포 env 로 두어 형식 정규식을
    // 두지 않았고, class-validator 의 @IsNotEmpty 는 trim 하지 않는다. 따라서 공백만인
    // 값은 현재 계약상 통과하며, 그 대상은 수집 시점 credential 조회에서 reject 된다
    // (§Consequences (b)). 나중에 @Matches 등 trim 계열 검증이 조용히 추가되면 본 test 가
    // fail 해 계약 변경을 드러낸다 — CreateServiceIdentityDto spec 의 동형 선례 승계.
    expect(violations({ ...MINIMAL, instanceKey: "   " })).toEqual([]);
  });

  it("④ endpoint 가 256 자면 maxLength 위반 (negative — 경계값 초과)", () => {
    expect(violations({ ...MINIMAL, endpoint: "a".repeat(256) })).toEqual(
      expect.arrayContaining(["maxLength"]),
    );
  });

  it("⑤ orgs 가 배열이 아니면 isArray 위반 (negative)", () => {
    expect(violations({ ...MINIMAL, orgs: "acme" })).toEqual(
      expect.arrayContaining(["isArray"]),
    );
  });

  it("⑥ repos 원소가 number 면 isString 위반 (negative — 원소 타입 불일치)", () => {
    expect(violations({ ...MINIMAL, repos: [1, 2] })).toEqual(
      expect.arrayContaining(["isString"]),
    );
  });

  it("⑥' spaces 원소가 null 이어도 isString 위반 (negative — 원소 타입 불일치)", () => {
    expect(violations({ ...MINIMAL, spaces: ["ENG", null] })).toEqual(
      expect.arrayContaining(["isString"]),
    );
  });

  it("⑦ active 가 문자열 'true' 면 isBoolean 위반 (negative — type 불일치)", () => {
    expect(violations({ ...MINIMAL, active: "true" })).toEqual(
      expect.arrayContaining(["isBoolean"]),
    );
  });

  it("⑦' endpoint 가 null 이면 isString 위반 (negative — type 불일치)", () => {
    expect(violations({ ...MINIMAL, endpoint: null })).toEqual(
      expect.arrayContaining(["isString"]),
    );
  });

  it("type 이 number 면 isString 위반 (negative — type 불일치)", () => {
    expect(violations({ ...MINIMAL, type: 1 })).toEqual(
      expect.arrayContaining(["isString"]),
    );
  });

  it("빈 payload 는 필수 3 필드가 각각 error 를 낸다 (negative — 빈 입력)", () => {
    const dto = plainToInstance(CreateCollectionTargetDto, {});
    const properties = validateSync(dto)
      .map((e) => e.property)
      .sort();
    expect(properties).toEqual(["endpoint", "instanceKey", "type"]);
  });

  // --------------------------------------------------------------------
  // 계약 drift guard — credential 계열과 서버 생성 축은 허용 축이 아니다
  // (ADR-0059 §Decision 2). 누군가 DTO 에 이 필드를 추가하면 whitelistValidation 이
  // 사라져 아래 test 들이 fail 한다.
  // --------------------------------------------------------------------
  it.each(["token", "password", "apiKey"])(
    "credential 계열 필드 %s 는 whitelist 위반이다 (drift guard — §Decision 2)",
    (field) => {
      expect(strictViolations({ ...MINIMAL, [field]: "s3cret" })).toEqual([
        "whitelistValidation",
      ]);
    },
  );

  it("id 를 body 로 보내면 whitelist 위반이다 (drift guard — 서버 생성 축)", () => {
    expect(strictViolations({ ...MINIMAL, id: "ct1" })).toEqual([
      "whitelistValidation",
    ]);
  });

  it("createdAt 을 body 로 보내면 whitelist 위반이다 (drift guard — 서버 생성 축)", () => {
    expect(
      strictViolations({ ...MINIMAL, createdAt: "2026-08-31T00:00:00Z" }),
    ).toEqual(["whitelistValidation"]);
  });

  it("유효 payload 는 whitelist 모드에서도 0 error 다 (drift guard — false positive 방지)", () => {
    expect(strictViolations(MINIMAL)).toEqual([]);
  });
});
