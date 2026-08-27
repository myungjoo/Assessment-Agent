// selectNextPrimaryIdentity spec — T-1745 acceptance
// (R-112: happy / error / branch / negative 4 카테고리 + coverage line/function ≥ 80%).
//
// 대상이 의존성 0 의 순수 함수라 mock 이 필요 없다. 검증 포인트:
//   - happy: `createdAt` 이 서로 다른 3 row 를 무작위 순서로 넣어도 가장 이른 row 반환.
//   - error: 빈 배열 → throw 없이 `null` / `createdAt` 완전 동률 → throw 없이 `id` 첫 row.
//   - branch: 빈 배열 · 단일 row · `createdAt` 비동률 · `createdAt` 동률 tie-break ·
//     정렬 입력과 역순 입력의 결과 동일(comparator 양방향).
//   - negative: 원본 배열 비변형 · `isPrimary=true` row 무시 · 서로 다른 Date 인스턴스의
//     동일 시각 동률 · `id` 사전순(locale 비의존) · 최소가 마지막이어도 선택 · 동일 참조
//     반환 · `createdAt` 동률 3 row 에서 `id` 최소 선택.
import type { ServiceIdentity } from "@prisma/client";

import { selectNextPrimaryIdentity } from "./service-identity-primary-order";

// ServiceIdentity fixture — schema.prisma 의 7 컬럼을 모두 채운 default row.
// service-identity.service.spec.ts 의 관례를 승계한다 (`as` 단언 금지 — 컬럼이 늘면
// 본 fixture 가 compile error 로 drift 를 알려야 하기 때문이다).
function buildServiceIdentityFixture(
  overrides: Partial<ServiceIdentity> = {},
): ServiceIdentity {
  return {
    id: "si-1",
    personId: "person-1",
    service: "github.com",
    externalId: "external-1",
    isPrimary: false,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    ...overrides,
  };
}

// 규칙이 보는 축(`createdAt` · `id`)과 무시해야 할 축(`isPrimary`)만 짧게 지정하는 helper.
// 매 test 가 새 Date 인스턴스를 만들므로 "같은 시각 다른 인스턴스" 상황이 기본이다.
function row(
  id: string,
  createdAt: string,
  isPrimary = false,
): ServiceIdentity {
  return buildServiceIdentityFixture({
    id,
    createdAt: new Date(createdAt),
    isPrimary,
  });
}

const T1 = "2026-01-01T00:00:00.000Z";
const T2 = "2026-02-01T00:00:00.000Z";
const T3 = "2026-03-01T00:00:00.000Z";

