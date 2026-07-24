"use client";

import { useState, useRef, useEffect } from "react";
import {
  BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
  ReferenceLine, ComposedChart, Scatter,
} from "recharts";

// ── Types ────────────────────────────────────────────────────────────
type DataRow    = Record<string, string | number>;
type ChartPoint = { name: string; value: number };

type ColumnInfo =
  | { column: string; type: "numeric"; min: number; max: number; mean: number; sum: number }
  | { column: string; type: "categorical"; unique_values: number; top_value: string };

type UploadResult = {
  filename: string;
  rows: number;
  columns: string[];
  preview: DataRow[];
};

type ForecastPoint = { index: number; actual?: number; predicted: number };
type AnomalyPoint  = { index: number; value: number; z_score: number; is_anomaly: boolean };

type ForecastResult = {
  column: string;
  historical: ForecastPoint[];
  future: ForecastPoint[];
  trend: string;
  slope: number;
};

type AnomalyResult = {
  column: string;
  mean: number;
  std: number;
  anomaly_count: number;
  data: AnomalyPoint[];
};

type Message = {
  role: "user" | "assistant";
  content: string;
};

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

// ── Main Component ───────────────────────────────────────────────────
export default function Home() {
  const [file,      setFile]      = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error,     setError]     = useState<string | null>(null);
  const [result,    setResult]    = useState<UploadResult | null>(null);
  const [summary,   setSummary]   = useState<ColumnInfo[]>([]);
  const [barData,   setBarData]   = useState<ChartPoint[]>([]);
  const [lineData,  setLineData]  = useState<ChartPoint[]>([]);
  const [forecast,  setForecast]  = useState<ForecastResult | null>(null);
  const [anomalies, setAnomalies] = useState<AnomalyResult | null>(null);
  const [mlLoading, setMlLoading] = useState(false);

  // Chat state
  const [messages,    setMessages]    = useState<Message[]>([]);
  const [inputText,   setInputText]   = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Auto scroll to bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // ── File select ──────────────────────────────────────────────────
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) {
      setFile(f);
      setError(null);
      setResult(null);
      setForecast(null);
      setAnomalies(null);
      setMessages([]);
    }
  };

  // ── Upload ───────────────────────────────────────────────────────
  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    setError(null);

    const form = new FormData();
    form.append("file", file);

    try {
      const res  = await fetch(`${API}/upload`, { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) { setError(data.detail); return; }

      setResult(data);
      setMessages([{
        role:    "assistant",
        content: `Dataset loaded! I can see **${data.rows} rows** and **${data.columns.length} columns** (${data.columns.join(", ")}). Ask me anything about your data!`,
      }]);
      await fetchSummaryAndCharts(data.columns);
    } catch (err) {
          if (err instanceof TypeError && err.message.includes("fetch")) {
              setError("Backend se connect nahi ho pa raha — file bahut badi ho sakti hai ya server busy hai. Dobara try karo.");
          } else {
              setError("Something went wrong. Please try again.");
          }
    } finally {
      setUploading(false);
    }
  };

  // ── Summary + Charts ─────────────────────────────────────────────
  const fetchSummaryAndCharts = async (columns: string[]) => {
    const sumRes  = await fetch(`${API}/data/summary`);
    const sumData = await sumRes.json();
    setSummary(sumData.summary);
    setSuggestedQs(generateSuggestedQuestions(sumData.summary));

    const cols: ColumnInfo[] = sumData.summary;
    const catCol = cols.find((c) => c.type === "categorical")?.column;
    const numCol = cols.find((c) => c.type === "numeric")?.column;

    if (catCol && numCol) {
      const barRes  = await fetch(`${API}/data/bar-chart?category_col=${catCol}&numeric_col=${numCol}`);
      const barJson = await barRes.json();
      setBarData(barJson.data);
    }

    if (columns.length >= 2 && numCol) {
      const lineRes  = await fetch(`${API}/data/line-chart?x_col=${columns[0]}&y_col=${numCol}`);
      const lineJson = await lineRes.json();
      setLineData(lineJson.data);
    }
  };

  // ── ML ───────────────────────────────────────────────────────────
  const runML = async () => {
    const numCol = summary.find((c) => c.type === "numeric")?.column;
    if (!numCol) return;

    setMlLoading(true);
    try {
      const [fRes, aRes] = await Promise.all([
        fetch(`${API}/ml/forecast?numeric_col=${numCol}&periods=5`),
        fetch(`${API}/ml/anomalies?numeric_col=${numCol}&threshold=2`),
      ]);
      setForecast(await fRes.json());
      setAnomalies(await aRes.json());
    } catch {
      setError("ML endpoints failed");
    } finally {
      setMlLoading(false);
    }
  };
  // ── Dynamic suggested questions ──────────────────────────────────────
