#!/bin/sh

PUID=${PUID:-0}
PGID=${PGID:-0}

if [ "$PUID" != "0" ]; then
    # グループ: 既存GIDのグループを使うか、なければ作成
    GROUP_NAME=$(getent group "$PGID" | cut -d: -f1)
    if [ -z "$GROUP_NAME" ]; then
        addgroup --gid "$PGID" appgroup
        GROUP_NAME="appgroup"
    fi

    # ユーザー: 既存UIDのユーザーを使うか、なければ作成
    USER_NAME=$(getent passwd "$PUID" | cut -d: -f1)
    if [ -z "$USER_NAME" ]; then
        adduser --uid "$PUID" --ingroup "$GROUP_NAME" --disabled-password --no-create-home --gecos "" appuser
        USER_NAME="appuser"
    fi

    chown -R "$PUID:$PGID" /app /data 2>/dev/null || true

    exec gosu "$USER_NAME" node build
else
    exec node build
fi
