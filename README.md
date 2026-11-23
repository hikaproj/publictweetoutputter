# FxTwitter Archive Studio (PublicTweetOutputter)

> **Created by Hikaproj**  
> **FxTwitter API を利用した超高速 Twitter(X) 公開ポスト・メディア一括取得 & バックアップスタジオ**  
> Node.js 版 & 軽量クロスプラットフォーム Rust 版 (Win / Mac / Linux / iOS / Android) · 複数垢同時常時監視 · 完全脱絵文字 (Pure SVG) · 鍵垢自動復帰 · Xライク・オフラインビューアー (画像出力 & ZIP/.xarchpjzip直接展開対応) · Docker対応

---

## 🚀 ワンライナー・ユニバーサルインストール

GitHub Releases から Linux / macOS (Intel & Apple Silicon) / Windows 向けのスタンドアロン CLI をワンライナーで即座にインストール可能です。

### Linux (Debian, Arch, Ubuntu, Fedora) & macOS (Intel & Apple Silicon)
```bash
curl -fsSL https://raw.githubusercontent.com/Hikaproj/publictweetoutputter/main/install.sh | bash
```
> ※ `--portable` を渡すことで、管理者権限不要でカレントディレクトリ (`./fxtweet-bin`) にポータブル配置も可能です。

### Windows (Windows 10 / 11, PowerShell)
```powershell
irm https://raw.githubusercontent.com/Hikaproj/publictweetoutputter/main/install.ps1 | iex
```

### Docker / Docker Compose
```bash
# バックグラウンド起動
docker compose up -d

# ブラウザで http://localhost:3000 を開きます。
# 取得データはホストの ./output ディレクトリに自動保存されます。
```

---

## 🌟 主な機能と特徴

1. **超高速・APIキー不要の取得エンジン**
   - FixTweet (FxTwitter) の v2 API (`/2/profile/:screen_name/statuses`) を使用し、レート制限やログイン不要で超高速にタイムラインをストリーミング取得。
2. **複数アカウント同時常時監視 (マルチアカウント対応)**
   - ユーザー入力欄に `@user1, @user2, @user3` とカンマやスペース区切りで指定可能。
   - **同時処理件数 (1〜10垢)** をスライダーで設定可能。指定した並列数で各アカウントを同時並行監視します。
   - **常時監視モード**: 最新投稿まで取得後も終了せず、新着ポストやプロフィール変更を自動検知して追記保存。
3. **メイン取得画面 & ビューアーともに「ライトモード標準」＋「ダークモード切り替え」**
   - メイン取得ページ: デフォルトでクリーン＆ハイコントラストな**ライトモード**。ヘッダーのボタンから即座にダークモードへ切り替え可能。
   - ビューアー画面: デフォルトで本家ライクな**ライトモード**。左サイドバーから「ライト」「Dim」「ダーク」を瞬時に切り替え可能。
4. **絵文字一切不使用・完全 SVG アイコン化**
   - UI、ログ、ターミナル出力、バッジ、メタ情報に至るまで絵文字を一切排除。
   - 統一感のある 14px ラインアイコン（SVG）と高コントラストなタイポグラフィを採用。
5. **X (Twitter) ライク・高再現度オフラインビューアー付属**
   - バックアップ出力アーカイブ（ZIP / TAR.GZ / フォルダ / `.xarchpjzip`）内に自動で `viewer.html` を同梱。
   - **圧縮ファイル直接読み込み**: `.zip` や `.xarchpjzip` を解凍することなく、画面上にドラッグ＆ドロップするだけでブラウザ内でメモリ上展開し、メディアを含め完全オフラインで即座に閲覧可能。
   - **ツイート画像出力 (PNG 保存)**: 各ポストカードに「画像出力」ボタンを搭載。高解像度 (Retina 2x) の HTML5 Canvas レンダラーにより、本家ツイート風のカード画像をワンクリックで PNG 保存可能。
6. **新形式 `.xarchpjzip` および多彩なアーカイブ出力**
   - 高圧縮 ZIP エンジンによる `.xarchpjzip` 拡張子出力に対応。
   - 標準 `.zip`、`.tar.gz`、`.tar`、およびフォルダ出力にも完全対応。
7. **画像のダウンロード & 画質制限 (ON / OFF)**
   - `orig` (原寸・最高画質)、`large` (高解像度)、`medium` (標準)、`small` (サムネイル) から画質制限を選択可能。
8. **動画のダウンロード & 画質設定 (ON / OFF)**
   - 最高画質 (Highest Bitrate)、`1080p`、`720p`、`480p`、低容量 (Lowest Bitrate) から最適な MP4 ストリームを自動選別。
9. **取得順序の選択 (最新順 vs 最古順)**
   - **最新順**: 直近のポストから過去へ向かって収集。
   - **最古順**: アカウント開設初期や指定期間の最古から時系列順に並び替えて出力。
