# Step 5: テスト手順

## 概要
全インフラ構築・アプリ配置完了後に、以下のテストを順番に実施します。
問題が発生した場合のトラブルシューティング手順も併記しています。

---

## 5.1 前提確認（テスト開始前チェック）

### App GatewayのPublic IP確認

```bash
# Azure CLIで確認
az network public-ip show \
  --resource-group JQA_katsu \
  --name keiryo-dev-ag-pip \
  --query "ipAddress" -o tsv

# 出力例: 20.xxx.xxx.xxx
# 以降、このIPを <AppGw-IP> として使用
```

### 各VMのステータス確認

```bash
# 全VMが実行中であることを確認
az vm list --resource-group JQA_katsu --show-details --query "[].{Name:name, Status:powerState}" -o table

# 期待結果:
# Name               Status
# -----------------  ----------
# keiryo-deb-web1    VM running
# keiryo-deb-web2    VM running
# keiryo-deb-apps    VM running
```

---

## 5.2 テスト1: App Gatewayパスベースルーティング確認

### テスト1-1: 開発用環境（/dev/）へのアクセス

**手順:**
1. ブラウザを開く
2. `https://<AppGw-IP>/dev/` にアクセス
3. 自己署名証明書の警告が表示されるので「続行」を選択

**期待結果:**
- ログイン画面が表示される
- 画面右上に「開発環境」のバッジが表示される
- URL欄が `https://<AppGw-IP>/dev/login` になっている

**失敗時の確認ポイント:**
| 症状 | 確認箇所 |
|:---|:---|
| 502 Bad Gateway | web1 VMが起動しているか / IISが起動しているか |
| 404 Not Found | IISの物理パス設定 / Reactのビルドが正しく配置されているか |
| 接続タイムアウト | NSGルールでApp GWサブネット→フロントエンドサブネットのHTTP(80)が許可されているか |
| 画面は表示されるがアセットが読み込めない | vite.config.ts の base 設定が `/dev/` になっているか |

### テスト1-2: 顧客確認用環境（/client/）へのアクセス

**手順:**
1. ブラウザで `https://<AppGw-IP>/client/` にアクセス

**期待結果:**
- ログイン画面が表示される
- 画面右上に「顧客確認環境」のバッジが表示される（/dev/とは異なるバッジ名）
- URL欄が `https://<AppGw-IP>/client/login` になっている

**確認ポイント:**
- `/dev/` と `/client/` で異なるVMに到達していることを確認
  - 各環境名のバッジが正しいことで確認できる

### テスト1-3: API経路（/api/）へのアクセス

**手順:**
1. ブラウザで `https://<AppGw-IP>/api/health` にアクセス
2. またはPowerShellで以下を実行

```powershell
Invoke-RestMethod -Uri "https://<AppGw-IP>/api/health" | ConvertTo-Json
```

**期待結果:**
- `app=UP` / `database=UP` / `dbProduct=Microsoft SQL Server` が返る

**失敗時の確認ポイント:**
| 症状 | 確認箇所 |
|:---|:---|
| 404 Not Found | App Gateway `pathmap-main` に `rule-api (/api/*)` があるか |
| 502 Bad Gateway | `nsg-backend` で `172.16.0.0/24 -> 8080` 許可があるか、`probe-api-health` が `Healthy` か |
| タイムアウト | apps VMで `KeiryoAPI` サービス稼働 + `localhost:8080/api/health` 応答確認 |

---

## 5.3 テスト2: ログイン機能

### テスト2-1: 正常ログイン

**手順:**
1. `https://<AppGw-IP>/dev/login` にアクセス
2. 以下の初期ユーザーでログイン:
   - ユーザー名: `admin`
   - パスワード: `admin123`
3. 「ログイン」ボタンをクリック

**期待結果:**
- ダッシュボード画面に遷移する
- ヘッダーに「管理者 (admin)」と表示される
- 3つのタブ（ユーザー管理、外部接続テスト、Azure Files操作）が表示される

### テスト2-2: ログイン失敗

**手順:**
1. 間違ったパスワードでログインを試みる
   - ユーザー名: `admin`
   - パスワード: `wrongpassword`

**期待結果:**
- 「ユーザー名またはパスワードが正しくありません」というエラーメッセージが表示される
- ダッシュボードに遷移しない

