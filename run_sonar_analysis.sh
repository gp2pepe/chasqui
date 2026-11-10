#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"
source "$HOME/.cargo/env"

SONAR_HOST_URL="${SONAR_HOST_URL:-http://sonarqube.gperez.link:9000}"
SONAR_TOKEN="${SONAR_TOKEN:-sqa_a26a868ee34bed9511c323709b4928d5f21bb64c}"

echo "=========================================================="
echo "🚀 Ejecutando análisis de calidad para Chasqui"
echo "Servidor SonarQube: $SONAR_HOST_URL"
echo "=========================================================="

echo ""
echo "🦀 [1/2] Analizando Backend Rust con cargo clippy..."
(cd src-tauri && cargo clippy --all-targets -- -D warnings || true)

echo ""
echo "🎨 [2/2] Enviando análisis a SonarQube ($SONAR_HOST_URL)..."
docker run --rm \
  --network host \
  -e SONAR_HOST_URL="$SONAR_HOST_URL" \
  -e SONAR_TOKEN="$SONAR_TOKEN" \
  -v "$(pwd):/usr/src" \
  sonarsource/sonar-scanner-cli \
  -Dsonar.projectKey="chasqui" \
  -Dsonar.projectName="Chasqui - Local & Git-Friendly API Client" \
  -Dsonar.projectVersion="0.1.0" \
  -Dsonar.sources="src" \
  -Dsonar.exclusions="node_modules/**,dist/**,dist-deb/**,public/**,src-tauri/target/**,chasqui-data/**"

echo ""
echo "=========================================================="
echo "✅ Análisis completado: $SONAR_HOST_URL/dashboard?id=chasqui"
echo "=========================================================="
