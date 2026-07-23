import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { isValidElement } from 'react';
import type { ReactNode } from 'react';
import PersonList from './PersonList';
import type { PersonRow } from './PersonList';

// 삭제 버튼 라벨 (구현의 DELETE_LABEL 과 정합, T-1144).
const DELETE_LABEL = '삭제';

// renderToStaticMarkup 은 이벤트를 발화하지 않으므로(jsdom 미도입 — ADR-0040 §5 게이트) onDelete
// 클릭 콜백은 컴포넌트가 반환한 React element 트리를 순회해 button 의 onClick 을 수동 호출하는
// 방식으로 검증한다(LlmProviderConfigList.test.tsx collectButtons 동형). React element 는
// { type, props } 평문 객체라 트리 walk 로 button 노드를 수집할 수 있다.
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

// R-112 — P6 Admin 인원(Person) 관리 UI(REQ-049·REQ-023) 목록 컴포넌트 검증.
// PermissionDeniedRecordList.test.tsx 와 동일 패턴: jsdom·@testing-library 없이
// react-dom/server 의 renderToStaticMarkup 으로 정적 렌더 문자열만 검증해 dep 표면을
// 최소화한다(ADR-0040 §5 게이트). 파일명은 .test.tsx 고정 — root jest 의
// testRegex (.*\.spec\.ts$) pickup 충돌 회피.

// 로딩 문구 식별 토큰(구현의 LOADING_TEXT 정합 — 말줄임표 U+2026 …) / 기본 빈 상태 문구.
const LOADING_TOKEN = '불러오는 중';
const DEFAULT_EMPTY = '등록된 인원이 없습니다';
const ACTIVE_LABEL = '활성';
const INACTIVE_LABEL = '휴직';

// 테스트용 인원 2건(정상 목록·순서 보존용). 한 명은 active, 다른 한 명은 비활성(휴직).
const samplePersons: PersonRow[] = [
  { id: 'p1', fullName: '김철수', email: 'chulsoo@example.com', active: true, partId: 'part-a', createdAt: '2026-07-20T10:00:00.000Z' },
  { id: 'p2', fullName: '이영희', email: 'younghee@example.com', active: false, partId: 'part-b', createdAt: '2026-07-21T11:00:00.000Z' },
];

