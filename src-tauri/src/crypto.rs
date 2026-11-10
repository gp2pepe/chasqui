use crate::models::{EncryptedSecretEntry, SecretVaultFile};
use aes_gcm::{
    aead::{Aead, KeyInit},
    Aes256Gcm, Nonce,
};
use argon2::Argon2;
use base64::{engine::general_purpose::STANDARD as B64, Engine as _};
use rand::RngCore;
use std::collections::BTreeMap;
use std::fs;
use std::path::{Path, PathBuf};

const VAULT_VERIFIER_PLAINTEXT: &[u8] = b"CHASQUI_VAULT_OK_V1";
const KEYRING_SERVICE: &str = "chasqui-local-api-client";

pub struct CryptoVault {
    derived_key: Option<[u8; 32]>,
}

impl Default for CryptoVault {
    fn default() -> Self {
        Self::new()
    }
}

impl CryptoVault {
    pub fn new() -> Self {
        Self { derived_key: None }
    }

    pub fn is_unlocked(&self) -> bool {
        self.derived_key.is_some()
    }

    pub fn lock(&mut self) {
        self.derived_key = None;
    }

    pub fn vault_file_path(workspace_dir: &Path) -> PathBuf {
        workspace_dir.join("secrets").join("vault.enc.toml")
    }

    pub fn is_initialized(workspace_dir: &Path) -> bool {
        Self::vault_file_path(workspace_dir).exists()
    }

    fn derive_key(passphrase: &str, salt: &[u8]) -> Result<[u8; 32], String> {
        let mut output_key = [0u8; 32];
        Argon2::default()
            .hash_password_into(passphrase.as_bytes(), salt, &mut output_key)
            .map_err(|e| format!("Error derivando clave con Argon2id: {e}"))?;
        Ok(output_key)
    }

    fn encrypt_bytes(key: &[u8; 32], plaintext: &[u8]) -> Result<EncryptedSecretEntry, String> {
        let cipher = Aes256Gcm::new_from_slice(key)
            .map_err(|e| format!("Error inicializando AES-256-GCM: {e}"))?;
        let mut nonce_bytes = [0u8; 12];
        rand::thread_rng().fill_bytes(&mut nonce_bytes);
        let nonce = Nonce::from_slice(&nonce_bytes);

        let ciphertext = cipher
            .encrypt(nonce, plaintext)
            .map_err(|e| format!("Error encriptando secreto: {e}"))?;

        Ok(EncryptedSecretEntry {
            nonce_b64: B64.encode(nonce_bytes),
            ciphertext_b64: B64.encode(ciphertext),
            updated_at: "local".to_string(),
        })
    }

    fn decrypt_bytes(key: &[u8; 32], entry: &EncryptedSecretEntry) -> Result<Vec<u8>, String> {
        let cipher = Aes256Gcm::new_from_slice(key)
            .map_err(|e| format!("Error inicializando AES-256-GCM: {e}"))?;
        let nonce_bytes = B64
            .decode(&entry.nonce_b64)
            .map_err(|e| format!("Nonce inválido en base64: {e}"))?;
        if nonce_bytes.len() != 12 {
            return Err("Longitud de nonce inválida (se esperaban 12 bytes)".to_string());
        }
        let nonce = Nonce::from_slice(&nonce_bytes);
        let ciphertext = B64
            .decode(&entry.ciphertext_b64)
            .map_err(|e| format!("Ciphertext inválido en base64: {e}"))?;

        cipher
            .decrypt(nonce, ciphertext.as_ref())
            .map_err(|_| "Clave maestra incorrecta o archivo de secretos alterado".to_string())
    }

    pub fn load_vault_file(workspace_dir: &Path) -> Result<SecretVaultFile, String> {
        let path = Self::vault_file_path(workspace_dir);
        if !path.exists() {
            return Err("El archivo secrets/vault.enc.toml aún no existe".to_string());
        }
        let raw = fs::read_to_string(&path)
            .map_err(|e| format!("No se pudo leer {:?}: {e}", path))?;
        toml::from_str(&raw).map_err(|e| format!("Formato inválido en vault.enc.toml: {e}"))
    }

