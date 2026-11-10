use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct WorkspaceConfig {
    pub workspace_name: String,
    pub active_environment: Option<String>,
    pub git: GitConfig,
}

impl Default for WorkspaceConfig {
    fn default() -> Self {
        Self {
            workspace_name: "Mi Workspace Chasqui".to_string(),
            active_environment: Some("dev".to_string()),
            git: GitConfig {
                commit_encrypted_secrets: false,
                remote_url: None,
                branch: Some("main".to_string()),
                user_name: None,
                user_email: None,
                auth_token_secret_key: None,
            },
        }
    }
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct GitConfig {
    pub commit_encrypted_secrets: bool,
    pub remote_url: Option<String>,
    #[serde(default)]
    pub branch: Option<String>,
    #[serde(default)]
    pub user_name: Option<String>,
    #[serde(default)]
    pub user_email: Option<String>,
    /// Nombre del secreto en el Vault (ej. "GITLAB_TOKEN") o token para autenticar HTTPS sin prompt interactivo
    #[serde(default)]
    pub auth_token_secret_key: Option<String>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct EnvironmentFile {
    pub name: String,
    #[serde(default)]
    pub variables: BTreeMap<String, String>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct RequestBody {
    pub content_type: String, // "json" | "text" | "form" | "none"
    pub payload: String,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct ApiRequest {
    pub id: String,
    pub name: String,
    pub folder: Option<String>,
    pub method: String,
    pub url: String,
    #[serde(default)]
    pub headers: BTreeMap<String, String>,
    #[serde(default)]
    pub query_params: BTreeMap<String, String>,
    pub body: Option<RequestBody>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct EncryptedSecretEntry {
    pub nonce_b64: String,
    pub ciphertext_b64: String,
    pub updated_at: String,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct SecretVaultFile {
    pub version: u32,
    pub kdf: String,
    pub cipher: String,
    pub salt_b64: String,
    /// Valor de verificación encriptado para comprobar que la clave maestra sea válida al abrir el vault
    pub verifier: Option<EncryptedSecretEntry>,
    #[serde(default)]
    pub secrets: BTreeMap<String, EncryptedSecretEntry>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct HttpExecutionResult {
    pub status: u16,
    pub status_text: String,
    pub http_version: String,
    pub remote_addr: Option<String>,
    pub duration_ms: u128,
    pub size_bytes: usize,
    pub headers: BTreeMap<String, String>,
    pub request_headers: BTreeMap<String, String>,
    pub body: String,
    pub raw_body: String,
    pub resolved_url: String,
    pub method: String,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct WorkspaceStatusInfo {
    pub workspace_dir: String,
    pub config: WorkspaceConfig,
    pub vault_initialized: bool,
    pub vault_unlocked: bool,
    pub keyring_has_passphrase: bool,
    pub environments: Vec<EnvironmentFile>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct GitStatusInfo {
    pub is_repo: bool,
    pub branch: String,
    pub changed_files: Vec<String>,
    pub secrets_ignored: bool,
    pub remote_url: Option<String>,
    pub user_name: Option<String>,
    pub user_email: Option<String>,
    pub last_commit: Option<String>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct LoadSample {
    pub index: usize,
    pub status: u16,
    pub duration_ms: u128,
    pub size_bytes: usize,
    pub ok: bool,
    pub error: Option<String>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct LoadTestResult {
    pub total_requests: usize,
    pub concurrency: usize,
    pub success_count: usize,
    pub error_count: usize,
    pub total_duration_ms: u128,
    pub rps: f64,
    pub min_ms: u128,
    pub max_ms: u128,
    pub avg_ms: f64,
    pub p50_ms: u128,
    pub p95_ms: u128,
    pub samples: Vec<LoadSample>,
}