**失敗時の確認ポイント:**
| 症状 | 確認箇所 |
|:---|:---|
| 「サーバーに接続できません」 | バックエンドVM(apps)でSpring Bootが起動しているか |
| DB接続エラー | Private Endpointの設定 / application.propertiesの接続文字列 |
| CORS エラー（ブラウザコンソール） | `CorsConfig.java` の許可オリジン設定、またはフロントの `VITE_API_BASE_URL=`（空）を確認 |

---

## 5.4 テスト3: ユーザー管理（CRUD）

### テスト3-1: ユーザー一覧表示（READ）

**手順:**
1. ログイン後、「① ユーザー管理」タブをクリック

**期待結果:**
- 初期データの3ユーザー（admin, tanaka, suzuki）が一覧表示される
- ID、ユーザー名、表示名、メール、役割、操作ボタンが表示される

### テスト3-2: ユーザー新規登録（CREATE）

**手順:**
1. 「+ 新規登録」ボタンをクリック
2. 以下を入力:
   - ユーザー名: `yamada`
   - パスワード: `yamada123`
   - 表示名: `山田次郎`
   - メールアドレス: `yamada@example.com`
   - 役割: `user`
3. 「保存」ボタンをクリック

**期待結果:**
- フォームが閉じる
- 一覧に「yamada」が追加されている
- IDが自動採番されている

### テスト3-3: ユーザー更新（UPDATE）

**手順:**
1. 「yamada」の行の「編集」ボタンをクリック
2. 表示名を「山田次郎（更新済み）」に変更
3. 「保存」ボタンをクリック

**期待結果:**
- 一覧の表示名が更新されている

### テスト3-4: ユーザー削除（DELETE）

**手順:**
1. 「yamada」の行の「削除」ボタンをクリック
2. 確認ダイアログで「OK」を選択

**期待結果:**
- 一覧から「yamada」が消えている
- 他のユーザーは影響を受けていない

---

## 5.5 テスト4: 外部接続テスト（Yahoo取得）

### テスト4-1: Yahoo! JAPANタイトル取得

**手順:**
1. 「② 外部接続テスト」タブをクリック
2. 「Yahoo! JAPANのタイトルを取得」ボタンをクリック

**期待結果:**
- 取得結果が表示される
  - ステータスコード: `200`
  - ページタイトル: Yahoo! JAPANに関連するタイトル文字列
  - 結果メッセージ: 「NAT Gateway経由での外部接続に成功しました」

**失敗時の確認ポイント:**
| 症状 | 確認箇所 |
|:---|:---|
| 「外部接続に失敗しました。NAT Gatewayの設定を確認してください」 | NAT GatewayがバックエンドサブネットにAssociateされているか |
| タイムアウト | NAT GatewayのPublic IPが正しくアタッチされているか |
| DNS解決エラー | VNetのDNS設定を確認（Azure既定DNSを使用しているか） |

### トラブルシューティング（バックエンドVM上で直接テスト）

```powershell
# バックエンドVMにBastionでRDP接続して実行

# 1. DNS解決テスト
nslookup www.yahoo.co.jp

# 2. 外部接続テスト
Invoke-WebRequest -Uri "https://www.yahoo.co.jp" -UseBasicParsing | Select-Object StatusCode

# 3. Spring Boot APIを直接テスト
Invoke-RestMethod -Uri "http://localhost:8080/api/external/yahoo" | ConvertTo-Json
```

---

## 5.6 テスト5: Azure Files操作

### テスト5-1: テキストファイルの保存

**手順:**
1. 「③ Azure Files操作」タブをクリック
2. 以下を入力:
   - ファイル名: `test-memo`
   - 内容: `これはAzure Filesのテストデータです。正常に保存されれば成功です。`
3. 「Azure Filesに保存」ボタンをクリック

**期待結果:**
- 「ファイルを保存しました: test-memo_20260217_143000.txt」のような成功メッセージが表示される
- 保存済みファイル一覧に新しいファイルが表示される

### テスト5-2: ファイル一覧の確認

**手順:**
1. 「一覧を更新」ボタンをクリック

**期待結果:**
- 保存したファイルが一覧に表示される

### テスト5-3: Azure Files上での物理ファイル確認

```powershell
# バックエンドVMにBastionでRDP接続して実行

# Zドライブのファイルを確認
Get-ChildItem Z:\appfiles\

# ファイルの内容を確認
Get-Content "Z:\appfiles\test-memo_20260217_143000.txt"
```

