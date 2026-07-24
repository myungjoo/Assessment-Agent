import { describe, expect, it } from 'vitest';
import {
  composeRoute,
  extractControllerRoute,
  extractHandlerMethods,
  extractHandlerParams,
  normalizeRoute,
  pathSegments,
  stripComments,
  stripQuery,
} from './contract-extractors';

// T-1201 — contract-guard 공용 추출기 8종의 포괄 colocated 단위 test.
// 30+ contract-guard spec 이 복사해 쓰던 invariant 추출기를 helper 로 신설한 뒤, 그 정확성을
// 단일 지점에서 R-112 4종(happy/error/flow-branch/negative-충분)으로 고정한다. 이관 slice 는 후속.

// @Get("me")/@Post("login") 형제 + 비-HTTP decorator + 인자 有/無 handler 를 모두 담은 합성 소스.
const SRC = [
  '@Controller("api/x")',
  'export class XController {',
  '  @Get("me")',
  '  me() {}',
  '  @Post("login")',
  '  login(@Body() dto: LoginDto) {}',
  '  @Get()',
  '  list() {}',
  '  @UseGuards(AuthGuard)',
  '  @HttpCode(200)',
  '  @Roles("admin")',
  '  @Delete(":id")',
  '  remove(@Param("id") id: string) {}',
  '  @Patch(":id")',
  '  update(@Param("id") id: string, @Body() dto: Rec<(x: number) => void>) {}',
  '  helper() {}', // decorator 없는 순수 메서드 — handler 로 잡히되 pending 없어 매핑 제외.
  '}',
].join('\n');

describe('stripComments', () => {
  it('happy: 블록 주석과 줄 주석을 모두 제거한다', () => {
    const src = ['/* @Get("ghost") */', '// @Post("phantom")', 'const real = 1;'].join('\n');
    const out = stripComments(src);
    expect(out).not.toContain('ghost');
    expect(out).not.toContain('phantom');
    expect(out).toContain('const real = 1;');
  });

  it('negative (a): 주석 줄이 없으면 원본 라인은 그대로 보존한다', () => {
    expect(stripComments('plain line')).toBe('plain line');
  });
});

describe('extractControllerRoute', () => {
  it('happy: @Controller("api/x") 에서 base 를 추출한다', () => {
    expect(extractControllerRoute(SRC)).toBe('api/x');
  });

  it('error: 빈 입력이면 null (falsy 통과로 오인 안 함)', () => {
    expect(extractControllerRoute('')).toBeNull();
  });

  it('negative (a): 주석 속 @Controller 를 실 decorator 로 오인하지 않는다', () => {
    const commented = [
      '// @Controller("api/fake")',
      '/* @Controller("api/ghost") */',
      '@Controller("api/real")',
    ].join('\n');
    expect(extractControllerRoute(commented)).toBe('api/real');
  });
});

describe('extractHandlerMethods', () => {
  it('happy: @Get("me") 핸들러를 {method:GET, subPath:me} 로 매핑한다', () => {
    expect(extractHandlerMethods(SRC).me).toEqual({ method: 'GET', subPath: 'me' });
  });

  it('flow: bare @Get() 는 subPath 빈 문자열로 매핑한다', () => {
    expect(extractHandlerMethods(SRC).list).toEqual({ method: 'GET', subPath: '' });
  });

  it('error: 빈 입력이면 빈 객체를 반환한다', () => {
    expect(extractHandlerMethods('')).toEqual({});
  });

  it('negative (b): 비-HTTP decorator(@UseGuards/@HttpCode/@Roles)를 handler 로 오인하지 않는다', () => {
    const methods = extractHandlerMethods(SRC);
    // remove 는 @Delete(":id") 로 매핑되고, 그 위 @UseGuards/@HttpCode/@Roles 에 오염되지 않는다.
    expect(methods.remove).toEqual({ method: 'DELETE', subPath: ':id' });
  });

  it('negative (c): 형제 @Get("me")/@Post("login") 을 method+subPath 로 구분 매핑한다', () => {
    const methods = extractHandlerMethods(SRC);
    expect(methods.me.method).toBe('GET');
    expect(methods.login).toEqual({ method: 'POST', subPath: 'login' });
  });

  it('flow: decorator 없는 순수 메서드(pending null)는 매핑에서 제외한다', () => {
    expect(extractHandlerMethods(SRC).helper).toBeUndefined();
  });
});

describe('extractHandlerParams', () => {
  it('happy: handler 서명(@Body)을 슬라이스 반환한다', () => {
    expect(extractHandlerParams(SRC, 'login')).toBe('@Body() dto: LoginDto');
  });

  it('flow: 인자 0 handler 는 빈 문자열을 반환한다', () => {
    expect(extractHandlerParams(SRC, 'list')).toBe('');
  });

  it('error: 빈 입력이면 null', () => {
    expect(extractHandlerParams('', 'foo')).toBeNull();
  });

  it('error: 없는 핸들러명이면 null', () => {
    expect(extractHandlerParams(SRC, 'noSuchHandler')).toBeNull();
  });

  it('negative (d): 서명 안 중첩 괄호/제네릭이 있어도 닫는 괄호까지 정확 슬라이스한다', () => {
    expect(extractHandlerParams(SRC, 'update')).toBe(
      '@Param("id") id: string, @Body() dto: Rec<(x: number) => void>',
    );
  });

  it('branch: 닫는 괄호가 없는 미종결 서명이면 null(조기 종료 안 함)', () => {
    expect(extractHandlerParams('  bad(@Body() dto: T', 'bad')).toBeNull();
  });
});

describe('normalizeRoute', () => {
  it('branch: leading-slash 有 는 그대로 둔다', () => {
    expect(normalizeRoute('/api/x')).toBe('/api/x');
  });

  it('branch: leading-slash 無 는 슬래시를 부여한다', () => {
    expect(normalizeRoute('api/x')).toBe('/api/x');
  });
});

describe('composeRoute', () => {
  it('happy/branch: subPath 有 → /base/sub', () => {
    expect(composeRoute('api/x', 'me')).toBe('/api/x/me');
  });

  it('branch: subPath 無 → /base', () => {
    expect(composeRoute('api/x', '')).toBe('/api/x');
  });

  it('flow: subPath 의 leading-slash 는 중복 없이 정규화한다', () => {
    expect(composeRoute('api/x', '/me')).toBe('/api/x/me');
  });
});

describe('pathSegments', () => {
  it('happy: 경로를 세그먼트 배열로 분해한다(빈 세그먼트 제거)', () => {
    expect(pathSegments('/a/b')).toEqual(['a', 'b']);
  });

  it('error: 빈 문자열이면 빈 배열', () => {
    expect(pathSegments('')).toEqual([]);
  });
});

describe('stripQuery', () => {
  it('happy: ?_r cache-buster 를 제거한다', () => {
    expect(stripQuery('/p?_r=3')).toBe('/p');
  });

  it('negative (e): query 가 없으면 원본 그대로', () => {
    expect(stripQuery('/p')).toBe('/p');
  });

  it('negative (e): 다중 query param 도 base 만 남긴다', () => {
    expect(stripQuery('/p?a=1&b=2')).toBe('/p');
  });
});
