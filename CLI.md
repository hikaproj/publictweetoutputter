# FxTwitter Archive Studio - CLI User Manual

> **Created by Hikaproj**  
> Complete Command-Line Interface Reference for Linux, macOS & Windows

---

## 1. 概要

`fxtweet-cli` は、Twitter/X のタイムラインおよびメディアを超高速に収集・アーカイブするためのスタンドアロンなネイティブ Rust コマンドラインツールです。Node.js などのランタイムを必要とせず、単一バイナリとして高速に動作します。

また、Node.js 環境で手軽に実行できる `node cli.js` も同等のオプション体系を備えています。

---

## 2. インストール

### ワンライナーでの自動インストール
```bash
# Linux (Debian, Arch, Ubuntu, Fedora) & macOS (Intel & Apple Silicon)
curl -fsSL https://raw.githubusercontent.com/Hikaproj/publictweetoutputter/main/install.sh | bash

# Windows (PowerShell)
irm https://raw.githubusercontent.com/Hikaproj/publictweetoutputter/main/install.ps1 | iex
```

### ポータブルインストール
システムディレクトリへの書き込み権限がない場合、カレントディレクトリ内に配置可能です：
```bash
curl -fsSL https://raw.githubusercontent.com/Hikaproj/publictweetoutputter/main/install.sh | bash -s -- --portable
```

---

## 3. コマンド構文とオプション一覧

### 基本構文
```bash
fxtweet-cli --user <handle> [options]
```

### オプション一覧表

| オプション | 短縮形 | デフォルト値 | 説明 |
| :--- | :--- | :--- | :--- |
| `--user <handle>` | `-u` | *(必須)* | 取得対象の Twitter/X ユーザー名（`@` なしでも可） |
| `--format <fmt>` | - | `zip` | 出力アーカイブ形式（`zip`, `xarchpjzip`, `tar.gz`, `tar`, `folder`） |
| `--concurrency <num>` | `-j` | `8` | メディア（画像・動画）ダウンロードの同時並行スレッド数（1〜32） |
| `--continuous` | `-c` | `false` | 常時監視モードを有効化（最新投稿取得後もポーリングを継続） |
| `--interval <sec>` | - | `30` | 常時監視モードにおけるチェック間隔（秒） |
| `--no-images` | - | `false` | 添付画像のダウンロードをスキップ |
| `--no-videos` | - | `false` | 添付 MP4 動画のダウンロードをスキップ |
| `--image-quality <q>` | - | `orig` | 画像画質指定（`orig`: 原寸, `large`: 高解像度, `medium`: 標準, `small`: サムネイル） |
| `--video-quality <q>` | - | `highest` | 動画画質指定（`highest`: 最高ビットレート, `1080p`, `720p`, `480p`, `lowest`: 最小容量） |
| `--direction <dir>` | - | `newest` | 取得・ソート順序（`newest`: 最新順, `oldest`: 最古順） |
| `--max <num>` | - | `0` (無制限) | 収集する最大ポスト数 |
| `--out <dir>` | `-o` | `./output` | アーカイブ保存先の基底ディレクトリ |
| `--help` | `-h` | - | コマンドラインヘルプを表示して終了 |

---

## 4. 主な活用例 (Examples)

### 4.1 基本的なアーカイブ作成
指定したアカウントの全ポストおよびメディアをダウンロードし、標準 ZIP で出力します：
```bash
fxtweet-cli -u elonmusk
```

### 4.2 独自形式 `.xarchpjzip` で高解像度メディアを高並列取得
16並列で画像・動画を最高品質でダウンロードし、`.xarchpjzip` 形式で出力：
```bash
fxtweet-cli -u OpenAI --format xarchpjzip --concurrency 16
```

### 4.3 リアルタイム常時監視 (Live Monitoring)
新着ポストを30秒ごとに自動検知し、随時メディアとメタデータを追記保存：
```bash
fxtweet-cli -u nasa --continuous --interval 30
```

### 4.4 テキストのみの軽量アーカイブ (メディアなし)
画像や動画を保存せず、ツイート本文とメタデータ JSON のみを瞬時に取得：
```bash
fxtweet-cli -u twitter --no-images --no-videos --format tar.gz
```

### 4.5 定期自動実行 (Cron / サーバーバッチ)
Linux サーバーで深夜に特定ユーザーのアーカイブを更新する例：
```bash
# /etc/cron.d/twitter_backup
0 3 * * * root /usr/local/bin/fxtweet-cli -u TechCrunch -o /var/backups/twitter --format xarchpjzip
```

---

## 5. 出力ディレクトリ構造

アーカイブを展開、または `--format folder` で出力した場合の構造：

```
output/<username>_<timestamp>/
├── README.txt           # 実行サマリー・作成者・メタ情報
├── tweets.json          # 全ポストの完全な構造化 JSON
├── profile.json         # アカウントのプロファイル情報
├── summary.json         # 取得件数・ダウンロードバイト数・統計情報
├── media/               # 添付画像（JPG/PNG）および動画（MP4）
└── profile_media/       # アバターおよびヘッダー画像
```

---

## 6. 製作者 (Author)

**Hikaproj** (All Rights Reserved)
