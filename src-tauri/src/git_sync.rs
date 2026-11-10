use crate::models::{GitConfig, GitStatusInfo};
use std::fs;
use std::path::Path;
use std::process::Command;

fn run_git(workspace_dir: &Path, args: &[&str]) -> Result<String, String> {
    let output = Command::new("git")
        .args(args)
        .current_dir(workspace_dir)
        // Evitar que git se cuelgue esperando un prompt de terminal interactivo en entorno gráfico
        .env("GIT_TERMINAL_PROMPT", "0")
        .env("GCM_INTERACTIVE", "never")
        .output()
        .map_err(|e| format!("No se pudo ejecutar git: {e}"))?;

    if output.status.success() {
        Ok(String::from_utf8_lossy(&output.stdout).trim().to_string())
    } else {
        let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
        let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
        Err(if !stderr.is_empty() {
            stderr
        } else if !stdout.is_empty() {
            stdout
        } else {
            "Comando git falló".to_string()
        })
    }
}

/// Construye la URL autenticada en memoria si el usuario configuró un Personal Access Token
/// para repositorios HTTPS (GitLab / GitHub / Gitea), sin guardar el token en .git/config.
fn build_authenticated_remote_url(
    remote_url: &str,
    username: Option<&str>,
    token: Option<&str>,
) -> String {
    let clean = remote_url.trim();
    let tok = match token {
        Some(t) if !t.trim().is_empty() => t.trim(),
        _ => return clean.to_string(),
    };

    if let Some(rest) = clean.strip_prefix("https://") {
        let host_and_path = if let Some(at_idx) = rest.find('@') {
            &rest[at_idx + 1..]
        } else {
            rest
        };
        let user = username
            .filter(|u| !u.trim().is_empty())
            .unwrap_or("oauth2");
        return format!("https://{}:{}@{}", user.trim(), tok, host_and_path);
    }

    clean.to_string()
}

/// Detecta la rama por defecto del remoto (ej. main o master) si la rama configurada no existe en el remoto.
fn resolve_remote_branch(
    workspace_dir: &Path,
    target_remote: &str,
    preferred_branch: &str,
) -> String {
    if let Ok(out) = run_git(
        workspace_dir,
        &["ls-remote", "--heads", target_remote, preferred_branch],
    ) {
        if !out.trim().is_empty() {
            return preferred_branch.to_string();
        }
    }

    // Intentar detectar HEAD remoto con ls-remote --symref
    if let Ok(symref) = run_git(workspace_dir, &["ls-remote", "--symref", target_remote, "HEAD"]) {
        for line in symref.lines() {
            if let Some(rest) = line.strip_prefix("ref: refs/heads/") {
                if let Some(branch_name) = rest.split_whitespace().next() {
                    if !branch_name.is_empty() {
                        return branch_name.to_string();
                    }
                }
            }
        }
    }

    // Probar fallback entre main y master
    let fallback = if preferred_branch == "main" {
        "master"
    } else {
        "main"
    };
    if let Ok(out) = run_git(
        workspace_dir,
        &["ls-remote", "--heads", target_remote, fallback],
    ) {
        if !out.trim().is_empty() {
            return fallback.to_string();
        }
    }

    preferred_branch.to_string()
}

pub fn apply_git_config_to_repo(
    workspace_dir: &Path,
    git_cfg: &GitConfig,
) -> Result<(), String> {
    if !workspace_dir.join(".git").exists() {
        return Ok(());
    }

    let _ = Command::new("git")
        .args([
            "config",
            "--global",
            "--add",
            "safe.directory",
            &workspace_dir.to_string_lossy(),
        ])
        .output();

    if let Some(ref name) = git_cfg.user_name {
        if !name.trim().is_empty() {
            let _ = run_git(workspace_dir, &["config", "user.name", name.trim()]);
        }
    }
    if let Some(ref email) = git_cfg.user_email {
        if !email.trim().is_empty() {
            let _ = run_git(workspace_dir, &["config", "user.email", email.trim()]);
        }
    }

    if let Some(ref branch) = git_cfg.branch {
        let clean_branch = branch.trim();
        if !clean_branch.is_empty() {
            let _ = run_git(workspace_dir, &["branch", "-M", clean_branch]);
        }
    }

    match git_cfg.remote_url {
        Some(ref url) if !url.trim().is_empty() => {
            let clean_url = url.trim();
            if run_git(workspace_dir, &["remote", "get-url", "origin"]).is_ok() {
                run_git(workspace_dir, &["remote", "set-url", "origin", clean_url])?;
            } else {
                run_git(workspace_dir, &["remote", "add", "origin", clean_url])?;
            }
        }
        _ => {
            if run_git(workspace_dir, &["remote", "get-url", "origin"]).is_ok() {
                let _ = run_git(workspace_dir, &["remote", "remove", "origin"]);
            }
        }
    }

    Ok(())
}

