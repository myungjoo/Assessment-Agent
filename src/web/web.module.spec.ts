// WebModule spec — T-0354 (scripts/check-spec-presence.sh 의 colocated spec 의무).
// resolveServeStaticOptions helper 의 dist 존재/부재 분기 (R-112: happy + error +
// branch + negative 충분 cover) 와 WebModule compile 정합성을 검증한다.
// 실 HTTP serve/fallback 동작은 운영 dist 존재 환경의 책임 — 본 spec 은 등록 분기만.
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";

import { Test, type TestingModule } from "@nestjs/testing";

import {
  API_EXCLUDE_PATTERN,
  WEB_DIST_PATH,
  WebModule,
  resolveServeStaticOptions,
} from "./web.module";

describe("resolveServeStaticOptions", () => {
  let tempRoot: string;

  beforeEach(() => {
    tempRoot = mkdtempSync(join(tmpdir(), "t0354-web-dist-"));
  });

  afterEach(() => {
    rmSync(tempRoot, { recursive: true, force: true });
  });

  // Happy path: dist 디렉토리에 index.html 이 존재하면 rootPath + /api/* exclude
  // 를 담은 ServeStatic 옵션 1개를 반환한다 (ADR-0040 §3 등록 분기).
  it("dist 에 index.html 이 존재하면 rootPath/exclude 옵션 1개를 반환한다 (happy)", () => {
    const distPath = join(tempRoot, "dist");
    mkdirSync(distPath);
    writeFileSync(join(distPath, "index.html"), "<!doctype html>");

    const options = resolveServeStaticOptions(distPath);

    expect(options).toHaveLength(1);
    expect(options[0]).toEqual({
      rootPath: distPath,
      exclude: [API_EXCLUDE_PATTERN],
    });
  });

  // Error path: 존재하지 않는 경로 입력 시 throw 없이 빈 배열 (등록 0) — CI / dev
  // 의 dist 부재 환경에서 부팅이 무변경 green 이어야 하는 분기.
  it("존재하지 않는 경로면 throw 없이 빈 배열을 반환한다 (error path — dist 부재)", () => {
    const missingPath = join(tempRoot, "no-such-dist");

    expect(() => resolveServeStaticOptions(missingPath)).not.toThrow();
    expect(resolveServeStaticOptions(missingPath)).toEqual([]);
  });

  // Negative: dist 디렉토리는 있으나 index.html 이 없으면 등록 0 — SPA fallback 의
  // 실체(index.html)가 없는 절반-build 상태를 serve 하지 않는다.
  it("dist 디렉토리는 있으나 index.html 부재면 빈 배열을 반환한다 (negative — 절반 build)", () => {
    const distPath = join(tempRoot, "dist-without-index");
    mkdirSync(distPath);
    writeFileSync(join(distPath, "other.txt"), "not-an-index");

    expect(resolveServeStaticOptions(distPath)).toEqual([]);
  });

  // Negative: 빈 문자열 입력 가드 — join("", "index.html") 의 cwd 상대 오인 매칭
  // 차단 분기. throw 없이 빈 배열.
  it("빈 문자열 입력이면 throw 없이 빈 배열을 반환한다 (negative — 빈 입력)", () => {
    expect(() => resolveServeStaticOptions("")).not.toThrow();
    expect(resolveServeStaticOptions("")).toEqual([]);
  });

  // Negative: 비정상 경로 — (a) NUL 문자 포함 경로는 OS 가 거부하는 invalid path,
  // (b) 디렉토리가 아닌 일반 파일을 distPath 로 입력. 둘 다 throw 없이 빈 배열.
  it("비정상 경로(NUL 문자·일반 파일)면 throw 없이 빈 배열을 반환한다 (negative — 비정상 경로)", () => {
    // NUL 문자는 source 에 직접 못 박지 않고 fromCharCode 로 생성 (편집기/diff 안전).
    const nulPath = `${String.fromCharCode(0)}invalid`;
    expect(() => resolveServeStaticOptions(nulPath)).not.toThrow();
    expect(resolveServeStaticOptions(nulPath)).toEqual([]);

    const filePath = join(tempRoot, "plain-file.txt");
    writeFileSync(filePath, "i-am-a-file");
    expect(resolveServeStaticOptions(filePath)).toEqual([]);
  });

  // Negative: type mismatch — 런타임에서 undefined 가 흘러들어와도 falsy 가드가
  // throw 없이 빈 배열로 흡수한다 (R-112 type mismatch case).
  it("undefined 입력(type bypass)이어도 throw 없이 빈 배열을 반환한다 (negative — type mismatch)", () => {
    const bogus = undefined as unknown as string;
    expect(() => resolveServeStaticOptions(bogus)).not.toThrow();
    expect(resolveServeStaticOptions(bogus)).toEqual([]);
  });
});

describe("WebModule", () => {
  // 경로 anchor: WEB_DIST_PATH 는 repo root (process.cwd()) 기준 web/dist —
  // ADR-0040 §4 의 산출물 위치와 동기. 회귀 가드: 경로 계산 변경 시 fail.
  it("WEB_DIST_PATH 는 process.cwd() 기준 web/dist 를 가리킨다", () => {
    expect(WEB_DIST_PATH).toBe(join(process.cwd(), "web", "dist"));
  });

  // Branch: dist 존재/부재 어느 환경(CI=부재, local build 후=존재)에서도 module 이
  // compile 한다 — imports 0개/1개 양 분기 공통의 부팅 안전성 검증.
  it("dist 존재/부재 어느 분기에서도 WebModule 이 compile 한다", async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [WebModule],
    }).compile();

    expect(moduleRef.get(WebModule)).toBeInstanceOf(WebModule);

    await moduleRef.close();
  });
});
