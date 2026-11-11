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
  AlertTriangle,
  RotateCcw,
} from "lucide-react";
import { open } from "@tauri-apps/plugin-dialog";
import type { GitStatusInfo, WorkspaceConfig } from "../types";
import { chasquiApi } from "../api";
import { useI18n } from "../i18n";

interface WorkspaceSettingsModalProps {
  readonly isOpen: boolean;
  readonly onClose: () => void;
  readonly workspaceDir: string;
  readonly config: WorkspaceConfig;
  readonly secretKeys: readonly string[];
  readonly vaultUnlocked: boolean;
  readonly onChangeWorkspaceDir: (newDir: string) => Promise<void>;
  readonly onUpdateConfig: (newConfig: WorkspaceConfig) => Promise<void>;
  readonly onSaveTokenToVault: (key: string, value: string) => Promise<void>;
  readonly onReloadWorkspaceData: () => Promise<void>;
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
  const { t } = useI18n();
  const [dirInput, setDirInput] = useState(workspaceDir);
  const [remoteUrl, setRemoteUrl] = useState(config.git.remote_url || "");
  const [branch, setBranch] = useState(config.git.branch || "main");
  const [userName, setUserName] = useState(config.git.user_name || "");
  const [userEmail, setUserEmail] = useState(config.git.user_email || "");
  const [commitEncryptedSecrets, setCommitEncryptedSecrets] = useState(
    config.git.commit_encrypted_secrets
  );
  const [authTokenSecretKey, setAuthTokenSecretKey] = useState(
    config.git.auth_token_secret_key || ""
  );

  const [inlineToken, setInlineToken] = useState("");
  const [commitMsg, setCommitMsg] = useState("");
  const [forcePush, setForcePush] = useState(false);
  const [gitStatus, setGitStatus] = useState<GitStatusInfo | null>(null);

  const [statusMessage, setStatusMessage] = useState<{
    type: "ok" | "err";
    text: string;
  } | null>(null);
  const [busy, setBusy] = useState(false);

  const refreshGitStatus = async () => {
    try {
      const st = await chasquiApi.gitStatus();
      setGitStatus(st);
    } catch {
      // Ignorar
    }
  };

