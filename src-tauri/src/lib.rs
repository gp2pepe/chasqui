pub mod crypto;
pub mod git_sync;
pub mod http_client;
pub mod models;
pub mod workspace;

use crypto::CryptoVault;
use models::{
    ApiRequest, EnvironmentFile, GitStatusInfo, HttpExecutionResult, LoadTestResult,
    WorkspaceConfig, WorkspaceStatusInfo,
};
use std::collections::BTreeMap;
use std::path::PathBuf;
use std::sync::Mutex;
use tauri::State;
use workspace::WorkspaceManager;

pub struct AppState {
    pub workspace: Mutex<WorkspaceManager>,
    pub vault: Mutex<CryptoVault>,
}

impl Default for AppState {
    fn default() -> Self {
        Self::new()
    }
}

impl AppState {
    pub fn new() -> Self {
        let ws = WorkspaceManager::new();
        let mut vault = CryptoVault::new();

        // Intentar auto-desbloquear si la contraseña está guardada en el Keyring del SO
        if let Some(saved_pass) = CryptoVault::load_passphrase_from_os_keyring(&ws.current_dir) {
            let _ = vault.unlock_or_init(&ws.current_dir, &saved_pass);
        }

        Self {
            workspace: Mutex::new(ws),
            vault: Mutex::new(vault),
        }
    }
}

#[tauri::command]
fn get_workspace_info(state: State<'_, AppState>) -> Result<WorkspaceStatusInfo, String> {
    let ws = state.workspace.lock().map_err(|_| "Lock error")?;
    let vault = state.vault.lock().map_err(|_| "Lock error")?;

    let config = ws.load_config()?;
    let environments = ws.list_environments()?;
    let vault_initialized = CryptoVault::is_initialized(&ws.current_dir);
    let keyring_has_passphrase =
        CryptoVault::load_passphrase_from_os_keyring(&ws.current_dir).is_some();

    Ok(WorkspaceStatusInfo {
        workspace_dir: ws.current_dir.to_string_lossy().to_string(),
        config,
        vault_initialized,
        vault_unlocked: vault.is_unlocked(),
        keyring_has_passphrase,
        environments,
    })
}

#[tauri::command]
fn set_workspace_dir(
    state: State<'_, AppState>,
    new_dir: String,
) -> Result<WorkspaceStatusInfo, String> {
    let mut ws = state.workspace.lock().map_err(|_| "Lock error")?;
    let mut vault = state.vault.lock().map_err(|_| "Lock error")?;

    ws.set_workspace_dir(PathBuf::from(new_dir))?;
    vault.lock();

    if let Some(saved_pass) = CryptoVault::load_passphrase_from_os_keyring(&ws.current_dir) {
        let _ = vault.unlock_or_init(&ws.current_dir, &saved_pass);
    }

    let config = ws.load_config()?;
    let environments = ws.list_environments()?;
    let vault_initialized = CryptoVault::is_initialized(&ws.current_dir);
    let keyring_has_passphrase =
        CryptoVault::load_passphrase_from_os_keyring(&ws.current_dir).is_some();

    Ok(WorkspaceStatusInfo {
        workspace_dir: ws.current_dir.to_string_lossy().to_string(),
        config,
        vault_initialized,
        vault_unlocked: vault.is_unlocked(),
        keyring_has_passphrase,
        environments,
    })
}

#[tauri::command]
fn update_workspace_config(
    state: State<'_, AppState>,
    config: WorkspaceConfig,
) -> Result<WorkspaceStatusInfo, String> {
    let ws = state.workspace.lock().map_err(|_| "Lock error")?;
    let vault = state.vault.lock().map_err(|_| "Lock error")?;

    ws.save_config(&config)?;
    let environments = ws.list_environments()?;

    Ok(WorkspaceStatusInfo {
        workspace_dir: ws.current_dir.to_string_lossy().to_string(),
        config,
        vault_initialized: CryptoVault::is_initialized(&ws.current_dir),
        vault_unlocked: vault.is_unlocked(),
        keyring_has_passphrase: CryptoVault::load_passphrase_from_os_keyring(&ws.current_dir)
            .is_some(),
        environments,
    })
}

#[tauri::command]
fn save_environment(
    state: State<'_, AppState>,
    env_file: EnvironmentFile,
) -> Result<Vec<EnvironmentFile>, String> {
    let ws = state.workspace.lock().map_err(|_| "Lock error")?;
    ws.save_environment(&env_file)?;
    ws.list_environments()
}

#[tauri::command]
fn delete_environment(
    state: State<'_, AppState>,
    name: String,
) -> Result<Vec<EnvironmentFile>, String> {
    let ws = state.workspace.lock().map_err(|_| "Lock error")?;
    ws.delete_environment(&name)?;
    ws.list_environments()
}

#[tauri::command]
fn list_requests(state: State<'_, AppState>) -> Result<Vec<ApiRequest>, String> {
    let ws = state.workspace.lock().map_err(|_| "Lock error")?;
    ws.list_requests()
}

