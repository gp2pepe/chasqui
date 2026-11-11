import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Send,
  Plus,
  Trash2,
  KeyRound,
  FolderGit2,
  Lock,
  Unlock,
  Globe,
  FileCode2,
  CheckCircle2,
  AlertCircle,
  Copy,
  Check,
  Info,
  ListTree,
  Code2,
  Zap,
  Terminal,
  Search,
  Folder,
  ChevronDown,
  ChevronRight,
  Shield,
  SlidersHorizontal,
  Files,
  X,
  Sun,
  Moon,
  Languages,
} from "lucide-react";
import { chasquiApi } from "./api";
import type {
  ApiRequest,
  HttpExecutionResult,
  WorkspaceStatusInfo,
} from "./types";
import { VaultModal } from "./components/VaultModal";
import { WorkspaceSettingsModal } from "./components/WorkspaceSettingsModal";
import { LoadTestPanel } from "./components/LoadTestPanel";
import { CodeModal } from "./components/CodeModal";
import { EnvironmentModal } from "./components/EnvironmentModal";
import { I18nProvider, useI18n } from "./i18n";
import { ThemeProvider, useTheme } from "./theme/ThemeContext";

const METHOD_COLORS: Record<ApiRequest["method"], string> = {
  GET: "text-emerald-500 dark:text-emerald-400 bg-emerald-500/10 border-emerald-500/30",
  POST: "text-amber-500 dark:text-amber-400 bg-amber-500/10 border-amber-500/30",
  PUT: "text-sky-500 dark:text-sky-400 bg-sky-500/10 border-sky-500/30",
  PATCH: "text-purple-500 dark:text-purple-400 bg-purple-500/10 border-purple-500/30",
  DELETE: "text-rose-500 dark:text-rose-400 bg-rose-500/10 border-rose-500/30",
};

export interface KeyValueRow {
  rowId: string;
  key: string;
  value: string;
  enabled: boolean;
}

type RequestEditorTab = "headers" | "params" | "body" | "auth";
type ResponseViewerTab = "body" | "headers" | "info" | "benchmark";

let kvRowCounter = 0;
function createKvRow(key = "", value = "", enabled = true): KeyValueRow {
  kvRowCounter += 1;
  return {
    rowId: `kv_${Date.now()}_${kvRowCounter}`,
    key,
    value,
    enabled,
  };
}

function recordToKvRows(record: Record<string, string>): KeyValueRow[] {
  const entries = Object.entries(record).map(([k, v]) =>
    createKvRow(k, v, true)
  );
  return entries.length > 0 ? entries : [createKvRow()];
}

function kvRowsToRecord(rows: readonly KeyValueRow[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const row of rows) {
    if (row.enabled && row.key.trim()) {
      out[row.key.trim()] = row.value;
    }
  }
  return out;
}

function getMethodTextColor(method: ApiRequest["method"]): string {
  if (method === "GET") return "text-emerald-500 dark:text-emerald-400";
  if (method === "POST") return "text-amber-500 dark:text-amber-400";
  if (method === "DELETE") return "text-rose-500 dark:text-rose-400";
  return "text-sky-500 dark:text-sky-400";
}

function getStatusBadgeClass(status: number): string {
  if (status >= 200 && status < 300) {
    return "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30";
  }
  if (status >= 300 && status < 400) {
    return "bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30";
  }
  return "bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30";
}

function getResponseTextToCopy(
  response: HttpExecutionResult,
  responseTab: ResponseViewerTab,
  bodyFormat: "pretty" | "raw"
): string {
  if (responseTab === "headers") {
    return JSON.stringify(response.headers, null, 2);
  }
  if (bodyFormat === "pretty") {
    return response.body;
  }
  return response.raw_body || response.body;
}

interface TopNavbarProps {
  readonly workspaceInfo: WorkspaceStatusInfo | null;
  readonly secretKeysCount: number;
  readonly onChangeActiveEnvironment: (envName: string) => void;
  readonly onOpenEnvModal: () => void;
  readonly onOpenCodeModal: () => void;
  readonly onOpenVaultModal: () => void;
  readonly onOpenSettingsModal: () => void;
}

