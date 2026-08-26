import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import AssessmentResultTable, {
  ASSESSMENT_TABLE_COLUMNS,
  formatCellValue,
} from './AssessmentResultTable';
import type { AssessmentSortKey } from './AssessmentResultTable';
import { ASSESSMENT_DISPLAY_ROW_KEYS } from '../api/assessmentRow';
import type { AssessmentDisplayRow } from '../api/assessmentRow';

// R-112 — REQ-075 slice 2 (backend 필드 정합 평가 결과 표) 검증. EvaluationResultTable.test.tsx
// 와 동일 패턴: jsdom · @testing-library 없이 renderToStaticMarkup 으로 정적 마크업만 assert
// 한다(ADR-0040 §5). 이벤트가 발화되지 않으므로 onSortChange 는 "핸들러 부착 시에도 렌더가
// 깨지지 않는다" 수준까지만 검증하고, 콜백 호출 검증은 배선 slice 의 몫이다.
const LOADING_TOKEN = '불러오는 중…';
const DEFAULT_EMPTY = '표시할 평가 결과가 없습니다';
// 표시 컬럼에서 제외하기로 한 3 키 (구현 파일 상단 주석의 제외 사유와 정합).
const EXCLUDED_KEYS = ['id', 'personId', 'narrative'];
const LABELS = ['기간', '범위', '시작', '난이도', '기여 점수', '업무량'];
// 완전한 표시 행 2 건 — 순서 보존 검증에도 쓴다.
const sampleRows: AssessmentDisplayRow[] = [
  { id: 'a1', personId: 'p1', period: '2026-07', scope: 'team',
    periodStart: '2026-07-01T00:00:00.000Z', difficulty: 'HIGH',
    contributionScore: 92.5, volume: 12, narrative: '월간 서술 요약' },
  { id: 'a2', personId: 'p2', period: '2026-08', scope: 'individual',
    periodStart: '2026-08-01T00:00:00.000Z', difficulty: 'LOW',
    contributionScore: 41, volume: 3, narrative: '두 번째 서술' },
];
const countOf = (html: string, re: RegExp) => (html.match(re) ?? []).length;

describe('ASSESSMENT_TABLE_COLUMNS', () => {
  it('6 개 컬럼을 backend 필드 순서로 정의하고 각 항목이 한국어 라벨을 갖는다 (happy-path)', () => {
    expect(ASSESSMENT_TABLE_COLUMNS.map((c) => c.key)).toEqual([
      'period', 'scope', 'periodStart', 'difficulty', 'contributionScore', 'volume',
    ]);
    expect(ASSESSMENT_TABLE_COLUMNS.map((c) => c.label)).toEqual(LABELS);
  });
  // 계약 drift guard — 컬럼 키 집합은 helper 의 표시 행 키에서 제외 3 키를 정확히 뺀 것이다.
  // assessmentRow.ts 의 필드가 바뀌면 본 test 가 fail 해 표 컬럼 재검토를 강제한다.
  it('컬럼 키 집합 = ASSESSMENT_DISPLAY_ROW_KEYS - {id, personId, narrative} (drift guard)', () => {
    const expected = ASSESSMENT_DISPLAY_ROW_KEYS.filter((k) => !EXCLUDED_KEYS.includes(k));
    expect(ASSESSMENT_TABLE_COLUMNS.map((c) => c.key)).toEqual(expected);
    for (const excluded of EXCLUDED_KEYS) {
      expect(ASSESSMENT_TABLE_COLUMNS.some((c) => c.key === excluded)).toBe(false);
    }
  });
});

