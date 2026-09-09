# 운영 런북 — 배포·복구·trouble-shoot

본 문서는 운영자가 **장애 시 따라갈 step-by-step 실행 플레이북**이다. 아키텍처-level
서술(운영 토폴로지·migration 정책·secret 주입 방식·scheduler 위치)은
[docs/architecture/deployment.md](../architecture/deployment.md) 가 source of truth 이며,
본 런북은 그것을 **복제하지 않고** 실행 절차(배포 명령·롤백·복구·증상별 진단)만 담는다.
정책 근거는 링크로 위임한다.

관련 문서:

- [deploy/README.md](../../deploy/README.md) — Docker Compose 배포 가이드(설치·기동·systemd timer).
- [docs/ops/daily-deploy-test.md](daily-deploy-test.md) — 일일 배포·자동 테스트 플레이북(로컬 루틴).
- [docs/architecture/deployment.md](../architecture/deployment.md) — deployment view(토폴로지·migration·secret·scheduler·network).
- [docs/ops/load-resilience-test-plan.md](load-resilience-test-plan.md) — 부하·내성 테스트 계획(시나리오·임계·도구 후보, harness 구현은 follow-up).

> **범위 한정**: 본 런북은 *문서*다. 실 credential/PAT 주입·live 배포 실행은 운영 행위(HITL 영역)로,
> 본 문서는 그 절차를 서술만 한다. 실값은 절대 본 문서에 적지 않는다(§9, 아래 4장 참조).

---

## 1. 배포 (Deploy / Redeploy)

### 1.1 재배포 실행

main 기준 재배포는 [`deploy/redeploy.sh`](../../deploy/redeploy.sh) 가 수행한다
(origin/main 동기화 → 이미지 재빌드 → 컨테이너 무중단 교체 → 잔여 이미지 정리).

- **수동 1 회 실행**(배포 체크아웃 `/opt/assessment-agent` 에서):

  ```bash
  cd /opt/assessment-agent
  REPO_DIR=/opt/assessment-agent bash deploy/redeploy.sh
  ```

- **systemd timer(매일 03:00 자동)**: unit 이름은 `assessment-agent-redeploy.{service,timer}`.
  설치·활성 절차는 [deploy/README.md §5](../../deploy/README.md) 참조.

  ```bash
  systemctl list-timers assessment-agent-redeploy.timer   # 다음 실행 시각
  sudo systemctl start assessment-agent-redeploy.service   # 지금 즉시 1 회 재배포
  journalctl -u assessment-agent-redeploy.service -f       # 재배포 로그
  ```

> **트리거는 둘 중 하나만**: 위 systemd timer **또는** 로컬 루틴(배포+테스트, 아래 1.3).
> 둘 다 켜면 하루 2 회 재배포된다([ADR-0043](../decisions/ADR-0043-daily-deploy-test.md) §5).

### 1.2 Migration 적용 순서

