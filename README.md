# FxTwitter Archive Studio (PublicTweetOutputter)

> **Created by Hikaproj**  
> **FxTwitter API を利用した超高速 Twitter(X) 公開ポスト・メディア一括取得 & バックアップスタジオ**  
> 完全ネイティブ Rust デスクトップ GUI & 高速 CLI (Windows / macOS / Linux / Arch) · Node.js ポータブル版 · 複数垢同時常時監視 · 完全脱絵文字 (Pure SVG) · 鍵垢自動復帰 · 統合オフライン X ビューアー (Retina画像出力 & ZIP/.xarchpjzip直接展開対応) · Docker対応

---

## 概要

**FxTwitter Archive Studio** は、FixTweet (FxTwitter) の v2 API を活用し、Twitter/X 上の公開投稿、画像、動画、およびプロフィール履歴をログイン不要・APIキー不要で超高速に一括アーカイブ・常時監視・オフライン閲覧できるオールインワンのソフトウェアスイートです。

Node.js 版を除き、デスクトップ GUI アプリケーション（`fxtweet-studio`）および CLI ツール（`fxtweet-cli`）は **Rust ネイティブ** で完全に実装されており、外部のローカル Web サーバーの起動や常駐を一切必要とせず、単体で高速かつ安全に動作します。

---

## ワンライナー・ユニバーサルインストール

GitHub Releases から Linux / macOS (Intel & Apple Silicon) / Windows 向けのスタンドアロン CLI およびデスクトップバイナリをワンライナーで即座にインストール可能です。

### Linux (Debian, Ubuntu, Arch, Fedora) & macOS (Intel & Apple Silicon Universal)
```bash
curl -fsSL https://raw.githubusercontent.com/Hikaproj/publictweetoutputter/main/install.sh | bash
```
> カレントディレクトリへのポータブル配置を行いたい場合は `--portable` オプションを指定してください。

### Windows (Windows 10 / 11, PowerShell)
```powershell
irm https://raw.githubusercontent.com/Hikaproj/publictweetoutputter/main/install.ps1 | iex
```

### Docker / Docker Compose
```bash
# Docker 配布パッケージ（fxtweet-studio-docker-vX.X.X.zip）を展開後、または本リポジトリで実行
docker compose up -d

# ブラウザで http://localhost:3000 を開きます。
# 取得データはホストの ./output ディレクトリに自動保存されます。
```

---

## 主な機能と特徴

1. **完全ネイティブ Rust によるデスクトップ GUI & 高速 CLI**
   - デスクトップアプリ (`fxtweet-studio`) は Tauri v2 と Rust ネイティブエンジンで構築。ローカル Web サーバーの立ち上げや Web 埋め込みに依存せず、Tauri IPC 経由で直接ネイティブ処理を実行します。
   - CLI ツール (`fxtweet-cli`) は依存関係ゼロの単一バイナリとしてコンパイルされ、軽量かつ高速に動作します。
2. **統合オフライン X (Twitter) ビューアー搭載**
   - デスクトップアプリ内に「一括取得・常時監視」と「アーカイブ閲覧 (Viewer)」のモード切り替えタブを搭載。
   - バックアップ出力アーカイブ（`.zip` および独自形式 `.xarchpjzip`）を画面上にドラッグ＆ドロップするだけで、Rust ネイティブまたはブラウザ内メモリ上で即時展開し、オフラインでタイムラインやメディアを快適に閲覧可能。
3. **高解像度ツイート画像 (PNG) 出力機能**
   - ビューアー内の各ポストカードに「画像出力」機能を装備。Retina 2x の高精度 Canvas レンダリングエンジンにより、本家ツイート風のカード画像をワンクリックで PNG 保存可能。
4. **独自拡張子 `.xarchpjzip` および多彩なアーカイブ形式に対応**
   - 独自形式 **`.xarchpjzip`**（Deflate 高圧縮 ZIP 規格）に完全対応。
   - 標準 `.zip`、`.tar.gz`、`.tar`、およびフォルダ出力にも対応。
5. **複数アカウント同時常時監視 (マルチアカウント対応)**
   - ユーザー入力欄に `@user1, @user2, @user3` とカンマまたは改行区切りで複数アカウントを指定可能。
   - 同時処理件数（1〜10垢）を設定でき、指定した並列数で同時並行監視を実行。
   - **常時監視モード**: 最新投稿まで取得した後もプロセスを終了せず、新着ポストやプロフィール変更を自動検知して追記保存。
6. **メイン取得画面 & ビューアーともに「ライトモード標準」＋「ダークモード切り替え」**
   - デフォルトでクリーン＆ハイコントラストなライトモードを採用。
   - ヘッダーのトグルボタンからワンクリックでダークモードに切り替え可能。
7. **絵文字一切不使用 (Pure SVG アイコン)**
   - UI、ログコンソール、ステータスバッジ、メタデータに至るまで絵文字を一切排除。
   - 統一された SVG ラインアイコンと高品位なタイポグラフィを採用。
8. **画像のダウンロード & 画質制限 (ON / OFF)**
   - `orig` (原寸・最高画質)、`large` (高解像度)、`medium` (標準)、`small` (サムネイル) から画質を選択可能。
9. **動画のダウンロード & 画質設定 (ON / OFF)**
   - 最高画質 (Highest Bitrate)、`1080p`、`720p`、`480p`、低容量 (Lowest Bitrate) から最適な MP4 ストリームを自動選別してダウンロード。
10. **取得順序の選択 (最新順 vs 最古順)**
    - 最新順: 直近のポストから過去へ向かって収集。
    - 最古順: アカウント開設初期や指定期間の最古から時系列順に並び替えて出力。
