# BE-A — 직접 해야 할 일 목록

>Claude가 대신 할 수 없는 것들 (브라우저 로그인, 로컬 터미널 실행, 파일 다운로드)
>각 항목 완료하면 [ ] → [x] 로 바꿔 두세요

---

## [높음] 지금 당장 (W1 시작 전)

### 1. 가상환경 만들기

터미널에서 실행:
```
cd c:\Users\super\Desktop\claude_cap
python -m venv .venv
.venv\Scripts\activate
```

프롬프트 앞에 `(.venv)` 가 붙으면 성공.

- [ ] 완료

---

### 2. 라이브러리 설치

가상환경 활성화된 상태에서:
```
pip install pandas numpy matplotlib seaborn jupyter scikit-learn scipy plotly xgboost
pip freeze > notebooks/requirements.txt
```

- [ ] 완료

---

### 3. Kaggle 계정 + API 키 설정

1. https://www.kaggle.com 에서 계정 생성 또는 로그인
2. 우상단 프로필 → **Account** → **API** 섹션 → **Create New API Token**
3. `kaggle.json` 파일이 다운로드됨
4. 터미널에서:
   ```
   mkdir %USERPROFILE%\.kaggle
   copy %USERPROFILE%\Downloads\kaggle.json %USERPROFILE%\.kaggle\kaggle.json
   pip install kaggle
   kaggle datasets list  # 에러 없으면 성공
   ```

- [ ] 완료

---

### 4. Retailrocket 데이터 다운로드 (~700MB)

```
cd c:\Users\super\Desktop\claude_cap\notebooks\data
kaggle datasets download -d retailrocket/ecommerce-dataset
tar -xf ecommerce-dataset.zip
```

>Windows에서 `tar`가 안 되면 파일 탐색기에서 우클릭 → 압축 풀기

확인해야 할 파일:
- `events.csv` (약 2.7M 행)
- `item_properties_part1.csv`
- `item_properties_part2.csv`
- `category_tree.csv`

- [ ] 완료

---

### 5. Jupyter 실행 및 노트북 실행

```
cd c:\Users\super\Desktop\claude_cap\notebooks
jupyter notebook
```

브라우저에서 `01_retailrocket_eda.ipynb` 열고 **Kernel → Restart & Run All** 실행.

- [ ] 완료

---

## [보통] W1 끝날 때 (5/13 전)

### 6. 노트북 결론 셀 채워넣기

`01_retailrocket_eda.ipynb` 맨 위 마크다운 셀의 표에서 `-` 부분을 실제 분석 결과로 교체:
- 전체 이벤트 수, 사용자 수, 세션 수
- 카트→30초 내 전환율
- 변곡점 N초 (권장 임계값)
- 5분+ 세션 lift

- [ ] 완료

---

### 7. git commit & push

```
cd c:\Users\super\Desktop\claude_cap
git add notebooks/01_retailrocket_eda.ipynb notebooks/outputs/
git commit -m "feat(be-a): Retailrocket EDA 1차 - 카트 후 N초 전환율 분포"
git push
```

- [ ] 완료

---

## [보통] W2 (5/15 전)

### 8. thresholds.yml 갱신 + PR

1. 노트북 §1.3 결과에서 나온 `RECOMMENDED_N` 값 확인
2. 아래 파일 편집:
   ```
   c:\Users\super\Desktop\claude_cap\packages\shared\config\thresholds.yml
   ```
   `tab_hidden_seconds: 30` 을 분석 결과값으로 변경

3. 브랜치 생성 + PR:
   ```
   git checkout -b be-a/thresholds-pr-1
   git add packages/shared/config/thresholds.yml
   git commit -m "chore(thresholds): S1.tab_hidden_seconds 갱신 (Retailrocket 분석)"
   git push origin be-a/thresholds-pr-1
   ```
4. GitHub에서 PR 생성 → BE-C에게 리뷰 요청

>PR 본문 템플릿은 체크리스트 문서 §2.2 참고

- [ ] 완료

---

## [보통] W4 (5/29 전)

### 9. OTTO 데이터 다운로드 (~12GB)

```
cd c:\Users\super\Desktop\claude_cap\notebooks\data
kaggle competitions download -c otto-recommender-system
```

>너무 크면 다운로드만 해두고 subset으로 분석해도 됨.
>W2까지는 Retailrocket만으로도 충분.

- [ ] 완료

---

## [낮음] W5 (6/5 전)

### 10. BE-B에게 시뮬레이터 출력 데이터 요청

BE-B에게 아래 내용 포함된 CSV/parquet 요청:
```
- session_id
- ab_group (treatment / control)
- shown (개입 발화 여부, boolean)
- intent_label (comparison / distraction / browsing)
- final_state (purchased / abandoned / browsing)
- intent_score
```

이 데이터 없으면 W5 A/B 통계 분석 불가.

- [ ] 요청 완료
- [ ] 데이터 수령 완료

---

## 참고 — Claude에게 막힌 부분 물어볼 때

아래 형식으로 물어보면 빠름:

```
나는 BE-A 데이터 사이언스 역할이고, 지금 [W1/W2/...]
[작업 이름] 중이야.

목표: [뭘 하려는지]

데이터 형태:
- [컬럼명과 타입]

지금 막힌 점:
[에러 메시지나 예상과 다른 결과]

Pandas + Matplotlib 코드로 짜줘.
```
