import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import AdminGroupsSection, {
  type AdminGroupsSectionProps,
} from './AdminGroupsSection';
import type { GroupRow } from '../components/GroupList';
import { ADMIN_SECTION_GROUPS_ID, GROUP_HEADING } from './adminViewConstants';

// R-112 — T-1909(분해 1/2) + T-1910(폼 2 종 흡수 2/2) presentational slice 검증. dep 0 관례대로
// renderToStaticMarkup 정적 렌더 문자열만 보고 "props 를 그대로 통과시키는가 · 폼 2 종이 heading
// 뒤 · 목록 앞에 오는가 · disabled 술어가 원본과 동형인가"만 본다(발화 계약은 기존 spec 소관).

const rows: GroupRow[] = [{ id: 'g1', name: '백엔드팀', members: [{}, {}] }];

const noop = () => {};

const baseProps: AdminGroupsSectionProps = {
  groups: rows,
  createName: '',
  editingId: null,
  editName: '',
  // 콜백 5 축은 정적 마크업에 드러나지 않으므로 no-op 로 고정한다.
  onCreateNameChange: noop, onCreateSubmit: noop, onEditNameChange: noop,
  onEditSubmit: noop, onEditCancel: noop,
};

const render = (props: Partial<AdminGroupsSectionProps> = {}) =>
  renderToStaticMarkup(<AdminGroupsSection {...baseProps} {...props} />);

describe('AdminGroupsSection 렌더', () => {
  it('섹션 id·aria-label·heading·생성 폼·전달한 group row 문구를 함께 렌더한다 (happy-path)', () => {
    const html = render({ onDelete: () => {}, onEdit: () => {} });
    expect(html).toContain(`id="${ADMIN_SECTION_GROUPS_ID}"`);
    expect(html).toContain('id="admin-section-groups"');
    expect(html).toContain(`aria-label="${GROUP_HEADING}"`);
    expect(html).toContain('<h2>그룹 관리</h2>');
    expect(html).toContain('aria-label="추가할 그룹 이름"');
    expect(html).toContain('그룹 추가</button>');
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

  it('createError·editError 를 주면 각 폼 하단에 alert 가 하나씩 렌더된다 (error path — 폼 2 축)', () => {
    const call = () =>
      render({ editingId: 'g1', createError: '생성 실패', editError: '수정 실패' });
    expect(call).not.toThrow();
    const html = call();
    // 둘은 서로 다른 자리라 동시 전달 시 alert 가 2 개고, falsy 면 하나도 안 나온다.
    expect(html).toContain('<p role="alert">수정 실패</p>');
    expect((html.match(/<p role="alert">/g) ?? []).length).toBe(2);
    expect(render({ editingId: 'g1' })).not.toContain('<p role="alert">');
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

  it('groups 가 빈 배열이고 두 폼 값이 빈 문자열이어도 안전 렌더한다 (분기 b · negative — 초기 상태)', () => {
    const call = () => render({ groups: [] });
    expect(call).not.toThrow();
    expect(call()).toContain('등록된 그룹이 없습니다');
    expect(call()).toContain('aria-label="추가할 그룹 이름"');
  });

  it('createLoading·공백 이름이면 생성 컨트롤이 disabled 된다 (분기 d·e · negative — 공백뿐)', () => {
    const busy = render({ createName: '새 그룹', createLoading: true });
    expect((busy.match(/disabled=""/g) ?? []).length).toBe(2);
    expect(render({ createName: '새 그룹' })).not.toContain('disabled=""');
    expect((render({ createName: '   ' }).match(/disabled=""/g) ?? []).length).toBe(1);
    // createLoading 과 createError 가 동시에 truthy 여도 둘 다 유지되고 throw 0.
    const conflict = render({ createLoading: true, createError: '생성 실패' });
    expect(conflict).toContain('disabled=""');
    expect(conflict).toContain('<p role="alert">생성 실패</p>');
  });

  it('editingId·editName·editLoading 이 수정 폼 렌더와 disabled 를 정한다 (분기 c·f · negative)', () => {
    // 생성 축을 유효 값으로 고정해 disabled 수가 수정 폼만 반영하게 한다.
    const editing = { createName: '새 그룹', editingId: 'g1' } as const;
    expect(render()).not.toContain('aria-label="수정할 그룹 이름"');
    const open = render({ ...editing, editName: '백엔드팀' });
    expect(open).toContain('aria-label="수정할 그룹 이름"');
    expect(open).toContain('그룹 수정</button>');
    expect(open).toContain('취소</button>');
    // 빈 문자열 id 도 null 이 아니므로 폼이 뜬다(원본 !== null 술어와 동형 — negative).
    expect(render({ editingId: '', editName: 'x' })).toContain('수정할 그룹 이름');
    const busy = render({ ...editing, editName: '백엔드팀', editLoading: true });
    expect((busy.match(/disabled=""/g) ?? []).length).toBe(3);
    const blank = () => render({ ...editing, editName: '  ' });
    expect(blank).not.toThrow();
    expect((blank().match(/disabled=""/g) ?? []).length).toBe(1);
    expect(open).not.toContain('disabled=""');
  });

  it('onDelete·onEdit 미전달이면 행 버튼만 사라지고 폼은 그대로 렌더된다 (분기 g · 읽기 전용 negative)', () => {
    const readonly = render();
    expect(readonly).not.toContain('>수정</button>');
    expect(readonly).not.toContain('>삭제</button>');
    expect(readonly).toContain('백엔드팀');
    expect(readonly).toContain('그룹 추가</button>');
    // 콜백을 주면 행의 수정·삭제 버튼이 함께 렌더된다(같은 분기의 반대편).
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
    expect(html).not.toContain('>수정</button>');
    expect(html).not.toContain('>삭제</button>');
  });

  it('생성 폼 · 수정 폼은 <h2> 뒤 · GroupList 앞 순서로 렌더된다 (JSX 순서 회귀 방어)', () => {
    const html = render({ editingId: 'g1', editName: '백엔드팀' });
    const headingAt = html.indexOf('<h2>');
    const createAt = html.indexOf('추가할 그룹 이름');
    const editAt = html.indexOf('수정할 그룹 이름');
    const listAt = html.indexOf('<ul>');
    expect(headingAt).toBeGreaterThanOrEqual(0);
    expect(createAt).toBeGreaterThan(headingAt);
    expect(editAt).toBeGreaterThan(createAt);
    expect(listAt).toBeGreaterThan(editAt);
  });
});
