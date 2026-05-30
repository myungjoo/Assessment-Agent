# reviewRounds Archive — STATE.json hot-read 외화 (T-0105)

이 문서는 `docs/STATE.json` 의 hot-read 부하를 줄이기 위해 **reviewRounds** block 을 외화한 durable audit trail 이다. driver / planner / cron 이 매 turn STATE.json 을 재로드하므로 (CLAUDE.md §2 step 1), 이미 DONE 된 task 들의 과거 reviewer round 수는 진행 중 의사결정에 쓰이지 않아 hot-read 가치가 0 이다 — 본 archive 로 1:1 이전하고 STATE.json 에는 빈 객체 + 포인터만 남긴다.

- **원본 source**: `docs/STATE.json` 의 `reviewRounds` 객체
- **archive 시점**: 2026-05-30
- **archive 주체 task**: T-0105
- **이전 항목 수**: 68 entry (`T-NNNN`: reviewer round 수)
- **정보 보존 원칙**: 각 task ID 와 round 수를 정보 손실 0 으로 보존 (아래 표, STATE.json 기존 순서 그대로 — 재정렬 0). STATE.json 에는 `reviewRounds: {}` + `reviewRoundsArchive` 포인터 + `reviewRoundsArchivedCount: 68` 만 남는다.
- **패턴**: T-0104 (humanQuestions externalize) 에 이은 2 회차 reactive externalize. 향후 신규 task round 수는 다시 STATE.json `reviewRounds` 에 쌓이고 누적 시 본 archive 로 재이전 (자동 archive 메커니즘은 T-0105 Follow-ups 의 ADR 후보). 포맷은 compact markdown 표 — T-0104 의 JSON-fenced ×3.9 verbosity inflation 회피.

---

| task | rounds |
| --- | --- |
| T-0005 | 1 |
| T-0007 | 1 |
| T-0015 | 2 |
| T-0016 | 1 |
| T-0017 | 2 |
| T-0018 | 1 |
| T-0019 | 1 |
| T-0020 | 1 |
| T-0021 | 1 |
| T-0022 | 1 |
| T-0023 | 1 |
| T-0024 | 1 |
| T-0025 | 1 |
| T-0026 | 1 |
| T-0027 | 1 |
| T-0028 | 1 |
| T-0029 | 1 |
| T-0030 | 2 |
| T-0031 | 1 |
| T-0032 | 3 |
| T-0033 | 1 |
| T-0034 | 1 |
| T-0035 | 1 |
| T-0036 | 2 |
| T-0037 | 1 |
| T-0039 | 1 |
| T-0041 | 1 |
| T-0042 | 1 |
| T-0043 | 1 |
| T-0044 | 1 |
| T-0046 | 1 |
| T-0047 | 1 |
| T-0049 | 1 |
| T-0050 | 1 |
| T-0051 | 1 |
| T-0052 | 1 |
| T-0053 | 1 |
| T-0054 | 1 |
| T-0055 | 2 |
| T-0056 | 1 |
| T-0057 | 2 |
| T-0059 | 2 |
| T-0060 | 1 |
| T-0061 | 1 |
| T-0062 | 1 |
| T-0066 | 1 |
| T-0067 | 1 |
| T-0068 | 1 |
| T-0069 | 1 |
| T-0070 | 0 |
| T-0071 | 1 |
| T-0072 | 1 |
| T-0075 | 1 |
| T-0079 | 1 |
| T-0080 | 1 |
| T-0081 | 1 |
| T-0082 | 1 |
| T-0083 | 1 |
| T-0085 | 1 |
| T-0086 | 1 |
| T-0087 | 1 |
| T-0099 | 1 |
| T-0101 | 1 |
| T-0090 | 1 |
| T-0091 | 1 |
| T-0092 | 1 |
| T-0094 | 1 |
| T-0095 | 1 |
