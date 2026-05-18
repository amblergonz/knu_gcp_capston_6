from fastapi import FastAPI
import yaml
import os

app = FastAPI(title="Hover Data Science API")

THRESHOLDS_PATH = os.path.join(os.path.dirname(__file__), '../../packages/shared/config/thresholds.yml')


@app.get("/")
def read_root():
    return {"message": "Data Science Model API is running"}


@app.get("/health")
def health_check():
    return {"status": "ok"}


@app.get("/thresholds")
def get_thresholds():
    try:
        with open(THRESHOLDS_PATH, 'r', encoding='utf-8') as f:
            return yaml.safe_load(f)
    except FileNotFoundError:
        return {"error": "thresholds.yml not found"}


@app.post("/predict")
def predict(features: dict):
    # XGBoost 모델 학습 완료 후 실제 추론 로직으로 교체 예정 (W5+)
    return {"intent_probability": 0.0, "status": "model_not_trained"}
