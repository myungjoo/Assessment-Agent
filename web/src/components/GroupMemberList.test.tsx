import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import GroupMemberList, {
  isAddDisabled,
  submitAdd,
  filterCandidates,
  resolveActiveSelection,
  focusSearchInput,
} from './GroupMemberList';
import type { Member } from './GroupMemberList';

// R-112 — REQ-046/REQ-047 그룹 인원 목록(ADR-0040 §1) 검증.
// EvaluationResultTable.test.tsx / DifficultyModelSelector.test.tsx 와 동일 패턴:
// jsdom·@testing-library 없이 react-dom/server 의 renderToStaticMarkup 으로 정적 렌더
// 문자열만 검증해 dep 표면을 최소화한다 (ADR-0040 §5 게이트). renderToStaticMarkup 은
// 이벤트를 발화하지 않으므로 onRemove 콜백 자체는 검증 대상이 아니다 — 제거 버튼의 렌더
// 유무(onRemove 전달/미전달 분기)와 목록 markup(<ul>/<li>, role="status"/"alert",
// 이름/역할 토큰) 만 assert 한다. 파일명은 .test.tsx 고정 — root jest 의 testRegex
// (.*\.spec\.ts$) pickup 충돌 회피.

// 로딩 문구 식별 토큰 (구현의 LOADING_TEXT 와 정합 — 말줄임표는 U+2026 …).
const LOADING_TOKEN = '불러오는 중';
// 기본 빈 상태 문구 (구현의 DEFAULT_EMPTY_MESSAGE 와 정합).
const DEFAULT_EMPTY = '표시할 인원이 없습니다';
// 제거 버튼 라벨 (구현의 REMOVE_LABEL 과 정합).
const REMOVE_LABEL = '제거';
// 추가 버튼 라벨 (구현의 ADD_LABEL 과 정합).
const ADD_LABEL = '추가';
// 추가 후보 select 의 placeholder 라벨 (구현의 ADD_PLACEHOLDER 와 정합) — 추가 form 존재 식별 토큰.
const ADD_PLACEHOLDER = '추가할 인원 선택';
// 후보 0개 안내 문구 (구현의 NO_CANDIDATES_TEXT 와 정합).
const NO_CANDIDATES_TEXT = '추가할 인원이 없습니다';
// 추가 후보 select 의 name 속성 — 추가 form(<select name="addCandidate">) 존재 식별에 쓴다.
const ADD_SELECT_MARKER = 'name="addCandidate"';
// 추가 후보 검색 입력의 aria-label (구현의 SEARCH_LABEL 과 정합) — 검색 입력 존재 식별 토큰.
const SEARCH_LABEL = '추가 후보 검색';
// 검색 결과 없음 안내 문구 (구현의 NO_RESULTS_TEXT 와 정합).
const NO_RESULTS_TEXT = '검색 결과 없음';

// 테스트용 멤버 — role 포함 2명 + role 미포함 1명(throw 없이 name 만 렌더 검증용).
const sampleMembers: Member[] = [
  { id: 'm1', name: '홍길동', role: '관리자' },
  { id: 'm2', name: '김철수', role: '평가자' },
];

// 테스트용 추가 후보 — 컨테이너가 persons − 현재 members 로 파생해 주입한다고 가정.
const sampleCandidates: Member[] = [
  { id: 'p10', name: '박신입', role: '평가자' },
  { id: 'p11', name: '최신규' },
];

