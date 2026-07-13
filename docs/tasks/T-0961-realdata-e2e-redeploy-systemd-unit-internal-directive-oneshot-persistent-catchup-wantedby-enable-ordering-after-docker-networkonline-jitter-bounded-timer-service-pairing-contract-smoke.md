---
id: T-0961
title: systemd redeploy unit 내부 directive 계약(.service Type=oneshot + Wants/After=network-online.target docker.service ordering + .timer Persistent=true missed-boot catchup + RandomizedDelaySec≤300 bounded jitter + [Install] WantedBy=timers.target enable + timer↔service basename pairing) 정적 smoke
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-061, REQ-062]
estimatedDiff: 420
estimatedFiles: 1
sizeExempt: true
exemptReason: "test-only 단일 smoke-spec 1파일. sibling T-0960(docker-entrypoint 내부 부팅 시퀀스, 400 LOC)·T-0958(redeploy 내부 시퀀스, 420 LOC)·T-0959(seed-llm-config env-gating, 400 LOC) 동형. R-112 4종 cover 위한 다수 assert(oneshot·ordering ×2 target·Persistent·bounded jitter·WantedBy enable·timer↔service pairing·negative mutant a~f 6종) 불가피로 300 LOC 초과 예상이나 accepted sibling 패턴 그대로 — production 0 LOC·systemd unit 파일 미변경."
independentStream: realdata-e2e-redeploy-systemd-unit-internal-directive-contract
dependsOn: []
touchesFiles: [test/smoke/realdata-e2e-redeploy-systemd-unit-internal-directive-oneshot-persistent-catchup-wantedby-enable-ordering-after-docker-networkonline-jitter-bounded-timer-service-pairing-contract.smoke-spec.ts]
created: 2026-07-14
plannerNote: "P5 §109 재배포 runner chain 상류 trigger — systemd .service/.timer 내부 directive 계약 미봉. 기존 T-0797 parity 는 경로/REPO_DIR triple-match/OnCalendar 값 wiring 만 봉함(oneshot·Persistent·WantedBy·Wants/After·jitter 미봉, grep 확인). entrypoint T-0797(parity)→T-0958(내부 시퀀스) split 과 동형."
---

# T-0961 — systemd redeploy unit 내부 directive 계약(oneshot + ordering + Persistent catchup + bounded jitter + WantedBy enable + timer↔service pairing) 정적 smoke

## Why

무인 nightly 재배포 runner 의 계약 표면을 하류로 봉해온 chain(daily-test.sh: T-0944~T-0957, redeploy.sh 내부 시퀀스: T-0958, seed-llm-config.sh env-gating: T-0959, docker-entrypoint.sh 내부 부팅: T-0960)에서, 그 chain 을 **처음 발화시키는 상류 trigger** 인 systemd unit 짝 `deploy/assessment-agent-redeploy.timer`(매일 03:00 → oneshot service 활성) + `deploy/assessment-agent-redeploy.service`(`ExecStart=.../deploy/redeploy.sh`)의 **내부 directive 계약**은 아직 미봉이다. 기존 systemd smoke 는 상보적 다른 표면만 봉했다 — `redeploy-orchestration-entrypoint-contract-artifact-parity-drift.smoke-spec.ts`(T-0797)는 unit 과 실 artifact 사이의 **cross-artifact wiring parity** 만 봉했다: `ExecStart` 경로 suffix(`deploy/redeploy.sh`)·`Environment=REPO_DIR=`/`WorkingDirectory`/`ExecStart` triple-match prefix·`REPO_DIR` 기본값 == service 주입값·seed 경로 suffix·compose 존재·`OnCalendar` 값. 그러나 unit 자신의 **내부 semantic directive 계약**(`.service` `Type=oneshot`·`Wants`/`After=network-online.target docker.service` 순서 의존·`.timer` `Persistent=true` missed-boot catchup·`RandomizedDelaySec` bounded jitter·`[Install] WantedBy=timers.target` enable·timer↔service basename pairing)은 어느 smoke 도 봉하지 않았다(origin/main grep 확인 — parity smoke 는 이들 토큰에 `expect` assert NONE, 주석에 `oneshot` 1회 언급뿐). 이 관계는 redeploy.sh 가 T-0797(outer artifact parity) 봉함 뒤에도 T-0958(내부 ordered 시퀀스·strict-mode)이 별도로 필요했던 것, docker-entrypoint.sh 가 T-0797(runtime artifact parity) 뒤에도 T-0960(내부 부팅 시퀀스)이 필요했던 것과 정확히 동형이다. 이 내부 directive 가 변질되면 — `Type=oneshot` 소실 시 systemd 가 redeploy 를 상주 데몬으로 오인해 timer 재발화/완료-추적 semantics 붕괴 / `After=...docker.service` 소실 시 docker 데몬 미기동 상태에서 redeploy 발화 → `docker compose up` 실패 / `.timer` `Persistent=true` 소실 시 호스트가 03:00 에 꺼져 있었으면 놓친 야간 재배포를 영영 보충 못함(stale 배포 무한 지속) / `[Install] WantedBy=timers.target` 소실 시 `systemctl enable` 해도 timer 가 부팅 시 자동 시작 안 됨(nightly 재배포 아예 미발화) / `RandomizedDelaySec` 상한 이탈 시 지터가 예측 불가로 커져 03:00 창을 벗어남 — 무인 야간 재배포가 조용히 미발화 또는 crash 로 진행된다. 본 task 는 그 상류 trigger 의 내부 directive 를 정적 앵커로 봉해 재배포 runner chain 의 발화-leg 를 완결한다(PLAN.md 109행 재배포 runner chain).