Schema migration 은 별도 수작업이 **불요**하다. `app` 컨테이너 entrypoint 가 기동 직전
`prisma migrate deploy` 를 멱등 실행해 미적용 migration 만 순차 적용한다. 정책 근거는
[deployment.md §Migration 정책](../architecture/deployment.md#migration-정책).

- 순서: `redeploy.sh` 재빌드 → 컨테이너 교체 → entrypoint `prisma migrate deploy` → NestJS 기동.
- 확인: `docker compose logs app` 의 migrate 단계 로그(부팅 실패 시 여기부터 확인).

### 1.3 배포 성공 확인

배포 후 [`deploy/daily-test.sh`](../../deploy/daily-test.sh) 의 health/liveness step 으로
기동을 검증한다(black-box HTTP 스모크 — 운영 이미지는 slim 이라 컨테이너 안 jest 불가).

```bash
# 재배포 포함 전체(health→liveness→auth→eval)
ssh deploy@192.168.0.7 "cd /opt/assessment-agent && bash deploy/daily-test.sh"
# 재배포 생략, 스모크만(이미 배포된 상태 검증)
ssh deploy@192.168.0.7 "cd /opt/assessment-agent && SKIP_REDEPLOY=1 bash deploy/daily-test.sh"
```

- 성공 판정: stdout 마지막 JSON 의 `result == "PASS"`.
- 수동 확인: 브라우저로 `http://<서버IP>:3000` 접속(web SPA + `/api/*`).
- 자동 루틴 절차는 [daily-deploy-test.md](daily-deploy-test.md) 참조.

---

## 2. 복구 (Recovery)

### 2.1 롤백(직전 정상 배포로 되돌리기)

배포 체크아웃에서 직전 정상 커밋으로 이동 후 재빌드한다. **`git push --force` /
`git reset --hard origin/...` 은 금지**([CLAUDE.md §9](../../CLAUDE.md) — history 보존 우선).
롤백은 로컬 체크아웃의 checkout 만으로 하고, origin 이력은 건드리지 않는다.

```bash
cd /opt/assessment-agent
git fetch --prune origin
git checkout <직전-정상-SHA>          # origin 이력 변경 없음 — 로컬 checkout 만
docker compose up -d --build
```

> **주의**: DB migration 은 자동 down 되지 않는다. schema 를 되돌려야 하는 롤백은 아래 2.3 을
> 따르고, 데이터 손실 위험을 먼저 판단한다(HITL — 사람 결정).

### 2.2 DB restore(백업 복원)

DB-level 복원은 PostgreSQL 표준 `pg_dump` / `pg_restore` 를 쓴다. 정책 근거는
[deployment.md §Backup/restore 전략](../architecture/deployment.md#backup--restore-전략).

```bash
# 백업(정기/롤백 직전)
docker compose exec postgres pg_dump -U assessment_agent assessment_agent > backup.sql
# 복원(새 인스턴스 또는 reset 후)
docker compose exec -T postgres psql -U assessment_agent -d assessment_agent < backup.sql
```

- DB 데이터는 named volume `assessment-agent-postgres-data` 에 보존된다 — 재빌드/재배포에도 유지.
- 복원 시 migration history 도 함께 복원되어 schema 상태가 동기된다.

### 2.3 Migration 실패 시 대응

`prisma migrate deploy` 가 기동 중 실패하면 `app` 컨테이너가 정상 부팅하지 못한다.

1. `docker compose logs app` 의 migrate 단계 로그로 실패 migration 을 특정.
2. schema 변경을 되돌려야 하면 **먼저 2.2 로 DB 백업**을 확보한 뒤 판단(자동 down 없음).
3. 데이터 손실 위험이 있는 schema rollback 은 사람 결정 영역(HITL) — 임의 강제 적용 금지.

---

## 3. Trouble-shoot (증상별 진단)

[`deploy/daily-test.sh`](../../deploy/daily-test.sh) 의 각 step FAIL 증상 → 원인 후보 → 조치.
FAIL step 은 JSON 요약의 `failedStep` 과 `logPath` 로 특정한다.

| step | FAIL 증상 | 원인 후보 | 조치 |
| --- | --- | --- | --- |
| redeploy | `redeploy.sh` non-zero | 빌드 실패 / docker 데몬 down / origin fetch 실패 | `docker compose logs app` + redeploy 로그 확인, `docker --version` 으로 데몬 상태 점검 |
| health | `GET /api` 가 `Assessment-Agent` 아님(TIMEOUT) | 컨테이너 미기동 / migrate 단계 실패 / 포트 충돌 | `docker compose ps`, `docker compose logs app` migrate 로그, `.env` 의 `PORT` 확인 |
| liveness | `GET /` 가 200/SPA HTML 아님 | `web/dist` 정적 serve 미장착 / build 산출물 누락 | web 빌드 산출물·serve-static mount 확인([deployment.md](../architecture/deployment.md#process-1-개의-책임-범위)) |
| auth | signup/login/me round-trip 실패 | `AUTH_JWT_SECRET` 미설정 / DB 연결 실패 | `.env` 의 `AUTH_JWT_SECRET`·`DATABASE_URL` 확인, DB health 점검 |
| eval | live smoke non-zero | LLM endpoint 미도달 / PAT 만료·scope 부족 / Ollama LAN 미노출 | 아래 3.1 알려진 장애 유형 참조 |

### 3.1 알려진 장애 유형

- **LLM endpoint 미도달**: `LlmProviderConfig` 의 `endpointUrl` 이 닿지 않음. LAN endpoint(예:
  로컬 PC Ollama `http://<PC-IP>:11434/v1`)면 네트워크·방화벽 확인. 사내 endpoint 면
  `NODE_EXTRA_CA_CERTS` / `HTTPS_PROXY` 설정 확인([deployment.md §외부 네트워크 boundary](../architecture/deployment.md#외부-네트워크-boundary)).
  `NODE_TLS_REJECT_UNAUTHORIZED=0` 은 사용 금지(MITM 위험).
- **github PAT 만료 / scope 부족**: 4xx(특히 401/403) 응답. read-scope PAT(`public_repo`/read)
  가 만료되었거나 scope 가 부족. env 키 `GITHUB_<KEY>_TOKEN_ENC`(암호화 주입) 갱신 후 재배포.
- **Ollama LAN 미노출**: 배포 기기가 로컬 PC Ollama 에 못 닿음. PC 에서 `OLLAMA_HOST=0.0.0.0`
  노출 + 방화벽 허용이 선행되어야 한다([deploy/README.md §5.2](../../deploy/README.md)).

---

## 4. 운영 전제 체크리스트

배포·평가 실행 전 아래 전제를 확인한다. **실 credential/PAT/secret 값은 절대 문서·git·로그에
적지 않는다**([CLAUDE.md §9](../../CLAUDE.md)) — 아래는 *주입 방식*과 *env 키 이름*만 서술한다.

- [ ] **Secret 주입**: 운영 `.env` 는 서버에만 두고 repo 에 commit 하지 않는다(`.gitignore` 대상).
      systemd 는 `EnvironmentFile=/etc/assessment-agent.env`(권한 `0600`), Docker 는 `--env-file`
      로 주입한다([deployment.md §Secret 저장](../architecture/deployment.md#secret--자격증명-저장)).
      실값 파일 금지 — 키 이름만 문서화.
- [ ] **DB 자격**: `POSTGRES_PASSWORD`·`DATABASE_URL`(호스트 = compose 서비스 이름 `postgres`)·
      `AUTH_JWT_SECRET`(`openssl rand -hex 32` 로 생성) 이 채워졌는지 확인.
- [ ] **github read-scope PAT**: 실 평가 e2e 는 github.com read PAT 를 요구한다.
      암호화 주입 env 키 `GITHUB_<KEY>_TOKEN_ENC`(`scripts/encrypt-token.ts`)만 사용,
      평문 토큰 금지(PLAN.md line 109 owner 승인 전제와 정합).
- [ ] **LLM provider config**: `LLM_APIKEY_ENC_KEY`(apiKey 암호화 키) 설정. LAN endpoint seed 는
      `SEED_LLM_ENDPOINT_URL` 등으로([deploy/README.md §5.2](../../deploy/README.md)).
- [ ] **Ollama LAN 노출**: 로컬 LLM 경로를 쓰면 PC 에서 Ollama LAN 노출이 선행되어야 한다
      (PLAN.md line 108/109 owner 승인 전제).

> secret 실값 검증: 본 문서는 LLM/GitHub/Azure 계열 실 API-key·토큰 값 패턴을 하나도 포함하지
> 않는다. env 키 *이름*과 *주입 방식*만 서술한다(§9).

---

## 5. 부하 배치 수동 실행 (REQ-047 manual 축)

REQ-047 의 검증 위치 enum `manual + perf test` 중 **manual 축**의 실행 절차다. 시나리오 정의·임계
근거·회차 기록은 [load-resilience-test-plan.md](load-resilience-test-plan.md) 가 source of truth
이고, 본 절은 **이미 존재하는 실행면을 사람이 그대로 따라갈 순서**만 적는다(harness·워크플로·임계
변경 0).

### 5.1 CI 경로 (권장)

GitHub Actions 의 `Load (k6)` workflow([.github/workflows/load-k6.yml](../../.github/workflows/load-k6.yml))
를 **수동 실행**한다 — `10 행` 이 `workflow_dispatch` 만 트리거로 두므로 PR·push 로는 돌지 않는다.

1. Actions → `Load (k6)` → **Run workflow**(브랜치는 보통 `main`).
2. `s1_persons` input(`15 행`)에 S1 표본 인원을 넣는다. 미지정 시 기본 `10`(`19 행`), 실 scale
   조건 반복은 `133`(외삽 계수 1)을 넣는다.
3. run 은 `concurrency` group `load-k6`(`26 행`)로 직렬화되고 `cancel-in-progress: false`(`27 행`)
   라 **진행 중 run 이 취소되지 않는다** — 겹쳐 dispatch 하면 앞 run 이 끝난 뒤 순차 실행된다.
4. job 진행 순서는 대상 컨테이너 기동(`78 행`) → devset 133 로그인 적재(`114 행`) → k6 설치
   (`124 행`) → smoke(`129 행`) → S1(`138 행`) → 실측 요약 기록(`153 행`) → S2(`195 행`) →
   S3(`211 행`) → 정리(`218 행`) 다. 중간에 사람이 개입할 지점은 없다.

### 5.2 로컬 경로

선행 조건 3 종을 먼저 확보한다.

- 앱(기본 `http://localhost:3000`)과 PostgreSQL 이 기동 중일 것(위 §1 또는
  [deploy/README.md](../../deploy/README.md)).
- `pnpm seed:devset-logins` 로 devset 133 로그인을 적재할 것 — 빈 DB 부하는 측정 의미가 없다.
- **k6 바이너리는 npm 패키지가 아니다.** lockfile 로 깔리지 않으므로 별도 설치가 선행되어야 한다
  (CI 는 `124 행` 의 setup-k6 action 이 대신한다).

그 뒤 [package.json](../../package.json) `23~27 행` script 를 아래 순서로 실행한다. smoke → S1 →
S2 → S3 순서는 CI 와 같아야 한다(S1 setup 의 첫 계정이 SuperAdmin 이어야 하는 전제).

```bash
pnpm seed:devset-logins   # 선행 1 회 — devset 적재
pnpm test:load            # smoke — 배선 확인
pnpm test:load:s1         # S1 평가 배치 부하
pnpm test:load:s2         # S2 조회 부하
pnpm test:load:s3         # S3 동시 요청 내성
```

### 5.3 env 3 종

| env | 기본값 | 의미 |
| --- | --- | --- |
| `K6_BASE_URL` | `http://localhost:3000` | 부하 대상 base URL([test/load/s1-batch.js](../../test/load/s1-batch.js) `25 행`). CI 도 같은 값을 주입한다(`131 행`). |
| `K6_S1_PERSONS` | `10` | S1 표본 인원(`28~31 행`). CI 는 `s1_persons` input 을 주입한다(`143 행`). 비수치·빈 값·0 이하는 기본값으로 정규화된다. |
| `LOAD_TEST_STUB` | 미설정 = OFF | **정확히 `1`** 일 때만 stub LLM 이 바인딩된다([ADR-0057](../decisions/ADR-0057-s1-batch-load-io-isolation.md) D1). `true`·`0`·빈 값은 fail-safe default OFF 라 실 LLM gateway 가 붙는다. CI 는 대상 컨테이너에 `1` 을 준다(`93 행`). |

### 5.4 결과 판독

- **판정 임계**: S1 은 `BATCH_P95_MS = 3600000 × (표본 인원 / 133)` 외삽식(`33~38 행`)으로 1h
  예산을 표본 크기에 환산한다. 실패는 k6 threshold 위반 = **exit code ≠ 0**.
- **실측 회수**: CI run 페이지의 **Job Summary**(`S1 실측 요약 기록` step, `153 행`)에 환경 메타
  표와 S1 summary JSON 전문이 적힌다. 로컬은 `--summary-export` 를 직접 붙여야 같은 JSON 을 얻는다.
- **`요약 파일 없음 — ...` 문구**(`190 행`)는 수치가 임계 미달이라는 뜻이 아니라 **k6 가 요약을
  남기기 전에 종료했다**는 뜻이다(k6 설치 실패·대상 부팅 실패). 임계 판정 이전 문제부터 잡는다.
- **회차 기록**: 새 실측은 [load-resilience-test-plan.md](load-resilience-test-plan.md) 의 `### 3.1
  baseline 실측 기록` 에 적재한다(본 런북에는 수치를 남기지 않는다).

### 5.5 한계 (이 절차가 증명하지 못하는 것)

- 이 경로는 `LOAD_TEST_STUB=1` stub LLM + GitHub·Confluence 자격증명 0 이라 실 수집·실 LLM 왕복은
  발화하지 않는다(REQ-047 잔여 (i) — [docs/requirements.md](../requirements.md) `66 행`).
- S1 은 133명 full run 이 아니라 축소 표본 + 선형 외삽 판정이라 1h full run 실측이 아니다(잔여
  (ii)). `s1_persons=133` 회차도 1 회 호출 측정이다.
