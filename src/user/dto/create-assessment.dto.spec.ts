// CreateAssessmentDto spec — CI scripts/check-spec-presence.sh 가 신규 production .ts 에
// 동반 spec 의무 강제. 본 spec 은 class-validator decorator 의 동작을 isolated 하게
// 검증 — controller 의 ValidationPipe (whitelist + forbidNonWhitelisted + transform)
// 통합 검증은 assessment.controller.spec.ts / e2e 의 supertest 섹션이 cover.
//
// 본 spec 의 책임 (CreatePersonDto spec 패턴 1:1 mirror):
//   - 정상 payload 의 errors 가 빈 배열인지 확인 (happy).
//   - 각 field 의 decorator 위반 시 validate() 결과 errors 가 해당 constraint 를 포함 (R-112 negative).
//   - raw 본문 키 (R-59 / REQ-032) 가 DTO 에 정의되지 않았음을 확인 — plainToInstance 후
//     instance 에 raw 키가 존재하지 않음 (whitelist 부재 검증).
//   - @Type(() => Date) 변환 flow 검증 (decorator metadata 정상 등록 sanity).
import "reflect-metadata";

import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";

import { CreateAssessmentDto } from "./create-assessment.dto";

// 정상 payload — 모든 happy-path 테스트의 base. 개별 negative 테스트는 이 base 에서
// 한 field 만 변형한다.
const validPayload = {
  personId: "person-1",
  period: "week",
  scope: "commit",
  periodStart: "2026-05-01T00:00:00.000Z",
  difficulty: "medium",
  contributionScore: 0.85,
  volume: 12,
  narrative: "주간 기여 평가 정성 텍스트.",
};

// helper — validPayload 에서 한 field 를 제거한 clone 반환 (누락 negative 용).
function withoutField(
  field: keyof typeof validPayload,
): Record<string, unknown> {
  const clone: Record<string, unknown> = { ...validPayload };
  delete clone[field];
  return clone;
}

// helper — plain 객체 → DTO instance 로 변환 후 validate 실행.
async function validatePlain(payload: unknown): Promise<string[]> {
  const dto = plainToInstance(CreateAssessmentDto, payload);
  const errors = await validate(dto);
  // constraint 메시지를 모아 반환 — 어떤 decorator 가 실패했는지 식별 용.
  return errors.flatMap((e) => Object.keys(e.constraints ?? {}));
}