## Required Reading

- `deploy/assessment-agent-redeploy.service` 전체(17행 — `[Unit]` `Wants=network-online.target docker.service`(3행)·`After=network-online.target docker.service`(4행)·`[Service]` `Type=oneshot`(7행)·`Environment=REPO_DIR=/opt/assessment-agent`(9행)·`WorkingDirectory=/opt/assessment-agent`(10행)·`ExecStart=/opt/assessment-agent/deploy/redeploy.sh`(11행)·`User=root`(16행) 포함).
- `deploy/assessment-agent-redeploy.timer` 전체(13행 — `[Timer]` `OnCalendar=*-*-* 03:00:00`(6행)·`Persistent=true`(8행)·`RandomizedDelaySec=300`(10행)·`[Install]` `WantedBy=timers.target`(13행) 포함).
- `test/smoke/redeploy-orchestration-entrypoint-contract-artifact-parity-drift.smoke-spec.ts` — 기존 systemd wiring parity smoke(T-0797: ExecStart 경로 suffix·REPO_DIR triple-match·seed 경로·compose 존재·OnCalendar 값 cross-artifact 대조). 본 task 는 그와 상보(unit 내부 semantic directive vs outer wiring parity) — 재구현/변경 0, 중복 assert 금지. 특히 이 smoke 가 이미 잡는 `ExecStart` 경로 suffix·`Environment=REPO_DIR=` 값·`OnCalendar` 값 은 본 task 에서 재검증하지 않는다.
- `test/smoke/realdata-e2e-docker-entrypoint-internal-step-sequence-strict-mode-exec-pid1-migration-before-boot-posix-sh-contract.smoke-spec.ts` — 형제 T-0960 내부 시퀀스 smoke 패턴(readFileSync 정적 추출·repo-root `__dirname` 해석·토큰 존재/순서 assert·합성 mutant drift-detection·§9 credential 누출 0 구조). 본 task 는 동일 패턴을 systemd unit 짝에 적용 — 재구현이 아니라 패턴 참조.

## Acceptance Criteria

- [ ] `test/smoke/realdata-e2e-redeploy-systemd-unit-internal-directive-oneshot-persistent-catchup-wantedby-enable-ordering-after-docker-networkonline-jitter-bounded-timer-service-pairing-contract.smoke-spec.ts` 신설. `deploy/assessment-agent-redeploy.service` 와 `deploy/assessment-agent-redeploy.timer` 를 각각 `readFileSync` 로 읽어 내부 directive 토큰을 정적 추출한다(실행/`systemctl`/실 timer 발화/실 redeploy 0). repo-root 경로는 `__dirname` 기준으로 cwd-robust 하게 해석(sibling T-0960 패턴).
- [ ] **Happy-path**: unit 내부 directive 계약 불변식 각각에 대해 성공 assert 1+ —
  - `.service` `[Service]` 섹션에 `Type=oneshot` 존재(redeploy 는 완료 후 종료하는 oneshot — 상주 데몬 아님),
  - `.service` `[Unit]` 섹션에 `After=network-online.target docker.service` 와 `Wants=network-online.target docker.service` 둘 다 존재하고 **각각 `network-online.target` 과 `docker.service` 두 대상 모두** 나열(순서 의존 + soft want: docker 데몬 + 네트워크가 redeploy **앞**에 준비됨 — git fetch·docker compose 전제),
  - `.timer` `[Timer]` 섹션에 `Persistent=true` 존재(호스트가 03:00 에 꺼져 있었으면 부팅 후 놓친 실행 1회 보충 — nightly 재배포 miss 방지),
  - `.timer` `[Timer]` 섹션에 `RandomizedDelaySec=` 존재하고 그 값이 **정수이며 ≤ 300**(bounded jitter — 최대 5분, 03:00 창 이탈 방지),
  - `.timer` 에 `[Install]` 섹션 + `WantedBy=timers.target` 존재(부팅 시 자동 시작 enable — 없으면 `systemctl enable` 해도 미활성).
