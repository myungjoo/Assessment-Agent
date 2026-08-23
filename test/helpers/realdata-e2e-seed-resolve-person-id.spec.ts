// realdata-e2e-seed-resolve-person-id.spec.ts — T-0575 colocated unit spec.
//
// R-112 cover 구조:
//   - happy-path: buildRealDataE2eSeed() → buildRealDataUpsertArgs() →
//     resolveRealDataPersonId() 파이프라인에 정상 email→id map 을 넣어 placeholder
//     전부 치환·동일 Person 동일 id 검증.
//   - flow/branch: identity 0 개 Person 분기 + identity 2+ 개 Person 분기 + 빈 입력
//     배열 분기.
//   - error/negative 충분 cover: (a) email 키 누락 throw, (b) 빈/공백 person.id
//     throw, (c) 입력 mutation 격리, (d) ReadonlyMap·Record 두 형태 동작, (e) R-59
//     raw 활동 데이터 미포함.
//   - (f) T-1664 create.personId 배선: happy(3 값 동일)·분기(Map/Record·identity 0·빈
//     입력)·negative(placeholder 잔존 0·입력 create mutate 0·cross-contamination 0·
//     반환 mutate 무전파)·regression(devset 전 identity 에 비지 않은 create.personId).
import { resolveDevsetSeedUpsertArgs } from "./realdata-devset-seed-upsert-args";
import {
  buildRealDataE2eSeed,
  type RealDataSeedDescriptor,
} from "./realdata-e2e-seed-fixture";
import { resolveRealDataPersonId } from "./realdata-e2e-seed-resolve-person-id";
import {
  buildRealDataUpsertArgs,
  PERSON_ID_PLACEHOLDER,
  type RealDataUpsertArgs,
} from "./realdata-e2e-seed-upsert";

// buildIdMap — buildRealDataE2eSeed 결과의 모든 email 에 결정론적 가짜 person.id 를
// 부여한 ReadonlyMap 을 만든다(happy-path 용).
function buildIdMap(args: RealDataUpsertArgs[]): Map<string, string> {
  const map = new Map<string, string>();
  args.forEach((a, i) => {
    map.set(a.personUpsert.where.email, `person-id-${i + 1}`);
  });
  return map;
}

// 다중 identity 를 가진 단일 Person descriptor (분기 cover 용).
const MULTI_IDENTITY_DESCRIPTOR: RealDataSeedDescriptor = {
  person: { fullName: "m", email: "m@x.test", active: true },
  serviceIdentities: [
    { service: "github.com", externalId: "m1", isPrimary: true },
    { service: "github.com", externalId: "m2", isPrimary: false },
  ],
};

