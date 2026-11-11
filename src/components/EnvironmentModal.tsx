import React, { useEffect, useState } from "react";
import { Globe, Plus, Trash2, Save, X } from "lucide-react";
import type { EnvironmentFile } from "../types";
import { useI18n } from "../i18n";

interface EnvironmentModalProps {
  readonly isOpen: boolean;
  readonly onClose: () => void;
  readonly environments: readonly EnvironmentFile[];
  readonly activeEnvName: string | null;
  readonly onSaveEnvironment: (envFile: EnvironmentFile) => Promise<void>;
  readonly onDeleteEnvironment: (name: string) => Promise<void>;
}

interface EnvVarRow {
  rowId: string;
  key: string;
  value: string;
}

let envRowSeq = 1;
const createEnvRow = (key = "", value = ""): EnvVarRow => ({
  rowId: `env_row_${envRowSeq++}`,
  key,
  value,
});

export const EnvironmentModal: React.FC<EnvironmentModalProps> = ({
  isOpen,
  onClose,
  environments,
  activeEnvName,
  onSaveEnvironment,
  onDeleteEnvironment,
}) => {
  const { t } = useI18n();
  const [selectedName, setSelectedName] = useState<string>("dev");
  const [newEnvName, setNewEnvName] = useState<string>("");
  const [rows, setRows] = useState<EnvVarRow[]>([createEnvRow()]);
  const [savedNotice, setSavedNotice] = useState(false);

  useEffect(() => {
    if (isOpen) {
      const firstEnv = environments[0] ? String(environments[0].name) : "dev";
      const target = activeEnvName || firstEnv;
      selectEnv(target);
    }
  }, [isOpen, environments, activeEnvName]);

  const selectEnv = (name: string) => {
    setSelectedName(name);
    const found = environments.find((e) => String(e.name) === name);
    if (found && found.variables) {
      const parsedRows = Object.entries(found.variables).map(([k, v]) =>
        createEnvRow(k, v)
      );
      setRows(parsedRows.length > 0 ? parsedRows : [createEnvRow()]);
    } else {
      setRows([createEnvRow()]);
    }
    setSavedNotice(false);
  };

  if (!isOpen) return null;

  const handleAddRow = () => {
    setRows([...rows, createEnvRow()]);
  };

  const handleRemoveRow = (id: string) => {
    setRows(rows.filter((r) => r.rowId !== id));
  };

  const handleRowChange = (
    id: string,
    field: "key" | "value",
    val: string
  ) => {
    setRows(
      rows.map((r) => (r.rowId === id ? { ...r, [field]: val } : r))
    );
  };

  const handleCreateEnvironment = () => {
    const clean = newEnvName.trim().replaceAll(/[^a-zA-Z0-9_-]/g, "");
    if (!clean) return;
    onSaveEnvironment({
      name: clean,
      variables: {},
    });
    setNewEnvName("");
    selectEnv(clean);
  };

  const handleSaveCurrentEnv = async () => {
    const variables: Record<string, string> = {};
    for (const r of rows) {
      if (r.key.trim()) {
        variables[r.key.trim()] = r.value;
      }
    }
    await onSaveEnvironment({
      name: selectedName,
      variables,
    });
    setSavedNotice(true);
    setTimeout(() => setSavedNotice(false), 2000);
  };

  const handleDeleteCurrentEnv = async () => {
    if (environments.length <= 1) return;
    await onDeleteEnvironment(selectedName);
    const remaining = environments.filter((e) => String(e.name) !== selectedName);
    if (remaining.length > 0) {
      selectEnv(String(remaining[0].name));
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="w-full max-w-3xl rounded-xl border border-slate-700 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl overflow-hidden max-h-[90vh] flex flex-col text-slate-900 dark:text-slate-100">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 px-6 py-4 bg-slate-50 dark:bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-sky-500/10 text-sky-500 dark:text-sky-400 border border-sky-500/20">
              <Globe className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold">
                {t("env_modal.title")}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {t("env_modal.subtitle")}
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

        {/* Content */}
        <div className="flex flex-1 overflow-hidden">
          {/* Environments Sidebar */}
          <div className="w-48 border-r border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/40 p-3 space-y-2 flex flex-col">
            <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider px-2">
              Archivos .toml
            </div>
            <div className="flex-1 overflow-y-auto space-y-1">
              {environments.map((env) => {
                const isSelected = String(env.name) === selectedName;
                const isActive = String(env.name) === activeEnvName;
                return (
                  <button
                    key={String(env.name)}
                    type="button"
                    onClick={() => selectEnv(String(env.name))}
                    className={`w-full flex items-center justify-between rounded-lg px-2.5 py-1.5 text-xs text-left transition ${
                      isSelected
                        ? "bg-slate-200 dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-semibold"
                        : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-900 hover:text-slate-900 dark:hover:text-slate-200"
                    }`}
                  >
                    <span className="truncate">{String(env.name)}.toml</span>
                    {isActive && (
                      <span className="text-[9px] px-1 py-0.5 rounded bg-sky-500/20 text-sky-600 dark:text-sky-300">
                        {t("env_modal.active")}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Create new env */}
            <div className="pt-2 border-t border-slate-200 dark:border-slate-800 space-y-1.5">
              <input
                type="text"
                value={newEnvName}
                onChange={(e) => setNewEnvName(e.target.value)}
                placeholder={t("env_modal.new_env_placeholder")}
                className="w-full rounded border border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-950 px-2 py-1 text-xs text-slate-900 dark:text-slate-200 focus:outline-none"
              />
              <button
                type="button"
                onClick={handleCreateEnvironment}
                disabled={!newEnvName.trim()}
                className="w-full rounded bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 disabled:opacity-50 text-slate-700 dark:text-slate-300 py-1 text-xs font-medium"
              >
                {t("env_modal.create_env_btn")}
              </button>
            </div>
          </div>

          {/* Variables Table */}
          <div className="flex-1 flex flex-col p-6 overflow-hidden">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold">
                  {selectedName}.toml
                </span>
                <span className="text-xs text-slate-500">
                  ({rows.filter((r) => r.key.trim()).length} variables)
                </span>
              </div>
              <div className="flex items-center gap-2">
                {environments.length > 1 && (
                  <button
                    type="button"
                    onClick={handleDeleteCurrentEnv}
                    className="flex items-center gap-1 text-xs text-rose-500 hover:text-rose-600 px-2 py-1 rounded hover:bg-rose-500/10"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>{t("env_modal.delete")}</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleSaveCurrentEnv}
                  className="flex items-center gap-1.5 rounded-lg bg-sky-500 hover:bg-sky-400 text-slate-950 px-3 py-1.5 text-xs font-semibold"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>
                    {savedNotice
                      ? t("env_modal.saved")
                      : t("env_modal.save_env_btn")}
                  </span>
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
              {rows.map((row) => (
                <div key={row.rowId} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={row.key}
                    onChange={(e) =>
                      handleRowChange(row.rowId, "key", e.target.value)
                    }
                    placeholder={t("env_modal.var_key_placeholder")}
                    className="w-1/3 rounded-lg border border-slate-300 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-3 py-1.5 text-xs font-mono text-slate-900 dark:text-slate-100 focus:outline-none"
                  />
                  <input
                    type="text"
                    value={row.value}
                    onChange={(e) =>
                      handleRowChange(row.rowId, "value", e.target.value)
                    }
                    placeholder={t("env_modal.var_val_placeholder")}
                    className="flex-1 rounded-lg border border-slate-300 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-3 py-1.5 text-xs font-mono text-slate-900 dark:text-slate-100 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => handleRemoveRow(row.rowId)}
                    className="p-1.5 text-slate-400 hover:text-rose-500"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>

            <div className="pt-3 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={handleAddRow}
                className="flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400 hover:underline font-medium"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{t("env_modal.add_var_btn")}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
