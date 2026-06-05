# ADR-0028 — cloud proxy 호환 lock: `refs/locks/driver` blob ref → `claude/*` namespace 브랜치 이전

## Status

ACCEPTED (2026-06-05)

> doc-sync 완료 — Follow-up §3(첫 cron@cloud 자율 lock 획득, 403 미재발) **검증 완료 2026-06-05T07:07:55Z**: cron@vm-454c fire 가 stale 된 s62 lock(ff4bc2e, since 05:51:16Z, 76min 경과)을 `claude/lock-driver` 브랜치 위 `--force-with-lease` CAS push 로 자율 탈취(0472be7) — PAT 주입·UI 토글 없이 credential 0 으로 lock CAS 성공. 옛 `refs/locks/*` 9 회 403 패턴 종결, cron 자율 long-horizon 진입점 실제 작동 확인.
>
> 본 ADR 은 [ADR-0009](ADR-0009-strong-ref-cas-lock.md) 의 lock **저장소 메커니즘만** revise 한다 — CAS 원자성·강한 mutex·동일역할·read 전 fetch 의무 결정은 그대로 유지한다.
> ACCEPTED 전이 gate (ADR-0009 의 T-0127/T-0128 패턴 mirror) 충족: direct-mode 동기가 [T-0243](../tasks/T-0243-loop-claude-branch-lock-sync.md) 한 task 안에서 둘 다 완료됐다 —
> (1) [docs/LOOP.md](../LOOP.md) §1 [1] · §4 의 ref-CAS 획득/해제/fetch 명령을 본 ADR 의 `claude/lock-driver` 브랜치 lock 프로토콜로 반영,
> (2) [CLAUDE.md](../../CLAUDE.md) §10 "동시 실행 정책" 의 strong-mutex 설명을 브랜치 lock 기반으로 동기.
> 두 동기 머지 완료로 ACCEPTED — Follow-up §3 운영 검증은 status 메모로 추적.

## Context

[ADR-0009](ADR-0009-strong-ref-cas-lock.md) 는 driver lock 을 전용 git ref `refs/locks/driver`(blob ref)에 두고 `git push <sha>:refs/locks/driver --force-with-lease` 의 서버측 compare-and-swap 으로 multi-machine 강한 mutex 를 달성했다. 그 결정의 핵심 가정은 **"git remote 가 세 진입점(cron·/loop 여러 기기)의 유일한 공통분모"** 였다 (ADR-0009 Decision (2)).

이 가정이 **cron@cloud 환경에서 깨진다**. Claude Code on the web / routines(cron) 의 클라우드 sandbox 는 git push 를 **credential proxy** 가 가로채 `claude/*` prefix 브랜치(및 현재 작업 브랜치)로만 허용한다:

- <https://code.claude.com/docs/en/claude-code-on-the-web> — "By default, Claude can only push to branches prefixed with `claude/`" + credential proxy / "Allow unrestricted branch pushes" 절.
- <https://code.claude.com/docs/en/web-scheduled-tasks> — routines(cron) 가 동일 cloud sandbox/proxy 위에서 동작 → 동일 push 제약을 상속.

`refs/locks/*` 는 브랜치(`refs/heads/*`)가 아니므로 proxy 의 허용 prefix(`claude/*`) 밖이고, 따라서 cron@cloud 의 ref-CAS lock push 는 **HTTP 403** 으로 거부된다.

**1차 증거 — 2026-06-05 cron@cloud 9 회 연속 403 no-op** (`docs/progress/journal-2026-06-05.md` 02:02~08:04):

- 02:02 a245f9da / 03:04 fresh-checkout / 04:04 5f5708 / 05:02 ETkLP / 06:03 WrVOh / 07:03 YxtJz / 08:04 14204 등 9 회 fire 가 모두 `git push <blob>:refs/locks/driver --force-with-lease=...` 단계에서 **HTTP 403** 을 받고 lock 미보유로 no-op 종료했다 (패턴 정확히 동형, gh CLI 부재 `command -v gh` exit 1 동반).
- 각 fire 의 lock 은 `loop@AKIHA-s58`(elapsed 60min 초과 stale)이었음에도 — 즉 탈취 가능 상태였음에도 — push 권한 부재로 stale 탈취조차 못 했다.

**이 403 이 GitHub App 권한과 별개 층임이 확정됐다.** [docs/PLAN.md](../PLAN.md) "운영 정책 review backlog" 의 🔴 항목이 명시: **"GitHub 권한 grant(2026-06-02) 후에도 403 잔존 실증 → proxy 제한이 GitHub App scope 와 별개 층임 확정."** 권한을 더 부여해도 proxy 의 ref-prefix 정책은 그대로다 (T-0154 premise-gate 의 "여전히 403 → 본 task 진행" 분기 확정 선택).

