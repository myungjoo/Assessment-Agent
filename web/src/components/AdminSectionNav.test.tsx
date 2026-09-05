import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import AdminSectionNav, {
  ADMIN_SECTION_NAV_ACTIVE_CLASS,
  ADMIN_SECTION_NAV_CLASS,
  ADMIN_SECTION_NAV_ITEM_CLASS,
  ADMIN_SECTION_NAV_LABEL,
  selectSection,
  type AdminSectionDescriptor,
} from './AdminSectionNav';

// R-112 — REQ-080(관리 화면 섹션 탭/구획 내비) presentational slice 검증.
// DashboardPeriodSelector.test.tsx 와 동일 패턴: jsdom·@testing-library 없이 react-dom/server 의
// renderToStaticMarkup 으로 정적 렌더 문자열만 검증해 dep 표면 증가를 0 으로 둔다. 이벤트가
// 발화되지 않으므로 콜백 계약은 순수 export 함수(selectSection) 를 직접 호출해 검증한다.
// 마지막 describe 는 globalCssContract.test.ts 관행대로 readFileSync 로 실 CSS 를 읽어
// className anchor 3 종이 selector 로 실재하는지 단방향 대조한다(CSS drift guard).
// 파일명은 .test.tsx 고정(root jest testRegex pickup 충돌 회피 — ADR-0041 Decision 3).

const sections: AdminSectionDescriptor[] = [
  { id: 'users', label: '사용자' },
  { id: 'groups', label: '그룹' },
  { id: 'schedule', label: '스케줄' },
];

const render = (props: Record<string, unknown> = {}) =>
  renderToStaticMarkup(<AdminSectionNav sections={sections} {...props} />);

/** 특정 label 을 가진 버튼의 여는 태그만 잘라낸다(속성 단위 검증용). */
function buttonTag(html: string, label: string): string {
  const end = html.indexOf(`>${label}</button>`);
  const start = html.lastIndexOf('<button', end);
  return html.slice(start, end + 1);
}

describe('AdminSectionNav 렌더', () => {
  it('descriptor 3 개와 활성 1 개에서 버튼 3 개를 렌더하고 활성 항목만 active className + aria-current 를 갖는다 (happy-path)', () => {
    const html = render({ activeId: 'groups' });
    expect(html).toContain(`<nav aria-label="${ADMIN_SECTION_NAV_LABEL}"`);
    expect(html).toContain(`class="${ADMIN_SECTION_NAV_CLASS}"`);
    expect((html.match(/<button /g) ?? []).length).toBe(sections.length);
    expect((html.match(/type="button"/g) ?? []).length).toBe(sections.length);
    sections.forEach((section) => expect(html).toContain(`>${section.label}</button>`));
    // 활성 표식은 정확히 1 개, 그리고 그 항목에만 붙는다.
    expect((html.match(/aria-current="true"/g) ?? []).length).toBe(1);
    expect((html.match(new RegExp(ADMIN_SECTION_NAV_ACTIVE_CLASS, 'g')) ?? []).length).toBe(1);
    expect(buttonTag(html, '그룹')).toContain(ADMIN_SECTION_NAV_ACTIVE_CLASS);
    expect(buttonTag(html, '그룹')).toContain('aria-current="true"');
    expect(buttonTag(html, '사용자')).not.toContain(ADMIN_SECTION_NAV_ACTIVE_CLASS);
    expect(buttonTag(html, '사용자')).not.toContain('aria-current');
  });

  it('sections 가 빈 배열이면 null 을 반환해 마크업이 0 이다 (error path — 빈 목록 / negative (a))', () => {
    const html = renderToStaticMarkup(<AdminSectionNav sections={[]} activeId="users" />);
    expect(html).toBe('');
    expect(html).not.toContain('<nav');
  });

  it('활성 / 비활성 항목의 className 이 분기된다 (branch (a) — active className)', () => {
    // className 조립은 내부 함수라 렌더 결과로만 검증한다(public 표면은 AC 고정 목록뿐).
    const html = render({ activeId: 'users' });
    expect(buttonTag(html, '사용자')).toContain(
      `class="${ADMIN_SECTION_NAV_ITEM_CLASS} ${ADMIN_SECTION_NAV_ACTIVE_CLASS}"`,
    );
    expect(buttonTag(html, '그룹')).toContain(`class="${ADMIN_SECTION_NAV_ITEM_CLASS}"`);
    expect(buttonTag(html, '그룹')).not.toContain(ADMIN_SECTION_NAV_ACTIVE_CLASS);
    // 비활성 항목도 item anchor 는 반드시 갖는다(스타일 누락 방지).
    sections.forEach((s) => expect(buttonTag(html, s.label)).toContain(ADMIN_SECTION_NAV_ITEM_CLASS));
  });

  it('activeId 미지정이면 활성 표식이 하나도 없고 목록은 그대로 렌더된다 (branch (b) — activeId undefined)', () => {
    const html = render();
    expect((html.match(/<button /g) ?? []).length).toBe(sections.length);
    expect(html).not.toContain('aria-current');
    expect(html).not.toContain(ADMIN_SECTION_NAV_ACTIVE_CLASS);
  });

  it('onSelect 유 / 무 어느 쪽이든 동일한 마크업을 throw 없이 렌더한다 (branch (c) — onSelect 유무)', () => {
    const withHandler = () => render({ activeId: 'users', onSelect: vi.fn() });
    const withoutHandler = () => render({ activeId: 'users' });
    expect(withHandler).not.toThrow();
    expect(withoutHandler).not.toThrow();
    expect(withHandler()).toBe(withoutHandler());
  });

  it('activeId 가 목록에 없는 값이면 활성 표시가 0 이다 (negative (b) — 목록 밖 activeId)', () => {
    const html = render({ activeId: '존재하지-않는-섹션' });
    expect(html).not.toContain('aria-current="true"');
    expect(html).not.toContain(ADMIN_SECTION_NAV_ACTIVE_CLASS);
    expect((html.match(/<button /g) ?? []).length).toBe(sections.length);
  });

  it('label 에 HTML 특수문자가 있어도 정적 렌더가 이스케이프한다 (negative (f) — 마크업 주입 0)', () => {
    const risky = [{ id: 'x', label: '<script>&"위험"' }];
    const html = renderToStaticMarkup(<AdminSectionNav sections={risky} activeId="x" />);
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
    expect(html).toContain('&amp;');
  });
});

