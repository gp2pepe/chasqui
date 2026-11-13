import { invoke } from "@tauri-apps/api/core";
import type {
  ApiRequest,
  EnvironmentFile,
  GitStatusInfo,
  HttpExecutionResult,
  LoadTestResult,
  WorkspaceConfig,
  WorkspaceStatusInfo,
  AppDiagnostics,
  LatestReleaseInfo,
} from "./types";

const isTauriRuntime = (): boolean =>
  typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

export const chasquiApi = {
  async getWorkspaceInfo(): Promise<WorkspaceStatusInfo> {
    if (!isTauriRuntime()) {
      return fallbackState.getWorkspaceInfo();
    }
    return invoke<WorkspaceStatusInfo>("get_workspace_info");
  },

  async setWorkspaceDir(newDir: string): Promise<WorkspaceStatusInfo> {
    if (!isTauriRuntime()) {
      return fallbackState.setWorkspaceDir(newDir);
    }
    return invoke<WorkspaceStatusInfo>("set_workspace_dir", { newDir });
  },

  async updateWorkspaceConfig(
    config: WorkspaceConfig
  ): Promise<WorkspaceStatusInfo> {
    if (!isTauriRuntime()) {
      return fallbackState.updateWorkspaceConfig(config);
    }
    return invoke<WorkspaceStatusInfo>("update_workspace_config", { config });
  },

  async saveEnvironment(envFile: EnvironmentFile): Promise<EnvironmentFile[]> {
    if (!isTauriRuntime()) {
      return fallbackState.saveEnvironment(envFile);
    }
    return invoke<EnvironmentFile[]>("save_environment", { envFile });
  },

  async deleteEnvironment(name: string): Promise<EnvironmentFile[]> {
    if (!isTauriRuntime()) {
      return fallbackState.deleteEnvironment(name);
    }
    return invoke<EnvironmentFile[]>("delete_environment", { name });
  },

  async listRequests(): Promise<ApiRequest[]> {
    if (!isTauriRuntime()) {
      return fallbackState.listRequests();
    }
    return invoke<ApiRequest[]>("list_requests");
  },

  async saveRequest(request: ApiRequest): Promise<ApiRequest[]> {
    if (!isTauriRuntime()) {
      return fallbackState.saveRequest(request);
    }
    return invoke<ApiRequest[]>("save_request", { request });
  },

  async deleteRequest(id: string): Promise<ApiRequest[]> {
    if (!isTauriRuntime()) {
      return fallbackState.deleteRequest(id);
    }
    return invoke<ApiRequest[]>("delete_request", { id });
  },

  async unlockVault(
    passphrase: string,
    rememberInKeyring: boolean
  ): Promise<string[]> {
    if (!isTauriRuntime()) {
      return fallbackState.unlockVault(passphrase, rememberInKeyring);
    }
    return invoke<string[]>("unlock_vault", { passphrase, rememberInKeyring });
  },

  async lockVault(forgetKeyring: boolean): Promise<void> {
    if (!isTauriRuntime()) {
      return fallbackState.lockVault(forgetKeyring);
    }
    return invoke<void>("lock_vault", { forgetKeyring });
  },

  async listSecretKeys(): Promise<string[]> {
    if (!isTauriRuntime()) {
      return fallbackState.listSecretKeys();
    }
    return invoke<string[]>("list_secret_keys");
  },

  async setSecret(key: string, value: string): Promise<string[]> {
    if (!isTauriRuntime()) {
      return fallbackState.setSecret(key, value);
    }
    return invoke<string[]>("set_secret", { key, value });
  },

  async deleteSecret(key: string): Promise<string[]> {
    if (!isTauriRuntime()) {
      return fallbackState.deleteSecret(key);
    }
    return invoke<string[]>("delete_secret", { key });
  },

  async executeRequest(request: ApiRequest): Promise<HttpExecutionResult> {
    if (!isTauriRuntime()) {
      return fallbackState.executeRequest(request);
    }
    return invoke<HttpExecutionResult>("execute_request", { request });
  },

  async runLoadTest(
    request: ApiRequest,
    totalRequests: number,
    concurrency: number
  ): Promise<LoadTestResult> {
    if (!isTauriRuntime()) {
      return fallbackState.runLoadTest(request, totalRequests, concurrency);
    }
    return invoke<LoadTestResult>("run_load_test", {
      request,
      totalRequests,
      concurrency,
    });
  },

  async resolveRequestPreview(
    request: ApiRequest,
    revealSecrets: boolean
  ): Promise<ApiRequest> {
    if (!isTauriRuntime()) {
      return request;
    }
    return invoke<ApiRequest>("resolve_request_preview", {
      request,
      revealSecrets,
    });
  },

  async gitStatus(): Promise<GitStatusInfo> {
    if (!isTauriRuntime()) {
      return fallbackState.gitStatus();
    }
    return invoke<GitStatusInfo>("git_status");
  },

  async gitInit(remoteUrl: string | null): Promise<GitStatusInfo> {
    if (!isTauriRuntime()) {
      return fallbackState.gitInit(remoteUrl);
    }
    return invoke<GitStatusInfo>("git_init", { remoteUrl });
  },

  async gitSyncWorkspace(
    message: string,
    push: boolean,
    forcePush?: boolean,
    inlineToken?: string
  ): Promise<string> {
    if (!isTauriRuntime()) {
      return fallbackState.gitSyncWorkspace(message, push);
    }
    return invoke<string>("git_sync_workspace", {
      message,
      push,
      forcePush: forcePush ?? false,
      inlineToken: inlineToken || null,
    });
  },

  async gitPullWorkspace(
    inlineToken?: string,
    forceOverwrite?: boolean
  ): Promise<string> {
    if (!isTauriRuntime()) {
      return "Pull simulado en modo navegador";
    }
    return invoke<string>("git_pull_workspace", {
      inlineToken: inlineToken || null,
      forceOverwrite: forceOverwrite ?? false,
    });
  },

  async getAppDiagnostics(): Promise<AppDiagnostics> {
    if (!isTauriRuntime()) {
      return {
        version: "0.1.0",
        os: "browser",
        arch: "web",
        package_type: "browser",
      };
    }
    return invoke<AppDiagnostics>("get_app_diagnostics");
  },

  async checkLatestRelease(): Promise<LatestReleaseInfo | null> {
    if (!isTauriRuntime()) {
      return null;
    }
    try {
      return await invoke<LatestReleaseInfo>("check_latest_release");
    } catch {
      return null;
    }
  },

  async openExternalUrl(url: string): Promise<void> {
    if (!isTauriRuntime()) {
      window.open(url, "_blank", "noopener,noreferrer");
      return;
    }
    return invoke<void>("open_external_url", { url });
  },
};