describe('formatCellValue', () => {
  it('문자열 값은 원문 그대로 반환한다 (happy-path — 문자열 갈래)', () => {
    expect(formatCellValue(sampleRows[0], 'period')).toBe('2026-07');
    expect(formatCellValue(sampleRows[0], 'difficulty')).toBe('HIGH');
  });
  // 0 점과 "값 없음" 은 의미가 다르므로 0 은 빈칸이 아니라 '0' 이어야 한다.
  it('숫자 값은 문자열화하고 0 도 값으로 표시한다 (branch — 숫자 갈래)', () => {
    expect(formatCellValue(sampleRows[0], 'contributionScore')).toBe('92.5');
    expect(formatCellValue({ ...sampleRows[0], volume: 0 }, 'volume')).toBe('0');
  });
  it('숫자 축 null 은 "—" 로 표시한다 (branch — null 갈래)', () => {
    const row = { ...sampleRows[0], contributionScore: null, volume: null };
    expect(formatCellValue(row, 'contributionScore')).toBe('—');
    expect(formatCellValue(row, 'volume')).toBe('—');
  });
  // 빈 셀 대신 명시적 "값 없음" 기호를 쓴다(문자열 축 빈 문자열 흡수).
  it('빈 문자열도 "—" 로 표시한다 (branch — 빈 문자열 갈래)', () => {
    expect(formatCellValue({ ...sampleRows[0], scope: '' }, 'scope')).toBe('—');
  });
  // negative — 타입 우회 입력도 throw 없이 '—' 로 흡수해 화면 누출을 막는다.
  it('비정상 입력(NaN · undefined · row=null · 미지 키)도 throw 없이 "—" 다 (negative — 타입 우회)', () => {
    const broken = { ...sampleRows[0], volume: NaN, difficulty: undefined } as unknown as AssessmentDisplayRow;
    expect(() => formatCellValue(broken, 'volume')).not.toThrow();
    expect(formatCellValue(broken, 'volume')).toBe('—');
    expect(formatCellValue(broken, 'difficulty')).toBe('—');
    expect(formatCellValue(null as unknown as AssessmentDisplayRow, 'period')).toBe('—');
    expect(formatCellValue(sampleRows[0], 'nope' as AssessmentSortKey)).toBe('—');
  });
});