결과적으로 cron@cloud 는 lock 을 자율 획득하지 못하고 로컬 `/loop`(`refs/locks/*` push 권한 보유 기기)의 **대체 픽업**에만 의존한다 → **진정한 cron 자율 long-horizon 이 불가**하다. 본 ADR 은 lock 저장소를 proxy 가 기본 허용하는 `claude/*` namespace 브랜치로 이전해 이 잔존 제약을 근본 해소한다.

## Decision

### (1) lock 저장소 = `refs/locks/driver`(blob ref) → `claude/*` namespace 브랜치(commit ref)

lock 을 전용 blob ref 가 아니라 **`refs/heads/claude/lock-driver`** 브랜치(commit ref)에 둔다. `claude/*` 는 cloud proxy 가 기본 허용하는 prefix 이므로, **PAT 주입도 "Allow unrestricted branch pushes" UI 토글도 없이** cron@cloud 가 자율적으로 lock CAS push 를 수행할 수 있다 (credential 0). 로컬 `/loop` 기기는 원래 모든 ref 를 push 할 수 있으므로 동일 브랜치를 동등하게 다룬다 — **세 진입점 모두 같은 `refs/heads/claude/lock-driver` 를 공통분모로 삼는다** (ADR-0009 의 "git remote 가 공통분모" 가정을, proxy 가 허용하는 ref namespace 로 좁혀 복원).

### (2) `--force-with-lease` CAS 원자성 불변 — ref 종류 무관

compare-and-swap 의 원자성은 **서버측 ref 갱신**이 제공하므로 ref 가 blob 이든 commit 이든 **동일하게 성립**한다. `git push origin <new-commit>:refs/heads/claude/lock-driver --force-with-lease=refs/heads/claude/lock-driver:<observed-old-sha>` 는 "내가 본 old-sha 일 때만 갱신" 을 강제하고, N 개 기기가 동시에 push 해도 정확히 1 개만 승리한다. **multi-machine 강한 mutex 보장은 ADR-0009 그대로 불변** — 저장 위치만 바뀐다.

### (3) blob → commit 의 기계적 차이

lock 메타(holder/session/since, ADR-0009 Decision (3) schema 불변)는 commit 의 단일 파일 tree `lock.json` 에 담는다. cross-path 정합을 위해 각 진입점이 다음 규약을 동일하게 따른다:

- **fetch (read 전 fetch 의무 — ADR-0009 (3) 불변)**:
  ```sh
  git fetch origin +refs/heads/claude/lock-driver:refs/remotes/origin/claude/lock-driver
  ```
  브랜치 미존재면 lock 비어있음(free)으로 간주.
- **획득 (CAS push)**: `lock.json` 을 담은 commit 을 만들어 위 (2) 의 `--force-with-lease` 로 push. observed-old-sha 는 직전 fetch 가 본 브랜치 tip (미존재면 `0{40}` zero-sha 로 "브랜치 생성" CAS). push 성공 → 획득. reject → 경쟁 패배 → 재 fetch → 여전히 held 면 no-op 종료.
- **해제 (tombstone)**: 빈 lock 상태를 표현하는 **tombstone empty commit**(`lock.json` 을 `{"holder":null}` 또는 빈 tree)을 동일 `--force-with-lease` CAS 로 push. 브랜치 삭제(`git push origin :refs/heads/claude/lock-driver`)는 cloud proxy 가 브랜치 delete 를 막을 여지가 있어 **기본 채택 안 함** — tombstone commit 으로 통일(브랜치는 상존, tip 이 free 를 표현). 이로써 해제 역시 `claude/*` push 한 번으로 cron@cloud 가 자율 수행 가능하다.

### (4) 60 분 stale 탈취 CAS 불변

60 분 임계를 초과한 lock 의 탈취 역시 `--force-with-lease` CAS push 로 수행해 동시 탈취 시 1 개만 승리하게 한다 (ADR-0009 Decision (4) 그대로). `human` lock 도 60 분 stale 탈취 대상 — 단기 보호용 성격 불변. **새 저장소(브랜치)에서도 탈취·획득·해제 의미가 동일**하다 — observed-old-sha 가 stale lock commit 의 tip 일 뿐이다.

### (5) cross-path 상호배제 정합

cron@cloud(브랜치 push)와 로컬 /loop(브랜치 push)가 **동일한 `refs/heads/claude/lock-driver` 단일 ref 를 두고 경쟁**하므로, 두 path 가 서로 다른 저장소로 갈라지지 않는다 → cross-path mutual exclusion 이 단일 CAS 평면에서 보장된다. ADR-0009 이전 과도기처럼 일부 기기가 옛 `refs/locks/driver` 를, 일부가 새 브랜치를 보는 split-brain 을 막기 위해, LOOP/CLAUDE 동기 task(전이 gate)는 **모든 진입점을 한 번에 새 ref 로 cutover** 한다 (옛 `refs/locks/driver` 와 병행 운영 금지 — 두 ref 병행은 상호배제 무효).