describe("selectNextPrimaryIdentity", () => {
  describe("happy path", () => {
    it("createdAt 이 서로 다른 3 row 를 무작위 순서로 넣으면 가장 이른 row 를 반환한다", () => {
      const oldest = row("si-b", T1);
      const middle = row("si-a", T2);
      const newest = row("si-c", T3);

      expect(selectNextPrimaryIdentity([middle, newest, oldest])).toBe(oldest);
    });
  });

  describe("error path", () => {
    it("빈 배열이면 throw 하지 않고 null 을 반환한다", () => {
      expect(() => selectNextPrimaryIdentity([])).not.toThrow();
      expect(selectNextPrimaryIdentity([])).toBeNull();
    });

    it("createdAt 이 완전 동률인 2 row 도 throw 없이 id 오름차순 첫 row 를 반환한다", () => {
      const later = row("si-z", T1);
      const earlier = row("si-a", T1);

      expect(() => selectNextPrimaryIdentity([later, earlier])).not.toThrow();
      expect(selectNextPrimaryIdentity([later, earlier])).toBe(earlier);
    });
  });

  describe("branch", () => {
    it("빈 배열 분기 — null", () => {
      expect(selectNextPrimaryIdentity([])).toBeNull();
    });

    it("단일 row 분기 — 그 row 를 그대로 반환한다", () => {
      const only = row("si-only", T2);

      expect(selectNextPrimaryIdentity([only])).toBe(only);
    });

    it("createdAt 비동률 분기 — id 사전순과 무관하게 createdAt 이 이긴다", () => {
      const earlier = row("si-z", T1);
      const later = row("si-a", T3);

      expect(selectNextPrimaryIdentity([earlier, later])).toBe(earlier);
    });

    it("createdAt 동률 분기 — id tie-break 이 발동한다", () => {
      const first = row("si-001", T1);
      const second = row("si-002", T1);

      expect(selectNextPrimaryIdentity([second, first])).toBe(first);
    });

    it("이미 정렬된 입력과 역순 입력이 같은 결과를 준다 (comparator 양방향)", () => {
      const rows = [row("si-1", T1), row("si-2", T2), row("si-3", T3)];

      const ascending = selectNextPrimaryIdentity(rows);
      const descending = selectNextPrimaryIdentity([...rows].reverse());

      expect(ascending).toBe(rows[0]);
      expect(descending).toBe(ascending);
    });
  });

  describe("negative", () => {
    it("입력 배열을 변형하지 않는다 — 호출 전후 id 순서와 길이가 동일하다", () => {
      const rows = [row("si-c", T3), row("si-a", T1), row("si-b", T2)];
      const before = rows.map((entry) => entry.id);

      selectNextPrimaryIdentity(rows);

      expect(rows.map((entry) => entry.id)).toEqual(before);
      expect(rows).toHaveLength(3);
    });

    it("isPrimary=true row 가 섞여 있어도 그 row 가 아니라 규칙상 첫 row 를 고른다", () => {
      const wronglyPrimary = row("si-primary", T3, true);
      const ruleWinner = row("si-plain", T1, false);

      expect(selectNextPrimaryIdentity([wronglyPrimary, ruleWinner])).toBe(
        ruleWinner,
      );
    });

    it("서로 다른 Date 인스턴스라도 같은 시각이면 동률로 취급한다 (참조 비교 아님)", () => {
      const later = row("si-y", T1);
      const earlier = row("si-x", T1);

      expect(later.createdAt).not.toBe(earlier.createdAt);
      expect(later.createdAt.getTime()).toBe(earlier.createdAt.getTime());
      expect(selectNextPrimaryIdentity([later, earlier])).toBe(earlier);
    });

    it("id tie-break 은 코드포인트 사전순이다 — 대문자 · 숫자가 소문자보다 앞선다", () => {
      const upper = row("Ckq9z1a", T1);
      const lower = row("ckq0z1a", T1);
      const digit = row("9kq0z1a", T1);

      // localeCompare 였다면 "9" < "C" < "c" 코드포인트 순서가 뒤집힐 수 있다.
      expect(selectNextPrimaryIdentity([lower, upper])).toBe(upper);
      expect(selectNextPrimaryIdentity([lower, upper, digit])).toBe(digit);
    });

    it("최소 row 가 배열 마지막에 있어도 정확히 선택한다 (조기 반환 버그 방지)", () => {
      const rows = [
        row("si-1", "2026-04-01T00:00:00.000Z"),
        row("si-2", T3),
        row("si-3", T2),
        row("si-4", T1),
      ];

      expect(selectNextPrimaryIdentity(rows)).toBe(rows[3]);
    });

    it("반환값은 입력 원소와 동일 참조다 — 새 객체를 만들지 않는다", () => {
      const only = row("si-ref", T1);

      const selected = selectNextPrimaryIdentity([only]);

      expect(selected).toBe(only);
      expect(selected).not.toEqual({ ...only, id: "other" });
    });

    it("createdAt 이 동률인 3 row 에서도 id 최소가 선택된다", () => {
      const rows = [row("si-c", T1), row("si-a", T1), row("si-b", T1)];

      expect(selectNextPrimaryIdentity(rows)).toBe(rows[1]);
    });
  });
});