#[tauri::command]
fn save_request(state: State<'_, AppState>, request: ApiRequest) -> Result<Vec<ApiRequest>, String> {
    let ws = state.workspace.lock().map_err(|_| "Lock error")?;
    ws.save_request(&request)?;
    ws.list_requests()
}

#[tauri::command]
fn delete_request(state: State<'_, AppState>, id: String) -> Result<Vec<ApiRequest>, String> {
    let ws = state.workspace.lock().map_err(|_| "Lock error")?;
    ws.delete_request(&id)?;
    ws.list_requests()
}

#[tauri::command]
fn unlock_vault(
    state: State<'_, AppState>,
    passphrase: String,
    remember_in_keyring: bool,
) -> Result<Vec<String>, String> {
    let ws = state.workspace.lock().map_err(|_| "Lock error")?;
    let mut vault = state.vault.lock().map_err(|_| "Lock error")?;

    vault.unlock_or_init(&ws.current_dir, &passphrase)?;

    if remember_in_keyring {
        let _ = CryptoVault::save_passphrase_in_os_keyring(&ws.current_dir, &passphrase);
    }

    CryptoVault::list_secret_keys(&ws.current_dir)
}

#[tauri::command]
fn lock_vault(state: State<'_, AppState>, forget_keyring: bool) -> Result<(), String> {
    let ws = state.workspace.lock().map_err(|_| "Lock error")?;
    let mut vault = state.vault.lock().map_err(|_| "Lock error")?;
    vault.lock();
    if forget_keyring {
        let _ = CryptoVault::clear_passphrase_from_os_keyring(&ws.current_dir);
    }
    Ok(())
}

#[tauri::command]
fn list_secret_keys(state: State<'_, AppState>) -> Result<Vec<String>, String> {
    let ws = state.workspace.lock().map_err(|_| "Lock error")?;
    CryptoVault::list_secret_keys(&ws.current_dir)
}

#[tauri::command]
fn set_secret(
    state: State<'_, AppState>,
    key: String,
    value: String,
) -> Result<Vec<String>, String> {
    let ws = state.workspace.lock().map_err(|_| "Lock error")?;
    let vault = state.vault.lock().map_err(|_| "Lock error")?;
    vault.set_secret(&ws.current_dir, &key, &value)?;
    CryptoVault::list_secret_keys(&ws.current_dir)
}

#[tauri::command]
fn delete_secret(state: State<'_, AppState>, key: String) -> Result<Vec<String>, String> {
    let ws = state.workspace.lock().map_err(|_| "Lock error")?;
    let vault = state.vault.lock().map_err(|_| "Lock error")?;
    vault.delete_secret(&ws.current_dir, &key)?;
    CryptoVault::list_secret_keys(&ws.current_dir)
}

#[tauri::command]
async fn execute_request(
    state: State<'_, AppState>,
    request: ApiRequest,
) -> Result<HttpExecutionResult, String> {
    let (env_vars, secrets, vault_unlocked) = {
        let ws = state.workspace.lock().map_err(|_| "Lock error")?;
        let vault = state.vault.lock().map_err(|_| "Lock error")?;

        let cfg = ws.load_config()?;
        let envs = ws.list_environments()?;
        let active_env_vars = cfg
            .active_environment
            .and_then(|active| envs.into_iter().find(|e| e.name == active))
            .map(|e| e.variables)
            .unwrap_or_else(BTreeMap::new);

        let unlocked = vault.is_unlocked();
        let decrypted_secrets = if unlocked {
            vault.get_decrypted_secrets(&ws.current_dir)?
        } else {
            BTreeMap::new()
        };

        (active_env_vars, decrypted_secrets, unlocked)
    };

    http_client::send_http_request(&request, &env_vars, &secrets, vault_unlocked).await
}

#[tauri::command]
async fn run_load_test(
    state: State<'_, AppState>,
    request: ApiRequest,
    total_requests: usize,
    concurrency: usize,
) -> Result<LoadTestResult, String> {
    let (env_vars, secrets, vault_unlocked) = {
        let ws = state.workspace.lock().map_err(|_| "Lock error")?;
        let vault = state.vault.lock().map_err(|_| "Lock error")?;

        let cfg = ws.load_config()?;
        let envs = ws.list_environments()?;
        let active_env_vars = cfg
            .active_environment
            .and_then(|active| envs.into_iter().find(|e| e.name == active))
            .map(|e| e.variables)
            .unwrap_or_else(BTreeMap::new);

        let unlocked = vault.is_unlocked();
        let decrypted_secrets = if unlocked {
            vault.get_decrypted_secrets(&ws.current_dir)?
        } else {
            BTreeMap::new()
        };

        (active_env_vars, decrypted_secrets, unlocked)
    };

    http_client::execute_load_test(
        &request,
        &env_vars,
        &secrets,
        vault_unlocked,
        total_requests,
        concurrency,
    )
    .await
}

