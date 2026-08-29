import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import ServiceIdentityList from './ServiceIdentityList';
import type { ServiceIdentityRow } from '../api/serviceIdentity';

// R-112 — ADR-0058 §Follow-ups (d) 의 표시 축 컴포넌트 검증.
// PermissionDeniedRecordList.test.tsx 와 동일 패턴: jsdom · @testing-library 없이
// react-dom/server 의 renderToStaticMarkup 으로 정적 렌더 문자열만 비교해 dep 표면을 0 으로 둔다.
// 파일명은 .test.tsx 고정 — root jest 의 testRegex (.*\.spec\.ts$) pickup 충돌 회피.

// 구현 상수와 정합해야 하는 식별 토큰들(로딩 문구는 U+2026 … 단일 문자).
const LOADING_TOKEN = '불러오는 중';
const DEFAULT_EMPTY = '등록된 service identity 가 없습니다';
const PRIMARY_BADGE = 'primary';

// 정상 목록 2 건 — 첫 행이 primary, 둘째 행이 비-primary(1 인원 1 primary invariant 정합).
const sampleIdentities: ServiceIdentityRow[] = [
  { id: 'i1', personId: 'p1', service: 'github', externalId: 'octo-dev', isPrimary: true },
  { id: 'i2', personId: 'p1', service: 'confluence', externalId: 'octo@example.com', isPrimary: false },
];

