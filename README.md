# OreMedi

自宅NAS向けのセルフホスト型メディアサーバー。動画・音楽・ボイスコンテンツをブラウザから管理・再生できるPWAアプリ。

## 機能

- 動画/音楽/ボイスの再生・キュー管理
- FFmpegによる自動トランスコード
- タグシステム（自由なカテゴリ）
- ドラッグ&ドロップでファイルアップロード
- フォルダスキャンによる一括登録
- グローバル検索（タイトル・タグ横断）
- PWA対応（オフラインダウンロード）
- Chromecastサポート

## セットアップ（Docker）

### 1. 事前準備

メディア用のディレクトリを作成:

```bash
mkdir -p /volume1/docker/oremedi/media
mkdir -p /volume1/docker/oremedi/media-originals
```

### 2. .env ファイルを作成

```bash
# JWT用のシークレットキーを生成
JWT_SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")

# 強力なパスワードを設定（下記は例。必ず自分の値に変更すること）
PASSWORD=$(node -e "console.log(require('crypto').randomBytes(12).toString('base64url'))")

cat <<EOF > .env
PASSWORD=$PASSWORD
JWT_SECRET=$JWT_SECRET
EOF

echo "設定したパスワード: $PASSWORD"
```

`PASSWORD` は必ず自分の強力な値に設定してください（未設定だとログインは無効化されます）。

### 3. docker-compose.yml

`docker-compose.example.yml` をコピーして使えます:

```bash
cp docker-compose.example.yml docker-compose.yml
```

または手動で作成:

```yaml
services:
  oremedi:
    image: ghcr.io/ponzu07/oremedi:main
    ports:
      - "3000:3000"
    volumes:
      - /volume1/docker/oremedi/media:/media
      - /volume1/docker/oremedi/media-originals:/media-originals
      - oremedi-data:/data
    environment:
      - PUID=1026
      - PGID=100
      - PASSWORD=${PASSWORD}
      - JWT_SECRET=${JWT_SECRET}
      - DATABASE_PATH=/data/oremedi.db
      - MEDIA_PATH=/media
      - ORIGINALS_PATH=/media-originals
      - BODY_SIZE_LIMIT=Infinity
    restart: unless-stopped

volumes:
  oremedi-data:
```

### 4. 起動

```bash
docker compose up -d
```

ブラウザで `http://<NASのIP>:3000` にアクセス。

### 環境変数

| 変数 | 説明 | デフォルト |
|------|------|-----------|
| `PUID` | 実行ユーザーのUID（`id -u`で確認） | `0`（root） |
| `PGID` | 実行グループのGID（`id -g`で確認） | `0`（root） |
| `PASSWORD` | ログインパスワード（未設定だとログイン無効） | —（未設定） |
| `JWT_SECRET` | JWT署名用シークレット（必ず変更） | — |
| `DATABASE_PATH` | SQLiteのDBファイルパス | `data/oremedi.db` |
| `MEDIA_PATH` | メディアファイルの格納先 | `/media` |
| `ORIGINALS_PATH` | トランスコード前の元ファイルの退避先 | `/media-originals` |
| `BODY_SIZE_LIMIT` | アップロードの最大サイズ | `512K`（`Infinity`推奨） |
| `TRUSTED_ORIGINS` | フォーム/アップロードを許可するオリジン（カンマ区切り）。未設定なら全許可（CSRFオリジン検査は無効のまま） | —（`*`相当） |

### 非rootで実行（推奨・オプトイン）

既定ではコンテナは **root** で動作します。インターネットに露出する構成では、`PUID`/`PGID` にメディアボリュームの所有者UID/GID（ホストで `id -u` / `id -g`、Synologyは `id <ユーザー>`）を設定して非rootで動かすことを推奨します（`docker-compose.example.yml` は `PUID=1026`/`PGID=100` を例示）。

> ⚠️ **注意:** entrypoint は `/app` と `/data` のみを chown します。`/media`・`/media-originals` は chown しません。既存インストールで `PUID`/`PGID` を変更する場合は、事前にホスト側で
> ```bash
> chown -R <PUID>:<PGID> /volume1/docker/oremedi/media /volume1/docker/oremedi/media-originals
> ```
> を実行してください（所有者が一致しないとメディアを読み書きできなくなります）。

### CSRFオリジン検査（`TRUSTED_ORIGINS`）

既定ではオリジン検査は無効（`*`）で、Cookie は `SameSite=Lax` によりクロスサイトから送信されないため実効的に保護されています。複数ホスト名/IP で運用しつつ検査を有効化したい場合は、到達し得るオリジンを **すべて** カンマ区切りで列挙してください（列挙漏れがあるとログイン/アップロードの POST が 403 になります）。

```yaml
environment:
  - TRUSTED_ORIGINS=https://oremedi.example.com,https://oremedi.tailnet.ts.net
```

## ローカル開発

```bash
npm install
npm run dev -- --port 3000
```

`PASSWORD` を `.env` に設定してからアクセスしてください（未設定だとログインできません）。
