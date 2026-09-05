import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import AdminGroupsSection, {
  type AdminGroupsSectionProps,
} from './AdminGroupsSection';
import type { GroupRow } from '../components/GroupList';
import { ADMIN_SECTION_GROUPS_ID, GROUP_HEADING } from './adminViewConstants';

// R-112 — T-1909(그룹 패널 분해 1/2) presentational slice 검증. AdminCollectionTargetsSection.test.tsx
// 와 같은 관례로 jsdom·@testing-library 없이 renderToStaticMarkup 정적 렌더 문자열만 본다(dep 0).
// 이벤트 발화 계약은 이 껍데기 책임이 아니라 GroupList 기존 spec 소관이므로, 여기서는 "props 를
// 그대로 통과시키는가 · children 이 목록 앞에 오는가"라는 통과 계약만 마크업으로 검증한다.

const rows: GroupRow[] = [{ id: 'g1', name: '백엔드팀', members: [{}, {}] }];

const baseProps: AdminGroupsSectionProps = { groups: rows };

const render = (props: Partial<AdminGroupsSectionProps> = {}) =>
  renderToStaticMarkup(<AdminGroupsSection {...baseProps} {...props} />);

describe('AdminGroupsSection 렌더', () => {
  it('섹션 id·aria-label·heading 과 전달한 group row 문구를 함께 렌더한다 (happy-path)', () => {
    const html = render({ onDelete: () => {}, onEdit: () => {} });
    expect(html).toContain(`id="${ADMIN_SECTION_GROUPS_ID}"`);
    expect(html).toContain('id="admin-section-groups"');
    expect(html).toContain(`aria-label="${GROUP_HEADING}"`);
    expect(html).toContain('<h2>그룹 관리</h2>');
    expect(html).toContain('백엔드팀');
    expect(html).toContain('멤버 2명');
    // 섹션은 정확히 1 개이고 목록이 heading 뒤에 있다(껍데기 중첩 0).
    expect((html.match(/<section /g) ?? []).length).toBe(1);
    expect(html.indexOf('<ul>')).toBeGreaterThan(html.indexOf('<h2>'));
  });

  it('error 가 있으면 오류 표면만 렌더하고 목록 본체는 나오지 않는다 (error path)', () => {
    const html = render({ error: '그룹을 불러오지 못했습니다' });
    expect(html).toContain('<div role="alert">그룹을 불러오지 못했습니다</div>');
    expect(html).not.toContain('<ul>');
    expect(html).not.toContain('백엔드팀');
    // 껍데기는 그대로 살아 있어 섹션 anchor 가 사라지지 않는다.
    expect(html).toContain(`id="${ADMIN_SECTION_GROUPS_ID}"`);
  });

  it('loading true 면 로딩 표시가 목록·오류보다 우선한다 (분기 a — loading 충돌 입력 negative 포함)', () => {
    const html = render({ loading: true, error: '무시되어야 하는 오류' });
    expect(html).toContain('role="status"');
    expect(html).toContain('불러오는 중');
    expect(html).not.toContain('무시되어야 하는 오류');
    expect(html).not.toContain('<ul>');
    // loading false 면 목록이 정상 렌더된다(같은 분기의 반대편).
    expect(render({ loading: false })).toContain('<ul>');
  });

  it('groups 가 빈 배열이면 기본 empty 문구로 안전 렌더한다 (분기 b · negative)', () => {
    const html = render({ groups: [] });
    expect(html).toContain('등록된 그룹이 없습니다');
    expect(html).not.toContain('<ul>');
    expect(html).toContain('<h2>그룹 관리</h2>');
  });

  it('children 미전달이면 빈 자식으로도 정상 렌더된다 (분기 c · negative)', () => {
    const html = render();
    expect(html).toContain('<h2>그룹 관리</h2>');
    expect(html).toContain('백엔드팀');
    expect(html).not.toContain('생성폼마커');
  });

  it('onDelete·onEdit 미전달이면 행 버튼이 하나도 렌더되지 않는다 (분기 d · 읽기 전용 negative)', () => {
    const readonly = render();
    expect(readonly).not.toContain('<button');
    expect(readonly).toContain('백엔드팀');
    // 콜백을 주면 수정·삭제 버튼이 함께 렌더된다(같은 분기의 반대편).
    const writable = render({ onDelete: () => {}, onEdit: () => {} });
    expect(writable).toContain('>수정</button>');
    expect(writable).toContain('>삭제</button>');
  });

  it('row 의 id 가 없어도 throw 없이 렌더하고 행 버튼만 생략한다 (negative — id 누락)', () => {
    const call = () =>
      render({ groups: [{ name: '이름만' }], onDelete: () => {}, onEdit: () => {} });
    expect(call).not.toThrow();
    const html = call();
    expect(html).toContain('이름만');
    expect(html).not.toContain('<button');
  });

  it('children 은 <h2> 뒤 · GroupList 앞에 렌더된다 (JSX 순서 회귀 방어)', () => {
    const html = render({ children: <p>생성폼마커</p> });
    const headingAt = html.indexOf('<h2>');
    const childAt = html.indexOf('생성폼마커');
    const listAt = html.indexOf('<ul>');
    expect(headingAt).toBeGreaterThanOrEqual(0);
    expect(childAt).toBeGreaterThan(headingAt);
    expect(listAt).toBeGreaterThan(childAt);
  });
});
