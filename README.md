# Chasqui — 100% Local & Git-Friendly API Client

<div align="center">
  <img src="public/logo_chasqui.png" alt="Chasqui Logo" width="128" height="128" />
  <h3>Modern, ultra-lightweight, 100% local, and Git-native desktop API client.</h3>
  <p>
    Built with <b>Tauri v2 (Rust)</b>, <b>React</b>, <b>TypeScript</b>, and <b>Tailwind CSS</b>.<br/>
    Developed with <b>Antigravity</b>.
  </p>

  <p>
    <a href="#key-features">Key Features</a> •
    <a href="#how-to-use-chasqui">How to Use</a> •
    <a href="#architecture--file-structure">Architecture</a> •
    <a href="#installation--packaging">Installation & Packaging</a> •
    <a href="#extensible-internationalization-i18n">Translations</a> •
    <a href="#license">License</a>
  </p>
</div>

---

## Overview

**Chasqui** (named after the agile messenger couriers of the Inca Empire) is an open-source, local-first API client designed for software engineers who value speed, privacy, and seamless team collaboration through Git.

Unlike proprietary cloud-locked API tools, Chasqui stores all your requests as clean, human-readable **TOML files** directly inside your project repository. Your team can review API changes via standard pull requests, track diffs cleanly, and protect sensitive API credentials using an **AES-256-GCM encrypted local vault**.

---

## Key Features

### 1. 📁 100% Local & Git-Native Storage
- Requests and collections are saved as individual, clean `.toml` files (`requests/<folder>/<request>.toml`).
- Environments are stored as `.toml` files (`environments/<env>.toml`).
- No proprietary cloud databases, no user accounts, and zero telemetry.

### 2. 🔐 Encrypted Secret Vault (AES-256-GCM + Argon2id)
- Keep sensitive tokens, passwords, and private API keys completely out of your Git history.
- Secrets are encrypted locally using **AES-256-GCM** with **Argon2id** key derivation.
- Keyring integration: Optionally store the master passphrase in your OS keychain (Linux Secret Service / Windows Credential Manager).
- Runtime interpolation: Insert secrets into URLs, Headers, Query Params, or Body payloads using `{{secret:KEY_NAME}}` tags without ever committing plain text.
- Granular Git policy: Choose whether `secrets/` is ignored by Git or committed encrypted for disaster recovery.

### 3. ⚡ Concurrent Benchmark & Latency Tester
- Run instantaneous load and latency benchmarks against any endpoint directly from the interface.
- Configure $N$ total requests and concurrency levels (e.g., 50 requests with 5 concurrent workers).
- Real-time performance metrics: Requests Per Second (RPS), average latency, min/max latency, and p50/p95 percentiles.
- Interactive latency distribution chart with visual status breakdown (2xx vs error responses).

### 4. 🔀 Git & Remote Repository Sync (HTTPS / SSH)
- Connect any existing Git / GitLab / GitHub / Gitea repository directly from the app.
- **Force Pull / Clean Sync:** Connect a remote repository for the first time and overwrite initial local boilerplate files cleanly without conflict errors.
- Built-in Git interface for staging, committing, pulling, and pushing updates without leaving the application.
- Supports encrypted Personal Access Tokens stored safely inside the local Vault.

### 5. 🛠️ Code Generation & Codec Tools
- **Export to Code:** Instant snippet generation for **cURL**, **JavaScript (`fetch`)**, **Python (`requests`)**, and **Go (`net/http`)**.
- **Reveal Secrets Option:** Toggle whether code exports include masked placeholders (`{{secret:KEY}}`) or real decrypted values (only when vault is unlocked).
- **Import from cURL:** Paste shell cURL commands directly to parse headers, method, query parameters, and JSON payloads into a new request.
- **Import JSON Collections & OpenAPI Specs:** Import collections and OpenAPI 3.0 / Swagger 2.0 specifications with automatic folder structuring and suggested environment `base_url`.

### 6. 🌐 Extensible Internationalization (i18n)
- Ships with complete **English** (default) and **Spanish** translations.
- **Add new languages without touching any code:** Simply drop a new JSON file (e.g., `fr.json`, `pt.json`, `de.json`) into `src/locales/`. The application automatically discovers it and adds it to the language selector in the top navbar.

### 7. 🌓 Light & Dark Theme Support
- Full dark and light theme toggle with a single click (Sun / Moon icon).
- Custom-styled dropdowns and controls preventing native OS/WebKit rendering glitches.
- Preferences automatically saved in `localStorage`.

### 8. ⌨️ Developer Ergonomics & Productivity
- Multi-tab request workspace: Keep multiple requests open and switch tabs seamlessly.
- Keyboard shortcuts:
  - `Ctrl + Enter` (or `Cmd + Enter`): Send current request.
  - `Ctrl + N` (or `Cmd + N`): Create new request tab.
  - `Ctrl + D` (or `Cmd + D`): Duplicate / clone active request.
- Reactive auto-save to `.toml` files with debouncing (no need to manually hit save).
- Response inspector: Detailed views for formatted JSON/XML body (Pretty / Raw), response headers table, and network timing details (resolved IP, protocol version, duration, and payload size).

---

## How to Use Chasqui

### 1. Managing Requests
1. Click **New** (or press `Ctrl + N`) to create a request tab.
2. Select your HTTP method (`GET`, `POST`, `PUT`, `PATCH`, `DELETE`).
3. Enter the target URL (e.g. `{{base_url}}/api/v1/users`).
4. Set headers, query parameters, and body payloads (JSON or raw text) in the editor tabs.
5. Click **Send** (or press `Ctrl + Enter`) to execute the request.
6. The request automatically saves to your workspace directory as `<folder>/<id>.toml`.