  useEffect(() => {
    if (isOpen) {
      setDirInput(workspaceDir);
      setRemoteUrl(config.git.remote_url || "");
      setBranch(config.git.branch || "main");
      setUserName(config.git.user_name || "");
      setUserEmail(config.git.user_email || "");
      setCommitEncryptedSecrets(config.git.commit_encrypted_secrets);
      setAuthTokenSecretKey(config.git.auth_token_secret_key || "");
      setInlineToken("");
      setStatusMessage(null);
      refreshGitStatus();
    }
  }, [isOpen, workspaceDir, config]);

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
      // Fallback
    }
  };

  const buildUpdatedConfig = (): WorkspaceConfig => ({
    ...config,
    git: {
      ...config.git,
      remote_url: remoteUrl.trim() || null,
      branch: branch.trim() || "main",
      user_name: userName.trim() || null,
      user_email: userEmail.trim() || null,
      commit_encrypted_secrets: commitEncryptedSecrets,
      auth_token_secret_key: authTokenSecretKey.trim() || null,
    },
  });

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setStatusMessage(null);
    try {
      if (dirInput.trim() && dirInput.trim() !== workspaceDir) {
        await onChangeWorkspaceDir(dirInput.trim());
      }

      let tokenKeyToUse = authTokenSecretKey;
      if (inlineToken.trim() && vaultUnlocked) {
        const generatedKey = `GIT_PAT_${Date.now().toString(36).toUpperCase()}`;
        await onSaveTokenToVault(generatedKey, inlineToken.trim());
        tokenKeyToUse = generatedKey;
        setAuthTokenSecretKey(generatedKey);
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
    ? t("settings.inline_token_placeholder_vault")
    : t("settings.inline_token_placeholder_now");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="w-full max-w-3xl rounded-xl border border-slate-700 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl overflow-hidden max-h-[92vh] flex flex-col text-slate-900 dark:text-slate-100">
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 px-6 py-4 bg-slate-50 dark:bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-sky-500/10 text-sky-500 dark:text-sky-400 border border-sky-500/20">
              <FolderCog className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold">
                {t("settings.title")}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {t("settings.subtitle")}
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

        <div className="p-6 overflow-y-auto space-y-6">
          {statusMessage && (
            <div
              className={`rounded-lg border px-4 py-3 text-xs flex items-start gap-2.5 ${
                statusMessage.type === "ok"
                  ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-200"
                  : "border-rose-500/40 bg-rose-500/10 text-rose-700 dark:text-rose-200"
              }`}
            >
              {statusMessage.type === "err" && (
                <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
              )}
              <div className="font-mono whitespace-pre-wrap break-all">
                {statusMessage.text}
              </div>
            </div>
          )}

          <form onSubmit={handleSaveSettings} className="space-y-4">
            {/* Workspace Directory */}
            <div>
              <label
                htmlFor="ws-dir-input"
                className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1"
              >
                {t("settings.workspace_dir_label")}
              </label>
              <div className="flex gap-2">
                <input
                  id="ws-dir-input"
                  type="text"
                  value={dirInput}
                  onChange={(e) => setDirInput(e.target.value)}
                  className="flex-1 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs font-mono text-slate-900 dark:text-slate-100 focus:border-sky-500 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={handleBrowseFolder}
                  className="flex items-center gap-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 px-3 py-2 text-xs text-slate-700 dark:text-slate-200"
                >
                  <FolderOpen className="w-4 h-4" />
                  {t("settings.browse_btn")}
                </button>
              </div>
            </div>

            {/* Git Remote and Auth */}
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/50 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                  <GitBranch className="w-4 h-4 text-sky-500" />
                  <span>Configuración de Git y Autenticación Remota</span>
                </span>
                <span className="text-[11px] text-slate-500">
                  (GitHub, GitLab, Gitea)
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label
                    htmlFor="ws-git-remote"
                    className="block text-[11px] text-slate-500 mb-1"
                  >
                    {t("settings.git_remote_url")}
                  </label>
                  <input
                    id="ws-git-remote"
                    type="text"
                    value={remoteUrl}
                    onChange={(e) => setRemoteUrl(e.target.value)}
                    placeholder="https://gitlab.com/usuario/mi-api-workspace.git"
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-1.5 text-xs font-mono text-slate-900 dark:text-slate-100"
                  />
                </div>
                <div>
                  <label
                    htmlFor="ws-git-branch"
                    className="block text-[11px] text-slate-500 mb-1"
                  >
                    {t("settings.git_branch")}
                  </label>
                  <input
                    id="ws-git-branch"
                    type="text"
                    value={branch}
                    onChange={(e) => setBranch(e.target.value)}
                    placeholder="main"
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-1.5 text-xs font-mono text-slate-900 dark:text-slate-100"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label
                    htmlFor="ws-git-username"
                    className="block text-[11px] text-slate-500 mb-1"
                  >
                    {t("settings.git_username")}
                  </label>
                  <input
                    id="ws-git-username"
                    type="text"
                    value={userName}
                    onChange={(e) => setUserName(e.target.value)}
                    placeholder="Tu Nombre"
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-1.5 text-xs text-slate-900 dark:text-slate-100"
                  />
                </div>
                <div>
                  <label
                    htmlFor="ws-git-useremail"
                    className="block text-[11px] text-slate-500 mb-1"
                  >
                    {t("settings.git_useremail")}
                  </label>
                  <input
                    id="ws-git-useremail"
                    type="email"
                    value={userEmail}
                    onChange={(e) => setUserEmail(e.target.value)}
                    placeholder="tu@email.com"
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-1.5 text-xs text-slate-900 dark:text-slate-100"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div>
                  <label
                    htmlFor="ws-vault-token-select"
                    className="block text-[11px] text-slate-500 mb-1 flex items-center gap-1"
                  >
                    <KeyRound className="w-3 h-3 text-amber-500" />
                    <span>{t("settings.vault_token_select")}</span>
                  </label>
                  <select
                    id="ws-vault-token-select"
                    value={authTokenSecretKey}
                    onChange={(e) => setAuthTokenSecretKey(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-1.5 text-xs text-slate-900 dark:text-slate-100 cursor-pointer"
                  >
                    <option value="" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">
                      {t("settings.no_vault_token")}
                    </option>
                    {secretKeys.map((k) => (
                      <option key={k} value={k} className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">
                        Vault: {k}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label
                    htmlFor="ws-inline-token-input"
                    className="block text-[11px] text-slate-500 mb-1"
                  >
                    {t("settings.inline_token_label")}
                  </label>
                  <input
                    id="ws-inline-token-input"
                    type="password"
                    value={inlineToken}
                    onChange={(e) => setInlineToken(e.target.value)}
                    placeholder={placeholderToken}
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-1.5 text-xs font-mono text-slate-900 dark:text-slate-100"
                  />
                </div>
              </div>
            </div>

            {/* Secret Policy */}
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/80 p-4 space-y-2">
              <div className="flex items-start gap-3">
                <input
                  id="ws-commit-secrets-checkbox"
                  type="checkbox"
                  checked={commitEncryptedSecrets}
                  onChange={(e) => setCommitEncryptedSecrets(e.target.checked)}
                  className="mt-0.5 rounded border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-amber-500 focus:ring-amber-500"
                />
                <div className="space-y-1">
                  <label
                    htmlFor="ws-commit-secrets-checkbox"
                    className="flex items-center gap-2 text-xs font-semibold text-slate-800 dark:text-slate-100 cursor-pointer"
                  >
                    {commitEncryptedSecrets ? (
                      <>
                        <ShieldAlert className="w-4 h-4 text-amber-500" />
                        <span>{t("settings.commit_secrets_title")}</span>
                      </>
                    ) : (
                      <>
                        <ShieldCheck className="w-4 h-4 text-emerald-500" />
                        <span>{t("settings.ignore_secrets_title")}</span>
                      </>
                    )}
                  </label>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {commitEncryptedSecrets
                      ? t("settings.commit_secrets_desc")
                      : t("settings.ignore_secrets_desc")}
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
                title="Conectar a repo y pisar"
              >
                <RotateCcw className="w-4 h-4" />
                <span>{t("settings.force_pull_btn")}</span>
              </button>

              <button
                type="submit"
                disabled={busy}
                className="rounded-lg bg-sky-500 hover:bg-sky-400 text-slate-950 font-semibold px-4 py-2 text-xs transition"
              >
                {t("settings.save_config_btn")}
              </button>
            </div>
          </form>

          {/* Git Operations Panel */}
          <div className="border-t border-slate-200 dark:border-slate-800 pt-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-200">
                <GitBranch className="w-4 h-4 text-sky-500" />
                <span>{t("settings.sync_section_title")}</span>
              </div>
              <button
                type="button"
                onClick={refreshGitStatus}
                className="text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 flex items-center gap-1"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                {t("settings.refresh_status")}
              </button>
            </div>

            {gitStatus && !gitStatus.is_repo ? (
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-4">
                <span className="text-xs text-slate-500">
                  {t("settings.not_a_repo")}
                </span>
                <button
                  type="button"
                  onClick={handleGitInit}
                  disabled={busy}
                  className="rounded-lg bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 px-3.5 py-1.5 text-xs font-semibold"
                >
                  {t("settings.init_git_btn")}
                </button>
              </div>
            ) : (
              gitStatus && (
                <div className="space-y-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-4 text-xs">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="space-x-3">
                      <span className="text-slate-500">
                        {t("settings.branch_label")}{" "}
                        <strong className="text-slate-900 dark:text-slate-100 font-mono">
                          {gitStatus.branch}
                        </strong>
                      </span>
                      <span className="text-slate-500">
                        {t("settings.remote_label")}{" "}
                        <strong className="text-sky-600 dark:text-sky-300 font-mono">
                          {gitStatus.remote_url || t("settings.unconfigured_remote")}
                        </strong>
                      </span>
                    </div>
                    <span className="text-slate-500">
                      {gitStatus.changed_files.length} {t("settings.pending_changes")}
                    </span>
                  </div>

                  {gitStatus.changed_files.length > 0 && (
                    <div className="max-h-24 overflow-y-auto rounded bg-white dark:bg-slate-900 p-2 font-mono text-[11px] text-slate-700 dark:text-slate-300 space-y-0.5 border border-slate-200 dark:border-transparent">
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
                      placeholder={t("settings.commit_placeholder")}
                      aria-label="Mensaje de commit"
                      className="flex-1 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-1.5 text-xs text-slate-900 dark:text-slate-100"
                    />
                    <button
                      type="button"
                      onClick={() => handlePull(false)}
                      disabled={busy}
                      className="flex items-center justify-center gap-1.5 rounded-md bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-700 px-3 py-1.5 text-xs text-slate-700 dark:text-slate-200 font-medium"
                      title="Pull"
                    >
                      <DownloadCloud className="w-3.5 h-3.5" />
                      {t("settings.pull_btn")}
                    </button>
                    <button
                      type="button"
                      onClick={() => handlePull(true)}
                      disabled={busy}
                      className="flex items-center justify-center gap-1.5 rounded-md bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 px-3 py-1.5 text-xs text-amber-700 dark:text-amber-300 font-medium"
                      title="Pull forzado"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      {t("settings.pull_overwrite_btn")}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleCommitAndPush(false)}
                      disabled={busy}
                      className="rounded-md bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-700 px-3 py-1.5 text-xs text-slate-700 dark:text-slate-200 font-medium"
                    >
                      {t("settings.commit_btn")}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleCommitAndPush(true)}
                      disabled={busy}
                      className="flex items-center justify-center gap-1.5 rounded-md bg-sky-500 hover:bg-sky-400 text-slate-950 px-3 py-1.5 text-xs font-semibold"
                    >
                      <UploadCloud className="w-3.5 h-3.5" />
                      {t("settings.commit_push_btn")}
                    </button>
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <div className="flex items-center gap-2 text-[11px] text-slate-500">
                      <input
                        id="ws-force-push-checkbox"
                        type="checkbox"
                        checked={forcePush}
                        onChange={(e) => setForcePush(e.target.checked)}
                        className="rounded border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-amber-500"
                      />
                      <label
                        htmlFor="ws-force-push-checkbox"
                        className="cursor-pointer select-none"
                      >
                        {t("settings.force_push_label")}
                      </label>
                    </div>
                    {gitStatus.last_commit && (
                      <span className="text-[11px] font-mono text-slate-500 truncate max-w-xs">
                        {t("settings.last_commit")} {gitStatus.last_commit}
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