### (6) STATE.json mirror 정합

`docs/STATE.json` 의 `lock` 필드는 ADR-0009 에서도 **사람-친화 mirror** 일 뿐 권위 source 가 아니었다(권위는 ref). 본 ADR 도 동일 — 권위는 `refs/heads/claude/lock-driver` 의 tip commit `lock.json`, STATE.json `lock` 은 driver 가 commit 시 best-effort 로 반영하는 거울이다. mirror 가 어긋나도 상호배제는 ref CAS 가 책임지므로 정합성 깨지지 않는다 (STATE single-writer 룰 §9 불변).

## Consequences

**장점**

- **cron@cloud 자율 lock 획득** — PAT 주입/UI 토글 없이 `claude/*` push 만으로 lock CAS 가능 → 로컬 기기 대체 픽업 의존 제거, 진정한 cron 자율 long-horizon 실현.
- CAS 원자성·강한 mutex·multi-machine 안전·read 전 fetch 의무 모두 ADR-0009 그대로 — 본 ADR 은 push 거부 표면(403)만 제거.
- 세 진입점이 단일 ref 공통분모로 복원 — cross-path 상호배제가 한 CAS 평면에서 성립.

**비용 / 트레이드오프**

- `claude/*` 브랜치 목록에 `claude/lock-driver` 가 섞여 noise — feature-branch 정리 스크립트(예: 머지된 `claude/T-*` 삭제)가 lock 브랜치를 **오삭제하지 않도록 가드 필요**(이름 패턴 exclude). 오삭제 시 zero-sha CAS 로 재생성되지만 진행 중 lock 을 날릴 수 있다.
- lock 이 blob 1 개 → commit object(tree+commit)라 미세하게 무겁다 (실무 영향 무시 가능).
- ADR-0009 의 LOOP §1[1]·§4 명령 + CLAUDE §10 모델 동기 필요 (전이 gate — 아래 Follow-up).
- 브랜치 delete 대신 tombstone commit 채택 → 브랜치가 상존(tip 이 free/held 표현). 사람이 lock 확인 시 `git ls-remote origin refs/heads/claude/lock-driver` 후 tip `lock.json` 직독.

**Follow-up (ACCEPTED 전이 gate — 박제)**

본 ADR 은 prompt/doc 박제 메커니즘이므로 "구현" = 다음 direct-mode 동기 task 다. 둘 다 머지돼야 ADR-0009 패턴대로 ACCEPTED 전이:

1. (direct) [docs/LOOP.md](../LOOP.md) §1 [1] · §4 의 ref-CAS 획득/해제/fetch 명령을 `claude/lock-driver` 브랜치 lock 프로토콜로 반영 — 옛 `refs/locks/driver` 와 병행 금지(§Decision (5) cutover).
2. (direct) [CLAUDE.md](../../CLAUDE.md) §10 "동시 실행 정책" 의 strong-mutex 설명을 브랜치 lock 기반으로 동기.
3. (운영) 위 머지 후 첫 cron@cloud fire 가 `claude/lock-driver` 를 자율 획득(403 미재발)하는지 검증.

## Alternatives

- **(A) ADR-0009 blob-ref 유지 + PAT 주입** — web env 환경변수로 GitHub PAT 를 주입해 proxy 를 우회하면 `refs/locks/*` push 가 풀린다. **기각/보류**: [CLAUDE.md](../../CLAUDE.md) §5 HITL 의 "외부 자격증명 필요" BLOCKED 사유에 해당하고, 사용자 secret 관리·rotation·노출 risk 부담이 크다. 본 ADR(C)은 credential 0 으로 같은 목표를 달성하므로 PAT 의 ROI 가 낮다.
- **(B) "Allow unrestricted branch pushes" UI 토글만 ON** — proxy 의 브랜치 prefix 제한을 풀어 direct→main push 는 풀린다. 그러나 토글은 **브랜치(`refs/heads/*`) push 제한**을 완화할 뿐 `refs/locks/*` 는 여전히 브랜치가 아니므로 거부 → **lock 미해결, 단독 불충분**. direct→main 안정화용 보완 수단으로만 유효(사용자 책임, 본 task 범위 밖).
- **(C) 본 ADR 채택 — `claude/*` 브랜치 lock** — credential 0, proxy 정합(허용 prefix 내). CAS·강한 mutex 불변. **채택**. (B)와 직교 보완 가능(B 는 main push, C 는 lock).
- **ADR-0009 Alternatives 와의 정합**: ADR-0009 (c)(GitHub API lock) 기각 사유 "git remote 가 더 낮은 공통분모" 는 본 ADR 에서도 유효 — 본 ADR 은 git remote 를 버리지 않고 그 안에서 proxy-허용 ref namespace 로 좁혔을 뿐이다. (d)(외부 lock 서버) 기각 사유(새 dependency §5 BLOCKED) 역시 유효 — 본 ADR 은 외부 dependency 0.
