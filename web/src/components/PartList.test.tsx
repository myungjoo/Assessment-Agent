import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { isValidElement } from 'react';
import type { ReactNode } from 'react';
import PartList from './PartList';
import type { PartRow } from './PartList';

// 삭제/수정 버튼 라벨 (구현의 DELETE_LABEL/EDIT_LABEL 과 정합).
const DELETE_LABEL = '삭제';
const EDIT_LABEL = '수정';

// renderToStaticMarkup 은 이벤트를 발화하지 않으므로(jsdom 미도입 — ADR-0040 §5 게이트) onDelete/
// onEdit 클릭 콜백은 컴포넌트가 반환한 React element 트리를 순회해 button 의 onClick 을 수동 호출하는
// 방식으로 검증한다(GroupList.test.tsx collectButtons 동형). React element 는 { type, props }
// 평문 객체라 트리 walk 로 button 노드를 수집할 수 있다.
function collectButtons(node: ReactNode): Array<{ onClick?: () => void }> {
  const found: Array<{ onClick?: () => void }> = [];
  const walk = (current: ReactNode): void => {
    if (Array.isArray(current)) {
      current.forEach(walk);
      return;
    }
    if (!isValidElement(current)) {
      return;
    }
    const element = current as {
      type: unknown;
      props: { children?: ReactNode; onClick?: () => void };
    };
    if (element.type === 'button') {
      found.push({ onClick: element.props.onClick });
    }
    if (element.props && element.props.children !== undefined) {
      walk(element.props.children);
    }
  };
  walk(node);
  return found;
}

// R-112 — P6 Admin 파트(Part) 관리 UI(REQ-028·REQ-049) 목록 컴포넌트 검증.
// GroupList.test.tsx 와 동일 패턴: jsdom·@testing-library 없이 react-dom/server 의
// renderToStaticMarkup 으로 정적 렌더 문자열만 검증해 dep 표면을 최소화한다(ADR-0040 §5 게이트).
// 파일명은 .test.tsx 고정 — root jest 의 testRegex (.*\.spec\.ts$) pickup 충돌 회피.

// 로딩 문구 식별 토큰(구현의 LOADING_TEXT 정합 — 말줄임표 U+2026 …) / 기본 빈 상태 문구 / placeholder.
const LOADING_TOKEN = '불러오는 중';
const DEFAULT_EMPTY = '등록된 파트가 없습니다';
const NAME_PLACEHOLDER = '(이름 없음)';

// 테스트용 파트 2건(정상 목록·순서 보존용). 인원 수 부가 표시는 persons 배열 길이로 검증한다.
const sampleParts: PartRow[] = [
  { id: 'p1', name: '개발본부', persons: [{}, {}] },
  { id: 'p2', name: '디자인실', persons: [{}, {}, {}] },
];

