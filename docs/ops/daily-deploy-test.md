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

## E. REALDATA_E2E gating env 셋업 (선택 — 실 LIVE-wiring 운영자 절차)

본 섹션은 [`deploy/daily-test.sh`](../../deploy/daily-test.sh) 의 **realdata-e2e live smoke leg**(eval / collect /
rediscovery / eval_chain)를 매일 02:00 재배포 테스트에서 실제로 돌리고 싶은 **운영자만** 수행하는 선택 셋업이다
(github issue #1013 LIVE-wiring). 셋업하지 않으면 아래 gating 이 부재로 판정돼 해당 leg 는 **조용히 SKIP** 되고,
A~D 의 기본 배포·health·auth 테스트는 그대로 동작한다 — 미셋업 배포에 마찰 0.

> **범위**: 본 셋업은 배포 기기(`/opt/assessment-agent`)에 파일 1 개(`.env.realdata`)를 두는 것뿐이다.
> daily-test.sh 나 env.prod.example 의 active 설정은 건드리지 않는다.

### E-1. gating env 7 종 (모두 present + non-blank 여야 leg 실행)

정본은 [`test/helpers/realdata-e2e-live-gating.ts`](../../test/helpers/realdata-e2e-live-gating.ts) 의
`REALDATA_E2E_REQUIRED_ENV` 이며, daily-test.sh 가 이름을 mirror 한다. 아래 7 종이 **하나라도 부재/빈/공백-only**
면 leg 전체가 조용히 SKIP 된다(부분 셋업 불가 — all-or-nothing).

| env 키 | 의미 |
| --- | --- |
| `REALDATA_E2E_LIVE_TEST` | live leg enable flag (예: `1`) — 이 값이 있어야 실 LLM/github 호출 leg 진입. |
| `REALDATA_E2E_LLM_BASE_URL` | OpenAI 호환 LLM endpoint base URL (예: 사내/LAN Ollama). |
| `REALDATA_E2E_LLM_API_KEY` | 위 LLM endpoint 의 API 키(로컬 Ollama 는 더미 값이면 충분). |
| `REALDATA_E2E_LLM_MODEL` | 사용할 모델 tag/id. |
| `REALDATA_E2E_LLM_PROVIDER` | provider 종류(`custom` / `openai` 등 OpenAI 호환 wire 포맷). |
| `REALDATA_E2E_LLM_API_VERSION` | LLM API 버전 문자열(provider 가 요구하는 경우). |
| `REALDATA_E2E_GITHUB_READ_PAT` | 실 github 수집을 위한 **읽기 전용** PAT. |

### E-2. 파일 위치 — `.env.realdata` (untracked, chmod 600)

위 7 종 + test-DB `DATABASE_URL` 은 배포 기기의 **`/opt/assessment-agent/.env.realdata`** 에 둔다 — **`.env` 가 아니다**.
이 파일은 git 에 추가하지 않는다(untracked 유지). 자격 노출 방지를 위해 `chmod 600` 으로 권한을 잠근다.

```bash
# 배포 기기에서 (deploy@192.168.0.7)
umask 077
cat > /opt/assessment-agent/.env.realdata <<'EOF'
REALDATA_E2E_LIVE_TEST=1
REALDATA_E2E_LLM_BASE_URL=<OpenAI_호환_endpoint_base_URL>
REALDATA_E2E_LLM_API_KEY=<LLM_API_키_또는_더미>
REALDATA_E2E_LLM_MODEL=<모델_tag>
REALDATA_E2E_LLM_PROVIDER=<custom_또는_openai>
REALDATA_E2E_LLM_API_VERSION=<API_버전_문자열>
REALDATA_E2E_GITHUB_READ_PAT=<읽기전용_github_PAT>
# ⚠️ 아래 test-DB 경고(E-4) 를 반드시 읽고 assessment_test 를 가리킬 것.
DATABASE_URL=postgresql://assessment_agent:<비밀번호>@postgres:5432/assessment_test?schema=public
EOF
chmod 600 /opt/assessment-agent/.env.realdata
```

daily-test.sh 의 `source_realdata_env`(issue #1013 slice C-1) 가 **gating 검사 이전 1 회 자동 source** 해
7 종 gating env + test-DB `DATABASE_URL` 을 자식 jest 프로세스로 상속시킨다 — 루틴이 SSH 로 매번 수동 source 하던
의존을 제거한다. 파일 경로는 `ENV_REALDATA_FILE` 로 override 할 수 있다(기본 `$REPO_DIR/.env.realdata`).

### E-3. gating 활성 시 자동 deps/schema 선행 (slice C-2)

gating 이 활성(7 종 모두 set)이면 daily-test.sh 의 `ensure_realdata_deps_and_schema`(issue #1013 slice C-2)가
첫 step 실행 이전 **`pnpm install --frozen-lockfile`** 로 node_modules 를 최신화하고
**`pnpm exec prisma migrate deploy`** 로 test-DB 스키마를 적용한다 — 루틴이 SSH 로 수동 수행하던 의존을 제거한다.
gating 부재면 이 선행은 no-op(install/migrate 미수행). 준비 실패 시 후속 eval-group step 이 자연 FAIL 로 신호한다.

### E-4. ⚠️ test-DB 강제 경고 — `DATABASE_URL` 은 반드시 `assessment_test`

`.env.realdata` 의 `DATABASE_URL` 은 **반드시 별도 test DB `assessment_test`** 를 가리켜야 한다.
jest smoke globalSetup([`test/helpers/jest-smoke-setup.ts`](../../test/helpers/jest-smoke-setup.ts))이 대상 DB 를
`truncateAll` 하므로, **운영 DB(`assessment_agent`)를 지정하면 매일 02:00 운영 DB 가 통째로 지워진다**.
반드시 DB 이름 세그먼트를 `.../assessment_test?schema=public` 로 두고, 운영 DB 와 물리적으로 분리된 스키마인지
셋업 직후 1 회 확인한다.

### E-5. gating 부재 시 동작 (기본값 — 조용한 SKIP)

`.env.realdata` 가 없거나 7 종 중 하나라도 부재/빈 값이면 `realdata_eval_gating_enabled` 가 disabled 로 판정하고
live leg 를 **조용히 SKIP** 한다(실 credential 값은 로그에 절대 echo 하지 않고, 부재 시 env **이름** 만 진단 로그).
A~D 의 기본 배포·health·liveness·auth 테스트는 gating 과 무관하게 항상 수행된다. cloud CI / 일반 LAN 배포에서는
이 파일이 없으므로 자동으로 SKIP 경로를 탄다.

> **§9 준수**: `.env.realdata` 의 실 PAT / LLM endpoint / DB 자격은 git·로그·JSON·journal·PR 어디에도 남기지
> 않는다. 본 문서와 [`deploy/env.prod.example`](../../deploy/env.prod.example) 의 참조 블록은 `<...>` placeholder 만 담는다.

## F. 앱 컨테이너 LIVE GitHub collection 셋업 (선택 — 실 GitHub 수집 운영자 절차)

본 섹션은 **§E 와 별개 경로**다 — §E 는 `daily-test.sh` 의 smoke live-leg(호스트측 평문 `REALDATA_E2E_GITHUB_READ_PAT` 소비)를
켜지만, 본 §F 는 **앱 컨테이너 런타임**의 `GithubModule` 이 실 GitHub 활동을 수집하는 경로
(`resolveGithubInstances` → `decryptGithubInstanceConfigToken` → `GithubInstanceClient` → `GithubCollectionSpecService`)를
운영자가 켤 수 있게 하는 선택 셋업이다(github issue #1013 LIVE-wiring C-4). 수집 코드 경로는 이미 main 에 shipped 되어
있으며, 본 셋업은 그것을 **활성화하는 운영 env 주입 절차**만 설명한다. 셋업하지 않으면 활성 instance 0 으로 판정돼
수집은 no-op 이고, A~E 의 기본 배포·테스트는 그대로 동작한다 — 미셋업 배포에 마찰 0.

> **범위**: 본 셋업은 앱 컨테이너에 env 를 주입하는 것뿐이다. `daily-test.sh` 나 `src/github/*` 수집 코드는 건드리지 않는다.
> 정본 env 이름 규약은 [`src/github/github-instance-config.ts`](../../src/github/github-instance-config.ts) 의 상수를 따른다.

### F-1. 활성화 env (github.com public 1 instance 예)

`GITHUB_INSTANCES` 가 **활성 instance key 의 comma/space-separated 목록**이다 — 여기 열거된 key 만 활성이며(자동 발견 안 함),
각 key 마다 접두 변수 `GITHUB_<KEY 대문자>_HOST` / `_ORG` / `_REPOS` / `_TOKEN_ENC` 를 읽는다. 아래는 `public` 이라는 key 로
github.com 의 `myungjoo` / `leemgs` 공개 활동을 수집하게 하는 예다.

| env 키 | 필수 | 의미 |
| --- | --- | --- |
| `GITHUB_INSTANCES=public` | ✅ | 활성 instance key 목록(예: `public`). 여기 열거된 key 만 활성. |
| `GITHUB_PUBLIC_HOST=github.com` | ✅ | 해당 instance 의 base host. **부재 시 그 instance reject**(수집 no-op). |
| `GITHUB_PUBLIC_ORG=myungjoo,leemgs` | 선택 | 수집 대상 org(s). comma-separated. 부재 시 빈 배열(reject 사유 아님). |
| `GITHUB_PUBLIC_REPOS=<org/repo_목록>` | 선택 | 지정 repo allowlist(comma/space). 미설정 시 org 전체 enumerate. |
| `GITHUB_PUBLIC_TOKEN_ENC=<암호문>` | ✅ | read-scope PAT 의 **AES-256-GCM 암호문**(평문 아님). **부재 시 그 instance reject**. |

### F-2. `_TOKEN_ENC` 암호문 생성 절차

`GITHUB_PUBLIC_TOKEN_ENC` 에는 평문 PAT 를 그대로 넣지 않는다 — [`scripts/encrypt-token.ts`](../../scripts/encrypt-token.ts)
로 read-scope PAT 를 암호화한 **envelope 문자열**을 넣는다. `LLM_APIKEY_ENC_KEY`(32-byte base64/hex 키, [`deploy/env.prod.example`](../../deploy/env.prod.example)
참조)를 먼저 세팅한 뒤 아래처럼 실행한다.

```bash
# 배포 기기에서 — 평문 PAT 는 stdin 파이프로만 전달(argv·history 노출 최소화)
read -rs GITHUB_PAT   # 평문 read-scope PAT 를 변수로 입력(화면·shell history 노출 없음)
printf %s "$GITHUB_PAT" \
  | LLM_APIKEY_ENC_KEY=<32byte_base64_또는_hex_키> pnpm ts-node scripts/encrypt-token.ts
unset GITHUB_PAT      # 평문 PAT 를 셸 환경에서 즉시 제거
# 출력된 암호문 한 줄을 GITHUB_PUBLIC_TOKEN_ENC 에 주입한다.
```

> **§9 준수**: 평문 PAT / `LLM_APIKEY_ENC_KEY` / 생성된 암호문 실값은 git·journal·PR·로그 어디에도 커밋하지 않는다 —
> env / 컨테이너 주입으로만 전달한다. 본 문서와 [`deploy/env.prod.example`](../../deploy/env.prod.example) 의 참조 블록은
> `<...>` placeholder 만 담는다.

### F-3. `_HOST` / `_TOKEN_ENC` 부재 시 동작 — 조용한 reject

`resolveGithubInstances`(정본 [`src/github/github-instance-config.ts`](../../src/github/github-instance-config.ts))는 각 key 의
**필수 변수(`_HOST`·`_TOKEN_ENC`) 가 부재/빈/공백-only 면 그 instance 를 조용히 reject**한다(평문/빈 fallback 금지, fail-fast).
reject 시 수집은 no-op 이고, 어느 env 가 부재했는지 **이름만** 진단 로그에 남는다(실값 echo 0, §9). `_ORG` / `_REPOS` 는
선택이라 부재해도 reject 사유가 아니다. `GITHUB_INSTANCES` 자체가 부재/빈이면 활성 instance 0 으로 정상 판정(수집 미설정 분기).