describe('ServiceIdentityList', () => {
  // happy-path — identities 2 건 → <ul>/<li> 2 개 + 각 행의 service·externalId 렌더.
  it('identities 2 건 전달 시 <ul>/<li> 2 개와 각 행의 service·externalId 를 렌더한다 (happy-path)', () => {
    const html = renderToStaticMarkup(<ServiceIdentityList identities={sampleIdentities} />);
    expect(html).toContain('<ul>');
    expect((html.match(/<li>/g) ?? []).length).toBe(2);
    expect(html).toContain('github');
    expect(html).toContain('octo-dev');
    expect(html).toContain('confluence');
    expect(html).toContain('octo@example.com');
  });

  // happy-path — primary 행에만 표식이 붙는다(전체 표식 수 = isPrimary true 행 수).
  it('isPrimary=true 인 행에만 primary 표식을 렌더한다 — 표식 1 개 (happy-path, primary 식별)', () => {
    const html = renderToStaticMarkup(<ServiceIdentityList identities={sampleIdentities} />);
    expect(html).toContain(`<span>${PRIMARY_BADGE}</span>`);
    expect((html.match(/<span>primary<\/span>/g) ?? []).length).toBe(1);
    // primary 표식은 primary 행(github) 안에 있어야 한다 — 비-primary 행보다 앞 index.
    expect(html.indexOf(`<span>${PRIMARY_BADGE}</span>`)).toBeLessThan(html.indexOf('confluence'));
  });

  // happy-path(순서 보존) — props 배열 순서를 그대로 렌더한다(내부 정렬·필터 없음).
  it('identities 를 props 순서 그대로 렌더한다 — 첫 행이 둘째보다 앞 index (happy-path, 순서 보존)', () => {
    const reversed = [sampleIdentities[1], sampleIdentities[0]];
    const html = renderToStaticMarkup(<ServiceIdentityList identities={reversed} />);
    expect(html.indexOf('confluence')).toBeLessThan(html.indexOf('github'));
  });

  // error path — error truthy → role="alert" 문구만, 행 0 개.
  it('error truthy 전달 시 role="alert" 문구만 렌더하고 행이 0 개다 (error path)', () => {
    const html = renderToStaticMarkup(
      <ServiceIdentityList identities={[]} error="identity 를 불러오지 못했습니다" />,
    );
    expect(html).toContain('role="alert"');
    expect(html).toContain('identity 를 불러오지 못했습니다');
    expect(html).not.toContain('<ul>');
    expect((html.match(/<li>/g) ?? []).length).toBe(0);
  });

  // error path(우선) — error 와 identities 동시 전달 → error 우선, 목록 미렌더.
  it('error 와 identities 동시 전달 시 error 우선·목록 미렌더 (error path — error 우선)', () => {
    const html = renderToStaticMarkup(
      <ServiceIdentityList identities={sampleIdentities} error="조회 실패" />,
    );
    expect(html).toContain('role="alert"');
    expect(html).toContain('조회 실패');
    expect(html).not.toContain('<ul>');
    expect(html).not.toContain('github');
  });

  // branch — loading=true → role="status" + 로딩 문구, 목록·빈 상태 미렌더.
  it('loading=true 면 role="status" + 로딩 문구를 렌더하고 목록·빈 상태는 미렌더 (branch — loading)', () => {
    const html = renderToStaticMarkup(<ServiceIdentityList identities={[]} loading={true} />);
    expect(html).toContain('role="status"');
    expect(html).toContain(LOADING_TOKEN);
    // 말줄임표는 U+2026(…) 단일 문자여야 한다 — "..." 3 점이 아니다.
    expect(html).toContain('불러오는 중…');
    expect(html).not.toContain('불러오는 중...');
    expect(html).not.toContain(DEFAULT_EMPTY);
    expect(html).not.toContain('<ul>');
  });

  // branch — 빈 배열 + loading/error 미전달 → 기본 빈 상태 문구, 목록 미렌더.
  it('빈 배열 + loading/error 미전달 → 기본 빈 상태 문구 렌더·목록 미렌더 (branch — empty)', () => {
    const html = renderToStaticMarkup(<ServiceIdentityList identities={[]} />);
    expect(html).toContain('role="status"');
    expect(html).toContain(DEFAULT_EMPTY);
    expect(html).not.toContain('<ul>');
    expect(html).not.toContain('<li>');
  });

  // branch(우선순위) — loading=true 는 error·identities 가 모두 있어도 로딩 표시만.
  it('loading=true 는 error·identities 가 모두 있어도 로딩 표시만 렌더한다 (branch — 우선순위)', () => {
    const html = renderToStaticMarkup(
      <ServiceIdentityList identities={sampleIdentities} loading={true} error="에러 문구" />,
    );
    expect(html).toContain('role="status"');
    expect(html).toContain(LOADING_TOKEN);
    expect(html).not.toContain('role="alert"');
    expect(html).not.toContain('에러 문구');
    expect(html).not.toContain('<ul>');
    expect(html).not.toContain('github');
  });

  // negative ① — 빈 배열이면 기본 빈 상태 문구로 안내한다(빈 <ul> 렌더 금지).
  it('negative ① 빈 배열 → 기본 빈 상태 문구를 렌더하고 <ul> 은 렌더하지 않는다', () => {
    const html = renderToStaticMarkup(<ServiceIdentityList identities={[]} />);
    expect(html).toBe(`<div role="status">${DEFAULT_EMPTY}</div>`);
  });

  // negative ② — emptyMessage='' (경계값) 는 기본 문구로 fallback(빈 메시지 방지).
  it('negative ② emptyMessage="" (경계값) → 기본 문구로 fallback 한다', () => {
    const html = renderToStaticMarkup(<ServiceIdentityList identities={[]} emptyMessage="" />);
    expect(html).toContain('role="status"');
    expect(html).toContain(DEFAULT_EMPTY);
  });

  // negative ②' — custom emptyMessage 는 기본 문구 대신 그대로 렌더(양쪽 분기 cover).
  it('negative ②\' custom emptyMessage → 기본 문구 대신 custom 문구를 렌더한다', () => {
    const custom = '이 인원에 연결된 계정이 아직 없습니다';
    const html = renderToStaticMarkup(<ServiceIdentityList identities={[]} emptyMessage={custom} />);
    expect(html).toContain(custom);
    expect(html).not.toContain(DEFAULT_EMPTY);
  });

  // negative ③ — error='' (falsy 경계값) 는 alert 분기에 진입하지 않는다(빈 배열·populated 양쪽).
  it('negative ③ error="" (falsy 경계값) → alert 분기 미진입 — 빈 배열이면 빈 상태 문구', () => {
    const html = renderToStaticMarkup(<ServiceIdentityList identities={[]} error="" />);
    expect(html).not.toContain('role="alert"');
    expect(html).toContain('role="status"');
    expect(html).toContain(DEFAULT_EMPTY);
  });

  it('negative ③\' error="" (falsy 경계값) + identities 있음 → alert 미렌더·목록 정상 렌더', () => {
    const html = renderToStaticMarkup(<ServiceIdentityList identities={sampleIdentities} error="" />);
    expect(html).not.toContain('role="alert"');
    expect(html).toContain('<ul>');
    expect(html).toContain('github');
  });

  // negative ④ — isPrimary 가 전부 false 면 primary 표식이 0 개다.
  it('negative ④ isPrimary 가 전부 false → primary 표식 0 개, 행은 정상 렌더', () => {
    const noPrimary: ServiceIdentityRow[] = [
      { id: 'n1', personId: 'p2', service: 'github', externalId: 'a-dev', isPrimary: false },
      { id: 'n2', personId: 'p2', service: 'jira', externalId: 'b-dev', isPrimary: false },
    ];
    const html = renderToStaticMarkup(<ServiceIdentityList identities={noPrimary} />);
    expect((html.match(/<span>primary<\/span>/g) ?? []).length).toBe(0);
    expect((html.match(/<li>/g) ?? []).length).toBe(2);
    expect(html).toContain('a-dev');
    expect(html).toContain('b-dev');
  });

  // negative ⑤ — isPrimary=true 2 건(ADR-0058 §Decision 2 계약 위반 입력)에도 throw 없이 렌더.
  // 컴포넌트가 invariant 를 강제하지 않고 받은 그대로 표시함을 고정한다(강제는 backend 책임).
  it('negative ⑤ isPrimary=true 2 건(계약 위반) → throw 없이 표식 2 개를 그대로 렌더한다', () => {
    const twoPrimary: ServiceIdentityRow[] = [
      { id: 'd1', personId: 'p3', service: 'github', externalId: 'x-dev', isPrimary: true },
      { id: 'd2', personId: 'p3', service: 'jira', externalId: 'y-dev', isPrimary: true },
    ];
    let html = '';
    expect(() => {
      html = renderToStaticMarkup(<ServiceIdentityList identities={twoPrimary} />);
    }).not.toThrow();
    expect((html.match(/<span>primary<\/span>/g) ?? []).length).toBe(2);
    expect((html.match(/<li>/g) ?? []).length).toBe(2);
  });

  // negative ⑥ — externalId 가 빈 문자열이어도 throw 없이 해당 행이 렌더된다.
  it('negative ⑥ externalId 가 빈 문자열 → throw 없이 해당 행을 렌더한다', () => {
    const emptyExternal: ServiceIdentityRow[] = [
      { id: 'e1', personId: 'p4', service: 'github', externalId: '', isPrimary: false },
    ];
    let html = '';
    expect(() => {
      html = renderToStaticMarkup(<ServiceIdentityList identities={emptyExternal} />);
    }).not.toThrow();
    expect((html.match(/<li>/g) ?? []).length).toBe(1);
    expect(html).toContain('github');
  });

  // negative ⑦(추가) — createdAt/updatedAt optional 필드가 와도 markup 에 노출하지 않는다
  // (표시 컬럼은 service·externalId·primary 표식뿐이라는 경계 고정).
  it('negative ⑦ createdAt/updatedAt 이 있어도 표시 컬럼 외 값은 markup 에 노출하지 않는다', () => {
    const withTimestamps: ServiceIdentityRow[] = [
      { id: 't1', personId: 'p5', service: 'github', externalId: 'ts-dev', isPrimary: false, createdAt: '2026-08-01T00:00:00.000Z', updatedAt: '2026-08-02T00:00:00.000Z' },
    ];
    const html = renderToStaticMarkup(<ServiceIdentityList identities={withTimestamps} />);
    expect(html).not.toContain('2026-08-01T00:00:00.000Z');
    expect(html).not.toContain('2026-08-02T00:00:00.000Z');
    expect(html).not.toContain('p5');
    expect(html).not.toContain('t1');
  });

  // negative ⑧(추가) — 다건 렌더에서 <li> 수 = identities 수(중복·누락 없음).
  it('negative ⑧ 다건 identities → <li> 수 = identities 수 (중복·누락 없음)', () => {
    const many: ServiceIdentityRow[] = [
      { id: 'm1', personId: 'p6', service: 'github', externalId: 'g1', isPrimary: true },
      { id: 'm2', personId: 'p6', service: 'confluence', externalId: 'c1', isPrimary: false },
      { id: 'm3', personId: 'p6', service: 'jira', externalId: 'j1', isPrimary: false },
    ];
    const html = renderToStaticMarkup(<ServiceIdentityList identities={many} />);
    expect((html.match(/<li>/g) ?? []).length).toBe(3);
    expect((html.match(/<span>primary<\/span>/g) ?? []).length).toBe(1);
  });

  // ── T-1774 행별 액션 slot(renderRowActions) ────────────────────────────────
  // slot 미전달 시의 populated markup 정본 — "바이트 단위 동일" 회귀 판정 기준선이다.
  const BASELINE_MARKUP =
    '<ul>' +
    '<li><span>github</span><span>octo-dev</span><span>primary</span></li>' +
    '<li><span>confluence</span><span>octo@example.com</span></li>' +
    '</ul>';

  // 호출 인자를 기록하며 행마다 식별 가능한 노드를 돌려주는 slot 을 만든다(vi.fn 없이 순수 클로저).
  function makeSlot() {
    const calls: ServiceIdentityRow[] = [];
    return {
      calls,
      slot: (identity: ServiceIdentityRow) => {
        calls.push(identity);
        return <b>{`action-${identity.id}`}</b>;
      },
    };
  }

  // happy-path — slot 이 행마다 정확히 1 회, 배열 순서대로 그 행 객체로 호출된다.
  it('slot 전달 시 identities 순서대로 행마다 정확히 1 회 그 행 객체로 호출한다 (happy-path)', () => {
    const { slot, calls } = makeSlot();
    const html = renderToStaticMarkup(
      <ServiceIdentityList identities={sampleIdentities} renderRowActions={slot} />,
    );
    expect(calls.length).toBe(2);
    // 인자는 복제본이 아니라 props 배열의 그 행 객체 자체여야 한다(참조 동일성).
    expect(calls[0]).toBe(sampleIdentities[0]);
    expect(calls[1]).toBe(sampleIdentities[1]);
    expect(html).toContain('<b>action-i1</b>');
    expect(html).toContain('<b>action-i2</b>');
  });

  // happy-path — 반환 노드는 해당 행의 <li> 안, 표시 컬럼 뒤에 위치한다.
  it('slot 반환 노드는 해당 행의 <li> 안·표시 컬럼 뒤에 렌더된다 (happy-path, 행 귀속)', () => {
    const { slot } = makeSlot();
    const html = renderToStaticMarkup(
      <ServiceIdentityList identities={sampleIdentities} renderRowActions={slot} />,
    );
    const secondLi = html.indexOf('<li>', html.indexOf('<li>') + 1);
    const firstAction = html.indexOf('<b>action-i1</b>');
    // 첫 행의 액션은 그 행의 externalId 뒤이면서 둘째 <li> 시작 전이어야 한다.
    expect(firstAction).toBeGreaterThan(html.indexOf('octo-dev'));
    expect(firstAction).toBeLessThan(secondLi);
    // primary 표식(표시 컬럼) 뒤에 온다.
    expect(firstAction).toBeGreaterThan(html.indexOf(`<span>${PRIMARY_BADGE}</span>`));
    // 둘째 행의 액션은 둘째 <li> 안이며 </ul> 앞이다.
    const secondAction = html.indexOf('<b>action-i2</b>');
    expect(secondAction).toBeGreaterThan(secondLi);
    expect(secondAction).toBeLessThan(html.indexOf('</ul>'));
    // 액션이 <ul> 밖으로 새지 않는다.
    expect(html.endsWith('</ul>')).toBe(true);
  });

  // error path — slot 이 throw 하면 렌더가 삼키지 않고 상위로 전파한다(error boundary 흉내 금지).
  it('slot 이 throw 하면 예외를 삼키지 않고 상위로 전파한다 (error path)', () => {
    const boom = () => {
      throw new Error('slot 렌더 실패');
    };
    expect(() =>
      renderToStaticMarkup(
        <ServiceIdentityList identities={sampleIdentities} renderRowActions={boom} />,
      ),
    ).toThrow('slot 렌더 실패');
  });

  // error path — error 분기에서는 slot 호출 0 이고 alert 문구만 렌더된다.
  it('error truthy 분기에서는 slot 호출 0 이고 alert 문구만 렌더한다 (error path — slot 미호출)', () => {
    const { slot, calls } = makeSlot();
    const html = renderToStaticMarkup(
      <ServiceIdentityList identities={sampleIdentities} error="조회 실패" renderRowActions={slot} />,
    );
    expect(calls.length).toBe(0);
    expect(html).toBe('<div role="alert">조회 실패</div>');
  });

  // 분기 cover — [1] loading / [2] error / [3] empty / [4] populated 의 slot 호출 횟수 0/0/0/N.
  it('4 분기의 slot 호출 횟수를 0/0/0/N 으로 고정한다 (분기 cover)', () => {
    const loadingSlot = makeSlot();
    renderToStaticMarkup(
      <ServiceIdentityList
        identities={sampleIdentities}
        loading={true}
        renderRowActions={loadingSlot.slot}
      />,
    );
    expect(loadingSlot.calls.length).toBe(0);

    const errorSlot = makeSlot();
    renderToStaticMarkup(
      <ServiceIdentityList
        identities={sampleIdentities}
        error="실패"
        renderRowActions={errorSlot.slot}
      />,
    );
    expect(errorSlot.calls.length).toBe(0);

    const emptySlot = makeSlot();
    renderToStaticMarkup(
      <ServiceIdentityList identities={[]} renderRowActions={emptySlot.slot} />,
    );
    expect(emptySlot.calls.length).toBe(0);

    const populatedSlot = makeSlot();
    renderToStaticMarkup(
      <ServiceIdentityList identities={sampleIdentities} renderRowActions={populatedSlot.slot} />,
    );
    expect(populatedSlot.calls.length).toBe(sampleIdentities.length);
  });

  // negative (a) — slot 미전달 시 markup 이 slot 도입 전과 바이트 단위로 동일하다(호출부 회귀 0).
  it('negative (a) slot 미전달 → markup 이 종전과 바이트 단위로 동일하다', () => {
    const html = renderToStaticMarkup(<ServiceIdentityList identities={sampleIdentities} />);
    expect(html).toBe(BASELINE_MARKUP);
  });

  // negative (b) — slot 이 null 을 돌려줘도 throw 없이 그 행이 정상 렌더된다.
  it('negative (b) slot 이 null 반환 → throw 없이 행이 정상 렌더된다', () => {
    let html = '';
    expect(() => {
      html = renderToStaticMarkup(
        <ServiceIdentityList identities={sampleIdentities} renderRowActions={() => null} />,
      );
    }).not.toThrow();
    expect(html).toBe(BASELINE_MARKUP);
  });

  // negative (c) — slot 이 undefined 를 돌려줘도 동일하다.
  it('negative (c) slot 이 undefined 반환 → throw 없이 행이 정상 렌더된다', () => {
    let html = '';
    expect(() => {
      html = renderToStaticMarkup(
        <ServiceIdentityList identities={sampleIdentities} renderRowActions={() => undefined} />,
      );
    }).not.toThrow();
    expect(html).toBe(BASELINE_MARKUP);
  });

  // negative (d) — identities 가 빈 배열이면 slot 호출 0(존재하지 않는 행의 액션 노출 차단).
  it('negative (d) identities 빈 배열 → slot 호출 0, 빈 상태 문구만 렌더', () => {
    const { slot, calls } = makeSlot();
    const html = renderToStaticMarkup(
      <ServiceIdentityList identities={[]} renderRowActions={slot} />,
    );
    expect(calls.length).toBe(0);
    expect(html).toBe(`<div role="status">${DEFAULT_EMPTY}</div>`);
  });

  // negative (e) — loading=true 가 identities 다건 + slot 동시 전달보다 우선한다(slot 호출 0).
  it('negative (e) loading=true 는 identities·slot 동시 전달보다 우선 → slot 호출 0', () => {
    const { slot, calls } = makeSlot();
    const html = renderToStaticMarkup(
      <ServiceIdentityList identities={sampleIdentities} loading={true} renderRowActions={slot} />,
    );
    expect(calls.length).toBe(0);
    expect(html).toContain(LOADING_TOKEN);
    expect(html).not.toContain('<b>');
  });

  // negative (f) — slot 이 다른 행의 노드를 돌려줘도 컴포넌트는 교정하지 않고 받은 대로 렌더한다.
  it('negative (f) slot 이 다른 행의 노드를 반환해도 교정 없이 받은 대로 렌더한다', () => {
    // 어느 행을 받든 항상 첫 행 id 의 노드를 돌려주는 어긋난 slot(판정은 상위 책임).
    const html = renderToStaticMarkup(
      <ServiceIdentityList
        identities={sampleIdentities}
        renderRowActions={() => <b>{`action-${sampleIdentities[0].id}`}</b>}
      />,
    );
    expect((html.match(/<b>action-i1<\/b>/g) ?? []).length).toBe(2);
    expect(html).not.toContain('action-i2');
  });
});
