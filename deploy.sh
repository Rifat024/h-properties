#!/usr/bin/env bash
# Deploys the H. Properties website to Vercel production (h-properties-nine.vercel.app).
#
# Usage: ./deploy.sh
#
# Deploys exactly what is on origin/main: it refuses uncommitted changes and any checkout
# that is not origin/main. The site is checked and built locally first, and any failure
# stops the deploy. The site is static, so the check is that its pages are present.
#
# One-time setup: `npx vercel login`. The script links the repository to the Vercel project
# itself if it is not linked yet.
set -euo pipefail

# Every deploy ships the latest default branch: switch to it, pull, then re-run the updated script.
if [ "${DEPLOY_SYNCED:-0}" != "1" ] && [[ " $* " != *" -h "* && " $* " != *" --help "* && " $* " != *" --allow-unmerged "* ]]; then
  REPO_ROOT="$(git -C "$(dirname "${BASH_SOURCE[0]}")" rev-parse --show-toplevel)"
  DEFAULT_BRANCH="$(git -C "$REPO_ROOT" ls-remote --symref origin HEAD | awk '/^ref:/ { sub("refs/heads/", "", $2); print $2 }')"
  if [ -n "$(git -C "$REPO_ROOT" status --porcelain --untracked-files=no)" ]; then
    printf '[deploy] %s has uncommitted changes. Commit or stash them before deploying.\n' "$REPO_ROOT" >&2
    exit 1
  fi
  printf '[deploy] Switching to %s and pulling the latest...\n' "${DEFAULT_BRANCH:-main}"
  git -C "$REPO_ROOT" switch --quiet "${DEFAULT_BRANCH:-main}"
  git -C "$REPO_ROOT" pull --quiet --ff-only origin "${DEFAULT_BRANCH:-main}"
  DEPLOY_SYNCED=1 exec bash "${BASH_SOURCE[0]}" "$@"
fi

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WEB="$ROOT"
VERCEL_SCOPE="rifat024s-projects"
VERCEL_PROJECT="h-properties"
PRODUCTION_URL="https://h-properties-nine.vercel.app"

CYAN='\033[0;36m'; GREEN='\033[0;32m'; RED='\033[0;31m'; RESET='\033[0m'
log() { printf "${CYAN}[deploy]${RESET} %s\n" "$*"; }
ok()  { printf "${GREEN}[deploy]${RESET} %s\n" "$*"; }
err() { printf "${RED}[deploy]${RESET} %s\n" "$*" >&2; }

for argument in "$@"; do
  case "$argument" in
    -h|--help) sed -n '2,11p' "$0"; exit 0 ;;
    *) err "Unknown option: $argument"; exit 1 ;;
  esac
done

check_source() {
  log "Checking that this is the code on origin/main..."
  if [ -n "$(git -C "$ROOT" status --porcelain)" ]; then
    err "The checkout has uncommitted changes. Commit them, or stash them, before deploying."; exit 1
  fi
  git -C "$ROOT" fetch --quiet origin main
  if [ "$(git -C "$ROOT" rev-parse HEAD)" != "$(git -C "$ROOT" rev-parse origin/main)" ]; then
    err "This checkout is not origin/main. Check out main and pull before deploying."; exit 1
  fi
}

check_web() {
  log "Checking and building..."
  ( cd "$WEB" && test -f index.html && test -f admin.html && test -f finance.html )
}

deploy_web() {
  if [ ! -f "$WEB/.vercel/project.json" ]; then
    log "Linking to the $VERCEL_PROJECT Vercel project..."
    ( cd "$WEB" && npx --yes vercel link --yes --project "$VERCEL_PROJECT" --scope "$VERCEL_SCOPE" )
  fi
  log "Deploying to Vercel production..."
  ( cd "$WEB" && npx --yes vercel deploy --prod --yes --scope "$VERCEL_SCOPE" )
}

verify_live() {
  log "Checking $PRODUCTION_URL..."
  for path in "/" "/admin.html"; do
    status="$(curl --silent --location --output /dev/null --write-out '%{http_code}' "$PRODUCTION_URL$path")"
    if [ "$status" != "200" ]; then
      err "$PRODUCTION_URL$path answered $status."; exit 1
    fi
  done
  ok "Live at $PRODUCTION_URL ($(git -C "$ROOT" rev-parse --short HEAD))."
}

check_source
check_web
deploy_web
verify_live
