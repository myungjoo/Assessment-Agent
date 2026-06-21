// build-resolve-person-fn.spec — T-0561. 순수 factory `buildResolvePersonFn` 의 R-112
// cover: happy path / error path / branch coverage / negative cases 충분 cover / 비변형 /
// regression(hqOrigin Q-0045). 신규 파일은 분기 단순하므로 100% coverage 목표. `lookup` 은
// jest mock(`jest.fn().mockResolvedValue(...)` / `.mockResolvedValue(null)` /
// `.mockRejectedValue(...)`), `person row` 는 plain 객체 stub(실 PersonRepository/Prisma/
// DB 0).

import type { PersonWithIdentities } from "../../user/person.repository";

import {
  buildResolvePersonFn,
  type PersonLookupFn,
} from "./build-resolve-person-fn";
import { PeriodBridgeDto } from "./period-bridge.dto";

/** 좌표 4 축 + 선택 reevaluate 를 갖는 PeriodBridgeDto plain 객체 조립 helper. */
function makeBridge(overrides: Partial<PeriodBridgeDto> = {}): PeriodBridgeDto {
  const dto = new PeriodBridgeDto();
  dto.personId = overrides.personId ?? "person-1";
  dto.period = overrides.period ?? "week";
  dto.scope = overrides.scope ?? "commit";
  dto.periodStart = overrides.periodStart ?? "2026-06-10T00:00:00+09:00";
  if (overrides.reevaluate !== undefined) {
    dto.reevaluate = overrides.reevaluate;
  }
  return dto;
}

/**
 * person row stub(`PersonWithIdentities` shape) — serviceIdentities + 그 외 전체 Person
 * 필드(id/fullName/email 등)를 함께 보유한다(narrow 가 serviceIdentities 외 필드를
 * 누설하지 않음을 검증하기 위해 의도적으로 PII 필드 포함).
 */
function makePersonRow(
  serviceIdentities: { service: string; externalId: string }[] = [
    { service: "github", externalId: "gh-octocat" },
  ],
): PersonWithIdentities {
  return {
    id: "person-1",
    fullName: "홍길동",
    email: "gildong@example.com",
    active: true,
    createdAt: new Date("2026-01-01T00:00:00Z"),
    updatedAt: new Date("2026-01-01T00:00:00Z"),
    serviceIdentities: serviceIdentities.map((si, i) => ({
      id: `si-${i}`,
      personId: "person-1",
      service: si.service,
      externalId: si.externalId,
      createdAt: new Date("2026-01-01T00:00:00Z"),
      updatedAt: new Date("2026-01-01T00:00:00Z"),
    })),
  } as unknown as PersonWithIdentities;
}

/** jest mock lookup — 기본 row resolve, 호출별로 .mockResolvedValue/.mockRejectedValue 재설정. */
function makeLookupMock(
  row: PersonWithIdentities | null = makePersonRow(),
): jest.MockedFunction<PersonLookupFn> {
  return jest
    .fn<ReturnType<PersonLookupFn>, Parameters<PersonLookupFn>>()
    .mockResolvedValue(row) as jest.MockedFunction<PersonLookupFn>;
}

