import React, { useState } from "react";
import {
  Zap,
  Play,
  CheckCircle2,
  AlertTriangle,
  Gauge,
  Activity,
} from "lucide-react";
import type { ApiRequest, LoadTestResult } from "../types";
import { chasquiApi } from "../api";

interface LoadTestPanelProps {
  request: ApiRequest;
}

export const LoadTestPanel: React.FC<LoadTestPanelProps> = ({ request }) => {
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
      {/* Formulario de configuración de N peticiones y concurrencia */}
      <form
        onSubmit={handleRunLoadTest}
        className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 space-y-3"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 font-semibold text-amber-300">
            <Zap className="w-4 h-4 text-amber-400" />
            <span>Prueba de Latencia y Carga (Benchmarking de Endpoint)</span>
          </div>
          <span className="text-[11px] text-slate-400 font-mono">
            {request.method} {request.url}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
          <div className="sm:col-span-4">
            <label
              htmlFor="load-total-requests-input"
              className="block text-[11px] text-slate-400 mb-1"
            >
              Cantidad Total de Peticiones (N)
            </label>
            <input
              id="load-total-requests-input"
              type="number"
              min={1}
              max={500}
              value={totalRequests}
              onChange={(e) =>
                setTotalRequests(
                  Math.max(1, Math.min(500, Number(e.target.value) || 1))
                )
              }
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-1.5 text-xs font-mono text-slate-100 focus:border-amber-500 focus:outline-none"
            />
          </div>

          <div className="sm:col-span-4">
            <label
              htmlFor="load-concurrency-input"
              className="block text-[11px] text-slate-400 mb-1"
            >
              Concurrencia (Workers en paralelo)
            </label>
            <input
              id="load-concurrency-input"
              type="number"
              min={1}
              max={50}
              value={concurrency}
              onChange={(e) =>
                setConcurrency(
                  Math.max(1, Math.min(50, Number(e.target.value) || 1))
                )
              }
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-1.5 text-xs font-mono text-slate-100 focus:border-amber-500 focus:outline-none"
            />
          </div>

          <div className="sm:col-span-4">
            <button
              type="submit"
              disabled={running}
              className="w-full flex items-center justify-center gap-2 rounded-lg bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-semibold py-2 px-4 text-xs transition"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>
                {running
                  ? `Ejecutando ${totalRequests} reqs...`
                  : `Lanzar ${totalRequests} Requests`}
              </span>
            </button>
          </div>
        </div>
      </form>

      {error && (
        <div className="rounded-lg border border-rose-500/40 bg-rose-500/10 p-3 text-rose-300 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
          <span className="font-mono">{error}</span>
        </div>
      )}

      {result && (
        <div className="space-y-4">
          {/* Tarjetas de Estadísticas */}
          <div className="grid grid-cols-2 sm:grid-cols-6 gap-2.5">
            <div className="rounded-lg border border-slate-800 bg-slate-900/70 p-2.5">
              <span className="text-[10px] uppercase text-slate-400 block">
                Promedio
              </span>
              <span className="text-base font-bold font-mono text-amber-300">
                {result.avg_ms} ms
              </span>
            </div>
            <div className="rounded-lg border border-slate-800 bg-slate-900/70 p-2.5">
              <span className="text-[10px] uppercase text-slate-400 block">
                Mínimo
              </span>
              <span className="text-base font-bold font-mono text-emerald-400">
                {result.min_ms} ms
              </span>
            </div>
            <div className="rounded-lg border border-slate-800 bg-slate-900/70 p-2.5">
              <span className="text-[10px] uppercase text-slate-400 block">
                Máximo
              </span>
              <span className="text-base font-bold font-mono text-rose-400">
                {result.max_ms} ms
              </span>
            </div>
            <div className="rounded-lg border border-slate-800 bg-slate-900/70 p-2.5">
              <span className="text-[10px] uppercase text-slate-400 block">
                Percentil P95
              </span>
              <span className="text-base font-bold font-mono text-sky-300">
                {result.p95_ms} ms
              </span>
            </div>
            <div className="rounded-lg border border-slate-800 bg-slate-900/70 p-2.5">
              <span className="text-[10px] uppercase text-slate-400 block">
                Rendimiento
              </span>
              <span className="text-base font-bold font-mono text-purple-300">
                {result.rps} req/s
              </span>
            </div>
            <div className="rounded-lg border border-slate-800 bg-slate-900/70 p-2.5">
              <span className="text-[10px] uppercase text-slate-400 block">
                Éxito / Fallos
              </span>
              <span className="text-base font-bold font-mono text-emerald-300">
                {result.success_count}/{result.total_requests}
              </span>
            </div>
          </div>

          {/* Gráfica Visual de Barras de Latencia */}
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-slate-300 font-semibold">
                <Activity className="w-4 h-4 text-emerald-400" />
                <span>
                  Gráfica de Latencia por Petición (Total:{" "}
                  {result.total_duration_ms} ms)
                </span>
              </div>
              <div className="flex items-center gap-3 text-[11px] text-slate-400">
                <span className="flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500 inline-block" />
                  <span>2xx OK</span>
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-sm bg-rose-500 inline-block" />
                  <span>Error</span>
                </span>
                <span className="text-amber-300 font-mono">
                  --- Promedio ({result.avg_ms} ms)
                </span>
              </div>
            </div>

            <div className="relative h-44 w-full pt-4 pb-2 px-2 bg-slate-950 rounded-lg border border-slate-800/80 flex items-end gap-1 overflow-x-auto">
              {/* Línea horizontal de promedio */}
              <div
                className="absolute left-0 right-0 border-t border-dashed border-amber-400/70 pointer-events-none z-10"
                style={{
                  bottom: `${Math.min(
                    92,
                    Math.max(8, (result.avg_ms / maxChartMs) * 85)
                  )}%`,
                }}
              />

              {result.samples.map((s) => {
                const heightPct = Math.max(
                  6,
                  Math.round((s.duration_ms / maxChartMs) * 90)
                );
                return (
                  <div
                    key={s.index}
                    className="group relative flex-1 min-w-[6px] h-full flex flex-col justify-end items-center"
                    title={`#${s.index} • ${s.duration_ms} ms • HTTP ${s.status}`}
                  >
                    <div
                      className={`w-full rounded-t transition-all ${
                        s.ok
                          ? "bg-emerald-500/80 group-hover:bg-emerald-400"
                          : "bg-rose-500/80 group-hover:bg-rose-400"
                      }`}
                      style={{ height: `${heightPct}%` }}
                    />
                  </div>
                );
              })}
            </div>
          </div>

          {/* Tabla de Tiempos Individuales */}
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 overflow-hidden">
            <div className="px-4 py-2.5 border-b border-slate-800 bg-slate-950/70 flex items-center justify-between">
              <span className="font-semibold text-slate-300 flex items-center gap-1.5">
                <Gauge className="w-3.5 h-3.5 text-sky-400" />
                Detalle de cada Request ({result.samples.length})
              </span>
              <span className="text-[11px] font-mono text-slate-400">
                Mediana (P50): {result.p50_ms} ms
              </span>
            </div>
            <div className="max-h-56 overflow-y-auto">
              <table className="w-full text-left border-collapse font-mono text-xs">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-950/40 text-slate-400 text-[11px]">
                    <th className="py-2 px-3">#</th>
                    <th className="py-2 px-3">Estado</th>
                    <th className="py-2 px-3">Latencia</th>
                    <th className="py-2 px-3">Tamaño</th>
                    <th className="py-2 px-3">Detalle</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {result.samples.map((s) => (
                    <tr key={s.index} className="hover:bg-slate-900/90">
                      <td className="py-1.5 px-3 text-slate-400">#{s.index}</td>
                      <td className="py-1.5 px-3">
                        <span
                          className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] ${
                            s.ok
                              ? "text-emerald-400 bg-emerald-500/10"
                              : "text-rose-400 bg-rose-500/10"
                          }`}
                        >
                          <CheckCircle2 className="w-3 h-3" />
                          {s.status > 0 ? `HTTP ${s.status}` : "ERR"}
                        </span>
                      </td>
                      <td className="py-1.5 px-3 text-amber-300 font-semibold">
                        {s.duration_ms} ms
                      </td>
                      <td className="py-1.5 px-3 text-slate-400">
                        {s.size_bytes} B
                      </td>
                      <td className="py-1.5 px-3 text-slate-400 truncate max-w-xs">
                        {s.error || "OK"}
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
