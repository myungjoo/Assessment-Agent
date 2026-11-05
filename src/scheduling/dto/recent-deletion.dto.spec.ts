// RecentDeletionDto spec — R-112 happy / branch / negative. class-validator 의 validate() 로
// days decorator (@IsOptional / @IsInt / @IsPositive) 분기를 직접 검증한다.
// plainToInstance 로 plain JSON 을 DTO instance 로 변환 후 validate (controller
// ValidationPipe 의 transform+검증 동형).
//
// instants 같은 정의 외 키의 거부는 DTO decorator 가 아니라 controller-scope ValidationPipe
// (forbidNonWhitelisted) 책임이므로 controller spec · e2e spec 에서 cover 한다.
import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";

import { RecentDeletionDto } from "./recent-deletion.dto";

// validateDto — plain object → DTO instance 변환 후 validate, error property 목록 반환.
async function validateDto(plain: unknown): Promise<string[]> {
  const dto = plainToInstance(RecentDeletionDto, plain);
  const errors = await validate(dto);
  return errors.map((e) => e.property);
}

describe("RecentDeletionDto", () => {
  // -- happy / 분기 — days 지정 · 미지정 ---------------------------------------
  it("{ days: 7 } 는 검증 통과 (happy — days 지정 branch)", async () => {
    expect(await validateDto({ days: 7 })).toEqual([]);
  });

  it("{} 는 검증 통과 (@IsOptional — days 미지정 branch)", async () => {
    expect(await validateDto({})).toEqual([]);
  });

  it("DTO 에는 instants 속성이 없다 — 대상은 서버가 찾는다", () => {
    const dto = plainToInstance(RecentDeletionDto, { days: 1 });
    expect(Object.keys(dto)).toEqual(["days"]);
  });

  // -- negative — days 분기 -------------------------------------------------
  it("days 가 음수 시 검증 실패 (@IsPositive)_n", async () => {
    expect(await validateDto({ days: -1 })).toContain("days");
  });

  it("days 가 0 시 검증 실패 (@IsPositive 경계값)_n", async () => {
    expect(await validateDto({ days: 0 })).toContain("days");
  });

  it("days 가 비-정수(실수) 시 검증 실패 (@IsInt)_n", async () => {
    expect(await validateDto({ days: 1.5 })).toContain("days");
  });

  it("days 가 문자열이면 검증 실패 (@IsInt)_n", async () => {
    expect(await validateDto({ days: "7" })).toContain("days");
  });
});
