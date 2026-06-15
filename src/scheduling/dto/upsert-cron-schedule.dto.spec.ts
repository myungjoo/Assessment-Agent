// UpsertCronScheduleDto spec — T-0414 acceptance 박제 (R-112: happy / branch /
// negative 충분 cover). class-validator 의 validate() 로 DTO decorator (@IsString /
// @IsNotEmpty / @MaxLength) 위반 분기를 직접 검증한다. plainToInstance 로 plain JSON 을
// DTO instance 로 변환 후 validate (controller ValidationPipe 의 transform+검증 동형).
//
// forbidNonWhitelisted (정의 외 필드 거부) 는 DTO decorator 가 아니라 controller-scope
// ValidationPipe 책임이므로 본 spec 이 아니라 controller spec 에서 supertest 로 cover.
import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";

import { UpsertCronScheduleDto } from "./upsert-cron-schedule.dto";

// validateDto — plain object → DTO instance 변환 후 validate, error property 목록 반환.
async function validateDto(plain: unknown): Promise<string[]> {
  const dto = plainToInstance(UpsertCronScheduleDto, plain);
  const errors = await validate(dto);
  return errors.map((e) => e.property);
}

describe("UpsertCronScheduleDto", () => {
  // -- happy — 정상 payload 는 검증 통과 (error 0) ---------------------------
  it("정상 payload (name + cronExpression) 는 검증 통과 (happy)", async () => {
    const errors = await validateDto({
      name: "daily-eval",
      cronExpression: "0 0 2 * * *",
    });
    expect(errors).toEqual([]);
  });

  it("5-field cron 식도 형식 기본 검증 통과 (실 형식 검증은 service 책임)", async () => {
    const errors = await validateDto({
      name: "nightly",
      cronExpression: "0 2 * * *",
    });
    expect(errors).toEqual([]);
  });

  // -- negative — name 분기 -------------------------------------------------
  it("name 누락 시 검증 실패 (negative — missing name branch)", async () => {
    const errors = await validateDto({ cronExpression: "0 0 2 * * *" });
    expect(errors).toContain("name");
  });

  it("name 빈 문자열 시 검증 실패 (negative — empty name @IsNotEmpty)", async () => {
    const errors = await validateDto({
      name: "",
      cronExpression: "0 0 2 * * *",
    });
    expect(errors).toContain("name");
  });

  it("name 이 비-string(number) 시 검증 실패 (negative — wrong type @IsString)", async () => {
    const errors = await validateDto({
      name: 12345,
      cronExpression: "0 0 2 * * *",
    });
    expect(errors).toContain("name");
  });

  it("name 이 255 초과 길이 시 검증 실패 (negative — @MaxLength)", async () => {
    const errors = await validateDto({
      name: "a".repeat(256),
      cronExpression: "0 0 2 * * *",
    });
    expect(errors).toContain("name");
  });

  // -- negative — cronExpression 분기 --------------------------------------
  it("cronExpression 누락 시 검증 실패 (negative — missing cronExpression branch)", async () => {
    const errors = await validateDto({ name: "daily" });
    expect(errors).toContain("cronExpression");
  });

  it("cronExpression 빈 문자열 시 검증 실패 (negative — empty @IsNotEmpty)", async () => {
    const errors = await validateDto({ name: "daily", cronExpression: "" });
    expect(errors).toContain("cronExpression");
  });

  it("cronExpression 이 비-string(boolean) 시 검증 실패 (negative — wrong type @IsString)", async () => {
    const errors = await validateDto({
      name: "daily",
      cronExpression: true,
    });
    expect(errors).toContain("cronExpression");
  });

  it("cronExpression 이 255 초과 길이 시 검증 실패 (negative — @MaxLength)", async () => {
    const errors = await validateDto({
      name: "daily",
      cronExpression: "x".repeat(256),
    });
    expect(errors).toContain("cronExpression");
  });

  // -- negative — 두 필드 모두 누락 (복합 분기) ------------------------------
  it("name·cronExpression 둘 다 누락 시 두 property 모두 실패 (negative — 복합)", async () => {
    const errors = await validateDto({});
    expect(errors).toContain("name");
    expect(errors).toContain("cronExpression");
  });
});
