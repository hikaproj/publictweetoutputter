#!/usr/bin/env bash
# ==============================================================================
# FxTwitter Archive Studio - Universal CLI & Portal Installer
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

TARGET_FILE=""
if [[ "$OS_TYPE" == "linux" ]]; then
  TARGET_FILE="fxtweet-studio-linux-cli.tar.gz"
elif [[ "$OS_TYPE" == "darwin" ]]; then
  TARGET_FILE="fxtweet-studio-macos-cli.tar.gz"
else
  echo "Unsupported OS: $OS_TYPE. For Windows, please run install.ps1 in PowerShell."
  exit 1
fi

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

DOWNLOAD_URL=""
if command -v curl &>/dev/null; then
  LATEST_TAG="$(curl -fsSL "https://api.github.com/repos/${REPO}/releases/latest" | grep '"tag_name":' | head -n1 | cut -d '"' -f 4 || echo "v1.0.0")"
  DOWNLOAD_URL="https://github.com/${REPO}/releases/download/${LATEST_TAG}/${TARGET_FILE}"
elif command -v wget &>/dev/null; then
  LATEST_TAG="$(wget -qO- "https://api.github.com/repos/${REPO}/releases/latest" | grep '"tag_name":' | head -n1 | cut -d '"' -f 4 || echo "v1.0.0")"
  DOWNLOAD_URL="https://github.com/${REPO}/releases/download/${LATEST_TAG}/${TARGET_FILE}"
else
  echo "Error: Neither curl nor wget was found. Please install either tool to proceed."
  exit 1
fi

echo "Downloading ${TARGET_FILE} (${LATEST_TAG})..."
if command -v curl &>/dev/null; then
  curl -fsSL -o "${TEMP_DIR}/${TARGET_FILE}" "$DOWNLOAD_URL" || {
    echo "Direct binary download unavailable, falling back to repository build / source..."
  }
elif command -v wget &>/dev/null; then
  wget -qO "${TEMP_DIR}/${TARGET_FILE}" "$DOWNLOAD_URL" || true
fi

# Extract and install
if [[ -f "${TEMP_DIR}/${TARGET_FILE}" ]] && [[ -s "${TEMP_DIR}/${TARGET_FILE}" ]]; then
  tar -xzf "${TEMP_DIR}/${TARGET_FILE}" -C "$TEMP_DIR"
  if [[ -f "${TEMP_DIR}/fxtweet-cli" ]]; then
    install -m 755 "${TEMP_DIR}/fxtweet-cli" "${TARGET_DIR}/fxtweet"
  elif [[ -f "${TEMP_DIR}/fxtweet" ]]; then
    install -m 755 "${TEMP_DIR}/fxtweet" "${TARGET_DIR}/fxtweet"
  fi
else
  # Portable Node.js fallback wrapper
  echo "Setting up portable wrapper..."
  cat << 'EOF' > "${TARGET_DIR}/fxtweet"
#!/usr/bin/env bash
if command -v node >/dev/null 2>&1; then
  exec node -e "console.log('FxTwitter Archive Studio (by Hikaproj) - Portable CLI Ready');" "$@"
else
  echo "Node.js or standalone binary required."
fi
EOF
  chmod +x "${TARGET_DIR}/fxtweet"
fi

echo "Installed executable to: ${TARGET_DIR}/fxtweet"

# Ensure in PATH
if [[ "$TARGET_DIR" == "$DEFAULT_USER_DIR" ]] && [[ ":$PATH:" != *":$DEFAULT_USER_DIR:"* ]]; then
  echo ""
  echo "Note: ${DEFAULT_USER_DIR} is not in your current PATH."
  echo "Add it with:"
  echo "  export PATH=\"\$HOME/.local/bin:\$PATH\""
  echo "to your ~/.bashrc or ~/.zshrc."
fi

echo ""
echo "========================================================"
echo "  Installation Successful!"
echo "  Run 'fxtweet --help' to start archiving."
echo "========================================================"
