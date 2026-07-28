// import-restore-error.spec — T-1277. R-112 4 종 (happy / error / 분기 / negative 충분 cover) 을
// 순수 helper `toImportRestoreHttpException` 에 적용한다. DB · Prisma · NestJS DI · mock 0 이며
// 반복 단언은 `it.each` 표로 압축한다 (diff 규율 270 LOC). REQ-032 회귀 차단이 negative 축의
// 핵심 — "leak-me" marker 를 원본 error 곳곳에 심고 반환 문구 · 직렬화 결과에 0 임을 본다.
import {
  BadRequestException,
  ConflictException,
  type HttpException,
} from "@nestjs/common";

import { toImportRestoreHttpException } from "./import-restore-error";

const LEAK = "leak-me";
// Prisma known error 를 흉내낸 최소 fixture — 실 인스턴스 없이 duck typing surface 만 맞춘다.
const prismaError = (
  code: string,
  meta?: unknown,
): Record<string, unknown> => ({
  code,
  message: `Invalid value ${LEAK} for column`,
  meta,
});
// meta.target 이 접근자여도 값만 보면 string[] — 컬럼명 분기의 변형 입력.
const ACCESSOR_META = {
  get target(): string[] {
    return ["email"];
  },
};
const hasKorean = (text: string): boolean => /[가-힣]/.test(text);
const map = (error: unknown): HttpException =>
  toImportRestoreHttpException(error) as HttpException;

describe("toImportRestoreHttpException", () => {
  // (a) happy — 매핑 표 3 종의 클래스 · status · 한국어 문구.
  it.each([
    ["P2002", ConflictException, 409],
    ["P2003", BadRequestException, 400],
    ["P2025", ConflictException, 409],
  ] as const)("happy: %s → %p (%i)", (code, ctor, status) => {
    const result = toImportRestoreHttpException(prismaError(code));
    expect(result).toBeDefined();
    expect(result).toBeInstanceOf(ctor);
    expect((result as HttpException).getStatus()).toBe(status);
    expect(hasKorean((result as HttpException).message)).toBe(true);
  });

  it("happy: 세 code 의 안내 문구는 서로 다르다 (문구 복사 0)", () => {
    const messages = ["P2002", "P2003", "P2025"].map(
      (code) => map(prismaError(code)).message,
    );
    expect(new Set(messages).size).toBe(3);
  });

  // (b) error path — 매핑 밖 입력은 throw 0 + undefined (무차별 흡수 금지).
  it.each([
    ["미매핑 code P2028", prismaError("P2028")],
    ["연결 실패 code P1001", prismaError("P1001")],
    ["평범한 Error", new Error("boom")],
    ["null", null],
    ["undefined", undefined],
    ["code 가 숫자인 객체", { code: 42 }],
    ["code 가 없는 객체", { message: "no code" }],
    ["prototype 없는 객체", Object.create(null)],
    ["문자열", "P2002"],
    ["빈 문자열", ""],
    ["숫자", 2002],
    ["배열", ["P2002"]],
  ])("error: %s → throw 0 + undefined", (_label, input) => {
    expect(() => toImportRestoreHttpException(input)).not.toThrow();
    expect(toImportRestoreHttpException(input)).toBeUndefined();
  });

  // (c) 분기 cover — code 추출 성공/실패 × meta.target 형태.
  it("분기: meta.target 이 string[] (접근자 포함) 이면 컬럼명이 문구에 실린다", () => {
    expect(
      map(prismaError("P2002", { target: ["email", "name"] })).message,
    ).toContain("관련 컬럼: email, name");
    expect(map({ code: "P2002", meta: ACCESSOR_META }).message).toContain(
      "관련 컬럼: email",
    );
  });

  it.each([
    ["meta 부재", undefined],
    ["meta 가 null", null],
    ["meta 가 문자열", "target=email"],
    ["target 부재", { cause: "no target" }],
    ["target 이 문자열", { target: "email" }],
    ["target 이 빈 배열", { target: [] }],
    ["target 에 비-문자열 혼입", { target: ["email", 7] }],
  ])("분기: %s → 컬럼명 없는 일반 문구", (_label, meta) => {
    const result = map(prismaError("P2003", meta));
    expect(result).toBeInstanceOf(BadRequestException);
    expect(result.message).not.toContain("관련 컬럼");
    expect(hasKorean(result.message)).toBe(true);
  });

  it("분기: code 추출 실패는 meta 가 온전해도 매핑 이전에 undefined", () => {
    expect(
      toImportRestoreHttpException({ meta: { target: ["email"] } }),
    ).toBeUndefined();
  });

  // (d) negative 충분 cover — REQ-032 누출 · 입력 변형 · 인스턴스 공유 · 위장 code.
  it("negative: target 원소가 값처럼 보여도 원본 message 는 실리지 않는다", () => {
    const result = map(
      prismaError("P2002", { target: [`${LEAK}@example.com`] }),
    );
    expect(result.message).toContain(`${LEAK}@example.com`);
    expect(result.message).not.toContain("Invalid value");
    expect(result.message).not.toContain("for column");
  });

  it.each(["P2002", "P2003", "P2025"])(
    "negative: %s — message / meta.cause / fields marker 가 문구·직렬화에 0",
    (code) => {
      const result = map({
        code,
        message: `unique constraint failed ${LEAK}`,
        stack: `at restore ${LEAK}`,
        meta: { cause: `${LEAK} cause`, fields: [`${LEAK}-field`] },
      });
      const serialized = JSON.stringify({
        message: result.message,
        response: result.getResponse(),
        cause: result.cause,
      });
      expect(result.message).not.toContain(LEAK);
      expect(serialized).not.toContain(LEAK);
      expect(result.cause).toBeUndefined();
    },
  );

  it("negative: 원본 error 를 변형하지 않는다 (frozen 입력 포함)", () => {
    const error = prismaError("P2002", { target: ["email"] });
    const snapshot = structuredClone(error);
    const frozen = Object.freeze({
      code: "P2003",
      meta: Object.freeze({ target: Object.freeze(["personId"]) }),
    });
    toImportRestoreHttpException(error);
    expect(error).toEqual(snapshot);
    expect(() => toImportRestoreHttpException(frozen)).not.toThrow();
    expect(frozen).toEqual({ code: "P2003", meta: { target: ["personId"] } });
  });

  it("negative: 매 호출 새 인스턴스라 서로 영향 0", () => {
    const error = prismaError("P2002", { target: ["email"] });
    const first = map(error);
    const second = map(error);
    expect(first).not.toBe(second);
    expect(first.message).toBe(second.message);
    (first as { message: string }).message = "mutated";
    expect(second.message).not.toBe("mutated");
  });

  it.each([
    ["toString 위장", { code: { toString: (): string => "P2002" } }],
    ["valueOf 위장", { code: { valueOf: (): string => "P2002" } }],
    ["code 가 null", { code: null }],
    ["code 가 배열", { code: ["P2002"] }],
  ])("negative: %s 은 매핑을 우회하지 못한다", (_label, input) => {
    expect(toImportRestoreHttpException(input)).toBeUndefined();
  });

  it("negative: prototype 상속 code 도 문자열일 때만 매핑된다", () => {
    expect(
      toImportRestoreHttpException(Object.create({ code: "P2002" }) as object),
    ).toBeInstanceOf(ConflictException);
    expect(
      toImportRestoreHttpException(Object.create({ code: 42 }) as object),
    ).toBeUndefined();
  });
});
