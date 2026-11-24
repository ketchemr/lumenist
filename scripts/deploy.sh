#!/usr/bin/env bash
#
# Lumenist Zero-Downtime Production Deploy Script
#
# Uses alternating A/B build slots (.next-a / .next-b) + .next-active pointer
# with PM2 cluster-mode reload so:
#   - Live traffic is completely untouched while the new build compiles.
#   - Both build slots remain intact during PM2's rolling reload overlap.
#   - Every Next.js manifest matches its exact distDir (zero path mismatch).
#   - Failed builds never affect the running production site.
#
# Usage:
#   npm run deploy
#   bash scripts/deploy.sh [--no-pull] [--force-install] [--skip-reload]
#
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

APP_NAME="${PM2_APP_NAME:-lumenist}"
ACTIVE_FILE=".next-active"
LOCK_HASH_FILE=".deploy-lockhash"

DO_PULL=1
FORCE_INSTALL=0
DO_RELOAD=1

for arg in "$@"; do
  case "$arg" in
    --no-pull)
      DO_PULL=0
      ;;
    --force-install)
      FORCE_INSTALL=1
      ;;
    --skip-reload)
      DO_RELOAD=0
      ;;
    -h|--help)
      cat <<EOF
Usage: $(basename "$0") [options]

Options:
  --no-pull        Skip 'git pull --ff-only'
  --force-install  Always run 'npm ci' even if package-lock.json is unchanged
  --skip-reload    Build and update .next-active without reloading PM2
  -h, --help       Show this help message

Environment variables:
  PM2_APP_NAME     PM2 application name (default: lumenist)
  PORT             HTTP port for Next.js (default: 3000)
EOF
      exit 0
      ;;
    *)
      echo "Unknown option: $arg" >&2
      exit 1
      ;;
  esac
done

log() {
  printf '\n\033[1;34m[deploy]\033[0m %s\n' "$1"
}

warn() {
  printf '\033[1;33m[deploy]\033[0m %s\n' "$1" >&2
}

hash_file() {
  if command -v sha256sum >/dev/null 2>&1; then
    sha256sum "$1" | awk '{print $1}'
  elif command -v shasum >/dev/null 2>&1; then
    shasum -a 256 "$1" | awk '{print $1}'
  else
    node -e "const fs=require('fs'),c=require('crypto');console.log(c.createHash('sha256').update(fs.readFileSync(process.argv[1])).digest('hex'))" "$1"
  fi
}

# Snapshot tsconfig.json and next-env.d.ts so Next.js updating them for
# .next-a/.next-b never leaves tracked files modified in git.
TSCONFIG_BACKUP=""
NEXTENV_BACKUP=""
cleanup() {
  if [ -n "$TSCONFIG_BACKUP" ] && [ -f "$TSCONFIG_BACKUP" ]; then
    mv -f "$TSCONFIG_BACKUP" "$ROOT_DIR/tsconfig.json"
  fi
  if [ -n "$NEXTENV_BACKUP" ] && [ -f "$NEXTENV_BACKUP" ]; then
    mv -f "$NEXTENV_BACKUP" "$ROOT_DIR/next-env.d.ts"
  fi
}
trap cleanup EXIT

START_TS="$(date +%s)"

# 1. Pull latest code
if [ "$DO_PULL" -eq 1 ] && [ -d ".git" ]; then
  log "Pulling latest changes..."
  git pull --ff-only
fi

# 2. Conditional dependency install
if [ -f "package-lock.json" ]; then
  CURRENT_HASH="$(hash_file package-lock.json)"
  PREVIOUS_HASH=""
  if [ -f "$LOCK_HASH_FILE" ]; then
    PREVIOUS_HASH="$(cat "$LOCK_HASH_FILE")"
  fi

  if [ "$FORCE_INSTALL" -eq 1 ] || [ ! -d "node_modules" ] || [ "$CURRENT_HASH" != "$PREVIOUS_HASH" ]; then
    log "Dependencies changed (or fresh install) — running npm ci..."
    npm ci --prefer-offline --no-audit
    printf '%s\n' "$CURRENT_HASH" > "$LOCK_HASH_FILE"
  else
    log "package-lock.json unchanged — skipping npm ci."
  fi
elif [ "$FORCE_INSTALL" -eq 1 ] || [ ! -d "node_modules" ]; then
  log "Installing dependencies..."
  npm install
fi

# 3. Pick inactive build slot (.next-a <-> .next-b)
CURRENT_SLOT=""
if [ -f "$ACTIVE_FILE" ]; then
  CURRENT_SLOT="$(tr -d '[:space:]' < "$ACTIVE_FILE")"
