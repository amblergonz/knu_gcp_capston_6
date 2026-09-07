# BE-A 작업 체크리스트 (바이브코딩용)

>**본 문서는 BE-A가 W1~W8 동안 그대로 따라가는 실행 가이드입니다.**
>각 작업은 "무엇을 / 왜 / 어떻게 / 검증" 4단계로 구성되며, 코드 시작점도 포함합니다. AI(Claude/GPT/Gemini)에게 작업을 부탁할 때 그대로 복사·붙여넣기 할 수 있도록 작성되었습니다.

---

## 0. 시작 전 준비 (5/8 회의 직후 ~ 5/9)

### 0.1 개발 환경 셋업

- [ ] **Python 3.11 설치 확인**
  ```bash
  python3 --version  # 3.11+ 확인
  ```
- [ ] **가상환경 생성**
  ```bash
  cd hover/  # 모노레포 루트 (BE-C가 생성)
  python3 -m venv .venv
  source .venv/bin/activate  # Windows: .venv\Scripts\activate
  ```
- [ ] **필수 라이브러리 설치**
  ```bash
  pip install pandas numpy matplotlib seaborn jupyter \
              scikit-learn scipy plotly
  pip freeze > notebooks/requirements.txt
  ```
- [ ] **Jupyter 동작 확인**
  ```bash
  jupyter notebook  # 브라우저에서 열림
  ```

### 0.2 디렉토리 구조 생성

- [ ] **notebooks/ 디렉토리 만들기** (모노레포 루트에)
  ```
  hover/
  ├── notebooks/
  │   ├── data/                  # 다운로드한 데이터셋
  │   ├── outputs/                # 생성한 도표·CSV
  │   ├── requirements.txt
  │   ├── 01_retailrocket_eda.ipynb
  │   ├── 02_otto_eda.ipynb
  │   ├── 03_feature_engineering.ipynb
  │   ├── 04_ab_synthetic.ipynb
  │   └── 05_xgboost_model.ipynb  # Stretch
  ├── shared/
  │   └── config/
  │       └── thresholds.yml      # BE-C가 W1에 생성, BE-A가 PR로 갱신
  └── ...
  ```
- [ ] **.gitignore에 추가**
  ```
  notebooks/data/
  notebooks/.ipynb_checkpoints/
  .venv/
  __pycache__/
  ```

### 0.3 Kaggle 계정 + API 키

