// github-repo-list.mapper.spec — mapRepoName 순수 함수의 R-112 spec. happy(정상 name /
// full_name fallback) + negative(null / 비객체 / 배열 / name 누락 / 빈 문자열) 분기마다
// cover. 순수 함수라 mock 불요 — 입력 literal 로 충분.

import { mapRepoName } from "./github-repo-list.mapper";

describe("mapRepoName", () => {
  describe("happy path", () => {
    it("name 필드에서 repo 이름을 추출한다", () => {
      expect(mapRepoName({ name: "api", full_name: "acme/api" })).toBe("api");
    });

    it("name 부재 시 full_name 의 마지막 segment 를 fallback 으로 추출한다", () => {
      expect(mapRepoName({ full_name: "acme/shared-lib" })).toBe("shared-lib");
    });

    it("name 의 앞뒤 공백을 trim 한다", () => {
      expect(mapRepoName({ name: "  api  " })).toBe("api");
    });

    it("name 이 full_name 보다 우선한다", () => {
      expect(mapRepoName({ name: "real", full_name: "acme/other" })).toBe(
        "real",
      );
    });
  });

  describe("negative / 방어 경로", () => {
    it("null → null", () => {
      expect(mapRepoName(null)).toBeNull();
    });

    it("비-객체(primitive) → null", () => {
      expect(mapRepoName("acme/api")).toBeNull();
      expect(mapRepoName(42)).toBeNull();
    });

    it("배열 → null", () => {
      expect(mapRepoName(["api"])).toBeNull();
    });

    it("name 누락 + full_name 누락 → null", () => {
      expect(mapRepoName({ id: 1 })).toBeNull();
    });

    it("name 비-string(number) + full_name 누락 → null", () => {
      expect(mapRepoName({ name: 123 })).toBeNull();
    });

    it("name 빈/공백 문자열 + full_name 누락 → null", () => {
      expect(mapRepoName({ name: "   " })).toBeNull();
    });

    it("full_name 이 trailing slash 라 마지막 segment 가 빈 경우 → null", () => {
      expect(mapRepoName({ full_name: "acme/" })).toBeNull();
    });

    it("full_name 이 슬래시 없는 단일 토큰이면 그대로 repo 이름", () => {
      expect(mapRepoName({ full_name: "solo" })).toBe("solo");
    });
  });
});
