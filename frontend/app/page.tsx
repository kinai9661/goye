"use client";

import { useEffect, useMemo, useState } from "react";

import type {
  StartResponse,
  StatusResponse,
  StopResponse,
  TaskResult,
} from "../lib/types";

const initialStatus: StatusResponse = {
  state: "idle",
  run_id: null,
  task_name: null,
  progress: 0,
  total_steps: 0,
  started_at: null,
  finished_at: null,
  updated_at: new Date().toISOString(),
  last_error: null,
};

function formatDate(value?: string | null): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("zh-HK", { hour12: false });
}

export default function DashboardPage() {
  const [taskName, setTaskName] = useState("demo-task");
  const [totalSteps, setTotalSteps] = useState(20);
  const [intervalSeconds, setIntervalSeconds] = useState(1);

  const [status, setStatus] = useState<StatusResponse>(initialStatus);
  const [results, setResults] = useState<TaskResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>("");

  const isRunning = status.state === "running";

  const progressPercent = useMemo(() => {
    if (!status.total_steps || status.total_steps <= 0) return 0;
    return Math.round((status.progress / status.total_steps) * 100);
  }, [status.progress, status.total_steps]);

  async function fetchStatus(): Promise<void> {
    try {
      const response = await fetch("/api/status", { cache: "no-store" });
      if (!response.ok) {
        throw new Error(`status ${response.status}`);
      }
      const data = (await response.json()) as StatusResponse;
      setStatus(data);
    } catch (err) {
      setError(String(err));
    }
  }

  async function fetchResults(limit = 200): Promise<void> {
    try {
      const response = await fetch(`/api/results?limit=${limit}`, {
        cache: "no-store",
      });
      if (!response.ok) {
        throw new Error(`results ${response.status}`);
      }
      const data = (await response.json()) as TaskResult[];
      setResults(data);
    } catch (err) {
      setError(String(err));
    }
  }

  async function handleStart(): Promise<void> {
    setError("");
    setLoading(true);
    try {
      const response = await fetch("/api/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          task_name: taskName,
          total_steps: totalSteps,
          interval_seconds: intervalSeconds,
        }),
      });
      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || `start ${response.status}`);
      }
      const data = (await response.json()) as StartResponse;
      if (!data.ok) {
        throw new Error(data.message || "start failed");
      }
      await Promise.all([fetchStatus(), fetchResults(200)]);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }

  async function handleStop(): Promise<void> {
    setError("");
    setLoading(true);
    try {
      const response = await fetch("/api/stop", {
        method: "POST",
      });
      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || `stop ${response.status}`);
      }
      const data = (await response.json()) as StopResponse;
      if (!data.ok) {
        throw new Error(data.message || "stop failed");
      }
      await Promise.all([fetchStatus(), fetchResults(200)]);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchStatus();
    fetchResults(200);

    const timer = setInterval(() => {
      fetchStatus();
      fetchResults(200);
    }, 3000);

    return () => clearInterval(timer);
  }, []);

  return (
    <main>
      <h1>Generic Task Panel</h1>

      <section className="card">
        <h2>控制面板</h2>
        <div className="row">
          <div className="field">
            <label htmlFor="taskName">Task Name</label>
            <input
              id="taskName"
              value={taskName}
              onChange={(e) => setTaskName(e.target.value)}
              placeholder="demo-task"
            />
          </div>
          <div className="field">
            <label htmlFor="totalSteps">Total Steps</label>
            <input
              id="totalSteps"
              type="number"
              min={1}
              max={5000}
              value={totalSteps}
              onChange={(e) => setTotalSteps(Number(e.target.value || 1))}
            />
          </div>
          <div className="field">
            <label htmlFor="intervalSeconds">Interval (seconds)</label>
            <input
              id="intervalSeconds"
              type="number"
              min={0.1}
              max={60}
              step={0.1}
              value={intervalSeconds}
              onChange={(e) => setIntervalSeconds(Number(e.target.value || 0.1))}
            />
          </div>
        </div>

        <div className="row" style={{ marginTop: 12 }}>
          <button
            className="primary"
            onClick={handleStart}
            disabled={loading || isRunning}
          >
            {loading ? "Processing..." : "Start"}
          </button>
          <button
            className="warn"
            onClick={handleStop}
            disabled={loading || !isRunning}
          >
            Stop
          </button>
          <button className="secondary" onClick={() => Promise.all([fetchStatus(), fetchResults(200)])}>
            Refresh
          </button>
        </div>

        {error ? <div className="error">{error}</div> : null}
      </section>

      <section className="card">
        <h2>即時狀態</h2>
        <div className="row" style={{ marginBottom: 10 }}>
          <span className={`badge ${status.state}`}>{status.state}</span>
          <span>{progressPercent}%</span>
        </div>

        <div className="kv">
          <div className="key">Run ID</div>
          <div>{status.run_id || "-"}</div>

          <div className="key">Task Name</div>
          <div>{status.task_name || "-"}</div>

          <div className="key">Progress</div>
          <div>
            {status.progress} / {status.total_steps}
          </div>

          <div className="key">Started At</div>
          <div>{formatDate(status.started_at)}</div>

          <div className="key">Finished At</div>
          <div>{formatDate(status.finished_at)}</div>

          <div className="key">Updated At</div>
          <div>{formatDate(status.updated_at)}</div>

          <div className="key">Last Error</div>
          <div>{status.last_error || "-"}</div>
        </div>
      </section>

      <section className="card">
        <h2>結果列表（最新 {results.length} 筆）</h2>
        <div className="log-list">
          {results.length === 0 ? (
            <div className="log-item">No results yet.</div>
          ) : (
            [...results]
              .reverse()
              .map((item) => (
                <div className="log-item" key={`${item.run_id}-${item.step}-${item.created_at}`}>
                  [{formatDate(item.created_at)}] {item.task_name} #{item.step}/{item.total_steps} - {item.message}
                </div>
              ))
          )}
        </div>
      </section>
    </main>
  );
}
