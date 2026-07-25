import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { RequestOptions } from '../api/apiClient';
import type { UpdatePartDeps } from './AdminView';
import { runUpdatePart } from './AdminView';
// 공용 invariant 추출기(T-1201 신설) import — inline 복사본 삭제·동작 무변경(T-1219 이관 slice, mutation stream part-update).
// 이 spec 이 참조하는 export 중 **공용과 글자-동일한 4종만** import(stripQuery/extractHandlerParams/pathSegments 제외 — 부재/미사용). richer
// extractHandlerMethods(hasBody·주석 상이)·HandlerDecorator·extractDtoFields·BackendContract/WebFire·pathParams·diffContract·toFire 는 inline 유지.
import {
  composeRoute,
  extractControllerRoute,
  normalizeRoute,
  stripComments,
} from './__contract-guard__/contract-extractors';

// R-112 — 파트 수정(PATCH /api/parts/:id) web↔backend **계약 drift guard**. 추출기/대조기 상세 주석은 선례
// person-update(T-1179, `@Patch(":id")` param 1 + encodeURIComponent + partial(required ∅)) · group-update
// (T-1176, name 단일 optional) · part-create(T-1181, `api/parts` base) 참조(정규식만 — 새 dep 0). 신규 축:
// `api/parts` base + `@Patch(":id")`(param 1) · name **단일 optional**(required ∅ → PATCH partial) ·
// PATCH body/헤더 ↔ `@Body` 정합. required ∅(partial) 를 명시 대조(required≠∅ → partial 위반).
interface HandlerDecorator {
  method: string;
  subPath: string;
  hasBody: boolean;
}
function extractHandlerMethods(source: string): Record<string, HandlerDecorator> {
  const found: Record<string, HandlerDecorator> = {};
  const lines = stripComments(source).split('\n');
  let pending: { method: string; subPath: string } | null = null;
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    const decorator = /^[ \t]*@(Get|Post|Put|Patch|Delete)\s*\(\s*(?:['"`]([^'"`]*)['"`]\s*)?\)/.exec(line);
    if (decorator) {
      pending = { method: decorator[1].toUpperCase(), subPath: decorator[2] ?? '' };
      continue;
    }
    if (/^[ \t]*@/.test(line)) {
      continue; // 그 외 decorator(@HttpCode/@UsePipes/@Param)는 handler 로 오인하지 않는다.
    }
    const handler = /^[ \t]*(?:public\s+|private\s+|protected\s+)?(?:async\s+)?([A-Za-z_$][\w$]*)\s*\(/.exec(line);
    if (handler && pending) {
      // 시그니처 여러 줄(예: `@Body` 가 다음 줄) 대비 — 본문 `{` 전까지 모아 @Body 존재를 본다.
      let signature = line;
      let j = i;
      while (!/\{/.test(signature) && j < lines.length - 1) {
        j += 1;
        signature += `\n${lines[j]}`;
      }
      found[handler[1]] = { method: pending.method, subPath: pending.subPath, hasBody: /@Body\b/.test(signature) };
      pending = null;
      i = j;
    }
  }
  return found;
}
interface DtoFields {
  required: Set<string>;
  optional: Set<string>;
}
function extractDtoFields(source: string, className: string): DtoFields {
  const body = new RegExp(`class\\s+${className}\\s*\\{([\\s\\S]*?)\\n\\}`).exec(stripComments(source));
  const required = new Set<string>();
  const optional = new Set<string>();
  if (!body) {
    return { required, optional };
  }
  for (const line of body[1].split('\n')) {
    if (/^[ \t]*@/.test(line)) {
      continue;
    }
    const field = /^[ \t]*(?:readonly\s+)?([A-Za-z_$][\w$]*)([!?]?)\s*[:=]/.exec(line);
    if (field) {
      (field[2] === '?' ? optional : required).add(field[1]);
    }
  }
  return { required, optional };
}
interface BackendContract {
  route: string | null;
  method: string | null;
  subPath: string;
  hasBody: boolean;
  required: Set<string>;
  optional: Set<string>;
}
interface WebFire {
  path: string;
  method: string;
  bodyKeys: Set<string>;
  hasBody: boolean;
  contentType: string | undefined;
}
const pathParams = (route: string): string[] => route.split('/').filter((seg) => seg.startsWith(':'));
function expectedPath(route: string, subPath: string, id: string): string { // `:id`→실 id(web 과 동일 encodeURIComponent)
  return composeRoute(route, subPath).replace(':id', encodeURIComponent(id));
}
// 불일치 사유 목록 — 빈 배열=계약 일치. 추출 실패도 통과가 아니라 사유 1건(선단언 방어). PATCH partial 이라
// required 집합은 ∅ 이어야 하며 ≠∅ 이면 partial 위반(name 을 required 로 승격한 drift 를 잡는 축).
function diffContract(fire: WebFire, backend: BackendContract, id: string): string[] {
  if (!backend.route || !backend.method || backend.required.size + backend.optional.size === 0) {
    return ['backend 계약 추출 실패'];
  }
  const issues: string[] = [];
  if (fire.path !== expectedPath(backend.route, backend.subPath, id)) {
    issues.push(`path 불일치: ${fire.path}`);
  }
  if (fire.method !== backend.method) {
    issues.push(`method 불일치: ${fire.method}`);
  }
  const declared = new Set([...backend.required, ...backend.optional]);
  const extras = [...fire.bodyKeys].filter((key) => !declared.has(key)).sort(); // fired ⊄ declared → 400
  if (extras.length > 0) {
    issues.push(`body 초과 키: ${extras.join(',')}`);
  }
  if (backend.required.size > 0) { // PATCH partial → required 집합은 ∅ 이어야 한다(≠∅ = @IsOptional 제거 drift)
    issues.push(`partial 위반: required=${[...backend.required].sort().join(',')}`);
  }
  if (fire.hasBody !== backend.hasBody) { // web body/Content-Type ↔ backend @Body 존재 정합
    issues.push(`body 존재 정합 위반: web=${fire.hasBody} backend=${backend.hasBody}`);
  }
  if (fire.hasBody && fire.contentType !== 'application/json') {
    issues.push(`Content-Type 부재/불일치: ${String(fire.contentType)}`);
  }
  return issues;
}
const CONTROLLER_SOURCE = readFileSync(new URL('../../../src/user/part.controller.ts', import.meta.url), 'utf8');
const DTO_SOURCE = readFileSync(new URL('../../../src/user/dto/update-part.dto.ts', import.meta.url), 'utf8');
const ROUTE = extractControllerRoute(CONTROLLER_SOURCE);
const DTO_FIELDS = extractDtoFields(DTO_SOURCE, 'UpdatePartDto');
const UPDATE_HANDLER = extractHandlerMethods(CONTROLLER_SOURCE).update ?? null;
const UPDATE_CONTRACT: BackendContract = {
  route: ROUTE,
  method: UPDATE_HANDLER?.method ?? null,
  subPath: UPDATE_HANDLER?.subPath ?? '',
  hasBody: UPDATE_HANDLER?.hasBody ?? false,
  required: DTO_FIELDS.required,
  optional: DTO_FIELDS.optional,
};
const PART_ID = 'pt-1';
const HAPPY_NAME = '개발팀';
const ORIGINAL_NAME = '기존파트'; // 변경된 name 이어야 러너가 발사(미변경 name 은 미발사 가드)
// options.body 부재/null 은 SyntaxError 대신 빈 키 집합 + hasBody=false 매핑(러너 발사 인자 캡처, ADR-0040 §5).
function toFire(path: string, options: RequestOptions): WebFire {
  const bodyKeys = new Set<string>();
  const hasBody = options.body !== undefined && options.body !== null;
  if (hasBody) {
    for (const key of Object.keys(JSON.parse(String(options.body)) as Record<string, unknown>)) {
      bodyKeys.add(key);
    }
  }
  const headers = (options.headers ?? {}) as Record<string, string>;
  return { path, method: String(options.method), bodyKeys, hasBody, contentType: headers['Content-Type'] };
}
async function fireUpdatePart(id: string, name: string = HAPPY_NAME): Promise<WebFire> {
  let fired: WebFire | undefined;
  const deps: UpdatePartDeps = {
    update: async (path, options) => {
      fired = toFire(path, options);
      return undefined;
    },
    describeError: () => '',
    isConflict: () => false,
    updating: false,
    setUpdating: () => {},
    setUpdateError: () => {},
    bumpRefresh: () => {},
    closeEdit: () => {},
  };
  await runUpdatePart(id, name, ORIGINAL_NAME, deps);
  if (!fired) {
    throw new Error('파트 수정 러너가 발사하지 않았다');
  }
  return fired;
}
describe('AdminView — 파트 수정 web↔backend 계약 drift guard (T-1182)', () => {
  it('backend route/method/DTO 추출이 하나도 비어있지 않다 (error path — 추출기 무력화 방어)', () => {
    expect(ROUTE).not.toBeNull();
    expect(ROUTE).not.toBe('');
    expect(UPDATE_CONTRACT.method).not.toBeNull();
    expect(DTO_FIELDS.required.size + DTO_FIELDS.optional.size).toBeGreaterThan(0); // required ∅ 라 declared 총합으로 방어
  });
  it('backend @Controller("api/parts") base route 를 /api/parts 로 정규화한다 (분기 — 파트 base 파싱)', () => {
    expect(ROUTE).toBe('api/parts');
    expect(normalizeRoute(String(ROUTE))).toBe('/api/parts');
  });
  it('backend @Patch(":id") 세그먼트를 api/parts base 와 합성해 path param 1개(:id) template 을 만든다 (분기 — :id 첫 결합)', () => {
    expect(UPDATE_CONTRACT.method).toBe('PATCH');
    expect(UPDATE_CONTRACT.subPath).toBe(':id');
    const composed = composeRoute(String(ROUTE), UPDATE_CONTRACT.subPath);
    expect(composed).toBe('/api/parts/:id');
    expect(pathParams(composed)).toEqual([':id']); // path param 정확히 1개
    expect(expectedPath(String(ROUTE), UPDATE_CONTRACT.subPath, PART_ID)).toBe('/api/parts/pt-1');
  });
  it('파트 수정 발사(PATCH /api/parts/:id)가 backend update 계약과 완전 일치한다 (happy-path)', async () => {
    expect(diffContract(await fireUpdatePart(PART_ID), UPDATE_CONTRACT, PART_ID)).toEqual([]);
  });
  it('web 러너가 id 를 encodeURIComponent 로 안전 인코딩해 path 세그먼트에 넣는다 (분기 — path 인코딩, 비정상 문자)', async () => {
    const weirdId = 'pt 1/x?a';
    const fired = await fireUpdatePart(weirdId);
    expect(fired.path).toBe(`/api/parts/${encodeURIComponent(weirdId)}`);
    expect(fired.path).toBe('/api/parts/pt%201%2Fx%3Fa'); // 공백·/·? 가 모두 인코딩돼 path 가 안 깨진다
    expect(diffContract(fired, UPDATE_CONTRACT, weirdId)).toEqual([]);
  });
  it('발사 body 키가 declared 부분집합을 만족한다(초과 0 · required ∅ 누락 0, name 단일) (happy-path — allowed 부분집합)', async () => {
    const fired = await fireUpdatePart(PART_ID);
    const declared = new Set([...DTO_FIELDS.required, ...DTO_FIELDS.optional]);
    expect([...fired.bodyKeys].every((key) => declared.has(key))).toBe(true);
    expect([...DTO_FIELDS.required].every((key) => fired.bodyKeys.has(key))).toBe(true); // required ∅ → vacuous true
    expect([...fired.bodyKeys].sort()).toEqual(['name']);
  });
  it('PATCH 발사에 JSON body 와 Content-Type: application/json 헤더가 존재하고 backend @Body 와 정합한다 (분기 — body/헤더 존재 대조)', async () => {
    const fired = await fireUpdatePart(PART_ID);
    expect(fired.method).toBe('PATCH');
    expect(fired.hasBody).toBe(true);
    expect(fired.contentType).toBe('application/json');
    expect(fired.hasBody).toBe(UPDATE_CONTRACT.hasBody);
  });
  it('extractDtoFields 가 name 을 단일 optional(required ∅)로 분류한다 (분기 — 단일 optional 추출, partial)', () => {
    expect([...DTO_FIELDS.optional].sort()).toEqual(['name']);
    expect(DTO_FIELDS.required.size).toBe(0); // PATCH partial — required 공집합
    const promoted = extractDtoFields(['export class PromotedDto {', '  name!: string;', '}'].join('\n'), 'PromotedDto');
    expect([...promoted.required].sort()).toEqual(['name']); // `x!` 승격 표기는 required
    expect(promoted.optional.size).toBe(0);
  });
  it('backend update 핸들러가 @Body decorator 있는 body-요구 핸들러임을 추출한다 (분기 — @Body 존재 추출)', () => {
    expect(UPDATE_CONTRACT.hasBody).toBe(true);
    const bodyless = extractHandlerMethods(['  @Patch(":id")', '  async update(@Param("id") id: string) {}'].join('\n')).update;
    expect(bodyless).toEqual({ method: 'PATCH', subPath: ':id', hasBody: false });
  });
  it('options.body 부재면 JSON.parse SyntaxError 없이 빈 키 집합 + hasBody=false 로 매핑된다 (분기 — body 부재)', () => {
    const fire = toFire('/api/parts/pt-1', { method: 'PATCH' } as RequestOptions);
    expect(fire.bodyKeys.size).toBe(0);
    expect(fire.hasBody).toBe(false);
  });
  it.each<[string, () => BackendContract]>([ // Negative (a) base 오타 · (b) param 제거(세그먼트 0) → path 불일치
    ['(a) backend base 를 api/part(오타)로', () => ({ ...UPDATE_CONTRACT, route: 'api/part' })],
    ["(a') backend base 를 api/parties 로", () => ({ ...UPDATE_CONTRACT, route: 'api/parties' })],
    ['(b) @Patch(":id") 를 bare @Patch()(param 제거, 세그먼트 0)로', () => ({ ...UPDATE_CONTRACT, subPath: extractHandlerMethods(['  @Patch()', '  async update() {}'].join('\n')).update.subPath })],
  ])('%s 면 path 불일치로 잡힌다 (negative — path drift, 404 예방)', async (_label, build) => {
    expect(diffContract(await fireUpdatePart(PART_ID), build(), PART_ID)).toEqual([expect.stringContaining('path 불일치')]);
  });
  it('backend 가 method 를 @Post/@Delete 로 바꿨는데 web 은 PATCH 발사 → method 불일치로 잡힌다 (negative (c) — method drift)', async () => {
    const fired = await fireUpdatePart(PART_ID);
    for (const src of ['  @Post(":id")', '  @Delete(":id")']) {
      const handler = extractHandlerMethods([src, '  async update(@Body() d: any) {}'].join('\n')).update;
      const drifted: BackendContract = { ...UPDATE_CONTRACT, method: handler.method };
      expect(diffContract(fired, drifted, PART_ID)).toEqual([expect.stringContaining('method 불일치')]);
    }
  });
  it('backend 가 name 을 required 로 바꾸면(@IsOptional 제거) required 집합 ≠ ∅ 로 partial 대조가 fail 한다 (negative (d) — partial drift)', async () => {
    const drifted: BackendContract = { ...UPDATE_CONTRACT, required: new Set(['name']), optional: new Set<string>() };
    expect(diffContract(await fireUpdatePart(PART_ID), drifted, PART_ID)).toEqual([expect.stringContaining('partial 위반')]);
  });
  it('web 이 backend 미허용(whitelist 밖) 필드 code 를 body 에 담으면 allowed 초과로 잡힌다 (negative (e) — 400 예방)', async () => {
    const fired = await fireUpdatePart(PART_ID);
    const mutated: WebFire = { ...fired, bodyKeys: new Set([...fired.bodyKeys, 'code']) };
    expect(diffContract(mutated, UPDATE_CONTRACT, PART_ID)).toEqual([expect.stringContaining('body 초과 키')]);
  });
  it('backend 가 @Body decorator 를 제거(body-less)했는데 web 은 body 발사 → body 존재 정합 위반으로 잡힌다 (negative (f) — @Body 제거 drift)', async () => {
    const drifted: BackendContract = { ...UPDATE_CONTRACT, hasBody: false };
    expect(diffContract(await fireUpdatePart(PART_ID), drifted, PART_ID)).toEqual([expect.stringContaining('body 존재 정합 위반')]);
  });
  it('web 이 Content-Type 헤더를 빼고 body 만 발사하면 Content-Type 존재 대조가 fail 한다 (negative (g) — 헤더 누락 → 400/415)', () => {
    const fire = toFire('/api/parts/pt-1', { method: 'PATCH', body: JSON.stringify({ name: '개발팀' }) } as RequestOptions);
    expect(diffContract(fire, UPDATE_CONTRACT, PART_ID)).toEqual([expect.stringContaining('Content-Type 부재/불일치')]);
  });
  it('주석 줄의 "@Patch(":id")"/"@Controller(...)" 를 실 decorator 로 오인하지 않는다 (negative (h) — 주석 false-positive)', async () => {
    const fakeController = ['  // @Controller("api/parts") — 주석뿐', 'export class X {}'].join('\n');
    const fakeHandler = ['  // @Patch(":id") — 주석뿐, decorator 없음', '  async update() {}'].join('\n');
    expect(extractControllerRoute(fakeController)).toBeNull();
    expect(extractHandlerMethods(fakeHandler).update).toBeUndefined();
    const drifted: BackendContract = {
      ...UPDATE_CONTRACT,
      route: extractControllerRoute(fakeController),
      method: extractHandlerMethods(fakeHandler).update?.method ?? null,
    };
    expect(diffContract(await fireUpdatePart(PART_ID), drifted, PART_ID)).toEqual(['backend 계약 추출 실패']);
  });
  it('빈 소스 입력이면 추출기가 null·빈 집합을 반환하고 대조가 통과하지 않는다 (negative — 소스 유실)', async () => {
    expect(extractControllerRoute('')).toBeNull();
    expect(extractHandlerMethods('')).toEqual({});
    const emptyFields = extractDtoFields('', 'UpdatePartDto');
    const empty: BackendContract = {
      route: extractControllerRoute(''),
      method: extractHandlerMethods('').update?.method ?? null,
      subPath: '',
      hasBody: false,
      required: emptyFields.required,
      optional: emptyFields.optional,
    };
    expect(diffContract(await fireUpdatePart(PART_ID), empty, PART_ID)).toEqual(['backend 계약 추출 실패']);
  });
});
