// RecentDeletionDto spec — T-0428 acceptance 박제 (R-112: happy / branch / negative
// 충분 cover). class-validator 의 validate() 로 DTO decorator (@IsArray / @IsISO8601 /
// @ArrayMaxSize / @IsOptional / @IsInt / @IsPositive) 위반 분기를 직접 검증한다.
// plainToInstance 로 plain JSON 을 DTO instance 로 변환 후 validate (controller
// ValidationPipe 의 transform+검증 동형). UpsertCronScheduleDto spec(T-0414) 패턴 mirror.
//
// forbidNonWhitelisted (정의 외 필드 거부) 는 DTO decorator 가 아니라 controller-scope
// ValidationPipe 책임이므로 본 spec 이 아니라 controller spec 에서 supertest 로 cover.
import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";

import { RecentDeletionDto } from "./recent-deletion.dto";

// validateDto — plain object → DTO instance 변환 후 validate, error property 목록 반환.
async function validateDto(plain: unknown): Promise<string[]> {
  const dto = plainToInstance(RecentDeletionDto, plain);
  const errors = await validate(dto);
  return errors.map((e) => e.property);
}

const VALID_ISO = "2026-06-16T00:00:00.000Z";
const VALID_ISO_2 = "2026-06-15T12:30:00.000Z";

describe("RecentDeletionDto", () => {
  // -- happy — 정상 payload 는 검증 통과 (error 0) ---------------------------
  it("정상 payload (instants ISO 배열 + days) 는 검증 통과 (happy)", async () => {
    const errors = await validateDto({
      instants: [VALID_ISO, VALID_ISO_2],
      days: 7,
    });
    expect(errors).toEqual([]);
  });

  it("days 생략 시에도 검증 통과 (@IsOptional — days 미지정 branch)", async () => {
    const errors = await validateDto({ instants: [VALID_ISO] });
    expect(errors).toEqual([]);
  });

  it("빈 instants 배열도 검증 통과 (도메인 — runner no-op 정상 경로, @ArrayNotEmpty 없음)", async () => {
    const errors = await validateDto({ instants: [] });
    expect(errors).toEqual([]);
  });

  // -- negative — instants 분기 ---------------------------------------------
  it("instants 누락 시 검증 실패 (negative — missing instants branch)", async () => {
    const errors = await validateDto({ days: 7 });
    expect(errors).toContain("instants");
  });

  it("instants 가 비-배열(string) 시 검증 실패 (negative — @IsArray)", async () => {
    const errors = await validateDto({ instants: VALID_ISO });
    expect(errors).toContain("instants");
  });

  it("instants 원소에 비-ISO 문자열 포함 시 검증 실패 (negative — @IsISO8601 each)", async () => {
    const errors = await validateDto({
      instants: [VALID_ISO, "not-a-date"],
    });
    expect(errors).toContain("instants");
  });

  it("instants 배열이 상한(1000) 초과 시 검증 실패 (negative — @ArrayMaxSize)", async () => {
    const errors = await validateDto({
      instants: Array.from({ length: 1001 }, () => VALID_ISO),
    });
    expect(errors).toContain("instants");
  });

  // -- negative — days 분기 -------------------------------------------------
  it("days 가 음수 시 검증 실패 (negative — @IsPositive)", async () => {
    const errors = await validateDto({ instants: [VALID_ISO], days: -1 });
    expect(errors).toContain("days");
  });

  it("days 가 0 시 검증 실패 (negative — @IsPositive 경계값)", async () => {
    const errors = await validateDto({ instants: [VALID_ISO], days: 0 });
    expect(errors).toContain("days");
  });

  it("days 가 비-정수(실수) 시 검증 실패 (negative — @IsInt)", async () => {
    const errors = await validateDto({ instants: [VALID_ISO], days: 1.5 });
    expect(errors).toContain("days");
  });

  // -- negative — 복합 (instants 누락 + days 음수) ---------------------------
  it("instants 누락 + days 음수 시 두 property 모두 실패 (negative — 복합)", async () => {
    const errors = await validateDto({ days: -3 });
    expect(errors).toContain("instants");
    expect(errors).toContain("days");
  });
});