describe('PartList', () => {
  // happy-path — parts 가 있으면 <ul>/<li> + 각 행 name 을 렌더한다.
  it('parts 전달 시 <ul>/<li> 목록 + 각 행 name 을 렌더한다 (happy-path)', () => {
    const html = renderToStaticMarkup(<PartList parts={sampleParts} />);
    expect(html).toContain('<ul>');
    expect(html).toContain('<li>');
    expect(html).toContain('개발본부');
    expect(html).toContain('디자인실');
    expect((html.match(/<li>/g) ?? []).length).toBe(2);
  });

  // happy-path(순서 보존) — props 순서대로 출력(내부 정렬 없음).
  it('parts 를 props 순서 그대로 렌더한다 — 첫 행이 둘째보다 앞 index (happy-path, 순서 보존)', () => {
    const html = renderToStaticMarkup(<PartList parts={sampleParts} />);
    expect(html.indexOf('개발본부')).toBeLessThan(html.indexOf('디자인실'));
  });

  // 인원 수 부가 표시 — persons 가 있으면 인원 수를 표시한다.
  it('persons 가 있으면 인원 수를 부가 표시한다 (분기 — 인원 수)', () => {
    const html = renderToStaticMarkup(<PartList parts={sampleParts} />);
    expect(html).toContain('인원 2명'); // persons 길이 2.
    expect(html).toContain('인원 3명'); // persons 길이 3.
  });

  // secret 미노출 — Part 는 민감 컬럼이 부재하므로 secret 토큰이 markup 에 등장하지 않는다.
  it('파트 목록 렌더 시 secret 토큰이 markup 에 등장하지 않는다 (secret 미노출 정책)', () => {
    const html = renderToStaticMarkup(<PartList parts={sampleParts} />);
    expect(html).not.toContain('apiKey');
    expect(html).not.toContain('token');
    expect(html).not.toContain('secret');
  });

  // error path — error truthy → role="alert", 목록(<ul>) 미렌더.
  it('error truthy 전달 시 role="alert" 영역에 문구 렌더, <ul> 미렌더 (error path)', () => {
    const html = renderToStaticMarkup(
      <PartList parts={[]} error="파트를 불러오지 못했습니다" />,
    );
    expect(html).toContain('role="alert"');
    expect(html).toContain('파트를 불러오지 못했습니다');
    expect(html).not.toContain('<ul>');
  });

  // branch — loading=true → role="status" + 로딩 문구, 목록/빈상태 미렌더.
  it('loading=true 면 role="status" + "불러오는 중…" 렌더, <ul>/빈상태 미렌더 (branch — loading)', () => {
    const html = renderToStaticMarkup(<PartList parts={[]} loading={true} />);
    expect(html).toContain('role="status"');
    expect(html).toContain(LOADING_TOKEN);
    // 말줄임표는 U+2026(…) 단일 문자여야 한다 — "..." 3 점이 아니다.
    expect(html).toContain('불러오는 중…');
    expect(html).not.toContain('불러오는 중...');
    expect(html).not.toContain(DEFAULT_EMPTY);
    expect(html).not.toContain('<ul>');
  });

  // branch — 빈 배열 + loading/error 미전달 → 기본 빈 상태 문구, 목록 미렌더.
  it('parts 빈 배열 + loading/error 미전달 → 기본 빈 상태 문구 렌더, <ul> 미렌더 (branch — empty)', () => {
    const html = renderToStaticMarkup(<PartList parts={[]} />);
    expect(html).toContain('role="status"');
    expect(html).toContain(DEFAULT_EMPTY);
    expect(html).not.toContain('<ul>');
    expect(html).not.toContain('<li>');
  });

  // negative — loading=true 가 parts 보다 우선(채워져도 목록 미렌더).
  it('parts 있음 + loading=true → 목록을 렌더하지 않고 로딩 표시 우선 (negative — loading 우선 정책)', () => {
    const html = renderToStaticMarkup(<PartList parts={sampleParts} loading={true} />);
    expect(html).toContain('role="status"');
    expect(html).toContain(LOADING_TOKEN);
    expect(html).not.toContain('<ul>');
    expect(html).not.toContain('개발본부');
  });

  // negative — loading=true 가 error 보다 우선(둘 다 truthy 여도 로딩만).
  it('error 전달 + loading=true → alert 대신 로딩 표시 우선 (negative — loading 이 error 보다 우선)', () => {
    const html = renderToStaticMarkup(
      <PartList parts={[]} loading={true} error="에러 문구" />,
    );
    expect(html).toContain('role="status"');
    expect(html).toContain(LOADING_TOKEN);
    expect(html).not.toContain('role="alert"');
    expect(html).not.toContain('에러 문구');
  });

  // negative — error 와 parts 동시 전달 시 error 우선, 목록 미렌더.
  it('error 와 parts 동시 전달 → error 우선·목록 미렌더 (negative — error 우선)', () => {
    const html = renderToStaticMarkup(<PartList parts={sampleParts} error="조회 실패" />);
    expect(html).toContain('role="alert"');
    expect(html).toContain('조회 실패');
    expect(html).not.toContain('<ul>');
    expect(html).not.toContain('개발본부');
  });

  // negative/edge — custom emptyMessage 전달 시 기본 문구 대신 custom 빈 문구 렌더.
  it('parts 빈 배열 + custom emptyMessage → 기본 문구 대신 custom 빈 문구 렌더 (negative — override)', () => {
    const custom = '표시할 파트가 아직 없어요';
    const html = renderToStaticMarkup(<PartList parts={[]} emptyMessage={custom} />);
    expect(html).toContain('role="status"');
    expect(html).toContain(custom);
    expect(html).not.toContain(DEFAULT_EMPTY);
  });

  // negative/edge — 빈 문자열 emptyMessage 는 기본 문구로 fallback(빈 메시지 방지).
  it('parts 빈 배열 + emptyMessage="" → 기본 문구로 fallback (negative — 빈 문자열 경계값)', () => {
    const html = renderToStaticMarkup(<PartList parts={[]} emptyMessage="" />);
    expect(html).toContain('role="status"');
    expect(html).toContain(DEFAULT_EMPTY);
  });

  // negative/edge — 빈 문자열 error(falsy) + 빈 배열 → alert 미렌더·빈 상태 문구 렌더.
  it('error="" (falsy) + 빈 배열 → alert 미렌더·빈 상태 문구 렌더 (negative — 빈 문자열 error 경계값)', () => {
    const html = renderToStaticMarkup(<PartList parts={[]} error="" />);
    expect(html).not.toContain('role="alert"');
    expect(html).toContain('role="status"');
    expect(html).toContain(DEFAULT_EMPTY);
  });

  // negative/edge — name 없는 row 가 placeholder 로 throw 없이 렌더된다.
  it('name 없는 row → "(이름 없음)" placeholder 로 throw 없이 렌더한다 (negative — name 부재 안전 처리)', () => {
    const noName: PartRow[] = [{ id: 'p9' }];
    const html = renderToStaticMarkup(<PartList parts={noName} />);
    expect(html).toContain('<li>');
    expect(html).toContain(NAME_PLACEHOLDER);
  });

  // negative/edge — id 없는 row 가 index key fallback 으로 throw 없이 렌더된다.
  it('id 없는 row → index key fallback 으로 throw 없이 렌더한다 (negative — id 부재 안전 처리)', () => {
    const noId: PartRow[] = [{ name: '무명파트' }];
    const html = renderToStaticMarkup(<PartList parts={noId} />);
    expect(html).toContain('<li>');
    expect(html).toContain('무명파트');
  });

  // negative/edge — persons 없는 row 는 인원 수 부가 표시를 생략한다.
  it('persons 없는 row → 인원 수 표시를 생략하고 name 만 렌더한다 (negative — 인원 배열 부재)', () => {
    const scalarOnly: PartRow[] = [{ id: 'p8', name: '스칼라파트' }];
    const html = renderToStaticMarkup(<PartList parts={scalarOnly} />);
    expect(html).toContain('스칼라파트');
    expect(html).not.toContain('인원 ');
  });

  // negative/edge — 다건 part 를 key 중복 없이 렌더(<li> 수 = part 수).
  it('다건 part 를 key 중복 경고 없이 렌더한다 — <li> 수 = part 수 (negative — 다건 key 안정성)', () => {
    const many: PartRow[] = [
      { id: 'a', name: 'A' },
      { id: 'b', name: 'B' },
      { id: 'c', name: 'C' },
    ];
    const html = renderToStaticMarkup(<PartList parts={many} />);
    expect((html.match(/<li>/g) ?? []).length).toBe(3);
  });

  // happy-path(onDelete) — onDelete 전달 시 각 행에 삭제 버튼(<button>)이 part 수만큼 렌더된다.
  it('onDelete 전달 시 각 행에 삭제 버튼을 part 수만큼 렌더한다 (happy-path — onDelete 전달)', () => {
    const html = renderToStaticMarkup(
      <PartList parts={sampleParts} onDelete={() => undefined} />,
    );
    expect(html).toContain('<button');
    expect(html).toContain(DELETE_LABEL);
    const btnCount = (html.match(/<button/g) ?? []).length;
    expect(btnCount).toBe(2);
  });

  // happy-path(콜백) — 삭제 버튼 클릭 시 해당 행의 row.id 로 onDelete 가 호출된다(element 트리 순회).
  it('삭제 버튼 클릭 시 해당 행 id 로 onDelete 를 호출한다 (happy-path — 콜백 발화)', () => {
    const onDelete = vi.fn();
    const tree = PartList({ parts: sampleParts, onDelete });
    const buttons = collectButtons(tree);
    expect(buttons).toHaveLength(2);
    buttons[0]?.onClick?.();
    expect(onDelete).toHaveBeenLastCalledWith('p1');
    buttons[1]?.onClick?.();
    expect(onDelete).toHaveBeenLastCalledWith('p2');
    expect(onDelete).toHaveBeenCalledTimes(2);
  });

  // branch/negative — onDelete 미전달 시 삭제 버튼 미렌더(읽기 전용 하위 호환).
  it('onDelete 미전달 시 삭제 버튼을 렌더하지 않는다 (branch/negative — onDelete 미전달 하위 호환)', () => {
    const html = renderToStaticMarkup(<PartList parts={sampleParts} />);
    expect(html).not.toContain('<button');
    expect(html).not.toContain(DELETE_LABEL);
    expect(html).toContain('<ul>');
    expect(html).toContain('개발본부');
  });

  // negative — id 없는 row + onDelete 전달 → 콜백 인자가 없으므로 삭제 버튼을 렌더하지 않는다.
  it('id 없는 row + onDelete 전달 → 삭제 버튼 미렌더(콜백 인자 부재 안전 처리) (negative — id 부재 + 콜백)', () => {
    const noId: PartRow[] = [{ name: '무id파트' }];
    const html = renderToStaticMarkup(<PartList parts={noId} onDelete={() => undefined} />);
    expect(html).toContain('무id파트');
    expect(html).not.toContain('<button');
  });

  // negative — loading 우선 정책은 onDelete 전달과 무관하다(loading=true 면 버튼도 미렌더).
  it('onDelete 전달 + loading=true → 목록/삭제 버튼 대신 로딩 표시 우선 (negative — loading 우선)', () => {
    const html = renderToStaticMarkup(
      <PartList parts={sampleParts} loading={true} onDelete={() => undefined} />,
    );
    expect(html).toContain('role="status"');
    expect(html).toContain(LOADING_TOKEN);
    expect(html).not.toContain('<button');
  });

  // negative — error 우선 정책은 onDelete 전달과 무관하다(error truthy 면 버튼도 미렌더).
  it('onDelete 전달 + error truthy → 목록/삭제 버튼 대신 alert 우선 (negative — error 우선)', () => {
    const html = renderToStaticMarkup(
      <PartList parts={sampleParts} error="삭제에 실패했습니다" onDelete={() => undefined} />,
    );
    expect(html).toContain('role="alert"');
    expect(html).toContain('삭제에 실패했습니다');
    expect(html).not.toContain('<button');
  });

  // negative — 빈 배열 + onDelete 전달 → 삭제 버튼 미렌더(빈 상태 문구만, 렌더할 행 없음).
  it('빈 배열 + onDelete 전달 → 삭제 버튼 미렌더·빈 상태 문구만 렌더한다 (negative — 빈 목록)', () => {
    const html = renderToStaticMarkup(<PartList parts={[]} onDelete={() => undefined} />);
    expect(html).not.toContain('<button');
    expect(html).toContain(DEFAULT_EMPTY);
  });

  // happy-path(onEdit) — onEdit 전달 시 각 행에 수정 버튼(<button>)이 part 수만큼 렌더된다.
  it('onEdit 전달 시 각 행에 수정 버튼을 part 수만큼 렌더한다 (happy-path — onEdit 전달)', () => {
    const html = renderToStaticMarkup(
      <PartList parts={sampleParts} onEdit={() => undefined} />,
    );
    expect(html).toContain('<button');
    expect(html).toContain(EDIT_LABEL);
    const btnCount = (html.match(/<button/g) ?? []).length;
    expect(btnCount).toBe(2);
  });

  // happy-path(콜백) — 수정 버튼 클릭 시 해당 행의 row.id 로 onEdit 가 호출된다(element 트리 순회).
  it('수정 버튼 클릭 시 해당 행 id 로 onEdit 를 호출한다 (happy-path — 콜백 발화)', () => {
    const onEdit = vi.fn();
    const tree = PartList({ parts: sampleParts, onEdit });
    const buttons = collectButtons(tree);
    expect(buttons).toHaveLength(2);
    buttons[0]?.onClick?.();
    expect(onEdit).toHaveBeenLastCalledWith('p1');
    buttons[1]?.onClick?.();
    expect(onEdit).toHaveBeenLastCalledWith('p2');
    expect(onEdit).toHaveBeenCalledTimes(2);
  });

  // branch/negative — onEdit 미전달 시 수정 버튼 미렌더(읽기 전용 하위 호환).
  it('onEdit 미전달 시 수정 버튼을 렌더하지 않는다 (branch/negative — onEdit 미전달 하위 호환)', () => {
    const html = renderToStaticMarkup(<PartList parts={sampleParts} />);
    expect(html).not.toContain(EDIT_LABEL);
    expect(html).toContain('<ul>');
    expect(html).toContain('개발본부');
  });

  // branch — onEdit + onDelete 동시 전달 시 각 행에 수정·삭제 버튼이 함께 렌더된다(버튼 수 = part×2).
  it('onEdit + onDelete 동시 전달 시 각 행에 수정·삭제 버튼을 함께 렌더한다 (branch — 두 콜백 공존)', () => {
    const html = renderToStaticMarkup(
      <PartList
        parts={sampleParts}
        onEdit={() => undefined}
        onDelete={() => undefined}
      />,
    );
    expect(html).toContain(EDIT_LABEL);
    expect(html).toContain(DELETE_LABEL);
    const btnCount = (html.match(/<button/g) ?? []).length;
    expect(btnCount).toBe(sampleParts.length * 2);
  });

  // negative — onEdit + onDelete 동시 전달 시 두 콜백이 각각 대응 row.id 로 호출된다(수정→삭제 순).
  it('onEdit + onDelete 동시 전달 시 각 콜백이 대응 row.id 로 호출된다 (negative — 콜백 분리 발화)', () => {
    const onEdit = vi.fn();
    const onDelete = vi.fn();
    const tree = PartList({ parts: sampleParts, onEdit, onDelete });
    const buttons = collectButtons(tree);
    expect(buttons).toHaveLength(4);
    buttons[0]?.onClick?.(); // 첫 행 수정.
    expect(onEdit).toHaveBeenLastCalledWith('p1');
    buttons[1]?.onClick?.(); // 첫 행 삭제.
    expect(onDelete).toHaveBeenLastCalledWith('p1');
    buttons[2]?.onClick?.(); // 둘째 행 수정.
    expect(onEdit).toHaveBeenLastCalledWith('p2');
    buttons[3]?.onClick?.(); // 둘째 행 삭제.
    expect(onDelete).toHaveBeenLastCalledWith('p2');
    expect(onEdit).toHaveBeenCalledTimes(2);
    expect(onDelete).toHaveBeenCalledTimes(2);
  });

  // negative — loading 우선 정책은 onEdit 전달과 무관하다(loading=true 면 수정 버튼도 미렌더).
  it('onEdit 전달 + loading=true → 목록/수정 버튼 대신 로딩 표시 우선 (negative — loading 우선)', () => {
    const html = renderToStaticMarkup(
      <PartList parts={sampleParts} loading={true} onEdit={() => undefined} />,
    );
    expect(html).toContain('role="status"');
    expect(html).toContain(LOADING_TOKEN);
    expect(html).not.toContain('<button');
  });

  // negative — 빈 배열 + onEdit 전달 → 수정 버튼 미렌더(빈 상태 문구만, 렌더할 행 없음).
  it('빈 배열 + onEdit 전달 → 수정 버튼 미렌더·빈 상태 문구만 렌더한다 (negative — 빈 목록)', () => {
    const html = renderToStaticMarkup(<PartList parts={[]} onEdit={() => undefined} />);
    expect(html).not.toContain('<button');
    expect(html).toContain(DEFAULT_EMPTY);
  });
});
