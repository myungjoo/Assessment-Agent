# 실데이터 규모 검증 dataset — nnstreamer + nntrainer + Samsung 활성 개발자

> 오너 지시(2026-07-30)로 준비한 **R-91 규모 검증용 실데이터 개발자 집합**. github.com 공개 활동.
> 스냅샷 2026-07-30 (gh search). 봇 제외. **raw 미저장(R-59)** — 원본 미보관, 평가 결과만.

## ✅ 규모 — 총 133명 (R-91 목표 100~200명 충족)

- **A. nnstreamer + nntrainer**: 2026 PR 1+ 작성자 **33명**
- **B. Samsung org**: 최근 1년(2025-07-30~2026-07-30) 활동 **top 100명** (org 총 252 활성자 중 PR수 상위 100, 273~4 PR)
- A ∩ B 중복 **0** → 합집합 **133명**

seed 방식: 각 개발자 = Person + github.com `ServiceIdentity`(login) → `assessment-collection` 실 수집 → 평가 → R-91 규모/부하 검증(k6, ADR-0054) 실 표본. github 수집은 배포기기 PAT(실데이터 gating) 사용.

## A. nnstreamer + nntrainer (2026 PR 1+ 작성자, 33명)

| github login | nnstreamer | nntrainer | 2026 PR |
|---|---:|---:|---:|
| jijoongmoon | 0 | 117 | 117 |
| EunjuYang | 0 | 82 | 82 |
| myungjoo | 67 | 5 | 72 |
| jaemini-shin | 0 | 70 | 70 |
| baek2sm | 0 | 53 | 53 |
| Jungwon-Lee | 0 | 48 | 48 |
| Seunghui98 | 0 | 42 | 42 |
| jayden0701 | 0 | 37 | 37 |
| jaeyun-jung | 20 | 0 | 20 |
| dlwlzzero | 0 | 19 | 19 |
| junbong-yu | 0 | 17 | 17 |
| haehun | 0 | 13 | 13 |
| b-saianirud | 0 | 12 | 12 |
| niket-agarwal | 0 | 11 | 11 |
| lhs8928 | 0 | 11 | 11 |
| anyj0527 | 10 | 0 | 10 |
| sumon-98 | 0 | 8 | 8 |
| prachi-t17 | 0 | 7 | 7 |
| h0g1 | 0 | 7 | 7 |
| YongHyeon02 | 0 | 7 | 7 |
| pranjal-nntrainer | 0 | 6 | 6 |
| sachin-nntrainer | 0 | 5 | 5 |
| again4you | 5 | 0 | 5 |
| dkjung | 0 | 4 | 4 |
| anupSnap21530358 | 0 | 3 | 3 |
| ramees-t | 0 | 2 | 2 |
| jeewookp | 0 | 2 | 2 |
| ankit-mh | 0 | 2 | 2 |
| wooksong | 0 | 1 | 1 |
| songgot | 1 | 0 | 1 |
| pallaviNNT | 0 | 1 | 1 |
| KWSMooBang | 0 | 1 | 1 |
| DonghakPark | 0 | 1 | 1 |

## B. Samsung org (최근 1년 활동 top 100 — PR수 내림차순)