fi

if [ "$CURRENT_SLOT" = ".next-a" ]; then
  TARGET_SLOT=".next-b"
  CACHE_SOURCE=".next-a/cache"
else
  TARGET_SLOT=".next-a"
  if [ "$CURRENT_SLOT" = ".next-b" ] && [ -d ".next-b/cache" ]; then
    CACHE_SOURCE=".next-b/cache"
  else
    CACHE_SOURCE=".next/cache"
  fi
fi

# 4. Staged Next.js build into the inactive slot
log "Building into ${TARGET_SLOT}/ (live slot '${CURRENT_SLOT:-.next}' remains online)..."
rm -rf "$TARGET_SLOT"
mkdir -p "$TARGET_SLOT"

if [ -d "$CACHE_SOURCE" ]; then
  cp -a "$CACHE_SOURCE" "${TARGET_SLOT}/cache"
fi

if [ -f "tsconfig.json" ]; then
  TSCONFIG_BACKUP="$(mktemp "${TMPDIR:-/tmp}/lumenist-tsconfig.XXXXXX")"
  cp -p "tsconfig.json" "$TSCONFIG_BACKUP"
fi
if [ -f "next-env.d.ts" ]; then
  NEXTENV_BACKUP="$(mktemp "${TMPDIR:-/tmp}/lumenist-nextenv.XXXXXX")"
  cp -p "next-env.d.ts" "$NEXTENV_BACKUP"
fi

if ! NEXT_DIST_DIR="$TARGET_SLOT" npm run build; then
  rm -rf "$TARGET_SLOT"
  warn "Build failed — live slot '${CURRENT_SLOT:-.next}' and running server were not touched."
  exit 1
fi

# Restore tracked TS files immediately after build
if [ -n "$TSCONFIG_BACKUP" ] && [ -f "$TSCONFIG_BACKUP" ]; then
  mv -f "$TSCONFIG_BACKUP" "$ROOT_DIR/tsconfig.json"
  TSCONFIG_BACKUP=""
fi
if [ -n "$NEXTENV_BACKUP" ] && [ -f "$NEXTENV_BACKUP" ]; then
  mv -f "$NEXTENV_BACKUP" "$ROOT_DIR/next-env.d.ts"
  NEXTENV_BACKUP=""
fi

# 5. Atomically flip the active slot pointer
log "Switching active build slot -> ${TARGET_SLOT}..."
TMP_ACTIVE="$(mktemp "${ROOT_DIR}/.next-active.XXXXXX")"
printf '%s\n' "$TARGET_SLOT" > "$TMP_ACTIVE"
mv -f "$TMP_ACTIVE" "$ACTIVE_FILE"

# 6. Zero-downtime PM2 reload
if [ "$DO_RELOAD" -eq 1 ]; then
  if ! command -v pm2 >/dev/null 2>&1; then
    warn "pm2 not found on PATH — ${ACTIVE_FILE} updated to ${TARGET_SLOT}; please reload your server manually."
  else
    PM2_STATE="$(node -e '
      const { execFileSync } = require("child_process");
      const appName = process.argv[1];
      try {
        const raw = execFileSync("pm2", ["jlist"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
        const list = JSON.parse(raw);
        const proc = list.find((p) => p.name === appName);
        if (!proc) {
          console.log("missing");
        } else {
          const mode = proc.pm2_env && proc.pm2_env.exec_mode || "";
          const script = proc.pm2_env && proc.pm2_env.pm_exec_path || "";
          if (mode === "cluster_mode" && script.includes("next")) {
            console.log("cluster");
          } else {
            console.log("legacy");
          }
        }
      } catch {
        console.log("missing");
      }
    ' "$APP_NAME")"

    case "$PM2_STATE" in
      cluster)
        log "Performing zero-downtime PM2 reload for '${APP_NAME}'..."
        pm2 reload "$APP_NAME" --update-env
        ;;
      legacy)
        log "Migrating '${APP_NAME}' from legacy fork/npm mode to cluster mode (ecosystem.config.cjs)..."
        pm2 delete "$APP_NAME" || true
        pm2 start ecosystem.config.cjs --only "$APP_NAME"
        pm2 save
        ;;
      missing)
        log "Starting '${APP_NAME}' via ecosystem.config.cjs..."
        pm2 start ecosystem.config.cjs --only "$APP_NAME"
        pm2 save
        ;;
    esac
  fi
fi

ELAPSED=$(( $(date +%s) - START_TS ))
log "Deploy complete in ${ELAPSED}s (active slot: ${TARGET_SLOT})."
