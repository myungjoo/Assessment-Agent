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
          expect(Object.keys(identity.create).sort()).toEqual([
            "externalId",
            "isPrimary",
            "service",
          ]);
        }
      }
    });
  });
});
