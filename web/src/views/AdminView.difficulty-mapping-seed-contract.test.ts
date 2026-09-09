import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { RequestOptions } from '../api/apiClient';
import type { SeedSlotsDeps } from './adminLlmProviderMutationRunners';
import { LLM_MAPPINGS_PATH, runSeedSlots } from './adminLlmProviderMutationRunners';
// 공용 invariant 추출기(T-1201 신설) import — inline 복사본을 만들지 않는다(T-1226 이관 규약).
// seed 축은 **body 가 없어서** assign 선례가 inline 유지했던 richer extractHandlerMethods(hasBody 필드)·
// extractDtoFields 가 불필요하다: @Body 존재 여부는 공용 extractHandlerParams 의 시그니처 슬라이스로
// 판정하면 충분하다(대조 DTO 자체가 0 개). BackendContract/WebFire/diffContract 만 본 spec 안 inline.
import {
  composeRoute,
  extractControllerRoute,
  extractHandlerMethods,
  extractHandlerParams,
  normalizeRoute,
  pathSegments,
  stripComments,
} from './__contract-guard__/contract-extractors';

// R-112 — 난이도 슬롯 seed(POST /api/llm/difficulty-mappings/seed) web↔backend **계약 drift guard**.
// backend 는 T-1998(controller `@Post("seed")` + `@HttpCode(200)`), web 은 T-1999(runSeedSlots)로 이미
// 머지됐지만 두 축을 기계적으로 대조하는 guard 만 빈칸이었다. 이 route 의 결정적 특성은 같은 controller 의
// `@Patch(":difficulty")` 와 달리 (1) **정적 subPath**(path param 0 — 인코딩 대상 없음) (2) **body 0**
// (DTO 없음 → Content-Type 헤더도 없음) 라는 점이고, 한쪽만 드리프트하면 unit 은 전부 green 인 채
// 런타임 400(forbidNonWhitelisted)/404 로만 드러난다. 아래 축들이 그 무성(無聲) 회귀를 잡는다.

interface BackendContract {
  route: string | null;
  method: string | null;
  subPath: string;
  hasBody: boolean; // handler 시그니처에 @Body decorator 가 있는가
}
interface WebFire {
  path: string;
  method: string;
  hasBody: boolean;
  contentType: string | undefined;
}

// path template 안의 `:param` 세그먼트 목록 — seed 축은 **정확히 0** 이어야 한다(assign 과의 차이).
const pathParams = (route: string): string[] => pathSegments(route).filter((seg) => seg.startsWith(':'));
// handler 시그니처 슬라이스에 @Body 가 있는지. 시그니처 추출 실패(null)는 보수적으로 false 가 아니라
// 별도 취급하지 않고 '' 로 접어 hasBody=false 로 두되, 추출 실패 자체는 아래 선단언이 잡는다.
const handlerHasBody = (source: string, handler: string): boolean => /@Body\b/.test(extractHandlerParams(source, handler) ?? '');

// 불일치 사유 목록 — 빈 배열 = 계약 일치. 추출 실패는 "조용한 통과" 가 아니라 사유 1 건으로 떨어뜨린다.
function diffContract(fire: WebFire, backend: BackendContract): string[] {
  if (!backend.route || !backend.method) {
    return ['backend 계약 추출 실패'];
  }
  const issues: string[] = [];
  const expected = composeRoute(backend.route, backend.subPath);
  if (fire.path !== expected) {
    issues.push(`path 불일치: web=${fire.path} backend=${expected}`);
  }
  if (fire.method !== backend.method) {
    issues.push(`method 불일치: ${fire.method}`);
  }
  if (fire.hasBody !== backend.hasBody) { // web body ↔ backend @Body 존재 정합(양방향 drift)
    issues.push(`body 존재 정합 위반: web=${fire.hasBody} backend=${backend.hasBody}`);
  }
  if (!backend.hasBody && fire.contentType !== undefined) { // 보낼 payload 가 없는데 헤더만 붙이면 계약 위반
    issues.push(`Content-Type 헤더 부재 계약 위반: ${String(fire.contentType)}`);
  }
  return issues;
}