describe('selectSection', () => {
  it('목록에 있는 새 id 를 고르면 onSelect 를 그 id 로 1 회 호출한다 (happy-path — 순수 함수)', () => {
    const onSelect = vi.fn();
    expect(selectSection(sections, 'users', 'groups', onSelect)).toBe(true);
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith('groups');
    // activeId 미지정 상태에서 첫 선택도 발화된다.
    expect(selectSection(sections, undefined, 'users', onSelect)).toBe(true);
    expect(onSelect).toHaveBeenCalledTimes(2);
  });

  it('onSelect 미전달이면 throw 없이 false 를 반환한다 (negative (c) — 콜백 미전달 안전성)', () => {
    expect(() => selectSection(sections, 'users', 'groups', undefined)).not.toThrow();
    expect(selectSection(sections, 'users', 'groups', undefined)).toBe(false);
  });

  it('목록에 없는 nextId 로 호출하면 발화하지 않는다 (negative (d) — 목록 밖 nextId)', () => {
    const onSelect = vi.fn();
    expect(selectSection(sections, 'users', '없는-id', onSelect)).toBe(false);
    expect(selectSection([], undefined, 'users', onSelect)).toBe(false);
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('이미 활성인 id 를 재선택하면 발화하지 않는다 (negative (e) — 동일 값 재통지 0)', () => {
    const onSelect = vi.fn();
    expect(selectSection(sections, 'groups', 'groups', onSelect)).toBe(false);
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('sections·nextId 에 비배열·비문자열이 주입돼도 throw 없이 false 다 (negative — 타입 오염 흡수)', () => {
    const onSelect = vi.fn();
    expect(() => selectSection(null, 'users', 'groups', onSelect)).not.toThrow();
    expect(selectSection(null, 'users', 'groups', onSelect)).toBe(false);
    expect(selectSection('문자열', 'users', 'groups', onSelect)).toBe(false);
    expect(selectSection([null, undefined], 'users', 'groups', onSelect)).toBe(false);
    expect(selectSection(sections, 'users', 3, onSelect)).toBe(false);
    expect(selectSection(sections, 'users', undefined, onSelect)).toBe(false);
    expect(onSelect).not.toHaveBeenCalled();
  });
});

describe('global.css anchor drift guard', () => {
  const css = readFileSync(new URL('../styles/global.css', import.meta.url), 'utf8');

  it('className 상수 3 종이 global.css 에 selector 로 실재한다 (drift guard — 상수 → CSS 단방향)', () => {
    const anchors = [ADMIN_SECTION_NAV_CLASS, ADMIN_SECTION_NAV_ITEM_CLASS, ADMIN_SECTION_NAV_ACTIVE_CLASS];
    anchors.forEach((className) => {
      // `.<class>` 뒤에 식별자 문자가 오면 더 긴 anchor 의 접두 매칭이므로 제외한다
      // (`.admin-section-nav` 가 `.admin-section-nav__item` 에 오인 매칭되지 않게).
      const selector = new RegExp(`\\.${className.replace(/[-]/g, '\\-')}(?![\\w-])[^{}]*\\{`);
      expect(selector.test(css), `${className} selector 누락`).toBe(true);
    });
  });

  it('추가 규칙이 신규 :root 토큰 선언 0 · 외부 @import 0 을 지킨다 (ADR-0061 D1 · D3)', () => {
    // anchor 블록 안의 var() 참조는 전부 기존 :root 선언 토큰이어야 한다.
    const block = css.slice(css.indexOf(`.${ADMIN_SECTION_NAV_CLASS}`));
    const referenced = [...block.matchAll(/var\((--[\w-]+)\)/g)].map((match) => match[1]);
    expect(referenced.length).toBeGreaterThan(0);
    referenced.forEach((token) => expect(css).toContain(`${token}:`));
    expect(block).not.toMatch(/^\s*--[\w-]+\s*:/m);
    // 규칙(at-rule) 로서의 @import 만 금지 — 파일 상단 주석의 서술 언급은 대상 아니다
    // (globalCssContract.test.ts 와 동일 판정).
    expect(css).not.toMatch(/^[ 	]*@import/m);
  });
});
