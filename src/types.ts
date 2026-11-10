export interface GitConfig {
  commit_encrypted_secrets: boolean;
  remote_url: string | null;
  branch?: string | null;
  user_name?: string | null;
  user_email?: string | null;
  auth_token_secret_key?: string | null;
}

export interface WorkspaceConfig {
  workspace_name: string;
  active_environment: string | null;
  git: GitConfig;
}

export interface EnvironmentFile {
  name: string;
  variables: Record<string, string>;
}

export interface RequestBody {
  content_type: "none" | "json" | "text" | "form";
  payload: string;
}

export interface ApiRequest {
  id: string;
  name: string;
  folder: string | null;
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  url: string;
  headers: Record<string, string>;
  query_params: Record<string, string>;
  body: RequestBody | null;
}

export interface HttpExecutionResult {
  status: number;
  status_text: string;
  http_version: string;
  remote_addr: string | null;
  duration_ms: number;
  size_bytes: number;
  headers: Record<string, string>;
  request_headers: Record<string, string>;
  body: string;
  raw_body: string;
  resolved_url: string;
  method: string;
}

export interface LoadSample {
  index: number;
  status: number;
  duration_ms: number;
  size_bytes: number;
  ok: boolean;
  error: string | null;
}

export interface LoadTestResult {
  total_requests: number;
  concurrency: number;
  success_count: number;
  error_count: number;
  total_duration_ms: number;
  rps: number;
  min_ms: number;
  max_ms: number;
  avg_ms: number;
  p50_ms: number;
  p95_ms: number;
  samples: LoadSample[];
}

export interface WorkspaceStatusInfo {
  workspace_dir: string;
  config: WorkspaceConfig;
  vault_initialized: boolean;
  vault_unlocked: boolean;
  keyring_has_passphrase: boolean;
  environments: EnvironmentFile[];
}

export interface GitStatusInfo {
  is_repo: boolean;
  branch: string;
  changed_files: string[];
  secrets_ignored: boolean;
  remote_url: string | null;
  user_name: string | null;
  user_email: string | null;
  last_commit: string | null;
}
