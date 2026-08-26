import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import DashboardPersonSelector, {
  filterSelectablePersons,
  submitSelection,
} from './DashboardPersonSelector';
import type { SelectablePerson } from './DashboardPersonSelector';

// R-112 — REQ-074(대시보드 안 평가 대상 인원 선택 UI) presentational slice 검증.
// DifficultyModelSelector.test.tsx / PersonList.test.tsx 와 동일 패턴: jsdom·@testing-library
// 없이 react-dom/server 의 renderToStaticMarkup 으로 정적 렌더 문자열만 검증해 dep 표면 증가를
// 0 으로 둔다. renderToStaticMarkup 은 이벤트를 발화하지 않으므로 onSelect 콜백 계약은 렌더가
// 아니라 순수 export 함수 submitSelection 을 직접 호출해 검증한다(GroupMemberList 선례).
// 파일명은 .test.tsx 고정 — root jest 의 testRegex(.*\.spec\.ts$) pickup 충돌 회피.

// 로딩 문구 식별 토큰 (구현의 LOADING_TEXT 와 정합 — 말줄임표는 U+2026 …).
const LOADING_TOKEN = '불러오는 중';
// 빈 상태 문구 (구현의 EMPTY_PERSONS_TEXT 와 정합).
const EMPTY_PERSONS_TEXT = '선택 가능한 평가 대상 인원이 없습니다';
// 미선택 placeholder 라벨 (구현의 PLACEHOLDER_LABEL 과 정합).
const PLACEHOLDER_LABEL = '평가 대상을 선택하세요';
// 선택 컨트롤 라벨 (구현의 FIELD_LABEL 과 정합).
const FIELD_LABEL = '평가 대상 인원';

// 테스트용 인원 3 인 — 렌더 순서/라벨/selected 반영 검증에 쓴다.
const samplePersons: SelectablePerson[] = [
  { id: 'p1', fullName: '김철수', email: 'chulsoo@example.com', active: true },
  { id: 'p2', fullName: '이영희', email: 'younghee@example.com', active: true },
  { id: 'p3', fullName: '박민수', email: 'minsoo@example.com', active: true },
];

