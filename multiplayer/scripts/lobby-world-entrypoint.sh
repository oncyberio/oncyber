#!/bin/sh
set -eu
# Fly mounts the persistent volume as root; limit ownership changes to TLS data.
if [ -n "${LOBBY_WORLD_ACME_HOST:-}" ]; then
  mkdir -p "${LOBBY_WORLD_TLS_DIR:-/data/tls}"
  chown node:node "${LOBBY_WORLD_TLS_DIR:-/data/tls}"
  chmod 700 "${LOBBY_WORLD_TLS_DIR:-/data/tls}"
fi
exec gosu node node build/lobby-world.js
