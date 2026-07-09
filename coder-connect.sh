#!/usr/bin/env bash
# Attach this workspace to the Baseline docker network and start socat forwarders
# so localhost:3002 reaches the sibling web container (the Coder proxy forwards
# this workspace's localhost). Run via `make remote`.
set -u

NETWORK="baseline_baseline"
MAPPINGS=(
  "3002 baseline-web 3002"         # Web app
)
# Note: the API (3001) is intentionally NOT forwarded. The browser reaches it
# only through the web app's same-origin rewrite; exposing it publicly would let
# callers bypass the middleware (e.g. forge x-public-origin on the OAuth callback).

# Our own container id (from the bind-mounts in /proc/self/mountinfo).
SELF="$(grep '/containers/' /proc/self/mountinfo | grep -oE '[0-9a-f]{64}' | head -1)"

# Attach to the Baseline network — silently no-ops if already attached.
docker network connect "$NETWORK" "$SELF" 2>/dev/null

# Start one socat forwarder per mapping, skipping ports already forwarded.
for spec in "${MAPPINGS[@]}"; do
  read -r lp th tp <<<"$spec"
  if ! pgrep -f "TCP-LISTEN:$lp," >/dev/null; then
    socat "TCP-LISTEN:$lp,fork,reuseaddr" "TCP:$th:$tp" &
    echo "forwarding localhost:$lp -> $th:$tp"
  fi
done