describe('DashboardPersonSelector', () => {
  // happy-path — persons 3 인 + selectedId → <select name="personId"> + placeholder + 3 라벨.
  it('persons 3 인 + selectedId 전달 시 <select name="personId"> 와 placeholder·3 인 라벨을 렌더하고 선택 인원이 selected 로 반영된다 (happy-path)', () => {
    const html = renderToStaticMarkup(
      <DashboardPersonSelector
        persons={samplePersons}
        selectedId="p2"
        onSelect={() => {}}
      />,
    );
    // 선택 컨트롤 라벨 + name 속성을 가진 <select> 1 개.
    expect(html).toContain(FIELD_LABEL);
    expect(html).toContain('name="personId"');
    expect((html.match(/<select /g) ?? []).length).toBe(1);
    // placeholder option + 인원 3 명 = option 4 개.
    expect(html).toContain(PLACEHOLDER_LABEL);
    expect((html.match(/<option /g) ?? []).length).toBe(samplePersons.length + 1);
    // 각 인원이 "이름 (이메일)" 라벨로 입력 순서대로 렌더된다.
    expect(html).toContain('김철수 (chulsoo@example.com)');
    expect(html).toContain('이영희 (younghee@example.com)');
    expect(html).toContain('박민수 (minsoo@example.com)');
    expect(html.indexOf('김철수')).toBeLessThan(html.indexOf('이영희'));
    expect(html.indexOf('이영희')).toBeLessThan(html.indexOf('박민수'));
    // selectedId="p2" 인원 option 만 selected 로 직렬화된다.
    expect(html).toContain('value="p2" selected=""');
    expect((html.match(/selected=""/g) ?? []).length).toBe(1);
    // 로딩/빈 상태/에러 분기로 빠지지 않는다.
    expect(html).not.toContain('role="status"');
    expect(html).not.toContain('role="alert"');
  });

  // happy-path(순수 함수) — submitSelection 이 onSelect 를 정확한 값으로 1 회 호출 + true 반환.
  it("submitSelection('p2', onSelect) 는 onSelect 를 'p2' 로 정확히 1 회 호출하고 true 를 반환한다 (happy-path — 순수 함수)", () => {
    const onSelect = vi.fn();
    const fired = submitSelection('p2', onSelect);
    expect(fired).toBe(true);
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith('p2');
  });

  // happy-path(순수 함수) — filterSelectablePersons 가 활성 인원을 순서 보존해 반환.
  it('filterSelectablePersons 는 휴직(active=false) 인원만 제외하고 나머지를 입력 순서대로 반환한다 (happy-path — 순수 함수)', () => {
    const mixed: SelectablePerson[] = [
      { id: 'a', fullName: '가', active: true },
      { id: 'b', fullName: '나', active: false },
      { id: 'c', fullName: '다' },
      { id: 'd', fullName: '라', active: true },
    ];
    const result = filterSelectablePersons(mixed);
    // active=false 인 'b' 만 제외 — active 미지정('c') 은 보수적으로 포함한다.
    expect(result.map((person) => person.id)).toEqual(['a', 'c', 'd']);
  });

  // error path — error 문구가 alert 로 렌더되면서도 <select>/인원 option 이 그대로 남는다.
  it('error 전달 시 role="alert" 에 문구가 렌더되고 동시에 <select> 와 인원 option 이 그대로 남는다 (error path — 에러가 선택 수단을 대체하지 않음)', () => {
    const html = renderToStaticMarkup(
      <DashboardPersonSelector
        persons={samplePersons}
        onSelect={() => {}}
        error="인원 목록을 불러오지 못했습니다"
      />,
    );
    expect(html).toContain('role="alert"');
    expect(html).toContain('인원 목록을 불러오지 못했습니다');
    // REQ-074 핵심 — 에러가 있어도 선택 수단은 살아있어야 한다.
    expect(html).toContain('name="personId"');
    expect(html).toContain('김철수 (chulsoo@example.com)');
    expect((html.match(/<option /g) ?? []).length).toBe(samplePersons.length + 1);
    // alert 는 선택 컨트롤보다 먼저 렌더된다.
    expect(html.indexOf('role="alert"')).toBeLessThan(html.indexOf('<select '));
  });

  // error path(경계) — 빈 문자열 error 는 falsy 라 alert 영역이 자리를 차지하지 않는다.
  it('error="" (빈 문자열) 이면 role="alert" 를 렌더하지 않고 선택 컨트롤만 렌더한다 (error path — 빈 문자열 경계값)', () => {
    const html = renderToStaticMarkup(
      <DashboardPersonSelector persons={samplePersons} onSelect={() => {}} error="" />,
    );
    expect(html).not.toContain('role="alert"');
    expect(html).toContain('name="personId"');
  });

  // branch ① — loading=true 면 persons/error 유무와 무관하게 로딩 문구만 렌더(loading 우선).
  it('loading=true 면 persons·error 가 있어도 role="status" 로딩 문구만 렌더하고 <select> 를 렌더하지 않는다 (branch — loading 우선)', () => {
    const html = renderToStaticMarkup(
      <DashboardPersonSelector
        persons={samplePersons}
        selectedId="p1"
        onSelect={() => {}}
        loading={true}
        error="조회 실패"
      />,
    );
    expect(html).toContain('role="status"');
    expect(html).toContain(LOADING_TOKEN);
    // 말줄임표는 U+2026(…) 단일 문자여야 한다 — "..." 3 점이 아니다.
    expect(html).toContain('불러오는 중…');
    expect(html).not.toContain('불러오는 중...');
    // loading 우선 — 선택 컨트롤·alert·빈 상태 문구는 렌더되지 않는다.
    expect(html).not.toContain('<select');
    expect(html).not.toContain('role="alert"');
    expect(html).not.toContain('조회 실패');
    expect(html).not.toContain(EMPTY_PERSONS_TEXT);
  });

  // branch ② — 빈 목록이면 빈 상태 문구만 렌더하고 <select> 미렌더.
  it('persons 빈 배열이면 role="status" 빈 상태 문구를 렌더하고 <select>/<option> 을 렌더하지 않는다 (branch — 빈 목록 / negative ①)', () => {
    const html = renderToStaticMarkup(
      <DashboardPersonSelector persons={[]} onSelect={() => {}} />,
    );
    expect(html).toContain('role="status"');
    expect(html).toContain(EMPTY_PERSONS_TEXT);
    expect(html).not.toContain('<select');
    expect(html).not.toContain('<option');
    // 빈 상태는 로딩/에러 분기가 아니다.
    expect(html).not.toContain(LOADING_TOKEN);
    expect(html).not.toContain('role="alert"');
  });

  // branch ② 보강 — 빈 목록 + error 동시 전달 시 alert 와 빈 상태가 함께 렌더된다.
  it('persons 빈 배열 + error 동시 전달 시 alert 와 빈 상태 문구가 함께 렌더된다 (branch — 에러가 빈 상태를 삼키지 않음)', () => {
    const html = renderToStaticMarkup(
      <DashboardPersonSelector persons={[]} onSelect={() => {}} error="조회 실패" />,
    );
    expect(html).toContain('role="alert"');
    expect(html).toContain('조회 실패');
    expect(html).toContain('role="status"');
    expect(html).toContain(EMPTY_PERSONS_TEXT);
  });

  // branch ③ — loading 미전달(undefined) + 목록 존재 → 정상 목록 렌더.
  it('loading 미전달 + persons 존재면 정상 목록(<select> 1 개) 을 렌더한다 (branch — loading false)', () => {
    const html = renderToStaticMarkup(
      <DashboardPersonSelector persons={samplePersons} onSelect={() => {}} />,
    );
    expect((html.match(/<select /g) ?? []).length).toBe(1);
    expect(html).not.toContain('role="status"');
    expect(html).not.toContain(LOADING_TOKEN);
    // selectedId 미전달 → placeholder(value="") 가 selected.
    expect(html).toContain('value="" selected=""');
    expect((html.match(/selected=""/g) ?? []).length).toBe(1);
  });

  // branch ④ — submitSelection 의 호출/미호출 두 갈래.
  it('submitSelection 은 onSelect 가 함수일 때만 발사하고 그 여부를 boolean 으로 알린다 (branch — 콜백 호출/미호출)', () => {
    const onSelect = vi.fn();
    expect(submitSelection('p1', onSelect)).toBe(true);
    expect(submitSelection('p1', undefined)).toBe(false);
    // 미전달 갈래는 어떤 콜백도 추가로 발사하지 않는다.
    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  // negative ② — 전원 휴직이면 필터 후 0 명이라 빈 상태. 원본 배열 mutate 0 도 함께 검증.
  it('전원 active=false 면 빈 상태 문구를 렌더하고 원본 persons 배열을 mutate 하지 않는다 (negative — 전원 휴직 + 무-mutate)', () => {
    const inactivePersons: SelectablePerson[] = [
      { id: 'x1', fullName: '휴직자1', active: false },
      { id: 'x2', fullName: '휴직자2', active: false },
    ];
    const html = renderToStaticMarkup(
      <DashboardPersonSelector persons={inactivePersons} onSelect={() => {}} />,
    );
    expect(html).toContain(EMPTY_PERSONS_TEXT);
    expect(html).not.toContain('<select');
    // 필터는 새 배열을 만들 뿐 원본을 건드리지 않는다.
    expect(inactivePersons).toHaveLength(2);
    expect(inactivePersons.map((person) => person.id)).toEqual(['x1', 'x2']);
    expect(filterSelectablePersons(inactivePersons)).toHaveLength(0);
  });

  // negative ③ — 목록에 없는 selectedId 는 throw 없이 placeholder fallback, selected 속성 0.
  it('selectedId 가 목록에 없는 미지의 id 여도 throw 없이 렌더되고 어떤 option 도 selected 되지 않는다 (negative — 미지의 selectedId)', () => {
    expect(() =>
      renderToStaticMarkup(
        <DashboardPersonSelector
          persons={samplePersons}
          selectedId="ghost"
          onSelect={() => {}}
        />,
      ),
    ).not.toThrow();
    const html = renderToStaticMarkup(
      <DashboardPersonSelector
        persons={samplePersons}
        selectedId="ghost"
        onSelect={() => {}}
      />,
    );
    // 미지의 id 는 어떤 option value 와도 매칭되지 않는다 → selected 속성 0.
    expect((html.match(/selected=""/g) ?? []).length).toBe(0);
    expect(html).not.toContain('value="ghost"');
    // 선택 수단 자체는 그대로 살아있다.
    expect(html).toContain('name="personId"');
    expect(html).toContain(PLACEHOLDER_LABEL);
  });

  // negative ④ — 콜백 미전달 시 throw 없이 false.
  it("submitSelection('p1', undefined) 은 throw 없이 false 를 반환한다 (negative — 콜백 미전달 안전성)", () => {
    expect(() => submitSelection('p1', undefined)).not.toThrow();
    expect(submitSelection('p1', undefined)).toBe(false);
  });

  // negative ⑤ — 공백뿐인 값은 trim 결과(빈 문자열)가 그대로 전달된다(선택 해제).
  it("submitSelection('  ', onSelect) 은 trim 된 빈 문자열을 전달하고 공백 원본은 전달하지 않는다 (negative — 공백 trim / 선택 해제)", () => {
    const onSelect = vi.fn();
    expect(submitSelection('  ', onSelect)).toBe(true);
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith('');
    expect(onSelect).not.toHaveBeenCalledWith('  ');
    // 앞뒤 공백이 붙은 유효 id 도 정규화되어 전달된다.
    const onSelect2 = vi.fn();
    expect(submitSelection('  p3 ', onSelect2)).toBe(true);
    expect(onSelect2).toHaveBeenCalledWith('p3');
  });

  // negative ⑥ — email 이 없거나 빈 문자열이면 이름만 렌더(깨진 라벨 노출 0).
  it('email 이 없거나 빈 문자열인 인원은 이름만 렌더하고 undefined·빈 괄호 같은 깨진 라벨을 노출하지 않는다 (negative — email 결측)', () => {
    const persons: SelectablePerson[] = [
      { id: 'n1', fullName: '이메일없음' },
      { id: 'n2', fullName: '이메일빈값', email: '' },
      { id: 'n3', fullName: '정상', email: 'ok@example.com' },
    ];
    const html = renderToStaticMarkup(
      <DashboardPersonSelector persons={persons} onSelect={() => {}} />,
    );
    expect(html).toContain('>이메일없음</option>');
    expect(html).toContain('>이메일빈값</option>');
    expect(html).toContain('정상 (ok@example.com)');
    // 깨진 라벨 토큰이 마크업에 새지 않는다.
    expect(html).not.toContain('undefined');
    expect(html).not.toContain('()');
  });

  // negative ⑦ — fullName 의 HTML 특수문자는 이스케이프되어 마크업 주입이 발생하지 않는다.
  it('fullName 에 포함된 HTML 특수문자가 이스케이프되어 렌더된다 (negative — 마크업 주입 0)', () => {
    const persons: SelectablePerson[] = [
      { id: 'h1', fullName: '<b>주입</b>', email: '<script>alert(1)</script>' },
    ];
    const html = renderToStaticMarkup(
      <DashboardPersonSelector persons={persons} onSelect={() => {}} />,
    );
    // 원문 태그는 살아있지 않고 escape 된 엔티티로만 존재한다.
    expect(html).not.toContain('<b>주입</b>');
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;b&gt;주입&lt;/b&gt;');
    expect(html).toContain('&lt;script&gt;');
  });

  // negative — persons 가 배열이 아니면(런타임 계약 위반) throw 없이 빈 후보로 다룬다.
  it('filterSelectablePersons 는 배열이 아닌 입력에도 throw 없이 빈 배열을 반환한다 (negative — 비배열 방어)', () => {
    expect(() => filterSelectablePersons(undefined)).not.toThrow();
    expect(filterSelectablePersons(undefined)).toEqual([]);
  });
});
