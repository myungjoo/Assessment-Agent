본 문서는 이 Software System의 소개로서 Use Case 문서의 기본이 되는 Description 역할과 사용자들에게 어떠한 사용을 할 수 있는지 안내를 한다.


# Assessment-Agent

AA (Assessment-Agent)는 Web Interface를 제공하는 Agent System 이다.
각 개발자들의 기여 활동의 양과 질을 평가하고 평가 결과를 저장하고 보여주는 시스템이다.

질과 양 모든 면에서 각 개발자가 얼마나 기여하는 지 다양한 지표를 통해 수치적으로도 보여주고, 사용자가 지정한 기간동안 어떠한 주요 활동이 있었는지 LLM을 통해 평가 코멘트도 생성하여 보여 주게 된다.

# Assessment Target

AA의 평가 대상은 크게 코드 작성과 문서 작성으로 나누어 볼 수 있다.

## 코드 평가 대상
- Github.com 내 지정 Organization 내 전체 Repository, 혹은 지정 Repository 내 Commit 내용물
- Github.sec.samsung.net 내 지정 Organization 내 전체 Repository, 혹은 지정 Repository 내 Commit 내용물
- Github.ecodesamsung.com 내 지정 Organization 내 전체 Repository, 혹은 지정 Repository 내 Commit 내용물

주의 사항: 접근 권한 (read) 을 AA가 가지고 있어야 한다. 접근 권한이 모자를 경우 AA 사용자와 관리자가 인식하여 대응할 수 있어야 한다.
주의 사항: Forked repository로 인해 내용물이 중복되거나, Meld되거나 Rebase되어 commit ID는 다르지만 중복된 내용물이 상당히 있을 수 있다. 중복된 부분은 제거되고 평가되어야 한다. 중복된 부분이 시간적으로 다를 수 있음도 고려되어야 한다. (2월 결과물이 3월 timestamp로 중복될 경우 2월에 기여한 것으로 판단한다.)

### 평가 목표
- 코드 기여의 양과 질을 모두 평가하여야 한다.
- 보다 더 중요한 기여, 보다 더 어렵고 남들이 못할 일을 한 개발자를 식별하여 더 높은 점수와 더 높은 평가 코멘트가 생성되어야 한다.
- commit과 PR 숫자만 늘리는 abusing을 통해 점수를 높히는 상황을 평가 Metric을 통해 방지할 수 있어야 한다.
- 코드 작성에 있어 기여가 현격히 떨어지는 저성과자를 식별할 수 있어야 한다.

## 문서 평가 대상
- 코드 평가 대상이 된 Repository에 Issue를 작성하여 다른 개발자들의 활동에 도움이 된 경우. 단, 본인 결과물에 대해 본인이 Follow-up을 남기고 본인이 소비하는 경우는 카운트 하지 않는다.
- 지정된 주소의 Confluence Service 내 지정된 SPACE들 내에서의 문서 작성 / 업데이트 활동.

주의 사항: 접근 권한 (read) 을 AA가 가지고 있어야 한다. 접근 권한이 모자를 경우 AA 사용자와 관리자가 인식하여 대응할 수 있어야 한다.
주의 사항: 지정된 SPACE 내 Crawling을 해야 할 수 있다. 단, 지정된 SPACE 내 페이지 List나 Hierarchy (directory) 구조를 기반으로 탐색하여도 된다.

### 평가 목표
- 단순 보고성 자료는 질적으로 낮게 평가한다. 단순 로그 작성, 특히 copy-paste로 볼 수 있는 로그 붙이기는 zero-contribution으로 간주한다.
- 새로운 알고리즘의 설계, 새로운 일거리의 구상, 외부 연구 도입을 위해 타 개발자들이 참고할 수 있도록 소개 자료를 정리하는 활동은 높은 contribution으로 간주한다.
- 궁극적으로 보다 조직에 큰 기여를 문서를 통해 한 인원에게 더 높은 점수와 더 높은 평가 코멘트가 생성될 수 있어야 한다.
- Abusing (의미 없는 기여의 단순 반복) 을 평가 Metric을 통해 막을 수 있어야 한다.
- 문서 작성 중 습관적으로 Update를 하여 중간 저장을 하여 Update 횟수만 늘어나는 경우에 대해 advantage/disadvantage 둘 다 있어서는 안된다.