describe('GroupMemberList', () => {
  // happy-path — members 가 있으면 <ul>/<li> 목록 + 각 멤버의 name/role 토큰을 렌더한다.
  it('members 전달 시 <ul>/<li> 목록 + 각 멤버의 name/role 을 렌더한다 (happy-path)', () => {
    const html = renderToStaticMarkup(<GroupMemberList members={sampleMembers} />);
    expect(html).toContain('<ul>');
    expect(html).toContain('<li>');
    expect(html).toContain('홍길동');
    expect(html).toContain('관리자');
    expect(html).toContain('김철수');
    expect(html).toContain('평가자');
    // <li> 항목 수 = 멤버 수.
    const liCount = (html.match(/<li>/g) ?? []).length;
    expect(liCount).toBe(2);
  });

  // happy-path(순서 보존) — props 의 members 순서대로 출력되어야 한다(내부 정렬 없음).
  it('members 를 props 순서 그대로 렌더한다 — 첫 멤버가 둘째보다 앞 index (happy-path, 순서 보존)', () => {
    const html = renderToStaticMarkup(<GroupMemberList members={sampleMembers} />);
    expect(html.indexOf('홍길동')).toBeLessThan(html.indexOf('김철수'));
  });

  // error path — error truthy → role="alert" 영역에 문구 렌더, 목록(<ul>) 미렌더.
  it('error truthy 전달 시 role="alert" 영역에 문구 렌더, <ul> 미렌더 (error path)', () => {
    const html = renderToStaticMarkup(
      <GroupMemberList members={[]} error="멤버를 불러오지 못했습니다" />,
    );
    expect(html).toContain('role="alert"');
    expect(html).toContain('멤버를 불러오지 못했습니다');
    expect(html).not.toContain('<ul>');
  });

  // flow/branch — loading=true → role="status" + 로딩 문구, 목록/빈상태 미렌더.
  it('loading=true 면 role="status" + "불러오는 중…" 렌더, <ul>/빈상태 미렌더 (branch — loading)', () => {
    const html = renderToStaticMarkup(<GroupMemberList members={[]} loading={true} />);
    expect(html).toContain('role="status"');
    expect(html).toContain(LOADING_TOKEN);
    // 말줄임표는 U+2026(…) 단일 문자여야 한다 — "..." 3 점이 아니다.
    expect(html).toContain('불러오는 중…');
    expect(html).not.toContain('불러오는 중...');
    expect(html).not.toContain(DEFAULT_EMPTY);
    expect(html).not.toContain('<ul>');
  });

  // flow/branch — 빈 배열 + loading/error 미전달 → 기본 빈 상태 문구, 목록 미렌더.
  it('members 빈 배열 + loading/error 미전달 → 기본 빈 상태 문구 렌더, <ul> 미렌더 (branch — empty)', () => {
    const html = renderToStaticMarkup(<GroupMemberList members={[]} />);
    expect(html).toContain('role="status"');
    expect(html).toContain(DEFAULT_EMPTY);
    expect(html).not.toContain('<ul>');
    expect(html).not.toContain('<li>');
  });

  // flow/branch — populated + onRemove 전달 → 각 행에 제거 버튼(<button>) 렌더.
  it('members 있음 + onRemove 전달 → 각 행에 제거 버튼을 렌더한다 (branch — onRemove 전달)', () => {
    const html = renderToStaticMarkup(
      <GroupMemberList members={sampleMembers} onRemove={() => undefined} />,
    );
    expect(html).toContain('<button');
    expect(html).toContain(REMOVE_LABEL);
    // 멤버 수만큼 제거 버튼이 렌더된다.
    const btnCount = (html.match(/<button/g) ?? []).length;
    expect(btnCount).toBe(2);
  });

  // flow/branch — populated + onRemove 미전달 → 제거 버튼 미렌더(목록만).
  it('members 있음 + onRemove 미전달 → 제거 버튼을 렌더하지 않는다 (branch — onRemove 미전달)', () => {
    const html = renderToStaticMarkup(<GroupMemberList members={sampleMembers} />);
    expect(html).toContain('<ul>');
    expect(html).not.toContain('<button');
    expect(html).not.toContain(REMOVE_LABEL);
  });

  // negative — loading=true 가 members 보다 우선(loading 우선 정책 — members 채워져도 목록 미렌더).
  it('members 있음 + loading=true → 목록을 렌더하지 않고 로딩 표시 우선 (negative — loading 우선 정책)', () => {
    const html = renderToStaticMarkup(
      <GroupMemberList members={sampleMembers} loading={true} />,
    );
    expect(html).toContain('role="status"');
    expect(html).toContain(LOADING_TOKEN);
    expect(html).not.toContain('<ul>');
    expect(html).not.toContain('홍길동');
    expect(html).not.toContain('김철수');
  });

  // negative — loading=true 가 error 보다 우선(loading 우선 정책 — error 동시 전달도 로딩만).
  it('error 전달 + loading=true → alert 대신 로딩 표시 우선 (negative — loading 이 error 보다 우선)', () => {
    const html = renderToStaticMarkup(
      <GroupMemberList members={[]} loading={true} error="에러 문구" />,
    );
    expect(html).toContain('role="status"');
    expect(html).toContain(LOADING_TOKEN);
    expect(html).not.toContain('role="alert"');
    expect(html).not.toContain('에러 문구');
  });

  // negative — error 와 members 동시 전달 시 error 우선, 목록 미렌더.
  it('error 와 members 동시 전달 → error 우선·목록 미렌더 (negative — error 우선)', () => {
    const html = renderToStaticMarkup(
      <GroupMemberList members={sampleMembers} error="조회 실패" />,
    );
    expect(html).toContain('role="alert"');
    expect(html).toContain('조회 실패');
    expect(html).not.toContain('<ul>');
    expect(html).not.toContain('홍길동');
  });

  // negative — emptyMessage 미전달 + 빈 배열 → 기본 빈 상태 문구 fallback.
  it('members 빈 배열 + emptyMessage 미전달 → 기본 빈 상태 문구 fallback (negative — 기본 문구 fallback)', () => {
    const html = renderToStaticMarkup(<GroupMemberList members={[]} />);
    expect(html).toContain(DEFAULT_EMPTY);
  });

  // negative — custom emptyMessage 전달 시 기본 문구 대신 custom 빈 문구 렌더.
  it('members 빈 배열 + custom emptyMessage → 기본 문구 대신 custom 빈 문구 렌더 (negative — override)', () => {
    const custom = '이 그룹에는 아직 인원이 없습니다';
    const html = renderToStaticMarkup(
      <GroupMemberList members={[]} emptyMessage={custom} />,
    );
    expect(html).toContain('role="status"');
    expect(html).toContain(custom);
    expect(html).not.toContain(DEFAULT_EMPTY);
  });

  // negative/edge — 빈 문자열 emptyMessage 는 기본 문구로 fallback (빈 메시지 방지).
  it('members 빈 배열 + emptyMessage="" → 기본 문구로 fallback (negative — 빈 문자열 경계값)', () => {
    const html = renderToStaticMarkup(<GroupMemberList members={[]} emptyMessage="" />);
    expect(html).toContain('role="status"');
    expect(html).toContain(DEFAULT_EMPTY);
  });

  // negative/edge — role 미포함 멤버도 throw 없이 name 만 렌더(role 토큰 부재).
  it('role 미포함 멤버 → throw 없이 name 만 렌더한다 (negative — role 미포함)', () => {
    const noRole: Member[] = [{ id: 'm3', name: '이영희' }];
    const html = renderToStaticMarkup(<GroupMemberList members={noRole} />);
    expect(html).toContain('<li>');
    expect(html).toContain('이영희');
    // 제거 버튼은 onRemove 미전달이라 없다.
    expect(html).not.toContain('<button');
  });

  // negative/edge — 빈 문자열 error(falsy) → alert 미렌더, 빈 배열이면 빈 상태로 진입.
  it('error="" (falsy) + 빈 배열 → alert 미렌더·빈 상태 문구 렌더 (negative — 빈 문자열 error 경계값)', () => {
    const html = renderToStaticMarkup(<GroupMemberList members={[]} error="" />);
    expect(html).not.toContain('role="alert"');
    expect(html).toContain('role="status"');
    expect(html).toContain(DEFAULT_EMPTY);
  });

  // negative/edge — 빈 문자열 error(falsy) + members 있음 → alert 미렌더·목록 정상 렌더.
  it('error="" (falsy) + members 있음 → alert 미렌더·목록 렌더 (negative — 빈 문자열 error + populated)', () => {
    const html = renderToStaticMarkup(<GroupMemberList members={sampleMembers} error="" />);
    expect(html).not.toContain('role="alert"');
    expect(html).toContain('<ul>');
    expect(html).toContain('홍길동');
  });

  // ── T-1237: onAdd 추가 slice ─────────────────────────────────────────────
  // renderToStaticMarkup 은 이벤트를 발화하지 않으므로(위 파일 헤더 주석) onAdd 콜백 자체의
  // "선택 → 클릭 → 호출" 은 정적 렌더로는 검증 불가하다. 대신 추가 결정 로직을 순수 함수
  // (submitAdd / isAddDisabled) 로 분리·export 해 그 happy-path·negative 를 직접 호출로 검증하고,
  // 렌더 분기(추가 form 노출/부재·disabled·빈 후보 안내)는 정적 markup 으로 assert 한다.

  // happy-path(render) — onAdd + addCandidates 주입 시 후보 select + "추가" 버튼을 렌더한다.
  it('onAdd + addCandidates 주입 시 후보 select(옵션) + "추가" 버튼을 렌더한다 (happy-path — 추가 form 렌더)', () => {
    const html = renderToStaticMarkup(
      <GroupMemberList
        members={sampleMembers}
        onAdd={() => undefined}
        addCandidates={sampleCandidates}
      />,
    );
    expect(html).toContain(ADD_SELECT_MARKER);
    expect(html).toContain(ADD_PLACEHOLDER);
    // 후보 이름이 <option> 으로 렌더된다(role 있으면 괄호로 함께).
    expect(html).toContain('박신입');
    expect(html).toContain('최신규');
    expect(html).toContain('평가자');
    expect(html).toContain(ADD_LABEL);
    // 추가 버튼(type="submit") 이 존재한다.
    expect(html).toContain('type="submit"');
  });

  // happy-path(callback) — submitAdd 는 비어있지 않은 personId 로 onAdd 를 정확히 1회 호출한다.
  it('submitAdd(personId, onAdd) → onAdd 를 선택 personId 인자로 정확히 1회 호출한다 (happy-path — 콜백)', () => {
    const onAdd = vi.fn();
    submitAdd('p10', onAdd);
    expect(onAdd).toHaveBeenCalledTimes(1);
    expect(onAdd).toHaveBeenCalledWith('p10');
  });

  // negative(callback) — 후보 미선택(빈 personId)이면 submitAdd 는 onAdd 를 호출하지 않는다.
  it('submitAdd("", onAdd) → 빈 personId 이면 onAdd 미호출 (negative — 빈 personId 전송 차단)', () => {
    const onAdd = vi.fn();
    submitAdd('', onAdd);
    expect(onAdd).not.toHaveBeenCalled();
  });

  // negative(callback) — onAdd 미전달 시 submitAdd 는 throw 없이 no-op 이다.
  it('submitAdd(personId, undefined) → throw 없이 no-op (negative — onAdd 미전달 안전성)', () => {
    expect(() => submitAdd('p10', undefined)).not.toThrow();
  });

  // branch(pure) — isAddDisabled: 미선택 또는 후보 0개면 true, 선택+후보 있으면 false.
  it('isAddDisabled — 미선택/후보0개 → true, 선택+후보있음 → false (branch — 추가 버튼 활성/비활성)', () => {
    // 미선택(빈 personId) → 비활성.
    expect(isAddDisabled('', 2)).toBe(true);
    // 후보 0개 → 비활성(선택값 무관).
    expect(isAddDisabled('p10', 0)).toBe(true);
    expect(isAddDisabled('', 0)).toBe(true);
    // 선택 + 후보 있음 → 활성(false).
    expect(isAddDisabled('p10', 2)).toBe(false);
  });

  // negative(render) — onAdd 미전달 시 추가 form(select/추가 버튼) 이 렌더되지 않는다(추가 UI 부재).
  it('onAdd 미전달 → 추가 form(select/추가 버튼) 미렌더 (negative — 추가 UI 부재)', () => {
    const html = renderToStaticMarkup(
      <GroupMemberList members={sampleMembers} addCandidates={sampleCandidates} />,
    );
    expect(html).not.toContain(ADD_SELECT_MARKER);
    expect(html).not.toContain(ADD_PLACEHOLDER);
    expect(html).not.toContain('<form');
  });

  // no-regression(byte 동등) — onAdd 미전달 시 기존 slice 와 byte 수준 동등한 markup 을 유지한다.
  it('onAdd 미전달 시 기존 렌더와 byte 동등 (no-regression — 추가 UI 0)', () => {
    const withCandidatesProp = renderToStaticMarkup(
      <GroupMemberList members={sampleMembers} addCandidates={sampleCandidates} />,
    );
    const baseline = renderToStaticMarkup(<GroupMemberList members={sampleMembers} />);
    expect(withCandidatesProp).toBe(baseline);
  });

  // negative(render) — addCandidates 빈 배열 + onAdd → 안내 문구 + disabled select, 후보 옵션 부재.
  it('addCandidates 빈 배열 + onAdd → "추가할 인원이 없습니다" 안내 + disabled select (negative — 빈 후보 안전 표시)', () => {
    const html = renderToStaticMarkup(
      <GroupMemberList members={sampleMembers} onAdd={() => undefined} addCandidates={[]} />,
    );
    expect(html).toContain(NO_CANDIDATES_TEXT);
    // select 는 존재하되 disabled 이고 placeholder 외 후보 옵션은 없다.
    expect(html).toContain(ADD_SELECT_MARKER);
    expect(html).toContain('disabled');
    expect(html).not.toContain('박신입');
  });

  // negative(render) — addCandidates 미전달 + onAdd → 빈 후보와 동형(안내 + disabled).
  it('addCandidates 미전달 + onAdd → 빈 후보와 동형 안내 + disabled select (negative — 후보 미전달 안전 표시)', () => {
    const html = renderToStaticMarkup(
      <GroupMemberList members={sampleMembers} onAdd={() => undefined} />,
    );
    expect(html).toContain(NO_CANDIDATES_TEXT);
    expect(html).toContain('disabled');
  });

  // negative(render) — loading=true + onAdd → 추가 form 미렌더(전이 상태 우선).
  it('loading=true + onAdd → 추가 form 미렌더, 로딩 표시 우선 (negative — loading 우선, 추가 form 억제)', () => {
    const html = renderToStaticMarkup(
      <GroupMemberList
        members={[]}
        loading={true}
        onAdd={() => undefined}
        addCandidates={sampleCandidates}
      />,
    );
    expect(html).toContain('role="status"');
    expect(html).toContain(LOADING_TOKEN);
    expect(html).not.toContain(ADD_SELECT_MARKER);
    expect(html).not.toContain('<form');
  });

  // negative(render) — error + onAdd → 추가 form 미렌더(전이 상태 우선).
  it('error + onAdd → 추가 form 미렌더, alert 우선 (negative — error 우선, 추가 form 억제)', () => {
    const html = renderToStaticMarkup(
      <GroupMemberList
        members={sampleMembers}
        error="조회 실패"
        onAdd={() => undefined}
        addCandidates={sampleCandidates}
      />,
    );
    expect(html).toContain('role="alert"');
    expect(html).not.toContain(ADD_SELECT_MARKER);
    expect(html).not.toContain('<form');
  });

  // branch(flow) — members 빈 배열 + onAdd → 빈 상태 메시지 와 추가 form 이 함께 렌더된다(첫 멤버 추가).
  it('members 빈 배열 + onAdd → 빈 상태 메시지 + 추가 form 함께 렌더 (branch — 빈 목록에서도 추가 가능)', () => {
    const html = renderToStaticMarkup(
      <GroupMemberList members={[]} onAdd={() => undefined} addCandidates={sampleCandidates} />,
    );
    expect(html).toContain(DEFAULT_EMPTY);
    expect(html).toContain(ADD_SELECT_MARKER);
    expect(html).toContain(ADD_PLACEHOLDER);
    expect(html).toContain('박신입');
  });

  // branch(flow) — members 1+ + onAdd → 목록(<ul>) 과 추가 form 이 함께 렌더된다.
  it('members 1+ + onAdd → 목록 + 추가 form 함께 렌더 (branch — 목록과 추가 form 공존)', () => {
    const html = renderToStaticMarkup(
      <GroupMemberList
        members={sampleMembers}
        onAdd={() => undefined}
        addCandidates={sampleCandidates}
      />,
    );
    expect(html).toContain('<ul>');
    expect(html).toContain('홍길동');
    expect(html).toContain(ADD_SELECT_MARKER);
    expect(html).toContain(ADD_PLACEHOLDER);
  });

  // branch(render) — 초기 미선택 상태에서는 추가 버튼이 disabled(빈 personId 전송 차단 — 렌더 단계).
  it('초기 미선택 상태 → 추가 버튼 disabled (branch — 미선택 시 추가 버튼 비활성)', () => {
    const html = renderToStaticMarkup(
      <GroupMemberList
        members={sampleMembers}
        onAdd={() => undefined}
        addCandidates={sampleCandidates}
      />,
    );
    // 후보가 있어 select 는 enabled 지만(초기 선택값 ''), 추가 버튼은 미선택이라 disabled 여야 한다.
    expect(html).toContain('type="submit"');
    expect(html).toContain('disabled');
  });

  // no-regression — onRemove + onAdd 동시 전달 → 제거 버튼과 추가 form 이 공존한다.
  it('onRemove + onAdd 동시 전달 → 제거 버튼 + 추가 form 공존 (no-regression — remove/add 공존)', () => {
    const html = renderToStaticMarkup(
      <GroupMemberList
        members={sampleMembers}
        onRemove={() => undefined}
        onAdd={() => undefined}
        addCandidates={sampleCandidates}
      />,
    );
    expect(html).toContain(REMOVE_LABEL);
    expect(html).toContain(ADD_LABEL);
    expect(html).toContain(ADD_SELECT_MARKER);
  });

  // ── T-1239: 추가 후보 검색/필터 slice ─────────────────────────────────────
  // renderToStaticMarkup 은 이벤트를 발화하지 않아 검색 입력에 타이핑한 뒤의 필터된 옵션·
  // "검색 결과 없음" 렌더는 정적 렌더로 재현 불가하다(filterText useState 는 항상 초기값 '').
  // 그래서 필터 결정 로직을 순수 함수 filterCandidates 로 분리·export 해 매칭·부분일치·
  // case-insensitivity·빈 질의어·비배열 방어·대량 목록을 직접 호출로 검증하고, 렌더 분기
  // (검색 입력 노출/부재·초기 미필터 옵션·byte 동등)는 정적 markup 으로 assert 한다.

  // 5인 후보 — happy-path 부분일치용(이름에 "김" 2인, "박"/"이"/"최" 각 1인).
  const fiveCandidates: Member[] = [
    { id: 'c1', name: '김하나', role: '평가자' },
    { id: 'c2', name: '김두리' },
    { id: 'c3', name: '박세찬', role: '관리자' },
    { id: 'c4', name: '이넷째' },
    { id: 'c5', name: '최다섯' },
  ];

  // happy-path(pure) — 부분일치 질의어로 매칭 후보만 남기고 그 personId 로 submitAdd → onAdd 1회.
  it('filterCandidates("김", 5인) → 매칭 2인만 남고 그 personId 로 submitAdd 시 onAdd 1회 (happy-path — 필터 후 추가)', () => {
    const matched = filterCandidates(fiveCandidates, '김');
    expect(matched.map((m) => m.id)).toEqual(['c1', 'c2']);
    // 매칭된 후보 하나를 선택해 추가하면 onAdd 가 그 personId 로 정확히 1회 호출된다.
    const onAdd = vi.fn();
    submitAdd(matched[0].id, onAdd);
    expect(onAdd).toHaveBeenCalledTimes(1);
    expect(onAdd).toHaveBeenCalledWith('c1');
  });

  // happy-path(render) — onAdd + addCandidates 주입 시 검색 입력(aria-label)이 select 위에 렌더된다.
  it('onAdd + addCandidates 주입 시 검색 입력(aria-label "추가 후보 검색") 렌더 (happy-path — 검색 입력 렌더)', () => {
    const html = renderToStaticMarkup(
      <GroupMemberList
        members={sampleMembers}
        onAdd={() => undefined}
        addCandidates={fiveCandidates}
      />,
    );
    expect(html).toContain(`aria-label="${SEARCH_LABEL}"`);
    expect(html).toContain('type="search"');
    // 초기 filterText='' 이므로 필터 미적용 — 모든 후보 옵션이 그대로 렌더된다.
    expect(html).toContain('김하나');
    expect(html).toContain('최다섯');
    // 초기(미필터) 상태에서는 "검색 결과 없음" 안내가 없다.
    expect(html).not.toContain(NO_RESULTS_TEXT);
  });

  // negative(pure) — undefined 입력 시 빈 배열 반환(throw 없음).
  it('filterCandidates(undefined, "김") → 빈 배열 반환·throw 없음 (negative — 비배열 방어 undefined)', () => {
    expect(() => filterCandidates(undefined, '김')).not.toThrow();
    expect(filterCandidates(undefined, '김')).toEqual([]);
  });

  // negative(pure) — 비배열(런타임 오용) 입력도 throw 없이 빈 배열 반환.
  it('filterCandidates(비배열, "김") → 빈 배열 반환·throw 없음 (negative — 비배열 방어 non-array)', () => {
    // 런타임 오용 시나리오 — 타입 계약 밖의 값이 들어와도 방어한다.
    const bogus = 'not-an-array' as unknown as Member[];
    expect(() => filterCandidates(bogus, '김')).not.toThrow();
    expect(filterCandidates(bogus, '김')).toEqual([]);
  });

  // negative(pure) — 매칭 0건 질의어 → 빈 배열(원본은 비지 않음 → 렌더 시 "검색 결과 없음" 분기).
  it('filterCandidates(5인, "존재하지않는이름") → 빈 배열 (negative — 매칭 0건)', () => {
    const matched = filterCandidates(fiveCandidates, '존재하지않는이름');
    expect(matched).toEqual([]);
    // 원본 후보는 여전히 ≥1개이므로 렌더는 "검색 결과 없음" 분기(showNoResults)로 간다.
    expect(fiveCandidates.length).toBeGreaterThan(0);
  });

  // negative/edge(pure) — case-insensitivity: 소문자 질의 vs 대문자 이름 매칭.
  it('filterCandidates — 소문자 질의 "abc" 가 대문자 이름 "ABCDEF" 에 매칭 (negative — 대소문자 불일치 case-insensitive)', () => {
    const cand: Member[] = [
      { id: 'u1', name: 'ABCDEF' },
      { id: 'u2', name: 'XYZ' },
    ];
    expect(filterCandidates(cand, 'abc').map((m) => m.id)).toEqual(['u1']);
    // 반대 방향 — 대문자 질의 vs 소문자 이름도 매칭한다.
    const cand2: Member[] = [{ id: 'u3', name: 'abcdef' }];
    expect(filterCandidates(cand2, 'ABC').map((m) => m.id)).toEqual(['u3']);
  });

  // branch(pure) — 빈 질의어 → 후보 전체 반환(필터 미적용 분기).
  it('filterCandidates(5인, "") → 후보 전체 반환 (branch — 빈 질의어 필터 미적용)', () => {
    expect(filterCandidates(fiveCandidates, '')).toBe(fiveCandidates);
  });

  // branch/edge(pure) — 공백뿐인 질의어 → trim 후 빈 질의어로 간주, 후보 전체 반환.
  it('filterCandidates(5인, "   ") → trim 후 빈 질의어 → 후보 전체 반환 (branch/edge — 공백 질의어)', () => {
    expect(filterCandidates(fiveCandidates, '   ')).toBe(fiveCandidates);
  });

  // branch(pure) — role 매칭: name 에는 없고 role 에만 있는 질의어로 role 있는 후보만 남는다.
  it('filterCandidates — role 부분일치 매칭(name 미포함) + role 없는 후보 제외 (branch — role 있음/없음 매칭)', () => {
    const cand: Member[] = [
      { id: 'r1', name: '홍길동', role: '관리자' },
      { id: 'r2', name: '김철수', role: '평가자' },
      { id: 'r3', name: '이영희' }, // role 없음 — 질의어가 role 매칭이면 제외됨
    ];
    // "관리" 는 어느 이름에도 없고 r1 의 role 에만 있다.
    expect(filterCandidates(cand, '관리').map((m) => m.id)).toEqual(['r1']);
    // role 없는 후보는 name 매칭이 아니면 role undefined 로 인해 제외된다(throw 없음).
    expect(filterCandidates(cand, '평가').map((m) => m.id)).toEqual(['r2']);
  });

  // branch(pure) — name 매칭: role 있는 후보와 role 없는 후보 각각 name 으로 매칭된다.
  it('filterCandidates — name 부분일치는 role 유무 무관하게 매칭 (branch — name 매칭 role 유/무)', () => {
    const cand: Member[] = [
      { id: 'n1', name: '박신입', role: '평가자' }, // role 있음
      { id: 'n2', name: '박신규' }, // role 없음
      { id: 'n3', name: '최다른' },
    ];
    expect(filterCandidates(cand, '박신').map((m) => m.id)).toEqual(['n1', 'n2']);
  });

  // negative(pure, large) — 대량 후보(200인)에서도 부분일치가 정확히 좁혀지고 throw 없다(R-91 규모).
  it('filterCandidates — 200인 대량 후보에서 특정 부분일치만 정확히 좁힌다 (negative — 대량 목록 사용성)', () => {
    const large: Member[] = Array.from({ length: 200 }, (_, i) => ({
      id: `p${i}`,
      name: `사원${i}`,
    }));
    // "사원199" 는 정확히 1인만 매칭된다.
    expect(filterCandidates(large, '사원199').map((m) => m.id)).toEqual(['p199']);
    // 빈 질의어면 200인 전체가 그대로 유지된다(대량에서도 필터 미적용 분기 안전).
    expect(filterCandidates(large, '')).toHaveLength(200);
  });

  // negative(render) — onAdd 미전달 시 검색 입력이 렌더되지 않는다(byte 동등 유지 — 필터 UI 부재).
  it('onAdd 미전달 → 검색 입력 미렌더 (negative — onAdd 없으면 필터 UI 부재)', () => {
    const html = renderToStaticMarkup(
      <GroupMemberList members={sampleMembers} addCandidates={fiveCandidates} />,
    );
    expect(html).not.toContain(`aria-label="${SEARCH_LABEL}"`);
    expect(html).not.toContain('type="search"');
  });

  // no-regression(byte 동등) — 필터 입력은 addForm(onAdd 있을 때만) 안에만 있어 onAdd 미전달
  // 렌더는 addCandidates 유무와 무관하게 여전히 byte 동등하다(T-1239 후에도 무회귀).
  it('onAdd 미전달 시 addCandidates 주입해도 기존 렌더와 byte 동등 (no-regression — 필터 UI 0)', () => {
    const withCandidatesProp = renderToStaticMarkup(
      <GroupMemberList members={sampleMembers} addCandidates={fiveCandidates} />,
    );
    const baseline = renderToStaticMarkup(<GroupMemberList members={sampleMembers} />);
    expect(withCandidatesProp).toBe(baseline);
  });

  // ── T-1240: 선택 후보 stale 자동 무효화 slice ─────────────────────────────
  // renderToStaticMarkup 은 이벤트를 발화하지 않아 "후보 선택 → 추가 성공(재조회로 후보에서
  // 사라짐) → select placeholder 복귀" 의 state 전이를 정적 렌더로 재현할 수 없다(selectedPersonId
  // useState 는 항상 초기값 ''). 그래서 유효-선택 판정을 순수 함수 resolveActiveSelection 으로
  // 분리·export 해 유지/리셋/필터-숨김 보존/비배열·미선택 방어 분기를 직접 호출로 검증하고,
  // stale 상태의 phantom 재발사 차단은 resolveActiveSelection 결과를 submitAdd 로 합성해 검증한다
  // (T-1237/T-1239 가 이벤트 한계를 순수 함수 검증으로 우회한 관례 mirror).

  // happy-path(pure, 유지 분기) — 선택 id 가 후보 집합에 존재하면 그대로 반환한다.
  it('resolveActiveSelection — 선택 id 가 후보에 존재 → 그대로 반환 (happy-path — 유지 분기)', () => {
    expect(resolveActiveSelection('p10', sampleCandidates)).toBe('p10');
    expect(resolveActiveSelection('p11', sampleCandidates)).toBe('p11');
  });

  // happy-path(합성) — 후보를 선택해 추가 성공 시 그 인원이 후보에서 사라지면 유효 선택은 ''
  // 로 복귀하고(리셋), 이어 남은 다른 후보를 재선택해 추가하면 onAdd 가 그 새 personId 로 정확히
  // 1회 호출된다("추가 성공 후 재선택" UX — AC happy-path).
  it('추가 성공(후보에서 사라짐) → 유효 선택 "" 복귀 후 다른 후보 재선택 시 onAdd 1회 (happy-path — 재선택 흐름)', () => {
    // 초기: p10 선택 상태 → 유효.
    expect(resolveActiveSelection('p10', sampleCandidates)).toBe('p10');
    // 추가 성공으로 p10 이 후보에서 사라진 재조회 결과.
    const afterAdd: Member[] = [{ id: 'p11', name: '최신규' }];
    // stale 한 p10 선택은 '' 로 리셋된다(placeholder 복귀).
    expect(resolveActiveSelection('p10', afterAdd)).toBe('');
    // 남은 후보 p11 을 재선택해 추가하면 onAdd 가 p11 로 정확히 1회 호출된다.
    const onAdd = vi.fn();
    submitAdd(resolveActiveSelection('p11', afterAdd), onAdd);
    expect(onAdd).toHaveBeenCalledTimes(1);
    expect(onAdd).toHaveBeenCalledWith('p11');
  });

  // negative(pure, 리셋 분기) — 선택 id 가 후보 집합에 없으면 '' 를 반환한다.
  it('resolveActiveSelection — 선택 id 가 후보에서 사라짐 → "" 반환 (negative — 리셋 분기)', () => {
    const without: Member[] = [{ id: 'p11', name: '최신규' }];
    expect(resolveActiveSelection('p10', without)).toBe('');
    // 후보가 아예 빈 배열이어도 '' 로 리셋(존재하는 후보 0).
    expect(resolveActiveSelection('p10', [])).toBe('');
  });

  // negative(pure, 비배열 방어) — undefined/비배열 candidates 입력 시 throw 없이 '' 반환.
  it('resolveActiveSelection — undefined/비배열 candidates → throw 없이 "" 반환 (negative — 비배열 방어)', () => {
    expect(() => resolveActiveSelection('p10', undefined)).not.toThrow();
    expect(resolveActiveSelection('p10', undefined)).toBe('');
    const bogus = 'not-an-array' as unknown as Member[];
    expect(() => resolveActiveSelection('p10', bogus)).not.toThrow();
    expect(resolveActiveSelection('p10', bogus)).toBe('');
  });

  // negative(pure, 경계값) — selectedPersonId 가 ''(미선택)이면 후보와 무관하게 '' 반환.
  it('resolveActiveSelection — 미선택("") → 후보 무관하게 "" 반환 (negative — 경계값)', () => {
    expect(resolveActiveSelection('', sampleCandidates)).toBe('');
    expect(resolveActiveSelection('', [])).toBe('');
    expect(resolveActiveSelection('', undefined)).toBe('');
  });

  // negative(합성) — 선택 인원이 후보에서 사라진 stale 상태에서 "추가" 제출 시 유효 선택이 ''
  // 로 파생되어 submitAdd 가 no-op → onAdd 미발사(phantom 재발사 차단 — backend 409 이전 단계에서 원천 차단).
  it('stale 선택(후보에서 사라짐)으로 추가 제출 → onAdd 미발사 (negative — phantom 재발사 차단)', () => {
    const onAdd = vi.fn();
    const afterAdd: Member[] = [{ id: 'p11', name: '최신규' }];
    // 소비처가 보는 유효 선택은 '' 이므로 submitAdd 는 아무 것도 하지 않는다.
    submitAdd(resolveActiveSelection('p10', afterAdd), onAdd);
    expect(onAdd).not.toHaveBeenCalled();
  });

  // branch(pure, 필터-숨김 보존) — 판정 기준은 원본 candidates 이므로, 검색 필터로 옵션에서
  // 가려졌을 뿐 후보 집합에는 여전히 존재하는 선택은 유효로 유지된다(필터 변경만으로 리셋 금지 —
  // T-1239 결정 보존). filterCandidates 결과가 아니라 원본 candidates 를 넘긴다.
  it('resolveActiveSelection — 필터로 옵션 숨김이나 candidates 에 존재 → 유지 (branch — 필터-숨김 선택 보존)', () => {
    // 검색어 "박" 으로 옵션은 p10(박신입)만 남아 p11 은 화면에서 가려지지만,
    const filtered = filterCandidates(sampleCandidates, '박');
    expect(filtered.map((m) => m.id)).toEqual(['p10']);
    // 판정 기준은 원본 candidates 라 가려진 p11 선택도 유효로 유지된다(리셋되지 않음).
    expect(resolveActiveSelection('p11', sampleCandidates)).toBe('p11');
  });

  // no-regression(byte 동등) — 유효-선택 파생은 순수 렌더 계산이라 마크업을 바꾸지 않는다.
  // 초기 selectedPersonId 는 항상 ''(정적 렌더) → activeSelectedId 도 '' → 추가 form 렌더는
  // T-1239 이전과 byte 동등하고, onAdd 미전달 렌더도 여전히 byte 동등하다.
  it('T-1240 후에도 onAdd 미전달 렌더는 기존과 byte 동등 (no-regression — 유효선택 파생 무회귀)', () => {
    const withCandidatesProp = renderToStaticMarkup(
      <GroupMemberList members={sampleMembers} addCandidates={sampleCandidates} />,
    );
    const baseline = renderToStaticMarkup(<GroupMemberList members={sampleMembers} />);
    expect(withCandidatesProp).toBe(baseline);
  });

  // ── T-1241: 추가 성공 후 검색어·선택 자동 초기화 + 검색 입력 auto-focus slice ────────
  // renderToStaticMarkup 은 이벤트를 발화하지 않고 DOM/focus 도 없으므로(ADR-0040 §5 —
  // web test infra 는 jsdom·@testing-library 없이 정적 렌더 문자열만 검증해 dep 표면 최소화)
  // "후보 선택 → 제출 → 검색 input value 초기화 → document.activeElement 이동" 의 실 DOM 전이는
  // 정적 렌더로 재현 불가하다. 그래서 T-1237/T-1239/T-1240 관례를 mirror 해 (1) 발사 판정을
  // 담는 순수 helper submitAdd 의 boolean 반환(reset gate)과 (2) focus 부수효과 helper
  // focusSearchInput(ref) 를 각각 직접 호출로 검증하고, 렌더 분기(검색 input ref 배선의 byte
  // 동등·form 무회귀)는 정적 markup 으로 assert 한다. 리셋 세 부수효과(setFilterText('')·
  // setSelectedPersonId('')·focus)는 fired===true 게이트 하에 실행되며, 그 게이트 자체가
  // submitAdd boolean 으로 완전 cover 된다.

  // happy-path(pure, reset gate 발사 분기) — 유효 선택 + onAdd → submitAdd 는 onAdd 를 그
  // personId 로 1회 호출하고 true 를 반환한다(반환 true 가 검색어·선택 리셋+focus 를 트리거).
  it('submitAdd(personId, onAdd) → onAdd 1회 호출 + true 반환 (happy-path — 발사 시 reset gate true)', () => {
    const onAdd = vi.fn();
    const fired = submitAdd('p10', onAdd);
    expect(fired).toBe(true);
    expect(onAdd).toHaveBeenCalledTimes(1);
    expect(onAdd).toHaveBeenCalledWith('p10');
  });

  // negative(pure, 미발사 분기 — 빈 선택) — 빈 personId 면 onAdd 미호출 + false 반환(리셋 skip).
  it('submitAdd("", onAdd) → false 반환 + onAdd 미호출 (negative — 빈 선택 미발사, 리셋 skip)', () => {
    const onAdd = vi.fn();
    const fired = submitAdd('', onAdd);
    expect(fired).toBe(false);
    expect(onAdd).not.toHaveBeenCalled();
  });

  // negative(pure, 미발사 분기 — onAdd 미전달) — onAdd 없으면 throw 없이 false 반환(리셋 skip).
  it('submitAdd(personId, undefined) → false 반환 + throw 없음 (negative — onAdd 미전달 미발사)', () => {
    let fired: boolean | undefined;
    expect(() => {
      fired = submitAdd('p10', undefined);
    }).not.toThrow();
    expect(fired).toBe(false);
  });

  // happy-path(pure, focus 부수효과) — ref.current 존재 시 focusSearchInput 은 .focus() 를 1회 호출한다.
  it('focusSearchInput(ref) — ref.current 존재 → .focus() 정확히 1회 호출 (happy-path — 발사 후 auto-focus)', () => {
    const focus = vi.fn();
    const ref = { current: { focus } as unknown as HTMLInputElement };
    focusSearchInput(ref);
    expect(focus).toHaveBeenCalledTimes(1);
  });

  // negative(pure, focus 안전성) — ref.current 가 null 이면 optional chaining 으로 throw 없이 no-op.
  it('focusSearchInput({ current: null }) → throw 없이 no-op (negative — ref null 안전성)', () => {
    expect(() => focusSearchInput({ current: null })).not.toThrow();
  });

  // branch(합성, 발사 → 리셋 실행) — 유효 선택으로 발사되면 fired===true 이므로 리셋+focus 게이트에
  // 진입한다. focusSearchInput 이 그 게이트 하에서 호출됨을 합성으로 검증(발사 성공 후 auto-focus 흐름).
  it('발사 성공(fired=true) → focusSearchInput 게이트 진입·focus 호출 (branch — 발사 시 리셋+focus 실행)', () => {
    const onAdd = vi.fn();
    const focus = vi.fn();
    const ref = { current: { focus } as unknown as HTMLInputElement };
    const fired = submitAdd('p10', onAdd);
    if (fired) {
      // onSubmit 핸들러의 리셋 게이트를 합성 재현 — fired 시에만 focus.
      focusSearchInput(ref);
    }
    expect(onAdd).toHaveBeenCalledTimes(1);
    expect(focus).toHaveBeenCalledTimes(1);
  });

  // branch(합성, 미발사 → 리셋 skip) — 빈 선택이면 fired===false 라 focus 게이트에 진입하지 않는다.
  // (검색어 리셋도 동일 게이트 하 → 아무 것도 추가 안 됐는데 검색어가 지워지지 않음 — 회귀 방지.)
  it('미발사(fired=false, 빈 선택) → focus 게이트 미진입·focus 미호출 (branch — 미발사 시 리셋 skip)', () => {
    const onAdd = vi.fn();
    const focus = vi.fn();
    const ref = { current: { focus } as unknown as HTMLInputElement };
    const fired = submitAdd('', onAdd);
    if (fired) {
      focusSearchInput(ref);
    }
    expect(onAdd).not.toHaveBeenCalled();
    expect(focus).not.toHaveBeenCalled();
  });

  // negative(합성, 검색어 잔여 필터 제거 회귀 방지) — 검색어가 있는 상태에서 매칭 후보를 발사하면
  // fired===true → 검색어 리셋 게이트 진입. 순수 조합으로 "필터 후 발사 → 리셋 트리거" 를 검증한다
  // (실 setFilterText('') state 전이는 DOM 필요라 ADR-0040 §5 범위 밖 — fired 게이트로 cover).
  it('검색어("김")로 좁힌 후보 발사 → fired=true (검색어 리셋 게이트 진입) (negative — 잔여 필터 제거 회귀 방지)', () => {
    const filtered = filterCandidates(
      [
        { id: 'k1', name: '김하나' },
        { id: 'k2', name: '박두리' },
      ],
      '김',
    );
    expect(filtered.map((m) => m.id)).toEqual(['k1']);
    const onAdd = vi.fn();
    const fired = submitAdd(filtered[0].id, onAdd);
    // fired true 는 onSubmit 에서 setFilterText('')·setSelectedPersonId('')·focus 를 트리거한다.
    expect(fired).toBe(true);
    expect(onAdd).toHaveBeenCalledWith('k1');
  });

  // no-regression(byte 동등) — searchInputRef(useRef) 와 ref 배선은 순수 렌더 계산이라 정적 markup 에
  // 나타나지 않는다. onAdd 미전달 렌더는 addCandidates 유무와 무관하게 여전히 byte 동등하다.
  it('T-1241 후에도 onAdd 미전달 렌더는 기존과 byte 동등 (no-regression — ref 배선 무회귀)', () => {
    const withCandidatesProp = renderToStaticMarkup(
      <GroupMemberList members={sampleMembers} addCandidates={sampleCandidates} />,
    );
    const baseline = renderToStaticMarkup(<GroupMemberList members={sampleMembers} />);
    expect(withCandidatesProp).toBe(baseline);
  });

  // no-regression(render) — onAdd + addCandidates 주입 시 검색 input(ref 배선 후에도) 이 여전히
  // type="search" + aria-label 로 렌더되고 추가 form(select/추가 버튼)이 정상 공존한다.
  it('T-1241 후 onAdd + addCandidates → 검색 input + 추가 form 정상 렌더 (no-regression — 추가 UI 무회귀)', () => {
    const html = renderToStaticMarkup(
      <GroupMemberList
        members={sampleMembers}
        onAdd={() => undefined}
        addCandidates={sampleCandidates}
      />,
    );
    expect(html).toContain('type="search"');
    expect(html).toContain(`aria-label="${SEARCH_LABEL}"`);
    expect(html).toContain(ADD_SELECT_MARKER);
    expect(html).toContain(ADD_LABEL);
  });
});
