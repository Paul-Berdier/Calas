#!/bin/sh
set -eu
# Railway mounts its volume as root. Change ownership of this one directory
# before dropping all privileges for the network probes, state and email.
[ "${MONITOR_STATE_DIR:-}" = /data/monitor ] || { echo "Point de stockage du moniteur invalide." >&2; exit 1; }
mountpoint -q "$MONITOR_STATE_DIR" || { echo "Volume du moniteur non monté." >&2; exit 1; }
chown node:node "$MONITOR_STATE_DIR"
chmod 700 "$MONITOR_STATE_DIR"
exec setpriv --reuid=node --regid=node --init-groups --no-new-privs \
    flock --no-fork --nonblock --conflict-exit-code 0 "$MONITOR_STATE_DIR/run.lock" node /app/monitor/run.mjs