## 평가 대상 인원
- 각 서비스 별로 하나의 인물이 다른 ID를 가질 수 있다.
- 예를 들어 github.com의 ID는 myungjoo, github.sec.samsung.net은 myungjoo-ham, confluence.sec.samsung.net은 myungjoo.ham 같은 식으로 되어있을 수 있다.
- 단, 기준이 되는 "primary key" 역할을 할 ID는 그중 한 곳의 ID로 지정할 수 있다. (예를 들어 confluence.sec.samsung.net의 ID를 기준 ID로 하면 된다.)
- 일부 인원은 특정 서비스에 가입이 되어있지 않아 NULL일 수는 있다. (그러나 confluence.sec.samsung.net에는 모두 ID가 있다.)
- 평가 대상 인원은 별도로 미리 저장하고 추가/삭제/변경/Deactivate/Activate 될 수 있어야 한다. (deactivate는 삭제를 굳이 하지 말고 평가 대상자 명단에서만 숨김. 예: 휴직)
- 평가 대상 인원이 새로이 추가될 경우 코드/문서 평가를 다른 사람들과는 다르게 훨씬 긴 기간에 대해 한 번은 해줘야 한다. (예를 들어 일반적으로 매일 1주일어치 활동기록을 가져온다면, 새로 추가된 인원은 지난 1년치 활동 기록 가져오기)
- 평가 대상 인원은 집단 정보를 가질 수 있다. 조직도 상 파트별이 될 수도 있으며, 임의의 추가 group도 정의할 수 있다. 임의의 추가 group은 하나의 인원이 여러 group에 속할 수 있으나, 조직도 상 파트별 분류는 1개 파트에만 속하도록 한다.


# 평가 자료의 저장

- Non-volatile하게 평가 자료를 저장하여, 조회시 마다 새로이 자료를 모으고 새로 평가할 필요가 없어야 한다.
- 평가 자료가 저장된 공간은 쉽게 export하여 backup하고 restore하여 reset할 수도 있어야 한다.
- 평가 자료를 재수집할 때에 저장된 부분이 중복되지 않도록 하여야 하나, 재수집 대상 (github, confluence) 의 data synchronization 문제나 뒤늦게 commit push되면서 과거의 자료가 나중에 업데이트되는 경우 놓치지 않도록 하여야 한다. 최근 1주 정도의 데이터는 재수집하여 중복 부분을 제거하는 형태가 되어도 좋다. (주기적으로 데이터 모으면서 최근 1주 정도는 중복되어 다시 fetch & process하여도 computing power에 부담이 없다고 일단 가정하자. 이부분은 나중에 최적화가 필요하다고 판단하면 다시 최적화하기 위한 고려를 하자.)
- 평가 자료의 raw data (code commit, documentation change) 를 저장하는 것은 안된다.
- 각 code commit, create/update된 문서 건 별 기여도, 난이도, 양을 모두 평가하여 가지고 있으면 된다.
- 종료된 날짜의 활동에 대해서는 (실행 당일은 자정이 될때까지는 아직 끝나지 않았으니 하지 말자) 그날의 전체 활동에 대해 요약하여 어떠한 기여를 하였고, 얼마나 중요하고 영향력이 있는 기여인지 평가한 평가문도 저장해 두자.
- 이러한 평가 문은 주간 (다음주 시작시) / 월간 (다음달 시작시) 단위로도 해당 기간의 활동을 토대로 작성하자.
- 평가 문은 개발자들 간 상대적인 비교도 가능할 수 있어야 하며, 주간/월간 활동 요약기록은 LLM에 의한 정성적 평가 결과 외에 개발된 Metric에 의한 수치적 평가 결과도 함께 보유하도록 한다.
- 평가 결과가 없는 부분에 대해서는 일괄적으로 평가를 해 주면 되며, 개발 과정에서 디버깅 등의 목적으로 Reset & Reeval을 할 수 있어야 한다.

# 평가 자료의 시각화와 UI

- 저장된 평가 결과에 대해 조회하도록 한다.
- 이름순, ID순, 각 지표별 Sorting 이 가능해야 한다.
- 이름, ID, 지표 수치에 따른 Filtering 하여 보여주기도 가능해야 한다.
- 시간 흐름에 따라 (일/주/월 별) 지표의 변화를 각 인물, 집단 별, 전체, filter된 인원에 대해 볼 수 있어야 한다.
- 평가 진행은 Admin가 주기를 지정할 수 있다. (예: 매일 KST 새벽 2시)
- 평가 진행을 Admin이 Manual하게 Trigger할 수 있다.
- 기존 평가 결과 중 최근 구간을 Admin이 Manual하게 삭제할 수 있다. (예: 최근 1일어치, 최근 7일어치, 최근 30일어치 등) 이 경우 다음 평가 진행 시 비어있는 시간만큼 다시 하게 된다. (평가 자료의 저장 항목 참고)