| github login | 최근1년 PR |
|---|---:|
| mhs4670go                | 273 |
| hseok-oh                 | 249 |
| babenek                  | 180 |
| seanshpark               | 120 |
| hinohie                  | 119 |
| jykeon                   | 100 |
| stamalakhov              | 90 |
| seokhun-eom24            | 80 |
| ksh8281                  | 79 |
| JoonghyunCho             | 72 |
| zherczeg                 | 56 |
| shs-park                 | 48 |
| dvsav                    | 47 |
| JoogabYun                | 46 |
| dongsug-song             | 45 |
| ewoodev                  | 39 |
| Poly-J                   | 36 |
| arkq                     | 35 |
| dayo09                   | 34 |
| kulcsaradam              | 33 |
| huayongxu                | 33 |
| sgchoi5                  | 32 |
| glistening               | 30 |
| abhinav-s235             | 30 |
| hsgwon                   | 26 |
| upple                    | 24 |
| namanjain7               | 24 |
| kdk3776                  | 23 |
| Torrero                  | 23 |
| Hyeon-Uk                 | 23 |
| seockho-kim              | 20 |
| pcs1265                  | 19 |
| giwon-nam                | 19 |
| zhongnuo-tang            | 18 |
| wonrst                   | 18 |
| jinevening               | 18 |
| gidori98                 | 18 |
| bshsqa                   | 18 |
| batcheu                  | 18 |
| ziyik                    | 17 |
| newb1e-kim               | 17 |
| jylee9613                | 17 |
| vivek1-j                 | 16 |
| ZivLow                   | 16 |
| matetokodi               | 15 |
| rish-sg                  | 13 |
| jwei5                    | 13 |
| Taejun-Kwon              | 13 |
| theojin                  | 12 |
| llFreetimell             | 12 |
| ziliguo                  | 11 |
| hjhun                    | 11 |
| chunseoklee              | 11 |
| o-kopysov                | 10 |
| lingzhou2018             | 10 |
| hs0225                   | 10 |
| daeyeon                  | 10 |
| amandeep-samsung         | 10 |
| winstone77               | 9 |
| xiaotao-yuan             | 8 |
| tomdol                   | 8 |
| periannath               | 8 |
| mihashco                 | 8 |
| kwonjeomsim              | 8 |
| joan-juyeon              | 8 |
| clover2123               | 8 |
| arthur-flam              | 8 |
| mukku-suneel             | 7 |
| k-dovgan                 | 7 |
| junimnjw                 | 7 |
| jeesunhub                | 7 |
| jaehyun0cho              | 7 |
| hyraxbyerax              | 7 |
| Luca388                  | 7 |
| yeetee179                | 6 |
| seungsoo47               | 6 |
| rajat-samsung            | 6 |
| pkosko                   | 6 |
| jinbongLee               | 6 |
| iRoy7                    | 6 |
| hk-gwak                  | 6 |
| germonado                | 6 |
| dahlinPL                 | 6 |
| Inhong                   | 6 |
| GustavEikaas             | 6 |
| wangyin-aclsemi          | 5 |
| tscholb                  | 5 |
| monoamind                | 5 |
| mbloch1                  | 5 |
| ivmai                    | 5 |
| dr-venkman               | 5 |
| anjana348                | 5 |
| SangyounKwak             | 5 |
| MyoungJunePark           | 5 |
| ANZ1217                  | 5 |
| ul24                     | 4 |
| terry2000s               | 4 |
| sparrow74                | 4 |
| sahilnara99              | 4 |
| safir-srbd               | 4 |

## 재생성(refresh) 명령

```bash
# A
gh search prs --owner nnstreamer --created 2026-01-01..2026-12-31 --limit 1000 --json author --jq '.[].author.login' | sort -u
gh search prs --owner nntrainer  --created 2026-01-01..2026-12-31 --limit 1000 --json author --jq '.[].author.login' | sort -u
# B — Samsung org 은 1년 PR 3211건이라 시간창 6분할로 전량 집계 후 봇 제외 top100
for w in 2025-07-30..2025-09-30 2025-10-01..2025-11-30 2025-12-01..2026-01-31 2026-02-01..2026-03-31 2026-04-01..2026-05-31 2026-06-01..2026-07-30; do
  gh search prs --owner Samsung --created "$w" --limit 1000 --json author --jq '.[].author.login'
done | grep -viE '\[bot\]$|bot$' | sort | uniq -c | sort -rn | head -100
```

> 봇 필터: `[bot]` suffix + `*bot` + dependabot/actions-user/github-actions/web-flow 제외.
> 시간창은 각 <1000건이라 undersample 없음(856+583+342+481+536+413=3211 전량).
