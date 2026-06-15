# 구현 진척 대시보드

[index.html](index.html) 은 Assessment-Agent 의 구현 진척 현황을 한눈에 보여주는 **자기완결형(self-contained) 정적 대시보드**다. 외부 의존성·빌드·서버 없이 브라우저로 바로 열 수 있다.

## 무엇을 보여주나

- **전체 진척 추정치** + 9개 phase(P0~P8) 별 진척 막대와 상태 배지
- **사용자 입장** — Admin/User 가 Web UI·REST API 로 지금 실제 해볼 수 있는 기능 (✓ 사용가능 · ◐ 부분/제약 · ○ 미구현)
- **테스터 입장** — 로컬/CI 에서 검증 가능한 범위 + 빠른 시작 명령
- **구현된 모듈 13개** 와 상태
- **REST 엔드포인트 인벤토리(~55개)** — RBAC 권한 표기 포함
- **남은 핵심 작업** 표

## 어떻게 보나

```sh
# 방법 1) 브라우저로 파일 직접 열기
open docs/dashboard/index.html      # macOS
xdg-open docs/dashboard/index.html  # Linux

# 방법 2) 로컬 정적 서버 (선택)
python3 -m http.server -d docs/dashboard 8080
# → http://localhost:8080
```

## 데이터 출처

대시보드의 수치·상태는 다음을 기준으로 정리한 **수동 스냅샷**이다(자동 생성 아님).

- [docs/STATE.json](../STATE.json) — phase, 누적 완료 task, CI 상태
- [docs/PLAN.md](../PLAN.md) — phase 별 체크리스트(진척률 산정 근거)
- [README.md](../../README.md) — 요구사항(REQ) 명세
- 코드베이스 인벤토리 — `src/` 모듈·컨트롤러, `test/` 스위트, `web/` 화면

## 어떻게 갱신하나

진척이 바뀌면 [index.html](index.html) 의 해당 섹션을 직접 편집한다. 주로 손대는 곳:

1. **헤더 메타** — `마지막 갱신`, `현재 단계`, `누적 완료 task`, `CI 상태`
2. **전체 진척 ring** — `<circle ... stroke-dasharray>` 값과 가운데 `text` 퍼센트 (둘레 2πr ≈ 440 기준, 채울 길이 = 440 × 진척률)
3. **단계별 진척** — 각 `.phase` 의 `.bar` 폭(`width:NN%`), `.pctn` 텍스트, `.badge` 클래스(`done`/`prog`/`todo`)
4. **사용자/테스터 입장** — `.try li` 항목과 클래스(기본 ✓ / `partial` ◐ / `no` ○)
5. **모듈·엔드포인트 표** — 신규 모듈/엔드포인트 추가 시 해당 `<tr>` 추가

> 문서 본문은 한국어, 식별자·경로·HTTP method 등 기계 친화 토큰은 영어로 유지한다(CLAUDE.md §12).