- [ ] Kaggle 가입 (https://www.kaggle.com)
- [ ] Account → Create New API Token → `kaggle.json` 다운로드
- [ ] `~/.kaggle/kaggle.json`에 저장 후 권한 설정
  ```bash
  mkdir -p ~/.kaggle
  mv ~/Downloads/kaggle.json ~/.kaggle/
  chmod 600 ~/.kaggle/kaggle.json
  pip install kaggle
  ```

### 0.4 데이터셋 다운로드

- [ ] **Retailrocket Recommender System Dataset** (~700MB)
  ```bash
  cd notebooks/data
  kaggle datasets download -d retailrocket/ecommerce-dataset
  unzip ecommerce-dataset.zip
  # 결과: events.csv, item_properties_part1.csv, item_properties_part2.csv, category_tree.csv
  ```

- [ ] **OTTO Recommender Systems Dataset** (~12GB, subset만 받을 수도 있음)
  ```bash
  kaggle competitions download -c otto-recommender-system
  unzip otto-recommender-system.zip
  ```
 > 너무 크면 W2까지 일단 Retailrocket만 가지고 시작해도 됨

- [ ] **(선택) GA4 Obfuscated Sample Data** — BigQuery 퍼블릭 데이터셋
  - Retailrocket으로 W2 PR이 충분하면 GA4는 스킵 가능

### 0.5 BE-C와 인터페이스 합의 (W1 첫 주)

- [ ] **`shared/config/thresholds.yml` 임시값 확인** (BE-C가 W1에 머지)
  ```yaml
  # BE-A가 PR로 갱신할 항목들
  scenarios:
    S1:
      base_match:
        cart_min_count: 1
        tab_hidden_seconds: 30   # ← W2 PR #1에서 갱신
      intent_score_min: 0.6      # ← W4 PR #2에서 갱신
  booster_weights:
    clipboard_copy_match: 0.4    # ← W4 PR #2에서 갱신
    broadcast_channel_multi_tab: 0.4
    referrer_price_compare: 0.2
    session_length_5min: 0.1
    hidden_repeated: 0.1
  ```
- [ ] **PR 절차 합의**: BE-A가 PR 제출 → BE-C 리뷰 → 머지 → Worker 재기동

---

## 1. W1 — Retailrocket EDA (1차)

>**마감: 5/13 (진행도 공유 미팅 전)**
>**결과물: `notebooks/01_retailrocket_eda.ipynb` + 도표 5개**

### 1.1 데이터 로딩 및 검증

#### 무엇을
Retailrocket events.csv를 Pandas로 로드, 컬럼·타입·이상치 확인

#### 왜
- 분석 전제: 데이터 모양·결측치 파악 없이 분석하면 거짓 결론 위험
- 발표 시 "데이터 크기 X행, 사용자 Y명" 같은 숫자 필요

#### 어떻게
- [ ] 1단계: events.csv 로드
  ```python
  import pandas as pd
  events = pd.read_csv('data/events.csv')
  print(events.shape)
  print(events.dtypes)
  print(events.head())
  ```
- [ ] 2단계: 기초 통계
  ```python
  print(f"Total events: {len(events):,}")
  print(f"Unique visitors: {events['visitorid'].nunique():,}")
  print(f"Unique items: {events['itemid'].nunique():,}")
  print(f"Event types: {events['event'].value_counts()}")
  print(f"Date range: {pd.to_datetime(events['timestamp'], unit='ms').min()} ~ "
        f"{pd.to_datetime(events['timestamp'], unit='ms').max()}")
  ```
- [ ] 3단계: 결측치·이상치 검출
  ```python
  print(events.isnull().sum())
  # transactionid는 transaction 이벤트에만 있는 게 정상
  ```
- [ ] 4단계: timestamp를 datetime으로 변환
  ```python
  events['datetime'] = pd.to_datetime(events['timestamp'], unit='ms')
  events = events.sort_values(['visitorid', 'timestamp']).reset_index(drop=True)
  ```

#### 검증
- [ ] events 행 수가 ~2,756,101 근처
- [ ] visitor 수가 ~1,407,580 근처
- [ ] event 타입 3종(view, addtocart, transaction)
- [ ] 결측치 없음 (transactionid 제외)

---

### 1.2 세션 분리 (30분 inactivity 기준)

#### 무엇을
연속된 이벤트를 "세션" 단위로 분리. 동일 visitor의 이벤트들 사이 간격이 30분 이상이면 새 세션.

#### 왜
- 우리 시스템도 세션 단위로 동작 (Redis TTL 30분)
- 분석 단위가 세션이어야 "카트→이탈 시간" 같은 메트릭 계산 가능

#### 어떻게
- [ ] 5단계: 세션 ID 부여
  ```python
  SESSION_GAP_MS = 30 * 60 * 1000  # 30분

  events['time_diff'] = events.groupby('visitorid')['timestamp'].diff()
  events['new_session'] = (events['time_diff'] > SESSION_GAP_MS) | events['time_diff'].isna()
  events['session_num'] = events.groupby('visitorid')['new_session'].cumsum()
  events['session_id'] = events['visitorid'].astype(str) + '_' + events['session_num'].astype(str)
  ```
- [ ] 6단계: 세션 단위 집계
  ```python
  session_stats = events.groupby('session_id').agg(
      visitor_id=('visitorid', 'first'),
      start_ts=('timestamp', 'min'),
      end_ts=('timestamp', 'max'),
      event_count=('event', 'count'),
      has_view=('event', lambda x: (x == 'view').any()),
      has_addtocart=('event', lambda x: (x == 'addtocart').any()),
      has_transaction=('event', lambda x: (x == 'transaction').any())
  )
  session_stats['duration_sec'] = (session_stats['end_ts'] - session_stats['start_ts']) / 1000
  print(f"Total sessions: {len(session_stats):,}")
  print(f"Sessions with cart: {session_stats['has_addtocart'].sum():,}")
  print(f"Sessions with purchase: {session_stats['has_transaction'].sum():,}")
  ```

#### 검증
- [ ] 세션당 평균 이벤트 수 출력 (참고: 보통 3~10건)
- [ ] 세션 duration 분포 plot — 대부분 짧고 long-tail 형태일 것
- [ ] addtocart 세션 비율 ~5~10% 정도 예상

---

### 1.3  카트→이탈 시간 분포 분석 (가장 중요)

#### 무엇을
"카트에 담은 후 N분 이내에 transaction(구매)이 일어났는가" 분석. **이게 S1 임계값 `tab_hidden_seconds` 산출의 근거.**

#### 왜
- BE-C의 S1 룰: "카트 ≥ 1 AND 탭 hidden_for ≥ N초" — N을 데이터로 정해야 함
- 너무 짧으면 FP↑ (그냥 잠깐 본 사용자), 너무 길면 놓침

#### 어떻게
- [ ] 7단계: 카트 추가 → 다음 행동까지 시간
  ```python
  # addtocart 이벤트 시점 기준
  cart_events = events[events['event'] == 'addtocart'].copy()
  cart_events = cart_events.rename(columns={'timestamp': 'cart_ts'})

  # 같은 세션 내에서 카트 이후 발생한 모든 이벤트
  events_after_cart = events.merge(
      cart_events[['session_id', 'cart_ts']],
      on='session_id'
  )
  events_after_cart = events_after_cart[events_after_cart['timestamp'] > events_after_cart['cart_ts']]
  events_after_cart['time_since_cart_sec'] = (
      events_after_cart['timestamp'] - events_after_cart['cart_ts']
  ) / 1000
  ```
- [ ] 8단계: 시간대별 transaction 비율
  ```python
  import numpy as np

  # 카트 추가한 세션 중 N초 이내에 구매한 비율
  cart_sessions = cart_events['session_id'].unique()
  buckets = [10, 30, 60, 120, 300, 600, 1800, 3600]  # 초 단위

  results = []
  for bucket in buckets:
      txns_within = events_after_cart[
          (events_after_cart['session_id'].isin(cart_sessions)) &
          (events_after_cart['event'] == 'transaction') &
          (events_after_cart['time_since_cart_sec'] <= bucket)
      ]['session_id'].nunique()

      pct = txns_within / len(cart_sessions) * 100
      results.append({'within_sec': bucket, 'txn_pct': pct})

  df_results = pd.DataFrame(results)
  print(df_results)
  ```
- [ ] 9단계: 시각화 — 누적 구매 비율 곡선
  ```python
  import matplotlib.pyplot as plt

  fig, ax = plt.subplots(figsize=(10, 6))
  ax.plot(df_results['within_sec'], df_results['txn_pct'], marker='o', linewidth=2)
  ax.set_xscale('log')
  ax.set_xlabel('카트 추가 후 경과 시간 (초)')
  ax.set_ylabel('전환율 (%)')
  ax.set_title('카트 추가 후 시간별 누적 전환율')
  ax.axvline(x=30, color='red', linestyle='--', label='S1 임계값 후보 30초')
  ax.legend()
  ax.grid(True, alpha=0.3)
  plt.savefig('outputs/cart_to_conversion_curve.png', dpi=150, bbox_inches='tight')
  plt.show()
  ```
- [ ] 10단계: **임계값 N 권장값 산출**
  ```python
  # "이 시점을 넘으면 이탈할 확률이 높아진다"의 변곡점 찾기
  # 방법: 1차 미분이 평탄해지는 지점

  # 더 세밀한 bucket으로
  fine_buckets = list(range(5, 600, 5))  # 5초 ~ 10분, 5초 단위
  fine_results = []
  for bucket in fine_buckets:
      txns_within = events_after_cart[
          (events_after_cart['session_id'].isin(cart_sessions)) &
          (events_after_cart['event'] == 'transaction') &
          (events_after_cart['time_since_cart_sec'] <= bucket)
      ]['session_id'].nunique()
      pct = txns_within / len(cart_sessions) * 100
      fine_results.append({'sec': bucket, 'pct': pct})

  df_fine = pd.DataFrame(fine_results)
  df_fine['delta'] = df_fine['pct'].diff()

  # 증가율이 평탄해지는 지점 = N 후보
  print(df_fine[df_fine['delta'] < 0.1].head())

  # 보고서용 최종 추천 N
  RECOMMENDED_N = 30  # 임시. 실제로는 위 분석 결과 보고 결정
  print(f"\n 추천 임계값 N = {RECOMMENDED_N}초")
  print(f"   이 시점까지의 전환율: {df_fine[df_fine['sec'] == RECOMMENDED_N]['pct'].values[0]:.1f}%")
  ```

#### 검증
- [ ] 곡선이 S자 또는 로그 형태 (초반 급증 → 후반 평탄)
- [ ] N=30초 시점의 전환율이 50% 이상이어야 "카트 후 30초 안 산 사람은 이탈 위험"이라는 논리 성립
- [ ] 그래프 PNG 저장됨 (`outputs/cart_to_conversion_curve.png`)

---

### 1.4 세션 길이 분포

#### 무엇을
세션이 얼마나 오래 지속되는지 분포 분석

#### 왜
- 부스터 가중치 `session_length_5min` 결정의 근거 (5분이 적절한 임계?)
- 발표 자료용 기본 통계

#### 어떻게
- [ ] 11단계: 세션 duration 분포
  ```python
  fig, axes = plt.subplots(1, 2, figsize=(14, 5))

  # 전체 세션
  axes[0].hist(session_stats['duration_sec'], bins=100, range=(0, 3600))
  axes[0].set_xlabel('세션 길이 (초)')
  axes[0].set_ylabel('빈도')
  axes[0].set_title('전체 세션 길이 분포')
  axes[0].axvline(x=300, color='red', linestyle='--', label='5분')
  axes[0].legend()

  # 카트 추가 세션만
  cart_sessions_df = session_stats[session_stats['has_addtocart']]
  axes[1].hist(cart_sessions_df['duration_sec'], bins=100, range=(0, 3600))
  axes[1].set_xlabel('세션 길이 (초)')
  axes[1].set_ylabel('빈도')
  axes[1].set_title('카트 추가한 세션 길이 분포')
  axes[1].axvline(x=300, color='red', linestyle='--', label='5분')
  axes[1].legend()

  plt.tight_layout()
  plt.savefig('outputs/session_duration_dist.png', dpi=150, bbox_inches='tight')
  plt.show()
  ```
- [ ] 12단계: 5분 이상 세션의 구매율
  ```python
  long_sessions = session_stats[session_stats['duration_sec'] >= 300]
  short_sessions = session_stats[session_stats['duration_sec'] < 300]

  print(f"5분 이상 세션 구매율: {long_sessions['has_transaction'].mean()*100:.2f}%")
  print(f"5분 미만 세션 구매율: {short_sessions['has_transaction'].mean()*100:.2f}%")
  # 5분 이상이 더 높으면 → 부스터 가중치 +0.1 정당화
  ```

#### 검증
- [ ] 5분 이상 세션의 구매율이 5분 미만 세션보다 명확히 높음
- [ ] 그래프 PNG 저장

---

### 1.5 이벤트 시퀀스 패턴

#### 무엇을
세션 내 이벤트가 어떤 순서로 일어나는지 패턴 분석 (view → cart → transaction이 표준 흐름)

#### 왜
- 우리 시스템이 잡아내는 행동 패턴 검증
- 발표 자료의 시각적 설명용

#### 어떻게
- [ ] 13단계: 세션별 이벤트 시퀀스 추출
  ```python
  sessions_seq = events.groupby('session_id').agg(
      seq=('event', lambda x: ' → '.join(x.tolist()[:5]))  # 처음 5개만
  ).reset_index()

  # 가장 흔한 시퀀스 Top 10
  top_seqs = sessions_seq['seq'].value_counts().head(10)
  print(top_seqs)
  ```
- [ ] 14단계: 깔때기(funnel) 시각화
  ```python
  funnel_data = {
      'view': events[events['event'] == 'view']['session_id'].nunique(),
      'addtocart': events[events['event'] == 'addtocart']['session_id'].nunique(),
      'transaction': events[events['event'] == 'transaction']['session_id'].nunique()
  }

  fig, ax = plt.subplots(figsize=(10, 6))
  stages = list(funnel_data.keys())
  values = list(funnel_data.values())
  ax.barh(stages, values, color=['#3498db', '#f39c12', '#27ae60'])
  for i, v in enumerate(values):
      ax.text(v, i, f' {v:,} ({v/values[0]*100:.1f}%)', va='center')
  ax.set_title('Retailrocket 이커머스 깔때기')
  ax.set_xlabel('세션 수')
  plt.savefig('outputs/funnel.png', dpi=150, bbox_inches='tight')
  plt.show()
  ```

#### 검증
- [ ] view → addtocart 전환율 ~5~15%
- [ ] addtocart → transaction 전환율 ~10~30%

---

### 1.6 노트북 마무리 및 인사이트 정리

- [ ] 15단계: 노트북 맨 위에 마크다운 셀로 "결론" 추가
  ```markdown
  # Retailrocket EDA — 결론 요약

  ## 핵심 발견
  1. 전체 X명 사용자, Y개 세션, Z개 이벤트
  2. 카트 후 30초 이내 전환율: __%
  3. 세션 5분 이상이면 구매 확률 __배 증가
  4. 표준 깔때기: view(100%) → cart(__%) → purchase(__%)

  ## thresholds.yml 권장 갱신값
  - `S1.tab_hidden_seconds`: 30 → **__** (근거: 이 시점이 변곡점)
  - `booster_weights.session_length_5min`: 0.1 유지 (유의미한 차이 확인)

  ## 한계
  - Retailrocket에는 우리 핵심 신호인 클립보드 복사·탭 전환 이벤트가 없음
  - 따라서 부스터 가중치(clipboard, broadcast_channel)는 도메인 직관으로 임시 설정
  - 호텔 도메인이 아닌 일반 이커머스 데이터 → 보고서에 매핑 한계 명시
  ```
- [ ] 16단계: outputs/ 폴더의 도표 4종 확인
  - `cart_to_conversion_curve.png`
  - `session_duration_dist.png`
  - `funnel.png`
  - (추가) `event_type_counts.png` — 첫 셀에서 만든 거 저장
- [ ] 17단계: 노트북 저장 및 commit
  ```bash
  git add notebooks/01_retailrocket_eda.ipynb notebooks/outputs/*.png
  git commit -m "feat(be-a): Retailrocket EDA 1차 — 카트 후 30초 전환율 분포"
  git push
  ```

---

## 2. W2 — thresholds.yml PR #1 제출

>**마감: 5/15 (W2 末)**
>**결과물: GitHub PR 1건 + 근거 그래프 첨부**

### 2.1 thresholds.yml 갱신

- [ ] 1단계: 별도 브랜치 생성
  ```bash
  git checkout -b be-a/thresholds-pr-1
  ```
- [ ] 2단계: `shared/config/thresholds.yml` 편집
  ```yaml
  scenarios:
    S1:
      base_match:
        cart_min_count: 1
        tab_hidden_seconds: 25  # ← 변경 (예시. 실제는 1.3 분석 결과로)
      intent_score_min: 0.6
      cooldown_seconds: 86400
  ```
- [ ] 3단계: 변경 사유 주석 추가
  ```yaml
  # CHANGELOG:
  # 2026-05-15 BE-A: tab_hidden_seconds 30 → 25
  #   근거: Retailrocket 분석상 카트 추가 후 25초 시점이 전환율 곡선의 변곡점
  #   참고: notebooks/01_retailrocket_eda.ipynb 1.3 섹션
  ```
- [ ] 4단계: commit + push
  ```bash
  git add shared/config/thresholds.yml
  git commit -m "chore(thresholds): S1.tab_hidden_seconds 30→25 (Retailrocket 분석)"
  git push origin be-a/thresholds-pr-1
  ```

### 2.2 PR 작성

- [ ] 5단계: GitHub PR 생성, 다음 템플릿 사용
  ```markdown
  ## thresholds.yml PR #1 — S1 임계값 갱신

  ### 변경 사항
  - `scenarios.S1.base_match.tab_hidden_seconds`: 30 → 25

  ### 근거
  Retailrocket events.csv 분석 결과, 카트 추가 후 25초 시점이 누적 전환율 곡선의 변곡점입니다. 이 시점을 넘기면 추가 전환율 증가가 5초당 0.1% 미만으로 평탄해집니다.

  ![cart_to_conversion_curve](../notebooks/outputs/cart_to_conversion_curve.png)

  ### 영향
  - BE-C: Stream Worker 재기동 시 자동 반영 (코드 변경 0)
  - 시뮬레이션 결과 변화 예상 — BE-B의 W4 시뮬에서 확인

  ### 참고
  - notebooks/01_retailrocket_eda.ipynb §1.3
  - 데이터: ~280만 이벤트, ~140만 사용자

  ### 검토 요청
  - [ ] BE-C: Worker hot-reload 확인
  - [ ] BE-B: 시뮬레이션 시 영향 인지
  ```
- [ ] 6단계: BE-C에게 리뷰 요청
- [ ] 7단계: 머지 후 본인 노트북 결론 부분에 "PR #1 머지 완료" 표시

---

## 3. W3 — Feature Engineering

>**마감: 5/22 (W3 末)**
>**결과물: `notebooks/03_feature_engineering.ipynb`**

### 3.1 세션 단위 feature 생성

#### 무엇을
각 세션별로 우리 시스템의 부스터 신호와 매핑되는 feature들을 계산

#### 왜
- W5 합성 A/B 통계 검정의 입력
- (Stretch) XGBoost 모델 학습 시 feature
- 부스터 가중치 튜닝의 근거

#### 어떻게
- [ ] 1단계: 노트북 시작
  ```python
  import pandas as pd
  import numpy as np

  events = pd.read_csv('data/events.csv')
  # 01번 노트북의 세션 분리 로직 재사용 (또는 모듈로 추출)
  ```
- [ ] 2단계: 8개 feature 계산
  ```python
  def compute_session_features(session_events):
      """한 세션의 이벤트들을 받아 feature 8개 반환"""
      session_events = session_events.sort_values('timestamp')

      # 기본 정보
      duration_sec = (session_events['timestamp'].max() - session_events['timestamp'].min()) / 1000
      event_count = len(session_events)

      # 우리 부스터와 매핑되는 feature
      feature = {
          'session_duration_sec': duration_sec,
          'event_count': event_count,
          'view_count': (session_events['event'] == 'view').sum(),
          'cart_count': (session_events['event'] == 'addtocart').sum(),

          # 비교 행동: 동일 아이템 짧은 시간 내 재조회
          'item_revisit_count': session_events.groupby('itemid').size().gt(1).sum(),

          # 평균 이벤트 간격 (망설임 지표)
          'avg_event_interval_sec': session_events['timestamp'].diff().mean() / 1000,

          # 세션이 5분 이상인가 (booster: session_length_5min)
          'is_long_session': duration_sec >= 300,

          # 라벨
          'has_purchase': (session_events['event'] == 'transaction').any()
      }
      return pd.Series(feature)

  # 적용 (오래 걸릴 수 있음 — 큰 데이터면 sample 먼저)
  sample_sessions = events['session_id'].drop_duplicates().sample(n=100_000, random_state=42)
  events_sample = events[events['session_id'].isin(sample_sessions)]

  features_df = events_sample.groupby('session_id').apply(compute_session_features)
  features_df.to_csv('outputs/session_features.csv')
  print(features_df.head())
  print(f"Shape: {features_df.shape}")
  ```

#### 검증
- [ ] features_df 행 수가 sample 세션 수와 일치
- [ ] `has_purchase` True인 행 비율이 1~5% 정도
- [ ] 결측치 없음

---

### 3.2 feature별 구매 영향력 분석

#### 무엇을
각 feature가 구매(transaction)에 얼마나 영향을 주는지 단변량 분석

#### 왜
- 부스터 가중치 튜닝의 직접 근거
- "왜 clipboard 가중치를 0.4로 정했나?"에 답하기 위함

#### 어떻게
- [ ] 3단계: 연속형 feature → 구매율 곡선
  ```python
  import matplotlib.pyplot as plt

  features_continuous = ['session_duration_sec', 'view_count', 'cart_count',
                          'item_revisit_count', 'avg_event_interval_sec']

  fig, axes = plt.subplots(2, 3, figsize=(15, 8))
  for i, feat in enumerate(features_continuous):
      ax = axes[i // 3, i % 3]
      # 구간별 구매율
      features_df[f'{feat}_bin'] = pd.qcut(features_df[feat], q=10, duplicates='drop')
      grouped = features_df.groupby(f'{feat}_bin', observed=True)['has_purchase'].mean() * 100
      ax.bar(range(len(grouped)), grouped.values)
      ax.set_xlabel(feat)
      ax.set_ylabel('구매율 (%)')
      ax.set_title(f'{feat} 구간별 구매율')
  plt.tight_layout()
  plt.savefig('outputs/feature_purchase_rate.png', dpi=150, bbox_inches='tight')
  plt.show()
  ```
- [ ] 4단계: 이진 feature → 구매율 비교
  ```python
  binary_features = ['is_long_session']
  for feat in binary_features:
      yes = features_df[features_df[feat] == True]['has_purchase'].mean() * 100
      no = features_df[features_df[feat] == False]['has_purchase'].mean() * 100
      lift = yes / no if no > 0 else None
      print(f"{feat}: True={yes:.2f}% vs False={no:.2f}% (lift={lift:.2f}x)")
  ```
- [ ] 5단계: 상관관계 히트맵
  ```python
  import seaborn as sns

  corr = features_df[features_continuous + ['has_purchase']].corr()
  fig, ax = plt.subplots(figsize=(10, 8))
  sns.heatmap(corr, annot=True, cmap='RdBu_r', center=0, fmt='.2f')
  plt.title('Feature 상관관계')
  plt.tight_layout()
  plt.savefig('outputs/feature_correlation.png', dpi=150, bbox_inches='tight')
  plt.show()
  ```

#### 검증
- [ ] `item_revisit_count`와 `has_purchase`가 양의 상관 (비교 행동 → 신중 → 구매 가능성↑)
- [ ] `is_long_session=True`의 lift가 1.5x 이상 (부스터 가중치 정당화)

---

### 3.3 부스터 가중치 튜닝 (반복적)

#### 무엇을
W4 PR #2를 위한 부스터 가중치 결정

#### 왜
- 현재 임시값(0.4·0.4·0.2·0.1·0.1)이 데이터 기반인지 확인
- 합성 시뮬에서 FP <15% 목표 달성하려면 데이터로 튜닝 필요

#### 어떻게
- [ ] 6단계: 우리 부스터와 Retailrocket feature 매핑 표 작성 (마크다운 셀에)
  ```markdown
 | 우리 부스터 | 대응 feature | 권장 가중치 | 근거 |
 |---|---|---|---|
 | clipboard_copy_match | (Retailrocket에 없음) | 0.4 유지 | 도메인 직관 |
 | broadcast_channel_multi_tab | (Retailrocket에 없음) | 0.4 유지 | 도메인 직관 |
 | referrer_price_compare | (별도 분석 필요 — GA4) | 0.2 유지 | — |
 | session_length_5min | is_long_session | 0.1 → ? | lift 분석 결과 반영 |
 | hidden_repeated | item_revisit_count | 0.1 → ? | 상관계수 반영 |
  ```
- [ ] 7단계: 가중치 권장값 산출
  - 단변량 영향력 비례 가중치 배분
  - 예: `is_long_session` lift가 2x면 0.1 → 0.15

#### 검증
- [ ] 가중치 합이 1.0을 넘지 않음 (현재 base 0 + 0.4+0.4+0.2+0.1+0.1 = 1.2 = OK)
- [ ] 각 가중치 변경에 근거 문서화

---

## 4. W4 — OTTO EDA + thresholds.yml PR #2

>**마감: 5/29 (W4 末)**
>**결과물: `notebooks/02_otto_eda.ipynb` + PR #2**

### 4.1 OTTO 데이터 로딩

- [ ] 1단계: OTTO 데이터셋은 parquet 형식
  ```python
  import pandas as pd

  # OTTO는 매우 큼 — 일단 train의 일부만 로드
  train = pd.read_parquet('data/otto/train.parquet')
  print(train.shape)  # 수억 행 가능
  print(train.head())
  print(train.dtypes)
  ```
- [ ] 2단계: 너무 크면 sample
  ```python
  # 100만 행만 sample
  if len(train) > 1_000_000:
      train_sample = train.sample(n=1_000_000, random_state=42)
  ```

### 4.2 세션 통계

- [ ] 3단계: 세션 길이·이벤트 분포 (Retailrocket과 동일 패턴)
  ```python
  # OTTO는 이미 session 컬럼 있음
  print(f"Unique sessions: {train_sample['session'].nunique():,}")
  print(f"Event types: {train_sample['type'].value_counts()}")

  session_stats_otto = train_sample.groupby('session').agg(
      event_count=('aid', 'count'),
      has_cart=('type', lambda x: 'cart' in x.values),
      has_order=('type', lambda x: 'order' in x.values)
  )
  print(session_stats_otto.describe())
  ```

### 4.3 호텔 도메인 매핑 가능성 논의 (마크다운)

- [ ] 4단계: 노트북 결론 셀에 한계 명시
  ```markdown
  ## OTTO 분석 결론

  ### 활용 가능성
  - 세션 기반 추천(다음 행동 예측)의 학계 표준 데이터
  - clicks/carts/orders 시퀀스로 구매 의도 예측 가능

  ### 호텔 도메인과의 격차
  - OTTO는 일반 이커머스 (상품 ID만 있고 카테고리 정보 없음)
  - 호텔 예약 특유의 행동(날짜 변경, 객실 옵션 비교)은 없음

  ### 본 프로젝트 활용
  - W5에 XGBoost 모델 학습 (Stretch): clicks → orders 예측
  - 우리 부스터 점수에 가중치 0.1~0.2로 추가하는 가능성 확인
  - 실패해도 메인 시스템(룰+부스터)은 영향 없음
  ```

### 4.4 thresholds.yml PR #2 작성

- [ ] 5단계: 새 브랜치
  ```bash
  git checkout -b be-a/thresholds-pr-2
  ```
- [ ] 6단계: thresholds.yml 갱신
  ```yaml
  booster_weights:
    clipboard_copy_match: 0.4       # 유지
    broadcast_channel_multi_tab: 0.4 # 유지
    referrer_price_compare: 0.2     # 유지
    session_length_5min: 0.15       # ← 변경 (Retailrocket lift 분석)
    hidden_repeated: 0.12           # ← 변경 (item_revisit 상관관계)
  ```
- [ ] 7단계: PR 작성 + 근거 그래프 첨부
  ```markdown
  ## thresholds.yml PR #2 — 부스터 가중치 튜닝

  ### 변경
  - `session_length_5min`: 0.1 → 0.15
  - `hidden_repeated`: 0.1 → 0.12

  ### 근거
  Retailrocket에서 `is_long_session=True`인 세션의 구매율이 False 대비 1.8배 (lift 1.8x).
  `item_revisit_count` 상관계수 0.12.

  ![feature_purchase_rate](../notebooks/outputs/feature_purchase_rate.png)
  ![feature_correlation](../notebooks/outputs/feature_correlation.png)

  ### 참고
  - notebooks/03_feature_engineering.ipynb §3.2

  ### 검토 요청
  - [ ] BE-C: Worker hot-reload
  - [ ] BE-B: 시뮬레이션 영향 측정
  ```

---

## 5. W5 — 합성 A/B 통계 검정 + (Stretch) XGBoost

>**마감: 6/5 (W5 末)**
>**결과물: `notebooks/04_ab_synthetic.ipynb` + PR #3**

### 5.1 BE-B 시뮬레이터 데이터 수령

- [ ] 1단계: BE-B에게 시뮬레이터 출력 데이터 요청
  ```
  - intent 라벨(comparison/distraction/browsing) 포함
  - intervention 발화 여부
  - control vs treatment 분리
  ```
- [ ] 2단계: ClickHouse에서 추출 (BE-B 협력)
  ```python
  # ClickHouse 클라이언트 (clickhouse-driver)
  pip install clickhouse-driver

  from clickhouse_driver import Client
  client = Client('localhost')

  # interventions + outcomes JOIN
  result = client.execute("""
      SELECT i.session_id, i.scenario_id, i.ab_group, i.shown, i.intent_score,
             o.final_state
      FROM interventions i
      LEFT JOIN outcomes o ON i.session_id = o.session_id
  """)
  df_ab = pd.DataFrame(result, columns=['session_id', 'scenario_id', 'ab_group',
                                          'shown', 'intent_score', 'final_state'])
  ```

### 5.2 A/B 통계 검정

- [ ] 3단계: 전환율 비교 + chi-square
  ```python
  from scipy import stats

  # treatment vs control 전환율
  treatment_conv = df_ab[df_ab['ab_group'] == 'treatment']['final_state'].eq('purchased').sum()
  treatment_total = (df_ab['ab_group'] == 'treatment').sum()
  control_conv = df_ab[df_ab['ab_group'] == 'control']['final_state'].eq('purchased').sum()
  control_total = (df_ab['ab_group'] == 'control').sum()

  # chi-square
  contingency = [[treatment_conv, treatment_total - treatment_conv],
                  [control_conv, control_total - control_conv]]
  chi2, p_value, _, _ = stats.chi2_contingency(contingency)

  print(f"Treatment 전환율: {treatment_conv/treatment_total*100:.2f}%")
  print(f"Control 전환율: {control_conv/control_total*100:.2f}%")
  print(f"p-value: {p_value:.4f} → {'유의함' if p_value < 0.05 else '유의하지 않음'}")
  ```
- [ ] 4단계: 시각화
  ```python
  fig, ax = plt.subplots(figsize=(8, 6))
  groups = ['Control', 'Treatment']
  rates = [control_conv/control_total*100, treatment_conv/treatment_total*100]
  ax.bar(groups, rates, color=['#95a5a6', '#27ae60'])
  for i, v in enumerate(rates):
      ax.text(i, v, f'{v:.2f}%', ha='center', va='bottom')
  ax.set_ylabel('전환율 (%)')
  ax.set_title(f'A/B 테스트 결과 (p={p_value:.4f})')
  plt.savefig('outputs/ab_test_result.png', dpi=150, bbox_inches='tight')
  ```

### 5.3  FP rate 측정 (핵심 성공 지표)

- [ ] 5단계: 의도 라벨별 발화율
  ```python
  # BE-B 시뮬레이터가 intent 라벨을 함께 제공해야 함
  # (시뮬 사용자별 intent를 outcomes 테이블 등에 저장)

  for intent in ['comparison', 'distraction', 'browsing']:
      mask = df_ab['intent_label'] == intent  # 컬럼 추가 필요
      fired = df_ab[mask]['shown'].sum()
      total = mask.sum()
      rate = fired / total * 100 if total > 0 else 0
      print(f"intent={intent}: {fired}/{total} = {rate:.2f}% 발화")

  # FP rate = (distraction + browsing 중 발화) / (distraction + browsing 총)
  non_comparison = df_ab[df_ab['intent_label'].isin(['distraction', 'browsing'])]
  fp_rate = non_comparison['shown'].mean() * 100
  print(f"\n FP rate = {fp_rate:.2f}% (목표: < 15%)")
  ```
- [ ] 6단계: FP rate < 15% 달성? 시각화
  ```python
  fig, ax = plt.subplots(figsize=(8, 6))
  intents = ['comparison', 'distraction', 'browsing']
  rates = []
  for intent in intents:
      mask = df_ab['intent_label'] == intent
      rate = df_ab[mask]['shown'].mean() * 100 if mask.sum() > 0 else 0
      rates.append(rate)

  colors = ['#27ae60', '#e74c3c', '#f39c12']
  ax.bar(intents, rates, color=colors)
  ax.axhline(y=15, color='red', linestyle='--', label='FP rate 목표 < 15%')
  ax.set_ylabel('발화율 (%)')
  ax.set_title('의도 라벨별 발화율')
  ax.legend()
  for i, v in enumerate(rates):
      ax.text(i, v, f'{v:.1f}%', ha='center', va='bottom')
  plt.savefig('outputs/fp_rate.png', dpi=150, bbox_inches='tight')
  ```

#### 검증
- [ ] FP rate 측정값 도출
- [ ] 목표 미달 시 → 부스터 가중치 추가 튜닝 PR #3

### 5.4 (Stretch) XGBoost 모델 학습

- [ ] 7단계: 모델 학습
  ```python
  from xgboost import XGBClassifier
  from sklearn.model_selection import train_test_split
  from sklearn.metrics import classification_report, roc_auc_score

  # features_df (W3에서 만든 거)
  X = features_df[['session_duration_sec', 'view_count', 'cart_count',
                    'item_revisit_count', 'avg_event_interval_sec']]
  y = features_df['has_purchase'].astype(int)

  X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

  model = XGBClassifier(n_estimators=100, max_depth=5, learning_rate=0.1)
  model.fit(X_train, y_train)

  y_pred = model.predict(X_test)
  y_pred_proba = model.predict_proba(X_test)[:, 1]

  print(classification_report(y_test, y_pred))
  print(f"AUC: {roc_auc_score(y_test, y_pred_proba):.4f}")
  ```
- [ ] 8단계: feature importance
  ```python
  import xgboost as xgb
  fig, ax = plt.subplots(figsize=(10, 6))
  xgb.plot_importance(model, ax=ax)
  plt.savefig('outputs/xgb_feature_importance.png', dpi=150, bbox_inches='tight')
  ```
- [ ] 9단계: (Stretch) FastAPI 모델 추론 서버
  ```python
  # packages/model-api/main.py (별도 컨테이너)
  from fastapi import FastAPI
  from pydantic import BaseModel
  import joblib

  app = FastAPI()
  model = joblib.load('xgboost_model.pkl')

  class Features(BaseModel):
      session_duration_sec: float
      view_count: int
      cart_count: int
      item_revisit_count: int
      avg_event_interval_sec: float

  @app.post('/predict')
  async def predict(features: Features):
      X = [[features.session_duration_sec, features.view_count, ...]]
      proba = model.predict_proba(X)[0][1]
      return {'intent_proba': float(proba)}
  ```

### 5.5 thresholds.yml PR #3

- [ ] 10단계: 최종 가중치 튜닝
  ```yaml
  booster_weights:
    # ... (PR #2 결과 유지 또는 미세조정)
    xgboost_intent_proba: 0.15  # ← Stretch 성공 시 활성화
  ```
- [ ] PR 제출 + ML AUC·FP rate 결과 첨부

---

## 6. W6~W7 — 발표·보고서 도표 패키지

>**마감: 6/12, 6/19**
>**결과물: 발표용 도표 PNG/SVG 묶음 + 보고서 데이터 챕터**

### 6.1 발표용 도표 통일 (디자인)

- [ ] 1단계: matplotlib 통일 스타일
  ```python
  import matplotlib.pyplot as plt
  plt.rcParams.update({
      'font.family': 'Malgun Gothic',  # 또는 NanumGothic
      'font.size': 12,
      'axes.titlesize': 16,
      'axes.labelsize': 14,
      'figure.figsize': (10, 6),
      'figure.dpi': 150,
      'axes.spines.top': False,
      'axes.spines.right': False
  })
  ```
- [ ] 2단계: 발표용 핵심 도표 5장 확정
  1. 카트→전환율 곡선 (S1 임계값 근거)
  2. Feature별 구매율 (부스터 가중치 근거)
  3. A/B 테스트 결과 (효과 증명)
  4. **FP rate by intent (오탐 < 15% 증명)**
  5. (Stretch) XGBoost AUC 곡선

### 6.2 보고서 데이터 챕터

- [ ] 3단계: 보고서 섹션 초안 작성 (Markdown 또는 Notion)
  ```markdown
  # 데이터 분석 결과

  ## 1. 데이터셋
  - Retailrocket: 280만 이벤트, 140만 사용자, 4개월
  - OTTO: 12.9M 세션, 220M 이벤트 (subset 100만 사용)

  ## 2. 임계값 산출 (S1.tab_hidden_seconds)
  - 카트 추가 후 25초 시점이 전환율 곡선의 변곡점
  - 이 임계값으로 잠재 이탈자의 73%를 잡을 수 있음

  ## 3. 부스터 가중치 튜닝
  - session_length_5min: 0.1 → 0.15 (lift 1.8x)
  - hidden_repeated: 0.1 → 0.12 (상관계수 0.12)

  ## 4. A/B 결과
  - Treatment 전환율 X% vs Control Y% (p=0.0X, 유의)

  ## 5. FP rate 측정
  - 목표: < 15%
  - 실측: X% (합성 시뮬레이션 N=1,000명)

  ## 6. 한계
  - Retailrocket·OTTO에 우리 핵심 신호(복사·탭 전환) 없음
  - 호텔 도메인 매핑은 직관 기반
  - Future Work: 실 호텔 데이터로 검증, multi-armed bandit
  ```

---

## 7. W8 — 최종 발표

- [ ] 발표 도표 패키지 최종 전달
- [ ] 본인 담당 슬라이드 작성 (데이터 분석 챕터, 4~5장)
- [ ] 리허설 참여 1~2회
- [ ] 발표 당일

---

## 8. 매주 자가 점검 체크리스트

### 매주 금요일
- [ ] 이번 주 노트북 git commit & push 됐는가
- [ ] 다음 주 작업이 막힐 수 있는 데이터 부족 있는가
- [ ] BE-C·BE-B에게 공유할 결과물 있는가 (thresholds.yml PR 등)
- [ ] 통합일 17:00에 §6 검증 항목 통과하는가

### 매주 일요일 (다음 주 준비)
- [ ] 다음 주 작업 항목 1번 task를 미리 시작 (예: 데이터 로드만이라도)
- [ ] AI한테 부탁할 코드 프롬프트 준비

---

## 9. AI한테 부탁할 때 좋은 프롬프트 템플릿

본 PRD의 작업을 그대로 따라가다 막히면 아래 템플릿 사용:

```
나는 BE-A 데이터 사이언스 역할을 맡고 있고, 지금 [W1/W2/...]
[Retailrocket EDA / Feature Engineering / ...] 작업 중이야.

목표: [예: 카트 추가 후 N초 시점의 전환율 곡선 그리기]

데이터 형태:
- events.csv 컬럼: timestamp, visitorid, event, itemid, transactionid
- event 값: view, addtocart, transaction

지금 막힌 점:
[구체적으로 어디서 막혔는지 — 에러 메시지, 예상과 다른 결과 등]

Pandas + Matplotlib 코드로 짜줘. 주석 친절하게.
```

---

## 10. 비상 시 대응

### 데이터셋이 너무 커서 노트북 메모리 부족
- `nrows=100_000`으로 일단 작은 sample
- chunk 처리: `pd.read_csv(..., chunksize=100_000)`
- Polars로 전환 검토

### Retailrocket 결과가 우리 가설과 정반대
- 도메인 차이를 보고서에 솔직히 명시
- 임시값을 "호텔 도메인 직관"으로 유지
- BE-C에 PR 없이 임시값 유지 의사 전달

### W5 시뮬레이터 데이터를 BE-B가 못 만듦
- BE-B와 페어로 시나리오 생성 코드 같이 작성
- 또는 Retailrocket으로 retroactive A/B 시뮬 (자체적으로)

### XGBoost AUC가 너무 낮음 (< 0.7)
- Stretch이므로 포기 가능
- `thresholds.yml`에서 `xgboost_intent_proba: 0`으로 두고 미사용
- 보고서에 "EDA만 진행, ML은 Future Work" 명시

---

## 11. 본인 일정 정리표

>이 표에 본인 실제 일정 채워서 매주 업데이트

| 주차 | 마감일 | 핵심 산출물 | 상태 |
|---|---|---|---|
| W1 | 2026-05-13 | Retailrocket EDA 1차 (notebook 01) | [ ] |
| W2 | 2026-05-15 | **thresholds.yml PR #1** | [ ] |
| W3 | 2026-05-22 | Feature Engineering (notebook 03) | [ ] |
| W4 | 2026-05-29 | OTTO EDA + **PR #2** | [ ] |
| W5 | 2026-06-05 | A/B 통계 + FP rate + **PR #3** | [ ] |
| W6 | 2026-06-12 | (Stretch) XGBoost + 발표 도표 | [ ] |
| W7 | 2026-06-19 | 보고서 데이터 챕터 | [ ] |
| W8 | 2026-06-26 | 최종 발표 | [ ] |

---

*이 문서는 BE-A의 실행 가이드입니다. 막히면 AI에 §9 템플릿으로 물어보세요. 8주 후 모든 [ ]가 [x]로 바뀌면 성공.*