pub fn get_git_status(workspace_dir: &Path) -> Result<GitStatusInfo, String> {
    let is_repo = workspace_dir.join(".git").exists();
    let gitignore_raw = fs::read_to_string(workspace_dir.join(".gitignore")).unwrap_or_default();
    let secrets_ignored = gitignore_raw.lines().any(|l| l.trim() == "secrets/");

    if !is_repo {
        return Ok(GitStatusInfo {
            is_repo: false,
            branch: "main".to_string(),
            changed_files: vec![],
            secrets_ignored,
            remote_url: None,
            user_name: None,
            user_email: None,
            last_commit: None,
        });
    }

    let branch = run_git(workspace_dir, &["symbolic-ref", "--short", "HEAD"])
        .or_else(|_| run_git(workspace_dir, &["rev-parse", "--abbrev-ref", "HEAD"]))
        .unwrap_or_else(|_| "main".to_string());

    let porcelain = run_git(workspace_dir, &["status", "--porcelain"]).unwrap_or_default();
    let changed_files: Vec<String> = porcelain
        .lines()
        .filter(|l| !l.trim().is_empty())
        .map(|l| l.to_string())
        .collect();

    let remote_url = run_git(workspace_dir, &["remote", "get-url", "origin"]).ok();
    let user_name = run_git(workspace_dir, &["config", "--get", "user.name"]).ok();
    let user_email = run_git(workspace_dir, &["config", "--get", "user.email"]).ok();
    let last_commit = run_git(workspace_dir, &["log", "-1", "--oneline"]).ok();

    Ok(GitStatusInfo {
        is_repo: true,
        branch,
        changed_files,
        secrets_ignored,
        remote_url,
        user_name,
        user_email,
        last_commit,
    })
}

pub fn init_git_repo(
    workspace_dir: &Path,
    git_cfg: &GitConfig,
) -> Result<GitStatusInfo, String> {
    if !workspace_dir.join(".git").exists() {
        run_git(workspace_dir, &["init", "-b", "main"])
            .or_else(|_| run_git(workspace_dir, &["init"]))?;
    }

    apply_git_config_to_repo(workspace_dir, git_cfg)?;
    get_git_status(workspace_dir)
}

pub fn commit_and_sync(
    workspace_dir: &Path,
    git_cfg: &GitConfig,
    resolved_token: Option<&str>,
    message: &str,
    push: bool,
    force_push: bool,
) -> Result<String, String> {
    if !workspace_dir.join(".git").exists() {
        init_git_repo(workspace_dir, git_cfg)?;
    } else {
        apply_git_config_to_repo(workspace_dir, git_cfg)?;
    }

    if run_git(workspace_dir, &["config", "--get", "user.name"]).is_err() {
        let fallback_name = git_cfg
            .user_name
            .as_deref()
            .filter(|s| !s.trim().is_empty())
            .unwrap_or("Chasqui User");
        let _ = run_git(workspace_dir, &["config", "user.name", fallback_name]);
    }
    if run_git(workspace_dir, &["config", "--get", "user.email"]).is_err() {
        let fallback_email = git_cfg
            .user_email
            .as_deref()
            .filter(|s| !s.trim().is_empty())
            .unwrap_or("chasqui@local.workspace");
        let _ = run_git(workspace_dir, &["config", "user.email", fallback_email]);
    }

    run_git(workspace_dir, &["add", "-A"])?;
    let status = run_git(workspace_dir, &["status", "--porcelain"])?;
    let mut committed = false;
    if !status.is_empty() {
        let commit_msg = if message.trim().is_empty() {
            "chore(chasqui): update API collection & workspace config"
        } else {
            message.trim()
        };
        run_git(workspace_dir, &["commit", "-m", commit_msg])?;
        committed = true;
    }

    if push {
        let remote_url = git_cfg
            .remote_url
            .as_deref()
            .filter(|s| !s.trim().is_empty())
            .ok_or_else(|| {
                "No has configurado una URL Remota (Git / GitLab). Ingrésala arriba y guarda la configuración.".to_string()
            })?;

        let branch = run_git(workspace_dir, &["rev-parse", "--abbrev-ref", "HEAD"])
            .unwrap_or_else(|_| {
                git_cfg
                    .branch
                    .clone()
                    .unwrap_or_else(|| "main".to_string())
            });

        let target_remote =
            build_authenticated_remote_url(remote_url, git_cfg.user_name.as_deref(), resolved_token);

        let mut push_args = vec!["push"];
        if force_push {
            push_args.push("--force");
        }
        push_args.push(&target_remote);
        let refspec = format!("HEAD:refs/heads/{branch}");
        push_args.push(&refspec);

        run_git(workspace_dir, &push_args).map_err(|e| {
            format!(
                "Error al hacer Push a '{remote_url}' (rama {branch}): {e}. \
                 Verifica la URL remota, que el repositorio exista y que tengas permisos (Token HTTPS o llave SSH)."
            )
        })?;

        Ok(format!(
            "Push exitoso a la rama '{branch}'{}",
            if committed { " (con nuevo commit)" } else { "" }
        ))
    } else if committed {
        Ok("Commit local realizado exitosamente".to_string())
    } else {
        Ok("No hay cambios pendientes para hacer commit".to_string())
    }
}