describe('PersonList', () => {
  // happy-path — persons 가 있으면 <ul>/<li> + 각 행 필드(fullName/email/상태)를 렌더한다.
  it('persons 전달 시 <ul>/<li> 목록 + 각 행 fullName·email 을 렌더한다 (happy-path)', () => {
    const html = renderToStaticMarkup(<PersonList persons={samplePersons} />);
    expect(html).toContain('<ul>');
    expect(html).toContain('<li>');
    expect(html).toContain('김철수');
    expect(html).toContain('chulsoo@example.com');
    expect(html).toContain('이영희');
    expect(html).toContain('younghee@example.com');
    expect((html.match(/<li>/g) ?? []).length).toBe(2);
  });

  // happy-path(순서 보존) — props 순서대로 출력(내부 정렬 없음).
  it('persons 를 props 순서 그대로 렌더한다 — 첫 행이 둘째보다 앞 index (happy-path, 순서 보존)', () => {
    const html = renderToStaticMarkup(<PersonList persons={samplePersons} />);
    expect(html.indexOf('김철수')).toBeLessThan(html.indexOf('이영희'));
  });

  // active 표시 — active=true → "활성", active=false → "휴직" 사람-친화 한국어.
  it('active 여부를 사람-친화 한국어("활성"/"휴직")로 표시한다 (분기 — active 라벨)', () => {
    const html = renderToStaticMarkup(<PersonList persons={samplePersons} />);
    expect(html).toContain(ACTIVE_LABEL);
    expect(html).toContain(INACTIVE_LABEL);
  });

  // secret 미노출 — Person 은 민감 컬럼이 부재하므로 secret 토큰이 markup 에 등장하지 않는다.
  it('인원 목록 렌더 시 secret 토큰이 markup 에 등장하지 않는다 (secret 미노출 정책)', () => {
    const html = renderToStaticMarkup(<PersonList persons={samplePersons} />);
    expect(html).not.toContain('apiKey');
    expect(html).not.toContain('token');
    expect(html).not.toContain('secret');
  });

  // error path — error truthy → role="alert", 목록(<ul>) 미렌더.
  it('error truthy 전달 시 role="alert" 영역에 문구 렌더, <ul> 미렌더 (error path)', () => {
    const html = renderToStaticMarkup(
      <PersonList persons={[]} error="인원을 불러오지 못했습니다" />,
    );
    expect(html).toContain('role="alert"');
    expect(html).toContain('인원을 불러오지 못했습니다');
    expect(html).not.toContain('<ul>');
  });

  // branch — loading=true → role="status" + 로딩 문구, 목록/빈상태 미렌더.
  it('loading=true 면 role="status" + "불러오는 중…" 렌더, <ul>/빈상태 미렌더 (branch — loading)', () => {
    const html = renderToStaticMarkup(<PersonList persons={[]} loading={true} />);
    expect(html).toContain('role="status"');
    expect(html).toContain(LOADING_TOKEN);
    // 말줄임표는 U+2026(…) 단일 문자여야 한다 — "..." 3 점이 아니다.
    expect(html).toContain('불러오는 중…');
    expect(html).not.toContain('불러오는 중...');
    expect(html).not.toContain(DEFAULT_EMPTY);
    expect(html).not.toContain('<ul>');
  });

  // branch — 빈 배열 + loading/error 미전달 → 기본 빈 상태 문구, 목록 미렌더.
  it('persons 빈 배열 + loading/error 미전달 → 기본 빈 상태 문구 렌더, <ul> 미렌더 (branch — empty)', () => {
    const html = renderToStaticMarkup(<PersonList persons={[]} />);
    expect(html).toContain('role="status"');
    expect(html).toContain(DEFAULT_EMPTY);
    expect(html).not.toContain('<ul>');
    expect(html).not.toContain('<li>');
  });

  // negative — loading=true 가 persons 보다 우선(채워져도 목록 미렌더).
  it('persons 있음 + loading=true → 목록을 렌더하지 않고 로딩 표시 우선 (negative — loading 우선 정책)', () => {
    const html = renderToStaticMarkup(<PersonList persons={samplePersons} loading={true} />);
    expect(html).toContain('role="status"');
    expect(html).toContain(LOADING_TOKEN);
    expect(html).not.toContain('<ul>');
    expect(html).not.toContain('김철수');
    expect(html).not.toContain('이영희');
  });

  // negative — loading=true 가 error 보다 우선(error 동시 전달도 로딩만).
  it('error 전달 + loading=true → alert 대신 로딩 표시 우선 (negative — loading 이 error 보다 우선)', () => {
    const html = renderToStaticMarkup(
      <PersonList persons={[]} loading={true} error="에러 문구" />,
    );
    expect(html).toContain('role="status"');
    expect(html).toContain(LOADING_TOKEN);
    expect(html).not.toContain('role="alert"');
    expect(html).not.toContain('에러 문구');
  });

  // negative — error 와 persons 동시 전달 시 error 우선, 목록 미렌더.
  it('error 와 persons 동시 전달 → error 우선·목록 미렌더 (negative — error 우선)', () => {
    const html = renderToStaticMarkup(<PersonList persons={samplePersons} error="조회 실패" />);
    expect(html).toContain('role="alert"');
    expect(html).toContain('조회 실패');
    expect(html).not.toContain('<ul>');
    expect(html).not.toContain('김철수');
  });

  // negative/edge — custom emptyMessage 전달 시 기본 문구 대신 custom 빈 문구 렌더.
  it('persons 빈 배열 + custom emptyMessage → 기본 문구 대신 custom 빈 문구 렌더 (negative — override)', () => {
    const custom = '표시할 인원이 아직 없어요';
    const html = renderToStaticMarkup(<PersonList persons={[]} emptyMessage={custom} />);
    expect(html).toContain('role="status"');
    expect(html).toContain(custom);
    expect(html).not.toContain(DEFAULT_EMPTY);
  });

  // negative/edge — 빈 문자열 emptyMessage 는 기본 문구로 fallback(빈 메시지 방지).
  it('persons 빈 배열 + emptyMessage="" → 기본 문구로 fallback (negative — 빈 문자열 경계값)', () => {
    const html = renderToStaticMarkup(<PersonList persons={[]} emptyMessage="" />);
    expect(html).toContain('role="status"');
    expect(html).toContain(DEFAULT_EMPTY);
  });

  // negative/edge — 빈 문자열 error(falsy) + 빈 배열 → alert 미렌더·빈 상태 문구 렌더.
  it('error="" (falsy) + 빈 배열 → alert 미렌더·빈 상태 문구 렌더 (negative — 빈 문자열 error 경계값)', () => {
    const html = renderToStaticMarkup(<PersonList persons={[]} error="" />);
    expect(html).not.toContain('role="alert"');
    expect(html).toContain('role="status"');
    expect(html).toContain(DEFAULT_EMPTY);
  });

  // negative/edge — 빈 문자열 error(falsy) + persons 있음 → alert 미렌더·목록 정상 렌더.
  it('error="" (falsy) + persons 있음 → alert 미렌더·목록 렌더 (negative — 빈 문자열 error + populated)', () => {
    const html = renderToStaticMarkup(<PersonList persons={samplePersons} error="" />);
    expect(html).not.toContain('role="alert"');
    expect(html).toContain('<ul>');
    expect(html).toContain('김철수');
  });

  // negative/edge — partId 없는 행이 throw 없이 렌더(선택 컬럼 부재 안전 처리).
  it('partId 없는 record → throw 없이 fullName·email 을 렌더한다 (negative — partId 부재 안전 처리)', () => {
    const noPartId: PersonRow[] = [
      { id: 'p9', fullName: '박민수', email: 'minsoo@example.com', active: true },
    ];
    const html = renderToStaticMarkup(<PersonList persons={noPartId} />);
    expect(html).toContain('<li>');
    expect(html).toContain('박민수');
    expect(html).toContain('minsoo@example.com');
    expect(html).toContain(ACTIVE_LABEL);
  });

  // negative/edge — active=false 행 단독 시 상태가 "휴직" 으로 표시(active false 분기 cover).
  it('active=false 행 → 상태를 "휴직" 으로 표시한다 (negative — 비활성 상태 표시)', () => {
    const inactive: PersonRow[] = [
      { id: 'p10', fullName: '최지훈', email: 'jihoon@example.com', active: false },
    ];
    const html = renderToStaticMarkup(<PersonList persons={inactive} />);
    expect(html).toContain('최지훈');
    expect(html).toContain(INACTIVE_LABEL);
    expect(html).not.toContain(ACTIVE_LABEL);
  });

  // negative/edge — createdAt 있는 행은 생성 시각을 함께 렌더(선택 컬럼 truthy 분기).
  it('createdAt 있는 record → 생성 시각을 함께 렌더한다 (negative — createdAt truthy 분기)', () => {
    const withCreatedAt: PersonRow[] = [
      { id: 'p11', fullName: '정수연', email: 'sooyeon@example.com', active: true, partId: 'part-c', createdAt: '2026-07-22T02:00:00.000Z' },
    ];
    const html = renderToStaticMarkup(<PersonList persons={withCreatedAt} />);
    expect(html).toContain('part-c');
    expect(html).toContain('2026-07-22T02:00:00.000Z');
  });

  // negative/edge — 다건 person 을 key 중복 없이 렌더(<li> 수 = person 수).
  it('다건 person 을 key 중복 경고 없이 렌더한다 — <li> 수 = person 수 (negative — 다건 key 안정성)', () => {
    const many: PersonRow[] = [
      { id: 'a', fullName: 'A', email: 'a@example.com', active: true },
      { id: 'b', fullName: 'B', email: 'b@example.com', active: false },
      { id: 'c', fullName: 'C', email: 'c@example.com', active: true },
    ];
    const html = renderToStaticMarkup(<PersonList persons={many} />);
    expect((html.match(/<li>/g) ?? []).length).toBe(3);
  });

  // happy-path(onDelete) — onDelete 전달 시 각 행에 삭제 버튼(<button>)이 person 수만큼 렌더된다.
  it('onDelete 전달 시 각 행에 삭제 버튼을 person 수만큼 렌더한다 (happy-path — onDelete 전달)', () => {
    const html = renderToStaticMarkup(
      <PersonList persons={samplePersons} onDelete={() => undefined} />,
    );
    expect(html).toContain('<button');
    expect(html).toContain(DELETE_LABEL);
    // 삭제 버튼 수 = person 수(각 행 1 버튼).
    const btnCount = (html.match(/<button/g) ?? []).length;
    expect(btnCount).toBe(2);
  });

  // happy-path(콜백) — 삭제 버튼 클릭 시 해당 행의 row.id 로 onDelete 가 호출된다(element 트리 순회).
  it('삭제 버튼 클릭 시 해당 행 id 로 onDelete 를 호출한다 (happy-path — 콜백 발화)', () => {
    const onDelete = vi.fn();
    const tree = PersonList({ persons: samplePersons, onDelete });
    const buttons = collectButtons(tree);
    // 버튼이 person 수만큼 수집되고, 각 버튼 클릭이 대응 row.id 로 콜백을 호출한다(순서 보존).
    expect(buttons).toHaveLength(2);
    buttons[0]?.onClick?.();
    expect(onDelete).toHaveBeenLastCalledWith('p1');
    buttons[1]?.onClick?.();
    expect(onDelete).toHaveBeenLastCalledWith('p2');
    expect(onDelete).toHaveBeenCalledTimes(2);
  });

  // branch/negative — onDelete 미전달 시 삭제 버튼 미렌더(읽기 전용 하위 호환 — T-1142 마운트 보존).
  it('onDelete 미전달 시 삭제 버튼을 렌더하지 않는다 (branch/negative — onDelete 미전달 하위 호환)', () => {
    const html = renderToStaticMarkup(<PersonList persons={samplePersons} />);
    expect(html).not.toContain('<button');
    expect(html).not.toContain(DELETE_LABEL);
    // 읽기 전용 목록은 그대로 렌더된다(마운트 보존).
    expect(html).toContain('<ul>');
    expect(html).toContain('김철수');
  });

  // negative — loading 우선 정책은 onDelete 전달과 무관하다(loading=true 면 버튼도 미렌더).
  it('onDelete 전달 + loading=true → 목록/삭제 버튼 대신 로딩 표시 우선 (negative — loading 우선)', () => {
    const html = renderToStaticMarkup(
      <PersonList persons={samplePersons} loading={true} onDelete={() => undefined} />,
    );
    expect(html).toContain('role="status"');
    expect(html).toContain(LOADING_TOKEN);
    expect(html).not.toContain('<button');
  });

  // negative — error 우선 정책은 onDelete 전달과 무관하다(error truthy 면 버튼도 미렌더).
  it('onDelete 전달 + error truthy → 목록/삭제 버튼 대신 alert 우선 (negative — error 우선)', () => {
    const html = renderToStaticMarkup(
      <PersonList persons={samplePersons} error="삭제에 실패했습니다" onDelete={() => undefined} />,
    );
    expect(html).toContain('role="alert"');
    expect(html).toContain('삭제에 실패했습니다');
    expect(html).not.toContain('<button');
  });

  // negative — 빈 배열 + onDelete 전달 → 삭제 버튼 미렌더(빈 상태 문구만, 렌더할 행 없음).
  it('빈 배열 + onDelete 전달 → 삭제 버튼 미렌더·빈 상태 문구만 렌더한다 (negative — 빈 목록)', () => {
    const html = renderToStaticMarkup(<PersonList persons={[]} onDelete={() => undefined} />);
    expect(html).not.toContain('<button');
    expect(html).toContain(DEFAULT_EMPTY);
  });
});