# 평가 실행 제약 사항

- 평가 진행 중일 때는 시각화를 기존 자료만 보여주며, 현재 평가 자료 수집/평가 중임을 상단에 경고해준다.


# 보안 특성

- 평가 자료 조회와 자료 편집을 포함하여 모든 사용 기능은 보안사항으로서 ID와 Password로 보호되어야 한다.
- 서비스 런칭 후 첫 로긴에서 Admin ID/Password를 지정하고, 이 Admin이 사용자를 추가할 수 있도록 (Web UI상 에서) 한다. 사용자는 User와 Admin 두가지 등급이 있다. Admin권한 사용자는 User->Admin 승급을 진행할 수 있다. Admin->User 변경은 첫 로긴 Admin만 수행할 수 있고, 본인에 대해서는 Admin->User 를 할 수 없다. 내부적으로는 SuperAdmin (첫 로긴), Admin, User 가 있다고 볼 수 있다.
- Admin은 평가 자료 재작성, Reset, Import/Export, 인원 편집, 인원 Group/파트 편집 등을 할 수 있다.
- User 등급은 시각화 자료의 조회, Sorting, Filtering 등 Read-only에 해당하는 활동만 할 수 있다.

# 성능 특성

- 실제 시스템이 동작 가능하게 되어 동작할 때 까지는 성능 요구사항을 구체적으로 정의하지는 않는다.
- 다만, 평가 작성이 100 에서 200명 정도의 평가대상자를 대상으로 50에서 100여개의 Github repository들과 1000건 가량의 confluence page들을 대상으로 하여 1시간 이내에 되는 수준을 기대한다.
- 평가 결과가 이미 저장되어 조회하는 경우 거의 실시간으로 볼 수 있어야 한다. (로딩 및 시각화에 3초 이내)

# LLM Serving

- 평가에 사용되는 LLM은 Admin이 지정할 수 있어야 한다.
- 난이도에 따라 3가지 모델을 고를 수 있어야 하며, 어떤 항목이 어떤 난이도를 가지는 지를 구현하면서 결정하여야 한다.
- 후보 LLM은 다음과 같다
    - custom (openAI API 호환, 내부 자체 서버. 다양한 모델 가능. proxy인 경우도 있음. 3가지 모델을 서로 다른 세팅의 custom으로 채울 수도 있다.)
    - azure-openai
    - anthropic
    - google gemini
    - open AI


# 구현 과정에 대한 제약

