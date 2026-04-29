# ⚙️ BE4 — Data Science & Analysis

## 📌 당신의 미션

**공개 데이터셋으로 가설을 검증하고, S1과 S2의 발화 임계치를 수치로 제시합니다. 발표와 보고서의 임팩트는 여기서 나옵니다.**

---

## 🎯 W1 — Kickoff (4/29 ~ 5/3)

### 할 일
- [ ] 데이터셋 다운로드
  - Retailrocket: https://www.kaggle.com/datasets/retailrocket/ecommerce-dataset
  - OTTO: https://www.kaggle.com/datasets/otto-recommender-systems/
- [ ] 개발 환경 셋업
  ```bash
  python -m venv venv
  source venv/bin/activate  # Windows: venv\Scripts\activate
  pip install jupyter pandas numpy scikit-learn torch
  ```
- [ ] 1차 EDA 노트북 시작
  - `notebooks/01_retailrocket.ipynb`
  - 데이터 크기, 컬럼, 기본 통계

### 산출물
- 데이터셋 로컬 저장 (`.gitignore`에 추가)
- 1차 EDA 완료

### 첫 명령어
```bash
cd hover
python -m venv venv
source venv/bin/activate
pip install -r notebooks/requirements.txt
jupyter notebook
```

---

## 🎯 W2 — Retailrocket 분석 (5/6 ~ 5/10)

### Retailrocket 분석 목표
**S1의 임계치 N 도출:** "카트 추가 후 몇 초 만에 이탈하는가?"

#### 분석 과정
```python
# notebooks/01_retailrocket.ipynb

import pandas as pd
import numpy as np
import matplotlib.pyplot as plt

# 데이터 로드
events = pd.read_csv('retailrocket/events.csv', sep=',')

# 1. 세션별 이벤트 시퀀스 분석
# - 각 세션에서 "addtocart" 이벤트 시점 찾기
# - 그 이후 "view" 이벤트로 돌아가는지 확인

# 2. 시간 간격 계산
sessions_with_cart = events[events['event'] == 'addtocart']['sessionId'].unique()
cart_to_exit_times = []

for session in sessions_with_cart:
    session_events = events[events['sessionId'] == session].sort_values('timestamp')
    cart_idx = session_events[session_events['event'] == 'addtocart'].index
    
    # 카트 후 이탈 시간 계산
    if len(cart_idx) > 0:
        cart_time = session_events.loc[cart_idx[0], 'timestamp']
        remaining = session_events[session_events['timestamp'] > cart_time]
        
        if len(remaining) > 0:
            exit_time = remaining.iloc[-1]['timestamp']
            duration_seconds = (exit_time - cart_time) / 1000  # ms → seconds
            cart_to_exit_times.append(duration_seconds)
        else:
            # 카트 이후 이탈 (즉시)
            cart_to_exit_times.append(0)

# 3. 분포 분석
import matplotlib.pyplot as plt

plt.figure(figsize=(12, 6))
plt.hist(cart_to_exit_times, bins=100)
plt.xlabel('Exit Time (seconds) after Cart Add')
plt.ylabel('Frequency')
plt.title('Retailrocket: Cart → Exit Time Distribution')
plt.axvline(np.percentile(cart_to_exit_times, 50), color='r', linestyle='--', label='50th percentile')
plt.axvline(np.percentile(cart_to_exit_times, 75), color='g', linestyle='--', label='75th percentile')
plt.legend()
plt.show()

# 4. 통계
p50 = np.percentile(cart_to_exit_times, 50)  # 중간값
p75 = np.percentile(cart_to_exit_times, 75)
p90 = np.percentile(cart_to_exit_times, 90)

print(f"""
=== Retailrocket 분석 결과 ===
50th percentile: {p50:.1f}초  ← 권장 임계치
75th percentile: {p75:.1f}초
90th percentile: {p90:.1f}초

해석:
- 호텔 손님 50%는 카트 추가 후 {p50:.0f}초 이내에 다른 탭으로 넘어감
- 따라서 S1 룰의 임계치 N = {int(p50)}초로 설정하면 이탈자 절반 커버
""")
```

#### 산출물
```
notebooks/01_retailrocket.ipynb
├── [1] 데이터 로드 및 초기 탐색
├── [2] 세션별 cart → exit 시간 계산
├── [3] 분포 시각화
└── [4] 통계 분석 결과
    └── 결론: S1 임계치 = 30초 (또는 50초, 데이터에 따라)
```

---

## 🎯 W3 — OTTO 분석 (5/13 ~ 5/17)

### OTTO 분석 목표
1. **세션 기반 행동 패턴** 이해
2. **다음 행동 예측** 모델 (Stretch)

