import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { isValidElement } from 'react';
import type { ReactNode } from 'react';
import LlmProviderConfigList from './LlmProviderConfigList';
import type { LlmProviderConfigRow } from './LlmProviderConfigList';

// 삭제 버튼 라벨 (구현의 DELETE_LABEL 과 정합).
const DELETE_LABEL = '삭제';
// 수정 버튼 라벨 (구현의 EDIT_LABEL 과 정합, T-1137).
const EDIT_LABEL = '수정';
// 기본 provider 배지 라벨/조회 토큰 (구현의 DEFAULT_BADGE_LABEL / DEFAULT_BADGE_TESTID 와 정합, T-1897).
const DEFAULT_BADGE_LABEL = '기본';
const BADGE_TESTID_ATTR = 'data-testid="llm-provider-default-badge"';
// 기본 지정 버튼 라벨 (구현의 SET_DEFAULT_LABEL 과 정합, T-1900).
const SET_DEFAULT_LABEL = '기본으로 지정';

// markup 안의 기본 배지 개수 — 라벨 문자열이 아니라 data-testid 토큰으로 센다.
function countBadges(html: string): number {
  return (html.match(/data-testid="llm-provider-default-badge"/g) ?? []).length;
}

// renderToStaticMarkup 은 이벤트를 발화하지 않으므로(jsdom 미도입 — ADR-0040 §5 게이트) onDelete
// 콜백의 실 클릭은 컴포넌트를 함수로 직접 호출해 반환 element 트리에서 <button> 을 찾아 그
// onClick 을 수동 호출하는 방식으로 검증한다. React element 는 { type, props } 평문 객체라
// 신규 dep 없이 순회 가능하다. 아래 helper 는 element 트리를 깊이우선 순회해 type==='button'
// 인 element 만 모은다.
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

// R-112 — REQ-096 LLM provider 설정 목록(ADR-0040 §1) 검증.
// GroupMemberList.test.tsx / DifficultyModelSelector.test.tsx 와 동일 패턴:
// jsdom·@testing-library 없이 react-dom/server 의 renderToStaticMarkup 으로 정적 렌더
// 문자열만 검증해 dep 표면을 최소화한다 (ADR-0040 §5 게이트). 파일명은 .test.tsx 고정 —
// root jest 의 testRegex (.*\.spec\.ts$) pickup 충돌 회피.

// 로딩 문구 식별 토큰 (구현의 LOADING_TEXT 와 정합 — 말줄임표는 U+2026 …).
const LOADING_TOKEN = '불러오는 중';
// 기본 빈 상태 문구 (구현의 DEFAULT_EMPTY_MESSAGE 와 정합).
const DEFAULT_EMPTY = '등록된 LLM provider 가 없습니다';

// 테스트용 provider — modelId/endpointUrl 포함 2건(정상 목록·순서 보존 검증용).
const sampleProviders: LlmProviderConfigRow[] = [
  { id: 'p1', provider: 'openai', modelId: 'gpt-4o', endpointUrl: 'https://api.openai.com/v1' },
  { id: 'p2', provider: 'anthropic', modelId: 'claude-3', endpointUrl: 'https://api.anthropic.com' },
];

