#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

echo "=== 1. Verificando dependencias del sistema (Ubuntu/Debian) para Tauri v2 ==="
if ! dpkg -s libwebkit2gtk-4.1-dev >/dev/null 2>&1; then
  echo "Instalando librerías de desarrollo de WebKitGTK y GTK3..."
  sudo apt-get update
  sudo apt-get install -y \
    libwebkit2gtk-4.1-dev \
    build-essential \
    curl \
    wget \
    file \
    libxdo-dev \
    libssl-dev \
    libayatana-appindicator3-dev \
    librsvg2-dev \
    libdbus-1-dev
fi

echo "=== 2. Verificando toolchain de Rust (cargo / rustc) ==="
if ! command -v cargo >/dev/null 2>&1; then
  if [ -f "$HOME/.cargo/env" ]; then
    source "$HOME/.cargo/env"
  else
    echo "Instalando Rust mediante rustup..."
    curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
    source "$HOME/.cargo/env"
  fi
fi

echo "=== 3. Compilando paquete .deb nativo con Tauri ==="
npm run tauri build -- --bundles deb

echo ""
echo "=== ¡Paquete .deb generado exitosamente! ==="
ls -lh src-tauri/target/release/bundle/deb/*.deb
