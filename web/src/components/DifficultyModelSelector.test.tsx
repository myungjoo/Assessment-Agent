import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import DifficultyModelSelector from './DifficultyModelSelector';
import type { ProviderOption, Difficulty } from './DifficultyModelSelector';

// R-112 — R-96 Admin LLM 모델 지정 UI(REQ-049/REQ-050/REQ-051, ADR-0040 §1) 검증.
// EvaluationResultTable.test.tsx / LoginForm.test.tsx 와 동일 패턴: jsdom·@testing-library
// 없이 react-dom/server 의 renderToStaticMarkup 으로 정적 렌더 문자열만 검증해 dep 표면을
// 최소화한다 (ADR-0040 §5 게이트). renderToStaticMarkup 은 이벤트를 발화하지 않으므로
// onAssign 콜백은 검증 대상이 아니다 — 렌더 markup(div/label/select/option 구조,
// role="status"/role="alert", selected 속성, 텍스트 토큰) 만 assert 한다.
// 파일명은 .test.tsx 고정 — root jest 의 testRegex (.*\.spec\.ts$) pickup 충돌 회피.

// 로딩 문구 식별 토큰 (구현의 LOADING_TEXT 와 정합 — 말줄임표는 U+2026 …).
const LOADING_TOKEN = '불러오는 중';
// 빈 목록 상태 문구 (구현의 EMPTY_PROVIDERS_TEXT 와 정합).
const EMPTY_PROVIDERS_TEXT = '등록된 LLM provider 가 없습니다';
// 미할당 placeholder 옵션 라벨 (구현의 UNASSIGNED_LABEL 과 정합).
const UNASSIGNED_LABEL = '선택 안 함';

// 테스트용 provider 2개 — option 렌더/순서/selected 반영 검증에 쓴다.
const sampleProviders: ProviderOption[] = [
  { id: 'p1', provider: 'openai', modelId: 'gpt-4o' },
  { id: 'p2', provider: 'anthropic', modelId: 'claude-3' },
];

// 슬롯 전부 null(미할당) 기본 매핑 — 개별 테스트가 일부 슬롯만 덮어쓴다.
const emptyMapping: Record<Difficulty, string | null> = {
  easy: null,
  medium: null,
  hard: null,
};

