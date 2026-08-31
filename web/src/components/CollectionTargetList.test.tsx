import { describe, expect, it, vi } from 'vitest';
import { isValidElement } from 'react';
import type { ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import CollectionTargetList from './CollectionTargetList';
import type { CollectionTargetRow } from './CollectionTargetList';

// R-112 — T-1825 (ADR-0059 §Follow-ups (e)) 수집 대상 표시 축 컴포넌트 검증.
// ServiceIdentityList.test.tsx 와 동일 패턴: jsdom · @testing-library 없이 react-dom/server 의
// renderToStaticMarkup 으로 정적 렌더 문자열만 비교해 dep 표면을 0 으로 둔다.
// 파일명은 .test.tsx 고정 — root jest 의 testRegex (.*\.spec\.ts$) pickup 충돌 회피.

// 구현 상수와 정합해야 하는 식별 토큰들(로딩 문구는 U+2026 … 단일 문자).
const LOADING_TOKEN = '불러오는 중';
const DEFAULT_EMPTY = '등록된 수집 대상이 없습니다';
const INACTIVE_BADGE = '비활성';
const MISSING_FIELD = '(없음)';
// 삭제 버튼 라벨(구현의 DELETE_LABEL 과 정합, T-1828).
const DELETE_LABEL = '삭제';

// renderToStaticMarkup 은 이벤트를 발화하지 않으므로(jsdom 미도입 — ADR-0040 §5 게이트) onDelete
// 클릭 콜백은 컴포넌트가 반환한 React element 트리를 순회해 button 의 onClick 을 수동 호출하는
// 방식으로 검증한다(PersonList.test.tsx collectButtons 동형). React element 는 { type, props }
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
    walk(element.props.children);
  };
  walk(node);
  return found;
}

// 정상 목록 2 건 — GITHUB(orgs/repos 채움) + CONFLUENCE(spaces 채움) 로 type 별 배열 분포가
// 다르다는 schema 사실(ADR-0059 §Consequences (c))을 그대로 반영한다.
const sampleTargets: CollectionTargetRow[] = [
  {
    id: 't1',
    type: 'GITHUB',
    instanceKey: 'github-main',
    endpoint: 'https://github.example.com',
    orgs: ['acme'],
    repos: ['acme/web'],
    spaces: [],
    active: true,
  },
  {
    id: 't2',
    type: 'CONFLUENCE',
    instanceKey: 'conf-main',
    endpoint: 'https://conf.example.com',
    orgs: [],
    repos: [],
    spaces: ['ENG'],
    active: true,
  },
];