describe("buildResolvePersonFn", () => {
  describe("happy path — 유효 lookup callable + person row", () => {
    it("(a) 반환값은 함수(resolver) 이다", () => {
      const resolver = buildResolvePersonFn(makeLookupMock());
      expect(typeof resolver).toBe("function");
    });

    it("(a) lookup 이 serviceIdentities 를 포함한 row 를 반환하면 resolver 가 그 serviceIdentities 를 echo 한 { serviceIdentities } 를 반환한다", async () => {
      const row = makePersonRow([
        { service: "github", externalId: "gh-octocat" },
        { service: "confluence", externalId: "conf-123" },
      ]);
      const resolver = buildResolvePersonFn(makeLookupMock(row));

      const result = await resolver(makeBridge());

      expect(result).toEqual({
        serviceIdentities: row.serviceIdentities,
      });
    });

    it("(b) resolver 는 bridge.personId 를 정확히 lookup 인자로 1 회 전달한다", async () => {
      const lookup = makeLookupMock();
      const resolver = buildResolvePersonFn(lookup);

      await resolver(makeBridge({ personId: "person-42" }));

      expect(lookup).toHaveBeenCalledTimes(1);
      expect(lookup).toHaveBeenCalledWith("person-42");
    });

    it("(c) factory 호출은 lookup 을 즉시 호출하지 않는다(lazy — factory 직후 호출 0)", () => {
      const lookup = makeLookupMock();
      buildResolvePersonFn(lookup);
      // resolver 를 await 하지 않았으므로 lookup 미호출.
      expect(lookup).not.toHaveBeenCalled();
    });

    it("동기 반환 lookup(Promise 아님)도 await 로 수렴해 narrow 한다", async () => {
      const row = makePersonRow();
      // Promise 가 아닌 동기 반환 callable.
      const lookup = jest.fn(
        () => row,
      ) as unknown as jest.MockedFunction<PersonLookupFn>;
      const resolver = buildResolvePersonFn(lookup);

      const result = await resolver(makeBridge());

      expect(result).toEqual({ serviceIdentities: row.serviceIdentities });
    });
  });

  describe("error path — fail-fast 한국어 TypeError / person 부재 Error", () => {
    it("lookup 이 null 이면 factory 가 한국어 TypeError 를 fail-fast 한다", () => {
      expect(() =>
        buildResolvePersonFn(null as unknown as PersonLookupFn),
      ).toThrow(TypeError);
      expect(() =>
        buildResolvePersonFn(null as unknown as PersonLookupFn),
      ).toThrow("lookup 은 함수여야 한다");
    });

    it("lookup 이 undefined 이면 factory 가 한국어 TypeError 를 fail-fast 한다", () => {
      expect(() =>
        buildResolvePersonFn(undefined as unknown as PersonLookupFn),
      ).toThrow("lookup 은 함수여야 한다");
    });

    it("lookup 이 숫자(비-function) 이면 factory 가 한국어 TypeError 를 fail-fast 한다", () => {
      expect(() =>
        buildResolvePersonFn(42 as unknown as PersonLookupFn),
      ).toThrow("lookup 은 함수여야 한다");
    });

    it("lookup 이 문자열(비-function) 이면 factory 가 한국어 TypeError 를 fail-fast 한다", () => {
      expect(() =>
        buildResolvePersonFn("not-a-fn" as unknown as PersonLookupFn),
      ).toThrow("lookup 은 함수여야 한다");
    });

    it("lookup 이 null 을 반환하면(person 부재) resolver 가 personId 를 포함한 한국어 Error 를 던진다", async () => {
      const resolver = buildResolvePersonFn(makeLookupMock(null));

      await expect(
        resolver(makeBridge({ personId: "ghost-1" })),
      ).rejects.toThrow(Error);
      await expect(
        resolver(makeBridge({ personId: "ghost-1" })),
      ).rejects.toThrow("ghost-1");
      await expect(
        resolver(makeBridge({ personId: "ghost-1" })),
      ).rejects.toThrow("찾을 수 없다");
    });

    it("lookup 이 undefined 를 반환하면(person 부재) resolver 가 한국어 Error 를 던진다", async () => {
      const lookup = jest
        .fn<ReturnType<PersonLookupFn>, Parameters<PersonLookupFn>>()
        .mockResolvedValue(
          undefined as unknown as PersonWithIdentities,
        ) as jest.MockedFunction<PersonLookupFn>;
      const resolver = buildResolvePersonFn(lookup);

      await expect(
        resolver(makeBridge({ personId: "ghost-2" })),
      ).rejects.toThrow("찾을 수 없다");
    });

    it("resolver 호출 시 bridge 가 null 이면 한국어 TypeError 를 던진다(bridge.personId 접근 전)", async () => {
      const lookup = makeLookupMock();
      const resolver = buildResolvePersonFn(lookup);

      await expect(
        resolver(null as unknown as PeriodBridgeDto),
      ).rejects.toThrow(TypeError);
      await expect(
        resolver(null as unknown as PeriodBridgeDto),
      ).rejects.toThrow("null/undefined 일 수 없다");
      // 좌표 방어에서 차단됐으므로 lookup 은 호출되지 않는다.
      expect(lookup).not.toHaveBeenCalled();
    });

    it("resolver 호출 시 bridge 가 undefined 이면 한국어 TypeError 를 던진다", async () => {
      const resolver = buildResolvePersonFn(makeLookupMock());

      await expect(
        resolver(undefined as unknown as PeriodBridgeDto),
      ).rejects.toThrow("null/undefined 일 수 없다");
    });

    it("lookup 자체가 reject 하면 그 reject 가 resolver 밖으로 전파된다(driver 가 흡수 — 재포장 0)", async () => {
      const lookup = jest
        .fn<ReturnType<PersonLookupFn>, Parameters<PersonLookupFn>>()
        .mockRejectedValue(
          new Error("DB 연결 실패"),
        ) as jest.MockedFunction<PersonLookupFn>;
      const resolver = buildResolvePersonFn(lookup);

      await expect(resolver(makeBridge())).rejects.toThrow("DB 연결 실패");
    });
  });

  describe("flow / branch coverage", () => {
    it("(a) factory 방어 통과 분기 — 정상 resolver 반환", () => {
      const resolver = buildResolvePersonFn(makeLookupMock());
      expect(typeof resolver).toBe("function");
    });

    it("(b) factory lookup 비-function 거부 분기", () => {
      expect(() =>
        buildResolvePersonFn({} as unknown as PersonLookupFn),
      ).toThrow(TypeError);
    });

    it("(c) resolver bridge null 거부 분기", async () => {
      const resolver = buildResolvePersonFn(makeLookupMock());
      await expect(
        resolver(null as unknown as PeriodBridgeDto),
      ).rejects.toThrow(TypeError);
    });

    it("(d) resolver null-row → person 부재 Error 분기", async () => {
      const resolver = buildResolvePersonFn(makeLookupMock(null));
      await expect(resolver(makeBridge())).rejects.toThrow(Error);
    });

    it("(e) resolver row 있음 → narrow 반환 분기", async () => {
      const row = makePersonRow();
      const resolver = buildResolvePersonFn(makeLookupMock(row));
      const result = await resolver(makeBridge());
      expect(result.serviceIdentities).toBe(row.serviceIdentities);
    });
  });

  describe("negative cases 충분 cover — 빈 식별자 / 비변형 / 별개 객체 / reject 전파", () => {
    it("serviceIdentities 가 빈 배열인 row 도 narrow 성공(빈 배열 echo — resolver 거부 사유 아님)", async () => {
      const row = makePersonRow([]);
      const resolver = buildResolvePersonFn(makeLookupMock(row));

      const result = await resolver(makeBridge());

      expect(result.serviceIdentities).toEqual([]);
      expect(result.serviceIdentities).toBe(row.serviceIdentities);
    });

    it("resolver 호출 후 입력 bridge 객체를 mutate 하지 않는다(모든 필드 그대로)", async () => {
      const bridge = makeBridge({
        personId: "p-keep",
        period: "week",
        scope: "commit",
        periodStart: "2026-06-10T00:00:00+09:00",
        reevaluate: true,
      });
      const snapshot = { ...bridge };
      const resolver = buildResolvePersonFn(makeLookupMock());

      await resolver(bridge);

      expect(bridge.personId).toBe(snapshot.personId);
      expect(bridge.period).toBe(snapshot.period);
      expect(bridge.scope).toBe(snapshot.scope);
      expect(bridge.periodStart).toBe(snapshot.periodStart);
      expect(bridge.reevaluate).toBe(snapshot.reevaluate);
    });

    it("resolver 호출 후 lookup 이 돌려준 row 의 serviceIdentities 배열 참조/길이가 unchanged 다(비변형)", async () => {
      const row = makePersonRow([
        { service: "github", externalId: "gh-1" },
        { service: "confluence", externalId: "conf-1" },
      ]);
      const sameRef = row.serviceIdentities;
      const beforeLen = row.serviceIdentities.length;
      const resolver = buildResolvePersonFn(makeLookupMock(row));

      await resolver(makeBridge());

      expect(row.serviceIdentities).toBe(sameRef);
      expect(row.serviceIdentities.length).toBe(beforeLen);
    });

    it("반환 PeriodBridgePersonInput 은 row 와 별개 객체다(narrow 객체 신규 생성)", async () => {
      const row = makePersonRow();
      const resolver = buildResolvePersonFn(makeLookupMock(row));

      const result = await resolver(makeBridge());

      // 새 객체 — row 자체가 그대로 반환되지 않는다(과잉 노출 차단).
      expect(result).not.toBe(row as unknown as object);
    });

    it("같은 resolver 를 두 번 await 하면 lookup 이 2 회 호출된다(resolver 재사용 가능 — 캐시 0)", async () => {
      const lookup = makeLookupMock();
      const resolver = buildResolvePersonFn(lookup);
      await resolver(makeBridge());
      await resolver(makeBridge());
      expect(lookup).toHaveBeenCalledTimes(2);
    });
  });

  describe("regression (hqOrigin Q-0045) — 흡수 계약 호환 + 과잉 노출 회귀 방지", () => {
    it("person 부재(null-row) 시 throw 하는 값은 Error 인스턴스이고 message 에 personId 가 담겨 driver reason 으로 직렬화 가능하다", async () => {
      const resolver = buildResolvePersonFn(makeLookupMock(null));

      // T-0560 driver 의 흡수: reason = error instanceof Error ? error.message :
      // String(error). 이 계약이 깨지면(Error 가 아니거나 personId 누락) 아래 단언 fail.
      let caught: unknown;
      try {
        await resolver(makeBridge({ personId: "absent-77" }));
      } catch (e) {
        caught = e;
      }

      expect(caught).toBeInstanceOf(Error);
      const reason = caught instanceof Error ? caught.message : String(caught);
      expect(reason).toContain("absent-77");
    });

    it("narrow 는 serviceIdentities 외 필드(id/fullName/email)를 누설하지 않는다(PeriodBridgePersonInput 계약 무결성)", async () => {
      const row = makePersonRow();
      const resolver = buildResolvePersonFn(makeLookupMock(row));

      const result = await resolver(makeBridge());

      // serviceIdentities 단일 키만 — id/fullName/email 등 전체 Person 필드 비노출.
      expect(Object.keys(result)).toEqual(["serviceIdentities"]);
      const leaked = result as unknown as Record<string, unknown>;
      expect(leaked.id).toBeUndefined();
      expect(leaked.fullName).toBeUndefined();
      expect(leaked.email).toBeUndefined();
    });
  });
});
