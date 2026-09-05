import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import AdminCollectionTargetsSection, {
  type AdminCollectionTargetsSectionProps,
} from './AdminCollectionTargetsSection';
import type { CollectionTargetRow } from '../components/CollectionTargetList';
import {
  ADMIN_SECTION_COLLECTION_TARGETS_ID,
  COLLECTION_TARGET_HEADING,
  EMPTY_COLLECTION_TARGET_TEXT,
} from './adminViewConstants';

// R-112 — T-1907+T-1908(수집 대상 패널 분해 1/2 · 2/2) presentational slice 검증. AdminSectionNav.test.tsx 와
// 같은 관례로 jsdom·@testing-library 없이 renderToStaticMarkup 정적 렌더 문자열만 본다(dep 0).
// 이벤트 발화 계약은 이 껍데기의 책임이 아니라 CollectionTargetList 의 기존 spec 소관이므로,
// 여기서는 "콜백 유무에 따라 컨트롤이 렌더되는가"라는 통과 계약만 마크업으로 검증한다.

const rows: CollectionTargetRow[] = [
  { id: 't1', type: 'GITHUB', instanceKey: 'gh-main', endpoint: 'https://gh.example', orgs: ['acme'] },
];

// 등록 폼 축의 값 · 변경 콜백은 필수 prop 이라 기본값을 여기서 한 번만 고정한다(빈 문자열은
// "입력 전" 상태 — 폼이 렌더되더라도 submit 은 차단된 채로 나온다).
const baseProps: AdminCollectionTargetsSectionProps = {
  targets: rows,
  createType: 'GITHUB',
  createInstanceKey: 'gh-main',
  createEndpoint: 'https://gh.example',
  onCreateTypeChange: () => {},
  onCreateInstanceKeyChange: () => {},
  onCreateEndpointChange: () => {},
};

const render = (props: Partial<AdminCollectionTargetsSectionProps> = {}) =>
  renderToStaticMarkup(<AdminCollectionTargetsSection {...baseProps} {...props} />);