### 2. Using the Secret Vault
1. Click the **Vault** button in the top navbar.
2. If it's your first time, choose a strong master passphrase to initialize the vault.
3. Once unlocked, click **Add New Secret** and define your key-value pair (e.g. key: `OPENAI_API_KEY`, value: `sk-proj-...`).
4. In your request URL, headers, or body, use the placeholder `{{secret:OPENAI_API_KEY}}`.
5. Chasqui automatically injects the secret in memory when sending requests or benchmarking.

### 3. Running a Benchmark / Load Test
1. With your request configured, click the **Load (N)** button in the URL bar or switch to the **Benchmark / Load (N)** tab in the response panel.
2. Choose the total number of requests (e.g., 50) and concurrency level (e.g., 10).
3. Click **Run Benchmark**.
4. Review the real-time throughput (RPS), average latency, percentile calculations, and bar chart.

### 4. Syncing with Git / GitLab / GitHub
1. Click **Workspace & Git** in the top navbar.
2. Set your repository remote URL (e.g., `https://github.com/your-org/api-specs.git`) and branch name.
3. If connecting to an existing repo that contains requests, click **Connect to Existing Repo & Overwrite Local (Force Pull)** to sync remote files cleanly.
4. Stage and commit changes with a commit message, and click **Commit & Push** to sync updates with your team.

---

## Architecture & File Structure

Chasqui separates your data cleanly into version-controlled files and encrypted files:

```text
your-workspace-dir/
├── chasqui.toml               # Workspace configuration (active environment, git settings)
├── requests/                  # Clean, human-readable API request files
│   ├── Auth/
│   │   └── login.toml
│   └── Users/
│       └── get_users.toml
├── environments/              # Environment variables (*.toml)
│   ├── dev.toml               # base_url = "http://localhost:3000"
│   └── prod.toml              # base_url = "https://api.production.com"
└── secrets/                   # Encrypted vault (AES-256-GCM)
    └── vault.enc.toml         # Encrypted ciphertext (ignored by Git by default)
```

### Source Code Architecture

```text
chasqui/
├── src/                       # Frontend application (React 18 + TypeScript + Tailwind)
│   ├── components/            # Modals (Vault, Settings, Code, Environments, LoadTest)
│   ├── i18n/                  # Dynamic internationalization engine (import.meta.glob)
│   ├── locales/               # Language dictionaries (en.json, es.json, ...)
│   ├── theme/                 # Dark/Light theme provider and state
│   ├── utils/                 # cURL codecs and collection importers
│   ├── api.ts                 # Tauri IPC interface and browser fallbacks
│   └── App.tsx                # Main workspace application shell
└── src-tauri/                 # Backend application (Rust 2021 + Tauri v2)
    └── src/
        ├── crypto.rs          # AES-256-GCM cipher, Argon2id KDF, OS Keyring
        ├── git_sync.rs        # Git CLI manager, force pull, and HTTPS authentication
        ├── http_client.rs     # High-performance async reqwest HTTP execution engine
        ├── workspace.rs       # TOML workspace, request persistence, and environment resolver
        └── lib.rs             # Tauri command dispatcher and state management
```

---

## Extensible Internationalization (i18n)

Adding a new language to Chasqui requires **zero code changes**:

1. Create a new file in `src/locales/<language_code>.json` (for example, `src/locales/fr.json`).
2. Add your translations matching the keys in `src/locales/en.json`:
   ```json
   {
     "_meta": {
       "code": "fr",
       "name": "Français",
       "flag": "🇫🇷"
     },
     "nav": { ... },
     "sidebar": { ... }
   }
   ```
3. Vite's dynamic loader (`import.meta.glob`) automatically registers the file, and the language will immediately appear in the navbar language dropdown. Any missing translation key automatically falls back to English.

---

## Installation & Packaging

Chasqui is distributed as native standalone packages for Linux (`.deb`, `.snap`, and `.flatpak`):

### Debian / Ubuntu (`.deb`)
```bash
sudo dpkg -i Chasqui_0.1.0_amd64.deb
```

### Snap Package
```bash
sudo snap install --dangerous chasqui_0.1.0_amd64.snap
```

### Flatpak
```bash
flatpak install --user chasqui_0.1.0_amd64.flatpak
```

### Building from Source

**Prerequisites:** Node.js 18+, Rust 1.77+, and system libraries (`libwebkit2gtk-4.1-dev`, `libappindicator3-dev`, `librsvg2-dev`).

```bash
# Clone repository
git clone https://github.com/gp2pepe/chasqui.git
cd chasqui

# Install frontend dependencies
npm install

# Run in development mode
npm run tauri dev

# Build production deb package
npm run tauri build -- --bundles deb

# Build all packages (.deb, .snap, .flatpak)
./build-packages.sh
```

---

## Code Quality & Standards

Chasqui is continuously verified for quality, security, and maintainability:
- **Rust Backend:** Zero `cargo clippy` warnings with `-D warnings` enforcement.
- **Strict TypeScript & Frontend Linter:** Clean type checking and modular architecture with zero compiler warnings.

---

## Development Notes

Chasqui was built and designed using **Antigravity**.

---

## License

This project is licensed under the **[MIT License](LICENSE)**. Feel free to use, modify, and distribute it for personal and commercial projects.