#[tauri::command]
fn resolve_request_preview(
    state: State<'_, AppState>,
    request: ApiRequest,
    reveal_secrets: bool,
) -> Result<ApiRequest, String> {
    let ws = state.workspace.lock().map_err(|_| "Lock error")?;
    let vault = state.vault.lock().map_err(|_| "Lock error")?;

    let cfg = ws.load_config()?;
    let envs = ws.list_environments()?;
    let active_env_vars = cfg
        .active_environment
        .and_then(|active| envs.into_iter().find(|e| e.name == active))
        .map(|e| e.variables)
        .unwrap_or_else(BTreeMap::new);

    let unlocked = vault.is_unlocked();
    let decrypted_secrets = if unlocked && reveal_secrets {
        vault.get_decrypted_secrets(&ws.current_dir)?
    } else {
        BTreeMap::new()
    };

    http_client::resolve_request_for_export(
        &request,
        &active_env_vars,
        &decrypted_secrets,
        unlocked,
        reveal_secrets,
    )
}

#[tauri::command]
fn git_status(state: State<'_, AppState>) -> Result<GitStatusInfo, String> {
    let ws = state.workspace.lock().map_err(|_| "Lock error")?;
    git_sync::get_git_status(&ws.current_dir)
}

#[tauri::command]
fn git_init(
    state: State<'_, AppState>,
    remote_url: Option<String>,
) -> Result<GitStatusInfo, String> {
    let ws = state.workspace.lock().map_err(|_| "Lock error")?;
    let mut cfg = ws.load_config()?;
    if remote_url.is_some() {
        cfg.git.remote_url = remote_url;
        ws.save_config(&cfg)?;
    }
    git_sync::init_git_repo(&ws.current_dir, &cfg.git)
}

#[tauri::command]
fn git_sync_workspace(
    state: State<'_, AppState>,
    message: String,
    push: bool,
    force_push: Option<bool>,
    inline_token: Option<String>,
) -> Result<String, String> {
    let ws = state.workspace.lock().map_err(|_| "Lock error")?;
    let vault = state.vault.lock().map_err(|_| "Lock error")?;
    let cfg = ws.load_config()?;

    // Resolver token desde inline_token o desde el Vault si se configuró auth_token_secret_key
    let resolved_token = if let Some(tok) = inline_token.filter(|s| !s.trim().is_empty()) {
        Some(tok)
    } else if let Some(ref secret_key) = cfg.git.auth_token_secret_key {
        if !secret_key.trim().is_empty() && vault.is_unlocked() {
            vault
                .get_decrypted_secrets(&ws.current_dir)
                .ok()
                .and_then(|map| map.get(secret_key.trim()).cloned())
        } else {
            None
        }
    } else {
        None
    };

    git_sync::commit_and_sync(
        &ws.current_dir,
        &cfg.git,
        resolved_token.as_deref(),
        &message,
        push,
        force_push.unwrap_or(false),
    )
}

#[tauri::command]
fn git_pull_workspace(
    state: State<'_, AppState>,
    inline_token: Option<String>,
    force_overwrite: Option<bool>,
) -> Result<String, String> {
    let ws = state.workspace.lock().map_err(|_| "Lock error")?;
    let vault = state.vault.lock().map_err(|_| "Lock error")?;
    let cfg = ws.load_config()?;

    let resolved_token = if let Some(tok) = inline_token.filter(|s| !s.trim().is_empty()) {
        Some(tok)
    } else if let Some(ref secret_key) = cfg.git.auth_token_secret_key {
        if !secret_key.trim().is_empty() && vault.is_unlocked() {
            vault
                .get_decrypted_secrets(&ws.current_dir)
                .ok()
                .and_then(|map| map.get(secret_key.trim()).cloned())
        } else {
            None
        }
    } else {
        None
    };

    let msg = git_sync::pull_workspace(
        &ws.current_dir,
        &cfg.git,
        resolved_token.as_deref(),
        force_overwrite.unwrap_or(false),
    )?;

    // Asegurar que la estructura de carpetas exista tras el pull y preservar la URL remota si el chasqui.toml remoto no la tenía escrita
    let _ = ws.ensure_structure();
    if let Ok(mut pulled_cfg) = ws.load_config() {
        if pulled_cfg.git.remote_url.is_none() && cfg.git.remote_url.is_some() {
            pulled_cfg.git.remote_url = cfg.git.remote_url;
            let _ = ws.save_config(&pulled_cfg);
        }
    }

    Ok(msg)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .manage(AppState::new())
        .invoke_handler(tauri::generate_handler![
            get_workspace_info,
            set_workspace_dir,
            update_workspace_config,
            save_environment,
            delete_environment,
            list_requests,
            save_request,
            delete_request,
            unlock_vault,
            lock_vault,
            list_secret_keys,
            set_secret,
            delete_secret,
            execute_request,
            run_load_test,
            resolve_request_preview,
            git_status,
            git_init,
            git_sync_workspace,
            git_pull_workspace
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