const CONTROLLER_SOURCE = readFileSync(new URL('../../../src/llm/difficulty-mapping.controller.ts', import.meta.url), 'utf8');
const ROUTE = extractControllerRoute(CONTROLLER_SOURCE);
const HANDLERS = extractHandlerMethods(CONTROLLER_SOURCE);
const SEED_HANDLER = HANDLERS.seed ?? null;
const SEED_CONTRACT: BackendContract = {
  route: ROUTE,
  method: SEED_HANDLER?.method ?? null,
  subPath: SEED_HANDLER?.subPath ?? '',
  hasBody: handlerHasBody(CONTROLLER_SOURCE, 'seed'),
};
const SEED_PATH = '/api/llm/difficulty-mappings/seed';

// options.body 부재/null 은 hasBody=false 로 매핑(러너 발사 인자 캡처, ADR-0040 §5).
function toFire(path: string, options: RequestOptions): WebFire {
  const headers = (options.headers ?? {}) as Record<string, string>;
  return {
    path,
    method: String(options.method),
    hasBody: options.body !== undefined && options.body !== null,
    contentType: headers['Content-Type'],
  };
}
// runSeedSlots 를 mock post 로 1 회 발사시키고 그 인자를 계약 대조용 WebFire 로 캡처한다.
async function fireSeed(): Promise<WebFire> {
  let fired: WebFire | undefined;
  const deps: SeedSlotsDeps = {
    post: async (path, options) => {
      fired = toFire(path, options);
      return undefined;
    },
    describeError: () => '',
    seeding: false,
    setSeeding: () => {},
    setSeedError: () => {},
    bumpRefresh: () => {},
  };
  await runSeedSlots(deps);
  if (!fired) {
    throw new Error('seed 러너가 발사하지 않았다');
  }
  return fired;
}

