#!/usr/bin/env bash
# =============================================================================
#  deploy.sh — ATOM Sales Dominator Akamai EdgeWorker Build & Deploy
# =============================================================================
#
#  Usage:
#    bash deploy.sh [staging|production]
#
#  Arguments:
#    $1  — network: "staging" or "production" (default: staging)
#
#  Required environment variables:
#    EDGEWORKER_ID   — Numeric EdgeWorker ID from Akamai Control Center
#
#  Optional environment variables:
#    AKAMAI_EDGERC   — Path to .edgerc credentials file (default: ~/.edgerc)
#    AKAMAI_SECTION  — .edgerc section name (default: default)
#
# =============================================================================

set -euo pipefail

# ── Colour helpers ────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; NC='\033[0m'
info()    { echo -e "${BLUE}[INFO]${NC}  $*"; }
success() { echo -e "${GREEN}[OK]${NC}    $*"; }
warn()    { echo -e "${YELLOW}[WARN]${NC}  $*"; }
die()     { echo -e "${RED}[ERROR]${NC} $*" >&2; exit 1; }

# ── Argument / env parsing ────────────────────────────────────────────────────
NETWORK="${1:-${AKAMAI_NETWORK:-staging}}"
if [[ "$NETWORK" != "staging" && "$NETWORK" != "production" ]]; then
  die "Invalid network '$NETWORK'. Must be 'staging' or 'production'."
fi

: "${EDGEWORKER_ID:?Environment variable EDGEWORKER_ID must be set}"
EDGERC="${AKAMAI_EDGERC:-$HOME/.edgerc}"
SECTION="${AKAMAI_SECTION:-default}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DIST_DIR="$SCRIPT_DIR/dist"
BUNDLE_FILE="$SCRIPT_DIR/bundle.tgz"

# Derive version from bundle.json (e.g. "1.0.0") + short git SHA for uniqueness
BUNDLE_VERSION=$(node -pe "require('./bundle.json')['edgeworker-version']" 2>/dev/null || echo "1.0.0")
GIT_SHA=$(git -C "$SCRIPT_DIR" rev-parse --short HEAD 2>/dev/null || echo "nogit")
VERSION="${BUNDLE_VERSION}+${GIT_SHA}"

# ── Preflight checks ──────────────────────────────────────────────────────────
info "Preflight checks..."
command -v node     >/dev/null 2>&1 || die "node not found — install Node.js 18+"
command -v npm      >/dev/null 2>&1 || die "npm not found"
command -v akamai   >/dev/null 2>&1 || die "Akamai CLI not found — run: brew install akamai"
[[ -f "$EDGERC" ]]                  || die ".edgerc not found at $EDGERC — see CREDENTIALS_NEEDED.md"

success "Preflight passed"

# ── 1. Install dependencies ───────────────────────────────────────────────────
info "Installing npm dependencies..."
cd "$SCRIPT_DIR"
npm install --prefer-offline --silent
success "Dependencies installed"

# ── 2. Type-check ─────────────────────────────────────────────────────────────
info "Running TypeScript type-check (tsc --noEmit)..."
npx tsc --noEmit
success "TypeScript OK"

# ── 3. Build bundle with esbuild ──────────────────────────────────────────────
info "Building EdgeWorker bundle with esbuild → dist/main.js..."
mkdir -p "$DIST_DIR"
npx esbuild src/main.ts \
  --bundle \
  --outfile="$DIST_DIR/main.js" \
  --format=esm \
  --target=es2022 \
  --platform=neutral \
  --external:log \
  --external:cookies \
  --external:url-search-params \
  --external:streams \
  --external:http-request \
  --external:create-response \
  --minify

BUNDLE_SIZE=$(du -sh "$DIST_DIR/main.js" | cut -f1)
success "Build complete — bundle size: $BUNDLE_SIZE"

# ── 4. Validate bundle size (Akamai limit: 2 MB compressed) ───────────────────
BUNDLE_BYTES=$(stat -f%z "$DIST_DIR/main.js" 2>/dev/null || stat -c%s "$DIST_DIR/main.js")
if (( BUNDLE_BYTES > 2097152 )); then
  die "Bundle exceeds Akamai 2 MB limit (${BUNDLE_BYTES} bytes). Reduce dependencies."
fi

# ── 5. Package into .tgz ──────────────────────────────────────────────────────
info "Packaging bundle.tgz..."
cd "$DIST_DIR"
cp "$SCRIPT_DIR/bundle.json" ./bundle.json

tar -czf "$BUNDLE_FILE" main.js bundle.json

cd "$SCRIPT_DIR"
success "bundle.tgz created ($(du -sh "$BUNDLE_FILE" | cut -f1))"

# ── 6. Upload to Akamai ───────────────────────────────────────────────────────
info "Uploading bundle to Akamai EdgeWorkers (ID: $EDGEWORKER_ID)..."
akamai edgeworkers upload \
  --edgerc "$EDGERC" \
  --section "$SECTION" \
  --bundle "$BUNDLE_FILE" \
  "$EDGEWORKER_ID"

success "Upload complete"

# ── 7. Activate ───────────────────────────────────────────────────────────────
info "Activating EdgeWorker $EDGEWORKER_ID on $NETWORK (version: $VERSION)..."
akamai edgeworkers activate \
  --edgerc "$EDGERC" \
  --section "$SECTION" \
  "$EDGEWORKER_ID" \
  "$NETWORK" \
  "$BUNDLE_VERSION"

# ── 8. Status summary ─────────────────────────────────────────────────────────
echo ""
echo -e "${GREEN}╔══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║  ATOM EdgeWorker Deploy Complete                             ║${NC}"
echo -e "${GREEN}╠══════════════════════════════════════════════════════════════╣${NC}"
echo -e "${GREEN}║${NC}  EdgeWorker ID : ${YELLOW}$EDGEWORKER_ID${NC}"
echo -e "${GREEN}║${NC}  Version       : ${YELLOW}$BUNDLE_VERSION${NC}  (git: $GIT_SHA)"
echo -e "${GREEN}║${NC}  Network       : ${YELLOW}$NETWORK${NC}"
echo -e "${GREEN}║${NC}  Bundle        : $BUNDLE_FILE"
echo -e "${GREEN}╠══════════════════════════════════════════════════════════════╣${NC}"
echo -e "${GREEN}║  Monitor:                                                    ║${NC}"
echo -e "${GREEN}║${NC}  akamai edgeworkers list-revisions $EDGEWORKER_ID"
echo -e "${GREEN}║${NC}  akamai edgeworkers list-activations $EDGEWORKER_ID"
echo -e "${GREEN}╚══════════════════════════════════════════════════════════════╝${NC}"

if [[ "$NETWORK" == "staging" ]]; then
  warn "Deployed to STAGING. Run 'bash deploy.sh production' to go live."
fi
