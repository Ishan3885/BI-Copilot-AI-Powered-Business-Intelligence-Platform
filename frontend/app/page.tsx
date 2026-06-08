"use client";

import { useState } from "react";
import {
  BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer
} from "recharts";

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

const API = "http://localhost:8000";

export default function Home() {
  const [file,      setFile]      = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error,     setError]     = useState<string | null>(null);
  const [result,    setResult]    = useState<UploadResult | null>(null);
  const [summary,   setSummary]   = useState<ColumnInfo[]>([]);
  const [barData,   setBarData]   = useState<ChartPoint[]>([]);
  const [lineData,  setLineData]  = useState<ChartPoint[]>([]);

  // ── File select ────────────────────────────────────────────────────
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) { setFile(f); setError(null); setResult(null); }
  };

  // ── Upload → phir auto charts fetch ────────────────────────────────
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
      await fetchSummaryAndCharts(data.columns);
    } catch {
      setError("Backend se connect nahi ho pa raha. Server chal raha hai?");
    } finally {
      setUploading(false);
    }
  };

  // ── Summary + charts ────────────────────────────────────────────────
  const fetchSummaryAndCharts = async (columns: string[]) => {
    // Summary
    const sumRes  = await fetch(`${API}/data/summary`);
    const sumData = await sumRes.json();
    setSummary(sumData.summary);

    const cols: ColumnInfo[] = sumData.summary;

    // Pehla categorical aur pehla numeric column dhundo
    const catCol = cols.find((c) => c.type === "categorical")?.column;
    const numCol = cols.find((c) => c.type === "numeric")?.column;

    if (catCol && numCol) {
      // Bar chart
      const barRes  = await fetch(`${API}/data/bar-chart?category_col=${catCol}&numeric_col=${numCol}`);
      const barJson = await barRes.json();
      setBarData(barJson.data);
    }

    // Pehla column X, pehla numeric Y — line chart
    if (columns.length >= 2 && numCol) {
      const lineRes  = await fetch(`${API}/data/line-chart?x_col=${columns[0]}&y_col=${numCol}`);
      const lineJson = await lineRes.json();
      setLineData(lineJson.data);
    }
  };

  // ── Numeric columns ─────────────────────────────────────────────────
  const numericCols = summary.filter((c) => c.type === "numeric") as Extract<
  ColumnInfo,
  { type: "numeric" }
>[];

  // ────────────────────────────────────────────────────────────────────
  return (
    <main className="min-h-screen bg-gray-950 text-white p-8">
      <h1 className="text-3xl font-bold mb-1">📊 BI Copilot</h1>
      <p className="text-gray-400 mb-8">
        Apna business data upload karo aur instant dashboard pao
      </p>

      {/* ── Upload Box ─────────────────────────────────────────────── */}
      <div className="bg-gray-900 border border-gray-700 rounded-xl p-6 max-w-xl mb-10">
        <label className="block text-sm text-gray-400 mb-2">CSV File Select Karo</label>
        <input
          type="file"
          accept=".csv"
          onChange={handleFileChange}
          className="block w-full text-sm text-gray-300
            file:mr-4 file:py-2 file:px-4 file:rounded-lg
            file:border-0 file:bg-blue-600 file:text-white
            hover:file:bg-blue-700 cursor-pointer"
        />
        {file && <p className="mt-2 text-sm text-green-400">✅ Selected: {file.name}</p>}

        <button
          onClick={handleUpload}
          disabled={!file || uploading}
          className="mt-4 w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600
            disabled:cursor-not-allowed text-white font-semibold py-2 px-4 rounded-lg
            transition-colors"
        >
          {uploading ? "Uploading..." : "Upload & Generate Dashboard"}
        </button>

        {error && <p className="mt-3 text-red-400 text-sm">❌ {error}</p>}
      </div>

      {result && (
        <>
          {/* ── File Info ──────────────────────────────────────────── */}
          <div className="bg-gray-900 border border-gray-700 rounded-xl p-5 mb-6 max-w-2xl">
            <h2 className="text-lg font-semibold mb-2">📁 File Info</h2>
            <p className="text-gray-300 text-sm">Filename : <span className="text-white">{result.filename}</span></p>
            <p className="text-gray-300 text-sm">Rows     : <span className="text-white">{result.rows}</span></p>
            <p className="text-gray-300 text-sm">Columns  : <span className="text-white">{result.columns.join(", ")}</span></p>
          </div>

          {/* ── Stat Cards ─────────────────────────────────────────── */}
          {numericCols.length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
              {numericCols.map((col) => (
                <div key={col.column}
                  className="bg-gray-900 border border-gray-700 rounded-xl p-4">
                  <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">{col.column}</p>
                  <p className="text-2xl font-bold text-blue-400">
                    {col.sum.toLocaleString()}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    Avg: {col.mean} &nbsp;|&nbsp; Max: {col.max}
                  </p>
                </div>
              ))}
            </div>
          )}

          {/* ── Charts Row ─────────────────────────────────────────── */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">

            {/* Bar Chart */}
            {barData.length > 0 && (
              <div className="bg-gray-900 border border-gray-700 rounded-xl p-5">
                <h2 className="text-base font-semibold mb-4">📊 Category-wise Total</h2>
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={barData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                    <XAxis dataKey="name" tick={{ fill: "#9CA3AF", fontSize: 12 }} />
                    <YAxis tick={{ fill: "#9CA3AF", fontSize: 12 }} />
                    <Tooltip
                      contentStyle={{ backgroundColor: "#1F2937", border: "none" }}
                      labelStyle={{ color: "#F9FAFB" }}
                    />
                    <Bar dataKey="value" fill="#3B82F6" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Line Chart */}
            {lineData.length > 0 && (
              <div className="bg-gray-900 border border-gray-700 rounded-xl p-5">
                <h2 className="text-base font-semibold mb-4">📈 Trend Over Time</h2>
                <ResponsiveContainer width="100%" height={260}>
                  <LineChart data={lineData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                    <XAxis dataKey="name" tick={{ fill: "#9CA3AF", fontSize: 12 }} />
                    <YAxis tick={{ fill: "#9CA3AF", fontSize: 12 }} />
                    <Tooltip
                      contentStyle={{ backgroundColor: "#1F2937", border: "none" }}
                      labelStyle={{ color: "#F9FAFB" }}
                    />
                    <Line
                      type="monotone" dataKey="value"
                      stroke="#10B981" strokeWidth={2} dot={{ fill: "#10B981" }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* ── Data Table ─────────────────────────────────────────── */}
          <div className="bg-gray-900 border border-gray-700 rounded-xl p-5 overflow-x-auto">
            <h2 className="text-base font-semibold mb-4">🔍 Preview (pehli 5 rows)</h2>
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