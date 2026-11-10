import React, { useEffect, useState } from "react";
import {
  FolderCog,
  GitBranch,
  ShieldAlert,
  ShieldCheck,
  UploadCloud,
  DownloadCloud,
  X,
  FolderOpen,
  RefreshCw,
  KeyRound,
  UserCheck,
  AlertTriangle,
  RotateCcw,
} from "lucide-react";
import { open } from "@tauri-apps/plugin-dialog";
import type { GitStatusInfo, WorkspaceConfig } from "../types";
import { chasquiApi } from "../api";

interface WorkspaceSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  workspaceDir: string;
  config: WorkspaceConfig;
  secretKeys: string[];
  vaultUnlocked: boolean;
  onChangeWorkspaceDir: (newDir: string) => Promise<void>;
  onUpdateConfig: (newConfig: WorkspaceConfig) => Promise<void>;
  onSaveTokenToVault: (key: string, value: string) => Promise<void>;
  onReloadWorkspaceData: () => Promise<void>;
}

export const WorkspaceSettingsModal: React.FC<WorkspaceSettingsModalProps> = ({
  isOpen,
  onClose,
  workspaceDir,
  config,
  secretKeys,
  vaultUnlocked,
  onChangeWorkspaceDir,
  onUpdateConfig,
  onSaveTokenToVault,
  onReloadWorkspaceData,
}) => {
  const [dirInput, setDirInput] = useState(workspaceDir);
  const [workspaceName, setWorkspaceName] = useState(config.workspace_name);
  const [commitEncryptedSecrets, setCommitEncryptedSecrets] = useState(
    config.git.commit_encrypted_secrets
  );
  const [remoteUrl, setRemoteUrl] = useState(config.git.remote_url || "");
  const [branch, setBranch] = useState(config.git.branch || "main");
  const [userName, setUserName] = useState(config.git.user_name || "");
  const [userEmail, setUserEmail] = useState(config.git.user_email || "");
  const [authTokenSecretKey, setAuthTokenSecretKey] = useState(
    config.git.auth_token_secret_key || ""
  );
  const [inlineToken, setInlineToken] = useState("");
  const [forcePush, setForcePush] = useState(false);

  const [gitStatus, setGitStatus] = useState<GitStatusInfo | null>(null);
  const [commitMsg, setCommitMsg] = useState(
    "chore(chasqui): update API requests"
  );
  const [statusMessage, setStatusMessage] = useState<{
    type: "ok" | "err";
    text: string;
  } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setDirInput(workspaceDir);
      setWorkspaceName(config.workspace_name);
      setCommitEncryptedSecrets(config.git.commit_encrypted_secrets);
      setRemoteUrl(config.git.remote_url || "");
      setBranch(config.git.branch || "main");
      setUserName(config.git.user_name || "");
      setUserEmail(config.git.user_email || "");
      setAuthTokenSecretKey(config.git.auth_token_secret_key || "");
      setStatusMessage(null);
      refreshGitStatus();
    }
  }, [isOpen, workspaceDir, config]);

  const applyGitStatusDefaults = (st: GitStatusInfo) => {
    if (st.remote_url && !remoteUrl) setRemoteUrl(st.remote_url);
    if (st.user_name && !userName) setUserName(st.user_name);
    if (st.user_email && !userEmail) setUserEmail(st.user_email);
    if (st.branch && st.branch !== "-") setBranch(st.branch);
  };

  const refreshGitStatus = async () => {
    try {
      const st = await chasquiApi.gitStatus();
      setGitStatus(st);
      applyGitStatusDefaults(st);
    } catch (e) {
      setStatusMessage({ type: "err", text: String(e) });
    }
  };

  if (!isOpen) return null;

  const handleBrowseFolder = async () => {
    try {
      const selected = await open({
        directory: true,
        multiple: false,
        defaultPath: dirInput,
      });
      if (typeof selected === "string") {
        setDirInput(selected);
      }
    } catch {
      // Fallback manual
    }
  };

  const buildUpdatedConfig = (): WorkspaceConfig => ({
    workspace_name: workspaceName.trim() || "Mi Workspace Chasqui",
    active_environment: config.active_environment,
    git: {
      commit_encrypted_secrets: commitEncryptedSecrets,
      remote_url: remoteUrl.trim() ? remoteUrl.trim() : null,
      branch: branch.trim() || "main",
      user_name: userName.trim() ? userName.trim() : null,
      user_email: userEmail.trim() ? userEmail.trim() : null,
      auth_token_secret_key: authTokenSecretKey.trim()
        ? authTokenSecretKey.trim()
        : null,
    },
  });

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setStatusMessage(null);
    try {
      if (dirInput.trim() !== workspaceDir) {
        await onChangeWorkspaceDir(dirInput.trim());
      }

      let tokenKeyToUse = authTokenSecretKey.trim();
      if (inlineToken.trim() && vaultUnlocked) {
        const targetKey = tokenKeyToUse || "GIT_ACCESS_TOKEN";
        await onSaveTokenToVault(targetKey, inlineToken.trim());
        tokenKeyToUse = targetKey;
        setAuthTokenSecretKey(targetKey);
        setInlineToken("");
      }

      const newCfg = buildUpdatedConfig();
      newCfg.git.auth_token_secret_key = tokenKeyToUse || null;

      await onUpdateConfig(newCfg);
      await refreshGitStatus();
      setStatusMessage({
        type: "ok",
        text: "Configuración guardada en chasqui.toml y sincronizada con .git/config y .gitignore.",
      });
    } catch (err) {
      setStatusMessage({ type: "err", text: String(err) });
    } finally {
      setBusy(false);
    }
  };

  const handleGitInit = async () => {
    setBusy(true);
    setStatusMessage(null);
    try {
      await onUpdateConfig(buildUpdatedConfig());
      const st = await chasquiApi.gitInit(
        remoteUrl.trim() ? remoteUrl.trim() : null
      );
      setGitStatus(st);
      setStatusMessage({
        type: "ok",
        text: "Repositorio Git inicializado y configurado correctamente.",
      });
    } catch (err) {
      setStatusMessage({ type: "err", text: String(err) });
    } finally {
      setBusy(false);
    }
  };

  const handleCommitAndPush = async (push: boolean) => {
    setBusy(true);
    setStatusMessage(null);
    try {
      await onUpdateConfig(buildUpdatedConfig());
      const msg = await chasquiApi.gitSyncWorkspace(
        commitMsg,
        push,
        forcePush,
        inlineToken.trim() || undefined
      );
      setStatusMessage({ type: "ok", text: msg });
      await refreshGitStatus();
    } catch (err) {
      setStatusMessage({ type: "err", text: String(err) });
    } finally {
      setBusy(false);
    }
  };

  const handlePull = async (forceOverwrite: boolean) => {
    setBusy(true);
    setStatusMessage(null);
    try {
      await onUpdateConfig(buildUpdatedConfig());
      const msg = await chasquiApi.gitPullWorkspace(
        inlineToken.trim() || undefined,
        forceOverwrite
      );
      setStatusMessage({ type: "ok", text: msg });
      await refreshGitStatus();
      await onReloadWorkspaceData();
    } catch (err) {
      setStatusMessage({ type: "err", text: String(err) });
    } finally {
      setBusy(false);
    }
  };

  const placeholderToken = vaultUnlocked
    ? "Pega tu token (se guardará encriptado en el Vault)"
    : "Pega tu token para autenticar Push/Pull ahora";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="w-full max-w-3xl rounded-xl border border-slate-800 bg-slate-900 shadow-2xl overflow-hidden max-h-[92vh] flex flex-col">
        <div className="flex items-center justify-between border-b border-slate-800 px-6 py-4 bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-sky-500/10 text-sky-400 border border-sky-500/20">
              <FolderCog className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-slate-100">
                Directorio del Workspace & Configuración Git / GitLab
              </h2>
              <p className="text-xs text-slate-400">
                Conecta un repositorio existente, pisa la configuración local o
                sincroniza tus colecciones
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

        <div className="p-6 overflow-y-auto space-y-6">
          {statusMessage && (
            <div
              className={`rounded-lg border px-4 py-3 text-xs flex items-start gap-2.5 ${
                statusMessage.type === "ok"
                  ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
                  : "border-rose-500/40 bg-rose-500/10 text-rose-200"
              }`}
            >
              {statusMessage.type === "err" && (
                <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              )}
              <div className="font-mono whitespace-pre-wrap break-all">
                {statusMessage.text}
              </div>
            </div>
          )}

          <form onSubmit={handleSaveSettings} className="space-y-4">
            {/* Directorio del Workspace */}
            <div>
              <label
                htmlFor="ws-dir-input"
                className="block text-xs font-medium text-slate-300 mb-1"
              >
                Directorio Local de Datos (Requests, Entornos y Vault)
              </label>
              <div className="flex gap-2">
                <input
                  id="ws-dir-input"
                  type="text"
                  value={dirInput}
                  onChange={(e) => setDirInput(e.target.value)}
                  className="flex-1 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs font-mono text-slate-100 focus:border-sky-500 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={handleBrowseFolder}
                  className="flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 hover:bg-slate-700 px-3 py-2 text-xs text-slate-200"
                >
                  <FolderOpen className="w-4 h-4" />
                  Elegir carpeta
                </button>
              </div>
            </div>

            {/* Nombre, Remoto y Rama */}
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
              <div className="sm:col-span-4">
                <label
                  htmlFor="ws-name-input"
                  className="block text-xs font-medium text-slate-300 mb-1"
                >
                  Nombre del Workspace
                </label>
                <input
                  id="ws-name-input"
                  type="text"
                  value={workspaceName}
                  onChange={(e) => setWorkspaceName(e.target.value)}
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-100"
                />
              </div>
              <div className="sm:col-span-6">
                <label
                  htmlFor="ws-remote-url-input"
                  className="block text-xs font-medium text-slate-300 mb-1"
                >
                  URL Remota (origin: HTTPS o SSH de GitLab / GitHub)
                </label>
                <input
                  id="ws-remote-url-input"
                  type="text"
                  value={remoteUrl}
                  onChange={(e) => setRemoteUrl(e.target.value)}
                  placeholder="https://gitlab.com/usuario/mis-apis.git"
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs font-mono text-slate-100 focus:border-sky-500 focus:outline-none"
                />
              </div>
              <div className="sm:col-span-2">
                <label
                  htmlFor="ws-branch-input"
                  className="block text-xs font-medium text-slate-300 mb-1"
                >
                  Rama (Branch)
                </label>
                <input
                  id="ws-branch-input"
                  type="text"
                  value={branch}
                  onChange={(e) => setBranch(e.target.value)}
                  placeholder="main"
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs font-mono text-slate-100"
                />
              </div>
            </div>

            {/* Identidad Git + Autenticación HTTPS */}
            <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4 space-y-3">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-200">
                <UserCheck className="w-4 h-4 text-sky-400" />
                <span>
                  Identidad de Autor & Credenciales de Acceso (Git / GitLab)
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label
                    htmlFor="ws-git-username"
                    className="block text-[11px] text-slate-400 mb-1"
                  >
                    Git user.name (Autor de commits y usuario HTTPS)
                  </label>
                  <input
                    id="ws-git-username"
                    type="text"
                    value={userName}
                    onChange={(e) => setUserName(e.target.value)}
                    placeholder="Tu Nombre o usuario de GitLab"
                    className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs text-slate-100"
                  />
                </div>
                <div>
                  <label
                    htmlFor="ws-git-useremail"
                    className="block text-[11px] text-slate-400 mb-1"
                  >
                    Git user.email
                  </label>
                  <input
                    id="ws-git-useremail"
                    type="email"
                    value={userEmail}
                    onChange={(e) => setUserEmail(e.target.value)}
                    placeholder="tu@email.com"
                    className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs text-slate-100"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div>
                  <label
                    htmlFor="ws-vault-token-select"
                    className="block text-[11px] text-slate-400 mb-1 flex items-center gap-1"
                  >
                    <KeyRound className="w-3 h-3 text-amber-400" />
                    <span>Secreto del Vault para Token HTTPS (Opcional)</span>
                  </label>
                  <select
                    id="ws-vault-token-select"
                    value={authTokenSecretKey}
                    onChange={(e) => setAuthTokenSecretKey(e.target.value)}
                    className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs text-slate-100"
                  >
                    <option value="">
                      -- Sin secreto del Vault (usar SSH / sistema) --
                    </option>
                    {secretKeys.map((k) => (
                      <option key={k} value={k}>
                        Vault: {k}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label
                    htmlFor="ws-inline-token-input"
                    className="block text-[11px] text-slate-400 mb-1"
                  >
                    Personal Access Token (GitLab / GitHub HTTPS)
                  </label>
                  <input
                    id="ws-inline-token-input"
                    type="password"
                    value={inlineToken}
                    onChange={(e) => setInlineToken(e.target.value)}
                    placeholder={placeholderToken}
                    className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs font-mono text-slate-100"
                  />
                </div>
              </div>
            </div>

            {/* Política de Secretos en .gitignore */}
            <div className="rounded-xl border border-slate-800 bg-slate-950/80 p-4 space-y-2">
              <div className="flex items-start gap-3">
                <input
                  id="ws-commit-secrets-checkbox"
                  type="checkbox"
                  checked={commitEncryptedSecrets}
                  onChange={(e) => setCommitEncryptedSecrets(e.target.checked)}
                  className="mt-0.5 rounded border-slate-700 bg-slate-900 text-amber-500 focus:ring-amber-500"
                />
                <div className="space-y-1">
                  <label
                    htmlFor="ws-commit-secrets-checkbox"
                    className="flex items-center gap-2 text-xs font-semibold text-slate-100 cursor-pointer"
                  >
                    {commitEncryptedSecrets ? (
                      <>
                        <ShieldAlert className="w-4 h-4 text-amber-400" />
                        <span>
                          Subir secretos encriptados a Git
                          (secrets/vault.enc.toml incluido)
                        </span>
                      </>
                    ) : (
                      <>
                        <ShieldCheck className="w-4 h-4 text-emerald-400" />
                        <span>
                          Ignorar carpeta secrets/ en Git (Recomendado por
                          defecto)
                        </span>
                      </>
                    )}
                  </label>
                  <p className="text-xs text-slate-400">
                    {commitEncryptedSecrets
                      ? "Se removerá secrets/ del archivo .gitignore para respaldar secrets/vault.enc.toml cifrado con AES-256-GCM en tu repo."
                      : "Se mantendrá secrets/ en .gitignore para que tus API keys nunca se suban al repositorio."}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => handlePull(true)}
                disabled={busy}
                className="flex items-center gap-2 rounded-lg bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-semibold px-4 py-2 text-xs transition"
                title="Inicializa Git si hace falta, descarga el repositorio remoto y pisa la configuración/requests locales con lo que hay en el repo"
              >
                <RotateCcw className="w-4 h-4" />
                <span>
                  Conectar a Repo Existente y Pisar Config Local (Force Pull)
                </span>
              </button>

              <button
                type="submit"
                disabled={busy}
                className="rounded-lg bg-sky-500 hover:bg-sky-400 text-slate-950 font-semibold px-4 py-2 text-xs transition"
              >
                Guardar Configuración Local
              </button>
            </div>
          </form>

          {/* Panel de Operaciones Git */}
          <div className="border-t border-slate-800 pt-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-200">
                <GitBranch className="w-4 h-4 text-sky-400" />
                <span>Sincronización del Repositorio</span>
              </div>
              <button
                type="button"
                onClick={refreshGitStatus}
                className="text-xs text-slate-400 hover:text-slate-200 flex items-center gap-1"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Refrescar estado
              </button>
            </div>

            {gitStatus && !gitStatus.is_repo ? (
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-800 bg-slate-950 p-4">
                <span className="text-xs text-slate-400">
                  Puedes inicializar un repositorio vacío o usar el botón
                  naranja de arriba para traer un repositorio ya existente.
                </span>
                <button
                  type="button"
                  onClick={handleGitInit}
                  disabled={busy}
                  className="rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-100 px-3.5 py-1.5 text-xs font-semibold"
                >
                  Inicializar git init vacío
                </button>
              </div>
            ) : (
              gitStatus && (
                <div className="space-y-3 rounded-lg border border-slate-800 bg-slate-950 p-4 text-xs">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="space-x-3">
                      <span className="text-slate-400">
                        Rama:{" "}
                        <strong className="text-slate-100 font-mono">
                          {gitStatus.branch}
                        </strong>
                      </span>
                      <span className="text-slate-400">
                        Remoto actual:{" "}
                        <strong className="text-sky-300 font-mono">
                          {gitStatus.remote_url || "(sin configurar)"}
                        </strong>
                      </span>
                    </div>
                    <span className="text-slate-400">
                      {gitStatus.changed_files.length} cambio(s) pendiente(s)
                    </span>
                  </div>

                  {gitStatus.changed_files.length > 0 && (
                    <div className="max-h-24 overflow-y-auto rounded bg-slate-900 p-2 font-mono text-[11px] text-slate-300 space-y-0.5">
                      {gitStatus.changed_files.map((fileLine) => (
                        <div key={fileLine}>{fileLine}</div>
                      ))}
                    </div>
                  )}

                  <div className="flex flex-col sm:flex-row gap-2 pt-1">
                    <input
                      type="text"
                      value={commitMsg}
                      onChange={(e) => setCommitMsg(e.target.value)}
                      placeholder="Mensaje de commit..."
                      aria-label="Mensaje de commit"
                      className="flex-1 rounded-md border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs text-slate-100"
                    />
                    <button
                      type="button"
                      onClick={() => handlePull(false)}
                      disabled={busy}
                      className="flex items-center justify-center gap-1.5 rounded-md bg-slate-800 hover:bg-slate-700 border border-slate-700 px-3 py-1.5 text-xs text-slate-200 font-medium"
                      title="Traer cambios del repositorio remoto"
                    >
                      <DownloadCloud className="w-3.5 h-3.5" />
                      Pull
                    </button>
                    <button
                      type="button"
                      onClick={() => handlePull(true)}
                      disabled={busy}
                      className="flex items-center justify-center gap-1.5 rounded-md bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 px-3 py-1.5 text-xs text-amber-300 font-medium"
                      title="Descartar conflictos locales y pisar con la versión del repositorio remoto"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      Pull (Pisar Local)
                    </button>
                    <button
                      type="button"
                      onClick={() => handleCommitAndPush(false)}
                      disabled={busy}
                      className="rounded-md bg-slate-800 hover:bg-slate-700 border border-slate-700 px-3 py-1.5 text-xs text-slate-200 font-medium"
                    >
                      Commit
                    </button>
                    <button
                      type="button"
                      onClick={() => handleCommitAndPush(true)}
                      disabled={busy}
                      className="flex items-center justify-center gap-1.5 rounded-md bg-sky-500 hover:bg-sky-400 text-slate-950 px-3 py-1.5 text-xs font-semibold"
                    >
                      <UploadCloud className="w-3.5 h-3.5" />
                      Commit & Push
                    </button>
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <div className="flex items-center gap-2 text-[11px] text-slate-400">
                      <input
                        id="ws-force-push-checkbox"
                        type="checkbox"
                        checked={forcePush}
                        onChange={(e) => setForcePush(e.target.checked)}
                        className="rounded border-slate-700 bg-slate-900 text-amber-500"
                      />
                      <label
                        htmlFor="ws-force-push-checkbox"
                        className="cursor-pointer select-none"
                      >
                        Forzar Push (--force) al subir cambios
                      </label>
                    </div>
                    {gitStatus.last_commit && (
                      <span className="text-[11px] font-mono text-slate-500 truncate max-w-xs">
                        Último commit: {gitStatus.last_commit}
                      </span>
                    )}
                  </div>
                </div>
              )
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
