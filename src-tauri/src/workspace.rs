use crate::models::{ApiRequest, EnvironmentFile, RequestBody, WorkspaceConfig};
use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;
use std::fs;
use std::path::{Path, PathBuf};

#[derive(Serialize, Deserialize, Default)]
struct BootstrapPointer {
    custom_workspace_dir: Option<String>,
}

pub struct WorkspaceManager {
    pub current_dir: PathBuf,
}

impl Default for WorkspaceManager {
    fn default() -> Self {
        Self::new()
    }
}

impl WorkspaceManager {
    pub fn new() -> Self {
        let dir = Self::resolve_initial_workspace_dir();
        let mgr = Self { current_dir: dir };
        let _ = mgr.ensure_structure();
        mgr
    }

    fn bootstrap_file_path() -> PathBuf {
        if let Some(cfg_dir) = dirs::config_dir() {
            cfg_dir.join("chasqui").join("bootstrap.toml")
        } else {
            PathBuf::from(".chasqui-bootstrap.toml")
        }
    }

    /// Determina el directorio del Workspace:
    /// 1. Si el usuario configuró uno personalizado en bootstrap.toml, usa ese.
    /// 2. Por defecto: carpeta `chasqui-data` donde está instalada/ejecutándose la app (portable).
    /// 3. Si el directorio de instalación no tiene permisos de escritura, hace fallback a AppData/Config.
    pub fn resolve_initial_workspace_dir() -> PathBuf {
        let bootstrap_path = Self::bootstrap_file_path();
        if bootstrap_path.exists() {
            if let Ok(raw) = fs::read_to_string(&bootstrap_path) {
                if let Ok(ptr) = toml::from_str::<BootstrapPointer>(&raw) {
                    if let Some(custom) = ptr.custom_workspace_dir {
                        let custom_path = PathBuf::from(custom);
                        if fs::create_dir_all(&custom_path).is_ok() {
                            return custom_path;
                        }
                    }
                }
            }
        }

        // Intentar carpeta junto al ejecutable si es modo portable (no en /usr/bin o /bin)
        if let Ok(exe_path) = std::env::current_exe() {
            if let Some(exe_dir) = exe_path.parent() {
                let exe_dir_str = exe_dir.to_string_lossy();
                if !exe_dir_str.starts_with("/usr")
                    && !exe_dir_str.starts_with("/bin")
                    && !exe_dir_str.starts_with("/sbin")
                {
                    let portable_dir = exe_dir.join("chasqui-data");
                    if fs::create_dir_all(&portable_dir).is_ok() {
                        return portable_dir;
                    }
                }
            }
        }

        if let Some(home_dir) = dirs::home_dir() {
            let user_dir = home_dir.join("chasqui-data");
            if fs::create_dir_all(&user_dir).is_ok() {
                return user_dir;
            }
        }

        dirs::data_local_dir()
            .unwrap_or_else(|| PathBuf::from("."))
            .join("chasqui-data")
    }

    pub fn set_workspace_dir(&mut self, new_dir: PathBuf) -> Result<(), String> {
        fs::create_dir_all(&new_dir)
            .map_err(|e| format!("No se pudo crear o acceder al directorio {:?}: {e}", new_dir))?;
        self.current_dir = new_dir.clone();
        self.ensure_structure()?;

        let bootstrap_path = Self::bootstrap_file_path();
        if let Some(parent) = bootstrap_path.parent() {
            let _ = fs::create_dir_all(parent);
        }
        let ptr = BootstrapPointer {
            custom_workspace_dir: Some(new_dir.to_string_lossy().to_string()),
        };
        if let Ok(raw) = toml::to_string_pretty(&ptr) {
            let _ = fs::write(bootstrap_path, raw);
        }
        Ok(())
    }

    pub fn config_path(&self) -> PathBuf {
        self.current_dir.join("chasqui.toml")
    }

    pub fn requests_dir(&self) -> PathBuf {
        self.current_dir.join("requests")
    }

    pub fn environments_dir(&self) -> PathBuf {
        self.current_dir.join("environments")
    }

    pub fn secrets_dir(&self) -> PathBuf {
        self.current_dir.join("secrets")
    }