describe("resolveRealDataPersonId", () => {
  describe("happy path (파이프라인 전체 치환)", () => {
    it("placeholder 가 전부 실 person.id 로 치환된다", () => {
      const args = buildRealDataUpsertArgs(buildRealDataE2eSeed());
      const map = buildIdMap(args);
      const resolved = resolveRealDataPersonId(args, map);
      for (const a of resolved) {
        for (const identity of a.identityUpsertsByEmail) {
          expect(identity.where.personId_service.personId).not.toBe(
            PERSON_ID_PLACEHOLDER,
          );
          expect(identity.where.personId_service.personId).toMatch(
            /^person-id-\d+$/,
          );
        }
      }
    });

    it("각 identity 의 personId 가 해당 email 의 map 값과 일치한다", () => {
      const args = buildRealDataUpsertArgs(buildRealDataE2eSeed());
      const map = buildIdMap(args);
      const resolved = resolveRealDataPersonId(args, map);
      resolved.forEach((a) => {
        const expectedId = map.get(a.personUpsert.where.email);
        for (const identity of a.identityUpsertsByEmail) {
          expect(identity.where.personId_service.personId).toBe(expectedId);
        }
      });
    });

    it("동일 Person 의 모든 identity 가 같은 person.id 를 받는다 (compound-unique 정합)", () => {
      const args = buildRealDataUpsertArgs([MULTI_IDENTITY_DESCRIPTOR]);
      const map = new Map([["m@x.test", "real-id-42"]]);
      const resolved = resolveRealDataPersonId(args, map);
      const ids = resolved[0].identityUpsertsByEmail.map(
        (i) => i.where.personId_service.personId,
      );
      expect(new Set(ids)).toEqual(new Set(["real-id-42"]));
    });

    it("service 값은 치환 대상이 아니라 그대로 보존된다", () => {
      const args = buildRealDataUpsertArgs([MULTI_IDENTITY_DESCRIPTOR]);
      const map = new Map([["m@x.test", "real-id-42"]]);
      const resolved = resolveRealDataPersonId(args, map);
      expect(
        resolved[0].identityUpsertsByEmail.map(
          (i) => i.where.personId_service.service,
        ),
      ).toEqual(["github.com", "github.com"]);
    });

    it("personUpsert 는 치환 대상이 아니라 내용이 보존된다", () => {
      const args = buildRealDataUpsertArgs(buildRealDataE2eSeed());
      const map = buildIdMap(args);
      const resolved = resolveRealDataPersonId(args, map);
      resolved.forEach((a, i) => {
        expect(a.personUpsert).toEqual(args[i].personUpsert);
      });
    });
  });

  describe("flow / branch (분기 cover)", () => {
    it("(분기 identity=0) 빈 identityUpsertsByEmail Person 은 throw 없이 빈 배열 통과", () => {
      const args = buildRealDataUpsertArgs([
        {
          person: { fullName: "n", email: "n@x.test", active: true },
          serviceIdentities: [],
        },
      ]);
      const map = new Map([["n@x.test", "id-n"]]);
      const resolved = resolveRealDataPersonId(args, map);
      expect(resolved[0].identityUpsertsByEmail).toEqual([]);
    });

    it("(분기 identity=2+) 2 개 identity 가 순서 보존하며 전부 치환된다", () => {
      const args = buildRealDataUpsertArgs([MULTI_IDENTITY_DESCRIPTOR]);
      const map = new Map([["m@x.test", "id-m"]]);
      const resolved = resolveRealDataPersonId(args, map);
      expect(resolved[0].identityUpsertsByEmail).toHaveLength(2);
      expect(
        resolved[0].identityUpsertsByEmail.map((i) => i.create.externalId),
      ).toEqual(["m1", "m2"]);
      resolved[0].identityUpsertsByEmail.forEach((i) =>
        expect(i.where.personId_service.personId).toBe("id-m"),
      );
    });

    it("(분기 빈 입력) 빈 배열 입력 → 빈 배열 반환 (throw 0)", () => {
      expect(() => resolveRealDataPersonId([], new Map())).not.toThrow();
      expect(resolveRealDataPersonId([], {})).toEqual([]);
    });
  });

  describe("error / negative cases (충분 cover)", () => {
    // (a) email 키 누락 — 조용한 통과 차단.
    it("(a) map 에 email 키가 없으면 누락 email 을 담아 throw 한다", () => {
      const args = buildRealDataUpsertArgs([MULTI_IDENTITY_DESCRIPTOR]);
      expect(() => resolveRealDataPersonId(args, new Map())).toThrow(
        /m@x\.test/,
      );
    });

    it("(a) Record 입력에 email 키가 없어도 throw 한다", () => {
      const args = buildRealDataUpsertArgs([MULTI_IDENTITY_DESCRIPTOR]);
      expect(() => resolveRealDataPersonId(args, {})).toThrow(/m@x\.test/);
    });

    it("(a) inherited prototype 속성은 own-property 가 아니므로 누락으로 throw", () => {
      const args = buildRealDataUpsertArgs([MULTI_IDENTITY_DESCRIPTOR]);
      // toString 은 Object.prototype 상속 키 — own-property 아님.
      const proto = { "m@x.test": "inherited-id" };
      const record: Record<string, string> = Object.create(proto);
      expect(() => resolveRealDataPersonId(args, record)).toThrow(/m@x\.test/);
    });

    // (b) 빈/공백 person.id — placeholder 를 빈 id 로 바꿔 정합 깨는 일 차단.
    it("(b) map 값이 빈 문자열이면 throw 한다", () => {
      const args = buildRealDataUpsertArgs([MULTI_IDENTITY_DESCRIPTOR]);
      const map = new Map([["m@x.test", ""]]);
      expect(() => resolveRealDataPersonId(args, map)).toThrow(/m@x\.test/);
    });

    it("(b) map 값이 공백뿐이면 throw 한다", () => {
      const args = buildRealDataUpsertArgs([MULTI_IDENTITY_DESCRIPTOR]);
      const map = new Map([["m@x.test", "   "]]);
      expect(() => resolveRealDataPersonId(args, map)).toThrow(/m@x\.test/);
    });

    it("(b) identity 0 개 Person 이라도 빈 person.id 면 throw (lookup 은 항상 검증)", () => {
      const args = buildRealDataUpsertArgs([
        {
          person: { fullName: "n", email: "n@x.test", active: true },
          serviceIdentities: [],
        },
      ]);
      const map = new Map([["n@x.test", ""]]);
      expect(() => resolveRealDataPersonId(args, map)).toThrow(/n@x\.test/);
    });
  });

  describe("순수성 / 무공유 (negative — mutation 격리)", () => {
    // (c) 입력 mutation 격리.
    it("(c) 입력 upsertArgsList 를 mutate 하지 않고 원본 placeholder 를 보존한다", () => {
      const args = buildRealDataUpsertArgs([MULTI_IDENTITY_DESCRIPTOR]);
      const snapshot = JSON.stringify(args);
      resolveRealDataPersonId(args, new Map([["m@x.test", "id-m"]]));
      expect(JSON.stringify(args)).toBe(snapshot);
      // 원본 placeholder 가 그대로 살아있다.
      expect(
        args[0].identityUpsertsByEmail[0].where.personId_service.personId,
      ).toBe(PERSON_ID_PLACEHOLDER);
    });

    it("(c) 반환값을 mutate 해도 원본 입력이 오염되지 않는다", () => {
      const args = buildRealDataUpsertArgs([MULTI_IDENTITY_DESCRIPTOR]);
      const resolved = resolveRealDataPersonId(
        args,
        new Map([["m@x.test", "id-m"]]),
      );
      resolved[0].personUpsert.create.fullName = "MUTATED";
      resolved[0].identityUpsertsByEmail[0].where.personId_service.personId =
        "TAMPERED";
      expect(args[0].personUpsert.create.fullName).not.toBe("MUTATED");
      expect(
        args[0].identityUpsertsByEmail[0].where.personId_service.personId,
      ).toBe(PERSON_ID_PLACEHOLDER);
    });

    it("(c) 반환값과 입력은 서로 다른 객체 트리다", () => {
      const args = buildRealDataUpsertArgs([MULTI_IDENTITY_DESCRIPTOR]);
      const resolved = resolveRealDataPersonId(
        args,
        new Map([["m@x.test", "id-m"]]),
      );
      expect(resolved[0]).not.toBe(args[0]);
      expect(resolved[0].personUpsert).not.toBe(args[0].personUpsert);
      expect(resolved[0].identityUpsertsByEmail).not.toBe(
        args[0].identityUpsertsByEmail,
      );
    });
  });

  describe("(d) ReadonlyMap·Record 두 입력 형태 모두 동작", () => {
    it("ReadonlyMap 입력으로 치환된다", () => {
      const args = buildRealDataUpsertArgs([MULTI_IDENTITY_DESCRIPTOR]);
      const map: ReadonlyMap<string, string> = new Map([
        ["m@x.test", "via-map"],
      ]);
      const resolved = resolveRealDataPersonId(args, map);
      expect(
        resolved[0].identityUpsertsByEmail[0].where.personId_service.personId,
      ).toBe("via-map");
    });

    it("Record 입력으로 치환된다", () => {
      const args = buildRealDataUpsertArgs([MULTI_IDENTITY_DESCRIPTOR]);
      const record: Record<string, string> = { "m@x.test": "via-record" };
      const resolved = resolveRealDataPersonId(args, record);
      expect(
        resolved[0].identityUpsertsByEmail[0].where.personId_service.personId,
      ).toBe("via-record");
    });

    it("ReadonlyMap 과 Record 가 동일 입력에 동일 결과를 낸다", () => {
      const args = buildRealDataUpsertArgs([MULTI_IDENTITY_DESCRIPTOR]);
      const viaMap = resolveRealDataPersonId(
        args,
        new Map([["m@x.test", "same"]]),
      );
      const viaRecord = resolveRealDataPersonId(args, { "m@x.test": "same" });
      expect(viaRecord).toEqual(viaMap);
    });
  });

  describe("(e) R-59 — raw 활동 데이터 미포함", () => {
    it("치환 결과는 입력과 동일한 키 구조만 가진다 (새 raw 필드 0)", () => {
      const args = buildRealDataUpsertArgs(buildRealDataE2eSeed());
      const map = buildIdMap(args);
      const resolved = resolveRealDataPersonId(args, map);
      for (const a of resolved) {
        expect(Object.keys(a).sort()).toEqual([
          "identityUpsertsByEmail",
          "personUpsert",
        ]);
        for (const identity of a.identityUpsertsByEmail) {
          expect(Object.keys(identity).sort()).toEqual([
            "create",
            "update",
            "where",
          ]);
          // T-1664 — create 는 required relation 충족을 위해 personId 를 더 담는다
          // (기존 3 키 계약을 삭제하지 않고 4 키 새 계약으로 갱신).
          expect(Object.keys(identity.create).sort()).toEqual([
            "externalId",
            "isPrimary",
            "personId",
            "service",
          ]);
        }
      }
    });
  });

  // ── (f) T-1664 — create.personId 배선 (required relation 충족) ────────────────
  // 배경: R-91 실 dataset run `32652307813` 의 seed step 이 Prisma 에러
  // ``Argument `person` is missing.`` 로 exit 1 했다. 원인은 신규 row 를 만드는
  // `create` 경로에 personId 가 없었던 것 — 치환이 `where` 에만 적용됐기 때문이다.
  describe("(f) T-1664 — create.personId 배선(required relation 충족)", () => {
    it("(happy) devset 전 identity 에서 create.personId · where.personId · map 실값 3 값이 모두 같다", () => {
      const args = resolveDevsetSeedUpsertArgs(12);
      const map = buildIdMap(args);
      const resolved = resolveRealDataPersonId(args, map);

      let seen = 0;
      resolved.forEach((a) => {
        const expectedId = map.get(a.personUpsert.where.email);
        for (const identity of a.identityUpsertsByEmail) {
          expect(identity.create.personId).toBe(expectedId);
          expect(identity.create.personId).toBe(
            identity.where.personId_service.personId,
          );
          seen += 1;
        }
      });
      // 순회가 실제로 identity 를 돌았음을 보장(빈 순회로 통과하는 위양성 차단).
      expect(seen).toBeGreaterThan(0);
    });

    it("(regression) devset 전 identity 의 create.personId 가 비지 않은 문자열로 반드시 존재한다 — 깨지면 run 32652307813 의 Prisma `Argument person is missing.` 가 재발한다", () => {
      const args = resolveDevsetSeedUpsertArgs(133);
      const resolved = resolveRealDataPersonId(args, buildIdMap(args));

      let seen = 0;
      for (const a of resolved) {
        for (const identity of a.identityUpsertsByEmail) {
          expect(typeof identity.create.personId).toBe("string");
          expect((identity.create.personId ?? "").trim()).not.toBe("");
          seen += 1;
        }
      }
      expect(seen).toBe(133);
    });

    it("(분기 ReadonlyMap arm) Map 입력에서도 create.personId 가 채워진다", () => {
      const args = buildRealDataUpsertArgs([MULTI_IDENTITY_DESCRIPTOR]);
      const map: ReadonlyMap<string, string> = new Map([
        ["m@x.test", "via-map"],
      ]);
      const resolved = resolveRealDataPersonId(args, map);
      resolved[0].identityUpsertsByEmail.forEach((i) =>
        expect(i.create.personId).toBe("via-map"),
      );
    });

    it("(분기 Record arm) Record 입력에서도 create.personId 가 채워진다", () => {
      const args = buildRealDataUpsertArgs([MULTI_IDENTITY_DESCRIPTOR]);
      const resolved = resolveRealDataPersonId(args, {
        "m@x.test": "via-record",
      });
      resolved[0].identityUpsertsByEmail.forEach((i) =>
        expect(i.create.personId).toBe("via-record"),
      );
    });

    it("(분기 경계) identity 0 개 Person · 빈 입력 배열은 throw 0 으로 통과한다", () => {
      const args = buildRealDataUpsertArgs([
        {
          person: { fullName: "z", email: "z@x.test", active: true },
          serviceIdentities: [],
        },
      ]);
      expect(() =>
        resolveRealDataPersonId(args, new Map([["z@x.test", "id-z"]])),
      ).not.toThrow();
      expect(resolveRealDataPersonId([], new Map())).toEqual([]);
      expect(resolveRealDataPersonId([], {})).toEqual([]);
    });

    it("(error path) email 매핑 누락은 기존 throw 계약 그대로 — 새 에러 유형 0 · 부분 치환 트리 반환 0", () => {
      const args = buildRealDataUpsertArgs([MULTI_IDENTITY_DESCRIPTOR]);
      let caught: unknown;
      try {
        resolveRealDataPersonId(args, new Map());
      } catch (e) {
        caught = e;
      }
      // 기존 계약: 평범한 Error — create.personId 배선으로 유형이 바뀌지 않았다.
      expect(caught).toBeInstanceOf(Error);
      expect(caught).not.toBeInstanceOf(TypeError);
      expect(caught).not.toBeInstanceOf(RangeError);
      expect((caught as Error).message).toMatch(/m@x\.test/);
      // 부분 치환 트리 반환 0 — 입력은 placeholder 그대로, create 에 personId 미주입.
      expect(
        args[0].identityUpsertsByEmail[0].where.personId_service.personId,
      ).toBe(PERSON_ID_PLACEHOLDER);
      expect(args[0].identityUpsertsByEmail[0].create).not.toHaveProperty(
        "personId",
      );
    });

    it("(error path) map 값이 빈 문자열/공백이면 기존 throw 계약 그대로 유지된다", () => {
      const args = buildRealDataUpsertArgs([MULTI_IDENTITY_DESCRIPTOR]);
      for (const blank of ["", "   "]) {
        expect(() =>
          resolveRealDataPersonId(args, new Map([["m@x.test", blank]])),
        ).toThrow(/m@x\.test/);
      }
      expect(args[0].identityUpsertsByEmail[0].create).not.toHaveProperty(
        "personId",
      );
    });

    it("(negative ①) create.personId 에 PERSON_ID_PLACEHOLDER 가 잔존하지 않는다", () => {
      const args = resolveDevsetSeedUpsertArgs(8);
      const resolved = resolveRealDataPersonId(args, buildIdMap(args));
      for (const a of resolved) {
        for (const identity of a.identityUpsertsByEmail) {
          expect(identity.create.personId).not.toBe(PERSON_ID_PLACEHOLDER);
        }
      }
      expect(JSON.stringify(resolved)).not.toContain(PERSON_ID_PLACEHOLDER);
    });

    it("(negative ②) 입력 args 의 create 객체를 mutate 하지 않는다(원본 키 3 개 유지 · 무공유)", () => {
      const args = buildRealDataUpsertArgs([MULTI_IDENTITY_DESCRIPTOR]);
      const snapshot = JSON.stringify(args);
      const resolved = resolveRealDataPersonId(
        args,
        new Map([["m@x.test", "id-m"]]),
      );
      expect(JSON.stringify(args)).toBe(snapshot);
      expect(
        Object.keys(args[0].identityUpsertsByEmail[0].create).sort(),
      ).toEqual(["externalId", "isPrimary", "service"]);
      expect(resolved[0].identityUpsertsByEmail[0].create).not.toBe(
        args[0].identityUpsertsByEmail[0].create,
      );
    });

    it("(negative ③) 서로 다른 Person 의 identity 가 서로의 personId 를 받지 않는다(cross-contamination 0)", () => {
      const args = buildRealDataUpsertArgs([
        {
          person: { fullName: "a", email: "a@x.test", active: true },
          serviceIdentities: [
            { service: "github.com", externalId: "a1", isPrimary: true },
          ],
        },
        {
          person: { fullName: "b", email: "b@x.test", active: true },
          serviceIdentities: [
            { service: "github.com", externalId: "b1", isPrimary: true },
            { service: "github.com", externalId: "b2", isPrimary: false },
          ],
        },
      ]);
      const resolved = resolveRealDataPersonId(
        args,
        new Map([
          ["a@x.test", "id-a"],
          ["b@x.test", "id-b"],
        ]),
      );
      expect(
        resolved[0].identityUpsertsByEmail.map((i) => i.create.personId),
      ).toEqual(["id-a"]);
      expect(
        resolved[1].identityUpsertsByEmail.map((i) => i.create.personId),
      ).toEqual(["id-b", "id-b"]);
    });

    it("(negative ④) 반환 트리의 create.personId 를 caller 가 mutate 해도 입력에 전파되지 않는다", () => {
      const args = buildRealDataUpsertArgs([MULTI_IDENTITY_DESCRIPTOR]);
      const resolved = resolveRealDataPersonId(
        args,
        new Map([["m@x.test", "id-m"]]),
      );
      resolved[0].identityUpsertsByEmail[0].create.personId = "TAMPERED";
      expect(args[0].identityUpsertsByEmail[0].create).not.toHaveProperty(
        "personId",
      );
      // 같은 Person 의 다른 identity 도 오염되지 않는다(create 객체 무공유).
      expect(resolved[0].identityUpsertsByEmail[1].create.personId).toBe(
        "id-m",
      );
    });
  });
});
