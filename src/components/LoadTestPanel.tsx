import React, { useState } from "react";
import {
  Zap,
  Play,
  AlertTriangle,
  Gauge,
  Activity,
} from "lucide-react";
import type { ApiRequest, LoadTestResult } from "../types";
import { chasquiApi } from "../api";
import { useI18n } from "../i18n";

interface LoadTestPanelProps {
  readonly request: ApiRequest;
}

export const LoadTestPanel: React.FC<LoadTestPanelProps> = ({ request }) => {
  const { t } = useI18n();
  const [totalRequests, setTotalRequests] = useState<number>(20);
  const [concurrency, setConcurrency] = useState<number>(5);
  const [running, setRunning] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<LoadTestResult | null>(null);

  const handleRunLoadTest = async (e: React.FormEvent) => {
    e.preventDefault();
    setRunning(true);
    setError(null);
    try {
      const res = await chasquiApi.runLoadTest(
        request,
        totalRequests,
        concurrency
      );
      setResult(res);
    } catch (err) {
      setError(String(err));
    } finally {
      setRunning(false);
    }
  };

  const maxChartMs = result ? Math.max(result.max_ms, 1) : 100;

  return (
    <div className="space-y-4 text-xs select-text">
      {/* Configuration Form */}
      <form
        onSubmit={handleRunLoadTest}
        className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 p-4 space-y-3"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-amber-500" />
            <span className="font-semibold text-slate-800 dark:text-slate-200">
              {t("load_tester.title")}
            </span>
          </div>
          <span className="text-[11px] text-slate-500 font-mono">
            {request.method} {request.name}
          </span>
        </div>

        <p className="text-slate-600 dark:text-slate-400">
          {t("load_tester.subtitle")}
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
          <div>
            <label
              htmlFor="load-test-total-reqs"
              className="block text-[11px] text-slate-500 mb-1"
            >
              {t("load_tester.total_reqs")}
            </label>
            <input
              id="load-test-total-reqs"
              type="number"
              min={1}
              max={500}
              value={totalRequests}
              onChange={(e) =>
                setTotalRequests(Math.max(1, parseInt(e.target.value) || 1))
              }
              className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-1.5 font-mono text-slate-900 dark:text-slate-100"
            />
          </div>

          <div>
            <label
              htmlFor="load-test-concurrency"
              className="block text-[11px] text-slate-500 mb-1"
            >
              {t("load_tester.concurrency")}
            </label>
            <input
              id="load-test-concurrency"
              type="number"
              min={1}
              max={50}
              value={concurrency}
              onChange={(e) =>
                setConcurrency(Math.max(1, parseInt(e.target.value) || 1))
              }
              className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-1.5 font-mono text-slate-900 dark:text-slate-100"
            />
          </div>

          <div className="flex items-end">
            <button
              type="submit"
              disabled={running}
              className="w-full flex items-center justify-center gap-2 rounded-lg bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-semibold py-2 text-xs transition"
            >
              {running ? (
                <>
                  <Activity className="w-3.5 h-3.5 animate-spin" />
                  <span>{t("load_tester.running")}</span>
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>{t("load_tester.start")}</span>
                </>
              )}
            </button>
          </div>
        </div>
      </form>

      {error && (
        <div className="rounded-lg border border-rose-500/40 bg-rose-500/10 p-3 text-xs text-rose-600 dark:text-rose-300 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Results & Metrics */}
      {result && (
        <div className="space-y-4">
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 p-4 space-y-3">
            <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              <Gauge className="w-4 h-4 text-amber-500" />
              <span>{t("load_tester.metrics_title")}</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 font-mono">
              <div className="p-2.5 rounded-lg bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                <span className="text-[10px] text-slate-500 block truncate">
                  {t("load_tester.stat_total")}
                </span>
                <div className="flex items-baseline gap-1 mt-0.5">
                  <span className="text-emerald-500 font-bold">
                    {result.success_count}
                  </span>
                  <span className="text-slate-400">/</span>
                  <span className="text-slate-900 dark:text-slate-100 font-bold">
                    {result.total_requests}
                  </span>
                  {result.error_count > 0 && (
                    <span className="text-rose-500 text-[10px]">
                      ({result.error_count} err)
                    </span>
                  )}
                </div>
              </div>

              <div className="p-2.5 rounded-lg bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                <span className="text-[10px] text-slate-500 block truncate">
                  {t("load_tester.stat_rps")}
                </span>
                <span className="text-amber-600 dark:text-amber-400 font-bold text-sm">
                  {result.rps}
                </span>
              </div>

              <div className="p-2.5 rounded-lg bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                <span className="text-[10px] text-slate-500 block truncate">
                  {t("load_tester.stat_avg")}
                </span>
                <span className="text-sky-600 dark:text-sky-300 font-bold text-sm">
                  {result.avg_ms} ms
                </span>
              </div>

              <div className="p-2.5 rounded-lg bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                <span className="text-[10px] text-slate-500 block truncate">
                  {t("load_tester.stat_min_max")}
                </span>
                <div className="text-slate-700 dark:text-slate-200">
                  <span className="text-emerald-500 font-semibold">
                    {result.min_ms}
                  </span>{" "}
                  /{" "}
                  <span className="text-rose-500 font-semibold">
                    {result.max_ms} ms
                  </span>
                </div>
              </div>

              <div className="p-2.5 rounded-lg bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                <span className="text-[10px] text-slate-500 block truncate">
                  {t("load_tester.stat_p50_p95")}
                </span>
                <div className="text-slate-700 dark:text-slate-200">
                  <span>{result.p50_ms}</span> / <span>{result.p95_ms} ms</span>
                </div>
              </div>
            </div>
          </div>

          {/* Latency Bar Chart */}
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 p-4 space-y-3">
            <div className="flex items-center justify-between text-[11px] text-slate-500">
              <span className="font-semibold uppercase tracking-wider">
                {t("load_tester.distribution_title")}
              </span>
              <span className="font-mono">
                Escala: 0 a {result.max_ms} ms
              </span>
            </div>

            <div className="h-32 flex items-end gap-1 pt-2 pb-1 px-1 bg-white dark:bg-slate-950 rounded-lg border border-slate-200 dark:border-slate-800/80 overflow-x-auto">
              {result.samples.map((s) => {
                const heightPct = Math.max(
                  4,
                  Math.round((s.duration_ms / maxChartMs) * 100)
                );
                return (
                  <div
                    key={s.index}
                    className="flex-1 min-w-[6px] max-w-[18px] group relative flex flex-col items-center justify-end h-full"
                  >
                    <div
                      style={{ height: `${heightPct}%` }}
                      className={`w-full rounded-t transition-all ${
                        s.ok
                          ? "bg-amber-500 hover:bg-amber-400"
                          : "bg-rose-500 hover:bg-rose-400"
                      }`}
                    />
                    <div className="absolute bottom-full mb-1 hidden group-hover:flex flex-col items-center z-10 pointer-events-none">
                      <div className="rounded bg-slate-900 text-slate-100 text-[10px] font-mono px-2 py-1 shadow-lg whitespace-nowrap">
                        #{s.index}: {s.duration_ms} ms{" "}
                        {s.ok ? <span>(2xx OK)</span> : <span>(Error)</span>}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Sample Requests Table */}
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 overflow-hidden">
            <div className="px-4 py-2.5 border-b border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-950/70 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              {t("load_tester.latest_samples")}
            </div>
            <div className="max-h-48 overflow-y-auto">
              <table className="w-full text-left border-collapse text-xs font-mono">
                <thead className="bg-slate-50 dark:bg-slate-950 text-slate-500 text-[11px]">
                  <tr>
                    <th className="py-1.5 px-3">#</th>
                    <th className="py-1.5 px-3">Status</th>
                    <th className="py-1.5 px-3">Duración</th>
                    <th className="py-1.5 px-3">Tamaño</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800/70">
                  {result.samples.slice(-20).map((s) => (
                    <tr
                      key={s.index}
                      className="hover:bg-slate-100 dark:hover:bg-slate-900/80"
                    >
                      <td className="py-1 px-3 text-slate-500">#{s.index}</td>
                      <td className="py-1 px-3">
                        <span
                          className={`font-semibold ${
                            s.ok ? "text-emerald-500" : "text-rose-500"
                          }`}
                        >
                          {s.status}
                        </span>
                      </td>
                      <td className="py-1 px-3 text-amber-600 dark:text-amber-300">
                        {s.duration_ms} ms
                      </td>
                      <td className="py-1 px-3 text-slate-500">
                        {s.size_bytes} B
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
