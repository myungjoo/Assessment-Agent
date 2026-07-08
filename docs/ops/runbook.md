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
