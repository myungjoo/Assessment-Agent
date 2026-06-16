# Ubuntu 배포 가이드 (Docker Compose)

Assessment-Agent 를 Ubuntu 머신에 Docker Compose 로 배포하고, **매일 밤 main 기준으로 자동 재배포**하는 절차다.
배포 구조는 [docs/architecture/deployment.md](../docs/architecture/deployment.md) 의 monolithic 단일 NestJS process (ADR-0003) + `web/dist` SPA 정적 serve (ADR-0040) 결정을 그대로 따른다.

구성 요소:

| 파일 | 역할 |
| --- | --- |
| [`Dockerfile`](../Dockerfile) | backend(`dist/`) + web SPA(`web/dist/`) 멀티스테이지 빌드 → 슬림 런타임 이미지 |
| [`docker-compose.yml`](../docker-compose.yml) | `postgres` + `app` 두 서비스. `up -d --build` 한 번으로 기동 |
| [`deploy/docker-entrypoint.sh`](docker-entrypoint.sh) | 컨테이너 부팅 시 `prisma migrate deploy` → `node dist/src/main` |
| [`deploy/env.prod.example`](env.prod.example) | 운영 `.env` template (DB 자격 / `DATABASE_URL` / `AUTH_JWT_SECRET`) |
| [`deploy/redeploy.sh`](redeploy.sh) | main 동기화 → 재빌드 → 컨테이너 교체 (야간 자동 재배포 본체) |
| [`deploy/assessment-agent-redeploy.{service,timer}`](assessment-agent-redeploy.timer) | systemd 야간 트리거 (매일 03:00) |

---

## 1. 사전 준비 (Ubuntu 머신, 1회)

Docker Engine + Compose plugin 설치:

```bash
sudo apt-get update
sudo apt-get install -y ca-certificates curl git
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" \
  | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
```

확인:

```bash
docker --version
docker compose version
```

---

## 2. 저장소 클론

배포 전용 체크아웃을 `/opt/assessment-agent` 에 둔다 (경로는 자유 — 바꾸면 아래 systemd/스크립트 경로도 함께 수정).

```bash
sudo git clone <이 저장소 URL> /opt/assessment-agent
sudo chown -R "$USER":"$USER" /opt/assessment-agent
cd /opt/assessment-agent
```

---

## 3. 환경변수(.env) 설정

```bash
cp deploy/env.prod.example .env
# .env 편집 — 아래 값을 실제 값으로 교체
```

반드시 채울 값:

- `POSTGRES_PASSWORD` — 강력한 DB 비밀번호.
- `DATABASE_URL` — **호스트는 `postgres` (compose 서비스 이름)**. user/password/db 를 위 POSTGRES_* 와 일치시킬 것. 예:
  `postgresql://assessment_agent:<비밀번호>@postgres:5432/assessment_agent?schema=public`
- `AUTH_JWT_SECRET` — `openssl rand -hex 32` 로 생성한 무작위 값. **비우면 JWT 서명 검증이 무력화**된다.

> `.env` 는 `.gitignore` 대상이라 commit 되지 않는다 (CLAUDE.md §9). 서버에만 둔다.

---

## 4. 최초 기동

```bash
cd /opt/assessment-agent
docker compose up -d --build
```

- `postgres` 가 health 통과 후 `app` 이 기동한다.
- `app` 컨테이너 entrypoint 가 `prisma migrate deploy` 로 스키마를 적용한 뒤 NestJS 를 띄운다.
- 기본 포트 `3000`. 브라우저로 `http://<서버IP>:3000` 접속 (web SPA + `/api/*`).

로그 / 상태:

```bash
docker compose ps
docker compose logs -f app
```

> **DB 데이터**는 named volume `assessment-agent-postgres-data` 에 보존된다. 재배포/재빌드해도 유지된다.

---

## 5. 매일 밤 자동 재배포 (systemd timer)

> **트리거는 둘 중 하나만**: 본 §5 의 systemd timer **또는** §5.1 의 로컬 루틴(배포+테스트).
> 둘 다 켜면 하루 2 회 재배포된다. **배포 후 자동 테스트까지 원하면 §5 systemd timer 는 설치하지
> 말고 §5.1 을 쓴다** ([ADR-0043](../docs/decisions/ADR-0043-daily-deploy-test.md) §5).

`deploy/redeploy.sh` 가 main 동기화 → 재빌드 → 컨테이너 교체를 수행한다. systemd timer 로 매일 03:00 에 실행한다.

```bash
chmod +x /opt/assessment-agent/deploy/redeploy.sh

# unit 파일 설치 (경로가 /opt/assessment-agent 가 아니면 두 파일 내부 경로 수정 후 복사)
sudo cp /opt/assessment-agent/deploy/assessment-agent-redeploy.service /etc/systemd/system/
sudo cp /opt/assessment-agent/deploy/assessment-agent-redeploy.timer   /etc/systemd/system/

sudo systemctl daemon-reload
sudo systemctl enable --now assessment-agent-redeploy.timer
```

확인 / 수동 실행 / 로그:

```bash
systemctl list-timers assessment-agent-redeploy.timer   # 다음 실행 시각
sudo systemctl start assessment-agent-redeploy.service   # 지금 즉시 1회 재배포
journalctl -u assessment-agent-redeploy.service -f       # 재배포 로그
```

