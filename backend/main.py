from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import pandas as pd
import numpy as np
import io
from sklearn.linear_model import LinearRegression

app = FastAPI(title="BI Copilot API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)

uploaded_data = {}


# ── Helper: numpy types clean karo ──────────────────────────────────
def clean(obj):
    if isinstance(obj, (np.integer,)):
        return int(obj)
    if isinstance(obj, (np.floating,)):
        return round(float(obj), 2)
    if isinstance(obj, np.ndarray):
        return obj.tolist()
    return obj


# ── 1. Upload ────────────────────────────────────────────────────────
@app.post("/upload")
async def upload_file(file: UploadFile = File(...)):
    if not file.filename.endswith(".csv"):
        raise HTTPException(status_code=400, detail="Sirf CSV files allowed hain")

    contents = await file.read()
    df = pd.read_csv(io.StringIO(contents.decode("utf-8")))

    if df.empty:
        raise HTTPException(status_code=400, detail="CSV file empty hai")

    uploaded_data["current"] = df

    return {
        "message": "File successfully upload ho gayi",
        "filename": file.filename,
        "rows": len(df),
        "columns": list(df.columns),
        "preview": df.head(5).to_dict(orient="records"),
    }


# ── 2. Summary ───────────────────────────────────────────────────────
@app.get("/data/summary")
def get_summary():
    if "current" not in uploaded_data:
        raise HTTPException(status_code=404, detail="Pehle file upload karo")

    df = uploaded_data["current"]
    summary = []

    for col in df.columns:
        if pd.api.types.is_numeric_dtype(df[col]):
            summary.append({
                "column": col,
                "type": "numeric",
                "min":  clean(df[col].min()),
                "max":  clean(df[col].max()),
                "mean": clean(df[col].mean()),
                "sum":  clean(df[col].sum()),
            })
        else:
            summary.append({
                "column": col,
                "type": "categorical",
                "unique_values": int(df[col].nunique()),
                "top_value": str(df[col].mode()[0]) if not df[col].mode().empty else "",
            })

    return {"summary": summary}


# ── 3. Bar chart ─────────────────────────────────────────────────────
@app.get("/data/bar-chart")
def get_bar_chart(category_col: str, numeric_col: str):
    if "current" not in uploaded_data:
        raise HTTPException(status_code=404, detail="Pehle file upload karo")

    df = uploaded_data["current"]

    if category_col not in df.columns or numeric_col not in df.columns:
        raise HTTPException(status_code=400, detail="Column exist nahi karta")

    grouped = (
        df.groupby(category_col)[numeric_col]
        .sum()
        .reset_index()
        .rename(columns={category_col: "name", numeric_col: "value"})
    )
    grouped["value"] = grouped["value"].apply(clean)

    return {"data": grouped.to_dict(orient="records")}


# ── 4. Line chart ────────────────────────────────────────────────────
@app.get("/data/line-chart")
def get_line_chart(x_col: str, y_col: str):
    if "current" not in uploaded_data:
        raise HTTPException(status_code=404, detail="Pehle file upload karo")

    df = uploaded_data["current"]

    if x_col not in df.columns or y_col not in df.columns:
        raise HTTPException(status_code=400, detail="Column exist nahi karta")

    result = df[[x_col, y_col]].rename(columns={x_col: "name", y_col: "value"})
    result["value"] = result["value"].apply(clean)

    return {"data": result.to_dict(orient="records")}


# ── 5. Preview ───────────────────────────────────────────────────────
@app.get("/data/preview")
def get_preview():
    if "current" not in uploaded_data:
        raise HTTPException(status_code=404, detail="Koi file upload nahi hui abhi tak")

    df = uploaded_data["current"]
    return {
        "rows": len(df),
        "columns": list(df.columns),
        "preview": df.head(10).to_dict(orient="records"),
    }


# ── 6. FORECAST (naya) ───────────────────────────────────────────────
@app.get("/ml/forecast")
def forecast(numeric_col: str, periods: int = 5):
    """
    Numeric column ka future forecast karo.
    Linear Regression use karta hai — row index ko X maanta hai.
    """
    if "current" not in uploaded_data:
        raise HTTPException(status_code=404, detail="Pehle file upload karo")

    df = uploaded_data["current"]

    if numeric_col not in df.columns:
        raise HTTPException(status_code=400, detail="Column exist nahi karta")

    if not pd.api.types.is_numeric_dtype(df[numeric_col]):
        raise HTTPException(status_code=400, detail="Sirf numeric column forecast ho sakta hai")

    # Values lo — NaN hata do
    values = df[numeric_col].dropna().values
    n = len(values)

    if n < 3:
        raise HTTPException(status_code=400, detail="Forecast ke liye kam se kam 3 rows chahiye")

    # X = row index (0,1,2,...), Y = actual values
    X = np.arange(n).reshape(-1, 1)
    y = values

    # Model train karo
    model = LinearRegression()
    model.fit(X, y)

    # Historical predictions (actual vs predicted line)
    historical = []
    for i in range(n):
        historical.append({
            "index": i + 1,
            "actual":    clean(values[i]),
            "predicted": clean(model.predict([[i]])[0]),
        })

    # Future predictions
    future = []
    for i in range(n, n + periods):
        future.append({
            "index":     i + 1,
            "predicted": clean(model.predict([[i]])[0]),
        })

    return {
        "column":     numeric_col,
        "historical": historical,
        "future":     future,
        "trend":      "increasing" if model.coef_[0] > 0 else "decreasing",
        "slope":      clean(model.coef_[0]),
    }


# ── 7. ANOMALY DETECTION (naya) ──────────────────────────────────────
@app.get("/ml/anomalies")
def detect_anomalies(numeric_col: str, threshold: float = 2.0):
    """
    Z-score method se anomalies dhundo.
    Agar koi value mean se 'threshold' standard deviations door hai
    toh woh anomaly hai.
    """
    if "current" not in uploaded_data:
        raise HTTPException(status_code=404, detail="Pehle file upload karo")

    df = uploaded_data["current"]

    if numeric_col not in df.columns:
        raise HTTPException(status_code=400, detail="Column exist nahi karta")

    if not pd.api.types.is_numeric_dtype(df[numeric_col]):
        raise HTTPException(status_code=400, detail="Sirf numeric column check ho sakta hai")

    values = df[numeric_col].dropna()
    mean   = values.mean()
    std    = values.std()

    # Z-score = (value - mean) / std
    z_scores = ((values - mean) / std).abs()

    result = []
    for i, (val, z) in enumerate(zip(values, z_scores)):
        result.append({
            "index":     i + 1,
            "value":     clean(val),
            "z_score":   clean(z),
            "is_anomaly": bool(z > threshold),
        })

    anomaly_count = sum(1 for r in result if r["is_anomaly"])

    return {
        "column":        numeric_col,
        "mean":          clean(mean),
        "std":           clean(std),
        "threshold":     threshold,
        "anomaly_count": anomaly_count,
        "data":          result,
    }