    pub fn save_vault_file(workspace_dir: &Path, vault: &SecretVaultFile) -> Result<(), String> {
        let secrets_dir = workspace_dir.join("secrets");
        fs::create_dir_all(&secrets_dir)
            .map_err(|e| format!("No se pudo crear carpeta secrets/: {e}"))?;
        let serialized = toml::to_string_pretty(vault)
            .map_err(|e| format!("Error serializando vault a TOML: {e}"))?;
        let content = format!(
            "# Chasqui Encrypted Secret Vault\n# Algorithm: AES-256-GCM | KDF: Argon2id\n# No edites manualmente los valores encriptados.\n\n{}",
            serialized
        );
        fs::write(Self::vault_file_path(workspace_dir), content)
            .map_err(|e| format!("No se pudo guardar secrets/vault.enc.toml: {e}"))
    }

    /// Inicializa un nuevo vault o desbloquea uno existente verificando la clave maestra
    pub fn unlock_or_init(&mut self, workspace_dir: &Path, passphrase: &str) -> Result<(), String> {
        if passphrase.trim().is_empty() {
            return Err("La clave maestra no puede estar vacía".to_string());
        }

        if Self::is_initialized(workspace_dir) {
            let vault = Self::load_vault_file(workspace_dir)?;
            let salt = B64
                .decode(&vault.salt_b64)
                .map_err(|e| format!("Salt inválido en vault.enc.toml: {e}"))?;
            let key = Self::derive_key(passphrase, &salt)?;

            if let Some(ref verifier) = vault.verifier {
                let decrypted = Self::decrypt_bytes(&key, verifier)?;
                if decrypted != VAULT_VERIFIER_PLAINTEXT {
                    return Err("La clave maestra ingresada no coincide con el Vault".to_string());
                }
            }
            self.derived_key = Some(key);
            Ok(())
        } else {
            let mut salt = [0u8; 16];
            rand::thread_rng().fill_bytes(&mut salt);
            let key = Self::derive_key(passphrase, &salt)?;
            let verifier = Self::encrypt_bytes(&key, VAULT_VERIFIER_PLAINTEXT)?;

            let vault = SecretVaultFile {
                version: 1,
                kdf: "Argon2id".to_string(),
                cipher: "AES-256-GCM".to_string(),
                salt_b64: B64.encode(salt),
                verifier: Some(verifier),
                secrets: BTreeMap::new(),
            };
            Self::save_vault_file(workspace_dir, &vault)?;
            self.derived_key = Some(key);
            Ok(())
        }
    }

    pub fn set_secret(
        &self,
        workspace_dir: &Path,
        secret_key: &str,
        secret_value: &str,
    ) -> Result<(), String> {
        let key = self
            .derived_key
            .as_ref()
            .ok_or_else(|| "El Vault está bloqueado. Desbloquéalo con tu clave maestra.".to_string())?;

        let clean_name = secret_key.trim();
        if clean_name.is_empty() {
            return Err("El nombre del secreto no puede estar vacío".to_string());
        }

        let mut vault = Self::load_vault_file(workspace_dir)?;
        let encrypted_entry = Self::encrypt_bytes(key, secret_value.as_bytes())?;
        vault.secrets.insert(clean_name.to_string(), encrypted_entry);
        Self::save_vault_file(workspace_dir, &vault)
    }

    pub fn delete_secret(&self, workspace_dir: &Path, secret_key: &str) -> Result<(), String> {
        if !self.is_unlocked() {
            return Err("El Vault está bloqueado.".to_string());
        }
        let mut vault = Self::load_vault_file(workspace_dir)?;
        vault.secrets.remove(secret_key);
        Self::save_vault_file(workspace_dir, &vault)
    }

