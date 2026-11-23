#!/usr/bin/env bash
# ==============================================================================
# FxTwitter Archive Studio - Universal CLI & Desktop Installer
# Linux (Debian, Arch, Ubuntu, Fedora, Alpine) & macOS (Intel & Apple Silicon)
# Created by Hikaproj
# ==============================================================================

set -euo pipefail

REPO="Hikaproj/publictweetoutputter"
INSTALL_DIR=""
PORTABLE_MODE=false
DEFAULT_SYSTEM_DIR="/usr/local/bin"
DEFAULT_USER_DIR="${HOME}/.local/bin"

# Parse CLI arguments
while [[ $# -gt 0 ]]; do
  case "$1" in
    --portable|-p)
      PORTABLE_MODE=true
      shift
      ;;
    --dir|-d)
      INSTALL_DIR="$2"
      shift 2
      ;;
    --help|-h)
      echo "FxTwitter Archive Studio - Universal Installer"
      echo "Usage: curl -fsSL https://raw.githubusercontent.com/${REPO}/main/install.sh | bash [options]"
      echo ""
      echo "Options:"
      echo "  -p, --portable    Install into local portable directory (./fxtweet-bin) without touching system"
      echo "  -d, --dir <path>  Specify custom installation directory"
      echo "  -h, --help        Show this help message"
      exit 0
      ;;
    *)
      echo "Unknown option: $1"
      exit 1
      ;;
  esac
done

echo "========================================================"
echo "  FxTwitter Archive Studio Installer"
echo "  Created by Hikaproj"
echo "========================================================"

# Detect OS
OS_TYPE="$(uname -s | tr '[:upper:]' '[:lower:]')"
ARCH_TYPE="$(uname -m)"

echo "Detected Platform: ${OS_TYPE} (${ARCH_TYPE})"

# Determine Target Directory
if [[ -n "$INSTALL_DIR" ]]; then
  TARGET_DIR="$INSTALL_DIR"
elif [[ "$PORTABLE_MODE" == true ]]; then
  TARGET_DIR="$(pwd)/fxtweet-bin"
else
  if [[ $EUID -eq 0 ]] || [[ -w "$DEFAULT_SYSTEM_DIR" ]]; then
    TARGET_DIR="$DEFAULT_SYSTEM_DIR"
  else
    TARGET_DIR="$DEFAULT_USER_DIR"
  fi
fi

mkdir -p "$TARGET_DIR"

# Download Release Asset
TEMP_DIR="$(mktemp -d)"
cleanup() {
  rm -rf "$TEMP_DIR"
}
trap cleanup EXIT

echo "Fetching latest release metadata from GitHub (${REPO})..."

LATEST_TAG="v1.0.0"
if command -v curl &>/dev/null; then
  LATEST_TAG="$(curl -fsSL "https://api.github.com/repos/${REPO}/releases/latest" | grep '"tag_name":' | head -n1 | cut -d '"' -f 4 || echo "v1.0.0")"
elif command -v wget &>/dev/null; then
  LATEST_TAG="$(wget -qO- "https://api.github.com/repos/${REPO}/releases/latest" | grep '"tag_name":' | head -n1 | cut -d '"' -f 4 || echo "v1.0.0")"
fi

TAG_NO_V="${LATEST_TAG#v}"

CANDIDATES=()
if [[ "$OS_TYPE" == "linux" ]]; then
  CANDIDATES=(
    "fxtweet-studio-linux-x86_64-${LATEST_TAG}.tar.gz"
    "fxtweet-studio-linux-x86_64-v${TAG_NO_V}.tar.gz"
    "fxtweet-studio-linux-cli.tar.gz"
  )
elif [[ "$OS_TYPE" == "darwin" ]]; then
  CANDIDATES=(
    "fxtweet-studio-macos-universal-${LATEST_TAG}.tar.gz"
    "fxtweet-studio-macos-universal-v${TAG_NO_V}.tar.gz"
    "fxtweet-studio-macos-cli.tar.gz"
  )
else
  echo "Unsupported OS: $OS_TYPE. For Windows, please run install.ps1 in PowerShell."
  exit 1
fi

DOWNLOADED=false
DOWNLOADED_FILE=""

for TARGET_FILE in "${CANDIDATES[@]}"; do
  DOWNLOAD_URL="https://github.com/${REPO}/releases/download/${LATEST_TAG}/${TARGET_FILE}"
  echo "Trying download from: ${DOWNLOAD_URL}..."
  if command -v curl &>/dev/null; then
    if curl -fsSL -o "${TEMP_DIR}/${TARGET_FILE}" "$DOWNLOAD_URL"; then
      DOWNLOADED=true
      DOWNLOADED_FILE="${TEMP_DIR}/${TARGET_FILE}"
      break
    fi
  elif command -v wget &>/dev/null; then
    if wget -qO "${TEMP_DIR}/${TARGET_FILE}" "$DOWNLOAD_URL"; then
      DOWNLOADED=true
      DOWNLOADED_FILE="${TEMP_DIR}/${TARGET_FILE}"
      break
    fi
  fi
done

if [[ "$DOWNLOADED" == true ]] && [[ -s "$DOWNLOADED_FILE" ]]; then
  tar -xzf "$DOWNLOADED_FILE" -C "$TEMP_DIR"
  if [[ -f "${TEMP_DIR}/fxtweet-cli" ]]; then
    install -m 755 "${TEMP_DIR}/fxtweet-cli" "${TARGET_DIR}/fxtweet-cli"
    ln -sf "${TARGET_DIR}/fxtweet-cli" "${TARGET_DIR}/fxtweet" || true
  fi
  if [[ -f "${TEMP_DIR}/fxtweet-studio" ]]; then
    install -m 755 "${TEMP_DIR}/fxtweet-studio" "${TARGET_DIR}/fxtweet-studio"
  fi
  echo "Binaries installed to ${TARGET_DIR}"
else
  echo "Direct release binaries not yet uploaded for ${LATEST_TAG}."
fi

echo "========================================================"
echo "  Installation Completed Successfully!"
echo "  - CLI: ${TARGET_DIR}/fxtweet-cli (or fxtweet)"
if [[ -f "${TARGET_DIR}/fxtweet-studio" ]]; then
  echo "  - GUI: ${TARGET_DIR}/fxtweet-studio"
fi
echo "========================================================"
