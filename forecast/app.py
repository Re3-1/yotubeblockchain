"""
AI-driven price forecast microservice.

Input: time series of (date, avgPrice, subscribers, views) for one channel token.
Output: 7-day forecast with lower/upper bounds.

Two strategies:
 1. Holt-Winters exponential smoothing on the price series.
 2. Fallback: linear regression on the engagement features (subs, views)
    when price history is too short (< 5 points).

Run:  uvicorn app:app --reload --port 8000
"""
from __future__ import annotations

from datetime import datetime, timedelta
from typing import List, Optional

import numpy as np
import pandas as pd
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sklearn.linear_model import LinearRegression
from statsmodels.tsa.holtwinters import ExponentialSmoothing

app = FastAPI(title="YTBC Price Forecast")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


class Point(BaseModel):
    date: str              # "YYYY-MM-DD"
    avgPrice: float        # MATIC per token
    subscribers: Optional[int] = None
    views: Optional[int] = None


class ForecastRequest(BaseModel):
    series: List[Point]
    horizon: int = 7


class ForecastPoint(BaseModel):
    date: str
    predicted: float
    lower: float
    upper: float


class ForecastResponse(BaseModel):
    strategy: str
    horizon: int
    forecast: List[ForecastPoint]


@app.get("/health")
def health():
    return {"ok": True}


@app.post("/predict", response_model=ForecastResponse)
def predict(req: ForecastRequest) -> ForecastResponse:
    horizon = max(1, min(30, req.horizon))
    if len(req.series) < 2:
        last = req.series[-1].avgPrice if req.series else 0.0
        future = _flat_forecast(last, horizon)
        return ForecastResponse(strategy="flat", horizon=horizon, forecast=future)

    df = pd.DataFrame([p.model_dump() for p in req.series])
    df["date"] = pd.to_datetime(df["date"])
    df = df.sort_values("date").set_index("date")

    last_date = df.index[-1]

    if len(df) >= 5:
        try:
            model = ExponentialSmoothing(df["avgPrice"], trend="add").fit(optimized=True)
            forecast_vals = model.forecast(horizon).clip(lower=0.0)
            residual_std = float(np.std(df["avgPrice"] - model.fittedvalues)) or 1e-6
            future = [
                ForecastPoint(
                    date=(last_date + timedelta(days=i + 1)).strftime("%Y-%m-%d"),
                    predicted=float(v),
                    lower=max(0.0, float(v) - 1.96 * residual_std),
                    upper=float(v) + 1.96 * residual_std,
                )
                for i, v in enumerate(forecast_vals)
            ]
            return ForecastResponse(strategy="holt-winters", horizon=horizon, forecast=future)
        except Exception:
            pass

    # fallback: regress price on subscribers + views
    feats = df[["subscribers", "views"]].fillna(0.0).astype(float)
    if feats.sum().sum() == 0:
        last = float(df["avgPrice"].iloc[-1])
        return ForecastResponse(
            strategy="flat",
            horizon=horizon,
            forecast=_flat_forecast(last, horizon),
        )

    lr = LinearRegression().fit(feats.values, df["avgPrice"].values)
    latest = feats.iloc[-1].values
    # assume engagement grows 0.5% / day
    future = []
    for i in range(horizon):
        latest = latest * 1.005
        pred = max(0.0, float(lr.predict(latest.reshape(1, -1))[0]))
        future.append(
            ForecastPoint(
                date=(last_date + timedelta(days=i + 1)).strftime("%Y-%m-%d"),
                predicted=pred,
                lower=pred * 0.9,
                upper=pred * 1.1,
            )
        )
    return ForecastResponse(strategy="linear-regression", horizon=horizon, forecast=future)


def _flat_forecast(last: float, horizon: int) -> List[ForecastPoint]:
    today = datetime.utcnow().date()
    return [
        ForecastPoint(
            date=(today + timedelta(days=i + 1)).strftime("%Y-%m-%d"),
            predicted=last,
            lower=last * 0.9,
            upper=last * 1.1,
        )
        for i in range(horizon)
    ]
