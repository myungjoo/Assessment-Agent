# 실데이터 규모 검증 dataset — nnstreamer + nntrainer 2026 PR 작성자

> 오너 지시(2026-07-30)로 준비한 **R-91 규모 검증용 실데이터 개발자 집합**.
> 기준: **github.com `nnstreamer` org + `nntrainer` org** 에서 **2026-01-01 이후 생성된 PR 을 1개 이상 작성한 고유 개발자**.
> 스냅샷: 2026-07-30 (gh search, rate limit 여유). 봇 미포함(전원 사람 계정 확인).

## ⚠️ 규모 주의 — 33명 (R-91 목표 100~200명 미달)

두 org 의 2026 PR 작성자는 **총 33명** 이다 (nnstreamer 5 + nntrainer 29, 중복 myungjoo 1). R-91(REQ-047)의 "100~200명" headcount 에는 못 미친다. 단 **활동량은 큼**(1인 최대 117 PR) — 평가 대상 *contribution 수* 기준으로는 상당한 부하다. headcount 100~200 을 채우려면 (a) org/기간 확대 또는 (b) 이 33명 기반 synthetic 증배가 필요 — 오너 결정 대기.

## Dataset (33명 · 2026 PR 수 내림차순)

| # | github login | nnstreamer | nntrainer | 2026 PR 합 |
|---:|---|---:|---:|---:|
| 1 | jijoongmoon | 0 | 117 | 117 |
| 2 | EunjuYang | 0 | 82 | 82 |
| 3 | myungjoo | 67 | 5 | 72 |
| 4 | jaemini-shin | 0 | 70 | 70 |
| 5 | baek2sm | 0 | 53 | 53 |
| 6 | Jungwon-Lee | 0 | 48 | 48 |
| 7 | Seunghui98 | 0 | 42 | 42 |
| 8 | jayden0701 | 0 | 37 | 37 |
| 9 | jaeyun-jung | 20 | 0 | 20 |
| 10 | dlwlzzero | 0 | 19 | 19 |
| 11 | junbong-yu | 0 | 17 | 17 |
| 12 | haehun | 0 | 13 | 13 |
| 13 | b-saianirud | 0 | 12 | 12 |
| 14 | niket-agarwal | 0 | 11 | 11 |
| 15 | lhs8928 | 0 | 11 | 11 |
| 16 | anyj0527 | 10 | 0 | 10 |
| 17 | sumon-98 | 0 | 8 | 8 |
| 18 | prachi-t17 | 0 | 7 | 7 |
| 19 | h0g1 | 0 | 7 | 7 |
| 20 | YongHyeon02 | 0 | 7 | 7 |
| 21 | pranjal-nntrainer | 0 | 6 | 6 |
| 22 | sachin-nntrainer | 0 | 5 | 5 |
| 23 | again4you | 5 | 0 | 5 |
| 24 | dkjung | 0 | 4 | 4 |
| 25 | anupSnap21530358 | 0 | 3 | 3 |
| 26 | ramees-t | 0 | 2 | 2 |
| 27 | jeewookp | 0 | 2 | 2 |
| 28 | ankit-mh | 0 | 2 | 2 |
| 29 | wooksong | 0 | 1 | 1 |
| 30 | songgot | 1 | 0 | 1 |
| 31 | pallaviNNT | 0 | 1 | 1 |
| 32 | KWSMooBang | 0 | 1 | 1 |
| 33 | DonghakPark | 0 | 1 | 1 |

## 재생성(refresh) 명령

```bash
gh search prs --owner nnstreamer --created 2026-01-01..2026-12-31 --limit 1000 --json author --jq '.[].author.login' | sort -u
gh search prs --owner nntrainer  --created 2026-01-01..2026-12-31 --limit 1000 --json author --jq '.[].author.login' | sort -u
```

## 사용 방식 (seed → 평가 → 규모검증)

1. 각 개발자를 **Person + github.com `ServiceIdentity`**(login=위 목록)로 seed (ADR-0006). primary key ID 는 github login (사내 confluence ID 부재이므로 github 기준).
2. `assessment-collection` 이 각 개발자의 **2026 public 활동**(commit/PR/issue, R-30 self-follow-up 제외) 수집.
3. 로컬 Ollama(또는 지정 LLM)로 평가 → 난이도/기여도/평가문 산출.
4. 이 집합을 **R-91 부하·규모 검증**(k6 harness, ADR-0054)의 실 데이터 표본으로 사용 — 단 headcount 부족 시 위 규모 주의 참조.

**raw 미저장(R-59)** — 이들의 원본 commit/문서는 저장 안 하고 평가 결과만 보관.
