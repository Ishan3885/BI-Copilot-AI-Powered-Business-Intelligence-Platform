from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import pandas as pd
import numpy as np
import io
import os
import requests
from sklearn.linear_model import LinearRegression
from dotenv import load_dotenv

load_dotenv()

app = FastAPI(title="BI Copilot API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)

uploaded_data = {}


# ── Chat request format ──────────────────────────────────────────────
class ChatRequest(BaseModel):
    question: str


# ── Helper: numpy types clean karo ──────────────────────────────────
def clean(obj):
    if isinstance(obj, (np.integer,)):
        return int(obj)
    if isinstance(obj, (np.floating,)):
        return round(float(obj), 2)
    if isinstance(obj, np.ndarray):
        return obj.tolist()
    return obj


# ── Helper: DataFrame ka summary text banao ─────────────────────────
def build_data_context(df: pd.DataFrame) -> str:
    lines = []
    lines.append(f"Dataset has {len(df)} rows and {len(df.columns)} columns.")
    lines.append(f"Columns: {', '.join(df.columns.tolist())}")
    lines.append("")

    for col in df.columns:
        if pd.api.types.is_numeric_dtype(df[col]):
            lines.append(
                f"- {col} (numeric): min={clean(df[col].min())}, "
                f"max={clean(df[col].max())}, "
                f"mean={clean(df[col].mean())}, "
                f"sum={clean(df[col].sum())}"
            )
        else:
            top = df[col].value_counts().head(3).to_dict()
            lines.append(
                f"- {col} (categorical): {df[col].nunique()} unique values, "
                f"top values: {top}"
            )

    lines.append("")
    lines.append("Sample rows (first 5):")
    lines.append(df.head(5).to_string(index=False))

    return "\n".join(lines)


# ── 1. Upload ────────────────────────────────────────────────────────
@app.post("/upload")
async def upload_file(file: UploadFile = File(...)):
    if not file.filename.endswith(".csv"):
        raise HTTPException(status_code=400, detail="Only CSV files are allowed")

    contents = await file.read()
    df = pd.read_csv(io.StringIO(contents.decode("utf-8")))

    if df.empty:
        raise HTTPException(status_code=400, detail="CSV file is empty")

    uploaded_data["current"] = df

    return {
        "message": "File uploaded successfully",
        "filename": file.filename,
        "rows": len(df),
        "columns": list(df.columns),
        "preview": df.head(5).to_dict(orient="records"),
    }


# ── 2. Summary ───────────────────────────────────────────────────────
@app.get("/data/summary")
def get_summary():
    if "current" not in uploaded_data:
        raise HTTPException(status_code=404, detail="Please upload a file first")

    df = uploaded_data["current"]
    summary = []

    for col in df.columns:
        if pd.api.types.is_numeric_dtype(df[col]):
            summary.append({
                "column": col,
                "type":   "numeric",
                "min":    clean(df[col].min()),
                "max":    clean(df[col].max()),
                "mean":   clean(df[col].mean()),
                "sum":    clean(df[col].sum()),
            })
        else:
            summary.append({
                "column":        col,
                "type":          "categorical",
                "unique_values": int(df[col].nunique()),
                "top_value":     str(df[col].mode()[0]) if not df[col].mode().empty else "",
            })

    return {"summary": summary}


# ── 3. Bar chart ─────────────────────────────────────────────────────
@app.get("/data/bar-chart")
def get_bar_chart(category_col: str, numeric_col: str):
    if "current" not in uploaded_data:
        raise HTTPException(status_code=404, detail="Please upload a file first")

    df = uploaded_data["current"]

    if category_col not in df.columns or numeric_col not in df.columns:
        raise HTTPException(status_code=400, detail="Column does not exist")

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
        raise HTTPException(status_code=404, detail="Please upload a file first")

    df = uploaded_data["current"]

    if x_col not in df.columns or y_col not in df.columns:
        raise HTTPException(status_code=400, detail="Column does not exist")

    result = df[[x_col, y_col]].rename(columns={x_col: "name", y_col: "value"})
    result["value"] = result["value"].apply(clean)

    return {"data": result.to_dict(orient="records")}


# ── 5. Preview ───────────────────────────────────────────────────────
@app.get("/data/preview")
def get_preview():
    if "current" not in uploaded_data:
        raise HTTPException(status_code=404, detail="No file uploaded yet")

    df = uploaded_data["current"]
    return {
        "rows":    len(df),
        "columns": list(df.columns),
        "preview": df.head(10).to_dict(orient="records"),
    }


# ── 6. Forecast ──────────────────────────────────────────────────────
@app.get("/ml/forecast")
def forecast(numeric_col: str, periods: int = 5):
    if "current" not in uploaded_data:
        raise HTTPException(status_code=404, detail="Please upload a file first")

    df = uploaded_data["current"]

    if numeric_col not in df.columns:
        raise HTTPException(status_code=400, detail="Column does not exist")

    if not pd.api.types.is_numeric_dtype(df[numeric_col]):
        raise HTTPException(status_code=400, detail="Only numeric columns can be forecasted")

    values = df[numeric_col].dropna().values
    n = len(values)

    if n < 3:
        raise HTTPException(status_code=400, detail="Need at least 3 rows for forecast")

    X = np.arange(n).reshape(-1, 1)
    y = values

    model = LinearRegression()
    model.fit(X, y)

    historical = []
    for i in range(n):
        historical.append({
            "index":     i + 1,
            "actual":    clean(values[i]),
            "predicted": clean(model.predict([[i]])[0]),
        })

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


# ── 7. Anomaly Detection ─────────────────────────────────────────────
@app.get("/ml/anomalies")
def detect_anomalies(numeric_col: str, threshold: float = 2.0):
    if "current" not in uploaded_data:
        raise HTTPException(status_code=404, detail="Please upload a file first")

    df = uploaded_data["current"]

    if numeric_col not in df.columns:
        raise HTTPException(status_code=400, detail="Column does not exist")

    if not pd.api.types.is_numeric_dtype(df[numeric_col]):
        raise HTTPException(status_code=400, detail="Only numeric columns can be checked")

    values   = df[numeric_col].dropna()
    mean     = values.mean()
    std      = values.std()
    z_scores = ((values - mean) / std).abs()

    result = []
    for i, (val, z) in enumerate(zip(values, z_scores)):
        result.append({
            "index":      i + 1,
            "value":      clean(val),
            "z_score":    clean(z),
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


# ── 8. Chatbot ───────────────────────────────────────────────────────
@app.post("/chat")
def chat(request: ChatRequest):
    if "current" not in uploaded_data:
        raise HTTPException(
            status_code=404,
            detail="Please upload a dataset first"
        )

    df           = uploaded_data["current"]
    data_context = build_data_context(df)
    groq_key     = os.getenv("GROQ_API_KEY", "")

    # Groq available hai toh use karo, warna Ollama fallback
    if groq_key:
        headers = {
            "Authorization": f"Bearer {groq_key}",
            "Content-Type":  "application/json"
        }
        payload = {
            "model": "llama3-8b-8192",
            "messages": [
                {
                    "role":    "system",
                    "content": "You are a Business Intelligence assistant. Answer in simple plain English, 2-3 sentences max. No code, no bullet points, no jargon."
                },
                {
                    "role":    "user",
                    "content": f"Dataset summary:\n{data_context}\n\nQuestion: {request.question}"
                }
            ],
            "temperature": 0.3,
            "max_tokens":  200
        }
        try:
            response = requests.post(
                "https://api.groq.com/openai/v1/chat/completions",
                headers=headers,
                json=payload,
                timeout=30
            )
            response.raise_for_status()
            answer = response.json()["choices"][0]["message"]["content"].strip()
            return {"question": request.question, "answer": answer}

        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Groq error: {str(e)}")

    # Fallback — Ollama (local)
    else:
        ollama_url = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
        try:
            tags_res = requests.get(f"{ollama_url}/api/tags", timeout=5)
            models   = [m["name"] for m in tags_res.json().get("models", [])]
            if any("tinyllama" in m for m in models):
                model_name = "tinyllama"
            elif any("llama3.2" in m for m in models):
                model_name = "llama3.2"
            elif models:
                model_name = models[0]
            else:
                raise HTTPException(status_code=503, detail="No models found. Run: ollama pull tinyllama")
        except requests.exceptions.ConnectionError:
            raise HTTPException(status_code=503, detail="Ollama not running. Run: ollama serve")

        payload = {
            "model":  model_name,
            "prompt": f"""You are a Business Intelligence assistant. Answer in simple plain English, 2-3 sentences max. No code, no bullet points.

Dataset summary:
{data_context}

Question: {request.question}""",
            "stream":  False,
            "options": {"temperature": 0.3}
        }
        try:
            response = requests.post(
                f"{ollama_url}/api/generate",
                json=payload,
                timeout=180
            )
            response.raise_for_status()
            answer = response.json().get("response", "").strip()
            return {"question": request.question, "answer": answer}

        except requests.exceptions.ReadTimeout:
            raise HTTPException(status_code=504, detail="Model timeout. Try again.")
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))