const generateSuggestedQuestions = (cols: ColumnInfo[]) => {
  const questions: string[] = []

  const numCol = cols.find((c) => c.type === "numeric")?.column
  const catCol = cols.find((c) => c.type === "categorical")?.column
  const allNumCols = cols.filter((c) => c.type === "numeric").map((c) => c.column)
  const allCatCols = cols.filter((c) => c.type === "categorical").map((c) => c.column)

  if (numCol) {
    questions.push(`What is the total ${numCol}?`)
    questions.push(`What is the average ${numCol}?`)
  }
  if (catCol && numCol) {
    questions.push(`Which ${catCol} has the highest ${numCol}?`)
  }
  if (allNumCols.length > 1) {
    questions.push(`Which column has the most anomalies?`)
  }
  if (allCatCols.length > 0) {
    questions.push(`How many unique ${allCatCols[0]} are there?`)
  }
  if (numCol) {
    questions.push(`What is the trend in ${numCol}?`)
  }

  // Max 4 questions dikhao
  return questions.slice(0, 4)
}
  // ── Chat send ────────────────────────────────────────────────────
  const handleSend = async () => {
    const q = inputText.trim();
    if (!q || chatLoading) return;

    // User message add karo
    setMessages((prev) => [...prev, { role: "user", content: q }]);
    setInputText("");
    setChatLoading(true);

    try {
      const res  = await fetch(`${API}/chat`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ question: q }),
      });
      const data = await res.json();

      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: data.answer || data.detail || "Something went wrong" },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Error connecting to AI. Is Ollama running?" },
      ]);
    } finally {
      setChatLoading(false);
    }
  };

  // Enter key se send karo
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") handleSend();
  };

  // ── Forecast chart data ──────────────────────────────────────────
  const forecastChartData = forecast
    ? [
        ...forecast.historical.map((p) => ({
          index: `Row ${p.index}`, actual: p.actual, predicted: p.predicted,
        })),
        ...forecast.future.map((p) => ({
          index: `F${p.index - forecast.historical.length}`, actual: undefined, predicted: p.predicted,
        })),
      ]
    : [];

  const numericCols = summary.filter((c) => c.type === "numeric") as Extract<
    ColumnInfo,
    { type: "numeric" }
  >[];
  const [suggestedQs, setSuggestedQs] = useState<string[]>([
  "What is the total sales?",
  "Which product sold the most?",
  "What is the average sales per region?",
  "Are there any anomalies in the data?",
  ])

  // ─────────────────────────────────────────────────────────────────
  return (
    <main className="min-h-screen bg-gray-950 text-white p-8">
      <h1 className="text-3xl font-bold mb-1">📊 BI Copilot</h1>
      <p className="text-gray-400 mb-8">
        Upload your business data — get instant dashboard, forecasts, and AI-powered insights
      </p>

      {/* ── Upload ───────────────────────────────────────────────── */}
      <div className="bg-gray-900 border border-gray-700 rounded-xl p-6 max-w-xl mb-10">
        <label className="block text-sm text-gray-400 mb-2">Select CSV File</label>
        <input
          type="file" accept=".csv" onChange={handleFileChange}
          className="block w-full text-sm text-gray-300
            file:mr-4 file:py-2 file:px-4 file:rounded-lg
            file:border-0 file:bg-blue-600 file:text-white
            hover:file:bg-blue-700 cursor-pointer"
        />
        {file && <p className="mt-2 text-sm text-green-400">✅ Selected: {file.name}</p>}

        <button onClick={handleUpload} disabled={!file || uploading}
          className="mt-4 w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600
            disabled:cursor-not-allowed text-white font-semibold py-2 px-4
            rounded-lg transition-colors">
          {uploading ? "Uploading..." : "Upload & Generate Dashboard"}
        </button>

        {error && <p className="mt-3 text-red-400 text-sm">❌ {error}</p>}
      </div>

      {result && (
        <>
          {/* ── File Info ───────────────────────────────────────── */}
          <div className="bg-gray-900 border border-gray-700 rounded-xl p-5 mb-6 max-w-2xl">
            <h2 className="text-lg font-semibold mb-2">📁 File Info</h2>
            <p className="text-gray-300 text-sm">Filename : <span className="text-white">{result.filename}</span></p>
            <p className="text-gray-300 text-sm">Rows     : <span className="text-white">{result.rows}</span></p>
            <p className="text-gray-300 text-sm">Columns  : <span className="text-white">{result.columns.join(", ")}</span></p>
          </div>

          {/* ── Stat Cards ──────────────────────────────────────── */}
          {numericCols.length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
              {numericCols.map((col) => (
                <div key={col.column}
                  className="bg-gray-900 border border-gray-700 rounded-xl p-4">
                  <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">{col.column}</p>
                  <p className="text-2xl font-bold text-blue-400">{col.sum.toLocaleString()}</p>
                  <p className="text-xs text-gray-500 mt-1">Avg: {col.mean} | Max: {col.max}</p>
                </div>
              ))}
            </div>
          )}

          {/* ── Charts ──────────────────────────────────────────── */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            {barData.length > 0 && (
              <div className="bg-gray-900 border border-gray-700 rounded-xl p-5">
                <h2 className="text-base font-semibold mb-4">📊 Category-wise Total</h2>
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={barData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                    <XAxis dataKey="name" tick={{ fill: "#9CA3AF", fontSize: 12 }} />
                    <YAxis tick={{ fill: "#9CA3AF", fontSize: 12 }} />
                    <Tooltip contentStyle={{ backgroundColor: "#1F2937", border: "none" }}
                      labelStyle={{ color: "#F9FAFB" }} />
                    <Bar dataKey="value" fill="#3B82F6" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {lineData.length > 0 && (
              <div className="bg-gray-900 border border-gray-700 rounded-xl p-5">
                <h2 className="text-base font-semibold mb-4">📈 Trend Over Time</h2>
                <ResponsiveContainer width="100%" height={240}>
                  <LineChart data={lineData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                    <XAxis dataKey="name" tick={{ fill: "#9CA3AF", fontSize: 12 }} />
                    <YAxis tick={{ fill: "#9CA3AF", fontSize: 12 }} />
                    <Tooltip contentStyle={{ backgroundColor: "#1F2937", border: "none" }}
                      labelStyle={{ color: "#F9FAFB" }} />
                    <Line type="monotone" dataKey="value"
                      stroke="#10B981" strokeWidth={2} dot={{ fill: "#10B981" }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* ── ML Button ───────────────────────────────────────── */}
          <div className="mb-8">
            <button onClick={runML} disabled={mlLoading}
              className="bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600
                disabled:cursor-not-allowed text-white font-semibold
                py-3 px-8 rounded-xl transition-colors text-sm">
              {mlLoading ? "⏳ Running ML..." : "🔮 Run Forecast & Anomaly Detection"}
            </button>
          </div>

          {/* ── Forecast ────────────────────────────────────────── */}
          {forecast && (
            <div className="bg-gray-900 border border-gray-700 rounded-xl p-5 mb-6">
              <div className="flex items-center justify-between mb-1">
                <h2 className="text-base font-semibold">🔮 Forecast — {forecast.column}</h2>
                <span className={`text-xs px-3 py-1 rounded-full font-medium ${
                  forecast.trend === "increasing"
                    ? "bg-green-900 text-green-300"
                    : "bg-red-900 text-red-300"
                }`}>
                  {forecast.trend === "increasing" ? "📈 Increasing" : "📉 Decreasing"}
                </span>
              </div>
              <p className="text-xs text-gray-500 mb-4">Slope: {forecast.slope} per row</p>
              <ResponsiveContainer width="100%" height={280}>
                <ComposedChart data={forecastChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis dataKey="index" tick={{ fill: "#9CA3AF", fontSize: 11 }} />
                  <YAxis tick={{ fill: "#9CA3AF", fontSize: 11 }} />
                  <Tooltip contentStyle={{ backgroundColor: "#1F2937", border: "none" }}
                    labelStyle={{ color: "#F9FAFB" }} />
                  <ReferenceLine x={`Row ${forecast.historical.length}`}
                    stroke="#6B7280" strokeDasharray="4 4"
                    label={{ value: "Today", fill: "#9CA3AF", fontSize: 11 }} />
                  <Line type="monotone" dataKey="actual"
                    stroke="#3B82F6" strokeWidth={2}
                    dot={{ fill: "#3B82F6", r: 3 }} name="Actual" />
                  <Line type="monotone" dataKey="predicted"
                    stroke="#A855F7" strokeWidth={2} strokeDasharray="5 5"
                    dot={{ fill: "#A855F7", r: 3 }} name="Predicted" />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* ── Anomalies ────────────────────────────────────────── */}
          {anomalies && (
            <div className="bg-gray-900 border border-gray-700 rounded-xl p-5 mb-8">
              <div className="flex items-center justify-between mb-1">
                <h2 className="text-base font-semibold">🚨 Anomaly Detection — {anomalies.column}</h2>
                <span className="text-xs px-3 py-1 rounded-full font-medium bg-red-900 text-red-300">
                  {anomalies.anomaly_count} anomalies found
                </span>
              </div>
              <p className="text-xs text-gray-500 mb-4">
                Mean: {anomalies.mean} | Std Dev: {anomalies.std} | Red = anomaly (Z &gt; 2)
              </p>
              <ResponsiveContainer width="100%" height={240}>
                <ComposedChart data={anomalies.data}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis dataKey="index" tick={{ fill: "#9CA3AF", fontSize: 11 }} />
                  <YAxis tick={{ fill: "#9CA3AF", fontSize: 11 }} />
                  <Tooltip contentStyle={{ backgroundColor: "#1F2937", border: "none" }}
                    labelStyle={{ color: "#F9FAFB" }} />
                  <ReferenceLine y={anomalies.mean} stroke="#6B7280" strokeDasharray="4 4"
                    label={{ value: "Mean", fill: "#9CA3AF", fontSize: 11 }} />
                  <Scatter data={anomalies.data.filter((d) => !d.is_anomaly)}
                    dataKey="value" fill="#10B981" name="Normal" />
                  <Scatter data={anomalies.data.filter((d) => d.is_anomaly)}
                    dataKey="value" fill="#EF4444" name="Anomaly" />
                  <Line type="monotone" dataKey="value"
                    stroke="#374151" strokeWidth={1} dot={false} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* ── AI Chatbot ───────────────────────────────────────── */}
          <div className="bg-gray-900 border border-gray-700 rounded-xl p-5 mb-8">
            <h2 className="text-base font-semibold mb-1">🤖 Ask AI About Your Data</h2>
            <p className="text-xs text-gray-500 mb-4">
              Powered by Ollama (llama3.2) — running locally on your machine
            </p>

            {/* Messages */}
            <div className="bg-gray-950 rounded-xl p-4 h-72 overflow-y-auto mb-4 flex flex-col gap-3">
              {messages.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[80%] rounded-xl px-4 py-2 text-sm leading-relaxed ${
                    msg.role === "user"
                      ? "bg-blue-600 text-white"
                      : "bg-gray-800 text-gray-200"
                  }`}>
                    {msg.role === "assistant" && (
                      <span className="text-xs text-gray-400 block mb-1">🤖 BI Copilot</span>
                    )}
                    {msg.content}
                  </div>
                </div>
              ))}

              {chatLoading && (
                <div className="flex justify-start">
                  <div className="bg-gray-800 rounded-xl px-4 py-2 text-sm text-gray-400">
                    <span className="text-xs block mb-1">🤖 BI Copilot</span>
                    Thinking...
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Suggested questions */}
            <div className="flex flex-wrap gap-2 mb-3">
              {suggestedQs.map((q) => (
                <button key={q} onClick={() => setInputText(q)}
                  className="text-xs bg-gray-800 hover:bg-gray-700 text-gray-300
                    border border-gray-600 px-3 py-1 rounded-full transition-colors">
                {q}
                </button>
              ))}
            </div>

            {/* Input */}
            <div className="flex gap-2">
              <input
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask anything about your data..."
                className="flex-1 bg-gray-800 border border-gray-600 rounded-xl px-4 py-2
                  text-sm text-white placeholder-gray-500 focus:outline-none
                  focus:border-blue-500 transition-colors"
              />
              <button onClick={handleSend} disabled={!inputText.trim() || chatLoading}
                className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600
                  disabled:cursor-not-allowed text-white font-semibold
                  px-5 py-2 rounded-xl transition-colors text-sm">
                Send
              </button>
            </div>
          </div>

          {/* ── Data Table ──────────────────────────────────────── */}
          <div className="bg-gray-900 border border-gray-700 rounded-xl p-5 overflow-x-auto">
            <h2 className="text-base font-semibold mb-4">🔍 Data Preview (first 5 rows)</h2>
            <table className="w-full text-sm text-left">
              <thead>
                <tr className="border-b border-gray-700">
                  {result.columns.map((col) => (
                    <th key={col} className="pb-2 pr-6 text-blue-400 font-medium">{col}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {result.preview.map((row, i) => (
                  <tr key={i} className="border-b border-gray-800 hover:bg-gray-800">
                    {result.columns.map((col) => (
                      <td key={col} className="py-2 pr-6 text-gray-300">{String(row[col])}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </main>
  );
}