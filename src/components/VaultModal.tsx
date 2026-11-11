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
import { useI18n } from "../i18n";

interface VaultModalProps {
  readonly isOpen: boolean;
  readonly onClose: () => void;
  readonly vaultInitialized: boolean;
  readonly vaultUnlocked: boolean;
  readonly keyringHasPassphrase?: boolean;
  readonly secretKeys: readonly string[];
  readonly onUnlock: (passphrase: string, rememberInKeyring: boolean) => Promise<void>;
  readonly onLock: (forgetKeyring: boolean) => Promise<void>;
  readonly onAddSecret: (key: string, value: string) => Promise<void>;
  readonly onDeleteSecret: (key: string) => Promise<void>;
}

export const VaultModal: React.FC<VaultModalProps> = ({
  isOpen,
  onClose,
  vaultInitialized,
  vaultUnlocked,
  secretKeys,
  onUnlock,
  onLock,
  onAddSecret,
  onDeleteSecret,
}) => {
  const { t } = useI18n();
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
    if (!passphrase.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await onUnlock(passphrase.trim(), rememberInKeyring);
      setPassphrase("");
    } catch (err) {
      setError(String(err));
    } finally {
      setBusy(false);
    }
  };

  const handleAddSecretSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanKey = newKey.trim().toUpperCase().replace(/[^A-Z0-9_]/g, "_");
    if (!cleanKey || !newValue) return;
    setBusy(true);
    setError(null);
    try {
      await onAddSecret(cleanKey, newValue);
      setNewKey("");
      setNewValue("");
    } catch (err) {
      setError(String(err));
    } finally {
      setBusy(false);
    }
  };

  const handleCopyTag = (key: string) => {
    navigator.clipboard.writeText(`{{secret:${key}}}`);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 1800);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="w-full max-w-2xl rounded-xl border border-slate-700 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl overflow-hidden max-h-[90vh] flex flex-col text-slate-900 dark:text-slate-100">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 px-6 py-4 bg-slate-50 dark:bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-amber-500/10 text-amber-500 dark:text-amber-400 border border-amber-500/20">
              <KeyRound className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold">
                {t("vault.title")}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {t("vault.subtitle")}
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
        <div className="p-6 overflow-y-auto space-y-6">
          {error && (
            <div className="rounded-lg border border-rose-500/40 bg-rose-500/10 p-3 text-xs text-rose-600 dark:text-rose-300">
              {error}
            </div>
          )}

          {/* Status Banner */}
          <div className="flex items-center justify-between rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-4">
            <div className="flex items-center gap-3">
              {vaultUnlocked ? (
                <div className="p-2 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                  <Unlock className="w-5 h-5" />
                </div>
              ) : (
                <div className="p-2 rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400">
                  <Lock className="w-5 h-5" />
                </div>
              )}
              <div>
                <div className="text-xs font-semibold">
                  {vaultUnlocked ? t("vault.unlocked") : t("vault.locked")}
                </div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400">
                  {!vaultInitialized
                    ? t("vault.not_initialized")
                    : vaultUnlocked
                    ? t("vault.unlocked_desc")
                    : t("vault.locked_desc")}
                </div>
              </div>
            </div>

            {vaultUnlocked && (
              <button
                type="button"
                onClick={() => onLock(false)}
                disabled={busy}
                className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 px-3 py-1.5 text-xs text-slate-700 dark:text-slate-200"
              >
                {t("vault.lock")}
              </button>
            )}
          </div>

          {/* Form Unlock / Init */}
          {!vaultUnlocked && (
            <form onSubmit={handleUnlockSubmit} className="space-y-4">
              <div>
                <label
                  htmlFor="vault-passphrase-input"
                  className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1"
                >
                  {t("vault.passphrase_label")}
                </label>
                <input
                  id="vault-passphrase-input"
                  type="password"
                  value={passphrase}
                  onChange={(e) => setPassphrase(e.target.value)}
                  placeholder={t("vault.passphrase_placeholder")}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs text-slate-900 dark:text-slate-100 focus:border-amber-500 focus:outline-none"
                  autoFocus
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="rememberKeyring"
                  checked={rememberInKeyring}
                  onChange={(e) => setRememberInKeyring(e.target.checked)}
                  className="rounded border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-amber-500 focus:ring-amber-500"
                />
                <label
                  htmlFor="rememberKeyring"
                  className="text-xs text-slate-600 dark:text-slate-400 cursor-pointer"
                >
                  {t("vault.remember_keyring")}
                </label>
              </div>

              <button
                type="submit"
                disabled={busy || !passphrase.trim()}
                className="w-full rounded-lg bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-semibold py-2 text-xs transition"
              >
                {!vaultInitialized
                  ? t("vault.init_and_unlock")
                  : t("vault.unlock")}
              </button>
            </form>
          )}

          {/* Secrets Management (Visible when unlocked) */}
          {vaultUnlocked && (
            <div className="space-y-4">
              {/* Add secret */}
              <form
                onSubmit={handleAddSecretSubmit}
                className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/50 p-4 space-y-3"
              >
                <div className="text-xs font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                  <Plus className="w-4 h-4 text-amber-500" />
                  <span>{t("vault.add_secret_title")}</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <input
                      type="text"
                      value={newKey}
                      onChange={(e) => setNewKey(e.target.value)}
                      placeholder={t("vault.key_placeholder")}
                      aria-label="Nombre del secreto"
                      className="w-full rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-1.5 text-xs font-mono text-slate-900 dark:text-slate-100 uppercase"
                    />
                  </div>
                  <div>
                    <input
                      type="password"
                      value={newValue}
                      onChange={(e) => setNewValue(e.target.value)}
                      placeholder={t("vault.value_placeholder")}
                      aria-label="Valor del secreto"
                      className="w-full rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-1.5 text-xs font-mono text-slate-900 dark:text-slate-100"
                    />
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={busy || !newKey.trim() || !newValue}
                  className="rounded-md bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-semibold px-3 py-1.5 text-xs"
                >
                  {t("vault.save_secret")}
                </button>
              </form>

              {/* Secrets list */}
              <div className="space-y-2">
                <div className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                  {t("vault.stored_secrets")} ({secretKeys.length})
                </div>
                {secretKeys.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-slate-300 dark:border-slate-800 p-6 text-center text-xs text-slate-500">
                    {t("vault.no_secrets")}
                  </div>
                ) : (
                  <div className="space-y-1.5 max-h-56 overflow-y-auto">
                    {secretKeys.map((k) => (
                      <div
                        key={k}
                        className="flex items-center justify-between rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs"
                      >
                        <div className="flex items-center gap-2">
                          <ShieldCheck className="w-4 h-4 text-emerald-500" />
                          <span className="font-mono font-medium text-amber-600 dark:text-amber-300">
                            {k}
                          </span>
                          <span className="text-[11px] text-slate-500">
                            (tag: <code>{`{{secret:${k}}}`}</code>)
                          </span>
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleCopyTag(k)}
                            className="flex items-center gap-1 rounded bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 px-2 py-1 text-[11px] text-slate-700 dark:text-slate-300"
                            title="Copiar etiqueta"
                          >
                            {copiedKey === k ? (
                              <>
                                <Check className="w-3 h-3 text-emerald-500" />
                                <span className="text-emerald-500">Copiado</span>
                              </>
                            ) : (
                              <>
                                <Copy className="w-3 h-3" />
                                <span>Copiar tag</span>
                              </>
                            )}
                          </button>
                          <button
                            type="button"
                            onClick={() => onDeleteSecret(k)}
                            disabled={busy}
                            className="p-1 text-slate-400 hover:text-rose-500"
                            title="Eliminar secreto"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