/// Descarga los cambios del repositorio remoto.
/// - Si `force_overwrite == true` (o si el repositorio local aún no tiene commits y chocan los archivos por defecto),
///   hace `git fetch` + `git checkout -f -B <branch> FETCH_HEAD` y limpia archivos no rastreados (preservando `secrets/` si no viene del repo),
///   permitiendo pisar la configuración local sin errores al conectar por primera vez un repo existente.
pub fn pull_workspace(
    workspace_dir: &Path,
    git_cfg: &GitConfig,
    resolved_token: Option<&str>,
    force_overwrite: bool,
) -> Result<String, String> {
    if !workspace_dir.join(".git").exists() {
        init_git_repo(workspace_dir, git_cfg)?;
    } else {
        apply_git_config_to_repo(workspace_dir, git_cfg)?;
    }

    let remote_url = git_cfg
        .remote_url
        .as_deref()
        .filter(|s| !s.trim().is_empty())
        .ok_or_else(|| "No hay URL remota configurada. Ingresa la URL del repositorio arriba.".to_string())?;

    let preferred_branch = git_cfg
        .branch
        .as_deref()
        .filter(|s| !s.trim().is_empty())
        .unwrap_or("main");

    let target_remote =
        build_authenticated_remote_url(remote_url, git_cfg.user_name.as_deref(), resolved_token);

    // Detectar si la rama remota es `main`, `master` o la especificada
    let actual_branch = resolve_remote_branch(workspace_dir, &target_remote, preferred_branch);

    // 1. Fetch desde el remoto
    run_git(workspace_dir, &["fetch", &target_remote, &actual_branch]).map_err(|e| {
        format!(
            "Error al conectar/fetch desde '{remote_url}' (rama '{actual_branch}'): {e}"
        )
    })?;

    let has_local_commits = run_git(workspace_dir, &["rev-parse", "--verify", "HEAD"]).is_ok();

    if force_overwrite || !has_local_commits {
        // Si es la primera sincronización o el usuario pidió pisar la configuración local:
        // Eliminar el request de ejemplo por defecto si existe para no dejar basura local
        let default_sample = workspace_dir
            .join("requests")
            .join("Ejemplos")
            .join("sample_get.toml");
        if default_sample.exists() {
            let _ = fs::remove_file(&default_sample);
        }

        // Posicionar y forzar el árbol de trabajo exactamente al estado de FETCH_HEAD
        run_git(
            workspace_dir,
            &["checkout", "-f", "-B", &actual_branch, "FETCH_HEAD"],
        )?;
        run_git(workspace_dir, &["reset", "--hard", "FETCH_HEAD"])?;
        // Limpiar archivos no rastreados salvo secrets/ para no borrar un vault local ignorado
        let _ = run_git(workspace_dir, &["clean", "-fd", "-e", "secrets/"]);

        return Ok(format!(
            "Repositorio sincronizado desde '{actual_branch}' (la configuración local fue reemplazada por la del repositorio remoto)."
        ));
    }

    // Si tiene commits locales y no pidió pisar todo, intentamos merge priorizando cambios entrantes si hay conflicto,
    // y si falla por untracked files hacemos checkout forzado de FETCH_HEAD.
    match run_git(
        workspace_dir,
        &[
            "merge",
            "FETCH_HEAD",
            "--allow-unrelated-histories",
            "-X",
            "theirs",
            "-m",
            "chore(chasqui): merge remote changes",
        ],
    ) {
        Ok(_) => Ok(format!(
            "Pull completado exitosamente desde la rama '{actual_branch}'."
        )),
        Err(_) => {
            // Fallback seguro si archivos locales sin trackear bloqueaban el merge
            run_git(
                workspace_dir,
                &["checkout", "-f", "-B", &actual_branch, "FETCH_HEAD"],
            )?;
            run_git(workspace_dir, &["reset", "--hard", "FETCH_HEAD"])?;
            Ok(format!(
                "Pull completado desde '{actual_branch}' aplicando la configuración del repositorio remoto."
            ))
        }
    }
}
