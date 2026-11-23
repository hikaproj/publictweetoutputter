# FxTwitter Archive Studio - CLI User Manual

> **Created by Hikaproj**  
> **Complete Command-Line Interface Reference for Linux, macOS & Windows**

---

## 目次

1. [概要](#1-概要)
2. [インストール方法](#2-インストール方法)
3. [コマンド構文と全オプション一覧](#3-コマンド構文と全オプション一覧)
4. [オプション詳細解説](#4-オプション詳細解説)
   - [4.1 ターゲットと保存先設定](#41-ターゲットと保存先設定)
   - [4.2 アーカイブ出力形式](#42-アーカイブ出力形式)
   - [4.3 メディアダウンロードと画質制御](#43-メディアダウンロードと画質制御)
   - [4.4 フィルタリングと取得件数制御](#44-フィルタリングと取得件数制御)
   - [4.5 常時監視モード (Continuous Monitoring)](#45-常時監視モード-continuous-monitoring)
5. [実践活用シナリオ & シェルスクリプト例](#5-実践活用シナリオ--シェルスクリプト例)
   - [5.1 単一アカウントの高速完全アーカイブ](#51-単一アカウントの高速完全アーカイブ)
   - [5.2 複数アカウントのリスト一括バッチスクレイピング](#52-複数アカウントのリスト一括バッチスクレイピング)
   - [5.3 Linux Systemd サービスによる常時デーモン監視](#53-linux-systemd-サービスによる常時デーモン監視)
   - [5.4 Linux Cron による定期自動バックアップ](#54-linux-cron-による定期自動バックアップ)
   - [5.5 Windows PowerShell による自動実行スクリプト](#55-windows-powershell-による自動実行スクリプト)
6. [終了ステータスコード (Exit Codes)](#6-終了ステータスコード-exit-codes)
7. [製作者 & ライセンス](#7-製作者--ライセンス)

---

## 1. 概要

`fxtweet-cli` は、Twitter/X 上の公開投稿、高解像度添付画像、最高画質 MP4 動画、およびプロフィール情報を高速に収集・アーカイブするための単一バイナリ形式のネイティブ Rust コマンドラインツールです。

Node.js などの外部ランタイムを一切必要とせず、スタンドアロンで動作します。また、Node.js 環境で実行可能な `node cli.js` も同一の引数体系に対応しています。

---

## 2. インストール方法

### ワンライナーでの自動インストール

#### Linux (Debian, Ubuntu, Arch, Fedora) & macOS (Intel & Apple Silicon)
```bash
curl -fsSL https://raw.githubusercontent.com/Hikaproj/publictweetoutputter/main/install.sh | bash
```

#### Windows (Windows 10 / 11, PowerShell)
```powershell
irm https://raw.githubusercontent.com/Hikaproj/publictweetoutputter/main/install.ps1 | iex
```

### ポータブルインストール
システムディレクトリへの管理者権限がない環境では、カレントディレクトリに直接バイナリを配置できます：
```bash
curl -fsSL https://raw.githubusercontent.com/Hikaproj/publictweetoutputter/main/install.sh | bash -s -- --portable
```

---

## 3. コマンド構文と全オプション一覧

### 基本構文
```bash
fxtweet-cli --user <screen_name> [options]
# または Node.js 環境の場合:
node cli.js -u <screen_name> [options]
```

### オプション一覧表

| オプション | 短縮形 | 引数型 | デフォルト値 | 説明 |
| :--- | :--- | :--- | :--- | :--- |
| `--user <handle>` | `-u` | 文字列 | *(必須)* | 取得対象のユーザー名（`@` なし、または `@user` 形式） |
| `--out <dir>` | `-o` | パス | `./output` | アーカイブ保存先の基底ディレクトリ（存在しない場合は自動作成） |
| `--format <fmt>` | - | 文字列 | `zip` | 出力形式（`xarchpjzip`, `zip`, `tar.gz`, `tar`, `folder`） |
| `--concurrency <num>`| `-j` | 整数 | `8` | メディア（画像・動画）ダウンロードの並行スレッド数（1〜32） |
| `--continuous` | `-c` | フラグ | `false` | 常時監視モードを有効化（最新投稿取得後もポーリング継続） |
| `--interval <sec>` | - | 整数 | `30` | 常時監視モードにおける新着チェック間隔（秒） |
| `--no-images` | - | フラグ | `false` | 添付画像のダウンロードをスキップ（テキストと動画のみ） |
| `--no-videos` | - | フラグ | `false` | 添付 MP4 動画のダウンロードをスキップ |
| `--image-quality <q>`| - | 文字列 | `orig` | 画像解像度（`orig`: 原寸, `large`: 高画質, `medium`: 標準, `small`: サムネイル） |
| `--video-quality <q>`| - | 文字列 | `highest`| 動画画質（`highest`: 最高ビットレート, `1080p`, `720p`, `480p`, `lowest`: 最小容量） |
| `--direction <dir>` | - | 文字列 | `newest` | タイムライン取得順序（`newest`: 最新順, `oldest`: 最古順） |
| `--max <num>` | - | 整数 | `0` (無制限) | 取得する最大ツイート数（0 で全件取得） |
| `--no-replies` | - | フラグ | `false` | リプライ（返信）ツイートを除外 |
| `--no-retweets`| - | フラグ | `false` | リツイート（リポスト）を除外 |
| `--no-quotes` | - | フラグ | `false` | 引用リツイートを除外 |
| `--help` | `-h` | フラグ | - | ヘルプメッセージを表示して終了 |
| `--version` | `-V` | フラグ | - | バージョン情報を表示して終了 |

---

## 4. オプション詳細解説

### 4.1 ターゲットと保存先設定
- **`--user, -u <handle>`**:
  取得対象のアカウント名を指定します。`@` 記号の有無は自動的に正規化されます。
- **`--out, -o <path>`**:
  出力先の保存ディレクトリを指定します。相対パス（例: `./backups`）または絶対パス（例: `/mnt/nas/twitter_archives` や `D:\Backups`）に対応し、指定ディレクトリが存在しない場合は自動作成されます。

### 4.2 アーカイブ出力形式
`--format <fmt>` で指定可能な値：
1. **`xarchpjzip`**: 独自拡張子による Deflate 高圧縮 ZIP 形式。専用ビューアーで即座に展開・閲覧できます。
2. **`zip`**: 一般的な標準 ZIP アーカイブ形式。
3. **`tar.gz`**: Unix/Linux サーバー環境で広く使われる Gzip 圧縮 Tar アーカイブ。
4. **`tar`**: 無圧縮 Tar アーカイブ。
5. **`folder`**: 圧縮を行わず、生ディレクトリ構造（JSON およびメディアファイル群）のまま出力。

### 4.3 メディアダウンロードと画質制御
- **`--concurrency, -j <num>`**:
  Tokio 非同期プールを用いたメディアダウンロードの同時並行接続数です（デフォルト: 8）。高速なインターネット環境では `16` や `24` を指定することで所要時間を大幅に短縮できます。
- **`--image-quality <orig|large|medium|small>`**:
  Twitter CDN からフェッチする画像の解像度を指定します。デフォルトの `orig` は元のアップロード画像と同一の最高品質を保持します。
- **`--video-quality <highest|1080p|720p|480p|lowest>`**:
  添付動画の中から最適な解像度・ビットレートの MP4 ストリームを自動選別します。ストレージ容量を抑えたい場合は `lowest` や `480p` を指定します。

### 4.4 フィルタリングと取得件数制御
- **`--no-replies`**: 他ユーザーへのリプライ投稿をタイムラインから除外します。
- **`--no-retweets`**: 他ユーザーの投稿をリポストしたツイートを除外します。
- **`--no-quotes`**: 引用リツイートを除外します。
- **`--max <num>`**: 取得する投稿数の上限を指定します（例: 直近の 100 件のみ取得したい場合は `--max 100`）。

### 4.5 常時監視モード (Continuous Monitoring)
`--continuous` (`-c`) を指定すると、タイムラインの最新投稿まで収集した後もプロセスを終了せず、バックグラウンドで待機します。
指定された `--interval <sec>` 秒ごとに FxTwitter API をポーリングし、新着投稿やプロフィールの更新（アイコン・ヘッダー・自己紹介文）を検知すると、即座に差分メディアをダウンロードしてアーカイブを自動更新します。

---

## 5. 実践活用シナリオ & シェルスクリプト例

### 5.1 単一アカウントの高速完全アーカイブ
高解像度画像・最高画質動画を 16 並列でダウンロードし、独自形式 `.xarchpjzip` で出力：
```bash
fxtweet-cli -u OpenAI --format xarchpjzip -j 16 -o /mnt/storage/twitter
```

### 5.2 複数アカウントのリスト一括バッチスクレイピング
テキストファイル（`targets.txt`）に列挙されたアカウントを順番にバックアップするシェルスクリプト：

```bash
#!/usr/bin/env bash
# targets.txt: 1行に1つのアカウント名（例: elonmusk, nasa, github）

while IFS= read -r user || [ -n "$user" ]; do
  # 空行やコメント行をスキップ
  [[ -z "$user" || "$user" =~ ^# ]] && continue
  
  echo "[INFO] Processing user: @${user}..."
  fxtweet-cli --user "$user" --out ./batch_output --format xarchpjzip --concurrency 8
  
  # レートリミット保護のための短い待機
  sleep 3
done < targets.txt
```

### 5.3 Linux Systemd サービスによる常時デーモン監視
特定アカウントを 24 時間体制で監視し続ける systemd テンプレートユニットの例：

`/etc/systemd/system/fxtweet-monitor@.service`:
```ini
[Unit]
Description=FxTwitter Continuous Archive Monitor for @%i
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=backupuser
ExecStart=/usr/local/bin/fxtweet-cli --user %i --continuous --interval 30 --out /var/backups/twitter --format xarchpjzip
Restart=always
RestartSec=10
LimitNOFILE=65535

[Install]
WantedBy=multi-user.target
```

有効化と起動：
```bash
sudo systemctl daemon-reload
# @nasa アカウントの常時監視を開始
sudo systemctl enable --now fxtweet-monitor@nasa.service
```

### 5.4 Linux Cron による定期自動バックアップ
毎日深夜 3:00 に指定アカウントの最新バックアップを作成する設定：

```bash
# crontab -e
0 3 * * * /usr/local/bin/fxtweet-cli -u elonmusk -o /var/backups/twitter --format zip >> /var/log/fxtweet.log 2>&1
```

### 5.5 Windows PowerShell による自動実行スクリプト
```powershell
# PowerShell script for multi-account archive
$targets = @("elonmusk", "OpenAI", "nasa")
$outputDir = "C:\TwitterBackups"

foreach ($target in $targets) {
    Write-Host "[INFO] Archiving @$target to $outputDir..."
    & fxtweet-cli.exe --user $target --out $outputDir --format xarchpjzip --concurrency 12
    Start-Sleep -Seconds 2
}
Write-Host "[SUCCESS] All accounts successfully backed up."
```

---

## 6. 終了ステータスコード (Exit Codes)

スクリプトや CI/CD パイプラインでの判定に使用可能なステータスコード一覧：

| コード | 状態 | 説明 |
| :--- | :--- | :--- |
| `0` | 正常完了 | タイムラインおよびメディアの収集・アーカイブ作成が正常に完了 |
| `1` | 引数エラー | 必須引数 `--user` の未指定、または無効なパラメータの指定 |
| `2` | ネットワークエラー | FxTwitter API への接続失敗、DNS 解決失敗、または致命的な HTTP エラー |
| `3` | I/O エラー | 出力ディレクトリの作成失敗、書き込み権限不足、またはディスク容量不足 |
| `130`| ユーザー中断 | `SIGINT` (Ctrl+C) による安全な中断 |

---

## 7. 製作者 & ライセンス

- **Author**: **Hikaproj** (All Rights Reserved)
- **License**: MIT License
