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

JWT用のシークレットキーを生成:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 2. docker-compose.yml

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
      - PASSWORD=your_password_here
      - JWT_SECRET=your_generated_secret_here
      - DATABASE_PATH=/data/oremedi.db
      - MEDIA_PATH=/media
      - ORIGINALS_PATH=/media-originals
      - BODY_SIZE_LIMIT=Infinity
    restart: unless-stopped

volumes:
  oremedi-data:
```

### 3. 起動

```bash
docker compose up -d
```

ブラウザで `http://<NASのIP>:3000` にアクセス。

### 環境変数

| 変数 | 説明 | デフォルト |
|------|------|-----------|
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
