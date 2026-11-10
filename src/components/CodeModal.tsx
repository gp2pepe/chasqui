import React, { useEffect, useState } from "react";
import {
  Terminal,
  Copy,
  Check,
  Download,
  Eye,
  EyeOff,
  X,
  Code2,
  FileJson,
  Upload,
} from "lucide-react";
import type { ApiRequest } from "../types";
import { chasquiApi } from "../api";
import {
  generateCurlCommand,
  generateFetchSnippet,
  generateGoHttpSnippet,
  generatePythonRequestsSnippet,
  parseCurlCommand,
} from "../utils/curlCodec";
import { parseCollectionJson } from "../utils/collectionImporter";

interface CodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  request: ApiRequest;
  vaultUnlocked: boolean;
  onImportRequest: (newReq: ApiRequest) => Promise<void>;
  onImportCollection: (
    requests: ApiRequest[],
    suggestedBaseUrl?: string
  ) => Promise<void>;
}

export const CodeModal: React.FC<CodeModalProps> = ({
  isOpen,
  onClose,
  request,
  vaultUnlocked,
  onImportRequest,
  onImportCollection,
}) => {
  const [mode, setMode] = useState<"export" | "import_curl" | "import_json">(
    "export"
  );
  const [lang, setLang] = useState<"curl" | "fetch" | "python" | "go">("curl");
  const [revealSecrets, setRevealSecrets] = useState(false);
  const [resolvedReq, setResolvedReq] = useState<ApiRequest>(request);
  const [copied, setCopied] = useState(false);
  const [curlInput, setCurlInput] = useState("");
  const [collectionJsonInput, setCollectionJsonInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setError(null);
      chasquiApi
        .resolveRequestPreview(request, revealSecrets)
        .then(setResolvedReq)
        .catch((err) => {
          setError(String(err));
          setResolvedReq(request);
        });
    }
  }, [isOpen, request, revealSecrets]);

  if (!isOpen) return null;

  const snippet = (() => {
    switch (lang) {
      case "curl":
        return generateCurlCommand(resolvedReq);
      case "fetch":
        return generateFetchSnippet(resolvedReq);
      case "python":
        return generatePythonRequestsSnippet(resolvedReq);
      case "go":
        return generateGoHttpSnippet(resolvedReq);
    }
  })();

  const handleCopy = () => {
    navigator.clipboard.writeText(snippet);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const handleImportCurlSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!curlInput.trim()) return;
    setError(null);
    try {
      const parsed = parseCurlCommand(curlInput);
      await onImportRequest(parsed);
      setCurlInput("");
      onClose();
    } catch (err) {
      setError(String(err));
    }
  };

  const handleImportCollectionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!collectionJsonInput.trim()) return;
    setError(null);
    setBusy(true);
    try {
      const result = parseCollectionJson(collectionJsonInput);
      if (result.requests.length === 0) {
        throw new Error(
          "No se encontraron endpoints dentro del archivo JSON proporcionado."
        );
      }
      await onImportCollection(result.requests, result.suggestedBaseUrl);
      setCollectionJsonInput("");
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      setCollectionJsonInput(text);
    } catch (err) {
      setError(String(err));
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="w-full max-w-2xl rounded-xl border border-slate-800 bg-slate-900 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between border-b border-slate-800 px-6 py-4 bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <Terminal className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-slate-100">
                cURL, Generador de Código & Importador de Colecciones
              </h2>
              <p className="text-xs text-slate-400">
                Exporta a cURL/JS/Python/Go o importa desde Postman y
                OpenAPI/Swagger
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-200 p-1 rounded-lg hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex border-b border-slate-800 bg-slate-950/40 px-6 overflow-x-auto">
          <button
            type="button"
            onClick={() => setMode("export")}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition shrink-0 ${
              mode === "export"
                ? "border-amber-400 text-amber-300"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <Code2 className="w-4 h-4" />
            Exportar Request
          </button>
          <button
            type="button"
            onClick={() => setMode("import_curl")}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition shrink-0 ${
              mode === "import_curl"
                ? "border-amber-400 text-amber-300"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <Download className="w-4 h-4" />
            Importar comando cURL
          </button>
          <button
            type="button"
            onClick={() => setMode("import_json")}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition shrink-0 ${
              mode === "import_json"
                ? "border-amber-400 text-amber-300"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <FileJson className="w-4 h-4" />
            Importar Postman / OpenAPI (.json)
          </button>
        </div>

        <div className="p-6 overflow-y-auto space-y-4">
          {error && (
            <div className="rounded-lg border border-rose-500/40 bg-rose-500/10 px-4 py-2.5 text-xs text-rose-300">
              {error}
            </div>
          )}

          {mode === "export" && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex gap-1.5 rounded-lg border border-slate-800 bg-slate-950 p-1">
                  {(
                    [
                      ["curl", "cURL (Bash)"],
                      ["fetch", "JS (fetch)"],
                      ["python", "Python (requests)"],
                      ["go", "Go (net/http)"],
                    ] as const
                  ).map(([id, label]) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setLang(id)}
                      className={`px-3 py-1 rounded-md text-xs font-medium transition ${
                        lang === id
                          ? "bg-amber-500 text-slate-950 font-semibold"
                          : "text-slate-400 hover:text-slate-200"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setRevealSecrets(!revealSecrets)}
                    disabled={!vaultUnlocked}
                    title={
                      vaultUnlocked
                        ? "Alternar entre mostrar placeholders {{secret:...}} o valores reales"
                        : "Desbloquea el Vault para poder revelar secretos reales"
                    }
                    className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs transition ${
                      revealSecrets
                        ? "border-rose-500/40 bg-rose-500/10 text-rose-300"
                        : "border-slate-700 bg-slate-800 text-slate-300"
                    } disabled:opacity-50`}
                  >
                    {revealSecrets ? (
                      <>
                        <Eye className="w-3.5 h-3.5 text-rose-400" />
                        <span>Secretos Reales Visibles</span>
                      </>
                    ) : (
                      <>
                        <EyeOff className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Secretos Ocultos ({`{{secret:...}}`})</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={handleCopy}
                    className="flex items-center gap-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold px-3.5 py-1.5 text-xs"
                  >
                    {copied ? (
                      <>
                        <Check className="w-3.5 h-3.5" />
                        <span>Copiado</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copiar Código</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              <pre className="rounded-xl border border-slate-800 bg-slate-950 p-4 font-mono text-xs text-amber-200 overflow-x-auto select-text whitespace-pre-wrap max-h-80">
                {snippet}
              </pre>
            </div>
          )}

          {mode === "import_curl" && (
            <form onSubmit={handleImportCurlSubmit} className="space-y-4">
              <div>
                <label
                  htmlFor="curl-import-textarea"
                  className="block text-xs font-medium text-slate-300 mb-1.5"
                >
                  Pega aquí tu comando <code>curl</code> (desde documentación o
                  DevTools &quot;Copy as cURL&quot;):
                </label>
                <textarea
                  id="curl-import-textarea"
                  rows={7}
                  value={curlInput}
                  onChange={(e) => setCurlInput(e.target.value)}
                  placeholder={`curl -X POST 'https://httpbin.org/post' \\\n  -H 'Authorization: Bearer {{secret:API_TOKEN}}' \\\n  -H 'Content-Type: application/json' \\\n  --data-raw '{"hello":"world"}'`}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 p-3.5 font-mono text-xs text-slate-100 focus:border-amber-500 focus:outline-none"
                  required
                />
              </div>
              <div className="flex justify-end">
                <button
                  type="submit"
                  className="flex items-center gap-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold px-4 py-2 text-xs"
                >
                  <Download className="w-4 h-4" />
                  Convertir y Guardar en Requests (.toml)
                </button>
              </div>
            </form>
          )}

          {mode === "import_json" && (
            <form onSubmit={handleImportCollectionSubmit} className="space-y-4">
              <div className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950 p-4">
                <div className="space-y-0.5 text-xs">
                  <div className="font-semibold text-slate-200">
                    Seleccionar archivo Postman Collection v2.1 o OpenAPI 3 /
                    Swagger 2 (.json)
                  </div>
                  <div className="text-slate-400">
                    Genera automáticamente todas las carpetas y archivos{" "}
                    <code>.toml</code> en tu workspace.
                  </div>
                </div>
                <label className="flex items-center gap-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 px-3 py-2 text-xs font-medium text-amber-300 cursor-pointer shrink-0">
                  <Upload className="w-4 h-4" />
                  <span>Cargar .json</span>
                  <input
                    type="file"
                    accept=".json,application/json"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </label>
              </div>

              <div>
                <label
                  htmlFor="collection-json-textarea"
                  className="block text-xs font-medium text-slate-300 mb-1.5"
                >
                  O pega el contenido JSON de la colección / especificación
                  OpenAPI directamente:
                </label>
                <textarea
                  id="collection-json-textarea"
                  rows={7}
                  value={collectionJsonInput}
                  onChange={(e) => setCollectionJsonInput(e.target.value)}
                  placeholder='{"openapi": "3.0.0", "info": {"title": "Mi API"}, "paths": { ... }}'
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 p-3.5 font-mono text-xs text-slate-100 focus:border-amber-500 focus:outline-none"
                  required
                />
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={busy}
                  className="flex items-center gap-2 rounded-lg bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-semibold px-4 py-2 text-xs"
                >
                  <FileJson className="w-4 h-4" />
                  <span>
                    {busy
                      ? "Importando endpoints..."
                      : "Importar Colección Completa a Archivos .TOML"}
                  </span>
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
