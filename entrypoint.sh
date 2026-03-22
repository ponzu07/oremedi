#!/bin/sh

PUID=${PUID:-0}
PGID=${PGID:-0}

if [ "$PUID" != "0" ]; then
    groupmod -o -g "$PGID" appuser 2>/dev/null || addgroup --gid "$PGID" appuser
    usermod -o -u "$PUID" -g "$PGID" appuser 2>/dev/null || adduser --uid "$PUID" --ingroup appuser --disabled-password --no-create-home --gecos "" appuser

    chown -R "$PUID:$PGID" /app /data 2>/dev/null || true

    exec su-exec appuser node build
else
    exec node build
fi
