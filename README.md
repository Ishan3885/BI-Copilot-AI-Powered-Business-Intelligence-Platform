# 📊 BI Copilot — AI-Powered Business Intelligence Platform

An intelligent, full-stack Business Intelligence platform where users can upload business datasets and instantly get interactive dashboards, predictive analytics, and conversational insights through a chatbot interface.

---

## 🚀 Features

- 📁 **CSV Upload** — Upload any business dataset instantly
- 📊 **Auto Dashboard** — Charts and visualizations generated automatically
- 📈 **Trend Analysis** — Understand data patterns with Line and Bar charts
- 🔮 **ML Forecasting** — Predict future values using Linear Regression
- 🚨 **Anomaly Detection** — Catch unusual data points using Z-score method
- 🤖 **AI Chatbot** *(Coming Soon)* — Talk to your data using Ollama
- ☁️ **Cloud Deployment** *(Coming Soon)* — Vercel + Render + Supabase

---

## 🛠️ Tech Stack

| Layer      | Technology                           |
|------------|--------------------------------------|
| Frontend   | Next.js 14, TypeScript, Tailwind CSS |
| Charts     | Recharts                             |
| Backend    | FastAPI, Python 3.11                 |
| Data       | Pandas, NumPy                        |
| ML Models  | Scikit-learn                         |
| AI / LLM   | Ollama (llama3.2) — local, free      |
| Database   | Supabase *(Phase 6)*                 |
| Deployment | Vercel + Render *(Phase 6)*          |

---

## 📁 Project Structure

```
bi-copilot/
├── frontend/                  # Next.js application
│   ├── app/
│   │   └── page.tsx           # Main dashboard UI
│   ├── public/
│   ├── package.json
│   └── tailwind.config.ts
│
├── backend/                   # FastAPI application
│   ├── main.py                # All API endpoints
│   └── requirements.txt       # Python dependencies
│
├── .env                       # Secret keys (never commit this)
├── .gitignore
└── README.md
```

---

## ⚙️ Local Setup

### Prerequisites

- [Node.js 20+](https://nodejs.org)
- [Python 3.11+](https://python.org)
- [Ollama](https://ollama.com) — for the AI chatbot
- [Git](https://git-scm.com)

### 1. Clone the Repository

```bash
git clone https://github.com/your-username/bi-copilot.git
cd bi-copilot
```

### 2. Environment Variables

Create a `.env` file in the root folder and add the following:

```
OLLAMA_BASE_URL=http://localhost:11434
SUPABASE_URL=
SUPABASE_KEY=
```

> ⚠️ Never push the `.env` file to GitHub — it is already added to `.gitignore`.

### 3. Backend Setup

```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

- Backend running at: http://localhost:8000
- Auto-generated API Docs: http://localhost:8000/docs

### 4. Frontend Setup

Open a new terminal:

```bash
cd frontend
npm install
npm run dev
```

- Frontend running at: http://localhost:3000

### 5. Ollama Setup

```bash
# Download the model (only once)
ollama pull llama3.2

# Start the Ollama server
ollama serve
```

---

## 📡 API Endpoints

| Method | Endpoint           | Description                        |
|--------|--------------------|------------------------------------|
| POST   | `/upload`          | Upload a CSV file                  |
| GET    | `/data/preview`    | Get first 10 rows of the dataset   |
| GET    | `/data/summary`    | Column stats — min, max, mean, sum |
| GET    | `/data/bar-chart`  | Category-wise aggregated data      |
| GET    | `/data/line-chart` | Trend data for line chart          |
| GET    | `/ml/forecast`     | Linear Regression forecast         |
| GET    | `/ml/anomalies`    | Z-score based anomaly detection    |

---

## 🗺️ Roadmap

- [x] Phase 1 — Project Setup & Foundation
- [x] Phase 2 — CSV Upload & Data Ingestion
- [x] Phase 3 — Interactive Dashboard & Charts
- [x] Phase 4 — ML Forecasting & Anomaly Detection
- [ ] Phase 5 — Ollama AI Chatbot (RAG + LangChain)
- [ ] Phase 6 — Auth & Cloud Deployment (Vercel + Render + Supabase)

---

## 🤝 Contributing

Pull requests are welcome! Please open an issue first to discuss what you would like to change.

---

> Built with ❤️ while learning Full-Stack AI Development