    pub fn ensure_structure(&self) -> Result<(), String> {
        fs::create_dir_all(self.requests_dir())
            .map_err(|e| format!("Error creando requests/: {e}"))?;
        fs::create_dir_all(self.environments_dir())
            .map_err(|e| format!("Error creando environments/: {e}"))?;
        fs::create_dir_all(self.secrets_dir())
            .map_err(|e| format!("Error creando secrets/: {e}"))?;

        if !self.config_path().exists() {
            let default_cfg = WorkspaceConfig::default();
            self.save_config(&default_cfg)?;
        } else {
            let cfg = self.load_config()?;
            self.sync_gitignore(&cfg)?;
        }

        // Crear un entorno dev.toml y un request de ejemplo si la carpeta está nueva
        let dev_env_path = self.environments_dir().join("dev.toml");
        if !dev_env_path.exists() {
            let mut vars = BTreeMap::new();
            vars.insert("base_url".to_string(), "https://httpbin.org".to_string());
            let env_file = EnvironmentFile {
                name: "dev".to_string(),
                variables: vars,
            };
            let _ = self.save_environment(&env_file);
        }

        let sample_req_path = self.requests_dir().join("sample_get.toml");
        if !sample_req_path.exists() && self.list_requests()?.is_empty() {
            let mut headers = BTreeMap::new();
            headers.insert("Authorization".to_string(), "Bearer {{secret:API_TOKEN}}".to_string());
            headers.insert("Accept".to_string(), "application/json".to_string());

            let sample = ApiRequest {
                id: "sample_get".to_string(),
                name: "Ejemplo: Verificar Headers & Secretos".to_string(),
                folder: Some("Ejemplos".to_string()),
                method: "GET".to_string(),
                url: "{{base_url}}/headers".to_string(),
                headers,
                query_params: BTreeMap::new(),
                body: Some(RequestBody {
                    content_type: "none".to_string(),
                    payload: "".to_string(),
                }),
            };
            let _ = self.save_request(&sample);
        }

        Ok(())
    }

    pub fn load_config(&self) -> Result<WorkspaceConfig, String> {
        let path = self.config_path();
        if !path.exists() {
            return Ok(WorkspaceConfig::default());
        }
        let raw = fs::read_to_string(&path)
            .map_err(|e| format!("Error leyendo chasqui.toml: {e}"))?;
        toml::from_str(&raw).map_err(|e| format!("Error parseando chasqui.toml: {e}"))
    }

    pub fn save_config(&self, config: &WorkspaceConfig) -> Result<(), String> {
        let raw = toml::to_string_pretty(config)
            .map_err(|e| format!("Error serializando chasqui.toml: {e}"))?;
        let header = "# Configuración del Workspace de Chasqui\n# Este archivo se puede versionar en Git / GitLab.\n\n";
        fs::write(self.config_path(), format!("{header}{raw}"))
            .map_err(|e| format!("Error guardando chasqui.toml: {e}"))?;
        self.sync_gitignore(config)?;
        let _ = crate::git_sync::apply_git_config_to_repo(&self.current_dir, &config.git);
        Ok(())
    }

    /// Actualiza `.gitignore` automáticamente para excluir o incluir `secrets/`
    /// según `config.git.commit_encrypted_secrets`.
    pub fn sync_gitignore(&self, config: &WorkspaceConfig) -> Result<(), String> {
        let gitignore_path = self.current_dir.join(".gitignore");
        let content = if config.git.commit_encrypted_secrets {
            "# Generado automáticamente por Chasqui\n\
             # [MODO: Secretos encriptados INCLUIDOS en Git]\n\
             # El archivo secrets/vault.enc.toml (cifrado con AES-256-GCM) se subirá al repositorio.\n\
             *.tmp\n\
             .DS_Store\n"
        } else {
            "# Generado automáticamente por Chasqui\n\
             # [MODO: Secretos EXCLUIDOS de Git por seguridad]\n\
             # Cambia `commit_encrypted_secrets = true` en chasqui.toml si deseas subir el vault encriptado.\n\
             secrets/\n\
             *.tmp\n\
             .DS_Store\n"
        };
        fs::write(gitignore_path, content)
            .map_err(|e| format!("No se pudo actualizar .gitignore: {e}"))
    }

    pub fn list_requests(&self) -> Result<Vec<ApiRequest>, String> {
        let mut results = Vec::new();
        Self::collect_requests_recursive(&self.requests_dir(), &mut results)?;
        results.sort_by_key(|a| a.name.to_lowercase());
        Ok(results)
    }

