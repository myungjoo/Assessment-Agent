import { describe, expect, it, vi } from 'vitest';
import { isValidElement } from 'react';
import type { ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import CollectionTargetList from './CollectionTargetList';
import type { CollectionTargetRow } from './CollectionTargetList';
// drift 가드용 — 화면의 type 별 범위 축과 요청에 실리는 축이 같은지 대조한다(T-1832). 값 import
// 이지만 러너 모듈은 순수 함수만 노출하므로 dep 표면은 그대로 0 이다.
import { scopeFieldsForCollectionTargetType } from '../views/adminCollectionTargetRunners';

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
// 활성/비활성 토글 버튼 라벨(구현의 DEACTIVATE_LABEL / ACTIVATE_LABEL 과 정합, T-1829).
const DEACTIVATE_LABEL = '비활성화';
const ACTIVATE_LABEL = '활성화';
// 값 편집 축 라벨·입력 이름(구현의 EDIT_LABEL / SAVE_LABEL / CANCEL_LABEL /
// EDIT_INPUT_LABEL 과 정합, T-1831).
const EDIT_LABEL = '편집';
const SAVE_LABEL = '저장';
const CANCEL_LABEL = '취소';
const EDIT_INPUT_LABEL = 'endpoint 수정';
// 범위 배열 3 축 입력의 접근 가능한 이름(구현의 SCOPE_INPUT_LABELS 와 정합, T-1832).
const ORGS_INPUT_LABEL = 'orgs 수정';
const REPOS_INPUT_LABEL = 'repos 수정';
const SPACES_INPUT_LABEL = 'spaces 수정';

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

// 토글 버튼 검증은 라벨(현재 상태에서 파생)과 클릭 인자(다음 상태)를 함께 봐야 하므로, 위
// collectButtons 와 달리 children 문자열까지 회수하는 수집기를 따로 둔다(T-1829). onClick 은
// 인자를 받으므로 시그니처를 unknown[] 로 열어둔다.
function collectLabeledButtons(
  node: ReactNode,
): Array<{ label: string; onClick?: (...args: unknown[]) => void }> {
  const found: Array<{ label: string; onClick?: (...args: unknown[]) => void }> = [];
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
      props: {
        children?: ReactNode;
        onClick?: (...args: unknown[]) => void;
      };
    };
    if (element.type === 'button') {
      found.push({
        label: String(element.props.children ?? ''),
        onClick: element.props.onClick,
      });
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


// 편집 축 검증(T-1831)은 버튼의 disabled 와 <input> 의 controlled props 까지 봐야 하므로 위
// 두 수집기와 달리 element 종류를 가리지 않고 필요한 props 를 함께 회수하는 수집기를 둔다.
function collectEditNodes(node: ReactNode): {
  buttons: Array<{
    label: string;
    disabled?: boolean;
    onClick?: (...args: unknown[]) => void;
  }>;
  inputs: Array<{
    label?: string;
    value?: string;
    onChange?: (event: { target: { value: string } }) => void;
  }>;
} {
  const buttons: Array<{
    label: string;
    disabled?: boolean;
    onClick?: (...args: unknown[]) => void;
  }> = [];
  const inputs: Array<{
    label?: string;
    value?: string;
    onChange?: (event: { target: { value: string } }) => void;
  }> = [];
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
      props: Record<string, unknown> & { children?: ReactNode };
    };
    if (element.type === 'button') {
      buttons.push({
        label: String(element.props.children ?? ''),
        disabled: element.props.disabled as boolean | undefined,
        onClick: element.props.onClick as
          | ((...args: unknown[]) => void)
          | undefined,
      });
    }
    if (element.type === 'input') {
      inputs.push({
        label: element.props['aria-label'] as string | undefined,
        value: element.props.value as string | undefined,
        onChange: element.props.onChange as
          | ((event: { target: { value: string } }) => void)
          | undefined,
      });
    }
    walk(element.props.children);
  };
  walk(node);
  return { buttons, inputs };
}

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

  // ── T-1829 활성/비활성 토글 진입점 (onToggleActive optional prop) ──────────────

  // happy-path — onToggleActive 전달 시 각 행에 토글 버튼이 행 수만큼 렌더된다(활성 2 행이므로
  // 라벨은 둘 다 '비활성화').
  it('onToggleActive 전달 시 각 행에 토글 버튼을 행 수만큼 렌더한다 (happy-path — T-1829)', () => {
    const html = renderToStaticMarkup(
      <CollectionTargetList
        targets={sampleTargets}
        onToggleActive={() => undefined}
      />,
    );
    expect((html.match(/<button type="button">/g) ?? []).length).toBe(2);
    expect((html.match(new RegExp(DEACTIVATE_LABEL, 'g')) ?? []).length).toBe(2);
    expect(html).not.toContain(DELETE_LABEL);
  });

  // happy-path(콜백) — 토글 클릭 시 (row.id, 다음 상태) 2 인자로 호출된다. 활성 행이므로 다음
  // 상태는 false 다(호출부가 현재 상태를 다시 계산할 필요가 없다는 계약의 핵심).
  it('토글 클릭 시 (id, nextActive) 2 인자로 onToggleActive 를 호출한다 (happy-path — 콜백 발화, T-1829)', () => {
    const onToggleActive = vi.fn();
    const tree = CollectionTargetList({ targets: sampleTargets, onToggleActive });
    const buttons = collectLabeledButtons(tree);
    expect(buttons).toHaveLength(2);
    buttons[0]?.onClick?.();
    expect(onToggleActive).toHaveBeenLastCalledWith('t1', false);
    buttons[1]?.onClick?.();
    expect(onToggleActive).toHaveBeenLastCalledWith('t2', false);
    expect(onToggleActive).toHaveBeenCalledTimes(2);
  });

  // 분기 (a)(b) — 라벨과 다음 상태는 행의 현재 active 에서 파생한다. active 누락 행은 schema
  // 기본값(true) 대로 활성 취급이라 active: true 행과 완전히 같게 동작한다.
  it.each([
    ['active=true', { active: true }, DEACTIVATE_LABEL, false],
    ['active=false', { active: false }, ACTIVATE_LABEL, true],
    ['active 필드 누락', {}, DEACTIVATE_LABEL, false],
    ['active=undefined', { active: undefined }, DEACTIVATE_LABEL, false],
  ])(
    '%s 행은 라벨과 다음 상태를 현재 상태에서 파생한다 (분기 (a)(b) — 라벨/다음 상태)',
    (_label, patch, expectedLabel, expectedNext) => {
      const onToggleActive = vi.fn();
      const row = { ...sampleTargets[0], ...patch } as CollectionTargetRow;
      const buttons = collectLabeledButtons(
        CollectionTargetList({ targets: [row], onToggleActive }),
      );
      expect(buttons).toHaveLength(1);
      expect(buttons[0]?.label).toBe(expectedLabel);
      buttons[0]?.onClick?.();
      expect(onToggleActive).toHaveBeenCalledWith('t1', expectedNext);
    },
  );

  // 분기 (c) / negative — onToggleActive 미전달이면 토글 버튼이 0 개다(하위 호환 — T-1825 읽기
  // 전용 마운트와 T-1828 삭제 전용 마운트가 글자 그대로 보존된다).
  it('onToggleActive 미전달 시 토글 버튼을 렌더하지 않는다 (분기 (c) — 하위 호환)', () => {
    const readOnly = renderToStaticMarkup(
      <CollectionTargetList targets={sampleTargets} />,
    );
    expect(readOnly).not.toContain(DEACTIVATE_LABEL);
    expect(readOnly).not.toContain(ACTIVATE_LABEL);
    expect(readOnly).not.toContain('<button');
    // 삭제만 전달한 마운트에도 토글 버튼은 붙지 않는다(축 독립).
    const deleteOnly = renderToStaticMarkup(
      <CollectionTargetList targets={sampleTargets} onDelete={() => undefined} />,
    );
    expect(deleteOnly).not.toContain(DEACTIVATE_LABEL);
    expect((deleteOnly.match(new RegExp(DELETE_LABEL, 'g')) ?? []).length).toBe(2);
  });

  // negative — 두 콜백을 함께 주면 행마다 토글 + 삭제 2 개가 붙고, 토글이 먼저 온다(되돌릴 수
  // 있는 동작이 파괴적 동작보다 앞).
  it('onToggleActive 와 onDelete 를 함께 주면 행마다 토글·삭제 2 버튼이 순서대로 붙는다 (negative — 축 공존)', () => {
    const buttons = collectLabeledButtons(
      CollectionTargetList({
        targets: [sampleTargets[0]],
        onDelete: () => undefined,
        onToggleActive: () => undefined,
      }),
    );
    expect(buttons.map((b) => b.label)).toEqual([DEACTIVATE_LABEL, DELETE_LABEL]);
  });

  // negative — loading · error 분기에서는 onToggleActive 를 줘도 버튼이 렌더되지 않는다
  // (분기 순서가 populated 에 도달하지 않는다).
  it.each([
    ['loading=true', { loading: true }, LOADING_TOKEN],
    ['error truthy', { error: '조회에 실패했습니다' }, '조회에 실패했습니다'],
  ])(
    'onToggleActive 전달 + %s 이면 버튼 대신 상태 표시만 렌더한다 (negative — 분기 우선순위)',
    (_label, extra, token) => {
      const html = renderToStaticMarkup(
        <CollectionTargetList
          targets={sampleTargets}
          onToggleActive={() => undefined}
          {...extra}
        />,
      );
      expect(html).not.toContain('<button');
      expect(html).toContain(token);
    },
  );

  // negative — 빈 목록에서는 onToggleActive 를 줘도 버튼이 0 개다(행이 없으므로 — 경계값).
  it('onToggleActive 전달 + 빈 목록이면 버튼 0 개이고 빈 상태 문구만 렌더한다 (negative — 경계값)', () => {
    const html = renderToStaticMarkup(
      <CollectionTargetList targets={[]} onToggleActive={() => undefined} />,
    );
    expect(html).not.toContain('<button');
    expect(html).toContain(DEFAULT_EMPTY);
  });

  // negative — 토글 버튼 도입 후에도 표시 축(span 개수·비활성 표식)은 그대로다(표시 회귀 0).
  // 비활성 행은 표식이 '비활성' 이고 라벨이 '활성화' 라 두 문자열이 겹치지 않는지도 함께 잠근다.
  it('onToggleActive 전달이 기존 표시 축을 바꾸지 않는다 (negative — 표시 회귀 0)', () => {
    const inactiveRow = [{ ...sampleTargets[0], active: false }];
    const withToggle = renderToStaticMarkup(
      <CollectionTargetList targets={inactiveRow} onToggleActive={() => undefined} />,
    );
    const readOnly = renderToStaticMarkup(
      <CollectionTargetList targets={inactiveRow} />,
    );
    const spanCount = (html: string) => (html.match(/<span>/g) ?? []).length;
    expect(spanCount(withToggle)).toBe(spanCount(readOnly));
    expect(withToggle).toContain(`<span>${INACTIVE_BADGE}</span>`);
    expect(withToggle).toContain(`>${ACTIVATE_LABEL}</button>`);
  });

  // negative — id 가 빈 문자열인 계약 위반 row 여도 렌더는 throw 하지 않고, 클릭은 그 값을 그대로
  // 콜백에 넘긴다(판정은 컨테이너 러너 몫 — 목록은 값을 교정하지 않는다).
  it('id 가 빈 문자열인 row 도 throw 없이 렌더하고 그 값을 그대로 토글 콜백에 넘긴다 (negative — 계약 위반 입력)', () => {
    const onToggleActive = vi.fn();
    const broken = [{ ...sampleTargets[0], id: '' }];
    expect(() =>
      renderToStaticMarkup(
        <CollectionTargetList targets={broken} onToggleActive={onToggleActive} />,
      ),
    ).not.toThrow();
    collectLabeledButtons(
      CollectionTargetList({ targets: broken, onToggleActive }),
    )[0]?.onClick?.();
    expect(onToggleActive).toHaveBeenCalledWith('', false);
  });

  // negative — active 가 boolean 이 아닌 계약 위반 값(문자열 등)이어도 `!== false` 기준이라
  // 활성으로 흡수되고 throw 하지 않는다(목록은 값을 판정하지 않는다).
  it.each([
    ['문자열 "false"', 'false'],
    ['숫자 0', 0],
    ['null', null],
  ])(
    'active 가 %s 인 계약 위반 row 도 활성으로 흡수해 렌더한다 (negative — type mismatch)',
    (_label, value) => {
      const onToggleActive = vi.fn();
      const broken = [
        { ...sampleTargets[0], active: value } as unknown as CollectionTargetRow,
      ];
      const buttons = collectLabeledButtons(
        CollectionTargetList({ targets: broken, onToggleActive }),
      );
      expect(buttons[0]?.label).toBe(DEACTIVATE_LABEL);
      buttons[0]?.onClick?.();
      expect(onToggleActive).toHaveBeenCalledWith('t1', false);
    },
  );

  // -- T-1831 값 편집(endpoint) 축 (onEditStart / editingId / 폼 controlled props) --

  // happy-path — onEditStart 전달 시 각 행에 "편집" 버튼이 행 수만큼 렌더된다.
  it('onEditStart 전달 시 각 행에 편집 버튼을 행 수만큼 렌더한다 (happy-path — T-1831)', () => {
    const html = renderToStaticMarkup(
      <CollectionTargetList
        targets={sampleTargets}
        onEditStart={() => undefined}
      />,
    );
    expect(
      (html.match(new RegExp(`>${EDIT_LABEL}</button>`, 'g')) ?? []).length,
    ).toBe(sampleTargets.length);
  });

  // happy-path — 편집 클릭 시 (id, 현재 endpoint) 2 인자로 호출한다(현재 값 동봉 계약).
  it('편집 클릭 시 (id, 현재 endpoint) 2 인자로 onEditStart 를 호출한다 (happy-path — 현재 값 동봉)', () => {
    const onEditStart = vi.fn();
    const { buttons } = collectEditNodes(
      CollectionTargetList({ targets: sampleTargets, onEditStart }),
    );
    buttons.filter((b) => b.label === EDIT_LABEL)[1]?.onClick?.();
    expect(onEditStart).toHaveBeenCalledWith('t2', 'https://conf.example.com');
    expect(onEditStart).toHaveBeenCalledTimes(1);
  });

  // 분기 / negative — onEditStart 미전달이면 편집 버튼이 0 개다(하위 호환 — 읽기 축 회귀 0).
  it('onEditStart 미전달 시 편집 버튼을 렌더하지 않는다 (분기 — 하위 호환 / negative)', () => {
    const readOnly = renderToStaticMarkup(
      <CollectionTargetList targets={sampleTargets} />,
    );
    expect(readOnly).not.toContain(EDIT_LABEL);
    // 삭제·토글만 준 기존 마운트에도 편집 버튼이 섞이지 않는다(선행 slice 회귀 0).
    const others = renderToStaticMarkup(
      <CollectionTargetList
        targets={sampleTargets}
        onDelete={() => undefined}
        onToggleActive={() => undefined}
      />,
    );
    expect(others).not.toContain(`>${EDIT_LABEL}</button>`);
  });

  // 분기 — editingId 와 같은 행에만 인라인 폼이 뜨고, 나머지 행은 편집 버튼 그대로다.
  it('editingId 와 일치하는 행에만 폼을 렌더하고 나머지 행은 편집 버튼이다 (분기 — 행 격리)', () => {
    const { buttons, inputs } = collectEditNodes(
      CollectionTargetList({
        targets: sampleTargets,
        onEditStart: () => undefined,
        editingId: 't1',
        editEndpoint: 'https://new.example.com',
      }),
    );
    expect(inputs).toHaveLength(1);
    expect(inputs[0]?.value).toBe('https://new.example.com');
    expect(inputs[0]?.label).toBe(EDIT_INPUT_LABEL);
    // 편집 중인 행에는 편집 버튼 대신 저장·취소가, 다른 행에는 편집 버튼이 남는다.
    expect(buttons.map((b) => b.label)).toEqual([
      SAVE_LABEL,
      CANCEL_LABEL,
      EDIT_LABEL,
    ]);
  });

  // 분기 / negative — editingId 가 어떤 행과도 일치하지 않으면 폼이 0 개다(경계값).
  it.each([
    ['어떤 행과도 불일치', 'no-such-row'],
    ['빈 문자열', ''],
    ['undefined', undefined],
  ])(
    'editingId 가 %s 면 인라인 폼을 렌더하지 않는다 (분기 / negative — 불일치)',
    (_label, editingId) => {
      const { inputs, buttons } = collectEditNodes(
        CollectionTargetList({
          targets: sampleTargets,
          onEditStart: () => undefined,
          editingId,
        }),
      );
      expect(inputs).toHaveLength(0);
      expect(buttons.every((b) => b.label === EDIT_LABEL)).toBe(true);
    },
  );

  // 분기 — editBusy 면 저장 버튼이 disabled 다(이중 발사 화면 차단). 취소는 잠기지 않는다.
  it.each([
    ['true', true, true],
    ['false', false, false],
    ['미전달', undefined, false],
  ])(
    'editBusy 가 %s 면 저장 버튼 disabled 는 %s 다 (분기 — 이중 저장 차단)',
    (_label, editBusy, expected) => {
      const { buttons } = collectEditNodes(
        CollectionTargetList({
          targets: sampleTargets,
          editingId: 't1',
          editBusy: editBusy as boolean | undefined,
        }),
      );
      const save = buttons.find((b) => b.label === SAVE_LABEL);
      const cancel = buttons.find((b) => b.label === CANCEL_LABEL);
      expect(save?.disabled).toBe(expected);
      // 취소는 진행 중에도 열려 있어야 한다(disabled prop 자체를 주지 않는다 — 막힌
      // 사용자가 빠져나갈 길 보존).
      expect(cancel?.disabled).toBeUndefined();
    },
  );

  // happy-path — 저장 클릭은 row.id 로, 취소 클릭은 인자 없이 호출된다.
  it('저장 클릭은 row.id 로, 취소 클릭은 인자 없이 콜백을 호출한다 (happy-path — 폼 콜백)', () => {
    const onEditSubmit = vi.fn();
    const onEditCancel = vi.fn();
    const { buttons } = collectEditNodes(
      CollectionTargetList({
        targets: sampleTargets,
        editingId: 't2',
        onEditSubmit,
        onEditCancel,
      }),
    );
    buttons.find((b) => b.label === SAVE_LABEL)?.onClick?.();
    buttons.find((b) => b.label === CANCEL_LABEL)?.onClick?.();
    expect(onEditSubmit).toHaveBeenCalledWith('t2');
    expect(onEditCancel).toHaveBeenCalledWith();
  });

  // happy-path / negative — 입력 변경은 변경된 문자열을 그대로 콜백에 넘긴다(trim·검증은 컨테이너 몫).
  it.each([
    ['일반 URL', 'https://x.example.com'],
    ['공백뿐', '   '],
    ['빈 문자열', ''],
  ])(
    '입력이 %s 로 바뀌면 그 값을 그대로 onEditEndpointChange 에 넘긴다 (happy-path / negative)',
    (_label, next) => {
      const onEditEndpointChange = vi.fn();
      const { inputs } = collectEditNodes(
        CollectionTargetList({
          targets: sampleTargets,
          editingId: 't1',
          editEndpoint: 'old',
          onEditEndpointChange,
        }),
      );
      inputs[0]?.onChange?.({ target: { value: next } });
      expect(onEditEndpointChange).toHaveBeenCalledWith(next);
    },
  );

  // negative — 폼 콜백 3 종을 하나도 주지 않아도 렌더·클릭·입력이 throw 하지 않는다(optional).
  it('폼 콜백 미전달 상태에서 클릭·입력해도 throw 하지 않는다 (negative — optional 경로)', () => {
    const tree = CollectionTargetList({
      targets: sampleTargets,
      editingId: 't1',
    });
    expect(() => renderToStaticMarkup(tree)).not.toThrow();
    const { buttons, inputs } = collectEditNodes(tree);
    expect(() => buttons.forEach((b) => b.onClick?.())).not.toThrow();
    expect(() =>
      inputs[0]?.onChange?.({ target: { value: 'x' } }),
    ).not.toThrow();
  });

  // negative — editEndpoint 미전달이면 controlled 입력이 빈 문자열이다(uncontrolled 경고 회피).
  it('editEndpoint 미전달 시 입력 값은 빈 문자열이다 (negative — 경계값)', () => {
    const { inputs } = collectEditNodes(
      CollectionTargetList({ targets: sampleTargets, editingId: 't1' }),
    );
    expect(inputs[0]?.value).toBe('');
  });

  // negative — endpoint 가 없는 계약 위반 row 도 편집 진입이 throw 하지 않고 값을 그대로 넘긴다
  // (목록은 값을 교정하지 않는다 — 판정은 컨테이너 러너 몫).
  it('endpoint 누락 row 의 편집 클릭도 throw 없이 값을 그대로 넘긴다 (negative — 계약 위반 입력)', () => {
    const onEditStart = vi.fn();
    const broken = [
      {
        ...sampleTargets[0],
        endpoint: undefined,
      } as unknown as CollectionTargetRow,
    ];
    const { buttons } = collectEditNodes(
      CollectionTargetList({ targets: broken, onEditStart }),
    );
    expect(() => buttons[0]?.onClick?.()).not.toThrow();
    expect(onEditStart).toHaveBeenCalledWith('t1', undefined);
  });

  // negative — loading / error / 빈 목록 분기에서는 편집 props 를 줘도 폼·버튼이 렌더되지 않는다
  // (분기 우선순위 — 삭제·토글 축과 동일 기준).
  it.each([
    ['loading', { loading: true }, LOADING_TOKEN],
    ['error', { error: '조회 실패' }, '조회 실패'],
    ['빈 목록', { targets: [] }, DEFAULT_EMPTY],
  ])(
    '편집 props 전달 + %s 이면 폼 대신 상태 표시만 렌더한다 (negative — 분기 우선순위)',
    (_label, override, token) => {
      const html = renderToStaticMarkup(
        <CollectionTargetList
          targets={sampleTargets}
          onEditStart={() => undefined}
          editingId="t1"
          editEndpoint="x"
          {...(override as object)}
        />,
      );
      expect(html).not.toContain('<button');
      expect(html).not.toContain('<input');
      expect(html).toContain(token);
    },
  );

  // negative — 편집 축 도입 후에도 표시 축(span 개수)과 삭제·토글 버튼 배선은 그대로다.
  it('편집 축을 얹어도 표시 축·삭제·토글 배선이 그대로다 (negative — 선행 slice 회귀 0)', () => {
    const spanCount = (html: string) => (html.match(/<span>/g) ?? []).length;
    const base = renderToStaticMarkup(
      <CollectionTargetList
        targets={sampleTargets}
        onDelete={() => undefined}
        onToggleActive={() => undefined}
      />,
    );
    const withEdit = renderToStaticMarkup(
      <CollectionTargetList
        targets={sampleTargets}
        onDelete={() => undefined}
        onToggleActive={() => undefined}
        onEditStart={() => undefined}
      />,
    );
    expect(spanCount(withEdit)).toBe(spanCount(base));
    expect(withEdit).toContain(`>${DELETE_LABEL}</button>`);
    expect(withEdit).toContain(`>${DEACTIVATE_LABEL}</button>`);
  });
  // -- T-1832 범위 배열 3 축(orgs/repos/spaces) 인라인 편집 --

  // happy-path / 분기 — GITHUB 행은 orgs·repos 2 입력만, CONFLUENCE 행은 spaces 1 입력만 뜬다.
  it.each([
    ['GITHUB', 't1', [ORGS_INPUT_LABEL, REPOS_INPUT_LABEL]],
    ['CONFLUENCE', 't2', [SPACES_INPUT_LABEL]],
  ])(
    'type=%s 인 편집 행에는 그 type 의 범위 입력만 렌더한다 (happy-path / 분기 — type 별 축)',
    (_label, editingId, expected) => {
      const { inputs } = collectEditNodes(
        CollectionTargetList({
          targets: sampleTargets,
          editingId,
          onEditScopeChange: () => undefined,
        }),
      );
      // endpoint 입력이 항상 첫 입력이고 그 뒤로 범위 입력이 따른다.
      expect(inputs.map((i) => i.label)).toEqual([
        EDIT_INPUT_LABEL,
        ...(expected as string[]),
      ]);
    },
  );

  // 분기 / negative — 알 수 없는/누락 type 은 범위 입력 0 개다(endpoint 만 편집).
  it.each([
    ['알 수 없는 값', 'JIRA'],
    ['빈 문자열', ''],
    ['누락', undefined],
  ])(
    'type 이 %s 인 행은 범위 입력을 렌더하지 않는다 (분기 / negative — 미지원 type)',
    (_label, type) => {
      const rows = [
        { ...sampleTargets[0], type } as unknown as CollectionTargetRow,
      ];
      const { inputs } = collectEditNodes(
        CollectionTargetList({
          targets: rows,
          editingId: 't1',
          onEditScopeChange: () => undefined,
        }),
      );
      expect(inputs.map((i) => i.label)).toEqual([EDIT_INPUT_LABEL]);
    },
  );

  // 분기 / negative — onEditScopeChange 미전달이면 범위 입력이 아예 없다(하위 호환 — T-1831
  // 마운트가 글자 그대로 보존된다).
  it('onEditScopeChange 미전달 시 범위 입력을 렌더하지 않는다 (분기 — 하위 호환 / negative)', () => {
    const { inputs } = collectEditNodes(
      CollectionTargetList({
        targets: sampleTargets,
        editingId: 't1',
        editEndpoint: 'https://x.example.com',
        editScopes: { orgs: 'acme', repos: 'acme/web' },
      }),
    );
    expect(inputs.map((i) => i.label)).toEqual([EDIT_INPUT_LABEL]);
  });

  // happy-path — 범위 입력의 controlled 값은 editScopes 의 대응 필드를 그대로 표시한다.
  it('범위 입력은 editScopes 의 대응 값을 그대로 표시한다 (happy-path — controlled)', () => {
    const { inputs } = collectEditNodes(
      CollectionTargetList({
        targets: sampleTargets,
        editingId: 't1',
        editScopes: { orgs: 'acme, beta', repos: 'acme/web', spaces: 'ENG' },
        onEditScopeChange: () => undefined,
      }),
    );
    const byLabel = (label: string) => inputs.find((i) => i.label === label);
    expect(byLabel(ORGS_INPUT_LABEL)?.value).toBe('acme, beta');
    expect(byLabel(REPOS_INPUT_LABEL)?.value).toBe('acme/web');
    // GITHUB 행이라 spaces 입력은 애초에 없다(값이 있어도 렌더되지 않는다).
    expect(byLabel(SPACES_INPUT_LABEL)).toBeUndefined();
  });

  // happy-path — 변경 시 (축 이름, 바뀐 문자열) 2 인자로 콜백을 호출한다.
  it.each([
    [ORGS_INPUT_LABEL, 'orgs', 'acme, beta'],
    [REPOS_INPUT_LABEL, 'repos', 'acme/web'],
  ])(
    '%s 입력 변경은 (%s, 값) 2 인자로 onEditScopeChange 를 호출한다 (happy-path — 축 식별)',
    (label, field, next) => {
      const onEditScopeChange = vi.fn();
      const { inputs } = collectEditNodes(
        CollectionTargetList({
          targets: sampleTargets,
          editingId: 't1',
          onEditScopeChange,
        }),
      );
      inputs
        .find((i) => i.label === label)
        ?.onChange?.({ target: { value: next } });
      expect(onEditScopeChange).toHaveBeenCalledWith(field, next);
      expect(onEditScopeChange).toHaveBeenCalledTimes(1);
    },
  );

  // negative — 빈 문자열·공백뿐·콤마뿐 입력도 그대로 넘긴다(파싱·검증은 컨테이너 러너 몫).
  it.each([
    ['빈 문자열', ''],
    ['공백뿐', '   '],
    ['콤마뿐', ',,,'],
  ])(
    '범위 입력이 %s 로 바뀌어도 값을 그대로 넘긴다 (negative — 정상화 금지)',
    (_label, next) => {
      const onEditScopeChange = vi.fn();
      const { inputs } = collectEditNodes(
        CollectionTargetList({
          targets: sampleTargets,
          editingId: 't2',
          onEditScopeChange,
        }),
      );
      inputs
        .find((i) => i.label === SPACES_INPUT_LABEL)
        ?.onChange?.({ target: { value: next } });
      expect(onEditScopeChange).toHaveBeenCalledWith('spaces', next);
    },
  );

  // negative — editScopes 미전달/부분 전달이어도 controlled 값이 빈 문자열이다(uncontrolled 경고 회피).
  it.each([
    ['미전달', undefined],
    ['빈 객체', {}],
    ['다른 축만 채움', { spaces: 'ENG' }],
  ])(
    'editScopes 가 %s 면 범위 입력 값은 빈 문자열이다 (negative — 경계값)',
    (_label, editScopes) => {
      const { inputs } = collectEditNodes(
        CollectionTargetList({
          targets: sampleTargets,
          editingId: 't1',
          editScopes: editScopes as { orgs?: string },
          onEditScopeChange: () => undefined,
        }),
      );
      expect(inputs.find((i) => i.label === ORGS_INPUT_LABEL)?.value).toBe('');
      expect(inputs.find((i) => i.label === REPOS_INPUT_LABEL)?.value).toBe('');
    },
  );

  // negative — 편집 중이 아닌 행에는 범위 입력이 붙지 않는다(행 격리 — 폼은 한 행에만).
  it('편집 중이 아닌 행에는 범위 입력이 붙지 않는다 (negative — 행 격리)', () => {
    const { inputs } = collectEditNodes(
      CollectionTargetList({
        targets: sampleTargets,
        onEditStart: () => undefined,
        onEditScopeChange: () => undefined,
      }),
    );
    expect(inputs).toHaveLength(0);
  });

  // negative / drift 가드 — 화면이 렌더하는 범위 축이 러너의 wire 축 매핑과 정확히 같다.
  // 두 모듈이 같은 매핑을 따로 갖는 이유는 구현 주석에 적혀 있고(mock 표면 격리), 그 두 벌이
  // 갈라지면 사용자가 편집한 축이 요청에 실리지 않는 결함이 되므로 여기서 잠근다.
  it.each(['GITHUB', 'CONFLUENCE', 'JIRA'])(
    'type=%s 의 화면 범위 축이 러너의 wire 축 매핑과 일치한다 (negative — drift 가드)',
    (type) => {
      const rows = [{ ...sampleTargets[0], type }];
      const { inputs } = collectEditNodes(
        CollectionTargetList({
          targets: rows,
          editingId: 't1',
          onEditScopeChange: () => undefined,
        }),
      );
      // endpoint 입력을 뺀 나머지가 범위 축이다(라벨 규칙 `<축> 수정`).
      const rendered = inputs
        .map((i) => i.label)
        .filter((label) => label !== EDIT_INPUT_LABEL)
        .map((label) => String(label).replace(' 수정', ''));
      expect(rendered).toEqual([...scopeFieldsForCollectionTargetType(type)]);
    },
  );

  // negative — 범위 축을 얹어도 저장·취소 버튼과 삭제·토글 배선은 그대로다(선행 slice 회귀 0).
  it('범위 축을 얹어도 저장·취소·삭제·토글 배선이 그대로다 (negative — 선행 slice 회귀 0)', () => {
    const { buttons } = collectEditNodes(
      CollectionTargetList({
        targets: sampleTargets,
        editingId: 't1',
        onEditStart: () => undefined,
        onDelete: () => undefined,
        onToggleActive: () => undefined,
        onEditScopeChange: () => undefined,
      }),
    );
    const labels = buttons.map((b) => b.label);
    expect(labels).toContain(SAVE_LABEL);
    expect(labels).toContain(CANCEL_LABEL);
    expect(labels).toContain(DELETE_LABEL);
    expect(labels).toContain(DEACTIVATE_LABEL);
  });
});
