// CreateGroupDto spec — CI scripts/check-spec-presence.sh 가 신규 production .ts 에
// 동반 spec 의무 강제 (T-0055 round 1 누락으로 CI red → round 2 amendment 로 추가).
// 본 spec 은 class-validator decorator 의 동작을 isolated 하게 검증 — controller 의
// ValidationPipe 통합 검증은 group.controller.spec.ts 의 integration 섹션이 cover.
//
// 본 spec 의 책임:
//   - decorator 위반 시 validate() 결과의 errors 가 비어있지 않음 확인 (R-112 negative).
//   - 정상 payload 의 errors 가 빈 배열인지 확인 (happy).
//   - plainToInstance + validate 의 flow 검증 (decorator metadata 가 정상 등록됨의 sanity).
//
// CreatePartDto.spec 와 1:1 mirror — 두 DTO 가 같은 shape / 같은 decorator 이므로
// 같은 4 negative + 1 happy 패턴 적용 (R-112 충족).
import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";

import { CreateGroupDto } from "./create-group.dto";

// helper — plain 객체 → DTO instance 로 변환 후 validate 실행.
async function validatePlain(payload: unknown): Promise<string[]> {
  const dto = plainToInstance(CreateGroupDto, payload);
  const errors = await validate(dto);
  // constraint 메시지를 모아 반환 — 어떤 decorator 가 실패했는지 식별 용.
  return errors.flatMap((e) => Object.keys(e.constraints ?? {}));
}

describe("CreateGroupDto", () => {
  // ----------------------------------------------------------------------
  // happy: 정상 payload 는 validate 통과 (errors 빈 배열).
  // ----------------------------------------------------------------------
  it("정상 payload 는 errors 빈 배열을 반환한다 (happy)", async () => {
    const errors = await validatePlain({ name: "개발팀" });
    expect(errors).toEqual([]);
  });

  // ----------------------------------------------------------------------
  // negative #1: name 누락 → @IsString + @IsNotEmpty 위반.
  // ----------------------------------------------------------------------
  it("name 누락 시 isNotEmpty / isString 위반 (negative)", async () => {
    const errors = await validatePlain({});
    expect(errors.length).toBeGreaterThan(0);
    expect(errors).toEqual(expect.arrayContaining(["isNotEmpty"]));
  });

  // ----------------------------------------------------------------------
  // negative #2: name 이 빈 문자열 → @IsNotEmpty 위반 (branch — 키는 있으나 값이 empty).
  // ----------------------------------------------------------------------
  it("name 이 빈 문자열 시 isNotEmpty 위반 (branch)", async () => {
    const errors = await validatePlain({ name: "" });
    expect(errors).toEqual(expect.arrayContaining(["isNotEmpty"]));
  });

  // ----------------------------------------------------------------------
  // negative #3: name 이 number → @IsString 위반.
  // ----------------------------------------------------------------------
  it("name 이 number 시 isString 위반 (negative)", async () => {
    const errors = await validatePlain({ name: 12345 });
    expect(errors).toEqual(expect.arrayContaining(["isString"]));
  });

  // ----------------------------------------------------------------------
  // negative #4: name 이 null → @IsString 위반.
  // ----------------------------------------------------------------------
  it("name 이 null 시 isString 위반 (negative)", async () => {
    const errors = await validatePlain({ name: null });
    expect(errors.length).toBeGreaterThan(0);
    expect(errors).toEqual(expect.arrayContaining(["isString"]));
  });
});
