import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { isValidElement } from 'react';
import type { ReactNode } from 'react';
import LlmProviderConfigList from './LlmProviderConfigList';
import type { LlmProviderConfigRow } from './LlmProviderConfigList';

// 삭제 버튼 라벨 (구현의 DELETE_LABEL 과 정합).
const DELETE_LABEL = '삭제';

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
});
