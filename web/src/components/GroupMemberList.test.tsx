import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import GroupMemberList from './GroupMemberList';
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

// 테스트용 멤버 — role 포함 2명 + role 미포함 1명(throw 없이 name 만 렌더 검증용).
const sampleMembers: Member[] = [
  { id: 'm1', name: '홍길동', role: '관리자' },
  { id: 'm2', name: '김철수', role: '평가자' },
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
});