    pub fn list_secret_keys(workspace_dir: &Path) -> Result<Vec<String>, String> {
        if !Self::is_initialized(workspace_dir) {
            return Ok(vec![]);
        }
        let vault = Self::load_vault_file(workspace_dir)?;
        Ok(vault.secrets.keys().cloned().collect())
    }

    pub fn get_decrypted_secrets(
        &self,
        workspace_dir: &Path,
    ) -> Result<BTreeMap<String, String>, String> {
        if !Self::is_initialized(workspace_dir) {
            return Ok(BTreeMap::new());
        }
        let key = self
            .derived_key
            .as_ref()
            .ok_or_else(|| "El Vault de secretos está bloqueado. Desbloquéalo para usar {{secret:...}}".to_string())?;

        let vault = Self::load_vault_file(workspace_dir)?;
        let mut map = BTreeMap::new();
        for (k, enc_entry) in &vault.secrets {
            let bytes = Self::decrypt_bytes(key, enc_entry)?;
            let val = String::from_utf8(bytes)
                .map_err(|e| format!("Secreto '{k}' no es UTF-8 válido: {e}"))?;
            map.insert(k.clone(), val);
        }
        Ok(map)
    }

    // --- Soporte opcional de Keyring del Sistema Operativo (Linux Secret Service / Windows Credential Manager) ---
    pub fn save_passphrase_in_os_keyring(workspace_dir: &Path, passphrase: &str) -> Result<(), String> {
        let user_key = workspace_dir.to_string_lossy().to_string();
        let entry = keyring::Entry::new(KEYRING_SERVICE, &user_key)
            .map_err(|e| format!("Keyring del SO no disponible: {e}"))?;
        entry
            .set_password(passphrase)
            .map_err(|e| format!("No se pudo guardar en el Keyring del SO: {e}"))
    }

    pub fn load_passphrase_from_os_keyring(workspace_dir: &Path) -> Option<String> {
        let user_key = workspace_dir.to_string_lossy().to_string();
        let entry = keyring::Entry::new(KEYRING_SERVICE, &user_key).ok()?;
        entry.get_password().ok()
    }

    pub fn clear_passphrase_from_os_keyring(workspace_dir: &Path) -> Result<(), String> {
        let user_key = workspace_dir.to_string_lossy().to_string();
        if let Ok(entry) = keyring::Entry::new(KEYRING_SERVICE, &user_key) {
            let _ = entry.delete_credential();
        }
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::env;

    #[test]
    fn test_vault_encryption_and_wrong_passphrase() {
        let temp_dir = env::temp_dir().join(format!("chasqui_test_vault_{}", rand::random::<u32>()));
        let _ = fs::remove_dir_all(&temp_dir);
        fs::create_dir_all(&temp_dir).unwrap();

        let mut vault = CryptoVault::new();
        vault
            .unlock_or_init(&temp_dir, "mi-clave-super-secreta-2026")
            .expect("Debe inicializar el vault");

        vault
            .set_secret(&temp_dir, "STRIPE_API_KEY", "sk_live_987654321")
            .expect("Debe encriptar y guardar secreto");

        // Verificar que el archivo en disco NO contiene el secreto en texto plano
        let raw_toml = fs::read_to_string(CryptoVault::vault_file_path(&temp_dir)).unwrap();
        assert!(!raw_toml.contains("sk_live_987654321"));
        assert!(raw_toml.contains("STRIPE_API_KEY"));

        // Desencriptar con la clave correcta
        let decrypted = vault.get_decrypted_secrets(&temp_dir).unwrap();
        assert_eq!(decrypted.get("STRIPE_API_KEY").unwrap(), "sk_live_987654321");

        // Probar bloqueo y fallo con clave incorrecta
        let mut second_vault = CryptoVault::new();
        let err = second_vault.unlock_or_init(&temp_dir, "clave-incorrecta");
        assert!(err.is_err());

        let _ = fs::remove_dir_all(&temp_dir);
    }
}