10. **柔軟なポスト種別フィルタ**
    - 返信 (リプ)、リポスト (RT)、引用ポスト、通常ポストを個別に ON / OFF。
11. **鍵垢 (非公開) 耐性 & 自動復帰**
    - 取得途中に鍵垢化した場合、公開再開まで自動待機し、公開された瞬間にカーソル位置から自動再開。
    - 「中断して出力」を押せば、その時点までに取得できた分だけを即座に書き出し可能。
    - 最初から鍵垢のアカウントに対しても、公開されるのをバックグラウンドで待機可能。
12. **動的プロフィール更新検知 & 差分追加保存**
    - 取得中・常時監視中にプロフィール文、名前、アイコン、ヘッダー等が更新された場合、変更履歴を `profile_history.json` にタイムスタンプ付きで記録し、新画像も追加保存。

---

## 📦 二重アーキテクチャ (Node.js 版 & Rust 版)

### 1. Node.js 版 (即座に動作する Web UI & CLI)
- **Web UI 起動**:
  ```bash
  npm start
  ```
  ブラウザで `http://localhost:3000` を開きます。
  右上リンク「X風ビューアー」から、いつでもビューアー画面（`viewer.html`）を直接開くことができます。
- **CLI 実行**:
  ```bash
  # 単一アカウント取得
  node cli.js --user elonmusk [options]
  
  # 複数アカウント同時常時監視 (並列数: 4, 出力形式: .xarchpjzip)
  node cli.js --users "elonmusk, jack, openai" --parallel-users 4 --continuous --format xarchpjzip
  ```

### 2. 軽量 Rust 版 (Tauri v2 によるクロスプラットフォーム対応)
Windows, macOS, Linux (Debian, Arch), iOS, iPadOS, Android で動作する軽量ネイティブ版です。
- ディレクトリ: `src-tauri/`
- **CLI ビルド**:
  ```bash
  cd src-tauri
  cargo build --release --bin fxtweet-cli
  ```
  生成される `fxtweet-cli` はわずか数MBの単一バイナリで、Node.js 不要で高速動作します。
- **デスクトップ / モバイルアプリ ビルド**:
  ```bash
  npm run tauri build
  ```

---

## 🤖 GitHub Actions による自動マルチプラットフォームビルド & Release

`.github/workflows/release.yml` により、Git タグ（`v1.0.0` 等）のプッシュまたは GitHub Actions の手動実行（`workflow_dispatch`）で全プラットフォーム向けバイナリを自動ビルドし、Release へ自動添付します。

### Release に自動添付されるファイル一覧:
1. `install.sh` (Linux + macOS 共通インストーラー)
2. `install.ps1` (Windows PowerShell 共通インストーラー)
3. `fxtweet-studio-windows-x86_64-vX.X.X.zip` (Windows 向け Rust GUI `fxtweet-studio.exe` & CLI `fxtweet-cli.exe` 同梱)
4. `fxtweet-studio-macos-universal-vX.X.X.tar.gz` (macOS 向け Universal GUI & CLI 同梱)
5. `fxtweet-studio-linux-x86_64-vX.X.X.tar.gz` (Linux 向け GUI & CLI 同梱)
6. `fxtweet-studio-arch-x86_64-vX.X.X.tar.gz` (Arch Linux 向け PKGBUILD 付属パッケージ)
7. `fxtweet-studio-nodejs-vX.X.X.zip` / `.tar.gz` (Node.js 版ポータブル一式)
8. `fxtweet-studio-docker-vX.X.X.zip` (Docker 実行パッケージ一式 - 解凍して `docker compose up -d` だけで即起動可能)
9. `Dockerfile` & `docker-compose.yml` (Docker コンテナ単体マニフェスト)
10. `SHA256SUMS.txt` (整合性チェックサム)

---

## X (Twitter) ライク・ビューアーの使い方

生成された ZIP や `.xarchpjzip`、フォルダ内の **`viewer.html`** をブラウザで開くだけで、本家 X と同じデザインで保存データを閲覧できます。

- **アーカイブ直接展開**:
  - 右サイドバーのドロップゾーンに `.zip` や `.xarchpjzip` ファイルをドラッグ＆ドロップすると、JSZip によりブラウザ内で自動解凍され、即座にポストや画像・動画が表示されます。
- **ツイート画像出力 (PNG)**:
  - 各ポスト下部のアクションバーにある「画像出力」ボタンを押すと、高解像度な X 風ツイート画像が生成され、自動で PNG ダウンロードされます。
- **テーマ切り替え**:
  - 左サイドバー下部の「外観」から「ライト（標準）」「Dim」「ダーク」を瞬時に切り替え可能。
- **検索 & フィルタ**:
  - 右サイドバーの検索バーにキーワードを入力すると、保存されたポストを即座に絞り込み。
  - 「画像/動画付きのみ」「返信を除外」「リポストを除外」をワンクリックで反映。

---

## 製作者 (Author)
**Hikaproj**

## ライセンス
MIT License