- Well-known & Well-maintained library를 사용하여 construct해도 좋다. 단, 중복하여 사용하지 않아야 하며, 이미 import한 library가 제공되는 기능을 위해 다른 library나 다른 version을 다시 더 import하게 되지 않도록 해야 한다.
- 한번에 많은 구현을 하지 않고, 한번에 하나의 coherent한 기능과 부품을 제작하여야 한다. (하나의 commit에는 하나의 주제)
- 하나의 commit 혹은 PR 작성 후 코드 검토와 test case 작성 및 test 수행이 이뤄져야 한다.
- 모든 test case들은 CI를 통해 자동 실행이 되고, test case fail 발생시 CI error 발생으로 연결되어 코드 작성 agent와 개발자 모두 쉽게 인지할 수 있어야 한다.
- 개별 feature 작성 시 feature 내 기능, feature 내 예외 처리 기능, feature 내 flow를 대부분 커버하도록 unit test case가 작성되어야 한다. 예외 처리 기능 검증을 위해 negative test cases들도 추가되어야 한다.
- unit test case 외에 smoke test, end-to-end test도 이뤄져야 하며, 이들도 CI 에서 함께 수행되어야 한다.
- Agent가 하나의 활동 (commit 추가)를 하고 나면 test 수행을 하여 검증을 해 두어야 하며, Agent 종료 전 commit PR된 내용에 대한 CI수행도 하여야 한다.
- Agent가 하나의 활동을 마무리 하면서 PR을 만들면 다른 Agent가 fire되어 PR에 대한 review를 수행하여야 한다.
- Reviewer Agent와 Committer Agent가 모두 Merge에 합의되면 PR Merge되어야 한다. 이를 위해 PR -> code review -> PR update -> code review round 2 -> ...  와 같은 반복이 이뤄질 수 있다. round 7 까지 갈때까지 합의에 이르지 못하면 해당 주제를 중단하고 개발자에게 Notify하여 대답을 받아오도록 한다.
- Reviewer Agent는 다음의 항목을 검사하여야 한다.
```
코드 리뷰를 수행하라. 리뷰 대상 코드 변경사항과 기존 Repository내 내용, Target Software가 사용하는 외부 Library들을 모두 분석 대상으로 하되, 리뷰 지적 대상은 지정된 코드 변경사항으로 제한한다.

- 주어진 주제를 해결하고 있는지 검사하라.
- 기존 기능이나 성능을 해치지 않는지 검사하라. 특히 타 모듈에 Regression을 일으킬 수 있는지 점검해라.
- 코드 크기가 주제에 비해 지나치게 크거나, 불필요하게 다른 모듈을 건드리지 않는지 검사하라.
- 코드 내용을 검증하고, 미래에 문제가 발생하지 않도록 막기 위해 필요한 test case가 완비되었는지 검사하라.
- 미래에 타 모듈의 기능 추가로 인해 검사 대상 코드의 기능과 성능에 영향을 받게 되었을 떄에 그 영향을 바로 Detect할 수 있도록 Test Case가 있는지 검사하라.
- Test Case로 찾아진 Issue가 있을 때에 CI가 Fail이 나서 해당 문제를 일으킨 코드가 Merge되지 않도록 막을 수 있는지 점검하라.
- ARCHITECTURE 변경을 일으키거나 API 변경이 있는 경우 그와 관련한 문서 수정이 PR 내에서 함께 이뤄지거나, 문서 수정이 이미 되어있는지 점검하라.
- 이슈가 있을 경우 이슈 심각성과 문제인 이유와 한께 PR에 Comment를 남긴다. 단, 타 Agent가 작성한 리뷰를 옮겨 적은 것임을 명시하라.
``` 



- 코드 작성에 대해서는 PR 작성 후 Reviewer와의 합의 과정이 필요하지만, PLAN 업데이트나 구현 진행 상황 문서 업데이트 에 대해서는 direct commit을 하라. (예를 들어 PLAN.md, STATE.json, CLAUDE.md 등) 이를 위해서 코드 작성 커밋과 이런 진행 상황 업데이트 커밋은 따로 만드는 것이 좋다.


# 로컬 빌드 / 테스트

본 저장소는 Node 20 LTS + pnpm 9 (ADR-0001) 환경을 가정한다. 처음 clone 후 실행 순서는 다음과 같다.

- `pnpm install` — 의존성 설치 (CI 에서는 `--frozen-lockfile` 사용).
- `pnpm lint` — ESLint 로 코드 스타일·정적 분석 검사.
- `pnpm build` — Nest 빌드 (TypeScript → `dist/`).
- `pnpm test` — Jest 로 unit / spec 테스트 실행.
- `pnpm test:cov` — Jest + coverage 측정. `package.json` 의 `coverageThreshold.global` (branches/functions/lines/statements 각 50%) 미달 시 jest 가 exit 1 → CI fail (T-0008).
- `pnpm test:smoke` — Smoke 테스트 (NestJS app 부트스트랩 + 핵심 endpoint 200 확인, `test/jest-smoke.json`). unit 과 격리되며 coverage 미수집 (T-0009). 의도: 빠른 healthcheck.
- `pnpm test:e2e` — E2E 테스트 (응답 contract + flow 검증, `test/jest-e2e.json`). unit / smoke 와 격리 (T-0010). 의도: status·header·body shape 까지 검증하는 회귀 anchor.
- `BASE_REF=origin/main bash scripts/check-spec-presence.sh` — 신규 production `.ts` 에 대응 spec 이 함께 추가됐는지 로컬에서 흉내내 검사 (CI 와 동일 규칙, T-0007).

CI (`.github/workflows/ci.yml`) 가 모든 PR 과 main push 마다 동일한 step 을 자동 실행한다. PR 의 CI 실패가 reviewer 점검 전에 명확히 보이도록 GitHub UI 에서 main branch protection rule (필수 status check: `기본 검사`) 을 활성화하는 것을 권장한다 (관리자 1회 수동 설정).