describe('AdminView — 난이도 슬롯 seed web↔backend 계약 drift guard (T-2001)', () => {
  it('backend route/method 추출이 하나도 비어있지 않다 (error path — 추출기 무력화 방어)', () => {
    expect(ROUTE).not.toBeNull();
    expect(ROUTE).not.toBe('');
    expect(SEED_CONTRACT.method).not.toBeNull();
    expect(SEED_CONTRACT.method).not.toBe('');
    expect(SEED_CONTRACT.subPath).not.toBe(''); // bare @Post() 로 밀리면 여기서 먼저 터진다
    expect(extractHandlerParams(CONTROLLER_SOURCE, 'seed')).not.toBeNull(); // 시그니처 슬라이스 성공
  });

  it('backend @Controller("api/llm/difficulty-mappings") 3-세그먼트 base 를 /api/llm/difficulty-mappings 로 정규화한다 (분기 (1) — base 파싱)', () => {
    expect(ROUTE).toBe('api/llm/difficulty-mappings');
    expect(pathSegments(String(ROUTE))).toHaveLength(3); // api·llm·difficulty-mappings
    expect(normalizeRoute(String(ROUTE))).toBe('/api/llm/difficulty-mappings');
    expect(LLM_MAPPINGS_PATH).toBe(normalizeRoute(String(ROUTE))); // web 상수도 같은 base 를 본다
  });

  it('backend @Post("seed") 정적 subPath 합성이 /api/llm/difficulty-mappings/seed 이고 path param 이 0 개다 (분기 (2) — 정적 path, 인코딩 대상 없음)', () => {
    expect(SEED_CONTRACT.method).toBe('POST');
    expect(SEED_CONTRACT.subPath).toBe('seed');
    const composed = composeRoute(String(ROUTE), SEED_CONTRACT.subPath);
    expect(composed).toBe(SEED_PATH);
    expect(pathSegments(composed)).toHaveLength(4); // api·llm·difficulty-mappings·seed
    expect(pathParams(composed)).toEqual([]); // assign(:difficulty 1 개)과의 결정적 차이
    expect(encodeURIComponent('seed')).toBe('seed'); // 정적 세그먼트라 인코딩 identity — raw 삽입 안전
  });

  it('seed 핸들러는 @Body 가 없고 같은 소스의 assign 핸들러는 @Body 를 갖는다 (분기 (3) — @Body 부재 판정 + 대조군)', () => {
    expect(extractHandlerParams(CONTROLLER_SOURCE, 'seed')).toBe(''); // 인자 0 handler → 빈 시그니처
    expect(SEED_CONTRACT.hasBody).toBe(false);
    expect(handlerHasBody(CONTROLLER_SOURCE, 'assign')).toBe(true); // 추출기가 실제로 구분함 입증
    expect(handlerHasBody(CONTROLLER_SOURCE, 'findAll')).toBe(false); // GET 도 body-less
  });

  it('소스의 POST 핸들러는 seed 하나뿐이고 path param POST 가 0 개다 (분기 (4) — @Post(":difficulty") 가 생기면 seed 오매칭 회귀)', () => {
    const posts = Object.entries(HANDLERS).filter(([, decorator]) => decorator.method === 'POST');
    expect(posts.map(([name]) => name)).toEqual(['seed']); // POST subPath 유일성
    expect(posts.filter(([, d]) => d.subPath.startsWith(':'))).toEqual([]); // `:difficulty = "seed"` 오매칭 예방
    expect(Object.keys(HANDLERS).sort()).toEqual(['assign', 'findAll', 'seed']); // 핸들러 census(신규 route 누락 방지)
  });

  it('runSeedSlots 발사(POST /api/llm/difficulty-mappings/seed)가 backend seed 계약과 완전 일치한다 (happy-path — 발사 인자 정합)', async () => {
    const fired = await fireSeed();
    expect(fired.path).toBe(SEED_PATH);
    expect(fired.method).toBe('POST');
    expect(fired.hasBody).toBe(false); // body 미발사 — forbidNonWhitelisted 400 예방
    expect(fired.contentType).toBeUndefined(); // 보낼 payload 가 없으니 헤더도 없다
    expect(diffContract(fired, SEED_CONTRACT)).toEqual([]); // drift 0
  });

  it('추출된 backend seed 계약 자체가 POST·seed·body 없음 형태다 (happy-path — 계약 형태)', () => {
    expect(SEED_CONTRACT).toEqual({ route: 'api/llm/difficulty-mappings', method: 'POST', subPath: 'seed', hasBody: false });
    expect(composeRoute(String(SEED_CONTRACT.route), SEED_CONTRACT.subPath)).toBe(SEED_PATH);
  });

  it.each<[string, () => BackendContract]>([
    ['(a) backend base 를 api/llm/difficulty-mapping(단수 오타)로', () => ({ ...SEED_CONTRACT, route: 'api/llm/difficulty-mapping' })],
    ['(b) @Post("seed") 를 @Post(":difficulty") 로 드리프트', () => ({ ...SEED_CONTRACT, subPath: extractHandlerMethods(['  @Post(":difficulty")', '  async seed() {}'].join('\n')).seed.subPath })],
    ['(b) @Post("seed-slots")(접미 rename)로', () => ({ ...SEED_CONTRACT, subPath: extractHandlerMethods(['  @Post("seed-slots")', '  async seed() {}'].join('\n')).seed.subPath })],
    ['(c) bare @Post()(세그먼트 0)로', () => ({ ...SEED_CONTRACT, subPath: extractHandlerMethods(['  @Post()', '  async seed() {}'].join('\n')).seed.subPath })],
  ])('%s 면 path 불일치로 잡힌다 (negative (a)(b)(c) — path drift, 404 예방)', async (_label, build) => {
    expect(diffContract(await fireSeed(), build())).toEqual([expect.stringContaining('path 불일치')]);
  });

  it.each<[string, string]>([
    ['(d) method 를 @Patch 로 드리프트', 'Patch'],
    ['(d) method 를 @Put 로 드리프트', 'Put'],
  ])('%s 하면 method 불일치로 잡힌다 (negative (d) — 405 예방)', async (_label, decorator) => {
    const drifted = extractHandlerMethods([`  @${decorator}("seed")`, '  async seed() {}'].join('\n')).seed;
    expect(diffContract(await fireSeed(), { ...SEED_CONTRACT, method: drifted.method })).toEqual([expect.stringContaining('method 불일치')]);
  });

  it.each<[string, (f: WebFire) => WebFire, (c: BackendContract) => BackendContract, string[]]>([
    // (e) backend 만 @Body 도입 — web 은 여전히 body 미발사 → 400(@IsNotEmpty) 이 될 회귀.
    ['(e) backend 가 @Body 를 도입', (f) => f, (c) => ({ ...c, hasBody: handlerHasBody('  async seed(@Body() dto: SeedDto) {}', 'seed') }), ['body 존재 정합 위반']],
    // (f) web 만 body 를 실음 — DTO 가 없는 route 라 whitelist 가 400 으로 거절할 회귀.
    ['(f) web 이 body 를 실음', (f) => ({ ...f, hasBody: true }), (c) => c, ['body 존재 정합 위반']],
    // (g) 헤더만 붙임 — payload 0 인데 Content-Type 만 남는 비대칭 발사.
    ['(g) web 이 Content-Type 헤더를 붙임', (f) => ({ ...f, contentType: 'application/json' }), (c) => c, ['Content-Type 헤더 부재 계약 위반']],
    ['(f)+(g) web 이 JSON body 와 헤더를 함께 붙임', (f) => ({ ...f, hasBody: true, contentType: 'application/json' }), (c) => c, ['body 존재 정합 위반', 'Content-Type 헤더 부재 계약 위반']],
  ])('%s 면 body/헤더 정합 위반으로 잡힌다 (negative (e)(f)(g) — 400 예방)', async (_label, mutateFire, mutateContract, expectedIssues) => {
    const issues = diffContract(mutateFire(await fireSeed()), mutateContract(SEED_CONTRACT));
    expect(issues).toEqual(expectedIssues.map((issue) => expect.stringContaining(issue)));
  });

  it('web 이 실제로 body 를 실으면(러너 인자 캡처 경로) 대조가 fail 한다 (negative (f) — 캡처 경로 자체 검증)', () => {
    const fire = toFire(SEED_PATH, { method: 'POST', body: JSON.stringify({ force: true }), headers: { 'Content-Type': 'application/json' } } as RequestOptions);
    expect(fire.hasBody).toBe(true);
    expect(diffContract(fire, SEED_CONTRACT)).toEqual([
      expect.stringContaining('body 존재 정합 위반'),
      expect.stringContaining('Content-Type 헤더 부재 계약 위반'),
    ]);
  });

  it('주석 줄의 @Post("seed")/@Controller(...) 를 실 decorator 로 오인하지 않는다 (negative (h) — 본 controller 는 1~60 행이 전부 주석)', async () => {
    const fakeController = ['  // @Controller("api/llm/difficulty-mappings") — 주석뿐', 'export class X {}'].join('\n');
    const fakeHandler = ['  // @Post("seed") — 주석뿐, decorator 없음', '  async seed() {}'].join('\n');
    expect(extractControllerRoute(fakeController)).toBeNull();
    expect(extractHandlerMethods(fakeHandler).seed).toBeUndefined();
    expect(stripComments(fakeHandler)).not.toContain('@Post'); // 주석 제거가 실제로 동작
    const drifted: BackendContract = { ...SEED_CONTRACT, route: extractControllerRoute(fakeController), method: extractHandlerMethods(fakeHandler).seed?.method ?? null };
    expect(diffContract(await fireSeed(), drifted)).toEqual(['backend 계약 추출 실패']);
  });

  it('빈 소스 입력이면 추출기가 null·빈 객체를 반환하고 대조가 통과하지 않는다 (error path — 소스 유실/추출 실패)', async () => {
    expect(extractControllerRoute('')).toBeNull();
    expect(extractHandlerMethods('')).toEqual({});
    expect(extractHandlerParams('', 'seed')).toBeNull();
    const empty: BackendContract = { route: extractControllerRoute(''), method: extractHandlerMethods('').seed?.method ?? null, subPath: '', hasBody: false };
    expect(diffContract(await fireSeed(), empty)).toEqual(['backend 계약 추출 실패']); // 조용한 통과 없음
  });
});