describe('AdminCollectionTargetsSection 렌더', () => {
  it('섹션 id·aria-label·heading 과 전달한 row 문구를 함께 렌더한다 (happy-path)', () => {
    const html = render({
      onDelete: () => {},
      onToggleActive: () => {},
      onEditStart: () => {},
    });
    expect(html).toContain(`id="${ADMIN_SECTION_COLLECTION_TARGETS_ID}"`);
    expect(html).toContain(`aria-label="${COLLECTION_TARGET_HEADING}"`);
    expect(html).toContain(`<h2>${COLLECTION_TARGET_HEADING}</h2>`);
    expect(html).toContain('gh-main');
    expect(html).toContain('https://gh.example');
    expect(html).toContain('acme');
    // 섹션은 정확히 1 개이고 목록이 그 안에 있다(껍데기 중첩 0).
    expect((html.match(/<section /g) ?? []).length).toBe(1);
    expect(html.indexOf('<ul>')).toBeGreaterThan(html.indexOf('<h2>'));
  });

  it('error 가 있으면 오류 표면만 렌더하고 목록 본체는 나오지 않는다 (error path)', () => {
    const html = render({ error: '수집 대상을 불러오지 못했습니다' });
    expect(html).toContain('<div role="alert">수집 대상을 불러오지 못했습니다</div>');
    expect(html).not.toContain('<ul>');
    expect(html).not.toContain('gh-main');
    // 껍데기는 그대로 살아 있어 섹션 anchor 가 사라지지 않는다.
    expect(html).toContain(`id="${ADMIN_SECTION_COLLECTION_TARGETS_ID}"`);
  });

  it('loading true 면 로딩 표시만, false 면 목록이 나온다 (branch (a))', () => {
    const loadingHtml = render({ loading: true });
    expect(loadingHtml).toContain('<div role="status">불러오는 중…</div>');
    expect(loadingHtml).not.toContain('gh-main');
    expect(render({ loading: false })).toContain('gh-main');
  });

  it('targets 가 비면 빈 상태 문구를, 1+ 이면 행을 렌더한다 (branch (b) / negative (b))', () => {
    const emptyHtml = render({ targets: [] });
    expect(emptyHtml).toContain(EMPTY_COLLECTION_TARGET_TEXT);
    expect(emptyHtml).not.toContain('<ul>');
    expect(emptyHtml).toContain(`<h2>${COLLECTION_TARGET_HEADING}</h2>`);
    expect(render()).toContain('<ul>');
  });

  it('오류 3 종·등록 폼을 목록 뒤에 선언 순서대로 렌더한다 (happy-path — children 슬롯 대체)', () => {
    const html = render({
      deleteError: '삭제 실패',
      toggleError: '토글 실패',
      updateError: '저장 실패',
      onCreateSubmit: () => {},
    });
    // 목록 → 삭제 → 토글 → 편집 저장 → 등록 폼 순서가 이동 전 AdminView JSX 와 같다.
    const order = ['</ul>', '삭제 실패', '토글 실패', '저장 실패', '<form'].map(
      (needle) => html.indexOf(needle),
    );
    order.forEach((index) => expect(index).toBeGreaterThan(-1));
    expect(order).toEqual([...order].sort((a, b) => a - b));
  });

  it('목록 error 와 오류 alert 3 종이 동시에 와도 각 표면이 자기 자리에 렌더된다 (error path)', () => {
    const html = render({
      error: '목록 실패',
      deleteError: '삭제 실패',
      toggleError: '토글 실패',
      updateError: '저장 실패',
      onCreateSubmit: () => {},
    });
    expect((html.match(/role="alert"/g) ?? []).length).toBe(4);
    expect(html.indexOf('목록 실패')).toBeLessThan(html.indexOf('삭제 실패'));
    expect(html).toContain('<form');
  });

  it('deleteError·toggleError·updateError 는 각각 유/무로 독립 렌더된다 (branch (a)(b)(c) / negative (b))', () => {
    expect(render({ deleteError: '삭제 실패' })).toContain(
      '<div role="alert">삭제 실패</div>',
    );
    expect(render({ toggleError: '토글 실패' })).toContain(
      '<div role="alert">토글 실패</div>',
    );
    expect(render({ updateError: '저장 실패' })).toContain(
      '<div role="alert">저장 실패</div>',
    );
    // 셋이 동시에 truthy 여도 서로 자리를 뺏지 않는다(같은 alert 공유 금지 회귀 차단).
    const all = render({
      deleteError: '삭제 실패',
      toggleError: '토글 실패',
      updateError: '저장 실패',
    });
    expect((all.match(/role="alert"/g) ?? []).length).toBe(3);
    // 하나만 준 경우 나머지 둘은 미렌더다(빈 alert 를 남기지 않는다).
    expect(render({ deleteError: '삭제 실패' })).not.toContain('토글 실패');
  });

  it('onCreateSubmit 이 있으면 등록 폼이, 없으면 폼과 createError 가 모두 미렌더다 (branch (d) / negative (c))', () => {
    const withForm = render({ onCreateSubmit: () => {}, createError: '등록 실패' });
    expect(withForm).toContain('<form');
    expect(withForm).toContain('등록 실패');
    // 콜백 미전달(비-Admin 경로) — 폼이 없으므로 그 안의 createError 문구도 노출되지 않는다.
    const noForm = render({ createError: '등록 실패' });
    expect(noForm).not.toContain('<form');
    expect(noForm).not.toContain('등록 실패');
  });

  it('오류 3 종·onCreateSubmit 이 모두 undefined 면 alert·폼 컨트롤이 0 개다 (negative (a) — 비-Admin 경로)', () => {
    const html = render();
    expect(html).not.toContain('role="alert"');
    expect(html).not.toContain('<form');
    expect(html).not.toContain('<select');
    expect(html).toContain('gh-main');
  });

  it('등록 입력값이 빈 문자열이어도 throw 없이 렌더되고 submit 이 차단된다 (negative (d))', () => {
    const html = render({
      createType: '',
      createInstanceKey: '',
      createEndpoint: '',
      onCreateSubmit: () => {},
    });
    expect(html).toContain('<form');
    expect(html).toContain('<button type="submit" disabled=""');
  });

  it('editingId 가 행과 일치하면 인라인 편집 입력이 뜨고, 없으면 뜨지 않는다 (branch (d))', () => {
    const editing = render({ editingId: 't1', editEndpoint: 'https://new.example' });
    expect(editing).toContain('aria-label="endpoint 수정"');
    expect(editing).toContain('value="https://new.example"');
    expect(render()).not.toContain('aria-label="endpoint 수정"');
  });

  it('편집 콜백을 모두 미전달하면 삭제·토글·편집 컨트롤이 하나도 렌더되지 않는다 (negative (a) — 비-Admin 경로)', () => {
    const html = render();
    expect(html).not.toContain('<button');
    ['삭제', '비활성화', '활성화', '편집', '저장'].forEach((label) =>
      expect(html).not.toContain(`>${label}</button>`),
    );
    // 목록 본체(읽기 축)는 gating 바깥이라 그대로 보인다.
    expect(html).toContain('gh-main');
  });

  it('row 의 endpoint 가 누락돼도 throw 없이 placeholder 로 렌더한다 (negative (d))', () => {
    const broken = [{ id: 't2', type: 'CONFLUENCE', instanceKey: 'cf' }] as unknown as CollectionTargetRow[];
    const html = render({ targets: broken });
    expect(html).toContain('(없음)');
    expect(html).toContain('cf');
  });
});
