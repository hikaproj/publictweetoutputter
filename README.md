# FxTwitter Archive Studio (PublicTweetOutputter)

> **Created by Hikaproj**  
> **FxTwitter API を利用した超高速 Twitter(X) 公開ポスト・メディア一括取得 & バックアップスタジオ**  
> 完全ネイティブ Rust デスクトップ GUI & 高速 CLI (Windows / macOS / Linux / Arch) | Node.js ポータブル版 | 複数垢同時常時監視 | 完全脱絵文字 (Pure SVG) | 鍵垢自動復帰 | 統合オフライン X ビューアー (スマホ対応レスポンシブ / Retina画像出力 / ZIP・.xarchpjzip直接展開) | Docker 完全対応

---

## 目次

1. [概要](#概要)
2. [動作形態とアーキテクチャ](#動作形態とアーキテクチャ)
3. [主要機能一覧](#主要機能一覧)
4. [ワンライナー・ユニバーサルインストール](#ワンライナーユニバーサルインストール)
5. [配布パッケージ一覧 (Releases)](#配布パッケージ一覧-releases)
6. [クイックスタートガイド](#クイックスタートガイド)
   - [デスクトップ GUI (fxtweet-studio)](#1-デスクトップ-gui-fxtweet-studio)
   - [スタンドアロン X ビューアー (fxtweet-viewer)](#2-スタンドアロン-x-ビューアー-fxtweet-viewer)
   - [ネイティブ CLI (fxtweet-cli)](#3-ネイティブ-cli-fxtweet-cli)
   - [Docker / Docker Compose](#4-docker--docker-compose)
   - [Node.js ポータブル版](#5-nodejs-ポータブル版)
7. [アーカイブ形式と出力仕様](#アーカイブ形式と出力仕様)
8. [オフライン X ビューアーの詳細仕様](#オフライン-x-ビューアーの詳細仕様)
9. [トラブルシューティング & FAQ](#トラブルシューティング--faq)
10. [関連ドキュメント](#関連ドキュメント)
11. [製作者 & ライセンス](#製作者--ライセンス)

---

## 概要

**FxTwitter Archive Studio** は、FixTweet (FxTwitter) の v2 API を活用し、Twitter/X 上の公開投稿、高解像度添付画像、最高画質動画 (MP4)、およびプロフィール履歴をログイン不要・API キー不要で高速に一括アーカイブ・常時監視・オフライン閲覧できるオールインワンのバックアップスイートです。

Node.js 版を除き、デスクトップ GUI アプリケーション（`fxtweet-studio`）および CLI ツール（`fxtweet-cli`）、独立ビューアー（`fxtweet-viewer`）は **Rust ネイティブ** で完全に実装されています。ローカル Web サーバーの常駐や Web 埋め込みラッパーに依存せず、OS のネイティブウィンドウおよびバイナリとして直接高速に動作します。

---

## 動作形態とアーキテクチャ

本プロジェクトは用途や環境に合わせて複数のバイナリおよび実行形態を提供します：

| 形態 | バイナリ / コマンド | 実装言語 | 主な特徴・用途 |
| :--- | :--- | :--- | :--- |
| **デスクトップ GUI** | `fxtweet-studio` | Rust (Tauri v2) | メイン統合スタジオ。複数垢指定、保存先変更、圧縮形式選択、ライブテレメトリ表示、リアルタイムフィード監視。 |
| **独立 X ビューアー** | `fxtweet-viewer` | Rust (Tauri v2) | 本家 X 完全準拠のオフライン閲覧ソフト。ZIP / `.xarchpjzip` のドラッグ＆ドロップ展開、スマホ幅レスポンシブ、Retina 2x 画像出力。 |
| **ネイティブ CLI** | `fxtweet-cli` | Rust | 単一バイナリによる超高速スクレイパー。CI/CD パイプライン、Cron 定期実行、ヘッドレスサーバー監視。 |
| **Docker パッケージ** | `docker compose up -d` | Container | サーバー向け常駐コンテナ。解凍して起動するだけでブラウザから利用可能。 |
| **Node.js 版** | `server.js` / `cli.js` | JavaScript | ランタイムさえあればどこでも動くポータブル Web & CLI 実装。 |

```
+--------------------------------------------------------------------------+
|                     FxTwitter Archive Suite (by Hikaproj)               |
+--------------------------------------------------------------------------+
|  [Desktop Studio (Tauri/Rust)]   [Dedicated Viewer]   [Native CLI (Rust)]|
|   +--------------------------+    +---------------+    +---------------+ |
|   | Target / Format / Path   |    | Drag & Drop   |    | CLI Arguments | |
|   | Realtime Feed & Logs     |    | Mobile / Web  |    | Batch Scripts | |
|   | 1-10 Multi-Account Crawl |    | Retina Export |    | Headless Cron | |
|   +------------+-------------+    +-------+-------+    +-------+-------+ |
|                | Tauri IPC                |                    |         |
|                v                          v                    v         |
|  +--------------------------------------------------------------------+  |
|  |                 Core Rust Engine (Tokio / Reqwest)                 |  |
|  |  - FxTwitter v2 Cursor Scraper      - Multi-Threaded Media Fetch   |  |
|  |  - Lock Account Auto-Resume         - Deflate (.xarchpjzip / .zip) |  |
|  |  - Profile History Diff Tracker     - Custom Destination Handler   |  |
|  +------------------------------------+-------------------------------+  |
+---------------------------------------|----------------------------------+
                                        v HTTP/2
                         +-----------------------------+
                         |  FixTweet (FxTwitter) v2    |
                         |  Public REST Endpoints      |
                         +-----------------------------+
```

---

## 主要機能一覧

1. **完全ネイティブ Rust によるデスクトップ GUI、独立ビューアー & CLI**
   - Web サーバーのポート占有や外部プロセスの起動が不要。Tauri v2 IPC により Rust コアエンジンをダイレクトに駆動。
2. **多機能な保存先ディレクトリ変更機能**
   - GUI の「保存先フォルダ」入力欄、および CLI の `-o / --out` オプションにより、外付け HDD、NAS、特定作業ディレクトリなど任意のパスを自由に指定可能。未作成ディレクトリは自動的に作成されます。
3. **5 種類の多彩なアーカイブ形式に対応**
   - 独自形式 **`.xarchpjzip`**（Deflate 高圧縮 ZIP 規格）
   - 標準 **`.zip`** アーカイブ
   - **`.tar.gz`** (Gzip 圧縮 Tar)
   - **`.tar`** (無圧縮 Tar)
   - **`folder`** (非圧縮生ディレクトリ出力)
4. **本家 X (Twitter) 完全再現の独立オフラインビューアー (`fxtweet-viewer`)**
   - **スマホ完全対応レスポンシブ**: ウィンドウ幅を狭めると自動的にモバイルレイアウトへ遷移。画面下部に固定ボトムナビゲーションバー（ホーム、メディア、返信、テーマ切替）を表示し、タイムラインが全幅 edge-to-edge 表示になります。
   - **本家ライクなリポスト表示**: 緑色リポストアイコン（`#00BA7C`）と「〇〇さんがリポスト」ヘッダーを表示し、元ツイートの著者名・アバター・本文・添付メディアを美しく再現。
   - **引用ツイート (Quote Tweet)**: 本家準拠の角丸ボーダーカードとして自然にインライン配置。
   - **オフライン Blob メモリストア**: アーカイブ内の画像・動画をブラウザ内メモリ URL (Blob) として展開。外部通信ゼロで動画再生および画像拡大が可能。
   - **デモデータ即時ロード機能**: 「デモポストを表示して試す」ボタンにより、アーカイブファイルが手元にない状態でもワンクリックでビューアーの動作を体験可能。
5. **Retina 2x 高解像度ツイート画像 (PNG) 出力**
   - 各ポストカードの「画像出力」ボタンから、本家ツイート風のカード画像を Retina 2x（横幅 1196px）の高品位 PNG としてワンクリック書き出し。
6. **複数アカウント同時常時監視 (マルチアカウント対応)**
   - `@user1, @user2, @user3` とカンマまたは改行区切りで複数アカウントを一括指定可能。
   - 並列スレッド数（1〜10 垢）を設定し、指定した並列度で同時にタイムラインをスクレイピング。
   - **常時監視モード**: 最新投稿まで遡った後もプロセスを終了せず、指定間隔（秒）で新規投稿やプロフィール変更を自動検知して追記保存。
7. **鍵垢 (非公開) 耐性 & 自動復帰**
   - 取得途中でアカウントが鍵垢化（非公開化）した場合、エラーで強制終了せず安全に待機ループへ移行。公開に戻った瞬間にカーソル位置から自動再開。
8. **動的プロフィール更新検知 & 差分追加保存**
   - 取得中および常時監視中に、アカウント名・自己紹介文・アバター画像・ヘッダー画像の変更を検知。`profile_history.json` にタイムスタンプ付きで記録し、新規画像も漏れなくダウンロード。
9. **画像・動画の個別ダウンロード制御 & 画質選択**
   - 画像: `orig` (原寸・最高画質), `large` (高解像度), `medium` (標準), `small` (サムネイル)
   - 動画: `highest` (最高ビットレート MP4), `1080p`, `720p`, `480p`, `lowest` (最小容量)
   - 画像のみ取得、動画のみ取得、テキストのみ取得（メディア全オフ）も自由に選択可能。
10. **完全脱絵文字 (Pure SVG アイコン) & 洗練された UI**
    - UI、ログコンソール、ステータス表示に至るまで絵文字を一切排除。洗練された SVG ラインアイコンと monospace タイポグラフィを採用。
    - クリーンで視認性の高いライトテーマを標準とし、ダークテーマへのシームレスな切り替えに対応。

---

## ワンライナー・ユニバーサルインストール

### Linux (Debian / Ubuntu / Arch / Fedora) & macOS (Intel & Apple Silicon)
```bash
curl -fsSL https://raw.githubusercontent.com/Hikaproj/publictweetoutputter/main/install.sh | bash
```
> システム領域にインストールせず、カレントディレクトリに配置したい場合は `--portable` を付与してください：
> ```bash
> curl -fsSL https://raw.githubusercontent.com/Hikaproj/publictweetoutputter/main/install.sh | bash -s -- --portable
> ```

### Windows (Windows 10 / 11, PowerShell)
```powershell
irm https://raw.githubusercontent.com/Hikaproj/publictweetoutputter/main/install.ps1 | iex
```

---

## 配布パッケージ一覧 (Releases)

GitHub Releases より各プラットフォーム向けパッケージをご利用いただけます：

| パッケージ名 | 対象プラットフォーム | 内容物 |
| :--- | :--- | :--- |
| `fxtweet-studio-windows-x86_64-vX.X.X.zip` | Windows 64-bit | `fxtweet-studio.exe`, `fxtweet-viewer.exe`, `fxtweet-cli.exe` |
| `fxtweet-studio-macos-universal-vX.X.X.tar.gz` | macOS (Intel / Apple Silicon) | `fxtweet-studio`, `fxtweet-viewer`, `fxtweet-cli` (Universal Binary) |
| `fxtweet-studio-linux-x86_64-vX.X.X.tar.gz` | Linux x86_64 (glibc) | `fxtweet-studio`, `fxtweet-viewer`, `fxtweet-cli` |
| `fxtweet-studio-arch-x86_64-vX.X.X.tar.gz` | Arch Linux | `PKGBUILD`, ネイティブバイナリ一式 |
| `fxtweet-studio-docker-vX.X.X.zip` | 汎用 Docker 環境 | `docker-compose.yml`, `Dockerfile`, Web 版一式 |
| `fxtweet-studio-nodejs-vX.X.X.zip` | 汎用 Node.js 環境 | ポータブル Web サーバー (`server.js`) & CLI (`cli.js`) |

---

## クイックスタートガイド

### 1. デスクトップ GUI (`fxtweet-studio`)
1. ダウンロードした ZIP を解凍し、`fxtweet-studio` (Windows では `fxtweet-studio.exe`) をダブルクリックして起動します。
2. 画面上部の「ターゲットユーザー」に取得したいユーザー名（例: `elonmusk` や `@OpenAI`）を入力します。カンマ区切りで複数入力も可能です。
3. 必要に応じて「保存先フォルダ」を入力します（デフォルト: `./output`）。
4. 「圧縮形式」プルダウンから希望の形式（`.xarchpjzip`, `.zip`, `.tar.gz`, `.tar`, `フォルダ出力`）を選択します。
5. 「取得開始」ボタンをクリックします。
6. リアルタイムフィードに収集されたポストが次々に表示され、画面下部のテレメトリストリップに進捗状況、速度、メディア容量がリアルタイム更新されます。
7. ヘッダー右上の「独立Xビューアーを起動」をクリックすると、ビューアーが別ウィンドウで立ち上がります。

### 2. スタンドアロン X ビューアー (`fxtweet-viewer`)
1. `fxtweet-viewer` を起動するか、ブラウザで出力フォルダ内の `viewer.html` を開きます。
2. 取得した `.xarchpjzip` または `.zip` ファイルを画面右側のドロップゾーンにドラッグ＆ドロップします。
3. ツイート、リポスト、引用ポスト、添付画像、埋め込み動画が完全オフラインで表示されます。
4. ウィンドウ幅を狭めると自動的にスマホ表示（下部ナビバー付き）に切り替わります。
5. 各ツイートの「画像出力」ボタンをクリックすると、Retina 2x の PNG 画像が生成されます。

### 3. ネイティブ CLI (`fxtweet-cli`)
```bash
# 基本実行 (カレントディレクトリ配下の ./output に ZIP 出力)
fxtweet-cli --user elonmusk

# 保存先ディレクトリを指定し、独自形式 .xarchpjzip で16並列ダウンロード
fxtweet-cli --user OpenAI --out /mnt/storage/twitter --format xarchpjzip --concurrency 16

# 常時監視モード (30秒間隔で新着ポストをチェックし自動追記)
fxtweet-cli --user nasa --continuous --interval 30

# メディアを保存せずテキスト JSON のみ高速取得 (tar.gz 出力)
fxtweet-cli --user github --no-images --no-videos --format tar.gz

# ヘルプとオプション詳細の確認
fxtweet-cli --help
```

### 4. Docker / Docker Compose
```bash
# パッケージ解凍後、コンテナをバックグラウンド起動
docker compose up -d

# ブラウザで http://localhost:3000 にアクセス
# アーカイブ成果物はホストマシンの ./output に自動マウント保存されます
```

### 5. Node.js ポータブル版
```bash
# 依存関係のインストール
npm install

# Web GUI サーバー起動 (http://localhost:3000)
node server.js

# または CLI 実行
node cli.js -u elonmusk -o ./output --format zip
```

---

## アーカイブ形式と出力仕様

本ツールで作成されるアーカイブ内には、完全な構造化メタデータとローカルメディアが含まれます：

```
output/<username>_<timestamp>/
|-- README.txt              # アーカイブ作成日時、作成者、取得パラメータ概要
|-- tweets.json             # 取得された全ポストの完全な構造化 JSON
|-- profile.json            # ユーザープロファイル詳細メタデータ
|-- profile_history.json    # 監視中に検知されたプロフィール変更履歴 (差分)
|-- summary.json            # 取得完了統計 (総件数、バイト数、所要時間)
|-- media/                  # ツイート添付メディア (画像: JPG/PNG, 動画: MP4)
|   |-- <tweet_id>_photo_1.jpg
|   |-- <tweet_id>_photo_2.jpg
|   `-- <tweet_id>_video_1.mp4
`-- profile_media/          # アイコン・ヘッダー画像
    |-- avatar.jpg
    `-- banner.jpg
```

---

## オフライン X ビューアーの詳細仕様

### レスポンシブ・ブレークポイント
- **デスクトップ表示 (幅 > 1024px)**:
  - 左: ブランドナビゲーションバー（ホーム、メディア、返信、テーマ切替）
  - 中央: 本家 X 同一幅（最大 600px）のタイムラインカラム
  - 右: アーカイブ情報、統計メトリクス、ドラッグ＆ドロップエリア、デモボタン
- **タブレット表示 (幅 768px - 1024px)**:
  - 右側サイドバーが下部に折り畳まれ、中央のタイムラインが優先表示されます。
- **スマートフォン表示 (幅 < 768px)**:
  - 左側ナビゲーションが自動的に画面最下部の「固定ボトムナビゲーションバー」へ変形。
  - タイムラインが画面幅 100% の edge-to-edge 表示に切り替わり、タッチ操作に最適化されたカードパディングと文字サイズに調整されます。

### リポスト・引用ツイートの再現性
- **リポスト**: 上部に緑色（`#00BA7C`）の SVG リポストアイコンと「[アカウント名] さんがリポスト」ヘッダーが付き、元ツイートのアイコン、名前、本文、画像がフル表示されます。
- **引用ツイート**: ツイート本文の下に角丸ボーダーで囲まれた埋め込みカードとして元ツイートが表示されます。

---

## トラブルシューティング & FAQ

#### Q: 「プロフィール取得エラー: Unexpected token '<'」と表示される
**A:** FxTwitter 側の一時的な障害や過負荷により、JSON ではなく HTML エラーページが返された場合に発生します。本ツールには自動リトライ機構およびフォールバックエンドポイントが組み込まれています。少し時間を置いて再試行するか、同時並行スレッド数を下げて実行してください。

#### Q: 鍵垢（非公開アカウント）のツイートは取得できますか？
**A:** FxTwitter API は公開データのみを中継するため、非公開状態の投稿を取得することはできません。ただし、本ツールには「鍵垢自動復帰待機」機能が搭載されており、アカウントが公開された瞬間に自動検知して収集を開始します。

#### Q: デスクトップアプリで保存先フォルダが見つからない
**A:** 入力したパスが存在しない場合、エンジンが書き込み時に自動的にディレクトリを生成します。絶対パス（例: `C:\TwitterBackups` や `/mnt/data/backup`）または相対パス（例: `./output`）のいずれも指定可能です。

---

## 関連ドキュメント

- [CLI.md](file:///D:/Develop/code/publictweetoutputter/CLI.md): ネイティブ CLI (`fxtweet-cli`) の全フラグ、設定値、活用例
- [DOCS.md](file:///D:/Develop/code/publictweetoutputter/DOCS.md): 内部アーキテクチャ設計仕様、Rust ネイティブエンジン、Tauri IPC 仕様、`.xarchpjzip` 構造仕様

---

## 製作者 & ライセンス

- **Author**: **Hikaproj** (All Rights Reserved)
- **License**: MIT License
