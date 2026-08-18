---
id: T-1588
title: acquire-lock.sh holder 인자 allowlist 검증 + 오인자 negative 회귀 가드
phase: P5
status: DONE
commitMode: pr
coversReq: [REQ-057, REQ-058]
estimatedDiff: 140
estimatedFiles: 2
created: 2026-08-18
createdAt: 2026-08-18T00:02:00Z
completedAt: 2026-08-18T00:19:03Z
independentStream: driver-lock-primitive
dependsOn: []
touchesFiles:
  - scripts/acquire-lock.sh
  - scripts/acquire-lock.test.sh
plannerNote: "P5 운영 안정화 — 2026-08-17 22:41 fire 실사고(`--release` 가 holder 로 해석돼 무효 lock 6분 박힘) 표면을 allowlist 검증 + negative test 로 봉합"
---

# T-1588 — `acquire-lock.sh` holder 인자 allowlist 검증 + 오인자 negative 회귀 가드

## Why

2026-08-17 22:41 fire 에서 driver 가 lock 해제를 `scripts/acquire-lock.sh --release cron <session>` 로
잘못 호출했다. 스크립트 계약은 `$1=release` 인데 `--release` 는 `release` 와 문자열이 달라 **acquire
경로**를 탔고, lock ref tip 에 `{"holder":"--release","session":"cron",...}` 라는 **무효 lock 이 약 6 분간
박혔다**(journal 2026-08-17 22:47 addendum). 곧바로 `acquire-lock.sh release` 재호출로 tombstone 복구했고
`claims.json` 보존·claim 손실 0·dup-PR 0 이라 사고 등급은 아니었지만, 원인은 **스크립트가 holder 인자를
`loop|cron|human` allowlist 로 전혀 검증하지 않는다**는 점 하나다(`scripts/acquire-lock.sh` 49~65 행 —
`release` 아니면 무조건 acquire, 빈 문자열만 거른다).

본 task 는 그 표면을 봉합한다. ADR-0056 `§Follow-ups (b)` 확산(perf-spec 배선) 슬라이스보다 이쪽을 먼저
고른 이유: (1) 실제로 사고를 낸 표면이고 오타 한 번이면 **언제든 재발**하는 반면 (b) 확산은 잔여 표면이
50 개 남은 균질 반복이라 순서 손실이 없다, (2) lock primitive 는 stage 5b 동시성(ADR-0036)의 신뢰 기반이라
"조용히 유효해 보이는 무효 lock" 이 남으면 다른 fire 의 held 오판·stale TTL 계산을 오염시킨다,
(3) 2 파일 · CI 기존 leg(`ci.yml` 119 행 `bash scripts/acquire-lock.test.sh`) 안에서 완결돼 cap 이 넉넉하다.

## Required Reading

- `scripts/acquire-lock.sh` — 본 task 가 고치는 스크립트(109 행).
  - 29~35 행: 계약 주석. `$1=holder(loop|cron|human)` / `$1=release` / `exit 2 = 인자 오류` 가 **이미
    문서상 allowlist** 다 — 본 task 는 문서와 코드의 간극을 없애는 것이지 계약을 바꾸는 게 아니다.
  - 49~65 행: `MODE`/`HOLDER`/`SESSION` 결정 블록. 현재 `HOLDER = "release"` 만 분기하고, 그 외에는
    빈 문자열 검사(56 행 `exit 2`) + session 부재 검사(61 행 `exit 2`) 뿐이다. **검증을 넣을 자리.**
  - 67~74 행 `lock_blob_body()` / 76~95 행 `attempt()` / 97~109 행 재시도 루프 — 본 task 는 이 아래를
    건드리지 않는다(검증은 네트워크 접촉 **전에** 끝나야 한다).
- `scripts/acquire-lock.test.sh` — executable spec(272 행). 다음을 그대로 따를 것:
  - 12~21 행: 헤더의 **분기-검증 매핑 표**(`B1`~`B7` ↔ `[T1]`~`[T9]`). 새 분기를 넣으면 이 표에 `B8`
    행을 추가해야 한다(문서-테스트 정합이 본 파일의 관례).
  - 24~69 행: 하네스 — bare repo + clone 2 개, `run_acquire <clone> <args...>`(40~45 행),
    `tip_holder()`(48~57 행, tombstone 을 빈 문자열로 정규화), `tip_claims_raw()`, `cur_tip()`.
  - 71~95 행 `[T1]`/`[T2]`: happy 선례(holder `cron`·`loop` 획득). 132~150 행 `[T5]`: **ref tip 불변**
    단언 관용구. 225~258 행 `[T9]`: stderr 를 `ERR9="$( ( ... ) 2>&1 >/dev/null )"` 로 잡아
    `grep -qF` 로 사유를 확인하는 관용구 — 새 negative case 도 이 형태를 재사용한다.
  - 264~272 행: 말미 요약 문자열(`T1 first-create / ... / T9 재시도소진`). 새 case 를 추가하면 이
    나열도 함께 갱신한다.
- `.github/workflows/ci.yml` 115~123 행 — 본 spec 이 이미 CI leg 로 돌고 있음을 확인만 할 것.
  **`ci.yml` 및 `deploy/daily-test.sh` 는 수정 금지**(새 leg 를 만들면 drift-guard smoke 3 개까지
  같은 commit 에 끌려와 파일 cap 이 깨진다 — T-1122 전례).
- `docs/LOOP.md` 28 행 · 494 행 · 502 행 — 호출 관례(`<holder> <session>` 획득 / bare `release` 해제).
  문서가 이미 정확하므로 **doc 수정 불요**.

## Acceptance Criteria

