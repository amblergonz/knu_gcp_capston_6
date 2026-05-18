# BE-A 파트 개요 — Data Science

> 최종 업데이트: 2026-05-18

---

## 1. 한 줄 요약

**"어떤 행동이 이탈 징후인가?"를 데이터로 증명하고, 시스템이 사용 할 판단 기준값을 산출한다.**

---

## 2. 팀 내 역할

```
[BE-A 분석 결과]
       │
       ▼
thresholds.yml ──→ [BE-C Stream Worker가 읽어서 판단]
                          │
                    "이 사람 이탈 의도 있음"
                          │
                    [FE 팝업 표시]
```

BE-A는 코드를 직접 실행하는 서버를 만드는 게 아니라, **BE-C가 판단할 때 쓰는 기준값을 데이터로 뽑아내는 역할**이다.  
`packages/shared/config/thresholds.yml`이 BE-A의 핵심 산출물이다.

---

## 3. 담당 파일

```
notebooks/
├── 01_retailrocket_eda.ipynb       # Retailrocket 데이터 탐색
├── 02_otto_eda.ipynb               # OTTO 데이터 탐색 (데이터 확보 후 실행)
├── 03_feature_engineering.ipynb    # Feature별 구매 영향력 분석
├── 04_ab_synthetic.ipynb           # 합성 A/B 통계 검정 + FP Rate
├── data/                           # 원본 데이터셋 (gitignore)
└── outputs/                        # 분석 결과 도표·CSV

packages/shared/config/
└── thresholds.yml                  # ★ 핵심 산출물

packages/data-science/
├── main.py                         # FastAPI 모델 서빙 (port 8000)
└── requirements.txt

docs/be-a/
├── REPORT_DATA_CHAPTER.md          # 보고서 4장 초안
├── CHECKLIST.md                    # W1~W8 작업 체크리스트
├── PROGRESS.md                     # 진행 트래커
└── TODO.md                         # 직접 실행해야 할 항목
```

---

## 4. 사용 데이터셋

| 데이터셋 | 크기 | 기간 | 용도 |
|---|---|---|---|
| Retailrocket Recommender System | 280만 이벤트, 140만 사용자 | 2015.05~09 | 임계값 산출 메인 데이터 |
| OTTO Recommender Systems | 2.2억 이벤트 (12GB) | — | 교차 검증 (데이터 확보 후) |

**한계**: 두 데이터셋 모두 일반 이커머스. 호텔 예약 특유의 행동(날짜 변경, 객실 비교)과 본 시스템 핵심 신호(클립보드 복사, 탭 전환)가 없음.

---

## 5. 완료된 분석 결과

### W1 — Retailrocket EDA

| 지표 | 수치 |
|---|---|
| 전체 이벤트 | 2,756,101건 |
| 고유 사용자 | 1,407,580명 |
| 고유 세션 | 1,761,675개 |
| view → addtocart 전환율 | 2.60% |
| addtocart → transaction 전환율 | 32.39% |
| **카트 후 이탈율** | **67.61%** → 개입 대상 |

### W2 — S1 임계값 산출 (`tab_hidden_seconds`)

카트 추가 후 경과 시간별 누적 전환율 분석.

- 10초 시점에서 전환율 증가 속도가 급감 → **변곡점**
- `tab_hidden_seconds`: 30 → **10** 으로 갱신

### W3 — Feature Engineering (booster_weights)

| Feature | 대응 부스터 | Lift | 가중치 변경 |
|---|---|---|---|
| `is_long_session` (5분+) | `session_length_5min` | **32.19x** | 0.1 → **0.4** |
| `item_revisit_count > 0` | `hidden_repeated` | **8.76x** | 0.1 → **0.4** |
| clipboard, broadcast, referrer | 동일 | 데이터 없음 | 도메인 직관 유지 |

### W5 — 합성 A/B 검정 + FP Rate

| 지표 | 결과 | 목표 |
|---|---|---|
| FP Rate | **0.0%** | < 15% ✅ |
| Precision | 100.0% | — |
| Treatment 전환율 | 0.786% | — |
| Control 전환율 | 0.722% | — |
| Uplift | +8.95% | — |

→ `intent_score_min: 0.6` 현재 값 유지 결정

---

## 6. thresholds.yml 최종값

```yaml
scenarios:
  S1:
    base_match:
      cart_min_count: 1
      tab_hidden_seconds: 10       # 데이터 근거
    intent_score_min: 0.6          # A/B 검증 완료
    cooldown_seconds: 86400

booster_weights:
  clipboard_copy_match: 0.4        # 도메인 직관
  broadcast_channel_multi_tab: 0.4 # 도메인 직관
  referrer_price_compare: 0.2      # 도메인 직관
  session_length_5min: 0.4         # lift=32.19x
  hidden_repeated: 0.4             # lift=8.76x
```

---

## 7. FastAPI 모델 서버 (port 8000)

```bash
cd packages/data-science
python -m uvicorn main:app --host 0.0.0.0 --port 8000
```

| 엔드포인트 | 설명 | 상태 |
|---|---|---|
| `GET /health` | 헬스체크 | ✅ |
| `GET /thresholds` | 현재 thresholds.yml 반환 | ✅ |
| `POST /predict` | 세션 feature → 이탈 확률 | ⚠️ 미학습 (0.0 반환) |

`/predict`는 XGBoost 학습 완료 후 실제 추론 로직으로 교체 예정 (Stretch).

---

## 8. 남은 작업

| 주차 | 마감 | 내용 |
|---|---|---|
| W6 | 6/12 | 발표용 도표 스타일 통일 |
| W8 | 6/26 | 발표 슬라이드 4~5장 |
| Stretch | — | XGBoost 학습 + `/predict` 실제 추론 |