**失敗時の確認ポイント:**
| 症状 | 確認箇所 |
|:---|:---|
| 「Azure Filesのマウントパスが見つかりません」 | Zドライブのマウント状態（`net use`で確認） |
| 「ファイルの保存に失敗しました」 | Azure Filesの書き込み権限 / Storage AccountのPrivate Endpoint |
| 一覧取得エラー | application.propertiesの`app.azure-files.mount-path`設定値 |

---

## 5.7 テスト6: 顧客確認用環境（/client/）での全機能テスト

`/dev/` で上記テスト(2〜5)が全て成功したら、`/client/` でも同じテストを実施します。

**手順:**
1. `https://<AppGw-IP>/client/` にアクセス
2. テスト2〜5と同じ操作を実行

**確認ポイント:**
- `/client/` からも同じバックエンドAPI（keiryo-deb-apps）にアクセスできること
- 「顧客確認環境」バッジが表示されていること（/dev/の「開発環境」とは異なる）
- ユーザーデータは共通のDBを使っているため、`/dev/`で作成したデータが`/client/`でも見えること

---

## 5.8 テスト7: ヘルスチェックAPI（インフラ疎通確認）

```bash
# Azure CLIからVM Run Commandでバックエンドのヘルスチェックを実行
az vm run-command invoke \
  --resource-group JQA_katsu \
  --name keiryo-deb-apps \
  --command-id RunPowerShellScript \
  --scripts 'Invoke-RestMethod -Uri "http://localhost:8080/api/health" | ConvertTo-Json'

# 期待結果:
# {
#   "app": "UP",
#   "database": "UP",
#   "dbProduct": "Microsoft SQL Server"
# }
```

---

## 5.9 全テスト結果チェックシート

| No. | テスト項目 | URL/手順 | 期待結果 | 結果 |
|:---:|:---|:---|:---|:---:|
| 1-1 | /dev/ ルーティング | `https://<IP>/dev/` | ログイン画面（開発環境） | □ |
| 1-2 | /client/ ルーティング | `https://<IP>/client/` | ログイン画面（顧客確認環境） | □ |
| 1-3 | /api/ ルーティング | `https://<IP>/api/health` | app=UP, db=UP | □ |
| 2-1 | 正常ログイン | admin/admin123 | ダッシュボード表示 | □ |
| 2-2 | ログイン失敗 | admin/wrongpass | エラーメッセージ | □ |
| 3-1 | ユーザー一覧 | ユーザー管理タブ | 3件表示 | □ |
| 3-2 | ユーザー登録 | 新規登録ボタン | 追加成功 | □ |
| 3-3 | ユーザー更新 | 編集ボタン | 更新成功 | □ |
| 3-4 | ユーザー削除 | 削除ボタン | 削除成功 | □ |
| 4-1 | Yahoo取得 | 外部接続テストタブ | タイトル取得成功 | □ |
| 5-1 | ファイル保存 | Azure Filesタブ | 保存成功 | □ |
| 5-2 | ファイル一覧 | 一覧更新ボタン | ファイル表示 | □ |
| 6 | /client/全機能 | 上記テストを/clientで | 全テスト合格 | □ |
| 7 | ヘルスチェック | /api/health | app=UP, db=UP | □ |

---

## 5.10 よくある問題と対処法まとめ

### ネットワーク関連
| 問題 | 原因 | 対処 |
|:---|:---|:---|
| App GatewayがVMに到達しない | NSGルールの不備 | フロントエンドサブネットのNSGでHTTP(80)を許可 |
| APIコール失敗 | バックエンドサブネットのNSG | `172.16.1.0/24` と `172.16.0.0/24` から 8080 を受信許可 |
| `/api/*` が404 | App Gateway パスマップ未設定 | `rule-api`（`/api/*`）を追加 |
| `/api/*` が502 | バックエンドヘルス不良 | `probe-api-health` を `http-settings-api` に紐付け |
| DB接続エラー | Private Endpoint未設定 | Private Endpoint+DNS Zone設定を確認 |
| Yahoo接続エラー | NAT Gateway未設定 | NAT GatewayがバックエンドサブネットにAssociateされているか確認 |

### アプリケーション関連
| 問題 | 原因 | 対処 |
|:---|:---|:---|
| CORSエラー | CorsConfigのallowedOrigins | App GatewayのIPを追加 |
| ReactのルーティングがWORKしない | URL Rewrite未設定 | web.configを確認 |
| APIベースURL誤り | `.env.production.*` 設定 | `VITE_API_BASE_URL=`（空）で同一オリジンに統一 |
| Azure Files保存エラー | Zドライブ未マウント | `net use`でマウント状態確認 |