function TopNavbar({
  workspaceInfo,
  secretKeysCount,
  onChangeActiveEnvironment,
  onOpenEnvModal,
  onOpenCodeModal,
  onOpenVaultModal,
  onOpenSettingsModal,
}: TopNavbarProps) {
  const { t, locale, availableLocales, setLocale } = useI18n();
  const { theme, toggleTheme } = useTheme();

  return (
    <header className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-slate-900/80 backdrop-blur px-4 py-2 transition-colors">
      <div className="flex items-center gap-3">
        <img
          src="/logo_chasqui.png"
          alt="Chasqui Logo"
          className="w-9 h-9 rounded-lg object-contain shadow-md"
        />
        <div className="flex flex-col leading-tight">
          <div className="flex items-center gap-2">
            <span className="font-extrabold text-amber-500 dark:text-amber-400 tracking-wide text-base">
              CHASQUI
            </span>
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-600 dark:text-amber-300 border border-amber-500/20">
              v0.1.0
            </span>
          </div>
          <span className="text-[11px] text-slate-500 dark:text-slate-400 hidden sm:inline">
            {t("nav.subtitle")}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {/* Environment selector */}
        {workspaceInfo && (
          <div className="flex items-center rounded-lg border border-slate-300 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-xs overflow-hidden">
            <div className="flex items-center gap-1.5 px-2.5 py-1">
              <Globe className="w-3.5 h-3.5 text-sky-500 dark:text-sky-400" />
              <span className="text-slate-500 dark:text-slate-400 hidden sm:inline">
                {t("nav.environment")}
              </span>
              <select
                value={workspaceInfo.config.active_environment || "dev"}
                onChange={(e) => onChangeActiveEnvironment(e.target.value)}
                className="bg-transparent font-medium text-slate-800 dark:text-slate-100 focus:outline-none cursor-pointer"
              >
                {workspaceInfo.environments.map((env) => (
                  <option
                    key={String(env.name)}
                    value={String(env.name)}
                    className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
                  >
                    {String(env.name)}.toml
                  </option>
                ))}
              </select>
            </div>
            <button
              type="button"
              onClick={onOpenEnvModal}
              className="border-l border-slate-300 dark:border-slate-800 bg-slate-100 dark:bg-slate-900 hover:bg-slate-200 dark:hover:bg-slate-800 px-2 py-1.5 text-slate-600 dark:text-slate-300"
              title={t("nav.edit_environments")}
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Language Selector (Auto-discovered locales) */}
        <div className="flex items-center rounded-lg border border-slate-300 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-2 py-1 text-xs">
          <Languages className="w-3.5 h-3.5 text-amber-500 dark:text-amber-400 mr-1.5" />
          <select
            value={locale}
            onChange={(e) => setLocale(e.target.value)}
            className="bg-transparent font-medium text-slate-800 dark:text-slate-100 focus:outline-none cursor-pointer"
            aria-label={t("nav.language")}
          >
            {availableLocales.map((loc) => (
              <option
                key={loc.code}
                value={loc.code}
                className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
              >
                {loc.flag ? `${loc.flag} ` : ""}{loc.name}
              </option>
            ))}
          </select>
        </div>

        {/* Theme Toggle (Sun / Moon) */}
        <button
          type="button"
          onClick={toggleTheme}
          className="p-1.5 rounded-lg border border-slate-300 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 transition"
          title={
            theme === "dark"
              ? t("nav.toggle_theme_light")
              : t("nav.toggle_theme_dark")
          }
          aria-label="Toggle theme"
        >
          {theme === "dark" ? (
            <Sun className="w-4 h-4 text-amber-400" />
          ) : (
            <Moon className="w-4 h-4 text-sky-600" />
          )}
        </button>

        {/* cURL / Import */}
        <button
          type="button"
          onClick={onOpenCodeModal}
          className="flex items-center gap-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 px-3 py-1.5 text-xs text-amber-600 dark:text-amber-300 font-medium transition"
          title={t("nav.curl_import_title")}
        >
          <Terminal className="w-3.5 h-3.5" />
          <span>{t("nav.curl_import")}</span>
        </button>

        {/* Secret Vault */}
        <button
          type="button"
          onClick={onOpenVaultModal}
          className={`flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
            workspaceInfo?.vault_unlocked
              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-300 hover:bg-emerald-500/20"
              : "border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-300 hover:bg-amber-500/20"
          }`}
        >
          {workspaceInfo?.vault_unlocked ? (
            <>
              <Unlock className="w-3.5 h-3.5" />
              <span>{t("nav.vault")} ({secretKeysCount})</span>
            </>
          ) : (
            <>
              <Lock className="w-3.5 h-3.5" />
              <span>{t("nav.vault")}</span>
            </>
          )}
        </button>

        {/* Workspace & Git */}
        <button
          type="button"
          onClick={onOpenSettingsModal}
          className="flex items-center gap-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 px-3 py-1.5 text-xs text-slate-700 dark:text-slate-200 transition"
        >
          <FolderGit2 className="w-3.5 h-3.5 text-sky-500 dark:text-sky-400" />
          <span className="hidden sm:inline">{t("nav.workspace_git")}</span>
        </button>
      </div>
    </header>
  );
}

interface CollectionsSidebarProps {
  readonly groupedRequests: Record<string, ApiRequest[]>;
  readonly activeReqId: string | undefined;
  readonly searchQuery: string;
  readonly collapsedFolders: Record<string, boolean>;
  readonly workspaceInfo: WorkspaceStatusInfo | null;
  readonly onSearchChange: (q: string) => void;
  readonly onToggleFolder: (folderName: string) => void;
  readonly onSelectRequest: (req: ApiRequest) => void;
  readonly onDuplicateRequest: (req: ApiRequest) => void;
  readonly onDeleteRequest: (id: string) => void;
  readonly onCreateNewRequest: () => void;
  readonly onOpenImportModal: () => void;
}

function CollectionsSidebar({
  groupedRequests,
  activeReqId,
  searchQuery,
  collapsedFolders,
  workspaceInfo,
  onSearchChange,
  onToggleFolder,
  onSelectRequest,
  onDuplicateRequest,
  onDeleteRequest,
  onCreateNewRequest,
  onOpenImportModal,
}: CollectionsSidebarProps) {
  const { t } = useI18n();

  return (
    <aside className="w-72 border-r border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 flex flex-col transition-colors">
      <div className="p-3 border-b border-slate-200 dark:border-slate-800 space-y-2.5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            {t("sidebar.collections_title")}
          </span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={onOpenImportModal}
              className="rounded-md bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 px-2 py-1 text-[11px]"
              title={t("sidebar.import_tooltip")}
            >
              {t("sidebar.import_btn")}
            </button>
            <button
              type="button"
              onClick={onCreateNewRequest}
              className="flex items-center gap-1 rounded-md bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-600 dark:text-amber-300 px-2 py-1 text-xs font-medium"
              title={t("sidebar.new_tooltip")}
            >
              <Plus className="w-3.5 h-3.5" />
              {t("sidebar.new_btn")}
            </button>
          </div>
        </div>

        <div className="relative">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={t("sidebar.filter_placeholder")}
            className="w-full rounded-lg border border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-950 pl-8 pr-2.5 py-1.5 text-xs text-slate-900 dark:text-slate-200 focus:border-amber-500 focus:outline-none"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        {Object.entries(groupedRequests).map(([folderName, items]) => {
          const isCollapsed = !!collapsedFolders[folderName];
          return (
            <div key={folderName} className="space-y-1">
              <button
                type="button"
                onClick={() => onToggleFolder(folderName)}
                className="w-full flex items-center justify-between px-2 py-1 text-[11px] font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 rounded hover:bg-slate-200/50 dark:hover:bg-slate-900/60"
              >
                <span className="flex items-center gap-1.5 truncate">
                  {isCollapsed ? (
                    <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                  ) : (
                    <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                  )}
                  <Folder className="w-3.5 h-3.5 text-amber-500 dark:text-amber-400/80" />
                  <span className="truncate">{folderName}</span>
                </span>
                <span className="text-[10px] text-slate-400">
                  {items.length}
                </span>
              </button>

              {!isCollapsed && (
                <div className="space-y-0.5 pl-2">
                  {items.map((r) => {
                    const isSelected = activeReqId === r.id;
                    return (
                      <div
                        key={r.id}
                        className={`group flex items-center justify-between rounded-lg px-2 py-1 text-xs transition ${
                          isSelected
                            ? "bg-slate-200 dark:bg-slate-800 text-slate-900 dark:text-slate-100 border border-slate-300 dark:border-slate-700"
                            : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-900 hover:text-slate-900 dark:hover:text-slate-200 border border-transparent"
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => onSelectRequest(r)}
                          className="flex items-center gap-2 min-w-0 flex-1 text-left py-0.5"
                        >
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-bold border ${
                              METHOD_COLORS[r.method] || METHOD_COLORS.GET
                            }`}
                          >
                            {r.method}
                          </span>
                          <span className="truncate font-medium">{r.name}</span>
                        </button>
                        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100">
                          <button
                            type="button"
                            onClick={() => onDuplicateRequest(r)}
                            className="p-1 text-slate-400 hover:text-amber-500"
                            title={t("sidebar.duplicate_tooltip")}
                          >
                            <Files className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => onDeleteRequest(r.id)}
                            className="p-1 text-slate-400 hover:text-rose-500"
                            title={t("sidebar.delete_tooltip")}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {workspaceInfo && (
        <div className="border-t border-slate-200 dark:border-slate-800 p-3 bg-slate-100/70 dark:bg-slate-950/60 text-[11px] text-slate-500 dark:text-slate-400 space-y-1">
          <div className="flex items-center justify-between">
            <span className="font-medium text-slate-700 dark:text-slate-300">
              {t("sidebar.directory_label")}
            </span>
            <span
              className={
                workspaceInfo.config.git.commit_encrypted_secrets
                  ? "text-amber-600 dark:text-amber-400"
                  : "text-emerald-600 dark:text-emerald-400"
              }
            >
              {workspaceInfo.config.git.commit_encrypted_secrets
                ? t("sidebar.git_vault_included")
                : t("sidebar.git_vault_ignored")}
            </span>
          </div>
          <div
            className="truncate font-mono text-slate-500"
            title={workspaceInfo.workspace_dir}
          >
            {workspaceInfo.workspace_dir}
          </div>
        </div>
      )}
    </aside>
  );
}

interface RequestTabsBarProps {
  readonly openTabIds: readonly string[];
  readonly activeReq: ApiRequest;
  readonly requests: readonly ApiRequest[];
  readonly onSelectRequest: (req: ApiRequest) => void;
  readonly onCloseTab: (id: string) => void;
  readonly onCreateNewRequest: () => void;
}

function RequestTabsBar({
  openTabIds,
  activeReq,
  requests,
  onSelectRequest,
  onCloseTab,
  onCreateNewRequest,
}: RequestTabsBarProps) {
  const { t } = useI18n();

  return (
    <div className="flex items-center border-b border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-950 px-2 overflow-x-auto transition-colors">
      {openTabIds.map((tabId) => {
        const reqItem =
          tabId === activeReq.id
            ? activeReq
            : requests.find((r) => r.id === tabId);
        if (!reqItem) return null;
        const isCurrent = reqItem.id === activeReq.id;
        return (
          <div
            key={reqItem.id}
            className={`group flex items-center gap-1.5 px-2.5 py-1.5 text-xs border-r border-slate-200 dark:border-slate-800/80 shrink-0 max-w-[230px] border-t-2 transition ${
              isCurrent
                ? "bg-white dark:bg-slate-900 border-t-amber-500 text-slate-900 dark:text-slate-100 font-medium shadow-sm"
                : "bg-slate-100 dark:bg-slate-950 border-t-transparent text-slate-500 hover:bg-slate-200/60 dark:hover:bg-slate-900/50 hover:text-slate-900 dark:hover:text-slate-200"
            }`}
          >
            <button
              type="button"
              onClick={() => onSelectRequest(reqItem)}
              className="flex items-center gap-2 truncate text-left py-0.5"
            >
              <span
                className={`text-[10px] font-bold ${getMethodTextColor(
                  reqItem.method
                )}`}
              >
                {reqItem.method}
              </span>
              <span className="truncate">{reqItem.name}</span>
            </button>
            {openTabIds.length > 1 && (
              <button
                type="button"
                onClick={() => onCloseTab(reqItem.id)}
                className="opacity-60 hover:opacity-100 p-0.5 rounded hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-700 dark:hover:text-slate-100"
                title={t("tabs.close")}
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        );
      })}
      <button
        type="button"
        onClick={onCreateNewRequest}
        className="p-2 text-slate-400 hover:text-amber-500"
        title={t("tabs.new_tab")}
      >
        <Plus className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

interface KeyValueEditorListProps {
  readonly rows: readonly KeyValueRow[];
  readonly keyPlaceholder: string;
  readonly valuePlaceholder: string;
  readonly addLabel: string;
  readonly toggleTitle: string;
  readonly highlightValue?: boolean;
  readonly onChangeRows: (next: KeyValueRow[]) => void;
}

function KeyValueEditorList({
  rows,
  keyPlaceholder,
  valuePlaceholder,
  addLabel,
  toggleTitle,
  highlightValue = false,
  onChangeRows,
}: KeyValueEditorListProps) {
  const enabledValColor = highlightValue
    ? "text-amber-700 dark:text-amber-200"
    : "text-slate-900 dark:text-slate-200";

  return (
    <div className="space-y-2">
      {rows.map((row, idx) => (
        <div key={row.rowId} className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={row.enabled}
            onChange={(e) => {
              const copy = [...rows];
              copy[idx] = { ...row, enabled: e.target.checked };
              onChangeRows(copy);
            }}
            title={toggleTitle}
            className="rounded border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-amber-500"
          />
          <input
            type="text"
            value={row.key}
            onChange={(e) => {
              const copy = [...rows];
              copy[idx] = { ...row, key: e.target.value };
              onChangeRows(copy);
            }}
            placeholder={keyPlaceholder}
            className={`w-1/3 rounded-md border border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-1.5 text-xs font-mono ${
              row.enabled
                ? "text-slate-900 dark:text-slate-200"
                : "text-slate-400 line-through"
            }`}
          />
          <input
            type="text"
            value={row.value}
            onChange={(e) => {
              const copy = [...rows];
              copy[idx] = { ...row, value: e.target.value };
              onChangeRows(copy);
            }}
            placeholder={valuePlaceholder}
            className={`flex-1 rounded-md border border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-1.5 text-xs font-mono ${
              row.enabled ? enabledValColor : "text-slate-400 line-through"
            }`}
          />
          <button
            type="button"
            onClick={() => onChangeRows(rows.filter((_, i) => i !== idx))}
            className="px-2 text-slate-400 hover:text-rose-500"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={() => onChangeRows([...rows, createKvRow()])}
        className="text-xs text-amber-600 dark:text-amber-400 hover:underline flex items-center gap-1 pt-1 font-medium"
      >
        <Plus className="w-3.5 h-3.5" /> {addLabel}
      </button>
    </div>
  );
}

interface RequestBuilderPanelProps {
  readonly activeReq: ApiRequest;
  readonly headerRows: readonly KeyValueRow[];
  readonly paramRows: readonly KeyValueRow[];
  readonly secretKeys: readonly string[];
  readonly activeTab: RequestEditorTab;
  readonly responseTab: ResponseViewerTab;
  readonly sending: boolean;
  readonly autoSaveStatus: "saved" | "saving" | "idle";
  readonly onChangeActiveReq: (req: ApiRequest) => void;
  readonly onChangeHeaderRows: (rows: KeyValueRow[]) => void;
  readonly onChangeParamRows: (rows: KeyValueRow[]) => void;
  readonly onChangeActiveTab: (tab: RequestEditorTab) => void;
  readonly onOpenBenchmarkTab: () => void;
  readonly onOpenVaultModal: () => void;
  readonly onDuplicateRequest: (req: ApiRequest) => void;
  readonly onSendRequest: (e: React.FormEvent) => void;
  readonly onApplyAuthPreset: (
    type: "none" | "bearer" | "basic" | "apikey_header",
    secretOrValue: string
  ) => void;
}

function RequestBuilderPanel({
  activeReq,
  headerRows,
  paramRows,
  secretKeys,
  activeTab,
  responseTab,
  sending,
  autoSaveStatus,
  onChangeActiveReq,
  onChangeHeaderRows,
  onChangeParamRows,
  onChangeActiveTab,
  onOpenBenchmarkTab,
  onOpenVaultModal,
  onDuplicateRequest,
  onSendRequest,
  onApplyAuthPreset,
}: RequestBuilderPanelProps) {
  const { t } = useI18n();

  const getTabLabel = (tab: RequestEditorTab) => {
    if (tab === "headers") {
      const count = headerRows.filter((r) => r.enabled && r.key.trim()).length;
      return `${t("builder.tab_headers")} (${count})`;
    }
    if (tab === "params") {
      const count = paramRows.filter((r) => r.enabled && r.key.trim()).length;
      return `${t("builder.tab_params")} (${count})`;
    }
    if (tab === "body") return t("builder.tab_body");
    return t("builder.tab_auth");
  };

  return (
    <section className="flex-1 flex flex-col border-b lg:border-b-0 lg:border-r border-slate-200 dark:border-slate-800 overflow-hidden bg-white dark:bg-slate-950 transition-colors">
      <form
        onSubmit={onSendRequest}
        className="p-4 border-b border-slate-200 dark:border-slate-800 space-y-3 bg-slate-50/50 dark:bg-slate-900/20"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 flex-1 min-w-[200px]">
            <input
              type="text"
              value={activeReq.folder || ""}
              onChange={(e) =>
                onChangeActiveReq({
                  ...activeReq,
                  folder: e.target.value,
                })
              }
              className="w-28 rounded border border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-950 px-2 py-1 text-xs text-amber-600 dark:text-amber-400 focus:border-amber-500 focus:outline-none"
              placeholder={t("builder.folder_placeholder")}
              title={t("builder.folder_title")}
            />
            <span className="text-slate-400">/</span>
            <input
              type="text"
              value={activeReq.name}
              onChange={(e) =>
                onChangeActiveReq({ ...activeReq, name: e.target.value })
              }
              className="bg-transparent text-sm font-semibold text-slate-900 dark:text-slate-100 focus:outline-none border-b border-transparent focus:border-amber-500 px-1 py-0.5 flex-1"
              placeholder={t("builder.name_placeholder")}
            />
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onDuplicateRequest(activeReq)}
              className="flex items-center gap-1 rounded border border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 px-2 py-1 text-[11px] text-slate-700 dark:text-slate-300"
              title="Ctrl+D"
            >
              <Files className="w-3 h-3" />
              <span>{t("builder.clone")}</span>
            </button>
            <span className="text-[11px] font-mono text-slate-500 hidden sm:flex items-center gap-1">
              <FileCode2 className="w-3.5 h-3.5" />
              {activeReq.id}.toml
            </span>
            <span className="flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-950">
              <CheckCircle2
                className={`w-3 h-3 ${
                  autoSaveStatus === "saved"
                    ? "text-emerald-500"
                    : "text-amber-500 animate-spin"
                }`}
              />
              <span className="text-slate-600 dark:text-slate-400">
                {autoSaveStatus === "saved"
                  ? t("builder.autosaved")
                  : t("builder.saving")}
              </span>
            </span>
          </div>
        </div>

        <div className="flex gap-2">
          {/* Method Dropdown */}
          <select
            value={activeReq.method}
            onChange={(e) =>
              onChangeActiveReq({
                ...activeReq,
                method: e.target.value as ApiRequest["method"],
              })
            }
            className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs font-bold text-amber-600 dark:text-amber-400 focus:border-amber-500 focus:outline-none cursor-pointer"
          >
            <option value="GET" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 font-bold">GET</option>
            <option value="POST" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 font-bold">POST</option>
            <option value="PUT" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 font-bold">PUT</option>
            <option value="PATCH" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 font-bold">PATCH</option>
            <option value="DELETE" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 font-bold">DELETE</option>
          </select>

          <input
            type="text"
            value={activeReq.url}
            onChange={(e) =>
              onChangeActiveReq({ ...activeReq, url: e.target.value })
            }
            placeholder={t("builder.url_placeholder")}
            className="flex-1 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3.5 py-2 text-xs font-mono text-slate-900 dark:text-slate-100 focus:border-amber-500 focus:outline-none"
          />

          <button
            type="submit"
            disabled={sending}
            title={t("builder.send_tooltip")}
            className="flex items-center gap-2 rounded-lg bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-semibold px-4 py-2 text-xs transition"
          >
            <Send className="w-3.5 h-3.5" />
            <span>{sending ? t("builder.sending") : t("builder.send")}</span>
          </button>

          <button
            type="button"
            onClick={onOpenBenchmarkTab}
            className={`flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold transition ${
              responseTab === "benchmark"
                ? "border-amber-500 bg-amber-500/20 text-amber-600 dark:text-amber-300"
                : "border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-amber-600 dark:text-amber-300"
            }`}
            title={t("builder.benchmark_tooltip")}
          >
            <Zap className="w-3.5 h-3.5" />
            <span className="hidden xl:inline">{t("builder.benchmark")}</span>
          </button>
        </div>
      </form>

      {/* Secret Tags Quick Bar */}
      <div className="flex items-center justify-between px-4 py-2 bg-slate-100 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 text-[11px]">
        <div className="flex items-center gap-2 overflow-x-auto">
          <span className="text-slate-500 flex items-center gap-1 shrink-0">
            <KeyRound className="w-3 h-3 text-amber-500" />
            {t("builder.secret_tags")}
          </span>
          {secretKeys.length === 0 ? (
            <button
              type="button"
              onClick={onOpenVaultModal}
              className="text-amber-600 dark:text-amber-400 hover:underline"
            >
              {t("builder.create_first_secret")}
            </button>
          ) : (
            secretKeys.map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => navigator.clipboard.writeText(`{{secret:${k}}}`)}
                className="rounded bg-amber-500/10 border border-amber-500/30 px-2 py-0.5 font-mono text-amber-600 dark:text-amber-300 hover:bg-amber-500/20 shrink-0"
                title={t("builder.copy_tag_tooltip")}
              >
                {`{{secret:${k}}}`}
              </button>
            ))
          )}
        </div>
      </div>

      {/* Request Tabs */}
      <div className="flex border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/40 px-4">
        {(["headers", "params", "body", "auth"] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => onChangeActiveTab(tab)}
            className={`px-4 py-2.5 text-xs font-medium border-b-2 transition ${
              activeTab === tab
                ? "border-amber-500 text-amber-600 dark:text-amber-300"
                : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
            }`}
          >
            {getTabLabel(tab)}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {activeTab === "headers" && (
          <KeyValueEditorList
            rows={headerRows}
            keyPlaceholder={t("builder.header_key_placeholder")}
            valuePlaceholder={t("builder.header_val_placeholder")}
            addLabel={t("builder.add_header")}
            toggleTitle={t("builder.toggle_header")}
            highlightValue
            onChangeRows={onChangeHeaderRows}
          />
        )}

        {activeTab === "params" && (
          <KeyValueEditorList
            rows={paramRows}
            keyPlaceholder={t("builder.param_key_placeholder")}
            valuePlaceholder={t("builder.param_val_placeholder")}
            addLabel={t("builder.add_param")}
            toggleTitle={t("builder.toggle_param")}
            onChangeRows={onChangeParamRows}
          />
        )}

        {activeTab === "body" && (
          <div className="flex flex-col h-full space-y-3">
            <div className="flex items-center gap-3 text-xs">
              <span className="text-slate-500">{t("builder.content_type")}</span>
              {(["none", "json", "text"] as const).map((ct) => (
                <label
                  key={ct}
                  className="flex items-center gap-1.5 cursor-pointer text-slate-700 dark:text-slate-300"
                >
                  <input
                    type="radio"
                    checked={(activeReq.body?.content_type || "none") === ct}
                    onChange={() =>
                      onChangeActiveReq({
                        ...activeReq,
                        body: {
                          content_type: ct,
                          payload: activeReq.body?.payload || "",
                        },
                      })
                    }
                  />
                  <span className="uppercase">{ct}</span>
                </label>
              ))}
            </div>
            {activeReq.body?.content_type !== "none" && (
              <textarea
                value={activeReq.body?.payload || ""}
                onChange={(e) =>
                  onChangeActiveReq({
                    ...activeReq,
                    body: {
                      content_type: activeReq.body?.content_type || "json",
                      payload: e.target.value,
                    },
                  })
                }
                placeholder='{\n  "api_key": "{{secret:API_TOKEN}}"\n}'
                className="flex-1 w-full rounded-lg border border-slate-300 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 p-3 font-mono text-xs text-slate-900 dark:text-slate-100 focus:border-amber-500 focus:outline-none resize-none"
              />
            )}
          </div>
        )}

        {activeTab === "auth" && (
          <div className="space-y-4 text-xs">
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 p-4 space-y-3">
              <div className="flex items-center gap-2 font-semibold text-slate-800 dark:text-slate-200">
                <Shield className="w-4 h-4 text-amber-500" />
                <span>{t("builder.auth_wizard_title")}</span>
              </div>
              <p className="text-slate-600 dark:text-slate-400">
                {t("builder.auth_wizard_desc")}
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
                {secretKeys.length === 0 ? (
                  <div className="sm:col-span-3">
                    <button
                      type="button"
                      onClick={onOpenVaultModal}
                      className="rounded-lg bg-amber-500/20 border border-amber-500/40 text-amber-700 dark:text-amber-300 px-3 py-2 font-medium"
                    >
                      {t("builder.auth_add_secret")}
                    </button>
                  </div>
                ) : (
                  secretKeys.map((k) => (
                    <div
                      key={k}
                      className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 p-3 space-y-2"
                    >
                      <div className="font-mono text-amber-600 dark:text-amber-300 font-semibold truncate">
                        {`{{secret:${k}}}`}
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            onApplyAuthPreset("bearer", `{{secret:${k}}}`);
                            onChangeActiveTab("headers");
                          }}
                          className="rounded bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 px-2 py-1 text-[11px] text-slate-700 dark:text-slate-200"
                        >
                          {t("builder.use_as_bearer")}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            onApplyAuthPreset(
                              "apikey_header",
                              `{{secret:${k}}}`
                            );
                            onChangeActiveTab("headers");
                          }}
                          className="rounded bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 px-2 py-1 text-[11px] text-slate-700 dark:text-slate-200"
                        >
                          {t("builder.use_as_apikey")}
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

interface ResponseViewerPanelProps {
  readonly activeReq: ApiRequest;
  readonly currentBuiltRequest: ApiRequest | null;
  readonly response: HttpExecutionResult | null;
  readonly execError: string | null;
  readonly responseTab: ResponseViewerTab;
  readonly bodyFormat: "pretty" | "raw";
  readonly copiedResponse: boolean;
  readonly onChangeResponseTab: (tab: ResponseViewerTab) => void;
  readonly onChangeBodyFormat: (fmt: "pretty" | "raw") => void;
  readonly onCopyResponse: () => void;
}

function ResponseViewerPanel({
  activeReq,
  currentBuiltRequest,
  response,
  execError,
  responseTab,
  bodyFormat,
  copiedResponse,
  onChangeResponseTab,
  onChangeBodyFormat,
  onCopyResponse,
}: ResponseViewerPanelProps) {
  const { t } = useI18n();

  const responseHeaderEntries = response
    ? Object.entries(response.headers)
    : [];
  const sentHeaderEntries = response
    ? Object.entries(response.request_headers || {})
    : [];

  return (
    <section className="flex-1 flex flex-col bg-slate-50 dark:bg-slate-950 overflow-hidden transition-colors">
      <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 px-4 py-3 bg-white/70 dark:bg-slate-900/30">
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
          {responseTab === "benchmark"
            ? t("response.title_benchmark")
            : t("response.title_http")}
        </span>
        {response && responseTab !== "benchmark" && (
          <div className="flex flex-wrap items-center gap-2.5 text-xs">
            <span
              className={`px-2 py-0.5 rounded font-bold border ${getStatusBadgeClass(
                response.status
              )}`}
            >
              {response.status} {response.status_text}
            </span>
            <span className="rounded bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 px-2 py-0.5 font-mono text-[11px] text-slate-700 dark:text-slate-300">
              {response.http_version || "HTTP/1.1"}
            </span>
            <span className="text-slate-500 font-mono">
              {response.duration_ms} ms
            </span>
            <span className="text-slate-500 font-mono">
              {response.size_bytes} B
            </span>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 bg-slate-100/60 dark:bg-slate-900/40 px-4">
        <div className="flex overflow-x-auto">
          <button
            type="button"
            onClick={() => onChangeResponseTab("body")}
            className={`flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium border-b-2 transition ${
              responseTab === "body"
                ? "border-emerald-500 text-emerald-600 dark:text-emerald-300"
                : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
            }`}
          >
            <Code2 className="w-3.5 h-3.5" />
            <span>{t("response.tab_body")}</span>
          </button>
          <button
            type="button"
            onClick={() => onChangeResponseTab("headers")}
            className={`flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium border-b-2 transition ${
              responseTab === "headers"
                ? "border-emerald-500 text-emerald-600 dark:text-emerald-300"
                : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
            }`}
          >
            <ListTree className="w-3.5 h-3.5" />
            <span>{t("response.tab_headers")} ({responseHeaderEntries.length})</span>
          </button>
          <button
            type="button"
            onClick={() => onChangeResponseTab("info")}
            className={`flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium border-b-2 transition ${
              responseTab === "info"
                ? "border-emerald-500 text-emerald-600 dark:text-emerald-300"
                : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
            }`}
          >
            <Info className="w-3.5 h-3.5" />
            <span>{t("response.tab_info")}</span>
          </button>
          <button
            type="button"
            onClick={() => onChangeResponseTab("benchmark")}
            className={`flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold border-b-2 transition ${
              responseTab === "benchmark"
                ? "border-amber-500 text-amber-600 dark:text-amber-300"
                : "border-transparent text-amber-600/80 dark:text-amber-400/80 hover:text-amber-600"
            }`}
          >
            <Zap className="w-3.5 h-3.5" />
            <span>{t("response.tab_benchmark")}</span>
          </button>
        </div>

        {response && responseTab !== "benchmark" && (
          <div className="flex items-center gap-2 py-1">
            {responseTab === "body" && (
              <div className="flex rounded-md border border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-950 p-0.5 text-[11px]">
                <button
                  type="button"
                  onClick={() => onChangeBodyFormat("pretty")}
                  className={`px-2 py-0.5 rounded ${
                    bodyFormat === "pretty"
                      ? "bg-slate-200 dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-medium"
                      : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                  }`}
                >
                  {t("response.pretty")}
                </button>
                <button
                  type="button"
                  onClick={() => onChangeBodyFormat("raw")}
                  className={`px-2 py-0.5 rounded ${
                    bodyFormat === "raw"
                      ? "bg-slate-200 dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-medium"
                      : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                  }`}
                >
                  {t("response.raw")}
                </button>
              </div>
            )}

            <button
              type="button"
              onClick={onCopyResponse}
              className="flex items-center gap-1 rounded-md border border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 px-2.5 py-1 text-[11px] text-slate-700 dark:text-slate-300"
            >
              {copiedResponse ? (
                <>
                  <Check className="w-3 h-3 text-emerald-500" />
                  <span className="text-emerald-500">{t("response.copied")}</span>
                </>
              ) : (
                <>
                  <Copy className="w-3 h-3" />
                  <span>{t("response.copy")}</span>
                </>
              )}
            </button>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {responseTab === "benchmark" && currentBuiltRequest ? (
          <LoadTestPanel request={currentBuiltRequest} />
        ) : (
          <>
            {execError && (
              <div className="rounded-lg border border-rose-500/40 bg-rose-500/10 p-4 text-xs text-rose-700 dark:text-rose-300 flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <div className="font-semibold">
                    {t("response.error_title")}
                  </div>
                  <div className="font-mono whitespace-pre-wrap">
                    {execError}
                  </div>
                </div>
              </div>
            )}

            {!response && !execError && (
              <div className="h-full flex flex-col items-center justify-center text-center text-slate-500 text-xs space-y-3">
                <img
                  src="/logo_chasqui.png"
                  alt="Chasqui"
                  className="w-16 h-16 opacity-80 drop-shadow-lg"
                />
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-amber-500 dark:text-amber-400 tracking-wide">
                    CHASQUI
                  </span>
                  <span className="text-slate-400">•</span>
                  <span className="text-slate-500">
                    {t("response.empty_title")}
                  </span>
                </div>
                <p className="max-w-sm text-slate-500">
                  {t("response.empty_desc_prefix")}{" "}
                  <strong className="text-slate-700 dark:text-slate-300">
                    {t("response.empty_desc_send")}
                  </strong>{" "}
                  <span className="font-mono text-slate-400">
                    {t("response.empty_desc_shortcut")}
                  </span>{" "}
                  {t("response.empty_desc_middle")}{" "}
                  <strong className="text-slate-700 dark:text-slate-300">
                    {t("response.empty_desc_benchmark")}
                  </strong>
                  {t("response.empty_desc_suffix")}
                </p>
              </div>
            )}

            {response && responseTab === "body" && (
              <pre className="rounded-lg border border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-900/80 p-4 font-mono text-xs text-emerald-600 dark:text-emerald-300 overflow-x-auto select-text whitespace-pre-wrap">
                {bodyFormat === "pretty"
                  ? response.body
                  : response.raw_body || response.body}
              </pre>
            )}

            {response && responseTab === "headers" && (
              <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 overflow-hidden">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/70 text-slate-500">
                      <th className="py-2.5 px-3 font-semibold w-1/3">
                        {t("response.col_header")}
                      </th>
                      <th className="py-2.5 px-3 font-semibold">
                        {t("response.col_value")}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800/70 font-mono select-text">
                    {responseHeaderEntries.map(([hk, hv]) => (
                      <tr key={hk} className="hover:bg-slate-50 dark:hover:bg-slate-900/90">
                        <td className="py-2 px-3 text-sky-600 dark:text-sky-300 font-medium align-top break-all">
                          {hk}
                        </td>
                        <td className="py-2 px-3 text-slate-700 dark:text-slate-200 break-all">
                          {hv}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {response && responseTab === "info" && (
              <div className="space-y-4 text-xs select-text">
                <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 p-4 space-y-2.5">
                  <div className="text-slate-500 font-semibold uppercase tracking-wider text-[11px]">
                    {t("response.network_summary")}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 font-mono">
                    <div className="p-2 rounded bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800/80">
                      <span className="text-slate-400 block text-[10px]">
                        {t("response.resolved_url")}
                      </span>
                      <span className="text-amber-600 dark:text-amber-300 break-all">
                        {response.method || activeReq.method}{" "}
                        {response.resolved_url}
                      </span>
                    </div>
                    <div className="p-2 rounded bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800/80">
                      <span className="text-slate-400 block text-[10px]">
                        {t("response.remote_ip")}
                      </span>
                      <span className="text-slate-700 dark:text-slate-200">
                        {response.remote_addr || "N/A"} (
                        {response.http_version || "HTTP/1.1"})
                      </span>
                    </div>
                    <div className="p-2 rounded bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800/80">
                      <span className="text-slate-400 block text-[10px]">
                        {t("response.status_code")}
                      </span>
                      <span className="text-emerald-500 font-semibold">
                        {response.status} {response.status_text}
                      </span>
                    </div>
                    <div className="p-2 rounded bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800/80">
                      <span className="text-slate-400 block text-[10px]">
                        {t("response.duration_size")}
                      </span>
                      <span className="text-slate-700 dark:text-slate-200">
                        {response.duration_ms} ms • {response.size_bytes} bytes
                      </span>
                    </div>
                  </div>
                </div>

                <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 overflow-hidden">
                  <div className="px-4 py-2.5 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/70 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                    {t("response.sent_headers")} ({sentHeaderEntries.length})
                  </div>
                  {sentHeaderEntries.length === 0 ? (
                    <div className="p-4 text-slate-400 italic">
                      {t("response.no_sent_headers")}
                    </div>
                  ) : (
                    <table className="w-full text-left border-collapse text-xs font-mono">
                      <tbody className="divide-y divide-slate-200 dark:divide-slate-800/70">
                        {sentHeaderEntries.map(([rk, rv]) => (
                          <tr key={rk}>
                            <td className="py-2 px-3 text-amber-600 dark:text-amber-300 w-1/3 break-all">
                              {rk}
                            </td>
                            <td className="py-2 px-3 text-slate-700 dark:text-slate-300 break-all">
                              {rv}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
}

function MainAppContent() {
  const { t } = useI18n();
  const [workspaceInfo, setWorkspaceInfo] =
    useState<WorkspaceStatusInfo | null>(null);
  const [requests, setRequests] = useState<ApiRequest[]>([]);
  const [openTabIds, setOpenTabIds] = useState<string[]>([]);
  const [activeReq, setActiveReq] = useState<ApiRequest | null>(null);
  const [secretKeys, setSecretKeys] = useState<string[]>([]);

  const [searchQuery, setSearchQuery] = useState("");
  const [collapsedFolders, setCollapsedFolders] = useState<
    Record<string, boolean>
  >({});

  const [activeTab, setActiveTab] = useState<RequestEditorTab>("headers");
  const [responseTab, setResponseTab] = useState<ResponseViewerTab>("body");
  const [bodyFormat, setBodyFormat] = useState<"pretty" | "raw">("pretty");
  const [copiedResponse, setCopiedResponse] = useState(false);

  const [responsesByReqId, setResponsesByReqId] = useState<
    Record<string, HttpExecutionResult>
  >({});
  const [execError, setExecError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [autoSaveStatus, setAutoSaveStatus] = useState<
    "saved" | "saving" | "idle"
  >("saved");

  const [vaultModalOpen, setVaultModalOpen] = useState(false);
  const [settingsModalOpen, setSettingsModalOpen] = useState(false);
  const [codeModalOpen, setCodeModalOpen] = useState(false);
  const [envModalOpen, setEnvModalOpen] = useState(false);

  const [headerRows, setHeaderRows] = useState<KeyValueRow[]>([]);
  const [paramRows, setParamRows] = useState<KeyValueRow[]>([]);

  const skipNextAutoSaveRef = useRef<boolean>(false);

  const selectRequest = (req: ApiRequest) => {
    skipNextAutoSaveRef.current = true;
    setActiveReq(req);
    setOpenTabIds((prev) => (prev.includes(req.id) ? prev : [...prev, req.id]));
    setExecError(null);
    setHeaderRows(recordToKvRows(req.headers));
    setParamRows(recordToKvRows(req.query_params));
    setAutoSaveStatus("saved");
  };

  const handleCreateNewRequest = () => {
    const id = `req_${Date.now().toString(36)}`;
    const newReq: ApiRequest = {
      id,
      name: "New HTTP Request",
      folder: "General",
      method: "GET",
      url: "{{base_url}}/get",
      headers: {
        Authorization: "Bearer {{secret:API_TOKEN}}",
      },
      query_params: {},
      body: {
        content_type: "none",
        payload: "",
      },
    };
    selectRequest(newReq);
    chasquiApi.saveRequest(newReq).then(setRequests);
  };

  const loadInitialData = async () => {
    const info = await chasquiApi.getWorkspaceInfo();
    setWorkspaceInfo(info);
    const reqList = await chasquiApi.listRequests();
    setRequests(reqList);
    const sKeys = await chasquiApi.listSecretKeys();
    setSecretKeys(sKeys);

    if (reqList.length > 0) {
      setOpenTabIds([reqList[0].id]);
      selectRequest(reqList[0]);
    } else {
      handleCreateNewRequest();
    }
  };

  useEffect(() => {
    loadInitialData();
  }, []);

  const buildCurrentRequestObject = (): ApiRequest | null => {
    if (!activeReq) return null;
    return {
      ...activeReq,
      headers: kvRowsToRecord(headerRows),
      query_params: kvRowsToRecord(paramRows),
    };
  };

  useEffect(() => {
    if (!activeReq) return;
    if (skipNextAutoSaveRef.current) {
      skipNextAutoSaveRef.current = false;
      return;
    }

    setAutoSaveStatus("saving");
    const timer = setTimeout(async () => {
      const built = buildCurrentRequestObject();
      if (!built) return;
      try {
        const updated = await chasquiApi.saveRequest(built);
        setRequests(updated);
        setAutoSaveStatus("saved");
      } catch {
        setAutoSaveStatus("idle");
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [activeReq, headerRows, paramRows]);

  const handleDuplicateRequest = async (sourceReq: ApiRequest) => {
    const base =
      sourceReq.id === activeReq?.id
        ? buildCurrentRequestObject() || sourceReq
        : sourceReq;
    const cloned: ApiRequest = {
      ...base,
      id: `${base.id}_copy_${Date.now().toString(36).slice(-4)}`,
      name: `${base.name} (Copy)`,
    };
    const updated = await chasquiApi.saveRequest(cloned);
    setRequests(updated);
    selectRequest(cloned);
  };

  const handleDeleteRequest = async (id: string) => {
    const updated = await chasquiApi.deleteRequest(id);
    setRequests(updated);
    setOpenTabIds((prev) => prev.filter((t) => t !== id));
    if (updated.length > 0) {
      selectRequest(updated[0]);
    } else {
      handleCreateNewRequest();
    }
  };

  const handleCloseTab = (id: string) => {
    const nextTabs = openTabIds.filter((t) => t !== id);
    setOpenTabIds(nextTabs);
    if (activeReq?.id !== id) return;
    const fallbackId = nextTabs.at(-1);
    const nextReq =
      requests.find((r) => r.id === fallbackId) || requests[0] || null;
    if (nextReq) {
      selectRequest(nextReq);
    }
  };

  const executeCurrentRequest = async () => {
    const built = buildCurrentRequestObject();
    if (!built || sending) return;
    setSending(true);
    setExecError(null);
    if (responseTab === "benchmark") {
      setResponseTab("body");
    }
    try {
      const updated = await chasquiApi.saveRequest(built);
      setRequests(updated);
      const res = await chasquiApi.executeRequest(built);
      setResponsesByReqId((prev) => ({ ...prev, [built.id]: res }));
    } catch (err) {
      setExecError(String(err));
    } finally {
      setSending(false);
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      const key = e.key.toLowerCase();
      if (e.key === "Enter") {
        e.preventDefault();
        executeCurrentRequest();
      } else if (key === "n") {
        e.preventDefault();
        handleCreateNewRequest();
      } else if (key === "d" && activeReq) {
        e.preventDefault();
        handleDuplicateRequest(activeReq);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  });

  const response = activeReq ? responsesByReqId[activeReq.id] || null : null;

  const handleCopyResponse = () => {
    if (!response) return;
    const textToCopy = getResponseTextToCopy(response, responseTab, bodyFormat);
    navigator.clipboard.writeText(textToCopy);
    setCopiedResponse(true);
    setTimeout(() => setCopiedResponse(false), 1800);
  };

  const groupedRequests = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const groups: Record<string, ApiRequest[]> = {};
    for (const req of requests) {
      const folderName = req.folder?.trim() || t("sidebar.uncategorized");
      const matches =
        !q ||
        req.name.toLowerCase().includes(q) ||
        req.url.toLowerCase().includes(q) ||
        req.method.toLowerCase().includes(q) ||
        folderName.toLowerCase().includes(q);
      if (!matches) continue;
      if (!groups[folderName]) groups[folderName] = [];
      groups[folderName].push(req);
    }
    return groups;
  }, [requests, searchQuery, t]);

  const applyAuthPreset = (
    type: "none" | "bearer" | "basic" | "apikey_header",
    secretOrValue: string
  ) => {
    const cleanRows = headerRows.filter(
      (r) =>
        r.key.trim().toLowerCase() !== "authorization" &&
        r.key.trim().toLowerCase() !== "x-api-key"
    );
    if (type === "bearer") {
      setHeaderRows([
        createKvRow("Authorization", `Bearer ${secretOrValue}`, true),
        ...cleanRows,
      ]);
    } else if (type === "basic") {
      setHeaderRows([
        createKvRow("Authorization", `Basic ${secretOrValue}`, true),
        ...cleanRows,
      ]);
    } else if (type === "apikey_header") {
      setHeaderRows([
        createKvRow("X-API-Key", secretOrValue, true),
        ...cleanRows,
      ]);
    } else {
      setHeaderRows(cleanRows.length > 0 ? cleanRows : [createKvRow()]);
    }
  };

  const handleImportCollection = async (
    importedReqs: ApiRequest[],
    suggestedBaseUrl?: string
  ) => {
    let latestReqs = requests;
    for (const item of importedReqs) {
      latestReqs = await chasquiApi.saveRequest(item);
    }
    setRequests(latestReqs);
    if (importedReqs.length > 0) {
      selectRequest(importedReqs[0]);
    }
    if (suggestedBaseUrl && workspaceInfo) {
      const activeName = workspaceInfo.config.active_environment || "dev";
      const existingEnv = workspaceInfo.environments.find(
        (e) => String(e.name) === activeName
      );
      await chasquiApi.saveEnvironment({
        name: activeName,
        variables: {
          ...existingEnv?.variables,
          base_url: suggestedBaseUrl,
        },
      });
      const updatedInfo = await chasquiApi.getWorkspaceInfo();
      setWorkspaceInfo(updatedInfo);
    }
  };

  const currentBuiltRequest = buildCurrentRequestObject();

  return (
    <div className="flex flex-col h-screen w-screen bg-slate-100 dark:bg-slate-950 text-slate-900 dark:text-slate-100 select-none transition-colors">
      <TopNavbar
        workspaceInfo={workspaceInfo}
        secretKeysCount={secretKeys.length}
        onChangeActiveEnvironment={async (envName) => {
          if (!workspaceInfo) return;
          const updated = await chasquiApi.updateWorkspaceConfig({
            ...workspaceInfo.config,
            active_environment: envName,
          });
          setWorkspaceInfo(updated);
        }}
        onOpenEnvModal={() => setEnvModalOpen(true)}
        onOpenCodeModal={() => setCodeModalOpen(true)}
        onOpenVaultModal={() => setVaultModalOpen(true)}
        onOpenSettingsModal={() => setSettingsModalOpen(true)}
      />

      <div className="flex flex-1 overflow-hidden">
        <CollectionsSidebar
          groupedRequests={groupedRequests}
          activeReqId={activeReq?.id}
          searchQuery={searchQuery}
          collapsedFolders={collapsedFolders}
          workspaceInfo={workspaceInfo}
          onSearchChange={setSearchQuery}
          onToggleFolder={(folderName) =>
            setCollapsedFolders((prev) => ({
              ...prev,
              [folderName]: !prev[folderName],
            }))
          }
          onSelectRequest={selectRequest}
          onDuplicateRequest={handleDuplicateRequest}
          onDeleteRequest={handleDeleteRequest}
          onCreateNewRequest={handleCreateNewRequest}
          onOpenImportModal={() => setCodeModalOpen(true)}
        />

        {activeReq && (
          <main className="flex-1 flex flex-col overflow-hidden">
            <RequestTabsBar
              openTabIds={openTabIds}
              activeReq={activeReq}
              requests={requests}
              onSelectRequest={selectRequest}
              onCloseTab={handleCloseTab}
              onCreateNewRequest={handleCreateNewRequest}
            />

            <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
              <RequestBuilderPanel
                activeReq={activeReq}
                headerRows={headerRows}
                paramRows={paramRows}
                secretKeys={secretKeys}
                activeTab={activeTab}
                responseTab={responseTab}
                sending={sending}
                autoSaveStatus={autoSaveStatus}
                onChangeActiveReq={setActiveReq}
                onChangeHeaderRows={setHeaderRows}
                onChangeParamRows={setParamRows}
                onChangeActiveTab={setActiveTab}
                onOpenBenchmarkTab={() => setResponseTab("benchmark")}
                onOpenVaultModal={() => setVaultModalOpen(true)}
                onDuplicateRequest={handleDuplicateRequest}
                onSendRequest={async (e) => {
                  e.preventDefault();
                  await executeCurrentRequest();
                }}
                onApplyAuthPreset={applyAuthPreset}
              />

              <ResponseViewerPanel
                activeReq={activeReq}
                currentBuiltRequest={currentBuiltRequest}
                response={response}
                execError={execError}
                responseTab={responseTab}
                bodyFormat={bodyFormat}
                copiedResponse={copiedResponse}
                onChangeResponseTab={setResponseTab}
                onChangeBodyFormat={setBodyFormat}
                onCopyResponse={handleCopyResponse}
              />
            </div>
          </main>
        )}
      </div>

      {workspaceInfo && (
        <>
          <VaultModal
            isOpen={vaultModalOpen}
            onClose={() => setVaultModalOpen(false)}
            vaultInitialized={workspaceInfo.vault_initialized}
            vaultUnlocked={workspaceInfo.vault_unlocked}
            keyringHasPassphrase={workspaceInfo.keyring_has_passphrase}
            secretKeys={secretKeys}
            onUnlock={async (pass, remember) => {
              const keys = await chasquiApi.unlockVault(pass, remember);
              setSecretKeys(keys);
              const updated = await chasquiApi.getWorkspaceInfo();
              setWorkspaceInfo(updated);
            }}
            onLock={async (forget) => {
              await chasquiApi.lockVault(forget);
              const updated = await chasquiApi.getWorkspaceInfo();
              setWorkspaceInfo(updated);
            }}
            onAddSecret={async (k, v) => {
              const keys = await chasquiApi.setSecret(k, v);
              setSecretKeys(keys);
            }}
            onDeleteSecret={async (k) => {
              const keys = await chasquiApi.deleteSecret(k);
              setSecretKeys(keys);
            }}
          />

          <WorkspaceSettingsModal
            isOpen={settingsModalOpen}
            onClose={() => setSettingsModalOpen(false)}
            workspaceDir={workspaceInfo.workspace_dir}
            config={workspaceInfo.config}
            secretKeys={secretKeys}
            vaultUnlocked={workspaceInfo.vault_unlocked}
            onChangeWorkspaceDir={async (newDir) => {
              const updated = await chasquiApi.setWorkspaceDir(newDir);
              setWorkspaceInfo(updated);
              const reqs = await chasquiApi.listRequests();
              setRequests(reqs);
              const keys = await chasquiApi.listSecretKeys();
              setSecretKeys(keys);
            }}
            onUpdateConfig={async (newCfg) => {
              const updated = await chasquiApi.updateWorkspaceConfig(newCfg);
              setWorkspaceInfo(updated);
            }}
            onSaveTokenToVault={async (k, v) => {
              const keys = await chasquiApi.setSecret(k, v);
              setSecretKeys(keys);
            }}
            onReloadWorkspaceData={loadInitialData}
          />

          {currentBuiltRequest && (
            <CodeModal
              isOpen={codeModalOpen}
              onClose={() => setCodeModalOpen(false)}
              request={currentBuiltRequest}
              vaultUnlocked={workspaceInfo.vault_unlocked}
              onImportRequest={async (importedReq) => {
                const updated = await chasquiApi.saveRequest(importedReq);
                setRequests(updated);
                selectRequest(importedReq);
              }}
              onImportCollection={handleImportCollection}
            />
          )}

          <EnvironmentModal
            isOpen={envModalOpen}
            onClose={() => setEnvModalOpen(false)}
            environments={workspaceInfo.environments}
            activeEnvName={workspaceInfo.config.active_environment}
            onSaveEnvironment={async (envFile) => {
              await chasquiApi.saveEnvironment(envFile);
              const updated = await chasquiApi.getWorkspaceInfo();
              setWorkspaceInfo(updated);
            }}
            onDeleteEnvironment={async (name) => {
              await chasquiApi.deleteEnvironment(name);
              const updated = await chasquiApi.getWorkspaceInfo();
              setWorkspaceInfo(updated);
            }}
          />
        </>
      )}
    </div>
  );
}

export function App() {
  return (
    <ThemeProvider>
      <I18nProvider>
        <MainAppContent />
      </I18nProvider>
    </ThemeProvider>
  );
}

export default App;
