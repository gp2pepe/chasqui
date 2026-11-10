import React, { useState } from "react";
import {
  KeyRound,
  Lock,
  Unlock,
  Plus,
  Trash2,
  Copy,
  Check,
  ShieldCheck,
  X,
} from "lucide-react";

interface VaultModalProps {
  isOpen: boolean;
  onClose: () => void;
  vaultInitialized: boolean;
  vaultUnlocked: boolean;
  keyringHasPassphrase: boolean;
  secretKeys: string[];
  onUnlock: (passphrase: string, rememberInKeyring: boolean) => Promise<void>;
  onLock: (forgetKeyring: boolean) => Promise<void>;
  onAddSecret: (key: string, value: string) => Promise<void>;
  onDeleteSecret: (key: string) => Promise<void>;
}

export const VaultModal: React.FC<VaultModalProps> = ({
  isOpen,
  onClose,
  vaultInitialized,
  vaultUnlocked,
  keyringHasPassphrase,
  secretKeys,
  onUnlock,
  onLock,
  onAddSecret,
  onDeleteSecret,
}) => {
  const [passphrase, setPassphrase] = useState("");
  const [rememberInKeyring, setRememberInKeyring] = useState(true);
  const [newKey, setNewKey] = useState("");
  const [newValue, setNewValue] = useState("");
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!isOpen) return null;

  const handleUnlockSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await onUnlock(passphrase, rememberInKeyring);
      setPassphrase("");
    } catch (err) {
      setError(String(err));
    } finally {
      setBusy(false);
    }
  };

  const handleCreateSecret = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newKey.trim() || !newValue.trim()) return;
    setError(null);
    setBusy(true);
    try {
      await onAddSecret(newKey.trim(), newValue);
      setNewKey("");
      setNewValue("");
    } catch (err) {
      setError(String(err));
    } finally {
      setBusy(false);
    }
  };

  const copyPlaceholder = (key: string) => {
    navigator.clipboard.writeText(`{{secret:${key}}}`);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 1800);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="w-full max-w-xl rounded-xl border border-slate-800 bg-slate-900 shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-800 px-6 py-4 bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <KeyRound className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-slate-100">
                Vault de Secretos Encriptado (AES-256-GCM)
              </h2>
              <p className="text-xs text-slate-400">
                Archivo separado:{" "}
                <code className="text-amber-300">secrets/vault.enc.toml</code>
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

        <div className="p-6 space-y-5">
          {error && (
            <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-xs text-red-300">
              {error}
            </div>
          )}

          {!vaultUnlocked ? (
            <form onSubmit={handleUnlockSubmit} className="space-y-4">
              <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-4 text-xs text-slate-300 space-y-1">
                <p className="font-medium text-slate-200 flex items-center gap-2">
                  <Lock className="w-4 h-4 text-amber-400" />
                  {vaultInitialized
                    ? "El Vault está bloqueado"
                    : "Inicializar nuevo Vault de Secretos"}
                </p>
                <p className="text-slate-400">
                  {vaultInitialized
                    ? "Ingresa tu clave maestra para desencriptar las API Keys en memoria."
                    : "Define una clave maestra. Se derivará una llave de 256 bits con Argon2id para cifrar tus secretos localmente."}
                </p>
              </div>

              <div>
                <label
                  htmlFor="vault-passphrase-input"
                  className="block text-xs font-medium text-slate-300 mb-1.5"
                >
                  Clave Maestra (Passphrase)
                </label>
                <input
                  id="vault-passphrase-input"
                  type="password"
                  value={passphrase}
                  onChange={(e) => setPassphrase(e.target.value)}
                  placeholder="Ingresa tu clave maestra local..."
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3.5 py-2 text-sm text-slate-100 focus:border-amber-500 focus:outline-none"
                  required
                />
              </div>

              <label className="flex items-center gap-2.5 text-xs text-slate-300 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={rememberInKeyring}
                  onChange={(e) => setRememberInKeyring(e.target.checked)}
                  className="rounded border-slate-700 bg-slate-950 text-amber-500 focus:ring-amber-500"
                />
                <span>
                  Guardar en el llavero seguro del Sistema Operativo (Linux
                  Secret Service / Windows Credential Manager)
                </span>
              </label>

              <button
                type="submit"
                disabled={busy}
                className="w-full flex items-center justify-center gap-2 rounded-lg bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-semibold py-2.5 text-sm transition"
              >
                <Unlock className="w-4 h-4" />
                {vaultInitialized
                  ? "Desbloquear Vault"
                  : "Crear Vault Encriptado"}
              </button>
            </form>
          ) : (
            <div className="space-y-5">
              <div className="flex items-center justify-between rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-2.5">
                <div className="flex items-center gap-2 text-xs text-emerald-300">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  <span>
                    Vault desbloqueado en memoria
                    {keyringHasPassphrase ? " • Recordado en OS Keyring" : ""}
                  </span>
                </div>
                <button
                  onClick={() => onLock(false)}
                  className="text-xs bg-slate-900 hover:bg-slate-800 text-slate-200 px-3 py-1 rounded border border-slate-700 flex items-center gap-1.5"
                >
                  <Lock className="w-3.5 h-3.5" />
                  Bloquear
                </button>
              </div>

              <form
                onSubmit={handleCreateSecret}
                className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 bg-slate-950/60 p-3.5 rounded-lg border border-slate-800"
              >
                <input
                  type="text"
                  value={newKey}
                  onChange={(e) =>
                    setNewKey(e.target.value.replace(/[^a-zA-Z0-9_-]/g, "_"))
                  }
                  placeholder="NOMBRE_API_KEY"
                  className="sm:col-span-4 rounded-md border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs font-mono text-slate-100 focus:border-amber-500 focus:outline-none"
                />
                <input
                  type="password"
                  value={newValue}
                  onChange={(e) => setNewValue(e.target.value)}
                  placeholder="Valor secreto (ej. sk_live_...)"
                  className="sm:col-span-6 rounded-md border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs font-mono text-slate-100 focus:border-amber-500 focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={busy}
                  className="sm:col-span-2 flex items-center justify-center gap-1 rounded-md bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-xs py-1.5 px-3"
                >
                  <Plus className="w-4 h-4" />
                  Guardar
                </button>
              </form>

              <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                <div className="text-xs font-medium text-slate-400">
                  Secretos disponibles (haz clic para copiar el placeholder):
                </div>
                {secretKeys.length === 0 ? (
                  <p className="text-xs text-slate-500 italic py-4 text-center">
                    Aún no hay secretos guardados en secrets/vault.enc.toml
                  </p>
                ) : (
                  secretKeys.map((k) => (
                    <div
                      key={k}
                      className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-950 px-3.5 py-2 text-xs"
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-amber-300 font-medium">
                          {`{{secret:${k}}}`}
                        </span>
                        <span className="text-slate-500">••••••••••••</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => copyPlaceholder(k)}
                          className="flex items-center gap-1 rounded px-2 py-1 text-slate-300 hover:bg-slate-800"
                          title="Copiar tag para usar en URL, Headers o Body"
                        >
                          {copiedKey === k ? (
                            <>
                              <Check className="w-3.5 h-3.5 text-emerald-400" />
                              <span className="text-emerald-400">Copiado</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3.5 h-3.5" />
                              <span>Usar tag</span>
                            </>
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => onDeleteSecret(k)}
                          className="p-1 text-slate-500 hover:text-red-400 rounded hover:bg-slate-800"
                          title="Eliminar secreto"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
