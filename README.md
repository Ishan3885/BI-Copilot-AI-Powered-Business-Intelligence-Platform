# 📊 BI Copilot — AI-Powered Business Intelligence Platform

An intelligent, full-stack Business Intelligence platform where users can upload business datasets and instantly get interactive dashboards, predictive analytics, and conversational insights through a chatbot interface.

🌐 **Live Demo:** [bi-copilot-ai-powered-business-inte.vercel.app](https://bi-copilot-ai-powered-business-inte.vercel.app)

---

## 🚀 Features

- 📁 **CSV Upload** — Upload any business dataset instantly (auto-truncates large files for performance)
- 📊 **Auto Dashboard** — Charts and visualizations generated automatically based on your data
- 📈 **Trend Analysis** — Understand data patterns with dynamic Line and Bar charts
- 🔮 **ML Forecasting** — Predict future values using Linear Regression
- 🚨 **Anomaly Detection** — Catch unusual data points using Z-score method
- 🤖 **AI Chatbot** — Talk to your data using Groq (cloud) or Ollama (local)
- 💬 **Dynamic Suggested Questions** — Auto-generated questions based on your dataset columns
- ☁️ **Cloud Deployed** — Live on Vercel + Render

---

## 🛠️ Tech Stack

| Layer      | Technology                           |
|------------|--------------------------------------|
| Frontend   | Next.js 15, TypeScript, Tailwind CSS |
| Charts     | Recharts                             |
| Backend    | FastAPI, Python 3.13                 |
| Data       | Pandas, NumPy                        |
| ML Models  | Scikit-learn (Linear Regression, Z-score) |
| AI / LLM   | Groq API (cloud) + Ollama (local fallback) |
| Deployment | Vercel (frontend) + Render (backend) |

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
├── .gitignore
└── README.md
```

---

## ⚙️ Local Setup

### Prerequisites

- [Node.js 20+](https://nodejs.org)
- [Python 3.11+](https://python.org)
- [Ollama](https://ollama.com) — for local AI (optional)
- [Git](https://git-scm.com)

### 1. Clone the Repository

```bash
git clone https://github.com/your-username/bi-copilot.git
cd bi-copilot
```

### 2. Environment Variables

Create a `.env` file in the `backend/` folder:

```
OLLAMA_BASE_URL=http://localhost:11434
GROQ_API_KEY=your_groq_api_key_here
```

> ⚠️ Never push the `.env` file to GitHub — it is already added to `.gitignore`.
> Get a free Groq API key at https://console.groq.com

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

### 5. Ollama Setup (Optional — local AI)

```bash
# Download a lightweight model
ollama pull tinyllama

# Start the Ollama server
ollama serve
```

> If `GROQ_API_KEY` is set, Groq is used automatically. Ollama is the fallback for local development.

---

## 📡 API Endpoints

| Method | Endpoint           | Description                           |
|--------|--------------------|---------------------------------------|
| GET    | `/`                | Health check — API status             |
| GET    | `/health`          | Server health                         |
| POST   | `/upload`          | Upload a CSV file                     |
| GET    | `/data/preview`    | Get first 10 rows of the dataset      |
| GET    | `/data/summary`    | Column stats — min, max, mean, sum    |
| GET    | `/data/bar-chart`  | Category-wise aggregated data         |
| GET    | `/data/line-chart` | Trend data for line chart             |
| GET    | `/ml/forecast`     | Linear Regression forecast            |
| GET    | `/ml/anomalies`    | Z-score based anomaly detection       |
| POST   | `/chat`            | AI chatbot — ask questions about data |

---

## ☁️ Deployment

### Frontend — Vercel

1. Connect GitHub repo to [Vercel](https://vercel.com)
2. Set Root Directory to `frontend`
3. Add environment variable:
   - `NEXT_PUBLIC_API_URL` = your Render backend URL

### Backend — Render

1. Connect GitHub repo to [Render](https://render.com)
2. Set Root Directory to `backend`
3. Build Command: `pip install -r requirements.txt`
4. Start Command: `uvicorn main:app --host 0.0.0.0 --port $PORT`
5. Add environment variable:
   - `GROQ_API_KEY` = your Groq API key (from Render dashboard only — never commit this)

---

## 🔐 Security Notes

- Never commit API keys or `.env` files to GitHub
- Always set secrets via Render / Vercel environment variable dashboards
- Groq automatically revokes keys that are exposed publicly

---

## 🗺️ Roadmap

- [x] Phase 1 — Project Setup & Foundation
- [x] Phase 2 — CSV Upload & Data Ingestion
- [x] Phase 3 — Interactive Dashboard & Charts
- [x] Phase 4 — ML Forecasting & Anomaly Detection
- [x] Phase 5 — AI Chatbot (Groq + Ollama)
- [x] Phase 6 — Cloud Deployment (Vercel + Render)

---

## 🤝 Contributing

Pull requests are welcome! Please open an issue first to discuss what you would like to change.

---

## 📄 License

MIT License — free to use, modify, and distribute.

---

> Built with ❤️ while learning Full-Stack AI Development