시각 변경: `assessment-agent-redeploy.timer` 의 `OnCalendar=*-*-* 03:00:00` 수정 후 `daemon-reload` + 타이머 재시작. 서버 타임존은 `timedatectl` 로 확인(필요 시 `sudo timedatectl set-timezone Asia/Seoul`).

### 대안: crontab

systemd 대신 cron 으로도 가능:

```bash
crontab -e
# 매일 03:00
0 3 * * * cd /opt/assessment-agent && REPO_DIR=/opt/assessment-agent /opt/assessment-agent/deploy/redeploy.sh >> /var/log/assessment-agent-redeploy.log 2>&1
```

> cron 사용자는 `docker` 그룹 소속이어야 한다(`sudo usermod -aG docker $USER` 후 재로그인).

---

## 5.1 매일 밤 배포 + 자동 테스트 (로컬 루틴 — 권장)

재배포만 하는 §5 대신, **재배포 후 기동된 앱을 자동 테스트**까지 하려면 본 경로를 쓴다.
구동 주체는 기기가 아니라 **같은 LAN 의 로컬 PC** 다 — 설계·근거는
[ADR-0043](../docs/decisions/ADR-0043-daily-deploy-test.md), 자동화 절차는
[docs/ops/daily-deploy-test.md](../docs/ops/daily-deploy-test.md) (플레이북).

구성:

- **기기 측 러너** [`deploy/daily-test.sh`](daily-test.sh) — `redeploy.sh` 호출 → health 대기 →
  black-box 스모크(`GET /api` · `GET /` SPA) → 인증 라운드트립(`POST /api/users` →
  `/api/auth/login` → `/api/auth/me`). 결과를 `deploy/logs/` 에 로그 + `latest-result.json`,
  전부 PASS 면 exit 0. 운영 이미지는 슬림(devDep 제거)이라 컨테이너 안 jest 가 불가 →
  black-box HTTP 스모크가 검증 수단이다.
- **트리거** — 로컬 PC 의 Claude Desktop **로컬 루틴**(Daily 02:00)이 SSH 로 위 러너를 실행하고,
  결과를 단일 `daily-test` 라벨 GitHub issue 로 보고한다(PASS=close, FAIL=open 유지, 항상 ≤1 개).
  클라우드 cron 은 LAN 사설 IP 에 못 닿으므로 트리거는 반드시 같은 LAN 의 로컬 PC 다.

수동 1 회 실행(검증용):

```bash
# 재배포 포함 전체 (스크립트는 100644 — redeploy.sh 관례대로 bash 로 호출)
ssh deploy@192.168.0.7 "cd /opt/assessment-agent && bash deploy/daily-test.sh"
# 재배포 생략, 스모크만 (디버깅)
ssh deploy@192.168.0.7 "cd /opt/assessment-agent && SKIP_REDEPLOY=1 bash deploy/daily-test.sh"
```

루틴 등록 절차는 [docs/ops/daily-deploy-test.md](../docs/ops/daily-deploy-test.md) "루틴 등록" 참조.

> 본 경로를 쓰면 §5 systemd timer 는 **설치하지 않는다**(이중 재배포 방지).
> 고정 테스트 계정 `daily-smoke@local.test` 1 개가 기기 DB 에 상주한다(테스트 전용 기기라 무해).
> **다른 LAN 기기의 브라우저**로 로그인 사용자 테스트를 하려면 `secure` 쿠키 때문에 TLS(리버스
> 프록시)가 필요하다([ADR-0043](../docs/decisions/ADR-0043-daily-deploy-test.md) Consequences).

---

## 6. 운영 메모

- **마이그레이션**: 매 재배포 시 entrypoint 가 `prisma migrate deploy` 를 멱등 실행 — 미적용 migration 만 순차 적용. 별도 수작업 불요. (prod 이미지는 `typescript` 없이 prisma CLI 번들 로더로 `prisma.config.ts` 를 읽는다. 이 경로는 CI `deploy-artifacts` job 의 런타임 smoke 가 매 PR 마다 실제 기동으로 검증한다 — 부팅 실패 시 `docker compose logs app` 의 migrate 단계 로그를 먼저 확인.)
- **롤백**: 특정 커밋으로 되돌리려면 배포 체크아웃에서 `git checkout <SHA>` 후 `docker compose up -d --build`. (단 DB 마이그레이션은 자동 down 되지 않으니, 스키마 변경을 되돌릴 땐 주의.)
- **백업**: `docker compose exec postgres pg_dump -U assessment_agent assessment_agent > backup.sql` (deployment.md "Backup/restore" 참조).
- **사내망 / 사내 인증서**: 외부 사내 endpoint(GitHub Enterprise / Confluence / LLM proxy)에 접근하려면 `.env` 의 `NODE_EXTRA_CA_CERTS` / `HTTPS_PROXY` 주석을 해제하고, CA 파일을 `app` 컨테이너에 mount 해야 한다 — `docker-compose.yml` 의 `app` 서비스에 다음을 추가:
  ```yaml
      volumes:
        - /etc/ssl/certs/corp-ca-bundle.pem:/etc/ssl/certs/corp-ca-bundle.pem:ro
  ```
  `NODE_TLS_REJECT_UNAUTHORIZED=0` 은 사용 금지(MITM 위험 — deployment.md).
- **포트 변경**: `.env` 의 `PORT` 만 바꾸면 host/container 양쪽에 반영된다.