describe('LlmProviderConfigList', () => {
  // happy-path — providers 가 있으면 <ul>/<li> 목록 + 각 행의 provider/modelId/endpointUrl 을 렌더한다.
  it('providers 전달 시 <ul>/<li> 목록 + 각 행의 provider/modelId/endpointUrl 을 렌더한다 (happy-path)', () => {
    const html = renderToStaticMarkup(<LlmProviderConfigList providers={sampleProviders} />);
    expect(html).toContain('<ul>');
    expect(html).toContain('<li>');
    expect(html).toContain('openai');
    expect(html).toContain('gpt-4o');
    expect(html).toContain('https://api.openai.com/v1');
    expect(html).toContain('anthropic');
    expect(html).toContain('claude-3');
    // <li> 항목 수 = provider 수.
    const liCount = (html.match(/<li>/g) ?? []).length;
    expect(liCount).toBe(2);
  });

  // happy-path(순서 보존) — props 의 providers 순서대로 출력되어야 한다(내부 정렬 없음).
  it('providers 를 props 순서 그대로 렌더한다 — 첫 행이 둘째보다 앞 index (happy-path, 순서 보존)', () => {
    const html = renderToStaticMarkup(<LlmProviderConfigList providers={sampleProviders} />);
    expect(html.indexOf('openai')).toBeLessThan(html.indexOf('anthropic'));
  });

  // secret 미노출 — apiKey 등 secret 은 view 타입에 없어 렌더 markup 에도 등장하지 않는다.
  it('provider 목록 렌더 시 apiKey 등 secret 토큰이 markup 에 등장하지 않는다 (secret 미노출 정책)', () => {
    const html = renderToStaticMarkup(<LlmProviderConfigList providers={sampleProviders} />);
    expect(html).not.toContain('apiKey');
    expect(html).not.toContain('sk-');
  });

  // error path — error truthy → role="alert" 영역에 문구 렌더, 목록(<ul>) 미렌더.
  it('error truthy 전달 시 role="alert" 영역에 문구 렌더, <ul> 미렌더 (error path)', () => {
    const html = renderToStaticMarkup(
      <LlmProviderConfigList providers={[]} error="provider 를 불러오지 못했습니다" />,
    );
    expect(html).toContain('role="alert"');
    expect(html).toContain('provider 를 불러오지 못했습니다');
    expect(html).not.toContain('<ul>');
  });

  // flow/branch — loading=true → role="status" + 로딩 문구, 목록/빈상태 미렌더.
  it('loading=true 면 role="status" + "불러오는 중…" 렌더, <ul>/빈상태 미렌더 (branch — loading)', () => {
    const html = renderToStaticMarkup(<LlmProviderConfigList providers={[]} loading={true} />);
    expect(html).toContain('role="status"');
    expect(html).toContain(LOADING_TOKEN);
    // 말줄임표는 U+2026(…) 단일 문자여야 한다 — "..." 3 점이 아니다.
    expect(html).toContain('불러오는 중…');
    expect(html).not.toContain('불러오는 중...');
    expect(html).not.toContain(DEFAULT_EMPTY);
    expect(html).not.toContain('<ul>');
  });

  // flow/branch — 빈 배열 + loading/error 미전달 → 기본 빈 상태 문구, 목록 미렌더.
  it('providers 빈 배열 + loading/error 미전달 → 기본 빈 상태 문구 렌더, <ul> 미렌더 (branch — empty)', () => {
    const html = renderToStaticMarkup(<LlmProviderConfigList providers={[]} />);
    expect(html).toContain('role="status"');
    expect(html).toContain(DEFAULT_EMPTY);
    expect(html).not.toContain('<ul>');
    expect(html).not.toContain('<li>');
  });

  // negative — loading=true 가 providers 보다 우선(loading 우선 정책 — 채워져도 목록 미렌더).
  it('providers 있음 + loading=true → 목록을 렌더하지 않고 로딩 표시 우선 (negative — loading 우선 정책)', () => {
    const html = renderToStaticMarkup(
      <LlmProviderConfigList providers={sampleProviders} loading={true} />,
    );
    expect(html).toContain('role="status"');
    expect(html).toContain(LOADING_TOKEN);
    expect(html).not.toContain('<ul>');
    expect(html).not.toContain('openai');
    expect(html).not.toContain('anthropic');
  });

  // negative — loading=true 가 error 보다 우선(loading 우선 정책 — error 동시 전달도 로딩만).
  it('error 전달 + loading=true → alert 대신 로딩 표시 우선 (negative — loading 이 error 보다 우선)', () => {
    const html = renderToStaticMarkup(
      <LlmProviderConfigList providers={[]} loading={true} error="에러 문구" />,
    );
    expect(html).toContain('role="status"');
    expect(html).toContain(LOADING_TOKEN);
    expect(html).not.toContain('role="alert"');
    expect(html).not.toContain('에러 문구');
  });

  // negative — error 와 providers 동시 전달 시 error 우선, 목록 미렌더.
  it('error 와 providers 동시 전달 → error 우선·목록 미렌더 (negative — error 우선)', () => {
    const html = renderToStaticMarkup(
      <LlmProviderConfigList providers={sampleProviders} error="조회 실패" />,
    );
    expect(html).toContain('role="alert"');
    expect(html).toContain('조회 실패');
    expect(html).not.toContain('<ul>');
    expect(html).not.toContain('openai');
  });

  // negative/edge — custom emptyMessage 전달 시 기본 문구 대신 custom 빈 문구 렌더.
  it('providers 빈 배열 + custom emptyMessage → 기본 문구 대신 custom 빈 문구 렌더 (negative — override)', () => {
    const custom = '아직 등록된 provider 가 없습니다';
    const html = renderToStaticMarkup(
      <LlmProviderConfigList providers={[]} emptyMessage={custom} />,
    );
    expect(html).toContain('role="status"');
    expect(html).toContain(custom);
    expect(html).not.toContain(DEFAULT_EMPTY);
  });

  // negative/edge — 빈 문자열 emptyMessage 는 기본 문구로 fallback (빈 메시지 방지).
  it('providers 빈 배열 + emptyMessage="" → 기본 문구로 fallback (negative — 빈 문자열 경계값)', () => {
    const html = renderToStaticMarkup(
      <LlmProviderConfigList providers={[]} emptyMessage="" />,
    );
    expect(html).toContain('role="status"');
    expect(html).toContain(DEFAULT_EMPTY);
  });

  // negative/edge — 빈 문자열 error(falsy) + 빈 배열 → alert 미렌더·빈 상태 문구 렌더.
  it('error="" (falsy) + 빈 배열 → alert 미렌더·빈 상태 문구 렌더 (negative — 빈 문자열 error 경계값)', () => {
    const html = renderToStaticMarkup(<LlmProviderConfigList providers={[]} error="" />);
    expect(html).not.toContain('role="alert"');
    expect(html).toContain('role="status"');
    expect(html).toContain(DEFAULT_EMPTY);
  });

  // negative/edge — 빈 문자열 error(falsy) + providers 있음 → alert 미렌더·목록 정상 렌더.
  it('error="" (falsy) + providers 있음 → alert 미렌더·목록 렌더 (negative — 빈 문자열 error + populated)', () => {
    const html = renderToStaticMarkup(
      <LlmProviderConfigList providers={sampleProviders} error="" />,
    );
    expect(html).not.toContain('role="alert"');
    expect(html).toContain('<ul>');
    expect(html).toContain('openai');
  });

  // negative/edge — modelId 미포함 provider → throw 없이 provider 만 렌더(modelId 토큰 부재).
  it('modelId 미포함 provider → throw 없이 provider 만 렌더한다 (negative — 선택 필드 누락)', () => {
    const noModel: LlmProviderConfigRow[] = [{ id: 'p3', provider: 'ollama' }];
    const html = renderToStaticMarkup(<LlmProviderConfigList providers={noModel} />);
    expect(html).toContain('<li>');
    expect(html).toContain('ollama');
  });

  // negative/edge — endpointUrl 미포함 provider → throw 없이 provider/modelId 만 렌더.
  it('endpointUrl 미포함 provider → throw 없이 provider/modelId 만 렌더한다 (negative — 선택 필드 누락)', () => {
    const noEndpoint: LlmProviderConfigRow[] = [{ id: 'p4', provider: 'openai', modelId: 'gpt-4o' }];
    const html = renderToStaticMarkup(<LlmProviderConfigList providers={noEndpoint} />);
    expect(html).toContain('<li>');
    expect(html).toContain('openai');
    expect(html).toContain('gpt-4o');
    expect(html).not.toContain('http');
  });

  // happy-path(onDelete) — onDelete 전달 시 각 행에 삭제 버튼(<button>)이 provider 수만큼 렌더된다.
  it('onDelete 전달 시 각 행에 삭제 버튼을 provider 수만큼 렌더한다 (happy-path — onDelete 전달)', () => {
    const html = renderToStaticMarkup(
      <LlmProviderConfigList providers={sampleProviders} onDelete={() => undefined} />,
    );
    expect(html).toContain('<button');
    expect(html).toContain(DELETE_LABEL);
    // 삭제 버튼 수 = provider 수.
    const btnCount = (html.match(/<button/g) ?? []).length;
    expect(btnCount).toBe(2);
  });

  // happy-path(콜백) — 삭제 버튼 클릭 시 해당 행의 row.id 로 onDelete 가 호출된다(element 트리 순회).
  it('삭제 버튼 클릭 시 해당 행 id 로 onDelete 를 호출한다 (happy-path — 콜백 발화)', () => {
    const onDelete = vi.fn();
    const tree = LlmProviderConfigList({ providers: sampleProviders, onDelete });
    const buttons = collectButtons(tree);
    // 버튼이 provider 수만큼 수집되고, 각 버튼 클릭이 대응 row.id 로 콜백을 호출한다(순서 보존).
    expect(buttons).toHaveLength(2);
    buttons[0]?.onClick?.();
    expect(onDelete).toHaveBeenLastCalledWith('p1');
    buttons[1]?.onClick?.();
    expect(onDelete).toHaveBeenLastCalledWith('p2');
    expect(onDelete).toHaveBeenCalledTimes(2);
  });

  // branch/negative — onDelete 미전달 시 삭제 버튼 미렌더(읽기 전용 하위 호환 — T-1134 마운트 보존).
  it('onDelete 미전달 시 삭제 버튼을 렌더하지 않는다 (branch/negative — onDelete 미전달 하위 호환)', () => {
    const html = renderToStaticMarkup(<LlmProviderConfigList providers={sampleProviders} />);
    expect(html).not.toContain('<button');
    expect(html).not.toContain(DELETE_LABEL);
    // 읽기 전용 목록은 그대로 렌더된다(마운트 보존).
    expect(html).toContain('<ul>');
    expect(html).toContain('openai');
  });

  // negative — loading 우선 정책은 onDelete 전달과 무관하다(loading=true 면 버튼도 미렌더).
  it('onDelete 전달 + loading=true → 목록/삭제 버튼 대신 로딩 표시 우선 (negative — loading 우선)', () => {
    const html = renderToStaticMarkup(
      <LlmProviderConfigList
        providers={sampleProviders}
        loading={true}
        onDelete={() => undefined}
      />,
    );
    expect(html).toContain('role="status"');
    expect(html).toContain(LOADING_TOKEN);
    expect(html).not.toContain('<button');
  });

  // negative — error 우선 정책은 onDelete 전달과 무관하다(error truthy 면 버튼도 미렌더).
  it('onDelete 전달 + error truthy → 목록/삭제 버튼 대신 alert 우선 (negative — error 우선)', () => {
    const html = renderToStaticMarkup(
      <LlmProviderConfigList
        providers={sampleProviders}
        error="삭제에 실패했습니다"
        onDelete={() => undefined}
      />,
    );
    expect(html).toContain('role="alert"');
    expect(html).toContain('삭제에 실패했습니다');
    expect(html).not.toContain('<button');
  });

  // happy-path(onEdit, T-1137) — onEdit 전달 시 각 행에 수정 버튼(<button>)이 provider 수만큼 렌더된다.
  it('onEdit 전달 시 각 행에 수정 버튼을 provider 수만큼 렌더한다 (happy-path — onEdit 전달, T-1137)', () => {
    const html = renderToStaticMarkup(
      <LlmProviderConfigList providers={sampleProviders} onEdit={() => undefined} />,
    );
    expect(html).toContain('<button');
    expect(html).toContain(EDIT_LABEL);
    // 수정 버튼 수 = provider 수(onDelete 미전달이라 버튼 = 수정만).
    const btnCount = (html.match(/<button/g) ?? []).length;
    expect(btnCount).toBe(2);
  });

  // happy-path(콜백, T-1137) — 수정 버튼 클릭 시 해당 행의 row.id 로 onEdit 가 호출된다(element 트리 순회).
  it('수정 버튼 클릭 시 해당 행 id 로 onEdit 를 호출한다 (happy-path — 콜백 발화, T-1137)', () => {
    const onEdit = vi.fn();
    const tree = LlmProviderConfigList({ providers: sampleProviders, onEdit });
    const buttons = collectButtons(tree);
    // 버튼이 provider 수만큼 수집되고, 각 버튼 클릭이 대응 row.id 로 콜백을 호출한다(순서 보존).
    expect(buttons).toHaveLength(2);
    buttons[0]?.onClick?.();
    expect(onEdit).toHaveBeenLastCalledWith('p1');
    buttons[1]?.onClick?.();
    expect(onEdit).toHaveBeenLastCalledWith('p2');
    expect(onEdit).toHaveBeenCalledTimes(2);
  });

  // branch/negative(T-1137) — onEdit 미전달 시 수정 버튼 미렌더(읽기 전용 하위 호환 — T-1134 마운트 보존).
  it('onEdit 미전달 시 수정 버튼을 렌더하지 않는다 (branch/negative — onEdit 미전달 하위 호환, T-1137)', () => {
    const html = renderToStaticMarkup(<LlmProviderConfigList providers={sampleProviders} />);
    expect(html).not.toContain('<button');
    expect(html).not.toContain(EDIT_LABEL);
    // 읽기 전용 목록은 그대로 렌더된다(마운트 보존).
    expect(html).toContain('<ul>');
    expect(html).toContain('openai');
  });

  // branch(T-1137) — onEdit + onDelete 동시 전달 시 각 행에 수정·삭제 두 버튼(총 2×provider)이 렌더된다.
  it('onEdit + onDelete 동시 전달 시 각 행에 수정·삭제 두 버튼을 렌더한다 (branch — 양 콜백 공존, T-1137)', () => {
    const html = renderToStaticMarkup(
      <LlmProviderConfigList
        providers={sampleProviders}
        onEdit={() => undefined}
        onDelete={() => undefined}
      />,
    );
    expect(html).toContain(EDIT_LABEL);
    expect(html).toContain(DELETE_LABEL);
    // provider 당 버튼 2 개(수정+삭제) → 총 2×provider 수.
    const btnCount = (html.match(/<button/g) ?? []).length;
    expect(btnCount).toBe(sampleProviders.length * 2);
  });

  // branch(콜백, T-1137) — onEdit + onDelete 동시 전달 시 행별 [수정, 삭제] 순으로 각 콜백이 대응 id 로 호출된다.
  it('onEdit + onDelete 동시 전달 시 행별 [수정, 삭제] 순으로 각 콜백을 대응 id 로 호출한다 (branch — 콜백 순서, T-1137)', () => {
    const onEdit = vi.fn();
    const onDelete = vi.fn();
    const tree = LlmProviderConfigList({ providers: sampleProviders, onEdit, onDelete });
    const buttons = collectButtons(tree);
    // 행별 수정→삭제 순 → [edit p1, delete p1, edit p2, delete p2].
    expect(buttons).toHaveLength(4);
    buttons[0]?.onClick?.();
    expect(onEdit).toHaveBeenLastCalledWith('p1');
    buttons[1]?.onClick?.();
    expect(onDelete).toHaveBeenLastCalledWith('p1');
    buttons[2]?.onClick?.();
    expect(onEdit).toHaveBeenLastCalledWith('p2');
    buttons[3]?.onClick?.();
    expect(onDelete).toHaveBeenLastCalledWith('p2');
    expect(onEdit).toHaveBeenCalledTimes(2);
    expect(onDelete).toHaveBeenCalledTimes(2);
  });

  // negative(T-1137) — loading 우선 정책은 onEdit 전달과 무관하다(loading=true 면 수정 버튼도 미렌더).
  it('onEdit 전달 + loading=true → 목록/수정 버튼 대신 로딩 표시 우선 (negative — loading 우선, T-1137)', () => {
    const html = renderToStaticMarkup(
      <LlmProviderConfigList
        providers={sampleProviders}
        loading={true}
        onEdit={() => undefined}
      />,
    );
    expect(html).toContain('role="status"');
    expect(html).toContain(LOADING_TOKEN);
    expect(html).not.toContain('<button');
    expect(html).not.toContain(EDIT_LABEL);
  });

  // negative(T-1137) — error 우선 정책은 onEdit 전달과 무관하다(error truthy 면 수정 버튼도 미렌더).
  it('onEdit 전달 + error truthy → 목록/수정 버튼 대신 alert 우선 (negative — error 우선, T-1137)', () => {
    const html = renderToStaticMarkup(
      <LlmProviderConfigList
        providers={sampleProviders}
        error="수정에 실패했습니다"
        onEdit={() => undefined}
      />,
    );
    expect(html).toContain('role="alert"');
    expect(html).toContain('수정에 실패했습니다');
    expect(html).not.toContain('<button');
  });

  // ── T-1897 기본 provider 배지(읽기 축) ─────────────────────────────────────────
  // 배지는 표시 전용이라 버튼이 아니다 — 기존 버튼 계약 spec 들(<button> 개수 단언) 은 무영향.

  // happy-path — isDefault: true 1 개 + 비-default 2 개 목록에서 배지가 정확히 1 개 렌더되고,
  // 그 배지가 대응 provider 라벨과 **같은 <li> 안**에 있다.
  it('isDefault: true 행 1 개 + 비-default 2 개 → 배지 정확히 1 개, 해당 provider 와 같은 <li> 안 (happy-path, T-1897)', () => {
    const rows: LlmProviderConfigRow[] = [
      { id: 'p1', provider: 'openai', modelId: 'gpt-4o' },
      { id: 'p2', provider: 'anthropic', modelId: 'claude-3', isDefault: true },
      { id: 'p3', provider: 'ollama' },
    ];

    const html = renderToStaticMarkup(<LlmProviderConfigList providers={rows} />);

    expect(countBadges(html)).toBe(1);
    expect(html).toContain(DEFAULT_BADGE_LABEL);
    // <li> 단위로 쪼개 배지가 실린 항목이 anthropic 행인지 확인한다(다른 행에는 배지 없음).
    const items = html.split('<li>').slice(1);
    expect(items).toHaveLength(3);
    const badgeItems = items.filter((item) => item.includes(BADGE_TESTID_ATTR));
    expect(badgeItems).toHaveLength(1);
    expect(badgeItems[0]).toContain('anthropic');
    expect(items[0]).not.toContain(BADGE_TESTID_ATTR);
    expect(items[2]).not.toContain(BADGE_TESTID_ATTR);
  });

  // error path — error truthy 면 isDefault: true 행이 있어도 배지 0(alert 영역만).
  it('error truthy + isDefault: true 행 존재 → 배지 0, alert 만 렌더 (error path, T-1897)', () => {
    const rows: LlmProviderConfigRow[] = [
      { id: 'p1', provider: 'openai', isDefault: true },
    ];

    const html = renderToStaticMarkup(
      <LlmProviderConfigList providers={rows} error="provider 를 불러오지 못했습니다" />,
    );

    expect(html).toContain('role="alert"');
    expect(countBadges(html)).toBe(0);
    expect(html).not.toContain('<ul>');
  });

  // branch(loading 우선) — loading=true 면 isDefault: true 행이 있어도 배지 0.
  it('loading=true + isDefault: true 행 존재 → 배지 0, 로딩 표시 우선 (branch — loading 우선, T-1897)', () => {
    const rows: LlmProviderConfigRow[] = [
      { id: 'p1', provider: 'openai', isDefault: true },
    ];

    const html = renderToStaticMarkup(
      <LlmProviderConfigList providers={rows} loading={true} />,
    );

    expect(html).toContain('role="status"');
    expect(html).toContain(LOADING_TOKEN);
    expect(countBadges(html)).toBe(0);
  });

  // negative(a) — isDefault 필드 자체가 없는 row → 배지 0(목록은 정상 렌더).
  it('isDefault 필드가 없는 row → 배지 0, 목록은 정상 렌더 (negative — 선택 필드 누락, T-1897)', () => {
    const html = renderToStaticMarkup(<LlmProviderConfigList providers={sampleProviders} />);

    expect(html).toContain('<ul>');
    expect(html).toContain('openai');
    expect(countBadges(html)).toBe(0);
  });

  // negative(b) — isDefault: false → 배지 0(false 분기 = 배지 렌더 분기의 반대쪽).
  it('isDefault: false row → 배지 0 (negative — false 분기, T-1897)', () => {
    const rows: LlmProviderConfigRow[] = [
      { id: 'p1', provider: 'openai', isDefault: false },
    ];

    const html = renderToStaticMarkup(<LlmProviderConfigList providers={rows} />);

    expect(html).toContain('<li>');
    expect(html).toContain('openai');
    expect(countBadges(html)).toBe(0);
  });

  // negative(c) — 비-boolean isDefault("true") → 배지 0(엄격 === true 비교, 보수 매핑).
  it('isDefault: "true" 같은 비-boolean → 배지 0 (negative — 엄격 boolean 비교, T-1897)', () => {
    const rows = [
      { id: 'p1', provider: 'openai', isDefault: 'true' },
      { id: 'p2', provider: 'anthropic', isDefault: 1 },
    ] as unknown as LlmProviderConfigRow[];

    const html = renderToStaticMarkup(<LlmProviderConfigList providers={rows} />);

    expect(html).toContain('<ul>');
    expect(countBadges(html)).toBe(0);
  });

  // negative(d) — 빈 목록 → 배지 0 + 빈 상태 문구.
  it('빈 목록 → 배지 0 + 빈 상태 문구 (negative — empty, T-1897)', () => {
    const html = renderToStaticMarkup(<LlmProviderConfigList providers={[]} />);

    expect(html).toContain(DEFAULT_EMPTY);
    expect(countBadges(html)).toBe(0);
  });

  // negative(f) — 여러 row 가 isDefault: true 인 비정상 응답. backend 불변식(0 또는 1 개)
  // 위반이지만 web 은 이를 **교정하지 않는다** — throw 없이 각 해당 행에 배지를 그대로 렌더해
  // 이상을 화면에 드러낸다(교정하면 잘못된 상태가 숨는다).
  it('isDefault: true 가 여러 행이어도 throw 없이 각 행에 배지를 렌더한다 (negative — backend 불변식 위반 미교정, T-1897)', () => {
    const rows: LlmProviderConfigRow[] = [
      { id: 'p1', provider: 'openai', isDefault: true },
      { id: 'p2', provider: 'anthropic', isDefault: true },
      { id: 'p3', provider: 'ollama' },
    ];

    const render = () => renderToStaticMarkup(<LlmProviderConfigList providers={rows} />);

    expect(render).not.toThrow();
    expect(countBadges(render())).toBe(2);
  });

  // 계약 불변 — 배지는 버튼이 아니다. isDefault: true 여도 onDelete/onEdit 미전달이면 버튼 0
  // 이고, apiKey 등 secret 은 여전히 미노출(mutation 로직 0 · controlled presentational 유지).
  it('isDefault: true + onDelete/onEdit 미전달 → 버튼 0·배지만 렌더, secret 미노출 (계약 불변, T-1897)', () => {
    const rows: LlmProviderConfigRow[] = [
      { id: 'p1', provider: 'openai', isDefault: true },
    ];

    const html = renderToStaticMarkup(<LlmProviderConfigList providers={rows} />);

    expect(html).not.toContain('<button');
    expect(html).not.toContain(DELETE_LABEL);
    expect(html).not.toContain(EDIT_LABEL);
    expect(countBadges(html)).toBe(1);
    expect(html).not.toContain('apiKey');
  });

  // ── T-1900 기본 provider 지정 버튼(쓰기 축 B2) ────────────────────────────────
  // onSetDefault 는 onEdit/onDelete 와 동형의 선택 콜백이되, "이미 기본인 행" 에는 버튼을
  // 렌더하지 않는다(무의미한 재지정 차단). 렌더 순서는 기존 수정→삭제 뒤 마지막.

  // happy-path — onSetDefault 전달 시 비-default 행 수만큼 "기본으로 지정" 버튼이 렌더된다.
  it('onSetDefault 전달 시 비-default 행 수만큼 기본 지정 버튼을 렌더한다 (happy-path — onSetDefault 전달, T-1900)', () => {
    const html = renderToStaticMarkup(
      <LlmProviderConfigList providers={sampleProviders} onSetDefault={() => undefined} />,
    );
    expect(html).toContain('<button');
    expect(html).toContain(SET_DEFAULT_LABEL);
    // sampleProviders 2 건은 모두 비-default → 버튼 = 기본 지정만 2 개.
    const btnCount = (html.match(/<button/g) ?? []).length;
    expect(btnCount).toBe(sampleProviders.length);
  });

  // happy-path(콜백) — 기본 지정 버튼 클릭 시 해당 행의 row.id 로 onSetDefault 가 호출된다.
  it('기본 지정 버튼 클릭 시 해당 행 id 로 onSetDefault 를 호출한다 (happy-path — 콜백 발화, T-1900)', () => {
    const onSetDefault = vi.fn();
    const tree = LlmProviderConfigList({ providers: sampleProviders, onSetDefault });
    const buttons = collectButtons(tree);
    // 비-default 행 수만큼 수집되고, 각 버튼 클릭이 대응 row.id 로 콜백을 호출한다(순서 보존).
    expect(buttons).toHaveLength(2);
    buttons[0]?.onClick?.();
    expect(onSetDefault).toHaveBeenLastCalledWith('p1');
    buttons[1]?.onClick?.();
    expect(onSetDefault).toHaveBeenLastCalledWith('p2');
    expect(onSetDefault).toHaveBeenCalledTimes(2);
  });

  // error path — error 우선 정책은 onSetDefault 전달과 무관하다(alert 만, 버튼 0).
  it('onSetDefault 전달 + error truthy → 목록/버튼 대신 alert 우선 (error path, T-1900)', () => {
    const html = renderToStaticMarkup(
      <LlmProviderConfigList
        providers={sampleProviders}
        error="기본 provider 지정에 실패했습니다"
        onSetDefault={() => undefined}
      />,
    );
    expect(html).toContain('role="alert"');
    expect(html).toContain('기본 provider 지정에 실패했습니다');
    expect(html).not.toContain('<button');
    expect(html).not.toContain('<ul>');
  });

  // branch(a) — loading 우선 정책도 onSetDefault 전달과 무관하다(로딩 표시만, 버튼 0).
  it('onSetDefault 전달 + loading=true → 로딩 표시 우선, 버튼 0 (branch — loading 우선, T-1900)', () => {
    const html = renderToStaticMarkup(
      <LlmProviderConfigList
        providers={sampleProviders}
        loading={true}
        onSetDefault={() => undefined}
      />,
    );
    expect(html).toContain('role="status"');
    expect(html).toContain(LOADING_TOKEN);
    expect(html).not.toContain('<button');
    expect(html).not.toContain(SET_DEFAULT_LABEL);
  });

  // branch(b) — isDefault: true 행에는 버튼 미렌더·배지만, 같은 목록의 비-default 행에는 버튼 렌더.
  it('isDefault: true 행은 배지만·버튼 미렌더, 비-default 행에만 기본 지정 버튼을 렌더한다 (branch — 행별 대응, T-1900)', () => {
    const rows: LlmProviderConfigRow[] = [
      { id: 'p1', provider: 'openai', modelId: 'gpt-4o' },
      { id: 'p2', provider: 'anthropic', modelId: 'claude-3', isDefault: true },
      { id: 'p3', provider: 'ollama' },
    ];

    const html = renderToStaticMarkup(
      <LlmProviderConfigList providers={rows} onSetDefault={() => undefined} />,
    );

    expect(countBadges(html)).toBe(1);
    const btnCount = (html.match(/<button/g) ?? []).length;
    expect(btnCount).toBe(2);
    // <li> 단위로 쪼개 배지가 실린 행에는 버튼이 없고, 나머지 두 행에는 버튼이 있는지 확인한다.
    const items = html.split('<li>').slice(1);
    expect(items).toHaveLength(3);
    expect(items[1]).toContain(BADGE_TESTID_ATTR);
    expect(items[1]).not.toContain(SET_DEFAULT_LABEL);
    expect(items[0]).toContain(SET_DEFAULT_LABEL);
    expect(items[2]).toContain(SET_DEFAULT_LABEL);
  });

  // branch(c) — 3 종 콜백 동시 전달 시 비-default 행당 버튼 3 개, 행별 [수정, 삭제, 기본으로 지정] 순.
  it('onSetDefault + onEdit + onDelete 동시 전달 시 행별 [수정, 삭제, 기본으로 지정] 순으로 각 콜백을 대응 id 로 호출한다 (branch — 콜백 순서, T-1900)', () => {
    const onEdit = vi.fn();
    const onDelete = vi.fn();
    const onSetDefault = vi.fn();
    const tree = LlmProviderConfigList({
      providers: sampleProviders,
      onEdit,
      onDelete,
      onSetDefault,
    });
    const buttons = collectButtons(tree);
    // 비-default 행 2 개 × 3 종 → [edit p1, delete p1, setDefault p1, edit p2, delete p2, setDefault p2].
    expect(buttons).toHaveLength(6);
    buttons[0]?.onClick?.();
    expect(onEdit).toHaveBeenLastCalledWith('p1');
    buttons[1]?.onClick?.();
    expect(onDelete).toHaveBeenLastCalledWith('p1');
    buttons[2]?.onClick?.();
    expect(onSetDefault).toHaveBeenLastCalledWith('p1');
    buttons[3]?.onClick?.();
    expect(onEdit).toHaveBeenLastCalledWith('p2');
    buttons[4]?.onClick?.();
    expect(onDelete).toHaveBeenLastCalledWith('p2');
    buttons[5]?.onClick?.();
    expect(onSetDefault).toHaveBeenLastCalledWith('p2');
    expect(onSetDefault).toHaveBeenCalledTimes(2);
  });

  // negative(a) — onSetDefault 미전달 → 버튼 0 · 기존 렌더 불변(읽기 전용 하위 호환, T-1134 마운트 보존).
  it('onSetDefault 미전달 → 기본 지정 버튼 0 · 목록 렌더 불변 (negative — 미전달 하위 호환, T-1900)', () => {
    const html = renderToStaticMarkup(<LlmProviderConfigList providers={sampleProviders} />);

    expect(html).not.toContain('<button');
    expect(html).not.toContain(SET_DEFAULT_LABEL);
    expect(html).toContain('<ul>');
    expect(html).toContain('openai');
    expect(html).toContain('anthropic');
  });

  // negative(b) — 빈 배열 + onSetDefault 전달 → 버튼 0 + 빈 상태 문구(empty 분기 우선).
  it('빈 목록 + onSetDefault 전달 → 버튼 0 + 빈 상태 문구 (negative — empty, T-1900)', () => {
    const html = renderToStaticMarkup(
      <LlmProviderConfigList providers={[]} onSetDefault={() => undefined} />,
    );

    expect(html).toContain(DEFAULT_EMPTY);
    expect(html).not.toContain('<button');
    expect(html).not.toContain(SET_DEFAULT_LABEL);
  });

  // negative(c) — 모든 행이 isDefault: true 인 backend 불변식 위반 응답. 버튼은 0 이지만 throw
  // 없이 배지는 각 행에 그대로 렌더한다(화면이 응답을 있는 그대로 비춘다 — 배지 정책 동형).
  it('모든 행 isDefault: true → 기본 지정 버튼 0, throw 없이 배지는 각 행에 렌더 (negative — 불변식 위반 미교정, T-1900)', () => {
    const rows: LlmProviderConfigRow[] = [
      { id: 'p1', provider: 'openai', isDefault: true },
      { id: 'p2', provider: 'anthropic', isDefault: true },
    ];

    const render = () =>
      renderToStaticMarkup(
        <LlmProviderConfigList providers={rows} onSetDefault={() => undefined} />,
      );

    expect(render).not.toThrow();
    const html = render();
    expect(html).not.toContain('<button');
    expect(html).not.toContain(SET_DEFAULT_LABEL);
    expect(countBadges(html)).toBe(2);
  });

  // negative(d) — 비-boolean isDefault("true"/1) → 엄격 === true 비교라 배지 0 이고, 비-default
  // 취급이므로 버튼은 **렌더된다**(경계값 — 배지 분기와 버튼 분기가 같은 기준을 쓴다).
  it('isDefault: "true" 같은 비-boolean → 배지 0 이지만 기본 지정 버튼은 렌더된다 (negative — 경계값, T-1900)', () => {
    const rows = [
      { id: 'p1', provider: 'openai', isDefault: 'true' },
      { id: 'p2', provider: 'anthropic', isDefault: 1 },
    ] as unknown as LlmProviderConfigRow[];

    const html = renderToStaticMarkup(
      <LlmProviderConfigList providers={rows} onSetDefault={() => undefined} />,
    );

    expect(countBadges(html)).toBe(0);
    expect(html).toContain(SET_DEFAULT_LABEL);
    const btnCount = (html.match(/<button/g) ?? []).length;
    expect(btnCount).toBe(2);
  });

  // negative(e) — 계약 불변: onSetDefault 전달 상태에서도 markup 에 secret 토큰이 등장하지 않는다.
  it('onSetDefault 전달 상태에서도 apiKey 등 secret 토큰이 markup 에 없다 (negative — secret 미노출, T-1900)', () => {
    const rows = [
      { id: 'p1', provider: 'openai', modelId: 'gpt-4o', apiKey: 'sk-must-not-render' },
    ] as unknown as LlmProviderConfigRow[];

    const html = renderToStaticMarkup(
      <LlmProviderConfigList providers={rows} onSetDefault={() => undefined} />,
    );

    expect(html).toContain(SET_DEFAULT_LABEL);
    expect(html).not.toContain('apiKey');
    expect(html).not.toContain('sk-must-not-render');
  });

  // 배지 판정 오탐 방지 — '기본으로 지정' 라벨이 배지 라벨 '기본' 을 부분 문자열로 포함하지만
  // 배지 개수는 data-testid 토큰으로 세므로 버튼이 배지로 오탐되지 않는다(기존 spec 무영향 근거).
  it('기본 지정 버튼 라벨이 배지 라벨을 포함해도 배지 개수 판정에 오탐이 없다 (계약 불변, T-1900)', () => {
    const html = renderToStaticMarkup(
      <LlmProviderConfigList providers={sampleProviders} onSetDefault={() => undefined} />,
    );

    expect(html).toContain(SET_DEFAULT_LABEL);
    expect(html).toContain(DEFAULT_BADGE_LABEL);
    expect(countBadges(html)).toBe(0);
  });
});
