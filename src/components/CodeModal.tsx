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
import { useI18n } from "../i18n";

interface CodeModalProps {
  readonly isOpen: boolean;
  readonly onClose: () => void;
  readonly request: ApiRequest;
  readonly vaultUnlocked: boolean;
  readonly onImportRequest: (newReq: ApiRequest) => Promise<void>;
  readonly onImportCollection: (
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
  const { t } = useI18n();
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
      setError(String(err));
    } finally {
      setBusy(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setBusy(true);
    try {
      const text = await file.text();
      setCollectionJsonInput(text);
      const result = parseCollectionJson(text);
      if (result.requests.length === 0) {
        throw new Error(
          "No se encontraron endpoints dentro del archivo JSON seleccionado."
        );
      }
      await onImportCollection(result.requests, result.suggestedBaseUrl);
      onClose();
    } catch (err) {
      setError(String(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="w-full max-w-3xl rounded-xl border border-slate-700 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl overflow-hidden max-h-[90vh] flex flex-col text-slate-900 dark:text-slate-100">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 px-6 py-4 bg-slate-50 dark:bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-amber-500/10 text-amber-500 dark:text-amber-400 border border-amber-500/20">
              <Terminal className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold">
                {t("code_modal.title")}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {t("code_modal.subtitle")}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs Mode */}
        <div className="flex border-b border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-950 px-6 pt-2">
          <button
            type="button"
            onClick={() => setMode("export")}
            className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold border-b-2 transition ${
              mode === "export"
                ? "border-amber-500 text-amber-600 dark:text-amber-400"
                : "border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-200"
            }`}
          >
            <Code2 className="w-4 h-4" />
            <span>{t("code_modal.tab_export")}</span>
          </button>
          <button
            type="button"
            onClick={() => setMode("import_curl")}
            className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold border-b-2 transition ${
              mode === "import_curl"
                ? "border-amber-500 text-amber-600 dark:text-amber-400"
                : "border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-200"
            }`}
          >
            <Download className="w-4 h-4" />
            <span>cURL</span>
          </button>
          <button
            type="button"
            onClick={() => setMode("import_json")}
            className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold border-b-2 transition ${
              mode === "import_json"
                ? "border-amber-500 text-amber-600 dark:text-amber-400"
                : "border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-200"
            }`}
          >
            <FileJson className="w-4 h-4" />
            <span>Postman / OpenAPI</span>
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-4">
          {error && (
            <div className="rounded-lg border border-rose-500/40 bg-rose-500/10 p-3 text-xs text-rose-600 dark:text-rose-300">
              {error}
            </div>
          )}

          {mode === "export" && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-1 rounded-lg border border-slate-300 dark:border-slate-800 bg-slate-100 dark:bg-slate-950 p-1 text-xs">
                  {(
                    [
                      ["curl", "cURL"],
                      ["fetch", "JS Fetch"],
                      ["python", "Python requests"],
                      ["go", "Go net/http"],
                    ] as const
                  ).map(([l, label]) => (
                    <button
                      key={l}
                      type="button"
                      onClick={() => setLang(l)}
                      className={`px-3 py-1 rounded font-medium transition ${
                        lang === l
                          ? "bg-amber-500 text-slate-950"
                          : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={revealSecrets}
                      disabled={!vaultUnlocked}
                      onChange={(e) => setRevealSecrets(e.target.checked)}
                      className="rounded border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-amber-500"
                    />
                    {revealSecrets ? (
                      <Eye className="w-3.5 h-3.5 text-amber-500" />
                    ) : (
                      <EyeOff className="w-3.5 h-3.5" />
                    )}
                    <span>{t("code_modal.reveal_secrets")}</span>
                  </label>

                  <button
                    type="button"
                    onClick={handleCopy}
                    className="flex items-center gap-1.5 rounded-lg bg-slate-800 dark:bg-slate-800 hover:bg-slate-700 text-slate-100 px-3 py-1.5 text-xs font-semibold"
                  >
                    {copied ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                        <span>{t("code_modal.copied")}</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>{t("code_modal.copy_code")}</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {!vaultUnlocked && (
                <div className="text-[11px] text-amber-600 dark:text-amber-400/80 italic">
                  * {t("code_modal.secrets_masked")}
                </div>
              )}

              <pre className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-950 p-4 font-mono text-xs text-emerald-300 overflow-x-auto max-h-96 select-text whitespace-pre-wrap">
                {snippet}
              </pre>
            </div>
          )}

          {mode === "import_curl" && (
            <form onSubmit={handleImportCurlSubmit} className="space-y-4">
              <div>
                <label
                  htmlFor="curl-input-box"
                  className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
                >
                  {t("code_modal.import_curl_title")}
                </label>
                <textarea
                  id="curl-input-box"
                  value={curlInput}
                  onChange={(e) => setCurlInput(e.target.value)}
                  placeholder={t("code_modal.import_curl_placeholder")}
                  rows={6}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-3 font-mono text-xs text-slate-900 dark:text-slate-100 focus:border-amber-500 focus:outline-none resize-none"
                />
              </div>
              <button
                type="submit"
                disabled={!curlInput.trim()}
                className="flex items-center gap-2 rounded-lg bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-semibold px-4 py-2 text-xs"
              >
                <Download className="w-4 h-4" />
                <span>{t("code_modal.parse_curl_btn")}</span>
              </button>
            </form>
          )}

          {mode === "import_json" && (
            <form onSubmit={handleImportCollectionSubmit} className="space-y-4">
              <div className="rounded-xl border border-dashed border-slate-300 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 p-6 text-center space-y-3">
                <div className="p-3 mx-auto w-fit rounded-full bg-amber-500/10 text-amber-500 dark:text-amber-400">
                  <Upload className="w-6 h-6" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                    {t("code_modal.import_files_title")}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
                    {t("code_modal.import_files_desc")}
                  </p>
                </div>
                <div>
                  <label className="inline-flex items-center gap-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold px-4 py-2 text-xs cursor-pointer shadow">
                    <Upload className="w-4 h-4" />
                    <span>{t("code_modal.choose_file_btn")}</span>
                    <input
                      type="file"
                      accept=".json"
                      onChange={handleFileUpload}
                      className="hidden"
                      disabled={busy}
                    />
                  </label>
                </div>
              </div>

              <div>
                <label
                  htmlFor="json-collection-input"
                  className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
                >
                  O pega el contenido JSON de la colección directamente:
                </label>
                <textarea
                  id="json-collection-input"
                  value={collectionJsonInput}
                  onChange={(e) => setCollectionJsonInput(e.target.value)}
                  placeholder='{\n  "info": { "name": "Mi API" },\n  "item": [ ... ]\n}'
                  rows={5}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-3 font-mono text-xs text-slate-900 dark:text-slate-100 focus:border-amber-500 focus:outline-none resize-none"
                />
              </div>

              <button
                type="submit"
                disabled={busy || !collectionJsonInput.trim()}
                className="flex items-center gap-2 rounded-lg bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-semibold px-4 py-2 text-xs"
              >
                <Upload className="w-4 h-4" />
                <span>Importar JSON pegado</span>
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
