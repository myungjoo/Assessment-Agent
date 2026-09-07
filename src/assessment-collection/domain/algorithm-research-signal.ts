// algorithm-research-signal — "새 알고리즘 설계 · 새 일거리 구상 · 외부 연구 소개"
// 기여(README `38 행` R-38)를 title 문자열만으로 결정적으로 식별하는 **순수 helper**
// (ADR-0064 § Decision 1 · § Decision 2, § Follow-ups (a)). 부수효과 0 / I/O 0 /
// import 0 이라 **새 외부 dependency 0** 이다(commit-content-fingerprint.ts 선례 동형).
//
// 본 파일은 판별 규칙만 책임진다 — raw shape parse 는 소비처인 mapper 가 하고
// (§ Decision 1 "mapper 는 helper 를 호출만 한다"), 임계 비교 · 등급 상향은 평가 layer
// (§ Follow-ups (b) · (c))의 책임이다. 반환값은 title 문자열이 아니라 **매칭된 marker
// 그룹 수(정수)** 라 `titleLength` 와 같은 계열의 파생 typed 보조값이며 원문 복원이
// 불가능하다 — REQ-032 raw 미저장 불변을 넓히지 않는다(§ Decision 5).

// ALGORITHM_RESEARCH_MIN_HITS — 평가 layer 가 R-38 상향 대상으로 인정하는 하한
// (ADR-0064 § Decision 2). 값 2 는 "형식 축(C) 필수 ∧ 주제 축(A|B) 1+" 를 뜻한다.
// 본 helper 는 임계를 **비교하지 않고** 산출값만 돌려준다 — 수집 layer 를 사실
// 수집기로, 평가 layer 를 판정자로 남기기 위한 경계 분리다.
export const ALGORITHM_RESEARCH_MIN_HITS = 2;

// 그룹 (A) 주제 · 알고리즘 — 새 알고리즘 · 설계안 축 어휘(ADR-0064 § Decision 2).
// 매칭은 소문자 기준 부분 문자열이므로 상수도 소문자로만 적는다.
export const ALGORITHM_RESEARCH_ALGORITHM_MARKERS = [
  "algorithm",
  "알고리즘",
  "heuristic",
  "설계안",
] as const;

// 그룹 (B) 주제 · 외부 연구 — 외부 연구 도입 축 어휘.
export const ALGORITHM_RESEARCH_RESEARCH_MARKERS = [
  "research",
  "연구",
  "arxiv",
  "paper",
  "논문",
  "sota",
] as const;

// 그룹 (C) 형식 · 소개 — "타 개발자들이 참고할 수 있도록 소개 자료를 정리" 하는 산출물
// 형식 어휘. R-38 문언상 **필수 조건** 이라, (C) 가 없으면 주제어가 몇 개든 0 이다
// (주제어만 스친 회의록 · 진행 로그 배제 — ADR-0064 § Decision 2 보수 임계).
export const ALGORITHM_RESEARCH_FORMAT_MARKERS = [
  "소개",
  "도입",
  "정리",
  "introduction",
  "survey",
  "tutorial",
] as const;

// matchesGroup — 소문자 정규화된 title 이 한 그룹의 marker 중 **하나라도** 포함하는지
// 판정한다. 같은 그룹 안에서 여러 marker 가 맞아도 중복 가산하지 않는다(그룹 단위 1).
function matchesGroup(lowered: string, markers: readonly string[]): boolean {
  return markers.some((marker) => lowered.includes(marker));
}

// computeAlgorithmResearchHits — title 에서 매칭된 marker **그룹 수**(0~3 정수)를
// 돌려준다. 규칙은 ADR-0064 § Decision 2 그대로다.
//
// - 비-string 입력(mapper 가 raw `unknown` 을 주므로 방어적으로 흡수) → `0`, **throw
//   하지 않는다**. 한 malformed page 가 전체 수집을 깨지 않도록 하는 mapper 계약 승계.
// - (C) 형식 축 미매칭 → 항상 `0`(주제 축이 맞아도 마찬가지).
// - (C) 매칭 → 1, 여기에 (A) · (B) 매칭마다 +1 이라 최대 3.
//
// 즉 반환값이 `ALGORITHM_RESEARCH_MIN_HITS` 이상이 되려면 (C) + (A|B) 가 필요하다.
export function computeAlgorithmResearchHits(title: unknown): number {
  if (typeof title !== "string") {
    return 0;
  }
  const lowered = title.toLowerCase();
  // (C) 는 필수 조건 — 미매칭이면 주제 축 평가 자체를 생략한다.
  if (!matchesGroup(lowered, ALGORITHM_RESEARCH_FORMAT_MARKERS)) {
    return 0;
  }
  let hits = 1;
  if (matchesGroup(lowered, ALGORITHM_RESEARCH_ALGORITHM_MARKERS)) {
    hits += 1;
  }
  if (matchesGroup(lowered, ALGORITHM_RESEARCH_RESEARCH_MARKERS)) {
    hits += 1;
  }
  return hits;
}