describe('AssessmentResultTable', () => {
  it('rows 전달 시 6 컬럼 헤더 + 행당 6 셀과 값을 순서대로 렌더한다 (happy-path)', () => {
    const html = renderToStaticMarkup(<AssessmentResultTable rows={sampleRows} />);
    expect(html).toContain('<table>');
    for (const label of LABELS) expect(html).toContain(label);
    for (const token of ['2026-07', 'team', 'HIGH', '92.5', '2026-08', 'individual', 'LOW', '41']) {
      expect(html).toContain(token);
    }
    expect(countOf(html, /<th[ >]/g)).toBe(6);
    expect(countOf(html, /<td>/g)).toBe(12);
    // props 순서 보존 — 내부 정렬 0 이라 첫 행 토큰이 둘째 행보다 앞선다.
    expect(html.indexOf('2026-07')).toBeLessThan(html.indexOf('2026-08'));
  });
  it('id · personId · narrative 값은 표에 노출하지 않는다 (negative — 제외 컬럼)', () => {
    const html = renderToStaticMarkup(<AssessmentResultTable rows={sampleRows} />);
    for (const hidden of ['a1', 'p1', '월간 서술 요약', '두 번째 서술']) {
      expect(html).not.toContain(hidden);
    }
  });
  it('loading=true 면 role="status" 로딩 문구만 렌더한다 (branch — loading)', () => {
    const html = renderToStaticMarkup(<AssessmentResultTable rows={[]} loading={true} />);
    expect(html).toContain('role="status"');
    expect(html).toContain(LOADING_TOKEN);
    expect(html).not.toContain('<table>');
    expect(html).not.toContain(DEFAULT_EMPTY);
  });
  it('rows 있음 + loading=true → 행 미렌더, 로딩 우선 (negative — loading 우선 정책)', () => {
    const html = renderToStaticMarkup(<AssessmentResultTable rows={sampleRows} loading={true} />);
    expect(html).toContain(LOADING_TOKEN);
    expect(html).not.toContain('<table>');
    expect(html).not.toContain('2026-07');
  });
  it('rows 빈 배열이면 기본 빈 상태 문구를 렌더한다 (branch — empty)', () => {
    const html = renderToStaticMarkup(<AssessmentResultTable rows={[]} />);
    expect(html).toContain('role="status"');
    expect(html).toContain(DEFAULT_EMPTY);
    expect(html).not.toContain('<table>');
  });
  // 의미 없는 빈 메시지를 렌더하지 않기 위한 fallback 경계값.
  it('emptyMessage="" 는 기본 문구로 fallback 한다 (error path — 빈 문자열 경계값)', () => {
    expect(renderToStaticMarkup(<AssessmentResultTable rows={[]} emptyMessage="" />))
      .toContain(DEFAULT_EMPTY);
  });
  it('sortKey 일치 + asc 면 그 헤더에만 aria-sort="ascending" (branch — sort asc)', () => {
    const html = renderToStaticMarkup(<AssessmentResultTable rows={sampleRows} sortKey="contributionScore" sortDirection="asc" />);
    expect(html).toContain('aria-sort="ascending"');
    expect(countOf(html, /aria-sort=/g)).toBe(1);
  });
  it('sortKey 일치 + desc 면 그 헤더에만 aria-sort="descending" (branch — sort desc)', () => {
    const html = renderToStaticMarkup(<AssessmentResultTable rows={sampleRows} sortKey="period" sortDirection="desc" />);
    expect(html).toContain('aria-sort="descending"');
    expect(countOf(html, /aria-sort=/g)).toBe(1);
  });
  it('sortDirection 미전달이면 aria-sort 를 어디에도 부여하지 않는다 (branch — 방향 미상)', () => {
    const html = renderToStaticMarkup(<AssessmentResultTable rows={sampleRows} sortKey="period" />);
    expect(html).not.toContain('aria-sort');
  });
  it('미지의 sortKey 여도 헤더 렌더는 정상, aria-sort 만 미부여 (negative — 미지 키)', () => {
    const html = renderToStaticMarkup(<AssessmentResultTable rows={sampleRows} sortKey={'ghost' as AssessmentSortKey} sortDirection="asc" />);
    expect(countOf(html, /<th[ >]/g)).toBe(6);
    expect(html).not.toContain('aria-sort');
  });
  // 정적 마크업에는 이벤트 핸들러가 직렬화되지 않으므로 "콜백 유무와 무관히 렌더가
  // 동일하고 throw 0" 임을 고정한다 — 콜백 미전달 시 핸들러 부재의 관측 가능한 대리 지표.
  it('onSortChange 미전달 시 헤더 클릭 핸들러 없이 정상 렌더한다 (error path — 콜백 부재)', () => {
    expect(() => renderToStaticMarkup(<AssessmentResultTable rows={sampleRows} />)).not.toThrow();
    const html = renderToStaticMarkup(<AssessmentResultTable rows={sampleRows} />);
    expect(html).not.toContain('onclick');
    const withCb = renderToStaticMarkup(<AssessmentResultTable rows={sampleRows} onSortChange={() => undefined} />);
    expect(withCb).toBe(html);
  });
  it('숫자 축 null 은 "—" 셀로 렌더하고 null/NaN/undefined 문자열을 노출하지 않는다 (negative)', () => {
    const rows = [{ ...sampleRows[0], contributionScore: null, volume: null }];
    const html = renderToStaticMarkup(<AssessmentResultTable rows={rows} />);
    expect(countOf(html, /<td>—<\/td>/g)).toBe(2);
    for (const leak of ['null', 'NaN', 'undefined']) expect(html).not.toContain(leak);
  });
  it('Object.freeze 된 rows 에도 throw 0, 입력 mutation 0 (negative — 불변 입력)', () => {
    const frozen = Object.freeze(sampleRows.map((r) => Object.freeze({ ...r })));
    const before = JSON.stringify(frozen);
    const render = () => renderToStaticMarkup(<AssessmentResultTable rows={frozen as AssessmentDisplayRow[]} sortKey="volume" sortDirection="asc" />);
    expect(render).not.toThrow();
    expect(JSON.stringify(frozen)).toBe(before);
  });
});