#### 분석 과정
```python
# notebooks/02_otto.ipynb

import pandas as pd
from sklearn.preprocessing import LabelEncoder
import numpy as np

# 데이터 로드 (대용량이므로 subset 사용)
df = pd.read_parquet('otto/events*.parquet')  # 또는 CSV

print(f"Dataset shape: {df.shape}")
print(f"Sessions: {df['session'].nunique()}")
print(f"Products: {df['product_id'].nunique()}")

# 1. 세션 길이 분석
session_lengths = df.groupby('session').size()
print(f"Average session length: {session_lengths.mean():.1f}")
print(f"Median session length: {session_lengths.median():.1f}")

# 2. 이벤트 타입 분포
print(f"\nEvent type distribution:")
print(df['type'].value_counts())

# 3. 전환 분석 (click → buy 확률)
clicks = df[df['type'] == 'click'].groupby('session').size()
buys = df[df['type'] == 'buy'].groupby('session').size()
click_to_buy_rate = len(buys) / len(clicks)
print(f"\nClick → Buy conversion: {click_to_buy_rate:.2%}")

# 4. 호텔 도메인 매핑 가능성
print("""
=== OTTO → 호텔 도메인 매핑 ===
click   → 호텔/객실 풀세이지 지
buy     → 예약 완료
cart    → 예약 진행 (N/A in OTTO)

결론: OTTO는 구매 시퀀스에 집중. 호텔 도메인과 간접적 매핑만 가능.
      가따 Retailrocket이 더 호텔과 직선적 유사성을 가짐.
""")
```

#### Stretch: GRU4Rec 예측 모델
```python
# notebooks/02_otto_gru4rec.ipynb (Stretch, 시간 많을 때)

import torch
import torch.nn as nn

# GRU4Rec 모델 구현 (또는 기존 라이브러리 사용)
class GRU4Rec(nn.Module):
    def __init__(self, num_items, embedding_dim=128, hidden_dim=128):
        super(GRU4Rec, self).__init__()
        self.embedding = nn.Embedding(num_items, embedding_dim)
        self.gru = nn.GRU(embedding_dim, hidden_dim, batch_first=True)
        self.output = nn.Linear(hidden_dim, num_items)
    
    def forward(self, x):
        embeddings = self.embedding(x)
        _, hidden = self.gru(embeddings)
        logits = self.output(hidden)
        return logits

# ... 학습 및 평가
```

#### 산출물
```
notebooks/02_otto.ipynb
├── [1] 데이터 탐색
├── [2] 세션 분석
├── [3] click→buy 전환율
└── [4] 호텔 도메인 매핑 가능성 논의
```

---

## 🎯 W4 ~ W5 — A/B 통계 (5/20 ~ 5/31)

### A/B 테스트 결과 분석

#### 분석 과정
```python
# notebooks/03_ab_synthetic.ipynb

import numpy as np
from scipy.stats import chi2_contingency
import pandas as pd

# BE3 시뮬레이터에서 생성한 데이터 로드
# (또는 docker-compose 통해 ClickHouse 쿼리)

# 1. Control vs Treatment 전환율
control_data = load_data(scenario='S1', ab_group='control')
treatment_data = load_data(scenario='S1', ab_group='treatment')

control_cr = len(control_data[control_data['converted'] == True]) / len(control_data)
treatment_cr = len(treatment_data[treatment_data['converted'] == True]) / len(treatment_data)

lift = (treatment_cr - control_cr) / control_cr

print(f"""
=== S1 A/B 테스트 결과 ===
Control group:     {control_cr:.2%} (n={len(control_data)})
Treatment group:   {treatment_cr:.2%} (n={len(treatment_data)})
Lift:              {lift:.1%}
""")

# 2. Chi-square 검정
contingency_table = np.array([
    [len(control_data[control_data['converted'] == True]), 
     len(control_data[control_data['converted'] == False])],
    [len(treatment_data[treatment_data['converted'] == True]), 
     len(treatment_data[treatment_data['converted'] == False])]
])

chi2, p_value, dof, expected = chi2_contingency(contingency_table)

print(f"""
Chi-square statistic: {chi2:.4f}
P-value: {p_value:.4f}
Significant: {p_value < 0.05}
""")

# 3. 시각화
import matplotlib.pyplot as plt

fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(14, 5))

# 전환율 비교
ax1.bar(['Control', 'Treatment'], [control_cr, treatment_cr])
ax1.set_ylabel('Conversion Rate')
ax1.set_title('S1: Control vs Treatment')
ax1.set_ylim([0, max(control_cr, treatment_cr) * 1.2])

# 신뢰 구간
ax2.errorbar(['Control', 'Treatment'], 
             [control_cr, treatment_cr],
             yerr=[1.96 * np.std([control_cr, treatment_cr]) / np.sqrt(len(control_data))
                   for _ in range(2)])
ax2.set_ylabel('Conversion Rate')
ax2.set_title('95% Confidence Interval')

plt.tight_layout()
plt.show()
```