- [ ] **timer↔service basename pairing 계약**: `.timer` 파일 basename 의 stem(`assessment-agent-redeploy`)과 `.service` 파일 basename 의 stem 이 동일함을 단언하는 assert 1+ (systemd 관례: `X.timer` 는 동일 stem 의 `X.service` 를 활성화 — stem 어긋나면 timer 가 엉뚱한/부재 service 를 활성). 두 파일 모두 `existsSync` 로 존재 확인 포함.
- [ ] **ordering-before-redeploy 순서 계약**: `.service` 의 `After=` 가 `network-online.target` 과 `docker.service` 를 모두 포함함을 단언하는 assert 1+ (둘 중 하나라도 빠지면 미준비 의존 위에서 redeploy 발화 위험 검출).
- [ ] **Error/negative path 충분 cover** — 예외 상황 분기마다 mutant 합성 소스로 not-match/실패 단언 각 1+ (최소 a~f 6종):
  - (a) `.service` `Type=oneshot` 을 `Type=simple` 로 바꾼 mutant → oneshot 계약 위반 검출(상주 데몬 오인 → timer/완료-추적 semantics 붕괴),
  - (b) `.timer` `Persistent=true` 라인을 제거한 mutant → missed-boot catchup 계약 소실 검출,
  - (c) `.timer` `[Install]`/`WantedBy=timers.target` 를 제거한 mutant → 부팅-시 enable 계약 소실(timer 미활성) 검출,
  - (d) `.service` `After=` 에서 `docker.service` 를 제거(network-online 만 남김)한 mutant → 순서 의존 소실(docker 미기동 상태 redeploy → compose 실패) 검출,
  - (e) `.timer` `RandomizedDelaySec=300` 을 상한 초과값(예: `3600`)으로 바꾼 mutant → bounded jitter(≤300) 계약 위반 검출,
  - (f) `.timer` 와 `.service` 의 basename stem 을 서로 다르게 만든 합성 mutant(예: timer stem 에 접미사 추가) → timer↔service pairing 위반 검출.
- [ ] **원본 read-only 입증**: 합성 mutate 후에도 원본 두 unit 추출 결과가 불변(원본 텍스트 미변조)임을 단언하는 test 1+.
- [ ] **§9 secret-safety**: 추출/합성하는 어떤 토큰에도 실 토큰/secret/password/실 endpoint 가 등장하지 않음(directive 키·`Type`/`Persistent`/`WantedBy`/`After`/`Wants` 값·정수 지터·systemd target 이름·unit basename stem 만)을 단언하는 test 1+. `User=root` 는 권한 모델 진단 값일 뿐 secret 아님 — 필요 시 존재 확인만, 값은 secret 표면 아님. `process.env` 읽기 0 — fixture 는 정적 파일 텍스트만.
- [ ] **Flow/branch cover**: oneshot 있음/없음 mutant 분기·Persistent 있음/없음 분기·WantedBy 있음/없음 분기·After docker.service 있음/없음 분기·jitter bounded/초과 분기·pairing 정상/어긋남 분기를 각 test 로 분리. systemd unit 은 조건 분기 없는 선언적 directive 파일 — "런타임 분기 없음(선언적 directive) — happy/negative mutant 로 대체 cover" 명시.
- [ ] non-gated 항상 실행(describe.skip / gating 분기 0), 실 `systemctl`/실 timer 발화/실 redeploy/실 docker/네트워크 0, `deploy/assessment-agent-redeploy.service`·`.timer` 변경 0(readFileSync 읽기만).
- [ ] `pnpm lint && pnpm build` green.
- [ ] `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%). 본 spec 은 production 0 LOC 라 coverageThreshold 무회귀 — 기존 임계 유지 확인.

## Out of Scope

- `deploy/assessment-agent-redeploy.service`·`.timer` 수정 금지(drift 실제 발견 시 별도 fix task — 본 task 는 검증 smoke 신설만).
- 기존 `redeploy-orchestration-entrypoint-contract-artifact-parity-drift.smoke-spec.ts`(T-0797: ExecStart 경로 suffix·REPO_DIR triple-match prefix·`Environment=REPO_DIR=` 값·seed 경로 suffix·compose 존재·`OnCalendar` 값 cross-artifact parity) 재구현/변경 0 — outer wiring parity vs 본 task 의 unit 내부 semantic directive 는 distinct 상보 표면. 본 task 는 ExecStart 경로·REPO_DIR triple-match·OnCalendar 값 을 재검증하지 않는다(중복 금지).
- `OnCalendar=*-*-* 03:00:00` **값 자체**의 스케줄 계약 재단언 0 — 그 값 parity 는 T-0797 소관. 본 task 는 `Persistent`/`RandomizedDelaySec`/`[Install]` 등 timer 의 **catchup·jitter·enable semantic** 만.
- T-0958(redeploy.sh 내부 시퀀스)·T-0960(docker-entrypoint.sh 내부 부팅) smoke 재구현/변경 0 — script 내부 orchestration vs 본 task 의 systemd trigger 내부 directive 는 distinct.
- 실 systemd unit 파싱 라이브러리 도입 0 — node 내장 `fs`/`path` 만. 필요한 directive 토큰만 정규식/섹션 슬라이스 추출(전체 spec 파싱 아님).

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(없음)