// Fallback en memoria para previsualización en navegador cuando no corre dentro de WebView de Tauri
const fallbackState = (() => {
  let info: WorkspaceStatusInfo = {
    workspace_dir: "~/chasqui-data",
    config: {
      workspace_name: "Mi Workspace Chasqui",
      active_environment: "dev",
      git: {
        commit_encrypted_secrets: false,
        remote_url: null,
        branch: "main",
        user_name: "Chasqui User",
        user_email: "chasqui@local.workspace",
        auth_token_secret_key: null,
      },
    },
    vault_initialized: true,
    vault_unlocked: false,
    keyring_has_passphrase: false,
    environments: [
      {
        name: "dev",
        variables: { base_url: "https://httpbin.org" },
      },
    ],
  };

  let secrets: Record<string, string> = { API_TOKEN: "demo_secret_token_2026" };
  let requests: ApiRequest[] = [
    {
      id: "sample_get",
      name: "Ejemplo: Verificar Headers & Secretos",
      folder: "Ejemplos",
      method: "GET",
      url: "{{base_url}}/headers",
      headers: {
        Authorization: "Bearer {{secret:API_TOKEN}}",
        Accept: "application/json",
      },
      query_params: {},
      body: { content_type: "none", payload: "" },
    },
  ];

  return {
    async getWorkspaceInfo() {
      return { ...info };
    },
    async setWorkspaceDir(newDir: string) {
      info.workspace_dir = newDir;
      return { ...info };
    },
    async updateWorkspaceConfig(config: WorkspaceConfig) {
      info.config = config;
      return { ...info };
    },
    async saveEnvironment(envFile: EnvironmentFile) {
      const idx = info.environments.findIndex((e) => e.name === envFile.name);
      if (idx >= 0) info.environments[idx] = envFile;
      else info.environments.push(envFile);
      return [...info.environments];
    },
    async deleteEnvironment(name: string) {
      info.environments = info.environments.filter((e) => e.name !== name);
      return [...info.environments];
    },
    async listRequests() {
      return [...requests];
    },
    async saveRequest(req: ApiRequest) {
      const idx = requests.findIndex((r) => r.id === req.id);
      if (idx >= 0) requests[idx] = req;
      else requests.push(req);
      return [...requests];
    },
    async deleteRequest(id: string) {
      requests = requests.filter((r) => r.id !== id);
      return [...requests];
    },
    async unlockVault(_passphrase: string, remember: boolean) {
      info.vault_initialized = true;
      info.vault_unlocked = true;
      info.keyring_has_passphrase = remember;
      return Object.keys(secrets);
    },
    async lockVault(forget: boolean) {
      info.vault_unlocked = false;
      if (forget) info.keyring_has_passphrase = false;
    },
    async listSecretKeys() {
      return Object.keys(secrets);
    },
    async setSecret(k: string, v: string) {
      secrets[k] = v;
      return Object.keys(secrets);
    },
    async deleteSecret(k: string) {
      delete secrets[k];
      return Object.keys(secrets);
    },
    async executeRequest(req: ApiRequest): Promise<HttpExecutionResult> {
      const started = performance.now();
      const resp = await fetch("https://httpbin.org/get");
      const text = await resp.text();
      const headers: Record<string, string> = {};
      resp.headers.forEach((v, k) => {
        headers[k] = v;
      });
      return {
        status: resp.status,
        status_text: resp.statusText || "OK",
        http_version: "HTTP/2.0",
        remote_addr: "54.164.234.112:443",
        duration_ms: Math.round(performance.now() - started),
        size_bytes: text.length,
        headers,
        request_headers: req.headers,
        body: text,
        raw_body: text,
        resolved_url: "https://httpbin.org/get",
        method: req.method,
      };
    },
    async runLoadTest(
      _req: ApiRequest,
      totalRequests: number,
      concurrency: number
    ): Promise<LoadTestResult> {
      const samples = Array.from({ length: totalRequests }, (_, i) => {
        const dur = 80 + ((i * 19) % 120);
        return {
          index: i + 1,
          status: 200,
          duration_ms: dur,
          size_bytes: 312,
          ok: true,
          error: null,
        };
      });
      const durations = samples.map((s) => s.duration_ms).sort((a, b) => a - b);
      const sum = durations.reduce((a, b) => a + b, 0);
      return {
        total_requests: totalRequests,
        concurrency,
        success_count: totalRequests,
        error_count: 0,
        total_duration_ms: Math.round(sum / concurrency),
        rps: Number((totalRequests / (sum / concurrency / 1000)).toFixed(2)),
        min_ms: durations[0] || 0,
        max_ms: durations[durations.length - 1] || 0,
        avg_ms: Number((sum / totalRequests).toFixed(2)),
        p50_ms: durations[Math.floor(durations.length / 2)] || 0,
        p95_ms: durations[Math.floor(durations.length * 0.95)] || 0,
        samples,
      };
    },
    async gitStatus(): Promise<GitStatusInfo> {
      return {
        is_repo: true,
        branch: info.config.git.branch || "main",
        changed_files: ["M chasqui.toml", "M requests/sample_get.toml"],
        secrets_ignored: !info.config.git.commit_encrypted_secrets,
        remote_url: info.config.git.remote_url,
        user_name: info.config.git.user_name || "Chasqui User",
        user_email: info.config.git.user_email || "chasqui@local.workspace",
        last_commit: "a1b2c3d Initial workspace commit",
      };
    },
    async gitInit(remoteUrl: string | null): Promise<GitStatusInfo> {
      info.config.git.remote_url = remoteUrl;
      return this.gitStatus();
    },
    async gitSyncWorkspace(_msg: string, _push: boolean) {
      return "Sincronización simulada en modo navegador";
    },
  };
})();
