// realdata-devset-logins.spec.ts — T-1648 colocated unit spec.
//
// R-112 cover 구조:
//   - happy-path: `loadRealdataDevsetLogins()` 가 a 33 · b 100 · all 133 을 중복 0 으로
//     반환, `resolveRealdataDevsetLogins()` 기본 호출이 133 개 반환.
//   - error path: `parseDevsetLogins` 의 위반 사유별(null · 배열 · 키 누락 · a 길이 32 ·
//     b 길이 99 · A/B 중복 · login 형식) 1+ test 로 Error throw 확인.
//   - flow/branch: `resolveRealdataDevsetLogins` 의 기본값 / 명시 count / 범위 위반 3 분기와
//     `parseDevsetLogins` 의 검증 분기마다 1+ test.
//   - negative 충분 cover: count = 0 · 134 · 1.5 · NaN · -1 각 1+ test 로 RangeError.
import {
  loadRealdataDevsetLogins,
  parseDevsetLogins,
  resolveRealdataDevsetLogins,
} from "./realdata-devset-logins";

// 검증을 통과하는 정본 fixture 를 매번 새 객체로 복제해 test 간 간섭을 막는다.
function validRaw(): { a: string[]; b: string[] } {
  const loaded = loadRealdataDevsetLogins();
  return { a: [...loaded.a], b: [...loaded.b] };
}

describe("loadRealdataDevsetLogins — happy path", () => {
  it("a 33 · b 100 · all 133 을 반환한다", () => {
    const loaded = loadRealdataDevsetLogins();
    expect(loaded.a).toHaveLength(33);
    expect(loaded.b).toHaveLength(100);
    expect(loaded.all).toHaveLength(133);
  });

  it("all 안에 중복 login 이 0 이고 a + b 순서를 그대로 잇는다", () => {
    const loaded = loadRealdataDevsetLogins();
    expect(new Set(loaded.all).size).toBe(133);
    expect(loaded.all.slice(0, 33)).toEqual(loaded.a);
    expect(loaded.all.slice(33)).toEqual(loaded.b);
  });

  it("두 번 호출해도 값이 같고(결정론) 배열 참조는 분리된다(무공유)", () => {
    const first = loadRealdataDevsetLogins();
    const second = loadRealdataDevsetLogins();
    expect(first).toEqual(second);
    expect(first.a).not.toBe(second.a);
    first.all.push("mutated-login");
    expect(loadRealdataDevsetLogins().all).toHaveLength(133);
  });
});

describe("parseDevsetLogins — error path / 검증 분기", () => {
  it("null 입력이면 Error", () => {
    expect(() => parseDevsetLogins(null)).toThrow(/최상위가 객체가 아니다/);
  });

  it("배열 입력이면 Error", () => {
    expect(() => parseDevsetLogins([])).toThrow(/최상위가 객체가 아니다/);
  });

  it("문자열 등 비-객체 입력이면 Error", () => {
    expect(() => parseDevsetLogins("nope")).toThrow(Error);
    expect(() => parseDevsetLogins(undefined)).toThrow(Error);
  });

  it("'a' 키가 누락되면 Error", () => {
    const raw = validRaw() as Record<string, unknown>;
    delete raw.a;
    expect(() => parseDevsetLogins(raw)).toThrow(/'a' 키가 배열이 아니다/);
  });

  it("'b' 키가 배열이 아니면 Error", () => {
    const raw = { ...validRaw(), b: "not-an-array" };
    expect(() => parseDevsetLogins(raw)).toThrow(/'b' 키가 배열이 아니다/);
  });

  it("'a' 길이가 32 면 Error", () => {
    const raw = validRaw();
    raw.a.pop();
    expect(() => parseDevsetLogins(raw)).toThrow(/'a' 는 33 개여야/);
  });

  it("'b' 길이가 99 면 Error", () => {
    const raw = validRaw();
    raw.b.pop();
    expect(() => parseDevsetLogins(raw)).toThrow(/'b' 는 100 개여야/);
  });

  it("A/B 교집합이 1 건이라도 있으면 Error", () => {
    const raw = validRaw();
    raw.b[0] = raw.a[0];
    expect(() => parseDevsetLogins(raw)).toThrow(/login 중복/);
  });

  it("같은 그룹 안의 중복도 Error", () => {
    const raw = validRaw();
    raw.a[1] = raw.a[0];
    expect(() => parseDevsetLogins(raw)).toThrow(/login 중복/);
  });

  it("login 형식 위반 1 건이면 Error", () => {
    const raw = validRaw();
    raw.a[0] = "-bad_login!";
    expect(() => parseDevsetLogins(raw)).toThrow(/github login 형식 위반/);
  });

  it("39 자 초과 login 도 형식 위반 Error", () => {
    const raw = validRaw();
    raw.b[0] = "a".repeat(40);
    expect(() => parseDevsetLogins(raw)).toThrow(/github login 형식 위반/);
  });

  it("빈 문자열 · 비-문자열 원소도 형식 위반 Error", () => {
    const empty = validRaw();
    empty.a[2] = "";
    expect(() => parseDevsetLogins(empty)).toThrow(/github login 형식 위반/);
    const nonString = validRaw() as { a: unknown[]; b: string[] };
    nonString.a[3] = 42;
    expect(() => parseDevsetLogins(nonString)).toThrow(
      /github login 형식 위반/,
    );
  });

  it("유효 입력은 통과하고 입력 배열을 mutate 하지 않는다", () => {
    const raw = validRaw();
    const snapshot = { a: [...raw.a], b: [...raw.b] };
    const parsed = parseDevsetLogins(raw);
    expect(parsed.all).toHaveLength(133);
    expect(raw).toEqual(snapshot);
    expect(parsed.a).not.toBe(raw.a);
  });
});

describe("resolveRealdataDevsetLogins — 분기 / negative", () => {
  it("기본값 분기: 인자 없이 호출하면 133 개", () => {
    expect(resolveRealdataDevsetLogins()).toHaveLength(133);
  });

  it("명시 count 분기: 앞에서부터 count 개를 자른다", () => {
    const all = loadRealdataDevsetLogins().all;
    expect(resolveRealdataDevsetLogins(10)).toEqual(all.slice(0, 10));
    expect(resolveRealdataDevsetLogins(1)).toEqual([all[0]]);
    expect(resolveRealdataDevsetLogins(133)).toEqual(all);
  });

  it("범위 위반 분기: count = 0 이면 RangeError", () => {
    expect(() => resolveRealdataDevsetLogins(0)).toThrow(RangeError);
  });

  it("count = 134 면 RangeError", () => {
    expect(() => resolveRealdataDevsetLogins(134)).toThrow(RangeError);
  });

  it("count = 1.5 면 RangeError", () => {
    expect(() => resolveRealdataDevsetLogins(1.5)).toThrow(RangeError);
  });

  it("count = NaN 이면 RangeError", () => {
    expect(() => resolveRealdataDevsetLogins(NaN)).toThrow(RangeError);
  });

  it("count = -1 이면 RangeError", () => {
    expect(() => resolveRealdataDevsetLogins(-1)).toThrow(/1~133 정수여야/);
  });

  it("count = Infinity 면 RangeError", () => {
    expect(() => resolveRealdataDevsetLogins(Infinity)).toThrow(RangeError);
  });
});