describe("CreateAssessmentDto", () => {
  // ----------------------------------------------------------------------
  // happy: 정상 payload 는 validate 통과 (errors 빈 배열).
  // ----------------------------------------------------------------------
  it("정상 payload 는 errors 빈 배열을 반환한다 (happy)", async () => {
    const errors = await validatePlain(validPayload);
    expect(errors).toEqual([]);
  });

  // ----------------------------------------------------------------------
  // negative #1: personId 누락 → @IsString + @IsNotEmpty 위반.
  // ----------------------------------------------------------------------
  it("personId 누락 시 isNotEmpty / isString 위반 (negative)", async () => {
    const errors = await validatePlain(withoutField("personId"));
    expect(errors.length).toBeGreaterThan(0);
    expect(errors).toEqual(expect.arrayContaining(["isNotEmpty"]));
  });

  // ----------------------------------------------------------------------
  // negative #2: period 누락 → @IsNotEmpty 위반.
  // ----------------------------------------------------------------------
  it("period 누락 시 isNotEmpty 위반 (negative)", async () => {
    const errors = await validatePlain(withoutField("period"));
    expect(errors).toEqual(expect.arrayContaining(["isNotEmpty"]));
  });

  // ----------------------------------------------------------------------
  // negative #3: scope 가 number → @IsString 위반.
  // ----------------------------------------------------------------------
  it("scope 가 number 시 isString 위반 (negative)", async () => {
    const errors = await validatePlain({ ...validPayload, scope: 123 });
    expect(errors).toEqual(expect.arrayContaining(["isString"]));
  });

  // ----------------------------------------------------------------------
  // negative #4: periodStart 가 잘못된 date string → @IsDate 위반.
  // @Type(() => Date) 변환 후 Invalid Date 이므로 isDate 실패.
  // ----------------------------------------------------------------------
  it("periodStart 가 잘못된 date 시 isDate 위반 (negative)", async () => {
    const errors = await validatePlain({
      ...validPayload,
      periodStart: "not-a-date",
    });
    expect(errors).toEqual(expect.arrayContaining(["isDate"]));
  });

  // ----------------------------------------------------------------------
  // negative #5: difficulty 가 빈 문자열 → @IsNotEmpty 위반 (branch).
  // ----------------------------------------------------------------------
  it("difficulty 가 빈 문자열 시 isNotEmpty 위반 (negative/branch)", async () => {
    const errors = await validatePlain({ ...validPayload, difficulty: "" });
    expect(errors).toEqual(expect.arrayContaining(["isNotEmpty"]));
  });

  // ----------------------------------------------------------------------
  // negative #6: contributionScore 가 string → @IsNumber 위반.
  // ----------------------------------------------------------------------
  it("contributionScore 가 string 시 isNumber 위반 (negative)", async () => {
    const errors = await validatePlain({
      ...validPayload,
      contributionScore: "high",
    });
    expect(errors).toEqual(expect.arrayContaining(["isNumber"]));
  });

  // ----------------------------------------------------------------------
  // negative #7: volume 이 음수 → @Min(0) 위반.
  // ----------------------------------------------------------------------
  it("volume 이 음수 시 min 위반 (negative)", async () => {
    const errors = await validatePlain({ ...validPayload, volume: -1 });
    expect(errors).toEqual(expect.arrayContaining(["min"]));
  });

  // ----------------------------------------------------------------------
  // negative #8: volume 이 소수 → @IsInt 위반 (branch).
  // ----------------------------------------------------------------------
  it("volume 이 소수 시 isInt 위반 (negative/branch)", async () => {
    const errors = await validatePlain({ ...validPayload, volume: 1.5 });
    expect(errors).toEqual(expect.arrayContaining(["isInt"]));
  });

  // ----------------------------------------------------------------------
  // negative #9: narrative 누락 → @IsNotEmpty 위반.
  // ----------------------------------------------------------------------
  it("narrative 누락 시 isNotEmpty 위반 (negative)", async () => {
    const errors = await validatePlain(withoutField("narrative"));
    expect(errors).toEqual(expect.arrayContaining(["isNotEmpty"]));
  });

  // ----------------------------------------------------------------------
  // R-59 / REQ-032: raw 본문 키 (rawBody / content / diff 등) 는 DTO 에 정의되지
  // 않는다. plainToInstance 가 본 class 의 정의된 8 field 만 instance 로 옮기지 않고
  // raw 키도 복사하지만, DTO 자체에는 raw 프로퍼티가 선언되지 않았음을 확인한다.
  // (whitelist + forbidNonWhitelisted 의 400 reject 실 동작은 controller/e2e 가 cover.)
  // ----------------------------------------------------------------------
  it("DTO 에 raw 본문 키 (rawBody/content/diff) 가 정의되지 않는다 (R-59)", () => {
    const dto = plainToInstance(CreateAssessmentDto, validPayload);
    // 정의된 키만 prototype/선언에 존재 — raw 키는 DTO contract 일부가 아님.
    const declaredKeys = [
      "personId",
      "period",
      "scope",
      "periodStart",
      "difficulty",
      "contributionScore",
      "volume",
      "narrative",
    ];
    expect(Object.keys(dto).sort()).toEqual([...declaredKeys].sort());
    expect(dto).not.toHaveProperty("rawBody");
    expect(dto).not.toHaveProperty("content");
    expect(dto).not.toHaveProperty("diff");
  });
});
