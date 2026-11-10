# Chasqui — Cliente API 100% Local, Rápido y Git-Friendly

**ES:** Cliente API nativo, 100% local y portable (Rust/Tauri + React). Guarda peticiones en archivos TOML listos para versionar y protege secretos en un vault cifrado con AES-256-GCM.

**EN:** Native, 100% local, portable API client (Rust/Tauri + React). Stores requests in version-control-friendly TOML files and secures secrets in an AES-256-GCM encrypted vault.

## Características Principales

1. **100% Local y Portable:**
   - Por defecto guarda todos los datos en la carpeta `./chasqui-data` junto al ejecutable (o en cualquier directorio que elijas desde la interfaz).
2. **Separación Estricta entre Requests y Secretos:**
   - **Requests (`requests/*.toml`):** Archivos TOML limpios y legibles para Git. Nunca almacenan contraseñas ni tokens en texto plano; utilizan placeholders como `{{secret:API_TOKEN}}`.
   - **Entornos (`environments/*.toml`):** Variables públicas como `base_url`.
   - **Vault Encriptado (`secrets/vault.enc.toml`):** Cifrado con **AES-256-GCM** y derivación de clave **Argon2id** a partir de tu clave maestra local (con soporte opcional para guardar la clave en el Keyring del Sistema Operativo en Linux y Windows).
3. **Sincronización con Git / GitLab a Nivel de Configuración:**
   - En `chasqui.toml` puedes configurar `commit_encrypted_secrets = false` (por defecto agrega `secrets/` al `.gitignore` para que jamás se suban tus secretos) o `commit_encrypted_secrets = true` (permite subir el archivo `secrets/vault.enc.toml` encriptado a tu repositorio de Git/GitLab).

## Estructura del Repositorio

```text
chasqui/
├── src/                  # Frontend (React + TypeScript + Tailwind CSS)
└── src-tauri/            # Backend nativo (Rust: CryptoVault, HTTP Engine, Git & TOML Workspace)
```

## Comandos de Desarrollo

```bash
# Instalar dependencias del frontend
npm install

# Ejecutar previsualización web o modo desarrollo Tauri
npm run dev
npm run tauri dev

# Compilar instalador nativo para Linux / Windows
npm run tauri build
```