- [ ] `scripts/acquire-lock.sh` 의 acquire 경로에서 `$1`(holder) 을 **`loop|cron|human` allowlist 로
      검증**한다. 검증은 49~65 행 블록 안, 즉 `git fetch`/`ls-remote` 등 **원격 접촉 이전**에 수행하고,
      불일치 시 stderr 에 (a) 문제의 입력값과 (b) 허용값 열거, (c) "해제는 `--release` 가 아니라 bare
      `release`" 힌트를 담아 **`exit 2`**(기존 인자-오류 코드 그대로) 로 종료한다. 대소문자 관대 매칭
      금지 — `Cron` 은 거부한다.
- [ ] happy path — allowlist 3 값 전부가 정상 동작한다. 기존 `[T1]`(`cron`)·`[T2]`(`loop`) 에 더해
      **`human` 획득 case 를 신규 추가**해 `exit 0` + `tip_holder` == `human` 을 단언하고,
      bare `release` 해제 경로(`[T7]`)가 **무회귀**임을 확인한다.
- [ ] error path — 잘못된 holder 로 호출하면 `exit 2` 이고 stderr 에 허용값 열거가 나오며, **lock ref
      tip 이 호출 전후 byte 동일**(부분 반영 0, `claims.json` 도 불변)임을 `[T5]` 의 tip 불변 관용구로
      단언한다. session 인자를 함께 줘도(= 사고 당시 호출 형태) acquire 가 성립하지 않아야 한다.
- [ ] 분기 cover — 새 분기 `B8`(allowlist 통과 ↔ 거부) 양쪽에 case 1+ 가 있고, `scripts/acquire-lock.test.sh`
      헤더 12~21 행의 분기-검증 매핑 표에 `B8` 행이 추가되며, 말미 요약 문자열(264~272 행)에도 신규
      case 이름이 반영된다. 기존 `B1`~`B7` 매핑 행은 불변.
- [ ] negative 충분 cover — 다음 각각에 case 1+:
      (1) **회귀 가드** `--release <session>` — 실사고 재현. `exit 2` + ref tip 불변(수정 전 코드에서는
      holder `--release` 로 lock 이 박혀 FAIL 해야 한다),
      (2) 오타 holder `croon`,
      (3) 대소문자 변형 `Cron`,
      (4) holder 인자 자체 누락(빈 인자) → `exit 2`,
      (5) holder 는 유효하나 session 누락 → `exit 2`(기존 61 행 동작 무회귀).
- [ ] `bash scripts/acquire-lock.test.sh` 가 로컬·CI 모두에서 exit 0 (기존 `[T1]`~`[T9]` 전부 통과 유지).
- [ ] `pnpm lint && pnpm build` 통과.
- [ ] `pnpm test` 통과(무회귀) + `pnpm test:cov` 통과(line ≥ 80% / function ≥ 80%).

## Out of Scope

- `select-claim.sh` · `reclaim-stale-claim.sh` · `sync-claim-pr.sh` · `lib-lock-tree.sh` 의 인자 검증
  강화 — 같은 결의 표면이지만 본 task 는 사고를 낸 `acquire-lock.sh` 하나만 봉합한다(Follow-ups 로).
- `.github/workflows/ci.yml` · `deploy/daily-test.sh` 수정, 새 CI leg 추가(기존 leg 가 이미 본 spec 을
  실행한다 — 건드리면 drift-guard smoke 3 개가 딸려와 파일 cap 초과).
- `docs/LOOP.md` · `docs/decisions/ADR-0009*` · `ADR-0028` · `ADR-0036` 본문 수정 — 계약 변경이 아니라
  기존 문서 계약의 집행이므로 doc sync 불요.
- holder allowlist 자체의 확장/축소(예: 새 holder 종류 추가), session 문자열 형식 검증,
  `since` ISO 형식 검증 — 별도 결정 사항.
- ADR-0056 `§Follow-ups (b)` perf-spec 배선 확산 — 본 task 와 독립 스트림. 다음 slice 로 계속.
- ADR-0056 `§Follow-ups (a)` 체크인 baseline JSON 최초 생성 — 실측 + 사람 눈 확인 전제라 자율 fire 범위 밖.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(비어 있음 — sub-agent 가 관련 작업을 발견하면 여기에 추가)

## 완료 기록

- **Status: DONE** (2026-08-18T00:19:03Z, PR [#1268](https://github.com/myungjoo/Assessment-Agent/pull/1268) squash merge `1f95ae3c`)
- 결과: `scripts/acquire-lock.sh` + `scripts/acquire-lock.test.sh` 2 파일 `+94/-6`. acquire 경로의
  empty 검사 직후 `case` 정확매칭 allowlist(`loop|cron|human`) 를 추가해 불일치 시 입력값 · 허용값 ·
  bare `release` 힌트 3 종을 stderr 로 내고 `exit 2`. 검증이 **원격 접촉(fetch / ls-remote) 이전**이라
  무효 holder 의 부분 반영 0. release 경로 · env · exit 0/1/2 계약 불변.
- 검증: `scripts/acquire-lock.test.sh` T1~T11 exit 0 (ok 23 건, 분기 B8 양측 cover) + 수정 전 코드에서
  `[T11]` 이 실제로 FAIL 함을 확인(장식 test 아님). `pnpm lint` · `build` · `test` · `test:cov`
  (437 suite / 12506 test, line · function ≥ 80%) green.
- review: reviewer VERDICT=APPROVE (round 2). Nit 은 같은 PR 안에서 종결(CLAUDE.md §3 Nit-in-PR closure).
- 본 task 는 LOOP.md `§7.5` multi-task chain 의 두 번째 task — commit footer 에
  `FIRE-BATCH: T-1587+T-1588` marker 박제.
