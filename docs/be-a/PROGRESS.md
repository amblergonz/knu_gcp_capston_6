# BE-A 진행도 트래커

>마지막 업데이트: 2026-05-13
>현재 단계: **W1 — 환경 셋업 완료, 데이터 대기 중**

---

## 전체 일정

| 주차 | 마감일 | 핵심 산출물 | 상태 |
|---|---|---|---|
| W1 | 2026-05-13 | Retailrocket EDA 1차 | [~] 진행 중 |
| W2 | 2026-05-15 | thresholds.yml PR #1 | [ ] 대기 |
| W3 | 2026-05-22 | Feature Engineering | [ ] 대기 |
| W4 | 2026-05-29 | OTTO EDA + PR #2 | [ ] 대기 |
| W5 | 2026-06-05 | A/B 통계 + FP rate + PR #3 | [ ] 대기 |
| W6 | 2026-06-12 | (Stretch) XGBoost + 발표 도표 | [ ] 대기 |
| W7 | 2026-06-19 | 보고서 데이터 챕터 | [ ] 대기 |
| W8 | 2026-06-26 | 최종 발표 | [ ] 대기 |

---

## W0 — 환경 셋업

| 항목 | 상태 | 비고 |
|---|---|---|
| Python 버전 확인 | [x] 완료 | Python 3.13.1 (3.11+ 요건 충족) |
| notebooks/ 디렉토리 생성 | [x] 완료 | `notebooks/data/`, `notebooks/outputs/` 포함 |
| packages/shared/config/ 생성 | [x] 완료 | |
| thresholds.yml 초기값 생성 | [x] 완료 | `packages/shared/config/thresholds.yml` |
| .gitignore 갱신 | [x] 완료 | notebooks/data/, .venv/, __pycache__ 추가 |
| 가상환경 생성 (.venv) | [ ] 미완 | **사용자 직접 필요** — `BE-A_TODO.md` 참고 |
| 라이브러리 설치 | [ ] 미완 | **사용자 직접 필요** |
| Kaggle 계정 + API 키 | [ ] 미완 | **사용자 직접 필요** |
| Retailrocket 데이터 다운로드 | [ ] 미완 | **사용자 직접 필요** |
| OTTO 데이터 다운로드 | [ ] 미완 | **사용자 직접 필요** (W4까지 여유) |

---

## W1 — Retailrocket EDA

| 항목 | 상태 | 비고 |
|---|---|---|
| `01_retailrocket_eda.ipynb` 생성 | [x] 완료 | 코드 전체 작성됨 |
| 데이터 로딩 및 기초 통계 (§1.1) | [ ] 실행 필요 | 데이터 다운로드 후 실행 |
| 세션 분리 (§1.2) | [ ] 실행 필요 | |
| 카트→전환율 곡선 (§1.3) | [ ] 실행 필요 | **S1 임계값 핵심 분석** |
| 세션 길이 분포 (§1.4) | [ ] 실행 필요 | |
| 구매 깔때기 (§1.5) | [ ] 실행 필요 | |
| outputs/ PNG 4종 저장 | [ ] 실행 필요 | |
| 결론 셀 채워넣기 | [ ] 실행 필요 | 분석 후 직접 |
| git commit & push | [ ] 미완 | |

---

## W2 — thresholds.yml PR #1

| 항목 | 상태 | 비고 |
|---|---|---|
| 브랜치 생성 (`be-a/thresholds-pr-1`) | [ ] 미완 | W1 완료 후 |
| `tab_hidden_seconds` 값 갱신 | [ ] 미완 | §1.3 분석 결과로 결정 |
| PR 작성 + 그래프 첨부 | [ ] 미완 | |
| BE-C 리뷰 요청 | [ ] 미완 | |
| 머지 확인 | [ ] 미완 | |

---

## W3 — Feature Engineering

| 항목 | 상태 | 비고 |
|---|---|---|
| `03_feature_engineering.ipynb` 생성 | [ ] 미완 | |
| 8개 feature 계산 | [ ] 미완 | |
| feature별 구매 영향력 분석 | [ ] 미완 | |
| 부스터 가중치 권장값 산출 | [ ] 미완 | |

---

## W4 — OTTO EDA + PR #2

| 항목 | 상태 | 비고 |
|---|---|---|
| `02_otto_eda.ipynb` 생성 | [ ] 미완 | |
| OTTO 데이터 로드 및 세션 통계 | [ ] 미완 | |
| thresholds.yml PR #2 | [ ] 미완 | 부스터 가중치 갱신 |

---

## 생성된 파일 목록

```
notebooks/
├── data/                          ← 비어 있음 (데이터 다운로드 필요)
├── outputs/                       ← 비어 있음 (노트북 실행 후 채워짐)
├── 01_retailrocket_eda.ipynb      [x] 생성됨 (코드 완성)
packages/shared/config/
├── thresholds.yml                 [x] 생성됨
BE-A_PROGRESS.md                   [x] 이 파일
BE-A_TODO.md                       [x] 직접 할 일 목록
```