    fn collect_requests_recursive(dir: &Path, out: &mut Vec<ApiRequest>) -> Result<(), String> {
        if !dir.exists() {
            return Ok(());
        }
        let entries = fs::read_dir(dir).map_err(|e| format!("Error leyendo {:?}: {e}", dir))?;
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_dir() {
                Self::collect_requests_recursive(&path, out)?;
            } else if path.extension().and_then(|s| s.to_str()) == Some("toml") {
                if let Ok(raw) = fs::read_to_string(&path) {
                    if let Ok(req) = toml::from_str::<ApiRequest>(&raw) {
                        out.push(req);
                    }
                }
            }
        }
        Ok(())
    }

    pub fn save_request(&self, req: &ApiRequest) -> Result<(), String> {
        let safe_id: String = req
            .id
            .chars()
            .filter(|c| c.is_alphanumeric() || *c == '_' || *c == '-')
            .collect();
        if safe_id.is_empty() {
            return Err("ID de request inválido".to_string());
        }
        let target_dir = if let Some(ref folder) = req.folder {
            let safe_folder: String = folder
                .chars()
                .filter(|c| c.is_alphanumeric() || *c == '_' || *c == '-' || *c == ' ')
                .collect();
            if safe_folder.trim().is_empty() {
                self.requests_dir()
            } else {
                self.requests_dir().join(safe_folder.trim())
            }
        } else {
            self.requests_dir()
        };

        fs::create_dir_all(&target_dir)
            .map_err(|e| format!("No se pudo crear carpeta de request: {e}"))?;

        // Si el request existía en otra subcarpeta con el mismo ID, limpiar el archivo anterior
        self.remove_request_file_by_id(&safe_id)?;

        let file_path = target_dir.join(format!("{safe_id}.toml"));
        let raw = toml::to_string_pretty(req)
            .map_err(|e| format!("Error serializando request a TOML: {e}"))?;
        let header = "# Archivo de Request de Chasqui\n# Usa {{variable}} para entornos y {{secret:NOMBRE}} para API keys del Vault.\n\n";
        fs::write(file_path, format!("{header}{raw}"))
            .map_err(|e| format!("No se pudo escribir el archivo del request: {e}"))
    }

    pub fn delete_request(&self, id: &str) -> Result<(), String> {
        self.remove_request_file_by_id(id)
    }

    fn remove_request_file_by_id(&self, id: &str) -> Result<(), String> {
        Self::remove_recursive(&self.requests_dir(), id)
    }

    fn remove_recursive(dir: &Path, id: &str) -> Result<(), String> {
        if !dir.exists() {
            return Ok(());
        }
        let expected_name = format!("{id}.toml");
        for entry in fs::read_dir(dir).map_err(|e| e.to_string())?.flatten() {
            let path = entry.path();
            if path.is_dir() {
                Self::remove_recursive(&path, id)?;
            } else if path.file_name().and_then(|n| n.to_str()) == Some(&expected_name) {
                let _ = fs::remove_file(path);
            }
        }
        Ok(())
    }

    pub fn list_environments(&self) -> Result<Vec<EnvironmentFile>, String> {
        let mut envs = Vec::new();
        let dir = self.environments_dir();
        if !dir.exists() {
            return Ok(envs);
        }
        for entry in fs::read_dir(dir).map_err(|e| e.to_string())?.flatten() {
            let path = entry.path();
            if path.extension().and_then(|s| s.to_str()) == Some("toml") {
                if let Ok(raw) = fs::read_to_string(&path) {
                    if let Ok(env_file) = toml::from_str::<EnvironmentFile>(&raw) {
                        envs.push(env_file);
                    }
                }
            }
        }
        envs.sort_by_key(|a| a.name.clone());
        Ok(envs)
    }

    pub fn save_environment(&self, env_file: &EnvironmentFile) -> Result<(), String> {
        let safe_name: String = env_file
            .name
            .chars()
            .filter(|c| c.is_alphanumeric() || *c == '_' || *c == '-')
            .collect();
        if safe_name.is_empty() {
            return Err("Nombre de entorno inválido".to_string());
        }
        let path = self.environments_dir().join(format!("{safe_name}.toml"));
        let raw = toml::to_string_pretty(env_file).map_err(|e| e.to_string())?;
        fs::write(path, raw).map_err(|e| e.to_string())
    }

    pub fn delete_environment(&self, name: &str) -> Result<(), String> {
        let safe_name: String = name
            .chars()
            .filter(|c| c.is_alphanumeric() || *c == '_' || *c == '-')
            .collect();
        let path = self.environments_dir().join(format!("{safe_name}.toml"));
        if path.exists() {
            let _ = fs::remove_file(path);
        }
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::GitConfig;

    #[test]
    fn test_gitignore_toggles_secrets_folder() {
        let temp_dir = std::env::temp_dir().join(format!("chasqui_ws_test_{}", rand::random::<u32>()));
        let _ = fs::remove_dir_all(&temp_dir);
        fs::create_dir_all(&temp_dir).unwrap();

        let mgr = WorkspaceManager {
            current_dir: temp_dir.clone(),
        };
        mgr.ensure_structure().unwrap();

        // Por defecto commit_encrypted_secrets = false -> secrets/ debe estar en .gitignore
        let gitignore_default = fs::read_to_string(temp_dir.join(".gitignore")).unwrap();
        assert!(gitignore_default.lines().any(|l| l.trim() == "secrets/"));

        // Cambiar a commit_encrypted_secrets = true -> secrets/ ya NO debe estar en .gitignore
        let cfg = WorkspaceConfig {
            workspace_name: "Test".to_string(),
            active_environment: Some("dev".to_string()),
            git: GitConfig {
                commit_encrypted_secrets: true,
                remote_url: Some("https://gitlab.com/equipo/api-collection.git".to_string()),
                branch: Some("main".to_string()),
                user_name: None,
                user_email: None,
                auth_token_secret_key: None,
            },
        };
        mgr.save_config(&cfg).unwrap();

        let gitignore_updated = fs::read_to_string(temp_dir.join(".gitignore")).unwrap();
        assert!(!gitignore_updated.lines().any(|l| l.trim() == "secrets/"));

        let _ = fs::remove_dir_all(&temp_dir);
    }
}
