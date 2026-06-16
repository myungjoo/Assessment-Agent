# 플레이북 — 일일 Docker 배포·자동 테스트 (LAN Pi5, 192.168.0.7)

본 문서는 **로컬 PC 의 Claude Desktop 로컬 루틴**(Daily 02:00)이 매 fire 마다 **그대로 실행**하는
플레이북이다. 설계 근거는 [ADR-0043](../decisions/ADR-0043-daily-deploy-test.md). 루틴 프롬프트는
얇게 유지하고(아래 "루틴 등록"), 실제 절차는 본 문서가 단일 source of truth 다.

> **범위 한정**: 루틴은 본 플레이북의 A~C 만 수행한다. PLAN task 진행·코드 수정·다른 작업을 하지
> 않는다. **driver lock 도 잡지 않는다**(기기 검증 + 단일 이슈 관리뿐).

## 전제 (이미 갖춰짐)

- 로컬 PC → 기기 무비번 SSH: `deploy@192.168.0.7` (포트 22).
- 배포 체크아웃: 기기 `/opt/assessment-agent` (origin/main mirror).
- `gh` 인증됨, 대상 repo `myungjoo/Assessment-Agent`.
- 로컬 메인 체크아웃: `C:\Users\myung\Assessment-Agent`.

## A. 원격 배포 + 테스트 실행

기기에서 [`deploy/daily-test.sh`](../../deploy/daily-test.sh) 를 1 회 실행한다(스크립트가
redeploy → health → liveness → auth 를 모두 수행). stdout 마지막 줄이 JSON 요약이다.

```bash
ssh -o BatchMode=yes -o ConnectTimeout=15 deploy@192.168.0.7 \
  "cd /opt/assessment-agent && bash deploy/daily-test.sh"
```

- **exit code 와 stdout JSON 을 모두 수집**한다.
- **SSH 자체 실패**(기기 down·네트워크 단절·비-zero ssh exit 으로 JSON 없음)도 **FAIL** 로 간주한다
  (`result=FAIL`, `failedStep=ssh-unreachable` 로 취급).
- JSON 예: `{"ts":"...","gitSha":"...","result":"PASS|FAIL","failedStep":...,"steps":{...},"logPath":"..."}`.
- 실패 시 로그 tail 을 함께 가져온다(이슈 body 용):

```bash
ssh -o BatchMode=yes deploy@192.168.0.7 "tail -n 40 <logPath>"   # <logPath> = JSON 의 logPath
```

## B. 결과 판정

- stdout 마지막 JSON 을 파싱해 `result` 를 읽는다. JSON 파싱 실패 또는 ssh 실패 → `result=FAIL`.

## C. 단일 GitHub issue 보고 (상태 토글, 누적 0)

label `daily-test` 이슈를 **open/closed 통틀어 항상 ≤1 개** 재사용한다.

1. **label 보장**(없으면 생성):

```bash
gh label create daily-test --repo myungjoo/Assessment-Agent \
  --color 0E8A16 --description "일일 배포·자동 테스트 상태" 2>/dev/null || true
```

2. **canonical 이슈 조회**(가장 최근 1 개, open/closed 무관):

```bash
gh issue list --repo myungjoo/Assessment-Agent --label daily-test \
  --state all --limit 1 --json number,state,title
```

3. **body 파일 작성** — `--body-file` 로 전달한다(이 머신은 `--body @-` stdin 누락 — `env_gh_body_file`).
   제목: `[daily-test] 일일 배포·자동 테스트 상태`. body 구성:
   - 상태 한 줄: `최근 실행: <PASS✅|FAIL❌> · <ts> · main@<gitSha>`
   - 상태표(date · result · failedStep · 각 step 상태)
   - **FAIL 일 때만**: 로그 tail(```` ``` ```` 블록, ~40줄) + 기기 전체 로그 경로(`logPath`).

4. **분기**:
   - **result == PASS**:
     - 열린 이슈가 있으면 → `gh issue edit <num> --body-file <f>` 로 ✅ 최신화 후
       `gh issue close <num> --reason completed`.
     - 열린 이슈가 없으면 → **아무것도 하지 않는다**(green 에 noise 0).
   - **result == FAIL**:
     - 이슈가 있으면 → `gh issue edit <num> --body-file <f>`, 그 이슈가 closed 면
       `gh issue reopen <num>`.
     - 이슈가 없으면 → `gh issue create --repo myungjoo/Assessment-Agent --label daily-test
       --title "[daily-test] 일일 배포·자동 테스트 상태" --body-file <f>`.
   - 결과적으로 이슈는 **항상 ≤1 개**(open 또는 closed). 수주 방치돼도 누적되지 않는다.

> **gh 견고성**: `gh` 가 간헐적으로 토큰 없이 호출돼 401 날 수 있다(`env_gh_intermittent_401`).
> 각 `gh` 호출은 3~5 회 retry 로 감싼다.

## D. 보고만 — 자동 수정 PR 없음

실패해도 **수정 PR 을 열지 않는다**([ADR-0043](../decisions/ADR-0043-daily-deploy-test.md) §3).
이슈 body 에 사람이 읽을 진단(어느 step 이 왜 실패, 로그 tail)만 남긴다. 수정 판단은 사람/driver 몫.

## 루틴 등록 (로컬 PC, 1 회)

Claude Desktop → **Routines → New routine → Local**:

- **Schedule**: Daily **02:00** (로컬 타임존).
- **Working directory**: `C:\Users\myung\Assessment-Agent` (메인 체크아웃).
- **Prompt**(얇게):

  > `C:\Users\myung\Assessment-Agent` 체크아웃에서 `git fetch` 후
  > `docs/ops/daily-deploy-test.md` 플레이북을 그대로 실행하라. 플레이북 범위 밖의 다른 작업은
  > 하지 마라.

- **주의**: 02:00 에 로컬 PC 가 **켜져 있고 깨어 있어야** 한다(Settings → Keep computer awake).
  기기 systemd 타이머는 **설치하지 않는다**(이중 재배포 방지 — [ADR-0043](../decisions/ADR-0043-daily-deploy-test.md) §5).