describe('DifficultyModelSelector', () => {
  // happy-path — providers + mapping(일부 할당) → div + 3 슬롯 label/select + option 렌더.
  it('providers + mapping 전달 시 3 난이도 슬롯의 <label>/<select> 와 각 provider option 을 렌더한다 (happy-path)', () => {
    const html = renderToStaticMarkup(
      <DifficultyModelSelector
        providers={sampleProviders}
        mapping={{ easy: 'p1', medium: null, hard: 'p2' }}
        onAssign={() => {}}
      />,
    );
    // 3 난이도 슬롯 한국어 라벨 — 렌더 순서 고정(쉬움→보통→어려움).
    expect(html).toContain('쉬움');
    expect(html).toContain('보통');
    expect(html).toContain('어려움');
    expect(html.indexOf('쉬움')).toBeLessThan(html.indexOf('보통'));
    expect(html.indexOf('보통')).toBeLessThan(html.indexOf('어려움'));
    // 슬롯별 name 속성을 가진 <select> 3개.
    expect(html).toContain('name="easy"');
    expect(html).toContain('name="medium"');
    expect(html).toContain('name="hard"');
    // 각 provider 의 modelId/provider 가 "modelId (provider)" 옵션 텍스트로 렌더된다.
    expect(html).toContain('gpt-4o (openai)');
    expect(html).toContain('claude-3 (anthropic)');
    // placeholder 옵션도 슬롯마다 렌더된다.
    expect(html).toContain(UNASSIGNED_LABEL);
    // 로딩/빈상태 분기로 빠지지 않는다.
    expect(html).not.toContain('role="status"');
  });

  // happy-path(구조) — 슬롯 3개 → <select> 3개, 각 select 의 option 수 = providers + placeholder.
  it('<select> 3개 + 각 select 당 option 수 = providers.length + 1(placeholder) 을 렌더한다 (happy-path, 옵션 수)', () => {
    const html = renderToStaticMarkup(
      <DifficultyModelSelector
        providers={sampleProviders}
        mapping={emptyMapping}
        onAssign={() => {}}
      />,
    );
    const selectCount = (html.match(/<select /g) ?? []).length;
    const optionCount = (html.match(/<option /g) ?? []).length;
    // 난이도 3 슬롯 = <select> 3개.
    expect(selectCount).toBe(3);
    // 슬롯당 placeholder 1 + provider 2 = 3, × 3 슬롯 = 9개.
    expect(optionCount).toBe(sampleProviders.length * 3 + 3);
  });

  // happy-path(selected 반영) — mapping 이 유효 providerId 면 그 option 이 selected.
  it('mapping 이 유효 provider id 면 해당 <option> 이 selected 로 반영된다 (happy-path, selected 반영)', () => {
    const html = renderToStaticMarkup(
      <DifficultyModelSelector
        providers={sampleProviders}
        mapping={{ easy: 'p1', medium: 'p2', hard: null }}
        onAssign={() => {}}
      />,
    );
    // renderToStaticMarkup 은 selected option 을 selected="" 로 직렬화한다.
    // p1/p2 가 각각 한 슬롯에서 선택됐으므로 selected 속성 2개 이상.
    const selectedCount = (html.match(/selected=""/g) ?? []).length;
    // easy=p1, medium=p2 → 2 슬롯의 provider option selected, hard=null → placeholder selected.
    expect(selectedCount).toBe(3);
    // 선택된 provider option 의 value 가 markup 에 존재.
    expect(html).toContain('value="p1"');
    expect(html).toContain('value="p2"');
  });

  // error/negative path — providers 빈 배열 + loading 미전달 → 빈 상태 문구, <select> 미렌더.
  it('providers 빈 배열 + loading 미전달 → 빈 상태 문구 렌더, <select>/<option> 미렌더 (error path)', () => {
    const html = renderToStaticMarkup(
      <DifficultyModelSelector providers={[]} mapping={emptyMapping} onAssign={() => {}} />,
    );
    expect(html).toContain('role="status"');
    expect(html).toContain(EMPTY_PROVIDERS_TEXT);
    // 선택할 옵션이 없으므로 슬롯 폼은 렌더되지 않는다.
    expect(html).not.toContain('<select');
    expect(html).not.toContain('<option');
    // 빈 상태 분기는 alert/로딩 문구도 렌더하지 않는다.
    expect(html).not.toContain('role="alert"');
    expect(html).not.toContain(LOADING_TOKEN);
  });

  // flow/branch — loading=true → role="status" + "불러오는 중…", 슬롯/빈상태 문구 미렌더.
  it('loading=true 면 role="status" + "불러오는 중…" 렌더, <select>/빈상태 문구 미렌더 (branch — loading)', () => {
    const html = renderToStaticMarkup(
      <DifficultyModelSelector
        providers={sampleProviders}
        mapping={emptyMapping}
        onAssign={() => {}}
        loading={true}
      />,
    );
    expect(html).toContain('role="status"');
    expect(html).toContain(LOADING_TOKEN);
    // 말줄임표는 U+2026(…) 단일 문자여야 한다 — "..." 3 점이 아니다.
    expect(html).toContain('불러오는 중…');
    expect(html).not.toContain('불러오는 중...');
    // 로딩 분기는 슬롯/빈상태 문구를 렌더하지 않는다.
    expect(html).not.toContain('<select');
    expect(html).not.toContain(EMPTY_PROVIDERS_TEXT);
  });

  // flow/branch — loading 미전달(undefined→false) + providers 있음 → 슬롯 <select> 렌더.
  it('loading 미전달 + providers 있음 → 3 슬롯 <select> 를 렌더한다 (branch — loading false)', () => {
    const html = renderToStaticMarkup(
      <DifficultyModelSelector
        providers={sampleProviders}
        mapping={emptyMapping}
        onAssign={() => {}}
      />,
    );
    const selectCount = (html.match(/<select /g) ?? []).length;
    expect(selectCount).toBe(3);
    // 로딩/빈상태 분기로 빠지지 않아야 한다.
    expect(html).not.toContain('role="status"');
    expect(html).not.toContain(LOADING_TOKEN);
  });

  // flow/branch — error truthy → role="alert" 영역에 문구 렌더(populated 분기).
  it('error="저장 실패" 전달 시 role="alert" 영역에 문구를 렌더한다 (branch — error 존재)', () => {
    const html = renderToStaticMarkup(
      <DifficultyModelSelector
        providers={sampleProviders}
        mapping={emptyMapping}
        onAssign={() => {}}
        error="저장 실패"
      />,
    );
    expect(html).toContain('role="alert"');
    expect(html).toContain('저장 실패');
    // 슬롯 폼도 함께 렌더된다(populated 분기에서 alert 는 추가될 뿐).
    expect(html).toContain('<select');
  });

  // flow/branch — error 미전달 → alert 영역 미렌더.
  it('error 미전달 시 role="alert" 영역을 렌더하지 않는다 (branch — error 부재)', () => {
    const html = renderToStaticMarkup(
      <DifficultyModelSelector
        providers={sampleProviders}
        mapping={emptyMapping}
        onAssign={() => {}}
      />,
    );
    expect(html).not.toContain('role="alert"');
    // 슬롯 폼은 정상 렌더.
    expect(html).toContain('<select');
  });

  // negative/edge — 빈 문자열 error 는 falsy 라 alert 영역을 렌더하지 않는다(자리 차지 방지).
  it('error="" (빈 문자열) → role="alert" 미렌더 (negative — 빈 문자열 경계값)', () => {
    const html = renderToStaticMarkup(
      <DifficultyModelSelector
        providers={sampleProviders}
        mapping={emptyMapping}
        onAssign={() => {}}
        error=""
      />,
    );
    expect(html).not.toContain('role="alert"');
    // 슬롯 폼은 정상 렌더되어야 한다.
    expect(html).toContain('<select');
  });

  // negative/loading 우선 — providers + error 가 있어도 loading=true 면 로딩 표시 우선.
  it('providers 채워짐 + error 있음 + loading=true → 로딩 표시만 렌더, 슬롯/alert 미렌더 (negative — loading 우선 정책)', () => {
    const html = renderToStaticMarkup(
      <DifficultyModelSelector
        providers={sampleProviders}
        mapping={{ easy: 'p1', medium: 'p2', hard: 'p1' }}
        onAssign={() => {}}
        loading={true}
        error="저장 실패"
      />,
    );
    expect(html).toContain('role="status"');
    expect(html).toContain(LOADING_TOKEN);
    // loading 우선 — providers/error 가 있어도 슬롯·alert·빈상태 문구는 렌더되지 않는다.
    expect(html).not.toContain('<select');
    expect(html).not.toContain('role="alert"');
    expect(html).not.toContain('저장 실패');
    expect(html).not.toContain(EMPTY_PROVIDERS_TEXT);
  });

  // negative/빈목록 우선 — providers 빈 배열이면 error 가 있어도 빈 상태만 렌더(빈목록 우선).
  it('providers 빈 배열 + error 있음 → 빈 상태만 렌더, alert/슬롯 미렌더 (negative — 빈목록 우선)', () => {
    const html = renderToStaticMarkup(
      <DifficultyModelSelector
        providers={[]}
        mapping={emptyMapping}
        onAssign={() => {}}
        error="저장 실패"
      />,
    );
    expect(html).toContain('role="status"');
    expect(html).toContain(EMPTY_PROVIDERS_TEXT);
    // 빈 목록 분기는 alert/슬롯을 렌더하지 않는다.
    expect(html).not.toContain('role="alert"');
    expect(html).not.toContain('저장 실패');
    expect(html).not.toContain('<select');
  });

  // negative/null 슬롯 — mapping 슬롯이 null 이면 placeholder 가 selected, provider option 미선택.
  it('mapping 슬롯이 모두 null → placeholder("선택 안 함") 가 selected, provider option 미선택 (negative — null 슬롯)', () => {
    const html = renderToStaticMarkup(
      <DifficultyModelSelector
        providers={sampleProviders}
        mapping={emptyMapping}
        onAssign={() => {}}
      />,
    );
    // 3 슬롯 모두 placeholder(value="") 가 selected → selected="" 3개.
    const selectedCount = (html.match(/selected=""/g) ?? []).length;
    expect(selectedCount).toBe(3);
    // selected 가 붙은 직전 토큰이 value="" placeholder 임을 확인 — provider value 뒤에는 selected 없음.
    expect(html).not.toContain('value="p1" selected=""');
    expect(html).not.toContain('value="p2" selected=""');
    // placeholder option(value="" + 선택 안 함)이 selected.
    expect(html).toContain('value="" selected=""');
  });

  // negative/미지의 id — mapping 이 목록에 없는 id 를 가리켜도 throw 하지 않고 어떤 option 도 미선택.
  it('mapping 이 목록에 없는 provider id 를 가리켜도 throw 하지 않고 어떤 option 도 selected 되지 않는다 (negative — 미지의 id)', () => {
    expect(() =>
      renderToStaticMarkup(
        <DifficultyModelSelector
          providers={sampleProviders}
          mapping={{ easy: 'ghost', medium: null, hard: null }}
          onAssign={() => {}}
        />,
      ),
    ).not.toThrow();
    const html = renderToStaticMarkup(
      <DifficultyModelSelector
        providers={sampleProviders}
        mapping={{ easy: 'ghost', medium: null, hard: null }}
        onAssign={() => {}}
      />,
    );
    // easy 슬롯의 'ghost' 는 어떤 option value 와도 매칭되지 않는다 → easy select 에는 selected 없음.
    // medium/hard 는 null 이라 placeholder selected → 전체 selected="" 는 2개(미지의 id 슬롯 제외).
    const selectedCount = (html.match(/selected=""/g) ?? []).length;
    expect(selectedCount).toBe(2);
    // 'ghost' 는 option value 로 렌더되지 않는다(placeholder 도 아니다).
    expect(html).not.toContain('value="ghost"');
  });

  // negative/복합 — providers 빈 배열 + mapping 일부 할당 동시 전달 시에도 빈 상태만 렌더.
  it('providers 빈 배열 + mapping 일부 할당 → 빈 상태만 렌더, 잔존 매핑·슬롯 미렌더 (negative — 빈목록+잔존매핑 복합)', () => {
    const html = renderToStaticMarkup(
      <DifficultyModelSelector
        providers={[]}
        mapping={{ easy: 'p1', medium: 'p2', hard: null }}
        onAssign={() => {}}
      />,
    );
    expect(html).toContain('role="status"');
    expect(html).toContain(EMPTY_PROVIDERS_TEXT);
    // 선택 가능한 옵션이 없으므로 슬롯/option 은 렌더되지 않는다(잔존 매핑이 있어도).
    expect(html).not.toContain('<select');
    expect(html).not.toContain('<option');
    expect(html).not.toContain('value="p1"');
    expect(html).not.toContain('value="p2"');
  });
});
