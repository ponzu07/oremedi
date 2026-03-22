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

cat <<EOF > .env
PASSWORD=oremedi
JWT_SECRET=$JWT_SECRET
EOF
```

`PASSWORD`は適宜変更してください。

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
| `PASSWORD` | ログインパスワード | `oremedi` |
| `JWT_SECRET` | JWT署名用シークレット（必ず変更） | — |
| `DATABASE_PATH` | SQLiteのDBファイルパス | `data/oremedi.db` |
| `MEDIA_PATH` | メディアファイルの格納先 | `/media` |
| `ORIGINALS_PATH` | トランスコード前の元ファイルの退避先 | `/media-originals` |
| `BODY_SIZE_LIMIT` | アップロードの最大サイズ | `512K`（`Infinity`推奨） |

## ローカル開発

```bash
npm install
npm run dev -- --port 3000
```

デフォルトパスワード: `oremedi`
