#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"
source "$HOME/.cargo/env"

echo "=== 1. Compilando binario nativo de Tauri y paquete .deb ==="
./build-deb.sh

DEB_FILE="src-tauri/target/release/bundle/deb/Chasqui_0.1.0_amd64.deb"
BIN_FILE="src-tauri/target/release/chasqui"
ICON_FILE="src-tauri/icons/icon.png"

cp "$DEB_FILE" "/home/gp2/chasqui/Chasqui_0.1.0_amd64.deb"
cp "$DEB_FILE" "/home/gp2/Chasqui_0.1.0_amd64.deb"
cp "$DEB_FILE" "/home/gp2/chasqui/dist-deb/Chasqui_0.1.0_amd64.deb"
sudo dpkg -i "$DEB_FILE"

echo "=== 2. Generando paquete .snap para Ubuntu (chasqui_0.1.0_amd64.snap) ==="
SNAP_PRIME="/tmp/chasqui-snap-prime"
rm -rf "$SNAP_PRIME"
mkdir -p "$SNAP_PRIME/meta/gui" "$SNAP_PRIME/usr/bin"

cp "$BIN_FILE" "$SNAP_PRIME/usr/bin/chasqui"
chmod 755 "$SNAP_PRIME/usr/bin/chasqui"
cp "$ICON_FILE" "$SNAP_PRIME/meta/gui/icon.png"

cat << 'EOF' > "$SNAP_PRIME/meta/gui/chasqui.desktop"
[Desktop Entry]
Name=Chasqui
Comment=100% Local & Git-Friendly API Client
Exec=chasqui
Icon=${SNAP}/meta/gui/icon.png
Terminal=false
Type=Application
Categories=Development;WebDevelopment;
EOF

cat << 'EOF' > "$SNAP_PRIME/meta/snap.yaml"
name: chasqui
version: '0.1.0'
summary: Chasqui — Cliente API 100% Local y Git-Friendly
description: |
  Alternativa open source y ultraligera a Postman construida con Tauri v2 (Rust).
  Guarda tus colecciones en archivos TOML limpios para Git/GitLab, protege tus
  API keys en un Vault encriptado con AES-256-GCM y Argon2id, e incluye probador
  de carga y latencia (N peticiones concurrentes).
architectures:
  - amd64
base: core24
grade: stable
confinement: classic
apps:
  chasqui:
    command: usr/bin/chasqui
EOF

rm -f "/home/gp2/chasqui/chasqui_0.1.0_amd64.snap" "/home/gp2/chasqui_0.1.0_amd64.snap"
mksquashfs "$SNAP_PRIME" "/home/gp2/chasqui/chasqui_0.1.0_amd64.snap" -noappend -comp xz -all-root -no-xattrs -no-fragments >/dev/null
cp "/home/gp2/chasqui/chasqui_0.1.0_amd64.snap" "/home/gp2/chasqui_0.1.0_amd64.snap"
rm -rf "$SNAP_PRIME"

echo "=== 3. Generando paquete .flatpak (chasqui_0.1.0_amd64.flatpak) ==="
if ! command -v flatpak >/dev/null 2>&1 || ! command -v ostree >/dev/null 2>&1; then
  sudo apt-get update
  sudo apt-get install -y flatpak ostree
fi

FP_STAGE="/tmp/chasqui-flatpak-stage"
FP_REPO="/tmp/chasqui-flatpak-repo"
rm -rf "$FP_STAGE" "$FP_REPO"

mkdir -p "$FP_STAGE/files/bin" \
         "$FP_STAGE/files/share/applications" \
         "$FP_STAGE/files/share/icons/hicolor/512x512/apps" \
         "$FP_STAGE/files/share/metainfo" \
         "$FP_STAGE/export/share/applications" \
         "$FP_STAGE/export/share/icons/hicolor/512x512/apps"

cat << 'EOF' > "$FP_STAGE/metadata"
[Application]
name=dev.chasqui.apiclient
runtime=org.gnome.Platform/x86_64/47
sdk=org.gnome.Sdk/x86_64/47
command=chasqui

[Context]
shared=network;ipc;
sockets=x11;wayland;fallback-x11;
filesystems=home;

[Session Bus Policy]
org.freedesktop.secrets=talk
EOF

cp "$BIN_FILE" "$FP_STAGE/files/bin/chasqui"
chmod 755 "$FP_STAGE/files/bin/chasqui"
cp packaging/flatpak/dev.chasqui.apiclient.desktop "$FP_STAGE/files/share/applications/dev.chasqui.apiclient.desktop"
cp packaging/flatpak/dev.chasqui.apiclient.desktop "$FP_STAGE/export/share/applications/dev.chasqui.apiclient.desktop"
cp packaging/flatpak/dev.chasqui.apiclient.metainfo.xml "$FP_STAGE/files/share/metainfo/dev.chasqui.apiclient.metainfo.xml"
cp "$ICON_FILE" "$FP_STAGE/files/share/icons/hicolor/512x512/apps/dev.chasqui.apiclient.png"
cp "$ICON_FILE" "$FP_STAGE/export/share/icons/hicolor/512x512/apps/dev.chasqui.apiclient.png"

ostree init --mode=archive-z2 --repo="$FP_REPO"
flatpak build-export "$FP_REPO" "$FP_STAGE" stable
rm -f "/home/gp2/chasqui/chasqui_0.1.0_amd64.flatpak" "/home/gp2/chasqui_0.1.0_amd64.flatpak"
flatpak build-bundle "$FP_REPO" "/home/gp2/chasqui/chasqui_0.1.0_amd64.flatpak" dev.chasqui.apiclient stable
cp "/home/gp2/chasqui/chasqui_0.1.0_amd64.flatpak" "/home/gp2/chasqui_0.1.0_amd64.flatpak"
rm -rf "$FP_STAGE" "$FP_REPO"

echo ""
echo "=== ¡Todos los paquetes (.deb, .snap y .flatpak) generados exitosamente! ==="
ls -lh /home/gp2/chasqui/Chasqui_0.1.0_amd64.deb \
       /home/gp2/chasqui/chasqui_0.1.0_amd64.snap \
       /home/gp2/chasqui/chasqui_0.1.0_amd64.flatpak
