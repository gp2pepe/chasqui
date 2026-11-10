import React, { useEffect, useState } from "react";
import { Globe, Plus, Trash2, Save, X } from "lucide-react";
import type { EnvironmentFile } from "../types";

interface EnvironmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  environments: EnvironmentFile[];
  activeEnvName: string | null;
  onSaveEnvironment: (envFile: EnvironmentFile) => Promise<void>;
  onDeleteEnvironment: (name: string) => Promise<void>;
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
    if (found) {
      const entries = Object.entries(found.variables).map(([k, v]) =>
        createEnvRow(k, v)
      );
      setRows(entries.length > 0 ? entries : [createEnvRow()]);
    } else {
      setRows([createEnvRow("base_url", "https://httpbin.org")]);
    }
  };

  if (!isOpen) return null;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const variables: Record<string, string> = {};
    for (const r of rows) {
      if (r.key.trim()) variables[r.key.trim()] = r.value;
    }
    await onSaveEnvironment({
      name: selectedName,
      variables,
    });
    setSavedNotice(true);
    setTimeout(() => setSavedNotice(false), 1600);
  };

  const handleCreateNewEnv = async () => {
    const clean = newEnvName.trim().replaceAll(/[^a-zA-Z0-9_-]/g, "");
    if (!clean) return;
    await onSaveEnvironment({
      name: clean,
      variables: { base_url: "https://api.ejemplo.com" },
    });
    setNewEnvName("");
    selectEnv(clean);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="w-full max-w-2xl rounded-xl border border-slate-800 bg-slate-900 shadow-2xl overflow-hidden flex flex-col max-h-[88vh]">
        <div className="flex items-center justify-between border-b border-slate-800 px-6 py-4 bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-sky-500/10 text-sky-400 border border-sky-500/20">
              <Globe className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-slate-100">
                Editor de Entornos y Variables (environments/*.toml)
              </h2>
              <p className="text-xs text-slate-400">
                Usa tus variables en URL, Headers o Body como{" "}
                <code className="text-sky-300">{`{{base_url}}`}</code>
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

        <div className="p-6 overflow-y-auto space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap gap-1.5">
              {environments.map((env) => {
                const envName = String(env.name);
                return (
                  <button
                    key={envName}
                    type="button"
                    onClick={() => selectEnv(envName)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition ${
                      selectedName === envName
                        ? "bg-sky-500/20 border-sky-500/40 text-sky-300"
                        : "bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    {envName}.toml
                  </button>
                );
              })}
            </div>

            <div className="flex items-center gap-1.5">
              <input
                type="text"
                value={newEnvName}
                onChange={(e) => setNewEnvName(e.target.value)}
                placeholder="Nuevo (ej. prod)"
                aria-label="Nombre del nuevo entorno"
                className="rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1 text-xs text-slate-100 w-36"
              />
              <button
                type="button"
                onClick={handleCreateNewEnv}
                className="flex items-center gap-1 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 px-2.5 py-1 text-xs text-slate-200"
              >
                <Plus className="w-3.5 h-3.5" />
                Crear
              </button>
            </div>
          </div>

          <form onSubmit={handleSave} className="space-y-3">
            <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
              {rows.map((row) => (
                <div key={row.rowId} className="flex gap-2">
                  <input
                    type="text"
                    value={row.key}
                    onChange={(e) => {
                      setRows(
                        rows.map((item) =>
                          item.rowId === row.rowId
                            ? { ...item, key: e.target.value }
                            : item
                        )
                      );
                    }}
                    placeholder="Variable (ej. base_url)"
                    aria-label="Nombre de variable"
                    className="w-1/3 rounded-md border border-slate-700 bg-slate-950 px-3 py-1.5 text-xs font-mono text-sky-300"
                  />
                  <input
                    type="text"
                    value={row.value}
                    onChange={(e) => {
                      setRows(
                        rows.map((item) =>
                          item.rowId === row.rowId
                            ? { ...item, value: e.target.value }
                            : item
                        )
                      );
                    }}
                    placeholder="Valor (ej. https://api.midominio.com)"
                    aria-label="Valor de variable"
                    className="flex-1 rounded-md border border-slate-700 bg-slate-950 px-3 py-1.5 text-xs font-mono text-slate-100"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setRows(rows.filter((item) => item.rowId !== row.rowId))
                    }
                    className="px-2 text-slate-500 hover:text-rose-400"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between pt-2">
              <button
                type="button"
                onClick={() => setRows([...rows, createEnvRow()])}
                className="text-xs text-sky-400 hover:text-sky-300 flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" /> Agregar Variable
              </button>

              <div className="flex items-center gap-2">
                {environments.length > 1 && (
                  <button
                    type="button"
                    onClick={async () => {
                      await onDeleteEnvironment(selectedName);
                    }}
                    className="rounded-lg border border-rose-500/30 bg-rose-500/10 hover:bg-rose-500/20 px-3 py-1.5 text-xs text-rose-300"
                  >
                    Eliminar {selectedName}.toml
                  </button>
                )}
                <button
                  type="submit"
                  className="flex items-center gap-1.5 rounded-lg bg-sky-500 hover:bg-sky-400 text-slate-950 font-semibold px-4 py-1.5 text-xs"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>
                    {savedNotice
                      ? "¡Guardado!"
                      : `Guardar ${selectedName}.toml`}
                  </span>
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
