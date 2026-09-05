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

// R-112 — T-1907(수집 대상 패널 분해 1/2) presentational slice 검증. AdminSectionNav.test.tsx 와
// 같은 관례로 jsdom·@testing-library 없이 renderToStaticMarkup 정적 렌더 문자열만 본다(dep 0).
// 이벤트 발화 계약은 이 껍데기의 책임이 아니라 CollectionTargetList 의 기존 spec 소관이므로,
// 여기서는 "콜백 유무에 따라 컨트롤이 렌더되는가"라는 통과 계약만 마크업으로 검증한다.

const rows: CollectionTargetRow[] = [
  { id: 't1', type: 'GITHUB', instanceKey: 'gh-main', endpoint: 'https://gh.example', orgs: ['acme'] },
];

const baseProps: AdminCollectionTargetsSectionProps = { targets: rows };

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

  it('children 을 목록 뒤 슬롯에 통과시키고, 미전달이어도 정상 렌더한다 (branch (c) / negative (c))', () => {
    const html = render({ children: <p>등록 폼 자리</p> });
    expect(html).toContain('<p>등록 폼 자리</p>');
    expect(html.indexOf('등록 폼 자리')).toBeGreaterThan(html.indexOf('</ul>'));
    const noChildren = render();
    expect(noChildren).not.toContain('<p>');
    expect(noChildren).toContain(`id="${ADMIN_SECTION_COLLECTION_TARGETS_ID}"`);
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
