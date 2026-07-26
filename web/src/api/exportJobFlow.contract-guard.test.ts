import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import { SUCCEEDED_STATUS, FAILED_STATUS } from './exportJobFlow';

// web↔backend drift-guard (T-1244) — exportJobFlow.ts 의 web-local 종결 상수
// (SUCCEEDED_STATUS/FAILED_STATUS) 가 backend 권위 소스 prisma/schema.prisma 의
// `enum JobStatus` 와 정확히 일치하는지 CI 에서 기계 검증하는 회귀 앵커다.
// web/backend 는 별도 빌드라 타입 링크가 없어(빌드·기존 unit test 로는 drift 미검출),
// enum rename/추가/삭제 또는 web 상수 오타 시 poll loop 가 성공 job 을 종결로 인식하지
// 못해 timeout 하는 조용한 실사용 버그가 된다. 본 spec 은 그 drift 를 fail 로 강제한다.
// import 금지(web/backend 별도 빌드) — schema 는 fs 로 test 시점에 읽어 텍스트 파싱한다.

// prisma/schema.prisma 텍스트를 저장소 루트 기준으로 읽는다. import.meta.url 기준 상대
// 해석이라 CI·로컬 어느 cwd 에서도 안정(web/src/api → ../../../ = repo root).
const SCHEMA_SOURCE = readFileSync(
  new URL('../../../prisma/schema.prisma', import.meta.url),
  'utf8',
);

// spec-local 소형 enum 파서 — 공용 contract-extractors 오염 금지(Out of Scope). schema 의
// `enum JobStatus { ... }` 블록만 슬라이스해 멤버 토큰 집합을 파싱한다. 블록 미매칭 시
// 빈 집합을 반환하며(false-green 은 소비 측 별도 단언으로 방어), 주석/공백은 걸러낸다.
function parseJobStatusMembers(schema: string): Set<string> {
  const block = /enum\s+JobStatus\s*\{([\s\S]*?)\}/.exec(schema);
  if (!block) {
    return new Set();
  }
  const members = block[1]
    .split('\n')
    .map((line) => line.replace(/\/\/.*$/, '').trim()) // 줄 주석 제거 후 trim
    .filter((line) => /^[A-Z][A-Z0-9_]*$/.test(line)); // 대문자 enum 토큰만
  return new Set(members);
}

const jobStatusMembers = parseJobStatusMembers(SCHEMA_SOURCE);

// web 규약 — 이 둘의 합집합이 종결(isTerminal), 나머지가 진행중.
const webTerminalTokens = new Set([SUCCEEDED_STATUS, FAILED_STATUS]);

describe('exportJobFlow terminal-token drift-guard (web ↔ prisma JobStatus)', () => {
  // 파싱 견고성 (a)(b) — 파서가 빈 집합/부분 파싱을 "모두 일치" 로 오판하지 않도록 선단언.
  // 빈 enum 을 false-green 으로 통과시키는 것을 차단하고, 최소 4 멤버 경계값을 방어한다.
  it('JobStatus enum 을 비어있지 않게 파싱하고 최소 4개 멤버를 포함한다 (파싱 견고성)', () => {
    expect(jobStatusMembers.size).toBeGreaterThan(0);
    expect(jobStatusMembers.size).toBeGreaterThanOrEqual(4);
  });

  // Happy-path(멤버십) — web 종결 상수 각각이 backend enum 에 실재하는 토큰임(오타/rename drift 차단).
  it('SUCCEEDED_STATUS·FAILED_STATUS 가 각각 JobStatus enum 멤버 집합에 포함된다 (멤버십)', () => {
    expect(jobStatusMembers.has(SUCCEEDED_STATUS)).toBe(true);
    expect(jobStatusMembers.has(FAILED_STATUS)).toBe(true);
  });

  // 종결/비종결 분할 일치 — web 종결 집합이 enum 에서 정확히 {SUCCEEDED,FAILED} 와 일치하고,
  // 나머지 비종결이 정확히 {PENDING,RUNNING} 임을 순서 무관 집합 비교로 검증. enum 에 새 멤버
  // (예: CANCELLED) 추가 시 이 단언이 fail 해 web 종결 규약 재검토를 강제한다.
  it('web 종결 집합이 enum 에서 정확히 {SUCCEEDED,FAILED}, 비종결이 {PENDING,RUNNING} 로 분할된다 (분할 일치)', () => {
    const terminal = [...jobStatusMembers].filter((m) => webTerminalTokens.has(m)).sort();
    const nonTerminal = [...jobStatusMembers].filter((m) => !webTerminalTokens.has(m)).sort();
    expect(terminal).toEqual(['FAILED', 'SUCCEEDED']);
    expect(nonTerminal).toEqual(['PENDING', 'RUNNING']);
  });

  // negative (c) — 두 종결 토큰이 서로 다른 값임(상수 중복 붙여넣기 오류 방지).
  it('SUCCEEDED_STATUS 와 FAILED_STATUS 는 서로 다른 값이다 (상수 중복 방지)', () => {
    expect(SUCCEEDED_STATUS).not.toBe(FAILED_STATUS);
  });
});
