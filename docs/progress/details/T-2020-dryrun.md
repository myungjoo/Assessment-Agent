# T-2020 — persons guard 임시 부착 dry-run 기록

- **실행하지 못했다.** executor 로컬에 PostgreSQL 이 없다 (`DATABASE_URL` 미설정). 3 spec 은 실 DB 를 쓰므로 `PersonController` 에 guard 를 임시로 붙여 돌려 볼 수 없었다. 임시 부착 코드도 만들지 않았다.
- 정적 확인으로 대신했다. `/api/persons` 호출 수와 `.set("Cookie"` 수가 같다 (smoke 9/9, persons e2e 11/11, continuation e2e 5/5). tier 는 api.md `79~83 행` 을 따른다.
- 실측은 CI `test:smoke` · `test:e2e` 와 persons guard 배선 slice (Follow-ups ④) 의 e2e leg 가 맡는다.
