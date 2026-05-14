# 4장. 데이터 분석

## 4.1 데이터셋 개요

본 프로젝트의 실시간 개입 임계값 산출을 위해 Retailrocket Recommender System Dataset(Kaggle)을 사용하였다.

| 항목 | 내용 |
|---|---|
| 출처 | Kaggle — Retailrocket Recommender System Dataset |
| 기간 | 2015년 5월 ~ 2015년 9월 (약 4개월) |
| 전체 이벤트 수 | 2,756,101건 |
| 고유 사용자 수 | 1,407,580명 |
| 고유 세션 수 | 1,761,675개 |
| 이벤트 유형 | view / addtocart / transaction |

> **한계**: Retailrocket은 일반 이커머스 데이터로, 호텔 예약 도메인과 직접적인 매핑에는 한계가 있다. 클립보드 복사·탭 전환 등 본 시스템의 핵심 신호가 포함되어 있지 않아, 해당 부스터 가중치는 도메인 직관으로 설정하였다.

---

## 4.2 구매 전환 깔때기 (Funnel)

사용자 행동은 view → addtocart → transaction의 3단계 깔때기 구조를 따른다.

| 단계 | 세션 수 | 전환율 |
|---|---|---|
| view (조회) | 1,669,053 | 100% |
| addtocart (카트 추가) | 43,487 | 2.60% |
| transaction (구매) | 14,088 | 32.39% (카트 기준) |

view → addtocart 전환율이 2.60%로 낮고, 카트에 담은 후 구매까지 이어지는 비율은 32.39%이다. 즉, **카트에 담은 사용자의 약 68%는 이탈**하며, 이들이 본 시스템의 핵심 개입 대상이다.

---

## 4.3 S1 임계값 산출 (tab_hidden_seconds)

### 분석 방법

카트 추가 이벤트 발생 후 경과 시간별 누적 구매 전환율을 5초 단위로 측정하였다. 5초당 전환율 증가분이 0.05% 미만으로 평탄해지는 첫 지점을 변곡점으로 정의하였다.

### 결과

![카트 후 전환율 곡선](../notebooks/outputs/cart_to_conversion_curve.png)

| 항목 | 값 |
|---|---|
| 분석 기준 | 카트 추가 후 N초 이내 구매 전환율 |
| 변곡점 (RECOMMENDED_N) | **10초** |
| 기존 설정값 | 30초 |
| 갱신값 | **10초** |

카트 추가 후 10초 시점에서 전환율 증가 속도가 급격히 감소한다. 즉, 10초 이상 탭을 이탈한 사용자는 즉각 구매 의도가 낮아진 것으로 판단할 수 있으며, 이 시점에 개입하는 것이 효과적이다.

---

## 4.4 부스터 가중치 산출 (Feature Engineering)

### 분석 방법

세션 단위로 6개 feature를 계산하고, 각 feature와 구매(transaction) 간의 lift 및 상관계수를 측정하였다.

| Feature | 설명 | 대응 부스터 |
|---|---|---|
| session_duration_sec | 세션 총 지속 시간 (초) | session_length_5min |
| event_count | 세션 내 총 이벤트 수 | — |
| view_count | 조회 이벤트 수 | — |
| cart_count | 카트 추가 횟수 | — |
| item_revisit_count | 동일 아이템 재조회 횟수 | hidden_repeated |
| avg_event_interval_sec | 이벤트 간 평균 간격 (초) | — |

### 결과

![Feature별 구매율](../notebooks/outputs/feature_purchase_rate.png)

![상관관계 히트맵](../notebooks/outputs/feature_correlation.png)

#### session_length_5min (세션 5분 이상)

| | 구매율 |
|---|---|
| 5분 이상 세션 | 높음 |
| 5분 미만 세션 | 낮음 |
| **Lift** | **32.19x** |

세션이 5분 이상 지속된 경우 구매율이 32배 이상 높아, 해당 부스터의 유효성이 강하게 확인되었다.

#### hidden_repeated (아이템 재조회)

| | 구매율 |
|---|---|
| 재조회 있음 | 높음 |
| 재조회 없음 | 낮음 |
| **Lift** | **8.76x** |

동일 아이템을 반복 조회한 세션의 구매율이 8.76배 높아, 비교 행동과 구매 의도 간 강한 상관관계가 확인되었다.

### 최종 부스터 가중치

![부스터 가중치 비교](../notebooks/outputs/booster_weights.png)

| 부스터 | 근거 | 기존 | 최종 |
|---|---|---|---|
| clipboard_copy_match | 도메인 직관 (데이터 없음) | 0.4 | **0.4** |
| broadcast_channel_multi_tab | 도메인 직관 (데이터 없음) | 0.4 | **0.4** |
| referrer_price_compare | 도메인 직관 | 0.2 | **0.2** |
| session_length_5min | lift=32.19x | 0.1 | **0.4** |
| hidden_repeated | lift=8.76x | 0.1 | **0.4** |

---

## 4.5 분석 한계 및 향후 과제

### 한계

1. **도메인 불일치**: Retailrocket은 일반 이커머스 데이터로 호텔 예약 특유의 행동 패턴(날짜 변경, 객실 옵션 비교)이 포함되지 않는다.
2. **핵심 신호 부재**: 클립보드 복사(`clipboard_copy_match`), 다중 탭 감지(`broadcast_channel_multi_tab`) 이벤트가 데이터셋에 없어 해당 가중치는 도메인 직관으로 유지하였다.
3. **샘플링**: 계산 효율을 위해 전체 방문자의 10%를 샘플링하였다. 전체 데이터 분석 결과와 통계적으로 동등함을 확인하였다.

### 향후 과제

- 실 호텔 사이트 로그 데이터로 임계값 재검증
- A/B 테스트 결과 기반 가중치 미세조정
- XGBoost 모델 학습을 통한 규칙 기반 → ML 기반 전환 (Stretch)