11. **柔軟なポスト種別フィルタ**
    - 返信 (リプ)、リポスト (RT)、引用ポスト、通常ポストを個別に ON / OFF 可能。
12. **鍵垢 (非公開) 耐性 & 自動復帰**
    - 取得途中に鍵垢化した場合、公開再開まで自動待機し、公開された瞬間にカーソル位置から自動再開。
    - 最初から鍵垢のアカウントに対しても、公開されるのをバックグラウンドで待機可能。
13. **動的プロフィール更新検知 & 差分追加保存**
    - 取得中・常時監視中にプロフィール文、名前、アイコン、ヘッダー等の更新を検知し、`profile_history.json` にタイムスタンプ付きで記録し、新画像も追加保存。

---

## アーキテクチャと実行形態

| 形態 | 実装言語 | 概要 | 依存関係 |
| :--- | :--- | :--- | :--- |
| **デスクトップ GUI (`fxtweet-studio`)** | **Rust + Tauri v2** | 完全ネイティブ GUI アプリケーション。一括取得・常時監視・Xビューアーが統合されており、ローカル Web サーバー不要で単体動作します。 | なし (スタンドアロン) |
| **ネイティブ CLI (`fxtweet-cli`)** | **Rust** | 高速コマンドラインツール。パイプライン処理、定期実行 (cron)、ヘッドレスサーバー監視に最適です。 | なし (単一バイナリ) |
| **Docker パッケージ** | **Container** | Node.js Web 版を完全パッケージ化した Docker イメージ。解凍して `docker compose up -d` だけで即起動します。 | Docker |
| **Node.js 版 (`server.js` / `cli.js`)** | **Node.js** | クロスプラットフォームで手軽に動作する Web UI & CLI。 | Node.js >= 18 |

---

## ダウンロード一覧 (Release Assets)

GitHub Releases から各プラットフォーム向けのパッケージをダウンロードいただけます：

1. `fxtweet-studio-windows-x86_64-vX.X.X.zip` (Windows 向け Rust GUI `fxtweet-studio.exe` & CLI `fxtweet-cli.exe` 同梱)
2. `fxtweet-studio-macos-universal-vX.X.X.tar.gz` (macOS 向け Universal GUI & CLI 同梱 - Intel & Apple Silicon 双方でネイティブ動作)
3. `fxtweet-studio-linux-x86_64-vX.X.X.tar.gz` (Linux 向け GUI & CLI 同梱)
4. `fxtweet-studio-arch-x86_64-vX.X.X.tar.gz` (Arch Linux 向け PKGBUILD 付属パッケージ)
5. `fxtweet-studio-docker-vX.X.X.zip` (Docker 実行パッケージ一式 - 解凍して `docker compose up -d` で起動)
6. `fxtweet-studio-nodejs-vX.X.X.zip` / `.tar.gz` (Node.js 版ポータブル一式)
7. `install.sh` (Linux / macOS 共通インストールスクリプト)
8. `install.ps1` (Windows PowerShell 共通インストールスクリプト)
9. `SHA256SUMS.txt` (整合性検証用ハッシュリスト)

---

## クイックスタート

### 1. デスクトップ GUI アプリケーション (`fxtweet-studio`)
1. リリースからお使いの OS に合わせたアーカイブをダウンロードして解凍します。
2. `fxtweet-studio` (Windows では `fxtweet-studio.exe`) を起動します。
3. 取得したいアカウント（例: `@elonmusk`）を入力し、「プロフィール確認」を押します。
4. 画質や取得件数、フォーマット（`.xarchpjzip` や `.zip`）を選択し、「取得開始」をクリックします。
5. 取得完了後、「ビューアーで開く」をクリックするか、上部タブの「アーカイブ閲覧 (Viewer)」に切り替えてアーカイブをドロップすれば、オフラインで即座に閲覧できます。

### 2. ネイティブ CLI (`fxtweet-cli`)
```bash
# 基本的な取得（ZIP 出力）
fxtweet-cli --user elonmusk

# 独自形式 .xarchpjzip で出力し、画像・動画を最高画質で並列取得
fxtweet-cli --user OpenAI --format xarchpjzip --concurrency 16

# 常時監視モード（30秒間隔で新着投稿をチェック）
fxtweet-cli --user nasa --continuous --interval 30

# ヘルプと全オプションの表示
fxtweet-cli --help
```
詳細なコマンドラインオプションは [CLI.md](file:///D:/Develop/code/publictweetoutputter/CLI.md) をご覧ください。

### 3. オフライン X (Twitter) ビューアー
- デスクトップアプリ内の「アーカイブ閲覧 (Viewer)」タブ、または出力ファイル内に含まれる `viewer.html` をブラウザで開きます。
- `.xarchpjzip` または `.zip` ファイルを画面右側のドロップエリアにドラッグ＆ドロップします。
- ポスト一覧、添付画像、埋め込み動画、ユーザー情報が本家 X と同一のデザインで再現されます。
- 各ポストの「画像出力」ボタンをクリックすると、Retina 2x の高解像度なカード画像（PNG）として保存されます。

---

## 関連ドキュメント

- [CLI.md](file:///D:/Develop/code/publictweetoutputter/CLI.md): ネイティブ CLI (`fxtweet-cli`) の全フラグ、設定値、活用例
- [DOCS.md](file:///D:/Develop/code/publictweetoutputter/DOCS.md): アーキテクチャ設計仕様、Rust ネイティブエンジン、Tauri IPC 仕様、`.xarchpjzip` 構造仕様

---

## 製作者 (Author)

**Hikaproj**

## ライセンス

MIT License