#### 산출물
```
notebooks/03_ab_synthetic.ipynb
├── [1] 데이터 로드
├── [2] Control vs Treatment 전환율 계산
├── [3] Chi-square 검정
├── [4] 신뢰 구간 시각화
└── [5] 최종 결론: Lift XX%, p-value YYY
```

---

## 🎯 W6 ~ W8 — 발표 자료 생성

### 발표용 도표 패키지

#### 생성할 도표
1. **Retailrocket 임계치** (PNG)
   - 카트→이탈 시간 분포 히스토그램
   - 라벨: "50% 이탈자를 커버하려면 N초"

2. **OTTO 세션 분석** (PNG)
   - 세션 길이 분포
   - Click→Buy 전환율

3. **A/B 테스트 결과** (PNG)
   - Control vs Treatment 전환율 비교
   - 신뢰 구간 + p-value

#### 생성 코드
```python
# notebooks/99_export_presentation_charts.ipynb

import matplotlib.pyplot as plt
from matplotlib import rc

# 한글 폰트 설정
rc('font', family='DejaVu Sans')  # 또는 시스템 한글 폰트

# Chart 1: Retailrocket 임계치
fig, ax = plt.subplots(figsize=(10, 6))
ax.hist(cart_to_exit_times, bins=100, alpha=0.7)
ax.axvline(p50, color='r', linestyle='--', label=f'Threshold N = {int(p50)}s')
ax.set_xlabel('Exit Time (seconds)')
ax.set_ylabel('Count')
ax.set_title('Hover S1: When do customers leave after adding to cart?')
ax.legend()
plt.tight_layout()
plt.savefig('presentation_charts/01_retailrocket_threshold.png', dpi=300)
plt.close()

# Chart 2: A/B Results
fig, ax = plt.subplots(figsize=(8, 6))
ax.bar(['Control', 'Treatment'], [control_cr, treatment_cr], color=['gray', 'green'])
ax.set_ylabel('Conversion Rate')
ax.set_title(f'Hover S1: A/B Test Result (p={p_value:.4f})')
ax.set_ylim([0, max(control_cr, treatment_cr) * 1.3])
# 통계 정보 추가
ax.text(0.5, max(control_cr, treatment_cr) * 1.1, 
        f'Lift: {lift:.1%}\nSignificant: {p_value < 0.05}',
        ha='center', fontsize=12)
plt.tight_layout()
plt.savefig('presentation_charts/02_ab_results.png', dpi=300)
plt.close()

print("✅ Presentation charts exported to presentation_charts/")
```

---

## 📋 노트북 구조

```
hover/notebooks/
├── 01_retailrocket.ipynb
│   └── S1 임계치 도출 (cart → exit 시간)
│
├── 02_otto.ipynb
│   └── 세션 분석 + 호텔 매핑 논의
│
├── 02_otto_gru4rec.ipynb (Stretch)
│   └── 다음 행동 예측 모델
│
├── 03_ab_synthetic.ipynb
│   └── A/B 통계 검정
│
├── 99_export_presentation_charts.ipynb
│   └── 발표용 도표 생성
│
└── requirements.txt
    ├── jupyter
    ├── pandas
    ├── numpy
    ├── scikit-learn
    ├── matplotlib
    ├── scipy
    └── torch (GRU4Rec 용)
```

---

## 🔗 협업

### BE2와 협력
- **S1 임계치 N 전달** (W3)
  - Retailrocket 분석 결과
  - 예: "30초"

### BE3와 협력
- **A/B 데이터 접근** (W5)
  - ClickHouse 쿼리 또는 CSV export
  - 또는 Docker 통해 직접 접근

### 전체 팀과 협력
- **발표용 도표** 제공 (W7)
  - PNG/SVG 고해상도

---

## 💡 팁

1. **Jupyter 노트북은 실행 가능해야 함**
   - 모든 셀이 순서대로 실행 가능
   - 상대 경로 사용 (`.gitignore`로 데이터셋 제외)

2. **큰 데이터셋은 subset으로**
   - OTTO 전체 (12GB) → 1GB subset으로 테스트
   - 결과 전이성 검증

3. **통계는 신중하게**
   - p < 0.05 = "유의" (통상)
   - 샘플 크기가 작으면 신뢰도 낮음

4. **시각화는 명확하게**
   - 축 라벨 명시
   - 범례 포함
   - 발표용은 큰 폰트

---

## 📞 블로커 발생 시

- **Retailrocket 데이터 문제?** → Kaggle 대체 데이터셋 확인
- **OTTO 학습 시간 너무 김?** → subset 사용 또는 사전학습 모델
- **A/B 통계 p-value가 높음?** → 샘플 크기 증가 (시뮬레이터에서)

---

**Remember:** 숫자가 우리의 가설을 증명합니다. 발표의 임팩트는 당신의 분석에서 나옵니다. 📊