describe('CollectionTargetList', () => {
  // happy-path — targets 2 건 → <ul>/<li> 2 개 + 각 행의 type·instanceKey·endpoint 렌더.
  it('targets 2 건 전달 시 <ul>/<li> 2 개와 각 행의 type·instanceKey·endpoint 를 렌더한다 (happy-path)', () => {
    const html = renderToStaticMarkup(
      <CollectionTargetList targets={sampleTargets} />,
    );
    expect(html).toContain('<ul>');
    expect((html.match(/<li>/g) ?? []).length).toBe(2);
    expect(html).toContain('GITHUB');
    expect(html).toContain('github-main');
    expect(html).toContain('https://github.example.com');
    expect(html).toContain('CONFLUENCE');
    expect(html).toContain('conf-main');
    expect(html).toContain('https://conf.example.com');
  });

  // happy-path — 배열 3 종은 값이 있는 것만 표시하고, 여러 값은 ", " 로 접는다.
  it('orgs·repos·spaces 는 값이 있을 때만 표시하고 여러 값은 구분자로 접는다 (happy-path, scope 표시)', () => {
    const html = renderToStaticMarkup(
      <CollectionTargetList
        targets={[
          { ...sampleTargets[0], orgs: ['acme', 'globex'], repos: [], spaces: [] },
        ]}
      />,
    );
    expect(html).toContain('acme, globex');
    // 빈 배열 2 종은 아무 노드도 만들지 않으므로 span 은 type·instanceKey·endpoint·orgs 4 개다.
    expect((html.match(/<span>/g) ?? []).length).toBe(4);
  });

  // happy-path(순서 보존) — props 배열 순서를 그대로 렌더한다(내부 정렬·필터 없음).
  it('targets 를 props 순서 그대로 렌더한다 — 첫 행이 둘째보다 앞 index (happy-path, 순서 보존)', () => {
    const reversed = [sampleTargets[1], sampleTargets[0]];
    const html = renderToStaticMarkup(
      <CollectionTargetList targets={reversed} />,
    );
    expect(html.indexOf('conf-main')).toBeLessThan(html.indexOf('github-main'));
  });

  // 분기 cover [1] loading — role="status" 로딩 문구만, 목록 미렌더.
  it('loading=true 전달 시 role="status" 로딩 문구만 렌더한다 (분기 cover — loading)', () => {
    const html = renderToStaticMarkup(
      <CollectionTargetList targets={[]} loading />,
    );
    expect(html).toContain('role="status"');
    expect(html).toContain(LOADING_TOKEN);
    expect(html).not.toContain('<ul>');
  });

  // error path — error truthy → role="alert" 문구만, 행 0 개.
  it('error truthy 전달 시 role="alert" 문구만 렌더하고 행이 0 개다 (error path)', () => {
    const html = renderToStaticMarkup(
      <CollectionTargetList
        targets={[]}
        error="수집 대상을 불러오지 못했습니다"
      />,
    );
    expect(html).toContain('role="alert"');
    expect(html).toContain('수집 대상을 불러오지 못했습니다');
    expect(html).not.toContain('<ul>');
    expect((html.match(/<li>/g) ?? []).length).toBe(0);
  });

  // error path(우선) — error 와 targets 동시 전달 → error 우선, 목록 미렌더.
  it('error 와 targets 동시 전달 시 error 우선·목록 미렌더 (error path — error 우선)', () => {
    const html = renderToStaticMarkup(
      <CollectionTargetList targets={sampleTargets} error="조회 실패" />,
    );
    expect(html).toContain('role="alert"');
    expect(html).toContain('조회 실패');
    expect(html).not.toContain('<ul>');
    expect(html).not.toContain('github-main');
  });

  // 우선순위 — loading 이 error·잔여 목록보다 우선한다(진행 중 사실을 덮어쓰지 않는다).
  it('loading 이 error·잔여 targets 보다 우선한다 (분기 우선순위 — loading > error > 목록)', () => {
    const html = renderToStaticMarkup(
      <CollectionTargetList targets={sampleTargets} loading error="조회 실패" />,
    );
    expect(html).toContain(LOADING_TOKEN);
    expect(html).not.toContain('role="alert"');
    expect(html).not.toContain('조회 실패');
    expect(html).not.toContain('github-main');
  });

  // 우선순위 — error 가 빈 목록보다 우선한다("없음" 과 "못 불러옴" 구분).
  it('error 가 빈 targets 의 빈 상태 문구보다 우선한다 (분기 우선순위 — error > empty)', () => {
    const html = renderToStaticMarkup(
      <CollectionTargetList targets={[]} error="조회 실패" />,
    );
    expect(html).toContain('role="alert"');
    expect(html).not.toContain(DEFAULT_EMPTY);
  });

  // negative ① — targets 빈 배열은 예외가 아니라 정상 empty 상태다.
  it('targets 빈 배열이면 throw 없이 기본 빈 상태 문구를 렌더한다 (negative ① 빈 배열)', () => {
    const html = renderToStaticMarkup(<CollectionTargetList targets={[]} />);
    expect(html).toContain('role="status"');
    expect(html).toContain(DEFAULT_EMPTY);
    expect(html).not.toContain('<ul>');
  });

  // negative ② — emptyMessage 빈 문자열이면 기본 문구로 fallback 한다.
  it('emptyMessage 가 빈 문자열이면 기본 문구로 fallback 한다 (negative ② 빈 문자열 경계값)', () => {
    const html = renderToStaticMarkup(
      <CollectionTargetList targets={[]} emptyMessage="" />,
    );
    expect(html).toContain(DEFAULT_EMPTY);
  });

  // empty 분기 happy — emptyMessage 가 truthy 면 그 문구를 그대로 쓴다.
  it('emptyMessage 가 truthy 면 그 문구를 그대로 렌더한다 (분기 cover — empty 커스텀 문구)', () => {
    const html = renderToStaticMarkup(
      <CollectionTargetList targets={[]} emptyMessage="대상 없음" />,
    );
    expect(html).toContain('대상 없음');
    expect(html).not.toContain(DEFAULT_EMPTY);
  });

  // negative ③ — endpoint 등 필수 필드가 누락된 계약 위반 row 도 throw 없이 placeholder 렌더.
  it('endpoint 누락 row 도 throw 없이 placeholder 로 렌더한다 (negative ③ 필드 누락)', () => {
    const broken = [
      { id: 't9', type: 'GITHUB', instanceKey: 'gh-9' },
    ] as unknown as CollectionTargetRow[];
    const html = renderToStaticMarkup(<CollectionTargetList targets={broken} />);
    expect(html).toContain('gh-9');
    expect(html).toContain(MISSING_FIELD);
    expect((html.match(/<li>/g) ?? []).length).toBe(1);
  });

  // negative ③-c (review round 1 MINOR-1) — 필드가 **빈 문자열**이어도 placeholder 로 접는다.
  // 부재(undefined)와 달리 빈 문자열은 backend DTO 의 @IsNotEmpty 를 우회해 도달할 수 있는
  // 값이라(예: 공백 trim 이후) displayText 의 falsy 분기를 별도로 잠근다.
  it('endpoint 가 빈 문자열이어도 placeholder 로 접어 렌더한다 (negative ③-c 빈 문자열 경계값)', () => {
    const html = renderToStaticMarkup(
      <CollectionTargetList
        targets={[
          { id: 't6', type: 'GITHUB', instanceKey: 'gh-6', endpoint: '' },
        ]}
      />,
    );
    expect(html).toContain('gh-6');
    expect(html).toContain(MISSING_FIELD);
  });

  // negative ③-b — 배열 3 종이 전부 undefined 여도 formatScope 가 throw 하지 않는다.
  it('orgs·repos·spaces 가 전부 undefined 여도 throw 없이 렌더한다 (negative ③-b 배열 누락)', () => {
    const html = renderToStaticMarkup(
      <CollectionTargetList
        targets={[
          {
            id: 't8',
            type: 'GITHUB',
            instanceKey: 'gh-8',
            endpoint: 'https://e.example.com',
          },
        ]}
      />,
    );
    expect(html).toContain('gh-8');
    // scope span 이 하나도 붙지 않아 span 은 기본 3 축뿐이다.
    expect((html.match(/<span>/g) ?? []).length).toBe(3);
  });

  // negative ③-d (review round 1 MINOR-2) — scope 필드가 **비-배열**(null · 문자열)이어도
  // formatScope 의 Array.isArray 가드가 흡수해 throw 하지 않는다. AdminView 는 응답 최상위
  // body 만 정상화하고 행 내부 필드는 정상화하지 않으므로 이 가드가 마지막 방어선이다 —
  // 가드를 지우면 본 test 가 red 가 되도록 잠근다(공허한 방어 방지).
  it('orgs 가 비-배열(null·문자열)이어도 throw 없이 흡수해 렌더한다 (negative ③-d 비-배열 scope)', () => {
    const broken = [
      {
        id: 't5',
        type: 'GITHUB',
        instanceKey: 'gh-5',
        endpoint: 'https://e.example.com',
        orgs: null,
        repos: 'acme/web',
      },
    ] as unknown as CollectionTargetRow[];
    const render = () =>
      renderToStaticMarkup(<CollectionTargetList targets={broken} />);
    expect(render).not.toThrow();
    const html = render();
    expect(html).toContain('gh-5');
    // 비-배열은 빈 문자열로 접히므로 scope span 이 하나도 붙지 않는다(기본 3 축뿐).
    expect((html.match(/<span>/g) ?? []).length).toBe(3);
  });

  // negative ④ — active:false 행만 비활성 표식이 붙어 활성 행과 구분된다.
  it('active=false 행에만 비활성 표식을 붙여 활성 행과 구분한다 (negative ④ 비활성 구분)', () => {
    const html = renderToStaticMarkup(
      <CollectionTargetList
        targets={[sampleTargets[0], { ...sampleTargets[1], active: false }]}
      />,
    );
    expect((html.match(/<span>비활성<\/span>/g) ?? []).length).toBe(1);
    // 표식은 비활성 행(conf-main) 뒤에 있어야 한다 — 활성 행에는 붙지 않는다.
    expect(html.indexOf(INACTIVE_BADGE)).toBeGreaterThan(
      html.indexOf('conf-main'),
    );
  });

  // negative ④-b — active 누락 row 는 schema 기본값(true) 정합으로 활성 취급한다.
  it('active 가 누락된 row 는 활성으로 보고 비활성 표식을 붙이지 않는다 (negative ④-b 경계값)', () => {
    const html = renderToStaticMarkup(
      <CollectionTargetList
        targets={[
          {
            id: 't7',
            type: 'GITHUB',
            instanceKey: 'gh-7',
            endpoint: 'https://e.example.com',
          },
        ]}
      />,
    );
    expect(html).not.toContain(INACTIVE_BADGE);
  });

  // ── T-1828 삭제 진입점 (onDelete optional prop) ──────────────────────────────

  // happy-path — onDelete 전달 시 각 행에 삭제 버튼(<button type="button">)이 행 수만큼 렌더된다.
  it('onDelete 전달 시 각 행에 삭제 버튼을 행 수만큼 렌더한다 (happy-path — T-1828)', () => {
    const html = renderToStaticMarkup(
      <CollectionTargetList targets={sampleTargets} onDelete={() => undefined} />,
    );
    expect((html.match(/<button type="button">/g) ?? []).length).toBe(2);
    expect((html.match(new RegExp(DELETE_LABEL, 'g')) ?? []).length).toBe(2);
  });

  // happy-path(콜백) — 삭제 버튼 클릭 시 그 행의 row.id 로 onDelete 가 호출된다(element 트리 순회).
  it('삭제 버튼 클릭 시 해당 행 id 로 onDelete 를 호출한다 (happy-path — 콜백 발화, T-1828)', () => {
    const onDelete = vi.fn();
    const tree = CollectionTargetList({ targets: sampleTargets, onDelete });
    const buttons = collectButtons(tree);
    // 버튼이 행 수만큼 수집되고, 각 버튼 클릭이 대응 row.id 로 콜백을 호출한다(순서 보존).
    expect(buttons).toHaveLength(2);
    buttons[0]?.onClick?.();
    expect(onDelete).toHaveBeenLastCalledWith('t1');
    buttons[1]?.onClick?.();
    expect(onDelete).toHaveBeenLastCalledWith('t2');
    expect(onDelete).toHaveBeenCalledTimes(2);
  });

  // 분기/negative ④ — onDelete 미전달(비-Admin 마운트) 시 삭제 버튼 0 개. T-1825 의 읽기 전용
  // 마운트가 글자 그대로 보존된다(목록 본체는 그대로 렌더).
  it('onDelete 미전달 시 삭제 버튼을 렌더하지 않는다 (분기/negative ④ — 읽기 전용 하위 호환)', () => {
    const html = renderToStaticMarkup(
      <CollectionTargetList targets={sampleTargets} />,
    );
    expect(html).not.toContain('<button');
    expect(html).not.toContain(DELETE_LABEL);
    expect(html).toContain('<ul>');
    expect(html).toContain('github-main');
  });

  // negative ⑤ — loading · error · empty 분기에서는 onDelete 를 줘도 버튼이 렌더되지 않는다
  // (분기 순서가 populated 에 도달하지 않으므로 행 자체가 없다).
  it.each([
    ['loading=true', { loading: true }, LOADING_TOKEN],
    ['error truthy', { error: '조회에 실패했습니다' }, '조회에 실패했습니다'],
  ])(
    'onDelete 전달 + %s 이면 버튼 대신 상태 표시만 렌더한다 (negative ⑤ — 분기 우선순위)',
    (_label, extra, token) => {
      const html = renderToStaticMarkup(
        <CollectionTargetList
          targets={sampleTargets}
          onDelete={() => undefined}
          {...extra}
        />,
      );
      expect(html).not.toContain('<button');
      expect(html).toContain(token);
    },
  );

  // negative ⑤-b — 빈 목록에서는 onDelete 를 줘도 버튼이 0 개다(행이 없으므로).
  it('onDelete 전달 + 빈 목록이면 버튼 0 개이고 빈 상태 문구만 렌더한다 (negative ⑤-b 경계값)', () => {
    const html = renderToStaticMarkup(
      <CollectionTargetList targets={[]} onDelete={() => undefined} />,
    );
    expect(html).not.toContain('<button');
    expect(html).toContain(DEFAULT_EMPTY);
  });

  // negative — 삭제 버튼 도입 후에도 표시 축(type·instanceKey·endpoint·비활성 표식)은 그대로다
  // (버튼은 <span> 축을 대체하지 않는다 — 표시 회귀 0).
  it('onDelete 전달이 기존 표시 축을 바꾸지 않는다 (negative — 표시 회귀 0)', () => {
    const withDelete = renderToStaticMarkup(
      <CollectionTargetList
        targets={[{ ...sampleTargets[0], active: false }]}
        onDelete={() => undefined}
      />,
    );
    const readOnly = renderToStaticMarkup(
      <CollectionTargetList targets={[{ ...sampleTargets[0], active: false }]} />,
    );
    // span 개수(표시 축)는 동일하고, 삭제 버튼만 추가로 붙는다.
    const spanCount = (html: string) => (html.match(/<span>/g) ?? []).length;
    expect(spanCount(withDelete)).toBe(spanCount(readOnly));
    expect(withDelete).toContain(INACTIVE_BADGE);
    expect(withDelete).toContain('<button');
  });

  // negative — id 가 빈 문자열인 계약 위반 row 여도 렌더는 throw 하지 않고, 클릭은 그 값을 그대로
  // 콜백에 넘긴다(판정은 컨테이너 러너 몫 — 목록은 값을 교정하지 않는다).
  it('id 가 빈 문자열인 row 도 throw 없이 렌더하고 그 값을 그대로 콜백에 넘긴다 (negative — 계약 위반 입력)', () => {
    const onDelete = vi.fn();
    const broken = [{ ...sampleTargets[0], id: '' }];
    expect(() =>
      renderToStaticMarkup(
        <CollectionTargetList targets={broken} onDelete={onDelete} />,
      ),
    ).not.toThrow();
    collectButtons(CollectionTargetList({ targets: broken, onDelete }))[0]?.onClick?.();
    expect(onDelete).toHaveBeenCalledWith('');
  });
});
